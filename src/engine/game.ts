import type { Action, Choice, Content, GameEvent, Origin, Outcome, PlayerState } from './types';
import { describeUnmet, evaluate } from './conditions';
import { applyEffects, chanceLabel, checkChance, rollCheck } from './effects';
import { buildEpilogue } from './epilogue';
import { nextRandom, pickWeighted } from './rng';
import { markSeen, pickFixed, pickRandom } from './scheduler';
import { SP_MIN, hpMax, removeTag, setTag, tagNumber } from './state';
import { renderText } from './text';
import { HISTORY, ageOf, stageOf, turnLength } from './time';

export interface ChoiceView {
  index: number;
  text: string;
  enabled: boolean;
  reason?: string;
  chance?: string;
}

export type Scene =
  | { type: 'origin'; text: string; origins: Origin[] }
  | { type: 'event'; title?: string; text: string; choices: ChoiceView[] }
  | { type: 'actions'; text: string; choices: ChoiceView[] }
  | { type: 'result'; text: string; notes: string[] }
  | { type: 'end'; text: string };

/** 성인기 월간 생활비 (docs/design/01 §6) */
export const LIVING_COST: Record<string, number> = {
  둥지: 2_200_000,
  뒷골목: 400_000,
  무등록: 50_000,
};

/** 성인기 한 달에 랜덤 인카운터가 일어날 확률 */
const ADULT_ENCOUNTER_CHANCE = 0.7;
const YEAR_ACTION_ID = '__year';
const ACTIONS_MARK = '__actions';

export class Game {
  scene: Scene;

  constructor(
    readonly content: Content,
    readonly state: PlayerState,
  ) {
    this.scene = this.resume();
  }

  /** 세이브에서 이어하기: 진행 중이던 장면을 다시 띄운다 */
  private resume(): Scene {
    const current = this.state.current;
    if (current === ACTIONS_MARK) return this.showActions();
    if (current) {
      const event = this.content.events.get(current);
      if (event) return this.presentEvent(event);
    }
    return this.next();
  }

  // ───────────────────────── 선택 처리 ─────────────────────────

  choose(index: number): void {
    const scene = this.scene;
    if (scene.type === 'origin') {
      this.chooseOrigin(scene.origins[index]);
    } else if (scene.type === 'event') {
      const event = this.content.events.get(this.state.current ?? '');
      const choice = event ? this.visibleChoices(event)[index] : undefined;
      if (!choice || !evaluate(choice.requires, this.state)) return;
      this.state.current = undefined;
      this.resolve(choice);
    } else if (scene.type === 'actions') {
      const actions = this.availableActions();
      const action = actions[index];
      if (!action || !evaluate(action.requires, this.state)) return;
      this.state.current = undefined;
      if (action.id === YEAR_ACTION_ID) this.passYear();
      else this.resolve(action);
    }
  }

  proceed(): void {
    if (this.scene.type === 'result') this.scene = this.next();
  }

  private chooseOrigin(origin: Origin | undefined): void {
    if (!origin) return;
    const s = this.state;
    s.money = origin.money;
    for (const tag of origin.tags) setTag(s, tag);
    Object.assign(s.virtues, origin.virtues ?? {});
    Object.assign(s.abilities, origin.abilities ?? {});
    s.hp = hpMax(s);
    s.phase = 'start';
    setTag(s, `기록:출생=${origin.id}`);
    this.scene = { type: 'result', text: renderText(origin.text, s), notes: [] };
  }

  private resolve(choice: Choice | Action): void {
    let outcome: Outcome | undefined;
    let verdict: string | undefined;
    if (choice.check) {
      const ok = rollCheck(this.state, choice.check);
      verdict = ok ? '성공' : '실패';
      outcome = ok ? choice.success : choice.failure;
    } else {
      outcome = choice.outcome;
    }
    const result = applyEffects(this.state, outcome?.effects);
    if (result.ended) this.state.ended = { reason: result.ended };
    const goto = outcome?.goto ?? result.goto;
    if (goto) this.state.pending = goto;

    const notes = [...(verdict ? [verdict] : []), ...result.notes, ...this.drainLog()];
    const text = outcome?.text ? renderText(outcome.text, this.state) : '';
    this.scene = text || notes.length ? { type: 'result', text, notes } : this.next();
  }

