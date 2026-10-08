// ═══════════════════════════════════════════════════════════════
//  크리처 그림이 «귀여운 모양»을 지키는가 (npm run test:creature)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **이 층을 보는 검사가 하나도 없었다.** `checkdata` 는 부품 «이름»이 표에 있는지만
// 보고, `checkui` 는 도감 칸의 대비를 보는데 크리처는 `<svg>` 라 글자가 없다 —
// 서른 마리의 그림이 어떻게 생겼든 0건이었다. 실제로 뿔을 키웠더니 **네 마리의 뿔이
// 통째로 상자 밖으로 나가 한 픽셀도 안 그려졌는데** 아무 데서도 안 걸렸다
// (SVG 는 viewBox 밖을 아예 안 그려서 «티가 안 난다»).
//
// 여기서 재는 것은 `CLAUDE.md` 의 「듀오링고풍 치비」 다섯 줄이다 —
// ① 안 잘린다 ② 정면이다 ③ 눈이 크다 ④ 빛이 두 점이다 ⑤ 볼터치가 있다
// ⑥ 속성 색이 여섯으로 갈린다.
//
// ⚠️ **그린 값을 도로 읽지 않는다** — `Creature.HEAD` 같은 표를 읽어 견주면
// 「스스로 맞는」 검사가 된다. **캔버스에 그려 픽셀로** 잰다.
'use strict';
const { chromium } = require('playwright');
const { pngLumGrid } = require('./pnglum');
const { decode } = require('./png');
const BASE = process.env.BASE || 'http://localhost:8080';

const SZ = 200;          // 재는 크기 (100×100 viewBox 를 두 배로)
// 상자 가장자리에 이만큼은 비어 있어야 한다 — 뿔·귀가 잘리면 여기서 걸린다
const EDGE = 2;
// 얼굴 띠(그려진 것의 위쪽)가 좌우로 이만큼은 같아야 «정면»이다.
// ⚠️ **옛 옆모습 그림이 0.40 이고 지금이 0.97 이라** 그 사이다 (사보타주로 확인했다)
const SYM_MIN = 0.90;
// ⚠️⚠️ **「눈이 큰가」는 «문»으로 안 둔다 — 가를 수 있는 픽셀 잣대를 못 찾았다.**
//    셋을 재 봤고 셋 다 옛 그림과 겹쳤다:
//      · 「얼굴 띠에서 먹이 몇 %」 → 띠를 「위쪽 45%」로 잡으면 뿔 달린 사슴·더듬이
//        달린 나비에서 그 띠가 통째로 «뿔»이라 멀쩡한 그림이 0.5% 로 나온다
//      · 「눈 가로 ÷ 그림 가로」 → 날개가 그림을 넓혀 나비가 25%, 옛 그림 최소가 22%
//      · 「눈동자 넓이 ÷ 그림 넓이」 → 평균은 0.6% → 1.2% 로 두 배인데 **최소가 둘 다 0.4%**
//    **가르지 못하는 잣대는 무슨 값을 넣어도 통과한다** — 그래서 수치는 내되 문은 안 건다.
//    눈의 «짜임»(흰자 + 눈동자 + 빛 두 점)은 아래 ④ 가 대신 지킨다
// 볼터치 — **털색이 볼터치 색 쪽으로 «끌려간» 점**을 센다.
// ⚠️⚠️ **잣대를 두 번 틀렸다.**
//    ① 「`#ff9db4` 에 가까운 점」 → 볼터치가 반투명(0.55)이라 **찍히는 색이 털색에 따라
//       달라진다.** 푸른 털 위에서는 보랏빛이 되어 분홍과 한참 멀다 (열 마리가 걸렸다)
//    ② 「털색보다 붉은 점」 → **주황 털에서는 볼터치가 오히려 덜 붉다**
//       (주황은 파랑이 적고 볼터치는 파랑이 있다 · 불 속성 다섯이 걸렸다)
//    지금은 **「볼터치 색과의 거리가 털색보다 훨씬 가까운 점」**이다 — 섞이는 방향은
//    털색이 무엇이든 같으므로 여섯 속성에서 다 선다
const BLUSH_MIN = 24;    // 그런 점이 이만큼은 있어야 한다 (200px 에서 한쪽만 60쯤 된다)
const BLUSH_K = 0.6;     // 털색이 가진 거리의 이만큼 안으로 들어와야 «볼»이다
// ⚠️⚠️ **2 → 4 로 되돌렸다** (2026-10-02 · 눈마다 «두 점»이 됐다 — 「초롱초롱한
//    눈망울」). ⚠️ 수를 안 올리면 **「하나라도 있으면 센다」**가 되어 **한 점을 지우는
//    사보타주가 그대로 통과한다** — 빛의 수를 바꿀 때는 이 값과 아래 `got` 식이 짝이다
const HI_WANT = 4;       // 빛점 — 눈 둘 × 두 점. 감고 웃는 눈은 안 본다
// 갈아 끼운 그림의 viewBox 에 남아도 되는 여백 (%).
// ⚠️ **재서 골랐다** — 지금 둘 다 2.2% 안이고, 원숭이 «원본»은 12% 였다 (그 여백만큼
//    바닥에서 떠 보인다). 그 사이에서 느슨한 파일을 확실히 가르는 자리다
const PREV_PAD = 4;
const ATTR_DE = 28;      // 속성끼리 이만큼은 색이 갈려야 한다 (ΔE 비슷한 값)
const PUPIL_MAX = 0.22;  // 눈동자 상자는 그림의 이만큼 안이다 (먹선 덩어리를 가른다)
const PUPIL_AR = [0.55, 1.8];
const PUPIL_FILL = 0.30; // 눈동자는 «꽉 찬» 덩어리다 — 테두리 «고리»를 가른다
// ⚠️⚠️ 배 판의 테두리(`plate`)가 먹선 색이라 **고리 하나가 눈동자로 잡혔다** —
//    작고(16%) 둥글고(1.2) 크기 빗장을 다 지나서, 그 고리 «안»의 옅은 배 색이
//    「흰자 543%」로 나왔다. 재 보면 눈동자는 상자의 48~70% 가 차 있고 고리는 12% 다
// ⚠️⚠️ **흰자를 «눈동자 상자 안의 밝은 덩어리»로 재면 못 잡는다 — 사보타주가 찾아냈다.**
//    진짜 사람 눈은 «흰자가 바깥, 눈동자가 그 안»이라 먹 덩어리는 작은 눈동자뿐이고
//    흰자는 그 상자 «밖»이다. 게다가 흰자가 **크림색 얼굴 판에 닿아 한 덩어리**가 되어
//    그 덩어리의 중심이 얼굴 한가운데로 가 버린다 — 그래서 **흰자를 넣어도 16% 로
//    통과했다.** 지금은 상자를 안 쓰고 **「거의 흰 칠」이 눈동자 넓이에 비해 얼마나
//    되는가**로 잰다 (빛점 둘이면 7% 안팎 · 흰자가 있으면 170% 가 넘는다).
// ⚠️ 문턱 238 은 **재서** 골랐다 — 크림 얼굴의 제일 밝은 채널이 224(바람)이고
//    빛점(`#fffdf9`)의 제일 어두운 채널이 249 다. 그 사이라 둘이 안 섞인다
const WHITE_LUM = 238;   // 세 채널이 다 이보다 밝으면 «거의 흰 칠»이다
const WHITE_MAX = 0.30;  // 그 몫이 눈동자 넓이의 이만큼을 넘으면 빛점이 아니라 흰자다   // 가로÷세로 — 둥글어야 한다 (입·눈꺼풀 획을 가른다)
// ── ⑦ 먹선 — **둘레에 먹선이 «없는가».**
//
// ⚠️⚠️ **이 줄은 2026-10-01 에 방향이 뒤집혔다.** 전날에는 「둘레가 먹선인가」였다 —
//    그날 사람이 **고양이 SVG 한 장을 직접 그려 보내며** 「잉크선은 생각보다 귀엽지
//    않아서 다시 제거를 부탁해」로 결을 되돌렸고, 그 파일에는 선이 한 줄도 없다.
//    **지키던 것이 사라지면 잣대도 같이 가되, «반대쪽 사고»를 막을 자리는 남긴다** —
//    먹선을 도로 두르는 쪽이 이제 어긋난 것이라 문턱만 뒤집었다
//    (`checkavatar` 의 「페이퍼돌」 ②를 「결이 있는가」→「결이 없는가」로 뒤집은 그 자리다).
// ⚠️ **①~⑥ 어느 것도 이 축을 못 본다** — 선을 도로 둘러도 잘리지도, 비뚤지도,
//    빛이 모자라지도 않는다. 0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
const LINE_HEX = '#44353d';
const LINE_TOL = 30;     // 안티에일리어싱이 끼므로 조금 넉넉히
// ⚠️⚠️ **44 로 두었더니 «선이 있는가»를 재던 때 사보타주가 절반만 잡혔다** — 어두운
//    속성의 털색이 그 품 안에 들어온다. 양쪽을 다 재서 골랐다: 26·30·34 는
//    **선을 두르면 99% · 없으면 1%(30마리 다)** 로 한결같다. 뒤집은 지금도 그대로 쓴다
const LINE_MAX = 0.12;   // 둘레에 먹선이 이만큼 넘게 있으면 «선을 두른 것»이다
const LINE_IN = 2;       // 가장자리에서 이만큼 안쪽을 본다 (가장자리 한 줄은 반투명이다)
const TILT_MAX = 0.25;   // ⑪ 눈망울이 «기울지» 않았는가 (지금 0.12 · 옛 아몬드 0.50 — 재서 골랐다)
const TILT_MIN_N = 60;   // 이보다 작은 먹 덩어리는 «입»이라 안 잰다
const SEAM_MAX = 2;      // ⑨ 귀 이음매 — 실루엣이 한 줄에 이만큼 넘게 안으로 꺾이면 «턱»이다
const TAIL_MIN = 200;    // ⑩ 꼬리가 몸 밖으로 내놓아야 하는 몫 (200px 기준)

// 「바라보는 쪽」이 **눈으로 본 것과 맞는가** (`Creature.FACE` · `gencreature` 의
// `MOVE_MUST` 와 같은 조리법이다). 사람이 그림을 보고 「이 마리는 왼쪽을 본다」고
// 짚어 준 것만 못으로 박는다 — 표에서 한 줄이 빠지면 그 마리가 조용히 인물에게
// **등을 돌린 채** 서는데, `checkroom` 은 「FACE 에 있는 마리가 반대쪽에 서는가」만
// 보므로 **빠진 줄은 영영 못 본다**.
// ⚠️ **부품 그림은 정면 치비라 FACE 에 들어갈 수 없다**(② 가 좌우 대칭을 못 박는다) —
//    그래서 「FACE 의 마리가 다 PREVIEW 인가」도 같이 본다
// ⚠️⚠️ **값이 둘이고 뜻이 다르다** — `'left'` 는 「그림이 왼쪽을 본다」(뒤집으면 값도
//    뒤집는다) · `'pick'` 은 「그림은 정면이고 사람이 자리를 골랐다」(뒤집어도 그대로다).
//    섞어 적으면 다음에 그림을 뒤집는 사람이 고칠 줄을 못 고르므로 **값까지 못으로 박는다**
const FACE_MUST = { ash_moth: 'left', flame_fox: 'left', pebble_turtle: 'left',
  moss_deer: 'pick', dandelion_hare: 'pick', whirl_marten: 'pick',
  sky_falcon: 'pick', sunbeam_hen: 'pick',
  nightmist_fox: 'pick', obsidian_lizard: 'pick', droplet_otter: 'pick',
  butterfly: 'pick' };

