import { NAME_GENDERS, NAME_STYLES, type NameGender, type NameStyleId, type PhaseDef, type StageDef, nameCandidates } from '@engine';
import { describeExpr } from '../../lib/exprPrint';
import { renameRefs } from '../../lib/rename';
import { Collection } from '../Collection';
import { CommandList } from '../CommandEditor';
import { CondInput } from '../CondBlocks';
import { useEditor } from '../context';
import {
  AssetSelect,
  Check,
  EventSelect,
  ExprInput,
  Field,
  IdInput,
  Intro,
  ItemTools,
  More,
  ListInput,
  NumInput,
  OptText,
  Row,
  Section,
  Select,
  TextInput,
  ThresholdList,
  Tip,
  move,
  uniqueId,
} from '../fields';
import { ThemeSection } from './Theme';

export function MetaSection() {
  const { pkg, update } = useEditor();
  const m = pkg.meta;
  return (
    <Section title="기본 정보" topic="meta">
      <Field label="제목" wide>
        <TextInput value={m.title} onChange={(v) => update((d) => void (d.meta.title = v))} />
      </Field>
      <Field label="작가">
        <OptText value={m.author} onChange={(v) => update((d) => void (d.meta.author = v))} />
      </Field>
      <Field label="소개" wide>
        <textarea rows={4} value={m.description ?? ''} onChange={(e) => update((d) => void (d.meta.description = e.target.value || undefined))} />
      </Field>
      <More active={!!(m.version || m.tags?.length || m.cover)}>
        <Row>
          <Field label="표지 이미지">
            <AssetSelect value={m.cover} onChange={(v) => update((d) => void (d.meta.cover = v))} />
          </Field>
          <Field label="버전">
            <OptText value={m.version} onChange={(v) => update((d) => void (d.meta.version = v))} placeholder="1.0" />
          </Field>
          <Field label="태그" hint="쉼표로 구분">
            <ListInput value={m.tags} onChange={(v) => update((d) => void (d.meta.tags = v))} />
          </Field>
        </Row>
        <p className="muted small">프로젝트 ID: {m.id}</p>
      </More>
    </Section>
  );
}

