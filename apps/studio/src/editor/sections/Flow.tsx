// 흐름도: 이벤트를 옆으로 뻗어가는 카드로 본다.
//  · 연결 그래프 — 시작/풀 이벤트에서 '이동'을 따라 왼쪽→오른쪽 (분기형 이야기에 적합)
//  · 단계별 타임라인 — 단계(유년기→…)를 열로, 고정·초크포인트 이벤트를 먼저 (인생형에 적합)

import type { EventDef, StoryPackage } from '@engine';
import { useMemo, useState } from 'react';
import { eventLabel, hasEventId } from '../../lib/labels';
import { useEditor } from '../context';
import { eventLinks } from './Events';

const W = 220;
const H = 86;
const GX = 70;
const GY = 14;

interface Placed {
  e: EventDef;
  x: number;
  y: number;
  /** 몇 번째 열인지(선이 이웃한 열로만 가는지 가리는 데 쓴다) */
  col: number;
  orphan?: boolean;
}

/** 연결 없는 이벤트 격자의 열 수 */
const LOOSE_COLS = 5;

interface Layout {
  nodes: Placed[];
  width: number;
  height: number;
  cols: string[];
  /** 열 제목과 별개로 아래쪽 영역에 붙는 제목(y는 카드 영역 기준) */
  sections: { label: string; y: number }[];
}

function graphLayout(pkg: StoryPackage): Layout {
  const links = eventLinks(pkg);
  const ids = new Set(pkg.events.map((e) => e.id));
  const roots = pkg.events.filter((e) => e.id === pkg.settings.start || e.pool);
  // 시작 이벤트가 맨 앞, 그다음 풀 이벤트
  roots.sort((a, b) => (a.id === pkg.settings.start ? -1 : b.id === pkg.settings.start ? 1 : 0));
  const rootIds = new Set(roots.map((r) => r.id));

  // 1) 되돌아가는 연결(순환, 시작·풀 이벤트로 돌아옴)을 찾아 뺀다. 나머지는 항상 왼쪽→오른쪽
  const back = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const t of links.get(id) ?? []) {
      if (!ids.has(t) || t === id) continue;
      if (rootIds.has(t) || state.get(t) === 1) back.add(`${id}>${t}`);
      else if (!state.has(t)) dfs(t);
    }
    state.set(id, 2);
  };
  for (const r of roots) if (!state.has(r.id)) dfs(r.id);

  // 2) 가장 긴 경로로 열을 정한다. 이어지는 장면은 늘 부모 바로 오른쪽 열 이후에 놓여 선이 카드 뒤로 덜 지나간다
  const parents = new Map<string, string[]>();
  for (const [from, tos] of links)
    for (const t of tos) if (ids.has(t) && t !== from && state.has(from) && state.has(t) && !back.has(`${from}>${t}`)) parents.set(t, [...(parents.get(t) ?? []), from]);
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const d = rootIds.has(id) ? 0 : Math.max(0, ...(parents.get(id) ?? []).map((p) => depthOf(p) + 1));
    depth.set(id, d);
    return d;
  };
  for (const id of state.keys()) depthOf(id);

  // 시작 이벤트가 아니면서 어디로도, 어디서도 이어지지 않는 풀 이벤트는 한 줄로 쌓지 않고 따로 격자에 모은다
  const hasIn = new Set<string>();
  for (const tos of links.values()) for (const t of tos) hasIn.add(t);
  const loose = pkg.events.filter(
    (e) => e.id !== pkg.settings.start && rootIds.has(e.id) && !hasIn.has(e.id) && ![...(links.get(e.id) ?? [])].some((t) => ids.has(t) && t !== e.id),
  );
  const looseIds = new Set(loose.map((e) => e.id));

  const maxDepth = Math.max(0, ...depth.values());
  const columns: EventDef[][] = Array.from({ length: maxDepth + 2 }, () => []);
  for (const e of pkg.events) {
    if (looseIds.has(e.id)) continue;
    const d = depth.get(e.id);
    columns[d === undefined ? maxDepth + 1 : d].push(e);
  }

  // 3) 열 안의 순서: 부모들의 위치 평균에 맞춰 늘어놓아 선이 덜 엇갈리게
  const row = new Map<string, number>();
  columns.forEach((col, ci) => {
    if (ci > 0 && ci <= maxDepth) {
      const key = (e: EventDef) => {
        const ps = (parents.get(e.id) ?? []).filter((p) => row.has(p));
        return ps.length ? ps.reduce((a, p) => a + row.get(p)!, 0) / ps.length : Infinity;
      };
      const base = new Map(col.map((e, i) => [e.id, i]));
      col.sort((a, b) => key(a) - key(b) || base.get(a.id)! - base.get(b.id)!);
    }
    col.forEach((e, i) => row.set(e.id, i));
  });

  const nodes: Placed[] = [];
  columns.forEach((col, ci) => col.forEach((e, ri) => nodes.push({ e, x: ci * (W + GX), y: ri * (H + GY), col: ci, orphan: !depth.has(e.id) })));
  let cols = columns.map((_, i) => (i === maxDepth + 1 ? '도달 경로 없음' : i === 0 ? '시작 · 풀' : `${i}단계 이동`));
  if (!columns[maxDepth + 1].length) cols.pop();
  // 이어진 장면이 하나도 없으면(연결 없는 풀 이벤트뿐) 이어짐 열은 그리지 않는다
  const connected = nodes.length > 0;
  if (!connected) cols = [];
  const connectedHeight = connected ? Math.max(...columns.map((c) => c.length), 1) * (H + GY) : 0;

  // 연결 없는 이벤트 격자
  const sections: { label: string; y: number }[] = [];
  let height = connectedHeight;
  if (loose.length) {
    const gridTop = connected ? connectedHeight + 40 : 0;
    loose.forEach((e, i) => nodes.push({ e, x: (i % LOOSE_COLS) * (W + GX), y: gridTop + Math.floor(i / LOOSE_COLS) * (H + GY), col: 0 }));
    sections.push({ label: `연결 없는 이벤트 ${loose.length}개 · 턴마다 뽑히는 장면`, y: gridTop });
    height = gridTop + Math.ceil(loose.length / LOOSE_COLS) * (H + GY);
  }
  return { nodes, width: Math.max(cols.length, loose.length ? LOOSE_COLS : 0) * (W + GX), height, cols, sections };
}

