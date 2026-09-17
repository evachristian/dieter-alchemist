// ═══════════════════════════════════════════════════════════════
//  바위산 — 돌깨기 게임 (테트리스)
//  바위산 형 맵(「흔들 바위산」)을 누르면 채집 대신 이 화면으로 들어온다
//  (`D.fieldMini(id) === 'rock'`).
//  굴러 내려오는 돌조각을 쌓아 **한 줄을 채우면 그 줄이 깨져 사라진다.**
//  2분 동안 깬 줄이 곧 점수이고, 점수가 그대로 가져가는 재료가 된다.
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 (`pumpkin.js`·`walnut.js` 와 같은 규칙이다).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS = 120000;     // 2분 — 다른 미니게임과 같은 길이로 맞춘다
  const COLS   = 10;
  const ROWS   = 16;
  // ⚠️ **판을 화면에 맞춰 «늘리지» 않는다.** 칸 크기만 줄이고 격자는 10×16 으로
  // 고정한다 — 큰 화면에서 판이 넓으면 같은 2분에 더 많이 벌게 되어
  // **화면 크기가 곧 보상**이 된다 (호두 게임에서와 같은 규칙이다)

  // ─── 보상 ───
  // **깬 줄이 그대로 재료가 된다** — 「점수가 높으면 더 얻는다」가 이 게임의 전부다.
  // ⚠️ **다른 미니게임과 같은 자리에 둔다.** 한쪽이 훨씬 후하면 나머지 맵은 아무도 안 간다 —
  //   호박 밭: 끝까지 버티면 **17개** · 호두밭: 거의 다 지우면 **20개**
  //   바위산 : 한 줄에 1개 · **상한 18개** (판 하나를 통째로 비우는 것보다 많다)
  // `checkbalance` 가 셋을 견준다
  const REWARD_PER = 1;      // 깬 줄 이만큼마다 재료 1개
  const REWARD_MAX = 18;
  // 히든 재료 — 많이 깰수록 오른다 (다른 둘과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  // ─── 떨어지는 속도 ───
  // 2분에 걸쳐 조금씩 빨라진다. ⚠️ **끝에 가서 손을 못 쓸 만큼 빨라지면 안 된다** —
  // 코지 게임이라 「점점 어려워지는 맛」만 있으면 되고, 벌은 이미 «시간»이 준다
  const DROP_START = 780, DROP_MIN = 420;
  const LOCK_MS  = 380;      // 바닥에 닿고 굳기까지 (끌어서 마지막에 밀어 넣을 틈)
  const SPAWN_X  = 3;        // 새 조각이 나오는 칸 (가운데)

  // ─── 돌이 깨지는 연출 ───
  const BURST_MS   = 560;    // 조각이 흩어져 사라지기까지
  const BURST_PER  = 5;      // 돌 한 칸이 몇 조각으로 깨지는가
  const FLASH_MS   = 240;    // 깨진 «줄»에 이는 돌먼지
  const SHAKE_MS   = 170, SHAKE_PX = 3;   // 깨질 때 판이 잠깐 흔들린다
  const GRAV       = 0.0016; // 파편에 걸리는 중력 (px/ms²)

  const PAD = 6;             // 판 바깥 여백

  // ─── 돌조각 일곱 ─────────────────────────────────────────────
  // 테트리스의 일곱 모양 그대로다. `n`×`n` 상자 안의 칸 목록으로 두고 **상자를 돌려서**
  // 회전한다 — 회전 상태를 네 벌씩 적어 두면 한 벌만 고쳤을 때 조용히 어긋난다
  const PIECES = [
    { n: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },   // I
    { n: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },   // O
    { n: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },   // T
    { n: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },   // S
    { n: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },   // Z
    { n: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },   // J
    { n: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },   // L
  ];

  // ─── 돌 빛깔 ───
  // ⚠️ **일곱을 «알록달록하게» 칠하지 않는다.** 여기서 쌓는 것은 블록이 아니라 돌이라,
  // 무지개로 칠하면 바위산에 사탕이 쌓인다. 화강암·사암·점판암처럼 **돌의 결 안에서만**
  // 갈라 놓는다 — 그래도 지금 내려오는 조각이 무엇인지는 테두리 빛으로 안다
  const STONE = [
    { f: '#8e8f8a', hi: '#adaea8', lo: '#6c6d68' },   // 화강암
    { f: '#9a8f7c', hi: '#b8ac97', lo: '#786e5e' },   // 사암
    { f: '#7e8a93', hi: '#9ba7b0', lo: '#606b73' },   // 점판암
    { f: '#8b7f71', hi: '#a89b8b', lo: '#6a6055' },   // 흙바위
    { f: '#96928d', hi: '#b3aea9', lo: '#75716c' },   // 차돌
    { f: '#85897e', hi: '#a2a699', lo: '#666a60' },   // 이끼바위
    { f: '#a09384', hi: '#bdaf9e', lo: '#7d7263' },   // 무른 돌
  ];
  const GRID_INK = 'rgba(255,255,255,0.05)';

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  // 같은 자리는 **언제 봐도 같은 얼룩**이어야 한다 — 매 프레임 새로 뽑으면 돌이
  // 지글거린다 (호두 게임의 「칸의 그림은 한 번 정해지면 안 바뀐다」와 같은 규칙이다).
  // 그래서 씨앗을 칸마다 «들고 다닌다» — 줄이 지워져 내려앉아도 그 돌의 얼룩은 그대로다
  const frac = v => v - Math.floor(v);
  const rnd = (seed, i) => frac(Math.sin(seed * 127.1 + i * 311.7) * 43758.5453);

  // ─── 상태 ───
  function newState(pool, specialId) {
    const grid = [], seed = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push(new Array(COLS).fill(0));     // 0 = 빈 칸 · 1~7 = 돌의 종류
      seed.push(new Array(COLS).fill(0));
    }
    return {
      t0: 0, now: 0, over: false, buried: false,
      grid, seed,
      p: null,                 // 지금 내려오는 조각 {k, n, cells, r, c, seeds}
      next: rollKind(),
      lines: 0,                // 깬 줄 = 점수
      drops: 0,                // 놓은 조각 수 (검사·연출용)
      lastDrop: 0, lockAt: 0,
      bits: [],                // 깨진 돌조각
      flashes: [],             // 깨진 줄에 이는 먼지
      shakeAt: 0,
      w: 0, h: 0, cell: 0, ox: 0, oy: 0,
      pool, specialId, picked: [], gotSpecial: false,
    };
  }
  const rollKind = () => Math.floor(Math.random() * PIECES.length);

  // ─── 조각 ───
  function makePiece(k) {
    const P = PIECES[k];
    return {
      k, n: P.n,
      cells: P.cells.map(c => c.slice()),
      r: 0, c: SPAWN_X + (P.n === 4 ? 0 : Math.floor((4 - P.n) / 2)),
      // 칸마다 제 얼룩을 들고 내려온다
      seeds: P.cells.map(() => Math.random()),
    };
  }
  // 조각이 지금 차지하는 절대 칸들
  const absCells = p => p.cells.map(([r, c]) => [p.r + r, p.c + c]);

  function fits(p, dr, dc, cells) {
    const cs = (cells || p.cells);
    for (const [r, c] of cs) {
      const rr = p.r + r + dr, cc = p.c + c + dc;
      if (cc < 0 || cc >= COLS || rr >= ROWS) return false;
      if (rr >= 0 && S.grid[rr][cc]) return false;
    }
    return true;
  }

  function move(dc) {
    if (!S || S.over || !S.p) return false;
    if (!fits(S.p, 0, dc)) return false;
    S.p.c += dc;
    touchLock();
    return true;
  }
  // 상자를 돌린다: (r,c) → (c, n-1-r). **차면 안 돌린다** — 벽에 붙었을 때
  // 한 칸 밀어 넣는 «킥»까지는 넣는다 (없으면 벽에 붙은 I 가 영영 안 선다)
  function rotate() {
    if (!S || S.over || !S.p) return false;
    const p = S.p, n = p.n;
    const turned = p.cells.map(([r, c]) => [c, n - 1 - r]);
    for (const dc of [0, -1, 1, -2, 2]) {
      if (fits(p, 0, dc, turned)) { p.cells = turned; p.c += dc; touchLock(); return true; }
    }
    return false;
  }
  // 한 칸 내리기 — 못 내리면 굳을 시각을 잡는다
  function stepDown() {
    if (!S || S.over || !S.p) return false;
    if (fits(S.p, 1, 0)) { S.p.r++; S.lastDrop = S.now; S.lockAt = 0; return true; }
    if (!S.lockAt) S.lockAt = S.now + LOCK_MS;
    return false;
  }
  // 바닥까지 떨구고 **그 자리에서 굳힌다** (아래로 쓸었을 때)
  function hardDrop() {
    if (!S || S.over || !S.p) return false;
    let n = 0;
    while (fits(S.p, 1, 0)) { S.p.r++; n++; }
    lock();
    return true;
  }
  // 바닥에 닿은 채로 옮기거나 돌리면 굳는 시각을 미뤄 준다 (마지막에 밀어 넣는 맛)
  function touchLock() {
    if (S.lockAt && fits(S.p, 1, 0)) S.lockAt = 0;
    else if (S.lockAt) S.lockAt = S.now + LOCK_MS;
  }

  // ─── 굳히기 · 줄 깨기 ───────────────────────────────────────
  function lock() {
    const p = S.p;
    p.cells.forEach(([r, c], i) => {
      const rr = p.r + r, cc = p.c + c;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        S.grid[rr][cc] = p.k + 1;
        S.seed[rr][cc] = p.seeds[i];
      }
    });
    S.p = null; S.lockAt = 0; S.drops++;
    clearLines();
    spawn();
  }

  function clearLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) if (S.grid[r].every(v => v > 0)) full.push(r);
    if (!full.length) return 0;
    // **깨지는 것을 «보여 준다»** — 지워진 돌이 그냥 사라지면 「줄이 찼다」가 안 읽힌다.
    // 사라진 자리에서 파편이 튀고 판이 잠깐 흔들린다
    full.forEach(r => {
      for (let c = 0; c < COLS; c++) burst(r, c, S.grid[r][c], S.seed[r][c]);
      // ⚠️ **파편만으로는 «깨졌다»가 안 읽힌다** — 한 프레임을 멈춰 놓고 보면 파편이
      // 그냥 «작은 돌»로 보여 판이 지저분해진 것처럼 읽힌다 (찍어 보고 알았다).
      // 그 줄에 먼지가 한 번 일어야 **어디가 깨졌는지**가 보인다
      S.flashes.push({ y: S.oy + r * S.cell, born: S.now });
    });
    S.shakeAt = S.now + SHAKE_MS;
    // 위에서부터 지우고 내려앉힌다. **얼룩도 같이 내려앉는다** — 안 그러면
    // 줄이 지워질 때마다 위의 돌들이 통째로 다른 무늬가 된다
    full.sort((a, b) => a - b).forEach(r => {
      S.grid.splice(r, 1); S.seed.splice(r, 1);
      S.grid.unshift(new Array(COLS).fill(0));
      S.seed.unshift(new Array(COLS).fill(0));
    });
    S.lines += full.length;
    if (window.Sfx) Sfx.play('pick');
    const el = host && host.querySelector('.rk-n');
    if (el) el.textContent = String(S.lines);
    return full.length;
  }

  // 돌 한 칸이 깨져 흩어진다
  function burst(r, c, k, seed) {
    const cell = S.cell;
    const x0 = S.ox + c * cell, y0 = S.oy + r * cell;
    for (let i = 0; i < BURST_PER; i++) {
      const a = rnd(seed, i * 3) * Math.PI * 2;
      const sp = 0.05 + rnd(seed, i * 3 + 1) * 0.14;
      S.bits.push({
        x: x0 + cell * (0.2 + rnd(seed, i * 3 + 2) * 0.6),
        y: y0 + cell * (0.2 + rnd(seed, i) * 0.6),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.12,
        rot: a, vr: (rnd(seed, i + 7) - 0.5) * 0.012,
        sz: cell * (0.09 + rnd(seed, i + 11) * 0.11),
        k: (k || 1) - 1, seed: seed + i, born: S.now,
      });
    }
  }

  function spawn() {
    const k = S.next;
    S.next = rollKind();
    const p = makePiece(k);
    S.p = p;
    S.lastDrop = S.now;
    // **나올 자리가 없으면 그 자리에서 끝난다** — 돌무더기가 천장까지 찬 것이다
    if (!fits(p, 0, 0)) { S.p = null; S.buried = true; finish(); }
  }

  // ─── 칸 ↔ 화면 ───
  function fit() {
    if (!host || !cv) return;
    const st = host.querySelector('.rk-stage');
    const w = st.clientWidth, h = st.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S) return;
    S.w = w; S.h = h;
    S.cell = Math.max(10, Math.min((w - PAD * 2) / COLS, (h - PAD * 2) / ROWS));
    S.ox = (w - S.cell * COLS) / 2;
    S.oy = (h - S.cell * ROWS) / 2;
  }

  // ─── 그리기 ─────────────────────────────────────────────────
  // 돌 한 칸. **네모가 아니라 «모서리가 깎인 돌»**이고, 얼룩은 씨앗이 정하므로
  // 다시 그려도 같은 자리에 찍힌다
  function stonePath(x, y, s, seed) {
    const m = s * 0.055, w = s - m * 2;
    const x0 = x + m, y0 = y + m;
    const cut = w * 0.24;
    const j = i => (rnd(seed, i) - 0.5) * w * 0.12;
    ctx.beginPath();
    ctx.moveTo(x0 + cut + j(1), y0 + j(2));
    ctx.lineTo(x0 + w - cut + j(3), y0 + j(4));
    ctx.lineTo(x0 + w + j(5), y0 + cut + j(6));
    ctx.lineTo(x0 + w + j(7), y0 + w - cut + j(8));
    ctx.lineTo(x0 + w - cut + j(9), y0 + w + j(10));
    ctx.lineTo(x0 + cut + j(11), y0 + w + j(12));
    ctx.lineTo(x0 + j(13), y0 + w - cut + j(14));
    ctx.lineTo(x0 + j(15), y0 + cut + j(16));
    ctx.closePath();
  }
  function drawStone(x, y, s, k, seed, ghost) {
    const C = STONE[k % STONE.length];
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.22;
    stonePath(x, y, s, seed);
    ctx.fillStyle = C.f; ctx.fill();
    if (!ghost) {
      // 깎인 면 — 오른쪽 아래를 어둡게, 왼쪽 위를 밝게. 이 둘이 돌을 «덩어리»로 만든다
      ctx.save(); ctx.clip();
      ctx.fillStyle = C.lo;
      ctx.beginPath();
      ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s * 0.42); ctx.lineTo(x + s, y + s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.hi;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + s * 0.62, y); ctx.lineTo(x, y + s * 0.52);
      ctx.closePath(); ctx.fill();
      // 얼룩 — 돌의 결. 두 점이면 충분하고, 많으면 숫자 없는 화면이 지저분해진다
      ctx.fillStyle = C.lo;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 2; i++) {
        const px = x + s * (0.28 + rnd(seed, 20 + i) * 0.42);
        const py = y + s * (0.3 + rnd(seed, 30 + i) * 0.4);
        ctx.beginPath();
        ctx.ellipse(px, py, s * 0.07, s * 0.05, rnd(seed, 40 + i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function draw() {
    if (!S || !ctx) return;
    const cell = S.cell;
    ctx.clearRect(0, 0, S.w, S.h);
    ctx.save();
    // 깨질 때의 흔들림 — **그리기에만 걸린다.** 칸 ↔ 화면 셈(`S.ox`)은 안 건드리므로
    // 손가락이 가리키는 칸은 그대로다
    if (S.shakeAt > S.now) {
      const k = (S.shakeAt - S.now) / SHAKE_MS;
      ctx.translate((Math.random() - 0.5) * SHAKE_PX * 2 * k, (Math.random() - 0.5) * SHAKE_PX * 2 * k);
    }
    // 판 — 돌벽에 파인 홈
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(S.ox, S.oy, cell * COLS, cell * ROWS);
    ctx.strokeStyle = GRID_INK; ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(S.ox + c * cell, S.oy); ctx.lineTo(S.ox + c * cell, S.oy + cell * ROWS); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(S.ox, S.oy + r * cell); ctx.lineTo(S.ox + cell * COLS, S.oy + r * cell); ctx.stroke();
    }
    // 쌓인 돌
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = S.grid[r][c];
      if (v) drawStone(S.ox + c * cell, S.oy + r * cell, cell, v - 1, S.seed[r][c]);
    }
    // 내려오는 조각 — **어디에 떨어질지 미리 보여 준다** (그림자).
    // 안 보여 주면 빠른 판에서 「한 칸 옆이었는데」가 반복되어 손이 굳는다
    if (S.p) {
      let g = 0;
      while (fits(S.p, g + 1, 0)) g++;
      S.p.cells.forEach(([r, c], i) => {
        const rr = S.p.r + r + g;
        if (rr >= 0) drawStone(S.ox + (S.p.c + c) * cell, S.oy + rr * cell, cell, S.p.k, S.p.seeds[i], true);
      });
      S.p.cells.forEach(([r, c], i) => {
        const rr = S.p.r + r;
        if (rr >= 0) drawStone(S.ox + (S.p.c + c) * cell, S.oy + rr * cell, cell, S.p.k, S.p.seeds[i]);
      });
    }
    // 깨진 줄의 먼지 — 파편보다 «먼저» 깔린다
    for (const f of S.flashes) {
      const k = 1 - (S.now - f.born) / FLASH_MS;
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha = k * 0.5;
      const g2 = ctx.createLinearGradient(0, f.y, 0, f.y + cell);
      g2.addColorStop(0, 'rgba(255,248,232,0)');
      g2.addColorStop(0.5, 'rgba(255,248,232,1)');
      g2.addColorStop(1, 'rgba(255,248,232,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(S.ox, f.y - cell * 0.15, cell * COLS, cell * 1.3);
      ctx.restore();
    }
    // 깨진 조각
    for (const b of S.bits) {
      const age = S.now - b.born;
      const k = 1 - age / BURST_MS;
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = STONE[b.k % STONE.length].f;
      ctx.beginPath();
      ctx.moveTo(-b.sz, -b.sz * 0.6);
      ctx.lineTo(b.sz * 0.8, -b.sz);
      ctx.lineTo(b.sz, b.sz * 0.7);
      ctx.lineTo(-b.sz * 0.5, b.sz);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ─── 한 프레임 ───
  // 돌이 «내려오는» 게임이라 **프레임마다 그린다** (호박 밭과 같다 —
  // 호두 게임만 물리가 없어서 바뀔 때만 그린다)
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.lastDrop = ts; }
    S.now = ts;
    const elapsed = ts - S.t0;
    if (elapsed >= DUR_MS) { finish(); return; }

    // 파편 — 흩어져 떨어지다 사라진다
    if (S.bits.length) {
      const dt = 16;
      for (const b of S.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += GRAV * dt; b.rot += b.vr * dt; }
      S.bits = S.bits.filter(b => ts - b.born < BURST_MS);
    }
    if (S.flashes.length) S.flashes = S.flashes.filter(f => ts - f.born < FLASH_MS);
    // 굳기
    if (S.p && S.lockAt && ts >= S.lockAt) { if (!fits(S.p, 1, 0)) lock(); else S.lockAt = 0; }
    // 자동 낙하 — 2분에 걸쳐 조금씩 빨라진다
    const iv = DROP_START - (DROP_START - DROP_MIN) * Math.min(1, elapsed / DUR_MS);
    if (S.p && ts - S.lastDrop >= iv) { if (!stepDown()) S.lastDrop = ts; }

    draw();
    raf = requestAnimationFrame(step);
  }

  // ─── 끝내기 ───
  function finish() {
    if (!S || S.over) return;
    S.over = true;
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    // **점수를 재료로 바꾼다** — 이 두 줄이 「점수가 높으면 더 얻는다」의 전부다
    const n = Math.min(REWARD_MAX, Math.floor(S.lines / REWARD_PER));
    for (let i = 0; i < n; i++) S.picked.push(pickItem());
    // 히든 재료 — 많이 깰수록 오른다
    if (S.specialId) {
      const prog = Math.min(1, S.lines / (REWARD_MAX * REWARD_PER));
      if (Math.random() < SP_BASE + SP_TOP * prog) {
        S.picked.push(S.specialId);
        S.gotSpecial = true;
      }
    }
    showResult();
  }

  function pickItem() {
    const p = S.pool && S.pool.length ? S.pool : ['flint'];
    return p[Math.floor(Math.random() * p.length)];
  }

  function showResult() {
    const D = window.GameData;
    const counts = {};
    S.picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.keys(counts).map(id => {
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '🪨', name: id };
      return `<span class="rk-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.rk-result');
    box.innerHTML = `
      <div class="rk-res-title">${S.buried ? T('rk_buried', { n: S.lines }) : T('rk_done', { n: S.lines })}</div>
      <div class="rk-res-items">${rows || `<span class="rk-item">${T('rk_none')}</span>`}</div>
      <button class="btn rk-close">${T('rk_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.rk-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const lines = S ? S.lines : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared: false, score: lines }); }
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
    const pool = (map && map.pool) || ['flint'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'rockGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('rk_title');
    const D0 = window.GameData;
    const icon = ((D0 && D0.INGREDIENTS && D0.INGREDIENTS[pool[0]]) || {}).emoji || '🪨';
    host.innerHTML = `
      <div class="rk-stage">
        <canvas class="rk-canvas"></canvas>
        <div class="rk-hud">
          <span class="rk-name">${title}</span>
          <span class="rk-score">${icon} <b class="rk-n">0</b></span>
          <span class="rk-timer">2:00</span>
        </div>
        <div class="rk-hint">${T('rk_hint')}</div>
        <div class="rk-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.rk-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    spawn();
    draw();
    window.addEventListener('resize', fit);

    // ─── 손가락 ───────────────────────────────────────────────
    // 옮기기는 **끌기**, 돌리기는 **탭**, 떨어뜨리기는 **아래로 쓸기**.
    // ⚠️ 버튼을 화면에 깔지 않는다 — 판이 작아지고, 엄지로 가릴 자리도 는다
    const at = e => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    let g = null;
    cv.addEventListener('pointerdown', e => {
      if (!S || S.over) return;
      const p = at(e);
      g = { x0: p.x, y0: p.y, t: performance.now(), steps: 0, dropped: false, moved: false };
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!g || !S || S.over) return;
      const p = at(e), cell = S.cell;
      const dx = p.x - g.x0, dy = p.y - g.y0;
      // 아래로 쓸면 그 자리에 떨군다 (한 번만)
      if (!g.dropped && dy > cell * 1.6 && dy > Math.abs(dx) * 1.4) {
        g.dropped = true; g.moved = true; hardDrop(); draw();
        e.preventDefault(); return;
      }
      if (g.dropped) return;
      const want = Math.round(dx / cell);
      while (g.steps < want) { if (!move(1)) break; g.steps++; g.moved = true; }
      while (g.steps > want) { if (!move(-1)) break; g.steps--; g.moved = true; }
      draw();
      e.preventDefault();
    });
    const release = () => {
      if (!g) return;
      const quick = performance.now() - g.t < 320;
      if (!g.moved && quick && S && !S.over) { rotate(); draw(); }
      g = null;
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    cv.addEventListener('pointerleave', release);
    cv.style.touchAction = 'none';

    // 남은 시간 표시
    const timerEl = host.querySelector('.rk-timer');
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
  // `Pumpkin.faceState()`·`Walnut.boardState()` 와 같은 이유로 이 몇 줄이 필요하다
  function boardState() {
    if (!S) return null;
    return {
      rows: ROWS, cols: COLS, lines: S.lines, drops: S.drops, over: S.over, buried: S.buried,
      filled: S.grid.reduce((n, row) => n + row.filter(v => v > 0).length, 0),
      piece: S.p ? { k: S.p.k, r: S.p.r, c: S.p.c, cells: S.p.cells.map(c => c.slice()) } : null,
      bits: S.bits.length,
      rowsFull: S.grid.filter(row => row.every(v => v > 0)).length,
    };
  }

  window.Rock = {
    start, boardState,
    // 검사용 — 손가락 없이 한 수를 두거나, 조각을 정해 놓고 떨어뜨리거나, 즉시 끝낼 때
    _move: dc => move(dc),
    _rotate: () => rotate(),
    _drop: () => hardDrop(),
    _spawn: k => { if (S && !S.over) { S.p = makePiece(k); return !!S.p; } return false; },
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    PIECES, REWARD_PER, REWARD_MAX, DUR_MS, COLS, ROWS, BURST_MS,
  };
})();
