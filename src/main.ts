import './style.css';
import { loadBundledContent, validateContent } from './engine/content';
import { Game } from './engine/game';
import { createState } from './engine/state';
import type { PlayerState } from './engine/types';
import { Renderer } from './ui/render';

const SAVE_KEY = 'city-life-save-v1';

const content = loadBundledContent();
const problems = validateContent(content);
if (problems.length) {
  console.warn(`콘텐츠 검증 경고 ${problems.length}건:\n${problems.join('\n')}`);
}

function loadSave(): PlayerState | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as PlayerState) : undefined;
  } catch {
    return undefined;
  }
}

function newState(): PlayerState {
  return createState((Math.random() * 2 ** 31) | 0);
}

const el = (id: string) => document.getElementById(id)!;
let game = new Game(content, loadSave() ?? newState());

const renderer = new Renderer(
  { status: el('status'), story: el('story'), choices: el('choices'), tags: el('tags') },
  {
    onChange: () => {
      if (game.state.ended) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(game.state));
      renderer.render(game);
    },
    onNewLife: () => {
      localStorage.removeItem(SAVE_KEY);
      game = new Game(content, newState());
      renderer.render(game);
    },
  },
);

renderer.render(game);
