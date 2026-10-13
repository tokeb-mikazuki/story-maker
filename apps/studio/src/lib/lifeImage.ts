// 인생표를 PNG로 그린다(외부 라이브러리 없이 canvas로).

import type { EndScene } from '@engine';

const W = 900;
const PAD = 56;
const FONT = '"Pretendard", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch.trimStart();
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export interface LifeImageInput {
  gameTitle: string;
  /** 이름을 쓰지 않는 이야기면 없음 */
  name?: string;
  end: EndScene;
  /** 중요도 이 값 이상만 */
  minImportance?: number;
}

export function renderLifeImage({ gameTitle, name, end, minImportance = 1 }: LifeImageInput): HTMLCanvasElement {
  const entries = end.life.filter((e) => e.importance >= minImportance);
  const measure = document.createElement('canvas').getContext('2d')!;
  const textWidth = W - PAD * 2 - 150;

  // 높이 계산
  measure.font = `17px ${FONT}`;
  const rows = entries.map((e) => ({ e, lines: wrap(measure, e.text, textWidth) }));
  const rowsHeight = rows.reduce((h, r) => h + Math.max(1, r.lines.length) * 26 + 22, 0);
  const achHeight = end.achievements.length ? 60 + Math.ceil(end.achievements.length / 2) * 32 : 0;
  const H = PAD + 150 + rowsHeight + achHeight + 70;

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 배경
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d8cfbd';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // 머리말
  ctx.fillStyle = '#8a7b62';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(gameTitle, PAD, PAD + 4);
  ctx.fillStyle = '#2b2620';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(name ? `${name}의 인생표` : '인생표', PAD, PAD + 50);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = '#6b5f4c';
  ctx.fillText(`결말 — ${end.ending.title}`, PAD, PAD + 84);

  // 타임라인
  let y = PAD + 140;
  const lineX = PAD + 118;
  if (rows.length) {
    ctx.strokeStyle = '#cbbfa6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lineX, y - 6);
    ctx.lineTo(lineX, y + rowsHeight - 26);
    ctx.stroke();
  }
  for (const { e, lines } of rows) {
    ctx.fillStyle = '#8a7b62';
    ctx.font = `600 15px ${FONT}`;
    const when = e.age !== undefined ? `${e.age}세` : `${e.turn + 1}턴`;
    ctx.textAlign = 'right';
    ctx.fillText(when, lineX - 18, y + 14);
    if (e.date) {
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = '#a89a80';
      ctx.fillText(e.date, lineX - 18, y + 32);
    }
    ctx.textAlign = 'left';
    const r = 4 + Math.min(5, e.importance);
    ctx.fillStyle = e.importance >= 4 ? '#b5523b' : '#7d6b4f';
    ctx.beginPath();
    ctx.arc(lineX, y + 9, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2620';
    ctx.font = `${e.importance >= 4 ? 700 : 400} 17px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, lineX + 24, y + 15 + i * 26));
    y += Math.max(1, lines.length) * 26 + 22;
  }
  if (!rows.length) {
    ctx.fillStyle = '#8a7b62';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('기록된 사건이 없습니다.', PAD, y + 10);
  }

  // 도전과제
  if (end.achievements.length) {
    y += 20;
    ctx.fillStyle = '#6b5f4c';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('이번 생에 달성한 도전과제', PAD, y);
    y += 30;
    ctx.font = `15px ${FONT}`;
    end.achievements.forEach((a, i) => {
      const x = PAD + (i % 2) * ((W - PAD * 2) / 2);
      ctx.fillStyle = '#2b2620';
      ctx.fillText(`★ ${a.title}`, x, y + Math.floor(i / 2) * 32);
    });
  }

  ctx.fillStyle = '#b3a68d';
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('이야기 공방', W - PAD, H - 32);
  return canvas;
}
