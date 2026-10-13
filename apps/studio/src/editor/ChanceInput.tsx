// 확률 입력. 판정은 "성공 확률 60%"처럼 직접 적거나 "기본 30%에 용기 1마다 10%씩"으로 정한다.
// 옛 방식(능력치 대 난이도 공식)은 이미 쓰고 있거나 자세히 모드일 때만 고를 수 있다.

import type { CheckSpec, NumOrExpr } from '@engine';
import { useEditor } from './context';
import { ExprInput, Select, Tip } from './fields';

type Mode = 'fixed' | 'stat' | 'formula' | 'custom';

const STAT_RE = /^\s*(-?\d+(?:\.\d+)?)\s*\+\s*(.+?)\s*\*\s*(-?\d+(?:\.\d+)?)\s*$/;

function modeOf(spec: CheckSpec): Mode {
  const c = spec.chance;
  if (c === undefined) return 'formula';
  if (typeof c === 'number' || /^\s*-?\d+(\.\d+)?\s*$/.test(c)) return 'fixed';
  if (STAT_RE.test(c)) return 'stat';
  return 'custom';
}

/** 판정의 성공 확률. onChange는 판정 설정 전체를 새로 돌려준다 */
export function CheckChance({ spec, onChange }: { spec: CheckSpec; onChange: (s: CheckSpec) => void }) {
  const { pkg, detail } = useEditor();
  const mode = modeOf(spec);
  const numVars = pkg.variables.filter((v) => v.type === 'number').map((v) => [v.id, v.name ?? v.id] as const);
  const firstVar = numVars[0]?.[0] ?? '0';
  const stat = typeof spec.chance === 'string' ? spec.chance.match(STAT_RE) : null;
  const setStat = (base: string | number, v: string, per: string | number) => onChange({ chance: `${base} + ${v} * ${per}` });

  const options: [Mode, string][] = [
    ['fixed', '정해진 확률'],
    ['stat', '능력치에 따라'],
  ];
  if (detail || mode === 'formula') options.push(['formula', '난이도 공식 (고급)']);
  if (detail || mode === 'custom') options.push(['custom', '수식 직접 (고급)']);

  return (
    <div className="sentence">
      <span>성공 확률은</span>
      <Select
        value={mode}
        onChange={(m) => {
          if (m === mode) return;
          if (m === 'fixed') onChange({ chance: 50 });
          if (m === 'stat') onChange({ chance: `30 + ${firstVar} * 10` });
          if (m === 'formula') onChange({ skill: firstVar, difficulty: 1 });
          if (m === 'custom') onChange({ chance: typeof spec.chance === 'string' ? spec.chance : String(spec.chance ?? 50) });
        }}
        options={options}
      />
      {mode === 'fixed' && (
        <>
          <span className="small-input">
            <ExprInput value={spec.chance} numeric onChange={(v) => v !== undefined && onChange({ chance: v })} />
          </span>
          <span>% 입니다.</span>
        </>
      )}
      {mode === 'stat' && stat && (
        <>
          <span>기본</span>
          <span className="small-input">
            <ExprInput value={Number(stat[1])} numeric onChange={(v) => v !== undefined && setStat(v, stat[2], stat[3])} />
          </span>
          <span>%에,</span>
          <Select value={stat[2]} onChange={(v) => v && setStat(stat[1], v, stat[3])} options={numVars} />
          <span>1마다</span>
          <span className="small-input">
            <ExprInput value={Number(stat[3])} numeric onChange={(v) => v !== undefined && setStat(stat[1], stat[2], v)} />
          </span>
          <span>%씩 더합니다.</span>
          <Tip>예: 기본 30%에 용기 1마다 10%씩 → 용기 4면 70%. 0% 아래, 100% 위로는 넘어가지 않습니다.</Tip>
        </>
      )}
      {mode === 'custom' && (
        <>
          <ExprInput value={spec.chance} onChange={(v) => onChange({ chance: (v ?? 50) as NumOrExpr })} placeholder="예: 40 + 힘 * 5" />
          <span>%</span>
        </>
      )}
      {mode === 'formula' && (
        <>
          <ExprInput value={spec.skill} onChange={(v) => onChange({ ...spec, skill: v as string | undefined })} placeholder="능력치" />
          <span>대 난이도</span>
          <span className="small-input">
            <ExprInput value={spec.difficulty} numeric onChange={(v) => onChange({ ...spec, difficulty: v })} />
          </span>
          <span>보정</span>
          <span className="small-input">
            <ExprInput value={spec.bonus} numeric placeholder="0" onChange={(v) => onChange({ ...spec, bonus: v })} />
          </span>
          <Tip>진행 방식 › 고급 설정의 '판정' 공식으로 확률을 계산합니다(기본: 50 + 15 × (능력치 − 난이도) + 보정, 5~95%).</Tip>
        </>
      )}
    </div>
  );
}

/** 확률 갈래들의 합계 안내 */
export function PercentSum({ weights }: { weights: NumOrExpr[] }) {
  if (weights.some((w) => typeof w !== 'number')) return <p className="field-hint">확률에 수식이 있어 실제 비율은 플레이 중에 정해집니다.</p>;
  const total = (weights as number[]).reduce((a, b) => a + Math.max(0, b), 0);
  if (total === 100) return <p className="field-hint">합계 100%</p>;
  return (
    <p className="field-hint warn-text">
      합계 {total}% — 100이 아니면 적은 숫자의 비율대로 나눕니다{total > 0 ? ` (${(weights as number[]).map((w) => `${Math.round((Math.max(0, w) / total) * 100)}%`).join(' / ')})` : ''}.
    </p>
  );
}

/** 새 갈래에 넣을 확률: 100에서 남은 만큼(없으면 10) */
export function nextPercent(weights: NumOrExpr[]): number {
  const total = weights.reduce<number>((a, w) => a + (typeof w === 'number' ? Math.max(0, w) : 0), 0);
  return total < 100 ? 100 - total : 10;
}
