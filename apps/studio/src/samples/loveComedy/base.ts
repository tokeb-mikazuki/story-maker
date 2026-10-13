// 「청화고 연애 금지령」의 틀: 설정, 변수, 아이템, 상태, 스크립트, 규칙, 엔딩, 결산, 도전과제, 에셋.

import type { AchievementDef, AssetDef, EndingDef, EpilogueDef, ItemDef, ScriptDef, Settings, StatusDef, TriggerDef, VariableDef } from '@engine';
import coverImg from './art/cover.jpg?inline';
import gateImg from './art/gate.jpg?inline';
import libraryImg from './art/library.jpg?inline';
import pressImg from './art/press.jpg?inline';
import rainImg from './art/rain.jpg?inline';
import roofImg from './art/roof.jpg?inline';
import sportsImg from './art/sports.jpg?inline';
import stageImg from './art/stage.jpg?inline';
import { add, end, go, iff, item, note, rec, tagAdd } from './helpers';

export const meta = {
  id: 'sample:love-comedy',
  title: '청화고 연애 금지령',
  author: '이야기 공방 샘플',
  version: '1.0',
  description:
    '교칙 제47조, 「교내 이성교제를 금한다」. 벌점은 세 번이면 학생부행. 그런데 개학 첫날부터 풍기 부회장에게 걸리고, 옆집 소꿉친구는 매일 아침 당신을 깨우러 오고, 연극부 에이스는 당신을 상대역으로 점찍었고, 신문부 기자는 당신을 특종으로 점찍었습니다. 스물네 주 동안 사랑하고, 들키고, 해명하고, 또 사랑하세요. 문화제 밤까지. (남성향 러브코미디 · 60~90분 · 엔딩 16종)',
  tags: ['장편', '샘플', '학원', '러브코미디', '남성향', '멀티엔딩'],
  cover: 'cover',
};

export const settings: Settings = {
  mode: 'story',
  calendar: { unit: 'none' },
  player: { askName: true, defaultName: '도윤' },
  stages: [
    {
      id: 'term',
      name: '학기',
      turn: { length: 1 },
      phases: [
        { type: 'events', pools: ['주요'], select: 'fixed' },
        { type: 'events', pools: ['일상'], select: 'random', chance: 62 },
        { type: 'events', pools: ['인연'], select: 'random', chance: 50 },
        { type: 'events', pools: ['사건'], select: 'random', chance: 26 },
        {
          type: 'menu',
          pool: '방과후',
          title: '방과 후',
          text: '{주}주차, {if 주 <= 4}아직 서로 어색한 봄{elif 주 <= 14}교정이 한창 시끄러운 계절{elif 주 <= 18}매미 소리가 쏟아지는 여름{else}문화제 포스터가 복도를 뒤덮은 가을{/if}. 종이 울렸습니다. 오늘은 무엇을 할까요?',
        },
      ],
    },
  ],
  start: 'gate',
  maxTurns: { turns: 30, ending: 'afterglow' },
  check: {
    formula: '46 + 11 * ($skill - $difficulty) + (자신감 - 4) * 2 + $bonus',
    min: 5,
    max: 95,
    display: 'label',
    labels: [
      { below: 25, text: '거의 불가능' },
      { below: 45, text: '어려움' },
      { below: 65, text: '반반' },
      { below: 85, text: '유리함' },
      { below: 101, text: '거의 확실' },
    ],
    successNote: '성공!',
    failureNote: '실패…',
  },
  scheduler: { defaultWeight: 10, groupBlock: 1, toneBalance: { window: 4, threshold: 3, factor: 0.5 } },
  ui: {
    continueText: '다음',
    typewriter: true,
    terms: { inventory: '가방', items: '소지품', statuses: '컨디션', use: '쓴다' },
    theme: { '--paper': '#fffaf4', '--ink': '#34293f', '--accent': '#d9628b', '--muted': '#8c7f96', '--line': '#efd9e2' },
  },
};

const affection = (id: string, name: string, order: number, color: string): VariableDef => ({
  id,
  name,
  type: 'number',
  initial: 0,
  min: 0,
  max: 10,
  integer: true,
  group: '호감',
  display: {
    as: 'text',
    order,
    icon: '♥',
    color,
    notify: `${name}와의 거리 {delta}`,
    labels: [
      { upTo: 0, text: '모르는 사이' },
      { upTo: 2, text: '아는 사이' },
      { upTo: 4, text: '친한 사이' },
      { upTo: 6, text: '신경 쓰이는 사이' },
      { upTo: 8, text: '두근거리는 사이' },
      { upTo: 10, text: '특별한 사이' },
    ],
  },
});

