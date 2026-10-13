// 스토리 패키지 스키마 — 에디터, 플레이어, 내보내기 파일이 모두 이 형식을 공유한다.
// 설계 문서: docs/builder/01_패키지_스키마.md

/** 수식 문자열. 문법은 expr/parser.ts 참고. 예: "체력 <= 0 and not has('부활')" */
export type Expr = string;
/** 숫자 또는 수식 */
export type NumOrExpr = number | Expr;
export type Value = number | string | boolean;

import type { NameGender, NameStyleId } from './names';

export const FORMAT_VERSION = 'ifb/1';

// ───────────────────────── 패키지 ─────────────────────────

export interface StoryPackage {
  format: typeof FORMAT_VERSION;
  meta: PackageMeta;
  settings: Settings;
  variables: VariableDef[];
  tables?: TableDef[];
  items?: ItemDef[];
  statuses?: StatusDef[];
  origins?: OriginConfig;
  events: EventDef[];
  /** 메뉴 단계(예: 월간 행동)에서 고르는 행동들 */
  actions?: ActionDef[];
  /** 공용 스크립트 (RPG Maker의 공용 이벤트). call 명령으로 호출 */
  scripts?: ScriptDef[];
  triggers?: TriggerDef[];
  endings: EndingDef[];
  epilogue?: EpilogueDef;
  achievements?: AchievementDef[];
  assets?: AssetDef[];
}

export interface PackageMeta {
  id: string;
  title: string;
  author?: string;
  description?: string;
  version?: string;
  language?: string;
  tags?: string[];
  /** 에셋 ID */
  cover?: string;
  /** 남이 편집기로 가져가도 되는지. 없으면 허가하지 않음. pinHash는 숫자 비밀번호의 해시 */
  remix?: { allow: boolean; pinHash?: string };
  /** 사본을 만들 때 쌓이는 원작자 목록(먼저 만든 사람부터) */
  credits?: string[];
}

// ───────────────────────── 설정 ─────────────────────────

export interface Settings {
  /** story: 이벤트가 끝나면 종료 / life: 출생부터 사망까지 */
  mode: 'story' | 'life';
  calendar: CalendarConfig;
  stages: StageDef[];
  /** 주인공 이름. askName이나 defaultName이 없으면 이름을 화면에 쓰지 않고 {$이름}은 '당신'이 된다 */
  player?: {
    askName?: boolean;
    defaultName?: string;
    /** 이름을 무작위로 뽑을 때 쓰는 이름 주머니. 출신에 따로 정해 두면 그쪽이 먼저 */
    nameStyle?: NameStyleId;
    /** 묻지 않고 시작할 때 이름 주머니에서 알아서 뽑는다 (askName이 켜져 있으면 묻는 쪽이 우선) */
    randomName?: boolean;
    /** 이름 주머니의 성별. ask면 처음 플레이할 때 플레이어에게 묻는다. 없으면 구분 없이 뽑는다 */
    gender?: NameGender | 'ask';
    /** 무작위로 뽑지 않을 이름(등장인물과 겹치지 않게) */
    excludeNames?: string[];
  };
  /** 첫 턴 시작 전에 보여줄 이벤트(도입부) */
  start?: string;
  check?: CheckConfig;
  scheduler?: SchedulerConfig;
  /** 아무것도 일어나지 않는 턴이 이어질 때 종료 */
  idleEnding?: { turns: number; ending: string };
  /** 무한 진행 방지. 넘으면 이 엔딩으로 종료 */
  maxTurns?: { turns: number; ending: string };
  /** 끝날 때 엔딩(자동 규칙으로 끝났으면 그 규칙 이름 포함)을 인생표 마지막 줄에 남긴다. 어떤 선택지를 골랐는지는 적지 않는다. 기본 켬 */
  recordEnding?: boolean;
  ui?: UiConfig;
}

export interface CalendarConfig {
  /** 시간의 최소 단위. none이면 날짜·나이가 없다 */
  unit: 'none' | 'day' | 'month' | 'year';
  /** 시작 날짜 'y', 'y.m', 'y.m.d' */
  start?: string;
  /** 시작 시 나이. 출생일 = 시작 날짜 − startAge년 */
  startAge?: number;
  /** 날짜 표시 형식. {y} {m} {d} */
  format?: string;
}

