import { SAMPLE_LEADERBOARD } from "../data/content";

export type RankedRow = {
  rank: number;
  displayName: string;
  score: number;
  isYou?: boolean;
};

export function playerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

export function challengeCountdown(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export function weeklyBoard(displayName: string | undefined, score: number | undefined): RankedRow[] {
  return [
    ...SAMPLE_LEADERBOARD,
    ...(typeof score === "number" ? [{ rank: 99, displayName: displayName ?? "You", score, isYou: true }] : []),
  ]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
