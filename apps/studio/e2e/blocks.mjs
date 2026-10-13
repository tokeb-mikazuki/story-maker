// 블록 편집기·도움말 브라우저 테스트: 블록 추가·감싸기·옮기기·되돌리기, 조건 고르기, 묶어 보기, 도움말 링크.
// 사용: node apps/studio/e2e/blocks.mjs [URL] [스크린샷 폴더]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const log = (...a) => console.log('•', ...a);
let failed = 0;
const expect = (label, ok, extra = '') => {
  if (!ok) failed++;
  log(ok ? '통과' : '실패', label, extra);
};

/** HTML5 끌어 놓기를 이벤트로 흉내 낸다. src/dst는 page.evaluate 안에서 요소를 찾는 함수 본문 */
async function drag(srcFn, dstFn) {
  return page.evaluate(
    async (s, d) => {
      const src = new Function(`return (${s})()`)();
      if (!src) return 'no-src';
      const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      const dst = new Function(`return (${d})()`)();
      if (!dst) return 'no-dst';
      dst.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 30));
      dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      return 'ok';
    },
    srcFn.toString(),
    dstFn.toString(),
  );
}

const count = (sel) => page.$$eval(sel, (els) => els.length);

try {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => [...document.querySelectorAll('.card.sample button')].find((b) => b.textContent.includes('편집기에서 열기'))?.click());
  await sleep(800);
  const base = page.url().replace(/#.*/, '') + '#/edit/' + page.url().split('#/edit/')[1].split('/')[0];

  // 1. 자동 규칙: 머리 블록 + 묶어 보기, 꾸러미 없음
  await page.goto(`${base}/triggers`);
  await sleep(400);
  const heads = await page.$$eval('.collection-list .group-head', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  expect('규칙 목록이 시점 › 조건으로 묶임', heads.length >= 2, heads.slice(0, 6).join(' | '));
  expect('머리 블록', (await count('.script-canvas .block.hat')) === 1);
  expect('고급 메뉴 숨김', !(await page.$$eval('.sidenav a', (as) => as.some((a) => a.textContent.includes('JSON')))));
  await shot('b01_triggers');

  // 2. ＋ 블록 추가 메뉴로 '변수 더하기'
  const before = await count('.script-canvas .block:not(.hat)');
  await page.evaluate(() => document.querySelector('.script-canvas .add-block-btn').click());
  await sleep(150);
  await shot('b01b_menu');
  await page.evaluate(() => [...document.querySelectorAll('.script-canvas .block-menu .pblock')].find((b) => b.querySelector('.pblock-name').textContent === '변수 더하기').click());
  await sleep(200);
  const after = await count('.script-canvas .block:not(.hat)');
  expect('블록 메뉴로 추가', after === before + 1, `${before}→${after}`);

  // 3. ⋯ 메뉴 → 조건으로 감싸기 (마지막 블록)
  await page.evaluate(() => {
    const items = document.querySelectorAll('.script-canvas .stack.depth-0 > .stack-item > .block');
    items[items.length - 1].querySelector('.block-more').click();
  });
  await sleep(100);
  await page.evaluate(() => [...document.querySelectorAll('.block-more-menu button')].find((b) => b.textContent === '조건으로 감싸기').click());
  await sleep(200);
  expect('조건으로 감싸기', (await count('.script-canvas .c-block')) >= 1);

  // 4. 빈 조건 칸에서 '확률' 고르기
  await page.evaluate(() => {
    const sel = document.querySelector('.script-canvas .c-block .cslot.empty select');
    sel.value = 'chance';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(200);
  const condText = await page.$eval('.script-canvas .c-block .cblock', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  expect('조건 고르기', condText.includes('확률'), condText.slice(0, 40));

  // 5. 수식 보기
  await page.evaluate(() => document.querySelector('.script-canvas .c-block .cond-mode').click());
  await sleep(150);
  const exprText = await page.$eval('.script-canvas .c-block .cond-text input', (e) => e.value).catch(() => '');
  expect('조건이 수식으로 저장됨', exprText === 'chance(30)', exprText);
  await page.evaluate(() => document.querySelector('.script-canvas .c-block .cond-mode').click());
  await sleep(100);

  // 6. 감싼 블록 밖의 첫 블록을 조건 안으로 끌어 옮기기
  await sleep(900);
  const outside = await count('.script-canvas .stack.depth-0 > .stack-item');
  const inside0 = await count('.script-canvas .c-block .c-mouth .stack-item');
  const r3 = await drag(
    () => document.querySelectorAll('.script-canvas .stack.depth-0 > .stack-item > .block')[0],
    () => document.querySelector('.script-canvas .c-block .c-mouth .gap'),
  );
  await sleep(300);
  const outside2 = await count('.script-canvas .stack.depth-0 > .stack-item');
  const inside = await count('.script-canvas .c-block .c-mouth .stack-item');
  expect('블록 옮기기(밖 → 조건 안)', r3 === 'ok' && outside2 === outside - 1 && inside === inside0 + 1, `${r3} 밖 ${outside}→${outside2}, 안 ${inside0}→${inside}`);
  await shot('b02_trigger_edited');

  // 7. 자기 안으로는 못 넣는다
  const r4 = await drag(
    () => document.querySelector('.script-canvas .stack.depth-0 > .stack-item > .c-block'),
    () => document.querySelector('.script-canvas .c-block .c-mouth .gap'),
  );
  await sleep(200);
  expect('자기 안으로 넣기 거부', (await count('.script-canvas .stack.depth-0 > .stack-item')) === outside2, r4);

  // 8. 되돌리기 한 번에 옮기기 전체가 되돌아간다
  await page.click('.topbar');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);
  expect('옮기기 되돌리기', (await count('.script-canvas .stack.depth-0 > .stack-item')) === outside, `${await count('.script-canvas .stack.depth-0 > .stack-item')}`);

  // 9. 이벤트: 묶어 보기, 세부 설정 접힘
  await page.goto(`${base}/events`);
  await sleep(400);
  await page.evaluate(() => {
    const sel = document.querySelector('.collection-group select');
    sel.value = 'stage';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(200);
  const evHeads = await page.$$eval('.collection-list .group-head', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  expect('이벤트 단계 › 조건 묶음', evHeads.length >= 3, evHeads.slice(0, 6).join(' | '));
  expect('세부 설정 접힘 칸', (await count('.event-editor .more')) >= 1);
  expect('선택지는 접힌 채 시작', (await count('.event-editor .choice-card:not(.open)')) >= 1);
  await shot('b03_events');
  await page.evaluate(() => document.querySelector('.choice-card')?.scrollIntoView());
  await sleep(100);
  await shot('b04_choice');

  // 9b. 집필 모드: 열고, 본문 고치고, 다음 이벤트로, Esc로 닫기
  await page.evaluate(() => [...document.querySelectorAll('.event-editor button')].find((b) => b.textContent.includes('집필 모드')).click());
  await sleep(200);
  expect('집필 모드 열림', (await count('.manuscript-sheet')) === 1);
  await page.focus('.manuscript-body');
  await page.keyboard.type(' 원고 테스트');
  await sleep(150);
  await shot('b04b_manuscript');
  const typed = await page.$eval('.manuscript-body', (e) => e.value.endsWith(' 원고 테스트'));
  expect('집필 모드에서 본문 수정', typed);
  const t1 = await page.$eval('.manuscript-title', (e) => e.value);
  await page.evaluate(() => [...document.querySelectorAll('.manuscript-bar .link')].pop().click());
  await sleep(200);
  const t2 = await page.$eval('.manuscript-title', (e) => e.value);
  expect('다음 이벤트로 넘기기', t1 !== t2, `${t1} → ${t2}`);
  await page.keyboard.press('Escape');
  await sleep(150);
  expect('Esc로 닫기', (await count('.manuscript-sheet')) === 0);

  // 9c. 간단히 / 자세히
  const poolCheck = await page.evaluate(() => [...document.querySelectorAll('.event-editor .check')].some((c) => c.textContent.includes('턴마다 무작위로')));
  const poolInputSimple = await page.evaluate(() => [...document.querySelectorAll('.event-editor .sentence')].some((s) => s.textContent.includes('주머니에서')));
  expect('간단히: 주머니 이름 대신 체크', poolCheck && !poolInputSimple);
  const navSimple = await count('.sidenav a');
  await page.evaluate(() => [...document.querySelectorAll('.nav-mode button')].find((b) => b.textContent === '자세히').click());
  await sleep(150);
  const navDetail = await count('.sidenav a');
  expect('자세히 모드에서 메뉴가 늘어남', navDetail > navSimple, `${navSimple} → ${navDetail}`);
  expect('자세히 모드에서 세부 설정 펼침', (await count('.event-editor .more.open')) >= 1);
  const poolName = await page.evaluate(() => [...document.querySelectorAll('.event-editor .sentence')].find((s) => s.textContent.includes('주머니에서'))?.querySelector('input')?.value);
  expect('자세히: 주머니 이름 칸', poolName === '기본', poolName);
  await shot('b04c_detail_pool');
  await page.evaluate(() => [...document.querySelectorAll('.nav-mode button')].find((b) => b.textContent === '간단히').click());
  await sleep(150);

  // 10. 도움말: 화면의 '도움말' 링크 → 해당 항목
  await page.evaluate(() => document.querySelector('.event-editor .help-link').click());
  await sleep(300);
  const helpTitle = await page.$eval('.help-article h2', (e) => e.textContent).catch(() => '');
  expect('도움말 링크 → 이벤트 항목', helpTitle === '이벤트', helpTitle);
  await shot('b05_help');
  await page.goto(`${base}/help/conditions`);
  await sleep(300);
  await shot('b05b_help_conditions');
  const tocCount = await count('.help-toc button');
  expect('도움말 목차', tocCount >= 30, String(tocCount));

  // 10-0. 조건이 안 맞을 때 안내: 자동 문구가 회색으로 미리 보인다
  await page.goto(`${base}/events/first_love`);
  await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card')][1].querySelector('.choice-toggle').click());
  await sleep(150);
  const ph = await page.$eval('.event-editor .choice-card.open .requires-text input', (e) => `${e.placeholder}|${e.value}`).catch(() => '');
  expect('대신 보일 안내 자동 문구(회색)', ph === '필요: 글 2 이상|', ph);
  await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card')][1].querySelector('.choice-toggle').click());
  await sleep(100);

  // 10-. 판정 확률을 직접 정하기
  await page.goto(`${base}/events/first_love`);
  await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card')][2].querySelector('.choice-toggle').click());
  await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card.open .mode-tabs button')].find((b) => b.textContent.includes('성공·실패')).click());
  await sleep(200);
  const chanceSentence = await page.$eval('.event-editor .choice-card.open .sentence:has(select)', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const chanceValue = await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card.open .sentence')].find((s) => s.textContent.includes('성공 확률은'))?.querySelector('.expr input')?.value);
  expect('판정 확률 직접 입력(기본 50%)', chanceValue === '50', `${chanceValue} · ${chanceSentence.slice(0, 40)}`);
  await shot('b08a_check_chance');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);

  // 10a. 이어지는 선택지: 첫 선택지를 펼쳐 이어지는 선택지를 넣고, 테스트 플레이로 확인
  await page.goto(`${base}/events/first_love`);
  await sleep(400);
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.event-editor .choice-card')][2];
    if (!card.classList.contains('open')) card.querySelector('.choice-toggle').click();
  });
  await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll('.event-editor .choice-card.open .add-next')][0].click());
  await sleep(150);
  await page.focus('.event-editor .next-choices .choice-text input');
  await page.keyboard.type('그래도 말을 건다');
  await sleep(900);
  expect('이어지는 선택지 추가', (await count('.event-editor .next-choices .choice-card')) === 1);
  await shot('b08b_next_choices');
  await page.evaluate(() => [...document.querySelectorAll('.event-editor button')].find((b) => b.textContent.includes('여기부터 테스트')).click());
  await sleep(700);
  const pickThird = () =>
    page.evaluate(() => {
      const s = document.querySelector('.testplay .scene');
      if (document.querySelector('.testplay .skip-hint')) s.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return true;
    });
  await pickThird();
  await sleep(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.testplay .choices button.choice')];
    b[2]?.click();
  });
  await sleep(300);
  await pickThird();
  await sleep(200);
  const nextTexts = await page.$$eval('.testplay .choices button.choice .choice-text', (els) => els.map((e) => e.textContent));
  expect('플레이에서 이어지는 선택지가 뜸', nextTexts.includes('그래도 말을 건다'), nextTexts.join(' / '));
  await shot('b08c_next_choices_play');
  const hudName = await page.$eval('.testplay .hud-who strong', (e) => e.textContent).catch(() => '');
  expect('이름을 정한 샘플은 이름이 보임', hudName === '아이', hudName);
  await page.keyboard.press('Escape');
  await sleep(200);

  // 10b. 테스트 플레이 진행 로그
  await page.goto(`${base}/events`);
  await sleep(300);
  await page.keyboard.press('F5');
  await sleep(700);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const scene = document.querySelector('.testplay .scene');
      if (!scene) return;
      if (document.querySelector('.testplay .skip-hint')) return scene.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const name = document.querySelector('.testplay .name-form button');
      if (name) return name.click();
      const b = [...scene.querySelectorAll('.choices button.choice:not(:disabled)')];
      b[0]?.click();
    });
    await sleep(120);
  }
  const rows = await count('.testplay .trace-row');
  const rollRows = await count('.testplay .trace-row.k-pick, .testplay .trace-row.k-roll');
  expect('진행 로그 기록', rows > 10 && rollRows > 0, `${rows}줄 (확률 ${rollRows})`);
  await shot('b09_testplay_log');
  await page.evaluate(() => [...document.querySelectorAll('.trace-bar button')].find((b) => b.textContent === '확률').click());
  await sleep(150);
  await shot('b09b_testplay_log_chance');
  await page.keyboard.press('Escape');
  await sleep(200);

  // 10c. +1 ▲▼ 칸: 상태의 '체력 -1' 블록
  await page.goto(`${base}/statuses`);
  await sleep(400);
  const step = '.block:not(.hat) .stepper';
  const val = () => page.$eval(`${step} input`, (e) => e.value);
  const v0 = await val();
  await page.click(`${step} .stepper-buttons button:first-child`);
  await page.click(`${step} .stepper-buttons button:first-child`);
  await sleep(150);
  const v1 = await val();
  await page.click(`${step} input`, { clickCount: 3 });
  await page.keyboard.type('-5');
  await page.keyboard.press('ArrowDown');
  await sleep(150);
  await page.click('.panel-head');
  await sleep(150);
  const v2 = await val();
  expect('+/- 칸과 ▲▼', v0 === '-1' && v1 === '+1' && v2 === '-6', `${v0} → ▲▲ ${v1} → '-5'+↓ ${v2}`);
  await shot('b10_stepper');

  // 11. 섹션들이 오류 없이 그려진다
  for (const s of ['actions', 'origins', 'items', 'statuses', 'scripts', 'stages', 'endings', 'achievements', 'variables', 'settings', 'meta', 'check', 'flow']) {
    await page.goto(`${base}/${s}`);
    await sleep(250);
  }
  await page.goto(`${base}/variables`);
  await sleep(250);
  await shot('b06_variables');
  await page.goto(`${base}/endings`);
  await sleep(250);
  await shot('b07_endings');
  await page.goto(`${base}/settings`);
  await sleep(250);
  await shot('b08_settings');} catch (e) {
  failed++;
  console.error('오류:', e);
} finally {
  if (errors.length) {
    failed++;
    console.log('브라우저 오류:\n' + errors.join('\n'));
  }
  console.log(failed ? `실패 ${failed}` : '모두 통과');
  await browser.close();
  process.exit(failed ? 1 : 0);
}
