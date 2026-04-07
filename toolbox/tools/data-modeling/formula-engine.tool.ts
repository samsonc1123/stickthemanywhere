/**
 * toolbox/tools/data-modeling/formula-engine.tool.ts
 * version: 1.0.0
 *
 * Yellow Pages — Formula Engine.
 * Pure TypeScript. Zero framework imports.
 *
 * Generates Excel / Google Sheets compatible formula strings from
 * column names, ranges, and dataset descriptions. All formulas are
 * platform-aware (Sheets vs Excel syntax differences handled).
 *
 * Pillar: Business Automation (GAB domain: BUSINESS-AUTOMATION)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type Platform = "sheets" | "excel";

export interface FormulaContext {
  /** Target platform */
  platform: Platform;
  /** Total data rows (excluding header). e.g. 1000 */
  dataRows: number;
  /** Header row number. Default 1 */
  headerRow?: number;
  /** Sheet/tab name to qualify references with. e.g. "Leads" */
  sheetName?: string;
}

export interface FormulaResult {
  formula: string;
  description: string;
  platform: Platform;
  category: FormulaCategory;
}

export type FormulaCategory =
  | "aggregation"
  | "lookup"
  | "growth"
  | "conditional"
  | "statistical"
  | "text"
  | "date"
  | "financial";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Build a column range string.  e.g. colRange("B", 2, 1001) → "B2:B1001" */
export function colRange(
  letter: string,
  startRow: number,
  endRow: number,
  sheetName?: string
): string {
  const ref = `${letter}${startRow}:${letter}${endRow}`;
  return sheetName ? `'${sheetName}'!${ref}` : ref;
}

/** Build a full-table range.  e.g. tableRange("A", "H", 2, 1001) → "A2:H1001" */
export function tableRange(
  firstLetter: string,
  lastLetter: string,
  startRow: number,
  endRow: number,
  sheetName?: string
): string {
  const ref = `${firstLetter}${startRow}:${lastLetter}${endRow}`;
  return sheetName ? `'${sheetName}'!${ref}` : ref;
}

function dataStart(ctx: FormulaContext): number {
  return (ctx.headerRow ?? 1) + 1;
}

function dataEnd(ctx: FormulaContext): number {
  return (ctx.headerRow ?? 1) + ctx.dataRows;
}

// ═══════════════════════════════════════════════════════════════════
// AGGREGATION FORMULAS
// ═══════════════════════════════════════════════════════════════════

/**
 * SUM — total a numeric column.
 *
 * @param colLetter  Spreadsheet column letter (e.g. "D")
 */
export function SUM(colLetter: string, ctx: FormulaContext): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=SUM(${range})`,
    description: `Total of all values in column ${colLetter}.`,
    platform: ctx.platform,
    category: "aggregation",
  };
}

/**
 * AVERAGE — mean of a numeric column.
 */
export function AVERAGE(colLetter: string, ctx: FormulaContext): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=AVERAGE(${range})`,
    description: `Mean of all values in column ${colLetter}.`,
    platform: ctx.platform,
    category: "aggregation",
  };
}

/**
 * COUNT — count non-empty cells in a column.
 */
export function COUNT(colLetter: string, ctx: FormulaContext): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=COUNTA(${range})`,
    description: `Count of non-empty entries in column ${colLetter}.`,
    platform: ctx.platform,
    category: "aggregation",
  };
}

/**
 * COUNTIF — count rows matching a criterion.
 *
 * @param colLetter     Column to evaluate
 * @param criterion     Value or expression string. e.g. "active" or ">1000"
 */
export function COUNTIF(
  colLetter: string,
  criterion: string,
  ctx: FormulaContext
): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const crit  = /^[<>=!]/.test(criterion) ? `"${criterion}"` : `"${criterion}"`;
  return {
    formula: `=COUNTIF(${range},${crit})`,
    description: `Count of rows in column ${colLetter} matching "${criterion}".`,
    platform: ctx.platform,
    category: "conditional",
  };
}

/**
 * SUMIF — conditional sum.
 *
 * @param criteriaColLetter  Column to test
 * @param criterion          Match value
 * @param sumColLetter       Column to sum
 */
export function SUMIF(
  criteriaColLetter: string,
  criterion: string,
  sumColLetter: string,
  ctx: FormulaContext
): FormulaResult {
  const critRange = colRange(criteriaColLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const sumRange  = colRange(sumColLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=SUMIF(${critRange},"${criterion}",${sumRange})`,
    description: `Sum of column ${sumColLetter} where column ${criteriaColLetter} = "${criterion}".`,
    platform: ctx.platform,
    category: "conditional",
  };
}

// ═══════════════════════════════════════════════════════════════════
// LOOKUP FORMULAS
// ═══════════════════════════════════════════════════════════════════

