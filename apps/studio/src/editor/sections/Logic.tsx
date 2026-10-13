import type { AchievementDef, EndingDef, EpilogueParagraph, ScriptDef, TriggerDef, TriggerOn } from '@engine';
import { conditionSubject, describeExpr, pkgNamer } from '../../lib/exprPrint';
import { renameRefs } from '../../lib/rename';
import { Collection } from '../Collection';
import { CommandList } from '../CommandEditor';
import { CondInput } from '../CondBlocks';
import { useEditor } from '../context';
import {
  Check,
  Field,
  IdInput,
  ItemTools,
  Intro,
  ListInput,
  More,
  NumInput,
  OptText,
  Row,
  Section,
  Select,
  TemplateArea,
  TemplateInput,
  Tip,
  move,
  uniqueId,
} from '../fields';

// ───────────────────────── 규칙(트리거) ─────────────────────────

export const TRIGGER_ON: [TriggerOn, string, string][] = [
  ['watch', '항상 감시', '선택할 때마다 조건을 확인 (사망 판정, 레벨업, 위기 이벤트)'],
  ['tick', '시간이 흐를 때마다', '시간 단위(년/월/일)마다 (월급, 생활비, 자연 회복)'],
  ['birthday', '나이를 먹을 때', '노화, 자연사, 성인식'],
  ['turnStart', '턴이 시작될 때', ''],
  ['turnEnd', '턴이 끝날 때', ''],
  ['stageEnter', '새 단계에 들어설 때', '유년기 → 청년기 등'],
  ['start', '새 게임을 시작할 때', ''],
  ['end', '엔딩 직전', '결산용 기록'],
];

export function TriggersSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const list = pkg.triggers ?? [];
  const edit = (id: string, fn: (t: TriggerDef) => void) => update((d) => fn(d.triggers!.find((t) => t.id === id)!));
  const namer = pkgNamer(pkg);
  const onGroup = (on: TriggerOn) => ({ key: String(TRIGGER_ON.findIndex((x) => x[0] === on)), label: `⚑ ${TRIGGER_ON.find((x) => x[0] === on)?.[1]}` });
  return (
    <>
      <Intro topic="triggers">선택과 상관없이 정해진 때에 저절로 실행되는 규칙입니다. 예: 체력이 0이 되면 사망, 매년 월급.</Intro>
      <Collection
        items={list}
        selected={selected}
        onSelect={(id) => open('triggers', id)}
        label={(t) => t.name ?? t.id}
        sub={(t) => `${TRIGGER_ON.find((x) => x[0] === t.on)?.[1]}${t.when ? ` · ${describeExpr(t.when, pkg)}` : ''}`}
        badge={(t) => (t.once ? <span className="badge">1회</span> : null)}
        addLabel="규칙"
        defaultGrouping="on-cond"
        groupings={[
          { id: 'on-cond', label: '시점 › 조건', by: (t) => [onGroup(t.on), conditionSubject(t.when, namer)] },
          { id: 'cond', label: '조건별', by: (t) => [conditionSubject(t.when, namer)] },
          { id: 'on', label: '시점별', by: (t) => [onGroup(t.on)] },
        ]}
        onAdd={() =>
          update((d) => {
            const id = uniqueId('rule', (d.triggers ?? []).map((t) => t.id));
            (d.triggers ??= []).push({ id, name: '새 규칙', on: 'watch', when: 'false', do: [] });
            open('triggers', id);
          })
        }
        onDuplicate={(id) =>
          update((d) => {
            const src = d.triggers!.find((t) => t.id === id)!;
            const copy = { ...JSON.parse(JSON.stringify(src)), id: uniqueId(id, d.triggers!.map((t) => t.id)) };
            d.triggers!.splice(d.triggers!.indexOf(src) + 1, 0, copy);
            open('triggers', copy.id);
          })
        }
        onRemove={(id) => update((d) => void (d.triggers = d.triggers!.filter((t) => t.id !== id)))}
        onMove={(a, b) => update((d) => move(d.triggers!, a, b))}
      >
        {(t) => (
          <Section title={t.name ?? t.id} topic="triggers">
            <Field label="이름" hint="목록에 보일 이름입니다. 게임에는 나오지 않습니다.">
              <OptText value={t.name} placeholder={t.id} onChange={(v) => edit(t.id, (x) => void (x.name = v))} />
            </Field>
            <div className="script-canvas">
              <CommandList
                list={t.do}
                edit={(fn) => edit(t.id, (x) => fn(x.do))}
                hat={
                  <>
                    <div className="block-row">
                      <Select value={t.on} onChange={(v) => edit(t.id, (x) => void (x.on = v ?? 'watch'))} options={TRIGGER_ON.map(([k, l]) => [k, l] as const)} />
                      <Tip>{TRIGGER_ON.find((x) => x[0] === t.on)?.[2] || TRIGGER_ON.find((x) => x[0] === t.on)?.[1]}</Tip>
                      <span className="bw">,</span>
                      <CondInput
                        value={t.when}
                        placeholder={t.on === 'watch' ? '조건을 고르세요' : '언제든'}
                        onChange={(v) => edit(t.id, (x) => void (x.when = v))}
                      />
                      <span className="bw">아래를 합니다.</span>
                    </div>
                    <div className="block-row thin">
                      <Check value={t.once} onChange={(v) => edit(t.id, (x) => void (x.once = v || undefined))} label="딱 한 번만" />
                    </div>
                  </>
                }
              />
            </div>
          </Section>
        )}
      </Collection>
    </>
  );
}

