// 플레이 화면 꾸미기: 색 묶음(프리셋)을 고르거나 색을 하나씩 바꾼다. 아래 미리보기에 바로 보인다.

import type { CSSProperties } from 'react';
import { THEME_KEYS, THEME_PRESETS, fullTheme, presetOf } from '../../lib/themes';
import { useEditor } from '../context';
import { Section } from '../fields';

export function ThemeSection() {
  const { pkg, update } = useEditor();
  const theme = pkg.settings.ui?.theme;
  const active = presetOf(theme);
  const full = fullTheme(theme);

  const setTheme = (next: Record<string, string>) =>
    update((d) => {
      const ui = (d.settings.ui ??= {});
      if (Object.keys(next).length) ui.theme = { ...next };
      else delete ui.theme;
    });

  return (
    <Section title="화면 색 (테마)" help="플레이 화면의 분위기를 바꿉니다. 색 묶음을 고르거나, 아래에서 색을 하나씩 바꿀 수 있습니다.">
      <div className="theme-presets" role="radiogroup" aria-label="색 묶음">
        {THEME_PRESETS.map((p) => {
          const t = fullTheme(p.theme);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active?.id === p.id}
              className={`theme-preset ${active?.id === p.id ? 'on' : ''}`}
              onClick={() => setTheme(p.theme)}
            >
              <span className="theme-swatch" style={{ background: t['--paper'], borderColor: t['--line'] }}>
                <i style={{ background: t['--ink'] }} />
                <i style={{ background: t['--accent'] }} />
              </span>
              {p.name}
            </button>
          );
        })}
        {!active && <span className="theme-preset on custom">직접 고른 색</span>}
      </div>

      <div className="theme-colors">
        {THEME_KEYS.map((k) => (
          <label key={k.key} className="theme-color">
            <input type="color" value={toHex(full[k.key], k.fallback)} onChange={(e) => setTheme({ ...(theme ?? {}), [k.key]: e.target.value })} />
            <span>{k.label}</span>
          </label>
        ))}
        {theme && Object.keys(theme).length > 0 && (
          <button type="button" className="link small" onClick={() => setTheme({})}>
            처음 색으로
          </button>
        )}
      </div>

      <div className="theme-preview" style={full as CSSProperties} aria-label="미리보기">
        <div className="tp-hud">
          <span className="tp-muted">체력</span>
          <span className="tp-bar">
            <span className="tp-fill" />
          </span>
          <span className="tp-muted">은화</span>
          <strong>30</strong>
        </div>
        <p className="tp-text">재가 내립니다. 하늘 대신 도시를 덮은 연기 천장 아래로, 가스등 불빛이 번집니다.</p>
        <div className="tp-choice">
          <span className="tp-muted">1</span> 문을 열고 들어간다
        </div>
        <div className="tp-choice off">
          <span className="tp-muted">2</span> 지하로 내려간다 <em>필요: 뼈 열쇠</em>
        </div>
      </div>
    </Section>
  );
}

/** type=color는 #rrggbb만 받는다 */
function toHex(v: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
