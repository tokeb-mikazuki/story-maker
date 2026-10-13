// 장면 흐름: 이름 입력 → 출신 → (도입부) → 턴 반복[단계(phase)들] → 엔딩.
// UI는 runner.scene을 그리고 choose()/proceed()/useItem()만 호출하면 된다.

import { describeUnmet } from './describe';
import { evalBool } from './expr/eval';
import { isEligible, markSeen, pickFixed, pickRandom } from './scheduler';
import { renderTemplate } from './text';
import type {
  ActionDef,
  ChoiceDef,
  ChoiceView,
  Current,
  EndScene,
  EndingDef,
  EventDef,
  MetaData,
  OriginDef,
  Outcome,
  ResultScene,
  RunState,
  Scene,
  StoryPackage,
  Value,
} from './types';
import { pickName, type NameGender } from './names';
import { MAX_CHOICES } from './types';
import { EngineError, PackageIndex, type TraceEntry, World, emptyMeta } from './world';

const MAX_STEPS = 10_000;

/** 로그용 장면 이름: 제목, 없으면 본문 첫머리 */
export function sceneName(e: EventDef): string {
  if (e.title?.trim()) return e.title;
  const t = e.text.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  return t ? (t.length > 18 ? `${t.slice(0, 18)}…` : t) : e.id;
}

/** 메타 기록 저장소(브라우저에서는 localStorage 등) */
export interface MetaStore {
  load(packageId: string): MetaData | undefined;
  save(packageId: string, meta: MetaData): void;
}

export class MemoryMetaStore implements MetaStore {
  private data = new Map<string, MetaData>();
  load(id: string) {
    const m = this.data.get(id);
    return m && structuredClone(m);
  }
  save(id: string, meta: MetaData) {
    this.data.set(id, structuredClone(meta));
  }
}

export interface RunnerOptions {
  seed?: number;
  name?: string;
  meta?: MetaStore;
  /** 세이브에서 이어하기 */
  save?: RunState;
  /** 미리 만든 색인(시뮬레이터가 재사용) */
  index?: PackageIndex;
  /** 테스트 플레이 로그를 받는 곳 */
  trace?: (e: TraceEntry) => void;
}

export interface HudView {
  /** 이름을 쓰지 않는 이야기면 없음 */
  name?: string;
  date?: string;
  age?: number;
  stage: string;
  vars: { id: string; name: string; value: Value; max?: number; min?: number; label?: string; as: string; format?: string; icon?: string; color?: string }[];
  items: { id: string; name: string; count: number; description?: string; icon?: string; usable: boolean }[];
  statuses: { id: string; name: string; stacks: number; remaining?: number; description?: string; icon?: string; tone?: string }[];
}

export class Runner {
  readonly world: World;
  readonly idx: PackageIndex;
  scene!: Scene;
  private readonly store?: MetaStore;

  constructor(pkg: StoryPackage, opts: RunnerOptions = {}) {
    this.idx = opts.index ?? new PackageIndex(pkg);
    this.store = opts.meta;
    const meta = opts.meta?.load(pkg.meta.id) ?? emptyMeta();
    if (opts.save) {
      this.world = new World(this.idx, structuredClone(opts.save), meta);
      this.world.trace = opts.trace;
      this.scene = this.resume(this.world.state.current);
      return;
    }
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.world = new World(this.idx, World.createState(this.idx, seed, opts.name), meta);
    this.world.trace = opts.trace;
    this.world.log('turn', '새 게임', `시드 ${seed}`);
    this.world.initVariables();
    this.world.fire('start');
    const player = pkg.settings.player;
    this.state.nameStyle = player?.nameStyle;
    if (player?.gender && player.gender !== 'ask') this.state.gender = player.gender;
    // 출신마다 이름 주머니가 다르면 출신을 먼저 정하고 이름을 나중에 정한다
    const nameAfterOrigin = (pkg.origins?.list ?? []).some((o) => o.nameStyle);
    if (opts.name === undefined && (player?.askName || player?.randomName || player?.gender === 'ask')) {
      if (nameAfterOrigin) {
        this.state.namePending = true;
        this.scene = this.beginOrigins();
      } else if (this.asksAtStart) {
        this.state.current = { type: 'name' };
        this.scene = this.nameScene();
      } else {
        this.drawName();
        this.scene = this.beginOrigins();
      }
    } else {
      this.scene = this.beginOrigins();
    }
    this.persistMeta();
  }

