// 인벤토리: 아이템·상태·기타를 한 목록에서 다룬다.
// 저장 형식은 그대로 아이템(items)과 상태(statuses) 두 목록이고, 기타는 category가 'other'인 아이템이다.
// 종류를 바꾸면 해당 목록으로 옮겨 담는다.

import type { Command, ItemDef, StatusDef, StoryPackage } from '@engine';
import { ask } from '../../lib/dialog';
import { renameRefs } from '../../lib/rename';
import { Collection } from '../Collection';
import { CommandList } from '../CommandEditor';
import { CondInput } from '../CondBlocks';
import { useEditor } from '../context';
import { Check, Field, IdInput, More, NumInput, OptText, Row, Section, Select, TemplateInput, TextInput, Tip, move, uniqueId } from '../fields';
import { ModifiersEditor } from './Data';

type Kind = 'item' | 'status' | 'other';

const KIND_LABEL: Record<Kind, string> = { item: '아이템', status: '상태', other: '기타' };
const KIND_HINT: Record<Kind, string> = {
  item: '개수가 있는 소지품. 소지품 창에 보이고, 플레이어가 직접 쓰게 할 수도 있습니다.',
  status: '부상·축복처럼 한동안 이어지는 효과. 지속 턴과 성격(이로움/해로움)이 있습니다.',
  other: '화면에 드러나지 않는 표식. 가지고 있는 동안의 효과만 조용히 적용합니다.',
};

interface Entry {
  /** 목록용 이름표: i:고유이름 / s:고유이름 */
  id: string;
  raw: string;
  kind: Kind;
  def: ItemDef | StatusDef;
}

export const entryId = (kind: 'item' | 'status', raw: string) => `${kind === 'item' ? 'i' : 's'}:${raw}`;

function entriesOf(pkg: StoryPackage): Entry[] {
  return [
    ...(pkg.items ?? []).map((def): Entry => ({ id: entryId('item', def.id), raw: def.id, kind: def.category === 'other' ? 'other' : 'item', def })),
    ...(pkg.statuses ?? []).map((def): Entry => ({ id: entryId('status', def.id), raw: def.id, kind: 'status', def })),
  ];
}

const effectCount = (def: ItemDef | StatusDef) => Object.keys(def.modifiers ?? {}).length + (def.onTurnEnd?.length ? 1 : 0);

