import { describe, expect, it } from 'vitest';
import { MemoryMetaStore, Runner } from '../src/runner';
import { simulate } from '../src/simulate';
import type { StoryPackage } from '../src/types';
import { validatePackage } from '../src/validate';

/** 이벤트 한정형 짧은 이야기 */
function storyPackage(): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: 'test.story', title: '동굴' },
    settings: {
      mode: 'story',
      calendar: { unit: 'none' },
      stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [{ type: 'events', pools: ['main'], select: 'fixedThenRandom' }] }],
      start: 'intro',
      idleEnding: { turns: 1, ending: '귀환' },
      check: { display: 'percent' },
    },
    variables: [
      { id: '체력', type: 'number', initial: 5, min: 0, max: '최대체력', display: { as: 'bar', notify: true } },
      { id: '최대체력', type: 'number', formula: '5 + status("단련") * 2' },
      { id: '용기', type: 'number', initial: 1, min: 0, max: 5, display: { as: 'number', notify: true } },
      { id: '방문', type: 'number', initial: 0, scope: 'meta' },
    ],
    items: [{ id: '횃불', name: '횃불', modifiers: { 용기: 1 }, use: { text: '횃불을 흔들었다.', do: [{ do: 'add', var: '체력', value: 1 }] } }],
    statuses: [
      { id: '중독', name: '중독', duration: 2, onTurnEnd: [{ do: 'add', var: '체력', value: -1 }] },
      { id: '단련', name: '단련' },
    ],
    triggers: [{ id: 'visit', on: 'start', do: [{ do: 'add', var: '방문', value: 1 }] }],
    events: [
      {
        id: 'intro',
        title: '입구',
        text: '{$이름}{은/는} 동굴 앞에 섰다.',
        record: { text: '동굴에 들어갔다', importance: 5 },
        choices: [
          { text: '횃불을 줍는다', outcome: { do: [{ do: 'item', id: '횃불', count: 1 }], goto: 'fork' } },
          { text: '그냥 들어간다', outcome: { goto: 'fork' } },
        ],
      },
      {
        id: 'fork',
        text: '갈림길이다.',
        choices: [
          { text: '숨은 길', requires: "has('지도')", hidden: true, outcome: { text: '비밀 통로' } },
          { text: '용감하게 왼쪽으로', requires: '용기 >= 2', outcome: { goto: 'treasure' } },
          {
            text: '오른쪽으로',
            results: [
              { weight: 1, text: '독거미에 물렸다.', do: [{ do: 'status', id: '중독' }] },
              { weight: 1, text: '아무 일 없었다.' },
            ],
          },
          { text: '뛰어내린다', check: { chance: 100 }, success: { text: '추락했다.', do: [{ do: 'set', var: '체력', value: 0 }] }, failure: {} },
        ],
      },
      {
        id: 'treasure',
        text: '보물상자가 있다.',
        choices: [{ text: '연다', outcome: { do: [{ do: 'end', ending: '부자' }] } }],
      },
    ],
    endings: [
      { id: '사망', title: '죽음', text: '{$이름}{은/는} 돌아오지 못했다.', when: '체력 <= 0', kind: 'death' },
      { id: '귀환', title: '귀환', text: '무사히 돌아왔다.' },
      { id: '부자', title: '부자', text: '보물을 챙겼다.' },
    ],
    epilogue: { header: '결산', paragraphs: [{ id: 'p', lines: [{ when: "item('횃불') > 0", text: '횃불이 남았다.' }] }] },
    achievements: [{ id: '탐험가', title: '탐험가', when: "seen('treasure')" }],
  };
}

const choose = (r: Runner, text: string) => {
  if (r.scene.type !== 'event' && r.scene.type !== 'menu') throw new Error(`선택 화면이 아님: ${r.scene.type}`);
  const c = r.scene.choices.find((x) => x.text.includes(text));
  if (!c) throw new Error(`선택지 없음: ${text} / ${r.scene.choices.map((x) => x.text)}`);
  r.choose(c.index);
};

