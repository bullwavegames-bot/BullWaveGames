import { Link } from "react-router-dom";
import type { Game } from "../types";
import { Badge } from "./ui";

export function GameCard({ game }: { game: Game }) {
  return (
    <Link className="card game-card" to={`/games/${game.slug}`}>
      <div className="art">
        <img src={game.cover} alt={game.coverAlt} />
        {game.isNew ? <span className="art-badge"><Badge tone="new">New</Badge></span> : null}
      </div>
      <div className="body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <strong style={{ color: "var(--white)" }}>{game.title}</strong>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge tone="free">Free to play</Badge>
          </span>
        </div>
        <div className="meta">
          {game.genre} · {game.sessionMinutes} min
        </div>
        <span className="card-action">Game details <span aria-hidden="true">↗</span></span>
      </div>
    </Link>
  );
}
