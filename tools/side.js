// ═══════════════════════════════════════════════════════════════
//  옆선을 줄마다 재서 «볼록 / 직선 / 오목»으로 찍는다 (npm run side)
// ═══════════════════════════════════════════════════════════════
//
// 「둥글지 않다」·「뾰족하다」는 눈으로는 서로 다른 것을 가리키기 쉽다.
// 이 도구는 그 말을 **줄 번호와 부호**로 바꿔 준다 — 그러면 고칠 자리가 한 곳으로 좁혀진다.
//
//   npm run side                     기본 체형 · 슬라이더 전부 100%
//   npm run side -- hip=1.5 thigh=1.5   그 배율로
//   npm run side -- from=160 to=280 w=1
//
// 읽는 법 — **곡률의 부호**가 전부다.
//   볼록  살이 바깥으로 부푼다 (둥글다)
//   직선  사선으로 곧게 떨어진다
//   오목  안으로 패였다 — 「마름모」·「뾰족」은 대개 여기 두세 줄이 원인이다
//
// ⚠️ **팔·손은 뺀다.** 몸 옆선을 재려는데 팔이 바깥에 있으면 팔 윤곽을 재게 된다
// (기본 체형에서 옆구리의 «혹»이 실은 손이었던 적이 있다).
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^([a-z]+)=([\d.]+)$/.exec(a);
  if (m) args[m[1]] = Number(m[2]);
}
const from = args.from || 160, to = args.to || 275, w = args.w || 0;
const tune = {};
for (const k of ['torso', 'waist', 'hip', 'arm', 'thigh', 'calf', 'face']) {
  if (args[k] != null) tune[k] = args[k];
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  const rows = await page.evaluate(async (o) => {
    const D = window.GameData, S = 4;
    const vb = window.Avatar.bodyMetrics(0).vb;
    const W = Math.round(vb.w * S), H = Math.round(vb.h * S);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    // 몸통·엉덩이·허벅지·종아리만 남긴다 (팔·손·머리는 옆선이 아니다)
    const wrap = document.createElement('div');
    wrap.innerHTML = window.Avatar.build(outfit, o.w, o.tune);
    const root = wrap.firstElementChild;
    [...root.querySelectorAll('[data-part]')].forEach(n => {
      if (!n.matches('[data-part="hip"],[data-part="thigh"],[data-part="torso"],[data-part="calf"]')) n.remove();
    });
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(root.outerHTML); });
    ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const edge = y => {
      const row = Math.round(y * S);
      for (let x = W - 1; x >= 0; x--) if (d[((row * W) + x) * 4 + 3] > 128) return x / S + vb.x - 100;
      return null;
    };
    const out = [];
    for (let y = o.from; y <= o.to; y++) {
      const a = edge(y - 3), c = edge(y), e = edge(y + 3);
      if (a == null || c == null || e == null) continue;
      out.push({ y: y, x: +c.toFixed(2),
                 slope: +((e - a) / 6).toFixed(2),
                 k: +(c - (a + e) / 2).toFixed(3) });   // + 볼록 · − 오목
    }
    return out;
  }, { from: from, to: to, w: w, tune: Object.keys(tune).length ? tune : null });

  const FLAT = 0.06;
  const name = k => k > FLAT ? '볼록' : (k < -FLAT ? '오목' : '직선');
  const say = Object.keys(tune).length
    ? Object.entries(tune).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' · ')
    : '슬라이더 전부 100%';
  console.log(`옆선 — 체형 ${w} · ${say} (오른쪽 반폭 · y ${from}~${to})`);
  console.log('  y   반폭   기울기   곡률');
  for (const r of rows) {
    console.log(`${String(r.y).padStart(4)} ${String(r.x).padStart(6)}`
      + ` ${String(r.slope).padStart(7)} ${String(r.k).padStart(7)}  ${name(r.k)}`);
  }
  // 이어지는 «오목»·«직선» 구간을 따로 모아 준다 — 고칠 자리는 대개 여기다
  const runs = [];
  let cur = null;
  for (const r of rows) {
    const n = name(r.k);
    if (!cur || cur.n !== n) { cur = { n: n, a: r.y, b: r.y }; runs.push(cur); }
    else cur.b = r.y;
  }
  const bad = runs.filter(r => r.n !== '볼록' && r.b - r.a >= 4);
  console.log(bad.length
    ? '\n둥글지 않은 구간 — ' + bad.map(r => `y${r.a}~${r.b} ${r.n}`).join(' · ')
    : '\n네 줄 이상 이어지는 직선·오목 구간 없음');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
