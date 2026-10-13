import type { StoryPackage } from '@engine';
import { useEffect, useState } from 'react';
import { worksApi } from '../lib/community';
import { href } from '../lib/router';
import { projects } from '../lib/storage';
import { PlaySession } from '../player/PlaySession';
import { SAMPLES } from '../samples';

/** published: 창작마당에 올라간 사본을 플레이(#/play/id/w). 아니면 샘플 → 내 작업 → 창작마당 순으로 찾는다 */
export function PlayPage({ id, published }: { id: string; published?: boolean }) {
  const [found, setFound] = useState<{ pkg: StoryPackage; listed: boolean } | null>();
  useEffect(() => {
    const sample = SAMPLES.find((s) => s.meta.id === id);
    const fromGallery = () => worksApi.get(id).then((w) => setFound(w ? { pkg: w.pkg, listed: true } : null));
    if (sample) setFound({ pkg: sample, listed: true });
    else if (published) void fromGallery();
    else
      projects.get(id).then((r) => {
        if (r) setFound({ pkg: r.pkg, listed: false });
        else void fromGallery();
      });
  }, [id, published]);
  const pkg = found === undefined ? undefined : (found?.pkg ?? null);
  if (pkg === undefined) return <div className="center-page muted">불러오는 중…</div>;
  if (pkg === null)
    return (
      <div className="center-page">
        <p>이야기를 찾을 수 없습니다.</p>
        <a href="#/">처음으로</a>
      </div>
    );
  const listed = !!found?.listed;
  const back = listed ? { to: href('works', pkg.meta.id), label: '작품 정보' } : { to: href('studio'), label: '내 작업실' };
  // 창작마당에 있는 작품이면 플레이 수를 센다
  return <PlaySession pkg={pkg} back={back} onPlayStart={listed ? () => worksApi.recordPlay(pkg.meta.id) : undefined} />;
}

