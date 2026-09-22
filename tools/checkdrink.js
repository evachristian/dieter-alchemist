// 물약을 **꾹 눌러 연속으로 마시는가** · 「꿀꺽」이 **한 병에 한 번** 나는가
//
// 코드만 보면 다 맞아 보인다 — 손가락 → 카드 → `drinkPotion` 사이에 끊긴 데가 있어도
// 화면에는 오류가 하나도 안 뜨고, 그냥 «한 번만 마셔지는» 카드가 된다.
// 그래서 **진짜 마우스로 누르고 있어 본다** (`page.mouse` · `el.click()` 을 쓰지 않는다 —
// 그것은 pointerdown 을 제대로 안 보내서 꾹 누르기 갈래를 통째로 건너뛴다).
//
// 보는 것 일곱:
//   ① 톡 누르면 **정확히 한 병** 준다 (꾹 누르기가 붙었다고 두 병이 되면 안 된다)
//   ② 꾹 누르고 있으면 **여러 병**이 준다
//   ③ 소리는 **줄어든 병 수와 같은 횟수**만 난다 (0 도 아니고 손짓 수도 아니다)
//   ④ 손을 떼면 멈춘다 (카드가 다시 그려져도 — 그 자리가 document 다)
//   ⑤ 다 마시면 스스로 멈춘다 (0 병에서 계속 돌면 안 된다)
//   ⑥ 끌면(스크롤) 한 병도 안 마신다
//   ⑦ 카드의 '?' 버튼은 **제 소리를 그대로 낸다** (카드의 data-nosfx 에 같이 안 걸린다)
//
// 사용: node tools/checkdrink.js  (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

