// 비트맵 한 장을 «대고 따라 그려» SVG 로 내놓는다 (raster → vector).
//
// 사람이 보내 준 고양이 SVG 가 이 방식으로 만들어진 것이다 — 도형을 얹은 것이 아니라
// **원본 그림의 경계를 따라간 곡선**이라, 좌표에 `.5` 가 섞여 있다(`456,249.5`).
// 그것이 격자 «모서리»를 지난 자리라는 흔적이다.
//
//   node tools/trace.js <in.png> <out.svg> [--colors 6] [--eps 0.7] [--smooth 2]
//
// ⚠️ **PNG 를 읽고 쓰는 일은 `tools/png.js` 한 곳이다** — 여기는 그 위에 추적만 얹는다
//    (`pnglum.js` 와 같은 규칙 · 디코더가 세 벌이 될 뻔한 자리다).
//
// 하는 일 넷:
//   ① **색을 모은다**  — 많이 쓰인 색 N 개로 줄이고, 픽셀마다 제일 가까운 것에 붙인다
//   ② **경계를 딴다**  — 안쪽 칸의 네 변 중 «바깥과 맞닿은 변»만 모아 고리로 잇는다.
//                        계단 모양이지만 **원본과 한 픽셀도 안 어긋난다**
//   ③ **계단을 눕힌다** — 모서리를 깎고(Chaikin) 군더더기 점을 지운다(Douglas–Peucker)
//   ④ **곡선으로 쓴다** — 변의 «가운뎃점»을 지나는 2차 곡선이라 이음매가 매끄럽다
//
// ⚠️ 색 하나가 path 하나다(`fill-rule="evenodd"`) — 구멍(눈·배판)이 저절로 뚫린다.
'use strict';
const fs = require('fs');
const { decode } = require('./png');

// ── ① 색 모으기 ─────────────────────────────────────────────────────────────
// ⚠️ **평균으로 뽑지 않는다** — 평균은 경계의 섞인 색(안티에일리어싱)을 «새 색»으로
//    만들어 버려서, 그림에 없던 중간색 층이 하나 더 생긴다. 많이 쓰인 색을 그대로 쓴다.
function palette(px, w, h, n) {
  const cnt = new Map();
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3];
    if (a < 128) continue;                       // 비친 자리는 색으로 세지 않는다
    // 5단위로 묶어 센다 — 안티에일리어싱 때문에 거의 같은 색이 수천 가지가 된다
    const k = (px[i * 4] >> 2 << 12) | (px[i * 4 + 1] >> 2 << 6) | (px[i * 4 + 2] >> 2);
    const e = cnt.get(k);
    if (e) { e.n++; e.r += px[i * 4]; e.g += px[i * 4 + 1]; e.b += px[i * 4 + 2]; }
    else cnt.set(k, { n: 1, r: px[i * 4], g: px[i * 4 + 1], b: px[i * 4 + 2] });
  }
  return [...cnt.values()].sort((a, b) => b.n - a.n).slice(0, n)
    .map(e => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
}

// ── ② 경계 따기 ─────────────────────────────────────────────────────────────
// 안쪽 칸의 네 변 가운데 **바깥과 맞닿은 변**만 남기고 머리-꼬리로 잇는다.
// ⚠️ **방향을 맞춰서 담는다**(안쪽이 오른쪽). 방향이 없으면 대각선으로만 닿은 자리에서
//    갈림길이 생겨 고리가 엉킨다 — 방향이 있으면 어느 꼭짓점에서도 다음 변이 하나다.
function contours(inside, w, h) {
  const key = (x, y) => y * (w + 1) + x;
  const next = new Map();                        // 꼭짓점 → 갈 수 있는 꼭짓점들
  const push = (ax, ay, bx, by) => {
    const k = key(ax, ay), v = next.get(k);
    if (v) v.push([bx, by]); else next.set(k, [[bx, by]]);
  };
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : inside[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) push(x, y, x + 1, y);           // 위
    if (!at(x + 1, y)) push(x + 1, y, x + 1, y + 1);   // 오른쪽
    if (!at(x, y + 1)) push(x + 1, y + 1, x, y + 1);   // 아래
    if (!at(x - 1, y)) push(x, y + 1, x, y);           // 왼쪽
  }
  const loops = [];
  for (const [k0, list] of next) {
    while (list.length) {
      const loop = [[k0 % (w + 1), Math.floor(k0 / (w + 1))]];
      let [cx, cy] = list.pop();
      let guard = 0;
      while (!(cx === loop[0][0] && cy === loop[0][1]) && guard++ < w * h * 8) {
        loop.push([cx, cy]);
        const nx = next.get(key(cx, cy));
        if (!nx || !nx.length) break;
        [cx, cy] = nx.pop();
      }
      if (loop.length > 3) loops.push(loop);
    }
  }
  return loops;
}

// ── ③ 계단 눕히기 ───────────────────────────────────────────────────────────
// 모서리를 1/4 씩 깎는다 — 닫힌 고리라 양 끝이 저절로 이어진다
function chaikin(p) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

