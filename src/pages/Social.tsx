import { Link, useParams } from "react-router-dom";
import { SAMPLE_LEADERBOARD, WEEKLY_CHALLENGE } from "../data/content";
import { accessForGame } from "../lib/access";
import { formatKolkata, isFreeToday, todaysRotation } from "../lib/time";
import { formatInr } from "../config/product";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { Button, ButtonLink, EmptyState, Notice } from "../components/ui";

export function DailyChallengePage() {
  const { entitlement, remainingFreeSessions, user } = useApp();
  const daily = todaysRotation()[0];
  const access = daily ? accessForGame(daily, entitlement, remainingFreeSessions, isFreeToday(daily.slug)) : null;
  const locked = access?.kind === "locked" || access?.kind === "capped";
  return (
    <div className="section wrap">
      <p className="kicker">Daily challenge</p>
      <h1 className="display">Today’s featured run</h1>
      <p className="meta">Rotates at midnight IST. Score only — no buy-in.</p>
      {daily ? (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>{daily.title}</h2>
          <p>{daily.fantasy}</p>
          <p className="meta">About {daily.sessionMinutes} minutes · {daily.genre}</p>
          {locked ? (
            <ButtonLink to="/membership" variant="primary">
              Unlock from {formatInr(399)}
            </ButtonLink>
          ) : (
            <ButtonLink to={`/play/${daily.slug}`} variant="primary">
              Play today’s challenge
            </ButtonLink>
          )}
        </div>
      ) : (
        <EmptyState title="No daily game is published right now." />
      )}
      <div className="grid-3" style={{ marginTop: 28 }}>
        {todaysRotation().map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
      <div className="panel" style={{ marginTop: 28 }}>
        <p className="kicker">Also this week</p>
        <h2>{WEEKLY_CHALLENGE.name}</h2>
        <p>{WEEKLY_CHALLENGE.modifier}</p>
        <ButtonLink to="/challenges">Open weekly challenge</ButtonLink>
      </div>
      {!user ? (
        <p className="meta" style={{ marginTop: 16 }}>
          <Link to="/login?return=/challenges/daily">Sign in</Link> to keep a personal best.
        </p>
      ) : null}
    </div>
  );
}

export function LeaderboardsPage() {
  const { user, store, identityKey, games } = useApp();
  const you = store.challengeScores[identityKey];
  const weekly = [
    ...SAMPLE_LEADERBOARD,
    ...(you ? [{ rank: 6, displayName: user?.displayName ?? "You", score: you, isYou: true }] : []),
  ]
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const personal = Object.entries(store.bests)
    .filter(([key]) => key.startsWith(`${identityKey}:`))
    .map(([, value]) => value)
    .sort((a, b) => b.score - a.score);
  return (
    <div className="section wrap">
      <p className="kicker">Leaderboards</p>
      <h1 className="display">See how your run stacks up</h1>
      <Notice>Studio names on the weekly board are sample data until live ranking ships. Your scores on this device are real.</Notice>
      <h2>Weekly challenge</h2>
      <p className="meta">
        {WEEKLY_CHALLENGE.name} · ends {formatKolkata(new Date(WEEKLY_CHALLENGE.endsAt), { dateStyle: "medium" })}
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((row) => (
            <tr key={`${row.rank}-${row.displayName}`} style={"isYou" in row && row.isYou ? { color: "var(--gold-soft)" } : undefined}>
              <td>{row.rank}</td>
              <td>{row.displayName}{"isYou" in row && row.isYou ? " (you)" : ""}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions" style={{ marginTop: 12 }}>
        <ButtonLink to="/challenges">Enter weekly challenge</ButtonLink>
        <ButtonLink to="/challenges/daily">Daily challenge</ButtonLink>
      </div>
      <h2>Your game bests</h2>
      {personal.length === 0 ? (
        <EmptyState title="Play a game to place a score on your private board." />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Best</th>
              <th>Stars</th>
            </tr>
          </thead>
          <tbody>
            {personal.map((item) => (
              <tr key={item.slug}>
                <td>
                  <Link to={`/games/${item.slug}`}>{games.find((game) => game.slug === item.slug)?.title ?? item.slug}</Link>
                </td>
                <td>{item.score}</td>
                <td>{item.stars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
