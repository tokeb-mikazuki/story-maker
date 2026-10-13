// 집필 모드: 다른 메뉴를 가리고 이벤트의 제목·본문·선택지 문구만 원고지처럼 크게 펼쳐 쓴다.
// 맨 위 검색창에 단어를 적으면 제목·본문·선택지에서 찾아 목록으로 보여 주고, 골라서 바로 그 장면으로 건너간다.

import type { EventDef } from '@engine';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { eventLabel, hasEventId } from '../lib/labels';
import { canAddChoice } from '../lib/limits';
import { useEditor } from './context';
import { checkTemplate } from './fields';

const MAX_RESULTS = 40;

interface Hit {
  event: EventDef;
  snippet: ReactNode;
}

/** 찾는 단어를 노란 표시로 강조 */
function highlight(text: string, terms: string[]): ReactNode {
  const lower = text.toLowerCase();
  const spans: [number, number][] = [];
  for (const t of terms) {
    for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + t.length)) spans.push([i, i + t.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let at = 0;
  for (const [s, e] of spans) {
    if (s < at) continue;
    if (s > at) out.push(text.slice(at, s));
    out.push(<mark key={s}>{text.slice(s, e)}</mark>);
    at = e;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** 단어가 처음 나오는 자리 둘레만 잘라 보여 준다 */
function excerpt(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, ' ');
  const lower = flat.toLowerCase();
  const first = Math.min(...terms.map((t) => (lower.indexOf(t) < 0 ? Infinity : lower.indexOf(t))));
  if (!Number.isFinite(first)) return flat.slice(0, 60);
  const from = Math.max(0, first - 18);
  return (from > 0 ? '…' : '') + flat.slice(from, from + 70) + (from + 70 < flat.length ? '…' : '');
}

function search(events: EventDef[], query: string): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const e of events) {
    // 어디에서 찾았는지 보여 주려고 칸을 나눠 둔다(제목 → 선택지 → 본문 → 이름 순으로 보여 줌)
    const fields: [string, string][] = [
      ['제목', e.title ?? ''],
      ...e.choices.map((c) => ['선택지', c.text] as [string, string]),
      ['본문', e.text],
      ['이름', e.id],
    ];
    const all = fields.map((f) => f[1]).join('\n').toLowerCase();
    if (!terms.every((t) => all.includes(t))) continue;
    const shown = fields.find(([, v]) => terms.some((t) => v.toLowerCase().includes(t)));
    const snippet = shown ? (
      <>
        <b>{shown[0]}</b> {highlight(excerpt(shown[1], terms), terms)}
      </>
    ) : null;
    hits.push({ event: e, snippet });
    if (hits.length >= MAX_RESULTS) break;
  }
  return hits;
}

