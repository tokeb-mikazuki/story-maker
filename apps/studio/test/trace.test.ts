import { describe, expect, it } from 'vitest';
import { MemoryMetaStore, Runner } from '../../../packages/engine/src/runner';
import type { TraceEntry } from '../../../packages/engine/src/world';
import { saltIsle } from '../src/samples/saltIsle';

/** 정해진 규칙으로 끝까지 플레이하고 최종 상태를 돌려준다 */
function playthrough(seed: number, trace?: (e: TraceEntry) => void) {
  const r = new Runner(saltIsle, { seed, meta: new MemoryMetaStore(), name: '바다', trace });
  for (let step = 0; step < 2000 && r.scene.type !== 'end'; step++) {
    const sc = r.scene;
    if (sc.type === 'result') r.proceed();
    else if (sc.type === 'name') r.setName('바다');
    else if (sc.type === 'origin') r.choose(step % sc.origins.length);
    else if (sc.type === 'event' || sc.type === 'menu') {
      const ok = sc.choices.filter((c) => c.enabled);
      r.choose(ok[step % ok.length].index);
    }
  }
  return r.state;
}

describe('테스트 플레이 로그', () => {
  it.each([1, 42, 2026])('로그를 켜도 결과가 같다 (시드 %i)', (seed) => {
    const log: TraceEntry[] = [];
    const a = playthrough(seed);
    const b = playthrough(seed, (e) => log.push(e));
    expect(b).toEqual(a);
    expect(log.length).toBeGreaterThan(50);
    const kinds = new Set(log.map((e) => e.kind));
    for (const k of ['scene', 'choice', 'pick', 'var', 'turn', 'end']) expect(kinds).toContain(k);
  });

  it('확률 추첨은 후보별 확률을 남긴다', () => {
    const log: TraceEntry[] = [];
    playthrough(7, (e) => log.push(e));
    const pick = log.find((e) => e.kind === 'pick' && e.text.startsWith('무작위 장면'));
    expect(pick?.detail).toMatch(/%.*굴림/);
  });
});
