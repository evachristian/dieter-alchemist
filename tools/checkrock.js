// 바위산 · 돌깨기 게임을 **진짜 화면에서 움직여 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「게임이 도는가」·「돌로 보이는가」·「깨지는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 바위산 형 맵을 누르면 **채집 대신** 돌깨기 게임이 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · 판이 10×16 이고 조각이 하나 내려오고 있는가
//   · **캔버스 픽셀을 직접 재서** 칸이 «네모 블록»이 아니라 «돌»인가
//   · **진짜 마우스**로 끌면 옮겨지고 · 톡 치면 돌아가고 · 아래로 쓸면 굳는가
//   · 벽 밖으로는 안 나가는가
//   · 줄이 차면 **깨지고 · 파편이 튀고 · 곧 사라지는가**
//   · 천장까지 차면 그 자리에서 끝나는가
//   · 깬 줄만큼 재료가 가방에 들어오는가 (`REWARD_PER`)
//
// 사용: node tools/checkrock.js      (종료 코드 0 = 통과)
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
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Rock,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const rk = D.MAPS.filter(m => D.mapType(m.id) === 'rock');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      rock: rk.map(m => m.id), rockN: rk.length, miniN: mini.length, plainN: plain.length,
      first: rk[0] && rk[0].id,
      mini: rk[0] ? D.fieldMini(rk[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.rockN > 0, '바위산 형 맵이 있다', kinds.rock.join(','));
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);
  ok(kinds.mini === 'rock', '바위산 형은 돌깨기 게임으로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Rock.start()` 를 직접 부르면
  //    `gather()` 의 갈래(형 → 미니게임)를 통째로 건너뛰어, 그 줄을 지워도 통과한다
  const mapId = kinds.first;
  const before = await page.evaluate(() => S.energy);
  await page.evaluate((id) => {
    switchTab('gather'); setGatherTab('field');
    const m = D.MAPS.find(x => x.id === id);
    // 그 지대가 열려 있어야 카드가 뜬다 (흔들 바위산은 매력 132 짜리 산악 맵이다).
    // ⚠️ **지대 탭도 옮겨야 한다** — 맵 목록은 지금 선 지대(`gatherZone`)의 것만 그린다
    S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
    render();
    setGatherZone(m.zone);
  }, mapId);
  await page.waitForTimeout(120);
  const tapped = await page.evaluate((id) => {
    const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
    if (!b) return '카드가 없다';
    b.click();
    return null;
  }, mapId);
  ok(!tapped, '바위산 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(220);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('rockGame'),
    playing: window.Rock.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 돌깨기 게임이 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다.** 게임이 안 떴는데 그대로 내려가면
  // 다음 줄이 `_state().grid` 를 읽다 터지고, 크래시는 **무엇이 틀렸나를 안 알려 준다**
  if (!opened.playing) return done(browser, page, errs);

  // ── 카드에 딱지가 있었는가 (들어가기 «전»에 알려 준다)
  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/돌깨기|Stone/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  // ── 판
  const b0 = await page.evaluate(() => {
    const st = Rock._state();
    return { ...Rock.boardState(), cell: st.cell, ox: st.ox, oy: st.oy };
  });
  ok(b0.rows === 16 && b0.cols === 10, '판은 10×16 이다', `${b0.cols}×${b0.rows}`);
  ok(!!b0.piece && b0.piece.cells.length === 4, '돌조각 하나가 내려오고 있다 (네 칸짜리)',
     b0.piece ? `k${b0.piece.k} · ${b0.piece.cells.length}칸` : '없다');
  ok(b0.filled === 0, '시작할 때 판은 비어 있다', String(b0.filled));
  ok(b0.cell > 8, '칸이 화면에 맞게 잡혔다', `${Math.round(b0.cell)}px`);

  // 화면 ↔ 칸
  const box = async () => page.evaluate(() => {
    const r = document.querySelector('#rockGame .rk-canvas').getBoundingClientRect();
    const st = Rock._state();
    return { l: r.left, t: r.top, cell: st.cell, ox: st.ox, oy: st.oy };
  });

  // ── **돌로 보이는가** — 캔버스 픽셀을 직접 읽는다 ───────────
  // ⚠️ 여기가 `checkUI()` 의 사각지대다. 칸을 한 색으로 칠해 놓아도 대비 검사는 0건이다.
  // 바닥에 돌 하나를 굳혀 놓고 그 칸을 뜬다
  await page.evaluate(() => { Rock._spawn(1); Rock._drop(); });   // O 조각을 바닥에
  await page.waitForTimeout(80);
  const sample = () => page.evaluate(() => {
    const cvEl = document.querySelector('#rockGame .rk-canvas');
    const g = cvEl.getContext('2d');
    const st = Rock._state();
    const dpr = cvEl.width / parseFloat(cvEl.style.width);
    // 굳어 있는 돌 한 칸을 찾는다 (내려오는 조각이 아니라)
    let rr = -1, cc = -1;
    for (let r = 15; r >= 0 && rr < 0; r--) for (let c = 0; c < 10; c++)
      if (st.grid[r][c]) { rr = r; cc = c; break; }
    if (rr < 0) return null;
    const s = Math.round(st.cell * dpr);
    const img = g.getImageData(Math.round((st.ox + cc * st.cell) * dpr),
                               Math.round((st.oy + rr * st.cell) * dpr), s, s).data;
    const at = (x, y) => { const i = (y * s + x) * 4; return { r: img[i], g: img[i + 1], b: img[i + 2], a: img[i + 3] }; };
    const cnt = {};
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const p = at(x, y);
      if (p.a < 250) continue;
      cnt[`${p.r},${p.g},${p.b}`] = (cnt[`${p.r},${p.g},${p.b}`] || 0) + 1;
    }
    // 큰 덩어리만 센다 — 안티에일리어싱 한두 점은 「무늬」가 아니다
    const tones = Object.values(cnt).filter(n => n > s * 0.6).length;
    return {
      rr, cc, tones, s,
      corner: at(1, 1), center: at(Math.round(s / 2), Math.round(s / 2)),
      // 얼룩이 그대로인지 견줄 지문
      ink: Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0] + ':' + e[1]).join('|'),
    };
  });
  const px1 = await sample();
  ok(!!px1, '굳은 돌을 한 칸 찾았다', px1 ? `${px1.rr}행 ${px1.cc}열` : '못 찾았다');
  if (px1) {
    // **한 색으로 칠한 네모가 아니다** — 몸통 · 밝은 면 · 어두운 면 · 얼룩
    ok(px1.tones >= 3, '돌에 결이 있다 (한 색 네모가 아니다)', `${px1.tones}가지 색`);
    // **모서리가 깎여 있다** — 칸을 꽉 채우면 돌이 아니라 블록이다.
    // 판 바닥이 반투명이라 모서리는 «덜 불투명»하게 남는다
    ok(px1.corner.a < 200 && px1.center.a > 250, '칸 모서리가 깎여 있다 (네모 블록이 아니다)',
       `모서리 a${px1.corner.a} · 가운데 a${px1.center.a}`);
  }
  // **다시 그려도 같은 얼룩이다** — 프레임마다 새로 뽑으면 돌이 지글거린다
  await page.waitForTimeout(160);
  const px2 = await sample();
  ok(px1 && px2 && px1.ink === px2.ink, '다시 그려도 돌의 얼룩이 그대로다',
     px1 && px2 ? (px1.ink === px2.ink ? '두 프레임이 같다' : '프레임마다 달라진다') : '못 쟀다');

  // ── **진짜 마우스로 움직인다.** `_move()` 로만 재면 손가락 → 칸 셈이
  //    통째로 틀려도 통과한다 (`checktut` 이 `el.click()` 을 안 쓰는 것과 같은 이유다)
  const drag = async (dx, dy, ms) => {
    const B = await box();
    const x = B.l + B.ox + B.cell * 5, y = B.t + B.oy + B.cell * 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx * 0.5, y + dy * 0.5, { steps: 3 });
    await page.mouse.move(x + dx, y + dy, { steps: 3 });
    if (ms) await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(60);
  };
  {
    const B = await box();
    const c0 = (await page.evaluate(() => Rock.boardState().piece)).c;
    await drag(B.cell * 2, 0);
    const c1 = (await page.evaluate(() => Rock.boardState().piece)).c;
    ok(c1 === c0 + 2, '두 칸 만큼 끌면 두 칸 옮겨진다', `${c0} → ${c1}`);
    await drag(-B.cell * 3, 0);
    const c2 = (await page.evaluate(() => Rock.boardState().piece)).c;
    ok(c2 === c1 - 3, '반대로 끌면 되돌아온다', `${c1} → ${c2}`);
  }
  // 톡 치면 돌아간다 — **T 조각으로 못 박는다** (O 는 돌려도 그대로다)
  {
    await page.evaluate(() => Rock._spawn(2));            // T
    const a = await page.evaluate(() => JSON.stringify(Rock.boardState().piece.cells));
    const B = await box();
    const x = B.l + B.ox + B.cell * 5, y = B.t + B.oy + B.cell * 4;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(80);
    const b = await page.evaluate(() => JSON.stringify(Rock.boardState().piece.cells));
    ok(a !== b, '톡 치면 조각이 돌아간다', `${a} → ${b}`);
  }
  // 아래로 쓸면 그 자리에서 굳는다
  {
    const d0 = (await page.evaluate(() => Rock.boardState())).drops;
    const B = await box();
    await drag(0, B.cell * 4);
    const s1 = await page.evaluate(() => Rock.boardState());
    ok(s1.drops === d0 + 1, '아래로 쓸면 조각이 그 자리에서 굳는다', `놓은 조각 ${d0} → ${s1.drops}`);
    ok(s1.filled > 0, '굳은 돌이 판에 남는다', `${s1.filled}칸`);
  }
  // 벽 밖으로는 안 나간다
  {
    const B = await box();
    await drag(-B.cell * 20, 0);
    const c = (await page.evaluate(() => Rock.boardState().piece)).c;
    ok(c >= 0, '왼쪽 벽 밖으로는 안 나간다', `c ${c}`);
    await drag(B.cell * 30, 0);
    const p = await page.evaluate(() => Rock.boardState().piece);
    const right = Math.max(...p.cells.map(cc => cc[1])) + p.c;
    ok(right <= 9, '오른쪽 벽 밖으로도 안 나간다', `제일 오른쪽 칸 ${right}`);
  }

  // ── **줄이 차면 깨진다** — 그리고 «깨지는 것이 보인다» ───────
  // 바닥 한 줄을 네 칸만 비워 두고 그 자리에 I 조각을 떨군다
  const burst = await page.evaluate(() => {
    const st = Rock._state();
    for (let r = 0; r < 16; r++) { st.grid[r].fill(0); st.seed[r].fill(0); }
    for (let c = 0; c < 10; c++) {
      if (c >= 3 && c <= 6) continue;                 // I 조각이 들어갈 자리
      st.grid[15][c] = 1 + (c % 7);
      st.seed[15][c] = c / 10;
    }
    const before = Rock.boardState();
    Rock._spawn(0);                                   // I — 가로로 3~6열
    Rock._drop();
    const after = Rock.boardState();
    return { lines0: before.lines, lines1: after.lines, bits: after.bits, filled: after.filled };
  });
  ok(burst.lines1 === burst.lines0 + 1, '한 줄이 차면 그 줄이 깨진다',
     `${burst.lines0} → ${burst.lines1}줄`);
  ok(burst.filled === 0, '깨진 줄은 판에서 사라진다', `남은 돌 ${burst.filled}칸`);
  // ⚠️ **「점수가 올랐다」만 보면 연출은 한 줄도 안 잰 것이다** — 돌이 그냥 사라져도
  // 통과한다. 파편이 실제로 생기고, 잠시 뒤 사라지는지를 같이 본다
  ok(burst.bits > 0, '깨질 때 돌 파편이 튄다', `파편 ${burst.bits}조각`);
  const gone = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(Rock.BURST_MS + 220);
    return Rock.boardState().bits;
  });
  ok(gone === 0, '파편은 잠시 뒤 사라진다 (화면에 남지 않는다)', `${gone}조각`);

  // ── 줄을 더 깨서 **재료가 나올 만큼** 번다
  // ⚠️ **「0개짜리 보상」으로 재지 않는다** — 한 줄만 깨고 「0개 이상 들어온다」를
  // 보면 무슨 값을 넣어도 통과한다
  const earned = await page.evaluate(() => {
    const want = Rock.REWARD_PER * 4;
    for (let n = 0; n < 12 && Rock.boardState().lines < want; n++) {
      const st = Rock._state();
      for (let c = 0; c < 10; c++) {
        if (c >= 3 && c <= 6) continue;
        st.grid[15][c] = 1 + (c % 7); st.seed[15][c] = c / 10;
      }
      Rock._spawn(0); Rock._drop();
    }
    return { lines: Rock.boardState().lines, want };
  });
  ok(earned.lines >= earned.want, '줄을 이어 깨면 재료가 나올 만큼 오른다',
     `${earned.lines}줄 · ${earned.want}줄 이상 필요`);

  // ── **천장까지 차면 그 자리에서 끝난다**
  const bury = await page.evaluate(() => {
    const st = Rock._state();
    for (let r = 0; r < 16; r++) { st.grid[r].fill(0); st.seed[r].fill(0); }
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const lines = Rock.boardState().lines;
    // O 조각을 같은 자리에 계속 쌓는다 — 줄은 안 차고 기둥만 올라간다
    for (let i = 0; i < 20; i++) {
      const b = Rock.boardState();
      if (b.over) break;
      Rock._spawn(1); Rock._drop();
    }
    const b = Rock.boardState();
    return { over: b.over, buried: b.buried, drops: b.drops, lines, invBefore,
             per: Rock.REWARD_PER, want: Math.min(Rock.REWARD_MAX, Math.floor(lines / Rock.REWARD_PER)) };
  });
  ok(bury.over && bury.buried, '돌무더기가 천장까지 차면 그 자리에서 끝난다',
     `over ${bury.over} · buried ${bury.buried} · 놓은 조각 ${bury.drops}`);
  // ⚠️ **안 끝났으면 «거기서 죽지 말고» 그렇다고 알린다.** 천장 판정을 지우는 사보타주에서
  // 다음 줄이 없는 「나가기」를 누르다 터졌고, **크래시는 무엇이 틀렸나를 안 알려 준다** —
  // 지금까지 잰 스무 줄이 통째로 화면에서 사라졌다 (`checkwalnut` 에서 배운 것과 같은 자리다)
  if (!bury.over) return done(browser, page, errs);
  await page.waitForTimeout(120);
  const shown = await page.evaluate(() => {
    const box = document.querySelector('#rockGame .rk-result');
    return { show: !!(box && box.classList.contains('show')),
             text: (box && box.textContent || '').trim().slice(0, 60) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  ok(shown.text.includes(String(bury.lines)), '결과가 «몇 줄을 깼는지»를 말한다',
     `${bury.lines}줄 · "${shown.text.split('\n')[0]}"`);

  await page.evaluate(() => document.querySelector('#rockGame .rk-close').click());
  await page.waitForTimeout(140);
  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('rockGame'),
    playing: window.Rock.isPlaying(),
  }));
  ok(!after.host && !after.playing, '나가면 화면이 걷힌다');
  // ⚠️ 히든 재료가 확률로 하나 더 붙을 수 있다 — 그래서 «이상»으로 본다
  ok(after.inv - bury.invBefore >= bury.want,
     `${bury.lines}줄 → 재료 ${bury.want}개 이상이 가방에 들어온다 (${bury.per}줄마다 1개)`,
     `+${after.inv - bury.invBefore}`);
  ok(bury.want >= 3, '잰 것이 «0개짜리 보상»이 아니다', `${bury.want}개 기대`);

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('rockGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 바위산 · 돌깨기 게임');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n돌깨기 게임 검사 전부 통과 ✅');
}
