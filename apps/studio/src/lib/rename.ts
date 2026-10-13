// ID 이름 바꾸기: 패키지 전체의 참조(명령 필드, 수식, 본문 속 {수식})를 함께 고친다.

import type { StoryPackage } from '@engine';

export type RefKind = 'var' | 'event' | 'item' | 'status' | 'table' | 'ending' | 'script' | 'achievement' | 'asset' | 'stage';

/** 값 전체가 수식인 키 */
const EXPR_KEYS = new Set([
  'when', 'requires', 'value', 'cond', 'formula', 'min', 'max', 'initialExpr', 'weight', 'chance',
  'skill', 'difficulty', 'bonus', 'amount', 'times', 'count', 'add', 'unlock', 'length',
]);
/** 본문 템플릿 키({…} 안만 수식) */
const TEMPLATE_KEYS = new Set(['text', 'title', 'summary', 'header', 'footer', 'requiresText']);

/** 수식에서 이 종류의 ID를 첫 인자로 받는 함수 */
const FN_BY_KIND: Partial<Record<RefKind, string[]>> = {
  item: ['item'],
  status: ['status', 'statusLeft'],
  event: ['seen', 'seenAgo'],
  table: ['lookup'],
  achievement: ['achieved'],
  ending: ['endingSeen'],
  var: ['var', 'base', 'minOf', 'maxOf', 'name'],
};

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exprReplacer(kind: RefKind, from: string, to: string): (src: string) => string {
  const fns = FN_BY_KIND[kind] ?? [];
  const fnRe = fns.length ? new RegExp(`\\b(${fns.join('|')})\\(\\s*(['"])${escape(from)}\\2`, 'gu') : undefined;
  const varRe = kind === 'var' ? new RegExp(`(?<![\\p{L}\\p{N}_$'"])${escape(from)}(?![\\p{L}\\p{N}_'"])`, 'gu') : undefined;
  return (src) => {
    let out = src;
    if (fnRe) out = out.replace(fnRe, (_m, fn, q) => `${fn}(${q}${to}${q}`);
    if (varRe) out = out.replace(varRe, to);
    return out;
  };
}

/** 이름이 정확히 같을 때 바꿀 필드: [명령 do 또는 '*', 키] */
const FIELD_REFS: Record<RefKind, [string, string][]> = {
  var: [['set', 'var'], ['add', 'var']],
  event: [['goto', 'event'], ['*', 'goto'], ['*', 'start']],
  item: [['item', 'id']],
  status: [['status', 'id']],
  table: [],
  ending: [['end', 'ending'], ['*', 'ending']],
  script: [['call', 'script']],
  achievement: [['achieve', 'id']],
  asset: [['image', 'asset'], ['*', 'image'], ['*', 'cover']],
  stage: [],
};

export function renameRefs(pkg: StoryPackage, kind: RefKind, from: string, to: string): void {
  if (from === to) return;
  const expr = exprReplacer(kind, from, to);
  const template = (src: string) =>
    src.replace(/\{([^{}]+)\}/g, (m, inner: string) => {
      if (/^[^/]+\/[^/]+$/.test(inner)) return m;
      // {image 이미지ID}: 이미지 이름을 바꿀 때만 따라 바꾸고, 수식으로는 건드리지 않는다
      const img = /^(image|이미지)\s+(\S+)$/.exec(inner.trim());
      if (img) return kind === 'asset' && img[2] === from ? `{${img[1]} ${to}}` : m;
      return `{${expr(inner)}}`;
    });
  const fields = FIELD_REFS[kind];

  const visit = (node: any, parentKey?: string) => {
    if (Array.isArray(node)) {
      node.forEach((x, i) => {
        if (typeof x === 'string') {
          if (kind === 'stage' && parentKey === 'stages' && x === from) node[i] = to;
          if (kind === 'table' && parentKey === 'pools') return;
        } else visit(x, parentKey);
      });
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (typeof v === 'string') {
        if (v === from && fields.some(([d, k]) => k === key && (d === '*' || node.do === d))) node[key] = to;
        else if (EXPR_KEYS.has(key)) node[key] = expr(v);
        else if (TEMPLATE_KEYS.has(key)) node[key] = template(v);
      } else visit(v, key);
    }
    // 보정치의 키는 변수 이름
    if (kind === 'var' && node.modifiers && from in node.modifiers) {
      node.modifiers[to] = node.modifiers[from];
      delete node.modifiers[from];
    }
  };
  visit(pkg);
}