function stageLayout(pkg: StoryPackage): Layout {
  const stages = pkg.settings.stages;
  const columns: EventDef[][] = stages.map(() => []);
  const linked: EventDef[] = [];
  const any: EventDef[] = [];
  for (const e of pkg.events) {
    if (!e.pool) {
      linked.push(e);
      continue;
    }
    let placed = false;
    stages.forEach((s, i) => {
      const byStage = e.stages ? e.stages.includes(s.id) : true;
      const byAge = !e.ages || !s.ages || (e.ages[0] <= s.ages[1] && e.ages[1] >= s.ages[0]);
      const explicit = !!e.stages || !!e.ages;
      if (explicit && byStage && byAge) {
        // 나이 범위가 여러 단계에 걸치면 시작 단계에만
        if (!placed) columns[i].push(e);
        placed = true;
      }
    });
    if (!placed) any.push(e);
  }
  const ageKey = (e: EventDef) => (e.ages ? e.ages[0] : e.dates ? 0.5 : 999);
  for (const col of columns) col.sort((a, b) => Number(!!b.fixed) - Number(!!a.fixed) || ageKey(a) - ageKey(b));
  const all = [...(any.length ? [any] : []), ...columns, ...(linked.length ? [linked] : [])];
  const cols = [...(any.length ? ['모든 단계'] : []), ...stages.map((s) => s.name + (s.ages ? ` (${s.ages[0]}~${s.ages[1]}세)` : '')), ...(linked.length ? ['연결로만 등장'] : [])];
  const nodes: Placed[] = [];
  all.forEach((col, ci) => col.forEach((e, ri) => nodes.push({ e, x: ci * (W + GX), y: ri * (H + GY), col: ci })));
  return { nodes, width: all.length * (W + GX), height: Math.max(...all.map((c) => c.length), 1) * (H + GY), cols, sections: [] };
}

interface Edge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 왼쪽으로 되돌아가거나 같은 열로 가는 연결 */
  back: boolean;
  /** 이웃한 열이 아니라 건너뛰어 가는 연결(가운데 카드 뒤를 지나므로 흐리게 그린다) */
  far: boolean;
}

