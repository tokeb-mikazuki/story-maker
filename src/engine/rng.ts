import type { PlayerState } from './types';

/** mulberry32 — 상태를 PlayerState에 저장해 세이브/재현이 가능하도록 한다. */
export function nextRandom(state: PlayerState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: PlayerState, min: number, max: number): number {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function pickWeighted<T>(state: PlayerState, items: T[], weight: (item: T) => number): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0) return undefined;
  let roll = nextRandom(state) * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

export function shuffle<T>(state: PlayerState, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