  // ───────────────────────── 진행 ─────────────────────────

  /** 현재 상태에서 다음에 보여줄 장면을 계산한다 */
  private next(): Scene {
    const s = this.state;
    // 시간이 계속 흘러도 보여줄 게 없는 경우를 대비한 안전장치
    for (let guard = 0; guard < 2000; guard++) {
      if (s.ended) return this.ending();

      const vital = this.checkVitals();
      if (vital) return vital;

      if (s.pending) {
        const event = this.content.events.get(s.pending);
        s.pending = undefined;
        if (event) return this.showEvent(event);
      }

      const adult = stageOf(s) === 'adult';
      switch (s.phase) {
        case 'origin':
          return this.showOrigins();
        case 'start': {
          s.phase = adult ? 'action' : 'encounter';
          const fixed = pickFixed(this.content, s, ['story', 'encounter']);
          if (fixed) return this.showEvent(fixed);
          break;
        }
        case 'action':
          s.phase = 'encounter';
          return this.showActions();
        case 'encounter': {
          s.phase = adult ? 'night' : 'end';
          if (adult && nextRandom(s) >= ADULT_ENCOUNTER_CHANCE) break;
          const event = pickRandom(this.content, s, ['story', 'encounter']);
          if (event) return this.showEvent(event);
          break;
        }
        case 'night': {
          s.phase = 'end';
          const event = pickFixed(this.content, s, ['night']) ?? pickRandom(this.content, s, ['night']);
          if (event) return this.showEvent(event);
          break;
        }
        case 'end':
          this.endTurn();
          s.phase = 'start';
          break;
      }
    }
    throw new Error('진행할 장면을 찾지 못했습니다.');
  }

  private checkVitals(): Scene | undefined {
    const s = this.state;
    if (s.hp <= 0) {
      if ('소지:K사앰플' in s.tags) {
        removeTag(s, '소지:K사앰플');
        s.hp = hpMax(s);
        return {
          type: 'result',
          text: '의식이 끊기기 직전, 품속의 K사 앰플을 목에 꽂습니다. 살이 차오르는 감각이 끔찍하게 간지럽습니다. 당신은 원래의 모습으로 되돌아왔습니다.',
          notes: ['K사 앰플 소모', '체력 회복'],
        };
      }
      s.ended = { reason: '사망' };
      return this.ending();
    }
    if (s.sp <= SP_MIN && !s.pending) {
      const id = s.now >= HISTORY.whiteNights ? 'crisis.voice' : 'crisis.breakdown';
      const event = this.content.events.get(id);
      if (event) return this.showEvent(event);
      s.ended = { reason: '붕괴' };
      return this.ending();
    }
    return undefined;
  }

  /** 턴 종료: 시간 경과, 월말 정산, 노화 */
  private endTurn(): void {
    const s = this.state;
    const stage = stageOf(s);
    let months = turnLength(stage);
    if (stage !== 'adult') {
      // 단계 경계(13세, 20세)를 넘지 않도록 자른다
      const nextBoundary = s.birth + (stage === 'child' ? 13 : 20) * 12;
      months = Math.max(1, Math.min(months, nextBoundary - s.now));
    }
    for (let i = 0; i < months; i++) this.passMonth();
    s.turn += 1;
    for (const key of Object.keys(s.tags)) if (key.startsWith('이번달:')) delete s.tags[key];
  }

  private passMonth(): void {
    const s = this.state;
    if (stageOf(s) === 'adult') this.settleMonth();
    if (s.sp < 0) s.sp += 1; // 시간이 약이다(조금은)
    if (s.hp > 0) s.hp = Math.min(hpMax(s), s.hp + 1); // 상처는 한 달에 조금씩 아문다
    s.now += 1;
    if ((s.now - s.birth) % 12 === 0) this.birthday();
  }

  private settleMonth(): void {
    const s = this.state;
    const residence = String(s.tags['거주'] ?? '뒷골목');
    const cost = typeof s.tags['생활비'] === 'number' ? s.tags['생활비'] : (LIVING_COST[residence] ?? 400_000);
    s.money += tagNumber(s, '월급') - cost - tagNumber(s, '상납금');
    if (s.money >= 0) {
      delete s.tags['체납'];
      return;
    }
    s.tags['체납'] = tagNumber(s, '체납') + 1;
    if (tagNumber(s, '체납') >= 2) {
      if (residence === '둥지') {
        s.tags['거주'] = '뒷골목';
        s.log.push('세금을 감당하지 못해 둥지에서 밀려났다.');
      } else if (residence === '뒷골목') {
        s.tags['거주'] = '무등록';
        s.log.push('거주구역 등록이 만료되었다. 이제 밤이 당신을 지켜주지 않는다.');
      }
    }
  }

