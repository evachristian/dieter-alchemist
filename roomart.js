// ═══════════════════════════════════════════════════════════════
//  roomart.js — 방과 소품의 «그림» (window.RoomArt)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **여기가 방 그림의 «유일한» 곳이다.** 3D 방(`room3d.js`)은 이 캔버스를
// 텍스처로 굽고, SVG 폴백(`avatar.js` 의 `roomScene`)은 **같은 캔버스**를
// data URL 로 `<image>` 에 얹는다 — 그림이 한 곳이라 WebGL 이 없는 기기에서도
// «같은 방»이 서고, 소품을 예쁘게 고치면 두 화면에 같이 온다.
// 두 벌로 두면 한쪽만 고쳐 갈린다 (이 저장소에서 사본이 갈린 사고가 몇 번인지
// 세기도 어렵다 · `ROOM.md` 3장).
//
// ⚠️ **평범한 `<script>` 다.** `room3d.js` 는 ES 모듈이라 이 파일을 `import` 할 수
// 없고 `window.RoomArt` 로 읽는다 — 그래서 `index.html` 에서 **모듈보다 먼저** 와야
// 한다 (평범한 스크립트가 모듈보다 먼저 도는 것이 규칙이지만, 순서도 그렇게 적어 둔다).
//
// ⚠️⚠️ **`THREE` 를 여기서 부르지 않는다.** 내놓는 것은 «캔버스»이고 텍스처로
// 굽는 것은 3D 쪽 일이다 — 여기서 three 를 쓰면 이 파일이 모듈에 묶여 SVG 폴백이
// 못 쓴다 (그것이 애초에 이 파일을 가른 이유다).
(function () {
  'use strict';

  // ─── 잉크와 종이 — 네 함수가 이 게임의 «결»이다 ──────────────
  //
  // ⚠️ 예전에는 이 넷이 `room3d.js` 안에 있었다. SVG 폴백이 같은 그림을 써야 하니
  //    여기로 옮겼고, 3D 쪽은 `window.RoomArt` 에서 받아 쓴다 (사본을 안 만든다)
  const PAL = {
    ink: '#2f2230',           // 잉크 — «먹»색이다. 새까만 선은 인쇄물로 보인다
    cut: '#f7f0e2',           // 재단면 — 오려 낸 종이의 «흰 테». 이것이 곧 종이의 증거다
    leaf: ['#7fa86a', '#55794a'],
    brew: '#8ee6c8',
    dark: '#3c3540',
  };

  // ⚠️⚠️ **방은 «평면 벡터»다 — 종이의 «증거»를 안 쓴다** (2026-09-30 · 사람이 골랐다).
  //
  //    배경과 인물의 아트 컨셉이 어긋난다는 신고를 받아 시안 셋을 그려 놓고 골랐다.
  //    **고른 것은 「배경에서 종이를 걷고, 인물에 종이를 입힌다」**다 — 종이의 결은
  //    이제 **인물 한 곳**(`#pdPaper`)에만 있고, 방은 그 조각이 «앞에 서는 무대»다.
  //    (그 반대 — 인물을 방 쪽으로 끌어오는 것 — 은 실루엣이 굵어져 `checkavatar` 의
  //    못 박은 수치 열 몇 개를 같이 옮겨야 해서, 사람이 이쪽을 골랐다)
  //
  //    종이의 증거를 내던 곳이 넷이고 **넷 다 여기서 끈다** — 되돌릴 자리가 한 곳이다:
  //      ① `paperShape` 의 재단면(크림 테)  ② `paperShape` 의 조각 윤곽선
  //      ③ `grainOver` 의 잡티             ④ `blob` 의 «가위 떨림»
  //    call site 의 숫자(`cut: 7` 등)는 **종이였을 때의 몫**이라 그대로 두었다 —
  //    다시 종이로 가고 싶으면 이 넷을 1(④는 0.09)로 올리면 그 그림이 돌아온다.
  //
  // ⚠️⚠️ **`inkStroke` 는 «끄지 않는다».** 그것은 윤곽선 도구가 아니라 **그리는 도구**다 —
  //    샹들리에 팔 · 화분 줄기 · 커튼 주름 · 책등 · 돌 이음새 · 마법진이 그것으로
  //    «그려진다». 통째로 끈 시안(배경C)은 촛불이 허공에 뜨고 화분이 사라져 버렸다
  //    (그려 보고 되돌렸다). 여기서 걷는 것은 **조각의 «테»**뿐이다.
  const PAPER_CUT = 0;      // 재단면 — 0 이면 크림 테를 안 두른다
  const PAPER_INK = 0;      // 조각 윤곽선 — 0 이면 칠만 남는다
  const PAPER_GRAIN = 0;    // 종이 결(잡티) — 0 이면 안 얹는다
  const SCISSOR_W = 0;      // 가위 떨림 — blob 의 반지름이 흔들리는 폭 (종이였을 때 0.09)

  // 결정적인 잡음 — 손그림의 «떨림»을 만든다. 매번 다르면 프레임마다 지글거린다
  function rnd(seed) {
    let t = (seed * 16807) % 2147483647 || 7;
    return () => (t = t * 16807 % 2147483647) / 2147483647;
  }

  // ⚠️⚠️ **선 굵기는 «픽셀»이 아니라 «세상의 길이»로 정해야 한다.**
  //    카드마다 텍스처 해상도가 달라서(벽 1024px/9.6칸 · 책장 640px/2.6칸) 같은 숫자 5 가
  //    화면에서 두 배 넘게 차이 났다 — 책장 선만 가늘어 종이가 아니라 «사진»으로 보인다.
  //    그리기 직전에 칸당 픽셀(PPU)을 넣어 두고, 그 값으로 환산해서 긋는다.
  const INK_REF = 100;
  let PPU = INK_REF;
  const ink2px = (n) => n * PPU / INK_REF;

  // ── 손으로 그은 잉크선 ──────────────────────────────────────
  // ⚠️⚠️ **굵기가 변해야 «그은 선»이다.** 같은 굵기로 stroke 하면 벡터 클립아트가 된다 —
  //    양 끝이 가늘고 가운데가 굵은 «붓»을 다각형으로 직접 만든다
  function inkStroke(g, pts, opt) {
    const o = Object.assign({ w: 7, close: false, jitter: 1.6, seed: 7, color: PAL.ink }, opt);
    o.w = ink2px(o.w);
    const r = rnd(o.seed);
    const p = pts.map(([x, y], i) => {
      const k = i / (pts.length - 1 || 1);
      return [x + (r() - 0.5) * o.jitter, y + (r() - 0.5) * o.jitter, k];
    });
    if (o.close) p.push([p[0][0], p[0][1], 1]);
    const L = [], R = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const t = o.close ? 1 : Math.sin(Math.PI * p[i][2]) * 0.75 + 0.35;
      const w = o.w * t * 0.5;
      L.push([p[i][0] - dy * w, p[i][1] + dx * w]);
      R.push([p[i][0] + dy * w, p[i][1] - dx * w]);
    }
    g.beginPath();
    L.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fillStyle = o.color; g.fill();
  }

  // ── 종이 카드 한 장 ────────────────────────────────────────
  // 오려 낸 종이 = **재단면(크림 테) → 칠 → 잉크선** 순서다.
  // ⚠️ 잉크선을 «먼저» 그으면 재단면이 그 위를 덮어 테만 남는다
  function bbox(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  function paperShape(g, pts, fill, opt) {
    const o = Object.assign({ cut: 9, ink: 6, seed: 3, shade: null }, opt);
    // 종이의 증거 둘은 «한 곳»에서 걷는다 (위의 「방은 평면 벡터다」)
    o.cut *= PAPER_CUT; o.ink *= PAPER_INK;
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    if (o.cut) {
      path(); g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = PAL.cut; g.lineWidth = ink2px(o.cut) * 2; g.stroke();
    }
    path(); g.fillStyle = fill; g.fill();
    if (o.shade) {
      g.save(); path(); g.clip();
      const b = bbox(pts);
      const lg = g.createLinearGradient(0, b.y0, 0, b.y1);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(1, o.shade);
      g.fillStyle = lg; g.fillRect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8);
      g.restore();
    }
    if (o.ink) inkStroke(g, pts, { w: o.ink, close: true, seed: o.seed, jitter: 1.4 });
  }
  function rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  // 모서리가 살짝 둥근 네모 — 가위로 오린 종이는 각이 날카롭지 않다
  function roundRect(x, y, w, h, r) {
    const p = [];
    const arc = (cx, cy, a0, a1) => {
      for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    };
    arc(x + w - r, y + r, -Math.PI / 2, 0); arc(x + w - r, y + h - r, 0, Math.PI / 2);
    arc(x + r, y + h - r, Math.PI / 2, Math.PI); arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    return p;
  }
  function blob(cx, cy, rx, ry, n, seed) {
    const r = rnd(seed), p = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, k = 1 + (r() - 0.5) * SCISSOR_W;
      p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return p;
  }
  // 종이결 — 아주 옅은 잡티. 지금은 안 얹는다 (위의 「방은 평면 벡터다」)
  function grainOver(g, w, h, seed, amt) {
    if (!PAPER_GRAIN) return;
    const r = rnd(seed);
    g.save(); g.globalAlpha = (amt || 0.05) * PAPER_GRAIN;
    for (let i = 0; i < w * h / 110; i++) {
      g.fillStyle = r() < 0.5 ? '#000' : '#fff';
      g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    g.restore();
  }

  // 캔버스 하나를 그려 돌려준다. ⚠️ 텍스처로 굽는 것은 부르는 쪽 일이다
  // ⚠️⚠️ **한계를 안 씌우면 «작은 카드»가 통째로 잉크가 된다** (0.86칸짜리 촛대에서
  //    선이 카드 폭의 7% 라 등잔이 «덩어리»로 보였다). 화면에서 3~4px 이 되는 띠로 자른다
  function canvasOf(w, h, draw, units) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
    PPU = units ? Math.max(70, Math.min(150, c.width / units)) : INK_REF;
    try { draw(c.getContext('2d'), c.width, c.height); } finally { PPU = INK_REF; }
    return c;
  }

  // ─── 단계 넷의 «칠» ──────────────────────────────────────────
  //
  // ⚠️⚠️ **단계는 «색과 장식의 양»이다 — 모양이 아니다.** 같은 물건의 소박한 것과
  //    럭셔리한 것이라야 「바꿨다」가 읽히고, 모양까지 갈리면 자리마다 물건 넷이 된다.
  //    `orn`(장식 단계 0~3)이 층을 더 얹는 손잡이고, 나머지는 색이다.
  // ⚠️ **왕실 단계에 «번쩍이는 금»만 쓰지 않는다** — 짙은 남보라 + 금테라야
  //    크림색 방에서 도리어 무게가 실린다 (금 일색은 장난감으로 보인다)
  const TIER_PAINT = {
    plain: { wood: '#ab8760', woodD: '#836745', woodL: '#c6a87f', metal: '#9a9ca2', metalL: '#c3c6cc',
      cloth: '#c9a08e', clothD: '#a87f6e', trim: null, gem: null, glow: '#ffcf7e', orn: 0, lum: 0.78 },
    wood: { wood: '#8a5f3c', woodD: '#5f3f26', woodL: '#b2854f', metal: '#8d8f94', metalL: '#b6b9bf',
      cloth: '#c07d92', clothD: '#98596f', trim: '#c8a05e', gem: null, glow: '#ffc25e', orn: 1, lum: 1 },
    ornate: { wood: '#6f4a70', woodD: '#4b2f50', woodL: '#9a6f9c', metal: '#d9b45f', metalL: '#f2dfa0',
      cloth: '#b85f87', clothD: '#8c3f63', trim: '#f0d28a', gem: '#8ee6c8', glow: '#ffd98e', orn: 2, lum: 1.16 },
    royal: { wood: '#463a6e', woodD: '#2d2450', woodL: '#7a63a8', metal: '#f0cf72', metalL: '#fff0bb',
      cloth: '#8e3f6e', clothD: '#5f2650', trim: '#fff0bb', gem: '#ffd9f0', glow: '#fff0c8', orn: 3, lum: 1.3 },
  };

  // ─── 벽지 다섯 · 바닥재 다섯 ─────────────────────────────────
  //
  // ⚠️ **색은 표(`D.ROOM_WALLS`·`D.ROOM_FLOORS`)가 갖는다** — 여기서 고르지 않는다.
  //    무늬만 여기 있고, 그 무늬를 두 renderer 가 같이 쓴다
  function wallArt(g, w, h, def) {
    const c = def.c || ['#d9c7a6', '#b9a184'];
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, c[0]); lg.addColorStop(1, c[1]);
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.save(); g.globalAlpha = 0.06;                      // 벽지 세로 줄
    for (let x = 0; x < w; x += w / 22) { g.fillStyle = '#fff'; g.fillRect(x, 0, w / 64, h); }
    g.restore();
    const r = rnd(1);
    for (let i = 1; i < 5; i++) {                        // 돌 이음새 (손으로 그은 것)
      const y = i * h / 5;
      inkStroke(g, [[0, y], [w * 0.33, y + (r() - 0.5) * 6], [w * 0.66, y + (r() - 0.5) * 6], [w, y]],
        { w: 3.4, seed: 3 + i, jitter: 2.4, color: def.seam });
      const off = (i % 2) ? w / 6 : 0;
      for (let k = 0; k < 3; k++) {
        const x = off + k * w / 3;
        if (x < 8 || x > w - 8) continue;
        inkStroke(g, [[x, y], [x + (r() - 0.5) * 4, y + h / 10], [x, y + h / 5]],
          { w: 3, seed: 7 + i * 4 + k, jitter: 2, color: def.seam });
      }
    }
    // 천장 쪽 그늘 — 위가 어두워야 방이 «상자»로 읽힌다
    const tg = g.createLinearGradient(0, 0, 0, h * 0.62);
    tg.addColorStop(0, 'rgba(38,22,36,0.46)'); tg.addColorStop(1, 'rgba(38,22,36,0)');
    g.fillStyle = tg; g.fillRect(0, 0, w, h * 0.62);
    grainOver(g, w, h, 5, 0.05);
  }
  // 널빤지마다 «잉크 이음새»와 결이 있다. 한 색 판은 바닥이 아니라 색종이다
  function floorArt(g, w, h, def) {
    const c = def.c || ['#a9754c', '#9d6b45', '#ab7750', '#94643f'];
    g.fillStyle = c[0]; g.fillRect(0, 0, w, h);
    const r = rnd(11);
    const seam = 'rgba(40,24,14,0.55)';
    for (let i = 0; i < 8; i++) {
      const y = i * h / 8;
      g.fillStyle = c[i % c.length];
      g.fillRect(0, y, w, h / 8);
      g.save(); g.globalAlpha = 0.15;
      for (let k = 0; k < 6; k++) {
        const yy = y + 10 + r() * (h / 8 - 20);
        inkStroke(g, [[0, yy], [w * 0.4, yy + (r() - 0.5) * 8], [w, yy + (r() - 0.5) * 10]],
          { w: 2.4, seed: i * 9 + k + 1, jitter: 3, color: seam });
      }
      g.restore();
      inkStroke(g, [[0, y], [w * 0.5, y + 1.5], [w, y]], { w: 4, seed: i + 3, jitter: 2, color: seam });
      const off = (i % 2) ? w * 0.42 : w * 0.08;
      [off, off + w * 0.5].forEach((x, j) => {
        inkStroke(g, [[x, y + 2], [x + 1.5, y + h / 16], [x, y + h / 8 - 2]],
          { w: 3, seed: i * 5 + j + 2, jitter: 1.4, color: seam });
      });
    }
    grainOver(g, w, h, 5, 0.07);
  }

  // ─── 소품 아홉 — 자리마다 «한 함수»가 단계 넷을 다 그린다 ─────
  //
  // ⚠️⚠️ **자리마다 그림 넷을 따로 두지 않는다.** 그러면 서른여섯 벌이 되고,
  //    「촛불의 불꽃을 예쁘게」 같은 고침이 반드시 한 벌을 빠뜨린다.
  //    한 함수가 `t`(단계의 칠)를 받아 그린다 — 축 표에서 뽑는 그 규칙 그대로다.
  const SLOT_ART = {
    // ── 러그 — «위에서 내려다본» 종이. 3D 는 바닥에 깔고 SVG 는 상자에 눌러 넣는다
    //    (눌러 넣으면 원이 타원이 되는데, 그것이 곧 원근 단축이라 자리가 맞는다)
    rug(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const c = w / 2, R = w / 2 - 16;
      const rings = [[R, t.cloth, 1, 10], [R * 0.79, t.clothD, 2, 0], [R * 0.62, t.cloth, 3, 0]];
      if (t.orn >= 1) rings.push([R * 0.44, t.trim || t.clothD, 4, 0]);
      if (t.orn >= 2) rings.push([R * 0.3, t.cloth, 5, 0]);
      rings.forEach(([rad, fill, seed, cut]) => {
        paperShape(g, blob(c, c, rad, rad, 64, seed + 30), fill, { cut, ink: 5, seed: seed + 30 });
      });
      if (t.orn >= 2) {                                  // 방사 무늬 — 장식 단계부터
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          inkStroke(g, [[c + Math.cos(a) * R * 0.34, c + Math.sin(a) * R * 0.34],
            [c + Math.cos(a) * R * 0.58, c + Math.sin(a) * R * 0.58]],
            { w: 5, seed: 80 + i, jitter: 1, color: t.trim || t.metalL });
        }
      }
      if (t.orn >= 3) paperShape(g, blob(c, c, R * 0.16, R * 0.16, 24, 9), t.gem, { cut: 0, ink: 4, seed: 9 });
      for (let i = 0; i < 48; i++) {                     // 술
        const a = i / 48 * Math.PI * 2;
        inkStroke(g, [[c + Math.cos(a) * R, c + Math.sin(a) * R],
          [c + Math.cos(a) * (R + 12), c + Math.sin(a) * (R + 12)]],
          { w: 4, seed: 40 + i, jitter: 1.2, color: t.orn >= 2 ? (t.trim || '#ece0cd') : '#ece0cd' });
      }
      grainOver(g, w, h, 9, 0.05);
    },

    // ── 책장 — 칸 넷 · 책 · 선반 턱. 단계가 오르면 칸이 금테를 두른다
    shelf(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      paperShape(g, roundRect(10, 10, w - 20, h - 20, 16), t.wood,
        { cut: 10, ink: 7, seed: 31, shade: 'rgba(40,20,10,0.35)' });
      const cols = ['#d4607a', '#5f95d8', '#71b389', '#dcae57', '#9a7ad0', '#d8825a'];
      const rows = 4, gap = (h - 60) / rows;
      for (let row = 0; row < rows; row++) {
        const y = 52 + row * gap;
        paperShape(g, rect(44, y, w - 88, gap - 36), t.woodD, { cut: 0, ink: 4, seed: 40 + row });
        const rr = rnd(row * 13 + 1);
        let x = 62;
        while (x < w - 82) {
          const bw = 26 + rr() * 22, bh = (gap - 40) * (0.62 + rr() * 0.3), lean = (rr() - 0.5) * 0.2;
          const by = y + gap - 38 - bh, cx = x + bw / 2;
          g.save(); g.translate(cx, y + gap - 38); g.rotate(lean); g.translate(-cx, -(y + gap - 38));
          paperShape(g, rect(x, by, bw, bh), cols[Math.floor(rr() * cols.length)],
            { cut: 4, ink: 4, seed: 50 + row * 7 + Math.round(x), shade: 'rgba(0,0,0,0.25)' });
          inkStroke(g, [[x + 6, by + 14], [x + bw - 6, by + 14]],
            { w: 3, seed: Math.round(x) + row + 1, jitter: 1, color: 'rgba(255,255,255,0.4)' });
          g.restore();
          x += bw + 5 + rr() * 6;
        }
        paperShape(g, rect(34, y + gap - 40, w - 68, 20), t.woodL, { cut: 5, ink: 5, seed: 60 + row });
        if (t.orn >= 2) inkStroke(g, [[38, y + gap - 44], [w - 38, y + gap - 44]],
          { w: 4, close: false, seed: 70 + row, jitter: 0.8, color: t.trim });
      }
      if (t.orn >= 1) {                                  // 갓머리 — 나무 단계부터
        paperShape(g, rect(18, 14, w - 36, 26), t.woodL, { cut: 5, ink: 5, seed: 33 });
      }
      if (t.orn >= 3) {                                  // 꼭대기 장식
        paperShape(g, blob(w / 2, 26, 26, 18, 20, 34), t.trim, { cut: 4, ink: 4, seed: 34 });
      }
      grainOver(g, w, h, 12, 0.06);
    },

    // ── 벽등 — 받침판 · 팔 · 접시 · 초 · 불꽃 다섯이 «다» 있어야 등잔으로 읽힌다
    //    (처음에는 네모 기둥에 노랑 조각 하나였고, 그건 벽에 붙은 «덩어리»였다)
    sconce(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const S = w / 256, X = w / 2;
      const P = (pts, fill, o) => paperShape(g, pts.map(([a, b]) => [a * S, b * S * (h / w) / (420 / 256)]), fill, o);
      P(roundRect(88, 250, 80, 152, 18), t.wood, { cut: 6, ink: 5, seed: 90, shade: 'rgba(40,20,8,0.4)' });
      inkStroke(g, [[X, 268 * S], [X, 388 * S]], { w: 3, seed: 97, jitter: 1, color: 'rgba(60,34,14,0.55)' });
      P([[104, 258], [152, 258], [160, 236], [96, 236]], t.woodL, { cut: 5, ink: 5, seed: 91 });
      P([[72, 236], [184, 236], [170, 212], [86, 212]], t.metal, { cut: 6, ink: 5, seed: 92, shade: 'rgba(60,34,14,0.3)' });
      P(roundRect(100, 96, 56, 120, 10), '#f6eddc', { cut: 6, ink: 5, seed: 93, shade: 'rgba(120,96,60,0.34)' });
      P([[100, 128], [92, 166], [101, 186], [110, 158], [110, 128]], '#fbf5e8', { cut: 0, ink: 3, seed: 94 });
      inkStroke(g, [[X, 96 * S], [X, 80 * S]], { w: 3, seed: 98, jitter: 0.6, color: PAL.ink });
      P([[128, 14], [152, 58], [148, 84], [128, 96], [108, 84], [104, 58]], '#ffc94a', { cut: 0, ink: 4, seed: 95 });
      P([[128, 42], [142, 70], [128, 88], [114, 70]], '#fff6cc', { cut: 0, ink: 0, seed: 96 });
      if (t.orn >= 2) {                                  // 유리 갓 — 장식 단계부터
        P([[74, 210], [182, 210], [168, 120], [88, 120]], 'rgba(255,240,200,0.28)', { cut: 0, ink: 3, seed: 99 });
      }
      if (t.orn >= 3) P(roundRect(96, 392, 64, 18, 8), t.trim, { cut: 4, ink: 4, seed: 89 });
    },

    // ── 탁자 — 다리 둘 · 천판. **솥은 여기 없다** (실험 도구 자리의 몫이다)
    table(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const S = w / 768, Y = h / 520;
      const P = (pts, fill, o) => paperShape(g, pts.map(([a, b]) => [a * S, b * Y]), fill, o);
      P(rect(30, 300, 54, 202), t.wood, { cut: 7, ink: 6, seed: 71, shade: 'rgba(0,0,0,0.3)' });
      P(rect(684, 300, 54, 202), t.wood, { cut: 7, ink: 6, seed: 72, shade: 'rgba(0,0,0,0.3)' });
      if (t.orn >= 1) {                                  // 가로대 — 나무 단계부터
        P(rect(84, 420, 600, 26), t.woodD, { cut: 5, ink: 5, seed: 77 });
      }
      P(roundRect(6, 250, 756, 62, 12), t.woodL, { cut: 9, ink: 7, seed: 73, shade: 'rgba(60,32,14,0.32)' });
      if (t.orn >= 2) P(rect(6, 306, 756, 14), t.trim, { cut: 0, ink: 4, seed: 78 });
      if (t.orn >= 3) {                                  // 발 — 왕실 단계
        P(roundRect(16, 482, 82, 26, 10), t.trim, { cut: 5, ink: 5, seed: 79 });
        P(roundRect(670, 482, 82, 26, 10), t.trim, { cut: 5, ink: 5, seed: 80 });
      }
      grainOver(g, w, h, 15, 0.06);
    },

    // ── 촛불 — 접시 · 초 · 촛농 · 불꽃. 광원이라 **불꽃이 제일 커야** 한다
    candle(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const S = w / 220, Y = h / 326, X = 110;
      const P = (pts, fill, o) => paperShape(g, pts.map(([a, b]) => [a * S, b * Y]), fill, o);
      P([[42, 318], [178, 318], [162, 286], [58, 286]], t.metal, { cut: 6, ink: 5, seed: 201, shade: 'rgba(60,34,14,0.3)' });
      if (t.orn >= 1) P(roundRect(84, 250, 52, 44, 10), t.metalL, { cut: 5, ink: 5, seed: 202 });
      P(roundRect(76, 118, 68, 168, 12), '#f6eddc', { cut: 6, ink: 5, seed: 203, shade: 'rgba(120,96,60,0.34)' });
      P([[76, 150], [66, 198], [78, 222], [90, 186], [90, 150]], '#fbf5e8', { cut: 0, ink: 3, seed: 204 });
      inkStroke(g, [[X * S, 118 * Y], [X * S, 96 * Y]], { w: 3, seed: 205, jitter: 0.6, color: PAL.ink });
      const fl = 1 + t.orn * 0.1;                        // 단계가 오르면 불꽃도 커진다
      P([[110, 96 - 78 * fl], [144, 40], [138, 80], [110, 100], [82, 80], [76, 40]], '#ffc94a',
        { cut: 0, ink: 4, seed: 206 });
      P([[110, 96 - 44 * fl], [128, 66], [110, 92], [92, 66]], '#fff6cc', { cut: 0, ink: 0, seed: 207 });
      if (t.orn >= 2) P(rect(76, 272, 68, 12), t.trim, { cut: 0, ink: 3, seed: 208 });
      if (t.orn >= 3) P(blob(110, 300, 14, 9, 18, 209), t.gem, { cut: 0, ink: 3, seed: 209 });
    },

    // ── 실험 도구 — **솥이 여기 있다.** 「공방」이 읽히는 자리라 김도 같이 오른다
    gear(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const S = w / 420, Y = h / 326;
      const P = (pts, fill, o) => paperShape(g, pts.map(([a, b]) => [a * S, b * Y]), fill, o);
      // 솥 — 세 발 · 배 · 아가리 · 약물
      P([[96, 300], [72, 202], [86, 150], [148, 120], [236, 120], [296, 150], [310, 202], [286, 300]],
        PAL.dark, { cut: 9, ink: 7, seed: 220, shade: 'rgba(0,0,0,0.45)' });
      P(roundRect(64, 106, 256, 36, 18), t.metal, { cut: 6, ink: 6, seed: 221 });
      P([[92, 134], [146, 116], [238, 116], [294, 134], [242, 152], [146, 152]], PAL.brew,
        { cut: 0, ink: 4, seed: 222 });
      [[132, 92, 12], [196, 68, 15], [254, 88, 10]].forEach(([x, y, rr], i) =>
        P(blob(x, y, rr, rr, 18, 230 + i), 'rgba(152,240,212,0.88)', { cut: 0, ink: 3, seed: 230 + i }));
      // 플라스크 둘 — 단계가 오르면 마개와 금테가 붙는다
      P([[342, 300], [342, 214], [358, 196], [358, 168], [392, 168], [392, 196], [408, 214], [408, 300]],
        '#cfe8f2', { cut: 7, ink: 6, seed: 240, shade: 'rgba(60,90,110,0.3)' });
      P(rect(346, 244, 58, 54), t.cloth, { cut: 0, ink: 4, seed: 241 });
      if (t.orn >= 1) P(roundRect(354, 154, 42, 18, 8), t.woodL, { cut: 4, ink: 4, seed: 242 });
      if (t.orn >= 2) P(rect(64, 142, 256, 12), t.trim, { cut: 0, ink: 4, seed: 243 });
      if (t.orn >= 3) {
        P(blob(196, 46, 13, 13, 18, 244), t.gem, { cut: 0, ink: 3, seed: 244 });
        P(roundRect(84, 292, 216, 20, 9), t.trim, { cut: 5, ink: 5, seed: 245 });
      }
      grainOver(g, w, h, 21, 0.05);
    },

    // ── 커튼 — 봉 · 좌우 자락 · 주름. **창을 덮지 않는다** (양옆으로 걷혀 있다)
    curtain(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const rodY = h * 0.045, drop = h * 0.9, half = w * 0.3;
      paperShape(g, roundRect(w * 0.01, rodY - h * 0.02, w * 0.98, h * 0.045, h * 0.02), t.woodL,
        { cut: 6, ink: 6, seed: 250, shade: 'rgba(60,32,14,0.3)' });
      [0, 1].forEach(side => {
        const x0 = side ? w - half : 0;
        // 자락 — 아래가 안쪽으로 모이는 종이 한 장
        const pts = [[x0 + (side ? half * 0.06 : 0), rodY + h * 0.03],
          [x0 + (side ? half : half * 0.94), rodY + h * 0.03],
          [x0 + (side ? half * 0.88 : half * 0.66), rodY + drop * 0.62],
          [x0 + (side ? half : half * 0.8), rodY + drop],
          [x0 + (side ? half * 0.14 : 0), rodY + drop]];
        paperShape(g, pts, t.cloth, { cut: 8, ink: 6, seed: 251 + side, shade: t.clothD });
        const n = 3 + t.orn;                              // 주름 — 단계가 오르면 촘촘해진다
        for (let i = 1; i < n; i++) {
          const k = i / n;
          const xa = x0 + (side ? half * (0.06 + k * 0.94) : half * k * 0.94);
          inkStroke(g, [[xa, rodY + h * 0.06], [xa - (side ? -1 : 1) * half * 0.05, rodY + drop * 0.6],
            [xa - (side ? -1 : 1) * half * 0.08, rodY + drop * 0.95]],
            { w: 4, seed: 260 + side * 9 + i, jitter: 2, color: t.clothD });
        }
        if (t.orn >= 1) {                                 // 허리끈
          paperShape(g, roundRect(x0 + (side ? half * 0.1 : half * 0.06), rodY + drop * 0.5,
            half * 0.82, h * 0.035, h * 0.016), t.trim || t.clothD, { cut: 4, ink: 4, seed: 270 + side });
        }
        if (t.orn >= 3) {                                 // 술 — 왕실 단계
          for (let i = 0; i < 5; i++) {
            const xa = x0 + half * (0.16 + i * 0.16);
            inkStroke(g, [[xa, rodY + drop], [xa, rodY + drop + h * 0.035]],
              { w: 5, seed: 280 + side * 7 + i, jitter: 1, color: t.trim });
          }
        }
      });
      if (t.orn >= 2) {                                   // 밸런스(윗단 천) — 장식 단계부터
        paperShape(g, [[0, rodY + h * 0.02], [w, rodY + h * 0.02], [w, rodY + h * 0.11],
          [w * 0.72, rodY + h * 0.16], [w * 0.5, rodY + h * 0.1], [w * 0.28, rodY + h * 0.16],
          [0, rodY + h * 0.11]], t.clothD, { cut: 6, ink: 5, seed: 290 });
      }
      grainOver(g, w, h, 23, 0.04);
    },

    // ── 화분 — 잎 · 항아리. 단계가 오르면 잎이 늘고 항아리에 띠가 붙는다
    winplant(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const S = w / 420, Y = h / 540;
      const P = (pts, fill, o) => paperShape(g, pts.map(([a, b]) => [a * S, b * Y]), fill, o);
      const r = rnd(8);
      const n = 6 + t.orn;
      for (let i = 0; i < n; i++) {
        const a = -1.0 + i * (2.0 / (n - 1)), L = 200 + r() * 120;
        const x2 = 210 + Math.sin(a) * L, y2 = 366 - Math.cos(a) * L;
        inkStroke(g, [[210 * S, 372 * Y], [(210 + Math.sin(a) * L * 0.5) * S, (372 - Math.cos(a) * L * 0.55) * Y],
          [x2 * S, y2 * Y]], { w: 6, seed: 150 + i, jitter: 2.6, color: PAL.leaf[1] });
        const s = 38 + r() * 22;
        P([[x2, y2 - s], [x2 + s * 0.62, y2], [x2, y2 + s * 0.7], [x2 - s * 0.62, y2]],
          i % 2 ? PAL.leaf[0] : '#95bd7c', { cut: 5, ink: 4, seed: 160 + i });
      }
      if (t.orn >= 2) {                                   // 꽃 — 장식 단계부터
        [[150, 180], [268, 152]].forEach(([x, y], i) =>
          P(blob(x, y, 26, 26, 20, 300 + i), t.cloth, { cut: 4, ink: 4, seed: 300 + i }));
      }
      P([[126, 372], [294, 372], [272, 522], [148, 522]], t.wood,
        { cut: 9, ink: 7, seed: 170, shade: 'rgba(60,24,10,0.35)' });
      P(rect(118, 358, 184, 34), t.woodL, { cut: 6, ink: 6, seed: 171 });
      if (t.orn >= 1) P(rect(134, 440, 152, 20), t.woodD, { cut: 0, ink: 4, seed: 172 });
      if (t.orn >= 3) P(rect(132, 400, 156, 16), t.trim, { cut: 0, ink: 4, seed: 173 });
      grainOver(g, w, h, 21, 0.05);
    },

    // ── 샹들리에 — **줄이 있어야 «매달린» 것이다.** 없으면 공중에 뜬 덩어리다
    chandelier(g, w, h, t) {
      g.clearRect(0, 0, w, h);
      const cx = w / 2;
      inkStroke(g, [[cx, 0], [cx, h * 0.2]], { w: 6, seed: 310, jitter: 1, color: t.metal });
      paperShape(g, blob(cx, h * 0.22, w * 0.07, h * 0.045, 18, 311), t.metalL, { cut: 4, ink: 4, seed: 311 });
      // 고리 — 단계가 오르면 한 겹 더 붙는다
      const rings = t.orn >= 2 ? [[h * 0.42, w * 0.44], [h * 0.62, w * 0.28]] : [[h * 0.46, w * 0.42]];
      rings.forEach(([ry, rx], ri) => {
        inkStroke(g, blob(cx, ry, rx, rx * 0.26, 48, 320 + ri),
          { w: 6, close: true, seed: 320 + ri, jitter: 1.4, color: t.metal });
        const arms = 6 + t.orn * 2;
        for (let i = 0; i < arms; i++) {
          const a = i / arms * Math.PI * 2;
          const x = cx + Math.cos(a) * rx, y = ry + Math.sin(a) * rx * 0.26;
          if (Math.sin(a) < -0.25) continue;             // 뒤쪽 팔은 안 그린다 (앞뒤가 읽힌다)
          paperShape(g, roundRect(x - w * 0.028, y - h * 0.1, w * 0.056, h * 0.1, w * 0.014), '#f6eddc',
            { cut: 4, ink: 4, seed: 330 + ri * 13 + i });
          paperShape(g, [[x, y - h * 0.16], [x + w * 0.026, y - h * 0.118], [x, y - h * 0.098],
            [x - w * 0.026, y - h * 0.118]], '#ffc94a', { cut: 0, ink: 3, seed: 350 + ri * 13 + i });
        }
        if (t.orn >= 1) {                                 // 늘어진 구슬
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            if (Math.sin(a) < -0.1) continue;
            const x = cx + Math.cos(a) * rx * 0.86, y = ry + Math.sin(a) * rx * 0.24;
            inkStroke(g, [[x, y], [x, y + h * 0.07]], { w: 3, seed: 370 + ri * 9 + i, jitter: 0.8, color: t.metal });
            paperShape(g, blob(x, y + h * 0.085, w * 0.016, w * 0.02, 12, 380 + i),
              t.gem || t.metalL, { cut: 0, ink: 3, seed: 380 + ri * 9 + i });
          }
        }
      });
      if (t.orn >= 3) paperShape(g, blob(cx, h * 0.8, w * 0.05, h * 0.06, 20, 390), t.trim,
        { cut: 4, ink: 4, seed: 390 });
    },
  };

  // ─── 불이 «나는 자리» — 카드 안 어디에서 빛이 나오는가 ───────
  //
  // ⚠️⚠️ **이 표가 여기 있는 이유는 «불꽃을 그리는 손»이 바로 위에 있기 때문이다.**
  //    `sconce`·`candle`·`chandelier` 가 불꽃을 칠하는 자리를 캔버스 좌표에서
  //    비율로 옮겨 적은 것이라, **불꽃을 옮기면 이 표도 같이 옮긴다.**
  //    3D 나 SVG 쪽에 적으면 사본이 둘로 갈려 한쪽만 옛 자리에 남는다
  //    (`ROOM.md` 3장 · 이 저장소에서 몇 번인지 세기도 어렵다).
  //
  //    `x`·`y` 는 **카드의 왼쪽 위를 0,0 · 폭과 높이를 1 로 본 자리**이고,
  //    `r` 은 빛이 퍼지는 반지름(**카드 폭**에 대한 비율) · `a` 는 그 세기다.
  //    그리는 것은 두 곳이다 — 3D 는 더하기(additive) 스프라이트,
  //    SVG 폴백은 같은 자리에 깐 방사형 그라디언트.
  //
  // ⚠️ **`light` 가 있는 자리는 여기에도 반드시 한 줄이 있어야 한다** —
  //    빠지면 그 소품만 «빛은 나오는데 광원은 캄캄한» 것이 된다.
  //    양쪽이 짝인지는 `checkdata` 가 본다 (표가 둘이라 한쪽만 늘어날 수 있다)
  const SLOT_GLOW = {
    // 벽등 — 불꽃이 카드 맨 위(캔버스 256×420 의 y 14~96)에 있다
    sconce:     { x: 0.50, y: 0.13, r: 2.00, a: 0.80 },
    // 촛불 — 불꽃이 캔버스 220×326 의 y 18~100. 카드가 작아 반지름 비율이 제일 크다
    candle:     { x: 0.50, y: 0.18, r: 2.60, a: 0.85 },
    // 샹들리에 — 불꽃이 «고리를 따라» 흩어져 있다(h 의 0.30~0.50). 가운데에서 크게 퍼뜨린다
    chandelier: { x: 0.50, y: 0.44, r: 1.15, a: 0.95 },
  };

  // 빛의 «색»도 한 곳이다 — 3D 는 캔버스 그라디언트로, SVG 는 `<radialGradient>` 의
  // 스톱으로 같은 줄을 읽는다. 두 벌로 적으면 한쪽만 고쳐 색이 갈린다.
  // ⚠️ 끝이 완전한 투명이라야 테두리가 안 생긴다 (더하기 합성에서는 그 테가 그대로 고리가 된다)
  const GLOW_STOPS = [
    [0.00, 'rgba(255,240,205,0.95)'],
    [0.22, 'rgba(255,206,128,0.58)'],
    [0.55, 'rgba(255,170,80,0.20)'],
    [1.00, 'rgba(255,160,70,0)'],
  ];

  // ─── 자리마다 몇 픽셀로 굽는가 ───────────────────────────────
  //
  // ⚠️ **자리 표의 칸 크기(`p3.w/h`)에서 뽑는다** — 픽셀을 자리마다 적어 두면
  //    칸을 넓혔을 때 그 소품만 흐려진다
  const PX_PER_UNIT = 230;
  function sizeOf(slot) {
    const p = (slot && slot.p3) || { w: 1, h: 1 };
    const w = Math.max(192, Math.min(800, Math.round(p.w * PX_PER_UNIT)));
    return { w, h: Math.max(96, Math.round(w * p.h / p.w)), units: p.w };
  }

  // ─── 바깥으로 내놓는 문 ───────────────────────────────────────
  //
  // ⚠️⚠️ **캔버스는 «만든 것을 들고 있는다»**(`CACHE`). 자재 한 장이 1024px 이라
  //    방을 다시 그릴 때마다 새로 구우면 첫 페인트가 그만큼 늦어지고, SVG 폴백은
  //    거기서 또 PNG 로 굽는다 (탭을 오갈 때마다 몇십 ms 가 사라지던 종류다)
  const CACHE = new Map();
  const D = () => window.GameData || {};

  // 소품 한 장 (`rp_<자리>_<단계>`) — 없는 id 면 null
  function propCanvas(id) {
    if (CACHE.has(id)) return CACHE.get(id);
    const d = (D().ROOM_DECOR || {})[id];
    if (!d || !SLOT_ART[d.slot]) return null;
    const slot = (D().roomSlot || (() => null))(d.slot);
    const t = TIER_PAINT[d.tier] || TIER_PAINT.plain;
    const s = sizeOf(slot);
    const c = canvasOf(s.w, s.h, (g, w, h) => SLOT_ART[d.slot](g, w, h, t), s.units);
    CACHE.set(id, c);
    return c;
  }
  // 벽지 한 장 — `units` 는 방의 «폭»이라 부르는 쪽이 준다
  function wallCanvas(id, w, h, units) {
    const key = `W|${id}|${w}x${h}`;
    if (CACHE.has(key)) return CACHE.get(key);
    const def = (D().ROOM_WALLS || []).find(x => x.id === id) || (D().ROOM_WALLS || [])[0];
    if (!def) return null;
    const c = canvasOf(w, h, (g, ww, hh) => wallArt(g, ww, hh, def), units);
    CACHE.set(key, c);
    return c;
  }
  function floorCanvas(id, w, h, units) {
    const key = `F|${id}|${w}x${h}`;
    if (CACHE.has(key)) return CACHE.get(key);
    const def = (D().ROOM_FLOORS || []).find(x => x.id === id) || (D().ROOM_FLOORS || [])[0];
    if (!def) return null;
    const c = canvasOf(w, h, (g, ww, hh) => floorArt(g, ww, hh, def), units);
    CACHE.set(key, c);
    return c;
  }

  // ⚠️⚠️ **SVG 폴백이 이것을 쓴다** — 캔버스를 data URL 로 굽는다.
  //    `roomScene()` 은 «문자열»을 내놓으므로 `<image href="data:…">` 말고는
  //    같은 그림을 얹을 길이 없다 (그리고 같은 그림이라야 폴백이 같은 방이다)
  // 그 id 의 그림 — 소품이면 소품 카드, 자재면 «작은 무늬 한 장»
  const MAT_TILE = 120;         // 자재 칸에 쓰는 무늬 한 장의 크기
  function canvasFor(id) {
    const d = (D().ROOM_DECOR || {})[id];
    if (!d) return null;
    if (d.slot === 'wall') return wallCanvas(id, MAT_TILE, MAT_TILE, 1.3);
    if (d.slot === 'floor') return floorCanvas(id, MAT_TILE, MAT_TILE, 1.3);
    return propCanvas(id);
  }

  const URLS = new Map();
  function url(id) {
    if (URLS.has(id)) return URLS.get(id);
    const c = canvasFor(id);
    let u = '';
    try { u = c ? c.toDataURL('image/png') : ''; } catch (e) { u = ''; }
    URLS.set(id, u);
    return u;
  }

  // 꾸미기 시트의 칸 그림 — **방에 그려지는 그림을 그대로** 쓴다 (`hairIcon` 과 같은
  // 규칙이다: 모양을 고치면 칸도 같이 바뀐다). 이모지로 두면 단계 넷이 전부 같은
  // 그림이 된다.
  // ⚠️ **자재도 «무늬»로 보여 준다** — 색 네모 하나로 두면 「장미 벽지」와 「세이지
  //    벽지」가 밝기만 다른 사각형이 되어, 무엇을 고르는지가 이름에만 남는다
  function iconSvg(id, box) {
    const b = Number(box) || 56;
    const u = url(id);
    if (!u) return '';
    const c = canvasFor(id);
    const k = Math.min(b / c.width, b / c.height);
    const w = c.width * k, h = c.height * k;
    return `<svg class="decor-icon" viewBox="0 0 ${b} ${b}" width="${b}" height="${b}" aria-hidden="true">`
      + `<image href="${u}" x="${((b - w) / 2).toFixed(1)}" y="${((b - h) / 2).toFixed(1)}"`
      + ` width="${w.toFixed(1)}" height="${h.toFixed(1)}"/></svg>`;
  }

  window.RoomArt = {
    PAL, rnd, inkStroke, paperShape, rect, roundRect, blob, grainOver, canvasOf,
    TIER_PAINT, SLOT_ART, SLOT_GLOW, GLOW_STOPS, wallArt, floorArt, sizeOf,
    propCanvas, wallCanvas, floorCanvas, canvasFor, url, iconSvg,
    // 검사기가 「몇 가지를 그렸나」를 세려면 필요하다
    slots: () => Object.keys(SLOT_ART),
  };
})();
