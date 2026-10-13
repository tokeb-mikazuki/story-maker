import type { StoryPackage } from '@engine';
import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { go } from '../lib/router';
import { prefs, projects } from '../lib/storage';
import { TestPlay } from '../player/TestPlay';
import { type EditorApi, EditorContext } from './context';
import { Guide, TipBar, markGuideSeen, shouldAutoOpenGuide } from './Guide';
import { AssetsSection, OriginsSection, TablesSection, VariablesSection } from './sections/Data';
import { InventorySection, entryId } from './sections/Inventory';
import { ActionsSection, EventsSection } from './sections/Events';
import { ExportSection } from './sections/Export';
import { FlowSection } from './sections/Flow';
import { MetaSection, SettingsSection, StagesSection } from './sections/General';
import { AchievementsSection, EndingsSection, ScriptsSection, TriggersSection } from './sections/Logic';
import { CheckSection, JsonSection, useIssues } from './sections/Tools';
import { HelpView } from './help';

/** [id, 이름, 자세히] — '자세히' 메뉴는 자세히 모드이거나 이미 쓰고 있을 때만 보인다 */
const NAV: { group: string; items: [string, string, boolean?][] }[] = [
  { group: '원고', items: [['flow', '흐름도'], ['events', '이벤트'], ['origins', '출신', true], ['actions', '행동', true]] },
  { group: '장치', items: [['variables', '변수'], ['inventory', '인벤토리'], ['triggers', '자동 규칙', true], ['scripts', '스크립트', true], ['tables', '표', true]] },
  { group: '결말', items: [['endings', '엔딩·결산'], ['achievements', '도전과제', true]] },
  { group: '작품', items: [['meta', '기본 정보'], ['settings', '진행 방식'], ['stages', '단계·턴', true], ['assets', '이미지']] },
  { group: '작업대', items: [['check', '검사·시뮬레이션'], ['export', '내보내기'], ['help', '도움말'], ['json', '원본 편집', true]] },
];

const HISTORY_LIMIT = 200;

