import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { gameBySlug } from "../data/games";
import { accessForGame, canLaunch, checkoutPath } from "../lib/access";
import { isFreeToday, resetLabel } from "../lib/time";
import { useApp } from "../state/AppState";
import { Badge, Button, ButtonLink, Dialog, ErrorPanel, Notice } from "../components/ui";
import { GameCard } from "../components/GameCard";
import { PRODUCT } from "../config/product";

export function GameDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { games, user, entitlement, freeRemaining, bestFor, setSelectedPlan } = useApp();
  const game = games.find((item) => item.slug === slug) ?? gameBySlug(slug);
  const [accessError, setAccessError] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [trailerFail] = useState(false);
  const access = useMemo(
    () => (game ? accessForGame(game, entitlement, freeRemaining) : null),
    [game, entitlement, freeRemaining],
  );

  if (!game) {
    return (
      <div className="section wrap">
        <ErrorPanel message="This game is not in the catalog." />
        <ButtonLink to="/games">Back to games</ButtonLink>
      </div>
    );
  }

  const launch = () => {
    if (!access) return;
    if (access.kind === "unlock") {
      setUnlockOpen(true);
      return;
    }
    if (access.kind === "allowance") {
      navigate("/play/" + game.slug);
      return;
    }
    if (canLaunch(access)) navigate(`/play/${game.slug}`);
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
            {game.sessionMinutes} min session · {isFreeToday(game.slug) ? "Free today" : "Members"}
          </p>
          {game.isNew ? <Badge tone="new">New</Badge> : null}
          <p>{game.description}</p>
          {game.maintenance ? <Badge tone="warn">Maintenance</Badge> : null}
          <div className="actions">
            {access?.kind === "play-free" ? (
              <Button variant="primary" onClick={launch}>
                Play free
              </Button>
            ) : null}
            {access?.kind === "play" ? (
              <Button variant="primary" onClick={launch}>
                Play
              </Button>
            ) : null}
            {access?.kind === "unlock" ? (
              <Button variant="primary" onClick={launch}>
                Unlock with membership
              </Button>
            ) : null}
            {access?.kind === "allowance" ? (
              <p>
                Today’s free allowance is used. It resets {resetLabel()}. Membership starts at ₹399 per month.
              </p>
            ) : null}
            {access?.kind === "unsupported" ? <p>{game.unsupportedNote}</p> : null}
            {accessError ? <ErrorPanel message="We couldn’t confirm access. Try again." onRetry={() => setAccessError(false)} /> : null}
          </div>
          {access?.kind === "allowance" ? (
            <ButtonLink to="/membership" variant="primary">
              See memberships
            </ButtonLink>
          ) : null}
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
          <Notice>Sign in to keep personal bests. Guests can still play eligible free games.</Notice>
        )}
        <h2 style={{ marginTop: 28 }}>Related games</h2>
        <div className="grid-3">
          {related.map((item) => (
            <GameCard key={item.slug} game={item} availability={isFreeToday(item.slug) ? "Free today" : "Members"} locked={!isFreeToday(item.slug)} />
          ))}
        </div>
      </div>
      {unlockOpen ? (
        <Dialog title="Unlock the studio" onClose={() => setUnlockOpen(false)}>
          <p>
            {game.title} is in the member catalog. Wave starts at ₹399 a month. Free games remain available when the
            daily rotation includes them.
          </p>
          <p className="meta">{PRODUCT.prototype.dataLabel}. Numeric allowances are configurable.</p>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                setSelectedPlan("wave");
                navigate(user ? checkoutPath("wave") : `/register?plan=wave&return=${encodeURIComponent(checkoutPath("wave"))}`);
              }}
            >
              See memberships
            </Button>
            <Button onClick={() => setUnlockOpen(false)}>Not now</Button>
          </div>
        </Dialog>
      ) : null}
      <div className="wrap meta" style={{ marginTop: 24 }}>
        <Link to="/games">Back to catalog</Link>
      </div>
    </div>
  );
}
