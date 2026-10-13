// 본문 템플릿.
//
//   {수식}                         값 삽입: {이름}, {체력}, {fmt(돈)}
//   {if 수식} … {elif 수식} … {else} … {/if}   조건부 문장
//   {one} 가 {or} 나 {or} 다 {/one}            무작위로 하나
//   {이/가} {을/를} {은/는} {와/과} {으로/로} …   앞 글자 받침에 맞는 조사
//   {image 이미지ID}               글 사이에 이미지를 넣는다(본문에서만. 제목·선택지·알림에서는 무시)
//   {{ }}                          중괄호 그대로 출력

import { type ExprContext, evaluate, truthy } from './expr/eval';
import { parseExpr } from './expr/parser';

export type TextNode =
  | { k: 'lit'; v: string }
  | { k: 'expr'; src: string }
  | { k: 'josa'; withFinal: string; withoutFinal: string; rieulUsesWithout: boolean }
  | { k: 'if'; branches: { cond?: string; body: TextNode[] }[] }
  | { k: 'one'; options: TextNode[][] }
  | { k: 'image'; id: string };

/** 렌더링된 글 속에서 이미지 자리를 나타내는 표시: IMAGE_OPEN + 이미지ID + IMAGE_CLOSE (앞뒤로 줄바꿈이 붙는다) */
export const IMAGE_OPEN = '\uE000';
export const IMAGE_CLOSE = '\uE001';

/** [받침 있을 때, 받침 없을 때] — 순서를 바꿔 써도 인식한다 */
const JOSA_PAIRS: [string, string][] = [
  ['이', '가'],
  ['을', '를'],
  ['은', '는'],
  ['과', '와'],
  ['으로', '로'],
  ['아', '야'],
  ['이여', '여'],
  ['이랑', '랑'],
  ['이나', '나'],
  ['이다', '다'],
  ['이에요', '예요'],
  ['이었', '였'],
  ['으로서', '로서'],
  ['으로써', '로써'],
  ['이라', '라'],
];

const JOSA = new Map<string, TextNode & { k: 'josa' }>();
for (const [a, b] of JOSA_PAIRS) {
  const node = { k: 'josa' as const, withFinal: a, withoutFinal: b, rieulUsesWithout: a.startsWith('으') };
  JOSA.set(`${a}/${b}`, node);
  JOSA.set(`${b}/${a}`, node);
  JOSA.set(`(${a})${b}`, node);
}

export class TemplateError extends Error {}

const cache = new Map<string, TextNode[]>();

export function parseTemplate(src: string): TextNode[] {
  const cached = cache.get(src);
  if (cached) return cached;

  // 토큰: 리터럴 / {태그}
  const tokens: { tag?: string; lit?: string }[] = [];
  let i = 0;
  let lit = '';
  while (i < src.length) {
    if (src.startsWith('{{', i)) {
      lit += '{';
      i += 2;
    } else if (src.startsWith('}}', i)) {
      lit += '}';
      i += 2;
    } else if (src[i] === '{') {
      const end = src.indexOf('}', i);
      if (end < 0) throw new TemplateError(`닫히지 않은 중괄호: "${src.slice(i, i + 20)}…"`);
      if (lit) tokens.push({ lit });
      lit = '';
      tokens.push({ tag: src.slice(i + 1, end).trim() });
      i = end + 1;
    } else {
      lit += src[i++];
    }
  }
  if (lit) tokens.push({ lit });

  let pos = 0;
  const parseUntil = (stops: string[]): { nodes: TextNode[]; stop?: string; stopTag?: string } => {
    const nodes: TextNode[] = [];
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok.lit !== undefined) {
        nodes.push({ k: 'lit', v: tok.lit });
        pos++;
        continue;
      }
      const tag = tok.tag!;
      const word = tag.split(/\s+/)[0];
      if (stops.includes(word)) {
        pos++;
        return { nodes, stop: word, stopTag: tag };
      }
      pos++;
      if (word === 'if') {
        const branches: { cond?: string; body: TextNode[] }[] = [];
        let cond: string | undefined = tag.slice(2).trim();
        for (;;) {
          parseExpr(cond!);
          const part = parseUntil(['elif', 'else', '/if']);
          branches.push({ cond, body: part.nodes });
          if (part.stop === 'elif') {
            cond = part.stopTag!.slice(4).trim();
            continue;
          }
          if (part.stop === 'else') {
            const rest = parseUntil(['/if']);
            if (rest.stop !== '/if') throw new TemplateError(`{if ${branches[0].cond}}에 {/if}가 없습니다`);
            branches.push({ body: rest.nodes });
            break;
          }
          if (part.stop !== '/if') throw new TemplateError(`{if ${branches[0].cond}}에 {/if}가 없습니다`);
          break;
        }
        nodes.push({ k: 'if', branches });
      } else if (word === 'one') {
        const options: TextNode[][] = [];
        for (;;) {
          const part = parseUntil(['or', '/one']);
          options.push(part.nodes);
          if (part.stop === 'or') continue;
          if (part.stop !== '/one') throw new TemplateError('{one}에 {/one}이 없습니다');
          break;
        }
        nodes.push({ k: 'one', options });
      } else if ((word === 'image' || word === '이미지') && /^\S+\s+\S/.test(tag)) {
        nodes.push({ k: 'image', id: tag.slice(word.length).trim() });
      } else if (['elif', 'else', '/if', 'or', '/one'].includes(word)) {
        throw new TemplateError(`짝이 맞지 않는 {${tag}}`);
      } else if (JOSA.has(tag)) {
        nodes.push(JOSA.get(tag)!);
      } else {
        parseExpr(tag);
        nodes.push({ k: 'expr', src: tag });
      }
    }
    return { nodes };
  };

  const result = parseUntil([]).nodes;
  cache.set(src, result);
  return result;
}

