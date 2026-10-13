// 창작마당(작품 공개·별점·플레이 수)과 게시판. auth.ts처럼 프런트엔드 전용 모의 구현이다.
// 작품 사본은 IndexedDB, 통계·게시글은 localStorage에 둔다. 서버가 생기면 아래 api 객체들의 본문만 바꾸면 된다.

import type { StoryPackage } from '@engine';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { SAMPLES, isFanWork } from '../samples';
import { DEVELOPER } from './auth';
import { type Rankable } from './ranking';
import { publishedStore } from './storage';

// ───────────────────────── 변경 알림 ─────────────────────────

let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('community:') || e.key?.startsWith('board:')) emit();
  });

/** 창작마당·게시판 데이터가 바뀔 때마다 올라가는 번호. 화면이 다시 불러올 때 쓴다 */
export function useCommunityVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 — 통계 하나 못 남겨도 화면은 계속
  }
  emit();
}

// ───────────────────────── 작품 ─────────────────────────

export interface Review {
  userId: string;
  score: number;
  text: string;
  at: number;
}

interface WorkStats {
  plays: number;
  reviews: Review[];
}

/** 목록에 쓰는 작품 정보 */
export interface WorkSummary extends Rankable {
  ownerId: string;
  updatedAt: number;
  official?: boolean;
  events: number;
  endings: number;
  cover?: string;
}

interface PublishedRecord {
  id: string;
  ownerId: string;
  genre: string;
  tags: string[];
  publishedAt: number;
  updatedAt: number;
  pkg: StoryPackage;
}

const STATS_KEY = 'community:stats';
const allStats = () => read<Record<string, WorkStats>>(STATS_KEY, {});
const statsOf = (id: string): WorkStats => allStats()[id] ?? { plays: 0, reviews: [] };

/** 개발팀 샘플은 서버 없이도 창작마당에 늘 올라와 있다 */
const SAMPLE_INFO: Record<string, { genre: string; at: number }> = {
  'sample:salt-isle': { genre: '드라마', at: Date.UTC(2026, 9, 1) },
  'sample:last-light': { genre: '미스터리', at: Date.UTC(2026, 9, 3) },
  'sample:ash-pawn': { genre: '판타지', at: Date.UTC(2026, 9, 6) },
};
const officialSamples = () => SAMPLES.filter((s) => !isFanWork(s.meta.id));
const sampleRecord = (pkg: StoryPackage, i: number): PublishedRecord => {
  const info = SAMPLE_INFO[pkg.meta.id];
  const at = info?.at ?? Date.UTC(2026, 9, 1 + i);
  return { id: pkg.meta.id, ownerId: DEVELOPER.id, genre: info?.genre ?? '기타', tags: (pkg.meta.tags ?? []).filter((t) => t !== '샘플'), publishedAt: at, updatedAt: at, pkg };
};

function summarize(r: PublishedRecord): WorkSummary {
  const st = statsOf(r.id);
  const sum = st.reviews.reduce((n, x) => n + x.score, 0);
  return {
    id: r.id,
    ownerId: r.ownerId,
    title: r.pkg.meta.title,
    description: r.pkg.meta.description ?? '',
    genre: r.genre,
    tags: r.tags,
    mode: r.pkg.settings.mode,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    official: r.ownerId === DEVELOPER.id,
    events: r.pkg.events.length,
    endings: r.pkg.endings.length,
    cover: r.pkg.meta.cover ? r.pkg.assets?.find((a) => a.id === r.pkg.meta.cover)?.src : undefined,
    plays: st.plays,
    avg: st.reviews.length ? sum / st.reviews.length : 0,
    ratingCount: st.reviews.length,
  };
}

async function allRecords(): Promise<PublishedRecord[]> {
  const user = await publishedStore.list<PublishedRecord>().catch(() => []);
  return [...officialSamples().map(sampleRecord), ...user];
}

