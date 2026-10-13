// 실행 중인 게임 하나의 상태와 규칙. 수식 컨텍스트, 명령 해석, 시간 흐름, 트리거를 담당한다.
// 장면 흐름(무엇을 화면에 띄울지)은 runner.ts가 맡는다.

import { Calendar } from './calendar';
import { type ExprContext, evalBool, evalNum, evaluate, looseEq, toNum, truthy } from './expr/eval';
import { renderTemplate } from './text';
import type {
  AchievementDef,
  ActionDef,
  CheckSpec,
  Command,
  EndingDef,
  EventDef,
  ItemDef,
  MetaData,
  NumOrExpr,
  OriginDef,
  RunState,
  ScriptDef,
  StageDef,
  StatusDef,
  StoryPackage,
  TableDef,
  TriggerDef,
  TriggerOn,
  Value,
  VariableDef,
} from './types';

export const DEFAULT_CHECK_FORMULA = '50 + 15 * ($skill - $difficulty) + $bonus';
export const DEFAULT_CHANCE_LABELS = [
  { below: 15, text: '매우 불리' },
  { below: 40, text: '불리' },
  { below: 61, text: '반반' },
  { below: 86, text: '유리' },
  { below: 101, text: '매우 유리' },
];
const MAX_CALL_DEPTH = 32;
const MAX_WATCH_PASSES = 20;

export class EngineError extends Error {}

/** 테스트 플레이 로그 한 줄. 난수 소비에 영향을 주지 않는다 */
export type TraceKind = 'turn' | 'stage' | 'scene' | 'choice' | 'roll' | 'pick' | 'var' | 'item' | 'status' | 'tag' | 'rule' | 'end' | 'achieve';
export interface TraceEntry {
  kind: TraceKind;
  text: string;
  /** 확률 목록, 굴린 값 등 */
  detail?: string;
  turn: number;
  /** 날짜·나이(있으면) */
  when?: string;
}

const pct = (x: number) => `${Math.round(x * 10) / 10}`;
const ON_WORD: Record<TriggerOn, string> = {
  watch: '항상 감시',
  start: '새 게임',
  turnStart: '턴 시작',
  turnEnd: '턴 끝',
  tick: '시간 흐름',
  birthday: '생일',
  stageEnter: '단계 진입',
  end: '엔딩 직전',
};

/** 결과 화면에 쌓이는 출력 */
export interface Output {
  texts: string[];
  notes: string[];
  images: string[];
}

function byId<T extends { id: string }>(list: T[] | undefined): Map<string, T> {
  return new Map((list ?? []).map((x) => [x.id, x]));
}

/** 패키지를 빠르게 찾아보기 위한 색인(불변) */
export class PackageIndex {
  readonly vars: Map<string, VariableDef>;
  readonly items: Map<string, ItemDef>;
  readonly statuses: Map<string, StatusDef>;
  readonly events: Map<string, EventDef>;
  readonly eventOrder: Map<string, number>;
  readonly actions: ActionDef[];
  readonly scripts: Map<string, ScriptDef>;
  readonly tables: Map<string, TableDef>;
  readonly endings: Map<string, EndingDef>;
  readonly achievements: Map<string, AchievementDef>;
  readonly origins: Map<string, OriginDef>;
  readonly stages: Map<string, StageDef>;
  readonly triggers: Map<TriggerOn, TriggerDef[]>;
  readonly groups: Map<string, string[]>;
  readonly calendar: Calendar;

  constructor(readonly pkg: StoryPackage) {
    this.vars = byId(pkg.variables);
    this.items = byId(pkg.items);
    this.statuses = byId(pkg.statuses);
    this.events = byId(pkg.events);
    this.eventOrder = new Map(pkg.events.map((e, i) => [e.id, i]));
    this.actions = pkg.actions ?? [];
    this.scripts = byId(pkg.scripts);
    this.tables = byId(pkg.tables);
    this.endings = byId(pkg.endings);
    this.achievements = byId(pkg.achievements);
    this.origins = byId(pkg.origins?.list);
    this.stages = byId(pkg.settings.stages);
    this.triggers = new Map();
    for (const t of pkg.triggers ?? []) {
      if (!this.triggers.has(t.on)) this.triggers.set(t.on, []);
      this.triggers.get(t.on)!.push(t);
    }
    this.groups = new Map();
    for (const v of pkg.variables) {
      if (!v.group) continue;
      if (!this.groups.has(v.group)) this.groups.set(v.group, []);
      this.groups.get(v.group)!.push(v.id);
    }
    this.calendar = new Calendar(pkg.settings.calendar);
  }
}

