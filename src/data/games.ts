import type { Game } from "../types";

export const GAMES: Game[] = [
  {
    id: "kite-line",
    slug: "kite-line",
    title: "Kite Line",
    genre: "Reflex",
    sessionMinutes: 6,
    fantasy: "Guide a paper kite through shifting winds above a golden coastal city.",
    description:
      "Hold a line of wind and let it go. Kite Line is a short reflex session about staying inside moving corridors of air above an amber coast.",
    howToPlay: [
      "Keep the kite inside the glowing wind corridor.",
      "Hold to climb. Release to settle.",
      "Leaving the corridor reduces stability. Recover before it tears.",
    ],
    cover: "/covers/kite-line-cover.png",
    coverAlt: "A paper kite crossing wind ribbons above an amber coastal skyline.",
    previewAlt: "Muted preview of wind corridors and a paper kite.",
    controls: {
      desktop: ["Hold Space or click to climb", "Release to descend", "Esc to pause"],
      touch: ["Hold the playfield to climb", "Release to descend"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
  },
  {
    id: "lantern-path",
    slug: "lantern-path",
    title: "Lantern Path",
    genre: "Puzzle",
    sessionMinutes: 8,
    fantasy: "Light forgotten lanterns and trace one unbroken path through a sleeping garden.",
    description:
      "A quiet garden of lantern nodes. Light each one by tracing a single path that never doubles back.",
    howToPlay: [
      "Start on any lantern and move to an adjacent lantern.",
      "Visit every lantern exactly once.",
      "Complete the path to wake the garden.",
    ],
    cover: "/covers/lantern-path-cover.png",
    coverAlt: "An overhead garden maze with illuminated lantern nodes and deep blue shadows.",
    previewAlt: "Muted preview of lantern nodes in a garden maze.",
    controls: {
      desktop: ["Click or use arrow keys to move between lanterns", "R to restart the puzzle", "Esc to pause"],
      touch: ["Tap an adjacent lantern to extend the path"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
  },
  {
    id: "tide-tap",
    slug: "tide-tap",
    title: "Tide Tap",
    genre: "Rhythm",
    sessionMinutes: 5,
    fantasy: "Follow the ocean’s rhythm as luminous waves carry melodies toward distant shores.",
    description:
      "Read the expanding rings and tap when a wave meets the horizon ring. Visual timing is complete even with sound off.",
    howToPlay: [
      "Watch the luminous ring grow toward the gold horizon.",
      "Tap or press Space as it meets the ring.",
      "Sound is optional. Timing is always visible.",
    ],
    cover: "/covers/tide-tap-cover.png",
    coverAlt: "Luminous wave bands meeting a quiet horizon with musical visual motifs.",
    previewAlt: "Muted preview of expanding tide rings.",
    controls: {
      desktop: ["Space or click to tap a wave", "Esc to pause"],
      touch: ["Tap the playfield when a ring meets the horizon"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
  },
  {
    id: "paper-gharial",
    slug: "paper-gharial",
    title: "Paper Gharial",
    genre: "Calm",
    sessionMinutes: 7,
    fantasy: "Steer a folded gharial past moonlit reeds without disturbing the quiet river.",
    description:
      "A stealth puzzle on folded paper water. Move only when the reeds look away, and reach the moonlit bank.",
    howToPlay: [
      "Move one reed-length at a time.",
      "Awareness rises if a reed faces you.",
      "Reach the far bank without filling the awareness meter.",
    ],
    cover: "/covers/paper-gharial-cover.png",
    coverAlt: "An origami gharial beneath moonlit reeds in layered paper scenery.",
    previewAlt: "Muted preview of a paper gharial among moonlit reeds.",
    controls: {
      desktop: ["Arrow keys or WASD to move", "Esc to pause"],
      touch: ["Swipe or use on-screen arrows"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
  },
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
      desktop: ["Player 1: A / D or 1 / 2", "Player 2: Left / Right arrows", "Esc to pause"],
      touch: ["Alternating turns — tap the matching fold when it is your turn"],
    },
    memberAccess: true,
    rotationEligible: true,
    published: true,
    maintenance: false,
  },
];

export function gameBySlug(slug: string): Game | undefined {
  return GAMES.find((game) => game.slug === slug);
}
