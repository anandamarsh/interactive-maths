import type { Game } from "./games";

export function GameCard({ game }: { game: Game }) {
  return (
    <a
      href={game.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 hover:border-cyan-500 hover:bg-slate-800 transition-all"
    >
      <div
        className="w-16 h-16"
        dangerouslySetInnerHTML={{ __html: game.icon }}
      />
      <div>
        <div className="text-white font-bold text-sm">{game.name}</div>
        <div className="text-slate-400 text-xs mt-0.5">Ages {game.ageRange[0]}–{game.ageRange[1]}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {game.tags.map((t) => (
          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {t}
          </span>
        ))}
      </div>
    </a>
  );
}
