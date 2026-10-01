// ═══════════════════════════════════════════════════════════════
//  인트로의 배경이 «3D 로» 서고 인물이 그 바닥에 서는가 (npm run test:intro)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **이 층을 보는 검사가 하나도 없었다.** `checkroom` 은 마이 룸을 몰고 다니고,
// `checkui` 는 인트로를 아예 안 연다 — 인트로가 3D 가 된 지금 그 0건은
// 「통과」가 아니라 **「한 번도 안 쟀다」**이다.
//
// ⚠️⚠️ **세운 값을 도로 읽어 견주지 않는다.** `setDecor`·`setWindow` 에 넣은 것을
// 그대로 돌려받아 「맞다」고 하면 **스스로 맞는 검사**가 된다 (배선이 끊겨도 통과한다).
// 그래서 세트가 갈리는지는 **찍은 픽셀**로 보고, 창의 «모양»은 구워진 **텍스처 캔버스**
// 에서 직접 뜬다.
'use strict';
const { chromium } = require('playwright');
const { pngLumGrid } = require('./pnglum');
const BASE = process.env.BASE || 'http://localhost:8080';

// 발밑(인물이 서는 자리)과 3D 방의 바닥 기준이 이만큼 안에 들어와야 한다.
// ⚠️ 1.5px 은 마이 룸의 「서는 자리」가 쓰는 그 값이다 — 두 화면이 같은 약속을 지난다
const FOOT_MAX = 1.5;
// 2D 배경을 덮은 자리가 «3D 로 실제로 칠해져» 있어야 한다 — 캔버스를 껐다 켜서
// 달라지는 몫. ⚠️ 문턱은 사보타주를 돌려 보고 골랐다 (3D 를 안 세우면 0.000 이다).
// ⚠️ 공방은 어두운 방이라 0.027 밖에 안 나온다 — 성 침실(0.098) 기준으로 잡으면
//    멀쩡한 화면이 걸린다
const PAINT_MIN = Number(process.env.PAINT_MIN || 0.012);
// 성 침실과 공방이 «픽셀로» 이만큼은 달라야 한다 (벽지·바닥재·창·소품이 다 갈린다).
// ⚠️ 두 세트를 같게 두는 사보타주에서 0.004 였다
const SET_DIFF = 0.03;
// 발밑 그림자가 이만큼은 바닥을 어둡게 해야 «그려진» 것이다.
// ⚠️ 「두 겹인가」만 세면 `#iShadow` 가 문서에 없을 때(번지는 겹이 통째로 안 그려진다)
//    를 못 본다 — 오류도 안 나고 그림자만 조용히 한 겹이 된다
const SHADOW_MIN = Number(process.env.SHADOW_MIN || 0.004);
// 조각 그림자는 **왼쪽 아래**로 진다 (방의 빛이 오른쪽 위다) — 몇 px 이상 치우쳐야 한다
// 조각 그림자가 «실제로» 아래로 지는 몫 (px · 치우치지 않은 같은 그림자와 견준 것).
// ⚠️ 치우침이 4.4px 인데 번짐이 6.4px 이라 보이는 몫은 그 절반쯤이다 — 지금 2.0~2.4px
const DROP_MIN = Number(process.env.DROP_MIN || 1.0);
// 아치창의 위 귀퉁이는 «창틀»이고 한가운데는 «유리»다. 네모 창은 둘 다 유리다.
// ⚠️ 값은 재서 골랐다 — 아치는 귀퉁이÷한가운데가 0.3 안쪽, 네모는 0.9 가 넘는다
const ARCH_CORNER = 0.6;

const SETS = [
  { cut: 0, name: '성 침실', set: 'castle', win: 'arch' },
  { cut: 9, name: '공방', set: 'atelier', win: 'cross' },
];

