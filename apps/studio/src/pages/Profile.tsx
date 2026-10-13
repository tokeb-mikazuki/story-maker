// 프로필(누구나 볼 수 있음) · 마이페이지 · 회원정보 수정

import type { StoryPackage } from '@engine';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Avatar } from '../components/Account';
import { RatingText, WorkCard, dateLong, genreTone } from '../components/Site';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  AuthError,
  type PublicProfile,
  authApi,
  checkEmail,
  checkNickname,
  checkPassword,
  rules,
  useAccount,
} from '../lib/auth';
import { boardApi, useCommunityVersion, useWorks, worksApi } from '../lib/community';
import { ask, tell } from '../lib/dialog';
import { sortWorks } from '../lib/ranking';
import { go, href } from '../lib/router';
import { type ProjectRecord, LocalMetaStore, projects } from '../lib/storage';
import { SAMPLES, isFanWork } from '../samples';

function NeedLogin() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>로그인이 필요해요</h1>
        <p className="auth-sub">마이페이지와 회원정보는 로그인한 뒤에 볼 수 있습니다.</p>
        <a className="btn primary big" href={href('login')}>
          로그인
        </a>
        <div className="auth-foot">
          <a href={href('signup')}>회원가입</a>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 공개 프로필 ─────────────────────────

