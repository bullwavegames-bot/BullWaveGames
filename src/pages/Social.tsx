import { Link, useParams } from "react-router-dom";
import { WEEKLY_CHALLENGE } from "../data/content";
import { accessForGame } from "../lib/access";
import { challengeCountdown, weeklyBoard } from "../lib/challenges";
import { formatKolkata, todaysRotation } from "../lib/time";
import { formatInr } from "../config/product";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { GamePreview } from "../components/GamePreview";
import { PageIntro } from "../components/PageIntro";
import { RankedBoard } from "../components/RankedBoard";
import { Button, ButtonLink, EmptyState, Notice } from "../components/ui";

export function DailyChallengePage() {
  const { entitlement, playsUsed, user } = useApp();
  const daily = todaysRotation()[0];
  const rotation = todaysRotation();
  const access = daily ? accessForGame(daily, entitlement, playsUsed(daily.slug)) : null;
  const locked = access?.kind === "locked" || access?.kind === "capped";
  const remaining = challengeCountdown(WEEKLY_CHALLENGE.endsAt);
  return (
    <div className="section wrap challenge-page">
      <PageIntro
        eyebrow="Daily challenge"
        title="Today’s featured run"
        description="A short session that rotates at midnight IST. Score for yourself — there is no buy-in and membership does not purchase extra ranked attempts."
      >
        <div className="challenge-tabs">
          <ButtonLink to="/challenges">Weekly</ButtonLink>
          <ButtonLink to="/challenges/daily" variant="primary">
            Daily
          </ButtonLink>
          <ButtonLink to="/leaderboards">Leaderboards</ButtonLink>
        </div>
      </PageIntro>

      {daily ? (
        <article className="challenge-hero">
          <div>
            <div className="challenge-pills">
              <span className="billing-pill billing-pill-paid">Live today</span>
              <span className="billing-pill">Resets midnight IST</span>
              <span className="billing-pill">No buy-in</span>
            </div>
            <p className="kicker">{daily.genre}</p>
            <h2>{daily.title}</h2>
            <p className="challenge-hero-lede">{daily.fantasy}</p>
            <div className="challenge-hero-actions">
              {locked ? (
                <ButtonLink to="/membership" variant="primary">
                  Unlock from {formatInr(399)}
                </ButtonLink>
              ) : (
                <ButtonLink to={`/play/${daily.slug}`} variant="primary">
                  Play today’s challenge
                </ButtonLink>
              )}
              <ButtonLink to={`/games/${daily.slug}`}>Game details</ButtonLink>
              {!user ? <ButtonLink to="/login?return=/challenges/daily">Sign in to keep a best</ButtonLink> : null}
            </div>
          </div>
          <aside className="challenge-cover">
            <GamePreview game={daily} />
            <img
              src={daily.cover}
              alt={daily.coverAlt}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div>
              <p className="kicker">Session</p>
              <strong>About {daily.sessionMinutes} minutes</strong>
              <p className="meta">{access?.label ?? daily.genre}</p>
            </div>
          </aside>
        </article>
      ) : (
        <EmptyState title="No daily game is published right now." />
      )}

      <div className="billing-stats">
        <article className="panel">
          <h3>Rotation</h3>
          <p>Midnight IST</p>
          <small>A new featured title each day</small>
        </article>
        <article className="panel">
          <h3>Also this week</h3>
          <p>{WEEKLY_CHALLENGE.name}</p>
          <small>{remaining} on the ranked board</small>
        </article>
        <article className="panel">
          <h3>Scoring</h3>
          <p>Personal best</p>
          <small>Daily runs keep a local best, not a paid rank</small>
        </article>
        <article className="panel">
          <h3>Access</h3>
          <p>{locked ? "Members" : "Playable"}</p>
          <small>{locked ? "Five free starts used, or a members title" : "Open this session from the catalog"}</small>
        </article>
      </div>

      <section>
        <div className="section-head">
          <h2>Today’s rotation</h2>
          <p className="meta">Play any of today’s featured games. The first card is the daily challenge.</p>
        </div>
        <div className="grid-3">
          {rotation.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <section className="panel billing-card">
        <p className="kicker">Weekly ranked</p>
        <h2>{WEEKLY_CHALLENGE.name}</h2>
        <p className="challenge-hero-lede">{WEEKLY_CHALLENGE.modifier}</p>
        <p className="meta">
          Ends {formatKolkata(new Date(WEEKLY_CHALLENGE.endsAt), { dateStyle: "medium", timeStyle: "short" })} IST · reward{" "}
          {WEEKLY_CHALLENGE.cosmeticReward}
        </p>
        <div className="challenge-hero-actions">
          <ButtonLink to="/challenges" variant="primary">
            Open weekly challenge
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

export function LeaderboardsPage() {
  const { user, store, identityKey, games } = useApp();
  const you = store.challengeScores[identityKey];
  const weekly = weeklyBoard(user?.displayName, you);
  const youRow = weekly.find((row) => row.isYou);
  const remaining = challengeCountdown(WEEKLY_CHALLENGE.endsAt);
  const personal = Object.entries(store.bests)
    .filter(([key]) => key.startsWith(`${identityKey}:`))
    .map(([, value]) => value)
    .sort((a, b) => b.score - a.score);
  return (
    <div className="section wrap challenge-page">
      <PageIntro
        eyebrow="Leaderboards"
        title="See how your run stacks up"
        description="The weekly board is a public ranked list. Your game bests stay private on this device until live ranking ships."
      >
        <div className="challenge-tabs">
          <ButtonLink to="/challenges">Weekly</ButtonLink>
          <ButtonLink to="/challenges/daily">Daily</ButtonLink>
          <ButtonLink to="/leaderboards" variant="primary">
            Leaderboards
          </ButtonLink>
        </div>
      </PageIntro>

      <div className="billing-stats">
        <article className="panel">
          <h3>Time left</h3>
          <p>{remaining}</p>
          <small>{WEEKLY_CHALLENGE.name}</small>
        </article>
        <article className="panel">
          <h3>Your standing</h3>
          <p>{youRow ? `Rank ${youRow.rank}` : "Unplaced"}</p>
          <small>{typeof you === "number" ? `${you.toLocaleString("en-IN")} best` : "Enter and play to place"}</small>
        </article>
        <article className="panel">
          <h3>Reward</h3>
          <p>{WEEKLY_CHALLENGE.cosmeticReward}</p>
          <small>Cosmetic only — not currency</small>
        </article>
        <article className="panel">
          <h3>Board data</h3>
          <p>Prototype names</p>
          <small>Studio names are sample. Your scores here are real.</small>
        </article>
      </div>

      <section className="panel challenge-board-card">
        <div className="section-head">
          <div>
            <p className="kicker">Public board</p>
            <h2>Weekly challenge</h2>
          </div>
          <div className="challenge-hero-actions">
            <ButtonLink to="/challenges" variant="primary">
              Enter weekly challenge
            </ButtonLink>
            <ButtonLink to="/challenges/daily">Daily challenge</ButtonLink>
          </div>
        </div>
        <RankedBoard rows={weekly} emptyTitle="No submissions yet." />
      </section>

      <section className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Private</p>
            <h2>Your game bests</h2>
          </div>
          <p className="meta">Stored on this device. Not a paid ranking.</p>
        </div>
        {personal.length === 0 ? (
          <EmptyState title="Play a game to place a score on your private board." />
        ) : (
          <ol className="ranked-list personal-bests">
            {personal.map((item) => {
              const game = games.find((entry) => entry.slug === item.slug);
              return (
                <li key={item.slug} className="ranked-row">
                  <span className="ranked-place">★</span>
                  <span className="ranked-name">
                    <Link to={`/games/${item.slug}`}>{game?.title ?? item.slug}</Link>
                  </span>
                  <span className="ranked-gap">{item.stars} stars</span>
                  <span className="ranked-score">{item.score.toLocaleString("en-IN")}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

export function FriendsPage() {
  return (
    <div className="section wrap">
      <p className="kicker">Friends</p>
      <h1 className="display">Play with people you know</h1>
      <div className="panel">
        <p>Friend search, requests, and compare-stats are next. Handles are already on profiles so you can claim @username now.</p>
        <p className="meta">0 friends · 0 pending requests</p>
        <div className="actions">
          <Button disabled>Add a friend</Button>
          <ButtonLink to="/profile">Open your profile</ButtonLink>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Compare stats</h2>
        <p className="meta">Once you have a friend, you can line up stars, streaks, and favorite games side by side.</p>
        <Button disabled>Compare with a friend</Button>
      </div>
    </div>
  );
}

export function PublicProfilePage() {
  const { handle = "" } = useParams();
  const { store, user, profileCard, identityKey } = useApp();
  const match = Object.entries(store.profileCards).find(([, card]) => card.handle === handle.toLowerCase());
  const isYou = profileCard.handle === handle.toLowerCase();
  if (!match && !isYou) {
    return (
      <div className="section wrap">
        <h1 className="display">Profile not found</h1>
        <p>Public profiles are still local to this browser until Friends launches.</p>
        <ButtonLink to="/games">Browse games</ButtonLink>
      </div>
    );
  }
  const card = match?.[1] ?? profileCard;
  const ownerKey = match?.[0] ?? identityKey;
  const trophies = store.achievements[ownerKey] ?? [];
  const plays = Object.values(store.playCounts[ownerKey] ?? {}).reduce((sum, value) => sum + value, 0);
  return (
    <div className="section wrap">
      <p className="kicker">Shared profile</p>
      <h1 className="display">@{card.handle}</h1>
      {card.bio ? <p>{card.bio}</p> : null}
      <p className="meta">
        {plays} games played · {trophies.length} trophies
        {isYou ? " · this is you" : ""}
      </p>
      <Notice>This preview is stored on this device. Live public profiles will follow the Friends release.</Notice>
      {user ? <ButtonLink to="/profile">Open full profile</ButtonLink> : <ButtonLink to="/register">Create your own</ButtonLink>}
    </div>
  );
}
