import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import type { Game } from "../types";
import { accessForGame, canLaunch } from "../lib/access";
import { useApp } from "../state/AppState";
import { Badge } from "./ui";
import { GamePreview } from "./GamePreview";

export function GameCard({ game }: { game: Game }) {
  const reduce = useReducedMotion();
  const { entitlement, playsUsed } = useApp();
  const access = accessForGame(game, entitlement, playsUsed(game.slug));
  const locked = access.kind === "locked" || access.kind === "capped";
  return (
    <Link className={`card game-card ${reduce ? "no-flip" : ""} ${locked ? "is-locked" : ""}`} to={`/games/${game.slug}`}>
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
        {locked ? <div className="lock-veil">{access.kind === "capped" ? "5 plays used" : "Members"}</div> : null}
      </div>
      <div className="body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <strong style={{ color: "var(--white)" }}>{game.title}</strong>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge tone={canLaunch(access) ? "free" : "warn"}>{access.label}</Badge>
          </span>
        </div>
        <div className="meta">
          {game.genre} · {game.sessionMinutes} min
        </div>
        <span className="card-action">
          {locked ? "Unlock from ₹399" : "Play"} <span aria-hidden="true">↗</span>
        </span>
      </div>
    </Link>
  );
}
