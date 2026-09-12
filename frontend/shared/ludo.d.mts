export const TRACK: number;
export const HOME: number;
export type LudoState = {
  tokens: number[][];
  turn: number;
  die: number;
  winner: number | null;
  message: string;
};
export function createLudo(players?: number): LudoState;
export function legalTokens(state: LudoState): number[];
export function rollLudo(state: LudoState, die: number): LudoState;
export function moveLudo(state: LudoState, index: number): LudoState;
