/**
 * 이름 주머니. 성씨 없이 이름만 담은 무작위 이름 후보.
 * 게임 전체의 이름 스타일로 쓰거나, 출신마다 다르게 지정할 수 있다.
 * 주머니마다 남자 / 여자 / 중성적 이름으로 나뉜다.
 */
export type NameStyleId = 'korean' | 'japanese' | 'chinese' | 'european' | 'arabic' | 'fantasy';
export type NameGender = 'male' | 'female' | 'neutral';

export const NAME_GENDERS: { id: NameGender; label: string; word: string }[] = [
  { id: 'male', label: '남자 이름', word: '남자' },
  { id: 'female', label: '여자 이름', word: '여자' },
  { id: 'neutral', label: '중성적 이름', word: '중성' },
];

export interface NameStyle {
  id: NameStyleId;
  label: string;
  male: string[];
  female: string[];
  neutral: string[];
  /** 세 묶음을 합친 것 */
  names: string[];
}

const split = (s: string) => s.split(/[\s,]+/).filter(Boolean);

function style(id: NameStyleId, label: string, male: string, female: string, neutral: string): NameStyle {
  const m = split(male);
  const f = split(female);
  const n = split(neutral);
  return { id, label, male: m, female: f, neutral: n, names: [...m, ...f, ...n] };
}

