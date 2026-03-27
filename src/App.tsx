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

const SKILL_COLORS = [
  { bg: "rgba(56,189,248,0.15)",  color: "#38bdf8" },
  { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24" },
  { bg: "rgba(74,222,128,0.15)",  color: "#4ade80" },
  { bg: "rgba(251,113,133,0.15)", color: "#fb7185" },
  { bg: "rgba(251,146,60,0.15)",  color: "#fb923c" },
];

function renderDescription(text: string) {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) {
      result.push(<div key={key++} className="h-3" />);
    } else if (/^[A-Z][A-Z\s]+:/.test(line)) {
      // Section heading like "WHAT IT DOES:" or "TECH: ..."
      const colon = line.indexOf(":");
      const heading = line.slice(0, colon + 1);
      const rest = line.slice(colon + 1);
      result.push(
        <p key={key++} className="text-xs font-bold tracking-wider mb-1" style={{ color: "#38bdf8" }}>
          {heading}{rest && <span className="font-normal tracking-normal text-slate-300"> {rest.trim()}</span>}
        </p>
      );
    } else if (line.startsWith("- ")) {
      result.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed pl-3" style={{ textIndent: "-0.75rem", paddingLeft: "0.75rem" }}>
          <span style={{ color: "#4ade80" }}>–</span> {line.slice(2)}
        </p>
      );
    } else {
      result.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed">
          {line}
        </p>
      );
    }
  }
  return result;
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Game | null>(null);
  const [drawer, setDrawer] = useState<Game | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const openDrawer = (g: Game) => {
    setDrawer(g);
    setTimeout(() => setDrawerOpen(true), 10);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawer(null), 300);
  };

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
    <div className="min-h-[100lvh] px-6 py-10" style={{ backgroundColor: "#020617" }}>
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
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => openDrawer(g)}
                className="flex flex-col items-center gap-3 rounded-2xl p-2 text-center transition-all cursor-pointer"
                style={{ background: "#0f172a", border: "1px solid #1e293b" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 20px rgba(74,222,128,0.5), 0 0 60px rgba(74,222,128,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
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
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {drawer && (
        <div
          className="fixed inset-0 z-40"
          style={{
            background: drawerOpen ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)",
            transition: "background 0.3s ease",
          }}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer */}
      {drawer && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col md:rounded-t-2xl overflow-hidden"
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
            transition: "transform 0.3s ease",
            maxHeight: "100dvh",
            height: "100dvh",
          }}
        >
          {/* Close button */}
          <button
            onClick={closeDrawer}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors"
            style={{ background: "#1e293b", color: "#94a3b8" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#334155"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1e293b"; }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          {/* Row 1: icon + meta */}
          <div className="flex gap-5 p-6 pb-4 shrink-0" style={{ borderBottom: "1px solid #1e293b" }}>
            <img
              src={base(drawer.url) + "favicon.svg"}
              className="w-40 h-40 object-contain shrink-0"
              alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex flex-col gap-2 justify-center min-w-0">
              <div className="flex flex-wrap gap-1">
                {drawer.skills.slice(0, 4).map((s, i) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: SKILL_COLORS[i % SKILL_COLORS.length].bg,
                      color: SKILL_COLORS[i % SKILL_COLORS.length].color,
                      border: `1px solid ${SKILL_COLORS[i % SKILL_COLORS.length].color}`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">{drawer.name}</h2>
              <button
                onClick={() => { setActive(drawer); closeDrawer(); }}
                className="self-start px-6 py-2 rounded-xl font-bold text-sm text-black cursor-pointer transition-all"
                style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #86efac, #22c55e)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.03)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #4ade80, #16a34a)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                ▶ Play
              </button>
            </div>
          </div>

          {/* Row 2: description */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderDescription(drawer.description)}
          </div>
        </div>
      )}
    </div>
  );
}
