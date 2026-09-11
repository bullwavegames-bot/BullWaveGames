export function nextVersion(currentVersion: number, expectedVersion: number): number {
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || expectedVersion !== currentVersion) {
    throw new Error("Room version changed; retry the action.");
  }
  return currentVersion + 1;
}
