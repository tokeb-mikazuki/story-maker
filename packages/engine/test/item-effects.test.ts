import { describe, expect, it } from 'vitest';
import { Runner } from '../src/runner';
import type { StoryPackage } from '../src/types';
import { validatePackage } from '../src/validate';

/** 가지고 있는 동안 효과가 있는 아이템·기타 요소 */
function pkg(): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: 'test.inv', title: '소지 효과' },
    settings: {
      mode: 'story',
      calendar: { unit: 'none' },
      stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [] }],
      start: 'a',
    },
    variables: [
      { id: '돈', type: 'number', initial: 0 },
      { id: '행운', type: 'number', initial: 0 },
      { id: '기록', type: 'number', initial: 0 },
    ],
    items: [
      {
        id: '주머니',
        name: '주머니',
        modifiers: { 행운: 2 },
        onTurnEnd: [{ do: 'add', var: '돈', value: 5 }],
        onGain: [{ do: 'add', var: '기록', value: 1 }],
        onLose: [{ do: 'add', var: '기록', value: 10 }],
      },
      { id: '표식', name: '표식', category: 'other', hidden: true },
    ],
    events: [{ id: 'a', text: '시작', choices: [] }],
    endings: [],
  } as unknown as StoryPackage;
}

describe('아이템 소지 효과', () => {
  it('처음 가질 때·모두 잃을 때·매 턴 끝에 효과가 실행된다', () => {
    const r = new Runner(pkg(), { seed: 1 });
    const w = r.world;
    w.addItem('주머니', 1);
    expect(w.getVar('기록')).toBe(1);
    // 이미 가진 상태에서 더 얻어도 다시 실행되지 않는다
    w.addItem('주머니', 1);
    expect(w.getVar('기록')).toBe(1);
    expect(w.getVar('행운')).toBe(2);
    w.endTurnOnce();
    // 개수와 상관없이 한 번
    expect(w.getVar('돈')).toBe(5);
    w.addItem('주머니', -1);
    expect(w.getVar('기록')).toBe(1);
    w.addItem('주머니', -1);
    expect(w.getVar('기록')).toBe(11);
    w.endTurnOnce();
    expect(w.getVar('돈')).toBe(5);
  });

  it('기타 분류도 일반 아이템처럼 검사를 통과한다', () => {
    expect(validatePackage(pkg()).filter((i) => i.level === 'error')).toEqual([]);
  });
});
