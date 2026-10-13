// 창작마당 작품 상세: 빌보드(배경 그림·소개·플레이) + 작품 정보 + 별점과 감상 + 관련 작품 줄.

import type { StoryPackage } from '@engine';
import { type FormEvent, useEffect, useState } from 'react';
import { Billboard, Row, WorkCard } from '../components/Shelf';
import { AuthorLink, RatingText, Stars, dateLong, timeAgo } from '../components/Site';
import { useAccount } from '../lib/auth';
import { type WorkSummary, useCommunityVersion, useWorks, worksApi } from '../lib/community';
import { ask } from '../lib/dialog';
import { sortWorks } from '../lib/ranking';
import { href } from '../lib/router';
import { LocalMetaStore } from '../lib/storage';
import { copySample } from './Studio';

export function WorkPage({ id }: { id: string }) {
  const v = useCommunityVersion();
  const [work, setWork] = useState<(WorkSummary & { pkg: StoryPackage }) | null>();
  useEffect(() => {
    let live = true;
    void worksApi.get(id).then((w) => live && setWork(w ?? null));
    return () => {
      live = false;
    };
  }, [id, v]);
  const all = useWorks();

  if (work === undefined) return <div className="page narrow muted">불러오는 중…</div>;
  if (work === null)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>작품을 찾을 수 없어요</h1>
          <p className="auth-sub">작가가 내렸거나 주소가 잘못되었습니다.</p>
          <a className="btn primary big" href={href('works')}>
            창작마당으로
          </a>
        </div>
      </div>
    );

  const record = new LocalMetaStore().load(work.id);
  const more = sortWorks((all ?? []).filter((w) => w.id !== work.id && w.ownerId === work.ownerId), 'popular');
  const similar = sortWorks((all ?? []).filter((w) => w.id !== work.id && w.genre === work.genre && w.ownerId !== work.ownerId), 'popular');

  return (
    <div className="work-page">
      <Billboard
        w={work}
        heading="h1"
        showDesc={false}
        kicker={
          <>
            <a href={href('works')}>창작마당</a> › {work.genre}
          </>
        }
        actions={
          <>
            <a className="nf-btn play" href={href('play', work.id, 'w')}>
              ▶ {record?.runs ? '다시 플레이' : '플레이'}
            </a>
            {work.official && (
              <button className="nf-btn info" onClick={() => copySample(work.pkg)}>
                ✎ 편집기에서 열어 보기
              </button>
            )}
          </>
        }
      />

      <div className="page">
        <section className="work-info">
          <div className="work-info-main">
            {record?.runs ? (
              <div className="my-record">
                <b>내 기록</b>
                <span>
                  {record.runs}회 플레이 · 엔딩 {Object.keys(record.endings).length}/{work.endings}
                </span>
                <i>
                  <b style={{ width: `${work.endings ? (Object.keys(record.endings).length / work.endings) * 100 : 0}%` }} />
                </i>
              </div>
            ) : null}
            {work.description && <p className="work-desc">{work.description}</p>}
          </div>
          <dl className="work-side">
            <div>
              <dt>작가</dt>
              <dd>
                <AuthorLink id={work.ownerId} size={22} />
              </dd>
            </div>
            <div>
              <dt>별점</dt>
              <dd>
                <RatingText w={work} />
              </dd>
            </div>
            <div>
              <dt>장르</dt>
              <dd>
                {work.genre} · {work.mode === 'life' ? '인생형' : '이야기형'}
              </dd>
            </div>
            {work.tags.length > 0 && (
              <div>
                <dt>태그</dt>
                <dd className="tag-line">
                  {work.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt>분량</dt>
              <dd>
                이벤트 {work.events} · 엔딩 {work.endings}
              </dd>
            </div>
            <div>
              <dt>공개일</dt>
              <dd>
                {dateLong(work.publishedAt)}
                {work.updatedAt > work.publishedAt + 60000 && <small className="muted"> (수정 {timeAgo(work.updatedAt)})</small>}
              </dd>
            </div>
          </dl>
        </section>

        <Reviews work={work} />

        {more.length > 0 && (
          <Row
            title="이 작가의 다른 작품"
            more={
              <a className="more" href={href('u', work.ownerId)}>
                프로필 ›
              </a>
            }
          >
            {more.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </Row>
        )}
        {similar.length > 0 && (
          <Row title={`비슷한 ${work.genre} 작품`}>
            {similar.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

function Reviews({ work }: { work: WorkSummary }) {
  const me = useAccount();
  useCommunityVersion();
  const reviews = worksApi.reviews(work.id);
  const mine = me && reviews.find((r) => r.userId === me.id);
  const [score, setScore] = useState(mine?.score ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(mine?.text ?? '');
  const [editing, setEditing] = useState(!mine);
  useEffect(() => {
    setScore(mine?.score ?? 0);
    setText(mine?.text ?? '');
    setEditing(!mine);
  }, [me?.id, work.id]);

  const isOwner = me?.id === work.ownerId;
  const dist = [5, 4, 3, 2, 1].map((s) => [s, reviews.filter((r) => r.score === s).length] as const);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!me || !score) return;
    worksApi.rate(work.id, me.id, score, text);
    setEditing(false);
  };

  return (
    <section className="section reviews">
      <div className="section-head">
        <h2>
          별점과 감상 <span className="count-pill">{reviews.length}</span>
        </h2>
      </div>
      <div className="review-layout">
        <div className="review-summary">
          <div className="big-score">{work.ratingCount ? work.avg.toFixed(1) : '–'}</div>
          <Stars value={work.avg} size={20} />
          <div className="muted small">리뷰 {work.ratingCount}개</div>
          <ul className="dist">
            {dist.map(([s, n]) => (
              <li key={s}>
                <span>{s}점</span>
                <i>
                  <b style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
                </i>
                <span className="muted">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="review-main">
          {!me ? (
            <div className="review-gate">
              <span>별점을 남기려면 로그인해 주세요.</span>
              <a className="btn small primary" href={href('login')}>
                로그인
              </a>
            </div>
          ) : isOwner ? (
            <div className="review-gate muted">내가 올린 작품에는 별점을 남길 수 없어요.</div>
          ) : editing ? (
            <form className="review-form" onSubmit={submit}>
              <div className="star-input" role="radiogroup" aria-label="별점" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={score === s}
                    aria-label={`${s}점`}
                    className={(hover || score) >= s ? 'on' : ''}
                    onMouseEnter={() => setHover(s)}
                    onClick={() => setScore(s)}
                  >
                    ★
                  </button>
                ))}
                <span className="muted small">{score ? `${score}점` : '별을 눌러 점수를 고르세요'}</span>
              </div>
              <textarea rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="한 줄 감상을 남겨 주세요 (선택, 300자)" />
              <div className="form-actions">
                <button className="btn primary" disabled={!score}>
                  {mine ? '수정하기' : '남기기'}
                </button>
                {mine && (
                  <button type="button" className="btn" onClick={() => setEditing(false)}>
                    취소
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="review-gate">
              <span>
                내 별점 <b>{'★'.repeat(mine!.score)}</b>
              </span>
              <button className="btn small" onClick={() => setEditing(true)}>
                수정
              </button>
              <button
                className="btn small danger"
                onClick={async () => {
                  if (await ask('내 별점과 감상을 지울까요?', '지우기', true)) worksApi.unrate(work.id, me.id);
                }}
              >
                삭제
              </button>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="empty">아직 감상이 없어요. 첫 감상을 남겨 보세요.</p>
          ) : (
            <ul className="review-list">
              {reviews.map((r) => (
                <li key={r.userId}>
                  <div className="review-head">
                    <AuthorLink id={r.userId} size={22} />
                    <Stars value={r.score} size={13} />
                    <span className="muted small">{timeAgo(r.at)}</span>
                  </div>
                  {r.text && <p>{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