  get state(): RunState {
    return this.world.state;
  }

  get pkg(): StoryPackage {
    return this.idx.pkg;
  }

  /** 작가가 주인공 이름을 정했거나 묻게 했는지. 아니면 이름을 화면에 쓰지 않는다 */
  get usesName(): boolean {
    const p = this.pkg.settings.player;
    return !!(p?.askName || p?.randomName || (p?.defaultName && p.defaultName !== '당신'));
  }

  /** 이름이나 성별을 플레이어에게 묻는 화면을 띄우는지 */
  private get asksAtStart(): boolean {
    const p = this.pkg.settings.player;
    return !!(p?.askName || p?.gender === 'ask');
  }

  private nameScene(): Scene {
    const p = this.pkg.settings.player;
    return {
      type: 'name',
      defaultName: this.state.name,
      style: this.state.nameStyle,
      askName: !!p?.askName,
      askGender: p?.gender === 'ask',
    };
  }

  /** 이름 주머니에서 이름을 뽑아 정한다(시드 난수). 주머니가 없으면 그대로 둔다 */
  private drawName(): string | undefined {
    const name = pickName(this.state.nameStyle, () => this.world.random(), this.state.gender, this.pkg.settings.player?.excludeNames);
    if (name) this.state.name = name;
    return name;
  }

  /** 이름 입력 화면의 "무작위" 버튼용. 게임 난수에는 영향을 주지 않는다 */
  rollName(gender?: NameGender): string | undefined {
    return pickName(this.state.nameStyle, Math.random, gender ?? this.state.gender, this.pkg.settings.player?.excludeNames);
  }

  save(): RunState {
    return structuredClone(this.state);
  }

  // ───────────────────────── 입력 ─────────────────────────

  /** gender는 성별을 묻는 화면에서만 쓴다(undefined = 상관없음) */
  setName(name: string, gender?: NameGender): void {
    if (this.scene.type !== 'name') return;
    if (this.scene.askGender) this.state.gender = gender;
    const typed = this.scene.askName ? name.trim() : '';
    const p = this.pkg.settings.player;
    if (typed) this.state.name = typed;
    else if (p?.askName || p?.randomName) this.drawName();
    this.state.current = undefined;
    if (this.state.namePending) {
      // 출신을 이미 정한 뒤의 이름 입력이었다
      this.state.namePending = false;
      this.scene = this.afterOrigin();
    } else {
      this.scene = this.beginOrigins();
    }
  }

  choose(index: number): void {
    const scene = this.scene;
    const cur = this.state.current;
    if (scene.type === 'origin' && cur?.type === 'origin') {
      const origin = this.idx.origins.get(cur.offered[index]);
      if (origin) this.applyOrigin(origin);
    } else if (scene.type === 'event' && cur?.type === 'event') {
      const event = this.idx.events.get(cur.id)!;
      const choices = this.visibleChoices(event.choices);
      if (choices.length === 0 && index === 0) {
        this.state.current = undefined;
        this.scene = this.next();
      } else {
        const choice = choices[index];
        if (!choice || !evalBool(choice.requires, this.world)) return;
        this.state.current = undefined;
        this.resolve(choice, { from: 'event', id: event.id, path: '' }, event.choices.indexOf(choice));
      }
    } else if (scene.type === 'event' && cur?.type === 'sub') {
      const all = this.subChoices(cur);
      const choices = this.visibleChoices(all);
      if (choices.length === 0 && index === 0) {
        this.state.current = undefined;
        this.scene = this.next();
      } else {
        const choice = choices[index];
        if (!choice || !evalBool(choice.requires, this.world)) return;
        this.state.current = undefined;
        this.resolve(choice, cur, all.indexOf(choice));
      }
    } else if (scene.type === 'menu' && cur?.type === 'menu') {
      const action = this.visibleChoices(this.menuActions(cur.phase))[index];
      if (!action || !evalBool(action.requires, this.world)) return;
      this.state.current = undefined;
      this.resolve(action, { from: 'action', id: action.id, path: '' }, 0);
    } else if (scene.type === 'result' || scene.type === 'end') {
      this.proceed();
      return;
    }
    this.persistMeta();
  }