export interface StageDef {
  id: string;
  name: string;
  /** 나이 범위 [이상, 이하] (생애 모드) */
  ages?: [number, number];
  /** 나이 대신 조건으로 단계를 정할 때 */
  when?: Expr;
  turn: {
    /** 한 턴에 흐르는 시간(calendar.unit 단위) */
    length: NumOrExpr;
    /** 다음 단계 경계를 넘지 않도록 턴 길이를 자른다 */
    clip?: boolean;
  };
  phases: PhaseDef[];
}

export type PhaseDef =
  | {
      type: 'events';
      pools: string[];
      /** fixed: 고정 이벤트만 / random: 가중치 랜덤만 / fixedThenRandom: 고정 우선 */
      select: 'fixed' | 'random' | 'fixedThenRandom';
      /** 발생 확률(%) */
      chance?: NumOrExpr;
      /** 이 단계에서 최대 몇 개까지 */
      count?: number;
    }
  | { type: 'menu'; pool: string; text?: string; title?: string }
  | { type: 'script'; do: Command[] };

export interface CheckConfig {
  /** 성공 확률(%) 공식. $skill, $difficulty, $bonus 사용 가능 */
  formula?: Expr;
  min?: number;
  max?: number;
  /** 확률 표시 방식 */
  display?: 'label' | 'percent' | 'both' | 'none';
  /** 확률 구간별 이름. 오름차순, p < below 이면 해당 이름 */
  labels?: { below: number; text: string }[];
  successNote?: string;
  failureNote?: string;
}

export interface SchedulerConfig {
  defaultWeight?: number;
  /** 직전 N개 이벤트와 같은 group 제외 */
  groupBlock?: number;
  /** 최근 window개 중 부정 이벤트가 threshold개 이상이면 부정 가중치 × factor */
  toneBalance?: { window: number; threshold: number; factor: number };
}

export interface UiConfig {
  continueText?: string;
  theme?: Record<string, string>;
  typewriter?: boolean;
  /** 플레이 화면에 보이는 고유 명사. 비우면 기본 이름 */
  terms?: {
    /** 인벤토리 버튼·창 제목 (기본 '인벤토리') */
    inventory?: string;
    /** 아이템 쪽 이름 (기본 '아이템') */
    items?: string;
    /** 상태 쪽 이름 (기본 '상태') */
    statuses?: string;
    /** 아이템 사용 버튼 (기본 '사용') */
    use?: string;
  };
}

// ───────────────────────── 변수 ─────────────────────────

export interface VariableDef {
  /** 수식에서 쓰는 이름. 한글 가능 */
  id: string;
  /** 화면 표시 이름(없으면 id) */
  name?: string;
  type: 'number' | 'string' | 'bool';
  initial?: Value;
  /** 시작값을 수식으로(난수 등). 예: "randint(3, 7)" */
  initialExpr?: Expr;
  min?: NumOrExpr;
  max?: NumOrExpr;
  integer?: boolean;
  /** 문자열 변수의 허용값 */
  options?: string[];
  /** 파생 변수: 읽기 전용, 매번 계산 */
  formula?: Expr;
  /** top('그룹'), sum('그룹') 등에 쓰는 묶음 */
  group?: string;
  /** meta: 회차를 넘어 유지 */
  scope?: 'run' | 'meta';
  display?: VariableDisplay;
  description?: string;
}

export interface VariableDisplay {
  /** 상태창 표시 방식 */
  as?: 'hidden' | 'number' | 'bar' | 'text';
  order?: number;
  /** 값이 바뀌면 결과 화면에 알림. {name} {delta} {value} */
  notify?: boolean | string;
  /** 상태창 값 형식. {value} {max} */
  format?: string;
  /** 구간별 문구(오름차순). 값 <= upTo 면 해당 문구 */
  labels?: { upTo: number; text: string }[];
  icon?: string;
  color?: string;
}

/** 조회 표. lookup('표', 키, '열') */
export interface TableDef {
  id: string;
  name?: string;
  /** range: 키 이하인 첫 행 / exact: 키가 같은 행 */
  match: 'range' | 'exact';
  columns: string[];
  rows: { key: number | string; values: Record<string, Value> }[];
  /** 범위를 벗어날 때 쓰는 행(range 모드에서 가장 큰 키 초과) */
  fallback?: Record<string, Value>;
}

