// 에디터 입력 컴포넌트. 수식·본문 입력은 그 자리에서 문법과 참조를 검사한다.

import { PURE_FUNCTIONS, STATE_FUNCTIONS, SYSTEM_VALUES, collectRefs, parseExpr, templateExprs, templateImages, type StoryPackage } from '@engine';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { eventLabel, hasEventId } from '../lib/labels';
import { useEditor } from './context';
import { useTemplateComplete } from './TemplateComplete';

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">
        {label}
        {hint && <Tip>{hint}</Tip>}
      </span>
      {children}
    </label>
  );
}

/** 마우스를 올리거나 눌렀을 때만 보이는 짧은 설명 */
export function Tip({ children }: { children: ReactNode }) {
  return (
    <span className="tip" tabIndex={0} onClick={(e) => e.preventDefault()}>
      ?<span className="tip-body" role="tooltip">
        {children}
      </span>
    </span>
  );
}

/** 자주 쓰지 않는 설정을 접어 둔다. active면 값이 있다는 표시를 하고 펼친 채 시작 */
export function More({ label = '세부 설정', active, children }: { label?: string; active?: boolean; children: ReactNode }) {
  const { detail } = useEditor();
  const [open, setOpen] = useState(!!active || detail);
  useEffect(() => {
    if (detail) setOpen(true);
  }, [detail]);
  return (
    <div className={`more ${open ? 'open' : ''}`}>
      <button type="button" className="more-toggle" onClick={() => setOpen(!open)}>
        <span className="more-arrow">{open ? '▾' : '▸'}</span> {label}
        {active && !open && <span className="more-dot" title="설정한 값이 있습니다" />}
      </button>
      {open && <div className="more-body">{children}</div>}
    </div>
  );
}

/** 도움말의 해당 항목으로 가는 작은 링크 */
export function HelpLink({ topic, children = '도움말' }: { topic: string; children?: ReactNode }) {
  const { open } = useEditor();
  return (
    <button type="button" className="help-link" onClick={() => open('help', topic)}>
      {children}
    </button>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

/** 입력 중에는 로컬 값, 바깥 값이 바뀌면 동기화 */
function useDraft<T>(value: T): [T, (v: T) => void] {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft];
}

export function TextInput({
  value,
  onChange,
  placeholder,
  list,
  mono,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string;
  mono?: boolean;
}) {
  return (
    <input
      className={mono ? 'mono' : undefined}
      value={value ?? ''}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 빈 칸 = undefined */
export function OptText({ value, onChange, placeholder, mono }: { value: string | undefined; onChange: (v: string | undefined) => void; placeholder?: string; mono?: boolean }) {
  return <TextInput value={value} mono={mono} placeholder={placeholder} onChange={(v) => onChange(v === '' ? undefined : v)} />;
}

export function NumInput({
  value,
  onChange,
  placeholder,
  step,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: number;
}) {
  const [draft, setDraft] = useDraft(value === undefined ? '' : String(value));
  return (
    <input
      type="number"
      step={step ?? 'any'}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value === '') onChange(undefined);
        else if (!Number.isNaN(Number(e.target.value))) onChange(Number(e.target.value));
      }}
    />
  );
}

export function Check({ value, onChange, label }: { value: boolean | undefined; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  allowEmpty,
}: {
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  options: (readonly [T, string])[];
  allowEmpty?: string;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
      {value !== undefined && value !== '' && !options.some(([v]) => v === value) && <option value={value}>{value} (없음!)</option>}
    </select>
  );
}

// ───────────────────────── 수식 검사 ─────────────────────────

const KNOWN_FUNCS = new Set([...PURE_FUNCTIONS, ...STATE_FUNCTIONS]);

function localNames(pkg: StoryPackage): Set<string> {
  const names = new Set(SYSTEM_VALUES);
  for (const s of pkg.scripts ?? []) for (const p of s.params ?? []) names.add(p);
  // let으로 만든 이름: 패키지 전체를 훑는 대신 JSON 문자열에서 찾는다(가벼움)
  const json = JSON.stringify(pkg);
  for (const m of json.matchAll(/"do":"let","name":"([^"]+)"/g)) names.add(m[1]);
  return names;
}

