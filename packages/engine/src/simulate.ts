// 자동 시뮬레이터: 무작위로 수천 번 플레이해서 엔딩 분포, 이벤트 도달률,
// 초크포인트 통과율, 막힘·오류를 보고한다. 작가가 직접 검증하기 어려운 조건 그물을 점검하는 도구.

import { MemoryMetaStore, Runner } from './runner';
import type { StoryPackage } from './types';
import { PackageIndex } from './world';

export interface SimulationOptions {
  runs?: number;
  /** 첫 시드. 이후 1씩 증가 */
  seed?: number;
  /** 한 판의 최대 입력 수 */
  maxSteps?: number;
  /** true면 회차 간 메타(해금·도전과제)를 공유 */
  shareMeta?: boolean;
  /** 진행 콜백(0~1) */
  onProgress?: (ratio: number) => void;
}

export interface SimulationReport {
  runs: number;
  endings: Record<string, number>;
  /** 이벤트 ID → 등장한 판 수 */
  eventReach: Record<string, number>;
  unreachedEvents: string[];
  chokepoints: { id: string; rate: number }[];
  achievements: Record<string, number>;
  turns: { min: number; max: number; avg: number };
  ages?: { min: number; max: number; avg: number };
  /** 끝나지 않은 판 */
  stuck: number;
  errors: { seed: number; message: string; count: number }[];
}

export function simulate(pkg: StoryPackage, opts: SimulationOptions = {}): SimulationReport {
  const runs = opts.runs ?? 500;
  const firstSeed = opts.seed ?? 1;
  const maxSteps = opts.maxSteps ?? 20_000;
  const index = new PackageIndex(pkg);
  const sharedMeta = new MemoryMetaStore();

  const endings: Record<string, number> = {};
  const reach: Record<string, number> = Object.fromEntries(pkg.events.map((e) => [e.id, 0]));
  const achievements: Record<string, number> = {};
  const turns: number[] = [];
  const ages: number[] = [];
  const errors = new Map<string, { seed: number; message: string; count: number }>();
  let stuck = 0;

  for (let r = 0; r < runs; r++) {
    const seed = firstSeed + r;
    const meta = opts.shareMeta ? sharedMeta : new MemoryMetaStore();
    let runner: Runner | undefined;
    try {
      runner = new Runner(pkg, { seed, meta, index });
      // 선택 정책도 같은 시드로 재현 가능하게
      let policy = (seed * 2654435761) >>> 0;
      const pick = (n: number) => {
        policy = (Math.imul(policy ^ (policy >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
        return policy % n;
      };
      let steps = 0;
      while (runner.scene.type !== 'end' && steps++ < maxSteps) {
        const scene = runner.scene;
        if (scene.type === 'name') runner.setName('');
        else if (scene.type === 'result') runner.proceed();
        else if (scene.type === 'origin') runner.choose(pick(scene.origins.length));
        else {
          const enabled = scene.choices.filter((c) => c.enabled);
          if (!enabled.length) throw new Error(`고를 수 있는 선택지가 없습니다 (${scene.type === 'event' ? scene.id : '메뉴'})`);
          runner.choose(enabled[pick(enabled.length)].index);
        }
      }
      if (runner.scene.type !== 'end') stuck++;
      else {
        const id = runner.scene.ending.id;
        endings[id] = (endings[id] ?? 0) + 1;
      }
    } catch (e) {
      const message = (e as Error).message;
      const at = runner?.state.current?.type === 'event' ? ` @${runner.state.current.id}` : '';
      const key = message + at;
      const prev = errors.get(key);
      if (prev) prev.count++;
      else errors.set(key, { seed, message: message + at, count: 1 });
    }
    if (runner) {
      for (const id of Object.keys(runner.state.seen)) reach[id] = (reach[id] ?? 0) + 1;
      for (const a of runner.state.achieved) achievements[a] = (achievements[a] ?? 0) + 1;
      turns.push(runner.state.turn);
      if (pkg.settings.calendar.unit !== 'none') ages.push(runner.world.age());
    }
    opts.onProgress?.((r + 1) / runs);
  }

  const stats = (xs: number[]) =>
    xs.length
      ? { min: Math.min(...xs), max: Math.max(...xs), avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 }
      : { min: 0, max: 0, avg: 0 };

  return {
    runs,
    endings,
    eventReach: reach,
    unreachedEvents: Object.entries(reach)
      .filter(([, n]) => n === 0)
      .map(([id]) => id),
    chokepoints: pkg.events.filter((e) => e.chokepoint).map((e) => ({ id: e.id, rate: (reach[e.id] ?? 0) / runs })),
    achievements,
    turns: stats(turns),
    ages: ages.length ? stats(ages) : undefined,
    stuck,
    errors: [...errors.values()].sort((a, b) => b.count - a.count),
  };
}
