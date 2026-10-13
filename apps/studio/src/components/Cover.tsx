// 작품 그림. 작가가 등록한 표지 이미지(meta.cover)를 깔고, 없으면 작품 ID로 정해지는 추상 무늬를 그린다.
// Thumb: 세로 A4 비율(1:1.414) 썸네일. 비율이 다른 이미지는 가운데를 기준으로 잘라서 채운다.

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

/** 이미지 또는 기본 무늬. 부모 상자를 꽉 채운다 */
export function Artwork({ w }: { w: CoverInfo }) {
  return w.cover ? <img className="art-fill" src={w.cover} alt="" loading="lazy" draggable={false} /> : <CoverArt seed={w.id} tone={genreTone(w.genre)} />;
}

export function Thumb({ w, className = '' }: { w: CoverInfo; className?: string }) {
  return (
    <div className={`thumb ${className}`} style={{ '--tone': genreTone(w.genre) } as CSSProperties}>
      <Artwork w={w} />
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

/** 세로 A4(1:1.414) 화면에 맞춘 무늬 */
const W = 200;
const H = 283;

function CoverArt({ seed, tone }: { seed: string; tone: string }) {
  const h = hash(seed);
  const r = rng(h);
  // 비슷한 ID끼리 첫 값이 몰리지 않도록 몇 번 흘려보낸다
  for (let i = 0; i < 4; i++) r();
  const kind = h % 3;
  const light = (n: number) => mix(tone, '#fff3dc', n);
  const dark = (n: number) => mix(tone, '#120c08', n);
  const gid = `g${h.toString(36)}`;
  const u = Math.min(W, H); // 크기 기준

  const art: ReactElement[] = [];
  if (kind === 0) {
    // 지평선과 달: 겹친 언덕 띠 위에 큰 원
    const cx = W * (0.55 + r() * 0.3);
    const cy = H * (0.22 + r() * 0.18);
    const rad = u * (0.14 + r() * 0.1);
    art.push(<circle key="halo" cx={cx} cy={cy} r={rad * 1.8} fill="none" stroke={light(0.6)} strokeWidth={0.8} opacity={0.45} />);
    art.push(<circle key="moon" cx={cx} cy={cy} r={rad} fill={light(0.78)} opacity={0.92} />);
    for (let i = 0; i < 4; i++) {
      const y = H * (0.55 + i * 0.1) + r() * H * 0.04;
      const a = H * (0.06 + r() * 0.12);
      art.push(<path key={`hill${i}`} d={`M0 ${y} Q ${W * (0.25 + r() * 0.5)} ${y - a} ${W} ${y + (r() - 0.5) * H * 0.1} V ${H} H 0 Z`} fill={dark(0.15 + i * 0.16)} opacity={0.92} />);
    }
  } else if (kind === 1) {
    // 비스듬한 빛줄기
    const angle = -25 + r() * 50;
    for (let i = 0; i < 9; i++) {
      const x = -W * 0.3 + i * W * 0.2 + r() * 20;
      const wdt = u * (0.04 + r() * 0.15);
      art.push(<rect key={`ray${i}`} x={x} y={-H} width={wdt} height={H * 3} fill={i % 2 ? light(0.35 + r() * 0.3) : dark(0.3)} opacity={0.16 + r() * 0.3} transform={`rotate(${angle} ${W / 2} ${H / 2})`} />);
    }
    const cy = H * (0.3 + r() * 0.4);
    art.push(<line key="rule" x1={W * 0.15} x2={W * 0.85} y1={cy} y2={cy} stroke={light(0.8)} strokeWidth={0.8} opacity={0.6} />);
    art.push(<circle key="dot" cx={W / 2} cy={cy} r={3.5} fill={light(0.85)} />);
  } else {
    // 밤하늘: 흩어진 별과 큰 고리
    for (let i = 0; i < 60; i++) art.push(<circle key={`s${i}`} cx={r() * W} cy={r() * H * 0.8} r={r() * 1.3 + 0.3} fill={light(0.9)} opacity={0.35 + r() * 0.6} />);
    const cx = W * (0.2 + r() * 0.6);
    const cy = H * (0.4 + r() * 0.25);
    for (let i = 0; i < 4; i++) art.push(<circle key={`ring${i}`} cx={cx} cy={cy} r={u * (0.15 + i * 0.11)} fill="none" stroke={light(0.55)} strokeWidth={1.2 - i * 0.2} opacity={0.55 - i * 0.1} />);
    art.push(<rect key="ground" x={0} y={H * (0.8 - r() * 0.1)} width={W} height={H} fill={dark(0.45)} opacity={0.85} />);
  }

  return (
    <svg className="art-fill" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
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
