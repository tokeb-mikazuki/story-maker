// 게시판: 목록(분류·검색·쪽 나눔) · 글 보기(좋아요·댓글) · 글쓰기/고치기.

import { type FormEvent, useEffect, useState } from 'react';
import { AuthorLink, PageHead, dateShort, timeAgo } from '../components/Site';
import { useAccount } from '../lib/auth';
import { BOARD_CATEGORIES, type BoardCategory, type Post, WRITABLE_CATEGORIES, boardApi, useCommunityVersion } from '../lib/community';
import { ask } from '../lib/dialog';
import { go, href } from '../lib/router';
import { nicknameOf } from '../components/Site';

const PER_PAGE = 15;

export function BoardList() {
  useCommunityVersion();
  const me = useAccount();
  const [cat, setCat] = useState<BoardCategory | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const all = boardApi.list();
  const notices = all.filter((p) => p.category === '공지').sort((a, b) => b.createdAt - a.createdAt);
  const needle = q.trim().toLowerCase();
  const rest = all
    .filter((p) => (cat ? p.category === cat : p.category !== '공지'))
    .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle) || nicknameOf(p.authorId).toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const rows = rest.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const pick = (c: BoardCategory | '') => (setCat(c), setPage(1));

  return (
    <div className="page">
      <PageHead
        kicker="게시판"
        title="작가들의 사랑방"
        actions={
          <a className="btn primary" href={me ? href('board', 'new') : href('login')}>
            ✎ 글쓰기
          </a>
        }
      >
        만들다 막힌 점, 찾아낸 요령, 새로 올린 작품 이야기를 나눠요.
      </PageHead>

      <div className="board-tools">
        <div className="tabs-line" role="tablist" aria-label="분류">
          <button type="button" role="tab" aria-selected={!cat} className={!cat ? 'on' : ''} onClick={() => pick('')}>
            전체
          </button>
          {BOARD_CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => pick(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="search-box small">
          <span aria-hidden>⌕</span>
          <input type="search" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="제목·내용·작성자" aria-label="게시글 검색" />
        </div>
      </div>

      <div className="board-table" role="table" aria-label="게시글 목록">
        <div className="board-row head" role="row">
          <span role="columnheader">분류</span>
          <span role="columnheader">제목</span>
          <span role="columnheader">작성자</span>
          <span role="columnheader">날짜</span>
          <span role="columnheader">조회</span>
          <span role="columnheader">좋아요</span>
        </div>
        {!cat && !needle && notices.map((p) => <Row key={p.id} p={p} pinned />)}
        {rows.map((p) => (
          <Row key={p.id} p={p} />
        ))}
        {rows.length === 0 && (cat || needle || notices.length === 0) && <div className="board-empty">{needle ? '검색 결과가 없어요.' : '아직 글이 없어요. 첫 글을 남겨 보세요.'}</div>}
      </div>

      {pages > 1 && (
        <nav className="pager" aria-label="쪽">
          <button disabled={cur === 1} onClick={() => setPage(cur - 1)}>
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} className={n === cur ? 'on' : ''} aria-current={n === cur ? 'page' : undefined} onClick={() => setPage(n)}>
              {n}
            </button>
          ))}
          <button disabled={cur === pages} onClick={() => setPage(cur + 1)}>
            ›
          </button>
        </nav>
      )}
    </div>
  );
}

function Row({ p, pinned }: { p: Post; pinned?: boolean }) {
  const fresh = Date.now() - p.createdAt < 86400000;
  return (
    <div className={`board-row ${pinned ? 'pinned' : ''}`} role="row">
      <span role="cell">
        <span className={`cat-tag ${p.category === '공지' ? 'notice' : ''}`}>{p.category}</span>
      </span>
      <span role="cell" className="title-cell">
        <a href={href('board', p.id)}>{p.title}</a>
        {p.comments.length > 0 && <span className="cmt-count">[{p.comments.length}]</span>}
        {fresh && <span className="new-dot" title="새 글">N</span>}
      </span>
      <span role="cell" className="author-cell">
        <AuthorLink id={p.authorId} size={18} />
      </span>
      <span role="cell" className="muted">
        {fresh ? timeAgo(p.createdAt) : dateShort(p.createdAt)}
      </span>
      <span role="cell" className="muted num">
        <span className="m-label">조회 </span>
        {p.views}
      </span>
      <span role="cell" className="muted num">
        <span className="m-label">♥ </span>
        {p.likes.length}
      </span>
    </div>
  );
}

// ───────────────────────── 글 보기 ─────────────────────────

