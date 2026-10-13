import type { StoryPackage } from '@engine';
import { useEffect, useState } from 'react';
import { PageHead } from '../components/Site';
import { useAccount } from '../lib/auth';
import { ask, tell } from '../lib/dialog';
import { exportPackage, newId, parsePackage, pickFile } from '../lib/files';
import { go, href } from '../lib/router';
import { type ProjectRecord, projects, storageIsVolatile } from '../lib/storage';
import { blankTemplate, lifeTemplate, storyTemplate } from '../lib/templates';
import { SAMPLES, isFanWork } from '../samples';

async function createProject(pkg: StoryPackage): Promise<void> {
  await projects.put(pkg);
  go('edit', pkg.meta.id, pkg.settings.mode === 'life' ? 'flow' : 'flow');
}

/** 샘플을 내 프로젝트로 복사 */
export async function copySample(pkg: StoryPackage): Promise<void> {
  const copy: StoryPackage = JSON.parse(JSON.stringify(pkg));
  copy.meta.id = newId('p_');
  copy.meta.title = `${pkg.meta.title} (사본)`;
  await createProject(copy);
}

/** 내 작업실: 새로 만들기, 이 브라우저의 작업 목록, 연습용 샘플 */
export function Studio() {
  const me = useAccount();
  const [all, setAll] = useState<ProjectRecord[]>();
  // 로그인했으면 내 계정 작업과 로그인 전 작업만, 아니면 게스트 작업만
  const list = all?.filter((p) => !p.ownerId || p.ownerId === me?.id);
  const [error, setError] = useState<string>();
  const reload = () => projects.list().then(setAll, (e) => setError(String(e)));
  useEffect(() => {
    reload();
  }, []);

  const importFile = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const pkg = parsePackage(await file.text());
      if (list?.some((p) => p.id === pkg.meta.id)) {
        if (await ask(`'${pkg.meta.title}'와(과) 같은 프로젝트가 이미 있습니다. 기존 프로젝트를 이 파일로 덮어쓸까요? (취소하면 사본으로 가져옵니다)`, '덮어쓰기', true)) {
          await projects.put(pkg);
          reload();
          return;
        }
        pkg.meta.id = newId('p_');
      }
      await createProject(pkg);
    } catch (e) {
      await tell(`가져오지 못했습니다: ${(e as Error).message}`);
    }
  };

  return (
    <div className="page studio-page">
      <PageHead kicker="내 작업실" title="쓰던 원고를 펼치세요">
        한 번의 사건부터 0세에서 마지막 날까지의 인생까지 — 변수, 아이템, 상태, 확률, 엔딩을 마음대로 설계하세요. 완성한 작품은 편집기의 「내보내기」에서 창작마당에 올릴 수 있습니다.
      </PageHead>
      {!me && (
        <div className="claim-box">
          <div>
            <strong>로그인하면 작품을 창작마당에 올릴 수 있어요</strong>
            <small>로그인하지 않고 만든 작업도 나중에 마이페이지에서 내 계정으로 옮길 수 있습니다.</small>
          </div>
          <a className="btn primary" href={href('login')}>
            로그인
          </a>
        </div>
      )}

      <section className="home-section">
        <h2>새로 만들기</h2>
        <div className="cards">
          <button className="card new" onClick={() => createProject(lifeTemplate())}>
            <h3>인생형</h3>
            <p>0세부터 시작해 사망·노환으로 끝나는 인생 시뮬레이션. 체력·정신력, 단계별 턴, 연간 행동 메뉴, 자연사 규칙이 들어 있습니다.</p>
          </button>
          <button className="card new" onClick={() => createProject(storyTemplate())}>
            <h3>이야기형</h3>
            <p>시작 이벤트에서 선택지로 갈라지는 분기형 소설. 더 일어날 일이 없으면 끝납니다.</p>
          </button>
          <button className="card new" onClick={() => createProject(blankTemplate())}>
            <h3>빈 프로젝트</h3>
            <p>최소한의 설정만 있는 상태에서 시작합니다.</p>
          </button>
          <button className="card new" onClick={importFile}>
            <h3>파일 가져오기</h3>
            <p>내보낸 .story.json 파일을 불러옵니다.</p>
          </button>
        </div>
      </section>

      <section className="home-section">
        <h2>{me ? `${me.nickname} 님의 작업` : '내 작업'}</h2>
        {error && <p className="error-text">저장소를 열 수 없습니다: {error}</p>}
        {list && storageIsVolatile && (
          <p className="warn-box">이 환경에서는 브라우저 저장소를 쓸 수 없어, 프로젝트가 이 탭을 닫으면 사라집니다. 작업한 내용은 '내보내기'로 꼭 받아 두세요.</p>
        )}
        {list && list.length === 0 && <p className="muted">아직 프로젝트가 없습니다. 샘플을 편집기에서 열거나 새로 만들어 보세요.</p>}
        <div className="cards">
          {list?.map((p) => (
            <div key={p.id} className="card project">
              <div className="card-kind">{p.pkg.settings.mode === 'life' ? '인생형' : '이야기형'}</div>
              <h3>{p.pkg.meta.title}</h3>
              <div className="card-meta">
                이벤트 {p.pkg.events.length} · 수정 {new Date(p.updatedAt).toLocaleString('ko-KR')}
              </div>
              <div className="card-actions">
                <a className="btn primary" href={`#/edit/${encodeURIComponent(p.id)}`}>
                  편집
                </a>
                <a className="btn" href={`#/play/${encodeURIComponent(p.id)}`}>
                  플레이
                </a>
                <button className="btn" onClick={() => exportPackage(p.pkg)}>
                  내보내기
                </button>
                <button
                  className="btn danger"
                  onClick={async () => {
                    if (!(await ask(`'${p.pkg.meta.title}'을(를) 삭제할까요? 되돌릴 수 없습니다.`, '삭제', true))) return;
                    await projects.remove(p.id);
                    reload();
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="home-section">
        <h2>샘플로 연습하기</h2>
        <p className="muted small">샘플을 편집기에서 열면 사본이 만들어져 마음껏 고쳐 볼 수 있어요.</p>
        <div className="cards">
          {SAMPLES.map((s) => (
            <div key={s.meta.id} className="card sample">
              <div className="card-kind">
                {s.settings.mode === 'life' ? '인생형' : '이야기형'}
                {isFanWork(s.meta.id) && <span className="fan-badge" title="원작 IP가 있는 세계관의 팬 창작입니다. 공개 배포 빌드에서는 빠집니다.">팬 창작 · 공개 배포 전 제외</span>}
              </div>
              <h3>{s.meta.title}</h3>
              <p>{s.meta.description}</p>
              <div className="card-meta">
                이벤트 {s.events.length} · 엔딩 {s.endings.length} · 도전과제 {s.achievements?.length ?? 0}
              </div>
              <div className="card-actions">
                <a className="btn primary" href={`#/play/${encodeURIComponent(s.meta.id)}`}>
                  ▶ 플레이
                </a>
                <button className="btn" onClick={() => copySample(s)}>
                  편집기에서 열기
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="home-foot muted small">작업 원고는 이 브라우저 안에만 저장됩니다. 다른 기기로 옮기려면 '내보내기'로 파일을 받아 두세요.</p>
    </div>
  );
}
