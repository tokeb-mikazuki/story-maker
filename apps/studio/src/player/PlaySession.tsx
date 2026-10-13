import type { Runner, RunState, StoryPackage } from '@engine';
import { type CSSProperties, useMemo, useState } from 'react';
import { ask } from '../lib/dialog';
import { LocalMetaStore, saves } from '../lib/storage';
import { Player } from './Player';

/**
 * 타이틀 화면과 플레이. 사이트 안(PlayPage)과 혼자 실행되는 HTML 파일이 함께 쓴다.
 * back: 돌아갈 곳(없으면 링크를 그리지 않는다). onPlayStart: 새로 시작할 때마다 호출(플레이 수 집계 등)
 */
export function PlaySession({ pkg, back, onPlayStart }: { pkg: StoryPackage; back?: { to: string; label: string }; onPlayStart?: () => void }) {
  const meta = useMemo(() => new LocalMetaStore(), []);
  const [session, setSession] = useState<{ n: number; save?: RunState }>();
  const [existing, setExisting] = useState(() => saves.load(pkg.meta.id));
  const [cleared, setCleared] = useState(0);
  // cleared가 바뀌면 다시 읽는다
  const record = cleared >= 0 ? meta.load(pkg.meta.id) : undefined;
  const cover = pkg.meta.cover ? pkg.assets?.find((a) => a.id === pkg.meta.cover)?.src : undefined;

  const themed = { style: pkg.settings.ui?.theme as CSSProperties | undefined };
  if (session)
    return (
      <div className="play-page" {...themed}>
        <div className="play-top">
          {back ? (
            <a href={back.to} className="muted">
              ← {back.label}
            </a>
          ) : (
            <span />
          )}
          <span className="muted">{pkg.meta.title}</span>
          <button className="link" onClick={() => (setExisting(saves.load(pkg.meta.id)), setSession(undefined))}>
            타이틀로
          </button>
        </div>
        <Player
          key={session.n}
          pkg={pkg}
          meta={meta}
          save={session.save}
          onChange={(r: Runner) => {
            if (r.scene.type === 'end') saves.clear(pkg.meta.id);
            else saves.save(pkg.meta.id, r.save());
          }}
          onRestart={() => {
            saves.clear(pkg.meta.id);
            onPlayStart?.();
            setSession({ n: session.n + 1 });
          }}
          onExit={() => (setExisting(undefined), setSession(undefined))}
        />
      </div>
    );

  const achievements = pkg.achievements ?? [];
  const seenEndings = pkg.endings.filter((e) => record?.endings[e.id]).length;
  const doneAchievements = achievements.filter((a) => record?.achievements[a.id]).length;
  const KIND_NAME: Record<string, string> = { good: '좋은 결말', bad: '나쁜 결말', death: '죽음', neutral: '그 밖의 결말' };
  return (
    <div className="play-root" {...themed}>
      <div className="title-screen">
        <header className="title-hero">
          {cover && <img className="cover" src={cover} alt="" />}
          {(pkg.meta.tags?.length ?? 0) > 0 && (
            <div className="title-tags">
              {pkg.meta.tags!.map((tg) => (
                <span key={tg}>{tg}</span>
              ))}
            </div>
          )}
          <h1>{pkg.meta.title}</h1>
          {pkg.meta.author && <p className="title-author">{pkg.meta.author}</p>}
          {pkg.meta.description && <p className="desc">{pkg.meta.description}</p>}
          <div className="title-actions">
            <button
              className="btn primary big"
              onClick={async () => {
                if (existing && !existing.ended && !(await ask('진행 중인 이야기가 사라집니다. 새로 시작할까요?', '새로 시작', true))) return;
                saves.clear(pkg.meta.id);
                onPlayStart?.();
                setSession({ n: 1 });
              }}
            >
              새로 시작
            </button>
            {existing && !existing.ended && (
              <button className="btn big" onClick={() => setSession({ n: 1, save: existing })}>
                이어하기
              </button>
            )}
          </div>
        </header>

        {record && (
          <section className="records" aria-label="플레이 기록">
            <div className="rec-top">
              <h3>
                기록 <span>{record.runs}회 플레이</span>
              </h3>
              <button
                className="link"
                onClick={async () => {
                  if (await ask('본 엔딩과 도전과제 기록을 모두 지울까요?', '기록 지우기', true)) {
                    meta.clear(pkg.meta.id);
                    setCleared((n) => n + 1);
                  }
                }}
              >
                기록 초기화
              </button>
            </div>
            <div className="rec-cols">
              <div className="rec-card">
                <div className="rec-head">
                  <h4>엔딩</h4>
                  <span className="rec-count">
                    <b>{seenEndings}</b> / {pkg.endings.length}
                  </span>
                </div>
                <div className="rec-bar" aria-hidden>
                  <i style={{ width: `${pkg.endings.length ? (seenEndings / pkg.endings.length) * 100 : 0}%` }} />
                </div>
                <ul className="end-list">
                  {pkg.endings.map((e) => {
                    const n = record.endings[e.id];
                    return (
                      <li key={e.id} className={`end-item ${n ? `kind-${e.kind ?? 'neutral'}` : 'locked'}`} title={n ? KIND_NAME[e.kind ?? 'neutral'] : '아직 보지 못한 엔딩'}>
                        <span className="end-dot" aria-hidden />
                        <span className="end-title">{n ? e.title : '???'}</span>
                        {n ? <span className="end-n">×{n}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {achievements.length > 0 && (
                <div className="rec-card">
                  <div className="rec-head">
                    <h4>도전과제</h4>
                    <span className="rec-count">
                      <b>{doneAchievements}</b> / {achievements.length}
                    </span>
                  </div>
                  <div className="rec-bar" aria-hidden>
                    <i style={{ width: `${(doneAchievements / achievements.length) * 100}%` }} />
                  </div>
                  <ul className="ach-list">
                    {achievements.map((a) => {
                      const done = !!record.achievements[a.id];
                      const secret = !done && a.hidden;
                      return (
                        <li key={a.id} className={`ach-item ${done ? 'on' : ''}`}>
                          <span className="ach-icon" aria-hidden>
                            {done ? (a.icon ?? '★') : secret ? '?' : '🔒'}
                          </span>
                          <span className="ach-body">
                            <b>{secret ? '숨겨진 도전과제' : a.title}</b>
                            {!secret && a.description ? <small>{a.description}</small> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
        {back && (
          <a href={back.to} className="title-back">
            ← {back.label}로
          </a>
        )}
      </div>
    </div>
  );
}