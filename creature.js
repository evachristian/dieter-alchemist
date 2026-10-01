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

  // ═══ 실루엣 — 「굵은 선 한 겹」과 「한 덩어리」 (2026-10-01) ═════
  //
  // 「크리처 실루엣도 더 정교하게 해줘. 지금 너무 실루엣이 투박해」로 받았고,
  // 사람이 **고양이 레퍼런스 한 장**을 같이 줬다(굵은 먹선으로 두른 치비 스티커).
  // 투박의 정체가 둘이었고 **둘 다 고쳐야 한다** — 하나만 하면 반쪽이다:
  //
  //   ⓐ **윤곽선이 한 줄도 없었다.** 평면 칠만 쌓여 있어서 조각끼리 경계가 없고,
  //      44px 에서는 통째로 «색 얼룩»이 된다. 굵은 선 한 겹이 둘러야 비로소
  //      «실루엣»이라는 것이 생긴다 — 레퍼런스가 하는 일이 바로 그것이다
  //   ⓑ **몸이 «타원을 포갠 것»이었다.** 둘레의 곡률이 어디서나 같아 허리도
  //      엉덩이도 없다. 위가 좁고 아래가 넓은 **한 덩어리**(`pear`)라야
  //      「앉아 있는 짐승」으로 읽힌다
  //
  // ⚠️⚠️ **선은 «조각마다» 두르되 그리는 순서가 곧 앞뒤다.** 실루엣 한 겹을 뒤에
  //    까는 방법(바깥 테두리만 남는다)도 해 봤는데, 그러면 머리와 몸 사이에 선이
  //    없어 **둘이 한 색 덩어리로 녹아 붙는다.** 레퍼런스도 머리·귀·소매가 저마다
  //    선을 갖고 있다 — 가려지는 쪽은 그리는 순서가 알아서 덮는다.
  // ⚠️ **선을 두른 것은 «실루엣을 이루는 것»뿐이다**(날개·꼬리·몸·귀·뿔·머리).
  //    얼굴 판·무늬·볼터치·눈빛은 «표면»이라 선이 붙으면 얼굴이 지저분해진다.
  //    그래서 선 두른 그룹 «밖»에 그린다 — 자리가 하나라 빠뜨릴 데가 없다.
  // ⚠️⚠️ **그늘 한 겹을 깔던 꼼수는 걷었다.** 예전에는 몸·머리마다 `DARK` 타원을
  //    1.5~2 내려 깔아 둥글어 보이게 했는데, 선이 생기자 그 몫을 선이 더 잘 한다 —
  //    남겨 두면 선 밑에 «때»처럼 비친다 (그려 보고 걷었다).
  // ⚠️ **선 굵기는 viewBox 단위다** — 44px 칸에서 1.06px, 120px 도감에서 2.9px.
  //    3.0 으로 두었더니 44px 에서 선이 그림을 먹었다 (셋을 그려 놓고 골랐다).
  const LINE = '#44353d';         // 먹선 — 서른 마리가 «한 가족»으로 보이게 한 색이다
  const OUT = 2.4;                // 굵기 (한쪽으로 1.2 나간다 — `TOP_PAD` 가 그만큼 넉넉하다)

  // 머리 — [cx, cy, rx, ry]. **귀·뿔·눈이 다 이 넷에서 자리를 잡는다.**
  // ⚠️ 부품마다 좌표를 박으면 머리를 키웠을 때 귀만 옛 자리에 남는다
  // ⚠️ **머리를 한 치수 더 키웠다** (2026-10-01 · 「정말정말정말 귀엽게」).
  //    크리처에는 아바타의 «바디파츠» 같은 축이 없어서 — 몸이 늘었다 줄었다 하지
  //    않으니 — 등신을 마리마다 손으로 정해도 어긋날 데가 없다. 2.2등신에서
  //    **2.0등신**으로 내렸다: 머리가 몸보다 «크다»는 것이 치비의 전부다
  const HEAD = {
    blob: [50, 40, 27, 24],
    quad: [50, 34, 27, 25],
    bear: [50, 32, 29, 27],
    deer: [50, 30, 23, 22],
    bird: [50, 33, 26, 24],
    bug:  [50, 39, 19, 18],
    fish: [50, 44, 22, 20],
  };
  // 무늬를 어디에 얹나 — [x, y, 배율]. 몸통마다 덩어리가 있는 자리가 다르다
  const PAT_AT = {
    blob: [50, 70, 1.0], quad: [50, 70, 0.95], bear: [50, 70, 1.15], deer: [50, 66, 0.8],
    bird: [50, 68, 0.95], bug: [50, 66, 0.5], fish: [50, 70, 0.9],
  };

  const n1 = (v) => (Math.round(v * 10) / 10);
  const ell = (x, y, rx, ry, f, extra) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"${extra || ''}/>`;

  // 몸통 한 덩어리 — **위가 좁고 아래가 넓다**(ⓑ). 각이 하나도 없다(⑤)
  //
  // ⚠️ 제일 넓은 자리(`my`)를 아래쪽 6할에 둔다. 한가운데에 두면 그냥 타원이 되고,
  //    더 내리면 «자루»가 된다 (0.5 · 0.6 · 0.72 를 그려 놓고 골랐다)
  // ⚠️ 밑변의 제어점을 둘 다 `bot` 에 두어 **바닥이 평평하다** — 앉은 것으로 읽힌다
  const pear = (top, bot, wt, wb, f, cx) => {
    const x = cx == null ? 50 : cx, h = bot - top, my = top + h * 0.60;
    return `<path d="M${x},${top}`
      + ` C${n1(x - wt)},${top} ${n1(x - wb)},${n1(top + h * 0.26)} ${n1(x - wb)},${n1(my)}`
      + ` C${n1(x - wb)},${n1(bot - h * 0.05)} ${n1(x - wb * 0.56)},${bot} ${x},${bot}`
      + ` C${n1(x + wb * 0.56)},${bot} ${n1(x + wb)},${n1(bot - h * 0.05)} ${n1(x + wb)},${n1(my)}`
      + ` C${n1(x + wb)},${n1(top + h * 0.26)} ${n1(x + wt)},${top} ${x},${top} Z" fill="${f}"/>`;
  };
  // 머리 — 타원이 아니라 **볼이 살짝 넓은** 둥근 꼴이다. 치비의 「볼살」이 여기서 온다
  const skull = (x, y, rx, ry, f) =>
    `<path d="M${x},${n1(y - ry)}`
    + ` C${n1(x - rx * 0.86)},${n1(y - ry)} ${n1(x - rx)},${n1(y - ry * 0.42)} ${n1(x - rx)},${n1(y + ry * 0.10)}`
    + ` C${n1(x - rx)},${n1(y + ry * 0.74)} ${n1(x - rx * 0.60)},${n1(y + ry)} ${x},${n1(y + ry)}`
    + ` C${n1(x + rx * 0.60)},${n1(y + ry)} ${n1(x + rx)},${n1(y + ry * 0.74)} ${n1(x + rx)},${n1(y + ry * 0.10)}`
    + ` C${n1(x + rx)},${n1(y - ry * 0.42)} ${n1(x + rx * 0.86)},${n1(y - ry)} ${x},${n1(y - ry)} Z" fill="${f}"/>`;

  // 둥근 발 둘 — 바닥(`GROUND`)에 붙는다. **몸 안쪽으로 반쯤 물려** 그려서
  // 먹선이 「발」로 읽히게 한다 (바닥에 따로 떨어뜨리면 «구슬 둘»이 된다)
  const feet = (d, dx, rx, ry) =>
    ell(50 - dx, GROUND - ry + 1, rx, ry, d) + ell(50 + dx, GROUND - ry + 1, rx, ry, d);
  // 발가락 — 발 위에 짧은 금 둘. 44px 에서는 안 보이지만 120px 도감에서 «발»이 된다
  const toes = (dx, rx, ry, o) => [-1, 1].map(f => {
    const cx = 50 + dx * f, cy = GROUND - ry + 1;
    return `<path d="M${n1(cx - rx * 0.30)},${n1(cy - ry * 0.25)} v${n1(ry * 0.62)}`
      + ` M${n1(cx + rx * 0.30)},${n1(cy - ry * 0.25)} v${n1(ry * 0.62)}"`
      + ` stroke="${o}" stroke-width="1.5" stroke-linecap="round" opacity="0.5" fill="none"/>`;
  }).join('');
  // 가는 다리 둘 — 사슴·염소처럼 다리가 보이는 몸만 쓴다
  const legs = (d, dx, y0, w) =>
    [-dx, dx].map(x => `<rect x="${50 + x - w / 2}" y="${y0}" width="${w}" height="${GROUND - y0 - 2}"`
      + ` rx="${w / 2}" fill="${d}"/>`).join('')
    + feet(d, dx, w * 1.28, w * 0.74);

  // ─── 몸통 — **정면**이다 ──────────────────────────────────────
  // c: 털색(묽힌 속성색) · d: 그늘 · b: 배 판(아주 옅은 색)
  // 배 판 — 선을 «가늘게» 두른다. 몸과 같은 굵기로 두르면 44px 에서 둘이 엉켜
  // 몸이 통째로 겹선으로 보인다 (그려 보고 갈랐다)
  const plate = (s) => `<g stroke-width="1.5">${s}</g>`;
  const BODY = {
    // 넓적한 덩어리 — 개구리 · 거북 · 두꺼비 · 달팽이. 앉아 있는 모양이다
    blob: (c, d, b) => pear(56, 90, 20, 31, c)
      + plate(pear(66, 86.5, 13, 20, b))
      + feet(c, 25, 9.5, 6) + toes(25, 9.5, 6, d),
    // 날씬한 네발 — 고양이 · 여우 · 담비 · 도마뱀. 앞발을 모으고 앉았다
    // ⚠️ 앞발(팔)은 몸 옆선에 «반쯤 걸쳐» 둔다 — 안으로 넣으면 안 보이고,
    //    밖으로 빼면 몸에서 떨어진 «귀» 둘로 보인다
    quad: (c, d, b) => pear(46, 90, 10, 23, c)
      + ell(31, 73, 7, 11, c) + ell(69, 73, 7, 11, c)
      + plate(pear(58, 86, 8, 13.5, b))
      + feet(c, 12, 8.5, 6) + toes(12, 8.5, 6, d),
    // 몸집 큰 네발 — 곰 · 두더지 · 천산갑. 팔이 굵고 짧다
    bear: (c, d, b) => pear(44, 90, 14, 28, c)
      + ell(27, 71, 8.5, 13, c) + ell(73, 71, 8.5, 13, c)
      + plate(pear(56, 86, 11, 17, b))
      + feet(c, 14, 10, 6.5) + toes(14, 10, 6.5, d),
    // 다리 긴 네발 — 사슴 · 염소 · 유니콘 · 토끼. 머리가 높이 있다
    deer: (c, d, b) => legs(c, 11, 66, 8) + pear(44, 78, 9, 17, c)
      + plate(pear(56, 75, 7, 11, b)),
    // 새 — **달걀 몸**이다. 배 판이 제일 크게 보이는 몸이라 듀오링고에 제일 가깝다
    bird: (c, d, b) => pear(42, 86, 11, 22, c)
      + plate(pear(52, 83, 10, 16, b))
      + feet(BEAK, 9, 6, 4.2) + toes(9, 6, 4.2, shade(BEAK, 30)),
    // 벌레 — **날개가 주인공이라** 몸은 작게 둔다. 마디 둘로 벌레임을 말한다
    bug: (c, d) => pear(52, 84, 7, 10, c)
      + `<path d="M43,64 h14 M44,71 h12" stroke="${d}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      // 더듬이 — **머리 위로 나가므로 머리보다 먼저 그려도 안 가려진다**
      + `<path d="M45,25 Q38,14 34,10 M55,25 Q62,14 66,10" stroke="${LINE}" stroke-width="2.2"`
      + ' fill="none" stroke-linecap="round"/>'
      + ell(34, 9, 3.4, 3.4, c) + ell(66, 9, 3.4, 3.4, c),
    // 물고기 — **머리가 몸 위에 얹힌 한 덩어리**다. 배지느러미는 뺐다(다리로 읽혔다)
    // ⚠️ 머리를 몸만 하게 두었더니 둘이 포개져 그냥 «공»이 됐다 — 머리를 한 치수 줄여
    //    위로 올려야 「고개」가 보인다 (여섯 몸통 중 유일하게 다리가 없는 몸이다)
    // ⚠️⚠️ **물고기는 «어항 안»에서 헤엄친다** — 상자(100×100)에만 들어오면 되는 것이
    //    아니라 유리(`bowl`)를 넘으면 안 된다. 몸을 키웠더니 꼬리·지느러미가 헤엄
    //    양 끝에서 유리를 1px 넘어 `checkavatar` 의 「어항」이 잡았다
    fish: (c, d, b) => ell(50, 60, 25, 22, c)
      + plate(ell(50, 67, 14.5, 11, b)),
  };

  // ─── 귀 ── 머리에서 자리를 뽑는다 (x, y, rx, ry = HEAD) ────────
  const EAR = {
    none: () => '',
    // 곰·두더지 — 머리 꼭대기 양옆에 동그랗게. **속귀를 «같은 모양으로 줄여»** 넣는다
    round: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const ex = x + rx * 0.72 * f, ey = y - ry * 0.66, r = rx * 0.34;
      return ell(n1(ex), n1(ey), n1(r), n1(r), c)
        + `<g stroke-width="1.4">` + ell(n1(ex), n1(ey + r * 0.12), n1(r * 0.52), n1(r * 0.52), d) + '</g>';
    }).join(''),
    // 토끼·사슴·염소 — 길게 선다. **끝이 둥글고 바깥으로 살짝 눕는다**(⑤)
    long: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const ex = n1(x + rx * 0.40 * f), ey = n1(y - ry * 1.08);
      const w = n1(rx * 0.25), h = n1(ry * 0.72);
      return `<g transform="rotate(${12 * f} ${ex} ${ey})">`
        + ell(ex, ey, w, h, c)
        + `<g stroke-width="1.4">` + ell(ex, n1(ey + h * 0.10), n1(w * 0.48), n1(h * 0.66), d) + '</g>'
        + '</g>';
    }).join(''),
    // 고양이·여우 — **레퍼런스의 그 귀다.** 밑동이 넓고 끝이 뾰족한데 두 변이
    // 서로 반대로 휘어, 바깥은 거의 곧고 안쪽은 불룩하다.
    // ⚠️ 「둥근 세모」(`Q` 한 번으로 굴린 것)로 두었더니 **귀가 아니라 «혹»**이었다 —
    //    고양이를 고양이로 만드는 것은 귀 하나이고, 그 귀는 «뾰족»해야 한다.
    //    끝은 `C` 의 제어점을 가깝게 두어 굴린다 (각은 여전히 없다)
    // ⚠️ 흰 털뭉치는 레퍼런스에 있는 것이고, 속귀와 «같은 자리»에서 뽑는다 —
    //    따로 적으면 귀를 키웠을 때 털만 옛 자리에 남는다
    tuft: (x, y, rx, ry, c, d) => [-1, 1].map(f => {
      const ix = n1(x + rx * 0.24 * f), iy = n1(y - ry * 0.80);   // 안쪽 밑동
      const tx = n1(x + rx * 0.80 * f), ty = n1(y - ry * 1.55);   // 끝
      const ox = n1(x + rx * 0.96 * f), oy = n1(y - ry * 0.26);   // 바깥 밑동
      const mx = n1((ix + tx) / 2), my = n1((iy + ty) / 2);
      return `<path d="M${ix},${iy}`
        + ` C${n1(ix + rx * 0.06 * f)},${n1(iy - ry * 0.40)} ${n1(tx - rx * 0.10 * f)},${n1(ty + ry * 0.30)} ${tx},${ty}`
        + ` C${n1(tx + rx * 0.08 * f)},${n1(ty + ry * 0.20)} ${n1(ox + rx * 0.04 * f)},${n1(oy - ry * 0.62)} ${ox},${oy} Z" fill="${c}"/>`
        + `<g stroke-width="1.4"><path d="M${n1(ix + rx * 0.10 * f)},${n1(iy - ry * 0.04)}`
        + ` C${n1(ix + rx * 0.16 * f)},${n1(iy - ry * 0.34)} ${n1(mx + rx * 0.10 * f)},${n1(my + ry * 0.16)} ${n1((tx + ix) / 2 + rx * 0.10 * f)},${n1(my - ry * 0.06)}`
        + ` C${n1(mx + rx * 0.26 * f)},${n1(my + ry * 0.12)} ${n1(ox - rx * 0.06 * f)},${n1(oy - ry * 0.46)} ${n1(ox - rx * 0.14 * f)},${n1(oy - ry * 0.04)} Z" fill="${d}"/></g>`
        // 속귀 안의 흰 털뭉치 — 선 없이 (④ 의 빛점과 섞이지 않게 눈에서 멀다)
        + `<g stroke="none">` + ell(n1(ix + rx * 0.30 * f), n1(iy - ry * 0.16), n1(rx * 0.11), n1(ry * 0.13),
          tint(d, 62), ' opacity="0.85"') + '</g>';
    }).join(''),
    // 물고기·해마 — 머리 옆의 부채 지느러미. **갈퀴 금 둘**이 있어야 지느러미로 읽힌다
    fin: (x, y, rx, ry, c, d) => [-1, 1].map(f =>
      `<path d="M${n1(x + rx * 0.84 * f)},${n1(y - 3)} q${9 * f},-7 ${12 * f},4 q${-6 * f},6 ${-12 * f},3 Z"`
      + ` fill="${c}"/>`
      + `<g stroke="none"><path d="M${n1(x + rx * 0.90 * f)},${n1(y - 2)} q${6 * f},-3 ${8 * f},2`
      + ` M${n1(x + rx * 0.90 * f)},${n1(y + 2)} q${5 * f},-1 ${7 * f},2" stroke="${d}"`
      + ' stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.6"/></g>').join(''),
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
    // 유니콘 — **밑동이 굵은 원뿔**이다. 가는 송곳으로 두었더니 「실오라기」였다.
    // 나선 금 셋은 선 «안»에 눕는다 (그룹의 먹선은 바깥 윤곽만 그린다)
    single: (x, y, rx, ry, P) => {
      const b = n1(y - ry + 5), t = n1(y - ry - 30);
      return `<path d="M${x},${t} C${n1(x + 3.4)},${n1(t + 9)} ${n1(x + 7.6)},${n1(b - 10)} ${n1(x + 7.6)},${b}`
        + ` L${n1(x - 7.6)},${b} C${n1(x - 7.6)},${n1(b - 10)} ${n1(x - 3.4)},${n1(t + 9)} ${x},${t} Z" fill="${P.gem}"/>`
        + `<g stroke="none"><path d="M${n1(x - 5.8)},${n1(b - 4)} q5.8,-3.6 11.6,-1.8`
        + ` M${n1(x - 4.4)},${n1(b - 13)} q4.4,-3 8.8,-1.4 M${n1(x - 2.9)},${n1(b - 22)} q2.9,-2.2 5.8,-1"`
        + ` stroke="${P.line}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/></g>`;
    },
    // 염소 — **뒤로 말리는 한 쌍.** 귀 «안쪽»에서 올라와 바깥으로 휜다
    // (바깥에 두었더니 긴 귀에 가려 뭐가 뭔지 안 보였다)
    pair: (x, y, rx, ry, P) => [-1, 1].map(f => {
      const bx = n1(x + rx * 0.60 * f), by = n1(y - ry * 0.62);
      return `<path d="M${bx},${by}`
        + ` C${n1(bx + 2 * f)},${n1(by - 12)} ${n1(bx + 7 * f)},${n1(by - 20)} ${n1(bx + 13 * f)},${n1(by - 23)}`
        + ` C${n1(bx + 9 * f)},${n1(by - 15)} ${n1(bx + 8.5 * f)},${n1(by - 6)} ${n1(bx + 9 * f)},${n1(by + 3)} Z"`
        + ` fill="${P.gem}"/>`;
    }).join(''),
    // 사슴 — **굵은 가지.** 획은 「획을 두를」 수가 없어서 먹선을 «먼저 굵게 긋고»
    // 그 위에 색을 조금 가늘게 덧긋는다 — 그러면 같은 윤곽선이 생긴다
    // ⚠️ 가늘게 두었더니 「마른 나뭇가지를 붙여 놓은 것」으로 보였다 (사람 신고의 그 결이다)
    antler: (x, y, rx, ry, P) => [-1, 1].map(f => {
      const bx = n1(x + rx * 0.34 * f), by = n1(y - ry * 0.88);
      const d = `M${bx},${by} C${n1(bx + 3 * f)},${n1(by - 9)} ${n1(bx + 5 * f)},${n1(by - 15)} ${n1(bx + 6.5 * f)},${n1(by - 23)}`
        + ` M${n1(bx + 3.6 * f)},${n1(by - 12)} C${n1(bx + 9 * f)},${n1(by - 13)} ${n1(bx + 13 * f)},${n1(by - 16)} ${n1(bx + 16 * f)},${n1(by - 20)}`
        + ` M${n1(bx + 5.2 * f)},${n1(by - 18)} C${n1(bx + 9 * f)},${n1(by - 21)} ${n1(bx + 12 * f)},${n1(by - 25)} ${n1(bx + 14 * f)},${n1(by - 29)}`;
      return `<path d="${d}" stroke="${LINE}" stroke-width="7.4" fill="none" stroke-linecap="round"/>`
        + `<path d="${d}" stroke="${P.wood}" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
    }).join(''),
    // 천산갑 — **쪼개진 수정 셋.** 한 덩어리로 두었더니 머리에 쓴 «고깔»이었다
    crystal: (x, y, rx, ry, P) => {
      const b = n1(y - ry + 5);
      const shard = (dx, h, w) => `<path d="M${n1(x + dx)},${n1(b - h)} L${n1(x + dx + w)},${n1(b - h * 0.44)}`
        + ` L${n1(x + dx + w * 0.70)},${b} L${n1(x + dx - w * 0.70)},${b} L${n1(x + dx - w)},${n1(b - h * 0.44)} Z"`
        + ` fill="${P.gem}"/>`;
      return shard(-9, 15, 4.8) + shard(9, 18, 4.8) + shard(0, 27, 6.2)
        + `<g stroke="none"><path d="M${x},${n1(b - 24)} L${x},${n1(b - 3)}" stroke="${P.line}"`
        + ' stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/></g>';
    },
  };

  // ─── 날개 — **몸통보다 «먼저»** 그린다 (뒤로 펼쳐진 것이다) ────
  const WING = {
    none: () => '',
    // ⚠️ **머리보다 «바깥»으로 펴야 한다** — 처음에 몸 뒤에 두었더니 머리에 통째로
    //    가려져 나방이 그냥 「귀 달린 공」이 됐다 (`bug` 의 머리 반지름이 18이다)
    // ⚠️ **상자(100×100) 밖으로 나가면 «잘린다»** — 31+22 = 103 으로 두었더니
    //    오른쪽 날개 끝이 소리 없이 깎였다 (`checkcreature` ①이 잡았다)
    // ⚠️⚠️ **반투명을 걷었다** — 먹선이 생기자 선까지 같이 흐려져 날개만 «유령»이
    //    됐다 (요소의 `opacity` 는 칠과 선에 같이 걸린다). 지금은 다 불투명이고,
    //    날개가 몸보다 옅은 것은 **색**(`LIGHT`)이 맡는다
    // ⚠️ 먹선이 한쪽으로 1.2 나가므로 **상자 끝에서 그만큼 물러나야 한다** —
    //    28+20 = 98 이던 나비 날개가 선까지 99.2 가 되어 잘렸다
    butterfly: (c, d) => [-1, 1].map(f =>
      ell(50 + 26 * f, 47, 19, 16.5, c, ` transform="rotate(${-18 * f} ${50 + 26 * f} 47)"`)
      + ell(50 + 22 * f, 70, 13.5, 11, d)
      // 날개 무늬 — 큰 점 하나. 나비를 나비로 만드는 것이 이 점이다
      + `<g stroke="none">` + ell(50 + 28 * f, 45, 4.4, 4.4, tint(c, 58), ' opacity="0.9"') + '</g>').join(''),
    bird: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 16 * f},${57} q${23 * f},-8 ${25 * f},12 q${-16 * f},8 ${-26 * f},-3 Z"`
      + ` fill="${c}"/>`).join(''),
    bat: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 10 * f},${51} q${25 * f},-8 ${32 * f},12 q${-8 * f},-5 ${-12 * f},1`
      + ` q${-4 * f},-6 ${-9 * f},0 q${-2 * f},-8 ${-12 * f},-13 Z" fill="${c}"/>`).join(''),
    fin: (c) => [-1, 1].map(f =>
      `<path d="M${50 + 19 * f},${50} q${13 * f},-10 ${16 * f},3 q${-8 * f},7 ${-16 * f},-3 Z"`
      + ` fill="${c}"/>`).join(''),
  };

  // ─── 꼬리 — 오른쪽 «뒤»로 (몸통보다 먼저) ─────────────────────
  const TAIL = {
    none: () => '',
    puff: (c, d) => ell(76, 73, 11, 11, c)
      + `<g stroke="none">` + ell(78, 70, 5, 4.6, tint(c, 46), ' opacity="0.85"') + '</g>',
    // ⚠️ 선 굵은 획 하나로 두면 «막대»다 — 밑동이 굵고 끝이 가늘어야 꼬리로 읽힌다.
    //    그래서 획이 아니라 **채운 모양**이다 (끝은 둥글게 말린다)
    long: (c) => '<path d="M68,76 C84,78 90,66 88,56 C87,50 83,47 80,48'
      + ' C77,49 76,53 78,55 C81,52 84,57 83,62 C81,70 75,72 67,70 Z"'
      + ` fill="${c}"/>`,
    fish: (c) => `<path d="M68,62 q17,-14 21,-6 q-4,6 0,12 q-4,8 -21,-6 Z" fill="${c}"/>`,
    leaf: (c) => `<path d="M71,75 C84,74 90,64 90,57 C82,58 73,65 71,75 Z" fill="${c}"/>`
      + `<path d="M74,73 C80,69 85,63 88,59" stroke="${shade(c, 22)}" stroke-width="1.4"`
      + ' fill="none" stroke-linecap="round" opacity="0.7"/>',
  };

  // ─── 눈 — **여기가 「귀엽다」의 8할이다** ──────────────────────
  //
  // ⚠️⚠️ **빛은 «두 점»이고 둘 다 같은 쪽이다** — 빛이 하나니까 그것이 맞다
  //    (portrait.js 의 「젖은 눈」과 같은 규칙이다). 한 점이면 그냥 까만 구슬이다
  // ⚠️ **넷이 다 커야 한다** — 「시크」를 삼각형으로 그렸더니 화살표로 읽혀
  //    그 크리처만 안 귀여웠다 (초상화의 `sharp` 에서 이미 겪은 자리다).
  //    갈리는 것은 «눈꺼풀»이지 «크기»가 아니다
  // ⚠️⚠️⚠️ **흰자와 눈꺼풀 선을 쓰지 않는다 — 그것이 「사람 눈」의 정체다.**
  //    한때 레퍼런스(사람 치비)를 따라 **흰자 → 홍채 → 동공 → 빛 둘 → 윗눈꺼풀 선**
  //    다섯 겹으로 그렸는데, 사람이 서른 마리를 놓고 **흰자가 있는 열여섯 마리를
  //    «정확히» 집어** 「사람 눈 같아서 안 귀엽다」고 했다 (`round` 여덟 · `sharp` 여덟).
  //    남겨 둔 것은 흰자가 없는 `dot` 여덟과 감은 눈 `sleepy` 여섯이다 — 사람이
  //    고른 것이 그대로 규칙이 된 자리다.
  // ⚠️⚠️ **사람 레퍼런스를 짐승에 그대로 옮기면 안 된다.** 사람 얼굴에서 흰자와
  //    눈꺼풀은 «눈매»를 만들지만, 짐승 치비에서는 그 둘이 곧 「사람」이라는 신호다.
  //    짐승의 귀여운 눈은 **까맣게 꽉 찬 한 덩어리**이고, 그 안에서 빛 두 점과
  //    속성 색 반달이 「젖은 눈」을 만든다.
  // ⚠️ **넷을 가르는 것은 «모양»이지 눈꺼풀이 아니다** —
  //    `dot`(작고 동그란 콩) · `round`(크고 세로로 긴) · `sharp`(윗변이 평평한 ·
  //    반쯤 감은 「시크」) · `sleepy`(감고 웃는 호).
  // ⚠️⚠️ **빛·반달이 «까만 덩어리의 가장자리에 닿으면» 안 된다** — 닿는 순간 먹
  //    고리가 끊겨 덩어리가 둘로 쪼개지고, `checkcreature` ④가 「빛 3점」으로 잡는다
  //    (실제로 났다). 그림으로도 눈이 «터진» 것으로 보인다. 여유를 1 단위는 둔다
  // ⚠️ 반달 색은 속성 색에서 뽑는다(`iris`) — 불 크리처는 눈 속도 붉다
  const EYE = {
    // 까만 콩 눈 — 흰자 없이. 제일 단순하고 제일 동글하다
    dot: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11.5 * s * f;
      return ell(n1(ex), y, n1(5.8 * s), n1(6.5 * s), INK)
        + ell(n1(ex + 2.0 * s), n1(y - 2.3 * s), n1(2.1 * s), n1(1.9 * s), '#fff')
        + ell(n1(ex - 1.9 * s), n1(y + 2.4 * s), n1(1.2 * s), n1(1.1 * s), '#fff', ' opacity="0.9"');
    }).join(''),
    // 크고 또렷한 눈 — **까맣게 꽉 찬 세로 타원.** 흰자가 없다.
    // 아래쪽 속성 색 반달이 「젖은 눈」을 만든다 (빛 둘과 짝이다)
    round: (x, y, s, iris) => [-1, 1].map(f => {
      const ex = x + 11.5 * s * f;
      return ell(n1(ex), y, n1(6.6 * s), n1(7.6 * s), INK)
        + ell(n1(ex), n1(y + 3.4 * s), n1(4.2 * s), n1(3.2 * s), iris)
        + ell(n1(ex + 2.0 * s), n1(y - 2.8 * s), n1(2.2 * s), n1(2.0 * s), '#fff')
        + ell(n1(ex - 2.2 * s), n1(y + 2.8 * s), n1(1.3 * s), n1(1.2 * s), '#fff', ' opacity="0.9"');
    }).join(''),
    // 「시크」 — **바깥이 올라간 아몬드.** 고양이 눈이다.
    // ⚠️⚠️ **윗변을 «평평하고 낮게» 두면 뾰로통해진다** — 반쯤 감은 눈으로 읽히라고
    //    그렇게 그렸더니 서른 마리 중 여덟이 통째로 「시무룩」이 됐다 (그려 보고 고쳤다).
    //    갈리는 것은 「얼마나 감았나」가 아니라 **«바깥 끝이 올라갔나»**다
    sharp: (x, y, s, iris) => [-1, 1].map(f => {
      const ex = x + 11.5 * s * f, w = 5.9 * s;
      return `<path d="M${n1(ex - w * f)},${n1(y + 1.2 * s)}`
        + ` C${n1(ex - w * 0.78 * f)},${n1(y - 5.6 * s)} ${n1(ex + w * 0.63 * f)},${n1(y - 7.0 * s)} ${n1(ex + w * f)},${n1(y - 2.0 * s)}`
        + ` C${n1(ex + w * 1.08 * f)},${n1(y + 4.0 * s)} ${n1(ex - w * 0.56 * f)},${n1(y + 7.6 * s)} ${n1(ex - w * f)},${n1(y + 1.2 * s)} Z"`
        + ` fill="${INK}"/>`
        + ell(n1(ex), n1(y + 2.0 * s), n1(3.2 * s), n1(1.8 * s), iris)
        + ell(n1(ex + 1.0 * s), n1(y - 1.4 * s), n1(1.6 * s), n1(1.5 * s), '#fff')
        + ell(n1(ex - 1.6 * s), n1(y + 1.6 * s), n1(1.1 * s), n1(1.0 * s), '#fff', ' opacity="0.9"');
    }).join(''),
    // 감은 눈 — **웃는 눈(∪)이다.** 아래로 휜 호로 두었더니 「졸음」이 아니라
    // «시무룩»으로 읽혔다 — 감은 눈이 귀여운 것은 웃고 있을 때뿐이다
    sleepy: (x, y, s) => [-1, 1].map(f => {
      const ex = x + 11.5 * s * f;
      return `<path d="M${n1(ex - 6.4 * s)},${n1(y + 2.2 * s)} q${n1(6.4 * s)},${n1(-7.4 * s)} ${n1(12.8 * s)},0"`
        + ` stroke="${INK}" stroke-width="${n1(3.0 * s)}" fill="none" stroke-linecap="round"/>`;
    }).join(''),
  };

  // ─── 입 — 아주 작게 ───────────────────────────────────────────
  // ⚠️ 입을 키우면 눈이 작아 보인다. 「귀엽다」를 지는 것은 눈이고 입은 거드는 것뿐이다
  // ⚠️ **입에도 먹선을 «직접» 준다** — 입은 선 두른 그룹 «밖»이라(표면이다)
  //    물려받을 선이 없다. 부리를 칠만 해 두었더니 얼굴에서 떠 보였다
  const MOUTH = {
    beak: (x, y) => `<path d="M${x - 5.4},${y - 1} q5.4,-2.2 10.8,0 q-5.4,7.4 -10.8,0 Z"`
      + ` fill="${BEAK}" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>`,
    // 활짝 웃는 입 — **혀 한 점**이 있어야 「웃는다」가 된다 (레퍼런스의 그 입이다)
    wide: (x, y) => `<path d="M${x - 7},${y - 2.4} q7,7.6 14,0 q-7,2.6 -14,0 Z" fill="${INK}"/>`
      + `<path d="M${x - 2.6},${y + 1.6} q2.6,3.2 5.2,0 Z" fill="${tint(BLUSH, 10)}"/>`,
    w: (x, y) => `<path d="M${x - 5},${y - 1} q2.5,3.6 5,0 q2.5,3.6 5,0" stroke="${INK}"`
      + ' stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
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
  // ⚠️ **먹선이 한쪽으로 `OUT/2` 나가므로 숨도 그만큼 늘렸다** (3 → 4.5).
  //    안 늘리면 선이 상자 가장자리를 물어 `checkcreature` ①이 잡는다
  const TOP_PAD = 4.5;                    // 상자 꼭대기에 남기는 숨
  const HORN_UP = { none: 0, single: 31, pair: 17, antler: 32, crystal: 23 };
  // ⚠️ 귀를 키웠으면 **여기도 같이 올린다** — 안 올리면 귀끝이 소리 없이 잘린다
  //    (고양이 귀를 뾰족하게 세우며 0.24 → 0.55 가 됐다)
  const EAR_UP = { none: 0, round: 0.06, long: 0.80, tuft: 0.55, fin: 0 };   // 머리 ry 에 대한 비

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
    // 머리 — **그늘 한 겹을 밑에 깔던 꼼수를 걷었다.** 먹선이 그 몫을 더 잘 하고,
    // 남겨 두면 선 밑에 «때»처럼 비친다
    const head = skull(hx, hy, hrx, hry, COAT);
    // 얼굴 판 — 눈 둘레가 옅어야 눈이 더 커 보인다 (③)
    // ⚠️⚠️ **머리와 «같은 모양»을 안쪽으로 들여 그린다.** 타원 하나로 두었더니
    //    그 윗변이 머리를 가로로 썰어 **얼굴에 띠를 두른 것**처럼 보였다 —
    //    머리 둘레와 나란히 흐르는 선이라야 「털색이 옅은 얼굴」로 읽힌다
    const face = `<g opacity="0.6">`
      + skull(n1(hx), n1(hy + hry * 0.16), n1(hrx * 0.82), n1(hry * 0.76), BELLY) + '</g>';
    // 머리의 광택 — 왼쪽 위에 한 점. 레퍼런스의 그 «머리 빛»이고, 평면 칠에
    // «둥근 것»이라는 뜻을 준다. ⚠️ 눈에서 멀리(이마 위) 둬야 빛점과 안 섞인다
    const gloss = ell(n1(hx - hrx * 0.38), n1(hy - hry * 0.56), n1(hrx * 0.26), n1(hry * 0.14),
      '#fff', ' opacity="0.42" transform="rotate(-16 ' + n1(hx - hrx * 0.38) + ' ' + n1(hy - hry * 0.56) + ')"');
    const ey = hy + hry * 0.12;
    const es = Math.min(1.15, hrx / 25);            // 머리가 작으면 눈도 같이 줄인다
    const eye = (EYE[a.eye] || EYE.dot)(hx, ey, es, shade(raw, 34));
    // ⚠️ **입을 눈에서 충분히 떨어뜨린다.** 9.5 로 두었더니 머리가 작은 물고기에서
    //    입과 눈이 붙어 **먹색 덩어리 하나**가 됐다 (`checkcreature` 가 「눈동자 1개에
    //    빛 5점」으로 잡았다). 그림으로도 입이 눈에 닿으면 얼굴이 답답하다
    const mouth = MOUTH[MOUTH_OF[a.body] || 'w'](hx, ey + 11.5 * es);
    // 볼터치 (⑥) — 눈 바깥쪽, 입 높이. **더 크고 더 진하게** 했다
    const blush = [-1, 1].map(f =>
      ell(n1(hx + hrx * 0.72 * f), n1(ey + 6.8 * es), n1(5.4 * es), n1(3.4 * es), BLUSH, ' opacity="0.62"')).join('');

    const [px, py, ps] = PAT_AT[a.body] || PAT_AT.quad;
    const patInner = (PAT[a.pat] || PAT.none)(a.pat === 'glow' ? raw : shade(COAT, 24));
    const pat = patInner ? `<g transform="translate(${px},${py}) scale(${ps})">${patInner}</g>` : '';

    // 머리 위로 제일 높이 올라가는 것을 찾아 **그만큼 전체를 줄인다**(바닥이 축이다)
    const up = Math.max(HORN_UP[a.horn] || 0, (EAR_UP[a.ear] || 0) * hry);
    const top = hy - hry - up;
    const k = top < TOP_PAD ? (GROUND - TOP_PAD) / (GROUND - top) : 1;
    const fit = k < 1 ? ` transform="translate(50,${GROUND}) scale(${k.toFixed(3)}) translate(-50,${-GROUND})"` : '';

    // 그리는 순서가 곧 앞뒤다: 날개·꼬리(뒤) → 몸통 → 귀·뿔 → 머리 → 무늬 → 얼굴
    //
    // ⚠️⚠️ **먹선을 두르는 것은 «실루엣»뿐이다**(ⓐ) — 날개·꼬리·몸·귀·뿔·머리가
    //    한 그룹을 지나며 선을 «물려받는다». 조각마다 적으면 곧 열몇 벌이 되고,
    //    한 벌만 빠져도 그 조각만 선 없이 떠 보인다.
    //    무늬·얼굴 판·광택·눈·볼터치·입은 **표면**이라 그룹 «밖»이다 —
    //    선이 붙으면 얼굴이 통째로 지저분해진다 (그려 보고 갈랐다).
    // ⚠️ **무늬가 그룹 밖으로 나오면서 머리보다 «뒤»에서 «앞»이 됐다** — 무늬는
    //    배 언저리(`PAT_AT`)라 머리와 안 겹치므로 그림은 한 픽셀도 안 바뀐다
    const inked = `<g stroke="${LINE}" stroke-width="${OUT}" stroke-linejoin="round"`
      + ` stroke-linecap="round">${wing}${tail}${body}${ear}${horn}${head}</g>`;
    // ⚠️ **발밑 그림자는 줄이는 그룹 «밖»이다** — 안에 넣으면 뿔 달린 마리만 그림자가
    //    같이 작아져 바닥이 둘로 보인다
    return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${(c.name || '').replace(/"/g, '')}"
      ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''}>
      ${opts.flat ? '' : `<circle cx="50" cy="50" r="49" fill="${tint(raw, 86)}"/>`}
      ${opts.noShadow ? '' : ell(50, GROUND + 2, 26, 5, shade(raw, 10), ' opacity="0.16"')}
      <g${fit}>${inked}${pat}${face}${gloss}${eye}${blush}${mouth}</g>
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