/**
 * 연결선 배치. 선은 카드 오른쪽 변 가운데 한 점에서 나와 갈라져 가고,
 * 받는 카드의 왼쪽 변 가운데 한 점으로 모여 들어간다.
 */
function routeEdges(nodes: Placed[], links: Map<string, Set<string>>, top: number): Edge[] {
  const pos = new Map(nodes.map((n) => [n.e.id, n]));
  const out: Edge[] = [];
  for (const [fromId, tos] of links)
    for (const toId of tos) {
      const from = pos.get(fromId);
      const to = pos.get(toId);
      if (!from || !to || from === to) continue;
      const back = to.col <= from.col;
      out.push({
        from: fromId,
        to: toId,
        x1: from.x + W,
        y1: from.y + top + H / 2,
        x2: to.x,
        y2: to.y + top + H / 2,
        back,
        far: !back && to.col - from.col > 1,
      });
    }
  return out;
}

export function FlowSection() {
  const { pkg, open } = useEditor();
  const [mode, setMode] = useState<'graph' | 'stages'>(pkg.settings.mode === 'life' ? 'stages' : 'graph');
  const [hover, setHover] = useState<string>();
  const layout = useMemo(() => (mode === 'graph' ? graphLayout(pkg) : stageLayout(pkg)), [pkg, mode]);
  const links = useMemo(() => eventLinks(pkg), [pkg]);
  const TOP = 34;
  const edges = useMemo(() => routeEdges(layout.nodes, links, TOP), [layout, links]);

  return (
    <div className="flow">
      <div className="flow-bar">
        <div className="tabs">
          <button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}>
            연결 그래프
          </button>
          <button className={mode === 'stages' ? 'active' : ''} onClick={() => setMode('stages')}>
            단계별 타임라인
          </button>
        </div>
        <span className="legend">
          카드를 누르면 그 장면을 고칩니다.
        </span>
      </div>
      <div className="flow-canvas">
        <div style={{ position: 'relative', width: layout.width, height: layout.height + TOP + 20 }}>
          {layout.cols.map((c, i) => (
            <div key={i} className="flow-col-title" style={{ left: i * (W + GX), width: W }}>
              {c}
            </div>
          ))}
          {layout.sections.map((s) => (
            <div key={s.label} className="flow-col-title" style={{ left: 0, top: s.y, width: layout.width - GX }}>
              {s.label}
            </div>
          ))}
          <svg className="flow-edges" width={layout.width} height={layout.height + TOP + 20}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="arrow-head" />
              </marker>
            </defs>
            {edges.map(({ from, to, x1, y1, x2, y2, back, far }) => {
              const lit = hover === from || hover === to;
              const d = back || far
                ? `M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
              return <path key={`${from}>${to}`} d={d} className={`edge ${lit ? 'lit' : ''} ${back ? 'back' : ''} ${far ? 'far' : ''}`} markerEnd="url(#arrow)" />;
            })}
          </svg>
          {layout.nodes.map(({ e, x, y, orphan }) => (
            <button
              key={e.id}
              className={`flow-card ${e.chokepoint ? 'choke' : e.fixed ? 'fixed' : ''} ${orphan ? 'orphan' : ''} ${hover === e.id ? 'lit' : ''}`}
              style={{ left: x, top: y + TOP, width: W, height: H }}
              onMouseEnter={() => setHover(e.id)}
              onMouseLeave={() => setHover(undefined)}
              onClick={() => open('events', e.id)}
            >
              <span className="flow-card-head">
                {pkg.settings.start === e.id && <span className="badge start">시작</span>}
                {e.chokepoint && <span className="badge choke">필수</span>}
                {e.fixed && !e.chokepoint && <span className="badge fixed">고정</span>}
                <strong className={hasEventId(e) || e.title ? '' : 'untitled'}>{eventLabel(e)}</strong>
              </span>
              <span className="flow-card-text">{e.text.replace(/\{[^}]*\}/g, '…').slice(0, 60)}</span>
              <span className="flow-card-meta">
                {e.ages ? `${e.ages[0]}~${e.ages[1]}세 · ` : ''}
                선택지 {e.choices.length}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
