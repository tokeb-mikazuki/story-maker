import type { StoryPackage } from '@engine';
import { createContext, useContext } from 'react';

export interface EditorApi {
  pkg: StoryPackage;
  /** immer 초안을 고치는 함수 */
  update: (fn: (draft: StoryPackage) => void) => void;
  /** 다음 수정을 되돌리기의 새 단계로 시작한다(연속 타이핑 묶음을 끊음) */
  checkpoint: () => void;
  /** 섹션/항목으로 이동 */
  open: (section: string, item?: string) => void;
  /** 테스트 플레이(특정 이벤트부터) */
  test: (eventId?: string) => void;
  /** 자세히 모드: 모든 메뉴, 세부 설정을 펼친 채로 */
  detail: boolean;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error('EditorContext 없음');
  return api;
}
