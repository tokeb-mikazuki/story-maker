// 시작 가이드: 화면을 하나씩 짚어 가며 "지금 여기서 무엇을 하면 되는지"를 말로 알려 주는 안내.
// 짚은 곳만 밝게 보이고 나머지는 어두워지지만, 짚은 칸은 그대로 눌러 보고 글을 쓸 수 있다.
// 끝내거나 건너뛰면 화면 위쪽에 팁이 하나씩 무작위로 나온다.

import type { StoryPackage } from '@engine';
import { useEffect, useRef, useState } from 'react';
import { prefs } from '../lib/storage';

interface Target {
  /** 짚을 칸을 찾는 선택자 */
  sel: string;
  /** 같은 선택자가 여럿이면 글자가 이것과 맞는 첫 칸 */
  text?: RegExp;
}

interface Step {
  id: string;
  title: string;
  body: string;
  /** 이 단계에서 열어 둘 화면 */
  section?: string;
  /** 여럿이면 앞에서부터 찾아 처음 보이는 칸을 짚는다 */
  target?: Target | Target[];
  /** 직접 해 보라고 할 일을 했는지. 맞으면 "잘하셨어요"가 뜬다 */
  done?: (pkg: StoryPackage, errors: number) => boolean;
  /** 해 볼 일 한 줄 */
  todo?: string;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: '이야기 만들기, 같이 해 볼까요?',
    body: "여기는 글로 읽는 선택형 이야기를 만드는 곳이에요. 어려운 설정은 모두 나중에 해도 돼요. 먼저 '이벤트 쓰기 → 선택지 달기 → 끝내기' 순서로 하나씩 같이 해 볼게요. 건너뛰어도 되고, 위쪽 '가이드' 버튼으로 언제든 다시 볼 수 있어요.",
  },
  {
    id: 'menu',
    title: '왼쪽은 메뉴예요',
    body: "이야기는 '이벤트'(장면 하나하나)를 이어 붙여 만들어요. 오늘은 기본 정보, 이벤트, 엔딩 정도만 쓸 거예요. 변수나 인벤토리(아이템·상태) 같은 다른 메뉴는 필요해질 때 열어 보세요. 맨 아래 '간단히 / 자세히'로 숨은 메뉴를 펼칠 수도 있어요. 모르는 말은 작업대의 '도움말'에서 찾아볼 수 있어요.",
    target: { sel: '.sidenav' },
  },
  {
    id: 'meta',
    title: '작품 이름을 지어 볼까요?',
    body: "제목을 쓰고, 아래 '소개'에 어떤 이야기인지 한두 줄로 적어 주세요. 읽는 사람이 가장 먼저 보는 글이에요.",
    section: 'meta',
    target: { sel: '.workspace label.field' },
    done: (p) => !!p.meta.title.trim() && !!p.meta.description?.trim(),
    todo: '제목과 소개를 적어 보세요.',
  },
  {
    id: 'scenes',
    title: '이벤트는 이야기의 한 토막이에요',
    body: "왼쪽 목록이 지금까지 만든 이벤트(장면)예요. '＋ 이벤트' 버튼으로 새로 만들 수 있어요. 처음엔 하나로도 충분해요.",
    section: 'events',
    target: { sel: '.collection-list' },
  },
  {
    id: 'text',
    title: '이벤트의 글을 써 보세요',
    body: "읽는 사람에게 보여 줄 글이에요. 길게 쓰지 않아도 괜찮아요. 글에만 집중하고 싶으면 위쪽의 '집필 모드'를 눌러 보세요. 글 중간에 값을 넣고 싶으면 {를 치고 글자를 써 보세요. 쓸 수 있는 말이 자동 완성으로 떠요.",
    section: 'events',
    target: { sel: '.event-editor textarea' },
    done: (p) => p.events.some((e) => e.text.trim()),
    todo: '본문 칸에 글을 써 보세요.',
  },
  {
    id: 'choices',
    title: '고를 수 있는 버튼을 달아 볼까요?',
    body: "글을 읽고 나서 누르는 버튼이에요. 두 개 이상 만들면 이야기가 갈라져요. 한 장면에 최대 5개까지 둘 수 있어요.",
    section: 'events',
    target: { sel: '.event-editor button', text: /선택지/ },
    done: (p) => p.events.some((e) => e.choices.filter((c) => c.text.trim()).length >= 2),
    todo: "'＋ 선택지'를 눌러 버튼 문구를 두 개 적어 보세요.",
  },
  {
    id: 'next',
    title: '고르면 어디로 갈까요?',
    body: "선택지 카드를 펼치면, 고른 뒤 보여 줄 글과 '그다음엔'이 있어요. 거기서 이어질 이벤트를 고르면 이야기가 갈라져요. 비워 두면 평소처럼 다음으로 흘러가요. 아직 선택지가 없다면 앞 단계에서 먼저 하나 만들어 보세요.",
    section: 'events',
    target: [{ sel: '.event-editor .choice-card' }, { sel: '.event-editor button', text: /선택지/ }],
  },
  {
    id: 'inventory',
    title: '아이템과 상태는 인벤토리에서',
    body: "열쇠 같은 소지품, 부상 같은 상태를 이곳에 한꺼번에 만들어요. '＋ 요소'를 누른 뒤 설정 맨 위의 '종류'에서 아이템·상태·기타를 고르고, 가지고 있는 동안 어떤 효과가 생길지도 정해요. 플레이 화면에서는 인벤토리 창 안에서 '아이템'과 '상태'가 쪽으로 나뉘어 보여요. 지금은 건너뛰어도 괜찮아요.",
    section: 'inventory',
    target: { sel: '.collection-list' },
  },
  {
    id: 'map',
    title: '흐름도로 한눈에 보기',
    body: '이벤트들이 어떻게 이어지는지 지도처럼 볼 수 있어요. 카드를 누르면 그 이벤트를 고칠 수 있어요.',
    section: 'flow',
    target: { sel: '.flow-canvas' },
  },
  {
    id: 'start',
    title: '어느 이벤트에서 시작할까요?',
    body: "'진행 방식'에서 처음 보여 줄 이벤트(시작 이벤트)를 고를 수 있어요. 시간이 흐르는 인생 이야기라면 이벤트가 알아서 뽑히니, 그대로 두어도 돼요.",
    section: 'settings',
    target: { sel: '.workspace label.field', text: /시작/ },
  },
  {
    id: 'ending',
    title: '이야기는 엔딩으로 끝나요',
    body: "엔딩이 하나도 없으면 이야기가 끝나지 않아요. '＋ 엔딩'으로 만들어 두세요. 언제 끝나는지는 나중에 정해도 돼요.",
    section: 'endings',
    target: { sel: '.collection-tools button' },
    done: (p) => p.endings.some((e) => e.title?.trim()),
    todo: '엔딩 이름을 하나 적어 보세요.',
  },
  {
    id: 'check',
    title: '실수는 없는지 검사해 봐요',
    body: '끊어진 연결이나 이름 오타 같은 실수를 찾아 줘요. 왼쪽 「검사·시뮬레이션」 옆에 ✓가 보이면 괜찮아요.',
    target: { sel: '.sidenav a', text: /검사/ },
    done: (p, errors) => p.events.length > 0 && errors === 0,
  },
  {
    id: 'test',
    title: '직접 해 보세요',
    body: '▶ 테스트 플레이를 누르면 읽는 사람처럼 처음부터 해 볼 수 있어요. 키보드 F5로도 열려요. 이상하면 그 자리에서 바로 고치면 돼요.',
    target: { sel: '.topbar .btn.primary' },
  },
  {
    id: 'finish',
    title: '여기까지 오셨어요!',
    body: "만든 내용은 자동으로 저장돼요. 작업대의 '내보내기'에서 창작마당에 올리거나 파일로 간직할 수 있어요. 모르는 말은 '도움말'에서 찾아보세요. 막히면 '가이드'를 다시 눌러 보세요. 화면 위쪽에는 가끔 도움이 되는 팁도 떠요.",
    target: { sel: '.sidenav a', text: /내보내기/ },
  },
];