export function Editor({ projectId, section = 'flow', item }: { projectId: string; section?: string; item?: string }) {
  const [pkg, setPkg] = useState<StoryPackage>();
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [testing, setTesting] = useState<{ start?: string; pkg: StoryPackage }>();
  const [detail, setDetail] = useState(() => prefs.get('detail') === 'on');
  const [guideOpen, setGuideOpen] = useState(false);
  const current = useRef<StoryPackage | undefined>(undefined);
  const past = useRef<StoryPackage[]>([]);
  const future = useRef<StoryPackage[]>([]);
  const lastPush = useRef(0);

  useEffect(() => {
    projects.get(projectId).then((rec) => {
      if (!rec) setMissing(true);
      else {
        current.current = rec.pkg;
        setPkg(rec.pkg);
        // 처음 여는 작품이면 시작 가이드를 펼쳐 둔다
        setGuideOpen(shouldAutoOpenGuide(projectId));
      }
    });
  }, [projectId]);

  // 자동 저장 (0.6초 디바운스)
  useEffect(() => {
    if (!pkg || saved) return;
    const t = setTimeout(() => projects.put(pkg).then(() => setSaved(true)), 600);
    return () => clearTimeout(t);
  }, [pkg, saved]);

  const commit = useCallback((next: StoryPackage) => {
    current.current = next;
    setPkg(next);
    setSaved(false);
  }, []);

  const update = useCallback(
    (fn: (d: StoryPackage) => void) => {
      const prev = current.current;
      if (!prev) return;
      // 고치는 함수가 무심코 값을 돌려줘도(화살표 함수의 대입식 등) 초안 수정으로만 다룬다
      const next = produce(prev, (d) => {
        fn(d);
      });
      if (next === prev) return;
      // 연속 타이핑은 한 단계로 묶는다
      const now = Date.now();
      if (now - lastPush.current > 800) {
        past.current.push(prev);
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
      }
      lastPush.current = now;
      future.current = [];
      commit(next);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !current.current) return;
    future.current.push(current.current);
    lastPush.current = 0;
    commit(prev);
  }, [commit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !current.current) return;
    past.current.push(current.current);
    lastPush.current = 0;
    commit(next);
  }, [commit]);

  const checkpoint = useCallback(() => void (lastPush.current = 0), []);
  const open = useCallback((s: string, i?: string) => go('edit', projectId, s, i), [projectId]);
  const test = useCallback((eventId?: string) => current.current && setTesting({ start: eventId, pkg: current.current }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (testing) {
        if (e.key === 'Escape') setTesting(undefined);
        return;
      }
      // 가이드가 켜져 있는 동안은 단축키(F5 테스트, 되돌리기, 저장)를 막는다. F5가 새로고침으로 새지도 않게 한다
      if (guideOpen) {
        if (e.key === 'F5') e.preventDefault();
        return;
      }
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inField) {
        e.preventDefault();
        redo();
      } else if (e.key === 'F5') {
        e.preventDefault();
        test();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (current.current) projects.put(current.current).then(() => setSaved(true));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, test, testing, guideOpen]);

  const api = useMemo<EditorApi | null>(() => (pkg ? { pkg, update, checkpoint, open, test, detail } : null), [pkg, update, checkpoint, open, test, detail]);
  const issues = useIssues(pkg ?? EMPTY);
  const errorCount = pkg ? issues.filter((i) => i.level === 'error').length : 0;

  if (missing)
    return (
      <div className="center-page">
        <p>프로젝트를 찾을 수 없습니다.</p>
        <a href="#/">처음으로</a>
      </div>
    );
  if (!pkg || !api) return <div className="center-page muted">불러오는 중…</div>;

  const counts: Record<string, number | undefined> = {
    events: pkg.events.length,
    actions: pkg.actions?.length,
    origins: pkg.origins?.list.length,
    variables: pkg.variables.length,
    inventory: (pkg.items?.length ?? 0) + (pkg.statuses?.length ?? 0),
    tables: pkg.tables?.length,
    triggers: pkg.triggers?.length,
    scripts: pkg.scripts?.length,
    endings: pkg.endings.length,
    achievements: pkg.achievements?.length,
    assets: pkg.assets?.length,
  };

  return (
    <EditorContext.Provider value={api}>
      <div className="editor">
        <header className="topbar">
          <a className="brand" href="#/">
            <span className="brand-mark">✒</span>이야기 공방
          </a>
          <span className="project-title">{pkg.meta.title}</span>
          <span className={`save-state ${saved ? '' : 'dirty'}`}>{saved ? '저장됨' : '저장 중…'}</span>
          <span className="spacer" />
          <button className="btn small" disabled={!past.current.length} onClick={undo} title="Ctrl+Z">
            ↶
          </button>
          <button className="btn small" disabled={!future.current.length} onClick={redo} title="Ctrl+Shift+Z">
            ↷
          </button>
          <button className={`btn small ${guideOpen ? 'on' : ''}`} onClick={() => (guideOpen && markGuideSeen(projectId), setGuideOpen((v) => !v))} title="처음 할 일을 안내합니다">
            가이드
          </button>
          <button className="btn primary" onClick={() => test()} title="F5">
            ▶ 테스트 플레이
          </button>
        </header>
        <nav className="sidenav">
          {NAV.map((g) => {
            const shown = g.items.filter(([id, , adv]) => !adv || detail || section === id || (counts[id] ?? 0) > 0 || (id === 'stages' && pkg.settings.mode === 'life'));
            return (
              <div key={g.group} className="nav-group">
                <div className="nav-group-title">{g.group}</div>
                {shown.map(([id, label]) => (
                  <a key={id} href={`#/edit/${encodeURIComponent(projectId)}/${id}`} className={(section === 'items' || section === 'statuses' ? 'inventory' : section) === id ? 'active' : ''}>
                    {label}
                    {counts[id] !== undefined && <span className="count">{counts[id]}</span>}
                    {id === 'check' && (errorCount > 0 ? <span className="count bad" title="오류가 있습니다">{errorCount}</span> : <span className="count ok" title="검사 통과">✓</span>)}
                  </a>
                ))}
              </div>
            );
          })}
          <div className="nav-foot">
            <div className="nav-mode" title="간단히: 꼭 필요한 메뉴와 칸만 / 자세히: 모든 메뉴, 세부 설정도 펼친 채로. 이미 쓰고 있는 메뉴는 간단히에서도 보입니다.">
              {(
                [
                  [false, '간단히'],
                  [true, '자세히'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  className={detail === v ? 'active' : ''}
                  onClick={() => {
                    setDetail(v);
                    prefs.set('detail', v ? 'on' : undefined);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>
        <main className="workspace">
          {!guideOpen && <TipBar onGuide={() => setGuideOpen(true)} />}
          <SectionView section={section} item={item} />
        </main>
        {guideOpen && <Guide pkg={pkg} errors={errorCount} onGo={open} onClose={() => (markGuideSeen(projectId), setGuideOpen(false))} />}
        {testing && (
          <div className="overlay">
            <TestPlay pkg={testing.pkg} startAt={testing.start} onClose={() => setTesting(undefined)} />
          </div>
        )}
      </div>
    </EditorContext.Provider>
  );
}

const EMPTY = { format: 'ifb/1', meta: { id: '', title: '' }, settings: { mode: 'story', calendar: { unit: 'none' }, stages: [] }, variables: [], events: [], endings: [] } as unknown as StoryPackage;

function SectionView({ section, item }: { section: string; item?: string }) {
  switch (section) {
    case 'flow':
      return <FlowSection />;
    case 'events':
      return <EventsSection selected={item} />;
    case 'actions':
      return <ActionsSection selected={item} />;
    case 'origins':
      return <OriginsSection selected={item} />;
    case 'variables':
      return <VariablesSection selected={item} />;
    case 'inventory':
      return <InventorySection selected={item} />;
    // 예전 주소(아이템·상태 화면)도 인벤토리로 연다
    case 'items':
      return <InventorySection selected={item && entryId('item', item)} />;
    case 'statuses':
      return <InventorySection selected={item && entryId('status', item)} />;
    case 'tables':
      return <TablesSection selected={item} />;
    case 'triggers':
      return <TriggersSection selected={item} />;
    case 'scripts':
      return <ScriptsSection selected={item} />;
    case 'endings':
      return <EndingsSection selected={item} />;
    case 'achievements':
      return <AchievementsSection selected={item} />;
    case 'meta':
      return <MetaSection />;
    case 'settings':
      return <SettingsSection />;
    case 'stages':
      return <StagesSection selected={item} />;
    case 'assets':
      return <AssetsSection />;
    case 'check':
      return <CheckSection />;
    case 'json':
      return <JsonSection />;
    case 'export':
      return <ExportSection />;
    case 'help':
      return <HelpView topic={item} />;
  }
  return <p>알 수 없는 화면</p>;
}
