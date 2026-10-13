// 본문 자동 완성. { } 안에서 글자·숫자를 치면 VS Code처럼 쓸 수 있는 말(문법·함수·변수·값)을 후보로 띄운다.
// ↑↓ 고르기, Tab/Enter 넣기, Esc 닫기.

import { SYSTEM_VALUES, type StoryPackage } from '@engine';
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor } from './context';

interface Item {
  /** 후보 목록에 보이는 이름 */
  label: string;
  /** 글자 비교용 이름 */
  key: string;
  /** 넣을 글. | 는 넣은 뒤 커서가 놓일 자리 */
  snippet: string;
  detail: string;
  kind: '문법' | '조사' | '함수' | '변수' | '값' | '이름' | '아이템' | '이미지';
  /** 이름 말고 다르게 불러도 후보에 걸리게 하는 이름(아이템의 고유 이름 등) */
  alt?: string;
  /** 커서 뒤에 흐리게 보여 줄 나머지 글자 */
  ghost?: string;
}

const kw = (key: string, snippet: string, detail: string): Item => ({ label: key, key, snippet, detail, kind: '문법' });

/** { } 바로 뒤에서만 나오는 말 */
const TAG_START: Item[] = [
  kw('if', 'if |}{/if}', '{if 조건}…{/if} 조건이 맞을 때만 보이는 문장'),
  kw('elif', 'elif |}', '{elif 조건} 앞 조건이 아니고 이 조건이 맞을 때'),
  kw('else', 'else}', '{else} 위 조건이 모두 아닐 때'),
  kw('/if', '/if}', '{/if} 조건 문장 끝'),
  kw('one', 'one}|{or}{/one}', '{one}A{or}B{/one} 여럿 중 무작위 하나'),
  kw('or', 'or}', '{or} 무작위 문장의 다음 후보'),
  kw('/one', '/one}', '{/one} 무작위 문장 끝'),
  kw('image', 'image |}', '{image 이미지ID} 글 사이에 이미지 넣기 (본문에서만)'),
  ...(['이/가', '을/를', '은/는', '과/와', '으로/로', '아/야', '이랑/랑', '이나/나', '이에요/예요', '이라/라', '이여/여', '이다/다', '이었/였', '으로서/로서', '으로써/로써'] as const).map(
    (j): Item => ({ label: `{${j}}`, key: j, snippet: `${j}}`, detail: '앞말 받침에 맞는 조사', kind: '조사' }),
  ),
];

const fn = (name: string, snippet: string, detail: string): Item => ({ label: `${name}()`, key: name, snippet, detail, kind: '함수' });

const FUNCS: Item[] = [
  fn('fmt', 'fmt(|)', '천 단위 쉼표 (12000 → 12,000)'),
  fn('signed', 'signed(|)', '부호 붙이기 (5 → +5)'),
  fn('has', "has('|')", '태그가 붙어 있으면 참. has(\'직업\', \'어부\')처럼 값도 비교'),
  fn('tag', "tag('|')", '태그에 담긴 값(없으면 0)'),
  fn('count', "count('|')", '이 글자로 시작하는 태그 개수'),
  fn('item', "item('|')", '아이템 개수'),
  fn('status', "status('|')", '상태가 걸린 겹 수'),
  fn('statusLeft', "statusLeft('|')", '상태가 남은 턴 수'),
  fn('seen', "seen('|')", '그 이벤트를 겪었으면 참'),
  fn('seenAgo', "seenAgo('|')", '그 이벤트를 몇 턴 전에 겪었는지(없으면 -1)'),
  fn('achieved', "achieved('|')", '도전과제를 달성했으면 참'),
  fn('endingSeen', "endingSeen('|')", '그 엔딩을 본 횟수'),
  fn('chance', 'chance(|)', '지정한 % 확률로 참'),
  fn('randint', 'randint(|, )', '두 수 사이의 무작위 정수'),
  fn('rand', 'rand()', '0~1 사이 무작위 수'),
  fn('pick', "pick('|')", '나열한 것 중 무작위 하나'),
  fn('lookup', "lookup('|', 키, '열')", '표에서 값 찾기'),
  fn('top', "top('|')", '그룹에서 가장 높은 변수 이름'),
  fn('bottom', "bottom('|')", '그룹에서 가장 낮은 변수 이름'),
  fn('sum', "sum('|')", '그룹 변수 값의 합'),
  fn('var', "var('|')", '이름으로 변수 값 읽기'),
  fn('base', "base('|')", '보정을 뺀 변수의 원래 값'),
  fn('minOf', "minOf('|')", '변수의 최솟값 설정'),
  fn('maxOf', "maxOf('|')", '변수의 최댓값 설정'),
  fn('name', "name('|')", '항목의 화면 이름'),
  fn('date', "date('|')", '날짜 글을 시각 숫자로'),
  fn('min', 'min(|, )', '작은 쪽'),
  fn('max', 'max(|, )', '큰 쪽'),
  fn('clamp', 'clamp(|, 최소, 최대)', '범위 안으로 맞춤'),
  fn('round', 'round(|)', '반올림'),
  fn('floor', 'floor(|)', '내림'),
  fn('ceil', 'ceil(|)', '올림'),
  fn('abs', 'abs(|)', '절댓값'),
  fn('pow', 'pow(|, )', '거듭제곱'),
  fn('sqrt', 'sqrt(|)', '제곱근'),
  fn('if', 'if(|, 참일 때, 아닐 때)', '조건에 따라 값 고르기'),
  fn('num', 'num(|)', '숫자로 바꾸기'),
  fn('str', 'str(|)', '글자로 바꾸기'),
  fn('len', 'len(|)', '글자 수'),
];