describe('이야기 진행', () => {
  it('패키지가 검증을 통과한다', () => {
    expect(validatePackage(storyPackage()).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('도입부 → 아이템 보정으로 선택지 해금 → 엔딩과 결산', () => {
    const meta = new MemoryMetaStore();
    const r = new Runner(storyPackage(), { seed: 1, meta });
    expect(r.scene.type).toBe('event');
    if (r.scene.type === 'event') expect(r.scene.text).toBe('당신은 동굴 앞에 섰다.');

    choose(r, '그냥');
    expect(r.scene.type).toBe('event');
    if (r.scene.type === 'event') {
      const left = r.scene.choices.find((c) => c.text.includes('왼쪽'))!;
      expect(left.enabled).toBe(false);
      expect(left.reason).toBe('필요: 용기 2 이상');
      expect(r.scene.choices.some((c) => c.text === '숨은 길')).toBe(false);
      // 직접 정한 확률은 5~95% 제한 없이 그대로 쓴다
      expect(r.scene.choices.find((c) => c.text === '뛰어내린다')!.chance).toBe('100%');
    }

    // 다시: 횃불(용기 +1)을 들면 왼쪽 길이 열린다
    const r2 = new Runner(storyPackage(), { seed: 1, meta });
    choose(r2, '횃불');
    expect(r2.scene.type).toBe('result');
    if (r2.scene.type === 'result') expect(r2.scene.notes).toContain('횃불 획득');
    r2.proceed();
    choose(r2, '왼쪽');
    choose(r2, '연다');
    expect(r2.scene.type === 'result' && r2.scene.notes).toEqual(['도전과제 달성: 탐험가']);
    r2.proceed();
    expect(r2.scene.type).toBe('end');
    if (r2.scene.type === 'end') {
      expect(r2.scene.ending.id).toBe('부자');
      expect(r2.scene.text).toBe('결산\n\n보물을 챙겼다.\n\n횃불이 남았다.');
      // 마지막 줄은 엔딩이 자동으로 붙는다. 어떤 선택지를 골라서 끝났는지는 적지 않는다
      expect(r2.scene.life.map((l) => l.text)).toEqual(['동굴에 들어갔다', '부자']);
      expect(r2.scene.achievements.map((a) => a.id)).toEqual(['탐험가']);
    }
    const saved = meta.load('test.story')!;
    expect(saved.vars['방문']).toBe(2);
    expect(saved.endings['부자']).toBe(1);
    expect('탐험가' in saved.achievements).toBe(true);
  });

  it('수치가 0이 되면 자동 엔딩', () => {
    const r = new Runner(storyPackage(), { seed: 3 });
    choose(r, '그냥');
    choose(r, '뛰어내린다');
    expect(r.scene.type).toBe('result');
    r.proceed();
    expect(r.scene.type).toBe('end');
    if (r.scene.type === 'end') {
      expect(r.scene.ending.id).toBe('사망');
      expect(r.scene.text).toContain('당신은 돌아오지 못했다.');
    }
  });

  it('더 일어날 일이 없으면 기본 엔딩', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = new Runner(storyPackage(), { seed });
      choose(r, '그냥');
      choose(r, '오른쪽');
      r.proceed();
      if (r.scene.type === 'end') {
        expect(r.scene.ending.id).toBe('귀환');
        return;
      }
    }
    throw new Error('귀환 엔딩에 도달하지 못함');
  });

  it('아이템 사용 후 같은 장면으로 돌아온다', () => {
    const r = new Runner(storyPackage(), { seed: 1 });
    choose(r, '횃불');
    r.proceed();
    expect(r.hud().items[0]).toMatchObject({ id: '횃불', usable: true });
    expect(r.useItem('횃불')).toBe(true);
    expect(r.scene.type).toBe('result');
    if (r.scene.type === 'result') expect(r.scene.text).toBe('횃불을 흔들었다.');
    r.proceed();
    expect(r.scene.type === 'event' && r.scene.id).toBe('fork');
  });

  it('세이브 후 이어하기는 같은 결과를 낸다', () => {
    const a = new Runner(storyPackage(), { seed: 7 });
    choose(a, '그냥');
    const save = JSON.parse(JSON.stringify(a.save()));
    choose(a, '오른쪽');
    const b = new Runner(storyPackage(), { save });
    expect(b.scene).toEqual(new Runner(storyPackage(), { save }).scene);
    choose(b, '오른쪽');
    expect(b.scene).toEqual(a.scene);
  });

  it('시뮬레이터', () => {
    const report = simulate(storyPackage(), { runs: 200 });
    expect(report.errors).toEqual([]);
    expect(report.stuck).toBe(0);
    expect(Object.keys(report.endings).sort()).toEqual(['귀환', '부자', '사망'].sort());
    expect(report.eventReach.intro).toBe(200);
  });
});

/** 생애형: 단계별 턴 길이, 월간 메뉴, 매월·생일 트리거, 지속 상태 */
function lifePackage(): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: 'test.life', title: '인생' },
    settings: {
      mode: 'life',
      calendar: { unit: 'month', start: '2000.01', format: '{y}년 {m}월' },
      stages: [
        { id: 'child', name: '유년기', ages: [0, 9], turn: { length: 60, clip: true }, phases: [{ type: 'events', pools: ['child'], select: 'fixedThenRandom' }] },
        {
          id: 'adult',
          name: '성인기',
          ages: [10, 200],
          turn: { length: 12 },
          phases: [
            { type: 'menu', pool: 'yearly', text: '{$나이}세. 올해는?' },
            { type: 'events', pools: ['adult'], select: 'random', chance: 50 },
          ],
        },
      ],
    },
    variables: [
      { id: '건강', type: 'number', initial: 10, min: 0, max: 10 },
      { id: '돈', type: 'number', initial: 0, display: { as: 'number', notify: '{delta}원' } },
      { id: '월수입', type: 'number', initial: 0 },
    ],
    statuses: [{ id: '감기', name: '감기', duration: 1, modifiers: { 건강: -3 } }],
    triggers: [
      { id: 'income', on: 'tick', when: "$stage == 'adult'", do: [{ do: 'add', var: '돈', value: '월수입' }] },
      { id: 'aging', on: 'birthday', when: '$age >= 40', do: [{ do: 'add', var: '건강', value: -1 }] },
    ],
    events: [
      { id: 'born', pool: 'child', fixed: true, chokepoint: true, text: '태어났다.', choices: [] },
      { id: 'cold', pool: 'adult', text: '감기에 걸렸다.', choices: [{ text: '쉰다', outcome: { do: [{ do: 'status', id: '감기' }] } }] },
    ],
    actions: [
      { id: 'work', pool: 'yearly', text: '일한다', outcome: { do: [{ do: 'set', var: '월수입', value: 100 }] } },
      { id: 'rest', pool: 'yearly', text: '쉰다', outcome: { do: [{ do: 'set', var: '월수입', value: 0 }] } },
    ],
    endings: [{ id: '노환', title: '노환', when: '건강 <= 0' }],
  };
}

