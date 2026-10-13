// 브라우저 저장소를 못 쓰는 환경(샌드박스 iframe, 사생활 보호 모드, 저장소 차단)에서도 앱이 멈추지 않게 감싼다.
// 접근 자체가 예외를 던지면 이 탭에서만 유지되는 메모리 저장소로 대신한다.

interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function guard(pick: () => Storage): KV & { volatile: () => boolean } {
  const fallback = memoryStore();
  let real: Storage | null | undefined;
  const get = (): Storage | null => {
    if (real !== undefined) return real;
    try {
      const s = pick();
      const probe = '__probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      real = s;
    } catch {
      real = null;
    }
    return real;
  };
  return {
    getItem: (k) => {
      const s = get();
      if (!s) return fallback.getItem(k);
      try {
        return s.getItem(k);
      } catch {
        return fallback.getItem(k);
      }
    },
    setItem: (k, v) => {
      const s = get();
      if (!s) return fallback.setItem(k, v);
      // 용량 초과는 부르는 쪽에서 알 수 있게 그대로 던진다
      s.setItem(k, v);
    },
    removeItem: (k) => {
      const s = get();
      if (!s) return fallback.removeItem(k);
      try {
        s.removeItem(k);
      } catch {
        fallback.removeItem(k);
      }
    },
    volatile: () => get() === null,
  };
}

export const local = guard(() => window.localStorage);
export const session = guard(() => window.sessionStorage);
