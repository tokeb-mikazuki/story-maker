// 「청화고 연애 금지령」 공용 줄임 함수.

import type { Command } from '@engine';

export const add = (v: string, n: number | string): Command => ({ do: 'add', var: v, value: n });
export const set = (v: string, n: number | string | boolean): Command => ({ do: 'set', var: v, value: n });
/** 문자열 값은 따옴표로 감싸 수식이 아닌 글자로 쓴다 */
export const tag = (key: string, value?: string | number): Command => (value === undefined ? { do: 'tag', key } : { do: 'tag', key, value: typeof value === 'string' ? `'${value}'` : value });
export const tagAdd = (key: string, n: number | string = 1): Command => ({ do: 'tag', key, add: n });
export const item = (id: string, count = 1, silent = false): Command => (silent ? { do: 'item', id, count, silent } : { do: 'item', id, count });
export const on = (id: string, duration?: number): Command => (duration === undefined ? { do: 'status', id } : { do: 'status', id, duration });
export const off = (id: string): Command => ({ do: 'status', id, remove: true });
export const note = (text: string): Command => ({ do: 'note', text });
export const rec = (text: string, importance = 3): Command => ({ do: 'record', text, importance });
export const end = (ending: string): Command => ({ do: 'end', ending });
export const go = (event: string): Command => ({ do: 'goto', event });
export const call = (script: string, args?: Record<string, number | string>): Command => ({ do: 'call', script, args });
export const achieve = (id: string): Command => ({ do: 'achieve', id });
export const iff = (cond: string, then: Command[], otherwise?: Command[]): Command => (otherwise ? { do: 'if', cond, then, else: otherwise } : { do: 'if', cond, then });
