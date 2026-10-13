// 내보내기: 완성한 이야기를 어디로 보낼지 정하는 곳. 왼쪽 메뉴 작업대에서 연다.

import { useEffect, useState } from 'react';
import { useAccount } from '../../lib/auth';
import { useCommunityVersion, worksApi } from '../../lib/community';
import { ask, tell } from '../../lib/dialog';
import { GENRES } from '../../lib/ranking';
import { href } from '../../lib/router';
import { projects } from '../../lib/storage';
import { BookCover } from '../../components/Cover';
import { exportPackage, imageToDataUrl, pickFile, safeFilename } from '../../lib/files';
import { useEditor } from '../context';
import { Section, uniqueId } from '../fields';
import { useIssues } from './Tools';

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function ExportSection() {
  const { pkg, open } = useEditor();
  const issues = useIssues(pkg);
  const errors = issues.filter((i) => i.level === 'error').length;
  const [copied, setCopied] = useState(false);
  const bytes = new Blob([JSON.stringify(pkg)]).size;

  // 올리기 전에 갖춰져 있어야 할 것
  const checks: [boolean, string, string?][] = [
    [errors === 0, errors ? `검사 오류 ${errors}개를 고쳐야 해요` : '검사를 통과했어요', 'check'],
    [!!pkg.meta.title.trim(), '작품 제목이 있어요', 'meta'],
    [!!pkg.meta.description?.trim(), '소개 글이 있어요', 'meta'],
    [pkg.endings.length > 0, '엔딩이 하나 이상 있어요', 'endings'],
  ];
  const ready = checks.every(([ok]) => ok);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void tell('복사하지 못했어요. 「파일로 저장」을 눌러 나오는 창에서 복사해 보세요.');
    }
  };

  return (
    <>
      <p className="intro">완성한 이야기를 어디로 보낼지 고르세요. 작업 내용은 자동으로 저장되지만, 이 브라우저 밖으로 옮기려면 여기서 내보내야 해요.</p>

      <Section title="표지" topic="share">
        <CoverPicker />
      </Section>

      <Section title="창작마당에 올리기" topic="share">
        <p className="muted small">다른 사람이 내 이야기를 찾아 플레이할 수 있게 공개하는 곳이에요.</p>
        <ul className="export-checks">
          {checks.map(([ok, text, go]) => (
            <li key={text} className={ok ? 'ok' : 'todo'}>
              <span aria-hidden>{ok ? '✓' : '○'}</span> {text}
              {!ok && go && (
                <button type="button" className="link small" onClick={() => open(go)}>
                  고치러 가기
                </button>
              )}
            </li>
          ))}
        </ul>
        <PublishBox ready={ready} />
      </Section>

      <Section title="파일로 내보내기" topic="share">
        <p className="muted small">
          작품 전체가 하나의 파일(<code>.story.json</code>)로 저장돼요. 백업하거나 다른 기기·브라우저로 옮길 때, 또는 친구에게 보내 줄 때 쓰세요. 예상 크기 {sizeText(bytes)}
        </p>
        <div className="export-grid">
          <div className="export-card">
            <h4>파일로 저장</h4>
            <p>{safeFilename(pkg.meta.title)}.story.json</p>
            <button type="button" className="btn primary" onClick={() => exportPackage(pkg)}>
              파일로 저장
            </button>
          </div>
          <div className="export-card">
            <h4>글자로 복사</h4>
            <p>파일 대신 작품 내용을 글자로 복사해 붙여 넣을 때.</p>
            <button type="button" className="btn" onClick={copy}>
              {copied ? '복사됨' : '클립보드에 복사'}
            </button>
          </div>
          <div className="export-card is-soon">
            <h4>혼자 실행되는 웹 파일</h4>
            <p>편집기 없이 더블클릭만으로 플레이되는 .html 파일. 준비 중이에요.</p>
            <button type="button" className="btn" disabled>
              준비 중
            </button>
          </div>
        </div>
      </Section>
    </>
  );
}

type PublishState = { ownerId?: string; published?: { ownerId: string; genre: string; tags: string[]; updatedAt: number } };

