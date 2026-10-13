// 샘플 ④ 이야기형 장편 — 「청화고 연애 금지령」 (오리지널 러브코미디)
// 스물네 주의 학기, 풍기 부회장·소꿉친구·연극부 에이스·도서부 선배·신문부 기자·단짝 친구 그리고 고양이.
// 보여 주는 기능: 이름 묻기, 주 단위 턴 구조(고정 장면 → 일상 → 인연 → 사건 → 방과 후 메뉴), 고정 이벤트(한 주에 하나씩),
// 호감 변수 5개와 숨은 수치(진심·허세), 조건으로 열리는 인연 장면, 이어지는 선택지(대화 사슬), 판정과 직접 확률(고백 성공률),
// 아이템(사용·보정·선물), 상태(지속 턴·보정·만료 효과), 스크립트(매개변수), 감시 규칙(위기 이벤트), 위기가 두 번이면 엔딩,
// 일러스트 6장 슬롯, 엔딩 16종, 조건부 결산, 인생표, 도전과제, 메타 변수.

import type { StoryPackage } from '@engine';
import { achievements, assets, endings, epilogue, items, meta, scripts, settings, statuses, triggers, variables } from './base';
import { actions } from './actions';
import { chars } from './eventsChars';
import { daily, trouble } from './eventsDaily';
import { finale } from './eventsFinale';
import { mainA } from './eventsMainA';
import { mainB } from './eventsMainB';

export const loveComedy: StoryPackage = {
  format: 'ifb/1',
  meta,
  settings,
  variables,
  items,
  statuses,
  scripts,
  triggers,
  events: [...mainA, ...mainB, ...finale, ...daily, ...trouble, ...chars],
  actions,
  endings,
  epilogue,
  achievements,
  assets,
};
