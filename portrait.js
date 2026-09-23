// 인물 초상화 — 대화 화면과 (나중에) 튜토리얼 다이얼로그가 함께 쓰는 부품.
//
// **한 사람씩 그리지 않는다.** 얼굴·머리·수염·눈·장식을 부품으로 두고
// **인물마다 조합만 다르게** 준다 (data.js 의 `SPEAKERS`). 아홉 명을 손으로 그리면
// 표정 하나 늘릴 때마다 아홉 번 고쳐야 하는데, 이렇게 두면 부품 한 곳만 고치면 된다.
// 커스터마이징 150벌을 축 표로 뽑은 것과 같은 생각이다 (CLAUDE.md 6번).
//
// **표정은 눈·입만 바꾼다.** 머리와 옷은 그대로다 — 그래야 같은 사람으로 보인다.
(function () {
  // SVG 의 id 는 문서 전체에서 공유된다. 한 화면에 초상화가 둘 이상 뜰 수 있으므로
  // (대화 상대 + 공주) 처음부터 일련번호를 붙인다. 마이 룸에서 한 번 크게 데었다.
  let uid = 0;
  const W = 120, H = 130;

  // ⚠️⚠️ **머리카락의 «바깥 호»는 손으로 그리지 않는다 — 두개골에서 «식으로» 뽑는다.**
  //
  //   오래 손으로 그려 두었다가 **머리통에서 떠 있었다.** 재 보면 이렇다 —
  //   얼굴 타원의 꼭대기는 y=36 인데 머리카락 꼭대기는 y=18~22 였고, 껍질 두께가
  //   **정수리 12~14px / 관자놀이 5~7px** 로 두 배 넘게 차이가 났다. 머리통 높이가
  //   60px 인데 그 위에 12~14px 이 얹히니 실루엣이 세로로만 20% 넘게 늘어나
  //   **「콘헤드」**로 보였다 (「머리카락이 붕 떠 있어서 길쭉해 보인다」로 신고받았다).
  //
  //   `avatar.js` 의 `BANG_FLAT` 이 이미 푼 문제다 — 「뒤통수와 «같은 중심·같은 rx» 에
  //   ry 만 늘린 타원의 호」. **같은 타원이면 y=cy 에서 폭도 접선도 정확히 맞아
  //   이음매가 «없다».** 여기서도 두개골(`SKULL`)에서 바로 뽑는다:
  //   `A` 호라 제어점을 짐작할 데가 없고, **얼굴을 고치면 머리가 저절로 따라온다.**
  //
  //   ⚠️ **스타일 차이를 «정수리를 들어 올려서» 내지 않는다.** 그러면 머리를 바꿀
  //      때마다 머리통 «높이»가 같이 변한다. 갈리는 것은 **헤어라인(앞머리 밑단) ·
  //      뒤로 흐르는 몫 · 뻗친 가닥** 이고, 그 셋은 `back`/`fringe` 가 맡는다.
  //   ⚠️ **`top`(정수리 몫)이 `side`(옆 몫)의 1.5배를 넘으면 안 된다.** 넘는 순간
  //      위로만 솟아 다시 콘헤드가 된다 — `tools/checkportrait.js` 의 「머리 껍질」이
  //      **그려진 그림에서** 재서 막는다 (표의 값이 아니라 실루엣을 본다).
  // ⚠️ **얼굴 타원도 여기서 나온다** — 값을 아래에 또 적으면 사본이 생겨,
  //    얼굴을 고쳤을 때 머리만 옛 자리에 남는다 (바로 그 병을 고치는 중이다)
  const SKULL = { cx: 60, cy: 66, rx: 26, ry: 30 };
  // 두개골에 `side`·`top` 만큼 두껍게 입힌 «같은 중심» 타원의 호를 `yBot` 에서 끊는다
  function crown(side, top, yBot) {
    const rx = SKULL.rx + side, ry = SKULL.ry + top;
    const k = Math.min(Math.abs(yBot - SKULL.cy) / ry, 1);
    const hx = +(rx * Math.sqrt(1 - k * k)).toFixed(2);
    const L = +(SKULL.cx - hx).toFixed(2), R = +(SKULL.cx + hx).toFixed(2);
    // 중심보다 «아래»에서 끊으면 위로 도는 호가 반 바퀴를 넘는다
    const big = yBot > SKULL.cy ? 1 : 0;
    return { L, R, rx, ry, top: +(SKULL.cy - ry).toFixed(2),
             d: `M${L},${yBot} A${rx},${ry} 0 ${big} 1 ${R},${yBot}` };
  }

  // ─── 머리 ─────────────────────────────────────────────────
  // back = 얼굴 뒤로 흐르는 덩어리 / front = 얼굴 위에 얹히는 앞머리
  //
  // ⚠️ **앞머리(front)의 안쪽 선이 곧 헤어라인이다.**
  // 눈이 y=66 이므로 헤어라인은 **얼굴 위끝과 눈 사이(≈50)** 에 와야 사람 얼굴로 읽힌다.
  // 관자놀이 쪽은 더 내려와야(≈56) 옆이 비지 않는다.
  // ⚠️ **헤어라인이 바깥 호보다 «위»로 올라가면 안 된다** — 그 자리가 호 밖이라
  //    옆구리에 혹이 붙는다. 새 스타일을 만들면 265px 에서 눈으로 한 번 본다.
  const HAIR_SPEC = {
    // 짧은 단발 — 헤어라인이 거의 평평하고 관자놀이만 내려온다
    short: { side: 4.7, top: 8.5, yBot: 58,
      back:   (L, R, d) => `${d} Z`,
      fringe: (L, R) => `C${R - 2},54 78,50 60,50 C42,50 ${L + 2},54 ${L},58 Z` },
    // 긴 머리 — 어깨로 흐른다. 앞머리는 옆으로 흐르는 가르마(한쪽이 더 길다)
    long: { side: 5.4, top: 9.6, yBot: 60,
      back:   (L, R, d) => `${d} L${R},112 L${R - 10},112 L${R - 8},60 L${L + 8},60 L${L + 10},112 L${L},112 Z`,
      fringe: (L, R) => `C${R - 2},55 80,48 68,50.5 C58,53 44,55.5 38,54 C34,53.5 ${L + 1},56 ${L},60 Z` },
    // 웨이브 — 귀 앞으로 한 가닥이 내려온다
    wave: { side: 5.6, top: 9.9, yBot: 58,
      back:   (L, R, d) => `${d} C${R + 2},74 ${R - 4},84 ${R - 2},104 C${R - 8},96 ${R - 10},88 ${R - 8},74` +
        ` C${R - 6},58 ${R - 10},46 60,46 C${L + 10},46 ${L + 6},58 ${L + 8},74` +
        ` C${L + 10},88 ${L + 8},96 ${L + 2},104 C${L},84 ${L - 6},74 ${L},58 Z`,
      fringe: (L, R) => `C${R - 2},53 80,47 71,49.5 C63,52.5 49,52.5 41,49.5 C36,48 ${L + 1},53 ${L},58 Z` },
    // 올림머리 — 매듭은 «머리통이 아니라 얹은 것»이라 호 위로 올라가도 된다
    updo: { side: 3.7, top: 6.2, yBot: 56,
      back:   (L, R, d) => `${d} Z`,
      bun:    '<circle cx="60" cy="27" r="11.5"/>',
      fringe: (L, R) => `C${R - 2},52 76,48 60,48 C44,48 ${L + 2},52 ${L},56 Z` },
    // 뻗친 머리 — 가닥은 «호 밖»으로 나가도 된다. 머리통은 그대로다
    wild: { side: 5.9, top: 10.2, yBot: 58,
      // ⚠️ 가닥이 «얼굴(x34~86)보다 바깥»으로 안 나가면 얼굴 뒤에 숨어 뻗친 머리가
      //    아니라 평범한 단발이 된다 — 호를 낮추자 실제로 그렇게 됐다. 그래서 가닥만
      //    `SPIKE` 만큼 더 벌린다 (머리통이 아니라 «가닥»이라 호 밖이어도 된다)
      back:   (L, R, d) => { const l = L - 5, r = R + 5; return `${d} L${r - 5},53 L${r - 1},72` +
        ` L${r - 10},59 L${r - 8},80 L${r - 17},61 L${r - 21},78 L${r - 28},59 L60,76` +
        ` L${l + 28},59 L${l + 21},78 L${l + 17},61 L${l + 8},80 L${l + 10},59 L${l + 1},72 L${l + 5},53 Z`; },
      fringe: (L, R) => `C${R - 2},53 82,50 72,49 C64,54 54,46.5 46,53 C40,56 ${L + 1},52 ${L},58 Z` },
  };

  const HAIR = Object.fromEntries(Object.entries(HAIR_SPEC).map(([k, sp]) => {
    const c0 = crown(sp.side, sp.top, sp.yBot);
    return [k, {
      back: c => (sp.bun ? sp.bun.replace('<circle', `<circle data-part="hair-bun" fill="${c}"`) : '') +
        `<path data-part="hair-back" d="${sp.back(c0.L, c0.R, c0.d)}" fill="${c}"/>`,
      front: c => `<path data-part="hair-front" d="${c0.d} ${sp.fringe(c0.L, c0.R)}" fill="${c}"/>`,
    }];
  }));
  HAIR.bald = { back: () => '', front: () => '' };

  // ⚠️⚠️ **`back` 은 «꽉 찬 돔»이어야 한다 — 안쪽을 파면 안 된다.**
  //   앞머리(front)는 헤어라인 위쪽만 칠하는 띠라, 그것만 두면 얼굴과 머리 사이로
  //   배경이 비친다 — 관자놀이에서 6px 짜리 틈이 나서 **머리와 얼굴이 떨어져 보였다**
  //   (오릭스·슈타르크·발렌·클레멘·이그리트가 그랬다).
  //   예전에는 그 자리를 `HAIR_FILL` 이라는 채움 한 겹으로 막았는데, 호를 두개골에서
  //   뽑으면서 `back` 이 다섯 다 꽉 찬 돔이 되어 **채움이 덮을 자리가 없어졌다** —
  //   인물×표정 307칸을 떼고 그려 견줘 **한 픽셀도 안 달라지는 것**을 확인하고 지웠다.
  //   («안 하는 일을 한다고 써 두면 다음 사람이 그것을 믿고 원인을 엉뚱한 데서 찾는다»)
  //   지키는 것은 이제 `tools/checkportrait.js` 의 **「머리와 얼굴 사이」**다.

  // ─── 눈 ───────────────────────────────────────────────────
  // 왼눈/오른눈이 같은 모양이라 x 만 바꿔 두 번 그린다
  const EYE = {
    normal: (x, c) => `<ellipse cx="${x}" cy="66" rx="4" ry="5.2" fill="${c}"/><circle cx="${x + 1.2}" cy="64.4" r="1.4" fill="#fff"/>`,
    smile:  (x)    => `<path d="M${x - 5},68 q5,-7 10,0" stroke="#3f3239" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sharp:  (x, c) => `<path d="M${x - 5.5},63 L${x + 5.5},66 L${x - 5.5},70 Z" fill="${c}"/>`,
    soft:   (x, c) => `<ellipse cx="${x}" cy="67" rx="4" ry="4" fill="${c}"/><path d="M${x - 5},61 q5,-3 10,1" stroke="#3f3239" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    closed: (x)    => `<path d="M${x - 5},66 q5,5 10,0" stroke="#3f3239" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    // ─ 여기부터는 나중에 늘린 것 ─
    // **눈 하나를 늘리면 표정이 입 수만큼 늘어난다** (지금 눈 11 × 입 12).
    // 그래서 부품을 늘리는 것이 표정을 하나씩 그리는 것보다 언제나 싸다.
    wide:   (x, c) => `<ellipse cx="${x}" cy="66" rx="4.6" ry="6.4" fill="#fff" stroke="${c}" stroke-width="1"/>`
                    + `<circle cx="${x}" cy="66" r="2.9" fill="${c}"/><circle cx="${x + 1.1}" cy="64.2" r="1.2" fill="#fff"/>`,
    // 눈물 — 아래로 한 방울. 「슬픔」은 눈만으로 읽혀야 입을 바꿔도 안 흐려진다
    teary:  (x, c) => `<ellipse cx="${x}" cy="67" rx="4" ry="4.8" fill="${c}"/><circle cx="${x + 1.2}" cy="65.4" r="1.5" fill="#fff"/>`
                    + `<path d="M${x + 3.6},71 q2.2,4 0,6 q-2.2,-2 0,-6 Z" fill="#8fc5e8"/>`,
    // 반쯤 감은 눈 — 졸림·심드렁
    half:   (x, c) => `<path d="M${x - 5},64 L${x + 5},64" stroke="#3f3239" stroke-width="2.2" stroke-linecap="round"/>`
                    + `<path d="M${x - 4},64 a4,4.6 0 0 0 8,0 Z" fill="${c}"/>`,
    // 위를 본다 — 생각·딴청
    up:     (x, c) => `<ellipse cx="${x}" cy="66" rx="4" ry="5.2" fill="#fff" stroke="${c}" stroke-width="0.9"/>`
                    + `<circle cx="${x}" cy="63.6" r="2.6" fill="${c}"/>`,
    // 하트 눈 — 반함
    heart:  (x)    => `<path d="M${x},70 C${x - 6},64 ${x - 5},58 ${x - 2},58 q2,0 2,2.4 q0,-2.4 2,-2.4 c3,0 4,6 -2,12 Z" fill="#e2557f"/>`,
    // × 눈 — 기절·질색
    cross:  (x)    => `<path d="M${x - 4.4},62 L${x + 4.4},70 M${x + 4.4},62 L${x - 4.4},70"`
                    + ` stroke="#3f3239" stroke-width="2.6" stroke-linecap="round"/>`,
    // 곁눈질 — 미심쩍음
    side:   (x, c) => `<ellipse cx="${x}" cy="66" rx="4.2" ry="4.6" fill="#fff" stroke="${c}" stroke-width="0.9"/>`
                    + `<circle cx="${x + 2}" cy="66" r="2.5" fill="${c}"/>`,
    // 반짝 — 기대·감동
    star:   (x, c) => `<ellipse cx="${x}" cy="66" rx="4.4" ry="5.4" fill="${c}"/>`
                    + `<circle cx="${x + 1.3}" cy="64" r="1.8" fill="#fff"/><circle cx="${x - 1.6}" cy="68.4" r="1" fill="#fff"/>`,
    // 가늘게 뜬 눈 — 흘김·의심. `half` 와 달리 «위아래»가 다 좁아 노려보는 느낌이 난다
    squint: (x, c) => `<path d="M${x - 5},64.6 q5,-1.6 10,0 q-5,4 -10,0 Z" fill="${c}"/>`
                    + `<path d="M${x - 5},64.6 q5,-1.6 10,0" stroke="#3f3239" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    // 빙글빙글 — 어질어질. `cross`(기절)와 달리 아직 서 있는 얼굴이다
    dizzy:  (x)    => `<path d="M${x},66 m-4.4,0 a4.4,4.4 0 1 1 3,4.2 a3,3 0 1 1 1.6,-5.6"`
                    + ` stroke="#3f3239" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    // 내리깐 눈 — 서운함·부끄러움. 눈동자가 아래에 있어 시선을 피하는 것이 읽힌다
    low:    (x, c) => `<ellipse cx="${x}" cy="66" rx="4.2" ry="5" fill="#fff" stroke="${c}" stroke-width="0.9"/>`
                    + `<circle cx="${x}" cy="68.4" r="2.5" fill="${c}"/>`,
    // 치켜뜬 눈 — 흰자가 아래로 보인다. 「노려봄」이 `sharp` 보다 차갑다
    glare:  (x, c) => `<ellipse cx="${x}" cy="66" rx="4.4" ry="5.4" fill="#fff" stroke="${c}" stroke-width="0.9"/>`
                    + `<circle cx="${x}" cy="63.8" r="2.6" fill="${c}"/>`
                    + `<path d="M${x - 5},61.4 L${x + 5},61.4" stroke="#3f3239" stroke-width="2.2" stroke-linecap="round"/>`,
  };

  // ─── 눈썹 ─────────────────────────────────────────────────
  // **눈만으로는 화남과 슬픔이 잘 안 갈린다.** 눈썹 각도가 그 둘을 가른다 —
  // 부품 하나로 표정 전체의 폭이 눈에 띄게 넓어진다.
  // `null` 이면 안 그린다 (기본 표정은 눈썹 없이도 읽힌다)
  const BROW = {
    none:  () => '',
    up:    (x, f) => `<path d="M${x - 5.5},${57 - f * 1.5} q5.5,-3 11,${f * 2}" stroke="#3f3239" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    angry: (x, f) => `<path d="M${x - 5.5},${54 + f * 3} L${x + 5.5},${59 - f * 1}" stroke="#3f3239" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    sad:   (x, f) => `<path d="M${x - 5.5},${59 - f * 1} L${x + 5.5},${54 + f * 3}" stroke="#3f3239" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    flat:  (x)    => `<path d="M${x - 5.5},57 L${x + 5.5},57" stroke="#3f3239" stroke-width="2.2" stroke-linecap="round"/>`,
    // 안쪽만 바짝 올린 팔(八) 자 — 곤란함·미안함. `sad` 보다 각이 크다
    beg:   (x, f) => `<path d="M${x - 5.5},${61 - f * 2} q5.5,-4 11,${f * 5}" stroke="#3f3239" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    // 바깥이 처진 — 지침·체념
    droop: (x, f) => `<path d="M${x - 5.5},${55 + f * 2} q5.5,2 11,${-f * 1}" stroke="#3f3239" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  };

  const MOUTH = {
    smile: '<path d="M52,84 q8,7 16,0" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    grin:  '<path d="M50,82 q10,11 20,0 z" fill="#a4636c"/><path d="M52,83 q8,3 16,0" fill="#fff"/>',
    calm:  '<path d="M54,84 q6,2 12,0" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    flat:  '<path d="M53,85 L67,85" stroke="#a4636c" stroke-width="2.4" stroke-linecap="round"/>',
    smirk: '<path d="M52,85 q9,4 16,-4" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    // ─ 여기부터는 나중에 늘린 것 ─
    frown: '<path d="M52,88 q8,-7 16,0" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    open:  '<ellipse cx="60" cy="86" rx="6" ry="7.5" fill="#a4636c"/><ellipse cx="60" cy="88.5" rx="3.4" ry="3.6" fill="#d98f96"/>',
    small: '<ellipse cx="60" cy="85" rx="3.2" ry="3.6" fill="#a4636c"/>',
    // 이를 앙다문 — 참는 얼굴
    grit:  '<rect x="51" y="82" width="18" height="7" rx="2.4" fill="#a4636c"/><rect x="52" y="83" width="16" height="5" rx="1.8" fill="#fff"/>'
         + '<path d="M56,83 L56,88 M60,83 L60,88 M64,83 L64,88" stroke="#e3cdd0" stroke-width="0.9"/>',
    // 물결 — 울먹임
    wavy:  '<path d="M51,85 q3,-3.5 6,0 q3,3.5 6,0 q3,-3.5 6,0" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    // 살짝 벌린 — 놀람(작게)
    ohh:   '<ellipse cx="60" cy="86" rx="4.2" ry="5.4" fill="#a4636c"/>',
    // 메롱 — 혀를 내민다 (장난)
    tongue: '<path d="M52,84 q8,6 16,0" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
          + '<path d="M56,86 q4,7 8,0 z" fill="#e2557f"/>',
    // 삐죽 — 서운함·토라짐. 한쪽만 내린 입이라 좌우 대칭이 아니다
    pout:  '<path d="M52,86 q7,-2 15,3" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    // 아랫입술을 살짝 깨문다 — 참음·부끄러움.
    // ⚠️ **흰 이를 넣으면 `grit` 과 구별이 안 된다** (실제로 나란히 놓고 보니 같아 보였다).
    // 윗입술 선 하나에 아랫입술만 안으로 말려 들어간 모양으로 그린다
    bite:  '<path d="M53,84.5 q7,2.5 14,0" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
         + '<path d="M56.5,86 q3.5,2.6 7,0" stroke="#c9808a" stroke-width="2" fill="none" stroke-linecap="round"/>',
    // 크게 벌린 웃음 — `grin` 보다 한 단계 더 (박장대소)
    haha:  '<path d="M48,81 q12,15 24,0 z" fill="#a4636c"/><path d="M51,82 q9,3 18,0" fill="#fff"/>'
         + '<ellipse cx="60" cy="89" rx="4" ry="2.6" fill="#d98f96"/>',
    // 한쪽만 올린 — 시큰둥
    meh:   '<path d="M52,86 q8,1 16,-3" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  };

  const BEARD = {
    none: () => '',
    stub: c => `<path data-part="beard" d="M36,74 C38,92 48,100 60,100 C72,100 82,92 84,74 C82,88 72,94 60,94 C48,94 38,88 36,74 Z" fill="${c}" opacity="0.32"/>`,
    full: c => `<path data-part="beard" d="M34,70 C34,96 46,108 60,108 C74,108 86,96 86,70 C84,86 76,88 68,86 L68,80 L52,80 L52,86 C44,88 36,86 34,70 Z" fill="${c}"/>`,
  };

  // ─── 장식 ─────────────────────────────────────────────────
  const DECO = {
    none:    () => '',
    crown:   c => `<path d="M40,22 L46,10 L52,20 L60,6 L68,20 L74,10 L80,22 Z" fill="${c}"/>
                   <rect x="40" y="22" width="40" height="6" rx="2" fill="${c}"/>`,
    // 서클렛은 **헤어라인 바로 위**에 앉는다. 정수리 쪽에 두면 모자챙처럼 보인다 —
    // 헤어라인을 내리면서 실제로 그렇게 됐다 (발렌이 노란 헬멧을 쓴 것처럼 보였다)
    circlet: c => `<path d="M34,50 Q60,40 86,50" stroke="${c}" stroke-width="3.4" fill="none"/>
                   <circle cx="60" cy="43" r="4.6" fill="${c}"/>`,
    // ⚠️ 후드의 «안쪽 구멍»도 두개골에서 뽑는다. 손으로 그려 두었더니 구멍이 y24 인데
    //    머리는 y33 이라 **머리와 후드 사이가 벌어져** 아치 안에 머리가 빠져 있었다.
    //    ⚠️ **«그 사람이 쓴 머리»에서 뽑는다** — 숫자를 박아 두면 머리를 두껍게 고치는
    //       순간 후드가 머리 «안»으로 들어가고, 얇게 고치면 그만큼 벌어진다.
    //       제일 두꺼운 머리를 기준으로 삼아도 «얇은 머리를 쓴 사람»에게서 벌어진다
    //       (슈타르크가 short 인데 wild 를 기준으로 뽑았더니 3px 이 비쳤다)
    hood:    (c, hair) => {
      const h = HAIR_SPEC[hair] || { side: 3, top: 6 };
      const i = crown(h.side + 1, h.top + 1, 66), o = crown(h.side + 9, h.top + 9, 66);
      return `<path data-part="deco-hood" d="${o.d} L${i.R},66 A${i.rx},${i.ry} 0 1 0 ${i.L},66 Z"
        fill="${c}"/>`; },
    scarf:   c => `<path d="M32,104 Q60,116 88,104 L88,116 Q60,126 32,116 Z" fill="${c}"/>`,
    apron:   c => `<path d="M44,106 L76,106 L80,130 L40,130 Z" fill="${c}"/>
                   <path d="M50,106 q10,8 20,0" stroke="#fff" stroke-width="2" fill="none" opacity="0.7"/>`,
    leaf:    c => `<path d="M78,30 q14,-10 16,4 q-12,8 -16,-4 Z" fill="${c}"/>
                   <path d="M30,34 q-13,-8 -15,5 q11,7 15,-5 Z" fill="${c}"/>`,
    mirror:  c => `<rect x="6" y="8" width="108" height="118" rx="20" fill="none" stroke="${c}" stroke-width="5"/>
                   <path d="M20,20 q10,-8 22,-6" stroke="#fff" stroke-width="3" fill="none" opacity="0.6"/>`,
  };

  // 인물 한 명을 그린다.
  //   sp   : data.js 의 SPEAKERS 한 칸
  //   mood : 표정 이름 (sp.moods 에 있는 것). 없으면 기본
  //   opts.bare : **배경 판 없이 인물만.** 방 안에 서 있는 것처럼 보여야 하는 자리에 쓴다.
  //     배경을 깔면 초상화가 방에 붙인 카드처럼 보인다 — 대화 화면이 그 경우다.
  //     (인물 목록처럼 딱지로 보여 줄 자리가 생기면 그때 bare 없이 쓴다)
  function bust(sp, mood, opts) {
    if (!sp) return '';
    const bare = !!(opts && opts.bare);
    const u = 'p' + (++uid);
    const m = (sp.moods && sp.moods[mood]) || (sp.moods && sp.moods.def) || { eye: 'normal', mouth: 'calm' };
    // **인트로에 이미 얼굴이 있는 사람은 그 그림을 그대로 쓴다.**
    // 부품을 조합해 다시 그리면 방금까지 보던 사람과 다른 사람이 된다 —
    // 요정 대모가 실제로 그랬다 (머리 모양이 아예 다르고 정수리가 떨어져 보였다).
    // intro.js 가 없으면(스크립트 누락) 아래의 부품 조합으로 그냥 떨어진다.
    if (sp.introArt && window.Intro && Intro.bustArt) {
      const art = Intro.bustArt(sp.introArt, m.art, W, H);
      if (art) {
        return `<svg class="pt-svg ${bare ? 'bare' : ''}" viewBox="0 0 ${W} ${H}"
          xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name || ''}">
          ${bare ? '' : `<defs><clipPath id="ptc_${u}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath></defs>`}
          <g ${bare ? '' : `clip-path="url(#ptc_${u})"`}>
            ${bare ? '' : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sp.bg || '#efe6f2'}"/>`}
            ${art}
          </g>
        </svg>`;
      }
    }
    const hair = HAIR[sp.hair] || HAIR.short;
    // ─── 두 눈이 달라도 된다 ────────────────────────────────────
    //
    // `eye` 하나로 양쪽을 그리면 **진짜 윙크를 만들 수가 없다** — 지금 「윙크」는
    // 두 눈을 다 감고 입만 씩 웃는 얼굴이다. `eyeL`·`eyeR` 을 적으면 그쪽만 갈아 끼운다
    // (안 적으면 예전 그대로 `eye` 하나로 양쪽을 그린다 — 기존 표정은 한 톨도 안 변한다).
    // ⚠️ **왼쪽/오른쪽은 «보는 사람» 기준이다** (x=50 이 왼쪽).
    const eyeL = EYE[m.eyeL || m.eye] || EYE.normal;
    const eyeR = EYE[m.eyeR || m.eye] || EYE.normal;
    // 눈썹은 **없는 것이 기본**이다 — 기본 표정은 눈썹 없이도 읽히고,
    // 있는 쪽이 예외라야 얼굴이 안 시끄럽다. 안쪽 끝을 내리거나 올려 각도를 만든다
    // 눈썹도 좌우를 나눌 수 있다 (눈과 같은 규칙) — 「한쪽만 치켜올림」이 이걸로 난다
    const browL = BROW[m.browL || m.brow] || null;
    const browR = BROW[m.browR || m.brow] || null;
    return `<svg class="pt-svg ${bare ? 'bare' : ''}" viewBox="0 0 ${W} ${H}"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name || ''}">
      ${bare ? '' : `<defs><clipPath id="ptc_${u}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath></defs>`}
      <g ${bare ? '' : `clip-path="url(#ptc_${u})"`}>
        ${bare ? '' : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sp.bg || '#efe6f2'}"/>`}
        ${sp.deco === 'hood' ? DECO.hood(sp.decoColor || sp.cloth, sp.hair) : ''}
        ${hair.back(sp.hairColor)}
        <path d="M34,110 C34,96 46,90 60,90 C74,90 86,96 86,110 L92,130 L28,130 Z" fill="${sp.cloth}"/>
        <path d="M52,88 L68,88 L68,98 C64,102 56,102 52,98 Z" fill="${sp.skin}"/>
        <ellipse data-part="face" cx="${SKULL.cx}" cy="${SKULL.cy}" rx="${SKULL.rx}" ry="${SKULL.ry}"
          fill="${sp.skin}"/>
        ${BEARD[sp.beard || 'none'](sp.hairColor)}
        ${hair.front ? hair.front(sp.hairColor) : ''}
        ${browL ? browL(50, 1) : ''}${browR ? browR(70, -1) : ''}
        ${eyeL(50, sp.eyeColor || '#3f3239')}${eyeR(70, sp.eyeColor || '#3f3239')}
        ${MOUTH[m.mouth] || MOUTH.calm}
        ${sp.deco && sp.deco !== 'hood' ? DECO[sp.deco](sp.decoColor || '#ffd76a') : ''}
      </g>
    </svg>`;
  }

  // 검사기가 «표에 있는 머리를 다» 재려면 이름 목록이 필요하다 — 손으로 적으면
  // 새 스타일이 조용히 안 재진다 (`checkglobals` 가 파일 목록에서 겪은 일이다)
  window.Portrait = { bust, W, H, hairs: Object.keys(HAIR), SKULL };
})();