export function emptyMeta(): MetaData {
  return { vars: {}, achievements: {}, endings: {}, runs: 0 };
}

export class World implements ExprContext {
  readonly pkg: StoryPackage;
  readonly cal: Calendar;
  out: Output = { texts: [], notes: [], images: [] };
  /** 스크립트 매개변수·let 지역 변수 */
  private frames: Record<string, Value>[] = [];
  private computing = new Set<string>();
  private depth = 0;
  /** 메타 기록이 바뀌어 저장이 필요한지 */
  metaChanged = false;
  /** 테스트 플레이 로그를 받는 곳(없으면 기록하지 않음) */
  trace?: (e: TraceEntry) => void;
  /** 지금 실행 중인 자동 규칙(엔딩 사유 기록용) */
  private ruleStack: TriggerDef[] = [];

  private runRule(t: TriggerDef): void {
    this.ruleStack.push(t);
    try {
      this.exec(t.do);
    } finally {
      this.ruleStack.pop();
    }
  }

  log(kind: TraceKind, text: string, detail?: string): void {
    if (!this.trace) return;
    const s = this.state;
    const when = this.cal.unit === 'none' ? undefined : `${this.cal.format(s.now)} · ${this.age()}세`;
    this.trace({ kind, text, detail, turn: s.turn, when });
  }

  constructor(
    readonly idx: PackageIndex,
    readonly state: RunState,
    readonly meta: MetaData,
  ) {
    this.pkg = idx.pkg;
    this.cal = idx.calendar;
  }

  static createState(idx: PackageIndex, seed: number, name?: string): RunState {
    const pkg = idx.pkg;
    return {
      v: 1,
      packageId: pkg.meta.id,
      seed,
      rng: seed | 0,
      name: name ?? pkg.settings.player?.defaultName ?? '당신',
      now: idx.calendar.startIndex,
      birth: idx.calendar.birthIndex,
      turn: 0,
      phase: -1,
      phaseCount: 0,
      vars: {},
      tags: {},
      items: {},
      statuses: {},
      seen: {},
      recent: [],
      queue: [],
      fired: [],
      idleTurns: 0,
      turnActive: false,
      life: [],
      achieved: [],
    };
  }

  /** 변수 시작값 설정. 리터럴 먼저, 수식(initialExpr)은 선언 순서대로 */
  initVariables(): void {
    for (const v of this.pkg.variables) {
      if (v.formula) continue;
      const store = v.scope === 'meta' ? this.meta.vars : this.state.vars;
      if (v.scope === 'meta' && v.id in store) continue;
      store[v.id] = v.initial ?? (v.type === 'number' ? 0 : v.type === 'bool' ? false : '');
    }
    for (const v of this.pkg.variables) {
      if (v.formula || !v.initialExpr) continue;
      if (v.scope === 'meta' && v.id in this.meta.vars && v.initial === undefined) continue;
      this.setVar(v.id, evaluate(v.initialExpr, this));
    }
    this.reclamp();
  }

  // ───────────────────────── 난수 ─────────────────────────

  /** mulberry32. 상태가 RunState에 있어 세이브·재현이 된다 */
  random(): number {
    let t = (this.state.rng = (this.state.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 가중치 추첨. log를 주면 후보별 확률과 결과를 로그에 남긴다 */
  pickWeighted<T>(items: T[], weight: (item: T) => number, log?: { what: string; name: (item: T) => string }): T | undefined {
    const weights = items.map((i) => Math.max(0, weight(i)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      if (log && this.trace && items.length) this.log('pick', `${log.what}: 뽑을 수 있는 것이 없음`);
      return undefined;
    }
    const first = this.random() * total;
    let roll = first;
    let picked = items[items.length - 1];
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        picked = items[i];
        break;
      }
    }
    if (log && this.trace) {
      const odds = items
        .map((it, i) => [log.name(it), weights[i]] as const)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1]);
      const shown = odds.slice(0, 12).map(([n, w]) => `${n} ${pct((w / total) * 100)}%`);
      if (odds.length > 12) shown.push(`외 ${odds.length - 12}개`);
      this.log('pick', `${log.what} → ${log.name(picked)}`, `${shown.join(' · ')} (굴림 ${pct((first / total) * 100)})`);
    }
    return picked;
  }

