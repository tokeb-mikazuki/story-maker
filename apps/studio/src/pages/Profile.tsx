// 프로필(누구나 볼 수 있음) · 마이페이지 · 회원정보 수정

import type { StoryPackage } from '@engine';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Avatar, SiteBar } from '../components/Account';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  AuthError,
  type PublicProfile,
  authApi,
  authorOf,
  checkEmail,
  checkNickname,
  checkPassword,
  rules,
  useAccount,
} from '../lib/auth';
import { ask, tell } from '../lib/dialog';
import { go, href } from '../lib/router';
import { type ProjectRecord, LocalMetaStore, projects } from '../lib/storage';
import { SAMPLES, isFanWork } from '../samples';

const dateText = (t: number) => new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

function NeedLogin() {
  return (
    <div className="account-page">
      <SiteBar />
      <main className="auth-card">
        <h1>로그인이 필요해요</h1>
        <p className="auth-sub">마이페이지와 회원정보는 로그인한 뒤에 볼 수 있습니다.</p>
        <a className="btn primary big" href={href('login')}>
          로그인
        </a>
        <div className="auth-foot">
          <a href={href('signup')}>회원가입</a>
        </div>
      </main>
    </div>
  );
}

function WorkCard({ pkg, actions, badge }: { pkg: StoryPackage; actions: ReactNode; badge?: string }) {
  return (
    <div className="card project work-card">
      <div className="card-kind">
        {pkg.settings.mode === 'life' ? '인생형' : '이야기형'}
        {badge && <span className="fan-badge">{badge}</span>}
      </div>
      <h3>{pkg.meta.title}</h3>
      {pkg.meta.description && <p className="work-desc">{pkg.meta.description}</p>}
      <div className="card-meta">
        이벤트 {pkg.events.length} · 엔딩 {pkg.endings.length}
      </div>
      <div className="card-actions">{actions}</div>
    </div>
  );
}

// ───────────────────────── 공개 프로필 ─────────────────────────

export function ProfilePage({ id }: { id: string }) {
  const me = useAccount();
  const [profile, setProfile] = useState<PublicProfile | null>();
  useEffect(() => {
    setProfile(undefined);
    void authApi.getProfile(id).then((p) => setProfile(p ?? null));
  }, [id, me?.nickname, me?.bio, me?.avatar]);

  const isMe = me?.id === id;
  const works = useMemo(() => (id === authorOf().profile.id ? SAMPLES.filter((s) => !isFanWork(s.meta.id)) : []), [id]);

  return (
    <div className="account-page">
      <SiteBar />
      <main className="profile-main">
        {profile === undefined && <p className="muted">불러오는 중…</p>}
        {profile === null && (
          <div className="auth-card">
            <h1>찾을 수 없는 프로필</h1>
            <p className="auth-sub">없어졌거나 주소가 잘못된 프로필입니다.</p>
            <a className="btn" href="#/">
              처음으로
            </a>
          </div>
        )}
        {profile && (
          <>
            <header className="profile-head">
              <Avatar profile={profile} size={96} />
              <div className="profile-info">
                <h1>
                  {profile.nickname}
                  {profile.official && <span className="official-badge">개발팀</span>}
                </h1>
                <p className="profile-bio">{profile.bio || (isMe ? '아직 소개가 없어요. 회원정보 수정에서 적어 보세요.' : '소개가 없습니다.')}</p>
                <p className="profile-meta">{profile.official ? '이야기 공방 공식 계정' : `${dateText(profile.createdAt)} 가입`}</p>
              </div>
              {isMe && (
                <a className="btn" href={href('me', 'edit')}>
                  프로필 수정
                </a>
              )}
            </header>

            <section className="home-section">
              <h2>
                만든 작품 <span className="count-pill">{works.length}</span>
              </h2>
              {works.length === 0 ? (
                <p className="muted">공개한 작품이 아직 없어요. 창작마당이 열리면 이곳에 모입니다.</p>
              ) : (
                <div className="cards">
                  {works.map((s) => (
                    <WorkCard
                      key={s.meta.id}
                      pkg={s}
                      actions={
                        <a className="btn primary" href={href('play', s.meta.id)}>
                          ▶ 플레이
                        </a>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
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
  if (!me) return <NeedLogin />;

  const mine = list?.filter((p) => p.ownerId === me.id) ?? [];
  const guest = list?.filter((p) => !p.ownerId) ?? [];

  // 이 브라우저의 플레이 기록(작품별 회차·본 엔딩)
  const metaStore = new LocalMetaStore();
  const played = [...SAMPLES.filter((s) => !isFanWork(s.meta.id)).map((s) => s.meta), ...(list ?? []).map((p) => p.pkg.meta)]
    .map((m) => ({ meta: m, rec: metaStore.load(m.id) }))
    .filter((x) => x.rec && x.rec.runs > 0) as { meta: StoryPackage['meta']; rec: NonNullable<ReturnType<LocalMetaStore['load']>> }[];
  const totalRuns = played.reduce((n, x) => n + x.rec.runs, 0);
  const totalEndings = played.reduce((n, x) => n + Object.keys(x.rec.endings).length, 0);

  return (
    <div className="account-page">
      <SiteBar />
      <main className="profile-main">
        <header className="profile-head">
          <Avatar profile={me} size={88} />
          <div className="profile-info">
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
            <span>내 작품</span>
          </div>
          <div>
            <b>0</b>
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
              <small>내 계정으로 옮기면 마이페이지의 「내 작품」에 모입니다.</small>
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

        <section className="home-section">
          <h2>
            내 작품 <span className="count-pill">{mine.length}</span>
          </h2>
          {list && mine.length === 0 && (
            <p className="muted">
              아직 이 계정으로 만든 작품이 없어요. <a href="#/">홈에서 새로 만들어 보세요.</a>
            </p>
          )}
          <div className="cards">
            {mine.map((p) => (
              <WorkCard
                key={p.id}
                pkg={p.pkg}
                actions={
                  <>
                    <a className="btn primary" href={href('edit', p.id)}>
                      편집
                    </a>
                    <a className="btn" href={href('play', p.id)}>
                      플레이
                    </a>
                  </>
                }
              />
            ))}
          </div>
        </section>

        <section className="home-section">
          <h2>
            플레이 기록 <span className="count-pill">{played.length}</span>
          </h2>
          {played.length === 0 ? (
            <p className="muted">아직 플레이한 작품이 없어요.</p>
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
      </main>
    </div>
  );
}

// ───────────────────────── 회원정보 수정 ─────────────────────────

export function AccountEditPage() {
  const me = useAccount();
  if (!me) return <NeedLogin />;
  return (
    <div className="account-page">
      <SiteBar />
      <main className="profile-main narrow">
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
      </main>
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
    <Panel title="계정 삭제" sub="계정과 프로필이 사라집니다. 이 브라우저에 있는 작품 파일은 지워지지 않지만 계정과의 연결은 끊어져요." danger>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!(await ask('정말 계정을 삭제할까요? 되돌릴 수 없습니다.', '삭제', true))) return;
            await authApi.deleteAccount(me.id, pw);
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
