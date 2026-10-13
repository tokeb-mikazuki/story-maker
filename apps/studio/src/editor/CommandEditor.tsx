// 명령 블록 편집기 (엔트리·스크래치식 조작). 블록을 꾸러미에서 끌어다 끼우고, '만약' 같은 ㄷ자 블록 안에
// 다른 블록을 넣는다. 저장 형식은 그대로 Command[] 이다.

import type { Command, NumOrExpr, StoryPackage } from '@engine';
import { CheckChance, nextPercent } from './ChanceInput';
import { Stepper } from './Stepper';
import { current as draftValue, original } from 'immer';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { CondInput } from './CondBlocks';
import { type Drag, findPath, startDrag, useDrop } from './blockDnd';
import { useEditor } from './context';
import { EventPicker } from './EventPicker';
import { Check, ExprInput, NumInput, OptText, Select, TemplateInput, TextInput } from './fields';

type Kind = Command['do'];

export const COMMAND_TYPES: [Kind, string, string][] = [
  ['add', '변수 더하기', '변수에 값을 더하거나 뺍니다'],
  ['set', '변수 정하기', '변수를 특정 값으로 바꿉니다'],
  ['tag', '태그 붙이기', '변수로 만들 필요 없는 표시나 값을 붙입니다'],
  ['untag', '태그 떼기', '붙인 태그를 없앱니다'],
  ['item', '아이템 얻기/잃기', '아이템 개수를 늘리거나 줄입니다'],
  ['status', '상태 걸기/풀기', '부상·축복 같은 상태를 겁니다'],
  ['text', '본문 추가', '결과 화면에 문단을 덧붙입니다'],
  ['note', '알림', '결과 화면 아래 작은 알림을 띄웁니다'],
  ['if', '조건', '조건이 맞을 때만 안쪽 블록을 실행합니다'],
  ['random', '확률로 고르기', '여러 갈래 중 하나를 확률로 실행합니다'],
  ['check', '판정', '능력치로 성공/실패를 굴립니다'],
  ['goto', '이벤트로 이동', '다음에 볼 이벤트를 정합니다'],
  ['call', '스크립트 실행', '미리 만든 명령 묶음을 실행합니다'],
  ['end', '엔딩', '게임을 이 엔딩으로 끝냅니다'],
  ['record', '인생표 기록', '엔딩 화면의 인생표에 한 줄 남깁니다'],
  ['achieve', '도전과제 달성', '도전과제를 달성시킵니다'],
  ['let', '임시 값', '이 블록 묶음 안에서만 쓰는 값. 아래 블록의 식에서 $이름으로 불러 씁니다'],
  ['advance', '시간 흘리기', '턴과 별개로 시간을 흘려보냅니다'],
  ['endTurn', '턴 넘기기', '남은 일을 건너뛰고 턴을 n번 넘깁니다'],
];

/** 블록 꾸러미 분류. 색은 분류마다 하나(기존 종이·나무 톤에 맞춘 차분한 색) */
export const BLOCK_CATS: { id: string; name: string; color: string; kinds: Kind[] }[] = [
  { id: 'flow', name: '흐름', color: '#4f7a86', kinds: ['if', 'random', 'check'] },
  { id: 'data', name: '자료', color: '#b7862b', kinds: ['add', 'set', 'tag', 'untag', 'let'] },
  { id: 'story', name: '글·그림', color: '#6f8a4a', kinds: ['text', 'note', 'record'] },
  { id: 'bag', name: '소지품', color: '#8a5f7a', kinds: ['item', 'status', 'achieve'] },
  { id: 'move', name: '진행', color: '#3f6ea8', kinds: ['goto', 'call', 'advance', 'endTurn', 'end'] },
];

export function blockColor(kind: Kind): string {
  if (kind === 'end') return '#b5523b';
  return BLOCK_CATS.find((c) => c.kinds.includes(kind))?.color ?? '#888';
}