  // ───────────────────────── 변수 ─────────────────────────

  private bound(v: VariableDef, which: 'min' | 'max'): number | undefined {
    const b = v[which];
    return b === undefined ? undefined : evalNum(b, this);
  }

  private clampFor(v: VariableDef, value: Value): Value {
    if (v.type === 'bool') return truthy(value);
    if (v.type === 'string') return String(value);
    let n = toNum(value);
    const lo = this.bound(v, 'min');
    const hi = this.bound(v, 'max');
    if (hi !== undefined) n = Math.min(hi, n);
    if (lo !== undefined) n = Math.max(lo, n);
    if (v.integer) n = Math.round(n);
    return n;
  }

  baseVar(id: string): Value {
    const v = this.idx.vars.get(id);
    if (!v) throw new EngineError(`선언되지 않은 변수 '${id}'`);
    if (v.formula) return this.getVar(id);
    const store = v.scope === 'meta' ? this.meta.vars : this.state.vars;
    return store[id] ?? v.initial ?? (v.type === 'number' ? 0 : v.type === 'bool' ? false : '');
  }

  /** 수식에서 읽는 값: 기본값 + 아이템·상태 보정 */
  getVar(id: string): Value {
    const v = this.idx.vars.get(id);
    if (!v) throw new EngineError(`선언되지 않은 변수 '${id}'`);
    if (v.formula) {
      if (this.computing.has(id)) throw new EngineError(`파생 변수 '${id}'가 자기 자신을 참조합니다`);
      this.computing.add(id);
      try {
        return this.clampFor(v, evaluate(v.formula, this));
      } finally {
        this.computing.delete(id);
      }
    }
    const base = this.baseVar(id);
    if (v.type !== 'number') return base;
    const mod = this.modifierFor(id);
    return mod === 0 ? base : this.clampFor(v, toNum(base) + mod);
  }

  private modifierFor(id: string): number {
    let total = 0;
    for (const [itemId, count] of Object.entries(this.state.items)) {
      const m = count > 0 ? this.idx.items.get(itemId)?.modifiers?.[id] : undefined;
      if (m !== undefined) total += evalNum(m, this);
    }
    for (const [statusId, s] of Object.entries(this.state.statuses)) {
      const m = this.idx.statuses.get(statusId)?.modifiers?.[id];
      if (m !== undefined) total += evalNum(m, this) * s.stacks;
    }
    return total;
  }

  setVar(id: string, value: Value): void {
    const v = this.idx.vars.get(id);
    if (!v) throw new EngineError(`선언되지 않은 변수 '${id}'`);
    if (v.formula) throw new EngineError(`파생 변수 '${id}'에는 값을 넣을 수 없습니다`);
    const clamped = this.clampFor(v, value);
    if (this.trace) {
      const before = (v.scope === 'meta' ? this.meta.vars : this.state.vars)[id];
      if (before !== clamped) this.log('var', `${v.name ?? v.id} ${before ?? '-'} → ${clamped}`, clamped !== value && typeof value === 'number' ? `${value} → 범위에 맞춰 ${clamped}` : undefined);
    }
    if (v.scope === 'meta') {
      this.meta.vars[id] = clamped;
      this.metaChanged = true;
    } else this.state.vars[id] = clamped;
  }

  /** 최댓값이 수식인 변수(최대 체력 감소 등)를 다시 맞춘다 */
  reclamp(): void {
    for (const v of this.pkg.variables) {
      if (v.formula || v.type !== 'number' || (v.min === undefined && v.max === undefined)) continue;
      const store = v.scope === 'meta' ? this.meta.vars : this.state.vars;
      if (v.id in store) store[v.id] = this.clampFor(v, store[v.id]);
    }
  }

  displayName(id: string): string {
    return (
      this.idx.vars.get(id)?.name ??
      this.idx.items.get(id)?.name ??
      this.idx.statuses.get(id)?.name ??
      this.idx.events.get(id)?.title ??
      id
    );
  }

  /** 알림 대상 변수의 현재 값 */
  snapshot(): Map<string, Value> {
    const snap = new Map<string, Value>();
    for (const v of this.pkg.variables) if (v.display?.notify) snap.set(v.id, this.getVar(v.id));
    return snap;
  }

