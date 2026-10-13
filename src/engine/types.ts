// 콘텐츠(YAML)와 엔진이 공유하는 스키마. 설계 문서: docs/design/01_시스템_설계.md

export const VIRTUES = ['용기', '신중', '자제', '정의'] as const;
export type Virtue = (typeof VIRTUES)[number];

export const ABILITIES = ['전투', '기술', '화술', '학식', '예술', '은신', '생존', '사업'] as const;
export type Ability = (typeof ABILITIES)[number];

export const SINS = ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투'] as const;
export type Sin = (typeof SINS)[number];

export type Stage = 'child' | 'teen' | 'adult';
export type Tone = 'positive' | 'negative' | 'neutral';

/** 'yyy.mm' 문자열. 내부적으로는 월 인덱스(year*12 + month-1)로 다룬다. */
export type DateString = string;

export interface Range {
  gte?: number;
  lte?: number;
}

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  /** "키" 존재, 또는 "키=값" 일치 */
  | { tag: string }
  | { tagNum: { key: string } & Range }
  /** 각 능력이 주어진 값 이상 */
  | { ability: Partial<Record<Ability, number>> }
  | { virtue: Partial<Record<Virtue, number>> }
  | { money: Range }
  | { hp: Range }
  | { sp: Range }
  | { age: [number, number] }
  | { date: [DateString, DateString] }
  | { stage: Stage | Stage[] }
  | { seen: string }
  | { sinTop: Sin };

export type Effect =
  | { hp: number }
  | { hpMax: number }
  | { sp: number }
  | { money: number }
  /** 목격한 사건의 위험도(1~5). 공포 피해 표에 따라 정신 피해 */
  | { fear: number }
  | { addTag: string }
  | { removeTag: string }
  | { tagAdd: { key: string; value: number } }
  | { virtue: Partial<Record<Virtue, number>> }
  | { ability: Partial<Record<Ability, number>> }
  | { emotion: 'pos' | 'neg' }
  | { sin: Sin }
  /** 시간 경과(개월) */
  | { advance: number }
  /** 게임 종료. 값은 종료 사유 키 */
  | { end: string };

export interface Check {
  ability?: Ability;
  virtue?: Virtue;
  difficulty: number;
  /** 추가 보정(%p) */
  bonus?: number;
}

export interface Outcome {
  text?: string;
  effects?: Effect[];
  /** 이어지는 이벤트 ID */
  goto?: string;
}

export interface Choice {
  text: string;
  requires?: Cond;
  /** requires 미충족 시 아예 숨김 */
  hidden?: boolean;
  check?: Check;
  success?: Outcome;
  failure?: Outcome;
  /** check가 없을 때의 결과 */
  outcome?: Outcome;
}

export type EventKind = 'story' | 'encounter' | 'night' | 'crisis';

export interface GameEvent {
  id: string;
  kind?: EventKind;
  stage?: Stage | Stage[];
  age?: [number, number];
  date?: [DateString, DateString];
  /** 조건이 맞으면 랜덤 풀보다 먼저, 반드시 발생 */
  fixed?: boolean;
  once?: boolean;
  weight?: number;
  /** 다시 나오기까지 최소 턴 수 */
  cooldown?: number;
  group?: string;
  tone?: Tone;
  when?: Cond;
  title?: string;
  text: string;
  choices: Choice[];
}

/** 성인기 월간 행동 */
export interface Action {
  id: string;
  text: string;
  when?: Cond;
  requires?: Cond;
  check?: Check;
  success?: Outcome;
  failure?: Outcome;
  outcome?: Outcome;
}

/** 출생 배경 */
export interface Origin {
  id: string;
  title: string;
  summary: string;
  /** 처음부터 열려 있는지(아니면 메타 해금 필요) */
  unlocked?: boolean;
  weight?: number;
  money: number;
  tags: string[];
  virtues?: Partial<Record<Virtue, number>>;
  abilities?: Partial<Record<Ability, number>>;
  text: string;
}

export interface EpilogueLine {
  when?: Cond;
  text: string;
}

export interface EpilogueParagraph {
  id: string;
  when?: Cond;
  /** 낮을수록 먼저 출력 */
  order?: number;
  lines: EpilogueLine[];
}

export interface Content {
  events: Map<string, GameEvent>;
  actions: Action[];
  origins: Origin[];
  epilogue: EpilogueParagraph[];
  endings: Record<string, string>;
}

export interface PlayerState {
  seed: number;
  rngState: number;
  name: string;
  /** 월 인덱스 */
  birth: number;
  now: number;
  hp: number;
  hpMaxBonus: number;
  sp: number;
  money: number;
  virtues: Record<Virtue, number>;
  virtueXp: Record<Virtue, number>;
  abilities: Record<Ability, number>;
  /** 키 → 값. 값이 true면 단순 플래그 */
  tags: Record<string, string | number | true>;
  emotion: { pos: number; neg: number };
  sins: Record<Sin, number>;
  /** 이벤트 ID → 마지막으로 본 턴 */
  seen: Record<string, number>;
  turn: number;
  recent: { id: string; group?: string; tone?: Tone }[];
  ended?: { reason: string };
  /** 현재 턴의 진행 단계 */
  phase: TurnPhase;
  /** goto로 예약된 다음 이벤트 */
  pending?: string;
  /** 화면에 떠 있는 이벤트 ID(또는 '__actions'). 세이브 후 이어하기용 */
  current?: string;
  log: string[];
}

export type TurnPhase = 'origin' | 'start' | 'action' | 'encounter' | 'night' | 'end';
