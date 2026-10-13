import { FORMAT_VERSION, type StoryPackage } from '@engine';
import { offerFile } from './dialog';
import { forExport } from './remix';

interface DownloadsApi {
  save(req: { filename: string; data: Blob }): Promise<unknown>;
}
type ClaudeHost = { use?: (name: string) => Promise<DownloadsApi | null> };

/** claude.ai에 게시된 페이지 안이면 그쪽 저장 기능을, 아니면 일반 다운로드를 쓴다 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const downloads = await host.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== 'declined') console.warn('저장 실패', e);
      }
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'story';
}

/** 사본이면 작가 칸에 원작자를 앞세워 내보낸다("원작자, 나") */
export function exportPackage(pkg: StoryPackage): void {
  const text = JSON.stringify(forExport(pkg), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  void offerFile({ title: `내보내기 — ${pkg.meta.title}`, filename: `${safeFilename(pkg.meta.title)}.story.json`, blob, text });
}

export function pickFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0]);
    input.click();
  });
}

export function readAsText(file: File): Promise<string> {
  return file.text();
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** 가져온 JSON이 패키지 모양인지 최소한으로 확인 */
export function parsePackage(text: string): StoryPackage {
  const data = JSON.parse(text);
  if (data?.format !== FORMAT_VERSION) throw new Error(`지원하지 않는 형식입니다 (format: ${data?.format ?? '없음'})`);
  if (!data.meta?.id || !Array.isArray(data.events) || !Array.isArray(data.variables)) throw new Error('패키지 구조가 올바르지 않습니다');
  return data as StoryPackage;
}

export function newId(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 8);
}

/** 큰 이미지는 줄여서 data URL로 (용량 절약) */
export async function imageToDataUrl(file: File, maxSide = 1280): Promise<string> {
  const url = await readAsDataUrl(file);
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return url;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 400_000) return url;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
