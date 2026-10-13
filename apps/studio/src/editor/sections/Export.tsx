// 내보내기: 완성한 이야기를 어디로 보낼지 정하는 곳. 왼쪽 메뉴 작업대에서 연다.

import { useState } from 'react';
import { tell } from '../../lib/dialog';
import { exportPackage, safeFilename } from '../../lib/files';
import { useEditor } from '../context';
import { Section } from '../fields';
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
        <div className="export-actions">
          <button type="button" className="btn primary" disabled title="창작마당이 열리면 쓸 수 있어요">
            창작마당에 올리기
          </button>
          <span className="muted small">{ready ? '올릴 준비는 끝났어요. ' : ''}창작마당은 아직 준비 중이에요. 열리면 여기에서 바로 올릴 수 있어요.</span>
        </div>
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