// ───────────────────────── 스크립트 ─────────────────────────

export function ScriptsSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const list = pkg.scripts ?? [];
  const edit = (id: string, fn: (t: ScriptDef) => void) => update((d) => fn(d.scripts!.find((t) => t.id === id)!));
  return (
    <>
      <Intro topic="scripts">여러 곳에서 똑같이 쓰는 블록 묶음입니다. '스크립트 실행' 블록으로 부릅니다.</Intro>
      <Collection
        items={list}
        selected={selected}
        onSelect={(id) => open('scripts', id)}
        label={(s) => s.name ?? s.id}
        sub={(s) => (s.params?.length ? `받는 값: ${s.params.join(', ')}` : '')}
        addLabel="스크립트"
        onAdd={() =>
          update((d) => {
            const id = uniqueId('script', (d.scripts ?? []).map((t) => t.id));
            (d.scripts ??= []).push({ id, name: '새 스크립트', do: [] });
            open('scripts', id);
          })
        }
        onRemove={(id) => update((d) => void (d.scripts = d.scripts!.filter((t) => t.id !== id)))}
      >
        {(s) => (
          <Section title={s.name ?? s.id} topic="scripts">
            <Row>
              <Field label="고유 이름">
                <IdInput
                  value={s.id}
                  taken={list.map((x) => x.id)}
                  onChange={(nv) =>
                    update((d) => {
                      renameRefs(d, 'script', s.id, nv);
                      d.scripts!.find((x) => x.id === s.id)!.id = nv;
                      open('scripts', nv);
                    })
                  }
                />
              </Field>
              <Field label="이름">
                <OptText value={s.name} onChange={(v) => edit(s.id, (x) => void (x.name = v))} />
              </Field>
              <Field label="매개변수" hint="쉼표로 구분해 이름을 적습니다. 스크립트 안에서는 이름 앞에 $를 붙여 값을 읽습니다.">
                <ListInput value={s.params} onChange={(v) => edit(s.id, (x) => void (x.params = v))} />
              </Field>
            </Row>
<div className="script-canvas">
              <CommandList
                list={s.do}
                edit={(fn) => edit(s.id, (x) => fn(x.do))}
                hat={
                  <div className="block-row">
                    <span className="bw strong">▶ '{s.name ?? s.id}' 실행 시</span>
                    {s.params?.length ? <span className="bw dim">{s.params.map((p) => `$${p}`).join(', ')}</span> : null}
                  </div>
                }
              />
            </div>
          </Section>
        )}
      </Collection>
    </>
  );
}

// ───────────────────────── 엔딩 · 결산 ─────────────────────────

