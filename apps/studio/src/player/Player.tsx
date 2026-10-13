import { type EndScene, IMAGE_CLOSE, IMAGE_OPEN, type HudView, type MetaStore, type NameGender, Runner, type RunState, type Scene, type StoryPackage, type TraceEntry } from '@engine';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { offerFile } from '../lib/dialog';
import { safeFilename } from '../lib/files';
import { renderLifeImage } from '../lib/lifeImage';

export interface PlayerProps {
  pkg: StoryPackage;
  meta?: MetaStore;
  seed?: number;
  save?: RunState;
  /** 매 입력 후 호출(자동 저장 등) */
  onChange?: (runner: Runner) => void;
  onRestart?: () => void;
  onExit?: () => void;
  /** 테스트 플레이: 디버그 패널이 runner를 직접 다룬다 */
  runnerRef?: React.MutableRefObject<Runner | undefined>;
  /** 바깥(디버그 패널)에서 강제로 다시 그릴 때 바꾸는 값 */
  refreshKey?: number;
  /** 시작하자마자 이 이벤트로 이동(테스트 플레이) */
  startAt?: string;
  /** 진행 로그를 받는 곳(테스트 플레이) */
  trace?: (e: TraceEntry) => void;
}

export function Player({ pkg, meta, seed, save, onChange, onRestart, onExit, runnerRef, refreshKey, startAt, trace }: PlayerProps) {
  const [error, setError] = useState<string>();
  const created = useMemo(() => {
    try {
      const r = new Runner(pkg, { seed, meta, save, trace });
      if (startAt) {
        if (r.scene.type === 'name') r.setName('');
        r.jumpTo(startAt);
      }
      return { runner: r };
    } catch (e) {
      console.error(e);
      return { error: (e as Error).message };
    }
  }, [pkg, seed, save, meta, startAt, trace]);
  const runner = created.runner;
  if (runnerRef) runnerRef.current = runner;
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(bump, [refreshKey, bump]);

  const act = useCallback(
    (fn: (r: Runner) => void) => {
      if (!runner) return;
      try {
        fn(runner);
        setError(undefined);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      }
      onChange?.(runner);
      bump();
    },
    [runner, onChange, bump],
  );

  if (!runner)
    return (
      <div className="player">
        <div className="player-error">게임을 시작할 수 없습니다: {created.error}</div>
      </div>
    );

  const scene = runner.scene;
  const hud = runner.hud();
  const assetSrc = (id?: string) => (id ? pkg.assets?.find((a) => a.id === id)?.src : undefined);

  return (
    <div className="player" style={pkg.settings.ui?.theme as React.CSSProperties}>
      <Hud hud={hud} runner={runner} act={act} canUse={scene.type === 'event' || scene.type === 'menu'} />
      {error && <div className="player-error">⚠ 엔진 오류: {error}</div>}
      <main className="stage-area">
        <SceneView
          key={version}
          scene={scene}
          pkg={pkg}
          runner={runner}
          assetSrc={assetSrc}
          act={act}
          onRestart={onRestart}
          onExit={onExit}
        />
      </main>
    </div>
  );
}

// ───────────────────────── 상태창 ─────────────────────────

