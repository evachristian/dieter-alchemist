// 마이 룸 꾸미기 — **자리 아홉 × 단계 넷 · 벽지 다섯 · 바닥재 다섯**을 축 표에서 뽑는다
//
// 손으로 늘리지 않는 이유는 옷 150벌·크리처 30종·특수 작물 6종과 같다 —
// **한국어와 영어가 같은 줄에서 같이 나오면** 한쪽만 늘어나는 일이 없다.
// 자리 표(ROOM_SLOTS) · 단계(ROOM_TIERS) · 소품 46개(ROOM_DECOR) · 영어 이름이
// 여기서 한 번에 나온다.
//
//   node tools/genroom.js           다시 뽑아 data.js · i18n.js 에 써 넣는다
//   node tools/genroom.js --check   파일과 어긋났는지만 본다 (npm test 가 부른다)
//
// ⚠️⚠️ **그림은 여기 없다.** 소품의 «생김새»는 `roomart.js` 의 `SLOT_ART[자리](g,w,h,t)`
//    한 곳이고, 3D 방과 SVG 폴백이 **그 함수 하나**를 같이 쓴다 — 두 벌로 두면
//    한쪽만 고쳐 갈린다 (`ROOM.md` 3장). 여기서 나오는 것은 «표»뿐이다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ─── 축 하나 · 자리 아홉 ──────────────────────────────────────
//
// 자리는 **고정**이다 (사람이 그렇게 정했다) — 「어디에 놓을까」가 아니라
// 「그 자리에 무엇을 놓을까」가 이 기능이다. 끌어다 놓기는 폰에서 방을 쓸어
// 내리려다 소품이 따라 움직이는 손짓이라 여기 화면에는 안 맞는다.
//
//   `p3`  3D 방의 자리 — [x, y, z] 와 `yaw`. **이미 서 있던 조각에서 읽은 값**이다
//   `p2`  SVG 폴백의 자리 — [x, y, w, h] (방 좌표 400×320). **재서** 넣었다
//   `light`  광원 자리 (벽등 · 촛불 · 샹들리에) — 단계가 오르면 빛도 세진다
//   `on`     무엇 위에 놓이는가. `table` 이면 **탁자가 없으면 같이 안 보인다**
const SLOTS = [
  // ⚠️⚠️ **`p2` 와 `p3` 가 «같은 크기»여야 한다 — 러그는 그것을 잴 수 있는 유일한 자리다.**
  //    카메라의 기준(`FLOOR_R` 2.35 · SVG 는 `Avatar.floorMark().half` 150)이 1칸 = 63.8vb
  //    라, 3.9칸짜리 러그는 vb 로 **249** 다. 처음에 300(= 기준 그대로)으로 두었더니
  //    3D 와 SVG 의 러그가 **91px 어긋났고**, WebGL 이 없는 기기로 떨어지는 순간 바닥이
  //    통째로 달라 보였다 (`checkroom` ②가 그것을 잡는다)
  { id: 'rug', emoji: '🟠', ko: '러그', en: 'Rug', kind: 'floor',
    p3: { x: 0, y: 0.016, z: 0, w: 3.9, h: 3.9 }, p2: [76, 268, 248, 40] },
  { id: 'shelf', emoji: '📚', ko: '책장', en: 'Bookshelf', kind: 'card',
    p3: { x: -2.22, y: 1.67, z: -3.5, yaw: 0.07, w: 2.4, h: 3.08 }, p2: [16, 116, 96, 116] },
  // ⚠️⚠️ **벽등은 «한 짝»이다 — 처음에 좌우 한 쌍으로 뒀다가 되돌렸다.**
  //    오른쪽 벽은 창이 통째로 차지하고(`x 1.25~3.75`) 커튼·화분까지 그 둘레라,
  //    짝을 맞추면 반드시 창과 겹치거나 화면 밖으로 나간다 (재 보고 알았다).
  //    왼쪽 위 — 책장(`y ≤ 3.2`) 위의 빈 벽이 이 방에서 등을 걸 수 있는 유일한 자리다
  { id: 'sconce', emoji: '🔆', ko: '벽등', en: 'Wall Lamp', kind: 'card', light: 2.3,
    p3: { x: -2.35, y: 4.05, z: -4.13, w: 0.86, h: 1.41 }, p2: [50, 52, 34, 56] },
  { id: 'table', emoji: '🪵', ko: '탁자', en: 'Table', kind: 'card',
    p3: { x: 1.85, y: 0.82, z: -1.5, yaw: -0.18, w: 2.4, h: 1.63 }, p2: [232, 210, 112, 66] },
  // ⚠️⚠️ **탁자 «위»는 카드 한가운데가 아니라 «천판의 윗면»이다.** 가운데에 맞췄더니
  //    솥과 촛불이 탁자 위 허공에 떠 있었다 (찍어 보고 알았다) — `tableTex` 가 천판을
  //    카드 높이의 48% 자리에 그리므로, 여기 얹는 것의 «밑변»이 그 줄에 와야 한다
  { id: 'candle', emoji: '🕯️', ko: '촛불', en: 'Candle', kind: 'card', light: 1.7, on: 'table',
    p3: { x: 2.5, y: 1.22, z: -1.36, yaw: -0.18, w: 0.5, h: 0.74 }, p2: [306, 212, 20, 30] },
  { id: 'gear', emoji: '⚗️', ko: '실험 도구', en: 'Lab Set', kind: 'card', on: 'table',
    p3: { x: 1.5, y: 1.275, z: -1.36, yaw: -0.18, w: 1.1, h: 0.85 }, p2: [246, 206, 46, 36] },
  { id: 'curtain', emoji: '🪟', ko: '커튼', en: 'Curtain', kind: 'card',
    p3: { x: 2.5, y: 3.74, z: -4.02, w: 3.0, h: 3.62 }, p2: [242, 86, 120, 130] },
  // ⚠️ **탁자보다 «앞»에 둔다**(z). 창 밑(z −2.55)에 두었더니 탁자가 통째로 가려서
  //    화면에 한 번도 안 보였다 — 자리는 맞는데 «보이지 않는» 소품이 된다 (찍어 보고 알았다)
  { id: 'winplant', emoji: '🪴', ko: '화분', en: 'Potted Plant', kind: 'card',
    p3: { x: 2.35, y: 0.62, z: -0.75, yaw: -0.34, w: 0.96, h: 1.24 }, p2: [344, 224, 44, 56] },
  { id: 'chandelier', emoji: '💠', ko: '샹들리에', en: 'Chandelier', kind: 'hang', light: 2.6,
    p3: { x: 0, y: 4.7, z: -1.9, w: 1.7, h: 1.7 }, p2: [152, 4, 96, 74] },
];