export function EndingsSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const edit = (id: string, fn: (t: EndingDef) => void) => update((d) => fn(d.endings.find((t) => t.id === id)!));
  return (
    <>
      <Intro topic="endings">자동 조건이 맞거나 '엔딩' 블록이 실행되면 게임이 끝납니다. 엔딩 본문 뒤에는 아래 결산이 이어집니다.</Intro>
      <div className="sentence">
        <Check
          value={pkg.settings.recordEnding !== false}
          onChange={(v) => update((d) => void (d.settings.recordEnding = v ? undefined : false))}
          label="끝날 때 엔딩을 인생표 마지막 줄에 남기기"
        />
        <Tip>예: 사망: 뒷골목에 쓰러지다. 어떤 선택지를 골라서 끝났는지는 적지 않습니다. 노환처럼 자동 규칙으로 끝났으면 그 규칙 이름만 괄호로 덧붙입니다.</Tip>
      </div>
      <Collection
        items={pkg.endings}
        selected={selected}
        onSelect={(id) => open('endings', id)}
        label={(e) => e.title}
        sub={(e) => (e.when ? describeExpr(e.when, pkg) : "'엔딩' 블록으로")}
        badge={(e) => <span className={`badge kind-${e.kind ?? 'neutral'}`}>{{ death: '사망', good: '좋음', bad: '나쁨', neutral: '보통' }[e.kind ?? 'neutral']}</span>}
        addLabel="엔딩"
        groupings={[{ id: 'cond', label: '자동 조건별', by: (e) => [e.when ? conditionSubject(e.when, pkgNamer(pkg)) : { key: '', label: '명령으로만' }] }]}
        onAdd={() =>
          update((d) => {
            const id = uniqueId('ending', d.endings.map((t) => t.id));
            d.endings.push({ id, title: '새 엔딩', kind: 'neutral' });
            open('endings', id);
          })
        }
        onRemove={(id) => update((d) => void (d.endings = d.endings.filter((t) => t.id !== id)))}
        onMove={(a, b) => update((d) => move(d.endings, a, b))}
      >
        {(e) => (
          <Section title={e.title} topic="endings">
            <Row>
              <Field label="제목">
                <TemplateInput value={e.title} onChange={(v) => edit(e.id, (x) => void (x.title = v ?? ''))} />
              </Field>
              <Field label="종류">
                <Select
                  value={e.kind}
                  allowEmpty="보통"
                  onChange={(v) => edit(e.id, (x) => void (x.kind = v))}
                  options={[
                    ['death', '사망'],
                    ['good', '좋은 결말'],
                    ['bad', '나쁜 결말'],
                    ['neutral', '보통'],
                  ]}
                />
              </Field>
            </Row>
            <Field label="자동 조건" wide hint="이 조건이 맞는 순간 바로 이 엔딩으로 끝납니다. 비우면 '엔딩' 블록으로만 옵니다.">
              <CondInput value={e.when} placeholder="조건 없음 ('엔딩' 블록으로만)" onChange={(v) => edit(e.id, (x) => void (x.when = v))} />
            </Field>
            <Field label="엔딩 본문" wide>
              <TemplateArea value={e.text} rows={4} onChange={(v) => edit(e.id, (x) => void (x.text = v))} />
            </Field>
            <More active={!!(e.image || e.priority !== undefined)}>
              <Row>
                <Field label="고유 이름" hint="엔딩 블록이 이 엔딩을 가리키는 이름. 바꾸면 쓰던 곳도 함께 바뀝니다.">
                  <IdInput
                    value={e.id}
                    taken={pkg.endings.map((x) => x.id)}
                    onChange={(nv) =>
                      update((d) => {
                        renameRefs(d, 'ending', e.id, nv);
                        d.endings.find((x) => x.id === e.id)!.id = nv;
                        open('endings', nv);
                      })
                    }
                  />
                </Field>
                <Field label="우선순위" hint="자동 조건이 여러 엔딩에서 동시에 맞으면 높은 쪽">
                  <NumInput value={e.priority} onChange={(v) => edit(e.id, (x) => void (x.priority = v))} />
                </Field>
              </Row>
            </More>
          </Section>
        )}
      </Collection>
      <EpilogueEditor />
    </>
  );
}