export const variables: VariableDef[] = [
  { id: '주', name: '학기', type: 'number', initial: 0, min: 0, integer: true, display: { as: 'number', order: 0, format: '{value}주차' } },
  { id: '기운', type: 'number', initial: 8, min: 0, max: 10, integer: true, display: { as: 'bar', order: 1, notify: true, icon: '⚡', color: '#e6a23c' }, description: '0이 되면 보건실행' },
  { id: '용돈', type: 'number', initial: 30, min: 0, integer: true, display: { as: 'number', order: 2, notify: '용돈 {delta}', format: '{value}천 원', icon: '₩' } },
  { id: '성적', type: 'number', initial: 5, min: 0, max: 10, integer: true, display: { as: 'bar', order: 3, notify: true, icon: '✎', color: '#5b8bd6' }, description: '시험과 수업으로 오르내린다' },
  { id: '자신감', type: 'number', initial: 4, min: 0, max: 10, integer: true, display: { as: 'bar', order: 4, notify: true, icon: '★', color: '#c77dd6' }, description: '판정과 고백의 밑바탕' },
  {
    id: '소문',
    type: 'number',
    initial: 0,
    min: 0,
    max: 10,
    integer: true,
    display: { as: 'bar', order: 5, notify: '소문 {delta}', icon: '📣', color: '#e0584b', labels: [{ upTo: 0, text: '잠잠' }, { upTo: 3, text: '수군수군' }, { upTo: 6, text: '웅성웅성' }, { upTo: 9, text: '교내 화제' }, { upTo: 10, text: '속보' }] },
    description: '10이 되면 교지 1면',
  },
  { id: '벌점', name: '풍기 벌점', type: 'number', initial: 0, min: 0, max: 5, integer: true, display: { as: 'number', order: 6, notify: '벌점 {delta}', icon: '⚠', format: '{value}/3' }, description: '3점이면 학생부 호출' },
  { id: '센스', type: 'number', initialExpr: 'randint(1, 3)', min: 0, max: 6, integer: true, group: '재주', display: { as: 'number', order: 10, notify: true } },
  { id: '성실', type: 'number', initialExpr: 'randint(1, 3)', min: 0, max: 6, integer: true, group: '재주', display: { as: 'number', order: 11, notify: true } },
  { id: '다정', type: 'number', initialExpr: 'randint(1, 3)', min: 0, max: 6, integer: true, group: '재주', display: { as: 'number', order: 12, notify: true } },
  { id: '배짱', type: 'number', initialExpr: 'randint(1, 3)', min: 0, max: 6, integer: true, group: '재주', display: { as: 'number', order: 13, notify: true } },
  affection('서윤호감', '한서윤', 20, '#d9628b'),
  affection('하린호감', '송하린', 21, '#e69a3c'),
  affection('유나호감', '채유나', 22, '#a96ad6'),
  affection('서현호감', '백서현', 23, '#58b08b'),
  {
    id: '하준우정',
    name: '도하준',
    type: 'number',
    initial: 0,
    min: 0,
    max: 10,
    integer: true,
    display: { as: 'text', order: 30, icon: '🎧', notify: '하준과의 우정 {delta}', labels: [{ upTo: 0, text: '옆 반 녀석' }, { upTo: 3, text: '친구' }, { upTo: 6, text: '절친' }, { upTo: 10, text: '평생 친구' }] },
    description: '방송부 에이스. 남자 쪽 절친(연애 대상이 아니다)',
  },
  {
    id: '태오신뢰',
    name: '강태오',
    type: 'number',
    initial: 0,
    min: 0,
    max: 10,
    integer: true,
    display: { as: 'text', order: 31, icon: '📚', notify: '태오 선배와의 신뢰 {delta}', labels: [{ upTo: 0, text: '모르는 선배' }, { upTo: 3, text: '인사하는 선배' }, { upTo: 6, text: '조언을 구하는 선배' }, { upTo: 10, text: '믿고 따르는 멘토' }] },
    description: '도서부 3학년 선배. 공부와 진로의 멘토(연애 대상이 아니다)',
  },
  { id: '지훈우정', name: '오지훈', type: 'number', initial: 0, min: 0, max: 6, integer: true, display: { as: 'text', order: 32, icon: '🤝', labels: [{ upTo: 1, text: '반 친구' }, { upTo: 3, text: '단짝' }, { upTo: 5, text: '믿는 친구' }, { upTo: 6, text: '베스트 프렌드' }] } },
  { id: '마루', type: 'number', initial: 0, min: 0, max: 5, integer: true, display: { as: 'text', order: 33, icon: '🐾', labels: [{ upTo: 0, text: '경계 중' }, { upTo: 2, text: '곁눈질' }, { upTo: 4, text: '무릎에 올라옴' }, { upTo: 5, text: '집사 인정' }] } },
  { id: '진심', type: 'number', initial: 0, min: 0, max: 12, integer: true, display: { as: 'hidden' }, description: '솔직하게 마음을 보인 횟수(숨김)' },
  { id: '허세', type: 'number', initial: 0, min: 0, max: 12, integer: true, display: { as: 'hidden' }, description: '두 마음 사이에서 얼버무린 횟수(숨김)' },
  { id: '인기', type: 'number', formula: 'sum("호감")', description: '다섯 사람과의 거리를 합한 값(숨김)', display: { as: 'hidden' } },
  { id: '최애', type: 'string', initial: '', description: '가장 가까운 사람의 ID(숨김)', display: { as: 'hidden' } },
  { id: '회차', type: 'number', initial: 0, scope: 'meta', description: '플레이 횟수(메타)' },
];

