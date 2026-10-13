// 「청화고 연애 금지령」 공용 줄임 함수와 임시 일러스트(SVG).
// 임시 그림은 작가가 만든 JPG로 바꿔 끼울 수 있도록 에셋 ID(cover·gate·sports·rain·roof)를 그대로 쓴다.

import type { Command } from '@engine';

export const add = (v: string, n: number | string): Command => ({ do: 'add', var: v, value: n });
export const set = (v: string, n: number | string | boolean): Command => ({ do: 'set', var: v, value: n });
/** 문자열 값은 따옴표로 감싸 수식이 아닌 글자로 쓴다 */
export const tag = (key: string, value?: string | number): Command => (value === undefined ? { do: 'tag', key } : { do: 'tag', key, value: typeof value === 'string' ? `'${value}'` : value });
export const tagAdd = (key: string, n: number | string = 1): Command => ({ do: 'tag', key, add: n });
export const item = (id: string, count = 1, silent = false): Command => (silent ? { do: 'item', id, count, silent } : { do: 'item', id, count });
export const on = (id: string, duration?: number): Command => (duration === undefined ? { do: 'status', id } : { do: 'status', id, duration });
export const off = (id: string): Command => ({ do: 'status', id, remove: true });
export const note = (text: string): Command => ({ do: 'note', text });
export const rec = (text: string, importance = 3): Command => ({ do: 'record', text, importance });
export const end = (ending: string): Command => ({ do: 'end', ending });
export const go = (event: string): Command => ({ do: 'goto', event });
export const call = (script: string, args?: Record<string, number | string>): Command => ({ do: 'call', script, args });
export const achieve = (id: string): Command => ({ do: 'achieve', id });
export const iff = (cond: string, then: Command[], otherwise?: Command[]): Command => (otherwise ? { do: 'if', cond, then, else: otherwise } : { do: 'if', cond, then });

// ───────────────────────── 임시 일러스트 ─────────────────────────

const svg = (w: number, h: number, body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

const petals = (w: number, h: number, n: number, seed: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = (i * 97 + seed * 31) % w;
    const y = (i * 53 + seed * 17) % h;
    return `<ellipse cx="${x}" cy="${y}" rx="${3 + (i % 3)}" ry="${2 + (i % 2)}" fill="#ffd5e1" opacity="${0.55 + (i % 4) * 0.1}" transform="rotate(${(i * 37) % 180} ${x} ${y})"/>`;
  }).join('');

const sky = (w: number, h: number, a: string, b: string, id = 'g') => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;

export const IMG_COVER = svg(
  200,
  283,
  `${sky(200, 283, '#bfe3ff', '#ffd9e6')}${petals(200, 283, 40, 3)}
<circle cx="150" cy="60" r="26" fill="#fff6d6" opacity="0.9"/>
<rect x="0" y="190" width="200" height="93" fill="#f4b9cc"/><rect x="0" y="212" width="200" height="71" fill="#e895b1"/>
<path d="M20 283v-60h22v60zM58 283v-40h22v40zM120 283v-50h24v50zM156 283v-64h22v64z" fill="#6a4a7a" opacity="0.55"/>
<circle cx="100" cy="206" r="9" fill="#3b2f55"/><path d="M88 283c0-24 6-60 12-60s12 36 12 60z" fill="#3b2f55"/>`,
);

export const IMG_GATE = svg(
  480,
  270,
  `${sky(480, 270, '#cdeaff', '#ffe3ec')}${petals(480, 270, 60, 1)}
<rect x="60" y="80" width="26" height="150" fill="#9aa3b5"/><rect x="394" y="80" width="26" height="150" fill="#9aa3b5"/>
<path d="M86 120h308" stroke="#7a8397" stroke-width="6"/><rect x="0" y="230" width="480" height="40" fill="#e6b4c4"/>
<rect x="200" y="140" width="80" height="90" rx="10" fill="#3b2f55"/><rect x="288" y="164" width="60" height="6" fill="#c33"/><circle cx="240" cy="132" r="20" fill="#3b2f55"/>
<circle cx="72" cy="72" r="9" fill="#fff"/><path d="M68 70l8 0M72 66v8" stroke="#d66" stroke-width="2"/>`,
);

export const IMG_SPORTS = svg(
  480,
  270,
  `${sky(480, 270, '#9fd6ff', '#e2f6ff')}
<rect x="0" y="170" width="480" height="100" fill="#cfe9a8"/><path d="M0 200h480M0 232h480" stroke="#fff" stroke-width="3" opacity="0.7"/>
<g fill="#3b2f55"><circle cx="205" cy="128" r="14"/><rect x="190" y="142" width="30" height="48" rx="8"/><circle cx="262" cy="128" r="14"/><rect x="247" y="142" width="30" height="48" rx="8"/></g>
<path d="M214 186l36 0" stroke="#e44" stroke-width="5"/><g fill="#f7a8c0">${Array.from({ length: 12 }, (_, i) => `<circle cx="${20 + i * 40}" cy="${140 + (i % 3) * 8}" r="9"/>`).join('')}</g>
<path d="M40 60h110v30H40z" fill="#fff" opacity="0.85"/><path d="M0 60 30 40M0 70 30 50" stroke="#fff" stroke-width="2" opacity="0.6"/>`,
);

