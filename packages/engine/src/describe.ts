// 선택지 조건을 사람이 읽을 수 있는 문장으로. "필요: 전투 3 이상, K사 앰플"

import { evalNode, truthy } from './expr/eval';
import { type Node, parseExpr } from './expr/parser';
import type { World } from './world';

const CMP_WORD: Record<string, string> = { '>=': '이상', '>': '초과', '<=': '이하', '<': '미만', '==': '', '!=': '아님' };
const FLIP: Record<string, string> = { '>=': '<=', '>': '<', '<=': '>=', '<': '>', '==': '==', '!=': '!=' };

function tagLabel(key: string, value?: string): string {
  const bare = key.replace(/^[^:]*:/, '');
  return value === undefined ? bare : `${bare} ${value}`;
}

function lit(n: Node): string | undefined {
  if (n.k === 'lit') return typeof n.v === 'number' ? n.v.toLocaleString('ko-KR') : String(n.v);
  if (n.k === 'un' && n.op === '-' && n.a.k === 'lit') return `-${n.a.v}`;
  return undefined;
}

/** 값 자체를 설명(변수 이름, 아이템 이름 등) */
function subject(n: Node, w: World): string | undefined {
  if (n.k === 'var') return w.displayName(n.name);
  if (n.k === 'sys') return { age: '나이', 나이: '나이', turn: '턴', 턴: '턴' }[n.name] ?? n.name;
  if (n.k === 'call' && n.args[0]?.k === 'lit') {
    const id = String(n.args[0].v);
    if (n.fn === 'item' || n.fn === 'status' || n.fn === 'var') return w.displayName(id);
    if (n.fn === 'tag') return tagLabel(id);
  }
  return undefined;
}

function positive(n: Node, w: World): string | undefined {
  if (n.k === 'call' && n.args[0]?.k === 'lit') {
    const id = String(n.args[0].v);
    switch (n.fn) {
      case 'has':
        return tagLabel(id, n.args[1] && lit(n.args[1]));
      case 'item':
        return `'${w.displayName(id)}' 보유`;
      case 'status':
        return w.displayName(id);
      case 'seen':
        return `'${w.displayName(id)}' 경험`;
      case 'achieved':
        return `도전과제 '${w.idx.achievements.get(id)?.title ?? id}'`;
    }
  }
  if (n.k === 'var') return w.displayName(n.name);
  if (n.k === 'bin' && n.op in CMP_WORD) {
    let [a, b, op] = [n.a, n.b, n.op];
    if (lit(a) !== undefined && lit(b) === undefined) [a, b, op] = [b, a, FLIP[op]];
    const name = subject(a, w);
    const value = lit(b);
    // item('열쇠') > 0 → '열쇠' 보유
    if (name && a.k === 'call' && a.fn === 'item' && ((op === '>' && value === '0') || (op === '>=' && value === '1'))) return `'${name}' 보유`;
    if (name && value !== undefined) {
      if (op === '==') return `${name} ${value}`;
      return `${name} ${value} ${CMP_WORD[op]}`;
    }
  }
  return undefined;
}

export function describeUnmet(src: string, w: World): string[] {
  try {
    return walk(parseExpr(src), w);
  } catch {
    return ['조건 불충족'];
  }
}

function walk(n: Node, w: World): string[] {
  if (truthy(evalNode(n, w))) return [];
  if (n.k === 'bin' && n.op === '&&') return [...walk(n.a, w), ...walk(n.b, w)];
  if (n.k === 'bin' && n.op === '||') return [[...walk(n.a, w), ...walk(n.b, w)].join(' 또는 ')];
  if (n.k === 'un' && n.op === 'not') {
    const inner = positive(n.a, w);
    return [inner ? `${inner} 없음` : '조건 불충족'];
  }
  return [positive(n, w) ?? '조건 불충족'];
}