  diffNotes(before: Map<string, Value>): string[] {
    const notes: string[] = [];
    for (const [id, old] of before) {
      const now = this.getVar(id);
      if (looseEq(old, now)) continue;
      const v = this.idx.vars.get(id)!;
      const fmt = typeof v.display?.notify === 'string' ? v.display.notify : '{name} {delta}';
      const delta = typeof now === 'number' ? toNum(now) - toNum(old) : 0;
      const signed = (delta >= 0 ? '+' : '') + (Math.round(delta * 100) / 100).toLocaleString('ko-KR');
      notes.push(
        fmt
          .replace(/\{name\}/g, v.name ?? v.id)
          .replace(/\{delta\}/g, typeof now === 'number' ? signed : String(now))
          .replace(/\{value\}/g, typeof now === 'number' ? now.toLocaleString('ko-KR') : String(now)),
      );
    }
    return notes;
  }

  // ───────────────────────── 시간 ─────────────────────────

  age(): number {
    return this.cal.age(this.state.now, this.state.birth);
  }

  /** 현재 나이·조건에 맞는 단계 */
  stageNow(): StageDef {
    const stages = this.pkg.settings.stages;
    const age = this.age();
    for (const s of stages) {
      if (s.ages && (age < s.ages[0] || age > s.ages[1])) continue;
      if (s.when && !evalBool(s.when, this)) continue;
      if (!s.ages && !s.when && s !== stages[stages.length - 1]) continue;
      return s;
    }
    return stages[stages.length - 1];
  }

  currentStage(): StageDef {
    return (this.state.stage && this.idx.stages.get(this.state.stage)) || this.stageNow();
  }

  /** 시간 최소 단위 1만큼 흐름 */
  tick(): void {
    this.fire('tick');
    for (const id of Object.keys(this.state.statuses)) {
      const def = this.idx.statuses.get(id);
      if (def?.onTick) this.exec(def.onTick);
    }
    if (this.cal.unit === 'none') return;
    const before = this.age();
    this.state.now += 1;
    if (this.age() > before && !this.state.ended) {
      this.log('turn', `${this.age()}세가 됨`);
      this.fire('birthday');
    }
  }

  advance(units: number): void {
    for (let i = 0; i < units && !this.state.ended; i++) this.tick();
  }

  /** 턴 하나를 마친다: 시간 경과, 상태이상 지속시간, turnEnd 트리거 */
  endTurnOnce(): void {
    const s = this.state;
    const stage = this.currentStage();
    let len = Math.max(0, Math.round(evalNum(stage.turn.length, this)));
    if (stage.turn.clip && stage.ages && this.cal.unit !== 'none') {
      const boundary = this.cal.addYears(s.birth, stage.ages[1] + 1);
      len = Math.max(1, Math.min(len, boundary - s.now));
    }
    this.advance(len);
    s.turn += 1;
    this.log('turn', `턴 ${s.turn} 마침`, this.cal.unit === 'none' ? undefined : `${len}${{ year: '년', month: '달', day: '일', none: '' }[this.cal.unit]} 흐름`);
    for (const [id, st] of Object.entries(s.statuses)) {
      const def = this.idx.statuses.get(id);
      if (def?.onTurnEnd) this.exec(def.onTurnEnd);
      if (st.remaining !== undefined && s.statuses[id]) {
        st.remaining -= 1;
        if (st.remaining <= 0) this.removeStatus(id, true);
      }
    }
    for (const id of Object.keys(s.items)) {
      const def = this.idx.items.get(id);
      if (def?.onTurnEnd && s.items[id] && !s.ended) this.exec(def.onTurnEnd);
    }
    this.fire('turnEnd');
  }

  // ───────────────────────── 트리거 ─────────────────────────

  fire(on: TriggerOn): void {
    for (const t of this.idx.triggers.get(on) ?? []) {
      if (this.state.ended && on !== 'end') return;
      if (t.once && this.state.fired.includes(t.id)) continue;
      if (!evalBool(t.when, this)) continue;
      if (t.once) this.state.fired.push(t.id);
      this.log('rule', `자동 규칙 '${t.name ?? t.id}'`, ON_WORD[on]);
      this.runRule(t);
    }
  }

