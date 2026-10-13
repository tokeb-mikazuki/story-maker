// 계정 시스템(프런트엔드 전용 모의 구현).
// 서버가 생기기 전까지는 이 브라우저의 localStorage에만 저장한다. 화면은 모두 아래 `authApi`만 부르므로,
// 서버가 생기면 이 파일의 함수 본문만 실제 API 호출로 바꾸면 된다.
// 주의: 모의 구현이라 비밀번호 찾기의 인증 코드를 화면에 그대로 보여 준다(메일 발송 없음).

import { useSyncExternalStore } from 'react';

export interface Avatar {
  emoji: string;
  color: string;
}

/** 다른 사람에게 보이는 프로필 */
export interface PublicProfile {
  id: string;
  nickname: string;
  bio: string;
  avatar: Avatar;
  createdAt: number;
  /** 개발팀 계정 표시 */
  official?: boolean;
}

/** 본인에게만 보이는 계정 정보 */
export interface Account extends PublicProfile {
  loginId: string;
  email: string;
}

interface StoredAccount extends Account {
  salt: string;
  passHash: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export const AVATAR_EMOJIS = ['✒', '📖', '🕯', '🌙', '🗝', '🦉', '🐈', '🌿', '🔥', '⚓', '🎭', '🍃'];
export const AVATAR_COLORS = ['#b5523b', '#c58a3c', '#6f8a4a', '#3f6ea8', '#7a68b5', '#a0507a', '#4a8a86', '#5c544a'];

/** 지금은 모든 작품의 제작자를 이 계정으로 표시한다. 서버가 생기면 작품의 실제 제작자 계정으로 바꾼다 */
export const DEVELOPER: PublicProfile = {
  id: 'developer',
  nickname: 'Developer',
  bio: '이야기 공방을 만드는 사람들. 샘플 작품과 도구를 만들고 있습니다.',
  avatar: { emoji: '✒', color: '#5c544a' },
  createdAt: Date.UTC(2026, 9, 1),
  official: true,
};

const ACCOUNTS_KEY = 'auth:accounts';
const SESSION_KEY = 'auth:session';
const RESETS_KEY = 'auth:resets';

// ───────────────────────── 저장소 ─────────────────────────

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const accounts = () => read<StoredAccount[]>(ACCOUNTS_KEY, []);
const saveAccounts = (xs: StoredAccount[]) => write(ACCOUNTS_KEY, xs);

const strip = ({ salt: _s, passHash: _p, ...rest }: StoredAccount): Account => rest;
const toPublic = (a: StoredAccount): PublicProfile => ({ id: a.id, nickname: a.nickname, bio: a.bio, avatar: a.avatar, createdAt: a.createdAt });

// ───────────────────────── 로그인 상태(구독) ─────────────────────────

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('storage', emit);

function sessionId(): string | undefined {
  return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY) ?? undefined;
}

let cache: { id?: string; stamp?: string; value: Account | null } = { value: null };
function snapshot(): Account | null {
  const id = sessionId();
  const stamp = localStorage.getItem(ACCOUNTS_KEY) ?? '';
  if (cache.id === id && cache.stamp === stamp) return cache.value;
  const found = id ? accounts().find((a) => a.id === id) : undefined;
  cache = { id, stamp, value: found ? strip(found) : null };
  return cache.value;
}

/** 지금 로그인한 계정(없으면 null). 바뀌면 화면이 다시 그려진다 */
export function useAccount(): Account | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => null,
  );
}

/** 화면 밖(저장소 등)에서 쓰는 현재 계정 id */
export const currentAccountId = (): string | undefined => snapshot()?.id;

// ───────────────────────── 검증 ─────────────────────────

