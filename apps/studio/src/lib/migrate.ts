// 예전 방식(이벤트·결과·엔딩에 이미지 한 장을 붙이기, '일러스트' 블록)으로 만든 작품을
// 글 속 {image 이미지ID} 방식으로 옮긴다. 이미 옮겨졌거나 해당 없는 작품은 그대로 돌려준다.

import type { ChoiceDef, Command, Outcome, StoryPackage } from '@engine';

const tag = (id: string) => `{image ${id}}`;
const withImage = (text: string | undefined, id: string) => (text?.trim() ? `${tag(id)}\n${text}` : tag(id));

export function migrateImages(pkg: StoryPackage): StoryPackage {
  const legacy = /"image":/.test(JSON.stringify([pkg.events, pkg.actions])) || JSON.stringify([pkg.scripts, pkg.triggers, pkg.items, pkg.statuses, pkg.origins]).includes('"do":"image"') || pkg.endings.some((e) => e.image);
  if (!legacy) return pkg;

  const next = structuredClone(pkg);
  const commands = (list: Command[] | undefined) => {
    list?.forEach((c, i) => {
      if (c.do === 'image') list[i] = { do: 'text', text: tag(c.asset) };
      else if (c.do === 'if') (commands(c.then), commands(c.else));
      else if (c.do === 'random') c.branches.forEach((b) => commands(b.then));
      else if (c.do === 'check') (commands(c.success), commands(c.failure));
    });
  };
  const outcome = (o: Outcome | undefined) => {
    if (!o) return;
    if (o.image) {
      o.text = withImage(o.text, o.image);
      delete o.image;
    }
    commands(o.do);
    o.choices?.forEach(choice);
  };
  const choice = (c: ChoiceDef) => {
    outcome(c.success);
    outcome(c.failure);
    outcome(c.outcome);
    c.results?.forEach(outcome);
  };

  for (const e of next.events) {
    if (e.image) {
      e.text = withImage(e.text, e.image);
      delete e.image;
    }
    e.choices.forEach(choice);
  }
  next.actions?.forEach(choice);
  next.scripts?.forEach((s) => commands(s.do));
  next.triggers?.forEach((t) => commands(t.do));
  next.origins?.list.forEach((o) => commands(o.do));
  next.items?.forEach((i) => [i.use?.do, i.onGain, i.onLose, i.onTurnEnd].forEach(commands));
  next.statuses?.forEach((s) => [s.onApply, s.onTurnEnd, s.onTick, s.onExpire].forEach(commands));
  for (const e of next.endings) {
    if (e.image) {
      e.text = withImage(e.text, e.image);
      delete e.image;
    }
  }
  return next;
}
