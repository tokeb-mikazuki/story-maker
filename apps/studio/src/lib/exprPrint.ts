// 수식 트리 → 문자열. 조건 블록 편집기가 고친 트리를 다시 수식으로 저장할 때 쓴다.
// 우선순위가 같은 오른쪽 피연산자에는 괄호를 붙여 원래 의미를 지킨다(a - (b - c)).

import { type Node, type StoryPackage, collectRefs, parseExpr } from '@engine';
import { eventLabel } from './labels';

const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const WORD: Record<string, string> = { '||': 'or', '&&': 'and' };

function prec(n: Node): number {
  if (n.k === 'cond') return 0;
  if (n.k === 'bin') return PREC[n.op];
  if (n.k === 'un') return 7;
  return 8;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function printExpr(n: Node): string {
  switch (n.k) {
    case 'lit':
      return typeof n.v === 'string' ? quote(n.v) : String(n.v);
    case 'var':
      return n.name;
    case 'sys':
      return `$${n.name}`;
    case 'call':
      return `${n.fn}(${n.args.map(printExpr).join(', ')})`;
    case 'un': {
      const inner = prec(n.a) < 7 ? `(${printExpr(n.a)})` : printExpr(n.a);
      return n.op === 'not' ? `not ${inner}` : `-${inner}`;
    }
    case 'bin': {
      const p = PREC[n.op];
      const a = prec(n.a) < p ? `(${printExpr(n.a)})` : printExpr(n.a);
      const b = prec(n.b) <= p ? `(${printExpr(n.b)})` : printExpr(n.b);
      return `${a} ${WORD[n.op] ?? n.op} ${b}`;
    }
    case 'cond': {
      const c = prec(n.c) <= 0 ? `(${printExpr(n.c)})` : printExpr(n.c);
      return `${c} ? ${printExpr(n.a)} : ${printExpr(n.b)}`;
    }
  }
}

export function tryParse(src: string | undefined): Node | undefined {
  if (!src?.trim()) return undefined;
  try {
    return parseExpr(src);
  } catch {
    return undefined;
  }
}

/** a and b and c → [a, b, c] */
export function flatten(n: Node, op: '&&' | '||'): Node[] {
  return n.k === 'bin' && n.op === op ? [...flatten(n.a, op), ...flatten(n.b, op)] : [n];
}

export function join(parts: Node[], op: '&&' | '||'): Node | undefined {
  return parts.reduce<Node | undefined>((acc, p) => (acc ? { k: 'bin', op, a: acc, b: p } : p), undefined);
}

/** 두 조건을 'and'로 잇는다(빈 쪽은 무시) */
export function andExpr(a: string | undefined, b: string | undefined): string | undefined {
  if (!a?.trim()) return b;
  if (!b?.trim()) return a;
  const na = tryParse(a);
  const nb = tryParse(b);
  if (!na || !nb) return `(${a}) and (${b})`;
  return printExpr(join([...flatten(na, '&&'), ...flatten(nb, '&&')], '&&')!);
}

// ───────────────────────── 조건 묶기 ─────────────────────────

/**
  * 조건이 무엇에 관한 것인지(묶어 보기용 열쇠). 처음 나오는 변수·아이템·태그·상태·이벤트 순.
 * 예: "체력 <= 0 and not has('부활')" → { key: 'var:체력', label: '체력' }
 */
export function conditionSubject(src: string | undefined, displayName: (kind: string, id: string) => string = (_, id) => id): { key: string; label: string } {
  const n = tryParse(src);
  if (!n) return src?.trim() ? { key: '?', label: '직접 쓴 수식' } : { key: '', label: '조건 없음' };
  const refs = collectRefs(n);
  const first = [...refs.vars][0];
  if (first) return { key: `var:${first}`, label: displayName('var', first) };
  for (const c of refs.calls) {
    const arg = c.args[0];
    if (arg?.k !== 'lit') continue;
    const id = String(arg.v);
    const kind = { has: '태그', tag: '태그', count: '태그', item: '아이템', status: '상태', statusLeft: '상태', seen: '이벤트', seenAgo: '이벤트', achieved: '도전과제', var: 'var' }[c.fn];
    if (kind === 'var') return { key: `var:${id}`, label: displayName('var', id) };
    if (kind === '태그') return { key: `tag:${id.replace(/:.*/, ':')}`, label: `태그 ${id.includes(':') ? id.replace(/:.*/, ':…') : id}` };
    if (kind) return { key: `${c.fn}:${id}`, label: `${kind} ${displayName(c.fn, id)}` };
  }
  const sys = [...refs.sys][0];
  if (sys) return { key: `sys:${sys}`, label: { age: '나이', 나이: '나이', turn: '턴', 턴: '턴', year: '연도', 년: '연도' }[sys] ?? `$${sys}` };
  if (refs.calls.some((c) => c.fn === 'chance' || c.fn === 'rand')) return { key: 'chance', label: '확률' };
  return { key: '~', label: '기타' };
}

/** conditionSubject에 넘기는 이름표: ID 대신 작가가 붙인 이름을 보여 준다 */
export function pkgNamer(pkg: StoryPackage): (kind: string, id: string) => string {
  return (kind, id) => {
    switch (kind) {
      case 'var':
        return pkg.variables.find((v) => v.id === id)?.name ?? id;
      case 'item':
        return pkg.items?.find((i) => i.id === id)?.name ?? id;
      case 'status':
      case 'statusLeft':
        return pkg.statuses?.find((s) => s.id === id)?.name ?? id;
      case 'seen':
      case 'seenAgo':
        return eventLabel(pkg.events.find((e) => e.id === id), id);
      case 'achieved':
        return pkg.achievements?.find((a) => a.id === id)?.title ?? id;
    }
    return id;
  };
}

// ───────────────────────── 조건을 문장으로 ─────────────────────────

const SYS_WORD: Record<string, string> = { age: '나이', 나이: '나이', turn: '턴', 턴: '턴', year: '연도', 년: '연도', month: '월', 월: '월', runs: '회차', 회차: '회차', name: '이름', 이름: '이름', pending: '이어질 장면', stage: '단계', 단계: '단계' };
const CMP_WORD: Record<string, string> = { '>=': '이상', '>': '초과', '<=': '이하', '<': '미만' };

/**
 * 조건 수식을 사람이 읽는 말로. 목록·요약에 쓴다.
 * 예: "체력 <= 0 and not has('부활')" → "체력 0 이하, 부활 태그 없음"
 */
export function describeExpr(src: string | undefined, pkg: StoryPackage): string {
  const n = tryParse(src);
  if (!n) return src ?? '';
  const name = pkgNamer(pkg);
  const id = (x: Node | undefined) => (x?.k === 'lit' ? String(x.v) : undefined);

  const val = (x: Node): string => {
    if (x.k === 'lit') return typeof x.v === 'number' ? x.v.toLocaleString('ko-KR') : typeof x.v === 'boolean' ? (x.v ? '참' : '거짓') : x.v;
    if (x.k === 'var') return name('var', x.name);
    if (x.k === 'sys') return SYS_WORD[x.name] ?? `$${x.name}`;
    if (x.k === 'un' && x.op === '-') return `-${val(x.a)}`;
    if (x.k === 'call' && x.args.length === 1 && id(x.args[0])) {
      const i = id(x.args[0])!;
      if (x.fn === 'item') return `${name('item', i)} 개수`;
      if (x.fn === 'status') return `${name('status', i)} 중첩`;
      if (x.fn === 'tag') return `${i} 태그 값`;
      if (x.fn === 'var') return name('var', i);
    }
    return printExpr(x);
  };

  const fact = (x: Node, negative: boolean): string | undefined => {
    if (x.k !== 'call') return undefined;
    if (x.fn === 'chance' && x.args[0]) return `${val(x.args[0])}% 확률${negative ? '로 빗나감' : ''}`;
    const i = id(x.args[0]);
    if (!i) return undefined;
    switch (x.fn) {
      case 'has':
        return x.args[1] ? `${i}${negative ? '이(가) ' : ': '}${val(x.args[1])}${negative ? '이 아님' : ''}` : `${i} 태그 ${negative ? '없음' : '있음'}`;
      case 'item':
        return `'${name('item', i)}' ${negative ? '없음' : '보유'}`;
      case 'status':
        return `${name('status', i)} 상태${negative ? ' 아님' : ''}`;
      case 'seen':
        return `'${name('seen', i)}' ${negative ? '안 겪음' : '겪음'}`;
      case 'achieved':
        return `도전과제 '${name('achieved', i)}' ${negative ? '미달성' : '달성'}`;
    }
    return undefined;
  };

  const d = (x: Node): string => {
    if (x.k === 'bin' && x.op === '&&') return flatten(x, '&&').map((p) => (p.k === 'bin' && p.op === '||' ? `(${d(p)})` : d(p))).join(', ');
    if (x.k === 'bin' && x.op === '||') return flatten(x, '||').map((p) => (p.k === 'bin' && p.op === '&&' ? `(${d(p)})` : d(p))).join(' 또는 ');
    if (x.k === 'un' && x.op === 'not') return fact(x.a, true) ?? (x.a.k === 'var' ? `${name('var', x.a.name)} 아님` : `${d(x.a)} 아님`);
    if (x.k === 'bin' && x.op in CMP_WORD) {
      // item('x') > 0 → x 있음
      if (x.a.k === 'call' && x.a.fn === 'item' && x.b.k === 'lit' && x.b.v === 0 && (x.op === '>' || x.op === '>=')) return x.op === '>' ? (fact(x.a, false) ?? '') : '항상';
      const unit = x.a.k === 'call' && x.a.fn === 'item' ? '개' : x.a.k === 'sys' && (x.a.name === '나이' || x.a.name === 'age') ? '세' : '';
      return `${val(x.a)} ${val(x.b)}${unit} ${CMP_WORD[x.op]}`;
    }
    if (x.k === 'bin' && (x.op === '==' || x.op === '!=')) {
      if (x.a.k === 'call' && x.a.fn === 'item' && x.b.k === 'lit' && x.b.v === 0) return fact(x.a, x.op === '==') ?? '';
      return `${val(x.a)}${x.op === '==' ? ': ' : ' ≠ '}${val(x.b)}`;
    }
    if (x.k === 'lit' && typeof x.v === 'boolean') return x.v ? '항상' : '꺼 둠';
    if (x.k === 'var') return name('var', x.name);
    return fact(x, false) ?? printExpr(x);
  };
  return d(n);
}
