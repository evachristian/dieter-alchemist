// 과수원 · 사과 게임을 **진짜 화면에서 끌어 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「게임이 도는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 과수원 형 맵을 누르면 **채집 대신** 사과 게임이 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · 판이 10×12 이고 **시작하자마자 지울 수 있는 네모가 있는가**
//   · **진짜 마우스 드래그**로 합 10을 고르면 지워지고 점수가 오르는가
//   · 합이 10이 아니면 **아무것도 안 지워지고 잃는 것도 없는가**
//   · 지워진 칸을 **건너뛰어** 고를 수 있는가
//   · 끝나면 **점수만큼** 재료가 가방에 들어오는가 (`REWARD_PER`)
//   · 퀘스트의 「채집 n번」이 **한 걸음** 오르는가
//
// 사용: node tools/checkapple.js      (종료 코드 0 = 통과)
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
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Apple,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const orch = D.MAPS.filter(m => D.mapType(m.id) === 'orchard');
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      orchard: orch.map(m => m.id), orchardN: orch.length, plainN: plain.length,
      first: orch[0] && orch[0].id,
      zones: [...new Set(orch.map(m => m.zone))],
      mini: orch[0] ? D.fieldMini(orch[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.orchardN > 0, '과수원 형 맵이 있다', `${kinds.orchardN}곳`);
  ok(kinds.zones.length >= 2, '과수원이 지대 둘 이상에 걸쳐 있다 (지대의 다른 이름이 아니다)',
     kinds.zones.join(','));
  ok(kinds.plainN > kinds.orchardN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.orchardN}`);
  ok(kinds.mini === 'apple', '과수원 형은 사과 게임으로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Apple.start()` 를 직접 부르면
  //    `gather()` 의 갈래(형 → 미니게임)를 통째로 건너뛰어, 그 줄을 지워도 통과한다
  const mapId = kinds.first;
  const before = await page.evaluate(() => S.energy);
  await page.evaluate((id) => {
    switchTab('gather'); setGatherTab('field');
    const m = D.MAPS.find(x => x.id === id);
    // 그 지대가 열려 있어야 카드가 뜬다
    S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
    render();
  }, mapId);
  await page.waitForTimeout(120);
  const tapped = await page.evaluate((id) => {
    const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
    if (!b) return '카드가 없다';
    b.click();
    return null;
  }, mapId);
  ok(!tapped, '과수원 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(200);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('appleGame'),
    playing: window.Apple.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 사과 게임이 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다.** 게임이 안 떴는데 그대로 내려가면
  // 다음 줄이 `_state().grid` 를 읽다 터지고, 크래시는 **무엇이 틀렸나를 안 알려 준다**
  // (`checklore` 에서 배운 것과 같다 — 미니게임 갈래를 지우는 사보타주로 실제로 겪었다)
  if (!opened.playing) return done(browser, page, errs);

  // ── 카드에 딱지가 있었는가 (들어가기 «전»에 알려 준다)
  // ⚠️ 게임이 떠 있는 동안에도 카드는 문서에 남아 있다
  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/사과|Apple/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  // ── 판
  const b0 = await page.evaluate(() => {
    const st = Apple._state();
    const flat = st.grid.flat();
    return {
      ...Apple.boardState(),
      min: Math.min(...flat), max: Math.max(...flat),
      cell: st.cell, ox: st.ox, oy: st.oy,
    };
  });
  ok(b0.rows === 12 && b0.cols === 10, '판은 10×12 다', `${b0.cols}×${b0.rows}`);
  ok(b0.alive === 120, '사과 120개로 시작한다', String(b0.alive));
  ok(b0.min >= 1 && b0.max <= 9, '숫자는 1~9 다', `${b0.min}~${b0.max}`);
  ok(!!b0.hint, '시작하자마자 지울 수 있는 네모가 있다 (막힌 판으로 시작하지 않는다)');
  ok(b0.cell > 8, '칸이 화면에 맞게 잡혔다', `${Math.round(b0.cell)}px`);

  // ── **진짜 마우스로 끈다.** `_play()` 로만 재면 드래그 → 칸 좌표 변환이
  //    통째로 틀려도 통과한다 (`checktut` 이 `el.click()` 을 안 쓰는 것과 같은 이유다)
  const dragCells = async (r1, c1, r2, c2) => {
    const box = await page.evaluate(() => {
      const r = document.querySelector('#appleGame .ap-canvas').getBoundingClientRect();
      const st = Apple._state();
      return { l: r.left, t: r.top, cell: st.cell, ox: st.ox, oy: st.oy };
    });
    const pt = (r, c) => ({
      x: box.l + box.ox + c * box.cell + box.cell / 2,
      y: box.t + box.oy + r * box.cell + box.cell / 2,
    });
    const a = pt(r1, c1), z = pt(r2, c2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2);
    await page.mouse.move(z.x, z.y);
    await page.mouse.up();
    await page.waitForTimeout(60);
  };

  const h = b0.hint;
  const rectN = (h.r2 - h.r1 + 1) * (h.c2 - h.c1 + 1);
  await dragCells(h.r1, h.c1, h.r2, h.c2);
  const b1 = await page.evaluate(() => Apple.boardState());
  ok(b1.score > 0, '끌어서 합 10을 고르면 사과가 지워진다', `점수 ${b1.score}`);
  ok(b1.alive === 120 - b1.score, '지운 만큼만 사라진다',
     `남은 ${b1.alive} · 지운 ${b1.score}`);
  ok(b1.score <= rectN, '네모 «안»의 것만 지워진다', `네모 ${rectN}칸 · 지운 ${b1.score}`);
  ok(b1.moves === 1, '한 수로 센다', String(b1.moves));

  // ── 틀린 합 — **아무 일도 안 일어나야 한다**
  const wrong = await page.evaluate(() => {
    const st = Apple._state();
    // 합이 10이 아닌 네모를 하나 찾는다
    for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++) {
      const s = st.grid[r][c] + st.grid[r][c + 1];
      if (s > 0 && s !== 10) return { r, c };
    }
    return null;
  });
  if (wrong) {
    const s0 = (await page.evaluate(() => Apple.boardState()));
    await dragCells(wrong.r, wrong.c, wrong.r, wrong.c + 1);
    const s1 = await page.evaluate(() => Apple.boardState());
    ok(s1.score === s0.score && s1.alive === s0.alive,
       '합이 10이 아니면 한 알도 안 지워진다 (틀려도 잃는 것이 없다)',
       `${s0.score}→${s1.score} · 남은 ${s0.alive}→${s1.alive}`);
    ok(s1.lastSum !== 10, '그 네모의 합을 제대로 셌다', `합 ${s1.lastSum}`);
  } else {
    ok(false, '합이 10이 아닌 네모를 못 찾았다 (검사가 이 갈래를 못 쟀다)');
  }

  // ── **지워진 칸을 건너뛴다** — 이 게임의 재미가 그것이다
  const jump = await page.evaluate(() => {
    const st = Apple._state();
    const P = [];
    for (let r = 0; r <= 12; r++) P.push(new Array(11).fill(0));
    for (let r = 0; r < 12; r++) for (let c = 0; c < 10; c++)
      P[r + 1][c + 1] = st.grid[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
    const sum = (r1, c1, r2, c2) => P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1];
    // 빈 칸을 «품고» 있으면서 합이 10인 네모
    for (let r1 = 0; r1 < 12; r1++) for (let r2 = r1; r2 < 12; r2++)
      for (let c1 = 0; c1 < 10; c1++) for (let c2 = c1; c2 < 10; c2++) {
        if (sum(r1, c1, r2, c2) !== 10) continue;
        let holes = 0;
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!st.grid[r][c]) holes++;
        if (holes > 0) return { r1, c1, r2, c2, holes };
      }
    return null;
  });
  if (jump) {
    const s0 = await page.evaluate(() => Apple.boardState());
    await dragCells(jump.r1, jump.c1, jump.r2, jump.c2);
    const s1 = await page.evaluate(() => Apple.boardState());
    ok(s1.score > s0.score, '지워진 칸을 건너뛰어 고를 수 있다',
       `빈 칸 ${jump.holes}개를 품은 네모 · 점수 ${s0.score}→${s1.score}`);
  } else {
    // 첫 수가 한 줄짜리였으면 이런 네모가 아직 없을 수 있다 — «못 쟀다»고 알린다
    ok(true, '건너뛰는 네모는 아직 안 생겼다 (이번 판에서는 못 쟀다)');
  }

  // ── 끝났을 때 **점수가 재료가 되는가**
  //
  // ⚠️ **점수를 «벌어 놓고» 잰다.** 앞의 드래그 두 번은 점수가 4~7 이라 재료가 0개인데,
  // 그러면 「0개 이상 들어온다」가 **무슨 값을 넣어도 통과**한다 (스스로 맞는 검사다).
  // 여기서는 남은 수를 계속 두어 **반드시 재료가 나오는 점수**까지 올린다.
  // 드래그가 진짜로 먹는지는 위에서 **마우스로** 이미 쟀으므로 여기는 `_play` 로 빠르게 둔다
  const earned = await page.evaluate(() => {
    const want = Apple.REWARD_PER * 3;
    for (let i = 0; i < 400; i++) {
      const b = Apple.boardState();
      if (!b || b.over || b.score >= want || !b.hint) break;
      const h = b.hint;
      Apple._play(h.r1, h.c1, h.r2, h.c2);
    }
    const b = Apple.boardState();
    return { score: b ? b.score : 0, want };
  });
  ok(earned.score >= earned.want,
     '수를 이어 두면 점수가 재료가 나올 만큼 오른다 (0개짜리로 재지 않는다)',
     `점수 ${earned.score} · ${earned.want} 이상 필요`);

  const res = await page.evaluate(() => {
    const st = Apple._state();
    const score = st.score;
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const questBefore = questProgress(activeQuest() || { goal: { n: 0 } });
    Apple._finish();
    return { score, invBefore, questBefore, per: Apple.REWARD_PER,
             want: Math.min(Apple.REWARD_MAX, Math.floor(score / Apple.REWARD_PER)) };
  });
  await page.waitForTimeout(80);
  const shown = await page.evaluate(() => {
    const box = document.querySelector('#appleGame .ap-result');
    return { show: !!(box && box.classList.contains('show')),
             text: (box && box.textContent || '').trim().slice(0, 40) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  await page.evaluate(() => document.querySelector('#appleGame .ap-close').click());
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('appleGame'),
    playing: window.Apple.isPlaying(),
  }));
  ok(!after.host && !after.playing, '나가면 화면이 걷힌다');
  // ⚠️ 히든 재료가 확률로 하나 더 붙을 수 있다 — 그래서 «이상»으로 본다
  ok(after.inv - res.invBefore >= res.want,
     `점수 ${res.score} → 재료 ${res.want}개 이상이 가방에 들어온다 (${res.per}개마다 1개)`,
     `+${after.inv - res.invBefore}`);
  // ⚠️ 예전에는 `|| res.want === 0` 이 붙어 있었다 — 점수가 낮은 판에서는 그 한 줄이
  // **검사를 통째로 건너뛰었다.** 위에서 점수를 벌어 놓았으니 이제 도피구가 필요 없다
  ok(after.inv > res.invBefore, '가방이 실제로 늘었다', `${res.invBefore} → ${after.inv}`);
  ok(res.want >= 3, '잰 것이 «0개짜리 보상»이 아니다', `${res.want}개 기대`);

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('appleGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 과수원 · 사과 게임');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n사과 게임 검사 전부 통과 ✅');
}
