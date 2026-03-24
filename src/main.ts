import "./index.css";
import { GAMES } from "./games";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Root element not found.");
}

const activeGameId = new URLSearchParams(window.location.search).get("game") ?? GAMES[0]?.id ?? "";
const activeGame = GAMES.find((game) => game.id === activeGameId) ?? GAMES[0];

if (!activeGame) {
  root.innerHTML = `
    <main class="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <p>No games configured.</p>
    </main>
  `;
} else {
  const buttons = GAMES.map((game) => {
    const activeClass =
      game.id === activeGame.id
        ? "rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black"
        : "rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300";

    return `<button class="${activeClass}" type="button" data-game-id="${game.id}">${game.name}</button>`;
  }).join("");

  root.innerHTML = `
    <main class="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header class="flex items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3">
        <div>
          <h1 class="text-sm font-semibold uppercase tracking-[0.2em]">Interactive Maths</h1>
          <p class="text-xs text-neutral-400">Each game runs independently inside its own page.</p>
        </div>
        <div class="flex items-center gap-2">${buttons}</div>
      </header>
      <section class="flex-1">
        <iframe
          src="${activeGame.url}"
          title="${activeGame.name}"
          class="h-[calc(100vh-61px)] w-full border-0"
          loading="eager"
        ></iframe>
      </section>
    </main>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-game-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.dataset.gameId;

      if (!gameId) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      params.set("game", gameId);
      window.location.search = params.toString();
    });
  });
}
