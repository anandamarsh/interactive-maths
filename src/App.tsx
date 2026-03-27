import { useEffect, useState } from "react";

interface Game {
  id: string;
  name: string;
  url: string;
  tags: string[];
  subjects: string[];
  skills: string[];
  description: string;
}

const base = (url: string) => url.replace(/\/?$/, "/");

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
            fetch(base(url) + "manifest.json")
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
      <div className="fixed inset-0" style={{ backgroundColor: "#020617" }}>
        <iframe
          src={active.url}
          className="w-full h-full border-0"
          allow="autoplay"
          title={active.name}
        />
        <button
          onClick={() => setActive(null)}
          title="Home"
          className="arcade-button absolute top-2 left-2 w-10 h-10 p-2"
        >
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="white">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100lvh] px-6 py-10"
      style={{ backgroundColor: "#020617" }}
    >
      <div className="max-w-5xl mx-auto w-full">
        <header className="flex flex-col items-center text-center mb-10">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-sky-400 mb-2">
            Interactive Maths
          </p>
          <h1 className="text-4xl font-black text-white mb-1">Game Library</h1>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic or skill…"
            className="w-full max-w-md rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none text-left mt-6"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0ea5e9")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#334155")}
          />
        </header>

        {loading ? (
          <p className="text-slate-500">Loading games…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">No games match "{query}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((g) => {
              return (
                <button
                  key={g.id}
                  onClick={() => setActive(g)}
                  className="group flex flex-col items-center gap-3 rounded-2xl p-2 text-center transition-all relative"
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
                  <img
                    src={base(g.url) + "favicon.svg"}
                    className="w-32 h-32 object-contain"
                    alt=""
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="text-white font-bold text-sm leading-tight">{g.name}</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {g.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "#1e293b", color: "#94a3b8" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Hover: floating description — anchored to card top-left, covers card + extends right */}
                  <div
                    className="hidden md:block absolute top-0 left-0 z-50 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150"
                    style={{
                      width: "520px",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "0.75rem",
                      padding: "1rem",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                      maxHeight: "400px",
                      overflowY: "auto",
                    }}
                  >
                    <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap m-0 text-left">
                      {g.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