  /** 감시 트리거 → 자동 엔딩 → 도전과제 순으로 정리 */
  settle(): void {
    const watch = this.idx.triggers.get('watch') ?? [];
    const firedNow = new Set<string>();
    for (let pass = 0; pass < MAX_WATCH_PASSES && !this.state.ended; pass++) {
      let any = false;
      for (const t of watch) {
        if (this.state.ended) break;
        if (firedNow.has(t.id) || (t.once && this.state.fired.includes(t.id))) continue;
        if (!evalBool(t.when, this)) continue;
        firedNow.add(t.id);
        if (t.once) this.state.fired.push(t.id);
        this.log('rule', `자동 규칙 '${t.name ?? t.id}'`, ON_WORD.watch);
        this.runRule(t);
        this.reclamp();
        any = true;
      }
      if (!any) break;
    }
    if (!this.state.ended) {
      let best: EndingDef | undefined;
      for (const e of this.pkg.endings) {
        if (!e.when || !evalBool(e.when, this)) continue;
        if (!best || (e.priority ?? 0) > (best.priority ?? 0)) best = e;
      }
      if (best) {
        this.state.ended = { ending: best.id };
        this.log('end', `엔딩 조건 충족: ${best.title}`);
      }
    }
    this.checkAchievements();
    this.reclamp();
  }

  checkAchievements(): void {
    for (const a of this.pkg.achievements ?? []) {
      if (a.when && !this.state.achieved.includes(a.id) && evalBool(a.when, this)) this.achieve(a.id);
    }
  }

  achieve(id: string): void {
    if (!this.state.achieved.includes(id)) {
      this.state.achieved.push(id);
      this.log('achieve', `도전과제: ${this.idx.achievements.get(id)?.title ?? id}`);
    }
    if (!(id in this.meta.achievements)) {
      this.meta.achievements[id] = Date.now();
      this.metaChanged = true;
      const def = this.idx.achievements.get(id);
      if (def) this.out.notes.push(`도전과제 달성: ${def.title}`);
    }
  }

  // ───────────────────────── 태그 · 아이템 · 상태 ─────────────────────────

  hasTag(key: string, value?: Value): boolean {
    if (!(key in this.state.tags)) return false;
    return value === undefined || looseEq(this.state.tags[key], value);
  }

  addItem(id: string, delta: number, silent = false): void {
    const def = this.idx.items.get(id);
    if (!def) throw new EngineError(`없는 아이템 '${id}'`);
    const before = this.state.items[id] ?? 0;
    const after = Math.max(0, Math.min(def.max ?? Infinity, before + delta));
    if (after === 0) delete this.state.items[id];
    else this.state.items[id] = after;
    if (after !== before) this.log('item', `${def.name} ${before} → ${after}`);
    if (!def.hidden && !silent && after !== before) {
      const n = after - before;
      this.out.notes.push(n > 0 ? `${def.name} 획득${n > 1 ? ` ×${n}` : ''}` : `${def.name} 잃음${n < -1 ? ` ×${-n}` : ''}`);
    }
    if (before === 0 && after > 0 && def.onGain) this.exec(def.onGain);
    else if (before > 0 && after === 0 && def.onLose) this.exec(def.onLose);
  }

  addStatus(id: string, stacks = 1, duration?: number, silent = false): void {
    const def = this.idx.statuses.get(id);
    if (!def) throw new EngineError(`없는 상태 '${id}'`);
    const cur = this.state.statuses[id];
    const max = def.maxStacks ?? 1;
    const remaining = duration ?? def.duration;
    if (cur) {
      cur.stacks = Math.min(max, cur.stacks + stacks);
      if (remaining !== undefined) cur.remaining = Math.max(cur.remaining ?? 0, remaining);
      this.log('status', `상태 '${def.name}' 겹침 ×${cur.stacks}`, cur.remaining !== undefined ? `${cur.remaining}턴 남음` : undefined);
    } else {
      this.state.statuses[id] = { stacks: Math.min(max, stacks), remaining };
      this.log('status', `상태 '${def.name}' 걸림`, remaining !== undefined ? `${remaining}턴 동안` : '풀 때까지');
      if (!def.hidden && !silent) this.out.notes.push(`상태: ${def.name}`);
      if (def.onApply) this.exec(def.onApply);
    }
  }

