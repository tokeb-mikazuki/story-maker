// 로그인 · 회원가입 · 아이디 찾기 · 비밀번호 찾기(재설정)

import { type FormEvent, type ReactNode, useState } from 'react';
import { AuthError, authApi, checkEmail, checkLoginId, checkNickname, checkPassword, rules, useAccount } from '../lib/auth';
import { go, href } from '../lib/router';

function Shell({ title, sub, children, foot }: { title: string; sub?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        {sub && <p className="auth-sub">{sub}</p>}
        {children}
        {foot && <div className="auth-foot">{foot}</div>}
        <p className="dev-note">개발용 계정입니다. 서버가 연결되기 전까지는 이 브라우저에만 저장됩니다.</p>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  autoComplete,
  autoFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`auth-field ${error ? 'bad' : ''}`}>
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
      {error ? <em role="alert">{error}</em> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** 폼 제출 공통: 처리 중 표시와 서버 오류를 필드·전체 오류로 나눠 보여 준다 */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await fn();
    } catch (e) {
      if (e instanceof AuthError) setErrors({ [e.field ?? '_']: e.message });
      else setErrors({ _: '문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, setErrors, run };
}

// ───────────────────────── 로그인 ─────────────────────────

export function LoginPage() {
  const me = useAccount();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const { busy, errors, run } = useSubmit();
  if (me)
    return (
      <Shell title="이미 로그인되어 있어요">
        <p className="auth-sub">{me.nickname} 님으로 로그인된 상태입니다.</p>
        <a className="btn primary big" href={href('me')}>
          마이페이지로
        </a>
      </Shell>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!loginId.trim() || !password) throw new AuthError('아이디와 비밀번호를 입력해 주세요');
      await authApi.login(loginId, password, keep);
      go();
    });
  };
  return (
    <Shell
      title="로그인"
      sub="내 작품을 계정에 저장하고, 창작마당에서 프로필로 소개해 보세요."
      foot={
        <>
          <a href={href('find-id')}>아이디 찾기</a>
          <span>·</span>
          <a href={href('reset-password')}>비밀번호 찾기</a>
          <span>·</span>
          <a href={href('signup')}>회원가입</a>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Input label="아이디" value={loginId} onChange={setLoginId} autoComplete="username" autoFocus />
        <Input label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={errors._} />
        <label className="auth-check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> 로그인 상태 유지
        </label>
        <button className="btn primary big" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </Shell>
  );
}

// ───────────────────────── 회원가입 ─────────────────────────

export function SignupPage() {
  const me = useAccount();
  const [f, setF] = useState({ loginId: '', email: '', nickname: '', password: '', again: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { busy, errors, run } = useSubmit();
  if (me)
    return (
      <Shell title="이미 로그인되어 있어요">
        <a className="btn primary big" href={href('me')}>
          마이페이지로
        </a>
      </Shell>
    );
  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const local: Record<string, string | undefined> = {
    loginId: f.loginId && checkLoginId(f.loginId.toLowerCase()),
    email: f.email && checkEmail(f.email),
    nickname: f.nickname && checkNickname(f.nickname),
    password: f.password && checkPassword(f.password),
    again: f.again && f.again !== f.password ? '비밀번호가 서로 다릅니다' : undefined,
  };
  const show = (k: string) => errors[k] ?? (touched[k] ? local[k] : undefined);
  const ready = f.loginId && f.email && f.nickname && f.password && f.again && !Object.values(local).some(Boolean);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return setTouched({ loginId: true, email: true, nickname: true, password: true, again: true });
    void run(async () => {
      await authApi.signUp(f);
      go('me');
    });
  };
  return (
    <Shell title="회원가입" sub="1분이면 끝나요. 이메일은 아이디·비밀번호를 찾을 때만 씁니다." foot={<a href={href('login')}>이미 계정이 있어요 · 로그인</a>}>
      <form onSubmit={submit} noValidate>
        <Input label="아이디" value={f.loginId} onChange={set('loginId')} autoComplete="username" hint={rules.loginId} error={show('loginId')} autoFocus />
        <Input label="이메일" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={show('email')} />
        <Input label="닉네임" value={f.nickname} onChange={set('nickname')} hint="다른 사람에게 보이는 이름입니다" error={show('nickname')} />
        <Input label="비밀번호" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" hint={rules.password} error={show('password')} />
        <Input label="비밀번호 확인" type="password" value={f.again} onChange={set('again')} autoComplete="new-password" error={show('again')} />
        {errors._ && <p className="auth-error" role="alert">{errors._}</p>}
        <button className="btn primary big" disabled={busy}>
          {busy ? '가입 중…' : '가입하기'}
        </button>
      </form>
    </Shell>
  );
}

// ───────────────────────── 아이디 찾기 ─────────────────────────

export function FindIdPage() {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<string>();
  const { busy, errors, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (checkEmail(email)) throw new AuthError(checkEmail(email)!, 'email');
      setFound(await authApi.findLoginId(email));
    });
  };
  return (
    <Shell title="아이디 찾기" sub="가입할 때 쓴 이메일을 알려 주세요." foot={<><a href={href('login')}>로그인</a><span>·</span><a href={href('reset-password')}>비밀번호 찾기</a></>}>
      {found ? (
        <div className="auth-result">
          <p>가입된 아이디는</p>
          <strong>{found}</strong>
          <small>개인정보 보호를 위해 일부를 가렸습니다. 서버가 연결되면 이 내용은 이메일로 보내 드립니다.</small>
          <a className="btn primary big" href={href('login')}>
            로그인하러 가기
          </a>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <Input label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" error={errors.email} autoFocus />
          <button className="btn primary big" disabled={busy}>
            {busy ? '찾는 중…' : '아이디 찾기'}
          </button>
        </form>
      )}
    </Shell>
  );
}

