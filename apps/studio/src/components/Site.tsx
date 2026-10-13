// 공개 사이트(홈·창작마당·게시판·About Us·계정 화면)의 틀과 공용 조각.

import type { ReactNode } from 'react';
import { type PublicProfile, isGoneProfile, profileOf } from '../lib/auth';
import type { WorkSummary } from '../lib/community';
import { href } from '../lib/router';
import { AccountMenu, Avatar } from './Account';

const NAV: [page: string, label: string][] = [
  ['', '홈'],
  ['works', '창작마당'],
  ['board', '게시판'],
  ['about', 'About Us'],
];

export function SiteLayout({ page, children }: { page: string; children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-in">
          <a className="site-brand" href="#/">
            <span className="brand-mark">✒</span>
            <span>이야기 공방</span>
          </a>
          <nav className="site-nav" aria-label="주 메뉴">
            {NAV.map(([p, label]) => (
              <a key={p} href={href(p)} className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined}>
                {label}
              </a>
            ))}
            <a href={href('studio')} className={`nav-studio ${page === 'studio' ? 'active' : ''}`}>
              내 작업실
            </a>
          </nav>
          <div className="site-tools">
            <a className={`btn small make-btn ${page === 'studio' ? 'on' : ''}`} href={href('studio')}>
              ✎ 내 작업실
            </a>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="site-footer-in">
          <div>
            <div className="site-brand small">
              <span className="brand-mark">✒</span>
              <span>이야기 공방</span>
            </div>
            <p>선택으로 흘러가는 이야기를 쓰고, 읽고, 나누는 곳.</p>
          </div>
          <nav aria-label="바닥 메뉴">
            {NAV.map(([p, label]) => (
              <a key={p} href={href(p)}>
                {label}
              </a>
            ))}
            <a href={href('studio')}>내 작업실</a>
          </nav>
          <p className="site-footer-note">개발 버전 · 계정, 작품, 게시글은 서버가 연결되기 전까지 이 브라우저에만 저장됩니다.</p>
        </div>
      </footer>
    </div>
  );
}

/** 페이지 머리: 쪽 번호처럼 작은 표제 + 제목 + 설명 */
export function PageHead({ kicker, title, children, actions }: { kicker?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
        {children && <p className="page-lede">{children}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}

// ───────────────────────── 작성자 ─────────────────────────

/** 닉네임을 누르면 프로필로 간다. 탈퇴한 계정은 글자만 */
export function AuthorLink({ id, size = 22, plain }: { id: string; size?: number; plain?: boolean }) {
  const p = profileOf(id);
  const inner = (
    <>
      {!plain && <Avatar profile={p} size={size} />}
      <span>{p.nickname}</span>
      {p.official && <span className="official-badge">공식</span>}
    </>
  );
  if (isGoneProfile(p)) return <span className="author-link gone">{inner}</span>;
  return (
    <a className="author-link" href={href('u', p.id)} title={`${p.nickname} 프로필 보기`} onClick={(e) => e.stopPropagation()}>
      {inner}
    </a>
  );
}

export const nicknameOf = (id: string): PublicProfile['nickname'] => profileOf(id).nickname;

// ───────────────────────── 별점 ─────────────────────────

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`별점 5점 중 ${value.toFixed(1)}점`}>
      <span className="stars-base">★★★★★</span>
      <span className="stars-fill" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

export function RatingText({ w }: { w: Pick<WorkSummary, 'avg' | 'ratingCount'> }) {
  if (!w.ratingCount) return <span className="rating-text muted">별점 없음</span>;
  return (
    <span className="rating-text">
      <Stars value={w.avg} />
      <b>{w.avg.toFixed(1)}</b>
      <span className="muted">({w.ratingCount})</span>
    </span>
  );
}

// ───────────────────────── 작품 카드 ─────────────────────────

export { Thumb, genreTone } from './Cover';

// ───────────────────────── 시간 ─────────────────────────

export function timeAgo(t: number, now = Date.now()): string {
  const s = Math.floor((now - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return dateShort(t);
}

export const dateShort = (t: number) => new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '');
export const dateLong = (t: number) => new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
