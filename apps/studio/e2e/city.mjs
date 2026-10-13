// 팬 창작 샘플 「날개 아래, 984」 브라우저 확인: 홈 카드 → 플레이(끝까지) → 편집기에서 열기.
// 사용: node apps/studio/e2e/city.mjs [URL] [스크린샷 폴더]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: join(OUT, `${n}.png`) });
const log = (...a) => console.log('•', ...a);

await page.goto(URL + '#/studio', { waitUntil: 'networkidle0' });
const card = await page.evaluate(() => {
  const c = [...document.querySelectorAll('.card.sample')].find((x) => x.textContent.includes('날개 아래, 984'));
  return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 160) : null;
});
log('홈 카드:', card);
await shot('c01_home');
await page.evaluate(() => [...document.querySelectorAll('.card.sample')].find((x) => x.textContent.includes('날개 아래, 984')).querySelector('a.btn').click());
await sleep(400);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('새로 시작'))?.click());
await sleep(300);
await page.type('.name-form input', '하윤');
await page.click('.name-form button');
await sleep(400);
await page.evaluate(() => document.querySelector('.scene')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
await sleep(200);
await shot('c02_origin');
log('출생지 후보:', await page.$$eval('.choices.origins .choice strong', (els) => els.map((e) => e.textContent).join(' / ')));
// T사 둥지 고르기
await page.evaluate(() => [...document.querySelectorAll('.choices.origins .choice')].find((b) => b.textContent.includes('T사 둥지')).click());
await sleep(300);

const seen = new Set();
let menuShot = false;
for (let i = 0; i < 700; i++) {
  const st = await page.evaluate(() => {
    const scene = document.querySelector('.scene');
    if (!scene) return { k: 'none' };
    if (scene.classList.contains('scene-end')) return { k: 'end' };
    if (document.querySelector('.skip-hint')) {
      scene.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return { k: 'skip' };
    }
    const title = scene.querySelector('.scene-title')?.textContent ?? '';
    const btns = [...scene.querySelectorAll('.choices button.choice:not(:disabled)')];
    if (!btns.length) return { k: 'stuck', title };
    // 진로에서는 해결사를 고른다(가능하면), 그 외에는 첫 번째와 무작위를 섞는다
    let b = btns.find((x) => x.textContent.includes('해결사 시험')) ?? btns[Math.floor(Math.random() * btns.length)];
    const isMenu = scene.classList.contains('scene-menu');
    b.click();
    return { k: 'click', title, isMenu };
  });
  if (st.k === 'end') break;
  if (st.k === 'stuck' || st.k === 'none') {
    log('막힘', st);
    break;
  }
  if (st.title) seen.add(st.title);
  if (st.isMenu && !menuShot) {
    menuShot = true;
  }
  if (st.title === '갈림길') await shot('c03_career');
  await sleep(st.k === 'skip' ? 20 : 50);
  if (!menuShot && (await page.$('.scene-menu'))) {
    await sleep(500);
    await page.evaluate(() => document.querySelector('.skip-hint') && document.querySelector('.scene').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    await sleep(100);
    await shot('c04_menu');
    log('상태창:', await page.$eval('.hud', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 200)));
    menuShot = true;
  }
}
await sleep(600);
await shot('c05_end');
log('본 장면:', [...seen].join(', '));
log('엔딩:', await page.$eval('.scene-end', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 500)).catch(() => '(없음)'));

// 편집기에서 열기
await page.goto(URL + '#/studio', { waitUntil: 'networkidle0' });
await page.evaluate(() => [...document.querySelectorAll('.card.sample')].find((x) => x.textContent.includes('날개 아래, 984')).querySelector('button').click());
await sleep(800);
await page.goto(page.url().replace(/#\/edit\/([^/]+).*/, '#/edit/$1/events/career'));
await sleep(500);
await shot('c06_editor_career');
log('편집기 이벤트 수:', await page.$eval('.sidenav a.active .count', (e) => e.textContent).catch(() => '?'));
await page.goto(page.url().replace(/events\/career/, 'triggers'));
await sleep(400);
await shot('c07_editor_triggers');
if (errors.length) console.log('오류:', errors);
else log('페이지 오류 없음');
await browser.close();
