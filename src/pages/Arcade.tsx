import { SAMPLE_LEADERBOARD, WEEKLY_CHALLENGE, COSMETICS } from "../data/content";
import { accessForGame, alwaysFreeGames, isMember } from "../lib/access";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { PlanChip } from "../components/PlanChip";
import { Badge, Button, ButtonLink, EmptyState, Notice } from "../components/ui";
import { useState } from "react";
import { formatKolkata } from "../lib/time";
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
            Eight games stay free. Other titles include {PRODUCT.prototype.freePlaysPerGame} free plays, then unlock the studio from {formatInr(399)}.
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
  const entered = store.challengeEntered[identityKey];
  const you = store.challengeScores[identityKey];
  const board: { rank: number; displayName: string; score: number; isYou?: boolean }[] = [
    ...SAMPLE_LEADERBOARD,
    ...(you ? [{ rank: 6, displayName: user?.displayName ?? "You", score: you, isYou: true }] : []),
  ].sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return (
    <div className="section wrap">
      <p className="kicker">Challenges</p>
      <h1 className="display">A fresh challenge. A new personal best.</h1>
      <div className="actions" style={{ marginBottom: 16 }}>
        <ButtonLink to="/challenges/daily">Daily Challenge</ButtonLink>
        <ButtonLink to="/leaderboards">Leaderboards</ButtonLink>
      </div>
      <div className="panel">
        <h2>{WEEKLY_CHALLENGE.name}</h2>
        <p>Game: {WEEKLY_CHALLENGE.gameSlug}</p>
        <p>{WEEKLY_CHALLENGE.rules}</p>
        <p>{WEEKLY_CHALLENGE.modifier}</p>
        <p className="meta">
          Ends {formatKolkata(new Date(WEEKLY_CHALLENGE.endsAt), { dateStyle: "medium", timeStyle: "short" })} {WEEKLY_CHALLENGE.timezone}
        </p>
        <p>Reward: {WEEKLY_CHALLENGE.cosmeticReward}</p>
        {user ? (
          <Button variant="primary" onClick={enterChallenge}>
            {entered ? "Entered" : "Enter challenge"}
          </Button>
        ) : (
          <ButtonLink to="/login?return=/challenges" variant="primary">
            Sign in to record a ranked result
          </ButtonLink>
        )}
        <Notice>Membership continues do not create a paid ranking advantage. Prototype leaderboard names are sample data.</Notice>
      </div>
      <h2>Leaderboard</h2>
      {board.length === 0 ? (
        <EmptyState title="No submissions yet." />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.displayName} style={row.isYou ? { color: "var(--gold-soft)" } : undefined}>
                <td>{row.rank}</td>
                <td>{row.displayName}</td>
                <td>{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isMember(entitlement) ? null : <p className="meta">Guests may inspect the board.</p>}
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
