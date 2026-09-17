// 낚시터 · 낚시를 **진짜 화면에서 낚아 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「네 걸음이 도는가」·「손맛이 있는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 낚시터 형 맵을 누르면 **채집 대신** 낚시가 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · 걸음이 **기다림 → 입질 → 씨름 → 건져 올림 → 기다림** 으로 도는가
//   · **진짜 마우스**로 입질에 누르면 채지는가 · 아무 때나 채도 벌이 없는가
//   · **누르고 있으면 그물이 올라가고 놓으면 내려오는가** (바로 따라오지 «않는가»)
//   · 그물 «안»이면 눈금이 차고 «밖»이면 빠지는가 · **빠지는 쪽이 더 느린가**
//   · 눈금이 다 차면 건지고, 0 이면 놓치는가 — **놓쳐도 잃는 것이 없는가**
//   · 건진 수만큼 재료가 가방에 들어오는가 (`REWARD_PER`)
//
// 사용: node tools/checkfish.js      (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

const out = [];
let failed = 0;
function ok(cond, msg, extra) {
  out.push(`  ${cond ? 'OK ' : '❌ '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    if (!localStorage.getItem('dieter_alchemist_save_v1'))
      localStorage.setItem('dieter_alchemist_save_v1',
        JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  // **부팅을 «기다려서» 본다** — `S` 는 최상위 `let` 이라 `window.S` 로는 안 보인다
  await page.waitForFunction(
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Fish,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const fs = D.MAPS.filter(m => D.mapType(m.id) === 'fish');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      fish: fs.map(m => m.id), fishN: fs.length, miniN: mini.length, plainN: plain.length,
      first: fs[0] && fs[0].id, zone: fs[0] && fs[0].zone,
      mini: fs[0] ? D.fieldMini(fs[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.fishN > 0, '낚시터 형 맵이 있다', kinds.fish.join(','));
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);
  ok(kinds.mini === 'fish', '낚시터 형은 낚시로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Fish.start()` 를 직접 부르면
  //    `gather()` 의 갈래(형 → 미니게임)를 통째로 건너뛰어, 그 줄을 지워도 통과한다
  const mapId = kinds.first;
  const before = await page.evaluate(() => S.energy);
  await page.evaluate((id) => {
    switchTab('gather'); setGatherTab('field');
    const m = D.MAPS.find(x => x.id === id);
    S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
    render();
    setGatherZone(m.zone);                    // 목록은 지금 선 지대의 것만 그린다
  }, mapId);
  await page.waitForTimeout(120);
  const tapped = await page.evaluate((id) => {
    const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
    if (!b) return '카드가 없다';
    b.click();
    return null;
  }, mapId);
  ok(!tapped, '낚시터 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(220);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('fishGame'),
    playing: window.Fish.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 낚시가 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다** — 크래시는 무엇이 틀렸나를 안 알려 준다
  if (!opened.playing) return done(browser, page, errs);

  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/낚시|Fishing/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  // 화면 가운데를 누르는 손 (낚싯줄 자리를 피해 아무 데나)
  const at = async () => page.evaluate(() => {
    const r = document.querySelector('#fishGame .fs-canvas').getBoundingClientRect();
    return { x: r.left + r.width * 0.72, y: r.top + r.height * 0.78 };
  });
  const press = async (ms) => {
    const p = await at();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    if (ms) await page.waitForTimeout(ms);
    await page.mouse.up();
  };

  // ── 걸음이 도는가 — 처음에는 «기다림»이다
  const s0 = await page.evaluate(() => Fish.boardState());
  ok(s0.phase === 'wait', '처음에는 찌를 드리우고 기다린다', s0.phase);
  ok(s0.got === 0, '아직 아무것도 안 건졌다', String(s0.got));

  // ⚠️ **아무 때나 눌러도 벌이 없다** — 「틀려도 잃는 것이 없다」가 이 게임들의 규칙이다
  await press(60);
  const s1 = await page.evaluate(() => Fish.boardState());
  ok(s1.phase === 'wait' && s1.missed === 0,
     '입질 전에 눌러도 벌이 없다 (그냥 아무 일도 안 일어난다)', `${s1.phase} · 놓침 ${s1.missed}`);

  // ── 입질 → **진짜로 눌러서** 챈다
  await page.evaluate(() => Fish._bite());
  await page.waitForTimeout(60);
  const s2 = await page.evaluate(() => Fish.boardState());
  ok(s2.phase === 'bite', '기다리면 입질이 온다', s2.phase);
  await press(60);
  const s3 = await page.evaluate(() => Fish.boardState());
  ok(s3.phase === 'fight', '입질에 누르면 챈다 (씨름이 시작된다)', s3.phase);
  ok(s3.gauge > 0.2 && s3.gauge < 0.8, '눈금이 절반쯤 차 있은 채로 시작한다 (시작하자마자 안 놓치게)',
     s3.gauge.toFixed(2));

  // ── **누르고 있으면 올라가고 놓으면 내려온다** ───────────────
  // ⚠️ `_hold(true)` 로만 재면 손가락 → 화면 연결이 끊겨도 통과한다.
  // **진짜 마우스로 누른 채** 그물이 «올라가는지»를 본다
  const barA = (await page.evaluate(() => Fish.boardState())).bar;
  const p = await at();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(420);
  const barB = (await page.evaluate(() => Fish.boardState())).bar;
  await page.mouse.up();
  await page.waitForTimeout(700);
  const barC = (await page.evaluate(() => Fish.boardState())).bar;
  ok(barB < barA - 0.02, '누르고 있으면 그물이 올라간다', `${barA.toFixed(2)} → ${barB.toFixed(2)}`);
  ok(barC > barB + 0.02, '놓으면 다시 내려온다', `${barB.toFixed(2)} → ${barC.toFixed(2)}`);
  // ⚠️ **바로 따라오면 씨름이 아니라 슬라이더다** — 0.4초를 눌러도 꼭대기에 닿으면 안 된다.
  // ⚠️ 「0.03 보다 크다」로 재면 **못 가른다**: 그물은 제 높이의 절반(여기서는 0.12)보다
  // 위로 못 올라가므로 **바로 붙어도 그 값**이라 무슨 짓을 해도 통과한다
  // (슬라이더로 바꾸는 사보타주가 실제로 이 줄을 통과했다 — 다른 검사가 대신 잡았다)
  const lid = s3.barH / 2;
  ok(barB > lid + 0.05, '누르자마자 꼭대기에 붙지는 않는다 (힘을 주는 것이지 옮기는 것이 아니다)',
     `${barB.toFixed(2)} · 꼭대기는 ${lid.toFixed(2)}`);

  // ── 눈금 — 그물 «안»이면 차고 «밖»이면 빠진다
  const gIn = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const st = Fish._state();
    st.gauge = 0.5; Fish._hold(false);
    const a = Fish.boardState().gauge;
    // ⚠️ **그물은 계속 흐른다** — 한 번 붙여 놓고 나중에 재면 이미 멀어져 있어
    // 「안에 있는데도 안 찬다」로 잘못 잡는다. 흐르는 그물을 «따라» 붙여 둔다
    for (let i = 0; i < 10; i++) { Fish._pin(Fish._state().bar); await wait(50); }
    const b = Fish.boardState();
    return { a, b: b.gauge, inBar: b.inBar };
  });
  ok(gIn.inBar && gIn.b > gIn.a, '그물 «안»에 있으면 눈금이 찬다',
     `${gIn.a.toFixed(2)} → ${gIn.b.toFixed(2)}`);
  const gOut = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const st = Fish._state();
    Fish._pin(st.bar > 0.5 ? 0.04 : 0.96);   // 그물에서 멀리 떼어 놓는다
    st.gauge = 0.6; Fish._hold(false);
    const a = Fish.boardState().gauge;
    await wait(500);
    const b = Fish.boardState();
    return { a, b: b.gauge, inBar: b.inBar };
  });
  ok(!gOut.inBar && gOut.b < gOut.a, '그물 «밖»이면 눈금이 빠진다',
     `${gOut.a.toFixed(2)} → ${gOut.b.toFixed(2)}`);
  // ⚠️ **빠지는 쪽이 더 느려야 한다** — 같으면 한 번 놓칠 때마다 본전 찾기가 된다
  const rate = await page.evaluate(() => ({ fill: Fish.CATCH_MS, drain: Fish.DRAIN_MS }));
  ok(rate.drain > rate.fill, '놓쳤을 때 빠지는 쪽이 채우는 쪽보다 느리다',
     `차는 데 ${rate.fill / 1000}초 · 빠지는 데 ${rate.drain / 1000}초`);

  // ── 다 차면 **건진다**
  const landed = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const st = Fish._state();
    st.gauge = 0.92;
    for (let i = 0; i < 40 && Fish.boardState().phase === 'fight'; i++) {
      Fish._pin(Fish._state().bar);          // 흐르는 그물을 따라 붙여 둔다
      await wait(50);
    }
    const b = Fish.boardState();
    await wait(Fish.LAND_MS + 160);
    return { phase: b.phase, got: b.got, after: Fish.boardState().phase };
  });
  ok(landed.phase === 'land' && landed.got === 1, '눈금이 다 차면 건져 올린다',
     `${landed.phase} · ${landed.got}번`);
  ok(landed.after === 'wait', '건져 올린 뒤에는 다시 찌를 드리운다', landed.after);

  // ── 0 이면 **놓친다 — 잃는 것은 없다**
  const slipped = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const got0 = Fish.boardState().got;
    Fish._bite(); Fish._hook();
    const st = Fish._state();
    Fish._pin(st.bar > 0.5 ? 0.04 : 0.96);
    st.gauge = 0.06;
    for (let i = 0; i < 40 && Fish.boardState().phase === 'fight'; i++) await wait(50);
    const b = Fish.boardState();
    return { phase: b.phase, missed: b.missed, got: b.got, got0 };
  });
  ok(slipped.phase === 'wait' && slipped.missed > 0, '눈금이 다 빠지면 놓치고 다시 기다린다',
     `${slipped.phase} · 놓침 ${slipped.missed}`);
  ok(slipped.got === slipped.got0, '놓쳐도 건진 것이 줄지 않는다 (잃는 것이 없다)',
     `${slipped.got0} → ${slipped.got}`);

  // ── **캔버스에 물과 그물이 진짜로 그려져 있는가** ────────────
  // ⚠️ `checkUI()` 의 사각지대다. 아무것도 안 그려도 대비 검사는 0건이다
  const px = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    Fish._bite(); Fish._hook();               // 씨름 화면을 세워 놓고 잰다
    const st = Fish._state();
    Fish._pin(st.bar);                        // 물고기를 그물 안에 세워 둔다
    await wait(140);
    const cvEl = document.querySelector('#fishGame .fs-canvas');
    const g = cvEl.getContext('2d');
    const dpr = cvEl.width / parseFloat(cvEl.style.width);
    const img = g.getImageData(0, 0, cvEl.width, cvEl.height).data;
    let water = 0, total = 0;
    for (let i = 0; i < img.length; i += 4 * 97) {          // 물빛은 성기게 훑어도 된다
      total++;
      if (img[i + 2] > img[i] && img[i + 1] > img[i]) water++;   // 푸른빛 > 붉은빛
    }
    // ⚠️ **줄이 선 자리는 «빽빽하게» 훑는다.** 성기게 세면 그물·물고기가 어디 있느냐에
    // 따라 열아홉 점 ↔ 스물몇 점으로 흔들려 **네 번에 한 번씩 거짓으로 빨개진다**
    // (실제로 겪었다). 줄 상자를 통째로 세면 수천 점이라 흔들릴 수가 없다
    const bx = Math.round((st.w * 0.33 - 40) * dpr), bw = Math.round(80 * dpr);
    const by = Math.round(st.h * 0.19 * dpr), bh = Math.round(st.h * 0.62 * dpr);
    const box = g.getImageData(bx, by, bw, bh).data;
    let onTrack = 0;
    for (let i = 0; i < box.length; i += 4)
      if (box[i] > 190 && box[i + 1] > 160) onTrack++;         // 크림·금빛 (그물 테·물고기)
    return { water, total, onTrack, boxN: bw * bh };
  });
  ok(px.water > px.total * 0.6, '화면이 «물빛»이다 (푸른 쪽이 붉은 쪽보다 많다)',
     `${px.water}/${px.total}점`);
  ok(px.onTrack > 400, '줄 자리에 그물과 물고기가 그려져 있다',
     `${px.onTrack}점 / ${px.boxN}점`);

  // ── 끝났을 때 **건진 수가 재료가 되는가**
  const res = await page.evaluate(() => {
    const st = Fish._state();
    st.got = 5;                                  // 다섯 번 건진 셈으로
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    Fish._finish();
    return { got: 5, invBefore, per: Fish.REWARD_PER,
             want: Math.min(Fish.REWARD_MAX, 5 * Fish.REWARD_PER) };
  });
  await page.waitForTimeout(100);
  const shown = await page.evaluate(() => {
    const box = document.querySelector('#fishGame .fs-result');
    return { show: !!(box && box.classList.contains('show')),
             text: (box && box.textContent || '').trim().slice(0, 40) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  ok(shown.text.includes('5'), '결과가 «몇 번 건졌는지»를 말한다', shown.text.split('\n')[0]);
  await page.evaluate(() => document.querySelector('#fishGame .fs-close').click());
  await page.waitForTimeout(140);

  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('fishGame'),
    playing: window.Fish.isPlaying(),
  }));
  ok(!after.host && !after.playing, '나가면 화면이 걷힌다');
  // ⚠️ 히든 재료가 확률로 하나 더 붙을 수 있다 — 그래서 «이상»으로 본다
  ok(after.inv - res.invBefore >= res.want,
     `${res.got}번 → 재료 ${res.want}개 이상이 가방에 들어온다 (한 번에 ${res.per}개)`,
     `+${after.inv - res.invBefore}`);
  ok(res.want >= 4, '잰 것이 «0개짜리 보상»이 아니다', `${res.want}개 기대`);

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('fishGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 낚시터 · 낚시');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n낚시 검사 전부 통과 ✅');
}
