import { describe, expect, it } from 'vitest';
import { MemoryMetaStore, Runner } from '../../../packages/engine/src/runner';
import { buildCity984 } from '../src/samples/city984';

const city = buildCity984();

/** 정해진 규칙으로 끝까지 플레이하고 끝 장면을 돌려준다 */
function play(seed: number) {
  const r = new Runner(city, { seed, meta: new MemoryMetaStore(), name: '하윤' });
  for (let step = 0; step < 3000 && r.scene.type !== 'end'; step++) {
    const sc = r.scene;
    if (sc.type === 'result') r.proceed();
    else if (sc.type === 'name') r.setName('하윤');
    else if (sc.type === 'origin') r.choose(seed % sc.origins.length);
    else if (sc.type === 'event' || sc.type === 'menu') {
      const ok = sc.choices.filter((c) => c.enabled);
      r.choose(ok[(step * 7 + seed) % ok.length].index);
    }
  }
  if (r.scene.type !== 'end') throw new Error('끝나지 않음');
  return r.scene;
}

describe('인생표 마지막 줄: 엔딩', () => {
  it('어떤 엔딩이든 마지막 줄에 엔딩 이름이 남고, 고른 선택지는 적히지 않는다', () => {
    const seen = new Map<string, string>();
    for (let seed = 1; seed <= 120; seed++) {
      const end = play(seed);
      const last = end.life[end.life.length - 1];
      expect(last.importance).toBe(5);
      expect(last.text).toContain(end.ending.title);
      if (end.ending.kind === 'death') expect(last.text.startsWith('사망: ')).toBe(true);
      seen.set(end.ending.id, last.text);
    }
    // 노환은 자동 규칙 이름만 덧붙고, 선택으로 끝난 엔딩에는 어떤 선택을 골랐는지 적히지 않는다
    expect(seen.get('natural')).toMatch(/^천수 \(노환\)$/);
    const byChoice = [...seen.values()].find((t) => /고른 뒤|「/.test(t));
    expect(byChoice, [...seen.values()].join('\n')).toBeUndefined();
  });

  it('설정으로 끌 수 있다', () => {
    const off = { ...city, settings: { ...city.settings, recordEnding: false } };
    const r = new Runner(off, { seed: 3, name: '하윤' });
    for (let i = 0; i < 3000 && r.scene.type !== 'end'; i++) {
      const sc = r.scene;
      if (sc.type === 'result') r.proceed();
      else if (sc.type === 'origin') r.choose(0);
      else if (sc.type === 'event' || sc.type === 'menu') r.choose(sc.choices.find((c) => c.enabled)!.index);
    }
    if (r.scene.type !== 'end') throw new Error('끝나지 않음');
    expect(r.scene.life.some((l) => l.text.includes(r.scene.type === 'end' ? r.scene.ending.title : '?') && l.text.includes('('))).toBe(false);
  });
});
