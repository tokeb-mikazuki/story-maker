// 샘플 ③ 이야기형 — 「재의 도시, 반달 전당포」 (오리지널)
// 해가 사라진 도시 아슈렐. 가스등은 사람들이 맡긴 그림자를 태워 빛을 낸다. 전당포 점원으로 보내는 열두 밤.
// 보여 주는 기능: 출신 선택(메타 해금 포함)과 이름 묻기, 밤마다 도는 단계 구성(고정 장면 → 손님 → 사건 → 밤일과 메뉴),
// 고정 이벤트·초크포인트, 이어지는 선택지(대화 사슬), 판정·확률 결과, 숨은/조건부 선택지, 반복되는 상점(goto),
// 인벤토리의 세 종류 — 아이템(사용·보정), 상태(지속 턴·중첩·턴 끝 효과), 기타(이자 장부·낙인: 숨김 + 소지 효과),
// 아이템의 소지 효과(처음 얻을 때·매 턴 끝·잃을 때), 스크립트(매개변수·let), 표 조회, 감시 규칙(위기 이벤트),
// 세력 평판에 따른 분기, 여러 갈래의 엔딩, 조건부 결산, 인생표, 도전과제(출신 해금), 일러스트, 용어 바꾸기·테마.

import type { Command, StoryPackage } from '@engine';

// ───────────────────────── 일러스트(SVG) ─────────────────────────

const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 220">${body}</svg>`)}`;

const SKY = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17131d"/><stop offset="1" stop-color="#2d2230"/></linearGradient></defs><rect width="480" height="220" fill="url(#g)"/>`;
const ASH = Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 97) % 480}" cy="${(i * 53) % 200}" r="${1 + (i % 3) * 0.6}" fill="#cfc6bb" opacity="0.35"/>`).join('');

const IMG_SHOP = svg(`${SKY}${ASH}
<path d="M300 40a46 46 0 1 0 0 92a36 36 0 1 1 0-92z" fill="#e8c777"/>
<rect x="0" y="150" width="480" height="70" fill="#0e0b12"/>
<path d="M40 150v-60l30-18l30 18v60zM110 150v-90h50v90zM330 150v-70l35-22l35 22v70z" fill="#1a1520"/>
<rect x="206" y="104" width="76" height="116" fill="#241b27"/><rect x="220" y="122" width="22" height="30" fill="#f1b45b" opacity="0.9"/>
<path d="M255 168a14 14 0 1 0 0 28z" fill="#e8c777"/>`);

const IMG_LAMP = svg(`${SKY}${ASH}
<defs><radialGradient id="l"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
<circle cx="240" cy="78" r="86" fill="url(#l)"/>
<rect x="234" y="92" width="12" height="120" fill="#0e0b12"/><rect x="220" y="204" width="40" height="16" fill="#0e0b12"/>
<rect x="226" y="58" width="28" height="36" rx="4" fill="#ffd27a"/><path d="M222 58h36l-6-14h-24z" fill="#0e0b12"/>
<path d="M232 212c30 0 70 6 110 0" stroke="#0e0b12" stroke-width="3" fill="none"/>`);

const IMG_CELLAR = svg(`<rect width="480" height="220" fill="#0d0b11"/>
<g stroke="#2c2530" stroke-width="5"><path d="M30 60h420M30 120h420M30 180h420"/></g>
${[0, 1, 2].map((r) => Array.from({ length: 11 }, (_, c) => `<rect x="${44 + c * 38}" y="${28 + r * 60}" width="14" height="28" rx="4" fill="#9bb9d6" opacity="${0.35 + ((c * 7 + r * 3) % 5) * 0.12}"/>`).join('')).join('')}
<path d="M0 0h480v220H0z" fill="none"/>`);

const IMG_SQUARE = svg(`${SKY}${ASH}
<defs><radialGradient id="b"><stop offset="0" stop-color="#ffe3a0"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></radialGradient></defs>
<circle cx="240" cy="96" r="120" fill="url(#b)" opacity="0.8"/>
<path d="M0 170h480v50H0z" fill="#0c0a0f"/>
<path d="M70 170v-70h22v70zM120 170v-110h26v110zM340 170v-100h28v100zM395 170v-60h24v60z" fill="#150f18"/>
<rect x="228" y="60" width="24" height="110" fill="#0c0a0f"/><circle cx="240" cy="54" r="22" fill="#ffd27a"/>
<path d="M210 176c-14 0-14-14 0-14M270 176c14 0 14-14 0-14" stroke="#0c0a0f" stroke-width="3" fill="none"/>`);

// ───────────────────────── 명령 줄임 ─────────────────────────

const add = (v: string, n: number | string): Command => ({ do: 'add', var: v, value: n });
const set = (v: string, n: number | string | boolean): Command => ({ do: 'set', var: v, value: n });
const tag = (key: string, value?: string | number): Command => (value === undefined ? { do: 'tag', key } : { do: 'tag', key, value });
const item = (id: string, count = 1, silent = false): Command => (silent ? { do: 'item', id, count, silent } : { do: 'item', id, count });
const on = (id: string, duration?: number): Command => (duration === undefined ? { do: 'status', id } : { do: 'status', id, duration });
const off = (id: string): Command => ({ do: 'status', id, remove: true });
const note = (text: string): Command => ({ do: 'note', text });
const rec = (text: string, importance = 3): Command => ({ do: 'record', text, importance });
const end = (ending: string): Command => ({ do: 'end', ending });
const call = (script: string, args?: Record<string, number | string>): Command => ({ do: 'call', script, args });
const achieve = (id: string): Command => ({ do: 'achieve', id });