export function PostPage({ id }: { id: string }) {
  useCommunityVersion();
  const me = useAccount();
  const [comment, setComment] = useState('');
  useEffect(() => boardApi.view(id), [id]);
  const p = boardApi.get(id);
  if (!p)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>글을 찾을 수 없어요</h1>
          <p className="auth-sub">지워졌거나 주소가 잘못되었습니다.</p>
          <a className="btn primary big" href={href('board')}>
            게시판으로
          </a>
        </div>
      </div>
    );
  const mine = me?.id === p.authorId;
  const liked = !!me && p.likes.includes(me.id);
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!me || !comment.trim()) return;
    boardApi.comment(p.id, me.id, comment);
    setComment('');
  };

  return (
    <div className="page narrow">
      <nav className="crumbs">
        <a href={href('board')}>게시판</a>
        <span>›</span>
        <span>{p.category}</span>
      </nav>
      <article className="post">
        <header className="post-head">
          <span className={`cat-tag ${p.category === '공지' ? 'notice' : ''}`}>{p.category}</span>
          <h1>{p.title}</h1>
          <div className="post-meta">
            <AuthorLink id={p.authorId} size={26} />
            <span className="muted small">
              {new Date(p.createdAt).toLocaleString('ko-KR')}
              {p.updatedAt > p.createdAt + 60000 && ' (수정됨)'} · 조회 {p.views}
            </span>
          </div>
        </header>
        <div className="post-body">
          {p.body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>
              {para.split('\n').map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          ))}
        </div>
        <footer className="post-foot">
          <button
            className={`like-btn ${liked ? 'on' : ''}`}
            onClick={() => (me ? boardApi.toggleLike(p.id, me.id) : go('login'))}
            aria-pressed={liked}
            title={me ? '좋아요' : '로그인하면 좋아요를 누를 수 있어요'}
          >
            ♥ {p.likes.length}
          </button>
          <span className="spacer" />
          {mine && (
            <>
              <a className="btn small" href={href('board', p.id, 'edit')}>
                수정
              </a>
              <button
                className="btn small danger"
                onClick={async () => {
                  if (!(await ask('이 글을 지울까요? 댓글도 함께 사라집니다.', '지우기', true))) return;
                  boardApi.remove(p.id, me.id);
                  go('board');
                }}
              >
                삭제
              </button>
            </>
          )}
          <a className="btn small" href={href('board')}>
            목록
          </a>
        </footer>
      </article>

      <section className="comments">
        <h2>
          댓글 <span className="count-pill">{p.comments.length}</span>
        </h2>
        <ul>
          {p.comments.map((c) => (
            <li key={c.id}>
              <div className="comment-head">
                <AuthorLink id={c.authorId} size={22} />
                {c.authorId === p.authorId && <span className="op-badge">글쓴이</span>}
                <span className="muted small">{timeAgo(c.at)}</span>
                {me?.id === c.authorId && (
                  <button
                    className="link small danger"
                    onClick={async () => {
                      if (await ask('댓글을 지울까요?', '지우기', true)) boardApi.removeComment(p.id, c.id, me.id);
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        {me ? (
          <form className="comment-form" onSubmit={send}>
            <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="댓글을 남겨 주세요" />
            <button className="btn primary" disabled={!comment.trim()}>
              등록
            </button>
          </form>
        ) : (
          <div className="review-gate">
            <span>댓글을 쓰려면 로그인해 주세요.</span>
            <a className="btn small primary" href={href('login')}>
              로그인
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────────────────── 글쓰기 / 고치기 ─────────────────────────

export function PostEditor({ id }: { id?: string }) {
  const me = useAccount();
  const prev = id ? boardApi.get(id) : undefined;
  const [category, setCategory] = useState<BoardCategory>(prev?.category ?? '자유');
  const [title, setTitle] = useState(prev?.title ?? '');
  const [body, setBody] = useState(prev?.body ?? '');
  const [error, setError] = useState('');

  if (!me)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>로그인이 필요해요</h1>
          <p className="auth-sub">글을 쓰려면 먼저 로그인해 주세요.</p>
          <a className="btn primary big" href={href('login')}>
            로그인
          </a>
        </div>
      </div>
    );
  if (id && (!prev || prev.authorId !== me.id))
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>고칠 수 없는 글이에요</h1>
          <a className="btn big" href={href('board')}>
            게시판으로
          </a>
        </div>
      </div>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('제목을 적어 주세요');
    if (body.trim().length < 2) return setError('내용을 적어 주세요');
    if (prev) {
      boardApi.update(prev.id, me.id, { category, title, body });
      go('board', prev.id);
    } else go('board', boardApi.create(me.id, { category, title, body }).id);
  };

  return (
    <div className="page narrow">
      <PageHead kicker="게시판" title={prev ? '글 고치기' : '새 글 쓰기'} />
      <form className="post-form" onSubmit={submit} noValidate>
        <div className="post-form-row">
          <select value={category} onChange={(e) => setCategory(e.target.value as BoardCategory)} aria-label="분류">
            {(prev?.category === '공지' ? BOARD_CATEGORIES : WRITABLE_CATEGORIES).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input value={title} maxLength={80} onChange={(e) => (setTitle(e.target.value), setError(''))} placeholder="제목" aria-label="제목" autoFocus />
        </div>
        <textarea className="post-body-input" rows={16} maxLength={5000} value={body} onChange={(e) => (setBody(e.target.value), setError(''))} placeholder="내용을 적어 주세요. 빈 줄로 문단을 나눌 수 있어요." aria-label="내용" />
        <div className="form-actions">
          <span className="muted small">{body.length}/5000</span>
          <span className="spacer" />
          {error && <span className="auth-error">{error}</span>}
          <a className="btn" href={prev ? href('board', prev.id) : href('board')}>
            취소
          </a>
          <button className="btn primary">{prev ? '고치기' : '올리기'}</button>
        </div>
      </form>
    </div>
  );
}
