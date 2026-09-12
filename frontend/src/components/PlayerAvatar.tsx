import { AVATAR_SKINS } from "../lib/avatar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

export function PlayerAvatar({
  name,
  avatarId,
  photoUrl,
  size = 40,
  framed,
}: {
  name: string;
  avatarId?: string;
  photoUrl?: string | null;
  size?: number;
  framed?: boolean;
}) {
  const skin = AVATAR_SKINS[avatarId ?? ""] ?? null;
  return (
    <span
      className={`player-avatar${framed ? " player-avatar-framed" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" />
      ) : skin ? (
        <span className="player-avatar-skin" style={{ background: `${skin.tint}22` }}>
          {skin.glyph}
        </span>
      ) : (
        initials(name)
      )}
    </span>
  );
}