  proceed(): void {
    if (this.scene.type !== 'result') return;
    this.state.pendingResult = undefined;
    const back = this.state.returnTo;
    this.state.returnTo = undefined;
    this.state.current = undefined;
    this.scene = back && !this.state.ended ? this.resume(back) : this.next();
    this.persistMeta();
  }

  /** 아이템 사용(이벤트·메뉴 화면에서) */
  useItem(id: string): boolean {
    const def = this.idx.items.get(id);
    const cur = this.state.current;
    if (!def?.use || !this.state.items[id] || (cur?.type !== 'event' && cur?.type !== 'menu' && cur?.type !== 'sub')) return false;
    if (!evalBool(def.use.when, this.world)) return false;
    const w = this.world;
    const before = w.snapshot();
    if (def.use.text) w.out.texts.push(w.text(def.use.text, true));
    w.exec(def.use.do);
    if (def.use.consume !== false) w.addItem(id, -1);
    w.settle();
    w.out.notes.push(...w.diffNotes(before));
    this.state.returnTo = cur;
    this.scene = this.flush() ?? this.resume(cur);
    this.persistMeta();
    return true;
  }

  canUse(id: string): boolean {
    const def = this.idx.items.get(id);
    const cur = this.state.current;
    return (
      !!def?.use &&
      !!this.state.items[id] &&
      (cur?.type === 'event' || cur?.type === 'menu' || cur?.type === 'sub') &&
      evalBool(def.use.when, this.world)
    );
  }

  // ───────────────────────── 출신 ─────────────────────────

  private beginOrigins(): Scene {
    const cfg = this.pkg.origins;
    const pool = (cfg?.list ?? []).filter((o) => evalBool(o.unlock, this.world));
    if (!cfg || pool.length === 0) return this.afterOrigin();
    const weight = (o: OriginDef) => this.world.num(o.weight ?? 10);
    if (cfg.mode === 'random') {
      const pick = this.world.pickWeighted(pool, weight, { what: '출신', name: (o) => o.title }) ?? pool[0];
      return this.applyOrigin(pick);
    }
    const offered: OriginDef[] = [];
    const limit = Math.min(cfg.offer ?? pool.length, MAX_CHOICES);
    while (offered.length < Math.min(limit, pool.length)) {
      const pick = this.world.pickWeighted(
        pool.filter((o) => !offered.includes(o)),
        weight,
      );
      if (!pick) break;
      offered.push(pick);
    }
    this.state.current = { type: 'origin', offered: offered.map((o) => o.id) };
    return (this.scene = this.originScene(offered));
  }

  private originScene(offered: OriginDef[]): Scene {
    const cfg = this.pkg.origins!;
    return {
      type: 'origin',
      title: cfg.title,
      text: this.world.text(cfg.text ?? '', true),
      origins: offered.map((o) => ({ ...o, title: this.world.text(o.title), summary: o.summary && this.world.text(o.summary) })),
    };
  }

  private applyOrigin(origin: OriginDef): Scene {
    const w = this.world;
    w.log('choice', `출신: ${origin.title}`);
    this.state.current = undefined;
    if (origin.nameStyle) this.state.nameStyle = origin.nameStyle;
    w.exec(origin.do);
    if (origin.text) w.out.texts.push(w.text(origin.text, true));
    if (origin.image) w.out.images.push(origin.image);
    return (this.scene = this.afterOrigin());
  }

  private afterOrigin(): Scene {
    if (this.state.namePending) {
      if (this.asksAtStart) {
        this.state.current = { type: 'name' };
        return (this.scene = this.nameScene());
      }
      this.state.namePending = false;
      if (this.pkg.settings.player?.askName || this.pkg.settings.player?.randomName) this.drawName();
    }
    const start = this.pkg.settings.start;
    if (start) this.state.queue.push(start);
    this.world.settle();
    return (this.scene = this.flush() ?? this.next());
  }

