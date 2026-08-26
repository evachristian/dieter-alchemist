// 옷 커버리지 검사 — 새 옷을 늘렸을 때 살이 옷 밖으로 나오지 않는지 본다.
//
// UI_POLICY 3 의 검증: 체형 5단계 × 모든 옷에서 **몸통 구간에 살색 픽셀이 0개**여야 한다.
// (눈으로는 잘 안 보인다 — 통통한 체형에서만 옆구리가 1~2px 나오는 식이라)
//
// 보는 구간 두 가지:
//   몸통  x 72~128 · y 108~허리(184)  — 상의·원피스는 여기를 반드시 덮는다
//         단 **넥라인이 판 자리는 뺀다** (avatar.js 의 NECK_CUT 을 그대로 읽는다).
//         일부러 판 구멍을 '살이 나왔다' 고 잡으면 검사가 디자인을 막는다 —
//         민소매의 팔 검사를 건너뛰는 것과 같은 이유다
//         위끝은 **몸통의 맨 윗점(BODY.torsoTopY=108)** 이다. 예전에는 112 에서 시작해
//         목 밑을 가로지르는 살색 띠(옷의 어깨선이 몸통보다 2px 아래였다)를 통째로
//         지나쳤다 — 사람 눈에는 '1px 어긋난 선' 으로만 보여 오래 남아 있었다
//         (허리 아래는 하의가 맡는다. 상의 밑단은 골반 바로 위까지 내려와 치마 허리춤을 덮는다)
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
    const TORSO_TOP = 108;                       // BODY.torsoTopY (몸통 구간의 위 끝)
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

    // 넥라인은 **일부러 판 자리**다 — 그만큼은 빼고 본다 (민소매의 팔 검사를 건너뛰는 것과 같다).
    // 파는 폭·깊이 표는 avatar.js 의 NECK_CUT 을 **그대로 읽는다** — 두 곳에 적어 두면
    // 어긋나고, 어긋나는 순간 검사가 헛돈다. 표보다 크게 파면 그 바깥에서 살이 잡힌다.
    const CLOTH_TOP = window.Avatar.CLOTH_TOP_Y;
    // neck 필드가 아예 없는 옷(공주 드레스)은 파지 않는다 — 빼 주면 그만큼 검사에 구멍이 생긴다
    const cutOf = it => (it.neck ? window.Avatar.neckCutBox(it.neck) : { w: 0, d: 0, top: 0 });


    const bad = [];
    for (const c of cases) {
      for (const w of STEPS) {
        const outfit = Object.assign({}, D.DEFAULT_OUTFIT, {
          top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
          [c.slot]: c.it.id,
        });
        const svg = window.Avatar.build(outfit, w, null);
        const cut = cutOf(c.it);
        const torso = await skinIn(svg, ...bodyBox(w, 72, 128, TORSO_TOP, WAIST))
          - (cut.w ? await skinIn(svg, ...bodyBox(w, 100 - cut.w - 2, 100 + cut.w + 2, TORSO_TOP, CLOTH_TOP + cut.d + 2)) : 0);
        const sleeved = c.it.sleeve !== 'none';
        const arm = sleeved
          ? await skinIn(svg, ...bodyBox(w, 46, 154, 112, armBottom(c.it)))
            - await skinIn(svg, ...bodyBox(w, 72, 128, 112, armBottom(c.it)))
          : 0;
        if (torso > 0) bad.push({ id: c.it.id, body: w, where: '몸통', n: torso });
        if (arm > 0) bad.push({ id: c.it.id, body: w, where: '어깨/팔', n: arm });
      }
    }
    // ── 넥라인이 **몸통이 받쳐 주는 높이 아래**를 파는가 ──
    //
    // 몸통 윗선은 가운데(x=100)만 108 이고 바깥으로 갈수록 내려간다. 파낸 모서리를
    // 그보다 위에 두면 옷도 몸도 없는 자리가 남아 목 옆에 배경이 비치는 홈이 생긴다.
    // (넓게 파는 스퀘어일수록 심하다 — 실제로 라운드에서 3px 짜리 홈이 났다)
    //
    // **표가 아니라 그린 것을 잰다.** 표(neckCutBox)만 읽으면 표는 그대로인 채
    // 그림만 바뀌었을 때 검사가 통째로 헛돈다 — 렌더 기반 검사로 한 번 겪었다.
    // isPointInFill 은 path 자체의 좌표계에서 판정하므로 체형 변환과 무관하다.
    const neckBad = [];
    {
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0';
      document.body.appendChild(host);
      // 어떤 y 에서 그 path 가 시작되는지 (위에서 아래로 이분법)
      const topAt = (el, x, lo, hi) => {
        if (el.isPointInFill(new DOMPoint(x, lo))) return lo;
        if (!el.isPointInFill(new DOMPoint(x, hi))) return null;
        for (let i = 0; i < 22; i++) {
          const m = (lo + hi) / 2;
          if (el.isPointInFill(new DOMPoint(x, m))) hi = m; else lo = m;
        }
        return (lo + hi) / 2;
      };
      for (const c of cases) {
        if (!c.it.neck) continue;                       // 안 파는 옷
        const cut = window.Avatar.neckCutBox(c.it.neck);
        if (!cut.w) continue;
        const outfit = Object.assign({}, D.DEFAULT_OUTFIT, {
          top: 'top_none', bottom: 'bottom_none', dress: 'dress_none', [c.slot]: c.it.id,
        });
        host.innerHTML = window.Avatar.build(outfit, 0, null);
        const cloth = host.querySelector('[data-part="cloth"]');
        const torso = host.querySelector('[data-part="torso"] path');
        if (!cloth || !torso) { neckBad.push({ id: c.it.id, msg: 'path 를 못 찾았다' }); continue; }
        // 파낸 자리 안쪽을 훑는다. 모서리(±w)가 가장 아슬아슬하다
        for (const t of [0.02, 0.15, 0.4, 0.85, 0.98]) {
          for (const sgn of [-1, 1]) {
            const x = 100 + sgn * cut.w * (1 - t) + sgn * 0.3;
            const cy = topAt(cloth, x, 100, 150);
            const ty = topAt(torso, x, 100, 150);
            if (cy == null || ty == null) continue;
            // 모서리에는 1px 여유를 준다 — 옷이 몸통 윗선에 딱 붙으면
            // 바로 바깥에서 어깨선이 몸통 아래로 내려가 살이 비친다
            if (cy < ty - 1.2) {
              neckBad.push({ id: c.it.id, x: +x.toFixed(1),
                msg: `옷 ${cy.toFixed(1)} < 몸통 ${ty.toFixed(1)} — ${(ty - cy).toFixed(1)}px 빈다` });
            }
          }
        }
      }
      host.remove();
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
    // ── 과시 카드 — PNG 가 실제로 나오는가, 방·아바타가 그려졌는가
    // (SVG 래스터화는 조용히 실패하기 쉽다. 실패하면 빈 카드가 나가도 아무도 모른다)
    let card = null;
    try {
      const blob = await window.shareCardBlob();
      const bmp = await createImageBitmap(blob);
      const c2 = document.createElement('canvas');
      c2.width = bmp.width; c2.height = bmp.height;
      const cx2 = c2.getContext('2d');
      cx2.drawImage(bmp, 0, 0);
      // 방 영역(위 2/3)에 색이 몇 가지나 있는가 — 한 가지뿐이면 배경만 칠해진 빈 카드다
      const d = cx2.getImageData(0, 0, bmp.width, Math.round(bmp.height * 0.66)).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      card = { type: blob.type, size: blob.size, w: bmp.width, h: bmp.height, colors: seen.size };
    } catch (e) { card = { error: String(e && e.message || e) }; }

    return { cases: cases.length, steps: STEPS.length, bad, neckBad,
             pairs: tops.length * bots.length * STEPS.length, pairBad, card };
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

  // ─── 앞머리가 정수리를 덮는가 ────────────────────────────────
  // 얼굴은 타원(cx100 cy70 rx33 ry35)이라 **꼭대기가 y=35** 다. 앞머리가 거기까지
  // 안 올라오면 정수리에 살색이 그대로 드러난다 — 머리가 벗겨진 것처럼 보인다.
  // 실제로 사이드뱅이 y=42 까지밖에 안 올라와 y35~41 이 살색이었고, 커튼뱅은
  // 가르마가 y=40 에서 열려 정수리가 갈라져 보였다. 둘 다 눈으로는 잘 안 띄었다.
  // ('이마 노출' 은 이마를 드러내는 것이 목적이지만, 그것도 정수리는 덮는다)
  const hair = await page.evaluate(() => {
    const D = window.GameData, SKIN = [255, 224, 207], CROWN_TOP = 34, CROWN_BOT = 42;
    const near = (r, g, b) => Math.abs(r - SKIN[0]) < 14 && Math.abs(g - SKIN[1]) < 14 && Math.abs(b - SKIN[2]) < 14;
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 348;
    const ctx = cv.getContext('2d');
    const draw = (svg) => new Promise(res => {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, 200, 348); ctx.drawImage(img, 0, 0, 200, 348); res(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    return (async () => {
      const bad = [], seen = new Set();
      for (const it of D.WARDROBE.hair) {
        if (seen.has(it.bang)) continue;          // 앞머리 종류별로 한 번씩 (뒷머리는 정수리를 안 건드린다)
        seen.add(it.bang);
        await draw(Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, { hair: it.id }), 0));
        const h = CROWN_BOT - CROWN_TOP;
        const d = ctx.getImageData(66, CROWN_TOP, 68, h).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && near(d[i], d[i + 1], d[i + 2])) n++;
        if (n > 0) bad.push(`${it.bang}: 정수리(y${CROWN_TOP}~${CROWN_BOT})에 살색 ${n}px`);
      }
      return { bad, kinds: seen.size };
    })();
  });

  // ─── 초상화 — 머리와 얼굴이 붙어 있는가 ──────────────────────
  //
  // 머리 부품은 안쪽을 파 놓은 띠(crescent)라, 얼굴 타원보다 넓은 자리에서는
  // 그 사이로 배경이 비쳤다 — **관자놀이에서 6px 짜리 틈**이 나서 머리와 얼굴이
  // 떨어져 보였다 (오릭스·슈타르크·발렌·클레멘·이그리트가 그랬다).
  //
  // **얼굴이 있는 가로 구간만 본다.** 그 구간에서는 위에서 아래로 내려갈 때
  // 「머리 → 얼굴」이 끊기지 않아야 한다 — 중간에 투명한 줄이 있으면 떨어진 것이다.
  // (바깥 구간은 머리 옆의 빈 곳이라 정상적으로 비어 있다)
  const face = await page.evaluate(async () => {
    const D = window.GameData, bad = [];
    const cv = document.createElement('canvas');
    cv.width = 120; cv.height = 130;                    // Portrait.W × H 와 1:1
    const cx = cv.getContext('2d');
    // 얼굴 타원은 cx60 cy66 rx26 ry30 이다. 양 끝은 타원이 종잇장처럼 얇아
    // 안티에일리어싱만 남으므로 안쪽으로 4px 들어와서 본다
    const X0 = 38, X1 = 82, Y0 = 12, Y1 = 88;
    for (const sp of D.SPEAKERS) {
      // **배경 판 없이(bare)** 그린다 — 판을 깔면 틈이 판 색으로 메워져 안 보인다
      const svg = window.Portrait.bust(sp, 'def', { bare: true });
      const img = new Image();
      await new Promise(ok => { img.onload = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      cx.clearRect(0, 0, 120, 130);
      cx.drawImage(img, 0, 0, 120, 130);
      const d = cx.getImageData(0, 0, 120, 130).data;
      const alpha = (x, y) => d[(y * 120 + x) * 4 + 3];
      let worst = 0, at = null;
      for (let x = X0; x <= X1; x++) {
        let started = false, run = 0;
        for (let y = Y0; y <= Y1; y++) {
          const a = alpha(x, y);
          if (a > 200) {
            if (started && run > worst) { worst = run; at = x; }
            started = true; run = 0;
          } else if (started && a < 40) {
            run++;
          }
        }
      }
      // 1px 은 안티에일리어싱이다. 2px 부터 눈에 보이는 틈이다
      if (worst >= 2) bad.push(`${sp.id}: 머리와 얼굴 사이가 ${worst}px 떨어졌다 (x=${at})`);
    }

    // ── 이마 — **틈이 없다고 얼굴이 맞는 것은 아니다** ──────────
    //
    // 틈 검사는 '머리와 얼굴이 붙었나' 만 본다. 앞머리를 정수리 쪽으로 올려 버려도
    // 붙어 있기는 하므로 **통과한다.** 그래서 「이마가 너무 크고 둥그렇게 보인다」는
    // 말을 두 번 듣고서야 알았다 — 앞머리 안쪽 선이 y=34 라 얼굴 위끝(36)에
    // 거의 안 걸쳐 있었고, 얼굴의 40%가 맨이마였다.
    //
    // 헤어라인은 **얼굴 위끝(36)과 눈(위끝 60.8) 사이**에 와야 한다.
    // 너무 높으면 민머리, 너무 낮으면 헬멧이다. 그린 path 를 직접 더듬어 잰다 —
    // HAIR 표를 읽으면 표만 고치고 그림을 안 고쳐도 통과한다.
    const FORE_MIN = 6, FORE_MAX = 18, EYE_TOP = 60.8;
    for (const sp of D.SPEAKERS) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:120px;height:130px';
      host.innerHTML = window.Portrait.bust(sp, 'def', { bare: true });
      document.body.appendChild(host);
      const svg = host.querySelector('svg');
      const fronts = [...svg.querySelectorAll('[data-part="hair-front"]')];
      const hasFace = !!svg.querySelector('[data-part="face"]');
      if (hasFace && !fronts.length) bad.push(`${sp.id}: 앞머리가 없다 — 이마만 남는다`);
      if (hasFace && fronts.length) {
        // 얼굴 한가운데 세로줄에서 앞머리가 끝나는 곳 = 헤어라인
        let line = null;
        for (let y = 10; y <= 96; y += 0.25) {
          if (fronts.some(el => el.isPointInFill(new DOMPoint(60, y)))) line = y;
        }
        const fore = line == null ? null : EYE_TOP - line;
        if (fore == null) bad.push(`${sp.id}: 앞머리가 얼굴 한가운데를 안 지난다`);
        else if (fore > FORE_MAX) bad.push(`${sp.id}: 이마가 ${fore.toFixed(1)}px — 너무 넓다 (${FORE_MAX} 이하)`);
        else if (fore < FORE_MIN) bad.push(`${sp.id}: 이마가 ${fore.toFixed(1)}px — 앞머리가 눈까지 내려왔다 (${FORE_MIN} 이상)`);
      }
      host.remove();
    }
    return { bad, n: D.SPEAKERS.length };
  });

  // ─── 염색이 실제로 아바타에 입혀지는가 ───────────────────────
  // **조용히 깨지는 자리다.** 칠했다는 토스트는 뜨는데 아바타는 원래 색 그대로였던 적이 있다
  // (영원 염색약이 만료 시각을 지우는데 slotColor 가 그것만 봐서, 모든 칸에서 안 먹었다).
  // 그래서 '색을 골랐다' 가 아니라 **그린 SVG 안에 그 색이 있나**로 본다.
  //
  // **염색이 그 옷 한 벌에만 붙는지도 같이 본다.** 예전에는 칸(slot)에 붙어 있어서
  // 장갑 하나를 물들이면 가진 장갑이 전부 그 색이 됐다 — 눈에는 잘 안 띄는데,
  // 다른 옷으로 갈아입어 봐야 드러난다.
  const dye = await page.evaluate(() => {
    const D = window.GameData, bad = [];
    const HEX = { magic: '#2f9e6e', ever: '#c9184a' };       // 에메랄드 / 체리
    const ID  = { magic: 'c_emerald', ever: 'c_cherry' };
    // 그 칸에 '없음' 이 아닌 옷을 하나 입혀 둔다 — 안 입고 있으면 물들일 것이 없다
    const wearSomething = (slot) => {
      const it = (D.WARDROBE[slot] || []).find(x => x.kind !== 'none');
      if (it) S.outfit[slot] = it.id;
      return it;
    };
    S.outfit.dress = 'dress_none';
    D.COLORS.forEach(c => { if (!isColorOwned(c.id)) S.unlocked.push(c.id); });
    const wipe = () => { S.itemColor = {}; S.dyeEnd = {}; S.dyeForever = {}; };
    let others = 0;
    for (const slot of D.COLORABLE_SLOTS) {
      const it = wearSomething(slot);
      if (!it) { bad.push(`${slot}: 입힐 옷이 없다`); continue; }
      for (const kind of ['magic', 'ever']) {
        wipe();
        S.dye = 9; S.dyeEver = Object.assign({}, S.dyeEver, { [ID[kind]]: 9 });
        applyDye(slot, ID[kind], kind);
        if (!Avatar.build(outfitWithColors(), 0.3).includes(HEX[kind])) {
          bad.push(`${slot}: ${kind === 'ever' ? '영원' : '마법'} 염색약이 아바타에 안 먹는다`);
        }
        // **그 옷 한 벌에만** 붙었는가 — 같은 칸의 다른 옷으로 갈아입으면 원래 색이어야 한다
        const other = (D.WARDROBE[slot] || []).find(x => x.kind !== 'none' && x.id !== it.id);
        if (other) {
          others++;
          S.outfit[slot] = other.id;
          if (Avatar.build(outfitWithColors(), 0.3).includes(HEX[kind])) {
            bad.push(`${slot}: ${kind === 'ever' ? '영원' : '마법'} 염색이 같은 칸의 다른 옷(${other.id})까지 물들였다`);
          }
          S.outfit[slot] = it.id;
        }
      }
      // 마법 염색약은 기한이 지나면 풀려야 한다 (영원 염색약과 헷갈려 둘 다 안 풀리면 안 된다)
      wipe();
      S.dye = 9; applyDye(slot, ID.magic, 'magic');
      S.dyeEnd[it.id] = Date.now() - 1000;
      if (Avatar.build(outfitWithColors(), 0.3).includes(HEX.magic)) {
        bad.push(`${slot}: 기한이 지난 마법 염색약이 안 풀린다`);
      }
    }
    return { bad, slots: D.COLORABLE_SLOTS.length, others };
  });

  await browser.close();

  // 과시 카드
  const c = res.card || {};
  const cardBad = c.error ? [`카드 만들기 실패 — ${c.error}`]
    : (c.type !== 'image/png' ? [`카드 형식이 PNG 가 아님 (${c.type})`] : [])
      .concat(c.size < 20000 ? [`카드가 너무 작다 (${c.size}B) — 빈 그림일 수 있다`] : [])
      .concat(c.colors < 12 ? [`방 영역에 색이 ${c.colors}가지뿐 — 배경만 칠해진 빈 카드다`] : []);
  console.log(c.error ? `과시 카드: ❌ ${c.error}`
    : `과시 카드: ${c.w}×${c.h} PNG ${Math.round(c.size / 1024)}KB · 방 색 ${c.colors}가지`);

  const all = res.bad.concat(res.pairBad)
    .concat((res.neckBad || []).map(b => ({ id: b.id, body: '-', n: '-',
      where: `넥라인이 몸통 윗선 위를 판다 (x ${b.x}) — ${b.msg}` })))
    .concat(cardBad.map(m => ({ id: '과시 카드', body: '-', where: m, n: '-' })))
    .concat(dye.bad.map(m => ({ id: '염색', body: '-', where: m, n: '-' })))
    .concat(hair.bad.map(m => ({ id: '앞머리', body: '-', where: m, n: '-' })))
    .concat(face.bad.map(m => ({ id: '초상화', body: '-', where: m, n: '-' })));
  console.log(`옷 ${res.cases}종 × 체형 ${res.steps}단계 = ${res.cases * res.steps}회`
    + ` · 상의×하의 ${res.pairs}조합`);
  console.log(`염색: ${dye.slots}칸 × 마법·영원·만료 ${dye.slots * 3}회`
    + ` · 다른 옷으로 갈아입어 확인 ${dye.others}회 · 앞머리 ${hair.kinds}종 정수리`);
  console.log(`넥라인: 파낸 자리를 몸통 윗선과 견줌 (그린 path 를 isPointInFill 로 직접 잰다)`);
  console.log(`초상화: 인물 ${face.n}명 — 머리와 얼굴 사이의 틈 · 헤어라인 높이(이마 6~18px)`);
  if (!all.length) { console.log('✅ 살이 옷 밖으로 나온 곳 없음'); process.exit(0); }
  console.log(`❌ ${all.length}건`);
  all.forEach(b => console.log(b.n === '-'
    ? `   ${b.id} · ${b.where}`
    : `   ${b.id} · 체형 ${b.body} · ${b.where} 살색 ${b.n}px`));
  process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
