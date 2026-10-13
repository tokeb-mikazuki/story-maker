import type { PlayerState } from './types';
import { ageOf, formatDate } from './time';

/** 본문 변수 치환: {이름} {나이} {날짜} {구} {거주} */
export function renderText(template: string, state: PlayerState): string {
  const vars: Record<string, string> = {
    이름: state.name,
    나이: String(ageOf(state)),
    날짜: formatDate(state.now),
    구: String(state.tags['출신구'] ?? '어느 구'),
    거주: String(state.tags['거주'] ?? '어딘가'),
  };
  return template.replace(/\{([^}]+)\}/g, (match, key: string) => vars[key] ?? match).trim();
}
