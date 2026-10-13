import { NAME_STYLES, type NameStyleId, type TableDef, type Value, type VariableDef } from '@engine';
import { ask, tell } from '../../lib/dialog';
import { imageToDataUrl, pickFile } from '../../lib/files';
import { canAddOrigin } from '../../lib/limits';
import { renameRefs } from '../../lib/rename';
import { Collection } from '../Collection';
import { CommandList } from '../CommandEditor';
import { CondInput } from '../CondBlocks';
import { useEditor } from '../context';
import {
  AssetSelect,
  Check,
  ExprInput,
  Field,
  IdInput,
  Intro,
  More,
  NumInput,
  OptText,
  Row,
  Section,
  Select,
  TemplateArea,
  TemplateInput,
  TextInput,
  ThresholdList,
  move,
  uniqueId,
} from '../fields';

// ───────────────────────── 변수 ─────────────────────────

export function VariablesSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const edit = (id: string, fn: (v: VariableDef) => void) => update((d) => fn(d.variables.find((v) => v.id === id)!));
  return (
    <Collection
      items={pkg.variables}
      selected={selected}
      onSelect={(id) => open('variables', id)}
      label={(v) => v.name ?? v.id}
      sub={(v) => (v.formula ? '계산으로 정해짐' : v.type === 'number' ? `처음 ${v.initialExpr ? '무작위' : (v.initial ?? 0)}${v.max !== undefined ? ` · 최대 ${typeof v.max === 'number' ? v.max : (pkg.variables.find((x) => x.id === v.max)?.name ?? v.max)}` : ''}` : v.type === 'string' ? '글자' : '예/아니오')}
      badge={(v) => (v.display?.as && v.display.as !== 'hidden' ? <span className="badge">화면에 보임</span> : v.scope === 'meta' ? <span className="badge">판을 넘어 유지</span> : null)}
      search={(v) => `${v.id} ${v.name ?? ''} ${v.group ?? ''}`}
      addLabel="변수"
      onAdd={() =>
        update((d) => {
          const id = uniqueId('새변수', d.variables.map((v) => v.id));
          d.variables.push({ id, type: 'number', initial: 0 });
          open('variables', id);
        })
      }
      onDuplicate={(id) =>
        update((d) => {
          const src = d.variables.find((v) => v.id === id)!;
          const copy = { ...JSON.parse(JSON.stringify(src)), id: uniqueId(id, d.variables.map((v) => v.id)) };
          d.variables.splice(d.variables.indexOf(src) + 1, 0, copy);
          open('variables', copy.id);
        })
      }
      onRemove={(id) => update((d) => void (d.variables = d.variables.filter((v) => v.id !== id)))}
      onMove={(a, b) => update((d) => move(d.variables, a, b))}
    >
      {(v) => (
        <Section title={v.name ?? v.id} topic="variables">
          <Row>
            <Field label="이름" hint="조건과 수식에서 이 이름으로 부릅니다. 바꾸면 쓰던 곳도 함께 바뀝니다.">
              <IdInput
                value={v.id}
                taken={pkg.variables.map((x) => x.id)}
                onChange={(nv) =>
                  update((d) => {
                    renameRefs(d, 'var', v.id, nv);
                    d.variables.find((x) => x.id === v.id)!.id = nv;
                    open('variables', nv);
                  })
                }
              />
            </Field>
            <Field label="종류">
              <Select
                value={v.type}
                onChange={(x) =>
                  edit(v.id, (t) => {
                    t.type = x ?? 'number';
                    t.initial = t.type === 'number' ? 0 : t.type === 'bool' ? false : '';
                  })
                }
                options={[
                  ['number', '수치'],
                  ['string', '문자'],
                  ['bool', '참/거짓'],
                ]}
              />
            </Field>
            {v.formula === undefined && (
              <Field label="시작값">
                <InitialInput v={v} onChange={(x) => edit(v.id, (t) => void (t.initial = x))} />
              </Field>
            )}
            {v.type === 'number' && (
              <>
                <Field label="최솟값" hint="이보다 작아지지 않습니다. 숫자 또는 수식">
                  <ExprInput value={v.min} numeric onChange={(x) => edit(v.id, (t) => void (t.min = x))} />
                </Field>
                <Field label="최댓값" hint="이보다 커지지 않습니다. 다른 변수도 됩니다(예: 최대체력)">
                  <ExprInput value={v.max} numeric onChange={(x) => edit(v.id, (t) => void (t.max = x))} />
                </Field>
              </>
            )}
            <Field label="상태창 표시" hint="플레이 화면 위쪽 상태창에 보일지와 모양">
              <Select
                value={v.display?.as ?? 'hidden'}
                onChange={(x) => edit(v.id, (t) => void ((t.display ??= {}).as = x))}
                options={[
                  ['hidden', '숨김'],
                  ['number', '숫자'],
                  ['bar', '막대 (최댓값 필요)'],
                  ['text', '글자 (구간별 문구)'],
                ]}
              />
            </Field>
          </Row>
          <Row>
            <Field label="화면에 보일 이름" hint="비우면 왼쪽 이름을 그대로 보여 줍니다">
              <OptText value={v.name} placeholder={v.id} onChange={(x) => edit(v.id, (t) => void (t.name = x))} />
            </Field>
            <Check
              value={!!v.display?.notify}
              onChange={(x) => edit(v.id, (t) => void ((t.display ??= {}).notify = x || undefined))}
              label="값이 바뀌면 결과 화면에 알림"
            />
          </Row>
          <More
            active={!!(v.formula !== undefined || v.initialExpr || v.group || v.scope || v.integer || v.description || v.display?.order !== undefined || v.display?.format || v.display?.icon || v.display?.color || v.display?.labels?.length || typeof v.display?.notify === 'string')}
          >
            <Row>
              <Check value={!!v.formula} onChange={(on) => edit(v.id, (t) => void (t.formula = on ? '0' : undefined))} label="계산으로 정해지는 변수 (직접 못 바꿈)" />
              <Check value={v.scope === 'meta'} onChange={(on) => edit(v.id, (t) => void (t.scope = on ? 'meta' : undefined))} label="다음 판에도 유지" />
              {v.type === 'number' && <Check value={v.integer} onChange={(x) => edit(v.id, (t) => void (t.integer = x || undefined))} label="정수만" />}
            </Row>
            {v.formula !== undefined ? (
              <Field label="수식" wide hint="예: 힘 + 민첩 * 2">
                <ExprInput value={v.formula} onChange={(x) => edit(v.id, (t) => void (t.formula = String(x ?? '0')))} />
              </Field>
            ) : (
              <Field label="무작위 시작값" hint="두 칸을 채우면 위의 시작값 대신, 시작할 때마다 이 범위에서 아무 숫자나 뽑습니다. 비우면 사용하지 않습니다.">
                <RandomStart value={v.initialExpr} onChange={(x) => edit(v.id, (t) => void (t.initialExpr = x))} />
              </Field>
            )}
            <Row>
              <Field label="그룹" hint="같은 그룹 이름을 붙인 변수끼리 묶습니다. 그중 가장 높은 값을 가진 변수를 조건에서 찾을 수 있습니다.">
                <OptText value={v.group} onChange={(x) => edit(v.id, (t) => void (t.group = x))} />
              </Field>
              <Field label="상태창 순서">
                <NumInput value={v.display?.order} onChange={(x) => edit(v.id, (t) => void ((t.display ??= {}).order = x))} />
              </Field>
              <Field label="표시 형식" hint="현재 값이 들어갈 자리를 {value}로 적습니다. 예: {value}원 → 30원">
                <OptText value={v.display?.format} onChange={(x) => edit(v.id, (t) => void ((t.display ??= {}).format = x))} />
              </Field>
              <Field label="아이콘">
                <OptText value={v.display?.icon} placeholder="❤" onChange={(x) => edit(v.id, (t) => void ((t.display ??= {}).icon = x))} />
              </Field>
              <Field label="막대 색">
                <input type="color" value={v.display?.color ?? '#c0563f'} onChange={(e) => edit(v.id, (t) => void ((t.display ??= {}).color = e.target.value))} />
              </Field>
              {v.display?.notify && (
                <Field label="알림 형식" hint="{name}은 이름, {delta}는 바뀐 양, {value}는 지금 값이 들어갑니다">
                  <OptText
                    value={typeof v.display.notify === 'string' ? v.display.notify : undefined}
                    placeholder="{name} {delta}"
                    onChange={(x) => edit(v.id, (t) => void (t.display!.notify = x ?? true))}
                  />
                </Field>
              )}
            </Row>
            {v.type === 'number' && v.display?.as && v.display.as !== 'hidden' && (
              <Field label="구간별 문구" wide hint="값에 따라 상태창에 말로 보여 줍니다. 위에서부터 '값이 ○ 이하이면' 처음 맞는 문구를 씁니다. 「글자」 표시에서는 이 문구가 값을 대신합니다.">
                <ThresholdList
                  value={v.display.labels?.map((l) => ({ n: l.upTo, text: l.text }))}
                  onChange={(next) => edit(v.id, (t) => void ((t.display ??= {}).labels = next?.map((x) => ({ upTo: x.n, text: x.text }))))}
                  before="값이"
                  after="이하이면"
                  textPlaceholder="예: 희미함 (비우면 표시 안 함)"
                />
              </Field>
            )}
            <Field label="메모" wide>
              <OptText value={v.description} onChange={(x) => edit(v.id, (t) => void (t.description = x))} />
            </Field>
          </More>
        </Section>
      )}
    </Collection>
  );
}

