// ⚠ 내부 테스트 전용 — 배포·샘플 사용 금지.
// Project Moon '도시' 세계관은 외부 IP다. 이 파일은 "손으로 짠 프로토타입(src/)을
// 툴 기능만으로 똑같이 재현할 수 있는가"를 검증하기 위해서만 존재한다.
//
// 구성: 프로토타입 엔진에 하드코딩돼 있던 규칙(가치관 경험치, 공포 피해, 월말 정산, 노화,
// 붕괴·사망 판정, 턴 구조)을 패키지의 변수·표·스크립트·트리거로 옮기고,
// 콘텐츠 YAML(이벤트·행동·출신·결산)은 기계적으로 변환한다.

import { load as loadYaml } from 'js-yaml';
import type {
  ActionDef,
  ChoiceDef,
  Command,
  EpilogueParagraph,
  EventDef,
  OriginDef,
  Outcome,
  StoryPackage,
  VariableDef,
} from '../../packages/engine/src/types';

const VIRTUES = ['용기', '신중', '자제', '정의'];
const ABILITIES = ['전투', '기술', '화술', '학식', '예술', '은신', '생존', '사업'];
const SINS = ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투'];
const ITEM_TAGS: Record<string, string> = { '소지:K사앰플': 'K사앰플' };
const STATUS_TAGS: Record<string, string> = { '상태:중지장부': '중지장부', '상태:금이간마음': '금이간마음' };

// ───────────────────────── 옛 형식 → 수식 ─────────────────────────

type OldCond = Record<string, any>;
type OldEffect = Record<string, any>;

const q = (s: string) => `'${String(s).replace(/'/g, "\\'")}'`;
/** YAML이 984.10을 숫자 984.1로 읽는 문제를 되돌린다 */
const dateStr = (d: unknown) => (typeof d === 'number' ? d.toFixed(2) : String(d));

function range(subject: string, r: { gte?: number; lte?: number }): string {
  const parts: string[] = [];
  if (r.gte !== undefined) parts.push(`${subject} >= ${r.gte}`);
  if (r.lte !== undefined) parts.push(`${subject} <= ${r.lte}`);
  return parts.join(' and ') || 'true';
}

function tagCond(spec: string): string {
  if (spec in ITEM_TAGS) return `item(${q(ITEM_TAGS[spec])}) > 0`;
  if (spec in STATUS_TAGS) return `status(${q(STATUS_TAGS[spec])}) > 0`;
  const eq = spec.indexOf('=');
  return eq < 0 ? `has(${q(spec)})` : `has(${q(spec.slice(0, eq))}, ${q(spec.slice(eq + 1))})`;
}

export function cond(c: OldCond | undefined): string | undefined {
  if (!c) return undefined;
  const wrap = (s: string) => (/ and | or /.test(s) ? `(${s})` : s);
  if ('all' in c) return c.all.map((x: OldCond) => wrap(cond(x)!)).join(' and ');
  if ('any' in c) return c.any.map((x: OldCond) => wrap(cond(x)!)).join(' or ');
  if ('not' in c) return `not ${wrap(cond(c.not)!)}`;
  if ('tag' in c) return tagCond(c.tag);
  if ('tagNum' in c) return range(`tag(${q(c.tagNum.key)})`, c.tagNum);
  if ('ability' in c || 'virtue' in c)
    return Object.entries(c.ability ?? c.virtue)
      .map(([k, v]) => `${k} >= ${v}`)
      .join(' and ');
  if ('money' in c) return range('돈', c.money);
  if ('hp' in c) return range('체력', c.hp);
  if ('sp' in c) return range('정신', c.sp);
  if ('age' in c) return `$age >= ${c.age[0]} and $age <= ${c.age[1]}`;
  if ('date' in c) return `$now >= date(${q(dateStr(c.date[0]))}) and $now <= date(${q(dateStr(c.date[1]))})`;
  if ('stage' in c) {
    const stages: string[] = Array.isArray(c.stage) ? c.stage : [c.stage];
    return stages.map((s) => `$stage == ${q(s)}`).join(' or ');
  }
  if ('seen' in c) return `seen(${q(c.seen)})`;
  if ('sinTop' in c) return `top('죄종') == ${q(c.sinTop)}`;
  throw new Error(`변환할 수 없는 조건: ${JSON.stringify(c)}`);
}

