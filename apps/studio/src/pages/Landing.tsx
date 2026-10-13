// 홈: 넷플릭스식 빌보드 + 작품 줄(TOP 10·새 작품·별점·장르별) + 게시판 소식 + 시작 안내.

import { Billboard, Row, TopItem, WorkCard } from '../components/Shelf';
import { useAccount } from '../lib/auth';
import { boardApi, useCommunityVersion, useWorks } from '../lib/community';
import { GENRES, type SortKey, sortWorks } from '../lib/ranking';
import { go, href } from '../lib/router';
import { presetGallery } from './Gallery';

export function Landing() {
  useCommunityVersion();
  const me = useAccount();
  const works = useWorks() ?? [];
  const popular = sortWorks(works, 'popular');
  const latest = sortWorks(works, 'latest');
  const rated = sortWorks(
    works.filter((w) => w.ratingCount > 0),
    'rating',
  );
  const top = popular[0];
  const posts = [...boardApi.list()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const totalPlays = works.reduce((n, w) => n + w.plays, 0);
  const authors = new Set(works.map((w) => w.ownerId)).size;
  const genreRows = GENRES.map((g) => [g, popular.filter((w) => w.genre === g)] as const).filter(([, xs]) => xs.length > 0);

  const toGallery = (genre: string, sort?: SortKey) => {
    presetGallery({ genre, sort });
    go('works');
  };
  const More = ({ genre = '', sort }: { genre?: string; sort?: SortKey }) => (
    <button className="more" onClick={() => toGallery(genre, sort)}>
      모두 보기 ›
    </button>
  );

  return (
    <div className="landing">
      {top ? (
        <Billboard w={top} heading="h1" kicker={<>오늘의 작품 · 인기 1위</>} />
      ) : (
        <div className="billboard empty" />
      )}

      <div className="page rows">
        {popular.length > 0 && (
          <Row title="오늘의 TOP 10" variant="top" more={<More sort="popular" />}>
            {popular.slice(0, 10).map((w, i) => (
              <TopItem key={w.id} w={w} rank={i + 1} />
            ))}
          </Row>
        )}
        <Row title="새로 올라온 작품" more={<More sort="latest" />}>
          {latest.map((w) => (
            <WorkCard key={w.id} w={w} />
          ))}
        </Row>
        {rated.length > 0 && (
          <Row title="별점 높은 작품" more={<More sort="rating" />}>
            {rated.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </Row>
        )}
        {genreRows.map(([g, xs]) => (
          <Row key={g} title={`${g}`} more={<More genre={g} />}>
            {xs.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </Row>
        ))}

        <div className="home-bottom">
          <section className="intro-card">
            <div className="kicker">인터랙티브 소설 창작 플랫폼</div>
            <h2>
              당신의 선택이 한 편의 <em>이야기</em>가 됩니다
            </h2>
            <p>코드 없이 분기형 소설과 인생 시뮬레이션을 쓰고, 창작마당에 올려 독자를 만나세요. 변수, 아이템, 확률, 엔딩까지 — 원고를 쓰듯 규칙을 설계합니다.</p>
            <dl className="hero-stats">
              <div>
                <dt>공개 작품</dt>
                <dd>{works.length}</dd>
              </div>
              <div>
                <dt>작가</dt>
                <dd>{authors}</dd>
              </div>
              <div>
                <dt>누적 플레이</dt>
                <dd>{totalPlays.toLocaleString('ko-KR')}</dd>
              </div>
            </dl>
            <div className="hero-cta">
              <a className="btn primary big" href={me ? href('studio') : href('signup')}>
                {me ? '✎ 내 작업실로' : '무료로 시작하기'}
              </a>
              <a className="btn big ghost" href={href('about')}>
                더 알아보기
              </a>
            </div>
          </section>

          <section className="news-card">
            <div className="section-head">
              <h2>게시판 소식</h2>
              <a className="more" href={href('board')}>
                더 보기 ›
              </a>
            </div>
            <ul className="post-mini">
              {posts.map((p) => (
                <li key={p.id}>
                  <span className={`cat-tag ${p.category === '공지' ? 'notice' : ''}`}>{p.category}</span>
                  <a href={href('board', p.id)}>{p.title}</a>
                  {p.comments.length > 0 && <span className="cmt-count">[{p.comments.length}]</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
