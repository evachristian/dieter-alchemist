// ═══════════════════════════════════════════════════════════════
//  마이 룸의 방이 «3D 로» 제대로 서는가 (npm run test:room)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **지금 있는 검사들은 이 층을 한 번도 안 본다.** `checkavatar` 의 「서는 자리」도
// `checkui` 의 「방 배경 올리기」도 **SVG 방**(`.room-svg`)을 잰다 — 3D 가 서면 그것은
// `visibility: hidden` 이라 **사람이 안 보는 그림**이다. 거기서 0건이 나오는 것은
// 「통과」가 아니라 **「한 번도 안 쟀다」**이다.
//
// ⚠️ 그렇다고 그 검사들을 3D 로 «옮기지» 않는다 — SVG 방은 **WebGL 이 없는 기기가
// 실제로 보는 화면**이라 그대로 지켜야 한다. 여기가 3D 쪽을 맡고, 그래서 **둘이
// 같은 자리에 서는지**(②)가 이 파일에서 제일 중요한 줄이다.
//
// ⚠️⚠️ **`floorRect()` 를 읽어 견주지 않는다.** 그것은 `placeFigure` 가 이미 보는 값이라
// 「3D 는 저기 그려 놓고 인물은 SVG 상수로 세우는」 사고를 통째로 못 본다
// (SVG 방에서 `Avatar.FLOOR_SPOT` 을 읽으면 안 되던 것과 같은 자리다).
// **찍은 픽셀에서 양탄자를 찾는다** — 조각을 껐다 켜서 «달라지는 몫»으로.
'use strict';
const { chromium } = require('playwright');
const { pngLumGrid } = require('./pnglum');
const BASE = process.env.BASE || 'http://localhost:8080';

const FOOT_MAX = 8;     // px. 양탄자 가로 한가운데와 발
const SVG_MAX = 9;      // px. 3D 와 SVG 가 같은 자리를 써야 «떨어질 때» 안 튄다
const WALL_MIN = 0.6;   // 머리 위 띠에서 벽이 덮는 몫

// 「달라진 점이 한 줄에 30px 넘게 이어진 곳」만 양탄자로 친다.
// ⚠️ 문턱을 0.02 로 두면 **그림자가 번진 몫까지** 잡혀 방 전체가 양탄자가 된다
//    (265px 에서 264px 짜리 「양탄자」가 나왔다)
const DIFF = 0.06, RUN = 30;