export const items: ItemDef[] = [
  { id: '도시락', name: '엄마표 도시락', icon: '🍱', description: '기운 +3', use: { text: '뚜껑을 열자 계란말이가 반겨 줍니다. 기운이 차오릅니다.', do: [add('기운', 3)] } },
  { id: '에너지드링크', name: '에너지 드링크', icon: '🥤', description: '기운 +4, 대신 나중에 졸립니다', use: { text: '캔을 따고 단숨에 들이켰습니다. 심장이 두근거립니다. 카페인 때문입니다. 아마도.', do: [add('기운', 4), { do: 'status', id: '카페인' }] } },
  { id: '초콜릿', name: '초콜릿', icon: '🍫', description: '선물용. 누구에게 줄지는 당신 몫', hidden: false },
  { id: '손수건', name: '손수건', icon: '🧣', description: '돌려줘야 할 누군가의 손수건', hidden: false },
  { id: '고양이간식', name: '고양이 간식', icon: '🐟', description: '마루가 이 봉지 소리에만 반응한다', use: { when: '마루 < 5', consume: true, text: '봉지를 흔들자 어디선가 방울 소리가 들려옵니다. 마루가 당신 발목에 몸을 비볐습니다.', do: [add('마루', 1), add('자신감', 1)] } },
  { id: '필기노트', name: '서윤의 필기 노트', icon: '📒', description: '색색 형광펜이 정갈하다. 성적 +1', use: { text: '노트를 펼치자 공부가 이상하게 쏙쏙 들어옵니다. 여백에 작은 고양이 낙서가 있습니다.', do: [add('성적', 1)] } },
  { id: '우산', name: '투명 비닐우산', icon: '☂', description: '비 오는 날, 누군가와 나눠 쓸 수 있다', hidden: false },
  { id: '믹스테이프', name: '하준의 믹스테이프', icon: '📼', description: '방송부 엔딩곡 후보. 첫 곡 제목이 우리 이름 같다', hidden: false },
  { id: '대본', name: '유나의 대본', icon: '📜', description: '"상대역 1"에 당신 이름이 연필로 적혀 있다', hidden: false },
  { id: '책갈피', name: '태오의 책갈피', icon: '🔖', description: '은색 책갈피. 뒷면에 작은 글씨가 있다', hidden: false },
  { id: '취재수첩', name: '서현의 취재 수첩', icon: '🗒', description: '빌린 물건. 읽지 않기로 약속했다', hidden: false },
  { id: '핫팩', name: '핫팩', icon: '🔥', description: '기운 +1, 감기 예방', use: { text: '주머니 속 핫팩이 따뜻합니다. 몸이 풀립니다.', do: [add('기운', 1), { do: 'status', id: '감기', remove: true, silent: true }] } },
  { id: '풍기면제권', name: '풍기 면제권', icon: '🎫', description: '딱 한 번, 벌점을 지워 준다(서윤의 서명)', use: { when: '벌점 > 0', text: '면제권을 내밀자 서윤이 한숨을 쉬며 도장을 찍었습니다. "이번 한 번뿐입니다."', do: [add('벌점', -1)] } },
  { id: '응원머리띠', name: '응원 머리띠', icon: '🎀', description: '체육대회 전용. 쓰면 용기가 난다', hidden: false, modifiers: { 배짱: 1 } },
];

