// +3 / -2 처럼 부호를 붙여 적는 칸과 ▲▼ 버튼. 수식(예: 힘 * 2)도 적을 수 있고, 그때는 화살표가 꺼진다.

import type { NumOrExpr } from '@engine';
import { useState } from 'react';
import { useEditor } from './context';
import { checkExpr } from './fields';

const NUM = /^[+-]?\d+(\.\d+)?$/;

function show(v: NumOrExpr | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'number') return v > 0 ? `+${v}` : String(v);
  return v;
}

export function Stepper({ value, onChange, step = 1 }: { value: NumOrExpr | undefined; onChange: (v: NumOrExpr) => void; step?: number }) {
  const { pkg } = useEditor();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(value);
  const isNum = typeof value === 'number';
  const error = draft === null && typeof value === 'string' ? checkExpr(value, pkg) : draft && !NUM.test(draft.trim()) && !/^[+-]?$/.test(draft.trim()) ? checkExpr(draft.replace(/^\+/, ''), pkg) : undefined;
  const bump = (d: number) => {
    if (!isNum) return;
    setDraft(null);
    onChange(Math.round(((value as number) + d) * 1000) / 1000);
  };
  return (
    <span className={`stepper ${error ? 'invalid' : ''}`} title={error}>
      <input
        className="mono"
        value={text}
        size={Math.max(3, text.length + 1)}
        placeholder="+1"
        onFocus={(e) => e.target.select()}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') (e.preventDefault(), bump(step));
          if (e.key === 'ArrowDown') (e.preventDefault(), bump(-step));
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const t = v.trim();
          if (NUM.test(t)) onChange(Number(t));
          else if (t && !/^[+-]?$/.test(t)) onChange(t.replace(/^\+\s*/, ''));
        }}
      />
      <span className="stepper-buttons">
        <button type="button" tabIndex={-1} disabled={!isNum} title="1 올리기" onClick={() => bump(step)}>
          ▲
        </button>
        <button type="button" tabIndex={-1} disabled={!isNum} title="1 내리기" onClick={() => bump(-step)}>
          ▼
        </button>
      </span>
    </span>
  );
}