function tagValue(raw: string): number | string {
  const n = Number(raw);
  return raw !== '' && !Number.isNaN(n) ? n : q(raw);
}

export function effects(list: OldEffect[] | undefined): Command[] {
  const out: Command[] = [];
  for (const e of list ?? []) {
    if ('hp' in e) out.push({ do: 'add', var: '체력', value: e.hp });
    else if ('hpMax' in e) out.push({ do: 'add', var: '최대체력보정', value: e.hpMax });
    else if ('sp' in e) out.push({ do: 'add', var: '정신', value: e.sp });
    else if ('money' in e) out.push({ do: 'add', var: '돈', value: e.money });
    else if ('fear' in e) out.push({ do: 'call', script: '공포', args: { 위험도: e.fear } });
    else if ('addTag' in e) {
      const spec: string = e.addTag;
      if (spec in ITEM_TAGS) out.push({ do: 'item', id: ITEM_TAGS[spec], count: 1 });
      else if (spec in STATUS_TAGS) out.push({ do: 'status', id: STATUS_TAGS[spec] });
      else {
        const eq = spec.indexOf('=');
        out.push(eq < 0 ? { do: 'tag', key: spec } : { do: 'tag', key: spec.slice(0, eq), value: tagValue(spec.slice(eq + 1)) });
      }
    } else if ('removeTag' in e) {
      const spec: string = e.removeTag;
      if (spec in ITEM_TAGS) out.push({ do: 'item', id: ITEM_TAGS[spec], count: -1 });
      else if (spec in STATUS_TAGS) out.push({ do: 'status', id: STATUS_TAGS[spec], remove: true });
      else {
        const eq = spec.indexOf('=');
        out.push(eq < 0 ? { do: 'untag', key: spec } : { do: 'untag', key: spec.slice(0, eq), value: spec.slice(eq + 1) });
      }
    } else if ('tagAdd' in e) out.push({ do: 'tag', key: e.tagAdd.key, add: e.tagAdd.value });
    else if ('virtue' in e)
      for (const [k, v] of Object.entries(e.virtue)) out.push({ do: 'add', var: `${k}경험`, value: v as number });
    else if ('ability' in e) for (const [k, v] of Object.entries(e.ability)) out.push({ do: 'add', var: k, value: v as number });
    else if ('emotion' in e) out.push({ do: 'add', var: e.emotion === 'pos' ? '긍정감정' : '부정감정', value: 1 });
    else if ('sin' in e) out.push({ do: 'add', var: e.sin, value: 1 });
    else if ('advance' in e) out.push({ do: 'advance', amount: e.advance });
    else if ('end' in e) out.push({ do: 'end', ending: e.end });
    else throw new Error(`변환할 수 없는 효과: ${JSON.stringify(e)}`);
  }
  return out;
}

export function text(t: string | undefined): string | undefined {
  if (t === undefined) return undefined;
  return t
    .replace(/\{이름\}/g, '{$이름}')
    .replace(/\{나이\}/g, '{$나이}')
    .replace(/\{날짜\}/g, '{$날짜}')
    .replace(/\{구\}/g, "{tag('출신구', '어느 구')}")
    .replace(/\{거주\}/g, "{tag('거주', '어딘가')}")
    .trim();
}

function outcome(o: any): Outcome | undefined {
  if (!o) return undefined;
  return { text: text(o.text), do: effects(o.effects), goto: o.goto };
}

