// 옷 커버리지 검사 — 새 옷을 늘렸을 때 살이 옷 밖으로 나오지 않는지 본다.
//
// UI_POLICY 3 의 검증: 체형 5단계 × 모든 옷에서 **몸통 구간에 살색 픽셀이 0개**여야 한다.
// (눈으로는 잘 안 보인다 — 통통한 체형에서만 옆구리가 1~2px 나오는 식이라)
//
// 보는 구간 두 가지:
//   몸통  x 72~128 · y 112~허리(176)  — 상의·원피스는 여기를 반드시 덮는다
//         (허리 아래는 하의가 맡는다. 상의 밑단은 허리보다 16px 더 내려와 치마 허리춤을 덮는다)
//   팔    x 46~154 · y 112~소매 끝     — **소매가 덮기로 한 구간까지만** 본다.
//         (민소매는 아예 건너뛰고, 캡 소매는 캡이 끝나는 곳까지만 본다 —
//          짧게 설계한 소매를 '살이 나왔다' 고 잡으면 검사가 디자인을 막는다)
//
// 상의·하의를 같이 입었을 때도 본다:
//   허리  x 72~128 · y 168~202  — 상의 밑단과 하의 허리춤 사이로 살이 보이면 안 된다
//   (둘 중 하나라도 몸통보다 뒤로 가면 그 사이에 살색 띠가 생긴다)
//   겹침 x 88~112 · y 190~206 — 상의 밑단(hipY-2)과 하의 허리(waistY)가 겹치는 구간.
//   여기 보이는 것은 **하의 색**이어야 한다. 상의 색이 보이면 레이어 순서가 뒤집힌 것이고,
//   옷을 넣어 입은 것이 아니라 빼 입은 모양이 된다.
//   (살색 검사만으로는 이걸 못 잡는다 — 어느 쪽이 위에 있든 살은 안 보이기 때문이다)
//
// 사용: node tools/checkavatar.js  (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';
const SHOT = process.env.SHOT;   // 주면 그 경로에 대조표 이미지를 남긴다

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.Avatar && !!window.GameData);

  const res = await page.evaluate(async () => {
    const D = window.GameData, SKIN = [255, 220, 196];
    const STEPS = [0, 0.25, 0.5, 0.75, 1];      // 체형 5단계
    const WAIST = 184;                           // BODY.waistY (몸통 구간의 아래 끝 기준)
    // **build() 가 몸을 통째로 늘린다** — 재는 창도 같은 변환을 지나야 한다.
    // (예전에 이걸 빼먹고 고정 좌표로 쟀더니, 통통한 체형에서 창이 턱·목에 걸려
    //  멀쩡한 옷까지 전부 '살이 나왔다' 고 잡혔다)
    const HEAD_H = 84, BODY_SPAN = 229, FLOOR_Y = 342;
    const bodyBox = (w, x0, x1, y0, y1) => {
      const head = HEAD_H * (0.979 + (1.314 - 0.979) * w);
      const ky = 1 + (HEAD_H - head) / BODY_SPAN, kx = 1 + 0.36 * w;
      const my = y => Math.round(FLOOR_Y + (y - FLOOR_Y) * ky);
      return [Math.round(100 + (x0 - 100) * kx), Math.round(100 + (x1 - 100) * kx), my(y0), my(y1)];
    };
    const SLEEVE_H = { none: 0, cap: 20, short: 42, half: 66, long: 94 };
    const armBottom = it => Math.min(145, 120 + (SLEEVE_H[it.sleeve] == null ? 42 : SLEEVE_H[it.sleeve]) - 4);
    const cases = [];
    (D.WARDROBE.top || []).forEach(it => { if (it.kind !== 'none') cases.push({ slot: 'top', it }); });
    (D.WARDROBE.dress || []).forEach(it => { if (it.kind !== 'none') cases.push({ slot: 'dress', it }); });

    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 348;   // viewBox 와 1:1
    const ctx = canvas.getContext('2d');

    async function skinIn(svg, x0, x1, y0, y1) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.clearRect(0, 0, 200, 348);
      ctx.drawImage(img, 0, 0, 200, 348);
      const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        // 정확히 살색인 픽셀만 센다. 폭을 넓게 잡으면 **옷과 살의 경계에서 섞인 픽셀**
        // (안티에일리어싱)까지 살로 세어, 멀쩡한 옷이 1~4px 씩 걸린다
        if (d[i + 3] > 250 && Math.abs(d[i] - SKIN[0]) <= 2 &&
            Math.abs(d[i + 1] - SKIN[1]) <= 2 && Math.abs(d[i + 2] - SKIN[2]) <= 2) n++;
      }
      return n;
    }

    const bad = [];
    for (const c of cases) {
      for (const w of STEPS) {
        const outfit = Object.assign({}, D.DEFAULT_OUTFIT, {
          top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
          [c.slot]: c.it.id,
        });
        const svg = window.Avatar.build(outfit, w, null);
        const torso = await skinIn(svg, ...bodyBox(w, 72, 128, 112, WAIST));
        const sleeved = c.it.sleeve !== 'none';
        const arm = sleeved
          ? await skinIn(svg, ...bodyBox(w, 46, 154, 112, armBottom(c.it)))
            - await skinIn(svg, ...bodyBox(w, 72, 128, 112, armBottom(c.it)))
          : 0;
        if (torso > 0) bad.push({ id: c.it.id, body: w, where: '몸통', n: torso });
        if (arm > 0) bad.push({ id: c.it.id, body: w, where: '어깨/팔', n: arm });
      }
    }
    // ── 상의 × 하의 조합 — 허리에 틈이 없는가
    const tops = (D.WARDROBE.top || []).filter(x => x.kind !== 'none');
    const bots = (D.WARDROBE.bottom || []).filter(x => x.kind !== 'none');
    const pairBad = [];
    // 순서 판정용 — 상의만 눈에 띄는 색으로 물들여 겹침 구간에서 세어 본다
    const MARK = '#ff0000';
    const countMark = async (svg, bx) => {
      const img = new Image();
      await new Promise(ok => { img.onload = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, 200, 348); ctx.drawImage(img, 0, 0, 200, 348);
      const d = ctx.getImageData(bx[0], bx[2], bx[1] - bx[0], bx[3] - bx[2]).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 250 && d[i] > 250 && d[i + 1] < 5 && d[i + 2] < 5) n++;
      }
      return n;
    };
    for (const t of tops) for (const bo of bots) for (const w of STEPS) {
      const outfit = Object.assign({}, D.DEFAULT_OUTFIT,
        { top: t.id, bottom: bo.id, dress: 'dress_none', shoes: 'shoes_none' });
      const n = await skinIn(window.Avatar.build(outfit, w, null), ...bodyBox(w, 72, 128, 168, 202));
      if (n > 0) pairBad.push({ id: t.id + ' + ' + bo.id, body: w, where: '허리 살색', n });
      const marked = window.Avatar.build(Object.assign({}, outfit, { colors: { top: MARK } }), w, null);
      const m = await countMark(marked, bodyBox(w, 88, 112, 190, 206));
      if (m > 0) pairBad.push({ id: t.id + ' + ' + bo.id, body: w, where: '겹침에 상의가 앞', n: m });
    }
    return { cases: cases.length, steps: STEPS.length, bad,
             pairs: tops.length * bots.length * STEPS.length, pairBad };
  });

  if (SHOT) {
    await page.evaluate(() => {
      const D = window.GameData;
      const html = ['top', 'bottom', 'dress'].map(slot =>
        (D.WARDROBE[slot] || []).filter(it => it.kind !== 'none').map(it => {
          const outfit = Object.assign({}, D.DEFAULT_OUTFIT, {
            top: 'top_none', bottom: 'bottom_none', dress: 'dress_none', [it.slot]: it.id,
          });
          return `<figure style="margin:0;text-align:center;font:11px sans-serif">
            <div style="width:120px;height:216px">${window.Avatar.build(outfit, 0.5, null)}</div>
            <figcaption>${it.name}</figcaption></figure>`;
        }).join('')).join('');
      document.body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;background:#fff;padding:8px">${html}</div>`;
    });
    await page.screenshot({ path: SHOT, fullPage: true });
    console.log('대조표 →', SHOT);
  }

  await browser.close();

  const all = res.bad.concat(res.pairBad);
  console.log(`옷 ${res.cases}종 × 체형 ${res.steps}단계 = ${res.cases * res.steps}회`
    + ` · 상의×하의 ${res.pairs}조합`);
  if (!all.length) { console.log('✅ 살이 옷 밖으로 나온 곳 없음'); process.exit(0); }
  console.log(`❌ ${all.length}건`);
  all.forEach(b => console.log(`   ${b.id} · 체형 ${b.body} · ${b.where} 살색 ${b.n}px`));
  process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
