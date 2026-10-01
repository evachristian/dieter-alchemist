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

  // ═══ 그림의 결 — 「듀오링고풍 치비」 (2026-10-01) ═════════════
  //
  // 「크리처 아트웍이 엉성하다 · 정말 너무너무 귀엽게 · 듀오링고 부엉이를 참조해
  // 달라」로 받아 서른 마리를 통째로 다시 그렸다.
  // ⚠️⚠️ **데이터는 한 글자도 안 바뀐다** — 축 표(`tools/gencreature.js`)도, 부품의
  //    «이름»도(`body`·`ear`·`horn`·`wing`·`tail`·`eye`·`pat`) 그대로다. 갈린 것은
  //    **그리는 법**뿐이라 세이브도 밸런스도 안 움직인다.
  //
  // 듀오링고의 그 새에서 가져온 것 다섯 — **하나만 빠져도 「귀엽다」가 안 선다**:
  //   ① **머리가 주인공이다** — 2.2등신. 머리가 몸만 하거나 더 크다
  //   ② **눈이 크고 «젖어» 있다** — 흰자 + 큰 눈동자 + **빛 두 점**
  //      (`portrait.js` 의 「젖은 눈」에서 배운 그대로다 — 한 겹으로는 안 읽힌다)
  //   ③ **배(또는 얼굴)에 옅은 판이 하나** — 평면 칠에 구조를 준다
  //   ④ **정면을 본다** — 옛 그림이 엉성해 보이던 제일 큰 까닭이다. 옆모습은
  //      「캐릭터」가 아니라 «동물 아이콘»으로 읽힌다
  //   ⑤ **각이 하나도 없다** — 발끝·귀끝·뿔끝까지 다 둥글다
  // 여기에 이 게임의 것 둘을 더한다:
  //   ⑥ **볼터치** — 공주가 쓰는 그 색 그대로다(`#ff9db4`)
  //   ⑦ **파스텔** — 속성 색을 그대로 칠하지 않고 한 번 «묽혀서» 쓴다(`COAT`).
  //      크림색 화면 위에 원색이 앉으면 혼자 튄다 (`ART_POLICY.md` 의 그 결이다)
  //
  // ⚠️⚠️ **속성 색은 «정보»라 버리면 안 된다** — 불은 붉고 물은 푸른 것이 목록에서
  //    글자를 안 읽어도 속성을 알려 준다. 묽히는 것은 **채도**이지 «색상»이 아니다.
  // ⚠️ **44px 에서 읽혀야 한다** — 도감 칸과 방의 크리처가 그 크기다. 그래서 눈을
  //    키우고 실루엣을 단순하게 둔다 (잔무늬를 더하면 그 크기에서 얼룩이 된다)

  const INK = '#4a3a42';          // 공주의 눈과 같은 먹색
  const BLUSH = '#ff9db4';        // 공주의 볼터치와 «같은 값»
  const BEAK = '#f0a44b';
  const GROUND = 90;

  // 머리 — [cx, cy, rx, ry]. **귀·뿔·눈이 다 이 넷에서 자리를 잡는다.**
  // ⚠️ 부품마다 좌표를 박으면 머리를 키웠을 때 귀만 옛 자리에 남는다
  const HEAD = {
    blob: [50, 41, 26, 23],
    quad: [50, 36, 25, 24],
    bear: [50, 34, 27, 26],
    deer: [50, 31, 22, 21],
    bird: [50, 35, 24, 23],
    bug:  [50, 40, 18, 17],
    fish: [50, 45, 21, 19],
  };
  // 무늬를 어디에 얹나 — [x, y, 배율]. 몸통마다 덩어리가 있는 자리가 다르다
  const PAT_AT = {
    blob: [50, 70, 1.0], quad: [50, 70, 0.95], bear: [50, 70, 1.15], deer: [50, 66, 0.8],
    bird: [50, 68, 0.95], bug: [50, 66, 0.5], fish: [50, 70, 0.9],
  };

  const ell = (x, y, rx, ry, f, extra) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"${extra || ''}/>`;
  // 둥근 발 둘 — 각이 없어야 한다(⑤). 바닥(`GROUND`)에 붙는다
  const feet = (d, dx, rx, ry) =>
    ell(50 - dx, GROUND - ry + 1, rx, ry, d) + ell(50 + dx, GROUND - ry + 1, rx, ry, d);
  // 가는 다리 둘 — 사슴·염소처럼 다리가 보이는 몸만 쓴다
  const legs = (d, dx, y0, w) =>
    [-dx, dx].map(x => `<rect x="${50 + x - w / 2}" y="${y0}" width="${w}" height="${GROUND - y0 - 2}"`
      + ` rx="${w / 2}" fill="${d}"/>`).join('')
    + feet(d, dx, w * 1.5, w * 0.8);

  // ─── 몸통 — **정면**이다 ──────────────────────────────────────
  // c: 털색(묽힌 속성색) · d: 그늘 · b: 배 판(아주 옅은 색)
  const BODY = {
    // 넓적한 덩어리 — 개구리 · 거북 · 두꺼비 · 달팽이. 앉아 있는 모양이다
    blob: (c, d, b) => ell(50, 70, 30, 20, d) + ell(50, 68, 30, 20, c)
      + ell(50, 73, 19, 13, b) + feet(d, 25, 9, 5.5),
    // 날씬한 네발 — 고양이 · 여우 · 담비 · 도마뱀. 앞발을 모으고 앉았다
    quad: (c, d, b) => ell(50, 70, 21, 19, d) + ell(50, 68, 21, 19, c)
      + ell(50, 72, 13, 11, b)
      + ell(28, 68, 6.5, 10, c) + ell(72, 68, 6.5, 10, c) + feet(d, 13, 8, 5.5),
    // 몸집 큰 네발 — 곰 · 두더지 · 천산갑. 팔이 굵고 짧다
    bear: (c, d, b) => ell(50, 69, 26, 21, d) + ell(50, 67, 26, 21, c)
      + ell(50, 71, 16, 13, b)
      + ell(25, 66, 8, 12, c) + ell(75, 66, 8, 12, c) + feet(d, 15, 10, 6),
    // 다리 긴 네발 — 사슴 · 염소 · 유니콘 · 토끼. 머리가 높이 있다
    deer: (c, d, b) => legs(d, 10, 70, 6) + ell(50, 62, 17, 16, d) + ell(50, 60, 17, 16, c)
      + ell(50, 64, 10, 9, b),
    // 새 — **달걀 몸**이다. 배 판이 제일 크게 보이는 몸이라 듀오링고에 제일 가깝다
    bird: (c, d, b) => ell(50, 64, 20, 24, d) + ell(50, 62, 20, 24, c)
      + ell(50, 68, 13, 16, b) + feet(BEAK, 9, 6, 4),
    // 벌레 — **날개가 주인공이라** 몸은 작게 둔다. 마디 둘로 벌레임을 말한다
    bug: (c, d) => ell(50, 66, 9, 15, c)
      + `<path d="M42,64 h16 M43,71 h14" stroke="${d}" stroke-width="2" stroke-linecap="round"/>`
      // 더듬이 — **머리 위로 나가므로 머리보다 먼저 그려도 안 가려진다**
      + `<path d="M45,26 Q38,14 34,10 M55,26 Q62,14 66,10" stroke="${d}" stroke-width="2.2"`
      + ' fill="none" stroke-linecap="round"/>'
      + ell(34, 9, 3, 3, d) + ell(66, 9, 3, 3, d),
    // 물고기 — **머리가 몸 위에 얹힌 한 덩어리**다. 배지느러미는 뺐다(다리로 읽혔다)
    // ⚠️ 머리를 몸만 하게 두었더니 둘이 포개져 그냥 «공»이 됐다 — 머리를 한 치수 줄여
    //    위로 올려야 「고개」가 보인다 (여섯 몸통 중 유일하게 다리가 없는 몸이다)
    // ⚠️⚠️ **물고기는 «어항 안»에서 헤엄친다** — 상자(100×100)에만 들어오면 되는 것이
    //    아니라 유리(`bowl`)를 넘으면 안 된다. 몸을 키웠더니 꼬리·지느러미가 헤엄
    //    양 끝에서 유리를 1px 넘어 `checkavatar` 의 「어항」이 잡았다
    fish: (c, d, b) => ell(50, 62, 25, 22, d) + ell(50, 60, 25, 22, c)
      + ell(50, 66, 15, 12, b),
  };

  // ─── 귀 ── 머리에서 자리를 뽑는다 (x, y, rx, ry = HEAD) ────────
  const EAR = {
    none: () => '',
    // 곰·두더지 — 머리 꼭대기 양옆에 동그랗게
    round: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const ex = x + rx * 0.74 * f, ey = y - ry * 0.68;
      return ell(ex, ey, rx * 0.30, rx * 0.30, c) + ell(ex, ey, rx * 0.15, rx * 0.15, d);
    }).join(''),
    // 토끼·사슴·염소 — 길게 선다. **끝이 둥글다**(⑤)
    long: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const ex = x + rx * 0.42 * f, ey = y - ry * 1.05;
      return `<g transform="rotate(${14 * f} ${ex} ${ey})">`
        + ell(ex, ey, rx * 0.21, ry * 0.62, c) + ell(ex, ey + ry * 0.06, rx * 0.10, ry * 0.40, d)
        + '</g>';
    }).join(''),
    // 고양이·여우 — 세모지만 «둥근» 세모다. `Q` 로 꼭짓점을 굴린다
    tuft: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const bx = x + rx * 0.52 * f, by = y - ry * 0.62;
      const tx = x + rx * 0.80 * f, ty = y - ry * 1.22;
      const ix = x + rx * 0.18 * f, iy = y - ry * 0.82;
      return `<path d="M${bx},${by} Q${tx},${ty} ${(tx + ix) / 2},${(ty + iy) / 2 + 2} Q${ix},${iy} ${bx},${by} Z" fill="${c}"/>`
        + `<path d="M${bx + rx * 0.06 * f},${by - 2} Q${(tx + bx) / 2},${(ty + by) / 2} ${(tx + ix) / 2},${(ty + iy) / 2 + 4} Z" fill="${d}" opacity="0.5"/>`;
    }).join(''),
    // 물고기·해마 — 머리 옆의 부채 지느러미
    fin: (x, y, rx, ry, c) => [-1, 1].map(f =>
      `<path d="M${x + rx * 0.86 * f},${y} q${9 * f},-8 ${11 * f},3 q${-6 * f},5 ${-11 * f},2 Z"`
      + ` fill="${c}" opacity="0.9"/>`).join(''),
  };

  // ─── 뿔 ── 머리 꼭대기에 «앉힌다» ──────────────────────────────
  //
  // ⚠️ 귀보다 안쪽·위다 — 같은 자리에 두면 긴 귀에 통째로 가려진다.
  // ⚠️⚠️ **몸과 «다른 재질»로 읽혀야 한다.** 속성 색을 그대로 쓰면 같은 계열이라
  //    머리에 묻힌다 (유니콘 뿔이 옅은 노랑 머리 위의 옅은 노랑이었다). 윤곽선은
  //    이 그림의 결이 아니므로(`ART_POLICY`) **색의 «밝기»로 가른다** —
  // ⚠️⚠️ **상아빛으로 두었다가 한 번 헛짚었다** — 뿔끝은 머리 «위»로 나가는데 거기
  //    배경이 옅은 판(`tint(raw, 86)`)이라, 밝은 뿔이 그 판에 그대로 묻혔다
  //    (유니콘 뿔이 실오라기로 보였다). 지금은 **속성 색 원색**이다: 털이 한 번 묽힌
  //    색(`COAT`)이라 머리 위에서도 몸 위에서도 또렷하고, 「원소로 된 뿔」로 읽혀
  //    수정 천산갑·유니콘의 설정과도 맞는다.
  // ⚠️ **색을 «이름»으로 고르지 않는다**(`a.horn === 'antler' ? …`) — 뿔을 하나 더
  //    만들면 그것만 조용히 기본색이 된다. 표가 작은 팔레트(`P`)를 받아 «제 재질»을 집는다
  const HORN = {
    none: () => '',
    single: (x, y, rx, ry, P) => {
      const c = P.gem, o = P.line;
      const t = y - ry - 28;
      return `<path d="M${x},${t} Q${x + 5},${y - ry - 11} ${x + 6.5},${y - ry + 3}`
        + ` L${x - 6.5},${y - ry + 3} Q${x - 5},${y - ry - 11} ${x},${t} Z" fill="${c}"/>`
        + `<path d="M${x - 4},${y - ry - 3} q4,-2.4 8,-1.4 M${x - 3},${y - ry - 11} q3.2,-2 6,-1`
        + ` M${x - 2},${y - ry - 18} q2.2,-1.4 4,-0.7"`
        + ` stroke="${o}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    },
    pair: (x, y, rx, ry, P) => [-1, 1].map(f =>
      `<path d="M${x + rx * 0.32 * f},${y - ry + 3} q${10 * f},-17 ${2 * f},-23`
      + ` q${-13 * f},7 ${-12 * f},23 Z" fill="${P.gem}" stroke="${P.line}"`
      + ' stroke-width="1.2" stroke-linejoin="round"/>').join(''),
    antler: (x, y, rx, ry, P) => [-1, 1].map(f => {
      const bx = x + rx * 0.36 * f, by = y - ry + 2;
      return `<path d="M${bx},${by} L${bx + 7 * f},${by - 22} M${bx + 4 * f},${by - 13} L${bx + 17 * f},${by - 19}`
        + ` M${bx + 7 * f},${by - 22} L${bx + 16 * f},${by - 30}"`
        + ` stroke="${P.wood}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join(''),
    crystal: (x, y, rx, ry, P) => {
      const c = P.gem, o = P.line;
      const t = y - ry - 20;
      return `<path d="M${x - 8},${y - ry + 3} L${x - 9.5},${t + 8} L${x},${t} L${x + 9.5},${t + 8} L${x + 8},${y - ry + 3} Z"`
        + ` fill="${c}"/>` + `<path d="M${x},${t + 1} L${x},${y - ry + 2}" stroke="${o}" stroke-width="1.6" opacity="0.5"/>`;
    },
  };

  // ─── 날개 — **몸통보다 «먼저»** 그린다 (뒤로 펼쳐진 것이다) ────
  const WING = {
    none: () => '',
    // ⚠️ **머리보다 «바깥»으로 펴야 한다** — 처음에 몸 뒤에 두었더니 머리에 통째로
    //    가려져 나방이 그냥 「귀 달린 공」이 됐다 (`bug` 의 머리 반지름이 18이다)
    // ⚠️ **상자(100×100) 밖으로 나가면 «잘린다»** — 31+22 = 103 으로 두었더니
    //    오른쪽 날개 끝이 소리 없이 깎였다 (`checkcreature` ①이 잡았다)
    butterfly: (c, d) => [-1, 1].map(f =>
      ell(50 + 28 * f, 48, 20, 17, c, ` opacity="0.92" transform="rotate(${-18 * f} ${50 + 28 * f} 48)"`)
      + ell(50 + 23 * f, 71, 14, 11.5, d, ' opacity="0.88"')).join(''),
    bird: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 16 * f},${58} q${24 * f},-8 ${26 * f},12 q${-16 * f},8 ${-27 * f},-3 Z"`
      + ` fill="${c}" opacity="0.95"/>`).join(''),
    bat: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 10 * f},${52} q${26 * f},-8 ${33 * f},12 q${-8 * f},-5 ${-12 * f},1`
      + ` q${-4 * f},-6 ${-9 * f},0 q${-2 * f},-8 ${-12 * f},-13 Z" fill="${c}"/>`).join(''),
    fin: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 19 * f},${50} q${13 * f},-10 ${16 * f},3 q${-8 * f},7 ${-16 * f},-3 Z"`
      + ` fill="${c}" opacity="0.75"/>`).join(''),
  };

  // ─── 꼬리 — 오른쪽 «뒤»로 (몸통보다 먼저) ─────────────────────
  const TAIL = {
    none: () => '',
    puff: (c) => ell(76, 72, 11, 11, c),
    long: (c) => `<path d="M70,74 q20,2 20,-18 q0,-7 -5,-8" stroke="${c}" stroke-width="8"`
      + ' fill="none" stroke-linecap="round"/>',
    fish: (c) => `<path d="M68,62 q17,-14 21,-6 q-4,6 0,12 q-4,8 -21,-6 Z" fill="${c}" opacity="0.95"/>`,
    leaf: (c) => `<path d="M72,74 q18,0 19,-16 q-16,1 -19,16 Z" fill="${c}"/>`,
  };

  // ─── 눈 — **여기가 「귀엽다」의 8할이다** ──────────────────────
  //
  // ⚠️⚠️ **빛은 «두 점»이고 둘 다 같은 쪽이다** — 빛이 하나니까 그것이 맞다
  //    (portrait.js 의 「젖은 눈」과 같은 규칙이다). 한 점이면 그냥 까만 구슬이다
  // ⚠️ **넷이 다 커야 한다** — 「시크」를 삼각형으로 그렸더니 화살표로 읽혀
  //    그 크리처만 안 귀여웠다 (초상화의 `sharp` 에서 이미 겪은 자리다).
  //    갈리는 것은 «눈꺼풀»이지 «크기»가 아니다
  const EYE = {
    // 까만 콩 눈 — 흰자 없이. 제일 단순하고 제일 동글하다
    dot: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11 * s * f;
      return ell(ex, y, 5.4 * s, 6 * s, INK)
        + ell(ex + 1.9 * s, y - 2.1 * s, 1.9 * s, 1.7 * s, '#fff', ' opacity="0.95"')
        + ell(ex - 1.8 * s, y + 2.2 * s, 1.1 * s, 1.0 * s, '#fff', ' opacity="0.88"');
    }).join(''),
    // 젖은 큰 눈 — 흰자 + 눈동자 + 빛 둘
    round: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11 * s * f;
      return ell(ex, y, 7.2 * s, 8 * s, '#fff')
        + ell(ex, y + 0.6 * s, 4.9 * s, 5.4 * s, INK)
        + ell(ex + 1.5 * s, y - 1.6 * s, 1.95 * s, 1.8 * s, '#fff')
        + ell(ex - 1.6 * s, y + 2.2 * s, 1.1 * s, 1.0 * s, '#fff', ' opacity="0.9"');
    }).join(''),
    // 반쯤 감은 눈 — 위 눈꺼풀이 덮인다. 「시크」가 삼각형이 아니라 **반달**이다
    sharp: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11 * s * f;
      return ell(ex, y, 7.0 * s, 7.4 * s, '#fff')
        + ell(ex, y + 1.6 * s, 4.8 * s, 5.2 * s, INK)
        + ell(ex + 1.7 * s, y, 1.8 * s, 1.6 * s, '#fff')
        + ell(ex - 1.7 * s, y + 3.4 * s, 1.1 * s, 1.0 * s, '#fff', ' opacity="0.88"')
        + `<path d="M${ex - 7.2 * s},${y - 1.2 * s} q${7.2 * s},${-6.4 * s} ${14.4 * s},0"`
        + ` stroke="${INK}" stroke-width="${2.6 * s}" fill="none" stroke-linecap="round"/>`;
    }).join(''),
    // 감은 눈 — 아래로 휜 호. 호가 «위»로 휘면 웃는 눈이 되어 「졸음」이 안 읽힌다
    sleepy: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11 * s * f;
      return `<path d="M${ex - 6 * s},${y - 1 * s} q${6 * s},${6 * s} ${12 * s},0"`
        + ` stroke="${INK}" stroke-width="${2.8 * s}" fill="none" stroke-linecap="round"/>`;
    }).join(''),
  };

  // ─── 입 — 아주 작게 ───────────────────────────────────────────
  // ⚠️ 입을 키우면 눈이 작아 보인다. 「귀엽다」를 지는 것은 눈이고 입은 거드는 것뿐이다
  const MOUTH = {
    beak: (x, y) => `<path d="M${x - 5},${y} q5,-2 10,0 q-5,7 -10,0 Z" fill="${BEAK}"/>`,
    wide: (x, y) => `<path d="M${x - 7.5},${y - 2} q7.5,7 15,0" stroke="${INK}" stroke-width="2.2"`
      + ' fill="none" stroke-linecap="round"/>',
    w: (x, y) => `<path d="M${x - 5},${y - 1} q2.5,3.4 5,0 q2.5,3.4 5,0" stroke="${INK}"`
      + ' stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  // 몸통마다 입이 다르다 — 새는 부리, 개구리·거북은 «활짝», 나머지는 작은 ω
  const MOUTH_OF = { bird: 'beak', blob: 'wide', bug: 'w', fish: 'wide' };

  // ─── 무늬 ── 몸통 위에 얹는다 (제 좌표계 0,0 기준) ─────────────
  const PAT = {
    none: () => '',
    spot: (d) => `<circle cx="-7" cy="-3" r="4.2" fill="${d}" opacity="0.4"/>`
      + `<circle cx="5" cy="3" r="3.2" fill="${d}" opacity="0.4"/>`
      + `<circle cx="-1" cy="10" r="2.6" fill="${d}" opacity="0.4"/>`,
    stripe: (d) => `<path d="M-8,-7 q4,9 0,17 M3,-7 q4,9 0,17" stroke="${d}" stroke-width="3.2"`
      + ' fill="none" opacity="0.35" stroke-linecap="round"/>',
    glow: (c) => `<circle cx="0" cy="2" r="12" fill="${tint(c, 72)}" opacity="0.5"/>`,
  };

  // ─── 머리 위로 얼마나 올라가는가 ─────────────────────────────
  //
  // ⚠️⚠️ **뿔과 긴 귀는 상자(100×100) 위로 나가 «잘린다».** 뿔을 보이게 키웠더니
  //    유니콘·사슴·염소·천산갑의 뿔이 통째로 y<0 으로 나가 **한 마리도 안 보였다**
  //    (토끼 귀는 끝이 잘려 있었다). SVG 는 viewBox 밖을 아예 안 그리므로 **티가 안 난다**.
  // ⚠️ 고치는 길이 둘인데 하나만 맞는다 — 「뿔을 도로 줄인다」는 44px 에서 안 보이는
  //    자리로 되돌아가는 것이고, 「머리를 내린다」는 뿔 없는 스물넷까지 같이 내려간다.
  //    그래서 **뿔·귀가 있는 마리만 전체를 조금 줄인다** — 바닥(`GROUND`)을 축으로
  //    줄이므로 **발은 한 픽셀도 안 움직이고** 머리 위에만 자리가 난다.
  // ⚠️ 숫자를 박지 않는다 — 부품이 «얼마나 올라가는지»에서 배율을 «풀어» 낸다.
  //    뿔을 더 키우면 배율이 저절로 따라온다 (베껴 두면 다음에 또 잘린다)
  const TOP_PAD = 3;                      // 상자 꼭대기에 남기는 숨
  const HORN_UP = { none: 0, single: 28, pair: 24, antler: 31, crystal: 21 };
  const EAR_UP = { none: 0, round: 0, long: 0.69, tuft: 0.24, fin: 0 };   // 머리 ry 에 대한 비

  // 크리처 한 마리를 그린다.
  //   c    : data.js 의 `result` (id · attr · art …)
  //   opts.size  픽셀 크기 (기본은 CSS 가 정한다)
  //   opts.flat  배경 판 없이 — 목록 칸처럼 이미 판이 있는 자리에 쓴다
  function draw(c, opts) {
    if (!c || !c.art) return '';
    opts = opts || {};
    const attr = (window.GameData && GameData.creatureAttr(c.attr)) || { color: '#9a8fb0' };
    const raw = attr.color;
    // ⚠️ **속성 색을 «그대로» 칠하지 않는다**(⑦) — 크림색 화면 위에서 원색만 튄다.
    //    그래도 색상은 그대로라 「불은 붉다」는 안 깨진다
    const COAT = tint(raw, 26);
    const DARK = shade(COAT, 16);          // 아래쪽 그늘 — 아주 옅게 (평면을 지킨다)
    const BELLY = tint(raw, 74);           // 배·얼굴 판 (③)
    const LIGHT = tint(raw, 48);
    const a = c.art;
    const [hx, hy, hrx, hry] = HEAD[a.body] || HEAD.quad;

    const body = (BODY[a.body] || BODY.quad)(COAT, DARK, BELLY);
    const wing = (WING[a.wing] || WING.none)(LIGHT, COAT);
    const tail = (TAIL[a.tail] || TAIL.none)(COAT);
    const ear = (EAR[a.ear] || EAR.none)(hx, hy, hrx, hry, COAT, tint(BLUSH, 30));
    const horn = (HORN[a.horn] || HORN.none)(hx, hy, hrx, hry,
      { gem: raw, line: tint(raw, 74), wood: shade(raw, 24) });
    // 머리 — 그늘 한 겹을 밑에 깔아 «둥글게» 보이게 한다
    const head = ell(hx, hy + 1.5, hrx, hry, DARK) + ell(hx, hy, hrx, hry, COAT);
    // 얼굴 판 — 눈 둘레가 옅어야 눈이 더 커 보인다 (③)
    const face = ell(hx, hy + hry * 0.26, hrx * 0.74, hry * 0.62, BELLY, ' opacity="0.85"');
    const ey = hy + hry * 0.10;
    const es = Math.min(1.12, hrx / 24);            // 머리가 작으면 눈도 같이 줄인다
    const eye = (EYE[a.eye] || EYE.dot)(hx, ey, es);
    // ⚠️ **입을 눈에서 충분히 떨어뜨린다.** 9.5 로 두었더니 머리가 작은 물고기에서
    //    입과 눈이 붙어 **먹색 덩어리 하나**가 됐다 (`checkcreature` 가 「눈동자 1개에
    //    빛 5점」으로 잡았다). 그림으로도 입이 눈에 닿으면 얼굴이 답답하다
    const mouth = MOUTH[MOUTH_OF[a.body] || 'w'](hx, ey + 11 * es);
    // 볼터치 (⑥) — 눈 바깥쪽, 입 높이
    const blush = [-1, 1].map(f =>
      ell(hx + hrx * 0.70 * f, ey + 6.5 * es, 4.6 * es, 3.0 * es, BLUSH, ' opacity="0.55"')).join('');

    const [px, py, ps] = PAT_AT[a.body] || PAT_AT.quad;
    const patInner = (PAT[a.pat] || PAT.none)(a.pat === 'glow' ? raw : shade(COAT, 24));
    const pat = patInner ? `<g transform="translate(${px},${py}) scale(${ps})">${patInner}</g>` : '';

    // 머리 위로 제일 높이 올라가는 것을 찾아 **그만큼 전체를 줄인다**(바닥이 축이다)
    const up = Math.max(HORN_UP[a.horn] || 0, (EAR_UP[a.ear] || 0) * hry);
    const top = hy - hry - up;
    const k = top < TOP_PAD ? (GROUND - TOP_PAD) / (GROUND - top) : 1;
    const fit = k < 1 ? ` transform="translate(50,${GROUND}) scale(${k.toFixed(3)}) translate(-50,${-GROUND})"` : '';

    // 그리는 순서가 곧 앞뒤다: 날개·꼬리(뒤) → 몸통 → 무늬 → 귀·뿔 → 머리 → 얼굴
    // ⚠️ **발밑 그림자는 줄이는 그룹 «밖»이다** — 안에 넣으면 뿔 달린 마리만 그림자가
    //    같이 작아져 바닥이 둘로 보인다
    return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${(c.name || '').replace(/"/g, '')}"
      ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''}>
      ${opts.flat ? '' : `<circle cx="50" cy="50" r="49" fill="${tint(raw, 86)}"/>`}
      ${opts.noShadow ? '' : ell(50, GROUND + 2, 26, 5, shade(raw, 10), ' opacity="0.16"')}
      <g${fit}>${wing}${tail}${body}${pat}${ear}${horn}${head}${face}${eye}${blush}${mouth}</g>
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
        <ellipse cx="50" cy="92" rx="15" ry="4" fill="#b9a48f"/>
        <rect x="42" y="86" width="16" height="6" rx="2" fill="#c9b49f"/>
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

  window.Creature = { draw, icon, bowl, of, W, H, BODY, EAR, HORN, WING, TAIL, EYE, PAT };
})();
