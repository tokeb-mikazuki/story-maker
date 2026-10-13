import { describe, expect, it } from 'vitest';
import { loadBundledContent, validateContent } from './content';
import { Game } from './game';
import { createState } from './state';
import { checkChance } from './effects';
import { ageOf } from './time';

const content = loadBundledContent();

/** 즉시 종료(end) 효과가 붙은 선택지인지 — 신중한 봇이 피한다 */
function isSuicidal(game: Game, index: number): boolean {
  const s = game.state;
  const choice =
    game.scene.type === 'event'
      ? game.content.events.get(s.current ?? '')?.choices[index]
      : game.content.actions.filter((a) => a.id !== '__year')[index];
  if (!choice) return false;
  const outcomes = [choice.outcome, choice.success];
  return outcomes.some((o) => o?.effects?.some((e) => 'end' in e && e.end !== '은퇴'));
}

/** 실제 플레이어 흉내: 자살 선택 회피, 성공 확률 높은 선택 선호, 밤일은 피함 */
function playCautiousLife(seed: number, maxSteps = 20000) {
  const game = new Game(content, createState(seed));
  for (let step = 0; step < maxSteps; step++) {
    const scene = game.scene;
    if (scene.type === 'end') return game;
    if (scene.type === 'result') game.proceed();
    else if (scene.type === 'origin') game.choose(seed % scene.origins.length);
    else {
      const rank = { '매우 유리': 5, 유리: 4, 반반: 3, 불리: 2, '매우 불리': 1 } as Record<string, number>;
      const options = scene.choices
        .filter((c) => c.enabled && !isSuicidal(game, c.index) && !c.text.includes('밤늦게'))
        .map((c) => ({ c, score: (c.chance ? rank[c.chance] : 3.5) + ((seed * 31 + c.index * 17 + step) % 7) / 10 }));
      const pick = options.sort((a, b) => b.score - a.score)[0]?.c ?? scene.choices.find((c) => c.enabled)!;
      game.choose(pick.index);
    }
  }
  throw new Error(`cautious seed ${seed}: 끝나지 않음`);
}

/** 무작위로 선택하는 봇으로 인생 하나를 끝까지 진행 */
function playRandomLife(seed: number, maxSteps = 20000) {
  const game = new Game(content, createState(seed));
  let botRng = seed;
  const rand = () => {
    botRng = (botRng * 1103515245 + 12345) & 0x7fffffff;
    return botRng / 0x7fffffff;
  };
  const visited = new Set<string>();
  for (let step = 0; step < maxSteps; step++) {
    const scene = game.scene;
    if (scene.type === 'end') return { game, scene, steps: step, visited };
    if (game.state.current) visited.add(game.state.current);
    if (scene.type === 'result') {
      game.proceed();
    } else if (scene.type === 'origin') {
      game.choose(Math.floor(rand() * scene.origins.length));
    } else {
      const enabled = scene.choices.filter((c) => c.enabled);
      expect(enabled.length, `선택 가능한 선택지가 없음: ${game.state.current}`).toBeGreaterThan(0);
      game.choose(enabled[Math.floor(rand() * enabled.length)].index);
    }
  }
  throw new Error(`seed ${seed}: ${maxSteps}걸음 안에 끝나지 않음 (나이 ${ageOf(game.state)})`);
}

describe('콘텐츠', () => {
  it('검증 오류가 없다', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('출생 배경이 3개 이상 열려 있다', () => {
    expect(content.origins.filter((o) => o.unlocked !== false).length).toBeGreaterThanOrEqual(3);
  });
});

describe('판정', () => {
  it('확률은 5~95로 제한되고 정신이 반영된다', () => {
    const state = createState(1);
    expect(checkChance(state, { ability: '전투', difficulty: 0 })).toBe(50);
    state.sp = 45;
    expect(checkChance(state, { ability: '전투', difficulty: 0 })).toBe(73);
    state.sp = -45;
    expect(checkChance(state, { ability: '전투', difficulty: 5 })).toBe(5);
  });
});

describe('인생 시뮬레이션', () => {
  it('무작위 인생 300회가 모두 결산까지 도달한다', () => {
    const reasons: Record<string, number> = {};
    const ages: number[] = [];
    const visited = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { game, scene, visited: v } = playRandomLife(seed);
      expect(scene.text.length).toBeGreaterThan(50);
      const reason = game.state.ended?.reason ?? '?';
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      ages.push(ageOf(game.state));
      v.forEach((id) => visited.add(id));
    }
    const unvisited = [...content.events.keys()].filter((id) => !visited.has(id));
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    console.log('종료 사유:', reasons);
    console.log(`평균 사망 나이 ${avg.toFixed(1)}세, 최소 ${Math.min(...ages)}, 최대 ${Math.max(...ages)}`);
    console.log('한 번도 안 나온 이벤트:', unvisited);
  });

  it('신중한 플레이어 200회 통계', () => {
    const reasons: Record<string, number> = {};
    const ages: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const game = playCautiousLife(seed);
      const reason = game.state.ended?.reason ?? '?';
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      ages.push(ageOf(game.state));
    }
    ages.sort((a, b) => a - b);
    console.log('[신중] 종료 사유:', reasons);
    console.log(`[신중] 나이 중앙값 ${ages[100]}, 평균 ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}`);
    expect(reasons['금기'] ?? 0).toBe(0);
  });

  it('같은 시드는 같은 인생을 만든다(재현성)', () => {
    const a = playRandomLife(42);
    const b = playRandomLife(42);
    expect(a.scene.text).toBe(b.scene.text);
  });

  it('세이브한 상태로 이어하기가 된다', () => {
    const game = new Game(content, createState(7));
    game.choose(0);
    game.proceed();
    const saved = JSON.parse(JSON.stringify(game.state));
    const resumed = new Game(content, saved);
    expect(resumed.scene.type).toBe(game.scene.type);
    expect('text' in resumed.scene && resumed.scene.text).toBe('text' in game.scene && game.scene.text);
  });
});