export function SettingsSection() {
  const { pkg, update } = useEditor();
  const s = pkg.settings;
  const endingOptions = pkg.endings.map((e) => [e.id, e.title] as const);
  return (
    <>
      <Section
        title="진행 방식"
        topic="settings"
        help="이야기형은 시작 이벤트에서 출발해 선택지로 이어지고, 더 일어날 일이 없으면 끝납니다. 인생형은 0세부터 시작해 나이가 흐르고, 사망·노환 같은 종료 조건으로 끝납니다."
      >
        <Row>
          <Field label="모드">
            <Select
              value={s.mode}
              onChange={(v) => update((d) => void (d.settings.mode = v ?? 'story'))}
              options={[
                ['story', '이야기형 (이벤트가 끝나면 종료)'],
                ['life', '인생형 (출생부터 사망까지)'],
              ]}
            />
          </Field>
          <Field label="시작 이벤트(도입부)" hint="출신 선택 뒤 가장 먼저 나오는 이벤트">
            <EventSelect value={s.start} onChange={(v) => update((d) => void (d.settings.start = v))} />
          </Field>
        </Row>
        <div className="sentence">
          <span>주인공 이름은</span>
          <Select
            value={s.player?.askName ? 'ask' : s.player?.randomName ? 'random' : s.player?.defaultName && s.player.defaultName !== '당신' ? 'fixed' : 'none'}
            onChange={(v) =>
              update((d) => {
                const p = (d.settings.player ??= {});
                p.askName = v === 'ask' ? true : undefined;
                p.randomName = v === 'random' ? true : undefined;
                if (v === 'fixed') {
                  if (!p.defaultName || p.defaultName === '당신') p.defaultName = '이름';
                } else if (v === 'none') {
                  p.defaultName = undefined;
                  p.nameStyle = undefined;
                } else if (!p.defaultName || p.defaultName === '당신') p.defaultName = '익명';
              })
            }
            options={[
              ['none', '쓰지 않습니다 ("당신"으로 서술)'],
              ['ask', '시작할 때 플레이어에게 묻습니다'],
              ['random', '이름 주머니에서 알아서 뽑습니다'],
              ['fixed', '정해져 있습니다'],
            ]}
          />
          {(s.player?.askName || s.player?.randomName || (s.player?.defaultName && s.player.defaultName !== '당신')) && !s.player?.randomName && (
            <>
              <span>{s.player?.askName ? '비워 두면' : ''}</span>
              <span className="small-input wide">
                <OptText value={s.player?.defaultName} placeholder="이름" onChange={(v) => update((d) => void ((d.settings.player ??= {}).defaultName = v))} />
              </span>
            </>
          )}
          <Tip>이름을 쓰지 않으면 상태창·인생표에 이름이 나오지 않고, 본문의 {'{$이름}'}은 "당신"이 됩니다.</Tip>
        </div>
        {(s.player?.askName || s.player?.randomName) && (
          <div className="sentence">
            <span>무작위 이름은</span>
            <Select
              value={s.player?.nameStyle ?? ''}
              onChange={(v) => update((d) => void ((d.settings.player ??= {}).nameStyle = (v || undefined) as NameStyleId | undefined))}
              options={[['', s.player?.askName ? '쓰지 않습니다 (비워 두면 위 이름)' : '쓰지 않습니다 (위 이름 그대로)'], ...NAME_STYLES.map((n) => [n.id, `${n.label} (${n.names.length}개)`] as [string, string])]}
            />
            <Tip>
              성씨 없이 이름만 담긴 주머니입니다. 출신마다 다른 주머니를 쓰려면 출신의 '이름 주머니'를 고르세요. 그러면 출신을 정한 뒤에 이름을 정합니다.
            </Tip>
          </div>
        )}
        <div className="sentence">
          <span>주인공 성별은</span>
          <Select
            value={s.player?.gender ?? ''}
            onChange={(v) => update((d) => void ((d.settings.player ??= {}).gender = (v || undefined) as NameGender | 'ask' | undefined))}
            options={[
              ['', '정하지 않습니다 (주머니 전체에서 뽑기)'],
              ...NAME_GENDERS.map((g) => [g.id, `${g.word}입니다 (${g.label}만 뽑기)`] as [string, string]),
              ['ask', '처음 플레이할 때 플레이어에게 묻습니다'],
            ]}
          />
          <Tip>
            이름 주머니는 남자 / 여자 / 중성적 이름으로 나뉘어 있습니다. 성별을 정하거나 플레이어가 고르면 그 묶음에서만 뽑고, 본문에서는 {'{$성별}'}(남자·여자·중성)로 쓸 수 있습니다. 플레이어가 "상관없음"을 고르면 {'{$성별}'}은 빈 글자입니다.
          </Tip>
        </div>
        {(s.player?.askName || s.player?.randomName) && s.player?.nameStyle && (
          <div className="sentence">
            <span>주머니에서 뺄 이름</span>
            <span className="small-input wide">
              <ListInput
                value={s.player?.excludeNames}
                placeholder="예: 등장인물 이름을 쉼표로"
                onChange={(v) => update((d) => void ((d.settings.player ??= {}).excludeNames = v))}
              />
            </span>
            <Tip>조연과 이름이 겹치지 않도록 무작위로 뽑지 않을 이름입니다.</Tip>
          </div>
        )}
        {s.player?.nameStyle && (
          <p className="field-hint">
            예: {nameCandidates(s.player.nameStyle, s.player.gender === 'ask' ? undefined : s.player.gender, s.player.excludeNames).slice(0, 12).join(', ')} …
          </p>
        )}
      </Section>

      <Section title="시간" topic="settings-time" help="시간 단위가 '없음'이면 날짜와 나이가 없습니다. 인생형은 년·월·일 중 하나를 고르세요.">
        <Row>
          <Field label="시간 단위">
            <Select
              value={s.calendar.unit}
              onChange={(v) => update((d) => void (d.settings.calendar.unit = v ?? 'none'))}
              options={[
                ['none', '없음'],
                ['year', '년'],
                ['month', '월'],
                ['day', '일'],
              ]}
            />
          </Field>
          {s.calendar.unit !== 'none' && (
            <>
              <Field label="시작 날짜" hint="2000 / 2000.03 / 2000.03.15">
                <OptText value={s.calendar.start} mono onChange={(v) => update((d) => void (d.settings.calendar.start = v))} />
              </Field>
              <Field label="시작 나이">
                <NumInput value={s.calendar.startAge} placeholder="0" onChange={(v) => update((d) => void (d.settings.calendar.startAge = v))} />
              </Field>
              <Field label="날짜 표시" hint="{y}는 년, {m}은 월, {d}는 일. 예: {y}년 {m}월">
                <OptText value={s.calendar.format} mono onChange={(v) => update((d) => void (d.settings.calendar.format = v))} />
              </Field>
            </>
          )}
        </Row>
      </Section>

      <More label="고급 설정 (종료 조건 · 판정 · 랜덤 · 화면)" active={!!(s.idleEnding || s.maxTurns || s.check || s.scheduler || s.ui)}>
      <Section title="기본 종료 조건" topic="settings-end" help="엔딩마다 붙이는 자동 조건(체력 0 등)은 '엔딩' 화면에서 정합니다.">
        <Row>
          <Field label="이야기 소진 엔딩" hint="아무 일도 일어나지 않는 턴이 n번 이어지면">
            <Select
              value={s.idleEnding?.ending}
              allowEmpty="(사용 안 함)"
              options={endingOptions}
              onChange={(v) => update((d) => void (d.settings.idleEnding = v ? { turns: d.settings.idleEnding?.turns ?? 1, ending: v } : undefined))}
            />
          </Field>
          {s.idleEnding && (
            <Field label="턴 수">
              <NumInput value={s.idleEnding.turns} onChange={(v) => update((d) => void (d.settings.idleEnding!.turns = v ?? 1))} />
            </Field>
          )}
          <Field label="최대 턴 엔딩" hint="안전장치">
            <Select
              value={s.maxTurns?.ending}
              allowEmpty="(사용 안 함)"
              options={endingOptions}
              onChange={(v) => update((d) => void (d.settings.maxTurns = v ? { turns: d.settings.maxTurns?.turns ?? 500, ending: v } : undefined))}
            />
          </Field>
          {s.maxTurns && (
            <Field label="최대 턴">
              <NumInput value={s.maxTurns.turns} onChange={(v) => update((d) => void (d.settings.maxTurns!.turns = v ?? 500))} />
            </Field>
          )}
        </Row>
      </Section>

      <Section title="판정 공식 (난이도 방식)" topic="settings-check" help="선택지의 ‘판정’이 성공할 확률(%)을 계산하는 식입니다. 능력치 자리에 $skill, 난이도 자리에 $difficulty, 보정 자리에 $bonus를 쓰고, 변수 이름도 그대로 쓸 수 있습니다.">
        <Field label="성공 확률 공식" wide>
          <ExprInput value={s.check?.formula} placeholder="50 + 15 * ($skill - $difficulty) + $bonus" onChange={(v) => update((d) => void ((d.settings.check ??= {}).formula = v as string))} />
        </Field>
        <Row>
          <Field label="최소 %">
            <NumInput value={s.check?.min} placeholder="5" onChange={(v) => update((d) => void ((d.settings.check ??= {}).min = v))} />
          </Field>
          <Field label="최대 %">
            <NumInput value={s.check?.max} placeholder="95" onChange={(v) => update((d) => void ((d.settings.check ??= {}).max = v))} />
          </Field>
          <Field label="확률 표시">
            <Select
              value={s.check?.display}
              allowEmpty="퍼센트 (기본)"
              options={[
                ['label', '이름 (유리/불리)'],
                ['percent', '퍼센트'],
                ['both', '둘 다'],
                ['none', '숨김'],
              ]}
              onChange={(v) => update((d) => void ((d.settings.check ??= {}).display = v))}
            />
          </Field>
          <Field label="성공 알림">
            <OptText value={s.check?.successNote} placeholder="성공" onChange={(v) => update((d) => void ((d.settings.check ??= {}).successNote = v))} />
          </Field>
          <Field label="실패 알림">
            <OptText value={s.check?.failureNote} placeholder="실패" onChange={(v) => update((d) => void ((d.settings.check ??= {}).failureNote = v))} />
          </Field>
        </Row>
        {(s.check?.display === 'label' || s.check?.display === 'both') && (
          <Field label="확률 이름" wide hint="확률(%)에 따라 선택지 옆에 보일 이름. 위에서부터 '확률이 ○% 미만이면' 처음 맞는 이름을 씁니다. 비워 두면 기본(매우 불리·불리·반반·유리·매우 유리)을 씁니다.">
            <ThresholdList
              value={s.check?.labels?.map((l) => ({ n: l.below, text: l.text }))}
              onChange={(next) => update((d) => void ((d.settings.check ??= {}).labels = next?.map((x) => ({ below: x.n, text: x.text }))))}
              before="확률이"
              after="% 미만이면"
              textPlaceholder="예: 위태로움"
              defaults={[
                { n: 15, text: '매우 불리' },
                { n: 40, text: '불리' },
                { n: 61, text: '반반' },
                { n: 86, text: '유리' },
                { n: 101, text: '매우 유리' },
              ]}
            />
          </Field>
        )}
      </Section>

      <Section title="랜덤 이벤트 조정" topic="settings-random">
        <Row>
          <Field label="기본 가중치">
            <NumInput value={s.scheduler?.defaultWeight} placeholder="10" onChange={(v) => update((d) => void ((d.settings.scheduler ??= {}).defaultWeight = v))} />
          </Field>
          <Field label="같은 그룹 연속 방지" hint="직전 n개와 같은 그룹 제외">
            <NumInput value={s.scheduler?.groupBlock} placeholder="2" onChange={(v) => update((d) => void ((d.settings.scheduler ??= {}).groupBlock = v))} />
          </Field>
        </Row>
      </Section>

      <Section title="화면">
        <Row>
          <Check value={s.ui?.typewriter !== false} onChange={(v) => update((d) => void ((d.settings.ui ??= {}).typewriter = v))} label="타자기 효과" />
          <Field label="'계속' 버튼 문구">
            <OptText value={s.ui?.continueText} placeholder="계속" onChange={(v) => update((d) => void ((d.settings.ui ??= {}).continueText = v))} />
          </Field>
        </Row>
      </Section>
      </More>

      <ThemeSection />

      <Section title="플레이 화면 용어" help="플레이어에게 보이는 이름을 작품 분위기에 맞게 바꿉니다. 비우면 기본 이름을 씁니다. 예: 인벤토리 → 배낭, 아이템 → 소지품, 상태 → 컨디션">
        <Row>
          {(
            [
              ['inventory', '인벤토리', '인벤토리'],
              ['items', '아이템', '아이템 쪽'],
              ['statuses', '상태', '상태 쪽'],
              ['use', '사용', '사용 버튼'],
            ] as const
          ).map(([key, fallback, label]) => (
            <Field key={key} label={label}>
              <OptText value={s.ui?.terms?.[key]} placeholder={fallback} onChange={(v) => update((d) => void (((d.settings.ui ??= {}).terms ??= {})[key] = v))} />
            </Field>
          ))}
        </Row>
        <p className="muted small">인벤토리 창은 아이템과 상태를 쪽으로 나눠 보여 줍니다. 여기서 바꾼 이름이 버튼·탭·빈 목록 문구에 쓰입니다.</p>
      </Section>
    </>
  );
}

