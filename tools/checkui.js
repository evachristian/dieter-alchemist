// a11y.js 의 checkUI() 를 헤드리스 크로미움에서 돌리는 하네스.
//
// 화면을 손댔으면 커밋 전에 이걸 돌린다. 브라우저 콘솔에서 `await checkUI()` 를
// 치는 것과 같은 검사이고, 결과도 같다 — 사람이 창을 열지 못하는 환경(클라우드 세션·CI)을
// 위한 것이다. 예전에는 "브라우저가 없으니 검증기를 못 돌린다" 며 그냥 넘기곤 했다.
//
// 사용:
//   npm start &                       # 서버가 떠 있어야 한다
//   node tools/checkui.js                       # 지금 화면만
//   node tools/checkui.js showcase atelier gather   # 탭을 옮겨 가며
//   BASE=https://... node tools/checkui.js showcase # 배포본을 상대로
//   W=265 node tools/checkui.js showcase         # 좁은 화면에서 (UI_POLICY '가변 폭')
//   FULL=1 node tools/checkui.js showcase atelier   # 가진 것을 채우고, 접힌 것까지 펼쳐서
//   VERBOSE=1 node tools/checkui.js              # 페이지 콘솔까지 같이 출력
//
// 종료 코드: 0 = 전부 pass, 1 = 통과 못한 화면 있음, 2 = 하네스 자체가 실패
const BASE = process.env.BASE || 'http://localhost:8080';
const TABS = process.argv.slice(2);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('playwright 가 없다. `npm i -D playwright` 로 설치하거나,');
  console.error('playwright 가 설치된 디렉터리에서 이 파일을 돌린다.');
  console.error('(저장소 의존성에는 넣지 않았다 — 게임 실행에는 필요 없는 검사 도구다)');
  process.exit(2);
}

