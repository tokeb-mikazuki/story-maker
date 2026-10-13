// 작품 표지(전자책 모양). 제목은 표지에 쓰지 않는다 — 작가가 등록한 표지 이미지를 깔고,
// 없으면 작품 ID로 정해지는 추상 무늬를 그린다(같은 작품은 늘 같은 무늬).

import type { CSSProperties, ReactElement } from 'react';

const GENRE_TONE: Record<string, string> = {
  판타지: '#5a4a7a',
  미스터리: '#2f4858',
  로맨스: '#9a4a5a',
  SF: '#2d5a74',
  호러: '#3a2a2a',
  드라마: '#7a5a3a',
  모험: '#4a6a3a',
  일상: '#8a7a4a',
  역사: '#6a4a2a',
  코미디: '#b0703a',
  기타: '#5c544a',
};
export const genreTone = (g: string) => GENRE_TONE[g] ?? GENRE_TONE.기타;

export interface CoverInfo {
  id: string;
  genre: string;
  /** 표지 이미지 src(data URL 또는 주소) */
  cover?: string;
}

export function BookCover({ w, size = 'md', className = '' }: { w: CoverInfo; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={`ebook ${size} ${w.cover ? 'has-image' : ''} ${className}`} style={{ '--tone': genreTone(w.genre) } as CSSProperties}>
      {w.cover ? <img src={w.cover} alt="" loading="lazy" draggable={false} /> : <CoverArt seed={w.id} tone={genreTone(w.genre)} />}
      <span className="ebook-spine" aria-hidden />
      <span className="ebook-sheen" aria-hidden />
    </div>
  );
}

// ───────────────────────── 기본 무늬 ─────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 시드 고정 난수 */
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(hex: string, to: string, amount: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(to)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amount)).join(',')})`;
}

const W = 200;
const H = 300;

function CoverArt({ seed, tone }: { seed: string; tone: string }) {
  const h = hash(seed);
  const r = rng(h);
  // 비슷한 ID끼리 첫 값이 몰리지 않도록 몇 번 흘려보낸다
  for (let i = 0; i < 4; i++) r();
  const kind = h % 3;
  const light = (n: number) => mix(tone, '#fff3dc', n);
  const dark = (n: number) => mix(tone, '#120c08', n);
  const gid = `g${h.toString(36)}`;

  const art: ReactElement[] = [];
  if (kind === 0) {
    // 지평선과 달: 겹친 언덕 띠 위에 큰 원
    const cx = 50 + r() * 100;
    const cy = 70 + r() * 60;
    const rad = 28 + r() * 26;
    art.push(<circle key="moon" cx={cx} cy={cy} r={rad} fill={light(0.75)} opacity={0.9} />);
    art.push(<circle key="halo" cx={cx} cy={cy} r={rad * 1.7} fill="none" stroke={light(0.6)} strokeWidth={0.8} opacity={0.5} />);
    for (let i = 0; i < 4; i++) {
      const y = 170 + i * 30 + r() * 12;
      const a = 20 + r() * 40;
      art.push(<path key={`hill${i}`} d={`M0 ${y} Q ${50 + r() * 100} ${y - a} ${W} ${y + (r() - 0.5) * 30} V ${H} H 0 Z`} fill={dark(0.15 + i * 0.16)} opacity={0.92} />);
    }
  } else if (kind === 1) {
    // 비스듬한 빛줄기
    const angle = -25 + r() * 50;
    for (let i = 0; i < 7; i++) {
      const x = -60 + i * 50 + r() * 20;
      const wdt = 8 + r() * 30;
      art.push(<rect key={`ray${i}`} x={x} y={-80} width={wdt} height={H + 160} fill={i % 2 ? light(0.35 + r() * 0.3) : dark(0.3)} opacity={0.18 + r() * 0.3} transform={`rotate(${angle} ${W / 2} ${H / 2})`} />);
    }
    const cy = 80 + r() * 140;
    art.push(<line key="rule" x1={30} x2={170} y1={cy} y2={cy} stroke={light(0.8)} strokeWidth={0.8} opacity={0.6} />);
    art.push(<circle key="dot" cx={100} cy={cy} r={3.5} fill={light(0.85)} />);
  } else {
    // 밤하늘: 흩어진 별과 큰 고리
    for (let i = 0; i < 46; i++) art.push(<circle key={`s${i}`} cx={r() * W} cy={r() * H * 0.8} r={r() * 1.3 + 0.3} fill={light(0.9)} opacity={0.35 + r() * 0.6} />);
    const cx = 40 + r() * 120;
    const cy = 120 + r() * 80;
    for (let i = 0; i < 4; i++) art.push(<circle key={`ring${i}`} cx={cx} cy={cy} r={30 + i * 22} fill="none" stroke={light(0.55)} strokeWidth={1.2 - i * 0.2} opacity={0.55 - i * 0.1} />);
    art.push(<rect key="ground" x={0} y={H - 60 - r() * 30} width={W} height={120} fill={dark(0.45)} opacity={0.85} />);
  }

  return (
    <svg className="ebook-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={light(0.18)} />
          <stop offset="0.55" stopColor={tone} />
          <stop offset="1" stopColor={dark(0.45)} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gid})`} />
      {art}
    </svg>
  );
}
