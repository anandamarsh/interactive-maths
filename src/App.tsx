import { useState } from "react";
import { GAMES } from "./games";

export default function App() {
  const [activeGameId, setActiveGameId] = useState(GAMES[0]?.id ?? "");
  const activeGame = GAMES.find((game) => game.id === activeGameId) ?? GAMES[0];

  if (!activeGame) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
        <p>No games configured.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Interactive Maths</h1>
          <p className="text-xs text-neutral-400">Each game runs independently inside its own page.</p>
        </div>
        <div className="flex items-center gap-2">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGameId(game.id)}
              className={
                game.id === activeGame.id
                  ? "rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black"
                  : "rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300"
              }
            >
              {game.name}
            </button>
          ))}
        </div>
      </header>

      <section className="flex-1">
        <iframe
          key={activeGame.id}
          src={activeGame.url}
          title={activeGame.name}
          className="h-[calc(100vh-61px)] w-full border-0"
          loading="eager"
        />
      </section>
    </main>
  );
}
