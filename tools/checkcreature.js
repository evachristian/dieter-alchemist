// ═══════════════════════════════════════════════════════════════
//  크리처 그림이 «귀여운 모양»을 지키는가 (npm run test:creature)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **이 층을 보는 검사가 하나도 없었다.** `checkdata` 는 부품 «이름»이 표에 있는지만
// 보고, `checkui` 는 도감 칸의 대비를 보는데 크리처는 `<svg>` 라 글자가 없다 —
// 서른 마리의 그림이 어떻게 생겼든 0건이었다. 실제로 뿔을 키웠더니 **네 마리의 뿔이
// 통째로 상자 밖으로 나가 한 픽셀도 안 그려졌는데** 아무 데서도 안 걸렸다
// (SVG 는 viewBox 밖을 아예 안 그려서 «티가 안 난다»).
//
// 여기서 재는 것은 `CLAUDE.md` 의 「듀오링고풍 치비」 다섯 줄이다 —
// ① 안 잘린다 ② 정면이다 ③ 눈이 크다 ④ 빛이 두 점이다 ⑤ 볼터치가 있다
// ⑥ 속성 색이 여섯으로 갈린다.
//
// ⚠️ **그린 값을 도로 읽지 않는다** — `Creature.HEAD` 같은 표를 읽어 견주면
// 「스스로 맞는」 검사가 된다. **캔버스에 그려 픽셀로** 잰다.
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';

