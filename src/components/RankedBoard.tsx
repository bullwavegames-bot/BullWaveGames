import { playerInitials, type RankedRow } from "../lib/challenges";
import { EmptyState } from "./ui";

function medalClass(rank: number) {
  if (rank === 1) return "is-gold";
  if (rank === 2) return "is-silver";
  if (rank === 3) return "is-bronze";
  return "";
}

function gapBehind(rows: RankedRow[], row: RankedRow) {
  if (row.rank <= 1) return "Leading";
  const ahead = rows.find((item) => item.rank === row.rank - 1);
  if (!ahead) return "—";
  return `${ahead.score - row.score} behind`;
}

export function RankedBoard({ rows, emptyTitle }: { rows: RankedRow[]; emptyTitle: string }) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;
  const showPodium = rows.length >= 3;
  const podium = showPodium ? ([rows[1], rows[0], rows[2]].filter(Boolean) as RankedRow[]) : [];
  const list = showPodium ? rows.slice(3) : rows;
  return (
    <div className="ranked-board">
      {showPodium ? (
        <ol className="ranked-podium" aria-label="Top three">
          {podium.map((row) => (
            <li
              key={`${row.rank}-${row.displayName}`}
              className={`ranked-podium-card ${medalClass(row.rank)} ${row.isYou ? "is-you" : ""} ${row.rank === 1 ? "is-first" : ""}`}
            >
              <span className="ranked-medal">{row.rank === 1 ? "1st" : row.rank === 2 ? "2nd" : "3rd"}</span>
              <span className="ranked-avatar" aria-hidden="true">
                {playerInitials(row.displayName)}
              </span>
              <strong>{row.displayName}{row.isYou ? " · you" : ""}</strong>
              <b>{row.score.toLocaleString("en-IN")}</b>
            </li>
          ))}
        </ol>
      ) : null}
      {list.length ? (
        <ol className="ranked-list" aria-label={showPodium ? "Remaining standings" : "Standings"}>
          {list.map((row) => (
            <li key={`${row.rank}-${row.displayName}`} className={`ranked-row ${row.isYou ? "is-you" : ""}`}>
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
          ))}
        </ol>
      ) : null}
    </div>
  );
}