// ─── 단계 넷 — 소박한 것에서 럭셔리한 것으로 ──────────────────
//
// ⚠️ **이름을 「1단계」로 두지 않는다.** 화면에 「러그 2단계」라고 뜨면 그것은
//    숫자이고, 「나무 러그」라야 물건이다 (비법서 장이 「6장」에서 이름으로
//    바뀐 것과 같은 자리다).
// `cost` 는 상점에서 사는 값(현자의 결정). 첫 단계는 **보상으로만** 들어온다(0)
// `cozy` 는 **아늑함 몫**이다 — 아래 `COZY` 항을 볼 것
const TIERS = [
  { id: 'plain', ko: '소박한', en: 'Humble', cost: 0, cozy: 1 },
  { id: 'wood', ko: '나무', en: 'Wooden', cost: 60, cozy: 2 },
  { id: 'ornate', ko: '장식된', en: 'Ornate', cost: 140, cozy: 3 },
  { id: 'royal', ko: '왕실', en: 'Royal', cost: 260, cozy: 4 },
];

// ─── 아늑함 — 「놓아 두면 도는 것」 ────────────────────────────
//
// 아늑함 = 놓인 소품의 `cozy` 합 ÷ 만점(자리 아홉 × 제일 높은 단계). 0~100% 다.
//
// ⚠️⚠️ **자재(벽지·바닥재)는 안 센다.** 다섯 × 다섯이 다 호환되는 «취향»이라
//    등급이 없고, 세는 순간 「아늑한 벽지」가 생겨 그것이 곧 등급이 된다 —
//    사람이 「다 호환된다」고 정한 것과 정면으로 부딪힌다.
//
// ⚠️⚠️ **효과는 둘 다 «덜 잃는» 쪽이다** — 방은 «쉬는 곳»이라 그것이 맞고,
//    무엇보다 **더 얻는 쪽으로 두면 꾸미기가 숙제가 된다**: 「오늘 방을 꾸며야
//    이만큼 더 번다」가 되는 순간 코지 게임에서 제일 나쁜 관리 압박이다.
//    그래서 ① 방치 감소를 덜 받고 ② 쉬는 동안 스태미나가 조금 더 찬다.
//
// ⚠️⚠️ **포만감에는 안 붙인다 — 일부러 뺐다.** 「아늑한 방에서는 덜 허기진다」가
//    제일 그럴듯한데, 그러면 방이 **혼자 먹은 밤을 막아 준다** — 「덜 먹는 게임이
//    아니라 혼자 먹지 않는 게임이다」(EXERCISE.md)가 통째로 무너진다.
//    방이 «연결»의 대체물이 되면 안 된다 (그것이 이 게임의 주제다).
//
// ⚠️ 수치는 **작게** 둔다. 만점에서도 둘 다 4분의 1 안쪽이라, 안 꾸민 사람이
//    손해라고 느끼지 않는다 — 꾸미기는 여전히 «하고 싶어서 하는 일»이다
const COZY = {
  decay: 25,   // 방치 감소(근성·단련)를 만점에서 이만큼 깎아 준다 (%)
  rest: 15,    // 쉬는 동안 스태미나 회복이 만점에서 이만큼 더 붙는다 (%)
};

