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

// ⚠️⚠️ **잉크와 종이 네 함수는 `roomart.js` 로 옮겼다** (`window.RoomArt`).
//    SVG 폴백이 «같은 그림»을 써야 하기 때문이다 — 소품 하나를 예쁘게 고치면
//    3D 방과 SVG 방에 같이 온다. 여기서 한 벌 더 두면 그 순간 사본이 갈린다.
// ⚠️ 모듈은 평범한 스크립트보다 «늦게» 도므로 여기서 `window` 를 읽는 것이 안전하다
//    (`index.html` 에도 순서를 적어 뒀다). 없으면 방을 아예 못 그리니 그 자리에서 알린다
// ⚠️ **터질 때는 «왜»를 들고 터진다.** 예전에는 없는 `fatal()` 을 부르고 있어서,
//    WebGL 이 안 켜지는 기기에서 `ReferenceError: fatal is not defined` 가 났다 —
//    게임은 SVG 방으로 잘 떨어지지만 **원인이 로그에 안 남았다**
function fatal(msg) { throw new Error('room3d: ' + msg); }
// ⚠️⚠️ **모듈이 «돌 때»가 아니라 «방을 만들 때» 읽는다.** 프로토타입
//    (`proto/room3d.html`)은 의존 파일을 **비동기로** 받아 놓고 나중에 `createRoom()`
//    을 부르는데, 여기서 최상위로 읽으면 그 순간에는 `window.RoomArt` 가 아직 없어
//    **프로토타입이 통째로 안 뜬다** (게임에서는 순서가 맞아서 안 드러난다 —
//    「한쪽에서만 나는 사고」의 그 종류다)
let ART = null, PAL, inkStroke, paperShape, rect, roundRect, blob, grainOver;
function useArt() {
  if (ART) return;
  ART = window.RoomArt;
  if (!ART) fatal('roomart.js 가 먼저 와야 한다 (window.RoomArt 가 없다)');
  ({ PAL, inkStroke, paperShape, rect, roundRect, blob, grainOver } = ART);
}
// 프로토타입이 이것을 import 한다 — 사본을 만들지 않고 그대로 넘긴다
export const rnd = (seed) => { useArt(); return ART.rnd(seed); };

// 캔버스 한 장을 three 텍스처로 굽는다.
// ⚠️ **캔버스를 만드는 것은 `RoomArt.canvasOf` 다** — 선 굵기를 «세상의 길이»로
//    환산하는 그 한 줄이 거기 있고, SVG 폴백도 같은 함수를 지난다
function tex(w, h, draw, opt) {
  useArt();
  const c = ART.canvasOf(w, h, draw, opt && opt.units);
  return bake(c, opt);
}
function bake(c, opt) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opt && opt.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.rep[0], opt.rep[1]); }
  return t;
}


