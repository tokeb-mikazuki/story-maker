// 계정 관련 공용 조각: 아바타, 상단 계정 메뉴.

import { useEffect, useRef, useState } from 'react';
import { type PublicProfile, authApi, useAccount } from '../lib/auth';
import { href } from '../lib/router';

export function Avatar({ profile, size = 32 }: { profile: Pick<PublicProfile, 'avatar' | 'nickname'>; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: profile.avatar.color, fontSize: size * 0.5 }} aria-label={`${profile.nickname} 프로필 사진`}>
      {profile.avatar.emoji}
    </span>
  );
}

/** 로그인 전에는 로그인·회원가입, 로그인 후에는 아바타와 메뉴 */
export function AccountMenu({ compact }: { compact?: boolean }) {
  const me = useAccount();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!me)
    return (
      <div className="account-links">
        <a className="btn small" href={href('login')}>
          로그인
        </a>
        {!compact && (
          <a className="btn small primary" href={href('signup')}>
            회원가입
          </a>
        )}
      </div>
    );

  return (
    <div className="account-menu" ref={box}>
      <button type="button" className="account-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={me.nickname}>
        <Avatar profile={me} size={28} />
        {!compact && <span className="account-name">{me.nickname}</span>}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-pop-head">
            <Avatar profile={me} size={40} />
            <div>
              <strong>{me.nickname}</strong>
              <small>@{me.loginId}</small>
            </div>
          </div>
          <a role="menuitem" href={href('me')} onClick={() => setOpen(false)}>
            마이페이지
          </a>
          <a role="menuitem" href={href('u', me.id)} onClick={() => setOpen(false)}>
            내 프로필 보기
          </a>
          <a role="menuitem" href={href('studio')} onClick={() => setOpen(false)}>
            내 작업실
          </a>
          <a role="menuitem" href={href('me', 'edit')} onClick={() => setOpen(false)}>
            회원정보 수정
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await authApi.logout();
              window.location.hash = '#/';
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
