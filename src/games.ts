export interface Game {
  id: string;
  name: string;
  url: string;
  icon: string;
  tags: string[];
  ageRange: [number, number];
  subjects: string[];
  skills: string[];
  manifest: string;
}

export const GAMES: Game[] = [
  {
    id: "maths-distance-calculator",
    name: "Trail Distance Calculator",
    url: "https://anandamarsh.github.io/maths-distance-calculator/",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="12" fill="#0f172a"/>
  <circle cx="10" cy="38" r="5" fill="#fb7185" stroke="#f43f5e" stroke-width="1.5"/>
  <circle cx="32" cy="22" r="5" fill="#fb7185" stroke="#f43f5e" stroke-width="1.5"/>
  <circle cx="54" cy="34" r="5" fill="#fb7185" stroke="#f43f5e" stroke-width="1.5"/>
  <line x1="10" y1="38" x2="32" y2="22" stroke="#facc15" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="32" y1="22" x2="54" y2="34" stroke="#facc15" stroke-width="2.5" stroke-linecap="round"/>
  <text x="18" y="36" font-size="7" fill="#fef9c3" font-family="monospace" font-weight="bold">6.4</text>
  <text x="40" y="24" font-size="7" fill="#fef9c3" font-family="monospace" font-weight="bold">5.1</text>
  <ellipse cx="32" cy="16" rx="5" ry="4" fill="#22c55e"/>
  <circle cx="35" cy="13" r="3" fill="#22c55e"/>
  <circle cx="36.5" cy="12" r="1" fill="white"/>
  <circle cx="37" cy="11.5" r="0.5" fill="#0f172a"/>
</svg>`,
    tags: ["distance", "addition", "subtraction", "map", "decimals"],
    ageRange: [7, 11],
    subjects: ["maths"],
    skills: ["adding decimals", "subtracting decimals", "reading maps", "distance calculation"],
    manifest: `Trail Distance Calculator is an interactive arcade-style maths game for children aged 7–11.

WHAT IT DOES:
A dinosaur character (Rex) lives on a trail map with 3–5 named towns connected by road segments. The child drags Rex along the trail and watches an odometer accumulate distance in km or miles. Each session generates a fresh random map with randomised town names, distances, and colour palette.

WHAT IT TEACHES:
- Level 1: Adding decimal distances across multiple road segments to find a total journey distance. Includes one-hop, two-hop, and round-trip routes.
- Level 2: Subtraction of decimals — the total journey distance is given and one leg is hidden with a "?" label. Child finds the missing segment by subtracting known legs from the total.
- Level 3: Comparison of two distances from a common point. Child fills in three scaffolded rows: leg A distance, leg B distance, then the difference — building the habit of showing working.

INTERACTION MODEL:
Drag-based. Child drags the dinosaur along the road. The odometer counts up as Rex walks and continues counting on backtrack — walking more always adds distance. Node dead zones prevent distance accumulating while Rex stands at a town. A pause toggle lets the child freeze the odometer to inspect the map.

PEDAGOGICAL NOTES:
- Decimal arithmetic is kept concrete via real-world distance metaphor
- Random map generation means no two sessions are identical
- Level 3 three-row input explicitly scaffolds showing working
- 8-bit arcade aesthetic and sound effects maintain engagement

TECH: React, TypeScript, Vite, Tailwind CSS, SVG, Web Audio API. Deployed on GitHub Pages. Forkable.`,
  },
];
