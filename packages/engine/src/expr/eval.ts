import type { Value } from '../types';
import { type Node, parseExpr } from './parser';

/** 수식이 상태를 읽는 창구. 엔진(state.ts)이 구현한다 */
export interface ExprContext {
  getVar(name: string): Value;
  getSys(name: string): Value;
  /** 상태가 필요한 함수(has, item, chance ...). 모르는 함수면 undefined */
  call(fn: string, args: Value[]): Value | undefined;
}

export function truthy(v: Value): boolean {
  return typeof v === 'string' ? v !== '' : Boolean(v);
}

export function toNum(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function looseEq(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  return String(a) === String(b);
}

function compare(a: Value, b: Value): number {
  if (typeof a === 'string' && typeof b === 'string' && (Number.isNaN(Number(a)) || Number.isNaN(Number(b))))
    return a < b ? -1 : a > b ? 1 : 0;
  return toNum(a) - toNum(b);
}

/** 상태가 필요 없는 내장 함수 */
const PURE: Record<string, (args: Value[]) => Value> = {
  min: (a) => Math.min(...a.map(toNum)),
  max: (a) => Math.max(...a.map(toNum)),
  clamp: ([x, lo, hi]) => Math.max(toNum(lo), Math.min(toNum(hi), toNum(x))),
  round: ([x, d]) => {
    const f = 10 ** toNum(d ?? 0);
    return Math.round(toNum(x) * f) / f;
  },
  floor: ([x]) => Math.floor(toNum(x)),
  ceil: ([x]) => Math.ceil(toNum(x)),
  abs: ([x]) => Math.abs(toNum(x)),
  pow: ([x, y]) => toNum(x) ** toNum(y),
  sqrt: ([x]) => Math.sqrt(Math.max(0, toNum(x))),
  if: ([c, a, b]) => (truthy(c) ? a : (b ?? 0)),
  num: ([x]) => toNum(x),
  str: ([x]) => String(x ?? ''),
  len: ([x]) => String(x ?? '').length,
  /** 천 단위 구분 기호 */
  fmt: ([x]) => toNum(x).toLocaleString('ko-KR'),
  /** 부호 붙은 숫자 */
  signed: ([x]) => (toNum(x) >= 0 ? '+' : '') + toNum(x).toLocaleString('ko-KR'),
};

export const PURE_FUNCTIONS = Object.keys(PURE);

export function evalNode(node: Node, ctx: ExprContext): Value {
  switch (node.k) {
    case 'lit':
      return node.v;
    case 'var':
      return ctx.getVar(node.name);
    case 'sys':
      return ctx.getSys(node.name);
    case 'un': {
      const a = evalNode(node.a, ctx);
      return node.op === '-' ? -toNum(a) : !truthy(a);
    }
    case 'cond':
      return truthy(evalNode(node.c, ctx)) ? evalNode(node.a, ctx) : evalNode(node.b, ctx);
    case 'bin': {
      if (node.op === '&&') {
        const a = evalNode(node.a, ctx);
        return truthy(a) ? evalNode(node.b, ctx) : a;
      }
      if (node.op === '||') {
        const a = evalNode(node.a, ctx);
        return truthy(a) ? a : evalNode(node.b, ctx);
      }
      const a = evalNode(node.a, ctx);
      const b = evalNode(node.b, ctx);
      switch (node.op) {
        case '+':
          return typeof a === 'string' || typeof b === 'string' ? `${a}${b}` : toNum(a) + toNum(b);
        case '-':
          return toNum(a) - toNum(b);
        case '*':
          return toNum(a) * toNum(b);
        case '/':
          return toNum(b) === 0 ? 0 : toNum(a) / toNum(b);
        case '%':
          return toNum(b) === 0 ? 0 : toNum(a) % toNum(b);
        case '==':
          return looseEq(a, b);
        case '!=':
          return !looseEq(a, b);
        case '<':
          return compare(a, b) < 0;
        case '<=':
          return compare(a, b) <= 0;
        case '>':
          return compare(a, b) > 0;
        case '>=':
          return compare(a, b) >= 0;
      }
      throw new Error(`알 수 없는 연산자 ${node.op}`);
    }
    case 'call': {
      const args = node.args.map((a) => evalNode(a, ctx));
      const pure = PURE[node.fn];
      if (pure) return pure(args);
      const result = ctx.call(node.fn, args);
      if (result === undefined) throw new Error(`알 수 없는 함수 ${node.fn}()`);
      return result;
    }
  }
}

export function evaluate(src: string | number | boolean | undefined, ctx: ExprContext, fallback: Value = 0): Value {
  if (src === undefined) return fallback;
  if (typeof src !== 'string') return src;
  return evalNode(parseExpr(src), ctx);
}

export function evalNum(src: string | number | undefined, ctx: ExprContext, fallback = 0): number {
  return toNum(evaluate(src, ctx, fallback));
}

/** 조건식. 비어 있으면 참 */
export function evalBool(src: string | undefined, ctx: ExprContext): boolean {
  if (src === undefined || src.trim() === '') return true;
  return truthy(evaluate(src, ctx));
}