function mask(A, B) {
  const rows = [];
  for (let y = 0; y < A.h; y++) {
    let a = 1e9, b = -1;
    for (let x = 0; x < A.w; x++) {
      if (Math.abs(A.l[y * A.w + x] - B.l[y * B.w + x]) > DIFF) { if (x < a) a = x; if (x > b) b = x; }
    }
    if (b - a + 1 >= RUN) rows.push({ y, w: b - a + 1, cx: (a + b) / 2 });
  }
  return rows;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const bad = [];
  const out = [];

  for (const W of [265, 390, 480]) {
    const page = await browser.newPage({ viewport: { width: W, height: 820 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    // ⚠️ 3D 는 670KB 를 받고 서므로 **기다린다** — 안 기다리면 SVG 를 재고 통과한다
    await page.waitForFunction(() => document.querySelector('.room-scene.is3d'), null,
      { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.remove();
      const i = document.getElementById('intro'); if (i) i.style.display = 'none';
      switchTab('showcase');
    });
    await page.waitForTimeout(500);
    if (!await page.evaluate(() => !!document.querySelector('.room-scene.is3d'))) {
      bad.push(`${W}px: 3D 가 안 섰다 (.room-scene.is3d 가 없다)`); await page.close(); continue;
    }
    // ⚠️⚠️ **재기 전에 «멈춘다».** 마법진은 돌고 촛불은 흔들리고 먼지는 흐른다 —
    //    그대로 두 장을 찍으면 온 화면이 달라져 diff 가 방 전체를 양탄자라고 내놓는다
    //    (`checkUI()` 가 끝이 있는 애니메이션을 끝 상태로 보내는 것과 같은 자리다)
    await page.evaluate(() => { room3d.run(false); room3d.render(); });
    await page.waitForTimeout(80);

    const box = await page.evaluate(() => {
      const r = document.querySelector('.room-scene').getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height) };
    });
    const shot = async (c) => pngLumGrid(await page.screenshot({ clip: c || box }));
    const show = (what, on) => page.evaluate(([w, o]) => {
      const p = room3d.parts[w];
      (Array.isArray(p) ? p : [p]).forEach(m => { m.visible = o; });
      room3d.render();
    }, [what, on]);

    // ── 양탄자 찾기
    const A = await shot();
    await show('rug', false); await page.waitForTimeout(60);
    const B = await shot();
    await show('rug', true); await page.waitForTimeout(60);
    if (!A || !B || A.l.length !== B.l.length) { bad.push(`${W}px: 방을 못 찍었다`); await page.close(); continue; }
    const rows = mask(A, B);
    if (rows.length < 10) { bad.push(`${W}px: 양탄자를 못 찾았다 (${rows.length}줄)`); await page.close(); continue; }
    const wide = rows.reduce((m, r) => (r.w > m.w ? r : m), rows[0]);
    const rug = { cx: box.x + wide.cx, w: wide.w,
      top: box.y + rows[0].y, bot: box.y + rows[rows.length - 1].y };

    // ── ① 인물의 발이 «그려진» 양탄자 위인가
    const foot = await page.evaluate(() => {
      const e = document.querySelector('.char-body > svg.avatar-svg > ellipse');   // 바닥 그림자
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    let dFoot = null;
    if (!foot) bad.push(`${W}px: 아바타의 바닥 그림자를 못 찾았다`);
    else {
      dFoot = Math.abs(foot.cx - rug.cx);
      if (dFoot > FOOT_MAX) bad.push(`${W}px: 발이 양탄자 가운데에서 ${dFoot.toFixed(1)}px 벗어났다`);
      if (foot.cy < rug.top || foot.cy > rug.bot) {
        bad.push(`${W}px: 발이 양탄자 «밖»이다 (발 ${foot.cy.toFixed(0)} · 양탄자 ${rug.top.toFixed(0)}~${rug.bot.toFixed(0)})`);
      }
    }

    // ── ② 3D 와 SVG 가 «같은 자리»를 쓰는가 (여기가 제일 중요하다)
    const svg = await page.evaluate(() => {
      const r = document.querySelector('.room-scene').getBoundingClientRect();
      const s = document.querySelector('.room-2d .room-svg');
      if (!s) return null;
      let best = null;
      s.querySelectorAll('ellipse').forEach(e => {
        const b = e.getBoundingClientRect();
        if (b.width > 40 && b.top > r.top + r.height * 0.4 && (!best || b.width > best.width)) best = b;
      });
      return best ? { cx: best.left + best.width / 2, bot: best.bottom, w: best.width,
        x0: r.left, x1: r.right } : null;
    });
    let dW = null, dB = null;
    if (!svg) bad.push(`${W}px: SVG 방의 양탄자를 못 찾았다 — 떨어질 자리를 못 잰다`);
    else {
      // ⚠️ 좁은 상자에서는 SVG 양탄자가 **화면 밖으로 잘린다** — 잘린 뒤의 폭과 견준다
      const seen = Math.min(svg.cx + svg.w / 2, svg.x1) - Math.max(svg.cx - svg.w / 2, svg.x0);
      dW = Math.abs(seen - rug.w);
      dB = Math.abs(svg.bot - rug.bot);
      const dC = Math.abs(svg.cx - rug.cx);
      if (dW > SVG_MAX) bad.push(`${W}px: 양탄자 폭이 SVG 와 ${dW.toFixed(1)}px 다르다`);
      if (dB > SVG_MAX) bad.push(`${W}px: 양탄자 앞자락이 SVG 와 ${dB.toFixed(1)}px 다르다`);
      if (dC > SVG_MAX) bad.push(`${W}px: 양탄자 가운데가 SVG 와 ${dC.toFixed(1)}px 다르다`);
    }

    // ── ③ **머리 뒤에 벽이 있는가** (없으면 인물이 허공에 선 것으로 보인다)
    // ⚠️⚠️ **상자 꼭대기를 재면 안 된다.** 방은 헤더 자리까지 올라가는데 그 띠에는
    //    알약이 깔려 있고, 좁은 폭에서는 방의 «화면 밖» 몫이 커져 엉뚱한 자리를 잰다
    //    (265px 에서 「벽 0%」가 나왔다 — 벽이 없는 것이 아니라 **잰 자리가 달랐다**).
    //    지킬 것은 「꼭대기」가 아니라 **머리 뒤**이므로 거기를 잰다
    const head = await page.evaluate(() => {
      const g = document.querySelector('.char-body > svg.avatar-svg [data-part="head"]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.left, w: r.width, top: r.top };
    });
    let share = 0;
    if (!head) bad.push(`${W}px: 머리를 못 찾았다 — 뒤에 벽이 있는지를 못 잰다`);
    else {
      const band = { x: Math.round(Math.max(0, head.x)), width: Math.round(Math.min(head.w, W - Math.max(0, head.x))),
        y: Math.round(Math.max(0, head.top - 22)), height: 12 };
      const T1 = await shot(band);
      await show('walls', false); await page.waitForTimeout(60);
      const T2 = await shot(band);
      await show('walls', true); await page.waitForTimeout(60);
      let diff = 0;
      for (let i = 0; i < T1.l.length; i++) if (Math.abs(T1.l[i] - T2.l[i]) > 0.02) diff++;
      share = diff / T1.l.length;
      if (share < WALL_MIN) bad.push(`${W}px: 머리 뒤가 벽이 아니다 (벽이 덮는 몫 ${(share * 100).toFixed(0)}%)`);
    }

    // ── ④ 둘러보기 — **돌려도 인물이 양탄자 위에 그대로 있는가**
    //
    // ⚠️⚠️ 카메라를 **양탄자의 세로축»이 아닌» 데서** 돌리면 양탄자가 화면에서 좌우로
    //    미끄러지는데, `placeFigure` 는 **세로만** 맞추므로 발이 그대로 남아 밖으로
    //    나간다. 그것을 「돌아간다」만 보고는 못 잡는다 — **다시 찾은 양탄자**와 견준다
    // ⚠️ **돌려도 «크기»가 안 변해야 한다** — 양탄자의 끝을 x 축에 못 박으면 돌릴 때
    //    그 점이 비스듬해져 짧아지고, `aimFloor` 가 카메라를 당겨 **방이 확대된다**
    let spun = null;
    {
      const half0 = await page.evaluate(() => room3d.floorRect().half);
      const at0 = await page.evaluate(() => room3d.spinAt());
      // 끝까지 눌러 본다 — **멈추는지**도 같이 본다 (앞벽이 없어 끝까지는 못 돈다)
      const at = await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) spinRoom(1);
        await new Promise(r => setTimeout(r, 700));
        room3d.run(false); room3d.render();
        return { at: room3d.spinAt(), half: room3d.floorRect().half,
          off: [...document.querySelectorAll('.spin-btn')].map(b => b.disabled) };
      });
      if (!(at.at.max > 0)) bad.push(`${W}px: 둘러보기 한계(YAW_MAX)가 없다 — 끝까지 돈다`);
      if (Math.abs(at.at.to) > at.at.max + 1e-6) {
        bad.push(`${W}px: 둘러보기가 한계를 넘었다 (${at.at.to.toFixed(3)} > ${at.at.max})`);
      }
      if (Math.abs(at.at.yaw - at.at.to) > 0.01) bad.push(`${W}px: 둘러보기가 목표까지 안 갔다`);
      if (!at.off[1]) bad.push(`${W}px: 끝까지 돌았는데 그쪽 버튼이 «안 눌리게» 안 됐다`);
      if (at.off[0]) bad.push(`${W}px: 되돌아올 수 있는데 그쪽 버튼이 잠겼다`);
      const dHalf = Math.abs(at.half - half0);
      if (dHalf > 1.2) bad.push(`${W}px: 둘러보니 양탄자가 ${dHalf.toFixed(1)}px 달라졌다 — 방이 확대·축소된다`);
      // **그림이 진짜로 달라졌는가** — 안 달라지면 버튼이 하는 일이 없는 것이다
      const C = await shot();
      let moved = 0;
      for (let i = 0; i < A.l.length; i++) if (Math.abs(A.l[i] - C.l[i]) > DIFF) moved++;
      const mShare = moved / A.l.length;
      if (mShare < 0.06) bad.push(`${W}px: 둘러봐도 그림이 거의 그대로다 (${(mShare * 100).toFixed(1)}%)`);
      // **돌린 자리에서 양탄자를 다시 찾아** 발과 견준다
      await show('rug', false); await page.waitForTimeout(60);
      const D = await shot();
      await show('rug', true); await page.waitForTimeout(60);
      const rows2 = mask(C, D);
      if (rows2.length < 10) bad.push(`${W}px: 돌린 뒤 양탄자를 못 찾았다 (${rows2.length}줄) — 아무것도 안 쟀다`);
      else {
        const w2 = rows2.reduce((m, r) => (r.w > m.w ? r : m), rows2[0]);
        const f2 = await page.evaluate(() => {
          const e = document.querySelector('.char-body > svg.avatar-svg > ellipse');
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });
        if (!f2) bad.push(`${W}px: 돌린 뒤 바닥 그림자를 못 찾았다`);
        else {
          const d2 = Math.abs(f2.cx - (box.x + w2.cx));
          const t2 = box.y + rows2[0].y, b2 = box.y + rows2[rows2.length - 1].y;
          if (d2 > FOOT_MAX) bad.push(`${W}px: 둘러보니 발이 양탄자 가운데에서 ${d2.toFixed(1)}px 벗어났다`);
          if (f2.cy < t2 || f2.cy > b2) bad.push(`${W}px: 둘러보니 발이 양탄자 «밖»이다`);
          spun = { d: d2, dHalf, mShare, yaw: at.at.to };
        }
      }
      // 되돌려 놓는다 — 뒤의 검사가 «돌아간 방»을 재면 안 된다
      await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) spinRoom(-1);
        for (let i = 0; i < 12; i++) spinRoom(1);
        for (let i = 0; i < 6; i++) spinRoom(-1);
        await new Promise(r => setTimeout(r, 700));
      });
    }

    // ── ⑤ 마이 룸을 떠나면 «멈춘다» (배터리 · 그리고 재는 순간이 흔들린다)
    const ran = await page.evaluate(async () => {
      room3d.run(true);                      // 멈춰 둔 것을 되돌려 놓고 잰다
      switchTab('atelier');
      await new Promise(r => setTimeout(r, 300));
      const a = room3d.renderer.info.render.frame;
      await new Promise(r => setTimeout(r, 400));
      const b = room3d.renderer.info.render.frame;
      switchTab('showcase');
      return b - a;
    });
    if (ran > 1) bad.push(`${W}px: 마이 룸을 떠났는데 ${ran}프레임을 더 그렸다`);

    out.push(`${W}px 양탄자 ${rug.w}px · 발 ${dFoot == null ? '?' : dFoot.toFixed(1)}px`
      + ` · SVG 와 폭 ${dW == null ? '?' : dW.toFixed(1)} · 앞자락 ${dB == null ? '?' : dB.toFixed(1)}`
      + ` · 머리 뒤 벽 ${(share * 100).toFixed(0)}%`
      + ` · 둘러보기 ${spun ? `${(spun.yaw * 180 / Math.PI).toFixed(0)}° 에서 발 ${spun.d.toFixed(1)}px`
        + ` · 양탄자 ${spun.dHalf.toFixed(1)}px · 그림 ${(spun.mShare * 100).toFixed(0)}% 달라짐` : '?'}`);
    await page.close();
  }

  await browser.close();
  console.log('3D 방 — ' + out.join(' | '));
  console.log(`  (발 ${FOOT_MAX}px · SVG 와 ${SVG_MAX}px · 머리 뒤 벽 ${WALL_MIN * 100}% 까지 · 폭 셋을 다 쟀다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  if (out.length !== 3) { console.log(`❌ 세 폭 중 ${out.length}개만 쟀다`); process.exit(1); }
  console.log('✅ 3D 방이 SVG 와 같은 자리에 서고 인물이 그 양탄자 위에 있다');
})().catch(e => { console.error(e); process.exit(1); });
