import { Link } from "react-router-dom";
import type { Game } from "../types";
import { Badge } from "./ui";

export function GameCard({
  game,
  availability,
  locked,
}: {
  game: Game;
  availability: "Free today" | "Members";
  locked?: boolean;
}) {
  return (
    <Link className="card game-card" to={`/games/${game.slug}`}>
      <div className="art">
        <img src={game.cover} alt={game.coverAlt} />
        {locked ? (
          <span className="lock" aria-label="Members">
            ⌁
          </span>
        ) : null}
      </div>
      <div className="body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <strong style={{ color: "var(--white)" }}>{game.title}</strong>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {game.isNew ? <Badge tone="new">New</Badge> : null}
            <Badge tone={availability === "Free today" ? "free" : "default"}>{availability}</Badge>
          </span>
        </div>
        <div className="meta">
          {game.genre} · {game.sessionMinutes} min
        </div>
        <span className="meta">Game details</span>
      </div>
    </Link>
  );
}
