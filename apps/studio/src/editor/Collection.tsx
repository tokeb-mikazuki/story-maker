// 목록 + 상세 편집(마스터-디테일) 공용 레이아웃.

import { type ReactNode, useState } from 'react';
import { ask } from '../lib/dialog';
import { prefs } from '../lib/storage';

/** 목록 묶어 보기. by는 바깥 묶음부터 순서대로 열쇠를 돌려준다 */
export interface Grouping<T> {
  id: string;
  label: string;
  by?: (item: T) => { key: string; label: string }[];
  /** 트리로 보기: 이 항목이 이어져 나오는 부모 항목의 id들. 첫 부모 아래에 놓고 나머지는 칩으로 알린다 */
  parents?: (item: T) => string[];
  /** 트리에서 이 항목 아래 자식들의 순서(자식 id 순서). 안 주면 목록 순서 */
  childOrder?: (item: T) => string[];
  /** 트리에서 칩 설명에 쓸 짧은 이름 */
  name?: (item: T) => string;
}

export interface CollectionProps<T extends { id: string }> {
  items: T[];
  selected?: string;
  onSelect: (id: string) => void;
  label: (item: T) => ReactNode;
  /** 트리 보기에서 부모 아래에 놓인 항목이면 hasParent가 참 */
  sub?: (item: T, ctx: { hasParent: boolean }) => ReactNode;
  badge?: (item: T) => ReactNode;
  onAdd: () => void;
  addLabel?: string;
  onDuplicate?: (id: string) => void;
  onRemove: (id: string) => void;
  onMove?: (from: number, to: number) => void;
  /** 검색 대상 문자열 */
  search?: (item: T) => string;
  children: (item: T) => ReactNode;
  empty?: ReactNode;
  toolbar?: ReactNode;
  /** 묶어 보기 방식들('순서대로'는 자동으로 붙는다) */
  groupings?: Grouping<T>[];
  /** 처음 고를 묶음 방식 id */
  defaultGrouping?: string;
}

type Row<T> =
  | { type: 'head'; level: number; label: string; count: number; key: string }
  | { type: 'item'; item: T; level: number; tree?: { kids: number; hidden: number; others: T[] } };

/**
 * 이어짐 트리. 부모가 없는 항목이 뿌리이고, 부모가 여럿이면 목록에서 먼저 나오는 부모 아래에 둔다.
 * 서로에게만 이어지는 순환은 목록에서 먼저 나오는 항목을 뿌리로 삼아 끊는다
 */
function treeRows<T extends { id: string }>(items: T[], parentsOf: (item: T) => string[], childOrder?: (item: T) => string[]): Row<T>[] {
  const byId = new Map(items.map((x) => [x.id, x]));
  const order = new Map(items.map((x, i) => [x.id, i]));
  const parents = new Map<string, T[]>();
  const children = new Map<string, T[]>();
  for (const item of items) {
    const ps = [...new Set(parentsOf(item))]
      .filter((id) => id !== item.id && byId.has(id))
      .map((id) => byId.get(id)!)
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    parents.set(item.id, ps);
    if (ps.length) children.set(ps[0].id, [...(children.get(ps[0].id) ?? []), item]);
  }
  // 자식은 부모의 선택지 순서대로(순서를 모르는 것은 목록 순서로 뒤에)
  if (childOrder)
    for (const [pid, kids] of children) {
      const rank = new Map(childOrder(byId.get(pid)!).map((id, i) => [id, i]));
      kids.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || order.get(a.id)! - order.get(b.id)!);
    }
  const rows: Row<T>[] = [];
  const seen = new Set<string>();
  const walk = (item: T, level: number): number => {
    seen.add(item.id);
    const at = rows.length;
    rows.push({ type: 'item', item, level });
    let hidden = 0;
    const kids = (children.get(item.id) ?? []).filter((c) => !seen.has(c.id));
    for (const c of kids) if (!seen.has(c.id)) hidden += 1 + walk(c, level + 1);
    rows[at] = { type: 'item', item, level, tree: { kids: kids.length, hidden, others: (parents.get(item.id) ?? []).slice(1) } };
    return hidden;
  };
  for (const item of items) if (!parents.get(item.id)!.length) walk(item, 0);
  for (const item of items) if (!seen.has(item.id)) walk(item, 0);
  return rows;
}

/** 같은 열쇠끼리 모은다. 묶음 순서는 처음 나온 순서, 묶음 안은 원래 순서. '없음'(빈 열쇠)은 맨 뒤 */
function groupRows<T>(items: T[], by: (item: T) => { key: string; label: string }[]): Row<T>[] {
  type Tree = { label: string; items: T[]; children: Map<string, Tree> };
  const root: Tree = { label: '', items: [], children: new Map() };
  for (const item of items) {
    let node = root;
    for (const k of by(item)) {
      let child = node.children.get(k.key);
      if (!child) node.children.set(k.key, (child = { label: k.label, items: [], children: new Map() }));
      node = child;
    }
    node.items.push(item);
  }
  const count = (t: Tree): number => t.items.length + [...t.children.values()].reduce((a, c) => a + count(c), 0);
  const rows: Row<T>[] = [];
  const walk = (t: Tree, level: number, path: string) => {
    t.items.forEach((item) => rows.push({ type: 'item', item, level }));
    const kids = [...t.children.entries()].sort(([a], [b]) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0));
    for (const [key, child] of kids) {
      rows.push({ type: 'head', level, label: child.label, count: count(child), key: `${path}/${key}` });
      walk(child, level + 1, `${path}/${key}`);
    }
  };
  walk(root, 0, '');
  return rows;
}

