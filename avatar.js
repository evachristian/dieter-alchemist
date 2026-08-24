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
    // 허리 높이. 예전에는 196 이라 잘록한 지점이 골반 바로 위까지 내려와,
    // 상체가 길고 허리가 없어 보였다. 턱(105)~가랑이(228) 사이의 66% 지점으로 올려 잡는다.
    // **옷의 허리선도 전부 이 값을 본다** — 여기만 고치면 상의·치마·드레스가 같이 따라온다.
    waistY: 184, hipY: 214,
    // 허리 반폭 (waistY 에서 중심선 100 으로부터의 거리). '허리' 배율이 이 값을 늘이고 줄인다.
    // **옷의 허리도 이 값을 따라간다** — 예전에는 드레스 허리가 78~122 로 박혀 있어
    // 몸통 허리(70~130)보다 좁았고, 그래서 허리 살이 드레스 밖으로 나왔다.
    waistHalf: 30,
    // 엉덩이 — 허리보다 넓어야 여성 실루엣이 산다. '엉덩이' 배율이 이 값을 늘이고 줄인다.
    // 예전에는 몸통이 hipY 에서 한 점(100,214)으로 모여, 허벅지(78~122)와 만나는 곳이
    // 뚝 끊겨 보였다. 둥근 엉덩이가 그 사이를 잇는다.
    hipHalf: 34,
    hipBottom: 228,                 // 엉덩이 아래 끝 (허벅지와 겹쳐 이어진다)
    thighHalf: 22,                  // 허벅지 바깥 (78 / 122)
    // 팔: (x, y=120) 에서 시작하는 폭 armW 의 막대를 어깨 기준으로 회전.
    // **팔을 옮기면 소매도 같이 따라온다** — armShape() 이 이 값만 본다.
    // 몸통 쪽으로 조금 붙이고(52→55) 벌어짐을 줄였다(7°→4°). 예전에는 날씬할 때
    // 몸통은 허리로 좁아지는데 팔은 바깥으로 벌어져, 팔이 몸에서 떨어져 보였다.
    armX_L: 55, armX_R: 130, armY: 120, armH: 94, armW: 15,
    armRot: 4, armPivotL: 62, armPivotR: 138, armPivotY: 130,
    // 팔꿈치 — 팔은 윗팔/아랫팔 두 마디다. 아랫팔이 몸 쪽으로 살짝 굽는다.
    //   elbowT   팔 길이에서 팔꿈치가 있는 비율 (해부학적으로 윗팔이 조금 길다)
    //   elbowRot 아랫팔이 안쪽으로 굽는 각도. **9° 를 크게 넘기지 말 것** —
    //            더 굽히면 손이 치마 뒤로 완전히 숨고, 아랫팔이 커버리지 검사의
    //            몸통 창(x 72~128)에 들어가 위반으로 잡힌다. 지금은 팔 자체가
    //            4°(armRot) 바깥으로 기울어 있어 굽힘과 상쇄돼 2~4px 여유가 있다
    elbowT: 0.56, elbowRot: 9,
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
  function armShape(side, fill, pad, h, tune, opts) {
    const B = BODY, left = side === 'L', o = opts || {};
    const d = armShift(tune) * (left ? 1 : -1);       // 어깨선을 따라 팔을 옮긴다
    const x0 = (left ? B.armX_L : B.armX_R) + d;
    const w = B.armW + pad * 2;
    const rot = left ? B.armRot : -B.armRot;
    const bend = left ? -B.elbowRot : B.elbowRot;     // 안쪽(몸 쪽)으로
    const pivot = (left ? B.armPivotL : B.armPivotR) + d;
    const cx = x0 + B.armW / 2;
    const upLen = B.armH * B.elbowT;                  // 팔꿈치까지의 길이
    const elbowY = B.armY + upLen;
    // 그릴 구간을 팔 위 끝(armY)에서 잰 거리로 바꾼다
    const from = (o.yFrom != null ? o.yFrom : B.armY - pad) - B.armY;
    const to = from + h;
    // 팔꿈치를 지나는 조각은 **반폭만큼 겹쳐 늘린다** — 캡슐 두 개를 맞대기만 하면
    // 둥근 끝 사이에 초승달 모양 틈이 생긴다. 늘리면 두 캡의 원 중심이 팔꿈치에서
    // 정확히 겹쳐 이음매가 사라진다 (굽혀도 회전축이 그 점이라 그대로 겹친다)
    const OV = w / 2;
    const baseRot = `rotate(${rot} ${+pivot.toFixed(2)} ${B.armPivotY})`;
    // 그릴 조각들을 먼저 모은다 — 테두리가 있으면 두 번 그려야 해서(아래 참조) 목록이 필요하다
    const segs = [];
    // 윗팔 조각
    const upFrom = from, upTo = Math.min(to, upLen);
    if (upTo > upFrom) {
      segs.push({ y: B.armY + upFrom, h: (upTo - upFrom) + (to > upLen ? OV : 0), tr: baseRot });
    }
    // 아랫팔 조각 — 팔꿈치 기준 회전이 하나 더 붙는다 (기울기 → 굽힘 순으로 적용된다)
    const foFrom = Math.max(from, upLen), foTo = to;
    if (foTo > foFrom) {
      const ext = (from < upLen ? OV : 0);
      segs.push({ y: B.armY + foFrom - ext, h: (foTo - foFrom) + ext,
        tr: `${baseRot} rotate(${bend} ${+cx.toFixed(2)} ${+elbowY.toFixed(2)})` });
    }
    const emit = (list, extra) => list.map(g =>
      `<rect x="${+(x0 - pad).toFixed(2)}" y="${+g.y.toFixed(2)}" width="${w}" height="${g.h.toFixed(2)}"
        rx="${(w / 2).toFixed(1)}" fill="${fill}"${extra} transform="${g.tr}"/>`).join('');
    let out = emit(segs, o.extra || '');
    // 테두리(맨팔의 ARM_EDGE)가 있으면 두 마디의 테두리가 팔꿈치에서 교차해
    // 이음매 선이 보인다. **관절 주변(±12px)만 채움 전용 덮개를 얹어** 그 선을 덮는다.
    // 팔 전체를 두 번 칠하면 안 되는 이유: 가장자리의 반투명 픽셀이 겹쳐 진해지는데,
    // 캡 소매의 둥근 모서리가 잘라낸 자리에서 그 픽셀이 살색 판정으로 굳어
    // 커버리지 검사에 걸렸다 (dress_maxi 에서 실제로 났다). 관절 근처는 어떤 검사
    // 창(x 72~128 · y ≤145)에도 안 들어가므로 덮개만은 안전하다.
    if (o.extra && from < upLen && to > upLen) {
      const pf = Math.max(from, upLen - 12), pt = Math.min(to, upLen + 12);
      out += emit([
        { y: B.armY + pf, h: (upLen - pf) + OV, tr: baseRot },
        { y: B.armY + upLen - OV, h: (pt - upLen) + OV,
          tr: `${baseRot} rotate(${bend} ${+cx.toFixed(2)} ${+elbowY.toFixed(2)})` },
      ], '');
    }
    return wrapX(out, tuneOf(tune, 'arm'), cx);
  }

  // 팔 중심선 위의 한 점 — dist 는 팔 위 끝(armY)에서 잰 거리.
  // 손 위치 계산용이라 armShift(체형 이동)는 넣지 않는다 (기존 손 계산과 같은 기준).
  function armPoint(side, dist) {
    const B = BODY, left = side === 'L';
    const rot = (left ? B.armRot : -B.armRot) * Math.PI / 180;
    const bend = (left ? -B.elbowRot : B.elbowRot) * Math.PI / 180;
    const cx = (left ? B.armX_L : B.armX_R) + B.armW / 2;
    const pivot = left ? B.armPivotL : B.armPivotR;
    const upLen = B.armH * B.elbowT, elbowY = B.armY + upLen;
    const rotAbout = (p, a, o) => ({
      x: o.x + (p.x - o.x) * Math.cos(a) - (p.y - o.y) * Math.sin(a),
      y: o.y + (p.x - o.x) * Math.sin(a) + (p.y - o.y) * Math.cos(a),
    });
    let p = { x: cx, y: B.armY + dist };
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

  // 구두 — 발(ellipse cx 86/114, cy 335)을 덮는다. rise 만큼 발목 위로 올라온다
  function renderShoes(it, tune) {
    if (isNone(it)) return '';
    const c = it.color, c2 = shade(c, 22), rise = Number(it.rise) || 0;
    const fin = it.finish || ({ maryjane: 'strap', ballet: 'ribbon', sneaker: 'sole',
      glass: 'gloss', boots: 'plain' }[it.kind] || 'plain');
    const foot = (cx) => {
      let s = '';
      if (rise > 0) {   // 부츠·스니커즈: 발목을 감싸는 통
        s += `<rect x="${cx - 9}" y="${335 - rise}" width="18" height="${rise + 4}" rx="5" fill="${c}"/>`;
      }
      s += `<ellipse cx="${cx}" cy="335" rx="13" ry="7.6" fill="${c}"/>`;
      // 마감(finish) — 목 높이(rise)와 함께 두 축이다.
      // 옛 세이브는 kind 로만 갈렸다 — finish 가 없으면 그때 규칙으로 떨어진다
      if (fin === 'strap')      s += `<path d="M${cx - 9},331 L${cx + 9},331" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>`;
      else if (fin === 'ribbon') s += `<path d="M${cx - 7},330 Q${cx},334 ${cx + 7},330" stroke="${c2}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
        + `<circle cx="${cx}" cy="330" r="2" fill="${c2}"/>`;
      else if (fin === 'sole')  s += `<ellipse cx="${cx}" cy="338" rx="13" ry="3.4" fill="${c2}"/>`;
      else if (fin === 'gloss') s += `<ellipse cx="${cx - 3}" cy="333" rx="5" ry="2.4" fill="#fff" opacity="0.75"/>`;
      // 목이 있는 구두는 입구에 띠를 하나 둘러 발목과 경계가 보이게 한다
      if (rise > 0) s += `<path d="M${cx - 9},${335 - rise + 5} L${cx + 9},${335 - rise + 5}" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>`;
      return s;
    };
    return `<g data-part="shoes">${foot(86)}${foot(114)}</g>`;
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

  // 허리 반폭 — 몸과 옷이 **같은 값**을 본다. 옷은 CLOTH_PAD 만큼 넉넉하게.
  const waistHalf = tune => BODY.waistHalf * tuneOf(tune, 'waist');
  const clothWaistHalf = tune => waistHalf(tune) + CLOTH_PAD;
  // 엉덩이 — 옷은 여기도 덮어야 한다 (치마·바지·드레스가 이 값을 본다)
  const hipHalf = tune => BODY.hipHalf * tuneOf(tune, 'hip');
  const clothHipHalf = tune => hipHalf(tune) + CLOTH_PAD;

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
    const kh = tuneOf(tune, 'hip');
    const B = BODY, wh = waistHalf(tune), hh = B.hipHalf;
    const wL = +(100 - wh).toFixed(2), wR = +(100 + wh).toFixed(2);
    const hL = +(100 - hh).toFixed(2), hR = +(100 + hh).toFixed(2);
    const tL = 100 - B.thighHalf - 1, tR = 100 + B.thighHalf + 1;
    // 몸통 옆선이 허리로 좁아지는 곡선. 제어점을 어깨(133)~허리 사이의 **비율**로 잡아,
    // waistY 를 올리고 내려도 곡선 모양이 그대로 따라오게 한다
    const cy1 = +(133 + (B.waistY - 133) * 0.46).toFixed(1);
    const cy2 = +(133 + (B.waistY - 133) * 0.68).toFixed(1);
    return `
      <rect x="91" y="96" width="18" height="20" rx="7" fill="${SKIN_SH}"/>
      <g data-part="hip">
        <g${sx(kh, 100)}><path d="M${wL},${B.waistY}
          C${hL},${B.waistY + 10} ${hL},${B.hipY + 2} ${tL},${B.hipBottom}
          L${tR},${B.hipBottom}
          C${hR},${B.hipY + 2} ${hR},${B.waistY + 10} ${wR},${B.waistY} Z" fill="${SKIN}"/></g>
      </g>
      <g data-part="torso">
        <g${sx(kb, 100)}><path d="M100,108
          C${B.torsoR - 20},108 ${B.torsoR},117 ${B.torsoR},133
          C${B.torsoR},${cy1} ${wR + 3},${cy2} ${wR},${B.waistY}
          L${wL},${B.waistY}
          C${wL - 3},${cy2} ${B.torsoL},${cy1} ${B.torsoL},133
          C${B.torsoL},117 ${B.torsoL + 20},108 100,108 Z" fill="${SKIN}"/></g>
      </g>
      <g data-part="arm">
        ${armShape('L', SKIN, 0, BODY.armH, tune, { extra: ARM_EDGE })}
        ${armShape('R', SKIN, 0, BODY.armH, tune, { extra: ARM_EDGE })}
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
      case 'side':        // 사이드뱅 — 한쪽으로 넘긴 가르마
        return `<path d="M67,61 C66,36 134,36 133,61 C126,49 112,50 100,64 C99,50 95,48 91,53 C85,45 74,49 67,61 Z" fill="${c}"/>`;
      case 'curtain':     // 커튼뱅 — 가운데를 열고 양옆으로 갈라 내린다
        return `<path d="M68,60 C66,38 78,30 100,30 C122,30 134,38 132,60
            C130,46 120,38 104,40 C102,52 100,58 99,70 C96,54 90,44 84,42 C76,44 70,50 68,60 Z" fill="${c}"/>`;
      case 'sheer':       // 시스루뱅 — 얇게 내려 이마가 비친다.
        // 두 겹으로 나눈다: 위쪽은 그대로, 아래쪽만 옅게. 한 겹을 통째로 옅게 하면
        // 일자뱅과 구분이 안 됐다 (컨택트시트에서 실제로 그랬다)
        return `<path d="M68,58 C66,38 78,30 100,30 C122,30 134,38 132,58
            C126,52 116,51 108,57 C104,51 96,51 92,57 C84,51 74,52 68,58 Z" fill="${c}" opacity="0.4"/>
          <path d="M68,48 C70,36 82,30 100,30 C118,30 130,36 132,48 Z" fill="${c}"/>`;
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
  function hairIcon(it, color) {
    const c = color || HAIR_DEF;
    const back = (it && it.back) || (it && it.kind) || 'long';
    const bang = (it && it.bang) || 'straight';
    // 머리만 잘라 낸다. 꼬리 끝(양갈래 y168 · 포니테일 y182)까지 담으면 세로로 길어져
    // 옷장 칸에서 폭이 24px 밖에 안 나온다 — 앞머리가 구분되지 않았다.
    // 그래서 어깨 높이에서 자른다. 뒷머리 차이는 얼굴 옆 가닥에서 이미 보인다
    return `<svg class="hair-icon" viewBox="42 12 116 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
  const SLEEVE_H = { none: 0, cap: 20, short: 42, half: 66, long: 94 };
  function sleeveH(it) {
    const v = SLEEVE_H[it && it.sleeve];
    return v == null ? SLEEVE_H.short : v;
  }

  // 넥라인 — **선으로만 그린다.** 옷을 파내지 않으므로 어떤 넥라인을 골라도
  // 어깨·가슴 구간이 드러나지 않는다 (UI_POLICY 3 의 어깨 커버리지 검사).
  //   ty = 옷의 목 부분 윗선 y
  function neckLine(kind, c, c2, ty) {
    const S3 = ` stroke-width="3" fill="none" stroke-linecap="round"`;
    if (kind === 'v') {
      return `<path d="M89,${ty + 2} L100,${ty + 22} L111,${ty + 2}" stroke="${c2}"${S3} stroke-linejoin="round"/>`;
    }
    if (kind === 'square') {
      return `<path d="M84,${ty + 1} L84,${ty + 18} L116,${ty + 18} L116,${ty + 1}" stroke="${c2}"${S3} stroke-linejoin="round"/>`;
    }
    if (kind === 'polo') {
      // 폴라(터틀넥)는 목까지 올라온다 — 목을 덮는 통을 하나 더 얹는다
      return `<rect x="87" y="${ty - 14}" width="26" height="20" rx="8" fill="${c}"/>
        <path d="M89,${ty - 12} L111,${ty - 12}" stroke="${c2}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    return `<path d="M88,${ty + 4} Q100,${ty + 15} 112,${ty + 4}" stroke="${c2}"${S3}/>`;
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
    const B = BODY, c = it.color, c2 = shade(c), sh = sleeveH(it);
    const kb = tuneOf(tune, 'torso');   // 소매는 armShape 이 알아서 팔 배율을 따른다
    const ww = clothWaistHalf(tune);
    const wL = +(100 - ww).toFixed(2), wR = +(100 + ww).toFixed(2);
    // 밑단은 **골반 바로 위**까지 내려온다. 허리(WY)에 맞추면 배가 드러나 전부 크롭탑이 되고,
    // 하의 허리춤(WY 에서 시작)을 덮지 못해 그 사이로 살이 띠처럼 보인다.
    const WY = B.waistY, hem = B.hipY - 2;
    return `
      ${sh ? armShape('L', c, 2, sh, tune) + armShape('R', c, 2, sh, tune) : ''}
      ${it.puff ? puffShoulder(c, tune) : ''}
      ${wrapX(`<path d="M100,110 C120,110 140,116 140,132
        C140,${WY - 34} ${wR + 4},${WY - 18} ${wR},${WY}
        C${wR},${WY + 10} ${wR - 1},${hem - 8} ${wR - 4},${hem}
        C${wR - 14},${hem + 5} ${wL + 14},${hem + 5} ${wL + 4},${hem}
        C${wL + 1},${hem - 8} ${wL},${WY + 10} ${wL},${WY}
        C${wL - 4},${WY - 18} 60,${WY - 34} 60,132
        C60,116 80,110 100,110 Z" fill="${c}"/>
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
    const HY = B.hipY, WY = B.waistY;
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
      // 무릎(268) 아래까지 오는 치마는 종아리까지 덮으므로 종아리 배율도 따라야 한다
      const k = tuneMax(tune, hemY > 268 ? ['torso', 'thigh', 'calf'] : ['torso', 'thigh']);
      return wrapX(`<path d="M${wL},${WY} L${wR},${WY}
          C${hR},${WY + 6} ${hR},${HY - 6} ${hR},${HY}
          C${(100 + midHalf).toFixed(1)},${my.toFixed(1)} ${(100 + hemHalf).toFixed(1)},${hemY - 18} ${(100 + hemHalf).toFixed(1)},${hemY}
          C${(100 + bulge).toFixed(1)},${hemY + 14} ${(100 - bulge).toFixed(1)},${hemY + 14} ${(100 - hemHalf).toFixed(1)},${hemY}
          C${(100 - hemHalf).toFixed(1)},${hemY - 18} ${(100 - midHalf).toFixed(1)},${my.toFixed(1)} ${hL},${HY}
          C${hL},${HY - 6} ${hL},${WY + 6} ${wL},${WY} Z" fill="${c}"/>${belt}`, k, 100);
    }

    // 바지 계열 — 반바지도 같은 실루엣이고 기장만 다르다.
    // 가랑이 홈은 엉덩이 아래(hipBottom)에서 시작한다 — 위로 파면 엉덩이 살이 홈으로 드러난다
    const hemY = Math.max(B.hipBottom + 12, Number(it.hemY) || 332);
    const ky = HY + (hemY - HY) * 0.3;         // 옆선이 다리 폭으로 좁아지는 지점
    const k = tuneMax(tune, hemY > 268 ? ['torso', 'thigh', 'calf'] : ['torso', 'thigh']);
    return wrapX(`<path d="M${wL},${WY} L${wR},${WY}
        C${hR},${WY + 6} ${hR},${HY - 6} ${hR},${HY}
        C${hR},${HY + 12} 129,${ky.toFixed(1)} 127,${(ky + 12).toFixed(1)} L127,${hemY} L107,${hemY} L100,${B.hipBottom + 2} L93,${hemY} L73,${hemY} L73,${(ky + 12).toFixed(1)}
        C71,${ky.toFixed(1)} ${hL},${HY + 12} ${hL},${HY}
        C${hL},${HY - 6} ${hL},${WY + 6} ${wL},${WY} Z" fill="${c}"/>${belt}`, k, 100);
  }

  // 소매(팔을 덮는 부분)를 몸의 팔 좌표 그대로 만들어 준다.
  // len: 팔 길이의 몇 %까지 덮을지 (나머지는 손으로 드러남)
  function sleeves(c, len, tune) {
    const B = BODY, pad = CLOTH_PAD;
    const w = B.armW + pad * 2;                 // 팔보다 좌우로 pad 만큼 넓게
    const h = B.armH * len + pad;
    // 손 위치 = 소매 끝. armPoint 가 팔꿈치 굽힘까지 따라간다
    const hL = armPoint('L', B.armH * len), hR = armPoint('R', B.armH * len);
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

    // 기장·퍼짐·넥라인·소매는 전부 아이템 필드다 (없으면 예전 값 그대로)
    const B = BODY;
    const hemY = Number(it.hemY) || (it.kind === 'gown' ? 320 : 270);
    const flare = Number(it.flare) || (it.kind === 'gown' ? 40 : 46);
    const sh = sleeveH(it);
    // 허리는 몸의 허리를 따라간다 (예전에는 78~122 로 박혀 있어 허리 살이 밖으로 나왔다)
    const ww = clothWaistHalf(tune), hhw = clothHipHalf(tune);
    const WY = B.waistY;
    const wL = +(100 - ww).toFixed(2), wR = +(100 + ww).toFixed(2);
    const hL = +(100 - hhw).toFixed(2), hR = +(100 + hhw).toFixed(2);
    return `
      ${sh ? armShape('L', c, 2, sh, tune) + armShape('R', c, 2, sh, tune) : ''}
      ${it.puff ? puffShoulder(c, tune) : ''}
      ${wrapX(`<path d="M100,110
        C120,110 140,116 140,132
        C140,${WY - 34} ${wR + 4},${WY - 18} ${wR},${WY + 2}
        C${hR},${WY + 8} ${hR},${B.hipY - 6} ${hR},${B.hipY}
        C${hR},${B.hipY + 24} ${100 + flare},${hemY - 40} ${100 + flare + 8},${hemY}
        C${wR},${hemY + 14} ${wL},${hemY + 14} ${100 - flare - 8},${hemY}
        C${100 - flare},${hemY - 40} ${hL},${B.hipY + 24} ${hL},${B.hipY}
        C${hL},${B.hipY - 6} ${hL},${WY + 8} ${wL},${WY + 2}
        C${wL - 4},${WY - 18} 60,${WY - 34} 60,132
        C60,116 80,110 100,110 Z" fill="${c}"/>
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
    // 머리 계열 — '얼굴' 배율은 여기서 **머리 전체**에 건다.
    // 예전에는 얼굴 타원(data-part="head")에만 걸려 있어서, 얼굴을 줄이면
    // 머리카락만 원래 크기로 남아 가발을 쓴 것처럼 됐다.
    // 머리카락·귀걸이·서클렛이 전부 H() 를 지나므로 여기 한 곳이면 다 따라온다.
    const kFace = tuneOf(tune, 'face');
    const H = s => (s ? `<g transform="${headT}">${wrapU(s, kFace, 100, NECK_Y)}</g>` : s);
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
      B(torsoArms(tune)),
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
      H(faceAndExpression(expItem)),
      H(hairFront(hairBangKind, hairColor)),
      B(renderGlove(pick('glove', outfit.glove), tune)),
      B(renderTattoo(getItem('tattoo', outfit.tattoo))),
      H(renderEarring(pick('earring', outfit.earring))),
      B(renderNecklace(pick('necklace', outfit.necklace))),
      H(renderCirclet(pick('circlet', outfit.circlet))),
    ];

    return `<svg class="avatar-svg" viewBox="0 0 200 348" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="내 아바타">
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
  function roomScene(level, extra) {
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

    const floor = `
      <rect x="0" y="235" width="400" height="85" fill="url(#${ID('floorG')})"/>
      <rect x="0" y="235" width="400" height="6" fill="${k.floor[1]}"/>
      <g stroke="${k.floor[1]}" stroke-width="2" opacity="0.55">
        <line x1="120" y1="241" x2="70" y2="320"/><line x1="200" y1="241" x2="200" y2="320"/><line x1="280" y1="241" x2="330" y2="320"/>
        <line x1="40" y1="241" x2="-40" y2="320"/><line x1="360" y1="241" x2="440" y2="320"/>
      </g>
      <line x1="0" y1="280" x2="400" y2="280" stroke="${k.floor[1]}" stroke-width="1.5" opacity="0.5"/>`;

    const beam = `<path d="M${WIN.ix},${WIN.iy + WIN.ih} L${WIN.ix + WIN.iw},${WIN.iy + WIN.ih}
      L${WIN.ix + WIN.iw + 40},320 L${WIN.ix - 40},320 Z" fill="url(#${ID('beamG')})"/>`;

    const FIXED = { '@window': win, '@floor': floor, '@beam': beam };
    const body = ROOM_Z.map(id => FIXED[id] || (want.has(id) && ROOM_PROPS[id] ? ROOM_PROPS[id](k) : '')).join('');

    return `<svg class="room-svg" viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
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
        <radialGradient id="${ID('vigG')}" cx="0.5" cy="0.42" r="0.78">
          <stop offset="0.4" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(12,8,20,${(0.46 - lv * 0.05).toFixed(2)})"/>
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="400" height="240" fill="url(#${ID('wallG')})"/>
      ${lv <= 3 ? stone : ''}
      ${body}
      <rect x="0" y="0" width="400" height="320" fill="url(#${ID('vigG')})"/>
    </svg>`;
  }

  window.Avatar = { build, getItem, roomScene, hairIcon, TUNE_KEYS, ROOM_MAX, ROOM_DEFAULT, ROOM_PROPS, ROOM_LEVELS };
})();
