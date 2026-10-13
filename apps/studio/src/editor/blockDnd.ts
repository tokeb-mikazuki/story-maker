// 블록 순서 옮기기(끌어 놓기). HTML5 드래그는 dataTransfer에 객체를 실을 수 없어 끌고 있는 블록을 모듈 변수에 둔다.

import type { Command } from '@engine';
import { type DragEvent, useState } from 'react';

/** 이미 놓인 블록 옮기기. cmd는 현재 패키지 안의 그 객체(위치를 찾는 데 쓴다) */
export type Drag = { kind: 'move'; cmd: Command; el?: HTMLElement };

let current: Drag | undefined;

export function startDrag(e: DragEvent, d: Drag): void {
  e.stopPropagation();
  current = d;
  e.dataTransfer.setData('text/plain', 'block');
  e.dataTransfer.effectAllowed = 'move';
  // 드롭 칸을 넓히는 건 다음 프레임에(바로 바꾸면 크롬이 드래그를 취소한다)
  requestAnimationFrame(() => document.body.classList.add('dragging-block'));
}

export function endDrag(): void {
  current = undefined;
  document.body.classList.remove('dragging-block');
}

if (typeof window !== 'undefined') window.addEventListener('dragend', endDrag);

/** 드롭 받는 곳. accepts가 거짓이면 반응하지 않는다 */
export function useDrop(onDrop: (d: Drag) => void, accepts: (d: Drag) => boolean) {
  const [over, setOver] = useState(false);
  const ok = (e: DragEvent) => {
    if (!current || !accepts(current)) return false;
    // 블록을 자기 안으로 넣을 수는 없다
    if (current.el?.contains(e.currentTarget as globalThis.Node)) return false;
    return true;
  };
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!ok(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        if (!ok(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const d = current!;
        endDrag();
        onDrop(d);
      },
    },
  };
}

/** 패키지에서 객체의 경로를 찾는다(참조 비교) */
export function findPath(root: unknown, target: unknown, path: (string | number)[] = []): (string | number)[] | undefined {
  if (root === target) return path;
  if (Array.isArray(root)) {
    for (let i = 0; i < root.length; i++) {
      const p = findPath(root[i], target, [...path, i]);
      if (p) return p;
    }
  } else if (root && typeof root === 'object') {
    for (const [k, v] of Object.entries(root)) {
      if (v && typeof v === 'object') {
        const p = findPath(v, target, [...path, k]);
        if (p) return p;
      }
    }
  }
  return undefined;
}
