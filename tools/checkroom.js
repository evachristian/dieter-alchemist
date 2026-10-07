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
// 밤의 등불이 더하는 몫이 «낮 세기의 등불»보다 이 배는 돼야 한다 (⑨).
// ⚠️ **사보타주를 돌려 보고 고른 값이다** — 등불이 시간대를 아예 안 보던 옛 코드가
//    **1.00배**이고 지금이 **1.64~1.68배**라 그 사이다 (짐작으로 적은 문턱은
//    고친 쪽을 잡는다 — 바로 위의 `DAY_NIGHT` 에서 두 번 겪었다)
const LAMP_MORE = 1.35;
// 낮은 표가 1 배라 «표를 꺾어도» 한 픽셀도 안 바뀌어야 한다 (더하는 몫의 차).
// ⚠️⚠️ **이 줄은 문턱에 아슬아슬하게 붙어 있어 가끔 거짓으로 빨개진다.** 촛불이
//    깜박이는 자리에서 멈추므로 판마다 값이 흔들린다 — 2026-10-03 에 같은 트리를
//    세 번씩 재서 **HEAD 가 0.013 · 0.013 · 0.000**, 그 다음 판이 **0.021 · 0.000 ·
//    0.000** 이었다 (즉 **양쪽 다** 넘나든다 — 한쪽만 보고 「내 변경 탓」으로 읽지 말 것).
//    고치려면 문턱을 올리는 것이 아니라 **재기 전에 깜박임을 멈춰 놓아야** 한다
const LAMP_FLAT = 0.02;
// 밤에 소품을 다시 놓아도 등불이 이만큼은 그대로여야 한다 (`putUnit` 이 세기를 타는가)
const LAMP_REPUT = 0.9;

// 「달라진 점이 한 줄에 30px 넘게 이어진 곳」만 양탄자로 친다.
// ⚠️ 문턱을 0.02 로 두면 **그림자가 번진 몫까지** 잡혀 방 전체가 양탄자가 된다
//    (265px 에서 264px 짜리 「양탄자」가 나왔다)
const DIFF = 0.06, RUN = 30;
const SPIN_DIFF = 0.012;   // 둘러보기는 «같은 벽이 미끄러지는» 것이라 차이가 작다

// 크리처가 «선 자리». 문턱 둘 다 **사보타주를 돌리고 나서** 골랐다 —
// `placePetY()` 를 빼면 땅 22.3~23.9px · 어항 13.6~15.2px 이 뜬다 (지금 1.1~1.5 · 0.0~0.1).
// ⚠️ 땅이 0 이 아닌 이유는 그림의 약속이다 — 발밑 그림자의 가운데가 발(`GROUND`)보다
//    2칸 아래다. 그 2칸이 76px 상자에서 1.5px 이라 4px 이면 여유가 넉넉하다

