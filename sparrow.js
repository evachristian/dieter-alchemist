// ═══════════════════════════════════════════════════════════════
//  노을 밀밭 — 참새 쫓기 미니게임 (Arrow Escape / Tap Away)
//  맵 카드를 누르면 채집 대신 이 화면으로 들어온다 (`D.fieldMini(map.id) === 'sparrow'`).
//  참새가 날아와 밀 이삭에 앉아 쪼아 먹는다. **누른 자리로 화살이 날아가고**,
//  참새 곁에 꽂히면 놀라서 날아간다. 2분 동안 쫓은 수가 곧 재료다.
//
//  ⚠️ **화살이 참새를 «맞히지» 않는다.** 밭에 꽂히고 그 소리에 놀라서 날아가는 것이다 —
//  코지 게임에서 새를 쏘아 떨어뜨리면 그림이 통째로 달라진다. 그래서 맞은 자리에
//  피가 아니라 **깃털**이 흩어지고, 참새는 위로 푸드덕 날아오른다.
//
//  좌표는 캔버스 픽셀(CSS px)로 다룬다. 고해상도 화면을 위해 백버퍼만 DPR 배로 잡고
//  컨텍스트를 미리 scale 해 둔다 — 그래야 게임 로직에서 DPR 을 신경 쓰지 않는다
//  (호박 밭·낚시와 같은 규칙이다).
// ═══════════════════════════════════════════════════════════════
(function () {
  const T = (k, p) => (window.I18N ? I18N.t(k, p) : k);
  const N = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름 (game.js 와 같은 규칙)

  // ⚠️ **다섯 중 이것만 30초다.** 「2분은 길다」고 해서 줄인 자리인데, 그러면
  // **한 판 최대를 같이 내려야 한다** — 같은 AP 를 내고 4분의 1 시간에 같은 것을 받으면
  // 나머지 넷은 아무도 안 가는 죽은 콘텐츠가 된다. `checkbalance` 가 이제
  // 「같은 시간」이 아니라 **「분당 같은 자리」**로 다섯을 견준다
  const DUR_MS = 30000;      // 30초

  // ─── 보상 ───
  // **참새 `REWARD_PER` 마리마다 재료 하나** (호두밭·바위산과 같은 방향이다 —
  // 낚시만 반대로 「한 번에 두 개」다). 상한 6개 = **48점**이다.
  // `checkbalance` 가 넷과 견준다 (호박 17 · 바위산 18 · 낚시터 18 · 호두밭 20)
  // ⚠️ **멀티킬은 «제곱»으로 들어온다** — 한 발에 n 마리면 `n²` 점이다
  // (1 · 4 · 9 · 16 · 25). 그래서 상한은 **단발로는 못 닿고**, 떼를 노려야 닿는다:
  // 30초에 나오는 참새가 (떼까지 세면) 쉰 마리쯤인데 상한은 72점이라, 다 단발로 맞혀도 못 닿는다.
  // 「많이 쏘기」가 아니라 **「몰려 있을 때를 노리기」**가 이 게임의 실력이 된다
  const REWARD_PER = 12;     // 이만큼의 «점»마다 재료 하나
  const REWARD_MAX = 6;      // 30초 몫 — 분당으로는 2분짜리 넷과 같은 자리다
  // 히든 재료 — 많이 쫓을수록 오른다 (다른 셋과 같은 식: 바닥 5% ~ 꼭대기 25%)
  const SP_BASE = 0.05, SP_TOP = 0.20;

  // ─── 참새 ───
  // ⚠️ **스폰 간격이 곧 상한이다.** 촘촘하게 두면 아무나 상한에 닿아 「2분을 내는」
  // 거래가 의미를 잃고, 성기게 두면 잘해도 못 닿는다. `checkbalance` 가
  // **「상한에 닿으려면 스폰되는 것의 절반은 쫓아야 한다」**로 이 관계를 못 박는다
  // ⚠️ **판이 짧아지면 밭도 그만큼 북적여야 한다.** 1700~1200 을 그대로 두면 30초에
  // 열아홉 마리뿐이라 상한(24마리)에 **아무리 잘해도 못 닿는다**
  const SPAWN_START = 1200, SPAWN_MIN = 800;    // 갈수록 조금 촘촘해진다
  const MAX_BIRDS = 8;       // 한 화면에 이만큼까지 (떼가 내려앉을 자리가 있어야 한다)
  // ─── 떼 ───
  // **뒤로 갈수록 떼지어 내려앉는다.** ⚠️ 떼가 없으면 멀티킬이 «운»이 되고, 제곱 보상은
  // 아무도 못 닿는 장식이 된다 — 둘은 한 벌이다.
  // ⚠️ **떼는 «한 발에 들어오도록» 모여 앉는다**(`FLOCK_R` ≤ `HIT_R`) — 흩어 놓으면
  // 보기에만 떼고 한 마리씩 맞히게 된다. 대신 앉자마자 저마다 폴짝 뛰어 흩어지므로
  // **내려앉는 그 순간**이 노릴 자리다
  const FLOCK_BASE = 0.10, FLOCK_TOP = 0.60;   // 떼로 올 확률 (처음 → 끝)
  const FLOCK_R = 17;        // 떼가 모여 앉는 반경
  const FLY_MS = 760;        // 화면 밖에서 이삭까지 날아드는 시간
  // 앉아 있는 시간 — 갈수록 짧아진다. ⚠️ **너무 줄이지 않는다**: 끝에 가서
  // 손이 못 따라갈 만큼 짧아지면 그건 벌이다 (돌깨기의 낙하 속도와 같은 규칙)
  const STAY_START = 2600, STAY_MIN = 1800;
  const FLEE_MS = 620;       // 놀라서 날아가는 연출
  // ⚠️ **폴짝이 없으면 반응 속도가 낄 자리가 없다.** 참새가 2.6초를 가만히 앉아 있으면
  // 0.15~0.42초짜리 반응 차이가 아무것도 안 가른다 (재 보니 명중률이 50 ↔ 49% 였다).
  // 자주, 그리고 «툭» 옮겨 앉는다 — 화살이 날아가는 동안 자리가 바뀌는 것이 이 게임의 손맛이다
  const HOP_MS = 250;        // 옆 이삭으로 폴짝
  const HOP_D = 56;          // 폴짝 뛰는 거리
  const BIRD_R = 15;         // 몸 반지름 (그리기용)

  // ─── 화살 ───
  // ⚠️ **누르면 그 자리로 «날아간다» — 즉시 맞는 것이 아니다.** 바로 맞으면
  // 「누르기」일 뿐이고, 날아가는 동안 참새가 폴짝 뛰면 빗나가는 것이 이 게임의 손맛이다
  // ⚠️ **느리면 «쐈는데 반응이 없다»로 읽힌다** — 1.45 일 때 제일 먼 자리가 271ms 라
  // 손끝과 결과 사이가 너무 멀었다 (「화살 너무 느려」로 신고받았다). 3.0 이면 먼 자리가
  // 130ms · 가까운 자리는 60ms 다. **날아가는 것은 여전히 눈에 보인다**
  const ARROW_SPD = 3.0;     // px/ms
  // 이 안에 있는 참새가 «다 같이» 놀란다 (잘 노리면 둘도 쫓는다).
  // ⚠️ **여기가 난이도의 전부였다.** 34 로 두었더니 390px 화면에 참새 다섯이 깔린 상태에서
  // **아무 데나 쏴도 누군가는 걸려**, 반응 속도를 150 ↔ 420ms 로 벌려도 결과가 똑같았다
  // (셋 다 나온 참새를 통째로 쓸어 상한). 참새 몸만 하게 줄여야 «조준»이 생긴다
  const HIT_R = 20;
  // ⚠️ **연사를 막는 것은 «벌»이 아니라 활을 당기는 시간이다.** 없으면 아무 데나
  // 마구 눌러도 되는 게임이 되고, 길면 노려 놓고도 못 쏜다.
  // 300 일 때는 2분에 400발이라 참새 여든 마리를 통째로 쓸어 버렸다 — 600 이면 200발이다
  const SHOT_MS = 600;
  const FEATHER_MS = 900, FEATHER_PER = 7;   // 맞은 자리에 흩어지는 깃털

  // ─── 타격 연출 ───
  // ⚠️ **「점수가 올랐다」만으로는 «맞았다»가 안 읽힌다** (돌깨기의 파편·먼지·흔들림에서
  // 배운 것과 같다). 셋이 같이 있어야 «팡!» 으로 보인다 — 퍼지는 고리 · 튀는 불똥 · 섬광
  const POP_MS = 420, SPARK_PER = 9;
  // 플로터 — 맞힌 수를 그 자리에서 띄운다. 하나면 `+1`, 둘 이상이면 멀티킬 이름
  const FLOAT_MS = 1050;
  // 콤보 — 빗맞히거나 이만큼 쉬면 끊긴다. **×2 부터만 보여 준다** (×1 은 뜻이 없다)
  const COMBO_MS = 3200;
  const HURRY_MS = 10000;    // 마지막 이만큼은 시계가 붉게 뛴다

  const PAD = 6;
  // ⚠️ **참새가 앉는 띠는 «이삭의 높이»여야 한다.** 처음에는 0.40~0.78 에 두고 밀은
  // 아래 20% 에만 깔았더니, 참새가 이삭이 아니라 **허공에 떠** 있었다 (찍어 보고 알았다).
  // 지금은 지평선 아래로 밭이 화면 절반을 차지하고, 이 띠가 **뒤쪽 이삭의 머리**와 겹친다
  const HORIZON = 0.50;      // 하늘과 밭이 만나는 높이
  const FIELD_TOP = 0.56, FIELD_BOT = 0.78;
  const BOW_Y = 0.93;        // 활이 서는 높이 (화면 높이의 몫)

  // ─── 노을빛 ───
  // 「노을에 물드는 밀밭」이라는 맵 설명을 그대로 그린다 (`ART_POLICY.md` 의 플랫 2D).
  const SKY_TOP = '#4a3a6b', SKY_MID = '#e2654a', SKY_BOT = '#f6b05e';
  const SUN = '#ffe2a0';
  const WHEAT_FAR = '#b87a36', WHEAT_NEAR = '#e8b45c', WHEAT_DARK = '#7d4f21';
  const GROUND = '#5d3a1c';
  const CREAM = '#fff6e6';
  const BIRD_BODY = '#8a6440', BIRD_HEAD = '#5d4630', BIRD_BELLY = '#f0e2c8',
        BIRD_WING = '#4a361f', BEAK = '#f0b64e';
  const SHAFT = '#fff1da', HEAD_M = '#d8dee4', FLETCH = '#e8734a';
  const BOW_W = '#c9955a', BOW_STR = 'rgba(255,246,230,0.75)';

  let host = null, cv = null, ctx = null, raf = 0, timerT = 0;
  let S = null;              // 진행 중 상태 (없으면 안 돌고 있는 것)

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ─── 상태 만들기 ───
  function newState(pool, specialId) {
    return {
      t0: 0, now: 0, last: 0,
      birds: [], arrows: [], feathers: [], pops: [], floats: [],
      combo: 0, comboAt: 0, comboBest: 0, multi: {}, points: 0,
      nextSpawn: 700, seq: 0,
      lastShot: -9999, shots: 0,
      scared: 0, missed: 0,
      pool, specialId, picked: [], gotSpecial: false,
      over: false, w: 0, h: 0, stalks: [],
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
    makeStalks();
    // 화면이 바뀌면 참새가 밖에 남을 수 있다 — 띠 안으로 넣는다
    for (const b of S.birds) {
      b.x = clamp(b.x, PAD + BIRD_R, S.w - PAD - BIRD_R);
      b.y = clamp(b.y, S.h * FIELD_TOP, S.h * FIELD_BOT);
    }
  }

  // 밀 이삭 — ⚠️ **한 번 정하면 안 바뀐다.** 매 프레임 새로 뽑으면 밭이 지글거린다
  // (돌깨기의 「얼룩은 씨앗이 정한다」와 같은 규칙이다).
  //
  // **«이삭 머리가 설 높이»로 뽑는다** — 줄기 길이로 뽑으면 밑동이 어디냐에 따라
  // 머리가 제멋대로 서서, 참새가 앉는 띠와 안 맞는다. 뒤 겹의 머리가 곧 그 띠다
  function makeStalks() {
    const { w, h } = S;
    const out = [];
    for (let layer = 0; layer < 2; layer++) {
      const step = layer ? 11 : 15;                       // 앞 겹이 더 촘촘하다
      const n = Math.ceil(w / step) + 2;
      for (let i = 0; i < n; i++) {
        const x = (i - 1 + ((i * 37) % 10) / 10) * step;
        const q = ((i * 53) % 100) / 100;                 // 0~1 — 같은 겹 안에서도 키가 다르다
        // 뒤 겹의 머리는 참새가 앉는 띠, 앞 겹은 그보다 아래(= 더 가까이)
        const top = layer ? h * (0.74 + q * 0.14) : h * (FIELD_TOP + q * (FIELD_BOT - FIELD_TOP));
        out.push({
          layer, x, top,
          base: layer ? h * 1.04 : h * (0.90 + ((i * 23) % 7) / 100),
          lean: (((i * 29) % 10) - 5) * 0.05,
          ph: ((i * 17) % 100) / 100,
        });
      }
    }
    S.stalks = out;
  }

  // ⚠️ **참새는 «진짜 이삭 머리»에 앉는다.** 띠 안 아무 데나 두면 이삭이 없는 자리에도
  // 서서 허공에 뜬 것처럼 보인다 (찍어 보고 알았다). 뒤 겹의 이삭 하나를 골라 그 머리에 앉힌다
  function earAt(i) {
    const ears = S.stalks.filter(st => st.layer === 0 && st.x > PAD && st.x < S.w - PAD);
    if (!ears.length) return null;
    const e = ears[((i % ears.length) + ears.length) % ears.length];
    return { x: e.x + e.lean * (e.base - e.top), y: e.top - 7, n: ears.length };
  }
  function pickEar() {
    const first = earAt(0);
    if (!first) return null;
    return earAt(Math.floor(Math.random() * first.n));
  }

  // ─── 참새 하나 ───
  function spawnBird(elapsed) {
    const { w, h } = S;
    const prog = clamp(elapsed / DUR_MS, 0, 1);
    const ear = pickEar();
    const px = ear ? ear.x : rnd(w * 0.12, w * 0.88);
    const py = ear ? ear.y : rnd(h * FIELD_TOP, h * FIELD_BOT);
    const fromLeft = Math.random() < 0.5;
    return {
      id: ++S.seq,
      x: fromLeft ? -30 : w + 30, y: py - rnd(30, 70),
      px, py,                                   // 앉을 자리
      born: S.now, state: 'in',                 // in → perch → flee/leave
      stayFor: STAY_START - (STAY_START - STAY_MIN) * prog,
      perchAt: 0, nextHop: 0, gone: 0,
      flip: fromLeft ? 1 : -1,
      ph: Math.random() * 6.28,
    };
  }

  // ─── 화살 쏘기 ───
  // ⚠️ **문은 여기 하나다.** 손가락 쪽에서 쿨다운을 한 번 더 보면 문이 둘이 되어
  // 한쪽 빗장을 빼도 다른 쪽이 막아 준다 — 낚시의 `hook()` 에서 배운 자리다.
  // 돌려주는 값은 「정말로 쐈는가」다 (검사가 이것으로 쿨다운을 잰다)
  function shoot(x, y) {
    if (!S || S.over) return false;
    if (S.now - S.lastShot < SHOT_MS) return false;
    const bx = S.w / 2, by = S.h * BOW_Y;
    const d = Math.hypot(x - bx, y - by) || 1;
    S.lastShot = S.now;
    S.shots++;
    S.arrows.push({
      x: bx, y: by, sx: bx, sy: by, tx: x, ty: y,
      vx: (x - bx) / d * ARROW_SPD, vy: (y - by) / d * ARROW_SPD,
      len: d, gone: 0, hit: false,
    });
    return true;
  }

  // 화살이 꽂혔다 — **곁에 있는 참새가 «다 같이» 맞는다**
  // ⚠️ 맞은 참새는 **그 자리에서 «팡» 하고 사라진다** (날아가는 연출이 아니다) —
  // 타격감은 「없어지는 순간」에서 나온다. 제 발로 가는 참새(`leave`)만 날아간다
  function land(a) {
    a.hit = true;
    a.shake = S.now;                     // 꽂히고 잠깐 떨린다
    let n = 0, lx = a.tx, ly = a.ty;
    for (const b of S.birds) {
      if (b.state === 'flee' || b.state === 'leave' || b.dead) continue;
      if (Math.hypot(b.x - a.tx, b.y - a.ty) > HIT_R) continue;
      b.dead = true;                     // 바로 치운다 (아래 필터가 걷어낸다)
      S.scared++; n++;
      lx = b.x; ly = b.y;
      pop(b.x, b.y);                     // 팡!
      burst(b.x, b.y);                   // 깃털
    }
    S.birds = S.birds.filter(b => !b.dead);
    // ─── 콤보 ───
    // ⚠️ **빗맞히면 끊긴다** — 안 끊으면 2분 내내 숫자만 오르는 장식이 된다
    if (n) {
      if (S.now - S.comboAt > COMBO_MS) S.combo = 0;
      S.combo += n;
      S.comboAt = S.now;
      if (S.combo > S.comboBest) S.comboBest = S.combo;
      if (n > 1) S.multi[n] = (S.multi[n] || 0) + 1;
      S.points += n * n;                 // ⚠️ **제곱** — 한 발에 다섯이면 25점이다
      floater(lx, ly, n);
    } else {
      S.combo = 0;
    }
    if (window.Sfx && n) Sfx.play(n > 1 ? 'success' : 'tap');
    return n;
  }

  // 깃털 — ⚠️ **연출은 «상태 수»로 잰다** (돌깨기의 파편과 같다). 그냥 사라지면
  // 「맞혔다」가 안 읽히고, 검사도 점수만 보면 연출을 통째로 지워도 통과한다
  function burst(x, y) {
    for (let i = 0; i < FEATHER_PER; i++) {
      S.feathers.push({
        x, y, born: S.now,
        vx: rnd(-0.16, 0.16), vy: rnd(-0.20, -0.02),
        rot: Math.random() * 6.28, spin: rnd(-0.008, 0.008),
      });
    }
  }

  // 「팡!」 — 퍼지는 고리 하나 + 사방으로 튀는 불똥
  function pop(x, y) {
    const sparks = [];
    for (let i = 0; i < SPARK_PER; i++) {
      const ang = (i / SPARK_PER) * 6.283 + rnd(-0.25, 0.25);
      const sp = rnd(0.10, 0.22);
      sparks.push({ ang, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: rnd(5, 11) });
    }
    S.pops.push({ x, y, born: S.now, sparks });
  }

  // 맞힌 수를 그 자리에 띄운다 — 하나면 `+1`, 둘 이상이면 멀티킬 이름
  function floater(x, y, n) {
    S.floats.push({
      x, y: y - 6, born: S.now, n,
      text: n > 1 ? T('sw_multi_' + Math.min(n, 5)) : '+1',
      big: n > 1,
    });
  }

  // ─── 한 프레임 ───
  function step(ts) {
    if (!S || S.over) return;
    if (!S.t0) { S.t0 = ts; S.last = ts; }
    const dt = Math.min(50, ts - S.last);   // 백그라운드였다 오면 크게 튄다 — 잘라 준다
    S.last = ts; S.now = ts;
    const elapsed = ts - S.t0;

    tick(dt, elapsed);
    draw(elapsed);

    if (elapsed >= DUR_MS) { finish(); return; }
    raf = requestAnimationFrame(step);
  }

  function tick(dt, elapsed) {
    const { w, h } = S;
    const prog = clamp(elapsed / DUR_MS, 0, 1);

    // 스폰 — **뒤로 갈수록 떼로 온다**
    S.nextSpawn -= dt;
    if (S.nextSpawn <= 0) {
      const live = S.birds.filter(b => b.state === 'in' || b.state === 'perch').length;
      if (live < MAX_BIRDS) {
        const flockP = FLOCK_BASE + (FLOCK_TOP - FLOCK_BASE) * prog;
        // 떼의 크기도 «뒤로 갈수록» 커진다 — 끝에는 다섯까지
        const maxK = 2 + Math.floor(prog * 3.99);
        const k = Math.random() < flockP ? 2 + Math.floor(Math.random() * (maxK - 1)) : 1;
        const room = Math.min(k, MAX_BIRDS - live);
        const lead = spawnBird(elapsed);
        S.birds.push(lead);
        // ⚠️ **한 발에 들어오게 모은다** — 앉을 자리를 대장 둘레로 돌려 놓는다
        for (let i = 1; i < room; i++) {
          const b = spawnBird(elapsed);
          const ang = (i / room) * 6.283 + Math.random() * 0.7;
          const r = FLOCK_R * (0.55 + Math.random() * 0.45);
          b.px = clamp(lead.px + Math.cos(ang) * r, PAD + BIRD_R, w - PAD - BIRD_R);
          b.py = clamp(lead.py + Math.sin(ang) * r * 0.72, h * FIELD_TOP, h * FIELD_BOT);
          b.x = lead.x; b.y = lead.y - rnd(6, 22);      // 같은 쪽에서 같이 날아든다
          b.flip = lead.flip;
          S.birds.push(b);
        }
      }
      S.nextSpawn = SPAWN_START - (SPAWN_START - SPAWN_MIN) * prog;
    }

    // 참새
    for (const b of S.birds) {
      if (b.state === 'in') {
        const k = clamp((S.now - b.born) / FLY_MS, 0, 1);
        b.x = b.x + (b.px - b.x) * (1 - Math.pow(1 - k, 3)) * 0.35;
        b.y = b.y + (b.py - b.y) * (1 - Math.pow(1 - k, 3)) * 0.35;
        if (k >= 1) { b.x = b.px; b.y = b.py; b.state = 'perch'; b.perchAt = S.now; b.nextHop = S.now + HOP_MS; }
      } else if (b.state === 'perch') {
        // 이따금 옆 이삭으로 폴짝 — 날아가는 화살이 «빗나갈» 수 있어야 조준이 된다
        if (S.now >= b.nextHop) {
          // **옆 이삭으로** 옮겨 앉는다 — 허공으로 뛰면 앉은 것으로 안 보인다
          const ear = pickEar();
          if (ear && Math.abs(ear.x - b.px) < HOP_D * 2.2) { b.px = ear.x; b.py = ear.y; }
          else {
            b.px = clamp(b.px + rnd(-HOP_D, HOP_D), PAD + BIRD_R, w - PAD - BIRD_R);
            b.py = clamp(b.py + rnd(-HOP_D, HOP_D) * 0.5, h * FIELD_TOP, h * FIELD_BOT);
          }
          b.nextHop = S.now + HOP_MS + rnd(0, 320);
        }
        b.x += (b.px - b.x) * 0.55;
        b.y += (b.py - b.y) * 0.55;
        // 시간이 다 되면 **제 발로** 날아간다 — ⚠️ 놓친 것일 뿐 **가진 것은 안 줄어든다**
        if (S.now - b.perchAt >= b.stayFor) {
          b.state = 'leave'; b.gone = S.now; S.missed++;
          b.vx = b.flip * rnd(0.08, 0.14); b.vy = -rnd(0.10, 0.18);
        }
      } else {
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
    }
    S.birds = S.birds.filter(b =>
      (b.state !== 'flee' && b.state !== 'leave') || S.now - b.gone < FLEE_MS * 2);

    // 화살 — 누른 «자리»까지 날아가서 꽂힌다
    for (const a of S.arrows) {
      if (a.hit) { a.gone += dt; continue; }
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (Math.hypot(a.x - a.sx, a.y - a.sy) >= a.len) { a.x = a.tx; a.y = a.ty; land(a); }
    }
    S.arrows = S.arrows.filter(a => !a.hit || a.gone < 1400);

    // 깃털
    for (const f of S.feathers) {
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vy += 0.00022 * dt;               // 천천히 가라앉는다 (깃털이라 가볍게)
      f.rot += f.spin * dt;
    }
    S.feathers = S.feathers.filter(f => S.now - f.born < FEATHER_MS);

    // 팡 · 플로터 — 시간이 지나면 걷어낸다
    S.pops = S.pops.filter(p => S.now - p.born < POP_MS);
    for (const f of S.floats) f.y -= 0.032 * dt;          // 떠오른다
    S.floats = S.floats.filter(f => S.now - f.born < FLOAT_MS);
    // 콤보는 **쉬어도** 끊긴다 (빗맞히는 것과 같은 규칙이다)
    if (S.combo && S.now - S.comboAt > COMBO_MS) S.combo = 0;
  }

  // ─── 그리기 ─────────────────────────────────────────────────
  function sky() {
    const { w, h } = S;
    const g = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.55, SKY_MID); g.addColorStop(1, SKY_BOT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 해 — 지평선에 걸려 있다 (그래서 «노을»이다)
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.fillStyle = SUN;
    ctx.beginPath(); ctx.arc(w * 0.74, h * 0.44, Math.min(w, h) * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.arc(w * 0.74, h * 0.44, Math.min(w, h) * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 구름 띠 — 납작하게 몇 줄만 (플랫 2D 라 뭉게구름을 안 그린다)
    ctx.save();
    ctx.fillStyle = CREAM;
    for (let i = 0; i < 4; i++) {
      const cy = h * (0.08 + i * 0.075), cw = w * (0.22 + (i % 3) * 0.12);
      const cx = ((i * 137) % 100) / 100 * w;
      ctx.globalAlpha = 0.10 + (i % 2) * 0.05;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw / 2, 4 + (i % 2) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 밭 — ⚠️ **줄기만 그으면 밭이 아니라 «막대기 몇 개»다** (찍어 보고 알았다).
    // 지평선 아래를 통째로 익은 빛으로 깔고, 그 위에 줄기와 이삭이 선다
    const fg = ctx.createLinearGradient(0, h * HORIZON, 0, h);
    fg.addColorStop(0, '#d79a45'); fg.addColorStop(0.55, '#b9762f'); fg.addColorStop(1, GROUND);
    ctx.fillStyle = fg;
    ctx.fillRect(0, h * HORIZON, w, h * (1 - HORIZON));
  }

  // 밀 — 줄기 하나에 이삭 하나. 바람에 아주 느리게 흔들린다.
  // ⚠️ **이삭이 작으면 밀이 아니라 «민들레»로 보인다** (찍어 보고 알았다) — 머리를
  // 길고 도톰하게, 끝에 까끄라기 두어 개를 세워야 한눈에 밀이다
  function wheat(layer) {
    const near = layer === 1;
    const col = near ? WHEAT_NEAR : WHEAT_FAR;
    const er = near ? 5.4 : 4.0, eh = near ? 15 : 11;     // 이삭 반폭 · 반높이
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of S.stalks) {
      if (s.layer !== layer) continue;
      const len = s.base - s.top;
      const sway = Math.sin(S.now / 1600 + s.ph * 6.28) * (near ? 5 : 3);
      const topX = s.x + s.lean * len + sway, topY = s.top;
      ctx.strokeStyle = col; ctx.lineWidth = near ? 2.4 : 1.7;
      ctx.beginPath();
      ctx.moveTo(s.x, s.base);
      ctx.quadraticCurveTo(s.x + sway * 0.4, s.base - len * 0.6, topX, topY);
      ctx.stroke();
      ctx.save();
      ctx.translate(topX, topY);
      ctx.rotate(s.lean + sway * 0.012);
      // 까끄라기 — 머리 끝에서 뻗는 가는 선 셋 (밀의 표시다)
      ctx.strokeStyle = col; ctx.lineWidth = near ? 1.2 : 0.9;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * er * 0.5, -eh * 0.9);
        ctx.lineTo(k * er * 1.5, -eh * 1.7);
        ctx.stroke();
      }
      // 머리 — 알갱이를 그리지 않고 «통짜 타원» 하나다 (플랫 2D 의 결)
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -eh * 0.55, er, eh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WHEAT_DARK; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.ellipse(-er * 0.42, -eh * 0.55, er * 0.42, eh * 0.86, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 참새 — 납작한 몸 + 어두운 날개 + 부리와 눈. 날 때만 날개가 퍼덕인다
  function bird(b) {
    const flying = b.state !== 'perch';
    // 앉아 있을 때는 이따금 «쪼는» 동작 (고개를 내린다)
    const peck = b.state === 'perch' ? Math.max(0, Math.sin(S.now / 420 + b.ph)) * 3.2 : 0;
    const flap = flying ? Math.sin(S.now / 70 + b.ph) : 0;
    const dir = b.state === 'perch' ? (b.flip || 1) : (b.vx >= 0 ? 1 : -1);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(dir, 1);
    if (flying) ctx.rotate(clamp((b.vy || 0) * 0.8, -0.35, 0.35));
    // 꼬리
    ctx.fillStyle = BIRD_WING;
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(-19, -4 + peck * 0.3); ctx.lineTo(-18, 3); ctx.closePath();
    ctx.fill();
    // 몸통
    ctx.fillStyle = BIRD_BODY;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 8.4, 0, 0, Math.PI * 2); ctx.fill();
    // 배 — 밝은 쪽을 아래에 (부피가 생긴다)
    ctx.fillStyle = BIRD_BELLY;
    ctx.beginPath(); ctx.ellipse(1, 3, 7.2, 4.6, 0, 0, Math.PI * 2); ctx.fill();
    // 날개
    ctx.fillStyle = BIRD_WING;
    ctx.save();
    ctx.translate(-1, -1.5);
    ctx.rotate(flap * 0.7);
    ctx.beginPath(); ctx.ellipse(0, 0, 8.4, 4.2, -0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 머리 — 쪼을 때 내려간다
    const hx = 8.5, hy = -5 + peck;
    ctx.fillStyle = BIRD_HEAD;
    ctx.beginPath(); ctx.arc(hx, hy, 6.2, 0, Math.PI * 2); ctx.fill();
    // 부리
    ctx.fillStyle = BEAK;
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy + 0.4); ctx.lineTo(hx + 11.5, hy + 2.4); ctx.lineTo(hx + 5, hy + 3.6);
    ctx.closePath(); ctx.fill();
    // 눈
    ctx.fillStyle = '#20160c';
    ctx.beginPath(); ctx.arc(hx + 2.2, hy - 1.2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 화살 — ⚠️ **선 하나에 삼각형을 붙이면 «힘»이 하나도 안 보인다** (신고받은 자리다).
  // 셋을 같이 줘야 «꽂힌다»로 읽힌다:
  //   ① **날아가는 쪽에 속도선** — 정지 그림이 아니라 «지금 가고 있는 것»이 된다
  //   ② **촉이 길고 «미늘»이 있다** — 끝이 뾰족한 것이 아니라 «파고드는» 모양이다
  //   ③ **화살대가 앞으로 갈수록 굵다** — 균일한 선은 이쑤시개로 보인다
  function arrow(a) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.hit) {
      // 꽂힌 화살 — 밭에 «떨며» 서고 천천히 사라진다.
      // ⚠️ 떨림이 없으면 그냥 «놓인» 것으로 보인다 — 박히는 맛이 여기서 난다
      const t = S.now - (a.shake || 0);
      const wob = t < 260 ? Math.sin(t / 22) * (1 - t / 260) * 0.16 : 0;
      ctx.globalAlpha = Math.max(0, 1 - a.gone / 1400);
      ctx.rotate(ang - Math.PI / 2 + 0.22 + wob);
    } else {
      ctx.rotate(ang);
      // ① 속도선 — 뒤로 흐른다
      ctx.strokeStyle = 'rgba(255,241,218,0.45)'; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.lineWidth = i ? 1.1 : 1.8;
        ctx.beginPath();
        ctx.moveTo(-20 - Math.abs(i) * 6, i * 3.2);
        ctx.lineTo(-38 - Math.abs(i) * 10, i * 4.6);
        ctx.stroke();
      }
    }
    // ③ 화살대 — 앞이 굵은 사다리꼴
    ctx.fillStyle = SHAFT;
    ctx.beginPath();
    ctx.moveTo(-17, -1.1); ctx.lineTo(9, -1.9); ctx.lineTo(9, 1.9); ctx.lineTo(-17, 1.1);
    ctx.closePath(); ctx.fill();
    // ② 촉 — 길고 «미늘»이 있다
    ctx.fillStyle = HEAD_M;
    ctx.beginPath();
    ctx.moveTo(22, 0);                       // 끝
    ctx.lineTo(7.5, -4.6);                   // 어깨
    ctx.lineTo(10.5, 0);                     // 미늘이 파고드는 자리
    ctx.lineTo(7.5, 4.6);
    ctx.closePath(); ctx.fill();
    // 촉의 «날» — 위쪽만 밝게 하면 쇠붙이로 읽힌다 (플랫 2D 의 두 톤)
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(22, 0); ctx.lineTo(7.5, -4.6); ctx.lineTo(10.2, -1.4);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= 0.55;
    // 깃 — 뒤로 «누운» 셋
    ctx.fillStyle = FLETCH;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-17, sgn * 1.1);
      ctx.quadraticCurveTo(-13, sgn * 6.4, -6.5, sgn * 5.2);
      ctx.lineTo(-8.5, sgn * 0.8);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#c4522f';               // 가운데 깃은 한 톤 어둡게 (부피)
    ctx.beginPath();
    ctx.moveTo(-17, 0); ctx.lineTo(-9.5, -1.5); ctx.lineTo(-9.5, 1.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 「팡!」 — 퍼지는 고리 + 튀는 불똥 + 한 순간의 섬광
  function popFx(p) {
    const k = (S.now - p.born) / POP_MS;
    if (k > 1) return;
    const e = 1 - Math.pow(1 - k, 3);              // 빠르게 퍼지고 천천히 멎는다
    ctx.save();
    // 섬광 — 맨 처음 한 순간만. ⚠️ **밭이 밝아서 옅게 두면 아무것도 안 터진 것처럼 보인다**
    if (k < 0.42) {
      const fk = 1 - k / 0.42;
      ctx.globalAlpha = fk;
      ctx.fillStyle = '#fff6e6';
      ctx.beginPath(); ctx.arc(p.x, p.y, 17 * fk + 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fk * 0.7;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 25 * fk + 10, 0, Math.PI * 2); ctx.fill();
    }
    // 고리 — **두 겹**이라야 «퍼지는 것»으로 읽힌다 (한 겹은 그냥 동그라미다)
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6 + e * 32, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = Math.max(0, 1 - k) * 0.55;
    ctx.strokeStyle = '#ff9a4d'; ctx.lineWidth = 3 * (1 - k) + 0.8;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + e * 20, 0, Math.PI * 2); ctx.stroke();
    // 불똥
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff1da'; ctx.lineWidth = 3.2 * (1 - k) + 0.8;
    for (const s of p.sparks) {
      const d = e * 34, x = p.x + s.vx * d * 4.4, y = p.y + s.vy * d * 4.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(s.ang) * s.len * (1 - k), y + Math.sin(s.ang) * s.len * (1 - k));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 플로터 — ⚠️ **캔버스 글자는 대비 검사가 못 본다.** 밭이 밝아서 흰 글자만 두면
  // 통째로 묻힌다 (호두 게임의 「어두운 알약 위에 얹는다」와 같은 자리다) — 굵은 테두리를 두른다
  function floatFx(f) {
    const k = (S.now - f.born) / FLOAT_MS;
    if (k > 1) return;
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    const pop = k < 0.16 ? 1 + (0.16 - k) * 2.4 : 1;    // 뜨는 순간 «툭» 커진다
    ctx.translate(f.x, f.y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${f.big ? 21 : 17}px system-ui, -apple-system, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(48,22,8,0.92)'; ctx.lineWidth = f.big ? 5.5 : 4.5;
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.big ? '#ffd76a' : '#fff6e6';
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }

  // 콤보 — **×2 부터만** 뜬다 (×1 은 뜻이 없다). 오를 때마다 «툭» 커진다
  function comboFx() {
    if (S.combo < 2) return;
    const since = S.now - S.comboAt;
    const k = clamp(since / COMBO_MS, 0, 1);
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;     // 끊기기 직전에 옅어진다
    const pop = since < 180 ? 1 + (1 - since / 180) * 0.45 : 1;
    ctx.translate(S.w - 18, S.h * HORIZON - 26);
    ctx.scale(pop, pop);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(48,22,8,0.92)'; ctx.lineWidth = 6;
    ctx.strokeText(`×${S.combo}`, 0, 0);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(`×${S.combo}`, 0, 0);
    ctx.restore();
  }

  // 활 — **당기는 동안 휜다.** 쿨다운을 글자가 아니라 그림으로 말한다
  function bow() {
    const { w, h } = S;
    const x = w / 2, y = h * BOW_Y;
    const k = clamp((S.now - S.lastShot) / SHOT_MS, 0, 1);   // 0 = 방금 쐈다
    const pull = (1 - k) * 7;
    ctx.save();
    ctx.translate(x, y);
    // 활 — ⚠️ **작으면 안 보인다.** 밭이 밝아서 가는 선은 통째로 묻힌다 (찍어 보고 키웠다)
    // 활채 — **리커브**다. 끝이 바깥으로 젖혀져야 «당겨진 힘»이 보인다 (곧은 활은 막대다).
    // ⚠️ **테두리를 먼저 깔지 않으면 밝은 밭에 묻힌다** (찍어 보고 알았다) — 세 겹이다:
    // 짙은 테두리 → 활채 → 볕 드는 쪽 하이라이트
    const limb = (wd, col, dy) => {
      ctx.strokeStyle = col; ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(-42, 30);
      ctx.bezierCurveTo(-36, -16 - pull + dy, -17, -36 - pull + dy, 0, -36 - pull + dy);
      ctx.bezierCurveTo(17, -36 - pull + dy, 36, -16 - pull + dy, 42, 30);
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    limb(11, 'rgba(48,22,8,0.55)', 0);                      // 테두리
    limb(7.5, '#8c5a28', 0);                                // 활채
    limb(3, '#e8b45c', -1.6);                               // 볕 드는 쪽
    // 손잡이 — 가죽을 «감은» 자리라 띠 둘이다 (덩어리 하나면 혹으로 보인다)
    ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-7, -35 - pull); ctx.lineTo(7, -35 - pull); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = 1.4;
    for (const gx of [-3.5, 0.5]) {
      ctx.beginPath(); ctx.moveTo(gx, -40 - pull); ctx.lineTo(gx + 2, -30 - pull); ctx.stroke();
    }
    // 시위 — 당길수록 «뾰족하게» 접힌다 (곡선으로 두면 늘어진 줄로 보인다)
    ctx.strokeStyle = BOW_STR; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-42, 30); ctx.lineTo(0, 2 + pull * 2.8); ctx.lineTo(42, 30);
    ctx.stroke();
    // 시위에 걸린 화살 — **다 당겨졌을 때만** 보인다. 「지금 쏠 수 있다」를 그림이 말한다
    if (k >= 1) {
      ctx.fillStyle = SHAFT;
      ctx.beginPath();
      ctx.moveTo(-1.6, 18); ctx.lineTo(1.6, 18); ctx.lineTo(2.2, -18); ctx.lineTo(-2.2, -18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = HEAD_M;
      ctx.beginPath();
      ctx.moveTo(0, -30); ctx.lineTo(-4.6, -15.5); ctx.lineTo(0, -18.5); ctx.lineTo(4.6, -15.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = FLETCH;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * 1.4, 18);
        ctx.quadraticCurveTo(sgn * 6.4, 14, sgn * 5.2, 7.5);
        ctx.lineTo(sgn * 1, 9.5);
        ctx.closePath(); ctx.fill();
      }
    } else if (k > 0.86) {
      // 막 쏜 직후의 «시위 튕김» — 한 순간만 번쩍인다
      ctx.strokeStyle = 'rgba(255,246,230,0.9)'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-42, 30); ctx.lineTo(0, -6); ctx.lineTo(42, 30); ctx.stroke();
    }
    ctx.restore();
  }

  function feather(f) {
    const k = (S.now - f.born) / FEATHER_MS;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = BIRD_BELLY;
    ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!S) return;
    ctx.clearRect(0, 0, S.w, S.h);
    sky();
    wheat(0);                                   // 뒤쪽 밀
    // ⚠️ **참새는 두 겹 사이에 선다** — 앞쪽 밀에 반쯤 가려야 「밭에 앉아 있다」로 읽힌다
    for (const b of S.birds) bird(b);
    wheat(1);                                   // 앞쪽 밀
    for (const a of S.arrows) arrow(a);
    for (const f of S.feathers) feather(f);
    for (const p of S.pops) popFx(p);
    bow();
    // ⚠️ **글자는 제일 위에 그린다** — 밀·활 밑에 깔리면 못 읽는다
    for (const f of S.floats) floatFx(f);
    comboFx();
    const el = host && host.querySelector('.sw-n');
    if (el) el.textContent = String(S.scared);
  }

  // ─── 끝내기 ─────────────────────────────────────────────────
  function finish() {
    if (!S || S.over) return;
    S.over = true;
    cancelAnimationFrame(raf);
    clearTimeout(timerT);
    // **«점»을 재료로 바꾼다** — 멀티킬이 제곱으로 들어와 있다
    const n = Math.min(REWARD_MAX, Math.floor(S.points / REWARD_PER));
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
      const it = (D && D.INGREDIENTS && D.INGREDIENTS[id]) || { emoji: '🌾', name: id };
      return `<span class="sw-item">${it.emoji} ${N(id, it.name)} ×${counts[id]}</span>`;
    }).join('');
    const box = host.querySelector('.sw-result');
    box.innerHTML = `
      <div class="sw-res-title">${S.scared ? T('sw_done', { n: S.scared }) : T('sw_none')}</div>
      <div class="sw-res-items">${rows || `<span class="sw-item">${T('sw_none')}</span>`}</div>
      <button class="btn sw-close">${T('sw_close')}</button>`;
    box.classList.add('show');
    box.querySelector('.sw-close').onclick = () => close();
  }

  let onEndCb = null;
  function close() {
    const picked = S ? S.picked.slice() : [];
    const scared = S ? S.scared : 0;
    teardown();
    if (onEndCb) { const cb = onEndCb; onEndCb = null; cb({ picked, cleared: false, score: scared }); }
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
    if (S) return;                               // 이미 돌고 있으면 무시
    onEndCb = onEnd || null;
    const pool = (map && map.pool) || ['wheat'];
    const specialId = (map && map.special) || null;

    host = document.createElement('div');
    host.id = 'sparrowGame';
    const title = map ? `${map.emoji} ${N(map.id, map.name)}` : T('sw_title');
    host.innerHTML = `
      <div class="sw-stage">
        <canvas class="sw-canvas"></canvas>
        <div class="sw-hud">
          <span class="sw-name">${title}</span>
          <span class="sw-score">🐦 <b class="sw-n">0</b></span>
          <span class="sw-timer">0:30</span>
        </div>
        <div class="sw-tbar"><i></i></div>
        <div class="sw-hint">${T('sw_hint')}</div>
        <div class="sw-result"></div>
      </div>`;
    document.body.appendChild(host);

    cv = host.querySelector('.sw-canvas');
    ctx = cv.getContext('2d');
    S = newState(pool, specialId);
    fit();
    window.addEventListener('resize', fit);

    // ─── 손가락 ───
    // **누른 자리로 쏜다.** ⚠️ 쿨다운 판정을 여기서 한 번 더 하지 않는다 —
    // 문이 둘이면 사보타주가 안 걸린다 (`shoot()` 한 곳이다)
    cv.addEventListener('pointerdown', e => {
      if (!S || S.over) return;
      const r = cv.getBoundingClientRect();
      shoot(e.clientX - r.left, e.clientY - r.top);
      e.preventDefault();
    });
    cv.style.touchAction = 'none';

    // 남은 시간
    // 남은 시간 — ⚠️ **30초짜리에서는 숫자만으로 부족하다.** 크게 띄우고, 줄어드는
    // **막대**를 같이 두고, 마지막 10초는 붉게 뛴다 (「잘 보이게」로 신고받은 자리다)
    const timerEl = host.querySelector('.sw-timer');
    const barEl = host.querySelector('.sw-tbar');
    const fillEl = host.querySelector('.sw-tbar > i');
    const tickUI = () => {
      if (!S || S.over) return;
      const left = Math.max(0, DUR_MS - (S.now && S.t0 ? S.now - S.t0 : 0));
      const sec = Math.ceil(left / 1000);
      timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      fillEl.style.width = (left / DUR_MS * 100).toFixed(1) + '%';
      const hurry = left <= HURRY_MS;
      timerEl.classList.toggle('hurry', hurry);
      barEl.classList.toggle('hurry', hurry);
      timerT = setTimeout(tickUI, 100);
    };
    tickUI();

    raf = requestAnimationFrame(step);
  }

  // 검사용 구멍 — **캔버스 안은 DOM 이 아니라 `checkUI()` 가 못 본다**
  function boardState() {
    if (!S) return null;
    return {
      scared: S.scared, missed: S.missed, shots: S.shots, over: S.over,
      arrows: S.arrows.length, feathers: S.feathers.length,
      pops: S.pops.length, floats: S.floats.map(f => f.text), points: S.points,
      combo: S.combo, comboBest: S.comboBest, multi: S.multi,
      w: S.w, h: S.h,
      birds: S.birds.map(b => ({ id: b.id, x: b.x, y: b.y, state: b.state })),
    };
  }

  window.Sparrow = {
    start, boardState,
    // 검사용 — 손가락 없이 참새를 세우거나 쏘거나
    _spawn: () => { if (S && !S.over) { S.birds.push(spawnBird(S.now - S.t0)); return true; } return false; },
    _perch: (x, y) => {                          // 참새 하나를 «그 자리에» 앉혀 둔다
      if (!S || S.over) return null;
      const b = spawnBird(S.now - S.t0);
      b.x = b.px = x; b.y = b.py = y;
      b.state = 'perch'; b.perchAt = S.now; b.nextHop = S.now + 9e9; b.stayFor = 9e9;
      S.birds.push(b);
      return b.id;
    },
    _shoot: (x, y) => shoot(x, y),
    _tick: dt => { if (S && !S.over) tick(dt, S.now - S.t0); },   // 한 프레임만 (떼 검사용)
    _finish: () => finish(),
    _state: () => S,
    isPlaying: () => !!S,
    REWARD_PER, REWARD_MAX, DUR_MS, SHOT_MS, HIT_R, ARROW_SPD, FLOCK_R,
    SPAWN_START, SPAWN_MIN, STAY_START, STAY_MIN, MAX_BIRDS, FLY_MS,
  };
})();
