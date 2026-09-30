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
// 광원 언저리가 이만큼은 밝아져야 «빛이 난다».
// ⚠️ **재서 골랐다** — 지금 제일 안 나오는 자리가 +0.079(480px 의 SVG)이고 제일
//    잘 나오는 자리가 +0.47 이다. 낮에는 벽이 이미 환해서 더하는 몫이 덜 보인다
const GLOW_MIN = 0.03;
const GLOW_PAD = 12;    // px. 광원의 화면 자리에서 이만큼 네모로 떠서 잰다
// 낮이 밤보다 이만큼은 밝아야 «낮»이다. ⚠️ **사보타주를 돌려 보고 고른 값이다** —
// 옛 두 갈래 조명이 **1.52배**이고 지금이 **2.37배**라 그 사이다 (창밖만 한낮이고
// 방은 저녁이던 화면이 1.52 다). 처음에 2.5 로 적었다가 **멀쩡한 방이 걸렸다**:
// 짐작으로 적은 문턱은 고친 쪽을 잡는다
const DAY_NIGHT = 2.0;
// 낮이 새벽·노을보다 이만큼은 밝아야 «셋이 다른 시간대»다. 예전에는 셋이 한 방이라
// 1.00배였다 (창밖 그림만 갈렸다) — 지금 1.27~1.41배다.
// ⚠️ **1.3 으로 두었다가 멀쩡한 방이 걸렸다** — 촛불이 깜박이는 자리에서 멈추므로
// 새벽 값이 판마다 0.03 쯤 흔들린다. 사보타주(1.00)와는 여전히 멀다
const DAY_SOFT = 1.2;
const EVE_SAME = 0.02;   // 초저녁과 밤은 «같아야» 한다 (고친 적이 없는 자리다)
// 표(`Avatar.SKY_LIGHT`)의 낮을 0 으로 꺾으면 방이 밤만큼 어두워져야 한다
const TABLE_OBEY = 1.15;