// ───────────────────────── 단계와 턴 ─────────────────────────

const PHASE_LABEL: Record<PhaseDef['type'], string> = { events: '장면 뽑기', menu: '행동 고르기', script: '블록 실행' };

export function StagesSection({ selected }: { selected?: string }) {
  const { pkg, update, open } = useEditor();
  const stages = pkg.settings.stages;
  const pools = [...new Set(pkg.events.map((e) => e.pool).filter((p): p is string => !!p))];
  const menuPools = [...new Set((pkg.actions ?? []).map((a) => a.pool))];
  const editStage = (id: string, fn: (s: StageDef) => void) => update((d) => fn(d.settings.stages.find((s) => s.id === id)!));
  return (
    <>
      <Intro topic="stages">인생을 유년기·청년기처럼 나누고, 단계마다 한 턴의 길이와 그 턴에 일어나는 일을 정합니다.</Intro>
      <datalist id="pool-list">
        {pools.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="menu-pool-list">
        {menuPools.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Collection
        items={stages}
        selected={selected}
        onSelect={(id) => open('stages', id)}
        label={(s) => s.name}
        sub={(s) => (s.ages ? (s.ages[1] >= 150 ? `${s.ages[0]}세부터` : `${s.ages[0]}~${s.ages[1]}세`) : s.when ? describeExpr(s.when, pkg) : '항상')}
        addLabel="단계"
        onAdd={() =>
          update((d) => {
            const id = uniqueId('stage', d.settings.stages.map((s) => s.id));
            d.settings.stages.push({ id, name: '새 단계', turn: { length: 1 }, phases: [{ type: 'events', pools: [pools[0] ?? '기본'], select: 'fixedThenRandom' }] });
            open('stages', id);
          })
        }
        onRemove={(id) => update((d) => void (d.settings.stages = d.settings.stages.filter((s) => s.id !== id)))}
        onMove={(a, b) => update((d) => move(d.settings.stages, a, b))}
      >
        {(st) => (
          <Section title={st.name} topic="stages">
            <Row>
              <Field label="이름">
                <TextInput value={st.name} onChange={(v) => editStage(st.id, (s) => void (s.name = v))} />
              </Field>
              <Field label="나이">
                <span className="inline">
                  <NumInput value={st.ages?.[0]} onChange={(v) => editStage(st.id, (s) => void (s.ages = v === undefined ? undefined : [v, s.ages?.[1] ?? 200]))} />
                  ~
                  <NumInput value={st.ages?.[1]} onChange={(v) => editStage(st.id, (s) => void (s.ages = v === undefined ? undefined : [s.ages?.[0] ?? 0, v]))} />
                  세
                </span>
              </Field>
              <Field label="한 턴의 길이" hint={pkg.settings.calendar.unit === 'none' ? '시간 단위 없음' : `단위: ${{ year: '년', month: '월', day: '일', none: '' }[pkg.settings.calendar.unit]}. 2면 한 턴에 2${{ year: '년', month: '달', day: '일', none: '' }[pkg.settings.calendar.unit]}이 흐릅니다.`}>
                <ExprInput value={st.turn.length} numeric onChange={(v) => editStage(st.id, (s) => void (s.turn.length = v ?? 1))} />
              </Field>
            </Row>
            <More active={!!(st.when || st.turn.clip)}>
              <Row>
                <Field label="고유 이름">
                  <IdInput
                    value={st.id}
                    taken={stages.map((s) => s.id)}
                    onChange={(v) =>
                      update((d) => {
                        renameRefs(d, 'stage', st.id, v);
                        d.settings.stages.find((s) => s.id === st.id)!.id = v;
                        open('stages', v);
                      })
                    }
                  />
                </Field>
                <Field label="또는 조건" hint="나이 대신(또는 함께) 이 조건이 맞으면 이 단계">
                  <CondInput value={st.when} placeholder="나이로 정함" onChange={(v) => editStage(st.id, (s) => void (s.when = v))} />
                </Field>
                <Check value={st.turn.clip} onChange={(v) => editStage(st.id, (s) => void (s.turn.clip = v || undefined))} label="턴이 다음 단계로 넘어가지 않게 자르기" />
              </Row>
            </More>

            <h4>턴 안에서 일어나는 일 (순서대로)</h4>
            {st.phases.map((p, i) => (
              <div key={i} className="phase">
                <div className="phase-head">
                  <span className="phase-no">{i + 1}</span>
                  <strong>{PHASE_LABEL[p.type]}</strong>
                  <ItemTools
                    index={i}
                    length={st.phases.length}
                    onMove={(to) => editStage(st.id, (s) => move(s.phases, i, to))}
                    onRemove={() => editStage(st.id, (s) => void s.phases.splice(i, 1))}
                  />
                </div>
                {p.type === 'events' && (
                  <div className="sentence">
                    <span className="small-input wide">
                      <ListInput value={p.pools} onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).pools = v ?? []))} />
                    </span>
                    <span>주머니에서</span>
                    <Select
                      value={p.select}
                      onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).select = v ?? 'fixedThenRandom'))}
                      options={[
                        ['fixedThenRandom', '반드시 나올 장면을 먼저, 없으면 무작위로'],
                        ['fixed', '반드시 나올 장면만'],
                        ['random', '무작위로'],
                      ]}
                    />
                    <span className="small-input">
                      <NumInput value={p.count} placeholder="1" onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).count = v))} />
                    </span>
                    <span>개까지 뽑습니다. 확률</span>
                    <span className="small-input">
                      <ExprInput value={p.chance} numeric placeholder="100" onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).chance = v))} />
                    </span>
                    <span>%</span>
                  </div>
                )}
                {p.type === 'menu' && (
                  <div className="sentence">
                    <span className="small-input wide">
                      <TextInput value={p.pool} list="menu-pool-list" onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).pool = v))} />
                    </span>
                    <span>행동 메뉴를 띄웁니다. 제목</span>
                    <span className="small-input wide">
                      <OptText value={p.title} placeholder="(없음)" onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).title = v))} />
                    </span>
                    <span>안내</span>
                    <span className="small-input wide">
                      <OptText value={p.text} placeholder="(없음)" onChange={(v) => editStage(st.id, (s) => void ((s.phases[i] as typeof p).text = v))} />
                    </span>
                  </div>
                )}
                {p.type === 'script' && <CommandList list={p.do} edit={(fn) => editStage(st.id, (s) => fn((s.phases[i] as typeof p).do))} />}
              </div>
            ))}
            <select
              className="add-command"
              value=""
              onChange={(e) => {
                const t = e.target.value as PhaseDef['type'];
                if (!t) return;
                const phase: PhaseDef =
                  t === 'events'
                    ? { type: 'events', pools: [pools[0] ?? '기본'], select: 'fixedThenRandom' }
                    : t === 'menu'
                      ? { type: 'menu', pool: menuPools[0] ?? '행동' }
                      : { type: 'script', do: [] };
                editStage(st.id, (s) => void s.phases.push(phase));
              }}
            >
              <option value="">＋ 이 턴에 할 일 추가…</option>
              <option value="events">장면 뽑기</option>
              <option value="menu">행동 고르기</option>
              <option value="script">블록 실행</option>
            </select>
          </Section>
        )}
      </Collection>
    </>
  );
}