export function InventorySection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const entries = entriesOf(pkg);
  const go = (kind: 'item' | 'status', raw: string) => open('inventory', entryId(kind, raw));
  const bucket = (k: Kind) => (k === 'status' ? 'status' : 'item');

  const edit = (e: Entry, fn: (d: ItemDef & StatusDef) => void) =>
    update((d) => fn((e.kind === 'status' ? d.statuses! : d.items!).find((t) => t.id === e.raw)! as ItemDef & StatusDef));

  /** 종류 바꾸기. 아이템↔상태는 목록을 옮기고, 아이템↔기타는 표시만 바꾼다 */
  const changeKind = async (e: Entry, to: Kind) => {
    if (to === e.kind) return;
    if (bucket(e.kind) === bucket(to)) {
      edit(e, (t) => {
        if (to === 'other') {
          t.category = 'other';
          t.hidden = true;
        } else {
          t.category = undefined;
          t.hidden = undefined;
        }
      });
      return;
    }
    const lost: string[] = [];
    if (e.kind === 'status') {
      const s = e.def as StatusDef;
      if (s.duration || s.maxStacks || s.tone) lost.push('지속 턴·최대 중첩·성격');
      if (s.onTick?.length) lost.push('시간이 흐를 때 효과');
    } else {
      const it = e.def as ItemDef;
      if (it.use || it.max !== undefined) lost.push('직접 사용 설정·최대 소지 수');
    }
    const msg = `'${e.def.name}'을(를) ${KIND_LABEL[to]}(으)로 바꿉니다.${lost.length ? `\n${lost.join(', ')} 설정은 없어집니다.` : ''}\n이 요소를 쓰던 블록·조건(아이템 얻기, 상태 걸기 등)은 새 종류에 맞게 다시 골라야 하며, 「검사」가 찾아 줍니다. 바꿀까요?`;
    if (!(await ask(msg, '바꾸기'))) return;
    update((d) => {
      const base = { id: '', name: e.def.name, description: e.def.description, icon: e.def.icon, hidden: e.def.hidden, modifiers: e.def.modifiers && { ...e.def.modifiers }, onTurnEnd: e.def.onTurnEnd };
      if (to === 'status') {
        const it = e.def as ItemDef;
        const id = uniqueId(e.raw, (d.statuses ?? []).map((x) => x.id));
        d.items = d.items!.filter((x) => x.id !== e.raw);
        const next: StatusDef = { ...base, id, hidden: it.category === 'other' ? undefined : it.hidden, onApply: it.onGain, onExpire: it.onLose };
        (d.statuses ??= []).push(JSON.parse(JSON.stringify(next)));
        open('inventory', entryId('status', id));
      } else {
        const s = e.def as StatusDef;
        const id = uniqueId(e.raw, (d.items ?? []).map((x) => x.id));
        d.statuses = d.statuses!.filter((x) => x.id !== e.raw);
        const next: ItemDef = { ...base, id, onGain: s.onApply, onLose: s.onExpire };
        if (to === 'other') (next.category = 'other'), (next.hidden = true);
        (d.items ??= []).push(JSON.parse(JSON.stringify(next)));
        open('inventory', entryId('item', id));
      }
    });
  };

  const rename = (e: Entry, nv: string) =>
    update((d) => {
      const kind = bucket(e.kind);
      renameRefs(d, kind, e.raw, nv);
      (kind === 'status' ? d.statuses! : d.items!).find((x) => x.id === e.raw)!.id = nv;
      open('inventory', entryId(kind, nv));
    });

  const duplicate = (id: string) =>
    update((d) => {
      const e = entries.find((x) => x.id === id)!;
      const list = (e.kind === 'status' ? d.statuses! : d.items!) as { id: string }[];
      const copy = { ...JSON.parse(JSON.stringify(e.def)), id: uniqueId(e.raw, list.map((v) => v.id)) };
      list.push(copy);
      open('inventory', entryId(bucket(e.kind), copy.id));
    });

  const remove = (id: string) =>
    update((d) => {
      const e = entries.find((x) => x.id === id)!;
      if (e.kind === 'status') d.statuses = d.statuses!.filter((t) => t.id !== e.raw);
      else d.items = d.items!.filter((t) => t.id !== e.raw);
    });

  return (
    <Collection<Entry>
      items={entries}
      selected={selected}
      onSelect={(id) => open('inventory', id)}
      label={(e) => `${e.def.icon ?? ''} ${e.def.name}`}
      sub={(e) => e.def.description ?? (e.kind === 'status' ? ((e.def as StatusDef).duration ? `${(e.def as StatusDef).duration}턴 동안` : '풀 때까지') : undefined)}
      badge={(e) => (
        <>
          <span className={`badge kind-${e.kind}`}>{KIND_LABEL[e.kind]}</span>
          {effectCount(e.def) > 0 && <span className="badge">효과 있음</span>}
        </>
      )}
      search={(e) => `${e.raw} ${e.def.name} ${KIND_LABEL[e.kind]}`}
      groupings={[{ id: 'kind', label: '종류별', by: (e) => [{ key: e.kind, label: KIND_LABEL[e.kind] }] }]}
      defaultGrouping="kind"
      addLabel="요소"
      onAdd={() =>
        update((d) => {
          const id = uniqueId('item', (d.items ?? []).map((t) => t.id));
          (d.items ??= []).push({ id, name: '새 요소' });
          go('item', id);
        })
      }
      onDuplicate={duplicate}
      onRemove={remove}
      onMove={(a, b) => {
        const ea = entries[a];
        const eb = entries[b];
        if (!ea || !eb || bucket(ea.kind) !== bucket(eb.kind)) return;
        update((d) => {
          const list = (ea.kind === 'status' ? d.statuses! : d.items!) as { id: string }[];
          move(list, list.findIndex((x) => x.id === ea.raw), list.findIndex((x) => x.id === eb.raw));
        });
      }}
    >
      {(e) => <EntryEditor key={e.id} e={e} entries={entries} edit={edit} changeKind={changeKind} rename={rename} />}
    </Collection>
  );
}

