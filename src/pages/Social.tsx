import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { WEEKLY_CHALLENGE } from "../data/content";
import { accessForGame } from "../lib/access";
import { challengeCountdown, weeklyBoard } from "../lib/challenges";
import { formatKolkata, nextKolkataMidnight, relativeTime, todaysRotation } from "../lib/time";
import { formatInr } from "../config/product";
import { gameBySlug } from "../data/games";
import { useApp } from "../state/AppState";
import { ChallengeCover } from "../components/ChallengeCover";
import { GameCard } from "../components/GameCard";
import { PageIntro } from "../components/PageIntro";
import { RankedBoard } from "../components/RankedBoard";
import { Button, ButtonLink, EmptyState, Field, Notice, TextInput } from "../components/ui";
import { PlayerAvatar } from "../components/PlayerAvatar";

export function DailyChallengePage() {
  const { entitlement, playsUsed, user, bestFor } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const rotation = todaysRotation();
  const daily = rotation[0];
  const alsoToday = rotation.slice(1);
  const access = daily ? accessForGame(daily, entitlement, playsUsed(daily.slug)) : null;
  const locked = access?.kind === "locked" || access?.kind === "capped";
  const remainingWeekly = challengeCountdown(WEEKLY_CHALLENGE.endsAt, now);
  const resetIn = challengeCountdown(nextKolkataMidnight().toISOString(), now);
  const best = daily ? bestFor(daily.slug) : undefined;
  return (
    <div className="section wrap challenge-page">
      <PageIntro
        eyebrow="Daily challenge"
        title="Today’s featured run"
        description="One always-free session, new at midnight IST. Score for yourself — there is no buy-in, and membership does not purchase extra ranked attempts."
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
              <span className="billing-pill">Always free</span>
              <span className="billing-pill">Resets {resetIn}</span>
            </div>
            <p className="kicker">{daily.genre}</p>
            <h2>{daily.title}</h2>
            <p className="challenge-hero-lede">{daily.fantasy}</p>
            <ol className="challenge-howto">
              {daily.howToPlay.slice(0, 3).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
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
              <ButtonLink to={`/games/${daily.slug}`}>How to play</ButtonLink>
              {!user ? <ButtonLink to="/login?return=/challenges/daily">Sign in to keep a best</ButtonLink> : null}
            </div>
          </div>
          <ChallengeCover
            game={daily}
            kicker="Session"
            title={`About ${daily.sessionMinutes} minutes`}
            meta="Always free today"
          />
        </article>
      ) : (
        <EmptyState title="No daily game is published right now." />
      )}

      <div className="billing-stats">
        <article className="panel">
          <h3>Resets</h3>
          <p>{resetIn}</p>
          <small>Midnight IST · a new always-free title</small>
        </article>
        <article className="panel">
          <h3>Your best</h3>
          <p>{best ? best.score.toLocaleString("en-IN") : "Unplayed"}</p>
          <small>{best ? `${best.stars} stars on this device` : "Play to place a personal best"}</small>
        </article>
        <article className="panel">
          <h3>Scoring</h3>
          <p>Personal best</p>
          <small>Daily runs keep a local best, not a paid rank</small>
        </article>
        <article className="panel">
          <h3>Also this week</h3>
          <p>{WEEKLY_CHALLENGE.name}</p>
          <small>{remainingWeekly} on the ranked board</small>
        </article>
      </div>

      {alsoToday.length ? (
        <section>
          <div className="section-head">
            <h2>Also free today</h2>
            <p className="meta">Two more always-free titles from today’s rotation. The featured run is above.</p>
          </div>
          <div className="grid-2">
            {alsoToday.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
      ) : null}

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
  const { user, store, identityKey, games, enterChallenge } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const youScore = store.challengeScores[identityKey];
  const entered = Boolean(store.challengeEntered[identityKey]);
  const weekly = weeklyBoard(user?.displayName, youScore);
  const youRow = weekly.find((row) => row.isYou);
  const remaining = challengeCountdown(WEEKLY_CHALLENGE.endsAt, now);
  const ended = remaining === "Ended";
  const endsLabel = formatKolkata(new Date(WEEKLY_CHALLENGE.endsAt), { dateStyle: "medium", timeStyle: "short" });
  const game = gameBySlug(WEEKLY_CHALLENGE.gameSlug);
  const ahead = youRow && youRow.rank > 1 ? weekly.find((row) => row.rank === youRow.rank - 1) : undefined;
  const toNext = ahead && youRow ? ahead.score - youRow.score : 0;
  const personal = Object.entries(store.bests)
    .filter(([key]) => key.startsWith(`${identityKey}:`))
    .map(([, value]) => value)
    .sort((a, b) => b.score - a.score);
  const starTotal = personal.reduce((sum, item) => sum + item.stars, 0);
  return (
    <div className="section wrap challenge-page">
      <PageIntro
        eyebrow="Leaderboards"
        title="See how your run stacks up"
        description="A public weekly board for Narrow corridor, plus private bests stored on this device. Score only — membership never buys rank."
      >
        <div className="challenge-tabs">
          <ButtonLink to="/challenges">Weekly</ButtonLink>
          <ButtonLink to="/challenges/daily">Daily</ButtonLink>
          <ButtonLink to="/leaderboards" variant="primary">
            Leaderboards
          </ButtonLink>
        </div>
      </PageIntro>

      <article className="challenge-hero">
        <div>
          <div className="challenge-pills">
            <span className="billing-pill billing-pill-paid">{ended ? "Closed" : "Live board"}</span>
            <span className="billing-pill">Sample names</span>
            <span className="billing-pill">No buy-in</span>
          </div>
          <p className="kicker">Weekly public board</p>
          <h2>{WEEKLY_CHALLENGE.name}</h2>
          <p className="challenge-hero-lede">
            {WEEKLY_CHALLENGE.modifier} Ranked on {game?.title ?? "the featured game"}. Studio names are prototype data until live ranking ships; your device score is real.
          </p>
          <p className="challenge-standing">
            {youRow
              ? `You’re rank ${youRow.rank} with ${youRow.score.toLocaleString("en-IN")}${ahead ? ` · ${toNext.toLocaleString("en-IN")} behind ${ahead.displayName}` : " · leading the board"}.`
              : user
                ? entered
                  ? "You’re entered. Play a ranked run to place a score."
                  : "You’re not on the board yet. Enter and play to place."
                : "Guests may inspect the board. Sign in to record a ranked result."}
          </p>
          <div className="challenge-hero-actions">
            {user ? (
              <>
                {entered ? (
                  <Button disabled>Entered</Button>
                ) : (
                  <Button variant="primary" onClick={enterChallenge} disabled={ended}>
                    Enter weekly challenge
                  </Button>
                )}
                {!ended ? (
                  <ButtonLink to={`/play/${WEEKLY_CHALLENGE.gameSlug}`} variant={entered ? "primary" : "secondary"}>
                    {entered ? "Play ranked run" : `Play ${game?.title ?? "this game"}`}
                  </ButtonLink>
                ) : null}
              </>
            ) : (
              <>
                <ButtonLink to="/login?return=/leaderboards" variant="primary">
                  Sign in to place
                </ButtonLink>
                <ButtonLink to={`/play/${WEEKLY_CHALLENGE.gameSlug}`}>Play {game?.title ?? "the game"}</ButtonLink>
              </>
            )}
            <ButtonLink to="/challenges">Challenge details</ButtonLink>
          </div>
        </div>
        {game ? (
          <ChallengeCover
            game={game}
            kicker={game.genre}
            title={game.title}
            meta={youRow ? `Your best ${youRow.score.toLocaleString("en-IN")}` : "Not placed yet"}
          />
        ) : null}
      </article>

      <div className="billing-stats">
        <article className="panel">
          <h3>Time left</h3>
          <p>{remaining}</p>
          <small>Closes {endsLabel} IST</small>
        </article>
        <article className="panel">
          <h3>Your standing</h3>
          <p>{youRow ? `Rank ${youRow.rank}` : "Unplaced"}</p>
          <small>
            {youRow
              ? ahead
                ? `${toNext.toLocaleString("en-IN")} to next rank`
                : "You’re in first"
              : "Play to place a score"}
          </small>
        </article>
        <article className="panel">
          <h3>On the board</h3>
          <p>{weekly.length}</p>
          <small>{weekly.length === 1 ? "player this week" : "players this week"}</small>
        </article>
        <article className="panel">
          <h3>Reward</h3>
          <p>{WEEKLY_CHALLENGE.cosmeticReward}</p>
          <small>Cosmetic only — not currency</small>
        </article>
      </div>

      <section className="panel challenge-board-card">
        <div className="section-head">
          <div>
            <p className="kicker">Public standings</p>
            <h2>This week’s board</h2>
          </div>
          <p className="meta">Same scoring for everyone. Continues do not buy rank.</p>
        </div>
        <RankedBoard rows={weekly} emptyTitle="No submissions yet." variant="table" />
      </section>

      <section className="panel billing-card">
        <div className="section-head">
          <div>
            <p className="kicker">Private</p>
            <h2>Your game bests</h2>
          </div>
          <p className="meta">
            {personal.length
              ? `${personal.length} ${personal.length === 1 ? "game" : "games"} · ${starTotal} stars on this device`
              : "Stored on this device. Not a paid ranking."}
          </p>
        </div>
        {personal.length === 0 ? (
          <div className="board-empty">
            <EmptyState title="Play a game to place a score on your private board." />
            <div className="challenge-hero-actions">
              <ButtonLink to="/challenges/daily" variant="primary">
                Play today’s challenge
              </ButtonLink>
              <ButtonLink to="/games">Browse games</ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="best-grid">
            {personal.map((item) => {
              const entry = games.find((gameItem) => gameItem.slug === item.slug);
              return (
                <li key={item.slug} className="best-card">
                  <div>
                    <p className="kicker">{entry?.genre ?? "Game"}</p>
                    <Link to={`/games/${item.slug}`}>{entry?.title ?? item.slug}</Link>
                    <p className="meta">
                      {"★".repeat(Math.max(1, item.stars))}
                      {item.metric ? ` · ${item.metric}` : ""}
                      {item.at ? ` · ${relativeTime(item.at)}` : ""}
                    </p>
                  </div>
                  <div className="best-card-end">
                    <b>{item.score.toLocaleString("en-IN")}</b>
                    <ButtonLink to={`/play/${item.slug}`}>Play again</ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function FriendsPage() {
  const { user, profileCard } = useApp();
  const [copied, setCopied] = useState(false);
  const shareUrl = user ? `${window.location.origin}/u/${profileCard.handle}` : "";
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="section wrap challenge-page friends-page">
      <PageIntro
        eyebrow="Friends"
        title="Play with people you know"
        description="Friend search, requests, and compare-stats are next. Claim @username on your profile now so you’re ready when Friends opens."
      >
        <div className="challenge-pills" style={{ marginTop: 22 }}>
          <span className="billing-pill billing-pill-pending">Play soon</span>
          <span className="billing-pill">Handles live now</span>
          <span className="billing-pill">No public follow list</span>
        </div>
      </PageIntro>

      <article className="challenge-hero friends-hero">
        <div>
          <p className="kicker">Your handle</p>
          <h2>{user ? `@${profileCard.handle}` : "Claim @username"}</h2>
          <p className="challenge-hero-lede">
            {user
              ? "This handle is saved on this device. Copy a preview link, or edit it on your profile before Friends launches."
              : "Sign in to claim a handle. Friends will use it for search and requests — not for a public follower graph."}
          </p>
          <div className="friends-search">
            <Field label="Find a friend" hint="Search opens with Friends. Play soon.">
              <TextInput placeholder="Search @handle" disabled />
            </Field>
          </div>
          <div className="challenge-hero-actions">
            {user ? (
              <>
                <ButtonLink to="/profile" variant="primary">
                  Open your profile
                </ButtonLink>
                <Button onClick={() => void copyLink()}>{copied ? "Link copied" : "Copy profile link"}</Button>
              </>
            ) : (
              <>
                <ButtonLink to="/login?return=/friends" variant="primary">
                  Sign in to claim a handle
                </ButtonLink>
                <ButtonLink to="/register?return=/friends">Create an account</ButtonLink>
              </>
            )}
            <Button disabled>Add a friend</Button>
          </div>
        </div>
        <aside className="friends-card">
          {user ? (
            <>
              <PlayerAvatar name={user.displayName} avatarId={user.avatarId} photoUrl={profileCard.avatarDataUrl} size={72} />
              <p className="kicker">Ready for Friends</p>
              <strong>{user.displayName}</strong>
              <p className="profile-handle">@{profileCard.handle}</p>
              <p className="meta">{profileCard.bio || "Add a short bio on your profile."}</p>
            </>
          ) : (
            <>
              <PlayerAvatar name="Guest" size={72} />
              <p className="kicker">Play soon</p>
              <strong>Your arcade card</strong>
              <p className="meta">Sign in to show a handle, avatar, and preview link here.</p>
            </>
          )}
        </aside>
      </article>

      <div className="billing-stats">
        <article className="panel">
          <h3>Friends</h3>
          <p>0</p>
          <small>List opens with Friends</small>
        </article>
        <article className="panel">
          <h3>Requests</h3>
          <p>0</p>
          <small>Nothing pending yet</small>
        </article>
        <article className="panel">
          <h3>Your handle</h3>
          <p>{user ? `@${profileCard.handle}` : "—"}</p>
          <small>{user ? "Claimed on this device" : "Sign in to claim"}</small>
        </article>
        <article className="panel">
          <h3>Status</h3>
          <p>Play soon</p>
          <small>Search and compare are next</small>
        </article>
      </div>

      <section>
        <div className="section-head">
          <h2>What’s coming</h2>
          <p className="meta">These stay preview-only until Friends launches. No follow counts, no paid ranking.</p>
        </div>
        <div className="friends-coming">
          <article className="panel">
            <span className="billing-pill billing-pill-pending">Play soon</span>
            <h3>Find by handle</h3>
            <p>Search @username and send a request to people you already know.</p>
          </article>
          <article className="panel">
            <span className="billing-pill billing-pill-pending">Play soon</span>
            <h3>Requests</h3>
            <p>Accept or ignore incoming invites. Pending stays at zero until the list is live.</p>
          </article>
          <article className="panel">
            <span className="billing-pill billing-pill-pending">Play soon</span>
            <h3>Compare stats</h3>
            <p>Line up stars, streaks, and favorite games side by side. Score only — not a paid rank.</p>
          </article>
          <article className="panel">
            <span className="billing-pill billing-pill-pending">Play soon</span>
            <h3>Play together</h3>
            <p>Invite a friend into a session when rooms and Friends ship together.</p>
          </article>
        </div>
      </section>

      <div className="billing-grid">
        <section className="panel billing-card friends-preview">
          <div className="section-head">
            <div>
              <p className="kicker">Your list</p>
              <h2>Friends</h2>
            </div>
            <span className="billing-pill">0</span>
          </div>
          <ul className="friends-ghost" aria-hidden="true">
            <li>
              <PlayerAvatar name="Paper North" size={40} />
              <span>
                <strong>PaperNorth</strong>
                <em>Compare stars · Play soon</em>
              </span>
            </li>
            <li>
              <PlayerAvatar name="Lantern East" size={40} />
              <span>
                <strong>LanternEast</strong>
                <em>Shared sessions · Play soon</em>
              </span>
            </li>
            <li>
              <PlayerAvatar name="Quiet Reed" size={40} />
              <span>
                <strong>QuietReed</strong>
                <em>Streaks side by side · Play soon</em>
              </span>
            </li>
          </ul>
          <p className="meta">Preview only. Real names appear here after you add friends.</p>
        </section>
        <section className="panel billing-card">
          <div className="section-head">
            <div>
              <p className="kicker">Compare</p>
              <h2>Stats with a friend</h2>
            </div>
          </div>
          <p className="challenge-hero-lede">
            Once Friends is live, you can line up stars, streaks, and a favorite game against someone you know. Nothing here is a wager.
          </p>
          <div className="challenge-hero-actions">
            <Button disabled>Compare with a friend</Button>
            <ButtonLink to="/leaderboards">See the public board</ButtonLink>
          </div>
        </section>
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
