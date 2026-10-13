// 패키지 정적 검증: 수식 문법, 없는 참조(변수·이벤트·아이템·엔딩 …), 도달 불가 이벤트.
// 에디터는 path로 해당 위치로 이동한다.

import { PURE_FUNCTIONS } from './expr/eval';
import { NAME_STYLE_IDS } from './names';
import { type Node, collectRefs, parseExpr } from './expr/parser';
import { poolOf } from './scheduler';
import { templateExprs, templateImages } from './text';
import { type ChoiceDef, type Command, MAX_CHOICES, type NumOrExpr, type Outcome, type StoryPackage } from './types';
import { STATE_FUNCTIONS, SYSTEM_VALUES } from './world';

export interface Issue {
  level: 'error' | 'warning';
  /** 예: "events/child.first_night/choices/1" */
  path: string;
  message: string;
}

/** 첫 인자가 특정 종류의 ID여야 하는 함수 */
const ID_ARG: Record<string, 'item' | 'status' | 'event' | 'table' | 'group' | 'var' | 'achievement' | 'ending'> = {
  item: 'item',
  status: 'status',
  statusLeft: 'status',
  seen: 'event',
  seenAgo: 'event',
  lookup: 'table',
  top: 'group',
  bottom: 'group',
  sum: 'group',
  var: 'var',
  base: 'var',
  minOf: 'var',
  maxOf: 'var',
  achieved: 'achievement',
  endingSeen: 'ending',
};

const KNOWN_FUNCTIONS = new Set([...PURE_FUNCTIONS, ...STATE_FUNCTIONS]);

