// 수식 언어. 작가가 조건·수치를 적는 데 쓴다.
//
//   리터럴   12  3.5  '문자열'  "문자열"  true  false
//   변수     체력   최대_체력   (패키지에 선언된 변수 id, 한글 가능)
//   시스템값 $age $나이 $year $turn $stage ... / 스크립트 매개변수 $이름
//   연산자   + - * / %   == != < <= > >= (= 도 ==)   and or not (&& || !)   조건 ? 참 : 거짓
//   함수     has('태그')  item('id')  chance(30)  lookup('표', 키, '열') ... (functions.ts)

export type Node =
  | { k: 'lit'; v: number | string | boolean }
  | { k: 'var'; name: string }
  | { k: 'sys'; name: string }
  | { k: 'call'; fn: string; args: Node[] }
  | { k: 'un'; op: '-' | 'not'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'cond'; c: Node; a: Node; b: Node };

export class ExprError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly pos: number,
  ) {
    super(`${message} (위치 ${pos + 1}: "${source}")`);
  }
}

type Tok =
  | { t: 'num'; v: number; p: number }
  | { t: 'str'; v: string; p: number }
  | { t: 'id'; v: string; p: number }
  | { t: 'sys'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: 'eof'; p: number };

const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;
const OPS = ['==', '!=', '<=', '>=', '&&', '||', '<', '>', '=', '+', '-', '*', '/', '%', '!', '(', ')', ',', '?', ':'];
const WORD_OPS: Record<string, string> = { and: '&&', or: '||', not: '!', 그리고: '&&', 또는: '||', 아님: '!' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9_.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: Number(src.slice(i, j).replace(/_/g, '')), p: i });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) j++;
        out += src[j++];
      }
      if (j >= src.length) throw new ExprError('닫히지 않은 문자열', src, i);
      toks.push({ t: 'str', v: out, p: i });
      i = j + 1;
      continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      if (j === i + 1) throw new ExprError('$ 뒤에 이름이 필요합니다', src, i);
      toks.push({ t: 'sys', v: src.slice(i + 1, j), p: i });
      i = j;
      continue;
    }
    if (IDENT_START.test(c)) {
      let j = i;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word in WORD_OPS) toks.push({ t: 'op', v: WORD_OPS[word], p: i });
      else toks.push({ t: 'id', v: word, p: i });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`알 수 없는 문자 '${c}'`, src, i);
    toks.push({ t: 'op', v: op === '=' ? '==' : op, p: i });
    i += op.length;
  }
  toks.push({ t: 'eof', p: src.length });
  return toks;
}

const BINARY: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

class Parser {
  private i = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly src: string,
  ) {}

  private peek(): Tok {
    return this.toks[this.i];
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }

  private expect(v: string): void {
    if (!this.isOp(v)) throw new ExprError(`'${v}'이(가) 필요합니다`, this.src, this.peek().p);
    this.i++;
  }

  parse(): Node {
    const node = this.ternary();
    if (this.peek().t !== 'eof') throw new ExprError('수식이 예상보다 깁니다', this.src, this.peek().p);
    return node;
  }

  private ternary(): Node {
    const c = this.binary(1);
    if (!this.isOp('?')) return c;
    this.i++;
    const a = this.ternary();
    this.expect(':');
    const b = this.ternary();
    return { k: 'cond', c, a, b };
  }

  private binary(minPrec: number): Node {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.t !== 'op') break;
      const prec = BINARY[t.v];
      if (prec === undefined || prec < minPrec) break;
      this.i++;
      const right = this.binary(prec + 1);
      left = { k: 'bin', op: t.v, a: left, b: right };
    }
    return left;
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.i++;
      return { k: 'un', op: '-', a: this.unary() };
    }
    if (this.isOp('!')) {
      this.i++;
      return { k: 'un', op: 'not', a: this.unary() };
    }
    return this.primary();
  }

  private primary(): Node {
    const t = this.peek();
    this.i++;
    switch (t.t) {
      case 'num':
      case 'str':
        return { k: 'lit', v: t.v };
      case 'sys':
        return { k: 'sys', name: t.v };
      case 'id': {
        if (t.v === 'true' || t.v === '참') return { k: 'lit', v: true };
        if (t.v === 'false' || t.v === '거짓') return { k: 'lit', v: false };
        if (!this.isOp('(')) return { k: 'var', name: t.v };
        this.i++;
        const args: Node[] = [];
        while (!this.isOp(')')) {
          args.push(this.ternary());
          if (!this.isOp(',')) break;
          this.i++;
        }
        this.expect(')');
        return { k: 'call', fn: t.v, args };
      }
      case 'op':
        if (t.v === '(') {
          const inner = this.ternary();
          this.expect(')');
          return inner;
        }
        throw new ExprError(`'${t.v}'이(가) 올 수 없는 자리입니다`, this.src, t.p);
      case 'eof':
        throw new ExprError('수식이 덜 끝났습니다', this.src, t.p);
    }
  }
}

const cache = new Map<string, Node>();

export function parseExpr(src: string): Node {
  let node = cache.get(src);
  if (!node) {
    if (!src.trim()) throw new ExprError('빈 수식', src, 0);
    node = new Parser(tokenize(src), src).parse();
    cache.set(src, node);
  }
  return node;
}

/** 수식 안에서 참조하는 이름들(검증·에디터 자동완성용) */
export interface ExprRefs {
  vars: Set<string>;
  sys: Set<string>;
  calls: { fn: string; args: Node[] }[];
}

export function collectRefs(node: Node, refs: ExprRefs = { vars: new Set(), sys: new Set(), calls: [] }): ExprRefs {
  switch (node.k) {
    case 'var':
      refs.vars.add(node.name);
      break;
    case 'sys':
      refs.sys.add(node.name);
      break;
    case 'call':
      refs.calls.push({ fn: node.fn, args: node.args });
      node.args.forEach((a) => collectRefs(a, refs));
      break;
    case 'un':
      collectRefs(node.a, refs);
      break;
    case 'bin':
      collectRefs(node.a, refs);
      collectRefs(node.b, refs);
      break;
    case 'cond':
      collectRefs(node.c, refs);
      collectRefs(node.a, refs);
      collectRefs(node.b, refs);
      break;
    case 'lit':
      break;
  }
  return refs;
}
