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
const HI_WANT = 4;       // 빛점 — 눈 둘 × 두 점. 감은 눈은 안 본다
const ATTR_DE = 28;      // 속성끼리 이만큼은 색이 갈려야 한다 (ΔE 비슷한 값)
const PUPIL_MAX = 0.22;  // 눈동자 상자는 그림의 이만큼 안이다 (먹선 덩어리를 가른다)
const PUPIL_AR = [0.55, 1.8];
const PUPIL_FILL = 0.30; // 눈동자는 «꽉 찬» 덩어리다 — 테두리 «고리»를 가른다
// ⚠️⚠️ 배 판의 테두리(`plate`)가 먹선 색이라 **고리 하나가 눈동자로 잡혔다** —
//    작고(16%) 둥글고(1.2) 크기 빗장을 다 지나서, 그 고리 «안»의 옅은 배 색이
//    「흰자 543%」로 나왔다. 재 보면 눈동자는 상자의 48~70% 가 차 있고 고리는 12% 다
const WHITE_MAX = 0.30;  // 눈동자 안의 밝은 덩어리는 이만큼 안이어야 «빛점»이다 (흰자를 가른다)   // 가로÷세로 — 둥글어야 한다 (입·눈꺼풀 획을 가른다)
// ── ⑦ 먹선 — **둘레가 먹선인가.** 실루엣을 묶는 것이 이 선 하나라
// (`creature.js` 의 「실루엣」 ⓐ), 없으면 44px 에서 통째로 «색 얼룩»이 된다.
// ⚠️⚠️ **①~⑥ 어느 것도 이 축을 못 본다** — 선을 통째로 걷어도 잘리지도, 비뚤지도,
//    빛이 모자라지도 않는다. 0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
const LINE_HEX = '#44353d';
const LINE_TOL = 30;     // 안티에일리어싱이 끼므로 조금 넉넉히
// ⚠️⚠️ **44 로 두었더니 사보타주가 «절반만» 잡혔다** — 어두운 속성의 털색이 그
//    품 안에 들어와 「선이 없는데 선이 있다」가 됐다. 양쪽을 다 재서 골랐다:
//    26·30·34 는 **정상 99% · 선을 걷으면 1%(30마리 다)** 로 한결같다
const LINE_MIN = 0.80;   // 둘레의 이만큼은 먹선이어야 한다
const LINE_IN = 2;       // 가장자리에서 이만큼 안쪽을 본다 (가장자리 한 줄은 반투명이다)

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
    for (const c of list) {
      // ⚠️ **배경 판도 그림자도 끄고 잰다** — 판을 깔아 두면 「상자에 꽉 찼다」가 늘 참이라
      //    잘림을 영영 못 보고, 그림자는 바닥에 번져 실루엣을 흐린다
      const svg = Creature.draw(c, { flat: true, noShadow: true, size: SZ });
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const im = new Image();
      await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
      g.clearRect(0, 0, SZ, SZ);
      g.drawImage(im, 0, 0, SZ, SZ);
      res.push({ id: c.id, name: c.name, attr: c.attr, eye: c.art.eye,
        px: Array.from(g.getImageData(0, 0, SZ, SZ).data) });
    }
    return res;
  }, SZ);
  await browser.close();

  const bad = [];
  const attrMean = {};
  let sym = 0, eyes = 0, hi = 0, blush = 0, eyeMin = 9, symMin = 9, eyeN = 0, hiN = 0;
  let line = 0, lineN = 0, white = 0;

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
    const isInk = (x, y) => A(x, y) > 200 && near(RGB(x, y), '#4a3a42', 26);
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
      // ── ⑧ **흰자가 없는가** — 밝은 덩어리는 «빛점»뿐이어야 한다
      //
      // ⚠️⚠️ 사람이 서른 마리를 놓고 **흰자가 있는 열여섯을 «정확히» 집어**
      //    「사람 눈 같아서 안 귀엽다」고 했다. 남겨 둔 것은 흰자가 없는 눈뿐이다 —
      //    사람이 고른 것이 규칙이 된 자리라, 그 규칙을 여기 못 박는다.
      // ⚠️ **④는 이것을 못 본다** — 흰자가 있어도 빛은 두 점 그대로다.
      //    가르는 것은 「밝은 덩어리가 눈동자에 비해 얼마나 큰가」다
      //    (지금 9% 안팎 · 흰자가 있던 그림은 257%였다)
      let whiteMax = 0;
      pupils.forEach(k => lit.forEach(w => {
        if (w.cx >= k.a0 && w.cx <= k.a1 && w.cy >= k.b0 && w.cy <= k.b1)
          whiteMax = Math.max(whiteMax, w.n / Math.max(1, k.n));
      }));
      if (whiteMax > WHITE_MAX)
        bad.push(`${c.name}: 눈에 흰자가 있다 (밝은 덩어리가 눈동자의 ${(whiteMax * 100).toFixed(0)}%`
          + ` · ${WHITE_MAX * 100}% 를 넘으면 빛점이 아니라 흰자다)`);
      white = Math.max(white, whiteMax);

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
    else if (lr < LINE_MIN) bad.push(`${c.name}: 둘레에 먹선이 없다 (${(lr * 100).toFixed(0)}% · ${LINE_MIN * 100}% 는 돼야 한다)`);
    line += lr / out.length; lineN += lineTot;

    // ── ⑤ 볼터치가 있는가 — 얼굴에서 «볼터치 색 쪽으로 끌려간» 점을 센다
    const BL = [255, 157, 180];
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
    + ` · 빛 ${(hi / Math.max(1, hiN)).toFixed(1)}점(${hiN}마리) · 볼터치 ${blush.toFixed(0)}점 · 눈 속 제일 큰 밝은 덩어리 ${(white * 100).toFixed(0)}%`
    + ` · 둘레의 먹선 ${(line * 100).toFixed(0)}%(${lineN}점) · 속성 제일 가까운 쌍 ${pair} ${worst.toFixed(0)}`);
  console.log(`  (상자 가장자리 ${EDGE}px · 대칭 ${SYM_MIN} · 빛 ${HI_WANT}점 · 흰자 ${WHITE_MAX * 100}% · 둘레 먹선 ${LINE_MIN * 100}% 까지 · 눈 크기는 재기만 한다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.slice(0, 20).forEach(m => console.log('   ' + m));
    if (bad.length > 20) console.log(`   … 그리고 ${bad.length - 20}건 더`);
    process.exit(1);
  }
  if (out.length !== 30) { console.log(`❌ 서른 마리 중 ${out.length}마리만 쟀다`); process.exit(1); }
  console.log('✅ 서른 마리가 다 상자 안에 들어오고, 정면을 보고, 눈이 크고, 먹선이 둘러져 있다');
})().catch(e => { console.error(e); process.exit(1); });
