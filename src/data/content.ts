import type { Challenge, CosmeticItem, HelpArticle, Story } from "../types";

export const STORIES: Story[] = [
  {
    slug: "paper-light-and-short-sessions",
    title: "Paper, light, and the five-minute world",
    category: "Game art",
    excerpt: "Why the studio builds rooms you can enter between other parts of the day.",
    readingMinutes: 4,
    featured: true,
    dateLabel: "Editorial date pending approval",
    authorLabel: "Studio journal (unsigned)",
    prototypeNote: "Author names and studio history are not invented. This is draft journal copy.",
    relatedGameSlug: "lantern-path",
    body: [
      "Bullwave Games is designed for short, complete sessions. A player should be able to finish a thought in the time it takes tea to cool.",
      "The art direction returns to paper, water, lantern light, wind, and geometry. Those materials keep the catalog feeling like one studio, even when the rules change from puzzle to reflex.",
      "Nothing here is a wager. Stars, frames, and personal bests stay inside the games that earned them.",
    ],
  },
  {
    slug: "why-the-kite-leans",
    title: "Why the kite leans into the corridor",
    category: "Mechanics",
    excerpt: "A note on stability as a readable feeling, not a hidden meter.",
    readingMinutes: 3,
    dateLabel: "Editorial date pending approval",
    authorLabel: "Studio journal (unsigned)",
    prototypeNote: "Draft journal copy.",
    relatedGameSlug: "kite-line",
    body: [
      "Kite Line asks the hands to keep a paper kite inside moving wind. The corridor is the rule, shown in gold light, not explained in a paragraph after failure.",
      "Stability is visible. When it frays, the player can still recover. Continues exist so a short session can finish, not so a ranking can be bought.",
    ],
  },
  {
    slug: "rhythm-you-can-see",
    title: "Rhythm you can see",
    category: "Mechanics",
    excerpt: "Tide Tap keeps time on the screen so sound can stay optional.",
    readingMinutes: 3,
    dateLabel: "Editorial date pending approval",
    authorLabel: "Studio journal (unsigned)",
    prototypeNote: "Draft journal copy.",
    relatedGameSlug: "tide-tap",
    body: [
      "Sound is muted until someone asks for it. Tide Tap still has to be fair. Expanding rings and a gold horizon carry the beat without asking the ear to work first.",
    ],
  },
  {
    slug: "a-quiet-river",
    title: "A quiet river, folded once",
    category: "Game art",
    excerpt: "Paper Gharial is about moving when the reeds look away.",
    readingMinutes: 3,
    dateLabel: "Editorial date pending approval",
    authorLabel: "Studio journal (unsigned)",
    prototypeNote: "Draft journal copy.",
    relatedGameSlug: "paper-gharial",
    body: [
      "The gharial is origami because the studio is built from paper ideas: crease, layer, restraint. Stealth here is courtesy to a moonlit river, not a hunt.",
    ],
  },
  {
    slug: "studio-updates-are-small",
    title: "Studio updates stay small on purpose",
    category: "Studio updates",
    excerpt: "What we share, and what we will not invent for atmosphere.",
    readingMinutes: 2,
    dateLabel: "Editorial date pending approval",
    authorLabel: "Studio journal (unsigned)",
    prototypeNote: "Draft journal copy. No awards or staff identities are claimed.",
    body: [
      "This journal will carry art notes, mechanical notes, and operational updates. It will not invent awards, staff biographies, or a longer history than the studio has.",
    ],
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "playing-todays-free-games",
    title: "Playing today’s free games",
    shortAnswer: "Anyone can play the three games in today’s free rotation, subject to the session allowance.",
    steps: [
      "Open Games or Play and look for the Free today badge.",
      "Open a game and choose Play free if you are eligible.",
      "An account saves progress. It is not required for the guest trial.",
    ],
    related: ["understanding-the-free-session-allowance", "supported-controls-and-devices"],
  },
  {
    slug: "understanding-the-free-session-allowance",
    title: "Understanding the free-session allowance",
    shortAnswer: "Free play is limited each Kolkata day. The number is set in product configuration, not guessed in the interface.",
    steps: [
      "The daily rotation and allowance reset at midnight Asia/Kolkata.",
      "The live reset time is shown wherever the allowance is explained.",
      "Membership is optional and is never required with a countdown.",
    ],
    related: ["playing-todays-free-games", "membership-benefits"],
  },
  {
    slug: "membership-benefits",
    title: "Membership benefits",
    shortAnswer: "Wave, Surge, and Tide unlock the catalog with the benefits listed on Membership. Prices are ₹399, ₹799, and ₹1499 each month.",
    steps: [
      "Compare plans on the Membership page. Benefits come from one shared list.",
      "Checkout shows the selected plan, amount due, and verified renewal behavior.",
      "This prototype does not take live payment.",
    ],
    related: ["payment-completed-but-access-missing", "canceling-renewal"],
    contextualHref: "/membership",
    contextualLabel: "See memberships",
  },
  {
    slug: "supported-controls-and-devices",
    title: "Supported controls and devices",
    shortAnswer: "Games run in a current desktop or mobile browser. Each game lists keyboard and touch controls before Start.",
    steps: [
      "Open a game detail page for desktop and touch controls.",
      "If a device cannot run a title, the limitation is explained before launch.",
      "Two-player Fold uses alternating turns on narrow touch screens.",
    ],
    related: ["playing-todays-free-games", "saving-progress"],
  },
  {
    slug: "payment-completed-but-access-missing",
    title: "Payment completed but access missing",
    shortAnswer: "Do not pay again while confirmation is pending. Check verified status, then contact support with your payment reference.",
    steps: [
      "Open Billing or the payment return screen and choose Check status.",
      "Activation follows verified payment status, not a URL parameter.",
      "If status stays uncertain, write to support. Do not start a second payment.",
    ],
    related: ["finding-invoices", "membership-benefits"],
    contextualHref: "/billing",
    contextualLabel: "Open billing",
  },
  {
    slug: "finding-invoices",
    title: "Finding invoices",
    shortAnswer: "Paid memberships list invoices on Billing, with date, plan, amount, status, and a PDF download when available.",
    steps: [
      "Sign in and open Billing.",
      "Each record can download a prototype PDF receipt.",
      "Billing email can be edited without changing the login email.",
    ],
    related: ["payment-completed-but-access-missing"],
    contextualHref: "/billing",
    contextualLabel: "Open billing",
  },
  {
    slug: "canceling-renewal",
    title: "Canceling renewal",
    shortAnswer: "If recurring billing is enabled in the live product, cancellation keeps access until the stated date and has no extra fee.",
    steps: [
      "This prototype does not enable automatic renewal.",
      "When a membership period is non-renewing, access expires on the access-end date.",
      "Do not look for a cancellation control that would mislead you.",
    ],
    related: ["membership-benefits", "finding-invoices"],
    contextualHref: "/billing",
    contextualLabel: "Open billing",
  },
  {
    slug: "saving-progress",
    title: "Saving progress",
    shortAnswer: "Signed-in play stores personal bests and continue-playing saves. Guests can still finish a session.",
    steps: [
      "Create an account to keep scores and collection items.",
      "If a score fails to sync, the result stays on screen with a retry path.",
      "Resume appears only when a valid save exists.",
    ],
    related: ["playing-todays-free-games", "taking-a-break"],
  },
  {
    slug: "taking-a-break",
    title: "Taking a break",
    shortAnswer: "A local reminder can ask you to return later. It does not lock the account.",
    steps: [
      "Open Settings and choose a reminder interval.",
      "Reminders never close a game for you.",
      "They stay on this browser unless a future product adds cross-device support.",
    ],
    related: ["deleting-an-account"],
    contextualHref: "/settings",
    contextualLabel: "Open settings",
  },
  {
    slug: "deleting-an-account",
    title: "Deleting an account",
    shortAnswer: "Account deletion is a dedicated confirmation. It does not by itself issue a refund.",
    steps: [
      "Open Settings, then Delete account.",
      "Recent authentication is required.",
      "Membership implications are stated before the final confirmation.",
    ],
    related: ["taking-a-break", "canceling-renewal"],
    contextualHref: "/settings",
    contextualLabel: "Open settings",
  },
];

