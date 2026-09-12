import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COSMETICS } from "../data/content";
import { AVATAR_SKINS, compressAvatar, playerRank } from "../lib/avatar";
import { isMember, membershipChip } from "../lib/access";
import { consecutiveStreak, formatKolkata, relativeTime } from "../lib/time";
import { planById } from "../config/product";
import { useApp } from "../state/AppState";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { PlanChip } from "../components/PlanChip";
import { Button, ButtonLink, EmptyState, Field, TextInput } from "../components/ui";

export function ProfilePage() {
  const { user, entitlement, store, identityKey, updateProfile, saveProfileCard, profileCard, avatars, games } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [avatar, setAvatar] = useState(user?.avatarId ?? "lantern");
  const [handle, setHandle] = useState(profileCard.handle);
  const [bio, setBio] = useState(profileCard.bio);
  const [photo, setPhoto] = useState(profileCard.avatarDataUrl);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return <ButtonLink to="/login">Log in</ButtonLink>;

  const mine = Object.entries(store.bests)
    .filter(([key]) => key.startsWith(`${identityKey}:`))
    .map(([, value]) => value);
  const stars = mine.reduce((sum, item) => sum + item.stars, 0);
  const trophies = store.achievements[identityKey] ?? [];
  const counts = store.playCounts[identityKey] ?? {};
  const plays = Object.values(counts).reduce((sum, value) => sum + value, 0) || mine.length;
  const streak = consecutiveStreak([
    ...mine.map((item) => item.at),
    ...(store.activity[identityKey] ?? []).map((item) => item.at),
  ]);
  const rank = playerRank(plays, stars);
  const favoriteSlug =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    [...mine].sort((a, b) => b.stars - a.stars || b.score - a.score)[0]?.slug ??
    null;
  const favorite = games.find((game) => game.slug === favoriteSlug);
  const gallery = COSMETICS.filter((item) => item.kind === "trophy" || item.kind === "badge");
  const activity =
    store.activity[identityKey]?.length
      ? store.activity[identityKey]
      : mine.map((item) => ({
          id: item.slug,
          at: item.at,
          kind: "play" as const,
          text: `Personal best in ${games.find((game) => game.slug === item.slug)?.title ?? item.slug}`,
          href: `/games/${item.slug}`,
        }));
  const member = isMember(entitlement);
  const planName = member && entitlement.planId ? planById(entitlement.planId).name : membershipChip(entitlement);
  const renewal = entitlement.nextPaymentDate ?? entitlement.accessEndDate;
  const shareUrl = `${window.location.origin}/u/${profileCard.handle}`;
  const equipped = store.equipped[identityKey];

  const openEdit = () => {
    setName(user.displayName);
    setAvatar(user.avatarId);
    setHandle(profileCard.handle);
    setBio(profileCard.bio);
    setPhoto(profileCard.avatarDataUrl);
    setFormError("");
    setEditing(true);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setFormError("Could not copy the link from this browser.");
    }
  };

  return (
    <div className="section wrap profile-page">
      <header className="profile-hero">
        <PlayerAvatar
          name={user.displayName}
          avatarId={user.avatarId}
          photoUrl={profileCard.avatarDataUrl}
          size={96}
          framed={Boolean(equipped?.frameId)}
        />
        <div className="profile-hero-copy">
          <div className="profile-hero-top">
            <div>
              <h1 className="display">{user.displayName}</h1>
              <p className="profile-handle">@{profileCard.handle}</p>
            </div>
            <div className="profile-hero-plan">
              <PlanChip entitlement={entitlement} />
              {member ? (
                <ButtonLink to="/billing">Manage</ButtonLink>
              ) : (
                <ButtonLink to="/membership" variant="primary">
                  Subscribe
                </ButtonLink>
              )}
            </div>
          </div>
          {profileCard.bio ? <p className="profile-bio">{profileCard.bio}</p> : <p className="meta">No status yet — add a short line when you edit your profile.</p>}
          <p className="meta">
            Member since {formatKolkata(new Date(user.createdAt), { dateStyle: "medium" })} · {rank.title} rank · Level {rank.level}
          </p>
        </div>
      </header>

      <div className="profile-stats">
        <article className="panel">
          <h3>Games played</h3>
          <p>{plays}</p>
        </article>
        <article className="panel">
          <h3>Total stars</h3>
          <p>{stars}</p>
        </article>
        <article className="panel">
          <h3>Streak</h3>
          <p>{streak ? `${streak} day${streak === 1 ? "" : "s"}` : "—"}</p>
        </article>
        <article className="panel">
          <h3>Trophies</h3>
          <p>{trophies.length}</p>
        </article>
      </div>

      <section className="profile-grid-2">
        <article className="panel">
          <h2>Level & rank</h2>
          <p className="profile-rank-line">
            Level {rank.level} · {rank.title}
          </p>
          <div className="profile-xp" role="img" aria-label={`${rank.xp} of ${rank.next} rank points`}>
            <span style={{ width: `${Math.min(100, (rank.xp / rank.next) * 100)}%` }} />
          </div>
          <p className="meta">{rank.xp} / {rank.next} points from plays and stars.</p>
        </article>
        <article className="panel">
          <h2>Most played</h2>
          {favorite ? (
            <>
              <p>{favorite.title}</p>
              <p className="meta">{counts[favorite.slug] ? `${counts[favorite.slug]} sessions on this device` : "From your personal bests"}</p>
              <ButtonLink to={`/games/${favorite.slug}`}>Open game</ButtonLink>
            </>
          ) : (
            <EmptyState title="Play a session and your favorite will appear here." />
          )}
        </article>
      </section>

      <section>
        <h2>Achievement gallery</h2>
        <div className="achievement-grid">
          {gallery.map((item) => {
            const earned = trophies.some((trophy) => trophy.id === item.id) || (store.ownedCosmetics[identityKey] ?? []).includes(item.id);
            return (
              <article key={item.id} className={`achievement-tile${earned ? "" : " is-locked"}`}>
                <span className="achievement-mark">{item.kind === "trophy" ? "🏆" : "✦"}</span>
                <h3>{item.name}</h3>
                <p>{earned ? "Earned" : item.requirement}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Recent activity</h2>
        {activity.length === 0 ? (
          <EmptyState title="Your arcade fills as you play. Start with an always-free game." />
        ) : (
          <ol className="activity-feed">
            {activity.slice(0, 12).map((item) => (
              <li key={item.id}>
                <span className={`activity-kind activity-kind-${item.kind}`} />
                <div>
                  {item.href ? <Link to={item.href}>{item.text}</Link> : <p>{item.text}</p>}
                  <p className="meta">{relativeTime(item.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>Personal bests</h2>
        {mine.length === 0 ? (
          <EmptyState title="Your arcade fills as you play. Start with an always-free game." />
        ) : (
          <div className="profile-bests">
            {mine.map((item) => (
              <Link key={item.slug} className="panel profile-best" to={`/games/${item.slug}`}>
                <h3>{games.find((game) => game.slug === item.slug)?.title ?? item.slug}</h3>
                <p>
                  {item.score}
                  {item.metric ? ` ${item.metric}` : ""} · {item.stars} star{item.stars === 1 ? "" : "s"}
                </p>
                <p className="meta">{relativeTime(item.at)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="profile-grid-2">
        <article className="panel">
          <h2>Membership</h2>
          {member ? (
            <>
              <p>{planName} plan</p>
              <p className="meta">
                {entitlement.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                {renewal ? formatKolkata(new Date(renewal), { dateStyle: "medium" }) : "with your next billing cycle"}
              </p>
              <div className="actions">
                <ButtonLink to="/billing">Manage billing</ButtonLink>
                <ButtonLink to="/collection">Loadout</ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p>Free play — eight always-free games plus five plays on other titles.</p>
              <ButtonLink to="/membership" variant="primary">
                Subscribe from ₹399
              </ButtonLink>
            </>
          )}
        </article>
        <article className="panel">
          <h2>Friends</h2>
          <p>0 friends · mutuals coming with the Friends list</p>
          <p className="meta">Compare stats and shareable public profiles ship with that drop. You can still copy a preview link now.</p>
          <div className="actions">
            <ButtonLink to="/friends">Open Friends</ButtonLink>
            <Button onClick={() => void share()}>{copied ? "Link copied" : "Copy profile link"}</Button>
          </div>
        </article>
      </section>

      <div className="profile-actions">
        <Button variant="primary" onClick={openEdit}>
          Edit profile
        </Button>
        <ButtonLink to="/settings#account">Account settings</ButtonLink>
        <ButtonLink to="/settings#privacy">Privacy</ButtonLink>
      </div>

      {editing ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>Identity</h2>
          <div className="profile-edit-avatar">
            <PlayerAvatar name={name || user.displayName} avatarId={avatar} photoUrl={photo} size={72} />
            <div>
              <Button onClick={() => fileRef.current?.click()}>Upload photo</Button>
              {photo ? (
                <Button
                  onClick={() => {
                    setPhoto(null);
                  }}
                >
                  Use character skin
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void compressAvatar(file)
                    .then((data) => {
                      setPhoto(data);
                      setFormError("");
                    })
                    .catch((cause: Error) => setFormError(cause.message));
                }}
              />
            </div>
          </div>
          <p className="meta">Or pick a studio skin — it shows when no photo is set.</p>
          <div className="filters">
            {avatars.map((id) => (
              <button key={id} type="button" aria-pressed={avatar === id} onClick={() => setAvatar(id)}>
                {AVATAR_SKINS[id]?.glyph ?? "•"} {AVATAR_SKINS[id]?.label ?? id}
              </button>
            ))}
          </div>
          <Field label="Display name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Username">
            <TextInput value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="unique handle" />
          </Field>
          <Field label="Status">
            <TextInput value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short line, up to 140 characters" />
          </Field>
          {formError ? <p className="error">{formError}</p> : null}
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => {
                void updateProfile(name, avatar).then((result) => {
                  if (!result.ok) {
                    setFormError(result.error);
                    return;
                  }
                  const saved = saveProfileCard({ handle, bio, avatarDataUrl: photo });
                  if (!saved.ok) {
                    setFormError(saved.error);
                    return;
                  }
                  setEditing(false);
                });
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
