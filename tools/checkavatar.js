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
//   허리  x 72~128 · y 148~184  — 상의 밑단과 하의 허리춤 사이로 살이 보이면 안 된다
//   (둘 중 하나라도 몸통보다 뒤로 가면 그 사이에 살색 띠가 생긴다)
//   겹침 x 88~112 · y 171~189 — 상의 밑단(hipY-2 = 196)과 하의 허리(waistY = 164)가 겹치는 구간.
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
    const WAIST = 164;                           // BODY.waistY (몸통 구간의 아래 끝 기준)
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
    // 아래끝을 소매 끝보다 **6px 위**에서 끊는다. 소매 밑단은 둥글어서 **바깥쪽이
    // 안쪽보다 높이 끝나는데**, 그 아래로 나오는 팔은 소매가 짧아서 나오는 것이지
    // 옷이 몸을 못 덮은 것이 아니다.
    // 예전에는 4 였다 — 맨팔에 두르던 테두리(ARM_EDGE)가 팔의 맨 바깥 1px 을
    // 살색이 아닌 색으로 덮고 있어서 안 잡혔을 뿐이다. 테두리를 없애자 그 1px 이
    // 드러났다 (dress_maxi 의 캡 소매). 창을 그만큼 물린다
    const armBottom = it => Math.min(145, 120 + (SLEEVE_H[it.sleeve] == null ? 42 : SLEEVE_H[it.sleeve]) - 6);
    const cases = [];
    (D.WARDROBE.top || []).forEach(it => { if (it.kind !== 'none') cases.push({ slot: 'top', it }); });
    (D.WARDROBE.dress || []).forEach(it => { if (it.kind !== 'none') cases.push({ slot: 'dress', it }); });

    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 348;   // viewBox 와 1:1
    const ctx = canvas.getContext('2d');

    // 조각을 **빼고** 그린다 — 몸통 창을 잴 때 팔을 지운다.
    // 배율을 움직이면 팔이 몸통 창 안으로 들어오는데(몸통 50% 에서 안쪽으로 16px),
    // 그 팔은 **옷이 못 덮은 살이 아니라 원래 밖에 있는 맨팔**이다.
    // 창을 좁히는 것으로는 못 가른다 — 허리만 줄여도 같은 일이 난다
    function strip(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      [...root.querySelectorAll(sel)].forEach(n => n.remove());
      return root.outerHTML;
    }
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


    // ─── 배율(슬라이더)도 같이 돈다 ────────────────────────────
    //
    // ⚠️ **체형(몸무게)만 돌고 있었다.** 그래서 「옷이 몸을 따라오는가」를
    // **슬라이더 쪽으로는 한 번도 안 재고 있었다** — 옷을 통째로 늘리던 배율이
    // `tuneMax` 라 **1 밑으로 안 내려가서**, 몸통을 줄이면 몸만 가늘어지고 옷은
    // 그대로 남았다 (「살이 빠졌을 때 옷이 안 맞는다 · 특히 어깨」).
    // 반대쪽도 같은 자리다 — 허벅지를 키우면 그 배율이 **어깨까지** 먹어 몸판이 두 배가 됐다.
    const TUNES = [['기본', null],
                   ['몸통 50', { torso: 0.5 }], ['몸통 150', { torso: 1.5 }],
                   ['허벅지 200', { thigh: 2 }], ['종아리 200', { calf: 2 }],
                   ['몸통 50 팔 50', { torso: 0.5, arm: 0.5 }],
                   ['허리 50', { waist: 0.5 }], ['엉덩이 20', { hip: 0.2 }]];
    const bad = [];
    for (const c of cases) {
      for (const w of STEPS) {
        // 체형은 5단계를 다 돌고, 배율은 **중간 체형에서만** 돈다 (조합이 곱으로 는다)
        const tunes = w === 0.5 ? TUNES : [TUNES[0]];
        for (const [tn, t] of tunes) {
        const outfit = Object.assign({}, D.DEFAULT_OUTFIT, {
          top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
          [c.slot]: c.it.id,
        });
        const svg = window.Avatar.build(outfit, w, t);
        const cut = cutOf(c.it);
        // 몸통 창에서는 **팔·손을 지우고** 잰다 (위의 strip 참고)
        const noArm = strip(svg, '[data-part="arm"],[data-part="hand"]');
        const torso = await skinIn(noArm, ...bodyBox(w, 72, 128, TORSO_TOP, WAIST))
          - (cut.w ? await skinIn(noArm, ...bodyBox(w, 100 - cut.w - 2, 100 + cut.w + 2, TORSO_TOP, CLOTH_TOP + cut.d + 2)) : 0);
        const sleeved = c.it.sleeve !== 'none';
        const arm = sleeved
          ? await skinIn(svg, ...bodyBox(w, 46, 154, 112, armBottom(c.it)))
            - await skinIn(svg, ...bodyBox(w, 72, 128, 112, armBottom(c.it)))
          : 0;
        const lbl = t ? `${w} · ${tn}` : w;
        if (torso > 0) bad.push({ id: c.it.id, body: lbl, where: '몸통', n: torso });
        if (arm > 0) bad.push({ id: c.it.id, body: lbl, where: '어깨/팔', n: arm });
        }
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
      const n = await skinIn(window.Avatar.build(outfit, w, null), ...bodyBox(w, 72, 128, 148, 184));
      if (n > 0) pairBad.push({ id: t.id + ' + ' + bo.id, body: w, where: '허리 살색', n });
      const marked = window.Avatar.build(Object.assign({}, outfit, { colors: { top: MARK } }), w, null);
      const m = await countMark(marked, bodyBox(w, 88, 112, 171, 189));
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
  //
  // ⚠️ **창을 고정 y 로 박아 두면 안 된다.** 머리는 체형·목 길이에 따라 위아래로 움직인다
  // (NECK_LIFT 를 넣자 6px 올라가면서, y34~42 창이 정수리를 지나쳐 이마에 걸렸다 —
  //  멀쩡한 앞머리 셋이 전부 '정수리에 살색' 으로 잡혔다). **그린 머리의 실제 위치에서 잡는다.**
  const hair = await page.evaluate(() => {
    const D = window.GameData, SKIN = [255, 224, 207];
    // 지금 아바타에서 얼굴 타원의 꼭대기가 실제로 몇 y 인지 재고, 거기서 창을 잡는다
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px';
    document.body.appendChild(probe);
    probe.innerHTML = Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT), 0);
    const psvg = probe.querySelector('svg'), pr = psvg.getBoundingClientRect();
    const pk = 200 / pr.width;
    const hr = probe.querySelector('[data-part="head"]').getBoundingClientRect();
    const faceTop = (hr.top - pr.top) * pk;
    probe.remove();
    const CROWN_TOP = Math.round(faceTop - 1), CROWN_BOT = CROWN_TOP + 8;
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

  // ─── 웅크린 뒷모습 — 무릎이 입은 옷을 따라가는가 ─────────────
  //
  // 「혼자 먹은 밤」 컷씬의 무릎은 **늘 살색**이었다. 그래서 발목까지 오는 공주 드레스를
  // 입고도 무릎만 맨살 덩어리가 되어 치마 옆으로 삐져나왔다 — 서 있는 아바타의
  // 커버리지 검사는 `build()` 만 보므로 이 그림은 한 번도 검사받은 적이 없었다.
  //
  // 규칙: 무릎(서 있을 때 y≈285)보다 아래로 내려오는 밑단이면 무릎은 **옷 색**,
  // 그보다 짧거나 안 입었으면 **살색**이다. 표가 아니라 **그린 fill 을** 읽는다.
  const crouch = await page.evaluate(() => {
    const D = window.GameData, bad = [];
    const KNEE_Y = 285;
    const kneeFill = (outfit) => {
      const host = document.createElement('div');
      host.innerHTML = Avatar.crouchBack(outfit, 0.4, '🍰');
      const el = host.querySelector('[data-part="knee"]');
      const rect = host.querySelector('rect[clip-path]');       // 치마로 갈아 칠한 아랫도리
      return { knee: el && el.getAttribute('fill'), skirt: rect && rect.getAttribute('fill') };
    };
    const SKIN = kneeFill({ dress: 'dress_none', bottom: 'bottom_none' }).knee;   // 아무것도 안 입은 색
    let n = 0;
    const check = (label, outfit, wear) => {
      n++;
      const { knee, skirt } = kneeFill(Object.assign({ hair: 'hair_long', colors: {} }, outfit));
      const hem = wear ? (Number(wear.hemY) || 999) : null;
      const want = (hem !== null && hem >= KNEE_Y) ? (wear.color || '').toLowerCase() : SKIN.toLowerCase();
      if ((knee || '').toLowerCase() !== want) {
        bad.push(`${label}: 무릎이 ${knee} — ${want} 여야 한다 (밑단 ${hem === null ? '없음' : hem})`);
      }
      // 상의와 치마를 따로 입었으면 아랫도리도 치마 색이어야 한다
      if (outfit.bottom && hem !== null && hem >= KNEE_Y) {
        if (!skirt) bad.push(`${label}: 아랫도리가 상의 색 그대로다 — 치마 색으로 갈아 칠해야 한다`);
        else if (skirt.toLowerCase() !== want) bad.push(`${label}: 아랫도리가 ${skirt} — ${want} 여야 한다`);
      }
    };
    (D.WARDROBE.dress || []).forEach(dr => {
      if (dr.kind === 'none') return;
      check(`드레스 ${dr.id}`, { dress: dr.id }, dr);
    });
    (D.WARDROBE.bottom || []).forEach(bt => {
      if (bt.kind === 'none') return;
      check(`상의+${bt.id}`, { top: 'top_tee', bottom: bt.id }, bt);
    });
    check('아무것도 안 입음', {}, null);
    return { bad, n };
  });

  // ─── 목이 남아 있는가 (체형 5단계) ──────────────────────────
  //
  // 머리와 몸통은 **축이 다른 변환**을 탄다 — 머리는 NECK_Y(112)를, 몸은 바닥(342)을
  // 축으로 삼는다. 그래서 체형을 움직이면 **턱과 어깨 사이가 저 혼자 벌어졌다 좁아진다.**
  // 예전에는 날씬 쪽이 2.8px 까지 좁아져 목이 사라지고 어깨가 솟아 보였다.
  //
  // 눈으로는 「어? 좀 이상한데」 정도로만 보여 오래 남는다 — 그래서 숫자로 박아 둔다.
  // **날씬할수록 목이 길어야 한다** (4등신). 통통은 짧아도 된다 (3등신이 귀엽다).
  const neck = await page.evaluate(() => {
    const D = window.GameData, bad = [];
    const MIN = 5;                 // 가장 짧은 곳(통통)도 이만큼은 남아야 한다
    const MAX = 16;                // 너무 길어도 이상하다 (기린 목). 위아래로 다 막는다
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px';
    document.body.appendChild(host);
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT,
      { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none' });
    const gaps = [], tgaps = [];
    // 한 조건을 재는 함수 — 체형(w)과 몸통 배율(kt) 두 축을 같은 코드로 돈다
    const measure = (w, kt, label, into) => {
      host.innerHTML = window.Avatar.build(outfit, w, kt == null ? null : { torso: kt });
      const svg = host.querySelector('svg');
      const sr = svg.getBoundingClientRect();
      if (!sr.width) { bad.push('아바타 상자가 0폭이다'); return false; }
      const k = 200 / sr.width;                       // 화면 px → viewBox 단위
      const box = e => { const r = e.getBoundingClientRect();
        return { t: (r.top - sr.top) * k, b: (r.bottom - sr.top) * k }; };
      const head = host.querySelector('[data-part="head"]');
      const torso = host.querySelector('[data-part="torso"]');
      if (!head || !torso) { bad.push('머리/몸통 조각을 못 찾았다'); return false; }
      // **턱과 목이 붙어 있는가.** 목은 몸통 그룹, 머리는 머리 그룹이라 변환이 다르다 —
      // 목 윗변을 96 으로 박아 두면 머리를 올리는 순간 얼굴과 목이 벌어진다 (실제로 배포됐다)
      const neckEl = [...host.querySelectorAll('path')]
        .find(e => (e.getAttribute('fill') || '').startsWith('url(#neckG'));
      if (!neckEl) bad.push(`${label}: 목 path 를 못 찾았다`);
      else {
        const d = box(neckEl).t - box(head).b;
        if (d > -0.5) bad.push(`${label}: 턱과 목이 ${d.toFixed(1)}px 떨어져 있다 (겹쳐야 한다)`);
      }
      const gap = box(torso).t - box(head).b;         // 턱끝 ~ 몸통 윗선
      into.push({ k: kt == null ? w : kt, gap: Math.round(gap * 10) / 10 });
      if (gap < MIN) bad.push(`${label}: 목이 ${gap.toFixed(1)}px 뿐이다 (${MIN}px 이상)`);
      if (gap > MAX) bad.push(`${label}: 목이 ${gap.toFixed(1)}px 로 너무 길다 (${MAX}px 이하)`);
      // 머리가 화면 위로 잘리면 안 된다 (목을 빼면 머리가 같이 올라간다)
      let top = 1e9;
      host.querySelectorAll('[data-part="hair"],[data-part="head"]')
        .forEach(e => { top = Math.min(top, box(e).t); });
      if (top < 0) bad.push(`${label}: 머리가 화면 위로 ${Math.round(-top)}px 잘렸다`);
      return true;
    };
    for (const w of [0, 0.25, 0.5, 0.75, 1]) if (!measure(w, null, `체형 ${w}`, gaps)) break;
    // ─── 몸통 배율로 가늘게 해도 목이 길어지는가 ────────────────
    //
    // **체형(몸무게)만 보고 있었다.** 몸통 슬라이더로 살을 빼면 어깨 곡선이 가로로
    // 눌려 승모근이 목 바로 옆에서 솟는데, 머리는 제자리라 **목이 어깨에 파묻혔다**
    // (「몸통 % 가 낮아졌을 때 목이 너무 짧다」는 신고가 이것이다).
    // 체형 축과 **같은 방향**이어야 한다 — 가늘수록 목이 길다.
    for (const kt of [0.5, 0.75, 1, 1.5]) if (!measure(0.5, kt, `몸통 ${kt * 100}%`, tgaps)) break;
    // **날씬할수록 길어야 한다.** 뒤집히면 규칙이 반대로 걸린 것이다
    const mono = (list, what) => {
      for (let i = 1; i < list.length; i++) {
        if (list[i].gap > list[i - 1].gap + 0.2) {
          bad.push(`${what} ${list[i - 1].k}(${list[i - 1].gap}px) 보다`
            + ` ${list[i].k}(${list[i].gap}px) 의 목이 길다`);
        }
      }
    };
    mono(gaps, '체형');
    mono(tgaps, '몸통');
    // 가는 몸통에서 **실제로 길어졌는지**도 본다 — 순서만 보면 전부 같은 값이어도 통과다
    if (tgaps.length > 1 && !(tgaps[0].gap >= tgaps[tgaps.length - 1].gap + 2)) {
      bad.push(`몸통 50% 의 목(${tgaps[0].gap}px)이 150%(${tgaps[tgaps.length - 1].gap}px)보다`
        + ` 2px 이상 길지 않다 — 몸통을 가늘게 해도 목이 안 길어진다`);
    }
    host.remove();
    return { bad, gaps, tgaps };
  });

  // ─── 몸통과 팔 사이로 배경이 비치지 않는가 ───────────────────
  //
  // 몸통 옆선은 어깨에서 허리로 **좁아지고**, 팔은 armRot 만큼 바깥으로 **기울어** 내려간다.
  // 둘이 반대로 가서 y 170 언저리에 **1px 짜리 실틈**이 생겼다 — 같은 살색이라 색은
  // 안 튀는데 배경이 실처럼 비쳐 「팔이 몸에서 떨어져 있다」로 읽힌다. 눈으로는
  // 「선이 하나 있나?」 정도로만 보여서 오래 남는다.
  //
  // 체형을 21단계로 훑는다 — 5단계만 보면 그 사이에서 벌어지는 것을 놓친다
  // (실제로 0.25 와 0.2 에서만 벌어진 적이 있다).
  const seam = await page.evaluate(async () => {
    const D = window.GameData, bad = [];
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 348;
    const ctx = cv.getContext('2d');
    const draw = (svg) => new Promise(r => {
      const i = new Image();
      i.onload = () => { ctx.clearRect(0, 0, 200, 348); ctx.drawImage(i, 0, 0, 200, 348); r(); };
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    const nude = Object.assign({}, D.DEFAULT_OUTFIT,
      { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none' });
    const STEPS = 21;
    for (let i = 0; i < STEPS; i++) {
      const w = i / (STEPS - 1);
      await draw(window.Avatar.build(nude, w, null));
      const d = ctx.getImageData(0, 0, 200, 348).data;
      // 어깨가 다 벌어지는 높이부터 아래로 — 그 위는 목 옆이라 원래 배경이다
      const ky = 1 + (84 - 84 * (0.979 + (1.314 - 0.979) * w)) / 229;
      const from = Math.round(342 + (133 - 342) * ky);
      let n = 0;
      for (let y = from; y < from + 50; y++) {
        let seen = false, gs = -1;
        for (let x = 100; x < 190; x++) {          // 오른쪽 반만 봐도 좌우 대칭이다
          const a = d[(y * 200 + x) * 4 + 3];
          if (a > 200) { if (gs >= 0) { n++; gs = -1; } seen = true; }
          else if (seen && gs < 0) gs = x;
        }
      }
      if (n) bad.push(`체형 ${w.toFixed(2)}: 몸통과 팔 사이에 배경이 ${n}줄 비친다`);
    }
    return { bad, steps: STEPS };
  });

  // ─── 물고기가 어항 밖으로 새지 않는가 ───────────────────────
  //
  // 물고기(`move: 'water'`)는 마이 룸에서 어항에 들어가고, 그 안에서 좌우로 헤엄친다.
  // **여유가 몇 px 밖에 안 된다** — 그림 부품을 손보거나 헤엄 폭을 늘리면 곧바로
  // 지느러미가 유리를 뚫고 나간다. 눈으로는 「살짝 걸쳤나?」 정도로만 보여 오래 남는다.
  //
  // 헤엄 애니메이션의 **양 끝 자세를 직접 만들어** 재고, 유리통(원)과 수면을 견준다.
  // 애니메이션이 도는 것을 기다리지 않는다 — 그러면 어느 순간을 쟀는지 알 수 없다.
  const bowl = await page.evaluate(() => {
    const D = window.GameData, bad = [];
    const fish = D.RECIPES.filter(r => r.result.kind === 'creature' && r.result.move === 'water')
      .map(r => r.result);
    if (!fish.length) return { bad: ['물(water) 크리처가 하나도 없다 — move 축이 죽었다'], n: 0 };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px';
    document.body.appendChild(host);
    // 어항 유리통 — creature.js 의 shell 과 같은 값이어야 한다 (원 중심 50,54.2 · 반지름 33)
    const GLASS = { cx: 50, cy: 54.2, r: 33, surface: 36 };
    const MARGIN = 1.5;                    // 유리에 닿기 전에 잡는다
    for (const c of fish) {
      host.innerHTML = `<div class="char-aura" style="position:relative;width:200px;height:200px">
        <div class="stage-creatures">${petStage(c)}</div></div>`;
      const wrap = host.querySelector('.stage-creature');
      const sw = host.querySelector('.cr-swim');
      const svg = sw && sw.querySelector('svg');
      const bowlSvg = host.querySelector('.cr-bowl');
      if (!wrap || !sw || !svg || !bowlSvg) { bad.push(`${c.name}: 어항이 안 그려졌다`); continue; }
      if (!wrap.classList.contains('cr-water')) { bad.push(`${c.name}: cr-water 가 안 붙었다`); continue; }
      // 헤엄의 양 끝 — style.css 의 @keyframes swim 과 같은 값
      for (const [label, tf] of [['왼끝', 'translate(-8px,5px) scaleX(1)'],
                                 ['오른끝', 'translate(8px,1px) scaleX(-1)']]) {
        sw.style.animation = 'none';
        sw.style.transform = tf;
        const bb = svg.getBBox(), sr = svg.getBoundingClientRect();
        if (!sr.width) { bad.push(`${c.name}: 물고기 상자가 0폭이다`); break; }
        const k = sr.width / 100;
        const f = { l: sr.left + bb.x * k, r: sr.left + (bb.x + bb.width) * k,
                    t: sr.top + bb.y * k,  b: sr.top + (bb.y + bb.height) * k };
        const bs = bowlSvg.getBoundingClientRect(), q = bs.width / 100;
        const g = { cx: bs.left + GLASS.cx * q, cy: bs.top + GLASS.cy * q,
                    r: GLASS.r * q, top: bs.top + GLASS.surface * q };
        let worst = 0;
        for (const [x, y] of [[f.l, f.t], [f.r, f.t], [f.l, f.b], [f.r, f.b]]) {
          worst = Math.max(worst, Math.hypot(x - g.cx, y - g.cy));
        }
        if (worst > g.r - MARGIN) {
          bad.push(`${c.name} ${label}: 유리를 ${Math.round(worst - g.r)}px 넘어섰다`);
        }
        // 수면 위로 떠오르면 물 밖에 뜬 것으로 보인다
        if (f.t < g.top) bad.push(`${c.name} ${label}: 수면 위로 ${Math.round(g.top - f.t)}px 나왔다`);
      }
    }
    // 물이 아닌 크리처에는 어항이 안 붙어야 한다 (붙으면 유니콘이 어항에 들어간다)
    const dry = D.RECIPES.filter(r => r.result.kind === 'creature' && r.result.move !== 'water')
      .map(r => r.result);
    for (const c of dry) {
      host.innerHTML = `<div class="stage-creatures">${petStage(c)}</div>`;
      if (host.querySelector('.cr-bowl')) bad.push(`${c.name}(${c.move}): 물이 아닌데 어항이 붙었다`);
    }
    host.remove();
    return { bad, n: fish.length, dry: dry.length };
  });

  // ─── 어깨에서 팔로 파인 홈이 없는가 ──────────────────────────
  //
  // 목에서 팔 끝까지 실루엣의 **윗선은 한 번도 다시 솟지 않아야 한다.**
  // 어깨 봉우리와 팔의 둥근 윗머리가 따로 놀면 그 사이가 파여, 「관절이 분리된 인형」처럼
  // 보인다 — 실제로 어깨 곡선이 x=126 에서 y=114 까지 내려온 반면 팔 윗머리는 110.25 라
  // **3.75px 짜리 홈**이 있었다. 눈으로는 「살짝 파였네」 정도로만 보여 오래 남아 있었다.
  //
  // 재는 법: **머리·머리카락·옷을 다 빼고 몸통+팔만** 남겨 열마다 맨 위 픽셀을 찍는다.
  // (머리를 남기면 어깨 위를 머리가 덮어 프로필이 머리 윤곽이 된다)
  // 안쪽(x=100)에서 바깥으로 훑으며 「여태 가장 낮았던 y」보다 다시 올라오면 그게 홈이다.
  const SHOULDER_DIP = 1;        // px. 래스터 반올림 탓에 0 은 못 잡는다
  // 어깨 마개의 **세로 / 팔 폭**. 반원이면 0.88 로 나온다(그늘이 폭에 얹혀서
  // 이론값 0.5 보다 크게 잰다). 타원으로 늘이면 1.07 이다 — 그 사이에 금을 긋는다
  const CAP_MIN = 1.0;
  const shoulder = await page.evaluate(async (MAXDIP) => {
    const D = window.GameData, bad = [], beakBad = [], S = 4;
    const cv = document.createElement('canvas');
    cv.width = 200 * S; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    // 몸통이 든 그룹 하나만 남긴다 (머리·머리카락·그림자·다리는 뺀다)
    function bodyOnly(svg) {
      const wrap = document.createElement('div');
      wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const keep = root.querySelector('[data-part="torso"]').closest('svg > g');
      [...root.children].forEach(c => { if (c.tagName !== 'defs' && c !== keep) c.remove(); });
      return root.outerHTML;
    }
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    async function pixels(svg) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.clearRect(0, 0, 200 * S, 348 * S);
      ctx.drawImage(img, 0, 0, 200 * S, 348 * S);
      return ctx.getImageData(0, 0, 200 * S, 348 * S).data;
    }
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    const worst = [];
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      const d = await pixels(bodyOnly(window.Avatar.build(outfit, w, null)));
      let peak = -Infinity, dip = 0, at = 0;
      for (let x = 100; x <= 180; x += 0.5) {
        const xx = Math.round(x * S);
        let ty = null;
        for (let y = 100 * S; y <= 220 * S; y++) {
          if (d[(y * 200 * S + xx) * 4 + 3] > 128) { ty = y / S; break; }
        }
        if (ty == null) continue;
        if (ty > peak) peak = ty;
        else if (peak - ty > dip) { dip = peak - ty; at = x; }
      }
      worst.push(+dip.toFixed(2));
      if (dip > MAXDIP) {
        bad.push(`체형 ${w}: 어깨에서 팔로 ${dip.toFixed(1)}px 파였다 (x≈${at})`
          + ` — 어깨 곡선(BODY.shoulderC)이 팔 윗머리보다 먼저 내려온다`);
      }
    }

    // ─── 어깨가 팔보다 튀어나오지 않는가 (부리) ────────────────
    //
    // 어깨 쪽(목 자락 · 몸통의 어깨 끝)이 팔보다 바깥으로 나오면 부리처럼 뾰족한 턱이 된다.
    // 몸통·팔 배율을 따로 움직여야 드러난다 — 기본값(둘 다 100%)에서는 팔이 늘
    // 어깨보다 바깥이라 어떤 부리든 팔 밑에 숨는다.
    // 여태 두 가지가 여기 걸렸다: **목의 벌어진 자락**(몸통 50% 에서 6px)과
    // **어깨 끝**(팔 50% 에서 2.5px). 둘 다 몸통·팔을 같이 줄여야 보였다.
    //
    // ⚠️ **옆선이 되돌아오는지로 재면 안 된다.** 팔이 어깨에서 팔꿈치로 가늘어지는
    // 것까지 「부리」로 잡는다 (팔 200% 에서 3px 씩 헛나왔다).
    // **몸통·목과 팔을 따로 그려 같은 높이에서 견준다** — 이것이 진짜 규칙이다.
    function keepOnly(svg, sel) {
      const wrap = document.createElement('div');
      wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const keep = root.querySelector('[data-part="torso"]').closest('svg > g');
      [...root.children].forEach(c => { if (c.tagName !== 'defs' && c !== keep) c.remove(); });
      [...keep.children].forEach(g => { if (sel === 'arm' ? !g.matches('[data-part="arm"]')
                                                          : g.matches('[data-part="arm"]')) g.remove(); });
      return root.outerHTML;
    }
    const rightEdge = (d, y) => {
      for (let x = 199 * S; x >= 100 * S; x--) {
        if (d[(Math.round(y * S) * 200 * S + x) * 4 + 3] > 128) return x / S;
      }
      return null;
    };
    const beaks = [];
    for (const kt of [0.5, 0.75, 1, 1.5, 2]) for (const ka of [0.5, 0.75, 1, 1.5, 2]) {
      const svg = window.Avatar.build(outfit, 0, { torso: kt, arm: ka });
      const dBody = await pixels(keepOnly(svg, 'body'));    // 몸통 + 목 + 엉덩이
      const dArm = await pixels(keepOnly(svg, 'arm'));
      let over = 0, at = 0;
      for (let y = 108; y <= 145; y += 0.5) {
        const a = rightEdge(dArm, y);
        if (a == null) continue;                            // 팔이 아직 없는 높이
        const b = rightEdge(dBody, y);
        if (b != null && b - a > over) { over = b - a; at = y; }
      }
      beaks.push(+over.toFixed(2));
      if (over > MAXDIP) {
        beakBad.push(`몸통 ${kt * 100}% · 팔 ${ka * 100}%: 어깨가 팔보다 ${over.toFixed(1)}px 튀어나왔다`
          + ` (y≈${at}) — 목 자락이나 어깨 끝이 팔 밖으로 나온다`);
      }
    }
    // ─── 어깨 마개가 반원보다 완만한가 ─────────────────────────
    //
    // 팔 위 끝의 마개가 **반원**이면 폭의 절반(7.5px)만에 가로에서 세로로 돌아서,
    // 평평한 어깨선과 거의 곧은 팔이 작은 모서리 하나로 만난다 — 어깨와 팔이
    // **직각**으로 보이던 것이 이것이다. 세로로 늘인 타원이면 같은 폭을 더 긴 거리에
    // 걸쳐 돌아 어깨가 둥글게 흘러내린다 (`ARM_CAP_H`).
    // 재는 법: 팔만 그려 놓고 **맨 위에서 「제 폭이 다 나올 때까지」 몇 px 내려가는지.**
    let capH = 0, capW = 0;
    {
      const d = await pixels(keepOnly(window.Avatar.build(outfit, 0, null), 'arm'));
      const wide = y => {
        const row = Math.round(y * S); let i = null, o2 = null;
        for (let x = 100 * S; x <= 185 * S; x++) if (d[(row * 200 * S + x) * 4 + 3] > 128) { i = x / S; break; }
        if (i == null) return null;
        for (let x = 185 * S; x >= 100 * S; x--) if (d[(row * 200 * S + x) * 4 + 3] > 128) { o2 = x / S; break; }
        return o2 - i;
      };
      let top = null;
      for (let y = 100; y <= 140; y += 0.25) if (wide(y) != null) { top = y; break; }
      for (let y = top; y <= top + 30; y += 0.25) { const v = wide(y); if (v > capW) capW = v; }
      for (let y = top; y <= top + 30; y += 0.25) { if (wide(y) >= capW - 0.3) { capH = y - top; break; } }
    }
    return { bad, beakBad, worst, beak: Math.max.apply(null, beaks), beakN: beaks.length,
             capH: +capH.toFixed(2), capW: +capW.toFixed(2) };
  }, SHOULDER_DIP);

  // ─── 팔꿈치 바깥에 턱이 생기지 않는가 ────────────────────────
  //
  // 팔은 윗팔·아랫팔 두 마디이고 아랫팔만 팔꿈치에서 굽는다(elbowRot).
  // 예전에는 두 마디의 이음매를 **윗팔을 고정된 반폭(w/2)만큼 아래로 늘려서**
  // 덮었는데, **그 늘린 조각은 굽힘을 안 탄다.** 그래서 팔꿈치 아래에 굽힌 만큼
  // (길이 × sin 9°) 네모난 턱이 바깥으로 삐져나왔다 — 가는 팔일수록 심했다
  // (늘린 길이가 굵기와 무관한 고정값이라 그렇다).
  //
  // 재는 법: 팔만 남기고 팔꿈치 둘레(y 150~195)의 **바깥 옆선을 0.5px 마다** 찍어
  // 이웃한 줄 사이의 **단차**를 본다. 매끄러운 팔은 기울기가 tan(9°)+테이퍼라
  // 0.25px(래스터 눈금)을 못 넘는다. 턱이 있으면 그 자리에서 확 튄다
  // (고치기 전 1.25px · 고친 뒤 0.25px).
  const ELBOW_STEP = 0.5;        // px. 0.25 는 래스터 눈금이라 그 위로 잡는다
  const elbow = await page.evaluate(async (MAX) => {
    const D = window.GameData, bad = [], S = 4;
    const cv = document.createElement('canvas');
    cv.width = 200 * S; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    // 팔만 남긴다 — 몸통이 같은 살색이라 같이 두면 턱이 몸통에 묻힌다
    function keepArm(svg) {
      const wrap = document.createElement('div');
      wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const keep = root.querySelector('[data-part="torso"]').closest('svg > g');
      [...root.children].forEach(c => { if (c.tagName !== 'defs' && c !== keep) c.remove(); });
      [...keep.children].forEach(g => { if (!g.matches('[data-part="arm"]')) g.remove(); });
      return root.outerHTML;
    }
    async function pixels(svg) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.clearRect(0, 0, 200 * S, 348 * S);
      ctx.drawImage(img, 0, 0, 200 * S, 348 * S);
      return ctx.getImageData(0, 0, 200 * S, 348 * S).data;
    }
    const edgeR = (d, y) => {
      for (let x = 199 * S; x >= 100 * S; x--)
        if (d[(Math.round(y * S) * 200 * S + x) * 4 + 3] > 128) return x / S;
      return null;
    };
    const edgeL = (d, y) => {
      for (let x = 0; x <= 100 * S; x++)
        if (d[(Math.round(y * S) * 200 * S + x) * 4 + 3] > 128) return x / S;
      return null;
    };
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    const steps = [];
    for (const ka of [0.5, 0.75, 1, 1.5, 2]) {
      const d = await pixels(keepArm(window.Avatar.build(outfit, 0, { arm: ka })));
      for (const side of ['R', 'L']) {
        const ed = side === 'R' ? edgeR : edgeL;
        let step = 0, at = 0, prev = null;
        for (let y = 150; y <= 195; y += 0.5) {
          const e = ed(d, y);
          if (e == null) { prev = null; continue; }
          if (prev != null && Math.abs(e - prev) > step) { step = Math.abs(e - prev); at = y; }
          prev = e;
        }
        steps.push(+step.toFixed(2));
        if (step > MAX) {
          bad.push(`팔 ${ka * 100}% ${side}: 팔꿈치 바깥 옆선이 ${step.toFixed(2)}px 튄다`
            + ` (y≈${at}) — 두 마디의 이음매가 굽힘을 안 따라간다`);
        }
      }
    }
    return { bad, n: steps.length, worst: Math.max.apply(null, steps) };
  }, ELBOW_STEP);

  // ─── 허리 → 엉덩이 → 허벅지 옆선이 꺾이지 않는가 ─────────────
  //
  // 셋은 배율이 서로 다르다(허리·엉덩이·허벅지 슬라이더). 예전에는 엉덩이 path 를
  // 통째로 늘려서 **허리에 닿는 점과 허벅지에 닿는 점까지 같이 늘어났고**, 그래서
  // 허리를 줄이거나 엉덩이를 키우면 두 이음매에 계단이 생겼다.
  //
  // 재는 법: 몸통+엉덩이+허벅지만 남기고 오른쪽 옆선 x(y) 를 1px 마다 찍은 뒤,
  // 3px 창의 기울기가 이웃과 얼마나 튀는지 본다. 매끄러운 곡선이면 0 에 가깝고,
  // 꺾이면 그 자리에서 확 튄다 (고치기 전 허리에서 8.2, 허벅지 이음매에서 4.8).
  const KINK_MAX = 1.5;
  const kink = await page.evaluate(async (MAX) => {
    const D = window.GameData, bad = [], S = 4;
    const cv = document.createElement('canvas');
    cv.width = 200 * S; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    function sil(t) {
      const O = Object.assign({}, D.DEFAULT_OUTFIT, { top: 'top_none', bottom: 'bottom_none',
        dress: 'dress_none', shoes: 'shoes_none', hair: 'hair_none' });
      const wrap = document.createElement('div');
      wrap.innerHTML = window.Avatar.build(O, 0, t);
      const root = wrap.firstElementChild;
      // 팔·종아리·머리는 옆선을 가리므로 뺀다 (허리~허벅지만 본다)
      root.querySelectorAll('[data-part="arm"],[data-part="calf"],[data-part="head"]').forEach(e => e.remove());
      return root.outerHTML;
    }
    const combos = [['기본', {}], ['허리 60', { waist: 0.6 }], ['허리 60 엉덩이 160', { waist: 0.6, hip: 1.6 }],
      ['엉덩이 180', { hip: 1.8 }], ['엉덩이 180 허벅지 60', { hip: 1.8, thigh: 0.6 }],
      ['엉덩이 50', { hip: 0.5 }], ['허리 150 엉덩이 60', { waist: 1.5, hip: 0.6 }],
      ['몸통 150 엉덩이 60', { torso: 1.5, hip: 0.6 }],
      // 엉덩이 하한(20%) — 예전에는 허벅지가 하한 노릇을 해서 **여기까지 와도
      // 그림이 안 바뀌었다.** 아무것도 안 변하는 그림을 재고 있으니 늘 통과였다
      ['엉덩이 20', { hip: 0.2 }], ['엉덩이 20 허벅지 200', { hip: 0.2, thigh: 2 }]];
    let worst = 0;
    for (const [n, t] of combos) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sil(t));
      });
      ctx.clearRect(0, 0, 200 * S, 348 * S);
      ctx.drawImage(img, 0, 0, 200 * S, 348 * S);
      const d = ctx.getImageData(0, 0, 200 * S, 348 * S).data;
      const e = [];
      for (let y = 150; y <= 222; y++) {
        let mx = null;
        for (let x = 199 * S; x >= 100 * S; x--) {
          if (d[(Math.round(y * S) * 200 * S + x) * 4 + 3] > 128) { mx = x / S; break; }
        }
        e.push([y, mx]);
      }
      const sl = [];
      for (let i = 0; i + 3 < e.length; i++) {
        sl.push(e[i][1] == null || e[i + 3][1] == null ? null : (e[i + 3][1] - e[i][1]) / 3);
      }
      let mk = 0, at = 0;
      for (let i = 1; i < sl.length; i++) {
        if (sl[i] == null || sl[i - 1] == null) continue;
        const j = Math.abs(sl[i] - sl[i - 1]);
        if (j > mk) { mk = j; at = e[i][0]; }
      }
      if (mk > worst) worst = mk;
      if (mk > MAX) bad.push(`${n}: 옆선이 y≈${at} 에서 ${mk.toFixed(1)} 만큼 꺾인다`);
    }
    return { bad, n: combos.length, worst: +worst.toFixed(2) };
  }, KINK_MAX);

  // ─── 다리 사이 틈이 배율과 상관없이 일정한가 ────────────────
  //
  // 허벅지·종아리를 가늘게 해도 **다리는 붙어 있어야 한다.** 예전에는 굵기 배율의 축이
  // 파츠의 가운데라 가늘게 만들면 안쪽 변까지 밖으로 밀려 **다리 사이가 벌어졌다**
  // (허벅지 60% 에서 틈 4px → 12px). 체지방이 빠져도 살은 바깥에서 빠지고 안쪽 틈은
  // 그대로다 — 그래서 축을 **안쪽 변**으로 옮겼다.
  const GAP_SPREAD_MAX = 1.5;
  const legGap = await page.evaluate(async (MAX) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    const bare = { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    // y 에서 두 다리 사이의 빈 구간 폭
    async function gapAt(t, ys) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,'
          + encodeURIComponent(window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, t));
      });
      ctx.clearRect(0, 0, W, 348 * S);
      ctx.drawImage(img, 0, 0, W, 348 * S);
      const d = ctx.getImageData(0, 0, W, 348 * S).data;
      // **가운데(x=100)에서 양옆으로** 첫 살까지가 다리 사이 틈이다.
      // 창을 통째로 세면 다리 **바깥**의 배경까지 들어가 가늘게 만들수록 커진다
      const gaps = ys.map(y => {
        const row = Math.round(y * S);
        let l = 100 * S, r = 100 * S;
        while (l > 60 * S && d[(row * W + l) * 4 + 3] <= 128) l--;
        while (r < 140 * S && d[(row * W + r) * 4 + 3] <= 128) r++;
        return (r - l) / S;
      });
      // 발목(y=320 · 발등 위) 오른쪽 다리의 바깥 변 — 종아리를 굵게 해도 안 움직여야 한다.
      // ⚠️ **고정 x 에서 출발하지 않는다.** 예전에는 x=103 부터 「살인 동안」 밖으로 갔는데,
      // 안쪽 변이 곡선이 되면서 그 자리가 다리 사이 틈이 되어 **첫걸음에 멈췄다** —
      // 모든 배율에서 103 을 돌려주어 검사가 조용히 통과했다.
      // 가운데에서 나가며 **살에 들어갔다가 다시 나오는 자리**를 잡는다
      const row = Math.round(320 * S);
      let ax = 100 * S;
      while (ax < 160 * S && d[(row * W + ax) * 4 + 3] <= 128) ax++;   // 안쪽 변
      while (ax < 160 * S && d[(row * W + ax) * 4 + 3] > 128) ax++;    // 바깥 변
      return { gaps, ankle: ax / S };
    }
    const YS = [240, 250, 300];            // 허벅지 · 무릎 · 종아리
    const r0 = await gapAt({}, YS);
    const base = r0.gaps, out = [];
    for (const k of [0.4, 0.6, 0.8, 1.2, 1.6, 2]) {
      const r = await gapAt({ thigh: k, calf: k }, YS);
      out.push({ k, g: r.gaps, ankle: r.ankle });
      for (let i = 0; i < YS.length; i++) {
        const diff = Math.abs(r.gaps[i] - base[i]);
        if (diff > MAX) {
          bad.push(`허벅지·종아리 ${k * 100}%: y=${YS[i]} 의 다리 사이 틈이 `
            + `${base[i].toFixed(1)} → ${r.gaps[i].toFixed(1)}px 로 ${diff.toFixed(1)} 만큼 달라졌다`);
        }
      }
      // 종아리를 **굵게** 해도 발목은 그대로여야 한다 (가늘게 하면 같이 가늘어져도 된다)
      if (k > 1 && r.ankle - r0.ankle > MAX) {
        bad.push(`종아리 ${k * 100}%: 발목이 ${r0.ankle.toFixed(1)} → ${r.ankle.toFixed(1)}px 로 굵어졌다`
          + ` — 종아리를 굵게 해도 발목은 그대로여야 한다`);
      }
    }
    const spread = YS.map((y, i) => {
      const vals = out.map(o => o.g[i]).concat([base[i]]);
      return +(Math.max.apply(null, vals) - Math.min.apply(null, vals)).toFixed(2);
    });
    const ankles = out.filter(o => o.k > 1).map(o => o.ankle);
    return { bad, base: base.map(v => +v.toFixed(1)), spread, ys: YS, n: out.length,
             ankle: +r0.ankle.toFixed(1), ankleMax: +Math.max.apply(null, ankles).toFixed(1) };
  }, GAP_SPREAD_MAX);

  // ─── 팔 끝에 손이 있는가 ────────────────────────────────────
  //
  // 예전에는 손이 아예 없었다. 팔이 손목에서 둥근 마개로 뚝 끝나서 **잘린 것처럼**
  // 보였다 (소매를 그리는 옷 몇 벌만 소매 끝에 살색 동그라미를 하나 얹고 있었다).
  //
  // 손은 팔과 **같은 살색**이라 색으로는 못 찾는다 — **실루엣**으로 잡는다:
  //   ① 팔이 손목(armY+armH)보다 **더 아래까지** 내려온다
  //   ② 그 끝 언저리가 손목보다 **눈에 띄게 넓다** (손목보다 좁으면 그냥 마개다)
  // 장갑도 같이 본다 — 팔만 덮고 손을 빼먹으면 장갑 아래로 살색 손이 삐져나온다.
  // 손은 손목보다 **넓되 지나치게 넓지는 않아야** 한다. 위쪽 한계가 없어서
  // 「팔 50% 에서 손만 공이 된다」(기본 손목의 0.85 를 바닥으로 깔던 시절 1.8px)를
  // 아무도 못 잡았다 — 가는 팔은 몸 안으로 물러나는데 손만 밖으로 나와 **몸에 붙은
  // 구슬**로 보였다. 아래위를 다 막아야 「마개」와 「공」을 같이 잡는다
  const HAND_DROP_MIN = 4, HAND_BULGE_MIN = 0.6, HAND_BULGE_MAX = 1.3;
  const HAND_KEEP = 0.6;          // 옷을 입었을 때 손 자리의 이만큼은 살색으로 남아야 한다
  // 손이 팔과 겹치는 몫. 제대로 붙어 있으면 배율과 무관하게 12% 안팎이고,
  // `armPoint` 가 `armShift` 를 빼먹으면 몸통 50% 에서 **0%** 로 떨어진다
  const HAND_TOUCH = 0.06;
  // 공주 드레스의 아랫팔 높이 두 줄에서 만나야 할 **윤곽선 토막** 수 (정상 4줄)
  const SLEEVE_OUTLINE_MIN = 4;
  const hand = await page.evaluate(async (o) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    function keep(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild; const only = root.cloneNode(false);
      [...root.querySelectorAll(sel)].forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, 348 * S); ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    // 오른팔의 **바깥 변**. 안쪽은 그늘(ARM_SHADE)이 2.5px 더 나와 있어 폭으로 재면
    // 손(그늘 없음)이 손목보다 좁게 나온다 — 바깥 변만 본다
    const outer = (d, y) => {
      const row = Math.round(y * S);
      for (let x = 185 * S; x >= 100 * S; x--) if (d[(row * W + x) * 4 + 3] > 128) return x / S;
      return null;
    };
    // 손을 뺀 팔의 끝(armY+armH=214)을 몸 배율로 옮긴 자리
    const ARM_END = 342 - (342 - 214) * (1 + (84 - 84 * 0.979) / 229);
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const glove = (D.WARDROBE.glove || []).filter(g => g.kind !== 'none')[0];
    const cases = [['맨팔 100%', {}, null, '[data-part="arm"]'],
                   ['맨팔 50%', {}, { arm: 0.5 }, '[data-part="arm"]'],
                   ['맨팔 200%', {}, { arm: 2 }, '[data-part="arm"]'],
                   ['긴팔', { top: 'top_knit' }, null, '[data-part="arm"]']];
    if (glove) cases.push(['장갑', { glove: glove.id }, null, '[data-part="glove"]']);
    const rows = [], handRows = [], touchRows = [];
    let outlineRuns = 0;
    for (const [name, wear, t, sel] of cases) {
      const svg = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare, wear), 0, t);
      const d = await px(keep(svg, sel));
      let bottom = null;
      for (let y = 260; y >= 150; y -= 0.5) if (outer(d, y) != null) { bottom = y; break; }
      if (bottom == null) { bad.push(`${name}: 팔이 안 그려졌다`); continue; }
      // ① 손목보다 아래로 내려온다 — 손이 없으면 팔은 armY+armH 에서 끝난다
      const drop = bottom - ARM_END;
      // ② 손목에서 잘록해졌다가 **바깥으로 다시 부푼다** (소매·장갑은 통이 넓어 못 잰다)
      let neck = Infinity, bulge = -Infinity;
      for (let y = ARM_END - 13; y <= ARM_END - 4; y += 0.5) { const v = outer(d, y); if (v != null && v < neck) neck = v; }
      for (let y = ARM_END - 3; y <= bottom; y += 0.5) { const v = outer(d, y); if (v != null && v > bulge) bulge = v; }
      rows.push(`${name} ↓${drop.toFixed(1)}${sel === '[data-part="arm"]' && !wear.top ? ' ↔' + (bulge - neck).toFixed(1) : ''}`);
      if (drop < o.drop) {
        bad.push(`${name}: 손이 팔 끝보다 ${drop.toFixed(1)}px 밖에 안 내려온다`
          + ` (${o.drop}px 이상) — 손 없이 손목에서 잘린 모양이다`);
      }
      if (sel === '[data-part="arm"]' && !wear.top && !(bulge - neck >= o.bulge)) {
        bad.push(`${name}: 손목 아래에서 바깥으로 ${(bulge - neck).toFixed(2)}px 밖에 안 부푼다`
          + ` (${o.bulge}px 이상) — 손이 팔보다 좁아 마개처럼 보인다`);
      }
      if (sel === '[data-part="arm"]' && !wear.top && bulge - neck > o.bulgeMax) {
        bad.push(`${name}: 손이 손목보다 ${(bulge - neck).toFixed(2)}px 나 넓다`
          + ` (${o.bulgeMax}px 까지) — 팔에 안 달린 공처럼 보인다`);
      }
    }
    // 손이 팔보다 **아래로** 내려오는가 (맨팔 기준)
    const svg1 = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, null);
    const dArm = await px(keep(svg1, '[data-part="arm"]'));
    let bot = null;
    for (let y = 260; y >= 150; y -= 0.5) if (outer(dArm, y) != null) { bot = y; break; }
    if (!(bot - ARM_END >= o.drop)) {
      bad.push(`손이 팔 끝보다 ${(bot - ARM_END).toFixed(1)}px 밖에 안 내려온다`
        + ` (${o.drop}px 이상) — 손이 팔 안에 묻혀 안 보인다`);
    }
    // ─── 옷을 입어도 손이 남아 있는가 ─────────────────────────
    //
    // 위의 검사는 전부 **손이 그려졌는지**만 본다 — 그려 놓고 옷이 그 위를 덮으면
    // 그대로 통과한다. 실제로 공주 드레스는 어깨에서 바닥까지 내려오는 종이 팔보다
    // 3~14px 밖으로 퍼져 있어서, 그 뒤에 그린 소매와 손이 **어느 높이에서도 안 비쳤다**
    // (「공주 드레스 입으면 손 사라짐」). 그림에는 손이 있는데 화면에는 없었다.
    //
    // 그래서 **손만 그린 그림으로 자리를 잡고**(`data-part="hand"`), 완성된 그림의
    // 같은 자리가 아직 살색인지 센다. 옷이 덮었으면 그 자리는 옷 색이다.
    //
    // ⚠️ **견주는 값은 「맨손 한 켤레의 넓이」다** — 손 자리 전체가 아니다.
    // 옷에 따라 손이 **두 켤레분 자리**에 그려진다: 몸이 그리는 손(팔 끝 214)과
    // 소매 끝에 오는 손(공주 드레스는 206)이 서로 8px 어긋나 있다. 자리 전체를
    // 분모로 잡으면 **제대로 보이는 손도 53% 로 나온다** — 안 보이는 켤레까지 세서다.
    const near = (p, q) => Math.abs(p[0] - q[0]) < 26 && Math.abs(p[1] - q[1]) < 26
      && Math.abs(p[2] - q[2]) < 26;
    const SKIN_RGB = [255, 220, 196];
    const dBareHand = await px(keep(
      window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, null), '[data-part="hand"]'));
    let handArea = 0;
    for (let i = 3; i < dBareHand.length; i += 4) if (dBareHand[i] >= 200) handArea++;
    const dressCases = (D.WARDROBE.dress || []).filter(x => x.kind !== 'none')
      .map(x => [x.name, { dress: x.id, top: 'top_none', bottom: 'bottom_none' }]);
    for (const [name, wear] of dressCases) {
      const svg = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare, wear), 0, null);
      const dHand = await px(keep(svg, '[data-part="hand"]'));
      const dAll = await px(svg);
      let want = 0, got = 0;
      for (let i = 3; i < dHand.length; i += 4) {
        if (dHand[i] < 200) continue;             // 손이 아닌 자리
        want++;
        const p = [dAll[i - 3], dAll[i - 2], dAll[i - 1]];
        if (near(p, SKIN_RGB)) got++;
      }
      if (!want) { bad.push(`${name}: 손이 아예 안 그려졌다`); continue; }
      const keepR = got / handArea;
      handRows.push(`${name} ${(keepR * 100).toFixed(0)}%`);
      if (keepR < o.keep) {
        bad.push(`${name}: 손 한 켤레 넓이의 ${(keepR * 100).toFixed(0)}% 만 살색으로 남았다`
          + ` (${o.keep * 100}% 이상) — 옷이 손을 덮어 화면에서는 손이 없다`);
      }
    }
    // ─── 소매가 옷과 같은 색일 때 **팔이 선으로 읽히는가** ─────
    //
    // 공주 드레스는 소매가 몸판과 **같은 색**이라 팔이 통째로 묻힌다. 그래서 둘레에
    // 윤곽선을 두르는데(`armShape` 의 `outline`), 그 선이 사라져도 **손은 그대로
    // 보이므로** 위의 「손이 옷에 안 덮이는가」는 통과한다 — 따로 봐야 한다.
    // 아랫팔 높이에서 가로로 훑어 **옷보다 어두운 선이 몇 번 지나가는지** 센다
    // (팔 둘 × 안팎 = 4줄이 정상. 선을 지우면 0줄이다).
    {
      const pr = (D.WARDROBE.dress || []).find(x => x.kind === 'princess');
      if (pr) {
        const svg2 = window.Avatar.build(
          Object.assign({}, D.DEFAULT_OUTFIT, bare, { dress: pr.id }), 0, null);
        const d2 = await px(svg2);
        const hex = pr.color.replace('#', '');
        const n = parseInt(hex, 16);
        const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        let runs = 0;
        for (const y of [188, 196]) {
          let inRun = false;
          for (let x = 60; x <= 140; x += 0.25) {
            const i = (Math.round(y * S) * W + Math.round(x * S)) * 4;
            // 옷보다 **눈에 띄게 어두운** 자리 (살색·배경은 뺀다)
            const dark = d2[i + 3] > 200 && d2[i] < base[0] - 8
              && d2[i + 1] < base[1] - 8 && d2[i + 2] < base[2] - 8;
            if (dark && !inRun) { runs++; inRun = true; } else if (!dark) inRun = false;
          }
        }
        if (runs < o.lines) {
          bad.push(`공주 드레스: 아랫팔 높이에서 옷보다 어두운 선이 ${runs}줄뿐이다`
            + ` (${o.lines}줄 이상) — 소매가 몸판과 같은 색인데 윤곽선이 없어 팔이 묻힌다`);
        }
        outlineRuns = runs;
      }
    }

    // ─── 손이 팔에 **붙어** 있는가 ────────────────────────────
    //
    // 위의 검사는 전부 **맨팔 기본 배율**에서만 손을 본다. 그런데 손자리를 잡는
    // `armPoint` 가 `armShift`(몸통 배율만큼 팔을 옆으로 옮기는 값)를 **빼먹고**
    // 있었다 — 몸통이 100% 가 아니면 손이 팔에서 **최대 16px 떨어져** 옷 위에
    // 동동 떴다 (몸통 50% 에서 겹침 0% · 100% 에서만 11.5% 라 기본에서는 안 보인다).
    // 「손이 붙어 나오지 않는다」가 이것이다.
    //
    // 그래서 **손 마스크가 팔 마스크와 실제로 겹치는지** 센다. 자리를 견주는 것보다
    // 이쪽이 낫다 — 어느 값을 빼먹든(회전축이든 기준선이든) 결과가 어긋나면 잡힌다.
    // ⚠️ `[data-part="arm"]` 안에 손이 **들어 있다** — 안 지우면 늘 100% 로 나온다
    for (const kt of [0.5, 0.75, 1, 1.25, 1.5]) for (const ka of [0.5, 1, 2]) {
      const svg2 = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0,
        { torso: kt, arm: ka });
      const wrap = document.createElement('div');
      wrap.innerHTML = keep(svg2, '[data-part="arm"]');
      const r = wrap.firstElementChild;
      [...r.querySelectorAll('[data-part="hand"]')].forEach(n => n.remove());
      const dArm = await px(r.outerHTML);
      const dHand = await px(keep(svg2, '[data-part="hand"]'));
      let hand = 0, both = 0;
      for (let i = 3; i < dHand.length; i += 4) {
        if (dHand[i] < 200) continue;
        hand++;
        if (dArm[i] > 200) both++;
      }
      const ov = hand ? both / hand : 0;
      if (ov < o.touch) {
        bad.push(`몸통 ${kt * 100}% · 팔 ${ka * 100}%: 손이 팔과 ${(ov * 100).toFixed(1)}%`
          + ` 밖에 안 겹친다 (${o.touch * 100}% 이상) — 손이 팔에서 떨어져 있다`);
      }
      if (ka === 1) touchRows.push(`몸통${kt * 100} ${(ov * 100).toFixed(1)}%`);
    }
    return { bad: bad, rows: rows, drop: +(bot - ARM_END).toFixed(1),
             keep: handRows, touch: touchRows, outline: outlineRuns };
  }, { drop: HAND_DROP_MIN, bulge: HAND_BULGE_MIN, bulgeMax: HAND_BULGE_MAX,
       keep: HAND_KEEP, touch: HAND_TOUCH, lines: SLEEVE_OUTLINE_MIN });

  // ─── 슬라이더를 끝까지 밀었을 때의 두께가 정해진 값인가 ──────
  //
  // 슬라이더의 상한은 **부위마다 다르고**(game.js 의 `TUNE_PARTS`), 같은 배율이라도
  // 자연스러운 두께는 부위마다 다르다. 눈으로 맞춘 값이라(`TUNE_GAIN`) 코드 어딘가를
  // 손보다가 조용히 어긋나기 쉬워서 100% 대비 몇 배가 되는지를 여기 박아 둔다.
  //
  // ⚠️ **재는 자리는 그 부위의 상한이다.** 엉덩이를 200% 에서 재고 있었는데
  // 슬라이더는 150% 까지밖에 안 올라간다 — **닿을 수 없는 자리를 지키느라**
  // 정작 사람이 쓰는 구간이 죽어 있어도 통과였다. 배수는 그대로다(43.0/38.8=1.11) —
  // 그 두께가 이제 150% 에서 나온다.
  // ⚠️ **100% 는 어느 부위도 안 움직인다** — 그것도 같이 본다.
  // ⚠️ **허벅지와 종아리는 같은 배수여야 한다.** 슬라이더 상한이 둘 다 200% 인데
  // 허벅지만 1.44 배였다 — 끝까지 올리면 **다리 위쪽이 아래쪽보다 가늘어 보였고**,
  // 개발용 패널의 숫자에도 143.8% / 159.3% 으로 그렇게 찍혔다.
  // ⚠️ **재는 창을 199 까지 넓혔다.** 175 에서 자르고 있어서 굵어진 허벅지가
  // 창 밖으로 나가 「74.0px」에 붙박여 있었다 — gain 을 올려도 숫자가 안 움직였다.
  // 재는 자리가 좁으면 «고쳐도 그대로»로 보인다.
  const FAT_MAX = { 허벅지: [2, 1.93], 엉덩이: [1.5, 1.11], 종아리: [2, 1.93] };
  const FAT_TOL = 0.06;
  const fat = await page.evaluate(async (o) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    function keep(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild; const only = root.cloneNode(false);
      [...root.querySelectorAll(sel)].forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, 348 * S); ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    // 오른쪽 반의 **살 두께** = 바깥 변 − 안쪽 변 (가장 두꺼운 자리)
    async function thickest(sel, t) {
      const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                     shoes: 'shoes_none', hair: 'hair_none' };
      const d = await px(keep(window.Avatar.build(
        Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, t), sel));
      let best = 0;
      for (let y = 186; y <= 330; y += 0.5) {
        const row = Math.round(y * S);
        let i = null, out = null;
        for (let x = 100 * S; x <= 199 * S; x++) if (d[(row * W + x) * 4 + 3] > 128) { i = x / S; break; }
        if (i == null) continue;
        for (let x = 199 * S; x >= 100 * S; x--) if (d[(row * W + x) * 4 + 3] > 128) { out = x / S; break; }
        if (out - i > best) best = out - i;
      }
      return best;
    }
    const parts = [['허벅지', 'thigh', '[data-part="thigh"]'],
                   ['엉덩이', 'hip', '[data-part="hip"]'],
                   ['종아리', 'calf', '[data-part="calf"]']];
    const rows = [];
    for (const [name, key, sel] of parts) {
      const [kMax, want] = o.want[name];
      const a = await thickest(sel, { [key]: 1 });
      const b = await thickest(sel, { [key]: kMax });
      const r = b / a;
      rows.push(`${name} ${kMax * 100}% 에서 ${r.toFixed(2)}배`);
      if (Math.abs(r - want) > o.tol) {
        bad.push(`${name} ${kMax * 100}% 의 두께가 100% 의 ${r.toFixed(2)}배다`
          + ` — ${want}배여야 한다 (${a.toFixed(1)}px → ${b.toFixed(1)}px)`);
      }
    }
    // 100% 는 어느 부위도 안 움직인다 — 기본 그림과 바이트까지 같아야 한다.
    // ⚠️ 그라디언트 id 는 부를 때마다 번호가 오르므로(neckG_a1 · a2 …) 지우고 견준다
    const norm = t => t.replace(/_a\d+/g, '_a');
    const one = norm(window.Avatar.build(D.DEFAULT_OUTFIT, 0,
      { thigh: 1, hip: 1, calf: 1, waist: 1, torso: 1, arm: 1 }));
    if (one !== norm(window.Avatar.build(D.DEFAULT_OUTFIT, 0, null))) {
      bad.push('배율을 전부 100% 로 준 그림이 기본 그림과 다르다 — 100% 는 아무것도 안 바꿔야 한다');
    }
    return { bad: bad, rows: rows };
  }, { want: FAT_MAX, tol: FAT_TOL });

  // ─── 슬라이더를 움직이면 실루엣이 정말 움직이는가 ────────────
  //
  // **위의 「상한 두께」로는 이걸 못 잡는다.** 그건 양 끝 두 점만 보는데, 부위끼리
  // 서로 하한 노릇을 하다 보면 **가운데가 통째로 눌러앉는다** — 실제로 `LEG.hipW` 를
  // 20 → 36 으로 올린 뒤 허벅지 윗머리(38)가 엉덩이(34)보다 굵어져,
  // **엉덩이 20%~150% 가 전부 38.0~38.6px** 로 나왔다. 슬라이더를 끝에서 끝까지
  // 밀어도 좌우 폭이 하나도 안 변하는데 검사는 전부 통과였다.
  //
  // 그래서 슬라이더를 **실제로 쓰는 상한·하한 안에서 여러 칸** 훑는다:
  //   ① 뒤로 가지 않는다 (줄였는데 굵어지면 안 된다)
  //   ② 한 칸 한 칸이 눈에 보인다 (이웃한 칸 사이가 최소 1px)
  //   ③ 양 끝의 차이가 충분하다 (한쪽 폭으로 8px = 좌우로 16px 이상)
  // 하한은 `game.js` 의 `TUNE_PARTS` 를 따른다 — 엉덩이만 20%, 나머지는 50% 다.
  // ─── 몸이 그림 상자 밖으로 나가지 않는가 ──────────────────────
  //
  // ⚠️ `viewBox` 는 200 인데 **통통한 몸은 가로로 1.36배 늘어난다**(`bodyScaleX`).
  // 그래서 「통통 최대 × 슬라이더 최대」는 이미 191.5 까지 차 있다 — 남은 것이 8.5px 다.
  // 굵기를 키울 때 이걸 안 보면 **오른쪽이 상자에 잘린 채로 통과한다**
  // (실제로 `TUNE_GAIN` 을 1.0 으로 올렸더니 64줄이 잘렸는데 다른 검사는 전부 통과였다).
  const BOX_MARGIN_MIN = 0.5;          // px. 상자 끝에 닿으면 잘린 것이다
  const box = await page.evaluate(async (min) => {
    const D = window.GameData, S = 4, W = 200 * S, H = 348 * S;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    // **가장 넓어지는 조합**으로 잰다 — 몸무게 최대 × 슬라이더 전부 최대
    const t = { torso: 1.5, waist: 1.5, hip: 1.5, arm: 1.5, thigh: 2, calf: 2, face: 1.14 };
    const svg = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 1, t);
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let widest = 0, cut = 0;
    for (let y = 0; y < H; y++) for (let x = W - 1; x >= 0; x--)
      if (d[((y * W) + x) * 4 + 3] > 128) {
        if (x / S > widest) widest = x / S;
        if (x >= W - 2) cut++;
        break;
      }
    const room = +(200 - widest).toFixed(1);
    return { widest: +widest.toFixed(1), room: room, cut: cut,
             bad: cut > 0 || room < min
               ? [`통통 최대 × 슬라이더 최대에서 몸이 오른쪽 ${widest.toFixed(1)}/200 까지 간다`
                  + ` (여백 ${room}px · ${cut}줄이 잘렸다). 굵기를 더 키우려면 viewBox 를`
                  + ` 「-12 0 224 342」 처럼 양옆으로 넓혀야 한다 (중심선 100 은 그대로 두고)`]
               : [] };
  }, BOX_MARGIN_MIN);

  // ─── 하의 위로 다시 찍는 팔이 «패이지» 않는가 ────────────────
  //
  // 팔은 몸통과 같은 층이라 하의보다 **뒤**에 있고, 허리 아래만 다시 찍어 앞으로
  // 꺼낸다(`armsOverSkirt`). ⚠️ 그 조각의 위 끝에 **둥근 어깨 마개**가 붙어 있었다 —
  // `armShape` 이 「첫 조각이면 마개」로만 판정해서, 중간부터 그리는 조각에도 씌웠다.
  // 허리선에서 팔이 갑자기 오므라들고 그 틈으로 치마가 비쳤다
  // (「하의가 팔 위에 그려진다」로 신고받은 것이 실은 **팔이 패인 것**이었다).
  //
  // 재는 법: 팔만 그린 것에서 그 높이의 **팔 한가운데**를 찾고, 옷을 입힌 그림의
  // 같은 자리에 **옷색이 있는지** 본다. 팔이 앞에 있으면 한 톨도 없어야 한다.
  // 0 이 아니라 8 인 이유: 팔 «그늘»이 몸 쪽으로 2.5px 밀려 있어서 팔 조각의 맨 바깥
  // 한 줄이 옷과 겹친다 (반바지에서 4점). 마개가 붙으면 **227~238점**이 되므로
  // 이 문턱으로도 갈린다 — 안티에일리어싱을 살로 세지 않으려고 창을 좁히는 것과 같은 이유다
  const ARM_SKIRT_MAX = 8;
  const armSkirt = await page.evaluate(async (max) => {
    const D = window.GameData, bad = [], rows = [], S = 4, W = 200 * S, H = 348 * S;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data;
    }
    function keep(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild, only = root.cloneNode(false);
      [...root.querySelectorAll(sel)].forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    const hex = c => {
      const h = c.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(q => q + q).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const WY = 164;                                   // BODY.waistY
    const bare = { top: 'top_none', dress: 'dress_none', shoes: 'shoes_none', hair: 'hair_none' };
    for (const it of (D.WARDROBE.bottom || [])) {
      if (it.kind === 'none') continue;
      const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare, { bottom: it.id });
      const full = window.Avatar.build(outfit, 0, null);
      const arm = await px(keep(full, '[data-part="arm"]'));
      const all = await px(full);
      const [r0, g0, b0] = hex(it.color);
      // ⚠️ **팔 한가운데만 보면 못 잡는다.** 구멍은 둥근 마개가 파먹는 «안쪽 변»에
      // 생기는데(x 125~129 · 2~4px), 가운데는 멀쩡했다 — 사보타주가 그대로 통과했다.
      // 그래서 규칙 그대로 잰다: **팔이 있는 자리에는 옷색이 한 톨도 없어야 한다.**
      let n = 0, worst = null;
      for (let y = WY; y <= WY + 12; y += 0.25) {
        const row = Math.round(y * S);
        for (let x = 40 * S; x < 175 * S; x++) {
          if (!(arm[(row * W + x) * 4 + 3] > 200)) continue;      // 그 자리에 팔이 있는가
          const i = (row * W + x) * 4;
          if (all[i + 3] > 250 && Math.abs(all[i] - r0) <= 3 && Math.abs(all[i + 1] - g0) <= 3
              && Math.abs(all[i + 2] - b0) <= 3) { n++; if (worst == null) worst = y; }
        }
      }
      rows.push(`${it.id} ${n}`);
      if (n > max) {
        bad.push(`${it.id}: 허리선 아래(y≈${worst})에서 **팔 자리에 옷색이 ${n}점** 보인다`
          + ` — 팔이 하의 위로 안 나왔거나, 다시 찍는 조각이 둥글게 패였다`);
      }
    }
    return { bad: bad, rows: rows };
  }, ARM_SKIRT_MAX);

  // ─── 어깨와 머리카락 사이가 벌어지지 않는가 ───────────────────
  //
  // 목 옆에서는 **어깨 · (틈) · 머리카락** 순으로 놓인다. 그 틈이 넓어지면
  // 어깨와 팔 사이에 배경이 끼어든 것처럼 보인다 — 「어깨랑 팔 사이에 공간 생겨」로
  // 신고받은 것이 이것이다.
  //
  // ⚠️ **「어깨 홈」으로는 못 잡는다.** 그건 «위쪽 실루엣이 다시 솟는가»를 보는데,
  // 이 틈은 실루엣이 끊긴 것이 아니라 **가로로 벌어진 것**이라 0px 로 통과했다.
  // 어깨선을 눕히면서 위쪽이 안으로 4px 들어와 7 → 11.2px 이 됐다.
  const SH_HAIR_GAP_MAX = 8.5;         // px. 지금 6.8 · 어깨를 눕혔을 때 9.8
  const shHair = await page.evaluate(async (max) => {
    const D = window.GameData, S = 4, W = 200 * S, H = 348 * S;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none', shoes: 'shoes_none' };
    const svg = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, null);
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const on = (x, y) => d[(Math.round(y * S) * W + Math.round(x * S)) * 4 + 3] > 128;
    let worst = 0, at = 0;
    // ⚠️ **108.5 부터 잰다.** 몸통은 108 에서 시작해서, 그보다 위는 «목과 머리카락»
    // 사이라 어깨와 상관이 없다 (107 에서 재면 늘 14px 이 나온다)
    for (let y = 108.5; y <= 116; y += 0.5) {
      // 중심선에서 오른쪽으로 훑어 «살 → 빈 곳 → 다시 살» 의 빈 곳 폭을 잰다
      let end = null;
      for (let x = 100; x <= 150; x += 0.25) {
        if (on(x, y)) { if (end != null) { const g = x - end;
          if (g > worst) { worst = g; at = y; } break; } }
        else if (end == null && x > 100) end = x;
      }
    }
    return { gap: +worst.toFixed(1), at: at,
      bad: worst > max ? [`목 옆(y≈${at})에서 어깨와 머리카락 사이가 ${worst.toFixed(1)}px 벌어졌다`
        + ` (${max}px 까지) — 어깨와 팔 사이에 배경이 끼어든 것처럼 보인다`] : [] };
  }, SH_HAIR_GAP_MAX);

  const SLIDER_SPAN_MIN = 8, SLIDER_STEP_MIN = 1;
  const SLIDER = [['엉덩이', 'hip', [0.2, 0.5, 0.8, 1, 1.25, 1.5], [190, 214], '[data-part="hip"]'],
                  ['허벅지', 'thigh', [0.5, 0.8, 1, 1.5, 2], [200, 250], '[data-part="thigh"]'],
                  ['종아리', 'calf', [0.5, 0.8, 1, 1.5, 2], [270, 300], '[data-part="calf"]']];
  const slider = await page.evaluate(async (o) => {
    const D = window.GameData, bad = [], rows = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, 348 * S); ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    function keep(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild; const only = root.cloneNode(false);
      [...root.querySelectorAll(sel)].forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    // 그 구간에서 그 부위가 **가장 바깥으로 나온 곳**.
    // ⚠️ **팔을 같이 재면 안 된다** — 팔은 y 214 까지 내려와 골반 옆에 x 140 으로 서 있어서,
    // 몸 전체를 재면 엉덩이가 무슨 짓을 해도 팔이 이겨 늘 40.0px 이 나온다
    async function widest(t, y0, y1, sel) {
      const d = await px(keep(window.Avatar.build(outfit, 0, t), sel));
      let best = 0;
      for (let y = y0; y <= y1; y += 0.5) {
        const row = Math.round(y * S);
        for (let x = 199 * S; x >= 100 * S; x--) {
          if (d[(row * W + x) * 4 + 3] > 128) { if (x / S - 100 > best) best = x / S - 100; break; }
        }
      }
      return best;
    }
    for (const [name, key, ks, span, sel] of o.parts) {
      const ws = [];
      for (const k of ks) ws.push(await widest({ [key]: k }, span[0], span[1], sel));
      rows.push(`${name} ${ws.map(v => v.toFixed(1)).join('→')}`);
      for (let i = 1; i < ws.length; i++) {
        if (ws[i] - ws[i - 1] < o.step) {
          bad.push(`${name}: ${ks[i - 1] * 100}% → ${ks[i] * 100}% 에서 폭이`
            + ` ${ws[i - 1].toFixed(1)} → ${ws[i].toFixed(1)}px 밖에 안 변한다`
            + ` (${o.step}px 이상) — 슬라이더를 움직여도 몸이 안 변한다`);
        }
      }
      const total = ws[ws.length - 1] - ws[0];
      if (total < o.span) {
        bad.push(`${name}: ${ks[0] * 100}%~${ks[ks.length - 1] * 100}% 를 다 밀어도`
          + ` 폭이 ${total.toFixed(1)}px 밖에 안 변한다 (${o.span}px 이상)`);
      }
    }
    return { bad: bad, rows: rows };
  }, { parts: SLIDER, span: SLIDER_SPAN_MIN, step: SLIDER_STEP_MIN });

  // ─── 다리 옆선이 어디서도 너무 가파르지 않은가 · 무릎은 살을 따라가는가 ──
  //
  // 무릎을 **아예 고정**해 두었더니 허벅지 200% 에서 42 → 17 로 좁아져 깔때기가 됐고,
  // 종아리까지 200% 면 그 아래가 다시 38 로 부풀어 **무릎만 잘록한 모래시계**가 됐다.
  // 게다가 장딴지가 가장 굵은 자리가 붙박이라 무릎에서 14px 안에 19px 이 불어나
  // **바깥으로 뾰족한 마름모**가 됐다.
  //
  // 두 가지를 같이 본다:
  //   ① 옆선의 기울기(|dx/dy|)가 어디서도 한계를 안 넘는다 — 뾰족한 자리는 기울기가 튄다
  //   ② 허벅지·종아리를 같이 굵게 하면 **무릎도 굵어진다** (발목은 아니다 — 「발목」이 지킨다)
  //   ③ 굵어지는 «비율»이 허벅지와 같다 — ② 만으로는 못 잡는다
  //
  // ⚠️ ③ 이 필요한 이유: ② 는 「몇 px 굵어졌나」만 보는데, 허벅지가 1.5배가 되는 동안
  // 무릎이 1.2배만 되어도 그 문턱은 넘는다. 실제로 무릎 바닥을 통째로 없애 봤더니
  // **4.25px 굵어져서 통과**했다 — 그런데 그림은 허벅지가 무릎으로 쏟아지는 깔때기였다.
  // 그래서 «비율»을 본다: 허벅지 윗머리 대비 무릎의 몫이 기본 그림과 같아야 한다.
  // (허벅지만 굵게 한 경우는 뺀다 — 그때는 무릎이 **장딴지에 막히는 것이 맞다**)
  const LEG_SLOPE_MAX = 2, KNEE_GROW_MIN = 3, KNEE_RATIO_TOL = 0.04;
  const legLine = await page.evaluate(async (o) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    function legsOnly(svg) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild; const only = root.cloneNode(false);
      [...root.querySelectorAll('[data-part="thigh"],[data-part="calf"]')]
        .forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, 348 * S); ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    const edge = (d, y) => {
      for (let x = 199 * S; x >= 100 * S; x--)
        if (d[(Math.round(y * S) * W + x) * 4 + 3] > 128) return x / S;
      return null;
    };
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    const knees = {}, tops = {};
    let worst = 0, at = '', n = 0;
    for (const kt of [0.5, 1, 1.5, 2]) for (const kc of [0.5, 1, 1.5, 2]) {
      const d = await px(legsOnly(window.Avatar.build(outfit, 0, { thigh: kt, calf: kc })));
      knees[kt + 'x' + kc] = edge(d, 263);            // LEG.kneeY
      tops[kt + 'x' + kc] = edge(d, 190);             // 허벅지 윗머리 (LEG.hipY=186 바로 아래)
      const ys = [], e = [];
      for (let y = 200; y <= 326; y++) { ys.push(y); e.push(edge(d, y)); }
      let sl = 0, sy = 0;
      for (let i = 3; i < ys.length - 3; i++) {
        if (e[i - 3] == null || e[i + 3] == null) continue;
        const v = Math.abs(e[i + 3] - e[i - 3]) / 6;   // 6px 창의 기울기
        if (v > sl) { sl = v; sy = ys[i]; }
      }
      n++;
      if (sl > worst) { worst = sl; at = `허벅지${kt * 100} 종아리${kc * 100} (y≈${sy})`; }
      if (sl > o.slope) {
        bad.push(`허벅지 ${kt * 100}% · 종아리 ${kc * 100}%: 다리 옆선이 y≈${sy} 에서 `
          + `${sl.toFixed(2)} 로 선다 — 그 자리가 뾰족해 보인다 (${o.slope} 까지)`);
      }
    }
    // ② 살이 붙으면 무릎도 굵어진다
    const grow = knees['2x2'] - knees['1x1'];
    if (!(grow >= o.knee)) {
      bad.push(`허벅지·종아리를 200% 로 해도 무릎이 ${grow.toFixed(2)}px 밖에 안 굵어졌다`
        + ` (${o.knee}px 이상) — 무릎만 잘록한 모래시계가 된다`);
    }
    // ③ 굵어지는 **비율**도 허벅지를 따라간다 (허벅지 윗머리 대비 무릎의 몫)
    const share = k => {
      const t = tops[k + 'x' + k], n2 = knees[k + 'x' + k];
      return (t == null || n2 == null) ? null : (n2 - 100) / (t - 100);
    };
    const base = share(1);
    const shares = {};
    [0.5, 1.5, 2].forEach(k => {
      const s = share(k);
      shares[k] = s == null ? null : +s.toFixed(3);
      if (s != null && base != null && Math.abs(s - base) > o.ratio) {
        bad.push(`허벅지·종아리 ${k * 100}%: 무릎이 허벅지 윗머리의 ${(s * 100).toFixed(1)}% 다`
          + ` — 기본은 ${(base * 100).toFixed(1)}% (±${o.ratio * 100}%p). 허벅지가 무릎으로`
          + ` 쏟아지는 깔때기가 된다`);
      }
    });
    return { bad: bad, n: n, worst: +worst.toFixed(2), at: at, grow: +grow.toFixed(2),
             base: base == null ? null : +base.toFixed(3), shares: shares };
  }, { slope: LEG_SLOPE_MAX, knee: KNEE_GROW_MIN, ratio: KNEE_RATIO_TOL });

  // ─── 허벅지 윗머리가 엉덩이 밖으로 나오지 않는가 ────────────
  //
  // 허벅지의 맨 위(LEG.hipY=186)는 엉덩이의 봉우리(BODY.hipY=198)보다 **12px 위**다.
  // 반폭을 허벅지와 같게 맞춰 놔도 그 높이의 옆선은 아직 허리에서 내려오는 중이라 좁아서,
  // **허벅지의 둥근 윗머리가 엉덩이 밖으로 혹처럼 튀어나왔다** (허벅지 200% 에서 4px).
  //
  // 재는 법: 엉덩이(+몸통)만 그린 것과 허벅지만 그린 것을 따로 뽑아, **엉덩이가
  // 실루엣을 맡는 구간**(허벅지 윗머리 ~ 엉덩이 봉우리)에서 오른쪽 옆선을 견준다.
  // 그 아래(봉우리~붙는 높이)는 **일부러** 엉덩이가 허벅지 안쪽으로 물러나는 자리라 뺀다.
  const HIP_BULGE_MAX = 0.3;           // px. 래스터 눈금이 0.25 다
  const hipBulge = await page.evaluate(async (MAX) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    function keep(svg, sel) {
      const wrap = document.createElement('div'); wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const only = root.cloneNode(false);
      [...root.querySelectorAll(sel)].forEach(n => only.appendChild(n.cloneNode(true)));
      return only.outerHTML;
    }
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.clearRect(0, 0, W, 348 * S); ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    const edge = (d, y) => {
      for (let x = 199 * S; x >= 100 * S; x--)
        if (d[(Math.round(y * S) * W + x) * 4 + 3] > 128) return x / S;
      return null;
    };
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    let worst = 0, at = '', n = 0;
    for (const kt of [0.5, 1, 1.5, 2]) for (const kh of [0.5, 1, 1.5, 2]) for (const kw of [0.5, 1, 2]) {
      const t = { thigh: kt, hip: kh, waist: kw };
      const svg = window.Avatar.build(outfit, 0, t);
      const dh = await px(keep(svg, '[data-part="hip"],[data-part="torso"]'));
      const dt = await px(keep(svg, '[data-part="thigh"]'));
      let over = 0, oy = 0;
      for (let y = 184; y <= 198; y += 0.5) {          // LEG.hipY−2 ~ BODY.hipY
        const a = edge(dt, y), h = edge(dh, y);
        if (a == null || h == null) continue;
        if (a - h > over) { over = a - h; oy = y; }
      }
      n++;
      if (over > worst) { worst = over; at = `허벅지${kt * 100} 엉덩이${kh * 100} 허리${kw * 100} (y≈${oy})`; }
      if (over > MAX) {
        bad.push(`허벅지 ${kt * 100}% · 엉덩이 ${kh * 100}% · 허리 ${kw * 100}%: `
          + `허벅지 윗머리가 엉덩이 밖으로 ${over.toFixed(2)}px 나왔다 (y≈${oy})`);
      }
    }
    return { bad: bad, n: n, worst: +worst.toFixed(2), at: at };
  }, HIP_BULGE_MAX);

  // ─── 다리 안쪽 변도 곡선인가 ────────────────────────────────
  //
  // 바깥 변은 마디마다 곡선인데 **안쪽 변만 자로 그은 세로선**이었다 —
  // 허리 아래부터 발목까지 145px 이 폭 하나 없이 내려와 칼로 벤 틈처럼 보였다.
  // 지금은 `avatar.js` 의 `INNER` 를 지난다: 엉덩이 밑에서 거의 붙었다가 허벅지
  // 가운데에서 벌어지고, 무릎에서 모였다가 장딴지에서 다시 좁아지고 발목에서 벌어진다.
  //
  // 세 가지를 같이 본다 — **곧은 선으로 돌아가는 것**과 **꺾이는 것**이 서로 반대라
  // 하나만 재면 다른 하나를 못 잡는다:
  //   ① 꺾이지 않는다      이차 차분 ≤ 0.5px (래스터 눈금이 0.25px)
  //   ② 곧은 선이 아니다   맨 위와 맨 아래의 틈 차이 ≥ 2px (예전에는 0 이었다)
  //   ③ 배율을 안 탄다     허벅지·종아리를 움직여도 안쪽 변이 그대로다
  const INNER_KINK_MAX = 0.5, INNER_CURVE_MIN = 2;
  const legInner = await page.evaluate(async (o) => {
    const D = window.GameData, bad = [], S = 4, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    // 다리만 남긴다 — 엉덩이가 위쪽을 덮어 안쪽 변의 시작을 가린다
    function legsOnly(svg) {
      const wrap = document.createElement('div');
      wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const legs = [...root.querySelectorAll('[data-part="thigh"],[data-part="calf"]')];
      const only = root.cloneNode(false);
      legs.forEach(g => only.appendChild(g.cloneNode(true)));
      return only.outerHTML;
    }
    const bare = { top: 'top_none', bottom: 'bot_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    const outfit = Object.assign({}, D.DEFAULT_OUTFIT, bare);
    // 오른다리 안쪽 변을 y 마다 (가운데에서 바깥으로 나가며 첫 살)
    async function edges(t) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,'
          + encodeURIComponent(legsOnly(window.Avatar.build(outfit, 0, t)));
      });
      ctx.clearRect(0, 0, W, 348 * S);
      ctx.drawImage(img, 0, 0, W, 348 * S);
      const d = ctx.getImageData(0, 0, W, 348 * S).data;
      const out = [];
      for (let y = 216; y <= 330; y++) {
        const row = Math.round(y * S);
        let x = 100 * S;
        while (x < 140 * S && d[(row * W + x) * 4 + 3] <= 128) x++;
        out.push(x / S - 100);
      }
      return out;
    }
    const base = await edges(null);
    // ① 꺾이지 않는가
    let kink = 0, at = 0;
    for (let i = 1; i < base.length - 1; i++) {
      const c = Math.abs(base[i - 1] - 2 * base[i] + base[i + 1]);
      if (c > kink) { kink = c; at = 216 + i; }
    }
    if (kink > o.kink) bad.push(`다리 안쪽 변이 y=${at} 에서 ${kink.toFixed(2)}px 꺾인다`);
    // ② 곧은 선이 아닌가 (엉덩이 밑 ↔ 발목의 틈 차이)
    const curve = (base[base.length - 1] - base[0]) * 2;
    if (curve < o.curve) {
      bad.push(`다리 안쪽 변이 거의 곧은 선이다 — 엉덩이 밑과 발목의 틈 차이가`
        + ` ${curve.toFixed(2)}px 뿐이다 (${o.curve}px 이상이어야 한다)`);
    }
    // ③ 배율을 타지 않는가
    let drift = 0, dat = 0, dk = 1;
    for (const k of [0.5, 0.75, 1.5, 2]) {
      for (const key of ['thigh', 'calf']) {
        const e = await edges({ [key]: k });
        for (let i = 0; i < base.length; i++) {
          if (Math.abs(e[i] - base[i]) > drift) { drift = Math.abs(e[i] - base[i]); dat = 216 + i; dk = k; }
        }
      }
    }
    if (drift > 0.26) {
      bad.push(`배율 ${dk * 100}% 에서 다리 안쪽 변이 y=${dat} 에서 ${drift.toFixed(2)}px 움직였다`
        + ` — 살을 빼도 다리 사이는 그대로여야 한다`);
    }
    return { bad, kink: +kink.toFixed(2), curve: +curve.toFixed(2), drift: +drift.toFixed(2) };
  }, { kink: INNER_KINK_MAX, curve: INNER_CURVE_MIN });

  // ─── 엉덩이가 하의 밖으로 나오지 않는가 ─────────────────────
  //
  // 커버리지 검사(맨 위)는 **허리까지만** 본다. 허리 아래는 하의가 맡는데 거기를
  // 아무도 안 보고 있었다 — 엉덩이 배율을 키우면 반바지 옆으로 엉덩이가 삐져나오는데
  // 모든 검사가 통과였다.
  //
  // 재는 법: **엉덩이만 남긴 그림**에서 그 픽셀을 찍어 두고, 하의를 입힌 그림에서
  // 그 자리가 아직 살색인지 본다. 팔은 하의 위에 다시 찍히므로 빼고 잰다.
  const HIP_OUT_MAX = 0.02;
  const hipOut = await page.evaluate(async (MAX) => {
    const D = window.GameData, SKIN = [255, 220, 196], bad = [], S = 2, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.clearRect(0, 0, W, 348 * S);
      ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    const isSkin = (d, i) => d[i + 3] > 250 && Math.abs(d[i] - SKIN[0]) <= 2
      && Math.abs(d[i + 1] - SKIN[1]) <= 2 && Math.abs(d[i + 2] - SKIN[2]) <= 2;
    const bare = { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    function build(t, o, only) {
      const wrap = document.createElement('div');
      wrap.innerHTML = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare, o || {}), 0, t);
      const root = wrap.firstElementChild;
      root.querySelectorAll('[data-part="arm"]').forEach(e => e.remove());
      if (only) {
        const keep = root.querySelector(only).closest('svg > g');
        [...root.children].forEach(c => { if (c.tagName !== 'defs' && c !== keep) c.remove(); });
        [...keep.children].forEach(g => { if (!g.matches(only)) g.remove(); });
      }
      return root.outerHTML;
    }
    const tunes = [['기본', {}], ['엉덩이 150', { hip: 1.5 }], ['허리 50 엉덩이 150', { waist: 0.5, hip: 1.5 }],
      ['엉덩이 180', { hip: 1.8 }], ['허벅지 180', { thigh: 1.8 }], ['엉덩이 180 허벅지 60', { hip: 1.8, thigh: 0.6 }],
      // 엉덩이가 좁으면 허벅지 윗머리도 같이 들어온다 — 하의가 그 좁아진 몸을
      // 그대로 따라오는지 본다 (하의도 `clothHipHalf` 로 같은 값을 읽는다)
      ['엉덩이 20', { hip: 0.2 }], ['엉덩이 20 허벅지 200', { hip: 0.2, thigh: 2 }]];
    const bots = (D.WARDROBE.bottom || []).filter(x => x.kind !== 'none');
    let worst = 0, maskN = 0;
    for (const [tn, t] of tunes) {
      const hip = await px(build(t, null, '[data-part="hip"]'));
      const mask = [];
      for (let y = 168 * S; y <= 248 * S; y++) for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4;
        if (!isSkin(hip, i)) continue;
        // 경계의 반투명 픽셀은 뺀다
        if (!isSkin(hip, i - 4) || !isSkin(hip, i + 4) || !isSkin(hip, i - W * 4) || !isSkin(hip, i + W * 4)) continue;
        mask.push(i);
      }
      maskN = mask.length;
      for (const bo of bots) {
        const d = await px(build(t, { bottom: bo.id }));
        let n = 0;
        for (const i of mask) if (isSkin(d, i)) n++;
        const r = n / mask.length;
        if (r > worst) worst = r;
        if (r > MAX) bad.push(`${tn} · ${bo.id}: 엉덩이의 ${Math.round(r * 100)}% 가 하의 밖으로 나왔다`);
      }
    }
    return { bad, worst: +(worst * 100).toFixed(1), maskN, n: tunes.length * bots.length };
  }, HIP_OUT_MAX);

  // ─── 가랑이 홈에 살이 보이는가 (바지·반바지) ────────────────
  //
  // **가랑이 V 를 구멍으로 파면 안 된다.** 예전에는 폭 14(x 93~107) 고정 V 였는데
  // 그 높이의 실제 다리 틈은 5 밖에 안 된다 — 그래서 홈 안으로 **허벅지 안쪽 살이
  // 그대로 드러났다.** 반바지 색(#ffc2a8)이 살색과 가까워 사람 눈에는
  // 「바지가 갈라진 것」이 아니라 **「맨살이 보이는 것」**으로 읽혔다 (신고받았다).
  //
  // 지금은 홈이 `innerX`(다리 사이 틈)를 따라가고, 갈라진 느낌은 어두운 천으로 그린다.
  // 재는 법: **밑단 위쪽 가운데 창**에 살색이 있으면 안 된다.
  // 그 창 안은 위에서 아래까지 전부 옷이거나(다리를 덮었으므로) 홈 뒤의 배경이다
  //
  // ⚠️ **이 검사를 사보타주할 때는 홈과 그늘을 같이 되돌려야 한다.**
  // 홈만 예전의 고정 V 로 돌리면 그늘 삼각형이 그 위에 덮여 **반바지는 0건으로 나온다** —
  // 정작 신고받은 옷이 통과로 보인다. 둘 다 되돌리면 반바지 198 · 청바지 1179 ·
  // 카프리 1036 픽셀로 잡힌다 (실제로 이 순서로 두 번 재 봤다)
  const CROTCH_SKIN_MAX = 8;      // 2배 확대라 경계 한두 줄은 남는다
  const crotch = await page.evaluate(async (MAX) => {
    const D = window.GameData, SKIN = [255, 220, 196], bad = [], S = 2, W = 200 * S, H = 348 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const isSkin = (d, i) => d[i + 3] > 250 && Math.abs(d[i] - SKIN[0]) <= 2
      && Math.abs(d[i + 1] - SKIN[1]) <= 2 && Math.abs(d[i + 2] - SKIN[2]) <= 2;
    const bare = { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    async function px(t, o) {
      const wrap = document.createElement('div');
      wrap.innerHTML = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare, o), 0, t);
      const root = wrap.firstElementChild;
      root.querySelectorAll('[data-part="arm"]').forEach(e => e.remove());
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(root.outerHTML);
      });
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data;
    }
    // **바지 계열만** 본다 — 치마는 홈이 없다 (있으면 그게 버그다)
    const bots = (D.WARDROBE.bottom || []).filter(x => x.kind === 'shorts' || x.kind === 'pants');
    // 허벅지를 키우면 홈이 더 벌어지는지도 같이 본다 (배율은 틈에 안 태우기로 했지만,
    // 그 약속이 깨지면 여기서 먼저 드러난다)
    const tunes = [['기본', {}], ['허벅지 200', { thigh: 2 }], ['허벅지 20', { thigh: 0.2 }],
      ['엉덩이 180', { hip: 1.8 }], ['엉덩이 20 허벅지 200', { hip: 0.2, thigh: 2 }]];
    let worst = 0, worstAt = '';
    for (const [tn, t] of tunes) {
      for (const bo of bots) {
        const d = await px(t, { bottom: bo.id });
        const hem = Number(bo.hemY) || 332;
        let n = 0;
        for (let y = 218 * S; y <= (hem - 4) * S; y++) {
          for (let x = (100 - 9) * S; x <= (100 + 9) * S; x++) {
            if (isSkin(d, (y * W + x) * 4)) n++;
          }
        }
        if (n > worst) { worst = n; worstAt = `${tn} · ${bo.id}`; }
        if (n > MAX) bad.push(`${tn} · ${bo.id}: 가랑이 홈에 살색 ${n}픽셀 (${MAX}까지)`);
      }
    }
    return { bad, worst, worstAt, n: tunes.length * bots.length };
  }, CROTCH_SKIN_MAX);

  // ─── 엉덩이와 허벅지 사이에 세로 틈이 없는가 ────────────────
  //
  // 엉덩이의 아래 자락은 허벅지 옆에 세로로 붙는다. 그런데 **허벅지는 아래로
  // 가늘어지므로**, 자락의 안쪽 변을 「허벅지의 가장 굵은 곳」으로 잡으면
  // 붙는 높이에서는 허벅지가 이미 그보다 안쪽이라 **그 사이로 배경이 비친다**
  // (기본 1.6px · 엉덩이 150% 에서 3.8px · 위에서 아래로 갈수록 벌어졌다).
  //
  // 재는 법: 오른쪽 다리 쪽을 가로로 훑어 **살 → 배경 → 살** 이 나오면 그게 틈이다.
  const SEAM_GAP_MAX = 0.5;
  const hipSeam = await page.evaluate(async (MAX) => {
    const D = window.GameData, bad = [], S = 8, W = 200 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    const bare = { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none',
                   shoes: 'shoes_none', hair: 'hair_none' };
    let worst = 0;
    const combos = [['기본', {}], ['엉덩이 150', { hip: 1.5 }], ['엉덩이 180', { hip: 1.8 }],
      ['허리 50 엉덩이 150', { waist: 0.5, hip: 1.5 }], ['허벅지 60', { thigh: 0.6 }],
      ['허벅지 180', { thigh: 1.8 }], ['엉덩이 180 허벅지 60', { hip: 1.8, thigh: 0.6 }],
      ['엉덩이 20', { hip: 0.2 }], ['엉덩이 20 허벅지 200', { hip: 0.2, thigh: 2 }]];
    for (const [n, t] of combos) {
      const wrap = document.createElement('div');
      wrap.innerHTML = window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), 0, t);
      const root = wrap.firstElementChild;
      root.querySelectorAll('[data-part="arm"]').forEach(e => e.remove());
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(root.outerHTML);
      });
      ctx.clearRect(0, 0, W, 348 * S);
      ctx.drawImage(img, 0, 0, W, 348 * S);
      const d = ctx.getImageData(0, 0, W, 348 * S).data;
      let gap = 0, at = 0;
      for (let y = 200; y <= 258; y++) {
        const row = Math.round(y * S);
        const runs = []; let on = false, st = 0;
        for (let x = 100 * S; x <= 170 * S; x++) {
          const v = d[(row * W + x) * 4 + 3] > 128;
          if (v && !on) { on = true; st = x; } else if (!v && on) { on = false; runs.push([st / S, x / S]); }
        }
        if (on) runs.push([st / S, 170]);
        for (let i = 1; i < runs.length; i++) {
          const g = runs[i][0] - runs[i - 1][1];
          if (g > gap) { gap = g; at = y; }
        }
      }
      if (gap > worst) worst = gap;
      if (gap > MAX) bad.push(`${n}: 엉덩이와 허벅지 사이가 y≈${at} 에서 ${gap.toFixed(1)}px 벌어졌다`);
    }
    return { bad, worst: +worst.toFixed(2), n: combos.length };
  }, SEAM_GAP_MAX);

  // ─── 치마가 팔을 덮지 않는가 ────────────────────────────────
  //
  // 팔은 몸통과 같은 층에 있어 **하의보다 뒤**였다. 치마는 허리에서 아래로 퍼지므로
  // 그 자리에 있던 팔뚝과 손이 통째로 치마에 덮였다 — 긴 치마에서는 팔이 소매 끝
  // 언저리에서 뚝 끊겨 겨드랑이에 살색 조각만 남았다.
  // (「치마가 팔을 덮는다」와 「겨드랑이에 살색이 튀어나온다」가 같은 원인이었다)
  //
  // 재는 법: **팔만 남긴 그림**에서 허리 아래 팔 픽셀을 찍어 두고(맨몸 전체를 쓰면
  // 몸통·다리까지 들어가는데 그것은 옷이 덮는 게 맞다), 옷을 입힌 그림에서 그 자리가
  // 그대로 살색인지 본다. 소매가 허리 위에서 끝나는 옷(민소매·캡·반팔)만 본다 —
  // 긴 소매는 그 자리가 옷 색이라 살색으로 판정할 수 없다.
  const ARM_COVER_MAX = 0.05;        // 팔 픽셀의 5% 까지 (경계의 반투명 픽셀 몫)
  const armCover = await page.evaluate(async (MAX) => {
    const D = window.GameData, SKIN = [255, 220, 196], bad = [], S = 2;
    const cv = document.createElement('canvas');
    cv.width = 200 * S; cv.height = 348 * S;
    const ctx = cv.getContext('2d');
    const W = 200 * S;
    async function px(svg) {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.clearRect(0, 0, W, 348 * S);
      ctx.drawImage(img, 0, 0, W, 348 * S);
      return ctx.getImageData(0, 0, W, 348 * S).data;
    }
    const isSkin = (d, i) => d[i + 3] > 250 && Math.abs(d[i] - SKIN[0]) <= 2
      && Math.abs(d[i + 1] - SKIN[1]) <= 2 && Math.abs(d[i + 2] - SKIN[2]) <= 2;
    function armOnly(svg) {
      const wrap = document.createElement('div');
      wrap.innerHTML = svg;
      const root = wrap.firstElementChild;
      const keep = root.querySelector('[data-part="arm"]').closest('svg > g');
      [...root.children].forEach(c => { if (c.tagName !== 'defs' && c !== keep) c.remove(); });
      [...keep.children].forEach(g => { if (!g.matches('[data-part="arm"]')) g.remove(); });
      return root.outerHTML;
    }
    const bare = { top: 'top_none', bottom: 'bottom_none', dress: 'dress_none', shoes: 'shoes_none' };
    const w = 0.3;
    const Y0 = 170 * S, Y1 = 208 * S;      // 허리(164) 아래 ~ 손목(214) 위
    const A = await px(armOnly(window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare), w, null)));
    // 가장자리의 반투명 픽셀은 뺀다 — 뒤에 오는 색이 달라지면 값이 흔들린다
    const mask = [];
    for (let y = Y0; y < Y1; y++) for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (!isSkin(A, i)) continue;
      if (!isSkin(A, i - 4) || !isSkin(A, i + 4) || !isSkin(A, i - W * 4) || !isSkin(A, i + W * 4)) continue;
      mask.push(i);
    }
    const shortSleeve = it => ['none', 'cap', 'short'].indexOf(it.sleeve) >= 0;
    const cases = [];
    (D.WARDROBE.top || []).filter(shortSleeve).forEach(t =>
      (D.WARDROBE.bottom || []).filter(x => x.kind !== 'none').forEach(bo =>
        cases.push({ n: t.id + ' + ' + bo.id, o: { top: t.id, bottom: bo.id, dress: 'dress_none' } })));
    // 공주 드레스는 어깨에서 바닥까지 내려오는 종이고 팔은 그 안에 있다 — 일부러 뺀다
    (D.WARDROBE.dress || []).filter(x => x.kind !== 'none' && x.kind !== 'princess' && shortSleeve(x))
      .forEach(dr => cases.push({ n: dr.id, o: { top: 'top_none', bottom: 'bottom_none', dress: dr.id } }));
    let worst = 0;
    for (const c of cases) {
      const d = await px(window.Avatar.build(Object.assign({}, D.DEFAULT_OUTFIT, bare, c.o), w, null));
      let n = 0;
      for (const i of mask) if (!isSkin(d, i)) n++;
      const r = n / mask.length;
      if (r > worst) worst = r;
      if (r > MAX) bad.push(`${c.n}: 허리 아래 팔의 ${Math.round(r * 100)}% 가 옷에 덮였다`);
    }
    return { bad, cases: cases.length, arm: mask.length, worst: +(worst * 100).toFixed(1) };
  }, ARM_COVER_MAX);

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

  // ─── 방에 둔 크리처가 치마와 겹치지 않는가 ──────────────────
  //
  // 크리처는 아바타보다 앞 층(z-index 3)이라 치마 위에 올라앉는다. 그러면
  // 「방에 있는 짐승」이 아니라 「치마에 붙은 무늬」로 읽힌다.
  // **어항은 더 나쁘다** — 속이 비치는 유리통이라 치마가 통 안으로 들여다보인다.
  // `left: 6%` 로 두었을 때 롱스커트와 땅·공중 27px · 어항 47px 겹쳤다.
  //
  // ⚠️ **화면 폭마다 재야 한다.** 크리처는 좁은 화면에서 줄고(`--pet`), 아우라도
  // 240px 밑으로 줄어든다(flex). 한 폭에서만 재면 다른 폭에서 벌어지는 것을 못 잡는다.
  // 나가는 쪽도 같이 본다 — 오른끝을 붙박아 두면 **왼쪽이 화면 밖으로 나간다.**
  //
  // ⚠️ 이 검사는 **맨 마지막**이다. 진짜 방 화면을 띄우느라 S(세이브)와 창 크기를
  // 건드리므로, 앞선 검사가 그 영향을 받지 않게 뒤로 뺐다.
  const PET_GAP_MIN = 1;               // px. 치마 옆선과 이만큼은 떨어져 있어야 한다
  const petPlace = { bad: [], rows: [] };
  for (const vw of [265, 320, 375, 390, 480, 700]) {
    await page.setViewportSize({ width: vw, height: 820 });
    const r = await page.evaluate(() => {
      const D = window.GameData;
      // 땅·공중·물 한 마리씩 — 셋은 크기와 높이가 달라 같이 봐야 한다
      const pick = m => (D.RECIPES.find(x => x.result.kind === 'creature' && x.result.move === m) || {}).result;
      const pets = ['ground', 'air', 'water'].map(pick).filter(Boolean);
      if (pets.length < 3) return { err: '땅·공중·물 크리처가 다 있지 않다' };
      S.tutorialDone = true; S.introDone = true;
      if (!Array.isArray(S.creatures)) S.creatures = [];
      pets.forEach(p => { if (!S.creatures.includes(p.id)) S.creatures.push(p.id); });
      const sp = document.getElementById('splash'); if (sp) sp.classList.add('done');
      const iv = document.getElementById('intro'); if (iv) iv.style.display = 'none';
      switchTab('showcase');
      const app = document.querySelector('.app');
      const wear = (D.WARDROBE.bottom || []).filter(i => i.kind !== 'none').map(i => ['bottom', i])
        .concat((D.WARDROBE.dress || []).filter(i => i.kind !== 'none').map(i => ['dress', i]));
      const worst = { over: -Infinity, outL: -Infinity };
      for (const pet of pets) {
        S.petRoom = pet.id;
        for (const [slot, it] of wear) {
          S.outfit.bottom = 'bottom_none'; S.outfit.dress = 'dress_none';
          S.outfit[slot] = it.id;
          renderShowcase();
          const cre = document.querySelector('.stage-creature');
          const svg = document.querySelector('.char-body svg');
          if (!cre || !svg || !app) return { err: '크리처나 아바타가 안 그려졌다' };
          const cr = cre.getBoundingClientRect(), sr = svg.getBoundingClientRect();
          const vb = svg.viewBox.baseVal, k = sr.width / vb.width;
          // 크리처 높이와 겹치는 그림 조각들의 **가장 왼쪽** (넉넉하게 — bbox 로 잡는다)
          let left = Infinity;
          svg.querySelectorAll('path,ellipse,circle,rect').forEach(n => {
            let bb; try { bb = n.getBBox(); } catch (e) { return; }
            if (!bb.width) return;
            if (sr.top + (bb.y + bb.height) * k < cr.top || sr.top + bb.y * k > cr.bottom) return;
            left = Math.min(left, sr.left + bb.x * k);
          });
          const over = cr.right - left;                             // + 면 겹쳤다
          const outL = app.getBoundingClientRect().left - cr.left;  // + 면 화면 밖으로 나갔다
          if (over > worst.over) Object.assign(worst, { over, name: it.name, move: pet.move });
          if (outL > worst.outL) Object.assign(worst, { outL, outMove: pet.move });
        }
      }
      return worst;
    });
    if (r.err) { petPlace.bad.push(`폭 ${vw}px: ${r.err}`); continue; }
    petPlace.rows.push(`${vw}:${(-r.over).toFixed(1)}px`);
    if (r.over > -PET_GAP_MIN) {
      petPlace.bad.push(`폭 ${vw}px · ${r.move} · ${r.name}: 크리처가 치마와 ${r.over.toFixed(1)}px 겹친다`
        + ` — 방에 있는 것이 아니라 치마에 붙은 무늬로 보인다`);
    }
    if (r.outL > 0.5) {
      petPlace.bad.push(`폭 ${vw}px · ${r.outMove}: 크리처가 화면 왼쪽으로 ${r.outL.toFixed(1)}px 나갔다`
        + ` — 좁은 화면에서는 크기도 같이 줄어야 한다 (--pet)`);
    }
  }
  await page.setViewportSize({ width: 1200, height: 900 });

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
    .concat(face.bad.map(m => ({ id: '초상화', body: '-', where: m, n: '-' })))
    .concat(crouch.bad.map(m => ({ id: '웅크린 뒷모습', body: '-', where: m, n: '-' })))
    .concat(bowl.bad.map(m => ({ id: '어항', body: '-', where: m, n: '-' })))
    .concat(petPlace.bad.map(m => ({ id: '크리처 자리', body: '-', where: m, n: '-' })))
    .concat(neck.bad.map(m => ({ id: '목', body: '-', where: m, n: '-' })))
    .concat(seam.bad.map(m => ({ id: '몸통↔팔', body: '-', where: m, n: '-' })))
    .concat(shoulder.bad.map(m => ({ id: '어깨 홈', body: '-', where: m, n: '-' })))
    .concat(shoulder.beakBad.map(m => ({ id: '어깨 부리', body: '-', where: m, n: '-' })))
    .concat(shoulder.capH >= shoulder.capW * CAP_MIN ? []
      : [{ id: '어깨 마개', body: '-', n: '-',
           where: `팔 위 끝에서 제 폭까지 ${shoulder.capH}px 밖에 안 된다`
             + ` (폭 ${shoulder.capW}px 의 ${CAP_MIN}배 이상) — 반원 마개라 어깨가 팔과 직각으로 보인다` }])
    .concat(elbow.bad.map(m => ({ id: '팔꿈치 턱', body: '-', where: m, n: '-' })))
    .concat(armCover.bad.map(m => ({ id: '치마가 팔을 덮음', body: '-', where: m, n: '-' })))
    .concat(kink.bad.map(m => ({ id: '허리↔엉덩이↔허벅지', body: '-', where: m, n: '-' })))
    .concat(hipOut.bad.map(m => ({ id: '엉덩이가 하의 밖으로', body: '-', where: m, n: '-' })))
    .concat(crotch.bad.map(m => ({ id: '가랑이 홈에 살', body: '-', where: m, n: '-' })))
    .concat(legGap.bad.map(m => ({ id: '다리 사이 틈', body: '-', where: m, n: '-' })))
    .concat(legInner.bad.map(m => ({ id: '다리 안쪽 변', body: '-', where: m, n: '-' })))
    .concat(hipBulge.bad.map(m => ({ id: '허벅지 윗머리', body: '-', where: m, n: '-' })))
    .concat(legLine.bad.map(m => ({ id: '다리 옆선', body: '-', where: m, n: '-' })))
    .concat(box.bad.map(m => ({ id: '그림 상자', body: '-', where: m, n: '-' })))
    .concat(armSkirt.bad.map(m => ({ id: '팔↔하의', body: '-', where: m, n: '-' })))
    .concat(shHair.bad.map(m => ({ id: '어깨↔머리카락', body: '-', where: m, n: '-' })))
    .concat(fat.bad.map(m => ({ id: '상한 두께', body: '-', where: m, n: '-' })))
    .concat(slider.bad.map(m => ({ id: '슬라이더', body: '-', where: m, n: '-' })))
    .concat(hand.bad.map(m => ({ id: '손', body: '-', where: m, n: '-' })))
    .concat(hipSeam.bad.map(m => ({ id: '엉덩이↔허벅지 틈', body: '-', where: m, n: '-' })));
  console.log(`옷 ${res.cases}종 × 체형 ${res.steps}단계 = ${res.cases * res.steps}회`
    + ` · 상의×하의 ${res.pairs}조합`);
  console.log(`염색: ${dye.slots}칸 × 마법·영원·만료 ${dye.slots * 3}회`
    + ` · 다른 옷으로 갈아입어 확인 ${dye.others}회 · 앞머리 ${hair.kinds}종 정수리`);
  console.log(`넥라인: 파낸 자리를 몸통 윗선과 견줌 (그린 path 를 isPointInFill 로 직접 잰다)`);
  console.log(`초상화: 인물 ${face.n}명 — 머리와 얼굴 사이의 틈 · 헤어라인 높이(이마 6~18px)`);
  console.log(`웅크린 뒷모습: 옷 ${crouch.n}가지 — 무릎이 입은 옷을 따라가는가`);
  console.log(`목(몸통 배율): 50→150% 턱~어깨 ${neck.tgaps.map(g => g.gap + 'px').join(' → ')}`
    + ` (가늘수록 길어야 한다 · 50% 가 150% 보다 2px 이상)`);
  console.log(`목: 체형별 턱~어깨 ${neck.gaps.map(g => g.gap + 'px').join(' → ')}`
    + ` (날씬할수록 길어야 한다 · 가장 짧은 곳도 5px 이상)`);
  console.log(`몸통↔팔: 체형 ${seam.steps}단계 — 옆구리에 배경이 실처럼 비치지 않는가`);
  console.log(`어깨 홈: 체형별 파임 ${shoulder.worst.map(v => v + 'px').join(' · ')}`
    + ` (목→팔 실루엣이 다시 솟지 않아야 한다 · ${SHOULDER_DIP}px 까지)`);
  console.log(`어깨 부리: 몸통×팔 배율 ${shoulder.beakN}조합 — 가장 튀어나온 곳 ${shoulder.beak}px`
    + ` (어깨·목이 팔 밖으로 나오면 안 된다)`);
  console.log(`어깨 마개: 팔 위 끝에서 제 폭까지 ${shoulder.capH}px (폭 ${shoulder.capW}px)`
    + ` — 반원이면 폭의 절반이다. 그보다 완만해야 어깨가 팔과 직각으로 안 보인다`
    + ` — 폭의 ${(shoulder.capH/shoulder.capW).toFixed(2)}배 (${CAP_MIN}배 이상)`);
  console.log(`팔꿈치 턱: 팔 배율 ${elbow.n}가지 × 좌우 — 옆선이 가장 튄 곳 ${elbow.worst}px`
    + ` (${ELBOW_STEP}px 까지 · 두 마디가 굽힘까지 같이 이어져야 한다)`);
  console.log(`치마가 팔을 덮음: 옷 ${armCover.cases}조합 × 허리 아래 팔 ${armCover.arm}픽셀`
    + ` — 가장 많이 덮인 곳 ${armCover.worst}% (${ARM_COVER_MAX * 100}% 까지)`);
  console.log(`허리↔엉덩이↔허벅지: 배율 ${kink.n}조합 — 옆선이 가장 꺾인 곳 ${kink.worst}`
    + ` (${KINK_MAX} 까지 · 접선이 이어져야 한다)`);
  console.log(`엉덩이가 하의 밖으로: 배율×하의 ${hipOut.n}조합 × 엉덩이 ${hipOut.maskN}픽셀`
    + ` — 가장 많이 나온 곳 ${hipOut.worst}% (${HIP_OUT_MAX * 100}% 까지)`);
  console.log(`가랑이 홈에 살: 배율×바지 ${crotch.n}조합`
    + ` — 가장 많은 곳 ${crotch.worst}픽셀${crotch.worstAt ? ` (${crotch.worstAt})` : ''}`
    + ` (${CROTCH_SKIN_MAX}까지)`);
  console.log(`다리 사이 틈: 배율 ${legGap.n}단계 × y ${legGap.ys.join('·')}`
    + ` — 기본 ${legGap.base.join('·')}px · 흔들림 ${legGap.spread.join('·')}px`
    + ` (${GAP_SPREAD_MAX}px 까지 · 가늘어져도 벌어지면 안 된다)`);
  console.log(`손: ↓손목 밑으로 내려온 길이 · ↔바깥으로 부푼 폭 — ${hand.rows.join(' · ')}`
    + ` (${HAND_DROP_MIN}px 이상 · 부푼 폭은 ${HAND_BULGE_MIN}~${HAND_BULGE_MAX}px)`);
  console.log(`소매 윤곽선: 공주 드레스 아랫팔 높이에서 옷보다 어두운 선 ${hand.outline}줄`
    + ` (${SLEEVE_OUTLINE_MIN}줄 이상 · 소매가 몸판과 같은 색이라 선이 유일한 구분이다)`);
  console.log(`손이 팔에 붙어 있는가: 팔 마스크와 겹치는 몫 — ${hand.touch.join(' · ')}`
    + ` (${HAND_TOUCH * 100}% 이상 · 배율을 움직여도 흔들리면 안 된다)`);
  console.log(`손이 옷에 안 덮이는가: 원피스마다 **맨손 한 켤레 넓이** 대비 살색으로 남은 몫`
    + ` — ${hand.keep.join(' · ')} (${HAND_KEEP * 100}% 이상)`);
  console.log(`상한 두께: 100% 대비 ${fat.rows.join(' · ')}`
    + ` (부위마다 정해 둔 값 ±${FAT_TOL} · 100% 는 아무것도 안 바꾼다)`);
  console.log(`팔이 하의 위로 나오는가: 허리선 아래 «팔 자리»의 옷색 점 수 —`
    + ` ${armSkirt.rows.join(' · ')} (${ARM_SKIRT_MAX} 점까지 · 마개가 붙으면 227~238 점이 된다)`);
  console.log(`어깨↔머리카락: 목 옆의 틈 ${shHair.gap}px (y≈${shHair.at})`
    + ` (${SH_HAIR_GAP_MAX}px 까지 · 넓어지면 어깨와 팔 사이에 배경이 낀 것처럼 보인다)`);
  console.log(`슬라이더: 하한→상한의 반폭 ${slider.rows.join(' · ')}`
    + ` (칸마다 ${SLIDER_STEP_MIN}px · 전체 ${SLIDER_SPAN_MIN}px 이상 — 밀어도 안 변하면 안 된다)`);
  console.log(`다리 옆선: 허벅지×종아리 ${legLine.n}조합 — 가장 선 곳 ${legLine.worst}`
    + ` (${legLine.at} · ${LEG_SLOPE_MAX} 까지)`
    + ` · 둘 다 200% 일 때 무릎이 ${legLine.grow}px 굵어진다 (${KNEE_GROW_MIN}px 이상)`);
  console.log(`무릎이 허벅지를 따라가는가: 허벅지 윗머리 대비 무릎 — 기본 ${legLine.base}`
    + ` · 50% ${legLine.shares[0.5]} · 150% ${legLine.shares[1.5]} · 200% ${legLine.shares[2]}`
    + ` (±${KNEE_RATIO_TOL} · 비율이 떨어지면 허벅지가 무릎으로 쏟아지는 깔때기가 된다)`);
  console.log(`허벅지 윗머리: 허벅지×엉덩이×허리 ${hipBulge.n}조합 — 엉덩이 밖으로 가장 나온 곳`
    + ` ${hipBulge.worst}px${hipBulge.worst ? ' · ' + hipBulge.at : ''} (${HIP_BULGE_MAX}px 까지)`);
  console.log(`다리 안쪽 변: 꺾임 ${legInner.kink}px (${INNER_KINK_MAX}px 까지)`
    + ` · 엉덩이 밑↔발목 틈 차이 ${legInner.curve}px (${INNER_CURVE_MIN}px 이상 — 곧은 선이면 0)`
    + ` · 배율에 따른 흔들림 ${legInner.drift}px`);
  console.log(`엉덩이↔허벅지 틈: 배율 ${hipSeam.n}조합 — 가장 벌어진 곳 ${hipSeam.worst}px`
    + ` (${SEAM_GAP_MAX}px 까지 · 자락과 허벅지 사이로 배경이 비치면 안 된다)`);
  console.log(`그림 상자: 통통 최대 × 슬라이더 최대에서 오른쪽 끝 ${box.widest}/200`
    + ` · 여백 ${box.room}px · 잘린 줄 ${box.cut} (여백 ${BOX_MARGIN_MIN}px 이상 · 넘으면 viewBox 를 넓혀야 한다)`);
  console.log(`발목: 기본 ${legGap.ankle}px · 종아리를 굵게 해도 ${legGap.ankleMax}px`
    + ` (굵어지면 안 된다 — 굵은 종아리에 가는 발목)`);
  console.log(`크리처 자리: 땅·공중·물 × 하의·원피스 전부 — 화면 폭별 치마와의 틈`
    + ` ${petPlace.rows.join(' · ')} (${PET_GAP_MIN}px 이상 · 치마 위에 올라앉으면 안 된다)`);
  console.log(`어항: 물고기 ${bowl.n}마리 × 헤엄 양 끝 — 유리를 넘지 않는가 · 수면 위로 안 뜨는가`
    + ` (물이 아닌 ${bowl.dry}마리에는 어항이 안 붙는지도)`);
  if (!all.length) { console.log('✅ 살이 옷 밖으로 나온 곳 없음'); process.exit(0); }
  console.log(`❌ ${all.length}건`);
  all.forEach(b => console.log(b.n === '-'
    ? `   ${b.id} · ${b.where}`
    : `   ${b.id} · 체형 ${b.body} · ${b.where} 살색 ${b.n}px`));
  process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