// ───────────────────────── 아이템 · 상태 ─────────────────────────

export interface ItemDef {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  hidden?: boolean;
  /** 최대 소지 수(기본 무제한) */
  max?: number;
  /** 분류. 비우면 일반 아이템, 'other'는 눈에 띄지 않게 쓰는 기타 요소(에디터에서 상태·아이템·기타로 나눠 보여 줌) */
  category?: 'other';
  /** 소지 중 변수 보정 */
  modifiers?: Record<string, NumOrExpr>;
  /** 하나도 없다가 처음 가지게 될 때 */
  onGain?: Command[];
  /** 모두 잃어 하나도 없게 될 때 */
  onLose?: Command[];
  /** 가지고 있는 동안 매 턴 끝에(개수와 상관없이 한 번) */
  onTurnEnd?: Command[];
  /** 플레이어가 직접 사용할 수 있으면 */
  use?: { when?: Expr; consume?: boolean; text?: string; do?: Command[] };
}

export interface StatusDef {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  hidden?: boolean;
  tone?: Tone;
  /** 지속 턴 수(없으면 해제될 때까지) */
  duration?: number;
  maxStacks?: number;
  modifiers?: Record<string, NumOrExpr>;
  onApply?: Command[];
  onTurnEnd?: Command[];
  onTick?: Command[];
  onExpire?: Command[];
}

// ───────────────────────── 출신 ─────────────────────────

/** 한 화면에 둘 수 있는 선택지(와 직접 고르는 출신)의 최대 개수 */
export const MAX_CHOICES = 5;

export interface OriginConfig {
  /** choose: 후보 중 선택 / random: 가중치로 자동 배정 (새 이야기의 기본값) */
  mode: 'choose' | 'random';
  /** 선택지로 제시할 후보 수 */
  offer?: number;
  title?: string;
  text?: string;
  list: OriginDef[];
}

export interface OriginDef {
  id: string;
  title: string;
  summary?: string;
  text?: string;
  image?: string;
  weight?: NumOrExpr;
  /** 해금 조건(메타 변수·도전과제 등). 거짓이면 후보에서 제외 */
  unlock?: Expr;
  /** 이 출신일 때 무작위 이름을 뽑을 이름 주머니. 있으면 이름은 출신을 정한 뒤에 정한다 */
  nameStyle?: NameStyleId;
  do?: Command[];
}

// ───────────────────────── 이벤트 · 선택지 ─────────────────────────

export type Tone = 'positive' | 'negative' | 'neutral';

export interface EventDef {
  id: string;
  title?: string;
  text: string;
  image?: string;
  /** 이 이벤트가 속한 풀. 단계(phase)가 풀에서 이벤트를 뽑는다 */
  pool?: string;
  stages?: string[];
  ages?: [number, number];
  dates?: [string, string];
  when?: Expr;
  /** 조건이 맞으면 반드시 발생(1회) */
  fixed?: boolean;
  /** 초크포인트: 모든 플레이가 반드시 거쳐야 하는 지점(시뮬레이터가 검증) */
  chokepoint?: boolean;
  /** 고정 이벤트 간 우선순위(높을수록 먼저) */
  priority?: number;
  once?: boolean;
  weight?: NumOrExpr;
  cooldown?: number;
  group?: string;
  tone?: Tone;
  /** 인생표에 남길 문구 */
  record?: string | RecordSpec;
  choices: ChoiceDef[];
  editor?: EditorMeta;
}

export interface RecordSpec {
  text: string;
  /** 1~5. 인생표 요약에서 높은 것 우선 */
  importance?: number;
}

export interface ChoiceDef {
  text: string;
  /** 고를 수 있는 조건 */
  requires?: Expr;
  /** 조건 미충족 시 표시할 이유(없으면 자동 생성) */
  requiresText?: string;
  /** 조건 미충족 시 아예 숨김 */
  hidden?: boolean;
  check?: CheckSpec;
  success?: Outcome;
  failure?: Outcome;
  /** 가중치 랜덤 결과(확률 사망 등) */
  results?: WeightedOutcome[];
  outcome?: Outcome;
}

