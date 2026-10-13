import { describe, expect, it } from 'vitest';
import { eventLabel, hasEventId } from '../src/lib/labels';

describe('eventLabel: ID → 제목 → 본문', () => {
  it('ID가 있으면 제목보다 먼저 (한글·기호·알파벳 모두)', () => {
    expect(eventLabel({ id: '첫사랑 #1', title: '벚꽃', text: '본문' })).toBe('첫사랑 #1');
    expect(eventLabel({ id: 'intro-A', title: '벚꽃', text: '본문' })).toBe('intro-A');
  });

  it('ID를 비운 자동 ID(event, event_2…)면 제목, 제목도 없으면 본문 첫머리', () => {
    expect(hasEventId({ id: 'event_3' })).toBe(false);
    expect(eventLabel({ id: 'event', title: '벚꽃', text: '본문' })).toBe('벚꽃');
    expect(eventLabel({ id: 'event_2', text: '아주 긴 본문이 이어집니다 아주 긴 본문이 이어집니다' })).toBe('아주 긴 본문이 이어집니다 아주 …');
    expect(eventLabel({ id: 'event_9' })).toBe('(빈 장면 · event_9)');
  });
});