  // ───────────────────────── 선택 처리 ─────────────────────────

  private visibleChoices<T extends ChoiceDef>(choices: T[]): T[] {
    return choices.filter((c) => !(c.hidden && !evalBool(c.requires, this.world)));
  }

  private menuActions(phase: number): ActionDef[] {
    const p = this.world.currentStage().phases[phase];
    if (!p || p.type !== 'menu') return [];
    return this.idx.actions.filter((a) => a.pool === p.pool && evalBool(a.when, this.world));
  }

  /**
   * 선택지 하나를 처리한다. at은 이 선택지가 들어 있던 목록의 위치, index는 그 목록 안의 번호
   * (결과에 이어지는 선택지가 있으면 그 위치를 기억해 다음 장면으로 띄운다)
   */
  private resolve(choice: ChoiceDef, at: { from: 'event' | 'action'; id: string; path: string }, index: number): void {
    const w = this.world;
    w.log('choice', `선택: ${choice.text}`);
    this.state.lastPick = { from: at.from, id: at.id, choice: choice.text, turn: this.state.turn };
    const before = w.snapshot();
    let outcome: Outcome | undefined;
    let key = 'outcome';
    if (choice.check) {
      const ok = w.rollCheck(choice.check);
      const cfg = this.pkg.settings.check ?? {};
      const note = ok ? (cfg.successNote ?? '성공') : (cfg.failureNote ?? '실패');
      if (note) w.out.notes.push(note);
      outcome = ok ? choice.success : choice.failure;
      key = ok ? 'success' : 'failure';
    } else if (choice.results?.length) {
      outcome = w.pickWeighted(choice.results, (r) => w.num(r.weight), { what: '확률 결과', name: (r) => `${choice.results!.indexOf(r) + 1}번째 갈래` });
      key = `r${outcome ? choice.results.indexOf(outcome as (typeof choice.results)[number]) : 0}`;
    } else {
      outcome = choice.outcome;
    }
    if (outcome?.text) w.out.texts.push(w.text(outcome.text, true));
    if (outcome?.image) w.out.images.push(outcome.image);
    w.exec(outcome?.do);
    if (outcome?.goto) this.state.queue.push(outcome.goto);
    w.settle();
    w.out.notes.push(...w.diffNotes(before));
    if (outcome?.choices?.length && !this.state.ended) {
      // 결과 글과 함께 이어지는 선택지를 띄운다
      const out = w.out;
      w.out = { texts: [], notes: [], images: [] };
      const cur: Current = {
        type: 'sub',
        from: at.from,
        id: at.id,
        path: `${at.path ? `${at.path}/` : ''}${index}:${key}`,
        text: out.texts.filter(Boolean).join('\n\n'),
        notes: out.notes,
        image: out.images[0],
      };
      this.state.current = cur;
      this.state.turnActive = true;
      this.scene = this.presentSub(cur);
      return;
    }
    this.scene = this.flush() ?? this.next();
  }

  /** 이어지는 선택지 목록 찾기 */
  private subChoices(cur: Extract<Current, { type: 'sub' }>): ChoiceDef[] {
    let list: ChoiceDef[] =
      cur.from === 'event' ? (this.idx.events.get(cur.id)?.choices ?? []) : [this.idx.actions.find((a) => a.id === cur.id)].filter((a): a is ActionDef => !!a);
    for (const seg of cur.path.split('/')) {
      const [ci, key] = seg.split(':');
      const c = list[Number(ci)];
      const o: Outcome | undefined = !c
        ? undefined
        : key === 'success'
          ? c.success
          : key === 'failure'
            ? c.failure
            : key === 'outcome'
              ? c.outcome
              : c.results?.[Number(key.slice(1))];
      list = o?.choices ?? [];
    }
    return list;
  }

