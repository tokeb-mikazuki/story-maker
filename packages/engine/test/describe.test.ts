import { describe, expect, it } from 'vitest';
import { Runner } from '../src/runner';
import type { StoryPackage } from '../src/types';

describe('조건 미충족 안내', () => {
  it('아이템 조건은 "보유"로, 맞지 않은 것만 보여 준다', () => {
    const pkg: StoryPackage = {
      format: 'ifb/1',
      meta: { id: 't', title: 't' },
      settings: { mode: 'story', calendar: { unit: 'none' }, stages: [{ id: 's', name: 's', turn: { length: 1 }, phases: [] }], start: 'e', idleEnding: { turns: 1, ending: 'x' } },
      variables: [{ id: '정신력', type: 'number', initial: 90 }],
      items: [{ id: '시계', name: '회색 시계' }],
      events: [{ id: 'e', text: '.', choices: [{ text: '문을 연다', requires: "정신력 >= 80 and item('시계') > 0", outcome: {} }, { text: '돌아간다', outcome: {} }] }],
      endings: [{ id: 'x', title: '끝' }],
    };
    const r = new Runner(pkg, { seed: 1 });
    if (r.scene.type !== 'event') throw new Error('event');
    expect(r.scene.choices[0].reason).toBe("필요: '회색 시계' 보유");
  });
});