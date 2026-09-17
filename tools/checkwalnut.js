// 호두밭 · 호두 게임을 **진짜 화면에서 끌어 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「게임이 도는가」·「타일이 읽히는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 호두밭 형 맵을 누르면 **채집 대신** 호두 게임이 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · 판이 10×12 이고 **시작하자마자 지울 수 있는 네모가 있는가**
//   · **캔버스 픽셀을 직접 재서** 타일이 «숫자가 읽히는 호두»인가
//   · **진짜 마우스 드래그**로 합 10을 고르면 지워지고 점수가 오르는가
//   · 합이 10이 아니면 **아무것도 안 지워지고 잃는 것도 없는가**
//   · 지워진 칸을 **건너뛰어** 고를 수 있는가
//   · 끝나면 **점수만큼** 재료가 가방에 들어오는가 (`REWARD_PER`)
//
// 사용: node tools/checkwalnut.js      (종료 코드 0 = 통과)
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
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Walnut,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const wal = D.MAPS.filter(m => D.mapType(m.id) === 'walnut');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      walnut: wal.map(m => m.id), walnutN: wal.length, miniN: mini.length, plainN: plain.length,
      first: wal[0] && wal[0].id,
      openEarly: mini.filter(m => !m.unlock).map(m => m.id),
      mini: wal[0] ? D.fieldMini(wal[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.walnutN > 0, '호두밭 형 맵이 있다', kinds.walnut.join(','));
  // **평범하게 줍는 곳이 대다수여야 한다** — 미니게임이 흔해지면 「꾹 누르기 자동 채집」이
  // 사실상 사라진다 (`genmaptype` 의 30% 한계와 같은 약속이다)
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);
  // ⚠️ **미니게임 맵이 둘뿐이라, 둘 다 잠겨 있으면 새 플레이어는 한 번도 못 본다**
  ok(kinds.openEarly.length > 0, '미니게임 하나는 처음부터 열려 있다', kinds.openEarly.join(','));
  ok(kinds.mini === 'walnut', '호두밭 형은 호두 게임으로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Walnut.start()` 를 직접 부르면
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
  ok(!tapped, '호두밭 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(200);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('walnutGame'),
    playing: window.Walnut.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 호두 게임이 뜬다',
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
  ok(/호두|Walnut/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  // ── 판
  const b0 = await page.evaluate(() => {
    const st = Walnut._state();
    const flat = st.grid.flat();
    return {
      ...Walnut.boardState(),
      min: Math.min(...flat), max: Math.max(...flat),
      cell: st.cell, ox: st.ox, oy: st.oy,
    };
  });
  ok(b0.rows === 12 && b0.cols === 10, '판은 10×12 다', `${b0.cols}×${b0.rows}`);
  ok(b0.alive === 120, '호두 120개로 시작한다', String(b0.alive));
  ok(b0.min >= 1 && b0.max <= 9, '숫자는 1~9 다', `${b0.min}~${b0.max}`);
  ok(!!b0.hint, '시작하자마자 지울 수 있는 네모가 있다 (막힌 판으로 시작하지 않는다)');
  ok(b0.cell > 8, '칸이 화면에 맞게 잡혔다', `${Math.round(b0.cell)}px`);

  // ── **타일을 «캔버스 픽셀로» 재 본다** ───────────────────────
  //
  // ⚠️ 여기가 `checkUI()` 의 사각지대다 — 대비 검사는 DOM 글자만 보므로 캔버스에
  // 무엇을 그려 놓아도 0건이다. 그래서 **그려진 픽셀을 직접 읽는다**:
  //   ① 숫자와 껍데기의 대비 (글자가 껍데기에 묻히지 않는가)
  //   ② 껍데기가 «두 쪽»으로 갈리는가 (호두로 읽히게 하는 것이 이 음영이다)
  //   ③ 칸 모서리가 비어 있는가 (네모 타일이 아니라 «알»인가)
  const px = await page.evaluate(() => {
    const cvEl = document.querySelector('#walnutGame .wn-canvas');
    const g = cvEl.getContext('2d');
    const st = Walnut._state();
    const dpr = cvEl.width / parseFloat(cvEl.style.width);
    // 살아 있는 칸 하나 (고르는 중이 아닌 평소 색으로 재려고 sel 은 비워 둔다)
    let rr = -1, cc = -1;
    for (let r = 0; r < 12 && rr < 0; r++) for (let c = 0; c < 10; c++)
      if (st.grid[r][c] > 0) { rr = r; cc = c; break; }
    const x0 = Math.round((st.ox + cc * st.cell) * dpr);
    const y0 = Math.round((st.oy + rr * st.cell) * dpr);
    const s = Math.round(st.cell * dpr);
    const img = g.getImageData(x0, y0, s, s).data;
    const at = (x, y) => {
      const i = (y * s + x) * 4;
      return { r: img[i], g: img[i + 1], b: img[i + 2], a: img[i + 3] };
    };
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = p => 0.2126 * f(p.r) + 0.7152 * f(p.g) + 0.0722 * f(p.b);

    // 껍데기 색 = 불투명 픽셀 중 «제일 흔한» 색 · 먹 = 제일 어두운 픽셀
    const cnt = {};
    let dark = null, dl = 9;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const p = at(x, y);
      if (p.a < 250) continue;
      const k = `${p.r},${p.g},${p.b}`;
      cnt[k] = (cnt[k] || 0) + 1;
      const L = lum(p);
      if (L < dl) { dl = L; dark = p; }
    }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    const shell = top ? (([r, g2, b]) => ({ r: +r, g: +g2, b: +b }))(top[0].split(',')) : null;
    const L1 = shell ? lum(shell) : 0, L2 = dl;
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    // 두 쪽 — 이음매·숫자를 피해 «바깥 띠»만 본다 (가운데는 숫자가 앉는 자리다)
    const band = (a, b) => {
      let sum = 0, n = 0;
      for (let y = Math.round(s * 0.3); y < s * 0.7; y++)
        for (let x = Math.round(s * a); x < s * b; x++) {
          const p = at(x, y);
          if (p.a < 250) continue;
          const L = lum(p);
          if (L < 0.25) continue;            // 먹·이음매는 뺀다
          sum += L; n++;
        }
      return { mean: n ? sum / n : 0, n };
    };
    const left = band(0.12, 0.34), right = band(0.66, 0.88);
    const corner = at(1, 1);
    return {
      shell, dark, contrast, left, right, cornerA: corner.a,
      centerA: at(Math.round(s / 2), Math.round(s / 2)).a, s,
    };
  });
  ok(px.contrast >= 4.5, '숫자가 껍데기 위에서 읽힌다 (캔버스 픽셀로 잰 대비)',
     `${px.contrast.toFixed(1)}:1 · 껍데기 rgb(${px.shell && [px.shell.r, px.shell.g, px.shell.b]})`);
  ok(px.left.n > 20 && px.right.n > 20, '껍데기의 좌우를 잴 픽셀이 있다',
     `왼쪽 ${px.left.n}px · 오른쪽 ${px.right.n}px`);
  // ⚠️ **「왼쪽이 더 어둡다」로만 재면 안 된다.** 음영을 통째로 없애 두 쪽을 같은 색으로
  // 만들어도 안티에일리어싱 때문에 소수점 다섯째 자리에서 갈려 **그대로 통과했다** —
  // 가르지 못하는 잣대는 무슨 값을 넣어도 통과한다. **사람이 볼 수 있는 만큼** 벌어져야 한다
  const gap = px.right.mean ? (px.right.mean - px.left.mean) / px.right.mean : 0;
  ok(gap >= 0.05, '껍데기가 «두 쪽»으로 갈린다 (왼쪽이 눈에 띄게 어둡다)',
     `왼쪽 ${px.left.mean.toFixed(3)} · 오른쪽 ${px.right.mean.toFixed(3)} · 차이 ${(gap * 100).toFixed(1)}% (5% 이상)`);
  ok(px.cornerA === 0 && px.centerA > 250, '칸 모서리는 비어 있다 (네모가 아니라 «알»이다)',
     `모서리 a${px.cornerA} · 가운데 a${px.centerA}`);

  // ── **진짜 마우스로 끈다.** `_play()` 로만 재면 드래그 → 칸 좌표 변환이
  //    통째로 틀려도 통과한다 (`checktut` 이 `el.click()` 을 안 쓰는 것과 같은 이유다)
  const dragCells = async (r1, c1, r2, c2) => {
    const box = await page.evaluate(() => {
      const r = document.querySelector('#walnutGame .wn-canvas').getBoundingClientRect();
      const st = Walnut._state();
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
  const b1 = await page.evaluate(() => Walnut.boardState());
  ok(b1.score > 0, '끌어서 합 10을 고르면 호두가 지워진다', `점수 ${b1.score}`);
  ok(b1.alive === 120 - b1.score, '지운 만큼만 사라진다',
     `남은 ${b1.alive} · 지운 ${b1.score}`);
  ok(b1.score <= rectN, '네모 «안»의 것만 지워진다', `네모 ${rectN}칸 · 지운 ${b1.score}`);
  ok(b1.moves === 1, '한 수로 센다', String(b1.moves));

  // ── 틀린 합 — **아무 일도 안 일어나야 한다**
  const wrong = await page.evaluate(() => {
    const st = Walnut._state();
    // 합이 10이 아닌 네모를 하나 찾는다
    for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++) {
      const s = st.grid[r][c] + st.grid[r][c + 1];
      if (s > 0 && s !== 10) return { r, c };
    }
    return null;
  });
  if (wrong) {
    const s0 = (await page.evaluate(() => Walnut.boardState()));
    await dragCells(wrong.r, wrong.c, wrong.r, wrong.c + 1);
    const s1 = await page.evaluate(() => Walnut.boardState());
    ok(s1.score === s0.score && s1.alive === s0.alive,
       '합이 10이 아니면 한 알도 안 지워진다 (틀려도 잃는 것이 없다)',
       `${s0.score}→${s1.score} · 남은 ${s0.alive}→${s1.alive}`);
    ok(s1.lastSum !== 10, '그 네모의 합을 제대로 셌다', `합 ${s1.lastSum}`);
  } else {
    ok(false, '합이 10이 아닌 네모를 못 찾았다 (검사가 이 갈래를 못 쟀다)');
  }

  // ── **지워진 칸을 건너뛴다** — 이 게임의 재미가 그것이다
  const jump = await page.evaluate(() => {
    const st = Walnut._state();
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
    const s0 = await page.evaluate(() => Walnut.boardState());
    await dragCells(jump.r1, jump.c1, jump.r2, jump.c2);
    const s1 = await page.evaluate(() => Walnut.boardState());
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
    const want = Walnut.REWARD_PER * 3;
    for (let i = 0; i < 400; i++) {
      const b = Walnut.boardState();
      if (!b || b.over || b.score >= want || !b.hint) break;
      const h = b.hint;
      Walnut._play(h.r1, h.c1, h.r2, h.c2);
    }
    const b = Walnut.boardState();
    return { score: b ? b.score : 0, want };
  });
  ok(earned.score >= earned.want,
     '수를 이어 두면 점수가 재료가 나올 만큼 오른다 (0개짜리로 재지 않는다)',
     `점수 ${earned.score} · ${earned.want} 이상 필요`);

  const res = await page.evaluate(() => {
    const st = Walnut._state();
    const score = st.score;
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const questBefore = questProgress(activeQuest() || { goal: { n: 0 } });
    Walnut._finish();
    return { score, invBefore, questBefore, per: Walnut.REWARD_PER,
             want: Math.min(Walnut.REWARD_MAX, Math.floor(score / Walnut.REWARD_PER)) };
  });
  await page.waitForTimeout(80);
  const shown = await page.evaluate(() => {
    const box = document.querySelector('#walnutGame .wn-result');
    return { show: !!(box && box.classList.contains('show')),
             text: (box && box.textContent || '').trim().slice(0, 40) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  // ⚠️ **결과 문구에 「사과」가 남아 있으면 안 된다** — 이 게임은 호두 게임이다
  ok(!/사과|apple/i.test(shown.text), '결과가 이 게임의 이름으로 말한다', shown.text);
  await page.evaluate(() => document.querySelector('#walnutGame .wn-close').click());
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('walnutGame'),
    playing: window.Walnut.isPlaying(),
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
             host: !!document.getElementById('walnutGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 호두밭 · 호두 게임');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n호두 게임 검사 전부 통과 ✅');
}
