import type { Game, Scene } from '../engine/game';
import type { PlayerState } from '../engine/types';
import { hpMax } from '../engine/state';
import { ageOf, formatDate, stageOf } from '../engine/time';

const STAGE_NAMES = { child: '유년기', teen: '청소년기', adult: '성인기' } as const;
const HIDDEN_TAG_PREFIXES = ['기록:', '이번달:'];
const TYPE_DELAY_MS = 14;

export interface UiHandlers {
  onChange: () => void;
  onNewLife: () => void;
}

export class Renderer {
  private typing?: { finish: () => void };

  constructor(
    private readonly root: {
      status: HTMLElement;
      story: HTMLElement;
      choices: HTMLElement;
      tags: HTMLElement;
    },
    private readonly handlers: UiHandlers,
  ) {
    document.addEventListener('keydown', (e) => this.onKey(e));
    root.story.addEventListener('click', () => this.typing?.finish());
  }

  render(game: Game): void {
    this.renderStatus(game.state);
    this.renderTags(game.state);
    this.root.choices.replaceChildren();
    const scene = game.scene;
    this.typeText(sceneText(scene), () => this.renderChoices(game, scene));
  }

  private renderStatus(s: PlayerState): void {
    const sp = s.sp;
    const mood = sp >= 25 ? '단단함' : sp >= 5 ? '괜찮음' : sp > -5 ? '보통' : sp > -30 ? '흔들림' : '무너지기 직전';
    const items: [string, string][] = [
      ['날짜', formatDate(s.now)],
      ['나이', `${ageOf(s)}세 · ${STAGE_NAMES[stageOf(s)]}`],
      ['체력', `${Math.max(0, s.hp)} / ${hpMax(s)}`],
      ['정신', `${sp >= 0 ? '+' : ''}${sp} (${mood})`],
      ['돈', `${s.money.toLocaleString()} 안`],
      ['거주', String(s.tags['거주'] ?? '-')],
    ];
    this.root.status.replaceChildren(
      ...items.map(([label, value]) => {
        const el = document.createElement('span');
        el.className = 'stat';
        el.innerHTML = `<b>${label}</b> ${escapeHtml(value)}`;
        return el;
      }),
    );
  }

  private renderTags(s: PlayerState): void {
    const virtues = Object.entries(s.virtues)
      .map(([k, v]) => `${k} ${'Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ'.split(' ')[v - 1]}`)
      .join(' · ');
    const abilities = Object.entries(s.abilities)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
    const tags = Object.entries(s.tags)
      .filter(([k]) => !HIDDEN_TAG_PREFIXES.some((p) => k.startsWith(p)))
      .map(([k, v]) => (v === true ? k : `${k} ${v}`))
      .join(' · ');
    this.root.tags.innerHTML = [
      `<div><b>가치관</b> ${escapeHtml(virtues)}</div>`,
      abilities && `<div><b>능력</b> ${escapeHtml(abilities)}</div>`,
      tags && `<div><b>특징</b> ${escapeHtml(tags)}</div>`,
    ]
      .filter(Boolean)
      .join('');
  }

  private renderChoices(game: Game, scene: Scene): void {
    const buttons: HTMLButtonElement[] = [];
    const add = (label: string, onClick: () => void, opts: { disabled?: boolean; hint?: string } = {}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.disabled = !!opts.disabled;
      const number = buttons.length + 1;
      button.innerHTML = `<span class="num">${number}.</span> ${escapeHtml(label)}${
        opts.hint ? ` <span class="hint">${escapeHtml(opts.hint)}</span>` : ''
      }`;
      button.addEventListener('click', onClick);
      buttons.push(button);
    };
    const act = (fn: () => void) => () => {
      fn();
      this.handlers.onChange();
    };

    switch (scene.type) {
      case 'origin':
        scene.origins.forEach((o, i) => add(`${o.title} — ${o.summary}`, act(() => game.choose(i))));
        break;
      case 'event':
      case 'actions':
        for (const c of scene.choices) {
          add(c.text, act(() => game.choose(c.index)), {
            disabled: !c.enabled,
            hint: c.enabled ? (c.chance ? `[${c.chance}]` : undefined) : `(${c.reason})`,
          });
        }
        break;
      case 'result':
        add('계속', act(() => game.proceed()));
        break;
      case 'end':
        add('새로운 인생', () => this.handlers.onNewLife());
        break;
    }
    this.root.choices.replaceChildren(...buttons);
    buttons.find((b) => !b.disabled)?.focus();
  }

  private typeText(text: string, done: () => void): void {
    this.typing?.finish();
    const story = this.root.story;
    story.replaceChildren();
    const paragraphs = text.split(/\n{2,}/);
    const full = paragraphs.join('\n\n');
    let shown = 0;
    let timer: number | undefined;
    const paint = () => {
      story.innerHTML = full
        .slice(0, shown)
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
    };
    const finish = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
      shown = full.length;
      paint();
      this.typing = undefined;
      done();
    };
    this.typing = { finish };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || full.length === 0) {
      finish();
      return;
    }
    timer = window.setInterval(() => {
      shown = Math.min(full.length, shown + 2);
      paint();
      if (shown >= full.length) finish();
    }, TYPE_DELAY_MS);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.typing && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      this.typing.finish();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const button = this.root.choices.querySelectorAll<HTMLButtonElement>('button.choice')[n - 1];
      if (button && !button.disabled) button.click();
    }
  }
}

function sceneText(scene: Scene): string {
  switch (scene.type) {
    case 'event':
      return scene.title ? `【${scene.title}】\n\n${scene.text}` : scene.text;
    case 'result':
      return [scene.text, scene.notes.length ? `( ${scene.notes.join(' / ')} )` : '']
        .filter(Boolean)
        .join('\n\n');
    default:
      return scene.text;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