export const ashPawn: StoryPackage = {
  format: 'ifb/1',
  meta: {
    id: 'sample:ash-pawn',
    title: '재의 도시, 반달 전당포',
    author: '이야기 공방 샘플',
    version: '1.0',
    description:
      '해가 사라진 도시 아슈렐. 가스등은 사람들이 맡긴 그림자를 태워 빛을 냅니다. 당신은 무두질 골목 막다른 곳, 전당포 〈반달〉의 새 점원입니다. 열두 밤 동안 맡겨진 것들을 감정하고, 누구를 믿을지 정하고, 마지막 밤 도시의 대등불 앞에 섭니다. (30~40분)',
    tags: ['장편', '샘플', '다크 판타지', '어반'],
  },
  settings: {
    mode: 'story',
    calendar: { unit: 'none' },
    player: { askName: true, defaultName: '새 점원' },
    stages: [
      {
        id: 'night',
        name: '밤',
        turn: { length: 1 },
        phases: [
          { type: 'events', pools: ['주요'], select: 'fixed' },
          { type: 'events', pools: ['손님'], select: 'random', chance: 85 },
          { type: 'events', pools: ['사건'], select: 'random', chance: 45 },
          {
            type: 'menu',
            pool: '밤일과',
            title: '문 닫기 전',
            text: '{밤}번째 밤. {if 밤 >= 10}도시 전체가 숨을 죽이고 있습니다.{else}창밖에서 가스등이 깜빡입니다.{/if} 문을 닫기 전에 무엇을 할까요?',
          },
        ],
      },
    ],
    start: 'arrive',
    idleEnding: { turns: 3, ending: 'dawn' },
    maxTurns: { turns: 16, ending: 'dawn' },
    check: { formula: '45 + 12 * ($skill - $difficulty) + (이성 - 4) * 2 + $bonus', min: 5, max: 95, display: 'both' },
    scheduler: { defaultWeight: 10, groupBlock: 1, toneBalance: { window: 4, threshold: 3, factor: 0.5 } },
    ui: {
      continueText: '계속',
      // 어두운 판 — 플레이 화면의 색을 바꾼다
      theme: { '--paper': '#17131c', '--ink': '#e7dfd0', '--panel': '#211c27', '--line': '#3b3243', '--muted': '#9b91a4', '--accent': '#d19a4a' },
      // 플레이 화면에 보이는 이름
      terms: { inventory: '가방', items: '소지품', statuses: '몸과 마음', use: '꺼낸다' },
    },
  },

  variables: [
    { id: '밤', name: '열두 밤 중', type: 'number', initial: 0, min: 0, integer: true, display: { as: 'number', order: 0, format: '{value}번째' } },
    { id: '체력', type: 'number', initial: 8, min: 0, max: 8, integer: true, display: { as: 'bar', order: 1, notify: true, icon: '❤', color: '#b9503f' } },
    { id: '이성', type: 'number', initial: 6, min: 0, max: 8, integer: true, display: { as: 'bar', order: 2, notify: true, icon: '✦', color: '#7a68b5' }, description: '0이 되면 벽 너머의 목소리가 이긴다' },
    { id: '그림자', type: 'number', initial: 5, min: 0, max: 5, integer: true, display: { as: 'bar', order: 3, notify: '그림자 {delta}', icon: '◐', color: '#6f8fb0', labels: [{ upTo: 0, text: '없음' }, { upTo: 2, text: '희미함' }, { upTo: 5, text: '' }] }, description: '0이 되면 사람이 아니게 된다' },
    { id: '은화', type: 'number', initial: 20, min: 0, integer: true, display: { as: 'number', order: 4, notify: '{delta}은화', icon: '◎' } },
    { id: '빚', type: 'number', initial: 0, min: 0, integer: true, display: { as: 'number', order: 5, notify: '빚 {delta}', icon: '✒' }, description: '이자 장부가 매 밤 1씩 불린다. 20이 되면 압류' },
    { id: '감정', type: 'number', initialExpr: 'randint(1, 2)', min: 0, max: 5, integer: true, group: '재주', display: { as: 'number', order: 10, notify: true } },
    { id: '언변', type: 'number', initialExpr: 'randint(1, 2)', min: 0, max: 5, integer: true, group: '재주', display: { as: 'number', order: 11, notify: true } },
    { id: '담력', type: 'number', initialExpr: 'randint(1, 2)', min: 0, max: 5, integer: true, group: '재주', display: { as: 'number', order: 12, notify: true } },
    {
      id: '교단',
      name: '성광회',
      type: 'number',
      initial: 0,
      min: -5,
      max: 5,
      integer: true,
      display: { as: 'text', order: 20, labels: [{ upTo: -3, text: '적대' }, { upTo: 0, text: '경계' }, { upTo: 2, text: '무관심' }, { upTo: 5, text: '호의' }] },
    },
    {
      id: '쥐굴',
      name: '쥐굴 조합',
      type: 'number',
      initial: 0,
      min: -5,
      max: 5,
      integer: true,
      display: { as: 'text', order: 21, labels: [{ upTo: -3, text: '적대' }, { upTo: 0, text: '경계' }, { upTo: 2, text: '무관심' }, { upTo: 5, text: '호의' }] },
    },
    {
      id: '야회',
      name: '붉은 야회',
      type: 'number',
      initial: 0,
      min: -5,
      max: 5,
      integer: true,
      display: { as: 'text', order: 22, labels: [{ upTo: -3, text: '적대' }, { upTo: 0, text: '경계' }, { upTo: 2, text: '무관심' }, { upTo: 5, text: '호의' }] },
    },
    { id: '진실', type: 'number', initial: 0, min: 0, max: 8, integer: true, description: '모은 단서 수(숨김)' },
    { id: '도시점수', type: 'number', formula: "진실 * 2 + floor(은화 / 40) + 그림자 + (has('자비') ? 3 : 0) - floor(빚 / 5)" },
    { id: '방문횟수', type: 'number', initial: 0, scope: 'meta', description: '회차 수(메타)' },
  ],

  tables: [
    {
      id: '도시의기억',
      name: '결산: 도시가 당신을 기억하는 방식',
      match: 'range',
      columns: ['문구'],
      rows: [
        { key: 2, values: { 문구: '반달 전당포의 장부에는 당신 이름이 한 줄도 남지 않았습니다. 재가 모든 것을 덮었습니다.' } },
        { key: 8, values: { 문구: '무두질 골목 사람들은 이따금 당신을 떠올렸습니다. "그 점원은, 적어도 규칙은 지켰지."' } },
        { key: 14, values: { 문구: '아슈렐의 등불 아래 사람들은 당신 이야기를 낮게 주고받았습니다. 누가 들으면 안 되는 이야기처럼, 그러나 잊히지 않게.' } },
      ],
      fallback: { 문구: '열두 밤은 도시의 전설이 되었습니다. 골목 아이들은 그림자놀이를 할 때마다 당신 이름을 불렀습니다.' },
    },
    {
      id: '시세',
      name: '전당물 시세',
      match: 'exact',
      columns: ['값'],
      rows: [
        { key: '반지', values: { 값: 45 } },
        { key: '악기', values: { 값: 18 } },
        { key: '시계', values: { 값: 30 } },
      ],
      fallback: { 값: 5 },
    },
  ],

  scripts: [
    {
      id: '그림자저당',
      name: '그림자를 저당 잡히다',
      params: ['수량'],
      do: [
        add('그림자', '-$수량'),
        add('은화', '$수량 * 25'),
        tag('저당', '$수량'),
        note('그림자가 얇아졌습니다. 가스등 아래에서 발밑이 한 뼘 비어 보입니다.'),
        { do: 'if', cond: '그림자 <= 1', then: [add('이성', -1)] },
      ],
    },
    {
      id: '습격',
      name: '골목의 것들과 맞서다',
      params: ['위력'],
      do: [
        {
          do: 'check',
          check: { skill: '담력', difficulty: '$위력', bonus: "item('은단검') > 0 ? 10 : 0" },
          success: [note('칼날이 먼저 닿았습니다. 그늘이 비명도 없이 흩어졌습니다.'), add('은화', 8)],
          failure: [add('체력', -1), on('부상')],
        },
      ],
    },
    {
      id: '빚갚기',
      name: '가진 만큼 빚을 갚다',
      do: [
        { do: 'let', name: '갚을돈', value: 'min(빚, 은화, 20)' },
        add('빚', '-$갚을돈'),
        add('은화', '-$갚을돈'),
        { do: 'if', cond: '빚 = 0', then: [note('장부의 숫자가 지워졌습니다. 이자 장부가 잠시 조용합니다.')] },
      ],
    },
  ],

  items: [
    { id: '은단검', name: '은 단검', icon: '🗡', description: '그늘에 사는 것들은 은을 싫어한다. 담력 +1', max: 1, modifiers: { 담력: 1 } },
    {
      id: '성수병',
      name: '성수병',
      icon: '🧪',
      description: '성광회가 축성한 물. 마시면 마음이 맑아진다.',
      max: 3,
      use: { consume: true, text: '차갑고 쇳내 나는 물이 목을 타고 내려갔습니다. 벽 너머의 소리가 한 걸음 물러났습니다.', do: [add('이성', 2), off('속삭임')] },
    },
    {
      id: '붕대',
      name: '약초 붕대',
      icon: '🩹',
      description: '쑥과 재를 이겨 바른 붕대.',
      max: 3,
      use: { consume: true, text: '이를 악물고 붕대를 감았습니다. 쓰라림이 가라앉습니다.', do: [add('체력', 3), off('부상')] },
    },
    {
      id: '손등불',
      name: '손등불',
      icon: '🏮',
      description: '손바닥만 한 가스 램프. 켜 두면 어둠 속에서 마음이 덜 흔들린다. 담력 +1',
      max: 1,
      modifiers: { 담력: 1 },
      // 소지 효과: 가지고 있는 동안 매 턴 끝에
      onTurnEnd: [{ do: 'if', cond: '이성 <= 3', then: [add('이성', 1), note('손등불이 따뜻하게 흔들렸습니다. 숨이 조금 고릅니다.')] }],
    },
    {
      id: '뼈열쇠',
      name: '뼈 열쇠',
      icon: '🗝',
      description: '선대 점원이 목에 걸고 다니던 열쇠. 가끔 속삭인다. 감정 +1',
      max: 1,
      modifiers: { 감정: 1 },
      // 소지 효과: 처음 얻을 때 · 매 턴 끝에 · 잃을 때
      onGain: [add('이성', -1), note('열쇠가 손바닥 안에서 따뜻해졌습니다. 누군가 이름을 부른 것 같았습니다.')],
      onTurnEnd: [{ do: 'if', cond: 'chance(20)', then: [add('이성', -1), note('열쇠가 몸을 떨었습니다. 지하에서 무언가 대답했습니다.')] }],
      onLose: [note('열쇠가 사라지자 목덜미가 서늘해졌습니다. 오래 묶여 있던 것이 풀린 느낌.')],
    },
    {
      id: '그림자병',
      name: '그림자 병',
      icon: '🫙',
      description: '맡겨진 누군가의 그림자가 안에서 일렁인다. 마시면 내 그림자가 짙어진다. 돌려줄 수도 있다.',
      max: 3,
      use: { consume: true, text: '병마개를 열자 그림자가 숨결처럼 빠져나와 당신 발밑에 스몄습니다. 낯선 기억 한 조각이 함께 따라왔습니다.', do: [add('그림자', 1), add('이성', -1)] },
    },
    { id: '초대장', name: '붉은 초대장', icon: '✉', description: '핏빛 봉랍이 찍힌 야회의 초대장. 한 사람만 들어갈 수 있다.', max: 1 },
    // 기타: 화면에 드러나지 않고, 가지고 있는 동안의 효과만 조용히 적용된다
    {
      id: '장부',
      name: '이자 장부',
      category: 'other',
      hidden: true,
      description: '반달 전당포의 장부. 빚이 있는 밤마다 숫자를 한 줄씩 불린다.',
      onTurnEnd: [{ do: 'if', cond: '빚 > 0', then: [add('빚', 1)] }],
    },
    {
      id: '낙인',
      name: '성광회의 낙인',
      category: 'other',
      hidden: true,
      description: '쇄골 아래의 화인. 성광회의 보호를 받는 대신 마음이 한결 단단해진다.',
      modifiers: { 이성: 1 },
      onGain: [rec('성광회의 낙인을 받았다', 4)],
    },
  ],

  statuses: [
    {
      id: '속삭임',
      name: '벽 너머의 속삭임',
      icon: '👂',
      tone: 'negative',
      duration: 3,
      description: '턴이 끝날 때마다 이성 −1, 언변 −1',
      modifiers: { 언변: -1 },
      onTurnEnd: [add('이성', -1)],
    },
    { id: '부상', name: '다친 몸', icon: '🩸', tone: 'negative', duration: 3, description: '담력 −1', modifiers: { 담력: -1 } },
    {
      id: '추적',
      name: '쫓기는 중',
      icon: '👣',
      tone: 'negative',
      description: '풀릴 때까지 매 밤 30% 확률로 체력 −1',
      onApply: [note('등 뒤의 발소리가 당신 걸음에 맞춰 멈춥니다.')],
      onTurnEnd: [{ do: 'if', cond: 'chance(30)', then: [add('체력', -1), note('그림자 같은 누군가가 문틈으로 손을 넣었다 뺐습니다.')] }],
    },
    {
      id: '재열',
      name: '재열(灰熱)',
      icon: '🔥',
      tone: 'positive',
      duration: 4,
      description: '담력 +1, 언변 +1. 붉은 야회의 잔 속에 있던 것',
      modifiers: { 담력: 1, 언변: 1 },
      onExpire: [note('몸속의 열기가 식었습니다. 대신 갈증이 남았습니다.')],
    },
    {
      id: '그늘',
      name: '그늘 물듦',
      icon: '🌑',
      tone: 'negative',
      duration: 4,
      maxStacks: 3,
      description: '겹칠수록 담력이 깎인다(겹침 수만큼 −1)',
      modifiers: { 담력: -1 },
    },
  ],

  origins: {
    mode: 'choose',
    offer: 3,
    title: '재의 도시에 도착하기 전, 당신은',
    text: '아슈렐. 해가 사라진 지 이백 년이 넘은 도시. 하늘 자리에는 연기 천장이 내려앉아 있고, 사람들은 그 아래에서 가스등을 세고 하루를 셉니다.',
    list: [
      {
        id: 'rat',
        title: '쥐굴의 아이',
        summary: '하수로 아래, 조합의 장부에 이름이 있던',
        text: '당신은 도시 밑 하수로의 쥐굴에서 자랐습니다. 빛이 닿지 않는 곳에서는 소리가 눈입니다. 조합 어른들은 당신에게 열쇠 따는 법과 입 다무는 법을 가르쳤습니다.',
        do: [add('담력', 1), add('쥐굴', 2), add('은화', 10), tag('출신', "'쥐굴'"), item('은단검', 1, true)],
      },
      {
        id: 'ruin',
        title: '재가 된 가문의 후손',
        summary: '문장은 남았고 재산은 남지 않은',
        text: '당신 가문의 저택은 세 번 불탔고 세 번 되팔렸습니다. 남은 것은 문장 반지와 몇 장의 어음, 그리고 야회 사람들이 아직 당신 성을 기억한다는 사실뿐입니다.',
        do: [add('언변', 1), add('야회', 2), add('은화', 40), add('빚', 6), tag('출신', "'몰락귀족'"), item('초대장', 1, true)],
      },
      {
        id: 'novice',
        title: '파문당한 수련 사제',
        summary: '성광회에서 쫓겨난, 낙인이 아직 가려운',
        text: '당신은 성광회 수도원에서 빛의 교리를 외우며 컸습니다. 어느 밤 어떤 질문을 했고, 다음 날 아침 문이 닫혔습니다. 낙인은 쇄골 아래에 남았습니다.',
        do: [add('이성', 1), add('교단', 2), tag('출신', "'수련사제'"), item('성수병', 1, true), item('낙인', 1, true)],
      },
      {
        id: 'beyond',
        title: '재 너머에서 온 사람',
        summary: '(해금) 한 번 이 도시를 지나간 이의 후손',
        unlock: "achieved('반달의점원')",
        text: '당신은 연기 천장 너머, 아직 해가 있다는 땅에서 왔습니다. 도시 사람들은 당신의 발밑을 한 번씩 훔쳐봅니다. 그림자가 너무 선명하다는 듯이.',
        do: [add('감정', 2), tag('출신', "'재너머'"), item('손등불', 1, true)],
      },
    ],
  },

  events: [
    // ───────────── 프롤로그 ─────────────
    {
      id: 'arrive',
      title: '반쪽 달',
      text: '재가 내립니다. 하늘 대신 도시를 덮은 연기 천장 아래로, 눈송이 같은 재가 가스등 불빛을 가로질러 떨어집니다. 아슈렐에서는 이것을 \'낮\'이라고 부릅니다.\n{image shop}\n{if has(\'출신\', \'쥐굴\')}하수로의 비릿한 냄새가 여기까지 따라옵니다.{elif has(\'출신\', \'몰락귀족\')}가문의 문장이 박힌 외투 깃이 재에 젖어 무겁습니다.{elif has(\'출신\', \'수련사제\')}쇄골 아래 낙인이 이 도시의 습기에 가렵습니다.{else}지나가는 사람마다 당신의 발밑을 흘끔 봅니다. 그림자가 너무 선명하다는 듯이.{/if}\n무두질 골목 막다른 곳, 문패 없는 가게. 유리창에 반쪽짜리 달이 그려져 있습니다. 전당포 〈반달〉.',
      record: { text: '반달 전당포의 점원이 되었다', importance: 3 },
      choices: [
        {
          text: '문을 열고 들어간다',
          outcome: {
            text: '문종이 한 번 울렸습니다. 카운터 뒤에서 등이 굽은 노파가 안경 너머로 당신을 올려다봅니다. 손가락마다 반지 자국이 하얗게 남아 있습니다.\n"새 점원이로군. 이름이…" 노파가 장부를 넘깁니다. "{$이름}{이라/라}고. 앉게, {$이름}{아/야}. 오르다 마드, 이 가게의 주인이야. 규칙은 세 개뿐이지."',
            choices: [
              {
                text: '규칙을 듣는다',
                outcome: {
                  text: '"하나. 맡긴 것은 맡긴 사람의 것이다. 기한이 차기 전에는 누구에게도 넘기지 않는다.\n둘. 이름은 받지 않는다. 이름을 받은 가게는 사람을 잃는다.\n셋. 달이 반쪽일 때는 문을 닫는다. 무슨 소리가 나도 열지 않는다." 노파가 손가락 세 개를 접었습니다. "저 달은 늘 반쪽이야. 무슨 뜻인지는 알겠지."',
                  do: [tag('규칙')],
                  choices: [
                    {
                      text: '"전임자는 어디 갔습니까?"',
                      outcome: {
                        text: '노파의 손이 잠깐 멈췄습니다. "이안? 그 애는… 맡겼어." "무엇을요?" "다 맡겼지." 노파는 대답을 거기서 끊고 장부를 덮었습니다. 안경 렌즈에 가스등이 두 번 흔들렸습니다.',
                        do: [add('진실', 1), tag('단서:이안')],
                      },
                    },
                    { text: '"알겠습니다."', outcome: { text: '노파가 고개를 끄덕였습니다. "눈치가 빠르니 오래 가겠군. 아니면 일찍 끝나거나."' } },
                  ],
                },
              },
              { text: '가게부터 둘러본다', outcome: { text: '선반마다 이름표가 달린 물건들이 먼지 속에서 숨을 죽이고 있습니다. 시계, 악기, 아이 신발, 그리고 병에 담긴 무언가.\n"만지지는 말게." 노파가 뒤에서 말했습니다. "맡긴 이들이 아직 안에 있으니까." 어느 병 속에서 무언가 몸을 돌렸습니다.', do: [add('이성', -1)] } },
            ],
          },
        },
      ],
    },

    // ───────────── 고정 사건: 열두 밤의 뼈대 ─────────────
    {
      id: 'ledger',
      title: '찢긴 장부',
      pool: '주요',
      fixed: true,
      chokepoint: true,
      priority: 5,
      when: '밤 >= 1',
      text: '첫 밤. 노파가 잠든 뒤 당신은 장부를 펼쳤습니다. 선대 점원 이안의 필체는 마지막 쪽에 가까워질수록 흔들립니다. 맨 뒤 석 장은 칼로 도려낸 듯 찢겼고, 책등 안쪽에는 무언가 눌려 있습니다.',
      record: { text: '찢긴 장부에서 전임자의 흔적을 찾았다', importance: 3 },
      choices: [
        {
          text: '찢긴 자국을 감정한다',
          check: { skill: '감정', difficulty: 2 },
          success: { text: '눌린 글씨가 빛 아래서 살아났습니다. "마지막 저당물 — 이름 없음. 맡긴 이 — 오르다 마드." 그 아래 한 줄. "기한은 열두 번째 밤."\n등골이 서늘해졌습니다. 이 장부에서 \'맡긴 이\'는 손님이 아니라 주인이었습니다.', do: [add('진실', 2), tag('단서:장부')] },
          failure: { text: '글씨를 따라가는데, 눌린 자국이 움직였습니다. 아니, 움직인다고 믿고 싶지 않았습니다. 잉크가 거미 다리처럼 책장을 기어 올라왔습니다.', do: [add('이성', -1), on('속삭임')] },
        },
        { text: '책등 안쪽을 더듬는다', outcome: { text: '가죽 안쪽에서 뼈로 깎은 열쇠 하나가 굴러 나왔습니다. 이빨 자국처럼 오톨도톨한 날. 이안이 목에 걸고 다니던 것이라는 걸, 어째서인지 알 수 있었습니다.', do: [item('뼈열쇠'), add('진실', 1), tag('단서:열쇠')] } },
        { text: '못 본 척 덮고 장부 정리만 한다', outcome: { text: '보지 않는 편이 안전한 것도 있습니다. 장부의 숫자만 가지런히 맞추자 노파가 아침에 은화 몇 닢을 던져 주었습니다.', do: [add('은화', 8)] } },
      ],
    },
    {
      id: 'inspector',
      title: '등불세',
      pool: '주요',
      fixed: true,
      priority: 4,
      when: '밤 >= 3',
      text: '낮은 종소리가 세 번. 성광회의 흰 사제복이 문턱을 넘었습니다. 은빛 인장 반지를 낀 세무 사제 베르나가 장부를 내밀었습니다.\n"등불세입니다. 이 가게는 석 달째 밀렸군요. 은화 서른, 혹은 그림자 하나. 도시의 불은 공짜로 켜지지 않으니까요." 사제는 당신의 발밑을 한 번, 아주 오래 보았습니다.',
      record: { text: '성광회의 등불세 징수를 맞았다', importance: 3 },
      choices: [
        { text: '은화 서른을 낸다', requires: '은화 >= 30', outcome: { text: '은화가 쟁반 위에서 맑은 소리를 냈습니다. 베르나는 만족스러운 얼굴로 인장을 찍었습니다. "빛은 성실한 자를 기억합니다."', do: [add('은화', -30), add('교단', 1)] } },
        { text: '그림자 하나를 바친다', requires: '그림자 >= 3', outcome: { text: '바닥에 드리운 그림자가 사제의 은 가위 아래서 한 겹 벗겨졌습니다. 아프지 않았습니다. 그게 가장 무서웠습니다.', do: [add('그림자', -1), add('교단', 2), tag('바침')], } },
        {
          text: '"규정 몇 조에 따른 세금입니까?"',
          check: { skill: '언변', difficulty: 2 },
          success: { text: '사제의 입꼬리가 한쪽만 올라갔습니다. "…이 가게의 점원은 글을 읽는군요. 이번 달은 유예합시다." 인장이 장부 모서리에만 찍혔습니다.', do: [add('교단', -1), add('진실', 1), tag('단서:세')] },
          failure: { text: '"성광회의 규정을 묻는 것은 성광회를 묻는 것입니다." 사제가 짧게 말했습니다. 은화 열다섯이 쟁반으로 끌려갔고, 당신의 이름이 어딘가 적혔습니다.', do: [add('은화', -15), add('교단', -1)] },
        },
        {
          text: '낙인을 받고 보호를 청한다',
          requires: "item('낙인') = 0",
          outcome: { text: '쇄골 아래 살갗이 은 도장 아래서 지글거렸습니다. 베르나가 낮게 성가를 읊었습니다. "이제 당신은 빛의 장부에 올랐습니다. 빛은 때로 놓지 않습니다."', do: [item('낙인', 1, true), add('교단', 3), add('체력', -1)] },
        },
      ],
    },
    {
      id: 'rat_king',
      title: '쥐왕의 부탁',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 4',
      text: '선반 뒤 벽이 열렸습니다. 쥐굴 조합의 우두머리 \'쥐왕\' 하이가 젖은 외투를 털며 들어왔습니다. 몸집은 어린아이 같고 눈빛은 늙었습니다.\n"점원 양반, 야경대가 압수한 시계가 이 가게 창고에 들어와 있을 거요. 그걸 나흘 안에 우리 손으로 돌려주쇼. 값은 쳐 드리지." 하이가 손가락 두 개를 폈습니다. "그리고 뼈 열쇠가 어디 맞는 자물쇠인지, 우린 알지."',
      record: { text: '쥐굴의 우두머리가 가게를 찾아왔다', importance: 3 },
      choices: [
        { text: '시계를 몰래 넘긴다', outcome: { text: '진열장 뒤에서 시계를 꺼내 쥐왕의 소매에 밀어 넣었습니다. 하이가 이빨 빠진 웃음을 지었습니다. "하수로 지도도 한 장 얹어 드리지. 반달 아래, 지하로 통하는 길이오."', do: [add('쥐굴', 3), add('교단', -1), add('은화', 25), tag('하수길')] } },
        {
          text: '값을 올려 흥정한다',
          check: { skill: '언변', difficulty: 2 },
          success: { text: '하이가 눈을 가늘게 떴다가 낄낄 웃었습니다. "이 점원 물건이군." 은화 주머니가 두 배로 묵직해졌습니다.', do: [add('쥐굴', 1), add('은화', '30 + 언변 * 5'), tag('하수길')] },
          failure: { text: '"탐욕은 쥐굴에서도 미움받소." 하이가 일어났습니다. 문 닫히는 소리와 함께 누군가 당신의 이름을 벽에 긁었습니다.', do: [add('쥐굴', -1), on('추적')] },
        },
        { text: '"가게의 규칙입니다. 맡긴 것은 넘기지 않습니다."', outcome: { text: '하이는 한동안 말이 없었습니다. "규칙이라. 좋은 단어지. 오래 못 가는 단어이기도 하고." 쥐왕은 오지 않은 사람처럼 벽 속으로 사라졌습니다.', do: [add('쥐굴', -2), add('교단', 1), add('진실', 1), tag('단서:규칙')] } },
      ],
    },
    {
      id: 'masked_lady',
      title: '가면 쓴 손님',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 5',
      text: '비단 가면에 진주 눈물이 달린 여인이 장갑 낀 손으로 반지 하나를 올려놓았습니다. 달빛 같은 청보석이 박힌 반지. {tag(\'소문\', \'어디선가\')}에서 본 적 있는 세공입니다.\n"감정해 줘요. 그리고 이 반지에 새겨진 이름을 지워 줘요. 값은 후하게." 여인의 목소리는 웃는 것도 우는 것도 아니었습니다.',
      record: { text: '가면 쓴 여인이 이름이 새겨진 반지를 맡기려 했다', importance: 3 },
      choices: [
        {
          text: '반지를 감정한다',
          check: { skill: '감정', difficulty: 2 },
          success: { text: '청보석 뒷면에 아주 작은 문장이 있었습니다. 붉은 야회의 마크. 이 반지의 주인은 야회의 후작이었습니다. 시세는 {lookup(\'시세\', \'반지\', \'값\')}은화, 하지만 이름이 지워진 반지는 그 열 배.\n여인이 가면 아래에서 웃었습니다. "눈이 좋군요." 핏빛 봉랍이 찍힌 초대장이 카운터 위에 놓였습니다. "내일모레 밤, 야회에서 뵙죠."', do: [item('초대장', 1, true), add('야회', 2), add('진실', 1), tag('단서:반지')] },
          failure: { text: '보석을 들여다보는 순간 보석이 당신을 들여다보았습니다. 눈을 뗄 때는 이미 이마에 식은땀이 흘렀습니다. 여인은 아무 말 없이 반지를 도로 가져갔습니다.', do: [add('이성', -2), add('야회', -1)] },
        },
        { text: '이름 지우기를 거절한다 (규칙 2)', outcome: { text: '"이름은 받지 않는 것이 이 가게의 규칙입니다." 여인은 가면 속에서 오래 숨을 골랐습니다. "그 규칙, 누가 정했는지 아세요?" 그리고 그녀는 대답을 기다리지 않고 나갔습니다.', do: [add('야회', -1), add('교단', 1), tag('단서:규칙')] } },
        { text: '이름을 지우고 보수를 받는다', outcome: { text: '지우개로 지울 수 있는 것이 아니었습니다. 당신은 자기 이름의 한 글자를 대신 내주었습니다. 그림자가 한 겹 가벼워졌습니다. 은화 주머니는 무거웠습니다.', do: [add('은화', 80), add('그림자', -1), add('야회', 2), item('초대장', 1, true), tag('이름팔림')] } },
      ],
    },
    {
      id: 'cellar',
      title: '지하 창고',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 6',
      text: '카운터 뒤, 낡은 양탄자 아래에 철문이 있었습니다. 문 한가운데에 뼈 열쇠와 똑같은 모양의 구멍.\n문틈에서 푸른 빛이 샙니다. 지하에서 올라오는 냉기가 발목을 휘감았습니다. 노파의 코고는 소리가 위층에서 규칙적으로 들립니다.',
      record: { text: '전당포 지하에 내려갔다', importance: 4 },
      choices: [
        { text: '뼈 열쇠로 문을 연다', requires: "item('뼈열쇠') > 0", outcome: { goto: 'cellar_inside', do: [add('이성', -1)] } },
        { text: '하수로 길로 돌아 내려간다', requires: "has('하수길')", outcome: { text: '쥐왕이 준 지도를 따라 하수구 철창을 넘었습니다. 진흙과 쥐 떼 사이를 지나 지하 창고 뒷문으로 올라왔습니다.', do: [add('체력', -1)], goto: 'cellar_inside' } },
        {
          text: '문을 억지로 비튼다',
          check: { skill: '담력', difficulty: 3 },
          success: { text: '경첩이 비명을 지르며 휘어졌습니다. 열린 틈으로 푸른 빛이 쏟아졌습니다.', do: [add('체력', -1)], goto: 'cellar_inside' },
          failure: { text: '쇠가 손바닥을 물었습니다. 뼈가 울리는 소리가 위층에서 났습니다. 노파의 코골이가 멎었습니다.', do: [add('체력', -2), on('부상'), add('진실', 0)], goto: 'cellar_retreat' },
        },
        { text: '내려가지 않는다', outcome: { text: '문은 내일도 거기 있을 것입니다. 하지만 당신은 오늘 밤 내내 문 아래서 누가 올라오는 소리를 들었습니다.', do: [add('이성', -1), on('속삭임')], goto: 'cellar_retreat' } },
      ],
    },
    {
      id: 'cellar_retreat',
      title: '물러난 뒤',
      text: '당신은 문 앞에서 물러났습니다. 지하는 아직 기다립니다. 그리고 위층의 노파는 이제 당신이 무엇을 하려 했는지 알고 있을 것입니다.',
      choices: [{ text: '계단 아래를 잠시 바라본다', outcome: { text: '푸른 빛이 한 번 깜빡였습니다. 문틈에서 아이 웃음소리 같은 것이 새어 나왔다가, 사라졌습니다.', do: [add('이성', -1), tag('지하들킴')] } }],
    },
    {
      id: 'cellar_inside',
      title: '그림자의 서가',
      text: '선반이 끝없이 이어집니다. 칸칸이 유리병, 병마다 일렁이는 그림자. 이름표에는 번호와 날짜만 적혀 있습니다. 가장 오래된 병은 백오십 년 전 것입니다.\n{image cellar}\n벽을 따라 구리 파이프가 올라갑니다. 천장 너머, 도시의 가스등으로 이어지는. 파이프 안에서 졸졸, 무언가 흐르는 소리.\n"그래서 불이 안 꺼지는 거야." 어딘가에서 속삭이는 소리가 들렸습니다. "그림자는 오래 타거든."',
      record: { text: '가스등이 사람의 그림자로 타오른다는 것을 알았다', importance: 5 },
      choices: [
        {
          text: '병 하나를 열어 본다',
          outcome: {
            text: '코르크를 뽑자 어린 목소리가 흘러나왔습니다. "엄마… 나 아직 여기 있어." 그림자가 병 안에서 작은 손을 들었습니다. 이름표에는 \'열두 살, 폐병, 쥐굴 하수로 거주\'.',
            do: [add('이성', -2), add('진실', 2), tag('단서:그림자병'), on('속삭임')],
            choices: [
              { text: '병을 가방에 넣는다', outcome: { text: '아무도 모르게 병을 품에 넣었습니다. 훔치는 것이 아닙니다. 되돌려 주기 전에 맡아 두는 것입니다.', do: [item('그림자병', 1, true), add('교단', -1)] } },
              { text: '병을 도로 닫고 나온다', outcome: { text: '코르크를 눌러 닫았습니다. 안에서 누가 우는 것 같았지만, 지금은 아무것도 할 수 없었습니다.' } },
            ],
          },
        },
        {
          text: '파이프를 따라 위로 올라간다',
          check: { skill: '감정', difficulty: 2 },
          success: { text: '파이프는 전당포 벽을 지나 골목의 가스등 기둥으로, 다시 도시 전체의 등으로 가지를 쳤습니다. 이 가게는 도시의 불의 뿌리였습니다.\n가장 굵은 줄기는 광장 한복판, 대등불 쪽으로 곧장 뻗었습니다.', do: [add('진실', 2), tag('단서:뿌리')] },
          failure: { text: '파이프를 짚은 손에서 누군가의 기억이 흘러들었습니다. 박수 소리, 아이 웃음, 이름을 부르는 목소리. 그리고 전부 거꾸로 빨려 나갔습니다.', do: [add('이성', -2), on('그늘')] },
        },
        { text: '서둘러 올라간다', outcome: { text: '더 있으면 돌아오지 못할 것 같았습니다. 계단을 오르는 동안 등 뒤에서 병들이 일제히 몸을 돌리는 소리가 났습니다.', do: [add('이성', -1)] } },
      ],
    },
    {
      id: 'masquerade',
      title: '붉은 야회',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 7',
      text: '지붕이 유리로 된 저택. 연기 천장이 가장 가까이 내려앉은 부촌의 맨 위, 붉은 야회가 열리는 곳입니다. 손님들은 모두 가면을 썼고, 아무도 잔을 비우지 않는데 잔은 늘 붉습니다.\n악단이 느린 왈츠를 연주합니다. 박자마다 누군가 한 명씩 웃음을 멈춥니다.\n{if item(\'초대장\') > 0}손에 쥔 초대장이 땀에 젖었습니다.{else}초대장 없이 어떻게든 들어왔습니다. 하인의 시선이 등에 꽂힙니다.{/if}',
      record: { text: '붉은 야회에 발을 들였다', importance: 4 },
      choices: [
        {
          text: '주최자 세레나 백작과 춤춘다',
          requires: "item('초대장') > 0 or 언변 >= 3",
          outcome: {
            text: '세레나 백작이 장갑 낀 손을 내밀었습니다. 얼굴은 서른 살처럼 보이는데 손은 차갑고 가벼웠습니다.\n"{$이름}{이라/라}고요? 반달 가게의 새 점원. 노파가 당신을 아주 오래 기다렸지." 백작이 귀에 속삭입니다. "내가 도울 수 있어요. 대등불을 켜 둔 건 성광회지만, 불을 먹는 건 우리거든."',
            do: [tag('백작과만남')],
            choices: [
              { text: '손을 잡는다', outcome: { text: '손을 잡자 몸속으로 열기가 번졌습니다. 붉은 잔이 당신 앞에 놓였습니다. 한 모금, 그 정도는 괜찮겠지 싶었습니다.', do: [add('야회', 3), on('재열'), add('그림자', -1), tag('야회의잔')] } },
              {
                text: '정중하게 정보를 캐낸다',
                check: { skill: '언변', difficulty: 3 },
                success: { text: '백작은 흥미로운 장난감을 본 얼굴로 입을 열었습니다. "열두 번째 밤, 대등불의 심지가 갈려. 그때 지하의 그림자 병들이 한꺼번에 빠져나가지. 막으려는 자와 먹으려는 자가 모일 거야."', do: [add('진실', 2), add('야회', 1), tag('단서:열두번째밤')] },
                failure: { text: '"재미없는 아이." 백작이 손을 놓았습니다. 어디선가 하인이 다가와 당신을 출구 쪽으로 이끌었습니다.', do: [add('야회', -1)] },
              },
              { text: '거절하고 물러난다', outcome: { text: '백작은 한 번도 웃지 않고 당신을 놓아주었습니다. 뒷모습에 닿는 시선이 쇠처럼 무거웠습니다.', do: [add('야회', -2)] } },
            ],
          },
        },
        {
          text: '야회 사람들 틈에서 귀를 연다',
          check: { skill: '감정', difficulty: 2 },
          success: { text: '가면 아래 목소리들이 겹쳐졌습니다. "…등불세는 사실 성광회 몫이 아니라던데." "…이백 년 전 계약이…" 몇 마디가 귀에 걸렸습니다.', do: [add('진실', 1), tag('단서:계약')] },
          failure: { text: '누군가 팔을 잡았습니다. "당신, 그림자가 너무 진한데?" 웃음소리가 한꺼번에 당신을 향했습니다. 도망치듯 빠져나왔습니다.', do: [add('이성', -1), add('그림자', 0)] },
        },
        { text: '정원 쪽으로 빠져나간다', outcome: { text: '정원에는 아무도 없었습니다. 장미는 피처럼 붉었고, 분수는 물 대신 재를 뿜었습니다. 돌아오는 길에 어깨 위로 박쥐 같은 것이 한 번 지나갔습니다.', do: [add('체력', -1)] } },
      ],
    },
    {
      id: 'former_clerk',
      title: '문 두드리는 소리',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 9',
      text: '쾅, 쾅, 쾅.\n달은 반쪽입니다. 규칙 셋. 무슨 소리가 나도 열지 않는다.\n문 아래로 푸른 빛이 번졌습니다. 목소리는 낮고 갈라졌고, 어딘가 익숙했습니다. "열어 줘, 새 점원. 나야. 이안이야. 나, 아직 여기 있어."',
      record: { text: '전임자가 문 앞에 돌아왔다', importance: 5 },
      choices: [
        {
          text: '문을 연다',
          outcome: {
            text: '문밖에는 그림자가 없는 남자가 서 있었습니다. 가스등 불빛을 그대로 받으면서도 발밑이 하얗게 비어 있었습니다. 얼굴만은 장부 속 필체처럼 지쳐 있었습니다.\n"고맙다. 열두 번째 밤이 오기 전에 말해 줘야 했어." 이안이 문턱 안으로 들어서며 낮게 웃었습니다. "이 도시의 불은… 우리 거야."',
            do: [add('이성', -1), tag('이안만남')],
            choices: [
              { text: '모든 것을 말해 달라고 한다', outcome: { text: '이안은 단숨에 이야기했습니다. 이백 년 전 계약. 불을 꺼뜨리지 않는 대가로 성광회가 매달 걷는 그림자. 전당포는 그 그림자를 보관하고 가스관에 흘려보내는 도시의 심장이라는 것. 그리고 오르다 마드가 이 도시에서 가장 오래된 \'저당물\'이라는 것.', do: [add('진실', 2), tag('단서:이안의말')] } },
              { text: '"왜 돌아왔어요?"', requires: '진실 >= 3', requiresText: '충분한 단서가 있어야 물을 수 있다', outcome: { text: '이안의 눈에서 처음으로 사람 같은 빛이 일었습니다. "자네가 나보다 먼저 알아냈군. 그럼 얘기가 빠르지. 부탁이 하나 있어. 열두 번째 밤, 광장에서 등불 아래 서 줘. 나는 못 서. 그림자가 없으니까."', do: [add('진실', 1), tag('이안의부탁'), tag('자비')] } },
              { text: '일단 가게 안으로 들인다', outcome: { text: '이안은 구석 의자에 앉아 말없이 병들을 바라보았습니다. 새벽까지 그는 한 번도 눈을 감지 않았습니다.', do: [add('이성', 1), tag('이안보호')] } },
            ],
          },
        },
        { text: '열지 않고 문틈으로 이야기한다', outcome: { text: '"그럼 이것만 받아 줘." 문 아래로 접힌 종이 한 장이 밀려 들어왔습니다. 이안의 필체로, 지하 서가의 위치와 한 줄. "열두 번째 밤에 대등불을 끄지 마. 대신 병을 돌려줘."', do: [add('진실', 1), tag('이안의쪽지')] } },
        { text: '귀를 막고 이불을 뒤집어쓴다', outcome: { text: '노크는 날이 밝을 때까지 이어졌습니다. 문을 열지 않은 것이 옳았는지 그른지는 아무도 말해 주지 않았습니다.', do: [add('이성', -2), on('속삭임')] } },
      ],
    },
    {
      id: 'orda_truth',
      title: '노파의 고백',
      pool: '주요',
      fixed: true,
      priority: 3,
      when: '밤 >= 10',
      text: '노파가 처음으로 가게 문을 일찍 닫았습니다. 난롯불이 그녀의 안경에 작게 비쳤습니다. 손에는 이안의 장부 찢긴 쪽 세 장이 들려 있었습니다.\n"{$이름}{아/야}. 오늘은 규칙을 어길 거야. 내가 말하는 건 맡긴 사람의 것이 아니라 내 것이니까."',
      record: { text: '오르다 마드의 고백을 들었다', importance: 5 },
      choices: [
        {
          text: '잠자코 듣는다',
          outcome: {
            text: '"이백 년 전, 도시가 마지막 해를 잃던 해에 나는 스무 살이었어. 성광회가 제안했지. 등불을 영원히 켜 두는 대신, 도시 사람들의 그림자를 조금씩 맡기자고. 나는 그 보관인으로 서명했어. 대가로 내 이름을 맡겼고." 노파가 손가락의 반지 자국을 쓸었습니다. "그래서 나는 죽지 못해. 이 가게가 선 한, 도시의 불이 꺼지지 않는 한."',
            do: [add('진실', 2), tag('단서:오르다')],
            choices: [
              { text: '"어떻게 하면 끝낼 수 있죠?"', outcome: { text: '"나를 이어받거나, 불을 끄거나, 그림자를 돌려주거나." 노파가 손가락 세 개를 폈습니다. "셋 다 대가가 있어. 어느 것이 옳은지 나는 이백 년이 지나도 모르겠다."', do: [add('진실', 1)] } },
              { text: '"당신 자리를… 잇겠습니다."', outcome: { text: '노파는 오래 침묵했습니다. 그러다 안경을 벗었습니다. 눈동자가 의외로 젊었습니다. "…네가 이렇게 말하는 날이 올 줄은 몰랐다. 거절해도 돼. 거절하는 편이 좋을 거다."', do: [tag('후계제안'), add('이성', -1)] } },
              { text: '아무 말도 하지 못한다', outcome: { text: '난롯불이 낮아졌습니다. 노파가 낮게 웃었습니다. "그래, 그게 정상이야."', do: [add('이성', -1)] } },
            ],
          },
        },
        { text: '"왜 하필 저한테 말하죠?"', outcome: { text: '"네 그림자가 아직 짙으니까." 노파가 지팡이 끝으로 당신의 발밑을 가리켰습니다. "그리고 이안이 못 한 말을 네가 할 수 있을지 보고 싶었어."', do: [add('진실', 1), add('이성', 1)] } },
      ],
    },
    {
      id: 'siege',
      title: '세 개의 초인종',
      pool: '주요',
      fixed: true,
      priority: 4,
      when: '밤 >= 11',
      text: '열한 번째 밤, 가게의 종이 한꺼번에 세 번 울렸습니다.\n정문에는 성광회의 흰 사제들과 철제 가면의 호위. 뒷문에는 쥐굴 조합의 굶주린 얼굴들. 지붕 위에는 붉은 야회의 박쥐 같은 그림자들.\n모두 대등불의 심지가 갈리는 내일 밤 전에, 이 가게의 지하를 원합니다. 노파는 계단 위에서 지팡이를 짚고 서 있습니다. "누구 편을 들지는 네가 정해, {$이름}{아/야}."',
      record: { text: '세 세력이 한꺼번에 가게를 포위했다', importance: 5 },
      choices: [
        {
          text: '성광회에 문을 연다',
          requires: '교단 >= 1',
          outcome: { text: '사제들이 지하로 내려가려 하자 노파가 가로막았습니다. 사제 베르나가 은빛 사슬을 감았습니다. 노파의 입에서 비명이 났습니다. 당신은 눈을 감았습니다.', do: [add('교단', 2), add('쥐굴', -3), add('야회', -2), add('체력', -2), tag('편:교단')] },
        },
        {
          text: '쥐굴을 하수로로 들인다',
          requires: '쥐굴 >= 1',
          outcome: { text: '뒷문 빗장을 풀자 쥐굴 조합이 그림자처럼 스며들었습니다. 하이가 지하 문 앞에 서서 낮게 말했습니다. "우리 애들 병은 우리가 가져가오."', do: [add('쥐굴', 2), add('교단', -3), add('체력', -1), tag('편:쥐굴')] },
        },
        {
          text: '야회를 지붕으로 들인다',
          requires: '야회 >= 1',
          outcome: { text: '지붕 창을 열자 붉은 안개가 방 안으로 내려앉았습니다. 세레나 백작이 가볍게 착지했습니다. "현명하군요. 내일 밤 불이 갈릴 때, 우리가 먼저 마실 거예요."', do: [add('야회', 2), add('교단', -2), add('이성', -2), tag('편:야회')] },
        },
        {
          text: '누구에게도 문을 열지 않고 버틴다',
          check: { skill: '담력', difficulty: 3, bonus: "item('은단검') > 0 ? 10 : 0" },
          success: { text: '당신은 계단 위에 서서 양쪽 문의 빗장을 지켰습니다. 한 시간. 두 시간. 새벽이 되자 세 쪽 모두 물러갔습니다. 서로를 믿지 못해서였습니다.', do: [add('체력', -2), tag('편:없음'), rec('세 세력을 홀로 막아섰다', 5), achieve('세력무관')] },
          failure: { text: '빗장이 부서졌습니다. 세 세력이 한꺼번에 밀려 들어왔고, 당신은 계단 아래로 굴렀습니다. 누군가 어깨를 눌렀습니다. 한참 뒤에야 노파가 소리쳤습니다. "그만!"', do: [add('체력', -4), on('부상'), tag('편:없음')] },
        },
        { text: '지하로 내려가 병을 지킨다', requires: "has('단서:그림자병')", outcome: { text: '당신은 세 세력이 문을 두드리는 동안 지하로 뛰어내려가 서가 앞에 섰습니다. 병마다 푸른 빛이 맥박처럼 뛰었습니다. 위에서 노파의 목소리가 들렸습니다. "그 병들은 네 몫이다."', do: [add('이성', -2), item('그림자병', 2, true), tag('편:병'), tag('자비')] } },
      ],
    },
    {
      id: 'ember_night',
      title: '열두 번째 밤, 대등불',
      pool: '주요',
      fixed: true,
      priority: 10,
      when: '밤 >= 12',
      text: '{image square}\n재의 축제. 연기 천장 아래, 광장 한가운데 대등불이 서 있습니다. 쇠 기둥 끝 유리 심장에서 이백 년째 꺼지지 않은 불이 일렁입니다. 오늘 밤 심지가 갈립니다.\n{if has(\'이안의부탁\')}군중 사이에서 그림자 없는 남자가 손을 들어 보입니다.{/if}{if has(\'편:교단\')}성광회 사제들이 은빛 성가대 줄을 서 있습니다.{elif has(\'편:쥐굴\')}군중 가장자리에서 쥐굴의 눈들이 반짝입니다.{elif has(\'편:야회\')}지붕 위에서 붉은 박쥐 같은 것들이 내려다봅니다.{/if}\n광장의 모든 가스등이 일제히 깜빡입니다. 그림자 한 겹이 누구 발밑에서든 빠져나가려는 듯 가늘게 떨립니다.',
      record: { text: '열두 번째 밤, 대등불 앞에 섰다', importance: 5 },
      choices: [
        {
          text: '그림자 병을 풀어 주인에게 돌려준다',
          requires: "item('그림자병') > 0 and has('단서:그림자병')",
          outcome: {
            text: '품속의 병을 하나씩 열었습니다. 푸른 연기 같은 그림자들이 광장으로 퍼졌습니다. 군중 속에서 누군가 비명을 질렀고, 누군가 무릎을 꿇었습니다. 오래전 떠난 그림자가 발밑으로 돌아오는 감촉.',
            do: [add('그림자', 1), add('이성', -1)],
            choices: [
              { text: '대등불에 병을 모두 쏟는다', outcome: { text: '대등불이 한 번 크게 일렁이더니 푸른빛으로 바뀌었습니다. 불은 꺼지지 않았지만, 더는 누구의 그림자도 먹지 않았습니다.', do: [end('returned')] } },
              { text: '대등불은 그대로 두고 물러난다', outcome: { text: '병들을 돌려주는 동안에도 불은 타올랐습니다. 아침이 오기 전에 당신은 이미 도시의 적이 되어 있었습니다.', do: [end('wanted')] } },
            ],
          },
        },
        {
          text: '대등불의 심지를 끊어 도시를 진짜 밤에 맡긴다',
          requires: "진실 >= 5 and (item('뼈열쇠') > 0 or has('이안의쪽지'))",
          outcome: {
            text: '뼈 열쇠가 대등불 기둥의 작은 구멍에 맞았습니다. 열쇠가 돌아가는 순간 도시의 모든 가스등이 한꺼번에 숨을 멈췄습니다. 광장이 어둠에 잠겼습니다. 아주 오랜만에, 처음으로, 사람들의 눈이 어둠을 보았습니다.\n노파의 목소리가 어딘가에서 들렸습니다. "…고맙다."',
            do: [end('darkness')],
          },
        },
        {
          text: '대등불을 지킨다 — 누구와 함께?',
          outcome: {
            text: '당신은 대등불 기둥 앞에 서서 팔을 벌렸습니다. 누가 오든 오늘 밤 불은 꺼지지 않을 것입니다. 하지만 이 불을 누가 지켜야 하는가?',
            choices: [
              { text: '성광회와 함께', requires: '교단 >= 2', outcome: { text: '베르나 사제가 인장 반지를 들어 올렸습니다. 사제단이 당신 곁에 섰습니다. 군중은 성가를 부르기 시작했습니다. 이 불을 위해 그림자를 내는 것은 이제 시민의 의무가 됩니다.', do: [end('order')] } },
              { text: '붉은 야회와 함께', requires: '야회 >= 3', outcome: { text: '세레나 백작이 당신 옆으로 내려섰습니다. "밤은 우리 몫이지요." 대등불이 붉게 물들었습니다. 이 도시는 이제 낮이 아니라 밤에 속한 것입니다.', do: [end('night_court')] } },
              { text: '혼자서', outcome: { text: '당신은 혼자 불을 지켰습니다. 한 시간은 그럭저럭, 두 시간째에 이성이 갈라졌습니다. 가스등마다 누군가 당신 이름을 불렀습니다.', do: [add('이성', -4)] } },
            ],
          },
        },
        {
          text: '오르다의 자리를 잇는다',
          requires: "has('후계제안')",
          outcome: { text: '노파가 군중 뒤에서 걸어 나왔습니다. 처음으로 허리를 펴고, 안경을 벗었습니다. "고맙다, 점원. 아니… 주인." 열쇠고리와 장부가 당신 손에 쥐어졌습니다. 이름을 맡기는 순간 당신의 그림자는 한 번 크게 일렁이다 가게 쪽으로 늘어졌습니다.', do: [end('pawnbroker')] },
        },
        { text: '재의 길로 도시를 떠난다', outcome: { text: '축제의 환호가 터지는 순간 당신은 광장을 등졌습니다. 골목을 지나, 성벽의 쪽문을 지나, 연기 천장이 끝나는 곳을 향해. 뒤에서 대등불이 한 번 크게 타올랐고, 당신은 돌아보지 않았습니다.', do: [end('ash_road')] } },
      ],
    },

    // ───────────── 위기 (규칙이 불러냄) ─────────────
    {
      id: 'breakdown',
      title: '벽 속의 목소리',
      tone: 'negative',
      text: '더는 문장이 이어지지 않습니다. 단어들이 입속에서 재가 되어 흩어집니다. 벽 너머의 목소리가 이제는 벽 안쪽에서 들립니다. 아주 친절하게, 이름을 부르며.',
      record: { text: '마음의 끝에서 벽 속의 목소리를 들었다', importance: 4 },
      choices: [
        { text: '성수를 마신다', requires: "item('성수병') > 0", outcome: { text: '병을 따자 차가운 물이 목을 적셨습니다. 목소리가 한 걸음 물러났습니다. 한 걸음. 그 정도면 충분했습니다.', do: [item('성수병', -1, true), set('이성', 4), off('속삭임')] } },
        { text: '노파의 방문을 두드린다', outcome: { text: '노파는 말없이 문을 열고 찻잔을 건넸습니다. 차는 쓰고 따뜻했습니다. "나도 처음엔 그랬어. 이백 년쯤 되면 익숙해져." 위로인지 경고인지 구분이 안 됐습니다.', do: [set('이성', 3), add('빚', 3)] } },
        { text: '목소리가 시키는 대로 한다', outcome: { text: '목소리가 시킨 것은 아주 사소한 일이었습니다. 문을 열고, 한 걸음 나가고, 그림자를 한 번 놓아 주는 것.', do: [end('whispered')] } },
      ],
    },
    {
      id: 'seizure',
      title: '압류',
      tone: 'negative',
      text: '장부의 숫자가 더는 불어날 곳이 없습니다. 아침에 가게 문을 두드린 것은 철제 가면을 쓴 채권 추심인 둘이었습니다. 이자 장부의 마지막 줄에는 당신의 이름이 또박또박 적혀 있습니다.\n"기한이 찼소. 담보는 본인이오."',
      record: { text: '빚이 불어나 추심인이 찾아왔다', importance: 4 },
      choices: [
        { text: '가진 것을 전부 내놓는다', requires: '은화 >= 30', outcome: { text: '은화 주머니가 비워졌고 장부의 숫자가 반으로 줄었습니다. 추심인은 "다음 번엔 없소"라는 말을 남겼습니다.', do: [add('은화', -30), set('빚', 10)] } },
        { text: '그림자로 갚는다', requires: '그림자 >= 2', outcome: { text: '추심인의 갈고리가 당신 발밑을 훑었습니다. 그림자가 한 겹, 두 겹 떨어져 나가는 대신 빚이 지워졌습니다.', do: [add('그림자', -2), set('빚', 0)] } },
        { text: '담보로 잡힌다', outcome: { text: '당신은 장부에 서명했습니다. 가게 문이 닫히고, 철제 가면 사이로 낡은 복도가 이어졌습니다.', do: [end('indenture')] } },
      ],
    },
    {
      id: 'thin_shadow',
      title: '얇아진 그림자',
      tone: 'negative',
      text: '가스등 아래에서 당신은 발밑을 보았습니다. 그림자가 거의 보이지 않습니다. 지나가던 아이가 당신을 보고 얼어붙었다가 어머니 치마 뒤로 숨었습니다.',
      choices: [
        { text: '그림자 병을 마신다', requires: "item('그림자병') > 0", outcome: { text: '병 속의 누군가가 한숨 쉬듯 당신에게 스몄습니다. 발밑이 조금 짙어졌습니다. 이 그림자가 원래 누구의 것이었는지는 생각하지 않기로 했습니다.', do: [item('그림자병', -1, true), add('그림자', 2), tag('빌린그림자')] } },
        { text: '이대로 숨어 지낸다', outcome: { text: '모자를 깊이 눌러쓰고 걸었습니다. 사람들은 당신과 마주치기 전에 길을 비켜 주었습니다. 외로웠지만 안전했습니다.', do: [add('이성', -1)] } },
      ],
    },

    // ───────────── 손님 ─────────────
    {
      id: 'bard',
      title: '맹인 악사',
      pool: '손님',
      once: true,
      weight: 10,
      text: '낡은 류트를 멘 맹인 악사가 문을 밀었습니다. 손끝이 현처럼 거칠고, 눈동자는 연기 천장 같은 회색입니다.\n"악기가 아니라 노래를 맡기고 싶소. 내 노래는 내가 부르면 사람들을 울리는데, 그 때문에 쫓겨나는 신세가 됐거든."',
      choices: [
        { text: '노래를 사들인다', requires: '은화 >= 15', outcome: { text: '악사의 입에서 푸른 음표가 한 줄 흘러나와 병 속으로 들어갔습니다. 당신 마음속에서 오래 잠겨 있던 무언가가 한 번 위로 떠올랐습니다.', do: [add('은화', -15), add('이성', 2), tag('악사의노래'), rec('맹인 악사의 노래를 맡아 두었다', 2)] } },
        {
          text: '노래를 들어 본다',
          check: { skill: '담력', difficulty: 2 },
          success: { text: '악사가 현을 한 번 튕기자 가사가 흘러나왔습니다. "등불 아래 아이들이 잠들면, 불은 아이들의 그림자를 조금 마신다네…" 노래는 거기서 끊겼습니다.', do: [add('진실', 1), tag('단서:노래')] },
          failure: { text: '선율이 귓속으로 파고들었습니다. 한 소절이 끝나자 눈물이 멎지 않았습니다. 이유도 모른 채 울고 있었습니다.', do: [add('이성', -1), on('속삭임')] },
        },
        { text: '정중히 돌려보낸다', outcome: { text: '악사는 고개를 숙이고 류트를 다시 멨습니다. 문을 나서며 낮게 흥얼거렸습니다. 곡조는 오래 골목에 남았습니다.' } },
      ],
    },
    {
      id: 'shadow_child',
      title: '그림자를 맡기러 온 아이',
      pool: '손님',
      once: true,
      weight: 12,
      tone: 'negative',
      text: '카운터 높이에 겨우 이마가 닿는 아이가 은화 대신 자기 발밑을 가리켰습니다. "어, 어머니가 병원에 계세요. 이거면 되죠? 이거 맡기면 돈 주신다고 했어요."\n아이의 그림자는 작고 선명했고, 가스등 아래서 아이보다 먼저 들어왔습니다.',
      choices: [
        { text: '"가게 규칙입니다. 안 됩니다."', outcome: { text: '아이의 눈이 한 번 크게 떠졌습니다. 당신은 은화 열 닢을 쥐여 주려다 가게의 규칙을 떠올렸습니다. 아이는 고개를 숙이고 나가 버렸습니다. 문종이 한 번 울렸습니다.', do: [add('교단', 1), tag('아이거절')] } },
        { text: '돈을 쥐여 주고 그림자는 받지 않는다', requires: '은화 >= 20', outcome: { text: '"이건 맡기는 게 아니라 빌려주는 거야." 아이는 이해하지 못한 얼굴로 은화를 받았습니다. 그림자는 아이의 발밑에 그대로 있었습니다.', do: [add('은화', -20), tag('자비'), rec('그림자를 맡기러 온 아이에게 돈을 쥐여 보냈다', 3), add('쥐굴', 1)] } },
        { text: '그림자를 맡아 준다', outcome: { text: '아이의 발밑에서 작은 그림자 한 겹이 떨어져 병에 담겼습니다. 아이는 은화 스물다섯 닢을 쥐고 뛰어나갔습니다. 병 속의 그림자는 한동안 문 쪽을 바라보고 있었습니다.', do: [add('은화', -25), item('그림자병', 1, true), add('이성', -1)] } },
      ],
    },
    {
      id: 'watch_captain',
      title: '야경대',
      pool: '손님',
      once: true,
      weight: 9,
      text: '철모에 재가 쌓인 야경대 반장 노르가 영장을 카운터에 던졌습니다. "이 골목 전당포 전부를 수색하고 있다. 쥐굴과 짜고 장물을 다루는 놈이 있다는 신고가 들어왔어."\n그의 눈이 선반의 시계들 위에서 느릿하게 움직였습니다.',
      choices: [
        { text: '순순히 협조한다', outcome: { text: '장부를 건네자 노르가 한참 넘겨 보았습니다. "깨끗하군. 너무 깨끗해서 의심스럽지만." 그가 떠난 뒤 선반의 시계 하나가 사라진 것을 알아챘습니다.', do: [add('교단', 1), add('쥐굴', -1)] } },
        {
          text: '능청스럽게 둘러댄다',
          check: { skill: '언변', difficulty: 2 },
          success: { text: '"반장님, 이 시계는 이안이 맡긴 거라서요. 이안 모르시죠?" 노르의 얼굴이 굳었습니다. 그는 영장을 접고 헛기침을 하며 물러갔습니다.', do: [add('쥐굴', 1), add('진실', 1), tag('단서:이안')] },
          failure: { text: '"입이 많이 가볍군." 노르가 당신의 멱살을 잡았습니다. 갈비뼈에 철모 모서리가 박혔습니다.', do: [add('체력', -2)] },
        },
        { text: '은화 열다섯을 슬쩍 얹는다', requires: '은화 >= 15', outcome: { text: '장부 사이에 은화가 한 줄로 미끄러졌습니다. 노르는 아무것도 못 본 사람처럼 장부를 덮었습니다. "점원, 오래 살겠군."', do: [add('은화', -15), add('쥐굴', 1)] } },
      ],
    },
    {
      id: 'dora_shop',
      title: '행상 도라',
      pool: '손님',
      weight: 12,
      cooldown: 4,
      text: '손수레 가득 병과 헝겊을 실은 행상 도라가 문턱에 앉았습니다. 바퀴는 재에 덮여 회색인데 손수레에 걸린 램프만 유난히 맑게 빛납니다.\n"필요한 거 골라, 점원 양반. 그림자는 안 받는다고 미리 말해 둘게. 이쪽은 정직한 장사야."',
      choices: [
        { text: '성수병 (20은화)', requires: '은화 >= 20', outcome: { text: '병마개를 열어 확인했습니다. 쇳내와 박하 향. 틀림없는 성광회의 축성수입니다.', do: [add('은화', -20), item('성수병')], goto: 'dora_shop' } },
        { text: '약초 붕대 (10은화)', requires: '은화 >= 10', outcome: { text: '쑥 냄새가 코끝을 스쳤습니다. 도라가 묶음을 건네며 윙크했습니다.', do: [add('은화', -10), item('붕대')], goto: 'dora_shop' } },
        { text: '은 단검 (35은화)', requires: "은화 >= 35 and item('은단검') = 0", outcome: { text: '칼날이 가스등 불빛을 하얗게 갈랐습니다. 손잡이에는 \'D\'가 새겨져 있었습니다.', do: [add('은화', -35), item('은단검')], goto: 'dora_shop' } },
        { text: '손등불 (30은화)', requires: "은화 >= 30 and item('손등불') = 0", outcome: { text: '손바닥만 한 램프에 작은 불꽃이 쪼그리고 앉아 있었습니다. 따뜻했습니다. 오랜만에 아주 오랜만에, 순수하게 따뜻한 것이었습니다.', do: [add('은화', -30), item('손등불')], goto: 'dora_shop' } },
        { text: '"오늘은 됐습니다."', outcome: { text: '도라가 손수레를 끌고 어둠 속으로 사라졌습니다. 바퀴 소리가 한동안 골목에 남았습니다.' } },
      ],
    },
    {
      id: 'priest_runaway',
      title: '도망 사제',
      pool: '손님',
      once: true,
      weight: 9,
      when: '밤 >= 2',
      tone: 'negative',
      text: '흰 사제복의 소매가 찢긴 젊은 사제 이르가 숨을 몰아쉬며 들어와 문을 닫았습니다. 쇄골 아래 낙인이 지워지려다 만 흉터처럼 번져 있습니다.\n"숨겨 주세요. 사흘만… 성광회가 제 입을 막으려 합니다. 저는 지하 수도원에서 본 걸 말했을 뿐이에요."',
      choices: [
        { text: '지하 창고에 숨겨 준다', outcome: { text: '이르는 선반 뒤 비밀 칸에서 밤을 지새웠습니다. 새벽에 사제들이 가게를 뒤졌지만 끝내 찾지 못했습니다. 노파는 아침에 이상하게 웃고 있었습니다.', do: [add('교단', -2), add('쥐굴', 1), add('진실', 1), tag('이르보호')] } },
        { text: '성광회에 알린다', outcome: { text: '문밖에 선 사제들이 이르의 팔을 잡았습니다. 이르는 당신을 바라보지 않았습니다. 은화 서른이 쟁반 위에 던져졌습니다.', do: [add('은화', 30), add('교단', 2), add('이성', -1)] } },
        {
          text: '낙인을 지워 주려 해 본다',
          check: { skill: '감정', difficulty: 3 },
          success: { text: '당신은 칼끝으로 화인 주변을 조심스럽게 도려냈습니다. 이르는 이를 악물고 견뎠습니다. 다 끝나자 그는 울면서 웃었습니다. "오래 전부터… 가려웠어요."', do: [add('교단', -1), add('쥐굴', 1), tag('자비'), rec('도망 사제의 낙인을 지워 주었다', 3)] },
          failure: { text: '손이 떨려 칼날이 깊이 들어갔습니다. 이르는 비명을 삼켰습니다. 피 냄새가 가게 안을 덮었습니다.', do: [add('이성', -1), add('쥐굴', 0)] },
        },
      ],
    },
    {
      id: 'widow',
      title: '남편의 초상',
      pool: '손님',
      once: true,
      weight: 8,
      tone: 'negative',
      text: '검은 상복의 과부가 액자 하나를 카운터에 올려놓았습니다. 초상화 속 남자는 웃고 있었지만, 눈동자가 보는 방향이 매번 바뀌는 것 같았습니다.\n"이걸 팔고 싶어요. 아니, 가져가 주세요. 어젯밤부터 이 사람이 제 침대 곁에서 말을 걸어요."',
      choices: [
        { text: '초상화를 받는다', outcome: { text: '액자를 선반 위에 올리자 가게 안이 조금 더 추워졌습니다. 과부는 안도의 눈물을 흘리며 나갔습니다. 초상 속 남자의 입꼬리가 아주 조금 올라갔습니다.', do: [add('은화', 15), on('속삭임'), add('교단', 1)] } },
        {
          text: '초상 속 남자와 대화해 본다',
          check: { skill: '담력', difficulty: 2 },
          success: { text: '남자는 한참 만에 입을 열었습니다. "…돌아가고 싶어. 여긴 너무 밝아." 그가 눈을 한 번 감았다 떴을 때 액자는 그저 낡은 그림이었습니다.', do: [add('이성', 1), add('진실', 1), tag('단서:망자')] },
          failure: { text: '남자가 당신 이름을 불렀습니다. 한 번 두 번. 눈을 뜨자 액자가 방 반대편 벽에 걸려 있었습니다.', do: [add('이성', -2), on('속삭임')] },
        },
        { text: '"전당포가 받을 물건이 아닙니다."', outcome: { text: '과부는 한참 서 있다가 액자를 가슴에 안고 돌아섰습니다. 문턱을 넘으며 중얼거렸습니다. "그럼 누가 받아 주죠."', do: [add('이성', -1), tag('자비')] } },
      ],
    },
    {
      id: 'pickpocket',
      title: '쥐굴의 손',
      pool: '손님',
      once: true,
      weight: 9,
      text: '손님인 척 줄을 선 아이의 손이 슬쩍 당신의 주머니를 향했습니다. 능숙한 손놀림이었지만 한 가지 실수. 아이의 손목에 쥐굴 조합의 문신이 있었습니다.',
      choices: [
        {
          text: '손목을 잡는다',
          check: { skill: '담력', difficulty: 1 },
          success: { text: '손목을 잡자 아이가 얼어붙었습니다. "…쥐굴 형들한테는 말하지 마세요." 당신은 은화 두 닢만 쥐여 보내고 손을 놓았습니다.', do: [add('쥐굴', 1), tag('자비')] },
          failure: { text: '아이는 곡예사처럼 몸을 비틀며 빠져나갔고, 당신 주머니에서 은화 몇 닢이 함께 사라졌습니다.', do: [add('은화', -10)] },
        },
        { text: '모르는 척 지켜본다', outcome: { text: '아이는 은화 한 닢만 집어 갔습니다. 당신 눈을 바라보고 나서 목례를 하고 나갔습니다. 며칠 뒤 문턱에 말린 생선 한 마리가 놓여 있었습니다.', do: [add('은화', -3), add('쥐굴', 2)] } },
        { text: '야경대를 부른다', outcome: { text: '호루라기 소리가 골목을 울렸습니다. 아이는 어둠 속으로 사라졌지만 이튿날 가게 문에는 쥐굴의 붉은 분필 표식이 그려져 있었습니다.', do: [add('쥐굴', -2), add('교단', 1), on('추적')] } },
      ],
    },

    // ───────────── 사건 ─────────────
    {
      id: 'ash_rain',
      title: '재비',
      pool: '사건',
      weight: 10,
      tone: 'neutral',
      text: '밤하늘이 갑자기 검은 비를 쏟았습니다. 재와 빗물이 섞여 진흙이 되고, 골목마다 가스등 불빛이 흙탕물에 번졌습니다. 이럴 때는 사람들이 문을 걸어 잠급니다.',
      choices: [
        { text: '처마 아래서 기다린다', outcome: { text: '한 시간, 두 시간. 비는 멎지 않았지만 그동안 숨은 고르게 돌아왔습니다.', do: [add('이성', 1)] } },
        { text: '비를 뚫고 달린다', outcome: { text: '재가 입에 들어갔습니다. 쓴맛이 한참 혀에 남았습니다.', do: [add('체력', -1), add('은화', 8)] } },
        { text: '손등불을 꺼내 든다', requires: "item('손등불') > 0", outcome: { text: '작은 불꽃이 빗속에서도 흔들리지 않았습니다. 골목의 그늘들이 한 걸음씩 물러났습니다.', do: [add('이성', 2)] } },
      ],
    },
    {
      id: 'lamp_out',
      title: '꺼진 가스등',
      pool: '사건',
      weight: 11,
      tone: 'negative',
      group: 'dark',
      text: '골목 중간의 가스등이 꺼져 있습니다. 어둠 속에서 무언가 웅크린 형체가 이쪽을 향해 고개를 들었습니다. 눈은 없고 입만 있는 개. 이 도시 사람들은 그늘개라고 부릅니다.',
      choices: [
        { text: '맞선다', outcome: { do: [call('습격', { 위력: 2 })] } },
        { text: '돌아서 다른 길로 간다', outcome: { text: '발걸음을 빨리했지만 등 뒤에서 발톱이 돌바닥을 긁는 소리가 한참 따라왔습니다.', do: [add('이성', -1)] } },
        { text: '그림자를 한 겹 던져 준다', requires: '그림자 >= 3', outcome: { text: '개는 그림자를 한입에 삼키고 어둠 속으로 되돌아갔습니다. 당신의 발밑이 얇아졌습니다.', do: [add('그림자', -1), tag('그늘개빚')] } },
      ],
    },
    {
      id: 'rooftop_hunter',
      title: '지붕 위의 사냥꾼',
      pool: '사건',
      weight: 8,
      tone: 'negative',
      group: 'dark',
      text: '기와가 한 장 떨어졌습니다. 올려다보자 지붕 위, 가스등 불빛 건너편에 가죽 외투 차림의 사냥꾼이 쭈그리고 있었습니다. 손에는 은빛 갈고리, 눈에는 굶주림. 그림자 사냥꾼입니다.',
      choices: [
        { text: '재빨리 골목으로 숨는다', outcome: { text: '숨이 목구멍까지 차올랐습니다. 사냥꾼은 갈고리를 한 번 휘둘렀다가 그냥 걸음을 돌렸습니다. 오늘은 배가 불렀나 봅니다.', do: [add('체력', -1)] } },
        { text: '은 단검을 뽑는다', requires: "item('은단검') > 0", outcome: { text: '은빛이 번쩍이자 사냥꾼의 눈이 가늘어졌습니다. 그는 낮게 혀를 차고 지붕 너머로 사라졌습니다.', do: [add('쥐굴', 1)] } },
        {
          text: '말을 걸어 본다',
          check: { skill: '언변', difficulty: 3 },
          success: { text: '사냥꾼은 갈고리를 내렸습니다. "…점원이라. 반달 가게? 거긴 건드리지 말라고 위에서 그러더군." 그는 가죽 외투를 여미며 어둠 속으로 사라졌습니다.', do: [add('진실', 1), tag('단서:사냥꾼')] },
          failure: { text: '갈고리가 어깨를 스쳤습니다. 그림자가 한 겹 찢겨 나갔습니다. 사냥꾼은 낄낄거리며 지붕을 넘어 사라졌습니다.', do: [add('체력', -1), add('그림자', -1)] },
        },
      ],
    },
    {
      id: 'whisper_wall',
      title: '벽의 속삭임',
      pool: '사건',
      weight: 10,
      tone: 'negative',
      text: '가게 벽 안쪽에서 낮게 말소리가 납니다. 처음엔 쥐 소리인 줄 알았습니다. 하지만 쥐는 이름을 부르지 않습니다. 당신 이름을, 정확한 억양으로.',
      choices: [
        { text: '귀를 막고 노래를 부른다', outcome: { text: '이안의 장부에서 본 자장가를 흥얼거렸습니다. 소리가 조금 물러났습니다. 가사가 어디서 왔는지는 몰랐습니다.', do: [add('이성', -1)] } },
        { text: '벽에 귀를 댄다', check: { skill: '감정', difficulty: 2 }, success: { text: '벽 속 목소리는 낮게 숫자를 세고 있었습니다. 칠, 팔, 구. 날짜입니다. 열둘에서 멈추고 한참 뒤 다시 하나부터.', do: [add('진실', 1), tag('단서:숫자')] }, failure: { text: '벽 속 입술이 귓바퀴에 닿는 것 같았습니다. 놀라 물러났을 때 손바닥에 푸른 얼룩이 남아 있었습니다.', do: [add('이성', -2), on('속삭임')] } },
        { text: '성수를 벽에 뿌린다', requires: "item('성수병') > 0", outcome: { text: '성수가 벽을 타고 흘렀습니다. 안쪽에서 짧은 비명이 한 번. 그리고 조용해졌습니다.', do: [item('성수병', -1, true), add('이성', 1), add('교단', 0)] } },
      ],
    },
    {
      id: 'choir',
      title: '길 잃은 성가대',
      pool: '사건',
      weight: 8,
      tone: 'positive',
      text: '골목 끝에서 어린 성가대원들이 촛불을 들고 줄지어 걸어왔습니다. 입은 열려 있지만 소리는 노래가 아니라 한숨에 가깝습니다. 인솔자가 길을 잃은 듯 서성입니다.',
      choices: [
        { text: '큰길까지 길을 안내해 준다', outcome: { text: '아이들은 당신의 손등불을 따라 조용히 걸었습니다. 큰길에 닿자 한 아이가 당신을 올려다보며 "고맙습니다" 하고 웃었습니다. 그것만으로 가슴이 가벼워졌습니다.', do: [add('교단', 1), add('이성', 1), tag('자비')] } },
        { text: '못 본 척한다', outcome: { text: '촛불 행렬이 골목 안쪽으로 천천히 사라졌습니다. 그날 밤 가게 어딘가에서 한숨 같은 성가가 한 번 울렸습니다.' } },
      ],
    },
    {
      id: 'sewer_thing',
      title: '하수구의 것',
      pool: '사건',
      weight: 8,
      tone: 'negative',
      group: 'dark',
      text: '뒷마당 하수구 뚜껑이 들썩입니다. 쇠창살 사이로 젖은 털과 물갈퀴 같은 손가락이 올라왔습니다. 어두운 구멍 안에서 낮은 목소리가 났습니다. "…빌려줘. 한 번만."',
      choices: [
        { text: '쇠막대로 눌러 닫는다', outcome: { do: [call('습격', { 위력: 2 })] } },
        { text: '"무엇을 빌려 달라는 거죠?"', outcome: { text: '"빛." 목소리는 간절했습니다. "아주 조금만. 오래 못 봤어." 당신은 손등불을 열었다 닫았습니다. 하수구 안에서 고맙다는 소리가 들렸습니다.', do: [add('이성', -1), tag('하수구의빛'), add('쥐굴', 1)] } },
        { text: '그냥 지나친다', outcome: { text: '뚜껑이 다시 닫히는 소리와 함께 한숨이 흘러나왔습니다. 문득 가게 안 물그릇이 조금 줄어 있었습니다.' } },
      ],
    },
  ],

  actions: [
    {
      id: 'audit',
      pool: '밤일과',
      text: '장부를 정리한다',
      check: { skill: '감정', difficulty: 2 },
      success: { text: '숫자와 이름이 맞아떨어졌습니다. 오래 묻힌 선금 몇 줄이 살아났습니다.', do: [add('은화', 18)] },
      failure: { text: '숫자가 자꾸 어긋났습니다. 오늘은 눈이 피곤한 모양입니다.', do: [add('은화', 4), add('이성', -1)] },
    },
    {
      id: 'patrol',
      pool: '밤일과',
      text: '골목을 순찰한다',
      check: { skill: '담력', difficulty: 2 },
      success: { text: '골목 끝까지 돌고 아무 일도 없었습니다. 길가의 취객이 던진 은화 몇 닢을 주웠습니다.', do: [add('은화', 12)] },
      failure: { text: '어두운 모퉁이에서 무언가 발목을 잡아챘습니다. 그늘이 다리에 감겼다 풀렸습니다.', do: [add('체력', -1), on('그늘')] },
    },
    {
      id: 'chapel',
      pool: '밤일과',
      text: '성광회 예배당에 들른다 (헌금 5은화)',
      when: '은화 >= 5',
      outcome: { text: '촛불 아래서 짧은 기도문을 외웠습니다. 사제의 눈이 당신의 발밑을 스쳤다가 돌아갔습니다. 마음은 가라앉았습니다.', do: [add('은화', -5), add('교단', 1), add('이성', 1)] },
    },
    {
      id: 'ratbar',
      pool: '밤일과',
      text: '쥐굴 술집에서 귀를 연다',
      check: { skill: '언변', difficulty: 2 },
      success: { text: '탁한 술 한 잔에 이야기들이 흘러나왔습니다. 쥐굴 사람들은 이상하게 당신에게 마음을 열었습니다.', do: [add('쥐굴', 1), add('은화', -3), add('진실', 0)] },
      failure: { text: '당신의 억양을 수상히 본 누군가 술잔을 던졌습니다. 이마에서 피가 흘렀습니다.', do: [add('체력', -1), add('쥐굴', -1)] },
    },
    {
      id: 'rest',
      pool: '밤일과',
      text: '붕대를 감고 쉰다',
      outcome: { text: '이불 속에서 눈을 감았습니다. 이번 밤은 조용히 지나갔습니다.', do: [add('체력', 2), add('이성', 1)] },
    },
    {
      id: 'pawn_self',
      pool: '밤일과',
      text: '내 그림자를 저당 잡히고 돈을 받는다',
      when: '그림자 >= 2',
      outcome: { text: '카운터 건너편에서 노파가 계산기를 두드렸습니다. "한 겹에 은화 스물다섯. 다시 찾으러 오는 사람은 드물지." 가위질이 한 번, 소리 없이 끝났습니다.', do: [call('그림자저당', { 수량: 1 })] },
    },
    {
      id: 'borrow',
      pool: '밤일과',
      text: '노파에게 돈을 빌린다 (빚 +10)',
      when: '빚 < 20',
      outcome: { text: '"이자는 매 밤 하나." 노파가 장부에 한 줄을 적었습니다. 은화 서른 닢이 카운터 위에서 소리를 냈습니다.', do: [add('빚', 10), add('은화', 30)] },
    },
    {
      id: 'repay',
      pool: '밤일과',
      text: '빚을 갚는다',
      when: '빚 > 0 and 은화 >= 5',
      outcome: { text: '장부의 이름 옆 숫자를 한 줄씩 지웠습니다. 노파는 모른 척 찻잔만 만졌습니다.', do: [call('빚갚기')] },
    },
  ],

  triggers: [
    { id: 'visit', name: '회차 기록', on: 'start', do: [add('방문횟수', 1), item('장부', 1, true)] },
    { id: 'nightfall', name: '밤이 온다', on: 'turnStart', do: [add('밤', 1)] },
    {
      id: 'breakdown_watch',
      name: '이성이 바닥나면 위기',
      on: 'watch',
      when: '이성 <= 0 and not $pending',
      do: [{ do: 'goto', event: 'breakdown' }],
    },
    {
      id: 'seizure_watch',
      name: '빚이 한계에 이르면 압류',
      on: 'watch',
      once: true,
      when: '빚 >= 20 and not $pending',
      do: [{ do: 'goto', event: 'seizure' }],
    },
    {
      id: 'shadow_watch',
      name: '그림자가 거의 사라지면',
      on: 'watch',
      once: true,
      when: '그림자 <= 1 and 그림자 > 0 and not $pending',
      do: [{ do: 'goto', event: 'thin_shadow' }],
    },
    {
      id: 'ash_cough',
      name: '재가 폐에 쌓인다',
      on: 'turnEnd',
      when: '밤 >= 9 and chance(20)',
      do: [add('체력', -1), note('재 섞인 기침이 한참 멎지 않았습니다.')],
    },
  ],

  endings: [
    { id: 'fall', title: '재 속에 쓰러지다', kind: 'death', when: '체력 <= 0', priority: 10, text: '{image lamp}\n무두질 골목 가스등 아래서 당신은 쓰러졌습니다. 재가 눈처럼 쌓였고, 아무도 문을 열지 않았습니다. 노파는 이튿날 아침 당신의 이름을 장부에 한 번 쓰고 한 번 지웠습니다.' },
    { id: 'hollow', title: '그림자 없는 사람', kind: 'bad', when: '그림자 <= 0', priority: 9, text: '당신의 발밑에서 마지막 한 겹이 떨어져 나갔습니다. 가스등 아래 서도 아무것도 비치지 않았습니다. 사람들은 이제 당신을 보면 길을 비키지 않고, 쳐다보지도 않습니다. 이안처럼. 이안과 같은 의자에서.' },
    { id: 'whispered', title: '대답하는 사람', kind: 'bad', text: '벽 속의 목소리는 매일 밤 조금 더 다정해졌고, 당신은 어느 날 대답했습니다. 가게는 이제 낮에도 문을 열지 않습니다. 가끔 지나가던 이가 안에서 두 사람의 대화 소리를 듣는다고 합니다.' },
    { id: 'indenture', title: '장부 속의 이름', kind: 'bad', text: '철제 가면 아래서 당신의 얼굴은 점점 잊혔습니다. 채권 추심 조합의 장부에는 당신 이름이 가장 깨끗한 필체로 적혀 있습니다. 갚을 때까지, 영원히.' },
    { id: 'returned', title: '돌아온 그림자', kind: 'good', text: '{image square}\n대등불은 푸른빛으로 타올랐습니다. 광장의 사람들은 하나둘 발밑을 보았고, 가스등 아래서 오랜만에 자기 그림자를 보았습니다. 성광회는 이 일을 오래도록 용서하지 않았지만 도시는 이날을 \'제 그림자를 돌려받은 밤\'이라 부르게 되었습니다.' },
    { id: 'darkness', title: '진짜 밤', kind: 'neutral', text: '도시의 가스등이 모두 꺼졌습니다. 아주 오랜 시간 끝에 사람들은 처음으로 어둠에 눈을 적응시켰습니다. 며칠은 혼란이었고, 몇 달은 공포였으며, 몇 해 뒤에는 어둠 속에서 하나둘 새로운 불이 켜졌습니다. 이제는 아무의 그림자도 태우지 않는 작은 불들이.' },
    { id: 'order', title: '질서의 불', kind: 'neutral', text: '대등불은 꺼지지 않았고 도시는 평온을 지켰습니다. 그림자를 바치는 일은 이제 \'시민의 의무\'라는 이름으로 불렸습니다. 당신은 성광회의 장부에 이름을 올렸고, 가끔 새벽에 자기 발밑을 확인했습니다. 아직은 있습니다. 아직은.' },
    { id: 'night_court', title: '붉은 도시', kind: 'bad', text: '아슈렐은 낮이 아니라 밤의 도시가 되었습니다. 붉은 야회는 가스등 아래서 가장 풍요로웠고, 당신은 그들의 문 앞에서 가장 값비싼 손님이었습니다. 도시는 더 밝아졌고, 더 조용해졌습니다. 사람들이 이야기를 덜 하게 되었기 때문입니다.' },
    { id: 'pawnbroker', title: '반달의 주인', kind: 'neutral', text: '당신은 이제 반달 전당포의 주인입니다. 노파는 마침내 눈을 감았고, 당신의 그림자는 선반 사이를 천천히 돌아다닙니다. 새 점원이 올 때까지, 혹은 불이 꺼질 때까지. 문패는 여전히 없지만, 유리창의 달은 언젠가부터 반쪽이 아닙니다.' },
    { id: 'wanted', title: '현상 수배', kind: 'bad', text: '병은 모두 돌려주었지만 대등불은 그대로였습니다. 이튿날 도시의 모든 벽에 당신의 초상이 붙었습니다. 쥐굴 사람들만이 당신에게 은밀히 빵 조각과 하수로 지도를 건넸습니다. 당신은 한동안 도시 밑에서 살았습니다.' },
    { id: 'ash_road', title: '재의 길', kind: 'neutral', text: '연기 천장이 끝나는 곳에서 당신은 처음으로 하늘 비슷한 것을 보았습니다. 희미한 푸른빛. 그것이 해인지 아닌지는 모릅니다. 돌아보니 아슈렐의 불은 아주 작은 점이었고, 발밑에는 아직 당신의 그림자가 따라오고 있었습니다.' },
    { id: 'dawn', title: '아직 오지 않은 새벽', kind: 'neutral', text: '열두 밤이 지났지만 아무것도 정해지지 않은 채 아침 비슷한 것이 왔습니다. 노파는 변함없이 카운터 뒤에 앉아 있었고, 반쪽 달은 여전히 반쪽이었습니다.' },
  ],

  epilogue: {
    header: '아슈렐, {밤}번째 밤. {$이름}의 이야기는 여기서 끝났습니다.',
    paragraphs: [
      {
        id: 'origin',
        order: 10,
        lines: [
          { when: "has('출신', '쥐굴')", text: '쥐굴의 아이로 시작해 도시 위로 올라왔습니다. 하수로의 어둠은 마지막까지 당신의 눈이었습니다.' },
          { when: "has('출신', '몰락귀족')", text: '재가 된 가문의 마지막 문장은, 어쩌면 이 전당포 장부에 이름이 올랐을 때 이미 완성되었는지도 모릅니다.' },
          { when: "has('출신', '수련사제')", text: '낙인이 가려울 때마다 당신은 빛이 무엇을 요구하는지, 그 질문을 다시 떠올렸습니다.' },
          { when: "has('출신', '재너머')", text: '해가 있다는 땅에서 온 사람. 당신이 이 도시에서 본 것은 훗날 먼 곳의 누군가에게 전해질 이야기가 되었습니다.' },
        ],
      },
      {
        id: 'shadow',
        order: 20,
        lines: [
          { when: '그림자 >= 4', text: '당신의 그림자는 마지막까지 짙었습니다. 가스등 아래에서도 선명했습니다.' },
          { when: '그림자 >= 1 and 그림자 < 4', text: '그림자는 얇아졌지만 아직 있었습니다. 아직은, 하고 당신은 속으로 덧붙였습니다.' },
          { when: "has('빌린그림자')", text: '당신 발밑의 그림자 한 겹은 병 속에서 빌려 온 것입니다. 가끔 그것이 혼자 다른 방향으로 늘어졌습니다.' },
          { when: "has('이름팔림')", text: '이름 한 글자를 팔아 얻은 은화는 어디에도 쓰이지 않았습니다. 장부 어딘가에 그 글자가 살아 있을 것입니다.' },
        ],
      },
      {
        id: 'allies',
        order: 30,
        lines: [
          { when: '교단 >= 3', text: '성광회는 당신을 \'빛의 벗\'이라 불렀습니다. 그 호칭이 칭찬인지 목줄인지는 시간이 말해 줄 것입니다.' },
          { when: '쥐굴 >= 3', text: '쥐굴 사람들은 당신 앞에서 모자를 벗었습니다. 하수로의 어둠 속에서 당신의 이름은 아이들의 자장가가 되었습니다.' },
          { when: '야회 >= 3', text: '붉은 야회의 잔은 마지막까지 당신 앞에 놓였습니다. 한 번도 비우지 않았고, 한 번도 거절하지 않았습니다.' },
          { when: "has('이르보호')", text: '도망 사제 이르는 먼 곳에서 소식을 전해 왔습니다. "낙인이 가렵지 않아요."' },
        ],
      },
      {
        id: 'truth',
        order: 40,
        lines: [
          { when: '진실 >= 6', text: '당신은 도시의 불이 무엇으로 타오르는지, 누가 그것을 알면서도 눈감았는지 끝까지 알아냈습니다.' },
          { when: '진실 >= 3 and 진실 < 6', text: '진실의 반쪽 정도는 알았습니다. 나머지 반쪽은 아직 병 속에서 일렁이고 있습니다.' },
          { when: '진실 < 3', text: '당신은 많은 것을 알지 못한 채 열두 밤을 지났습니다. 어쩌면 그것이 가장 안전한 일이었을지도 모릅니다.' },
          { when: "has('이안의부탁') and 진실 >= 3", text: '이안은 광장 가장자리에서 오래 손을 들고 있었습니다. 그림자 없는 남자의 미소는 아주 잠깐 사람처럼 보였습니다.' },
        ],
      },
      {
        id: 'debt',
        order: 50,
        lines: [
          { when: '빚 = 0 and 밤 >= 8', text: '이자 장부의 숫자는 한 줄도 남지 않았습니다. 노파가 마지막 날 처음으로 칭찬 비슷한 말을 했습니다.' },
          { when: '빚 >= 10', text: '장부의 빚은 끝내 갚지 못했고, 당신 이름은 그 아래 오랫동안 남았습니다.' },
        ],
      },
    ],
    footer: "{lookup('도시의기억', 도시점수, '문구')}",
  },

  achievements: [
    { id: '반달의점원', title: '반달의 점원', icon: '🌓', description: '한 번이라도 이야기를 끝까지 마쳤다 — 새 출신이 열립니다', when: "$엔딩 != ''" },
    { id: '그림자지킴이', title: '제 그림자를 지킨 사람', icon: '◐', description: '그림자가 4 이상인 채로 끝을 맞았다', when: "$엔딩 != '' and 그림자 >= 4" },
    { id: '돌려준밤', title: '돌려준 밤', icon: '🫙', description: '잃어버린 그림자를 주인에게 돌려주었다', when: "$엔딩 = 'returned'" },
    { id: '진실의끝', title: '불의 뿌리', icon: '🗝', description: '도시의 불이 무엇으로 타는지 끝까지 알아냈다', when: '진실 >= 7' },
    { id: '빚없는밤', title: '빚 없는 밤', icon: '✒', description: '빚을 모두 갚은 채 열 번째 밤을 맞았다', when: '밤 >= 10 and 빚 = 0' },
    { id: '속삭임을듣다', title: '대답을 미룬 사람', icon: '👂', description: '벽 속 목소리의 부름을 받고도 버텨 냈다', hidden: true, when: "seen('breakdown') and 이성 >= 2 and $엔딩 = ''" },
    { id: '세력무관', title: '누구의 편도 아닌', icon: '⚖', description: '세 세력 모두에게 문을 열지 않았다', hidden: true },
  ],

  assets: [
    { id: 'shop', kind: 'image', src: IMG_SHOP, alt: '반쪽 달이 걸린 전당포' },
    { id: 'lamp', kind: 'image', src: IMG_LAMP, alt: '가스등' },
    { id: 'cellar', kind: 'image', src: IMG_CELLAR, alt: '그림자 병이 늘어선 서가' },
    { id: 'square', kind: 'image', src: IMG_SQUARE, alt: '대등불이 선 광장' },
  ],
};