// 벽지·바닥재 한 장의 값. ⚠️ **단계가 없으니 값도 하나다** — 취향이지 등급이 아니라
// 「비싼 벽지」가 있으면 그게 곧 등급이 된다 (사람이 「다 호환된다」고 정했다)
const MAT_COST = 90;

// ─── 크리처 어항 자리 — **비워 두는 곳** ──────────────────────
//
// ⚠️⚠️ **소품 자리가 아니다. «비워 두는» 자리다.** 방의 크리처(어항)는 3D 도 SVG 도
//    아니고 **DOM 의 SVG** 이고, `game.js` 의 `placePet()` 이 «그려진 치마 옆선»을
//    재서 **인물 왼쪽 바닥**에 세운다 — 즉 자리는 이미 정해져 있었고, 꾸미기가
//    할 일은 **거기에 소품을 놓지 않는 것**이다.
// ⚠️ 그래서 좌표를 여기 적는 이유는 «그리려고»가 아니라 **검사하려고**다:
//    다음에 자리를 하나 늘릴 때 이 칸을 물면 어항 위에 소품이 겹친다 —
//    화면에는 둘이 멀쩡히 서 있고 어항만 가려진다 (그 종류를 눈으로는 못 잡는다).
//    `p2` 는 방 좌표(400×320)로 잰 크리처의 상자다
const PET_SPOT = { p2: [90, 236, 80, 68], p3: { x: -2.6, z: 0.6 } };