const SZ = 200;          // 재는 크기 (100×100 viewBox 를 두 배로)
// 상자 가장자리에 이만큼은 비어 있어야 한다 — 뿔·귀가 잘리면 여기서 걸린다
const EDGE = 2;
// 얼굴 띠(그려진 것의 위쪽)가 좌우로 이만큼은 같아야 «정면»이다.
// ⚠️ **옛 옆모습 그림이 0.40 이고 지금이 0.97 이라** 그 사이다 (사보타주로 확인했다)
const SYM_MIN = 0.90;
// ⚠️⚠️ **「눈이 큰가」는 «문»으로 안 둔다 — 가를 수 있는 픽셀 잣대를 못 찾았다.**
//    셋을 재 봤고 셋 다 옛 그림과 겹쳤다:
//      · 「얼굴 띠에서 먹이 몇 %」 → 띠를 「위쪽 45%」로 잡으면 뿔 달린 사슴·더듬이
//        달린 나방에서 그 띠가 통째로 «뿔»이라 멀쩡한 그림이 0.5% 로 나온다
//      · 「눈 가로 ÷ 그림 가로」 → 날개가 그림을 넓혀 나방이 25%, 옛 그림 최소가 22%
//      · 「눈동자 넓이 ÷ 그림 넓이」 → 평균은 0.6% → 1.2% 로 두 배인데 **최소가 둘 다 0.4%**
//    **가르지 못하는 잣대는 무슨 값을 넣어도 통과한다** — 그래서 수치는 내되 문은 안 건다.
//    눈의 «짜임»(흰자 + 눈동자 + 빛 두 점)은 아래 ④ 가 대신 지킨다
// 볼터치 — **털색이 볼터치 색 쪽으로 «끌려간» 점**을 센다.
// ⚠️⚠️ **잣대를 두 번 틀렸다.**
//    ① 「`#ff9db4` 에 가까운 점」 → 볼터치가 반투명(0.55)이라 **찍히는 색이 털색에 따라
//       달라진다.** 푸른 털 위에서는 보랏빛이 되어 분홍과 한참 멀다 (열 마리가 걸렸다)
//    ② 「털색보다 붉은 점」 → **주황 털에서는 볼터치가 오히려 덜 붉다**
//       (주황은 파랑이 적고 볼터치는 파랑이 있다 · 불 속성 다섯이 걸렸다)
//    지금은 **「볼터치 색과의 거리가 털색보다 훨씬 가까운 점」**이다 — 섞이는 방향은
//    털색이 무엇이든 같으므로 여섯 속성에서 다 선다
const BLUSH_MIN = 24;    // 그런 점이 이만큼은 있어야 한다 (200px 에서 한쪽만 60쯤 된다)
const BLUSH_K = 0.6;     // 털색이 가진 거리의 이만큼 안으로 들어와야 «볼»이다
// ⚠️⚠️ **2 → 4 로 되돌렸다** (2026-10-02 · 눈마다 «두 점»이 됐다 — 「초롱초롱한
//    눈망울」). ⚠️ 수를 안 올리면 **「하나라도 있으면 센다」**가 되어 **한 점을 지우는
//    사보타주가 그대로 통과한다** — 빛의 수를 바꿀 때는 이 값과 아래 `got` 식이 짝이다
const HI_WANT = 4;       // 빛점 — 눈 둘 × 두 점. 감고 웃는 눈은 안 본다
const ATTR_DE = 28;      // 속성끼리 이만큼은 색이 갈려야 한다 (ΔE 비슷한 값)
const PUPIL_MAX = 0.22;  // 눈동자 상자는 그림의 이만큼 안이다 (먹선 덩어리를 가른다)
const PUPIL_AR = [0.55, 1.8];
const PUPIL_FILL = 0.30; // 눈동자는 «꽉 찬» 덩어리다 — 테두리 «고리»를 가른다
// ⚠️⚠️ 배 판의 테두리(`plate`)가 먹선 색이라 **고리 하나가 눈동자로 잡혔다** —
//    작고(16%) 둥글고(1.2) 크기 빗장을 다 지나서, 그 고리 «안»의 옅은 배 색이
//    「흰자 543%」로 나왔다. 재 보면 눈동자는 상자의 48~70% 가 차 있고 고리는 12% 다
// ⚠️⚠️ **흰자를 «눈동자 상자 안의 밝은 덩어리»로 재면 못 잡는다 — 사보타주가 찾아냈다.**
//    진짜 사람 눈은 «흰자가 바깥, 눈동자가 그 안»이라 먹 덩어리는 작은 눈동자뿐이고
//    흰자는 그 상자 «밖»이다. 게다가 흰자가 **크림색 얼굴 판에 닿아 한 덩어리**가 되어
//    그 덩어리의 중심이 얼굴 한가운데로 가 버린다 — 그래서 **흰자를 넣어도 16% 로
//    통과했다.** 지금은 상자를 안 쓰고 **「거의 흰 칠」이 눈동자 넓이에 비해 얼마나
//    되는가**로 잰다 (빛점 둘이면 7% 안팎 · 흰자가 있으면 170% 가 넘는다).
// ⚠️ 문턱 238 은 **재서** 골랐다 — 크림 얼굴의 제일 밝은 채널이 224(바람)이고
//    빛점(`#fffdf9`)의 제일 어두운 채널이 249 다. 그 사이라 둘이 안 섞인다
const WHITE_LUM = 238;   // 세 채널이 다 이보다 밝으면 «거의 흰 칠»이다
const WHITE_MAX = 0.30;  // 그 몫이 눈동자 넓이의 이만큼을 넘으면 빛점이 아니라 흰자다   // 가로÷세로 — 둥글어야 한다 (입·눈꺼풀 획을 가른다)
// ── ⑦ 먹선 — **둘레에 먹선이 «없는가».**
//
// ⚠️⚠️ **이 줄은 2026-10-01 에 방향이 뒤집혔다.** 전날에는 「둘레가 먹선인가」였다 —
//    그날 사람이 **고양이 SVG 한 장을 직접 그려 보내며** 「잉크선은 생각보다 귀엽지
//    않아서 다시 제거를 부탁해」로 결을 되돌렸고, 그 파일에는 선이 한 줄도 없다.
//    **지키던 것이 사라지면 잣대도 같이 가되, «반대쪽 사고»를 막을 자리는 남긴다** —
//    먹선을 도로 두르는 쪽이 이제 어긋난 것이라 문턱만 뒤집었다
//    (`checkavatar` 의 「페이퍼돌」 ②를 「결이 있는가」→「결이 없는가」로 뒤집은 그 자리다).
// ⚠️ **①~⑥ 어느 것도 이 축을 못 본다** — 선을 도로 둘러도 잘리지도, 비뚤지도,
//    빛이 모자라지도 않는다. 0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
const LINE_HEX = '#44353d';
const LINE_TOL = 30;     // 안티에일리어싱이 끼므로 조금 넉넉히
// ⚠️⚠️ **44 로 두었더니 «선이 있는가»를 재던 때 사보타주가 절반만 잡혔다** — 어두운
//    속성의 털색이 그 품 안에 들어온다. 양쪽을 다 재서 골랐다: 26·30·34 는
//    **선을 두르면 99% · 없으면 1%(30마리 다)** 로 한결같다. 뒤집은 지금도 그대로 쓴다
const LINE_MAX = 0.12;   // 둘레에 먹선이 이만큼 넘게 있으면 «선을 두른 것»이다
const LINE_IN = 2;       // 가장자리에서 이만큼 안쪽을 본다 (가장자리 한 줄은 반투명이다)
const TILT_MAX = 0.25;   // ⑪ 눈망울이 «기울지» 않았는가 (지금 0.12 · 옛 아몬드 0.50 — 재서 골랐다)
const TILT_MIN_N = 60;   // 이보다 작은 먹 덩어리는 «입»이라 안 잰다
const SEAM_MAX = 2;      // ⑨ 귀 이음매 — 실루엣이 한 줄에 이만큼 넘게 안으로 꺾이면 «턱»이다
const TAIL_MIN = 200;    // ⑩ 꼬리가 몸 밖으로 내놓아야 하는 몫 (200px 기준)

