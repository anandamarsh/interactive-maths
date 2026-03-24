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
A dinosaur character lives on a trail map with 3–5 named towns connected by road segments. The child drags the character along the trail and watches an odometer accumulate distance in km or miles. Each session generates a fresh random map with randomised town names, distances, and colour palette.

WHAT IT TEACHES:
- Level 1: adding decimal distances across multiple road segments to find a total journey distance
- Level 2: subtraction of decimals with a missing segment shown as "?"
- Level 3: comparison of two distances from a common point with scaffolded working

PEDAGOGICAL NOTES:
- decimal arithmetic is grounded in a map-distance context
- random generation keeps sessions varied
- scaffolded working supports explanation, not just answers
- arcade styling keeps the activity engaging`,
  },
];
