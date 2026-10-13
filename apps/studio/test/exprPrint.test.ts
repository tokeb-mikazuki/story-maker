import { describe, expect, it } from 'vitest';
import { parseExpr } from '../../../packages/engine/src/expr/parser';
import { andExpr, conditionSubject, describeExpr, printExpr } from '../src/lib/exprPrint';
import { lighthouse } from '../src/samples/lighthouse';
import { saltIsle } from '../src/samples/saltIsle';

const roundTrip = (src: string) => expect(parseExpr(printExpr(parseExpr(src)))).toEqual(parseExpr(src));

/** 패키지 안의 모든 수식 문자열(조건·수치) */
function exprsIn(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((y) => exprsIn(y, out));
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'string' && ['when', 'requires', 'cond', 'unlock', 'formula', 'initialExpr', 'skill', 'weight'].includes(k)) out.push(v);
      else exprsIn(v, out);
    }
  return out;
}

describe('printExpr', () => {
  it.each([
    "체력 <= 0 and not has('부활')",
    'a - (b - c)',
    'a - b - c',
    '(a or b) and c',
    'not (a == 1)',
    '-(a + 2) * 3',
    "x > 3 ? '높음' : '낮음'",
    "has('직업', '어부') or item('열쇠') > 0 and $나이 >= 20",
    "str('it\\'s')",
    '1 + 2 == 3 != false',
  ])('%s', roundTrip);

  it('샘플의 모든 수식이 의미를 그대로 유지한다', () => {
    const all = [...exprsIn(saltIsle), ...exprsIn(lighthouse)];
    expect(all.length).toBeGreaterThan(20);
    all.forEach(roundTrip);
  });

  it('조건 잇기', () => {
    expect(andExpr(undefined, 'a > 1')).toBe('a > 1');
    expect(andExpr('a > 1 and b', 'c or d')).toBe('a > 1 and b and (c or d)');
  });

  it('조건 주제', () => {
    expect(conditionSubject("체력 <= 0 and not has('부활')").key).toBe('var:체력');
    expect(conditionSubject("has('기록:첫사랑')").key).toBe('tag:기록:');
    expect(conditionSubject('$나이 >= 60 and chance(5)').label).toBe('나이');
    expect(conditionSubject(undefined).key).toBe('');
  });
});

describe('describeExpr', () => {
  it.each([
    ["체력 <= 0 and not has('부활')", '체력 0 이하, 부활 태그 없음'],
    ["has('직업', '어부') or item('작은배') > 0", "직업: 어부 또는 '작은 배' 보유"],
    ['$나이 >= 60 and chance(5)', '나이 60세 이상, 5% 확률'],
    ["seen('first_love')", "'first_love' 겪음"], // ID가 있으면 제목보다 먼저 쓴다
    ["tag('자식') >= 1", '자식 태그 값 1 이상'],
  ])('%s', (src, out) => expect(describeExpr(src, saltIsle)).toBe(out));
});