export const statuses: StatusDef[] = [
  { id: '감기', name: '감기', icon: '🤧', tone: 'negative', duration: 3, description: '센스 −1, 매주 기운 −1', modifiers: { 센스: -1 }, onTurnEnd: [add('기운', -1)] },
  { id: '설렘', name: '설렘', icon: '💓', tone: 'positive', duration: 2, description: '다정 +1, 성실 −1', modifiers: { 다정: 1, 성실: -1 } },
  { id: '카페인', name: '카페인', icon: '☕', tone: 'positive', duration: 1, description: '이번 주 성실 +1. 끝나면 졸립니다', modifiers: { 성실: 1 }, onExpire: [{ do: 'status', id: '졸림' }] },
  { id: '졸림', name: '졸림', icon: '😪', tone: 'negative', duration: 2, description: '성실 −1, 센스 −1', modifiers: { 성실: -1, 센스: -1 } },
  { id: '소문의주인공', name: '소문의 주인공', icon: '📣', tone: 'negative', duration: 3, description: '배짱 −1, 매주 소문 +1', modifiers: { 배짱: -1 }, onTurnEnd: [add('소문', 1)] },
  { id: '오해', name: '오해받는 중', icon: '💢', tone: 'negative', duration: 2, description: '다정 −1', modifiers: { 다정: -1 } },
  { id: '열정', name: '열정 충전', icon: '🔥', tone: 'positive', duration: 3, description: '배짱 +1, 성실 +1', modifiers: { 배짱: 1, 성실: 1 } },
  { id: '벌점경고', name: '풍기 요주의', icon: '⚠', tone: 'negative', description: '벌점이 2 이상이면 붙는다. 서윤이 지켜본다', modifiers: { 배짱: -1 }, hidden: false },
  { id: '짝사랑', name: '두근두근', icon: '💘', tone: 'neutral', duration: 3, description: '성실 −1, 센스 +1. 이유는 모릅니다', modifiers: { 성실: -1, 센스: 1 } },
];

export const scripts: ScriptDef[] = [
  {
    id: '들킴',
    name: '교내에서 들키다',
    params: ['소문량', '벌점량'],
    do: [add('소문', '$소문량'), add('벌점', '$벌점량'), iff('벌점 >= 2', [{ do: 'status', id: '벌점경고', silent: true }]), iff('소문 >= 6', [{ do: 'status', id: '소문의주인공' }])],
  },
  {
    id: '마음전하기',
    name: '진심을 전하다',
    params: ['양'],
    do: [add('진심', '$양'), add('자신감', 1), note('마음을 숨기지 않았습니다.')],
  },
  {
    id: '얼버무리기',
    name: '얼버무리다',
    do: [add('허세', 1), add('소문', 1), note('말끝을 흐렸습니다. 어쩐지 누군가의 눈이 가늘어졌습니다.')],
  },
];

export const triggers: TriggerDef[] = [
  { id: 'new_run', name: '회차 기록', on: 'start', do: [add('회차', 1), item('우산', 1, true), item('초콜릿', 1, true)] },
  { id: 'new_week', name: '한 주가 시작된다', on: 'turnStart', do: [add('주', 1)] },
  { id: 'recover', name: '주말에 조금 쉰다', on: 'turnEnd', when: '기운 < 6 and chance(50)', do: [add('기운', 1)] },
  { id: 'rumor_fade', name: '소문은 잊힌다', on: 'turnEnd', when: '소문 > 0 and chance(45)', do: [add('소문', -1)] },
  { id: 'who', name: '가장 가까운 사람', on: 'turnEnd', do: [{ do: 'set', var: '최애', value: 'top("호감")' }] },
  { id: 'collapse_watch', name: '기운이 바닥나면', on: 'watch', when: '기운 <= 0 and not $pending', do: [go('collapse')] },
  { id: 'rumor_watch', name: '소문이 터지면', on: 'watch', once: true, when: '소문 >= 10 and not $pending', do: [go('rumor_blast')] },
  { id: 'discipline_watch', name: '벌점이 3점이 되면', on: 'watch', when: '벌점 >= 3 and not $pending', do: [go('student_office')] },
  { id: 'grade_watch', name: '성적이 바닥이면', on: 'watch', once: true, when: '성적 <= 1 and 주 >= 6 and not $pending', do: [go('remedial_call')] },
];