export const worksApi = {
  async list(): Promise<WorkSummary[]> {
    return (await allRecords()).map(summarize);
  },

  async get(id: string): Promise<(WorkSummary & { pkg: StoryPackage }) | undefined> {
    const i = officialSamples().findIndex((s) => s.meta.id === id);
    const rec = i >= 0 ? sampleRecord(officialSamples()[i], i) : await publishedStore.get<PublishedRecord>(id);
    return rec ? { ...summarize(rec), pkg: rec.pkg } : undefined;
  },

  /** 올린 상태 확인(편집기에서). 개발팀 샘플은 제외 */
  async published(id: string): Promise<{ ownerId: string; genre: string; tags: string[]; publishedAt: number; updatedAt: number } | undefined> {
    const r = await publishedStore.get<PublishedRecord>(id);
    return r && { ownerId: r.ownerId, genre: r.genre, tags: r.tags, publishedAt: r.publishedAt, updatedAt: r.updatedAt };
  },

  /** 올리기 또는 새 버전으로 바꾸기. 통계와 처음 올린 날은 유지한다 */
  async publish(pkg: StoryPackage, ownerId: string, info: { genre: string; tags: string[] }): Promise<void> {
    if (SAMPLE_INFO[pkg.meta.id] || SAMPLES.some((s) => s.meta.id === pkg.meta.id)) throw new Error('샘플 작품은 그대로 올릴 수 없어요. 사본을 만들어 고친 뒤 올려 주세요.');
    const prev = await publishedStore.get<PublishedRecord>(pkg.meta.id);
    if (prev && prev.ownerId !== ownerId) throw new Error('다른 사람이 올린 작품과 주소가 겹칩니다. 사본을 만들어 올려 주세요.');
    const now = Date.now();
    const rec: PublishedRecord = {
      id: pkg.meta.id,
      ownerId,
      genre: info.genre,
      tags: info.tags.slice(0, 8),
      publishedAt: prev?.publishedAt ?? now,
      updatedAt: now,
      pkg: JSON.parse(JSON.stringify(pkg)),
    };
    await publishedStore.put(rec);
    emit();
  },

  async unpublish(id: string, ownerId: string): Promise<void> {
    const prev = await publishedStore.get<PublishedRecord>(id);
    if (!prev || prev.ownerId !== ownerId) return;
    await publishedStore.remove(id);
    const st = allStats();
    delete st[id];
    write(STATS_KEY, st);
  },

  /** 계정을 지울 때 그 계정이 올린 작품도 내린다 */
  async removeByOwner(ownerId: string): Promise<void> {
    for (const r of await publishedStore.list<PublishedRecord>()) if (r.ownerId === ownerId) await worksApi.unpublish(r.id, ownerId);
    // 다른 작품에 남긴 리뷰도 지운다
    const st = allStats();
    for (const id of Object.keys(st)) st[id].reviews = st[id].reviews.filter((r) => r.userId !== ownerId);
    write(STATS_KEY, st);
  },

  recordPlay(id: string): void {
    const st = allStats();
    st[id] = { ...(st[id] ?? { reviews: [] }), plays: (st[id]?.plays ?? 0) + 1 };
    write(STATS_KEY, st);
  },

  reviews(id: string): Review[] {
    return [...statsOf(id).reviews].sort((a, b) => b.at - a.at);
  },

  rate(id: string, userId: string, score: number, text: string): void {
    const st = allStats();
    const cur = st[id] ?? { plays: 0, reviews: [] };
    const s = Math.min(5, Math.max(1, Math.round(score)));
    cur.reviews = [...cur.reviews.filter((r) => r.userId !== userId), { userId, score: s, text: text.trim().slice(0, 300), at: Date.now() }];
    st[id] = cur;
    write(STATS_KEY, st);
  },

  unrate(id: string, userId: string): void {
    const st = allStats();
    if (!st[id]) return;
    st[id].reviews = st[id].reviews.filter((r) => r.userId !== userId);
    write(STATS_KEY, st);
  },
};

/** 작품 목록을 불러오고, 바뀌면 다시 불러온다 */
export function useWorks(): WorkSummary[] | undefined {
  const v = useCommunityVersion();
  const [list, setList] = useState<WorkSummary[]>();
  useEffect(() => {
    let live = true;
    void worksApi.list().then((xs) => live && setList(xs));
    return () => {
      live = false;
    };
  }, [v]);
  return list;
}

// ───────────────────────── 게시판 ─────────────────────────

