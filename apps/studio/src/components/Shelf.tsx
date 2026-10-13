// 작품 카드: 넷플릭스처럼 깔끔한 가로(16:9) 썸네일 카드.

import type { CSSProperties } from 'react';
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
