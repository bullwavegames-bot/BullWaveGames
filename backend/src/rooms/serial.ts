const queues = new Map<string, Promise<void>>();

/** Runs mutations for one room in arrival order within this API process. */
export function enqueueRoomAction<T>(roomCode: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(roomCode) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  const settled = next.then(() => undefined, () => undefined);
  queues.set(roomCode, settled);
  void settled.finally(() => {
    if (queues.get(roomCode) === settled) queues.delete(roomCode);
  });
  return next;
}

export function queuedRoomCount(): number {
  return queues.size;
}