export const endings: EndingDef[] = [
  { id: 'seoyun_love', title: '풍기 위반 1호', kind: 'good', text: '{image roof}\n"…규칙을 어긴 건 처음입니다."\n서윤은 팔의 완장을 천천히 풀어 당신 손목에 채웠습니다. 풍기위원 완장이 어울리지 않게 헐렁합니다.\n"그러니까 책임지세요. 제 첫 번째 위반 사항을."\n이듬해 3월, 교칙 제47조는 「교내 이성교제를 금한다. 단, 학생회 부회장의 서명이 있는 경우는 예외로 한다」로 개정되었습니다. 서명란에는 아직 한 사람 이름만 올라 있습니다.' },
  { id: 'harin_love', title: '옆집 창문, 불 켜진 두 번째 방', kind: 'good', text: '{image roof}\n옥상 난간 위에서 하린이 도시락통을 끌어안고 서 있었습니다. 다 식은 계란말이가 들어 있는 통입니다. 아침마다 깨우러 오던 사람이, 오늘은 먼저 와서 기다리고 있었습니다.\n"…있잖아, 나 어릴 때부터 옆집 창문만 보고 살았거든. 네 방 불이 켜져 있으면 안심이 되고, 꺼져 있으면 괜히 걱정되고." 하린이 숨을 한 번 들이쉬었다가 웃었습니다. "이제 그 창문 말고, 옆에서 보면 안 돼?"\n다음 날 아침, 현관 벨이 울렸습니다. 늘 같은 시간, 늘 같은 얼굴인데 이상하게 처음 보는 사람 같았습니다. 손을 맞잡은 채 같이 걸은 등굣길에서 하준이 멀찍이 방송용 마이크를 들었다가 슬며시 내려놓았습니다. 이번만큼은 방송하지 않기로 한 모양입니다.' },
  { id: 'yuna_love', title: '커튼콜은 두 사람에게', kind: 'good', text: '{image stage}\n유나는 무대 가운데서 대사를 멈추고 객석의 당신을 똑바로 바라보았습니다. 대본에 없는 대사가 이어졌습니다.\n"주연은 한 번도 정해진 적 없었어요. 오늘 제가 정했습니다."\n막이 내리고도 박수는 한참 이어졌습니다. 연극부 단체 사진 속, 유나의 왕관 핀이 당신의 머리에 꽂혀 있습니다. 상대역 1은 이제 정식 이름이 되었습니다.' },
  { id: 'bros', title: '사나이들의 문화제', kind: 'neutral', text: '{image roof}\n문화제가 끝난 옥상에서 하준이 캔 콜라를 던졌습니다. 태오 선배는 말없이 책 대신 캔을 받아 들었고, 지훈은 컵라면 세 개를 들고 나타났습니다.\n"야, 이번 학기 우리 셋이 네 연애사를 제일 많이 들었다." "…결과는 별로 못 봤지만." "그래도 이게 제일 길게 남는 법이야."\n하준은 방송 마이크를 쥐고 마지막 곡을 틀었습니다. 연애는 잠시 미뤄 두기로 한 네 사람이 낡은 옥상 난간에 나란히 기대어 불꽃놀이를 보았습니다. 이 우정이 평생 가리라는 건 누구도 입 밖에 내지 않았지만 모두가 알았습니다.' },
  { id: 'seohyeon_love', title: '특종: 우리 둘', kind: 'good', text: '{image press}\n다음 날 청화고 교지 1면. 사진도 헤드라인도 서현이 직접 썼습니다.\n〈특종〉 기자, 취재원과 사랑에 빠지다.\n"기자는 중립이어야 하는데… 이건 도저히 중립이 안 되더라고요."\n서현은 카메라를 내려놓고 수첩의 마지막 장을 넘겼습니다. 거기엔 당신 이름 하나만 수십 번 지워지고 다시 쓰여 있었습니다.' },
  { id: 'repeal', title: '연애 금지령, 폐지', kind: 'good', text: '{image stage}\n마이크를 잡은 당신의 손이 떨렸습니다. 운동장이 조용해졌고, 맨 앞줄에서 서윤이 완장을 쥔 채 서 있었습니다.\n"…교칙 제47조는, 마음을 막으려고 만든 게 아니라 마음을 지키려고 만든 거였다고 생각합니다. 그러니까 이제는 지킬 줄 아는 사람들에게 맡겨 주세요."\n긴 정적. 그리고 박수. 가장 먼저 박수를 친 사람은 교장 선생님이었고, 가장 늦게 박수를 친 사람은 담임 김삼순 선생님이었습니다. 눈이 붉었습니다.\n이듬해 3월 교칙집에서 제47조는 삭제되었습니다. 대신 신설된 제47조는 단 한 줄입니다. 「서로를 괴롭히지 말 것.」' },
  { id: 'friends', title: '모두의 문화제', kind: 'good', text: '{image roof}\n끝내 누구에게도 고백하지 못한 채 문화제는 끝났습니다. 그런데 이상하게 후련했습니다.\n서윤은 완장을 벗고 쓰레기를 함께 주웠고, 하준은 마이크로 당신 이름을 마지막으로 크게 외쳤고, 유나는 대본을 접어 비행기를 날렸고, 태오는 조용히 옆에서 걸었고, 서현은 사진을 한 장 찍어 주었습니다.\n사진 속 모두가 웃고 있습니다. 연애는 아니었지만, 이건 틀림없이 청춘이었습니다.' },
  { id: 'solo', title: '혼자서도 반짝', kind: 'neutral', text: '모두가 짝을 지어 흩어지는 문화제 마지막 밤, 당신은 혼자 옥상에 올라갔습니다. 불꽃이 올랐고, 운동장이 환해졌습니다.\n쓸쓸할 줄 알았는데 아니었습니다. 시험도, 동아리도, 사람들도 스스로 해낸 봄이었습니다.\n"좋은 봄이었어."\n혼잣말이 생각보다 단단하게 울렸습니다. 주머니 속 초콜릿은 스스로 까서 먹었습니다. 의외로 달았습니다.' },
  { id: 'maru', title: '고양이가 이겼다', kind: 'neutral', text: '사람들은 짝을 찾았고, 당신은 옥상 난간에서 마루와 불꽃놀이를 보았습니다. 마루는 무릎에 올라와 골골거렸습니다.\n다음 날, 학교 게시판에 새 공지가 붙었습니다. 「교내 길고양이 마루의 공식 보호자: 2학년 {$이름}」.\n서명란에는 교장, 학생회장, 그리고 몰래 따라 찍은 모두의 도장이 있습니다. 가장 확실하게 사랑받은 쪽은 아마 마루일 것입니다.' },
  { id: 'best_friend', title: '베스트 프렌드는 지훈', kind: 'neutral', text: '{image roof}\n문화제가 끝나고 교문 앞에서 지훈이 어깨를 툭 쳤습니다.\n"야, 너 이번 학기에 누구한테도 안 걸리고 나만 계속 붙어 다녔는데, 눈치 챈 사람 있냐?"\n"…없는 것 같은데."\n"그럼 다음 학기엔 진짜 연애해라. 내가 매니저 해 줄게."\n둘은 편의점에서 컵라면을 먹으며 밤을 보냈습니다. 지훈의 수첩에는 이미 당신의 연애 상담 사례가 열두 건 적혀 있습니다.' },
  { id: 'chaos', title: '문화제 대혼란', kind: 'bad', text: '"잠깐, 지금 {$이름}{이/가} 누구한테 한 말이야?"\n"나한테 한 말이지?" "무슨 소리야, 나지." "저 두 사람, 같은 대본을 들고 있는데…"\n마이크는 켜진 채였고, 방송부는 이미 생중계 중이었습니다. 서현의 카메라가 플래시를 터뜨렸고, 마루가 무대 위를 가로질렀고, 스피커에서는 서윤의 낮은 목소리가 울렸습니다.\n"…풍기위원 권한으로 선언합니다. 당사자 전원, 학생부로."\n연애는 실패했지만 그날의 영상은 청화고 역사상 최다 조회수를 기록했습니다.' },
  { id: 'scandal', title: '교지 1면: 청화고 연애사변', kind: 'bad', text: '{image press}\n문화제 아침, 교문에서부터 교지가 뿌려지고 있었습니다. 1면 헤드라인은 이름 석 자를 가리지도 않았습니다.\n〈속보〉 연애 금지령 아래 피어난 사각관계, 그 주인공은.\n해명하려 할수록 이야기는 더 부풀었습니다. 누구에게도 마음을 전하지 못한 채 당신은 학생부로 불려 갔고, 담임은 한숨 섞인 목소리로 말했습니다.\n"다음 학기에… 전학 갈래?"' },
  { id: 'suspension', title: '정학 3일, 사랑은 무기한', kind: 'bad', text: '벌점은 마침내 한계를 넘었고, 학생부 앞에서 당신은 담담하게 서류에 도장을 찍었습니다. 정학 3일.\n집 침대에 누워 천장을 보는데 문자가 한 통 왔습니다. 번호는 모르는 번호인데 말투는 아는 사람 같았습니다.\n〈필기 정리해서 두고 갈게요. 우편함 확인.〉\n문화제는 놓쳤지만, 우편함에는 노트와 함께 작은 메모가 들어 있었습니다. 「사랑은 정학 중에도 기한이 없는 것 같습니다.」' },
  { id: 'burnout', title: '보건실의 장기 투숙객', kind: 'bad', text: '아무리 쉬어도 몸이 말을 듣지 않았습니다. 보건 선생님은 체온계를 내려놓고 단호하게 말했습니다.\n"이번 학기는 여기서 쉬세요. 문화제는 창문으로 보는 걸로."\n보건실 창가 침대에서 운동장의 등불과 먼 불꽃을 보았습니다. 누군가 복도를 뛰어오는 발소리가 들렸지만, 문은 열리지 않았습니다. 꿈이었는지 모릅니다. 베개 옆에는 이름 모를 핫팩이 하나 놓여 있었습니다.' },
  { id: 'remedial', title: '보충반의 사랑은 길다', kind: 'neutral', text: '문화제가 끝나고 맞은 월요일. 보충반 교실에는 칠판 가득 풀이 과정이 적혀 있었고, 책상 맨 앞줄에는 당신이 앉아 있었습니다. 그 옆자리에는 의외의 얼굴이 앉아 있었습니다. 같은 보충반이었습니다.\n"…공부가 안 돼서 이쪽으로 온 건 아니거든요."\n뭐라고 대꾸하려는데 선생님의 출석 호명이 시작되었습니다. 졸음 속에서 수학 공식이 들렸습니다. 어쩐지 이쪽이 더 오래 갈 것 같은 인연이었습니다.' },
  { id: 'afterglow', title: '아직 끝나지 않은 봄', kind: 'neutral', text: '문화제는 지나갔지만 이야기는 정리되지 않았습니다. 사람들은 각자 조금씩 어긋난 채로 가을을 맞았고, 교정의 은행잎이 노랗게 변했습니다.\n봄은 끝났는데 마음은 아직입니다. 이 이야기에는 다음 학기가 있겠지요.' },
];

