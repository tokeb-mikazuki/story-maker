// 조건 블록 편집기. 수식 문자열을 트리로 읽어 블록으로 보여 주고,
// 고치면 다시 수식으로 저장한다. 블록으로 나타낼 수 없는 부분은 '수식' 블록으로 남긴다.

import type { Node, StoryPackage } from '@engine';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { flatten, join, printExpr, tryParse } from '../lib/exprPrint';
import { eventLabel } from '../lib/labels';
import { useEditor } from './context';
import { ExprInput, checkExpr } from './fields';

// ───────────────────────── 판단 블록 종류 ─────────────────────────

export interface CondTemplate {
  id: string;
  label: string;
  make: () => Node;
}

const lit = (v: number | string | boolean): Node => ({ k: 'lit', v });
const call = (fn: string, ...args: Node[]): Node => ({ k: 'call', fn, args });

export function condTemplates(pkg: StoryPackage): CondTemplate[] {
  const firstVar = pkg.variables.find((v) => v.type === 'number')?.id ?? pkg.variables[0]?.id;
  const list: CondTemplate[] = [];
  if (firstVar) list.push({ id: 'cmp', label: '변수 비교 (체력 ≥ 3)', make: () => ({ k: 'bin', op: '>=', a: { k: 'var', name: firstVar }, b: lit(1) }) });
  if (pkg.settings.calendar.unit !== 'none') list.push({ id: 'age', label: '나이 비교', make: () => ({ k: 'bin', op: '>=', a: { k: 'sys', name: '나이' }, b: lit(20) }) });
  list.push({ id: 'has', label: '태그가 있음', make: () => call('has', lit('')) });
  if (pkg.items?.length) list.push({ id: 'item', label: '아이템을 가지고 있음', make: () => call('item', lit(pkg.items![0].id)) });
  if (pkg.statuses?.length) list.push({ id: 'status', label: '상태에 걸려 있음', make: () => call('status', lit(pkg.statuses![0].id)) });
  if (pkg.events.length) list.push({ id: 'seen', label: '이벤트를 겪었음', make: () => call('seen', lit(pkg.events[0].id)) });
  list.push({ id: 'chance', label: '확률 (30%)', make: () => call('chance', lit(30)) });
  if (pkg.achievements?.length) list.push({ id: 'achieved', label: '도전과제를 달성함', make: () => call('achieved', lit(pkg.achievements![0].id)) });
  list.push({ id: 'true', label: '참 / 거짓', make: () => lit(true) });
  list.push({ id: 'raw', label: '수식 직접 쓰기', make: () => ({ k: 'var', name: '__raw__' }) });
  return list;
}

/** '수식 직접 쓰기' 자리표시 */
const isRawPlaceholder = (n: Node) => n.k === 'var' && n.name === '__raw__';

// ───────────────────────── 조건 입력 ─────────────────────────

/** ExprInput 대신 쓰는 조건 입력. 블록 ⇄ 수식 전환 가능 */
export function CondInput({ value, onChange, placeholder = '조건 없음 (항상)' }: { value: string | undefined; onChange: (v: string | undefined) => void; placeholder?: string }) {
  const node = tryParse(value);
  const broken = !!value?.trim() && !node;
  const [text, setText] = useState(broken);
  const [rawStart, setRawStart] = useState(false);
  useEffect(() => {
    if (broken) setText(true);
  }, [broken]);

  const set = (n: Node | undefined) => {
    if (n && containsRaw(n)) {
      // '수식 직접 쓰기'를 고르면 수식 입력으로 넘어간다
      const rest = removeRaw(n);
      onChange(rest ? printExpr(rest) : undefined);
      setRawStart(true);
      setText(true);
      return;
    }
    onChange(n ? printExpr(n) : undefined);
  };

  return (
    <span className="cond-input">
      {text ? (
        <span className="cond-text">
          <ExprInput value={value} onChange={(v) => onChange(v as string | undefined)} placeholder={rawStart ? "예: 체력 >= 3 and has('열쇠')" : placeholder} />
        </span>
      ) : (
        <CondSlot node={node} onChange={set} placeholder={placeholder} root />
      )}
      <button
        type="button"
        className="cond-mode"
        title={text ? '블록으로 보기' : '식으로 직접 쓰기'}
        disabled={text && broken}
        onClick={() => (setText(!text), setRawStart(false))}
      >
        {text ? '◇' : 'ƒ'}
      </button>
    </span>
  );
}