  removeStatus(id: string, expired = false, silent = false): void {
    const def = this.idx.statuses.get(id);
    if (!this.state.statuses[id]) return;
    delete this.state.statuses[id];
    this.log('status', `상태 '${def?.name ?? id}' ${expired ? '시간이 다 되어 ' : ''}풀림`);
    if (def && !def.hidden && !silent) this.out.notes.push(`${def.name} 해제`);
    if (expired && def?.onExpire) this.exec(def.onExpire);
  }

  // ───────────────────────── 판정 ─────────────────────────

  checkChance(spec: CheckSpec): number {
    const cfg = this.pkg.settings.check ?? {};
    // 확률을 직접 정했으면 그대로(0~100). 공식으로 계산할 때만 설정의 최소·최대(기본 5~95)를 적용한다
    if (spec.chance !== undefined) return Math.max(0, Math.min(100, Math.round(evalNum(spec.chance, this))));
    let p: number;
    this.frames.push({
      skill: spec.skill ? toNum(evaluate(spec.skill, this)) : 0,
      difficulty: evalNum(spec.difficulty ?? 0, this),
      bonus: evalNum(spec.bonus ?? 0, this),
    });
    try {
      p = evalNum(cfg.formula ?? DEFAULT_CHECK_FORMULA, this);
    } finally {
      this.frames.pop();
    }
    return Math.max(cfg.min ?? 5, Math.min(cfg.max ?? 95, Math.round(p)));
  }

  chanceText(p: number): string | undefined {
    const cfg = this.pkg.settings.check ?? {};
    const display = cfg.display ?? 'percent';
    if (display === 'none') return undefined;
    const labels = cfg.labels ?? DEFAULT_CHANCE_LABELS;
    const label = labels.find((l) => p < l.below)?.text ?? labels[labels.length - 1]?.text ?? '';
    if (display === 'percent') return `${p}%`;
    if (display === 'both') return `${label} (${p}%)`;
    return label;
  }

  rollCheck(spec: CheckSpec): boolean {
    const roll = this.random() * 100;
    const p = this.checkChance(spec);
    const ok = roll < p;
    if (this.trace) {
      const how = spec.chance !== undefined ? '직접 지정' : `${spec.skill ?? '능력 없음'} 대 난이도 ${spec.difficulty ?? 0}${spec.bonus ? ` · 보정 ${spec.bonus}` : ''}`;
      this.log('roll', `판정 ${p}% → ${ok ? '성공' : '실패'}`, `${how} · 굴림 ${pct(roll)}`);
    }
    return ok;
  }

  // ───────────────────────── 텍스트 · 기록 ─────────────────────────

  /** images: 본문에서만 켠다. 제목·선택지·알림 등에서는 {image …}가 무시된다 */
  text(template: string, images = false): string {
    return renderTemplate(template, this, () => this.random(), { images });
  }

  record(text: string, importance = 3, eventId?: string): void {
    const s = this.state;
    s.life.push({
      turn: s.turn,
      now: s.now,
      age: this.cal.unit === 'none' ? undefined : this.age(),
      date: this.cal.unit === 'none' ? undefined : this.cal.format(s.now),
      text,
      importance,
      eventId,
    });
  }

  // ───────────────────────── 명령 ─────────────────────────

  num(src: NumOrExpr | undefined, fallback = 0): number {
    return evalNum(src, this, fallback);
  }

  exec(cmds: Command[] | undefined): void {
    if (!cmds) return;
    if (this.depth >= MAX_CALL_DEPTH) throw new EngineError('명령이 너무 깊게 중첩되었습니다(스크립트 무한 호출?)');
    // 가장 바깥 실행마다 let 지역 변수 범위를 새로 연다
    const top = this.depth === 0;
    if (top) this.frames.push({});
    this.depth++;
    try {
      for (const cmd of cmds) this.run(cmd);
    } finally {
      this.depth--;
      if (top) this.frames.pop();
    }
  }