export const epilogue: EpilogueDef = {
  header: '청화고 2학년 {$이름}의 {주}주, 이렇게 끝났습니다.',
  paragraphs: [
    {
      id: 'closest',
      order: 10,
      lines: [
        { when: "최애 == '서윤호감' and 서윤호감 >= 5", text: '가장 가까웠던 사람은 한서윤이었습니다. 완장과 자, 그리고 아무도 모르는 귀 끝의 붉은빛.' },
        { when: "최애 == '하린호감' and 하린호감 >= 5", text: '가장 가까웠던 사람은 송하린이었습니다. 옆집 창문 너머로 오래 지켜본, 아침마다 문을 두드리던 목소리.' },
        { when: "최애 == '유나호감' and 유나호감 >= 5", text: '가장 가까웠던 사람은 채유나였습니다. 어디서든 무대가 되는 사람 곁에서 당신도 조금 주인공이 되었습니다.' },
        { when: "최애 == '서현호감' and 서현호감 >= 5", text: '가장 가까웠던 사람은 백서현이었습니다. 취재라는 핑계로 가장 많이 당신을 관찰한 사람.' },
        { when: '인기 < 5', text: '이번 학기, 마음은 아직 아무 데도 정착하지 못했습니다. 그것도 청춘의 한 가지 모양입니다.' },
      ],
    },
    {
      id: 'grades',
      order: 20,
      lines: [
        { when: '성적 >= 8', text: '성적은 상위권을 지켰습니다. 사랑과 공부를 동시에 한 사람은 의외로 드뭅니다.' },
        { when: '성적 >= 4 and 성적 < 8', text: '성적은 무난했습니다. 연애하느라 망한 건 아니라고 우기기엔 충분한 정도였습니다.' },
        { when: '성적 < 4', text: '성적표는 조용히 서랍에 넣었습니다. 담임이 가정통신문을 보낼 날이 두렵습니다.' },
      ],
    },
    {
      id: 'rumor',
      order: 30,
      lines: [
        { when: '소문 >= 7', text: '교내에서 {$이름}의 이름을 모르는 사람은 이제 없습니다. 좋든 나쁘든 유명인이 되었습니다.' },
        { when: '소문 < 3', text: '끝까지 조용했습니다. 서현조차 한 줄 기사를 쓰지 못했을 만큼.' },
        { when: '벌점 >= 2', text: '풍기 벌점 {벌점}점. 서윤의 장부에 이름이 가장 많이 올라간 학생이었습니다.' },
      ],
    },
    {
      id: 'maru',
      order: 40,
      lines: [{ when: '마루 >= 3', text: '마루는 이제 당신이 오면 먼저 꼬리를 세웁니다. 교내 길고양이 가운데 유일한 단골입니다.' }, { when: '하준우정 >= 5', text: '하준은 끝까지 가장 시끄러운 응원단이었습니다. 방송실 마이크로 몇 번이나 당신 이름을 불렀는지 본인도 모릅니다.' }, { when: '태오신뢰 >= 5', text: '태오 선배는 졸업식 날 당신에게 책 한 권을 건넸습니다. 첫 장에 연필로 한 줄이 적혀 있었습니다. 「네가 정한 길이 맞는 길이야.」' }, { when: '지훈우정 >= 4', text: '지훈은 끝까지 곁에서 연애 상담을 받아 주었습니다. 수수료로 편의점 컵라면을 열두 번 받았습니다.' }],
    },
  ],
  footer: '이 이야기는 여기서 끝나지만, 교칙 제47조는 계속 개정 중입니다.',
};

