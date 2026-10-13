import { describe, expect, it } from 'vitest';
import { NAME_STYLES, nameStyle } from '../src/names';
import { Runner } from '../src/runner';
import type { StoryPackage } from '../src/types';
import { validatePackage } from '../src/validate';

function pkg(): StoryPackage {
  return {
    format: 'ifb/1',
    meta: { id: 'test.names', title: '이름' },
    settings: {
      mode: 'story',
      calendar: { unit: 'none' },
      stages: [{ id: 'main', name: '본편', turn: { length: 1 }, phases: [{ type: 'events', pools: ['main'], select: 'fixedThenRandom' }] }],
      start: 'a',
      idleEnding: { turns: 1, ending: 'bye' },
    },
    variables: [],
    events: [{ id: 'a', text: '시작.', choices: [] }],
    endings: [{ id: 'bye', title: '끝', text: '끝.' }],
  } as unknown as StoryPackage;
}

describe('이름 주머니', () => {
  it('여섯 주머니, 각각 이름 약 100개, 중복·공백 없음', () => {
    expect(NAME_STYLES).toHaveLength(6);
    for (const s of NAME_STYLES) {
      expect(s.names.length, s.id).toBe(100);
      expect(new Set(s.names).size, s.id).toBe(s.names.length);
      expect(s.names.every((n) => n.length > 0 && !/\s/.test(n))).toBe(true);
    }
  });

  it('뽑기로 정하면 해당 주머니의 이름이 된다 (시드가 같으면 같은 이름)', () => {
    const p = pkg();
    p.settings.player = { randomName: true, nameStyle: 'japanese' };
    const a = new Runner(p, { seed: 7 });
    expect(nameStyle('japanese')!.names).toContain(a.state.name);
    expect(new Runner(p, { seed: 7 }).state.name).toBe(a.state.name);
    expect(a.hud().name).toBe(a.state.name);
  });

  it('묻는 이야기에서 비워 두면 무작위로, 직접 쓰면 그대로', () => {
    const p = pkg();
    p.settings.player = { askName: true, defaultName: '익명', nameStyle: 'korean' };
    const blank = new Runner(p, { seed: 3 });
    expect(blank.scene.type).toBe('name');
    blank.setName('');
    expect(nameStyle('korean')!.names).toContain(blank.state.name);
    const typed = new Runner(p, { seed: 3 });
    typed.setName('해솔');
    expect(typed.state.name).toBe('해솔');
    expect(nameStyle('korean')!.names).toContain(typed.rollName()!);
  });

  it('출신에 이름 주머니가 있으면 출신을 먼저 정하고 그 주머니로 이름을 뽑는다', () => {
    const p = pkg();
    p.settings.player = { randomName: true, nameStyle: 'korean' };
    p.origins = {
      mode: 'choose',
      list: [
        { id: 'tokyo', title: '도쿄', nameStyle: 'japanese' },
        { id: 'paris', title: '파리', nameStyle: 'european' },
      ],
    };
    const r = new Runner(p, { seed: 5 });
    expect(r.scene.type).toBe('origin');
    r.choose(1);
    const chosen = r.state.nameStyle!;
    expect(nameStyle(chosen)!.names).toContain(r.state.name);
    expect(['japanese', 'european']).toContain(chosen);
  });

  it('묻는 이야기 + 출신별 주머니: 출신 뒤에 이름 입력 화면이 나온다', () => {
    const p = pkg();
    p.settings.player = { askName: true, defaultName: '익명' };
    p.origins = { mode: 'choose', list: [{ id: 'cairo', title: '카이로', nameStyle: 'arabic' }] };
    const r = new Runner(p, { seed: 2 });
    expect(r.scene.type).toBe('origin');
    r.choose(0);
    expect(r.scene.type).toBe('name');
    r.setName('');
    expect(nameStyle('arabic')!.names).toContain(r.state.name);
    expect(r.scene.type).not.toBe('name');
  });

  it('없는 이름 주머니는 검증 오류', () => {
    const p = pkg();
    p.settings.player = { randomName: true, nameStyle: 'martian' as never };
    expect(validatePackage(p).some((i) => i.level === 'error' && i.message.includes('martian'))).toBe(true);
  });
});
