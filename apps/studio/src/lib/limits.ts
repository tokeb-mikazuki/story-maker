import { MAX_CHOICES } from '@engine';
import { tell } from './dialog';

/** 선택지를 하나 더 둘 수 있는지. 가득 찼으면 알림을 띄우고 false */
export async function canAddChoice(count: number): Promise<boolean> {
  if (count < MAX_CHOICES) return true;
  await tell(`선택지는 한 화면에 최대 ${MAX_CHOICES}개까지 둘 수 있습니다.`);
  return false;
}

/**
 * 플레이어가 직접 고르는 출신 후보는 한 번에 5개까지. 후보 수(offer)를 5 이하로 정해 두었으면
 * 목록은 더 길어도 된다. 넘으면 알림을 띄우고 false
 */
export async function canAddOrigin(listLength: number, offer?: number): Promise<boolean> {
  if (listLength < MAX_CHOICES || (offer !== undefined && offer <= MAX_CHOICES)) return true;
  await tell(`플레이어가 직접 고르는 출신은 최대 ${MAX_CHOICES}개까지입니다. 무작위 배정으로 바꾸거나 '후보 수'를 ${MAX_CHOICES} 이하로 정해 주세요.`);
  return false;
}