export function ProfilePage({ id }: { id: string }) {
  const me = useAccount();
  const v = useCommunityVersion();
  const [profile, setProfile] = useState<PublicProfile | null>();
  useEffect(() => {
    setProfile(undefined);
    void authApi.getProfile(id).then((p) => setProfile(p ?? null));
  }, [id, me?.nickname, me?.bio, me?.avatar]);

  const all = useWorks();
  const works = sortWorks((all ?? []).filter((w) => w.ownerId === id), 'latest');
  const plays = works.reduce((n, w) => n + w.plays, 0);
  const rated = works.filter((w) => w.ratingCount);
  const reviews = rated.reduce((n, w) => n + w.ratingCount, 0);
  const avg = reviews ? rated.reduce((n, w) => n + w.avg * w.ratingCount, 0) / reviews : 0;
  const posts = v >= 0 ? boardApi.list().filter((p) => p.authorId === id) : [];
  const isMe = me?.id === id;

  if (profile === undefined) return <div className="page narrow muted">불러오는 중…</div>;
  if (profile === null)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>찾을 수 없는 프로필</h1>
          <p className="auth-sub">탈퇴했거나 주소가 잘못된 프로필입니다.</p>
          <a className="btn" href={href('works')}>
            창작마당으로
          </a>
        </div>
      </div>
    );

  return (
    <div className="page">
      <header className="profile-hero">
        <Avatar profile={profile} size={104} />
        <div className="profile-info">
          <div className="kicker">{profile.official ? '이야기 공방 공식 계정' : '작가'}</div>
          <h1>
            {profile.nickname}
            {profile.official && <span className="official-badge">공식</span>}
          </h1>
          <p className="profile-bio">{profile.bio || (isMe ? '아직 소개가 없어요. 회원정보 수정에서 적어 보세요.' : '소개가 없습니다.')}</p>
          <p className="profile-meta">{dateLong(profile.createdAt)} 가입</p>
        </div>
        {isMe && (
          <div className="profile-actions">
            <a className="btn" href={href('me')}>
              마이페이지
            </a>
            <a className="btn" href={href('me', 'edit')}>
              프로필 수정
            </a>
          </div>
        )}
      </header>

      <div className="stat-row">
        <div>
          <b>{works.length}</b>
          <span>공개 작품</span>
        </div>
        <div>
          <b>{plays.toLocaleString('ko-KR')}</b>
          <span>누적 플레이</span>
        </div>
        <div>
          <b>{reviews ? avg.toFixed(1) : '–'}</b>
          <span>평균 별점{reviews ? ` (${reviews})` : ''}</span>
        </div>
        <div>
          <b>{posts.length}</b>
          <span>게시글</span>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>공개한 작품</h2>
        </div>
        {all && works.length === 0 && <p className="empty">아직 창작마당에 올린 작품이 없어요.</p>}
        <div className="work-grid">
          {works.map((w) => (
            <WorkCard key={w.id} w={w} />
          ))}
        </div>
      </section>

      {posts.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>최근 게시글</h2>
            <a className="more" href={href('board')}>
              게시판 →
            </a>
          </div>
          <ul className="post-mini">
            {posts.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className="cat-tag">{p.category}</span>
                <a href={href('board', p.id)}>{p.title}</a>
                {p.comments.length > 0 && <span className="cmt-count">[{p.comments.length}]</span>}
                <span className="muted small">{dateLong(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ───────────────────────── 마이페이지 ─────────────────────────

export function MyPage() {
  const me = useAccount();
  const [list, setList] = useState<ProjectRecord[]>();
  const reload = () => projects.list().then(setList);
  useEffect(() => {
    void reload();
  }, [me?.id]);
  const all = useWorks();
  if (!me) return <NeedLogin />;

  const mine = list?.filter((p) => p.ownerId === me.id) ?? [];
  const guest = list?.filter((p) => !p.ownerId) ?? [];
  const published = sortWorks((all ?? []).filter((w) => w.ownerId === me.id), 'latest');
  const publishedIds = new Set(published.map((w) => w.id));

  // 이 브라우저의 플레이 기록(작품별 회차·본 엔딩)
  const metaStore = new LocalMetaStore();
  const titles = new Map<string, StoryPackage['meta']>();
  for (const s of SAMPLES) if (!isFanWork(s.meta.id)) titles.set(s.meta.id, s.meta);
  for (const p of list ?? []) titles.set(p.id, p.pkg.meta);
  for (const w of all ?? []) if (!titles.has(w.id)) titles.set(w.id, { id: w.id, title: w.title });
  const played = [...titles.values()]
    .map((m) => ({ meta: m, rec: metaStore.load(m.id) }))
    .filter((x) => x.rec && x.rec.runs > 0) as { meta: StoryPackage['meta']; rec: NonNullable<ReturnType<LocalMetaStore['load']>> }[];
  const totalRuns = played.reduce((n, x) => n + x.rec.runs, 0);
  const totalEndings = played.reduce((n, x) => n + Object.keys(x.rec.endings).length, 0);
  const myReviews = (all ?? []).flatMap((w) => worksApi.reviews(w.id).filter((r) => r.userId === me.id).map((r) => ({ w, r })));

  return (
    <div className="page">
      <header className="profile-hero">
        <Avatar profile={me} size={88} />
        <div className="profile-info">
          <div className="kicker">마이페이지</div>
          <h1>{me.nickname}</h1>
          <p className="profile-meta">
            @{me.loginId} · {me.email}
          </p>
          <p className="profile-bio">{me.bio || '아직 소개가 없어요.'}</p>
        </div>
        <div className="profile-actions">
          <a className="btn" href={href('u', me.id)}>
            내 프로필 보기
          </a>
          <a className="btn primary" href={href('me', 'edit')}>
            회원정보 수정
          </a>
        </div>
      </header>

      <div className="stat-row">
        <div>
          <b>{mine.length}</b>
          <span>내 작업</span>
        </div>
        <div>
          <b>{published.length}</b>
          <span>창작마당에 올린 작품</span>
        </div>
        <div>
          <b>{totalRuns}</b>
          <span>플레이 횟수</span>
        </div>
        <div>
          <b>{totalEndings}</b>
          <span>본 엔딩</span>
        </div>
      </div>

      {guest.length > 0 && (
        <div className="claim-box">
          <div>
            <strong>로그인 전에 만든 작업이 {guest.length}개 있어요</strong>
            <small>내 계정으로 옮기면 「내 작업」에 모이고 창작마당에 올릴 수 있어요.</small>
          </div>
          <button
            className="btn primary"
            onClick={async () => {
              const n = await projects.claimGuest(me.id);
              await reload();
              void tell(`${n}개의 작업을 내 계정으로 옮겼습니다.`);
            }}
          >
            내 계정으로 옮기기
          </button>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>
            내 작업 <span className="count-pill">{mine.length}</span>
          </h2>
          <a className="more" href={href('studio')}>
            내 작업실 →
          </a>
        </div>
        {list && mine.length === 0 && (
          <p className="empty">
            아직 이 계정으로 만든 작품이 없어요. <a href={href('studio')}>내 작업실에서 새로 만들어 보세요.</a>
          </p>
        )}
        <ul className="row-list">
          {mine.map((p) => (
            <li key={p.id}>
              <span className="genre-dot" style={{ background: genreTone(published.find((w) => w.id === p.id)?.genre ?? '기타') }} />
              <div className="row-main">
                <b>{p.pkg.meta.title}</b>
                <small className="muted">
                  {p.pkg.settings.mode === 'life' ? '인생형' : '이야기형'} · 이벤트 {p.pkg.events.length} · 엔딩 {p.pkg.endings.length} · 수정 {new Date(p.updatedAt).toLocaleString('ko-KR')}
                </small>
              </div>
              {publishedIds.has(p.id) ? <span className="status-pill on">공개 중</span> : <span className="status-pill">비공개</span>}
              <a className="btn small primary" href={href('edit', p.id)}>
                편집
              </a>
              <a className="btn small" href={href('play', p.id)}>
                플레이
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>
            창작마당에 올린 작품 <span className="count-pill">{published.length}</span>
          </h2>
        </div>
        {all && published.length === 0 && <p className="empty">편집기의 「내보내기 → 창작마당에 올리기」에서 작품을 공개할 수 있어요.</p>}
        <ul className="row-list">
          {published.map((w) => (
            <li key={w.id}>
              <span className="genre-dot" style={{ background: genreTone(w.genre) }} />
              <div className="row-main">
                <a href={href('works', w.id)}>
                  <b>{w.title}</b>
                </a>
                <small className="muted">
                  {w.genre} · ▶ {w.plays.toLocaleString('ko-KR')}
                </small>
              </div>
              <RatingText w={w} />
            </li>
          ))}
        </ul>
      </section>

      <div className="two-col">
        <section className="section">
          <div className="section-head">
            <h2>
              플레이 기록 <span className="count-pill">{played.length}</span>
            </h2>
          </div>
          {played.length === 0 ? (
            <p className="empty">아직 플레이한 작품이 없어요.</p>
          ) : (
            <ul className="played-list">
              {played.map(({ meta, rec }) => (
                <li key={meta.id}>
                  <a href={href('play', meta.id)}>{meta.title}</a>
                  <span>
                    {rec.runs}회 · 엔딩 {Object.keys(rec.endings).length}종
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="section">
          <div className="section-head">
            <h2>
              내가 남긴 리뷰 <span className="count-pill">{myReviews.length}</span>
            </h2>
          </div>
          {myReviews.length === 0 ? (
            <p className="empty">플레이한 작품에 별점을 남겨 보세요.</p>
          ) : (
            <ul className="played-list">
              {myReviews.map(({ w, r }) => (
                <li key={w.id}>
                  <a href={href('works', w.id)}>{w.title}</a>
                  <span className="stars-text">{'★'.repeat(r.score)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── 회원정보 수정 ─────────────────────────

export function AccountEditPage() {
  const me = useAccount();
  if (!me) return <NeedLogin />;
  return (
    <div className="page narrow">
      <div className="page-title">
        <a className="muted small" href={href('me')}>
          ← 마이페이지
        </a>
        <h1>회원정보 수정</h1>
      </div>
      <ProfileForm />
      <EmailForm />
      <PasswordForm />
      <DeleteForm />
    </div>
  );
}

function Panel({ title, sub, children, danger }: { title: string; sub?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`edit-panel ${danger ? 'danger' : ''}`}>
      <h2>{title}</h2>
      {sub && <p className="muted small">{sub}</p>}
      {children}
    </section>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`auth-field ${error ? 'bad' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <em role="alert">{error}</em> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function useSave() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setDone(false);
    try {
      await fn();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setErrors({ [e instanceof AuthError ? (e.field ?? '_') : '_']: e instanceof Error ? e.message : '문제가 생겼습니다' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, done, run };
}

function ProfileForm() {
  const me = useAccount()!;
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio);
  const [avatar, setAvatar] = useState(me.avatar);
  const { busy, errors, done, run } = useSave();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authApi.updateProfile(me.id, { nickname, bio, avatar });
    });
  };
  const dirty = nickname !== me.nickname || bio !== me.bio || avatar.emoji !== me.avatar.emoji || avatar.color !== me.avatar.color;
  return (
    <Panel title="프로필" sub="다른 사람이 내 작품과 프로필에서 보게 되는 정보입니다.">
      <form onSubmit={submit} noValidate>
        <div className="avatar-editor">
          <Avatar profile={{ nickname, avatar }} size={72} />
          <div>
            <div className="swatches" role="radiogroup" aria-label="프로필 색">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={avatar.color === c} className={avatar.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setAvatar({ ...avatar, color: c })} aria-label={c} />
              ))}
            </div>
            <div className="emoji-pick" role="radiogroup" aria-label="프로필 그림">
              {AVATAR_EMOJIS.map((em) => (
                <button key={em} type="button" role="radio" aria-checked={avatar.emoji === em} className={avatar.emoji === em ? 'on' : ''} onClick={() => setAvatar({ ...avatar, emoji: em })}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Field label="닉네임" error={errors.nickname ?? (nickname !== me.nickname ? checkNickname(nickname) : undefined)} hint={rules.nickname}>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>
        <Field label="소개" hint={`${bio.length}/200`}>
          <textarea rows={3} maxLength={200} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="어떤 이야기를 만드는지 적어 보세요" />
        </Field>
        <div className="form-actions">
          <button className="btn primary" disabled={busy || !dirty}>
            {busy ? '저장 중…' : '저장'}
          </button>
          {done && <span className="saved-note">저장했어요</span>}
          {errors._ && <span className="auth-error">{errors._}</span>}
        </div>
      </form>
    </Panel>
  );
}

function EmailForm() {
  const me = useAccount()!;
  const [email, setEmail] = useState(me.email);
  const { busy, errors, done, run } = useSave();
  const bad = email !== me.email ? checkEmail(email) : undefined;
  return (
    <Panel title="이메일" sub="아이디·비밀번호를 찾을 때 쓰입니다.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => void (await authApi.updateProfile(me.id, { email })));
        }}
        noValidate
      >
        <Field label="이메일" error={errors.email ?? bad}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button className="btn primary" disabled={busy || email === me.email || !!bad}>
            {busy ? '저장 중…' : '이메일 바꾸기'}
          </button>
          {done && <span className="saved-note">바꿨어요</span>}
        </div>
      </form>
    </Panel>
  );
}

function PasswordForm() {
  const me = useAccount()!;
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const { busy, errors, done, run } = useSave();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const mismatch = f.again && f.next !== f.again ? '새 비밀번호가 서로 다릅니다' : undefined;
  return (
    <Panel title="비밀번호 변경">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (f.next !== f.again) throw new AuthError('새 비밀번호가 서로 다릅니다', 'again');
            await authApi.changePassword(me.id, f.current, f.next);
            setF({ current: '', next: '', again: '' });
          });
        }}
        noValidate
      >
        <Field label="현재 비밀번호" error={errors.current}>
          <input type="password" autoComplete="current-password" value={f.current} onChange={set('current')} />
        </Field>
        <Field label="새 비밀번호" error={errors.password ?? (f.next ? checkPassword(f.next) : undefined)} hint={rules.password}>
          <input type="password" autoComplete="new-password" value={f.next} onChange={set('next')} />
        </Field>
        <Field label="새 비밀번호 확인" error={errors.again ?? mismatch}>
          <input type="password" autoComplete="new-password" value={f.again} onChange={set('again')} />
        </Field>
        <div className="form-actions">
          <button className="btn primary" disabled={busy || !f.current || !f.next || !f.again}>
            {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </button>
          {done && <span className="saved-note">바꿨어요</span>}
          {errors._ && <span className="auth-error">{errors._}</span>}
        </div>
      </form>
    </Panel>
  );
}

function DeleteForm() {
  const me = useAccount()!;
  const [pw, setPw] = useState('');
  const { busy, errors, run } = useSave();
  return (
    <Panel title="계정 삭제" sub="계정과 프로필, 창작마당에 올린 작품, 게시글·댓글·리뷰가 사라집니다. 이 브라우저의 작업 파일은 남지만 계정과의 연결은 끊어져요." danger>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!(await ask('정말 계정을 삭제할까요? 창작마당에 올린 작품과 게시글·리뷰도 함께 사라집니다. 되돌릴 수 없습니다.', '삭제', true))) return;
            await authApi.deleteAccount(me.id, pw);
            await worksApi.removeByOwner(me.id);
            boardApi.removeByAuthor(me.id);
            go();
          });
        }}
        noValidate
      >
        <Field label="비밀번호 확인" error={errors.password}>
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <button className="btn danger" disabled={busy || !pw}>
          {busy ? '삭제 중…' : '계정 삭제'}
        </button>
      </form>
    </Panel>
  );
}
