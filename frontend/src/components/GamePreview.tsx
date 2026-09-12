import type { Game } from "../types";

function kind(genre: Game["genre"]) {
  if (genre === "Card & Board") return "board";
  if (genre === "Puzzle") return "puzzle";
  if (genre === "Arcade & Skill" || genre === "Reflex") return "arcade";
  if (genre === "Trivia & Quiz") return "trivia";
  if (genre === "Strategy & Simulation") return "strategy";
  if (genre === "Multiplayer Party" || genre === "Party") return "party";
  if (genre === "Rhythm") return "rhythm";
  return "calm";
}

export function GamePreview({ game }: { game: Game }) {
  const preview = kind(game.genre);
  return (
    <div className={`game-preview preview-${preview}`} aria-hidden="true">
      <div className="preview-stage">
        {preview === "board" ? (
          <>
            <span className="p-card" />
            <span className="p-card" />
            <span className="p-card" />
          </>
        ) : null}
        {preview === "puzzle" ? (
          <div className="p-grid">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : null}
        {preview === "arcade" ? <span className="p-runner" /> : null}
        {preview === "trivia" ? <span className="p-q">?</span> : null}
        {preview === "strategy" ? (
          <div className="p-bars">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {preview === "party" ? (
          <>
            <span className="p-token a" />
            <span className="p-token b" />
          </>
        ) : null}
        {preview === "rhythm" ? <span className="p-ring" /> : null}
        {preview === "calm" ? <span className="p-lantern" /> : null}
      </div>
      <p>{game.howToPlay[0]}</p>
    </div>
  );
}