function EntryEditor({ e, entries, edit, changeKind, rename }: { e: Entry; entries: Entry[]; edit: (e: Entry, fn: (d: ItemDef & StatusDef) => void) => void; changeKind: (e: Entry, to: Kind) => void; rename: (e: Entry, nv: string) => void }) {
  const def = e.def as ItemDef & StatusDef;
  const isStatus = e.kind === 'status';
  const hooks: { key: 'onTurnEnd' | 'onGain' | 'onLose' | 'onApply' | 'onExpire' | 'onTick'; hat: string }[] = isStatus
    ? [
        { key: 'onTurnEnd', hat: '▶ 걸려 있는 동안 매 턴 끝에' },
        { key: 'onApply', hat: '▶ 걸릴 때' },
        { key: 'onExpire', hat: '▶ 지속 턴이 다 되어 풀릴 때' },
        { key: 'onTick', hat: '▶ 시간이 한 단위 흐를 때마다' },
      ]
    : [
        { key: 'onTurnEnd', hat: '▶ 가지고 있는 동안 매 턴 끝에' },
        { key: 'onGain', hat: '▶ 처음 가지게 될 때' },
        { key: 'onLose', hat: '▶ 모두 잃어 하나도 없게 될 때' },
      ];
  const hookList = (key: (typeof hooks)[number]['key'], hat: string) => (
    <CommandList key={key} list={def[key] as Command[] | undefined} edit={(fn) => edit(e, (t) => fn(((t[key] as Command[] | undefined) ??= [])))} hat={<div className="block-row"><span className="bw strong">{hat}</span></div>} />
  );
  const [always, rare] = [hooks.slice(0, 1), hooks.slice(1)];
  const sameKind = entries.filter((x) => (x.kind === 'status') === isStatus).map((x) => x.raw);

  return (
    <Section title={def.name} topic="inventory">
      <Row>
        <Field label="종류" hint={KIND_HINT[e.kind]}>
          <Select
            value={e.kind}
            onChange={(x) => void changeKind(e, (x ?? 'item') as Kind)}
            options={[
              ['item', '아이템'],
              ['status', '상태'],
              ['other', '기타'],
            ]}
          />
        </Field>
        <Field label="이름">
          <TextInput value={def.name} onChange={(x) => edit(e, (t) => void (t.name = x))} />
        </Field>
        <Field label="아이콘">
          <OptText value={def.icon} placeholder="🗝" onChange={(x) => edit(e, (t) => void (t.icon = x))} />
        </Field>
      </Row>
      <p className="muted small">{KIND_HINT[e.kind]}</p>
      <Field label="설명" wide>
        <OptText value={def.description} onChange={(x) => edit(e, (t) => void (t.description = x))} />
      </Field>
      {isStatus && (
        <Row>
          <Field label="성격">
            <Select
              value={def.tone}
              allowEmpty="중립"
              onChange={(x) => edit(e, (t) => void (t.tone = x))}
              options={[
                ['positive', '이로움'],
                ['negative', '해로움'],
              ]}
            />
          </Field>
          <Field label="지속 턴" hint="이 턴 수가 지나면 저절로 풀립니다. 비우면 '상태 풀기' 블록으로 풀 때까지">
            <NumInput value={def.duration} placeholder="풀 때까지" onChange={(x) => edit(e, (t) => void (t.duration = x))} />
          </Field>
        </Row>
      )}

      <h4>{isStatus ? '걸려 있는 동안의 효과' : '가지고 있는 동안의 효과'}</h4>
      <div className="field-label">
        변수 보정
        <Tip>{isStatus ? '중첩 수만큼 곱해서 더합니다. 예: 부상(체력 -1)이 2번 겹치면 체력 -2' : "예: '부적'을 가지면 행운 +1. 원래 값은 그대로 두고 읽을 때만 더해집니다."}</Tip>
      </div>
      <ModifiersEditor value={def.modifiers} onChange={(fn) => edit(e, (t) => fn((t.modifiers ??= {})))} />
      {always.map((h) => hookList(h.key, h.hat))}

      <More active={!!(def.max !== undefined || def.maxStacks || def.hidden || def.onGain?.length || def.onLose?.length || def.onApply?.length || def.onExpire?.length || def.onTick?.length)}>
        <Row>
          <Field label="고유 이름" hint="다른 곳에서 이 요소를 가리키는 이름. 조건의 ‘가지고 있음’·‘걸려 있음’이 이 이름으로 찾습니다.">
            <IdInput value={e.raw} taken={sameKind} onChange={(nv) => rename(e, nv)} />
          </Field>
          {isStatus ? (
            <Field label="최대 중첩" hint="같은 상태가 몇 번까지 겹쳐 걸리는지">
              <NumInput value={def.maxStacks} placeholder="1" onChange={(x) => edit(e, (t) => void (t.maxStacks = x))} />
            </Field>
          ) : (
            <Field label="최대 소지 수">
              <NumInput value={def.max} placeholder="무제한" onChange={(x) => edit(e, (t) => void (t.max = x))} />
            </Field>
          )}
          <Check value={def.hidden} onChange={(x) => edit(e, (t) => void (t.hidden = x || undefined))} label={isStatus ? '상태창에 숨김' : '소지품 창에 숨김'} />
        </Row>
        {rare.map((h) => hookList(h.key, h.hat))}
      </More>

      {!isStatus && e.kind === 'item' && (
        <>
          <h4>
            <Check value={!!def.use} onChange={(on) => edit(e, (t) => void (t.use = on ? { consume: true, do: [] } : undefined))} label="플레이어가 직접 사용할 수 있음" />
          </h4>
          {def.use && (
            <>
              <Row>
                <Field label="사용 조건">
                  <CondInput value={def.use.when} placeholder="언제나 사용 가능" onChange={(x) => edit(e, (t) => void (t.use!.when = x))} />
                </Field>
                <Check value={def.use.consume !== false} onChange={(x) => edit(e, (t) => void (t.use!.consume = x))} label="사용하면 1개 소모" />
              </Row>
              <Field label="사용 시 본문" wide>
                <TemplateInput value={def.use.text} onChange={(x) => edit(e, (t) => void (t.use!.text = x))} />
              </Field>
              <CommandList list={def.use.do} edit={(fn) => edit(e, (t) => fn((t.use!.do ??= [])))} />
            </>
          )}
        </>
      )}
    </Section>
  );
}
