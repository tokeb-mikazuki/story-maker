import { describe, expect, it } from 'vitest';
import { Runner } from '../../../packages/engine/src/runner';
import { validatePackage } from '../../../packages/engine/src/validate';
import { chain } from '../src/samples/chain';

describe('체인 (읽는 이야기)', () => {
  it('검증 오류와 경고가 없다', () => {
    expect(validatePackage(chain)).toEqual([]);
  });

  it('선택지는 「다음」 하나뿐이고, 모든 쪽을 차례대로 지나 엔딩에 닿는다', () => {
    const r = new Runner(chain, { seed: 1 });
    const seen: string[] = [];
    let guard = 0;
    while (r.scene.type !== 'end' && guard++ < 1000) {
      if (r.scene.type === 'event') {
        seen.push(r.scene.id);
        expect(r.scene.choices.map((c) => c.text)).toEqual(['다음']);
      }
      r.choose(0);
    }
    expect(r.scene.type).toBe('end');
    expect(seen).toEqual(chain.events.map((e) => e.id));
    expect(seen.length).toBeGreaterThan(100);
  });

  it('쪽마다 글이 너무 길지 않다', () => {
    for (const e of chain.events) expect(e.text.length, e.id).toBeLessThan(700);
  });
});
