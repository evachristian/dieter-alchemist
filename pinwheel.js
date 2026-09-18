// ═══════════════════════════════════════════════════════════════
//  바람개비 밭 — 바람개비 퍼즐 미니게임 (Steam 「Arrows Puzzle」 식)
//  맵 카드를 누르면 채집 대신 이 화면으로 들어온다 (`D.fieldMini(map.id) === 'pinwheel'`).
//
//  **바람개비는 «제가 도는 쪽»으로만 날아간다.** 누르면 그 방향으로 판을 빠져나가는데,
//  가는 길에 다른 바람개비가 하나라도 있으면 못 나간다 — 어느 것부터 치울지가 곧 퍼즐이다.
//  한 수가 **연쇄로 길을 연다**. 판을 다 비우면 새 판이 깔리고, 2분 동안 치운 수가 재료다.
//
//  **생명 셋** — 막힌 것을 세 번 누르면 그 자리에서 끝난다 (사람이 정한 규칙이다).
//  ⚠️ 한때는 「막혀도 벌이 없다 · 흔들리기만 한다」였다. 바뀐 뒤에도 **재료는
//  한 톨도 안 없어진다** — 그때까지 치운 것은 그대로 가져간다. 돌깨기에서 천장까지
//  차면 그 자리에서 끝나되 깬 줄은 그대로 가져가는 것(`rk_buried`)과 같은 자리다.
//  **잃는 것은 재료가 아니라 남은 시간이다.**
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 (다른 미니게임 넷과 같은 규칙이다).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS = 120000;     // 2분 — 생각하는 게임이라 다른 넷과 같은 길이로 둔다

  // ─── 판 ───
  // ⚠️ **큰 화면에서 바람개비를 더 주지 않는다** — 격자를 고정하고 칸 크기만 바꾼다
  // (호두 게임의 「화면 크기가 곧 보상이 되면 안 된다」와 같은 규칙이다)
  const COLS = 6, ROWS = 7;
  // 한 판에 깔리는 수 — 칸의 이만큼. ⚠️ **꽉 채우지 않는다**: 빈 칸이 있어야
  // 「길이 열려 있는 것」이 처음부터 몇 개 보이고, 그래야 첫 수가 막막하지 않다
  const FILL = 0.62;
  const REFILL_MS = 620;     // 판을 다 비우고 새 판이 깔리기까지 (한숨 돌리는 틈)

  // ─── 보상 ───
  // **바람개비 `REWARD_PER` 개마다 재료 하나** (호두밭·바위산과 같은 방향이다).
  // 상한 18개는 90개이고 한 판이 스물여섯 개쯤이라 **판을 서너 번은 비워야** 닿는다.
  // `checkbalance` 가 다섯과 견준다
  const REWARD_PER = 5;
  const REWARD_MAX = 18;
  // 히든 재료 — 많이 치울수록 오른다 (다른 넷과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  // ─── 생명 ───
  // **막힌 것을 이만큼 누르면 끝난다.** 잃는 것은 «재료»가 아니라 «남은 시간»이다 —
  // 그때까지 치운 것은 그대로 가져간다 (위 머리말).
  // ⚠️ **깎는 문은 `loseLife()` 한 곳이다.** 다른 데서 또 깎으면 경로가 둘이 되어
  // 한쪽 빗장을 빼도 다른 쪽이 막아 준다 (낚시의 `hook()` 에서 배운 자리다)
  const LIVES = 3;
  const OOPS_MS = 1500;      // 공주가 「아이쿠」 하는 동안 (마지막 하나를 잃으면 이만큼 뒤에 끝난다)
  const HEART_POP_MS = 620;  // 하트가 터져 사라지는 동안 (CSS `pwHeartPop` 과 같은 값)

  // ─── 연출 ───
  const FLY_MS = 380;        // 날아 나가는 시간
  const SHAKE_MS = 300;      // 막혔을 때 흔들리는 시간
  const CLEAR_MS = 900;      // 판을 다 비웠을 때 뜨는 글자
  const SPIN = 0.0022;       // 바람개비가 도는 속도 (rad/ms)

  const PAD = 10;
  const HUD_H = 46, HINT_H = 44;

  // ─── 바람빛 ───
  // 「바람개비가 끝없이 돌아가는 밭」 — 노을 밀밭과 **일부러 반대로** 환한 한낮이다
  // (같은 평야 지대에 비슷한 그림 둘이 서면 어디가 어딘지 헷갈린다)
  const SKY_TOP = '#7ec8f0', SKY_BOT = '#cdeaf7';
  const HILL_FAR = '#9fd48a', HILL_NEAR = '#79bf68', GRASS = '#63ab55';
  const CREAM = '#fff6e6', INK = '#2f2416';
  const TILE = '#fffaf0', TILE_EDGE = '#e4d6bd', TILE_SH = 'rgba(60,44,20,0.16)';
  // 방향마다 색이 다르다 — ⚠️ **색«만»으로 가르지 않는다**(화살촉이 따로 있다).
  // 색을 못 보는 사람에게도 방향이 보여야 한다 (`.ask-chip.fresh` 의 🆕 와 같은 규칙)
  const DIR_COL = ['#ff8fb0', '#7fc8ff', '#ffc857', '#8fe0a8'];   // ↑ → ↓ ←
  const DIR_DARK = ['#d4577c', '#4b95cc', '#d29a2a', '#4fae73'];

  // 위 · 오른쪽 · 아래 · 왼쪽
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0, oopsT = 0, deadT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ─── 상태 만들기 ───
  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, last: 0,
      grid: [], flying: [], boards: 0, cleared: 0,
      clearedAt: 0, refillAt: 0,
      pool, specialId, picked: [], gotSpecial: false,
      // `dying` 은 마지막 하나를 잃고 「아이쿠」를 읽는 동안이다 — 아직 `over` 는 아니지만
      // 누르는 것은 안 먹는다. 이것이 없으면 그 1.5초에 계속 눌려 점수가 더 오른다
      lives: LIVES, lostAt: 0, dying: false, dead: false,
      over: false, w: 0, h: 0, cell: 0, ox: 0, oy: 0,
    };
  }

  const at = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? undefined : S.grid[r * COLS + c]);
  const put = (c, r, v) => { S.grid[r * COLS + c] = v; };

  // ─── 반드시 풀리는 판 만들기 ─────────────────────────────────
  //
  // ⚠️ **아무렇게나 깔면 «절대 안 풀리는 판»이 나온다** — 서로가 서로의 길을 막으면
  // 첫 수부터 아무것도 못 누른다. 2분짜리에서 그건 그냥 빼앗긴 시간이다.
  //
  // 그래서 **치우는 순서의 «거꾸로»로 깐다**: 빈 판에서 시작해, **지금 놓아도 그 방향의
  // 길이 비어 있는** 칸에만 하나씩 놓는다. 그러면 마지막에 놓은 것부터 거꾸로 치우는
  // 순서가 언제나 답이 된다 — **풀리는지 검사할 필요가 없다. 만들 때부터 풀린다.**
  function newBoard() {
    S.grid = new Array(COLS * ROWS).fill(null);
    const want = Math.round(COLS * ROWS * FILL);
    let placed = 0, tries = 0;
    while (placed < want && tries < want * 60) {
      tries++;
      const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
      if (at(c, r)) continue;
      // 이 칸에서 «길이 열려 있는» 방향을 모은다 (넷 다 막혔으면 이 칸은 건너뛴다)
      const open = [];
      for (let d = 0; d < 4; d++) if (pathClear(c, r, d)) open.push(d);
      if (!open.length) continue;
      const d = open[Math.floor(Math.random() * open.length)];
      put(c, r, { d, born: S.now, shake: 0, seed: Math.random() * 6.28 });
      placed++;
    }
    S.boards++;
    S.left = placed;
  }

  // 그 칸에서 그 방향으로 **판 끝까지** 비어 있는가
  function pathClear(c, r, d) {
    let x = c + DX[d], y = r + DY[d];
    while (x >= 0 && y >= 0 && x < COLS && y < ROWS) {
      if (at(x, y)) return false;
      x += DX[d]; y += DY[d];
    }
    return true;
  }

  // ─── 누르기 ───────────────────────────────────────────────
  // ⚠️ **문은 여기 하나다.** 손가락 쪽에서 「막혔나」를 한 번 더 보면 문이 둘이 되어
  // 한쪽 빗장을 빼도 다른 쪽이 막아 준다 (낚시의 `hook()` 에서 배운 자리다).
  // 돌려주는 값은 「정말로 날아갔는가」다
  function tap(c, r) {
    if (!S || S.over || S.dying || S.refillAt) return false;
    const p = at(c, r);
    if (!p) return false;
    if (!pathClear(c, r, p.d)) {
      p.shake = S.now;
      loseLife();                       // ⚠️ 생명을 깎는 문은 이 한 줄뿐이다
      return false;
    }
    put(c, r, null);
    S.left--;
    S.cleared++;
    S.flying.push({ c, r, d: p.d, born: S.now, seed: p.seed });
    if (window.Sfx) Sfx.play('success');
    // 판을 다 비웠다 — 한숨 돌리고 새 판
    if (S.left <= 0) { S.clearedAt = S.now; S.refillAt = S.now + REFILL_MS; }
    return true;
  }

  // ─── 생명 하나를 잃는다 ─────────────────────────────────────
  //
  // 하트가 터져 사라지고, 공주가 「아이쿠, 틀렸네!」 한다.
  // ⚠️ **하트도 「아이쿠」도 캔버스가 아니라 DOM 이다** — 캔버스 안은 `checkUI()` 가
  // 아무것도 못 보는 자리라, 글자가 있는 것은 DOM 에 두어야 대비·넘침이 재진다
  // (미니게임의 HUD·결과 화면을 DOM 으로 둔 것과 같은 규칙이다).
  function loseLife() {
    if (!S || S.over || S.dying) return;
    S.lives = Math.max(0, S.lives - 1);
    S.lostAt = S.now;
    paintHearts();
    showOops();
    if (window.Sfx) Sfx.play('fail');
    if (S.lives > 0) return;
    // **마지막 하나** — 「아이쿠」를 읽을 틈을 주고 끝낸다. 그 사이에는 안 눌린다(`dying`).
    // ⚠️ 그 자리에서 바로 `finish()` 하면 결과 판이 덮어써서 **방금 터진 하트도
    // 공주도 한 프레임도 못 보고 사라진다** (그려 보고 알았다)
    S.dying = true; S.dead = true;
    deadT = setTimeout(() => { if (S) finish(); }, OOPS_MS);
  }

  // 하트 셋 — 잃은 만큼 `.gone` 이 붙는다. **뒤에서부터** 꺼진다
  function paintHearts() {
    if (!host || !S) return;
    const hs = host.querySelectorAll('.pw-heart');
    hs.forEach((h, i) => h.classList.toggle('gone', i >= S.lives));
    const box = host.querySelector('.pw-lives');
    if (box) box.setAttribute('aria-label', T('pw_lives_n', { n: S.lives }));
  }

  // 놀란 공주의 얼굴 — `Portrait.bust()` 가 내주는 SVG 문자열이다.
  // ⚠️ **캔버스가 아니라 DOM 이라 그대로 넣으면 된다** (호박 밭은 캔버스라 Image 로
  // 굽는 한 겹이 더 있었다). ⚠️ **못 그려도 게임은 그대로 돌아야 한다** —
  // 실패하면 얼굴 없이 대사만 뜬다 (미니게임이 안 뜨는 것보다 훨씬 낫다)
  function oopsFace() {
    try {
      const sp = window.GameData && GameData.speaker('sp_gwiriel');
      if (!sp || !window.Portrait) return '';
      // 「아이쿠!」 하는 얼굴이라 `shock`(놀람)이다 — 이름은 `data.js` 의 `moods` 표에서 고른다
      return Portrait.bust(sp, 'shock', { bare: true }) || '';
    } catch (e) { return ''; }
  }

  // 공주가 한마디 — 같은 층에 하나만 뜬다 (겹쳐 뜨면 글자가 겹쳐 읽힌다)
  function showOops() {
    if (!host || !S) return;
    const box = host.querySelector('.pw-oops');
    if (!box) return;
    // ⚠️ **얼굴은 매번 다시 안 그린다** — 초상화 SVG 는 한 번 넣어 두고 층만 켠다.
    // 매번 그리면 누를 때마다 파서가 돌아 2분 내내 끊긴다
    box.classList.remove('show');
    void box.offsetWidth;                       // 애니메이션을 처음부터 다시 돌린다
    box.classList.add('show');
    clearTimeout(oopsT);
    oopsT = setTimeout(() => { if (host) box.classList.remove('show'); }, OOPS_MS);
  }

  // ─── 캔버스 크기 맞추기 (DPR 반영) ───
  function fit() {
    if (!cv || !S) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    S.w = Math.max(1, r.width);
    S.h = Math.max(1, r.height);
    cv.width = Math.round(S.w * dpr);
    cv.height = Math.round(S.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 판이 HUD 와 안내 줄을 **파고들지 않게** 자리를 먼저 떼어 놓는다
    // (돌깨기의 「다음 조각 자리를 미리 떼어 놓는다」와 같은 규칙이다)
    const room = S.h - HUD_H - HINT_H - PAD * 2;
    S.cell = Math.max(24, Math.min((S.w - PAD * 2) / COLS, room / ROWS));
    S.ox = (S.w - S.cell * COLS) / 2;
    S.oy = HUD_H + PAD + Math.max(0, (room - S.cell * ROWS) / 2);
  }

  // ─── 한 프레임 ───
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.last = ts; }
    S.last = ts; S.now = ts;
    const elapsed = ts - S.t0;

    if (S.refillAt && ts >= S.refillAt) { S.refillAt = 0; newBoard(); }
    S.flying = S.flying.filter(f => ts - f.born < FLY_MS);

    draw(elapsed);

    if (elapsed >= DUR_MS) { finish(); return; }
    raf = requestAnimationFrame(step);
  }

  // ─── 그리기 ─────────────────────────────────────────────────
  function sky() {
    const { w, h } = S;
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    g.addColorStop(0, SKY_TOP); g.addColorStop(1, SKY_BOT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 구름 — 납작하게 몇 줄만 (플랫 2D 라 뭉게구름을 안 그린다)
    ctx.save(); ctx.fillStyle = CREAM;
    for (let i = 0; i < 4; i++) {
      const cy = h * (0.07 + i * 0.05), cw = w * (0.24 + (i % 3) * 0.1);
      const cx = ((i * 137) % 100) / 100 * w + Math.sin(S.now / 9000 + i) * 12;
      ctx.globalAlpha = 0.5 + (i % 2) * 0.16;
      ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2, 5 + (i % 2) * 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 언덕 둘 + 풀밭 — 판 뒤가 텅 비면 「밭」이 아니라 그냥 색이다 (낚시에서 배운 것과 같다)
    const hy = h * 0.62;
    ctx.fillStyle = HILL_FAR;
    ctx.beginPath(); ctx.moveTo(-10, hy + 30);
    ctx.quadraticCurveTo(w * 0.28, hy - 34, w * 0.62, hy + 16);
    ctx.quadraticCurveTo(w * 0.85, hy + 40, w + 10, hy + 4);
    ctx.lineTo(w + 10, h); ctx.lineTo(-10, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = HILL_NEAR;
    ctx.beginPath(); ctx.moveTo(-10, hy + 62);
    ctx.quadraticCurveTo(w * 0.42, hy + 16, w + 10, hy + 54);
    ctx.lineTo(w + 10, h); ctx.lineTo(-10, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
    // 바람 — 옆으로 흐르는 가는 선 (「끝없이 돌아가는」 까닭이 보여야 한다)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = h * (0.12 + i * 0.16) + Math.sin(S.now / 1800 + i) * 4;
      const x = ((S.now / 26 + i * 130) % (w + 180)) - 90;
      ctx.globalAlpha = 0.25 + (i % 2) * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 26, y - 5, x + 52, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 바람개비 하나 — **도는 날개 넷 + 방향을 말하는 화살촉**.
  // ⚠️ **날개만으로는 어느 쪽인지 안 보인다** — 퍼즐에서 방향이 안 읽히면 게임이 아니다.
  // 그래서 가운데에 화살촉을 얹고, 타일 테두리도 그 색으로 물들인다 (색 + 모양 둘 다)
  function pinwheel(px, py, size, d, spin, alpha) {
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    // 타일
    ctx.fillStyle = TILE_SH;
    roundRect(px - s / 2, py - s / 2 + 3, s, s, s * 0.26); ctx.fill();
    ctx.fillStyle = TILE;
    roundRect(px - s / 2, py - s / 2, s, s, s * 0.26); ctx.fill();
    ctx.strokeStyle = DIR_DARK[d]; ctx.lineWidth = Math.max(2, s * 0.06);
    roundRect(px - s / 2, py - s / 2, s, s, s * 0.26); ctx.stroke();
    // 날개 넷 — 돈다
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(spin);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = i % 2 ? DIR_COL[d] : DIR_DARK[d];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.34, -s * 0.06, s * 0.34, s * 0.30);
      ctx.quadraticCurveTo(s * 0.14, s * 0.22, 0, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 화살촉 — **방향을 말하는 것은 이것이다.**
    // ⚠️ **작게 두면 도는 날개에 묻힌다** (찍어 보고 키웠다) — 퍼즐에서 방향이 안 읽히면
    // 게임이 아니다. 흰 바탕을 깔고 그 위에 크게 얹어 날개와 층을 가른다
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(d * Math.PI / 2);                 // 0 = 위
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = DIR_DARK[d]; ctx.lineWidth = Math.max(1.4, s * 0.035);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.29, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.24);                    // 끝
    ctx.lineTo(s * 0.19, s * 0.08);
    ctx.lineTo(0, -s * 0.03);                    // 꼬리가 파인 «화살촉» 모양
    ctx.lineTo(-s * 0.19, s * 0.08);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(elapsed) {
    if (!S) return;
    ctx.clearRect(0, 0, S.w, S.h);
    sky();
    const s = S.cell, gap = s * 0.09;
    // 판 바닥 — 타일이 어디 놓이는지가 보여야 «판»으로 읽힌다
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(S.ox - 6, S.oy - 6, s * COLS + 12, s * ROWS + 12, 16); ctx.fill();
    ctx.restore();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = at(c, r);
        if (!p) continue;
        let px = S.ox + c * s + s / 2, py = S.oy + r * s + s / 2;
        // 막혔을 때의 흔들림 — ⚠️ **그리기에만 건다** (칸 셈을 흔들면 손가락이 어긋난다)
        const sk = S.now - p.shake;
        if (p.shake && sk < SHAKE_MS) px += Math.sin(sk / 22) * (1 - sk / SHAKE_MS) * 6;
        pinwheel(px, py, s - gap, p.d, S.now * SPIN + p.seed, 1);
      }
    }
    // 날아 나가는 것들
    for (const f of S.flying) {
      const k = (S.now - f.born) / FLY_MS;
      const e = k * k;                            // 갈수록 빨라진다 (바람에 밀려 나가듯)
      const px = S.ox + f.c * s + s / 2 + DX[f.d] * e * (S.w + s);
      const py = S.oy + f.r * s + s / 2 + DY[f.d] * e * (S.h + s);
      pinwheel(px, py, s - gap, f.d, S.now * SPIN * 3 + f.seed, Math.max(0, 1 - k));
    }
    // 판을 다 비웠다
    if (S.clearedAt && S.now - S.clearedAt < CLEAR_MS) {
      const k = (S.now - S.clearedAt) / CLEAR_MS;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 27px system-ui, -apple-system, sans-serif';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(30,40,20,0.9)'; ctx.lineWidth = 6;
      ctx.strokeText(T('pw_swept'), S.w / 2, S.oy + s * ROWS / 2);
      ctx.fillStyle = '#ffe08a';
      ctx.fillText(T('pw_swept'), S.w / 2, S.oy + s * ROWS / 2);
      ctx.restore();
    }
    const el = host && host.querySelector('.pw-n');
    if (el) el.textContent = String(S.cleared);
  }

  // ─── 끝내기 ─────────────────────────────────────────────────
  function finish() {
    if (!S || S.over) return;
    S.over = true; S.dying = false;
    cancelAnimationFrame(raf);
    clearTimeout(timerT); clearTimeout(deadT); clearTimeout(oopsT);
    // ⚠️ **생명이 다해 끝나도 치운 것은 그대로 계산한다** — 잃는 것은 남은 시간이지
    // 재료가 아니다 (돌깨기의 `rk_buried` 와 같은 자리다)
    const n = Math.min(REWARD_MAX, Math.floor(S.cleared / REWARD_PER));
    for (let i = 0; i < n; i++) S.picked.push(pickItem());
    if (S.specialId) {
      const prog = Math.min(1, n / REWARD_MAX);
      if (Math.random() < SP_BASE + SP_TOP * prog) {
        S.picked.push(S.specialId);
        S.gotSpecial = true;
      }
    }
    showResult();
  }

  function pickItem() {
    const p = S.pool && S.pool.length ? S.pool : ['wheat'];
    return p[Math.floor(Math.random() * p.length)];
  }

  function showResult() {
    const D = window.GameData;
    const counts = {};
    S.picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.keys(counts).map(id => {
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '🌬️', name: id };
      return `<span class="pw-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.pw-result');
    box.innerHTML = `
      <div class="pw-res-title">${S.dead ? T('pw_dead', { n: S.cleared })
        : (S.cleared ? T('pw_done', { n: S.cleared }) : T('pw_none'))}</div>
      <div class="pw-res-items">${rows || `<span class="pw-item">${T('pw_none')}</span>`}</div>
      <button class="btn pw-close">${T('pw_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.pw-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const cleared = S ? S.cleared : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared: false, score: cleared }); }
  }

  function teardown() {
    cancelAnimationFrame(raf);
    clearTimeout(timerT); clearTimeout(deadT); clearTimeout(oopsT);
    window.removeEventListener('resize', fit);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; cv = null; ctx = null; S = null;
  }

  // ─── 시작 ───
  function start(map, onEnd) {
    if (S) return;                               // 이미 돌고 있으면 무시
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['wheat'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'pinwheelGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('pw_title');
    host.innerHTML = `
      <div class="pw-stage">
        <canvas class="pw-canvas"></canvas>
        <div class="pw-hud">
          <span class="pw-name">${title}</span>
          <span class="pw-lives" role="img" aria-label="${T('pw_lives_n', { n: LIVES })}"
            >${new Array(LIVES).fill('<i class="pw-heart">♥</i>').join('')}</span>
          <span class="pw-score">🌬️ <b class="pw-n">0</b></span>
          <span class="pw-timer">2:00</span>
        </div>
        <div class="pw-tbar"><i></i></div>
        <div class="pw-hint"><span>${T('pw_hint')}</span></div>
        <div class="pw-oops">
          <div class="pw-oops-face">${oopsFace()}</div>
          <div class="pw-oops-say">${T('pw_oops')}</div>
        </div>
        <div class="pw-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.pw-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    newBoard();
    window.addEventListener('resize', fit);

    // ─── 손가락 ───
    cv.addEventListener('pointerdown', e => {
      if (!S || S.over) return;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const c = Math.floor((x - S.ox) / S.cell), rw = Math.floor((y - S.oy) / S.cell);
      if (c >= 0 && rw >= 0 && c < COLS && rw < ROWS) tap(c, rw);
      e.preventDefault();
    });
    cv.style.touchAction = 'none';

    // 남은 시간 — 숫자 + 막대 (참새 쫓기와 같은 꼴로 둔다)
    const timerEl = host.querySelector('.pw-timer');
    const barEl = host.querySelector('.pw-tbar');
    const fillEl = host.querySelector('.pw-tbar > i');
    const tickUI = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      fillEl.style.width = (left / DUR_MS * 100).toFixed(1) + '%';
      const hurry = left <= 10000;
      timerEl.classList.toggle('hurry', hurry);
      barEl.classList.toggle('hurry', hurry);
      timerT = setTimeout(tickUI, 120);
    };
    tickUI();

    raf = requestAnimationFrame(step);
  }

  // 검사용 구멍 — **캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 본다**
  function boardState() {
    if (!S) return null;
    return {
      cleared: S.cleared, left: S.left, boards: S.boards, over: S.over,
      lives: S.lives, dying: S.dying, dead: S.dead,
      // 화면에 «남아 있는» 하트 수 — 상태와 그림이 갈리는지 보려면 둘 다 필요하다
      hearts: host ? host.querySelectorAll('.pw-heart:not(.gone)').length : -1,
      oops: !!(host && host.querySelector('.pw-oops.show')),
      flying: S.flying.length, cell: S.cell, ox: S.ox, oy: S.oy, cols: COLS, rows: ROWS,
      // 칸마다 방향(없으면 -1)과 **지금 누르면 나가는가**
      grid: S.grid.map((p, i) => p
        ? { c: i % COLS, r: Math.floor(i / COLS), d: p.d, open: pathClear(i % COLS, Math.floor(i / COLS), p.d) }
        : null).filter(Boolean),
    };
  }

  window.Pinwheel = {
    start, boardState,
    // 검사용 — 손가락 없이 누르거나, 판을 다시 깔거나
    _tap: (c, r) => tap(c, r),
    _newBoard: () => newBoard(),
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    REWARD_PER, REWARD_MAX, DUR_MS, COLS, ROWS, FILL, REFILL_MS,
    LIVES, OOPS_MS, HEART_POP_MS,
  };
})();