function EpilogueEditor() {
  const { pkg, update } = useEditor();
  const ep = pkg.epilogue ?? { paragraphs: [] };
  const ensure = (d: typeof pkg) => (d.epilogue ??= { paragraphs: [] });
  const editP = (i: number, fn: (p: EpilogueParagraph) => void) => update((d) => fn(ensure(d).paragraphs[i]));
  return (
    <Section
      title="결산 (모든 엔딩 공통)"
      topic="epilogue"
      help="엔딩 화면에 '첫 문장 → 엔딩 본문 → 조건에 맞는 문단들 → 마지막 문장' 순서로 이어 붙는 글입니다."
      actions={
        <button className="btn small primary" onClick={() => update((d) => void ensure(d).paragraphs.push({ id: uniqueId('p', ensure(d).paragraphs.map((p) => p.id)), lines: [{ text: '' }] }))}>
          ＋ 문단
        </button>
      }
    >
      <Field label="첫 문장" wide>
        <TemplateInput value={ep.header} placeholder="{$이름}의 이야기는 {$나이}세에 끝났습니다." onChange={(v) => update((d) => void (ensure(d).header = v))} />
      </Field>
      {ep.paragraphs.map((p, i) => (
        <div key={p.id} className="epi-paragraph">
          <div className="phase-head">
            <strong>문단 {i + 1}</strong>
            <span className="inline">
              조건 <CondInput value={p.when} onChange={(v) => editP(i, (x) => void (x.when = v))} placeholder="(항상)" />
            </span>
            <span className="inline">
              순서 <NumInput value={p.order} placeholder="50" onChange={(v) => editP(i, (x) => void (x.order = v))} />
            </span>
            <ItemTools
              index={i}
              length={ep.paragraphs.length}
              onMove={(to) => update((d) => move(ensure(d).paragraphs, i, to))}
              onRemove={() => update((d) => void ensure(d).paragraphs.splice(i, 1))}
            />
          </div>
          {p.lines.map((l, j) => (
            <div key={j} className="epi-line">
              <CondInput value={l.when} placeholder="(항상)" onChange={(v) => editP(i, (x) => void (x.lines[j].when = v))} />
              <TemplateInput value={l.text} onChange={(v) => editP(i, (x) => void (x.lines[j].text = v ?? ''))} />
              <button className="icon danger" onClick={() => editP(i, (x) => void x.lines.splice(j, 1))}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn small" onClick={() => editP(i, (x) => void x.lines.push({ text: '' }))}>
            ＋ 문장
          </button>
        </div>
      ))}
      <Field label="마지막 문장" wide>
        <TemplateInput value={ep.footer} onChange={(v) => update((d) => void (ensure(d).footer = v))} />
      </Field>
    </Section>
  );
}

// ───────────────────────── 도전과제 ─────────────────────────

export function AchievementsSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const list = pkg.achievements ?? [];
  const edit = (id: string, fn: (t: AchievementDef) => void) => update((d) => fn(d.achievements!.find((t) => t.id === id)!));
  return (
    <>
      <Intro topic="achievements">게임을 여러 번 해도 남는 기록입니다. 조건이 맞으면 저절로 달성됩니다.</Intro>
      <Collection
        items={list}
        selected={selected}
        onSelect={(id) => open('achievements', id)}
        label={(a) => `${a.icon ?? '★'} ${a.title}`}
        sub={(a) => (a.when ? describeExpr(a.when, pkg) : '블록으로 달성')}
        badge={(a) => (a.hidden ? <span className="badge">숨김</span> : null)}
        addLabel="도전과제"
        groupings={[{ id: 'cond', label: '조건별', by: (a) => [a.when ? conditionSubject(a.when, pkgNamer(pkg)) : { key: '', label: '명령으로만' }] }]}
        onAdd={() =>
          update((d) => {
            const id = uniqueId('ach', (d.achievements ?? []).map((t) => t.id));
            (d.achievements ??= []).push({ id, title: '새 도전과제' });
            open('achievements', id);
          })
        }
        onRemove={(id) => update((d) => void (d.achievements = d.achievements!.filter((t) => t.id !== id)))}
        onMove={(a, b) => update((d) => move(d.achievements!, a, b))}
      >
        {(a) => (
          <Section title={a.title} topic="achievements">
            <Row>
              <Field label="제목">
                <OptText value={a.title} onChange={(v) => edit(a.id, (x) => void (x.title = v ?? ''))} />
              </Field>
              <Field label="아이콘">
                <OptText value={a.icon} placeholder="★" onChange={(v) => edit(a.id, (x) => void (x.icon = v))} />
              </Field>
            </Row>
            <Field label="설명" wide>
              <OptText value={a.description} onChange={(v) => edit(a.id, (x) => void (x.description = v))} />
            </Field>
            <Field label="달성 조건" wide hint="이 조건이 맞는 순간 달성됩니다. 비우면 '도전과제 달성' 블록으로만 줄 수 있습니다.">
              <CondInput value={a.when} placeholder="조건 없음 (블록으로만)" onChange={(v) => edit(a.id, (x) => void (x.when = v))} />
            </Field>
            <More active={!!a.hidden}>
              <Row>
                <Field label="고유 이름">
                  <IdInput
                    value={a.id}
                    taken={list.map((x) => x.id)}
                    onChange={(nv) =>
                      update((d) => {
                        renameRefs(d, 'achievement', a.id, nv);
                        d.achievements!.find((x) => x.id === a.id)!.id = nv;
                        open('achievements', nv);
                      })
                    }
                  />
                </Field>
                <Check value={a.hidden} onChange={(v) => edit(a.id, (x) => void (x.hidden = v || undefined))} label="달성 전까지 숨김" />
              </Row>
            </More>
          </Section>
        )}
      </Collection>
    </>
  );
}