function containsRaw(n: Node): boolean {
  if (isRawPlaceholder(n)) return true;
  if (n.k === 'bin') return containsRaw(n.a) || containsRaw(n.b);
  if (n.k === 'un') return containsRaw(n.a);
  return false;
}

function removeRaw(n: Node): Node | undefined {
  if (isRawPlaceholder(n)) return undefined;
  if (n.k === 'bin' && (n.op === '&&' || n.op === '||')) return join(flatten(n, n.op).map(removeRaw).filter((x): x is Node => !!x), n.op);
  if (n.k === 'un' && n.op === 'not') {
    const a = removeRaw(n.a);
    return a && { ...n, a };
  }
  return n;
}

/** 비어 있으면 조건을 고르는 칸, 차 있으면 조건 블록 */
function CondSlot({ node, onChange, placeholder }: { node: Node | undefined; onChange: (n: Node | undefined) => void; placeholder?: string; root?: boolean }) {
  const { pkg } = useEditor();
  if (!node)
    return (
      <span className="cslot empty">
        <CondMenu label={placeholder ?? '조건'} onPick={(n) => onChange(n)} pkg={pkg} />
      </span>
    );
  return (
    <span className="cslot">
      <CondBlock node={node} onChange={onChange} />
    </span>
  );
}

/** 판단 블록을 고르는 작은 메뉴 */
function CondMenu({ label, onPick, pkg, compact }: { label: string; onPick: (n: Node) => void; pkg: StoryPackage; compact?: boolean }) {
  return (
    <select
      className={`cond-menu ${compact ? 'compact' : ''}`}
      value=""
      title="조건 블록 끼우기"
      onChange={(e) => {
        const t = condTemplates(pkg).find((x) => x.id === e.target.value);
        if (t) onPick(t.make());
      }}
    >
      <option value="">{label}</option>
      {condTemplates(pkg).map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

const CMP_OPS: [string, string][] = [
  ['==', '='],
  ['!=', '≠'],
  ['>=', '≥'],
  ['>', '>'],
  ['<=', '≤'],
  ['<', '<'],
];

function Hex({ kind, children, onRemove, onNot }: { kind: string; children: ReactNode; onRemove?: () => void; onNot?: () => void }) {
  return (
    <span className={`cblock ${kind}`}>
      {children}
      {(onNot || onRemove) && (
        <span className="cblock-tools">
          {onNot && (
            <button type="button" title="반대로 (~이 아님)" onClick={onNot}>
              ¬
            </button>
          )}
          {onRemove && (
            <button type="button" title="이 조건 빼기" onClick={onRemove}>
              ✕
            </button>
          )}
        </span>
      )}
    </span>
  );
}

function CondBlock({ node, onChange }: { node: Node; onChange: (n: Node | undefined) => void }) {
  const { pkg } = useEditor();
  const remove = () => onChange(undefined);
  const negate = () => onChange(node.k === 'un' && node.op === 'not' ? node.a : { k: 'un', op: 'not', a: node });

  // 그리고 / 또는 사슬
  if (node.k === 'bin' && (node.op === '&&' || node.op === '||')) {
    const op = node.op;
    const parts = flatten(node, op);
    const setPart = (i: number, n: Node | undefined) => {
      const next = [...parts];
      if (n) next[i] = n;
      else next.splice(i, 1);
      onChange(join(next, op));
    };
    return (
      <Hex kind="logic" onRemove={remove} onNot={negate}>
        {parts.map((p, i) => (
          <span key={i} className="logic-part">
            {i > 0 && (
              <select className="logic-op" value={op} onChange={(e) => onChange(join(parts, e.target.value as '&&' | '||'))}>
                <option value="&&">그리고</option>
                <option value="||">또는</option>
              </select>
            )}
            <CondBlock node={p} onChange={(n) => setPart(i, n)} />
          </span>
        ))}
        <CondMenu label="＋" compact pkg={pkg} onPick={(n) => onChange(join([...parts, n], op))} />
      </Hex>
    );
  }

  if (node.k === 'un' && node.op === 'not')
    return (
      <Hex kind="not" onRemove={remove}>
        <CondBlock node={node.a} onChange={(n) => onChange(n && { ...node, a: n })} />
        <span className="cword">이(가) 아님</span>
        <button type="button" className="cword-btn" title="'아님' 떼기" onClick={() => onChange(node.a)}>
          ↺
        </button>
      </Hex>
    );

  const more = <CondMenu label="＋" compact pkg={pkg} onPick={(n) => onChange(join([node, n], '&&'))} />;

  if (node.k === 'bin' && CMP_OPS.some(([o]) => o === node.op))
    return (
      <Hex kind="cmp" onRemove={remove} onNot={negate}>
        <ValueSlot node={node.a} onChange={(a) => onChange({ ...node, a })} />
        <select className="cmp-op" value={node.op} onChange={(e) => onChange({ ...node, op: e.target.value })}>
          {CMP_OPS.map(([o, l]) => (
            <option key={o} value={o}>
              {l}
            </option>
          ))}
        </select>
        <ValueSlot node={node.b} onChange={(b) => onChange({ ...node, b })} />
        {more}
      </Hex>
    );

  if (node.k === 'call' && node.args[0]?.k === 'lit') {
    const id = String(node.args[0].v);
    const setId = (v: string) => onChange({ ...node, args: [lit(v), ...node.args.slice(1)] });
    switch (node.fn) {
      case 'has':
        return (
          <Hex kind="fact" onRemove={remove} onNot={negate}>
            <span className="cword">태그</span>
            <PillText value={id} onChange={setId} placeholder="키" />
            {node.args[1] && (
              <>
                <span className="cword">=</span>
                <ValueSlot node={node.args[1]} onChange={(v) => onChange({ ...node, args: [node.args[0], v] })} />
              </>
            )}
            <span className="cword">있음</span>
            {more}
          </Hex>
        );
      case 'item':
        return (
          <Hex kind="fact" onRemove={remove} onNot={negate}>
            <PillSelect value={id} onChange={setId} options={(pkg.items ?? []).map((i) => [i.id, i.name])} />
            <span className="cword">가지고 있음</span>
            {more}
          </Hex>
        );
      case 'status':
        return (
          <Hex kind="fact" onRemove={remove} onNot={negate}>
            <span className="cword">상태</span>
            <PillSelect value={id} onChange={setId} options={(pkg.statuses ?? []).map((s) => [s.id, s.name])} />
            <span className="cword">걸려 있음</span>
            {more}
          </Hex>
        );
      case 'seen':
        return (
          <Hex kind="fact" onRemove={remove} onNot={negate}>
            <span className="cword">이벤트</span>
            <PillSelect value={id} onChange={setId} options={pkg.events.map((e) => [e.id, eventLabel(e)])} />
            <span className="cword">겪었음</span>
            {more}
          </Hex>
        );
      case 'achieved':
        return (
          <Hex kind="fact" onRemove={remove} onNot={negate}>
            <span className="cword">도전과제</span>
            <PillSelect value={id} onChange={setId} options={(pkg.achievements ?? []).map((a) => [a.id, a.title])} />
            <span className="cword">달성</span>
            {more}
          </Hex>
        );
    }
  }
  if (node.k === 'call' && node.fn === 'chance' && node.args.length === 1)
    return (
      <Hex kind="fact" onRemove={remove} onNot={negate}>
        <ValueSlot node={node.args[0]} onChange={(v) => onChange({ ...node, args: [v] })} />
        <span className="cword">% 확률</span>
        {more}
      </Hex>
    );
  if (node.k === 'lit' && typeof node.v === 'boolean')
    return (
      <Hex kind="fact" onRemove={remove}>
        <select className="pill" value={String(node.v)} onChange={(e) => onChange(lit(e.target.value === 'true'))}>
          <option value="true">참 (항상)</option>
          <option value="false">거짓 (절대 아님)</option>
        </select>
        {more}
      </Hex>
    );
  if (node.k === 'var' && pkg.variables.some((v) => v.id === node.name))
    return (
      <Hex kind="fact" onRemove={remove} onNot={negate}>
        <PillSelect value={node.name} onChange={(name) => onChange({ k: 'var', name })} options={pkg.variables.map((v) => [v.id, v.name ?? v.id])} />
        <span className="cword">이(가) 참</span>
        {more}
      </Hex>
    );

  return (
    <Hex kind="raw" onRemove={remove} onNot={negate}>
      <span className="cword">수식</span>
      <RawPill node={node} onChange={onChange} />
      {more}
    </Hex>
  );
}

// ───────────────────────── 값 칸 ─────────────────────────

const SYS_LABEL: [string, string][] = [
  ['나이', '나이'],
  ['턴', '턴'],
  ['년', '연도'],
  ['월', '월'],
  ['회차', '회차'],
];

/** 비교의 양쪽 값. 변수면 고르기, 아니면 숫자·글자·수식 입력 */
function ValueSlot({ node, onChange }: { node: Node; onChange: (n: Node) => void }) {
  const { pkg } = useEditor();
  const vars = pkg.variables.map((v) => [v.id, v.name ?? v.id] as [string, string]);
  if (node.k === 'var' && vars.some(([id]) => id === node.name))
    return <PillSelect value={node.name} kind="var" onChange={(name) => (name === '__raw__' ? onChange(lit(0)) : onChange({ k: 'var', name }))} options={[...vars, ['__raw__', '✎ 직접 입력']]} />;
  if (node.k === 'sys') {
    const known = SYS_LABEL.find(([n]) => n === node.name || ({ age: '나이', turn: '턴', year: '년', month: '월', runs: '회차' } as Record<string, string>)[node.name] === n);
    if (known)
      return <PillSelect value={known[0]} kind="var" onChange={(name) => (name === '__raw__' ? onChange(lit(0)) : onChange({ k: 'sys', name }))} options={[...SYS_LABEL, ['__raw__', '✎ 직접 입력']]} />;
  }
  if (node.k === 'call' && node.args.length === 1 && node.args[0].k === 'lit' && (node.fn === 'item' || node.fn === 'status')) {
    const opts = node.fn === 'item' ? (pkg.items ?? []).map((i) => [i.id, i.name] as [string, string]) : (pkg.statuses ?? []).map((s) => [s.id, s.name] as [string, string]);
    return (
      <span className="vreporter">
        <PillSelect value={String(node.args[0].v)} kind="var" onChange={(id) => onChange({ ...node, args: [lit(id)] })} options={opts} />
        <span className="cword">{node.fn === 'item' ? '개수' : '중첩'}</span>
      </span>
    );
  }
  return <RawPill node={node} onChange={onChange} withVars />;
}

function PillSelect({ value, onChange, options, kind }: { value: string; onChange: (v: string) => void; options: [string, string][]; kind?: string }) {
  return (
    <select className={`pill ${kind ?? ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
      {!options.some(([v]) => v === value) && <option value={value}>{value || '(고르세요)'} (없음!)</option>}
    </select>
  );
}

function PillText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="pill mono" value={value} placeholder={placeholder} size={Math.max(4, value.length + 1)} onChange={(e) => onChange(e.target.value)} />;
}

/** 수식 그대로 고치는 칸. 문법이 맞을 때만 반영한다 */
function RawPill({ node, onChange, withVars }: { node: Node; onChange: (n: Node) => void; withVars?: boolean }) {
  const { pkg } = useEditor();
  const printed = printExpr(node);
  const [draft, setDraft] = useState(printed);
  const last = useRef(printed);
  useEffect(() => {
    if (printed !== last.current) setDraft(printed);
    last.current = printed;
  }, [printed]);
  const parsed = tryParse(draft);
  const error = !parsed ? '문법 오류' : checkExpr(draft, pkg);
  return (
    <span className="raw-pill">
      <input
        className={`pill mono ${error ? 'invalid' : ''}`}
        value={draft}
        size={Math.max(3, draft.length + 1)}
        list={withVars ? 'cond-var-list' : undefined}
        title={error}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = tryParse(e.target.value);
          if (n) {
            last.current = printExpr(n);
            onChange(n);
          }
        }}
      />
      {withVars && (
        <datalist id="cond-var-list">
          {pkg.variables.map((v) => (
            <option key={v.id} value={v.id} />
          ))}
        </datalist>
      )}
    </span>
  );
}
