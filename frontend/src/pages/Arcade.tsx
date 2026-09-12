import { WEEKLY_CHALLENGE, COSMETICS } from "../data/content";
import { accessForGame, alwaysFreeGames, isMember } from "../lib/access";
import { challengeCountdown, weeklyBoard } from "../lib/challenges";
import { gameBySlug } from "../data/games";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { ChallengeCover } from "../components/ChallengeCover";
import { PlanChip } from "../components/PlanChip";
import { PageIntro } from "../components/PageIntro";
import { RankedBoard } from "../components/RankedBoard";
import { Badge, Button, ButtonLink, EmptyState } from "../components/ui";
import { useEffect, useState } from "react";
import { formatKolkata, todaysRotation } from "../lib/time";
import { formatInr, PRODUCT } from "../config/product";

export function ArcadeHomePage() {
  const { user, entitlement, games, store, identityKey, playsUsed } = useApp();
  const freeSet = alwaysFreeGames(games);
  const member = isMember(entitlement);
  const continueSlugs = Object.keys(store.saves)
    .filter((key) => key.startsWith(identityKey))
    .map((key) => store.saves[key]);
  const achievements = store.achievements[identityKey] ?? [];
  const catalog = games.filter((game) => game.published && !freeSet.some((item) => item.slug === game.slug));
  return (
    <div className="section">
      <div className="wrap home-hero-band">
        <p className="kicker">Arcade</p>
        <h1 className="display">What will you play today?</h1>
        <p className="home-hello">
          Hello {user?.displayName ?? "there"}. <PlanChip entitlement={entitlement} />
        </p>
        {member ? null : (
          <p className="meta">
            Five selected games stay free. Membership unlocks the rest of the studio from {formatInr(399)}.
          </p>
        )}
        <section style={{ marginTop: 32 }}>
          <h2>Always free</h2>
          <div className="grid-3">
            {freeSet.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
        <section style={{ marginTop: 36 }}>
          <h2>Continue playing</h2>
          {continueSlugs.length ? (
            <div className="grid-3">
              {continueSlugs.map((save) => {
                const game = games.find((item) => item.slug === save.slug);
                if (!game) return null;
                const access = accessForGame(game, entitlement, playsUsed(game.slug));
                const locked = access.kind === "locked" || access.kind === "capped";
                return (
                  <article key={save.slug} className="panel">
                    <h3>{game.title}</h3>
                    <p className="meta">{save.label}</p>
                    {locked ? (
                      <ButtonLink to="/membership" variant="primary">
                        Unlock from {formatInr(399)}
                      </ButtonLink>
                    ) : (
                      <ButtonLink to={`/play/${game.slug}`} variant="primary">
                        {save.payload ? "Resume" : "Play again"}
                      </ButtonLink>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Your arcade fills as you play. Start with an always-free game." />
          )}
        </section>
        <section style={{ marginTop: 36 }}>
          <div className="section-head">
            <h2>Studio catalog</h2>
            {member ? null : <ButtonLink to="/membership">Unlock from {formatInr(399)}</ButtonLink>}
          </div>
          <div className="grid-3">
            {catalog.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
        <section className="panel challenge-banner" style={{ marginTop: 36 }}>
          <p className="kicker">Weekly challenge</p>
          <h2>{WEEKLY_CHALLENGE.name}</h2>
          <p>
            {WEEKLY_CHALLENGE.modifier} Reward: {WEEKLY_CHALLENGE.cosmeticReward}. Score only — no buy-in.
          </p>
          <ButtonLink to="/challenges" variant="primary">
            Open challenge
          </ButtonLink>
        </section>
        {achievements.length ? (
          <section style={{ marginTop: 36 }}>
            <h2>Trophies</h2>
            <div className="filters">
              {achievements.map((item) => (
                <span key={item.id} className="chip">
                  {item.title}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function ChallengesPage() {
  const { user, store, identityKey, enterChallenge, entitlement } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const entered = Boolean(store.challengeEntered[identityKey]);
  const youScore = store.challengeScores[identityKey];
  const board = weeklyBoard(user?.displayName, youScore);
  const youRow = board.find((row) => row.isYou);
  const game = gameBySlug(WEEKLY_CHALLENGE.gameSlug);
  const daily = todaysRotation()[0];
  const remaining = challengeCountdown(WEEKLY_CHALLENGE.endsAt, now);
  const ended = remaining === "Ended";
  const endsLabel = formatKolkata(new Date(WEEKLY_CHALLENGE.endsAt), { dateStyle: "medium", timeStyle: "short" });
  const standing = youRow
    ? `Rank ${youRow.rank}`
    : entered
      ? "Entered"
      : user
        ? "Not entered"
        : "Inspecting";
  return (
    <div className="section wrap challenge-page">
      <PageIntro
        eyebrow="Challenges"
        title="A fresh challenge. A new personal best."
        description="One weekly ranked modifier, a daily featured run, and a public board. Score only — membership never buys a ranking advantage."
      >
        <div className="challenge-tabs">
          <ButtonLink to="/challenges" variant="primary">
            Weekly
          </ButtonLink>
          <ButtonLink to="/challenges/daily">Daily</ButtonLink>
          <ButtonLink to="/leaderboards">Leaderboards</ButtonLink>
        </div>
      </PageIntro>

      <article className="challenge-hero">
        <div>
          <div className="challenge-pills">
            <span className="billing-pill billing-pill-paid">{ended ? "Closed" : "Live this week"}</span>
            <span className="billing-pill">Cosmetic reward</span>
            <span className="billing-pill">No buy-in</span>
          </div>
          <p className="kicker">Weekly ranked run</p>
          <h2>{WEEKLY_CHALLENGE.name}</h2>
          <p className="challenge-hero-lede">
            {WEEKLY_CHALLENGE.modifier} Play {game?.title ?? "the featured game"} with the same scoring and continue allowance as everyone else.
          </p>
          <div className="challenge-hero-actions">
            {user ? (
              <>
                {entered ? (
                  <Button disabled>Entered</Button>
                ) : (
                  <Button variant="primary" onClick={enterChallenge} disabled={ended}>
                    Enter challenge
                  </Button>
                )}
                {!ended ? (
                  <ButtonLink to={`/play/${WEEKLY_CHALLENGE.gameSlug}`} variant={entered ? "primary" : "secondary"}>
                    {entered ? "Play ranked run" : `Practice ${game?.title ?? "this game"}`}
                  </ButtonLink>
                ) : null}
              </>
            ) : (
              <>
                <ButtonLink to="/login?return=/challenges" variant="primary">
                  Sign in to record a ranked result
                </ButtonLink>
                <ButtonLink to={`/play/${WEEKLY_CHALLENGE.gameSlug}`}>Play {game?.title ?? "the game"}</ButtonLink>
              </>
            )}
            <ButtonLink to={`/games/${WEEKLY_CHALLENGE.gameSlug}`}>Game details</ButtonLink>
          </div>
        </div>
        {game ? (
          <ChallengeCover
            game={game}
            kicker={game.genre}
            title={game.title}
            meta={`About ${game.sessionMinutes} minutes`}
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
          <p>{standing}</p>
          <small>{typeof youScore === "number" ? `${youScore.toLocaleString("en-IN")} best` : "Play to place a score"}</small>
        </article>
        <article className="panel">
          <h3>Reward</h3>
          <p>{WEEKLY_CHALLENGE.cosmeticReward}</p>
          <small>Cosmetic only — not currency</small>
        </article>
        <article className="panel">
          <h3>Access</h3>
          <p>{isMember(entitlement) ? "Member" : "Guest board"}</p>
          <small>{isMember(entitlement) ? "Same ranked rules as everyone" : "Inspect freely. Sign in to submit."}</small>
        </article>
      </div>

      <div className="billing-grid">
        <section className="panel billing-card">
          <h2>How ranked play works</h2>
          <ul className="challenge-rules">
            <li>
              <strong>Score only</strong>
              <span>No buy-in, no wallet, no paid extra attempts on this board.</span>
            </li>
            <li>
              <strong>Same continues</strong>
              <span>{WEEKLY_CHALLENGE.rules}</span>
            </li>
            <li>
              <strong>Fair modifier</strong>
              <span>{WEEKLY_CHALLENGE.modifier}</span>
            </li>
            <li>
              <strong>Sample names</strong>
              <span>Studio names on the board are prototype data until live ranking ships. Your device score is real.</span>
            </li>
          </ul>
        </section>
        <section className="panel billing-card">
          <h2>Today’s daily run</h2>
          {daily ? (
            <>
              <p className="challenge-hero-lede">{daily.fantasy}</p>
              <p className="meta">
                {daily.title} · {daily.genre} · about {daily.sessionMinutes} min · rotates midnight IST
              </p>
              <div className="challenge-hero-actions">
                <ButtonLink to="/challenges/daily" variant="primary">
                  Open daily challenge
                </ButtonLink>
                <ButtonLink to={`/play/${daily.slug}`}>Play {daily.title}</ButtonLink>
              </div>
            </>
          ) : (
            <EmptyState title="No daily game is published right now." />
          )}
        </section>
      </div>

      <section className="panel challenge-board-card">
        <div className="section-head">
          <div>
            <p className="kicker">Weekly board</p>
            <h2>Leaderboard</h2>
          </div>
          <p className="meta">Prototype names until live ranking. Continues do not buy rank.</p>
        </div>
        <RankedBoard rows={board} emptyTitle="No submissions yet." />
      </section>
    </div>
  );
}

export function CollectionPage() {
  const { owned, equip, store, identityKey } = useApp();
  const [tab, setTab] = useState<"trophy" | "frame" | "theme" | "badge">("trophy");
  const [open, setOpen] = useState<string | null>(null);
  const items = COSMETICS.filter((item) => item.kind === tab);
  const equipped = store.equipped[identityKey];
  return (
    <div className="section wrap">
      <h1 className="display">Make the arcade yours.</h1>
      <div className="filters">
        {(["trophy", "frame", "theme", "badge"] as const).map((item) => (
          <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>
            {item === "trophy" ? "Trophies" : item[0].toUpperCase() + item.slice(1) + "s"}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nothing in this category yet." />
      ) : (
        <div className="grid-2">
          {items.map((item) => {
            const status = equipped?.frameId === item.id || equipped?.themeId === item.id || equipped?.badgeId === item.id
              ? "Equipped"
              : owned.includes(item.id)
                ? "Owned"
                : "Locked";
            return (
              <button key={item.id} className="panel" onClick={() => setOpen(item.id)} style={{ textAlign: "left" }}>
                <h3>{item.name}</h3>
                <Badge>{status}</Badge>
                <p className="meta">{item.requirement}</p>
              </button>
            );
          })}
        </div>
      )}
      {open ? (
        <div className="panel" style={{ marginTop: 16 }}>
          {(() => {
            const item = COSMETICS.find((entry) => entry.id === open);
            if (!item) return null;
            const can = owned.includes(item.id);
            return (
              <>
                <h3>{item.name}</h3>
                <p>{can ? "Preview ready." : item.requirement}</p>
                {can && item.kind !== "trophy" ? (
                  <Button variant="primary" onClick={() => equip(item.id)}>
                    Equip
                  </Button>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
