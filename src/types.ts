export type PlanId = "wave" | "surge" | "tide";
export type Genre = "Puzzle" | "Reflex" | "Party" | "Calm" | "Rhythm" | "Card & Board" | "Arcade & Skill" | "Trivia & Quiz" | "Strategy & Simulation" | "Multiplayer Party";
export type Availability = "free-today" | "members";
export type PublicationStatus = "draft" | "published" | "maintenance";
export type Role = "player" | "admin";
export type MembershipStatus =
  | "none"
  | "pending"
  | "active"
  | "active_until"
  | "expired";
export type PaymentStatus =
  | "creating"
  | "pending"
  | "succeeded"
  | "declined"
  | "canceled"
  | "expired"
  | "uncertain";
export type CosmeticKind = "frame" | "theme" | "badge" | "trophy";
export type CosmeticStatus = "locked" | "owned" | "equipped";

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPriceInr: number;
  benefits: string[];
}

export interface GameControls {
  desktop: string[];
  touch: string[];
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  genre: Genre;
  sessionMinutes: number;
  fantasy: string;
  description: string;
  howToPlay: string[];
  cover: string;
  coverAlt: string;
  previewAlt: string;
  controls: GameControls;
  memberAccess: boolean;
  rotationEligible: boolean;
  published: boolean;
  maintenance: boolean;
  isNew?: boolean;
  unsupportedNote?: string;
}

export interface Story {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  readingMinutes: number;
  body: string[];
  relatedGameSlug?: string;
  featured?: boolean;
  dateLabel: string;
  authorLabel: string;
  prototypeNote: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  shortAnswer: string;
  steps: string[];
  related: string[];
  contextualHref?: string;
  contextualLabel?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  billingEmail: string;
  displayName: string;
  avatarId: string;
  emailVerified: boolean;
  role: Role;
  createdAt: string;
  onboardingComplete: boolean;
}

export interface Entitlement {
  planId: PlanId | null;
  status: MembershipStatus;
  accessEndDate: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  source: "none" | "payment" | "admin-grant";
  orderId: string | null;
}

export interface Invoice {
  id: string;
  date: string;
  planId: PlanId;
  amountInr: number;
  status: "paid" | "failed" | "pending";
  orderId: string;
}

export interface PaymentOrder {
  id: string;
  planId: PlanId;
  amountInr: number;
  status: PaymentStatus;
  createdAt: string;
  userId: string;
  activated: boolean;
  reference: string;
  safeReason?: string;
}

export interface GameSave {
  slug: string;
  updatedAt: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface PersonalBest {
  slug: string;
  score: number;
  stars: number;
  metric?: string;
  at: string;
}

export interface Achievement {
  id: string;
  title: string;
  earnedAt: string;
}

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  name: string;
  requirement: string;
  artwork: string;
}

export interface Challenge {
  id: string;
  name: string;
  gameSlug: string;
  rules: string;
  modifier: string;
  endsAt: string;
  timezone: string;
  cosmeticReward: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  isYou?: boolean;
}

export interface SessionDay {
  dateKey: string;
  used: number;
  guestKey: string;
}

export type ReturnTo =
  | "/play"
  | "/membership"
  | "/membership/checkout?plan=wave"
  | "/membership/checkout?plan=surge"
  | "/membership/checkout?plan=tide"
  | `/play/${string}`
  | `/games/${string}`;
