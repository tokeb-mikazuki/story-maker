import { type Issue, type SimulationReport, type StoryPackage, simulate, validatePackage } from '@engine';
import { useMemo, useState } from 'react';
import { tell } from '../../lib/dialog';
import { parsePackage } from '../../lib/files';
import { eventLabel } from '../../lib/labels';
import { useEditor } from '../context';
import { Section } from '../fields';

/** 검증 경로 → 에디터 위치 */
export function issueTarget(path: string): [string, string | undefined] {
  const [head, id, sub] = path.split('/');
  if (head === 'settings' && id === 'stages') return ['stages', sub];
  if (head === 'epilogue') return ['endings', undefined];
  const known = ['variables', 'events', 'actions', 'items', 'statuses', 'origins', 'scripts', 'triggers', 'endings', 'achievements', 'tables', 'assets', 'settings'];
  return [known.includes(head) ? head : 'settings', id];
}

export function useIssues(pkg: StoryPackage): Issue[] {
  return useMemo(() => {
    try {
      return validatePackage(pkg);
    } catch (e) {
      return [{ level: 'error', path: 'settings', message: `검증기 오류: ${(e as Error).message}` }];
    }
  }, [pkg]);
}

export function CheckSection() {
  const { pkg, open, test } = useEditor();
  const issues = useIssues(pkg);
  const [report, setReport] = useState<SimulationReport>();
  const [runs, setRuns] = useState(300);
  const [busy, setBusy] = useState(false);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        setReport(simulate(pkg, { runs, seed: Math.floor(Math.random() * 1e6) }));
      } catch (e) {
        void tell((e as Error).message);
      }
      setBusy(false);
    }, 30);
  };

  const title = (id: string) => eventLabel(pkg.events.find((e) => e.id === id), id);

  return (
    <>
      <Section title={`검사 — 오류 ${errors.length} · 경고 ${warnings.length}`} topic="check" help="수식 문법, 없는 대상을 가리키는 참조, 절대 등장하지 않는 이벤트 등을 찾습니다. 항목을 누르면 해당 위치로 갑니다.">
        {issues.length === 0 && <p className="ok">문제가 없습니다.</p>}
        <ul className="issues">
          {[...errors, ...warnings].map((i, n) => (
            <li key={n} className={i.level} onClick={() => open(...issueTarget(i.path))}>
              <span className="issue-level">{i.level === 'error' ? '오류' : '경고'}</span>
              <span className="issue-path">{i.path}</span>
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="자동 시뮬레이션"
        topic="check"
        help="무작위로 선택하는 가상 플레이어가 여러 번 끝까지 플레이합니다. 엔딩이 고르게 나오는지, 한 번도 안 나오는 이벤트는 없는지, 초크포인트를 모두 지나는지, 막히는 곳은 없는지 확인할 수 있습니다."
        actions={
          <span className="inline">
            <input type="number" min={10} max={5000} value={runs} onChange={(e) => setRuns(Number(e.target.value) || 100)} style={{ width: 80 }} />판
            <button className="btn primary small" disabled={busy || errors.length > 0} onClick={run}>
              {busy ? '실행 중…' : '실행'}
            </button>
          </span>
        }
      >
        {errors.length > 0 && <p className="muted">오류를 먼저 고쳐 주세요.</p>}
        {report && (
          <div className="report">
            <div className="report-stats">
              <div>
                <b>{report.runs}</b>판
              </div>
              <div>
                평균 <b>{report.turns.avg}</b>턴 ({report.turns.min}~{report.turns.max})
              </div>
              {report.ages && (
                <div>
                  평균 수명 <b>{report.ages.avg}</b>세 ({report.ages.min}~{report.ages.max})
                </div>
              )}
              <div className={report.stuck ? 'bad' : ''}>
                막힌 판 <b>{report.stuck}</b>
              </div>
              <div className={report.errors.length ? 'bad' : ''}>
                오류 <b>{report.errors.reduce((a, e) => a + e.count, 0)}</b>
              </div>
            </div>
            <h4>엔딩 분포</h4>
            <div className="bars">
              {Object.entries(report.endings)
                .sort((a, b) => b[1] - a[1])
                .map(([id, n]) => (
                  <div key={id} className="bar-row" onClick={() => open('endings', id)}>
                    <span className="bar-label">{pkg.endings.find((e) => e.id === id)?.title ?? id}</span>
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${(n / report.runs) * 100}%` }} />
                    </span>
                    <span className="bar-num">{Math.round((n / report.runs) * 1000) / 10}%</span>
                  </div>
                ))}
              {pkg.endings
                .filter((e) => !report.endings[e.id])
                .map((e) => (
                  <div key={e.id} className="bar-row dim" onClick={() => open('endings', e.id)}>
                    <span className="bar-label">{e.title}</span>
                    <span className="bar-track" />
                    <span className="bar-num">0%</span>
                  </div>
                ))}
            </div>
            {report.chokepoints.length > 0 && (
              <>
                <h4>필수 통과 지점 통과율</h4>
                <ul className="plain">
                  {report.chokepoints.map((c) => (
                    <li key={c.id} className={c.rate < 1 ? 'bad' : 'ok'} onClick={() => open('events', c.id)}>
                      {title(c.id)} — {Math.round(c.rate * 1000) / 10}%{c.rate < 1 ? ' (모든 플레이가 지나가지 않습니다)' : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {report.errors.length > 0 && (
              <>
                <h4>오류</h4>
                <ul className="plain">
                  {report.errors.map((e, i) => (
                    <li key={i} className="bad">
                      {e.count}회: {e.message} (시드 {e.seed})
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h4>이벤트 등장률</h4>
            <div className="reach">
              {pkg.events
                .map((e) => [e, report.eventReach[e.id] ?? 0] as const)
                .sort((a, b) => a[1] - b[1])
                .map(([e, n]) => (
                  <button key={e.id} className={`reach-item ${n === 0 ? 'zero' : ''}`} onClick={() => open('events', e.id)}>
                    <span>{eventLabel(e)}</span>
                    <span className="bar-track small">
                      <span className="bar-fill" style={{ width: `${(n / report.runs) * 100}%` }} />
                    </span>
                    <span className="bar-num">{Math.round((n / report.runs) * 100)}%</span>
                  </button>
                ))}
            </div>
            {report.unreachedEvents.length > 0 && (
              <p className="muted small">
                한 번도 나오지 않은 이벤트 {report.unreachedEvents.length}개 — 조건이 너무 까다롭거나, 무작위 선택으로는 닿기 어려운 경로입니다.{' '}
                <button className="link" onClick={() => test(report.unreachedEvents[0])}>
                  첫 번째 이벤트부터 테스트
                </button>
              </p>
            )}
          </div>
        )}
      </Section>
    </>
  );
}

export function JsonSection() {
  const { pkg, update } = useEditor();
  const text = useMemo(() => JSON.stringify({ ...pkg, assets: undefined }, null, 2), [pkg]);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <Section
      title="원본 직접 고치기 (고급)"
      topic="json"
      help="화면에 없는 세부 항목까지 모두 고칠 수 있는 고급 기능입니다. 이미지는 용량 때문에 빠져 있고, 적용해도 그대로 유지됩니다."
      actions={
        <span className="inline">
          {draft !== undefined && (
            <button className="btn small" onClick={() => (setDraft(undefined), setError(undefined))}>
              되돌리기
            </button>
          )}
          <button
            className="btn small primary"
            disabled={draft === undefined}
            onClick={() => {
              try {
                const next = parsePackage(draft!);
                update((d) => {
                  const assets = d.assets;
                  for (const k of Object.keys(d)) delete (d as unknown as Record<string, unknown>)[k];
                  Object.assign(d, next, { assets, meta: { ...next.meta, id: pkg.meta.id } });
                });
                setDraft(undefined);
                setError(undefined);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            적용
          </button>
        </span>
      }
    >
      <p className="intro">게임 전체를 글로 고치는 고급 기능입니다. 고친 뒤 '적용'을 눌러야 반영됩니다. 이미지는 빠져 있지만 적용해도 그대로 남습니다.</p>
      {error && <p className="error-text">{error}</p>}
      <textarea className="json mono" spellCheck={false} value={draft ?? text} onChange={(e) => setDraft(e.target.value)} />
    </Section>
  );
}