export interface CheckSpec {
  /** 판정에 쓰는 능력치(수식) */
  skill?: Expr;
  difficulty?: NumOrExpr;
  bonus?: NumOrExpr;
  /** 공식 대신 직접 확률(%) 지정 */
  chance?: NumOrExpr;
}

export interface Outcome {
  text?: string;
  image?: string;
  do?: Command[];
  goto?: string;
  /** 결과 글 다음에 이어서 고르는 선택지(있으면 '계속' 대신 이 선택지가 뜬다) */
  choices?: ChoiceDef[];
}

export interface WeightedOutcome extends Outcome {
  weight: NumOrExpr;
}

/** 메뉴 단계의 행동 */
export interface ActionDef extends ChoiceDef {
  id: string;
  pool: string;
  /** 메뉴에 나타날 조건 */
  when?: Expr;
  editor?: EditorMeta;
}

// ───────────────────────── 명령 ─────────────────────────

export type Command =
  | { do: 'set'; var: string; value: NumOrExpr | boolean }
  | { do: 'add'; var: string; value: NumOrExpr }
  /** 지역 변수($이름). 스크립트·결과 블록 안에서만 유효 */
  | { do: 'let'; name: string; value: NumOrExpr | boolean }
  /** 태그: value 없으면 플래그, add면 숫자 누적 */
  | { do: 'tag'; key: string; value?: NumOrExpr | boolean; add?: NumOrExpr }
  /** 태그 제거. key 또는 접두어(prefix) */
  | { do: 'untag'; key?: string; prefix?: string; value?: string }
  /** silent: 획득·소실 알림을 띄우지 않음 */
  | { do: 'item'; id: string; count: NumOrExpr; silent?: boolean }
  | { do: 'status'; id: string; remove?: boolean; duration?: number; stacks?: number; silent?: boolean }
  | { do: 'text'; text: string }
  | { do: 'note'; text: string }
  | { do: 'image'; asset: string }
  | { do: 'if'; cond: Expr; then: Command[]; else?: Command[] }
  | { do: 'random'; branches: { weight: NumOrExpr; then: Command[] }[] }
  | { do: 'check'; check: CheckSpec; success?: Command[]; failure?: Command[] }
  | { do: 'goto'; event: string }
  | { do: 'call'; script: string; args?: Record<string, NumOrExpr | boolean> }
  | { do: 'end'; ending: string }
  /** 시간 경과(턴 구조와 무관하게) */
  | { do: 'advance'; amount: NumOrExpr }
  /** 남은 단계를 건너뛰고 턴을 times번 마친다 */
  | { do: 'endTurn'; times?: NumOrExpr }
  | { do: 'record'; text: string; importance?: number }
  | { do: 'achieve'; id: string };

export interface ScriptDef {
  id: string;
  name?: string;
  /** 매개변수 이름(호출 시 $이름으로 접근) */
  params?: string[];
  do: Command[];
}

export type TriggerOn =
  /** 매 장면 전환 때 조건 감시 (사망 판정, 레벨업 등) */
  | 'watch'
  | 'start'
  | 'turnStart'
  | 'turnEnd'
  /** 시간 최소 단위마다 (월간 정산 등) */
  | 'tick'
  /** 나이가 오를 때 */
  | 'birthday'
  | 'stageEnter'
  | 'end';

export interface TriggerDef {
  id: string;
  name?: string;
  on: TriggerOn;
  when?: Expr;
  once?: boolean;
  do: Command[];
}

// ───────────────────────── 엔딩 · 결산 · 도전과제 ─────────────────────────

export interface EndingDef {
  id: string;
  title: string;
  text?: string;
  image?: string;
  kind?: 'death' | 'good' | 'bad' | 'neutral';
  /** 조건이 참이 되면 자동 종료 */
  when?: Expr;
  /** 동시에 여러 조건이 참일 때 높은 것 우선 */
  priority?: number;
}

export interface EpilogueDef {
  header?: string;
  paragraphs: EpilogueParagraph[];
  footer?: string;
}