describe('생애 진행', () => {
  it('검증 통과', () => {
    expect(validatePackage(lifePackage()).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('유년기는 단계 경계에서 잘리고, 성인기는 메뉴와 매월 정산', () => {
    const r = new Runner(lifePackage(), { seed: 2 });
    expect(r.scene.type === 'event' && r.scene.id).toBe('born');
    r.choose(0);
    // 0세 → 5세 → (10세 경계에서 잘림) 10세
    expect(r.scene.type).toBe('menu');
    expect(r.hud().age).toBe(10);
    if (r.scene.type === 'menu') expect(r.scene.text).toBe('10세. 올해는?');
    choose(r, '일한다');
    while (r.scene.type !== 'menu') r.scene.type === 'result' ? r.proceed() : r.choose(0);
    expect(r.hud().age).toBe(11);
    expect(r.world.getVar('돈')).toBe(1200);
  });

  it('노화로 자연사한다', () => {
    const report = simulate(lifePackage(), { runs: 50 });
    expect(report.errors).toEqual([]);
    expect(report.endings['노환']).toBe(50);
    // 건강 10에서 40세 생일부터 해마다 −1 → 49세에 0. 감기(건강 −3)가 겹치면 더 일찍
    expect(report.ages!.max).toBe(49);
    expect(report.ages!.min).toBeGreaterThanOrEqual(46);
    expect(report.chokepoints).toEqual([{ id: 'born', rate: 1 }]);
  });
});

describe('검증기', () => {
  it('없는 참조와 문법 오류를 위치와 함께 찾는다', () => {
    const pkg = storyPackage();
    pkg.events[0].choices[0].outcome!.goto = 'nowhere';
    pkg.events[1].choices[1].requires = '용기 >= ';
    pkg.events[2].choices[0].outcome!.do!.push({ do: 'add', var: '최대체력', value: 1 });
    pkg.events[2].text = "{item('검')}개";
    const issues = validatePackage(pkg).filter((i) => i.level === 'error');
    expect(issues.map((i) => i.path)).toEqual([
      'events/intro/choices/0/outcome',
      'events/fork/choices/1',
      'events/treasure',
      'events/treasure/choices/0/outcome/do/1',
    ]);
    expect(issues[0].message).toContain("'nowhere'");
    expect(issues[3].message).toContain('파생 변수');
  });
});
