import { describe, expect, it } from 'vitest';
import { Runner } from '../../../packages/engine/src/runner';
import { validatePackage } from '../../../packages/engine/src/validate';
import { chain } from '../src/samples/chain';

describe('껍질 세계 (읽는 이야기)', () => {
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
    expect(seen.length).toBeGreaterThan(60);
  });

  it('쪽마다 글이 너무 길지 않다', () => {
    for (const e of chain.events) expect(e.text.length, e.id).toBeLessThan(2400);
  });
});

describe('껍질 세계 — 서술 규칙', () => {
  const all = chain.events.map((e) => e.text).join('\n');
  it('쪽 제목이 없다', () => {
    for (const e of chain.events) expect(e.title, e.id).toBeUndefined();
  });
  it('독자에게 말을 걸거나 장을 해설하는 문장이 없다', () => {
    for (const bad of ['부는 그렇게 끝난다', '이 글을 읽', '당신이 따라온', '후일 밝혀', '훗날', '알지 못했다. 그것이']) expect(all.includes(bad), bad).toBe(false);
  });
  it('이안의 1인칭이다', () => {
    expect(all.match(/나는/g)!.length).toBeGreaterThan(120);
    expect(all.includes('이안은')).toBe(false);
  });
});

describe('껍질 세계 — 설정', () => {
  const all = chain.events.map((e) => e.text).join('\n');
  it('작품 제목', () => expect(chain.meta.title).toBe('껍질 세계'));
  it('1부의 이안은 쾌활하고 파워체인이라는 이름을 마음에 들어 한다', () => {
    expect(all).toContain('유치할수록 멋있는 거예요');
    expect(all).toContain('파워체인');
  });
  it('대체역사와 이안의 정체가 이야기 안에서 밝혀진다', () => {
    for (const k of ['괴벨스', '사상 병기', '수십억', '닻줄', '그림자', '반지하', '자기인식']) expect(all, k).toContain(k);
  });
});
