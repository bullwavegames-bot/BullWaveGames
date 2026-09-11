export type TimedRoom = { deadline?: unknown };

export function deadlineForRoom(room: TimedRoom): number | null {
  return typeof room.deadline === "number" && Number.isFinite(room.deadline) && room.deadline > 0
    ? room.deadline
    : null;
}

export function isRoomDue(room: TimedRoom, now = Date.now()): boolean {
  const deadline = deadlineForRoom(room);
  return deadline !== null && deadline <= now;
}
