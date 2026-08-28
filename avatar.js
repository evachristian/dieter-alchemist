// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 아바타 렌더러 (SVG 페이퍼돌)
//  5개 바디 파츠(머리·몸통·팔·허벅지·종아리)
//  + 헤어(스타일/컬러) · 표정 · 옷 · 악세사리 · 문신 레이어
// ═══════════════════════════════════════════════════════════════
(function () {
  const D = window.GameData;

  // ─── 기본 팔레트 ───
  const SKIN     = '#ffdcc4';
  const SKIN_SH  = '#f2c6a6';
  const HAIR_DEF = '#7b5640';

  function shade(hex, amt = 26) {
    if (!hex || hex[0] !== '#') return hex;
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (n >> 16) - amt, g = ((n >> 8) & 255) - amt, b = (n & 255) - amt;
    return `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`;
  }

  function getItem(slot, id) {
    const list = (D.WARDROBE && D.WARDROBE[slot]) || [];
    return list.find(x => x.id === id) || list[0] || { kind: 'none' };
  }
  const isNone = it => !it || it.kind === 'none';

  function starPath(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(ang) * rad).toFixed(1) + ',' + (cy + Math.sin(ang) * rad).toFixed(1);
    }
    return d + 'Z';
  }

  // ═══════════════════════════════════════════════════════════════
  //  바디 파츠 (피부)
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  //  바디 기준 좌표 — 옷은 반드시 이 값을 기준으로 그린다.
  //  (몸을 고치면 옷도 같이 따라가도록. 체형 변화는 몸/옷을 같은 그룹으로
  //   함께 늘리므로, 여기만 맞으면 살이 찌든 빠지든 옷이 몸을 덮는다)
  // ═══════════════════════════════════════════════════════════════
  const BODY = {
    neckY: 96, neckBottom: 116,
    shoulderY: 113,                 // 어깨 윗선
    torsoTopY: 108,                 // 몸통의 맨 윗점 (목 바로 아래, x=100)
    torsoL: 64, torsoR: 136,        // 몸통 최대 폭 (어깨)
    // 어깨 곡선의 제어점 (오른쪽 반. 왼쪽은 x 를 100 기준으로 뒤집는다).
    //
    // ⚠️ **여기 한 곳에서만 정한다.** 그리는 곳(torsoArms)과 재는 곳(torsoTopAtX)이
    // 같은 값을 읽어야 한다 — 두 군데에 적어 두면 어긋나는 순간 넥라인 검사가 헛돈다.
    //
    // ⚠️ **꼭대기가 평평한 것은 어쩔 수 없다.** 목 옆에서부터 기울여 봤더니
    // (첫 제어점을 `[110,109]` 로 당김) **넥라인을 판 옷의 모서리가 몸통 위로 떠서**
    // 그 틈으로 살이 비쳤다 — 퍼프·슬립 드레스에서 좌우 1px 씩.
    // 넥라인은 x 118 언저리까지 파는데, 그 안쪽 어깨선이 108 보다 내려가면
    // 「옷도 몸도 없는 자리」가 생긴다 (checkavatar 의 넥라인 검사가 보는 것과 같은 자리).
    //
    // 그래서 **어깨를 기울이려면 넥라인 표(NECK_CUT)도 같이 좁혀야 한다.** 지금은 안 한다 —
    // 「목이 없어 보이는」 문제는 목 길이(NECK_LIFT)로 풀린다.
    //
    // ⚠️ **어깨는 팔 윗머리보다 높은 채로 팔까지 가야 한다.** 예전 값
    // `[[116,108],[136,117],[136,133]]` 은 x=126 에서 이미 y=114 까지 내려와 있었는데,
    // 팔의 둥근 윗머리는 y=110.25 로 그보다 **위**였다. 그래서 실루엣이
    // 「어깨 → 아래로 파임 → 팔이 다시 솟음」 이 되어 **3.75px 짜리 홈**이 생겼다.
    // 어깨 봉우리와 팔 봉우리가 따로 놀아 「관절이 분리된 인형」처럼 보이던 자리다.
    //
    // 지금 값은 어깨를 x 135 까지 y 108 로 끌고 가다가 거기서 떨어뜨린다.
    // 그러면 팔이 이어받는 지점(x≈130)에서 어깨가 아직 y 110.5 라 팔 봉우리(110.25)와
    // 거의 같은 높이가 되어 **홈이 0.3px 로 사라진다.**
    // (checkavatar 의 「어깨 홈」 검사가 이 값을 지킨다 — 1px 을 넘기면 실패한다)
    shoulderC: [[135, 108], [136, 108], [136, 133]],
    // 허리 높이. 예전에는 196 이라 잘록한 지점이 골반 바로 위까지 내려와,
    // 상체가 길고 허리가 없어 보였다. 그 뒤 184 로 올렸고, 지금은 **황금비**로 다시 잡았다.
    // **옷의 허리선도 전부 이 값을 본다** — 여기만 고치면 상의·치마·드레스가 같이 따라온다.
    //
    // 황금비: 정수리(24)~바닥(342) 을 상체 1 : 하체 1.618 로 나누면
    // 24 + 318/2.618 ≈ **145** 가 허리다. 그런데 145 는 갈비뼈 한가운데라,
    // 거기서 잘록해지면 몸통이 위아래로 반 접힌 것처럼 보여 쓸 수 없었다.
    // (턱 105 부터 재면 105 + 237/2.618 ≈ 195 로 지금보다 **내려간다** — 머리를 빼면
    //  기준이 뒤집히므로, 이 그림에서 「상체」는 정수리부터다)
    // 그래서 **절충으로 20px 만 올렸다**(184 → 164). 그림이 견디는 한계선이다.
    //
    // ⚠️ **허리를 옮기면 그 아래가 전부 따라 올라간다.** 허리만 올리면 엉덩이가
    // 제자리에 남아 「허리와 골반 사이가 늘어난」 몸이 된다. 바닥(342)은 고정이므로
    // 허리 아래 구간이 158 → 178 로 늘어난 배율 k = 178/158 ≈ 1.1266 을
    // **엉덩이·허벅지·종아리·발·무릎 기준선에 전부 같이 먹인다** (y' = 342 - (342-y)·k).
    // 결과적으로 다리가 그만큼 길어진다 — 황금비로 옮기는 목적 자체가 이것이다.
    waistY: 164, hipY: 198,
    // 허리 반폭 (waistY 에서 중심선 100 으로부터의 거리). '허리' 배율이 이 값을 늘이고 줄인다.
    // **옷의 허리도 이 값을 따라간다** — 예전에는 드레스 허리가 78~122 로 박혀 있어
    // 몸통 허리(70~130)보다 좁았고, 그래서 허리 살이 드레스 밖으로 나왔다.
    waistHalf: 30,
    // 엉덩이 — 허리보다 넓어야 여성 실루엣이 산다. '엉덩이' 배율이 이 값을 늘이고 줄인다.
    // 예전에는 몸통이 hipY 에서 한 점(100,214)으로 모여, 허벅지(78~122)와 만나는 곳이
    // 뚝 끊겨 보였다. 둥근 엉덩이가 그 사이를 잇는다.
    hipHalf: 34,
    hipBottom: 214,                 // 엉덩이 아래 끝 (허벅지와 겹쳐 이어진다)
    thighHalf: 22,                  // 허벅지 바깥 (78 / 122)
    // 팔: (x, y=120) 에서 시작하는 폭 armW 의 막대를 어깨 기준으로 회전.
    // **팔을 옮기면 소매도 같이 따라온다** — armShape() 이 이 값만 본다.
    // 몸통 쪽으로 조금 붙이고(52→55) 벌어짐을 줄였다(7°→4°). 예전에는 날씬할 때
    // 몸통은 허리로 좁아지는데 팔은 바깥으로 벌어져, 팔이 몸에서 떨어져 보였다.
    // 팔은 **몸통에 2px 물려 둔다.** 몸통 옆선은 어깨(133)에서 허리(184)로 좁아지는데
    // 팔은 armRot 만큼 바깥으로 기울어 내려간다 — 둘이 반대로 가서 y 170 언저리에서
    // **1px 짜리 틈**이 생겼다. 같은 살색이라 색은 안 튀는데 배경이 실처럼 비쳐
    // 「팔이 몸에서 떨어져 있다」로 읽혔다. 회전축(armPivot)도 같이 옮겨야 기울기가 그대로다.
    // **팔 위 끝은 어깨선 안쪽(112)에서 시작한다.** 예전에는 120 이라 몸통의 어깨가
    // 먼저 옆으로 뻗고 그 아래에서 팔이 따로 시작해, 이음매에 계단이 졌다 —
    // 「승모근이 불쑥 튀어나온 것」처럼 보이던 것이 이것이다.
    // 위로 올려 두면 **팔의 둥근 위 끝이 곧 어깨**가 되어 목에서 팔로 한 번에 흘러내린다.
    // 손목 자리는 그대로 둔다 (armY + armH = 214 로 같다)
    armX_L: 59, armX_R: 126, armY: 112, armH: 102, armW: 15,
    armRot: 4, armPivotL: 66, armPivotR: 134, armPivotY: 130,
    // 팔꿈치 — 팔은 윗팔/아랫팔 두 마디다. 아랫팔이 몸 쪽으로 살짝 굽는다.
    //   elbowT   팔 길이에서 팔꿈치가 있는 비율 (해부학적으로 윗팔이 조금 길다)
    //   elbowRot 아랫팔이 안쪽으로 굽는 각도. **9° 를 크게 넘기지 말 것** —
    //            더 굽히면 손이 치마 뒤로 완전히 숨고, 아랫팔이 커버리지 검사의
    //            몸통 창(x 72~128)에 들어가 위반으로 잡힌다. 지금은 팔 자체가
    //            4°(armRot) 바깥으로 기울어 있어 굽힘과 상쇄돼 2~4px 여유가 있다
    // 팔 위 끝을 8px 올리면서 비율도 다시 잡았다 — 팔꿈치의 **절대 높이는 그대로**다
    // (112 + 102×0.594 ≈ 120 + 94×0.56)
    elbowT: 0.594, elbowRot: 9,
    ankleY: 331,
    // 발(그리고 그것을 덮는 구두)의 중심 높이. 허리를 올리면서 다리가 길어져 1px 내려왔다.
    // **한 곳에만 적는다** — 예전에는 legs() 와 renderShoes() 에 335 가 따로 박혀 있어,
    // 한쪽만 옮기면 구두가 발을 1px 비껴 덮어 살색 실선이 남는다
    footY: 334,
  };
  // 옷이 몸을 확실히 덮도록 주는 여유 (한쪽당 px)
  const CLOTH_PAD = 3;
  // 옷의 **어깨 윗선**. 몸통 맨 위(108)보다 위여야 한다 —
  // 예전에는 옷이 110 에서 시작해 몸통보다 2px 아래였고, 그 사이로 살색 띠가
  // 목 밑을 가로질렀다. 눈에는 '1px 어긋난 선' 으로만 보여서 오래 남아 있었다.
  // (커버리지 검사도 y 112 부터 보고 있어서 이 띠를 통째로 지나쳤다)
  const CLOTH_TOP_Y = BODY.torsoTopY - 1;
  // 맨팔에만 주는 옅은 테두리. 팔과 몸통이 같은 살색이라, 통통해져 몸통이 넓어지면
  // 팔이 몸통에 묻혀 실루엣이 사라졌다. 얇은 선 하나로 겹쳐도 팔이 읽힌다.
  // (소매를 입으면 옷 색이 대비를 만들어 주므로 옷에는 넣지 않는다)
  // 맨팔에는 **테두리를 두르지 않는다.**
  //
  // 예전에는 살색 그림자선(SKIN_SH)을 팔 둘레에 둘렀는데, 그 선이 어깨에서도 이어져
  // **팔이 몸에서 떨어져 붙인 것처럼** 보였다. 어깨 실루엣에는 테두리가 없으므로
  // 없는 쪽으로 맞춘 것이다 — 같은 살색끼리는 선 없이 그냥 이어지는 편이 몸으로 읽힌다.
  // (선을 지우면 팔꿈치 이음매를 덮던 덧칠도 필요 없어진다 — armShape 참고)
  const ARM_EDGE = '';

  // ─── 등신 비율 기준값 ───
  // 머리(머리카락 끝 ~ 턱) 높이와 몸(어깨 ~ 발) 길이. 이 둘의 비가 등신을 만든다.
  const HEAD_H   = 84;    // 현재 아트의 머리 높이 (y 21 ~ 105)
  const BODY_SPAN = 229;  // 어깨(113) ~ 바닥(342)
  const FLOOR_Y  = 342;   // 발이 닿는 높이 (여기를 축으로 몸을 늘린다)
  const NECK_Y   = 112;   // 머리를 얹는 목 위치
  // ─── 목 길이 ───
  //
  // **날씬할수록 목을 길게 뺀다.** 안 그러면 날씬한 몸에서 목이 사라진다.
  //
  // 왜 사라지나: 머리는 NECK_Y(112)를 축으로 줄어드는데 **턱(105)이 축보다 위**에 있어서,
  // 머리가 작아질수록 턱이 112 쪽으로 끌려 내려온다. 몸통 윗선은 바닥(342)을 축으로
  // 늘어나 거의 안 움직인다. 그래서 턱과 어깨 사이가 **통통 5.8px · 날씬 2.8px** 로
  // 반 토막이 났고, 목이 없어 어깨가 솟아 보였다.
  //
  // ⚠️ **축을 턱으로 옮기는 것으로는 안 고쳐진다.** 그렇게 하면 날씬 쪽은 2.8→3.0 으로
  // 그대로인데(머리 배율이 0.979 라 축을 옮겨도 0.15px 차이다) 통통 쪽만 5.8→3.6 으로
  // 짧아진다 — 멀쩡하던 쪽을 나쁜 쪽에 맞추는 셈이다. 실제로 해 보고 눈으로 확인했다.
  //
  // 그래서 **길이를 직접 주는 손잡이 하나**를 둔다. 머리를 그만큼 위로 올린다.
  // 통통은 0 (지금 모습 그대로 · 3등신은 목이 짧아야 귀엽다), 날씬은 NECK_LIFT.
  // 결과: 날씬 8.8px · 중간 7.3px · 통통 5.8px — 날씬할수록 목이 길다 (4등신)
  const NECK_LIFT = 10;
  // 머리 크기 배율 — 통통 3등신 / 날씬 4등신 (귀여운 체형)
  // 등신 = 전체높이 / (HEAD_H × k) 이고 전체높이도 k 를 따라 조금 움직이므로
  // 두 측정점에서 관계식(전체높이 ≈ 322 + 7k)을 세워 역산한 값이다.
  // **이 값을 바꾸면 등신이 바뀐다 — 실측으로 확인할 것.**
  const HEAD_K_FAT  = 1.314;
  const HEAD_K_SLIM = 0.979;
  const lerpN = (a, b, t) => a + (b - a) * t;

  // ─── 파츠별 미세 조정 (임시 · 테스트용) ───────────────────────
  // build(outfit, body, tune) 의 tune 으로 파츠 굵기/크기를 따로 조절한다. 1 = 기본.
  // 팔·허벅지·종아리는 좌우가 각자 제자리에서 굵어지도록 **자기 중심**을 축으로 늘린다.
  // (x=100 을 축으로 하면 굵어지는 대신 바깥으로 벌어져 어깨에서 떨어져 보인다)
  const TUNE_KEYS = ['torso', 'waist', 'hip', 'arm', 'thigh', 'calf', 'face'];
  function tuneOf(tune, k) {
    const v = tune && Number(tune[k]);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  // 가로(굵기)만 늘리는 변환 — ax 를 축으로
  function sx(k, ax) {
    return k === 1 ? '' : ` transform="translate(${ax},0) scale(${k.toFixed(3)},1) translate(${-ax},0)"`;
  }
  // 전체 크기를 늘리는 변환 — (ax,ay) 를 축으로
  function su(k, ax, ay) {
    return k === 1 ? '' : ` transform="translate(${ax},${ay}) scale(${k.toFixed(3)}) translate(${-ax},${-ay})"`;
  }
  // 옷도 자기가 덮는 파츠를 따라 커진다 — 살이 옷 밖으로 나오지 않게.
  // 여러 파츠를 덮는 옷(치마·바지·드레스)은 그중 **가장 큰 배율**을 따른다.
  // 하나만 따라가면 나머지 파츠에서 살이 삐져나온다.
  function tuneMax(tune, keys) {
    return keys.reduce((m, k) => Math.max(m, tuneOf(tune, k)), 1);
  }
  // 도형 묶음을 가로로 늘려 감싼다 (배율이 1이면 그대로 둔다)
  function wrapX(s, k, ax) {
    return (!s || k === 1) ? s : `<g${sx(k, ax)}>${s}</g>`;
  }
  // 도형 묶음을 전체 크기로 늘려 감싼다
  function wrapU(s, k, ax, ay) {
    return (!s || k === 1) ? s : `<g${su(k, ax, ay)}>${s}</g>`;
  }

  // 팔과 소매를 **같은 좌표에서** 그린다.
  // 예전에는 소매 좌표가 renderTop·renderDress 에 그대로 박혀 있어서,
  // 팔 위치나 각도를 고치면 소매만 제자리에 남아 어긋났다. BODY 하나만 고치면 되게 모았다.
  //
  // 팔은 **윗팔/아랫팔 두 마디**고 팔꿈치에서 안쪽으로 굽는다. 곧은 좌표(armY 에서 아래로)로
  // 그린 뒤 아랫팔 조각에만 팔꿈치 회전을 하나 더 건다. 소매·장갑도 이 함수를 지나므로
  // 옷이 팔꿈치를 따로 알 필요가 없다 — 긴 소매는 저절로 팔꿈치에서 같이 굽는다.
  //
  //   side  'L'|'R' · pad 팔보다 얼마나 넓게(소매) · h 길이 · extra 덧붙일 속성
  //   opts.extra 덧붙일 속성 · opts.yFrom 위쪽을 잘라 아래 구간만 그림 (장갑)
  // ─── 팔도 원통이 아니다 ────────────────────────────────────
  //
  // 예전에는 윗팔·아랫팔이 **둥근 네모(rect)를 가로로 늘린 것**이라, 굵게 하면
  // 팔꿈치도 손목도 같이 굵어져 원통 두 개가 됐다. 다리와 같은 규칙으로 고친다:
  // **살(어깨·팔뚝)은 배율을 타고 관절(팔꿈치·손목)은 덜 탄다.**
  const ARM_W = { shoulder: 15, elbow: 12, wrist: 9.5 };
  const ARM_SHADE = 2.5;                 // 몸 쪽으로 깔아 두는 그늘의 폭
  const ARM_SHADE_FROM = 10;             // 팔 위 끝에서 이만큼 내려와서 시작한다
  function armWidths(k) {
    const S = ARM_W.shoulder * k;
    // 관절도 살이 붙긴 하지만 **덜 붙는다.** 그리고 마디보다 굵어질 수는 없다
    const E = Math.min(ARM_W.elbow * (0.6 + 0.4 * k), S * 0.9);
    const W = Math.min(ARM_W.wrist * (0.7 + 0.3 * k), E * 0.9);
    return { S: S, E: E, W: W };
  }
  // 팔 위 끝(armY)에서 dist 만큼 내려간 곳의 **반폭** (pad = 소매가 팔보다 넓은 만큼)
  function armHalf(dist, k, pad) {
    const B = BODY, up = B.armH * B.elbowT, wd = armWidths(k);
    const inUp = dist <= up;
    const a = inUp ? wd.S : wd.E, b = inUp ? wd.E : wd.W;
    const t = inUp ? dist / up : (dist - up) / (B.armH - up);
    const u = Math.max(0, Math.min(1, t));
    // 매끄럽게(에르미트) — 어깨·팔꿈치·손목에서 접선이 세로라 관절이 안 꺾인다
    return (a + (b - a) * u * u * (3 - 2 * u)) / 2 + pad;
  }
  // 마디 하나의 테이퍼 path. **안쪽 변은 곧은 세로선**이고 바깥 변만 곡선이다.
  //   xin 안쪽 변 · sgn 바깥 방향 · d0~d1 armY 에서 잰 거리 · cap 둥근 마개
  function armSegPath(xin, sgn, d0, d1, k, pad, capTop, capBot) {
    const B = BODY, f = n => +n.toFixed(2);
    const h0 = armHalf(d0, k, pad), h1 = armHalf(d1, k, pad);
    const y0 = B.armY + d0, y1 = B.armY + d1;
    const out = h => f(xin + sgn * h * 2);
    const sw = sgn > 0 ? 1 : 0;                       // 마개를 도는 방향
    const t0 = capTop ? y0 + h0 : y0, t1 = capBot ? y1 - h1 : y1;
    const m = (t1 - t0) * 0.5;                        // 제어점 높이 — 양 끝에서 접선이 세로
    let d = capTop
      ? `M${f(xin)},${f(t0)} A${f(h0)},${f(h0)} 0 0 ${sw} ${out(h0)},${f(t0)}`
      : `M${f(xin)},${f(y0)} L${out(h0)},${f(y0)}`;
    d += ` C${out(h0)},${f(t0 + m)} ${out(h1)},${f(t1 - m)} ${out(h1)},${f(t1)}`;
    d += capBot ? ` A${f(h1)},${f(h1)} 0 0 ${sw} ${f(xin)},${f(t1)}`
                : ` L${f(xin)},${f(y1)}`;
    return d + ' Z';
  }

  function armShape(side, fill, pad, h, tune, opts) {
    const B = BODY, left = side === 'L', o = opts || {};
    const d = armShift(tune) * (left ? 1 : -1);       // 어깨선을 따라 팔을 옮긴다
    const x0 = (left ? B.armX_L : B.armX_R) + d;
    const ka = tuneOf(tune, 'arm');
    // **안쪽 변은 고정이다** — 굵기가 어떻든 팔이 몸통에서 안 떨어진다.
    // sgn 은 안쪽에서 바깥쪽으로 가는 방향
    const sgn = left ? -1 : 1;
    const xin = +((left ? x0 + B.armW + pad : x0 - pad)).toFixed(2);
    const rot = left ? B.armRot : -B.armRot;
    const bend = left ? -B.elbowRot : B.elbowRot;     // 안쪽(몸 쪽)으로
    const pivot = (left ? B.armPivotL : B.armPivotR) + d;
    const upLen = B.armH * B.elbowT;                  // 팔꿈치까지의 길이
    const cx = +(xin + sgn * armHalf(upLen, ka, pad)).toFixed(2);   // 팔꿈치 회전축
    const elbowY = B.armY + upLen;
    // 그릴 구간을 팔 위 끝(armY)에서 잰 거리로 바꾼다
    const from = (o.yFrom != null ? o.yFrom : B.armY - pad) - B.armY;
    const to = from + h;
    const baseRot = `rotate(${rot} ${+pivot.toFixed(2)} ${B.armPivotY})`;
    // 그릴 조각들을 먼저 모은다 — 테두리가 있으면 두 번 그려야 해서(아래 참조) 목록이 필요하다
    const segs = [];
    // 윗팔 조각 — 팔꿈치에서 **딱 끊는다** (아래 joint 가 이음매를 메운다)
    const upFrom = from, upTo = Math.min(to, upLen);
    if (upTo > upFrom) segs.push({ y: B.armY + upFrom, h: upTo - upFrom, tr: baseRot });
    // 아랫팔 조각 — 팔꿈치 기준 회전이 하나 더 붙는다 (기울기 → 굽힘 순으로 적용된다)
    const foFrom = Math.max(from, upLen), foTo = to;
    if (foTo > foFrom) {
      segs.push({ y: B.armY + foFrom, h: foTo - foFrom,
        tr: `${baseRot} rotate(${bend} ${+cx.toFixed(2)} ${+elbowY.toFixed(2)})` });
    }
    // ─── 팔꿈치 이음매는 **관절에 놓은 원 하나**로 메운다 ───────
    //
    // 마디 둘을 그냥 맞대면 아랫팔이 굽는 만큼(elbowRot) 윗변이 기울어
    // 바깥쪽에 얇은 쐐기 틈이 남는다. 예전에는 윗팔을 **고정된 반폭(w/2)만큼
    // 아래로 늘려** 덮었는데, 그 늘린 조각은 **굽힘을 안 타서** 팔꿈치 바깥에
    // 네모난 턱으로 삐져나왔다 — 팔이 가늘수록 더 튀어나온다 (늘린 길이가
    // 굵기와 무관한 고정값이라 그렇다).
    //
    // 굽힘의 회전축이 관절 한가운데(cx, elbowY)이므로 **그 점을 중심으로 한 원은
    // 굽혀도 제자리다.** 반지름을 팔꿈치의 반폭으로 잡으면 두 마디 어느 쪽에서 봐도
    // 안에 들어가 있어(원은 이차로 좁아지고 팔은 그보다 느리게 좁아진다) 밖으로 안 나온다.
    const hE = armHalf(upLen, ka, pad);
    const jy0 = Math.max(elbowY - hE, B.armY + from);
    const jy1 = Math.min(elbowY + hE, B.armY + to);
    const joint = (color, extra) => {
      if (!(from < upLen && to > upLen) || jy1 - jy0 <= 0.01) return '';
      const f = n => +n.toFixed(2);
      const wAt = y => Math.sqrt(Math.max(0, hE * hE - (y - elbowY) * (y - elbowY)));
      const w0 = wAt(jy0), w1 = wAt(jy1);
      return `<path d="M${f(cx + w0)},${f(jy0)} A${f(hE)},${f(hE)} 0 0 1 ${f(cx + w1)},${f(jy1)}`
        + ` L${f(cx - w1)},${f(jy1)} A${f(hE)},${f(hE)} 0 0 1 ${f(cx - w0)},${f(jy0)} Z"`
        + ` fill="${color}"${extra || ''} transform="${baseRot}"/>`;
    };
    const emit = (list, color, extra) => list.map((g, i) =>
      `<path d="${armSegPath(xin, sgn, g.y - B.armY, g.y - B.armY + g.h, ka, pad,
                             i === 0, i === list.length - 1)}"
        fill="${color}"${extra || ''} transform="${g.tr}"/>`).join('');
    // 몸통과 팔이 같은 색이라 **겹치면 팔이 사라진다.** 테두리를 두르면 어깨에서 팔로
    // 이어지는 선을 막아서 없앴는데(4f58adb), 그러자 이번엔 구별이 안 됐다.
    // 그래서 **같은 모양을 몸 쪽으로 조금 밀어 한 단 어둡게** 깔아 둔다 —
    // 팔에 가려 **안쪽 겨드랑이 선만 그늘로 남는다.** 테두리처럼 실루엣을 끊지 않는다.
    //
    // ⚠️ **그늘은 팔이 시작하는 선에서 바로 긋지 않는다.** 어깨에서 팔로 넘어가는
    // 자리에 선이 생겨 애써 이은 실루엣을 도로 끊는다. ARM_SHADE_FROM 만큼 내려와
    // **겨드랑이 아래에서** 시작한다 (위 끝은 둥근 마개라 스르르 시작한다).
    const sFrom = B.armY + ARM_SHADE_FROM;
    const shadeSegs = segs.map(g => ({ y: Math.max(g.y, sFrom), h: g.h - Math.max(0, sFrom - g.y), tr: g.tr }))
      .filter(g => g.h > 0.5);
    const sc = shade(fill, 8);
    return `<g transform="translate(${(-sgn * ARM_SHADE).toFixed(2)},0)">`
      + emit(shadeSegs, sc) + joint(sc) + '</g>'
      + emit(segs, fill, o.extra) + joint(fill, o.extra);
  }

  // 팔 중심선 위의 한 점 — dist 는 팔 위 끝(armY)에서 잰 거리.
  // 손 위치 계산용이라 armShift(체형 이동)는 넣지 않는다 (기존 손 계산과 같은 기준).
  function armPoint(side, dist, tune) {
    const B = BODY, left = side === 'L', k = tuneOf(tune, 'arm'), sgn = left ? -1 : 1;
    const rot = (left ? B.armRot : -B.armRot) * Math.PI / 180;
    const bend = (left ? -B.elbowRot : B.elbowRot) * Math.PI / 180;
    // 팔이 가늘어지면 중심선도 안쪽으로 온다 — 안쪽 변이 고정이기 때문이다.
    // 손을 옛 고정값에 두면 가는 팔에서 손만 바깥에 남는다
    const xin = left ? B.armX_L + B.armW : B.armX_R;
    const at = d => xin + sgn * armHalf(d, k, 0);
    const pivot = left ? B.armPivotL : B.armPivotR;
    const upLen = B.armH * B.elbowT, elbowY = B.armY + upLen;
    const cx = at(upLen);
    const rotAbout = (p, a, o) => ({
      x: o.x + (p.x - o.x) * Math.cos(a) - (p.y - o.y) * Math.sin(a),
      y: o.y + (p.x - o.x) * Math.sin(a) + (p.y - o.y) * Math.cos(a),
    });
    let p = { x: at(dist), y: B.armY + dist };
    if (dist > upLen) p = rotAbout(p, bend, { x: cx, y: elbowY });   // 굽힘 먼저
    return rotAbout(p, rot, { x: pivot, y: B.armPivotY });           // 그다음 팔 기울기
  }

  // 장갑 — 팔 아래쪽(손목 쪽)부터 len 비율만큼 덮는다
  function renderGlove(it, tune) {
    if (isNone(it)) return '';
    const B = BODY, c = it.color, c2 = shade(c, 18);
    const pad = 1.5;                                  // 팔보다 아주 살짝 넓게
    const len = Math.max(0.08, Math.min(0.95, Number(it.len) || 0.22));
    const h = B.armH * len + pad;
    const yFrom = B.armY + B.armH - h + pad;          // 팔 끝(손목)에 맞춰 아래로 정렬
    // 마감(finish) — 장갑 **입구**를 어떻게 처리하는가. 길이(len)와 함께 두 축이다.
    // 옛 세이브는 kind 로만 갈렸다 — finish 가 없으면 그때 규칙으로 떨어진다
    const finish = it.finish || ((it.kind === 'lace') ? 'frill'
      : (it.kind === 'satin' || it.kind === 'opera') ? 'cuff'
      : (it.kind === 'leather') ? 'strap' : 'plain');
    // 입구 장식은 팔 모양을 그대로 따라야 팔 밖으로 삐져나오지 않는다 — armShape 로 그린다
    const bandAt = (col, thick, at) =>
      armShape('L', col, pad, thick, tune, { yFrom: at }) + armShape('R', col, pad, thick, tune, { yFrom: at });
    let trim = '';
    if (finish === 'cuff')       trim = bandAt(c2, 3, yFrom);                       // 얇은 띠
    else if (finish === 'frill') trim = bandAt(c2, 3, yFrom) + bandAt(c2, 2, yFrom + 5);  // 두 겹 프릴
    else if (finish === 'ribbon') trim = bandAt(c2, 4, yFrom + 2);                  // 굵은 띠(리본 자리)
    else if (finish === 'strap') trim = bandAt(c2, 2.4, yFrom + 3) + bandAt(c2, 2.4, yFrom + h - 8); // 위아래 스트랩
    return `<g data-part="glove">
      ${armShape('L', c, pad, h, tune, { yFrom })}
      ${armShape('R', c, pad, h, tune, { yFrom })}
      ${trim}
    </g>`;
  }

  // 구두 — 발(ellipse cx 86/114, cy BODY.footY)을 덮는다. rise 만큼 발목 위로 올라온다.
  // 높이는 전부 footY 에서 상대로 잡는다 — 다리가 움직이면 구두도 같이 따라와야 한다
  function renderShoes(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c, 22), rise = Number(it.rise) || 0;
    const FY = BODY.footY;
    const fin = it.finish || ({ maryjane: 'strap', ballet: 'ribbon', sneaker: 'sole',
      glass: 'gloss', boots: 'plain' }[it.kind] || 'plain');
    const foot = (cx) => {
      let s = '';
      if (rise > 0) {   // 부츠·스니커즈: 발목을 감싸는 통
        s += `<rect x="${cx - 9}" y="${FY - rise}" width="18" height="${rise + 4}" rx="5" fill="${c}"/>`;
      }
      s += `<ellipse cx="${cx}" cy="${FY}" rx="13" ry="7.6" fill="${c}"/>`;
      // 마감(finish) — 목 높이(rise)와 함께 두 축이다.
      // 옛 세이브는 kind 로만 갈렸다 — finish 가 없으면 그때 규칙으로 떨어진다
      if (fin === 'strap')      s += `<path d="M${cx - 9},${FY - 4} L${cx + 9},${FY - 4}" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>`;
      else if (fin === 'ribbon') s += `<path d="M${cx - 7},${FY - 5} Q${cx},${FY - 1} ${cx + 7},${FY - 5}" stroke="${c2}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
        + `<circle cx="${cx}" cy="${FY - 5}" r="2" fill="${c2}"/>`;
      else if (fin === 'sole')  s += `<ellipse cx="${cx}" cy="${FY + 3}" rx="13" ry="3.4" fill="${c2}"/>`;
      else if (fin === 'gloss') s += `<ellipse cx="${cx - 3}" cy="${FY - 2}" rx="5" ry="2.4" fill="#fff" opacity="0.75"/>`;
      // 목이 있는 구두는 입구에 띠를 하나 둘러 발목과 경계가 보이게 한다
      if (rise > 0) s += `<path d="M${cx - 9},${FY - rise + 5} L${cx + 9},${FY - rise + 5}" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>`;
      return s;
    };
    const fx = footX(tune);
    return `<g data-part="shoes">${foot(fx)}${foot(200 - fx)}</g>`;
  }

  // 몸통 배율이 바뀌면 몸통 옆선이 안팎으로 움직인다. 팔이 제자리면 몸통에서 떨어지므로
  // **옆선이 움직인 만큼 팔도 같이 옮긴다** — 그래야 붙어 있는 관계가 그대로 유지된다.
  // (몸통은 x=100 을 축으로 늘어나므로 옆선은 100-(100-기준)*k 로 간다)
  //
  // 기준은 어깨 최대폭(torsoL=64)이 아니라 **팔 중간 높이의 몸통 옆선**이다.
  // 몸통은 허리로 갈수록 좁아지는데 어깨 폭으로 맞추면 그 차이가 배율만큼 커져,
  // 몸통을 키웠을 때 팔 아래쪽이 다시 떨어진다. 64·66·68·70·72 를 실측으로
  // 쓸어 본 결과 68 만 50~200% 전 구간에서 틈이 0 이었다.
  const ARM_ANCHOR_X = 68;
  function armShift(tune) {
    return (100 - ARM_ANCHOR_X) * (1 - tuneOf(tune, 'torso'));
  }

  // ─── 어깨 끝은 팔의 바깥 변을 넘지 않는다 ────────────────────
  //
  // 넘으면 어깨가 팔보다 튀어나와 **부리처럼 뾰족한 턱**이 생긴다. 팔을 가늘게 하면
  // (팔 배율 50%) 팔의 바깥 변이 안으로 들어오는데 어깨는 제자리라 실제로 났다.
  //
  // ⚠️ **팔을 바깥으로 밀어서 맞추면 안 된다.** 굵기 배율의 축을 바깥 변으로 옮겨
  // 봤더니 어깨는 붙었지만 **팔이 허리에서 몸통과 떨어졌다** — 팔은 허리에서 몸통과
  // 1.6px 밖에 안 겹쳐 있어서, 가늘어진 만큼 안쪽 변이 밖으로 나가면 곧바로 배경이 비친다
  // (팔 50% 에서 4.75px 벌어졌다 — 팔이 몸 옆에 떠 있는 막대로 보인다).
  // 폭이 15px 뿐이라 「허리에 닿으면서 어깨 끝까지 닿는」 팔은 만들 수가 없다.
  //
  // 그래서 **어깨 쪽을 팔에 맞춘다.** 어깨 끝이 팔의 바깥 변보다 나가면 그만큼만 좁힌다.
  // 팔이 어깨보다 바깥이면(기본값 · 팔을 굵게 한 경우) 1 이라 아무것도 안 바뀐다.
  function shoulderSquash(tune) {
    const B = BODY;
    const tip = 100 + (B.torsoR - 100) * tuneOf(tune, 'torso');
    // 팔의 바깥 변. **둥근 어깨 마개(cap) 몫으로 2px 물린다** — 팔 위 끝은 둥글어서
    // 맨 위에서는 아직 제 폭이 아니다. 그만큼 어깨가 마개 밖으로 삐져나온다
    // (팔 50% 에서 y≈111 에 2px 짜리 혹). 기본값은 팔이 어깨보다 5px 바깥이라 안 바뀐다
    const armOuter = B.armX_R + B.armW * tuneOf(tune, 'arm') - armShift(tune) - 2;
    return armOuter >= tip ? 1 : (armOuter - 100) / (tip - 100);
  }
  // 어깨 쪽 x 를 중심선(100) 기준으로 f 배 좁힌다. 몸통·옷이 같은 함수를 지난다
  const sqx = (x, f) => f === 1 ? x : +(100 + (x - 100) * f).toFixed(2);

  // 무릎 높이 — 허벅지 아래 끝(263)과 종아리 위 끝(256)이 겹치는 자리.
  // 옷이 종아리까지 덮는지 판정하는 기준이다. **다리를 옮기면 여기도 같이 옮긴다**
  const KNEE_LINE = 259;

  // 허리 반폭 — 몸과 옷이 **같은 값**을 본다. 옷은 CLOTH_PAD 만큼 넉넉하게.
  const waistHalf = tune => BODY.waistHalf * tuneOf(tune, 'waist');
  const clothWaistHalf = tune => waistHalf(tune) + CLOTH_PAD;
  // 허벅지 바깥 변 — **높이에 따라 다르다.** 위(엉덩이 밑)가 가장 굵고 무릎으로 가늘어진다.
  // 엉덩이가 붙을 자리를 잡으려면 「그 높이의」 허벅지 폭을 알아야 한다
  function thighOuterAt(tune, y) {
    const L = LEG, top = THIGH_GAP + L.hipW * tuneOf(tune, 'thigh'), kx = kneeX(tune);
    const u = Math.max(0, Math.min(1, (y - L.hipY) / (L.kneeY - L.hipY)));
    return top + (kx - top) * u * u * (3 - 2 * u);
  }
  // 가장 굵은 곳 (엉덩이 바로 밑) — 기본값이면 122
  const thighOuter = tune => thighOuterAt(tune, LEG.hipY);
  // 발(과 구두)의 중심 x — **발목을 따라간다.**
  // 발목은 배율을 안 타므로 종아리를 굵게 해도 발은 제자리다. 가늘게 하면 같이 들어온다.
  // (발목 한가운데에서 바깥으로 6px — 기본값에서 86 / 114 가 되는 자리다)
  const footX = tune => +(100 - ((CALF_GAP + ankleX(tune)) / 2 + 6)).toFixed(2);
  // 엉덩이가 허벅지에 내려꽂는 자리는 **바깥 변보다 1px 안쪽**이다.
  //
  // ⚠️ 딱 맞추거나(122) 밖으로 물리면(123) 그 높이에서 실루엣이 1px 턱을 져
  // **허벅지와 엉덩이가 만나는 곳에 가느다란 선**이 보인다. 예전 값이 123 이었다.
  // 안쪽에 두면 그 아래부터는 **허벅지의 제 옆선이 그대로 이어받아** 선이 안 생긴다
  // (엉덩이는 허벅지 위에 그려지므로, 안쪽으로 물러나면 허벅지가 드러난다).
  // ⚠️ **허벅지가 아래로 가늘어진다는 것을 빼먹으면 안 된다.** 가장 굵은 곳(122)을
  // 기준으로 잡아 두었더니, 붙는 높이(224)에서 허벅지는 이미 119.5 라 그 사이로
  // **세로 틈**이 벌어졌다 (기본 1.6px · 엉덩이 150% 에서 3.8px).
  // 붙는 높이에서 재면 그 위 구간에서도 허벅지가 늘 더 굵어 틈이 안 생긴다.
  const thighJoin = tune => thighOuterAt(tune, hipBlendY(tune)) - 1;
  // 엉덩이 반폭 — 옷은 여기도 덮어야 한다 (치마·바지·드레스가 이 값을 본다).
  //
  // **허리보다도 허벅지보다도 좁을 수 없다.** 좁으면 그 둘이 엉덩이 밖으로 튀어나와
  // 이음매에 계단이 생긴다 (엉덩이만 줄이면 몸통 옆선이 엉덩이 밖으로 나갔다).
  const hipHalf = tune => Math.max(
    BODY.hipHalf * tuneOf(tune, 'hip'),
    waistHalf(tune) * tuneOf(tune, 'torso'),
    thighOuter(tune));
  const clothHipHalf = tune => hipHalf(tune) + CLOTH_PAD;

  // ─── 엉덩이는 아래로 처진다 ─────────────────────────────────
  //
  // 튀어나온 만큼(=낙차) **내려올 거리도 길어지고 봉우리도 아래로 내려온다.**
  // 짧은 거리에 억지로 밀어 넣으면 옆으로 뾰족한 날개가 된다 — 실제 몸은 커질수록
  // 뾰족해지는 게 아니라 **중력으로 처지면서 더 둥글어진다.**
  //
  // 몸과 하의가 **같은 값을 본다** — 안 그러면 넓은 엉덩이가 바지 옆으로 삐져나온다.
  // 낙차는 **가장 굵은 곳**으로 잰다 — thighJoin 이 hipBlendY 를 보므로 여기서
  // thighJoin 을 쓰면 서로를 부르며 돈다
  const hipDrop = tune => Math.max(0, hipHalf(tune) - thighOuter(tune));
  // 허벅지에 붙는 높이. 아무리 커도 **무릎 10px 위**에서는 붙는다 (그 아래는 종아리다)
  function hipBlendY(tune) {
    return +Math.min(KNEE_LINE - 10,
      Math.max(BODY.hipBottom, BODY.hipY + hipDrop(tune) * 2.2)).toFixed(1);
  }
  // 가장 넓은 높이 — 처진 만큼 hipY 보다 아래다.
  // 내려갈 수 있는 거리의 35% 를 넘지는 않는다 (봉우리가 허벅지에 너무 붙으면 다시 뾰족해진다)
  function hipApexY(tune) {
    const room = hipBlendY(tune) - BODY.hipY;
    return +(BODY.hipY + Math.min(hipDrop(tune) * 0.5, room * 0.35)).toFixed(1);
  }
  // 엉덩이 옆선 (오른쪽 반) — 봉우리에서 허벅지까지 내려오는 3차 곡선의 제어점.
  //   x0 봉우리 폭 · x3 허벅지에 닿는 폭 (하의는 여기에 제 여유를 얹어 부른다)
  //   cutY 를 주면 그 높이에서 **잘라** 돌려준다 (de Casteljau).
  //
  // ⚠️ **밑단이 짧다고 곡선을 눌러 담으면 안 된다.** 예전에는 하의가
  // `min(엉덩이 끝, 밑단-6)` 에서 다리 폭이 되도록 곡선을 억지로 세웠는데,
  // 그러면 하의가 몸보다 가팔라져 **그 사이로 엉덩이가 비쳤다** (반바지에서 y 224~236).
  // 몸과 **같은 곡선**을 쓰고 밑단에서 자르면 어디서 잘라도 몸 바깥에 남는다.
  function hipSideCurve(tune, x0, x3, cutY) {
    const HY = hipApexY(tune), BY = hipBlendY(tune), hb = (BY - HY) * 0.45;
    let P = [[x0, HY], [x0, HY + hb], [x3, BY - hb], [x3, BY]];
    if (cutY != null && cutY < BY) {
      const yAt = t => {
        const u = 1 - t;
        return u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
      };
      let lo = 0, hi = 1;                     // y 는 t 에 대해 단조증가한다
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (yAt(m) < cutY) lo = m; else hi = m; }
      const t = (lo + hi) / 2;
      const mid = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const a1 = mid(P[0], P[1]), b1 = mid(P[1], P[2]), c1 = mid(P[2], P[3]);
      const a2 = mid(a1, b1), b2 = mid(b1, c1);
      P = [P[0], a1, a2, mid(a2, b2)];
    }
    return P.map(pt => [+pt[0].toFixed(2), +pt[1].toFixed(2)]);
  }

  // 다리 — 허리(waistY)를 올린 만큼 통째로 올라오고 그만큼 길어진다.
  // 바닥은 고정이므로 위 끝만 올라가고 길이가 늘어난다: 허벅지 186~263 · 종아리 256~331.
  // (예전 값 204~272 / 266~332 를 k=1.1266 으로 늘린 자리다 — BODY.waistY 주석 참고)
  // 허벅지 아래 끝과 종아리 위 끝은 7px 겹쳐 둔다. 안 겹치면 무릎에서 배경이 비친다
  //
  // ⚠️ **굵기 배율의 축은 안쪽 변이다** — 가운데가 아니다.
  // 가운데를 축으로 하면 가늘게 만들 때 안쪽 변도 같이 밖으로 밀려 **다리 사이가 벌어진다**
  // (허벅지 60% 에서 틈이 4px → 12px). 체지방이 빠져도 다리 사이는 그대로 붙어 있고
  // 살은 **바깥쪽에서** 빠진다 — 체지방 15~45% 사진을 견줘 보면 그렇다.
  // 안쪽 변을 축으로 두면 굵어지든 가늘어지든 **틈이 일정**하다.
  // ─── 다리는 원통이 아니다 ──────────────────────────────────
  //
  // 예전에는 허벅지·종아리가 **네모(rect)를 가로로 늘린 것**이었다. 그래서 굵게 하면
  // 무릎도 발목도 같이 굵어져 **통나무**가 됐다. 실제 여자 다리는 그렇게 안 생겼다 —
  // **관절(무릎·발목)은 거의 그대로**고, 허벅지 위쪽과 장딴지만 곡선으로 부푼다.
  //
  // 그래서 마디마다 「살이 붙는 곳」과 「안 붙는 곳」을 나눠 둔다:
  //   허벅지  위(엉덩이 밑)가 가장 굵다 → 무릎으로 가늘어진다
  //   종아리  무릎에서 장딴지로 부풀었다가 → 발목으로 가늘어진다
  //
  // ⚠️ **관절은 「중심선에서 잰 거리」로 잡는다.** 허벅지와 종아리는 안쪽 변이 서로 달라서
  // (2 / 3), 폭을 맞추면 무릎에서 바깥 변이 어긋나 1px 턱이 진다.
  //
  // ⚠️ **안쪽 변은 배율을 안 탄다** — 가늘게 만들어도 다리 사이가 안 벌어진다.
  // 체지방이 빠져도 살은 **바깥쪽에서** 빠진다 (체지방 15~45% 사진).
  const THIGH_GAP = 2, CALF_GAP = 2;      // 중심선 → 안쪽 변 (**둘이 같아야** 무릎 안쪽이 안 어긋난다)
  const LEG = {
    hipY: 186, kneeY: 263, calfY: 256, ankleY: 331,
    bellyT: 0.28,                         // 장딴지가 가장 굵은 곳 (종아리 구간의 비율)
    hipW: 20, bellyW: 18,                 // 배율을 타는 살 (안쪽 변에서 잰 폭)
    kneeX: 17, ankleX: 14,                // 배율을 **안 타는** 관절 (중심선에서 잰 거리)
  };
  // 관절은 그대로지만 **마디보다 굵어질 수는 없다** — 가늘게 만들면 같이 가늘어진다
  const kneeX = tune => Math.min(LEG.kneeX,
    THIGH_GAP + LEG.hipW * tuneOf(tune, 'thigh') * 0.85,
    CALF_GAP + LEG.bellyW * tuneOf(tune, 'calf') * 0.85);
  const ankleX = tune => Math.min(LEG.ankleX, CALF_GAP + LEG.bellyW * tuneOf(tune, 'calf') * 0.8);

  // 다리 마디 하나. 마디마다 **세로 접선**으로 이어져 어느 배율에서도 안 꺾인다.
  //   gap 안쪽 변 · s 오른쪽이면 +1 · pts [[y, 중심선에서 잰 바깥 거리], ...] 위→아래
  function limbPath(gap, s, pts) {
    const X = n => +(100 + s * n).toFixed(2);
    const a = pts[0], z = pts[pts.length - 1];
    const cap = w => Math.max(1, Math.min(5, (w - gap) / 2));   // 마개는 폭의 절반을 못 넘는다
    const r0 = cap(a[1]), r1 = cap(z[1]);
    let d = `M${X(gap)},${a[0]} L${X(a[1] - r0)},${a[0]} Q${X(a[1])},${a[0]} ${X(a[1])},${(a[0] + r0).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const y0 = i === 1 ? p[0] + r0 : p[0];
      const y1 = i === pts.length - 1 ? q[0] - r1 : q[0];
      const h = (y1 - y0) * 0.45;
      d += ` C${X(p[1])},${(y0 + h).toFixed(1)} ${X(q[1])},${(y1 - h).toFixed(1)} ${X(q[1])},${y1.toFixed(1)}`;
    }
    d += ` Q${X(z[1])},${z[0]} ${X(z[1] - r1)},${z[0]} L${X(gap)},${z[0]} Z`;
    return `<path d="${d}" fill="${SKIN}"/>`;
  }

  function legs(tune) {
    const L = LEG, kt = tuneOf(tune, 'thigh'), kc = tuneOf(tune, 'calf');
    const kx = kneeX(tune), ax = ankleX(tune);
    const bellyY = +(L.calfY + (L.ankleY - L.calfY) * L.bellyT).toFixed(1);
    const thigh = [[L.hipY, THIGH_GAP + L.hipW * kt], [L.kneeY, kx]];
    const calf = [[L.calfY, kx], [bellyY, CALF_GAP + L.bellyW * kc], [L.ankleY, ax]];
    const fy = BODY.footY, fx = footX(tune);
    return `
      <g data-part="calf">
        ${limbPath(CALF_GAP, -1, calf)}
        ${limbPath(CALF_GAP, 1, calf)}
      </g>
      <ellipse cx="${fx}" cy="${fy}" rx="12" ry="7" fill="${SKIN_SH}"/>
      <ellipse cx="${200 - fx}" cy="${fy}" rx="12" ry="7" fill="${SKIN_SH}"/>
      <g data-part="thigh">
        ${limbPath(THIGH_GAP, -1, thigh)}
        ${limbPath(THIGH_GAP, 1, thigh)}
      </g>`;
  }

  // ─── 목 ───────────────────────────────────────────────────────
  //
  // 턱 밑 그늘은 **아래로 갈수록 사라진다.** 예전에는 통째로 SKIN_SH 인 네모라
  // 턱과 몸통(둘 다 SKIN) 사이에 어두운 띠가 딱 잘려 보였다 — 넥라인을 파고 나서
  // 목이 드러나자 그 띠가 그대로 눈에 띄었다.
  //
  // 끝나는 높이를 **몸통 맨 윗선(108)** 에 맞추는 것이 핵심이다. 거기서 색이
  // SKIN 과 같아지므로 몸통이 목을 덮는 자리에 경계가 아예 생기지 않는다.
  // 시작(98)은 턱보다 위다 — 턱은 체형에 따라 101~106 사이를 오르내리는데(머리 배율),
  // 어디에 있든 그 지점의 그러데이션 중간값에서 시작해 자연스럽게 옅어진다.
  const NECK_SHADE_TOP = 98;

  // 목은 아래에서 **어깨 쪽으로 벌어진다.** 곧은 네모로 두면 넥라인을 판 자리 옆에
  // 옷도 몸도 없는 곳이 생겨 배경이 비쳤다 (몸통 돔은 가운데만 높아서, 목 옆
  // x 109~113 은 y 110 이 되어야 비로소 몸통이 올라온다).
  // 벌어지는 곳(y 104~)은 턱보다 아래라 얼굴 밑이 넓어 보이지도 않는다.
  // 목 굵기는 **얼굴 반폭과 어깨 반폭의 평균**에서 나온다.
  //
  // 고정 폭이면 안 되는 이유: 머리는 등신 비율(headK)과 「얼굴」 배율을, 어깨는 체형과
  // 「몸통」 배율을 탄다. 목만 고정이면 얼굴을 키웠을 때 목이 가늘어 보이고,
  // 어깨를 넓혔을 때 목이 몸에 안 붙어 보인다 — 어느 쪽도 사람 몸으로 안 읽힌다.
  //
  // 두 계수는 **지금 모습(반폭 9)을 기준으로 역산한 값**이다. 기본값에서는
  // (32.3×0.27 + 36×0.26) / 2 ≈ 9.0 이라 예전 그림과 같다.
  const NECK_OF_FACE = 0.27, NECK_OF_SHOULDER = 0.26;

  //   top   목의 윗변 y (**턱에 맞춘다** — build 가 계산해서 넘긴다)
  //   half  목의 반폭
  //
  // ⚠️ 윗변을 96 으로 박아 두면 안 된다. 머리는 NECK_LIFT 만큼 위로 올라가는데
  // 목이 그 자리에 남아 **턱과 목 사이가 벌어진다** (실제로 그렇게 배포됐다).
  //   maxR 목이 벌어져도 좋은 가장 바깥 x (= 몸통 어깨 끝). 넘으면 몸통이 못 덮는다
  function neckShape(uid, top, half, maxR) {
    const B = BODY;
    const L = +(100 - half).toFixed(1), R = +(100 + half).toFixed(1);
    // 벌어지기 시작하는 곳은 **몸통 윗선(108) 바로 위**다. 그보다 위에서 벌리면
    // 안 판 옷(폴라)의 어깨선 위로 살이 1px 삐져나온다. 108 아래는 어차피 몸통도
    // 같은 살색이라 어떤 모양이든 이음매가 안 보인다 — 그래서 아래에서만 크게 벌린다
    //
    // ⚠️ **벌어지는 폭은 어깨를 넘지 못한다.** 목은 몸통보다 **먼저** 그려져 몸통이 덮어
    // 주는데, 몸통 배율을 줄이면 어깨가 좁아져 이 자락이 어깨 밖으로 삐져나온다 —
    // 몸통 50% 에서 어깨 끝 117.5 / 목자락 123.5 로 **6px 짜리 부리**가 생겼다.
    // 팔이 100% 일 때는 팔이 그 위를 덮어 안 보였고, 팔까지 가늘게 하면 드러났다.
    // (「몸통50 팔50 에서만 어깨가 튀어나온다」의 정체가 이것이다)
    const mid = B.torsoTopY - 1, bot = B.neckBottom;
    const F = maxR == null ? 17 : Math.max(0, Math.min(17, maxR - R - 1));
    return `<path d="M${L},${+top.toFixed(1)} L${R},${+top.toFixed(1)} L${R},${mid}
        C${R + 3},${mid + 1} ${R + F},${mid + 3} ${R + F},${bot} L${L - F},${bot}
        C${L - F},${mid + 3} ${L - 3},${mid + 1} ${L},${mid} Z" fill="url(#neckG_${uid})"/>`;
  }

  // 몸통 윗선(오른쪽 반)의 x 에서의 y.
  // **넥라인은 이 선보다 위를 팔 수 없다** — 파면 옷도 몸도 없는 자리가 되어 배경이 비친다.
  // x 는 t 에 대해 단조증가하므로 이분법으로 찾는다.
  function torsoTopAtX(x) {
    const P = [[100, BODY.torsoTopY]].concat(BODY.shoulderC);
    const at = t => {
      const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0],
              a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
    };
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (at(m)[0] < x) lo = m; else hi = m; }
    return at((lo + hi) / 2)[1];
  }
  function neckDefs(uid) {
    return `<linearGradient id="neckG_${uid}" gradientUnits="userSpaceOnUse"
        x1="0" y1="${NECK_SHADE_TOP}" x2="0" y2="${BODY.torsoTopY}">
        <stop offset="0" stop-color="${SKIN_SH}"/><stop offset="1" stop-color="${SKIN}"/>
      </linearGradient>`;
  }

  function torsoArms(tune, uid, neck) {
    const kb = tuneOf(tune, 'torso');   // 팔 배율은 armShape 이 알아서 따른다
    const B = BODY, wh = waistHalf(tune);
    const wL = +(100 - wh).toFixed(2), wR = +(100 + wh).toFixed(2);
    // ─── 엉덩이 — 허리와 허벅지를 **접선이 이어지게** 잇는다 ───
    //
    // 허리·엉덩이·허벅지는 배율이 서로 다르다. 예전에는 엉덩이 path 를 통째로
    // `sx(kh, 100)` 으로 늘려서 **허리에 닿는 점과 허벅지에 닿는 점까지 같이 늘어났다** —
    // 엉덩이만 키우면 위 이음매가 몸통 옆선 밖으로 튀어나오고, 아랫변이 허벅지보다
    // 넓어져 두 자리에 계단이 생겼다 (허리를 줄이면 위쪽이, 엉덩이를 키우면 아래쪽이).
    //
    // 그래서 세 점을 **각자 제 배율로 절대 좌표에 놓고** 그 사이를 곡선으로 잇는다.
    // 세 점 모두 **세로 접선**이라 어느 배율을 움직여도 이음매가 꺾이지 않는다:
    //   · 허리(WY)      실루엣의 가장 좁은 곳 — 몸통 옆선도 여기서 세로로 들어온다
    //   · 엉덩이(HY)    가장 넓은 곳. **중력으로 처져서** hipY 보다 아래에 온다
    //   · 허벅지(BY)    허벅지 바깥 변에 세로로 내려꽂아 그대로 다리로 이어진다.
    //                   **바깥 변보다 1px 안쪽**이라 그 아래는 허벅지 제 옆선이 이어받는다
    //                   (딱 맞추면 1px 턱이 져서 **가느다란 선**으로 보인다)
    // 제어점의 높이는 구간 길이의 45% 다 — 비율이라 구간이 길어지면 봉우리도 같이 둥글어진다.
    const WY = B.waistY, HB = B.hipBottom;
    const HY = hipApexY(tune), BY = hipBlendY(tune);
    const wRa = +(100 + wh * kb).toFixed(2), wLa = +(200 - wRa).toFixed(2);
    const tRa = +(100 + thighJoin(tune)).toFixed(2), tLa = +(200 - tRa).toFixed(2);
    const hRa = +(100 + hipHalf(tune)).toFixed(2), hLa = +(200 - hRa).toFixed(2);
    const ha = +((HY - WY) * 0.45).toFixed(1), hb = +((BY - HY) * 0.45).toFixed(1);
    // 몸통 옆선이 허리로 좁아지는 곡선. 제어점을 어깨(133)~허리 사이의 **비율**로 잡아,
    // waistY 를 올리고 내려도 곡선 모양이 그대로 따라오게 한다.
    // 마지막 제어점의 x 는 **허리와 같다** — 그래야 허리에서 접선이 세로가 되어
    // 엉덩이 곡선과 꺾이지 않고 이어진다. 예전에는 `wR + 3` 이라 몸통이 안쪽으로
    // 기울어 들어오는데 엉덩이는 바깥으로 나가, 허리에 40°짜리 꺾임이 있었다
    // 어깨 곡선 — 오른쪽 반은 그대로, 왼쪽 반은 x 를 100 기준으로 뒤집어 쓴다.
    // **팔보다 튀어나오지 않게 좁힌다** (shoulderSquash 참고). f=1 이면 그대로다
    const f = shoulderSquash(tune);
    const sc = B.shoulderC.map(pt => [sqx(pt[0], f), pt[1]]);
    const shR = sqx(B.torsoR, f), shL = sqx(B.torsoL, f);
    const mir = (pt) => [200 - pt[0], pt[1]];
    const cy1 = +(133 + (B.waistY - 133) * 0.46).toFixed(1);
    const cy2 = +(133 + (B.waistY - 133) * 0.68).toFixed(1);
    // 목이 벌어져도 좋은 한계 = 몸통의 어깨 끝(절대 좌표).
    // 몸통은 kb 로 늘어나지만 목은 그 그룹 밖이라 여기서 직접 환산해 넘긴다
    const tipAbs = 100 + (shR - 100) * kb;
    return `
      ${neckShape(uid, neck.top, neck.half, tipAbs)}
      <g data-part="hip">
        <path d="M${wLa},${WY}
          C${wLa},${WY + ha} ${hLa},${HY - ha} ${hLa},${HY}
          C${hLa},${HY + hb} ${tLa},${BY - hb} ${tLa},${BY}
          L${tLa},${HB}
          L${tRa},${HB}
          L${tRa},${BY}
          C${tRa},${BY - hb} ${hRa},${HY + hb} ${hRa},${HY}
          C${hRa},${HY - ha} ${wRa},${WY + ha} ${wRa},${WY} Z" fill="${SKIN}"/>
      </g>
      <g data-part="torso">
        <g${sx(kb, 100)}><path d="M100,${B.torsoTopY}
          C${sc[0][0]},${sc[0][1]} ${sc[1][0]},${sc[1][1]} ${sc[2][0]},${sc[2][1]}
          C${shR},${cy1} ${wR},${cy2} ${wR},${B.waistY}
          L${wL},${B.waistY}
          C${wL},${cy2} ${shL},${cy1} ${shL},133
          C${mir(sc[1])[0]},${sc[1][1]} ${mir(sc[0])[0]},${sc[0][1]} 100,${B.torsoTopY} Z" fill="${SKIN}"/></g>
      </g>
      <g data-part="arm">
        ${armShape('L', SKIN, 0, BODY.armH, tune)}
        ${armShape('R', SKIN, 0, BODY.armH, tune)}
      </g>`;
  }

  // 얼굴(피부) + 귀 + 표정
  function faceAndExpression(expItem) {
    const kind = (expItem && expItem.kind) || 'smile';
    const EYE = '#4a3a42', LIP = '#c97b86';
    let eyes, mouth;
    switch (kind) {
      case 'wink':
        eyes = `<ellipse cx="87" cy="75" rx="5" ry="6.5" fill="${EYE}"/><circle cx="88.7" cy="72.4" r="1.7" fill="#fff"/>
          <path d="M108,76 Q113,71 118,76" stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M94,89 Q100,94 106,89" stroke="${LIP}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
        break;
      case 'happy':
        eyes = `<path d="M82,77 Q87,71 92,77" stroke="${EYE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
          <path d="M108,77 Q113,71 118,77" stroke="${EYE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M92,88 Q100,98 108,88 Z" fill="#e98a9a"/><path d="M92,88 Q100,98 108,88" stroke="${LIP}" stroke-width="2" fill="none"/>`;
        break;
      case 'surprise':
        eyes = `<circle cx="87" cy="75" r="6" fill="${EYE}"/><circle cx="89" cy="72.5" r="2" fill="#fff"/>
          <circle cx="113" cy="75" r="6" fill="${EYE}"/><circle cx="115" cy="72.5" r="2" fill="#fff"/>`;
        mouth = `<ellipse cx="100" cy="91" rx="3.6" ry="4.6" fill="#b5566a"/>`;
        break;
      case 'puzzled':
        // 어리둥절 — 큰 동그란 눈에 작게 벌린 입. 튜토리얼 직후의 얼굴이다
        eyes = `<ellipse cx="87" cy="74" rx="7" ry="8" fill="${EYE}"/><ellipse cx="113" cy="74" rx="7" ry="8" fill="${EYE}"/>
          <circle cx="89.5" cy="70.5" r="2.6" fill="#fff"/><circle cx="115.5" cy="70.5" r="2.6" fill="#fff"/>
          <circle cx="84.5" cy="77.5" r="1.2" fill="#fff" opacity="0.7"/><circle cx="110.5" cy="77.5" r="1.2" fill="#fff" opacity="0.7"/>`;
        mouth = `<ellipse cx="100" cy="90" rx="3.2" ry="3.8" fill="#b5566a"/>`;
        // 머리 위 물음표 대신 **작게 기울인 눈썹** — 이모지를 얹으면 헤어에 가린다
        extra = `<g stroke="${EYE}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55">
            <path d="M80,63 L94,60"/><path d="M120,63 L106,60"/>
          </g>`;
        break;
      case 'cool':
        eyes = `<path d="M81,76 L93,75" stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M107,75 L119,76" stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M95,90 L105,90" stroke="${LIP}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
        break;
      default: // smile
        eyes = `<ellipse cx="87" cy="75" rx="5" ry="6.5" fill="${EYE}"/><ellipse cx="113" cy="75" rx="5" ry="6.5" fill="${EYE}"/>
          <circle cx="88.7" cy="72.4" r="1.7" fill="#fff"/><circle cx="114.7" cy="72.4" r="1.7" fill="#fff"/>`;
        mouth = `<path d="M94,89 Q100,94 106,89" stroke="${LIP}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    // '얼굴' 배율은 build() 의 H() 에서 머리 전체에 걸린다 (여기서 또 걸면 두 번 적용된다)
    return `
      <g data-part="head">
        <ellipse cx="100" cy="70" rx="33" ry="35" fill="${SKIN}"/>
        <ellipse cx="67" cy="76" rx="6" ry="9" fill="${SKIN}"/>
        <ellipse cx="133" cy="76" rx="6" ry="9" fill="${SKIN}"/>
        <ellipse cx="77" cy="86" rx="6" ry="4" fill="#ffb0c4" opacity="0.7"/>
        <ellipse cx="123" cy="86" rx="6" ry="4" fill="#ffb0c4" opacity="0.7"/>
        ${eyes}
        ${mouth}
      </g>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  헤어 (스타일 + 컬러)
  // ═══════════════════════════════════════════════════════════════
  // ─── 헤어 = 뒷머리 실루엣 × 앞머리 ───────────────────────────
  // 옷이 소매·넥라인으로 갈리듯, 머리는 이 두 축으로 갈린다.
  // 벌을 늘려도 여기 함수는 그대로다 — 데이터가 축 값만 바꿔 넣는다.
  function hairBack(kind, c) {
    const s = shade(c, 22);
    const crown = `<ellipse cx="100" cy="63" rx="40" ry="42" fill="${c}"/>`;
    switch (kind) {
      case 'bun':   // 올림머리 — 정수리 뒤로 묶은 덩어리
        return crown +
          `<ellipse cx="100" cy="27" rx="17" ry="14" fill="${c}"/>
           <ellipse cx="100" cy="27" rx="17" ry="14" fill="none" stroke="${s}" stroke-width="1.6"/>
           <path d="M74,44 Q100,34 126,44" stroke="${s}" stroke-width="2" fill="none"/>`;
      case 'bob':
        return crown +
          `<path d="M62,66 C58,92 62,110 75,112 C68,96 68,82 72,72 Z" fill="${c}"/>
           <path d="M138,66 C142,92 138,110 125,112 C132,96 132,82 128,72 Z" fill="${c}"/>`;
      case 'twin':
        return crown +
          `<ellipse cx="52" cy="132" rx="13" ry="36" fill="${c}" transform="rotate(10 52 132)"/>
           <ellipse cx="148" cy="132" rx="13" ry="36" fill="${c}" transform="rotate(-10 148 132)"/>
           <circle cx="64" cy="92" r="5.5" fill="${s}"/><circle cx="136" cy="92" r="5.5" fill="${s}"/>`;
      case 'ponytail':
        return crown +
          `<path d="M128,72 C154,92 152,150 138,182 C132,150 120,108 120,86 Z" fill="${c}"/>
           <circle cx="126" cy="78" r="5.5" fill="${s}"/>`;
      case 'wave':
        return crown +
          `<path d="M58,70 C48,100 68,120 54,152 C72,142 66,108 74,80 Z" fill="${c}"/>
           <path d="M142,70 C152,100 132,120 146,152 C128,142 134,108 126,80 Z" fill="${c}"/>`;
      default: // long
        return crown +
          `<path d="M61,66 C56,104 60,152 75,153 C66,120 66,92 72,72 Z" fill="${c}"/>
           <path d="M139,66 C144,104 140,152 125,153 C134,120 134,92 128,72 Z" fill="${c}"/>`;
    }
  }

  // 앞머리. 'wave' 는 옛 이름 — 사이드뱅과 같은 모양이라 그쪽으로 넘긴다
  function hairFront(kind, c) {
    switch (kind) {
      case 'wave':
      case 'side':        // 사이드뱅 — 한쪽으로 비스듬히 넘긴 가르마.
        // **바깥 윤곽(위쪽)은 일자뱅과 같게 둔다.** 예전에는 위가 y42 까지밖에 안 올라와
        // 얼굴 타원 꼭대기(y35)를 못 덮었고, 정수리에 살색이 그대로 드러났다.
        // 사이드뱅답게 보이는 것은 **아래쪽 가장자리의 사선**이 맡는다
        return `<path d="M68,60 C66,38 78,30 100,30 C122,30 134,38 132,60
            C131,50 126,45 118,46 C104,48 92,56 82,58 C75,59 70,56 68,60 Z" fill="${c}"/>`;
      case 'curtain':     // 커튼뱅 — 가운데를 열고 양옆으로 갈라 내린다.
        // 가르마는 **헤어라인 근처(y50)에서** 열어야 한다. 예전에는 y40 에서 갈라져
        // 정수리가 벌어져 보였다 (커튼이 아니라 가르마가 벗겨진 모양)
        return `<path d="M68,60 C66,38 78,30 100,30 C122,30 134,38 132,60
            C130,50 122,46 108,50 C104,56 101,62 100,70
            C99,62 96,56 92,50 C78,46 70,50 68,60 Z" fill="${c}"/>`;
      case 'sheer':       // 시스루뱅 — 성긴 잔머리 사이로 이마가 비친다.
        // **반투명한 면을 깔지 않는다.** 예전에는 앞머리 전체를 opacity 0.4 로 덮었는데,
        // 그 아래 살색과 섞여 이마에 **가로 띠**가 생겼다 — 시스루가 아니라 머리띠로 보였다.
        // 가닥을 따로 그리는 것도 안 됐다: 빗살처럼 규칙적이고, 가닥이 없는 양옆에는
        // 캡의 밑선이 직선으로 남았다.
        // 지금은 **한 겹의 밑단을 톱니로** 판다 — 파인 곳으로 살이 비치고 밑선이 사라진다.
        return `<path d="M68,57 C66,37 78,29 100,29 C122,29 134,37 132,57
            Q127.5,36 123,57 Q118.5,36 114,57 Q109.5,36 105,57 Q100.5,36 96,57
            Q91.5,36 87,57 Q82.5,36 78,57 Q73,36 68,57 Z" fill="${c}"/>`;
      case 'none':        // 이마 노출 — 앞머리 없이 뒤로 넘긴다
        return `<path d="M68,58 C68,38 80,30 100,30 C120,30 132,38 132,58
            C128,46 116,42 100,42 C84,42 72,46 68,58 Z" fill="${c}"/>`;
      default:            // 일자뱅 (스트레이트)
        return `<path d="M68,60 C66,38 78,30 100,30 C122,30 134,38 132,60
          C126,52 116,50 108,58 C104,50 96,50 92,58 C84,50 74,52 68,60 Z" fill="${c}"/>`;
    }
  }

  // 옷장 칸에 쓰는 작은 머리 그림. 30종에 겹치지 않는 이모지가 없어서,
  // **실루엣을 그대로 축소해서** 무엇인지 보이게 한다.
  // 아바타와 같은 hairBack/hairFront 를 쓰므로 머리 모양을 고치면 아이콘도 같이 바뀐다.
  function hairIcon(it, color, crop) {
    const c = color || HAIR_DEF;
    const back = (it && it.back) || (it && it.kind) || 'long';
    const bang = (it && it.bang) || 'straight';
    // 머리만 잘라 낸다. 꼬리 끝(양갈래 y168 · 포니테일 y182)까지 담으면 세로로 길어져
    // 옷장 칸에서 폭이 24px 밖에 안 나온다 — 앞머리가 구분되지 않았다.
    // 그래서 어깨 높이에서 자른다. 뒷머리 차이는 얼굴 옆 가닥에서 이미 보인다
    //
    // crop:'face' — **앞머리를 고르는 칸용.** 다섯 가지 차이는 전부 이마(y29~60)에 있는데
    // 머리 전체를 담으면 그 띠가 아이콘의 4분의 1로 줄어 사실상 같은 그림이 된다.
    // 이마부터 코까지만 담아 차이가 보이게 확대한다
    const box = crop === 'face' ? '54 18 92 76' : '42 12 116 128';
    return `<svg class="hair-icon" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${hairBack(back, c)}
      <ellipse cx="100" cy="78" rx="30" ry="34" fill="#ffe0cf"/>
      ${hairFront(bang, c)}
    </svg>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  옷 (상의 / 하의 / 원피스)
  // ═══════════════════════════════════════════════════════════════
  // ─── 옷의 공통 축 ─────────────────────────────────────────────
  // 실루엣(path)은 그대로 두고 **소매 길이 · 넥라인 · 단추**만 필드로 갈린다.
  // 이렇게 나눠 두면 새 옷 하나를 늘릴 때 렌더러를 건드릴 일이 없다.

  // 소매가 팔을 덮는 높이(px). BODY.armH 가 94 이므로 long 이 팔 전체다.
  // 소매 길이 — **팔 위 끝(armY)에서 잰다.** armY 를 8 올렸으므로 여기도 8 씩 더해야
  // 소매 밑단의 **절대 높이가 그대로**다 (안 더하면 모든 소매가 8px 씩 짧아진다).
  // long 이 armH 와 같은 값인 것은 「팔 끝까지」라는 뜻이다
  const SLEEVE_H = { none: 0, cap: 28, short: 50, half: 74, long: 102 };
  function sleeveH(it) {
    const v = SLEEVE_H[it && it.sleeve];
    return v == null ? SLEEVE_H.short : v;
  }

  // ─── 넥라인 — **옷을 진짜로 판다** ───────────────────────────
  //
  // 예전에는 선으로만 그렸다. 라운드든 브이든 실루엣은 똑같고 그 위에 곡선 하나를
  // 얹을 뿐이라, 옷을 갈아입어도 목 부분이 하나도 안 변했다.
  // 지금은 몸판의 **윗변 자체**가 넥라인 모양이다.
  //
  // 파도 되는 이유는 **어깨를 안 건드리기 때문**이다. 파는 것은 가운데(±w)뿐이고
  // 어깨끈은 여전히 CLOTH_TOP_Y 에 있어서 몸통 옆·위를 그대로 덮는다.
  // 커버리지 검사는 파인 자리를 빼고 본다 (checkavatar.js) — 민소매의 팔 검사를
  // 건너뛰는 것과 같은 이유다. **파는 폭·깊이는 이 표가 유일한 원본이고,
  // 검사기도 같은 표를 읽는다** — 여기보다 크게 파면 그 바깥에서 살이 잡힌다.
  //   w = 파는 반폭 · d = CLOTH_TOP_Y 에서 내려오는 깊이
  const NECK_CUT = {
    round:  { w: 13, d: 13 },
    v:      { w: 13, d: 26 },
    // 스퀘어는 **넓고 얕다.** 목(x 91~109)보다 조금만 넓게 파면 목이 그대로 이어져
    // 굴뚝처럼 보인다 — 가슴이 양옆으로 보여야 네모로 읽힌다
    square: { w: 18, d: 15 },
    polo:   { w: 0,  d: 0 },    // 목까지 올라온다 — 안 판다
    none:   { w: 0,  d: 0 },
  };
  function neckCut(kind) { return NECK_CUT[kind] || NECK_CUT.round; }

  // 파낸 자리 — 반폭 · 깊이 · **모서리 높이(top)**. 검사기가 이 셋을 그대로 읽는다.
  // top 을 여기서 같이 내주는 이유: 검사기가 몸통 윗선 계산을 따로 하면
  // 두 벌이 되고, 어긋나는 순간 검사가 헛돈다.
  function neckCutBox(kind) {
    const cut = neckCut(kind);
    if (!cut.w || !cut.d) return { w: 0, d: 0, top: 0 };
    return { w: cut.w, d: cut.d, top: +(torsoTopAtX(100 + cut.w) - 1).toFixed(1) };
  }

  // 몸판의 윗변 — 왼쪽 어깨 끝(60,132)에서 오른쪽 어깨 끝(140,132)까지.
  // `M` 부터 돌려주므로 몸판 path 의 맨 앞에 그대로 붙이면 된다.
  //
  // 파는 옷은 어깨끈이 넥라인 가장자리(100±w)에서 **수평 접선**으로 끝난다.
  // 그래야 어깨에서 목으로 넘어가는 곳이 꺾이지 않는다.
  // 파낸 **가운데 부분만.** 왼쪽 모서리(EL,K)에서 시작해 오른쪽 모서리(ER,K)로 간다.
  // 어깨는 옷마다 달라서(공주 드레스는 좁고 높다) 부르는 쪽이 각자 붙인다.
  function neckMid(kind) {
    const T = CLOTH_TOP_Y, cut = neckCut(kind);
    const w = cut.w, B = T + cut.d;
    const EL = 100 - w, ER = 100 + w;
    // 파낸 모서리는 **몸통 윗선 바로 위**에 둔다. 어깨끈처럼 평평하게(T) 두면
    // 모서리 안쪽에 옷도 몸도 없는 자리가 남아 배경이 비친다 — 넓게 파는
    // 스퀘어일수록 심하다 (몸통 윗선은 바깥으로 갈수록 내려간다)
    const K = neckCutBox(kind).top;
    if (kind === 'v') return { K, EL, ER, d: `L100,${B} L${ER},${K}` };
    if (kind === 'square') return { K, EL, ER, d: `L${EL},${B} L${ER},${B} L${ER},${K}` };
    // 라운드 — 대칭 3차 곡선의 한가운데는 (끝점 + 제어점×3) / 4 에 온다.
    // 가운데가 정확히 B 에 닿도록 제어점을 역산한다
    const cy = +((4 * B - K) / 3).toFixed(1);
    return { K, EL, ER, d: `C${EL + 3},${cy} ${ER - 3},${cy} ${ER},${K}` };
  }

  // 옷의 어깨선 — **몸의 어깨 곡선(BODY.shoulderC)을 그대로 따라간다.**
  // 예전에는 `C120,107 140,116 140,132` 이 손으로 박혀 있었다. 몸의 어깨를 넓히자
  // x=127 에서 옷은 y=113.5 인데 몸은 y=109.4 라 **4px 짜리 살색 띠**가 어깨 위에 떴다
  // (터틀넥 30px · 블라우스 2px). 몸을 고치면 옷이 조용히 어긋나던 자리다.
  //
  // 몸보다 바깥으로 SH_PAD, 위로 1px 물러나 있어야 몸이 옷 밖으로 안 나온다.
  const SH_PAD = 4;
  const shC = (i, f) => [sqx(BODY.shoulderC[i][0] + SH_PAD, f), BODY.shoulderC[i][1] - 1];
  const shoulderEndR = f => shC(2, f);
  function clothShoulderR(fromK, f) {
    const [a, b, c] = [shC(0, f), shC(1, f), shC(2, f)];
    // 넥라인을 판 옷은 파낸 모서리(y=fromK)에서 출발하므로 첫 제어점의 높이를 거기 맞춘다
    const y0 = fromK == null ? a[1] : fromK;
    return `C${a[0]},${y0} ${b[0]},${b[1]} ${c[0]},${c[1]}`;
  }
  function clothShoulderL(toK, f) {
    const [a, b] = [shC(0, f), shC(1, f)];
    const y0 = toK == null ? a[1] : toK;
    return `C${200 - b[0]},${b[1]} ${200 - a[0]},${y0} `;
  }
  function clothTopEdge(kind, tune) {
    const T = CLOTH_TOP_Y, cut = neckCut(kind), f = shoulderSquash(tune);
    const e = shoulderEndR(f);
    const startL = `M${200 - e[0]},${e[1]}`;
    // 안 파는 옷 — 가운데가 가장 높은 돔
    if (!cut.w || !cut.d) {
      return `${startL} ${clothShoulderL(null, f)}100,${T} ${clothShoulderR(null, f)}`;
    }
    const m = neckMid(kind);
    return `${startL} ${clothShoulderL(m.K, f)}${m.EL},${m.K} ${m.d} ${clothShoulderR(m.K, f)}`;
  }

  // 넥라인 위에 얹는 것 — 지금은 폴라(터틀넥)의 목 통 하나뿐이다.
  // 나머지는 파낸 모서리 자체가 넥라인이라 덧그릴 선이 없다.
  //   ty = 옷의 목 부분 윗선 y
  function neckLine(kind, c, c2, ty) {
    if (kind !== 'polo') return '';
    return `<rect x="87" y="${ty - 14}" width="26" height="20" rx="8" fill="${c}"/>
      <path d="M89,${ty - 12} L111,${ty - 12}" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`;
  }

  // 앞섶 단추 — 중심선(x=100)에 세로로. 몸통 배율의 축도 100 이라 위치가 안 흔들린다
  function buttons(c2, y0, y1) {
    let s = '';
    for (let y = y0; y <= y1; y += 18) s += `<circle cx="100" cy="${y}" r="2.2" fill="${c2}"/>`;
    return s;
  }

  // 퍼프(어깨 볼륨) — 소매와 같은 팔 좌표를 쓰되 더 넓고 짧게 얹는다
  function puffShoulder(c, tune) {
    return armShape('L', c, 7, 24, tune) + armShape('R', c, 7, 24, tune);
  }

  // 소매는 팔을, 몸판은 몸통을 따라간다
  function renderTop(it, tune) {
    if (isNone(it)) return '';
    const B = BODY, c = it.color, c2 = shade(c);
    const kb = tuneOf(tune, 'torso');   // 소매는 garmentSleeves 가 알아서 팔 배율을 따른다
    const ww = clothWaistHalf(tune);
    const wL = +(100 - ww).toFixed(2), wR = +(100 + ww).toFixed(2);
    // 밑단은 **골반 바로 위**까지 내려온다. 허리(WY)에 맞추면 배가 드러나 전부 크롭탑이 되고,
    // 하의 허리춤(WY 에서 시작)을 덮지 못해 그 사이로 살이 띠처럼 보인다.
    const WY = B.waistY, hem = B.hipY - 2;
    // 옷의 어깨 끝 — 몸과 **같은 자리**여야 한다 (손으로 140/60 을 박아 두면 안 된다)
    const [eR, eY] = shoulderEndR(shoulderSquash(tune)), eL = 200 - eR;
    return `
      ${garmentSleeves(it, tune)}
      ${it.puff ? puffShoulder(c, tune) : ''}
      ${wrapX(`<path data-part="cloth" d="${clothTopEdge(it.neck, tune)}
        C${eR},${WY - 34} ${wR + 4},${WY - 18} ${wR},${WY}
        C${wR},${WY + 10} ${wR - 1},${hem - 8} ${wR - 4},${hem}
        C${wR - 14},${hem + 5} ${wL + 14},${hem + 5} ${wL + 4},${hem}
        C${wL + 1},${hem - 8} ${wL},${WY + 10} ${wL},${WY}
        C${wL - 4},${WY - 18} ${eL},${WY - 34} ${eL},${eY} Z" fill="${c}"/>
      ${neckLine(it.neck, c, c2, 110)}
      ${it.button ? buttons(c2, 132, hem - 14) : ''}`, kb, 100)}`;
  }

  // 하의는 허리(몸통) + 자기가 덮는 다리 파츠를 따라간다.
  // 실루엣은 치마 계열과 바지 계열 둘뿐이고, **기장(hemY)·퍼짐(flare)·벌룬·벨트**는 필드가 정한다.
  function renderBottom(it, tune) {
    if (isNone(it)) return '';
    const B = BODY, c = it.color, c2 = shade(c);
    // 허리춤은 몸의 허리를, 옆선은 **엉덩이**를 따라간다.
    // (엉덩이가 허리보다 넓으므로 허리 폭만 보고 그리면 엉덩이 살이 옷 밖으로 나온다)
    const ww = clothWaistHalf(tune), hh = clothHipHalf(tune);
    const wL = +(100 - ww).toFixed(2), wR = +(100 + ww).toFixed(2);
    const hL = +(100 - hh).toFixed(2), hR = +(100 + hh).toFixed(2);
    const HY = hipApexY(tune), WY = B.waistY;   // 몸의 엉덩이 봉우리를 그대로 따라간다
    const belt = it.belt
      ? `<path d="M${wL},${WY} L${wR},${WY} L${wR + 1},${WY + 14} L${wL - 1},${WY + 14} Z" fill="${c2}"/>` : '';

    if (it.kind === 'skirt') {
      // 밑단은 엉덩이 폭 + flare. 벌룬은 중간이 더 부풀고 밑단이 다시 오므라든다
      const hemY = Number(it.hemY) || 252;
      const flare = Number(it.flare) || 0;
      const hemHalf = hh + (it.balloon ? flare * 0.25 : flare) + 2;
      const midHalf = hh + (it.balloon ? flare + 12 : flare * 0.5) + 2;
      const my = HY + (hemY - HY) * 0.45;      // 옆선이 가장 부푸는 높이
      const bulge = hemHalf * 0.55;            // 밑단 곡선이 아래로 처지는 폭
      // 무릎(259 = 허벅지 끝과 종아리 시작이 겹치는 자리) 아래까지 오는 치마는
      // 종아리까지 덮으므로 종아리 배율도 따라야 한다
      const k = tuneMax(tune, hemY > KNEE_LINE ? ['torso', 'thigh', 'calf'] : ['torso', 'thigh']);
      return wrapX(`<path d="M${wL},${WY} L${wR},${WY}
          C${hR},${WY + 6} ${hR},${HY - 6} ${hR},${HY}
          C${(100 + midHalf).toFixed(1)},${my.toFixed(1)} ${(100 + hemHalf).toFixed(1)},${hemY - 18} ${(100 + hemHalf).toFixed(1)},${hemY}
          C${(100 + bulge).toFixed(1)},${hemY + 14} ${(100 - bulge).toFixed(1)},${hemY + 14} ${(100 - hemHalf).toFixed(1)},${hemY}
          C${(100 - hemHalf).toFixed(1)},${hemY - 18} ${(100 - midHalf).toFixed(1)},${my.toFixed(1)} ${hL},${HY}
          C${hL},${HY - 6} ${hL},${WY + 6} ${wL},${WY} Z" fill="${c}"/>${belt}`, k, 100);
    }

    // 바지 계열 — 반바지도 같은 실루엣이고 기장만 다르다.
    // 가랑이 홈은 엉덩이 아래(hipBottom)에서 시작한다 — 위로 파면 엉덩이 살이 홈으로 드러난다
    const hemY = Math.max(B.hipBottom + 12, Number(it.hemY) || B.ankleY);
    // 옆선은 **몸의 엉덩이 곡선을 그대로 따라간다** — 다리 통 폭만 제 것으로 바꿔 끼운다.
    // 밑단이 곡선보다 위에서 끊기는 옷(반바지)은 **거기서 자른다.** 억지로 밑단까지
    // 다리 폭이 되게 눌러 담으면 하의가 몸보다 가팔라져 그 사이로 엉덩이가 비친다.
    // 다리 폭도 허벅지 배율을 따라간다 — 박아 두면 허벅지를 키웠을 때 그대로 드러난다.
    const legR = +(100 + thighOuter(tune) + CLOTH_PAD + 2).toFixed(2);
    const P = hipSideCurve(tune, hR, legR, hemY - 2);
    const by = P[3][1], bx = P[3][0], bxL = +(200 - bx).toFixed(2);
    const mirC = i => `${(200 - P[i][0]).toFixed(2)},${P[i][1]}`;
    const k = tuneMax(tune, hemY > KNEE_LINE ? ['torso', 'thigh', 'calf'] : ['torso', 'thigh']);
    return wrapX(`<path d="M${wL},${WY} L${wR},${WY}
        C${hR},${WY + 6} ${hR},${HY - 6} ${hR},${HY}
        C${P[1][0]},${P[1][1]} ${P[2][0]},${P[2][1]} ${bx},${by}
        L${bx},${hemY} L107,${hemY} L100,${B.hipBottom + 2} L93,${hemY} L${bxL},${hemY} L${bxL},${by}
        C${mirC(2)} ${mirC(1)} ${hL},${HY}
        C${hL},${HY - 6} ${hL},${WY + 6} ${wL},${WY} Z" fill="${c}"/>${belt}`, k, 100);
  }

  // 소매(팔을 덮는 부분)를 몸의 팔 좌표 그대로 만들어 준다.
  // len: 팔 길이의 몇 %까지 덮을지 (나머지는 손으로 드러남)
  //   yFrom 을 주면 그 높이부터 아래만 그린다 (치마 위에 다시 찍을 때 — armsOverSkirt)
  function sleeves(c, len, tune, yFrom) {
    const B = BODY, pad = CLOTH_PAD;
    const end = B.armY - pad + B.armH * len + pad;   // 소매 끝의 절대 높이
    const from = yFrom == null ? B.armY - pad : yFrom;
    if (end <= from) return '';
    const opt = yFrom == null ? undefined : { yFrom };
    // 손 위치 = 소매 끝. armPoint 가 팔꿈치 굽힘까지 따라간다
    const hL = armPoint('L', B.armH * len, tune), hR = armPoint('R', B.armH * len, tune);
    // 소매만 팔 배율을 따른다. 손은 팔 중심선 위에 있고 그 선은 움직이지 않으므로
    // (좌우 각각 자기 중심을 축으로 늘린다) 그대로 둔다 — 같이 늘리면 손이 타원이 된다.
    return `
      ${armShape('L', c, pad, end - from, tune, opt)}
      ${armShape('R', c, pad, end - from, tune, opt)}
      <circle cx="${hL.x.toFixed(1)}" cy="${hL.y.toFixed(1)}" r="8.5" fill="${SKIN}"/>
      <circle cx="${hR.x.toFixed(1)}" cy="${hR.y.toFixed(1)}" r="8.5" fill="${SKIN}"/>`;
  }

  // 옷의 소매 — **한 곳에서만 만든다.** 하의 위에 다시 찍을 때도 같은 함수를 지나므로
  // 소매 길이·여유를 고치면 두 자리가 같이 따라온다.
  //   yFrom 을 주면 그 높이부터 아래만 그린다
  const SLEEVE_PAD = 2;
  const PRINCESS_LEN = 0.92;                       // 공주 드레스의 긴 소매
  function garmentSleeves(it, tune, yFrom) {
    if (isNone(it)) return '';
    const B = BODY;
    if (it.kind === 'princess') return sleeves(it.color, PRINCESS_LEN, tune, yFrom);
    const sh = sleeveH(it);
    if (!sh) return '';
    const end = B.armY - SLEEVE_PAD + sh;
    const from = yFrom == null ? B.armY - SLEEVE_PAD : yFrom;
    if (end <= from) return '';
    const opt = yFrom == null ? undefined : { yFrom };
    return armShape('L', it.color, SLEEVE_PAD, end - from, tune, opt)
         + armShape('R', it.color, SLEEVE_PAD, end - from, tune, opt);
  }

  // ─── 치마·바지보다 앞에 오는 팔 ──────────────────────────────
  //
  // 팔은 몸통과 같은 층(torsoArms)에 있어 **하의보다 뒤**다. 그런데 치마는 허리에서
  // 아래로 넓게 퍼지므로, 거기 있던 팔뚝과 손이 통째로 치마에 덮인다. 긴 치마에서는
  // 팔이 소매 끝 언저리에서 뚝 끊겨 **겨드랑이에 살색 조각만** 남는다 —
  // 「치마가 팔을 덮는다」와 「겨드랑이에 살색이 튀어나온다」가 같은 원인이다.
  //
  // ⚠️ **팔 전체를 옷 위로 올리면 안 된다.** 어깨에서 맨팔이 민소매 옷의 어깨끈을
  // 덮어 버리고(옷이 아니라 살이 보인다), 커버리지 검사의 몸통 창(x 72~128)에도 걸린다.
  // **허리 아래만 다시 찍는다** — 그 아래에 이미 같은 것이 그려져 있어 이음매가 없다.
  //
  // 공주 드레스만 예외다. 그것은 허리에서 시작하는 치마가 아니라 **어깨에서 바닥까지
  // 내려오는 종**이고, 팔은 그 안에 들어가 있다 (인트로 그림이 그렇다). 앞으로 꺼내면
  // 소매가 드레스와 같은 색이라 **손만 종 위에 동동 뜬 살색 덩어리**로 보인다.
  function armsOverSkirt(tune, wear) {
    const B = BODY, WY = B.waistY;
    if (!isNone(wear) && wear.kind === 'princess') return '';
    const h = B.armY + B.armH - WY;
    if (h <= 0) return '';
    // data-part 를 붙여 둔다 — 검사기가 「팔」을 골라낼 때 이 조각도 같이 잡혀야 한다
    return `<g data-part="arm">${armShape('L', SKIN, 0, h, tune, { yFrom: WY })}`
         + `${armShape('R', SKIN, 0, h, tune, { yFrom: WY })}`
         + `${garmentSleeves(wear, tune, WY)}</g>`;
  }

  // 몸통을 덮고 hemY 까지 퍼지는 드레스 (+ 팔 소매)
  // 어깨가 좁고 높은 드레스(공주 드레스). 넥라인 가운데는 다른 옷과 **같은 것**을 쓰고,
  // 어깨만 자기 것을 붙인다 — neckMid 참고
  function sleevedDress(c, c2, hemY, longSleeve, tune, neck) {
    const B = BODY, pad = CLOTH_PAD;
    // 어깨는 몸통보다 넓게. **몸통과 같이 좁아진다** — 안 그러면 팔을 가늘게 했을 때
    // 드레스의 어깨만 팔 밖으로 튀어나온다 (shoulderSquash 참고)
    const sf = shoulderSquash(tune);
    const L = sqx(B.torsoL - pad, sf), R = sqx(B.torsoR + pad, sf);
    const flare = 21;                                     // 밑단이 퍼지는 정도
    const hemL = L - flare, hemR = R + flare;
    // 몸통부터 다리까지 덮으므로 그중 가장 큰 배율을 따른다
    const kd = tuneMax(tune, ['torso', 'thigh', 'calf']);
    const cut = neck && neckCut(neck).w ? neckMid(neck) : null;
    const top = cut
      ? `C${L},${B.shoulderY} ${cut.EL - 14},${cut.K} ${cut.EL},${cut.K}
         ${cut.d}
         C${cut.ER + 14},${cut.K} ${R},${B.shoulderY} ${R},${B.shoulderY + 11}`
      : `C${L},${B.shoulderY} ${L + 16},${CLOTH_TOP_Y} 100,${CLOTH_TOP_Y}
         C${R - 16},${CLOTH_TOP_Y} ${R},${B.shoulderY} ${R},${B.shoulderY + 11}`;
    // 소매는 **종보다 먼저** 그린다. 뒤에 두면 소매 끝의 손(살색 동그라미)이 종 위에
    // 얹혀, 초록 종 한가운데에 **살색 덩어리 두 개가 동동 뜬 것**처럼 보였다
    // (소매가 드레스와 같은 색이라 팔은 안 보이고 손만 보인다). 공주 드레스는
    // 어깨에서 바닥까지 내려오는 종이고 팔은 그 안에 들어가 있다 — 인트로 그림이 그렇다.
    return `<g data-part="dress">
      ${sleeves(c, longSleeve ? PRINCESS_LEN : 0.42, tune)}
      ${wrapX(`
      <!-- 몸통 → 밑단까지 퍼지는 치마 (어깨 폭은 몸통 기준 + 여유) -->
      <path data-part="cloth" d="M${L},${B.shoulderY + 11}
        ${top}
        C${R + 6},${B.waistY - 18} ${hemR - 5},${hemY - 62} ${hemR},${hemY + 5}
        C${R - 18},${hemY + 15} ${L + 18},${hemY + 15} ${hemL},${hemY + 5}
        C${hemL + 5},${hemY - 62} ${L - 6},${B.waistY - 18} ${L},${B.shoulderY + 11} Z" fill="${c}"/>
      <!-- 허리 라인 -->
      <path d="M${L + 8},${B.waistY} L${R - 8},${B.waistY}" stroke="${c2}" stroke-width="4.5" stroke-linecap="round"/>
      <!-- 밑단 -->
      <path d="M${hemL + 3},${hemY - 8} C${L + 12},${hemY + 2} ${R - 12},${hemY + 2} ${hemR - 3},${hemY - 8}"
            stroke="${c2}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      ${cut ? '' : `<!-- 목선 — 안 파는 경우에만. 파냈으면 그 모서리가 곧 넥라인이다 -->
      <path d="M88,${B.shoulderY} Q100,${B.shoulderY + 9} 112,${B.shoulderY}"
            stroke="${c2}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`}`, kd, 100)}
    </g>`;
  }

  function renderDress(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c);
    const kd = tuneMax(tune, ['torso', 'thigh', 'calf']);   // 몸통~다리를 덮는다

    // 튜토리얼 인트로의 공주 드레스 — 어깨에서 발목까지 내려오는 종 모양 + 소매
    // (인트로 princessFront 의 실루엣을 아바타 좌표계로 옮긴 것)
    if (it.kind === 'princess') {
      return sleevedDress(c, c2, BODY.ankleY, true, tune, it.neck);
    }

    // 기장·퍼짐·넥라인·소매는 전부 아이템 필드다 (없으면 예전 값 그대로)
    const B = BODY;
    const hemY = Number(it.hemY) || (it.kind === 'gown' ? 320 : 270);
    const flare = Number(it.flare) || (it.kind === 'gown' ? 40 : 46);
    // 허리는 몸의 허리를 따라간다 (예전에는 78~122 로 박혀 있어 허리 살이 밖으로 나왔다)
    const ww = clothWaistHalf(tune), hhw = clothHipHalf(tune);
    const WY = B.waistY, HYd = hipApexY(tune);   // 몸의 엉덩이 봉우리를 그대로 따라간다
    const wL = +(100 - ww).toFixed(2), wR = +(100 + ww).toFixed(2);
    const hL = +(100 - hhw).toFixed(2), hR = +(100 + hhw).toFixed(2);
    const [eR, eY] = shoulderEndR(shoulderSquash(tune)), eL = 200 - eR;
    return `
      ${garmentSleeves(it, tune)}
      ${it.puff ? puffShoulder(c, tune) : ''}
      ${wrapX(`<path data-part="cloth" d="${clothTopEdge(it.neck, tune)}
        C${eR},${WY - 34} ${wR + 4},${WY - 18} ${wR},${WY + 2}
        C${hR},${WY + 8} ${hR},${HYd - 6} ${hR},${HYd}
        C${hR},${HYd + 24} ${100 + flare},${hemY - 40} ${100 + flare + 8},${hemY}
        C${wR},${hemY + 14} ${wL},${hemY + 14} ${100 - flare - 8},${hemY}
        C${100 - flare},${hemY - 40} ${hL},${HYd + 24} ${hL},${HYd}
        C${hL},${HYd - 6} ${hL},${WY + 8} ${wL},${WY + 2}
        C${wL - 4},${WY - 18} ${eL},${WY - 34} ${eL},${eY} Z" fill="${c}"/>
      <path d="M${wL},${WY} L${wR},${WY}" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>
      ${neckLine(it.neck, c, c2, 110)}`, kd, 100)}`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  악세사리 (서클렛 / 귀걸이 / 목걸이)
  // ═══════════════════════════════════════════════════════════════
  // ─── 악세사리 = 형태 축 × 장식 축 ────────────────────────────
  // 벌마다 그림을 하나씩 그리지 않는다. 축마다 조각 함수를 하나씩 두고 겹쳐 그린다
  // (옷의 소매·넥라인과 같은 방식). 벌을 늘려도 여기 함수는 그대로다.

  // 장식 조각 — 서클렛·귀걸이·목걸이가 같이 쓴다. cx,cy 에 크기 r 로 얹는다
  function charmShape(kind, cx, cy, r, c) {
    const c2 = shade(c, 30);
    switch (kind) {
      case 'gem':
      case 'drop':
        return `<path d="M${cx},${cy - r * 1.2} C${cx + r},${cy - r * 0.2} ${cx + r * 0.8},${cy + r} ${cx},${cy + r}
          C${cx - r * 0.8},${cy + r} ${cx - r},${cy - r * 0.2} ${cx},${cy - r * 1.2} Z" fill="${c}"/>
          <ellipse cx="${cx - r * 0.3}" cy="${cy}" rx="${r * 0.25}" ry="${r * 0.4}" fill="#fff" opacity="0.55"/>`;
      case 'star':
        return `<path d="${starPath(cx, cy, r * 1.15)}" fill="${c}"/>`;
      case 'heart':
        return `<path d="M${cx},${cy + r} C${cx - r * 1.4},${cy - r * 0.2} ${cx - r * 0.6},${cy - r * 1.2} ${cx},${cy - r * 0.35}
          C${cx + r * 0.6},${cy - r * 1.2} ${cx + r * 1.4},${cy - r * 0.2} ${cx},${cy + r} Z" fill="${c}"/>`;
      case 'flower': {
        const p = [0, 72, 144, 216, 288].map(a =>
          `<circle cx="${(cx + Math.cos(a * Math.PI / 180) * r * 0.8).toFixed(1)}"
             cy="${(cy + Math.sin(a * Math.PI / 180) * r * 0.8).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${c}"/>`).join('');
        return p + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.4).toFixed(1)}" fill="#fff3b0"/>`;
      }
      case 'ribbon':
        return `<path d="M${cx - r * 1.5},${cy - r * 0.7} L${cx},${cy} L${cx - r * 1.5},${cy + r * 0.7} Z" fill="${c}"/>
          <path d="M${cx + r * 1.5},${cy - r * 0.7} L${cx},${cy} L${cx + r * 1.5},${cy + r * 0.7} Z" fill="${c}"/>
          <circle cx="${cx}" cy="${cy}" r="${(r * 0.42).toFixed(1)}" fill="${c2}"/>`;
      case 'none':
        return '';
      default:   // circle — 동그란 알
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>
          <circle cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.3).toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="#fff" opacity="0.55"/>`;
    }
  }

  // 서클렛 = 머리띠(band) × 가운데 장식(orn)
  function renderCirclet(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a', c2 = shade(c, 34);
    const band = it.band || (it.kind === 'tiara' ? 'crown' : 'arch');
    const orn = it.orn || (it.kind === 'flower' ? 'flower' : it.kind === 'tiara' ? 'gem' : 'ribbon');
    let s = '';
    if (band === 'crown') {            // 왕관 톱니
      s = `<path d="M72,55 L82,43 L91,52 L100,38 L109,52 L118,43 L128,55 Z"
        fill="${c}" stroke="${c2}" stroke-width="1.5" stroke-linejoin="round"/>`;
    } else if (band === 'wide') {      // 넓은 밴드
      s = `<path d="M68,56 Q100,40 132,56 L132,62 Q100,47 68,62 Z" fill="${c}"/>`;
    } else if (band === 'chain') {     // 체인 — 알을 늘어놓은 띠
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, x = 70 + t * 60, y = 55 - Math.sin(t * Math.PI) * 12;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1" fill="${c}"/>`;
      }
    } else {                           // 가는 아치
      s = `<path d="M69,54 Q100,42 131,54" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }
    // 장식은 띠 한가운데 위에. 왕관은 톱니 꼭대기가 이미 높아 조금 더 위로 얹는다
    return s + charmShape(orn, 100, band === 'crown' ? 45 : 46, 4.6, c);
  }

  // 귀걸이 = 거는 형태(form) × 매다는 장식(charm). 양쪽 귀(x 66 / 134)에 같은 것을 단다
  function renderEarring(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a';
    const form = it.form || (it.kind === 'hoop' ? 'hoop' : it.kind === 'star' ? 'stud' : 'drop');
    const charm = it.charm || (it.kind === 'hoop' ? 'circle' : it.kind === 'star' ? 'star' : 'drop');
    const one = (x) => {
      const pin = `<circle cx="${x}" cy="83" r="1.8" fill="${c}"/>`;   // 귓불 고정 알
      switch (form) {
        case 'stud':                                   // 스터드 — 귓불에 딱 붙는다
          return charmShape(charm, x, 85, 3.6, c);
        case 'hoop':                                   // 링 — 고리 아래에 장식
          return pin + `<circle cx="${x}" cy="89" r="5" fill="none" stroke="${c}" stroke-width="2.4"/>`
            + charmShape(charm, x, 94.5, 2.6, c);
        case 'chain':                                  // 체인 — 가늘고 길게 늘어뜨린다
          return pin + `<path d="M${x},85 L${x},96" stroke="${c}" stroke-width="1.4"/>`
            + charmShape(charm, x, 99, 3.4, c);
        case 'cluster':                                // 뭉치 — 작은 장식 셋
          return pin + charmShape(charm, x - 3, 90, 2.4, c) + charmShape(charm, x + 3, 90, 2.4, c)
            + charmShape(charm, x, 95, 2.8, c);
        case 'cuff':                                   // 이어커프 — 귀 위쪽을 감싼다
          return `<path d="M${x - 1},80 Q${x + (x < 100 ? -5 : 5)},85 ${x - 1},90"
              stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
            + charmShape(charm, x, 85, 2.4, c);
        default:                                       // 드롭 — 짧게 늘어뜨린다
          return pin + charmShape(charm, x, 90, 4, c);
      }
    };
    return one(66) + one(134);
  }

  // 목걸이 = 줄(chain) × 펜던트(pend)
  function renderNecklace(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a', c2 = shade(c, 18);
    const chain = it.chain || (it.kind === 'choker' ? 'choker' : it.kind === 'pearl' ? 'pearl' : 'short');
    const pend = it.pend || (it.kind === 'pendant' ? 'circle' : 'none');
    // 줄마다 목 아래로 내려오는 깊이가 다르다. 펜던트는 그 끝에 매달린다
    const DEPTH = { choker: 8, short: 16, long: 28, pearl: 14, double: 22, ribbon: 12 };
    const dy = DEPTH[chain] || 16;
    const arc = (d, w, col) => `<path d="M85,113 Q100,${113 + d} 115,113" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    let s = '';
    if (chain === 'pearl') {                     // 알줄 — 구슬을 늘어놓는다
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        s += `<circle cx="${(83 + t * 34).toFixed(1)}" cy="${(116 + Math.sin(t * Math.PI) * 11).toFixed(1)}"
          r="2.4" fill="${c}" stroke="${c2}" stroke-width="0.5"/>`;
      }
    } else if (chain === 'double') {             // 이중 줄
      s = arc(14, 2, c) + arc(26, 2, c);
    } else if (chain === 'ribbon') {             // 리본 끈 — 굵은 띠에 리본 매듭
      s = arc(11, 4.5, c) + charmShape('ribbon', 100, 120, 3.4, c);
    } else if (chain === 'choker') {
      s = arc(8, 4, c);
    } else {
      s = arc(dy - 4, 2, c);
    }
    return s + charmShape(pend, 100, 113 + dy + 3, 4.6, c);
  }

  // ═══════════════════════════════════════════════════════════════
  //  문신 (얼굴/볼 — 헤어·옷에 가리지 않는 위치)
  // ═══════════════════════════════════════════════════════════════
  function renderTattoo(it) {
    if (isNone(it)) return '';
    const c = it.color || '#c98bd6';
    switch (it.kind) {
      case 'star':
        return `<path d="${starPath(120, 90, 3.4)}" fill="${c}"/>`;
      case 'tear':
        return `<path d="M80,84 L77.6,90 L82.4,90 Z" fill="${c}"/><circle cx="80" cy="90" r="2.5" fill="${c}"/>`;
      case 'heart':
        return `<path d="M120,88 q-2.7,-2.7 -4.3,0 q-1.5,2.6 4.3,6.2 q5.8,-3.6 4.3,-6.2 q-1.6,-2.7 -4.3,0 Z" fill="${c}"/>`;
      case 'rune':
        return `<path d="M114,85 L124,85 M119,85 L119,94 M119,94 L123,97" stroke="${c}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
      default:
        return `<circle cx="120" cy="90" r="2.6" fill="${c}"/>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  조립
  // ═══════════════════════════════════════════════════════════════
  // body: 체형 0(날씬) ~ 1(튜토리얼 인트로의 통통한 공주). 기본 0.
  // 몸통/팔다리와 '옷'을 같은 그룹으로 함께 늘려서 옷이 몸에서 어긋나지 않게 한다.
  // SVG 의 id 는 **문서 전체에서 공유된다.** 아바타를 두 개 이상 한 화면에 그리면
  // 뒤에 온 쪽이 앞 쪽의 그라디언트를 써 버린다 (roomScene 과 같은 이유). 그래서
  // 부를 때마다 꼬리표를 붙인다. build 와 crouchBack 이 같이 쓴다 —
  // **두 함수보다 위에 있어야 한다** (let 은 끌어올려지지 않는다)
  let avatarUid = 0;

  // ─── 웅크려 먹는 뒷모습 — 「혼자 먹은 밤」 컷씬 ─────────────
  //
  // **지금 그 캐릭터의 뒷모습이다.** 머리 모양·머리색·옷 색·체형을 다 따라간다 —
  // 다른 그림을 하나 더 그리면 「내 공주」가 아니라 삽화가 되어 버린다.
  // 뒷머리(hairBack)는 원래 뒤통수를 그리는 함수라 **그대로** 쓴다.
  //
  // 얼굴은 안 그린다. 그게 이 장면의 전부다 — 등을 돌리고 있다.
  function crouchBack(outfit, body, foodEmoji) {
    const w = Math.max(0, Math.min(1, Number(body) || 0));   // 1 = 통통
    const o = outfit || {};
    const col = (o.colors || {});
    const it = (slot) => getItem(slot, o[slot]);
    // 옷 색 — 원피스가 있으면 그것, 없으면 상의. 아무것도 없으면 살색(속옷 아님, 맨몸)
    const dress = it('dress'), top = it('top');
    const cloth = (!isNone(dress) && (col.dress || dress.color))
      || (!isNone(top) && (col.top || top.color)) || SKIN;
    const clothSh = shade(cloth, 16);
    const hairItem = it('hair');
    const hairC = col.hair || hairItem.color || HAIR_DEF;
    const backKind = hairItem.back || (hairItem.kind === 'none' ? 'long' : hairItem.kind);
    // 무릎 색 — **다리를 덮는 옷이면 옷 색이다.** 예전에는 늘 살색이라, 발목까지 오는
    // 공주 드레스를 입고도 무릎만 맨살 덩어리로 옆에 삐져나와 있었다.
    // 서 있을 때 무릎은 y≈278 근처다 (엉덩이 아래 214 ~ 발목 331 의 가운데).
    // 그보다 아래로 내려오는 밑단이면 무릎을 덮는다. `hemY` 가 없는 것(공주 드레스)은
    // 바닥까지 오는 옷이라 덮는 쪽으로 친다.
    // (허리를 올리면서 다리가 올라온 만큼 285 → 278 로 같이 옮겼다)
    const KNEE_Y = 278;
    const legSlot = !isNone(dress) ? 'dress' : 'bottom';
    const legWear = legSlot === 'dress' ? dress : it('bottom');
    const legHem = isNone(legWear) ? null : (Number(legWear.hemY) || 999);
    const legC = isNone(legWear) ? null : (col[legSlot] || legWear.color);
    const kneeCovered = legHem !== null && legHem >= KNEE_Y && !!legC;
    const kneeC = kneeCovered ? legC : SKIN;
    const kneeSh = shade(kneeC, kneeCovered ? 16 : 10);
    // 신발 — **모양까지 따라간다.** 색만 바꾸면 유리구두를 신고도 맨발과 같은 모양이라,
    // 「신발이 안 그려진다」로 읽힌다. 뒤에서 보이는 것은 **뒤꿈치**이므로
    // 목(rise)과 마감(finish) 두 축을 그대로 쓴다 (renderShoes 와 같은 필드)
    const shoes = it('shoes');
    const bare = isNone(shoes);
    const shoeC = (!bare && (col.shoes || shoes.color)) || SKIN;
    const shoeSh = shade(shoeC, 22);
    const rise = bare ? 0 : (Number(shoes.rise) || 0);
    const fin = bare ? 'plain' : (shoes.finish || 'plain');
    // 뒤꿈치 한 짝. 앉아 있으므로 발목이 위로 조금 올라온다
    const heel = (cx) => {
      let g = '';
      if (rise > 0) g += `<rect x="${cx - 11}" y="${210 - rise}" width="22" height="${rise + 6}" rx="6" fill="${shoeC}"/>`;
      g += `<ellipse cx="${cx}" cy="214" rx="15" ry="9" fill="${shoeC}"/>`;
      if (fin === 'sole')       g += `<ellipse cx="${cx}" cy="218" rx="15" ry="3.6" fill="${shoeSh}"/>`;
      else if (fin === 'strap') g += `<path d="M${cx - 11},209 L${cx + 11},209" stroke="${shoeSh}" stroke-width="2.4" stroke-linecap="round"/>`;
      else if (fin === 'ribbon') g += `<path d="M${cx - 8},208 Q${cx},213 ${cx + 8},208" stroke="${shoeSh}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
        + `<circle cx="${cx}" cy="208" r="2.4" fill="${shoeSh}"/>`;
      else if (fin === 'gloss') g += `<ellipse cx="${cx - 4}" cy="211" rx="6" ry="2.8" fill="#fff" opacity="0.75"/>`;
      if (rise > 0) g += `<path d="M${cx - 11},${210 - rise + 6} L${cx + 11},${210 - rise + 6}" stroke="${shoeSh}" stroke-width="2.2" stroke-linecap="round"/>`;
      // 맨발이면 뒤꿈치에 그늘을 하나 — 안 그러면 살색 덩어리가 두 개 붙은 것으로 보인다
      if (bare) g += `<ellipse cx="${cx}" cy="217" rx="11" ry="4" fill="${SKIN_SH}"/>`;
      return g;
    };

    // 통통할수록 등이 넓어진다. 가로만 늘린다 — 앉은 키는 그대로다
    const k = 1 + 0.22 * w;
    const kS = k.toFixed(3);
    // 웅크린 등의 실루엣. 색을 두 가지로 나눠 칠하려면 같은 모양을 clip 으로도 써야 해서
    // 한 곳에만 적어 둔다 — 두 벌로 두면 한쪽만 고쳐 놓고 못 알아챈다
    const BACK_D = 'M70,116 C60,144 54,176 54,200 C72,214 128,214 146,200'
      + ' C146,176 140,144 130,116 C118,106 82,106 70,116 Z';
    const SKIRT_Y = 166;                       // 허리 — 여기부터 아래가 치마다
    const twoTone = legSlot === 'bottom' && kneeCovered && legC !== cloth;
    // SVG 의 id 는 문서 전체에서 공유된다 — 옷장 미리보기처럼 여럿을 한 화면에 그리면
    // 뒤에 온 것이 앞의 clip 을 덮어쓴다 (roomScene·build 와 같은 이유)
    const uid = 'c' + (++avatarUid);

    return `<svg class="cb-svg" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="">
      ${twoTone ? `<defs><clipPath id="cbb_${uid}"><path d="${BACK_D}"/></clipPath></defs>` : ''}
      <!-- 그림자도 같이 눌린다. 몸만 움직이면 바닥에서 뜬 것처럼 보인다 -->
      <ellipse class="cb-shadow" cx="100" cy="226"
        rx="${(66 * (1 + 0.15 * w)).toFixed(1)}" ry="10" fill="rgba(20,10,25,0.28)"/>

      <g transform="translate(100,0) scale(${kS},1) translate(-100,0)">
        <!-- 씹는 박자에 몸 전체가 아주 살짝 눌렸다 편다 (스쿼시 & 스트레치).
             **바깥 그룹의 체형 배율과 겹치면 안 되므로** 한 겹 안에서 따로 움직인다 —
             CSS transform 은 SVG transform 속성을 덮어쓴다 -->
        <g class="cb-body">
          <!-- 발 — 등 뒤에서는 발끝이 아니라 **뒤꿈치**가 보인다 -->
          ${heel(76)}${heel(124)}

          <!-- 무릎 — 쭈그리면 좌우로 벌어져 등 옆으로 삐져나온다.
               **살짝만 내민다.** 예전에는 엉덩이 높이에서 발보다 넓게 튀어나와,
               다리라기보다 옆에 놓인 살색 덩어리로 보였다.
               색은 입은 옷을 따라간다 — 긴 치마 아래로 맨무릎이 나오면 안 된다 -->
          <ellipse data-part="knee" cx="60" cy="193" rx="15" ry="16" fill="${kneeC}"
            stroke="${kneeSh}" stroke-width="1.6"/>
          <ellipse data-part="knee" cx="140" cy="193" rx="15" ry="16" fill="${kneeC}"
            stroke="${kneeSh}" stroke-width="1.6"/>

          <!-- 등 — 어깨에서 엉덩이로 퍼지는 웅크린 덩어리 -->
          <path d="${BACK_D}" fill="${cloth}"/>
          <!-- 상의와 치마를 따로 입었으면 **아랫도리는 치마 색**이다.
               한 색으로 칠하면 몸통은 상의 색인데 무릎만 치마 색이 되어,
               민트 치마에 분홍 몸통 + 민트 무릎이라는 이상한 그림이 나온다.
               실루엣을 clip 으로 잘라 쓰므로 옷 모양을 다시 그릴 필요가 없다 -->
          ${twoTone ? `<rect clip-path="url(#cbb_${uid})" x="40" y="${SKIRT_Y}" width="120" height="80" fill="${legC}"/>` : ''}
          <!-- 등 한가운데 접힌 자국 하나. 없으면 그냥 색 덩어리로 보인다 -->
          <path d="M100,126 C97,152 97,178 100,198" stroke="${clothSh}" stroke-width="2.4"
            fill="none" stroke-linecap="round" opacity="0.7"/>

          <!-- 왼팔 — 앞으로 안고 있어서 팔꿈치만 등 옆으로 삐져나온다.
               등과 같은 색이라 옆선을 그늘로 잡아 줘야 팔로 읽힌다.
               **회전축은 어깨**다. 팔꿈치를 축으로 돌리면 어깨가 빠져 보인다.
               (오른팔은 음식을 들고 있어서 아래 .cb-bite 가 따로 그린다) -->
          <g class="cb-arm cb-arm-l">
            <ellipse cx="56" cy="154" rx="12" ry="20" fill="${cloth}"
              stroke="${clothSh}" stroke-width="1.6" transform="rotate(-12 56 154)"/>
          </g>

          <!-- 목덜미 (머리에 거의 가린다) -->
          <rect x="88" y="100" width="24" height="20" rx="9" fill="${SKIN_SH}"/>
        </g>
      </g>

      <!-- 오른팔 — 음식을 들고 입으로 가져가는 팔. **머리보다 먼저 그린다.**
           뒤에서 보고 있으니 손은 얼굴 쪽(저쪽 편)에 있고, 뒤통수가 팔을 가려야 맞다.
           머리 위에 그렸더니 팔이 머리를 가로질러 앞으로 넘어와 보였다.
           그러면서도 손과 음식은 **머리 옆으로 비켜나** 있어서 가려지지 않는다 —
           엄밀히는 얼굴 뒤에 숨어야 하지만, 그러면 무엇을 하는 장면인지 안 읽힌다.

           **밑동은 어깨다.** 예전에는 y=168(엉덩이 높이)에서 시작해서, 팔이 허리 뒤에서
           돋아난 것처럼 보였다 — 팔꿈치 덩어리보다도 아래였다.
           어깨(위) → 팔꿈치(아래 바깥) → 손목(위) 의 꺾인 선 하나로 그린다.

           가로는 k 를 따라가되 손과 음식은 그 자리에 놓기만 한다 —
           이모지가 가로로 늘어나면 안 되기 때문이다 -->
      ${(() => {
        const sx = (100 + 33 * k).toFixed(1);   // 어깨 — 등 실루엣의 오른쪽 끝
        const ex = (100 + 47 * k).toFixed(1);   // 팔꿈치 — 등 옆으로 조금 나온다
        const wx = (100 + 43 * k).toFixed(1);   // 손목
        const arm = `M${sx},128 L${ex},157 L${wx},126`;
        const hx = Number(wx), fx = hx + 9;
        return `<g class="cb-bite">
        <!-- 그늘을 **한 번 더 굵게 깔아** 테두리를 만든다. 같은 굵기로 덧칠하면
             전체가 어두워질 뿐이고, 몸통과 한 색으로 붙어 버린다 -->
        <path d="${arm}" stroke="${clothSh}" stroke-width="17.6" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${arm}" stroke="${cloth}" stroke-width="15" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${hx}" cy="120" r="9.5" fill="${SKIN}"/>
        ${foodEmoji ? `<text class="cb-food" x="${fx}" y="114" font-size="28" text-anchor="middle">${foodEmoji}</text>` : ''}
      </g>`;
      })()}

      <!-- 머리 — 고개를 숙이고 우적우적. **뒷머리 함수를 그대로 쓴다**.
           우적우적은 CSS 로 흔든다 (.cb-head) — 무한 반복이라 검증기가 건드리지 않는다 -->
      <g transform="translate(0,26)">
        <g class="cb-head">
          <g transform="rotate(-3 100 105)">
            <ellipse cx="100" cy="70" rx="33" ry="35" fill="${SKIN}"/>
            ${hairBack(backKind, hairC)}
          </g>
        </g>
      </g>

      <!-- 「우적」 — 씹을 때마다 머리 옆에서 톡 터지는 효과선. 애니메이션의 박자를 눈으로
           보여 주는 것이라, 이게 없으면 고개만 까딱이는 것으로 보인다.
           오른쪽은 **든 손을 피해 위로** 뺀다 -->
      <g class="cb-spark cb-spark-l" fill="none" stroke="rgba(120,90,70,0.6)" stroke-width="2.4"
        stroke-linecap="round">
        <path d="M56,92 q-7,-4 -12,-2"/><path d="M58,104 q-8,1 -12,5"/>
      </g>
      <g class="cb-spark cb-spark-r" fill="none" stroke="rgba(120,90,70,0.6)" stroke-width="2.4"
        stroke-linecap="round">
        <path d="M150,74 q8,-5 13,-3"/><path d="M156,86 q9,-1 13,3"/>
      </g>

      <!-- 바닥에 남은 것 — 접시가 「몇 번째인지」를 말해 준다 -->
      ${foodEmoji ? `<text x="34" y="216" font-size="30" text-anchor="middle" opacity="0.9">${foodEmoji}</text>` : ''}
      <!-- 부스러기 — 씹을 때마다 톡톡 튄다. 시작 시각을 어긋나게 줘야 같이 안 튄다 -->
      <circle class="cb-crumb cb-crumb1" cx="62" cy="222" r="2.4" fill="rgba(90,60,40,0.55)"/>
      <circle class="cb-crumb cb-crumb2" cx="72" cy="228" r="1.8" fill="rgba(90,60,40,0.45)"/>
      <circle class="cb-crumb cb-crumb3" cx="150" cy="224" r="2" fill="rgba(90,60,40,0.5)"/>
    </svg>`;
  }

  function build(outfit, body, tune) {
    const uid = 'a' + (++avatarUid);
    outfit = outfit || {};
    const w = Math.max(0, Math.min(1, Number(body) || 0));

    // ── 등신 비율 ──────────────────────────────────────────────
    // 통통할 때 3등신, 날씬할 때 4등신. 머리가 큰 쪽이 귀엽다.
    // 머리는 목을 축으로 줄이고, 그만큼 몸을 세로로 늘려 전체 키는 유지한다.
    const head = HEAD_H * lerpN(HEAD_K_SLIM, HEAD_K_FAT, w);   // 실제 머리 높이(px)
    const bodyKy = 1 + (HEAD_H - head) / BODY_SPAN;            // 머리가 줄어든 만큼 몸을 늘림
    const dy = BODY_SPAN * (1 - bodyKy);                       // 어깨가 올라간 만큼 머리도 따라 올림
    const headK = head / HEAD_H;

    // 몸: 가로로 통통하게 + 세로로 늘려 다리를 길게 (바닥을 축으로)
    const bodyT = `translate(100,${FLOOR_Y}) scale(${(1 + 0.36 * w).toFixed(3)},${bodyKy.toFixed(3)}) translate(-100,${-FLOOR_Y})`;
    // 머리: 목을 축으로 크기 조절 (통통하면 가로로 살짝 더 둥글게)
    // 날씬할수록 머리를 위로 올려 목을 뺀다 (NECK_LIFT 참고)
    const lift = NECK_LIFT * (1 - w);
    const headT = `translate(0,${(dy - lift).toFixed(2)}) translate(100,${NECK_Y}) `
      + `scale(${(headK * (1 + 0.06 * w)).toFixed(3)},${headK.toFixed(3)}) translate(-100,${-NECK_Y})`;
    // 체형이 0(날씬)이어도 등신 비율 때문에 변환이 필요하므로 항상 적용한다
    const B = s => (s ? `<g transform="${bodyT}">${s}</g>` : s);   // 몸통 계열
    // 머리 계열 — '얼굴' 배율은 여기서 **머리 전체**에 건다.
    // 예전에는 얼굴 타원(data-part="head")에만 걸려 있어서, 얼굴을 줄이면
    // 머리카락만 원래 크기로 남아 가발을 쓴 것처럼 됐다.
    // 머리카락·귀걸이·서클렛이 전부 H() 를 지나므로 여기 한 곳이면 다 따라온다.
    const kFace = tuneOf(tune, 'face');
    const H = s => (s ? `<g transform="${headT}">${wrapU(s, kFace, 100, NECK_Y)}</g>` : s);

    // ── 목 — **머리와 몸통은 변환이 서로 다르다.** 목은 몸통 그룹에 그려지므로
    // 머리 쪽 값을 몸통 좌표계로 환산해서 넘긴다. 안 그러면 체형·배율을 움직일 때마다
    // 턱과 목이 어긋난다 (NECK_LIFT 를 넣고 실제로 벌어졌다).
    //
    //   턱   머리 안에서 y=105. 머리 변환(kFace → headK, 그리고 dy-lift)을 지난 값
    //   폭   얼굴 반폭 33 이 머리 가로 배율을 지난 값 (몸통 가로 배율로 나눠 되돌린다)
    const kx = 1 + 0.36 * w, hx = headK * (1 + 0.06 * w) * kFace;
    const chinY = NECK_Y + (105 - NECK_Y) * headK * kFace + (dy - lift);
    const neck = {
      // 몸통 좌표계로 되돌리고 2px 겹친다 — 딱 맞추면 경계에 배경이 1px 비친다
      top: FLOOR_Y + (chinY - FLOOR_Y) / bodyKy - 2,
      half: (33 * hx / kx * NECK_OF_FACE
           + (BODY.torsoR - 100) * tuneOf(tune, 'torso') * NECK_OF_SHOULDER) / 2,
    };
    // 고른 색이 있으면 아이템의 원래 색을 덮어쓴다.
    // outfit.colors = { top: '#ffffff', ... } — 없는 칸은 아이템 색 그대로.
    // **원본을 고치지 않고 사본을 만든다** — D.WARDROBE 는 모두가 공유하는 카탈로그라
    // 여기서 물들이면 다른 화면(옷장 목록·미리보기)까지 같이 물든다.
    const pick = (slot, id) => {
      const it = getItem(slot, id);
      const c = outfit.colors && outfit.colors[slot];
      return (c && !isNone(it)) ? Object.assign({}, it, { color: c }) : it;
    };
    const dress = pick('dress', outfit.dress);
    const hasDress = !isNone(dress);
    const top = hasDress ? null : pick('top', outfit.top);
    const bottom = hasDress ? null : pick('bottom', outfit.bottom);

    const hairItem = getItem('hair', outfit.hair);
    // 머리색 — 다른 칸과 같은 규칙이다. 염색한 색이 있으면 그것, 없으면 헤어의 원래 색.
    // 마지막은 옛 세이브를 위한 길이다: '헤어컬러' 칸이 따로 있던 시절의 선택은
    // 마이그레이션이 염색으로 옮기지만, 그 전에 그려질 수도 있다
    const hairColor = (outfit.colors && outfit.colors.hair)
      || hairItem.color
      || getItem('hairColor', outfit.hairColor).color || HAIR_DEF;
    // 옛 세이브는 kind 하나로만 머리를 정했다 — back 이 없으면 kind 를 그대로 쓴다
    const hairBackKind = hairItem.back || (hairItem.kind === 'none' ? 'long' : hairItem.kind);
    const hairBangKind = hairItem.bang || hairItem.kind;
    const expItem = getItem('expression', outfit.expression);

    const layers = [
      H(hairBack(hairBackKind, hairColor)),
      B(legs(tune)),
      B(torsoArms(tune, uid, neck)),
      // 상의 → 하의 순. **상의가 뒤, 하의가 앞이다** — 옷을 넣어 입은 모양이 된다.
      // (반대로 두면 상의 밑단이 치마 허리춤 위에 얹혀 빼 입은 것처럼 보인다)
      //
      // 둘 다 몸통보다는 **앞**이어야 한다. 하의를 몸통 뒤로 보냈더니 몸통이 허리춤을
      // 덮어 버려, 상의 밑단과 치마 사이로 살이 띠처럼 드러났었다.
      // 상의 밑단(hipY-2)이 하의 허리(waistY)보다 아래라 그 사이에 틈이 생기지 않는다.
      B(hasDress ? '' : renderTop(top, tune)),
      B(hasDress ? '' : renderBottom(bottom, tune)),
      // 신발은 **드레스보다 아래** 다 — 위에 그리면 부츠 목이 드레스를 뚫고 나온다.
      // 하의(바지)보다는 위라서 부츠가 바짓단을 덮는다.
      B(renderShoes(pick('shoes', outfit.shoes), tune)),
      B(hasDress ? renderDress(dress, tune) : ''),
      // 허리 아래의 팔은 **치마보다 앞**이다 — 안 그러면 퍼진 치마가 팔뚝과 손을
      // 통째로 덮어, 소매 끝 언저리에 살색 조각만 남는다 (armsOverSkirt 참고)
      B(armsOverSkirt(tune, hasDress ? dress : top)),
      H(faceAndExpression(expItem)),
      H(hairFront(hairBangKind, hairColor)),
      B(renderGlove(pick('glove', outfit.glove), tune)),
      B(renderTattoo(getItem('tattoo', outfit.tattoo))),
      H(renderEarring(pick('earring', outfit.earring))),
      B(renderNecklace(pick('necklace', outfit.necklace))),
      H(renderCirclet(pick('circlet', outfit.circlet))),
    ];

    return `<svg class="avatar-svg" viewBox="0 0 200 348" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="내 아바타">
      <defs>${neckDefs(uid)}</defs>
      <ellipse cx="100" cy="342" rx="${(52 * (1 + 0.18 * w)).toFixed(1)}" ry="8" fill="rgba(120,90,110,0.14)"/>
      ${layers.join('')}
    </svg>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  마이 룸 배경 — 5단계로 커지는 방
  //
  //  구조는 **껍데기(shell) + 소품(prop)** 두 겹이다.
  //  · 껍데기 = 벽 · 창문 · 바닥. 단계에 따라 색만 바뀌고 형태는 그대로다
  //  · 소품   = 이름이 붙은 조각들(`ROOM_PROPS`). 단계마다 어떤 소품을 놓을지
  //             `ROOM_LEVELS` 가 id 목록으로 정한다
  //
  //  **추후 '마이 룸 꾸미기' 를 붙일 자리가 여기다.** 소품이 id 로 구분돼 있으므로
  //  플레이어가 고른 소품 id 목록을 `roomScene(level, extra)` 의 `extra` 로 넘기면
  //  그대로 얹힌다 — 단계별 기본 소품은 건드리지 않는다.
  //  그리는 순서는 `ROOM_Z`(뒤→앞)가 정한다. 목록에 넣은 순서와 무관하게
  //  항상 같은 앞뒤 관계로 겹치게 하려는 것이다.
  //
  //  (viewBox를 넓게 잡고 CSS에서 전체 폭으로 슬라이스 → 네모 프레임 없이 열린 방)
  //  가운데(x 150~250)는 아바타가 서는 자리라 소품을 놓지 않는다.
  // ═══════════════════════════════════════════════════════════════
  // 창문 한 곳에서만 좌표를 정한다 — 튜토리얼 인트로(intro.js)의 둥근 사각 창과 같은 모양.
  // f* = 바깥 나무틀, i* = 유리(하늘이 보이는 안쪽), m* = 창살
  let roomUid = 0;   // 방을 여러 개 그릴 때 SVG id 가 겹치지 않게 붙이는 일련번호
  const WIN = {
    fx: 262, fy: 100, fw: 80, fh: 104, fr: 7,
    ix: 269, iy: 107, iw: 66, ih: 90,  ir: 5,
    mx: 302, my: 152, mw: 5,
  };

  // 시간대별 창밖 하늘 (한국시간 UTC+9 기준) — 아이폰 날씨 앱처럼 시간에 따라 변화
  function skyPhase(now) {
    const d = now || new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const h = new Date(utc + 9 * 3600000).getHours();
    if (h >= 5 && h < 8)   return 'dawn';    // 새벽/일출
    if (h >= 8 && h < 16)  return 'day';     // 낮
    if (h >= 16 && h < 19) return 'dusk';    // 노을
    if (h >= 19 && h < 21) return 'evening'; // 초저녁
    return 'night';                          // 밤
  }

  // 창 안쪽(하늘 + 천체) 그리기. skyId = 하늘 그라디언트의 id (호출마다 다르다)
  function skyView(phase, skyId) {
    const SKY = {
      dawn:    ['#5a5a92', '#f0a97a'],
      day:     ['#7fb8e8', '#cfe6f5'],
      dusk:    ['#7a4a86', '#f2915e'],
      evening: ['#3a3468', '#6a5a92'],
      night:   ['#20203c', '#3b3358'],
    }[phase] || ['#20203c', '#3b3358'];

    // 천체 좌표는 창 안쪽(WIN.ix~ / WIN.iy~)에 맞춰 둔 값이다.
    // 창 위치를 옮기면 여기도 같이 옮겨야 한다.
    let body = `<rect x="${WIN.ix}" y="${WIN.iy}" width="${WIN.iw}" height="${WIN.ih}" fill="url(#${skyId})"/>`;

    if (phase === 'day') {
      body += `<circle cx="316" cy="128" r="13" fill="#fff3b0"/><circle cx="316" cy="128" r="19" fill="#fff3b0" opacity="0.35"/>
        <ellipse cx="288" cy="150" rx="17" ry="7" fill="#fff" opacity="0.75"/>
        <ellipse cx="298" cy="146" rx="11" ry="6" fill="#fff" opacity="0.75"/>
        <ellipse cx="318" cy="176" rx="14" ry="6" fill="#fff" opacity="0.5"/>`;
    } else if (phase === 'dawn' || phase === 'dusk') {
      body += `<circle cx="302" cy="152" r="14" fill="#ffd08a"/><circle cx="302" cy="152" r="21" fill="#ffd08a" opacity="0.3"/>
        <ellipse cx="302" cy="170" rx="34" ry="7" fill="#ffb27a" opacity="0.35"/>
        <ellipse cx="286" cy="132" rx="15" ry="6" fill="#ffd9c0" opacity="0.55"/>`;
    } else {
      body += `<circle cx="318" cy="126" r="11" fill="#fff7e0"/><circle cx="312" cy="122" r="8.5" fill="url(#${skyId})" opacity="0.6"/>
        <circle cx="282" cy="124" r="1.5" fill="#fff"/><circle cx="292" cy="140" r="1.2" fill="#fff"/>
        <circle cx="278" cy="166" r="1.4" fill="#fff"/><circle cx="328" cy="166" r="1.1" fill="#fff"/>
        <circle cx="302" cy="114" r="1" fill="#fff"/><circle cx="316" cy="184" r="1.2" fill="#fff"/>`;
    }
    return { body, SKY };
  }

  // ─── 단계별 색 (벽 위/아래, 바닥 위/아래, 벽 이음새, 창틀) ───
  const ROOM_MAX = 5;
  // 시작 단계. 1단계는 거미줄·균열까지 있는 '텅 빈 골방' 이라 첫인상으로는 너무 휑하다 —
  // 기본은 선반과 러그가 놓인 2단계로 두고, 1단계는 아래로 내려갈 자리로 남겨 둔다.
  const ROOM_DEFAULT = 2;
  const ROOM_SKIN = {
    1: { wall: ['#a8977c', '#7a6a54'], floor: ['#6b4e30', '#452f1b'], seam: 'rgba(40,32,26,0.26)', frame: '#4a3a2c' },
    2: { wall: ['#cbb99c', '#9d8a70'], floor: ['#7d5c39', '#5a4026'], seam: 'rgba(40,32,26,0.22)', frame: '#4a3a2c' },
    3: { wall: ['#dcc9a8', '#ab967a'], floor: ['#8a663f', '#63472a'], seam: 'rgba(40,32,26,0.16)', frame: '#5c4632' },
    4: { wall: ['#e0d0bd', '#a89078'], floor: ['#7d5b46', '#523a2c'], seam: 'rgba(40,32,26,0.12)', frame: '#6b4f37' },
    5: { wall: ['#efe6f6', '#c0aed2'], floor: ['#6e4c56', '#46303a'], seam: 'rgba(90,70,110,0.14)', frame: '#8a6f4a' },
  };

  // ─── 소품 ───
  // 값은 「id → SVG 조각을 만드는 함수」. 인자 `k` 는 단계별 색(ROOM_SKIN 의 한 줄).
  // 새 소품을 늘리면 여기에 넣고 ROOM_Z 의 순서에도 끼워 넣는다.
  const ROOM_PROPS = {
    // 갈라진 금 — 허름한 단계에만
    crack: () => `
      <path d="M46,66 L56,96 L44,124 L56,158" stroke="rgba(40,32,26,0.28)" stroke-width="2.2" fill="none"/>
      <path d="M372,130 L362,160 L374,190" stroke="rgba(40,32,26,0.22)" stroke-width="1.8" fill="none"/>`,
    // 거미줄 (좌상단)
    cobweb: () => `
      <g stroke="rgba(255,255,255,0.16)" stroke-width="1.4" fill="none">
        <path d="M0,0 L52,52 M0,26 L52,52 M26,0 L52,52"/>
        <path d="M10,10 Q24,16 28,28 M20,20 Q34,26 38,38"/>
      </g>`,
    // 벽 아래쪽 나무 판자(굽도리)
    wainscot: k => `
      <rect x="0" y="168" width="400" height="72" fill="${k.frame}" opacity="0.55"/>
      <rect x="0" y="164" width="400" height="7" rx="2" fill="${k.frame}"/>
      <g stroke="rgba(0,0,0,0.18)" stroke-width="1.5">
        <line x1="50" y1="174" x2="50" y2="240"/><line x1="110" y1="174" x2="110" y2="240"/>
        <line x1="170" y1="174" x2="170" y2="240"/><line x1="230" y1="174" x2="230" y2="240"/>
        <line x1="350" y1="174" x2="350" y2="240"/>
      </g>`,
    // 천장 몰딩
    moulding: k => `
      <rect x="0" y="0" width="400" height="16" fill="${k.frame}"/>
      <rect x="0" y="16" width="400" height="5" fill="rgba(255,240,200,0.35)"/>`,
    // 벽 아치 부조 — 5단계 대저택.
    // 기둥 대신 부조로 둔 이유: 우측은 창문·커튼·화분이 이미 차 있어 기둥을 세울 자리가 없다
    arches: () => {
      let s = '';
      for (let x = 20; x < 400; x += 80) {
        s += `<path d="M${x},108 L${x},52 A26,26 0 0 1 ${x + 52},52 L${x + 52},108 Z"
          fill="rgba(255,255,255,0.16)" stroke="rgba(120,96,150,0.18)" stroke-width="2"/>`;
      }
      return s;
    },
    // 액자 (좌측 벽)
    frame: k => `
      <rect x="86" y="70" width="46" height="56" rx="3" fill="${k.frame}"/>
      <rect x="92" y="76" width="34" height="44" rx="2" fill="#cfd9e8"/>
      <path d="M92,120 L104,98 L114,110 L122,92 L126,120 Z" fill="#8aa87e"/>
      <circle cx="116" cy="88" r="5" fill="#f5e08a"/>`,
    // 벽 촛대
    candle: () => `
      <g>
        <rect x="46" y="96" width="6" height="16" rx="2" fill="#8a6f4a"/>
        <rect x="40" y="76" width="18" height="22" rx="3" fill="#f3ead6"/>
        <ellipse cx="49" cy="70" rx="5" ry="8" fill="#ffcf6a"/>
        <ellipse cx="49" cy="70" rx="11" ry="15" fill="#ffcf6a" opacity="0.22"/>
        <rect x="366" y="96" width="6" height="16" rx="2" fill="#8a6f4a"/>
        <rect x="360" y="76" width="18" height="22" rx="3" fill="#f3ead6"/>
        <ellipse cx="369" cy="70" rx="5" ry="8" fill="#ffcf6a"/>
        <ellipse cx="369" cy="70" rx="11" ry="15" fill="#ffcf6a" opacity="0.22"/>
      </g>`,
    // 낡은 선반 + 약병 (좌측)
    shelf: k => `
      <rect x="24" y="176" width="92" height="7" rx="2" fill="${k.frame}"/>
      <rect x="38" y="152" width="13" height="24" rx="4" fill="#5f7a6a"/>
      <rect x="60" y="158" width="12" height="18" rx="5" fill="#7a5f6a"/>
      <rect x="82" y="148" width="12" height="28" rx="4" fill="#6a6a4a"/>`,
    // 책장 (좌측 바닥까지)
    bookshelf: k => `
      <rect x="12" y="118" width="86" height="122" rx="4" fill="${k.frame}"/>
      <rect x="18" y="124" width="74" height="110" fill="rgba(0,0,0,0.28)"/>
      <g>
        <rect x="22" y="128" width="9" height="32" fill="#a8556a"/><rect x="33" y="132" width="8" height="28" fill="#5f7a9a"/>
        <rect x="43" y="126" width="10" height="34" fill="#6a8a5f"/><rect x="55" y="134" width="8" height="26" fill="#c08a4a"/>
        <rect x="65" y="130" width="9" height="30" fill="#8a6a9a"/>
        <rect x="22" y="172" width="8" height="30" fill="#7a9a8a"/><rect x="32" y="176" width="10" height="26" fill="#b06a6a"/>
        <rect x="44" y="170" width="9" height="32" fill="#5f6a9a"/><rect x="55" y="178" width="8" height="24" fill="#9a8a4a"/>
      </g>
      <rect x="18" y="162" width="74" height="6" fill="${k.frame}"/>
      <rect x="18" y="204" width="74" height="6" fill="${k.frame}"/>`,
    // 화분 (우측 창 아래)
    plant: () => `
      <path d="M356,240 L352,214 L382,214 L378,240 Z" fill="#a86a4a"/>
      <rect x="350" y="208" width="34" height="9" rx="3" fill="#bd7a56"/>
      <g fill="#6f9a63">
        <ellipse cx="358" cy="196" rx="8" ry="14" transform="rotate(-24 358 196)"/>
        <ellipse cx="374" cy="196" rx="8" ry="14" transform="rotate(24 374 196)"/>
        <ellipse cx="366" cy="188" rx="7" ry="16"/>
      </g>`,
    // 창문 커튼
    curtain: () => `
      <rect x="${WIN.fx - 14}" y="${WIN.fy - 12}" width="${WIN.fw + 28}" height="7" rx="3" fill="#8a6f4a"/>
      <path d="M${WIN.fx - 12},${WIN.fy - 8} L${WIN.fx + 12},${WIN.fy - 8} L${WIN.fx + 6},${WIN.fy + WIN.fh + 8}
        Q${WIN.fx - 2},${WIN.fy + WIN.fh + 2} ${WIN.fx - 12},${WIN.fy + WIN.fh + 8} Z" fill="#9a5f72"/>
      <path d="M${WIN.fx + WIN.fw - 12},${WIN.fy - 8} L${WIN.fx + WIN.fw + 12},${WIN.fy - 8}
        L${WIN.fx + WIN.fw + 12},${WIN.fy + WIN.fh + 8}
        Q${WIN.fx + WIN.fw + 2},${WIN.fy + WIN.fh + 2} ${WIN.fx + WIN.fw - 6},${WIN.fy + WIN.fh + 8} Z" fill="#9a5f72"/>
      <g stroke="rgba(0,0,0,0.16)" stroke-width="2" fill="none">
        <path d="M${WIN.fx - 4},${WIN.fy - 6} L${WIN.fx + 1},${WIN.fy + WIN.fh}"/>
        <path d="M${WIN.fx + WIN.fw + 4},${WIN.fy - 6} L${WIN.fx + WIN.fw - 1},${WIN.fy + WIN.fh}"/>
      </g>`,
    // 창틀 황금 장식
    goldTrim: () => `
      <rect x="${WIN.fx - 4}" y="${WIN.fy - 4}" width="${WIN.fw + 8}" height="${WIN.fh + 8}" rx="10"
        fill="none" stroke="#d9b45f" stroke-width="3"/>
      <circle cx="${WIN.fx + WIN.fw / 2}" cy="${WIN.fy - 10}" r="7" fill="#d9b45f"/>
      <circle cx="${WIN.fx + WIN.fw / 2}" cy="${WIN.fy - 10}" r="3" fill="#fff2c4"/>`,
    // 작은 러그
    rugSmall: () => `
      <ellipse cx="200" cy="290" rx="96" ry="26" fill="#8a5f6a" opacity="0.75"/>
      <ellipse cx="200" cy="290" rx="76" ry="19" fill="none" stroke="rgba(255,235,205,0.4)" stroke-width="2"/>`,
    // 큰 카펫
    rugBig: () => `
      <ellipse cx="200" cy="288" rx="150" ry="38" fill="#8e3f4e"/>
      <ellipse cx="200" cy="288" rx="150" ry="38" fill="none" stroke="#d9b45f" stroke-width="3"/>
      <ellipse cx="200" cy="288" rx="120" ry="28" fill="none" stroke="#d9b45f" stroke-width="2" opacity="0.7"/>
      <ellipse cx="200" cy="288" rx="60" ry="14" fill="#a04d5c"/>`,
    // 바닥 마법진
    circle: () => `
      <g fill="none" stroke="#cba8f0" stroke-width="2" opacity="0.75">
        <ellipse cx="200" cy="288" rx="104" ry="26"/>
        <ellipse cx="200" cy="288" rx="72" ry="18"/>
        <path d="M96,288 L200,270 L304,288 L200,306 Z"/>
      </g>
      <g fill="#e6d0ff" opacity="0.85">
        <circle cx="96" cy="288" r="3"/><circle cx="304" cy="288" r="3"/>
        <circle cx="200" cy="270" r="3"/><circle cx="200" cy="306" r="3"/>
      </g>`,
    // 샹들리에 (천장 · 아바타 머리 위를 피해 위쪽에만)
    chandelier: () => `
      <line x1="200" y1="0" x2="200" y2="22" stroke="#8a6f4a" stroke-width="3"/>
      <ellipse cx="200" cy="28" rx="46" ry="9" fill="none" stroke="#d9b45f" stroke-width="4"/>
      <g fill="#ffcf6a">
        <rect x="162" y="16" width="6" height="13" rx="2" fill="#f3ead6"/><ellipse cx="165" cy="12" rx="4" ry="6"/>
        <rect x="197" y="14" width="6" height="15" rx="2" fill="#f3ead6"/><ellipse cx="200" cy="9" rx="4" ry="6"/>
        <rect x="232" y="16" width="6" height="13" rx="2" fill="#f3ead6"/><ellipse cx="235" cy="12" rx="4" ry="6"/>
      </g>
      <ellipse cx="200" cy="24" rx="62" ry="24" fill="#ffcf6a" opacity="0.16"/>
      <g fill="#ffe9a8" opacity="0.8">
        <circle cx="176" cy="38" r="2.5"/><circle cx="200" cy="42" r="2.5"/><circle cx="224" cy="38" r="2.5"/>
      </g>`,
  };

  // 그리는 순서(뒤 → 앞). 벽 → 창문 → 바닥 → 천장 순서로 겹친다.
  const ROOM_Z = [
    'wainscot', 'moulding', 'arches', 'crack', 'cobweb', 'frame', 'candle', 'bookshelf', 'shelf',
    '@window',
    'curtain', 'goldTrim', 'plant',
    '@floor',
    'rugSmall', 'rugBig', 'circle',
    '@beam',
    'chandelier',
  ];

  // 단계별 기본 소품. 위 단계라고 아래 것을 다 물려받지는 않는다 —
  // 거미줄·균열은 방이 좋아지면 사라지고, 작은 러그는 큰 카펫으로 바뀐다.
  const ROOM_LEVELS = {
    1: ['crack', 'cobweb'],
    2: ['crack', 'shelf', 'rugSmall'],
    3: ['wainscot', 'shelf', 'frame', 'curtain', 'plant', 'rugSmall'],
    4: ['wainscot', 'moulding', 'bookshelf', 'shelf', 'frame', 'candle', 'curtain', 'plant', 'rugBig'],
    5: ['wainscot', 'moulding', 'arches', 'bookshelf', 'frame', 'candle', 'curtain', 'goldTrim',
        'plant', 'rugBig', 'circle', 'chandelier'],
  };

  // 마이 룸 배경 — 텔레포트해 온 연금술 공방이 단계에 따라 번듯해진다 (창문은 우측)
  // level : 1~5 (기본 1)
  // extra : 추가로 얹을 소품 id 목록 — 추후 '마이 룸 꾸미기' 가 쓸 자리
  // padBottom — **방을 아래로 더 그린다.** 스탯을 접었을 때 그 자리를 방 배경이
  // 이어받게 하려는 것이다.
  //
  // CSS 로 상자만 늘이면 안 된다: 이 그림은 `preserveAspectRatio="…slice"` 라
  // 늘어난 만큼 **좌우가 잘린다** (선반과 창문이 화면 밖으로 나간다).
  // 그래서 viewBox 자체를 늘리고 **바닥을 진짜로 더 그린다** — 원근선도 기울기를
  // 그대로 이어서 연장하므로 이음매가 생기지 않는다.
  function roomScene(level, extra, padBottom) {
    const pad = Math.max(0, Math.round(Number(padBottom) || 0));
    const H = 320 + pad;
    const lv = Math.min(ROOM_MAX, Math.max(1, Math.round(Number(level) || ROOM_DEFAULT)));
    // SVG 의 id 는 **문서 전체에서 공유된다.** 방을 두 개 이상 한 화면에 그리면
    // 뒤에 온 쪽이 앞 쪽의 그라디언트를 그대로 써 버려 단계별 색이 전부 같아진다
    // (5단계 미리보기를 나란히 놓다가 실제로 겪었다). 그래서 부를 때마다 꼬리표를 붙인다.
    const u = 'r' + (++roomUid);
    const ID = n => `${n}_${u}`;
    const k = ROOM_SKIN[lv];
    const want = new Set(ROOM_LEVELS[lv].concat(Array.isArray(extra) ? extra : []));

    const phase = skyPhase();
    const sky = skyView(phase, ID('skyDyn'));
    // 낮일수록, 방이 좋을수록 실내도 조금 밝게
    const warm = ((phase === 'day') ? 0.30 : (phase === 'dawn' || phase === 'dusk') ? 0.24 : 0.14)
      + (lv - 1) * 0.03;

    // 벽 이음새 — 돌벽은 아래 단계에서만 진하게 보인다
    const stone = `<g stroke="${k.seam}" stroke-width="2">
        <line x1="0" y1="60" x2="400" y2="60"/><line x1="0" y1="120" x2="400" y2="120"/><line x1="0" y1="180" x2="400" y2="180"/>
        <line x1="60" y1="0" x2="60" y2="60"/><line x1="210" y1="0" x2="210" y2="60"/><line x1="330" y1="0" x2="330" y2="60"/>
        <line x1="20" y1="60" x2="20" y2="120"/><line x1="140" y1="60" x2="140" y2="120"/><line x1="250" y1="60" x2="250" y2="120"/>
        <line x1="90" y1="120" x2="90" y2="180"/><line x1="360" y1="120" x2="360" y2="180"/>
      </g>`;

    // 창문 — 튜토리얼 인트로와 같은 둥근 사각 창
    const win = `
      <rect x="${WIN.fx}" y="${WIN.fy}" width="${WIN.fw}" height="${WIN.fh}" rx="${WIN.fr}" fill="${k.frame}"/>
      <rect x="${WIN.ix}" y="${WIN.iy}" width="${WIN.iw}" height="${WIN.ih}" rx="${WIN.ir}" fill="#2a2438"/>
      <clipPath id="${ID('winClip')}"><rect x="${WIN.ix}" y="${WIN.iy}" width="${WIN.iw}" height="${WIN.ih}" rx="${WIN.ir}"/></clipPath>
      <g clip-path="url(#${ID('winClip')})">${sky.body}</g>
      <line x1="${WIN.mx}" y1="${WIN.iy}" x2="${WIN.mx}" y2="${WIN.iy + WIN.ih}" stroke="${k.frame}" stroke-width="${WIN.mw}"/>
      <line x1="${WIN.ix}" y1="${WIN.my}" x2="${WIN.ix + WIN.iw}" y2="${WIN.my}" stroke="${k.frame}" stroke-width="${WIN.mw}"/>`;

    // 원근선은 **기울기를 그대로 이어서** 늘인다 (y=241 → 320 의 기울기를 H 까지)
    const ext = (x0, x1) => (x1 + (x1 - x0) * pad / 79).toFixed(1);
    const floor = `
      <rect x="0" y="235" width="400" height="${85 + pad}" fill="url(#${ID('floorG')})"/>
      <rect x="0" y="235" width="400" height="6" fill="${k.floor[1]}"/>
      <g stroke="${k.floor[1]}" stroke-width="2" opacity="0.55">
        <line x1="120" y1="241" x2="${ext(120, 70)}" y2="${H}"/><line x1="200" y1="241" x2="200" y2="${H}"/><line x1="280" y1="241" x2="${ext(280, 330)}" y2="${H}"/>
        <line x1="40" y1="241" x2="${ext(40, -40)}" y2="${H}"/><line x1="360" y1="241" x2="${ext(360, 440)}" y2="${H}"/>
      </g>
      <line x1="0" y1="280" x2="400" y2="280" stroke="${k.floor[1]}" stroke-width="1.5" opacity="0.5"/>`;

    // 창빛도 같은 기울기로 바닥 끝까지 (중간에서 끊기면 그 선이 그대로 보인다)
    const bY = WIN.iy + WIN.ih;
    const bW = 40 * (H - bY) / (320 - bY);
    const beam = `<path d="M${WIN.ix},${bY} L${WIN.ix + WIN.iw},${bY}
      L${(WIN.ix + WIN.iw + bW).toFixed(1)},${H} L${(WIN.ix - bW).toFixed(1)},${H} Z" fill="url(#${ID('beamG')})"/>`;

    const FIXED = { '@window': win, '@floor': floor, '@beam': beam };
    const body = ROOM_Z.map(id => FIXED[id] || (want.has(id) && ROOM_PROPS[id] ? ROOM_PROPS[id](k) : '')).join('');

    return `<svg class="room-svg" viewBox="0 0 400 ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="${ID('wallG')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k.wall[0]}"/><stop offset="1" stop-color="${k.wall[1]}"/>
        </linearGradient>
        <linearGradient id="${ID('floorG')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k.floor[0]}"/><stop offset="1" stop-color="${k.floor[1]}"/>
        </linearGradient>
        <linearGradient id="${ID('skyDyn')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky.SKY[0]}"/><stop offset="1" stop-color="${sky.SKY[1]}"/>
        </linearGradient>
        <linearGradient id="${ID('beamG')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(255,240,190,${warm})"/><stop offset="1" stop-color="rgba(255,240,190,0)"/>
        </linearGradient>
        <radialGradient id="${ID('vigG')}" cx="0.5" cy="${(0.42 * 320 / H).toFixed(3)}" r="0.78">
          <stop offset="0.4" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(12,8,20,${(0.46 - lv * 0.05).toFixed(2)})"/>
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="400" height="240" fill="url(#${ID('wallG')})"/>
      ${lv <= 3 ? stone : ''}
      ${body}
      <rect x="0" y="0" width="400" height="${H}" fill="url(#${ID('vigG')})"/>
    </svg>`;
  }

  // NECK_CUT 은 커버리지 검사기(tools/checkavatar.js)도 읽는다 —
  // 파는 자리를 두 곳에 적어 두면 어긋나고, 어긋나는 순간 검사가 헛돈다
  window.Avatar = { build, crouchBack, getItem, roomScene, hairIcon, TUNE_KEYS, neckCutBox, CLOTH_TOP_Y,
    ROOM_MAX, ROOM_DEFAULT, ROOM_PROPS, ROOM_LEVELS };
})();
