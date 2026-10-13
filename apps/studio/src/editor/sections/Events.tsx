import type { ActionDef, EventDef, StoryPackage } from '@engine';
import { useState } from 'react';
import { ask } from '../../lib/dialog';
import { conditionSubject, describeExpr, pkgNamer } from '../../lib/exprPrint';
import { eventLabel, hasEventId } from '../../lib/labels';
import { canAddChoice } from '../../lib/limits';
import { choiceTargets, eventLinks, incoming as incomingOf } from '../../lib/links';
import { renameRefs } from '../../lib/rename';
import { ChoiceBody, ChoiceCard } from '../ChoiceEditor';
import { Collection } from '../Collection';
import { CondInput } from '../CondBlocks';
import { Manuscript } from '../Manuscript';
import { useEditor } from '../context';
import {
  Check,
  ExprInput,
  Field,
  EventIdInput,
  HelpLink,
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
  Tip,
  move,
  uniqueId,
} from '../fields';

// ───────────────────────── 연결 분석 ─────────────────────────

// 분석 함수는 lib/links.ts에 있다(다른 편집 화면에서도 쓴다)
export { choiceTargets, eventLinks };

function stageAt(pkg: StoryPackage, age: number) {
  return pkg.settings.stages.find((s) => s.ages && s.ages[0] <= age && age <= s.ages[1]);
}

/** 이벤트를 조건의 주제로 묶는다. 수식 조건이 없으면 나이 범위로 */
function eventCondGroup(e: EventDef, namer: (kind: string, id: string) => string, pkg: StoryPackage): { key: string; label: string } {
  if (e.when) return conditionSubject(e.when, namer);
  if (e.ages) {
    const st = stageAt(pkg, e.ages[0]);
    return { key: `age:${st?.id ?? ''}`, label: st ? `나이만 (${st.name})` : '나이 범위만' };
  }
  if (e.dates) return { key: 'date', label: '날짜 범위만' };
  return { key: '', label: '조건 없음' };
}

/** 목록에 보일 한 줄: 언제 나오는지를 말로 */
function eventSub(e: EventDef, pkg: StoryPackage, hasParent = false): string {
  const parts: string[] = [];
  if (e.ages) parts.push(e.ages[0] === e.ages[1] ? `${e.ages[0]}세` : e.ages[1] >= 150 ? `${e.ages[0]}세부터` : `${e.ages[0]}~${e.ages[1]}세`);
  if (e.dates) parts.push(`${e.dates[0]}년부터`);
  if (e.when) parts.push(describeExpr(e.when, pkg));
  // 트리에서 부모 아래에 있으면 '이어질 때'라는 말은 위치가 이미 알려 준다
  if (!e.pool && pkg.settings.start !== e.id && !hasParent) parts.push('다른 장면에서 이어질 때');
  // ID가 이름으로 쓰이고 있으면 제목은 보조 줄에
  if (hasEventId(e) && e.title?.trim()) parts.unshift(e.title);
  return parts.join(' · ') || (hasParent ? '' : '언제든');
}

// ───────────────────────── 이벤트 편집 ─────────────────────────

