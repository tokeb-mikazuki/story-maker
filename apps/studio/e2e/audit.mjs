// 화면 점검용: 모든 편집 화면을 두 가지 폭으로 찍고, 가로로 넘치는 요소를 찾는다.
// 사용: node apps/studio/e2e/audit.mjs [URL] [스크린샷 폴더]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'e2e-audit';
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 부모 밖으로 삐져나오거나 화면 폭을 넘는 요소 */
const overflow = () =>
  page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll('.workspace *')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > vw + 1) out.push(`화면 밖: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(r.right - vw)}px)`);
      else if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && !['TEXTAREA', 'INPUT', 'SELECT'].includes(el.tagName))
        out.push(`넘침: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${el.scrollWidth - el.clientWidth}px)`);
    }
    return [...new Set(out)].slice(0, 8);
  });

await page.setViewport({ width: 1280, height: 800 });
await page.goto(URL + '#/studio', { waitUntil: 'networkidle0' });
await page.screenshot({ path: join(OUT, '00_home.png'), fullPage: true });
await page.evaluate(() => [...document.querySelectorAll('.card.sample button')].find((b) => b.textContent.includes('편집기에서 열기'))?.click());
await sleep(800);
const base = page.url().replace(/#.*/, '') + '#/edit/' + page.url().split('#/edit/')[1].split('/')[0];

const shots = ['flow', 'events', 'events/first_love', 'actions', 'origins', 'variables', 'items', 'statuses', 'tables', 'triggers', 'scripts', 'endings', 'achievements', 'meta', 'settings', 'stages', 'assets', 'check', 'help'];
for (const w of [1280, 1024]) {
  await page.setViewport({ width: w, height: 800 });
  for (const s of shots) {
    await page.goto(`${base}/${s}`);
    await sleep(300);
    const name = `${w}_${s.replace('/', '-')}`;
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
    // 상세 전체(스크롤)
    const full = await page.evaluate(() => document.querySelector('.workspace').scrollHeight);
    if (full > 820) {
      await page.evaluate(() => document.querySelector('.workspace').scrollTo(0, 99999));
      await sleep(100);
      await page.screenshot({ path: join(OUT, `${name}_end.png`) });
    }
    const o = await overflow();
    if (o.length) console.log(name, o);
  }
}
if (errors.length) console.log('오류', errors);
await browser.close();
