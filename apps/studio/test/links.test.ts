import type { StoryPackage } from '@engine';
import { describe, expect, it } from 'vitest';
import { unreachedEvents } from '../src/lib/links';
import { SAMPLES } from '../src/samples';

const base = (): StoryPackage => structuredClone(SAMPLES.find((s) => s.meta.id === 'sample:lighthouse') ?? SAMPLES[1]);

describe('unreachedEvents: 도달 경로가 없는 이벤트', () => {
  it('샘플은 시작 이벤트부터 모두 이어져 있다', () => {
    expect(unreachedEvents(base())).toEqual([]);
  });

  it('주머니도 없고 어디서도 이어지지 않는 새 이벤트만 나온다', () => {
    const pkg = base();
    pkg.events.push({ id: 'event', text: '새 장면', choices: [] });
    expect(unreachedEvents(pkg).map((e) => e.id)).toEqual(['event']);
  });

  it('주머니에 넣거나, 선택지·규칙에서 이어지면 빠진다', () => {
    const pkg = base();
    pkg.events.push({ id: 'a', text: '', choices: [], pool: 'main' }, { id: 'b', text: '', choices: [] }, { id: 'c', text: '', choices: [] });
    pkg.events[0].choices.push({ text: 'b로', outcome: { goto: 'b' } });
    pkg.triggers = [{ id: 't', on: 'turnStart', do: [{ do: 'goto', event: 'c' }] }] as never;
    expect(unreachedEvents(pkg)).toEqual([]);
  });
});
