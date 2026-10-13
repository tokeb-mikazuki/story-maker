import { describe, expect, it } from 'vitest';
import { Runner } from '../src/runner';
import { IMAGE_CLOSE, IMAGE_OPEN, renderTemplate, templateImages } from '../src/text';
import type { StoryPackage } from '../src/types';
import { validatePackage } from '../src/validate';

const ctx = { getVar: () => 0, call: () => undefined, sys: () => 0 } as never;

describe('글 속 이미지 {image 이미지ID}', () => {
  it('본문에서는 이미지 자리가 표시로 나가고, 그 밖에서는 무시된다', () => {
    const src = '앞 글.{image shop}뒤 글.';
    const body = renderTemplate(src, ctx, () => 0, { images: true });
    expect(body).toBe(`앞 글.\n${IMAGE_OPEN}shop${IMAGE_CLOSE}\n뒤 글.`);
    expect(renderTemplate(src, ctx, () => 0)).toBe('앞 글.뒤 글.');
    expect(templateImages('{if 1}{image a}{else}{이미지 b}{/if}')).toEqual(['a', 'b']);
  });

  function pkg(over: Partial<StoryPackage['events'][number]> = {}, assets = [{ id: 'shop', kind: 'image' as const, src: 'data:,' }]): StoryPackage {
    return {
      format: 'ifb/1',
      meta: { id: 'test.img', title: '이미지' },
      settings: { mode: 'story', calendar: { unit: 'none' }, stages: [{ id: 's', name: 's', turn: { length: 1 }, phases: [] }], start: 'a' },
      variables: [],
      events: [{ id: 'a', text: '처음.{image shop}끝.', choices: [], ...over }],
      endings: [],
      assets,
    } as unknown as StoryPackage;
  }

  it('장면 본문에 이미지 표시가 실려 나온다', () => {
    const r = new Runner(pkg(), { seed: 1 });
    expect(r.scene.type === 'event' && r.scene.text).toContain(`${IMAGE_OPEN}shop${IMAGE_CLOSE}`);
  });

  it('검사: 제목·선택지에는 못 넣고, 없는 이미지는 오류', () => {
    const errors = (p: StoryPackage) => validatePackage(p).filter((i) => i.level === 'error').map((i) => i.message);
    expect(errors(pkg())).toEqual([]);
    expect(errors(pkg({ title: '{image shop}' })).join()).toContain('본문 글에서만');
    expect(errors(pkg({ choices: [{ text: '{image shop}', outcome: {} }] })).join()).toContain('본문 글에서만');
    expect(errors(pkg({}, [])).join()).toContain("없는 이미지 'shop'");
  });
});
