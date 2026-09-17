// ═══════════════════════════════════════════════════════════════
//  과수원 — 사과 게임 (합이 10)
//  과수원 형 맵을 누르면 채집 대신 이 화면으로 들어온다 (`D.fieldMini(id) === 'apple'`).
//  숫자가 적힌 사과가 격자로 깔리고, **드래그한 네모 안의 합이 정확히 10이면** 지워진다.
//  2분 동안 지운 사과가 곧 점수이고, 점수가 그대로 가져가는 재료가 된다.
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 — 그래야 게임 로직에서 DPR 을 신경 쓰지 않는다
//  (`pumpkin.js` 와 같은 규칙이다).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS   = 120000;   // 2분 — 호박 밭과 같은 길이로 맞춘다
  const COLS     = 10;
  const ROWS     = 12;       // 10×12 = 사과 120개
  const TARGET   = 10;       // 합이 이 값이면 지워진다
  // ⚠️ **보드 크기를 화면에 맞춰 «늘리지» 않는다.** 칸 크기만 줄이고 격자는 10×12 로
  // 고정한다 — 큰 화면에서 사과가 더 많으면 같은 2분에 더 많이 벌게 되어
  // **화면 크기가 곧 보상**이 된다
  const MIN_MOVES = 6;       // 시작 판에 최소 이만큼의 «지울 수 있는 네모»가 있어야 한다

  // ─── 보상 ───
  // **점수(지운 사과)가 그대로 재료가 된다** — 「점수가 높으면 더 얻는다」가 이 게임의 전부다.
  // ⚠️ **호박 밭과 같은 자리에 둔다.** 한쪽이 훨씬 후하면 다른 쪽 맵은 아무도 안 간다 —
  //   호박 밭: 2분을 끝까지 버티면 15 + 클리어 2 = **17개**
  //   과수원 : 사과 5개마다 1개 · 120개를 다 지우면 24 → **상한 20개**
  // 보통 50~70개를 지우니 10~14개다 (호박 밭과 같은 자리). `checkbalance` 가 둘을 견준다
  const REWARD_PER = 5;
  const REWARD_MAX = 20;
  // 히든 재료 — 많이 지울수록 오른다 (호박 밭과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  const PAD = 6;             // 격자 바깥 여백
  // ─── 타일 ────────────────────────────────────────────────────
  // **그 맵에서 나는 것을 그린다** — 버섯 마을이면 🍄, 가시덤불이면 🌵.
  // 사과만 깔면 어느 과수원에 서 있든 같은 화면이라, 「여기가 어디인지」가 사라진다.
  //
  // ⚠️ **숫자가 주인공이다.** 이모지를 크게 깔고 숫자를 그 «위»에 얹어 보았더니
  // 숫자가 이모지를 덮어 둘 다 안 읽혔고, 모서리 배지로 빼니 칸을 붙여 놓았을 때
  // **어느 칸의 숫자인지** 흐려졌다 (넷을 38px 로 그려 놓고 골랐다).
  // 그래서 **크림 판 위에 이모지를 작게 얹고 숫자를 아래 크게** 둔다 —
  // 원래 사과 게임의 «동그란 판 + 큰 숫자»를 그대로 지키면서 이모지가 딱지로 붙는다
  const PLATE = '#fff6e6';       // 크림 판 (진한 글자를 받는다)
  const PLATE_SEL = '#ffe2a8';   // 고르는 중
  const PLATE_BAD = '#d8d2c8';   // 합이 안 맞았을 때 잠깐
  const NUM_INK = '#3a2a1a';     // 판 위 숫자 — 크림에 대비 10:1 이 넘는다
  const EM_Y = -0.42, EM_SIZE = 0.36;   // 이모지 — 판 반지름에 대한 자리·크기
  const NUM_Y = 0.34, NUM_SIZE = 0.42;  // 숫자

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  // ─── 보드 만들기 ─────────────────────────────────────────────
  // 1~9 를 무작위로 깐다. ⚠️ **시작하자마자 손댈 데가 없으면 안 된다** — 아주 드물지만
  // 「지울 수 있는 네모」가 몇 개 없는 판이 나올 수 있어서, 세어 보고 모자라면 다시 깐다.
  // (2분짜리 게임에서 첫 판이 막혀 있으면 그건 그냥 빼앗긴 2분이다)
  function newBoard() {
    for (let tryN = 0; tryN < 40; tryN++) {
      const g = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) row.push(1 + Math.floor(Math.random() * 9));
        g.push(row);
      }
      if (countMoves(g) >= MIN_MOVES) return g;
    }
    return null;   // 여기까지 오는 일은 사실상 없다 — 그래도 `start` 가 받아 준다
  }

  // 지울 수 있는 네모가 몇 개인가. 10×12 라 네 겹 반복이 14,400번 — 시작할 때 한 번이면 괜찮다.
  // **누적합**으로 네모 합을 O(1) 에 얻는다 (안 그러면 여섯 겹이 된다)
  function countMoves(g) {
    const P = sums(g);
    let n = 0;
    for (let r1 = 0; r1 < ROWS; r1++) for (let r2 = r1; r2 < ROWS; r2++)
      for (let c1 = 0; c1 < COLS; c1++) for (let c2 = c1; c2 < COLS; c2++)
        if (rectSum(P, r1, c1, r2, c2) === TARGET) n++;
    return n;
  }
  function sums(g) {
    const P = [];
    for (let r = 0; r <= ROWS; r++) P.push(new Array(COLS + 1).fill(0));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      P[r + 1][c + 1] = g[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
    return P;
  }
  const rectSum = (P, r1, c1, r2, c2) =>
    P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1];

  // ─── 상태 ───
  // 칸마다 **한 번 정해 두고 안 바꾼다.** 매번 새로 뽑으면 다시 그릴 때마다 그림이
  // 바뀌어 눈이 따라갈 수가 없다 (날씨를 `render()` 마다 뽑지 않는 것과 같은 규칙이다)
  function newEmojis(pool) {
    const D = window.GameData;
    const ems = (pool && pool.length ? pool : ['berry'])
      .map(id => ((D && D.INGREDIENTS && D.INGREDIENTS[id]) || {}).emoji || '🍎');
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(ems[Math.floor(Math.random() * ems.length)]);
      g.push(row);
    }
    return g;
  }

  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, over: false, cleared: false,
      grid: newBoard(),          // 지워진 칸은 0
      em: newEmojis(pool),       // 칸마다의 이모지 (그 맵에서 나는 것)
      score: 0,                  // 지운 사과 수 = 점수
      moves: 0,                  // 성공한 네모 수 (연출·검사용)
      sel: null,                 // 드래그 중인 네모 {r1,c1,r2,c2}
      bad: 0,                    // 합이 10이 아니었을 때 잠깐 붉게 (끝나는 시각)
      w: 0, h: 0, cell: 0, ox: 0, oy: 0,
      pool, specialId, picked: [], gotSpecial: false,
      lastSum: 0,
    };
  }

  // ─── 칸 ↔ 화면 ───
  function fit() {
    if (!host || !cv) return;
    const st = host.querySelector('.ap-stage');
    const w = st.clientWidth, h = st.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S) return;
    S.w = w; S.h = h;
    // **격자는 10×12 로 고정하고 칸만 줄인다** (위 ⚠️). 남는 자리는 가운데로 모은다
    S.cell = Math.max(10, Math.min((w - PAD * 2) / COLS, (h - PAD * 2) / ROWS));
    S.ox = (w - S.cell * COLS) / 2;
    S.oy = (h - S.cell * ROWS) / 2;
    draw();
  }
  function cellAt(x, y) {
    if (!S || !S.cell) return null;
    const c = Math.floor((x - S.ox) / S.cell), r = Math.floor((y - S.oy) / S.cell);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return { r, c };
  }

  // ─── 한 수 ───────────────────────────────────────────────────
  // ⚠️ **살아 있는 사과만 센다.** 이미 지워진 칸은 0 이라 합에 안 들어가는데,
  // 그래서 **지워진 칸을 지나 «건너뛰어» 고를 수 있다** — 그것이 이 게임의 재미다
  // (판이 비어 갈수록 멀리 있는 것끼리 묶인다)
  function apply(r1, c1, r2, c2) {
    if (!S || S.over) return false;
    if (r1 > r2) { const t = r1; r1 = r2; r2 = t; }
    if (c1 > c2) { const t = c1; c1 = c2; c2 = t; }
    let sum = 0, cells = [];
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const v = S.grid[r][c];
      if (v > 0) { sum += v; cells.push([r, c]); }
    }
    S.lastSum = sum;
    if (sum !== TARGET || !cells.length) {
      // **틀려도 잃는 것이 없다** — 잠깐 붉어질 뿐이다 (흐린 장의 「틀려도 재료가 한 톨도
      // 안 없어진다」와 같은 결이다). 벌을 주면 2분 내내 손이 굳는다
      S.bad = (S.now || 0) + 260;
      draw();
      return false;
    }
    cells.forEach(([r, c]) => { S.grid[r][c] = 0; });
    S.score += cells.length;
    S.moves++;
    if (window.Sfx) Sfx.play('pick');
    // 다 지웠으면 그 자리에서 끝난다 — 빈 판을 남은 시간 동안 보고 있을 이유가 없다
    if (S.grid.every(row => row.every(v => v === 0))) { S.cleared = true; finish(); }
    else draw();
    return true;
  }

  // ─── 그리기 ───
  function draw() {
    if (!S || !ctx) return;
    ctx.clearRect(0, 0, S.w, S.h);
    const cell = S.cell, pad = cell * 0.09;
    const badOn = S.bad && S.now < S.bad;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = S.grid[r][c];
      if (!v) continue;
      const inSel = S.sel && r >= Math.min(S.sel.r1, S.sel.r2) && r <= Math.max(S.sel.r1, S.sel.r2)
        && c >= Math.min(S.sel.c1, S.sel.c2) && c <= Math.max(S.sel.c1, S.sel.c2);
      const x = S.ox + c * cell + cell / 2, y = S.oy + r * cell + cell / 2;
      const rad = cell / 2 - pad;
      // 판 — 숫자를 받는 자리다. 색만 바뀌고 크기는 안 바뀐다
      ctx.fillStyle = badOn && inSel ? PLATE_BAD : (inSel ? PLATE_SEL : PLATE);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      // 그 맵에서 나는 것 — 판 «위쪽»에 작게
      ctx.font = `${Math.round(cell * EM_SIZE)}px system-ui, -apple-system, sans-serif`;
      ctx.fillText((S.em[r] && S.em[r][c]) || '🍎', x, y + rad * EM_Y);
      // 숫자 — 판 «아래쪽»에 크게. 크림 위 진한 먹이라 대비를 따로 손볼 것이 없다
      ctx.fillStyle = NUM_INK;
      ctx.font = `800 ${Math.round(cell * NUM_SIZE)}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(String(v), x, y + rad * NUM_Y);
    }
    // 드래그 중인 네모 — **합을 같이 보여 준다.** 안 보여 주면 머릿속으로만 더해야 해서
    // 2분 동안 눈이 아니라 암산이 게임이 된다
    if (S.sel) {
      const r1 = Math.min(S.sel.r1, S.sel.r2), r2 = Math.max(S.sel.r1, S.sel.r2);
      const c1 = Math.min(S.sel.c1, S.sel.c2), c2 = Math.max(S.sel.c1, S.sel.c2);
      let sum = 0;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) sum += S.grid[r][c];
      const x = S.ox + c1 * cell, y = S.oy + r1 * cell;
      const w = (c2 - c1 + 1) * cell, h = (r2 - r1 + 1) * cell;
      ctx.strokeStyle = sum === TARGET ? '#ffd76a' : '#ffffffaa';
      ctx.lineWidth = sum === TARGET ? 3 : 2;
      ctx.setLineDash(sum === TARGET ? [] : [5, 4]);
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.setLineDash([]);
      // ⚠️ **합을 «어두운 알약» 위에 얹는다.** 흰 글자로만 두었더니 네모 위쪽에 크림
      // 타일이 오는 순간 통째로 사라졌다 (찍어 보고 알았다 — 캔버스라 대비 검사가 못 본다).
      // 알약이면 배경이 무엇이든 읽힌다
      if (sum > 0) {
        const fs = Math.round(Math.max(13, cell * 0.44));
        ctx.font = `800 ${fs}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(String(sum)).width;
        const pw = tw + fs * 0.9, ph = fs * 1.5;
        const bx = Math.min(Math.max(x + w / 2, pw / 2 + 4), S.w - pw / 2 - 4);
        // ⚠️ **칸을 가리지 않는 자리에 둔다.** 네모 바로 위에 얹었더니 **윗 칸의 숫자를
        // 덮었다** — 지금 고르려는 것을 가리는 표시다 (찍어 보고 알았다).
        // 판은 가운데 정렬이라 아래에 빈 띠가 남으므로 **거기**에 둔다.
        // 화면이 짧아 띠가 없으면 그때만 네모 위로 올린다 (그래도 HUD 는 안 파고든다)
        const gridBottom = S.oy + ROWS * cell;
        let by;
        if (S.h - gridBottom >= ph + 10) by = gridBottom + (S.h - gridBottom) / 2;
        else { by = y - ph * 0.7; if (by - ph / 2 < 46) by = y + h + ph * 0.7; }
        ctx.fillStyle = sum === TARGET ? '#ffd76a' : 'rgba(20,32,14,0.88)';
        ctx.beginPath(); ctx.roundRect(bx - pw / 2, by - ph / 2, pw, ph, ph / 2); ctx.fill();
        ctx.fillStyle = sum === TARGET ? '#2a1f08' : '#f6fbef';
        ctx.fillText(String(sum), bx, by + 0.5);
      }
    }
  }

  // ─── 한 프레임 ───
  // 사과 게임은 물리가 없어서 **바뀔 때만 다시 그린다.** 프레임마다 그리면 120칸을
  // 2분 내내 다시 칠하느라 배터리만 먹는다. 여기서는 시계와 «잠깐 붉어짐»만 본다
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) S.t0 = ts;
    S.now = ts;
    if (S.bad && ts >= S.bad) { S.bad = 0; draw(); }
    if (ts - S.t0 >= DUR_MS) { finish(); return; }
    raf = requestAnimationFrame(step);
  }

  // ─── 끝내기 ───
  function finish() {
    if (!S || S.over) return;
    S.over = true;
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    // **점수를 재료로 바꾼다** — 이 두 줄이 「점수가 높으면 더 얻는다」의 전부다
    const n = Math.min(REWARD_MAX, Math.floor(S.score / REWARD_PER));
    for (let i = 0; i < n; i++) S.picked.push(pickItem());
    // 히든 재료 — 많이 지울수록 오른다. 다 지웠으면 시간과 상관없이 꼭대기다
    if (S.specialId) {
      const prog = S.cleared ? 1 : Math.min(1, S.score / (COLS * ROWS));
      if (Math.random() < SP_BASE + SP_TOP * prog) {
        S.picked.push(S.specialId);
        S.gotSpecial = true;
      }
    }
    showResult();
  }

  function pickItem() {
    const p = S.pool && S.pool.length ? S.pool : ['berry'];
    return p[Math.floor(Math.random() * p.length)];
  }

  function showResult() {
    const D = window.GameData;
    const counts = {};
    S.picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.keys(counts).map(id => {
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '🍎', name: id };
      return `<span class="ap-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.ap-result');
    box.innerHTML = `
      <div class="ap-res-title">${S.cleared ? T('ap_cleared') : T('ap_done', { n: S.score })}</div>
      <div class="ap-res-items">${rows || `<span class="ap-item">${T('ap_none')}</span>`}</div>
      <button class="btn ap-close">${T('ap_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.ap-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const cleared = S ? S.cleared : false;
    const score = S ? S.score : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared, score }); }
  }

  function teardown() {
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    window.removeEventListener('resize', fit);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; cv = null; ctx = null; S = null;
  }

  // ─── 시작 ───
  function start(map, onEnd) {
    if (S) return;                                   // 이미 돌고 있으면 무시
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['berry'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'appleGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('ap_title');
    // 점수 옆 아이콘도 **그 맵의 것**이다 — 🍎 를 박아 두면 버섯 마을에서 사과가 뜬다
    const D0 = window.GameData;
    const icon = ((D0 && D0.INGREDIENTS && D0.INGREDIENTS[pool[0]]) || {}).emoji || '🍎';
    host.innerHTML = `
      <div class="ap-stage">
        <canvas class="ap-canvas"></canvas>
        <div class="ap-hud">
          <span class="ap-name">${title}</span>
          <span class="ap-score">${icon} <b class="ap-n">0</b></span>
          <span class="ap-timer">2:00</span>
        </div>
        <div class="ap-hint">${T('ap_hint')}</div>
        <div class="ap-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.ap-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    // 판을 못 만들었으면 **들어가지 않는다** — 빈 화면에 2분을 가두는 것보다 낫다
    if (!S.grid) { teardown(); if (onEnd) onEnd({ picked: [], cleared: false, score: 0 }); return; }
    fit();
    window.addEventListener('resize', fit);

    // 드래그로 네모를 고른다. 캔버스 위에서만 잡는다
    const toCell = e => {
      const r = cv.getBoundingClientRect();
      return cellAt(e.clientX - r.left, e.clientY - r.top);
    };
    let dragging = false;
    cv.addEventListener('pointerdown', e => {
      if (!S || S.over) return;
      const p = toCell(e);
      if (!p) return;
      dragging = true;
      S.sel = { r1: p.r, c1: p.c, r2: p.r, c2: p.c };
      draw(); e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!dragging || !S || S.over) return;
      const p = toCell(e);
      if (p) { S.sel.r2 = p.r; S.sel.c2 = p.c; draw(); }
      e.preventDefault();
    });
    const release = () => {
      if (!dragging || !S) { dragging = false; return; }
      dragging = false;
      const s = S.sel; S.sel = null;
      if (s) apply(s.r1, s.c1, s.r2, s.c2);
      const el = host && host.querySelector('.ap-n');
      if (el) el.textContent = String(S ? S.score : 0);
      if (S) draw();
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    cv.addEventListener('pointerleave', release);
    // 캔버스에서 손가락을 움직일 때 화면이 같이 스크롤되지 않게
    cv.style.touchAction = 'none';

    // 남은 시간 표시
    const timerEl = host.querySelector('.ap-timer');
    const tick = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      timerT = setTimeout(tick, 200);
    };
    tick();

    raf = requestAnimationFrame(step);
  }

  // 검사용 구멍 — **캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 본다.**
  // `Pumpkin.faceState()` 와 같은 이유로 이 몇 줄이 필요하다
  function boardState() {
    if (!S) return null;
    return {
      rows: ROWS, cols: COLS, score: S.score, moves: S.moves, over: S.over,
      alive: S.grid.reduce((n, row) => n + row.filter(v => v > 0).length, 0),
      lastSum: S.lastSum,
      // 지금 깔려 있는 이모지 — **그 맵에서 나는 것인가**를 검사가 본다
      emojis: [...new Set(S.em.flat())],
      pool: (S.pool || []).slice(),
      // 지금 지울 수 있는 네모 하나 (없으면 null) — 검사가 «진짜로» 한 수 둘 수 있게
      hint: findMove(),
    };
  }
  function findMove() {
    if (!S || !S.grid) return null;
    const P = sums(S.grid);
    for (let r1 = 0; r1 < ROWS; r1++) for (let r2 = r1; r2 < ROWS; r2++)
      for (let c1 = 0; c1 < COLS; c1++) for (let c2 = c1; c2 < COLS; c2++)
        if (rectSum(P, r1, c1, r2, c2) === TARGET) return { r1, c1, r2, c2 };
    return null;
  }

  window.Apple = {
    start, boardState,
    // 검사용 — 한 수를 두거나 즉시 끝낼 때
    _play: (r1, c1, r2, c2) => apply(r1, c1, r2, c2),
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    REWARD_PER, REWARD_MAX, DUR_MS, COLS, ROWS, TARGET,
  };
})();
