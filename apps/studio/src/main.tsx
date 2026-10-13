import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from './editor/Editor';
import { DialogHost } from './lib/dialog';
import { useRoute } from './lib/router';
import { Home } from './pages/Home';
import { PlayPage } from './pages/PlayPage';
import './styles.css';

function App() {
  return (
    <>
      <Routes />
      <DialogHost />
    </>
  );
}

function Routes() {
  const [page, id, section, item] = useRoute();
  if (page === 'edit' && id) return <Editor key={id} projectId={id} section={section} item={item} />;
  if (page === 'play' && id) return <PlayPage key={id} id={id} />;
  return <Home />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