// 클라우드 세션에는 크로미움이 미리 깔려 있다. 로컬이면 playwright 가 받아 둔 것을 쓴다.
function launchOpts() {
  const preinstalled = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  try {
    if (require('fs').existsSync(preinstalled)) return { executablePath: preinstalled };
  } catch (e) {}
  return {};
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  // 창 크기가 0 이면 검증기가 '잴 수 없다' 로 pass:false 를 낸다 — 실제 크기를 준다.
  // (폭 0 상태의 0건은 통과가 아니다 — CLAUDE.md 참고)
  // 폭은 W 로 바꿀 수 있다 — .app 이 max-width:480px 이라 그보다 넓으면 결과가 같다.
  // 좁은 화면(375·320·265)은 따로 돌려야 한다: 그때만 나오는 넘침이 있다.
  const ctx = await browser.newContext({
    viewport: { width: Number(process.env.W) || 1280, height: Number(process.env.H) || 900 },
  });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  // 첫 로드 전에 localStorage 를 심어 인트로를 건너뛰고 메인 화면부터 시작한다.
  // FULL 이면 튜토리얼까지 마친 상태로 — 크리처 탭 같은 것이 잠겨 있으면 잴 수 없다.
  await page.addInitScript((full) => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      full ? { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true, crystal: 1240 }
           : { ver: 5, name: 'Tester', nameClaimed: true }));
  }, !!process.env.FULL);

  await page.goto(BASE, { waitUntil: 'load' });
  // 스플래시가 스스로 사라지길 기다리되, 안 사라지면 직접 치운다
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash');
    if (s) s.classList.add('done');
    const i = document.getElementById('intro');
    if (i) i.style.display = 'none';
  });
  await page.waitForTimeout(300);

  // ─── FULL: '가진 것' 을 채우고 접힌 것을 펼친다 ───
  // **아무것도 없는 세이브는 검사망에 큰 구멍을 남긴다.** 재료·물약이 하나도 없으면
  // 가방 칸도 선반 칸도 아예 그려지지 않아 checkUI 가 볼 것이 없고, 접혀 있는 가방은
  // display:none 이라 또 빠진다. 실제로 이 구멍에 재료 개수 글자(1.4:1)와
  // 물약 카드의 '?'(10.6px)가 오래 숨어 있었다.
  if (process.env.FULL) {
    const seeded = await page.evaluate(() => {
      if (typeof devFillItems !== 'function') return '개발용 함수가 없다';
      devFillItems();                      // 재료 전부
      const pots = D.RECIPES.filter(r => r.result.kind === 'potion').slice(0, 3);
      const crs  = D.RECIPES.filter(r => r.result.kind === 'creature').slice(0, 2);
      pots.forEach((r, i) => { S.potions[r.result.id] = i + 1; });
      S.creatures = crs.map(r => r.result.id);
      if (typeof bagOpen !== 'undefined' && !bagOpen) toggleBag();   // 채집 가방 펼치기
      // 랭킹 탭은 '여신' 단계(매력 100)부터 나타난다 — 매력을 안 주면 그 화면이
      // 통째로 검사에서 빠진다. 지난 주 결과 배너도 같이 띄워 둔다 (그것도 화면이다)
      S.stats.charm = Math.max(S.stats.charm || 0, D.LEAGUE.openAt + 40);
      S.league = 26;
      S.week = { key: weekKey(), score: 480 };
      S.leagueLast = { rank: 2, from: 25, to: 26, kind: 'up', key: weekKey() };
      // 개발용(임시) 블록도 펼친다. 접혀 있으면 display:none 이라 검사에서 통째로 빠지는데,
      // 그 안에도 화면에 뜨는 버튼이 들어 있다 (출시 전까지는 사람이 실제로 보는 자리다)
      ['gather', 'atelier', 'room'].forEach(name => {
        if (typeof toggleDevTools === 'function' && !devToolsOpen(name)) toggleDevTools(name);
      });
      save(); render();
      return null;
    });
    if (seeded) { console.error('FULL 준비 실패:', seeded); process.exit(2); }
    await page.waitForTimeout(250);
  }

  // ─── 잠긴 탭이 정말 안 보이는가 ───────────────────────────
  // **`hidden` 속성만으로는 안 숨는다.** 브라우저 기본 `[hidden]{display:none}` 은
  // 특정도가 낮아서 `.tab-btn{display:flex}` 같은 규칙에 진다 — 속성은 켜져 있는데
  // 화면에는 그대로 보인다. 실제로 랭킹 탭이 '새싹' 단계에서 보였다.
  // 그래서 속성이 아니라 **그려진 크기**로 본다.
  const gate = await page.evaluate((full) => {
    const btn = document.querySelector('.tab-btn[data-tab="league"]');
    if (!btn) return '랭킹 탭 버튼이 없다';
    const shown = btn.getBoundingClientRect().width > 0 && getComputedStyle(btn).display !== 'none';
    // FULL 이면 매력을 채웠으므로 보여야 하고, 아니면(매력 0) 안 보여야 한다
    if (full && !shown) return "매력을 채웠는데 랭킹 탭이 안 보인다";
    if (!full && shown) return "매력 0 인데 랭킹 탭이 보인다 (hidden 속성이 CSS 에 지고 있다)";
    return null;
  }, !!process.env.FULL);

  const results = [];
  if (gate) results.push({ 화면: '(탭 잠금)', 오류: gate });
  const run = async (label) => {
    // checkUI 는 async 다 — 여기서 await 하지 않으면 Promise 가 잡혀 0건으로 보인다
    const r = await page.evaluate(() => window.checkUI());
    results.push({ 화면: label, ...r, report: undefined });
  };

  if (!TABS.length) {
    await run('(현재)');
  } else {
    for (const t of TABS) {
      // 탭 이름이 틀리면 switchTab 은 모든 .screen 을 꺼 버린다. 그러면 잴 것이 없어
      // '위반 0건 · pass:true' 가 나온다 — 검사하지 않은 화면을 통과로 착각하게 된다.
      // 그래서 해당 화면이 실제로 켜졌는지까지 확인한다.
      const r = await page.evaluate((t) => {
        if (typeof window.switchTab !== 'function') return { 오류: 'switchTab 없음' };
        window.switchTab(t);
        const scr = document.getElementById('screen-' + t);
        if (!scr) return { 오류: `그런 화면이 없다 (#screen-${t})` };
        if (!scr.classList.contains('active')) return { 오류: `화면이 켜지지 않았다 (#screen-${t})` };
        return null;
      }, t);
      if (r) { results.push({ 화면: t, ...r }); continue; }
      await page.waitForTimeout(250);
      // 마이 룸은 하위 탭마다 내용이 통째로 다르다 — FULL 이면 셋을 다 돌아본다
      if (process.env.FULL && t === 'showcase') {
        for (const sub of ['clothes', 'potions', 'creatures']) {
          const bad = await page.evaluate((s) => {
            setRoomTab(s);
            return roomTab === s ? null : `하위 탭이 열리지 않았다 (${s})`;
          }, sub);
          if (bad) { results.push({ 화면: `${t}/${sub}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${sub}`);
        }
        continue;
      }
      await run(t);
    }
  }

  console.log('\n=== checkUI 결과 ===');
  for (const r of results) console.log(JSON.stringify(r));

  // pass 가 true 가 아닌 것은 전부 실패로 친다.
  // '위반 0건' 이어도 잴 수 없었던 경우(blocked·창 크기 0)가 있으므로 total 만 보지 않는다.
  const bad = results.filter(r => r.pass !== true);
  console.log(bad.length ? `\n❌ 통과 못한 화면 ${bad.length}건` : '\n✅ 전부 통과');

  if (process.env.VERBOSE) {
    console.log('\n=== 페이지 콘솔 ===');
    logs.forEach(l => console.log(l));
  }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('하네스 실패:', e); process.exit(2); });
