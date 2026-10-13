import { describe, expect, it } from 'vitest';
import { type Rankable, filterWorks, popularity, sortWorks, weightedRating } from '../src/lib/ranking';

const w = (id: string, o: Partial<Rankable> = {}): Rankable => ({
  id,
  title: id,
  description: '',
  genre: '기타',
  tags: [],
  mode: 'story',
  publishedAt: 0,
  plays: 0,
  avg: 0,
  ratingCount: 0,
  ...o,
});

describe('창작마당 정렬', () => {
  it('인기순은 플레이 수와 별점 합계를 더한다', () => {
    const a = w('a', { plays: 10 });
    const b = w('b', { plays: 4, avg: 4, ratingCount: 2 }); // 4 + 8 = 12
    expect(popularity(b)).toBe(12);
    expect(sortWorks([a, b], 'popular').map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('별점순은 리뷰 한 개짜리 만점이 많은 리뷰의 높은 점수를 이기지 못한다', () => {
    const one = w('one', { avg: 5, ratingCount: 1 });
    const many = w('many', { avg: 4.6, ratingCount: 30 });
    const none = w('none', { publishedAt: 99 });
    expect(weightedRating(none)).toBe(0);
    expect(sortWorks([one, none, many], 'rating').map((x) => x.id)).toEqual(['many', 'one', 'none']);
  });

  it('최신순·플레이순, 동점이면 최신 작품이 먼저', () => {
    const old = w('old', { publishedAt: 1, plays: 5 });
    const fresh = w('fresh', { publishedAt: 2, plays: 5 });
    expect(sortWorks([old, fresh], 'latest').map((x) => x.id)).toEqual(['fresh', 'old']);
    expect(sortWorks([old, fresh], 'plays').map((x) => x.id)).toEqual(['fresh', 'old']);
  });

  it('장르·형식·검색어로 거른다', () => {
    const list = [w('a', { genre: '판타지', tags: ['용'] }), w('b', { genre: '미스터리', mode: 'life', title: '등대' })];
    expect(filterWorks(list, { genre: '판타지' }).map((x) => x.id)).toEqual(['a']);
    expect(filterWorks(list, { mode: 'life' }).map((x) => x.id)).toEqual(['b']);
    expect(filterWorks(list, { q: '용' }).map((x) => x.id)).toEqual(['a']);
    expect(filterWorks(list, { q: '등대' }).map((x) => x.id)).toEqual(['b']);
  });
});
