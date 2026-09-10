import type { Game } from "../types";
import { GamePreview } from "./GamePreview";

export function ChallengeCover({
  game,
  kicker,
  title,
  meta,
}: {
  game: Game;
  kicker: string;
  title: string;
  meta: string;
}) {
  const usePhoto = Boolean(game.cover) && !game.cover.startsWith("data:");
  return (
    <aside className="challenge-cover">
      <GamePreview game={game} />
      {usePhoto ? (
        <img
          src={game.cover}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div>
        <p className="kicker">{kicker}</p>
        <strong>{title}</strong>
        <p className="meta">{meta}</p>
      </div>
    </aside>
  );
}
