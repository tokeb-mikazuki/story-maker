// 새 프로젝트 템플릿. 기본 변수(체력·정신력), 기본 종료 조건, 턴 구조를 미리 채워 둔다.

import type { StoryPackage } from '@engine';
import { newId } from './files';

export function lifeTemplate(title = '새 인생 이야기'): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: newId('p_'), title, author: '', description: '', tags: ['인생'] },
    settings: {
      mode: 'life',
      calendar: { unit: 'year', start: '2000', format: '{y}년' },
      player: {},
      stages: [
        {
          id: 'child',
          name: '유년기',
          ages: [0, 12],
          turn: { length: 3, clip: true },
          phases: [
            { type: 'events', pools: ['기본'], select: 'fixed' },
            { type: 'events', pools: ['기본'], select: 'random' },
          ],
        },
        {
          id: 'youth',
          name: '청년기',
          ages: [13, 29],
          turn: { length: 2, clip: true },
          phases: [
            { type: 'events', pools: ['기본'], select: 'fixed' },
            { type: 'events', pools: ['기본'], select: 'random' },
          ],
        },
        {
          id: 'adult',
          name: '장년기',
          ages: [30, 200],
          turn: { length: 1 },
          phases: [
            { type: 'events', pools: ['기본'], select: 'fixed' },
            { type: 'menu', pool: '매년', text: '{$나이}세. 올해는 무엇에 힘을 쏟을까요?' },
            { type: 'events', pools: ['기본'], select: 'random', chance: 60 },
          ],
        },
      ],
      check: { display: 'label' },
    },
    variables: [
      { id: '체력', type: 'number', initialExpr: 'randint(7, 10)', min: 0, max: 10, integer: true, display: { as: 'bar', order: 1, notify: true } },
      { id: '정신력', type: 'number', initialExpr: 'randint(7, 10)', min: 0, max: 10, integer: true, display: { as: 'bar', order: 2, notify: true } },
      { id: '돈', type: 'number', initial: 0, display: { as: 'number', order: 3, notify: '돈 {delta}' } },
    ],
    origins: { mode: 'random', list: [] },
    events: [
      {
        id: 'birth',
        title: '탄생',
        pool: '기본',
        fixed: true,
        chokepoint: true,
        ages: [0, 0],
        text: '{$이름}{이/가} 태어났습니다.',
        record: { text: '태어났다', importance: 3 },
        choices: [],
      },
    ],
    actions: [
      { id: 'work', pool: '매년', text: '일한다', outcome: { text: '열심히 일했습니다.', do: [{ do: 'add', var: '돈', value: 100 }, { do: 'add', var: '체력', value: -1 }] } },
      { id: 'rest', pool: '매년', text: '쉰다', outcome: { text: '푹 쉬었습니다.', do: [{ do: 'add', var: '체력', value: 1 }, { do: 'add', var: '정신력', value: 1 }] } },
    ],
    triggers: [
      { id: 'aging', name: '노화', on: 'birthday', when: '$나이 >= 60', do: [{ do: 'add', var: '체력', value: -1 }] },
      { id: 'natural_death', name: '자연사', on: 'birthday', when: '$나이 >= 70 and chance(($나이 - 70) * 4 + (10 - 체력) * 2)', do: [{ do: 'end', ending: 'old_age' }] },
    ],
    endings: [
      { id: 'death', title: '사망', kind: 'death', when: '체력 <= 0', priority: 10, text: '몸이 더는 버티지 못했습니다.' },
      { id: 'breakdown', title: '마음의 붕괴', kind: 'bad', when: '정신력 <= 0', priority: 9, text: '마음이 먼저 무너졌습니다.' },
      { id: 'old_age', title: '천수', kind: 'good', text: '긴 삶을 마치고 조용히 눈을 감았습니다.' },
    ],
    epilogue: { header: '{$이름}의 이야기는 {$나이}세에 끝났습니다.', paragraphs: [] },
    achievements: [],
    assets: [],
  };
}

export function storyTemplate(title = '새 이야기'): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: newId('p_'), title, author: '', description: '', tags: ['단편'] },
    settings: {
      mode: 'story',
      calendar: { unit: 'none' },
      player: {},
      stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [{ type: 'events', pools: ['기본'], select: 'fixedThenRandom' }] }],
      start: 'start',
      idleEnding: { turns: 1, ending: 'the_end' },
      check: { display: 'label' },
    },
    variables: [
      { id: '체력', type: 'number', initial: 10, min: 0, max: 10, integer: true, display: { as: 'bar', order: 1, notify: true } },
      { id: '정신력', type: 'number', initial: 10, min: 0, max: 10, integer: true, display: { as: 'bar', order: 2, notify: true } },
    ],
    events: [
      {
        id: 'start',
        title: '시작',
        text: '이야기가 시작됩니다.',
        choices: [
          { text: '앞으로 나아간다', outcome: { goto: 'next' } },
          { text: '돌아선다', outcome: { text: '당신은 발길을 돌렸습니다.' } },
        ],
      },
      { id: 'next', title: '갈림길', text: '길이 둘로 갈라집니다.', choices: [] },
    ],
    endings: [
      { id: 'death', title: '사망', kind: 'death', when: '체력 <= 0', priority: 10 },
      { id: 'breakdown', title: '마음의 붕괴', kind: 'bad', when: '정신력 <= 0', priority: 9 },
      { id: 'the_end', title: '끝', kind: 'neutral', text: '이야기는 여기서 끝납니다.' },
    ],
    achievements: [],
    assets: [],
  };
}

export function blankTemplate(): StoryPackage {
  const p = storyTemplate('빈 프로젝트');
  p.events = [{ id: 'start', title: '시작', text: '', choices: [] }];
  return p;
}
