/**
 * toolbox/tools/data-modeling/schema-generator.tool.ts
 * version: 1.0.0
 *
 * Yellow Pages — Schema Generator.
 * Pure TypeScript. Zero framework imports.
 *
 * Takes a JSON "Intent" object (a freeform description of a dataset goal)
 * and outputs a structured column array with inferred data types, roles,
 * and spreadsheet/SQL compatibility metadata.
 *
 * Pillar: Business Automation (GAB domain: BUSINESS-AUTOMATION)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ColumnType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "percentage"
  | "email"
  | "phone"
  | "url"
  | "id"
  | "enum"
  | "formula";

export type ColumnRole =
  | "identifier"  // primary key / lookup id
  | "dimension"   // categorical grouping (VLOOKUP target)
  | "measure"     // numeric fact (SUM / AVERAGE)
  | "label"       // human-readable description
  | "date"        // time axis
  | "flag"        // boolean toggle
  | "computed";   // formula output column

export interface ColumnDefinition {
  /** Machine-safe column key (snake_case) */
  key: string;
  /** Human display label */
  label: string;
  type: ColumnType;
  role: ColumnRole;
  /** Whether nulls are permitted */
  nullable: boolean;
  /** For 'enum' type: allowed values */
  enumValues?: string[];
  /** Default value as a string representation */
  defaultValue?: string;
  /** SQL column definition compatible string */
  sqlType: string;
  /** Google Sheets / Excel compatible format string */
  sheetFormat: string;
  /** Optional description for documentation */
  description?: string;
  /** Index in the output column array (1-based for Sheets A1 reference) */
  columnIndex: number;
  /** Spreadsheet letter reference (A, B, …, Z, AA, …) */
  columnLetter: string;
}

export interface SchemaIntent {
  /**
   * What this dataset is for.
   * Example: "Track Yellow Pages business leads with phone, address, category, and revenue estimate"
   */
  description: string;
  /**
   * Freeform list of field names or descriptions the user wants.
   * Example: ["business name", "phone number", "website url", "annual revenue", "contacted?", "date added"]
   */
  fields: string[];
  /**
   * Optional target platform — affects format strings.
   * @default "sheets"
   */
  platform?: "sheets" | "excel" | "sql" | "json";
  /**
   * Optional enum hints: { fieldKeyword: ["val1", "val2"] }
   * Example: { "status": ["active", "inactive", "pending"] }
   */
  enumHints?: Record<string, string[]>;
}

