import type { DateString, PlayerState, Stage } from './types';

export function parseDate(date: DateString): number {
  const [year, month] = String(date).split('.').map(Number);
  return year * 12 + ((month || 1) - 1);
}

export function formatDate(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}년 ${month}월`;
}

export function ageOf(state: PlayerState): number {
  return Math.floor((state.now - state.birth) / 12);
}

export function stageOf(state: PlayerState): Stage {
  const age = ageOf(state);
  if (age < 13) return 'child';
  if (age < 20) return 'teen';
  return 'adult';
}

/** 한 턴이 지나가는 개월 수. 유년기는 2년, 청소년기는 1년, 성인기는 1개월. */
export function turnLength(stage: Stage): number {
  switch (stage) {
    case 'child':
      return 24;
    case 'teen':
      return 12;
    case 'adult':
      return 1;
  }
}

// 원작 연표의 기준점 (docs/research/01 §11)
export const HISTORY = {
  smokeWar: parseDate('972.01'),
  whiteNights: parseDate('982.01'),
  limbusStart: parseDate('984.01'),
} as const;
