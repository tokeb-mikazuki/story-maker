import { describe, expect, it } from 'vitest';
import { simulate } from '../../../packages/engine/src/simulate';
import { validatePackage } from '../../../packages/engine/src/validate';
import { buildCity984 } from '../src/samples/city984';

const city984 = buildCity984();
import { ashPawn } from '../src/samples/ashPawn';
import { lighthouse } from '../src/samples/lighthouse';
import { saltIsle } from '../src/samples/saltIsle';
import { blankTemplate, lifeTemplate, storyTemplate } from '../src/lib/templates';

describe.each([
  ['소금섬의 일생', saltIsle],
  ['등대의 마지막 밤', lighthouse],
  ['재의 도시, 반달 전당포', ashPawn],
  ['날개 아래, 984', city984],
  ['인생형 템플릿', lifeTemplate()],
  ['이야기형 템플릿', storyTemplate()],
  ['빈 프로젝트', blankTemplate()],
])('%s', (_name, pkg) => {
  it('검증 오류가 없다', () => {
    expect(validatePackage(pkg).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('무작위 플레이가 막힘·오류 없이 끝난다', () => {
    const report = simulate(pkg, { runs: 300 });
    expect(report.errors).toEqual([]);
    expect(report.stuck).toBe(0);
    for (const c of report.chokepoints) expect(c.rate, c.id).toBe(1);
  });
});

describe('샘플 콘텐츠가 고르게 쓰인다', () => {
  it('소금섬: 대부분의 엔딩과 이벤트가 나온다', () => {
    const r = simulate(saltIsle, { runs: 600, shareMeta: true });
    console.log('소금섬 엔딩', r.endings, '수명', r.ages, '안 나온 이벤트', r.unreachedEvents);
    expect(Object.keys(r.endings).length).toBeGreaterThanOrEqual(4);
    expect(r.unreachedEvents).toEqual([]);
    expect(r.ages!.avg).toBeGreaterThan(30);
  });

  it('날개 아래 984: 진로가 고르게 나오고 대부분의 장면이 쓰인다', () => {
    const r = simulate(city984, { runs: 800, shareMeta: true });
    console.log('984 엔딩', r.endings, '수명', r.ages, '안 나온 이벤트', r.unreachedEvents);
    expect(Object.keys(r.endings).length).toBeGreaterThanOrEqual(5);
    expect(r.unreachedEvents).toEqual([]);
    expect(r.ages!.avg).toBeGreaterThan(30);
  });

  it('등대: 모든 엔딩이 나온다', () => {
    const r = simulate(lighthouse, { runs: 600 });
    console.log('등대 엔딩', r.endings, '안 나온 이벤트', r.unreachedEvents);
    expect(Object.keys(r.endings).sort()).toEqual(lighthouse.endings.map((e) => e.id).sort());
  });
});