export const achievements: AchievementDef[] = [
  { id: '첫걸음', title: '개학 첫날의 충돌', icon: '🌸', description: '이야기를 한 번 끝까지 마쳤다', when: "$엔딩 != ''" },
  { id: '풍기1호', title: '풍기 위반 1호', icon: '⚠', description: '한서윤 엔딩을 보았다', when: "$엔딩 == 'seoyun_love'" },
  { id: '금지령폐지', title: '교칙 제47조 폐지', icon: '📜', description: '연애 금지령을 없앴다', when: "$엔딩 == 'repeal'" },
  { id: '모두와', title: '모두와 친구', icon: '🤝', description: '모두와 친구가 된 채 문화제를 끝냈다', when: "$엔딩 == 'friends'" },
  { id: '남자들의우정', title: '사나이들의 문화제', icon: '🥤', description: '하준·태오·지훈과 함께 문화제를 마쳤다', when: "$엔딩 == 'bros'" },
  { id: '고양이집사', title: '공식 집사', icon: '🐾', description: '마루와 끝까지 가까워졌다', when: '마루 >= 5' },
  { id: '벌점왕', title: '풍기 벌점 최다', icon: '📛', description: '벌점이 2점 이상인 채로 끝을 맞았다', hidden: true, when: "$엔딩 != '' and 벌점 >= 2" },
  { id: '교지주인공', title: '교지 1면의 주인공', icon: '📰', description: '소문이 터져 교지 1면에 올랐다', hidden: true, when: "seen('rumor_blast')" },
  { id: '철벽', title: '무심한 척 철벽', icon: '🧱', description: '누구에게도 마음이 가지 않은 채 끝났다', hidden: true, when: "$엔딩 != '' and 인기 < 5" },
  { id: '고백성공', title: '두근두근 성공', icon: '💞', description: '고백에 성공했다', hidden: true, when: "endingSeen('seoyun_love') or endingSeen('harin_love') or endingSeen('yuna_love') or endingSeen('seohyeon_love')" },
];