/** 따옴표 안 첫 칸에 이름을 채워 주는 함수 → 찾을 대상 */
const ID_ARGS: Record<string, 'items' | 'statuses' | 'events' | 'achievements' | 'endings' | 'tables' | 'groups' | 'vars'> = {
  item: 'items',
  status: 'statuses',
  statusLeft: 'statuses',
  seen: 'events',
  seenAgo: 'events',
  achieved: 'achievements',
  endingSeen: 'endings',
  lookup: 'tables',
  top: 'groups',
  bottom: 'groups',
  sum: 'groups',
  var: 'vars',
  base: 'vars',
  minOf: 'vars',
  maxOf: 'vars',
};

const SYS: Item[] = [...new Set(SYSTEM_VALUES)].map((s) => ({ label: `$${s}`, key: `$${s}`, snippet: `$${s}`, detail: '시스템 값', kind: '값' }));

function idList(pkg: StoryPackage, what: (typeof ID_ARGS)[string]): { id: string; detail: string }[] {
  switch (what) {
    case 'items':
      return (pkg.items ?? []).map((x) => ({ id: x.id, detail: x.name ?? '' }));
    case 'statuses':
      return (pkg.statuses ?? []).map((x) => ({ id: x.id, detail: x.name ?? '' }));
    case 'events':
      return pkg.events.map((x) => ({ id: x.id, detail: x.title ?? x.text.slice(0, 20) }));
    case 'achievements':
      return (pkg.achievements ?? []).map((x) => ({ id: x.id, detail: x.title }));
    case 'endings':
      return pkg.endings.map((x) => ({ id: x.id, detail: x.title ?? '' }));
    case 'tables':
      return (pkg.tables ?? []).map((x) => ({ id: x.id, detail: '표' }));
    case 'groups':
      return [...new Set(pkg.variables.map((v) => v.group).filter((g): g is string => !!g))].map((g) => ({ id: g, detail: '변수 그룹' }));
    case 'vars':
      return pkg.variables.map((v) => ({ id: v.id, detail: '변수' }));
  }
}

interface Hit {
  items: Item[];
  /** 바꿔 넣을 범위 */
  from: number;
  to: number;
  /** 닫는 따옴표가 없으면 붙인다 */
  quote?: string;
  tagStart: boolean;
  /** 이름을 넣은 뒤 태그를 닫는 }를 붙인다 */
  closeTag?: boolean;
}

/** 친 글자로 시작하는 이름이 있으면 그 나머지를 흐린 글자로 보여 줄 수 있게 적어 둔다 */
function withGhost(items: Item[], word: string): void {
  const w = word.toLowerCase();
  for (const it of items) {
    const src = [it.key, it.alt].find((s) => s && s.length > word.length && s.toLowerCase().startsWith(w));
    it.ghost = src?.slice(word.length);
  }
}

const WORD =/[\p{L}\p{N}_$/]+$/u;