const near = (p, hex, tol) => {
  const n = parseInt(hex.slice(1), 16);
  return Math.abs(p[0] - ((n >> 16) & 255)) < tol
      && Math.abs(p[1] - ((n >> 8) & 255)) < tol
      && Math.abs(p[2] - (n & 255)) < tol;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Creature && window.GameData);

  const out = await page.evaluate(async (SZ) => {
    const list = GameData.RECIPES.filter(r => r.result.kind === 'creature').map(r => r.result);
    const cv = document.createElement('canvas');
    cv.width = cv.height = SZ;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const res = [];
    // ⚠️ **배경 판도 그림자도 끄고 잰다** — 판을 깔아 두면 「상자에 꽉 찼다」가 늘 참이라
    //    잘림을 영영 못 보고, 그림자는 바닥에 번져 실루엣을 흐린다
    const shot = async (c) => {
      const svg = Creature.draw(c, { flat: true, noShadow: true, size: SZ });
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const im = new Image();
      await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
      g.clearRect(0, 0, SZ, SZ);
      g.drawImage(im, 0, 0, SZ, SZ);
      return Array.from(g.getImageData(0, 0, SZ, SZ).data);
    };
    // 부품 하나를 뗀 그림 — ⑨⑩ 이 «그 부품이 그림에서 하는 일»을 보려고 쓴다.
    // ⚠️ `art` 를 읽어 견주지 않는다 (「스스로 맞는」 검사가 된다) — **떼고 그려서** 본다
    const without = (c, k) => ({ ...c, art: { ...c.art, [k]: 'none' } });
    for (const c of list) {
      const core = (c.art.horn !== 'none') ? 'horn'
        : (c.art.wing !== 'none') ? 'wing'
          : (c.art.ear !== 'none') ? 'ear' : 'tail';
      res.push({
        id: c.id, name: c.name, attr: c.attr, eye: c.art.eye, core, tailKind: c.art.tail,
        px: await shot(c),
        noEar: core === 'ear' ? await shot(without(c, 'ear')) : null,
        noTail: c.art.tail !== 'none' ? await shot(without(c, 'tail')) : null,
      });
    }
    return res;
  }, SZ);
  await browser.close();

  const bad = [];
  const attrMean = {};
  let sym = 0, eyes = 0, hi = 0, blush = 0, eyeMin = 9, symMin = 9, eyeN = 0, hiN = 0;
  let line = 0, lineN = 0, white = 0;
  let seam = 0, seamN = 0, seamRows = 0, tailMin = 1e9, tailN = 0;
  let tiltMax = 0, tiltN = 0;

  for (const c of out) {
    const P = c.px;
    const A = (x, y) => P[(y * SZ + x) * 4 + 3];
    const RGB = (x, y) => P.slice((y * SZ + x) * 4, (y * SZ + x) * 4 + 3);

    // ── ① 상자 안에 다 들어오는가 (뿔·귀가 안 잘린다)
    let cut = '';
    for (let x = 0; x < SZ && !cut; x++) for (let e = 0; e < EDGE; e++)
      if (A(x, e) > 24) cut = `위쪽 (x${x})`;
    for (let y = 0; y < SZ && !cut; y++) for (let e = 0; e < EDGE; e++) {
      if (A(e, y) > 24) cut = `왼쪽 (y${y})`;
      if (A(SZ - 1 - e, y) > 24) cut = `오른쪽 (y${y})`;
    }
    if (cut) bad.push(`${c.name}: 그림이 상자 ${cut} 에서 잘린다`);

    // 그려진 것의 상자
    let y0 = SZ, y1 = 0, x0 = SZ, x1 = 0;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
      if (A(x, y) > 24) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (y1 <= y0) { bad.push(`${c.name}: 아무것도 안 그려졌다`); continue; }
    // 얼굴 띠 — 그려진 것의 위쪽 45%. ⚠️ 꼬리가 아래 오른쪽이라 아래까지 재면
    //    「정면인가」가 꼬리 때문에 늘 거짓이 된다
    const fy0 = y0, fy1 = y0 + Math.round((y1 - y0) * 0.45);

    // ── ② 정면인가 — 얼굴 띠를 좌우로 뒤집어 견딘다
    let same = 0, tot = 0;
    for (let y = fy0; y <= fy1; y++) for (let x = 0; x < SZ; x++) {
      const a = A(x, y) > 24, b = A(SZ - 1 - x, y) > 24;
      if (a || b) { tot++; if (a && b) same++; }
    }
    const s = tot ? same / tot : 0;
    if (s < SYM_MIN) bad.push(`${c.name}: 얼굴이 좌우 대칭이 아니다 (${s.toFixed(2)} · 정면이어야 한다)`);
    sym += s / out.length; if (s < symMin) symMin = s;

    // ── ③ 눈이 큰가 — 먹색(눈·입)의 가로 폭을 그림의 가로 폭과 견딘다
    // ⚠️⚠️ **먹색을 «그림 전체»에서 찾는다 — 띠 안에서 찾으면 안 된다.** 띠를
    //    「위쪽 45%」로 잡으면 뿔 달린 사슴에서는 그 띠가 통째로 뿔이라 눈이
    //    한 픽셀도 안 잡힌다 (실제로 눈 상자가 35×1 로 나왔다).
    //    먹색을 쓰는 데는 **눈과 입뿐**이라 그림 전체를 훑어도 다른 것이 안 섞인다
    const isInk = (x, y) => A(x, y) > 200 && near(RGB(x, y), '#50364e', 26);
    let ex0 = SZ, ex1 = 0, ey0 = SZ, ey1 = 0;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
      if (isInk(x, y)) { if (x < ex0) ex0 = x; if (x > ex1) ex1 = x; if (y < ey0) ey0 = y; if (y > ey1) ey1 = y; }
    // (넓이는 아래 ④ 에서 먹 덩어리를 셀 때 같이 구한다)

    // ── ④ 빛이 «두 점»인가 — **눈동자마다** 밝은 덩어리를 센다
    //
    // ⚠️⚠️ **「둘레가 먹인가」로 가르려다 두 번 헛짚었다.** 흰 빛점과 먹 눈동자 사이에는
    //    안티에일리어싱 한 줄이 끼어 «먹도 흰색도 아닌» 중간색이다 — 그래서 둘레를
    //    물으면 멀쩡한 빛점이 0.0 으로 나와 **서른 마리가 다 「빛이 0점」**이 됐다.
    // ⚠️ 그렇다고 「밝은 덩어리 수」로만 세면 **흰자 조각**이 같이 세어져, 빛점을
    //    통째로 지워도 수가 안 모자란다 (반달 눈이 흰자를 셋으로 쪼개 놓는다).
    // 지금은 **눈동자(먹 덩어리)의 상자 «안»에 중심이 들어오는 밝은 덩어리**만 센다 —
    //    빛점은 눈동자 안이고, 흰자 조각은 그 위·옆이라 중심이 상자 밖이다
    if (c.eye !== 'sleepy') {
      const blobs = (test) => {
        const seen = new Uint8Array(SZ * SZ);
        const list = [];
        for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
          const k = y * SZ + x;
          if (seen[k] || !test(x, y)) continue;
          const st = [k]; seen[k] = 1;
          let n = 0, sx = 0, sy = 0, a0 = SZ, a1 = 0, b0 = SZ, b1 = 0;
          while (st.length) {
            const m = st.pop(), mx = m % SZ, my = (m - mx) / SZ;
            n++; sx += mx; sy += my;
            if (mx < a0) a0 = mx; if (mx > a1) a1 = mx;
            if (my < b0) b0 = my; if (my > b1) b1 = my;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
              const nx = mx + dx, ny = my + dy;
              if (nx < 0 || ny < 0 || nx >= SZ || ny >= SZ) return;
              const q = ny * SZ + nx;
              if (!seen[q] && test(nx, ny)) { seen[q] = 1; st.push(q); }
            });
          }
          list.push({ n, cx: sx / n, cy: sy / n, a0, a1, b0, b1 });
        }
        return list;
      };
      const isLit = (x, y) => {
        const p = RGB(x, y);
        return A(x, y) > 200 && p[0] > 196 && p[1] > 196 && p[2] > 196;
      };
      // ⚠️⚠️ **눈동자는 «작고 둥근» 먹 덩어리다.** 그림에 먹선이 생기자(2026-10-01)
      //    그 선이 **그림 전체를 두른 한 덩어리**가 되어 눈동자로 잡혔다 —
      //    그 상자 안에는 빛점이 다 들어오므로 **④가 「빛 6.4점」으로 통과했다**.
      //    0건이 「통과」가 아니라 **「엉뚱한 것을 쟀다」**인 경우다.
      //    크기와 생김새를 같이 봐야 갈린다 — 크기만 보면 입(먹으로 칠한 활짝 웃는 입)이
      //    끼어들고, 생김새만 보면 먹선 덩어리가 거의 정사각이라 그대로 지나간다
      const pupils = blobs(isInk).filter(k => {
        const w = k.a1 - k.a0 + 1, h = k.b1 - k.b0 + 1;
        return k.n >= 24 && w <= SZ * PUPIL_MAX && h <= SZ * PUPIL_MAX
          && w / h >= PUPIL_AR[0] && w / h <= PUPIL_AR[1]
          && k.n / (w * h) >= PUPIL_FILL;
      });
      // 눈동자의 크기 — **재되 문은 안 건다**(위의 그 이유다)
      const big = pupils.reduce((m, k) => Math.max(m, k.n), 0);
      const r = big / Math.max(1, (x1 - x0) * (y1 - y0));
      eyes += r; eyeN++; if (r < eyeMin) eyeMin = r;
      const lit = blobs(isLit).filter(k => k.n >= 3);
      const per = pupils.map(k =>
        lit.filter(w => w.cx >= k.a0 && w.cx <= k.a1 && w.cy >= k.b0 && w.cy <= k.b1).length);
      // ── ⑪ 눈망울이 «기울지» 않았는가 — **줄마다 가운데가 밀려 올라가지 않는가**
      //
      // 「눈 모양 더 귀엽게 · **위로 쭉 올라간 눈 별로야** · 초롱초롱한 눈망울 위주로」로
      // 받아 아몬드를 버린 자리다 (2026-10-02).
      // ⚠️⚠️ **①~⑩ 어느 것도 이 축을 못 본다** — 기운 아몬드는 «얼굴 안에서» 좌우
      //    거울이라 ② 가 0.99 로 통과하고, 잘리지도 빛이 모자라지도 않는다.
      //    0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
      // ⚠️⚠️ **먹 영역을 «뒤집어 겹쳐» 보는 것으로는 못 잰다 — 두 번 헛짚었다.**
      //    ① 그대로 뒤집으면 **빛점이 낸 구멍**이 어긋난다 (큰 점은 오른쪽 위 ·
      //    작은 점은 왼쪽 아래라 서로 반대 귀퉁이다) — 동그란 눈이 0.50~0.72 로
      //    나왔다 ② 줄마다 양 끝을 이어 구멍을 메워도 **앤티에일리어싱 한 줄**에
      //    흔들려 0.79~0.91 이었다 (머리가 작은 마리는 눈이 16px 이라 한 픽셀이 6% 다).
      // ⚠️ 그래서 **「기울었나」를 바로 잰다** — 줄마다 «가운데»(양 끝의 가운뎃점)를
      //    구해 y 에 대한 기울기를 낸다. 동그란 눈망울은 어느 줄에서나 가운데가
      //    같은 자리라 0 에 가깝고, 기운 아몬드는 위로 갈수록 한쪽으로 밀린다.
      //    **한 픽셀 흔들림은 회귀가 먹어 준다** (한 줄이 아니라 전체 추세다)
      pupils.forEach(k => {
        if (k.n < TILT_MIN_N) return;        // 입처럼 작은 덩어리는 건너뛴다
        const W = k.a1 - k.a0 + 1, pts = [];
        for (let y = k.b0; y <= k.b1; y++) {
          let l = -1, r = -1;
          for (let x = k.a0; x <= k.a1; x++) if (isInk(x, y)) { if (l < 0) l = x; r = x; }
          if (l >= 0) pts.push([y, (l + r) / 2]);
        }
        if (pts.length < 5 || W < 4) return;
        // 최소제곱으로 기울기 하나 — 폭으로 나눠 크기를 안 타게 한다
        const my = pts.reduce((t2, q) => t2 + q[0], 0) / pts.length;
        const mc = pts.reduce((t2, q) => t2 + q[1], 0) / pts.length;
        let sxy = 0, sxx = 0;
        pts.forEach(([y, cx]) => { sxy += (y - my) * (cx - mc); sxx += (y - my) ** 2; });
        if (!sxx) return;
        const slope = Math.abs(sxy / sxx);
        if (slope > tiltMax) tiltMax = slope;
        tiltN++;
        if (slope > TILT_MAX)
          bad.push(`${c.name}: 눈망울이 기울어 있다 (줄마다 가운데가 ${slope.toFixed(2)}`
            + `px 씩 밀린다 · ${TILT_MAX} 까지다 · 「위로 올라간 눈」은 안 쓴다)`);
      });

      // ── ⑧ **흰자가 없는가** — 밝은 덩어리는 «빛점»뿐이어야 한다
      //
      // ⚠️⚠️ 사람이 서른 마리를 놓고 **흰자가 있는 열여섯을 «정확히» 집어**
      //    「사람 눈 같아서 안 귀엽다」고 했다. 남겨 둔 것은 흰자가 없는 눈뿐이다 —
      //    사람이 고른 것이 규칙이 된 자리라, 그 규칙을 여기 못 박는다.
      // ⚠️ **④는 이것을 못 본다** — 흰자가 있어도 빛은 두 점 그대로다.
      //    가르는 것은 「밝은 덩어리가 눈동자에 비해 얼마나 큰가」다
      //    (지금 9% 안팎 · 흰자가 있던 그림은 257%였다)
      let whiteTot = 0;
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
        if (A(x, y) < 200) continue;
        const p = RGB(x, y);
        if (p[0] >= WHITE_LUM && p[1] >= WHITE_LUM && p[2] >= WHITE_LUM) whiteTot++;
      }
      const pupilTot = pupils.reduce((t2, k) => t2 + k.n, 0);
      const wr = whiteTot / Math.max(1, pupilTot);
      if (wr > WHITE_MAX)
        bad.push(`${c.name}: 눈에 흰자가 있다 (거의 흰 칠이 눈동자 넓이의 ${(wr * 100).toFixed(0)}%`
          + ` · ${WHITE_MAX * 100}% 를 넘으면 빛점이 아니라 흰자다)`);
      white = Math.max(white, wr);

      const got = per.filter(n => n >= 2).length * 2 + per.filter(n => n === 1).length;
      if (got < HI_WANT)
        bad.push(`${c.name}: 눈의 빛이 ${got}점이다 (눈마다 두 점 · ${HI_WANT}점이어야 한다`
          + ` · 눈동자 ${pupils.length}개에 [${per.join(',')}])`);
      hi += got; hiN++;
    }

    // ── ⑦ 둘레가 먹선인가 — 줄마다 «제일 바깥 칠»에서 안으로 `LINE_IN` 들어간 점을 본다
    // ⚠️ **상자가 아니라 «칠»에서 되짚는다** — 상자로 재면 귀·꼬리가 비어 있는 줄에서
    //    배경을 집는다. 줄마다 왼쪽 끝·오른쪽 끝 둘을 보고 몇 점 중 몇 점인지를 낸다
    let lineHit = 0, lineTot = 0;
    for (let y = y0 + LINE_IN; y <= y1 - LINE_IN; y++) {
      let lx = -1, rx2 = -1;
      for (let x = 0; x < SZ; x++) if (A(x, y) > 200) { lx = x; break; }
      for (let x = SZ - 1; x >= 0; x--) if (A(x, y) > 200) { rx2 = x; break; }
      if (lx < 0 || rx2 - lx < LINE_IN * 3) continue;
      [lx + LINE_IN, rx2 - LINE_IN].forEach(x => {
        lineTot++;
        if (near(RGB(x, y), LINE_HEX, LINE_TOL)) lineHit++;
      });
    }
    const lr = lineTot ? lineHit / lineTot : 0;
    if (lineTot < 40) bad.push(`${c.name}: 둘레를 잴 수가 없다 (${lineTot}점)`);
    else if (lr > LINE_MAX) bad.push(`${c.name}: 둘레에 먹선이 둘려 있다 (${(lr * 100).toFixed(0)}%`
      + ` · ${LINE_MAX * 100}% 를 넘으면 선이다 · 형태는 «색 면»으로 가른다)`);
    line += lr / out.length; lineN += lineTot;

    // ── ⑨ 귀 이음매 — **귀가 머리에서 «떨어진 자리»가 없는가**
    //
    // 사람이 콕 집어 요청한 자리다 (「귀가 머리 부분에서 떨어진 부분이 없이 잘 이어
    // 붙여 달라」). 귀의 밑동이 머리 «밖»에서 만나면 그 줄에서 실루엣이 한 번
    // «안으로» 꺾였다가 다시 벌어진다 — 눈에는 턱으로 보인다.
    // ⚠️⚠️ **①~⑧ 어느 것도 이 축을 못 본다** — 턱이 나도 잘리지도, 비뚤지도, 선이
    //    생기지도 않는다. 0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
    // ⚠️ **귀를 «떼고 그린 그림»과 견주어** 귀의 자리를 찾는다 — 표를 읽으면
    //    「스스로 맞는」 검사가 된다 (`checkavatar` 의 「맨몸↔옷」과 같은 방법이다)
    if (c.noEar) {
      const B = c.noEar;
      const AB = (x, y) => B[(y * SZ + x) * 4 + 3];
      const edge = (px, y) => {
        let l = -1, r = -1;
        for (let x = 0; x < SZ; x++) if (px[(y * SZ + x) * 4 + 3] > 24) { l = x; break; }
        for (let x = SZ - 1; x >= 0; x--) if (px[(y * SZ + x) * 4 + 3] > 24) { r = x; break; }
        return [l, r];
      };
      let tip = -1, headTop = -1;
      for (let y = 0; y < SZ && tip < 0; y++) for (let x = 0; x < SZ; x++)
        if (A(x, y) > 24 && AB(x, y) <= 24) { tip = y; break; }
      for (let y = 0; y < SZ && headTop < 0; y++) if (edge(B, y)[0] >= 0) headTop = y;
      // 머리가 제일 넓어지는 줄까지 본다 — 그 아래는 몸통이라 다시 좁아지는 것이 맞는다
      let wide = headTop, wideW = -1;
      for (let y = headTop; y < Math.min(SZ, headTop + Math.round(SZ * 0.42)); y++) {
        const [l, r] = edge(B, y);
        if (l >= 0 && r - l > wideW) { wideW = r - l; wide = y; }
      }
      let notch = 0, rows = 0, pl = -1, pr = -1;
      for (let y = Math.max(0, tip) + 2; y <= wide; y++) {
        const [l, r] = edge(P, y);
        if (l < 0) continue;
        if (pl >= 0) { notch = Math.max(notch, l - pl, pr - r); rows++; }
        pl = l; pr = r;
      }
      if (rows < 10) bad.push(`${c.name}: 귀 이음매를 잴 수가 없다 (${rows}줄)`);
      else if (notch > SEAM_MAX)
        bad.push(`${c.name}: 귀가 머리에서 떨어져 있다 (실루엣이 한 줄에 ${notch}px 안으로 꺾인다`
          + ` · ${SEAM_MAX}px 까지 · 귀 밑동을 머리 «안»에 두고 머리를 나중에 그린다)`);
      seam = Math.max(seam, notch); seamRows += rows; seamN++;
    }

    // ── ⑩ 꼬리가 «몸 밖으로» 보이는가
    //
    // 「꼬리의 실루엣이 탐스럽게」로 받은 자리다. 꼬리는 몸 «뒤»에 그리므로 작게 두면
    // 밑동이 통째로 가려 **갈고리 한 조각**만 남는다 (처음에 실제로 그랬다).
    // ⚠️ 꼬리를 떼고 그려 **달라지는 몫**으로 잰다 — 색으로 찾으면 털색이라 몸과 안 갈린다
    if (c.noTail) {
      let outside = 0;
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
        if (A(x, y) > 200 && c.noTail[(y * SZ + x) * 4 + 3] <= 24) outside++;
      if (outside < TAIL_MIN)
        bad.push(`${c.name}: 꼬리가 몸에 가려 안 보인다 (몸 밖으로 ${outside}px · ${TAIL_MIN}px 는 돼야 한다)`);
      if (outside < tailMin) tailMin = outside;
      tailN++;
    }

    // ── ⑤ 볼터치가 있는가 — 얼굴에서 «볼터치 색 쪽으로 끌려간» 점을 센다
    const BL = [255, 174, 184];   // 사람 SVG 의 볼터치 색(#ffaeb8)
    const dTo = (p) => Math.hypot(p[0] - BL[0], p[1] - BL[1], p[2] - BL[2]);
    const tallyF = {};
    for (let y = fy0; y <= fy1; y++) for (let x = 0; x < SZ; x++) {
      if (A(x, y) < 240) continue;
      const k = RGB(x, y).join(',');
      tallyF[k] = (tallyF[k] || 0) + 1;
    }
    const coatK = Object.keys(tallyF).sort((a2, b2) => tallyF[b2] - tallyF[a2])[0];
    const coatD = coatK ? dTo(coatK.split(',').map(Number)) : 0;
    let bl = 0;
    for (let y = fy0; y <= y1; y++) for (let x = 0; x < SZ; x++)
      if (A(x, y) > 200 && dTo(RGB(x, y)) < coatD * BLUSH_K) bl++;
    if (bl < BLUSH_MIN) bad.push(`${c.name}: 볼터치가 없다 (볼터치 색 쪽으로 끌려간 점 ${bl})`);
    blush += bl / out.length;

    // ── ⑥ 속성 색 — 아래 절반에서 **제일 많이 쓰인 색**(= 털색)을 모은다.
    // ⚠️ 한 점을 찍어 재면 그 점이 배 판이나 발에 걸려 **옅은 색 둘이 비슷해진다**
    //    (바람 ↔ 물이 22 로 나왔다 — 그림이 아니라 잰 자리가 틀린 것이다)
    const tally = {};
    for (let y = Math.round((y0 + y1) / 2); y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (A(x, y) < 240) continue;
      const p = RGB(x, y), k = p.join(',');
      tally[k] = (tally[k] || 0) + 1;
    }
    const top = Object.keys(tally).sort((a2, b2) => tally[b2] - tally[a2])[0];
    if (top) (attrMean[c.attr] = attrMean[c.attr] || []).push(top.split(',').map(Number));
  }

  // 속성 여섯이 «서로» 갈리는가 — 묽혔다고 속성이 안 읽히면 안 된다
  const mean = {};
  Object.keys(attrMean).forEach(k => {
    const a = attrMean[k];
    mean[k] = [0, 1, 2].map(i => a.reduce((s, p) => s + p[i], 0) / a.length);
  });
  const ks = Object.keys(mean);
  let worst = 1e9, pair = '';
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const d = Math.hypot(...[0, 1, 2].map(n => mean[ks[i]][n] - mean[ks[j]][n]));
    if (d < worst) { worst = d; pair = `${ks[i]}↔${ks[j]}`; }
  }
  if (ks.length !== 6) bad.push(`속성이 ${ks.length}가지만 나왔다 (여섯이어야 한다)`);
  else if (worst < ATTR_DE) bad.push(`속성 색이 안 갈린다 (제일 가까운 ${pair} 가 ${worst.toFixed(0)} · ${ATTR_DE} 는 돼야 한다)`);

  console.log(`크리처 ${out.length}마리 — 대칭 ${sym.toFixed(2)}(최소 ${symMin.toFixed(2)}) · 눈 ${(eyes / Math.max(1, eyeN) * 100).toFixed(1)}%(최소 ${(eyeMin * 100).toFixed(1)}% · ${eyeN}마리)`
    + ` · 빛 ${(hi / Math.max(1, hiN)).toFixed(1)}점(${hiN}마리) · 볼터치 ${blush.toFixed(0)}점 · 거의 흰 칠 ÷ 눈동자 ${(white * 100).toFixed(0)}%`
    + ` · 둘레의 먹선 ${(line * 100).toFixed(0)}%(${lineN}점 · 없어야 한다) · 속성 제일 가까운 쌍 ${pair} ${worst.toFixed(0)}`);
  // **몇 마리를 쟀는지 통과할 때도 낸다** — 0건이 「통과」인지 「한 번도 안 쟀다」인지를 가른다
  console.log(`  눈망울 기울기 — 제일 심한 것 ${tiltMax.toFixed(2)}px/줄 (${tiltN}개)`);
  console.log(`  귀 이음매 — 제일 깊은 턱 ${seam}px (${seamN}마리 · ${seamRows}줄)`
    + ` · 꼬리가 몸 밖으로 제일 적게 나온 마리 ${tailMin === 1e9 ? '-' : tailMin}px (${tailN}마리)`);
  console.log(`  (상자 가장자리 ${EDGE}px · 대칭 ${SYM_MIN} · 빛 ${HI_WANT}점 · 흰자 ${WHITE_MAX * 100}% · 둘레 먹선 ${LINE_MAX * 100}% 아래 · 눈 크기는 재기만 한다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.slice(0, 20).forEach(m => console.log('   ' + m));
    if (bad.length > 20) console.log(`   … 그리고 ${bad.length - 20}건 더`);
    process.exit(1);
  }
  if (out.length !== 30) { console.log(`❌ 서른 마리 중 ${out.length}마리만 쟀다`); process.exit(1); }
  console.log('✅ 서른 마리가 다 상자 안에 들어오고, 정면을 보고, 눈이 크고, 선 없이 색 면으로 서 있다');
})().catch(e => { console.error(e); process.exit(1); });
