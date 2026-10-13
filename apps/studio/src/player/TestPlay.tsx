// 테스트 플레이: 플레이어 + 디버그 패널(변수·태그·아이템·상태 직접 수정, 이벤트로 이동).

import { MemoryMetaStore, type Runner, type StoryPackage, type TraceEntry, type Value } from '@engine';
import { useCallback, useMemo, useRef, useState } from 'react';
import { tell } from '../lib/dialog';
import { eventLabel } from '../lib/labels';
import { Player } from './Player';
import { TraceLog } from './TraceLog';

const LOG_LIMIT = 3000;

export function TestPlay({ pkg, startAt, onClose }: { pkg: StoryPackage; startAt?: string; onClose: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [run, setRun] = useState(0);
  const [jump, setJump] = useState(startAt);
  const meta = useMemo(() => new MemoryMetaStore(), []);
  const runnerRef = useRef<Runner | undefined>(undefined);
  // refreshKey: 플레이어 장면을 다시 그림 / debugTick: 디버그 패널만 갱신
  const [refreshKey, setRefreshKey] = useState(0);
  const [debugTick, setDebugTick] = useState(0);
  const refresh = () => {
    setRefreshKey((k) => k + 1);
    setDebugTick((k) => k + 1);
  };
  // 진행 로그: 엔진이 렌더 중에도 기록하므로 다시 그리기는 다음 틱으로 미룬다
  const log = useRef<TraceEntry[]>([]);
  const pending = useRef(false);
  const trace = useCallback((e: TraceEntry) => {
    log.current.push(e);
    if (log.current.length > LOG_LIMIT) log.current.splice(0, log.current.length - LOG_LIMIT);
    if (!pending.current) {
      pending.current = true;
      setTimeout(() => {
        pending.current = false;
        setDebugTick((k) => k + 1);
      }, 0);
    }
  }, []);
  const clearLog = () => {
    log.current = [];
    setDebugTick((k) => k + 1);
  };

  return (
    <div className="testplay">
      <div className="testplay-bar">
        <strong>테스트 플레이</strong>
        <span className="muted">시드 {seed}</span>
        <button className="btn small" onClick={() => (clearLog(), setRun((r) => r + 1))}>
          같은 시드로 다시
        </button>
        <button
          className="btn small"
          onClick={() => {
            clearLog();
            setSeed(Math.floor(Math.random() * 1e9));
            setJump(startAt);
          }}
        >
          새 시드로 다시
        </button>
        <span className="spacer" />
        <button className="btn small" onClick={onClose}>
          닫기 (Esc)
        </button>
      </div>
      <div className="testplay-body">
        <div className="testplay-game">
          <Player
            key={`${seed}:${run}:${jump ?? ''}`}
            pkg={pkg}
            seed={seed}
            meta={meta}
            startAt={jump}
            runnerRef={runnerRef}
            refreshKey={refreshKey}
            onChange={() => setDebugTick((k) => k + 1)}
            onRestart={() => (clearLog(), setRun((r) => r + 1))}
            trace={trace}
          />
        </div>
        <DebugPanel
          pkg={pkg}
          runnerRef={runnerRef}
          tick={debugTick}
          log={log.current}
          onClearLog={clearLog}
          onChanged={() => {
            runnerRef.current?.refresh();
            refresh();
          }}
          onJump={(id) => {
            const r = runnerRef.current;
            if (!r) return;
            r.world.log('scene', `(디버그) '${eventLabel(pkg.events.find((e) => e.id === id), id)}'(으)로 이동`);
            r.jumpTo(id);
            refresh();
          }}
        />
      </div>
    </div>
  );
}

function DebugPanel({
  pkg,
  runnerRef,
  tick,
  log,
  onClearLog,
  onChanged,
  onJump,
}: {
  pkg: StoryPackage;
  runnerRef: React.MutableRefObject<Runner | undefined>;
  tick: number;
  log: TraceEntry[];
  onClearLog: () => void;
  onChanged: () => void;
  onJump: (id: string) => void;
}) {
  void tick;
  const r = runnerRef.current;
  const [target, setTarget] = useState(pkg.events[0]?.id ?? '');
  const [newTag, setNewTag] = useState('');
  const [tab, setTab] = useState<'log' | 'vars' | 'tags' | 'items' | 'info'>('log');
  if (!r) return <aside className="debug" />;
  const w = r.world;
  const s = r.state;

  const safe = (fn: () => void) => {
    try {
      fn();
      onChanged();
    } catch (e) {
      void tell((e as Error).message);
    }
  };

  return (
    <aside className="debug">
      <div className="debug-jump">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {pkg.events.map((e) => (
            <option key={e.id} value={e.id}>
              {eventLabel(e)}
            </option>
          ))}
        </select>
        <button className="btn small" onClick={() => onJump(target)}>
          이동
        </button>
      </div>
      {target && (
        <div className="muted small">
          지금 '{eventLabel(pkg.events.find((e) => e.id === target), target)}'의 등장 조건: {r.isEligible(target) ? '맞음' : '안 맞음'}
        </div>
      )}
      <div className="tabs small">
        {(
          [
            ['log', '진행 로그'],
            ['vars', '변수'],
            ['tags', '태그'],
            ['items', '소지품'],
            ['info', '현재 위치'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' && <TraceLog entries={log} onClear={onClearLog} />}

      {tab === 'vars' && (
        <table className="debug-table">
          <tbody>
            {pkg.variables.map((v) => {
              let value: Value;
              try {
                value = w.getVar(v.id);
              } catch (e) {
                value = `오류: ${(e as Error).message}`;
              }
              return (
                <tr key={v.id}>
                  <th title={v.description}>{v.name ?? v.id}</th>
                  <td>
                    {v.formula ? (
                      <span className="muted" title={v.formula}>
                        {String(value)} (파생)
                      </span>
                    ) : v.type === 'bool' ? (
                      <input type="checkbox" checked={Boolean(w.baseVar(v.id))} onChange={(e) => safe(() => w.setVar(v.id, e.target.checked))} />
                    ) : (
                      <DebugInput
                        value={String(w.baseVar(v.id))}
                        onCommit={(x) => safe(() => w.setVar(v.id, v.type === 'number' ? Number(x) : x))}
                      />
                    )}
                    {!v.formula && v.type === 'number' && value !== w.baseVar(v.id) && <span className="muted small"> → {String(value)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {tab === 'tags' && (
        <div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const [k, ...rest] = newTag.split('=');
              if (!k.trim()) return;
              const raw = rest.join('=');
              safe(() => {
                s.tags[k.trim()] = rest.length ? (raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw) : true;
              });
              setNewTag('');
            }}
          >
            <input value={newTag} placeholder="키 또는 키=값" onChange={(e) => setNewTag(e.target.value)} />
            <button className="btn small">추가</button>
          </form>
          <table className="debug-table">
            <tbody>
              {Object.entries(s.tags).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>
                    {v === true ? '✓' : String(v)}{' '}
                    <button className="link" onClick={() => safe(() => delete s.tags[k])}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(s.tags).length === 0 && <p className="muted small">태그 없음</p>}
        </div>
      )}

      {tab === 'items' && (
        <div>
          <h4>아이템</h4>
          {(pkg.items ?? []).map((it) => (
            <div key={it.id} className="row">
              <span className="grow">{it.name}</span>
              <button className="btn small" onClick={() => safe(() => w.addItem(it.id, -1, true))}>
                −
              </button>
              <span>{s.items[it.id] ?? 0}</span>
              <button className="btn small" onClick={() => safe(() => w.addItem(it.id, 1, true))}>
                +
              </button>
            </div>
          ))}
          <h4>상태</h4>
          {(pkg.statuses ?? []).map((st) => (
            <label key={st.id} className="row check">
              <input
                type="checkbox"
                checked={!!s.statuses[st.id]}
                onChange={(e) => safe(() => (e.target.checked ? w.addStatus(st.id, 1, undefined, true) : w.removeStatus(st.id, false, true)))}
              />
              {st.name}
              {s.statuses[st.id]?.remaining !== undefined && <span className="muted small"> 남은 턴 {s.statuses[st.id].remaining}</span>}
            </label>
          ))}
        </div>
      )}

      {tab === 'info' && (
        <table className="debug-table">
          <tbody>
            <tr>
              <th>턴</th>
              <td>{s.turn + 1}</td>
            </tr>
            <tr>
              <th>단계</th>
              <td>
                {w.currentStage().name} / phase {s.phase}
              </td>
            </tr>
            {w.cal.unit !== 'none' && (
              <tr>
                <th>날짜·나이</th>
                <td>
                  {w.cal.format(s.now)} · {w.age()}세
                </td>
              </tr>
            )}
            <tr>
              <th>대기 이벤트</th>
              <td>{s.queue.join(', ') || '-'}</td>
            </tr>
            <tr>
              <th>본 이벤트</th>
              <td className="small">{Object.keys(s.seen).join(', ') || '-'}</td>
            </tr>
            <tr>
              <th>인생표</th>
              <td className="small">{s.life.map((l) => l.text).join(' / ') || '-'}</td>
            </tr>
            {s.ended && (
              <tr>
                <th>종료</th>
                <td>{s.ended.ending}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </aside>
  );
}

function DebugInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string>();
  return (
    <input
      className="debug-input"
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== undefined && draft !== value) onCommit(draft);
        setDraft(undefined);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