// ───────────────────────── 비밀번호 찾기(재설정) ─────────────────────────

export function ResetPasswordPage() {
  const [step, setStep] = useState<'ask' | 'code' | 'done'>('ask');
  const [f, setF] = useState({ loginId: '', email: '', code: '', password: '', again: '' });
  const [sent, setSent] = useState<{ code: string; expiresAt: number }>();
  const { busy, errors, run } = useSubmit();
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const ask = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      if (!f.loginId.trim() || !f.email.trim()) throw new AuthError('아이디와 이메일을 모두 입력해 주세요');
      setSent(await authApi.requestPasswordReset(f.loginId, f.email));
      setStep('code');
    });
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (f.password !== f.again) throw new AuthError('비밀번호가 서로 다릅니다', 'again');
      await authApi.resetPassword(f.loginId, f.code, f.password);
      setStep('done');
    });
  };

  return (
    <Shell
      title="비밀번호 찾기"
      sub={step === 'ask' ? '아이디와 가입 이메일이 맞으면 인증 코드를 보내 드려요.' : step === 'code' ? '받은 코드를 넣고 새 비밀번호를 정해 주세요.' : undefined}
      foot={<><a href={href('login')}>로그인</a><span>·</span><a href={href('find-id')}>아이디 찾기</a></>}
    >
      {step === 'ask' && (
        <form onSubmit={ask} noValidate>
          <Input label="아이디" value={f.loginId} onChange={set('loginId')} autoComplete="username" autoFocus />
          <Input label="이메일" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={errors._} />
          <button className="btn primary big" disabled={busy}>
            {busy ? '확인 중…' : '인증 코드 받기'}
          </button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={confirm} noValidate>
          {sent && (
            <div className="dev-code" role="status">
              <small>개발용 · 메일이 발송되지 않으므로 여기에 보여 드립니다 (10분간 유효)</small>
              <strong>{sent.code}</strong>
            </div>
          )}
          <Input label="인증 코드" value={f.code} onChange={set('code')} error={errors.code} autoFocus placeholder="6자리 숫자" />
          <Input label="새 비밀번호" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" hint={rules.password} error={errors.password} />
          <Input label="새 비밀번호 확인" type="password" value={f.again} onChange={set('again')} autoComplete="new-password" error={errors.again ?? errors._} />
          <button className="btn primary big" disabled={busy}>
            {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </button>
          <button type="button" className="link small" onClick={() => ask()}>
            코드 다시 받기
          </button>
        </form>
      )}
      {step === 'done' && (
        <div className="auth-result">
          <strong>비밀번호를 바꿨어요</strong>
          <small>새 비밀번호로 로그인해 주세요.</small>
          <a className="btn primary big" href={href('login')}>
            로그인
          </a>
        </div>
      )}
    </Shell>
  );
}