let cacheKey: StoryPackage | undefined;
let cacheLocals = new Set<string>();

export function checkExpr(src: string, pkg: StoryPackage): string | undefined {
  if (!src.trim()) return undefined;
  try {
    const refs = collectRefs(parseExpr(src));
    const vars = new Set(pkg.variables.map((v) => v.id));
    if (cacheKey !== pkg) {
      cacheKey = pkg;
      cacheLocals = localNames(pkg);
    }
    for (const v of refs.vars) if (!vars.has(v)) return `선언되지 않은 변수 '${v}'`;
    for (const s of refs.sys) if (!cacheLocals.has(s)) return `알 수 없는 값 '$${s}'`;
    for (const c of refs.calls) if (!KNOWN_FUNCS.has(c.fn)) return `알 수 없는 함수 '${c.fn}()'`;
    return undefined;
  } catch (e) {
    return (e as Error).message;
  }
}

/** images: 본문 칸이면 true. 제목·선택지 같은 칸에서 {image …}를 쓰면 오류로 알린다 */
export function checkTemplate(src: string, pkg: StoryPackage, images = false): string | undefined {
  try {
    for (const e of templateExprs(src)) {
      const err = checkExpr(e, pkg);
      if (err) return `{${e}}: ${err}`;
    }
    for (const id of templateImages(src)) {
      if (!images) return '이미지({image …})는 본문 글에서만 넣을 수 있어요';
      if (!(pkg.assets ?? []).some((a) => a.id === id)) return `없는 이미지 '${id}' — 이미지 메뉴에서 올려 주세요`;
    }
    return undefined;
  } catch (e) {
    return (e as Error).message;
  }
}

/** 수식 입력(조건·수치). numeric이면 숫자만 쓴 경우 number로 저장 */
export function ExprInput({
  value,
  onChange,
  placeholder,
  numeric,
}: {
  value: string | number | boolean | undefined;
  onChange: (v: string | number | undefined) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  const { pkg } = useEditor();
  // 입력하는 동안은 친 그대로 둔다('-'만 친 상태, 잠깐 비운 상태 등). 칸을 벗어나면 저장된 값으로 맞춘다
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === undefined ? '' : String(value));
  const error = draft !== null ? (draft.trim() && !(numeric && /^-?\d*\.?\d*$/.test(draft.trim())) ? checkExpr(draft, pkg) : undefined) : typeof value === 'string' ? checkExpr(value, pkg) : undefined;
  const id = useId();
  return (
    <span className="expr">
      <input
        className={`mono ${error ? 'invalid' : ''}`}
        value={text}
        placeholder={placeholder}
        list={`${id}-vars`}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          if (v.trim() === '') onChange(undefined);
          else if (numeric && /^-?\d+(\.\d+)?$/.test(v.trim())) onChange(Number(v));
          else if (numeric && /^-?\.?$/.test(v.trim())) return; // '-'만 친 상태: 숫자를 마저 칠 때까지 기다린다
          else onChange(v);
        }}
      />
      <datalist id={`${id}-vars`}>
        {pkg.variables.map((v) => (
          <option key={v.id} value={v.id} />
        ))}
      </datalist>
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}

