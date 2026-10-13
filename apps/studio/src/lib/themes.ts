// 플레이 화면 테마: 작품 설정(settings.ui.theme)에 CSS 색 변수로 저장한다.
// 비어 있으면 기본(밝은 종이) 색을 쓴다.

export const THEME_KEYS = [
  { key: '--paper', label: '배경', fallback: '#fbf8f2' },
  { key: '--ink', label: '글자', fallback: '#2b2620' },
  { key: '--panel', label: '선택지·창', fallback: '#ffffff' },
  { key: '--line', label: '테두리', fallback: '#ded6c7' },
  { key: '--muted', label: '흐린 글자', fallback: '#7a705f' },
  { key: '--accent', label: '강조색', fallback: '#b5523b' },
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number]['key'];
export type Theme = Partial<Record<ThemeKey, string>>;

export interface ThemePreset {
  id: string;
  name: string;
  /** 비어 있으면 기본 색 */
  theme: Theme;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'paper', name: '밝은 종이', theme: {} },
  { id: 'sepia', name: '낡은 책', theme: { '--paper': '#f1e6cf', '--ink': '#3b2f1f', '--panel': '#f8f0dd', '--line': '#cdbb97', '--muted': '#8a7551', '--accent': '#9c4a22' } },
  { id: 'night', name: '어두운 밤', theme: { '--paper': '#17131c', '--ink': '#e7dfd0', '--panel': '#211c27', '--line': '#3b3243', '--muted': '#9b91a4', '--accent': '#d19a4a' } },
  { id: 'dawn', name: '푸른 새벽', theme: { '--paper': '#0f1a24', '--ink': '#dbe8f2', '--panel': '#162534', '--line': '#2a4156', '--muted': '#8aa4b8', '--accent': '#5fb4d9' } },
  { id: 'ink', name: '먹물', theme: { '--paper': '#0b0b0b', '--ink': '#f4f4f4', '--panel': '#161616', '--line': '#3a3a3a', '--muted': '#a0a0a0', '--accent': '#e0b84a' } },
];

/** 지금 테마와 같은 프리셋(없으면 직접 고른 색) */
export function presetOf(theme: Record<string, string> | undefined): ThemePreset | undefined {
  const t = theme ?? {};
  return THEME_PRESETS.find((p) => {
    const keys = new Set([...Object.keys(p.theme), ...Object.keys(t)]);
    return [...keys].every((k) => (p.theme as Record<string, string>)[k]?.toLowerCase() === t[k]?.toLowerCase());
  });
}

/** 비어 있는 칸은 기본 색으로 채운 전체 테마(미리보기용) */
export function fullTheme(theme: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of THEME_KEYS) out[k.key] = theme?.[k.key] || k.fallback;
  return out;
}
