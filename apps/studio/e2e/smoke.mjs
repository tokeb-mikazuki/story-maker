// 브라우저 스모크 테스트: 실제 브라우저(Edge/Chrome)를 헤드리스로 띄워 홈 → 샘플 플레이 → 에디터 전 화면 → 테스트 플레이를 클릭해 본다.
// 사용: node apps/studio/e2e/smoke.mjs [URL] [스크린샷 폴더]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const BROWSERS = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];

const browser = await puppeteer.launch({ executablePath: BROWSERS[0], headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('dialog', (d) => d.accept());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const clickText = async (selector, text) => {
  const ok = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t));
      if (el) el.click();
      return !!el;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`못 찾음: ${selector} "${text}"`);
  await sleep(150);
};
const log = (...a) => console.log('•', ...a);

/** 플레이어를 엔딩까지 진행 (무작위 선택) */
async function playToEnd(label, maxSteps = 400) {
  for (let i = 0; i < maxSteps; i++) {
    const state = await page.evaluate(() => {
      const scene = document.querySelector('.scene');
      if (!scene) return 'none';
      if (scene.classList.contains('scene-end')) return 'end';
      // 타자기 건너뛰기
      if (document.querySelector('.skip-hint')) {
        scene.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        return 'skip';
      }
      const name = document.querySelector('.name-form button');
      if (name) {
        document.querySelector('.name-form input').value = '';
        name.click();
        return 'name';
      }
      const buttons = [...scene.querySelectorAll('.choices button.choice:not(:disabled)')];
      if (!buttons.length) return 'stuck';
      buttons[Math.floor(Math.random() * buttons.length)].click();
      return 'click';
    });
    if (state === 'end') {
      log(label, `엔딩 도달 (${i}스텝)`);
      return true;
    }
    if (state === 'stuck' || state === 'none') throw new Error(`${label}: 진행 불가 (${state})`);
    await sleep(state === 'skip' ? 30 : 60);
  }
  throw new Error(`${label}: ${maxSteps}스텝 안에 끝나지 않음`);
}

try {
  // 1. 홈
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await shot('01_home');
  log('홈', await page.$eval('h1', (e) => e.textContent));

  // 2. 샘플 플레이: 소금섬
  await clickText('.card.sample a', '플레이');
  await sleep(300);
  await shot('02_title');
  await clickText('button', '새로 시작');
  await sleep(300);
  await shot('03_name');
  await page.type('.name-form input', '바다');
  await page.click('.name-form button');
  await sleep(400);
  await page.evaluate(() => document.querySelector('.scene')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await sleep(200);
  await shot('04_origin');
  await playToEnd('소금섬');
  await shot('05_end');
  const endText = await page.$eval('.scene-end', (e) => e.innerText.slice(0, 400));
  log('엔딩 화면:', endText.replace(/\n+/g, ' / '));
  await sleep(500);
  await clickText('button', '이미지로 저장');
  await sleep(600);
  log('인생표 이미지 창:', (await page.$('.dialog .dialog-image')) ? '있음' : '없음');
  await shot('05b_life_image');
  await clickText('.dialog button', '닫기');
  // 타이틀로 → 기록 표시 확인
  await clickText('button', '타이틀로');
  await sleep(300);
  log('기록 패널:', (await page.$('.records')) ? '있음' : '없음');
  await shot('06_records');

  // 3. 샘플 플레이: 등대
  await page.goto(URL + '#/play/sample%3Alast-light', { waitUntil: 'networkidle0' });
  await clickText('button', '새로 시작');
  await sleep(300);
  await playToEnd('등대');
  await shot('07_lighthouse_end');

  // 4. 에디터: 샘플을 복사해서 열기
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await clickText('.card.sample button', '편집기에서 열기');
  await sleep(800);
  await shot('08_editor_flow');
  const sections = ['events', 'actions', 'origins', 'variables', 'items', 'statuses', 'tables', 'triggers', 'scripts', 'endings', 'achievements', 'meta', 'settings', 'stages', 'assets', 'check', 'json', 'help', 'flow'];
  const base = page.url().replace(/#.*/, '') + '#/edit/' + page.url().split('#/edit/')[1].split('/')[0];
  for (const s of sections) {
    await page.goto(`${base}/${s}`);
    await sleep(250);
    const len = await page.$eval('.workspace', (e) => e.innerText.length);
    if (len < 20) throw new Error(`섹션 ${s}이(가) 비어 있음`);
    if (['events', 'variables', 'triggers', 'endings', 'stages', 'check'].includes(s)) await shot(`09_${s}`);
  }
  log('에디터 섹션', sections.length, '개 모두 렌더링');

  // 이벤트 편집: 본문 수정 → 저장 표시
  await page.goto(`${base}/events/school`);
  await sleep(300);
  await page.click('.event-editor textarea');
  await page.keyboard.type(' (수정 테스트)');
  await sleep(1200);
  log('저장 상태:', await page.$eval('.save-state', (e) => e.textContent));
  // 수식 오류 표시
  await page.evaluate(() => {
    const input = document.querySelector('.event-editor .expr input.mono');
    input.focus();
  });
  await page.keyboard.type(' >= ');
  await sleep(200);
  log('수식 오류 표시:', (await page.$('.event-editor .error-text')) ? '있음' : '없음');
  await shot('10_event_edit');
  // 되돌리기
  await page.click('body');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);

  // 내보내기 창
  await clickText('.topbar button', '내보내기');
  await sleep(300);
  log('내보내기 창 JSON 길이:', await page.$eval('.dialog-text', (e) => e.value.length).catch(() => 0));
  await clickText('.dialog button', '닫기');
  // 삭제 확인 창 → 취소
  await page.goto(`${base}/items`);
  await sleep(300);
  await page.click('.li-tools .icon.danger');
  await sleep(200);
  log('삭제 확인 창:', await page.$eval('.dialog-message', (e) => e.textContent).catch(() => '없음'));
  await shot('10b_confirm');
  await clickText('.dialog button', '취소');

  // 시뮬레이션 실행
  await page.goto(`${base}/check`);
  await sleep(300);
  await clickText('button', '실행');
  await sleep(3000);
  log('시뮬레이션:', await page.$eval('.report-stats', (e) => e.innerText.replace(/\n/g, ' ')).catch(() => '결과 없음'));
  await shot('11_simulation');

  // 테스트 플레이 (이벤트부터)
  await page.goto(`${base}/events/first_love`);
  await sleep(300);
  await clickText('button', '여기부터 테스트');
  await sleep(600);
  await shot('12_testplay');
  log('테스트 플레이 장면:', await page.$eval('.testplay .scene-title', (e) => e.textContent).catch(() => '?'));
  // 디버그: 진행 로그가 쌓였는지, 변수 탭에서 값 수정
  log('진행 로그 줄 수:', await page.$$eval('.testplay .trace-row', (els) => els.length));
  await clickText('.debug .tabs button', '변수');
  await page.evaluate(() => {
    const input = document.querySelector('.debug .debug-input');
    input.focus();
    input.select();
  });
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(200);

  // 5. 새 인생형 프로젝트 → 테스트 플레이 끝까지
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await clickText('.card.new', '인생형');
  await sleep(800);
  await clickText('button', '테스트 플레이');
  await sleep(500);
  await playToEnd('새 인생형 템플릿', 600);
  await shot('13_template_end');

  log('콘솔·페이지 오류:', errors.length ? errors : '없음');
} catch (e) {
  await shot('99_failure');
  console.error('실패:', e.message);
  console.error('오류 로그:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
