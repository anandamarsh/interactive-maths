import { useState } from "react";
import { GAMES } from "./games";

export default function App() {
  const [query, setQuery] = useState("");

  const filtered = GAMES.filter((g) => {
    const q = query.toLowerCase();
    return (
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q)) ||
      g.skills.some((s) => s.includes(q)) ||
      g.manifest.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "#020617" }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-[0.25em] uppercase text-sky-400 mb-2">
          Interactive Maths
        </p>
        <h1 className="text-4xl font-black text-white mb-1">Game Library</h1>
        <p className="text-slate-400 text-sm mb-8">
          Arcade-style maths games for children aged 7–12
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by topic, skill, age…"
          className="w-full max-w-md rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none mb-10"
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#0ea5e9")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#334155")}
        />

        {filtered.length === 0 ? (
          <p className="text-slate-500">No games match "{query}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((g) => (
              <a
                key={g.id}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-3 rounded-2xl p-4 transition-all"
                style={{ background: "#0f172a", border: "1px solid #1e293b" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#0ea5e9";
                  (e.currentTarget as HTMLElement).style.background = "#0c1a2e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#1e293b";
                  (e.currentTarget as HTMLElement).style.background = "#0f172a";
                }}
              >
                <div
                  className="w-16 h-16"
                  dangerouslySetInnerHTML={{ __html: g.icon }}
                />
                <div>
                  <div className="text-white font-bold text-sm leading-tight">{g.name}</div>
                  <div className="text-slate-400 text-xs mt-1">
                    Ages {g.ageRange[0]}–{g.ageRange[1]}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "#1e293b", color: "#94a3b8" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