  private birthday(): void {
    const s = this.state;
    const age = ageOf(s);
    if (age >= 50 && !('신체:노화억제' in s.tags)) {
      s.hpMaxBonus -= 1;
      s.hp = Math.min(s.hp, hpMax(s));
    }
    if (age >= 60 && nextRandom(s) * 100 < (age - 60) * 3) s.ended = { reason: '노환' };
  }

  private passYear(): void {
    const before = this.state.money;
    for (let i = 0; i < 12 && !this.state.ended; i++) {
      this.endTurn();
    }
    this.state.sp = Math.min(this.state.sp + 5, 45);
    this.state.phase = 'start';
    const diff = this.state.money - before;
    this.scene = {
      type: 'result',
      text: '별일 없는 한 해가 지나갔습니다. 도시에서 "별일 없음"은 꽤 큰 행운입니다.',
      notes: [`1년 경과`, `${diff >= 0 ? '+' : ''}${diff.toLocaleString()} 안`, ...this.drainLog()],
    };
  }

  // ───────────────────────── 장면 구성 ─────────────────────────

  private showOrigins(): Scene {
    const pool = this.content.origins.filter((o) => o.unlocked !== false);
    const offered: Origin[] = [];
    while (offered.length < 3 && offered.length < pool.length) {
      const pick = pickWeighted(
        this.state,
        pool.filter((o) => !offered.includes(o)),
        (o) => o.weight ?? 10,
      );
      if (!pick) break;
      offered.push(pick);
    }
    return {
      type: 'origin',
      text: '당신은 26개의 구로 나뉜 거대한 도시에서 태어납니다. 964년, 로보토미 코퍼레이션이 날개가 되기 한참 전의 일입니다.\n\n어디에서 태어날지는, 당신이 고를 수 있는 몇 안 되는 것 중 하나입니다.',
      origins: offered,
    };
  }

  private showEvent(event: GameEvent): Scene {
    markSeen(this.state, event);
    this.state.current = event.id;
    return this.presentEvent(event);
  }

  private presentEvent(event: GameEvent): Scene {
    this.scene = {
      type: 'event',
      title: event.title,
      text: renderText(event.text, this.state),
      choices: this.visibleChoices(event).map((c, i) => this.choiceView(c, i)),
    };
    return this.scene;
  }

  private showActions(): Scene {
    this.state.current = ACTIONS_MARK;
    return {
      type: 'actions',
      text: `${renderText('{날짜}. 이번 달은 무엇을 하며 보내시겠습니까?', this.state)}`,
      choices: this.availableActions().map((a, i) => this.choiceView(a, i)),
    };
  }

  private visibleChoices(event: GameEvent): Choice[] {
    return event.choices.filter((c) => !(c.hidden && !evaluate(c.requires, this.state)));
  }

  private availableActions(): Action[] {
    const s = this.state;
    const list = this.content.actions.filter((a) => evaluate(a.when, s));
    list.push({
      id: YEAR_ACTION_ID,
      text: '평온하게 1년 보내기',
      requires: { all: [{ sp: { gte: 0 } }, { money: { gte: 0 } }] },
    });
    return list;
  }

  private choiceView(choice: Choice | Action, index: number): ChoiceView {
    const enabled = evaluate(choice.requires, this.state);
    return {
      index,
      text: renderText(choice.text, this.state),
      enabled,
      reason: enabled ? undefined : `필요: ${describeUnmet(choice.requires, this.state).join(', ')}`,
      chance: choice.check && enabled ? chanceLabel(checkChance(this.state, choice.check)) : undefined,
    };
  }

  private ending(): Scene {
    this.state.current = undefined;
    return { type: 'end', text: buildEpilogue(this.content, this.state) };
  }

  private drainLog(): string[] {
    const log = this.state.log;
    this.state.log = [];
    return log;
  }
}
