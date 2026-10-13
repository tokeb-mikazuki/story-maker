// 홈: 소개, 인기·새 작품, 장르 바로가기, 게시판 소식.

import type { CSSProperties } from 'react';
import { AuthorLink, BookCover, RatingText, WorkCard, genreTone, timeAgo } from '../components/Site';
import { useAccount } from '../lib/auth';
import { boardApi, useCommunityVersion, useWorks } from '../lib/community';
import { GENRES, sortWorks } from '../lib/ranking';
import { go, href } from '../lib/router';
import { presetGallery } from './Gallery';

export function Landing() {
  useCommunityVersion();
  const me = useAccount();
  const works = useWorks() ?? [];
  const popular = sortWorks(works, 'popular');
  const latest = sortWorks(works, 'latest');
  const top = popular[0];
  const posts = [...boardApi.list()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const totalPlays = works.reduce((n, w) => n + w.plays, 0);
  const authors = new Set(works.map((w) => w.ownerId)).size;
  const toGallery = (genre: string, sort?: 'popular' | 'latest') => {
    presetGallery({ genre, sort });
    go('works');
  };

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-in">
          <div className="hero-copy">
            <div className="kicker">인터랙티브 소설 창작 플랫폼</div>
            <h1>
              당신의 선택이
              <br />
              한 편의 <em>이야기</em>가 됩니다
            </h1>
            <p>
              코드 없이 분기형 소설과 인생 시뮬레이션을 쓰고, 창작마당에 올려 독자를 만나세요. 변수, 아이템, 확률, 엔딩까지 — 원고를 쓰듯 규칙을 설계합니다.
            </p>
            <div className="hero-cta">
              <a className="btn primary big" href={href('works')}>
                창작마당 둘러보기
              </a>
              <a className="btn big ghost" href={href('studio')}>
                ✎ 이야기 쓰기
              </a>
            </div>
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
          </div>
          {top && (
            <a className="hero-feature" href={href('works', top.id)} aria-label={`오늘의 작품: ${top.title}`}>
              <div className="hero-ribbon">오늘의 작품</div>
              <BookCover w={top} size="lg" />
              <div className="hero-feature-cap">
                <b>{top.title}</b>
                <RatingText w={top} />
              </div>
            </a>
          )}
        </div>
      </section>

      <div className="page">
        <section className="section">
          <div className="section-head">
            <h2>지금 인기 있는 작품</h2>
            <button className="more" onClick={() => toGallery('', 'popular')}>
              전체 보기 →
            </button>
          </div>
          <div className="work-grid">
            {popular.slice(0, 4).map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>장르로 찾기</h2>
          </div>
          <div className="genre-shelf">
            {GENRES.map((g) => (
              <button key={g} className="genre-spine" style={{ '--tone': genreTone(g) } as CSSProperties} onClick={() => toGallery(g)}>
                <span>{g}</span>
                <small>{works.filter((w) => w.genre === g).length}편</small>
              </button>
            ))}
          </div>
        </section>

        <div className="two-col wide-left">
          <section className="section">
            <div className="section-head">
              <h2>새로 올라온 작품</h2>
              <button className="more" onClick={() => toGallery('', 'latest')}>
                최신순 →
              </button>
            </div>
            <ul className="latest-list">
              {latest.slice(0, 5).map((w) => (
                <li key={w.id}>
                  <a className="latest-cover" href={href('works', w.id)} tabIndex={-1} aria-hidden>
                    <BookCover w={w} size="sm" />
                  </a>
                  <div>
                    <a className="latest-title" href={href('works', w.id)}>
                      {w.title}
                    </a>
                    <div className="latest-meta">
                      <AuthorLink id={w.ownerId} size={16} />
                      <span className="muted small">
                        {w.genre} · {timeAgo(w.publishedAt)}
                      </span>
                    </div>
                    <p className="latest-desc">{w.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>게시판 소식</h2>
              <a className="more" href={href('board')}>
                더 보기 →
              </a>
            </div>
            <ul className="post-mini boxed">
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

        <section className="section how">
          <div className="section-head">
            <h2>이렇게 만들어요</h2>
          </div>
          <ol className="steps">
            <li>
              <b>쓰기</b>
              <p>인생형·이야기형 틀에서 시작해 사건과 선택지를 원고처럼 적습니다.</p>
            </li>
            <li>
              <b>시험하기</b>
              <p>테스트 플레이와 진행 로그로 분기와 확률이 의도대로 도는지 확인합니다.</p>
            </li>
            <li>
              <b>공개하기</b>
              <p>창작마당에 올려 독자의 플레이 수와 별점, 감상을 받습니다.</p>
            </li>
          </ol>
          <div className="how-cta">
            <a className="btn primary big" href={me ? href('studio') : href('signup')}>
              {me ? '내 작업실로' : '무료로 시작하기'}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