  private presentSub(cur: Extract<Current, { type: 'sub' }>): Scene {
    const w = this.world;
    const event = cur.from === 'event' ? this.idx.events.get(cur.id) : undefined;
    const choices = this.visibleChoices(this.subChoices(cur)).map((c, i) => this.choiceView(c, i));
    if (choices.length === 0) choices.push({ index: 0, text: this.pkg.settings.ui?.continueText ?? '계속', enabled: true });
    return {
      type: 'event',
      id: cur.id,
      title: event?.title && w.text(event.title),
      text: cur.text,
      image: cur.image,
      choices,
      notes: cur.notes,
    };
  }

  /** 쌓인 출력이 있으면 결과 장면으로 */
  private flush(): ResultScene | undefined {
    const out = this.world.out;
    if (!out.texts.length && !out.notes.length && !out.images.length) return undefined;
    const scene: ResultScene = {
      type: 'result',
      text: out.texts.filter(Boolean).join('\n\n'),
      notes: out.notes,
      images: out.images,
    };
    this.world.out = { texts: [], notes: [], images: [] };
    this.state.current = { type: 'result' };
    this.state.pendingResult = scene;
    this.state.turnActive = true;
    return scene;
  }

  // ───────────────────────── 진행 ─────────────────────────

  private resume(cur: Current | undefined): Scene {
    const s = this.state;
    s.current = cur;
    switch (cur?.type) {
      case 'name':
        return this.nameScene();
      case 'origin':
        return this.originScene(cur.offered.map((id) => this.idx.origins.get(id)!).filter(Boolean));
      case 'event': {
        const e = this.idx.events.get(cur.id);
        if (e) return this.presentEvent(e);
        break;
      }
      case 'menu':
        return this.presentMenu(cur.phase);
      case 'sub':
        return this.presentSub(cur);
      case 'result':
        if (s.pendingResult) return s.pendingResult;
        break;
    }
    s.current = undefined;
    return this.next();
  }

  /** 다음에 보여줄 장면을 계산 */
  private next(): Scene {
    const w = this.world;
    const s = this.state;
    for (let step = 0; step < MAX_STEPS; step++) {
      if (s.ended) return this.ending();
      w.settle();
      const out = this.flush();
      if (out) return out;
      if (s.ended) continue;

      if (s.queue.length) {
        const event = this.idx.events.get(s.queue.shift()!);
        if (event) return this.showEvent(event);
        continue;
      }

      if (s.phase === -1) {
        const stage = w.stageNow();
        s.phase = 0;
        s.phaseCount = 0;
        s.turnActive = false;
        if (stage.id !== s.stage) {
          s.stage = stage.id;
          w.log('stage', `단계: ${stage.name}`);
          w.fire('stageEnter');
        }
        w.fire('turnStart');
        continue;
      }

      const phases = w.currentStage().phases;
      if (s.phase >= phases.length) {
        this.finishTurn();
        continue;
      }

      const p = phases[s.phase];
      if (p.type === 'script') {
        s.phase++;
        w.exec(p.do);
        continue;
      }
      if (p.type === 'menu') {
        const phase = s.phase;
        s.phase++;
        s.phaseCount = 0;
        if (this.menuActions(phase).length === 0) continue;
        s.current = { type: 'menu', phase };
        s.turnActive = true;
        return this.presentMenu(phase);
      }
      // events
      const limit = p.count ?? 1;
      let skip = s.phaseCount >= limit;
      if (!skip && p.chance !== undefined) {
        const roll = w.random() * 100;
        const c = w.num(p.chance);
        skip = roll >= c;
        if (w.trace) w.log('roll', `장면 뽑기 확률 ${c}% → ${skip ? '이번엔 없음' : '뽑음'}`, `굴림 ${Math.round(roll * 10) / 10}`);
      }
      if (skip) {
        s.phase++;
        s.phaseCount = 0;
        continue;
      }
      let event: EventDef | undefined;
      if (p.select !== 'random') {
        event = pickFixed(w, p.pools);
        if (event) w.log('pick', `반드시 나올 장면 → ${sceneName(event)}`);
      }
      if (!event && p.select !== 'fixed') event = pickRandom(w, p.pools);
      if (!event) {
        s.phase++;
        s.phaseCount = 0;
        continue;
      }
      s.phaseCount++;
      return this.showEvent(event);
    }
    throw new EngineError('진행할 장면을 찾지 못했습니다. 턴 구성이나 종료 조건을 확인하세요.');
  }

