import type { ChoiceDef, Command, Outcome } from '@engine';
import { type ReactNode, useState } from 'react';
import { describeExpr } from '../lib/exprPrint';
import { canAddChoice } from '../lib/limits';
import { CheckChance, PercentSum, nextPercent } from './ChanceInput';
import { CommandList } from './CommandEditor';
import { CondInput } from './CondBlocks';
import { useEditor } from './context';
import { EventPicker } from './EventPicker';
import { Check, ExprInput, Field, HelpLink, ItemTools, TemplateArea, TemplateInput, Tip } from './fields';

type Mode = 'outcome' | 'check' | 'results';

function modeOf(c: ChoiceDef): Mode {
  if (c.check) return 'check';
  if (c.results) return 'results';
  return 'outcome';
}

function countBlocks(cmds: Command[] | undefined): number {
  return (cmds ?? []).reduce((n, c) => {
    if (c.do === 'if') return n + 1 + countBlocks(c.then) + countBlocks(c.else);
    if (c.do === 'random') return n + 1 + c.branches.reduce((m, b) => m + countBlocks(b.then), 0);
    if (c.do === 'check') return n + 1 + countBlocks(c.success) + countBlocks(c.failure);
    return n + 1;
  }, 0);
}

/** 접힌 선택지 아래에 보일 한 줄 */
function choiceSummary(c: ChoiceDef, pkg: ReturnType<typeof useEditor>['pkg']): string {
  const parts: string[] = [];
  if (c.requires) parts.push(`${describeExpr(c.requires, pkg)}일 때`);
  const outs = [c.outcome, c.success, c.failure, ...(c.results ?? [])].filter((o): o is Outcome => !!o);
  if (c.check) parts.push('성공·실패를 굴림');
  if (c.results) parts.push(`${c.results.length}갈래 중 하나`);
  const n = outs.reduce((a, o) => a + countBlocks(o.do), 0);
  if (n) parts.push(`일어나는 일 ${n}개`);
  const next = outs.reduce((a, o) => a + (o.choices?.length ?? 0), 0);
  if (next) parts.push(`이어지는 선택지 ${next}개`);
  return parts.join(' · ');
}

/** 이벤트의 선택지 카드. 접어 두면 문구와 요약만 보인다 */
export function ChoiceCard({
  choice,
  index,
  length,
  edit,
  onMove,
  onDuplicate,
  onRemove,
  links,
}: {
  choice: ChoiceDef;
  index: number;
  length: number;
  edit: (fn: (c: ChoiceDef) => void) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  links?: ReactNode;
}) {
  const { pkg, detail } = useEditor();
  const [open, setOpen] = useState(detail || !choice.text);
  const summary = choiceSummary(choice, pkg);
  return (
    <div className={`choice-card ${open ? 'open' : ''}`}>
      <div className="choice-card-head">
        <span className="choice-no">{index + 1}</span>
        <span className="choice-text">
          <TemplateInput value={choice.text} placeholder="선택지 문구" onChange={(v) => edit((c) => (c.text = v ?? ''))} />
        </span>
        <button type="button" className="choice-toggle" onClick={() => setOpen(!open)}>
          {open ? '접기 ▴' : '펼치기 ▾'}
        </button>
        <ItemTools index={index} length={length} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
      </div>
      {!open && (summary || links) && (
        <div className="choice-summary" onClick={() => setOpen(true)}>
          {summary && <span>{summary}</span>}
          {links}
        </div>
      )}
      {open && <ChoiceBody choice={choice} edit={edit} hideText />}
    </div>
  );
}

