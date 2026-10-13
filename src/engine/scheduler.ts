import type { Content, EventKind, GameEvent, PlayerState } from './types';
import { evaluate } from './conditions';
import { ageOf, parseDate, stageOf } from './time';
import { pickWeighted } from './rng';

/** 연속 방지: 직전 N개 이벤트와 같은 group은 제외 */
const RECENT_GROUP_BLOCK = 2;
const RECENT_WINDOW = 5;

export function isEligible(event: GameEvent, state: PlayerState): boolean {
  if (event.stage) {
    const stages = Array.isArray(event.stage) ? event.stage : [event.stage];
    if (!stages.includes(stageOf(state))) return false;
  }
  if (event.age) {
    const age = ageOf(state);
    if (age < event.age[0] || age > event.age[1]) return false;
  }
  if (event.date) {
    if (state.now < parseDate(event.date[0]) || state.now > parseDate(event.date[1])) return false;
  }
  const lastSeen = state.seen[event.id];
  if (lastSeen !== undefined) {
    if (event.once || event.fixed) return false;
    if (event.cooldown && state.turn - lastSeen < event.cooldown) return false;
  }
  return evaluate(event.when, state);
}

/** 조건이 맞은 고정 이벤트 중 가장 이른 것 */
export function pickFixed(content: Content, state: PlayerState, kinds: EventKind[]): GameEvent | undefined {
  const candidates = [...content.events.values()].filter(
    (e) => e.fixed && kinds.includes(e.kind ?? 'encounter') && isEligible(e, state),
  );
  candidates.sort((a, b) => parseDate(a.date?.[0] ?? '0.01') - parseDate(b.date?.[0] ?? '0.01'));
  return candidates[0];
}

export function pickRandom(content: Content, state: PlayerState, kinds: EventKind[]): GameEvent | undefined {
  const blockedGroups = new Set(
    state.recent
      .slice(-RECENT_GROUP_BLOCK)
      .map((r) => r.group)
      .filter((g): g is string => !!g),
  );
  const window = state.recent.slice(-RECENT_WINDOW);
  const tooGrim = window.length >= 4 && window.filter((r) => r.tone === 'negative').length >= 4;

  const pool = [...content.events.values()].filter(
    (e) =>
      !e.fixed &&
      kinds.includes(e.kind ?? 'encounter') &&
      !(e.group && blockedGroups.has(e.group)) &&
      isEligible(e, state),
  );
  return pickWeighted(state, pool, (e) => (e.weight ?? 10) * (tooGrim && e.tone === 'negative' ? 0.5 : 1));
}

export function markSeen(state: PlayerState, event: GameEvent): void {
  state.seen[event.id] = state.turn;
  state.recent.push({ id: event.id, group: event.group, tone: event.tone });
  if (state.recent.length > RECENT_WINDOW * 2) state.recent.splice(0, state.recent.length - RECENT_WINDOW * 2);
}
