import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../convex/_generated/api";

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "pending";
  message: string;
  detail?: string;
}

export default function AdminDiagnostics() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 300);
    setLocation(target);
  };

  const categories = useQuery(api.categories.getAllCategories) ?? [];
  const subcategories = useQuery(
    api.subcategories.getSubcategoriesByCategory,
    selectedCategory ? { categoryCode: selectedCategory } : "skip"
  ) ?? [];
  const taxonomyStats = useQuery(api.seedTaxonomy.getTaxonomyStats);
  const allPrefixes = useQuery(api.uploads.listAllPrefixes) ?? [];
  const allStickers = useQuery(api.stickers.listAllStickers) ?? [];
  const subcatStickers = useQuery(
    api.stickers.getStickersBySubcategory,
    selectedSubcategory ? { subcategoryCode: selectedSubcategory } : "skip"
  );

  const convexConnected = taxonomyStats !== undefined;

  const runDiagnostics = () => {
    setIsRunning(true);
    const checks: CheckResult[] = [];

    // 1. Convex connection
    checks.push(
      convexConnected
        ? { name: "Convex Connection", status: "pass", message: "Connected to Convex backend" }
        : { name: "Convex Connection", status: "fail", message: "Cannot reach Convex — check VITE_CONVEX_URL" }
    );

    // 2. Categories
    const catCount = taxonomyStats?.categoryCount ?? 0;
    checks.push(
      catCount === 0
        ? { name: "Categories Seeded", status: "fail", message: "0 categories — tap 'Seed Taxonomy' in Uploader first" }
        : { name: "Categories Seeded", status: "pass", message: `${catCount} categories loaded`, detail: categories.slice(0, 5).map(c => c.code).join(", ") + (catCount > 5 ? "…" : "") }
    );

    // 3. Subcategories
    const subCount = taxonomyStats?.subcategoryCount ?? 0;
    checks.push(
      subCount === 0
        ? { name: "Subcategories Seeded", status: "fail", message: "0 subcategories — run Seed Taxonomy" }
        : { name: "Subcategories Seeded", status: "pass", message: `${subCount} subcategories loaded` }
    );

    // 4. Prefix rules (subcategory codes = prefixes)
    checks.push(
      allPrefixes.length === 0
        ? { name: "Prefix Rules", status: subCount > 0 ? "warn" : "fail", message: allPrefixes.length === 0 && subCount > 0 ? "Loading…" : "No prefix codes found" }
        : { name: "Prefix Rules", status: "pass", message: `${allPrefixes.length} prefix codes mapped`, detail: allPrefixes.slice(0, 3).map(p => `${p.prefix} → ${p.subcategoryName}`).join(" | ") }
    );

    // 5. Sticker catalog
    checks.push({
      name: "Sticker Catalog",
      status: "pass",
      message: `${allStickers.length} stickers in catalog (showing up to 100 most recent)`,
    });

    // 6. Subcategory lookup by semantic code (the key test)
    if (selectedCategory) {
      checks.push(
        subcategories.length === 0
          ? { name: `Subcategory Lookup: ${selectedCategory}`, status: "warn", message: `No subcategories found for category code "${selectedCategory}" — is it seeded?` }
          : {
              name: `Subcategory Lookup: ${selectedCategory}`,
              status: "pass",
              message: `Found ${subcategories.length} subcategories via categoryCode="${selectedCategory}"`,
              detail: subcategories.map(s => `${s.code} (${s.name})`).join(", "),
            }
      );
    }

    // 7. Code generation preview
    if (selectedSubcategory) {
      const count = subcatStickers?.length ?? 0;
      const maxNum = (subcatStickers ?? []).reduce((max, s) => {
        const sep = s.code.startsWith(selectedSubcategory + "-") ? 1 : 0;
        const suffix = s.code.slice(selectedSubcategory.length + sep);
        const n = parseInt(suffix, 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      const nextCode = `${selectedSubcategory}-${String(maxNum + 1).padStart(5, "0")}`;
      checks.push({
        name: `Next Code Preview: ${selectedSubcategory}`,
        status: "pass",
        message: `${count} sticker(s) exist → next upload will be assigned: ${nextCode}`,
      });
    }

    setResults(checks);
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron p-4 relative">
      <div
        onTouchStart={() => handleTapZone("/admin")}
        onClick={() => handleTapZone("/admin")}
        className={`fixed top-0 left-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === "/admin" ? "bg-white/30" : "bg-transparent"}`}
        style={{ pointerEvents: "auto", WebkitTapHighlightColor: "transparent" }}
      />
      <div
        onTouchStart={() => handleTapZone("/admin/reorder")}
        onClick={() => handleTapZone("/admin/reorder")}
        className={`fixed top-0 right-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === "/admin/reorder" ? "bg-white/30" : "bg-transparent"}`}
        style={{ pointerEvents: "auto", WebkitTapHighlightColor: "transparent" }}
      />

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-3xl md:text-4xl font-orbitron font-bold tracking-wider uppercase"
            style={{ color: "#00ffff", textShadow: "0 0 20px rgba(0,255,255,0.5)" }}>
            Diagnostics
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={`w-2 h-2 rounded-full ${convexConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">
              {convexConnected ? "Convex connected" : "Connecting…"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-black/40 border border-cyan-900/40 rounded-lg p-4 space-y-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-mono">Optional: narrow tests</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-mono block mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubcategory(""); }}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  data-testid="select-category"
                >
                  <option value="">— Skip —</option>
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-mono block mb-1">Subcategory (code preview)</label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  disabled={!selectedCategory}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs text-fuchsia-300 font-mono focus:outline-none focus:border-fuchsia-500 disabled:opacity-40"
                >
                  <option value="">— Skip —</option>
                  {subcategories.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={runDiagnostics}
              disabled={isRunning || !convexConnected}
              className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-run-diagnostics"
            >
              {isRunning ? "Running…" : "Run All Diagnostics"}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="bg-black/40 border border-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-mono mb-3">
                Results — {results.filter(r => r.status === "pass").length}/{results.length} passed
              </p>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded p-3 border text-xs ${
                    r.status === "pass" ? "bg-green-900/20 border-green-800" :
                    r.status === "fail" ? "bg-red-900/20 border-red-800" :
                    r.status === "warn" ? "bg-yellow-900/20 border-yellow-800" :
                    "bg-gray-800/30 border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold font-mono text-[11px] text-gray-200 truncate">{r.name}</span>
                    <span className={`font-mono font-bold text-[10px] shrink-0 ${
                      r.status === "pass" ? "text-green-400" :
                      r.status === "fail" ? "text-red-400" :
                      r.status === "warn" ? "text-yellow-400" : "text-gray-500"
                    }`}>
                      {r.status === "pass" ? "✓ PASS" : r.status === "fail" ? "✗ FAIL" : r.status === "warn" ? "⚠ WARN" : "—"}
                    </span>
                  </div>
                  <p className="text-gray-400 font-mono mt-1">{r.message}</p>
                  {r.detail && (
                    <p className="text-gray-600 font-mono text-[10px] mt-1 break-all">{r.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="bg-black/30 border border-gray-800/50 rounded-lg p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest font-mono mb-2">What each test checks</p>
            <ul className="text-[11px] text-gray-600 font-mono space-y-1">
              <li>• <span className="text-gray-400">Convex Connection</span> — live ping to Convex backend</li>
              <li>• <span className="text-gray-400">Categories / Subcategories Seeded</span> — counts from Convex taxonomy tables</li>
              <li>• <span className="text-gray-400">Prefix Rules</span> — subcategory codes used as sticker prefix templates</li>
              <li>• <span className="text-gray-400">Sticker Catalog</span> — total uploaded stickers in Convex</li>
              <li>• <span className="text-gray-400">Subcategory Lookup</span> — fetches subcategories by semantic categoryCode string (e.g. "FLOWERS")</li>
              <li>• <span className="text-gray-400">Next Code Preview</span> — simulates what code the next upload into that subcategory will receive (e.g. FLO-ROS-00043)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