function Hud({ hud, runner, act, canUse }: { hud: HudView; runner: Runner; act: (fn: (r: Runner) => void) => void; canUse: boolean }) {
  const [bag, setBag] = useState(false);
  const [page, setPage] = useState(0);
  const ui = runner.pkg.settings.ui?.terms;
  const terms = { inventory: ui?.inventory || '인벤토리', items: ui?.items || '아이템', statuses: ui?.statuses || '상태', use: ui?.use || '사용' };
  // 만든 쪽이 아이템도 상태도 정의했으면 둘 다 쪽으로 나누고, 하나만 있으면 그 쪽만 보여 준다
  const pkg = runner.pkg;
  const pages: ('items' | 'statuses')[] = [];
  if ((pkg.items ?? []).some((i) => !i.hidden) || hud.items.length) pages.push('items');
  if ((pkg.statuses ?? []).some((s) => !s.hidden) || hud.statuses.length) pages.push('statuses');
  const at = Math.min(page, Math.max(0, pages.length - 1));
  const total = hud.items.length + hud.statuses.length;
  return (
    <header className="hud">
      <div className="hud-who">
        {hud.name && <strong>{hud.name}</strong>}
        {hud.age !== undefined && <span>{hud.age}세</span>}
        {hud.date && <span className="muted">{hud.date}</span>}
        {runner.pkg.settings.stages.length > 1 && <span className="chip">{hud.stage}</span>}
      </div>
      <div className="hud-vars">
        {hud.vars.map((v) => (
          <div key={v.id} className={`hud-var as-${v.as}`} title={v.label || undefined}>
            <span className="hud-name">{v.icon ? `${v.icon} ` : ''}{v.name}</span>
            {v.as === 'bar' && typeof v.value === 'number' ? (
              <span className="bar">
                <span
                  className="bar-fill"
                  style={{
                    width: `${barRatio(v.value, v.min ?? 0, v.max ?? 10) * 100}%`,
                    background: v.color,
                  }}
                />
                <span className="bar-text">
                  {fmtValue(v.value)}
                  {v.max !== undefined ? ` / ${fmtValue(v.max)}` : ''}
                </span>
              </span>
            ) : (
              <span className="hud-value">
                {v.format ? v.format.replace('{value}', fmtValue(v.value)).replace('{max}', fmtValue(v.max ?? '')) : fmtValue(v.value)}
              </span>
            )}
            {v.label && <span className="hud-label">{v.label}</span>}
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="hud-side">
          <button className={`btn small ${bag ? 'on' : ''}`} onClick={() => setBag(!bag)}>
            {terms.inventory} {total}
          </button>
        </div>
      )}
      {bag && total > 0 && (
        <div className="bag" role="dialog" aria-label={terms.inventory}>
          <div className="bag-head">
            <strong>{terms.inventory}</strong>
            {pages.length > 1 && (
              <span className="bag-pager">
                <button type="button" className="icon" aria-label="이전 쪽" onClick={() => setPage((page + pages.length - 1) % pages.length)}>
                  ‹
                </button>
                {pages.map((p, i) => (
                  <button key={p} type="button" className={`bag-tab ${i === at ? 'on' : ''}`} onClick={() => setPage(i)}>
                    {p === 'items' ? terms.items : terms.statuses}
                    <span className="bag-count">{p === 'items' ? hud.items.length : hud.statuses.length}</span>
                  </button>
                ))}
                <button type="button" className="icon" aria-label="다음 쪽" onClick={() => setPage((page + 1) % pages.length)}>
                  ›
                </button>
              </span>
            )}
          </div>
          {pages[at] === 'items' ? (
            hud.items.length === 0 ? (
              <p className="muted small bag-empty">{terms.items}이(가) 없습니다.</p>
            ) : (
              hud.items.map((i) => (
                <div key={i.id} className="bag-item">
                  <div>
                    <strong>
                      {i.icon ? `${i.icon} ` : ''}
                      {i.name}
                    </strong>
                    {i.count > 1 && <span className="muted"> ×{i.count}</span>}
                    {i.description && <div className="muted small">{i.description}</div>}
                  </div>
                  {i.usable && canUse && (
                    <button
                      className="btn small"
                      onClick={() => {
                        setBag(false);
                        act((r) => r.useItem(i.id));
                      }}
                    >
                      {terms.use}
                    </button>
                  )}
                </div>
              ))
            )
          ) : hud.statuses.length === 0 ? (
            <p className="muted small bag-empty">{terms.statuses}이(가) 없습니다.</p>
          ) : (
            hud.statuses.map((s) => (
              <div key={s.id} className="bag-item">
                <div>
                  <strong className={`status-name ${s.tone ?? ''}`}>
                    {s.icon ? `${s.icon} ` : ''}
                    {s.name}
                  </strong>
                  {s.stacks > 1 && <span className="muted"> ×{s.stacks}</span>}
                  {s.remaining !== undefined && <span className="muted"> · {s.remaining}턴 남음</span>}
                  {s.description && <div className="muted small">{s.description}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}    </header>
  );
}

function barRatio(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

function fmtValue(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('ko-KR') : (Math.round(v * 10) / 10).toLocaleString('ko-KR');
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  return String(v);
}

// ───────────────────────── 장면 ─────────────────────────

interface SceneProps {
  scene: Scene;
  pkg: StoryPackage;
  runner: Runner;
  assetSrc: (id?: string) => string | undefined;
  act: (fn: (r: Runner) => void) => void;
  onRestart?: () => void;
  onExit?: () => void;
}

function SceneView({ scene, pkg, runner, assetSrc, act, onRestart, onExit }: SceneProps) {
  const typewriter = pkg.settings.ui?.typewriter !== false;
  const packed = useMemo(() => packImages(scene.type === 'name' || scene.type === 'end' ? '' : scene.text), [scene]);
  const text = packed.text;
  const [shown, done, skip] = useTypewriter(text, typewriter);

  // 글 영역 스크롤: 글이 나오는 동안엔 맨 아래를 따라가고, 다 나오면(건너뛰기 포함) 맨 아래로 맞춘다
  const bodyRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (done || stick.current) el.scrollTop = el.scrollHeight;
  }, [shown, done]);

  // 키보드: 숫자 = 선택, Enter/Space = 계속·건너뛰기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (!done && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        skip();
        return;
      }
      if (scene.type === 'result' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        act((r) => r.proceed());
      }
      const n = Number(e.key);
      if (done && n >= 1 && n <= 9) {
        if (scene.type === 'event' || scene.type === 'menu') {
          const c = scene.choices[n - 1];
          if (c?.enabled) act((r) => r.choose(c.index));
        } else if (scene.type === 'origin' && scene.origins[n - 1]) act((r) => r.choose(n - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, done, skip, act]);

  if (scene.type === 'name')
    return (
      <NameScene
        defaultName={scene.defaultName}
        styled={!!scene.style}
        askName={scene.askName}
        askGender={scene.askGender}
        onRoll={(g) => runner.rollName(g)}
        onSubmit={(n, g) => act((r) => r.setName(n, g))}
      />
    );
  if (scene.type === 'end') return <EndView end={scene} pkg={pkg} runner={runner} assetSrc={assetSrc} onRestart={onRestart} onExit={onExit} />;

  const image = scene.type === 'event' ? assetSrc(scene.image) : scene.type === 'result' ? assetSrc(scene.images[0]) : undefined;
  return (
    <article className={`scene scene-${scene.type} ${done ? '' : 'typing'}`} onDoubleClick={() => !done && skip()}>
      <div
        className="scene-body"
        ref={bodyRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {scene.type === 'event' && scene.title && <h2 className="scene-title">{scene.title}</h2>}
        {scene.type === 'menu' && scene.title && <h2 className="scene-title">{scene.title}</h2>}
        {scene.type === 'origin' && <h2 className="scene-title">{scene.title ?? '출신'}</h2>}
        {image && <img className="scene-image" src={image} alt="" />}
        <div className="prose">{paragraphs(shown, packed.ids, assetSrc)}</div>

        {done && scene.type === 'result' && scene.notes.length > 0 && (
          <div className="notes">
            {scene.notes.map((n, i) => (
              <span key={i} className={`note ${noteTone(n)}`}>
                {n}
              </span>
            ))}
          </div>
        )}

        {done && scene.type === 'event' && scene.notes && scene.notes.length > 0 && (
          <div className="notes">
            {scene.notes.map((n, i) => (
              <span key={i} className={`note ${noteTone(n)}`}>
                {n}
              </span>
            ))}
          </div>
        )}
        {!done && <div className="skip-hint">더블클릭하거나 Enter로 한 번에 보기</div>}
      </div>

      {done && scene.type === 'result' && (
        <div className="scene-foot">
          <ol className="choices">
            <li>
              <button className="choice" autoFocus onClick={() => act((r) => r.proceed())}>
                {pkg.settings.ui?.continueText ?? '계속'}
              </button>
            </li>
          </ol>
        </div>
      )}

      {done && (scene.type === 'event' || scene.type === 'menu') && (
        <div className="scene-foot">
          <ol className="choices">
            {scene.choices.map((c, i) => (
              <li key={c.index}>
                <button className="choice" disabled={!c.enabled} onClick={() => act((r) => r.choose(c.index))}>
                  <span className="choice-key">{i + 1}</span>
                  <span className="choice-text">{c.text}</span>
                  {c.chance && <span className="choice-chance">{c.chance}</span>}
                  {c.reason && <span className="choice-reason">{c.reason}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {done && scene.type === 'origin' && (
        <div className="scene-foot">
          <ol className="choices origins">
            {scene.origins.map((o, i) => (
              <li key={o.id}>
                <button className="choice origin" onClick={() => act((r) => r.choose(i))}>
                  {assetSrc(o.image) && <img src={assetSrc(o.image)} alt="" />}
                  <span className="choice-key">{i + 1}</span>
                  <span className="choice-text">
                    <strong>{o.title}</strong>
                    {o.summary && <span className="muted">{o.summary}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function noteTone(n: string): string {
  if (/[+]\d|획득|달성|성공|회복/.test(n)) return 'good';
  if (/-\d|잃음|실패|해제|공포|상태:/.test(n)) return 'bad';
  return '';
}

// 글 사이에 들어가는 이미지: 엔진이 {image 이미지ID}를 IMAGE_OPEN id IMAGE_CLOSE로 내보낸다.
// 글자가 한 자씩 나타나는 동안 중간이 깨져 보이지 않게, 이미지 한 개를 글자 하나(사설 영역 문자)로 바꿔 두었다가 그릴 때 이미지로 돌려놓는다.
const IMAGE_BASE = 0xe100;
const IMAGE_RE = new RegExp(`${IMAGE_OPEN}([^${IMAGE_CLOSE}]*)${IMAGE_CLOSE}`, 'g');
const IMAGE_CHAR = /([\ue100-\ue1ff])/;

function packImages(text: string): { text: string; ids: string[] } {
  const ids: string[] = [];
  const packed = text.replace(IMAGE_RE, (_m, id: string) => {
    let i = ids.indexOf(id);
    if (i < 0) i = ids.push(id) - 1;
    return String.fromCharCode(IMAGE_BASE + Math.min(i, 0xff));
  });
  return { text: packed, ids };
}

function paragraphs(text: string, ids: string[] = [], assetSrc?: (id?: string) => string | undefined) {
  return text.split('\n').flatMap((line, li) =>
    line.split(IMAGE_CHAR).map((part, pi) => {
      const key = `${li}-${pi}`;
      if (IMAGE_CHAR.test(part)) {
        const src = assetSrc?.(ids[part.charCodeAt(0) - IMAGE_BASE]);
        return src ? <img key={key} className="prose-image" src={src} alt="" /> : null;
      }
      return part.trim() ? <p key={key}>{part}</p> : null;
    }),
  );
}

/** 글자 하나가 나타나는 간격(ms). 더블클릭이나 Enter로 한 번에 띄울 수 있다 */
const TYPE_MS = 24;

function useTypewriter(text: string, enabled: boolean): [string, boolean, () => void] {
  const [n, setN] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled || n >= text.length) return;
    // 한 글자씩 천천히, 문장이 끝나는 곳에서는 숨을 한 번 쉰다
    const last = text[n - 1];
    const pause = last && /[.!?…。]/.test(last) ? 140 : last === ',' || last === '\n' ? 60 : 0;
    const t = setTimeout(() => setN((x) => Math.min(text.length, x + 1)), TYPE_MS + pause);
    return () => clearTimeout(t);
  }, [n, text, enabled]);
  const done = n >= text.length;
  return [done ? text : text.slice(0, n), done, () => setN(text.length)];
}

const GENDER_CHOICES: [NameGender | undefined, string][] = [
  ['male', '남자'],
  ['female', '여자'],
  ['neutral', '중성'],
  [undefined, '상관없음'],
];

function NameScene({
  defaultName,
  styled,
  askName,
  askGender,
  onRoll,
  onSubmit,
}: {
  defaultName: string;
  styled: boolean;
  askName: boolean;
  askGender: boolean;
  onRoll: (g?: NameGender) => string | undefined;
  onSubmit: (n: string, g?: NameGender) => void;
}) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<NameGender | undefined>(undefined);
  const [picked, setPicked] = useState(!askGender);
  return (
    <article className="scene">
      <h2 className="scene-title">{askName ? '이름' : '주인공'}</h2>
      {askGender && (
        <>
          <p className="prose">주인공의 성별을 골라 주세요.{styled && askName ? ' 무작위 이름도 그에 맞춰 뽑습니다.' : ''}</p>
          <div className="gender-pick" role="radiogroup" aria-label="성별">
            {GENDER_CHOICES.map(([g, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={picked && gender === g}
                className={`btn ${picked && gender === g ? 'primary' : ''}`}
                onClick={() => {
                  setGender(g);
                  setPicked(true);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {askName && <p className="prose">이 이야기의 주인공을 무엇이라 부를까요?</p>}
      <form
        className="name-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (picked) onSubmit(name, gender);
        }}
      >
        {askName && <input autoFocus value={name} placeholder={styled ? '비워 두면 무작위' : defaultName} maxLength={20} onChange={(e) => setName(e.target.value)} />}
        {askName && styled && (
          <button type="button" className="btn" title="이름 주머니에서 뽑기" onClick={() => setName(onRoll(picked ? gender : undefined) ?? name)}>
            무작위
          </button>
        )}
        <button className="btn primary" disabled={!picked} title={picked ? undefined : '성별을 먼저 골라 주세요'}>
          시작
        </button>
      </form>
    </article>
  );
}

// ───────────────────────── 엔딩 ─────────────────────────

function EndView({
  end,
  pkg,
  runner,
  assetSrc,
  onRestart,
  onExit,
}: {
  end: EndScene;
  pkg: StoryPackage;
  runner: Runner;
  assetSrc: (id?: string) => string | undefined;
  onRestart?: () => void;
  onExit?: () => void;
}) {
  const [onlyMajor, setOnlyMajor] = useState(false);
  const life = end.life.filter((e) => !onlyMajor || e.importance >= 4);
  const image = assetSrc(end.ending.image);
  const packedEnd = useMemo(() => packImages(end.text), [end.text]);
  const saveImage = () => {
    const name = runner.usesName ? runner.state.name : undefined;
    const canvas = renderLifeImage({ gameTitle: pkg.meta.title, name, end, minImportance: onlyMajor ? 4 : 1 });
    canvas.toBlob(
      (blob) =>
        blob &&
        offerFile({ title: '인생표 이미지', filename: `${safeFilename(name ?? pkg.meta.title)}_인생표.png`, blob, image: canvas.toDataURL('image/png') }),
      'image/png',
    );
  };
  return (
    <article className="scene scene-end">
      <div className={`ending-kind ${end.ending.kind ?? 'neutral'}`}>엔딩</div>
      <h2 className="scene-title">{end.ending.title}</h2>
      {image && <img className="scene-image" src={image} alt="" />}
      <div className="prose">{paragraphs(packedEnd.text, packedEnd.ids, assetSrc)}</div>

      <section className="life-table">
        <div className="life-head">
          <h3>인생표</h3>
          <label className="check">
            <input type="checkbox" checked={onlyMajor} onChange={(e) => setOnlyMajor(e.target.checked)} /> 주요 사건만
          </label>
          <button className="btn small" onClick={saveImage}>
            이미지로 저장
          </button>
        </div>
        {life.length === 0 ? (
          <p className="muted">기록된 사건이 없습니다.</p>
        ) : (
          <ol className="timeline">
            {life.map((e, i) => (
              <li key={i} className={`imp-${e.importance}`}>
                <span className="when">{e.age !== undefined ? `${e.age}세` : `${e.turn + 1}턴`}</span>
                <span className="what">{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {end.achievements.length > 0 && (
        <section className="achievements">
          <h3>달성한 도전과제</h3>
          <ul>
            {end.achievements.map((a) => (
              <li key={a.id}>
                <strong>★ {a.title}</strong>
                {a.description && <span className="muted"> — {a.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="choices row">
        {onRestart && (
          <button className="btn primary" onClick={onRestart}>
            다시 시작
          </button>
        )}
        {onExit && (
          <button className="btn" onClick={onExit}>
            나가기
          </button>
        )}
      </div>
    </article>
  );
}