  private run(c: Command): void {
    const s = this.state;
    switch (c.do) {
      case 'set':
        this.setVar(c.var, evaluate(c.value, this));
        break;
      case 'add':
        this.setVar(c.var, toNum(this.baseVar(c.var)) + this.num(c.value));
        break;
      case 'let':
        this.frames[this.frames.length - 1][c.name] = evaluate(c.value, this);
        break;
      case 'tag':
        if (c.add !== undefined) {
          const cur = s.tags[c.key];
          s.tags[c.key] = (typeof cur === 'number' ? cur : 0) + this.num(c.add);
        } else s.tags[c.key] = c.value === undefined ? true : evaluate(c.value, this);
        this.log('tag', `태그 '${c.key}'${s.tags[c.key] === true ? ' 붙음' : ` = ${s.tags[c.key]}`}`);
        break;
      case 'untag':
        if (c.prefix !== undefined) {
          for (const k of Object.keys(s.tags)) if (k.startsWith(c.prefix)) delete s.tags[k];
          this.log('tag', `'${c.prefix}'(으)로 시작하는 태그 떼어 냄`);
        } else if (c.key !== undefined && (c.value === undefined || this.hasTag(c.key, c.value))) {
          if (c.key in s.tags) this.log('tag', `태그 '${c.key}' 떼어 냄`);
          delete s.tags[c.key];
        }
        break;
      case 'item':
        this.addItem(c.id, Math.round(this.num(c.count)), c.silent);
        break;
      case 'status':
        if (c.remove) this.removeStatus(c.id, false, c.silent);
        else this.addStatus(c.id, c.stacks ?? 1, c.duration, c.silent);
        break;
      case 'text':
        this.out.texts.push(this.text(c.text, true));
        break;
      case 'note':
        this.out.notes.push(this.text(c.text));
        break;
      case 'image':
        this.out.images.push(c.asset);
        break;
      case 'if': {
        const ok = evalBool(c.cond, this);
        if (this.trace) this.log('roll', `조건 '${c.cond}' → ${ok ? '맞음' : '안 맞음'}`);
        this.exec(ok ? c.then : c.else);
        break;
      }
      case 'random': {
        const branch = this.pickWeighted(c.branches, (b) => this.num(b.weight), { what: '확률 갈래', name: (b) => `${c.branches.indexOf(b) + 1}번째` });
        if (branch) this.exec(branch.then);
        break;
      }
      case 'check':
        this.exec(this.rollCheck(c.check) ? c.success : c.failure);
        break;
      case 'goto':
        s.queue.push(c.event);
        break;
      case 'call': {
        const script = this.idx.scripts.get(c.script);
        if (!script) throw new EngineError(`없는 스크립트 '${c.script}'`);
        const frame: Record<string, Value> = {};
        for (const [k, v] of Object.entries(c.args ?? {})) frame[k] = evaluate(v, this);
        this.frames.push(frame);
        try {
          this.exec(script.do);
        } finally {
          this.frames.pop();
        }
        break;
      }
      case 'end':
        if (!s.ended) {
          const rule = this.ruleStack[this.ruleStack.length - 1];
          s.ended = rule ? { ending: c.ending, rule: { id: rule.id, name: rule.name, on: rule.on } } : { ending: c.ending };
          this.log('end', `'엔딩' 블록: ${this.idx.endings.get(c.ending)?.title ?? c.ending}`);
        }
        break;
      case 'advance':
        this.advance(Math.max(0, Math.round(this.num(c.amount))));
        break;
      case 'endTurn': {
        const times = Math.max(1, Math.round(this.num(c.times ?? 1)));
        for (let i = 0; i < times && !s.ended; i++) this.endTurnOnce();
        s.phase = -1;
        s.phaseCount = 0;
        break;
      }
      case 'record':
        this.record(this.text(c.text), c.importance);
        break;
      case 'achieve':
        this.achieve(c.id);
        break;
    }
  }

  // ───────────────────────── 수식 컨텍스트 ─────────────────────────

  getSys(name: string): Value {
    for (let i = this.frames.length - 1; i >= 0; i--) if (name in this.frames[i]) return this.frames[i][name];
    const s = this.state;
    switch (name) {
      case 'age':
      case '나이':
        return this.age();
      case 'year':
      case '년':
        return this.cal.parts(s.now).y;
      case 'month':
      case '월':
        return this.cal.parts(s.now).m;
      case 'day':
      case '일':
        return this.cal.parts(s.now).d;
      case 'date':
      case '날짜':
        return this.cal.format(s.now);
      case 'now':
        return s.now;
      case 'birth':
        return s.birth;
      case 'turn':
      case '턴':
        return s.turn;
      case 'stage':
      case '단계':
        return this.currentStage().id;
      case 'stageName':
      case '단계이름':
        return this.currentStage().name;
      case 'name':
      case '이름':
        return s.name;
      case 'pending':
        return s.queue.length > 0;
      case 'ending':
      case '엔딩':
        return s.ended?.ending ?? '';
      case 'runs':
      case '회차':
        return this.meta.runs + 1;
    }
    throw new EngineError(`알 수 없는 시스템 값 $${name}`);
  }

