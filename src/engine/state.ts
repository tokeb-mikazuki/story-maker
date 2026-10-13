import { ABILITIES, SINS, VIRTUES } from './types';
import type { Ability, PlayerState, Sin, Virtue } from './types';
import { parseDate } from './time';

export const SP_MIN = -45;
export const SP_MAX = 45;
export const BASE_HP = 10;
/** 가치관 1등급 오르는 데 필요한 경험치 = 다음 등급 × 이 값 */
export const VIRTUE_XP_STEP = 3;

export function createState(seed: number, name = '당신', birth = '964.01'): PlayerState {
  const zero = <K extends string>(keys: readonly K[], value: number) =>
    Object.fromEntries(keys.map((k) => [k, value])) as Record<K, number>;
  const birthIndex = parseDate(birth);
  return {
    seed,
    rngState: seed,
    name,
    birth: birthIndex,
    now: birthIndex,
    hp: BASE_HP,
    hpMaxBonus: 0,
    sp: 0,
    money: 0,
    virtues: zero(VIRTUES, 1),
    virtueXp: zero(VIRTUES, 0),
    abilities: zero(ABILITIES, 0),
    tags: {},
    emotion: { pos: 0, neg: 0 },
    sins: zero(SINS, 0),
    seen: {},
    turn: 0,
    recent: [],
    phase: 'origin',
    log: [],
  };
}

export function hpMax(state: PlayerState): number {
  return Math.max(1, BASE_HP + (state.virtues['용기'] - 1) * 2 + state.hpMaxBonus);
}

/** 공포 피해 계산용 정신 등급 */
export function mentalGrade(state: PlayerState): number {
  return Math.round((state.virtues['신중'] + state.virtues['용기']) / 2);
}

export function clampSp(value: number): number {
  return Math.max(SP_MIN, Math.min(SP_MAX, value));
}

export function hasTag(state: PlayerState, spec: string): boolean {
  const eq = spec.indexOf('=');
  if (eq < 0) return spec in state.tags;
  const key = spec.slice(0, eq);
  return key in state.tags && String(state.tags[key]) === spec.slice(eq + 1);
}

export function tagNumber(state: PlayerState, key: string): number {
  const value = state.tags[key];
  return typeof value === 'number' ? value : 0;
}

/** "키=값"이면 값으로 설정, "키"면 플래그. 같은 키는 덮어쓴다. */
export function setTag(state: PlayerState, spec: string): void {
  const eq = spec.indexOf('=');
  if (eq < 0) {
    state.tags[spec] = true;
    return;
  }
  const raw = spec.slice(eq + 1);
  const num = Number(raw);
  state.tags[spec.slice(0, eq)] = raw !== '' && !Number.isNaN(num) ? num : raw;
}

export function removeTag(state: PlayerState, spec: string): void {
  const eq = spec.indexOf('=');
  const key = eq < 0 ? spec : spec.slice(0, eq);
  if (eq < 0 || hasTag(state, spec)) delete state.tags[key];
}

export function gainVirtueXp(state: PlayerState, virtue: Virtue, amount: number): void {
  state.virtueXp[virtue] += amount;
  while (state.virtues[virtue] < 5 && state.virtueXp[virtue] >= (state.virtues[virtue] + 1) * VIRTUE_XP_STEP) {
    state.virtueXp[virtue] -= (state.virtues[virtue] + 1) * VIRTUE_XP_STEP;
    state.virtues[virtue] += 1;
    state.log.push(`${virtue}이(가) ${state.virtues[virtue]}등급이 되었다.`);
  }
}

export function raiseAbility(state: PlayerState, ability: Ability, amount: number): void {
  state.abilities[ability] = Math.max(0, Math.min(5, state.abilities[ability] + amount));
}

export function topSin(state: PlayerState): Sin {
  return SINS.reduce((best, sin) => (state.sins[sin] > state.sins[best] ? sin : best), SINS[0]);
}

export function topVirtue(state: PlayerState): Virtue {
  return VIRTUES.reduce((best, v) => (state.virtues[v] > state.virtues[best] ? v : best), VIRTUES[0]);
}
