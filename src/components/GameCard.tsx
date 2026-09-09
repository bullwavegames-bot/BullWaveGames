import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import type { Game } from "../types";
import { Badge } from "./ui";
import { GamePreview } from "./GamePreview";

export function GameCard({ game }: { game: Game }) {
  const reduce = useReducedMotion();
  return (
    <Link className={`card game-card ${reduce ? "no-flip" : ""}`} to={`/games/${game.slug}`}>
      <div className="art">
        <div className="art-flip">
          <div className="art-face art-front">
            <img src={game.cover} alt={game.coverAlt} />
          </div>
          <div className="art-face art-back">
            <GamePreview game={game} />
          </div>
        </div>
        {game.isNew ? (
          <span className="art-badge">
            <Badge tone="new">New</Badge>
          </span>
        ) : null}
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
        <span className="card-action">
          Game details <span aria-hidden="true">↗</span>
        </span>
      </div>
    </Link>
  );
}
