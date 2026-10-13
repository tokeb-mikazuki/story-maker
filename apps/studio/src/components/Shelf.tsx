// 작품 카드: 넷플릭스처럼 깔끔한 세로 A4(1:1.414) 썸네일 카드.

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import type { WorkSummary } from '../lib/community';
import { href } from '../lib/router';
import { Thumb, genreTone } from './Cover';
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

// ───────────────────────── 홈 진열대(오늘의 작품·인기·최신) ─────────────────────────

export interface Pick {
  w: WorkSummary;
  /** 카드 아래 한 줄(예: '인기 2위', '3일 전') */
  note: ReactNode;
}

/**
 * 진열대 한 칸. 작품 더미에서 일정 시간마다 한 장씩 꺼내 앞에 놓는다.
 * 마우스를 올리거나 키보드로 들어오면 멈추고, 동작 줄이기 설정이면 넘김 효과 없이 바꾼다.
 */
export function Showcase({ label, picks, interval = 5000, delay = 0 }: { label: string; picks: Pick[]; interval?: number; delay?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = picks.length;
  useEffect(() => {
    if (n < 2 || paused) return;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      setI((x) => (x + 1) % n);
      timer = window.setInterval(() => setI((x) => (x + 1) % n), interval);
    }, interval + delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [n, paused, interval, delay]);
  if (!n) return null;
  const cur = picks[i % n];
  return (
    <div className="showcase" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="showcase-label">{label}</div>
      <div className={`showcase-deck ${n > 1 ? 'stacked' : ''}`}>
        <a key={`${cur.w.id}-${i}`} className="showcase-card" href={href('works', cur.w.id)} aria-label={`${label}: ${cur.w.title}`} aria-live="polite">
          <Thumb w={cur.w} />
          <span className="tile-shade" aria-hidden />
          <span className="showcase-cap">
            <span className="tile-genre">{cur.w.genre}</span>
            <b>{cur.w.title}</b>
          </span>
        </a>
      </div>
      <div className="showcase-note">{cur.note}</div>
      {n > 1 && (
        <div className="showcase-dots" role="tablist" aria-label={`${label} 넘기기`}>
          {picks.map((p, k) => (
            <button key={p.w.id} type="button" role="tab" aria-selected={k === i % n} className={k === i % n ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1}번째: ${p.w.title}`} />
          ))}
        </div>
      )}
    </div>
  );
}