export const NAME_STYLES: NameStyle[] = [
  style(
    'korean',
    '한국식 이름 주머니',
    `서준 도윤 시우 예준 하준 주원 지호 지후 준우 현우 도현 건우 우진 선우 민준 은우 유찬 정우 승현 태오
     태윤 강민 도영 성민 규민 재윤 상우 영훈 태민 석진 동하 주안 병철 영수 철수 춘식 만복 용팔 덕배 갑돌`,
    `서윤 하윤 수아 아린 서연 다은 채원 민서 유나 소율 지유 하은 나윤 시은 예린 수빈 하린 윤서 은서 나래
     아름 단비 서아 이슬 미소 은별 초롱 보라 예솔 새봄 소망 순이 말순 영희 점순 봉선 금옥 막례 옥분 순덕`,
    `지우 지안 가온 연우 이안 라온 재이 해원 지민 보람 한결 다온 시현 세진 현서 유진 하늘 진서 가을 두리`,
  ),
  style(
    'japanese',
    '일본식 이름 주머니',
    `하루토 소타 리쿠 렌 이츠키 다이키 유토 코타로 쇼 켄타 하야토 타쿠미 신 유마 료 슌 나오키 겐지 히로시 다케시
     마사토 타로 코지 카즈키 카이토 요시오 가이 사토시 도모야 유스케 히데오 타이가 신지 에이지 이사무 고로 쇼타 야스오 다이스케 슈헤이
     소이치로 만지 쇼이치`,
    `히마리 미쿠 사쿠라 유이 리코 메이 아카리 나나미 미오 하루카 아야 카나 노조미 사야 에미 마이 요코 쇼코 하나 미사키
     후미 이쿠미 스즈 마도카 아이 나츠미 리나 치하루 미나 모모카 쿄코 하나에 마리 사키 카오리 노리코 미야 레나 키요 오토하
     하루나 유리 미유`,
    `아오이 치아키 유키 아키라 레이 유우 세이 쓰바사 히로 후유 아사히 나기 이오리 아키`,
  ),
  style(
    'chinese',
    '중국식 이름 주머니',
    `웨이 하오란 쯔한 위천 자오양 천위 쯔웨이 샤오밍 하오 쥔제 보원 즈하오 샤오웨이 톈위 원하오 리밍 즈웨이 샤오룽 보하오 밍위
     쿤 쥔시 완룽 진위 샤오천 웨이밍 다웨이 샤오바오 리쥔 샤오펑 하이타오 쥔량 원지 샤오둥 광밍 정하오 윈펑 룽하오 훙웨이 하오위
     밍하오 천하오 쥔웨이 하이룬 샤오양`,
    `시옌 멍야오 메이링 루오시 슈잉 위팅 잉잉 야오 하이옌 이페이 쯔위 슈란 신이 지아 팅팅 샤오훙 아이링 신루 샤오란 후이란
     징이 리화 보야 위쉬안 메이후이 야팅 리링 위페이 슈민 안란 이쉬안 쑤란 샤오쉰 웨이란 쯔링 야란 멍란`,
    `이난 칭윈 쉬안 후이 위안 쯔이 위화 이탕 징위 쯔시 천시 샤오룬 쯔안 제이 시아오 징원 위탕 지에`,
  ),
  style(
    'european',
    '유럽식 이름 주머니',
    `마티아스 루카스 레오 안톤 펠릭스 오스카 율리안 에밀 프리드리히 헨리크 파블로 마르코 세바스티안 한스 조르주 이반 올레그 에릭 올라프 라파엘
     발터 필리프 로렌초 마누엘 테오 콘라드 토마스 루이 하인리히 파비안 빅토르 다미앵 아르튀르 칼 닐스 에두아르 비센테 디에고 미하일 베른하르트
     아우구스트 스테판 야콥 가스파르 마르첼로`,
    `엠마 소피아 클라라 이사벨 엘레나 아멜리 리자 마르타 카타리나 잉그리드 비올라 카를라 줄리아 아네트 로사 클레망스 엘리자 마리아 베로니카 나타샤
     스베틀라나 아스트리드 프레야 카밀라 헬가 오딜 키아라 이네스 브리지트 마르게리타 샤를로테 에바 로잘리 이리나 헬레나 엘로이즈 리브 소냐 폴린 루시아
     안나 카타 리디아 베아트리체 엘사 니나`,
    `니콜라 도미니크 알렉시 안드레아 아델 얀 가브리엘 로제 이본 사샤 로빈 노엘 카미유`,
  ),
  style(
    'arabic',
    '중동식 이름 주머니',
    `유수프 아흐메드 오마르 칼리드 하산 이브라힘 잘랄 타리크 사미르 라시드 파리스 카림 무스타파 나빌 빌랄 자이드 아민 이드리스 마흐무드 아델
     후세인 아부바크르 자말 술레이만 이스마일 압둘라 와심 하이삼 아크람 말리크 루크만 파이살 하팀 무니르 하미드 아사드 타미르 나세르 카이스 지아드
     사이드 야히아 쿠사이 바심 아슈라프 후자이파 알리 자밀 가산 라피크 자비르 타헤르 오사마`,
    `라일라 파티마 아이샤 자이납 마리암 살마 아미라 다니아 야스민 후다 사라 아므나 라나 하디야 수하일라 와파 라와 샤히다 나디아 사피야
     하나 마와 사미라 라니아 잔나 니다 다리아 아지자 살와 자하라 리나 루바 아프라 히바 라미야 아이다 다흐라 샤이마 사나 미르나
     소라야 바시마`,
    `누르 하니 이만 말락 눈 샴스 라함`,
  ),
  style(
    'fantasy',
    '판타지식 이름 주머니',
    `엘리안 카엘 로한 탈론 발더 드레이크 오르페우스 케이론 에이단 라이언 소린 가론 테르논 카시안 에레보스 아슬란 키릴 오베른 드로스 에버렛
     루시안 다에로 볼카르 하르발 크로노 오스왈드 칼리온 사이러스 브란 라그나 오리온 카이로 엘드릭 데미안 하이드 에리온 토르 데이모스`,
    `세라핀 이리스 아르웬 리아나 미라엘 노에미 이솔데 루미나 자라 벨리사 아이린 실비아 오필리아 모르가나 셀레네 니미에 타리아 아넬리 세이렌 루나라
     에이레나 틸다 아델린 피오나 이졸데 포르투나 아스트라 올리비엔 글로리아 벨나 시에라 아이비 알테아 필리스 마라 네레아`,
    `세이르 발라 리안 아우렐 페리안 이슬란 메리디언 아르카 베스퍼 제피르 노바 룬 에이르 셰이드 윈터 세루 파엘 라피스 미스트 레이븐
     솔라 카르멜 오르비스 유리엘 샤르 이그니스`,
  ),
];

export const NAME_STYLE_IDS = NAME_STYLES.map((s) => s.id);

export function nameStyle(id: string | undefined): NameStyle | undefined {
  return id ? NAME_STYLES.find((s) => s.id === id) : undefined;
}

/** 성별에 맞는 후보. gender가 없으면 전부 */
export function nameCandidates(id: string | undefined, gender?: NameGender, exclude?: string[]): string[] {
  const s = nameStyle(id);
  if (!s) return [];
  const list = gender ? s[gender] : s.names;
  if (!exclude?.length) return list;
  const out = list.filter((n) => !exclude.includes(n));
  return out.length ? out : list;
}

export function genderWord(gender: NameGender | undefined): string {
  return NAME_GENDERS.find((g) => g.id === gender)?.word ?? '';
}

/** rand는 0 이상 1 미만의 수를 돌려주는 함수 */
export function pickName(
  id: string | undefined,
  rand: () => number = Math.random,
  gender?: NameGender,
  exclude?: string[],
): string | undefined {
  const list = nameCandidates(id, gender, exclude);
  if (!list.length) return undefined;
  return list[Math.floor(rand() * list.length)];
}
