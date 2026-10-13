// 편집 허가(남이 편집기로 가져가도 되는지)와 원작자 표기.
// 비밀번호는 숫자 6자리까지, 원문 대신 해시만 작품에 담는다.

import type { StoryPackage } from '@engine';
import { DEVELOPER } from './auth';
import { askPin, tell } from './dialog';

export const PIN_MAX = 6;
export const isPin = (s: string) => /^\d{1,6}$/.test(s);

function fnv(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** 작품 id를 소금으로 쓴다. 사본은 id가 바뀌므로 비밀번호도 따라가지 않는다 */
export function hashPin(pkgId: string, pin: string): string {
  const s = `${pkgId}:${pin}`;
  return `v1:${fnv(s, 0x811c9dc5).toString(36)}${fnv(s, 0x2545f491).toString(36)}`;
}

/** 샘플은 늘 허가, 나머지는 작가가 허가했을 때만 */
export function canRemix(pkg: StoryPackage): boolean {
  return pkg.meta.id.startsWith('sample:') || !!pkg.meta.remix?.allow;
}

/** 편집기로 가져가도 되는지 확인한다(필요하면 비밀번호를 묻는다) */
export async function confirmRemix(pkg: StoryPackage): Promise<boolean> {
  if (!canRemix(pkg)) {
    await tell('작가가 이 작품의 편집을 허가하지 않았어요.');
    return false;
  }
  const hash = pkg.meta.remix?.pinHash;
  if (!hash) return true;
  let message = `「${pkg.meta.title}」의 작가가 편집기 비밀번호를 걸어 두었어요. 숫자 비밀번호를 입력하세요.`;
  for (;;) {
    const pin = await askPin(message);
    if (pin === undefined) return false;
    if (isPin(pin) && hashPin(pkg.meta.id, pin) === hash) return true;
    message = '비밀번호가 맞지 않아요. 다시 입력하세요.';
  }
}

const uniq = (xs: string[]) => xs.filter((x, i) => x && xs.indexOf(x) === i);

/** 원작자부터 지금 작가까지 — "원작자, 복사자" */
export function creditLine(meta: StoryPackage['meta']): string {
  return uniq([...(meta.credits ?? []), meta.author?.trim() ?? '']).join(', ');
}

/**
 * 다른 작품의 사본. 원작자 목록을 이어 붙이고, 작가는 사본을 만든 사람으로 바꾼다.
 * ownerName: 창작마당에 올린 사람(작품에 작가 이름이 없을 때 쓴다)
 */
export function remixCopy(pkg: StoryPackage, newId: string, copier?: string, ownerName?: string): StoryPackage {
  const copy: StoryPackage = JSON.parse(JSON.stringify(pkg));
  const original = pkg.meta.author?.trim() || ownerName || DEVELOPER.nickname;
  copy.meta.id = newId;
  copy.meta.title = `${pkg.meta.title} (사본)`;
  copy.meta.credits = uniq([...(pkg.meta.credits ?? []), original]);
  copy.meta.author = copier;
  // 편집 허가와 비밀번호는 원작의 것이라 사본에는 따라가지 않는다
  delete copy.meta.remix;
  return copy;
}

/** 파일로 내보낼 모양: 작가 칸에 원작자를 앞세운다 */
export function forExport(pkg: StoryPackage): StoryPackage {
  if (!pkg.meta.credits?.length) return pkg;
  const out: StoryPackage = { ...pkg, meta: { ...pkg.meta, author: creditLine(pkg.meta) } };
  delete out.meta.credits;
  return out;
}
