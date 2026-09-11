export const MAX_SOCKET_BUFFER_BYTES = 1_000_000;

export function socketIsTooSlow(bufferedAmount: number | undefined, payloadBytes: number): boolean {
  return (bufferedAmount ?? 0) + payloadBytes > MAX_SOCKET_BUFFER_BYTES;
}

export function validActionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
