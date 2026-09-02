// ═══════════════════════════════════════════════════════════════
//  파수꾼의 호박 밭 — 호박 피하기 미니게임
//  맵 카드를 누르면 채집 대신 이 화면으로 들어온다 (map.mini === 'pumpkin').
//  사방에서 호박이 굴러오고, 굴러오기 0.5초 전에 바닥에 궤적을 보여 준다.
//  2분을 버티면 클리어. 맞으면 그때까지 주운 것만 들고 나온다.
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 — 그래야 게임 로직에서 DPR 을 신경 쓰지 않는다.
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  const DUR_MS      = 120000;   // 버텨야 하는 시간 (2분)
  const TELEGRAPH_MS = 500;     // 궤적을 보여 주는 시간
  const PLAYER_R    = 13;
  const EASE        = 0.22;     // 손가락을 따라가는 정도 (1 이면 즉시)
  const REWARD_EVERY = 8000;    // 이만큼 버틸 때마다 재료 1개
  const HIT_GRACE_MS = 1200;    // 시작 직후에는 맞지 않는다 (화면 파악할 시간)

  const PLAYER_R_DRAW = 19;     // 얼굴은 판정보다 조금 크게 그린다 (아래 ⚠️)
  const SCARE_R      = 62;      // 이만큼 가까이 오면 놀란 얼굴

  let host = null, cv = null, ctx = null, raf = 0;
  let S = null;                 // 진행 중 상태 (없으면 안 돌고 있는 것)

  // ─── 공주 얼굴 ───────────────────────────────────────────────
  // 살구색 동그라미 하나였던 자리에 **공주를 세운다** — 피하고 있는 것이 누구인지가
  // 보여야 이 미니게임이 이 게임의 장면이 된다.
  //
  // 초상화는 `Portrait.bust()` 가 내주는 **SVG 문자열**인데 캔버스에는 못 그린다.
  // 그래서 한 번만 `Image` 로 구워 두고 매 프레임 `drawImage` 한다.
  // ⚠️ **못 구워도 게임은 그대로 돌아야 한다** — 실패하면 예전 동그라미로 떨어진다
  // (미니게임이 안 뜨는 것보다 얼굴이 없는 편이 훨씬 낫다).
  // ⚠️ SVG 를 Image 로 구우려면 **width/height 가 박혀 있어야 한다.** viewBox 만
  // 있으면 브라우저마다 크기를 다르게 잡거나 아예 안 그린다.
  // 초상화 원본 크기와 **얼굴만 잘라 낼 자리**.
  // ⚠️ `Portrait.bust()` 는 «흉상»이라 어깨까지 들어 있다 — 통째로 34px 동그라미에
  // 넣으면 머리가 콩알만 해진다 (처음에 그렇게 나왔다). 머리 언저리만 잘라 쓴다.
  const PT_W = 120, PT_H = 130;
  const FACE_BOX = { x: 15, y: 5, w: 90, h: 90 };
  const FACES = {};             // mood → Image (또는 실패 표시)
  function faceImg(mood) {
    if (FACES[mood] !== undefined) return FACES[mood];
    FACES[mood] = null;         // 굽는 중 — 다시 안 굽는다
    try {
      const sp = window.GameData && GameData.speaker('sp_gwiriel');
      if (!sp || !window.Portrait) return null;
      let svg = Portrait.bust(sp, mood, { bare: true });
      if (!svg) return null;
      // viewBox 는 그대로 두고 크기만 박는다
      // 초상화의 viewBox 는 120×130 이다 (`portrait.js`). 그 비율 그대로 박아야
      // 얼굴이 안 눌린다
      svg = svg.replace('<svg ', `<svg width="${PT_W}" height="${PT_H}" `);
      const img = new Image();
      img.onload = () => { FACES[mood] = img; };
      img.onerror = () => { FACES[mood] = false; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return null;
    } catch (e) { FACES[mood] = false; return null; }
  }
  // 시작할 때 미리 구워 둔다 — 첫 프레임부터 얼굴이 나오게
  function warmFaces() { ['smile', 'shock'].forEach(faceImg); }
  // 검사용 구멍 — 어떤 표정이 구워졌는지, 지금 어느 것을 쓰는지.
  // 캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 보므로 이 한 줄이 필요하다
  function faceState() {
    const near = !!(S && S.pumpkins.some(p => p.rolling
      && Math.hypot(p.x - S.px, p.y - S.py) < SCARE_R));
    return { baked: Object.keys(FACES).filter(k => FACES[k]), using: near ? 'shock' : 'smile' };
  }

  // ─── 상태 만들기 ───
  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, last: 0,
      px: 0, py: 0, tx: 0, ty: 0,     // 플레이어 위치 / 목표(손가락) 위치
      pumpkins: [],
      nextSpawn: 400,
      pool, specialId,
      picked: [],                      // 주운 재료 id
      nextReward: REWARD_EVERY,
      over: false, cleared: false,
      w: 0, h: 0,
    };
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
    // 플레이어가 화면 밖에 있으면 안으로 넣는다 (회전·리사이즈)
    S.px = Math.min(Math.max(S.px || S.w / 2, PLAYER_R), S.w - PLAYER_R);
    S.py = Math.min(Math.max(S.py || S.h * 0.7, PLAYER_R), S.h - PLAYER_R);
    if (!S.tx && !S.ty) { S.tx = S.px; S.ty = S.py; }
  }

  // ─── 호박 하나 만들기 ───
  // 화면 밖 한 점에서 시작해 안쪽 어딘가를 향해 직선으로 굴러간다.
  function spawn(elapsed) {
    const prog = Math.min(1, elapsed / DUR_MS);
    const speed = 0.16 + prog * 0.20;                 // px/ms — 갈수록 빨라진다
    const r = 13 + Math.random() * 10;
    const m = 40;                                      // 화면 밖 여유
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * S.w; y = -m; }
    else if (side === 1) { x = S.w + m; y = Math.random() * S.h; }
    else if (side === 2) { x = Math.random() * S.w; y = S.h + m; }
    else { x = -m; y = Math.random() * S.h; }
    // 목표점 — 플레이어 근처를 노리되 조금 흩뿌린다 (완전 조준이면 피할 수 없다)
    const aimX = S.px + (Math.random() - 0.5) * S.w * 0.5;
    const aimY = S.py + (Math.random() - 0.5) * S.h * 0.5;
    const dx = aimX - x, dy = aimY - y;
    const len = Math.hypot(dx, dy) || 1;
    const kinds = S.pool;
    return {
      x, y, r,
      vx: (dx / len) * speed, vy: (dy / len) * speed,
      born: S.now, rolling: false, spin: 0,
      emoji: kindEmoji(kinds[Math.floor(Math.random() * kinds.length)]),
    };
  }

  function kindEmoji(id) {
    const D = window.GameData;
    const it = D && D.INGREDIENTS && D.INGREDIENTS[id];
    return (it && it.emoji) || '🎃';
  }

  // ─── 한 프레임 ───
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.last = ts; }
    const dt = Math.min(50, ts - S.last);            // 탭이 백그라운드였다 오면 크게 튄다 — 잘라 준다
    S.last = ts;
    S.now = ts;
    const elapsed = ts - S.t0;

    // 플레이어 — 손가락 쪽으로 부드럽게
    S.px += (S.tx - S.px) * EASE;
    S.py += (S.ty - S.py) * EASE;
    S.px = Math.min(Math.max(S.px, PLAYER_R), S.w - PLAYER_R);
    S.py = Math.min(Math.max(S.py, PLAYER_R), S.h - PLAYER_R);

    // 스폰 — 갈수록 촘촘하게
    S.nextSpawn -= dt;
    if (S.nextSpawn <= 0) {
      S.pumpkins.push(spawn(elapsed));
      const prog = Math.min(1, elapsed / DUR_MS);
      S.nextSpawn = 780 - prog * 520 + Math.random() * 220;
    }

    // 호박 이동 + 충돌
    const grace = elapsed < HIT_GRACE_MS;
    for (const p of S.pumpkins) {
      const age = ts - p.born;
      if (age < TELEGRAPH_MS) continue;              // 아직 궤적만 보여 주는 중
      p.rolling = true;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 0.012;
      if (!grace && Math.hypot(p.x - S.px, p.y - S.py) < p.r + PLAYER_R - 3) {
        finish(false);
        return;
      }
    }
    // 화면 밖으로 나간 것 치우기
    S.pumpkins = S.pumpkins.filter(p =>
      p.x > -120 && p.x < S.w + 120 && p.y > -120 && p.y < S.h + 120);

    // 버틴 시간에 따라 재료를 줍는다
    while (elapsed >= S.nextReward) {
      S.picked.push(pickItem());
      S.nextReward += REWARD_EVERY;
    }

    draw(elapsed);

    if (elapsed >= DUR_MS) { finish(true); return; }
    raf = requestAnimationFrame(step);
  }

  // 주울 재료 하나 — 클리어 보너스는 finish 에서 따로 준다
  function pickItem() {
    const pool = S.pool;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ─── 그리기 ───
  function draw(elapsed) {
    const w = S.w, h = S.h;
    ctx.clearRect(0, 0, w, h);

    // 밭 바닥
    ctx.fillStyle = '#6b4b2f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 24; y < h; y += 34) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 궤적 — 굴러오기 전 0.5초 동안만
    for (const p of S.pumpkins) {
      const age = S.now - p.born;
      if (age >= TELEGRAPH_MS) continue;
      const k = age / TELEGRAPH_MS;                  // 0 → 1
      const len = Math.hypot(w, h) * 1.4;
      const ex = p.x + (p.vx / Math.hypot(p.vx, p.vy)) * len;
      const ey = p.y + (p.vy / Math.hypot(p.vx, p.vy)) * len;
      ctx.save();
      ctx.globalAlpha = 0.14 + k * 0.26;   // 벽처럼 보이지 않게 옅게 — '여기로 온다' 는 신호면 된다
      ctx.strokeStyle = '#ffd66b';
      ctx.lineWidth = p.r * 1.7;
      ctx.lineCap = 'round';
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -elapsed * 0.06;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.restore();
    }

    // 호박
    for (const p of S.pumpkins) {
      if (!p.rolling) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.font = `${p.r * 2.1}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    }

    // 플레이어 — **공주**
    ctx.save();
    ctx.beginPath();
    ctx.arc(S.px, S.py + 3, PLAYER_R * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    // 호박이 가까이 오면 놀란 얼굴. **판정과 같은 거리를 안 쓴다** —
    // 판정 거리로 하면 놀라는 순간이 곧 맞는 순간이라 표정이 보이지도 않는다
    const near = S.pumpkins.some(p => p.rolling && Math.hypot(p.x - S.px, p.y - S.py) < SCARE_R);
    const img = faceImg(near ? 'shock' : 'smile');
    if (img) {
      // ⚠️ 얼굴은 **판정보다 조금 크게** 그린다. 초상화는 여백을 두고 그려져서
      // 판정 크기에 딱 맞추면 얼굴이 실제보다 작아 보이고, 「안 맞았는데 맞았다」로 읽힌다.
      // 동그랗게 잘라 배경 여백이 사각형으로 드러나지 않게 한다
      const d = PLAYER_R_DRAW * 2;
      ctx.beginPath();
      ctx.arc(S.px, S.py, PLAYER_R_DRAW, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffe9dc';                 // 초상화가 다 안 채우는 자리
      ctx.fillRect(S.px - PLAYER_R_DRAW, S.py - PLAYER_R_DRAW, d, d);
      const F = FACE_BOX;
      ctx.drawImage(img, F.x, F.y, F.w, F.h,
                    S.px - PLAYER_R_DRAW, S.py - PLAYER_R_DRAW, d, d);
      ctx.restore();
      // ⚠️ **흰 테를 넉넉히 두른다.** 공주의 머리가 짙은 갈색인데 호박 밭 바닥도
      // 갈색이라, 테가 얇으면 머리가 배경에 녹아 «얼굴만 둥둥» 떠 보인다
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    } else {
      // 아직 안 구워졌거나 못 구웠다 — 예전 동그라미로 떨어진다
      ctx.beginPath();
      ctx.arc(S.px, S.py, PLAYER_R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdcc4';
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#f2c6a6';
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─── 끝내기 ───
  function finish(cleared) {
    if (!S || S.over) return;
    S.over = true;
    S.cleared = cleared;
    cancelAnimationFrame(raf);
    const survived = Math.min(DUR_MS, (S.t0 ? S.now - S.t0 : 0));
    if (cleared) S.picked.push(pickItem(), pickItem());   // 끝까지 버틴 보너스

    // ── 특별 재료 '뒤로 깠다는 호박씨' ──
    // 끝나면 확률로 얻는다. 오래 버틸수록 확률이 오르고, 끝까지 버티면 최대(25%).
    // (맞고 끝나도 기회는 남는다 — 5% 부터 시작)
    if (S.specialId) {
      // 끝까지 버텼으면 시간과 상관없이 최대 확률로 친다 (시계를 재는 게 아니라 '클리어' 가 기준)
      const prog = cleared ? 1 : survived / DUR_MS;
      S.specialChance = 0.05 + 0.20 * prog;
      if (Math.random() < S.specialChance) {
        S.picked.push(S.specialId);
        S.gotSpecial = true;
      }
    }
    S.survivedMs = survived;
    showResult();
  }

  function showResult() {
    const D = window.GameData;
    const counts = {};
    S.picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.keys(counts).map(id => {
      const it = D.INGREDIENTS[id];
      const nm = N(id, it.name);
      return `<span class="pk-item">${it.emoji} ${nm} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.pk-result');
    box.innerHTML = `
      <div class="pk-res-title">${S.cleared ? T('pk_cleared') : T('pk_hit')}</div>
      <div class="pk-res-items">${rows || `<span class="pk-item">${T('pk_none')}</span>`}</div>
      <button class="btn pk-close">${T('pk_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.pk-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const cleared = S ? S.cleared : false;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared }); }
  }

  function teardown() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; cv = null; ctx = null; S = null;
  }

  // ─── 시작 ───
  function start(map, onEnd) {
    if (S) return;                                   // 이미 돌고 있으면 무시
    warmFaces();                                     // 첫 프레임부터 공주가 나오게 미리 굽는다
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['old_pumpkin'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'pumpkinGame';
    host.innerHTML = `
      <div class="pk-stage">
        <canvas class="pk-canvas"></canvas>
        <div class="pk-hud">
          <span class="pk-name">🎃 ${T('pk_title')}</span>
          <span class="pk-timer">2:00</span>
        </div>
        <div class="pk-hint">${T('pk_hint')}</div>
        <div class="pk-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.pk-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    S.px = S.w / 2; S.py = S.h * 0.72; S.tx = S.px; S.ty = S.py;

    window.addEventListener('resize', fit);

    // 손가락/마우스를 따라간다. 캔버스 위에서만 잡는다.
    const toLocal = e => {
      const r = cv.getBoundingClientRect();
      S.tx = e.clientX - r.left;
      S.ty = e.clientY - r.top;
    };
    let dragging = false;
    cv.addEventListener('pointerdown', e => { dragging = true; toLocal(e); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (dragging) { toLocal(e); e.preventDefault(); } });
    const stop = () => { dragging = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
    cv.addEventListener('pointerleave', stop);
    // 캔버스에서 손가락을 움직일 때 화면이 같이 스크롤되지 않게
    cv.style.touchAction = 'none';

    // 남은 시간 표시
    const timerEl = host.querySelector('.pk-timer');
    const tick = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      setTimeout(tick, 200);
    };
    tick();

    raf = requestAnimationFrame(step);
  }

  window.Pumpkin = { faceState,
    start,
    // 검사용 — 진행 중 상태를 들여다보거나 즉시 끝낼 때
    _state: () => S,
    _finish: cleared => finish(!!cleared),
    isPlaying: () => !!S,
  };
})();
