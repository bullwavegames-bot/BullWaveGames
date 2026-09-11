export function deletedIdentity(userId: string) {
  const email = `deleted+${userId}@invalid.local`;
  return { email, displayName: "Deleted player", avatarId: "lantern" };
}