export function Collection<T extends { id: string }>(p: CollectionProps<T>) {
  const [q, setQ] = useState('');
  const prefKey = `group:${p.addLabel ?? 'list'}`;
  const [groupId, setGroupId] = useState(() => prefs.get(prefKey) ?? p.defaultGrouping ?? '');
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const grouping = p.items.length > 6 ? p.groupings?.find((g) => g.id === groupId) : undefined;
  const current = p.items.find((x) => x.id === p.selected) ?? p.items[0];
  const shown = q ? p.items.filter((x) => (p.search ? p.search(x) : x.id).toLowerCase().includes(q.toLowerCase())) : p.items;
  const tree = grouping?.parents;
  const rows: Row<T>[] = grouping
    ? tree
      ? treeRows(shown, tree, grouping?.childOrder)
      : groupRows(shown, grouping.by ?? (() => []))
    : shown.map((item) => ({ type: 'item', item, level: 0 }));
  const toggle = (key: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // 접힌 묶음(트리에서는 접힌 항목) 아래는 숨긴다
  const visible: Row<T>[] = [];
  let hideBelow = Infinity;
  for (const r of rows) {
    if (r.level >= hideBelow) continue;
    hideBelow = Infinity;
    visible.push(r);
    if (r.type === 'head' && folded.has(r.key)) hideBelow = r.level + 1;
    if (r.type === 'item' && r.tree?.kids && folded.has(`t:${r.item.id}`)) hideBelow = r.level + 1;
  }

  return (
    <div className="collection">
      <div className="collection-list">
        <div className="collection-tools">
          <button className="btn primary small" onClick={p.onAdd}>
            ＋ {p.addLabel ?? '추가'}
          </button>
          {p.items.length > 8 && <input className="search" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />}
        </div>
        {p.groupings && p.items.length > 6 && (
          <div className="collection-group">
            <span>묶어 보기</span>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setFolded(new Set());
                prefs.set(prefKey, e.target.value);
              }}
            >
              <option value="">순서대로</option>
              {p.groupings.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {p.toolbar}
        <ul>
          {visible.map((r) => {
            if (r.type === 'head')
              return (
                <li
                  key={r.key}
                  className={`group-head level-${r.level}`}
                  onClick={() => toggle(r.key)}
                >
                  <span className="fold">{folded.has(r.key) ? '▸' : '▾'}</span>
                  <span className="group-label">{r.label}</span>
                  <span className="group-count">{r.count}</span>
                </li>
              );
            const item = r.item;
            const index = p.items.indexOf(item);
            return (
              <li
                key={item.id}
                className={`${item === current ? 'active' : ''} ${tree ? (r.level ? 'tree-child' : 'tree-root') : r.level ? `indent-${Math.min(r.level, 2)}` : ''}`}
                style={tree && r.level ? { marginLeft: 6 + Math.min(r.level, 5) * 9 } : undefined}
                onClick={() => p.onSelect(item.id)}
              >
                <div className="li-main">
                  {tree && (
                    <span
                      className={`tree-fold ${r.tree?.kids ? 'on' : ''}`}
                      title={r.tree?.kids ? (folded.has(`t:${item.id}`) ? '이어지는 장면 펼치기' : '이어지는 장면 접기') : undefined}
                      onClick={(e) => {
                        if (!r.tree?.kids) return;
                        e.stopPropagation();
                        toggle(`t:${item.id}`);
                      }}
                    >
                      {r.tree?.kids ? (folded.has(`t:${item.id}`) ? '▸' : '▾') : ''}
                    </span>
                  )}
                  <span className="li-label">{p.label(item)}</span>
                  {tree && r.tree && folded.has(`t:${item.id}`) && r.tree.hidden > 0 && <span className="tree-count">+{r.tree.hidden}</span>}
                  {tree && r.tree && r.tree.others.length > 0 && (
                    <span className="tree-also" title={`다른 곳에서도 이어짐: ${r.tree.others.map((o) => grouping?.name?.(o) ?? o.id).join(', ')}`}>
                      ↩ +{r.tree.others.length}
                    </span>
                  )}
                  {p.badge?.(item)}
                </div>
                {p.sub && (() => {
                  const sub = p.sub(item, { hasParent: !!tree && r.level > 0 });
                  return sub ? <div className={`li-sub ${tree ? 'in-tree' : ''}`}>{sub}</div> : null;
                })()}
                {item === current && (
                  <div className="li-tools" onClick={(e) => e.stopPropagation()}>
                    {p.onMove && !grouping && (
                      <>
                        <button className="icon" title="위로" disabled={index === 0} onClick={() => p.onMove!(index, index - 1)}>
                          ↑
                        </button>
                        <button className="icon" title="아래로" disabled={index === p.items.length - 1} onClick={() => p.onMove!(index, index + 1)}>
                          ↓
                        </button>
                      </>
                    )}
                    {p.onDuplicate && (
                      <button className="icon" title="복제" onClick={() => p.onDuplicate!(item.id)}>
                        ⧉
                      </button>
                    )}
                    <button
                      className="icon danger"
                      title="삭제"
                      onClick={async () => {
                        if (await ask(`'${item.id}'을(를) 삭제할까요? (Ctrl+Z로 되돌릴 수 있습니다)`, '삭제', true)) p.onRemove(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {grouping && p.onMove && <p className="group-note">순서를 바꾸려면 '순서대로' 보기로 돌아가세요.</p>}
      </div>
      <div key={current?.id} className="collection-detail">{current ? p.children(current) : (p.empty ?? <p className="muted">항목이 없습니다. 왼쪽 위에서 추가하세요.</p>)}</div>
    </div>
  );
}