  private finishTurn(): void {
    const s = this.state;
    const settings = this.pkg.settings;
    s.idleTurns = s.turnActive ? 0 : s.idleTurns + 1;
    if (settings.idleEnding && s.idleTurns >= settings.idleEnding.turns) {
      s.ended = { ending: settings.idleEnding.ending };
      this.world.log('end', '더 일어날 일이 없어 끝남');
      return;
    }
    this.world.endTurnOnce();
    s.phase = -1;
    if (settings.maxTurns && s.turn >= settings.maxTurns.turns && !s.ended) {
      s.ended = { ending: settings.maxTurns.ending };
      this.world.log('end', `최대 턴(${settings.maxTurns.turns})에 도달해 끝남`);
    }
  }

  private showEvent(event: EventDef): Scene {
    this.world.log('scene', `장면: ${sceneName(event)}`);
    markSeen(this.world, event);
    this.state.current = { type: 'event', id: event.id };
    this.state.turnActive = true;
    return this.presentEvent(event);
  }

  private presentEvent(event: EventDef): Scene {
    const w = this.world;
    const choices = this.visibleChoices(event.choices).map((c, i) => this.choiceView(c, i));
    if (choices.length === 0)
      choices.push({ index: 0, text: this.pkg.settings.ui?.continueText ?? '계속', enabled: true });
    return {
      type: 'event',
      id: event.id,
      title: event.title && w.text(event.title),
      text: w.text(event.text, true),
      image: event.image,
      choices,
    };
  }

  private presentMenu(phase: number): Scene {
    const p = this.world.currentStage().phases[phase];
    const w = this.world;
    return {
      type: 'menu',
      title: p?.type === 'menu' && p.title ? w.text(p.title) : undefined,
      text: p?.type === 'menu' && p.text ? w.text(p.text, true) : '',
      choices: this.visibleChoices(this.menuActions(phase)).map((a, i) => this.choiceView(a, i)),
    };
  }

  private choiceView(choice: ChoiceDef, index: number): ChoiceView {
    const w = this.world;
    const enabled = evalBool(choice.requires, w);
    return {
      index,
      text: w.text(choice.text),
      enabled,
      reason: enabled
        ? undefined
        : choice.requiresText
          ? w.text(choice.requiresText)
          : `필요: ${describeUnmet(choice.requires!, w).join(', ')}`,
      chance: choice.check && enabled ? w.chanceText(w.checkChance(choice.check)) : undefined,
    };
  }

  // ───────────────────────── 엔딩 ─────────────────────────

  /**
   * 인생표 마지막 줄: "사망: 뒷골목에 쓰러지다". 어떤 선택지를 골라서 끝났는지는 적지 않는다.
   * 노환처럼 자동 규칙으로 끝났으면 그 규칙 이름만 덧붙인다. 난수를 쓰지 않는다
   */
  private endingRecord(ending: EndingDef): string {
    const w = this.world;
    const plain = (t: string) => renderTemplate(t, w, () => 0).trim();
    const rule = this.state.ended?.rule;
    const why = rule ? (rule.name ?? rule.id) : undefined;
    return `${ending.kind === 'death' ? '사망: ' : ''}${plain(ending.title)}${why ? ` (${why})` : ''}`;
  }

