// 바람개비 밭 · 바람개비 퍼즐을 **진짜 화면에서 풀어 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「규칙이 도는가」·「판이 풀리는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 바람개비 밭 형 맵을 누르면 **채집 대신** 퍼즐이 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · **진짜 마우스**로 눌러야 치워지는가 (칸 ↔ 화면 셈이 맞는가)
//   · **막힌 것은 안 나가고, 벌도 없는가** (흔들리기만 한다)
//   · ⚠️ **깔린 판이 «반드시 풀리는가»** — 끝까지 풀어 보고 한 개도 안 남는지 센다
//   · 한 수가 **연쇄로 길을 여는가** (치우고 나면 열린 것이 늘어나는가)
//   · 판을 다 비우면 **새 판이 깔리는가**
//   · 치운 수만큼 재료가 가방에 들어오는가 (`REWARD_PER` 개마다 하나)
//
// 사용: node tools/checkpinwheel.js      (종료 코드 0 = 통과)
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
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Pinwheel,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const pw = D.MAPS.filter(m => D.mapType(m.id) === 'pinwheel');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      pw: pw.map(m => m.id), pwN: pw.length, miniN: mini.length, plainN: plain.length,
      first: pw[0] && pw[0].id, zone: pw[0] && pw[0].zone,
      mini: pw[0] ? D.fieldMini(pw[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.pwN > 0, '바람개비 밭 형 맵이 있다', kinds.pw.join(','));
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);
  ok(kinds.mini === 'pinwheel', '바람개비 밭 형은 퍼즐로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Pinwheel.start()` 를 직접 부르면
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
  ok(!tapped, '바람개비 밭 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(260);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('pinwheelGame'),
    playing: window.Pinwheel.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 퍼즐이 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다** — 크래시는 무엇이 틀렸나를 안 알려 준다
  if (!opened.playing) return done(browser, page, errs);

  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/바람개비|Pinwheel/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  const b0 = await page.evaluate(() => Pinwheel.boardState());
  ok(b0.grid.length > 8, '판에 바람개비가 깔린다', `${b0.grid.length}개`);
  ok(b0.grid.some(p => p.open), '처음부터 «앞이 트인» 것이 있다 (첫 수가 막막하지 않다)',
     `${b0.grid.filter(p => p.open).length}개`);
  ok(new Set(b0.grid.map(p => p.d)).size >= 3, '방향이 골고루 섞여 있다',
     `${new Set(b0.grid.map(p => p.d)).size}가지`);

  // ── ⚠️ **진짜 마우스로 누른다** — `_tap()` 으로만 재면 칸 좌표가 어긋나도 통과한다
  //    (호두·돌깨기·참새에서 배운 자리다)
  const box = await page.evaluate(() => {
    const r = document.querySelector('#pinwheelGame .pw-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  const clickCell = async (c, r) => {
    const s = await page.evaluate(() => Pinwheel.boardState());
    await page.mouse.click(box.left + s.ox + (c + 0.5) * s.cell,
                           box.top + s.oy + (r + 0.5) * s.cell);
  };
  const open0 = b0.grid.filter(p => p.open)[0];
  await clickCell(open0.c, open0.r);
  await page.waitForTimeout(120);
  const b1 = await page.evaluate(() => Pinwheel.boardState());
  // ⚠️ **「하나가 치워졌다」로 재면 못 가른다** — 칸 셈이 한 칸 어긋나도 옆 칸에 열린 것이
  // 있으면 그것이 대신 날아가서 통과한다 (사보타주로 실제로 겪었다).
  // **누른 «그 칸»이 사라졌는지**를 봐야 한다
  const gone = !b1.grid.some(p => p.c === open0.c && p.r === open0.r);
  ok(b1.cleared === 1 && gone, '진짜 마우스로 누르면 «그 칸»이 날아간다 (칸 ↔ 화면 셈이 맞는다)',
     `치움 ${b1.cleared} · (${open0.c},${open0.r}) 사라짐 ${gone}`);
  ok(b1.flying > 0, '날아 나가는 연출이 있다 (그냥 사라지지 않는다)', `${b1.flying}개`);

  // ── 막힌 것을 누르면 «안 나가고, 생명이 하나 준다» ──────────
  //
  // ⚠️ **치운 수는 한 톨도 안 준다** — 잃는 것은 재료가 아니라 남은 시간이다
  // (돌깨기의 `rk_buried` 와 같은 자리다). 그 둘을 «같이» 봐야 한다:
  // 생명만 보면 재료를 몰래 깎아도 통과하고, 재료만 보면 생명이 안 깎여도 통과한다
  // ⚠️ **수치를 여기 옮겨 적지 않는다** — 생명 수는 게임에서 읽는다 (3 으로 박아 두면
  // `LIVES` 를 고쳤을 때 검사기만 옛 값으로 남는다)
  const LIVES = await page.evaluate(() => Pinwheel.LIVES);
  ok(LIVES >= 1 && b1.hearts === LIVES && b1.lives === LIVES, '처음에 하트가 다 떠 있다',
     `하트 ${b1.hearts}개 · 남은 기회 ${b1.lives} / ${LIVES}`);
  const blocked = b1.grid.filter(p => !p.open)[0];
  if (!blocked) {
    ok(false, '막힌 바람개비가 하나는 있다 (없으면 이 검사를 한 번도 안 한 것이다)');
  } else {
    await clickCell(blocked.c, blocked.r);
    await page.waitForTimeout(140);
    const b2 = await page.evaluate(() => Pinwheel.boardState());
    ok(b2.cleared === 1 && b2.grid.length === b1.grid.length,
       '막힌 것은 눌러도 안 나간다 (치운 수는 그대로다)',
       `치움 ${b2.cleared} · 남은 ${b2.grid.length}`);
    ok(b2.lives === b1.lives - 1, '막힌 것을 누르면 생명이 하나 준다',
       `${b1.lives} → ${b2.lives}`);
    // ⚠️ **상태와 «그림»을 따로 본다** — 숫자만 세면 하트를 안 지워도 통과한다
    ok(b2.hearts === b2.lives, '화면의 하트도 같이 준다 (상태와 그림이 안 갈린다)',
       `하트 ${b2.hearts}개 · 남은 기회 ${b2.lives}`);
    const say = await page.evaluate(() => {
      const el = document.querySelector('#pinwheelGame .pw-oops.show');
      return { on: !!el, text: el ? el.textContent.trim() : '',
               face: !!(el && el.querySelector('svg')) };
    });
    ok(say.on && say.text.length > 4, '공주가 「아이쿠」 하고 한마디 한다', say.text.slice(0, 30));
    ok(say.face, '그 옆에 공주 얼굴이 있다 (대사만 뜨지 않는다)');
    // 나머지 검사는 온전한 게임에서 해야 하니 되돌려 놓는다
    await page.evaluate(() => {
      const st = Pinwheel._state();
      st.lives = Pinwheel.LIVES; st.dying = false; st.dead = false;
      document.querySelectorAll('#pinwheelGame .pw-heart').forEach(h => h.classList.remove('gone'));
    });
  }

  // ── ⚠️⚠️ **깔린 판이 «반드시 풀리는가»** ─────────────────
  // 이 게임에서 제일 중요한 줄이다. 아무렇게나 깔면 **첫 수부터 아무것도 못 누르는 판**이
  // 나오고, 2분짜리에서 그건 그냥 빼앗긴 시간이다 (화면에는 오류 하나 안 뜬다).
  // **판 스무 개를 끝까지 풀어 본다** — 열린 것을 아무거나 계속 누르는 «멍청한» 손으로도
  // 다 비워져야 한다 (역순 생성이면 그것이 보장된다)
  const solve = await page.evaluate(() => {
    const res = { boards: 0, stuck: 0, worst: 0, chains: 0, pieces: 0 };
    for (let n = 0; n < 20; n++) {
      Pinwheel._newBoard();
      const st = Pinwheel._state();
      st.flying = []; st.refillAt = 0;
      let guard = 0, prevOpen = -1;
      for (;;) {
        if (++guard > 500) break;
        const b = Pinwheel.boardState();
        if (!b.grid.length) break;
        const open = b.grid.filter(p => p.open);
        if (!open.length) { res.stuck++; res.worst = Math.max(res.worst, b.grid.length); break; }
        // **한 수가 길을 여는가** — 치우고 나서 열린 것이 늘어난 적이 있는가
        if (prevOpen >= 0 && open.length > prevOpen) res.chains++;
        prevOpen = open.length - 1;            // 지금 하나를 치울 것이므로
        const pick = open[Math.floor(Math.random() * open.length)];
        Pinwheel._tap(pick.c, pick.r);
        st.flying = []; st.refillAt = 0;       // 연출·새 판은 여기서 안 본다
        res.pieces++;
      }
      res.boards++;
    }
    return res;
  });
  ok(solve.stuck === 0, '깔린 판은 «반드시» 끝까지 풀린다 (막히는 판이 없다)',
     `판 ${solve.boards}개 · 막힌 판 ${solve.stuck}개` + (solve.worst ? ` (${solve.worst}개 남음)` : ''));
  ok(solve.boards === 20 && solve.pieces > 300, '판 스무 개를 진짜로 다 풀어 봤다',
     `${solve.boards}판 · ${solve.pieces}개`);
  ok(solve.chains > 0, '한 수가 «연쇄로» 길을 연다 (치우면 열린 것이 늘어난다)',
     `${solve.chains}번`);

  // ── 판을 다 비우면 새 판이 깔린다
  const refill = await page.evaluate(async () => {
    const st = Pinwheel._state();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    Pinwheel._newBoard();
    st.cleared = 0;
    const b = Pinwheel.boardState();
    const before = st.boards;
    // 열린 것만 골라 끝까지 비운다
    for (let g = 0; g < 400; g++) {
      const s2 = Pinwheel.boardState();
      if (!s2.grid.length) break;
      const open = s2.grid.filter(p => p.open);
      if (!open.length) break;
      Pinwheel._tap(open[0].c, open[0].r);
    }
    const emptied = Pinwheel.boardState().grid.length === 0;
    await wait(Pinwheel.REFILL_MS + 400);
    const after = Pinwheel.boardState();
    return { emptied, before, boards: st.boards, again: after.grid.length, started: b.grid.length };
  });
  ok(refill.emptied, '열린 것만 눌러도 판이 통째로 비워진다', `${refill.started}개에서 시작`);
  ok(refill.boards > refill.before && refill.again > 8, '다 비우면 새 판이 깔린다',
     `${refill.before}판 → ${refill.boards}판 · ${refill.again}개`);

  // ── 그림 — **캔버스 픽셀을 읽어서** 잰다 ─────────────────
  // ⚠️ **재기 전에 판을 새로 깐다** — 앞 검사가 비워 놓은 판에서 재면 잴 것이 없고,
  // `grid[0]` 을 읽다 **터져서 그때까지 잰 것이 통째로 사라진다**
  // (「크래시는 무엇이 틀렸나를 안 알려 준다」 · 사보타주로 실제로 겪었다)
  await page.evaluate(() => { Pinwheel._newBoard(); Pinwheel._state().refillAt = 0; });
  await page.waitForTimeout(140);
  const px = await page.evaluate(() => {
    const cv = document.querySelector('#pinwheelGame .pw-canvas');
    const g = cv.getContext('2d');
    const k = cv.width / cv.getBoundingClientRect().width;
    const s = Pinwheel.boardState();
    if (!s.grid.length) return { none: true };
    // ① 하늘이 «푸른» 쪽인가 (노을 밀밭과 한눈에 갈려야 한다)
    const sky = g.getImageData(0, Math.round(cv.height * 0.03), cv.width, Math.round(cv.height * 0.03));
    let cool = 0, tot = 0;
    for (let i = 0; i < sky.data.length; i += 4 * 3) {
      tot++;
      if (sky.data[i + 2] > sky.data[i] + 20) cool++;
    }
    // ② 타일이 «정말» 그려지는가 — 칸 하나와 판 밖의 빈 자리를 견준다
    const box = (cx, cy) => {
      const w = Math.round(s.cell * 0.7 * k);
      const d = g.getImageData(Math.round(cx * k - w / 2), Math.round(cy * k - w / 2), w, w).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
      return set.size;
    };
    const one = s.grid[0];
    return {
      cool, tot,
      tile: box(s.ox + (one.c + 0.5) * s.cell, s.oy + (one.r + 0.5) * s.cell),
      empty: box(s.cell * 0.5, s.oy + s.cell * 0.5 - s.cell * 1.2),
    };
  });
  if (px.none) ok(false, '그림을 잴 판이 있다 (판이 비어 있으면 아무것도 안 잰 것이다)');
  ok(!px.none && px.tot > 200 && px.cool / px.tot > 0.85,
     '하늘이 «한낮의 푸른 쪽»이다 (노을 밀밭과 갈린다)', px.none ? '못 쟀다' : `${px.cool}/${px.tot}점`);
  // ⚠️ **가르는 잣대여야 한다** — 타일 자리와 «빈 자리»를 같이 재서 견준다
  ok(!px.none && px.tile >= px.empty * 2 && px.tile > 6,
     '바람개비가 칸에 그려져 있다 (빈 자리와 갈린다)',
     px.none ? '못 쟀다' : `칸 ${px.tile}가지 · 빈 자리 ${px.empty}가지`);

  // ── 결과 화면 · 재료 ─────────────────────────────────────
  const res = await page.evaluate(() => {
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    // ⚠️ **수치를 여기 옮겨 적지 않는다** — 「재료 다섯 개가 나오는 수」를 게임에서 셈한다
    const cleared = Pinwheel.REWARD_PER * 5;
    Pinwheel._state().cleared = cleared;
    Pinwheel._finish();
    return { cleared, invBefore, per: Pinwheel.REWARD_PER,
             want: Math.min(Pinwheel.REWARD_MAX, Math.floor(cleared / Pinwheel.REWARD_PER)) };
  });
  await page.waitForTimeout(120);
  const shown = await page.evaluate(() => {
    const b = document.querySelector('#pinwheelGame .pw-result');
    return { show: !!(b && b.classList.contains('show')),
             text: (b && b.textContent || '').trim().slice(0, 40) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  ok(shown.text.includes(String(res.cleared)), '결과가 «몇 개를 날렸는지»를 말한다',
     shown.text.split('\n')[0]);
  await page.evaluate(() => document.querySelector('#pinwheelGame .pw-close').click());
  await page.waitForTimeout(160);

  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('pinwheelGame'),
    playing: window.Pinwheel.isPlaying(),
  }));
  ok(!after.host && !after.playing, '나가면 화면이 걷힌다');
  // ⚠️ 히든 재료가 확률로 하나 더 붙을 수 있다 — 그래서 «이상»으로 본다
  ok(after.inv - res.invBefore >= res.want,
     `${res.cleared}개 → 재료 ${res.want}개 이상이 가방에 들어온다 (${res.per}개에 하나)`,
     `+${after.inv - res.invBefore}`);
  ok(res.want >= 4, '잰 것이 «0개짜리 보상»이 아니다', `${res.want}개 기대`);

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('pinwheelGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  // ── ⚠️ **세 번 틀리면 끝난다 — 그래도 치운 것은 그대로 가져간다** ──────
  //
  // **판을 새로 열어서 본다.** 앞의 검사들이 생명을 되돌려 놓고 지나갔으니,
  // 「처음부터 세 번」이 진짜로 끝내는지는 새 판에서만 잴 수 있다.
  // ⚠️ 여기서도 **`Pinwheel.start()` 를 직접 안 부른다** — 채집 버튼을 누른다
  await page.evaluate((id) => {
    switchTab('gather'); setGatherTab('field');
    const m = D.MAPS.find(x => x.id === id);
    S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
    S.energy = 5000; render(); setGatherZone(m.zone);
  }, mapId);
  await page.waitForTimeout(140);
  await page.evaluate((id) => {
    const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
    if (b) b.click();
  }, mapId);
  await page.waitForTimeout(280);

  const dead = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (!Pinwheel.isPlaying()) return { noGame: true };
    const st = Pinwheel._state();
    const inv0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    // **치워 놓은 것이 있어야 「그래도 가져간다」를 잴 수 있다** — 0 이면
    // 재료가 0개라 무슨 짓을 해도 통과하는 「0개짜리 보상」이 된다
    st.cleared = Pinwheel.REWARD_PER * 3;
    const want = Math.floor(st.cleared / Pinwheel.REWARD_PER);
    const steps = [];
    for (let i = 0; i < Pinwheel.LIVES; i++) {
      const b = Pinwheel.boardState();
      const blk = b.grid.filter(p => !p.open)[0];
      if (!blk) { steps.push({ noBlocked: true }); break; }
      Pinwheel._tap(blk.c, blk.r);
      const a = Pinwheel.boardState();
      steps.push({ lives: a.lives, over: a.over, dying: a.dying,
                   hearts: a.hearts, cleared: a.cleared });
    }
    const mid = Pinwheel.boardState();
    // 마지막 하나를 잃으면 「아이쿠」를 읽는 동안(`OOPS_MS`)은 안 눌리고, 그 뒤에 끝난다
    const blockedNow = Pinwheel.boardState().grid.filter(p => p.open)[0];
    const clearedBefore = mid.cleared;
    if (blockedNow) Pinwheel._tap(blockedNow.c, blockedNow.r);
    const duringDying = Pinwheel.boardState().cleared;
    await wait(Pinwheel.OOPS_MS + 500);
    const end = Pinwheel.boardState();
    const box = document.querySelector('#pinwheelGame .pw-result');
    const shown = !!(box && box.classList.contains('show'));
    const text = box ? box.textContent.trim() : '';
    if (box) { const c = box.querySelector('.pw-close'); if (c) c.click(); }
    await wait(200);
    const inv1 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    return { steps, mid, end, shown, text: text.slice(0, 60), want,
             got: inv1 - inv0, clearedBefore, duringDying,
             host: !!document.getElementById('pinwheelGame') };
  });

  if (dead.noGame) {
    ok(false, '게임 오버를 재려고 판을 다시 열었다 (안 열리면 이 검사를 한 번도 안 한 것이다)');
  } else {
    const bad = dead.steps.filter(s => s.noBlocked).length;
    ok(!bad && dead.steps.length === LIVES, `막힌 것을 ${LIVES}번 눌러 봤다`,
       dead.steps.map(s => `남은 ${s.lives}`).join(' → '));
    // ⚠️ **마지막 «전»까지는 안 끝나야 한다** — 한 번에 끝나면 생명이 셋인 뜻이 없다
    ok(dead.steps.slice(0, -1).every(s => !s.over && !s.dying),
       `${LIVES - 1}번까지는 안 끝난다 (생명이 ${LIVES}개인 뜻이 있다)`,
       dead.steps.map(s => (s.over ? '끝' : s.dying ? '끝나는중' : '계속')).join(' · '));
    ok(dead.mid.lives === 0 && (dead.mid.dying || dead.mid.over),
       `${LIVES}번 틀리면 끝난다`, `남은 기회 ${dead.mid.lives} · 끝나는중 ${dead.mid.dying}`);
    ok(dead.mid.hearts === 0, '하트가 하나도 안 남는다', `${dead.mid.hearts}개`);
    // ⚠️ 「아이쿠」를 읽는 동안 계속 눌리면 **끝난 뒤에도 점수가 오른다**
    ok(dead.duringDying === dead.clearedBefore, '끝나는 동안에는 더 안 눌린다',
       `${dead.clearedBefore} → ${dead.duringDying}`);
    ok(dead.end.over && dead.shown, '「아이쿠」를 읽을 틈을 주고 결과가 뜬다', dead.text.split('\n')[0]);
    // ⚠️⚠️ **이 게임의 규칙이다** — 잃는 것은 재료가 아니라 남은 시간이다
    ok(dead.got >= dead.want && dead.want >= 3,
       '생명이 다해 끝나도 «치운 것은 그대로» 가져간다 (재료는 한 톨도 안 잃는다)',
       `치움 ${dead.clearedBefore} → 재료 ${dead.want}개 기대 · +${dead.got}`);
    ok(!dead.host, '나가면 화면이 걷힌다 (게임 오버 쪽도)');
  }

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 바람개비 밭 · 바람개비 퍼즐');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n바람개비 퍼즐 검사 전부 통과 ✅');
}
