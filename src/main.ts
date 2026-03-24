import "./index.css";
import { GAMES } from "./games";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Root element not found.");
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const matchesQuery = (query: string) => {
  const normalized = query.trim().toLowerCase();

  return GAMES.filter((game) => {
    if (!normalized) {
      return true;
    }

    return (
      game.name.toLowerCase().includes(normalized) ||
      game.tags.some((tag) => tag.includes(normalized)) ||
      game.skills.some((skill) => skill.includes(normalized)) ||
      game.subjects.some((subject) => subject.includes(normalized)) ||
      game.manifest.toLowerCase().includes(normalized) ||
      `${game.ageRange[0]}-${game.ageRange[1]}`.includes(normalized)
    );
  });
};

const render = (query = "") => {
  const filtered = matchesQuery(query);
  const cards = filtered
    .map(
      (game) => `
        <a class="game-card" href="${game.url}">
          <div class="game-icon">${game.icon}</div>
          <div class="game-meta">
            <h2>${escapeHtml(game.name)}</h2>
            <p>Ages ${game.ageRange[0]}-${game.ageRange[1]}</p>
          </div>
          <div class="tag-row">
            ${game.tags
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}
          </div>
        </a>
      `,
    )
    .join("");

  root.innerHTML = `
    <main class="page-shell">
      <header class="page-header">
        <h1>Interactive Maths</h1>
        <p>Arcade-style games for children aged 7–12</p>
      </header>

      <div class="search-wrap">
        <input
          id="game-search"
          class="search-input"
          type="text"
          value="${escapeHtml(query)}"
          placeholder="Search by topic, skill, or age..."
          autocomplete="off"
        />
      </div>

      ${
        filtered.length === 0
          ? `<p class="empty-state">No games found.</p>`
          : `<section class="game-grid">${cards}</section>`
      }
    </main>
  `;

  const searchInput = root.querySelector<HTMLInputElement>("#game-search");

  if (searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    searchInput.addEventListener("input", (event) => {
      render((event.currentTarget as HTMLInputElement).value);
    });
  }
};

render();