  private ending(): EndScene {
    const w = this.world;
    const s = this.state;
    const id = s.ended!.ending;
    const ending: EndingDef = this.idx.endings.get(id) ?? { id, title: id };
    if (!s.finalized) {
      s.finalized = true;
      w.fire('end');
      w.checkAchievements();
      if (this.pkg.settings.recordEnding !== false) w.record(this.endingRecord(ending), 5, s.lastPick?.from === 'event' && s.lastPick.turn === s.turn ? s.lastPick.id : undefined);
      w.meta.endings[id] = (w.meta.endings[id] ?? 0) + 1;
      w.meta.runs += 1;
      w.metaChanged = true;
      w.out = { texts: [], notes: [], images: [] };
    }
    s.current = undefined;
    const parts: string[] = [];
    const ep = this.pkg.epilogue;
    if (ep?.header) parts.push(w.text(ep.header));
    if (ending.text) parts.push(w.text(ending.text, true));
    const paragraphs = (ep?.paragraphs ?? [])
      .filter((p) => evalBool(p.when, w))
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    for (const p of paragraphs) {
      const lines = p.lines.filter((l) => evalBool(l.when, w)).map((l) => w.text(l.text, true));
      if (lines.length) parts.push(lines.join(' '));
    }
    if (ep?.footer) parts.push(w.text(ep.footer));
    return {
      type: 'end',
      ending: { ...ending, title: w.text(ending.title) },
      text: parts.filter(Boolean).join('\n\n'),
      life: s.life,
      achievements: s.achieved.map((a) => this.idx.achievements.get(a)!).filter(Boolean),
    };
  }

  private persistMeta(): void {
    if (this.world.metaChanged && this.store) {
      this.store.save(this.pkg.meta.id, this.world.meta);
      this.world.metaChanged = false;
    }
  }

  // ───────────────────────── 상태창 ─────────────────────────

  hud(): HudView {
    const w = this.world;
    const s = this.state;
    const vars = this.pkg.variables
      .filter((v) => v.display?.as && v.display.as !== 'hidden')
      .sort((a, b) => (a.display!.order ?? 50) - (b.display!.order ?? 50))
      .map((v) => {
        const value = w.getVar(v.id);
        const label = v.display!.labels?.find((l) => Number(value) <= l.upTo)?.text;
        return {
          id: v.id,
          name: v.name ?? v.id,
          value,
          max: v.max === undefined ? undefined : w.num(v.max),
          min: v.min === undefined ? undefined : w.num(v.min),
          label,
          as: v.display!.as!,
          format: v.display!.format,
          icon: v.display!.icon,
          color: v.display!.color,
        };
      });
    return {
      name: this.usesName ? s.name : undefined,
      date: w.cal.unit === 'none' ? undefined : w.cal.format(s.now),
      age: w.cal.unit === 'none' ? undefined : w.age(),
      stage: w.currentStage().name,
      vars,
      items: Object.entries(s.items)
        .map(([id, count]) => ({ def: this.idx.items.get(id)!, id, count }))
        .filter((i) => i.def && !i.def.hidden)
        .map((i) => ({
          id: i.id,
          name: i.def.name,
          count: i.count,
          description: i.def.description,
          icon: i.def.icon,
          usable: this.canUse(i.id),
        })),
      statuses: Object.entries(s.statuses)
        .map(([id, st]) => ({ def: this.idx.statuses.get(id)!, id, st }))
        .filter((x) => x.def && !x.def.hidden)
        .map((x) => ({
          id: x.id,
          name: x.def.name,
          stacks: x.st.stacks,
          remaining: x.st.remaining,
          description: x.def.description,
          icon: x.def.icon,
          tone: x.def.tone,
        })),
    };
  }

  /** 지금 이 이벤트가 뜰 수 있는 상태인가(에디터 테스트 플레이용) */
  isEligible(eventId: string): boolean {
    const e = this.idx.events.get(eventId);
    return !!e && isEligible(this.world, e);
  }

  /** 테스트 플레이: 상태를 직접 고친 뒤 현재 장면을 다시 그린다 */
  refresh(): void {
    if (this.state.ended) {
      this.scene = this.ending();
      return;
    }
    this.world.settle();
    this.scene = this.world.out.texts.length || this.world.out.notes.length ? this.flush()! : this.resume(this.state.current);
    this.persistMeta();
  }

  /** 테스트 플레이: 지정한 이벤트로 바로 이동 */
  jumpTo(eventId: string): void {
    const e = this.idx.events.get(eventId);
    if (!e) throw new EngineError(`없는 이벤트 '${eventId}'`);
    this.state.pendingResult = undefined;
    this.state.returnTo = undefined;
    this.scene = this.showEvent(e);
  }
}
