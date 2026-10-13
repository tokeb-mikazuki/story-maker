import type { Content, PlayerState } from './types';
import { evaluate } from './conditions';
import { renderText } from './text';
import { ageOf, formatDate } from './time';
import { tagNumber } from './state';

/** 인생의 재해 등급 (하나 협회 재해 등급 패러디) */
export const LIFE_GRADES = ['뜬소문', '도시 괴담', '도시 전설', '도시 질병', '도시 악몽', '도시의 별'] as const;

export function lifeScore(state: PlayerState): number {
  return (
    tagNumber(state, '명성') +
    Math.max(0, Math.floor(state.money / 10_000_000)) +
    Math.floor(ageOf(state) / 10) +
    (state.tags['신체:EGO'] ? 20 : 0)
  );
}

export function lifeGrade(state: PlayerState): string {
  const score = lifeScore(state);
  const thresholds = [5, 15, 30, 50, 80];
  const index = thresholds.findIndex((t) => score < t);
  return LIFE_GRADES[index === -1 ? LIFE_GRADES.length - 1 : index];
}

/** 서울 2033 '정착 엔딩'식 조건부 단락 조립 */
export function buildEpilogue(content: Content, state: PlayerState): string {
  const reason = state.ended?.reason ?? '사망';
  const parts: string[] = [];
  parts.push(`${formatDate(state.now)}, ${state.name}의 이야기는 ${ageOf(state)}세에 끝났습니다.`);
  const endingText = content.endings[reason];
  if (endingText) parts.push(renderText(endingText, state));

  const paragraphs = content.epilogue
    .filter((p) => evaluate(p.when, state))
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  for (const paragraph of paragraphs) {
    const lines = paragraph.lines.filter((l) => evaluate(l.when, state)).map((l) => renderText(l.text, state));
    if (lines.length) parts.push(lines.join(' '));
  }

  const grade = lifeGrade(state);
  parts.push(
    grade === '도시의 별'
      ? '오늘 도시의 별 하나가 졌습니다.'
      : `당신의 인생은 하나 협회의 기록에 '${grade}'(으)로 남았습니다.`,
  );
  return parts.join('\n\n');
}
