// 창작마당: 공개된 작품 목록. 정렬(인기·별점·최신·플레이) · 장르 · 형식 · 검색.

import { type CSSProperties, useState } from 'react';
import { WorkCard } from '../components/Shelf';
import { PageHead, genreTone } from '../components/Site';
import { useWorks } from '../lib/community';
import { GENRES, SORTS, type SortKey, filterWorks, sortWorks } from '../lib/ranking';
import { href } from '../lib/router';
import { prefs } from '../lib/storage';

const PAGE = 24;

/** 다른 화면(홈의 장르 바로가기 등)에서 창작마당 조건을 미리 정해 두고 넘어올 때 */
export function presetGallery(p: { genre?: string; sort?: SortKey }): void {
  if (p.genre !== undefined) prefs.set('gallery:genre', p.genre || undefined);
  if (p.sort) prefs.set('gallery:sort', p.sort);
}

export function Gallery() {
  const all = useWorks();
  const [sort, setSortState] = useState<SortKey>(() => (prefs.get('gallery:sort') as SortKey) ?? 'popular');
  const [genre, setGenreState] = useState<string>(() => prefs.get('gallery:genre') ?? '');
  const [mode, setMode] = useState<'' | 'story' | 'life'>('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  const setSort = (k: SortKey) => (setSortState(k), prefs.set('gallery:sort', k), setShown(PAGE));
  const setGenre = (g: string) => (setGenreState(g), prefs.set('gallery:genre', g || undefined), setShown(PAGE));

  const base = filterWorks(all ?? [], { mode: mode || undefined, q });
  const list = sortWorks(filterWorks(base, { genre: genre || undefined }), sort);
  const countOf = (g: string) => base.filter((w) => w.genre === g).length;
  const sortInfo = SORTS.find((s) => s.key === sort)!;

  return (
    <div className="page">
      <PageHead
        kicker="창작마당"
        title="오늘은 어떤 이야기를 펼칠까요"
        actions={
          <a className="btn primary" href={href('studio')}>
            ✎ 내 작품 올리기
          </a>
        }
      >
        작가들이 공개한 인터랙티브 소설을 플레이하고, 별점과 한 줄 감상을 남겨 보세요.
      </PageHead>

      <div className="gallery-tools">
        <div className="search-box">
          <span aria-hidden>⌕</span>
          <input type="search" value={q} onChange={(e) => (setQ(e.target.value), setShown(PAGE))} placeholder="제목, 소개, 태그로 찾기" aria-label="작품 검색" />
        </div>
        <div className="seg" role="tablist" aria-label="정렬">
          {SORTS.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} className={sort === s.key ? 'on' : ''} onClick={() => setSort(s.key)} title={s.hint}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="형식">
          <option value="">모든 형식</option>
          <option value="story">이야기형</option>
          <option value="life">인생형</option>
        </select>
      </div>

      <div className="genre-bar" role="tablist" aria-label="장르">
        <button type="button" role="tab" aria-selected={!genre} className={`genre-chip ${!genre ? 'on' : ''}`} onClick={() => setGenre('')}>
          전체 <span>{base.length}</span>
        </button>
        {GENRES.map((g) => {
          const n = countOf(g);
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={genre === g}
              className={`genre-chip ${genre === g ? 'on' : ''} ${n ? '' : 'none'}`}
              style={{ '--tone': genreTone(g) } as CSSProperties}
              onClick={() => setGenre(genre === g ? '' : g)}
            >
              {g} <span>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="result-line">
        <span>
          {genre && <b>{genre} · </b>}
          작품 {list.length}편
        </span>
        <span className="muted small">{sortInfo.hint}</span>
      </div>

      {!all && <p className="empty">작품을 불러오는 중…</p>}
      {all && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-mark">❦</div>
          <p>{q || genre || mode ? '조건에 맞는 작품이 없어요.' : '아직 올라온 작품이 없어요.'}</p>
          {(q || genre || mode) && (
            <button className="btn" onClick={() => (setQ(''), setGenre(''), setMode(''))}>
              조건 지우기
            </button>
          )}
        </div>
      )}
      <div className="tile-grid">
        {list.slice(0, shown).map((w) => (
          <WorkCard key={w.id} w={w} />
        ))}
      </div>
      {list.length > shown && (
        <div className="more-row">
          <button className="btn" onClick={() => setShown(shown + PAGE)}>
            더 보기 ({list.length - shown})
          </button>
        </div>
      )}
    </div>
  );
}