export function TemplateArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  rows?: number;
  placeholder?: string;
}) {
  const { pkg, open } = useEditor();
  const error = value ? checkTemplate(value, pkg, true) : undefined;
  // 글이 길어지면 칸도 따라 늘어난다(rows는 최소 높이)
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }, [value]);
  const complete = useTemplateComplete(ref, value ?? '', (v) => onChange(v === '' ? undefined : v), true);
  const assets = pkg.assets ?? [];
  /** 커서 자리에 {image 이미지ID}를 넣는다 */
  const insertImage = (id: string) => {
    const el = ref.current;
    const text = value ?? '';
    const at = el?.selectionStart ?? text.length;
    const piece = `{image ${id}}`;
    onChange(text.slice(0, at) + piece + text.slice(at));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + piece.length, at + piece.length);
    });
  };
  return (
    <span className="expr">
      <textarea
        ref={ref}
        className={error ? 'invalid' : undefined}
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        {...complete.props}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : e.target.value);
          complete.refresh(e.target);
        }}
      />
      {complete.popup}
      <span className="insert-image">
        {assets.length > 0 ? (
          <select value="" onChange={(e) => e.target.value && insertImage(e.target.value)} title="글 사이에 그림을 넣습니다. 올린 이미지는 이미지 메뉴에서 관리합니다">
            <option value="">＋ 이미지 넣기…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id}
                {a.alt ? `  — ${a.alt}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <button type="button" className="link small" onClick={() => open('assets')} title="이미지는 이미지 메뉴에서만 올릴 수 있습니다">
            ＋ 글 사이에 이미지 넣기 (먼저 이미지 메뉴에서 올려 주세요)
          </button>
        )}
      </span>
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}

export function TemplateInput({ value, onChange, placeholder }: { value: string | undefined; onChange: (v: string | undefined) => void; placeholder?: string }) {
  const { pkg } = useEditor();
  const error = value ? checkTemplate(value, pkg, false) : undefined;
  const ref = useRef<HTMLInputElement>(null);
  const complete = useTemplateComplete(ref, value ?? '', (v) => onChange(v === '' ? undefined : v));
  return (
    <span className="expr">
      <input
        ref={ref}
        className={error ? 'invalid' : undefined}
        value={value ?? ''}
        placeholder={placeholder}
        {...complete.props}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : e.target.value);
          complete.refresh(e.target);
        }}
      />
      {complete.popup}
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}

/** ID 입력: 글자·숫자·_·.·- 만, 중복 검사 */
export function IdInput({ value, onChange, taken }: { value: string; onChange: (v: string) => void; taken: string[] }) {
  const [draft, setDraft] = useDraft(value);
  const invalid = !draft || /[\s'"{}()]/.test(draft) ? 'ID에는 공백·따옴표·괄호를 쓸 수 없습니다' : taken.includes(draft) && draft !== value ? '이미 있는 ID입니다' : undefined;
  return (
    <span className="expr">
      <input
        className={`mono ${invalid ? 'invalid' : ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!invalid && draft !== value) onChange(draft);
          else setDraft(value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {invalid && <span className="error-text">{invalid}</span>}
      {!invalid && draft !== value && <span className="field-hint">Enter 또는 바깥을 눌러 확정</span>}
    </span>
  );
}

/**
  * 이벤트 ID 입력. 한글·알파벳·숫자·공백·기호 모두 쓸 수 있다(수식·본문 안에서 깨지는 ' " \ { } 만 제외).
 * 비워 두면 자동 ID가 붙고, 화면에서는 제목 → 본문 순으로 부른다.
 */
export function EventIdInput({ value, taken, onCommit }: { value: string; taken: string[]; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useDraft(hasEventId({ id: value }) ? value : '');
  const text = draft.trim();
  const invalid = /['"\\{}]/.test(text)
    ? `ID에는 ' " \\ { } 를 쓸 수 없습니다`
    : text && text !== value && taken.includes(text)
      ? '이미 있는 ID입니다'
      : undefined;
  const shown = hasEventId({ id: value }) ? value : '';
  const commit = () => {
    if (invalid) return setDraft(shown);
    const next = text || (hasEventId({ id: value }) ? uniqueId('event', taken.filter((x) => x !== value)) : value);
    if (next !== value) onCommit(next);
    else setDraft(shown);
  };
  return (
    <span className="expr">
      <input
        className={invalid ? 'invalid' : undefined}
        value={draft}
        placeholder="비워 두면 제목 → 본문 순으로 부릅니다"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {invalid && <span className="error-text">{invalid}</span>}
      {!invalid && text !== shown && <span className="field-hint">Enter 또는 바깥을 눌러 확정</span>}
    </span>
  );
}

/** 쉼표로 구분한 목록 */
export function ListInput({ value, onChange, placeholder }: { value: string[] | undefined; onChange: (v: string[] | undefined) => void; placeholder?: string }) {
  const [draft, setDraft] = useDraft((value ?? []).join(', '));
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        const list = e.target.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onChange(list.length ? list : undefined);
      }}
    />
  );
}

export function EventSelect({ value, onChange, empty = '(없음)' }: { value: string | undefined; onChange: (v: string | undefined) => void; empty?: string }) {
  const { pkg } = useEditor();
  return (
    <Select
      value={value}
      onChange={onChange}
      allowEmpty={empty}
      options={pkg.events.map((e) => [e.id, eventLabel(e)] as const)}
    />
  );
}

