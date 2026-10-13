// 혼자 실행되는 HTML 파일: 플레이어 틀(player.html)에 작품 JSON을 끼워 넣는다.

import type { StoryPackage } from '@engine';
import { forExport } from './remix';

/** 편집기 빌드 때 같이 만들어 두는 틀. 개발 서버처럼 만들지 않았으면 없다 */
const templates = import.meta.glob('../generated/player.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const standaloneTemplate = (): string | undefined => Object.values(templates)[0];

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** <script> 안에 안전하게 넣을 JSON */
export function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function buildStandaloneHtml(pkg: StoryPackage, template: string): string {
  const out = forExport(pkg);
  return template
    .replace('__STORY_TITLE__', () => escapeHtml(out.meta.title))
    .replace('__STORY_DESCRIPTION__', () => escapeHtml((out.meta.description ?? '').slice(0, 200)))
    .replace('__STORY_DATA__', () => inlineJson(out));
}