const launchOpts = () => {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
};

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const bad = [], errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      { ver: 8, name: 'Gulp', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 꾹 누르기 상수는 게임에서 읽는다 — 검사기에 옮겨 적으면 값을 고쳤을 때 여기만 옛 값에 남는다
  const K = await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    // 「꿀꺽」을 센다. **`drinkPotion` 이 부르는 그 자리**를 가로채야
    // 「소리를 내는 곳이 하나인가」까지 같이 재진다
    window.__gulps = 0;
    const real = Sfx.play.bind(Sfx);
    window.__sfx = [];
    Sfx.play = function (name) { window.__sfx.push(name); if (name === 'gulp') window.__gulps++; return real(name); };
    return { delay: HOLD_DELAY, every: HOLD_EVERY, move: HOLD_MOVE };
  });

  // 물약을 n 병 쥐여 주고 선반을 연다
  const setup = n => page.evaluate((n) => {
    const D = window.GameData;
    const r = D.RECIPES.find(x => x.result.kind !== 'creature' && x.result.charm > 0);
    S.potions = {}; S.potions[r.result.id] = n;
    switchTab('showcase'); setRoomTab('stuff'); setStuffTab('potions');
    render();
    window.__gulps = 0; window.__sfx = [];
    return r.result.id;
  }, n);

  const stock = pid => page.evaluate(id => S.potions[id] || 0, pid);
  const gulps = () => page.evaluate(() => window.__gulps);

  // ⚠️ 선반은 화면 아래쪽이라 **보이는 데까지 굴려 놓고** 재야 한다 —
  // 안 그러면 마우스가 빈 곳을 누르고 「아무 일도 안 일어난다」가 나온다 (실제로 그랬다).
  // 굴리는 것은 누르기 «전»이라 스크롤 취소와 부딪히지 않는다
  const boxOf = sel => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  const cardBox = () => boxOf('#potionShelf .potion-card');

  // ── ① 톡 누르면 한 병 ──────────────────────────────────────
  let pid = await setup(9);
  let at = await cardBox();
  if (!at) { bad.push('물약 카드가 화면에 없다'); }
  else {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(120);
    const left = await stock(pid), g = await gulps();
    if (left !== 8) bad.push(`톡 눌렀는데 ${9 - left}병 줄었다 (한 병이어야 한다)`);
    if (g !== 9 - left) bad.push(`톡: 줄어든 것은 ${9 - left}병인데 「꿀꺽」은 ${g}번 났다`);
    if (g === 0) bad.push('톡 눌러 마셨는데 「꿀꺽」이 한 번도 안 났다');
  }

  // ── ②③④ 꾹 누르면 연속 · 소리는 병마다 한 번 · 떼면 멈춘다 ──
  pid = await setup(9);
  at = await cardBox();
  const HOLD_MS = K.delay + K.every * 3 + 60;       // 첫 한 번 + 세 번 더
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(HOLD_MS);
  await page.mouse.up();
  const heldLeft = await stock(pid), heldG = await gulps();
  const drank = 9 - heldLeft;
  if (drank < 2) bad.push(`꾹 눌렀는데 ${drank}병만 줄었다 (연속 소비가 안 붙었다)`);
  if (heldG !== drank) bad.push(`꾹: 줄어든 것은 ${drank}병인데 「꿀꺽」은 ${heldG}번 났다`);
  // 손을 뗀 뒤에도 계속 돌면 — 카드를 다시 그려서 pointerup 을 못 받은 것이다
  await page.waitForTimeout(K.every * 2 + 80);
  const afterUp = await stock(pid);
  if (afterUp !== heldLeft) bad.push(`손을 뗐는데 ${heldLeft - afterUp}병이 더 줄었다 (안 멈춘다)`);

  // ── ⑤ 다 마시면 스스로 멈춘다 ──────────────────────────────
  pid = await setup(2);
  at = await cardBox();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(K.delay + K.every * 4 + 60);
  await page.mouse.up();
  const endLeft = await stock(pid), endG = await gulps();
  if (endLeft !== 0) bad.push(`두 병을 오래 눌렀는데 ${endLeft}병 남았다`);
  if (endG !== 2) bad.push(`두 병뿐인데 「꿀꺽」이 ${endG}번 났다 (빈손에도 소리가 난다)`);
  const gone = await page.evaluate(() => !document.querySelector('#potionShelf .potion-card'));
  if (!gone) bad.push('다 마셨는데 카드가 아직 서 있다');

  // ── ⑥ 끌면(스크롤) 연속 소비가 «시작되지» 않는다 ──────────
  // ⚠️ **「한 병도 안 준다」로 재면 안 된다.** 진짜 손가락으로 선반을 밀면 브라우저가
  // 스크롤을 잡아 click 을 아예 안 보내는데, 합성 마우스로 24px 끄는 것은 스크롤이
  // 아니라서 손을 뗄 때 click 이 그대로 온다 — 그건 게임이 아니라 이 검사의 사정이다.
  // 여기서 지킬 것은 `HOLD_MOVE` 가 막는 것, 곧 **연속 소비가 안 돈다**는 쪽이다
  // (막는 줄을 빼면 네 병 넘게 준다 — 사보타주로 확인했다)
  pid = await setup(9);
  at = await cardBox();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y + K.move + 14, { steps: 3 });
  await page.waitForTimeout(K.delay + K.every * 3 + 60);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const dragDrank = 9 - await stock(pid);
  if (dragDrank > 1) bad.push(`끌었는데 ${dragDrank}병 줄었다 (스크롤 중에 연속 소비가 돈다)`);

  // ── ⑦ '?' 버튼은 제 소리를 낸다 ───────────────────────────
  await setup(9);
  const why = await boxOf('#potionShelf .potion-card .potion-why');
  if (!why) bad.push("카드에 '?' 버튼이 없다");
  else {
    await page.evaluate(() => { window.__sfx = []; });
    await page.mouse.click(why.x, why.y);
    await page.waitForTimeout(120);
    const heard = await page.evaluate(() => window.__sfx.slice());
    if (!heard.length) bad.push("'?' 를 눌렀는데 아무 소리도 안 난다 (카드의 data-nosfx 에 같이 걸렸다)");
    if (heard.includes('gulp')) bad.push("'?' 를 눌렀는데 「꿀꺽」이 났다 (눌러도 마셔진다)");
  }

  await browser.close();
  bad.push(...errs);
  console.log(`꾹 누르기 ${K.delay}ms → ${K.every}ms 마다 · 꾹 눌러 ${drank}병(「꿀꺽」 ${heldG}번)`);
  if (bad.length) {
    console.log('❌ ' + bad.length + '건');
    bad.forEach(b => console.log('   ' + b));
    process.exit(1);
  }
  console.log('✅ 꾹 누르면 연속으로 마시고 · 「꿀꺽」은 한 병에 한 번이다');
})();