export const IMG_RAIN = svg(
  480,
  270,
  `${sky(480, 270, '#6c7ea3', '#c7bfd8')}
${Array.from({ length: 70 }, (_, i) => `<path d="M${(i * 37) % 480} ${(i * 29) % 240}l-6 18" stroke="#e8f0ff" stroke-width="1.4" opacity="0.5"/>`).join('')}
<rect x="0" y="210" width="480" height="60" fill="#5d5875"/><circle cx="410" cy="90" r="30" fill="#ffe6a0" opacity="0.55"/><rect x="406" y="90" width="8" height="130" fill="#3b3550"/>
<path d="M130 120a110 70 0 0 1 220 0z" fill="#bfe3ff" opacity="0.65" stroke="#fff" stroke-width="2"/><path d="M240 120v90" stroke="#3b3550" stroke-width="4"/>
<circle cx="225" cy="168" r="13" fill="#3b2f55"/><rect x="212" y="180" width="26" height="40" rx="8" fill="#3b2f55"/><rect x="246" y="184" width="22" height="36" rx="8" fill="#55407a" opacity="0.8"/>`,
);

export const IMG_ROOF = svg(
  480,
  270,
  `${sky(480, 270, '#3a2f6b', '#ff9e6e')}
${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 71) % 480}" cy="${(i * 37) % 120}" r="${0.8 + (i % 3) * 0.5}" fill="#fff" opacity="0.7"/>`).join('')}
<path d="M120 90l4-30M120 90l-24-14M120 90l22-18M360 70l-6-26M360 70l24-10M360 70l-14 22" stroke="#ffe27a" stroke-width="3" stroke-linecap="round"/>
<rect x="0" y="206" width="480" height="64" fill="#2a2147"/><rect x="0" y="198" width="480" height="8" fill="#463a73"/>
<g fill="#ffcf6b">${Array.from({ length: 10 }, (_, i) => `<circle cx="${30 + i * 48}" cy="${178 + (i % 2) * 6}" r="6"/>`).join('')}</g>
<g fill="#1c1533"><circle cx="190" cy="176" r="13"/><rect x="177" y="188" width="26" height="42" rx="8"/><circle cx="290" cy="174" r="13"/><rect x="277" y="186" width="26" height="44" rx="8"/></g>`,
);

export const IMG_STAGE = svg(
  480,
  270,
  `${sky(480, 270, '#3b1f4a', '#7a3d5e')}
<path d="M0 0h90v270H0zM390 0h90v270H390z" fill="#8f2436" opacity="0.9"/><path d="M180 0l60 190 60-190z" fill="#fff3c4" opacity="0.28"/>
<rect x="0" y="196" width="480" height="74" fill="#2b1a2e"/><circle cx="240" cy="120" r="14" fill="#e8d8ff"/><rect x="226" y="132" width="28" height="58" rx="10" fill="#d9c2ff"/><path d="M212 142l-30-20M268 142l30-20" stroke="#d9c2ff" stroke-width="6" stroke-linecap="round"/>
<g fill="#160d1c">${Array.from({ length: 9 }, (_, i) => `<circle cx="${40 + i * 50}" cy="${236 + (i % 2) * 8}" r="12"/>`).join('')}</g>`,
);

export const IMG_LIBRARY = svg(
  480,
  270,
  `${sky(480, 270, '#8a9bb8', '#d8d2dc')}
${Array.from({ length: 50 }, (_, i) => `<path d="M${(i * 41) % 480} ${(i * 23) % 150}l-4 14" stroke="#fff" stroke-width="1.2" opacity="0.5"/>`).join('')}
<rect x="40" y="30" width="400" height="140" fill="none" stroke="#6b5a4a" stroke-width="6"/><path d="M240 30v140M40 100h400" stroke="#6b5a4a" stroke-width="4"/>
<rect x="0" y="190" width="480" height="80" fill="#8b6a4a"/><rect x="120" y="150" width="240" height="14" fill="#a07d58"/>
<circle cx="200" cy="124" r="12" fill="#c9ced9"/><rect x="188" y="136" width="24" height="40" rx="8" fill="#3b3550"/><rect x="262" y="150" width="30" height="40" rx="4" fill="#7a5f45"/>
<circle cx="420" cy="60" r="20" fill="#ffe6a0" opacity="0.5"/>`,
);

export const IMG_PRESS = svg(
  480,
  270,
  `${sky(480, 270, '#ffe9c7', '#ffd0d8')}
<g stroke="#e0584b" stroke-width="1.5" opacity="0.7"><path d="M40 60L180 120L330 50L440 110"/></g>
${[[40, 60], [180, 120], [330, 50], [440, 110]].map(([x, y]) => `<rect x="${x - 22}" y="${y - 16}" width="44" height="32" fill="#fff" stroke="#c8b8a8" transform="rotate(${(x % 7) - 3} ${x} ${y})"/>`).join('')}
<rect x="0" y="206" width="480" height="64" fill="#b08968"/><rect x="170" y="130" width="140" height="90" fill="#fffaf0" stroke="#d6c7b0" stroke-width="3" transform="rotate(-4 240 175)"/><path d="M190 152h100M190 168h100M190 184h70" stroke="#777" stroke-width="5" opacity="0.5" transform="rotate(-4 240 175)"/>
<circle cx="240" cy="96" r="18" fill="#c9a57a"/><rect x="224" y="112" width="32" height="28" rx="8" fill="#3b3550"/>`,
);
