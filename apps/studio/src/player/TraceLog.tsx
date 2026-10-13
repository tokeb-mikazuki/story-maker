// 테스트 플레이 진행 로그: 확률 추첨·판정 굴림·값 변화·장면 흐름을 턴별로 보여 준다.

import type { TraceEntry, TraceKind } from '@engine';
import { useEffect, useRef, useState } from 'react';

const ICON: Record<TraceKind, string> = {
  roll: '🎲',
  pick: '🎯',
  var: '±',
  item: '◆',
  status: '◎',
  tag: '#',
  rule: '⚙',
  scene: '▶',
  choice: '☞',
  stage: '◈',
  turn: '⏱',
  end: '■',
  achieve: '★',
};

const FILTERS: [string, string, TraceKind[] | undefined][] = [
  ['all', '전체', undefined],
  ['chance', '확률', ['roll', 'pick']],
  ['values', '값 변화', ['var', 'item', 'status', 'tag']],
  ['flow', '흐름', ['scene', 'choice', 'stage', 'turn', 'end', 'achieve', 'rule']],
];

export function TraceLog({ entries, onClear }: { entries: TraceEntry[]; onClear: () => void }) {
  const [filter, setFilter] = useState('all');
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const kinds = FILTERS.find((f) => f[0] === filter)?.[2];
  const shown = kinds ? entries.filter((e) => kinds.includes(e.kind)) : entries;

  // 맨 아래를 보고 있으면 새 줄을 따라간다
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, filter]);

  let lastTurn = -1;
  return (
    <div className="trace">
      <div className="trace-bar">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button type="button" className="link" onClick={onClear} title="지금까지의 로그 지우기">
          지우기
        </button>
      </div>
      <div
        className="trace-list"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
        }}
      >
        {shown.length === 0 && <p className="muted small">아직 기록이 없습니다.</p>}
        {shown.map((e, i) => {
          const head = e.turn !== lastTurn;
          lastTurn = e.turn;
          return (
            <div key={i}>
              {head && (
                <div className="trace-turn">
                  {e.turn + 1}번째 턴{e.when ? ` · ${e.when}` : ''}
                </div>
              )}
              <div className={`trace-row k-${e.kind}`}>
                <span className="trace-icon">{ICON[e.kind]}</span>
                <span className="trace-text">
                  {e.text}
                  {e.detail && <span className="trace-detail">{e.detail}</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