export function validatePackage(pkg: StoryPackage): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message });

  const ids = <T extends { id: string }>(list: T[] | undefined, kind: string, base: string) => {
    const set = new Set<string>();
    (list ?? []).forEach((x, i) => {
      if (!x.id) err(`${base}/${i}`, `${kind} ID가 비어 있습니다`);
      else if (set.has(x.id)) err(`${base}/${x.id}`, `중복된 ${kind} ID '${x.id}'`);
      set.add(x.id);
    });
    return set;
  };

  const vars = ids(pkg.variables, '변수', 'variables');
  const items = ids(pkg.items, '아이템', 'items');
  const statuses = ids(pkg.statuses, '상태', 'statuses');
  const events = ids(pkg.events, '이벤트', 'events');
  ids(pkg.actions, '행동', 'actions');
  const scripts = ids(pkg.scripts, '스크립트', 'scripts');
  const tables = ids(pkg.tables, '표', 'tables');
  const endings = ids(pkg.endings, '엔딩', 'endings');
  const achievements = ids(pkg.achievements, '도전과제', 'achievements');
  const assets = ids(pkg.assets, '에셋', 'assets');
  const stages = ids(pkg.settings.stages, '단계', 'settings/stages');
  ids(pkg.triggers, '트리거', 'triggers');
  ids(pkg.origins?.list, '출신', 'origins');
  const groups = new Set(pkg.variables.map((v) => v.group).filter((g): g is string => !!g));
  const computed = new Set(pkg.variables.filter((v) => v.formula).map((v) => v.id));
  const tableColumns = new Map((pkg.tables ?? []).map((t) => [t.id, new Set(t.columns)]));

  // 지역 이름: 스크립트 매개변수와 let으로 만든 이름 전부(느슨하게 허용)
  const locals = new Set<string>(SYSTEM_VALUES);
  for (const s of pkg.scripts ?? []) for (const p of s.params ?? []) locals.add(p);
  const collectLets = (cmds: Command[] | undefined) => {
    for (const c of cmds ?? []) {
      if (c.do === 'let') locals.add(c.name);
      if (c.do === 'if') (collectLets(c.then), collectLets(c.else));
      if (c.do === 'random') c.branches.forEach((b) => collectLets(b.then));
      if (c.do === 'check') (collectLets(c.success), collectLets(c.failure));
    }
  };
  walkAllCommands(pkg, collectLets);

  const sets: Record<string, Set<string>> = {
    item: items,
    status: statuses,
    event: events,
    table: tables,
    group: groups,
    var: vars,
    achievement: achievements,
    ending: endings,
  };
  const kindName: Record<string, string> = {
    item: '아이템',
    status: '상태',
    event: '이벤트',
    table: '표',
    group: '변수 그룹',
    var: '변수',
    achievement: '도전과제',
    ending: '엔딩',
  };

  const checkNode = (node: Node, path: string) => {
    const refs = collectRefs(node);
    for (const v of refs.vars) if (!vars.has(v)) err(path, `선언되지 않은 변수 '${v}'`);
    for (const s of refs.sys) if (!locals.has(s)) err(path, `알 수 없는 값 '$${s}'`);
    for (const call of refs.calls) {
      if (!KNOWN_FUNCTIONS.has(call.fn)) {
        err(path, `알 수 없는 함수 '${call.fn}()'`);
        continue;
      }
      const kind = ID_ARG[call.fn];
      const first = call.args[0];
      if (kind && first?.k === 'lit' && !sets[kind].has(String(first.v)))
        err(path, `${call.fn}(): 없는 ${kindName[kind]} '${first.v}'`);
      if (call.fn === 'lookup' && first?.k === 'lit' && call.args[2]?.k === 'lit') {
        const cols = tableColumns.get(String(first.v));
        if (cols && !cols.has(String(call.args[2].v))) err(path, `lookup(): 표 '${first.v}'에 열 '${call.args[2].v}'이 없습니다`);
      }
    }
  };

  const expr = (src: NumOrExpr | boolean | undefined, path: string) => {
    if (typeof src !== 'string') return;
    try {
      checkNode(parseExpr(src), path);
    } catch (e) {
      err(path, `수식 오류: ${(e as Error).message}`);
    }
  };

  /** images: 본문에서만 {image 이미지ID}를 쓸 수 있다(제목·선택지·알림·인생표 문구는 불가) */
  const text = (src: string | undefined, path: string, images = false) => {
    if (!src) return;
    try {
      for (const e of templateExprs(src)) checkNode(parseExpr(e), path);
      const ids = templateImages(src);
      if (ids.length && !images) err(path, '이미지({image …})는 본문 글에서만 넣을 수 있습니다 (제목·선택지·알림 등에서는 쓸 수 없음)');
      else for (const id of ids) if (!assets.has(id)) err(path, `없는 이미지 '${id}'`);
    } catch (e) {
      err(path, `본문 오류: ${(e as Error).message}`);
    }
  };

  const asset = (id: string | undefined, path: string) => {
    if (id && !assets.has(id)) err(path, `없는 에셋 '${id}'`);
  };

  const gotoTargets = new Set<string>();

  const commands = (cmds: Command[] | undefined, path: string) => {
    (cmds ?? []).forEach((c, i) => {
      const at = `${path}/${i}`;
      switch (c.do) {
        case 'set':
        case 'add':
          if (!vars.has(c.var)) err(at, `선언되지 않은 변수 '${c.var}'`);
          else if (computed.has(c.var)) err(at, `파생 변수 '${c.var}'에는 값을 넣을 수 없습니다`);
          expr(c.value, at);
          break;
        case 'let':
          expr(c.value, at);
          break;
        case 'tag':
          expr(c.value, at);
          expr(c.add, at);
          break;
        case 'untag':
          if (c.key === undefined && c.prefix === undefined) err(at, 'untag에는 key나 prefix가 필요합니다');
          break;
        case 'item':
          if (!items.has(c.id)) err(at, `없는 아이템 '${c.id}'`);
          expr(c.count, at);
          break;
        case 'status':
          if (!statuses.has(c.id)) err(at, `없는 상태 '${c.id}'`);
          break;
        case 'text':
          text(c.text, at, true);
          break;
        case 'note':
          text(c.text, at);
          break;
        case 'record':
          text(c.text, at);
          break;
        case 'image':
          asset(c.asset, at);
          break;
        case 'if':
          expr(c.cond, at);
          commands(c.then, `${at}/then`);
          commands(c.else, `${at}/else`);
          break;
        case 'random':
          c.branches.forEach((b, j) => {
            expr(b.weight, `${at}/branches/${j}`);
            commands(b.then, `${at}/branches/${j}`);
          });
          break;
        case 'check':
          check(c.check, at);
          commands(c.success, `${at}/success`);
          commands(c.failure, `${at}/failure`);
          break;
        case 'goto':
          if (!events.has(c.event)) err(at, `없는 이벤트 '${c.event}'로 이동`);
          gotoTargets.add(c.event);
          break;
        case 'call': {
          const script = scripts.has(c.script) ? pkg.scripts!.find((s) => s.id === c.script) : undefined;
          if (!script) err(at, `없는 스크립트 '${c.script}'`);
          for (const [k, v] of Object.entries(c.args ?? {})) {
            if (script && !(script.params ?? []).includes(k)) warn(at, `스크립트 '${c.script}'에 없는 매개변수 '${k}'`);
            expr(v, at);
          }
          break;
        }
        case 'end':
          if (!endings.has(c.ending)) err(at, `없는 엔딩 '${c.ending}'`);
          break;
        case 'advance':
          expr(c.amount, at);
          break;
        case 'endTurn':
          expr(c.times, at);
          break;
        case 'achieve':
          if (!achievements.has(c.id)) err(at, `없는 도전과제 '${c.id}'`);
          break;
      }
    });
  };

  const check = (c: ChoiceDef['check'], path: string) => {
    if (!c) return;
    expr(c.skill, path);
    expr(c.difficulty, path);
    expr(c.bonus, path);
    expr(c.chance, path);
  };

  const outcome = (o: Outcome | undefined, path: string) => {
    if (!o) return;
    text(o.text, path, true);
    asset(o.image, path);
    commands(o.do, `${path}/do`);
    if (o.goto) {
      if (!events.has(o.goto)) err(path, `없는 이벤트 '${o.goto}'로 이동`);
      gotoTargets.add(o.goto);
    }
    if (o.choices && o.choices.length > MAX_CHOICES) err(path, `선택지는 최대 ${MAX_CHOICES}개까지입니다 (지금 ${o.choices.length}개)`);
    o.choices?.forEach((c, i) => choice(c, `${path}/choices/${i}`));
  };

  const choice = (c: ChoiceDef, path: string) => {
    text(c.text, path);
    expr(c.requires, path);
    text(c.requiresText, path);
    if (c.hidden && !c.requires) warn(path, 'hidden은 requires가 있을 때만 의미가 있습니다');
    check(c.check, path);
    if (c.check && (!c.success || !c.failure)) warn(path, '판정(check)에는 성공·실패 결과가 모두 있는 것이 좋습니다');
    if (c.check && (c.outcome || c.results)) warn(path, '판정이 있으면 outcome/results는 무시됩니다');
    outcome(c.success, `${path}/success`);
    outcome(c.failure, `${path}/failure`);
    outcome(c.outcome, `${path}/outcome`);
    c.results?.forEach((r, i) => {
      expr(r.weight, `${path}/results/${i}`);
      outcome(r, `${path}/results/${i}`);
    });
  };

  // ── 설정
  const s = pkg.settings;
  if (!s.stages?.length) err('settings/stages', '단계(stage)가 최소 하나 필요합니다');
  if (s.start && !events.has(s.start)) err('settings/start', `없는 시작 이벤트 '${s.start}'`);
  if (s.start) gotoTargets.add(s.start);
  if (s.idleEnding && !endings.has(s.idleEnding.ending)) err('settings/idleEnding', `없는 엔딩 '${s.idleEnding.ending}'`);
  if (s.maxTurns && !endings.has(s.maxTurns.ending)) err('settings/maxTurns', `없는 엔딩 '${s.maxTurns.ending}'`);
  expr(s.check?.formula, 'settings/check/formula');
  if (s.mode === 'life' && s.calendar.unit === 'none') err('settings/calendar', '생애 모드에는 날짜 단위가 필요합니다');
  const usedPools = new Set<string>();
  const menuPools = new Set<string>();
  (s.stages ?? []).forEach((st) => {
    const at = `settings/stages/${st.id}`;
    expr(st.when, at);
    expr(st.turn?.length, at);
    st.phases.forEach((p, i) => {
      if (p.type === 'events') {
        p.pools.forEach((x) => usedPools.add(x));
        expr(p.chance, `${at}/phases/${i}`);
      } else if (p.type === 'menu') {
        menuPools.add(p.pool);
        text(p.text, `${at}/phases/${i}`, true);
      } else commands(p.do, `${at}/phases/${i}`);
    });
  });
  if (s.mode === 'life' && !(pkg.endings ?? []).some((e) => e.when) && !(pkg.triggers ?? []).length)
    warn('endings', '생애 모드인데 자동 종료 조건(엔딩 when 또는 트리거)이 없습니다. 게임이 끝나지 않을 수 있습니다');

  // ── 변수
  pkg.variables.forEach((v) => {
    const at = `variables/${v.id}`;
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(v.id)) err(at, `변수 ID '${v.id}'는 글자·숫자·_만 쓸 수 있고 숫자로 시작할 수 없습니다`);
    expr(v.min, at);
    expr(v.max, at);
    expr(v.formula, at);
    expr(v.initialExpr, at);
    if (v.formula && v.scope === 'meta') err(at, '파생 변수는 meta 범위일 수 없습니다');
  });

  // ── 표 · 아이템 · 상태
  (pkg.tables ?? []).forEach((t) => {
    if (t.match === 'range') {
      const keys = t.rows.map((r) => Number(r.key));
      if (keys.some((k, i) => i > 0 && k < keys[i - 1])) err(`tables/${t.id}`, '범위 표의 키는 오름차순이어야 합니다');
    }
  });
  (pkg.items ?? []).forEach((it) => {
    const at = `items/${it.id}`;
    for (const [k, v] of Object.entries(it.modifiers ?? {})) {
      if (!vars.has(k)) err(at, `보정 대상 변수 '${k}'가 없습니다`);
      expr(v, at);
    }
    commands(it.onGain, `${at}/onGain`);
    commands(it.onLose, `${at}/onLose`);
    commands(it.onTurnEnd, `${at}/onTurnEnd`);
    if (it.use) {
      expr(it.use.when, `${at}/use`);
      text(it.use.text, `${at}/use`, true);
      commands(it.use.do, `${at}/use/do`);
    }
  });
  (pkg.statuses ?? []).forEach((st) => {
    const at = `statuses/${st.id}`;
    for (const [k, v] of Object.entries(st.modifiers ?? {})) {
      if (!vars.has(k)) err(at, `보정 대상 변수 '${k}'가 없습니다`);
      expr(v, at);
    }
    commands(st.onApply, `${at}/onApply`);
    commands(st.onTurnEnd, `${at}/onTurnEnd`);
    commands(st.onTick, `${at}/onTick`);
    commands(st.onExpire, `${at}/onExpire`);
  });

  // ── 출신
  // 직접 고르는 출신은 한 번에 보이는 후보(후보 수 설정, 없으면 전부)가 5개까지
  if (pkg.origins?.mode === 'choose' && Math.min(pkg.origins.offer ?? Infinity, pkg.origins.list.length) > MAX_CHOICES)
    err('origins', `플레이어가 고르는 출신 후보는 최대 ${MAX_CHOICES}개까지입니다. '후보 수'를 ${MAX_CHOICES} 이하로 하거나 무작위 배정으로 바꿔 주세요`);
  const knownStyle = (id: string | undefined, at: string) => {
    if (id && !NAME_STYLE_IDS.includes(id as never)) err(at, `없는 이름 주머니 '${id}'`);
  };
  knownStyle(pkg.settings.player?.nameStyle, 'settings/player');
  pkg.origins?.list.forEach((o) => {
    const at = `origins/${o.id}`;
    knownStyle(o.nameStyle, at);
    text(o.title, at);
    text(o.summary, at);
    text(o.text, at, true);
    expr(o.weight, at);
    expr(o.unlock, at);
    asset(o.image, at);
    commands(o.do, `${at}/do`);
  });
  text(pkg.origins?.text, 'origins', true);

  // ── 스크립트 · 트리거
  (pkg.scripts ?? []).forEach((sc) => commands(sc.do, `scripts/${sc.id}`));
  (pkg.triggers ?? []).forEach((t) => {
    expr(t.when, `triggers/${t.id}`);
    if (t.on === 'watch' && !t.when) err(`triggers/${t.id}`, '감시(watch) 트리거에는 조건이 필요합니다');
    commands(t.do, `triggers/${t.id}/do`);
  });

  // ── 이벤트 · 행동
  pkg.events.forEach((e) => {
    const at = `events/${e.id}`;
    text(e.title, at);
    if (!e.text?.trim()) warn(at, '본문이 비어 있습니다');
    text(e.text, at, true);
    expr(e.when, at);
    expr(e.weight, at);
    asset(e.image, at);
    if (e.stages) for (const st of e.stages) if (!stages.has(st)) err(at, `없는 단계 '${st}'`);
    if (e.record) text(typeof e.record === 'string' ? e.record : e.record.text, at);
    if (e.choices.length > MAX_CHOICES) err(at, `선택지는 최대 ${MAX_CHOICES}개까지입니다 (지금 ${e.choices.length}개)`);
    e.choices.forEach((c, i) => choice(c, `${at}/choices/${i}`));
  });
  (pkg.actions ?? []).forEach((a) => {
    const at = `actions/${a.id}`;
    expr(a.when, at);
    choice(a, at);
    if (!menuPools.has(a.pool)) warn(at, `메뉴 풀 '${a.pool}'을 쓰는 단계가 없어 이 행동은 나오지 않습니다`);
  });

  // ── 엔딩 · 결산 · 도전과제
  pkg.endings.forEach((e) => {
    text(e.title, `endings/${e.id}`);
    text(e.text, `endings/${e.id}`, true);
    expr(e.when, `endings/${e.id}`);
    asset(e.image, `endings/${e.id}`);
  });
  if (pkg.epilogue) {
    text(pkg.epilogue.header, 'epilogue/header');
    text(pkg.epilogue.footer, 'epilogue/footer');
    pkg.epilogue.paragraphs.forEach((p) => {
      expr(p.when, `epilogue/${p.id}`);
      p.lines.forEach((l, i) => {
        expr(l.when, `epilogue/${p.id}/${i}`);
        text(l.text, `epilogue/${p.id}/${i}`, true);
      });
    });
  }
  (pkg.achievements ?? []).forEach((a) => expr(a.when, `achievements/${a.id}`));

  // ── 도달 가능성
  for (const e of pkg.events) {
    const pool = poolOf(e);
    if ((pool !== undefined && usedPools.has(pool)) || gotoTargets.has(e.id)) continue;
    warn(
      `events/${e.id}`,
      pool === undefined
        ? '풀에 속하지 않았고 이 이벤트로 이동하는 곳도 없어 등장하지 않습니다'
        : `풀 '${pool}'을 뽑는 단계가 없고 이 이벤트로 이동하는 곳도 없어 등장하지 않습니다`,
    );
  }
  for (const e of pkg.events) {
    const pool = poolOf(e);
    if (!e.fixed && pool !== undefined && usedPools.has(pool) && !gotoTargets.has(e.id) && e.weight === 0)
      warn(`events/${e.id}`, '가중치가 0이고 이동해 오는 곳도 없어 등장하지 않습니다');
  }

  return issues;
}

/** 패키지의 모든 명령 목록을 순회 */
function walkAllCommands(pkg: StoryPackage, fn: (cmds: Command[] | undefined) => void): void {
  const outcome = (o?: Outcome) => {
    fn(o?.do);
    o?.choices?.forEach(choice);
  };
  const choice = (c: ChoiceDef): void => {
    outcome(c.success);
    outcome(c.failure);
    outcome(c.outcome);
    c.results?.forEach(outcome);
  };
  pkg.events.forEach((e) => e.choices.forEach(choice));
  (pkg.actions ?? []).forEach(choice);
  (pkg.scripts ?? []).forEach((s) => fn(s.do));
  (pkg.triggers ?? []).forEach((t) => fn(t.do));
  pkg.origins?.list.forEach((o) => fn(o.do));
  (pkg.items ?? []).forEach((i) => [i.use?.do, i.onGain, i.onLose, i.onTurnEnd].forEach(fn));
  (pkg.statuses ?? []).forEach((s) => [s.onApply, s.onTurnEnd, s.onTick, s.onExpire].forEach(fn));
  pkg.settings.stages.forEach((st) => st.phases.forEach((p) => p.type === 'script' && fn(p.do)));
}
