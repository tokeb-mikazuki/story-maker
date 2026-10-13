import type { StoryPackage } from '@engine';
import { ashPawn } from './ashPawn';
import { chain } from './chain';
import { buildCity984 } from './city984';
import { lighthouse } from './lighthouse';
import { loveComedy } from './loveComedy';
import { saltIsle } from './saltIsle';

/** 우리가 쓴 오리지널 샘플 — 공개 서비스에 그대로 실어도 된다 */
const ORIGINALS: StoryPackage[] = [saltIsle, lighthouse, ashPawn, loveComedy, chain];

/**
 * 원작 IP가 있는 세계관의 팬 창작 샘플. 비공개 테스트 빌드에서만 들어간다.
 * 공개 배포 빌드는 VITE_PUBLIC_RELEASE=1 로 빌드한다 — 이 값은 빌드 때 상수로 바뀌므로
 * 팬 창작 모듈은 쓰이지 않는 코드가 되어 번들에서 통째로 빠진다.
 */
export const FAN_WORKS: StoryPackage[] = import.meta.env.VITE_PUBLIC_RELEASE === '1' ? [] : [buildCity984()];

export const SAMPLES: StoryPackage[] = [...ORIGINALS, ...FAN_WORKS];

export const isFanWork = (id: string) => FAN_WORKS.some((s) => s.meta.id === id);