export function EventsSection({ selected }: { selected?: string }) {
  const { pkg, update, open, test, detail } = useEditor();
  // 어느 장면의 선택지가 이 장면으로 이어지는지(이어짐 트리용)
  const incoming = new Map<string, string[]>();
  for (const ev of pkg.events) for (const c of ev.choices) for (const t of choiceTargets(c)) incoming.set(t, [...(incoming.get(t) ?? []), ev.id]);
  // 단계·턴이 뽑는 주머니들. 하나뿐이고 이 장면도 그걸 쓰면 이름 대신 체크 하나로 보여 준다
  const drawnPools = [...new Set(pkg.settings.stages.flatMap((s) => s.phases.flatMap((p) => (p.type === 'events' ? p.pools : []))))];
  const defaultPool = drawnPools[0] ?? '기본';
  const showPoolName = (e: EventDef) => detail || drawnPools.length > 1 || (!!e.pool && e.pool !== defaultPool);
  const pools = [...new Set([...pkg.settings.stages.flatMap((s) => s.phases.flatMap((p) => (p.type === 'events' ? p.pools : []))), ...pkg.events.map((e) => e.pool).filter((p): p is string => !!p)])];
  const editEvent = (id: string, fn: (e: EventDef) => void) => update((d) => fn(d.events.find((e) => e.id === id)!));
  const namer = pkgNamer(pkg);
  const [writing, setWriting] = useState<string>();
  const stageGroup = (e: EventDef) => {
    if (e.stages?.length) return { key: e.stages.join('+'), label: e.stages.map((s) => pkg.settings.stages.find((x) => x.id === s)?.name ?? s).join(' · ') };
    // 단계를 따로 고르지 않았으면 나이 범위가 시작되는 단계로
    const st = e.ages && stageAt(pkg, e.ages[0]);
    if (st) return { key: st.id, label: st.name };
    return { key: '', label: e.pool ? '모든 단계' : '연결로만 등장' };
  };

  return (
    <>
      {writing && (
        <Manuscript
          eventId={writing}
          onClose={() => setWriting(undefined)}
          onNavigate={(id) => {
            setWriting(id);
            open('events', id);
          }}
        />
      )}
      <datalist id="event-pools">
        {pools.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Collection
        items={pkg.events}
        selected={selected}
        onSelect={(id) => open('events', id)}
        label={(e) => <span className={hasEventId(e) || e.title ? '' : 'untitled'}>{eventLabel(e)}</span>}
        sub={(e, { hasParent }) => eventSub(e, pkg, hasParent)}
        badge={(e) => (
          <>
            {pkg.settings.start === e.id && <span className="badge start">시작</span>}
            {e.chokepoint && <span className="badge choke">필수</span>}
            {e.fixed && !e.chokepoint && <span className="badge fixed">고정</span>}
          </>
        )}
        search={(e) => `${e.id} ${e.title ?? ''} ${e.text}`}
        addLabel="이벤트"
        defaultGrouping="flow"
        groupings={[
          {
            id: 'flow',
            label: '이어짐 (트리)',
            parents: (e) => incoming.get(e.id) ?? [],
            // 부모의 선택지 순서(1번 선택지에서 이어지는 장면, 2번…)대로 자식을 늘어놓는다
            childOrder: (e) => [...new Set(e.choices.flatMap((c) => [...choiceTargets(c)]))],
            name: (e) => eventLabel(e),
          },
          { id: 'cond', label: '조건별', by: (e) => [eventCondGroup(e, namer, pkg)] },
          { id: 'stage', label: '단계 › 조건', by: (e) => [stageGroup(e), e.when ? conditionSubject(e.when, namer) : { key: '', label: '추가 조건 없음' }] },
          { id: 'pool', label: '주머니별', by: (e) => [{ key: e.pool ?? '', label: e.pool ?? '연결로만 등장' }] },
        ]}
        onAdd={() =>
          update((d) => {
            const id = uniqueId('event', d.events.map((e) => e.id));
            const cur = d.events.find((e) => e.id === selected);
            d.events.push({ id, text: '', pool: cur?.pool, stages: cur?.stages ? [...cur.stages] : undefined, choices: [] });
            open('events', id);
          })
        }
        onDuplicate={(id) =>
          update((d) => {
            const src = d.events.find((e) => e.id === id)!;
            const copy: EventDef = { ...JSON.parse(JSON.stringify(src)), id: uniqueId(id, d.events.map((e) => e.id)) };
            d.events.splice(d.events.indexOf(src) + 1, 0, copy);
            open('events', copy.id);
          })
        }
        onRemove={(id) => update((d) => void (d.events = d.events.filter((e) => e.id !== id)))}
        onMove={(a, b) => update((d) => move(d.events, a, b))}
      >
        {(e) => (
          <div className="event-editor">
            <Section
              title={eventLabel(e)}
              topic="events"
              actions={
                <span className="inline">
                  <button className="btn small" onClick={() => setWriting(e.id)} title="다른 메뉴를 가리고 글에만 집중합니다">
                    ✎ 집필 모드
                  </button>
                  <button className="btn small primary" onClick={() => test(e.id)}>
                    ▶ 여기부터 테스트
                  </button>
                </span>
              }
            >
              <Field label="ID (에디터 전용)" hint="이 장면을 부르는 이름. 에디터에서만 보이고 플레이어에게는 나오지 않습니다. 다른 장면에서 이어 갈 때도, 목록·흐름도에서도 제목보다 먼저 쓰입니다. 바꾸면 쓰던 곳도 함께 바뀝니다.">
                <EventIdInput
                  value={e.id}
                  taken={pkg.events.map((x) => x.id)}
                  onCommit={(nv) =>
                    update((d) => {
                      renameRefs(d, 'event', e.id, nv);
                      d.events.find((x) => x.id === e.id)!.id = nv;
                      open('events', nv);
                    })
                  }
                />
              </Field>
              <Field label="제목 (선택)" hint="적으면 장면 위에 크게 나오고, 비워 두면 제목 없이 본문만 나옵니다. 플레이어에게 보이는 글입니다.">
                <TemplateInput value={e.title} placeholder="비워 두면 제목 없음" onChange={(v) => editEvent(e.id, (x) => void (x.title = v?.trim() ? v : undefined))} />
              </Field>
              <Field label="본문" wide hint={<>글 속에 값을 넣거나 조건·조사를 맞출 수 있습니다. 쓰는 법은 <HelpLink topic="text">도움말 › 중괄호 문법</HelpLink>에 있습니다.</>}>
                <TemplateArea value={e.text} rows={6} onChange={(v) => editEvent(e.id, (x) => void (x.text = v ?? ''))} />
              </Field>

              <h4 className="sub">언제 나오나</h4>
              {!showPoolName(e) && (
                <div className="sentence">
                  <Check
                    value={!!e.pool}
                    onChange={(on) => editEvent(e.id, (x) => void (x.pool = on ? defaultPool : undefined))}
                    label="턴마다 무작위로 나올 수 있음"
                  />
                  <Tip>켜면 매 턴 장면을 뽑을 때 후보가 됩니다. 끄면 다른 선택지의 "그다음엔"이나 '이벤트로 이동' 블록으로 이어질 때만 나옵니다.</Tip>
                </div>
              )}
              {e.fixed && !e.pool && <p className="field-hint warn-text">'반드시 나옴'은 턴마다 뽑히는 장면에만 적용됩니다. 위 체크를 켜 주세요.</p>}
              <div className="sentence">
                <span>이 장면은</span>
                {showPoolName(e) && (
                  <>
                    <span className="small-input wide">
                      <TextInput value={e.pool} list="event-pools" placeholder="(주머니 없음)" onChange={(v) => editEvent(e.id, (x) => void (x.pool = v || undefined))} />
                    </span>
                    <span>주머니에서 뽑혀</span>
                    <Tip>
                      '주머니'(이벤트 풀)는 장면을 모아 두는 곳입니다. 매 턴 단계·턴 설정이 정해진 주머니에서 장면을 뽑습니다. 비워 두면 뽑히지 않고, 다른 선택지의 "그다음엔"으로 이어질 때만 나옵니다. 새 이름을 적으면 새 주머니가 됩니다(단계·턴에서 그 주머니를 뽑게 해야 나옵니다).
                    </Tip>
                  </>
                )}
                {pkg.settings.calendar.unit !== 'none' && (
                  <>
                    <span className="small-input">
                      <NumInput value={e.ages?.[0]} placeholder="0" onChange={(v) => editEvent(e.id, (x) => void (x.ages = v === undefined && x.ages?.[1] === undefined ? undefined : [v ?? 0, x.ages?.[1] ?? 200]))} />
                    </span>
                    <span>~</span>
                    <span className="small-input">
                      <NumInput value={e.ages?.[1]} placeholder="끝" onChange={(v) => editEvent(e.id, (x) => void (x.ages = v === undefined && x.ages?.[0] === undefined ? undefined : [x.ages?.[0] ?? 0, v ?? 200]))} />
                    </span>
                    <span>세 사이에,</span>
                  </>
                )}
                <CondInput value={e.when} placeholder="언제든" onChange={(v) => editEvent(e.id, (x) => void (x.when = v))} />
                <span>나옵니다.</span>
              </div>
              <Row>
                <Check value={e.fixed} onChange={(v) => editEvent(e.id, (x) => void (x.fixed = v || undefined))} label="때가 되면 반드시 나옴" />
                {!e.fixed && <Check value={e.once} onChange={(v) => editEvent(e.id, (x) => void (x.once = v || undefined))} label="한 번만 나옴" />}
              </Row>

              <More
                active={!!(e.stages || e.dates || e.chokepoint || e.priority !== undefined || e.weight !== undefined || e.cooldown || e.group || e.tone || e.record)}
              >
                <Row>
                  <Field label="인생표에 기록" hint="이 이벤트를 겪으면 엔딩 화면의 인생표에 남길 문구">
                    <TemplateInput
                      value={typeof e.record === 'string' ? e.record : e.record?.text}
                      onChange={(v) => editEvent(e.id, (x) => void (x.record = v ? { text: v, importance: typeof x.record === 'object' ? x.record.importance : 3 } : undefined))}
                    />
                  </Field>
                  {e.record && (
                    <Field label="중요도" hint="4 이상은 '주요 사건만' 보기에도 나옵니다">
                      <Select
                        value={String(typeof e.record === 'object' ? (e.record.importance ?? 3) : 3)}
                        onChange={(v) => editEvent(e.id, (x) => void (x.record = { text: typeof x.record === 'string' ? x.record : x.record!.text, importance: Number(v ?? 3) }))}
                        options={[1, 2, 3, 4, 5].map((n) => [String(n), `${n}${n >= 4 ? ' (주요)' : ''}`] as const)}
                      />
                    </Field>
                  )}
                </Row>
                {pkg.settings.stages.length > 1 && (
                  <Field label="단계" hint="고르면 그 단계에서만 나옵니다. 나이 범위와 함께 쓸 수 있습니다.">
                    <div className="checks">
                      {pkg.settings.stages.map((st) => (
                        <Check
                          key={st.id}
                          label={st.name}
                          value={e.stages?.includes(st.id)}
                          onChange={(on) =>
                            editEvent(e.id, (x) => {
                              const set = new Set(x.stages ?? []);
                              if (on) set.add(st.id);
                              else set.delete(st.id);
                              x.stages = set.size ? pkg.settings.stages.map((s) => s.id).filter((s) => set.has(s)) : undefined;
                            })
                          }
                        />
                      ))}
                    </div>
                  </Field>
                )}
                <Row>
                  {pkg.settings.calendar.unit !== 'none' && (
                    <Field label="날짜 범위" hint="시작~끝 (예: 2010~2012.06)">
                      <OptText
                        value={e.dates ? `${e.dates[0]}~${e.dates[1]}` : undefined}
                        mono
                        onChange={(v) =>
                          editEvent(e.id, (x) => {
                            const [a, b] = (v ?? '').split('~').map((s) => s.trim());
                            x.dates = a ? [a, b || '9999'] : undefined;
                          })
                        }
                      />
                    </Field>
                  )}
                  {e.fixed ? (
                    <Field label="우선순위" hint="고정 이벤트가 동시에 여럿이면 높은 것부터">
                      <NumInput value={e.priority} onChange={(v) => editEvent(e.id, (x) => void (x.priority = v))} />
                    </Field>
                  ) : (
                    <>
                      <Field label="가중치" hint="랜덤으로 뽑힐 때의 비중. 기본 10, 20이면 두 배로 잘 나옵니다. 수식도 됩니다.">
                        <ExprInput value={e.weight} numeric placeholder="10" onChange={(v) => editEvent(e.id, (x) => void (x.weight = v))} />
                      </Field>
                      <Field label="다시 나오기까지(턴)">
                        <NumInput value={e.cooldown} onChange={(v) => editEvent(e.id, (x) => void (x.cooldown = v))} />
                      </Field>
                      <Field label="그룹" hint="같은 그룹 이벤트는 연달아 나오지 않습니다">
                        <OptText value={e.group} onChange={(v) => editEvent(e.id, (x) => void (x.group = v))} />
                      </Field>
                    </>
                  )}
                  <Field label="분위기" hint="나쁜 일이 몰리면 나쁜 일의 확률을 낮출 때 씁니다">
                    <Select
                      value={e.tone}
                      allowEmpty="보통"
                      onChange={(v) => editEvent(e.id, (x) => void (x.tone = v))}
                      options={[
                        ['positive', '좋은 일'],
                        ['negative', '나쁜 일'],
                        ['neutral', '중립'],
                      ]}
                    />
                  </Field>
                </Row>
                <Check value={e.chokepoint} onChange={(v) => editEvent(e.id, (x) => void (x.chokepoint = v || undefined))} label="필수 통과 지점 (초크포인트 — 모든 플레이가 지나야 하는지 시뮬레이션이 검사)" />
              </More>
              <Incoming id={e.id} />
            </Section>

            <Section
              title={`선택지 ${e.choices.length}개`}
              help={e.choices.length === 0 ? `선택지가 없으면 '${pkg.settings.ui?.continueText ?? '계속'}' 버튼 하나가 나옵니다.` : undefined}
              actions={
                <button
                  className="btn small primary"
                  onClick={async () => (await canAddChoice(e.choices.length)) && editEvent(e.id, (x) => void x.choices.push({ text: '', outcome: {} }))}
                >
                  ＋ 선택지
                </button>
              }
            >
              {e.choices.map((c, i) => (
                <ChoiceCard
                  key={`${e.id}:${i}`}
                  choice={c}
                  index={i}
                  length={e.choices.length}
                  edit={(fn) => editEvent(e.id, (x) => fn(x.choices[i]))}
                  onMove={(to) => editEvent(e.id, (x) => move(x.choices, i, to))}
                  onDuplicate={async () => (await canAddChoice(e.choices.length)) && editEvent(e.id, (x) => void x.choices.splice(i + 1, 0, JSON.parse(JSON.stringify(x.choices[i]))))}
                  onRemove={async () => (await ask('선택지를 삭제할까요?', '삭제', true)) && editEvent(e.id, (x) => void x.choices.splice(i, 1))}
                  links={[...choiceTargets(c)].map((t) => (
                    <button
                      key={t}
                      className="chip link"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        open('events', t);
                      }}
                    >
                      → {eventLabel(pkg.events.find((x) => x.id === t), t)}
                    </button>
                  ))}
                />
              ))}
            </Section>
          </div>
        )}
      </Collection>
    </>
  );
}