export function AssetSelect({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const { pkg } = useEditor();
  const src = value ? pkg.assets?.find((a) => a.id === value)?.src : undefined;
  return (
    <span className="asset-select">
      <Select value={value} onChange={onChange} allowEmpty="(이미지 없음)" options={(pkg.assets ?? []).map((a) => [a.id, a.alt ? `${a.alt} (${a.id})` : a.id] as const)} />
      {src && <img src={src} alt="" />}
    </span>
  );
}

export function Section({ title, children, actions, help, topic }: { title: string; children: ReactNode; actions?: ReactNode; help?: ReactNode; topic?: string }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          {title}
          {topic ? <HelpLink topic={topic} /> : help && <Tip>{help}</Tip>}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** 화면 맨 위의 한 줄 안내 + 도움말 링크 */
export function Intro({ children, topic }: { children: ReactNode; topic?: string }) {
  return (
    <p className="intro">
      {children}
      {topic && <HelpLink topic={topic}>자세히</HelpLink>}
    </p>
  );
}

/** 목록 항목 조작 버튼(위/아래/복제/삭제) */
export function ItemTools({
  index,
  length,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (to: number) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="item-tools">
      <button type="button" className="icon" title="위로" disabled={index === 0} onClick={() => onMove(index - 1)}>
        ↑
      </button>
      <button type="button" className="icon" title="아래로" disabled={index === length - 1} onClick={() => onMove(index + 1)}>
        ↓
      </button>
      {onDuplicate && (
        <button type="button" className="icon" title="복제" onClick={onDuplicate}>
          ⧉
        </button>
      )}
      <button type="button" className="icon danger" title="삭제" onClick={onRemove}>
        ✕
      </button>
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number): void {
  if (to < 0 || to >= list.length) return;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
}

export function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}_${i}`)) return `${base}_${i}`;
}

/**
 * 구간별 문구 목록: "[ ]부터/이하/미만 … [문구]" 한 줄씩. 값이 작은 구간부터 차례로 맞춰 둔다.
 * 변수의 구간별 문구(이하)와 판정 확률 이름(미만)에 같이 쓴다.
 */
export function ThresholdList({
  value,
  onChange,
  before,
  after,
  textPlaceholder,
  defaults,
}: {
  value: { n: number; text: string }[] | undefined;
  onChange: (next: { n: number; text: string }[] | undefined) => void;
  /** 숫자 앞 말 (예: '값이') */
  before: string;
  /** 숫자 뒤 말 (예: '이하이면') */
  after: string;
  textPlaceholder?: string;
  /** 비어 있을 때 '기본값에서 시작'으로 채울 목록 */
  defaults?: { n: number; text: string }[];
}) {
  const list = value ?? [];
  const write = (next: { n: number; text: string }[]) => onChange(next.length ? next : undefined);
  const sorted = (xs: { n: number; text: string }[]) => [...xs].sort((a, b) => a.n - b.n);
  const unordered = list.some((x, i) => i > 0 && x.n < list[i - 1].n);
  return (
    <div className="threshold-list">
      {list.map((row, i) => (
        <div key={i} className="sentence small-input">
          <span>{before}</span>
          <NumInput value={row.n} onChange={(n) => write(list.map((x, j) => (j === i ? { ...x, n: n ?? 0 } : x)))} />
          <span>{after}</span>
          <input className="grow" value={row.text} placeholder={textPlaceholder} onChange={(e) => write(list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="icon danger" title="이 구간 지우기" onClick={() => write(list.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="threshold-actions">
        <button type="button" className="btn small" onClick={() => write(sorted([...list, { n: (list[list.length - 1]?.n ?? 0) + 1, text: '' }]))}>
          ＋ 구간 추가
        </button>
        {!list.length && defaults && (
          <button type="button" className="link small" onClick={() => write(defaults.map((x) => ({ ...x })))}>
            기본값에서 시작
          </button>
        )}
        {unordered && (
          <button type="button" className="link small" onClick={() => write(sorted(list))}>
            작은 값부터 차례로 정렬
          </button>
        )}
      </div>
    </div>
  );
}