// 「달라진 점이 한 줄에 30px 넘게 이어진 곳」만 양탄자로 친다.
// ⚠️ 문턱을 0.02 로 두면 **그림자가 번진 몫까지** 잡혀 방 전체가 양탄자가 된다
//    (265px 에서 264px 짜리 「양탄자」가 나왔다)
const DIFF = 0.06, RUN = 30;
const SPIN_DIFF = 0.012;   // 둘러보기는 «같은 벽이 미끄러지는» 것이라 차이가 작다

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
        // ⚠️⚠️ **양탄자를 «깔아 놓고» 잰다.** 양탄자는 이제 사람이 고르는 소품이라
        //    기본 방에는 아예 없다 — 안 깔면 아래의 「양탄자 찾기」가 0줄을 내고
        //    **이 검사가 통째로 아무것도 안 잰다** (0건이 「통과」가 아닌 그 자리다).
        // ⚠️ 카메라·인물의 기준은 양탄자가 «아니라» 못 박은 자리(`Avatar.floorMark`)다.
        //    그래서 여기서 재는 것은 **「그려진 양탄자가 그 기준과 맞는가」**이고,
        //    맞지 않으면 ①(발)·②(SVG)가 잡는다 — 잣대를 화면 쪽에 두는 것이 요점이다
        // ⚠️ **아홉을 «다» 놓는다** — 빈 방은 벽과 바닥뿐이라 거의 좌우 대칭이어서,
        //    둘러봐도 그림이 0.2% 밖에 안 달라진다 (「돌았는가」를 못 가른다)
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5,
          roomOwned: ['rw_lime', 'rf_pine', 'rp_rug_royal', 'rp_shelf_royal', 'rp_sconce_royal',
            'rp_table_royal', 'rp_candle_royal', 'rp_gear_royal', 'rp_curtain_royal',
            'rp_winplant_royal', 'rp_chandelier_royal'],
          roomProps: { rug: 'rp_rug_royal', shelf: 'rp_shelf_royal', sconce: 'rp_sconce_royal',
            table: 'rp_table_royal', candle: 'rp_candle_royal', gear: 'rp_gear_royal',
            curtain: 'rp_curtain_royal', winplant: 'rp_winplant_royal',
            chandelier: 'rp_chandelier_royal' } }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    // ⚠️ 3D 는 670KB 를 받고 서므로 **기다린다** — 안 기다리면 SVG 를 재고 통과한다
    await page.waitForFunction(() => document.querySelector('.room-scene.is3d'), null,
      { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.remove();
      const i = document.getElementById('intro'); if (i) i.style.display = 'none';
      switchTab('showcase');
      // ⚠️⚠️ **방 위에 얹힌 «버튼 줄»을 치우고 잰다.** 🪄 꾸미기·표정·문신 버튼이
      //    방 그림 왼쪽 아래에 불투명하게 앉아 있어서 **양탄자의 왼쪽 자락을 덮는다** —
      //    그대로 재면 diff 의 가운데가 오른쪽으로 밀려 **발이 16.5px 벗어난 것으로**
      //    잡히고(390px), 265px 에서는 남는 줄이 다섯뿐이라 **아무것도 못 잰다.**
      //    그림이 틀린 것이 아니라 잰 조건이 틀린 것이다 (78건 유령의 그 종류다).
      //    ⚠️ 이 버튼들이 «방을 가린다»는 것 자체는 사람이 정한 배치라 여기서 안 본다
      ['roomSolo', 'roomSpin'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
      });
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
    // ⚠️ 소품은 «자리»에 들어 있다 — 조각을 이름으로 바로 집지 않는다
    //    (`room3d.parts.units[자리].us[].grp`). 표에서 자리를 늘려도 따라온다
    const show = (what, on) => page.evaluate(([w, o]) => {
      const u = room3d.parts.units[w];
      const list = u ? u.us.map(x => x.grp) : [].concat(room3d.parts[w] || []);
      list.forEach(m => { if (m) m.visible = o; });
      room3d.render();
    }, [what, on]);
    // ⚠️⚠️ **소품을 껐다 켜고 잰다 — 안 그러면 다른 소품이 양탄자·벽을 «가린다».**
    //    탁자와 화분이 러그의 오른쪽 자락 위에 서 있어서, 그대로 러그만 껐다 켜면
    //    diff 에 왼쪽 자락만 남아 **가운데가 16.5px 왼쪽으로 밀렸다**(390px).
    //    샹들리에는 머리 «뒤»에 걸려 「벽이 덮는 몫」을 29% 로 떨어뜨렸다 —
    //    둘 다 그림이 틀린 것이 아니라 **잰 조건이 틀린 것**이다 (78건 유령의 그 종류다)
    const setProps = (on, except) => page.evaluate(([o, ex]) => {
      Object.keys(room3d.parts.units).forEach(k => {
        if (k === ex) return;
        room3d.parts.units[k].us.forEach(u => { u.grp.visible = !!(o && u.mesh); });
      });
      room3d.render();
    }, [on, except || '']);
    // ⚠️⚠️ **인물도 잠시 치운다 — 265px 에서는 인물이 방 폭의 «83%» 를 덮는다.**
    //    (아바타 상자가 23~242px · 방이 265px) 그래서 양탄자가 치마 뒤로 통째로
    //    숨어 **잴 줄이 아홉뿐**이었다. 자리를 재는 데 인물은 상관이 없고,
    //    `visibility` 라 상자는 그대로 남아 **발은 그대로 잰다**
    const setFigure = (on) => page.evaluate((o) => {
      const a = document.querySelector('.char-aura');
      if (a) a.style.visibility = o ? '' : 'hidden';
    }, on);

    // ── 양탄자 찾기 (다른 소품은 잠시 치운다)
    await setProps(false, 'rug'); await setFigure(false); await page.waitForTimeout(60);
    const A = await shot();
    await show('rug', false); await page.waitForTimeout(60);
    const B = await shot();
    await show('rug', true); await setProps(true); await setFigure(true); await page.waitForTimeout(60);
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
      // ⚠️ SVG 의 양탄자는 이제 «이모지도 타원도 아니라» 소품 그림(`<image>`)이다 —
      //    `RoomArt` 가 구운 캔버스를 data URL 로 얹은 것이라 3D 와 같은 그림이다
      let best = null;
      s.querySelectorAll('image').forEach(e => {
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
      await setProps(false); await page.waitForTimeout(60);
      const T1 = await shot(band);
      await show('walls', false); await page.waitForTimeout(60);
      const T2 = await shot(band);
      await show('walls', true); await setProps(true); await page.waitForTimeout(60);
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
      // ⚠️⚠️ **돌리기 «직전»의 그림을 찍어 둔다.** 위의 `A` 는 러그만 세워 놓고 찍은
      //    것이라, 그것과 견주면 「돌아서 달라진 몫」에 **소품이 다시 선 몫**이 통째로
      //    섞여 들어 돌리기를 끊어도 통과한다
      const C0 = await shot();
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
      // **그림이 진짜로 달라졌는가** — 안 달라지면 버튼이 하는 일이 없는 것이다.
      // ⚠️⚠️ **견줄 짝은 «돌리기 직전»의 그림이다.** 위의 `A` 는 러그만 세워 놓고
      //    찍은 것이라, 그것과 견주면 「돌아서 달라진 몫」에 **소품이 다시 선 몫**이
      //    통째로 섞인다 — 돌리기를 끊어도 통과한다 (사보타주가 그것을 찾아냈다)
      const C = await shot();
      // ⚠️⚠️ **여기만 문턱이 «낮다**»(`SPIN_DIFF`). 양탄자를 찾을 때 쓰는 0.06 은
      //    「조각이 있고 없고」를 가르는 값인데, 둘러보기는 **같은 벽이 옆으로 미끄러지는**
      //    것이라 밝기 차이가 그보다 작다 — 265px 에서 0.6% 로 나와 멀쩡한 방이 걸렸다.
      //    낮춰도 «안 도는 방»은 여전히 **정확히 0.0%** 라 가르는 데는 아무 문제가 없다
      let moved = 0;
      for (let i = 0; i < C0.l.length; i++) if (Math.abs(C0.l[i] - C.l[i]) > SPIN_DIFF) moved++;
      const mShare = moved / C0.l.length;
      // ⚠️ 문턱은 **돌리기를 끊은 방이 0.0%** 라는 데서 나온다 — 좁은 화면일수록
      //    보이는 벽이 줄어 달라지는 몫도 준다 (265px 8% · 480px 30%)
      if (mShare < 0.03) bad.push(`${W}px: 둘러봐도 그림이 거의 그대로다 (${(mShare * 100).toFixed(1)}%)`);
      // **돌린 자리에서 양탄자를 다시 찾아** 발과 견준다
      await setProps(false, 'rug'); await setFigure(false); await page.waitForTimeout(60);
      const C2 = await shot();
      await show('rug', false); await page.waitForTimeout(60);
      const D = await shot();
      await show('rug', true); await setProps(true); await setFigure(true); await page.waitForTimeout(60);
      const rows2 = mask(C2, D);
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

    // ── ④-2 광원 소품은 «가만히» 있는다 — 흔들리는 것은 빛뿐이다
    //
    // 「촛불이랑 샹들리에 왜 이렇게 위 아래로 상하 운동 함?」으로 신고받은 자리다.
    // 불꽃을 흔들려고 `grp.scale.y` 를 흔들었는데, 그 조각은 불꽃만이 아니라
    // **촛대·샹들리에 카드 통째**라 세로로 눌렸다 폈다 했다.
    //
    // ⚠️⚠️ **양쪽을 «다» 본다.** 「안 움직이는가」만 보면 **빛까지 통째로 꺼 버리는**
    //    사보타주가 통과하고(그러면 촛불이 «켜진 그림»일 뿐이다), 「흔들리는가」만
    //    보면 원래 사고가 그대로 돌아온다. 한쪽만 보는 잣대는 그 절반을 영영 못 본다
    // ⚠️ **한 프레임만 보면 못 잡는다** — 주기가 150ms 라 두 번 찍어도 같은 자리에
    //    설 수 있다. 한 바퀴를 넘겨 훑고 **몇 번 쟀는지도 같이 낸다**
    const still = await page.evaluate(async () => {
      room3d.run(true);
      const lit = room3d.parts.LIT.filter(x => x.grp.visible);
      if (!lit.length) return { n: 0 };
      const snap = () => lit.map(({ grp, light, glow }) => ({
        s: `${grp.scale.x},${grp.scale.y},${grp.scale.z}`,
        p: `${grp.position.x},${grp.position.y},${grp.position.z}`,
        r: `${grp.rotation.x},${grp.rotation.y},${grp.rotation.z}`,
        i: light.intensity,
        // ⚠️ **빛무리도 «커졌다 작아졌다» 하면 안 된다** — 그러면 그 밑의 카드까지
        //    맥박치는 것으로 보여 위의 그 신고가 모양만 바꿔 돌아온다.
        //    흔드는 것은 «불투명도»뿐이라 자리와 크기는 여기서 같이 잡아 둔다
        gs: glow ? `${glow.scale.x},${glow.scale.y},`
          + `${glow.position.x},${glow.position.y},${glow.position.z}` : '',
        go: glow ? glow.material.opacity : null,
      }));
      const shots = [];
      for (let k = 0; k < 24; k++) {                 // 24 × 20ms ≈ 480ms (주기 150ms)
        shots.push(snap());
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
      }
      const first = shots[0];
      let moved = null, lightVary = 0, glowVary = 0;
      const glows = lit.filter(x => x.glow).length;
      lit.forEach((_, i) => {
        shots.forEach(sh => {
          const a = sh[i], b = first[i];
          if (!moved && (a.s !== b.s || a.p !== b.p || a.r !== b.r || a.gs !== b.gs)) {
            moved = { i, was: `${b.s} / ${b.p} / ${b.gs}`, now: `${a.s} / ${a.p} / ${a.gs}` };
          }
        });
        const iv = shots.map(sh => sh[i].i);
        if (Math.max(...iv) - Math.min(...iv) > 1e-4) lightVary++;
        const gv = shots.map(sh => sh[i].go).filter(v => v != null);
        if (gv.length && Math.max(...gv) - Math.min(...gv) > 1e-4) glowVary++;
      });
      return { n: lit.length, shots: shots.length, moved, lightVary, glows, glowVary };
    });
    if (!still.n) bad.push(`${W}px: 광원 소품을 하나도 못 찾았다 (가만히 있는지를 잴 수가 없다)`);
    else if (still.moved) {
      bad.push(`${W}px: 광원 소품이 움직인다 — ${still.moved.was} → ${still.moved.now}`);
    } else if (still.lightVary < still.n) {
      bad.push(`${W}px: 빛이 안 흔들린다 (${still.lightVary}/${still.n} 만 흔들린다 —`
        + ` 조각을 멈추면서 불꽃까지 같이 껐다)`);
    } else if (still.glows < still.n) {
      bad.push(`${W}px: 광원 ${still.n}개 중 ${still.glows}개만 빛무리를 갖고 있다`
        + ` (light 가 있는 자리는 RoomArt.SLOT_GLOW 에도 한 줄이 있어야 한다)`);
    } else if (still.glowVary < still.glows) {
      bad.push(`${W}px: 빛무리가 안 흔들린다 (${still.glowVary}/${still.glows} 만 흔들린다)`);
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

    // ── ⑥ 광원에서 «빛이 난다» — 빛무리가 진짜로 «그려지는가» (3D · SVG 둘 다)
    //
    // 「조명 광원에서 빛이 나게 해줘」로 받은 자리다. `PointLight` 는 방을 밝힐 뿐
    // **보이지 않아서**, 벽은 환한데 정작 촛불·벽등은 캄캄한 조각으로 서 있었다.
    //
    // ⚠️⚠️ **위의 ④-2 는 이것을 영영 못 본다** — 거기서 보는 것은 조각의 «자리»와
    //    불빛의 «세기»(숫자)라, 빛무리를 통째로 안 그려도 그대로 통과한다.
    //    0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 그 자리다.
    // ⚠️ **두 renderer 를 다 본다.** SVG 폴백은 WebGL 이 없는 기기와 **공유 이미지**
    //    (`shareCard`)가 실제로 보는 화면이라, 3D 만 고치면 거기만 캄캄하게 남는다.
    //    ⚠️ 한쪽이 0이면 그 방향은 아예 안 잰 것이므로 **몇 자리를 쟀는지도 같이 낸다**
    // ⚠️ **자리를 px 로 박지 않는다** — 3D 는 카메라로 «투영해서», SVG 는 그림의
    //    `getScreenCTM()` 으로 구한다. 카메라나 자리 표를 고쳐도 따라온다
    const glowOut = [];
    {
      // 재는 동안은 멈춰 둔다 — 빛무리의 불투명도가 프레임마다 흔들린다(④-2)
      await page.evaluate(() => { room3d.run(false); room3d.render(); });
      const lum = (g, cx, cy) => {         // 광원 언저리 네모의 평균 휘도 (상자 밖은 잘라 낸다)
        const x0 = Math.max(0, Math.round(cx - GLOW_PAD)), x1 = Math.min(g.w, Math.round(cx + GLOW_PAD));
        const y0 = Math.max(0, Math.round(cy - GLOW_PAD)), y1 = Math.min(g.h, Math.round(cy + GLOW_PAD));
        if (x1 - x0 < 4 || y1 - y0 < 4) return null;
        let s = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += g.l[y * g.w + x]; n++; }
        return s / n;
      };
      // ⚠️⚠️ **인물을 치우고 잰다.** 샹들리에는 방 한가운데 위에 매달려 있어서
      //    좁은 화면에서는 **인물의 머리 뒤**다 — 그대로 재면 켜나 끄나 같은 머리카락을
      //    재게 되어 **멀쩡한 빛무리가 「0.388 → 0.388」로** 잡혔다 (실제로 그랬다).
      //    ⚠️ `renderShowcase()` 가 인물을 다시 만들므로 **찍기 직전마다** 치운다
      const hideFig = () => page.evaluate(() => {
        ['roomSolo', 'roomSpin'].forEach(id => {
          const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
        });
        const a = document.querySelector('.char-aura');
        if (a) a.style.visibility = 'hidden';
      });
      const measure = async (label, spots, toggle) => {
        if (!spots.length) { bad.push(`${W}px: ${label} 빛무리를 하나도 못 찾았다 (잴 수가 없다)`); return; }
        await toggle(false); await hideFig(); const off = await shot();
        await toggle(true); await hideFig(); const on = await shot();
        if (!off || !on) { bad.push(`${W}px: ${label} 화면을 못 읽었다`); return; }
        let seen = 0, worst = 9;
        spots.forEach(s => {
          const a = lum(off, s.x - box.x, s.y - box.y), b = lum(on, s.x - box.x, s.y - box.y);
          if (a == null || b == null) return;            // 상자 밖으로 나간 자리
          seen++; worst = Math.min(worst, b - a);
          if (b - a < GLOW_MIN) bad.push(`${W}px: ${label} «${s.id}» 에서 빛이 안 난다`
            + ` (${a.toFixed(3)} → ${b.toFixed(3)})`);
        });
        if (!seen) bad.push(`${W}px: ${label} 빛무리가 전부 화면 밖이다 (한 자리도 안 쟀다)`);
        else glowOut.push(`${label} ${seen}/${spots.length}곳 +${worst.toFixed(3)}`);
      };

      const spots3d = await page.evaluate(() => {
        const R = room3d, rc = R.renderer.domElement.getBoundingClientRect();
        const V = new R.camera.position.constructor();
        return R.parts.LIT.filter(x => x.grp.visible && x.glow).map(({ grp, glow }) => {
          glow.getWorldPosition(V); V.project(R.camera);
          return { id: grp.userData.slot || '광원',
            x: rc.left + (V.x * 0.5 + 0.5) * rc.width, y: rc.top + (-V.y * 0.5 + 0.5) * rc.height };
        });
      });
      await measure('3D', spots3d, (on) => page.evaluate((v) => {
        room3d.parts.LIT.forEach(L => { if (L.glow) L.glow.visible = v; });
        room3d.render();
      }, on));

      // SVG 폴백 — 3D 를 걷고 밑에 깔린 그림을 드러내 놓고 같은 것을 잰다.
      // ⚠️ `renderShowcase()` 가 `.room-scene` 을 통째로 새로 만들며 3D 를 도로 덮으므로
      //    **그릴 때마다** 걷어 낸다 (`room3dSync` 가 캔버스를 다시 데려온다)
      const svgToggle = (on) => page.evaluate((v) => {
        const A = window.RoomArt;
        if (!A.__glowBak) A.__glowBak = A.SLOT_GLOW;
        A.SLOT_GLOW = v ? A.__glowBak : {};
        renderShowcase();
        document.querySelectorAll('.room-gl').forEach(c => c.remove());
        document.querySelectorAll('.room-scene').forEach(s => s.classList.remove('is3d'));
      }, on);
      await svgToggle(true);
      const spotsSvg = await page.evaluate(() => {
        const s = document.querySelector('.room-2d .room-svg');
        const m = s && s.getScreenCTM();
        const A = window.RoomArt, D = window.GameData;
        if (!m || !A || !D) return [];
        const G = A.__glowBak || A.SLOT_GLOW || {};
        return Object.keys(G).map(id => {
          const sl = D.roomSlot(id);
          if (!sl || !sl.p2) return null;
          const g = G[id], p2 = sl.p2;
          const p = new DOMPoint(p2[0] + g.x * p2[2], p2[1] + g.y * p2[3]).matrixTransform(m);
          return { id, x: p.x, y: p.y };
        }).filter(Boolean);
      });
      await measure('SVG', spotsSvg, svgToggle);
    }

    // ── ⑦ 둘러보기 버튼이 «방 버튼 줄»과 안 겹치는가
    //
    // ⚠️⚠️ **위의 어느 줄도 이것을 영영 못 본다** — ①~⑥ 은 방 «그림»을 재는데
    //    이 둘은 그림 «위»에 얹힌 DOM 이고, `checkui` 의 넘침 검사도 절대 배치라
    //    상자끼리 포개지는 것은 한 번도 안 본다. 실제로 오래 포개져 있었다
    //    (「카메라 움직이는 버튼 … 운동, 흡입 버튼이랑 겹치네」로 신고받았다).
    // ⚠️ **다섯을 «다» 열어 놓고 잰다.** 방 버튼은 하나씩 열리므로(`actOpen`) 한둘만
    //    켜진 화면에서는 줄이 짧아 **겹칠 수가 없다** — 0건이 「통과」가 아니라
    //    「제일 긴 줄을 한 번도 안 쟀다」가 된다.
    // ⚠️ **두 언어로 본다** — 영어 라벨이 길어 알약이 접히면 줄의 키가 달라진다.
    // ⚠️ 위쪽 이웃인 **시계와의 틈도 같이 낸다** — 위로 붙이다 시계를 파고들면
    //    그것은 겹침을 «옮긴» 것이지 고친 것이 아니다.
    let spinGap = '';
    for (const lang of ['ko', 'en']) {
      const g = await page.evaluate((lg) => {
        I18N.setLang(lg);
        S.roomActs = ['exercise', 'binge', 'kitchen', 'produce', 'farm'];   // 개발용 스위치
        render();
        const box = (el) => { const q = el.getBoundingClientRect();
          return { t: (el.textContent || el.getAttribute('aria-label') || '')
              .replace(/\s+/g, ' ').trim().slice(0, 12),
            x: q.left, r: q.right, y: q.top, b: q.bottom }; };
        const shown = (sel) => [...document.querySelectorAll(sel)]
          .filter(e => e.offsetParent !== null).map(box);
        // 겹침은 «양쪽 줄»을 다 본다 (왼쪽의 🪄 방꾸 · 😯 표정 · ⚜️ 문신도 같은 그림 위다).
        // 다만 「다 열렸는가」는 **오른쪽 줄**로 센다 — 왼쪽 셋은 늘 서 있어서
        // 통째로 세면 다섯을 안 열어도 여덟이 되어 이 빗장이 헐거워진다
        const spin = shown('.spin-btn'), acts = shown('.room-act');
        const right = shown('.room-acts:not(.room-acts-l) .room-act').length;
        const clock = document.getElementById('clockKST');
        const ov = (a, c) => Math.min(a.r, c.r) - Math.max(a.x, c.x) > 0
          && Math.min(a.b, c.b) - Math.max(a.y, c.y) > 0;
        const hit = [];
        let gap = 1e9, gapWith = '';
        spin.forEach(s => acts.forEach(a => {
          if (ov(s, a)) hit.push(`${a.t}`);
          else if (Math.min(s.r, a.r) - Math.max(s.x, a.x) > 0) {       // 가로로 겹치는 짝만
            const d = Math.max(a.y - s.b, s.y - a.b);
            if (d < gap) { gap = d; gapWith = a.t; }
          }
        }));
        const c = clock && clock.offsetParent !== null ? box(clock) : null;
        let cGap = null;
        if (c) spin.forEach(s => {
          if (Math.min(s.r, c.r) - Math.max(s.x, c.x) > 0) {
            const d = Math.max(c.y - s.b, s.y - c.b);
            if (cGap == null || d < cGap) cGap = d;
          }
        });
        return { n: spin.length, acts: right, hit, gap, gapWith, cGap };
      }, lang);
      if (!g.n) { bad.push(`${W}px/${lang}: 둘러보기 버튼이 없다 (겹침을 잴 수가 없다)`); continue; }
      if (g.acts < 5) { bad.push(`${W}px/${lang}: 방 버튼이 ${g.acts}개뿐이다 — 다섯을 다 열어야 잰 것이다`); continue; }
      if (g.hit.length) bad.push(`${W}px/${lang}: 둘러보기 버튼이 ${[...new Set(g.hit)].join('·')} 와 겹친다`);
      if (g.cGap != null && g.cGap < 4) bad.push(`${W}px/${lang}: 둘러보기 버튼이 시계와 ${g.cGap.toFixed(1)}px 밖에 안 떨어졌다`);
      if (lang === 'ko') spinGap = `${g.gap === 1e9 ? '?' : g.gap.toFixed(0)}px(${g.gapWith})`;
      if (lang === 'en') spinGap += ` · en ${g.gap === 1e9 ? '?' : g.gap.toFixed(0)}px`
        + ` · 시계와 ${g.cGap == null ? '?' : g.cGap.toFixed(0)}px`;
    }

    // ── ⑧ 낮에는 방이 «밝다» (2026-09-30)
    //
    // 「낮에 방 너무 어둡다」로 신고받은 자리다. `setPhase` 가 **밤이냐 아니냐** 둘로만
    // 갈려서 새벽·낮·노을이 **한 방**이었고, 창밖은 한낮인데 방은 저녁이라
    // **창만 환한 방**으로 보였다 (재 보면 평균 휘도 0.254 · 밤이 0.125 라 2.0배뿐).
    //
    // ⚠️⚠️ **위의 ①~⑦ 은 이것을 영영 못 본다** — ①②는 «자리», ③은 벽이 덮는 «몫»,
    //    ⑥은 빛무리를 껐다 켠 «차»라 전부 방이 통째로 어두워도 그대로 통과한다.
    //    방의 «밝기»를 절대값으로 보는 줄이 한 줄도 없었다.
    // ⚠️ **폭을 안 탄다** — 빛은 카메라 폭과 무관하므로 한 폭(390px)에서만 잰다.
    //    대신 **다섯 시간대를 다 돈다** (하나만 재면 「낮이 밤보다 밝은가」를 못 묻는다)
    let lightOut = '';
    if (W === 390) {
      // 그 시간대의 «안쪽»(구간 시작 + 1시간)으로 게임 시계를 옮긴다.
      // ⚠️ 값을 심지 않고 «시계»를 옮긴다 — 개발용 「시간대 넘기기」와 같은 규칙이다
      const goPhase = async (k) => {
        await page.evaluate((w) => {
          const A = window.Avatar;
          const b = A.SKY_BANDS.find(x => x.k === w);
          const d = new Date();
          const kst = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
          const cur = ((kst.getHours() * 60 + kst.getMinutes()) * 60 + kst.getSeconds()) * 1000;
          let delta = (b.h + 1) * 3600000 - cur;
          if (delta < 0) delta += 86400000;
          S.devClock = delta; setDevClock(delta);
          render();
        }, k);
        await page.waitForTimeout(280);
        // 다시 그리면 3D 가 새로 붙는다 — 재기 전에 «멈추고» 인물을 치운다
        await page.evaluate(() => { room3d.run(false); room3d.render(); });
        await setFigure(false);
        await page.evaluate(() => ['roomSolo', 'roomSpin'].forEach(id => {
          const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
        }));
      };
      // ⚠️⚠️ **제목 줄 «위»는 빼고 잰다.** 방 그림은 헤더 자리까지 올라가는데(`--room-rise`)
      //    거기에는 AP 알약·저장 칩이 깔려 있다 — 그 띠는 시간대를 안 타서 **밤의 평균을
      //    통째로 끌어올린다** (그대로 재면 낮÷밤이 3.3배가 아니라 2.07배로 나왔다).
      //    ⚠️ 몇 px 인지를 박지 않는다 — 제목 줄의 «밑변»에서 잘라 낸다
      const lightBox = await page.evaluate(() => {
        const sc = document.querySelector('.room-scene').getBoundingClientRect();
        const hd = document.querySelector('.room-head');
        const top = hd ? hd.getBoundingClientRect().bottom : sc.top;
        return { x: Math.round(sc.left), y: Math.round(top),
          width: Math.round(sc.width), height: Math.round(sc.bottom - top) - 8 };
      });
      const meanOf = (g) => {
        let s = 0, n = 0;
        for (let i = 0; i < g.l.length; i++) if (g.l[i] != null) { s += g.l[i]; n++; }
        return n ? s / n : null;
      };
      const lum = {};
      const bands = await page.evaluate(() => window.Avatar.SKY_BANDS.map(b => b.k));
      for (const k of bands) { await goPhase(k); lum[k] = meanOf(await shot(lightBox)); }

      if (bands.some(k => lum[k] == null)) bad.push('낮과 밤: 방을 못 찍었다 (밝기를 잴 수가 없다)');
      else {
        if (lum.day < lum.night * DAY_NIGHT)
          bad.push(`낮이 밤보다 충분히 안 밝다 (${lum.day.toFixed(3)} ÷ ${lum.night.toFixed(3)}`
            + ` = ${(lum.day / lum.night).toFixed(2)}배 · ${DAY_NIGHT}배 기대)`);
        ['dawn', 'dusk'].forEach(k => {
          if (lum.day < lum[k] * DAY_SOFT)
            bad.push(`낮이 «${k}» 와 거의 같다 (${lum.day.toFixed(3)} ÷ ${lum[k].toFixed(3)}`
              + ` = ${(lum.day / lum[k]).toFixed(2)}배 · ${DAY_SOFT}배 기대)`);
        });
        // ⚠️ 밤·초저녁은 **고친 적이 없다** — 여기가 흔들리면 밤 화면까지 같이 옮긴 것이다
        if (Math.abs(lum.evening - lum.night) > EVE_SAME)
          bad.push(`초저녁이 밤과 달라졌다 (${lum.evening.toFixed(3)} ↔ ${lum.night.toFixed(3)})`);
        lightOut = bands.map(k => `${k} ${lum[k].toFixed(3)}`).join(' · ');
      }

      // ── 표가 «유일한 원본»인가 — `Avatar.SKY_LIGHT` 를 0 으로 두면 둘 다 따라오는가
      //
      // ⚠️⚠️ **위의 밝기만 보면 「3D 가 제 표를 따로 갖는」 사고를 못 본다.** 값이
      //    마침 비슷하면 통과하고, 그러면 WebGL 이 없는 기기에서 **다른 밝기의 방**이
      //    뜬다 (시간대의 «이름»을 한 곳에서 받아 오는 것과 같은 자리다).
      //    표를 억지로 꺾어 **그림이 진짜 따라오는지** 본다
      if (lum.day != null) {
        await goPhase('day');
        const dark = await page.evaluate(async () => {
          const A = window.Avatar, keep = A.SKY_LIGHT.day;
          A.SKY_LIGHT.day = 0;
          room3d.setPhase('night'); room3d.setPhase('day');   // 같은 이름이면 안 다시 잡는다
          room3d.render();
          return keep;
        });
        await setFigure(false);
        const off = meanOf(await shot(lightBox));
        await page.evaluate((keep) => {
          window.Avatar.SKY_LIGHT.day = keep;
          room3d.setPhase('night'); room3d.setPhase('day');
          room3d.render();
        }, dark);
        if (off == null) bad.push('낮과 밤: 표를 꺾은 방을 못 찍었다');
        else if (off > lum.night * TABLE_OBEY)
          bad.push(`3D 방이 «SKY_LIGHT» 를 안 본다 (낮을 0 으로 두어도 ${off.toFixed(3)}`
            + ` · 밤 ${lum.night.toFixed(3)})`);
        else lightOut += ` · 표를 0 으로 두면 ${off.toFixed(3)}`;
      }

      // SVG 폴백도 같은 표를 읽는가 — 볕(`beamG`)의 알파가 따라 내려가는가
      const svg = await page.evaluate(() => {
        const A = window.Avatar;
        const pick = (s) => {
          const m = /rgba\(255,240,190,([\d.]+)\)/.exec(s);
          return m ? Number(m[1]) : null;
        };
        const keep = A.SKY_LIGHT.day;
        const on = pick(A.roomScene(5, null, 0, 0));
        A.SKY_LIGHT.day = 0;
        const off = pick(A.roomScene(5, null, 0, 0));
        A.SKY_LIGHT.day = keep;
        return { on, off };
      });
      if (svg.on == null || svg.off == null) bad.push('낮과 밤: SVG 방의 볕을 못 읽었다');
      else if (!(svg.on > svg.off))
        bad.push(`SVG 방이 «SKY_LIGHT» 를 안 본다 (볕 ${svg.on} → ${svg.off})`);
      else lightOut += ` · SVG 볕 ${svg.on.toFixed(2)} → ${svg.off.toFixed(2)}`;

      // 시계를 되돌린다 — 뒤에 오는 것이 옮겨 놓은 시계를 물려받지 않게
      await page.evaluate(() => { S.devClock = 0; setDevClock(0); render(); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { room3d.run(false); room3d.render(); });
    }

    out.push(`${W}px 양탄자 ${rug.w}px · 발 ${dFoot == null ? '?' : dFoot.toFixed(1)}px`
      + ` · SVG 와 폭 ${dW == null ? '?' : dW.toFixed(1)} · 앞자락 ${dB == null ? '?' : dB.toFixed(1)}`
      + ` · 머리 뒤 벽 ${(share * 100).toFixed(0)}%`
      + ` · 둘러보기 ${spun ? `${(spun.yaw * 180 / Math.PI).toFixed(0)}° 에서 발 ${spun.d.toFixed(1)}px`
        + ` · 양탄자 ${spun.dHalf.toFixed(1)}px · 그림 ${(spun.mShare * 100).toFixed(0)}% 달라짐` : '?'}`
      + ` · 광원 ${still.n}개가 ${still.shots || 0}프레임 동안 가만히 있고 빛만 흔들린다`
      + ` · 빛무리 ${glowOut.length ? glowOut.join(' · ') : '?'}`
      + ` · 둘러보기↔방 버튼 ${spinGap || '?'}`
      + (lightOut ? ` · 방 밝기 ${lightOut}` : ''));
    await page.close();
  }

  // ═══ 단계가 «주는» 선물 — 퀘스트를 깨면 소품이 들어오고 «놓인다» ═══
  //
  // ⚠️⚠️ **위의 픽셀 검사는 이것을 영영 못 본다** — 거기서는 소품을 손으로 심어 놓고
  //    자리를 재기 때문이다. 「얻는 길이 진짜로 있는가」는 **보상을 받아 봐야** 안다:
  //    선물이 안 들어오면 첫 단계 아홉은 상점에도 없으니 **영영 못 얻는 소품**이 되고,
  //    들어와도 안 놓이면 방이 그대로라 「받았는데 아무 일도 안 일어났다」가 된다.
  // ⚠️ `claimQuest()` 를 그대로 부른다 — 보상 줄을 손으로 흉내 내면 그 줄을 지워도 통과한다
  let gift = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 1 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof claimQuest === 'function');
    const r = await page.evaluate(() => {
      const D = window.GameData;
      // 공방 단계를 주는 퀘스트를 «표에서» 고른다 — id 를 박으면 표를 고쳤을 때 안 따라온다
      const qs = (D.QUESTS || []).filter(q => (q.reward || {}).room)
        .sort((a, b) => a.reward.room - b.reward.room);
      if (!qs.length) return { err: '공방 단계를 주는 퀘스트가 하나도 없다' };
      const got = [], placed = [], lv = [];
      // ⚠️⚠️ **완료 컷씬을 «본 것»으로 해 둔다.** `claimQuest()` 는 못 본 컷씬이 있으면
      //    그것부터 틀고 «되돌아간다»(`claiming`) — 그대로 부르면 한 걸음도 안 나간다
      S.seenCuts = (S.seenCuts || []).concat(qs.map(q => q.cut && q.cut.out).filter(Boolean));
      for (const q of qs) {
        S.quest = { active: q.id, n: q.goal.n, done: S.quest.done || [], queue: [],
          devFull: q.id };                     // 진행도를 다 채운 것으로 친다
        claimQuest();
        lv.push(S.roomLevel);
      }
      // 1 → 5 를 다 지났으면 선물이 «다» 들어와 있어야 한다
      Object.keys(D.ROOM_LEVEL_GIFT).forEach(n => {
        (D.ROOM_LEVEL_GIFT[n] || []).forEach(id => {
          if ((S.roomOwned || []).includes(id)) got.push(id);
          const d = D.ROOM_DECOR[id];
          if (d && (S.roomProps || {})[d.slot]) placed.push(id);
        });
      });
      const want = Object.keys(D.ROOM_LEVEL_GIFT).flatMap(n => D.ROOM_LEVEL_GIFT[n]);
      return { lv, got: got.length, placed: placed.length, want: want.length,
        slots: Object.keys(S.roomProps || {}).length, room: S.roomLevel };
    });
    if (r.err) bad.push(r.err);
    else {
      if (r.got !== r.want) bad.push(`단계 선물이 ${r.got}/${r.want} 만 들어왔다 (단계 ${r.lv.join('→')})`);
      // ⚠️ **놓이기까지 해야 한다** — 얻어도 안 놓이면 방은 그대로 비어 있다
      if (r.placed !== r.want) bad.push(`선물이 ${r.placed}/${r.want} 만 놓였다`);
      if (r.room !== 5) bad.push(`공방이 ${r.room}단계에서 멈췄다 (5까지 가야 한다)`);
      gift = `단계 선물 ${r.got}/${r.want} 개가 들어와 자리 ${r.slots}곳에 놓였다 (단계 ${r.lv.join('→')})`;
    }
    await page.close();
  }

  await browser.close();
  console.log('3D 방 — ' + out.join(' | '));
  if (gift) console.log('  ' + gift);
  console.log(`  (발 ${FOOT_MAX}px · SVG 와 ${SVG_MAX}px · 머리 뒤 벽 ${WALL_MIN * 100}% 까지 · 폭 셋을 다 쟀다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  if (out.length !== 3) { console.log(`❌ 세 폭 중 ${out.length}개만 쟀다`); process.exit(1); }
  console.log('✅ 3D 방이 SVG 와 같은 자리에 서고 인물이 그 양탄자 위에 있다');
})().catch(e => { console.error(e); process.exit(1); });