function Incoming({ id }: { id: string }) {
  const { pkg, open } = useEditor();
  const list = incomingOf(pkg, id);
  if (!list.length) return null;
  return (
    <div className="incoming">
      <span className="field-label">이곳으로 오는 길</span>
      {list.map((x, i) => (
        <button
          key={i}
          className="chip link"
          onClick={() => (x.kind === 'event' ? open('events', x.id) : x.kind === 'action' ? open('actions', x.id) : x.kind === 'start' ? open('settings') : open(x.label.startsWith('규칙') ? 'triggers' : 'scripts', x.id))}
        >
          ← {x.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── 행동 ─────────────────────────

export function ActionsSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const actions = pkg.actions ?? [];
  const menuPools = [...new Set(pkg.settings.stages.flatMap((s) => s.phases.flatMap((p) => (p.type === 'menu' ? [p.pool] : []))))];
  const edit = (id: string, fn: (a: ActionDef) => void) => update((d) => fn(d.actions!.find((a) => a.id === id)!));
  return (
    <>
      <Intro topic="actions">
        매 턴 "이번에는 무엇을 할까?" 메뉴에 나오는 선택지입니다. {menuPools.length ? `메뉴: ${menuPools.join(', ')}` : '아직 행동 메뉴가 없습니다 — 단계·턴 화면에서 추가하세요.'}
      </Intro>
      <datalist id="menu-pools">
        {menuPools.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Collection
        items={actions}
        selected={selected}
        onSelect={(id) => open('actions', id)}
        label={(a) => a.text}
        sub={(a) => (a.when ?? a.requires ? describeExpr(a.when ?? a.requires, pkg) : '언제나')}
        search={(a) => `${a.id} ${a.text}`}
        addLabel="행동"
        groupings={[
          { id: 'pool', label: '메뉴 › 조건', by: (a) => [{ key: a.pool, label: a.pool }, conditionSubject(a.when ?? a.requires, pkgNamer(pkg))] },
          { id: 'cond', label: '조건별', by: (a) => [conditionSubject(a.when ?? a.requires, pkgNamer(pkg))] },
        ]}
        onAdd={() =>
          update((d) => {
            const id = uniqueId('action', (d.actions ?? []).map((a) => a.id));
            (d.actions ??= []).push({ id, pool: menuPools[0] ?? '행동', text: '새 행동', outcome: {} });
            open('actions', id);
          })
        }
        onDuplicate={(id) =>
          update((d) => {
            const src = d.actions!.find((a) => a.id === id)!;
            const copy = { ...JSON.parse(JSON.stringify(src)), id: uniqueId(id, d.actions!.map((a) => a.id)) };
            d.actions!.splice(d.actions!.indexOf(src) + 1, 0, copy);
            open('actions', copy.id);
          })
        }
        onRemove={(id) => update((d) => void (d.actions = d.actions!.filter((a) => a.id !== id)))}
        onMove={(a, b) => update((d) => move(d.actions!, a, b))}
      >
        {(a) => (
          <Section title={a.text} topic="actions">
            <Row>
              <Field label="나올 메뉴" hint="어느 행동 메뉴에 나올지. 단계·턴 화면의 ‘행동 고르기’에서 적은 메뉴 이름과 같아야 합니다.">
                <TextInput value={a.pool} list="menu-pools" onChange={(v) => edit(a.id, (x) => void (x.pool = v))} />
              </Field>
              <Field label="메뉴에 보이는 조건" hint="안 맞으면 메뉴에 아예 나오지 않습니다. (선택 조건은 보이되 못 고르게 합니다)">
                <CondInput value={a.when} placeholder="항상 보임" onChange={(v) => edit(a.id, (x) => void (x.when = v))} />
              </Field>
            </Row>
            <ChoiceBody choice={a} edit={(fn) => edit(a.id, (x) => fn(x))} />
          </Section>
        )}
      </Collection>
    </>
  );
}
