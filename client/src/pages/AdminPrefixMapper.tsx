import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../convex/_generated/api";

export default function AdminPrefixMapper() {
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 300);
    setLocation(target);
  };

  const allPrefixes = useQuery(api.uploads.listAllPrefixes) ?? [];
  const categories = useQuery(api.categories.getAllCategories) ?? [];

  const filtered = allPrefixes.filter((p) => {
    const matchCat = !filterCategory || p.categoryCode === filterCategory;
    const q = search.toUpperCase();
    const matchSearch =
      !q ||
      p.prefix.includes(q) ||
      p.subcategoryName.toUpperCase().includes(q) ||
      p.categoryName.toUpperCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped: Record<string, typeof filtered> = {};
  for (const p of filtered) {
    if (!grouped[p.categoryCode]) grouped[p.categoryCode] = [];
    grouped[p.categoryCode].push(p);
  }

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron p-4 relative">
      <div
        onTouchStart={() => handleTapZone("/admin")}
        onClick={() => handleTapZone("/admin")}
        className={`fixed top-0 left-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === "/admin" ? "bg-white/30" : "bg-transparent"}`}
        title="Admin Dugout"
        style={{ pointerEvents: "auto", WebkitTapHighlightColor: "transparent" }}
      />
      <div
        onTouchStart={() => handleTapZone("/admin/uploader")}
        onClick={() => handleTapZone("/admin/uploader")}
        className={`fixed top-0 right-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === "/admin/uploader" ? "bg-white/30" : "bg-transparent"}`}
        title="Uploader"
        style={{ pointerEvents: "auto", WebkitTapHighlightColor: "transparent" }}
      />

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 pt-4">
          <h1
            className="text-3xl md:text-4xl font-orbitron font-bold tracking-wider uppercase"
            style={{
              background: "linear-gradient(45deg, #ff00ff, #00ffff, #ff00ff)",
              backgroundSize: "300% 300%",
              animation: "gradient-shift 4s ease infinite",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Prefix Rules
          </h1>
          <style>{`@keyframes gradient-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }`}</style>
          <p className="text-[11px] font-mono text-gray-500 uppercase tracking-widest mt-2">
            {allPrefixes.length} prefix codes · {categories.length} categories
          </p>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="Search prefix or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] bg-black border border-cyan-900/50 rounded px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 placeholder-gray-600"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-black border border-fuchsia-900/50 rounded px-3 py-2 text-xs text-fuchsia-300 font-mono focus:outline-none focus:border-fuchsia-500"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {allPrefixes.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-yellow-400 font-bold uppercase tracking-wider text-sm">No prefix rules found</p>
            <p className="text-gray-500 text-xs font-mono">
              Seed the taxonomy in the Uploader first to populate prefixes.
            </p>
            <button
              onClick={() => setLocation("/admin/uploader")}
              className="mt-2 px-4 py-2 bg-cyan-900/40 border border-cyan-500/40 rounded text-cyan-400 text-xs font-bold uppercase tracking-wider hover:bg-cyan-900/60 transition-colors"
            >
              Go to Uploader → Seed Taxonomy
            </button>
          </div>
        )}

        {Object.entries(grouped).map(([catCode, rows]) => (
          <div key={catCode} className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-fuchsia-400 bg-fuchsia-900/20 border border-fuchsia-700/40 px-2 py-0.5 rounded">
                {catCode}
              </span>
              <span className="text-[11px] text-gray-400 font-mono">{rows[0].categoryName}</span>
              <span className="text-[10px] text-gray-600 font-mono ml-auto">{rows.length} prefixes</span>
            </div>

            <div className="grid gap-1.5">
              {rows.map((row) => (
                <div
                  key={row.prefix}
                  className="flex items-center gap-3 bg-black/40 border border-gray-800 rounded px-3 py-2 hover:border-cyan-800 transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-cyan-400 w-36 shrink-0 tabular-nums">
                    {row.prefix}
                  </span>
                  <span className="text-gray-700 text-xs shrink-0">→</span>
                  <span className="text-gray-300 text-xs flex-1 truncate">{row.subcategoryName}</span>
                  <span className="text-gray-600 text-[10px] font-mono shrink-0 hidden sm:block">
                    e.g. {row.prefix}00001
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && allPrefixes.length > 0 && (
          <p className="text-center text-gray-600 text-xs font-mono py-8">
            No prefixes match your filter.
          </p>
        )}
      </div>
    </div>
  );
}
