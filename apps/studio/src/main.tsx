import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteLayout } from './components/Site';
import { Editor } from './editor/Editor';
import { DialogHost } from './lib/dialog';
import { useRoute } from './lib/router';
import { About } from './pages/About';
import { FindIdPage, LoginPage, ResetPasswordPage, SignupPage } from './pages/Auth';
import { BoardList, PostEditor, PostPage } from './pages/Board';
import { Gallery } from './pages/Gallery';
import { Landing } from './pages/Landing';
import { PlayPage } from './pages/PlayPage';
import { AccountEditPage, MyPage, ProfilePage } from './pages/Profile';
import { Studio } from './pages/Studio';
import { WorkPage } from './pages/WorkPage';
import './styles.css';
import './site.css';

function App() {
  return (
    <>
      <Routes />
      <DialogHost />
    </>
  );
}

/** 상단 메뉴에서 어느 칸을 켤지 */
const NAV_OF: Record<string, string> = { works: 'works', board: 'board', about: 'about', studio: 'studio' };

function Routes() {
  const route = useRoute();
  const [page = '', id, section, item] = route;
  // 사이트 화면이 바뀌면 맨 위에서 시작 (편집기 안에서 칸을 옮길 때는 그대로)
  const scrollKey = page === 'edit' ? `edit/${id}` : route.join('/');
  useEffect(() => window.scrollTo(0, 0), [scrollKey]);

  // 편집기·플레이어는 사이트 틀 없이 화면 전체를 쓴다
  if (page === 'edit' && id) return <Editor key={id} projectId={id} section={section} item={item} />;
  if (page === 'play' && id) return <PlayPage key={id} id={id} published={section === 'w'} />;

  return (
    <SiteLayout page={NAV_OF[page] ?? (page === '' ? '' : '-')}>
      <SitePage page={page} id={id} section={section} />
    </SiteLayout>
  );
}

function SitePage({ page, id, section }: { page: string; id?: string; section?: string }) {
  switch (page) {
    case 'works':
      return id ? <WorkPage key={id} id={id} /> : <Gallery />;
    case 'board':
      if (id === 'new') return <PostEditor />;
      if (id && section === 'edit') return <PostEditor key={id} id={id} />;
      return id ? <PostPage key={id} id={id} /> : <BoardList />;
    case 'about':
      return <About />;
    case 'studio':
      return <Studio />;
    case 'login':
      return <LoginPage />;
    case 'signup':
      return <SignupPage />;
    case 'find-id':
      return <FindIdPage />;
    case 'reset-password':
      return <ResetPasswordPage />;
    case 'me':
      return id === 'edit' ? <AccountEditPage /> : <MyPage />;
    case 'u':
      if (id) return <ProfilePage key={id} id={id} />;
      return <Landing />;
    default:
      return <Landing />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
