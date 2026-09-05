// 마을 안 그림 — 탐험 › 마을 › (마을 하나) 에 들어갔을 때 깔리는 배경.
//
// **이름표는 여기서 그리지 않는다.** 배경만 SVG 로 그리고, 건물 이름은 game.js 가
// HTML 명판(`.vil-pin`)으로 얹는다. 이유는 두 가지다.
//   · 검증기가 재는 것은 HTML 글자다. SVG 글자로 그리면 대비·크기 검사가 통째로 빠진다
//   · 명판은 배경이 있는 딱지라 **대비를 실제로 잴 수 있다.** 그림 위 흰 글자
//     (`.on-room-bg`)는 잴 수 없어서 예외로 빼야 하는데, 예외는 최소한만 쓴다
//     (TEXT_POLICY 3-2)
//
// 건물 자리(x/y)는 데이터(`D.VILLAGES[].spots`)에 있고, 그림과 명판이 **같은 좌표**를
// 본다. 자리를 옮기면 둘이 같이 움직인다 — 서로 어긋날 수가 없다.
(function () {
  // SVG 의 id 는 문서 전체에서 공유된다. 마을 그림을 두 개 그릴 일은 없지만,
  // 마이 룸에서 한 번 크게 데었으므로(avatar.js 참고) 여기도 처음부터 붙여 둔다.
  let uid = 0;

  // **viewBox 의 세로 길이는 화면 높이를 정하지 않는다.**
  // 지도의 실제 높이는 CSS 가 정하고(`.vil-map` 의 height), SVG 는 그 상자를
  // `preserveAspectRatio="none"` 으로 채운다 — 그러지 않으면 폭이 넓을수록
  // 세로도 같이 길어져서 한 화면에 안 들어간다 (실제로 576px 까지 늘어났다).
  //
  // 여기 수치는 **그리기 좌표계**일 뿐이고, 화면 비율에 가깝게 잡아야 건물이 덜 늘어난다.
  // 자리를 2열로 놓으므로 줄 수는 건물 수의 절반이다.
  const W = 360;
  const COLS = 2;
  const hFor = n => Math.max(220, Math.ceil(n / COLS) * 88 + 40);

  // 마을마다 색만 갈아 끼운다 — 그리는 것은 같고 계절·시간대만 다른 느낌.
  // (마이 룸의 ROOM_SKIN 과 같은 방식)
  const SKIN = {
    vl_chimney: { sky: ['#cfe0ef', '#eaf1e6'], far: '#93ad8b', near: '#6d8f68',
                  road: '#cdb894', roof: '#8a5a4a', wall: '#e6dccb',
                  rock: '#8e8577', tree: '#4f7a52', crop: '#c8a94e' },
    vl_apple:   { sky: ['#f6dcc8', '#f3ead9'], far: '#b09a72', near: '#8d9a5f',
                  road: '#d3ba92', roof: '#a8483f', wall: '#efe2cd',
                  rock: '#9a8a70', tree: '#5f7a45', crop: '#cf9a3e' },
    vl_mirror:  { sky: ['#d5dcef', '#e7edf3'], far: '#8f97b0', near: '#6f7a95',
                  road: '#b9bccb', roof: '#5f6b86', wall: '#dfe4ee',
                  rock: '#7f8496', tree: '#4d5f74', crop: '#8d93a6' },
    // 사냥꾼 쉼터 — 깊은 숲의 늦가을. 나무가 짙고 하늘이 낮다
    vl_hunter:  { sky: ['#dfe3d4', '#eef0e4'], far: '#7d8a6a', near: '#5b6b4d',
                  road: '#b8a888', roof: '#6f5240', wall: '#ddd3bd',
                  rock: '#847b6a', tree: '#3f5c3d', crop: '#b4943f' },
    // 가시덤불 마을 — 붉은 가시와 잿빛 돌. 성을 감싼 울타리의 색이다
    vl_thorn:   { sky: ['#e8d8dc', '#f1e8e6'], far: '#9a8088', near: '#7a636c',
                  road: '#c2b1ac', roof: '#8a3f4b', wall: '#e4d9d6',
                  rock: '#877b80', tree: '#5a4450', crop: '#b26a72' },
    // ── 2막 ──
    // 유리관 호수 — 물빛. 거울 골짜기보다 **푸르고 밝다**: 그쪽은 「비치는 것」이고
    // 여기는 「가라앉은 것」이라, 같은 차가움이어도 물의 색이어야 한다
    vl_glass:   { sky: ['#d3e6ea', '#e9f2f2'], far: '#89a8ac', near: '#6b8f94',
                  road: '#bfc9c4', roof: '#5c7f86', wall: '#dfe9e8',
                  rock: '#7f8f92', tree: '#476b63', crop: '#8fb0a6' },
    // 은빛 갱도 — 은과 그을음. 일곱 굴뚝(난쟁이들의 «사는» 곳)보다 어둡고 금속빛이다.
    // 같은 난쟁이의 자리지만 이쪽은 **일터**라 흙보다 돌이 많다
    vl_mine:    { sky: ['#dcdde2', '#eceded'], far: '#8a8c95', near: '#6a6d78',
                  road: '#b3b5ba', roof: '#5b5f68', wall: '#d9dade',
                  rock: '#9aa0a6', tree: '#4e5a55', crop: '#a9adb4' },
    // ── 3막 ── 여왕의 첨탑 — **불의 색이다.** 그녀는 붉은 머리이고 연금술은 화덕이라
    // (STORY.md 「모습 — 붉은 머리」), 차가운 유리인 거울 골짜기와 정면으로 대비된다
    vl_spire:   { sky: ['#e7d2cc', '#f2e6e0'], far: '#8c6a68', near: '#6d4f52',
                  road: '#c0a89b', roof: '#7d2f38', wall: '#e4d6ce',
                  rock: '#8c7d77', tree: '#4f4046', crop: '#c08a4a' },
  };
  const DEF = SKIN.vl_chimney;

  // ─── 건물 모양 ───────────────────────────────────────────────
  // 값은 「(x, y, 색) → SVG 조각」. 좌표는 그 자리의 **바닥 한가운데**다.
  // 명판이 건물 위에 얹히므로 그림은 자리보다 **위로** 자란다.
  // 굴뚝 — **「일곱 굴뚝」 마을의 이름이 지도에서 세어져야 한다.**
  // 건물마다 따로 그리지 않고 이 조각 하나를 갖다 붙인다 (연기까지 같이).
  // **일곱 채가 모두 이 조각을 쓴다.** 건물마다 따로 그리면 세어지지 않고
  // (예전에 집·대장간·연금술 방이 각자 그린 굴뚝을 갖고 있었다) 연기도 제각각이 된다.
  // `class="chim"` 은 검사기가 굴뚝을 세는 표식이다.
  const chimney = (x, y, k, smoke) => `
    <g class="chim">
      <rect x="${x - 4}" y="${y - 16}" width="8" height="18" rx="1.5" fill="${k.roof}"/>
      <rect x="${x - 5.5}" y="${y - 18}" width="11" height="4" rx="1.5" fill="${k.roof}"/>
      <circle cx="${x + 1}" cy="${y - 24}" r="3.4" fill="${smoke || '#fff'}" opacity="0.55"/>
      <circle cx="${x + 5}" cy="${y - 31}" r="2.6" fill="${smoke || '#fff'}" opacity="0.4"/>
      <circle cx="${x + 1}" cy="${y - 37}" r="2" fill="${smoke || '#fff'}" opacity="0.28"/>
    </g>`;

  const SHAPES = {
    house: (x, y, k) => `
      <rect x="${x - 22}" y="${y - 28}" width="44" height="28" rx="2" fill="${k.wall}"/>
      <path d="M${x - 28},${y - 27} L${x},${y - 46} L${x + 28},${y - 27} Z" fill="${k.roof}"/>
      <rect x="${x - 6}" y="${y - 16}" width="12" height="16" rx="1" fill="${k.roof}" opacity="0.75"/>
      ${chimney(x + 14, y - 32, k)}`,
    forge: (x, y, k) => `
      <rect x="${x - 24}" y="${y - 26}" width="48" height="26" rx="2" fill="${k.wall}"/>
      <path d="M${x - 28},${y - 25} L${x + 28},${y - 25} L${x + 22},${y - 40} L${x - 22},${y - 40} Z" fill="${k.roof}"/>
      ${chimney(x + 11, y - 38, k, '#cfc4bc')}
      <ellipse cx="${x - 8}" cy="${y - 12}" rx="9" ry="8" fill="#e8944a" opacity="0.85"/>
      <ellipse cx="${x - 8}" cy="${y - 12}" rx="5" ry="4.5" fill="#ffd68a"/>`,
    tower: (x, y, k) => `
      <rect x="${x - 13}" y="${y - 52}" width="26" height="52" rx="2" fill="${k.wall}"/>
      <path d="M${x - 18},${y - 50} L${x},${y - 76} L${x + 18},${y - 50} Z" fill="${k.roof}"/>
      <rect x="${x - 5}" y="${y - 40}" width="10" height="13" rx="4" fill="${k.roof}" opacity="0.7"/>
      ${chimney(x + 14, y - 46, k)}`,
    shop: (x, y, k) => `
      <rect x="${x - 21}" y="${y - 26}" width="42" height="26" rx="2" fill="${k.wall}"/>
      <path d="M${x - 26},${y - 25} L${x},${y - 40} L${x + 26},${y - 25} Z" fill="${k.roof}"/>
      ${chimney(x + 13, y - 36, k)}
      <path d="M${x - 25},${y - 25} l0,9 l50,0 l0,-9 Z" fill="#f2f2f2"/>
      <path d="M${x - 25},${y - 16} l7,0 l0,-9 l-7,0 Z M${x - 11},${y - 16} l7,0 l0,-9 l-7,0 Z
               M${x + 3},${y - 16} l7,0 l0,-9 l-7,0 Z M${x + 17},${y - 16} l7,0 l0,-9 l-7,0 Z" fill="#d97a86"/>
      <rect x="${x - 8}" y="${y - 12}" width="16" height="12" rx="1" fill="${k.roof}" opacity="0.55"/>`,
    lab: (x, y, k) => `
      <rect x="${x - 20}" y="${y - 30}" width="40" height="30" rx="2" fill="${k.wall}"/>
      <path d="M${x - 24},${y - 29} L${x},${y - 44} L${x + 24},${y - 29} Z" fill="${k.roof}"/>
      ${chimney(x - 9, y - 30, k, '#cbb6e8')}
      <rect x="${x + 2}" y="${y - 18}" width="11" height="14" rx="2" fill="#8fd0c0" opacity="0.9"/>`,
    mine: (x, y, k) => `
      <path d="M${x - 34},${y} L${x - 20},${y - 40} L${x + 20},${y - 40} L${x + 34},${y} Z" fill="${k.rock}"/>
      <path d="M${x - 20},${y - 40} L${x + 20},${y - 40} L${x + 12},${y - 48} L${x - 12},${y - 48} Z" fill="${k.rock}" opacity="0.75"/>
      <path d="M${x - 13},${y} L${x - 13},${y - 20} Q${x},${y - 32} ${x + 13},${y - 20} L${x + 13},${y} Z" fill="#3f3730"/>
      <rect x="${x - 17}" y="${y - 22}" width="4" height="22" fill="#7a5a3c"/>
      <rect x="${x + 13}" y="${y - 22}" width="4" height="22" fill="#7a5a3c"/>
      <rect x="${x - 19}" y="${y - 26}" width="38" height="5" rx="1" fill="#7a5a3c"/>
      ${chimney(x + 24, y - 30, k)}`,
    farm: (x, y, k) => {
      let out = `<path d="M${x - 38},${y} L${x - 30},${y - 20} L${x + 30},${y - 20} L${x + 38},${y} Z"
        fill="${k.crop}" opacity="0.85"/>`;
      for (let i = 0; i < 4; i++) {                       // 밭이랑
        const iy = y - 4 - i * 4.4, w = 34 - i * 3;
        out += `<path d="M${x - w},${iy} L${x + w},${iy}" stroke="#8a6f38" stroke-width="1.4" opacity="0.45"/>`;
      }
      for (let i = 0; i < 3; i++) {                       // 사과나무
        const tx = x - 24 + i * 24, ty = y - 22;
        out += `<rect x="${tx - 2}" y="${ty - 9}" width="4" height="10" fill="#7a5a3c"/>
          <circle cx="${tx}" cy="${ty - 16}" r="11" fill="${k.tree}"/>
          <circle cx="${tx - 4}" cy="${ty - 19}" r="2.4" fill="#d8534a"/>
          <circle cx="${tx + 5}" cy="${ty - 14}" r="2.4" fill="#d8534a"/>
          <circle cx="${tx + 1}" cy="${ty - 22}" r="2.2" fill="#d8534a"/>`;
      }
      return out;
    },
    well: (x, y, k) => `
      <ellipse cx="${x}" cy="${y - 3}" rx="16" ry="6" fill="${k.wall}"/>
      <rect x="${x - 14}" y="${y - 14}" width="28" height="11" rx="2" fill="${k.wall}"/>
      <rect x="${x - 12}" y="${y - 15}" width="24" height="4" rx="2" fill="${k.roof}" opacity="0.6"/>
      <rect x="${x - 13}" y="${y - 38}" width="4" height="24" fill="#7a5a3c"/>
      <rect x="${x + 9}" y="${y - 38}" width="4" height="24" fill="#7a5a3c"/>
      <path d="M${x - 19},${y - 36} L${x},${y - 48} L${x + 19},${y - 36} Z" fill="${k.roof}"/>`,
    water: (x, y, k) => `
      <ellipse cx="${x}" cy="${y - 10}" rx="38" ry="15" fill="#bcd6e6" opacity="0.95"/>
      <ellipse cx="${x}" cy="${y - 10}" rx="38" ry="15" fill="none" stroke="${k.near}" stroke-width="2" opacity="0.5"/>
      <ellipse cx="${x - 8}" cy="${y - 13}" rx="14" ry="4" fill="#fff" opacity="0.6"/>
      <ellipse cx="${x + 12}" cy="${y - 6}" rx="8" ry="2.5" fill="#fff" opacity="0.4"/>`,
    ruin: (x, y, k) => `
      <rect x="${x - 22}" y="${y - 24}" width="44" height="24" rx="2" fill="${k.wall}" opacity="0.9"/>
      <path d="M${x - 26},${y - 23} L${x - 4},${y - 40} L${x + 6},${y - 30} L${x + 16},${y - 36} L${x + 26},${y - 23} Z"
        fill="${k.roof}" opacity="0.8"/>
      <rect x="${x - 4}" y="${y - 14}" width="10" height="14" rx="1" fill="#5b4b46" opacity="0.55"/>
      <path d="M${x + 12},${y - 20} l4,7 l-4,6" stroke="#6b5a52" stroke-width="1.6" fill="none" opacity="0.7"/>`,
  };

  // ─── 배경 ───────────────────────────────────────────────────
  // 언덕 두 겹 + 건물들을 잇는 길. 길이 있어야 「지도」로 읽힌다.
  function ground(k, H) {
    const a = H * 0.16, b = H * 0.24;   // 언덕 두 겹의 능선 높이 (비율로 잡아 높이에 따라간다)
    return `
      <path d="M0,${a} Q60,${a - 26} 120,${a - 4} Q190,${a + 20} 240,${a - 10} Q276,${a - 28} 300,${a - 16} L300,${H} L0,${H} Z" fill="${k.far}"/>
      <path d="M0,${b + 30} Q70,${b + 4} 138,${b + 26} Q208,${b + 48} 256,${b + 22} Q282,${b + 8} 300,${b + 16} L300,${H} L0,${H} Z" fill="${k.near}"/>`;
  }

  // 벌판이 단색이면 그림이 아니라 색종이로 보인다. 자잘한 것을 흩어 둔다.
  // **자리는 계산으로 고정한다** — 무작위면 다시 그릴 때마다 튀어서 산만해진다.
  function scatter(k, H, skip) {
    let out = '';
    for (let i = 0; i < 22; i++) {
      const t = (i * 37) % 100, u = (i * 61) % 100;
      const x = 8 + (t / 100) * 284, y = H * (0.2 + (u / 100) * 0.78);
      // 길과 건물이 지나는 가운데 띠는 비워 둔다 (겹쳐 보이면 지저분하다)
      if (skip.some(s => Math.abs(x - (s.x / 100) * W) < 46 && Math.abs(y - (s.y / 100) * H) < 46)) continue;
      const r = 5 + (i % 3) * 2.2;
      out += (i % 4 === 0)
        ? `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 1.5).toFixed(1)}" ry="${(r * 0.5).toFixed(1)}"
             fill="${k.tree}" opacity="0.28"/>`
        : `<rect x="${(x - 1.4).toFixed(1)}" y="${(y - 6).toFixed(1)}" width="2.8" height="7" fill="#7a5a3c" opacity="0.6"/>
           <circle cx="${x.toFixed(1)}" cy="${(y - 9).toFixed(1)}" r="${r.toFixed(1)}" fill="${k.tree}" opacity="0.75"/>`;
    }
    return out;
  }

  function road(spots, k, H) {
    if (!spots.length) return '';
    const px = s => (s.x / 100) * W, py = s => (s.y / 100) * H;
    let d = `M${px(spots[0]).toFixed(1)},${(py(spots[0]) + 6).toFixed(1)}`;
    for (let i = 1; i < spots.length; i++) {
      const a = spots[i - 1], b = spots[i];
      const mx = (px(a) + px(b)) / 2, my = (py(a) + py(b)) / 2;
      d += ` Q${(px(a) + (mx - px(a)) * 0.2).toFixed(1)},${(my + 10).toFixed(1)}`
         + ` ${px(b).toFixed(1)},${(py(b) + 6).toFixed(1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${k.road}" stroke-width="9"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  }

  // village : D.VILLAGES 의 한 칸
  function scene(village) {
    const v = village || {};
    const k = SKIN[v.id] || DEF;
    const u = 'v' + (++uid);
    const spots = v.spots || [];
    const H = hFor(spots.length);
    const build = spots.map(s => {
      const fn = SHAPES[s.shape] || SHAPES.house;
      return fn((s.x / 100) * W, (s.y / 100) * H, k);
    }).join('');
    return `<svg class="vil-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="vsky_${u}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k.sky[0]}"/><stop offset="1" stop-color="${k.sky[1]}"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vsky_${u})"/>
      ${ground(k, H)}
      ${scatter(k, H, spots)}
      ${road(spots, k, H)}
      ${build}
    </svg>`;
  }

  // ─── 건물 안 (NPC 대화 화면의 배경) ────────────────────────
  // 사람은 아직 없다. **빈 자리를 그린다** — 나중에 초상화가 그 자리에 들어온다
  // (STORY.md 의 SPEAKERS 표). 지금 대충 사람을 그려 넣으면 나중에 지워야 한다.
  const IW = 300, IH = 200;
  function interior(spot, vid) {
    const k = SKIN[vid] || DEF;
    const u = 'i' + (++uid);
    const s = spot || {};
    // 가게·연금술 방은 안쪽 물건이 다르다. 나머지는 같은 방을 쓴다
    const kind = (s.shape === 'shop' || s.shape === 'lab') ? s.shape : 'room';
    const props = {
      shop: `
        <rect x="26" y="96" width="86" height="8" rx="2" fill="#8a6a4c"/>
        <rect x="26" y="128" width="86" height="8" rx="2" fill="#8a6a4c"/>
        ${[0,1,2,3].map(i => `<rect x="${32 + i * 20}" y="78" width="13" height="18" rx="3" fill="${['#c9899a','#8fc3b0','#e0c07a','#a6a0cf'][i]}"/>`).join('')}
        ${[0,1,2].map(i => `<rect x="${36 + i * 26}" y="112" width="17" height="16" rx="2" fill="#cbb08c"/>`).join('')}`,
      lab: `
        <rect x="26" y="104" width="88" height="8" rx="2" fill="#8a6a4c"/>
        ${[0,1,2].map(i => `<path d="M${40 + i * 26},84 l0,9 l-6,11 l12,0 l-6,-11 Z" fill="#9fd8c6" opacity="0.9"/>`).join('')}
        <ellipse cx="196" cy="150" rx="30" ry="10" fill="#6b5a52"/>
        <path d="M172,150 q24,-34 48,0 Z" fill="#4a4a55"/>
        <ellipse cx="196" cy="128" rx="16" ry="5" fill="#b39be0" opacity="0.85"/>`,
      room: `
        <rect x="26" y="100" width="80" height="8" rx="2" fill="#8a6a4c"/>
        ${[0,1,2].map(i => `<rect x="${34 + i * 24}" y="82" width="15" height="18" rx="2" fill="#cbb08c"/>`).join('')}
        <rect x="168" y="120" width="70" height="10" rx="3" fill="#8a6a4c"/>
        <rect x="176" y="130" width="8" height="22" fill="#7a5a3c"/>
        <rect x="222" y="130" width="8" height="22" fill="#7a5a3c"/>`,
    }[kind];
    return `<svg class="npc-svg" viewBox="0 0 ${IW} ${IH}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="iw_${u}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k.wall}"/><stop offset="1" stop-color="${k.roof}" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${IW}" height="${IH}" fill="url(#iw_${u})"/>
      <rect x="0" y="152" width="${IW}" height="48" fill="#8a6a4c"/>
      <rect x="0" y="152" width="${IW}" height="5" fill="#6b5137"/>
      ${[0,1,2,3,4,5].map(i => `<rect x="${i * 50}" y="157" width="2" height="43" fill="#6b5137" opacity="0.5"/>`).join('')}
      <rect x="196" y="34" width="70" height="54" rx="4" fill="${k.roof}" opacity="0.55"/>
      <rect x="202" y="40" width="58" height="42" rx="3" fill="${k.sky[0]}"/>
      <rect x="230" y="40" width="3" height="42" fill="${k.roof}" opacity="0.55"/>
      ${props}
      <ellipse cx="150" cy="158" rx="34" ry="8" fill="#000" opacity="0.14"/>
    </svg>`;
  }

  window.Village = { scene, interior, W, hFor };
})();