// ─── 기본 자재 — 벽지 다섯 · 바닥재 다섯 ──────────────────────
//
// ⚠️⚠️ **다섯 × 다섯이 «다» 호환된다** (사람이 그렇게 요청했다) — 그래서 자재는
//    소품과 달리 «단계»가 없다. 취향이지 등급이 아니다.
// ⚠️ 색은 **두 renderer 가 같이 읽는다** — 3D 는 이 색으로 무늬를 굽고 SVG 폴백은
//    같은 색으로 그라데이션을 깐다. 색이 한 곳이라 폴백으로 떨어져도 «같은 방»이다
const WALLS = [
  { id: 'rw_lime', emoji: '🤍', ko: '흰 회벽', en: 'Limewash', c: ['#efe3d2', '#d8c6ad'], seam: 'rgba(62,44,34,0.40)' },
  { id: 'rw_rose', emoji: '🩷', ko: '장미 벽지', en: 'Rose Damask', c: ['#f0d3dc', '#d3a4b6'], seam: 'rgba(120,58,86,0.34)' },
  { id: 'rw_sage', emoji: '💚', ko: '세이지 벽지', en: 'Sage Stripe', c: ['#dce6d2', '#a8bd9c'], seam: 'rgba(52,80,52,0.32)' },
  { id: 'rw_indigo', emoji: '💙', ko: '쪽빛 벽지', en: 'Indigo Weave', c: ['#cdd6ef', '#8d9ac6'], seam: 'rgba(44,52,96,0.36)' },
  { id: 'rw_gold', emoji: '💛', ko: '금박 벽지', en: 'Gilt Panel', c: ['#f4e3bc', '#d8b978'], seam: 'rgba(120,88,28,0.34)' },
];
const FLOORS = [
  { id: 'rf_pine', emoji: '🟨', ko: '소나무 널', en: 'Pine Board', c: ['#c79b6b', '#b68a5c', '#c0925f', '#b0834f'] },
  { id: 'rf_oak', emoji: '🟫', ko: '떡갈나무 널', en: 'Oak Board', c: ['#a9754c', '#9d6b45', '#ab7750', '#94643f'] },
  { id: 'rf_walnut', emoji: '🟤', ko: '호두나무 널', en: 'Walnut Board', c: ['#7b5238', '#6d4830', '#815740', '#674230'] },
  { id: 'rf_tile', emoji: '⬛', ko: '검고 흰 타일', en: 'Chequer Tile', c: ['#e6ded0', '#4b4650', '#ded5c6', '#413d47'] },
  { id: 'rf_marble', emoji: '⬜', ko: '대리석', en: 'Marble', c: ['#e9e6ee', '#dcd6e4', '#efecf3', '#d3cddd'] },
];

// ─── 처음에 서 있는 방 ────────────────────────────────────────
//
// ⚠️⚠️ **공주는 «창문 하나만 있는 방»으로 들어온다** (사람이 그렇게 정했다).
//    그래서 소품의 기본값은 **하나도 없음**이고, 자재만 한 벌 깔려 있다 —
//    벽과 바닥이 «없는» 방은 그릴 수가 없으니 그 둘은 취향의 기본값이다.
const START_WALL = 'rw_lime';
const START_FLOOR = 'rf_pine';

// ─── 공방 단계가 «주는» 한 벌 ─────────────────────────────────
//
// ⚠️⚠️ **단계는 이제 소품을 «보여 주지» 않고 «준다».** 예전에는 `ROOM_LEVELS` 가
//    그 단계에 무엇이 놓이는지를 정했는데, 그러면 사람이 고를 자리가 없다.
//    지금 단계가 하는 일은 ① 방의 «껍데기»(금·굽도리·몰딩·아치·금장식)와
//    ② **오를 때 소품 한 벌을 선물하는 것** 둘이다.
// ⚠️ 그래서 «빼앗지 않는다» — 예전에 2단계에서 보이던 러그·책장은 2단계에서 들어온다
// ⚠️⚠️ **첫 단계 아홉은 «다» 여기 있어야 한다.** 첫 단계는 값이 0 이라 상점에서
//    못 사므로, 선물 목록에서 빠진 자리는 **영영 못 얻는 소품**이 된다 — 화면에는
//    자물쇠만 뜨고 아무리 해도 안 풀린다 (클레멘에게 호감도 조건을 걸 수 없던 것과
//    같은 종류의 조용한 막힘이다). 아래 검사가 아홉을 다 셌는지 본다.
// ⚠️ 나머지 스물일곱(나무·장식된·왕실)은 **상점**이 준다 — 이야기가 첫 벌을 주고
//    꾸미는 재미는 모아서 사는 데서 온다
const LEVEL_GIFT = {
  2: ['rp_rug_plain', 'rp_shelf_plain'],
  3: ['rp_table_plain', 'rp_curtain_plain', 'rp_winplant_plain'],
  4: ['rp_sconce_plain', 'rp_candle_plain', 'rp_gear_plain'],
  5: ['rp_chandelier_plain'],
};

