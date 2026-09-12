import type { Game } from "../types";
import { COLLECTION } from "./collection";

export const GAMES: Game[] = [
  ...COLLECTION,
  {
    id: "rangoli-recall",
    slug: "rangoli-recall",
    title: "Rangoli Recall",
    genre: "Puzzle",
    sessionMinutes: 6,
    fantasy: "Remember bright rangoli patterns and rebuild their beauty before the colors fade.",
    description:
      "Study a rangoli of shapes and positions, then rebuild it from memory. Color helps, but shape and place are enough.",
    howToPlay: [
      "Study the pattern of shapes in their positions.",
      "Rebuild the same arrangement before time fades.",
      "Shapes and positions matter; color is extra guidance, not the only cue.",
    ],
    cover: "/covers/rangoli-recall-cover.png",
    coverAlt: "A symmetrical rangoli pattern made from luminous, textured colored powder.",
    previewAlt: "Muted preview of a rangoli memory pattern.",
    controls: {
      desktop: ["Click a cell, then choose a shape", "Esc to pause"],
      touch: ["Tap a cell, then tap a shape token"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
    isNew: true,
  },
  {
    id: "two-player-fold",
    slug: "two-player-fold",
    title: "Two-player Fold",
    genre: "Party",
    sessionMinutes: 8,
    fantasy: "Challenge a friend to fold matching shapes in a playful paper duel.",
    description:
      "A local paper duel. On a wide screen both players fold at once. On a narrow phone, take clearly labeled alternating turns.",
    howToPlay: [
      "Match the shown fold as it appears.",
      "Desktop: both players act at the same time.",
      "Narrow touch: alternating-turn mode, labeled as different from simultaneous play.",
    ],
    cover: "/covers/two-player-fold-cover.png",
    coverAlt: "Two contrasting folded-paper forms meeting across a central seam.",
    previewAlt: "Muted preview of two folded paper forms in a duel.",
    controls: {
      desktop: ["Player 1: Q / W / E / R", "Player 2: arrow keys", "Esc to pause"],
      touch: ["Alternating turns — tap the matching fold when it is your turn"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
    isNew: true,
  },
];

export function gameBySlug(slug: string): Game | undefined {
  return GAMES.find((game) => game.slug === slug);
}
