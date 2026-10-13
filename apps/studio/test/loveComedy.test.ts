import { type StoryPackage, nameStyle } from '@engine';
import { Runner } from '../../../packages/engine/src/runner';
import { describe, expect, it } from 'vitest';
import { simulate } from '../../../packages/engine/src/simulate';
import { validatePackage } from '../../../packages/engine/src/validate';
import { loveComedy } from '../src/samples/loveComedy';

/** 지정한 이벤트에서 시작하고, 변수 시작값을 바꾼 사본 */
function scenario(start: string, initials: Record<string, number>): StoryPackage {
  const pkg: StoryPackage = structuredClone(loveComedy);
  pkg.settings.start = start;
  for (const v of pkg.variables) if (v.id in initials) (v.initial = initials[v.id]), delete v.initialExpr;
  return pkg;
}

describe('청화고 연애 금지령', () => {
  it('검증 오류와 경고가 없다', () => {
    expect(validatePackage(loveComedy)).toEqual([]);
  });

  it('주인공 이름은 한국식 남자 이름 주머니에서, 등장인물 이름을 빼고 뽑는다', () => {
    const cast = loveComedy.settings.player!.excludeNames!;
    for (let seed = 1; seed < 40; seed++) {
      const r = new Runner(loveComedy, { seed });
      expect(r.scene.type).toBe('name');
      r.setName('');
      expect(nameStyle('korean')!.male).toContain(r.state.name);
      expect(cast).not.toContain(r.state.name);
    }
  });

  it('처음부터 끝까지 무작위로 해도 막히거나 오류가 나지 않고, 엔딩이 다양하다', { timeout: 60000 }, () => {
    const r = simulate(loveComedy, { runs: 600, shareMeta: true });
    expect(r.errors).toEqual([]);
    expect(r.stuck).toBe(0);
    expect(Object.keys(r.endings).length).toBeGreaterThanOrEqual(8);
    // 고정 장면 24개는 한 주에 하나씩 모두 거친다
    expect(r.unreachedEvents.filter((id) => !['chaos_start', 'remedial_end', 'scandal_start', 'remedial_call'].includes(id))).toEqual([]);
  });

  it('문화제 아침의 갈림길: 소문 · 성적 · 두 마음', { timeout: 60000 }, () => {
    const scandal = simulate(scenario('festival_gate', { 소문: 8 }), { runs: 200 });
    expect(Object.keys(scandal.endings)).toContain('scandal');
    const remedial = simulate(scenario('festival_gate', { 성적: 1, 소문: 0 }), { runs: 50 });
    expect(Object.keys(remedial.endings)).toEqual(['remedial']);
    const chaos = simulate(scenario('festival_gate', { 서윤호감: 9, 하린호감: 9, 허세: 4, 소문: 5 }), { runs: 200 });
    expect(Object.keys(chaos.endings)).toContain('chaos');
  });

  it('마음을 전하는 장면마다 자기 엔딩으로 이어진다', { timeout: 60000 }, () => {
    const cases: [string, string, string][] = [
      ['confess_seoyun', '서윤호감', 'seoyun_love'],
      ['confess_harin', '하린호감', 'harin_love'],
      ['confess_yuna', '유나호감', 'yuna_love'],
      ['confess_seohyeon', '서현호감', 'seohyeon_love'],
    ];
    for (const [start, v, ending] of cases) {
      const r = simulate(scenario(start, { [v]: 10, 진심: 8, 자신감: 8, 다정: 5, 소문: 0 }), { runs: 200 });
      expect(Object.keys(r.endings), start).toContain(ending);
    }
  });

  it('남자 친구들과 문화제를 마치는 길(사나이들의 우정)이 열린다', { timeout: 60000 }, () => {
    const r = simulate(scenario('festival', { 하준우정: 8, 태오신뢰: 8, 지훈우정: 2 }), { runs: 300 });
    expect(Object.keys(r.endings)).toContain('bros');
  });

  it('연설 · 정학 · 보건실로 이어지는 연결', { timeout: 60000 }, () => {
    const repeal = simulate(scenario('repeal_speech', { 진심: 10, 서윤호감: 10, 자신감: 8, 소문: 0, 벌점: 0 }), { runs: 200 });
    expect(Object.keys(repeal.endings)).toContain('repeal');
    const office = simulate(scenario('student_office', { 벌점: 3 }), { runs: 20 });
    expect(office.errors).toEqual([]);
    const grade = simulate(scenario('remedial_call', { 성적: 1 }), { runs: 20 });
    expect(grade.errors).toEqual([]);
  });
});
