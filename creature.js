// 크리처 그림 — 이모지 대신 SVG.
//
// **서른 마리를 한 장씩 그리지 않는다.** 부품(몸통·귀·뿔·날개·꼬리·눈·무늬)을 두고
// **마리마다 조합만 다르게** 준다 (data.js 의 `art`). 인물 초상화(portrait.js)와 같은 생각이고,
// 커스터마이징 150벌을 축 표에서 뽑은 것과도 같다 (CLAUDE.md 6번).
// 부품 하나를 손보면 서른 마리가 같이 좋아진다.
//
// 색은 **속성**에서 온다 (`CREATURE_ATTRS[].color`). 그래서 불 크리처는 다 붉고
// 물 크리처는 다 푸르다 — 목록에서 속성이 글자를 안 읽어도 눈에 들어온다.
(function () {
  // SVG 의 id 는 **문서 전체에서 공유된다.** 도감에 서른 마리가 한 화면에 뜨므로
  // 그라디언트 id 가 겹치면 뒤엣것이 앞엣것을 덮어쓴다 (roomScene·avatar 와 같은 이유).
  let uid = 0;
  const W = 100, H = 100;

  // ─── 색 ───────────────────────────────────────────────────
  function shade(hex, amt) {
    const n = parseInt(String(hex).slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amt / 100))));
    return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function tint(hex, amt) {
    const n = parseInt(String(hex).slice(1), 16);
    const f = (v) => Math.round(v + (255 - v) * amt / 100);
    return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ═══ 그림의 결 — 「선 없이, 색 면만으로」 (2026-10-01) ═══════════
  //
  // 사람이 **고양이 SVG 한 장을 직접 그려 보내며** 「내가 보낸 SVG 파일로 해줄 수
  // 있어?」로 정해 준 결이다. 바로 전날 두른 먹선은 「생각보다 귀엽지 않아서」 걷었다 —
  // **고친 것이 틀린 것이 아니라 사람이 방향을 되돌린 자리다.** 그 파일이 쓰는 것은
  // **색 넷**(털 · 크림 · 분홍 · 눈)뿐이고 **선이 한 줄도 없다.**
  //
  // 지킬 것 아홉 (사람이 글로 적어 준 것 그대로다):
  //   ① **외곽선·내부 윤곽선이 한 줄도 없다** — 형태는 «다른 색 면»으로 가른다
  //   ② 원·타원·둥근 물방울 같은 **통통하고 단순한 도형**만 쓴다
  //   ③ **머리와 몸이 한 덩어리**이고 팔다리가 아주 짧다
  //   ④ **색은 마리마다 넷까지** — 털(`COAT`) · 크림(`CREAM`) · 분홍(볼·혀) · 눈
  //   ⑤ **평면 단색**이다 — 그늘 면도 광택도 그라데이션도 털 묘사도
  //      **배의 잔무늬도 손발가락 선도** 없다 (그래서 `pat` 축은 안 그린다 · 아래 항)
  //   ⑥ 얼굴은 **큰 눈 둘 + 아주 작은 입**. 눈은 **진한 단색**이고
  //      **빛은 눈마다 작은 점 하나**다 (감고 웃는 눈에는 없다)
  //   ⑦ 눈 사이는 넓게, 입은 눈에 가깝게. 볼터치는 작고 **좌우가 살짝 다르다**
  //   ⑧ 귀여움은 **표정과 포즈**에서 온다 — 모은 두 손 · 감고 웃는 눈.
  //      큰 애니메 눈 · 복잡한 홍채 · 속눈썹 · 과한 반짝임 · 하트로 때우지 않는다
  //   ⑨ **핵심 특징은 하나다** — 귀 / 뿔 / 날개 중 하나만 크게 그린다 (`coreOf`)
  //
  // ⚠️⚠️ **귀는 머리 «뒤»에 그린다 — 그것이 이음매를 없애는 방법 전부다.**
  //    사람의 SVG 가 그렇게 돼 있다: 귀의 밑변 두 점이 **머리 타원 «안»**에 있고
  //    머리를 나중에 그려 그 밑변을 덮는다. 밖에서 만나게 그리면 어느 배율에서든
  //    한 자리에 «턱»이 생긴다 (「귀가 머리 부분에서 떨어진 부분이 없이 잘 이어
  //    붙여 달라」로 받은 자리다). **뿔·날개도 같은 이유로 머리·몸 «뒤»다.**
  // ⚠️⚠️ **꼬리는 «탐스럽게»다** — 가는 관이 아니라 둥글게 감기는 덩어리이고 끝이
  //    크림색이다 (사람이 콕 집어 요청했다). 실루엣의 균형을 지는 것이라 ⑨ 와 별개로
  //    늘 그린다 — 사람의 SVG 도 귀와 꼬리를 같이 갖고 있다.
  // ⚠️⚠️ **`pat`(배의 무늬)과 광택은 그리지 않는다** (⑤). 축은 데이터에 남아 있지만
  //    화면에 안 나온다 — **데이터를 건드리면 id 가 흔들려 세이브의 크리처가 바뀐다**
  //    (`tools/gencreature.js` 의 `LEGACY` 와 같은 이유다). 갈리는 것은 속성 색 ·
  //    몸통 · 핵심 특징 · 꼬리 · 눈 다섯이고, 그것으로 서른이 다 갈린다
  // ⚠️ **속성 색은 «정보»라 버리면 안 된다** — 불은 붉고 물은 푸른 것이 목록에서
  //    글자를 안 읽어도 속성을 알려 준다. 묽히는 것은 **채도**이지 «색상»이 아니다.
  // ⚠️ **44px 에서 읽혀야 한다** — 도감 칸과 방의 크리처가 그 크기다.

  const EYE_C = '#50364e';        // 눈 — 사람의 SVG 가 쓴 그 색
  const BLUSH = '#ffaeb8';        // 볼터치와 혀 — 같은 파일의 그 색 (④ 의 «분홍» 하나다)
  const SHEEN = '#fffdf9';        // 눈의 빛 한 점
  const GROUND = 90;
  const TOP_PAD = 2.5;            // 상자 위에 이만큼은 비워 둔다 (선이 없어 4.5 → 2.5)
  // 어항의 받침(아래 `bowl()`). **어항이 «바닥에 닿는 자리»는 그 밑변**이라
  // 크리처의 발(`GROUND`)과 다르다 — 둘을 내보내서 `placePetY()` 가 읽는다.
  // ⚠️ 받침을 옮기면 자리도 같이 따라온다. 숫자를 game.js 에 옮겨 적으면 어항만
  //    옛 자리에 남는다 (`Avatar.FLOOR_SPOT` 을 한 줄로 둔 것과 같은 규칙이다)
  const BOWL_STAND = { cy: 92, ry: 4 };
  const BOWL_FLOOR = BOWL_STAND.cy + BOWL_STAND.ry;
  // 공중 크리처가 «어깨에 맞추는 줄» — 칠한 데(`TOP_PAD`~`GROUND`)의 한가운데다.
  // ⚠️ 땅·어항은 «닿는 줄»이라 밑변 쪽이지만 공중은 닿는 데가 없다 — 어깨에 맞출 것은
  //    몸의 가운데다 (발을 어깨에 걸면 몸이 통째로 머리 옆으로 올라간다).
  // ⚠️ 숫자를 game.js 에 적지 않는다 — 그림의 여백을 고치면 여기가 같이 움직인다
  const AIR_MID = (TOP_PAD + GROUND) / 2;

  const n1 = (v) => (Math.round(v * 10) / 10);
  const ell = (x, y, rx, ry, f, extra) =>
    `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${f}"${extra || ''}/>`;
  // ─── 발밑 그림자 ────────────────────────────────────────────
  //
  // ⚠️⚠️ **털색으로 칠하면 «안 보인다» — 그래서 떠 보였다** (2026-10-06).
  // 「화염여우가 바닥 위에 둥둥 떠있어」로 **두 번** 신고받은 자리인데, 재 보니
  // **자리는 맞았다** — 발이 바닥선에서 0.0~1.4px 다. 없던 것은 «닿은 자국»이다.
  // 한 겹 `shade(털색, 10)` · 투명도 0.16 은 나무 바닥을 **0.018** 밖에 안 어둡게 해서,
  // 주황 크리처가 주황 마루 위에서 **그림자를 아예 안 가진 것처럼** 보였다.
  // 지금은 **중성 어두운 색 세 겹**이고 **0.102** 다.
  //
  // ⚠️ **값은 그려 놓고 골랐다** — 넷을 나란히 찍어 봤다 (지금 0.018 · 한 겹 짙게
  //   0.075 · 세 겹 0.074 · **세 겹 짙게 0.102**). 한 겹은 테두리가 딱 끊겨 「붙여
  //   놓은 타원」이 되고, 세 겹이라야 가장자리가 번져 그림자로 읽힌다
  //   (아바타의 `crouchBack` · 인트로의 `groundShadow` 가 이미 푼 자리와 같은 조리법이다)
  // ⚠️ **필터도 그라디언트도 안 쓴다** — 크리처 SVG 는 여러 벌이 한 문서에 깔리므로
  //   id 가 생기면 그만큼 겹칠 자리가 는다. 겹 셋이면 id 없이도 번진다
  //
  // ⚠️⚠️ **공중 크리처에는 짙게 쓰지 않는다.** 그 타원은 바닥이 아니라 «배 밑»에
  //   있어서(`AIR_LIFT` 만큼 떠 있다), 짙게 만들면 허공에 짙은 원반이 생겨
  //   **보이지 않는 받침에 앉은 것**으로 보인다 (그려 보고 갈렸다). 공중은 옛 한 겹 그대로다.
  // ⚠️ **크기를 2배로 키우면서 드러난 것이다** — 46px 일 때는 아무도 안 봤다
  // ⚠️⚠️ **`data-part="shade"` 가 검사기의 손잡이다.** `checkroom` 의 「크리처가 선
  //   자리」가 오래 `opacity="0.16"` 으로 이 타원을 집고 있었는데, 그러면 **색을 고치는
  //   순간 스무 줄이 통째로 «못 쟀다»가 된다** (「되짚기를 쓰지 않는 잣대로 바꾼다」)
  const SHADE_RGB = '62,44,52';   // 중성 어두운 색 — 털색을 안 탄다 (그래서 어느 바닥에서나 선다)
  const SHADE_LAYERS = [[31, 6.8, 0.12], [24, 5, 0.15], [16, 3.2, 0.19]];
  const footShade = (c, raw) => {
    const inner = (c && c.move === 'air')
      ? ell(50, GROUND + 2, 26, 5, shade(raw, 10), ' opacity="0.16"')
      : SHADE_LAYERS.map(([rx, ry, a]) =>
        ell(50, GROUND + 2, rx, ry, `rgba(${SHADE_RGB},${a})`)).join('');
    return `<g data-part="shade">${inner}</g>`;
  };

  const P = (d, f) => `<path d="${d}" fill="${f}"/>`;
  const S = (d, c, w) => `<path d="${d}" stroke="${c}" stroke-width="${n1(w)}"`
    + ` fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  // ─── 원본을 옮기는 자 ────────────────────────────────────────
  //
  // 사람의 SVG(viewBox "25 0 430 430")를 100칸으로 옮긴 값이 아래 좌표들이다
  // (`x = (X−25)/4.3 − 2.2` · `y = Y/4.3 − 4.7` — 덩어리의 가운데가 x50 에 오고
  // 발끝이 y90 에 닿게 맞춘 것이다).
  //
  // ⚠️⚠️ **원본 좌표를 그대로 적고 «옮기기»만 한다.** 몸통마다 손으로 다시 적으면
  //    일곱 벌이 되고, 한 벌만 고쳐도 그 몸통만 옛 모양에 남는다 (이 저장소에서
  //    「사본이 하나 남아 있으면 그 자리만 조용히 다른 것을 잰다」로 여러 번 겪었다).
  const R_HX = 50, R_HY = 43;       // 원본의 머리 중심
  const R_BY = 83.7;                // 원본 몸통의 밑변 — 꼬리가 여기서 자란다
  // 머리에 매달린 것 (얼굴·눈·입·손)
  const onHead = (hx, hy, k) => (x, y) =>
    `${n1(hx + (x - R_HX) * k)},${n1(hy + (y - R_HY) * k)}`;
  // 바닥에 매달린 것 (꼬리)
  const onFoot = (cx, by, k) => (x, y) =>
    `${n1(cx + (x - R_HX) * k)},${n1(by + (y - R_BY) * k)}`;

  // ─── 몸통 일곱 ───────────────────────────────────────────────
  //
  // 한 줄이 [머리(cx,cy,rx,ry) · 아래 덩어리(위y,반폭,밑y) · 얼굴 크림(dy,rx,ry) ·
  //          배 크림(dy,r) · 발(dx,y,rx,ry)] 이다. **귀·뿔·눈·입·손이 다 머리에서
  // 자리를 잡으므로**(`HEAD` 하나가 원본이던 그 규칙 그대로) 머리를 키우면 다 따라온다.
  // ⚠️ 물고기는 어항에 들어가므로 작고, **발이 없다**(`ft: null`)
  const SHAPE = {
    blob: { h: [50, 44, 30, 25],   t: [60, 18,   84], f: [5, 24,   17],   b: [31, 14],   ft: [13, 87, 7.0, 3.6] },
    quad: { h: [50, 43, 29, 24.5], t: [59, 17,   84], f: [5, 23,   16.5], b: [31, 13.3], ft: [12, 87, 6.7, 3.5] },
    bear: { h: [50, 41, 31, 26.5], t: [58, 19.5, 85], f: [5, 25,   18],   b: [33, 15],   ft: [14, 88, 7.4, 3.8] },
    deer: { h: [50, 37, 23, 20],   t: [53, 14,   81], f: [4, 18,   13.5], b: [29, 11],   ft: [10, 87, 5.0, 3.0] },
    bird: { h: [50, 39, 26, 22],   t: [55, 15.5, 83], f: [5, 20,   15],   b: [30, 12],   ft: [10, 87, 5.6, 3.2] },
    bug:  { h: [50, 40, 20, 17.5], t: [54, 12.5, 79], f: [4, 15.5, 12],   b: [27, 9.2],  ft: [8,  86, 4.2, 2.6] },
    fish: { h: [50, 46, 21, 18.5], t: [59, 13,   76], f: [4, 16.5, 12.5], b: [24, 9.6],  ft: null },
  };

  // 아래 덩어리 — 위가 좁고 가운데가 넓고 밑이 평평하다 (앉아 있는 짐승 · ②③)
  // ⚠️ 가운데(`hm`)를 위에서 2/3 쯤에 둔다. 한가운데면 그냥 타원이고 더 내리면 «자루»다
  const torso = (cx, ty, hw, by, f) => {
    const h = by - ty, hm = hw * 1.37, hb = hw * 1.12;
    return P(`M${n1(cx - hw)},${n1(ty)}`
      + ` C${n1(cx - hm)},${n1(ty + h * 0.23)} ${n1(cx - hm * 1.03)},${n1(ty + h * 0.66)} ${n1(cx - hb)},${n1(by)}`
      + ` Q${n1(cx)},${n1(by + h * 0.28)} ${n1(cx + hb)},${n1(by)}`
      + ` C${n1(cx + hm * 1.03)},${n1(ty + h * 0.62)} ${n1(cx + hm * 0.95)},${n1(ty + h * 0.18)} ${n1(cx + hw)},${n1(ty)} Z`, f);
  };

  // ─── 귀 ──────────────────────────────────────────────────────
  //
  // 밑변 두 점(`o`·`i`)이 **머리 타원 안**이다 — 머리가 나중에 그려져 덮는다.
  // 끝(`t`)만 머리 위로 나가므로 실루엣에서 읽히고 이음매가 «없다».
  const earPath = (o, t, i, f) => {
    const h = o[1] - t[1];
    return P(`M${n1(o[0])},${n1(o[1])}`
      + ` Q${n1(o[0] - (t[0] - o[0]) * 0.30)},${n1(t[1] + h * 0.26)} ${n1(t[0])},${n1(t[1])}`
      + ` Q${n1(t[0] + (i[0] - t[0]) * 0.22)},${n1(t[1] - h * 0.11)} ${n1(i[0])},${n1(i[1])} Z`, f);
  };
  // ⚠️⚠️ **속귀는 «같은 모양을 무게중심 쪽으로 줄인 것»이다** — 그래야 코트 테가
  //    어디서나 고르게 남는다. 크게 두면 코트가 «테두리»로 읽혀 ① 이 무너진다
  //    (0.58 이 사람 SVG 가 쓴 몫이다 · 세 값을 그려 보고 그대로 두었다)
  const EAR_IN = 0.58;
  // 귀 길이 — 머리 ry 에 대한 비. 1.0 이 사람 SVG 의 고양이 귀다
  const EAR_S = { none: 0, round: 0.30, long: 1.55, tuft: 1.00, fin: 0.50 };
  const EAR_LEAN = { none: 0, round: 0, long: 0.05, tuft: 0.10, fin: 0.24 };
  // 머리 꼭대기(ry) 위로 올라가는 몫 — `draw()` 가 이만큼 전체를 줄인다
  const earUpK = (kind) => Math.max(0, 0.61 * (EAR_S[kind] || 0) - 0.20);
  const ears = (hx, hy, hrx, hry, kind, coat, cream) => {
    const s = EAR_S[kind] || 0;
    if (!s) return '';
    const lean = EAR_LEAN[kind] || 0;
    return [-1, 1].map(side => {
      // ⑦ 좌우를 살짝 다르게 — 오른쪽 귀가 조금 짧다 (사람 SVG 도 그렇다)
      const grow = side < 0 ? 1 : 0.93;
      const o = [hx + side * hrx * 0.885, hy - hry * 0.35];
      const t = [hx + side * hrx * (0.727 + lean), hy - hry * (0.80 + 0.61 * s * grow)];
      const i = [hx + side * hrx * 0.208, hy - hry * 0.82];
      const g = [(o[0] + t[0] + i[0]) / 3, (o[1] + t[1] + i[1]) / 3];
      const sh = (p) => [g[0] + (p[0] - g[0]) * EAR_IN, g[1] + (p[1] - g[1]) * EAR_IN];
      return earPath(o, t, i, coat) + earPath(sh(o), sh(t), sh(i), cream);
    }).join('');
  };

  // ─── 뿔 ──────────────────────────────────────────────────────
  //
  // ⚠️⚠️ **끝이 닿는 높이(`up`)를 표 하나에서 받아 거꾸로 길이를 푼다.** 길이를
  //    저마다 적고 높이를 따로 적어 두면 뿔을 키웠을 때 **상자 밖으로 나가 통째로
  //    안 그려진다** (SVG 는 viewBox 밖을 아예 안 그려 «티가 안 난다» — 실제로
  //    네 마리의 뿔이 그렇게 사라졌다).
  const HORN_UP = { none: 0, single: 1.25, pair: 0.78, antler: 1.30, crystal: 0.88 };
  const HORN = {
    none: () => '',
    // 하나 — 가운데에서 곧게 솟는 원뿔 (유니콘)
    single: (hx, hy, hrx, hry, c, up) => {
      const by = hy - hry * 0.72, ty = hy - hry * (1 + up), w = hrx * 0.17;
      return P(`M${n1(hx - w)},${n1(by)}`
        + ` C${n1(hx - w * 0.8)},${n1(by + (ty - by) * 0.5)} ${n1(hx - w * 0.3)},${n1(by + (ty - by) * 0.85)} ${n1(hx)},${n1(ty)}`
        + ` C${n1(hx + w * 0.3)},${n1(by + (ty - by) * 0.85)} ${n1(hx + w * 0.8)},${n1(by + (ty - by) * 0.5)} ${n1(hx + w)},${n1(by)} Z`, c);
    },
    // 둘 — 바깥으로 휘어 올라가는 짝 (염소)
    pair: (hx, hy, hrx, hry, c, up) => [-1, 1].map(f => {
      const bx = hx + f * hrx * 0.40, by = hy - hry * 0.70;
      const ty = hy - hry * (1 + up), H = by - ty, w = hrx * 0.14;
      return P(`M${n1(bx - f * w)},${n1(by)}`
        + ` C${n1(bx - f * w * 0.7)},${n1(by - H * 0.52)} ${n1(bx + f * w * 1.4)},${n1(by - H * 0.82)} ${n1(bx + f * w * 2.5)},${n1(ty)}`
        + ` C${n1(bx + f * w * 1.1)},${n1(by - H * 0.70)} ${n1(bx + f * w * 0.5)},${n1(by - H * 0.34)} ${n1(bx + f * w)},${n1(by)} Z`, c);
    }).join(''),
    // 사슴뿔 — **획이 곧 모양이다**(윤곽선이 아니다 · ①). 둥근 마개라 각이 없다(②)
    antler: (hx, hy, hrx, hry, c, up) => [-1, 1].map(f => {
      const bx = hx + f * hrx * 0.34, by = hy - hry * 0.72;
      const ty = hy - hry * (1 + up), H = by - ty, w = hrx * 0.11;
      const mx = bx + f * hrx * 0.30;
      // ⚠️⚠️ **둥근 마개가 끝보다 «더» 올라간다** — 획의 반폭만큼 미리 내려 긋지 않으면
      //    `up` 이 셈한 자리보다 높아져 **상자 위에서 잘린다** (사슴 둘이 실제로 잘렸다).
      //    SVG 는 viewBox 밖을 아예 안 그려 «티가 안 난다»
      const tyc = ty + w * 0.85;
      return S(`M${n1(bx)},${n1(by)} C${n1(bx + f * w)},${n1(by - H * 0.45)} ${n1(mx - f * w)},${n1(by - H * 0.7)} ${n1(mx)},${n1(tyc)}`, c, w * 1.7)
        + S(`M${n1(bx + f * w * 1.2)},${n1(by - H * 0.42)} C${n1(bx + f * hrx * 0.3)},${n1(by - H * 0.5)} ${n1(bx + f * hrx * 0.42)},${n1(by - H * 0.52)} ${n1(bx + f * hrx * 0.5)},${n1(by - H * 0.74)}`, c, w * 1.3);
    }).join(''),
    // 수정 — 납작한 세모 셋 (②: 끝만 모이고 밑은 둥글게 겹친다)
    crystal: (hx, hy, hrx, hry, c, up) => {
      const by = hy - hry * 0.74, ty = hy - hry * (1 + up), H = by - ty;
      return [[0, 1], [-0.42, 0.62], [0.42, 0.56]].map(([dx, hk]) => {
        const x = hx + hrx * dx, w = hrx * 0.17 * (hk > 0.8 ? 1 : 0.86);
        return P(`M${n1(x - w)},${n1(by)} L${n1(x)},${n1(by - H * hk)} L${n1(x + w)},${n1(by)} Z`, c);
      }).join('');
    },
  };

  // ─── 날개 ────────────────────────────────────────────────────
  //
  // 몸 «뒤»에 그린다 — 밑동이 몸에 가려야 붙어 있는 것으로 보인다.
  //
  // ⚠️⚠️ **크림색으로만 그리면 날개가 안 보인다.** 처음에 넷을 다 `CREAM` 으로
  //    두었더니 참새·매·까마귀·고래의 날개가 **옅은 얼룩**이 되어 44px 에서 통째로
  //    사라졌다 (찍어 보고 알았다). 지금은 **털색 날개에 크림 끝**이다 — 꼬리와 같은
  //    조리법이라 실루엣에서 읽히고 색은 여전히 넷이다 (④).
  //    ⚠️ **나비 둘만은 크림이 맞는다** — 그쪽은 「옅은 날개」가 곧 그 종이다.
  // ⚠️ 가로로 `hrx` 의 1.6배까지만 나간다 — 더 나가면 상자 옆에서 잘린다
  const WING = {
    none: () => '',
    butterfly: (hx, hy, hrx, hry, coat, cream) => [-1, 1].map(f => {
      const ax = hx + f * hrx * 1.00, ay = hy + hry * 0.10;
      const bx = hx + f * hrx * 1.02, by = hy + hry * 1.05;
      // ⚠️ 위 날개까지 크림으로 두면 **크림색 화면 위에서 통째로 사라진다** —
      //    위는 털색, 아래는 크림이라야 두 겹이 갈리고 실루엣도 선다 (찍어 보고 갈랐다)
      return ell(ax, ay, hrx * 0.72, hry * 0.68, coat, ` transform="rotate(${n1(f * 22)} ${n1(ax)} ${n1(ay)})"`)
        + ell(bx, by, hrx * 0.50, hry * 0.46, cream, ` transform="rotate(${n1(f * 14)} ${n1(bx)} ${n1(by)})"`);
    }).join(''),
    bird: (hx, hy, hrx, hry, coat, cream) => [-1, 1].map(f => {
      const x = hx + f * hrx * 1.02, y = hy + hry * 0.70;
      const r = ` transform="rotate(${n1(f * 28)} ${n1(x)} ${n1(y)})"`;
      return ell(x, y, hrx * 0.62, hry * 0.48, coat, r)
        + ell(x + f * hrx * 0.30, y + hry * 0.26, hrx * 0.26, hry * 0.20, cream, r);
    }).join(''),
    bat: (hx, hy, hrx, hry, coat, cream) => [-1, 1].map(f => [0.70, 1.08, 1.38].map((d, j) => {
      const x = hx + f * hrx * d, y = hy + hry * (0.26 + j * 0.30);
      return ell(x, y, hrx * 0.34, hry * 0.34, j === 2 ? cream : coat);
    }).join('')).join(''),
    fin: (hx, hy, hrx, hry, coat, cream) => [-1, 1].map(f => {
      const x = hx + f * hrx * 1.00, y = hy + hry * 0.80;
      const r = ` transform="rotate(${n1(f * 18)} ${n1(x)} ${n1(y)})"`;
      return ell(x, y, hrx * 0.50, hry * 0.32, coat, r)
        + ell(x + f * hrx * 0.22, y, hrx * 0.22, hry * 0.16, cream, r);
    }).join(''),
  };

  // ─── 꼬리 ────────────────────────────────────────────────────
  //
  // `long` 이 **사람 SVG 의 그 꼬리 그대로**다 — 둥글게 감기고 끝이 크림색이다.
  // ⚠️ 배율에 0.92 를 곱한다: `bear` 의 머리(hrx 31)로 그대로 늘리면 끝이 x98.7 까지
  //    가서 상자 옆에서 잘린다 (`checkcreature` ① 이 잡는 자리다)
  const TAIL = {
    none: () => '',
    long: (cx, by, k, coat, cream) => {
      const m = onFoot(cx, by, k);
      return P(`M${m(67.8, 80.2)} C${m(80.6, 80.7)} ${m(82, 67.2)} ${m(84.8, 61.8)}`
        + ` C${m(89.7, 57.6)} ${m(95.5, 62.7)} ${m(92.2, 69.7)}`
        + ` C${m(89.9, 80.4)} ${m(81.3, 86)} ${m(68, 85.8)} Z`, coat)
        + P(`M${m(84.3, 62.7)} C${m(86.7, 57.4)} ${m(93.6, 60.4)} ${m(93.2, 65.8)}`
          + ` Q${m(89, 68.6)} ${m(83.2, 66.5)} Z`, cream);
    },
    // 뭉친 꼬리 — 둥근 덩어리 하나에 크림 끝 (②)
    puff: (cx, by, k, coat, cream) =>
      ell(cx + 23 * k, by - 9 * k, 13 * k, 12 * k, coat)
      + ell(cx + 28.5 * k, by - 15 * k, 6.6 * k, 6 * k, cream),
    // 잎 — 비스듬히 누운 타원에 크림 끝
    leaf: (cx, by, k, coat, cream) => {
      const x = cx + 24 * k, y = by - 14 * k;
      return ell(x, y, 15 * k, 7.2 * k, coat, ` transform="rotate(-38 ${n1(x)} ${n1(y)})"`)
        + ell(cx + 32 * k, by - 24 * k, 5.4 * k, 4.6 * k, cream);
    },
    // 물고기 꼬리 — 부채 둘
    fish: (cx, by, k, coat, cream) => {
      const x = cx + 20 * k, y = by - 8 * k;
      return ell(x + 4 * k, y - 7 * k, 11 * k, 6.4 * k, coat, ` transform="rotate(-34 ${n1(x + 4 * k)} ${n1(y - 7 * k)})"`)
        + ell(x + 4 * k, y + 3 * k, 10 * k, 5.8 * k, coat, ` transform="rotate(26 ${n1(x + 4 * k)} ${n1(y + 3 * k)})"`)
        + ell(x + 1 * k, y - 2 * k, 5.6 * k, 5.2 * k, cream);
    },
  };

  // ─── 눈 ──────────────────────────────────────────────────────
  //
  // ⚠️⚠️ **흰자도 눈꺼풀 선도 없다.** 사람이 서른 마리를 놓고 **흰자가 있는 열여섯을
  //    «정확히» 집어** 「사람 눈 같아서 안 귀여워」라고 했다 — 짐승 치비에서 그 둘은
  //    「사람」이라는 신호다. 짐승의 귀여운 눈은 **까맣게 꽉 찬 한 덩어리**다.
  //
  // ⚠️⚠️ **넷이 다 «초롱초롱한 눈망울»이다** (2026-10-02). 「눈 모양 더 귀엽게 ·
  //    위로 쭉 올라간 눈 별로야 · 초롱초롱한 눈망울 위주로」로 받아 **기울기를 버렸다** —
  //    `sharp` 가 바깥 끝을 올린 아몬드였는데, 그 각 하나가 여덟 마리를 «새침한 얼굴»로
  //    만들었다. 이제 갈리는 것은 **크기와 둥글기**뿐이고 **기운 눈은 하나도 없다.**
  //    ⚠️ 열쇠 이름(`sharp`)은 그대로다 — **데이터의 축 이름**이라 바꾸면 세이브의
  //    크리처가 흔들린다. 이름이 아니라 «그리는 것»을 고쳤다
  // ⚠️⚠️ **빛이 «두 점»이라야 초롱초롱해진다** — 큰 것이 위, **작은 것이 반대쪽 아래**다
  //    (`portrait.js` 의 「젖은 눈」이 이미 푼 자리다 — 한 겹으로는 안 읽힌다).
  //    한 점이던 때는 그냥 «까만 콩»이었다. 그리고 **양쪽 눈에서 같은 쪽**이다 —
  //    빛이 하나니까 그것이 맞다
  // ⚠️ **빛은 까만 덩어리 «안»에 여유를 두고 앉힌다** — 가장자리에 닿으면 먹 고리가
  //    끊겨 눈이 터진 것으로 보이고, `checkcreature` ④ 가 「빛 3점」으로 잡는다
  const sheen = (x, y, r) => ell(x, y, r, r, SHEEN);
  // 눈망울 하나 — 진한 단색 + 빛 두 점. **셋이 이 한 곳을 지난다**
  // (저마다 적으면 빛의 자리가 세 벌이 되고, 한 벌만 고쳐도 그 눈만 옛 자리에 남는다)
  // ⚠️⚠️ **작은 점에는 «바닥»이 있다**(`SHEEN_MIN`). 비율로만 두면 머리가 작은 마리
  //    (나비·박쥐·해마 · 머리 몫 0.69)에서 반지름이 1.1px 까지 줄어 **한쪽 눈에서
  //    통째로 사라진다** — 그림에서는 「한쪽만 초롱초롱」이고 `checkcreature` ④ 가
  //    「빛 3점」으로 잡는다 (실제로 셋이 그렇게 걸렸다). 큰 눈은 비율이 이미 커서
  //    바닥에 안 닿으므로 **큰 마리는 한 픽셀도 안 바뀐다**
  const SHEEN_MIN = 0.85;
  const pupil = (x, y, rx, ry) =>
    ell(x, y, rx, ry, EYE_C)
    + sheen(x + rx * 0.32, y - ry * 0.38, rx * 0.32)
    + sheen(x - rx * 0.34, y + ry * 0.40, Math.max(rx * 0.17, SHEEN_MIN));
  const EYE = {
    // 작고 동그란 콩 — 머리가 작은 마리의 눈이다
    dot: (hx, ey, s, ex) => [-1, 1].map(f => {
      const x = hx + ex * f, r = 5.0 * s;
      return pupil(x, ey, r, r * (f < 0 ? 1 : 0.95));
    }).join(''),
    // 크고 동글동글한 눈망울
    round: (hx, ey, s, ex) => [-1, 1].map(f => {
      const x = hx + ex * f, rx = 6.6 * s, ry = 7.4 * s * (f < 0 ? 1 : 0.95);
      return pupil(x, ey, rx, ry);
    }).join(''),
    // 세로로 길고 «제일 큰» 눈망울 — 또렷한 쪽이다 (기운 데가 한 군데도 없다)
    sharp: (hx, ey, s, ex) => [-1, 1].map(f => {
      const x = hx + ex * f, rx = 6.0 * s, ry = 8.4 * s * (f < 0 ? 1 : 0.95);
      return pupil(x, ey, rx, ry);
    }).join(''),
    // 감고 웃는 눈 — **사람 SVG 의 그 호 그대로** (⑧ · 빛점이 없다)
    sleepy: (hx, ey, s, ex) => [-1, 1].map(f => {
      const m = (x, y) => `${n1(hx + ex * f + x * s * f)},${n1(ey + y * s)}`;
      return P(`M${m(-5.1, 1.4)} Q${m(0, -6.7)} ${m(4.9, 1.2)} Q${m(5.1, 2.8)} ${m(3.5, 2.6)}`
        + ` Q${m(-0.2, -1.8)} ${m(-3.7, 2.8)} Q${m(-5.3, 3.5)} ${m(-5.1, 1.4)} Z`, EYE_C);
    }).join(''),
  };

  // ─── 입 ──────────────────────────────────────────────────────
  //
  // 감고 웃는 얼굴만 **원본의 벌린 입 + 혀**를 쓴다 (그 얼굴이 사람 SVG 의 그 얼굴이다).
  // 나머지는 **아주 작은 입**이다 (⑥) — 눈이 떠 있는 얼굴에 큰 입을 주면 눈이 작아 보인다
  const mouthOpen = (hx, hy, k) => {
    const m = onHead(hx, hy, k);
    return P(`M${m(45.7, 50.9)} Q${m(50.1, 49.3)} ${m(55, 50.9)}`
      + ` Q${m(54.3, 57.6)} ${m(50.4, 58.1)} Q${m(46.7, 57.9)} ${m(45.7, 50.9)} Z`, EYE_C)
      + P(`M${m(47.8, 54.8)} Q${m(50.4, 52.7)} ${m(53.2, 55.1)} Q${m(50.6, 58.8)} ${m(47.8, 54.8)} Z`, BLUSH);
  };
  const mouthTiny = (hx, hy, k) => {
    const m = onHead(hx, hy, k);
    return P(`M${m(46.9, 51.2)} Q${m(50, 56.0)} ${m(53.1, 51.2)} Q${m(50, 53.4)} ${m(46.9, 51.2)} Z`, EYE_C);
  };

  // ─── 모은 두 손 (⑧) ──────────────────────────────────────────
  //
  // 사람 SVG 의 그 자리·그 모양이다. 좌우가 살짝 다르다 (⑦).
  // ⚠️ **날개가 핵심인 마리에는 안 그린다** — 날개가 그 자리를 쓴다
  const arms = (hx, hy, k, f) => {
    const m = onHead(hx, hy, k);
    return P(`M${m(32.5, 72.7)} C${m(26.2, 71.8)} ${m(27.4, 61.8)} ${m(30.8, 55.5)}`
      + ` C${m(35, 50.2)} ${m(40.6, 54.4)} ${m(38.3, 59.7)} Q${m(35, 66.5)} ${m(36.4, 70.4)} Z`, f)
      + P(`M${m(64.1, 71.2)} C${m(66.8, 65.3)} ${m(61.3, 60.9)} ${m(61.7, 56.9)}`
        + ` C${m(62.9, 51.6)} ${m(68.5, 52.1)} ${m(70.8, 57.2)} Q${m(76.6, 70)} ${m(68.2, 73.7)} Z`, f);
  };

  // ⑨ **핵심 특징 하나** — 실루엣만으로 종이 읽혀야 하므로, 데이터에 넷이 다 있어도
  //    그릴 때 **제일 «종을 말하는» 하나만** 고른다. 순서가 곧 우선이다.
  // ⚠️⚠️ **데이터(`art`)는 한 글자도 안 바꾼다** — 축 표를 다시 뽑으면 id 가 흔들려
  //    세이브의 크리처가 바뀐다. 고르는 것은 **그리는 쪽**이다
  const coreOf = (a) => (a.horn && a.horn !== 'none') ? 'horn'
    : (a.wing && a.wing !== 'none') ? 'wing'
      : (a.ear && a.ear !== 'none') ? 'ear' : 'tail';

  // ─── 개발용(임시) «대고 따라 그린» 그림 미리 보기 ─────────────────
  //
  // 사람이 **원본 그림을 대고 따라 그린** SVG 를 보내 와서, 그것을 한 마리에 얹어
  // 게임 안에서 눈으로 보려는 것뿐이다. 결을 바꾼 것이 아니다.
  //
  // ⚠️⚠️ **부품 그림(`SHAPE`·`EYE`…)은 한 글자도 안 건드린다** — 여기 적힌 id 만
  //    통째로 갈아 끼운다. 표를 비우면 그 자리에서 원래 그림으로 되돌아간다.
  // ⚠️⚠️ **`checkcreature` 의 ①~⑪ 은 «부품 그림»을 재는 잣대**라 갈아 끼운 마리는
  //    지날 수가 없다. 그래서 검사기가 이 표를 읽어 **그 마리를 빼고, 몇 마리를
  //    안 쟀는지 같이 낸다** — 0건이 「통과」로 보이면 안 된다.
  // ⚠️ **데이터(`art`)도 안 건드린다** — 축 표를 다시 뽑으면 id 가 흔들려
  //    세이브의 크리처가 바뀐다 (아래 `coreOf` 와 같은 규칙이다).
  const PREVIEW = { flame_fox: 'peach-cat.svg', ember_newt: 'peach-monkey.svg',
                    ash_moth: 'peach-butterfly.svg', charcoal_toad: 'peach-slime.svg',
                    ember_phoenix: 'peach-penguin.svg', pebble_turtle: 'sand-turtle.svg' };

  // ─── 애교 모션 — «바닥에 선» 마리가 4초 움직이고 10초 쉰다 ──────
  //
  // 2026-10-06 에 사람이 🔥 화염 여우의 애교 SVG 를 보내 줬고, 이어서
  // 「"화염 여우" 처럼 바닥에 붙어있는 스타일일 경우, 같은 애니메이션 넣어줘」로 받았다.
  //
  // ⚠️⚠️ **받는 마리를 «목록»으로 적지 않는다 — 「바닥에 선 PREVIEW 크리처」가 규칙이다.**
  //    그림을 하나 더 넣으면 저절로 따라오고, 공중·어항은 저절로 빠진다 (공중 크리처는
  //    어깨에 떠 있고 어항은 받침이 바닥을 맡으니, 바닥을 디딘 애교가 성립하지 않는다).
  // ⚠️⚠️ **리그는 `petidle.js` 한 곳이다** — 그림 파일마다 구우면 네 벌이 되고,
  //    한 벌만 고쳐 갈린다. 그림 파일은 전부 «정지 그림»이고 애교는 게임이 씌운다.
  // ⚠️⚠️ **움직임 줄이기에서는 리그를 «아예 안 그린다»** — 파일 안의
  //    `@media(prefers-reduced-motion)` 는 `<image>` 로 불러오면 **한 번도 안 먹는다**
  //    (재 봤다 · 켜고도 0.8초에 4268칸이 달라졌다). 그래서 쉬는 자세만 떼어 낸 짝 파일을
  //    두고 있었는데, 리그가 게임으로 올라오면서 **그 짝이 필요 없어졌다** — 여기서
  //    안 그리면 그만이다. 「움직임 줄이기에서 멎는다」는 이 저장소의 약속이다
  //    (아바타의 아이들 모션과 같은 자리).
  // ⚠️ 물어보는 때가 «그릴 때»다 — 상수로 한 번 읽어 두면 설정을 바꿔도 안 따라온다
  function idleOn(c, opts) {
    return !!(opts.idle && c.move === 'ground' && window.PetIdle
      && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  // ─── 그림이 «바라보는 쪽» ───────────────────────────────────────
  //
  // 부품 그림은 **정면 치비**라 바라보는 쪽이 없다 (`checkcreature` ②가 얼굴의
  // 좌우 대칭을 못 박는다). 그런데 대고 따라 그린 그림은 옆을 볼 수 있어서,
  // 그 마리만 **인물의 반대쪽에 세워야 인물을 바라본다** — 같은 쪽에 세우면
  // 등을 돌리고 바깥을 본다 (「나비는 좌측을 보니 인물의 우측 어깨 위에」로 받았다).
  //
  // ⚠️⚠️ **적는 것은 «바라보는 쪽»이고 서는 쪽은 그 반대다** (`standSide`).
  //    서는 쪽을 바로 적으면 그림을 뒤집었을 때 왜 그 자리인지가 사라진다.
  // ⚠️ 여기 없는 마리는 정면이라 **왼쪽**이다 — 오래 그래 왔고, 왼쪽 버튼 줄과
  //    치마 옆선을 재는 셈이 거기에 맞춰져 있다 (`placePet`)
  const FACE = { ash_moth: 'left', flame_fox: 'left' };
  function standSide(c) { return (c && FACE[c.id] === 'left') ? 'right' : 'left'; }

  // ⚠️ 캐시 버스터는 제 `<script>` 태그에서 물려받는다 (`tutorial.js` 의 `ASSET_Q` 와
  //    같은 조리법) — `index.html` 의 일괄 치환 한 번이면 그림까지 같이 따라온다
  const ASSET_Q = (document.currentScript && document.currentScript.src.includes('?'))
    ? '?' + document.currentScript.src.split('?')[1] : '';

  // 바닥(`GROUND`)에 세우고 위로 `TOP_PAD` 를 남긴다 — 부품 그림과 «같은 자리»다.
  //
  // ⚠️⚠️ **비율을 «숫자로» 적지 않는다 — 그림마다 다르다.** 한때 `505/600`(고양이)이
  //    박혀 있었는데, 가로로 넓은 원숭이가 들어오자 그 값으로는 **납작하게 눌린다**.
  //    `preserveAspectRatio` 가 그림의 `viewBox` 에서 알아서 맞추므로 상수가 아예
  //    필요 없다 — 그림을 하나 더 넣어도 여기는 한 글자도 안 고친다.
  // ⚠️ **`xMidYMax` 다** — 가운데 정렬 + **아래 맞춤**이라 발이 `GROUND` 에 닿는다.
  //    `YMid` 로 두면 가로로 넓은 그림이 상자 한가운데에 떠서 바닥에서 뜬다.
  // ⚠️ **그래서 그림의 `viewBox` 는 «칠한 데에 바짝» 잘라 둔다** (지금 여섯 다 2.2% 안).
  //    여백이 남아 있으면 그만큼 그대로 떠 보인다 — 원숭이 원본이 위아래 12% 였다.
  //    🔥 화염 여우가 「좀 작은 것 같아」로 신고받은 자리가 바로 이것이다: 그 그림만
  //    **움직임까지 품은 상자**였어서(쉬는 자세가 viewBox 의 81%) 혼자 작게 섰다.
  //    리그를 게임으로 올려 그림을 정지 그림으로 되돌리자 **24% 커져** 원숭이와 나란해졌다
  function previewSvg(c, opts) {
    const ph = GROUND - TOP_PAD;
    const attr = (window.GameData && GameData.creatureAttr(c.attr)) || { color: '#9a8fb0' };
    const href = PREVIEW[c.id] + ASSET_Q;
    // 「쉬는 자세가 놓일 네모」는 하나다 — 애교를 씌우든 안 씌우든 같은 자리·같은 크기다
    const slot = { x: 0, y: TOP_PAD, w: W, h: +ph.toFixed(1) };
    const art = idleOn(c, opts)
      ? PetIdle.image(href, slot)
      : `<image href="${href}" x="${slot.x}" y="${slot.y}" width="${slot.w}"`
        + ` height="${slot.h}" preserveAspectRatio="xMidYMax meet"/>`;
    return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${(c.name || '').replace(/"/g, '')}"
      ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''}>
      ${opts.flat ? '' : `<circle cx="50" cy="50" r="49" fill="${tint(attr.color, 88)}"/>`}
      ${opts.noShadow ? '' : footShade(c, attr.color)}
      ${art}
    </svg>`;
  }

  // 크리처 한 마리를 그린다.
  //   c    : data.js 의 `result` (id · attr · art …)
  //   opts.size  픽셀 크기 (기본은 CSS 가 정한다)
  //   opts.flat  배경 판 없이 — 목록 칸처럼 이미 판이 있는 자리에 쓴다
  function draw(c, opts) {
    if (!c || !c.art) return '';
    opts = opts || {};
    if (PREVIEW[c.id]) return previewSvg(c, opts);
    const attr = (window.GameData && GameData.creatureAttr(c.attr)) || { color: '#9a8fb0' };
    const raw = attr.color;
    // ④ 색은 넷 — 털 · 크림 · 분홍 · 눈.
    // ⚠️ **속성 색을 «그대로» 칠하지 않는다** — 크림색 화면 위에서 원색만 튄다.
    //    그래도 색상은 그대로라 「불은 붉다」는 안 깨진다
    const COAT = tint(raw, 26);
    const CREAM = tint(raw, 76);
    const a = c.art;
    const Sp = SHAPE[a.body] || SHAPE.quad;
    const [hx, hy, hrx, hry] = Sp.h;
    const [ty, hw, by] = Sp.t;
    const core = coreOf(a);
    const k = hrx / 29;                    // 원본(hrx 29)에 대한 배율

    // 날개·꼬리·귀·뿔은 «뒤»다 — 밑동이 몸·머리에 가려야 붙어 있는 것으로 보인다
    const wing = core === 'wing' ? (WING[a.wing] || WING.none)(hx, hy, hrx, hry, COAT, CREAM) : '';
    const hornUp = core === 'horn' ? (HORN_UP[a.horn] || 0) : 0;
    const horn = core === 'horn'
      ? (HORN[a.horn] || HORN.none)(hx, hy, hrx, hry, CREAM, hornUp) : '';
    const earUp = core === 'ear' ? earUpK(a.ear) : 0;
    const ear = core === 'ear' ? ears(hx, hy, hrx, hry, a.ear, COAT, CREAM) : '';
    // ⚠️ 꼬리는 **몸 밖으로 충분히 나와야** 실루엣에서 읽힌다 — 밑동이 몸통에 가려서
    //    너무 작게 두면 «갈고리» 한 조각만 남는다 (찍어 보고 키웠다).
    //    배율에 상한을 두는 이유는 `bear` 의 큰 머리로 늘리면 끝이 상자 옆에서
    //    잘리기 때문이다 (`checkcreature` ① 이 잡는 자리다)
    const tail = (TAIL[a.tail] || TAIL.none)(hx + 2, by + 1, Math.min(k, 1) * 0.98, COAT, CREAM);

    const head = ell(hx, hy, hrx, hry, COAT);
    const face = ell(hx, hy + Sp.f[0], Sp.f[1], Sp.f[2], CREAM);
    const belly = ell(hx, hy + Sp.b[0], Sp.b[1], Sp.b[1] * 0.93, CREAM);
    const feet = Sp.ft
      ? [-1, 1].map(f => ell(hx + f * Sp.ft[0], Sp.ft[1], Sp.ft[2], Sp.ft[3], COAT)).join('') : '';
    const hands = (core === 'wing' || a.body === 'fish') ? '' : arms(hx, hy, k, COAT);

    // 얼굴 — 눈은 머리 가운데보다 조금 아래, 입은 눈에 가깝게 (⑦)
    const ey = hy + hry * 0.035;
    // ⚠️ 눈망울을 키운 만큼 «사이»도 벌린다(0.375 → 0.40 · 사람 SVG 의 그 값이다).
    //    안 벌리면 눈의 안쪽 변이 입에 닿아 **먹 덩어리 하나**로 붙고, 그러면
    //    `checkcreature` 가 그 덩어리를 눈동자로 못 집어 「빛 0점」이 된다
    const ex = hrx * 0.40;
    const es = Math.min(1.12, hrx / 29);
    const eye = (EYE[a.eye] || EYE.dot)(hx, ey, es, ex);
    const mouth = a.eye === 'sleepy' ? mouthOpen(hx, hy, k) : mouthTiny(hx, hy, k);
    // 볼터치 — 작게, 눈 바깥쪽. ⑦ 오른쪽이 살짝 작다
    const blush = [-1, 1].map(f =>
      ell(hx + f * hrx * 0.66, hy + hry * 0.26, 4.7 * es * (f < 0 ? 1 : 0.93), 3.3 * es, BLUSH)).join('');

    // 머리 위로 제일 높이 올라가는 것을 찾아 **그만큼 전체를 줄인다** (바닥이 축이다)
    const up = Math.max(hornUp, earUp) * hry;
    const top = hy - hry - up;
    const fk = top < TOP_PAD ? (GROUND - TOP_PAD) / (GROUND - top) : 1;
    const fit = fk < 1
      ? ` transform="translate(50,${GROUND}) scale(${fk.toFixed(3)}) translate(-50,${-GROUND})"` : '';

    // 그리는 순서가 곧 앞뒤다 (사람 SVG 의 순서 그대로):
    //   꼬리·날개 → 귀·뿔 → 아래 덩어리 → 머리 → 얼굴 크림 → 배 크림
    //   → 볼터치 → 눈 → 입 → 모은 손 → 발
    // ⚠️ **발밑 그림자는 줄이는 그룹 «밖»이다** — 안에 넣으면 뿔 달린 마리만 그림자가
    //    같이 작아져 바닥이 둘로 보인다
    const art = tail + wing + ear + horn
      + torso(hx, ty, hw, by, COAT) + head + face + belly
      + blush + eye + mouth + hands + feet;
    return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${(c.name || '').replace(/"/g, '')}"
      ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''}>
      ${opts.flat ? '' : `<circle cx="50" cy="50" r="49" fill="${tint(raw, 88)}"/>`}
      ${opts.noShadow ? '' : footShade(c, raw)}
      <g${fit}>${art}</g>
    </svg>`;
  }
  // ─── 어항 ────────────────────────────────────────────────────
  //
  // 물고기(`move: 'water'`)를 마이 룸에 두면 이것이 같이 나온다.
  //
  // **방 배경(avatar.js 의 roomScene)에 그리지 않는다.** 방 그림은
  // `preserveAspectRatio="…slice"` 라 창 비율에 따라 확대·잘림이 달라지는데,
  // 크리처는 DOM 요소로 퍼센트 자리에 놓인다 — 둘의 좌표계가 다르므로
  // 어항만 배경에 그리면 **비율이 바뀔 때 물고기가 어항 밖으로 새어 나간다.**
  // 그래서 어항도 크리처와 **같은 상자 안에** 그린다 (viewBox 도 100×100 으로 같다).
  //
  // 앞뒤가 갈려야 유리 너머로 보인다 — `back`(유리통·물) 뒤, 물고기, `front`(테·반사) 앞.
  function bowl() {
    const u = 'b' + (++uid);
    // 위가 트인 둥근 어항. 테두리(y=28)에서 시작해 아래로 크게 돌아 반대편 테두리로 돌아온다
    const shell = 'M30,28 A33,33 0 1 0 70,28';
    const WATER = '#7ec8ef', GLASS = '#cfeaf7';
    return {
      back: `<svg class="cr-bowl" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <clipPath id="${u}c"><path d="${shell} Z"/></clipPath>
          <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${WATER}" stop-opacity="0.55"/>
            <stop offset="1" stop-color="#4f9ada" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
        <path d="${shell} Z" fill="${GLASS}" opacity="0.5"/>
        <g clip-path="url(#${u}c)">
          <rect x="0" y="36" width="100" height="64" fill="url(#${u}g)"/>
          <ellipse cx="50" cy="36" rx="40" ry="3.5" fill="#fff" opacity="0.5"/>
          <ellipse cx="34" cy="82" rx="13" ry="4" fill="#3f7fb8" opacity="0.35"/>
          <path d="M40,86 C38,74 44,68 42,60" stroke="#3f8f6a" stroke-width="3"
                fill="none" stroke-linecap="round" opacity="0.75"/>
          <path d="M58,86 C60,76 55,72 57,64" stroke="#4fa87c" stroke-width="2.6"
                fill="none" stroke-linecap="round" opacity="0.7"/>
        </g>
      </svg>`,
      front: `<svg class="cr-bowl" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="${shell}" fill="none" stroke="#a8d8ee" stroke-width="2.4"/>
        <path d="M26,48 C24,60 27,70 33,77" stroke="#fff" stroke-width="3.4"
              fill="none" stroke-linecap="round" opacity="0.6"/>
        <ellipse cx="50" cy="28" rx="20" ry="5.5" fill="none" stroke="#a8d8ee" stroke-width="2.4"/>
        <ellipse cx="50" cy="${BOWL_STAND.cy}" rx="15" ry="${BOWL_STAND.ry}" fill="#b9a48f"/>
        <rect x="42" y="${BOWL_STAND.cy - 6}" width="16" height="6" rx="2" fill="#c9b49f"/>
      </svg>`,
    };
  }

  // 목록 칸에 쓰는 작은 그림 (도감·인벤토리). 배경 판이 이미 있으므로 flat.
  function icon(c, size) { return draw(c, { flat: true, size: size || 44 }); }

  // 크리처 결과물 찾기 — 레시피에서 뽑는다 (id 는 세이브에 들어 있는 것)
  function of(id) {
    const D = window.GameData;
    if (!D) return null;
    const r = D.RECIPES.find(x => x.result.id === id && x.result.kind === 'creature');
    return r ? r.result : null;
  }

  // ⚠️ `GROUND`·`BOWL_FLOOR` 를 내보내는 이유는 하나다 — **방에 세울 때 자리를 재려고**
  //    (`game.js` 의 `placePetY()`). 그 숫자를 저쪽에 적으면 그림을 고쳤을 때 자리만
  //    옛 값에 남는다
  window.Creature = { draw, icon, bowl, of, W, H, GROUND, BOWL_FLOOR, AIR_MID,
    SHAPE, HORN, WING, TAIL, EYE, PREVIEW, idleOn, FACE, standSide };
})();