function choice(c: any): ChoiceDef {
  return {
    text: text(c.text)!,
    requires: cond(c.requires),
    hidden: c.hidden,
    check: c.check && {
      skill: c.check.ability ?? c.check.virtue,
      difficulty: c.check.difficulty,
      bonus: c.check.bonus,
    },
    success: outcome(c.success),
    failure: outcome(c.failure),
    outcome: outcome(c.outcome),
  };
}

function event(e: any): EventDef {
  const kind = e.kind ?? 'encounter';
  return {
    id: e.id,
    title: text(e.title),
    text: text(e.text)!,
    pool: kind === 'crisis' ? undefined : kind,
    stages: e.stage && (Array.isArray(e.stage) ? e.stage : [e.stage]),
    ages: e.age,
    dates: e.date && [dateStr(e.date[0]), dateStr(e.date[1])],
    when: cond(e.when),
    fixed: e.fixed,
    once: e.once,
    weight: e.weight,
    cooldown: e.cooldown,
    group: e.group,
    tone: e.tone,
    // 인생표: 고정(역사·생애) 이벤트는 제목으로 기록
    record: e.fixed && e.title ? { text: text(e.title)!, importance: 3 } : undefined,
    choices: (e.choices ?? []).map(choice),
  };
}

function origin(o: any): OriginDef {
  const doList: Command[] = [{ do: 'set', var: '돈', value: o.money }];
  doList.push(...effects((o.tags ?? []).map((t: string) => ({ addTag: t }))));
  for (const [k, v] of Object.entries({ ...o.virtues, ...o.abilities })) doList.push({ do: 'set', var: k, value: v as number });
  doList.push({ do: 'set', var: '체력', value: '최대체력' });
  doList.push({ do: 'tag', key: '기록:출생', value: q(o.id) });
  return {
    id: o.id,
    title: o.title,
    summary: o.summary,
    text: text(o.text),
    weight: o.weight,
    unlock: o.unlocked === false ? 'false' : undefined,
    do: doList,
  };
}

// ───────────────────────── 규칙(옛 엔진 코드) ─────────────────────────

function variables(): VariableDef[] {
  const vars: VariableDef[] = [
    { id: '체력', type: 'number', initial: 10, max: '최대체력', integer: true, display: { as: 'bar', order: 1, notify: true } },
    { id: '최대체력보정', type: 'number', initial: 0 },
    { id: '최대체력', type: 'number', formula: 'max(1, 10 + (용기 - 1) * 2 + 최대체력보정)' },
    {
      id: '정신',
      type: 'number',
      initial: 0,
      min: -45,
      max: 45,
      display: { as: 'bar', order: 2, notify: true, labels: [{ upTo: -30, text: '사기 저하' }, { upTo: 45, text: '' }] },
    },
    { id: '돈', name: '안', type: 'number', initial: 0, display: { as: 'number', order: 3, notify: '{delta} 안', format: '{value} 안' } },
    { id: '정신등급', type: 'number', formula: 'round((신중 + 용기) / 2)' },
    { id: '긍정감정', type: 'number', initial: 0 },
    { id: '부정감정', type: 'number', initial: 0 },
    {
      id: '인생점수',
      type: 'number',
      formula: "tag('명성') + max(0, floor(돈 / 10000000)) + floor($age / 10) + (has('신체:EGO') ? 20 : 0)",
    },
    { id: '인생등급', type: 'string', formula: "lookup('인생등급', 인생점수, '등급')" },
  ];
  VIRTUES.forEach((v, i) => {
    vars.push({ id: v, type: 'number', initial: 1, min: 1, max: 5, group: '가치관', display: { as: 'number', order: 10 + i } });
    vars.push({ id: `${v}경험`, type: 'number', initial: 0 });
  });
  ABILITIES.forEach((a, i) =>
    vars.push({ id: a, type: 'number', initial: 0, min: 0, max: 5, group: '능력', display: { as: 'number', order: 20 + i, notify: true } }),
  );
  SINS.forEach((s) => vars.push({ id: s, type: 'number', initial: 0, group: '죄종' }));
  return vars;
}