export const COSMETICS: CosmeticItem[] = [
  { id: "frame-standard", kind: "frame", name: "Studio frame", requirement: "Included with Wave", artwork: "standard" },
  { id: "frame-lantern", kind: "frame", name: "Lantern edge", requirement: "Personal best in Lantern Path", artwork: "lantern" },
  { id: "theme-tide", kind: "theme", name: "Tide night", requirement: "Included with Tide", artwork: "tide" },
  { id: "theme-paper", kind: "theme", name: "Folded dusk", requirement: "Included with Tide", artwork: "paper" },
  { id: "badge-tide", kind: "badge", name: "Tide badge", requirement: "Included with Tide", artwork: "tide-badge" },
  { id: "badge-challenge", kind: "badge", name: "Weekly fold", requirement: "Weekly challenge cosmetic (Surge+)", artwork: "challenge" },
  { id: "trophy-first-flight", kind: "trophy", name: "First flight", requirement: "Finish a Kite Line session", artwork: "kite" },
  { id: "trophy-garden", kind: "trophy", name: "Garden wake", requirement: "Complete a Lantern Path puzzle", artwork: "lantern" },
  { id: "trophy-horizon", kind: "trophy", name: "Horizon tap", requirement: "Score 8 or more in Tide Tap", artwork: "tide" },
];

export const WEEKLY_CHALLENGE: Challenge = {
  id: "week-corridor",
  name: "Narrow corridor",
  gameSlug: "kite-line",
  rules: "Same scoring and continue allowance for every ranked participant. Membership continues do not add ranked attempts.",
  modifier: "The wind corridor is narrower. Stability recovers more slowly.",
  endsAt: "2026-09-14T18:30:00.000Z",
  timezone: "Asia/Kolkata",
  cosmeticReward: "Weekly fold badge",
};

export const SAMPLE_LEADERBOARD = [
  { rank: 1, displayName: "PaperNorth", score: 1840 },
  { rank: 2, displayName: "LanternEast", score: 1712 },
  { rank: 3, displayName: "QuietReed", score: 1640 },
  { rank: 4, displayName: "GoldWind", score: 1518 },
  { rank: 5, displayName: "MistBank", score: 1402 },
];
