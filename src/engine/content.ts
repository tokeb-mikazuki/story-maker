import { load as loadYaml } from 'js-yaml';
import type { Action, Cond, Content, Effect, EpilogueParagraph, GameEvent, Origin, Outcome } from './types';
import { ABILITIES, SINS, VIRTUES } from './types';

export interface RawFiles {
  [path: string]: string;
}

/** 경로 → YAML 원문 묶음을 Content로 변환. 파일 종류는 경로로 구분한다. */
export function parseContent(files: RawFiles): Content {
  const content: Content = { events: new Map(), actions: [], origins: [], epilogue: [], endings: {} };
  for (const [path, raw] of Object.entries(files)) {
    const data = loadYaml(raw);
    if (data == null) continue;
    if (path.includes('/events/')) {
      for (const event of asArray<GameEvent>(data, path)) {
        if (content.events.has(event.id)) throw new Error(`중복 이벤트 ID: ${event.id} (${path})`);
        content.events.set(event.id, event);
      }
    } else if (path.endsWith('actions.yaml')) {
      content.actions.push(...asArray<Action>(data, path));
    } else if (path.endsWith('origins.yaml')) {
      content.origins.push(...asArray<Origin>(data, path));
    } else if (path.endsWith('epilogue.yaml')) {
      content.epilogue.push(...asArray<EpilogueParagraph>(data, path));
    } else if (path.endsWith('endings.yaml')) {
      Object.assign(content.endings, data as Record<string, string>);
    }
  }
  return content;
}

function asArray<T>(data: unknown, path: string): T[] {
  if (!Array.isArray(data)) throw new Error(`${path}: 최상위는 목록이어야 합니다.`);
  return data as T[];
}

// ───────────────────────── 검증 ─────────────────────────

const COND_KEYS = new Set([
  'all', 'any', 'not', 'tag', 'tagNum', 'ability', 'virtue', 'money', 'hp', 'sp', 'age', 'date', 'stage', 'seen', 'sinTop',
]);
const EFFECT_KEYS = new Set([
  'hp', 'hpMax', 'sp', 'money', 'fear', 'addTag', 'removeTag', 'tagAdd', 'virtue', 'ability', 'emotion', 'sin', 'advance', 'end',
]);

/** 작가 실수를 잡는다: 오타 난 키, 없는 goto 대상, 잘못된 능력/가치관/죄종 이름 등 */
export function validateContent(content: Content): string[] {
  const errors: string[] = [];
  const checkCond = (cond: Cond | undefined, where: string) => {
    if (!cond) return;
    const keys = Object.keys(cond);
    if (keys.length !== 1 || !COND_KEYS.has(keys[0])) {
      errors.push(`${where}: 알 수 없는 조건 ${JSON.stringify(cond)}`);
      return;
    }
    const c = cond as Record<string, unknown>;
    if ('all' in c || 'any' in c) for (const sub of (c.all ?? c.any) as Cond[]) checkCond(sub, where);
    if ('not' in c) checkCond(c.not as Cond, where);
    if ('ability' in c) checkNames(Object.keys(c.ability as object), ABILITIES, where);
    if ('virtue' in c) checkNames(Object.keys(c.virtue as object), VIRTUES, where);
    if ('sinTop' in c) checkNames([c.sinTop as string], SINS, where);
  };
  const checkNames = (names: string[], allowed: readonly string[], where: string) => {
    for (const n of names) if (!allowed.includes(n)) errors.push(`${where}: 알 수 없는 이름 '${n}'`);
  };
  const checkOutcome = (outcome: Outcome | undefined, where: string) => {
    if (!outcome) return;
    if (outcome.goto && !content.events.has(outcome.goto)) errors.push(`${where}: 없는 goto 대상 '${outcome.goto}'`);
    for (const effect of outcome.effects ?? []) checkEffect(effect, where);
  };
  const checkEffect = (effect: Effect, where: string) => {
    const keys = Object.keys(effect);
    if (keys.length !== 1 || !EFFECT_KEYS.has(keys[0])) {
      errors.push(`${where}: 알 수 없는 효과 ${JSON.stringify(effect)}`);
      return;
    }
    const e = effect as Record<string, unknown>;
    if ('ability' in e) checkNames(Object.keys(e.ability as object), ABILITIES, where);
    if ('virtue' in e) checkNames(Object.keys(e.virtue as object), VIRTUES, where);
    if ('sin' in e) checkNames([e.sin as string], SINS, where);
    if ('end' in e && !(String(e.end) in content.endings)) errors.push(`${where}: 엔딩 문구 없는 종료 사유 '${e.end}'`);
  };

  for (const event of content.events.values()) {
    const where = `이벤트 ${event.id}`;
    if (!event.text) errors.push(`${where}: 본문(text) 없음`);
    if (!event.choices?.length) errors.push(`${where}: 선택지 없음`);
    checkCond(event.when, where);
    event.choices?.forEach((choice, i) => {
      const at = `${where} 선택지 ${i + 1}`;
      checkCond(choice.requires, at);
      if (choice.check) {
        if (choice.check.ability) checkNames([choice.check.ability], ABILITIES, at);
        if (choice.check.virtue) checkNames([choice.check.virtue], VIRTUES, at);
        if (!choice.success || !choice.failure) errors.push(`${at}: check에는 success와 failure가 모두 필요`);
      }
      checkOutcome(choice.success, at);
      checkOutcome(choice.failure, at);
      checkOutcome(choice.outcome, at);
    });
  }
  for (const action of content.actions) {
    const where = `행동 ${action.id}`;
    checkCond(action.when, where);
    checkCond(action.requires, where);
    checkOutcome(action.success, where);
    checkOutcome(action.failure, where);
    checkOutcome(action.outcome, where);
  }
  for (const paragraph of content.epilogue) {
    checkCond(paragraph.when, `결산 ${paragraph.id}`);
    paragraph.lines.forEach((l, i) => checkCond(l.when, `결산 ${paragraph.id} 줄 ${i + 1}`));
  }
  for (const origin of content.origins) {
    checkNames(Object.keys(origin.virtues ?? {}), VIRTUES, `출생 ${origin.id}`);
    checkNames(Object.keys(origin.abilities ?? {}), ABILITIES, `출생 ${origin.id}`);
  }
  for (const required of ['crisis.voice', 'crisis.breakdown']) {
    if (!content.events.has(required)) errors.push(`필수 이벤트 '${required}' 없음`);
  }
  return errors;
}

/** Vite 번들에서 콘텐츠 원문 수집 */
export function loadBundledContent(): Content {
  const files = import.meta.glob('../content/**/*.yaml', { query: '?raw', import: 'default', eager: true }) as RawFiles;
  return parseContent(files);
}
