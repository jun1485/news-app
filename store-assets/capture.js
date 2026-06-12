// 스토어 스크린샷 자동 캡처 — 라이브 웹 배포본을 헤드리스 Edge로 순회 촬영
const puppeteer = require('puppeteer-core');

const URL = 'https://jun213-news-app.expo.app';
const OUT = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// 지정 시간 대기
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 본문 텍스트 포함 요소 클릭(완전일치 우선, 없으면 포함일치)
async function clickByText(page, text) {
  await page.evaluate((t) => {
    const all = [...document.querySelectorAll('div,span')];
    const exact = all.filter((e) => e.textContent.trim() === t);
    const partial = all.filter((e) => e.textContent.includes(t) && e.textContent.trim().length <= t.length + 4);
    const el = (exact.length ? exact : partial).pop();
    if (el) el.click();
  }, text);
}

// 본문에 텍스트 등장까지 대기
async function waitText(page, text, timeout = 30000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // 1) 온보딩 — 관심사·키워드 선택 상태 연출
  await waitText(page, '관심사를 선택해주세요');
  await clickByText(page, 'IT/과학');
  await clickByText(page, '경제');
  await page.evaluate(() => {
    const input = document.querySelector('input');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'AI');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(300);
  await clickByText(page, '추가');
  await sleep(600);
  await page.screenshot({ path: `${OUT}/shot-1-onboarding.png` });
  console.log('1/4 온보딩 캡처 완료');

  // 2) 피드 — 카드 로딩·등장 애니메이션 종료 대기
  await clickByText(page, '시작하기');
  await waitText(page, '오늘의 뉴스');
  await waitText(page, '마지막 갱신', 60000).catch(() => {});
  await sleep(2000);
  await page.screenshot({ path: `${OUT}/shot-2-feed.png` });
  console.log('2/4 피드 캡처 완료');

  // 3) 상세 — 첫 뉴스 카드 진입
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="button"]')];
    const card = btns.find((b) => (b.textContent || '').trim().length > 30);
    if (card) card.click();
  });
  await waitText(page, '원문 보기');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/shot-3-detail.png` });
  console.log('3/4 상세 캡처 완료');

  // 4) 설정 — 상세 닫기 후 탭 전환
  await clickByText(page, '뒤로');
  await sleep(900);
  await clickByText(page, '설정');
  await waitText(page, '관심사 편집');
  await sleep(800);
  await page.screenshot({ path: `${OUT}/shot-4-settings.png` });
  console.log('4/4 설정 캡처 완료');

  await browser.close();
})().catch((e) => {
  console.error('캡처 실패:', e.message);
  process.exit(1);
});
