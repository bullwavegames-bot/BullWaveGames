export type RecordedAction = { playerId: string; actionId: string; version: number };
const MAX_RECORDED_ACTIONS = 200;

export function priorAction(actions: RecordedAction[] | undefined, playerId: string, actionId: string): RecordedAction | undefined {
  return actions?.find((action) => action.playerId === playerId && action.actionId === actionId);
}

export function rememberAction(actions: RecordedAction[] | undefined, action: RecordedAction): RecordedAction[] {
  const previous = actions ?? [];
  return [...previous.filter((item) => item.playerId !== action.playerId || item.actionId !== action.actionId), action].slice(-MAX_RECORDED_ACTIONS);
}