/** 작가가 만든 일러스트(JPG). 파일에 직접 담겨 내보내기·사본에서도 그대로 따라간다 */
export const assets: AssetDef[] = [
  { id: 'cover', kind: 'image', src: coverImg, alt: '표지: 벚꽃이 흩날리는 옥상, 모두가 서로 눈치를 보는 순간' },
  { id: 'gate', kind: 'image', src: gateImg, alt: '개학날 교문 앞: 자를 든 서윤, 손을 흔드는 하준, 기둥 위의 마루' },
  { id: 'sports', kind: 'image', src: sportsImg, alt: '체육대회 이인삼각: 웃으며 달리는 두 사람, 방송석의 하준, 사진을 찍는 서현' },
  { id: 'rain', kind: 'image', src: rainImg, alt: '비 오는 하굣길: 투명 우산 아래의 두 사람, 빗속의 하준과 마루' },
  { id: 'roof', kind: 'image', src: roofImg, alt: '문화제 밤 옥상: 불꽃놀이 아래의 주인공과 실루엣, 난간의 하준과 마루' },
  { id: 'stage', kind: 'image', src: stageImg, alt: '연극부 무대: 스포트라이트 아래의 유나, 객석의 주인공, 커튼 곁의 마루' },
  { id: 'library', kind: 'image', src: libraryImg, alt: '비 오는 도서관: 책을 읽는 태오, 같은 책으로 뻗는 손, 창턱의 마루' },
  { id: 'press', kind: 'image', src: pressImg, alt: '신문부실: 신문을 펼쳐 든 서현, 사진이 붙은 코르크판, 졸고 있는 마루' },
];

// 아래는 이벤트 파일에서 쓰는 재수출
export { add, end, go, iff, item, note, rec, tagAdd };