export interface EpilogueParagraph {
  id: string;
  when?: Expr;
  order?: number;
  lines: { when?: Expr; text: string }[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  hidden?: boolean;
  /** 조건이 참이 되면 달성 */
  when?: Expr;
}

export interface AssetDef {
  id: string;
  kind: 'image';
  /** URL 또는 data URL */
  src: string;
  alt?: string;
}

/** 에디터 전용 정보(엔진은 무시) */
export interface EditorMeta {
  x?: number;
  y?: number;
  color?: string;
  folder?: string;
  note?: string;
}

// ───────────────────────── 실행 상태 ─────────────────────────

export interface LifeEntry {
  turn: number;
  /** 시간 인덱스 */
  now: number;
  age?: number;
  date?: string;
  text: string;
  importance: number;
  eventId?: string;
}

/** 지금 화면에 떠 있는 것. 세이브 후 이어하기에 쓴다 */
export type Current =
  | { type: 'name' }
  | { type: 'origin'; offered: string[] }
  | { type: 'event'; id: string }
  | { type: 'menu'; phase: number }
  | { type: 'result' }
  /**
   * 결과 안의 이어지는 선택지. from/id는 맨 처음 선택지가 있던 곳, path는 "선택지번호:결과" 를 '/'로 이은 것.
   * 예: 이벤트의 0번 선택지 → 판정 성공 → 그 안의 2번 선택지 → 결과 = "0:success/2:outcome"
   */
  | { type: 'sub'; from: 'event' | 'action'; id: string; path: string; text: string; notes: string[]; image?: string };

export interface RunState {
  v: 1;
  packageId: string;
  seed: number;
  rng: number;
  name: string;
  /** 지금 쓰는 이름 주머니(게임 설정 또는 고른 출신) */
  nameStyle?: NameStyleId;
  /** 출신을 정한 뒤에 이름을 정해야 한다 */
  namePending?: boolean;
  /** 주인공 성별(이름 주머니와 {$성별}). 없으면 정하지 않음 */
  gender?: NameGender;
  /** 시간 인덱스(calendar.unit 단위) */
  now: number;
  birth: number;
  turn: number;
  stage?: string;
  /** -1: 턴 시작 전 */
  phase: number;
  /** 현재 단계에서 뽑은 이벤트 수 */
  phaseCount: number;
  vars: Record<string, Value>;
  tags: Record<string, Value>;
  items: Record<string, number>;
  statuses: Record<string, { stacks: number; remaining?: number }>;
  seen: Record<string, number>;
  recent: { id: string; group?: string; tone?: Tone }[];
  queue: string[];
  fired: string[];
  idleTurns: number;
  /** 이번 턴에 장면을 하나라도 보여줬는지 */
  turnActive: boolean;
  current?: Current;
  /** 결과 화면(이어하기용) */
  pendingResult?: ResultScene;
  /** 결과 화면 뒤에 돌아갈 장면(아이템 사용 등) */
  returnTo?: Current;
  /** rule: 엔딩을 낸 자동 규칙(있으면) */
  ended?: { ending: string; rule?: { id: string; name?: string; on: TriggerOn } };
  /** 마지막으로 고른 선택지(인생표의 사망 사유용) */
  lastPick?: { from: 'event' | 'action'; id: string; choice: string; turn: number };
  /** 엔딩 처리(메타 기록 등)를 마쳤는지 */
  finalized?: boolean;
  life: LifeEntry[];
  achieved: string[];
}

/** 회차를 넘어 유지되는 기록(패키지별) */
export interface MetaData {
  vars: Record<string, Value>;
  achievements: Record<string, number>;
  endings: Record<string, number>;
  runs: number;
}

// ───────────────────────── 장면(UI에 전달) ─────────────────────────

export interface ChoiceView {
  index: number;
  text: string;
  enabled: boolean;
  reason?: string;
  chance?: string;
}

export interface ResultScene {
  type: 'result';
  text: string;
  notes: string[];
  images: string[];
}

export interface EndScene {
  type: 'end';
  ending: EndingDef;
  text: string;
  life: LifeEntry[];
  achievements: AchievementDef[];
}

export type Scene =
  /** askName이 false면 성별만 묻는다 */
  | { type: 'name'; defaultName: string; style?: NameStyleId; askName: boolean; askGender: boolean }
  | { type: 'origin'; title?: string; text: string; origins: OriginDef[] }
  | { type: 'event'; id: string; title?: string; text: string; image?: string; choices: ChoiceView[]; notes?: string[] }
  | { type: 'menu'; title?: string; text: string; choices: ChoiceView[] }
  | ResultScene
  | EndScene;
