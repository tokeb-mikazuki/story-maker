import { useEffect, useState } from 'react';

/** #/edit/프로젝트/섹션/항목 형태의 해시 라우팅 */
export function useRoute(): string[] {
  const parse = () =>
    window.location.hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(...parts: (string | undefined)[]): void {
  window.location.hash = '#/' + parts.filter((p): p is string => !!p).map(encodeURIComponent).join('/');
}

export function href(...parts: (string | undefined)[]): string {
  return '#/' + parts.filter((p): p is string => !!p).map(encodeURIComponent).join('/');
}