function findOne(t: Target): HTMLElement | null {
  const list = [...document.querySelectorAll<HTMLElement>(t.sel)];
  const hit = t.text ? list.find((e) => t.text!.test(e.textContent ?? '')) : list[0];
  return hit && hit.getClientRects().length ? hit : null;
}

function find(t?: Target | Target[]): HTMLElement | null {
  if (!t) return null;
  for (const one of Array.isArray(t) ? t : [t]) {
    const el = findOne(one);
    if (el) return el;
  }
  return null;
}

type Box = { left: number; top: number; width: number; height: number };
const sameBox = (a: Box | null, b: Box | null) => (!a || !b ? a === b : a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

/** 처음 열린 프로젝트인지(가이드를 자동으로 펼칠지) */
export function shouldAutoOpenGuide(projectId: string): boolean {
  return !prefs.get(`guide:seen:${projectId}`);
}

/** 가이드를 끝내거나 건너뛴 작품은 다음에 열 때 자동으로 펼치지 않는다 */
export function markGuideSeen(projectId: string): void {
  prefs.set(`guide:seen:${projectId}`, '1');
}

export function Guide({
  pkg,
  errors,
  onGo,
  onClose,
}: {
  pkg: StoryPackage;
  errors: number;
  onGo: (section: string, item?: string) => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = STEPS[at];
  const last = at === STEPS.length - 1;
  const scrolled = useRef<string>('');

  // 단계가 바뀌면 그 화면을 열어 둔다
  useEffect(() => {
    if (step.section) onGo(step.section);
    scrolled.current = '';
  }, [step.id]);

  // 짚을 칸의 위치를 따라간다(화면이 그려지는 중이거나 크기가 바뀌어도 맞도록 짧게 확인)
  useEffect(() => {
    const tick = () => {
      const el = find(step.target);
      if (el && scrolled.current !== step.id) {
        scrolled.current = step.id;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      const r = el?.getBoundingClientRect();
      const next = r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [step.id]);

  const go = (d: number) => setAt((i) => Math.min(STEPS.length - 1, Math.max(0, i + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (inField) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isDone = step.done?.(pkg, errors) ?? false;

  // 카드는 짚은 칸 가까이: 위쪽에 있으면 아래에, 아래쪽에 있으면 위에, 왼쪽 좁은 메뉴면 오른쪽에
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const CARD = 360;
  let pos: React.CSSProperties = { left: Math.round((vw - CARD) / 2), top: Math.round(vh * 0.28) };
  if (box) {
    const tall = box.height > vh * 0.55;
    if (box.width < 260 && box.left < 120) pos = { left: box.left + box.width + 16, top: Math.max(70, Math.min(box.top + 24, vh - 340)) };
    else if (tall) pos = { right: 20, bottom: 20 };
    else {
      const left = Math.min(Math.max(16, box.left), vw - CARD - 16);
      pos = box.top + box.height / 2 < vh * 0.5 ? { left, top: box.top + box.height + 16 } : { left, bottom: vh - box.top + 16 };
    }
  }

  const hole = box ? { left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 } : { left: 0, top: 0, width: 0, height: 0 };

  return (
    <>
      {box ? (
        <>
          <div className="tour-hole" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />
          {/* 짚은 칸 말고는 눌리지 않게 네 방향을 막는다 */}
          <div className="tour-block" style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.top) }} />
          <div className="tour-block" style={{ left: 0, top: hole.top + hole.height, width: vw, height: Math.max(0, vh - hole.top - hole.height) }} />
          <div className="tour-block" style={{ left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height }} />
          <div className="tour-block" style={{ left: hole.left + hole.width, top: hole.top, width: Math.max(0, vw - hole.left - hole.width), height: hole.height }} />
        </>
      ) : (
        <div className="tour-dim" />
      )}
      <aside className="tour-card" style={{ ...pos, width: CARD }} role="dialog" aria-label="시작 가이드">
        <div className="tour-top">
          <span className="tour-step">
            {at + 1} / {STEPS.length}
          </span>
          <button type="button" className="link small" onClick={onClose}>
            건너뛰기
          </button>
        </div>
        <h4 className="tour-title">{step.title}</h4>
        <p className="tour-body">{step.body}</p>
        {step.todo && (
          <p className={`tour-todo ${isDone ? 'done' : ''}`}>{isDone ? '✓ 잘하셨어요! 다음으로 넘어가 볼까요?' : `직접 해 보기 · ${step.todo}`}</p>
        )}
        <div className="tour-dots" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.id} className={i === at ? 'on' : i < at ? 'past' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="btn small" disabled={at === 0} onClick={() => go(-1)}>
            이전
          </button>
          <button type="button" className="btn small primary" onClick={() => (last ? onClose() : go(1))}>
            {last ? '마치기' : at === 0 ? '시작하기' : '다음'}
          </button>
        </div>
      </aside>
    </>
  );
}

/** 가이드가 끝났거나 건너뛴 뒤에 위쪽에 하나씩 무작위로 띄우는 짧은 팁 */
const TIPS: string[] = [
  'F5를 누르면 지금 작품을 바로 테스트 플레이할 수 있어요.',
  "이벤트 화면의 '여기부터 테스트'를 누르면 그 이벤트부터 시작해 볼 수 있어요.",
  'Ctrl+Z로 되돌리고 Ctrl+Shift+Z로 다시 해요. 저장은 자동입니다.',
  "이벤트에 ID(이름표)를 붙여 두면 목록과 '그다음엔' 선택에서 제목보다 먼저 보여요. ID는 읽는 사람에게 보이지 않아요.",
  "'그다음엔'에서 '다른 이벤트…'를 고르면 ID·제목·본문으로 이벤트를 검색할 수 있어요.",
  "이벤트 목록의 '묶어 보기'를 '이어짐 (트리)'로 두면 어느 선택지에서 이어지는 이벤트인지 한눈에 보여요.",
  "'집필 모드'를 쓰면 다른 메뉴를 가리고 글에만 집중할 수 있어요.",
  '선택지는 한 화면에 최대 5개까지예요. 더 필요하면 선택 뒤에 이어지는 선택지를 써 보세요.',
  '출신은 무작위 배정이 기본이에요. 직접 고르게 하면 후보는 최대 5개까지예요.',
  "주인공 이름은 '이름 주머니'에서 알아서 뽑게 할 수 있어요. 출신마다 다른 주머니도 쓸 수 있어요.",
  "왼쪽 아래 '자세히'로 바꾸면 숨은 메뉴와 세부 설정이 모두 펼쳐져요.",
  '흐름도에서 카드에 마우스를 올리면 그 이벤트의 연결선이 또렷해져요.',
  "본문에 {를 치고 글자나 숫자를 입력하면 쓸 수 있는 문법·함수·변수·아이템이 자동 완성으로 떠요. Tab이나 Enter로 넣어요.",
  "{if 조건}…{/if}로 상황에 따라 글을 바꿀 수 있어요. 쓰는 법은 도움말의 '중괄호 { } 문법'에 모여 있어요.",
  "인벤토리에서 아이템·상태·기타를 한 목록으로 관리해요. 각 요소에 가지고 있는 동안의 효과(변수 보정, 매 턴 끝 효과)를 줄 수 있어요.",
  "진행 방식 맨 아래 '플레이 화면 용어'에서 인벤토리·아이템·상태 같은 이름을 작품 분위기에 맞게 바꿀 수 있어요.",
  "내보내기는 왼쪽 메뉴 작업대에 있어요. 창작마당 올리기 전에 빠진 것도 점검해 줘요.",
  "검사·시뮬레이션 옆의 ✓는 검사를 통과했다는 표시예요. 오류가 있으면 빨간 숫자로 바뀌어요.",
  "인생표에 남길 사건은 이벤트 세부 설정의 '인생표에 기록'에 적어요.",
  '검사·시뮬레이션에서 한 번도 나오지 않은 이벤트를 찾을 수 있어요.',
  "'가이드' 버튼으로 시작 가이드를 언제든 다시 볼 수 있어요.",
];

/** 팁은 시간이 지나면 저절로 다음 팁으로 넘어간다(마우스를 올려 두면 멈춘다) */
const TIP_SECONDS = 9;

export function TipBar({ onGuide }: { onGuide: () => void }) {
  const [at, setAt] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (hidden || paused) return;
    const t = setTimeout(() => setAt((i) => (i + 1 + Math.floor(Math.random() * (TIPS.length - 1))) % TIPS.length), TIP_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [at, hidden, paused]);
  if (hidden) return null;
  return (
    <div className="tipbar" role="note" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="tipbar-label">TIP</span>
      <span key={at} className="tipbar-text tip-fade">
        {TIPS[at]}
      </span>      <button type="button" className="link small" onClick={onGuide}>
        가이드
      </button>
      <button type="button" className="icon" title="이번엔 그만 보기" onClick={() => setHidden(true)}>
        ✕
      </button>
    </div>
  );
}

