// 에디터에서 이벤트를 부르는 이름. 작가가 정한 ID가 있으면 ID, 없으면 제목, 그것도 없으면 본문 첫머리.
// ID는 에디터에서만 보이고 플레이어에게는 나오지 않는다.

/** 새 이벤트에 자동으로 붙는 ID(event, event_2…). 작가가 ID를 정하지 않은 것으로 본다 */
export const AUTO_EVENT_ID = /^event(_\d+)?$/;

export function hasEventId(e: { id: string } | undefined): boolean {
  return !!e && !AUTO_EVENT_ID.test(e.id);
}

export function eventLabel(e: { id: string; title?: string; text?: string } | undefined, fallback = ''): string {
  if (!e) return fallback;
  if (hasEventId(e)) return e.id;
  if (e.title?.trim()) return e.title;
  const t = (e.text ?? '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 18 ? `${t.slice(0, 18)}…` : t;
  return `(빈 장면 · ${e.id})`;
}