/** 창작마당 올리기·새 버전·내리기 */
function PublishBox({ ready }: { ready: boolean }) {
  const { pkg } = useEditor();
  const me = useAccount();
  const v = useCommunityVersion();
  const [state, setState] = useState<PublishState>();
  const [genre, setGenre] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([projects.get(pkg.meta.id), worksApi.published(pkg.meta.id)]).then(([rec, pub]) => {
      if (!live) return;
      setState({ ownerId: rec?.ownerId, published: pub });
      if (pub) {
        setGenre((g) => g || pub.genre);
        setTags((t) => t || pub.tags.join(', '));
      } else setTags((t) => t || (pkg.meta.tags ?? []).join(', '));
    });
    return () => {
      live = false;
    };
  }, [pkg.meta.id, v, me?.id]);

  if (!state) return null;
  if (!me)
    return (
      <div className="export-actions">
        <a className="btn primary" href={href('login')}>
          로그인하고 올리기
        </a>
        <span className="muted small">창작마당에 올리려면 로그인이 필요해요. 지금 작업은 로그인한 뒤 마이페이지에서 내 계정으로 옮길 수 있어요.</span>
      </div>
    );
  if (pkg.meta.id.startsWith('sample:'))
    return <p className="muted small">샘플 원본은 올릴 수 없어요. 홈의 「편집기에서 열기」로 사본을 만들어 고친 뒤 올려 주세요.</p>;
  if ((state.ownerId && state.ownerId !== me.id) || (state.published && state.published.ownerId !== me.id))
    return <p className="muted small">다른 계정의 작업이라 이 계정으로는 올릴 수 없어요.</p>;

  const pub = state.published;
  const tagList = tags
    .split(/[,#]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  const publish = async () => {
    setBusy(true);
    try {
      if (!state.ownerId) await projects.setOwner(pkg.meta.id, me.id);
      await worksApi.publish(pkg, me.id, { genre, tags: tagList });
      void tell(pub ? '창작마당의 작품을 지금 버전으로 바꿨어요. 별점과 플레이 수는 그대로예요.' : '창작마당에 올렸어요! 작품 페이지에서 확인해 보세요.');
    } catch (e) {
      void tell((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="publish-box">
      <div className="publish-fields">
        <label>
          <span>장르</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">고르세요</option>
            {GENRES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="grow">
          <span>태그 (쉼표로 구분, 8개까지)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예: 단편, 반전, 잔잔함" />
        </label>
      </div>
      <div className="export-actions">
        <button type="button" className="btn primary" disabled={!ready || !genre || busy} onClick={publish}>
          {busy ? '올리는 중…' : pub ? '새 버전으로 바꾸기' : '창작마당에 올리기'}
        </button>
        {pub && (
          <>
            <a className="btn" href={href('works', pkg.meta.id)} target="_blank" rel="noreferrer">
              작품 페이지
            </a>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (await ask('창작마당에서 내릴까요? 받은 별점과 플레이 수도 함께 사라집니다.', '내리기', true)) await worksApi.unpublish(pkg.meta.id, me.id);
              }}
            >
              내리기
            </button>
          </>
        )}
        <span className="muted small">
          {!ready ? '위 항목을 먼저 갖춰 주세요.' : !genre ? '장르를 골라 주세요.' : pub ? `공개 중 · 마지막 반영 ${new Date(pub.updatedAt).toLocaleString('ko-KR')}` : '올리면 누구나 플레이하고 별점을 남길 수 있어요.'}
        </span>
      </div>
    </div>
  );
}

/** 창작마당·타이틀 화면에 쓰는 표지(meta.cover). 새로 올리거나 이미 올린 이미지에서 고른다 */
function CoverPicker() {
  const { pkg, update } = useEditor();
  const images = (pkg.assets ?? []).filter((a) => a.kind === 'image');
  const current = pkg.meta.cover ? images.find((a) => a.id === pkg.meta.cover) : undefined;
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    setBusy(true);
    try {
      const src = await imageToDataUrl(file, 1400);
      update((d) => {
        const id = uniqueId('표지', (d.assets ?? []).map((a) => a.id));
        (d.assets ??= []).push({ id, kind: 'image', src, alt: '표지' });
        d.meta.cover = id;
      });
    } catch {
      void tell('이미지를 읽지 못했어요. 다른 파일로 해 보세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cover-picker">
      <div className="cover-preview">
        <BookCover w={{ id: pkg.meta.id, genre: '기타', cover: current?.src }} />
        <small className="muted">{current ? `이미지 ID: ${current.id}` : '표지 없음 · 기본 무늬'}</small>
      </div>
      <div className="cover-controls">
        <p className="muted small">
          창작마당 목록과 작품 화면, 플레이 첫 화면에 깔리는 그림이에요. 제목은 표지 아래에 따로 표시되니 그림에 넣지 않아도 돼요. 세로 2:3 비율(예: 1200×1800)이 가장 잘 맞고, 다른 비율은 가운데를 기준으로 잘라서 채웁니다.
        </p>
        <div className="export-actions">
          <button type="button" className="btn primary" onClick={upload} disabled={busy}>
            {busy ? '올리는 중…' : current ? '새 이미지로 바꾸기' : '표지 이미지 올리기'}
          </button>
          {current && (
            <button type="button" className="btn" onClick={() => update((d) => void delete d.meta.cover)}>
              표지 빼기
            </button>
          )}
        </div>
        {images.length > 0 && (
          <>
            <h4>이미 올린 이미지에서 고르기</h4>
            <div className="cover-choices" role="radiogroup" aria-label="표지로 쓸 이미지">
              {images.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={a.id === pkg.meta.cover}
                  className={a.id === pkg.meta.cover ? 'on' : ''}
                  onClick={() => update((d) => void (d.meta.cover = a.id))}
                  title={a.alt ? `${a.alt} (${a.id})` : a.id}
                >
                  <img src={a.src} alt="" />
                  <span>{a.id}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <p className="muted small">이미 창작마당에 올린 작품이라면, 표지를 바꾼 뒤 아래의 「새 버전으로 바꾸기」를 눌러야 반영돼요.</p>
      </div>
    </div>
  );
}
