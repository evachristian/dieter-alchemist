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
  const INK = '#3f3239';

  // ─── 몸통 ─────────────────────────────────────────────────
  // 어떤 몸통이든 **얼굴이 (50,44) 언저리**에 오도록 잡는다.
  // 그래야 눈·뿔·귀 부품이 몸통을 안 가리고 한 벌로 쓰인다.
  // ⚠️ **네발짐승을 한 가지로 두면 안 된다.** 처음에 `quad` 하나로 열일곱 마리를 그렸더니
  // 여우·고양이·담비·곰·사슴이 **색만 다른 같은 그림**이 됐다. 몸집과 다리 길이로 셋을 나눈다.
  const leg = (d, xs, y, w, h) => xs.map(x =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${d}"/>`).join('');
  const BODY = {
    // 둥근 덩어리 — 개구리 · 거북 · 두꺼비 · 달팽이. 다리가 없다
    blob: (c, d) => `<ellipse cx="50" cy="58" rx="31" ry="24" fill="${c}"/>
      <ellipse cx="50" cy="68" rx="23" ry="12" fill="${d}" opacity="0.3"/>
      <ellipse cx="50" cy="42" rx="24" ry="21" fill="${c}"/>`,
    // 날씬한 네발 — 고양이 · 여우 · 담비 · 도마뱀
    quad: (c, d) => `<ellipse cx="58" cy="62" rx="23" ry="14" fill="${c}"/>
      ${leg(d, [42, 53, 66], 72, 6, 15)}
      <circle cx="36" cy="44" r="17" fill="${c}"/>`,
    // 몸집 큰 네발 — 곰 · 두더지 · 천산갑. 다리가 짧고 굵다
    bear: (c, d) => `<ellipse cx="56" cy="58" rx="28" ry="21" fill="${c}"/>
      ${leg(d, [38, 52, 68], 74, 9, 12)}
      <circle cx="32" cy="40" r="19" fill="${c}"/>`,
    // 다리 긴 네발 — 사슴 · 염소 · 유니콘 · 토끼. 머리가 높이 있다
    deer: (c, d) => `<ellipse cx="58" cy="54" rx="20" ry="13" fill="${c}"/>
      ${leg(d, [44, 54, 70], 64, 5, 22)}
      <path d="M42,52 q-4,-10 -4,-16" stroke="${c}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="37" cy="34" r="15" fill="${c}"/>`,
    // 새 — 몸이 서 있고 다리가 가늘다
    bird: (c, d) => `<ellipse cx="52" cy="60" rx="20" ry="21" fill="${c}"/>
      <path d="M46,79 L45,89 M58,79 L59,89" stroke="${d}" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="50" cy="40" r="16" fill="${c}"/>
      <path d="M38,42 L30,46 L38,50 Z" fill="${tint(d, 50)}"/>`,
    // 벌레 — **날개가 주인공이다.** 몸은 작게 두어야 나비로 읽힌다
    bug: (c, d) => `<ellipse cx="50" cy="62" rx="7" ry="16" fill="${d}"/>
      <path d="M45,26 q-4,-8 -8,-10 M55,26 q4,-8 8,-10" stroke="${d}" stroke-width="2.2"
        fill="none" stroke-linecap="round"/>
      <circle cx="43" cy="16" r="2.6" fill="${d}"/><circle cx="57" cy="16" r="2.6" fill="${d}"/>
      <circle cx="50" cy="34" r="12" fill="${c}"/>`,
    // 물고기 — 옆으로 누운 방울. 머리가 왼쪽이다
    fish: (c, d) => `<path d="M74,54 C74,40 60,32 46,32 C30,32 18,42 18,54 C18,66 30,76 46,76 C60,76 74,68 74,54 Z" fill="${c}"/>
      <path d="M22,60 C32,70 58,70 70,60 C58,72 32,72 22,60 Z" fill="${d}" opacity="0.35"/>
      <path d="M30,34 q6,-6 14,-4" stroke="${tint(c, 55)}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  };
  // 얼굴 한가운데가 어디인가 — 눈·귀·뿔이 이 값을 보고 자리를 잡는다
  const FACE = {
    blob: [50, 42], quad: [36, 44], bear: [32, 40], deer: [37, 34],
    bird: [50, 40], bug: [50, 34], fish: [36, 50],
  };
  // 무늬를 어디에 얹나 — **몸통마다 덩어리가 있는 자리가 다르다.**
  // 예전에는 한 자리에 박아 두어서 나방은 무늬가 날개 위에 뜨고 새는 몸 밖으로 나갔다
  const PAT_AT = {
    blob: [58, 60, 1.0], quad: [62, 62, 0.9], bear: [62, 58, 1.1], deer: [62, 54, 0.8],
    bird: [56, 62, 0.9], bug: [50, 62, 0.5], fish: [50, 54, 1.0],
  };

  // ─── 귀 ───────────────────────────────────────────────────
  const EAR = {
    none: () => '',
    round: (x, y, c, d) => `<circle cx="${x - 14}" cy="${y - 12}" r="7" fill="${c}"/>
      <circle cx="${x + 14}" cy="${y - 12}" r="7" fill="${c}"/>
      <circle cx="${x - 14}" cy="${y - 12}" r="3.4" fill="${d}"/>
      <circle cx="${x + 14}" cy="${y - 12}" r="3.4" fill="${d}"/>`,
    long: (x, y, c, d) => `<ellipse cx="${x - 9}" cy="${y - 22}" rx="5" ry="14" fill="${c}" transform="rotate(-12 ${x - 9} ${y - 22})"/>
      <ellipse cx="${x + 9}" cy="${y - 22}" rx="5" ry="14" fill="${c}" transform="rotate(12 ${x + 9} ${y - 22})"/>
      <ellipse cx="${x - 9}" cy="${y - 22}" rx="2.2" ry="9" fill="${d}" transform="rotate(-12 ${x - 9} ${y - 22})"/>
      <ellipse cx="${x + 9}" cy="${y - 22}" rx="2.2" ry="9" fill="${d}" transform="rotate(12 ${x + 9} ${y - 22})"/>`,
    tuft: (x, y, c) => `<path d="M${x - 16},${y - 8} L${x - 12},${y - 22} L${x - 4},${y - 12} Z" fill="${c}"/>
      <path d="M${x + 16},${y - 8} L${x + 12},${y - 22} L${x + 4},${y - 12} Z" fill="${c}"/>`,
    fin: (x, y, c) => `<path d="M${x - 12},${y - 4} q-12,-8 -14,4 q10,4 14,-4 Z" fill="${c}" opacity="0.85"/>
      <path d="M${x + 12},${y - 4} q12,-8 14,4 q-10,4 -14,-4 Z" fill="${c}" opacity="0.85"/>`,
  };

  // ─── 뿔 ───────────────────────────────────────────────────
  // ⚠️ **뿔은 귀보다 안쪽·위로 뺀다.** 처음에는 귀와 같은 자리에 있어서 긴 귀에 통째로
  // 가려졌다 (구름 염소의 뿔이 아예 안 보였다). 그리고 **테두리를 준다** —
  // 몸과 같은 계열 색이라 테두리가 없으면 배경 판에 묻힌다 (수정 천산갑이 그랬다).
  const HORN = {
    none: () => '',
    single: (x, y, c, o) => `<path d="M${x},${y - 36} L${x - 5},${y - 17} L${x + 5},${y - 17} Z"
        fill="${c}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M${x - 1},${y - 31} L${x + 2},${y - 21}" stroke="#fff" stroke-width="1.4" opacity="0.55"/>`,
    pair: (x, y, c, o) => `<path d="M${x - 6},${y - 15} q-5,-13 1,-17 q4,7 4,16 Z"
        fill="${c}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M${x + 6},${y - 15} q5,-13 -1,-17 q-4,7 -4,16 Z"
        fill="${c}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>`,
    antler: (x, y, c, o) => `<path d="M${x - 6},${y - 15} L${x - 10},${y - 30} M${x - 10},${y - 24} L${x - 17},${y - 28}
        M${x + 6},${y - 15} L${x + 10},${y - 30} M${x + 10},${y - 24} L${x + 17},${y - 28}"
      stroke="${o}" stroke-width="4.4" fill="none" stroke-linecap="round"/>
      <path d="M${x - 6},${y - 15} L${x - 10},${y - 30} M${x - 10},${y - 24} L${x - 17},${y - 28}
        M${x + 6},${y - 15} L${x + 10},${y - 30} M${x + 10},${y - 24} L${x + 17},${y - 28}"
      stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    crystal: (x, y, c, o) => `<path d="M${x - 4},${y - 17} L${x - 7},${y - 28} L${x},${y - 34} L${x + 7},${y - 28} L${x + 4},${y - 17} Z"
        fill="${c}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M${x},${y - 33} L${x},${y - 18}" stroke="#fff" stroke-width="1.2" opacity="0.5"/>`,
  };

  // ─── 날개 ─────────────────────────────────────────────────
  // **몸통보다 먼저 그린다** — 뒤로 펼쳐진 것이라 몸이 위에 와야 붙어 보인다
  const WING = {
    none: () => '',
    butterfly: (c, d) => `<ellipse cx="26" cy="40" rx="17" ry="14" fill="${c}" opacity="0.85" transform="rotate(-18 26 40)"/>
      <ellipse cx="74" cy="40" rx="17" ry="14" fill="${c}" opacity="0.85" transform="rotate(18 74 40)"/>
      <ellipse cx="28" cy="60" rx="12" ry="10" fill="${d}" opacity="0.8"/>
      <ellipse cx="72" cy="60" rx="12" ry="10" fill="${d}" opacity="0.8"/>`,
    bird: (c) => `<path d="M28,52 q-22,-6 -22,10 q14,6 24,-4 Z" fill="${c}" opacity="0.9"/>
      <path d="M72,52 q22,-6 22,10 q-14,6 -24,-4 Z" fill="${c}" opacity="0.9"/>`,
    bat: (c) => `<path d="M28,46 q-20,-2 -24,12 q10,-4 12,2 q4,-6 8,0 q2,-8 4,-14 Z" fill="${c}"/>
      <path d="M72,46 q20,-2 24,12 q-10,-4 -12,2 q-4,-6 -8,0 q-2,-8 -4,-14 Z" fill="${c}"/>`,
    fin: (c) => `<path d="M30,44 q-16,-10 -18,4 q10,6 18,-4 Z" fill="${c}" opacity="0.7"/>
      <path d="M66,44 q16,-10 18,4 q-10,6 -18,-4 Z" fill="${c}" opacity="0.7"/>`,
  };

  // ─── 꼬리 ─────────────────────────────────────────────────
  const TAIL = {
    none: () => '',
    puff: (c) => `<circle cx="82" cy="60" r="10" fill="${c}"/>`,
    long: (c) => `<path d="M78,62 q18,-4 14,-22" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    fish: (c) => `<path d="M72,54 L92,42 L92,66 Z" fill="${c}" opacity="0.9"/>`,
    leaf: (c) => `<path d="M78,60 q16,-2 16,-16 q-14,2 -16,16 Z" fill="${c}"/>`,
  };

  // ─── 눈 ───────────────────────────────────────────────────
  // **몸통마다 얼굴 자리가 다르므로 좌표를 받아서 그린다.**
  const EYE = {
    dot: (x, y) => `<circle cx="${x - 6}" cy="${y}" r="3" fill="${INK}"/><circle cx="${x + 6}" cy="${y}" r="3" fill="${INK}"/>`,
    round: (x, y) => `<ellipse cx="${x - 6}" cy="${y}" rx="4" ry="4.6" fill="${INK}"/>
      <ellipse cx="${x + 6}" cy="${y}" rx="4" ry="4.6" fill="${INK}"/>
      <circle cx="${x - 4.8}" cy="${y - 1.4}" r="1.5" fill="#fff"/><circle cx="${x + 7.2}" cy="${y - 1.4}" r="1.5" fill="#fff"/>`,
    sleepy: (x, y) => `<path d="M${x - 10},${y} q4,4 8,0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M${x + 2},${y} q4,4 8,0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    sharp: (x, y) => `<path d="M${x - 10},${y - 3} L${x - 2},${y} L${x - 10},${y + 3} Z" fill="${INK}"/>
      <path d="M${x + 10},${y - 3} L${x + 2},${y} L${x + 10},${y + 3} Z" fill="${INK}"/>`,
  };

  // ─── 무늬 ─────────────────────────────────────────────────
  // 몸통 위에 얹는다. **몸통 모양을 모르므로 가운데께에만 얹는다** —
  // 밖으로 나가면 실루엣이 깨진다
  const PAT = {
    none: () => '',
    spot: (d) => `<circle cx="-4" cy="-4" r="4" fill="${d}" opacity="0.45"/>
      <circle cx="6" cy="2" r="3" fill="${d}" opacity="0.45"/>
      <circle cx="0" cy="8" r="2.4" fill="${d}" opacity="0.45"/>`,
    stripe: (d) => `<path d="M-8,-8 q4,10 0,18 M2,-8 q4,10 0,18" stroke="${d}" stroke-width="3"
      fill="none" opacity="0.4" stroke-linecap="round"/>`,
    glow: (c) => `<circle cx="0" cy="0" r="13" fill="${tint(c, 70)}" opacity="0.45"/>`,
  };

  // 크리처 한 마리를 그린다.
  //   c    : data.js 의 `result` (id · attr · art …)
  //   opts.size  픽셀 크기 (기본은 CSS 가 정한다)
  //   opts.flat  배경 판 없이 — 목록 칸처럼 이미 판이 있는 자리에 쓴다
  function draw(c, opts) {
    if (!c || !c.art) return '';
    opts = opts || {};
    const u = 'c' + (++uid);
    const attr = (window.GameData && GameData.creatureAttr(c.attr)) || { color: '#9a8fb0' };
    const base = attr.color;
    const dark = shade(base, 26);
    const light = tint(base, 42);
    const a = c.art;
    const [fx, fy] = FACE[a.body] || FACE.quad;

    const body = (BODY[a.body] || BODY.quad)(base, dark);
    const wing = (WING[a.wing] || WING.none)(light, base);
    const tail = (TAIL[a.tail] || TAIL.none)(dark);
    const ear = (EAR[a.ear] || EAR.none)(fx, fy, base, dark);
    const horn = (HORN[a.horn] || HORN.none)(fx, fy, tint(base, 62), shade(base, 34));
    const eye = (EYE[a.eye] || EYE.dot)(fx, fy);
    // 무늬는 **제 좌표계(0,0 기준)로 그려 두고** 몸통마다 자리를 옮겨 얹는다 —
    // 좌표를 박아 두면 몸통을 바꿀 때마다 무늬가 몸 밖으로 나간다
    const [px, py, ps] = PAT_AT[a.body] || PAT_AT.quad;
    const patInner = (PAT[a.pat] || PAT.none)(a.pat === 'glow' ? base : dark);
    const pat = patInner ? `<g transform="translate(${px},${py}) scale(${ps})">${patInner}</g>` : '';

    // 그리는 순서가 곧 앞뒤다: 날개·꼬리(뒤) → 몸통 → 무늬 → 귀·뿔 → 눈
    return `<svg class="cr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${(c.name || '').replace(/"/g, '')}"
      ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''}>
      ${opts.flat ? '' : `<circle cx="50" cy="50" r="49" fill="${tint(base, 84)}"/>`}
      <ellipse cx="50" cy="88" rx="26" ry="5" fill="${dark}" opacity="0.18"/>
      ${wing}${tail}${body}${pat}${ear}${horn}${eye}
    </svg>`;
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

  window.Creature = { draw, icon, of, W, H, BODY, EAR, HORN, WING, TAIL, EYE, PAT };
})();