export interface GeneratedSchema {
  intent: SchemaIntent;
  tableName: string;
  columns: ColumnDefinition[];
  /** Total column count */
  columnCount: number;
  /** Columns identified as measures (numeric facts) — ready for SUM/AVERAGE formulas */
  measures: string[];
  /** Columns identified as dimensions — ready for VLOOKUP/COUNTIF */
  dimensions: string[];
  /** Columns identified as date axes */
  dateAxes: string[];
  /** SQL CREATE TABLE statement */
  sqlCreateTable: string;
  /** Sheets header row (comma-separated labels) */
  sheetsHeaderRow: string;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// INFERENCE RULES
// ═══════════════════════════════════════════════════════════════════

interface InferenceRule {
  /** Keyword patterns to match against the lowercased field name */
  patterns: RegExp[];
  type: ColumnType;
  role: ColumnRole;
  sqlType: string;
  sheetFormat: string;
  nullable: boolean;
  description: string;
}

const INFERENCE_RULES: InferenceRule[] = [
  // ── Identifiers ───────────────────────────────────────────────
  {
    patterns: [/\bid\b/, /\buid\b/, /\buuid\b/, /\bcode\b/],
    type: "id", role: "identifier",
    sqlType: "TEXT NOT NULL", sheetFormat: "@",
    nullable: false, description: "Unique identifier or lookup code.",
  },
  // ── Dates ─────────────────────────────────────────────────────
  {
    patterns: [/date$/, /^date/, /\bday\b/, /\bweek\b/, /\byear\b/, /\bmonth\b/, /added$/, /created$/, /updated$/],
    type: "date", role: "date",
    sqlType: "DATE", sheetFormat: "yyyy-mm-dd",
    nullable: true, description: "Calendar date.",
  },
  {
    patterns: [/timestamp/, /datetime/, /time$/, /^time/],
    type: "datetime", role: "date",
    sqlType: "TIMESTAMPTZ", sheetFormat: "yyyy-mm-dd hh:mm:ss",
    nullable: true, description: "Date and time with timezone.",
  },
  // ── Currency / Revenue ────────────────────────────────────────
  {
    patterns: [/revenue/, /sales/, /price/, /cost/, /fee/, /payment/, /income/, /budget/, /spend/, /amount/, /total/, /subtotal/, /profit/, /margin/, /earning/],
    type: "currency", role: "measure",
    sqlType: "NUMERIC(15,2)", sheetFormat: '"$"#,##0.00',
    nullable: true, description: "Monetary value in USD.",
  },
  // ── Percentage ────────────────────────────────────────────────
  {
    patterns: [/rate$/, /\bpct\b/, /percent/, /ratio/, /share$/, /growth/],
    type: "percentage", role: "measure",
    sqlType: "NUMERIC(6,4)", sheetFormat: "0.00%",
    nullable: true, description: "Percentage or rate (stored as decimal: 0.25 = 25%).",
  },
  // ── Integers / Counts ─────────────────────────────────────────
  {
    patterns: [/count$/, /\bnum\b/, /number$/, /quantity/, /qty/, /rank$/, /score$/, /rating$/, /age$/, /year$/, /employees/, /headcount/, /\bvol\b/, /volume/],
    type: "integer", role: "measure",
    sqlType: "INTEGER", sheetFormat: "#,##0",
    nullable: true, description: "Integer count or quantity.",
  },
  // ── Floats ────────────────────────────────────────────────────
  {
    patterns: [/weight/, /height/, /width/, /length/, /size/, /latitude/, /longitude/, /coord/, /hz$/, /frequency/],
    type: "float", role: "measure",
    sqlType: "DOUBLE PRECISION", sheetFormat: "0.0000",
    nullable: true, description: "Floating point numeric value.",
  },
  // ── Booleans / Flags ──────────────────────────────────────────
  {
    patterns: [/\?$/, /^is_/, /^has_/, /^can_/, /^did_/, /^was_/, /contacted/, /active$/, /enabled$/, /verified$/, /opted/, /subscribed/, /flag$/],
    type: "boolean", role: "flag",
    sqlType: "BOOLEAN DEFAULT FALSE", sheetFormat: '""',
    nullable: false, description: "True/false flag.",
  },
  // ── Email ─────────────────────────────────────────────────────
  {
    patterns: [/email/, /e-mail/, /mailto/],
    type: "email", role: "label",
    sqlType: "TEXT", sheetFormat: "@",
    nullable: true, description: "Email address.",
  },
  // ── Phone ─────────────────────────────────────────────────────
  {
    patterns: [/phone/, /mobile/, /cell/, /fax/, /tel\b/],
    type: "phone", role: "label",
    sqlType: "TEXT", sheetFormat: "@",
    nullable: true, description: "Phone number (stored as text to preserve formatting).",
  },
  // ── URL / Website ─────────────────────────────────────────────
  {
    patterns: [/url/, /website/, /site$/, /domain/, /link/, /href/, /http/],
    type: "url", role: "label",
    sqlType: "TEXT", sheetFormat: "@",
    nullable: true, description: "URL or web address.",
  },
  // ── Categorical / Dimension ───────────────────────────────────
  {
    patterns: [/category/, /type$/, /\bkind\b/, /status$/, /state$/, /tier$/, /segment$/, /class$/, /group$/, /industry/, /sector/, /tag/, /label/],
    type: "enum", role: "dimension",
    sqlType: "TEXT", sheetFormat: "@",
    nullable: true, description: "Categorical dimension for grouping and filtering.",
  },
  // ── Name / Label (catch-all text) ─────────────────────────────
  {
    patterns: [/name$/, /^name/, /title$/, /address/, /city$/, /state$/, /zip$/, /country$/, /region$/, /note$/, /comment$/, /description$/, /detail/, /summary/],
    type: "string", role: "label",
    sqlType: "TEXT", sheetFormat: "@",
    nullable: true, description: "Text label or description.",
  },
];

// Fallback rule when nothing matches
const FALLBACK_RULE: InferenceRule = {
  patterns: [],
  type: "string", role: "dimension",
  sqlType: "TEXT", sheetFormat: "@",
  nullable: true, description: "General text field.",
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Convert any raw field string to snake_case key */
function toSnakeCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Convert any raw field string to Title Case label */
function toLabel(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a 1-based column index to spreadsheet letter(s): 1→A, 27→AA */
export function indexToColumnLetter(index: number): string {
  let letter = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

/** Derive a table name from the intent description */
function deriveTableName(description: string): string {
  return toSnakeCase(description.split(/\s+/).slice(0, 4).join(" "));
}

/** Infer rule for a field name */
function inferRule(key: string, enumHints?: Record<string, string[]>): InferenceRule {
  // Check enum hints first
  if (enumHints) {
    for (const [hint] of Object.entries(enumHints)) {
      if (key.includes(toSnakeCase(hint))) {
        return {
          patterns: [], type: "enum", role: "dimension",
          sqlType: "TEXT", sheetFormat: "@",
          nullable: true, description: `Enumerated field: ${hint}.`,
        };
      }
    }
  }

  for (const rule of INFERENCE_RULES) {
    if (rule.patterns.some((p) => p.test(key))) return rule;
  }
  return FALLBACK_RULE;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT — generateSchema
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a structured column array from a JSON Intent.
 *
 * @example
 * generateSchema({
 *   description: "Yellow Pages business lead tracker",
 *   fields: ["business name", "phone number", "website url", "annual revenue", "contacted?", "date added", "category"],
 *   enumHints: { category: ["restaurant", "retail", "medical", "legal"] }
 * })
 */
export function generateSchema(intent: SchemaIntent): GeneratedSchema {
  const platform   = intent.platform ?? "sheets";
  const tableName  = deriveTableName(intent.description);
  const columns: ColumnDefinition[] = [];

  // Always prepend a row_id identifier if not already present
  const rawFields = intent.fields.some((f) => /\bid\b/.test(toSnakeCase(f)))
    ? intent.fields
    : ["id", ...intent.fields];

  rawFields.forEach((raw, idx) => {
    const key      = toSnakeCase(raw);
    const label    = toLabel(raw);
    const rule     = inferRule(key, intent.enumHints);
    const colIdx   = idx + 1;
    const colLetter = indexToColumnLetter(colIdx);

    const col: ColumnDefinition = {
      key,
      label,
      type:         rule.type,
      role:         rule.role,
      nullable:     rule.nullable,
      sqlType:      rule.sqlType,
      sheetFormat:  rule.sheetFormat,
      description:  rule.description,
      columnIndex:  colIdx,
      columnLetter: colLetter,
    };

    // Attach enum values from hints if this column matched an enum hint
    if (rule.type === "enum" && intent.enumHints) {
      for (const [hint, vals] of Object.entries(intent.enumHints)) {
        if (key.includes(toSnakeCase(hint))) {
          col.enumValues = vals;
          break;
        }
      }
    }

    columns.push(col);
  });

  const measures   = columns.filter((c) => c.role === "measure").map((c) => c.key);
  const dimensions = columns.filter((c) => c.role === "dimension").map((c) => c.key);
  const dateAxes   = columns.filter((c) => c.role === "date").map((c) => c.key);

  // ── SQL CREATE TABLE ─────────────────────────────────────────
  const colDefs = columns.map((c) => `  ${c.key.padEnd(30)} ${c.sqlType}`).join(",\n");
  const sqlCreateTable = `CREATE TABLE IF NOT EXISTS ${tableName} (\n${colDefs}\n);`;

  // ── Sheets header row ────────────────────────────────────────
  const sheetsHeaderRow = columns.map((c) => c.label).join(",");

  return {
    intent,
    tableName,
    columns,
    columnCount: columns.length,
    measures,
    dimensions,
    dateAxes,
    sqlCreateTable,
    sheetsHeaderRow,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY — Validate an existing column array
// ═══════════════════════════════════════════════════════════════════

export interface SchemaValidationError {
  columnKey: string;
  message: string;
}

/**
 * Validate a generated column array for common issues.
 * Returns an array of errors (empty = valid).
 */
export function validateSchema(columns: ColumnDefinition[]): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const seenKeys = new Set<string>();

  for (const col of columns) {
    if (!col.key) {
      errors.push({ columnKey: "(empty)", message: "Column key is empty." });
    }
    if (seenKeys.has(col.key)) {
      errors.push({ columnKey: col.key, message: `Duplicate column key "${col.key}".` });
    }
    seenKeys.add(col.key);

    if (col.type === "enum" && (!col.enumValues || col.enumValues.length === 0)) {
      errors.push({ columnKey: col.key, message: "Enum column has no enumValues defined." });
    }
  }

  return errors;
}
