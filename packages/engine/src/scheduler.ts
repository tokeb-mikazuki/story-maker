// 이벤트 풀에서 다음 이벤트 고르기: 고정(초크포인트·역사) 이벤트와 가중치 랜덤 이벤트.

import { evalBool } from './expr/eval';
import type { EventDef } from './types';
import type { World } from './world';

/** 풀이 없는 이벤트는 goto·시작 이벤트로만 등장한다 */
export function poolOf(e: EventDef): string | undefined {
  return e.pool;
}

function inPools(e: EventDef, pools: string[]): boolean {
  return e.pool !== undefined && pools.includes(e.pool);
}

export function isEligible(w: World, e: EventDef): boolean {
  const s = w.state;
  if (e.stages && !e.stages.includes(w.currentStage().id)) return false;
  if (e.ages) {
    const age = w.age();
    if (age < e.ages[0] || age > e.ages[1]) return false;
  }
  if (e.dates) {
    if (s.now < w.cal.parse(e.dates[0]) || s.now > w.cal.parse(e.dates[1])) return false;
  }
  const last = s.seen[e.id];
  if (last !== undefined) {
    if (e.once || e.fixed) return false;
    if (e.cooldown && s.turn - last < e.cooldown) return false;
  }
  return evalBool(e.when, w);
}

export function pickFixed(w: World, pools: string[]): EventDef | undefined {
  const candidates = w.pkg.events.filter((e) => e.fixed && inPools(e, pools) && isEligible(w, e));
  const start = (e: EventDef) => (e.dates ? w.cal.parse(e.dates[0]) : -Infinity);
  candidates.sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      start(a) - start(b) ||
      w.idx.eventOrder.get(a.id)! - w.idx.eventOrder.get(b.id)!,
  );
  return candidates[0];
}

export function pickRandom(w: World, pools: string[]): EventDef | undefined {
  const cfg = w.pkg.settings.scheduler ?? {};
  const s = w.state;
  const blocked = new Set(
    s.recent
      .slice(-(cfg.groupBlock ?? 2))
      .map((r) => r.group)
      .filter((g): g is string => !!g),
  );
  const balance = cfg.toneBalance ?? { window: 5, threshold: 4, factor: 0.5 };
  const window = s.recent.slice(-balance.window);
  const grim = window.length >= balance.threshold && window.filter((r) => r.tone === 'negative').length >= balance.threshold;

  const pool = w.pkg.events.filter(
    (e) => !e.fixed && inPools(e, pools) && !(e.group && blocked.has(e.group)) && isEligible(w, e),
  );
  return w.pickWeighted(
    pool,
    (e) => w.num(e.weight ?? cfg.defaultWeight ?? 10) * (grim && e.tone === 'negative' ? balance.factor : 1),
    { what: '무작위 장면', name: (e) => e.title || e.text.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim().slice(0, 18) || e.id },
  );
}

export function markSeen(w: World, e: EventDef): void {
  const s = w.state;
  s.seen[e.id] = s.turn;
  s.recent.push({ id: e.id, group: e.group, tone: e.tone });
  if (s.recent.length > 20) s.recent.splice(0, s.recent.length - 20);
  if (e.record) {
    const spec = typeof e.record === 'string' ? { text: e.record } : e.record;
    w.record(w.text(spec.text), spec.importance ?? 3, e.id);
  }
}
