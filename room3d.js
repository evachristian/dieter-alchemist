// ═══════════════════════════════════════════════════════════════
//  room3d.js — 마이 룸의 방을 «종이 공작» 3D 로 그린다 (window.Room3D)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **이 파일이 세트를 만드는 «유일한» 곳이다.** 프로토타입
// (`proto/room3d.html`)도 여기를 import 해서 쓴다 — 두 벌로 두면 프로토타입에서
// 예쁘게 고친 것이 게임에 안 오거나 그 반대가 된다 (이 저장소에서 사본이 갈린
// 사고가 몇 번인지 세기도 어렵다).
//
// ⚠️⚠️ **인물·크리처는 여기 안 들어온다.** 방만 3D 고 인물은 지금 그대로 DOM 의
// SVG 다 — 그래야 옷 150벌 · 표정 서른여덟 · 체형 다섯 · 크리처 서른이 한 픽셀도
// 안 바뀐 채로 3D 공간 앞에 선다. 3D 로 다시 만드는 것은 「방을 바꾸는 일」이
// 아니라 **게임을 새로 만드는 일**이다 (`proto/README.md` 의 그 판단 그대로다).
//
// ⚠️ **그림을 만드는 것은 three.js 가 아니라 «잉크와 종이» 네 함수다**
// (`PAL` · `inkStroke` · `paperShape` · `paperCard`). 「더 예쁘게」는 저기를 고치는 일이다.
//
// ⚠️⚠️ **SVG 방(`Avatar.roomScene`)을 안 지운다.** 셋이 그것을 요구한다:
//   ① 첫 페인트 — three.js 는 670KB 다. 그것을 기다리는 동안 방이 비어 있으면
//      **첫 화면이 통째로 늦어진다** (로고를 101 → 77KB 로 줄인 저장소다)
//   ② WebGL 이 없거나 `import` 가 실패하는 기기 — 그때는 SVG 가 그대로 남는다
//   ③ 공유 이미지(`shareCard`) — 캔버스가 아니라 문자열이 필요한 자리다
//  그래서 **SVG 를 먼저 깔고, 3D 가 준비되면 그 «위»를 덮는다.**
import * as THREE from './vendor/three.module.min.js';

const PAL = {
  ink:  '#2f2230',           // 잉크 — «먹»색이다. 새까만 선은 인쇄물로 보인다
  cut:  '#f7f0e2',           // 재단면 — 오려 낸 종이의 «흰 테». 이것이 곧 종이의 증거다
  wall: ['#d9c7a6', '#b9a184'],
  wood: ['#9a6b45', '#6f4a2e'],
  woodL:['#c08d5e', '#8a5f3c'],
  cloth:['#c86a86', '#a04f6a'],
  leaf: ['#7fa86a', '#55794a'],
  brew: '#8ee6c8',
  dark: '#3c3540',
};

// 결정적인 잡음 — 손그림의 «떨림»을 만든다. 매번 다르면 프레임마다 지글거린다
export function rnd(seed) { let t = (seed * 16807) % 2147483647 || 7; return () => (t = t * 16807 % 2147483647) / 2147483647; }

// ⚠️⚠️ **선 굵기는 «픽셀»이 아니라 «세상의 길이»로 정해야 한다.**
//    카드마다 텍스처 해상도가 달라서(벽 1024px/9.6칸 · 책장 640px/2.6칸) 같은 숫자 5 가
//    화면에서 두 배 넘게 차이 났다 — 책장 선만 가늘어 종이가 아니라 «사진»으로 보인다.
//    그리기 직전에 칸당 픽셀(PPU)을 넣어 두고, 그 값으로 환산해서 긋는다.
const INK_REF = 100;                     // 기준 — 숫자 6 은 「세상에서 0.06칸 굵기」라는 뜻이다
let PPU = INK_REF;                       // 지금 그리는 텍스처의 «칸당 픽셀»
const ink2px = (n) => n * PPU / INK_REF;

// ── 손으로 그은 잉크선 ────────────────────────────────────────
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
    // 양 끝이 가늘어지는 붓 — 닫힌 선은 고르게 둔다
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