  call(fn: string, a: Value[]): Value | undefined {
    const s = this.state;
    const str = (i: number) => String(a[i] ?? '');
    switch (fn) {
      case 'has':
        return this.hasTag(str(0), a[1]);
      case 'tag': {
        const key = str(0);
        return key in s.tags ? s.tags[key] : (a[1] ?? 0);
      }
      case 'count':
        return Object.keys(s.tags).filter((k) => k.startsWith(str(0))).length;
      case 'item':
        return s.items[str(0)] ?? 0;
      case 'status':
        return s.statuses[str(0)]?.stacks ?? 0;
      case 'statusLeft':
        return s.statuses[str(0)]?.remaining ?? 0;
      case 'seen':
        return str(0) in s.seen;
      case 'seenAgo': {
        const t = s.seen[str(0)];
        return t === undefined ? -1 : s.turn - t;
      }
      case 'rand':
        return this.random();
      case 'randint': {
        const lo = Math.ceil(toNum(a[0]));
        const hi = Math.floor(toNum(a[1]));
        return lo + Math.floor(this.random() * (hi - lo + 1));
      }
      case 'chance': {
        const roll = this.random() * 100;
        const ok = roll < toNum(a[0]);
        if (this.trace) this.log('roll', `확률 ${toNum(a[0])}% → ${ok ? '맞음' : '빗나감'}`, `굴림 ${pct(roll)}`);
        return ok;
      }
      case 'pick':
        return a.length ? a[Math.floor(this.random() * a.length)] : '';
      case 'lookup':
        return this.lookup(str(0), a[1], str(2));
      case 'top':
      case 'bottom': {
        const ids = this.idx.groups.get(str(0)) ?? [];
        let best = ids[0] ?? '';
        for (const id of ids) {
          const d = toNum(this.getVar(id)) - toNum(this.getVar(best));
          if (fn === 'top' ? d > 0 : d < 0) best = id;
        }
        return best;
      }
      case 'sum':
        return (this.idx.groups.get(str(0)) ?? []).reduce((t, id) => t + toNum(this.getVar(id)), 0);
      case 'var':
        return this.getVar(str(0));
      case 'base':
        return this.baseVar(str(0));
      case 'minOf':
      case 'maxOf': {
        const v = this.idx.vars.get(str(0));
        if (!v) throw new EngineError(`선언되지 않은 변수 '${str(0)}'`);
        return this.bound(v, fn === 'minOf' ? 'min' : 'max') ?? 0;
      }
      case 'name':
        return this.displayName(str(0));
      case 'date':
        return this.cal.parse(str(0));
      case 'achieved':
        return str(0) in this.meta.achievements;
      case 'endingSeen':
        return this.meta.endings[str(0)] ?? 0;
    }
    return undefined;
  }

  lookup(tableId: string, key: Value, column: string): Value {
    const t = this.idx.tables.get(tableId);
    if (!t) throw new EngineError(`없는 표 '${tableId}'`);
    let row: Record<string, Value> | undefined;
    if (t.match === 'exact') row = t.rows.find((r) => looseEq(r.key, key))?.values;
    else {
      const k = toNum(key);
      row = t.rows.find((r) => k <= toNum(r.key))?.values;
    }
    row ??= t.fallback;
    if (!row) return 0;
    return row[column] ?? 0;
  }
}

export const SYSTEM_VALUES = [
  'age', '나이', 'year', '년', 'month', '월', 'day', '일', 'date', '날짜', 'now', 'birth', 'turn', '턴',
  'stage', '단계', 'stageName', '단계이름', 'name', '이름', 'pending', 'ending', '엔딩', 'runs', '회차',
  'skill', 'difficulty', 'bonus',
];

export const STATE_FUNCTIONS = [
  'has', 'tag', 'count', 'item', 'status', 'statusLeft', 'seen', 'seenAgo', 'rand', 'randint', 'chance', 'pick',
  'lookup', 'top', 'bottom', 'sum', 'var', 'base', 'minOf', 'maxOf', 'name', 'date', 'achieved', 'endingSeen',
];