// ─── 검사 ─────────────────────────────────────────────────────
const problems = [];
{
  const seen = new Set();
  for (const s of SLOTS) {
    if (seen.has(s.id)) problems.push(`자리 id 가 겹친다: ${s.id}`);
    seen.add(s.id);
    if (s.on && !SLOTS.some(x => x.id === s.on)) problems.push(`${s.id} 가 없는 자리 위에 놓인다: ${s.on}`);
    if (!s.p2 || s.p2.length !== 4) problems.push(`${s.id} 에 SVG 자리(p2)가 없다`);
  }
  const ids = new Set();
  for (const s of SLOTS) for (const t of TIERS) {
    const id = `rp_${s.id}_${t.id}`;
    if (ids.has(id)) problems.push(`소품 id 가 겹친다: ${id}`);
    ids.add(id);
  }
  for (const w of WALLS.concat(FLOORS)) {
    if (ids.has(w.id)) problems.push(`자재 id 가 소품과 겹친다: ${w.id}`);
    ids.add(w.id);
  }
  if (!WALLS.some(w => w.id === START_WALL)) problems.push(`시작 벽지가 표에 없다: ${START_WALL}`);
  if (!FLOORS.some(f => f.id === START_FLOOR)) problems.push(`시작 바닥재가 표에 없다: ${START_FLOOR}`);
  // ⚠️ 선물 목록이 «없는 소품»을 가리키면 그 단계가 조용히 아무것도 안 준다
  for (const lv of Object.keys(LEVEL_GIFT)) {
    for (const id of LEVEL_GIFT[lv]) {
      if (!ids.has(id)) problems.push(`${lv}단계 선물에 없는 소품이 있다: ${id}`);
    }
  }
  // ⚠️ **첫 단계(plain)는 상점에서 못 산다** — 보상으로만 들어오는 것이 「꾸미기가
  //    진행의 보상이다」를 지킨다. 표에서 값이 붙으면 그 약속이 조용히 깨진다
  if (TIERS[0].cost !== 0) problems.push('첫 단계에 값이 붙어 있다 — 보상으로만 들어와야 한다');
  for (let i = 1; i < TIERS.length; i++) {
    if (TIERS[i].cost <= TIERS[i - 1].cost) problems.push(`단계 값이 안 오른다: ${TIERS[i].id}`);
  }
  // ⚠️⚠️ **못 얻는 소품이 하나도 없어야 한다** — 값이 0 인 것은 선물 목록에 있어야 하고,
  //    선물 목록에 없는 것은 값이 있어야 한다
  const gifted = new Set(Object.keys(LEVEL_GIFT).flatMap(lv => LEVEL_GIFT[lv]));
  for (const s of SLOTS) for (const t of TIERS) {
    const id = `rp_${s.id}_${t.id}`;
    if (t.cost === 0 && !gifted.has(id)) problems.push(`못 얻는 소품이다 (값 0 · 선물에도 없다): ${id}`);
    if (t.cost > 0 && gifted.has(id)) problems.push(`선물인데 값도 붙어 있다: ${id}`);
  }
  if (MAT_COST <= 0) problems.push('자재 값이 0 이다 — 시작 자재 둘 말고는 못 얻는다');
  // ─── 아늑함 ───────────────────────────────────────────────
  // ⚠️ **몫이 «오르지 않으면» 단계가 아늑함에 아무 일도 안 한다** — 왕실 러그와
  //    소박한 러그가 같은 값이면 비싼 것을 살 이유가 하나 줄어든다
  for (let i = 1; i < TIERS.length; i++) {
    if (!(TIERS[i].cozy > TIERS[i - 1].cozy)) problems.push(`아늑함 몫이 안 오른다: ${TIERS[i].id}`);
  }
  if (!(TIERS[0].cozy > 0)) problems.push('첫 단계의 아늑함 몫이 0 이다 — 선물 한 벌이 아무 일도 안 한다');
  // ⚠️⚠️ **효과가 커지면 꾸미기가 숙제가 된다.** 4분의 1 을 천장으로 못 박아 둔다 —
  //    수치를 올리고 싶어질 때 이 줄이 먼저 막는다 (코지 게임에서 관리 압박은 독이다)
  for (const k of Object.keys(COZY)) {
    if (!(COZY[k] > 0)) problems.push(`아늑함 효과가 0 이다: ${k} — 붙여 놓고 아무 일도 안 한다`);
    if (COZY[k] > 25) problems.push(`아늑함 효과가 너무 크다: ${k} ${COZY[k]}% (천장 25%)`);
  }
  // ⚠️⚠️ **어항 자리를 소품이 물면 안 된다.** 바닥에 «깔리는» 것(러그)은 어항 «밑»이라
  //    괜찮고, 세우는 것만 본다 — 여기가 겹치면 어항이 소품 뒤로 숨는다
  {
    const [px, py, pw, ph] = PET_SPOT.p2;
    for (const s of SLOTS) {
      if (s.kind === 'floor') continue;
      const [x, y, w, h] = s.p2;
      if (x < px + pw && px < x + w && y < py + ph && py < y + h) {
        problems.push(`어항 자리를 «${s.ko}» 가 문다 (${s.p2.join(',')})`);
      }
    }
  }
}
if (problems.length) {
  console.error('❌ 방 꾸미기 축 표에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
  process.exit(1);
}

// ─── 파일에 써 넣기 ───────────────────────────────────────────
function replaceBlock(file, tag, body) {
  const src = fs.readFileSync(file, 'utf8');
  const head = `// <<<GEN:${tag}`, tail = `// GEN:${tag}>>>`;
  const i = src.indexOf(head), j = src.indexOf(tail);
  if (i < 0 || j < 0) { console.error(`${path.basename(file)} 에 ${head} ~ ${tail} 표시가 없다`); process.exit(2); }
  const before = src.slice(0, src.indexOf('\n', i) + 1);
  const out = before + body + src.slice(j);
  if (out === src) return false;
  if (!CHECK) fs.writeFileSync(file, out);
  return true;
}
const q = (v) => (v === undefined ? '' : typeof v === 'string' ? `'${v}'` : String(v));

// ① 자리 표
let slotBody = 'const ROOM_SLOTS = [\n';
for (const s of SLOTS) {
  const p = s.p3;
  slotBody += `  { id: '${s.id}', emoji: '${s.emoji}', name: '${s.ko}', kind: '${s.kind}',`
    + (s.light ? ` light: ${s.light},` : '') + (s.on ? ` on: '${s.on}',` : '') + '\n'
    + `    p3: { x: ${p.x}, y: ${p.y}, z: ${p.z},${p.yaw !== undefined ? ` yaw: ${p.yaw},` : ''}`
    + ` w: ${p.w}, h: ${p.h} }, p2: [${s.p2.join(', ')}] },\n`;
}
slotBody += '];\n';

// ② 단계 표
let tierBody = 'const ROOM_TIERS = [\n';
for (const t of TIERS) {
  tierBody += `  { id: '${t.id}', name: '${t.ko}', cost: ${t.cost}, cozy: ${t.cozy} },\n`;
}
tierBody += '];\n';
tierBody += `const ROOM_COZY = { decay: ${COZY.decay}, rest: ${COZY.rest} };\n`;

// ③ 자재 표 둘
let matBody = 'const ROOM_WALLS = [\n';
for (const w of WALLS) {
  matBody += `  { id: '${w.id}', emoji: '${w.emoji}', name: '${w.ko}',`
    + ` c: ['${w.c.join("', '")}'], seam: '${w.seam}' },\n`;
}
matBody += '];\nconst ROOM_FLOORS = [\n';
for (const f of FLOORS) {
  matBody += `  { id: '${f.id}', emoji: '${f.emoji}', name: '${f.ko}', c: ['${f.c.join("', '")}'] },\n`;
}
matBody += '];\n';
matBody += `const ROOM_START = { wall: '${START_WALL}', floor: '${START_FLOOR}' };\n`;
matBody += `const ROOM_MAT_COST = ${MAT_COST};\n`;
matBody += `const ROOM_PET_SPOT = { p2: [${PET_SPOT.p2.join(', ')}],`
  + ` p3: { x: ${PET_SPOT.p3.x}, z: ${PET_SPOT.p3.z} } };\n`;
matBody += 'const ROOM_LEVEL_GIFT = {\n';
for (const lv of Object.keys(LEVEL_GIFT).sort()) {
  matBody += `  ${lv}: ['${LEVEL_GIFT[lv].join("', '")}'],\n`;
}
matBody += '};\n';

// ④ 소품 46개 — 자리 × 단계 + 자재 열. **이름이 여기서 조립된다**
let decorBody = 'const ROOM_DECOR = {\n';
for (const s of SLOTS) {
  for (const t of TIERS) {
    decorBody += `  rp_${s.id}_${t.id}: { id: 'rp_${s.id}_${t.id}', slot: '${s.id}', tier: '${t.id}',`
      + ` emoji: '${s.emoji}', name: '${t.ko} ${s.ko}' },\n`;
  }
}
for (const w of WALLS) {
  decorBody += `  ${w.id}: { id: '${w.id}', slot: 'wall', emoji: '${w.emoji}', name: '${w.ko}' },\n`;
}
for (const f of FLOORS) {
  decorBody += `  ${f.id}: { id: '${f.id}', slot: 'floor', emoji: '${f.emoji}', name: '${f.ko}' },\n`;
}
decorBody += '};\n';

// ⑤ 영어 이름 — **같은 표에서 나오므로 한쪽만 빠질 수 없다**
let enBody = '';
for (const s of SLOTS) enBody += `      room_slot_${s.id}: '${s.en}',\n`;
for (const s of SLOTS) for (const t of TIERS) enBody += `      rp_${s.id}_${t.id}: '${t.en} ${s.en}',\n`;
for (const w of WALLS) enBody += `      ${w.id}: '${w.en}',\n`;
for (const f of FLOORS) enBody += `      ${f.id}: '${f.en}',\n`;

const changed = [
  replaceBlock(path.join(ROOT, 'data.js'), 'room-slots', slotBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'room-tiers', tierBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'room-mats', matBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'room-decor', decorBody),
  replaceBlock(path.join(ROOT, 'i18n.js'), 'room-en', enBody),
].some(Boolean);

const total = SLOTS.length * TIERS.length + WALLS.length + FLOORS.length;
if (CHECK) {
  if (changed) {
    console.error('❌ 방 꾸미기 표와 파일이 어긋났다 — `node tools/genroom.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 방 꾸미기 ${total}개 (자리 ${SLOTS.length} × 단계 ${TIERS.length}`
    + ` + 벽지 ${WALLS.length} + 바닥재 ${FLOORS.length})가 표와 같다`);
  process.exit(0);
}
console.log(`✅ 방 꾸미기 ${total}개 — 자리 ${SLOTS.length} × 단계 ${TIERS.length}`
  + ` = 소품 ${SLOTS.length * TIERS.length} · 벽지 ${WALLS.length} · 바닥재 ${FLOORS.length}`
  + `\n   시작: 창문 하나 + ${START_WALL} + ${START_FLOOR} (소품 0)`
  + `\n   단계 선물: ${Object.keys(LEVEL_GIFT).map(lv => `${lv}단계 ${LEVEL_GIFT[lv].length}개`).join(' · ')}`
  + `\n   아늑함: 만점 ${SLOTS.length * TIERS[TIERS.length - 1].cozy}`
  + ` (선물 한 벌이면 ${Math.round(100 * SLOTS.length * TIERS[0].cozy / (SLOTS.length * TIERS[TIERS.length - 1].cozy))}%)`
  + ` → 방치 감소 −${COZY.decay}% · 스태미나 회복 +${COZY.rest}%`);