/** 숫자를 한국어로 읽었을 때 끝 글자의 받침 */
const DIGIT_FINAL: Record<string, number> = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 };

/** 앞말의 받침: 0 없음, 8 ㄹ, 그 외 있음, -1 판단 불가 */
function finalConsonant(before: string): number {
  const trimmed = before.replace(/['"’”)\]」』>\s]+$/u, '');
  const ch = trimmed[trimmed.length - 1];
  if (!ch) return -1;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (ch in DIGIT_FINAL) return DIGIT_FINAL[ch];
  if (/[a-zA-Z]/.test(ch)) return /[lmnr]/i.test(ch) ? 4 : 0;
  return -1;
}

export function renderTemplate(src: string, ctx: ExprContext, random: () => number, opts: { images?: boolean } = {}): string {
  let out = '';
  const run = (nodes: TextNode[]) => {
    for (const node of nodes) {
      switch (node.k) {
        case 'lit':
          out += node.v;
          break;
        case 'expr': {
          const v = evaluate(node.src, ctx);
          out += typeof v === 'number' && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(v);
          break;
        }
        case 'josa': {
          const f = finalConsonant(out);
          if (f < 0) out += `(${node.withFinal})${node.withoutFinal}`;
          else if (f === 0 || (f === 8 && node.rieulUsesWithout)) out += node.withoutFinal;
          else out += node.withFinal;
          break;
        }
        case 'if': {
          const branch = node.branches.find((b) => b.cond === undefined || truthy(evaluate(b.cond, ctx)));
          if (branch) run(branch.body);
          break;
        }
        case 'one':
          run(node.options[Math.floor(random() * node.options.length)] ?? []);
          break;
        case 'image':
          if (opts.images) out += `\n${IMAGE_OPEN}${node.id}${IMAGE_CLOSE}\n`;
          break;
      }
    }
  };
  run(parseTemplate(src));
  return out.trim();
}

/** 템플릿 안의 수식을 모두 꺼낸다(검증용) */
export function templateExprs(src: string): string[] {
  const found: string[] = [];
  const walk = (nodes: TextNode[]) => {
    for (const n of nodes) {
      if (n.k === 'expr') found.push(n.src);
      else if (n.k === 'if')
        n.branches.forEach((b) => {
          if (b.cond) found.push(b.cond);
          walk(b.body);
        });
      else if (n.k === 'one') n.options.forEach(walk);
    }
  };
  walk(parseTemplate(src));
  return found;
}

/** 템플릿 안에서 쓴 이미지 ID들(검증용) */
export function templateImages(src: string): string[] {
  const found: string[] = [];
  const walk = (nodes: TextNode[]) => {
    for (const n of nodes) {
      if (n.k === 'image') found.push(n.id);
      else if (n.k === 'if') n.branches.forEach((b) => walk(b.body));
      else if (n.k === 'one') n.options.forEach(walk);
    }
  };
  walk(parseTemplate(src));
  return found;
}
