// 목 옆선을 줄마다 재 본다 — 「옷의 목둘레와 신체 목둘레가 안 맞는다」를 눈이 아니라 수치로.
//
// ⚠️ **SVG 좌표로 재면 안 된다.** 목과 옷은 서로 다른 변환 그룹 안에 있어서
// `isPointInFill` 로 얻은 반폭이 **각자 제 좌표계의 값**이다 — 나란히 놓아도
// 비교가 안 된다 (처음에 그렇게 재서 목 9 · 옷 37 이라는 헛값을 봤다).
// 화면에 찍힌 것을 그대로 본다: 래스터로 그려 놓고 줄마다 색을 훑는다.
//
//   node tools/neckscan.js [top=top_tee] [face=1] [torso=1] [w=0]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.Avatar && window.GameData);

  const arg = {};
  process.argv.slice(2).forEach(s => { const [k, v] = s.split('='); arg[k] = v; });

  const out = await p.evaluate(async (arg) => {
    const A = window.Avatar, D = window.GameData;
    const tune = {};
    A.TUNE_KEYS.forEach(k => { tune[k] = arg[k] ? +arg[k] : 1; });
    const bw = arg.w ? +arg.w : 0;
    const W = D.WARDROBE;
    const list = Array.isArray(W) ? W : [].concat.apply([], Object.values(W));
    const topId = arg.top || 'top_tee';
    const item = list.find(x => x && x.id === topId) || {};
    const outfit = { top: topId, bottom: 'bottom_skirt', hair: 'hair_long_straight' };

    // 4배로 그려 서브픽셀까지 본다
    const K = 4, CW = 200 * K, CH = 348 * K;
    const svg = A.build(outfit, bw, tune);
    const img = new Image();
    await new Promise(r => {
      img.onload = r;
      img.src = 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg);
    });
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    const ctx = cv.getContext('2d');
    const vb = A.bodyMetrics(bw).vb;
    ctx.drawImage(img, vb.x * K, vb.y * K, vb.w * K, vb.h * K);
    const d = ctx.getImageData(0, 0, CW, CH).data;
    const at = (x, y) => { const i = (y * CW + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const near = (c, t) => c[3] > 250 && Math.abs(c[0] - t[0]) <= 3
      && Math.abs(c[1] - t[1]) <= 3 && Math.abs(c[2] - t[2]) <= 3;
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

    // 살색 · 옷색을 실제 픽셀에서 집는다 (상수를 베끼면 어긋난다)
    const SKIN = at(100 * K, 92 * K);                 // 목 한가운데
    const CLOTH = hex(item.color || '#ffb8d9');

    // ⚠️ **목은 그라데이션이다** (neckG: SKIN_SH → SKIN). 살색과 «똑같은지»를 물으면
    // 기둥 한가운데가 살이 아닌 것으로 나온다 (처음에 그렇게 재서 0.00 이 줄줄이 나왔다).
    // 그렇다고 «살이 아닌 것»(머리색·옷색)을 빼는 식으로 뒤집어도 안 된다 —
    // 정수리 픽셀을 머리색으로 삼았더니 몸통 50% 에서 그 자리가 **살**이라
    // 살을 통째로 제외해 버렸다. 두 끝 색 **사이**에 있는지를 직접 본다.
    const A2 = hex('#ffdcc4'), B2 = hex('#f2c6a6');   // SKIN · SKIN_SH (avatar.js)
    const between = (v, a, b) => v >= Math.min(a, b) - 4 && v <= Math.max(a, b) + 4;
    const isCloth = c => near(c, CLOTH);
    const isSkin = c => c[3] > 250 && !isCloth(c)
      && between(c[0], A2[0], B2[0]) && between(c[1], A2[1], B2[1]) && between(c[2], A2[2], B2[2]);

    // 줄마다 **중심에서 이어지는** 살의 끝과, 그 바깥에서 옷이 시작하는 x.
    // ⚠️ 「제일 오른쪽 살 픽셀」로 재면 안 된다 — 어깨·팔의 살까지 잡혀
    // 몸통 150% 에서 10.75 여야 할 값이 38.50 으로 튄다 (실제로 그랬다).
    const scan = yy => {
      const y = Math.round(yy * K);
      if (y < 0 || y >= CH) return null;
      let skin = null, cloth = null;
      for (let x = 100 * K; x < 170 * K; x++) {
        if (skin == null && !isSkin(at(x, y))) skin = x / K - 100;
        if (skin != null) { if (isCloth(at(x, y))) { cloth = x / K - 100; break; } }
      }
      return { y: yy, skin: skin, cloth: cloth };
    };
    // 옷깃이 어디쯤인지 **찾아서** 그 둘레만 잰다. 화면 y 를 박아 두면
    // 얼굴·몸통 배율에 따라 목이 위아래로 움직여 엉뚱한 줄을 재게 된다
    let top = null;
    for (let yy = 90; yy <= 200 && top == null; yy += 0.5) {
      const r = scan(yy);
      if (r && r.cloth != null) top = yy;
    }
    const rows = [];
    for (let yy = (top == null ? 100 : top - 8); yy <= (top == null ? 130 : top + 6); yy += 0.5) {
      const r = scan(yy); if (r) rows.push(r);
    }
    return { rows: rows, top: top, cut: A.neckCutBox(item.neck || 'round', tune),
      skinRGB: SKIN.slice(0, 3), clothRGB: CLOTH, neck: item.neck };
  }, arg);

  console.log('넥라인', out.neck, '· 옷깃 윗줄 y=' + out.top, '· 파낸 자리', JSON.stringify(out.cut),
    '· 살', out.skinRGB.join(','), '· 옷', out.clothRGB.join(','));
  console.log('  y    살끝   옷시작   틈');
  out.rows.forEach(r => {
    const gap = (r.skin != null && r.cloth != null) ? +(r.cloth - r.skin).toFixed(2) : null;
    console.log(String(r.y).padStart(5),
      (r.skin == null ? '   —  ' : r.skin.toFixed(2).padStart(6)),
      (r.cloth == null ? '   —  ' : r.cloth.toFixed(2).padStart(6)),
      (gap == null ? '' : (gap > 0.3 ? String(gap).padStart(6) + '  ←' : String(gap).padStart(6))));
  });
  await b.close();
})();
