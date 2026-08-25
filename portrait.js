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
  const HAIR = {
    short:  { back: c => `<path d="M28,58 C28,26 44,16 60,16 C76,16 92,26 92,58 L92,44 C88,34 74,30 60,30 C46,30 32,34 28,44 Z" fill="${c}"/>`,
              front: c => `<path d="M30,48 C32,28 46,20 60,20 C74,20 88,28 90,48 C84,38 72,34 60,34 C48,34 36,38 30,48 Z" fill="${c}"/>` },
    long:   { back: c => `<path d="M24,60 C24,26 42,14 60,14 C78,14 96,26 96,60 L96,112 L84,112 L86,52 C82,38 72,32 60,32 C48,32 38,38 34,52 L36,112 L24,112 Z" fill="${c}"/>`,
              front: c => `<path d="M30,50 C32,28 46,20 60,20 C74,20 88,28 90,50 C86,40 76,36 66,40 C58,44 48,50 40,50 C36,50 32,46 30,50 Z" fill="${c}"/>` },
    wave:   { back: c => `<path d="M24,58 C24,26 42,14 60,14 C78,14 96,26 96,58 C96,74 90,84 92,104 C86,96 84,88 86,74 C88,58 84,42 60,42 C36,42 32,58 34,74 C36,88 34,96 28,104 C30,84 24,74 24,58 Z" fill="${c}"/>`,
              front: c => `<path d="M30,50 C32,28 46,20 60,20 C74,20 88,28 90,50 C86,42 78,38 70,44 C62,50 50,54 42,50 C36,47 32,45 30,50 Z" fill="${c}"/>` },
    updo:   { back: c => `<circle cx="60" cy="18" r="13" fill="${c}"/>
                <path d="M28,56 C28,28 44,20 60,20 C76,20 92,28 92,56 L92,46 C88,36 74,32 60,32 C46,32 32,36 28,46 Z" fill="${c}"/>` },
    wild:   { back: c => `<path d="M22,60 C22,24 42,12 60,12 C78,12 98,24 98,60 L92,52 L96,72 L86,58 L88,80 L78,60 L74,78 L66,58 L60,76 L54,58 L46,78 L42,60 L32,80 L34,58 L24,72 L28,52 Z" fill="${c}"/>`,
              front: c => `<path d="M28,52 C30,26 46,18 60,18 C74,18 90,26 92,52 C86,40 78,44 70,38 C62,44 52,36 44,44 C38,48 32,44 28,52 Z" fill="${c}"/>` },
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
  };

  const MOUTH = {
    smile: '<path d="M52,84 q8,7 16,0" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    grin:  '<path d="M50,82 q10,11 20,0 z" fill="#a4636c"/><path d="M52,83 q8,3 16,0" fill="#fff"/>',
    calm:  '<path d="M54,84 q6,2 12,0" stroke="#a4636c" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    flat:  '<path d="M53,85 L67,85" stroke="#a4636c" stroke-width="2.4" stroke-linecap="round"/>',
    smirk: '<path d="M52,85 q9,4 16,-4" stroke="#a4636c" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
  };

  const BEARD = {
    none: () => '',
    stub: c => `<path d="M36,74 C38,92 48,100 60,100 C72,100 82,92 84,74 C82,88 72,94 60,94 C48,94 38,88 36,74 Z" fill="${c}" opacity="0.32"/>`,
    full: c => `<path d="M34,70 C34,96 46,108 60,108 C74,108 86,96 86,70 C84,86 76,88 68,86 L68,80 L52,80 L52,86 C44,88 36,86 34,70 Z" fill="${c}"/>`,
  };

  // ─── 장식 ─────────────────────────────────────────────────
  const DECO = {
    none:    () => '',
    crown:   c => `<path d="M40,22 L46,10 L52,20 L60,6 L68,20 L74,10 L80,22 Z" fill="${c}"/>
                   <rect x="40" y="22" width="40" height="6" rx="2" fill="${c}"/>`,
    circlet: c => `<path d="M36,34 Q60,24 84,34" stroke="${c}" stroke-width="3.4" fill="none"/>
                   <circle cx="60" cy="27" r="4.6" fill="${c}"/>`,
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
    const hair = HAIR[sp.hair] || HAIR.short;
    const eye = EYE[m.eye] || EYE.normal;
    return `<svg class="pt-svg ${bare ? 'bare' : ''}" viewBox="0 0 ${W} ${H}"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name || ''}">
      ${bare ? '' : `<defs><clipPath id="ptc_${u}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath></defs>`}
      <g ${bare ? '' : `clip-path="url(#ptc_${u})"`}>
        ${bare ? '' : `<rect x="0" y="0" width="${W}" height="${H}" fill="${sp.bg || '#efe6f2'}"/>`}
        ${sp.deco === 'hood' ? DECO.hood(sp.decoColor || sp.cloth) : ''}
        ${hair.back(sp.hairColor)}
        <path d="M34,110 C34,96 46,90 60,90 C74,90 86,96 86,110 L92,130 L28,130 Z" fill="${sp.cloth}"/>
        <path d="M52,88 L68,88 L68,98 C64,102 56,102 52,98 Z" fill="${sp.skin}"/>
        <ellipse cx="60" cy="66" rx="26" ry="30" fill="${sp.skin}"/>
        ${BEARD[sp.beard || 'none'](sp.hairColor)}
        ${hair.front ? hair.front(sp.hairColor) : ''}
        ${eye(50, sp.eyeColor || '#3f3239')}${eye(70, sp.eyeColor || '#3f3239')}
        ${MOUTH[m.mouth] || MOUTH.calm}
        ${sp.deco && sp.deco !== 'hood' ? DECO[sp.deco](sp.decoColor || '#ffd76a') : ''}
      </g>
    </svg>`;
  }

  window.Portrait = { bust, W, H };
})();
