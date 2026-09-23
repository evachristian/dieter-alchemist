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

  // ─── 색 보조 ───────────────────────────────────────────────
  function mix(hex, to, k) {
    const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const b = [1, 3, 5].map(i => parseInt(to.slice(i, i + 2), 16));
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  const dark = (c, k) => mix(c, '#2b1d22', k);
  const lite = (c, k) => mix(c, '#ffffff', k);

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
  // 얼굴 윤곽(`FACE`)의 «머리통 부분»과 같은 타원이다 — 눈(y66)·입(y≈84)의 자리는
  // 그대로 두고 두개골만 갈았다 (표정 열여덟 × 열아홉이 그 좌표에 붙어 있다)
  const SKULL = { cx: 60, cy: 61, rx: 25, ry: 27 };
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
  // ⚠️ **옆머리(구레나룻)가 귀 앞까지 내려와야 한다** — 앞머리만 있으면 귀 «위»에
  //    살색 띠가 남아 머리가 «모자»로 읽힌다. ⚠️ 굵게 그으면 눈 옆의 «검은 막대»가
  //    된다(반폭 2 로 그렸다가 그랬다) · ⚠️ **머리 «밑»에서 시작해야 한다**(y44) —
  //    y55 에서 시작했더니 앞머리 밑단보다 아래라 얼굴에 «떠 있는 막대»가 됐다
  const SIDE = (c, len) => `<path d="M36.4,44 C35.8,58 36.4,${len - 3} 38.3,${len}
        C39.3,${len - 5} 39.8,58 40.4,44 Z" fill="${c}"/>
      <path d="M83.6,44 C84.2,58 83.6,${len - 3} 81.7,${len}
        C80.7,${len - 5} 80.2,58 79.6,44 Z" fill="${c}"/>`;

  // ⚠️⚠️ **「바가지 머리」의 정체는 «돔 + 평평한 밑단»이다.** 옛 앞머리의 밑단은
  //   좌우 대칭의 «접시»라 어떤 색을 칠해도 헬멧이 됐다. 버리는 열쇠가 셋이다 —
  //   ① 가르마(좌우 비대칭) ② 관자놀이가 파인 헤어라인 ③ 끝이 «흐르는» 방향.
  //   ⚠️ **윤기(shine)를 정수리에 넓게 깔면 «탈모»로 읽힌다** — 머리 띠가 얇아진
  //      뒤에 특히 그렇다 (그렇게 그려 놓고 찍어 보고 알았다). 옆에 가늘게 눕힌다
  const HAIR_SPEC = {
    // 가르마 + 옆으로 쓸어 넘긴 앞머리 (기본 남자 머리)
    short: { side: 4.7, top: 8.5, yBot: 64, sideburn: 72,
      back:   (L, R, d) => `${d} Z`,
      fringe: (L, R) => `C${R - 1},53 82,48 77,45 C71,52.5 58,57 46,56 C41,56 36,58.5 35,65 C34,61 ${L + 1},59.5 ${L},64 Z`,
      shine: 'M70,33 C76,35.5 80.5,39.5 82.8,45 C80,40.5 75.5,37.5 70,36.2 Z' },
    // 짧게 친 머리 (단단한 인상) — 이마 가운데가 «봉우리»로 솟고 관자놀이가 파인다
    crop: { side: 4.7, top: 7.6, yBot: 64, sideburn: 70,
      back:   (L, R, d) => `${d} Z`,
      fringe: (L, R) => `C${R},57 83,53 78,50 C72,48.5 66,53.5 60,53 C54,53.5 48,48.5 42,50 C37,53 ${L},57 ${L},64 Z`,
      shine: 'M69,33 C75,34.5 79,38.5 81.3,44.5 C78.6,40 74.5,37 69,36 Z' },
    // 뒤로 넘긴 머리 — 이마를 «다» 드러낸다 (세련된 인상)
    slick: { side: 5.3, top: 8.8, yBot: 63, sideburn: 71,
      back:   (L, R, d) => `${d} Z`,
      fringe: (L, R) => `C${R},55 84,50 77,46.5 C68,44 56,45 47,49 C41,51.5 36,56 ${L},63 Z`,
      shine: 'M68,32 C74.5,33.5 79.5,37.5 82.5,43.5 C79,38.5 74,35.5 68,34.7 Z' },
    // 긴 머리 — 어깨로 흐른다
    long: { side: 5.4, top: 9.6, yBot: 64,
      // ⚠️ 가닥의 끝을 상자 «밑»(130)까지 내린다 — 어깨 위에서 끊으면 허공에 뜬다
      back:   (L, R, d) => `${d} C${R + 2},80 ${R - 2},96 ${R},130 L${R - 11},130` +
        ` C${R - 8},96 ${R - 5},80 ${R - 6},64 C${R - 7},48 74,43 60,43 C46,43 ${L + 6},48 ${L + 5},64` +
        ` C${L + 4},80 ${L + 7},96 ${L + 10},130 L${L},130 C${L + 2},96 ${L - 2},80 ${L},64 Z`,
      fringe: (L, R) => `C${R - 1},53 81,47 75,44 C69,51.5 54,56 44,54.5 C39,54 34,57.5 33,64.5 C32,61 ${L + 1},59.5 ${L},64 Z`,
      shine: 'M71,33.5 C77,36 81.5,40.5 84,46.5 C81,41.5 76.5,38.5 71,37 Z' },
    // 웨이브 — 부드러운 인상. 귀 앞으로 한 가닥이 내려온다
    wave: { side: 5.6, top: 9.9, yBot: 64,
      back:   (L, R, d) => `${d} C${R + 2},78 ${R - 3},92 ${R - 1},114 C${R - 7},104 ${R - 9},92 ${R - 7},76` +
        ` C${L + 27},58 79,47 60,47 C41,47 ${L + 5},58 ${L + 7},76` +
        ` C${L + 9},92 ${L + 7},104 ${L + 1},114 C${L + 3},92 ${L - 2},78 ${L},64 Z`,
      fringe: (L, R) => `C${R - 1},53 81,48 75,46 C71,52 63,56 55,55 C48,54 42,52 38,55 C35,57 ${L + 1},59.5 ${L},64 Z`,
      shine: 'M70,34.5 C76,37 80.5,41 83.3,47 C80.3,42 76,39 70,37.8 Z' },
    // 올림머리 — 매듭은 «머리통이 아니라 얹은 것»이라 호 위로 올라가도 된다
    updo: { side: 3.7, top: 6.2, yBot: 58,
      back:   (L, R, d) => `${d} Z`,
      bun:    '<circle cx="60" cy="23" r="11.5"/>',
      fringe: (L, R) => `C${R - 2},54 76,50 60,50 C44,50 ${L + 2},54 ${L},58 Z` },
    // 뻗친 머리 — 가닥은 «호 밖»으로 나가도 된다. 머리통은 그대로다
    wild: { side: 5.9, top: 10.2, yBot: 60,
      // ⚠️ 가닥이 «얼굴(x35~85)보다 바깥»으로 안 나가면 얼굴 뒤에 숨어 뻗친 머리가
      //    아니라 평범한 단발이 된다 — 호를 낮추자 실제로 그렇게 됐다
      back:   (L, R, d) => { const l = L - 5, r = R + 5; return `${d} L${r - 5},53 L${r - 1},72` +
        ` L${r - 10},59 L${r - 8},80 L${r - 17},61 L${r - 21},78 L${r - 28},59 L60,76` +
        ` L${l + 28},59 L${l + 21},78 L${l + 17},61 L${l + 8},80 L${l + 10},59 L${l + 1},72 L${l + 5},53 Z`; },
      fringe: (L, R) => `C${R - 2},55 82,52 72,51 C64,56 54,48.5 46,55 C40,58 ${L + 1},54 ${L},60 Z` },
  };

  // ⚠️⚠️ **`back` 은 «꽉 찬 돔»이어야 한다 — 안쪽을 파면 안 된다.** 앞머리는 헤어라인
  //   위만 칠하는 띠라, 그것만 두면 관자놀이에서 얼굴과 머리 사이로 배경이 비친다.
  //   시안에서 띠째로 옮겨 왔다가 short·crop·slick 에서 3.8~4.5px 이 비쳤다
  //   (`checkportrait` 의 「머리와 얼굴 사이」가 잡았다)
  const HAIR = Object.fromEntries(Object.entries(HAIR_SPEC).map(([k, sp]) => {
    const c0 = crown(sp.side, sp.top, sp.yBot);
    return [k, {
      back: c => (sp.bun ? sp.bun.replace('<circle', `<circle data-part="hair-bun" fill="${c}"`) : '') +
        `<path data-part="hair-back" d="${sp.back(c0.L, c0.R, c0.d)}" fill="${c}"/>`,
      front: c => (sp.sideburn ? SIDE(c, sp.sideburn) : '') +
        `<path data-part="hair-front" d="${c0.d} ${sp.fringe(c0.L, c0.R)}" fill="${c}"/>` +
        (sp.shine ? `<path d="${sp.shine}" fill="${lite(c, 0.09)}"/>` : ''),
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

  // ─── 얼굴 ─────────────────────────────────────────────────
  // ⚠️⚠️ **타원은 «도토리»다.** 세로/가로 1.15 짜리 타원은 어느 각도로 봐도 사람 얼굴이
  //   아니다 — 남자 NPC 여섯이 「도토리 같다」고 신고받은 자리가 여기다.
  //   지금은 **광대에서 턱으로 좁아지는** 윤곽이다 (광대 반폭 25 · 턱 반폭 11 · 1.29).
  //   ⚠️ **눈(y66 · x50/70)과 입(y≈84)의 자리는 «그대로»다** — 표정 열여덟 × 열아홉이
  //      그 좌표에 붙어 있어서, 옮기면 표정을 전부 다시 그려야 한다
  const FACE = c => `<path data-part="face" d="M60,34
      C75,34 85,44.5 85,61 C85,70 84,76.5 81.5,82
      C78,89.5 70,95.5 60,95.5 C50,95.5 42,89.5 38.5,82
      C36,76.5 35,70 35,61 C35,44.5 45,34 60,34 Z" fill="${c}"/>`;

  // 광대·턱의 면 — 음영 한 겹이 뼈대를 읽히게 한다 (`ART_POLICY.md` 3장)
  // ⚠️ **가로로 띠를 깔면 안 된다** — 얼굴을 가로지르는 음영은 어느 색이든 «수염»으로
  //    읽힌다 (그렇게 그렸다가 수염 없는 넷까지 텁수룩해졌다). 옆면만 얇게 문지른다
  const CHEEK = c => `<path d="M38.5,72 C39.5,80 42,87 47,92 C42,88 38,81 37.5,72 Z"
        fill="${dark(c, 0.16)}" opacity="0.34"/>
      <path d="M81.5,72 C80.5,80 78,87 73,92 C78,88 82,81 82.5,72 Z"
        fill="${dark(c, 0.16)}" opacity="0.34"/>`;

  // 코 — **이것 하나로 아기 얼굴이 어른 얼굴이 된다.**
  // ⚠️ **콧대를 긋지 않는다** — 만화에서 선 하나는 «흉터»로 보인다 (4px 넘게 그었다가
  //    그렇게 보였다). 보이는 것은 콧방울 그늘 한 조각뿐이고 길이는 눈~입의 3분의 1 이다
  const NOSE = c => `<path d="M59,71.5 q0.6,3.2 3.6,3.6" stroke="${dark(c, 0.26)}"
      stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`;

  // 기본 눈썹 — 남자는 **굵고 · 낮고 · 눈에 가깝다.** 표정이 제 눈썹을 갖고 있으면
  // 그쪽이 이긴다 (아래 `BROW`). 눈썹이 아예 없으면 얼굴이 «아기»로 읽힌다
  // ⚠️ **굵게 + 크게 휘면 «애벌레»가 된다** (3.4 굵기에 아치를 줬더니 그랬다).
  //    남자 눈썹은 «거의 직선»이고 안쪽이 살짝 낮다 — 휨은 1px 안쪽이다
  // ⚠️⚠️ **굵기는 인물이 정한다** (`SPEAKERS` 의 `brows`). 굵은 직선 눈썹을 여덟에게
  //    다 붙였더니 **여왕이 남자로 읽혔다** — 눈썹 하나가 얼굴의 «성별»을 뒤집는다.
  //    `soft` 는 가늘고 살짝 아치다. 기본은 `bold` (남자 일곱)
  const BROW_W = { bold: 2.7, soft: 1.9 };
  const BROW_BASE = (x, f, c, k) => k === 'soft'
    ? `<path d="M${x - 5.6},${59.6 - f * 0.6} q5.6,-3.2 11.2,${f * 1.2 + 1.4}"
        stroke="${c}" stroke-width="${BROW_W.soft}" fill="none" stroke-linecap="round"/>`
    : `<path d="M${x - 6},${59.8 - f * 0.8} q6,-1.9 12,${f * 1.4 + 0.6}"
        stroke="${c}" stroke-width="${BROW_W.bold}" fill="none" stroke-linecap="round"/>`;

  // 귀 — **머리 옆이 비면 «덩어리»로 보인다**
  const EAR = c => `<ellipse cx="36" cy="70" rx="3.4" ry="5" fill="${c}"/>
      <ellipse cx="84" cy="70" rx="3.4" ry="5" fill="${c}"/>
      <path d="M35.6,68 q1.8,1.8 0.4,4" stroke="${dark(c, 0.2)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M84.4,68 q-1.8,1.8 -0.4,4" stroke="${dark(c, 0.2)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;

  // 목 — **굵어야 머리가 «얹힌 것»으로 안 보인다.** 턱 밑 그늘이 한 겹 얹힌다
  const NECK = c => `<path d="M51,86 L69,86 L69,99 C65,104 55,104 51,99 Z" fill="${c}"/>
      <path d="M51,86 L69,86 L69,90.5 C65,94 55,94 51,90.5 Z" fill="${dark(c, 0.16)}"/>`;

  // 어깨 — **좁으면 머리만 큰 아이가 된다**
  // ⚠️ **어깨가 좁으면 «긴 머리의 가닥»이 허공에서 끊긴다** — 가닥은 어깨 위에
  //    얹혀야 하는데 판이 좁아 그 자리가 배경이었다 (카이로스·유타르크가 그랬다)
  const BODY = c => `<path d="M24,130 C24,109 38,99 60,99 C82,99 96,109 96,130 Z" fill="${c}"/>
      <path d="M52,99 C54,105 66,105 68,99 C66,103 54,103 52,99 Z" fill="${dark(c, 0.22)}"/>`;

  // ─── 눈 ───────────────────────────────────────────────────
  // 왼눈/오른눈이 같은 모양이라 x 만 바꿔 두 번 그린다
  const EYE = {
    // ⚠️⚠️ **`sharp` 는 «삼각형»이었다.** 슈타르크·발렌이 그걸 쓰는데 삼각형은 사람
    //   눈이 아니라 «화살표»로 읽혀서 둘이 제일 안 잘생겨 보였다. 넷 다 **아몬드**
    //   (위 눈꺼풀이 두껍고 아래가 얇은 렌즈)로 다시 그렸다 — **열쇠는 그대로**라
    //   표정 표(`BASE_MOODS`)도 데이터도 한 글자 안 바뀐다
    normal: (x, c) => `<path d="M${x - 5.6},66.4 q5.6,-5.2 11.2,0 q-5.6,4.4 -11.2,0 Z" fill="#fff"/>`
                    + `<circle cx="${x}" cy="66.2" r="3" fill="${c}"/><circle cx="${x + 1.2}" cy="64.9" r="1.1" fill="#fff"/>`
                    + `<path d="M${x - 5.8},66 q5.8,-5.6 11.6,0" stroke="#3f3239" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    smile:  (x)    => `<path d="M${x - 5.4},68 q5.4,-6.4 10.8,0" stroke="#3f3239" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    // 차가운 눈 — 위 눈꺼풀이 더 내려온다
    sharp:  (x, c) => `<path d="M${x - 5.6},66.8 q5.6,-4.4 11.2,0 q-5.6,3.6 -11.2,0 Z" fill="#fff"/>`
                    + `<circle cx="${x}" cy="66.6" r="2.7" fill="${c}"/>`
                    + `<path d="M${x - 5.8},66.4 q5.8,-4.8 11.6,0" stroke="#3f3239" stroke-width="2.3" fill="none" stroke-linecap="round"/>`,
    // 부드러운 눈 — 홍채가 크고 눈꺼풀 선이 얇다
    soft:   (x, c) => `<path d="M${x - 5.4},66.6 q5.4,-5 10.8,0 q-5.4,4.6 -10.8,0 Z" fill="#fff"/>`
                    + `<circle cx="${x}" cy="66.4" r="3.2" fill="${c}"/><circle cx="${x + 1.2}" cy="65" r="1.2" fill="#fff"/>`
                    + `<path d="M${x - 5.6},66.2 q5.6,-5 11.2,0" stroke="#3f3239" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
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

  // ⚠️⚠️ **수염과 입이 겹쳐 어색하던 이유는 「입 자리에 구멍이 없기」 때문이었다.**
  //   옛 `full` 은 y70~108 을 통째로 덮는데 입은 y82~90 이라 **입이 수염 «위에» 떠
  //   있었다.** 구멍이 있긴 했는데(`L68,80 L52,80 L52,86`) **입보다 위**라 안 맞았다.
  //   지금은 **콧수염(입 위) + 턱수염(입 아래)** 으로 갈라 그리고, 그 사이에
  //   **입 자리(`BEARD_BED`)를 살색으로 되판다.**
  //   ⚠️ **순서가 규칙이다: 턱수염 → 입자리 → 콧수염 → 입.** 그래야 입술이 «살 위»에
  //      앉고 콧수염이 윗입술 «바로 위»에서 끊긴다
  const BEARD_BED = c => `<path d="M51.5,84.5 a8.5,5.4 0 0 1 17,0 a8.5,5.4 0 0 1 -17,0 Z" fill="${c}"/>`;
  // 콧수염 — 무정지(`stub`)에는 안 붙인다
  const STACHE = c => `<path d="M49.5,77 q4.2,-2.4 10.5,-0.5 q6.3,-1.9 10.5,0.5
        q-1.4,3.6 -5.6,3.4 q-3,-0.2 -4.9,-1.4 q-1.9,1.2 -4.9,1.4 q-4.2,0.2 -5.6,-3.4 Z" fill="${c}"/>`;
  const BEARD = {
    none: () => '',
    // 무정지 — 얼굴 옆선을 따라 턱만. **입술에는 안 닿는다**
    stub: c => `<path data-part="beard" d="M37.5,68 C39,82 46,93 60,93 C74,93 81,82 82.5,68
        C81,80 75,87 68,89.5 C65,90.5 62,91 60,91 C58,91 55,90.5 52,89.5 C45,87 39,80 37.5,68 Z"
        fill="${dark(c, 0.08)}" opacity="0.38"/>
      <path d="M50.5,77.5 q4,-2.2 9.5,-0.6 q5.5,-1.6 9.5,0.6 q-4.6,1.8 -9.5,1.8 q-4.9,0 -9.5,-1.8 Z"
        fill="${dark(c, 0.08)}" opacity="0.38"/>`,
    // 풀 비어드 — 턱을 덮되 **입 자리는 비운다**
    full: c => `<path data-part="beard" d="M36.5,64 C36.5,75 38.5,85 43,91 C47,96.5 53,99.5 60,99.5
        C67,99.5 73,96.5 77,91 C81.5,85 83.5,75 83.5,64
        C82,75 77.5,81 70,83 C67,80.5 64,79.5 60,79.5 C56,79.5 53,80.5 50,83
        C42.5,81 38,75 36.5,64 Z" fill="${c}"/>
      <path d="M43,91 C47,96.5 53,99.5 60,99.5 C67,99.5 73,96.5 77,91
        C72.5,94 66.5,95.5 60,95.5 C53.5,95.5 47.5,94 43,91 Z" fill="${dark(c, 0.2)}"/>`,
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
    // ⚠️ **어깨까지 내린다** — 아치 하나로 끊으면 «머리띠»로 보인다 (찍어 보고 알았다)
    hood:    (c, hair) => {
      const h = HAIR_SPEC[hair] || { side: 3, top: 6 };
      const y = 66, B = 130;
      const i = crown(h.side + 1, h.top + 1, y), o = crown(h.side + 9, h.top + 9, y);
      return `<path data-part="deco-hood" d="M${o.L},${B} L${o.L},${y}` +
        ` A${o.rx},${o.ry} 0 1 1 ${o.R},${y} L${o.R},${B} L${i.R},${B} L${i.R},${y}` +
        ` A${i.rx},${i.ry} 0 1 0 ${i.L},${y} L${i.L},${B} Z" fill="${c}"/>`; },
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
    // ⚠️ **기본 눈썹은 «표정이 제 눈썹을 안 가졌을 때만»** 선다. 표정 쪽이 이겨야
    //    「대노」·「곤란」 같은 얼굴이 그대로 살아난다 (지금 175칸이 제 눈썹을 갖고 있다)
    const browC = dark(sp.hairColor || '#3f3239', 0.25);
    const beard = (sp.beard && BEARD[sp.beard]) ? sp.beard : 'none';
    return `<svg class="pt-svg ${bare ? 'bare' : ''}" viewBox="0 0 ${W} ${H}"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name || ''}">
      ${bare ? '' : `<defs><clipPath id="ptc_${u}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath></defs>`}
      <g ${bare ? '' : `clip-path="url(#ptc_${u})"`}>
        ${bare ? '' : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sp.bg || '#efe6f2'}"/>`}
        ${sp.deco === 'hood' ? DECO.hood(sp.decoColor || sp.cloth, sp.hair) : ''}
        ${hair.back(sp.hairColor)}
        ${BODY(sp.cloth)}
        ${NECK(sp.skin)}
        ${FACE(sp.skin)}
        ${beard === 'none' && sp.brows !== 'soft' ? CHEEK(sp.skin) : ''}
        ${BEARD[beard](sp.hairColor)}
        ${beard === 'none' ? '' : BEARD_BED(sp.skin)}
        ${beard === 'full' ? STACHE(sp.hairColor) : ''}
        ${hair.front ? hair.front(sp.hairColor) : ''}
        ${EAR(sp.skin)}
        ${browL ? browL(50, 1) : BROW_BASE(50, 1, browC, sp.brows)}${browR ? browR(70, -1) : BROW_BASE(70, -1, browC, sp.brows)}
        ${eyeL(50, sp.eyeColor || '#3f3239')}${eyeR(70, sp.eyeColor || '#3f3239')}
        ${NOSE(sp.skin)}
        ${MOUTH[m.mouth] || MOUTH.calm}
        ${sp.deco && sp.deco !== 'hood' ? DECO[sp.deco](sp.decoColor || '#ffd76a') : ''}
      </g>
    </svg>`;
  }

  // 검사기가 «표에 있는 머리를 다» 재려면 이름 목록이 필요하다 — 손으로 적으면
  // 새 스타일이 조용히 안 재진다 (`checkglobals` 가 파일 목록에서 겪은 일이다)
  window.Portrait = { bust, W, H, hairs: Object.keys(HAIR), SKULL };
})();