const near = (p, hex, tol) => {
  const n = parseInt(hex.slice(1), 16);
  return Math.abs(p[0] - ((n >> 16) & 255)) < tol
      && Math.abs(p[1] - ((n >> 8) & 255)) < tol
      && Math.abs(p[2] - (n & 255)) < tol;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Creature && window.GameData);

  const shots = await page.evaluate(async (SZ) => {
    // ⚠️⚠️ **미리 보기로 갈아 끼운 마리는 뺀다** (`Creature.PREVIEW`). 여기 ①~⑪ 은
    //    **부품 그림**을 재는 잣대라, 「대고 따라 그린」 그림이 들어선 마리는 지날 수가
    //    없다 — 그렇다고 통째로 실패시키면 나머지 스물아홉을 못 본다.
    //    **몇 마리를 안 쟀는지 아래에서 같이 내놓는다** — 0건이 「통과」로 보이면 안 된다
    const skip = Object.keys(Creature.PREVIEW || {});
    const list = GameData.RECIPES.filter(r => r.result.kind === 'creature')
      .map(r => r.result).filter(c => !skip.includes(c.id));
    const cv = document.createElement('canvas');
    cv.width = cv.height = SZ;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const res = [];
    // ⚠️ **배경 판도 그림자도 끄고 잰다** — 판을 깔아 두면 「상자에 꽉 찼다」가 늘 참이라
    //    잘림을 영영 못 보고, 그림자는 바닥에 번져 실루엣을 흐린다
    const shot = async (c, opts) => {
      // ⚠️⚠️ **`data:` 그림 안의 상대 주소는 안 열린다** — 기준이 그 data URL 이라
      //    `href="cat-happy.svg"` 가 갈 곳이 없어지고, SVG 는 그것을 조용히 버려
      //    **흰 상자**가 나온다. 재기 전에 절대 주소로 편다 (부품 그림에는 href 가
      //    하나도 없어서 이 줄이 스물아홉 마리에는 아무 일도 안 한다)
      let svg = Creature.draw(c, { flat: true, noShadow: true, size: SZ, ...(opts || {}) })
        .replace(/href="(?!https?:|data:|#)/g, 'href="' + location.origin + '/');
      // ⚠️⚠️ **`data:` 로 구운 SVG 안에서는 «바깥 그림»이 안 열린다** (2026-10-07에 재서 알았다).
      //    절대 주소로 펴 두어도 그렇다 — 스물일곱 마리가 **한 글자도 안 다른 색**으로
      //    나와서 드러났다(제일 가까운 쌍이 0 이었다). 파일을 받아 **안에 박아 넣는다**
      for (const m of [...svg.matchAll(/href="(https?:[^"]+)"/g)]) {
        try {
          const t = await (await fetch(m[1], { cache: 'no-store' })).text();
          svg = svg.replace(m[0], 'href="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t) + '"');
        } catch { /* 못 받으면 그대로 둔다 — 「파일이 진짜 오는가」는 prev 가 따로 본다 */ }
      }
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const im = new Image();
      await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
      g.clearRect(0, 0, SZ, SZ);
      g.drawImage(im, 0, 0, SZ, SZ);
      return Array.from(g.getImageData(0, 0, SZ, SZ).data);
    };
    // 부품 하나를 뗀 그림 — ⑨⑩ 이 «그 부품이 그림에서 하는 일»을 보려고 쓴다.
    // ⚠️ `art` 를 읽어 견주지 않는다 (「스스로 맞는」 검사가 된다) — **떼고 그려서** 본다
    const without = (c, k) => ({ ...c, art: { ...c.art, [k]: 'none' } });
    for (const c of list) {
      const core = (c.art.horn !== 'none') ? 'horn'
        : (c.art.wing !== 'none') ? 'wing'
          : (c.art.ear !== 'none') ? 'ear' : 'tail';
      res.push({
        id: c.id, name: c.name, attr: c.attr, eye: c.art.eye, core, tailKind: c.art.tail,
        px: await shot(c),
        noEar: core === 'ear' ? await shot(without(c, 'ear')) : null,
        noTail: c.art.tail !== 'none' ? await shot(without(c, 'tail')) : null,
      });
    }
    // ⚠️⚠️ **갈아 끼운 마리는 「그림 파일이 진짜 오는가」만 본다.**
    //    ①~⑪ 은 부품 그림을 재는 잣대라 못 돌지만, 파일 이름 하나만 틀려도
    //    **흰 상자**가 되는 것은 막을 수 있다 (SVG 는 못 읽는 그림을 조용히 버린다).
    // ⚠️⚠️ **픽셀로는 못 가른다 — 재 보고 안 쓰기로 한 자리다.** `data:` 로 구워
    //    세는 길은 **이름을 틀려도 같은 수(22573칸)가 나온다**: 서버가 모르는 주소에
    //    `index.html` 을 돌려주고(SPA 폴백) 그것이 그대로 칠해지기 때문이다.
    //    **가르지 못하는 잣대는 무슨 값을 넣어도 통과한다** — 그래서 「무엇이 왔는가」를 묻는다
    const prev = [];
    for (const id of skip) {
      const url = location.origin + '/' + Creature.PREVIEW[id];
      try {
        const r = await fetch(url, { cache: 'no-store' });
        const ct = r.headers.get('content-type') || '';
        const n = (await r.blob()).size;
        // ⚠️ **배선도 같이 본다** — 파일이 멀쩡히 와도 `draw()` 가 그것을 안 가리키면
        //    그림은 비어 있다. 그린 것에 그 이름이 들어 있는지 본다 (픽셀로는 못 가른다)
        const c = GameData.RECIPES.map(x => x.result).find(x => x.id === id);
        const svg = c ? Creature.draw(c, { flat: true }) : '';
        const wired = svg.includes(Creature.PREVIEW[id]);
        // ─ ⓐ 파일의 `viewBox` 가 «칠한 데에 바짝» 잘려 있는가 ─
        //
        // ⚠️⚠️ **여백이 남아 있으면 그만큼 그대로 떠 보이고 작아진다.** 원숭이 원본이
        //    위 12% · 아래 11.6% 였는데, 그대로 넣으면 발이 바닥에서 9px 뜬다 —
        //    「둥둥 떠있어」로 두 번 신고받은 그 자리가 **그림 쪽에서** 돌아온다.
        // ⚠️ 이것은 «그린 것»을 재는 잣대다 — 파일을 페이지에 띄워 **화면에 찍힌 자리**를
        //    viewBox 칸으로 되돌린다 (표에 적힌 숫자가 아니다).
        // ⚠️⚠️ **`getBBox()` 로 재면 안 된다 — 조각의 «제» 좌표다.** 받은 그림이 통째로
        //    `<g transform=…>` 안에 들어 있으면(복숭아 고양이가 그렇다) 그 좌표가
        //    viewBox 와 아무 상관이 없어 **여백이 120%·−687% 같은 수로 나온다**
        //    (실제로 그랬다). 조상의 변환을 다 지나는 것은 `getBoundingClientRect()` 다.
        // ⚠️⚠️ **상자를 viewBox 와 «같은 비»로 띄운다.** 400×400 짜리 네모에 띄우면
        //    `preserveAspectRatio` 가 letterbox 를 넣어 1칸 = 1px 이 아니게 되고,
        //    가로세로 배율이 갈려 **한 축의 여백만 조용히 틀린다**
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1400px;height:1400px';
        host.innerHTML = await (await fetch(url, { cache: 'no-store' })).text();
        document.body.appendChild(host);
        const fs = host.querySelector('svg');
        let pad = null, ar = null, anim = 0, vbStr = null, filePar = null;
        if (fs) {
          // ⚠️⚠️ **맞춤을 선언하는 자리는 «이 파일»뿐이다** — 크로뮴은 `<image>` 쪽의
          //    `preserveAspectRatio` 를 안 본다 (`creature.js` 의 `previewSvg` 위에
          //    경위를 적어 두었다). 그래서 여기서 읽는다
          filePar = fs.getAttribute('preserveAspectRatio');
          const vb = fs.viewBox.baseVal;
          fs.setAttribute('width', vb.width); fs.setAttribute('height', vb.height);
          vbStr = [vb.x, vb.y, vb.width, vb.height].join(' ');
          anim = fs.querySelectorAll('animate,animateTransform').length;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          // ⚠️⚠️ **움직이는 그림은 «한 바퀴 동안» 칠하는 자리를 본다.** 지금 그림 여섯은
          //    다 정지 그림이지만(애교는 `petidle.js` 가 게임 쪽에서 씌운다),
          //    누가 다시 움직임을 그림에 구우면 **쉬는 자세만 재는 잣대는 그만큼
          //    작아진 크리처를 통과시킨다** — 그래서 시계를 돌려 보는 길을 남겨 둔다.
          // ⚠️ **안 보이는 조각은 안 센다** — 불투명도 0 에서 출발하는 조각(하트)을
          //    그대로 세면 날아간 끝자리까지 상자가 된다
          const times = [0];
          if (anim) { fs.pauseAnimations(); for (let t = 0.08; t <= 20; t += 0.08) times.push(t); }
          const hidden = (n) => {
            for (let q = n; q && q !== fs; q = q.parentNode) {
              if ((parseFloat(getComputedStyle(q).opacity) || 0) < 0.04) return true;
            }
            return false;
          };
          for (const t of times) {
            if (anim) fs.setCurrentTime(t);
            const sb = fs.getBoundingClientRect();
            if (!sb.width || !sb.height) break;
            fs.querySelectorAll('path,ellipse,circle,rect,polygon').forEach(q => {
              if (hidden(q)) return;
              const r = q.getBoundingClientRect();
              if (!r.width && !r.height) return;
              const X = (v) => vb.x + (v - sb.left) / sb.width * vb.width;
              const Y = (v) => vb.y + (v - sb.top) / sb.height * vb.height;
              x0 = Math.min(x0, X(r.left)); x1 = Math.max(x1, X(r.right));
              y0 = Math.min(y0, Y(r.top)); y1 = Math.max(y1, Y(r.bottom));
            });
          }
          // ⚠️ 상자 «밖»으로 나간 몫은 0 으로 접는다 — 여백을 재는 자리라
          //    음수 여백(= 잘림)은 여기서 볼 것이 아니다
          x0 = Math.max(x0, vb.x); y0 = Math.max(y0, vb.y);
          x1 = Math.min(x1, vb.x + vb.width); y1 = Math.min(y1, vb.y + vb.height);
          if (isFinite(x0) && vb.width && vb.height) {
            ar = +(vb.width / vb.height).toFixed(3);
            pad = {
              l: +((x0 - vb.x) / vb.width * 100).toFixed(1),
              r: +((vb.x + vb.width - x1) / vb.width * 100).toFixed(1),
              t: +((y0 - vb.y) / vb.height * 100).toFixed(1),
              b: +((vb.y + vb.height - y1) / vb.height * 100).toFixed(1),
            };
          }
        }
        host.remove();
        // ─ ⓑ 그린 것이 «비를 숫자로 박지» 않았는가 ─
        //
        // ⚠️⚠️ **이 한 줄은 «마크업»을 본다 — 픽셀이 아니다.** 그림이 상자 안 어디에
        //    앉는지는 `preserveAspectRatio` 가 정하는데, `getBoundingClientRect()` 는
        //    **뷰포트 상자**(0,2.5,100,87.5)를 돌려줘서 그 자리를 못 본다 —
        //    실제로 둘이 **같은 값**으로 나와 한 번 헛짚었다. 픽셀 차로 재는 길도
        //    해 봤는데 그려진 비가 0.95 ↔ 파일 0.84 로 흔들려 **가르지 못했다**.
        //    그래서 여기서는 「비를 안 박았는가」만 묻고, 모양이 맞는지는 ⓐ 가 맡는다.
        //
        // ⚠️⚠️ **맞춤(`preserveAspectRatio`)은 «그림 파일»이 선언한다** (2026-10-07).
        //    크로뮴은 `<image>` 쪽의 선언을 **안 본다** — 재 봤다: `xMidYMax` 와
        //    `xMidYMid` 를 번갈아 줘도 한 자리도 안 달라진다. 그래서 오래 `<image>` 에
        //    적혀 있던 `xMidYMax` 가 **아무 일도 안 하고** 기본값(`xMidYMid`)이 이겨,
        //    **비가 슬롯보다 넓은 그림이 위아래로 반씩 떠 있었다** — 🫧 물빛 말랑이가
        //    11.3칸(화면 7px) 떠서 「왜 공중에 떠 있어?」로 신고받은 자리다.
        //    지금 보는 것 둘 — ① `<image>` 에 **안 적혀 있어야** 한다(듣지도 않는 사본은
        //    늘 거짓일 수 있다) ② **파일**이 move 에 맞게 선언해야 한다.
        //    닿는 자리가 맞는지는 **ⓕ** 가 픽셀로 본다
        const par = (svg.match(/<image[^>]*preserveAspectRatio="([^"]*)"/) || [])[1] || '';
        const full = /<image[^>]*width="100"/.test(svg) || /<image[^>]*width="\$/.test(svg);
        prev.push({ id, file: Creature.PREVIEW[id], ok: r.ok, ct, n, wired, pad, ar, par, full,
          filePar, anim, vb: vbStr, move: c ? c.move : '?' });
      } catch (e) { prev.push({ id, file: Creature.PREVIEW[id], err: String(e) }); }
    }
    // 속성 여섯과 «그 속성의 마리가 다 갈아 끼워졌는가» — 아래의 색 검사가 쓴다
    const every = GameData.RECIPES.filter(r => r.result.kind === 'creature').map(r => r.result);
    const attrs = [...new Set(every.map(c => c.attr))];
    const fullySwapped = attrs.filter(a => every.filter(c => c.attr === a)
      .every(c => skip.includes(c.id)));

    // ⚠️⚠️ **⑥ 의 «문»은 서른 마리를 다 돈다 — 부품 그림만 재면 속성이 하나씩 사라진다.**
    //    한 속성의 마리가 다 갈아 끼워지면 아래 ①~⑪ 의 털색 쪽은 그 속성을 통째로 못 재는데
    //    (2026-10-06에 불이, 10-07에 빛까지 그렇게 됐다 — 남은 것이 **둘**뿐이라
    //    「여섯이 갈리는가」가 사실상 비어 버렸다). 그런데 **색은 갈아 끼운 그림에서도
    //    그대로 재진다** — 대고 따라 그린 그림도 속성 색으로 칠해져 있기 때문이다.
    // ⚠️ **배경 판으로는 못 잰다 — 재 보고 버린 길이다.** 판은 `tint(색, 88)` 이라
    //    여섯이 다 거의 흰색이고, 제일 가까운 쌍(fire↔earth)이 **8** 밖에 안 갈린다.
    //    **가르지 못하는 잣대는 무슨 값을 넣어도 통과한다**
    // ⚠️⚠️ **배·얼굴의 «크림»은 빼고 잰다 — 여섯이 다 같이 쓰는 색이라 속성을 못 말한다.**
    //    그냥 제일 많은 색을 집으면 절반이 크림이 1등이라 **제일 가까운 쌍이 0** 이 된다.
    //    가르는 자리는 재서 골랐다 — 크림은 제일 어두운 채널이 **202~210** 이고
    //    속성 색은 **110~163** 이다 (불 106 · 땅 148 · 바람 152 · 물 130 · 빛 110 · 어둠 163)
    const CREAM_MIN = 185;
    const furs = {};
    for (const c of every) {
      const px = await shot(c);
      const A2 = (x, y) => px[(y * SZ + x) * 4 + 3];
      const tally = {};
      for (let y = Math.round(SZ / 2); y < SZ; y++) for (let x = 0; x < SZ; x++) {
        if (A2(x, y) < 240) continue;
        const i = (y * SZ + x) * 4, k = [px[i], px[i + 1], px[i + 2]].join(',');
        if (Math.min(px[i], px[i + 1], px[i + 2]) >= CREAM_MIN) continue;
        tally[k] = (tally[k] || 0) + 1;
      }
      const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      if (top) (furs[c.attr] = furs[c.attr] || []).push({ id: c.id, p: top.split(',').map(Number) });
    }
    // ═══ ⓕ 갈아 끼운 그림이 «닿는 줄»에 오는가 (픽셀 · 2026-10-07) ═══
    //
    // ⚠️⚠️ **ⓐ 는 이 축을 영영 못 본다.** 그쪽은 파일을 «비가 맞는 상자»에 띄워
    //    여백을 재므로 편지함(letterbox)이 애초에 안 생긴다 — 즉 「파일은 바짝 잘렸는데
    //    화면에서는 떠 있는」 자리를 통째로 지나간다. 🫧 물빛 말랑이는 여백이 0% 로
    //    멀쩡한 채 **11.3칸(화면 7px) 떠 있었고 ⓐ 는 0건이었다.**
    //    0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 그 자리다.
    // ⚠️ **그린 것을 흰 바탕에 찍어** 칠한 범위를 찾는다 — 배경 판도 그림자도 끄고,
    //    바깥 그림은 파일을 받아 안에 박아 넣는다(안 그러면 `data:` 안에서 안 열린다).
    // ⚠️ 보는 자리가 move 마다 다르다 — ground 는 **밑**이 `GROUND` 에, air·water 는
    //    **가운데**가 슬롯 가운데에 와야 한다 (닿는 데가 없는 쪽은 가운데가 약속이다).
    // ⚠️ **물은 어항과 도감을 다 잰다** — 어항은 `BOWL_FIT` 안이고 도감은 슬롯 통째라
    //    자리가 다르다. 한쪽만 재면 다른 쪽은 한 번도 안 잰 것이 된다.
    // ⚠️ 1칸 = 4px 로 찍는다 — 앤티에일리어싱 몫(0.25칸)까지 보이는 해상도다
    const Z = 400;
    const cz = document.createElement('canvas');
    cz.width = cz.height = Z;
    const gz = cz.getContext('2d', { willReadFrequently: true });
    const sitRows = [];
    for (const id of Object.keys(Creature.PREVIEW || {})) {
      const c = every.find(x => x.id === id);
      if (!c) continue;
      for (const bowl of (c.move === 'water' ? [true, false] : [false])) {
        let svg = Creature.draw(c, { flat: true, noShadow: true, size: Z, bowl })
          .replace(/href="(?!https?:|data:|#)/g, 'href="' + location.origin + '/');
        for (const m of [...svg.matchAll(/href="(https?:[^"]+)"/g)]) {
          const t = await (await fetch(m[1], { cache: 'no-store' })).text();
          svg = svg.replace(m[0], 'href="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t) + '"');
        }
        const im = new Image();
        await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        gz.clearRect(0, 0, Z, Z);
        gz.fillStyle = '#fff'; gz.fillRect(0, 0, Z, Z);
        gz.drawImage(im, 0, 0, Z, Z);
        const d = gz.getImageData(0, 0, Z, Z).data;
        let lo = -1, hiY = -1;
        for (let y = 0; y < Z; y++) {
          let n = 0;
          for (let x = 0; x < Z; x++) {
            const i = (y * Z + x) * 4;
            if (!(d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248)) n++;
          }
          if (n > 0) { if (lo < 0) lo = y; hiY = y; }
        }
        sitRows.push({ id, move: c.move, bowl, lo: lo / (Z / 100), hi: hiY / (Z / 100) });
      }
    }
    // 닿는 줄은 creature.js 가 내놓는 값에서 뽑는다 — 숫자를 검사기에 적으면 사본이 된다
    const sit = { rows: sitRows, GROUND: Creature.GROUND, TOP_PAD: Creature.TOP_PAD,
                  BOWL: Creature.BOWL_FIT };
    return { res, skip, prev, attrs, fullySwapped, furs, sit, face: Creature.FACE || {} };
  }, SZ);
  await browser.close();
  const out = shots.res, skipped = shots.skip, prev = shots.prev;
  const ATTRS = shots.attrs, fullySwapped = shots.fullySwapped;

  const bad = [];
  const attrMean = {};
  let sym = 0, eyes = 0, hi = 0, blush = 0, eyeMin = 9, symMin = 9, eyeN = 0, hiN = 0;
  let line = 0, lineN = 0, white = 0;
  let seam = 0, seamN = 0, seamRows = 0, tailMin = 1e9, tailN = 0;
  let tiltMax = 0, tiltN = 0;

  for (const c of out) {
    const P = c.px;
    const A = (x, y) => P[(y * SZ + x) * 4 + 3];
    const RGB = (x, y) => P.slice((y * SZ + x) * 4, (y * SZ + x) * 4 + 3);

    // ── ① 상자 안에 다 들어오는가 (뿔·귀가 안 잘린다)
    let cut = '';
    for (let x = 0; x < SZ && !cut; x++) for (let e = 0; e < EDGE; e++)
      if (A(x, e) > 24) cut = `위쪽 (x${x})`;
    for (let y = 0; y < SZ && !cut; y++) for (let e = 0; e < EDGE; e++) {
      if (A(e, y) > 24) cut = `왼쪽 (y${y})`;
      if (A(SZ - 1 - e, y) > 24) cut = `오른쪽 (y${y})`;
    }
    if (cut) bad.push(`${c.name}: 그림이 상자 ${cut} 에서 잘린다`);

    // 그려진 것의 상자
    let y0 = SZ, y1 = 0, x0 = SZ, x1 = 0;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
      if (A(x, y) > 24) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (y1 <= y0) { bad.push(`${c.name}: 아무것도 안 그려졌다`); continue; }
    // 얼굴 띠 — 그려진 것의 위쪽 45%. ⚠️ 꼬리가 아래 오른쪽이라 아래까지 재면
    //    「정면인가」가 꼬리 때문에 늘 거짓이 된다
    const fy0 = y0, fy1 = y0 + Math.round((y1 - y0) * 0.45);

    // ── ② 정면인가 — 얼굴 띠를 좌우로 뒤집어 견딘다
    let same = 0, tot = 0;
    for (let y = fy0; y <= fy1; y++) for (let x = 0; x < SZ; x++) {
      const a = A(x, y) > 24, b = A(SZ - 1 - x, y) > 24;
      if (a || b) { tot++; if (a && b) same++; }
    }
    const s = tot ? same / tot : 0;
    if (s < SYM_MIN) bad.push(`${c.name}: 얼굴이 좌우 대칭이 아니다 (${s.toFixed(2)} · 정면이어야 한다)`);
    sym += s / out.length; if (s < symMin) symMin = s;

    // ── ③ 눈이 큰가 — 먹색(눈·입)의 가로 폭을 그림의 가로 폭과 견딘다
    // ⚠️⚠️ **먹색을 «그림 전체»에서 찾는다 — 띠 안에서 찾으면 안 된다.** 띠를
    //    「위쪽 45%」로 잡으면 뿔 달린 사슴에서는 그 띠가 통째로 뿔이라 눈이
    //    한 픽셀도 안 잡힌다 (실제로 눈 상자가 35×1 로 나왔다).
    //    먹색을 쓰는 데는 **눈과 입뿐**이라 그림 전체를 훑어도 다른 것이 안 섞인다
    const isInk = (x, y) => A(x, y) > 200 && near(RGB(x, y), '#50364e', 26);
    let ex0 = SZ, ex1 = 0, ey0 = SZ, ey1 = 0;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
      if (isInk(x, y)) { if (x < ex0) ex0 = x; if (x > ex1) ex1 = x; if (y < ey0) ey0 = y; if (y > ey1) ey1 = y; }
    // (넓이는 아래 ④ 에서 먹 덩어리를 셀 때 같이 구한다)

    // ── ④ 빛이 «두 점»인가 — **눈동자마다** 밝은 덩어리를 센다
    //
    // ⚠️⚠️ **「둘레가 먹인가」로 가르려다 두 번 헛짚었다.** 흰 빛점과 먹 눈동자 사이에는
    //    안티에일리어싱 한 줄이 끼어 «먹도 흰색도 아닌» 중간색이다 — 그래서 둘레를
    //    물으면 멀쩡한 빛점이 0.0 으로 나와 **서른 마리가 다 「빛이 0점」**이 됐다.
    // ⚠️ 그렇다고 「밝은 덩어리 수」로만 세면 **흰자 조각**이 같이 세어져, 빛점을
    //    통째로 지워도 수가 안 모자란다 (반달 눈이 흰자를 셋으로 쪼개 놓는다).
    // 지금은 **눈동자(먹 덩어리)의 상자 «안»에 중심이 들어오는 밝은 덩어리**만 센다 —
    //    빛점은 눈동자 안이고, 흰자 조각은 그 위·옆이라 중심이 상자 밖이다
    if (c.eye !== 'sleepy') {
      const blobs = (test) => {
        const seen = new Uint8Array(SZ * SZ);
        const list = [];
        for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
          const k = y * SZ + x;
          if (seen[k] || !test(x, y)) continue;
          const st = [k]; seen[k] = 1;
          let n = 0, sx = 0, sy = 0, a0 = SZ, a1 = 0, b0 = SZ, b1 = 0;
          while (st.length) {
            const m = st.pop(), mx = m % SZ, my = (m - mx) / SZ;
            n++; sx += mx; sy += my;
            if (mx < a0) a0 = mx; if (mx > a1) a1 = mx;
            if (my < b0) b0 = my; if (my > b1) b1 = my;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
              const nx = mx + dx, ny = my + dy;
              if (nx < 0 || ny < 0 || nx >= SZ || ny >= SZ) return;
              const q = ny * SZ + nx;
              if (!seen[q] && test(nx, ny)) { seen[q] = 1; st.push(q); }
            });
          }
          list.push({ n, cx: sx / n, cy: sy / n, a0, a1, b0, b1 });
        }
        return list;
      };
      const isLit = (x, y) => {
        const p = RGB(x, y);
        return A(x, y) > 200 && p[0] > 196 && p[1] > 196 && p[2] > 196;
      };
      // ⚠️⚠️ **눈동자는 «작고 둥근» 먹 덩어리다.** 그림에 먹선이 생기자(2026-10-01)
      //    그 선이 **그림 전체를 두른 한 덩어리**가 되어 눈동자로 잡혔다 —
      //    그 상자 안에는 빛점이 다 들어오므로 **④가 「빛 6.4점」으로 통과했다**.
      //    0건이 「통과」가 아니라 **「엉뚱한 것을 쟀다」**인 경우다.
      //    크기와 생김새를 같이 봐야 갈린다 — 크기만 보면 입(먹으로 칠한 활짝 웃는 입)이
      //    끼어들고, 생김새만 보면 먹선 덩어리가 거의 정사각이라 그대로 지나간다
      const pupils = blobs(isInk).filter(k => {
        const w = k.a1 - k.a0 + 1, h = k.b1 - k.b0 + 1;
        return k.n >= 24 && w <= SZ * PUPIL_MAX && h <= SZ * PUPIL_MAX
          && w / h >= PUPIL_AR[0] && w / h <= PUPIL_AR[1]
          && k.n / (w * h) >= PUPIL_FILL;
      });
      // 눈동자의 크기 — **재되 문은 안 건다**(위의 그 이유다)
      const big = pupils.reduce((m, k) => Math.max(m, k.n), 0);
      const r = big / Math.max(1, (x1 - x0) * (y1 - y0));
      eyes += r; eyeN++; if (r < eyeMin) eyeMin = r;
      const lit = blobs(isLit).filter(k => k.n >= 3);
      const per = pupils.map(k =>
        lit.filter(w => w.cx >= k.a0 && w.cx <= k.a1 && w.cy >= k.b0 && w.cy <= k.b1).length);
      // ── ⑪ 눈망울이 «기울지» 않았는가 — **줄마다 가운데가 밀려 올라가지 않는가**
      //
      // 「눈 모양 더 귀엽게 · **위로 쭉 올라간 눈 별로야** · 초롱초롱한 눈망울 위주로」로
      // 받아 아몬드를 버린 자리다 (2026-10-02).
      // ⚠️⚠️ **①~⑩ 어느 것도 이 축을 못 본다** — 기운 아몬드는 «얼굴 안에서» 좌우
      //    거울이라 ② 가 0.99 로 통과하고, 잘리지도 빛이 모자라지도 않는다.
      //    0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
      // ⚠️⚠️ **먹 영역을 «뒤집어 겹쳐» 보는 것으로는 못 잰다 — 두 번 헛짚었다.**
      //    ① 그대로 뒤집으면 **빛점이 낸 구멍**이 어긋난다 (큰 점은 오른쪽 위 ·
      //    작은 점은 왼쪽 아래라 서로 반대 귀퉁이다) — 동그란 눈이 0.50~0.72 로
      //    나왔다 ② 줄마다 양 끝을 이어 구멍을 메워도 **앤티에일리어싱 한 줄**에
      //    흔들려 0.79~0.91 이었다 (머리가 작은 마리는 눈이 16px 이라 한 픽셀이 6% 다).
      // ⚠️ 그래서 **「기울었나」를 바로 잰다** — 줄마다 «가운데»(양 끝의 가운뎃점)를
      //    구해 y 에 대한 기울기를 낸다. 동그란 눈망울은 어느 줄에서나 가운데가
      //    같은 자리라 0 에 가깝고, 기운 아몬드는 위로 갈수록 한쪽으로 밀린다.
      //    **한 픽셀 흔들림은 회귀가 먹어 준다** (한 줄이 아니라 전체 추세다)
      pupils.forEach(k => {
        if (k.n < TILT_MIN_N) return;        // 입처럼 작은 덩어리는 건너뛴다
        const W = k.a1 - k.a0 + 1, pts = [];
        for (let y = k.b0; y <= k.b1; y++) {
          let l = -1, r = -1;
          for (let x = k.a0; x <= k.a1; x++) if (isInk(x, y)) { if (l < 0) l = x; r = x; }
          if (l >= 0) pts.push([y, (l + r) / 2]);
        }
        if (pts.length < 5 || W < 4) return;
        // 최소제곱으로 기울기 하나 — 폭으로 나눠 크기를 안 타게 한다
        const my = pts.reduce((t2, q) => t2 + q[0], 0) / pts.length;
        const mc = pts.reduce((t2, q) => t2 + q[1], 0) / pts.length;
        let sxy = 0, sxx = 0;
        pts.forEach(([y, cx]) => { sxy += (y - my) * (cx - mc); sxx += (y - my) ** 2; });
        if (!sxx) return;
        const slope = Math.abs(sxy / sxx);
        if (slope > tiltMax) tiltMax = slope;
        tiltN++;
        if (slope > TILT_MAX)
          bad.push(`${c.name}: 눈망울이 기울어 있다 (줄마다 가운데가 ${slope.toFixed(2)}`
            + `px 씩 밀린다 · ${TILT_MAX} 까지다 · 「위로 올라간 눈」은 안 쓴다)`);
      });

      // ── ⑧ **흰자가 없는가** — 밝은 덩어리는 «빛점»뿐이어야 한다
      //
      // ⚠️⚠️ 사람이 서른 마리를 놓고 **흰자가 있는 열여섯을 «정확히» 집어**
      //    「사람 눈 같아서 안 귀엽다」고 했다. 남겨 둔 것은 흰자가 없는 눈뿐이다 —
      //    사람이 고른 것이 규칙이 된 자리라, 그 규칙을 여기 못 박는다.
      // ⚠️ **④는 이것을 못 본다** — 흰자가 있어도 빛은 두 점 그대로다.
      //    가르는 것은 「밝은 덩어리가 눈동자에 비해 얼마나 큰가」다
      //    (지금 9% 안팎 · 흰자가 있던 그림은 257%였다)
      let whiteTot = 0;
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
        if (A(x, y) < 200) continue;
        const p = RGB(x, y);
        if (p[0] >= WHITE_LUM && p[1] >= WHITE_LUM && p[2] >= WHITE_LUM) whiteTot++;
      }
      const pupilTot = pupils.reduce((t2, k) => t2 + k.n, 0);
      const wr = whiteTot / Math.max(1, pupilTot);
      if (wr > WHITE_MAX)
        bad.push(`${c.name}: 눈에 흰자가 있다 (거의 흰 칠이 눈동자 넓이의 ${(wr * 100).toFixed(0)}%`
          + ` · ${WHITE_MAX * 100}% 를 넘으면 빛점이 아니라 흰자다)`);
      white = Math.max(white, wr);

      const got = per.filter(n => n >= 2).length * 2 + per.filter(n => n === 1).length;
      if (got < HI_WANT)
        bad.push(`${c.name}: 눈의 빛이 ${got}점이다 (눈마다 두 점 · ${HI_WANT}점이어야 한다`
          + ` · 눈동자 ${pupils.length}개에 [${per.join(',')}])`);
      hi += got; hiN++;
    }

    // ── ⑦ 둘레가 먹선인가 — 줄마다 «제일 바깥 칠»에서 안으로 `LINE_IN` 들어간 점을 본다
    // ⚠️ **상자가 아니라 «칠»에서 되짚는다** — 상자로 재면 귀·꼬리가 비어 있는 줄에서
    //    배경을 집는다. 줄마다 왼쪽 끝·오른쪽 끝 둘을 보고 몇 점 중 몇 점인지를 낸다
    let lineHit = 0, lineTot = 0;
    for (let y = y0 + LINE_IN; y <= y1 - LINE_IN; y++) {
      let lx = -1, rx2 = -1;
      for (let x = 0; x < SZ; x++) if (A(x, y) > 200) { lx = x; break; }
      for (let x = SZ - 1; x >= 0; x--) if (A(x, y) > 200) { rx2 = x; break; }
      if (lx < 0 || rx2 - lx < LINE_IN * 3) continue;
      [lx + LINE_IN, rx2 - LINE_IN].forEach(x => {
        lineTot++;
        if (near(RGB(x, y), LINE_HEX, LINE_TOL)) lineHit++;
      });
    }
    const lr = lineTot ? lineHit / lineTot : 0;
    if (lineTot < 40) bad.push(`${c.name}: 둘레를 잴 수가 없다 (${lineTot}점)`);
    else if (lr > LINE_MAX) bad.push(`${c.name}: 둘레에 먹선이 둘려 있다 (${(lr * 100).toFixed(0)}%`
      + ` · ${LINE_MAX * 100}% 를 넘으면 선이다 · 형태는 «색 면»으로 가른다)`);
    line += lr / out.length; lineN += lineTot;

    // ── ⑨ 귀 이음매 — **귀가 머리에서 «떨어진 자리»가 없는가**
    //
    // 사람이 콕 집어 요청한 자리다 (「귀가 머리 부분에서 떨어진 부분이 없이 잘 이어
    // 붙여 달라」). 귀의 밑동이 머리 «밖»에서 만나면 그 줄에서 실루엣이 한 번
    // «안으로» 꺾였다가 다시 벌어진다 — 눈에는 턱으로 보인다.
    // ⚠️⚠️ **①~⑧ 어느 것도 이 축을 못 본다** — 턱이 나도 잘리지도, 비뚤지도, 선이
    //    생기지도 않는다. 0건이 「통과」가 아니라 **「한 번도 안 쟀다」**인 자리다.
    // ⚠️ **귀를 «떼고 그린 그림»과 견주어** 귀의 자리를 찾는다 — 표를 읽으면
    //    「스스로 맞는」 검사가 된다 (`checkavatar` 의 「맨몸↔옷」과 같은 방법이다)
    if (c.noEar) {
      const B = c.noEar;
      const AB = (x, y) => B[(y * SZ + x) * 4 + 3];
      const edge = (px, y) => {
        let l = -1, r = -1;
        for (let x = 0; x < SZ; x++) if (px[(y * SZ + x) * 4 + 3] > 24) { l = x; break; }
        for (let x = SZ - 1; x >= 0; x--) if (px[(y * SZ + x) * 4 + 3] > 24) { r = x; break; }
        return [l, r];
      };
      let tip = -1, headTop = -1;
      for (let y = 0; y < SZ && tip < 0; y++) for (let x = 0; x < SZ; x++)
        if (A(x, y) > 24 && AB(x, y) <= 24) { tip = y; break; }
      for (let y = 0; y < SZ && headTop < 0; y++) if (edge(B, y)[0] >= 0) headTop = y;
      // 머리가 제일 넓어지는 줄까지 본다 — 그 아래는 몸통이라 다시 좁아지는 것이 맞는다
      let wide = headTop, wideW = -1;
      for (let y = headTop; y < Math.min(SZ, headTop + Math.round(SZ * 0.42)); y++) {
        const [l, r] = edge(B, y);
        if (l >= 0 && r - l > wideW) { wideW = r - l; wide = y; }
      }
      let notch = 0, rows = 0, pl = -1, pr = -1;
      for (let y = Math.max(0, tip) + 2; y <= wide; y++) {
        const [l, r] = edge(P, y);
        if (l < 0) continue;
        if (pl >= 0) { notch = Math.max(notch, l - pl, pr - r); rows++; }
        pl = l; pr = r;
      }
      if (rows < 10) bad.push(`${c.name}: 귀 이음매를 잴 수가 없다 (${rows}줄)`);
      else if (notch > SEAM_MAX)
        bad.push(`${c.name}: 귀가 머리에서 떨어져 있다 (실루엣이 한 줄에 ${notch}px 안으로 꺾인다`
          + ` · ${SEAM_MAX}px 까지 · 귀 밑동을 머리 «안»에 두고 머리를 나중에 그린다)`);
      seam = Math.max(seam, notch); seamRows += rows; seamN++;
    }

    // ── ⑩ 꼬리가 «몸 밖으로» 보이는가
    //
    // 「꼬리의 실루엣이 탐스럽게」로 받은 자리다. 꼬리는 몸 «뒤»에 그리므로 작게 두면
    // 밑동이 통째로 가려 **갈고리 한 조각**만 남는다 (처음에 실제로 그랬다).
    // ⚠️ 꼬리를 떼고 그려 **달라지는 몫**으로 잰다 — 색으로 찾으면 털색이라 몸과 안 갈린다
    if (c.noTail) {
      let outside = 0;
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++)
        if (A(x, y) > 200 && c.noTail[(y * SZ + x) * 4 + 3] <= 24) outside++;
      if (outside < TAIL_MIN)
        bad.push(`${c.name}: 꼬리가 몸에 가려 안 보인다 (몸 밖으로 ${outside}px · ${TAIL_MIN}px 는 돼야 한다)`);
      if (outside < tailMin) tailMin = outside;
      tailN++;
    }

    // ── ⑤ 볼터치가 있는가 — 얼굴에서 «볼터치 색 쪽으로 끌려간» 점을 센다
    const BL = [255, 174, 184];   // 사람 SVG 의 볼터치 색(#ffaeb8)
    const dTo = (p) => Math.hypot(p[0] - BL[0], p[1] - BL[1], p[2] - BL[2]);
    const tallyF = {};
    for (let y = fy0; y <= fy1; y++) for (let x = 0; x < SZ; x++) {
      if (A(x, y) < 240) continue;
      const k = RGB(x, y).join(',');
      tallyF[k] = (tallyF[k] || 0) + 1;
    }
    const coatK = Object.keys(tallyF).sort((a2, b2) => tallyF[b2] - tallyF[a2])[0];
    const coatD = coatK ? dTo(coatK.split(',').map(Number)) : 0;
    let bl = 0;
    for (let y = fy0; y <= y1; y++) for (let x = 0; x < SZ; x++)
      if (A(x, y) > 200 && dTo(RGB(x, y)) < coatD * BLUSH_K) bl++;
    if (bl < BLUSH_MIN) bad.push(`${c.name}: 볼터치가 없다 (볼터치 색 쪽으로 끌려간 점 ${bl})`);
    blush += bl / out.length;

    // ── ⑥ 속성 색 — 아래 절반에서 **제일 많이 쓰인 색**(= 털색)을 모은다.
    // ⚠️ 한 점을 찍어 재면 그 점이 배 판이나 발에 걸려 **옅은 색 둘이 비슷해진다**
    //    (바람 ↔ 물이 22 로 나왔다 — 그림이 아니라 잰 자리가 틀린 것이다)
    const tally = {};
    for (let y = Math.round((y0 + y1) / 2); y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (A(x, y) < 240) continue;
      const p = RGB(x, y), k = p.join(',');
      tally[k] = (tally[k] || 0) + 1;
    }
    const top = Object.keys(tally).sort((a2, b2) => tally[b2] - tally[a2])[0];
    if (top) (attrMean[c.attr] = attrMean[c.attr] || []).push(top.split(',').map(Number));
  }

  // 속성 여섯이 «서로» 갈리는가 — 묽혔다고 속성이 안 읽히면 안 된다
  const mean = {};
  Object.keys(attrMean).forEach(k => {
    const a = attrMean[k];
    mean[k] = [0, 1, 2].map(i => a.reduce((s, p) => s + p[i], 0) / a.length);
  });
  const ks = Object.keys(mean);
  let worst = 1e9, pair = '';
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const d = Math.hypot(...[0, 1, 2].map(n => mean[ks[i]][n] - mean[ks[j]][n]));
    if (d < worst) { worst = d; pair = `${ks[i]}↔${ks[j]}`; }
  }
  // ⚠️⚠️ **한 속성의 마리가 «다» 갈아 끼워지면 그 속성은 잴 것이 없다** (2026-10-06 ·
  //    불 다섯이 다 대고 따라 그린 그림이 됐다). 그때 「여섯이 아니다」로 실패시키면
  //    **그림을 갈아 끼우는 일 자체가 막힌다** — 잣대가 할 일이 아니다.
  //    그래서 **빠진 속성이 «정말 PREVIEW 로 다 덮인 속성인지» 확인하고**(아니면 실패),
  //    몇 가지를 쟀는지 ⚠️ 로 크게 낸다 — 조용히 빠지면 0건이 「통과」로 읽힌다
  const miss = ATTRS.filter(k => !mean[k]);
  const allSwapped = miss.filter(k => !fullySwapped.includes(k));
  if (allSwapped.length) {
    bad.push(`속성 «${allSwapped.join('·')}» 를 한 마리도 안 쟀다`
      + ` — 갈아 끼운 그림 탓이 아니라면 부품 그림이 빠진 것이다`);
  } else if (miss.length) {
    console.log(`⚠️ 속성 «${miss.join('·')}» 는 그 속성의 마리가 «다» 갈아 끼워져 «털색»을 안 쟀다`
      + ` (${ks.length}가지만 쟀다 · 여섯 중 — 문은 아래 「속성 색(서른 마리)」이 맡는다)`);
  }
  // 털색 쪽은 **잰 것을 낼 뿐**이다 — 갈아 끼울수록 줄어드는 잣대라 문으로 쓸 수 없다
  if (ks.length >= 2) {
    if (worst < ATTR_DE) bad.push(`털색이 안 갈린다 (제일 가까운 ${pair} 가 ${worst.toFixed(0)} · ${ATTR_DE} 는 돼야 한다)`);
    else console.log(`  속성 털색 — ${ks.length}가지 · 제일 가까운 ${pair} 가 ${worst.toFixed(0)}`);
  }

  // ═══ ⑥ 의 문 — 속성 색이 **서른 마리에서** 갈리는가 (갈아 끼운 그림도 같이 잰다) ═══
  {
    const furs = shots.furs || {};
    const fm = {};
    Object.keys(furs).forEach(k => {
      const a = furs[k];
      fm[k] = [0, 1, 2].map(i => a.reduce((s, q) => s + q.p[i], 0) / a.length);
    });
    const fk = Object.keys(fm);
    let fw = 1e9, fp = '';
    for (let i = 0; i < fk.length; i++) for (let j = i + 1; j < fk.length; j++) {
      const d = Math.hypot(...[0, 1, 2].map(n => fm[fk[i]][n] - fm[fk[j]][n]));
      if (d < fw) { fw = d; fp = `${fk[i]}↔${fk[j]}`; }
    }
    const nFur = Object.values(furs).reduce((s, a) => s + a.length, 0);
    // ⚠️ **몇 마리를 쟀는지가 짝이다** — 한 마리라도 색을 못 집으면 그 마리는 안 잰 것이다
    if (fk.length < ATTRS.length || nFur < ATTRS.length * 5) {
      bad.push(`속성 색: ${fk.length}가지 · ${nFur}마리밖에 못 쟀다 (여섯 × 다섯이어야 한다)`);
    } else if (fw < ATTR_DE) {
      bad.push(`속성 색이 안 갈린다 (제일 가까운 ${fp} 가 ${fw.toFixed(0)} · ${ATTR_DE} 는 돼야 한다)`);
    } else {
      console.log(`  속성 색(서른 마리) — ${fk.length}가지 · ${nFur}마리 · 제일 가까운 ${fp} 가 ${fw.toFixed(0)}`);
    }
  }

  // ⚠️⚠️ **안 쟀다는 것을 «크게» 말한다** — 미리 보기로 갈아 끼운 마리는 ①~⑪ 이
  //    통째로 안 돈다. 조용히 빠지면 0건이 「통과」로 읽힌다
  if (skipped.length) {
    console.log(`⚠️ 미리 보기로 갈아 끼운 ${skipped.length}마리는 ①~⑪ 을 «안 쟀다» — ${skipped.join(' · ')}`
      + ` (creature.js 의 PREVIEW · 부품 그림이 아니라 대고 따라 그린 SVG 다)`);
    prev.forEach(q => {
      if (q.err) { bad.push(`${q.id}: 미리 보기 그림을 못 받았다 (${q.file} · ${q.err})`); return; }
      // ⚠️ 서버는 모르는 주소에도 `index.html` 을 200 으로 돌려준다 — 「왔는가」가 아니라
      //    **「SVG 가 왔는가」**를 물어야 이름 오타가 걸린다
      if (!q.ok || !/svg/.test(q.ct))
        bad.push(`${q.id}: 미리 보기 그림이 SVG 가 아니다 (${q.file} · ${q.ok ? q.ct : 'HTTP 오류'}`
          + ` · 이름을 틀리면 index.html 이 와서 «흰 상자»가 된다)`);
      else if (!q.wired)
        bad.push(`${q.id}: 그린 그림이 ${q.file} 를 안 가리킨다 (배선이 끊겼다 · 빈 상자가 된다)`);
      else if (q.n < 1024)
        bad.push(`${q.id}: 미리 보기 그림이 거의 비어 있다 (${q.file} · ${q.n}바이트)`);
      else {
        // ⓐ viewBox 가 칠한 데에 바짝 잘려 있는가 — 여백이 곧 「떠 보이는 몫」이다
        if (!q.pad) bad.push(`${q.id}: ${q.file} 의 칠한 범위를 못 쟀다`);
        else {
          const worstPad = Math.max(q.pad.l, q.pad.r, q.pad.t, q.pad.b);
          if (worstPad > PREV_PAD) {
            bad.push(`${q.id}: ${q.file} 의 viewBox 에 여백이 ${worstPad}% 남아 있다`
              + ` (${PREV_PAD}% 까지 · 여백만큼 바닥에서 뜨고 작아진다`
              + ` · 좌${q.pad.l}/우${q.pad.r}/위${q.pad.t}/아래${q.pad.b}%)`);
          }
        }
        // ⓑ 비를 숫자로 안 박았는가 · 맞춤을 «파일»이 선언했는가
        //    (마크업을 본다 — 까닭은 바로 위와 creature.js 쪽 주석에 있다)
        if (!q.full) {
          bad.push(`${q.id}: 그린 그림이 비를 «숫자로» 박고 있다`
            + ` (상자를 다 쓰는가 ${q.full} · 그림마다 비가 달라서 한 값으로는 납작해진다)`);
        }
        if (q.par) {
          bad.push(`${q.id}: <image> 에 preserveAspectRatio="${q.par}" 가 적혀 있다`
            + ` — 크로뮴이 «안 보는» 선언이라 사본만 늘고 늘 거짓일 수 있다`
            + ` (선언하는 자리는 그림 파일뿐이다)`);
        }
        const wantPar = q.move === 'ground' ? 'xMidYMax meet' : 'xMidYMid meet';
        if (q.filePar !== wantPar) {
          bad.push(`${q.id}: ${q.file} 가 맞춤을 «${q.filePar || '(없다)'}» 로 선언했다`
            + ` — ${q.move} 는 «${wantPar}» 여야 한다`
            + ` (ground 는 닿는 줄이 밑변 · air·water 는 닿는 데가 없어 가운데 맞춤이다`
            + ` · 안 적으면 기본값이 가운데라 넓은 그림이 그만큼 뜬다)`);
        }
        // ─ ⓒ 그림 파일에 «움직임»이 섞여 있지 않은가 ─
        //
        // ⚠️⚠️ **애교는 그림이 아니라 게임이 씌운다**(`petidle.js`). 그림에 구우면
        //    둘이 한꺼번에 깨진다:
        //    ① **`prefers-reduced-motion` 이 `<image>` 를 못 넘는다**(재 봤다 · 켜고도
        //       0.8초에 4268칸이 달라졌다) — 멎을 길이 없어진다
        //    ② **viewBox 가 움직임까지 품어야 해서 그 마리만 작아진다** — 쉬는 자세가
        //       상자의 81% 가 되어 「화염 여우 크기가 좀 작은 것 같아」로 신고받았다
        if (q.anim > 0) {
          bad.push(`${q.id}: ${q.file} 안에 애니메이션이 ${q.anim}개 있다`
            + ` — 애교는 petidle.js 가 씌운다 (그림에 구우면 움직임 줄이기에서 못 멎고,`
            + ` viewBox 가 움직임까지 품느라 그 마리만 작아진다)`);
        }
        console.log(`  미리 보기 ${q.id} — ${q.file} 가 SVG 로 온다 (${(q.n / 1024).toFixed(1)}KB`
          + ` · 비 ${q.ar} · 여백 최대 ${q.pad ? Math.max(q.pad.l, q.pad.r, q.pad.t, q.pad.b) : '?'}%`
          + ` · ${q.filePar} · 움직임 ${q.anim}개)`);
      }
    });

    // ─ ⓕ 갈아 끼운 그림이 «닿는 줄»에 오는가 (잰 것은 브라우저 쪽에 있다) ─
    const FLOOR_SLACK = 1;   // 칸 — 지금 서른둘 자리가 다 0.25(앤티에일리어싱)다
    {
      const sit = shots.sit;
      const B = sit.BOWL;
      let worst = 0, worstId = '-';
      sit.rows.forEach(r => {
        const mid = (r.lo + r.hi) / 2;
        const want = r.move === 'ground' ? sit.GROUND
          : (r.bowl ? B.y + B.h / 2 : (sit.TOP_PAD + sit.GROUND) / 2);
        const got = r.move === 'ground' ? r.hi : mid;
        const off = Math.abs(got - want);
        if (off > worst) { worst = off; worstId = r.id + (r.bowl ? '(어항)' : ''); }
        if (off > FLOOR_SLACK) {
          bad.push(`${r.id}${r.bowl ? '(어항)' : ''}: 갈아 끼운 그림이 닿는 줄에서 ${off.toFixed(2)}칸 `
            + `벗어났다 (${r.move} 는 ${r.move === 'ground' ? '밑' : '가운데'}이 ${want} 여야 하는데 `
            + `${got.toFixed(2)} 다 · ${FLOOR_SLACK}칸까지 · 그림 파일의 preserveAspectRatio 와 `
            + `viewBox 밑여백을 본다)`);
        }
      });
      if (!sit.rows.length) bad.push('닿는 줄: 갈아 끼운 그림을 한 자리도 못 쟀다');
      // ⚠️ **요약이 거짓말을 하면 안 된다** — 「다 … 안」은 정말 다 들었을 때만 쓴다
      //    (사보타주에서 frog 가 11.50칸인데 「32자리가 다 1칸 안」으로 찍혔다)
      const over = bad.filter(x => /닿는 줄에서/.test(x)).length;
      console.log(`  닿는 줄 — ${over ? `${sit.rows.length}자리 중 ${over}자리가 ${FLOOR_SLACK}칸을 넘었다`
        : `${sit.rows.length}자리가 다 ${FLOOR_SLACK}칸 안`}`
        + ` (제일 많이 벗어난 것 ${worstId} ${worst.toFixed(2)}칸 · ground 는 밑이 ${sit.GROUND}`
        + ` · air 는 가운데가 ${(sit.TOP_PAD + sit.GROUND) / 2} · 어항은 ${B.y + B.h / 2})`);
    }
  }
  console.log(`크리처 ${out.length}마리 — 대칭 ${sym.toFixed(2)}(최소 ${symMin.toFixed(2)}) · 눈 ${(eyes / Math.max(1, eyeN) * 100).toFixed(1)}%(최소 ${(eyeMin * 100).toFixed(1)}% · ${eyeN}마리)`
    + ` · 빛 ${(hi / Math.max(1, hiN)).toFixed(1)}점(${hiN}마리) · 볼터치 ${blush.toFixed(0)}점 · 거의 흰 칠 ÷ 눈동자 ${(white * 100).toFixed(0)}%`
    + ` · 둘레의 먹선 ${(line * 100).toFixed(0)}%(${lineN}점 · 없어야 한다) · 속성 제일 가까운 쌍 ${pair} ${worst.toFixed(0)}`);
  // **몇 마리를 쟀는지 통과할 때도 낸다** — 0건이 「통과」인지 「한 번도 안 쟀다」인지를 가른다
  console.log(`  눈망울 기울기 — 제일 심한 것 ${tiltMax.toFixed(2)}px/줄 (${tiltN}개)`);
  console.log(`  귀 이음매 — 제일 깊은 턱 ${seam}px (${seamN}마리 · ${seamRows}줄)`
    + ` · 꼬리가 몸 밖으로 제일 적게 나온 마리 ${tailMin === 1e9 ? '-' : tailMin}px (${tailN}마리)`);
  console.log(`  (상자 가장자리 ${EDGE}px · 대칭 ${SYM_MIN} · 빛 ${HI_WANT}점 · 흰자 ${WHITE_MAX * 100}% · 둘레 먹선 ${LINE_MAX * 100}% 아래 · 눈 크기는 재기만 한다)`);
  // ═══ 애교 모션 — 4초 움직이고 10초 쉬는가 (`petidle.js`) ═══
  //
  // 「"화염 여우"가 애교를 부리는 IDLE 애니메이션을 넣고 싶어. 4초 출력 후 10초 가만히
  // 있다가 다시 4초 출력」으로 받고(2026-10-06), 이어서 「"화염 여우" 처럼 바닥에
  // 붙어있는 스타일일 경우, 같은 애니메이션 넣어줘」로 받은 자리다.
  //
  // ⚠️⚠️ **받는 마리는 «목록»이 아니라 규칙이다** — 바닥에 선(`move === 'ground'`)
  //    PREVIEW 크리처가 다 받는다. 그래서 여기서도 목록을 안 적고 **데이터에서 뽑는다** —
  //    그림을 하나 더 넣으면 검사도 저절로 그 마리를 잰다.
  // ⚠️⚠️ **위의 ⓐ~ⓒ 는 이 축을 영영 못 본다** — 거기서 보는 것은 «파일»이고,
  //    지금 그림 여섯은 다 정지 그림이다. 리그를 통째로 안 씌워도 셋이 다 통과한다 —
  //    그래서 **찍어서** 본다.
  // ⚠️⚠️ **한 바퀴의 어디서 시작하는지는 모른다**(판이 실리는 순간부터 돈다).
  //    그래서 시각을 박지 않고 **17초를 촘촘히 훑어 «움직인 구간»과 «쉰 구간»을 찾는다** —
  //    주기를 고쳐도 따라온다.
  // ⚠️ 방이 아니라 **빈 판 위에** 그려 놓고 찍는다 — 방을 찍으면 촛불·먼지가 흔들려
  //    「그림이 움직였는가」를 못 가른다 (가르지 못하는 잣대다)
  let idle = '';
  // ═══ 「바라보는 쪽」이 표에 그대로 남아 있는가 (`FACE_MUST`) ═══
  {
    const face = shots.face;
    const prevIds = prev.map(q => q.id);
    Object.keys(FACE_MUST).forEach(id => {
      if (face[id] !== FACE_MUST[id]) {
        bad.push(`바라보는 쪽: ${id} 가 «${FACE_MUST[id]}» 이어야 하는데 «${face[id] || '(없다)'}» 다`
          + ` — 빠지면 그 마리가 인물에게 등을 돌린 채 선다`);
      }
    });
    Object.keys(face).forEach(id => {
      if (!prevIds.includes(id)) {
        bad.push(`서는 쪽: ${id} 는 대고 따라 그린 그림이 아닌데 FACE 에 있다`
          + ` — 오른쪽에 세우는 것은 갈아 끼운 그림만이다 (PET_WANT 의 airF·groundF 가 그 몫이다)`);
      }
    });
    console.log(`  바라보는 쪽 — ${Object.keys(face).length}마리`
      + ` (${Object.keys(face).map(id => `${id} ${face[id]}`).join(' · ')})`);
  }
  const animIds = prev.filter(q => q.move === 'ground').map(q => q.id);
  if (!animIds.length) {
    console.log('⚠️ 바닥에 선 미리 보기 크리처가 하나도 없다 — 「애교 모션」을 한 번도 안 쟀다');
  } else {
    const SPAN = 17000;                // ms. 한 바퀴(14초)보다 길게 훑는다
    const STEP = 220;                  // ms. 바라는 간격 (찍고 푸는 데 드는 시간은 뺀다)
    const MOVE_CELLS = 40;             // 이만큼 달라지면 «움직였다»로 센다
    const MOVE_MIN = 2.0, REST_MIN = 8.0;   // 초 — 움직인 몫 · 제일 긴 쉼
    // ⚠️ **재서 골랐다** — 잘라 놓으면 **0칸**이고, 지금 제일 적은 마리가 **77칸**이다
    //    (여우 170 · 원숭이 77 · 말랑이 170 · 펭귄 157 · 거북 331 — 가로로 넓은 그림일수록
    //    상자에 낮게 서서 위로 덜 나간다). 그 절반 자리에 둔다
    const OUT_CELLS = 40;              // 상자 «밖»에서 달라지는 칸 (잘리면 0 이 된다)
    // ⚠️ 움직임 줄이기는 **마크업으로 다 보고 픽셀로 한 마리**를 본다 — 끄는 줄이
    //    `idleOn()` 한 곳이라 길이 하나이고, 그래도 「화면이 진짜 멎는가」는 재야 한다
    const shots = animIds.map(id => [id, 'no-preference']).concat([[animIds[0], 'reduce']]);
    for (const [id, rm] of shots) {
      {
        const bw = await chromium.launch({
          executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
        const pg = await bw.newPage({ viewport: { width: 420, height: 420 }, reducedMotion: rm });
        await pg.goto(BASE, { waitUntil: 'load' });
        await pg.waitForFunction(() => window.Creature && window.GameData);
        // ⓓ **리그가 «바닥에 선 마리»에만 붙는가** — 마크업으로 다 본다.
        //    픽셀 검사는 한 마리씩이라, 공중·어항까지 애교를 부리게 되는 사고를
        //    (그 마리가 표본이 아니면) 통째로 못 본다
        const wiring = await pg.evaluate(() => {
          const out = [];
          Object.keys(Creature.PREVIEW).forEach(cid => {
            const c = GameData.RECIPES.map(x => x.result).find(x => x.id === cid);
            if (!c) return;
            const g = Creature.draw(c, { flat: true, idle: true });
            // ⚠️ 「애교」는 두 갈래다 — 공통 리그(`cr-idle`) 또는 그 마리만의 시그니처
            //    (`cr-sig` · `Creature.SIGNATURE`). **둘이 겹치면 애교가 두 겹으로 돈다**
            out.push({ id: cid, move: c.move,
              rig: /class="cr-idle"|class="cr-sig"/.test(g),
              both: /class="cr-idle"/.test(g) && /class="cr-sig"/.test(g),
              sigWant: !!(Creature.SIGNATURE || {})[cid],
              sig: /class="cr-sig"/.test(g),
              // 리그를 안 씌울 때도 그림은 그대로 와야 한다
              img: (g.match(/<image/g) || []).length });
          });
          return out;
        });
        const sigHere = wiring.filter(w => w.sigWant).map(w => w.id);
        wiring.forEach(w => {
          const want = rm !== 'reduce' && w.move === 'ground';
          if (w.rig !== want) {
            bad.push(`애교 모션: ${w.id}(${w.move})에 리그가 ${w.rig ? '붙었다' : '안 붙었다'}`
              + ` — ${rm === 'reduce' ? '움직임 줄이기에서는 아무도 안 받아야 한다'
                : want ? '바닥에 선 마리는 받아야 한다' : '바닥에 선 마리만 받는다'}`);
          }
          if (w.img !== 1) bad.push(`애교 모션: ${w.id} 의 그림이 ${w.img}장이다 (한 장이어야 한다)`);
          if (w.both) bad.push(`애교 모션: ${w.id} 에 공통 리그와 시그니처가 «같이» 붙었다 — 애교가 두 겹으로 돈다`);
          if (want && w.sigWant && !w.sig) {
            bad.push(`애교 모션: ${w.id} 는 시그니처 애교를 받아야 하는데 공통 리그가 붙었다`
              + ` (creature.js 의 SIGNATURE · previewSvg 의 갈래가 끊겼다)`);
          }
        });
        const ok = await pg.evaluate((cid) => {
          const c = GameData.RECIPES.map(x => x.result).find(x => x.id === cid);
          if (!c) return false;
          const h = document.createElement('div');
          h.id = 'idleHost';
          // ⚠️⚠️ **층을 헤더보다 위로 올린다.** 게임의 헤더가 `z-index: 30` 짜리
          //    `position: fixed` 라, 그냥 얹으면 **헤더가 이 판 위에 그려진다** —
          //    그러면 시계·저장 칩이 흔들려 「그림이 움직였는가」를 못 가른다
          //    (실제로 그렇게 짜서 «쉬는 구간 2.8초»가 나왔다)
          // ⚠️ **상자를 그림보다 넉넉히 둔다** — 애교는 상자 밖으로 나가므로(하트가
          //    위로 떠오른다) 꽉 맞춘 판에서는 그 몫이 잘려 덜 움직인 것으로 나온다
          h.style.cssText = 'position:fixed;left:20px;top:20px;width:260px;height:260px;background:#fff;z-index:99999';
          // ⚠️⚠️ **`class="stage-creature"` 를 그대로 쓴다 — 그래야 방의 CSS 를 지난다.**
          //    `overflow: visible` 은 `.stage-creature svg.cr-svg` 에 걸려 있어서,
          //    맨 `<div>` 에 그려 놓고 재면 **그 줄이 한 번도 안 걸리고** 상자 밖이
          //    늘 0칸으로 나온다 (그렇게 짰다가 멀쩡한 다섯이 걸렸다).
          //    자리·크기만 인라인으로 덮어쓴다 (방에서는 `placePet()` 이 정하는 값이다)
          h.innerHTML = `<span class="stage-creature" style="position:absolute;left:30px;top:50px;`
            + `right:auto;bottom:auto;width:200px;height:200px">`
            + Creature.draw(c, { flat: true, size: 200, idle: true }) + `</span>`;
          document.body.appendChild(h);
          return true;
        }, id);
        if (!ok) { bad.push(`애교 모션: ${id} 를 못 찾았다`); await bw.close(); continue; }
        await pg.waitForTimeout(700);
        // ⚠️⚠️ **간격을 «바라는 값»으로 셈하지 않는다 — 찍고 푸는 데 시간이 든다.**
        //    250ms 를 쉰다고 샘플이 250ms 마다 서는 것이 아니라, 한 장에 300ms 쯤
        //    더 걸려 **열다섯 초로 알고 서른 초를 훑었다** — 한 바퀴를 두 번 지나니
        //    「쉬는 구간이 3초뿐」이라는 엉뚱한 값이 나왔다. **시각을 같이 적는다**
        const clip = { x: 20, y: 20, width: 260, height: 260 };
        const fr = [], ts = [];
        const t0 = Date.now();
        while (Date.now() - t0 < SPAN) {
          const at = Date.now();
          fr.push(pngLumGrid(await pg.screenshot({ clip })));
          ts.push(at - t0);
          const left = STEP - (Date.now() - at);
          if (left > 0) await pg.waitForTimeout(left);
        }
        await bw.close();
        // ⓔ **움직임이 상자 «밖»으로 나가는가** — 애교는 기울고 늘어나느라 상자보다
        //    크게 쓰고 하트는 위로 떠오른다. `.cr-svg` 가 `overflow: hidden` 이면
        //    **4초 동안 머리가 잘린다** — 그런데 상자 «안»도 여전히 움직이므로
        //    위의 ①만으로는 한 줄도 안 걸린다 (가르지 못하는 잣대다).
        //    그래서 **크리처 상자 위쪽 띠**에서 달라지는 칸을 따로 센다
        const BOX_TOP = 30;   // 판(20,20) 안에서 크리처가 50px 아래에 선다 → 그 위 30px 띠
        const moved = [];
        let outCells = 0;
        for (let i = 1; i < fr.length; i++) {
          let n = 0, out = 0;
          for (let j = 0; j < fr[0].l.length; j++) {
            if (Math.abs(fr[i - 1].l[j] - fr[i].l[j]) > 0.03) {
              n++;
              if (Math.floor(j / fr[0].w) < BOX_TOP) out++;
            }
          }
          outCells = Math.max(outCells, out);
          moved.push({ dt: (ts[i] - ts[i - 1]) / 1000, m: n > MOVE_CELLS });
        }
        const nMove = moved.filter(x => x.m).reduce((a, x) => a + x.dt, 0);
        let run = 0, rest = 0;
        moved.forEach(x => { run = x.m ? 0 : run + x.dt; rest = Math.max(rest, run); });
        const sec = (k) => k.toFixed(1);
        const span = (ts[ts.length - 1] / 1000).toFixed(1);
        if (rm === 'reduce') {
          // ⚠️ 「리그를 안 씌웠는가」는 바로 위의 ⓓ 가 «마크업»으로 본다. 여기서는
          //    **화면이 진짜로 멎었는가**를 본다 (둘이 보는 것이 다르다)
          if (nMove > 0) bad.push(`애교 모션: ${id} 가 움직임 줄이기에서도 ${sec(nMove)}초 동안 움직인다`);
        } else {
          if (nMove < MOVE_MIN) {
            bad.push(`애교 모션: ${id} 가 ${span}초 동안 ${sec(nMove)}초만 움직였다`
              + ` (${sec(MOVE_MIN)}초 이상 · 씌워 놓고 안 도는 것이다)`);
          }
          if (rest < REST_MIN) {
            bad.push(`애교 모션: ${id} 가 «쉬는 구간»이 ${sec(rest)}초뿐이다`
              + ` (${sec(REST_MIN)}초 이상 · 4초 움직이고 10초 쉬어야 한다)`);
          }
          // ⚠️ 시그니처 애교는 «조금만» 나간다 — 그쪽은 「시그니처」가 마크업으로 본다
          if (outCells < OUT_CELLS && !sigHere.includes(id)) {
            bad.push(`애교 모션: ${id} 의 움직임이 상자 «밖»으로 ${outCells}칸밖에 안 나간다`
              + ` (${OUT_CELLS}칸 이상 · overflow 가 hidden 이면 4초 동안 머리가 잘린다`
              + ` · 상자 안은 그대로 움직이므로 ①로는 한 줄도 안 걸린다)`);
          }
          idle += `${idle ? ' · ' : ''}${id} ${sec(nMove)}초 움직이고 ${sec(rest)}초 쉰다`
            + `(상자 밖 ${outCells}칸)`;
        }
      }
    }
  }
  // ═══ 시그니처 애교 — 그 마리만의 움직임 파일 (`Creature.SIGNATURE` · 2026-10-08) ═══
  //
  // 🔥 홍염 원숭이의 애교를 사람이 통째로 보내 줬다 (몸이 모핑하고 불꽃·연기가 인다).
  // 위의 「애교 모션」이 «움직이는가 · 쉬는가 · 밖으로 나가는가»를 보지만, 그것만으로는
  // 이 갈래만의 사고 둘을 못 본다:
  //   ① **적어 둔 `vb`·`rest` 가 파일과 갈린다** — 쉬는 자세가 정지 그림과 다른 자리에
  //      서서, 움직임이 끝날 때마다(또는 움직임 줄이기로 바꿀 때) 크리처가 «튄다».
  //      그래서 파일을 열어 viewBox 를 견주고, **정지 그림과 나란히 세워 쉬는 자세를 견준다**
  //   ② **한 바퀴가 14초가 아니다** — 받은 그대로(6.2초) 넣으면 거의 쉬지 않는다.
  //      위의 픽셀 검사도 잡지만 여기서는 «왜»를 말해 준다
  // ⚠️ 쉬는 자세는 **«파일»이 아니라 «화면»에서** 잰다 — 정지 그림과 나란히 세워 칠한
  //    상자를 견준다. 파일 속 칠한 상자를 재면 정지 그림의 viewBox 여백(1.5~2%)을 못 봐서
  //    쉬는 자세만 3% 큰 것을 통과시킨다 (처음 짠 잣대가 그랬다)
  {
    const SIG = await (async () => {
      const bw = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
      const pg = await bw.newPage({ viewport: { width: 420, height: 420 } });
      await pg.goto(BASE, { waitUntil: 'load' });
      await pg.waitForFunction(() => window.Creature);
      const table = await pg.evaluate(() => Creature.SIGNATURE || {});
      const out = [];
      for (const id of Object.keys(table)) {
        const t = table[id];
        const r = await pg.evaluate(async (href) => {
          const res = await fetch('/' + href);
          return { ok: res.ok, ct: res.headers.get('content-type') || '', text: res.ok ? await res.text() : '' };
        }, t.href);
        const q = { id, t, ok: r.ok && /svg/.test(r.ct), ct: r.ct, kb: r.text.length / 1024 };
        if (q.ok) {
          const vb = /<svg[^>]*viewBox="([^"]*)"/.exec(r.text);
          q.vb = vb ? vb[1].split(/[\s,]+/).map(Number) : null;
          q.durs = [...new Set((r.text.match(/dur="[^"]*"/g) || []))];
          q.anims = (r.text.match(/<animate/g) || []).length;
          // 정지 그림과 시그니처를 **나란히 같은 크기로** 세워 한 바퀴(14초)를 훑는다.
          // ⚠️ `<image>` 속 움직임은 멈출 수 없어서(그림 문서 «안»의 시계다) 시각을 못
          //    박는다 — 대신 칠한 상자의 **제일 흔한 값**(= 쉬는 자세)을 정지 그림과 견준다.
          //    쉬는 몫이 한 바퀴의 3분의 2 라 그것이 곧 쉬는 자세다
          const p2 = await bw.newPage({ viewport: { width: 520, height: 300 } });
          await p2.goto(BASE, { waitUntil: 'load' });
          await p2.waitForFunction(() => window.Creature && window.GameData);
          await p2.evaluate((cid) => {
            const c = GameData.RECIPES.map(x => x.result).find(x => x.id === cid);
            const h = document.createElement('div');
            h.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:300px;background:#fff;z-index:99999';
            const box = (l, idle) => `<span class="stage-creature" style="position:absolute;left:${l}px;`
              + `top:60px;right:auto;bottom:auto;width:200px;height:200px">`
              + Creature.draw(c, { flat: true, noShadow: true, size: 200, idle }) + `</span>`;
            h.innerHTML = box(20, false) + box(280, true);
            document.body.appendChild(h);
          }, id);
          await p2.waitForTimeout(400);
          // ⓔ 를 대신한다 — 이 그림은 상자 밖으로 «조금»(연기 한 줌 · 4칸 뜀)만 나가서
          //    픽셀로 세는 문턱(40칸)이 못 가른다. 그래서 **마크업으로** 본다:
          //    그림 상자가 크리처 상자보다 위로 나가는가 · 그 svg 가 안 자르는가
          const ov = await p2.evaluate(() => {
            const sp = document.querySelectorAll('.stage-creature')[1];
            const svg = sp && sp.querySelector('svg.cr-svg');
            const im = svg && svg.querySelector('.cr-sig image');
            if (!im) return { over: false, why: '시그니처 그림을 못 찾았다' };
            const a = svg.getBoundingClientRect(), b = im.getBoundingClientRect();
            const ovf = getComputedStyle(svg).overflow;
            return { over: b.top < a.top - 1 && ovf === 'visible',
              why: `그림 위 ${(a.top - b.top).toFixed(1)}px 밖 · overflow ${ovf}` };
          });
          q.over = ov.over; q.overWhy = ov.why;
          const ink = (img, x0, x1) => {
            let a = 1e9, b2 = 1e9, c2 = -1, d = -1;
            for (let y = 0; y < img.h; y++) for (let x = x0; x < x1; x++) {
              const i = (y * img.w + x) * 4;
              if (img.px[i] + img.px[i + 1] + img.px[i + 2] < 740) {
                a = Math.min(a, x - x0); c2 = Math.max(c2, x - x0); b2 = Math.min(b2, y); d = Math.max(d, y);
              }
            }
            return [a, b2, c2, d];
          };
          const seen = new Map();
          let still = null;
          const t0 = Date.now();
          while (Date.now() - t0 < 14500) {
            const img = decode(await p2.screenshot());
            still = ink(img, 0, 260);
            const k = ink(img, 260, 520).join(',');
            seen.set(k, (seen.get(k) || 0) + 1);
            await p2.waitForTimeout(250);
          }
          await p2.close();
          const [mode, cnt] = [...seen.entries()].sort((x, y) => y[1] - x[1])[0];
          const total = [...seen.values()].reduce((x, y) => x + y, 0);
          q.still = still; q.rest = mode.split(',').map(Number);
          q.restShare = cnt / total; q.shapes = seen.size;
        }
        out.push(q);
      }
      await bw.close();
      return out;
    })();
    const TOL = 1;     // px — 200px 상자에서 앤티에일리어싱 한 줄까지만 봐준다
    SIG.forEach(q => {
      if (!q.ok) { bad.push(`시그니처: ${q.id} 의 ${q.t.href} 가 SVG 로 안 온다 (${q.ct || '없다'})`); return; }
      if (!q.vb || q.vb.some((v, i) => Math.abs(v - q.t.vb[i]) > 0.01)) {
        bad.push(`시그니처: ${q.id} — 파일의 viewBox(${q.vb})와 SIGNATURE.vb(${q.t.vb})가 다르다`
          + ` (둘은 짝이다 · 갈리면 쉬는 자세가 정지 그림과 다른 자리에 선다)`);
      }
      // ⚠️ 박자를 숫자로 못 박지 않는다 — «얼마나 쉬는가»는 아래 「애교 모션」이 픽셀로 잰다.
      //    여기서는 «한 박자로 도는가 · 받은 그대로(6.2초)가 아닌가»만 본다
      const durS = q.durs.length === 1 ? parseFloat(q.durs[0].slice(5)) : NaN;
      if (!(durS >= 14)) {
        bad.push(`시그니처: ${q.id} 의 한 바퀴가 ${q.durs.join(',') || '(없다)'} 다`
          + ` — 한 박자여야 하고 14초 이상이어야 한다 (받은 6.2초 그대로면 거의 안 쉰다 · tools/gensig.js 로 굽는다)`);
      }
      if (!q.over) {
        bad.push(`시그니처: ${q.id} 의 움직임이 상자 밖으로 못 나간다 (${q.overWhy})`
          + ` — 불꽃·연기가 머리 위에서 잘린다`);
      }
      if (!q.anims) bad.push(`시그니처: ${q.id} 의 파일에 움직임이 하나도 없다`);
      const d = Math.max(...q.rest.map((v, i) => Math.abs(v - q.still[i])));
      if (d > TOL) {
        bad.push(`시그니처: ${q.id} 의 쉬는 자세가 정지 그림과 ${d}px 어긋난다`
          + ` (정지 ${q.still} · 시그니처 ${q.rest} — SIGNATURE.rest 가 «정지 그림의 viewBox» 와 갈렸다`
          + ` · 움직임 줄이기로 바꾸거나 한 바퀴가 끝날 때마다 크리처가 튄다)`);
      }
      if (q.restShare < 0.45) {
        bad.push(`시그니처: ${q.id} 가 한 바퀴의 ${(q.restShare * 100).toFixed(0)}% 만 쉰다`
          + ` — 쉬는 자세를 못 찾았다 (14초에 6.2초 움직이면 절반 넘게 쉬어야 한다)`);
      }
      if (q.shapes < 3) bad.push(`시그니처: ${q.id} 가 한 바퀴 동안 모양이 ${q.shapes}가지뿐이다 — 안 움직인다`);
    });
    console.log(`  시그니처 애교 — ${SIG.length}마리`
      + (SIG.length ? ` (${SIG.map(q => `${q.id} ${q.kb.toFixed(0)}KB · ${q.durs ? q.durs.join(',') : '?'}`
        + ` · 쉬는 몫 ${q.restShare ? (q.restShare * 100).toFixed(0) : '?'}% · 정지 그림과 ${q.rest ? Math.max(...q.rest.map((v, i) => Math.abs(v - q.still[i]))) : '?'}px`).join(' · ')})` : ''));
  }
  // **몇 마리를 쟀는지 통과할 때도 낸다** — 0건이 「통과」인지 「안 쟀다」인지를 가른다
  if (idle) console.log(`  애교 모션 — 바닥에 선 ${animIds.length}마리 (${idle})`
    + ` · 움직임 줄이기에서는 멎는다`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.slice(0, 20).forEach(m => console.log('   ' + m));
    if (bad.length > 20) console.log(`   … 그리고 ${bad.length - 20}건 더`);
    process.exit(1);
  }
  if (out.length + skipped.length !== 30) {
    console.log(`❌ 서른 마리 중 ${out.length + skipped.length}마리만 봤다 (잰 것 ${out.length} · 건너뛴 것 ${skipped.length})`);
    process.exit(1);
  }
  console.log(`✅ ${out.length}마리가 다 상자 안에 들어오고, 정면을 보고, 눈이 크고, 선 없이 색 면으로 서 있다`
    + (skipped.length ? ` (미리 보기 ${skipped.length}마리는 빼고)` : ''));
})().catch(e => { console.error(e); process.exit(1); });
