import type { CalendarConfig } from './types';

const DAY_MS = 86_400_000;

/** 시간 인덱스(정수) ↔ 날짜 변환. 단위는 calendar.unit */
export class Calendar {
  readonly unit: CalendarConfig['unit'];
  readonly startIndex: number;
  readonly birthIndex: number;
  private readonly fmt: string;

  constructor(cfg: CalendarConfig) {
    this.unit = cfg.unit;
    this.fmt =
      cfg.format ?? { none: '', day: '{y}년 {m}월 {d}일', month: '{y}년 {m}월', year: '{y}년' }[cfg.unit];
    this.startIndex = cfg.start ? this.parse(cfg.start) : 0;
    this.birthIndex = this.addYears(this.startIndex, -(cfg.startAge ?? 0));
  }

  /** 'y', 'y.m', 'y.m.d' (YAML이 숫자로 읽은 984.1 같은 값은 주의: 문자열로 적을 것) */
  parse(date: string | number): number {
    const [y, m = 1, d = 1] = String(date).split(/[.\-/]/).map(Number);
    switch (this.unit) {
      case 'none':
        return 0;
      case 'year':
        return y;
      case 'month':
        return y * 12 + (m - 1);
      case 'day':
        return Math.round(utc(y, m, d) / DAY_MS);
    }
  }

  parts(index: number): { y: number; m: number; d: number } {
    switch (this.unit) {
      case 'none':
        return { y: 0, m: 1, d: 1 };
      case 'year':
        return { y: index, m: 1, d: 1 };
      case 'month':
        return { y: Math.floor(index / 12), m: mod(index, 12) + 1, d: 1 };
      case 'day': {
        const date = new Date(index * DAY_MS);
        return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
      }
    }
  }

  format(index: number): string {
    const p = this.parts(index);
    return this.fmt.replace(/\{([ymd])\}/g, (_, k: 'y' | 'm' | 'd') => String(p[k]));
  }

  addYears(index: number, years: number): number {
    switch (this.unit) {
      case 'none':
        return index;
      case 'year':
        return index + years;
      case 'month':
        return index + years * 12;
      case 'day': {
        const p = this.parts(index);
        return Math.round(utc(p.y + years, p.m, p.d) / DAY_MS);
      }
    }
  }

  /** 만 나이 */
  age(now: number, birth: number): number {
    if (this.unit === 'none') return 0;
    if (this.unit === 'year') return now - birth;
    if (this.unit === 'month') return Math.floor((now - birth) / 12);
    const a = this.parts(now);
    const b = this.parts(birth);
    return a.y - b.y - (a.m < b.m || (a.m === b.m && a.d < b.d) ? 1 : 0);
  }
}

function utc(y: number, m: number, d: number): number {
  const date = new Date(Date.UTC(2000, m - 1, d));
  date.setUTCFullYear(y);
  return date.getTime();
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
