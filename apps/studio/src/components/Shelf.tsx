// 넷플릭스식 작품 진열: 가로 썸네일 카드, 옆으로 넘기는 줄, TOP 10 줄, 큰 빌보드.

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import type { WorkSummary } from '../lib/community';
import { href } from '../lib/router';
import { Artwork, BookCover, Thumb, genreTone } from './Cover';
import { AuthorLink } from './Site';

const WEEK = 7 * 86400000;
const modeName = (m: WorkSummary['mode']) => (m === 'life' ? '인생형' : '이야기형');

/** 가로 썸네일 카드. 마우스를 올리면 소개와 재생 버튼이 떠오른다 */
export function WorkCard({ w }: { w: WorkSummary }) {
  const link = href('works', w.id);
  const fresh = Date.now() - w.publishedAt < WEEK;
  return (
    <article className="tile" style={{ '--tone': genreTone(w.genre) } as CSSProperties}>
      <a href={link} className="tile-media" aria-label={`${w.title} 작품 보기`}>
        <Thumb w={w} />
        <span className="tile-shade" aria-hidden />
        <span className="tile-badges">
          {fresh && <span className="badge-new">NEW</span>}
          {w.official && <span className="badge-official">공식</span>}
        </span>
        <span className="tile-caption">
          <span className="tile-genre">
            {w.genre} · {modeName(w.mode)}
          </span>
          <b className="tile-title">{w.title}</b>
          <span className="tile-more">
            <span className="tile-play" aria-hidden>
              ▶
            </span>
            <span className="tile-desc">{w.description}</span>
          </span>
        </span>
      </a>
      <div className="tile-meta">
        <AuthorLink id={w.ownerId} size={18} />
        <span className="tile-stats">
          {w.ratingCount > 0 && <span className="tile-star">★ {w.avg.toFixed(1)}</span>}
          <span title="플레이 수">▶ {w.plays.toLocaleString('ko-KR')}</span>
        </span>
      </div>
    </article>
  );
}

/** 옆으로 넘기는 줄. 화살표는 넘길 곳이 있을 때만 보인다 */
export function Row({ title, more, children, variant }: { title: ReactNode; more?: ReactNode; children: ReactNode; variant?: 'top' }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const t = track.current;
    if (!t) return;
    setEdge({ left: t.scrollLeft > 4, right: t.scrollLeft + t.clientWidth < t.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  const page = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: 'smooth' });
  return (
    <section className={`shelf-row ${variant ? `shelf-${variant}` : ''}`}>
      <div className="row-head">
        <h2>{title}</h2>
        {more}
      </div>
      <div className="row-viewport">
        {edge.left && (
          <button type="button" className="row-arrow left" onClick={() => page(-1)} aria-label="앞으로">
            ‹
          </button>
        )}
        <div className="row-track" ref={track} onScroll={measure}>
          {children}
        </div>
        {edge.right && (
          <button type="button" className="row-arrow right" onClick={() => page(1)} aria-label="뒤로">
            ›
          </button>
        )}
      </div>
    </section>
  );
}

/** TOP 10: 큰 순위 숫자 + 세로 포스터 */
export function TopItem({ w, rank }: { w: WorkSummary; rank: number }) {
  return (
    <a className="top-item" href={href('works', w.id)} aria-label={`${rank}위 ${w.title}`} title={w.title}>
      <span className="top-rank" aria-hidden>
        {rank}
      </span>
      <BookCover w={w} className="top-poster" />
    </a>
  );
}

/** 화면 위쪽 큰 배너. 배경에 작품 그림을 깔고 왼쪽에 소개를 얹는다 */
export function Billboard({ w, kicker, actions, heading = 'h2', showDesc = true }: { w: WorkSummary; kicker?: ReactNode; actions?: ReactNode; heading?: 'h1' | 'h2'; showDesc?: boolean }) {
  const H = heading;
  return (
    <section className="billboard" style={{ '--tone': genreTone(w.genre) } as CSSProperties}>
      <div className="billboard-art" aria-hidden>
        <Artwork w={w} shape="wide" />
      </div>
      <div className="billboard-shade" aria-hidden />
      <div className="billboard-in">
        <div className="billboard-copy">
          {kicker && <div className="billboard-kicker">{kicker}</div>}
          <H className="billboard-title">{w.title}</H>
          <div className="billboard-meta">
            {w.ratingCount > 0 ? <span className="bb-score">★ {w.avg.toFixed(1)}</span> : <span className="bb-score muted-score">새 작품</span>}
            <span className="bb-tag">{w.genre}</span>
            <span>{modeName(w.mode)}</span>
            <span>▶ {w.plays.toLocaleString('ko-KR')}회</span>
            <span>엔딩 {w.endings}</span>
          </div>
          {showDesc && w.description && <p className="billboard-desc">{w.description}</p>}
          <div className="billboard-cta">
            {actions ?? (
              <>
                <a className="nf-btn play" href={href('play', w.id, 'w')}>
                  ▶ 플레이
                </a>
                <a className="nf-btn info" href={href('works', w.id)}>
                  ⓘ 상세 정보
                </a>
              </>
            )}
          </div>
          <div className="billboard-author">
            <AuthorLink id={w.ownerId} size={24} />
          </div>
        </div>
      </div>
    </section>
  );
}
