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
  // 캐시 버스터는 제 `<script>` 태그에서 물려받는다 (creature.js 의 ASSET_Q 와 같은 조리법)
  const ASSET_Q = (document.currentScript && document.currentScript.src.includes('?'))
    ? '?' + document.currentScript.src.split('?')[1] : '';

  function scene(village) {
    const v = village || {};
    // ⚠️ 받은 일러스트가 있는 마을은 그 그림을 «그대로» 깐다 — 비율도 그림의 것이라
    //    (`.vil-map.art` 의 aspect-ratio) 잘리지 않고, 이름표 좌표가 그림 위 자리와 맞는다
    // 물 위 윤슬 (`glints` · 실내와 같은 glintFx · 거울 골짜기 · 유리관 호수)도 같은 층에 얹는다
    // 굴뚝 연기 (`smokes` · 실내와 같은 smokeFx) — 좌표는 «그림 px ÷ 4»다(1200 폭 그림 → 300 칸).
    //   실내 그림(300×200)과 같은 칸 크기다. 번짐은 덜 준다(0.9) — 그려진 연기가 또렷한 덩이라 흐린 안개로 두면 따로 논다.
    //   자리는 그림을 재서 적는다
    if (v.art) return `<img class="vil-art" src="${v.art + ASSET_Q}" alt="" draggable="false">`
      + (v.smokes || v.glints ? `<svg class="vil-fx" viewBox="0 0 300 ${(300 / (v.artRatio || 1)).toFixed(1)}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${v.glints ? glintFx(v.glints) : ''}${v.smokes ? smokeFx(v.smokes, 'v' + (++uid), 0.9) : ''}</svg>` : '');
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
  //   `.npc-figure` 는 오른쪽에 붙은 «상반신 컷»이고(무대의 140% 로 키워 밑을 자른다 ·
  //   2026-10-19), 그림이 실제로 칠하는 자리는 대략 **x 200~290** 이다. 그래서 물건은
  //   **x 6~200** 안에 둔다 (전신일 때는 x 211~276 이었다). 처음에 그냥 「오른쪽 3분의 1」로 적어 두었다가
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
  // ⚠️ **건물 안도 «받은 그림»을 깔 수 있다** (`spots[].art` · 2026-10-19 · 대장간).
  //   그림은 무대의 3:2 로 잘라 둔다 — 사람은 오른쪽(x 200~290)에 서므로 물건은 왼쪽에 있어야 한다
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
      ${s.art ? `<image href="${s.art + ASSET_Q}" x="0" y="0" width="${IW}" height="${IH}" preserveAspectRatio="xMidYMid slice"/>` : `
      ${WALL[r.wall](k, u)}
      ${FLOOR[r.floor](k)}
      ${r.win ? win(k) : ''}
      ${r.props(k)}`}
      ${s.art && s.fire ? fireList(s.fire).map((f, i) => fireFx(f, u + '_' + i)).join('') : ''}
      ${s.art && s.lamps ? lampFx(s.lamps, u) : ''}
      ${s.art && s.orbs ? orbFx(s.orbs, u) : ''}
      ${s.art && s.bubbles ? bubbleFx(s.bubbles) : ''}
      ${s.art && s.butterflies ? butterflyFx(s.butterflies) : ''}
      ${s.art && s.leaves ? leafFx(s.leaves) : ''}
      ${s.art && s.fishes ? fishFx(s.fishes, u) : ''}
      ${s.art && s.flops ? flopFx(s.flops) : ''}
      ${s.art && s.glints ? glintFx(s.glints) : ''}
      ${s.art && s.mists ? mistFx(s.mists, u) : ''}
      ${s.art && s.smokes ? smokeFx(s.smokes, u) : ''}
      ${s.art && s.rays ? rayFx(s.rays, u) : ''}
      ${s.art && s.webs ? webFx(s.webs) : ''}
      ${s.art && s.dews ? dewFx(s.dews) : ''}
      ${s.art && s.spiders ? spiderFx(s.spiders, u) : ''}
      ${s.art && s.motes ? moteFx(s.motes) : ''}
      ${npc ? `<ellipse cx="${s.npcLeft ? IW - 216 : 216}" cy="${FY + 24}" rx="40" ry="9" fill="#000" opacity="0.16"/>` : ''}
    </svg>`;
  }

  // 받은 그림 속 벽난로 위에 «타는 불»을 덧그린다 (`spots[].fire` = [불 밑동 가운데 x, 밑동 y, 폭] · viewBox 좌표).
  // ⚠️ 자리는 그림을 재서 적는다 — 그림을 바꾸면 그 줄도 다시 잰다.
  //   빛무리(번짐) · 불꽃 셋(흔들림) · 불티(올라가며 사라짐). 움직임 줄이기에서는 CSS 가 다 멈춘다
  // 받은 그림 속 등불 위에 «일렁이는 빛»을 덧그린다 (`spots[].lamps` = [[가운데 x, y, 반지름], …] · viewBox 좌표).
  // 등마다 박자를 어긋내야 한꺼번에 숨 쉬는 «기계»로 안 보인다. 자리는 그림을 재서 적는다
  function lampFx(list, u) {
    return `<g class="fx-lamps" aria-hidden="true">
      <defs><radialGradient id="lg_${u}"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/><stop offset="0.45" stop-color="#ffa64a" stop-opacity="0.35"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient></defs>
      ${list.map(([x, y, r], i) => `<circle class="fx-lamp" style="animation-delay:${(-i * 0.73).toFixed(2)}s;animation-duration:${(1.9 + (i % 3) * 0.35).toFixed(2)}s" cx="${x}" cy="${y}" r="${(r * 2.4).toFixed(1)}" fill="url(#lg_${u})"/>`).join('')}
    </g>`;
  }
  // 받은 그림 속 수정 구슬이 «반짝» 빛난다 (`spots[].orbs` = [[구슬 가운데 x, y, 반지름], …] · viewBox 좌표 · 여왕의 첨탑).
  // 셋이 겹친다 — 숨 쉬는 푸른 보랏빛 빛무리 · 구슬 안을 도는 반짝 · 둘레에서 깜박이는 네 갈래 별빛.
  // ⚠️ 별의 자리는 바깥 <g> 의 transform 속성이고 깜박임은 안쪽 path 의 CSS transform 이다 — 한 요소에 두면 CSS 가 속성을 덮어써 별이 방 저편으로 튄다.
  // 별빛 자리는 구슬 둘레에 «고정»한다 (무작위면 다시 그릴 때마다 옮겨 다닌다). 자리는 그림을 재서 적는다
  const ORB_STAR = [[-1.25, -0.9, 0.42], [1.3, -0.55, 0.32], [0.95, 1.05, 0.26], [-1.05, 0.7, 0.3], [0.1, -1.55, 0.24]];
  function orbFx(list, u) {
    const star = 'M0,-1 C.12,-.12 .12,-.12 1,0 C.12,.12 .12,.12 0,1 C-.12,.12 -.12,.12 -1,0 C-.12,-.12 -.12,-.12 0,-1Z';
    return `<g class="fx-orbs" aria-hidden="true">
      <defs><radialGradient id="og_${u}"><stop offset="0" stop-color="#e4d4ff" stop-opacity="0.85"/><stop offset="0.4" stop-color="#a98bff" stop-opacity="0.5"/><stop offset="1" stop-color="#6f8bff" stop-opacity="0"/></radialGradient></defs>
      ${list.map(([x, y, r], i) => `<circle class="fx-orb" cx="${x}" cy="${y}" r="${(r * 2.3).toFixed(1)}" fill="url(#og_${u})"/>
        <ellipse class="fx-orbshine" style="animation-delay:${(-i * 0.9).toFixed(2)}s" cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" rx="${(r * 0.32).toFixed(1)}" ry="${(r * 0.2).toFixed(1)}" fill="#ffffff"/>
        ${ORB_STAR.map(([dx, dy, k], j) => `<g transform="translate(${(x + dx * r).toFixed(1)} ${(y + dy * r).toFixed(1)}) scale(${(r * k).toFixed(2)})"><path class="fx-orbstar" style="animation-delay:${(j * 0.47).toFixed(2)}s" d="${star}" fill="#ffffff"/></g>`).join('')}`).join('')}
    </g>`;
  }
  // 받은 그림 속 물고기가 «팔딱» 꼬리를 친다 (`spots[].flops` = [[조각 그림, x, y, 폭, 높이, 축 x, 축 y, 각도], …] · viewBox 좌표).
  // 조각은 그림에서 떼어 낸 꼬리(투명 PNG)이고 바탕 그림에서는 그 자리를 메워 두었다 — 쉬는 동안은 원래 그림과 한 픽셀도 안 다르다.
  // 둘 겹이다 — 축 자리(transform 속성) · 흔들림(CSS fxFlop · --a 만큼). ⚠️ CSS transform 이 속성을 덮어쓰므로 겹을 나눈다
  function flopFx(list) {
    return `<g class="fx-flops" aria-hidden="true">${list.map(([href, x, y, w, h, px, py, a], i) =>
      `<g transform="translate(${px} ${py})"><g class="fx-flop" style="--a:${a}deg;animation-delay:${(i * 1.7).toFixed(2)}s"><image href="${href + ASSET_Q}" x="${(x - px).toFixed(2)}" y="${(y - py).toFixed(2)}" width="${w}" height="${h}"/></g></g>`).join('')}</g>`;
  }
  // `fire` 는 불 하나([x, y, w])일 수도, 여럿([[x, y, w], …] · 공방의 증류기 버너 + 모닥불)일 수도 있다
  function fireList(f) { return Array.isArray(f[0]) ? f : [f]; }
  // 받은 그림 속 유리 플라스크 «안»에서 약물이 뽀글뽀글 끓는다 (`spots[].bubbles` = [[물 가운데 x, 수면 y, 물 폭], …] · viewBox 좌표).
  // 거품 다섯이 물속 바닥 쪽에서 생겨 수면까지 올라와 터진다 — 수면 위로는 안 나간다 (유리 안에 갇혀 있어야 끓는 것으로 읽힌다).
  // 플라스크마다 박자를 어긋낸다. 자리는 그림을 재서 적는다 — 그림을 바꾸면 그 줄도 다시 잰다
  function bubbleFx(list) {
    return `<g class="fx-bubbles" aria-hidden="true">${list.map(([x, y, w, d], i) => {
      // 거품이 생기는 깊이 (수면 아래) — 넷째 칸이 있으면 그 값이다: 솥처럼 물이 안 보이는 그릇은
      // 수면 «바로 밑»에서 생겨야 솥 몸통 위로 거품이 안 떠오른다 (사냥꾼 쉼터의 스프 솥)
      const depth = d != null ? d : w * 0.55;
      return [-0.3, 0.12, -0.05, 0.28, -0.18].map((dx, j) =>
        `<circle class="fx-bub" style="--r:-${depth.toFixed(1)}px;animation-delay:${(-(i * 0.29 + j * 0.23)).toFixed(2)}s" cx="${(x + dx * w).toFixed(1)}" cy="${(y + depth).toFixed(1)}" r="${(w * (0.045 + (j % 3) * 0.02)).toFixed(2)}" fill="#ffffff" fill-opacity="0.55" stroke="#ffffff" stroke-width="0.35"/>`).join('');
    }).join('')}</g>`;
  }
  // 받은 그림 위로 «작은 나비»가 날아다닌다 (`spots[].butterflies` = [[출발 x, y, 떠도는 폭, 높이], …] · viewBox 좌표).
  // 셋 겹이다 — 자리(transform 속성) · 떠도는 길(CSS fxFly · --w/--h 만큼) · 날갯짓(CSS fxFlap).
  // ⚠️ CSS transform 은 SVG 의 transform 속성을 «덮어쓴다» — 그래서 자리와 움직임을 다른 겹에 둔다.
  // 나비는 «옆모습»이다 — 오른쪽을 보게 그려 두고, 마리마다 섞인 순서로 좌우를 뒤집는다 (BFLY_FACE).
  // 위에서 내려다본 모양으로 두었더니 넷이 다 위를 보고 있었다 · 움직임 줄이기에서는 제자리에 앉아 있다
  const BFLY = ['#fff4c2', '#ffc9dc', '#ffffff', '#ffd36b'];
  const BFLY_FACE = [1, -1, -1, 1, -1, 1];
  function butterflyFx(list) {
    // 날개 둘(앞날개 · 뒷날개)이 몸 위로 솟는다 — 밑변이 몸에 붙어 있어야 날갯짓의 축이 몸이 된다
    const wing = c => `<ellipse cx="0.5" cy="-1.5" rx="1.05" ry="1.65" transform="rotate(22 0.5 -1.5)" fill="${c}"/>`
      + `<ellipse cx="-0.55" cy="-0.95" rx="0.85" ry="1.05" transform="rotate(-18 -0.55 -0.95)" fill="${c}"/>`;
    return `<g class="fx-bflies" aria-hidden="true">${list.map(([x, y, w, h], i) => {
      const c = BFLY[i % BFLY.length], f = BFLY_FACE[i % BFLY_FACE.length];
      return `<g transform="translate(${x},${y}) scale(${(2.1 * f).toFixed(1)},2.1)"><g class="fx-fly" style="--w:${(w / 2.1 * f).toFixed(1)}px;--h:${(h / 2.1).toFixed(1)}px;animation-duration:${(9 + (i % 3) * 2.3).toFixed(1)}s;animation-delay:${(-i * 2.7).toFixed(1)}s">`
        + `<g class="fx-wing" style="animation-duration:${(0.22 + (i % 2) * 0.05).toFixed(2)}s" stroke="#7a4a2e" stroke-width="0.3">${wing(c)}</g>`
        + `<ellipse cx="0" cy="0.1" rx="1.5" ry="0.38" fill="#5a3a26"/><circle cx="1.65" cy="-0.05" r="0.45" fill="#5a3a26"/>`
        + `<path d="M1.8,-0.4 Q2.2,-1.2 2.7,-1.5 M1.6,-0.4 Q1.8,-1.3 2.2,-1.8" fill="none" stroke="#5a3a26" stroke-width="0.18" stroke-linecap="round"/></g></g>`;
    }).join('')}</g>`;
  }
  // 받은 그림 위로 «나뭇잎»이 한 장씩 떨어진다 (`spots[].leaves` = [[출발 x, y, 떨어지는 높이, 옆으로 흐르는 몫], …] · viewBox 좌표).
  // 셋 겹이다 — 자리(transform 속성) · 떨어지는 길(CSS fxLeafFall · --d/--s 만큼 흔들리며 내려와 바닥에서 사라진다)
  // · 팔랑임(CSS fxLeafSpin). 한 바퀴의 «앞 절반만» 떨어지고 나머지는 비어 있어서, 잎마다 박자를 반 바퀴씩 어긋내면
  // 한 장 · 쉼 · 또 한 장이 된다 (1~2장이 시간차를 두고 — 사람이 정했다). 움직임 줄이기에서는 아예 안 보인다
  // (허공에 멈춘 잎은 떨어지는 것이 아니라 «붙어 있는 것»으로 읽힌다)
  const LEAF = [['#d98a4e', '#a85a2c'], ['#8fb062', '#5f7f3c'], ['#e0b24f', '#a87a2a']];
  const LEAF_K = 1.9;   // 잎의 크기 (떨어지는 몫은 이 배율로 나눠 적는다 — 겹이 같이 커지므로)
  function leafFx(list) {
    const n = list.length, T = 10;
    return `<g class="fx-leaves" aria-hidden="true">${list.map(([x, y, d, s], i) => {
      const [c, v] = LEAF[i % LEAF.length];
      return `<g transform="translate(${x},${y}) scale(${LEAF_K})"><g class="fx-leaf" style="--d:${(d / LEAF_K).toFixed(1)}px;--s:${(s / LEAF_K).toFixed(1)}px;animation-duration:${T}s;animation-delay:${(-T + i * T / n + 0.6).toFixed(1)}s">`
        + `<g class="fx-leaf-spin" style="animation-duration:${(1.9 + (i % 2) * 0.5).toFixed(1)}s">`
        + `<path d="M-3.6,0 Q-1.4,-2.3 3.6,0 Q-1.4,2.3 -3.6,0 Z" fill="${c}"/>`
        + `<path d="M-3.4,0 L3.2,0 M-0.8,0 L0.6,-1.1 M0.9,0 L2,-0.7" fill="none" stroke="${v}" stroke-width="0.35" stroke-linecap="round"/>`
        + `</g></g></g>`;
    }).join('')}</g>`;
  }
  // 받은 그림 속 물 위에 «윤슬»이 반짝인다 (`spots[].glints` = [[물 가운데 x, y, 반폭, 반높이, 개수], …] · viewBox 좌표).
  // 짧은 빛 줄 하나하나가 제 박자로 반짝였다 사라진다 — 자리는 황금각으로 타원 안에 고르게 흩는다
  // (무작위로 두면 다시 그릴 때마다 자리가 바뀐다). 움직임 줄이기에서는 옅게 남는다
  // 받은 그림 속 물밑으로 «물고기 그림자»가 지나간다 (`spots[].fishes` = [[물 가운데 x, y, 반폭, 반높이, 마리 수], …] · viewBox 좌표).
  // 흐린 짙은 물고기 실루엣이 타원을 따라 천천히 돌며 떠올랐다(진해졌다) 가라앉았다(옅어졌다) 한다 — 마리마다 방향·빠르기·박자를 어긋낸다.
  // 윤슬보다 «아래»에 깐다 (물밑이다). 타원은 세로를 눌러 «비스듬히 내려다본 물»이 된다.
  // SMIL 이라 CSS 의 움직임 줄이기가 안 닿는다 — 그릴 때 물어서 그때는 제자리에 옅게 둔다
  function fishFx(list, u) {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return `<g class="fx-fishes" aria-hidden="true"><defs><filter id="fs_${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>`
      + `<g filter="url(#fs_${u})" fill="#1d4f72">${list.map(([x, y, rx, ry, n], i) =>
      Array.from({ length: n }, (_, j) => {
        const dir = (i + j) % 2 ? 1 : -1, dur = 13 + ((i * 3 + j * 5) % 5) * 2.2;
        const a0 = Math.round((j * 360 / n + i * 47) % 360), k = 0.85 + (j % 3) * 0.18;
        const fish = `<g transform="translate(${rx},0) rotate(${dir > 0 ? 90 : -90}) scale(${k.toFixed(2)})">`
          + `<ellipse cx="0" cy="0" rx="7" ry="2.6"/><path d="M-5.5,0 L-11,-3.4 L-9.6,0 L-11,3.4Z"/></g>`;
        const spin = still ? '' : `<animateTransform attributeName="transform" type="rotate" from="${a0}" to="${a0 + 360 * dir}" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/>`;
        const fade = still ? '' : `<animate attributeName="opacity" values="0;0.32;0.32;0" keyTimes="0;0.2;0.7;1" dur="${(dur * 0.7).toFixed(1)}s" begin="${(-((j * 2.3 + i * 1.7) % 6)).toFixed(1)}s" repeatCount="indefinite"/>`;
        return `<g transform="translate(${x},${y}) scale(1,${(ry / rx).toFixed(3)})"><g opacity="${still ? 0.22 : 0}">${fade}<g transform="rotate(${a0})">${spin}${fish}</g></g></g>`;
      }).join('')).join('')}</g></g>`;
  }
  function glintFx(list) {
    return `<g class="fx-glints" aria-hidden="true">${list.map(([x, y, rx, ry, n], i) =>
      Array.from({ length: n }, (_, j) => {
        // 일곱째 칸이 'out' 이면 바깥 장면이라 희고 진하게 선다 (세공소 — 짙은 지붕 위에서 베이지 연기가 묻혔다)
        // 여섯째 칸이 있으면 흐르는 쪽·세기다 (1 = 왼쪽 · 음수 = 오른쪽 · 마을 지도의 굴뚝 연기는 그려진 연기를 따라 오른쪽)
        const r = Math.sqrt((j + 0.5) / n), a = j * 2.39996 + i;
        const gx = x + Math.cos(a) * r * rx, gy = y + Math.sin(a) * r * ry;
        const w = 4.5 + (j % 3) * 2.2;
        return `<g transform="translate(${gx.toFixed(1)},${gy.toFixed(1)})"><g class="fx-glint" style="animation-delay:${(-((j * 0.61 + i * 0.37) % 2.8)).toFixed(2)}s;animation-duration:${(2.2 + (j % 4) * 0.3).toFixed(1)}s">`
          + `<rect x="${(-w / 2).toFixed(1)}" y="-0.75" width="${w.toFixed(1)}" height="1.5" rx="0.75" fill="#ffffff"/>`
          + (j % 4 === 0 ? `<path d="M0,-3.2 L0.6,-0.6 L3.2,0 L0.6,0.6 L0,3.2 L-0.6,0.6 L-3.2,0 L-0.6,-0.6Z" fill="#ffffff"/>` : '')
          + `</g></g>`;
      }).join('')).join('')}</g>`;
  }
  // 받은 그림 속 물 위로 «물안개»가 피어오른다 (`spots[].mists` = [[띠 가운데 x, 밑 y, 띠 폭, 덩이 수], …] · viewBox 좌표).
  // 흐린 흰 덩이가 물 위에서 생겨 천천히 떠오르며 옆으로 흐르다 옅어진다 — 덩이마다 박자를 어긋낸다.
  // 자리는 덩이 번호로 고정한다 (무작위면 다시 그릴 때마다 옮겨 다닌다). 움직임 줄이기에서는 옅게 머문다
  function mistFx(list, u) {
    return `<g class="fx-mists" aria-hidden="true"><defs><filter id="mb_${u}" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>`
      + `<g filter="url(#mb_${u})">${list.map(([x, y, w, n], i) =>
      Array.from({ length: n }, (_, j) => {
        // 여섯째 칸이 있으면 흐르는 쪽·세기다 (1 = 왼쪽 · 음수 = 오른쪽 · 마을 지도의 굴뚝 연기는 그려진 연기를 따라 오른쪽)
        const t = (j + 0.5) / n, mx = x + (t - 0.5) * w, rx = w / n * 0.9 + 6, ry = rx * 0.38;
        const dur = 7 + ((j * 3 + i) % 4) * 1.3;
        return `<g transform="translate(${mx.toFixed(1)},${y})"><ellipse class="fx-mist" style="--dx:${(j % 2 ? 7 : -7)}px;--rise:${(-(8 + (j % 3) * 4))}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${(-((j * 1.9 + i * 1.3) % dur)).toFixed(1)}s" cx="0" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#ffffff"/></g>`;
      }).join('')).join('')}</g></g>`;
  }
  // 받은 그림 속 스테인드글라스에서 «빛이 떨어진다» (`spots[].rays` = [[창 가운데 x, y, 창 반지름, 바닥 x, 바닥 y, 바닥 폭], …] · viewBox 좌표).
  // 창에서 바닥까지 색 띠 셋(분홍·하늘·보라)이 비스듬히 내리고, 띠마다 박자를 어긋내 일렁인다 ·
  // 바닥에는 색 빛 웅덩이가 앉고, 빛 속으로 먼지 알갱이가 천천히 떨어진다. 움직임 줄이기에서는 옅게 멈춘다
  // 그림에 없는 «거미줄»을 구석에 친다 (`spots[].webs` = [[구석 x, y, 반지름, 시작 각, 끝 각], …] · viewBox 좌표 · 각은 도(0 오른쪽 · 90 아래)).
  // 구석에서 부챗살 실이 뻗고 고리 실이 살짝 처지며 잇는다 · 고리 위의 이슬은 dewFx 로 반짝인다 (자리는 실 번호로 고정한다)
  function webFx(list) {
    return list.map(([x, y, r, a0, a1]) => {
      // 끝 각 − 시작 각이 360 이면 «둥근 거미줄»이다 — 살 여덟이 고르게 돌고 고리가 한 바퀴 닫힌다 · 살은 고리 밖으로 조금 더 뻗어 들보에 걸린다
      const full = a1 - a0 >= 360, N = full ? 8 : 6, R = 4, pt = (a, d) => [x + Math.cos(a * Math.PI / 180) * d, y + Math.sin(a * Math.PI / 180) * d];
      const angs = Array.from({ length: N }, (_, k) => full ? a0 + 360 * k / N : a0 + (a1 - a0) * k / (N - 1));
      const f = v => v.toFixed(1);
      let d = angs.map(a => { const [ex, ey] = pt(a, full ? r * 1.35 : r); return `M${f(x)},${f(y)} L${f(ex)},${f(ey)}`; }).join(' ');
      const dews = [];
      for (let k = 1; k <= R; k++) {
        const rr = r * k / R;
        for (let j = 0; j < (full ? N : N - 1); j++) {
          const b = full && j === N - 1 ? angs[0] + 360 : angs[j + 1];
          const [px, py] = pt(angs[j], rr), [qx, qy] = pt(b, rr), [mx, my] = pt((angs[j] + b) / 2, rr * 0.86);
          d += ` M${f(px)},${f(py)} Q${f(mx)},${f(my)} ${f(qx)},${f(qy)}`;
          if ((k + j) % 3 === 0) dews.push([+f((px + qx) / 2 * 0.5 + mx * 0.5), +f((py + qy) / 2 * 0.5 + my * 0.5)]);
        }
      }
      return `<path class="fx-web" aria-hidden="true" d="${d}" fill="none" stroke="#e8e2da" stroke-width="0.5" stroke-linecap="round" opacity="0.7"/>` + dewFx(dews);
    }).join('');
  }
  // 받은 그림 속 거미줄에서 «거미가 실을 타고 오르내린다» (`spots[].spiders` = [[실 x, 실이 붙은 y, 쉬는 y, 크기 배율(없으면 1)], …] · viewBox 좌표).
  // 실은 붙은 자리에서 오려 낸다(clipPath) — 거미가 올라가도 실이 거미줄 위로 삐져나오지 않는다.
  // 움직임은 안쪽 겹에만 건다 (CSS transform 이 SVG 의 transform 속성을 덮어쓰기 때문이다). 움직임 줄이기에서는 제자리에 매달린다
  function spiderFx(list, u) {
    const leg = (sx, a, b) => `<path d="M${sx * 1.2},${a} Q${sx * 3.4},${a - 2.2} ${sx * 4.4},${b}" fill="none" stroke="#3a2a22" stroke-width="0.7" stroke-linecap="round"/>`;
    return `<g class="fx-spiders" aria-hidden="true">${list.map(([x, ay, ry, k = 1], i) => {
      const id = `sc_${u}_${i}`, len = ry - ay;
      const legs = [[-0.6, 1.4], [0.1, 2.8], [0.8, 4.2], [1.4, 5.4]].map(([a, b]) => leg(-1, a, b) + leg(1, a, b)).join('');
      return `<defs><clipPath id="${id}"><rect x="${x - 12}" y="${ay}" width="24" height="${200 - ay}"/></clipPath></defs>`
        + `<g clip-path="url(#${id})"><g transform="translate(${x},${ry})"><g class="fx-spider" style="animation-delay:${(-i * 2.3).toFixed(1)}s">`
        + `<line x1="0" y1="${-len - 30}" x2="0" y2="-1.5" stroke="#e8e2da" stroke-width="0.45" opacity="0.85"/>`
        + `<g transform="scale(${k})"><g class="fx-spider-body">${legs}<circle cx="0" cy="-0.6" r="1.6" fill="#3a2a22"/><ellipse cx="0" cy="2.6" rx="2.6" ry="3" fill="#4a352b"/>`
        + `<ellipse cx="-0.8" cy="1.6" rx="0.8" ry="0.6" fill="#7a5a48" opacity="0.7"/><circle cx="-0.6" cy="-0.9" r="0.38" fill="#fff"/><circle cx="0.6" cy="-0.9" r="0.38" fill="#fff"/></g></g>`
        + `</g></g></g>`;
    }).join('')}</g>`;
  }
  // 받은 그림 속 거미줄에 «이슬»이 맺혀 반짝인다 (`spots[].dews` = [[x, y], …] · viewBox 좌표 — 거미줄 가닥 위).
  // 작은 물방울이 저마다 박자를 어긋내 빛났다 잦아든다. 움직임 줄이기에서는 옅게 남는다
  function dewFx(list) {
    return `<g class="fx-dews" aria-hidden="true">${list.map(([x, y], i) =>
      `<g transform="translate(${x},${y})"><g class="fx-dew" style="animation-delay:${(-((i * 0.83) % 3.6)).toFixed(2)}s;animation-duration:${(3 + (i % 3) * 0.6).toFixed(1)}s">`
      + `<circle r="0.9" fill="#ffffff"/>`
      + (i % 3 === 0 ? `<path d="M0,-2.6 L0.4,-0.4 L2.6,0 L0.4,0.4 L0,2.6 L-0.4,0.4 L-2.6,0 L-0.4,-0.4Z" fill="#ffffff"/>` : '')
      + `</g></g>`).join('')}</g>`;
  }
  // 받은 그림 속 창빛 안에 «먼지»가 떠다닌다 (`spots[].motes` = [[상자 x, y, 폭, 높이, 개수], …] · viewBox 좌표).
  // 알갱이가 천천히 떠돌며 빛 속에서만 반짝인다 — 자리는 번호로 고정한다 (무작위면 다시 그릴 때마다 옮겨 다닌다).
  // 움직임 줄이기에서는 옅게 머문다
  function moteFx(list) {
    return `<g class="fx-motes" aria-hidden="true">${list.map(([x, y, w, h, n], i) =>
      Array.from({ length: n }, (_, j) => {
        // 여섯째 칸이 있으면 흐르는 쪽·세기다 (1 = 왼쪽 · 음수 = 오른쪽 · 마을 지도의 굴뚝 연기는 그려진 연기를 따라 오른쪽)
        const mx = x + w * (((j * 0.618 + i * 0.31) % 1)), my = y + h * (((j * 0.382 + 0.17) % 1));
        const dur = 7 + (j % 4) * 1.4;
        return `<circle class="fx-mote" style="--mx:${(j % 2 ? 4 : -4)}px;--my:${(-3 - (j % 3) * 2)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${(-((j * 1.7 + i) % dur)).toFixed(1)}s" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${(0.5 + (j % 3) * 0.2).toFixed(1)}" fill="#fff4d6"/>`;
      }).join('')).join('')}</g>`;
  }
  // 받은 그림 속 아궁이 위로 «연기»가 피어오른다 (`spots[].smokes` = [[나오는 x, y, 퍼지는 폭, 오르는 높이, 덩이 수], …] · viewBox 좌표).
  // 흐린 잿빛 덩이가 생겨 위로 오르며 커지고 한쪽으로 흐르다 옅어진다 — 덩이마다 박자를 어긋낸다 ·
  // 자리는 덩이 번호로 고정한다 (무작위면 다시 그릴 때마다 옮겨 다닌다). 움직임 줄이기에서는 옅게 머문다
  function smokeFx(list, u, blur = 2.2) {
    return `<g class="fx-smokes" aria-hidden="true"><defs><filter id="sb_${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>`
      + `<g filter="url(#sb_${u})">${list.map(([x, y, w, rise, n, lean = 1, tone], i) =>
      Array.from({ length: n }, (_, j) => {
        // 여섯째 칸이 있으면 흐르는 쪽·세기다 (1 = 왼쪽 · 음수 = 오른쪽 · 마을 지도의 굴뚝 연기는 그려진 연기를 따라 오른쪽)
        const sx = x + ((j * 0.618 + i * 0.3) % 1 - 0.5) * w, r = 4 + (j % 3) * 1.6;
        const dur = 5.5 + (j % 4) * 0.9;
        return `<g transform="translate(${sx.toFixed(1)},${y})"><circle class="fx-smoke${tone === 'out' ? ' out' : ''}" style="--dx:${(j % 2 ? -1 : -0.4) * w * 0.6 * lean}px;--rise:${-rise}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${(-((j * 1.3 + i) % dur)).toFixed(1)}s" cx="0" cy="0" r="${r.toFixed(1)}" fill="#d9cfc3"/></g>`;
      }).join('')).join('')}</g></g>`;
  }
  const RAY_COLS = ['#ff9ab8', '#9cc4ff', '#c79cff'];
  // 일곱째 칸이 'sun' 이면 맑은 유리창의 햇살이다 — 띠 셋이 따뜻한 흰빛으로 선다 (원석 창고)
  const SUN_COLS = ['#ffe4a6', '#fff3d1', '#ffd98c'];
  function rayFx(list, u) {
    return `<g class="fx-rays" aria-hidden="true">${list.map(([x, y, r, fx, fy, w, tone], i) => {
      const sun = tone === 'sun', cols = sun ? SUN_COLS : RAY_COLS;
      const id = `rg_${u}_${i}`, n = cols.length;
      const stripes = cols.map((c, k) => {
        const a0 = x - r + (2 * r) * k / n, a1 = x - r + (2 * r) * (k + 1) / n;
        const b0 = fx - w / 2 + w * k / n, b1 = fx - w / 2 + w * (k + 1) / n;
        return `<path class="fx-ray" style="animation-delay:${(-k * 1.4 - i).toFixed(1)}s;animation-duration:${(4.2 + k * 0.7).toFixed(1)}s" d="M${a0.toFixed(1)},${y} L${a1.toFixed(1)},${y} L${b1.toFixed(1)},${fy} L${b0.toFixed(1)},${fy}Z" fill="${c}" mask="url(#${id}m)"/>`;
      }).join('');
      // 햇살(sun)은 바닥에 «뿌연 웅덩이 하나» — 가장자리가 번져 사라지는 방사형이다 (원석 창고)
      const pool = sun
        ? `<ellipse class="fx-pool sun" cx="${fx}" cy="${fy}" rx="${(w * 0.62).toFixed(1)}" ry="${(w / 5.5).toFixed(1)}" fill="url(#${id}p)"/>`
        : cols.map((c, k) => `<ellipse class="fx-pool" style="animation-delay:${(-k * 1.4).toFixed(1)}s" cx="${(fx - w / 3 + w / 3 * k).toFixed(1)}" cy="${fy}" rx="${(w / 3.4).toFixed(1)}" ry="${(w / 9).toFixed(1)}" fill="${c}"/>`).join('');
      const dust = Array.from({ length: 7 }, (_, j) => {
        const t = (j + 0.5) / 7, dx = x + (fx - x) * t + ((j * 37) % 11 - 5) * (r + (w / 2 - r) * t) / 6;
        return `<circle class="fx-dust" style="animation-delay:${(-j * 1.1).toFixed(1)}s;animation-duration:${(6 + (j % 3)).toFixed(1)}s" cx="${dx.toFixed(1)}" cy="${(y + (fy - y) * t).toFixed(1)}" r="0.7" fill="#fff6dc"/>`;
      }).join('');
      return `<defs><linearGradient id="${id}" x1="0" y1="${y}" x2="0" y2="${fy}" gradientUnits="userSpaceOnUse">${sun
          // 햇살은 창틀에서 «잘려» 시작하지 않게 위 끝을 0 에서 번져 나온다
          ? '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.28" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.4"/><stop offset="1" stop-color="#fff" stop-opacity="0.05"/>'
          : '<stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0.1"/>'}</linearGradient>`
        + (sun ? `<radialGradient id="${id}p"><stop offset="0" stop-color="${SUN_COLS[1]}" stop-opacity="0.85"/><stop offset="0.5" stop-color="${SUN_COLS[0]}" stop-opacity="0.4"/><stop offset="1" stop-color="${SUN_COLS[0]}" stop-opacity="0"/></radialGradient>` : '')
        + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="200"><rect x="0" y="0" width="300" height="200" fill="url(#${id})"/></mask></defs>`
        + `<g class="fx-raybeam">${stripes}</g>${pool}${dust}`;
    }).join('')}</g>`;
  }
  const FLAME = 'M0,0 C-.52,0 -.56,-.46 -.26,-.8 C-.14,-.95 -.02,-1.15 0,-1.4 C.1,-1.12 .46,-.9 .5,-.46 C.54,-.1 .3,0 0,0Z';
  function fireFx(f, u) {
    const [x, y, w] = f;
    const t = (k, dx) => `translate(${(x + dx * w).toFixed(1)} ${y}) scale(${(w * k).toFixed(2)})`;
    const sparks = [-0.25, 0.05, 0.3, -0.1].map((dx, i) =>
      `<circle class="fx-spark" style="animation-delay:${(i * 0.45).toFixed(2)}s" cx="${(x + dx * w).toFixed(1)}" cy="${(y - w * 0.9).toFixed(1)}" r="${(w * 0.035).toFixed(2)}" fill="#ffd27a"/>`).join('');
    return `<g class="fx-fire" aria-hidden="true">
      <defs><radialGradient id="fg_${u}"><stop offset="0" stop-color="#ffb347" stop-opacity="0.55"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient></defs>
      <ellipse class="fx-glow" cx="${x}" cy="${(y - w * 0.6).toFixed(1)}" rx="${(w * 1.6).toFixed(1)}" ry="${(w * 1.3).toFixed(1)}" fill="url(#fg_${u})"/>
      <g transform="${t(1.0, 0)}"><path class="fx-flame f1" d="${FLAME}" fill="#f2552f"/></g>
      <g transform="${t(0.62, -0.12)}"><path class="fx-flame f2" d="${FLAME}" fill="#ff9a33"/></g>
      <g transform="${t(0.4, 0.04)}"><path class="fx-flame f3" d="${FLAME}" fill="#ffe17a"/></g>
      ${sparks}
    </g>`;
  }

  // 검사기가 «모양을 다» 재려면 이름 목록이 필요하다 — 손으로 적으면 새 모양이
  // 조용히 안 재진다 (`Portrait.hairs` 와 같은 규칙이다)
  window.Village = { scene, interior, W, hFor, shapes: Object.keys(ROOM) };
})();
