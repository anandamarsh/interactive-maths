import { useState } from "react";
import { GAMES } from "./games";
import { GameCard } from "./GameCard";

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
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10 font-mono">
      <h1 className="text-3xl font-black tracking-tight mb-1">Interactive Maths</h1>
      <p className="text-slate-400 text-sm mb-8">Arcade-style games for children aged 7–12</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by topic, skill, or age..."
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 mb-10"
      />

      {filtered.length === 0 ? (
        <p className="text-slate-500">No games found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}
