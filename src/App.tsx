import { useEffect, useState } from "react";

interface Game {
  id: string;
  name: string;
  url: string;
  icon: string;
  tags: string[];
  ageRange: [number, number];
  subjects: string[];
  skills: string[];
  description: string;
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Game | null>(null);

  useEffect(() => {
    const listFile = import.meta.env.DEV ? "/games-local.json" : "/games.json";
    fetch(listFile)
      .then((r) => r.json())
      .then((urls: string[]) =>
        Promise.all(
          urls.map((url) =>
            fetch(url.replace(/\/?$/, "/") + "manifest.json")
              .then((r) => r.json())
              .then((m) => ({ ...m, url }))
              .catch(() => null)
          )
        )
      )
      .then((results) => {
        setGames(results.filter(Boolean));
        setLoading(false);
      });
  }, []);

  const filtered = games.filter((g) => {
    const q = query.toLowerCase();
    return (
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q)) ||
      g.skills.some((s) => s.includes(q)) ||
      g.description.toLowerCase().includes(q)
    );
  });

  if (active) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: "#020617" }}>
        <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid #1e293b" }}>
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            ⌂ Home
          </button>
          <span className="text-white font-semibold text-sm">{active.name}</span>
        </div>
        <iframe
          src={active.url}
          className="flex-1 w-full border-0"
          allow="autoplay"
          title={active.name}
        />
      </div>
    );
  }

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
          style={{ background: "#0f172a", border: "1px solid #334155" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#0ea5e9")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#334155")}
        />

        {loading ? (
          <p className="text-slate-500">Loading games…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No games match "{query}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => setActive(g)}
                className="flex flex-col gap-3 rounded-2xl p-4 text-left transition-all"
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
                <div className="w-16 h-16" dangerouslySetInnerHTML={{ __html: g.icon }} />
                <div>
                  <div className="text-white font-bold text-sm leading-tight">{g.name}</div>
                  <div className="text-slate-400 text-xs mt-1">Ages {g.ageRange[0]}–{g.ageRange[1]}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "#1e293b", color: "#94a3b8" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