export function createRoom(canvas, opt) {
  useArt();
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
  //    ⚠️ 높이만 올리면 돌이 세로로 늘어난다 — 텍스처 높이도 «같이» 간다(`WALL_TEX_H`)
  const ROOM_W = 9.6, ROOM_D = 8.4, WALL_H = 7.6;

  // ── 바닥과 벽 — **자재는 «사람이 고른 것»이다** ────────────────
  //
  // ⚠️⚠️ **무늬를 여기서 그리지 않는다.** 벽지 다섯 · 바닥재 다섯의 그림은
  //    `roomart.js` 의 `wallArt`·`floorArt` 한 곳이고 SVG 폴백도 그것을 쓴다 —
  //    색은 표(`D.ROOM_WALLS`·`D.ROOM_FLOORS`)가 갖는다.
  // ⚠️ 벽 셋이 «같은» 텍스처를 쓴다. 예전에는 씨앗을 달리해 셋을 따로 구웠는데,
  //    옆벽은 이 카메라에서 거의 «모서리»만 보여서 눈에 안 띄고, 한 장이면
  //    자재를 갈아 끼울 때 캐시가 한 번만 돌아간다
  const WALL_TEX_W = 1024, WALL_TEX_H = Math.round(1024 * WALL_H / ROOM_W);
  const FLOOR_SPAN = ROOM_W + 5;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SPAN, ROOM_D + 5), toon({}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, WALL_H), toon({}));
  backWall.position.set(0, WALL_H / 2, -ROOM_D / 2);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const sideWalls = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, WALL_H), toon({}));
    m.position.set(s * ROOM_W / 2, WALL_H / 2, 0);
    m.rotation.y = -s * Math.PI / 2;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  });
  const walls = [backWall].concat(sideWalls);

  // ⚠️ **옛 텍스처는 버린다**(`dispose`). 자재를 다섯 번 갈아 끼우면 GPU 에 다섯 장이
  //    남는데, `RoomArt` 쪽 캔버스는 캐시라 다시 구워도 그림은 한 번만 그려진다
  let wallId = '', floorId = '';
  function setWall(id) {
    if (id === wallId) return;
    const c = ART.wallCanvas(id, WALL_TEX_W, WALL_TEX_H, ROOM_W);
    if (!c) return;
    wallId = id;
    const t = bake(c, null);
    walls.forEach(m => { if (m.material.map) m.material.map.dispose(); m.material.map = t; m.material.needsUpdate = true; });
  }
  function setFloor(id) {
    if (id === floorId) return;
    const c = ART.floorCanvas(id, 1024, 1024, FLOOR_SPAN);
    if (!c) return;
    floorId = id;
    if (floor.material.map) floor.material.map.dispose();
    floor.material.map = bake(c, null);
    floor.material.needsUpdate = true;
  }

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

  // ── 바닥에 «깐» 마법진 — 공방 5단계의 껍데기다 ────────────────
  // ⚠️ **양탄자는 여기 없다** — 「러그」 자리의 «소품»으로 옮겨 갔다 (사람이 고른다).
  //    마법진만은 단계가 정하는 것이라 남는다 (`Avatar.ROOM_LEVELS[5]` 의 `circle`)
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


  // ══ 꾸미기 — 자리 아홉에 카드를 갈아 끼운다 ═══════════════════
  //
  // ⚠️⚠️ **자리를 여기 적지 않는다** — `D.ROOM_SLOTS` 를 그대로 읽는다. 자리가 두 곳에
  //    적혀 있으면 자리를 옮겼을 때 3D 와 SVG 폴백이 **서로 다른 방**이 된다
  //    (`ROOM.md` 3장의 그 규칙이고, 이 파일이 `Avatar.ROOM_LEVELS` 를 읽는 것과 같다).
  // ⚠️ 표가 없으면 소품이 하나도 안 선다 — 그때도 방(벽·바닥·창)은 그대로 선다
  const SLOTS = ((window.GameData && window.GameData.ROOM_SLOTS) || []);
  const brewLight = new THREE.PointLight(PAL.brew, 0, 5.5);
  brewLight.position.set(2.4, 1.7, -1.2);
  scene.add(brewLight);

  // 한 자리의 «한 짝». 벽등은 짝이 둘이고(`pair`) 나머지는 하나다
  function makeUnit(slot, sign) {
    const grp = new THREE.Group();
    grp.position.set(slot.p3.x * sign, 0, slot.p3.z);
    grp.rotation.y = (slot.p3.yaw || 0) * sign;
    grp.visible = false;
    scene.add(grp); cards.push(grp);
    let light = null;
    if (slot.light) {
      // ⚠️ **불빛은 카드 «앞»에서 난다.** 카드와 같은 자리에 두면 뒷벽만 밝히고
      //    방은 그대로 어둡다 (옛 촛대가 z+1.0 에 불을 둔 이유가 그것이다)
      light = new THREE.PointLight(0xffb45e, 0, 7.2);
      light.position.set(slot.p3.x * sign, slot.p3.y + slot.p3.h * 0.2, slot.p3.z + 1.0);
      scene.add(light);
    }
    return { grp, light, mesh: null, shadow: null };
  }
  // ⚠️ **접지 그림자는 «바닥에 서는 것»만** — 자국이 없으면 종이가 공중에 뜨고,
  //    벽에 붙은 것·매달린 것·탁자 위의 것에 깔면 바닥에 유령 자국이 남는다.
  //    판정은 표에서 나온다 (칸의 밑변이 바닥 근처인가 · 무엇 위에 놓이는가)
  const onFloor = (slot) => !slot.on && (slot.p3.y - slot.p3.h / 2) < 0.5;
  const units = {};
  // 흔들릴 광원 목록 — **씨앗이 짝마다 다르다**(아래 프레임 루프가 쓴다)
  const LIT = [];
  SLOTS.forEach((s, si) => {
    const us = s.kind === 'pair' ? [makeUnit(s, 1), makeUnit(s, -1)] : [makeUnit(s, 1)];
    us.forEach((u, ui) => {
      if (u.light) LIT.push({ grp: u.grp, light: u.light, base: s.light, seed: si * 1.7 + ui * 2.3 });
    });
    units[s.id] = { slot: s, cur: null, us };
  });

  function clearUnit(u) {
    if (u.mesh) {
      u.grp.remove(u.mesh);
      u.mesh.geometry.dispose();
      if (u.mesh.material.map) u.mesh.material.map.dispose();
      u.mesh.material.dispose();
      u.mesh = null;
    }
    if (u.shadow) { u.grp.remove(u.shadow); u.shadow.geometry.dispose(); u.shadow = null; }
    u.grp.visible = false;
    if (u.light) u.light.intensity = 0;
  }
  function mountUnit(u, slot, texture) {
    if (slot.kind === 'floor') {   // 바닥에 «깐다» — 세우지 않는다
      const m = new THREE.Mesh(new THREE.PlaneGeometry(slot.p3.w, slot.p3.h),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = slot.p3.y;
      u.grp.add(m); u.mesh = m; u.grp.visible = true;
      return;
    }
    const m = paperCard(texture, slot.p3.w, slot.p3.h, { curl: 0.02 });
    // ⚠️ 매달린 것·창에 붙은 것은 «투명한 데»가 많다 — alphaTest 를 낮춰야 줄이 안 끊긴다
    if (slot.kind === 'hang' || slot.id === 'curtain') m.material.alphaTest = 0.2;
    m.position.y = slot.p3.y;
    u.grp.add(m); u.mesh = m; u.grp.visible = true;
    if (onFloor(slot)) {
      const sw = slot.p3.w * 1.2;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.42),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.02, 0.08);
      u.grp.add(sh); u.shadow = sh;
    }
    if (u.light) u.light.intensity = slot.light;
  }
  // 한 자리에 소품 하나를 놓는다 (`null` 이면 비운다)
  function setProp(sid, id) {
    const S = units[sid];
    if (!S || S.cur === id) return;
    S.cur = id;
    S.us.forEach(clearUnit);
    const c = id ? ART.propCanvas(id) : null;
    if (!c) return;
    // ⚠️ 짝마다 텍스처를 따로 굽지 않는다 — 벽등 둘이 같은 종이다
    const t = bake(c, null);
    S.us.forEach(u => mountUnit(u, S.slot, t));
  }

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
  // ⚠️⚠️ **기준은 «양탄자»가 아니라 «보이지 않는 자리»다** (`FLOOR_R`). 양탄자가
  //    사람이 고르는 소품이 되면서 **없을 수도 있는 것**이 됐는데, 그것을 재서
  //    카메라를 맞추면 러그를 걷는 순간 카메라 기준이 통째로 사라진다
  //    (SVG 쪽 짝은 `Avatar.floorMark()` 다 — 거기도 상수로 못 박혀 있다).
  // ⚠️ 값은 큰 카펫이 갖던 그 반폭(4.7/2)이라 **양탄자를 깐 방은 한 픽셀도 안 바뀐다**
  const FLOOR_R = 2.35;
  // 기준 반폭 — **상자 «높이»에 대한 비율**이다.
  // ⚠️⚠️ **폭이 아니라 높이로 잡는 것이 요점이다.** SVG 방은 `preserveAspectRatio="…slice"`
  //    라 **높이로 꽉 채우고 좌우가 잘린다** — 그래서 265px 과 390px 에서 기준이
  //    «같다». 3D 도 같아야 폭을 바꿔도 방이 안 확대된다.
  //    three.js 의 화각은 «세로»라 거리만 맞추면 그 성질이 저절로 따라온다
  let MARK_AT = 0.337;      // 150 ÷ 445 — `Avatar.floorMark()` 를 SVG 에서 재서 나온 값
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
      // 기준 반폭 — 멀어지면 작아진다
      solve(() => markHalf() / H, MARK_AT, 5, 30, v => { dist = v; });
    }
  }
  function markHalf() {
    const c = toScreen(ORIGIN), e = toScreen(markEdge());
    return Math.abs(e.x - c.x) * W;
  }
  // 기준의 «가로» 끝 — ⚠️⚠️ **시선에 수직인 쪽으로 잡는다**(카메라의 오른쪽 벡터).
  //    x 축에 못 박으면 둘러볼 때 그 점이 **비스듬해져** 화면에서 짧아지고,
  //    `aimFloor` 가 그만큼 카메라를 당겨 **돌릴 때마다 방이 확대된다.**
  //    yaw 0 에서는 (1,0,0) 이라 지금과 같은 값이다
  function markEdge() {
    return new THREE.Vector3(Math.cos(yaw) * FLOOR_R, 0, -Math.sin(yaw) * FLOOR_R);
  }

  // ⚠️⚠️ **SVG 방에 «맞춰» 조준한다 — 상수로 두지 않는다.**
  //    SVG 방은 `preserveAspectRatio="…slice"` 라 **좁은 상자에서는 높이로, 넓은
  //    상자에서는 폭으로** 꽉 찬다 (480px 에서 양탄자가 360px 인데 높이로만 맞추면
  //    321px 이다 — 그만큼 어긋난다). 그러면 WebGL 이 없는 기기로 떨어질 때 방이
  //    **통째로 다른 자리**에 서고, SVG 를 재는 검사들이 3D 와 다른 것을 재게 된다.
  //    그래서 «이미 깔려 있는 그림»을 재서 거기에 맞춘다 (`placeFigure`·`placePet` 과
  //    같은 규칙이다: 상수가 아니라 그려진 자리).
  // ⚠️ **재는 것은 «보이지 않는 기준»이다** (`Avatar.floorMark()`) — 그려진 양탄자가
  //    아니다. 양탄자는 없을 수도 있고, 없는 방에서도 인물은 같은 자리에 서야 한다
  function aim(floorRel, markRel) {
    const f = Number(floorRel), r = Number(markRel);
    if (isFinite(f) && f > 0.4 && f < 1.2) FLOOR_AT = f;
    if (isFinite(r) && r > 0.05 && r < 1.5) MARK_AT = r;
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

  // ── 단계 — **방의 «껍데기»만 정한다** (`ROOM.md` 1장)
  //
  // ⚠️⚠️ **소품은 더 이상 단계가 정하지 않는다** — 사람이 고른다(`setDecor`).
  //    3D 세트에서 단계가 남긴 일은 **마법진 하나**다. 굽도리·몰딩은 벽 텍스처에
  //    이미 구워져 있고, 금·거미줄·아치는 SVG 방에만 있다 (`ROOM.md` 9장 — 3D 껍데기
  //    조각을 늘리는 것은 남은 일로 적어 뒀다).
  // ⚠️ 목록을 여기 적지 않는다 — `Avatar.ROOM_LEVELS` 를 그대로 읽는다.
  //    베껴 두면 단계를 고쳤을 때 SVG 방과 3D 방이 서로 다른 방이 된다
  let level = 0;
  function setLevel(lv) {
    lv = Math.max(1, Math.min(5, Math.round(Number(lv) || 1)));
    if (lv === level) return;
    level = lv;
    const want = new Set((window.Avatar && Avatar.ROOM_LEVELS && Avatar.ROOM_LEVELS[lv]) || []);
    glyph.visible = want.has('circle');
  }

  // ── 꾸민 것을 방에 놓는다 ─────────────────────────────────────
  //
  // ⚠️⚠️ **여기가 «놓는» 유일한 문이다.** 벽지·바닥재·소품 아홉이 한 함수를 지난다 —
  //    자리마다 부르는 곳을 두면 하나를 빠뜨렸을 때 그 자리만 조용히 안 바뀐다.
  // ⚠️ 기본값은 표(`D.ROOM_START`)가 갖는다 — 여기서 고르면 SVG 폴백과 갈린다
  function setDecor(decor) {
    const D = window.GameData || {};
    const st = D.ROOM_START || {};
    const d = decor && typeof decor === 'object' ? decor : {};
    setWall(d.wall || st.wall);
    setFloor(d.floor || st.floor);
    const props = d.props || {};
    SLOTS.forEach(s => {
      // ⚠️ **무엇 위에 놓이는 것은 받침이 없으면 안 보인다** (촛불·실험 도구 ↔ 탁자).
      //    이 판정은 SVG 폴백에도 있는데(`decorImage`), 둘 다 **표의 `on`** 을 읽는다
      const ok = !s.on || props[s.on];
      setProp(s.id, (ok && props[s.id]) || null);
    });
    // 솥은 「실험 도구」 자리에 들어 있다 — 그것이 없으면 약물의 빛도 없다
    brewLight.intensity = units.gear && units.gear.cur ? 1.7 : 0;
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
    const e = toScreen(markEdge());    // 시선에 수직 — 둘러봐도 값이 안 흔들린다
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
      if (brewLight.intensity) brewLight.intensity = 1.5 + Math.sin(now / 430) * 0.45;
      // 불꽃이 흔들린다 — **광원이 있는 자리만**. 자리마다 씨앗이 달라야
      // 벽등 둘과 촛불이 «같이» 깜박이지 않는다 (그러면 전등 스위치로 보인다)
      LIT.forEach(({ grp, light, seed, base }) => {
        if (!grp.visible) return;
        grp.scale.y = 1 + Math.sin(now / 150 + seed) * 0.012;
        light.intensity = base * (0.88 + Math.sin(now / 140 + seed) * 0.14);
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

  setPhase('day'); setLevel(1); setDecor(null);
  if (O.autorun) run(true);
  // ⚠️ **프로토타입은 제 돌리기를 쓴다**(궤도·펼쳐 보기·빌보드가 거기 있다) —
  //    그래서 조각들을 같이 내놓는다. 감춰 두면 프로토타입이 세트를 다시 짜게 되고,
  //    그 순간 이 파일이 「유일한 곳」이 아니게 된다
  return { scene, camera, renderer, cards, resize, aim, setLevel, setDecor, setPhase, floorRect, spin, spinAt, run, dispose,
    render: () => renderer.render(scene, camera),
    parts: { glyph, backWall, floor, walls, shaft, winMat, moon, key, amb, brewLight, shadowTex,
      units, SLOTS, LIT, dust, dustGeo, dpos, dphase, DUST, ROOM_W, ROOM_D, WALL_H, FLOOR_R },
    get slow() { return slow; } };
}

// ⚠️ **게임은 «모듈»을 못 읽는다** (`<script>` 순서가 곧 의존성인 저장소다) —
//    그래서 여기서 `window` 에 얹고, game.js 는 그것이 «있으면» 쓴다.
//    없으면 SVG 방 그대로다 (이 파일이 통째로 없어도 게임은 돈다)
window.Room3D = { create: createRoom, THREE };
window.dispatchEvent(new Event('room3d-ready'));