const mean = (g, x0, y0, x1, y1) => {
  let s = 0, n = 0;
  for (let y = Math.max(0, y0 | 0); y < Math.min(g.h, y1 | 0); y++)
    for (let x = Math.max(0, x0 | 0); x < Math.min(g.w, x1 | 0); x++) { s += g.l[y * g.w + x]; n++; }
  return n ? s / n : 0;
};
const diff = (A, B) => {
  let s = 0;
  for (let i = 0; i < A.l.length; i++) s += Math.abs(A.l[i] - B.l[i]);
  return s / A.l.length;
};
// 달라진 점들의 «무게중심» — 조각 그림자가 어느 쪽으로 지는가
function centroid(A, B, th) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < A.h; y++)
    for (let x = 0; x < A.w; x++) {
      const d = Math.abs(A.l[y * A.w + x] - B.l[y * B.w + x]);
      if (d > th) { sx += x * d; sy += y * d; n += d; }
    }
  return n ? { x: sx / n, y: sy / n, n } : null;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const bad = [];
  const out = [];
  let seen = 0, drops = 0;

  for (const W of [265, 390, 480]) {
    const page = await browser.newPage({ viewport: { width: W, height: 820 } });
    await page.goto(BASE, { waitUntil: 'load' });
    // ⚠️ 3D 는 670KB 짜리 모듈을 받고 선다 — **기다린다.** 안 기다리면 SVG 배경을
    //    재고 통과한다 (`checkroom` 에서 배운 자리다)
    const up = await page.waitForFunction(() => !!document.querySelector('#introStage.is3d'),
      null, { timeout: 25000 }).then(() => true).catch(() => false);
    if (!up) { bad.push(`${W}px: 3D 가 안 섰다 (#introStage.is3d 가 없다)`); await page.close(); continue; }
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.remove();
      // 자동 넘김을 끈다 — 재는 동안 컷이 넘어가면 다른 세트를 재게 된다
      const b = document.getElementById('introAuto');
      if (b && b.classList.contains('on')) Intro.toggleAuto(b);
    });

    const box = await page.evaluate(() => {
      const r = document.getElementById('introStage').getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height) };
    });
    const shot = async (c) => pngLumGrid(await page.screenshot({ clip: c || box }));
    // ⚠️⚠️ **재기 전에 «멈춘다».** 촛불은 흔들리고 먼지는 흐르고 반짝이는 돈다 —
    //    그대로 두 장을 찍으면 온 화면이 달라져 어느 diff 도 뜻이 없어진다
    //    (`checkroom` 과 같은 자리다 · 끝이 있는 CSS 애니메이션도 끝으로 보낸다)
    const freeze = () => page.evaluate(() => {
      window.__i3d.run(false); window.__i3d.render();
      document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = 1e6; } catch (e) {} });
    });
    const show = (sel, on) => page.evaluate(([s, o]) => {
      document.querySelectorAll(s).forEach(e => { e.style.visibility = o ? '' : 'hidden'; });
    }, [sel, on]);

    const shots = {};
    for (const S of SETS) {
      await page.evaluate((n) => { while (Intro.cutIndex() < n) Intro.next(); }, S.cut);
      await page.waitForTimeout(650);
      await freeze();

      const dom = await page.evaluate(() => {
        const st = document.getElementById('introStage').getBoundingClientRect();
        const lay = document.querySelector('#introArt .i-layer.on');
        const bg = lay && lay.querySelector('.i-bg');
        const doll = lay ? lay.querySelector('g.i-doll') : null;
        const sh = lay ? Array.from(lay.querySelectorAll('ellipse[fill^="url(#iShadow"]')) : [];
        const hard = lay ? Array.from(lay.querySelectorAll('ellipse[fill^="rgba(20,10,25"]')) : [];
        const r = doll ? doll.getBoundingClientRect() : null;
        const fr = window.__i3d.floorRect();
        // 공주의 «발밑» — 두 겹 중 진한 쪽의 화면 자리
        const f = hard.length ? hard[0].getBoundingClientRect() : null;
        return {
          canvas: !!document.querySelector('#introStage canvas.i-3d'),
          is3d: !!document.querySelector('#introStage.is3d'),
          bgHidden: bg ? getComputedStyle(bg).visibility === 'hidden' : null,
          dolls: lay ? lay.querySelectorAll('g.i-doll').length : 0,
          filt: doll ? getComputedStyle(doll).filter : '',
          soft: sh.length, hardN: hard.length,
          softRx: sh.length ? +sh[0].getAttribute('rx') : 0,
          hardRx: hard.length ? +hard[0].getAttribute('rx') : 0,
          footY: f ? (f.top + f.bottom) / 2 - st.top : null,
          // 번지는 겹만 있는 «날개» 둘 — 진한 겹의 바깥 ~ 번지는 겹의 끝
          wing: (sh.length && hard.length) ? (() => {
            const a0 = sh[0].getBoundingClientRect(), b0 = hard[0].getBoundingClientRect();
            const y = (b0.top + b0.bottom) / 2 - st.top, h = Math.max(4, b0.height);
            return [{ x: a0.left - st.left, y: y - h / 2, w: Math.max(3, b0.left - a0.left), h },
                    { x: b0.right - st.left, y: y - h / 2, w: Math.max(3, a0.right - b0.right), h }];
          })() : null,
          markY: fr.cy, markHalf: fr.half,
          win: window.__i3d.winShape,
          doll: r ? { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height } : null,
        };
      });

      // ── ① 3D 가 서고 2D 배경이 «덮인다»
      if (!dom.canvas) bad.push(`${W}px ${S.name}: 3D 캔버스가 없다`);
      if (dom.bgHidden !== true) bad.push(`${W}px ${S.name}: 2D 배경(.i-bg)이 안 덮였다`);
      // ⚠️ **윗동강만 잰다** — 아래 절반은 대사 상자와 바닥이라, 어두운 공방에서는
      //    캔버스를 껐다 켜도 평균이 거의 안 움직인다 (0.02). 벽·창이 있는 위쪽은
      //    그 열 배가 넘게 갈린다 — 0건이 「통과」인지 「못 쟀다」인지를 가르는 자리다
      const top = { x: box.x, y: box.y, width: box.width, height: Math.round(box.height * 0.55) };
      const a = await shot(top);
      await show('#introStage canvas.i-3d', false);
      const b = await shot(top);
      await show('#introStage canvas.i-3d', true);
      const paint = diff(a, b);
      if (paint < PAINT_MIN) bad.push(`${W}px ${S.name}: 3D 가 화면에 안 찍힌다 (껐다 켜도 ${paint.toFixed(3)})`);
      if (W === 390) out.push(`${S.name} 칠 ${paint.toFixed(3)}`);
      shots[S.set] = await shot();

      // ── ② 창의 모양이 세트를 따라간다 (+ 아치가 «진짜 아치»인가)
      if (dom.win !== S.win) bad.push(`${W}px ${S.name}: 창이 '${dom.win}' 이다 ('${S.win}' 이어야 한다)`);
      const wk = await page.evaluate(() => {
        const im = window.__i3d.parts.winMat.map.image;
        const g = im.getContext('2d');
        const px = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
        return { corner: px(56, 96), mid: px(256, 96) };
      });
      const k = wk.mid > 0 ? wk.corner / wk.mid : 1;
      if (W === 390) out.push(`${S.name} 창 귀퉁이÷한가운데 ${k.toFixed(2)}`);
      if (S.win === 'arch' && k > ARCH_CORNER)
        bad.push(`${W}px ${S.name}: 창의 위 귀퉁이가 유리다 (귀퉁이÷한가운데 ${k.toFixed(2)} — 아치가 아니다)`);
      if (S.win === 'cross' && k < ARCH_CORNER)
        bad.push(`${W}px ${S.name}: 네모 창의 위 귀퉁이가 막혔다 (${k.toFixed(2)})`);

      // ── ③ 인물이 방의 «바닥 기준» 위에 선다
      if (dom.footY == null) bad.push(`${W}px ${S.name}: 발밑 그림자를 못 찾았다`);
      else {
        const d = Math.abs(dom.footY - dom.markY);
        if (d > FOOT_MAX) bad.push(`${W}px ${S.name}: 발이 방 바닥에서 ${d.toFixed(1)}px 떠 있다`);
      }

      // ── ④ 발밑 그림자가 «두 겹»이고 실제로 그려진다
      if (dom.soft < 1 || dom.hardN < 1)
        bad.push(`${W}px ${S.name}: 발밑 그림자가 한 겹이다 (번지는 ${dom.soft} · 진한 ${dom.hardN})`);
      else if (!(dom.softRx > dom.hardRx))
        bad.push(`${W}px ${S.name}: 번지는 겹이 더 안 넓다 (${dom.softRx} ↔ ${dom.hardRx})`);
      // ⚠️⚠️ **번지는 겹 «하나만» 을, 그것만 있는 «날개»에서 잰다.** 둘을 같이 껐다 켜면
      //    진한 겹이 몫을 다 가져가서, `#iShadow` 가 문서에 없어 번지는 겹이 통째로
      //    안 그려지는 사고를 **그대로 통과시킨다** (오류도 안 나는 종류다).
      //    그리고 인물 «아래»를 통째로 재면 안 바뀌는 치맛자락이 평균을 희석해
      //    265px 에서 0.007 까지 내려간다 — 날개는 그림자뿐이라 그 희석이 없다
      if (dom.wing) {
        const wings = dom.wing.map(w => ({ x: box.x + w.x, y: box.y + w.y,
          width: Math.max(3, Math.round(w.w)), height: Math.max(3, Math.round(w.h)) }));
        await show('#introArt .i-layer.on ellipse[fill^="rgba(20,10,25"]', false);
        const on = [];
        for (const w of wings) on.push(await shot(w));
        await show('#introArt .i-layer.on ellipse[fill^="url(#iShadow"]', false);
        const off = [];
        for (const w of wings) off.push(await shot(w));
        await show('#introArt .i-layer.on ellipse[fill^="url(#iShadow"], #introArt .i-layer.on ellipse[fill^="rgba(20,10,25"]', true);
        let dark = 0;
        for (let i = 0; i < on.length; i++)
          dark += (mean(off[i], 0, 0, off[i].w, off[i].h) - mean(on[i], 0, 0, on[i].w, on[i].h)) / on.length;
        if (dark < SHADOW_MIN)
          bad.push(`${W}px ${S.name}: 번지는 겹이 바닥을 안 어둡게 한다 (${dark.toFixed(3)})`);
        if (S.cut === SETS[0].cut && W === 390) out.push(`번지는 겹 ${dark.toFixed(3)}`);
      } else bad.push(`${W}px ${S.name}: 발밑 그림자의 «날개»를 못 찾았다`);

      // ── ⑤ 조각 그림자가 **왼쪽 아래**로 진다
      if (!/drop-shadow/.test(dom.filt))
        bad.push(`${W}px ${S.name}: 인물에 조각 그림자가 없다 (filter: ${dom.filt || '없음'})`);
      // ⚠️⚠️ **무게중심을 «상자 한가운데»와 견주면 안 된다 — 그렇게 짰다가 헛짚었다.**
      //    그림자가 보이는 곳은 인물에 안 가린 «아래 테두리»라, 치우침이 0 이어도
      //    무게중심은 한참 아래에 선다 (dy +28). 띠를 양옆에 대 보는 것도 안 됐다 —
      //    공방에서는 요정이 바로 옆에 서서 오른쪽 띠에 «요정의 그림자»가 든다.
      // ⚠️ 그래서 **그림자의 무게중심을 «인물 자신의» 무게중심과 견딘다.** 둘 다 diff 로
      //    구하므로 배경이 밝든 어둡든 같은 잣대이고, 부호가 뒤집히는 사보타주에 바로 걸린다
      else if (dom.doll) {
        const r = { x: Math.round(box.x + dom.doll.x - 16), y: Math.round(box.y + dom.doll.y - 16),
          width: Math.round(dom.doll.w) + 32, height: Math.round(dom.doll.h) + 32 };
        const filt = (v) => page.evaluate((x) => {
          const e = document.querySelector('#introArt .i-layer.on g.i-doll');
          if (e) e.style.filter = x;
        }, v);
        await filt('none');
        const A = await shot(r);           // 그림자 없는 인물
        await filt('');
        const C = await shot(r);           // 지금 그림자
        // ⚠️⚠️ 견줄 것은 **«치우치지 않은» 같은 그림자**다 — 인물 자신의 무게중심과
        //    견디면 모양에 걸려 헛짚는다 (먹는 중인 공주는 치킨 쪽으로 쏠려 있어
        //    멀쩡한 그림자가 「오른쪽으로 진다」로 잡혔다). 번짐은 그대로 두고
        //    오프셋만 0 으로 둔 판을 기준으로 삼으면 **갈리는 것이 오프셋뿐**이다
        await filt('drop-shadow(0px 0px 6.4px rgba(0, 0, 0, 0.34))');
        const Z = await shot(r);
        await filt('');
        const c1 = centroid(Z, A, 0.02);   // 안 치우친 그림자
        const c2 = centroid(C, A, 0.02);   // 지금 그림자
        if (!c1 || !c2) bad.push(`${W}px ${S.name}: 조각 그림자를 꺼도 화면이 안 달라진다`);
        else {
          const dy = c2.y - c1.y;
          // ⚠️⚠️ **가로는 픽셀로 못 잰다 — 재 보고 안 재기로 한 것이다.** 치우침이
          //    −2.4px 인데 번짐이 6.4px 이라, 번짐이 가로 몫을 다 먹어 ±0.2px 로
          //    흔들린다 (멀쩡한 그림이 한 폭에서 +0.17 로 걸렸다). 그래서 **가로는
          //    규칙에서 읽고**(`ox < 0`) **세로는 픽셀로 본다** — 둘이 짝이라
          //    「왼쪽으로 뒤집기」도 「아예 안 그리기」도 다 걸린다
          // ⚠️ 브라우저는 색을 «앞»에 놓아 돌려준다(`drop-shadow(rgba(…) -2.4px 4.4px 6.4px)`)
          //    — 순서를 가정하지 말고 길이 둘을 찾는다
          const m = String(dom.filt).match(/-?[\d.]+px/g) || [];
          if (m.length < 2) bad.push(`${W}px ${S.name}: 조각 그림자의 치우침을 못 읽었다 (${dom.filt})`);
          else {
            if (!(parseFloat(m[0]) < 0)) bad.push(`${W}px ${S.name}: 조각 그림자가 왼쪽이 아니다 (${m[0]})`);
            if (!(parseFloat(m[1]) > 0)) bad.push(`${W}px ${S.name}: 조각 그림자가 아래가 아니다 (${m[1]})`);
          }
          // ⚠️⚠️ **픽셀로 보는 것은 «바닥이 밝은» 성 침실에서다.** 어두운 공방 벽에서는
          //    같은 그림자가 0.1px 까지 내려가 잣대가 안 선다 (재 보고 자리를 옮겼다).
          //    규칙은 두 세트가 한 벌이라 한쪽에서 재면 둘 다 지켜진다 — 그래도
          //    **몇 곳에서 쟀는지 같이 낸다**
          if (S.set === 'castle') {
            if (!(dy > DROP_MIN)) bad.push(`${W}px ${S.name}: 조각 그림자가 실제로 아래에 안 진다 (dy ${dy.toFixed(2)}px)`);
            drops++;
            if (W === 390) out.push(`조각 그림자 ↓${dy.toFixed(1)}px`);
          }
        }
      }
      seen++;
    }

    // ── ②-2 두 세트가 «픽셀로» 갈린다
    if (shots.castle && shots.atelier) {
      const d = diff(shots.castle, shots.atelier);
      if (d < SET_DIFF) bad.push(`${W}px: 성 침실과 공방이 같은 방이다 (차 ${d.toFixed(3)})`);
      if (W === 390) out.push(`세트 차 ${d.toFixed(3)}`);
    }

    // ── ⑥ 인트로가 끝나면 치운다 (마이 룸이 제 WebGL 문맥을 따로 만든다)
    await page.evaluate(() => Intro.finish());
    await page.waitForTimeout(900);
    const left = await page.evaluate(() => ({
      canvas: !!document.querySelector('#introStage canvas.i-3d'),
      is3d: !!document.querySelector('#introStage.is3d') }));
    if (left.canvas || left.is3d) bad.push(`${W}px: 인트로가 끝났는데 3D 가 남아 있다`);
    await page.close();
  }

  await browser.close();
  console.log('인트로 3D — ' + (out.join(' · ') || '(못 쟀다)'));
  console.log(`  (폭 셋 × 세트 둘 = ${seen}/6 자리 · 조각 그림자가 지는 쪽 ${drops}/3 곳 · 발 ${FOOT_MAX}px 까지)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  if (seen !== 6) { console.log(`❌ 여섯 자리 중 ${seen}곳만 쟀다`); process.exit(1); }
  if (drops !== 3) { console.log(`❌ 조각 그림자가 지는 쪽을 ${drops}/3 곳만 쟀다`); process.exit(1); }
  console.log('✅ 인트로의 배경이 3D 로 서고, 세트가 컷을 따라 갈리고, 인물이 그 바닥에 선다');
})().catch(e => { console.error(e); process.exit(1); });