// ── 종이 카드 한 장 ──────────────────────────────────────────
// 오려 낸 종이 = **재단면(크림 테) → 칠 → 잉크선** 순서다.
// ⚠️ 잉크선을 «먼저» 그으면 재단면이 그 위를 덮어 테만 남는다
function bbox(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function paperShape(g, pts, fill, opt) {
  const o = Object.assign({ cut: 9, ink: 6, seed: 3, shade: null }, opt);
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  if (o.cut) {   // 재단면 — 굵게 한 번 긋고 그 위를 칠이 덮는다
    path(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = PAL.cut; g.lineWidth = ink2px(o.cut) * 2; g.stroke();
  }
  path(); g.fillStyle = fill; g.fill();
  if (o.shade) {   // 아래쪽 그늘 — 종이가 «면»으로 읽힌다
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
    const a = i / n * Math.PI * 2, k = 1 + (r() - 0.5) * 0.09;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return p;
}
// 종이결 — 아주 옅은 잡티. 없으면 «플라스틱»으로 보인다
function grainOver(g, w, h, seed, amt) {
  const r = rnd(seed);
  g.save(); g.globalAlpha = amt || 0.05;
  for (let i = 0; i < w * h / 110; i++) {
    g.fillStyle = r() < 0.5 ? '#000' : '#fff';
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  g.restore();
}
function tex(w, h, draw, opt) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // ⚠️ 이 카드가 세상에서 몇 칸인지(`units`)를 주면 선 굵기가 저절로 맞는다.
  //    안 주면 기준값이라 옛날처럼 «픽셀»로 긋는다
  // ⚠️⚠️ **한계를 안 씌우면 «작은 카드»가 통째로 잉크가 된다.** 굵기를 세상의 길이로
  //    못 박으면 0.86칸짜리 촛대에서 그 선이 카드 폭의 7% 라 등잔이 «덩어리»로 보였다
  //    (그려 보고 알았다). 화면에서 3~4px 이 되는 띠로 자른다
  PPU = (opt && opt.units) ? Math.max(70, Math.min(150, w / opt.units)) : INK_REF;
  draw(c.getContext('2d'), w, h);
  PPU = INK_REF;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opt && opt.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.rep[0], opt.rep[1]); }
  return t;
}


export function createRoom(canvas, opt) {
  const O = Object.assign({ autorun: true }, opt);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch (e) { fatal('WebGL 을 못 켰다: ' + e.message); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1520');
  scene.fog = new THREE.Fog('#241b26', 15, 28);
  // ⚠️⚠️ **긴 렌즈다(22°).** 종이 극장은 «정면에서 본 무대»라 화각이 넓으면
  //    벽이 사다리꼴로 눕고 종이 층이 «방»이 아니라 «상자»로 보인다. 그리고 넓은
  //    화각으로는 바닥선을 92% 에 두면서 벽이 화면 꼭대기까지 닿게 할 수가 없다
  //    (풀어 보면 화각이 클수록 벽이 더 높아야 한다 — 그래서 이 둘은 짝이다)
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);

  // ── 셀 셰이딩 ─────────────────────────────────────────────────
  // ⚠️ **칠은 이미 종이에 그려져 있다.** 여기서 빛까지 세게 끊으면 그림이 탁해진다 —
  //    «부드러운» 세 칸 램프로 두어 낮/밤만 읽히게 한다
  function ramp(steps) {
    const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
  }
  const RAMP = ramp([172, 226, 255]);
  const toon = (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: RAMP }, o));

  const key = new THREE.DirectionalLight(0xfff0d8, 1.5);
  key.position.set(5.5, 6.5, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -2;
  key.shadow.bias = -0.002;
  scene.add(key);
  const amb = new THREE.AmbientLight(0xffe6d2, 1.05);
  scene.add(amb);
  const moon = new THREE.PointLight(0xa9c6ff, 0, 12);
  moon.position.set(3.4, 3.6, -2.6);
  scene.add(moon);

  // ── 종이 카드를 «세운다» ──────────────────────────────────────
  //
  // ⚠️⚠️ **평평한 판으로 두면 «스티커»다.** 진짜 종이는 아주 살짝 휜다 —
  //    판을 여러 칸으로 나누고 z 를 사인으로 밀어 **부드러운 말림**을 준다.
  //    그 한 줄이 「3D 안에 종이가 서 있다」를 만든다
  const cards = [];
  function paperCard(texture, w, h, opt) {
    const o = Object.assign({ curl: 0.05, seg: 14 }, opt);
    const geo = new THREE.PlaneGeometry(w, h, o.seg, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (w / 2);                  // -1 ~ 1
      pos.setZ(i, -Math.cos(x * Math.PI / 2) * o.curl * w);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon({ map: texture, transparent: true, alphaTest: 0.45,
      side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // 접지 그림자 — **바닥에 닿는 자국이 없으면 종이가 공중에 뜬다**
  const shadowTex = tex(128, 128, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(30,16,34,0.5)');
    rg.addColorStop(0.5, 'rgba(30,16,34,0.22)');
    rg.addColorStop(1, 'rgba(30,16,34,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  });
  function stand(mesh, x, y, z, opt) {
    const o = Object.assign({ yaw: 0, shadow: 1 }, opt);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = o.yaw;
    mesh.position.y = y;
    g.add(mesh);
    if (o.shadow) {
      const b = new THREE.Box3().setFromObject(mesh);
      const sw = (b.max.x - b.min.x) * 1.2 * o.shadow;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.42),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.02, 0.08);
      g.add(sh);
    }
    scene.add(g);
    g.userData.z0 = z; g.userData.x0 = x;
    cards.push(g);
    return g;
  }


  // ══ 세트 — 종이 극장 ═══════════════════════════════════════════
  // ⚠️ **벽을 프로토타입보다 높였다(6.4 → 7.6).** 게임의 방 상자는 세로로 길고
  //    바닥선이 92% 에 있어서, 6.4 로는 화면 꼭대기에 **천장 너머의 빈 곳**이 비친다.
  //    ⚠️ 높이만 올리면 돌이 세로로 늘어난다 — 텍스처 높이도 «같이» 간다(`wallTex`)
  const ROOM_W = 9.6, ROOM_D = 8.4, WALL_H = 7.6;

  // ── 바닥 ──────────────────────────────────────────────────────
  // 널빤지마다 «잉크 이음새»와 결이 있다. 한 색 판은 바닥이 아니라 색종이다
  const floorTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#a9754c'; g.fillRect(0, 0, w, h);
    const r = rnd(11);
    for (let i = 0; i < 8; i++) {
      const y = i * h / 8;
      g.fillStyle = ['#b07c52', '#a4714a', '#ab7750', '#9d6b45'][i % 4];
      g.fillRect(0, y, w, h / 8);
      g.save(); g.globalAlpha = 0.15;
      for (let k = 0; k < 6; k++) {
        const yy = y + 10 + r() * (h / 8 - 20);
        inkStroke(g, [[0, yy], [w * 0.4, yy + (r() - 0.5) * 8], [w, yy + (r() - 0.5) * 10]],
          { w: 2.4, seed: i * 9 + k + 1, jitter: 3, color: '#5e3a20' });
      }
      g.restore();
      inkStroke(g, [[0, y], [w * 0.5, y + 1.5], [w, y]], { w: 4, seed: i + 3, jitter: 2, color: '#4d2e19' });
      const off = (i % 2) ? w * 0.42 : w * 0.08;
      [off, off + w * 0.5].forEach((x, j) => {
        inkStroke(g, [[x, y + 2], [x + 1.5, y + h / 16], [x, y + h / 8 - 2]],
          { w: 3, seed: i * 5 + j + 2, jitter: 1.4, color: '#4d2e19' });
      });
    }
    grainOver(g, w, h, 5, 0.07);
  }, { units: ROOM_W + 5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 5, ROOM_D + 5), toon({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── 벽 — 종이 극장의 «판» 셋 ──────────────────────────────────
  function wallTex(seed) {
    return tex(1024, Math.round(1024 * WALL_H / ROOM_W), (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, PAL.wall[0]); lg.addColorStop(1, PAL.wall[1]);
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      g.save(); g.globalAlpha = 0.06;                      // 벽지 세로 줄
      for (let x = 0; x < w; x += 46) { g.fillStyle = '#fff'; g.fillRect(x, 0, 16, h); }
      g.restore();
      const r = rnd(seed);
      for (let i = 1; i < 5; i++) {                        // 돌 이음새 (손으로 그은 것)
        const y = i * h / 5;
        inkStroke(g, [[0, y], [w * 0.33, y + (r() - 0.5) * 6], [w * 0.66, y + (r() - 0.5) * 6], [w, y]],
          { w: 3.4, seed: seed * 3 + i, jitter: 2.4, color: 'rgba(62,44,34,0.40)' });
        const off = (i % 2) ? w / 6 : 0;
        for (let k = 0; k < 3; k++) {
          const x = off + k * w / 3;
          if (x < 8 || x > w - 8) continue;
          inkStroke(g, [[x, y], [x + (r() - 0.5) * 4, y + h / 10], [x, y + h / 5]],
            { w: 3, seed: seed * 7 + i * 4 + k, jitter: 2, color: 'rgba(62,44,34,0.32)' });
        }
      }
      paperShape(g, rect(-10, h - 70, w + 20, 84), '#8d6a49', { cut: 0, ink: 5, seed: seed + 2 });
      paperShape(g, rect(-10, -14, w + 20, 44), '#8d6a49', { cut: 0, ink: 5, seed: seed + 5 });
      // 천장 쪽 그늘 — 위가 어두워야 방이 «상자»로 읽힌다 (돈 스타브의 그 어둠이다)
      const tg = g.createLinearGradient(0, 0, 0, h * 0.62);
      tg.addColorStop(0, 'rgba(38,22,36,0.46)'); tg.addColorStop(1, 'rgba(38,22,36,0)');
      g.fillStyle = tg; g.fillRect(0, 0, w, h * 0.62);
      grainOver(g, w, h, seed, 0.05);
    }, { units: ROOM_W });
  }
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, WALL_H), toon({ map: wallTex(1) }));
  backWall.position.set(0, WALL_H / 2, -ROOM_D / 2);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const sideWalls = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, WALL_H), toon({ map: wallTex(2 + s) }));
    m.position.set(s * ROOM_W / 2, WALL_H / 2, 0);
    m.rotation.y = -s * Math.PI / 2;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  });

  // ── 창 — 뒷벽에 «붙인» 카드 ───────────────────────────────────
  function windowTex(night) {
    return tex(512, 700, (g, w, h) => {
      const sky = g.createLinearGradient(0, 40, 0, h - 40);
      if (night) { sky.addColorStop(0, '#2b2c5c'); sky.addColorStop(1, '#4e4e86'); }
      else { sky.addColorStop(0, '#8ed3f6'); sky.addColorStop(1, '#dff0fb'); }
      g.fillStyle = sky; g.fillRect(28, 40, w - 56, h - 100);
      if (night) {
        g.fillStyle = '#f9f2cc'; g.beginPath(); g.arc(w * 0.66, 170, 46, 0, 7); g.fill();
        g.fillStyle = '#3a3a72'; g.beginPath(); g.arc(w * 0.56, 148, 44, 0, 7); g.fill();
        const r = rnd(4); g.fillStyle = '#fff';
        for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(40 + r() * (w - 80), 60 + r() * (h - 220), 1.6 + r() * 1.4, 0, 7); g.fill(); }
      } else {
        g.fillStyle = '#ffe9a6'; g.beginPath(); g.arc(w * 0.66, 180, 52, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.92)';
        g.beginPath(); g.ellipse(w * 0.34, 300, 74, 26, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(w * 0.70, 420, 56, 20, 0, 0, 7); g.fill();
      }
      g.fillStyle = night ? '#3c4a6b' : '#9ec48a';        // 먼 언덕
      g.beginPath(); g.moveTo(28, h - 130);
      g.quadraticCurveTo(w * 0.35, h - 250, w * 0.62, h - 140);
      g.quadraticCurveTo(w * 0.82, h - 196, w - 28, h - 120);
      g.lineTo(w - 28, h - 56); g.lineTo(28, h - 56); g.fill();
      g.save(); g.globalAlpha = 0.2; g.fillStyle = '#fff';  // 유리 반사 — 사선 둘
      g.beginPath(); g.moveTo(60, h - 90); g.lineTo(190, 60); g.lineTo(240, 60); g.lineTo(110, h - 90); g.fill();
      g.beginPath(); g.moveTo(250, h - 90); g.lineTo(330, 60); g.lineTo(356, 60); g.lineTo(276, h - 90); g.fill();
      g.restore();
      const fr = '#7a4f30';                                 // 창틀 — 오려 붙인 종이
      paperShape(g, rect(0, 0, w, 46), fr, { cut: 7, ink: 5, seed: 21 });
      paperShape(g, rect(0, h - 58, w, 58), fr, { cut: 7, ink: 5, seed: 22 });
      paperShape(g, rect(0, 0, 38, h), fr, { cut: 7, ink: 5, seed: 23 });
      paperShape(g, rect(w - 38, 0, 38, h), fr, { cut: 7, ink: 5, seed: 24 });
      paperShape(g, rect(w / 2 - 14, 32, 28, h - 84), fr, { cut: 4, ink: 4, seed: 25 });
      paperShape(g, rect(22, h * 0.46, w - 44, 26), fr, { cut: 5, ink: 5, seed: 26 });
    }, { units: 2.5 });
  }
  const WIN_DAY = windowTex(false), WIN_NIGHT = windowTex(true);
  const winMesh = paperCard(WIN_DAY, 2.5, 3.4, { curl: 0.012 });
  winMesh.material.alphaTest = 0;
  stand(winMesh, 2.5, 3.7, -ROOM_D / 2 + 0.06, { shadow: 0 });
  const winMat = winMesh.material;

  // 창에서 드는 빛 한 줄기 — 「빛이 어디서 오는가」가 한눈에 보인다
  const shaftTex = tex(128, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(255,240,200,0.40)');
    lg.addColorStop(0.65, 'rgba(255,238,196,0.15)');
    lg.addColorStop(1, 'rgba(255,238,196,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.6),
    new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shaft.position.set(1.4, 3.1, -1.7);
  shaft.rotation.set(-0.34, 0.52, 0.16);
  scene.add(shaft);

  // ── 양탄자와 마법진 — 바닥에 «깐» 종이 ────────────────────────
  const rugTex = tex(768, 768, (g, w) => {
    g.clearRect(0, 0, w, w);
    const c = w / 2, R = w / 2 - 16;
    [[R, PAL.cloth[0], 1, 10], [R * 0.79, '#e9a9bd', 2, 0], [R * 0.62, PAL.cloth[0], 3, 0],
     [R * 0.36, '#f3c7d4', 4, 0]].forEach(([rad, fill, seed, cut]) => {
      paperShape(g, blob(c, c, rad, rad, 64, seed + 30), fill, { cut, ink: 5, seed: seed + 30 });
    });
    for (let i = 0; i < 48; i++) {                        // 술
      const a = i / 48 * Math.PI * 2;
      inkStroke(g, [[c + Math.cos(a) * R, c + Math.sin(a) * R],
                    [c + Math.cos(a) * (R + 12), c + Math.sin(a) * (R + 12)]],
        { w: 4, seed: 40 + i, jitter: 1.2, color: '#ece0cd' });
    }
    grainOver(g, w, w, 9, 0.05);
  }, { units: 4.7 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 4.7),
    new THREE.MeshBasicMaterial({ map: rugTex, transparent: true, depthWrite: false }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.015;
  scene.add(rug);
  const glyphTex = tex(512, 512, (g, w) => {
    g.clearRect(0, 0, w, w);
    const c = w / 2;
    [0.46, 0.33].forEach((k, i) => {
      inkStroke(g, blob(c, c, w * k, w * k, 64, 60 + i), { w: 5 - i * 1.5, close: true, seed: 60 + i, jitter: 1.6, color: PAL.brew });
    });
    for (let i = 0; i < 6; i++) {
      const t = i / 6 * Math.PI * 2;
      inkStroke(g, [[c + Math.cos(t) * w * 0.33, c + Math.sin(t) * w * 0.33],
                    [c + Math.cos(t) * w * 0.46, c + Math.sin(t) * w * 0.46]],
        { w: 4, seed: 70 + i, jitter: 1, color: PAL.brew });
    }
  }, { units: 3.0 });
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0),
    new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, depthWrite: false, opacity: 0.75 }));
  glyph.rotation.x = -Math.PI / 2; glyph.position.y = 0.03;
  scene.add(glyph);

  // ── 소품 카드들 ───────────────────────────────────────────────
  const shelfTex = tex(640, 820, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    paperShape(g, roundRect(10, 10, w - 20, h - 20, 16), PAL.wood[1],
      { cut: 10, ink: 7, seed: 31, shade: 'rgba(40,20,10,0.35)' });
    const cols = ['#d4607a', '#5f95d8', '#71b389', '#dcae57', '#9a7ad0', '#d8825a'];
    for (let row = 0; row < 4; row++) {
      const y = 52 + row * 188;
      paperShape(g, rect(44, y, w - 88, 152), '#59391f', { cut: 0, ink: 4, seed: 40 + row });
      const rr = rnd(row * 13 + 1);
      let x = 62;
      while (x < w - 82) {
        const bw = 26 + rr() * 22, bh = 98 + rr() * 40, lean = (rr() - 0.5) * 0.2;
        const by = y + 150 - bh, cx = x + bw / 2;
        g.save(); g.translate(cx, y + 150); g.rotate(lean); g.translate(-cx, -(y + 150));
        paperShape(g, rect(x, by, bw, bh), cols[Math.floor(rr() * cols.length)],
          { cut: 4, ink: 4, seed: 50 + row * 7 + Math.round(x), shade: 'rgba(0,0,0,0.25)' });
        inkStroke(g, [[x + 6, by + 14], [x + bw - 6, by + 14]],
          { w: 3, seed: Math.round(x) + row + 1, jitter: 1, color: 'rgba(255,255,255,0.4)' });
        g.restore();
        x += bw + 5 + rr() * 6;
      }
      paperShape(g, rect(34, y + 148, w - 68, 20), PAL.woodL[0], { cut: 5, ink: 5, seed: 60 + row });
    }
    grainOver(g, w, h, 12, 0.06);
  }, { units: 2.6 });
  const gShelf = stand(paperCard(shelfTex, 2.6, 3.34, { curl: 0.02 }), -3.0, 1.67, -3.5, { yaw: 0.07 });

  const tableTex = tex(768, 520, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    paperShape(g, rect(30, 300, 54, 202), PAL.wood[1], { cut: 7, ink: 6, seed: 71, shade: 'rgba(0,0,0,0.3)' });
    paperShape(g, rect(w - 84, 300, 54, 202), PAL.wood[1], { cut: 7, ink: 6, seed: 72, shade: 'rgba(0,0,0,0.3)' });
    paperShape(g, roundRect(6, 250, w - 12, 62, 12), PAL.woodL[0], { cut: 9, ink: 7, seed: 73, shade: 'rgba(60,32,14,0.32)' });
    const pot = [[196, 252], [176, 178], [188, 132], [246, 106], [330, 106], [388, 132], [400, 178], [380, 252]];
    paperShape(g, pot, PAL.dark, { cut: 9, ink: 7, seed: 74, shade: 'rgba(0,0,0,0.45)' });
    paperShape(g, roundRect(164, 94, 248, 34, 16), '#57505f', { cut: 6, ink: 6, seed: 75 });
    paperShape(g, [[192, 118], [242, 102], [330, 102], [386, 118], [340, 134], [242, 134]], PAL.brew,
      { cut: 0, ink: 4, seed: 76 });
    [[230, 82, 11], [290, 62, 14], [346, 78, 9]].forEach(([x, y, rr], i) =>
      paperShape(g, blob(x, y, rr, rr, 18, 80 + i), 'rgba(152,240,212,0.88)', { cut: 0, ink: 3, seed: 80 + i }));
    paperShape(g, [[470, 252], [470, 178], [486, 162], [486, 140], [516, 140], [516, 162], [532, 178], [532, 252]],
      '#cfe8f2', { cut: 7, ink: 6, seed: 84, shade: 'rgba(60,90,110,0.3)' });
    paperShape(g, rect(474, 202, 54, 48), '#e58aa6', { cut: 0, ink: 4, seed: 85 });
    paperShape(g, [[570, 252], [566, 192], [584, 174], [584, 152], [612, 152], [612, 174], [630, 192], [626, 252]],
      '#e9dcc4', { cut: 7, ink: 6, seed: 86, shade: 'rgba(90,70,40,0.3)' });
    paperShape(g, rect(570, 210, 54, 40), '#8fd48f', { cut: 0, ink: 4, seed: 87 });
    grainOver(g, w, h, 15, 0.06);
  }, { units: 3.1 });
  const gTable = stand(paperCard(tableTex, 3.1, 2.1, { curl: 0.02 }), 3.05, 1.05, -1.5, { yaw: -0.18 });
  const brewLight = new THREE.PointLight(PAL.brew, 1.7, 5.5);
  brewLight.position.set(2.4, 1.7, -1.2);
  scene.add(brewLight);

  // 벽 촛대 — 받침판 · 팔 · 접시 · 초 · 불꽃 다섯이 «다» 있어야 촛대로 읽힌다
  // (처음에는 네모 기둥에 노랑 조각 하나였고, 그건 벽에 붙은 «덩어리»였다)
  function sconceTex() {
    return tex(256, 420, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      paperShape(g, roundRect(88, 250, 80, 152, 18), '#8a6a44',            // 벽 받침판
        { cut: 6, ink: 5, seed: 90, shade: 'rgba(40,20,8,0.4)' });
      inkStroke(g, [[128, 268], [128, 388]], { w: 3, seed: 97, jitter: 1, color: 'rgba(60,34,14,0.55)' });
      paperShape(g, [[104, 258], [152, 258], [160, 236], [96, 236]], '#a07a4c',   // 팔
        { cut: 5, ink: 5, seed: 91 });
      paperShape(g, [[72, 236], [184, 236], [170, 212], [86, 212]], '#c39a62',   // 접시
        { cut: 6, ink: 5, seed: 92, shade: 'rgba(60,34,14,0.3)' });
      paperShape(g, roundRect(100, 96, 56, 120, 10), '#f6eddc',                  // 초
        { cut: 6, ink: 5, seed: 93, shade: 'rgba(120,96,60,0.34)' });
      paperShape(g, [[100, 128], [92, 166], [101, 186], [110, 158], [110, 128]], '#fbf5e8',  // 촛농
        { cut: 0, ink: 3, seed: 94 });
      inkStroke(g, [[128, 96], [128, 80]], { w: 3, seed: 98, jitter: 0.6, color: PAL.ink }); // 심지
      paperShape(g, [[128, 14], [152, 58], [148, 84], [128, 96], [108, 84], [104, 58]],      // 불꽃
        '#ffc94a', { cut: 0, ink: 4, seed: 95 });
      paperShape(g, [[128, 42], [142, 70], [128, 88], [114, 70]], '#fff6cc', { cut: 0, ink: 0, seed: 96 });
    }, { units: 0.86 });
  }
  // ⚠️⚠️ **옆벽에 붙이면 «모서리»만 보인다.** 빌보드가 아니라 «붙박이» 카드라
  //    옆벽에 90° 로 세우는 순간 카메라에서 두께 0 이 된다 — 처음에 그렇게 두었다가
  //    화면에 촛대가 셋 다 안 보였다 (등불이 켜져 있는데 등잔이 없는 방이었다).
  //    **뒷벽에 붙인다** — 종이 극장에서 보이는 것은 뒷벽 한 장이다
  const flames = [];
  [[-4.15, 3.15], [0.85, 3.15], [4.35, 3.05]].forEach(([x, y], i) => {
    const c = stand(paperCard(sconceTex(), 0.86, 1.41, { curl: 0.02 }), x, y, -ROOM_D / 2 + 0.07,
      { shadow: 0 });
    const pl = new THREE.PointLight(0xffb45e, 2.3, 7.2);
    pl.position.set(x, y + 0.55, -ROOM_D / 2 + 1.0);
    scene.add(pl);
    flames.push({ card: c, pl, seed: i * 2.3 });
  });

  const herbTex = tex(320, 430, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    inkStroke(g, [[160, 0], [160, 62]], { w: 6, seed: 101, jitter: 1, color: '#7a5a3a' });
    const r = rnd(3);
    for (let i = 0; i < 9; i++) {
      const a = -0.9 + i * 0.22, L = 220 + r() * 90;
      const x2 = 160 + Math.sin(a) * L, y2 = 72 + Math.cos(a) * L;
      inkStroke(g, [[160, 68], [160 + Math.sin(a) * L * 0.5, 72 + Math.cos(a) * L * 0.5], [x2, y2]],
        { w: 5, seed: 110 + i, jitter: 2.4, color: PAL.leaf[1] });
      for (let k = 1; k <= 4; k++) {
        const t = 0.3 + k * 0.17;
        const lx = 160 + Math.sin(a) * L * t, ly = 72 + Math.cos(a) * L * t, s = 15 + r() * 9;
        paperShape(g, [[lx, ly - s], [lx + s * 0.8, ly], [lx, ly + s], [lx - s * 0.8, ly]],
          k % 2 ? PAL.leaf[0] : PAL.leaf[1], { cut: 0, ink: 3, seed: 120 + i * 5 + k });
      }
    }
    paperShape(g, roundRect(126, 52, 68, 30, 10), '#c8956a', { cut: 5, ink: 5, seed: 130 });
  }, { units: 0.86 });
  const gHerb = stand(paperCard(herbTex, 0.92, 1.24, { curl: 0.03 }), -2.85, 4.72, -ROOM_D / 2 + 0.09, { shadow: 0 });

  const frameTex = tex(420, 340, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    paperShape(g, roundRect(8, 8, w - 16, h - 16, 12), '#8a5f3c', { cut: 9, ink: 7, seed: 141, shade: 'rgba(0,0,0,0.3)' });
    paperShape(g, rect(40, 40, w - 80, h - 80), '#cfe3f2', { cut: 0, ink: 5, seed: 142 });
    paperShape(g, [[40, h - 40], [150, 120], [230, h - 40]], '#8fae86', { cut: 0, ink: 4, seed: 143 });
    paperShape(g, [[180, h - 40], [280, 150], [380, h - 40]], '#a7c297', { cut: 0, ink: 4, seed: 144 });
    paperShape(g, blob(300, 98, 26, 26, 20, 145), '#f6d87a', { cut: 0, ink: 4, seed: 145 });
  }, { units: 1.35 });
  const gFrame = stand(paperCard(frameTex, 1.5, 1.22, { curl: 0.02 }), -0.55, 3.35, -ROOM_D / 2 + 0.07, { shadow: 0 });

  const plantTex = tex(420, 540, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rnd(8);
    for (let i = 0; i < 7; i++) {
      const a = -1.0 + i * 0.33, L = 200 + r() * 120;
      const x2 = 210 + Math.sin(a) * L, y2 = 366 - Math.cos(a) * L;
      inkStroke(g, [[210, 372], [210 + Math.sin(a) * L * 0.5, 372 - Math.cos(a) * L * 0.55], [x2, y2]],
        { w: 6, seed: 150 + i, jitter: 2.6, color: PAL.leaf[1] });
      const s = 38 + r() * 22;
      paperShape(g, [[x2, y2 - s], [x2 + s * 0.62, y2], [x2, y2 + s * 0.7], [x2 - s * 0.62, y2]],
        i % 2 ? PAL.leaf[0] : '#95bd7c', { cut: 5, ink: 4, seed: 160 + i });
    }
    paperShape(g, [[126, 372], [294, 372], [272, 522], [148, 522]], '#c07a52',
      { cut: 9, ink: 7, seed: 170, shade: 'rgba(60,24,10,0.35)' });
    paperShape(g, rect(118, 358, 184, 34), '#d08e60', { cut: 6, ink: 6, seed: 171 });
    grainOver(g, w, h, 21, 0.05);
  }, { units: 1.15 });
  const gPlant = stand(paperCard(plantTex, 1.3, 1.67, { curl: 0.03 }), 4.1, 0.84, -0.45, { yaw: -0.34 });

  // ── 벽과 바닥이 만나는 자리의 그늘 ────────────────────────────
  // ⚠️⚠️ **앞쪽에 «무대 앞막» 카드를 세워 보고 되돌렸다** — 이 카메라(화각 32° · 거리 11.6)
  //    에서는 z=4.7 짜리 판이 시야 «밖»이라 한 프레임도 안 보였다. 깊이를 만드는 것은
  //    앞에 뭘 세우는 것이 아니라 **벽 밑동이 어두워지는 것**이다 (사진의 그 자리다).
  const cornerTex = tex(64, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(26,14,26,0.44)');
    lg.addColorStop(0.55, 'rgba(26,14,26,0.16)');
    lg.addColorStop(1, 'rgba(26,14,26,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  });
  const cornerMat = () => new THREE.MeshBasicMaterial({ map: cornerTex, transparent: true,
    depthWrite: false, side: THREE.DoubleSide });
  const cBack = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 4, 1.9), cornerMat());
  cBack.rotation.x = -Math.PI / 2;
  cBack.position.set(0, 0.03, -ROOM_D / 2 + 0.95);
  scene.add(cBack);
  [-1, 1].forEach(s => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D + 4, 1.6), cornerMat());
    m.rotation.set(-Math.PI / 2, 0, s * Math.PI / 2);
    m.position.set(s * (ROOM_W / 2 - 0.8), 0.03, 0);
    scene.add(m);
  });

  // ⚠️ 이것 하나로 방의 «공기»가 생긴다. 없으면 정물 사진이다
  const DUST = 90;
  const dustGeo = new THREE.BufferGeometry();
  const dpos = new Float32Array(DUST * 3), dphase = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = -1.2 + Math.random() * 5.4;
    dpos[i * 3 + 1] = 0.4 + Math.random() * 4.4;
    dpos[i * 3 + 2] = -3.2 + Math.random() * 4.8;
    dphase[i] = Math.random() * 6.28;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xfff0cf, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  // ══ 게임이 쥐는 손잡이 ═══════════════════════════════════════
  //
  // ⚠️⚠️ **카메라는 «방 상자»에 맞춘다 — 창이 아니다.** 프로토타입은 화면 전체를
  //    쓰지만 게임의 방은 `.room-scene` 한 상자이고, 그 상자의 비가 폭마다 다르다
  //    (265px 에서 0.60 · 480px 에서 1.08). 창으로 맞추면 좁은 폭에서 방이 통째로
  //    확대돼 벽만 보인다.
  // ⚠️⚠️ **양탄자 한가운데가 «화면의 어디»에 오는지가 이 값들의 전부다.** 지금 SVG
  //    방에서 재면 상자의 **가로 50% · 세로 92%** 에 있다 (265·390·480px 에서
  //    0.922 · 0.923 · 0.914). 인물은 그 한가운데에 서므로(`placeFigure`), 여기가
  //    어긋나면 **인물이 방 한가운데로 떠오르고** 제목 줄과 부딪힌다.
  //    그래서 상수를 박지 않고 **원하는 자리에 오도록 카메라를 푼다**(`aimFloor`)
  let FLOOR_AT = 0.92;      // 양탄자 한가운데가 설 «세로» 자리 (상자 높이의 비율)
  // 양탄자의 반폭 — **상자 «높이»에 대한 비율**이다.
  // ⚠️⚠️ **폭이 아니라 높이로 잡는 것이 요점이다.** SVG 방은 `preserveAspectRatio="…slice"`
  //    라 **높이로 꽉 채우고 좌우가 잘린다** — 그래서 265px 과 390px 에서 양탄자가
  //    320.5px · 320.9px 로 «같다». 3D 도 같아야 폭을 바꿔도 방이 안 확대된다.
  //    three.js 의 화각은 «세로»라 거리만 맞추면 그 성질이 저절로 따라온다
  let RUG_AT = 0.361;       // 321px ÷ 445px ÷ 2 — 지금 SVG 방에서 재서 나온 값 (기본값)
  // ⚠️ 카메라 높이는 못 박는다 — **푸는 것은 «고개 각도»와 «거리» 둘**이다.
  //    셋을 다 풀면 답이 한 줄이 아니라 면이 되어 값이 판마다 널뛴다
  const CAM_Y = 2.6;
  let dist = 16.7, pitch = 0, W = 1, H = 1;

  // ── 둘러보기 — **양탄자의 «세로축»을 도는 궤도다** (`spin`)
  //
  // ⚠️⚠️ **한가운데(ORIGIN)를 축으로 돌아야 인물이 안 흔들린다.** 인물은 DOM 의 SVG 라
  //    3D 가 아니고, `placeFigure` 가 **양탄자 한가운데의 화면 자리**(`floorRect().cy`)
  //    에 발을 맞춘다. 카메라 «장비»를 통째로 그 축에서 돌리면 — 자리도 돌고 yaw 도
  //    같은 각으로 돌면 — 카메라 좌표에서 본 ORIGIN 이 **한 픽셀도 안 움직인다.**
  //    다른 점을 축으로 잡으면 양탄자가 화면에서 좌우로 미끄러지고, 인물은 세로만
  //    맞추므로 **발이 양탄자 밖으로 나간다** (`checkroom` 이 그것을 잡는다).
  // ⚠️ **yaw 0 에서는 지금과 한 글자도 안 달라진다** — sin0=0 · cos0=1 이다
  let yaw = 0, yawTo = 0;
  function place() {
    camera.position.set(Math.sin(yaw) * dist, CAM_Y, Math.cos(yaw) * dist);
    camera.rotation.set(-pitch, yaw, 0, 'YXZ');   // pitch>0 이면 «내려다본다»
    camera.updateMatrixWorld();
  }
  // 세상의 한 점이 상자 안에서 «어디»인가 (0~1)
  function toScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5), y: (-p.y * 0.5 + 0.5) };
  }
  // ⚠️⚠️ **고도와 거리를 «풀어서» 맞춘다 — 손으로 못 적는다.** 화각·거리·고도·비가
  //    한 식에 다 걸려 있고, 둘이 서로를 움직인다(카메라를 물리면 바닥선도 내려간다).
  //    그래서 «이분법 둘»을 번갈아 몇 번 돌린다 — 네 바퀴면 0.001 안으로 든다.
  // ⚠️ 처음에는 부등호를 거꾸로 적어 **카메라가 바닥을 내려다보고 벽이 통째로
  //    사라졌다** (찍어 보고 알았다). 고도를 올리면 바닥은 화면 «위»로 온다
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  // ⚠️⚠️ **`lo` 는 «값이 큰 쪽»이다 — 축의 방향이 아니다.** 이분법이 가정하는 것은
  //    `get` 이 lo → hi 로 «줄어든다»는 것 하나다. 거리를 `(30, 5)` 로 넘겼다가
  //    양탄자가 절반 크기로 굳었다 (바닥선은 맞아서 **통과로 보였다**)
  function solve(get, want, lo, hi, set) {
    for (let i = 0; i < 26; i++) {
      const m = (lo + hi) / 2; set(m); place();
      if (get() > want) lo = m; else hi = m;
    }
    set((lo + hi) / 2); place();
  }
  function aimFloor() {
    for (let k = 0; k < 4; k++) {
      // 바닥선 — 고도를 «올리면» 바닥이 화면 위로 온다 (y 가 준다)
      solve(() => toScreen(ORIGIN).y, FLOOR_AT, -0.40, 0.90, v => { pitch = v; });
      // 양탄자 폭 — 멀어지면 작아진다
      solve(() => rugHalf() / H, RUG_AT, 5, 30, v => { dist = v; });
    }
  }
  // ⚠️ **지금 깔린 양탄자의 «제» 폭으로 잰다**(`rug.scale`) — 단계마다 크기가 다르다.
  //    못 박으면 작은 러그를 깐 방에서 카메라가 통째로 당겨진다
  function rugHalf() {
    const c = toScreen(ORIGIN), e = toScreen(rugEdge());
    return Math.abs(e.x - c.x) * W;
  }
  // 양탄자의 «가로» 끝 — ⚠️⚠️ **시선에 수직인 쪽으로 잡는다**(카메라의 오른쪽 벡터).
  //    x 축에 못 박으면 둘러볼 때 그 점이 **비스듬해져** 화면에서 짧아지고,
  //    `aimFloor` 가 그만큼 카메라를 당겨 **돌릴 때마다 방이 확대된다.**
  //    yaw 0 에서는 (1,0,0) 이라 지금과 같은 값이다
  function rugEdge() {
    const r = rug.scale.x * 2.35;
    return new THREE.Vector3(Math.cos(yaw) * r, 0, -Math.sin(yaw) * r);
  }

  // ⚠️⚠️ **SVG 방에 «맞춰» 조준한다 — 상수로 두지 않는다.**
  //    SVG 방은 `preserveAspectRatio="…slice"` 라 **좁은 상자에서는 높이로, 넓은
  //    상자에서는 폭으로** 꽉 찬다 (480px 에서 양탄자가 360px 인데 높이로만 맞추면
  //    321px 이다 — 그만큼 어긋난다). 그러면 WebGL 이 없는 기기로 떨어질 때 방이
  //    **통째로 다른 자리**에 서고, SVG 를 재는 검사들이 3D 와 다른 것을 재게 된다.
  //    그래서 «이미 깔려 있는 그림»을 재서 거기에 맞춘다 (`placeFigure`·`placePet` 과
  //    같은 규칙이다: 상수가 아니라 그려진 자리).
  // ⚠️ 1단계에는 양탄자가 아예 없다 — 그때는 기본값 그대로다
  function aim(floorRel, rugRel) {
    const f = Number(floorRel), r = Number(rugRel);
    if (isFinite(f) && f > 0.4 && f < 1.2) FLOOR_AT = f;
    if (isFinite(r) && r > 0.05 && r < 1.5) RUG_AT = r;
    aimFloor();
  }

  function resize(w, h) {
    if (!(w > 0 && h > 0)) return;
    W = w; H = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    aimFloor();
  }

  // ── 단계 — **방의 «껍데기»는 그대로고 «놓인 것»만 갈린다** (`ROOM.md` 1장)
  // ⚠️ 목록을 여기 적지 않는다 — `Avatar.ROOM_LEVELS` 를 그대로 읽는다.
  //    베껴 두면 단계를 고쳤을 때 SVG 방과 3D 방이 서로 다른 방이 된다
  const PROP = {
    shelf: [gShelf], bookshelf: [gShelf], frame: [gFrame], plant: [gPlant],
    candle: flames.map(f => f.card), chandelier: flames.map(f => f.card),
    circle: [glyph], curtain: [gHerb],
  };
  let level = 0;
  function setLevel(lv) {
    lv = Math.max(1, Math.min(5, Math.round(Number(lv) || 1)));
    if (lv === level) return;
    level = lv;
    const want = new Set((window.Avatar && Avatar.ROOM_LEVELS && Avatar.ROOM_LEVELS[lv]) || []);
    Object.keys(PROP).forEach(k => {
      const on = want.has(k);
      PROP[k].forEach(o => { if (on || !o.visible) o.visible = o.visible || on; });
    });
    // ⚠️ 두 번 도는 이유 — 한 이름이 여러 조각을 가리키고(`candle`·`chandelier` 가
    //    같은 촛대다) 한 조각이 여러 이름에 걸린다. 「하나라도 원하면 켠다」라서
    //    끄는 쪽을 먼저 돌면 켠 것을 도로 끈다
    const keep = new Set();
    want.forEach(k => (PROP[k] || []).forEach(o => keep.add(o)));
    Object.values(PROP).flat().forEach(o => { o.visible = keep.has(o); });
    // 양탄자는 «크기»가 갈린다 — 작은 러그와 큰 카펫은 같은 종이다
    rug.visible = want.has('rugSmall') || want.has('rugBig');
    rug.scale.setScalar(want.has('rugBig') ? 1 : 0.72);
    brewLight.visible = gTable.visible = true;     // 공방의 솥은 늘 있다
  }

  // ── 낮과 밤 — 창과 빛만 갈린다 (방은 같은 방이다)
  //
  // ⚠️⚠️ **시간대의 «이름»은 SVG 방이 정한다** (`Avatar.skyPhase` 의 다섯 —
  //    dawn · day · dusk · evening · night). 여기에 시계를 다시 적으면 3D 가 못 서는
  //    기기에서 **다른 시간대의 방**이 뜬다 — 이름을 받아 «이 세트가 무엇을 하는지»만 정한다.
  // ⚠️ **「초저녁」도 밤 쪽이다** — 창밖이 이미 어두운데 햇살 기둥이 서 있으면
  //    오후 여덟 시의 방에 해가 든다 (밤과 갈리는 것은 창 그림과 빛뿐이다)
  let phase = '';
  function setPhase(p) {
    if (p === phase) return;
    phase = p;
    const night = (p === 'night' || p === 'evening');
    winMat.map = night ? WIN_NIGHT : WIN_DAY; winMat.needsUpdate = true;
    shaft.visible = !night;
    moon.intensity = night ? 1.5 : 0;
    key.intensity = night ? 0.55 : 1.5;
    amb.intensity = night ? 0.62 : 1.05;
    scene.fog.color.set(night ? '#1b1526' : '#241b26');
  }

  // ── 양탄자가 화면에서 차지하는 자리 (게임의 `placeFigure` 가 이것을 본다)
  // ⚠️ **상수를 돌려주지 않는다** — 카메라를 통과시켜 **그려진 자리**를 낸다.
  //    상수로 두면 카메라를 옮겼을 때 인물만 옛 자리에 남는다 (SVG 방에서
  //    「양탄자만 옮기기」 사보타주가 잡던 바로 그 사고다)
  function floorRect() {
    const c = toScreen(ORIGIN);
    const e = toScreen(rugEdge());     // 시선에 수직 — 둘러봐도 값이 안 흔들린다
    return { cx: c.x * W, cy: c.y * H, half: Math.abs(e.x - c.x) * W };
  }

  // ── 둘러보기 한 걸음
  //
  // ⚠️⚠️ **끝까지 못 돈다 — 이 방에는 «앞벽»이 없다.** 뒷벽과 옆벽 셋뿐이라
  //    많이 돌면 열린 앞으로 시야가 빠져 방이 통째로 깨진다. 그래서 ±`YAW_MAX` 다.
  //    ⚠️ 값은 **찍어 보고** 골랐다 — 옆벽의 앞 모서리가 화면에 안 들어오는 한계다
  // ⚠️ **한 걸음이 `YAW_STEP` 인 이유**: 끌기(drag)로 두면 폰에서 방을 쓸어 내리려다
  //    카메라가 돌아간다. 버튼 두 개로 한 칸씩 도는 것이 이 화면에 맞는 손짓이다
  const YAW_MAX = 0.40, YAW_STEP = 0.20;         // ±23° · 한 걸음 11.5°
  // ⚠️⚠️ **제 걸음으로 돈다 — 방의 «도는 루프»에 기대지 않는다.** 처음에는 `frame()`
  //    안에서만 따라가게 했는데, 그러면 **루프가 멎어 있을 때 눌러도 아무 일이
  //    안 일어난다**(검사기가 재려고 멈춰 둔 자리에서 그대로 걸렸다).
  //    버튼이 하는 일이 «다른 것이 돌고 있는가»에 달려 있으면 그건 배선이 끊긴 것과 같다
  let spinRaf = 0;
  function spinStep() {
    spinRaf = 0;
    if (dead) return;
    const d = yawTo - yaw;
    yaw = Math.abs(d) < 0.0015 ? yawTo : yaw + d * 0.16;
    place(); renderer.render(scene, camera);
    if (yaw !== yawTo) spinRaf = requestAnimationFrame(spinStep);
  }
  function spin(dir) {
    yawTo = Math.max(-YAW_MAX, Math.min(YAW_MAX, yawTo + (Number(dir) || 0) * YAW_STEP));
    // ⚠️ **움직임 줄이기에서는 «즉시»다** — 기능을 빼는 것이 아니라 도는 모습을 뺀다
    if (slow) { yaw = yawTo; place(); renderer.render(scene, camera); }
    else if (!spinRaf) spinRaf = requestAnimationFrame(spinStep);
    return yawTo;
  }
  // 「지금 어디까지 돌아가 있나」 — 버튼을 흐리게 할지 검사기가 볼 값이다
  function spinAt() { return { yaw, to: yawTo, max: YAW_MAX, step: YAW_STEP }; }

  // ── 돈다
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, dead = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!slow) {
      glyph.rotation.z += 0.005;
      glyph.material.opacity = 0.58 + Math.sin(now / 1400) * 0.16;
      brewLight.intensity = 1.5 + Math.sin(now / 430) * 0.45;
      flames.forEach(({ card, pl, seed }) => {
        card.scale.y = 1 + Math.sin(now / 150 + seed) * 0.012;
        pl.intensity = 1.3 + Math.sin(now / 140 + seed) * 0.32;
      });
      const P = dustGeo.attributes.position;
      for (let i = 0; i < DUST; i++) {
        let y = P.getY(i) + 0.002; if (y > 5.0) y = 0.3;
        P.setY(i, y);
        P.setX(i, dpos[i * 3] + Math.sin(now / 2600 + dphase[i]) * 0.22);
      }
      P.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  // ⚠️ **안 보이면 멈춘다.** 마이 룸을 떠난 뒤에도 돌면 배터리를 먹고,
  //    무엇보다 검사기가 재는 순간이 프레임마다 달라진다
  function run(on) {
    if (dead) return;
    if (on && !raf) raf = requestAnimationFrame(frame);
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    // ⚠️ 멈출 때 **돌다 만 것은 끝까지 옮겨 놓는다** — 안 그러면 다음에 들어왔을 때
    //    카메라가 어정쩡한 각도에 서 있고, 「몇 프레임 더 그렸나」를 재는 검사도 흔들린다
    if (!on && spinRaf) {
      cancelAnimationFrame(spinRaf); spinRaf = 0;
      yaw = yawTo; place(); renderer.render(scene, camera);
    }
  }
  function dispose() {
    run(false); dead = true;
    renderer.dispose();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); });
    });
  }

  setPhase('day'); setLevel(1);
  if (O.autorun) run(true);
  // ⚠️ **프로토타입은 제 돌리기를 쓴다**(궤도·펼쳐 보기·빌보드가 거기 있다) —
  //    그래서 조각들을 같이 내놓는다. 감춰 두면 프로토타입이 세트를 다시 짜게 되고,
  //    그 순간 이 파일이 「유일한 곳」이 아니게 된다
  return { scene, camera, renderer, cards, resize, aim, setLevel, setPhase, floorRect, spin, spinAt, run, dispose,
    render: () => renderer.render(scene, camera),
    parts: { glyph, rug, backWall, floor, walls: [backWall].concat(sideWalls), shaft, winMat, moon, key, amb, brewLight, flames, shadowTex,
      dust, dustGeo, dpos, dphase, DUST, ROOM_W, ROOM_D, WALL_H },
    get slow() { return slow; } };
}

// ⚠️ **게임은 «모듈»을 못 읽는다** (`<script>` 순서가 곧 의존성인 저장소다) —
//    그래서 여기서 `window` 에 얹고, game.js 는 그것이 «있으면» 쓴다.
//    없으면 SVG 방 그대로다 (이 파일이 통째로 없어도 게임은 돈다)
window.Room3D = { create: createRoom, THREE };
window.dispatchEvent(new Event('room3d-ready'));
