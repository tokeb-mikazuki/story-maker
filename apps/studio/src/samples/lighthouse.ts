// 샘플 ② 이야기형 — 「등대의 마지막 밤」 (오리지널)
// 폭풍우 치는 하룻밤, 새로 부임한 등대지기가 꺼져 가는 불을 지키는 짧은 분기형 이야기.
// 보여 주는 기능: 시작 이벤트·goto 분기, 아이템 획득/사용/조건 선택지, 숨은 선택지, 판정, 확률 사망,
// 금지된 선택(즉시 엔딩), 수치(기름) 관리, 자동 엔딩, 초크포인트, 조건부 결산, 숨은 도전과제.

import type { StoryPackage } from '@engine';

export const lighthouse: StoryPackage = {
  format: 'ifb/1',
  meta: {
    id: 'sample:last-light',
    title: '등대의 마지막 밤',
    author: '이야기 공방 샘플',
    version: '1.0',
    description: '폭풍이 오는 밤, 당신은 무인도 등대에 홀로 부임했습니다. 기름은 모자라고, 바다 위엔 배 한 척이 다가옵니다. 그리고 누군가 문을 두드립니다. (10~15분)',
    tags: ['단편', '샘플', '미스터리'],
  },
  settings: {
    mode: 'story',
    calendar: { unit: 'none' },
    player: {},
    stages: [{ id: 'night', name: '밤', turn: { length: 1 }, phases: [{ type: 'events', pools: ['기본'], select: 'fixedThenRandom' }] }],
    start: 'arrival',
    idleEnding: { turns: 1, ending: 'dawn' },
    check: { formula: '40 + 15 * ($skill - $difficulty) + 정신력 * 2 + $bonus', min: 5, max: 95, display: 'label' },
    ui: { continueText: '계속' },
  },
  variables: [
    { id: '체력', type: 'number', initial: 6, min: 0, max: 6, integer: true, display: { as: 'bar', order: 1, notify: true, icon: '❤', color: '#c0563f' } },
    { id: '정신력', type: 'number', initial: 5, min: 0, max: 6, integer: true, display: { as: 'bar', order: 2, notify: true, icon: '✦', color: '#7a68b5' } },
    {
      id: '기름',
      type: 'number',
      initial: 2,
      min: 0,
      max: 5,
      integer: true,
      display: { as: 'bar', order: 3, notify: '등잔 기름 {delta}', icon: '🔥', color: '#d99a2b', labels: [{ upTo: 0, text: '불이 꺼졌다' }, { upTo: 1, text: '깜빡임' }, { upTo: 5, text: '' }] },
    },
    { id: '구조', type: 'number', initial: 0, integer: true, description: '구한 사람 수' },
    { id: '용기', type: 'number', initial: 2, min: 0, max: 5 },
    { id: '눈썰미', type: 'number', initialExpr: 'randint(1, 3)', min: 0, max: 5 },
  ],
  items: [
    { id: '밧줄', name: '젖은 밧줄', icon: '🪢', description: '선착장 기둥에 매여 있던 굵은 밧줄' },
    { id: '기름통', name: '기름통', icon: '🛢', description: '등잔 기름 2만큼', use: { text: '기름통을 등잔에 쏟아부었습니다. 불꽃이 다시 살아납니다.', do: [{ do: 'add', var: '기름', value: 2 }] } },
    { id: '일지', name: '전임자의 일지', icon: '📓', description: '물에 번진 글씨. 마지막 장이 찢겨 있다.', use: { consume: false, text: '"…그 여자가 또 왔다. 불을 끄라고 한다. 절대 끄면 안 된다. 그 여자는 십 년 전 이 앞바다에서…" 거기서 글씨가 번져 읽을 수 없습니다.', do: [{ do: 'tag', key: '비밀' }] } },
    { id: '성냥', name: '방수 성냥', icon: '🔥', description: '꺼진 불을 다시 붙일 수 있다' },
  ],
  statuses: [{ id: '젖음', name: '흠뻑 젖음', icon: '💧', tone: 'negative', description: '용기 −1', modifiers: { 용기: -1 } }],
  events: [
    {
      id: 'arrival',
      title: '부임',
      text: '보급선은 당신을 선착장에 내려놓자마자 뱃머리를 돌렸습니다. "폭풍 오기 전에 돌아가야 해서! 내일 아침에 데리러 오겠소!"\n섬에는 등대 하나, 창고 하나, 그리고 바람뿐입니다. 서쪽 하늘이 멍든 색으로 부풀어 오릅니다.',
      record: { text: '폭풍 전야, 무인도 등대에 부임했다', importance: 3 },
      choices: [
        { text: '곧장 등대로 올라간다', outcome: { goto: 'stairs' } },
        { text: '창고부터 살핀다', outcome: { goto: 'storehouse' } },
        { text: '선착장 기둥의 밧줄을 풀어 챙긴다', outcome: { text: '손이 얼얼하도록 매듭을 풀었습니다. 무거운 밧줄을 어깨에 걸쳤습니다.', do: [{ do: 'item', id: '밧줄', count: 1 }], goto: 'stairs' } },
      ],
    },
    {
      id: 'storehouse',
      title: '창고',
      text: '삐걱이는 문을 열자 곰팡이와 기름 냄새가 훅 끼칩니다. 녹슨 선반, 쓰러진 의자, 그리고 구석에 놓인 무언가.',
      choices: [
        { text: '기름통을 챙긴다', outcome: { text: '반쯤 찬 기름통입니다. 다행입니다.', do: [{ do: 'item', id: '기름통', count: 1 }], goto: 'stairs' } },
        { text: '책상 서랍을 뒤진다', outcome: { text: '방수 성냥 한 갑, 그리고 가죽 표지의 일지 한 권.', do: [{ do: 'item', id: '성냥', count: 1 }, { do: 'item', id: '일지', count: 1 }], goto: 'stairs' } },
        {
          text: '선반 맨 위를 살핀다',
          check: { skill: '눈썰미', difficulty: 2 },
          success: { text: '먼지 쌓인 선반 위에 기름통과 일지가 나란히 있었습니다. 누가 일부러 숨겨 둔 것처럼.', do: [{ do: 'item', id: '기름통', count: 1 }, { do: 'item', id: '일지', count: 1 }], goto: 'stairs' },
          failure: { text: '선반이 무너졌습니다. 녹슨 쇠붙이가 팔을 긁었습니다.', do: [{ do: 'add', var: '체력', value: -1 }], goto: 'stairs' },
        },
      ],
    },
    {
      id: 'stairs',
      title: '나선 계단',
      text: '등대 안은 생각보다 좁습니다. 백열여덟 칸의 나선 계단. 올라갈수록 바람 소리가 벽 너머에서 짐승처럼 웁니다.\n{if item(\'밧줄\') > 0}어깨의 밧줄이 점점 무거워집니다.{/if}',
      choices: [
        { text: '쉬지 않고 오른다', outcome: { do: [{ do: 'add', var: '체력', value: -1 }], goto: 'lamp_room' } },
        { text: '중간 창문에서 바다를 본다', outcome: { text: '검은 바다 저편, 아주 작은 불빛 하나가 깜빡입니다. 배입니다. 이쪽으로 오고 있습니다.', do: [{ do: 'tag', key: '배를봄' }, { do: 'add', var: '정신력', value: -1 }], goto: 'lamp_room' } },
      ],
    },
    {
      id: 'lamp_room',
      title: '등명기실',
      chokepoint: true,
      text: '꼭대기. 거대한 렌즈 한가운데에서 작은 불꽃이 위태롭게 흔들립니다. 기름이 거의 바닥입니다.\n{if 기름 <= 1}이대로라면 한 시간도 못 버팁니다.{/if}',
      record: '꺼져 가는 등대 불을 마주했다',
      choices: [
        { text: '기름통을 붓는다', requires: "item('기름통') > 0", outcome: { text: '불꽃이 크게 일어나 렌즈를 가득 채웁니다. 빛줄기가 바다를 가로지릅니다.', do: [{ do: 'item', id: '기름통', count: -1, silent: true }, { do: 'add', var: '기름', value: 2 }], goto: 'knock' } },
        { text: '렌즈를 닦아 빛을 키운다', check: { skill: '눈썰미', difficulty: 1 }, success: { text: '소금기 낀 렌즈를 닦자 같은 불꽃이 두 배는 밝아졌습니다.', do: [{ do: 'add', var: '기름', value: 1 }], goto: 'knock' }, failure: { text: '닦을수록 얼룩이 번집니다. 시간만 갔습니다.', do: [{ do: 'add', var: '기름', value: -1 }], goto: 'knock' } },
        { text: '심지를 줄여 아낀다', outcome: { text: '불빛이 약해졌습니다. 오래는 가겠지만, 저 멀리까지 닿을지는 모르겠습니다.', do: [{ do: 'tag', key: '약한불' }], goto: 'knock' } },
      ],
    },
    {
      id: 'knock',
      title: '노크',
      text: '쾅, 쾅, 쾅.\n백열여덟 칸 아래, 등대 문을 누군가 두드립니다. 이 섬에는 당신 말고 아무도 없어야 합니다.',
      choices: [
        { text: '내려가 문을 연다', outcome: { goto: 'woman' } },
        { text: '못 들은 척한다', outcome: { text: '노크는 한참 이어지다 멎었습니다. 정적이 노크보다 더 무섭습니다.', do: [{ do: 'add', var: '정신력', value: -2 }], goto: 'ship' } },
        { text: '전임자의 일지를 펼친다', requires: "item('일지') > 0", hidden: true, outcome: { text: '"그 여자가 또 왔다. 불을 끄라고 한다. 절대 끄면 안 된다."', do: [{ do: 'tag', key: '비밀' }], goto: 'woman' } },
      ],
    },
    {
      id: 'woman',
      title: '젖은 여자',
      text: '문을 열자 흠뻑 젖은 여자가 서 있습니다. 머리카락에서 바닷물이 뚝뚝 떨어집니다. 이 섬에 배를 댈 곳은 선착장 하나뿐이고, 그곳엔 아무 배도 없었습니다.\n"불을 꺼 주세요." 여자가 말합니다. "저 배가… 저 배가 이쪽으로 오면 안 돼요."',
      choices: [
        { text: '"알겠습니다." 불을 끈다', outcome: { text: '당신은 계단을 올라 불을 껐습니다. 여자는 고맙다고 웃었습니다. 그 웃음이 이상하게 차가웠습니다.\n잠시 후, 바다에서 끔찍한 소리가 들려왔습니다. 쇠가 바위에 찢기는 소리.', do: [{ do: 'end', ending: 'wreck' }] } },
        {
          text: '"등대 불은 끌 수 없습니다."',
          check: { skill: '용기', difficulty: 2 },
          success: { text: '여자는 오래 당신을 바라보다가, 빗속으로 걸어 나갔습니다. 발자국은 바다 쪽으로 이어지다 사라졌습니다.', do: [{ do: 'add', var: '정신력', value: -1 }, { do: 'tag', key: '거절함' }], goto: 'ship' },
          failure: { text: '여자의 눈을 보는 순간 다리가 얼어붙었습니다. 정신을 차렸을 때 여자는 없었고, 당신은 문간에 주저앉아 있었습니다.', do: [{ do: 'add', var: '정신력', value: -3 }, { do: 'tag', key: '거절함' }], goto: 'ship' },
        },
        {
          text: '"십 년 전, 이 앞바다에서 무슨 일이 있었죠?"',
          requires: "has('비밀')",
          requiresText: '무언가를 알아야 물어볼 수 있다',
          outcome: {
            text: '여자의 표정이 무너졌습니다. "…남편이 탄 배였어요. 등대 불을 보고 들어오다가, 암초에." 그녀가 등대 불을 미워한 건 불이 꺼져서가 아니었습니다. 불을 보고 너무 가까이 왔기 때문이었습니다.\n"오늘 저 배도 같은 길로 와요. 남쪽 암초 쪽으로."',
            do: [{ do: 'tag', key: '진실' }, { do: 'add', var: '정신력', value: 1 }],
            goto: 'ship',
          },
        },
      ],
    },
    {
      id: 'ship',
      title: '다가오는 배',
      text: '창밖으로 배의 불빛이 크게 보입니다. 어선입니다. 폭풍에 밀려 섬 쪽으로 다가오고 있습니다.{if has(\'진실\')} 남쪽 — 암초가 있는 쪽으로.{/if}\n{if 기름 <= 0}그리고 등대 불은 꺼져 있습니다.{elif has(\'약한불\')}약해진 불빛이 빗속에서 가물거립니다.{/if}',
      record: { text: '폭풍 속에서 길 잃은 배를 보았다', importance: 4 },
      choices: [
        { text: '꺼진 불을 성냥으로 다시 붙인다', requires: '기름 <= 0', hidden: true, outcome: { text: '젖은 손으로 성냥을 그었습니다. 세 번째에 불이 붙었습니다.', do: [{ do: 'item', id: '성냥', count: -1 }, { do: 'add', var: '기름', value: 1 }], goto: 'ship' } },
        {
          text: '등대 불빛을 깜빡여 남쪽 암초를 알린다',
          requires: '기름 >= 1',
          check: { skill: "has('진실') ? 3 : 1", difficulty: 2, bonus: "has('약한불') ? -20 : 0" },
          success: { text: '배가 천천히 뱃머리를 돌립니다. 암초를 비껴, 선착장 쪽으로.', do: [{ do: 'add', var: '구조', value: 3 }, { do: 'add', var: '기름', value: -1 }], goto: 'harbor' },
          failure: { text: '배는 신호를 알아보지 못했습니다. 남쪽으로, 계속 남쪽으로.', do: [{ do: 'add', var: '기름', value: -1 }], goto: 'reef' },
        },
        { text: '무적(霧笛)을 울린다', outcome: { text: '낡은 손잡이를 돌리자 섬 전체를 흔드는 저음이 울렸습니다. 배의 불빛이 멈칫합니다.', do: [{ do: 'add', var: '체력', value: -1 }, { do: 'add', var: '구조', value: 1 }], goto: 'reef' } },
      ],
    },
    {
      id: 'reef',
      title: '암초',
      text: '배가 암초에 걸렸습니다. 비명이 바람을 뚫고 들려옵니다. 갑판 위에서 누군가 손을 흔듭니다. 바위까지는 헤엄쳐 닿을 거리입니다. 물론, 이 날씨만 아니라면.',
      choices: [
        {
          text: '밧줄을 들고 바위로 내려간다',
          requires: "item('밧줄') > 0",
          results: [
            { weight: '6 + 용기', text: '바위에 밧줄을 묶고 배까지 던졌습니다. 한 사람, 또 한 사람. 마지막 사람이 바위를 밟는 순간 배가 기울었습니다.', do: [{ do: 'add', var: '구조', value: 4 }, { do: 'add', var: '체력', value: -2 }, { do: 'status', id: '젖음' }], goto: 'harbor' },
            { weight: 3, text: '파도가 당신을 바위에서 떼어 냈습니다.', do: [{ do: 'end', ending: 'swallowed' }] },
          ],
        },
        {
          text: '맨몸으로 뛰어든다',
          results: [
            { weight: 2, text: '기적처럼, 아이 하나를 안고 돌아왔습니다.', do: [{ do: 'add', var: '구조', value: 1 }, { do: 'add', var: '체력', value: -4 }], goto: 'harbor' },
            { weight: 5, text: '차가운 물이 숨을 앗아 갔습니다.', do: [{ do: 'end', ending: 'swallowed' }] },
          ],
        },
        { text: '등대에서 불을 지키며 기다린다', outcome: { text: '배는 새벽까지 버텼습니다. 몇 명은 스스로 헤엄쳐 바위에 닿았습니다.', do: [{ do: 'add', var: '정신력', value: -2 }, { do: 'add', var: '구조', value: 1 }], goto: 'harbor' } },
      ],
    },
    {
      id: 'harbor',
      title: '선착장',
      text: '{if 구조 >= 4}흠뻑 젖은 사람들이 선착장에 모여 앉았습니다. 누군가 당신 손을 붙잡고 울었습니다.{elif 구조 >= 1}몇 사람이 살아서 선착장에 닿았습니다.{else}선착장에는 아무도 없습니다.{/if}\n{if has(\'거절함\')}문득 돌아보니, 등대 문 앞에 젖은 발자국이 하나 찍혀 있었습니다. 바다 쪽으로 향한.{/if}',
      choices: [
        { text: '사람들을 등대 안으로 들인다', requires: '구조 >= 1', outcome: { text: '좁은 등대 안이 사람 온기로 가득 찼습니다. 아무도 잠들지 않았습니다.', do: [{ do: 'add', var: '정신력', value: 2 }] } },
        { text: '불 곁으로 돌아간다', outcome: { text: '렌즈 앞에 앉아 마지막 기름이 타들어 가는 것을 지켜봤습니다.' } },
      ],
    },
  ],
  endings: [
    { id: 'collapse', title: '쓰러진 등대지기', kind: 'death', when: '체력 <= 0', priority: 10, text: '계단 중간에서 당신은 쓰러졌습니다. 아침에 도착한 보급선 선원들이 당신을 찾아냈습니다.' },
    { id: 'madness', title: '바다의 목소리', kind: 'bad', when: '정신력 <= 0', priority: 9, text: '파도 소리 사이로 누군가 계속 당신 이름을 부릅니다. 당신은 대답하기로 했습니다.' },
    { id: 'wreck', title: '꺼진 불', kind: 'bad', text: '아침이 되자 남쪽 암초에 부서진 배의 잔해가 걸려 있었습니다. 그 여자는 다시 보이지 않았습니다. 다음 해 이 등대에는 새 등대지기가 왔습니다. 그는 서랍에서 일지 한 권을 발견했습니다.' },
    { id: 'swallowed', title: '바다에 삼켜지다', kind: 'death', text: '당신은 바다에 삼켜졌습니다. 그날 밤 등대 불은 아무도 지키지 않았는데도, 새벽까지 꺼지지 않았다고 합니다.' },
    { id: 'dawn', title: '새벽', kind: 'good', text: '폭풍이 지나가고 수평선이 밝아 옵니다. 보급선 고동 소리가 들립니다.' },
  ],
  epilogue: {
    paragraphs: [
      {
        id: 'result',
        order: 10,
        when: "$엔딩 = 'dawn'",
        lines: [
          { when: '구조 >= 4', text: '그날 밤 당신이 구한 사람은 {구조}명이었습니다. 그들은 평생 이 등대를 "우리 등대"라고 불렀습니다.' },
          { when: '구조 >= 1 and 구조 < 4', text: '몇 사람이 살아 돌아갔습니다. 전부는 아니었습니다.' },
          { when: '구조 = 0', text: '당신은 불을 지켰지만, 아무도 구하지 못했습니다.' },
        ],
      },
      {
        id: 'woman',
        order: 20,
        when: "has('진실')",
        lines: [{ text: '얼마 뒤 당신은 섬 남쪽 바위에 작은 비석을 세웠습니다. 십 년 전 이 앞바다에서 돌아오지 못한 배를 위해. 그 뒤로 노크 소리는 다시 들리지 않았습니다.' }],
      },
    ],
  },
  achievements: [
    { id: '전원구조', title: '모두를 집으로', icon: '🛟', description: '다섯 명 이상을 구했다', when: "구조 >= 5 and $엔딩 = 'dawn'" },
    { id: '불지킴이', title: '불을 지킨 사람', icon: '🔥', description: '새벽까지 살아남았다', when: "$엔딩 = 'dawn'" },
    { id: '진실', title: '십 년 전의 배', icon: '📓', description: '여자의 진실을 알아냈다', hidden: true, when: "has('진실')" },
  ],
  assets: [],
};
