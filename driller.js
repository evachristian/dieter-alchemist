// ═══════════════════════════════════════════════════════════════
//  소풍 바위 — 바위 부수기 (미스터 드릴러 식)
//  소풍 바위 형 맵(「소풍 바위」)을 누르면 채집 대신 이 화면으로 들어온다
//  (`D.fieldMini(id) === 'driller'`).
//
//  **바위를 파고 내려간다.** 아래·왼쪽·오른쪽으로만 팔 수 있고 위로는 못 간다.
//  받치던 것을 파내면 위의 덩어리가 통째로 떨어지고, 떨어져 쌓인 것이 «같은 색 넷»을
//  이루면 사라지며 또 떨어진다 — **연쇄**가 곧 이 게임의 손맛이다.
//  2분 동안 내려간 깊이가 곧 재료다.
//
//  ⚠️ **덩어리 하나가 「파는 단위 · 떨어지는 단위 · 사라지는 단위」를 다 겸한다**
//  (`groupAt`). 셋을 따로 만들면 「파 보니 다른 것이 떨어지는」 그림이 나온다 —
//  한 함수를 셋이 같이 본다 (지대별 AP 에서 배운 것과 같다).
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 (다른 미니게임 여섯과 같은 규칙이다).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS = 120000;     // 2분 — 다른 미니게임과 같은 길이로 맞춘다
  const COLS = 7;            // 갱도의 너비
  const VIEW_ROWS = 11;      // 화면에 보이는 줄 수
  // ⚠️ **큰 화면에서 갱도를 넓히지 않는다** — 칸 크기만 바뀐다.
  // 화면에 맞춰 늘리면 **화면 크기가 곧 보상**이 된다 (호두 게임과 같은 규칙이다)

  const ROW_M = 5;           // 한 줄 = 5m

  // ─── 보상 ───
  // **내려간 깊이가 그대로 재료가 된다.**
  //
  // ⚠️⚠️ **상한을 「시간」이 아니라 「산소」가 지킨다 — 재 보고서야 알았다.**
  // 처음에는 50m 에 하나(상한 900m)로 두고 「곧장 파도 2분의 3분의 2가 든다」고
  // 검사까지 적어 놓았는데, **진짜 게임에 봇을 붙여 보니 14.5 m/s 였다**:
  // 파는 단위가 «덩어리»라 한 번 파면 한 칸이 아니라 1~3칸을 내려가고, 연쇄가 터지면
  // 통째로 낙하한다. 그 식은 게임을 **두 배 가까이 느리게** 잡고 있었다
  // (「가르지 못하는 잣대는 무슨 값을 넣어도 통과한다」의 반대쪽 — 사실이 아닌 잣대다).
  //
  // 그래서 상한을 **1,800m** 로 옮겼다. 아무 생각 없이 아래만 파는 손은 **50초에
  // 산소가 바닥나** 1,000m 남짓에서 멈춘다 — 2분을 다 쓰려면 **에어 캡슐을 주우러
  // 돌아야** 하고, 그것이 곧 이 게임의 실력이다 (미스터 드릴러의 축 그대로다).
  // ⚠️ **봇 속도가 깊이에 따라 흔들린다** — 얕은 데는 단단한 바위가 드물어 빠르고
  // (12초에 29 m/s) 깊어질수록 느려진다(20초에 17~21). 1,440m 로 두었더니 빠른 판이
  // 「산소만으로 상한에 닿는다」로 걸렸다 — 그 흔들림을 견디는 자리가 1,800m 다.
  // ⚠️ 이 수치는 **`checkdriller` 가 진짜 봇으로 다시 잰다** — 시간으로 «계산»한
  // 잣대는 이 게임에서 두 번 다 틀렸다
  const REWARD_PER = 100;    // 이만큼(m) 내려갈 때마다 재료 하나
  const REWARD_MAX = 18;
  // 히든 재료 — 깊이 들어갈수록 오른다 (다른 여섯과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  // ─── 생명 셋 ───
  // 바람개비 밭과 **같은 자리**다 — 깔리면 기회 하나가 줄고, 셋을 다 잃으면 끝나되
  // **그때까지 판 깊이는 그대로 가져간다**(`finish()`). 잃는 것은 재료가 아니라 남은 시간이다.
  // ⚠️ **깎는 문은 `loseLife()` 한 곳이다** (낚시의 `hook()` 에서 배운 자리다)
  const LIVES = 3;
  const OOPS_MS = 1100;      // 공주가 「아이쿠」 하는 동안. ⚠️ 바람개비(1500)보다 «짧다» —
                             // 여기는 손이 계속 움직이는 게임이라 길면 판을 가린다
  const INVUL_MS = 1300;     // 깔린 뒤 다시 안 깔리는 동안 (없으면 한 번에 셋을 다 잃는다)

  // ─── 산소 ───
  // **미스터 드릴러의 심장이다** — 가만히 서서 생각할 수 없게 만드는 것.
  // ⚠️ **시계와 «따로» 둔다.** 시계는 다른 미니게임 여섯과 맞춘 바깥 울타리이고,
  // 산소는 「멈추지 말고 내려가라」고 미는 힘이다. 둘을 하나로 묶으면 판 길이가
  // 사람마다 달라져 **분당 밸런스를 잴 수가 없다**
  const AIR_MAX = 100;
  const AIR_SEC = 50;        // 캡슐을 하나도 안 주우면 이만큼(초)에 바닥난다
  const AIR_DRAIN = AIR_MAX / (AIR_SEC * 1000);
  const AIR_GAIN = 20;       // 에어 캡슐 하나
  const AIR_X_COST = 20;     // 단단한 바위를 부수면 드는 산소
  const AIR_LOW = 25;        // 이 아래면 붉게 뛴다

  // ─── 바위 ───
  const COLORS = 4;          // 색 넷 (⚠️ 색«만»으로 안 가른다 — 점의 개수가 같이 붙는다)
  const MERGE = 4;           // 같은 색이 이만큼 붙으면 사라진다
  const DIG_MS = 340;        // 색 바위 한 칸을 파는 데 드는 시간
  const X_HITS = 5;          // 단단한 바위는 이만큼 파야 부서진다
  const FALL_MS = 100;       // 한 칸 떨어지는 데 드는 시간 (바위도 사람도)
  const FILL = 0.86;         // 줄이 이만큼 차 있다 (빈 칸이 있어야 길이 보인다)
  const CAP_RATE = 0.18;     // 줄마다 에어 캡슐이 놓일 확률
  const X_RATE0 = 0.04, X_RATE1 = 0.14;   // 깊어질수록 단단한 바위가 는다
  const X_DEEP = 160;        // 이 줄쯤에서 X_RATE1 에 닿는다

  // ─── 연출 ───
  const BURST_MS = 520, BURST_PER = 5;    // 사라진 바위가 흩어지는 조각
  const FLASH_MS = 260;                    // 사라진 자리에 이는 돌먼지
  const SHAKE_MS = 180, SHAKE_PX = 3;
  const GRAV = 0.0016;
  const HEART_POP_MS = 620;                // CSS `drHeartPop` 과 같은 값

  const PAD = 6;
  const HUD_H = 46, AIR_H = 18, HINT_H = 40;

  // ─── 빛깔 ───
  // 소풍 바위는 **평야의 볕 좋은 자리**라 흔들 바위산의 잿빛과 일부러 다르게 둔다
  // (같은 그림 둘이 서면 어디가 어딘지 헷갈린다 — 바람개비 밭에서 배운 것과 같다).
  // ⚠️ **색«만»으로 가르지 않는다** — 칸마다 점이 **색 번호만큼** 찍힌다.
  // 색을 못 보는 사람도 「같은 것 넷」을 셀 수 있어야 퍼즐이 된다
  // ⚠️ **찍어 보고 한 번 가라앉혔다** — 처음 값은 밝아서 바위가 아니라 «사탕»으로
  // 보였다 (돌깨기의 「바위산에 사탕이 쌓인다」와 같은 자리다). 점이 이미 색을
  // 대신 말해 주므로 채도를 낮춰도 넷이 안 헷갈린다
  const ROCK = [
    { f: '#c9737a', hi: '#dd979d', lo: '#9c5159', pip: 1 },   // 장미석
    { f: '#6a9cbd', hi: '#93b9d2', lo: '#4a7392', pip: 2 },   // 하늘돌
    { f: '#7aa96d', hi: '#9fc494', lo: '#57814c', pip: 3 },   // 이끼암
    { f: '#c9a163', hi: '#dfbe8b', lo: '#9a7841', pip: 4 },   // 황토암
  ];
  const HARD = { f: '#6b6257', hi: '#8b8073', lo: '#4a433a' }; // 단단한 바위
  const CAP_COL = { f: '#7fe3e8', hi: '#c4f5f7', lo: '#3f9ea3' };
  const SKY_TOP = '#bfe6f5', SKY_BOT = '#e8f4d8';
  const SOIL_TOP = '#8a6b4d', SOIL_BOT = '#2e2218';
  const INK = '#2f2416';

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0, oopsT = 0, deadT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  // 같은 자리는 **언제 봐도 같은 얼룩**이어야 한다 — 매 프레임 새로 뽑으면 바위가
  // 지글거린다 (돌깨기의 「얼룩은 씨앗이 정한다」와 같은 규칙이다)
  const frac = v => v - Math.floor(v);
  const rnd = (seed, i) => frac(Math.sin(seed * 127.1 + i * 311.7) * 43758.5453);

  // ─── 상태 ────────────────────────────────────────────────────
  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, over: false,
      rows: [],                  // rows[r][c] — null 이거나 {k,…}. r 은 «절대» 줄 번호다
      pr: 0, pc: Math.floor(COLS / 2),   // 사람이 선 칸
      deep: 0,                   // 여태 닿은 제일 깊은 줄
      dig: null,                 // 지금 파는 중 {r, c, dir, t0}
      aim: null,                 // 손가락이 가리키는 쪽 ('down'|'left'|'right')
      fallAt: 0,                 // 다음 낙하 틱
      air: AIR_MAX,
      lives: LIVES, lostAt: 0, invulUntil: 0, dying: false, dead: false, drowned: false,
      bits: [], flashes: [], shakeAt: 0,
      falls: 0, merges: 0, digs: 0,      // 검사·연출용
      w: 0, h: 0, cell: 0, ox: 0, oy: 0,
      pool, specialId, picked: [], gotSpecial: false,
    };
  }

  // ─── 갱도 만들기 ─────────────────────────────────────────────
  // **줄은 필요할 때 만든다** — 180줄을 미리 만들면 첫 프레임이 늦고, 얼마나 내려갈지는
  // 사람마다 다르다. ⚠️ **처음부터 «같은 색 넷»이 붙어 있으면 안 된다** — 판을 열자마자
  // 저절로 사라져 사람이 한 것이 아닌 구멍이 생긴다. 색을 고를 때 그것을 피한다
  function ensureRows(upto) {
    while (S.rows.length <= upto) {
      const r = S.rows.length;
      const row = new Array(COLS).fill(null);
      const xRate = X_RATE0 + (X_RATE1 - X_RATE0) * Math.min(1, r / X_DEEP);
      for (let c = 0; c < COLS; c++) {
        if (Math.random() > FILL) continue;                   // 빈 칸
        if (Math.random() < xRate) { row[c] = { k: 'x', hp: X_HITS, s: Math.random() * 99 }; continue; }
        row[c] = { k: 'r', col: pickColor(r, c, row), s: Math.random() * 99 };
      }
      // 에어 캡슐 — 줄마다 많아야 하나. ⚠️ **빈 칸에만 놓는다**(바위를 지우지 않는다)
      if (Math.random() < CAP_RATE) {
        const empty = [];
        for (let c = 0; c < COLS; c++) if (!row[c]) empty.push(c);
        if (empty.length) row[empty[Math.floor(Math.random() * empty.length)]] = { k: 'air', s: Math.random() * 99 };
      }
      S.rows.push(row);
    }
  }
  // 「이 색을 놓으면 넷이 되는가」를 보고 고른다 — 안 되는 색만 후보로 남긴다
  function pickColor(r, c, row) {
    const cand = [];
    for (let col = 0; col < COLORS; col++) {
      row[c] = { k: 'r', col };
      const n = groupSize(r, c, row);
      row[c] = null;
      if (n < MERGE) cand.push(col);
    }
    const pick = cand.length ? cand : [0, 1, 2, 3];
    return pick[Math.floor(Math.random() * pick.length)];
  }
  // 아직 `S.rows` 에 안 들어간 줄(`row`)까지 같이 보고 덩어리 크기를 센다
  function groupSize(r, c, pending) {
    const get = (rr, cc) => (rr === r && pending ? pending[cc] : cellAt(rr, cc));
    const start = get(r, c);
    if (!start || start.k !== 'r') return 0;
    const seen = new Set([r + ',' + c]);
    const q = [[r, c]];
    while (q.length) {
      const [y, x] = q.pop();
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx;
        if (nx < 0 || nx >= COLS || ny < 0) continue;
        const key = ny + ',' + nx;
        if (seen.has(key)) continue;
        const cell = get(ny, nx);
        if (!cell || cell.k !== 'r' || cell.col !== start.col) continue;
        seen.add(key); q.push([ny, nx]);
      }
    }
    return seen.size;
  }

  const cellAt = (r, c) => (r < 0 || c < 0 || c >= COLS || r >= S.rows.length ? null : S.rows[r][c]);
  const setCell = (r, c, v) => { if (r >= 0 && r < S.rows.length && c >= 0 && c < COLS) S.rows[r][c] = v; };

  // ⚠️⚠️ **한 덩어리가 「파는 단위 · 떨어지는 단위 · 사라지는 단위」를 다 겸한다.**
  // 색 바위는 «같은 색으로 붙은 것» 전부가 한 덩어리이고, 단단한 바위와 에어 캡슐은
  // 저마다 한 칸짜리 덩어리다. 셋을 따로 셈하면 「판 것과 떨어지는 것이 다른」 그림이 된다
  function groupAt(r, c) {
    const start = cellAt(r, c);
    if (!start) return [];
    if (start.k !== 'r') return [[r, c]];
    const seen = new Set([r + ',' + c]);
    const out = [[r, c]], q = [[r, c]];
    while (q.length) {
      const [y, x] = q.pop();
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx;
        const key = ny + ',' + nx;
        if (seen.has(key)) continue;
        const cell = cellAt(ny, nx);
        if (!cell || cell.k !== 'r' || cell.col !== start.col) continue;
        seen.add(key); out.push([ny, nx]); q.push([ny, nx]);
      }
    }
    return out;
  }

  // 지금 화면이 닿는 범위의 덩어리를 모두 모은다 (아래는 넉넉히 만들어 둔다)
  function allGroups(lo, hi) {
    const seen = new Set(), out = [];
    for (let r = lo; r <= hi; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!cellAt(r, c) || seen.has(r + ',' + c)) continue;
        const g = groupAt(r, c);
        g.forEach(([y, x]) => seen.add(y + ',' + x));
        out.push(g);
      }
    }
    return out;
  }

  // ─── 같은 색 넷이 붙으면 사라진다 ────────────────────────────
  // 돌아온 값은 「몇 덩어리가 사라졌는가」다 (연쇄를 세는 자리)
  function clearMerges(lo, hi) {
    const gone = allGroups(lo, hi).filter(g => g.length >= MERGE && cellAt(g[0][0], g[0][1]).k === 'r');
    gone.forEach(g => g.forEach(([r, c]) => { burst(r, c); setCell(r, c, null); }));
    if (gone.length) { S.merges += gone.length; S.shakeAt = S.now; if (window.Sfx) Sfx.play('pick'); }
    return gone.length;
  }

  // ─── 낙하 한 틱 ──────────────────────────────────────────────
  // 받칠 것이 없는 덩어리를 **한 줄씩** 내린다. 한 번에 다 떨어뜨리면 「무너지는 것」이
  // 안 보이고, 사람이 피할 틈도 없다
  function fallTick(lo, hi) {
    let moved = 0;
    const groups = allGroups(lo, hi).sort((a, b) => Math.max(...b.map(p => p[0])) - Math.max(...a.map(p => p[0])));
    for (const g of groups) {
      const own = new Set(g.map(([r, c]) => r + ',' + c));
      const canFall = g.every(([r, c]) => {
        const below = cellAt(r + 1, c);
        return !below || own.has((r + 1) + ',' + c);
      }) && g.every(([r]) => r + 1 < S.rows.length);
      if (!canFall) continue;
      g.sort((a, b) => b[0] - a[0]).forEach(([r, c]) => { setCell(r + 1, c, cellAt(r, c)); setCell(r, c, null); });
      moved++;
      // **사람 위로 떨어지면 깔린다** — 덩어리가 옮겨 간 자리에 사람이 서 있는가
      if (g.some(([r, c]) => r + 1 === S.pr && c === S.pc)) crush();
    }
    if (moved) S.falls += moved;
    return moved;
  }

  // ─── 깔렸다 ──────────────────────────────────────────────────
  function crush() {
    if (!S || S.over || S.dying) return;
    // 깔린 자리의 바위를 치워 준다 — 안 치우면 다시 서는 순간 또 깔린다.
    //
    // ⚠️⚠️ **무적인 동안에도 «치우기»는 한다 (기회만 안 깎는다).** 무적이라고 그냥
    // 돌아서면 그 바위가 사람 칸에 **눌러앉아** 사람이 바위 속에 박히고, 그 뒤로는
    // 위에서 무엇이 떨어져도 «사람 칸에 들어오는» 일이 없어 **영영 안 깔린다** —
    // 기회가 셋인데 한 번 깔리고 나면 둘은 영영 안 줄어드는 상태가 된다
    // (`checkdriller` 가 「두 번째 판에서 안 깎인다」로 잡았다. 화면에는 오류가 없다)
    const g = groupAt(S.pr, S.pc);
    g.forEach(([r, c]) => { burst(r, c); setCell(r, c, null); });
    if (S.now < S.invulUntil) return;
    S.invulUntil = S.now + INVUL_MS;
    S.shakeAt = S.now;
    loseLife();
  }

  // 생명 하나 — 하트가 터지고 공주가 한마디 한다.
  // ⚠️ **하트도 「아이쿠」도 캔버스가 아니라 DOM 이다** (캔버스 안은 `checkUI()` 가 못 본다)
  function loseLife() {
    if (!S || S.over || S.dying) return;
    S.lives = Math.max(0, S.lives - 1);
    S.lostAt = S.now;
    paintHearts();
    showOops();
    if (window.Sfx) Sfx.play('fail');
    if (S.lives > 0) return;
    // **마지막 하나** — 「아이쿠」를 읽을 틈을 주고 끝낸다 (바람개비 밭과 같은 자리다).
    // 그 사이에는 파는 것도 떨어지는 것도 멈춘다(`dying`)
    S.dying = true; S.dead = true; S.dig = null; S.aim = null;
    deadT = setTimeout(() => { if (S) finish(); }, OOPS_MS);
  }
  function paintHearts() {
    if (!host || !S) return;
    host.querySelectorAll('.dr-heart').forEach((h, i) => h.classList.toggle('gone', i >= S.lives));
    const box = host.querySelector('.dr-lives');
    if (box) box.setAttribute('aria-label', T('dr_lives_n', { n: S.lives }));
  }
  function showOops() {
    if (!host || !S) return;
    const box = host.querySelector('.dr-oops');
    if (!box) return;
    box.classList.remove('show');
    void box.offsetWidth;                       // 애니메이션을 처음부터 다시 돌린다
    box.classList.add('show');
    clearTimeout(oopsT);
    oopsT = setTimeout(() => { if (host) box.classList.remove('show'); }, OOPS_MS);
  }
  // 놀란 공주의 얼굴 — `Portrait.bust()` 가 내주는 SVG 문자열이다.
  // ⚠️ **못 그려도 게임은 그대로 돌아야 한다** (미니게임이 안 뜨는 것보다 훨씬 낫다)
  function oopsFace() {
    try {
      const sp = window.GameData && GameData.speaker('sp_gwiriel');
      if (!sp || !window.Portrait) return '';
      return Portrait.bust(sp, 'shock', { bare: true }) || '';
    } catch (e) { return ''; }
  }

  // ─── 파기 ────────────────────────────────────────────────────
  // ⚠️ **위로는 못 판다.** 한 번 내려가면 되돌아갈 수 없는 것이 이 게임의 전부다 —
  // 그래서 「여기를 파도 되나」가 매번 판단이 된다
  const DIRS = { down: [1, 0], left: [0, -1], right: [0, 1] };

  // 지금 가리키는 쪽을 파거나(또는 빈 칸이면 걸어 들어간다). 한 프레임 몫이다
  function digStep(dt) {
    if (!S || S.over || S.dying) return;
    if (!S.aim) { S.dig = null; return; }
    const [dr, dc] = DIRS[S.aim];
    const r = S.pr + dr, c = S.pc + dc;
    if (c < 0 || c >= COLS) { S.dig = null; return; }
    ensureRows(r + VIEW_ROWS);
    const cell = cellAt(r, c);
    if (!cell) { S.dig = null; moveTo(r, c); return; }        // 빈 칸이면 그냥 간다
    if (cell.k === 'air') { S.dig = null; takeAir(r, c); moveTo(r, c); return; }
    // 파는 중 — 대상이 바뀌면 처음부터 다시
    if (!S.dig || S.dig.r !== r || S.dig.c !== c) S.dig = { r, c, dir: S.aim, t: 0 };
    S.dig.t += dt;
    if (S.dig.t < DIG_MS) return;
    S.dig = null;
    S.digs++;
    if (window.Sfx) Sfx.play('tap');
    if (cell.k === 'x') {
      // **단단한 바위** — 다섯 번 파야 부서지고, 부서질 때 산소를 먹는다.
      // 「뚫을까, 돌아갈까」가 이 한 줄에서 나온다
      cell.hp--;
      if (cell.hp > 0) return;
      S.air = Math.max(0, S.air - AIR_X_COST);
      burst(r, c); setCell(r, c, null);
    } else {
      // **색 바위는 덩어리째 부서진다** — 파는 단위가 곧 떨어지는 단위다
      groupAt(r, c).forEach(([y, x]) => { burst(y, x); setCell(y, x, null); });
    }
    settleRange();
    moveTo(r, c);
  }
  function takeAir(r, c) {
    S.air = Math.min(AIR_MAX, S.air + AIR_GAIN);
    setCell(r, c, null);
    if (window.Sfx) Sfx.play('sparkle');
  }
  function moveTo(r, c) {
    if (cellAt(r, c)) return;                                 // 아직 막혀 있으면 안 간다
    S.pr = r; S.pc = c;
    if (r > S.deep) S.deep = r;
    ensureRows(S.pr + VIEW_ROWS * 2);
  }
  // 파낸 뒤의 정리 — 사라질 것을 사라뜨린다. **떨어지는 것은 틱이 맡는다**(연출이 보이게)
  function settleRange() {
    const lo = Math.max(0, S.pr - VIEW_ROWS), hi = S.pr + VIEW_ROWS;
    clearMerges(lo, hi);
  }

  function burst(r, c) {
    const cell = cellAt(r, c);
    if (!cell) return;
    const col = cell.k === 'r' ? ROCK[cell.col] : (cell.k === 'air' ? CAP_COL : HARD);
    for (let i = 0; i < BURST_PER; i++) {
      S.bits.push({ r, c, born: S.now,
        vx: (Math.random() - 0.5) * 0.19, vy: -Math.random() * 0.14 - 0.02,
        ox: Math.random(), oy: Math.random(), f: col.f });
    }
    S.flashes.push({ r, c, born: S.now });
  }

  // ─── 한 프레임 ───────────────────────────────────────────────
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.last = ts; S.fallAt = ts; }
    const dt = Math.min(64, ts - S.last);
    S.last = ts; S.now = ts;
    const elapsed = ts - S.t0;

    if (!S.dying) {
      // **산소는 늘 줄어든다** — 이것이 「멈추지 말고 내려가라」의 전부다
      S.air = Math.max(0, S.air - AIR_DRAIN * dt);
      digStep(dt);
      // 낙하 — 바위도 사람도 같은 박자로 떨어진다
      while (ts >= S.fallAt) {
        S.fallAt += FALL_MS;
        const lo = Math.max(0, S.pr - VIEW_ROWS), hi = S.pr + VIEW_ROWS;
        ensureRows(hi + 2);
        fallTick(lo, hi);
        // ⚠️ **떨어진 뒤에만 보면 안 된다.** 「낙하가 있었을 때만」 셈하게 두었더니
        // 아무것도 안 움직인 틱에서는 **넷이 붙어 있어도 안 사라졌다** — 규칙이
        // 「같은 색 넷」이 아니라 「같은 색 넷 + 방금 뭔가 떨어졌을 때」가 된다.
        // 창이 스물세 줄뿐이라 매 틱 보는 값이 싸다 (검사가 잡았다)
        clearMerges(lo, hi);
        // 발밑이 비었으면 사람도 떨어진다
        if (!cellAt(S.pr + 1, S.pc)) { S.pr++; if (S.pr > S.deep) S.deep = S.pr; ensureRows(S.pr + VIEW_ROWS * 2); }
      }
    }
    S.bits = S.bits.filter(b => ts - b.born < BURST_MS);
    S.flashes = S.flashes.filter(f => ts - f.born < FLASH_MS);

    draw(elapsed);

    // **끝나는 길이 셋이다** — 시계 · 산소 · 생명.
    // ⚠️ 어느 쪽이든 **판 만큼은 그대로 가져간다** (`finish()`)
    if (!S.dying && S.air <= 0) { S.drowned = true; finish(); return; }
    if (elapsed >= DUR_MS) { finish(); return; }
    raf = requestAnimationFrame(step);
  }

  // ─── 캔버스 크기 맞추기 (DPR 반영) ───
  function fit() {
    if (!cv || !S) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
    cv.width = Math.round(S.w * dpr); cv.height = Math.round(S.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // HUD·산소 막대·안내 줄 자리를 **미리 떼어 놓는다** (돌깨기에서 배운 것과 같다)
    const room = S.h - HUD_H - AIR_H - HINT_H - PAD * 2;
    S.cell = Math.max(22, Math.min((S.w - PAD * 2) / COLS, room / VIEW_ROWS));
    S.ox = (S.w - S.cell * COLS) / 2;
    S.oy = HUD_H + AIR_H + PAD;
  }

  // ─── 그리기 ──────────────────────────────────────────────────
  function draw(elapsed) {
    if (!ctx || !S) return;
    const s = S.cell;
    // 카메라 — 사람을 화면의 40% 자리에 둔다
    const top = S.pr - Math.floor(VIEW_ROWS * 0.4);
    let sx = 0, sy = 0;
    const sk = S.now - S.shakeAt;
    if (S.shakeAt && sk < SHAKE_MS) {
      const k = (1 - sk / SHAKE_MS) * SHAKE_PX;
      sx = (Math.random() - 0.5) * 2 * k; sy = (Math.random() - 0.5) * 2 * k;
    }
    // 하늘 → 땅속. 깊어질수록 어두워진다
    const deepK = Math.min(1, S.pr / 120);
    const g = ctx.createLinearGradient(0, 0, 0, S.h);
    g.addColorStop(0, top <= 0 ? SKY_TOP : mix(SOIL_TOP, SOIL_BOT, deepK * 0.6));
    g.addColorStop(1, mix(SOIL_TOP, SOIL_BOT, Math.min(1, deepK * 0.6 + 0.4)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.w, S.h);
    // 지표면 — 풀밭과 소풍 바구니 (첫 몇 줄에서만 보인다)
    if (top <= 1) {
      const y0 = S.oy + (0 - top) * s + sy;
      ctx.fillStyle = SKY_BOT; ctx.fillRect(0, 0, S.w, y0);
      ctx.fillStyle = '#7bbd6a'; ctx.fillRect(0, y0 - 7, S.w, 9);
      ctx.font = `${Math.round(s * 0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('🧺', S.ox + s * 0.9, y0 - 9);
    }

    ctx.save(); ctx.translate(sx, sy);
    for (let i = -1; i <= VIEW_ROWS + 1; i++) {
      const r = top + i;
      if (r < 0) continue;
      for (let c = 0; c < COLS; c++) {
        const cell = cellAt(r, c);
        if (!cell) continue;
        drawCell(cell, S.ox + c * s, S.oy + (r - top) * s, s);
      }
    }
    // 먼지 → 조각 → 사람 순서 (사람이 제일 위에 보여야 한다)
    S.flashes.forEach(f => {
      const k = (S.now - f.born) / FLASH_MS;
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(S.ox + f.c * s - s * 0.1, S.oy + (f.r - top) * s - s * 0.1, s * 1.2, s * 1.2);
      ctx.globalAlpha = 1;
    });
    S.bits.forEach(b => {
      const t = S.now - b.born, k = t / BURST_MS;
      const x = S.ox + (b.c + b.ox) * s + b.vx * t;
      const y = S.oy + (b.r - top + b.oy) * s + b.vy * t + GRAV * t * t / 2;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = b.f;
      ctx.fillRect(x, y, s * 0.17, s * 0.17);
      ctx.globalAlpha = 1;
    });
    drawDigger(S.ox + S.pc * s, S.oy + (S.pr - top) * s, s);
    ctx.restore();

    // HUD 숫자 — DOM 쪽
    const dep = host && host.querySelector('.dr-n');
    if (dep) dep.textContent = String(S.deep * ROW_M);
    const air = host && host.querySelector('.dr-airfill');
    if (air) {
      air.style.width = (S.air / AIR_MAX * 100).toFixed(1) + '%';
      const bar = host.querySelector('.dr-air');
      if (bar) bar.classList.toggle('low', S.air <= AIR_LOW);
    }
  }
  function mix(a, b, k) {
    const h = x => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
    const A = h(a), B = h(b);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
  }
  function drawCell(cell, x, y, s) {
    const pad = s * 0.045, w = s - pad * 2;
    if (cell.k === 'air') {
      ctx.fillStyle = CAP_COL.lo;
      round(x + pad, y + pad, w, w, s * 0.45); ctx.fill();
      ctx.fillStyle = CAP_COL.f;
      round(x + pad + 1.5, y + pad + 1.5, w - 3, w - 3, s * 0.42); ctx.fill();
      ctx.fillStyle = CAP_COL.hi;
      ctx.beginPath(); ctx.ellipse(x + s * 0.38, y + s * 0.36, s * 0.1, s * 0.07, -0.5, 0, 6.3); ctx.fill();
      return;
    }
    const col = cell.k === 'x' ? HARD : ROCK[cell.col];
    ctx.fillStyle = col.lo; round(x + pad, y + pad, w, w, s * 0.2); ctx.fill();
    ctx.fillStyle = col.f;  round(x + pad, y + pad, w, w - s * 0.07, s * 0.2); ctx.fill();
    ctx.fillStyle = col.hi;
    ctx.globalAlpha = 0.5;
    round(x + pad + w * 0.12, y + pad + w * 0.1, w * 0.76, w * 0.22, s * 0.1); ctx.fill();
    ctx.globalAlpha = 1;
    if (cell.k === 'x') {
      // **남은 횟수를 금으로 보여 준다** — 「몇 번 더 파야 하나」가 안 보이면 그냥 벽이다
      ctx.strokeStyle = 'rgba(30,24,16,0.55)'; ctx.lineWidth = Math.max(1.4, s * 0.06);
      ctx.lineCap = 'round';
      const n = X_HITS - cell.hp;
      for (let i = 0; i < X_HITS; i++) {
        if (i < n) continue;
        const a = 0.6 + i * 1.1;
        ctx.beginPath();
        ctx.moveTo(x + s / 2 + Math.cos(a) * s * 0.1, y + s / 2 + Math.sin(a) * s * 0.1);
        ctx.lineTo(x + s / 2 + Math.cos(a) * s * 0.3, y + s / 2 + Math.sin(a) * s * 0.3);
        ctx.stroke();
      }
      return;
    }
    // ⚠️ **점의 개수가 곧 색 번호다** — 색을 못 보는 사람도 「같은 것 넷」을 셀 수 있어야 한다
    ctx.fillStyle = 'rgba(40,28,16,0.5)';
    const n = ROCK[cell.col].pip, R = s * 0.055;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / Math.max(1, n));
      const cx = x + s / 2 + (n === 1 ? 0 : Math.cos(a) * s * 0.17);
      const cy = y + s * 0.56 + (n === 1 ? 0 : Math.sin(a) * s * 0.17);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill();
    }
  }
  function round(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 파는 사람 — 깔린 직후에는 깜빡인다 (무적인 동안이 보여야 한다)
  function drawDigger(x, y, s) {
    const blink = S.now < S.invulUntil && Math.floor(S.now / 110) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fillStyle = '#fff6e6';
    round(x + s * 0.16, y + s * 0.14, s * 0.68, s * 0.72, s * 0.24); ctx.fill();
    ctx.fillStyle = '#ffdcc4';
    ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.42, s * 0.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#7b5640';                       // 머리
    ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.36, s * 0.21, Math.PI, 0); ctx.fill();
    ctx.fillStyle = INK;                             // 눈
    ctx.beginPath(); ctx.arc(x + s * 0.44, y + s * 0.44, s * 0.033, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.57, y + s * 0.44, s * 0.033, 0, 6.3); ctx.fill();
    // 드릴 — 파는 쪽으로 뻗는다
    const dir = (S.dig && S.dig.dir) || S.aim || 'down';
    const [dr, dc] = DIRS[dir];
    const bx = x + s / 2 + dc * s * 0.34, by = y + s * 0.6 + dr * s * 0.3;
    const wob = S.dig ? Math.sin(S.now / 26) * s * 0.05 : 0;
    ctx.fillStyle = '#c9ccd2';
    ctx.beginPath();
    ctx.moveTo(bx + dc * s * 0.22 + (dr ? wob : 0), by + dr * s * 0.22 + (dc ? wob : 0));
    ctx.lineTo(bx - dr * s * 0.13, by - dc * s * 0.13);
    ctx.lineTo(bx + dr * s * 0.13, by + dc * s * 0.13);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ─── 끝내기 ──────────────────────────────────────────────────
  function finish() {
    if (!S || S.over) return;
    S.over = true; S.dying = false;
    cancelAnimationFrame(raf);
    clearTimeout(timerT); clearTimeout(deadT); clearTimeout(oopsT);
    // ⚠️ **어떻게 끝났든 판 만큼은 그대로 가져간다** — 잃는 것은 재료가 아니라 남은 시간이다
    // (돌깨기의 `rk_buried` · 바람개비 밭의 생명과 같은 자리다)
    const n = Math.min(REWARD_MAX, Math.floor(S.deep * ROW_M / REWARD_PER));
    for (let i = 0; i < n; i++) S.picked.push(pickItem());
    if (S.specialId) {
      const prog = Math.min(1, n / REWARD_MAX);
      if (Math.random() < SP_BASE + SP_TOP * prog) { S.picked.push(S.specialId); S.gotSpecial = true; }
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
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '⛏️', name: id };
      return `<span class="dr-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const m = S.deep * ROW_M;
    const box = host.querySelector('.dr-result');
    box.innerHTML = `
      <div class="dr-res-title">${S.dead ? T('dr_dead', { n: m })
        : S.drowned ? T('dr_airout', { n: m })
        : (m ? T('dr_done', { n: m }) : T('dr_none'))}</div>
      <div class="dr-res-items">${rows || `<span class="dr-item">${T('dr_none')}</span>`}</div>
      <button class="btn dr-close">${T('dr_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.dr-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const deep = S ? S.deep * ROW_M : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared: false, score: deep }); }
  }
  function teardown() {
    cancelAnimationFrame(raf);
    clearTimeout(timerT); clearTimeout(deadT); clearTimeout(oopsT);
    window.removeEventListener('resize', fit);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; cv = null; ctx = null; S = null;
  }

  // ─── 시작 ────────────────────────────────────────────────────
  function start(map, onEnd) {
    if (S) return;                               // 이미 돌고 있으면 무시
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['berry'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'drillerGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('dr_title');
    host.innerHTML = `
      <div class="dr-stage">
        <canvas class="dr-canvas"></canvas>
        <div class="dr-hud">
          <span class="dr-name">${title}</span>
          <span class="dr-lives" role="img" aria-label="${T('dr_lives_n', { n: LIVES })}"
            >${new Array(LIVES).fill('<i class="dr-heart">♥</i>').join('')}</span>
          <span class="dr-depth"><b class="dr-n">0</b>m</span>
          <span class="dr-timer">2:00</span>
        </div>
        <div class="dr-air"><i class="dr-airfill"></i><b>🫧</b></div>
        <div class="dr-hint"><span>${T('dr_hint')}</span></div>
        <div class="dr-oops">
          <div class="dr-oops-face">${oopsFace()}</div>
          <div class="dr-oops-say">${T('dr_oops')}</div>
        </div>
        <div class="dr-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.dr-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    ensureRows(VIEW_ROWS * 3);
    S.rows[0][S.pc] = null;                      // 사람이 설 자리 하나를 비운다
    window.addEventListener('resize', fit);

    // ─── 손가락 ───────────────────────────────────────────────
    // **누른 쪽으로 판다** — 사람을 기준으로 아래·왼쪽·오른쪽. 누르고 있으면 계속 판다.
    // ⚠️ 화면에 방향 버튼을 깔지 않는다 (판이 작아지고 엄지로 가릴 자리도 는다 —
    // 돌깨기에서 정한 것과 같은 규칙이다)
    const aimAt = e => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const top = S.pr - Math.floor(VIEW_ROWS * 0.4);
      const px = S.ox + (S.pc + 0.5) * S.cell, py = S.oy + (S.pr - top + 0.5) * S.cell;
      const dx = x - px, dy = y - py;
      // 세로로 더 멀면 아래, 아니면 좌우. **위로는 못 판다** — 위를 눌러도 아무 일이 없다
      if (dy > Math.abs(dx)) return 'down';
      if (dy < -Math.abs(dx)) return null;
      return dx < 0 ? 'left' : 'right';
    };
    const set = e => { if (!S || S.over || S.dying) return; S.aim = aimAt(e); e.preventDefault(); };
    cv.addEventListener('pointerdown', set);
    cv.addEventListener('pointermove', e => { if (S && S.aim) set(e); });
    const clear = () => { if (S) { S.aim = null; S.dig = null; } };
    cv.addEventListener('pointerup', clear);
    cv.addEventListener('pointercancel', clear);
    cv.addEventListener('pointerleave', clear);
    cv.style.touchAction = 'none';

    // 남은 시간 — 숫자 (산소 막대와 자리가 겹치지 않게 숫자만 둔다)
    const timerEl = host.querySelector('.dr-timer');
    const tickUI = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      timerEl.classList.toggle('hurry', left <= 10000);
      timerT = setTimeout(tickUI, 120);
    };
    tickUI();

    raf = requestAnimationFrame(step);
  }

  // 검사용 구멍 — **캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 본다**
  function boardState() {
    if (!S) return null;
    const lo = Math.max(0, S.pr - VIEW_ROWS), hi = S.pr + VIEW_ROWS;
    return {
      deep: S.deep, m: S.deep * ROW_M, over: S.over, drowned: S.drowned,
      lives: S.lives, dying: S.dying, dead: S.dead, air: S.air,
      hearts: host ? host.querySelectorAll('.dr-heart:not(.gone)').length : -1,
      oops: !!(host && host.querySelector('.dr-oops.show')),
      pr: S.pr, pc: S.pc, cols: COLS, cell: S.cell, ox: S.ox, oy: S.oy,
      viewRows: VIEW_ROWS, digs: S.digs, falls: S.falls, merges: S.merges,
      bits: S.bits.length,
      // 눈에 보이는 범위의 칸 (검사가 「무엇이 어디 있는지」를 알아야 누를 수 있다)
      cells: (() => {
        const out = [];
        for (let r = lo; r <= hi; r++) for (let c = 0; c < COLS; c++) {
          const cell = cellAt(r, c);
          if (cell) out.push({ r, c, k: cell.k, col: cell.col, hp: cell.hp });
        }
        return out;
      })(),
    };
  }

  window.Driller = {
    start, boardState,
    // 검사용 — 손가락 없이 파거나, 상태를 들여다보거나
    _aim: d => { if (S) S.aim = d; },
    _dig: d => { if (!S) return; S.aim = d; digStep(DIG_MS + 1); S.aim = null; },
    _groupAt: (r, c) => (S ? groupAt(r, c) : []),
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    REWARD_PER, REWARD_MAX, DUR_MS, COLS, VIEW_ROWS, ROW_M, MERGE, COLORS,
    LIVES, OOPS_MS, HEART_POP_MS, DIG_MS, FALL_MS, X_HITS,
    AIR_MAX, AIR_SEC, AIR_GAIN, AIR_X_COST,
  };
})();
