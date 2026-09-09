import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { gameBySlug } from "../data/games";
import { useApp } from "../state/AppState";
import { Badge, Button, ButtonLink, ErrorPanel, Notice } from "../components/ui";
import { GameCard } from "../components/GameCard";

export function GameDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { games, user, bestFor } = useApp();
  const game = games.find((item) => item.slug === slug) ?? gameBySlug(slug);
  const [accessError, setAccessError] = useState(false);
  const [trailerFail] = useState(false);

  if (!game) {
    return (
      <div className="section wrap">
        <ErrorPanel message="This game is not in the catalog." />
        <ButtonLink to="/games">Back to games</ButtonLink>
      </div>
    );
  }

  const launch = () => {
    if (game.maintenance || !game.published || game.unsupportedNote) return;
    navigate(`/play/${game.slug}`);
  };

  const related = games.filter((item) => item.slug !== game.slug && item.genre === game.genre).slice(0, 3);

  return (
    <div className="section">
      <div className="wrap split game-detail-intro">
        <div className="card" style={{ overflow: "hidden" }}>
          {trailerFail ? (
            <div className="empty">Trailer unavailable. Cover remains below.</div>
          ) : (
            <img src={game.cover} alt={game.coverAlt} />
          )}
        </div>
        <div>
          <p className="kicker">{game.genre}</p>
          <h1 className="display">{game.title}</h1>
          <p className="meta">
            {game.sessionMinutes} min session · Free to play
          </p>
          {game.isNew ? <Badge tone="new">New</Badge> : null}
          <p>{game.description}</p>
          {game.maintenance ? <Badge tone="warn">Maintenance</Badge> : null}
          <div className="actions">
            {!game.maintenance && !game.unsupportedNote ? <Button variant="primary" onClick={launch}>Play free</Button> : null}
            {game.unsupportedNote ? <p>{game.unsupportedNote}</p> : null}
            {accessError ? <ErrorPanel message="We couldn’t confirm access. Try again." onRetry={() => setAccessError(false)} /> : null}
          </div>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 36 }}>
        <h2>How to play</h2>
        <ul>
          {game.howToPlay.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="grid-2">
          <div className="panel">
            <h3>Keyboard</h3>
            {game.controls.desktop.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <div className="panel">
            <h3>Touch</h3>
            {game.controls.touch.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
        {user ? (
          <div className="panel" style={{ marginTop: 18 }}>
            <h3>Personal best</h3>
            {bestFor(game.slug) ? (
              <p>
                {bestFor(game.slug)?.score} · {bestFor(game.slug)?.stars} stars
              </p>
            ) : (
              <p className="meta">No history yet. Play to write a first mark.</p>
            )}
          </div>
        ) : (
          <Notice>Sign in to keep personal bests. Guests can play every published game.</Notice>
        )}
        <h2 style={{ marginTop: 28 }}>Related games</h2>
        <div className="grid-3">
          {related.map((item) => (
            <GameCard key={item.slug} game={item} />
          ))}
        </div>
      </div>
      <div className="wrap meta" style={{ marginTop: 24 }}>
        <Link to="/games">Back to catalog</Link>
      </div>
    </div>
  );
}
