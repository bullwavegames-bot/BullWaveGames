import { playerInitials, type RankedRow } from "../lib/challenges";
import { EmptyState } from "./ui";

function medalClass(rank: number) {
  if (rank === 1) return "is-gold";
  if (rank === 2) return "is-silver";
  if (rank === 3) return "is-bronze";
  return "";
}

function ordinal(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function gapBehind(rows: RankedRow[], row: RankedRow) {
  if (row.rank <= 1) return "Leading";
  const ahead = rows.find((item) => item.rank === row.rank - 1);
  if (!ahead) return "—";
  return `${(ahead.score - row.score).toLocaleString("en-IN")} behind`;
}

function RankedRowItem({ rows, row }: { rows: RankedRow[]; row: RankedRow }) {
  return (
    <li className={`ranked-row ${row.isYou ? "is-you" : ""} ${medalClass(row.rank)}`}>
      <span className={`ranked-place ${medalClass(row.rank)}`}>{row.rank}</span>
      <span className="ranked-avatar" aria-hidden="true">
        {playerInitials(row.displayName)}
      </span>
      <span className="ranked-name">
        {row.displayName}
        {row.isYou ? <em>You</em> : null}
      </span>
      <span className="ranked-gap">{gapBehind(rows, row)}</span>
      <span className="ranked-score">{row.score.toLocaleString("en-IN")}</span>
    </li>
  );
}

export function RankedBoard({
  rows,
  emptyTitle,
  variant = "podium",
}: {
  rows: RankedRow[];
  emptyTitle: string;
  variant?: "podium" | "table";
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;
  const showPodium = variant === "podium" && rows.length >= 3;
  const podium = showPodium ? ([rows[1], rows[0], rows[2]].filter(Boolean) as RankedRow[]) : [];
  const list = variant === "table" || !showPodium ? rows : rows.slice(3);
  return (
    <div className={`ranked-board ${variant === "table" ? "is-table" : ""}`}>
      {showPodium ? (
        <ol className="ranked-podium" aria-label="Top three">
          {podium.map((row) => (
            <li
              key={`${row.rank}-${row.displayName}`}
              className={`ranked-podium-card ${medalClass(row.rank)} ${row.isYou ? "is-you" : ""} ${row.rank === 1 ? "is-first" : ""}`}
            >
              <span className="ranked-medal">{ordinal(row.rank)}</span>
              <span className="ranked-avatar" aria-hidden="true">
                {playerInitials(row.displayName)}
              </span>
              <strong>
                {row.displayName}
                {row.isYou ? " · you" : ""}
              </strong>
              <b>{row.score.toLocaleString("en-IN")}</b>
            </li>
          ))}
        </ol>
      ) : null}
      {list.length ? (
        <>
          {variant === "table" ? (
            <div className="ranked-head" aria-hidden="true">
              <span>Rank</span>
              <span />
              <span>Player</span>
              <span>Gap</span>
              <span>Score</span>
            </div>
          ) : null}
          <ol className="ranked-list" aria-label={showPodium ? "Remaining standings" : "Standings"}>
            {list.map((row) => (
              <RankedRowItem key={`${row.rank}-${row.displayName}`} rows={rows} row={row} />
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