export function Manuscript({ eventId, onClose, onNavigate }: { eventId: string; onClose: () => void; onNavigate: (id: string) => void }) {
  const { pkg, update } = useEditor();
  const index = pkg.events.findIndex((e) => e.id === eventId);
  const e = pkg.events[index];
  const body = useRef<HTMLTextAreaElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const edit = (fn: (x: NonNullable<typeof e>) => void) => update((d) => fn(d.events.find((x) => x.id === eventId)!));

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const hits = useMemo(() => search(pkg.events, query), [pkg.events, query]);
  const open = query.trim() !== '';
  const queryRef = useRef(query);
  queryRef.current = query;

  // 화살표로 고르는 항목이 목록 밖으로 나가지 않게
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        // 검색 중이면 먼저 검색창부터 비운다
        if (queryRef.current) {
          setQuery('');
          return;
        }
        onClose();
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') {
        ev.preventDefault();
        searchBox.current?.focus();
        searchBox.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 장면을 열면 커서를 본문 끝에 둔다(이어 쓰기)
  useEffect(() => {
    const t = body.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }, [eventId]);

  // 본문 길이에 맞춰 칸을 늘린다
  useEffect(() => {
    const t = body.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.max(t.scrollHeight, 320)}px`;
  }, [e?.text]);

  if (!e) return null;
  const prev = pkg.events[index - 1];
  const next = pkg.events[index + 1];
  const error = e.text ? checkTemplate(e.text, pkg) : undefined;

  const pick = (id: string) => {
    setQuery('');
    setCursor(0);
    onNavigate(id);
  };

  return (
    <div className="manuscript-overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="manuscript-head">
        <div className="manuscript-search">
          <input
            ref={searchBox}
            value={query}
            placeholder="장면 찾기 — 제목·본문·선택지에 있는 단어를 적어 보세요 (Ctrl+F)"
            onChange={(ev) => (setQuery(ev.target.value), setCursor(0))}
            onKeyDown={(ev) => {
              if (!open) return;
              if (ev.key === 'ArrowDown') (ev.preventDefault(), setCursor((c) => Math.min(c + 1, hits.length - 1)));
              else if (ev.key === 'ArrowUp') (ev.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
              else if (ev.key === 'Enter' && hits[cursor]) (ev.preventDefault(), pick(hits[cursor].event.id));
            }}
          />
          {open && (
            <ul className="manuscript-results" ref={list}>
              {hits.length === 0 && <li className="r-empty">찾는 장면이 없습니다.</li>}
              {hits.map((h, i) => (
                <li
                  key={h.event.id}
                  className={`${i === cursor ? 'on' : ''} ${h.event.id === eventId ? 'current' : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(ev) => (ev.preventDefault(), pick(h.event.id))}
                >
                  <span className="r-title">{eventLabel(h.event)}</span>
                  {h.event.ages && (
                    <span className="r-meta">
                      {h.event.ages[0]}~{h.event.ages[1]}세
                    </span>
                  )}
                  <span className="r-snip">{h.snippet}</span>
                </li>
              ))}
              {hits.length >= MAX_RESULTS && <li className="r-empty">앞의 {MAX_RESULTS}개만 보입니다. 단어를 더 적어 좁혀 보세요.</li>}
            </ul>
          )}
        </div>
        <div className="manuscript-bar">
          <span className="manuscript-label">집필 모드</span>
          <button type="button" className="link" disabled={!prev} onClick={() => prev && onNavigate(prev.id)}>
            ← {prev ? eventLabel(prev) : '처음'}
          </button>
          <span className="muted small">
            {index + 1} / {pkg.events.length}
          </span>
          <button type="button" className="link" disabled={!next} onClick={() => next && onNavigate(next.id)}>
            {next ? eventLabel(next) : '끝'} →
          </button>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={onClose}>
            닫기 (Esc)
          </button>
        </div>
      </div>
      <div className="manuscript-sheet">
        {hasEventId(e) && <div className="manuscript-id">ID · {e.id}</div>}
        <input className="manuscript-title" value={e.title ?? ''} placeholder="제목 (선택 — 비워 두면 제목 없이 나옵니다)" onChange={(ev) => edit((x) => void (x.title = ev.target.value || undefined))} />
        <textarea
          ref={body}
          className={`manuscript-body ${error ? 'invalid' : ''}`}
          value={e.text}
          placeholder="여기에 장면을 씁니다…"
          onChange={(ev) => edit((x) => void (x.text = ev.target.value))}
        />
        {error && <p className="error-text">{error}</p>}
        <div className="manuscript-choices">
          {e.choices.map((c, i) => (
            <div key={i} className="manuscript-choice">
              <span className="manuscript-choice-no">{i + 1}</span>
              <input value={c.text} placeholder="선택지 문구" onChange={(ev) => edit((x) => void (x.choices[i].text = ev.target.value))} />
            </div>
          ))}
          <button type="button" className="link" onClick={async () => (await canAddChoice(e.choices.length)) && edit((x) => void x.choices.push({ text: '', outcome: {} }))}>
            ＋ 선택지
          </button>
        </div>
        <div className="manuscript-foot">
          <span>본문 {e.text.replace(/\s/g, '').length.toLocaleString('ko-KR')}자</span>
          <span>결과·조건·효과는 집필 모드를 닫고 편집 화면에서 정합니다.</span>
        </div>
      </div>
    </div>
  );
}
