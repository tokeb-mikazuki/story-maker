// 이벤트 고르기: 아직 도달 경로가 없는 이벤트를 먼저 보여 주고, '다른 이벤트…'로 전체 검색 창을 연다.

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { eventLabel, hasEventId } from '../lib/labels';
import { unreachedEvents } from '../lib/links';
import { useEditor } from './context';

const MORE = '\u0000more';

export function EventPicker({ value, onChange, empty = '(없음)' }: { value: string | undefined; onChange: (v: string | undefined) => void; empty?: string }) {
  const { pkg } = useEditor();
  const [searching, setSearching] = useState(false);
  const unreached = useMemo(() => unreachedEvents(pkg), [pkg]);
  // 지금 고른 이벤트가 위 목록에 없어도 선택 칸에는 보여야 한다
  const current = value ? pkg.events.find((e) => e.id === value) : undefined;
  const extra = value && !unreached.some((e) => e.id === value);
  return (
    <>
      <select
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === MORE) setSearching(true);
          else onChange(e.target.value || undefined);
        }}
      >
        <option value="">{empty}</option>
        {extra && <option value={value}>{current ? eventLabel(current) : `${value} (없음!)`}</option>}
        {/* 평소대로 | 아직 이어지지 않은 이벤트 | 다른 이벤트… 를 선으로 구분 */}
        {unreached.length > 0 && <hr />}
        {unreached.map((e) => (
          <option key={e.id} value={e.id}>
            {eventLabel(e)}
          </option>
        ))}
        <hr />
        <option value={MORE}>다른 이벤트…</option>
      </select>
      {searching && (
        <PickerModal
          value={value}
          onClose={() => setSearching(false)}
          onPick={(id) => {
            setSearching(false);
            onChange(id);
          }}
        />
      )}
    </>
  );
}

function PickerModal({ value, onClose, onPick }: { value: string | undefined; onClose: () => void; onPick: (id: string) => void }) {
  const { pkg } = useEditor();
  const [q, setQ] = useState('');
  const unreachedList = useMemo(() => unreachedEvents(pkg), [pkg]);
  const unreached = useMemo(() => new Set(unreachedList.map((e) => e.id)), [unreachedList]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const needle = q.trim().toLowerCase();
  const matches = (e: (typeof pkg.events)[number]) => `${e.id}\n${e.title ?? ''}\n${e.text}`.toLowerCase().includes(needle);
  // 이어지지 않은 이벤트가 맨 위. 나머지는 숨겨 두었다가 검색어가 있을 때 맞는 것만 그 뒤에 나온다
  const found = needle
    ? [...unreachedList.filter(matches), ...pkg.events.filter((e) => !unreached.has(e.id) && matches(e))]
    : unreachedList;
  const snippet = (text: string) => {
    const t = text.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  };
  const row = (e: (typeof pkg.events)[number]): ReactNode => (
    <li key={e.id}>
      <button type="button" className={`picker-item ${e.id === value ? 'current' : ''}`} onClick={() => onPick(e.id)}>
        <span className="picker-main">
          <strong>{eventLabel(e)}</strong>
          {unreached.has(e.id) && <span className="picker-badge">이어지지 않음</span>}
        </span>
        <span className="picker-sub">{[hasEventId(e) ? e.title : undefined, snippet(e.text)].filter(Boolean).join(' · ')}</span>
      </button>
    </li>
  );
  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog picker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>이벤트 찾기</h3>
        <input ref={input} className="picker-search" placeholder="ID, 제목, 본문으로 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="picker-list">
          {found.map(row)}
          {!found.length && <li className="muted picker-none">{needle ? '찾는 이벤트가 없습니다.' : '이어지지 않은 이벤트가 없습니다.'}</li>}
          {!needle && <li className="muted small picker-none">다른 이벤트는 ID, 제목, 본문으로 검색하면 나타납니다.</li>}
        </ul>
        <div className="dialog-actions">
          <span className="muted small picker-count">
            {needle ? `${found.length} / ${pkg.events.length}` : `이어지지 않음 ${unreachedList.length}`}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
