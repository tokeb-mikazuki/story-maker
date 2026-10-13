// 샘플 ⑤ 읽는 이야기 — 「껍질 세계(The Shell)」 (오리지널)
// 선택지 없이 '다음'만 눌러 줄거리를 따라가는 키네틱 노벨 형식.
// 한 쪽이 이벤트 하나이고, 마지막 쪽에서 엔딩으로 끝난다. 작가 설정집에서 정해지지 않은 부분은
// 이야기 안에서 이렇게 채웠다 — 동료 이름과 전투 방식, 동료 B의 폭사 원인, 동료 A를 죽인 배후,
// 최초 균열의 인과, 사상 병기가 멈추는 방식.

import type { AssetDef, EventDef, StoryPackage } from '@engine';
import { PART2 } from './chainText/part2';
import { PART3 } from './chainText/part3';
import { type Chapter, PART1 } from './chainText/part1';

// ───────────────────────── 표지(그림 없이 그린 벡터) ─────────────────────────

function coverSvg(): string {
  const links: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 330 + i * 118;
    const flat = i % 2 === 0;
    const rx = flat ? 46 : 14;
    links.push(
      `<ellipse cx="528" cy="${y}" rx="${rx}" ry="74" fill="none" stroke="url(#gold)" stroke-width="${flat ? 13 : 16}"/>`,
    );
  }
  const crack = '528,0 548,140 505,260 560,380 498,520 566,660 506,800 556,940 520,1080 548,1220 512,1340 530,1491';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1055 1491" preserveAspectRatio="xMidYMid slice">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2f3a52"/><stop offset="0.55" stop-color="#171b2b"/><stop offset="1" stop-color="#07080e"/></radialGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dc9a"/><stop offset="1" stop-color="#b07a2e"/></linearGradient>
<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9fd6ff" stop-opacity="0.55"/><stop offset="1" stop-color="#9fd6ff" stop-opacity="0"/></radialGradient>
<filter id="blur"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<rect width="1055" height="1491" fill="url(#bg)"/>
<circle cx="528" cy="560" r="470" fill="url(#halo)"/>
<circle cx="528" cy="560" r="400" fill="none" stroke="#8aa4c8" stroke-opacity="0.35" stroke-width="3"/>
<circle cx="528" cy="560" r="430" fill="none" stroke="#8aa4c8" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="6 18"/>
<polyline points="${crack}" fill="none" stroke="#c9ecff" stroke-width="22" stroke-opacity="0.55" filter="url(#blur)"/>
<polyline points="${crack}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
${links.join('\n')}
<g fill="#ffffff" fill-opacity="0.55">${Array.from({ length: 36 }, (_, i) => `<circle cx="${(i * 197) % 1055}" cy="${(i * 331) % 1491}" r="${1 + (i % 3)}"/>`).join('')}</g>
<rect x="0" y="1260" width="1055" height="231" fill="#05060a" fill-opacity="0.55"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const assets: AssetDef[] = [{ id: '표지', kind: 'image', src: coverSvg(), alt: '금이 간 껍질 위로 늘어진 금빛 사슬' }];

// ───────────────────────── 본문(chainText/part1~3.ts) ─────────────────────────

const CHAPTERS: Chapter[] = [...PART1, ...PART2, ...PART3];

// ───────────────────────── 이벤트로 펼치기 ─────────────────────────

function build(): EventDef[] {
  const flat: { id: string; title?: string; text: string }[] = [];
  let n = 0;
  for (const ch of CHAPTERS) {
    // 한 번에 읽는 호흡을 늘리려고 이어지는 두 장면을 한 쪽으로 묶는다(남는 한 장면은 앞 쪽에 붙인다)
    const pages: string[][] = [];
    for (let i = 0; i < ch.pages.length; i += 2) pages.push(ch.pages[i + 1] ? [...ch.pages[i], ...ch.pages[i + 1]] : ch.pages[i]);
    if (pages.length > 1 && ch.pages.length % 2 === 1) pages.splice(pages.length - 2, 2, [...pages[pages.length - 2], ...pages[pages.length - 1]]);
    pages.forEach((page, i) => {
      n += 1;
      flat.push({ id: `p${String(n).padStart(3, '0')}`, title: undefined, text: page.join('\n') });
    });
  }
  return flat.map((p, i) => {
    const next = flat[i + 1];
    return {
      id: p.id,
      title: p.title,
      text: p.text,
      choices: [{ text: '다음', outcome: next ? { goto: next.id } : { do: [{ do: 'end', ending: 'record' }] } }],
    };
  });
}

export const chain: StoryPackage = {
  format: 'ifb/1',
  meta: {
    id: 'sample:chain',
    title: '껍질 세계',
    author: '이야기 공방 샘플',
    version: '1.0',
    description:
      '2차 대전의 끝, 사상 병기가 세계를 무너뜨렸고 인류의 자기인식만이 거짓 평화의 껍질 속에 옮겨졌다. 쾌활한 청년 이안은 사슬을 부리는 영웅 파워체인이 되었다가, 자신이 두 세계를 잇는 체인 그 자체임을 알게 된다. 이안의 1인칭으로 「다음」만 눌러 읽어 가는 어반 다크 판타지. (약 1시간)',
    tags: ['읽는 이야기', '샘플', '다크 판타지', '디스토피아'],
    cover: '표지',
  },
  settings: {
    mode: 'story',
    calendar: { unit: 'none' },
    player: {},
    stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [{ type: 'events', pools: ['기본'], select: 'fixedThenRandom' }] }],
    start: 'p001',
    idleEnding: { turns: 1, ending: 'record' },
    ui: {
      continueText: '다음',
      typewriter: true,
      theme: { '--paper': '#0f1a24', '--ink': '#dbe8f2', '--panel': '#162534', '--line': '#2a4156', '--muted': '#8aa4b8', '--accent': '#5fb4d9' },
    },
  },
  variables: [],
  events: build(),
  endings: [
    {
      id: 'record',
      title: '이안의 기록',
      kind: 'neutral',
      text: '그의 이름은 이안.\n그는 연결이었고, 연결이 끝난 자리에서 내일이 시작되었다.',
    },
  ],
  assets,
};
