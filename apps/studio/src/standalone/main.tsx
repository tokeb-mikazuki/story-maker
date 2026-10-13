// 혼자 실행되는 HTML 파일의 진입점. 내보낼 때 #story-data 안에 작품이 JSON으로 들어간다.
import type { StoryPackage } from '@engine';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DialogHost } from '../lib/dialog';
import { PlaySession } from '../player/PlaySession';
import '../styles.css';

function load(): StoryPackage | undefined {
  try {
    const text = document.getElementById('story-data')?.textContent ?? '';
    const pkg = JSON.parse(text) as StoryPackage;
    return pkg && Array.isArray(pkg.events) ? pkg : undefined;
  } catch {
    return undefined;
  }
}

const pkg = load();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pkg ? (
      <>
        <PlaySession pkg={pkg} />
        <DialogHost />
      </>
    ) : (
      <div className="center-page">
        <p>이야기를 불러오지 못했어요.</p>
      </div>
    )}
  </StrictMode>,
);