const RANDOM_RANGE = /^\s*randint\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*$/;

/** '3부터 8 사이' 두 칸으로 적는 무작위 시작값. 그 모양이 아닌 식은 그대로 보여 준다 */
function RandomStart({ value, onChange }: { value: string | undefined; onChange: (x: string | undefined) => void }) {
  const m = value ? RANDOM_RANGE.exec(value) : null;
  if (value && !m) return <ExprInput value={value} onChange={(x) => onChange(x as string | undefined)} />;
  const lo = m ? Number(m[1]) : undefined;
  const hi = m ? Number(m[2]) : undefined;
  const write = (a: number | undefined, b: number | undefined) => onChange(a === undefined && b === undefined ? undefined : `randint(${a ?? b}, ${b ?? a})`);
  return (
    <span className="range-input">
      <NumInput value={lo} placeholder="최소" onChange={(a) => write(a, hi)} />
      <span className="bw">부터</span>
      <NumInput value={hi} placeholder="최대" onChange={(b) => write(lo, b)} />
      <span className="bw">사이</span>
    </span>
  );
}

function InitialInput({ v, onChange }: { v: VariableDef; onChange: (x: Value | undefined) => void }) {
  if (v.type === 'bool') return <Check value={Boolean(v.initial)} onChange={onChange} label="참" />;
  if (v.type === 'string') return <TextInput value={String(v.initial ?? '')} onChange={onChange} />;
  return <NumInput value={typeof v.initial === 'number' ? v.initial : undefined} onChange={onChange} />;
}

