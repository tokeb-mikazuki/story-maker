// About Us: 무엇을 하는 곳인지, 무엇을 할 수 있는지, 어디까지 왔는지.

import { AuthorLink, PageHead } from '../components/Site';
import { DEVELOPER } from '../lib/auth';
import { href } from '../lib/router';

const FEATURES: [string, string, string][] = [
  ['✒', '원고처럼 쓰는 편집기', '사건, 선택지, 결과를 문장으로 적고 블록으로 조건과 명령을 붙입니다. 간단히/자세히 모드와 집필 모드를 오갈 수 있어요.'],
  ['⚙', 'RPG Maker 수준의 규칙', '변수, 아이템, 상태, 확률 판정, 트리거, 공용 스크립트, 도전과제까지 — 세부 규칙을 직접 설계합니다.'],
  ['⌛', '한 편의 인생도', '0세에서 마지막 날까지 흐르는 인생형 시뮬레이션. 단계별 턴, 연간 행동, 자연사 규칙이 들어 있습니다.'],
  ['❦', '창작마당과 게시판', '완성한 작품을 공개하고 별점·플레이 수로 독자의 반응을 봅니다. 게시판에서 요령을 나눕니다.'],
];

const ROADMAP: [string, string, boolean][] = [
  ['엔진과 검증기', '범용 스키마, 수식, 진행 엔진, 시뮬레이터', true],
  ['편집기와 플레이어', '블록 편집기, 테스트 플레이, 진행 로그, 인생표 이미지', true],
  ['계정과 커뮤니티', '로그인, 프로필, 창작마당(별점·플레이 수·장르), 게시판', true],
  ['서버 연결', '계정·작품·게시글을 모두가 함께 보도록 서버에 저장, 이미지 업로드', false],
  ['운영', '신고·검수, 이용약관(저작권·성인 콘텐츠), 운영 도구', false],
];

export function About() {
  return (
    <div className="page about">
      <PageHead kicker="About Us" title="이야기는 선택으로 완성됩니다">
        이야기 공방은 누구나 인터랙티브 소설을 쓰고 나눌 수 있게 만드는 웹 창작 도구입니다. 코드 대신 문장으로, 설정 파일 대신 원고지로 규칙을 설계합니다.
      </PageHead>

      <blockquote className="manifesto">
        <p>“좋은 갈림길은 독자에게 고민을 남긴다. 우리는 그 고민을 쓰는 사람을 위한 책상을 만든다.”</p>
        <cite>— 이야기 공방 만든 사람들</cite>
      </blockquote>

      <section className="section">
        <div className="section-head">
          <h2>할 수 있는 것</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map(([icon, title, body]) => (
            <div key={title} className="feature">
              <span className="feature-icon" aria-hidden>
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="section">
          <div className="section-head">
            <h2>어디까지 왔나</h2>
          </div>
          <ol className="roadmap">
            {ROADMAP.map(([title, body, done]) => (
              <li key={title} className={done ? 'done' : ''}>
                <b>{title}</b>
                <span>{body}</span>
                <small>{done ? '완료' : '준비 중'}</small>
              </li>
            ))}
          </ol>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>만드는 사람</h2>
          </div>
          <div className="team-card">
            <AuthorLink id={DEVELOPER.id} size={44} />
            <p>{DEVELOPER.bio}</p>
          </div>
          <div className="section-head">
            <h2>자주 묻는 질문</h2>
          </div>
          <dl className="faq">
            <dt>내 작품과 계정은 어디에 저장되나요?</dt>
            <dd>지금은 개발 버전이라 이 브라우저 안에만 저장됩니다. 다른 기기로 옮기려면 편집기의 「내보내기」로 파일을 받아 두세요.</dd>
            <dt>별점과 인기순은 어떻게 정해지나요?</dt>
            <dd>인기순은 플레이 수와 별점 합계를 더한 점수입니다. 별점순은 리뷰가 적은 작품이 맨 위를 차지하지 않도록 보통 점수 쪽으로 보정합니다.</dd>
            <dt>문의는 어디로 하나요?</dt>
            <dd>
              <a href={href('board')}>게시판</a>의 「질문」 분류에 남겨 주세요.
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
