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

  // ─── 건물 «안» ───────────────────────────────────────────────
  // ⚠️⚠️ **모양(`shape`)마다 다른 방이다.** 오래 `shop`·`lab`·«나머지 전부» 셋으로만
  //   갈라서, **대장간도 여관도 광산도 탑도 같은 방**이었다 (선반 + 탁자 + 창문).
  //   「대장간이 대장간 같지 않다」로 신고받은 자리다.
  //   데이터에 모양이 열 가지 있으므로(`D.VILLAGES[].spots[].shape`) 열을 다 그린다 —
  //   **표를 손으로 적지 않고 `ROOM` 한 곳에서 나온다**, 그래야 모양을 늘렸을 때
  //   빠진 것이 바로 드러난다 (`checkdata` 가 표와 데이터를 견준다).
  //
  // ⚠️⚠️ **사람이 서는 자리는 «재서» 정한다 — 짐작으로 두면 물건이 등 뒤에 숨는다.**
  //   `.npc-figure` 는 무대 높이의 96% 이고 오른쪽에 붙으므로, 그림이 실제로 칠하는
  //   자리는 세 폭(420·360·265px)에서 다 **x 211~276** 이다. 그래서 물건은
  //   **x 6~206** 안에 둔다. 처음에 그냥 「오른쪽 3분의 1」로 적어 두었다가
  //   여관의 창문 · 광산의 광차 · 탑의 아치창 · 우물의 나무통을 통째로 등 뒤에 놓았다
  // ⚠️ `preserveAspectRatio="slice"` 지만 `.npc-svg` 가 `aspect-ratio: 3/2` 로 못 박혀
  //   있어 실제로는 거의 안 잘린다. 그래도 여유로 x<6 에는 중요한 것을 두지 않는다
  const IW = 300, IH = 200, FY = 152;   // FY = 바닥 선

  // 바닥 넷 — 나무 · 돌 · 흙 · 물
  const FLOOR = {
    wood: () => `<rect x="0" y="${FY}" width="${IW}" height="${IH - FY}" fill="#8a6a4c"/>
      <rect x="0" y="${FY}" width="${IW}" height="5" fill="#6b5137"/>
      ${[0,1,2,3,4,5].map(i => `<rect x="${i * 50}" y="${FY + 5}" width="2" height="${IH - FY - 5}" fill="#6b5137" opacity="0.5"/>`).join('')}`,
    stone: () => `<rect x="0" y="${FY}" width="${IW}" height="${IH - FY}" fill="#7d7973"/>
      <rect x="0" y="${FY}" width="${IW}" height="5" fill="#5f5c58"/>
      ${[0,1,2,3,4,5,6].map(i => `<rect x="${i * 44 + (i % 2 ? 22 : 0)}" y="${FY + 5}" width="2" height="${IH - FY - 5}" fill="#5f5c58" opacity="0.45"/>`).join('')}
      <rect x="0" y="${FY + 26}" width="${IW}" height="2" fill="#5f5c58" opacity="0.45"/>`,
    dirt: () => `<rect x="0" y="${FY}" width="${IW}" height="${IH - FY}" fill="#6e5c46"/>
      <rect x="0" y="${FY}" width="${IW}" height="4" fill="#574835"/>
      ${[18,62,104,150,196,242,278].map((x, i) => `<ellipse cx="${x}" cy="${FY + 14 + (i % 3) * 9}" rx="${5 + (i % 3)}" ry="3" fill="#8a7a63"/>`).join('')}`,
    water: k => `<rect x="0" y="${FY}" width="${IW}" height="${IH - FY}" fill="${k.rock}" opacity="0.5"/>
      <rect x="0" y="${FY + 10}" width="${IW}" height="${IH - FY - 10}" fill="#6f9fb4"/>
      ${[0,1,2,3].map(i => `<path d="M${i * 80 - 10},${FY + 26 + i * 8} q20,-5 40,0 q20,5 40,0" stroke="#a7cadb" stroke-width="2.4" fill="none" opacity="0.8"/>`).join('')}`,
  };

  // 벽 넷 — 회벽(기본) · 돌 · 바위(갱도) · 바깥(트인 곳)
  const WALL = {
    plaster: (k, u) => `<rect x="0" y="0" width="${IW}" height="${IH}" fill="url(#iw_${u})"/>`,
    stone: (k, u) => `<rect x="0" y="0" width="${IW}" height="${IH}" fill="#9a958c"/>
      ${[0,1,2,3,4].map(r => [0,1,2,3,4,5,6].map(c =>
        `<rect x="${c * 46 + (r % 2 ? 23 : 0) - 10}" y="${r * 32}" width="43" height="29" rx="3" fill="#8e8980" opacity="${0.5 + (c % 2) * 0.2}"/>`).join('')).join('')}`,
    rock: (k, u) => `<rect x="0" y="0" width="${IW}" height="${IH}" fill="#4e4238"/>
      ${[[40,30,46],[120,18,58],[210,36,50],[276,20,44]].map(([x, y, r]) =>
        `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="#5c4f42"/>`).join('')}
      <rect x="0" y="0" width="${IW}" height="${IH}" fill="#2c241d" opacity="0.28"/>`,
    open: (k, u) => `<linearGradient id="sk_${u}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${k.sky[0]}"/><stop offset="1" stop-color="${k.sky[1]}"/></linearGradient>
      <rect x="0" y="0" width="${IW}" height="${IH}" fill="url(#sk_${u})"/>
      <path d="M0,118 q60,-26 120,-6 q70,22 180,-4 L${IW},${FY} L0,${FY} Z" fill="${k.far}" opacity="0.75"/>`,
  };

  // 창문은 **높은 자리**에 둔다 (y28~80). 물건은 대개 y90 아래라 겹치지 않고,
  // 사람이 서는 오른쪽(x211~)에도 안 걸린다
  const win = k => `<rect x="132" y="28" width="66" height="52" rx="4" fill="${k.roof}" opacity="0.55"/>
      <rect x="138" y="34" width="54" height="40" rx="3" fill="${k.sky[0]}"/>
      <rect x="163" y="34" width="3" height="40" fill="${k.roof}" opacity="0.55"/>`;

  // 모양 열 — 벽 · 바닥 · 창문 · 안에 놓인 것
  const ROOM = {
    // 대장간 — 화덕의 «불»이 이 방의 전부다. 그다음이 **모루**(뿔이 있어야 모루로 읽힌다)와
    // 걸린 연장. 예전에는 모루가 사다리꼴 한 덩어리라 물뿌리개처럼 보였다
    forge: { wall: 'stone', floor: 'stone', win: false, props: k => `
      <path d="M16,${FY} L16,74 q0,-16 22,-16 l40,0 q22,0 22,16 L100,${FY} Z" fill="#5c5149"/>
      <path d="M30,${FY} L30,86 q0,-12 14,-12 l28,0 q14,0 14,12 L86,${FY} Z" fill="#2b241f"/>
      <path d="M40,${FY} q4,-30 18,-40 q14,10 18,40 Z" fill="#e2762c"/>
      <path d="M47,${FY} q3,-20 11,-28 q8,8 11,28 Z" fill="#f4b23c"/>
      <ellipse cx="58" cy="${FY - 4}" rx="24" ry="6" fill="#f4b23c" opacity="0.35"/>
      <rect x="12" y="62" width="96" height="7" rx="2" fill="#6b5137"/>
      ${[[48,0],[62,-9],[72,7]].map(([x, d]) => `<circle cx="${x}" cy="${100 + d}" r="2.6" fill="#f4c761" opacity="0.85"/>`).join('')}
      <rect x="118" y="52" width="82" height="6" rx="2" fill="#4a4038"/>
      <path d="M128,58 l0,20 M128,78 q-7,0 -7,7 q0,7 7,7 q7,0 7,-7 q0,-7 -7,-7" stroke="#8d939b" stroke-width="4" fill="none"/>
      <rect x="152" y="58" width="6" height="24" fill="#7a5a3c"/>
      <rect x="144" y="80" width="22" height="9" rx="2" fill="#6d747e"/>
      <rect x="182" y="58" width="5" height="26" fill="#7a5a3c"/>
      <path d="M176,84 q9,9 18,0" stroke="#6d747e" stroke-width="4" fill="none"/>
      <rect x="130" y="138" width="46" height="14" rx="2" fill="#6b5137"/>
      <rect x="126" y="128" width="54" height="10" rx="2" fill="#59606b"/>
      <path d="M144,128 l0,-6 q-5,-4 -5,-10 l28,0 q0,6 -5,10 l0,6 Z" fill="#6d747e"/>
      <rect x="128" y="102" width="50" height="10" rx="3" fill="#7d858f"/>
      <path d="M178,102 q16,2 18,5 q-2,3 -18,5 Z" fill="#7d858f"/>
      <path d="M128,102 q-8,1 -8,5 q0,4 8,5 Z" fill="#6d747e"/>
      <rect x="146" y="96" width="26" height="6" rx="2" fill="#4a4038" transform="rotate(-12 159 99)"/>
      <rect x="166" y="90" width="14" height="12" rx="3" fill="#8d939b" transform="rotate(-12 173 96)"/>` },

    // 여관·오두막 — 벽난로 + 술통 + 밥상. **사람이 «머무는» 방**이라
    // 불과 먹을 것이 있어야 한다
    house: { wall: 'plaster', floor: 'wood', win: true, props: k => `
      <rect x="10" y="66" width="74" height="86" rx="3" fill="#8b8079"/>
      <path d="M22,${FY} L22,96 q0,-12 16,-12 l20,0 q16,0 16,12 L74,${FY} Z" fill="#2b241f"/>
      <path d="M32,${FY} q4,-26 16,-34 q12,8 16,34 Z" fill="#e2762c"/>
      <path d="M39,${FY} q3,-16 9,-22 q6,6 9,22 Z" fill="#f4b23c"/>
      <rect x="4" y="58" width="88" height="8" rx="2" fill="#6b5137"/>
      <ellipse cx="26" cy="53" rx="7" ry="8" fill="#c9899a"/>
      <rect x="48" y="44" width="12" height="14" rx="2" fill="#e0c07a"/>
      <path d="M96,152 q-6,-18 0,-36 l28,0 q6,18 0,36 Z" fill="#a07d54"/>
      <rect x="94" y="122" width="32" height="5" rx="2" fill="#6b5137"/>
      <rect x="94" y="140" width="32" height="5" rx="2" fill="#6b5137"/>
      <ellipse cx="110" cy="116" rx="16" ry="5" fill="#8a6a4c"/>
      <rect x="132" y="110" width="70" height="8" rx="3" fill="#8a6a4c"/>
      <rect x="138" y="118" width="7" height="34" fill="#7a5a3c"/>
      <rect x="189" y="118" width="7" height="34" fill="#7a5a3c"/>
      <ellipse cx="152" cy="106" rx="9" ry="5" fill="#b8742f"/>
      <rect x="166" y="96" width="14" height="12" rx="3" fill="#cbb08c"/>
      <ellipse cx="189" cy="106" rx="8" ry="4" fill="#9fb8c9"/>` },

    // 잡화점 — 선반의 «물건 수»가 곧 가게다
    shop: { wall: 'plaster', floor: 'wood', win: true, props: k => `
      <rect x="14" y="92" width="94" height="8" rx="2" fill="#8a6a4c"/>
      <rect x="14" y="124" width="94" height="8" rx="2" fill="#8a6a4c"/>
      ${[0,1,2,3].map(i => `<rect x="${20 + i * 23}" y="74" width="14" height="18" rx="3" fill="${['#c9899a','#8fc3b0','#e0c07a','#a6a0cf'][i]}"/>`).join('')}
      ${[0,1,2].map(i => `<rect x="${24 + i * 29}" y="108" width="18" height="16" rx="2" fill="#cbb08c"/>`).join('')}
      <rect x="118" y="114" width="84" height="10" rx="3" fill="#a07d54"/>
      <rect x="123" y="124" width="74" height="28" fill="#8a6a4c"/>
      <rect x="130" y="100" width="16" height="14" rx="2" fill="#cbb08c"/>
      <ellipse cx="166" cy="108" rx="10" ry="6" fill="#b8742f"/>
      <path d="M174,114 q-4,-14 8,-17 q12,3 8,17 Z" fill="#cbb08c"/>
      <rect x="178" y="94" width="8" height="4" rx="2" fill="#a07d54"/>` },

    // 연금술 방 — 솥과 플라스크
    lab: { wall: 'plaster', floor: 'wood', win: true, props: k => `
      <rect x="14" y="102" width="92" height="8" rx="2" fill="#8a6a4c"/>
      ${[0,1,2].map(i => `<path d="M${28 + i * 26},78 l0,10 l-7,12 l14,0 l-7,-12 Z" fill="${['#9fd8c6','#d9a6d0','#e6d28a'][i]}" opacity="0.92"/>`).join('')}
      <rect x="12" y="66" width="96" height="7" rx="2" fill="#6b5137"/>
      ${[0,1,2,3].map(i => `<rect x="${20 + i * 22}" y="50" width="13" height="16" rx="2" fill="#b9a98f"/>`).join('')}
      <ellipse cx="152" cy="${FY - 2}" rx="32" ry="11" fill="#5a4e46"/>
      <path d="M126,${FY - 2} q26,-38 52,0 Z" fill="#454550"/>
      <ellipse cx="152" cy="126" rx="18" ry="6" fill="#b39be0" opacity="0.9"/>
      ${[[146,113,4],[155,103,3],[161,111,2.6],[150,93,2.2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#cdbcf0" opacity="0.75"/>`).join('')}` },

    // 광산·갱구 — 버팀목이 없으면 갱도가 아니다
    mine: { wall: 'rock', floor: 'dirt', win: false, props: k => `
      <rect x="16" y="44" width="14" height="108" fill="#7a5a3c"/>
      <rect x="98" y="44" width="14" height="108" fill="#7a5a3c"/>
      <rect x="8" y="34" width="112" height="14" rx="3" fill="#8a6a4c"/>
      <ellipse cx="64" cy="116" rx="40" ry="30" fill="#2a231d" opacity="0.78"/>
      <rect x="126" y="48" width="10" height="104" fill="#6b4a30"/>
      <rect x="196" y="48" width="10" height="104" fill="#6b4a30"/>
      <rect x="120" y="38" width="92" height="12" rx="3" fill="#7a5a3c"/>
      <rect x="128" y="${FY - 4}" width="76" height="4" rx="2" fill="#6d747e" opacity="0.7"/>
      <rect x="138" y="114" width="52" height="26" rx="3" fill="#59606b"/>
      <rect x="138" y="108" width="52" height="8" rx="2" fill="#6d747e"/>
      <circle cx="150" cy="144" r="8" fill="#3c3a38"/><circle cx="178" cy="144" r="8" fill="#3c3a38"/>
      <path d="M158,102 l0,-22 M146,80 q12,-10 24,0" stroke="#8d939b" stroke-width="4" fill="none"/>
      ${[[92,144],[110,150],[124,142]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="#8b8177"/>`).join('')}
      <rect x="62" y="20" width="4" height="16" fill="#6d747e"/>
      <circle cx="64" cy="46" r="10" fill="#f4c761" opacity="0.92"/>
      <circle cx="64" cy="46" r="20" fill="#f4c761" opacity="0.18"/>` },

    // 탑 — 나선 계단과 아치창. 위로 «올라가는» 방이다.
    // ⚠️ 계단은 벽(#9a958c)과 붙어 있어 **대비를 벌려야** 계단으로 보인다
    tower: { wall: 'stone', floor: 'stone', win: false, props: k => `
      ${[0,1,2,3,4,5].map(i => `<rect x="${8 + i * 12}" y="${141 - i * 19}" width="8" height="${11 + i * 8}" fill="#514b45"/>`).join('')}
      ${[0,1,2,3,4,5].map(i => `<rect x="${8 + i * 12}" y="${132 - i * 19}" width="44" height="9" rx="2" fill="#6f665f"/>`).join('')}
      ${[0,1,2,3,4,5].map(i => `<rect x="${8 + i * 12}" y="${132 - i * 19}" width="44" height="3" rx="1" fill="#a49a90"/>`).join('')}
      <path d="M126,${FY} L126,52 q0,-26 28,-26 q28,0 28,26 L182,${FY} Z" fill="${k.sky[0]}" opacity="0.85"/>
      <path d="M122,${FY} L122,52 q0,-30 32,-30 q32,0 32,30 L186,${FY}" stroke="${k.roof}" stroke-width="7" fill="none" opacity="0.6"/>
      <rect x="152" y="26" width="4" height="74" fill="${k.roof}" opacity="0.45"/>
      <rect x="58" y="98" width="58" height="54" rx="3" fill="#7a5a3c"/>
      ${[0,1].map(r => `<rect x="62" y="${102 + r * 24}" width="50" height="4" fill="#5f462e"/>`).join('')}
      ${[0,1].map(r => [0,1,2,3].map(c => `<rect x="${65 + c * 12}" y="${106 + r * 24}" width="9" height="18" rx="1" fill="${['#c9899a','#8fc3b0','#e0c07a','#a6a0cf'][(r + c) % 4]}"/>`).join('')).join('')}
      <ellipse cx="154" cy="${FY - 2}" rx="16" ry="5" fill="#6b5137"/>
      <rect x="151" y="124" width="6" height="26" fill="#7a5a3c"/>
      <circle cx="154" cy="114" r="13" fill="#b39be0" opacity="0.85"/>
      <circle cx="150" cy="110" r="4" fill="#efe6ff" opacity="0.7"/>` },

    // 과수원 헛간 — 사과 상자 · 사다리 · 매달아 말리는 다발
    farm: { wall: 'plaster', floor: 'wood', win: true, props: k => `
      <rect x="10" y="106" width="58" height="46" rx="4" fill="#a07d54"/>
      <rect x="10" y="106" width="58" height="7" rx="2" fill="#8a6a4c"/>
      ${[0,1,2,3,4].map(i => `<circle cx="${20 + (i % 3) * 20}" cy="${100 - Math.floor(i / 3) * 14}" r="9" fill="#c8443a"/>`).join('')}
      <rect x="78" y="112" width="50" height="40" rx="4" fill="#8a6a4c"/>
      ${[0,1,2].map(i => `<circle cx="${89 + i * 16}" cy="106" r="8" fill="#d8a13c"/>`).join('')}
      <rect x="146" y="54" width="9" height="98" fill="#a07d54"/>
      <rect x="176" y="54" width="9" height="98" fill="#a07d54"/>
      ${[0,1,2,3,4].map(i => `<rect x="146" y="${68 + i * 19}" width="39" height="6" fill="#8a6a4c"/>`).join('')}
      <rect x="14" y="26" width="110" height="5" rx="2" fill="#6b5137"/>
      ${[[32,0],[62,7],[96,-3]].map(([x, d]) => `<path d="M${x},30 q-9,14 -5,${28 + d} q5,8 10,0 q4,-${14 + d} -5,-${28 + d} Z" fill="${k.crop}" opacity="0.85"/>`).join('')}` },

    // 폐허 — 무너진 벽과 덩굴. **바깥이 보여야** 무너진 것이다
    ruin: { wall: 'open', floor: 'dirt', win: false, props: k => `
      <path d="M0,${FY} L0,48 l34,0 l0,-14 l30,0 l0,22 l26,0 l0,-10 l24,0 l0,34 l-18,0 l0,22 l-24,0 l0,-16 l-20,0 l0,26 Z" fill="#9a958c"/>
      <path d="M160,${FY} L160,96 l20,0 l0,-30 l26,0 l0,-22 l34,0 l0,20 l${IW - 240},0 L${IW},${FY} Z" fill="#8e8980"/>
      ${[[26,70],[64,92],[100,120]].map(([x, y]) => `<path d="M${x},${y} q12,10 6,26 q-10,-6 -6,-26 Z" fill="#5f7a45"/>`).join('')}
      <path d="M186,70 q-14,10 -8,30 q12,-8 8,-30 Z" fill="#5f7a45"/>
      <rect x="118" y="118" width="16" height="34" rx="3" fill="#8b8177" transform="rotate(-14 126 135)"/>
      ${[[142,146],[164,150],[188,144]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="6" fill="#8b8177"/>`).join('')}` },

    // 물가 — 물과 갈대, 매어 둔 배
    water: { wall: 'open', floor: 'water', win: false, props: k => `
      ${[[36, 46], [66, 36], [96, 50]].map(([x, y]) =>
        `<path d="M${x},${y} q5,-6 10,0 q5,-6 10,0" stroke="${k.far}" stroke-width="2.4" fill="none" opacity="0.7"/>`).join('')}
      <rect x="6" y="${FY - 6}" width="104" height="9" rx="2" fill="#8a6a4c"/>
      ${[0,1,2,3,4].map(i => `<rect x="${12 + i * 21}" y="${FY + 3}" width="7" height="${16 + (i % 2) * 6}" fill="#6b5137"/>`).join('')}
      ${[[114,0],[126,8],[138,-4]].map(([x, d]) => `<path d="M${x},${FY - 2 + d} q3,-30 8,-38 q-1,30 -3,38 Z" fill="#4f7a52"/>`).join('')}
      <path d="M140,${FY + 14} q30,-16 62,0 q-16,14 -31,14 q-15,0 -31,-14 Z" fill="#8a6a4c"/>
      <path d="M146,${FY + 15} q26,-12 50,0 q-13,9 -25,9 q-12,0 -25,-9 Z" fill="#a07d54"/>
      <rect x="176" y="${FY - 26}" width="5" height="34" fill="#6b5137" transform="rotate(16 178 ${FY - 10})"/>
      ${[[20,0],[32,8],[44,-4]].map(([x, d]) => `<path d="M${x},${FY - 6 + d} q3,-30 8,-38 q-1,30 -3,38 Z" fill="#4f7a52"/>`).join('')}` },

    // 우물 — 돌 두레박과 지붕
    well: { wall: 'open', floor: 'dirt', win: false, props: k => `
      <rect x="10" y="124" width="30" height="28" rx="4" fill="#8a6a4c"/>
      <rect x="10" y="132" width="30" height="4" fill="#6b5137"/>
      <ellipse cx="114" cy="${FY + 6}" rx="52" ry="16" fill="#8b8177"/>
      <path d="M62,${FY + 6} L62,112 q0,-12 52,-12 q52,0 52,12 L166,${FY + 6} Z" fill="#9a958c"/>
      ${[0,1,2,3].map(r => [0,1,2,3,4].map(c => `<rect x="${66 + c * 20 + (r % 2 ? 10 : 0)}" y="${112 + r * 11}" width="18" height="9" rx="2" fill="#8e8980" opacity="${0.55 + (c % 2) * 0.25}"/>`).join('')).join('')}
      <ellipse cx="114" cy="110" rx="50" ry="14" fill="#33506b"/>
      <ellipse cx="114" cy="110" rx="40" ry="10" fill="#4a7a96"/>
      <rect x="68" y="44" width="8" height="66" fill="#7a5a3c"/>
      <rect x="152" y="44" width="8" height="66" fill="#7a5a3c"/>
      <path d="M54,46 L114,20 L174,46 Z" fill="#8a5a4a"/>
      <rect x="80" y="52" width="68" height="7" rx="3" fill="#6b5137"/>
      <rect x="106" y="59" width="4" height="26" fill="#6b5137"/>
      <rect x="96" y="85" width="26" height="18" rx="3" fill="#8a6a4c"/>` },
  };

  // ⚠️ **바닥 그림자는 «사람이 설 때만» 그린다** (`npc`). 빈 자리에서도 그리면
  //   아무도 없는 방바닥에 그림자만 남아 「뭔가 사라진 자리」로 읽힌다
  function interior(spot, vid, npc) {
    const k = SKIN[vid] || DEF;
    const u = 'i' + (++uid);
    const s = spot || {};
    const r = ROOM[s.shape] || ROOM.house;
    return `<svg class="npc-svg" viewBox="0 0 ${IW} ${IH}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="iw_${u}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${k.wall}"/><stop offset="1" stop-color="${k.roof}" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      ${WALL[r.wall](k, u)}
      ${FLOOR[r.floor](k)}
      ${r.win ? win(k) : ''}
      ${r.props(k)}
      ${npc ? `<ellipse cx="216" cy="${FY + 24}" rx="40" ry="9" fill="#000" opacity="0.16"/>` : ''}
    </svg>`;
  }

  // 검사기가 «모양을 다» 재려면 이름 목록이 필요하다 — 손으로 적으면 새 모양이
  // 조용히 안 재진다 (`Portrait.hairs` 와 같은 규칙이다)
  window.Village = { scene, interior, W, hFor, shapes: Object.keys(ROOM) };
})();
