import { describe, expect, it } from 'vitest';
import { type ExprContext, evaluate } from '../src/expr/eval';
import { parseExpr } from '../src/expr/parser';
import { renderTemplate } from '../src/text';
import { Calendar } from '../src/calendar';
import type { Value } from '../src/types';

const ctx = (vars: Record<string, Value> = {}): ExprContext => ({
  getVar: (n) => {
    if (!(n in vars)) throw new Error(`no var ${n}`);
    return vars[n];
  },
  getSys: (n) => ({ age: 20, 이름: '김철수' })[n] ?? 0,
  call: (fn, a) => (fn === 'has' ? a[0] === '부상' : undefined),
});

describe('수식', () => {
  it('산술·우선순위·비교', () => {
    expect(evaluate('1 + 2 * 3', ctx())).toBe(7);
    expect(evaluate('(1 + 2) * 3', ctx())).toBe(9);
    expect(evaluate('10 / 0', ctx())).toBe(0);
    expect(evaluate('-체력 + 3', ctx({ 체력: 5 }))).toBe(-2);
    expect(evaluate('체력 >= 3 and 정신 < 0', ctx({ 체력: 3, 정신: -1 }))).toBe(true);
    expect(evaluate('체력 = 3', ctx({ 체력: 3 }))).toBe(true);
  });

  it('한글 연산자와 함수', () => {
    expect(evaluate("has('부상') 그리고 아님 has('건강')", ctx())).toBe(true);
    expect(evaluate('clamp(150, 0, 100)', ctx())).toBe(100);
    expect(evaluate('$age >= 20 ? "성인" : "미성년"', ctx())).toBe('성인');
    expect(evaluate("'돈: ' + fmt(1234567)", ctx())).toBe('돈: 1,234,567');
  });

  it('단락 평가: 뒤쪽 변수는 읽지 않는다', () => {
    expect(evaluate('false and 없는변수 > 0', ctx())).toBe(false);
  });

  it('문법 오류는 위치와 함께 알린다', () => {
    expect(() => parseExpr('체력 >= ')).toThrow(/덜 끝났습니다/);
    expect(() => parseExpr("has('a'")).toThrow(/'\)'/);
  });
});

describe('본문 템플릿', () => {
  const r = (src: string, vars: Record<string, Value> = {}) => renderTemplate(src, ctx(vars), () => 0);

  it('값 삽입과 조건문', () => {
    expect(r('{$이름}의 체력은 {체력}', { 체력: 7 })).toBe('김철수의 체력은 7');
    expect(r('{if 체력 < 3}위험{elif 체력 < 6}보통{else}건강{/if}', { 체력: 4 })).toBe('보통');
    expect(r('{one}가{or}나{/one}')).toBe('가');
    expect(r('{{중괄호}}')).toBe('{중괄호}');
  });

  it('조사 자동 선택', () => {
    expect(r('{$이름}{이/가} 왔다')).toBe('김철수가 왔다');
    expect(r('{직업}{을/를} 그만뒀다', { 직업: '해결사' })).toBe('해결사를 그만뒀다');
    expect(r('{직업}{은/는}', { 직업: '조직원' })).toBe('조직원은');
    expect(r('{곳}{으로/로}', { 곳: '서울' })).toBe('서울로'); // ㄹ 받침은 '로'
    expect(r('{곳}{으로/로}', { 곳: '부산' })).toBe('부산으로');
    expect(r("'{등급}'{으로/로}", { 등급: '도시의 별' })).toBe("'도시의 별'로");
    expect(r('{n}{이/가}', { n: 3 })).toBe('3이');
  });

  it('닫히지 않은 블록은 오류', () => {
    expect(() => r('{if 체력 > 1}abc', { 체력: 1 })).toThrow(/\{\/if\}/);
  });
});

describe('달력', () => {
  it('월 단위', () => {
    const c = new Calendar({ unit: 'month', start: '964.01', format: '{y}년 {m}월' });
    expect(c.format(c.parse('984.10'))).toBe('984년 10월');
    expect(c.age(c.parse('984.01'), c.parse('964.01'))).toBe(20);
    expect(c.age(c.parse('983.12'), c.parse('964.01'))).toBe(19);
  });

  it('일 단위와 시작 나이', () => {
    const c = new Calendar({ unit: 'day', start: '2024.03.01', startAge: 17 });
    expect(c.format(c.birthIndex)).toBe('2007년 3월 1일');
    expect(c.age(c.parse('2025.02.28'), c.birthIndex)).toBe(17);
    expect(c.age(c.parse('2025.03.01'), c.birthIndex)).toBe(18);
  });
});
