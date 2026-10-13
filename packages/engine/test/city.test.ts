// 수용 테스트: 손으로 짠 '도시' 프로토타입(src/)을 툴 패키지로 옮겼을 때
// 같은 게임이 되는지 확인한다. (도시 콘텐츠는 내부 검증용 — fixtures/city/city.ts 참고)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCityPackage } from '../../../fixtures/city/city';
import { Runner } from '../src/runner';
import { simulate } from '../src/simulate';
import { validatePackage } from '../src/validate';
import { Game } from '../../../src/engine/game';
import { parseContent } from '../../../src/engine/content';
import { createState } from '../../../src/engine/state';

const CONTENT_DIR = join(__dirname, '../../../src/content');

function readContent(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.yaml')) files[p.replace(/\\/g, '/')] = readFileSync(p, 'utf8');
    }
  };
  walk(CONTENT_DIR);
  return files;
}

const RUNS = 400;

/** 옛 엔진을 무작위로 플레이한 통계 */
function simulateLegacy(files: Record<string, string>) {
  const content = parseContent(files);
  const endings: Record<string, number> = {};
  const reach: Record<string, number> = {};
  const ages: number[] = [];
  for (let seed = 1; seed <= RUNS; seed++) {
    const state = createState(seed);
    const game = new Game(content, state);
    // simulate()와 같은 선택 정책
    let policy = (seed * 2654435761) >>> 0;
    const pick = (n: number) => {
      policy = (Math.imul(policy ^ (policy >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
      return policy % n;
    };
    for (let step = 0; step < 20000 && game.scene.type !== 'end'; step++) {
      const s = game.scene;
      if (s.type === 'result') game.proceed();
      else if (s.type === 'origin') game.choose(pick(s.origins.length));
      else if (s.type === 'event' || s.type === 'actions') {
        const enabled = s.choices.filter((c) => c.enabled);
        game.choose(enabled[pick(enabled.length)].index);
      }
    }
    const reason = state.ended?.reason ?? '미완';
    endings[reason] = (endings[reason] ?? 0) + 1;
    for (const id of Object.keys(state.seen)) reach[id] = (reach[id] ?? 0) + 1;
    ages.push(Math.floor((state.now - state.birth) / 12));
  }
  return { endings, reach, avgAge: ages.reduce((a, b) => a + b, 0) / ages.length };
}

describe('도시 프로토타입 재현', () => {
  const files = readContent();
  const pkg = buildCityPackage(files);

  it('패키지 검증에 오류가 없다', () => {
    const issues = validatePackage(pkg);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('한 판을 끝까지 진행하고 결산이 조립된다', () => {
    const r = new Runner(pkg, { seed: 42 });
    expect(r.scene.type).toBe('origin');
    let steps = 0;
    while (r.scene.type !== 'end' && steps++ < 20000) {
      const s = r.scene;
      if (s.type === 'result') r.proceed();
      else if (s.type === 'origin') r.choose(0);
      else if (s.type === 'event' || s.type === 'menu') r.choose(s.choices.find((c) => c.enabled)!.index);
    }
    expect(r.scene.type).toBe('end');
    if (r.scene.type === 'end') {
      expect(r.scene.text).toMatch(/^\d+년 \d+월, 당신의 이야기는 \d+세에 끝났습니다\./);
      expect(r.scene.text).toMatch(/(하나 협회의 기록에 '.+'(으로|로) 남았습니다|도시의 별 하나가 졌습니다)\.$/);
      expect(r.scene.life.length).toBeGreaterThan(0);
    }
  });

  it(`무작위 ${RUNS}판: 오류·막힘이 없고 옛 엔진과 같은 분포를 보인다`, () => {
    const report = simulate(pkg, { runs: RUNS });
    const legacy = simulateLegacy(files);

    expect(report.errors).toEqual([]);
    expect(report.stuck).toBe(0);

    // 난수 소비 순서까지 같아서, 같은 시드·같은 선택이면 결과가 판 단위로 일치한다
    expect(report.endings).toEqual(legacy.endings);
    for (const e of pkg.events) expect(report.eventReach[e.id] ?? 0, e.id).toBe(legacy.reach[e.id] ?? 0);
    expect(report.ages!.avg).toBeCloseTo(legacy.avgAge, 1);

    console.log('엔딩(옛):', legacy.endings);
    console.log('엔딩(새):', report.endings);
    console.log('평균 사망 나이 옛/새:', legacy.avgAge.toFixed(1), report.ages!.avg);
    console.log('한 번도 안 나온 이벤트:', report.unreachedEvents);
  }, 120_000);
});