// 발밑 그림자가 바닥을 «얼마나» 어둡게 하는가 (0~1 휘도).
// ⚠️ **재서 골랐다** — 옛 한 겹(털색)이 **0.018** 이고 지금 세 겹이 **0.102** 라,
//    그 사이에서 옛 그림을 확실히 가르는 자리다. 잣대를 결과에 맞춘 값이 아니다
const PET_SHADE_MIN = 0.05;
const PET_FOOT = 4;       // px. 땅·어항이 바닥에서 이만큼 안으로 들어와야 한다
const PET_AIR_MIN = 20;   // px. 공중 크리처는 적어도 이만큼 떠 있어야 한다 (지금 126~150)
// 공중 크리처의 가운데가 «그려진 어깨선»에서 이만큼 안에 와야 한다 (2026-10-06 ·
// 「공중 크리처는 캐릭터의 어깨쯤 위치에 둥둥 떠 있었으면 좋겠어」).
// ⚠️ **사보타주를 돌려 보고 고른 값이다** — 옛 자리(바닥에서 아우라 높이의 15.6%)가
//    **83~149px 아래**이고 지금이 **−0.1~1.8px** 라 그 사이다. 상자 가운데(50%)와
//    맞추는 줄(`Creature.AIR_MID` 46.25%)이 3.75% 다르므로 몇 px 은 늘 남는다
const PET_SHOULDER = 10;
const PET_W = [265, 390, 480];
// 「크리처가 가려지는가」 — 왼쪽 버튼 줄(🪄 방꾸 · 😯 표정 · ⚜️ 문신)과 같은 바닥을 쓴다
const HIDE_W = [265, 320, 390, 480];
const HIDE_SPIN_GAP = 3;  // px. 줄이 올라가도 둘러보기 버튼과 이만큼은 떨어진다
// 크리처가 «이만큼은» 커야 한다 — 폭 × 땅·공중·어항.
// ⚠️⚠️ **이 표가 없으면 크리처를 반으로 줄여 놓아도 한 줄도 안 걸린다.** 가림 검사는
//    「버튼에 덮였는가」만 보므로 **작아서 안 덮이는 것**이 제일 쉬운 통과 길이다 —
//    실제로 2026-10-04 까지 그랬고, 그래서 390px 의 크리처가 빈 바닥의 절반(46.6px)만
//    쓰고 있는 것을 아무도 못 봤다 (「크리처가 너무 작아」로 신고받았다).
// ⚠️⚠️ **값은 «재서» 적었다**(졸업 직후 몸 · 잰 값에서 2~4px 내린 것). 「얼마가 예쁜가」가
//    아니라 **「그 폭에서 바닥이 허락하는 만큼」**이고, 폭마다 다른 것은 바닥이 다르기
//    때문이다 — 265·320px 은 치마와 방 끝 사이가 22·50px 밖에 안 남고, 공중은 떠 있어서
//    버튼 줄의 띠를 피하느라 더 작다 (까닭은 CLAUDE.md 에 적어 뒀다).
// ⚠️ **낮추려면 「왜 작아져야 하는가」를 먼저 적는다** — 그냥 내리면 잣대를 결과에
//    맞추는 것이고, 이 표가 막는 바로 그 사고가 조용히 돌아온다
// ⚠️⚠️ **2026-10-06 에 «사람이» 내렸다** — 「크리처가 버튼에 가려져. 크기 30% 정도
//    줄이고, 캐릭터 근처로 조금 이동시켜 줘」. 10-04 에 두 배로 키운 그 값을 거기서
//    30% 되돌린 것이고(`PET_MAX` 92 → 62), **넓은 폭만 움직인다** — 265·320px 은
//    상한이 아니라 **바닥**이 묶으므로 한 픽셀도 안 바뀐다(24 · 52).
//    ⚠️ 이 표를 내리는 것은 **그 자체로는 못 할 일**이다. 신고가 「작아졌다」로 오면
//    위의 10-04 기록을 먼저 읽을 것 — 그때 묶고 있던 것은 상한이 아니라 버튼 줄이었다
// ⚠️⚠️ **2026-10-06 에 공중이 «올라갔다»** — 어깨로 올라가면서 버튼 줄의 띠를
//    벗어나 바닥이 넓어졌다(320px 33 → 51.6 · 390px 48.6 → 62). **값이 커지는 쪽은
//    그대로 올려 적는다** — 올리는 것은 빗장을 조이는 것이라 위의 경고에 안 걸린다.
// ⚠️ `airF`·`groundF` 는 **오른쪽에 서는 마리**다 (`Creature.FACE` · 지금 열둘 —
//    공중 둘이 `airF`(🔥 불꽃 나비 · ✨ 반짝 나비) 고 나머지 열이 `groundF` 다:
//    화염 여우 · 모래 꼬북 · 뿌리뿔 사슴 · 민트 버니 · 하늘 냥이 · 회오리 오리 ·
//    햇살 병아리 · 밤안개 여우 · 보라 볏 괭이 · 물방울 곰돌).
//    그 마리는 인물의 반대쪽에 서므로 **바닥이 다르다** — 390px 에서 오른쪽 버튼 줄
//    다섯이 띠를 먹어 48.6px 이다 (왼쪽은 62px). 한 칸에 몰아 적으면 둘 중 작은 쪽이
//    기준이 되어 **큰 쪽이 반으로 줄어도 안 걸린다**
// ⚠️ `groundF` 는 **재서** 적었다 (24.1 · 51.6 · 48.6 · 62 에서 2~4px 내린 값이다)
// ⚠️⚠️ **2026-10-07에 «물»이 올라갔다** — 「어항에 들어간 크리처가 잘 안보인다.
//    어항 크기 2배로 늘려주고」로 받아 `PET_MAX_WATER` 를 78 → 156 으로 올렸다.
//    ⚠️ **상한은 아무 데서도 안 묶는다 — 묶는 것은 «빈 바닥»이다.** 상한을 400 으로
//    들어 놓고 재면 265px 24.1 · 320px 51.6 · 390px 86.6 · 480px 이상 131.6 이라,
//    오른 자리는 **390·480px 둘뿐**이고 좁은 둘은 한 픽셀도 안 바뀐다
//    (10-04 의 「상한만 올려서는 한 폭도 안 커진다」가 그대로다).
//    **값이 커지는 쪽은 그대로 올려 적는다** — 빗장을 조이는 것이라 위의 경고에 안 걸린다
//    ⚠️⚠️ **값은 «이 검사기가 재는 조건»에서 뽑는다.** 따로 쓴 스크립트로 재면
//    86.6 · 131.6 이 나오는데 여기서는 **81.3 · 93.6** 이다 — 창 높이가 달라 방 상자가
//    작고 그만큼 빈 바닥이 좁다. 그 수치를 그대로 옮겨 적었다가 **멀쩡한 화면이
//    4건**으로 걸렸다 (「잣대가 둘이면 하나는 틀린 것이다」 · 2~4px 내린 값을 적는다)
const PET_WANT = {
  265: { ground: 22, air: 22, airF: 22, groundF: 22, water: 22 },
  320: { ground: 50, air: 48, airF: 48, groundF: 48, water: 50 },
  390: { ground: 60, air: 60, airF: 46, groundF: 46, water: 79 },
  480: { ground: 60, air: 60, airF: 60, groundF: 60, water: 91 },
};

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
    // ⚠️⚠️ **SMIL 은 `document.getAnimations()` 에 안 잡힌다** — 애교 모션(`petidle.js`)이
    //    크리처 위에서 도는데, 그것을 안 멈추면 **두 장 사이에 크리처가 기울어** 그 몫이
    //    diff 에 섞인다 (방의 밝기·발밑 그림자처럼 「껐다 켜서 달라지는 몫」을 재는
    //    자리가 통째로 흔들린다). `svg.pauseAnimations()` 는 그 시계를 따로 멈춘다 —
    //    **`setCurrentTime(0)` 으로 «쉬는 자세»에 못 박아** 매 판 같은 그림을 재게 한다
    const freeze = () => page.evaluate(() => {
      document.querySelectorAll('svg').forEach(s => {
        try { s.pauseAnimations(); s.setCurrentTime(0); } catch (e) {}
      });
    });
    const shot = async (c) => {
      await freeze();
      return pngLumGrid(await page.screenshot({ clip: c || box }));
    };
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
      //
      // ⚠️⚠️ **「양쪽 끝까지 눌러 보고 절반 돌아오기」로는 가운데에 안 선다.**
      //    한 걸음이 `YAW_STEP`(0.20)이고 한계가 `YAW_MAX`(0.40)라 **두 걸음이면 끝**인데
      //    `-1` 열두 번 · `+1` 열두 번 · `-1` 여섯 번은 끝에서 끝으로 간 다음 다시
      //    **반대쪽 끝에 붙는다**(가운데가 아니다). 게다가 끝에서 끝까지 가는 데 드는
      //    시간이 고정 700ms 보다 길어서 **어떤 판은 도중에 섰다** — 그래서 뒤의
      //    ⑧ 「방 밝기」가 «그때그때 다르게 돌아간 방»을 재어 밤이 **0.115 ↔ 0.178** 로
      //    널뛰었다 (HEAD 에서도 두 번에 한 번쯤 「초저녁이 밤과 달라졌다」로 빨개졌다).
      // ⚠️ 걸음 수를 세지 않는다 — **`spinAt()` 이 말하는 목표를 0 으로 몰고**,
      //    고정 시간이 아니라 **진짜로 도착했는지를 기다린다** (한계·걸음을 고쳐도 따라온다)
      await page.evaluate(async () => {
        for (let i = 0; i < 24; i++) {
          const a = room3d.spinAt();
          if (Math.abs(a.to) < 1e-6) break;
          spinRoom(a.to > 0 ? -1 : 1);
        }
        for (let i = 0; i < 80; i++) {
          const a = room3d.spinAt();
          if (Math.abs(a.to) < 1e-6 && Math.abs(a.yaw - a.to) < 1e-4) break;
          await new Promise(r => setTimeout(r, 50));
        }
      });
      const back = await page.evaluate(() => room3d.spinAt());
      if (Math.abs(back.yaw) > 1e-3) {
        bad.push(`${W}px: 둘러보기를 가운데로 못 되돌렸다 (yaw ${back.yaw.toFixed(3)})`
          + ` — 뒤의 「방 밝기」가 돌아간 방을 잰다`);
      }
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
        // ⚠️ **여덟을 다 연다** — 2026-10-02 에 왼쪽 줄 셋(🪄 😯 ⚜️)도 조건이 걸렸다.
        //    다섯만 켜면 왼쪽 줄이 비어 **왼쪽 버튼과의 겹침을 한 번도 안 재게 된다**
        S.roomActs = ['exercise', 'binge', 'kitchen', 'produce', 'farm',
                      'expression', 'decor', 'tattoo'];   // 개발용 스위치
        render();
        const box = (el) => { const q = el.getBoundingClientRect();
          return { t: (el.textContent || el.getAttribute('aria-label') || '')
              .replace(/\s+/g, ' ').trim().slice(0, 12),
            x: q.left, r: q.right, y: q.top, b: q.bottom }; };
        const shown = (sel) => [...document.querySelectorAll(sel)]
          .filter(e => e.offsetParent !== null).map(box);
        // 겹침은 «양쪽 줄»을 다 본다 (왼쪽의 🪄 방꾸 · 😯 표정 · ⚜️ 문신도 같은 그림 위다).
        // 「다 열렸는가」도 **양쪽을 따로** 센다 — 2026-10-02 부터 왼쪽 셋도 하나씩
        // 열리므로, 한쪽만 세면 다른 쪽이 통째로 비어도 이 빗장이 지나간다
        const spin = shown('.spin-btn'), acts = shown('.room-act');
        const right = shown('.room-acts:not(.room-acts-l) .room-act').length;
        const left = shown('.room-acts-l .room-act').length;
        // ⚠️⚠️ **위쪽 이웃은 이제 «제목 줄»이다** (2026-10-02). 예전에는 시계가 방 그림
        //    왼쪽 위에 얹혀 있어서 그것과의 틈을 쟀는데, 시계가 제목 줄로 올라가면서
        //    **가로로 겹치는 짝이 하나도 없어져 `시계와 ?px` 로 아무것도 안 쟀다** —
        //    0건이 「통과」가 아니라 「한 번도 안 쟀다」가 된 그 자리다.
        //    둘러보기 버튼을 위로 더 붙이다 제목 줄을 파고들면 그것은 겹침을
        //    «옮긴» 것이지 고친 것이 아니므로, 이웃을 바꿔 그대로 잰다
        const clock = document.querySelector('.room-head');
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
        return { n: spin.length, acts: right, left, hit, gap, gapWith, cGap };
      }, lang);
      if (!g.n) { bad.push(`${W}px/${lang}: 둘러보기 버튼이 없다 (겹침을 잴 수가 없다)`); continue; }
      if (g.acts < 5) { bad.push(`${W}px/${lang}: 오른쪽 방 버튼이 ${g.acts}개뿐이다 — 다섯을 다 열어야 잰 것이다`); continue; }
      if (g.left < 3) { bad.push(`${W}px/${lang}: 왼쪽 방 버튼이 ${g.left}개뿐이다 — 셋을 다 열어야 잰 것이다`); continue; }
      if (g.hit.length) bad.push(`${W}px/${lang}: 둘러보기 버튼이 ${[...new Set(g.hit)].join('·')} 와 겹친다`);
      if (g.cGap == null) bad.push(`${W}px/${lang}: 둘러보기 버튼의 «위쪽 이웃»(제목 줄)을 한 번도 못 쟀다`);
      else if (g.cGap < 4) bad.push(`${W}px/${lang}: 둘러보기 버튼이 제목 줄과 ${g.cGap.toFixed(1)}px 밖에 안 떨어졌다`);
      if (lang === 'ko') spinGap = `${g.gap === 1e9 ? '?' : g.gap.toFixed(0)}px(${g.gapWith})`;
      if (lang === 'en') spinGap += ` · en ${g.gap === 1e9 ? '?' : g.gap.toFixed(0)}px`
        + ` · 제목 줄과 ${g.cGap == null ? '?' : g.cGap.toFixed(0)}px`;
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
      // 등불(벽등·촛불·샹들리에)을 통째로 껐다 켠다 — ⑧ 과 ⑨ 가 같이 쓴다.
      //
      // ⚠️⚠️ **다시 그릴 때마다 되살아난다.** `render()` 가 `setDecor`·`setPhase` 를
      //    지나며 세기를 도로 잡으므로 **찍기 직전마다** 불러야 한다
      //    (인물을 「찍기 직전마다」 치우는 것과 같은 자리다)
      // ⚠️ `glow` 를 `false` 로 주면 **빛무리는 끈 채로** 둔다 — 그러면 남는 것이
      //    «비추는 몫»(`PointLight`)뿐이라 그쪽만 따로 잴 수 있다 (아래 ⑨의 세 번째 줄)
      // ⚠️⚠️ **세기를 0 으로 두는 것만으로는 모자란다 — «보임»까지 끈다.**
      //    끄고 찍는 사이에 아무 `render()` 나 한 번 지나가면(저장 디바운스가 3초 뒤에
      //    터지는 것이 그렇다) `setDecor` → `putUnit` 이 **세기를 도로 잡아** 켜진 방을
      //    찍는다 — 같은 코드가 **세 번에 한 번쯤** 「초저녁이 밤과 달라졌다」로
      //    빨개지던 원인이다 (HEAD 에서도 그랬다 · 0.142 ↔ 0.208 로 널뛰었다).
      //    `visible` 은 세기를 잡는 어느 길도 안 건드리므로 그 창이 닫힌다
      const lamps = (on, glow) => page.evaluate(([v, g]) => {
        room3d.parts.LIT.forEach(L => {
          if (L.glow) L.glow.visible = v && g !== false;
          if (v) { if (L.__on != null) L.light.intensity = L.__on; L.light.visible = true; }
          else {
            if (L.light.intensity > 0) L.__on = L.light.intensity;
            L.light.intensity = 0; L.light.visible = false;
          }
        });
        room3d.render();
      }, [on, glow]);
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
      // ⚠️⚠️ **등불을 끄고 잰다 — 여기서 묻는 것은 «햇빛»이다.**
      //    켜 두고 재면 축이 둘 섞인다: 밤에는 등불이 더 세게 타므로(`LAMP_NIGHT`)
      //    밤의 평균이 그만큼 올라가 **낮÷밤이 2.37 → 2.02 로 내려앉았다** —
      //    등불을 밝게 한 것이 「낮이 안 밝다」로 잡히는 꼴이다.
      //    문턱을 낮춰서 맞추면 그건 잣대를 결과에 맞춘 것이라, **잴 수 있는 자리로
      //    옮겼다**: 햇빛은 여기가, 등불은 아래 ⑨ 가 본다 (둘 다 사보타주로 확인했다)
      // ⚠️⚠️ **재는 동안 루프를 «못 돌게» 묶어 둔다.** `goPhase` 가 부르는 `render()` 는
      //    `room3dSync` 를 지나고, 그 끝은 **`room3d.run(true)`** 다 — 그래서 `run(false)`
      //    로 멈춰 놓아도 한 걸음 뒤에 되살아난다. 한 프레임만 돌아도 `frame()` 이
      //    `light.intensity` 를 도로 잡아 **`lamps(false)` 로 꺼 둔 등불이 켜진 채로 찍힌다** —
      //    그것이 ⑧ 「표를 0 으로 두면 0.174(밤 0.142)」 와 ⑨ 「다시 놓으면 +0.001」 로
      //    **네 번에 한 번쯤 거짓으로 빨개지던** 원인이다 (같은 코드가 돌릴 때마다
      //    0.143 ↔ 0.174 · +0.134 ↔ +0.001 로 널뛰었다).
      // ⚠️ 그래서 «멈추는 것»이 아니라 **`run` 자체를 묶는다** — 아래 ⑧·⑨ 가 끝나면 푼다
      await page.evaluate(() => {
        room3d.run(false);
        room3d.__run = room3d.run;
        room3d.run = () => {};
      });
      const lum = {};
      const bands = await page.evaluate(() => window.Avatar.SKY_BANDS.map(b => b.k));
      // ⚠️⚠️ **찍기 «직전»에 한 번 더 못 박는다.** 시간대만 갈아 끼우면 초저녁과 밤은
      //    3D 조명이 «완전히 같은데»(둘 다 `night` · 햇빛 0) 재 보면 0.110 ↔ 0.167 로
      //    **둘이 서로 값을 바꿔 가며** 나왔다 — 찍는 사이에 아무 `render()` 나 한 번
      //    지나가면(저장 디바운스가 3초 뒤에 터지는 것이 그렇다) 숨겨 둔 인물이 도로
      //    서고, 끝이 있는 애니메이션이 도는 중이면 그 프레임까지 섞인다.
      //    `lamps(false)` 를 「찍기 직전마다」 부르는 것과 **같은 자리**다
      const pin = () => page.evaluate(() => {
        document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
        const a = document.querySelector('.char-aura'); if (a) a.style.visibility = 'hidden';
        ['roomSolo', 'roomSpin'].forEach(id => {
          const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; });
      });
      for (const k of bands) {
        await goPhase(k); await lamps(false); await pin(); lum[k] = meanOf(await shot(lightBox));
      }

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
        await lamps(false);
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

      // ── ⑨ 밤에는 «등불이 더 세게 탄다» (2026-09-30)
      //
      // 「밤에는 샹들리에, 벽등, 촛불이 더 밝게 빛나게 해줘」로 받은 자리다. 등불의
      // 세기는 시간대를 **한 번도 안 봤다** — 낮이든 밤이든 `slot.light` 그대로라,
      // 방만 어두워지고 등불은 제자리여서 밤에는 촛불이 «켜진 그림»으로만 서 있었다.
      //
      // ⚠️⚠️ **⑥ 「빛무리」는 이것을 영영 못 본다** — 거기서 보는 것은 「빛무리를 껐다
      //    켜면 밝아지는가」라 **밤낮이 같아도 통과한다.** ⑧ 도 이제 등불을 끄고 재므로
      //    이 축을 보는 줄은 여기뿐이다 (0건이 「통과」가 아닌 그 자리다).
      // ⚠️⚠️ **방의 «절대 밝기»로 재면 안 된다** — 밤은 방이 어두워서 등불이 아무리
      //    세도 낮보다 어둡다. 재는 것은 **「등불이 «더하는» 몫」**이다
      //    (끈 방 ↔ 켠 방의 차) — 그래야 방의 밑밝기와 무관해진다.
      // ⚠️⚠️ **그래도 «밤의 몫 ↔ 낮의 몫»을 바로 견주면 안 된다.** 빛무리는 더하기
      //    합성이라 밝은 낮의 벽 위에서는 중심이 1 에서 잘리고, 그 잘린 몫이 그대로
      //    「낮이 더 세다」로 나온다 (그렇게 짰더니 **멀쩡한 코드가 0.80배로 걸렸다**).
      //    견줄 것은 **같은 밤 안에서 «표를 1 로 꺾은 방»**이다 — 조건이 같아야 잣대가 선다
      let lampOut = '';
      {
        const P = GLOW_PAD * 3;    // ⚠️ 빛무리의 «중심»은 밤낮 다 흰색으로 잘려 못 가른다.
        const near = (g, b, cx, cy) => {         //   갈리는 것은 둘레에 깔리는 «빛웅덩이»다
          const X = cx - b.x, Y = cy - b.y;
          const x0 = Math.max(0, Math.round(X - P)), x1 = Math.min(g.w, Math.round(X + P));
          const y0 = Math.max(0, Math.round(Y - P)), y1 = Math.min(g.h, Math.round(Y + P));
          if (x1 - x0 < 4 || y1 - y0 < 4) return null;
          let s = 0, n = 0;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += g.l[y * g.w + x]; n++; }
          return s / n;
        };
        // 지금 시간대에서 「등불이 더하는 몫」 — 광원마다 재어 평균한다
        const liftNow = async (glow) => {
          const spots = await page.evaluate(() => {
            const R = room3d, rc = R.renderer.domElement.getBoundingClientRect();
            const V = new R.camera.position.constructor();
            return R.parts.LIT.filter(x => x.grp.visible && x.glow).map(({ grp, glow }) => {
              glow.getWorldPosition(V); V.project(R.camera);
              return { id: grp.userData.slot || '광원',
                x: rc.left + (V.x * 0.5 + 0.5) * rc.width, y: rc.top + (-V.y * 0.5 + 0.5) * rc.height };
            });
          });
          await lamps(false, glow); const off = await shot();
          await lamps(true, glow); const on = await shot();
          if (!off || !on) return null;
          let s = 0, n = 0;
          spots.forEach(p => {
            const a = near(off, box, p.x, p.y), b = near(on, box, p.x, p.y);
            if (a == null || b == null) return;        // 상자 밖으로 나간 자리
            s += b - a; n++;
          });
          return n ? { lift: s / n, n } : null;
        };
        // 표를 1 로 꺾어 놓고 같은 것을 잰다 — 그것이 곧 «낮 세기의 등불»이다.
        //
        // ⚠️⚠️ **이것이 「표가 유일한 원본인가」도 같이 본다.** room3d 안에 숫자를 박으면
        //    꺾어도 밤이 안 어두워져 두 값이 같아지고, 그 자리에서 잡힌다
        //    (`SKY_LIGHT` 에서 배운 자리다 — 그러면 SVG 폴백만 옛 밝기로 남는다)
        const flatLift = async (ph) => {
          await page.evaluate((q) => {
            const L = window.Avatar.LAMP_NIGHT;
            window.__lampBak = { lit: L.lit, halo: L.halo };
            L.lit = 1; L.halo = 1;
            room3d.setPhase(q === 'night' ? 'day' : 'night'); room3d.setPhase(q);  // 같은 이름이면 안 다시 잡는다
          }, ph);
          const v = await liftNow();
          await page.evaluate((q) => {
            const L = window.Avatar.LAMP_NIGHT, b = window.__lampBak;
            L.lit = b.lit; L.halo = b.halo;
            room3d.setPhase(q === 'night' ? 'day' : 'night'); room3d.setPhase(q);
          }, ph);
          return v;
        };
        await goPhase('night');
        const nOn = await liftNow(), nFlat = await flatLift('night');
        // ⚠️ **낮도 같이 잰다** — 「낮은 한 픽셀도 안 바뀐다」가 이 고침의 절반이다.
        //    밤만 보면 낮까지 같이 밝혀 놓아도 그대로 통과한다
        await goPhase('day');
        const dOn = await liftNow(), dFlat = await flatLift('day');
        if (!nOn || !nFlat || !dOn || !dFlat) bad.push('밤의 등불: 광원을 한 자리도 못 쟀다');
        else {
          if (nOn.lift < nFlat.lift * LAMP_MORE)
            bad.push(`밤에도 등불이 낮 세기 그대로다 (+${nOn.lift.toFixed(3)}`
              + ` ÷ +${nFlat.lift.toFixed(3)} = ${(nOn.lift / nFlat.lift).toFixed(2)}배 · ${LAMP_MORE}배 기대)`);
          if (Math.abs(dOn.lift - dFlat.lift) > LAMP_FLAT)
            bad.push(`낮의 등불이 달라졌다 (+${dOn.lift.toFixed(3)} ↔ 표를 1 로 두면`
              + ` +${dFlat.lift.toFixed(3)} · 낮은 1 배라 같아야 한다)`);
          lampOut = `밤 +${nOn.lift.toFixed(3)} ↔ 낮 세기 +${nFlat.lift.toFixed(3)}`
            + ` (${nOn.n}곳) · 낮 +${dOn.lift.toFixed(3)} ↔ +${dFlat.lift.toFixed(3)}`;

          // ── 밤에 소품을 «다시 놓아도» 밤 세기인가 (`putUnit`)
          //
          // ⚠️⚠️ **위의 둘은 이것을 영영 못 본다.** 세기를 잡는 자리가 둘이라 그렇다 —
          //    `setPhase` 가 이미 서 있는 등불을 잡고, **새로 놓이는 등불은 `putUnit`** 이
          //    잡는다. 그런데 `setPhase` 는 시간대 «이름이 같으면 그 자리에서 돌아가므로»,
          //    꾸미기 시트에서 소품을 놓으면 그 등불만 **낮 세기로 남는다**
          //    (루프가 돌고 있으면 한 프레임 만에 덮여서 눈에는 안 보인다).
          //    여기서는 루프가 멎어 있으니 그대로 드러난다
          // ⚠️⚠️ **빛무리를 «끄고» 잰다.** `putUnit` 이 잡는 것은 `light.intensity`
          //    하나뿐인데, 빛무리를 켜 두면 그 몫이 훨씬 커서 **묻힌다** — 실제로
          //    사보타주가 **그대로 통과했다**(0.315 → 0.305 · 3% 밖에 안 떨어진다).
          //    빛무리를 끄면 남는 것이 «비추는 몫»뿐이라 그 자리에서 드러난다.
          // ⚠️ **광원 소품을 «다» 다시 놓는다** — 하나만 내렸다 놓으면 나머지 둘이
          //    평균을 받쳐 준다 (그것이 3% 였던 또 다른 이유다)
          await goPhase('night');
          const poolBefore = await liftNow(false);
          await page.evaluate(() => {
            const d = roomDecorState();
            const gone = Object.assign({}, d, { props: Object.assign({}, d.props) });
            ['candle', 'sconce', 'chandelier'].forEach(k => { delete gone.props[k]; });
            room3d.setDecor(gone);      // 내렸다가
            room3d.setDecor(d);         // 같은 자리에 도로 놓는다 — `putUnit` 을 다시 지난다
            room3d.render();
          });
          const poolAfter = await liftNow(false);
          await lamps(true, true);      // 빛무리를 도로 켜 놓는다
          if (!poolBefore || !poolAfter) bad.push('밤의 등불: 다시 놓은 방을 못 쟀다');
          else if (poolAfter.lift < poolBefore.lift * LAMP_REPUT)
            bad.push(`밤에 소품을 다시 놓으면 등불이 낮 세기로 떨어진다`
              + ` (비추는 몫 +${poolBefore.lift.toFixed(3)} → +${poolAfter.lift.toFixed(3)})`);
          else lampOut += ` · 다시 놓아도 비추는 몫 +${poolAfter.lift.toFixed(3)}`;
        }

        // SVG 폴백도 같은 표를 읽는가 — 빛무리의 «반지름»이 밤에 커지는가.
        // ⚠️ 폴백에는 빛의 «모형»이 없어 `PointLight` 에 해당하는 것이 없다 —
        //    그쪽이 받는 손잡이는 이것 하나뿐이다
        const rOf = () => page.evaluate(() => {
          const A = window.Avatar;
          const m = /<circle[^>]*r="([\d.]+)"[^>]*plus-lighter/.exec(
            A.roomScene(5, { props: S.roomProps }, 0, 0));
          return m ? Number(m[1]) : null;
        });
        await goPhase('night'); const rN = await rOf();
        await goPhase('day'); const rD = await rOf();
        const rFlat = await page.evaluate(() => {
          const A = window.Avatar, L = A.LAMP_NIGHT, b = { lit: L.lit, halo: L.halo };
          L.lit = 1; L.halo = 1;
          const m = /<circle[^>]*r="([\d.]+)"[^>]*plus-lighter/.exec(
            A.roomScene(5, { props: S.roomProps }, 0, 0));
          L.lit = b.lit; L.halo = b.halo;
          return m ? Number(m[1]) : null;
        });
        if (rN == null || rD == null || rFlat == null) bad.push('밤의 등불: SVG 빛무리를 못 읽었다');
        else if (!(rN > rD)) bad.push(`SVG 방의 등불이 밤에 안 커진다 (밤 r${rN} · 낮 r${rD})`);
        else if (Math.abs(rFlat - rD) > 0.15)
          bad.push(`SVG 방이 «LAMP_NIGHT» 를 안 본다 (1 로 꺾어도 밤이 r${rFlat} · 낮 r${rD})`);
        else lampOut += ` · SVG 빛무리 r${rD} → r${rN}`;
      }
      if (lampOut) lightOut += ` | 등불 ${lampOut}`;
      // 루프를 도로 풀어 준다 (묶은 채로 두면 뒤에 오는 것이 멎은 방을 본다)
      await page.evaluate(() => { if (room3d.__run) { room3d.run = room3d.__run; delete room3d.__run; } });

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

  // ═══ 크리처가 «선 자리» — 서른 마리 × 세 폭 ═══
  //
  // 「사족 보행하는 화염여우가 아직도 공중에 둥둥 떠 있다」로 신고받은 자리다.
  // 그림이 아니라 **CSS 상수**가 원인이었다 — `.cr-ground { bottom: 6% }` 는 «아우라
  // 상자»의 밑에서 재는 값이라, 그려진 바닥(발밑 그림자)과는 아무 관계가 없다.
  // 지금은 `game.js` 의 `placePetY()` 가 **그려진 것을 재서** 세운다
  // (`placeFigure`·`placePet` 과 같은 규칙이다).
  //
  // ⚠️⚠️ **잣대는 «닿는 줄»끼리 견주는 것이다.** 셋을 헛짚고서야 찾았다:
  //   ① **픽셀 diff 로는 못 잰다** — 아무것도 안 바꾼 두 장도 방 바닥 줄(y400)에서
  //      두 픽셀씩 달라져서, 무엇을 세워도 「발이 400」이 나온다. 한 장으로 잡음
  //      마스크를 떠도 잡음이 «그때그때 다른 자리»라 소용이 없었다
  //   ② **「칠한 제일 아래」도 아니다** — 크리처의 발밑 그림자는 발(`GROUND` 90)보다
  //      5칸 더 내려가 있다(가운데 92 · ry 5). 그걸 바닥과 견주면 멀쩡한 그림이
  //      「5px 가라앉았다」로 나온다
  //   ③ **어항은 상자가 거짓말을 한다** — 물 네모가 `clip-path` 로 잘리는데
  //      `getBoundingClientRect` 는 그것을 모른다. 어항이 바닥에 대는 것은 «받침»이다
  // ⚠️ **`Creature.GROUND`·`BOWL_FLOOR` 를 읽어 되짚지 않는다** — `placePetY()` 가 보는
  //    그 값이라 «스스로 맞는 검사»가 된다. 그림에서 뽑는다 (그림자 타원 · 받침 타원)
  // ⚠️ **air 는 이 검사로 「`placePetY` 가 돌았는가」를 못 가른다** — CSS 의 `bottom: 14%`
  //    와 `AIR_LIFT` 가 «일부러» 같은 자리라서다 (신고받은 것은 ground 뿐이라 공중
  //    크리처의 화면 높이를 그대로 뒀다). 여기서 보는 것은 **공중 크리처가 바닥으로
  //    내려앉지 않았는가**다
  let pet = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    const list = await page.evaluate(() => (window.GameData.RECIPES || [])
      .filter(r => r.result && r.result.kind === 'creature')
      .map(r => ({ id: r.result.id, move: r.result.move })));
    const band = { ground: [], water: [], air: [] };
    const sho = [];     // 공중 크리처의 «가운데 ↔ 그려진 어깨선» 어긋남
    for (const W of PET_W) {
      await page.setViewportSize({ width: W, height: 900 });
      for (const c of list) {
        await page.evaluate((pid) => {
          S.tutorialDone = true; S.introDone = true; S.roomLevel = 5;
          S.creatures = [pid]; S.petRoom = pid; switchTab('showcase'); render();
        }, c.id);
        await page.waitForTimeout(220);
        const m = await page.evaluate(() => {
          document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
          const cre = document.querySelector('.stage-creature');
          const av = document.querySelector('.char-body svg.avatar-svg > ellipse');
          if (!cre || !av) return null;
          const ar = av.getBoundingClientRect();
          if (!ar.height) return null;
          const floor = ar.top + ar.height / 2;          // 아바타가 선 바닥 (그림자 가운데)
          // 그려진 어깨선 — 공중 크리처가 여기에 맞춰 떠야 한다 (`placePetY`)
          const tor = document.querySelector('.char-body svg.avatar-svg [data-part="torso"]');
          const tr = tor && tor.getBoundingClientRect();
          const cb = cre.getBoundingClientRect();
          const sho = (tr && tr.height && cb.height)
            ? +(((cb.top + cb.bottom) / 2) - tr.top).toFixed(1) : null;
          let touch = null;
          if (cre.classList.contains('cr-water')) {
            cre.querySelectorAll('.cr-bowl ellipse').forEach(n => {
              if ((n.getAttribute('fill') || '') !== '#b9a48f') return;   // 어항 받침
              const r = n.getBoundingClientRect();
              if (touch == null || r.bottom > touch) touch = r.bottom;
            });
          } else {
            // ⚠️⚠️ **`opacity="0.16"` 으로 집지 않는다 — «값»은 그림의 사정이다.**
            //    오래 그렇게 돼 있었고, 2026-10-06 에 그림자를 세 겹으로 고치자
            //    **스무 줄이 통째로 «닿는 줄을 못 찾았다»가 될 뻔했다.**
            //    `data-part="shade"` 는 「여기가 발밑 그림자다」라고 적어 둔 손잡이라
            //    색도 겹 수도 바뀌어도 따라온다 (「되짚기를 쓰지 않는 잣대」)
            cre.querySelectorAll('[data-part="shade"]').forEach(n => {
              const r = n.getBoundingClientRect();
              const cy = r.top + r.height / 2;
              if (touch == null || cy > touch) touch = cy;
            });
          }
          return touch == null ? { sho } : { d: +(touch - floor).toFixed(1), sho };
        });
        if (!m || m.d == null) { bad.push(`${W}px ${c.id} 의 «닿는 줄»을 못 찾았다`); continue; }
        if (!band[c.move]) { bad.push(`${c.id} 의 move 가 «${c.move}» 다 (ground·air·water 뿐이다)`); continue; }
        band[c.move].push(m.d);
        if (c.move === 'air') {
          if (m.d > -PET_AIR_MIN) bad.push(`${W}px ${c.id}(공중)가 바닥에서 ${(-m.d).toFixed(1)}px 밖에 안 떴다`);
          // ⚠️⚠️ **「바닥에서 떴는가」만으로는 어깨를 못 본다 — 옛 자리도 48px 떠 있었다.**
          //    0건이 「통과」가 아니라 「그 축은 한 번도 안 쟀다」인 그 자리다
          if (m.sho == null) bad.push(`${W}px ${c.id}(공중)의 어깨선을 못 쟀다`);
          else {
            sho.push(m.sho);
            if (Math.abs(m.sho) > PET_SHOULDER) {
              bad.push(`${W}px ${c.id}(공중)가 어깨에서 ${Math.abs(m.sho).toFixed(1)}px`
                + `${m.sho > 0 ? ' 아래' : ' 위'}에 떠 있다`);
            }
          }
        } else if (Math.abs(m.d) > PET_FOOT) {
          bad.push(`${W}px ${c.id}(${c.move})가 바닥에서 ${m.d > 0 ? '가라앉았다' : '떴다'}`
            + ` (${Math.abs(m.d).toFixed(1)}px)`);
        }
      }
    }
    // ⚠️ **몇 마리를 쟀는지 통과할 때도 낸다** — 0건이 「통과」인지 「한 번도 안 쟀다」인지를
    //    가르는 것은 이 수뿐이다 (크리처를 늘리면 저절로 따라온다)
    const rng = (a) => a.length ? `${Math.min(...a).toFixed(1)}~${Math.max(...a).toFixed(1)}px` : '(없다)';
    ['ground', 'water', 'air'].forEach(k => {
      if (!band[k].length) bad.push(`${k} 크리처를 한 마리도 안 쟀다`);
    });
    if (!sho.length) bad.push('공중 크리처의 어깨를 한 번도 안 쟀다');
    pet = `크리처가 선 자리 — 땅 ${rng(band.ground)}(${band.ground.length}) ·`
      + ` 어항 ${rng(band.water)}(${band.water.length}) · 공중 ${rng(band.air)}(${band.air.length})`
      + ` · 공중↔어깨 ${rng(sho)}(${sho.length}) · 폭 ${PET_W.join('·')}`;
    await page.close();
  }

  // ═══ 발밑 그림자가 «보이는가» (`creature.js` 의 `footShade`) ═══
  //
  // 「화염여우가 바닥 위에 둥둥 떠있어」로 **두 번** 신고받은 자리다. 재 보면
  // **자리는 맞았다**(발이 바닥선에서 0.0~1.4px) — 없던 것은 «닿은 자국»이다.
  // 옛 그림자는 `shade(털색, 10)` 한 겹이라 **주황 크리처가 주황 마루 위에서**
  // 바닥을 0.018 밖에 안 어둡게 했다.
  //
  // ⚠️⚠️ **바로 위의 「크리처가 선 자리」는 이것을 영영 못 본다** — 거기서 보는 것은
  //    그림자 타원의 «자리»이고, 그 타원은 **투명해도 상자가 그대로다.** 그림자를
  //    통째로 안 보이게 만들어도 스무 줄이 다 통과한다. 0건이 「통과」가 아니라
  //    **「그 축은 한 번도 안 쟀다」**인 그 자리다 (이 저장소에서 몇 번째인지 세기도 어렵다)
  // ⚠️ **「그림자가 있는가」(요소 수)로 재면 안 된다** — 옛 그림도 타원을 갖고 있었다.
  //    가르는 것은 **바닥이 얼마나 어두워지는가**뿐이라 «껐다 켜서» 잰다
  // ⚠️ **공중은 안 잰다 — 거기는 짙으면 «틀린» 것이다.** 그 타원은 바닥이 아니라
  //    배 밑에 떠 있어서, 짙게 만들면 허공에 원반이 생겨 보이지 않는 받침에 앉은 것이
  //    된다 (그려 보고 갈랐다). 어항은 `noShadow` 라 애초에 안 그린다 —
  //    그래서 **여기서 재는 것은 땅 크리처뿐이고, 몇 마리를 쟀는지를 같이 낸다**
  let petShade = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    // ⚠️⚠️ **시간대를 «낮»에 못 박고 잰다 — 안 그러면 하루에 몇 시간씩 거짓으로 빨개진다.**
    //    여기서 재는 것은 「바닥이 얼마나 어두워지는가」인데 **방의 밝기가 시간대를 타서**
    //    (`Avatar.SKY_LIGHT` · 낮 1 · 노을 0.5) 같은 그림자가 노을에는 절반만 어둡게 한다 —
    //    2026-10-06 16:00 KST 를 넘자 0.066~0.082 → **0.039~0.051** 로 떨어져 스무 줄이
    //    통째로 걸렸다 (HEAD 를 워크트리로 띄워 재도 똑같이 20건이라 원래 있던 자리다).
    //    문턱을 내리는 것은 «잣대를 결과에 맞추는 것»이다 — 측정 조건을 맞춘다
    await page.evaluate(() => {
      const b = window.Avatar.SKY_BANDS.find(x => x.k === 'day');
      const d = new Date();
      const kst = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
      const cur = ((kst.getHours() * 60 + kst.getMinutes()) * 60 + kst.getSeconds()) * 1000;
      let delta = (b.h + 1) * 3600000 - cur;
      if (delta < 0) delta += 86400000;
      S.devClock = delta; setDevClock(delta);
    });
    const ground = await page.evaluate(() => (window.GameData.RECIPES || [])
      .filter(r => r.result && r.result.kind === 'creature' && r.result.move === 'ground')
      .map(r => r.result.id));
    const mean = (b) => { const g = pngLumGrid(b, 1); return g.l.reduce((s, v) => s + v, 0) / g.l.length; };
    const got = [];
    for (const pid of ground) {
      // ⚠️ **졸업 직후 몸으로 잰다** — 크리처가 그때 제일 크고, 사람이 보는 것이 그 화면이다
      await page.evaluate((p) => {
        S.tutorialDone = true; S.introDone = true; S.roomLevel = 5;
        maxTune(); S.creatures = [p]; S.petRoom = p; switchTab('showcase'); render();
      }, pid);
      await page.waitForTimeout(220);
      // 재는 자리 — 그림자가 서는 띠. 몸에 가린 가운데가 아니라 상자를 가로지른다
      // ⚠️⚠️⚠️ **SMIL 은 `document.getAnimations()` 에 «안 잡힌다»** — 애교 모션
      //    (`petidle.js`)이 그 사이에 크리처를 기울이면 그 몫이 그대로 diff 에 섞여,
      //    「그림자를 껐다 켠 차이」가 아니라 「포즈가 달라진 차이」를 재게 된다.
      //    실제로 숯불 말랑이가 0.017~0.071 로 널뛰었고, 같은 트리에서 3건 ↔ 7건이
      //    갈렸다 (안 건드린 마리까지 같이 빨개졌다). 이 파일의 `shot()` 은 이미
      //    `pauseAnimations()` 로 못 박는데 **이 블록만 그 줄을 안 지나고 있었다** —
      //    「측정 조건은 검증기가 스스로 맞춘다」가 여기서 깨져 있던 자리다
      const pin = () => page.evaluate(() => {
        document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
        document.querySelectorAll('svg').forEach(s => {
          try { s.pauseAnimations(); s.setCurrentTime(0); } catch (e) {}
        });
      });
      await pin();
      const clip = await page.evaluate(() => {
        const cre = document.querySelector('.stage-creature');
        if (!cre) return null;
        const r = cre.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: Math.round(r.left + r.width * 0.06), y: Math.round(r.top + r.height * 0.92 - 3),
          width: Math.max(2, Math.round(r.width * 0.88)), height: 7 };
      });
      if (!clip) { bad.push(`${pid} 의 그림자를 잴 자리를 못 찾았다`); continue; }
      const vis = (on) => page.evaluate((o) => {
        const n = document.querySelector('.stage-creature [data-part="shade"]');
        if (n) n.style.visibility = o ? '' : 'hidden';
        return !!n;
      }, on);
      if (!await vis(true)) { bad.push(`${pid} 에 발밑 그림자(data-part="shade")가 없다`); continue; }
      // ⚠️ **찍기 «직전»마다 못 박는다** — 한 번만 멈춰 두면 그 사이에 다시 돌 수 있다
      await pin();
      const on = mean(await page.screenshot({ clip }));
      await vis(false);
      await pin();
      const off = mean(await page.screenshot({ clip }));
      await vis(true);
      const d = off - on;
      got.push(d);
      if (d < PET_SHADE_MIN) {
        bad.push(`${pid} 의 발밑 그림자가 바닥을 ${d.toFixed(3)} 밖에 안 어둡게 한다`
          + ` (${PET_SHADE_MIN} 이상이라야 «닿은 것»으로 읽힌다)`);
      }
    }
    if (!got.length) bad.push('발밑 그림자를 한 마리도 안 쟀다');
    const f3 = (v) => v.toFixed(3);
    petShade = `발밑 그림자 — «낮»에 못 박고 땅 ${got.length}마리가 바닥을`
      + ` ${got.length ? `${f3(Math.min(...got))}~${f3(Math.max(...got))}` : '(없다)'} 어둡게 한다`
      + ` (${PET_SHADE_MIN} 이상)`;
    await page.close();
  }

  // ═══ 크리처가 «버튼에 가려지지» 않는가 (`placePet` 의 빈 바닥 · `liftSolo`) ═══
  //
  // 왼쪽 버튼 줄 셋(🪄 방꾸 · 😯 표정 · ⚜️ 문신)이 2026-10-02 에 들어오면서 크리처와
  // **같은 바닥**을 쓰게 됐다 — 졸업 직후 몸으로 재면 390px 에서 22~35% · 265px 에서
  // 61% 가 덮였고 265px 에서는 통째로 안 보였다 (신고받은 자리다).
  //
  // ⚠️⚠️ **위의 「크리처가 선 자리」는 이것을 영영 못 본다** — 거기서 보는 것은
  //    «닿는 줄»(세로)이라 버튼이 통째로 덮고 있어도 다 통과한다. 0건이 「통과」가
  //    아니라 **「한 번도 안 쟀다」**인 그 자리다.
  // ⚠️⚠️ **졸업 직후 몸(바디파츠 전부 150% · `maxTune`)으로 잰다.** 기본값으로 재면
  //    치마가 좁아 크리처가 덜 밀려서 **사람이 보는 것보다 겹침이 작게** 나온다
  //    (처음에 그렇게 재서 390px 을 6% 로 봤다 — 실제로는 27% 다).
  // ⚠️ **방 버튼 다섯을 다 열어 놓고** 잰다 — 줄이 짧으면 겹칠 자리가 애초에 없다
  //    (「버튼 겹침」에서 배운 자리다).
  // 보는 것 넷 — ① 왼쪽 줄과 안 겹치는가 ② 방 상자 «안»인가 ③ 줄이 올라가도
  // 둘러보기 버튼을 안 무는가 ④ 그런데 왼쪽 줄이 정말 셋 다 서 있는가
  let hide = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    // 땅·공중·어항 한 마리씩 — 셋은 크기도 서는 높이도 달라 같이 봐야 한다.
    // ⚠️⚠️ **«바라보는 쪽이 있는» 마리는 따로 끼운다**(`Creature.FACE`). 그 마리는
    //    인물의 **반대쪽**에 서므로 재야 할 버튼 줄도 방 상자의 끝도 반대다 —
    //    그런데 하필 그것이 제일 앞의 공중 마리라, 안 갈라 두면 **왼쪽에 서는 공중
    //    크리처를 한 번도 안 재게 된다**(그 마리가 오른쪽으로 가 버려서다).
    //    그래서 셋은 **FACE 에 없는 마리**로 고르고, FACE 의 마리를 덧붙인다
    const trio = await page.evaluate(() => {
      const all = (window.GameData.RECIPES || [])
        .filter(r => r.result && r.result.kind === 'creature').map(r => r.result);
      const face = window.Creature.FACE || {};
      const out = ['ground', 'air', 'water'].map(m =>
        all.find(r => r.move === m && !face[r.id])).filter(Boolean)
        .map(r => ({ id: r.id, move: r.move, face: false }));
      Object.keys(face).forEach(id => {
        const r = all.find(x => x.id === id);
        if (r) out.push({ id: r.id, move: r.move, face: true });
      });
      return out;
    });
    if (trio.filter(c => !c.face).length < 3) bad.push('크리처 가림: 땅·공중·어항 크리처가 다 있지 않다');
    if (!trio.some(c => c.face)) bad.push('크리처 가림: 바라보는 쪽이 있는 마리를 한 마리도 안 쟀다');
    let n = 0, minGap = Infinity, minRoom = Infinity, minSpin = Infinity, lifted = 0, maxOver = 0;
    let nRight = 0, nFlip = 0;
    const size = {};   // 폭 → 땅·공중·어항의 «제일 작게 나온» 크기 (두 언어 중)
    for (const lang of ['ko', 'en']) for (const W of HIDE_W) {
      await page.setViewportSize({ width: W, height: 900 });
      for (const c of trio) {
        await page.evaluate(({ pid, lg }) => {
          I18N.setLang(lg);
          S.tutorialDone = true; S.introDone = true; S.roomLevel = 5;
          S.roomActs = ['exercise', 'binge', 'kitchen', 'harvest', 'farm'];
          S.quest = S.quest || {}; S.quest.done = ['q_first', 'q_walk', 'q_sip'];
          maxTune();                                  // ⚠️ 졸업 직후 몸이다
          S.creatures = [pid]; S.petRoom = pid; switchTab('showcase'); render();
        }, { pid: c.id, lg: lang });
        await page.waitForTimeout(240);
        const m = await page.evaluate(() => {
          const cre = document.querySelector('.stage-creature');
          const room = document.querySelector('.room-canvas');
          // ⚠️⚠️ **크리처가 «실제로 선 쪽»의 줄을 잰다.** 왼쪽에 박아 두면 오른쪽에
          //    서는 마리는 그 줄과 멀어서 **무슨 짓을 해도 통과한다**
          const right = !!cre && cre.classList.contains('cr-right');
          const bar = right ? '.room-acts:not(.room-acts-l)' : '#roomSolo';
          const acts = [...document.querySelectorAll(bar + ' .room-act')];
          const spin = [...document.querySelectorAll('.room-canvas .spin-btn')]
            .map(n => n.getBoundingClientRect()).filter(r => r.height);
          if (!cre || !room) return null;
          const c = cre.getBoundingClientRect(), rb = room.getBoundingClientRect();
          if (!c.width || !rb.width) return null;
          // 겹친 넓이와 «제일 가까운 버튼과의 가로 틈»을 같이 낸다
          let over = 0, gap = Infinity;
          acts.forEach(el => {
            const a = el.getBoundingClientRect();
            over += Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left))
                  * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
            // ⚠️ 두 네모 «사이의 거리»다 — 나란히 설 수도, 위아래로 설 수도 있다
            //    (줄이 비켜 주면 뒤쪽이다 · 줌 블록의 같은 자리에 경위를 적어 뒀다)
            const dx = Math.max(a.left - c.right, c.left - a.right, 0);
            const dy = Math.max(a.top - c.bottom, c.top - a.bottom, 0);
            gap = Math.min(gap, Math.hypot(dx, dy));
          });
          const sb = document.getElementById('roomSolo').getBoundingClientRect();
          return { over, area: c.width * c.height, w: c.width, gap: isFinite(gap) ? gap : null,
            acts: acts.length, right, flip: cre.classList.contains('cr-flip'),
            // ⚠️ 방 상자의 «그 쪽» 끝과의 거리다 (쪽이 뒤집히면 여기도 뒤집힌다)
            inRoom: right ? rb.right - c.right : c.left - rb.left,
            // 올린 줄이 둘러보기 버튼을 안 무는가 (안 올렸으면 잴 것이 없다)
            lift: parseFloat(document.getElementById('roomSolo').style.bottom) || 0,
            spinGap: spin.length ? sb.top - Math.max(...spin.map(r => r.bottom)) : null };
        });
        if (!m) { bad.push(`크리처 가림: ${W}px/${lang} ${c.move} — 크리처나 방을 못 찾았다`); continue; }
        const SIDE = m.right ? '오른쪽' : '왼쪽';
        // 그 쪽 줄이 정말 다 서 있는가 — 왼쪽은 셋(방꾸·표정·문신) · 오른쪽은 다섯이다
        if (m.acts < (m.right ? 5 : 3)) {
          bad.push(`크리처 가림: ${W}px/${lang} ${SIDE} 방 버튼이 ${m.acts}개뿐이다`
            + ` — ${m.right ? '다섯' : '셋'}을 다 열어야 잰 것이다`);
          continue;
        }
        n++;
        if (m.right) nRight++;
        if (m.flip) nFlip++;
        // ⚠️⚠️ **바라보는 쪽이 있는 마리는 «인물을 바라봐야» 한다.** 그림이 왼쪽을
        //    보는데 인물의 왼쪽에 세우면 등을 돌린다 — 「나비는 좌측을 보니 인물의
        //    우측 어깨 위에」로 받은 그 줄이다. 좁은 폭에서는 설 자리가 없어 반대쪽에
        //    서는데, **그때는 그림이 뒤집혀야** 같은 약속이 지켜진다.
        //    ⚠️ 「오른쪽에 섰는가」만 보면 좁은 폭에서 **뒤집지 않고 그냥 왼쪽에 서는**
        //    사고를 통째로 못 본다 (둘이 짝이다)
        if (c.face && !m.right && !m.flip) {
          bad.push(`크리처 가림: ${W}px/${lang} ${c.id} 가 바라보는 쪽(${c.face === true ? '좌' : c.face})에`
            + ` 그대로 서서 인물에게 등을 돌렸다 (뒤집지도 않았다)`);
        }
        if (c.face && m.right && m.flip) {
          bad.push(`크리처 가림: ${W}px/${lang} ${c.id} 가 반대쪽에 서 있는데 그림까지 뒤집혔다`);
        }
        maxOver = Math.max(maxOver, m.over);
        if (m.over > 0.5) {
          bad.push(`크리처 가림: ${W}px/${lang} ${c.id}(${c.move})가 ${SIDE} 버튼 줄에`
            + ` ${m.over.toFixed(0)}px² 가려졌다 (${(100 * m.over / m.area).toFixed(0)}%)`);
        }
        if (m.inRoom < -0.5) {
          bad.push(`크리처 가림: ${W}px/${lang} ${c.id}(${c.move})가 방 상자 ${SIDE}으로`
            + ` ${(-m.inRoom).toFixed(1)}px 나갔다`);
        }
        if (m.lift > 0.5) {
          lifted++;
          if (m.spinGap == null) bad.push(`크리처 가림: ${W}px/${lang} 줄을 올려 놓고 둘러보기 버튼을 못 쟀다`);
          else if (m.spinGap < HIDE_SPIN_GAP) {
            bad.push(`크리처 가림: ${W}px/${lang} 올린 버튼 줄이 둘러보기 버튼과`
              + ` ${m.spinGap.toFixed(1)}px 밖에 안 떨어졌다`);
          }
          if (m.spinGap != null) minSpin = Math.min(minSpin, m.spinGap);
        }
        if (m.gap != null) minGap = Math.min(minGap, m.gap);
        minRoom = Math.min(minRoom, m.inRoom);
        // ⑤ **그런데 크리처가 «볼 만큼» 큰가** — 위의 넷은 전부 「안 덮였는가」라
        //    **작으면 작을수록 잘 통과한다**. 두 축이 서로 반대라 짝으로 둔다
        const key = c.move + (c.face ? 'F' : '');
        const want = (PET_WANT[W] || {})[key];
        if (want == null) bad.push(`크리처 가림: ${W}px 의 ${key} 에 바라는 크기가 표에 없다`);
        else if (m.w < want) {
          bad.push(`크리처 가림: ${W}px/${lang} ${c.id}(${key})가 ${m.w.toFixed(1)}px 밖에 안 된다`
            + ` (${want}px 이상)`);
        }
        (size[W] = size[W] || {})[key] = Math.min(size[W][key] ?? Infinity, m.w);
      }
    }
    // ⚠️ **몇 자리를 쟀는지 통과할 때도 낸다** — 0건이 「통과」인지 「한 번도 안 쟀다」인지를
    //    가르는 것은 이 수뿐이다
    const want = HIDE_W.length * 2 * trio.length;
    if (n < want) bad.push(`크리처 가림: ${want}자리 중 ${n}자리만 쟀다`);
    // ⚠️ **오른쪽 줄을 한 번도 안 쟀으면 그 축은 통째로 안 잰 것이다** (0건의 그 함정)
    if (trio.some(c => c.face) && !nRight) {
      bad.push('크리처 가림: 오른쪽에 선 자리가 하나도 없다 — 바라보는 쪽을 한 번도 안 쟀다');
    }
    // ⚠️ 「다 0px²」라고 «우기지» 않는다 — 잰 값을 그대로 낸다 (실패해도 같은 줄이 뜬다)
    hide = `크리처 가림 — ${n}자리(폭 ${HIDE_W.join('·')} × 땅·공중·어항 × 두 언어)`
      + ` 제일 많이 가려진 자리 ${maxOver.toFixed(0)}px²`
      + ` · 버튼과 제일 좁은 틈 ${isFinite(minGap) ? minGap.toFixed(1) + 'px' : '(옆에 안 선다)'}`
      + ` · 방 상자 안으로 ${isFinite(minRoom) ? minRoom.toFixed(1) + 'px' : '?'}`
      + ` · 줄이 비켜 준 자리 ${lifted}`
      + ` · 오른쪽에 선 자리 ${nRight} · 뒤집어 선 자리 ${nFlip}`
      + (isFinite(minSpin) ? ` (둘러보기와 ${minSpin.toFixed(1)}px)` : '')
      // ⚠️ **잰 크기를 통과할 때도 낸다** — 표를 누가 내렸는지가 여기서 바로 보인다
      + ` · 크기 ` + HIDE_W.map(w => `${w}:`
        + ['ground', 'air', 'airF', 'groundF', 'water'].map(mv => (size[w] && size[w][mv] != null
          ? size[w][mv].toFixed(0) : '?')).join('/')).join(' ');
    await page.close();
  }

  // ═══ 서른 마리의 «상자»가 move 마다 하나인가 (위의 가림 검사가 선 전제) ═══
  //
  // 「다른 크리처들도 버튼이랑 안 겹치는지 확인해줘」로 받은 자리다. 재 보니
  // **서른 마리가 다 안 겹치고**, 까닭은 `placePet()` 이 `--pet` 하나로 상자를 잡기
  // 때문이다 — 같은 move 면 **그림이 무엇이든 상자가 같다**(폭 여섯에서 180자리를
  // 재서 확인했다). 그래서 위의 「크리처 가림」이 move 마다 한 마리만 재도 된다.
  //
  // ⚠️⚠️ **그 전제가 깨지면 위의 검사가 «스물일곱 마리를 한 번도 안 재는» 검사가 된다.**
  //    누가 크리처 하나에 다른 크기·비율을 주면(갈아 끼운 그림 · `cr-*` 클래스 추가)
  //    표본으로 안 뽑힌 그 마리만 조용히 버튼 밑으로 들어간다 — 화면에는 오류가 없다.
  //    그래서 **전제 자체를 잰다**: 한 폭에서 서른 마리의 상자를 다 재어 move 마다
  //    하나인지 본다. 다시 그리기만 하므로 5초면 끝난다
  // ⚠️ **겹침을 여기서 또 재지 않는다** — 상자가 같다는 것이 곧 「가림이 같다」이고,
  //    겹침은 위의 검사가 폭 넷 × 두 언어로 이미 본다 (같은 것을 두 번 재면 둘이 갈린다)
  let petBox = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    // ⚠️⚠️ **묶는 열쇠는 `move` «하나»가 아니다 — «바라보는 쪽»도 축이다** (2026-10-06).
    //    바라보는 쪽이 있는 마리는 인물의 반대쪽에 서고, 그 쪽에는 방 버튼 다섯이
    //    있어서 **바닥이 달라 상자도 다르다**(390px 에서 48.6 ↔ 62). 그것을 한 열쇠에
    //    묶으면 멀쩡한 그림이 「전제가 깨졌다」로 잡히고, 반대로 쪽을 아예 안 보면
    //    위의 「크리처 가림」이 그 마리를 표본에서 빠뜨린 것을 못 본다
    const all = await page.evaluate(() => {
      const face = window.Creature.FACE || {};
      return (window.GameData.RECIPES || [])
        .filter(r => r.result && r.result.kind === 'creature')
        .map(r => ({ id: r.result.id, move: r.result.move,
          key: r.result.move + (face[r.result.id] ? 'F' : '') }));
    });
    const seen = {};
    let n = 0;
    for (const c of all) {
      await page.evaluate((pid) => {
        S.tutorialDone = true; S.introDone = true; S.roomLevel = 5;
        S.roomActs = ['exercise', 'binge', 'kitchen', 'harvest', 'farm'];
        maxTune(); S.creatures = [pid]; S.petRoom = pid; switchTab('showcase'); render();
      }, c.id);
      await page.waitForTimeout(150);
      const b = await page.evaluate(() => {
        const cre = document.querySelector('.stage-creature');
        if (!cre) return null;
        const r = cre.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      });
      if (!b) { bad.push(`크리처 상자: ${c.id} 를 못 찾았다`); continue; }
      n++;
      const key = `${b.w}×${b.h}`;
      if (!seen[c.key]) seen[c.key] = { key, id: c.id, n: 0 };
      else if (seen[c.key].key !== key) {
        bad.push(`크리처 상자: ${c.id}(${c.key})가 ${key} 인데`
          + ` ${seen[c.key].id} 는 ${seen[c.key].key} 다`
          + ` — 갈래마다 상자가 하나라는 전제가 깨지면 「크리처 가림」이 그 마리를 안 잰다`);
      }
      seen[c.key].n++;
    }
    if (n < all.length) bad.push(`크리처 상자: ${all.length}마리 중 ${n}마리만 쟀다`);
    // ⚠️ 「move 마다 하나다」라고 «우기지» 않는다 — 잰 것만 낸다 (실패해도 같은 줄이 뜬다)
    petBox = `크리처 상자 — 390px 에서 ${n}마리를 쟀다 ( `
      + Object.keys(seen).sort().map(mv => `${mv} ${seen[mv].n}마리 ${seen[mv].key}`).join(' · ') + ' )';
    await page.close();
  }

  // ═══ «첫 그리기»에서도 안 가려지는가 (`renderShowcase` 의 순서) ═══
  //
  // 「크리처가 버튼에 가려져」로 신고받았는데 **바로 위의 「크리처 가림」은 24자리가
  // 다 0px² 였다.** 까닭은 잣대가 아니라 **재는 길**에 있었다 — 이 파일의 검사는 전부
  // 상태를 심고 `render()` 를 부르므로 **늘 «두 번째 그리기»**를 잰다. 그때는 왼쪽
  // 버튼 줄이 이미 서 있다.
  //
  // 세이브를 읽고 그리는 **첫 그리기**에서는 `renderShowcase()` 가
  // `placePet()` 을 `renderActBadges()`(→ `renderSoloActs()`) «앞»에서 불러서,
  // `#roomSolo` 가 **자식 0 · 높이 0** 인 채로 재진다 — 크리처가 바닥이 통째로
  // 빈 줄 알고 끝까지 커지고, 그 위로 버튼이 올라온다. 390px 에서 **3407px²** 였다.
  // 다시 그릴 일이 없으면 **그대로 남는다**(2.5초 뒤에도 같았다).
  //
  // ⚠️⚠️ **여기서는 아무것도 다시 안 그린다.** `maxTune()` 도 `render()` 도 부르지
  //    않는다 — 한 줄이라도 부르면 그 순간 「두 번째 그리기」가 되어 **이 검사가
  //    재려던 것이 통째로 사라진다**. 그래서 쓸 것은 **세이브뿐**이다
  // ⚠️ **기다렸다 잰다** — 「첫 그리기 뒤에 저절로 낫는가」도 같이 보는 것이라,
  //    바로 재면 「아직 안 그려졌다」와 구별이 안 된다
  let firstDraw = '';
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 704 } });
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify({
        ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5,
        creatures: ['flame_fox'], petRoom: 'flame_fox',
        roomActs: ['exercise', 'binge', 'kitchen', 'harvest', 'farm'],
        quest: { done: ['q_first', 'q_walk', 'q_sip'], active: null, n: 0, queue: [] },
      }));
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
      const cre = document.querySelector('.stage-creature');
      const solo = document.getElementById('roomSolo');
      if (!cre || !solo) return null;
      const c = cre.getBoundingClientRect(), s = solo.getBoundingClientRect();
      const ox = Math.max(0, Math.min(c.right, s.right) - Math.max(c.left, s.left));
      const oy = Math.max(0, Math.min(c.bottom, s.bottom) - Math.max(c.top, s.top));
      return { over: +(ox * oy).toFixed(0), w: +c.width.toFixed(1), acts: solo.children.length };
    });
    if (!m) bad.push('첫 그리기: 크리처나 왼쪽 버튼 줄을 못 찾았다');
    else {
      // ⚠️ **버튼 줄이 정말 서 있는지부터 본다** — 줄이 비어 있으면 「안 겹쳤다」가
      //    늘 참이라, 고치기 «전»의 코드까지 그대로 통과한다
      if (m.acts < 3) bad.push(`첫 그리기: 왼쪽 방 버튼이 ${m.acts}개뿐이다 — 셋이 다 서야 잰 것이다`);
      if (m.over > 0) {
        bad.push(`첫 그리기: 크리처가 왼쪽 버튼 줄에 ${m.over}px² 가려졌다`
          + ` (크리처 ${m.w.toFixed(1)}px · 다시 안 그리면 그대로 남는다)`);
      }
      firstDraw = `첫 그리기 — 390×704 에서 부팅만 하고 쟀다 (다시 안 그린다) ·`
        + ` 크리처 ${m.w.toFixed(1)}px · 버튼 ${m.acts}개와 ${m.over}px²`;
    }
    await page.close();
  }

  // ═══ 터치 기기에서는 «쓸어서» 돈다 (`roomSwipe*` · `room3d.spinDrag`) ═══
  //
  // ⚠️⚠️ **버튼을 누르는 것으로는 이 층을 한 줄도 못 잰다** — 위의 ④ 는 `spinRoom()` 을
  //    부르므로 손가락 쪽 배선이 통째로 끊겨도 통과한다.
  // ⚠️⚠️ **진짜 터치로 쓴다** (CDP `Input.dispatchTouchEvent`). `page.mouse` 로 끌면
  //    `pointerType` 이 `mouse` 라 **일부러 거르는 갈래**에 걸려 아무 일도 안 일어난다
  //    (`checktut` 이 `el.click()` 을 안 쓰는 것과 같은 이유다).
  // ⚠️ 보는 것이 여섯이고 **서로 반대 방향이 섞여 있다** — 「돈다」만 보면 세로로도
  //    돌아가는 사고를, 「안 돈다」만 보면 배선이 끊긴 것을 못 본다
  let swipe = '';
  // ⚠️⚠️ **라벨 달린 블록이다 — 중간에 빠져나갈 때 `return` 을 쓰면 안 된다.** 이 블록은
  //    함수가 아니라 맨 바깥 async IIFE 안이라, `return` 하면 **보고와 `browser.close()`
  //    까지 통째로 건너뛴다** (터지는 것과 결과가 같다). `break` 로 블록만 빠진다
  swipeGate: {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    await ctx.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.remove();
      S.roomActs = ['exercise', 'binge', 'kitchen', 'harvest', 'farm'];   // 방 버튼을 다 열어 둔다
      switchTab('showcase'); render();
    });
    await page.waitForSelector('.room-scene.is3d', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    const is3d = await page.evaluate(() => !!document.querySelector('.room-scene.is3d'));
    if (!is3d) bad.push('쓸어서 돌리기: 3D 가 안 섰다 — 아무것도 못 쟀다');
    else {
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      const drag = async (x0, y0, dx, dy, steps) => {
        const n = steps || 10;
        await touch('touchStart', x0, y0);
        for (let i = 1; i <= n; i++) {
          await touch('touchMove', x0 + dx * i / n, y0 + dy * i / n);
          await page.waitForTimeout(16);
        }
        await touch('touchEnd', x0 + dx, y0 + dy);
        await page.waitForTimeout(420);
      };
      // ⚠️⚠️ **없으면 «터지지 말고» 알린다.** 쓸기 자체가 없는 트리에서는 가로 끌기가
      //    브라우저의 **뒤로 가기 제스처**로 받아들여져 페이지가 다시 읽히는데, 그때
      //    `room3d` 가 아직 없어서 `room3d.spinAt()` 이 `ReferenceError` 로 터졌다 —
      //    그 한 줄에 **그때까지 잰 모든 것이 사라진다**(사보타주를 돌릴 수가 없다).
      //    이 블록의 모든 `evaluate` 는 없으면 `null` 을 돌려주고, 부르는 쪽이 실패시킨다
      const at = () => page.evaluate(() =>
        (typeof room3d === 'undefined' || !room3d) ? null : room3d.spinAt());
      const mid = () => page.evaluate(() => {
        if (typeof room3d === 'undefined' || !room3d) return null;
        // 가운데로 돌려 놓는다 — 버튼으로 (격자 반올림이 있어야 0 을 밟는다)
        for (let i = 0; i < 24; i++) {
          const a = room3d.spinAt(); if (Math.abs(a.to) < 1e-6) break;
          spinRoom(a.to > 0 ? -1 : 1);
        }
        return room3d.spinAt().to;
      });
      // 「지금 잴 수 있는 상태인가」 — 못 재면 그 자리에서 실패시키고 돌아간다
      const live = async (what) => {
        const a = await at();
        if (a) return a;
        bad.push(`쓸어서 돌리기: ${what} — 방이 사라졌다 (아무것도 안 쟀다)`);
        return null;
      };
      const box = await page.evaluate(() => {
        const r = document.querySelector('.room-canvas').getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      const cx = box.x + box.w / 2, cy = box.y + box.h * 0.35;

      // ① 가로로 쓸면 돈다 — 그리고 **쓴 만큼** 돈다 (끝까지 튀지 않는다)
      await mid(); await page.waitForTimeout(500);
      await drag(cx, cy, 70, 0);
      const r1 = await live('가로 70px'); if (!r1) break swipeGate;
      const a1 = r1.to;
      if (!(a1 > 0.03)) bad.push(`쓸어서 돌리기: 가로로 70px 쓸어도 안 돈다 (yaw ${a1.toFixed(3)})`);
      if (Math.abs(a1) > 0.399) {
        bad.push(`쓸어서 돌리기: 70px 에 끝까지 튄다 (yaw ${a1.toFixed(3)}) — 쓴 만큼 돌아야 한다`);
      }
      // ② 세로로 쓸면 **안 돌고 페이지가 굴러간다** (끌기를 안 쓰던 그 이유다)
      // ⚠️⚠️ **«똑바로» 세로로 쓸면 아무것도 못 가른다 — 사보타주가 그것을 드러냈다.**
      //    축 고정을 통째로 빼 놓고도 검사가 **통과했다**: dx 가 정확히 0 이라 돌 몫이
      //    없었기 때문이다. 사람의 손가락은 그렇게 안 움직인다 — 세로로 쓸어도 가로로
      //    조금씩 흔들리고, 축 고정이 없으면 **페이지가 굴러가는 동안 방이 같이 돈다.**
      //    그래서 **비스듬히**(가로 40 · 세로 −170) 쓴다 — 축 고정이 있으면 `y` 로
      //    정해져 한 픽셀도 안 돌고, 없으면 40px 만큼(≈0.15) 돈다
      await mid(); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
      const r2a = await live('세로 쓸기 전'); if (!r2a) break swipeGate;
      const b2 = r2a.to;
      await drag(cx, cy, 40, -170, 12);
      const r2b = await live('세로 쓸기 뒤'); if (!r2b) break swipeGate;
      const a2 = r2b.to;
      const sy = await page.evaluate(() => window.scrollY);
      if (Math.abs(a2 - b2) > 1e-6) {
        bad.push(`쓸어서 돌리기: 세로로(비스듬히) 쓸었는데 방이 돌았다`
          + ` (${b2.toFixed(3)} → ${a2.toFixed(3)}) — 페이지가 굴러가는 동안 방이 같이 돈다`);
      }
      if (!(sy > 20)) bad.push(`쓸어서 돌리기: 세로로 쓸었는데 페이지가 안 굴렀다 (scrollY ${sy})`);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
      // ③ 한계를 안 넘는다 (이 방에는 앞벽이 없다)
      // ⚠️⚠️ **손가락을 창 «밖»으로 끌지 않는다.** 900px 을 끌었더니 브라우저가 그것을
      //    **뒤로 가기 제스처**로 받아 페이지를 다시 읽었고, 그 뒤의 `room3d` 가 아직
      //    없어서 검사기가 `ReferenceError` 로 **터졌다** — 그때까지 잰 것이 통째로
      //    사라진다 (「크래시는 무엇이 틀렸나를 안 알려 준다」). 상자 안에서 끝에서
      //    끝까지 끌면 `SWIPE_SPAN`(0.6)의 1.6배라 한계를 넘기에 충분하다
      await mid(); await page.waitForTimeout(500);
      await drag(box.x + 12, cy, box.w - 24, 0, 20);
      const a3 = await live('끝까지 쓸기'); if (!a3) break swipeGate;
      if (Math.abs(a3.to) > a3.max + 1e-6) {
        bad.push(`쓸어서 돌리기: 한계를 넘었다 (${a3.to.toFixed(3)} > ${a3.max})`);
      }
      // ④ 끌기 «뒤»에도 버튼이 가운데를 밟는다 (`yawGrid` 가 없으면 영영 못 선다)
      await mid(); await page.waitForTimeout(400);
      await drag(cx, cy, 55, 0);
      const r4 = await live('격자 밖에 세우기'); if (!r4) break swipeGate;
      const off = r4.to;
      const home = await mid();
      await page.waitForTimeout(400);
      if (Math.abs(home) > 1e-6) {
        bad.push(`쓸어서 돌리기: 격자 밖(${off.toFixed(3)})에서 버튼이 가운데를 못 밟는다`
          + ` (${home.toFixed(3)})`);
      }
      // ⑤ **방 버튼 위에서 시작한 손가락은 그 버튼의 것이다** (방 그림 위에 얹혀 있다)
      await mid(); await page.waitForTimeout(400);
      const btn = await page.evaluate(() => {
        const b = document.querySelector('#roomActs .room-act') || document.querySelector('.room-act');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (!btn) bad.push('쓸어서 돌리기: 방 버튼을 못 찾았다 — ⑤ 를 한 번도 안 쟀다');
      else {
        const r5a = await live('방 버튼 전'); if (!r5a) break swipeGate;
        const b5 = r5a.to;
        await drag(btn.x, btn.y, 80, 0);
        const r5b = await live('방 버튼 뒤'); if (!r5b) break swipeGate;
        const a5 = r5b.to;
        if (Math.abs(a5 - b5) > 1e-6) {
          bad.push(`쓸어서 돌리기: 방 버튼 위에서 쓸었는데 방이 돌았다`
            + ` (${b5.toFixed(3)} → ${a5.toFixed(3)})`);
        }
      }
      // ⑥ **마우스로는 안 돈다** — 데스크톱에는 버튼이 있고, 드래그는 평소 동작의 것이다
      await mid(); await page.waitForTimeout(400);
      const r6a = await live('마우스 전'); if (!r6a) break swipeGate;
      const b6 = r6a.to;
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + i * 12, cy); await page.waitForTimeout(16); }
      await page.mouse.up(); await page.waitForTimeout(300);
      const r6b = await live('마우스 뒤'); if (!r6b) break swipeGate;
      const a6 = r6b.to;
      if (Math.abs(a6 - b6) > 1e-6) {
        bad.push(`쓸어서 돌리기: 마우스로 끌었는데 방이 돌았다 (${b6.toFixed(3)} → ${a6.toFixed(3)})`);
      }
      swipe = `쓸어서 돌리기 — 가로 70px→${a1.toFixed(3)} · 비스듬한 세로는 안 돌고 페이지가 ${sy}px`
        + ` · 상자 끝에서 끝까지 쓸어도 한계 ${a3.max} 안(${a3.to.toFixed(3)})`
        + ` · 격자 밖 ${off.toFixed(3)} 에서 버튼이 가운데로 · 방 버튼·마우스는 안 돈다 (6가지)`;
    }
    await ctx.close();
  }

  // ═══ 두 손가락으로 «줌» (`roomSwipe*` 의 핀치 갈래 · `room3d.setZoom`) ═══
  //
  // ⚠️⚠️ **`setZoom()` 을 직접 불러서는 이 층을 한 줄도 못 잰다** — 손가락 쪽 배선이
  //    통째로 끊겨도 통과한다. **진짜 두 손가락으로 벌린다** (CDP `dispatchTouchEvent`).
  // ⚠️⚠️ **방만 줌하면 인물이 안 따라온다** — 인물은 DOM 이라 3D 와 아무 사이가 아니다.
  //    그래서 ④ 가 «아우라의 배율»과 «발이 양탄자에 그대로인가»를 같이 본다.
  // ⚠️ 한계 둘은 방의 «생김새»가 정한다 — ⑤ 는 바닥 앞머리·옆벽이 상자를 덮는가,
  //    ⑥ 은 머리가 방 그림 «안»인가다 (상수를 베껴 적지 않고 기하에서 구한다)
  let zoomRow = '';
  zoomGate: {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    await ctx.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
        { ver: 18, name: 'Tester', nameClaimed: true, tutorialDone: true, roomLevel: 5 }));
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.remove();
      if (typeof maxTune === 'function') maxTune();     // 졸업 직후 몸
      S.roomActs = ['exercise', 'binge', 'kitchen', 'harvest', 'farm'];
      S.quest = S.quest || {}; S.quest.done = ['q_first', 'q_walk', 'q_sip'];   // 왼쪽 줄 셋
      // ⚠️ 크리처를 세워 둔다 — 없으면 「버튼 줄에 가렸는가」가 아무것도 안 잰다
      const c = (window.GameData.RECIPES || []).find(r => r.result
        && r.result.kind === 'creature' && r.result.move === 'ground');
      if (c) { S.creatures = [c.result.id]; S.petRoom = c.result.id; }
      switchTab('showcase'); render();
    });
    await page.waitForSelector('.room-scene.is3d', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (!await page.evaluate(() => !!document.querySelector('.room-scene.is3d'))) {
      bad.push('줌: 3D 가 안 섰다 — 아무것도 못 쟀다');
      await ctx.close(); break zoomGate;
    }
    const cdp = await ctx.newCDPSession(page);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.room-canvas').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const px = box.x + box.w / 2, py = box.y + box.h * 0.4;
    // 가운데를 잡고 좌우로 벌린다 — `d` 는 두 손가락 사이.
    // ⚠️⚠️ **버튼 줄 위로 손가락을 내밀지 않는다** — 거기서 시작한 손가락은 그 버튼의
    //    것이라 «일부러» 안 받는다(`roomSwipeStart`). 330px 으로 벌렸더니 오른쪽
    //    손가락이 방 버튼에 떨어져 **핀치가 아예 안 서고** 줌이 1.20 에 멎었다
    const pinch = async (d0, d1) => {
      const pt = (d) => [{ x: px - d / 2, y: py, id: 1 }, { x: px + d / 2, y: py, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(d0) });
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent',
          { type: 'touchMove', touchPoints: pt(d0 + (d1 - d0) * i / 10) });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(380);
    };
    // 사이를 «그대로 둔 채» 두 손가락을 같이 옆으로 끈다 (핀치가 안 서는 거리에서 쓴다)
    const twoDrag = async (d, dx) => {
      const pt = (off) => [{ x: px - d / 2 + off, y: py, id: 1 }, { x: px + d / 2 + off, y: py, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0) });
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(dx * i / 10) });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(380);
    };
    // 「지금 잴 수 있는가」 — 못 재면 실패시키고 블록을 빠진다 (쓸기 블록과 같은 규칙)
    const look = async (what) => {
      const r = await page.evaluate(() => {
        if (typeof room3d === 'undefined' || !room3d) return null;
        const aura = document.querySelector('.char-aura');
        const sc = document.querySelector('.room-scene');
        const sh = document.querySelector('.char-body svg.avatar-svg > ellipse');
        const cre = document.querySelector('.stage-creature');
        const acts = [...document.querySelectorAll('#roomSolo .room-act')];
        if (!aura || !sc || !sh) return null;
        const scr = sc.getBoundingClientRect(), shr = sh.getBoundingClientRect();
        // ⚠️⚠️ **«그려진 크기»로 잰다 — 스타일 문자열을 읽지 않는다.** 예전에는
        //    `getComputedStyle(aura).scale` 을 읽었는데, 그러면 「값은 적혔는데
        //    브라우저가 그 속성을 모르는」 경우가 통째로 안 잡힌다 (개별 변환 속성이
        //    없는 브라우저에서는 조용히 아무 일도 안 일어난다 — 방만 작아지고
        //    인물은 큰 채로 남는다). 상자의 실제 폭 ÷ 레이아웃 폭이 곧 걸린 배율이다
        const ow = aura.offsetWidth;
        // 머리의 «그려진» 꼭대기 — 상자가 아니다 (위로 36칸 비어 있다)
        let top = Infinity;
        document.querySelectorAll('.char-body svg.avatar-svg *').forEach(n => {
          const b = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
          if (b && b.width && b.height) top = Math.min(top, b.top);
        });
        // 방이 상자를 덮는가 — 바닥의 앞 귀퉁이 둘과 옆벽의 바깥 끝 (+ 면 덮는다)
        const T = window.Room3D.THREE, cam = room3d.camera;
        const { ROOM_W, ROOM_D } = room3d.parts;
        const to = (x, y, z) => {
          const v = new T.Vector3(x, y, z).project(cam);
          return { x: (v.x * 0.5 + 0.5) * scr.width, y: (-v.y * 0.5 + 0.5) * scr.height };
        };
        const fl = to(-ROOM_W / 2, 0, ROOM_D / 2), fr = to(ROOM_W / 2, 0, ROOM_D / 2);
        const wl = to(-ROOM_W / 2, 0, -ROOM_D / 2), wr = to(ROOM_W / 2, 0, -ROOM_D / 2);
        let over = 0;
        if (cre) {
          const c = cre.getBoundingClientRect();
          acts.forEach(el => {
            const a = el.getBoundingClientRect();
            over += Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left))
                  * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
          });
        }
        // 크리처와 왼쪽 버튼 줄의 «틈» — 겹침만 보면 「0 이면 된다」가 되어
        // 손을 뗀 뒤 다시 세우는 줄이 빠진 것을 못 본다
        // ⚠️⚠️ **「가로 틈」으로 재면 안 된다 — 둘이 «위아래»로 설 수도 있다.** 크리처가
        //    커지면서 버튼 줄이 위로 비켜 주게 되자(2026-10-04) 세로로 겹치는 짝이
        //    하나도 없어져 **멀쩡한 화면이 「틈을 한 번도 못 쟀다」로 걸렸다.**
        //    두 네모 «사이의 거리»로 재면 나란히 서든 위아래로 서든 늘 잴 수 있고,
        //    겹치면 0 이라 빗장은 그대로 문다 (`gap < 1` 이 곧 「붙었다」다)
        let gap = null;
        if (cre && acts.length) {
          const c = cre.getBoundingClientRect();
          acts.forEach(el => {
            const a = el.getBoundingClientRect();
            const dx = Math.max(a.left - c.right, c.left - a.right, 0);
            const dy = Math.max(a.top - c.bottom, c.top - a.bottom, 0);
            gap = Math.min(gap == null ? 1e9 : gap, Math.hypot(dx, dy));
          });
        }
        // 헤더에서 «제 바탕을 가진 것»의 밑변 — 인물이 그 밑으로 들어가면 가려진다.
        // ⚠️ 목록을 적지 않고 헤더에 선 것을 그대로 훑는다 (알약을 하나 더 놓아도 따라온다)
        let pillBot = -Infinity;
        document.querySelectorAll('.app-header > *').forEach(n => {
          const b = n.getBoundingClientRect();
          if (b.width > 8 && b.height > 8) pillBot = Math.max(pillBot, b.bottom);
        });
        if (!isFinite(pillBot)) pillBot = scr.top;
        return { z: room3d.zoomAt().z, min: room3d.zoomAt().min, max: room3d.zoomAt().max,
          pill: pillBot,
          yaw: room3d.spinAt().to,
          // ⚠️⚠️ **«그려진 양탄자»도 같이 본다** — `zoomAt().z` 만 보면 「값은 바뀌는데
          //    카메라는 그대로」인 사보타주가 그대로 통과한다 (실제로 지나갔다)
          rug: room3d.floorRect().half,
          k: ow ? aura.getBoundingClientRect().width / ow : 1, gap,
          foot: (shr.top + shr.height / 2) - (scr.top + room3d.floorRect().cy),
          // ⚠️⚠️ **머리는 «헤더 알약»과 견준다 — 방 그림 상자가 아니다.** 방은 헤더
          //    자리까지 올라가 있어서(`--room-rise`) 상자 안이어도 제 바탕을 가진
          //    알약에 그대로 덮인다. 상자로 재던 동안 1.2배에서 네 폭이 다 알약 밑으로
          //    8.8~13.2px 들어가 있었는데 **0건이었다** — 「통과」가 아니라 「엉뚱한
          //    선을 쟀다」인 자리다 (「줌인 시 캐릭터가 공간 밖으로 나온다」로 신고받았다)
          head: top - pillBot,
          headBox: top - scr.top,
          cover: Math.min(Math.min(fl.y, fr.y) - scr.height, -wl.x, wr.x - scr.width),
          over };
      });
      if (r) return r;
      bad.push(`줌: ${what} — 방이 사라졌다 (아무것도 안 쟀다)`);
      return null;
    };

    const z0 = await look('처음'); if (!z0) { await ctx.close(); break zoomGate; }
    // ① 벌리면 커진다
    await pinch(80, 150);
    const zIn = await look('벌린 뒤'); if (!zIn) { await ctx.close(); break zoomGate; }
    if (!(zIn.z > z0.z + 0.02)) bad.push(`줌: 두 손가락을 벌려도 안 커진다 (${z0.z.toFixed(2)} → ${zIn.z.toFixed(2)})`);
    // ② 오므리면 줄어든다
    await pinch(150, 80);
    const zOut = await look('오므린 뒤'); if (!zOut) { await ctx.close(); break zoomGate; }
    if (!(zOut.z < zIn.z - 0.02)) bad.push(`줌: 두 손가락을 오므려도 안 줄어든다 (${zIn.z.toFixed(2)} → ${zOut.z.toFixed(2)})`);
    // ③ 한계를 안 넘는다 — 끝까지 벌리고, 끝까지 오므린다
    await pinch(50, 250);
    const zHi = await look('끝까지 벌린 뒤'); if (!zHi) { await ctx.close(); break zoomGate; }
    if (zHi.z > zHi.max + 1e-6) bad.push(`줌: 위 한계를 넘었다 (${zHi.z.toFixed(3)} > ${zHi.max})`);
    if (Math.abs(zHi.z - zHi.max) > 0.02) bad.push(`줌: 끝까지 벌렸는데 위 한계에 못 닿았다 (${zHi.z.toFixed(3)} ≠ ${zHi.max})`);
    // ⑥ 그 자리에서 머리가 «방 그림 안»인가 · ④ 인물이 같이 커지고 발은 그대로인가
    // ⚠️ 알약 밑변에서 이만큼은 떨어져야 한다 — 0 으로 두면 «딱 닿는» 자리가 통과한다
    if (!(zHi.head > 4)) bad.push(`줌: 끝까지 벌리면 머리가 헤더 알약 밑으로 들어간다 (${zHi.head.toFixed(1)}px)`);
    if (Math.abs(zHi.k - zHi.z) > 0.02) bad.push(`줌: 인물이 방을 안 따라간다 (방 ${zHi.z.toFixed(2)} · 인물 ${zHi.k.toFixed(2)})`);
    if (Math.abs(zHi.foot) > 1.5) bad.push(`줌: 끝까지 벌리면 발이 양탄자에서 ${zHi.foot.toFixed(1)}px 벗어난다`);
    if (Math.abs(zHi.yaw - z0.yaw) > 1e-6) bad.push(`줌: 핀치 중에 방이 같이 돌았다 (yaw ${z0.yaw.toFixed(3)} → ${zHi.yaw.toFixed(3)})`);
    await pinch(250, 50);
    const zLo = await look('끝까지 오므린 뒤'); if (!zLo) { await ctx.close(); break zoomGate; }
    if (zLo.z < zLo.min - 1e-6) bad.push(`줌: 아래 한계를 넘었다 (${zLo.z.toFixed(3)} < ${zLo.min})`);
    if (Math.abs(zLo.z - zLo.min) > 0.02) bad.push(`줌: 끝까지 오므렸는데 아래 한계에 못 닿았다 (${zLo.z.toFixed(3)} ≠ ${zLo.min})`);
    // ⑤ 그 자리에서 방이 상자를 다 덮는가 (앞벽이 없어 물러나면 틈이 생긴다)
    if (!(zLo.cover > 0)) bad.push(`줌: 끝까지 오므리면 방이 상자를 못 덮는다 (${zLo.cover.toFixed(1)}px)`);
    if (Math.abs(zLo.k - zLo.z) > 0.02) bad.push(`줌: 인물이 방을 안 따라간다 (방 ${zLo.z.toFixed(2)} · 인물 ${zLo.k.toFixed(2)})`);
    if (Math.abs(zLo.foot) > 1.5) bad.push(`줌: 끝까지 오므리면 발이 양탄자에서 ${zLo.foot.toFixed(1)}px 벗어난다`);
    // ⑦ **그려진 방도 같이 커졌는가** — 값만 바뀌고 카메라가 그대로면 여기서 잡힌다
    const want = zHi.z / z0.z, got = zHi.rug / z0.rug;
    if (Math.abs(got - want) > 0.02 * want) {
      bad.push(`줌: 값은 ${want.toFixed(2)}배인데 그려진 양탄자는 ${got.toFixed(2)}배다`
        + ` (${z0.rug.toFixed(0)} → ${zHi.rug.toFixed(0)}px) — 카메라가 안 따라왔다`);
    }
    // ⑧ 두 손가락이 «너무 가까우면» 핀치가 안 선다 — 그때도 방이 돌거나 커지면 안 된다
    //    (손가락이 둘이 되는 순간 돌리기를 끊는 그 한 줄을 여기서만 잰다)
    const n0 = await look('가까운 두 손가락 전'); if (!n0) { await ctx.close(); break zoomGate; }
    await twoDrag(14, 90);
    const n1 = await look('가까운 두 손가락 뒤'); if (!n1) { await ctx.close(); break zoomGate; }
    if (Math.abs(n1.yaw - n0.yaw) > 1e-6) {
      bad.push(`줌: 두 손가락이 14px 밖에 안 벌어져 핀치가 안 서는데 방이 돌았다`
        + ` (yaw ${n0.yaw.toFixed(3)} → ${n1.yaw.toFixed(3)})`);
    }
    if (Math.abs(n1.z - n0.z) > 1e-6) {
      bad.push(`줌: 두 손가락이 14px 밖에 안 벌어졌는데 줌이 변했다 (${n0.z.toFixed(3)} → ${n1.z.toFixed(3)})`);
    }
    // ⚠️⚠️ **「배율의 축이 발밑인가」를 «따로» 재는 줄은 두지 않았다 — 두 번 짜 보고
    //    둘 다 아무것도 안 쟀다.** ① 「줌만 바꾸고 인물을 다시 안 세우기」는
    //    `setZoom` 이 카메라만 옮기고 배율은 `placeFigure()` 가 거는 것이라 축이
    //    무엇이든 발이 안 움직인다 ② 「옮기는 몫이 줌마다 같은가」는 지금 `placeFigure()`
    //    가 **다 지우고 맨몸에서 재**므로 쓰는 값이 **구조적으로** 줌과 무관하다
    //    (축을 가운데로 되돌려도 −24.8 셋이 그대로 나왔다 — 어긋나는 것은 «쓴 값»이
    //    아니라 «그 뒤에 찍히는 자리»다). 그 자리를 보는 것이 ④ 이고, 축을 가운데로
    //    되돌리면 거기서 **31.7px · −23.8px** 로 잡힌다. 못 가르는 줄을 더 두지 않는다

    // ⑨ 손을 뗀 뒤 크리처가 다시 선다 — 버튼 줄에 «틈»을 두고 선다
    if (zLo.over > 0.5) bad.push(`줌: 오므린 뒤 크리처가 왼쪽 버튼 줄에 ${zLo.over.toFixed(0)}px² 가려졌다`);
    if (zHi.over > 0.5) bad.push(`줌: 벌린 뒤 크리처가 왼쪽 버튼 줄에 ${zHi.over.toFixed(0)}px² 가려졌다`);
    [['벌린', zHi], ['오므린', zLo]].forEach(([w, r]) => {
      if (r.gap == null) bad.push(`줌: ${w} 뒤 크리처와 버튼 줄의 틈을 한 번도 못 쟀다`);
      else if (r.gap < 1) bad.push(`줌: ${w} 뒤 크리처가 버튼 줄에 ${r.gap.toFixed(1)}px 까지 붙었다`);
    });
    zoomRow = `줌 — 벌리면 ${z0.z.toFixed(2)}→${zIn.z.toFixed(2)} · 오므리면 ${zOut.z.toFixed(2)}`
      + ` · 한계 ${zLo.min}~${zHi.max} 에 닿는다 · 그려진 양탄자 ${z0.rug.toFixed(0)}→${zHi.rug.toFixed(0)}px(${got.toFixed(2)}배)`
      + ` · 인물도 같은 배율(${zHi.k.toFixed(2)}·${zLo.k.toFixed(2)})`
      + ` · 발 ${zHi.foot.toFixed(1)}·${zLo.foot.toFixed(1)}px · 끝까지 벌려도 머리가 알약 밑으로 ${zHi.head.toFixed(0)}px 안 든다(상자 안으로 ${zHi.headBox.toFixed(0)}px)`
      + ` · 끝까지 오므려도 방이 ${zLo.cover.toFixed(0)}px 덮는다`
      + ` · 크리처와 버튼 줄의 틈 ${zHi.gap == null ? '?' : zHi.gap.toFixed(1)}·${zLo.gap == null ? '?' : zLo.gap.toFixed(1)}px`
      + ` · 가까운 두 손가락으로는 안 돌고 안 커진다`;
    await ctx.close();
  }

  await browser.close();
  console.log('3D 방 — ' + out.join(' | '));
  if (gift) console.log('  ' + gift);
  if (pet) console.log('  ' + pet);
  if (petShade) console.log('  ' + petShade);
  if (hide) console.log('  ' + hide);
  if (petBox) console.log('  ' + petBox);
  if (firstDraw) console.log('  ' + firstDraw);
  if (swipe) console.log("  " + swipe);
  if (zoomRow) console.log("  " + zoomRow);
  console.log(`  (발 ${FOOT_MAX}px · SVG 와 ${SVG_MAX}px · 머리 뒤 벽 ${WALL_MIN * 100}% 까지`
    + ` · 크리처 땅·어항 ${PET_FOOT}px · 공중 ${PET_AIR_MIN}px 까지 · 폭 셋을 다 쟀다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  if (out.length !== 3) { console.log(`❌ 세 폭 중 ${out.length}개만 쟀다`); process.exit(1); }
  console.log('✅ 3D 방이 SVG 와 같은 자리에 서고 인물이 그 양탄자 위에 있다');
})().catch(e => { console.error(e); process.exit(1); });