// 군더더기 점을 지운다 (닫힌 고리는 제일 먼 두 점으로 갈라서 두 번 돌린다)
function simplify(p, eps) {
  const d2 = (q, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    if (!L) return (q[0] - a[0]) ** 2 + (q[1] - a[1]) ** 2;
    let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L;
    t = Math.max(0, Math.min(1, t));
    return (q[0] - a[0] - t * dx) ** 2 + (q[1] - a[1] - t * dy) ** 2;
  };
  // ⚠️⚠️ **번호가 아니라 «점»을 돌려준다.** 번호를 그대로 내보냈더니 `toPath` 가
  //    `c[0]` 에서 undefined 를 읽어 path 가 통째로 NaN 이 됐고 — **화면에는 오류가
  //    하나도 안 뜨고 그냥 흰 그림**이 나왔다 (SVG 는 못 읽는 d 를 조용히 버린다)
  const dp = (s, e) => {               // s..e 에서 남길 점의 «번호»
    let far = -1, best = 0;
    for (let i = s + 1; i < e; i++) {
      const v = d2(p[i], p[s], p[e]);
      if (v > best) { best = v; far = i; }
    }
    if (best <= eps * eps) return [s];
    return dp(s, far).concat(dp(far, e));
  };
  if (p.length < 4) return p;
  let far = 1, best = 0;
  for (let i = 1; i < p.length; i++) {
    const v = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2;
    if (v > best) { best = v; far = i; }
  }
  return dp(0, far).concat(dp(far, p.length - 1)).concat([p.length - 1]).map(i => p[i]);
}

// ── ④ 곡선으로 쓰기 ─────────────────────────────────────────────────────────
// ⚠️ 꼭짓점을 그대로 «지나게» 쓰면 거기서 각이 진다. **변의 가운뎃점**을 지나고
//    꼭짓점을 제어점으로 쓰면 앞 구간의 접선이 그대로 이어져 매끄럽다
//    (`avatar.js` 의 밑단을 `S` 로 잇는 것과 같은 규칙이다).
const n1 = v => (Math.round(v * 10) / 10);
function toPath(p) {
  if (p.length < 3) return '';
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(p[p.length - 1], p[0]);
  let d = `M${n1(m0[0])},${n1(m0[1])}`;
  for (let i = 0; i < p.length; i++) {
    const c = p[i], m = mid(c, p[(i + 1) % p.length]);
    d += `Q${n1(c[0])},${n1(c[1])} ${n1(m[0])},${n1(m[1])}`;
  }
  return d + 'Z';
}

// ── 한 장을 통째로 ──────────────────────────────────────────────────────────
function trace(buf, { colors = 6, eps = 0.7, smooth = 2, name = 'traced' } = {}) {
  const im = decode(buf), { w, h } = im, px = im.px;
  const pal = palette(px, w, h, colors);
  const near = i => {                    // 제일 가까운 팔레트 색
    let b = -1, bv = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const v = (px[i * 4] - pal[k][0]) ** 2 + (px[i * 4 + 1] - pal[k][1]) ** 2
        + (px[i * 4 + 2] - pal[k][2]) ** 2;
      if (v < bv) { bv = v; b = k; }
    }
    return b;
  };
  const lab = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] >= 128) lab[i] = near(i);

  // ⚠️ **넓은 층을 먼저 깐다** — 좁은 층(눈·볼터치)이 그 위에 와야 안 가려진다.
  //    색을 «빈도»로 뽑았으므로 그 순서가 곧 넓이 순서다
  const layers = [];
  for (let k = 0; k < pal.length; k++) {
    // 이 색 «이상»을 채운다 — 위층이 덮을 자리까지 깔아 두면 경계에 틈이 안 생긴다
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < w * h; i++) if (lab[i] >= k) { mask[i] = 1; n++; }
    if (!n) continue;
    let d = '';
    contours(mask, w, h).forEach(loop => {
      let p = loop;
      for (let s = 0; s < smooth; s++) p = chaikin(p);
      p = simplify(p, eps);
      if (p.length > 2) d += toPath(p);
    });
    if (d) layers.push({ hex: '#' + pal[k].map(v => v.toString(16).padStart(2, '0')).join(''), d, n });
  }
  const body = layers.map((L, i) =>
    `<path id="${name}-${i}" fill="${L.hex}" fill-rule="evenodd" d="${L.d}"/>`).join('\n');
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">\n${body}\n</svg>\n`, layers, w, h };
}

module.exports = { trace };

if (require.main === module) {
  const a = process.argv.slice(2);
  const num = (f, dflt) => { const i = a.indexOf(f); return i < 0 ? dflt : Number(a[i + 1]); };
  const [inp, outp] = a.filter(s => !s.startsWith('--') && !/^[\d.]+$/.test(s));
  if (!inp || !outp) { console.error('node tools/trace.js <in.png> <out.svg> [--colors 6] [--eps 0.7] [--smooth 2]'); process.exit(2); }
  const r = trace(fs.readFileSync(inp), {
    colors: num('--colors', 6), eps: num('--eps', 0.7), smooth: num('--smooth', 2),
    name: outp.replace(/.*\//, '').replace(/\.svg$/, ''),
  });
  fs.writeFileSync(outp, r.svg);
  console.log(`${inp} ${r.w}×${r.h} → ${outp} (${(r.svg.length / 1024).toFixed(1)}KB · 층 ${r.layers.length})`);
  r.layers.forEach(L => console.log(`  ${L.hex} · ${L.n}칸`));
}