/**
 * VLOOKUP — find a value in the first column of a table and return
 * a value from the same row.
 *
 * @param lookupValue       The value to find (cell ref or literal). e.g. "A2"
 * @param tableFirstLetter  First column of the lookup table
 * @param tableLastLetter   Last column of the lookup table
 * @param returnColIndex    1-based index of the column to return
 * @param exactMatch        false = approximate, true = exact (default: true)
 */
export function VLOOKUP(
  lookupValue: string,
  tableFirstLetter: string,
  tableLastLetter: string,
  returnColIndex: number,
  ctx: FormulaContext,
  exactMatch = true
): FormulaResult {
  const range  = tableRange(tableFirstLetter, tableLastLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const match  = exactMatch ? 0 : 1;
  return {
    formula: `=VLOOKUP(${lookupValue},${range},${returnColIndex},${match})`,
    description: `Look up ${lookupValue} in column ${tableFirstLetter}, return column index ${returnColIndex}.`,
    platform: ctx.platform,
    category: "lookup",
  };
}

/**
 * XLOOKUP — modern replacement for VLOOKUP.
 * Available in Excel 365 and Google Sheets.
 *
 * @param lookupValue   Cell ref or literal
 * @param lookupLetter  Column to search in
 * @param returnLetter  Column to return from
 */
export function XLOOKUP(
  lookupValue: string,
  lookupLetter: string,
  returnLetter: string,
  ctx: FormulaContext
): FormulaResult {
  const lookupRange = colRange(lookupLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const returnRange = colRange(returnLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=XLOOKUP(${lookupValue},${lookupRange},${returnRange},"Not found")`,
    description: `Look up ${lookupValue} in column ${lookupLetter}, return corresponding value from column ${returnLetter}.`,
    platform: ctx.platform,
    category: "lookup",
  };
}

/**
 * INDEX/MATCH — flexible two-direction lookup.
 *
 * @param returnLetter   Column to return the value from
 * @param matchLetter    Column to search in
 * @param lookupValue    Value to find
 */
export function INDEX_MATCH(
  returnLetter: string,
  matchLetter: string,
  lookupValue: string,
  ctx: FormulaContext
): FormulaResult {
  const returnRange = colRange(returnLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const matchRange  = colRange(matchLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=INDEX(${returnRange},MATCH(${lookupValue},${matchRange},0))`,
    description: `Return value from column ${returnLetter} where column ${matchLetter} = ${lookupValue}.`,
    platform: ctx.platform,
    category: "lookup",
  };
}

// ═══════════════════════════════════════════════════════════════════
// GROWTH / TREND FORMULAS
// ═══════════════════════════════════════════════════════════════════

/**
 * GROWTH — exponential growth prediction.
 * Fits a curve to known_y and known_x, predicts new_y at new_x.
 *
 * @param knownYLetter   Column with known dependent values (revenue, users, etc.)
 * @param knownXLetter   Column with known independent values (month index, date, etc.)
 * @param newXRef        Cell reference for the new X value to predict at
 */
export function GROWTH(
  knownYLetter: string,
  knownXLetter: string,
  newXRef: string,
  ctx: FormulaContext
): FormulaResult {
  const yRange = colRange(knownYLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const xRange = colRange(knownXLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=GROWTH(${yRange},${xRange},${newXRef})`,
    description: `Predict exponential growth for ${newXRef} based on column ${knownYLetter} (Y) and column ${knownXLetter} (X).`,
    platform: ctx.platform,
    category: "growth",
  };
}

/**
 * TREND — linear trend prediction.
 */
export function TREND(
  knownYLetter: string,
  knownXLetter: string,
  newXRef: string,
  ctx: FormulaContext
): FormulaResult {
  const yRange = colRange(knownYLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const xRange = colRange(knownXLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  return {
    formula: `=TREND(${yRange},${xRange},${newXRef})`,
    description: `Predict linear trend for ${newXRef} based on column ${knownYLetter} (Y) and column ${knownXLetter} (X).`,
    platform: ctx.platform,
    category: "growth",
  };
}

/**
 * FORECAST / FORECAST.LINEAR — point-in-time prediction.
 *
 * Google Sheets uses FORECAST, Excel 2016+ uses FORECAST.LINEAR.
 */
export function FORECAST(
  xValue: string,
  knownYLetter: string,
  knownXLetter: string,
  ctx: FormulaContext
): FormulaResult {
  const yRange   = colRange(knownYLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const xRange   = colRange(knownXLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const fnName   = ctx.platform === "sheets" ? "FORECAST" : "FORECAST.LINEAR";
  return {
    formula: `=${fnName}(${xValue},${yRange},${xRange})`,
    description: `Forecast value at ${xValue} using linear regression on columns ${knownYLetter} and ${knownXLetter}.`,
    platform: ctx.platform,
    category: "growth",
  };
}

/**
 * Compound Annual Growth Rate (CAGR) formula string.
 *
 * @param endValueRef    Cell reference for end value
 * @param startValueRef  Cell reference for start value
 * @param years          Number of years (literal number or cell ref)
 */
export function CAGR(
  endValueRef: string,
  startValueRef: string,
  years: number | string,
  ctx: FormulaContext
): FormulaResult {
  return {
    formula: `=(${endValueRef}/${startValueRef})^(1/${years})-1`,
    description: `CAGR from ${startValueRef} to ${endValueRef} over ${years} year(s).`,
    platform: ctx.platform,
    category: "growth",
  };
}

// ═══════════════════════════════════════════════════════════════════
// STATISTICAL FORMULAS
// ═══════════════════════════════════════════════════════════════════

/**
 * STDEV — population standard deviation.
 */
export function STDEV(colLetter: string, ctx: FormulaContext): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const fn    = ctx.platform === "sheets" ? "STDEV" : "STDEV.S";
  return {
    formula: `=${fn}(${range})`,
    description: `Sample standard deviation of column ${colLetter}.`,
    platform: ctx.platform,
    category: "statistical",
  };
}

/**
 * PERCENTILE — nth percentile of a column.
 *
 * @param percentile  0–1. e.g. 0.9 for 90th percentile.
 */
export function PERCENTILE(
  colLetter: string,
  percentile: number,
  ctx: FormulaContext
): FormulaResult {
  const range = colRange(colLetter, dataStart(ctx), dataEnd(ctx), ctx.sheetName);
  const fn    = ctx.platform === "sheets" ? "PERCENTILE" : "PERCENTILE.INC";
  return {
    formula: `=${fn}(${range},${percentile})`,
    description: `${percentile * 100}th percentile of column ${colLetter}.`,
    platform: ctx.platform,
    category: "statistical",
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEXT FORMULAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Concatenate first name + last name columns (or any two text columns).
 */
export function CONCAT(
  firstLetter: string,
  secondLetter: string,
  row: number,
  separator = " "
): FormulaResult {
  return {
    formula: `=CONCATENATE(${firstLetter}${row},"${separator}",${secondLetter}${row})`,
    description: `Concatenate column ${firstLetter} and column ${secondLetter} with separator "${separator}".`,
    platform: "sheets",
    category: "text",
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE — Generate a full formula suite for a schema
// ═══════════════════════════════════════════════════════════════════

export interface FormulaSuite {
  label: string;
  formulas: FormulaResult[];
}

/**
 * Given a list of measure column letters, dimension column letters,
 * and a date column letter, generate a full ready-to-use formula suite.
 *
 * This is the Yellow Pages "one-click" entry point.
 *
 * @example
 * generateFormulaSuite(
 *   ["D", "E"],           // measure columns (revenue, employee count)
 *   ["C"],                // dimension columns (category)
 *   "B",                  // date column
 *   { platform: "sheets", dataRows: 500 }
 * )
 */
export function generateFormulaSuite(
  measureLetters: string[],
  dimensionLetters: string[],
  dateColLetter: string | null,
  ctx: FormulaContext
): FormulaSuite[] {
  const suites: FormulaSuite[] = [];

  // ── Totals ──────────────────────────────────────────────────
  if (measureLetters.length > 0) {
    suites.push({
      label: "Totals & Averages",
      formulas: measureLetters.flatMap((col) => [
        SUM(col, ctx),
        AVERAGE(col, ctx),
        COUNT(col, ctx),
        STDEV(col, ctx),
        PERCENTILE(col, 0.9, ctx),
      ]),
    });
  }

  // ── Lookups ─────────────────────────────────────────────────
  if (dimensionLetters.length > 0 && measureLetters.length > 0) {
    const dimCol = dimensionLetters[0];
    const measCol = measureLetters[0];

    suites.push({
      label: "Lookups",
      formulas: [
        VLOOKUP(`A${dataStart(ctx)}`, dimCol, measCol, 2, ctx),
        XLOOKUP(`A${dataStart(ctx)}`, dimCol, measCol, ctx),
        INDEX_MATCH(measCol, dimCol, `A${dataStart(ctx)}`, ctx),
      ],
    });
  }

  // ── Growth / Forecast ────────────────────────────────────────
  if (dateColLetter && measureLetters.length > 0) {
    const measCol = measureLetters[0];
    const nextRow = dataEnd(ctx) + 1;
    suites.push({
      label: "Growth & Forecast",
      formulas: [
        GROWTH(measCol, dateColLetter, `${dateColLetter}${nextRow}`, ctx),
        TREND(measCol, dateColLetter, `${dateColLetter}${nextRow}`, ctx),
        FORECAST(`${dateColLetter}${nextRow}`, measCol, dateColLetter, ctx),
      ],
    });
  }

  return suites;
}