const LOGIN_ID = /^[a-z0-9_]{4,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const rules = {
  loginId: '영문 소문자·숫자·밑줄(_) 4~20자',
  password: '8자 이상, 영문과 숫자를 함께',
  nickname: '2~16자 (공백 제외 글자·숫자·밑줄·점)',
};

export function checkLoginId(v: string): string | undefined {
  return LOGIN_ID.test(v) ? undefined : `아이디는 ${rules.loginId}로 적어 주세요`;
}
export function checkPassword(v: string): string | undefined {
  return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? undefined : `비밀번호는 ${rules.password} 써 주세요`;
}
export function checkEmail(v: string): string | undefined {
  return EMAIL.test(v) ? undefined : '이메일 형식이 올바르지 않습니다';
}
export function checkNickname(v: string): string | undefined {
  return /^[\p{L}\p{N}_.]{2,16}$/u.test(v) ? undefined : `닉네임은 ${rules.nickname}`;
}

// ───────────────────────── 비밀번호 ─────────────────────────

const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

async function hash(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // 보안 컨텍스트가 아닌 환경(모의용 대체)
  let h = 5381;
  for (const b of data) h = ((h << 5) + h + b) | 0;
  return `weak-${h >>> 0}`;
}

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const mask = (s: string) => (s.length <= 3 ? `${s[0]}**` : `${s.slice(0, 2)}${'*'.repeat(Math.max(2, s.length - 4))}${s.slice(-2)}`);

// ───────────────────────── 서버 API 자리 ─────────────────────────

export const authApi = {
  async signUp(input: { loginId: string; email: string; password: string; nickname: string }): Promise<Account> {
    await wait();
    const loginId = input.loginId.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const nickname = input.nickname.trim();
    const list = accounts();
    if (checkLoginId(loginId)) throw new AuthError(checkLoginId(loginId)!, 'loginId');
    if (list.some((a) => a.loginId === loginId)) throw new AuthError('이미 사용 중인 아이디입니다', 'loginId');
    if (checkEmail(email)) throw new AuthError(checkEmail(email)!, 'email');
    if (list.some((a) => a.email === email)) throw new AuthError('이미 가입된 이메일입니다', 'email');
    if (checkNickname(nickname)) throw new AuthError(checkNickname(nickname)!, 'nickname');
    if (nickname.toLowerCase() === DEVELOPER.nickname.toLowerCase() || list.some((a) => a.nickname.toLowerCase() === nickname.toLowerCase()))
      throw new AuthError('이미 사용 중인 닉네임입니다', 'nickname');
    if (checkPassword(input.password)) throw new AuthError(checkPassword(input.password)!, 'password');
    const salt = randomHex(8);
    const account: StoredAccount = {
      id: `u_${randomHex(5)}`,
      loginId,
      email,
      nickname,
      bio: '',
      avatar: { emoji: AVATAR_EMOJIS[list.length % AVATAR_EMOJIS.length], color: AVATAR_COLORS[list.length % AVATAR_COLORS.length] },
      createdAt: Date.now(),
      salt,
      passHash: await hash(input.password, salt),
    };
    saveAccounts([...list, account]);
    await authApi.login(loginId, input.password, true);
    return strip(account);
  },

  async login(loginId: string, password: string, keep = true): Promise<Account> {
    await wait();
    const a = accounts().find((x) => x.loginId === loginId.trim().toLowerCase());
    // 어느 쪽이 틀렸는지 알려 주지 않는다
    if (!a || (await hash(password, a.salt)) !== a.passHash) throw new AuthError('아이디 또는 비밀번호가 맞지 않습니다');
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    (keep ? localStorage : sessionStorage).setItem(SESSION_KEY, a.id);
    emit();
    return strip(a);
  },

  async logout(): Promise<void> {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    emit();
  },

  /** 이메일로 아이디 찾기. 서버에서는 메일로 보내고, 여기서는 일부를 가려서 화면에 보여 준다 */
  async findLoginId(email: string): Promise<string> {
    await wait();
    const a = accounts().find((x) => x.email === email.trim().toLowerCase());
    if (!a) throw new AuthError('이 이메일로 가입된 계정이 없습니다', 'email');
    return mask(a.loginId);
  },

  /** 비밀번호 재설정 코드 요청. 서버에서는 메일로 보내고, 여기서는 개발용으로 코드를 돌려준다 */
  async requestPasswordReset(loginId: string, email: string): Promise<{ code: string; expiresAt: number }> {
    await wait();
    const a = accounts().find((x) => x.loginId === loginId.trim().toLowerCase() && x.email === email.trim().toLowerCase());
    if (!a) throw new AuthError('아이디와 이메일이 일치하는 계정이 없습니다');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const resets = read<Record<string, { code: string; expiresAt: number }>>(RESETS_KEY, {});
    resets[a.id] = { code, expiresAt };
    write(RESETS_KEY, resets);
    return { code, expiresAt };
  },

  async resetPassword(loginId: string, code: string, newPassword: string): Promise<void> {
    await wait();
    const list = accounts();
    const a = list.find((x) => x.loginId === loginId.trim().toLowerCase());
    const resets = read<Record<string, { code: string; expiresAt: number }>>(RESETS_KEY, {});
    const r = a && resets[a.id];
    if (!a || !r || r.code !== code.trim()) throw new AuthError('인증 코드가 맞지 않습니다', 'code');
    if (r.expiresAt < Date.now()) throw new AuthError('인증 코드가 만료되었습니다. 다시 요청해 주세요', 'code');
    if (checkPassword(newPassword)) throw new AuthError(checkPassword(newPassword)!, 'password');
    const salt = randomHex(8);
    a.salt = salt;
    a.passHash = await hash(newPassword, salt);
    saveAccounts(list);
    delete resets[a.id];
    write(RESETS_KEY, resets);
  },

  async updateProfile(id: string, patch: { nickname?: string; bio?: string; avatar?: Avatar; email?: string }): Promise<Account> {
    await wait();
    const list = accounts();
    const a = list.find((x) => x.id === id);
    if (!a) throw new AuthError('계정을 찾을 수 없습니다');
    if (patch.nickname !== undefined) {
      const n = patch.nickname.trim();
      if (checkNickname(n)) throw new AuthError(checkNickname(n)!, 'nickname');
      if (n.toLowerCase() === DEVELOPER.nickname.toLowerCase() || list.some((x) => x.id !== id && x.nickname.toLowerCase() === n.toLowerCase()))
        throw new AuthError('이미 사용 중인 닉네임입니다', 'nickname');
      a.nickname = n;
    }
    if (patch.email !== undefined) {
      const e = patch.email.trim().toLowerCase();
      if (checkEmail(e)) throw new AuthError(checkEmail(e)!, 'email');
      if (list.some((x) => x.id !== id && x.email === e)) throw new AuthError('이미 가입된 이메일입니다', 'email');
      a.email = e;
    }
    if (patch.bio !== undefined) a.bio = patch.bio.slice(0, 200);
    if (patch.avatar) a.avatar = patch.avatar;
    saveAccounts(list);
    emit();
    return strip(a);
  },

  async changePassword(id: string, current: string, next: string): Promise<void> {
    await wait();
    const list = accounts();
    const a = list.find((x) => x.id === id);
    if (!a || (await hash(current, a.salt)) !== a.passHash) throw new AuthError('현재 비밀번호가 맞지 않습니다', 'current');
    if (checkPassword(next)) throw new AuthError(checkPassword(next)!, 'password');
    if (next === current) throw new AuthError('현재와 다른 비밀번호를 써 주세요', 'password');
    a.salt = randomHex(8);
    a.passHash = await hash(next, a.salt);
    saveAccounts(list);
  },

  async deleteAccount(id: string, password: string): Promise<void> {
    await wait();
    const list = accounts();
    const a = list.find((x) => x.id === id);
    if (!a || (await hash(password, a.salt)) !== a.passHash) throw new AuthError('비밀번호가 맞지 않습니다', 'password');
    saveAccounts(list.filter((x) => x.id !== id));
    await authApi.logout();
  },

  /** 누구나 볼 수 있는 프로필. 지금은 개발팀 계정과 이 브라우저의 계정만 찾는다 */
  async getProfile(id: string): Promise<PublicProfile | undefined> {
    await wait(80);
    if (id === DEVELOPER.id) return DEVELOPER;
    const a = accounts().find((x) => x.id === id);
    return a ? toPublic(a) : undefined;
  },
};

// ───────────────────────── 작품 제작자 표시 ─────────────────────────

/** 목록 화면에서 쓰는 동기 조회. 탈퇴한 계정은 자리표시 프로필을 돌려준다 */
export function profileOf(id: string): PublicProfile {
  if (id === DEVELOPER.id) return DEVELOPER;
  const a = accounts().find((x) => x.id === id);
  return a ? toPublic(a) : { id, nickname: '탈퇴한 사용자', bio: '', avatar: { emoji: '·', color: '#9a9184' }, createdAt: 0 };
}

export const isGoneProfile = (p: PublicProfile) => p.createdAt === 0 && p.id !== DEVELOPER.id;
