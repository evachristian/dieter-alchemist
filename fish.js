// ═══════════════════════════════════════════════════════════════
//  낚시터 — 낚시 (거울 저수지)
//  낚시터 형 맵을 누르면 채집 대신 이 화면으로 들어온다 (`D.fieldMini(id) === 'fish'`).
//
//  한 번의 낚시는 네 걸음이다: **기다림 → 입질 → 씨름 → 건져 올림.**
//  씨름은 스타듀 밸리의 그것을 옮겨 온 것이다 — 세로 줄 안에서 «그물»이 중력에 눌려
//  내려오고, 화면을 누르고 있으면 올라간다. 그물 «안»에 물고기를 붙들고 있으면
//  줄 옆의 눈금이 차고, 놓치면 빠진다. 다 차면 건진다.
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다 (`pumpkin.js`·`walnut.js`·`rock.js` 와 같은 규칙).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS = 120000;     // 2분 — 다른 미니게임과 같은 길이로 맞춘다

  // ─── 한 번의 낚시 ───
  const BITE_MIN = 1200, BITE_MAX = 2800;   // 입질까지 기다리는 시간
  const BITE_WIN = 1600;     // 챌 수 있는 시간
  const CATCH_MS = 4000;     // 그물 «안»에 계속 붙들고 있으면 눈금이 다 차는 시간
  // ⚠️ **빠지는 쪽이 차는 쪽보다 느리다.** 같게 두면 한 번 놓칠 때마다 그만큼 되돌아가서
  // 2분이 «본전 찾기»가 된다 — 코지 게임에서 그건 벌이다
  const DRAIN_MS = 6400;
  const LAND_MS  = 700;      // 건져 올리는 연출
  const START_G  = 0.40;     // 씨름을 시작할 때 차 있는 눈금 (시작하자마자 놓치지 않게)

  // ─── 보상 ───
  // **건진 수가 그대로 재료가 된다.** ⚠️ **다른 미니게임과 같은 자리에 둔다** —
  //   호박 밭 17개 · 바위산 18개 · 호두밭 20개 · 낚시터 **18개**
  // 한 번에 `REWARD_PER` 개이고, 한 바퀴가 최소 `BITE_MIN + CATCH_MS + LAND_MS` 라
  // 2분에 스무 번이 한계다 — 상한 18개는 **아홉 번을 쉬지 않고 건져야** 닿는다.
  // `checkbalance` 가 넷을 견준다
  const REWARD_PER = 2;
  const REWARD_MAX = 18;
  // 히든 재료 — 많이 건질수록 오른다 (다른 셋과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  // ─── 그물의 움직임 ───────────────────────────────────────────
  // 줄의 높이를 1 로 놓고 센다 (화면 크기가 달라도 손맛이 같게).
  // ⚠️ **누르면 «올라가는» 것이 아니라 «위로 힘을 준다».** 바로 따라오게 하면
  // 씨름이 아니라 슬라이더가 된다 — 스타듀 밸리의 손맛이 여기서 나온다
  const ACC_UP = 2.6e-6, ACC_DOWN = 1.7e-6;    // 1/ms²
  // ⚠️ **감쇠가 낮으면 «물 위의 배»가 된다.** 0.0016 으로 두었더니 손을 떼고도
  // 0.6초를 더 올라가서, 눈으로 보고 놓아도 이미 늦었다 (검사가 「놓으면 내려온다」로
  // 잡았다). 0.003 이면 되돌리는 데 0.2초라 «붙들고 있다»는 느낌이 산다
  const DAMP   = 0.0030;     // 속도가 잦아드는 정도 (1/ms)
  const BOUNCE = 0.25;       // 줄 끝에 부딪혔을 때 튕기는 정도
  const BAR_H0 = 0.24, BAR_SHRINK = 0.012, BAR_MIN = 0.15;   // 그물 높이 (건질수록 좁아진다)

  // ─── 물고기의 움직임 ───
  // 한 자리를 정해 그리로 가다가, 이따금 마음을 바꾼다. **속도는 건질수록 조금 빨라진다** —
  // ⚠️ 많이 올리지 않는다: 2분짜리에서 끝에 가서 못 따라가면 그건 벌이다
  const FSH_SPD0 = 0.00042, FSH_SPD_UP = 0.000022, FSH_SPD_MAX = 0.00075;
  const FSH_T_MIN = 420, FSH_T_MAX = 1100;

  const PAD = 6;
  const TRACK_X = 0.33;      // 줄이 서는 자리 (화면 폭의 몫) — **엄지로 가리지 않게 왼쪽**
  const TRACK_H = 0.62;      // 줄의 높이 (화면 높이의 몫)
  const TRACK_W = 62, GAUGE_W = 13, GAUGE_GAP = 11;

  // ─── 물빛 ───
  // 「하늘을 그대로 비추는 저수지」라 **물은 거울이다** — 깊은 청록에 달과 별이 비치고,
  // 잔물결이 그것을 흔든다 (`ART_POLICY.md` 의 플랫 2D 결을 캔버스로 옮긴 것)
  const WATER_TOP = '#123a47', WATER_BOT = '#0d2630';
  const CREAM = '#fff6e6', GOLD = '#ffd76a', PINK = '#ff8fc0';
  const FISH_BODY = '#ffd08a', FISH_EDGE = '#c98a4a', FISH_INK = '#3a2a1a';

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ─── 상태 ───
  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, over: false,
      phase: 'wait',           // wait → bite → fight → land → wait
      until: 0,                // 지금 걸음이 끝나는 시각
      got: 0,                  // 건진 수 = 점수
      missed: 0,               // 놓친 수 (연출·검사용)
      hold: false,
      bar: 0.5, vel: 0, barH: BAR_H0,
      fish: 0.5, fishT: 0.5, fishNext: 0, fishV: 0,
      gauge: 0,
      ripples: [],             // 수면에 이는 물결
      lift: 0,                 // 건져 올리는 연출 (0~1)
      w: 0, h: 0,
      pool, specialId, picked: [], gotSpecial: false,
    };
  }

  // ─── 한 걸음씩 ───────────────────────────────────────────────
  function toWait() {
    S.phase = 'wait';
    S.until = S.now + BITE_MIN + Math.random() * (BITE_MAX - BITE_MIN);
  }
  function toBite() {
    S.phase = 'bite';
    S.until = S.now + BITE_WIN;
    ring(0.9);
    if (window.Sfx) Sfx.play('tap');
  }
  // 챈다 — 입질일 때만 먹힌다. ⚠️ **아무 때나 채도 벌이 없다**: 「틀려도 잃는 것이 없다」가
  // 이 게임들의 공통 규칙이다 (흐린 장 · 호두 게임과 같다)
  function hook() {
    if (!S || S.over || S.phase !== 'bite') return false;
    S.phase = 'fight';
    S.bar = 0.5; S.vel = 0; S.gauge = START_G;
    S.fish = 0.5; S.fishT = 0.5; S.fishNext = 0;
    S.barH = Math.max(BAR_MIN, BAR_H0 - BAR_SHRINK * S.got);
    return true;
  }
  function land() {
    S.got++;
    S.phase = 'land';
    S.until = S.now + LAND_MS;
    S.lift = 0;
    ring(0.5);
    if (window.Sfx) Sfx.play('pick');
    const el = host && host.querySelector('.fs-n');
    if (el) el.textContent = String(S.got);
  }
  // 놓쳤다 — **잃는 것이 없다.** 그저 다시 기다린다
  function slip() {
    S.missed++;
    ring(0.7);
    toWait();
  }
  function ring(k) { S.ripples.push({ k, born: S.now }); }

  function tick(dt) {
    const P = S.phase;
    if (P === 'wait') { if (S.now >= S.until) toBite(); return; }
    if (P === 'bite') {
      // ⚠️ **물결을 한 번만 일으키면 안 된다** — 늦게 눈을 준 사람은 이미 지나간
      // 뒤라 「왜 놓쳤는지」를 못 본다. 채는 동안 계속 인다
      if (S.now - (S.lastRing || 0) > 260) { ring(0.8); S.lastRing = S.now; }
      if (S.now >= S.until) slip();
      return;
    }
    if (P === 'land') { S.lift = clamp((S.until - S.now) / LAND_MS, 0, 1); if (S.now >= S.until) toWait(); return; }
    if (P !== 'fight') return;

    // 그물 — 누르면 위로 힘이 붙고, 놓으면 중력이 끈다
    S.vel += (S.hold ? -ACC_UP : ACC_DOWN) * dt;
    S.vel -= S.vel * Math.min(1, DAMP * dt);
    S.bar += S.vel * dt;
    const half = S.barH / 2;
    if (S.bar < half) { S.bar = half; S.vel = -S.vel * BOUNCE; }
    if (S.bar > 1 - half) { S.bar = 1 - half; S.vel = -S.vel * BOUNCE; }

    // 물고기 — 한 자리로 가다가 이따금 마음을 바꾼다
    if (S.now >= S.fishNext) {
      S.fishT = Math.random();
      S.fishNext = S.now + FSH_T_MIN + Math.random() * (FSH_T_MAX - FSH_T_MIN);
    }
    const spd = Math.min(FSH_SPD_MAX, FSH_SPD0 + FSH_SPD_UP * S.got);
    const d = S.fishT - S.fish;
    S.fish += clamp(d, -spd * dt, spd * dt);
    S.fish = clamp(S.fish, 0.02, 0.98);

    // 눈금 — 그물 «안»이면 차고, 밖이면 빠진다
    const inBar = Math.abs(S.fish - S.bar) <= half;
    S.gauge += inBar ? dt / CATCH_MS : -dt / DRAIN_MS;
    if (S.gauge >= 1) { S.gauge = 1; land(); }
    else if (S.gauge <= 0) { S.gauge = 0; slip(); }
  }

  // ─── 그리기 ─────────────────────────────────────────────────
  function water() {
    const { w, h } = S;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, WATER_TOP); g.addColorStop(1, WATER_BOT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 비친 달 — 저수지가 하늘을 그대로 비춘다
    const my = h * 0.2, mr = Math.min(w, h) * 0.085;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(w * 0.72, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 비친 별 — 자리를 시각으로 흔들지 않는다 (씨앗으로 고정해 안 지글거리게)
    ctx.save();
    ctx.fillStyle = CREAM;
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 97) % 100) / 100 * w, sy = ((i * 53) % 70) / 100 * h;
      ctx.globalAlpha = 0.07 + ((i * 31) % 10) / 100;
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 + ((i * 17) % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 갈대와 수련잎 — ⚠️ **아래가 텅 비면 물이 아니라 그냥 «색»이다** (찍어 보고 넣었다).
    // 물속에 잠긴 실루엣이라 잎맥도 무늬도 없다 — `ART_POLICY.md` 의 납작한 결 그대로
    ctx.save();
    ctx.fillStyle = 'rgba(6,26,30,0.55)';
    for (let i = 0; i < 3; i++) {
      const lx = w * (0.1 + i * 0.13), ly = h * (0.93 - i * 0.03), lr = 26 + i * 7;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr, lr * 0.42, Math.sin(S.now / 3400 + i) * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(6,26,30,0.6)'; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const rx = w * (0.02 + i * 0.16), rh = h * (0.1 + (i % 3) * 0.045);
      const sway = Math.sin(S.now / 2200 + i * 1.3) * 7;
      ctx.lineWidth = 3 + (i % 2);
      ctx.beginPath();
      ctx.moveTo(rx, h);
      ctx.quadraticCurveTo(rx + sway * 0.4, h - rh * 0.6, rx + sway, h - rh);
      ctx.stroke();
    }
    ctx.restore();
    // 잔물결 — 아주 느리게 흐른다. **거울을 흔드는 것이 이 그림의 전부다**
    ctx.save();
    ctx.strokeStyle = CREAM; ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const base = h * (0.1 + i * 0.1);
      const off = Math.sin(S.now / 2600 + i) * 10;
      ctx.globalAlpha = 0.05 + (i % 3) * 0.012;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = base + Math.sin((x + off) / 46 + i * 1.7 + S.now / 1800) * 3.2;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 찌 — 기다릴 때는 까닥이고, 입질에는 쑥 들어간다
  function bobber() {
    const { w, h } = S;
    const x = w * (S.phase === 'fight' ? 0.78 : 0.5);
    const base = h * 0.46;
    let y = base + Math.sin(S.now / 620) * 4;
    if (S.phase === 'bite') y = base + 16 + Math.sin(S.now / 70) * 3;
    if (S.phase === 'land') y = base - (1 - S.lift) * 60;
    // 낚싯줄
    ctx.save();
    ctx.strokeStyle = 'rgba(255,246,230,0.4)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
    // 물결
    for (const r of S.ripples) {
      const age = S.now - r.born, k = age / 1100;
      if (k > 1) continue;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.42 * r.k;
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 10 + k * 46, (10 + k * 46) * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke(); ctx.restore();
    }
    // 찌 — 위는 분홍, 아래는 크림 (게임의 두 색이다).
    // ⚠️ **작으면 입질을 놓친다.** 7.5px 로 두었더니 390px 화면에서 점 하나였다 —
    // 챌 순간을 알려 주는 것이 이 그림의 일이라 크기가 곧 안내다 (찍어 보고 키웠다)
    const R = 11;
    ctx.save();
    ctx.translate(x, y);
    if (S.phase === 'bite') ctx.rotate(Math.sin(S.now / 60) * 0.5);   // 채였다 — 기운다
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI, 0); ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(58,42,26,0.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // 건져 올린 것 — 물 위로 떠오른다
    if (S.phase === 'land') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.lift * 1.6);
      drawFish(x, y - 26 - (1 - S.lift) * 10, 34, S.now / 240);
      ctx.restore();
    }
  }

  // 물고기 — 납작한 2D 물고기 (테두리 한 겹 · 눈 한 점)
  function drawFish(x, y, sz, wig) {
    const t = Math.sin(wig) * 0.18;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = FISH_BODY; ctx.strokeStyle = FISH_EDGE; ctx.lineWidth = Math.max(1.2, sz * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.42, sz * 0.27, t * 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();                                  // 꼬리
    ctx.moveTo(-sz * 0.34, 0);
    ctx.lineTo(-sz * 0.6, -sz * 0.24 + t * sz * 0.2);
    ctx.lineTo(-sz * 0.6, sz * 0.24 + t * sz * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();                                  // 등지느러미
    ctx.moveTo(-sz * 0.02, -sz * 0.24);
    ctx.lineTo(sz * 0.14, -sz * 0.42);
    ctx.lineTo(sz * 0.2, -sz * 0.18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FISH_INK;                         // 눈
    ctx.beginPath(); ctx.arc(sz * 0.24, -sz * 0.05, Math.max(1.4, sz * 0.055), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 줄과 그물 — 씨름하는 동안만 선다
  function track() {
    const { w, h } = S;
    const th = h * TRACK_H, ty = (h - th) / 2;
    const cx = w * TRACK_X, tx = cx - TRACK_W / 2;
    const rr = TRACK_W / 2;
    // 줄 — 물속에 잠긴 통발
    ctx.save();
    ctx.fillStyle = 'rgba(8,26,33,0.55)';
    ctx.beginPath(); ctx.roundRect(tx, ty, TRACK_W, th, rr); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,230,0.20)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(tx, ty, TRACK_W, th, rr); ctx.stroke();
    ctx.restore();

    const inBar = Math.abs(S.fish - S.bar) <= S.barH / 2;
    // 그물 — 안에 붙들고 있으면 금빛으로 물든다 (**지금 되고 있다**는 것을 색으로 말한다)
    const bh = S.barH * th, by = ty + S.bar * th - bh / 2;
    ctx.save();
    ctx.fillStyle = inBar ? 'rgba(255,215,106,0.42)' : 'rgba(255,246,230,0.18)';
    ctx.beginPath(); ctx.roundRect(tx + 4, by, TRACK_W - 8, bh, (TRACK_W - 8) / 2.4); ctx.fill();
    ctx.strokeStyle = inBar ? GOLD : CREAM; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.roundRect(tx + 4, by, TRACK_W - 8, bh, (TRACK_W - 8) / 2.4); ctx.stroke();
    ctx.restore();
    // 물고기
    // ⚠️ **그물보다 작아야 한다.** 0.66 으로 두었더니 그물을 꽉 채워
    // 「안에 붙들었다」와 「가장자리에 걸쳤다」가 눈으로 안 갈렸다 (찍어 보고 줄였다)
    drawFish(cx, ty + S.fish * th, TRACK_W * 0.52, S.now / 180);

    // 눈금 — 줄 오른쪽에 나란히
    const gx = tx + TRACK_W + GAUGE_GAP;
    ctx.save();
    ctx.fillStyle = 'rgba(8,26,33,0.55)';
    ctx.beginPath(); ctx.roundRect(gx, ty, GAUGE_W, th, GAUGE_W / 2); ctx.fill();
    const gh = th * S.gauge;
    const gg = ctx.createLinearGradient(0, ty + th - gh, 0, ty + th);
    gg.addColorStop(0, GOLD); gg.addColorStop(1, PINK);
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.roundRect(gx, ty + th - gh, GAUGE_W, gh, GAUGE_W / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,230,0.22)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(gx, ty, GAUGE_W, th, GAUGE_W / 2); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!S || !ctx) return;
    water();
    if (S.phase === 'fight') track();
    bobber();
  }

  // ─── 한 프레임 ───
  // 물결도 그물도 계속 움직이므로 **프레임마다 그린다** (호박 밭·바위산과 같다)
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.now = ts; toWait(); }
    const dt = Math.min(48, ts - S.now);
    S.now = ts;
    if (ts - S.t0 >= DUR_MS) { finish(); return; }
    tick(dt);
    S.ripples = S.ripples.filter(r => ts - r.born < 1100);
    draw();
    raf = requestAnimationFrame(step);
  }

  // ─── 끝내기 ───
  function finish() {
    if (!S || S.over) return;
    S.over = true;
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    // **건진 수를 재료로 바꾼다**
    const n = Math.min(REWARD_MAX, S.got * REWARD_PER);
    for (let i = 0; i < n; i++) S.picked.push(pickItem());
    if (S.specialId) {
      const prog = Math.min(1, (S.got * REWARD_PER) / REWARD_MAX);
      if (Math.random() < SP_BASE + SP_TOP * prog) {
        S.picked.push(S.specialId);
        S.gotSpecial = true;
      }
    }
    showResult();
  }

  function pickItem() {
    const p = S.pool && S.pool.length ? S.pool : ['dew'];
    return p[Math.floor(Math.random() * p.length)];
  }

  function showResult() {
    const D = window.GameData;
    const counts = {};
    S.picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.keys(counts).map(id => {
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '💧', name: id };
      return `<span class="fs-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.fs-result');
    box.innerHTML = `
      <div class="fs-res-title">${S.got ? T('fs_done', { n: S.got }) : T('fs_none')}</div>
      <div class="fs-res-items">${rows || `<span class="fs-item">${T('fs_none')}</span>`}</div>
      <button class="btn fs-close">${T('fs_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.fs-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const got = S ? S.got : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared: false, score: got }); }
  }

  function teardown() {
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    window.removeEventListener('resize', fit);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; cv = null; ctx = null; S = null;
  }

  function fit() {
    if (!host || !cv) return;
    const st = host.querySelector('.fs-stage');
    const w = st.clientWidth, h = st.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S) return;
    S.w = w; S.h = h;
  }

  // ─── 안내 한 줄 ───
  // **지금 무엇을 할 차례인지**를 그때그때 말해 준다. 낚시는 걸음이 넷이라
  // 한 줄로 다 적으면 아무도 안 읽는다
  function hint() {
    const el = host && host.querySelector('.fs-hint');
    if (!el) return;
    const k = { wait: 'fs_hint_wait', bite: 'fs_hint_bite', fight: 'fs_hint_fight', land: 'fs_hint_land' }[S.phase];
    const txt = T(k || 'fs_hint_wait');
    if (el.textContent !== txt) el.textContent = txt;
  }

  // ─── 시작 ───
  function start(map, onEnd) {
    if (S) return;                                   // 이미 돌고 있으면 무시
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['dew'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'fishGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('fs_title');
    host.innerHTML = `
      <div class="fs-stage">
        <canvas class="fs-canvas"></canvas>
        <div class="fs-hud">
          <span class="fs-name">${title}</span>
          <span class="fs-score">🎣 <b class="fs-n">0</b></span>
          <span class="fs-timer">2:00</span>
        </div>
        <div class="fs-hint">${T('fs_hint_wait')}</div>
        <div class="fs-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.fs-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    window.addEventListener('resize', fit);

    // ─── 손가락 ───
    // **어디를 눌러도 된다.** 입질이면 «채는» 것이고, 씨름 중이면 «당기고 있는» 것이다 —
    // ⚠️ 두 동작에 두 자리를 주면 씨름하다가 손이 어디 있는지를 또 생각해야 한다
    cv.addEventListener('pointerdown', e => {
      if (!S || S.over) return;
      // ⚠️ **문은 `hook()` 한 곳이다.** 여기서 `phase === 'bite'` 를 한 번 더 보면
      // 문이 둘이 되어, 한쪽만 고쳐도 다른 쪽이 막아 주는 바람에 **사보타주가 안 걸린다**
      // (실제로 `hook()` 의 빗장을 빼 보았는데 여기서 막혀 검사가 못 잡았다)
      hook();
      S.hold = true;
      e.preventDefault();
    });
    const up = () => { if (S) S.hold = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', up);
    cv.style.touchAction = 'none';

    // 남은 시간 · 안내 줄
    const timerEl = host.querySelector('.fs-timer');
    const tickUI = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      hint();
      timerT = setTimeout(tickUI, 120);
    };
    tickUI();

    raf = requestAnimationFrame(step);
  }

  // 검사용 구멍 — **캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 본다**
  function boardState() {
    if (!S) return null;
    return {
      phase: S.phase, got: S.got, missed: S.missed, over: S.over,
      gauge: S.gauge, bar: S.bar, barH: S.barH, fish: S.fish, hold: S.hold,
      inBar: Math.abs(S.fish - S.bar) <= S.barH / 2,
    };
  }

  window.Fish = {
    start, boardState,
    // 검사용 — 손가락 없이 입질을 일으키거나, 채거나, 물고기를 붙들어 놓거나
    _bite: () => { if (S && !S.over && S.phase === 'wait') { toBite(); return true; } return false; },
    _hook: () => hook(),
    _hold: b => { if (S) S.hold = !!b; },
    _pin: v => { if (S) { S.fish = v; S.fishT = v; S.fishNext = S.now + 9e9; } },   // 물고기를 한 자리에
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    REWARD_PER, REWARD_MAX, DUR_MS, CATCH_MS, DRAIN_MS, BITE_MIN, LAND_MS, BITE_WIN,
  };
})();
