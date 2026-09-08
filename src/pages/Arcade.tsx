import { Link } from "react-router-dom";
import { SAMPLE_LEADERBOARD, WEEKLY_CHALLENGE, COSMETICS } from "../data/content";
import { isFreeToday } from "../lib/time";
import { isMember, membershipChip } from "../lib/access";
import { useApp } from "../state/AppState";
import { GameCard } from "../components/GameCard";
import { Badge, Button, ButtonLink, EmptyState, Field, Notice, TextInput } from "../components/ui";
import { useState } from "react";
import { todaysRotation } from "../lib/time";
import { formatKolkata } from "../lib/time";

export function ArcadeHomePage() {
  const { user, entitlement, games, store, identityKey } = useApp();
  const rotation = todaysRotation();
  const continueSlugs = Object.keys(store.saves)
    .filter((key) => key.startsWith(identityKey))
    .map((key) => store.saves[key]);
  const achievements = store.achievements[identityKey] ?? [];
  return (
    <div className="section">
      <div className="wrap">
        <p className="kicker">Arcade</p>
        <h1 className="display">What will you play today?</h1>
        <p>
          Hello {user?.displayName ?? "there"}. <span className="chip">{membershipChip(entitlement)}</span>
        </p>
        <section style={{ marginTop: 32 }}>
          <h2>Today’s free three</h2>
          <div className="grid-3">
            {rotation.map((game) => (
              <GameCard key={game.slug} game={game} availability="Free today" />
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
                return (
                  <article key={save.slug} className="panel">
                    <h3>{game.title}</h3>
                    <p className="meta">{save.label}</p>
                    <ButtonLink to={`/play/${game.slug}`} variant="primary">
                      {save.payload ? "Resume" : "Play again"}
                    </ButtonLink>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Your arcade fills as you play. Start with today’s three." />
          )}
        </section>
        <section style={{ marginTop: 36 }}>
          <h2>Full studio catalog</h2>
          <div className="grid-3">
            {games.filter((game) => game.published).map((game) => (
              <GameCard
                key={game.slug}
                game={game}
                availability={isFreeToday(game.slug) ? "Free today" : "Members"}
                locked={!isMember(entitlement) && !isFreeToday(game.slug)}
              />
            ))}
          </div>
        </section>
        <section className="panel" style={{ marginTop: 36 }}>
          <p className="kicker">Weekly challenge</p>
          <h2>{WEEKLY_CHALLENGE.name}</h2>
          <p>
            {WEEKLY_CHALLENGE.modifier} Reward: {WEEKLY_CHALLENGE.cosmeticReward}.
          </p>
          <ButtonLink to="/challenges" variant="primary">
            Open challenge
          </ButtonLink>
        </section>
        {achievements.length ? (
          <section style={{ marginTop: 36 }}>
            <h2>Recent achievements</h2>
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

export function ProfilePage() {
  const { user, entitlement, store, identityKey, updateProfile, avatars, games } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [avatar, setAvatar] = useState(user?.avatarId ?? "lantern");
  const bests = Object.values(store.bests).filter((_, index, all) => true);
  const mine = Object.entries(store.bests)
    .filter(([key]) => key.startsWith(identityKey))
    .map(([, value]) => value);
  const stars = mine.reduce((sum, item) => sum + item.stars, 0);
  const trophies = store.achievements[identityKey] ?? [];
  if (!user) return <ButtonLink to="/login">Log in</ButtonLink>;
  return (
    <div className="section wrap">
      <div style={{ textAlign: "center" }}>
        <div className="avatar" style={{ width: 88, height: 88, margin: "0 auto 12px", fontSize: 28 }}>
          {user.displayName.slice(0, 1)}
        </div>
        <h1 className="display">{user.displayName}</h1>
        <span className="chip">{membershipChip(entitlement)}</span>
      </div>
      <div className="grid-2" style={{ marginTop: 28 }}>
        <article className="panel">
          <h3>Games played</h3>
          <p>{mine.length}</p>
        </article>
        <article className="panel">
          <h3>Total stars</h3>
          <p>{stars}</p>
        </article>
        <article className="panel">
          <h3>Current streak</h3>
          <p>{mine.length ? "1 day (prototype local count)" : "—"}</p>
        </article>
        <article className="panel">
          <h3>Trophies</h3>
          <p>{trophies.length ? trophies.map((item) => item.title).join(", ") : "No trophies yet."}</p>
        </article>
      </div>
      <h2>Personal bests</h2>
      {mine.length === 0 ? (
        <EmptyState title="Your arcade fills as you play. Start with today’s three." />
      ) : (
        mine.map((item) => (
          <p key={item.slug}>
            {games.find((game) => game.slug === item.slug)?.title}: {item.score}
          </p>
        ))
      )}
      <Button onClick={() => setEditing(true)}>Edit profile</Button>
      {editing ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <Field label="Display name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="filters">
            {avatars.map((id) => (
              <button key={id} type="button" aria-pressed={avatar === id} onClick={() => setAvatar(id)}>
                {id}
              </button>
            ))}
          </div>
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                const result = updateProfile(name, avatar);
                if (result.ok) setEditing(false);
              }}
            >
              Save
            </Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