/** 커서 위치에서 후보를 찾는다. { } 안이 아니면 null */
function findHits(text: string, caret: number, pkg: StoryPackage, images: boolean): Hit | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('{');
  if (open < 0 || before.indexOf('}', open) >= 0) return null;
  // {{ 는 글자 그대로의 중괄호
  if (before[open - 1] === '{' && before[open - 2] !== '{') return null;
  const inner = before.slice(open + 1);

  // {image 이미지ID}: 올려 둔 이미지 이름 채우기
  const im = images ? /^(?:image|이미지)\s+([^\s}]*)$/.exec(inner) : null;
  if (im) {
    const part = im[1];
    const lp = part.toLowerCase();
    const items = (pkg.assets ?? [])
      .filter((a) => a.id.toLowerCase().startsWith(lp) && a.id !== part)
      .slice(0, 8)
      .map((a): Item => ({ label: a.id, key: a.id, alt: a.alt || undefined, snippet: a.id, detail: a.alt ?? '이미지', kind: '이미지' }));
    withGhost(items, part);
    return items.length ? { items, from: caret - part.length, to: caret, tagStart: false, closeTag: true } : null;
  }

  // 따옴표 안: fn('… 의 이름 채우기
  const q = /([A-Za-z]+)\(\s*(['"])([^'"]*)$/.exec(inner);
  if (q) {
    const what = ID_ARGS[q[1]];
    if (!what) return null;
    const part = q[3];
    const lp = part.toLowerCase();
    const items = idList(pkg, what)
      .filter((x) => (x.id.toLowerCase().startsWith(lp) && x.id !== part) || (!!x.detail && x.detail.toLowerCase().startsWith(lp) && x.detail !== part))
      .slice(0, 8)
      .map((x): Item => ({ label: x.id, key: x.id, alt: x.detail || undefined, snippet: x.id, detail: x.detail, kind: '이름' }));
    withGhost(items, part);
    return items.length ? { items, from: caret - part.length, to: caret, quote: q[2], tagStart: false } : null;
  }
  if (((inner.match(/'/g) ?? []).length & 1) || ((inner.match(/"/g) ?? []).length & 1)) return null;

  const m = WORD.exec(inner);
  if (!m) return null;
  const word = m[0];
  const tagStart = inner.length === word.length;
  const w = word.toLowerCase();
  const pool: Item[] = [
    ...(tagStart ? TAG_START.filter((i) => images || i.key !== 'image') : []),
    ...(pkg.items ?? []).map((x): Item => ({ label: x.name || x.id, key: x.name || x.id, alt: x.id, snippet: `item('${x.id}')`, detail: `아이템 · item('${x.id}')`, kind: '아이템' })),
    ...pkg.variables.map((v): Item => ({ label: v.id, key: v.id, snippet: v.id, detail: v.name && v.name !== v.id ? `변수 · ${v.name}` : '변수', kind: '변수' })),
    ...(word.startsWith('$') ? SYS : []),
    ...FUNCS,
  ];
  const seen = new Set<string>();
  const items = pool
    .filter((it) => it.key.toLowerCase().startsWith(w) || !!it.alt?.toLowerCase().startsWith(w))
    .filter((it) => !(it.kind === '변수' && !tagStart && it.key === word))
    .filter((it) => {
      const id = `${it.kind}:${it.key}`;
      return seen.has(id) ? false : (seen.add(id), true);
    })
    .slice(0, 8);
  withGhost(items, word);
  return items.length ? { items, from: caret - word.length, to: caret, tagStart } : null;
}

/** textarea·input 안 글자 위치의 화면 좌표(문서가 아닌 뷰포트 기준) */
function caretPoint(el: HTMLTextAreaElement | HTMLInputElement, pos: number): { x: number; y: number; h: number } {
  const cs = getComputedStyle(el);
  const mirror = document.createElement('div');
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth', 'boxSizing', 'tabSize'] as const) {
    mirror.style[p] = cs[p];
  }
  const single = el instanceof HTMLInputElement;
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.width = `${el.clientWidth + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)}px`;
  mirror.style.whiteSpace = single ? 'pre' : 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.textContent = el.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '​';
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const left = mark.offsetLeft;
  const top = mark.offsetTop;
  const h = mark.offsetHeight || parseFloat(cs.lineHeight) || 20;
  mirror.remove();
  const r = el.getBoundingClientRect();
  return { x: r.left + left - el.scrollLeft, y: r.top + top - el.scrollTop, h };
}

export function useTemplateComplete(ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>, value: string, set: (v: string) => void, images = false) {
  const { pkg } = useEditor();
  const [hit, setHit] = useState<(Hit & { x: number; y: number; cy: number; h: number; font: string; free: boolean }) | null>(null);
  const [at, setAt] = useState(0);
  const pending = useRef<number | null>(null);

  // 넣은 뒤 커서를 | 자리로
  useLayoutEffect(() => {
    if (pending.current === null || !ref.current) return;
    const pos = pending.current;
    pending.current = null;
    ref.current.setSelectionRange(pos, pos);
  }, [value, ref]);

  // 스크롤하면 위치가 어긋나므로 닫는다
  useEffect(() => {
    if (!hit) return;
    const close = () => setHit(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [hit]);

  const refresh = (el: HTMLTextAreaElement | HTMLInputElement) => {
    const caret = el.selectionStart ?? 0;
    if (el.selectionEnd !== caret) return setHit(null);
    const found = findHits(el.value, caret, pkg, images);
    if (!found) return setHit(null);
    const p = caretPoint(el, caret);
    setAt(0);
    const cs = getComputedStyle(el);
    const next = el.value[caret];
    setHit({ ...found, x: p.x, y: p.y + p.h + 2, cy: p.y, h: p.h, font: cs.font, free: next === undefined || /[\s}')"]/.test(next) });
  };

  const accept = (it: Item) => {
    const el = ref.current;
    if (!el || !hit) return;
    let snippet = it.snippet;
    // 닫는 중괄호는 이미 있으면 겹치지 않게
    if (hit.tagStart && !snippet.includes('}')) snippet += '}';
    if (hit.tagStart && snippet.endsWith('}') && el.value[hit.to] === '}') snippet = snippet.slice(0, -1);
    if (hit.quote && el.value[hit.to] !== hit.quote) snippet += hit.quote;
    if (hit.closeTag && el.value[hit.to] !== '}') snippet += '}';
    const bar = snippet.indexOf('|');
    const ins = bar >= 0 ? snippet.slice(0, bar) + snippet.slice(bar + 1) : snippet;
    pending.current = hit.from + (bar >= 0 ? bar : ins.length);
    set(el.value.slice(0, hit.from) + ins + el.value.slice(hit.to));
    setHit(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!hit || e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') (e.preventDefault(), setAt((i) => (i + 1) % hit.items.length));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setAt((i) => (i - 1 + hit.items.length) % hit.items.length));
    else if (e.key === 'Enter' || e.key === 'Tab') (e.preventDefault(), accept(hit.items[at]));
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), setHit(null));
  };

  const ghost = hit?.free ? hit.items[at]?.ghost : undefined;
  const popup: ReactNode = hit && (
    <>
      {ghost && (
        <span className="tc-ghost" aria-hidden style={{ left: hit.x, top: hit.cy, font: hit.font, height: hit.h, lineHeight: `${hit.h}px` }}>
          {ghost}
        </span>
      )}
      <ul className="tc-popup" role="listbox" style={{ left: Math.min(hit.x, window.innerWidth - 330), top: Math.min(hit.y, window.innerHeight - 20 - hit.items.length * 28) }}>
      {hit.items.map((it, i) => (
        <li
          key={`${it.kind}:${it.key}`}
          role="option"
          aria-selected={i === at}
          className={i === at ? 'on' : ''}
          // 입력 칸이 포커스를 잃지 않도록
          onMouseDown={(e) => (e.preventDefault(), accept(it))}
          onMouseEnter={() => setAt(i)}
        >
          <span className={`tc-kind k-${it.kind}`}>{it.kind}</span>
          <span className="tc-label">{it.label}</span>
          <span className="tc-detail">{it.detail}</span>
        </li>
      ))}
      </ul>
    </>
  );

  return {
    popup,
    props: {
      onKeyDown,
      onKeyUp: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) refresh(e.currentTarget);
      },
      onClick: (e: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => refresh(e.currentTarget),
      onBlur: () => setHit(null),
    },
    /** 글이 바뀐 직후에 부른다 */
    refresh,
  };
}
