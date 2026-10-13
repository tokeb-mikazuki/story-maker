// 이벤트 사이의 연결 분석. 어느 선택지·명령이 어느 이벤트로 이어지는지 찾는다.

import type { ChoiceDef, Command, Outcome, StoryPackage } from '@engine';
import { eventLabel } from './labels';

export function commandTargets(cmds: Command[] | undefined, out: Set<string>): void {
  for (const c of cmds ?? []) {
    if (c.do === 'goto') out.add(c.event);
    if (c.do === 'if') (commandTargets(c.then, out), commandTargets(c.else, out));
    if (c.do === 'random') c.branches.forEach((b) => commandTargets(b.then, out));
    if (c.do === 'check') (commandTargets(c.success, out), commandTargets(c.failure, out));
  }
}

export function choiceTargets(c: ChoiceDef): Set<string> {
  const out = new Set<string>();
  const o = (x?: Outcome) => {
    if (!x) return;
    if (x.goto) out.add(x.goto);
    commandTargets(x.do, out);
    x.choices?.forEach((n) => choiceTargets(n).forEach((t) => out.add(t)));
  };
  o(c.outcome);
  o(c.success);
  o(c.failure);
  c.results?.forEach(o);
  return out;
}

export function eventLinks(pkg: StoryPackage): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>();
  for (const e of pkg.events) {
    const out = new Set<string>();
    e.choices.forEach((c) => choiceTargets(c).forEach((t) => out.add(t)));
    links.set(e.id, out);
  }
  return links;
}

export type Incoming = { kind: 'event' | 'action' | 'start' | 'other'; id: string; label: string };

/** 이 이벤트로 이동해 오는 곳 */
export function incoming(pkg: StoryPackage, id: string): Incoming[] {
  const res: Incoming[] = [];
  if (pkg.settings.start === id) res.push({ kind: 'start', id: '', label: '시작 이벤트' });
  for (const e of pkg.events) if (e.choices.some((c) => choiceTargets(c).has(id))) res.push({ kind: 'event', id: e.id, label: eventLabel(e) });
  for (const a of pkg.actions ?? []) if (choiceTargets(a).has(id)) res.push({ kind: 'action', id: a.id, label: a.text });
  const json = (x: unknown) => JSON.stringify(x ?? '').includes(`"event":"${id}"`);
  for (const t of pkg.triggers ?? []) if (json(t.do)) res.push({ kind: 'other', id: t.id, label: `규칙: ${t.name ?? t.id}` });
  for (const s of pkg.scripts ?? []) if (json(s.do)) res.push({ kind: 'other', id: s.id, label: `스크립트: ${s.name ?? s.id}` });
  return res;
}

/**
  * 아직 따로 도달 경로가 없는 이벤트: 턴마다 뽑히는 주머니에도 없고, 시작 이벤트도 아니고,
 * 어떤 선택지·행동·규칙·스크립트에서도 이어지지 않는 것
 */
export function unreachedEvents(pkg: StoryPackage) {
  const targets = new Set<string>();
  for (const e of pkg.events) for (const c of e.choices) choiceTargets(c).forEach((t) => t !== e.id && targets.add(t));
  for (const a of pkg.actions ?? []) choiceTargets(a).forEach((t) => targets.add(t));
  const json = JSON.stringify([pkg.triggers ?? [], pkg.scripts ?? []]);
  return pkg.events.filter((e) => !e.pool && pkg.settings.start !== e.id && !targets.has(e.id) && !json.includes(`"event":"${e.id}"`));
}
