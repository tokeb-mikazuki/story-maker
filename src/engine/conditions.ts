import type { Ability, Cond, PlayerState, Range, Virtue } from './types';
import { ageOf, parseDate, stageOf } from './time';
import { hasTag, tagNumber, topSin } from './state';

function inRange(value: number, range: Range): boolean {
  if (range.gte !== undefined && value < range.gte) return false;
  if (range.lte !== undefined && value > range.lte) return false;
  return true;
}

export function evaluate(cond: Cond | undefined, state: PlayerState): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluate(c, state));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, state));
  if ('not' in cond) return !evaluate(cond.not, state);
  if ('tag' in cond) return hasTag(state, cond.tag);
  if ('tagNum' in cond) return inRange(tagNumber(state, cond.tagNum.key), cond.tagNum);
  if ('ability' in cond)
    return Object.entries(cond.ability).every(([k, v]) => state.abilities[k as Ability] >= (v ?? 0));
  if ('virtue' in cond)
    return Object.entries(cond.virtue).every(([k, v]) => state.virtues[k as Virtue] >= (v ?? 0));
  if ('money' in cond) return inRange(state.money, cond.money);
  if ('hp' in cond) return inRange(state.hp, cond.hp);
  if ('sp' in cond) return inRange(state.sp, cond.sp);
  if ('age' in cond) {
    const age = ageOf(state);
    return age >= cond.age[0] && age <= cond.age[1];
  }
  if ('date' in cond) return state.now >= parseDate(cond.date[0]) && state.now <= parseDate(cond.date[1]);
  if ('stage' in cond) {
    const stages = Array.isArray(cond.stage) ? cond.stage : [cond.stage];
    return stages.includes(stageOf(state));
  }
  if ('seen' in cond) return cond.seen in state.seen;
  if ('sinTop' in cond) return topSin(state) === cond.sinTop;
  throw new Error(`알 수 없는 조건: ${JSON.stringify(cond)}`);
}

/** 미충족 조건을 사람이 읽을 수 있는 문장으로. 선택지 회색 표시용. */
export function describeUnmet(cond: Cond | undefined, state: PlayerState): string[] {
  if (!cond || evaluate(cond, state)) return [];
  if ('all' in cond) return cond.all.flatMap((c) => describeUnmet(c, state));
  if ('any' in cond) return [cond.any.map((c) => describeUnmet(c, state).join(', ')).join(' 또는 ')];
  if ('ability' in cond)
    return Object.entries(cond.ability)
      .filter(([k, v]) => state.abilities[k as Ability] < (v ?? 0))
      .map(([k, v]) => `${k} ${v}`);
  if ('virtue' in cond)
    return Object.entries(cond.virtue)
      .filter(([k, v]) => state.virtues[k as Virtue] < (v ?? 0))
      .map(([k, v]) => `${k} ${v}등급`);
  if ('money' in cond) return [cond.money.gte !== undefined ? `${cond.money.gte.toLocaleString()} 안` : '돈 조건'];
  if ('tag' in cond) return [cond.tag.replace(/^[^:]*:/, '').replace('=', ' ')];
  return ['조건 불충족'];
}
