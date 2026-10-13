import type { Ability, Check, Effect, PlayerState, Sin, Virtue } from './types';
import { nextRandom } from './rng';
import {
  SP_MIN,
  clampSp,
  gainVirtueXp,
  hpMax,
  mentalGrade,
  raiseAbility,
  removeTag,
  setTag,
} from './state';

/** 확률 판정: p = 50 + 15 × (능력 − 난이도) + SP × 0.5 + 보정, 5~95로 제한 */
export function checkChance(state: PlayerState, check: Check): number {
  const score = check.ability
    ? state.abilities[check.ability]
    : check.virtue
      ? state.virtues[check.virtue]
      : 0;
  const p = 50 + 15 * (score - check.difficulty) + state.sp * 0.5 + (check.bonus ?? 0);
  return Math.max(5, Math.min(95, Math.round(p)));
}

export function chanceLabel(p: number): string {
  if (p < 15) return '매우 불리';
  if (p < 40) return '불리';
  if (p <= 60) return '반반';
  if (p <= 85) return '유리';
  return '매우 유리';
}

export function rollCheck(state: PlayerState, check: Check): boolean {
  return nextRandom(state) * 100 < checkChance(state, check);
}

/** 공포 피해 (Lobotomy Corporation). 반환값: 단계 이름 */
export function fearDamage(state: PlayerState, danger: number): string {
  const diff = danger - mentalGrade(state);
  if (diff <= -1) return '여유';
  if (diff === 0) return '침착';
  if (diff === 1) {
    state.sp = clampSp(state.sp - 5);
    return '긴장';
  }
  if (diff === 2) {
    state.sp = clampSp(state.sp - 12);
    return '공포';
  }
  if (diff === 3) {
    state.sp = clampSp(state.sp - 25);
    return '절망';
  }
  state.sp = SP_MIN;
  return '압도';
}

export interface EffectResult {
  goto?: string;
  ended?: string;
  notes: string[];
}

export function applyEffects(state: PlayerState, effects: Effect[] | undefined): EffectResult {
  const result: EffectResult = { notes: [] };
  for (const effect of effects ?? []) {
    if ('hp' in effect) {
      state.hp = Math.min(hpMax(state), state.hp + effect.hp);
      result.notes.push(`체력 ${signed(effect.hp)}`);
    } else if ('hpMax' in effect) {
      state.hpMaxBonus += effect.hpMax;
      state.hp = Math.min(hpMax(state), state.hp);
    } else if ('sp' in effect) {
      state.sp = clampSp(state.sp + effect.sp);
      result.notes.push(`정신 ${signed(effect.sp)}`);
    } else if ('money' in effect) {
      state.money += effect.money;
      result.notes.push(`${signed(effect.money)} 안`);
    } else if ('fear' in effect) {
      const stageName = fearDamage(state, effect.fear);
      if (stageName !== '여유' && stageName !== '침착') result.notes.push(`공포: ${stageName}`);
    } else if ('addTag' in effect) {
      setTag(state, effect.addTag);
    } else if ('removeTag' in effect) {
      removeTag(state, effect.removeTag);
    } else if ('tagAdd' in effect) {
      const current = state.tags[effect.tagAdd.key];
      state.tags[effect.tagAdd.key] = (typeof current === 'number' ? current : 0) + effect.tagAdd.value;
    } else if ('virtue' in effect) {
      for (const [k, v] of Object.entries(effect.virtue)) gainVirtueXp(state, k as Virtue, v ?? 0);
    } else if ('ability' in effect) {
      for (const [k, v] of Object.entries(effect.ability)) {
        raiseAbility(state, k as Ability, v ?? 0);
        result.notes.push(`${k} ${signed(v ?? 0)}`);
      }
    } else if ('emotion' in effect) {
      state.emotion[effect.emotion] += 1;
    } else if ('sin' in effect) {
      state.sins[effect.sin as Sin] += 1;
    } else if ('advance' in effect) {
      state.now += effect.advance;
    } else if ('end' in effect) {
      result.ended = effect.end;
    }
  }
  return result;
}

function signed(n: number): string {
  return n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}
