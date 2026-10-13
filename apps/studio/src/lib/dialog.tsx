// 앱 안에서 그리는 확인·알림·파일 내보내기 창.
// 브라우저 기본 confirm/alert와 파일 다운로드가 막힌 환경(웹 임베드 등)에서도 동작한다.

import { useEffect, useState } from 'react';
import { downloadBlob } from './files';

type Request =
  | { kind: 'confirm'; message: string; ok: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'alert'; message: string; resolve: (v: boolean) => void }
  | { kind: 'file'; title: string; filename: string; blob: Blob; text?: string; image?: string; resolve: (v: boolean) => void }
  | { kind: 'pin'; message: string; resolve: (v: boolean, pin?: string) => void };

let push: ((r: Request) => void) | undefined;
const queue: Request[] = [];

function open(r: Request): void {
  if (push) push(r);
  else queue.push(r);
}

export function ask(message: string, ok = '확인', danger = false): Promise<boolean> {
  return new Promise((resolve) => open({ kind: 'confirm', message, ok, danger, resolve }));
}

export function tell(message: string): Promise<void> {
  return new Promise((resolve) => open({ kind: 'alert', message, resolve: () => resolve() }));
}

/** 숫자 비밀번호(최대 6자리)를 묻는다. 취소하면 undefined */
export function askPin(message: string): Promise<string | undefined> {
  return new Promise((resolve) => open({ kind: 'pin', message, resolve: (ok, pin) => resolve(ok ? (pin ?? '') : undefined) }));
}

/** 파일 내보내기: 저장 버튼 + (텍스트면 복사, 이미지면 미리보기) */
export function offerFile(opts: { title: string; filename: string; blob: Blob; text?: string; image?: string }): Promise<void> {
  return new Promise((resolve) => open({ kind: 'file', ...opts, resolve: () => resolve() }));
}

export function DialogHost() {
  const [items, setItems] = useState<Request[]>([]);
  const [copied, setCopied] = useState(false);
  const [pin, setPin] = useState('');
  useEffect(() => {
    push = (r) => setItems((xs) => [...xs, r]);
    if (queue.length) setItems(queue.splice(0));
    return () => {
      push = undefined;
    };
  }, []);
  const cur = items[0];
  useEffect(() => {
    setCopied(false);
    setPin('');
  }, [cur]);
  useEffect(() => {
    if (!cur) return;
    // 창이 떠 있는 동안 뒤쪽(플레이어 단축키 등)으로 키가 새지 않게 막는다
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter' && cur.kind !== 'file' && cur.kind !== 'pin') {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  if (!cur) return null;
  function close(v: boolean) {
    if (cur.kind === 'pin') cur.resolve(v, pin);
    else cur.resolve(v);
    setItems((xs) => xs.slice(1));
  }
  return (
    <div className="dialog-backdrop" onClick={() => close(false)}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {cur.kind === 'pin' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close(true);
            }}
          >
            <p className="dialog-message">{cur.message}</p>
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={6}
              placeholder="숫자 최대 6자리"
              aria-label="비밀번호"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => close(false)}>
                취소
              </button>
              <button className="btn primary" disabled={!pin}>
                확인
              </button>
            </div>
          </form>
        ) : cur.kind === 'file' ? (
          <>
            <h3>{cur.title}</h3>
            {cur.image && <img className="dialog-image" src={cur.image} alt={cur.filename} />}
            {cur.text !== undefined && <textarea className="mono dialog-text" readOnly value={cur.text} onFocus={(e) => e.target.select()} />}
            <p className="muted small">
              {cur.image
                ? '저장 버튼이 동작하지 않으면 이미지를 길게 누르거나 오른쪽 클릭해서 저장하세요.'
                : cur.text === undefined && cur.filename.endsWith('.html')
                  ? '받은 .html 파일을 더블클릭하면 브라우저에서 바로 실행돼요. 인터넷 없이도 열 수 있고, 진행 상황은 그 브라우저에 저장돼요.'
                  : '저장 버튼이 동작하지 않으면 내용을 복사해 .story.json 파일로 저장하세요.'}
            </p>
            <div className="dialog-actions">
              {cur.text !== undefined && (
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(cur.text!).then(
                      () => setCopied(true),
                      () => (document.querySelector('.dialog-text') as HTMLTextAreaElement | null)?.select(),
                    );
                  }}
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              )}
              <button className="btn primary" onClick={() => void downloadBlob(cur.blob, cur.filename)}>
                {cur.filename} 저장
              </button>
              <button className="btn" onClick={() => close(true)}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog-message">{cur.message}</p>
            <div className="dialog-actions">
              {cur.kind === 'confirm' && (
                <button className="btn" onClick={() => close(false)}>
                  취소
                </button>
              )}
              <button className={`btn ${cur.kind === 'confirm' && cur.danger ? 'danger-fill' : 'primary'}`} autoFocus onClick={() => close(true)}>
                {cur.kind === 'confirm' ? cur.ok : '확인'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
