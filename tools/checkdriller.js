// 소풍 바위 · 바위 부수기를 **진짜 화면에서 파 본다** (미스터 드릴러 식).
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「규칙이 도는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 소풍 바위 형 맵을 누르면 **채집 대신** 갱도가 뜨는가 (AP 는 그때 나간다)
//   · **진짜 마우스**로 눌러야 파지는가 (손가락 ↔ 칸 셈이 맞는가)
//   · ⚠️ **위로는 못 파는가** — 한 번 내려가면 못 돌아가는 것이 이 게임의 전부다
//   · **같은 색 넷이 붙으면 사라지는가** · 받칠 것이 없으면 **떨어지는가**
//   · **산소가 줄고, 캡슐로 차고, 단단한 바위가 먹는가**
//   · 생명 셋 — 깔리면 하나 주는가 · 셋이면 끝나는가 · **그래도 판 만큼 가져가는가**
//   · ⚠️⚠️ **봇을 붙여 «진짜 속도»를 잰다** — 이 게임의 상한은 시간이 아니라 산소가
//     지키는데, 그 관계는 **식으로 계산하면 두 번 다 틀렸다**(`checkbalance` 의 주석)
//
// 사용: node tools/checkdriller.js      (종료 코드 0 = 통과)
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
    localStorage.setItem('dieter_alchemist_save_v1',
      JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  // **부팅을 «기다려서» 본다** — `S` 는 최상위 `let` 이라 `window.S` 로는 안 보인다
  await page.waitForFunction(
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Driller,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 300;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const dr = D.MAPS.filter(m => D.mapType(m.id) === 'driller');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return { ids: dr.map(m => m.id), n: dr.length, miniN: mini.length, plainN: plain.length,
             first: dr[0] && dr[0].id, zone: dr[0] && dr[0].zone,
             mini: dr[0] ? D.fieldMini(dr[0].id) : null };
  });
  ok(kinds.n === 1, '소풍 바위 형 맵이 «하나»다 (규칙이 다른 바위 맵으로 안 번졌다)', kinds.ids.join(','));
  ok(kinds.mini === 'driller', '소풍 바위 형은 바위 부수기로 간다', String(kinds.mini));
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Driller.start()` 를 직접 부르면
  //    `gather()` 의 갈래(형 → 미니게임)를 통째로 건너뛰어, 그 줄을 지워도 통과한다
  const mapId = kinds.first;
  const openGame = async () => {
    await page.evaluate((id) => {
      switchTab('gather'); setGatherTab('field');
      const m = D.MAPS.find(x => x.id === id);
      S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
      S.energy = 5000; render();
      setGatherZone(m.zone);                    // 목록은 지금 선 지대의 것만 그린다
    }, mapId);
    await page.waitForTimeout(140);
    await page.evaluate((id) => {
      const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
      if (b) b.click();
    }, mapId);
    await page.waitForTimeout(300);
  };
  const before = await page.evaluate(() => S.energy);
  await openGame();
  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('drillerGame'),
    playing: window.Driller.isPlaying(), energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 갱도가 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다** — 크래시는 무엇이 틀렸나를 안 알려 준다
  if (!opened.playing) return done(browser, page, errs);

  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/바위 부수기|Rock Breaker/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  const b0 = await page.evaluate(() => Driller.boardState());
  ok(b0.cells.length > 30, '갱도에 바위가 깔린다', `${b0.cells.length}칸`);
  ok(new Set(b0.cells.filter(c => c.k === 'r').map(c => c.col)).size >= 3,
     '색이 골고루 섞여 있다', `${new Set(b0.cells.filter(c => c.k === 'r').map(c => c.col)).size}가지`);
  // ⚠️ **판을 열자마자 저절로 사라질 덩어리가 있으면 안 된다** — 사람이 한 것이 아닌
  // 구멍이 생기고, 「같은 색 넷」이 규칙이 아니라 사고가 된다
  const preMerged = await page.evaluate(() => {
    const seen = new Set(); let bad = 0;
    Driller.boardState().cells.filter(c => c.k === 'r').forEach(c => {
      if (seen.has(c.r + ',' + c.c)) return;
      const g = Driller._groupAt(c.r, c.c);
      g.forEach(([r, x]) => seen.add(r + ',' + x));
      if (g.length >= Driller.MERGE) bad++;
    });
    return bad;
  });
  ok(preMerged === 0, '깔릴 때부터 «같은 색 넷»이 붙어 있지는 않다', `${preMerged}덩어리`);

  // ── ⚠️ **진짜 마우스로 누른다** — `_dig()` 로만 재면 손가락 ↔ 칸 셈이 틀려도 통과한다
  //    (호두·돌깨기·참새·바람개비에서 배운 자리다)
  const box = await page.evaluate(() => {
    const r = document.querySelector('#drillerGame .dr-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  const press = async (dx, dy, ms) => {
    const s = await page.evaluate(() => Driller.boardState());
    const top = s.pr - Math.floor(s.viewRows * 0.4);
    const x = box.left + s.ox + (s.pc + 0.5 + dx) * s.cell;
    const y = box.top + s.oy + (s.pr - top + 0.5 + dy) * s.cell;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  };
  const d0 = await page.evaluate(() => Driller.boardState());
  await press(0, 1.2, 900);                     // 아래를 눌러 본다
  const d1 = await page.evaluate(() => Driller.boardState());
  // ⚠️⚠️ **「내려갔다」만 보면 못 가른다 — 사보타주가 통과했다.** 손가락 ↔ 칸 셈을
  // 40px 어긋내면 «옆»을 파게 되는데, 옆으로 파고 나면 발밑이 비어 **떨어지면서
  // 결국 내려간다.** 그래서 「내려갔는가」는 그대로 참이 된다.
  // 아래로 파는 것과 옆으로 파는 것을 가르는 것은 **칸(열)이 그대로인가**다
  ok(d1.pr > d0.pr && d1.pc === d0.pc,
     '진짜 마우스로 아래를 누르면 «제 칸 그대로» 파고 내려간다 (손가락 ↔ 칸 셈이 맞는다)',
     `${d0.pr}줄 → ${d1.pr}줄 · 칸 ${d0.pc} → ${d1.pc}`);
  // ⚠️ **여기서 「몇 번 팠나」를 재지 않는다** — 시작 자리가 비어 있으면 파지 않고
  // «걸어서·떨어져서» 내려가므로 0 이 나온다 (판마다 갈린다). 그건 고장이 아니다.
  // 「진짜로 판다」는 아래 봇 구간에서 본다 (열두 초면 반드시 판다)

  // ── ⚠️⚠️ **위로는 못 판다** — 이 게임의 전부다
  //
  // ⚠️ **두 번 헛짚은 자리다.** ① 누르고 «난 뒤»의 자리만 보면, 한 칸 올라가도
  // 발밑이 비어 도로 떨어져 끝난 자리가 같다. ② 그래서 「제일 높이 올라간 자리」로
  // 바꿨는데, 견주는 기준을 **누르기 한참 «전»의 줄**로 잡아 놓아 그사이에 떨어진
  // 만큼이 여유가 됐다 — 사보타주(위로도 파지게 하기)가 두 번 다 통과했다.
  // 지금은 **발판을 놓아 멈춰 세우고**, 그 «선 자리»를 기준으로 잰다
  const up = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const s = Driller._state();
    s.aim = null; s.dig = null; s.air = Driller.AIR_MAX;
    // ⚠️ **없는 줄을 짚고 터지지 않는다.** 사보타주(위로도 파지게 하기)에서 사람이
    // 갱도 밖으로 올라가 `s.rows[…]` 가 undefined 가 됐고, 검사기가 그 자리에서
    // **터져 그때까지 잰 것이 통째로 사라졌다** — 크래시는 무엇이 틀렸나를 안 알려 준다
    const row = r => (r >= 0 && r < s.rows.length ? s.rows[r] : null);
    if (!row(s.pr + 1) || s.pr < 2) return { tooHigh: true };
    row(s.pr + 1)[s.pc] = { k: 'x', hp: 99, s: 1 };      // 발판 (떨어지는 중이면 여기 선다)
    await wait(250);
    if (!row(s.pr + 1) || !row(s.pr - 1) || s.pr < 2) return { tooHigh: true };
    row(s.pr + 1)[s.pc] = { k: 'x', hp: 99, s: 1 };
    row(s.pr - 1)[s.pc] = { k: 'r', col: 0, s: 1 };      // 머리 위에 «팔 수 있는» 바위
    window.__drStart = s.pr; window.__drMin = s.pr; window.__drUpAim = false;
    window.__drT = setInterval(() => {
      const st = Driller._state();
      if (!st) return;
      window.__drMin = Math.min(window.__drMin, st.pr);
      // ⚠️⚠️ **자리만 보면 못 가른다 — 세 번째로 헛짚은 자리다.** 위로 팔 수 있게
      // 만들어 놓아도 한 칸 올라가는 «순간» 발밑이 비어 도로 떨어져서, 16ms 마다
      // 들여다보는 눈에는 자리가 그대로로 보인다.
      // 이 규칙이 진짜로 말하는 것은 **「위를 누르면 조준 자체가 안 잡힌다」**이고,
      // 그것은 누르고 있는 내내 남아 있어 반드시 걸린다
      if (st.aim === 'up') window.__drUpAim = true;
    }, 16);
    return { r0: s.pr };
  });
  ok(!up.tooHigh, '위로 파 볼 만큼 내려와 있다');
  await press(0, -1.2, 900);                    // 위를 눌러 본다
  const w = await page.evaluate(() => {
    clearInterval(window.__drT);
    return { min: window.__drMin, start: window.__drStart, upAim: window.__drUpAim };
  });
  ok(!w.upAim && w.min >= w.start, '위를 눌러도 «위쪽은 조준조차 안 된다»',
     `위 조준 ${w.upAim} · 선 자리 ${w.start}줄 · 누르는 동안 제일 높이 ${w.min}줄`);
  await page.evaluate(() => {                    // 마개를 치운다
    const s = Driller._state();
    if (!s) return;
    s.aim = null; s.dig = null;
    for (let r = Math.max(0, s.pr); r <= s.pr + 2; r++) {
      const row = s.rows[r];                     // ⚠️ 없는 줄을 짚고 터지지 않는다
      if (!row) continue;
      for (let c = 0; c < row.length; c++) if (row[c] && row[c].hp === 99) row[c] = null;
    }
  });

  // ── ⚠️⚠️ **봇을 붙여 «진짜 속도»를 잰다** ────────────────────
  // 이 게임의 상한은 시간이 아니라 **산소**가 지킨다. 그런데 「파는 데 드는 시간」을
  // 식으로 계산했더니 **두 번 다 틀렸다** — 파는 단위가 덩어리라 한 번에 1~3칸을
  // 내려가고, 연쇄가 터지면 통째로 낙하한다. 그래서 여기서 진짜로 잰다.
  // 봇은 **천장이다** — 한 치도 안 쉬고 아래만 판다. 사람은 그보다 아래다.
  // ⚠️ **손으로 심어 놓은 것이 없는 «멀쩡한 갱도»에서 재야 한다** — 앞 검사가 남긴
  // 마개 하나에 봇이 갇혀 0 m/s 가 나온 적이 있다 (그 0 은 「느리다」가 아니라
  // 「아무것도 안 쟀다」였다)
  // ⚠️ **재는 동안 산소를 채워 준다.** 여기서 재는 것은 «파는 속도»이지 산소가 아니다 —
  // 안 채우면 판이 도중에 산소로 끝나 **10.8 m/s** 가 나왔고, 그건 「느리다」가 아니라
  // 「중간에 끝났다」였다. 채우고 재니 다섯 판이 17.0~21.5 로 모였다.
  // 그리고 이 쪽이 **봇에게 유리한 값**이라, 아래의 「산소가 다할 때까지 파도 못 닿는다」를
  // 넉넉한 쪽에서 재는 셈이 된다 (헐겁게 통과시키지 않는다)
  const bot = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const s = Driller._state();
    s.deep = s.pr; s.lives = Driller.LIVES; s.invulUntil = 0;
    const m0 = s.deep * Driller.ROW_M, t0 = performance.now();
    s.aim = 'down';
    // ⚠️ **20초는 재야 한다.** 12초로 재면 단단한 바위가 드문 «얕은 구간»만 재게 되어
    // 29 m/s 가 나오고, 20초면 17~21 로 모인다 — 짧게 재는 것은 게임이 아니라
    // 갱도의 «머리»를 재는 것이다
    for (let k = 0; k < 80; k++) { await wait(250); s.air = Driller.AIR_MAX; if (s.over) break; }
    s.aim = null; s.dig = null;
    const st = Driller.boardState();
    return { m: st.m - m0, ms: performance.now() - t0, lives: st.lives, over: st.over,
             digs: st.digs, merges: st.merges };
  });
  const mps = bot.m / (bot.ms / 1000);
  const capM = await page.evaluate(() => Driller.REWARD_PER * Driller.REWARD_MAX);
  const airSec = await page.evaluate(() => Driller.AIR_SEC);
  const durS = await page.evaluate(() => Driller.DUR_MS / 1000);
  ok(mps > 3, '봇이 실제로 파고 내려간다 (아무것도 안 쟀으면 여기서 걸린다)',
     `${bot.m}m / ${(bot.ms / 1000).toFixed(1)}초 = ${mps.toFixed(1)} m/s`);
  // **떨어지기만 한 것이 아니라 «파서» 내려갔는가** — 둘을 갈라 놔야
  // 「드릴이 안 도는데 통과」가 안 생긴다
  ok(bot.digs > 0 && bot.merges > 0, '파기도 하고 연쇄도 난다',
     `판 횟수 ${bot.digs} · 연쇄 ${bot.merges}번`);
  // ⚠️ **이것이 이 게임의 밸런스 줄이다** — 산소 한 통으로 갈 수 있는 깊이가 상한을
  // 넘으면, 캡슐을 주우러 도는 판단이 통째로 사라져 「아래만 누르기」가 정답이 된다
  ok(airSec * mps < capM,
     '아래만 누르는 손은 «산소가 다할 때까지» 파도 상한에 못 닿는다 (캡슐이 곧 실력이다)',
     `${airSec}초 × ${mps.toFixed(1)} m/s = ${Math.round(airSec * mps)}m < 상한 ${capM}m`);
  // 반대쪽 — 2분을 다 쓰면 닿을 수 있어야 한다. 안 그러면 상한이 아무도 못 닿는 장식이다
  ok(durS * mps >= capM, '그래도 2분을 다 쓰면 상한에 닿는다 (장식이 아니다)',
     `${durS}초 × ${mps.toFixed(1)} m/s = ${Math.round(durS * mps)}m ≥ ${capM}m`);

  // ── 덩어리 · 연쇄 · 낙하 ─────────────────────────────────────
  //
  // ⚠️⚠️ **한 줄을 통째로 비우면 «위가 통째로 무너진다» — 두 번 헛짚은 자리다.**
  // 빈 주머니를 파서 거기서 재려 했는데, 주머니 위의 뚜껑이 받칠 것을 잃고 같이
  // 떨어져 내가 심어 둔 칸 위에 쌓였다. 「사라졌나」가 false 로 나온 것은 게임이
  // 아니라 **그 뚜껑**을 본 것이다.
  // 지금은 ① **아무것도 안 치우고** 단단한 바닥을 «더해서만» 만들고
  //        ② 심은 칸에 **표식**(`s: 888`)을 붙여 그것만 따라보고
  //        ③ 정해진 시간에 한 번 재지 않고 **바뀔 때까지 지켜본다**.
  // 위에서 무엇이 떨어져 오든 «내가 심은 것»의 운명만 읽힌다
  const poll = (fn, arg, ms) => page.evaluate(async ([a, limit]) => {
    const wait = t => new Promise(r => setTimeout(r, t));
    const t0 = performance.now();
    let last = null;
    while (performance.now() - t0 < limit) {
      last = window.__drProbe(a);
      if (last.hit) return { ...last, ms: Math.round(performance.now() - t0) };
      await wait(20);
    }
    return { ...last, hit: false, ms: limit };
  }, [arg, ms]);

  // ⚠️ **산소를 채워 두고 시작한다.** 이 검사들은 벽시계로 몇 초씩 걸리는데 그동안
  // 산소가 계속 마른다 — 그러다 판이 «산소로» 끝나면 그 뒤의 검사가 전부
  // 「아무 일도 안 일어난다」로 나온다 (실제로 여덟 줄이 그렇게 빨개졌다).
  // 여기서 볼 것은 산소가 아니므로 채워 두는 것이 맞다
  const topUp = () => page.evaluate(() => {
    const s = Driller._state();
    if (s) { s.air = Driller.AIR_MAX; s.aim = null; s.dig = null; }
    return !!(s && !s.over);
  });
  ok(await topUp(), '여기까지 판이 살아 있다 (끝났으면 아래는 아무것도 안 잰 것이다)');

  const floorAt = await page.evaluate(() => {
    const s = Driller._state();
    const F = s.pr + 6;
    if (F - 2 < 0 || !s.rows[F] || !s.rows[F + 1] || !s.rows[F - 2]) return null;
    // ⚠️ **치우지 않고 «단단한 것으로 바꾸기만» 한다** — 치우면 위가 무너진다.
    // 네 줄을 통째로 바꿔야 심을 칸의 «둘레»가 다 단단해져 덩어리가 혼자 선다
    // (한 줄만 바꿨더니 위아래의 같은 색이 붙어 「셋을 놓았는데 다섯」이 됐다)
    for (let r = F - 2; r <= F + 1; r++)
      for (let c = 0; c < Driller.COLS; c++) s.rows[r][c] = { k: 'x', hp: 99, s: 1 };
    return F;
  });
  ok(floorAt !== null, '덩어리·낙하를 잴 «단단한 바닥»을 깔았다 (못 깔았으면 아무것도 안 잰 것이다)');

  // 같은 색 넷 — 바닥 바로 위에 나란히 놓고 **표식만** 따라본다
  const grouped = floorAt !== null && await page.evaluate(([F]) => {
    const s = Driller._state();
    const r = F - 1;
    for (let i = 0; i < 3; i++) s.rows[r][1 + i] = { k: 'r', col: 2, s: 888 };
    const before = Driller._groupAt(r, 1).length;
    s.rows[r][4] = { k: 'r', col: 2, s: 888 };
    const joined = Driller._groupAt(r, 1).length;
    window.__drProbe = () => {
      const row = Driller._state().rows[r];
      const left = [1, 2, 3, 4].filter(c => row[c] && row[c].s === 888).length;
      return { left, hit: left === 0 };
    };
    return { before, joined };
  }, [floorAt]);
  ok(grouped && grouped.before === 3 && grouped.joined === 4, '붙어 있는 같은 색을 한 덩어리로 센다',
     grouped ? `셋 ${grouped.before} → 넷 ${grouped.joined}` : '못 쟀다');
  const merged = grouped && await poll(null, null, 1200);
  ok(merged && merged.hit, '같은 색 «넷»이 붙으면 사라진다',
     !merged ? '못 쟀다'
     : merged.hit ? `${merged.ms}ms 만에 넷이 다 사라졌다`
     : `${merged.ms}ms 를 지켜봤는데 ${merged.left}칸이 그대로다`);

  // 낙하 — 바닥 위 한 칸을 비우고 그 위에 **표식 붙은 돌 하나**를 띄운다
  const dropped = floorAt !== null && await page.evaluate(([F]) => {
    const s = Driller._state();
    const r = F - 1, c = 0;
    s.rows[r][c] = null;                          // 바닥 바로 위 한 칸만 비운다
    s.rows[r - 1][c] = { k: 'r', col: 1, s: 777 };
    window.__drProbe = () => {
      const rows = Driller._state().rows;
      const here = rows[r][c], up = rows[r - 1][c];
      const landed = !!(here && here.s === 777);
      return { landed, stillUp: !!(up && up.s === 777), hit: landed };
    };
    return true;
  }, [floorAt]);
  const fell = dropped && await poll(null, null, 1200);
  ok(fell && fell.hit, '받칠 것이 없는 덩어리는 «한 칸 아래»로 떨어져 쌓인다',
     !fell ? '못 쟀다'
     : fell.hit ? `${fell.ms}ms 만에 바닥 위로 내려왔다`
     : `${fell.ms}ms 를 지켜봤는데 안 내려왔다 (아직 떠 있나 ${fell.stillUp})`);

  // ── 산소 — 줄고 · 캡슐로 차고 · 단단한 바위가 먹는다
  ok(await topUp(), '산소를 재기 전에도 판이 살아 있다');
  const air = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const s = Driller._state();
    s.aim = null; s.dig = null;
    s.air = 60;
    const a0 = s.air;
    await wait(600);
    const a1 = s.air;                            // 가만히 있어도 준다
    // ⚠️ 없는 줄·없는 칸을 짚고 터지지 않는다 (끝의 칸에 서 있을 수도 있다)
    const side = () => {
      const row = s.rows[s.pr];
      const c = s.pc + 1 < Driller.COLS ? s.pc + 1 : s.pc - 1;
      return row && c >= 0 && c < Driller.COLS ? { row, c, dir: c > s.pc ? 'right' : 'left' } : null;
    };
    let t = side();
    if (!t) return { a0, a1, a2: -1, a3: -1, gain: Driller.AIR_GAIN, cost: Driller.AIR_X_COST, noRoom: true };
    t.row[t.c] = { k: 'air', s: 1 };              // 캡슐을 옆에 놓고 걸어 들어간다
    s.air = 50;
    Driller._dig(t.dir);
    const a2 = s.air;
    t = side();
    if (!t) return { a0, a1, a2, a3: -1, gain: Driller.AIR_GAIN, cost: Driller.AIR_X_COST, noRoom: true };
    t.row[t.c] = { k: 'x', hp: 1, s: 1 };         // 단단한 바위를 부순다
    s.air = 80;
    Driller._dig(t.dir);
    const a3 = s.air;
    return { a0, a1, a2, a3, gain: Driller.AIR_GAIN, cost: Driller.AIR_X_COST };
  });
  ok(!air.noRoom, '산소를 잴 옆 칸이 있다 (없으면 아무것도 안 잰 것이다)');
  ok(air.a1 < air.a0, '산소는 가만히 있어도 줄어든다', `${air.a0.toFixed(1)} → ${air.a1.toFixed(1)}`);
  ok(air.a2 >= 50 + air.gain - 2, '에어 캡슐을 주우면 찬다', `50 → ${air.a2.toFixed(1)} (+${air.gain})`);
  ok(air.a3 <= 80 - air.cost + 2, '단단한 바위를 부수면 산소를 먹는다',
     `80 → ${air.a3.toFixed(1)} (−${air.cost})`);

  // ── 생명 셋 — 바람개비 밭과 같은 자리다
  //
  // ⚠️ **재기 «전»에 되돌려 놓는다.** 위의 봇이 12초 도는 동안 실제로 한 번 깔려서
  // 하트가 둘이었다 — 그대로 재면 「하트가 다 떠 있다」가 게임이 아니라
  // **앞 검사가 남긴 자국**을 잰 것이 된다 (앞 단계의 토스트를 읽던 `checkask` 와 같다)
  const lives = await page.evaluate(() => Driller.LIVES);
  await page.evaluate(() => {
    const s = Driller._state();
    s.lives = Driller.LIVES; s.dying = false; s.dead = false;
    document.querySelectorAll('#drillerGame .dr-heart').forEach(h => h.classList.remove('gone'));
  });
  const b1 = await page.evaluate(() => Driller.boardState());
  ok(b1.hearts === lives && b1.lives === lives, '하트가 다 떠 있다',
     `하트 ${b1.hearts}개 · 남은 기회 ${b1.lives} / ${lives}`);
  // 일부러 깔려 본다 — 바로 위의 덩어리를 띄워서 떨어뜨린다
  // ⚠️⚠️ **돌 «하나»만 떨어뜨린다.** 처음에는 머리 위 세 줄을 통째로 비웠는데,
  // 그러면 받칠 것을 잃은 갱도가 **통째로 무너져 여럿이 덮치고** 한 번에 기회가 둘
  // 줄었다 — 「한 번 깔리면 하나」를 재려던 자리에서 «무너짐»을 잰 것이다.
  // 머리 위 한 칸을 비우고 그 위에 돌 하나를 두면 두 틱 뒤에 정확히 한 번 덮친다
  const squash = async () => page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const s = Driller._state();
    s.aim = null; s.dig = null; s.invulUntil = 0;
    s.air = Driller.AIR_MAX;                     // 여기서 볼 것은 산소가 아니다
    const row = r => (r >= 0 && r < s.rows.length ? s.rows[r] : null);
    if (s.pr < 3 || !row(s.pr + 1) || !row(s.pr - 2)) return { tooHigh: true };
    // ⚠️⚠️ **사람이 «멈춰 선 뒤에» 떨어뜨린다 — 이것 때문에 첫 판이 헛돌았다.**
    // 앞 검사가 사람을 옆으로 옮겨 놓아 그 순간 «떨어지는 중»이었고, 돌은 사람이
    // 이미 지나간 빈 칸에 내려앉았다 (기회가 안 줄어 3 → 3). 발판을 먼저 놓아
    // 그 자리에 세운 다음에 떨어뜨린다
    row(s.pr + 1)[s.pc] = { k: 'x', hp: 9, s: 1 };
    await wait(200);
    if (s.pr < 3 || !row(s.pr - 1) || !row(s.pr - 2)) return { tooHigh: true };
    row(s.pr - 1)[s.pc] = null;
    row(s.pr - 2)[s.pc] = { k: 'x', hp: 9, s: 1 };
    const m0 = Driller.boardState().m;
    await wait(600);
    const st = Driller.boardState();
    return { lives: st.lives, hearts: st.hearts, oops: st.oops, over: st.over,
             dying: st.dying, m: st.m, keptM: st.m >= m0 };
  });
  const c1 = await squash();
  ok(!c1.tooHigh, '깔려 볼 만큼 깊이 내려와 있다 (지표에서는 머리 위가 없어 못 잰다)');
  ok(c1.lives === b1.lives - 1, '깔리면 생명이 하나 준다', `${b1.lives} → ${c1.lives}`);
  // ⚠️ **상태와 «그림»을 따로 본다** — 숫자만 세면 하트를 안 지워도 통과한다
  ok(c1.hearts === c1.lives, '화면의 하트도 같이 준다 (상태와 그림이 안 갈린다)',
     `하트 ${c1.hearts}개 · 남은 기회 ${c1.lives}`);
  const say = await page.evaluate(() => {
    const el = document.querySelector('#drillerGame .dr-oops.show');
    return { on: !!el, text: el ? el.textContent.trim() : '', face: !!(el && el.querySelector('svg')) };
  });
  ok(say.on && say.text.length > 4, '공주가 「아이쿠」 하고 한마디 한다', say.text.slice(0, 30));
  ok(say.face, '그 옆에 공주 얼굴이 있다 (대사만 뜨지 않는다)');
  ok(c1.keptM, '깔려도 판 깊이는 그대로다 (재료는 한 톨도 안 잃는다)', `${c1.m}m`);

  const c2 = await squash();
  ok(!c2.tooHigh && !c2.over && !c2.dying, '두 번째까지는 안 끝난다 (생명이 셋인 뜻이 있다)',
     `남은 기회 ${c2.lives}`);
  const c3 = await squash();
  ok(c3.lives === 0 && (c3.dying || c3.over), '세 번 깔리면 끝난다',
     `남은 기회 ${c3.lives} · 끝나는중 ${c3.dying}`);
  ok(c3.hearts === 0, '하트가 하나도 안 남는다', `${c3.hearts}개`);

  // ── ⚠️ **그래도 판 만큼은 그대로 가져간다** (돌깨기·바람개비 밭과 같은 자리)
  const res = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const inv0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const s = Driller._state();
    // **재료가 반드시 나오는 깊이까지 심어 놓고** 잰다 — 0개짜리 도피구를 안 둔다
    const want = 4;
    s.deep = Math.ceil(Driller.REWARD_PER * want / Driller.ROW_M);
    await wait(Driller.OOPS_MS + 500);           // 「아이쿠」를 읽는 틈이 지나면 끝난다
    const st = Driller.boardState();
    const boxEl = document.querySelector('#drillerGame .dr-result');
    const shown = !!(boxEl && boxEl.classList.contains('show'));
    const text = boxEl ? boxEl.textContent.trim() : '';
    if (boxEl) { const c = boxEl.querySelector('.dr-close'); if (c) c.click(); }
    await wait(220);
    const inv1 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    return { over: st.over, shown, text: text.slice(0, 60), want,
             got: inv1 - inv0, host: !!document.getElementById('drillerGame') };
  });
  ok(res.over && res.shown, '「아이쿠」를 읽을 틈을 주고 결과가 뜬다', res.text.split('\n')[0]);
  ok(res.got >= res.want && res.want >= 3,
     '생명이 다해 끝나도 «판 만큼은 그대로» 가져간다 (재료는 한 톨도 안 잃는다)',
     `재료 ${res.want}개 기대 · +${res.got}`);
  ok(!res.host, '나가면 화면이 걷힌다');

  // ── 산소가 다해도 끝난다 (끝나는 길이 셋이다)
  await openGame();
  const drown = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (!Driller.isPlaying()) return { noGame: true };
    const inv0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const s = Driller._state();
    s.aim = null; s.dig = null;
    s.deep = Math.ceil(Driller.REWARD_PER * 3 / Driller.ROW_M);
    s.air = 0.2;
    await wait(500);
    const st = Driller.boardState();
    const boxEl = document.querySelector('#drillerGame .dr-result');
    const text = boxEl ? boxEl.textContent.trim() : '';
    if (boxEl) { const c = boxEl.querySelector('.dr-close'); if (c) c.click(); }
    await wait(220);
    const inv1 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    return { over: st.over, drowned: st.drowned, text: text.slice(0, 50), got: inv1 - inv0 };
  });
  if (drown.noGame) ok(false, '산소를 재려고 갱도를 다시 열었다 (안 열리면 한 번도 안 잰 것이다)');
  else {
    ok(drown.over && drown.drowned, '산소가 다하면 끝난다', drown.text.split('\n')[0]);
    ok(drown.got >= 3, '산소가 다해서 끝나도 판 만큼은 가져간다', `+${drown.got}`);
  }

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('drillerGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 소풍 바위 · 바위 부수기');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n바위 부수기 검사 전부 통과 ✅');
}