export const kindLabel = (kind: Kind) => COMMAND_TYPES.find((t) => t[0] === kind)?.[1] ?? kind;

export function blank(kind: Kind, pkg: StoryPackage): Command {
  const firstVar = pkg.variables.find((v) => !v.formula)?.id ?? '';
  switch (kind) {
    case 'add':
      return { do: 'add', var: firstVar, value: 1 };
    case 'set':
      return { do: 'set', var: firstVar, value: 0 };
    case 'let':
      return { do: 'let', name: '값', value: 0 };
    case 'tag':
      return { do: 'tag', key: '' };
    case 'untag':
      return { do: 'untag', key: '' };
    case 'item':
      return { do: 'item', id: pkg.items?.[0]?.id ?? '', count: 1 };
    case 'status':
      return { do: 'status', id: pkg.statuses?.[0]?.id ?? '' };
    case 'text':
      return { do: 'text', text: '' };
    case 'note':
      return { do: 'note', text: '' };
    case 'image':
      return { do: 'image', asset: pkg.assets?.[0]?.id ?? '' };
    case 'if':
      return { do: 'if', cond: '', then: [] };
    case 'random':
      return { do: 'random', branches: [{ weight: 50, then: [] }, { weight: 50, then: [] }] };
    case 'check':
      return { do: 'check', check: { chance: 50 }, success: [], failure: [] };
    case 'goto':
      return { do: 'goto', event: pkg.events[0]?.id ?? '' };
    case 'call':
      return { do: 'call', script: pkg.scripts?.[0]?.id ?? '', args: {} };
    case 'end':
      return { do: 'end', ending: pkg.endings[0]?.id ?? '' };
    case 'advance':
      return { do: 'advance', amount: 1 };
    case 'endTurn':
      return { do: 'endTurn', times: 1 };
    case 'record':
      return { do: 'record', text: '', importance: 3 };
    case 'achieve':
      return { do: 'achieve', id: pkg.achievements?.[0]?.id ?? '' };
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** 조건 수식을 비교용으로 정규화(공백 차이 무시) */
const sameCond = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

// ───────────────────────── 블록 묶음(스택) ─────────────────────────

/** list: 편집할 명령 배열(immer 초안 안의 배열), 바꿀 땐 edit(draft => ...)로 */
export function CommandList({
  list,
  edit,
  depth = 0,
  hat,
}: {
  list: Command[] | undefined;
  /** 초안에서 이 명령 배열을 꺼내 고치는 함수 */
  edit: (fn: (cmds: Command[]) => void) => void;
  depth?: number;
  /** 맨 위에 얹는 '~할 때' 머리 블록 */
  hat?: ReactNode;
}) {
  const { update, checkpoint } = useEditor();
  const cmds = list ?? [];

  const insert = (i: number, d: Drag) => {
    checkpoint();
    // 새 자리에 복사본을 넣고, 원래 블록을 참조로 찾아 지운다(두 단계는 되돌리기 한 번으로 묶인다)
    edit((l) => void l.splice(i, 0, clone(d.cmd)));
    update((dr) => {
      const path = findPath(original(dr), d.cmd);
      if (!path) return;
      let o: any = dr;
      for (const k of path.slice(0, -1)) o = o[k];
      o.splice(path[path.length - 1], 1);
    });
  };

  return (
    <div className={`stack depth-${Math.min(depth, 3)} ${hat ? 'has-hat' : ''}`}>
      {hat && <div className="block hat">{hat}</div>}
      {cmds.length === 0 ? (
        <EmptySlot onDrop={(d) => insert(0, d)} />
      ) : (
        <>
          <Gap onDrop={(d) => insert(0, d)} />
          {cmds.map((c, i) => (
            <div key={i} className="stack-item">
              <Block cmd={c} index={i} prev={cmds[i - 1]} length={cmds.length} editList={edit} depth={depth} />
              <Gap onDrop={(d) => insert(i + 1, d)} />
            </div>
          ))}
        </>
      )}
      <AddBlock onPick={(cmd) => (checkpoint(), edit((l) => void l.push(cmd)))} />
    </div>
  );
}

const acceptsBlock = () => true;

/** 블록 사이 틈. 끌고 있을 때만 넓어진다 */
function Gap({ onDrop }: { onDrop: (d: Drag) => void }) {
  const drop = useDrop(onDrop, acceptsBlock);
  return <div className={`gap ${drop.over ? 'over' : ''}`} {...drop.props} />;
}

function EmptySlot({ onDrop }: { onDrop: (d: Drag) => void }) {
  const drop = useDrop(onDrop, acceptsBlock);
  return (
    <div className={`stack-empty ${drop.over ? 'over' : ''}`} {...drop.props}>
      비어 있음
    </div>
  );
}

/** 바깥을 누르면 닫히는 작은 메뉴 */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as globalThis.Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return { open, setOpen, ref };
}

/** 목록 끝의 ＋ 버튼: 누르면 블록 목록이 펼쳐진다 */
function AddBlock({ onPick }: { onPick: (cmd: Command) => void }) {
  const { pkg } = useEditor();
  const { open, setOpen, ref } = usePopover();
  return (
    <span className="add-block" ref={ref}>
      <button type="button" className="add-block-btn" onClick={() => setOpen(!open)}>
        ＋ 블록 추가
      </button>
      {open && (
        <div className="block-menu">
          {BLOCK_CATS.map((cat) => (
            <div key={cat.id} className="block-menu-cat">
              <span className="block-menu-name" style={{ color: cat.color }}>
                {cat.name}
              </span>
              {cat.kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="pblock"
                  style={{ '--c': blockColor(k) } as CSSProperties}
                  onClick={() => (onPick(blank(k, pkg)), setOpen(false))}
                >
                  <span className="pblock-name">{kindLabel(k)}</span>
                  <span className="pblock-desc">{COMMAND_TYPES.find((t) => t[0] === k)?.[2]}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

/** 블록 오른쪽 ⋯ 메뉴 */
function BlockMenu({ items }: { items: ([string, () => void] | false)[] }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <span className="block-tools" ref={ref}>
      <button type="button" className="block-more" title="블록 메뉴" onClick={() => setOpen(!open)}>
        ⋯
      </button>
      {open && (
        <span className="block-more-menu">
          {items.filter((x): x is [string, () => void] => !!x).map(([label, fn]) => (
            <button key={label} type="button" className={label === '삭제' ? 'danger' : ''} onClick={() => (setOpen(false), fn())}>
              {label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ───────────────────────── 블록 하나 ─────────────────────────

function Block({
  cmd,
  index,
  prev,
  length,
  editList,
  depth,
}: {
  cmd: Command;
  index: number;
  prev?: Command;
  length: number;
  editList: (fn: (cmds: Command[]) => void) => void;
  depth: number;
}) {
  const { checkpoint } = useEditor();
  const [armed, setArmed] = useState(false);
  const [extra, setExtra] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const edit = (fn: (c: any) => void) => editList((l) => fn(l[index]));
  /** 블록 구조를 바꾸는 조작은 되돌리기 한 단계씩 */
  const reshape = (fn: (cmds: Command[]) => void) => (checkpoint(), editList(fn));
  const c = blockColor(cmd.do);
  const isC = cmd.do === 'if' || cmd.do === 'random' || cmd.do === 'check';

  const grip = (
    <span className="grip" title="끌어서 옮기기" onMouseDown={() => setArmed(true)} onMouseUp={() => setArmed(false)}>
      ⠿
    </span>
  );
  const tools = (
    <BlockMenu
      items={[
        index > 0 && ['위로', () => reshape((l) => void l.splice(index - 1, 0, ...l.splice(index, 1)))],
        index < length - 1 && ['아래로', () => reshape((l) => void l.splice(index + 1, 0, ...l.splice(index, 1)))],
        ['조건으로 감싸기', () => reshape((l) => void l.splice(index, 1, { do: 'if', cond: '', then: [clone(draftValue(l[index]))] }))],
        cmd.do === 'if' && ['감싸기 풀기', () => reshape((l) => void l.splice(index, 1, ...clone(draftValue((l[index] as Extract<Command, { do: 'if' }>).then))))],
        (cmd.do === 'status' || cmd.do === 'item') && [extra ? '세부 칸 숨기기' : '세부 칸 보기 (지속 턴·알림)', () => setExtra(!extra)],
        ['복제', () => reshape((l) => void l.splice(index + 1, 0, clone(draftValue(l[index]))))],
        ['삭제', () => reshape((l) => void l.splice(index, 1))],
      ]}
    />
  );
  return (
    <div
      ref={ref}
      className={`block ${isC ? 'c-block' : ''}`}
      style={{ '--c': c } as CSSProperties}
      draggable={armed}
      onDragStart={(e) => startDrag(e, { kind: 'move', cmd, el: ref.current ?? undefined })}
      onDragEnd={() => setArmed(false)}
    >
      {isC ? (
        <CBlockBody cmd={cmd} edit={edit} depth={depth} grip={grip} tools={tools} prev={prev} reshape={reshape} index={index} />
      ) : (
        <div className="block-row">
          {grip}
          <BlockBody cmd={cmd} edit={edit} extra={extra} />
          {tools}
        </div>
      )}
    </div>
  );
}


/**
 * 태그에 넣을 값. 평소엔 그냥 글자를 적으면 되고(따옴표는 알아서 붙인다),
 * 계산한 값을 넣고 싶을 때만 '식' 칸으로 바꾼다.
 */
function TagValue({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  const quoted = typeof value === 'string' ? /^'((?:[^'\\]|\\.)*)'$/.exec(value) : null;
  const [formula, setFormula] = useState(!quoted);
  if (formula)
    return (
      <>
        <ExprInput value={value} numeric onChange={(v) => onChange(String(v ?? "''"))} placeholder="수식" />
        <button type="button" className="mini" title="그냥 글자로 적기" onClick={() => (onChange("''"), setFormula(false))}>
          글자로
        </button>
      </>
    );
  const text = quoted ? quoted[1].replace(/\\(.)/g, '$1') : '';
  return (
    <>
      <TextInput value={text} onChange={(v) => onChange(`'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)} placeholder="넣을 글자" />
      <button type="button" className="mini" title="다른 변수나 계산한 값을 넣고 싶을 때" onClick={() => setFormula(true)}>
        수식으로
      </button>
    </>
  );
}

/** 블록 속 낱말 */
const W =({ children }: { children: ReactNode }) => <span className="bw">{children}</span>;

/** 문장처럼 읽히는 블록 본문. extra면 잘 안 쓰는 칸(지속 턴, 알림 끄기 등)도 보인다 */
function BlockBody({ cmd, edit, extra }: { cmd: Command; edit: (fn: (c: any) => void) => void; extra?: boolean }) {
  const { pkg } = useEditor();
  const vars = pkg.variables.filter((v) => !v.formula).map((v) => [v.id, v.name ? `${v.name}` : v.id] as const);
  const set = (key: string) => (v: unknown) =>
    edit((c) => {
      if (v === undefined) delete c[key];
      else c[key] = v;
    });
  switch (cmd.do) {
    case 'add':
      return (
        <>
          <Select value={cmd.var} onChange={set('var')} options={vars} />
          <Stepper value={cmd.value as NumOrExpr} onChange={set('value')} />
        </>
      );
    case 'set':
      return (
        <>
          <Select value={cmd.var} onChange={set('var')} options={vars} />
          <W>을(를)</W>
          <ExprInput value={cmd.value as string | number} numeric onChange={(v) => set('value')(v ?? 0)} placeholder="값 또는 수식" />
          <W>(으)로 정하기</W>
        </>
      );
    case 'let':
      return (
        <>
          <W>임시 값</W>
          <TextInput value={cmd.name} onChange={set('name')} placeholder="이름" />
          <W>을(를)</W>
          <ExprInput value={cmd.value as string | number} numeric onChange={(v) => set('value')(v ?? 0)} placeholder="값 또는 수식" />
          <W>(으)로 정하기</W>
        </>
      );
    case 'tag':
      return (
        <>
          <W>태그</W>
          <TextInput value={cmd.key} onChange={set('key')} placeholder="이름 (예: 직업)" />
          <Select
            value={cmd.add !== undefined ? 'add' : cmd.value !== undefined ? 'value' : 'flag'}
            onChange={(m) =>
              edit((c) => {
                delete c.add;
                delete c.value;
                if (m === 'add') c.add = 1;
                if (m === 'value') c.value = "''";
              })
            }
            options={[
              ['flag', '붙이기'],
              ['value', '에 값 넣기'],
              ['add', '에 숫자 더하기'],
            ]}
          />
          {cmd.value !== undefined && <TagValue value={cmd.value as string | number} onChange={(v) => set('value')(v)} />}
          {cmd.add !== undefined && <ExprInput value={cmd.add} numeric onChange={(v) => set('add')(v ?? 1)} />}
        </>
      );
    case 'untag':
      return (
        <>
          <W>태그</W>
          {cmd.prefix !== undefined ? <TextInput value={cmd.prefix} onChange={set('prefix')} mono /> : <TextInput value={cmd.key} onChange={set('key')} mono />}
          <Select
            value={cmd.prefix !== undefined ? 'prefix' : 'key'}
            onChange={(m) =>
              edit((c) => {
                if (m === 'prefix') {
                  c.prefix = c.key ?? '';
                  delete c.key;
                  delete c.value;
                } else {
                  c.key = c.prefix ?? '';
                  delete c.prefix;
                }
              })
            }
            options={[
              ['key', '떼기'],
              ['prefix', '(으)로 시작하는 것 모두 떼기'],
            ]}
          />
          {cmd.prefix === undefined && <OptText value={cmd.value} onChange={set('value')} placeholder="(값이 이것일 때만)" />}
        </>
      );
    case 'item':
      return (
        <>
          <Select value={cmd.id} onChange={set('id')} options={(pkg.items ?? []).map((i) => [i.id, i.name] as const)} />
          <Stepper value={cmd.count} onChange={set('count')} />
          <W>개</W>
          {(extra || cmd.silent) && <Check value={cmd.silent} onChange={(v) => set('silent')(v || undefined)} label="알림 끄기" />}
        </>
      );
    case 'status':
      return (
        <>
          <W>상태</W>
          <Select value={cmd.id} onChange={set('id')} options={(pkg.statuses ?? []).map((s) => [s.id, s.name] as const)} />
          <Select
            value={cmd.remove ? 'remove' : 'add'}
            onChange={(m) => set('remove')(m === 'remove' || undefined)}
            options={[
              ['add', '걸기'],
              ['remove', '풀기'],
            ]}
          />
          {!cmd.remove && (extra || cmd.duration !== undefined) && (
            <>
              <span className="small-input">
                <NumInput value={cmd.duration} onChange={set('duration')} placeholder="기본" />
              </span>
              <W>턴 동안</W>
            </>
          )}
          {!cmd.remove && (extra || cmd.stacks !== undefined) && (
            <>
              <span className="small-input">
                <NumInput value={cmd.stacks} onChange={set('stacks')} placeholder="1" />
              </span>
              <W>겹</W>
            </>
          )}
          {(extra || cmd.silent) && <Check value={cmd.silent} onChange={(v) => set('silent')(v || undefined)} label="알림 끄기" />}
        </>
      );
    case 'text':
    case 'note':
      return (
        <>
          <W>{cmd.do === 'text' ? '본문에' : '알림'}</W>
          <span className="grow">
            <TemplateInput value={cmd.text} onChange={(v) => set('text')(v ?? '')} placeholder={cmd.do === 'text' ? '덧붙일 문단' : '알림 문구'} />
          </span>
          <W>{cmd.do === 'text' ? '덧붙이기' : '띄우기'}</W>
        </>
      );
    case 'record':
      return (
        <>
          <W>인생표에</W>
          <span className="grow">
            <TemplateInput value={cmd.text} onChange={(v) => set('text')(v ?? '')} placeholder="남길 문구" />
          </span>
          <W>기록</W>
          <Select value={String(cmd.importance ?? 3)} onChange={(v) => set('importance')(Number(v ?? 3))} options={[1, 2, 3, 4, 5].map((n) => [String(n), `중요도 ${n}`] as const)} />
        </>
      );
    case 'image':
      return (
        <>
          <W>일러스트</W>
          <Select value={cmd.asset} onChange={set('asset')} options={(pkg.assets ?? []).map((a) => [a.id, a.alt ?? a.id] as const)} />
          <W>보여주기</W>
        </>
      );
    case 'goto':
      return (
        <>
          <W>이벤트</W>
          <EventPicker value={cmd.event || undefined} onChange={(v) => set('event')(v ?? '')} empty="(고르세요)" />
          <W>(으)로 이동</W>
        </>
      );
    case 'end':
      return (
        <>
          <W>엔딩</W>
          <Select value={cmd.ending} onChange={set('ending')} options={pkg.endings.map((e) => [e.id, e.title] as const)} />
          <W>(으)로 끝내기</W>
        </>
      );
    case 'achieve':
      return (
        <>
          <W>도전과제</W>
          <Select value={cmd.id} onChange={set('id')} options={(pkg.achievements ?? []).map((a) => [a.id, a.title] as const)} />
          <W>달성</W>
        </>
      );
    case 'advance':
      return (
        <>
          <W>시간</W>
          <ExprInput value={cmd.amount} numeric onChange={(v) => set('amount')(v ?? 1)} />
          <W>단위 흘려보내기</W>
        </>
      );
    case 'endTurn':
      return (
        <>
          <W>턴</W>
          <ExprInput value={cmd.times} numeric onChange={set('times')} placeholder="1" />
          <W>번 마치기</W>
        </>
      );
    case 'call': {
      const script = pkg.scripts?.find((s) => s.id === cmd.script);
      return (
        <>
          <W>스크립트</W>
          <Select value={cmd.script} onChange={set('script')} options={(pkg.scripts ?? []).map((s) => [s.id, s.name ?? s.id] as const)} />
          <W>실행</W>
          {(script?.params ?? []).map((p) => (
            <span key={p} className="arg">
              {p}:
              <ExprInput
                value={cmd.args?.[p] as string | number | undefined}
                numeric
                onChange={(v) =>
                  edit((c) => {
                    c.args ??= {};
                    if (v === undefined) delete c.args[p];
                    else c.args[p] = v;
                  })
                }
              />
            </span>
          ))}
        </>
      );
    }
    default:
      return null;
  }
}

/** ㄷ자 블록: 만약 / 확률 분기 / 판정 */
function CBlockBody({
  cmd,
  edit,
  depth,
  grip,
  tools,
  prev,
  reshape,
  index,
}: {
  cmd: Command;
  edit: (fn: (c: any) => void) => void;
  depth: number;
  grip: ReactNode;
  tools: ReactNode;
  prev?: Command;
  reshape: (fn: (cmds: Command[]) => void) => void;
  index: number;
}) {
  const mouth = (label: ReactNode, list: Command[] | undefined, key: string, extra?: ReactNode) => (
    <>
      {label !== null && (
        <div className="block-row mid">
          <span className="bw">{label}</span>
          {extra}
        </div>
      )}
      <div className="c-mouth">
        <CommandList list={list} depth={depth + 1} edit={(fn) => edit((c) => fn((c[key] ??= [])))} />
      </div>
    </>
  );

  if (cmd.do === 'if') {
    const mergeable = prev?.do === 'if' && sameCond(prev.cond, cmd.cond) && cmd.cond.trim() !== '';
    return (
      <>
        <div className="block-row">
          {grip}
          <span className="bw strong">만약</span>
          <CondInput value={cmd.cond} placeholder="조건을 끼우세요" onChange={(v) => edit((c) => void (c.cond = v ?? ''))} />
          <span className="bw">(이)라면</span>
          {mergeable && (
            <button
              type="button"
              className="merge-btn"
              title="바로 위 '만약' 블록과 조건이 같습니다. 안쪽 블록을 위 블록으로 옮겨 하나로 합칩니다. (위 블록이 조건에 쓰인 값을 바꾸면 결과가 달라질 수 있어요)"
              onClick={() =>
                reshape((l) => {
                  const a = l[index - 1] as Extract<Command, { do: 'if' }>;
                  const b = l[index] as Extract<Command, { do: 'if' }>;
                  a.then.push(...clone(draftValue(b.then)));
                  if (b.else?.length) (a.else ??= []).push(...clone(draftValue(b.else)));
                  l.splice(index, 1);
                })
              }
            >
              ⇡ 위와 같은 조건 · 합치기
            </button>
          )}
          {tools}
        </div>
        {mouth(null, cmd.then, 'then')}
        {cmd.else !== undefined ? (
          mouth(
            '아니면',
            cmd.else,
            'else',
            <button type="button" className="mini" title="'아니면' 칸 없애기 (안의 블록도 지워집니다)" onClick={() => edit((c) => void delete c.else)}>
              ✕
            </button>,
          )
        ) : (
          <div className="block-row mid thin">
            <button type="button" className="mini" onClick={() => edit((c) => void (c.else = []))}>
              ＋ 아니면
            </button>
          </div>
        )}
        <div className="c-foot" />
      </>
    );
  }

  if (cmd.do === 'random') {
    const weights = cmd.branches.map((b) => b.weight);
    const total = weights.every((w) => typeof w === 'number') ? (weights as number[]).reduce((a, b) => a + Math.max(0, b), 0) : 0;
    return (
      <>
        <div className="block-row">
          {grip}
          <span className="bw strong">확률로 하나 고르기</span>
          {tools}
        </div>
        {cmd.branches.map((b, j) => (
          <div key={j}>
            <div className="block-row mid">
              <span className="bw">확률</span>
              <span className="small-input">
                <ExprInput value={b.weight} numeric onChange={(v) => v !== undefined && edit((c) => (c.branches[j].weight = v))} />
              </span>
              <span className="bw">%</span>
              {total > 0 && total !== 100 && <span className="bw dim">(실제 {Math.round((Math.max(0, b.weight as number) / total) * 100)}%)</span>}
              <button type="button" className="mini" title="분기 삭제" onClick={() => edit((c) => c.branches.splice(j, 1))}>
                ✕
              </button>
            </div>
            <div className="c-mouth">
              <CommandList list={b.then} depth={depth + 1} edit={(fn) => edit((c) => fn(c.branches[j].then))} />
            </div>
          </div>
        ))}
        <div className="block-row mid thin">
          <button type="button" className="mini" onClick={() => edit((c) => c.branches.push({ weight: nextPercent(c.branches.map((b: { weight: NumOrExpr }) => b.weight)), then: [] }))}>
            ＋ 갈래
          </button>
          {total !== 100 && total > 0 && <span className="bw dim">합계 {total}%</span>}
        </div>
        <div className="c-foot" />
      </>
    );
  }

  if (cmd.do === 'check')
    return (
      <>
        <div className="block-row">
          {grip}
          <span className="bw strong">판정</span>
          <CheckChance spec={cmd.check} onChange={(s) => edit((c) => void (c.check = s))} />
          {tools}
        </div>
        {mouth('성공하면', cmd.success, 'success')}
        {mouth('실패하면', cmd.failure, 'failure')}
        <div className="c-foot" />
      </>
    );
  return null;
}