/** 선택지(또는 행동) 하나. edit는 초안의 이 선택지를 고친다 */
export function ChoiceBody({ choice, edit, hideText }: { choice: ChoiceDef; edit: (fn: (c: ChoiceDef) => void) => void; hideText?: boolean }) {
  const { pkg } = useEditor();
  const mode = modeOf(choice);
  const setMode = (m: Mode) =>
    edit((c) => {
      const keep = c.outcome ?? c.success ?? c.results?.[0] ?? {};
      delete c.check;
      delete c.success;
      delete c.failure;
      delete c.results;
      delete c.outcome;
      if (m === 'outcome') c.outcome = { text: keep.text, do: keep.do, goto: keep.goto };
      if (m === 'check') {
        c.check = { chance: 50 };
        c.success = { text: keep.text, do: keep.do, goto: keep.goto };
        c.failure = {};
      }
      if (m === 'results') c.results = [{ weight: 50, text: keep.text, do: keep.do, goto: keep.goto }, { weight: 50 }];
    });
  const weights = (choice.results ?? []).map((r) => r.weight);
  const total = weights.every((w) => typeof w === 'number') ? (weights as number[]).reduce((a, b) => a + Math.max(0, b), 0) : 0;

  return (
    <div className="choice-body">
      {!hideText && (
        <Field label="선택지 문구" wide>
          <TemplateInput value={choice.text} onChange={(v) => edit((c) => (c.text = v ?? ''))} />
        </Field>
      )}
      <div className="sentence">
        <span>이 선택지는</span>
        <CondInput value={choice.requires} placeholder="언제나" onChange={(v) => edit((c) => (c.requires = v))} />
        <span>고를 수 있습니다.</span>
        <Tip>조건이 안 맞으면 흐리게 보이고 "필요: 용기 3 이상"처럼 이유가 자동으로 붙습니다.</Tip>
      </div>
      {choice.requires && (
        <div className="sentence">
          <span>안 맞으면</span>
          {choice.hidden ? (
            <span className="muted">선택지를 아예 숨깁니다.</span>
          ) : (
            <span className="requires-text">
              <TemplateInput value={choice.requiresText} placeholder={`필요: ${describeExpr(choice.requires, pkg)}`} onChange={(v) => edit((c) => (c.requiresText = v))} />
            </span>
          )}
          <Tip>
            회색 글씨는 조건에서 자동으로 만든 안내입니다. 비워 두면 플레이 중 맞지 않은 조건만 골라 이렇게 보여 주고, 직접 쓰면 쓴 그대로 보여 줍니다.
          </Tip>
          <Check value={choice.hidden} onChange={(v) => edit((c) => (c.hidden = v || undefined))} label="아예 숨기기" />
        </div>
      )}
      <div className="sentence">
        <span>고르면</span>
        <div className="mode-tabs">
          {(
            [
              ['outcome', '늘 같은 결과'],
              ['check', '성공·실패를 굴림'],
              ['results', '확률로 갈림'],
            ] as const
          ).map(([m, label]) => (
            <button type="button" key={m} className={mode === m ? 'active' : ''} onClick={() => mode !== m && setMode(m)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'outcome' && <OutcomeEditor outcome={choice.outcome} edit={(fn) => edit((c) => fn((c.outcome ??= {})))} />}

      {mode === 'check' && (
        <>
          <CheckChance spec={choice.check ?? { chance: 50 }} onChange={(s) => edit((c) => void (c.check = s))} />
          <div className="split">
            <OutcomeEditor title="성공하면" tone="good" outcome={choice.success} edit={(fn) => edit((c) => fn((c.success ??= {})))} />
            <OutcomeEditor title="실패하면" tone="bad" outcome={choice.failure} edit={(fn) => edit((c) => fn((c.failure ??= {})))} />
          </div>
        </>
      )}

      {mode === 'results' && (
        <>
          {(choice.results ?? []).map((r, i) => (
            <OutcomeEditor
              key={i}
              title={`${i + 1}번째 갈래${total > 0 && total !== 100 ? ` (실제 ${Math.round((Math.max(0, r.weight as number) / total) * 100)}%)` : ''}`}
              outcome={r}
              weight={r.weight}
              onWeight={(w) => edit((c) => (c.results![i].weight = w ?? 1))}
              onRemove={(choice.results?.length ?? 0) > 1 ? () => edit((c) => c.results!.splice(i, 1)) : undefined}
              edit={(fn) => edit((c) => fn(c.results![i]))}
            />
          ))}
          <PercentSum weights={weights} />
          <button type="button" className="btn small" onClick={() => edit((c) => c.results!.push({ weight: nextPercent(c.results!.map((r) => r.weight)) }))}>
            ＋ 갈래 추가
          </button>
        </>
      )}
    </div>
  );
}

export function OutcomeEditor({
  title,
  outcome,
  edit,
  tone,
  weight,
  onWeight,
  onRemove,
}: {
  title?: string;
  outcome: Outcome | undefined;
  edit: (fn: (o: Outcome) => void) => void;
  tone?: 'good' | 'bad';
  weight?: number | string;
  onWeight?: (w: number | string | undefined) => void;
  onRemove?: () => void;
}) {
  const o = outcome ?? {};
  return (
    <div className={`outcome ${tone ? `tone-${tone}` : ''}`}>
      {(title || onWeight || onRemove) && (
        <div className="outcome-head">
          {title && <strong>{title}</strong>}
          {onWeight && (
            <span className="inline small-input">
              확률 <ExprInput value={weight} numeric onChange={(v) => v !== undefined && onWeight(v)} /> %
            </span>
          )}
          {onRemove && (
            <button type="button" className="link" onClick={onRemove}>
              삭제
            </button>
          )}
        </div>
      )}
      <Field label="결과 본문" wide hint={<>이 선택지를 고른 뒤 화면에 나오는 글입니다. 값 넣기·조건·조사는 <HelpLink topic="text">도움말 › 중괄호 문법</HelpLink>을 보세요.</>}>
        <TemplateArea value={o.text} rows={4} placeholder="고른 뒤 보여 줄 글" onChange={(v) => edit((x) => (x.text = v))} />
      </Field>
      <div className="field-label outcome-label">일어나는 일</div>
      <CommandList list={o.do} edit={(fn) => edit((x) => fn((x.do ??= [])))} />
      {o.choices?.length ? (
        <div className="next-choices">
          <div className="field-label outcome-label">
            이어서 고를 선택지<Tip>위 글을 보여 준 뒤 '계속' 대신 이 선택지들이 바로 뜹니다. 선택지 안에 또 선택지를 넣어 대화나 장면을 길게 이어 갈 수 있습니다.</Tip>
          </div>
          {o.choices.map((c, i) => (
            <ChoiceCard
              key={i}
              choice={c}
              index={i}
              length={o.choices!.length}
              edit={(fn) => edit((x) => fn(x.choices![i]))}
              onMove={(to) =>
                edit((x) => {
                  if (to < 0 || to >= x.choices!.length) return;
                  x.choices!.splice(to, 0, ...x.choices!.splice(i, 1));
                })
              }
              onDuplicate={async () => (await canAddChoice(o.choices!.length)) && edit((x) => void x.choices!.splice(i + 1, 0, JSON.parse(JSON.stringify(x.choices![i]))))}
              onRemove={() =>
                edit((x) => {
                  x.choices!.splice(i, 1);
                  if (!x.choices!.length) delete x.choices;
                })
              }
            />
          ))}
          <button
            type="button"
            className="btn small"
            onClick={async () => (await canAddChoice(o.choices!.length)) && edit((x) => void (x.choices ??= []).push({ text: '', outcome: {} }))}
          >
            ＋ 선택지 더
          </button>
          <p className="field-hint">이어지는 선택지를 다 고르고 나면 {o.goto ? '아래 장면으로 이어집니다.' : '평소대로 흘러갑니다.'}</p>
        </div>
      ) : (
        <button type="button" className="add-next" onClick={() => edit((x) => void (x.choices = [{ text: '', outcome: {} }]))}>
          ＋ 이어서 고를 선택지 넣기
        </button>
      )}
      <div className="sentence">
        <span>{o.choices?.length ? '다 고른 뒤엔' : '그다음엔'}</span>
        <EventPicker value={o.goto} onChange={(v) => edit((x) => (x.goto = v))} empty="평소대로 흘러갑니다" />
        {o.goto && <span>(으)로 이어집니다.</span>}
      </div>
    </div>
  );
}
