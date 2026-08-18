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
    torsoL: 64, torsoR: 136,        // 몸통 최대 폭 (어깨)
    waistY: 196, hipY: 214,
    // 팔: (x, y=120) 에서 시작하는 폭 armW 의 막대를 어깨 기준으로 회전.
    // **팔을 옮기면 소매도 같이 따라온다** — armShape() 이 이 값만 본다.
    // 몸통 쪽으로 조금 붙이고(52→55) 벌어짐을 줄였다(7°→4°). 예전에는 날씬할 때
    // 몸통은 허리로 좁아지는데 팔은 바깥으로 벌어져, 팔이 몸에서 떨어져 보였다.
    armX_L: 55, armX_R: 130, armY: 120, armH: 94, armW: 15,
    armRot: 4, armPivotL: 62, armPivotR: 138, armPivotY: 130,
    ankleY: 332,
  };
  // 옷이 몸을 확실히 덮도록 주는 여유 (한쪽당 px)
  const CLOTH_PAD = 3;
  // 맨팔에만 주는 옅은 테두리. 팔과 몸통이 같은 살색이라, 통통해져 몸통이 넓어지면
  // 팔이 몸통에 묻혀 실루엣이 사라졌다. 얇은 선 하나로 겹쳐도 팔이 읽힌다.
  // (소매를 입으면 옷 색이 대비를 만들어 주므로 옷에는 넣지 않는다)
  const ARM_EDGE = ` stroke="${SKIN_SH}" stroke-width="1.6"`;

  // ─── 등신 비율 기준값 ───
  // 머리(머리카락 끝 ~ 턱) 높이와 몸(어깨 ~ 발) 길이. 이 둘의 비가 등신을 만든다.
  const HEAD_H   = 84;    // 현재 아트의 머리 높이 (y 21 ~ 105)
  const BODY_SPAN = 229;  // 어깨(113) ~ 바닥(342)
  const FLOOR_Y  = 342;   // 발이 닿는 높이 (여기를 축으로 몸을 늘린다)
  const NECK_Y   = 112;   // 머리를 얹는 목 위치
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
  const TUNE_KEYS = ['torso', 'arm', 'thigh', 'calf', 'face'];
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

  // 팔과 소매를 **같은 좌표에서** 그린다.
  // 예전에는 소매 좌표가 renderTop·renderDress 에 그대로 박혀 있어서,
  // 팔 위치나 각도를 고치면 소매만 제자리에 남아 어긋났다. BODY 하나만 고치면 되게 모았다.
  //   side  'L'|'R' · pad 팔보다 얼마나 넓게(소매) · h 길이 · extra 덧붙일 속성
  function armShape(side, fill, pad, h, tune, extra) {
    const B = BODY, left = side === 'L';
    const x0 = left ? B.armX_L : B.armX_R;
    const w = B.armW + pad * 2;
    const rot = left ? B.armRot : -B.armRot;
    const pivot = left ? B.armPivotL : B.armPivotR;
    return wrapX(
      `<rect x="${x0 - pad}" y="${B.armY - pad}" width="${w}" height="${h}" rx="${(w / 2).toFixed(1)}"
        fill="${fill}"${extra || ''} transform="rotate(${rot} ${pivot} ${B.armPivotY})"/>`,
      tuneOf(tune, 'arm'), x0 + B.armW / 2);
  }

  function legs(tune) {
    const kt = tuneOf(tune, 'thigh'), kc = tuneOf(tune, 'calf');
    return `
      <g data-part="calf">
        <g${sx(kc, 88.5)}><rect x="80" y="266" width="17" height="66" rx="8" fill="${SKIN}"/></g>
        <g${sx(kc, 111.5)}><rect x="103" y="266" width="17" height="66" rx="8" fill="${SKIN}"/></g>
      </g>
      <ellipse cx="86" cy="335" rx="12" ry="7" fill="${SKIN_SH}"/>
      <ellipse cx="114" cy="335" rx="12" ry="7" fill="${SKIN_SH}"/>
      <g data-part="thigh">
        <g${sx(kt, 88)}><rect x="78" y="204" width="20" height="68" rx="10" fill="${SKIN}"/></g>
        <g${sx(kt, 112)}><rect x="102" y="204" width="20" height="68" rx="10" fill="${SKIN}"/></g>
      </g>`;
  }

  function torsoArms(tune) {
    const kb = tuneOf(tune, 'torso');   // 팔 배율은 armShape 이 알아서 따른다
    return `
      <rect x="91" y="96" width="18" height="20" rx="7" fill="${SKIN_SH}"/>
      <g data-part="torso">
        <g${sx(kb, 100)}><path d="M64,126 C64,118 80,113 100,113 C120,113 136,118 136,126
          L130,196 C130,208 116,214 100,214 C84,214 70,208 70,196 Z" fill="${SKIN}"/></g>
      </g>
      <g data-part="arm">
        ${armShape('L', SKIN, 0, BODY.armH, tune, ARM_EDGE)}
        ${armShape('R', SKIN, 0, BODY.armH, tune, ARM_EDGE)}
      </g>`;
  }

  // 얼굴(피부) + 귀 + 표정
  function faceAndExpression(expItem, tune) {
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
    // 얼굴만 턱(100,105)을 축으로 키운다 — 머리카락은 따로라 같이 커지지 않는다
    return `
      <g data-part="head"${su(tuneOf(tune, 'face'), 100, 105)}>
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
  function hairBack(kind, c) {
    const s = shade(c, 22);
    const crown = `<ellipse cx="100" cy="63" rx="40" ry="42" fill="${c}"/>`;
    switch (kind) {
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

  function hairFront(kind, c) {
    if (kind === 'wave') {
      return `<path d="M67,61 C66,36 134,36 133,61 C126,49 112,50 100,64 C99,50 95,48 91,53 C85,45 74,49 67,61 Z" fill="${c}"/>`;
    }
    // 기본 앞머리(스트레이트 뱅)
    return `<path d="M68,60 C66,38 78,30 100,30 C122,30 134,38 132,60
      C126,52 116,50 108,58 C104,50 96,50 92,58 C84,50 74,52 68,60 Z" fill="${c}"/>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  옷 (상의 / 하의 / 원피스)
  // ═══════════════════════════════════════════════════════════════
  // 소매는 팔을, 몸판은 몸통을 따라간다
  function renderTop(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c), sh = it.sleeve === 'long' ? 94 : 42;
    const kb = tuneOf(tune, 'torso');   // 소매는 armShape 이 알아서 팔 배율을 따른다
    return `
      ${armShape('L', c, 2, sh, tune)}
      ${armShape('R', c, 2, sh, tune)}
      ${wrapX(`<path d="M60,124 C60,116 80,111 100,111 C120,111 140,116 140,124
        L134,192 C134,204 118,210 100,210 C82,210 66,204 66,192 Z" fill="${c}"/>
      <path d="M88,114 Q100,125 112,114" stroke="${c2}" stroke-width="3" fill="none" stroke-linecap="round"/>`, kb, 100)}`;
  }

  // 하의는 허리(몸통) + 자기가 덮는 다리 파츠를 따라간다
  function renderBottom(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c);
    if (it.kind === 'skirt') {
      return wrapX(`<path d="M70,196 L130,196 L146,252 C120,266 80,266 54,252 Z" fill="${c}"/>
        <path d="M70,196 L130,196 L131,210 L69,210 Z" fill="${c2}"/>`,
        tuneMax(tune, ['torso', 'thigh']), 100);
    }
    if (it.kind === 'shorts') {
      return wrapX(`<path d="M70,196 L130,196 L127,240 L106,240 L100,214 L94,240 L73,240 Z" fill="${c}"/>`,
        tuneMax(tune, ['torso', 'thigh']), 100);
    }
    // 바지는 종아리까지 덮는다
    return wrapX(`<path d="M70,198 L130,198 L127,332 L107,332 L100,222 L93,332 L73,332 Z" fill="${c}"/>`,
      tuneMax(tune, ['torso', 'thigh', 'calf']), 100);
  }

  // 소매(팔을 덮는 부분)를 몸의 팔 좌표 그대로 만들어 준다.
  // len: 팔 길이의 몇 %까지 덮을지 (나머지는 손으로 드러남)
  function sleeves(c, len, tune) {
    const B = BODY, pad = CLOTH_PAD;
    const w = B.armW + pad * 2;                 // 팔보다 좌우로 pad 만큼 넓게
    const h = B.armH * len + pad;
    // 손 위치 = 소매 끝을 팔과 같은 각도로 회전시킨 지점
    const rad = B.armRot * Math.PI / 180;
    const hand = (px, cx) => {
      const dx = cx - px, dy = (B.armY + B.armH * len) - B.armPivotY;
      const sgn = px === B.armPivotL ? 1 : -1;  // 오른팔은 반대로 회전
      return {
        x: px + dx * Math.cos(rad) - dy * Math.sin(rad) * sgn,
        y: B.armPivotY + dx * Math.sin(rad) * sgn + dy * Math.cos(rad),
      };
    };
    const cxL = B.armX_L + B.armW / 2, cxR = B.armX_R + B.armW / 2;
    const hL = hand(B.armPivotL, cxL), hR = hand(B.armPivotR, cxR);
    // 소매만 팔 배율을 따른다. 손은 팔 중심선 위에 있고 그 선은 움직이지 않으므로
    // (좌우 각각 자기 중심을 축으로 늘린다) 그대로 둔다 — 같이 늘리면 손이 타원이 된다.
    return `
      ${armShape('L', c, pad, h, tune)}
      ${armShape('R', c, pad, h, tune)}
      <circle cx="${hL.x.toFixed(1)}" cy="${hL.y.toFixed(1)}" r="8.5" fill="${SKIN}"/>
      <circle cx="${hR.x.toFixed(1)}" cy="${hR.y.toFixed(1)}" r="8.5" fill="${SKIN}"/>`;
  }

  // 몸통을 덮고 hemY 까지 퍼지는 드레스 (+ 팔 소매)
  function sleevedDress(c, c2, hemY, longSleeve, tune) {
    const B = BODY, pad = CLOTH_PAD;
    const L = B.torsoL - pad, R = B.torsoR + pad;         // 어깨는 몸통보다 넓게
    const flare = 21;                                     // 밑단이 퍼지는 정도
    const hemL = L - flare, hemR = R + flare;
    // 몸통부터 다리까지 덮으므로 그중 가장 큰 배율을 따른다
    const kd = tuneMax(tune, ['torso', 'thigh', 'calf']);
    return `<g data-part="dress">
      ${wrapX(`
      <!-- 몸통 → 밑단까지 퍼지는 치마 (어깨 폭은 몸통 기준 + 여유) -->
      <path d="M${L},${B.shoulderY + 11}
        C${L},${B.shoulderY} ${L + 16},${B.shoulderY - 5} 100,${B.shoulderY - 5}
        C${R - 16},${B.shoulderY - 5} ${R},${B.shoulderY} ${R},${B.shoulderY + 11}
        C${R + 6},${B.waistY - 18} ${hemR - 5},${hemY - 62} ${hemR},${hemY + 5}
        C${R - 18},${hemY + 15} ${L + 18},${hemY + 15} ${hemL},${hemY + 5}
        C${hemL + 5},${hemY - 62} ${L - 6},${B.waistY - 18} ${L},${B.shoulderY + 11} Z" fill="${c}"/>
      <!-- 허리 라인 -->
      <path d="M${L + 8},${B.waistY} L${R - 8},${B.waistY}" stroke="${c2}" stroke-width="4.5" stroke-linecap="round"/>
      <!-- 밑단 -->
      <path d="M${hemL + 3},${hemY - 8} C${L + 12},${hemY + 2} ${R - 12},${hemY + 2} ${hemR - 3},${hemY - 8}"
            stroke="${c2}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <!-- 목선 -->
      <path d="M88,${B.shoulderY} Q100,${B.shoulderY + 9} 112,${B.shoulderY}"
            stroke="${c2}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`, kd, 100)}
      ${sleeves(c, longSleeve ? 0.92 : 0.42, tune)}
    </g>`;
  }

  function renderDress(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c);
    const kd = tuneMax(tune, ['torso', 'thigh', 'calf']);   // 몸통~다리를 덮는다

    // 튜토리얼 인트로의 공주 드레스 — 어깨에서 발목까지 내려오는 종 모양 + 소매
    // (인트로 princessFront 의 실루엣을 아바타 좌표계로 옮긴 것)
    if (it.kind === 'princess') {
      return sleevedDress(c, c2, BODY.ankleY, true, tune);
    }

    const hemY = it.kind === 'gown' ? 320 : 270, flare = it.kind === 'gown' ? 40 : 46;
    return `
      ${armShape('L', c, 2, 42, tune)}
      ${armShape('R', c, 2, 42, tune)}
      ${wrapX(`<path d="M62,122 C62,115 80,111 100,111 C120,111 138,115 138,122
        L122,198 L${100 + flare + 8},${hemY} C122,${hemY + 14} 78,${hemY + 14} ${100 - flare - 8},${hemY}
        L78,198 Z" fill="${c}"/>
      <path d="M78,196 L122,196" stroke="${c2}" stroke-width="4" stroke-linecap="round"/>`, kd, 100)}`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  악세사리 (서클렛 / 귀걸이 / 목걸이)
  // ═══════════════════════════════════════════════════════════════
  function renderCirclet(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a', c2 = shade(c, 34);
    if (it.kind === 'tiara') {
      return `<path d="M72,55 L82,43 L91,52 L100,38 L109,52 L118,43 L128,55 Z"
        fill="${c}" stroke="${c2}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="100" cy="44" r="2.6" fill="#fff"/>`;
    }
    if (it.kind === 'flower') {
      const petals = [0, 72, 144, 216, 288].map(a =>
        `<circle cx="${(100 + Math.cos(a * Math.PI / 180) * 6.5).toFixed(1)}" cy="${(46 + Math.sin(a * Math.PI / 180) * 6.5).toFixed(1)}" r="4.4" fill="${c}"/>`).join('');
      return `<path d="M70,54 Q100,44 130,54" stroke="${c}" stroke-width="3.5" fill="none"/>${petals}<circle cx="100" cy="46" r="3" fill="#fff3b0"/>`;
    }
    return `<path d="M69,54 Q100,42 131,54" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M96,42 L100,48 L104,42 Z" fill="${c}"/>`;
  }

  function renderEarring(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a';
    if (it.kind === 'hoop') {
      return `<circle cx="66" cy="88" r="5" fill="none" stroke="${c}" stroke-width="2.6"/><circle cx="134" cy="88" r="5" fill="none" stroke="${c}" stroke-width="2.6"/>`;
    }
    if (it.kind === 'star') {
      return `<path d="${starPath(66, 89, 4.6)}" fill="${c}"/><path d="${starPath(134, 89, 4.6)}" fill="${c}"/>`;
    }
    return `<circle cx="66" cy="84" r="2.3" fill="${c}"/><ellipse cx="66" cy="90" rx="3" ry="4.4" fill="${c}"/>
      <circle cx="134" cy="84" r="2.3" fill="${c}"/><ellipse cx="134" cy="90" rx="3" ry="4.4" fill="${c}"/>`;
  }

  function renderNecklace(it) {
    if (isNone(it)) return '';
    const c = it.color || '#ffd76a';
    if (it.kind === 'choker') {
      return `<path d="M85,113 Q100,121 115,113" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    }
    if (it.kind === 'pearl') {
      let dots = '';
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        dots += `<circle cx="${(83 + t * 34).toFixed(1)}" cy="${(116 + Math.sin(t * Math.PI) * 11).toFixed(1)}" r="2.4" fill="#fff" stroke="#eadfd0" stroke-width="0.5"/>`;
      }
      return dots;
    }
    return `<path d="M85,114 Q100,124 115,114" stroke="${c}" stroke-width="2" fill="none"/>
      <circle cx="100" cy="129" r="4.6" fill="${c}"/><circle cx="100" cy="129" r="1.8" fill="#fff" opacity="0.6"/>`;
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
  function build(outfit, body, tune) {
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
    const headT = `translate(0,${dy.toFixed(2)}) translate(100,${NECK_Y}) `
      + `scale(${(headK * (1 + 0.06 * w)).toFixed(3)},${headK.toFixed(3)}) translate(-100,${-NECK_Y})`;
    // 체형이 0(날씬)이어도 등신 비율 때문에 변환이 필요하므로 항상 적용한다
    const B = s => (s ? `<g transform="${bodyT}">${s}</g>` : s);   // 몸통 계열
    const H = s => (s ? `<g transform="${headT}">${s}</g>` : s);   // 머리 계열
    const dress = getItem('dress', outfit.dress);
    const hasDress = !isNone(dress);
    const top = hasDress ? null : getItem('top', outfit.top);
    const bottom = hasDress ? null : getItem('bottom', outfit.bottom);

    const hairItem = getItem('hair', outfit.hair);
    const hairColor = getItem('hairColor', outfit.hairColor).color || HAIR_DEF;
    const hairKind = hairItem.kind === 'none' ? 'long' : hairItem.kind;
    const expItem = getItem('expression', outfit.expression);

    const layers = [
      H(hairBack(hairKind, hairColor)),
      B(legs(tune)),
      B(hasDress ? '' : renderBottom(bottom, tune)),
      B(torsoArms(tune)),
      B(hasDress ? renderDress(dress, tune) : renderTop(top, tune)),
      H(faceAndExpression(expItem, tune)),
      H(hairFront(hairKind, hairColor)),
      B(renderTattoo(getItem('tattoo', outfit.tattoo))),
      H(renderEarring(getItem('earring', outfit.earring))),
      B(renderNecklace(getItem('necklace', outfit.necklace))),
      H(renderCirclet(getItem('circlet', outfit.circlet))),
    ];

    return `<svg class="avatar-svg" viewBox="0 0 200 348" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="내 아바타">
      <ellipse cx="100" cy="342" rx="${(52 * (1 + 0.18 * w)).toFixed(1)}" ry="8" fill="rgba(120,90,110,0.14)"/>
      ${layers.join('')}
    </svg>`;
  }

  // ═══════════════════════════════════════════════════════════════
  //  마이 룸 배경 — "텅 빈 중세 방" (아뜰리에 톤)
  //  돌벽 · 아치 창문/달빛 · 나무 바닥만. 가구/소품은 추후 사용자가 배치.
  //  (viewBox를 넓게 잡고 CSS에서 전체 폭으로 슬라이스 → 네모 프레임 없이 열린 방)
  // ═══════════════════════════════════════════════════════════════
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

  // 창 안쪽(하늘 + 천체) 그리기. cx,cy = 창 중심
  function skyView(phase) {
    const SKY = {
      dawn:    ['#5a5a92', '#f0a97a'],
      day:     ['#7fb8e8', '#cfe6f5'],
      dusk:    ['#7a4a86', '#f2915e'],
      evening: ['#3a3468', '#6a5a92'],
      night:   ['#20203c', '#3b3358'],
    }[phase] || ['#20203c', '#3b3358'];

    let body = `<rect x="264" y="86" width="76" height="106" fill="url(#skyDyn)"/>`;

    if (phase === 'day') {
      body += `<circle cx="316" cy="112" r="13" fill="#fff3b0"/><circle cx="316" cy="112" r="19" fill="#fff3b0" opacity="0.35"/>
        <ellipse cx="286" cy="140" rx="17" ry="7" fill="#fff" opacity="0.75"/>
        <ellipse cx="296" cy="136" rx="11" ry="6" fill="#fff" opacity="0.75"/>
        <ellipse cx="320" cy="164" rx="14" ry="6" fill="#fff" opacity="0.5"/>`;
    } else if (phase === 'dawn' || phase === 'dusk') {
      body += `<circle cx="300" cy="150" r="14" fill="#ffd08a"/><circle cx="300" cy="150" r="21" fill="#ffd08a" opacity="0.3"/>
        <ellipse cx="300" cy="166" rx="34" ry="7" fill="#ffb27a" opacity="0.35"/>
        <ellipse cx="284" cy="130" rx="15" ry="6" fill="#ffd9c0" opacity="0.55"/>`;
    } else {
      body += `<circle cx="320" cy="110" r="11" fill="#fff7e0"/><circle cx="314" cy="106" r="8.5" fill="url(#skyDyn)" opacity="0.6"/>
        <circle cx="280" cy="104" r="1.5" fill="#fff"/><circle cx="292" cy="126" r="1.2" fill="#fff"/>
        <circle cx="276" cy="150" r="1.4" fill="#fff"/><circle cx="330" cy="150" r="1.1" fill="#fff"/>
        <circle cx="300" cy="94" r="1" fill="#fff"/><circle cx="316" cy="172" r="1.2" fill="#fff"/>`;
    }
    return { body, SKY };
  }

  // 마이 룸 배경 — 텔레포트해 온 허름한 연금술 공방 (창문은 우측)
  function roomScene() {
    const phase = skyPhase();
    const sky = skyView(phase);
    // 낮일수록 실내도 조금 밝게
    const warm = (phase === 'day') ? 0.30 : (phase === 'dawn' || phase === 'dusk') ? 0.24 : 0.14;

    return `<svg class="room-svg" viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cbb99c"/><stop offset="1" stop-color="#9d8a70"/>
        </linearGradient>
        <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7d5c39" stop-opacity="1"/><stop offset="1" stop-color="#5a4026"/>
        </linearGradient>
        <linearGradient id="skyDyn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky.SKY[0]}"/><stop offset="1" stop-color="${sky.SKY[1]}"/>
        </linearGradient>
        <linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(255,240,190,${warm})"/><stop offset="1" stop-color="rgba(255,240,190,0)"/>
        </linearGradient>
        <radialGradient id="vigG" cx="0.5" cy="0.42" r="0.78">
          <stop offset="0.4" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(12,8,20,0.42)"/>
        </radialGradient>
      </defs>

      <!-- 돌벽 -->
      <rect x="0" y="0" width="400" height="240" fill="url(#wallG)"/>
      <g stroke="rgba(40,32,26,0.22)" stroke-width="2">
        <line x1="0" y1="60" x2="400" y2="60"/><line x1="0" y1="120" x2="400" y2="120"/><line x1="0" y1="180" x2="400" y2="180"/>
        <line x1="60" y1="0" x2="60" y2="60"/><line x1="210" y1="0" x2="210" y2="60"/><line x1="330" y1="0" x2="330" y2="60"/>
        <line x1="20" y1="60" x2="20" y2="120"/><line x1="140" y1="60" x2="140" y2="120"/><line x1="250" y1="60" x2="250" y2="120"/>
        <line x1="90" y1="120" x2="90" y2="180"/><line x1="360" y1="120" x2="360" y2="180"/>
      </g>
      <!-- 갈라진 금 -->
      <path d="M46,66 L56,96 L44,124 L56,158" stroke="rgba(40,32,26,0.28)" stroke-width="2.2" fill="none"/>
      <path d="M372,130 L362,160 L374,190" stroke="rgba(40,32,26,0.22)" stroke-width="1.8" fill="none"/>
      <!-- 거미줄 (좌상단) -->
      <g stroke="rgba(255,255,255,0.16)" stroke-width="1.4" fill="none">
        <path d="M0,0 L52,52 M0,26 L52,52 M26,0 L52,52"/>
        <path d="M10,10 Q24,16 28,28 M20,20 Q34,26 38,38"/>
      </g>

      <!-- 우측 아치 창문 (아바타 머리와 겹치지 않도록) -->
      <path d="M256,196 L256,120 A46,46 0 0 1 348,120 L348,196 Z" fill="#4a3a2c"/>
      <path d="M264,192 L264,122 A38,38 0 0 1 340,122 L340,192 Z" fill="#2a2438"/>
      <clipPath id="winClip"><path d="M264,192 L264,122 A38,38 0 0 1 340,122 L340,192 Z"/></clipPath>
      <g clip-path="url(#winClip)">${sky.body}</g>
      <line x1="302" y1="84" x2="302" y2="192" stroke="#4a3a2c" stroke-width="5"/>
      <line x1="264" y1="150" x2="340" y2="150" stroke="#4a3a2c" stroke-width="5"/>
      <path d="M256,196 L348,196 L352,204 L252,204 Z" fill="#4a3a2c"/>

      <!-- 낡은 선반 + 약병 (좌측) -->
      <rect x="24" y="176" width="92" height="7" rx="2" fill="#4a3a2c"/>
      <rect x="38" y="152" width="13" height="24" rx="4" fill="#5f7a6a"/>
      <rect x="60" y="158" width="12" height="18" rx="5" fill="#7a5f6a"/>
      <rect x="82" y="148" width="12" height="28" rx="4" fill="#6a6a4a"/>

      <!-- 나무 바닥 -->
      <rect x="0" y="235" width="400" height="85" fill="url(#floorG)"/>
      <rect x="0" y="235" width="400" height="6" fill="#43331f"/>
      <g stroke="#43331f" stroke-width="2" opacity="0.55">
        <line x1="120" y1="241" x2="70" y2="320"/><line x1="200" y1="241" x2="200" y2="320"/><line x1="280" y1="241" x2="330" y2="320"/>
        <line x1="40" y1="241" x2="-40" y2="320"/><line x1="360" y1="241" x2="440" y2="320"/>
      </g>
      <line x1="0" y1="280" x2="400" y2="280" stroke="#43331f" stroke-width="1.5" opacity="0.5"/>

      <!-- 창에서 들어오는 빛 -->
      <path d="M268,196 L338,196 L376,320 L236,320 Z" fill="url(#beamG)"/>
      <!-- 어두운 비네트 -->
      <rect x="0" y="0" width="400" height="320" fill="url(#vigG)"/>
    </svg>`;
  }

  window.Avatar = { build, getItem, roomScene, TUNE_KEYS };
})();
