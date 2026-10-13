// 창작마당 정렬·거르기. 저장소와 떨어진 순수 함수라 테스트에서 바로 부른다.

export const GENRES = ['러브코미디', '판타지', '미스터리', '로맨스', 'SF', '호러', '드라마', '모험', '일상', '역사', '코미디', '기타'] as const;
export type Genre = (typeof GENRES)[number];

export type SortKey = 'popular' | 'rating' | 'latest' | 'plays';

export const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'popular', label: '인기순', hint: '플레이 수와 별점 합계를 더한 점수' },
  { key: 'rating', label: '별점순', hint: '평균 별점. 리뷰가 적은 작품은 보통 점수(3점) 쪽으로 보정합니다' },
  { key: 'latest', label: '최신순', hint: '최근에 올라온 작품부터' },
  { key: 'plays', label: '플레이순', hint: '플레이 수가 많은 작품부터' },
];

export interface Rankable {
  id: string;
  title: string;
  description: string;
  genre: string;
  tags: string[];
  mode: 'story' | 'life';
  publishedAt: number;
  plays: number;
  /** 평균 별점(리뷰 없으면 0) */
  avg: number;
  ratingCount: number;
}

/** 인기 점수: 플레이 1회 = 1점, 리뷰 하나는 준 별점만큼 */
export const popularity = (w: Rankable) => w.plays + w.avg * w.ratingCount;

const PRIOR_SCORE = 3;
const PRIOR_WEIGHT = 2;
/** 리뷰 한두 개짜리 만점 작품이 맨 위를 차지하지 않도록 보정한 별점 */
export const weightedRating = (w: Rankable) => (w.ratingCount ? (w.avg * w.ratingCount + PRIOR_SCORE * PRIOR_WEIGHT) / (w.ratingCount + PRIOR_WEIGHT) : 0);

export function sortWorks<T extends Rankable>(list: T[], key: SortKey): T[] {
  const score: Record<SortKey, (w: T) => number> = {
    popular: popularity,
    rating: weightedRating,
    latest: (w) => w.publishedAt,
    plays: (w) => w.plays,
  };
  const f = score[key];
  // 동점이면 최신 작품이 먼저
  return [...list].sort((a, b) => f(b) - f(a) || b.publishedAt - a.publishedAt || a.title.localeCompare(b.title, 'ko'));
}

export interface WorkFilter {
  genre?: string;
  mode?: 'story' | 'life';
  q?: string;
}

export function filterWorks<T extends Rankable>(list: T[], f: WorkFilter): T[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter(
    (w) =>
      (!f.genre || w.genre === f.genre) &&
      (!f.mode || w.mode === f.mode) &&
      (!q || w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q))),
  );
}