export const BOARD_CATEGORIES = ['공지', '자유', '질문', '창작 팁', '작품 홍보'] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];
/** 공지는 개발팀만 쓴다 */
export const WRITABLE_CATEGORIES = BOARD_CATEGORIES.filter((c) => c !== '공지');

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  at: number;
}

export interface Post {
  id: string;
  category: BoardCategory;
  authorId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  views: number;
  likes: string[];
  comments: Comment[];
}

const POSTS_KEY = 'board:posts';

/** 처음 열었을 때 있는 공지 */
const NOTICES: Post[] = [
  {
    id: 'notice-welcome',
    category: '공지',
    authorId: DEVELOPER.id,
    title: '이야기 공방 게시판을 열었습니다',
    body: '만들면서 막힌 점, 서로의 작품 이야기, 창작 요령을 나누는 곳입니다.\n\n· 질문: 편집기 사용법이나 규칙 설계가 막힐 때\n· 창작 팁: 직접 찾은 요령이나 구조 설계 노하우\n· 작품 홍보: 창작마당에 올린 작품 소개\n\n지금은 개발 버전이라 글과 댓글이 이 브라우저에만 저장됩니다. 서버가 연결되면 모두가 함께 보는 게시판이 됩니다.',
    createdAt: Date.UTC(2026, 9, 12, 3),
    updatedAt: Date.UTC(2026, 9, 12, 3),
    views: 0,
    likes: [],
    comments: [],
  },
];

function posts(): Post[] {
  const stored = read<Post[] | null>(POSTS_KEY, null);
  return stored ?? NOTICES;
}
const savePosts = (xs: Post[]) => write(POSTS_KEY, xs);
const newPostId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const boardApi = {
  list(): Post[] {
    return posts();
  },
  get(id: string): Post | undefined {
    return posts().find((p) => p.id === id);
  },
  create(authorId: string, input: { category: BoardCategory; title: string; body: string }): Post {
    const now = Date.now();
    const post: Post = { id: newPostId(), authorId, category: input.category, title: input.title.trim().slice(0, 80), body: input.body.trim().slice(0, 5000), createdAt: now, updatedAt: now, views: 0, likes: [], comments: [] };
    savePosts([post, ...posts()]);
    return post;
  },
  update(id: string, authorId: string, input: { category: BoardCategory; title: string; body: string }): void {
    savePosts(posts().map((p) => (p.id === id && p.authorId === authorId ? { ...p, category: input.category, title: input.title.trim().slice(0, 80), body: input.body.trim().slice(0, 5000), updatedAt: Date.now() } : p)));
  },
  remove(id: string, authorId: string): void {
    savePosts(posts().filter((p) => !(p.id === id && p.authorId === authorId)));
  },
  /** 한 탭에서 같은 글을 여러 번 열어도 조회수는 한 번만 */
  view(id: string): void {
    const key = `board:viewed:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // 세션 저장소를 못 쓰면 매번 센다
    }
    savePosts(posts().map((p) => (p.id === id ? { ...p, views: p.views + 1 } : p)));
  },
  toggleLike(id: string, userId: string): void {
    savePosts(posts().map((p) => (p.id === id ? { ...p, likes: p.likes.includes(userId) ? p.likes.filter((x) => x !== userId) : [...p.likes, userId] } : p)));
  },
  comment(id: string, authorId: string, body: string): void {
    const c: Comment = { id: newPostId(), authorId, body: body.trim().slice(0, 1000), at: Date.now() };
    savePosts(posts().map((p) => (p.id === id ? { ...p, comments: [...p.comments, c] } : p)));
  },
  removeComment(id: string, commentId: string, authorId: string): void {
    savePosts(posts().map((p) => (p.id === id ? { ...p, comments: p.comments.filter((c) => !(c.id === commentId && c.authorId === authorId)) } : p)));
  },
  /** 계정을 지울 때 쓴 글·댓글·좋아요를 지운다 */
  removeByAuthor(authorId: string): void {
    savePosts(
      posts()
        .filter((p) => p.authorId !== authorId)
        .map((p) => ({ ...p, likes: p.likes.filter((x) => x !== authorId), comments: p.comments.filter((c) => c.authorId !== authorId) })),
    );
  },
};
