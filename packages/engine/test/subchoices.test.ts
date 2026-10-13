import { describe, expect, it } from 'vitest';
import { MemoryMetaStore, Runner } from '../src/runner';
import type { StoryPackage } from '../src/types';
import { validatePackage } from '../src/validate';

/** 결과 안에 선택지가 이어지는 짧은 대화 */
function talk(): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: 'test.talk', title: '대화' },
    settings: {
      mode: 'story',
      calendar: { unit: 'none' },
      stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [{ type: 'events', pools: ['main'], select: 'fixedThenRandom' }] }],
      start: 'meet',
      idleEnding: { turns: 1, ending: 'bye' },
    },
    variables: [{ id: '호감', type: 'number', initial: 0 }],
    events: [
      {
        id: 'meet',
        title: '낯선 사람',
        text: '누군가 말을 건다.',
        choices: [
          {
            text: '인사한다',
            outcome: {
              text: '"안녕하세요." 상대가 웃는다.',
              do: [{ do: 'add', var: '호감', value: 1 }],
              goto: 'after',
              choices: [
                {
                  text: '이름을 묻는다',
                  check: { chance: 100 },
                  success: {
                    text: '"해솔이에요."',
                    do: [{ do: 'add', var: '호감', value: 1 }],
                    choices: [{ text: '고개를 끄덕인다', outcome: { text: '대화가 끝났다.' } }],
                  },
                  failure: {},
                },
                { text: '자리를 뜬다', outcome: { text: '돌아섰다.' } },
              ],
            },
          },
          { text: '모른 척한다', outcome: { text: '지나쳤다.' } },
        ],
      },
      { id: 'after', title: '그 뒤', text: '바람이 분다.', choices: [] },
    ],
    endings: [{ id: 'bye', title: '끝' }],
  };
}

describe('이어지는 선택지', () => {
  it('검사를 통과한다', () => {
    expect(validatePackage(talk()).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('결과 글과 함께 다음 선택지가 뜨고, 끝까지 고르면 그다음 장면으로 간다', () => {
    const r = new Runner(talk(), { seed: 1, meta: new MemoryMetaStore() });
    expect(r.scene.type === 'event' && r.scene.title).toBe('낯선 사람');
    r.choose(0);
    expect(r.scene.type).toBe('event');
    if (r.scene.type !== 'event') return;
    expect(r.scene.text).toContain('안녕하세요');
    expect(r.scene.choices.map((c) => c.text)).toEqual(['이름을 묻는다', '자리를 뜬다']);
    expect(r.state.vars['호감']).toBe(1);

    r.choose(0); // 판정 성공 → 또 이어지는 선택지
    if (r.scene.type !== 'event') throw new Error('선택지가 이어져야 함');
    expect(r.scene.text).toContain('해솔');
    expect(r.scene.notes).toContain('성공');
    expect(r.state.current).toMatchObject({ type: 'sub', path: '0:outcome/0:success' });

    // 세이브 후 이어하기
    const resumed = new Runner(talk(), { save: r.save(), meta: new MemoryMetaStore() });
    expect(resumed.scene.type === 'event' && resumed.scene.choices[0].text).toBe('고개를 끄덕인다');

    r.choose(0); // 마지막 선택지 → 결과 화면
    expect(r.scene.type).toBe('result');
    r.proceed();
    expect(r.scene.type === 'event' && r.scene.id).toBe('after');
    expect(r.state.vars['호감']).toBe(2);
  });

  it('이름을 정하지 않은 이야기는 상태창에 이름이 없다', () => {
    const r = new Runner(talk(), { seed: 1 });
    expect(r.hud().name).toBeUndefined();
    const named = talk();
    named.settings.player = { defaultName: '바다' };
    expect(new Runner(named, { seed: 1 }).hud().name).toBe('바다');
  });
});
