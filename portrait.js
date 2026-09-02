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

  // ─── 머리 ─────────────────────────────────────────────────
  // back = 얼굴 뒤로 흐르는 덩어리 / front = 얼굴 위에 얹히는 앞머리
  //
  // **얼굴 뒤를 먼저 채운다.** 머리 부품들은 안쪽을 파 놓은 띠(crescent)라,
  // 얼굴 타원(cx60 cy66 rx26 ry30)보다 넓은 자리에서는 그 사이로 배경이 비쳤다 —
  // 관자놀이에서 6px 짜리 틈이 나서 **머리와 얼굴이 떨어져 보였다.**
  // (오릭스·슈타르크·발렌·클레멘·이그리트가 그랬다)
  //
  // 이 덩어리는 **모든 머리 모양의 실루엣 안쪽**에 들어가도록 잡아서, 어떤 조합이든
  // 바깥으로 삐져나오지 않는다. 아래는 얼굴이 덮고, 위는 앞머리가 덮는다.
  // 머리를 새로 늘려도 이건 그대로 쓴다 — 새 부품이 안쪽을 얼마나 파든 상관없다.
  // **모든 머리 모양보다 안쪽**에 있어야 한다. 가장 좁은 것(short x30~90 · updo 위끝 26)보다
  // 더 좁게 잡아 두어야 이 채움이 실루엣을 대신 정하는 일이 없다 — 그러면 머리 모양을
  // 바꿔도 윤곽이 안 따라오는 이상한 일이 생긴다.
  const HAIR_FILL = c => `<path data-part="hair-fill" d="M32,58 C32,34 46,28 60,28 C74,28 88,34 88,58 Z" fill="${c}"/>`;

  // ⚠️ **앞머리(front)의 안쪽 선이 곧 헤어라인이다.**
  // 예전에는 그 선이 y=34~40 이라 얼굴(위끝 36)에 거의 안 걸쳐 있었고,
  // **이마가 통째로 드러나 둥근 민머리처럼** 보였다.
  // 눈이 y=66 이므로 헤어라인은 **얼굴 위끝과 눈 사이(≈50)** 에 와야 사람 얼굴로 읽힌다.
  // 관자놀이 쪽은 더 내려와야(≈58) 옆이 비지 않는다.
  const HAIR = {
    short:  { back: c => `<path data-part="hair-back" d="M30,58 C30,30 44,22 60,22 C76,22 90,30 90,58 Z" fill="${c}"/>`,
              front: c => `<path data-part="hair-front" d="M30,58 C30,30 44,22 60,22 C76,22 90,30 90,58
                            C86,53 76,50 60,50 C44,50 34,53 30,58 Z" fill="${c}"/>` },
    long:   { back: c => `<path data-part="hair-back" d="M28,60 C28,30 42,20 60,20 C78,20 92,30 92,60 L92,112 L82,112 L84,60 L36,60 L38,112 L28,112 Z" fill="${c}"/>`,
              // 옆으로 흐르는 가르마 — 한쪽이 더 길게 내려온다
              front: c => `<path data-part="hair-front" d="M28,60 C28,30 42,20 60,20 C78,20 92,30 92,60
                            C88,52 80,46 68,49 C58,52 44,55 36,53 C32,52 30,55 28,60 Z" fill="${c}"/>` },
    wave:   { back: c => `<path data-part="hair-back" d="M28,58 C28,30 42,20 60,20 C78,20 92,30 92,58 C94,74 88,84 90,104 C84,96 82,88 84,74 C86,58 82,46 60,46 C38,46 34,58 36,74 C38,88 36,96 30,104 C32,84 26,74 28,58 Z" fill="${c}"/>`,
              front: c => `<path data-part="hair-front" d="M28,58 C28,30 42,20 60,20 C78,20 92,30 92,58
                            C88,49 80,44 71,47 C63,51 49,51 40,47 C35,44 31,50 28,58 Z" fill="${c}"/>` },
    updo:   { back: c => `<circle data-part="hair-back" cx="60" cy="22" r="12" fill="${c}"/>
                <path data-part="hair-back" d="M31,56 C31,32 44,26 60,26 C76,26 89,32 89,56 Z" fill="${c}"/>`,
              // 올림머리도 앞은 있다. 없으면 이마만 남는다
              front: c => `<path data-part="hair-front" d="M31,56 C31,32 44,26 60,26 C76,26 89,32 89,56
                            C85,51 76,48 60,48 C44,48 35,51 31,56 Z" fill="${c}"/>` },
    wild:   { back: c => `<path data-part="hair-back" d="M26,60 C26,28 42,18 60,18 C78,18 94,28 94,60 L89,53 L93,72 L84,59 L86,80 L77,61 L73,78 L66,59 L60,76 L54,59 L47,78 L43,61 L34,80 L36,59 L27,72 L31,53 Z" fill="${c}"/>`,
              // 뻗친 머리 — 헤어라인이 들쭉날쭉하되 이마를 덮는 높이는 같다
              front: c => `<path data-part="hair-front" d="M28,58 C28,28 42,20 60,20 C78,20 92,28 92,58
                            C87,49 82,55 72,49 C64,55 54,47 46,54 C39,58 32,50 28,58 Z" fill="${c}"/>` },
    bald:   { back: () => '', front: () => '' },
  };

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
    circlet: c => `<path d="M34,46 Q60,36 86,46" stroke="${c}" stroke-width="3.4" fill="none"/>
                   <circle cx="60" cy="39" r="4.6" fill="${c}"/>`,
    hood:    c => `<path d="M20,66 C20,28 38,12 60,12 C82,12 100,28 100,66 L92,66 C92,36 78,24 60,24 C42,24 28,36 28,66 Z" fill="${c}"/>`,
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
    const eye = EYE[m.eye] || EYE.normal;
    // 눈썹은 **없는 것이 기본**이다 — 기본 표정은 눈썹 없이도 읽히고,
    // 있는 쪽이 예외라야 얼굴이 안 시끄럽다. 안쪽 끝을 내리거나 올려 각도를 만든다
    const brow = BROW[m.brow] || null;
    return `<svg class="pt-svg ${bare ? 'bare' : ''}" viewBox="0 0 ${W} ${H}"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name || ''}">
      ${bare ? '' : `<defs><clipPath id="ptc_${u}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath></defs>`}
      <g ${bare ? '' : `clip-path="url(#ptc_${u})"`}>
        ${bare ? '' : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sp.bg || '#efe6f2'}"/>`}
        ${sp.deco === 'hood' ? DECO.hood(sp.decoColor || sp.cloth) : ''}
        ${sp.hair === 'bald' ? '' : HAIR_FILL(sp.hairColor)}
        ${hair.back(sp.hairColor)}
        <path d="M34,110 C34,96 46,90 60,90 C74,90 86,96 86,110 L92,130 L28,130 Z" fill="${sp.cloth}"/>
        <path d="M52,88 L68,88 L68,98 C64,102 56,102 52,98 Z" fill="${sp.skin}"/>
        <ellipse data-part="face" cx="60" cy="66" rx="26" ry="30" fill="${sp.skin}"/>
        ${BEARD[sp.beard || 'none'](sp.hairColor)}
        ${hair.front ? hair.front(sp.hairColor) : ''}
        ${brow ? brow(50, 1) + brow(70, -1) : ''}
        ${eye(50, sp.eyeColor || '#3f3239')}${eye(70, sp.eyeColor || '#3f3239')}
        ${MOUTH[m.mouth] || MOUTH.calm}
        ${sp.deco && sp.deco !== 'hood' ? DECO[sp.deco](sp.decoColor || '#ffd76a') : ''}
      </g>
    </svg>`;
  }

  window.Portrait = { bust, W, H };
})();