// ───────────────────────── 표 ─────────────────────────

export function TablesSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const tables = pkg.tables ?? [];
  const edit = (id: string, fn: (t: TableDef) => void) => update((d) => fn(d.tables!.find((t) => t.id === id)!));
  return (
    <Collection
      items={tables}
      selected={selected}
      onSelect={(id) => open('tables', id)}
      label={(t) => t.name ?? t.id}
      sub={(t) => `${t.match === 'range' ? '범위' : '일치'} · ${t.rows.length}행`}
      addLabel="표"
      onAdd={() =>
        update((d) => {
          const id = uniqueId('표', (d.tables ?? []).map((t) => t.id));
          (d.tables ??= []).push({ id, match: 'range', columns: ['값'], rows: [{ key: 0, values: { 값: 0 } }] });
          open('tables', id);
        })
      }
      onRemove={(id) => update((d) => void (d.tables = d.tables!.filter((t) => t.id !== id)))}
    >
      {(t) => (
        <Section title={t.name ?? t.id} topic="tables" help={<>수식에서 <code>lookup('{t.id}', 키, '열이름')</code>으로 읽습니다.</>}>
          <Row>
            <Field label="고유 이름">
              <IdInput
                value={t.id}
                taken={tables.map((x) => x.id)}
                onChange={(nv) =>
                  update((d) => {
                    renameRefs(d, 'table', t.id, nv);
                    d.tables!.find((x) => x.id === t.id)!.id = nv;
                    open('tables', nv);
                  })
                }
              />
            </Field>
            <Field label="이름">
              <OptText value={t.name} onChange={(x) => edit(t.id, (tt) => void (tt.name = x))} />
            </Field>
            <Field label="찾는 방식">
              <Select
                value={t.match}
                onChange={(x) => edit(t.id, (tt) => void (tt.match = x ?? 'range'))}
                options={[
                  ['range', '범위 (키 이하인 첫 행)'],
                  ['exact', '일치 (키가 같은 행)'],
                ]}
              />
            </Field>
          </Row>
          <table className="grid">
            <thead>
              <tr>
                <th>{t.match === 'range' ? '키 (이하)' : '키'}</th>
                {t.columns.map((c, ci) => (
                  <th key={ci}>
                    <input
                      value={c}
                      onChange={(e) =>
                        edit(t.id, (tt) => {
                          const old = tt.columns[ci];
                          tt.columns[ci] = e.target.value;
                          for (const r of [...tt.rows.map((r) => r.values), ...(tt.fallback ? [tt.fallback] : [])]) {
                            r[e.target.value] = r[old];
                            delete r[old];
                          }
                        })
                      }
                    />
                    <button className="icon danger" onClick={() => edit(t.id, (tt) => void tt.columns.splice(ci, 1))}>
                      ✕
                    </button>
                  </th>
                ))}
                <th>
                  <button className="btn small" onClick={() => edit(t.id, (tt) => void tt.columns.push(uniqueId('열', tt.columns)))}>
                    ＋열
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri}>
                  <td>
                    <CellInput value={r.key} onChange={(x) => edit(t.id, (tt) => void (tt.rows[ri].key = typeof x === 'boolean' ? String(x) : x))} />
                  </td>
                  {t.columns.map((c) => (
                    <td key={c}>
                      <CellInput value={r.values[c]} onChange={(x) => edit(t.id, (tt) => void (tt.rows[ri].values[c] = x))} />
                    </td>
                  ))}
                  <td>
                    <button className="icon danger" onClick={() => edit(t.id, (tt) => void tt.rows.splice(ri, 1))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="fallback">
                <td>
                  <label className="check">
                    <input type="checkbox" checked={!!t.fallback} onChange={(e) => edit(t.id, (tt) => void (tt.fallback = e.target.checked ? {} : undefined))} />
                    {t.match === 'range' ? '그 이상' : '그 외'}
                  </label>
                </td>
                {t.columns.map((c) => (
                  <td key={c}>{t.fallback && <CellInput value={t.fallback[c]} onChange={(x) => edit(t.id, (tt) => void (tt.fallback![c] = x))} />}</td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
          <button className="btn small" onClick={() => edit(t.id, (tt) => void tt.rows.push({ key: 0, values: {} }))}>
            ＋ 행 추가
          </button>
        </Section>
      )}
    </Collection>
  );
}

/** 숫자처럼 보이면 숫자, true/false면 참거짓, 그 외 문자 */
function CellInput({ value, onChange }: { value: Value | undefined; onChange: (v: Value) => void }) {
  return (
    <input
      value={value === undefined ? '' : String(value)}
      onChange={(e) => {
        const s = e.target.value;
        onChange(s === 'true' ? true : s === 'false' ? false : s !== '' && !Number.isNaN(Number(s)) ? Number(s) : s);
      }}
    />
  );
}

// ───────────────────────── 보정치 편집 ─────────────────────────

export function ModifiersEditor({ value, onChange }: { value: Record<string, number | string> | undefined; onChange: (fn: (m: Record<string, number | string>) => void) => void }) {
  const { pkg } = useEditor();
  const entries = Object.entries(value ?? {});
  const free = pkg.variables.filter((v) => v.type === 'number' && !v.formula && !(v.id in (value ?? {})));
  return (
    <div className="modifiers">
      {entries.map(([k, v]) => (
        <div key={k} className="row">
          <span className="mono">{k}</span>
          <ExprInput value={v} numeric onChange={(x) => onChange((m) => void (m[k] = x ?? 0))} />
          <button className="icon danger" onClick={() => onChange((m) => void delete m[k])}>
            ✕
          </button>
        </div>
      ))}
      {free.length > 0 && (
        <select className="add-command" value="" onChange={(e) => e.target.value && onChange((m) => void (m[e.target.value] = 1))}>
          <option value="">＋ 보정할 변수…</option>
          {free.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name ?? v.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ───────────────────────── 출신 ─────────────────────────

export function OriginsSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const cfg = pkg.origins ?? { mode: 'random' as const, list: [] };
  const ensure = (d: typeof pkg) => (d.origins ??= { mode: 'random', list: [] });
  // 직접 고르는 방식은 후보가 5개를 넘을 수 없다
  const choosing = cfg.mode === 'choose';
  return (
    <>
      <Intro topic="origins">게임을 시작할 때 고르는 출생지·배경입니다. 출신마다 시작 효과가 다릅니다. 하나도 없으면 이 단계를 건너뜁니다.</Intro>
      <More label="출신 화면 설정" active={choosing || cfg.offer !== undefined || !!cfg.title || !!cfg.text}>
        <Row>
          <Field label="정하는 방식">
            <Select
              value={cfg.mode}
              onChange={async (x) => {
                const mode = x ?? 'random';
                if (mode === 'choose' && !(await canAddOrigin(cfg.list.length - 1, cfg.offer))) return;
                update((d) => void (ensure(d).mode = mode));
              }}
              options={[
                ['random', '무작위로 배정 (기본)'],
                ['choose', '후보 중에서 플레이어가 고름 (최대 5개)'],
              ]}
            />
          </Field>
          {cfg.mode === 'choose' && (
            <Field label="후보 수" hint="가중치로 무작위 추첨">
              <NumInput
                value={cfg.offer}
                placeholder={cfg.list.length > 5 ? '5' : '전부'}
                onChange={async (x) => {
                  if (x !== undefined && x > 5) {
                    await tell('직접 고르는 출신 후보는 최대 5개까지입니다.');
                    x = 5;
                  }
                  update((d) => void (ensure(d).offer = x));
                }}
              />
            </Field>
          )}
          <Field label="화면 제목">
            <OptText value={cfg.title} placeholder="출신" onChange={(x) => update((d) => void (ensure(d).title = x))} />
          </Field>
        </Row>
        <Field label="안내 문구" wide>
          <TemplateArea value={cfg.text} rows={2} onChange={(x) => update((d) => void (ensure(d).text = x))} />
        </Field>
      </More>
      <Collection
        items={cfg.list}
        selected={selected}
        onSelect={(id) => open('origins', id)}
        label={(o) => o.title}
        sub={(o) => o.summary}
        badge={(o) => (o.unlock ? <span className="badge">조건부</span> : null)}
        addLabel="출신"
        onAdd={async () => {
          if (choosing && !(await canAddOrigin(cfg.list.length, cfg.offer))) return;
          update((d) => {
            const o = ensure(d);
            const id = uniqueId('origin', o.list.map((x) => x.id));
            o.list.push({ id, title: '새 출신', do: [] });
            open('origins', id);
          });
        }}
        onDuplicate={async (id) => {
          if (choosing && !(await canAddOrigin(cfg.list.length, cfg.offer))) return;
          update((d) => {
            const o = ensure(d);
            const src = o.list.find((x) => x.id === id)!;
            const copy = { ...JSON.parse(JSON.stringify(src)), id: uniqueId(id, o.list.map((x) => x.id)) };
            o.list.push(copy);
            open('origins', copy.id);
          });
        }}
        onRemove={(id) => update((d) => void (ensure(d).list = ensure(d).list.filter((x) => x.id !== id)))}
        onMove={(a, b) => update((d) => move(ensure(d).list, a, b))}
      >
        {(o) => {
          const edit = (fn: (x: typeof o) => void) => update((d) => fn(ensure(d).list.find((x) => x.id === o.id)!));
          return (
            <Section title={o.title} topic="origins">
              <Field label="이름">
                <TemplateInput value={o.title} onChange={(x) => edit((t) => void (t.title = x ?? ''))} />
              </Field>
              <Field label="한 줄 요약" wide hint="출신을 고르는 카드에 보이는 짧은 설명">
                <TemplateInput value={o.summary} onChange={(x) => edit((t) => void (t.summary = x))} />
              </Field>
              <Field label="고른 뒤 본문" wide>
                <TemplateArea value={o.text} rows={4} onChange={(x) => edit((t) => void (t.text = x))} />
              </Field>
              <CommandList list={o.do} edit={(fn) => edit((t) => fn((t.do ??= [])))} hat={<div className="block-row"><span className="bw strong">▶ 이 출신으로 시작하면</span></div>} />
              <More active={!!(o.weight !== undefined || o.unlock || o.image || o.nameStyle)}>
                <Row>
                  <Field label="고유 이름">
                    <IdInput value={o.id} taken={cfg.list.map((x) => x.id)} onChange={(nv) => (edit((x) => void (x.id = nv)), open('origins', nv))} />
                  </Field>
                  <Field label="가중치" hint="무작위로 고를 때의 비중. 기본 10">
                    <ExprInput value={o.weight} numeric placeholder="10" onChange={(x) => edit((t) => void (t.weight = x))} />
                  </Field>
                  <Field label="일러스트">
                    <AssetSelect value={o.image} onChange={(x) => edit((t) => void (t.image = x))} />
                  </Field>
                  <Field label="이름 주머니" hint="이 출신일 때 무작위 이름을 뽑을 주머니. 정하면 이름은 출신을 정한 뒤에 정합니다">
                    <Select
                      value={o.nameStyle ?? ''}
                      onChange={(x) => edit((t) => void (t.nameStyle = (x || undefined) as NameStyleId | undefined))}
                      options={[['', '게임 설정을 따름'], ...NAME_STYLES.map((n) => [n.id, n.label] as [string, string])]}
                    />
                  </Field>
                </Row>
                <Field label="해금 조건" wide hint="맞을 때만 후보에 나옵니다. 예: 특정 도전과제 달성">
                  <CondInput value={o.unlock} placeholder="처음부터 열림" onChange={(x) => edit((t) => void (t.unlock = x))} />
                </Field>
              </More>
            </Section>
          );
        }}
      </Collection>
    </>
  );
}

// ───────────────────────── 에셋 ─────────────────────────

export function AssetsSection() {
  const { pkg, update } = useEditor();
  const assets = pkg.assets ?? [];
  const add = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    const src = await imageToDataUrl(file);
    update((d) => {
      const id = uniqueId(file.name.replace(/\.[^.]+$/, '').replace(/[\s'"{}()]+/g, '_') || 'image', (d.assets ?? []).map((a) => a.id));
      (d.assets ??= []).push({ id, kind: 'image', src, alt: file.name });
    });
  };
  return (
    <Section
      title="이미지"
      actions={
        <button className="btn primary small" onClick={add}>
          ＋ 이미지 올리기
        </button>
      }
      help="글 속에 넣을 그림입니다. 이미지는 여기서만 올릴 수 있고, 본문 글에서 {image 이미지ID}로 불러 씁니다. 큰 이미지는 자동으로 줄여서 프로젝트 안에 저장합니다."
    >
      {assets.length === 0 && <p className="muted">아직 이미지가 없습니다.</p>}
      <div className="asset-grid">
        {assets.map((a, i) => (
          <div key={a.id} className="asset">
            <img src={a.src} alt={a.alt} />
            <IdInput
              value={a.id}
              taken={assets.map((x) => x.id)}
              onChange={(nv) =>
                update((d) => {
                  renameRefs(d, 'asset', a.id, nv);
                  d.assets![i].id = nv;
                })
              }
            />
            <OptText value={a.alt} placeholder="설명" onChange={(x) => update((d) => void (d.assets![i].alt = x))} />
            <button type="button" className="link small mono" title="눌러서 복사한 뒤 본문 글 사이에 붙여 넣으세요" onClick={() => void navigator.clipboard?.writeText(`{image ${a.id}}`)}>
              {`{image ${a.id}}`}
            </button>
            <span className="muted small">{Math.round((a.src.length * 0.75) / 1024)} KB</span>
            <button className="link danger" onClick={async () => (await ask('이미지를 삭제할까요?', '삭제', true)) && update((d) => void d.assets!.splice(i, 1))}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