function systemPackage(): Omit<StoryPackage, 'events' | 'actions' | 'endings'> {
  const encounterPools = ['story', 'encounter'];
  return {
    format: 'ifb/1',
    meta: { id: 'internal.city-test', title: '도시 생활 (내부 테스트)', description: '배포 금지 — 엔진 표현력 검증용' },
    settings: {
      mode: 'life',
      calendar: { unit: 'month', start: '964.01', format: '{y}년 {m}월' },
      player: { defaultName: '당신' },
      stages: [
        {
          id: 'child',
          name: '유년기',
          ages: [0, 12],
          turn: { length: 24, clip: true },
          phases: [
            { type: 'events', pools: encounterPools, select: 'fixed' },
            { type: 'events', pools: encounterPools, select: 'random' },
          ],
        },
        {
          id: 'teen',
          name: '청소년기',
          ages: [13, 19],
          turn: { length: 12, clip: true },
          phases: [
            { type: 'events', pools: encounterPools, select: 'fixed' },
            { type: 'events', pools: encounterPools, select: 'random' },
          ],
        },
        {
          id: 'adult',
          name: '성인기',
          ages: [20, 999],
          turn: { length: 1 },
          phases: [
            { type: 'events', pools: encounterPools, select: 'fixed' },
            { type: 'menu', pool: 'monthly', text: '{$날짜}. 이번 달은 무엇을 하며 보내시겠습니까?' },
            { type: 'events', pools: encounterPools, select: 'random', chance: 70 },
            { type: 'events', pools: ['night'], select: 'fixedThenRandom' },
          ],
        },
      ],
      check: {
        formula: '50 + 15 * ($skill - $difficulty) + 정신 * 0.5 + $bonus',
        min: 5,
        max: 95,
        display: 'label',
        labels: [
          { below: 15, text: '매우 불리' },
          { below: 40, text: '불리' },
          { below: 61, text: '반반' },
          { below: 86, text: '유리' },
          { below: 101, text: '매우 유리' },
        ],
      },
      scheduler: { defaultWeight: 10, groupBlock: 2, toneBalance: { window: 5, threshold: 4, factor: 0.5 } },
    },
    variables: variables(),
    tables: [
      {
        id: '공포',
        name: '공포 피해 (위험도 − 정신등급)',
        match: 'range',
        columns: ['단계', '피해', '알림'],
        rows: [
          { key: -1, values: { 단계: '여유', 피해: 0, 알림: false } },
          { key: 0, values: { 단계: '침착', 피해: 0, 알림: false } },
          { key: 1, values: { 단계: '긴장', 피해: -5, 알림: true } },
          { key: 2, values: { 단계: '공포', 피해: -12, 알림: true } },
          { key: 3, values: { 단계: '절망', 피해: -25, 알림: true } },
        ],
        fallback: { 단계: '압도', 피해: -90, 알림: true },
      },
      {
        id: '생활비',
        match: 'exact',
        columns: ['비용'],
        rows: [
          { key: '둥지', values: { 비용: 2_200_000 } },
          { key: '뒷골목', values: { 비용: 400_000 } },
          { key: '무등록', values: { 비용: 50_000 } },
        ],
        fallback: { 비용: 400_000 },
      },
      {
        id: '인생등급',
        match: 'range',
        columns: ['등급'],
        rows: [
          { key: 4, values: { 등급: '뜬소문' } },
          { key: 14, values: { 등급: '도시 괴담' } },
          { key: 29, values: { 등급: '도시 전설' } },
          { key: 49, values: { 등급: '도시 질병' } },
          { key: 79, values: { 등급: '도시 악몽' } },
        ],
        fallback: { 등급: '도시의 별' },
      },
    ],
    items: [{ id: 'K사앰플', name: 'K사 앰플', description: '죽기 직전에 쓰면 몸이 원래대로 돌아온다.' }],
    statuses: [
      { id: '중지장부', name: '중지의 장부', tone: 'negative', description: '중지의 앙갚음 장부에 이름이 올랐다.' },
      { id: '금이간마음', name: '금이 간 마음', tone: 'negative', description: '다음에 목소리가 오면 거부할 수 없다.' },
    ],
    origins: {
      mode: 'choose',
      offer: 3,
      text: '당신은 26개의 구로 나뉜 거대한 도시에서 태어납니다. 964년, 로보토미 코퍼레이션이 날개가 되기 한참 전의 일입니다.\n\n어디에서 태어날지는, 당신이 고를 수 있는 몇 안 되는 것 중 하나입니다.',
      list: [],
    },
    scripts: [
      {
        id: '공포',
        name: '공포 피해 (Lobotomy Corporation)',
        params: ['위험도'],
        do: [
          { do: 'let', name: '차', value: '$위험도 - 정신등급' },
          { do: 'add', var: '정신', value: "lookup('공포', $차, '피해')" },
          { do: 'if', cond: "lookup('공포', $차, '알림')", then: [{ do: 'note', text: "공포: {lookup('공포', $차, '단계')}" }] },
        ],
      },
      {
        id: '월말정산',
        do: [
          { do: 'let', name: '거주지', value: "tag('거주', '뒷골목')" },
          { do: 'let', name: '비용', value: "has('생활비') ? tag('생활비') : lookup('생활비', $거주지, '비용')" },
          { do: 'add', var: '돈', value: "tag('월급') - $비용 - tag('상납금')" },
          {
            do: 'if',
            cond: '돈 >= 0',
            then: [{ do: 'untag', key: '체납' }],
            else: [
              { do: 'tag', key: '체납', add: 1 },
              {
                do: 'if',
                cond: "tag('체납') >= 2 and $거주지 == '둥지'",
                then: [
                  { do: 'tag', key: '거주', value: "'뒷골목'" },
                  { do: 'note', text: '세금을 감당하지 못해 둥지에서 밀려났다.' },
                ],
                else: [
                  {
                    do: 'if',
                    cond: "tag('체납') >= 2 and $거주지 == '뒷골목'",
                    then: [
                      { do: 'tag', key: '거주', value: "'무등록'" },
                      { do: 'note', text: '거주구역 등록이 만료되었다. 이제 밤이 당신을 지켜주지 않는다.' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    triggers: [
      // 사망 판정(앰플이 있으면 소모하고 생존)
      {
        id: '사망판정',
        on: 'watch',
        when: '체력 <= 0',
        do: [
          {
            do: 'if',
            cond: "item('K사앰플') > 0",
            then: [
              { do: 'item', id: 'K사앰플', count: -1, silent: true },
              { do: 'set', var: '체력', value: '최대체력' },
              {
                do: 'text',
                text: '의식이 끊기기 직전, 품속의 K사 앰플을 목에 꽂습니다. 살이 차오르는 감각이 끔찍하게 간지럽습니다. 당신은 원래의 모습으로 되돌아왔습니다.',
              },
              { do: 'note', text: 'K사 앰플 소모' },
            ],
            else: [{ do: 'end', ending: '사망' }],
          },
        ],
      },
      // 정신 붕괴: 백야(982) 이후엔 목소리, 이전엔 일반 붕괴
      {
        id: '붕괴',
        on: 'watch',
        when: '정신 <= -45 and not $pending',
        do: [
          {
            do: 'if',
            cond: "$now >= date('982.01')",
            then: [{ do: 'goto', event: 'crisis.voice' }],
            else: [{ do: 'goto', event: 'crisis.breakdown' }],
          },
        ],
      },
      // 가치관 경험치 → 등급 (다음 등급 × 3)
      ...VIRTUES.map((v) => ({
        id: `${v}등급`,
        on: 'watch' as const,
        when: `${v} < 5 and ${v}경험 >= (${v} + 1) * 3`,
        do: [
          { do: 'add' as const, var: `${v}경험`, value: `-(${v} + 1) * 3` },
          { do: 'add' as const, var: v, value: 1 },
          { do: 'note' as const, text: `${v}{이/가} {${v}}등급이 되었다.` },
        ],
      })),
      { id: '월말', on: 'tick', when: "$stage == 'adult'", do: [{ do: 'call', script: '월말정산' }] },
      { id: '정신회복', on: 'tick', when: '정신 < 0', do: [{ do: 'add', var: '정신', value: 1 }] },
      { id: '체력회복', on: 'tick', when: '체력 > 0', do: [{ do: 'add', var: '체력', value: 1 }] },
      {
        id: '노화',
        on: 'birthday',
        when: "$age >= 50 and not has('신체:노화억제')",
        do: [
          { do: 'add', var: '최대체력보정', value: -1 },
          { do: 'set', var: '체력', value: 'min(체력, 최대체력)' },
        ],
      },
      { id: '노환', on: 'birthday', when: '$age >= 60 and chance(($age - 60) * 3)', do: [{ do: 'end', ending: '노환' }] },
      { id: '이번달정리', on: 'turnEnd', do: [{ do: 'untag', prefix: '이번달:' }] },
    ],
    epilogue: {
      header: '{$날짜}, {$이름}의 이야기는 {$나이}세에 끝났습니다.',
      paragraphs: [],
      footer:
        "{if 인생등급 == '도시의 별'}오늘 도시의 별 하나가 졌습니다.{else}당신의 인생은 하나 협회의 기록에 '{인생등급}'{으로/로} 남았습니다.{/if}",
    },
  };
}

const YEAR_ACTION: ActionDef = {
  id: '__year',
  pool: 'monthly',
  text: '평온하게 1년 보내기',
  requires: '정신 >= 0 and 돈 >= 0',
  outcome: {
    text: '별일 없는 한 해가 지나갔습니다. 도시에서 "별일 없음"은 꽤 큰 행운입니다.',
    do: [
      { do: 'endTurn', times: 12 },
      { do: 'add', var: '정신', value: 5 },
      { do: 'note', text: '1년 경과' },
    ],
  },
};

/** 경로 → YAML 원문 (src/content/**) */
export function buildCityPackage(files: Record<string, string>): StoryPackage {
  const pkg = systemPackage() as StoryPackage;
  pkg.events = [];
  pkg.actions = [];
  pkg.endings = [];
  for (const [path, raw] of Object.entries(files)) {
    const data: any = loadYaml(raw);
    if (data == null) continue;
    const p = path.replace(/\\/g, '/');
    if (p.includes('/events/')) pkg.events.push(...data.map(event));
    else if (p.endsWith('actions.yaml'))
      pkg.actions.push(
        ...data.map((a: any): ActionDef => ({ ...choice(a), id: a.id, pool: 'monthly', when: cond(a.when) })),
      );
    else if (p.endsWith('origins.yaml')) pkg.origins!.list.push(...data.map(origin));
    else if (p.endsWith('epilogue.yaml'))
      pkg.epilogue!.paragraphs.push(
        ...data.map(
          (x: any): EpilogueParagraph => ({
            id: x.id,
            when: cond(x.when),
            order: x.order,
            lines: x.lines.map((l: any) => ({ when: cond(l.when), text: text(l.text)! })),
          }),
        ),
      );
    else if (p.endsWith('endings.yaml'))
      for (const [id, t] of Object.entries(data))
        pkg.endings.push({
          id,
          title: id,
          text: text(t as string),
          kind: ['사망', '노환', '청소', '금기'].includes(id) ? 'death' : 'neutral',
        });
  }
  pkg.actions.push(YEAR_ACTION);
  return JSON.parse(JSON.stringify(pkg)); // undefined 필드 정리
}
