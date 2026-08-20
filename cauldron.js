// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 마법 솥 그림 (SVG)
//
//  솥 11종을 하나씩 그리지 않는다. **실루엣은 하나**고, 몸통·테두리 색과
//  장식(deco)만 데이터(CAULDRONS[].art)가 갈아 끼운다 — 옷과 같은 방식이다.
//  솥을 늘릴 때 이 파일을 건드릴 일은 새 장식이 필요할 때뿐이다.
//
//  움직이는 부분(거품 .bub · 반짝임 .twinkle · 발광 .brew-glow)은 style.css 가 맡는다.
//  여기서 만드는 것은 정지 그림이고, 클래스만 그대로 붙여 주면 애니메이션이 따라온다.
// ═══════════════════════════════════════════════════════════════
(function () {
  const D = window.GameData;

  // 기본값 — art 가 없는 솥이 있어도 옛 무쇠 솥 모양으로 그려진다
  const DEF = { body: ['#544d5c', '#332e3a', '#1b1822'], trim: ['#ecca72', '#b8912f', '#7d5f1f'] };

  // 몸통 타원 — 장식은 전부 여기 안쪽으로 잘린다
  const BODY = { cx: 100, cy: 114, rx: 76, ry: 64 };

  function starPath(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * rad).toFixed(1) + ',' + (cy + Math.sin(a) * rad).toFixed(1);
    }
    return d + 'Z';
  }

  // ─── 장식 ────────────────────────────────────────────────────
  // 몸통 위에 얹는다. 전면 메달리온(cy 94 언저리)과 놋쇠 밴드(cy 60)는 나중에 그려지므로
  // 여기서 그 자리를 피할 필요는 없다 — 가려질 뿐이다.
  function deco(kind, art, u) {
    const t = art.trim;
    switch (kind) {
      // 낡은 무쇠 — 붉은 녹이 번진 자국
      case 'rust':
        return `<g opacity="0.55">
          <ellipse cx="58" cy="128" rx="17" ry="11" fill="#7d4a28" transform="rotate(-18 58 128)"/>
          <ellipse cx="136" cy="106" rx="12" ry="9" fill="#8a5330" transform="rotate(24 136 106)"/>
          <ellipse cx="104" cy="152" rx="20" ry="7" fill="#6e3f22"/>
          <ellipse cx="80" cy="96" rx="7" ry="5" fill="#8a5330"/>
        </g>
        <g stroke="#2b2622" stroke-width="1.2" fill="none" opacity="0.5">
          <path d="M46,104 C54,112 52,124 60,132"/><path d="M120,86 C128,94 126,104 134,110"/>
        </g>`;

      // 잘 닦인 금속 — 넓은 광택 띠
      case 'shine':
        return `<ellipse cx="68" cy="88" rx="24" ry="34" fill="#fff" opacity="0.28" transform="rotate(-22 68 88)"/>
          <ellipse cx="60" cy="96" rx="9" ry="18" fill="#fff" opacity="0.4" transform="rotate(-22 60 96)"/>
          <ellipse cx="132" cy="132" rx="26" ry="12" fill="#fff" opacity="0.12" transform="rotate(-14 132 132)"/>`;

      // 화강석 — 잔 점박이
      case 'granite': {
        let s = '';
        // 규칙적인 난수 대신 **정해진 자리**를 쓴다. 다시 그릴 때마다 점이 옮겨 다니면 안 된다
        const pts = [[62, 96, 2.2], [78, 120, 1.6], [96, 88, 1.8], [112, 116, 2.4], [130, 98, 1.6],
          [70, 140, 2], [104, 146, 1.7], [140, 128, 2.1], [54, 116, 1.5], [122, 140, 1.4],
          [88, 106, 1.3], [136, 82, 1.5], [64, 76, 1.4], [116, 74, 1.6]];
        pts.forEach(([x, y, r], i) => {
          s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? '#6f6a61' : '#d6d0c6'}" opacity="0.7"/>`;
        });
        return s + `<path d="M40,120 L72,104 M96,150 L130,132" stroke="#6f6a61" stroke-width="1.4" opacity="0.5"/>`;
      }

      // 수정 — 빛을 받는 결정면
      case 'facet':
        return `<path d="M100,46 L44,112 L100,182 Z" fill="#fff" opacity="0.42"/>
          <path d="M100,46 L156,112 L100,182 Z" fill="#5f9fce" opacity="0.32"/>
          <path d="M44,112 L100,130 L156,112" fill="#fff" opacity="0.3"/>
          <g stroke="#fff" stroke-width="2" fill="none" opacity="0.85" stroke-linejoin="round">
            <path d="M100,46 L44,112 L100,182 L156,112 Z"/>
            <path d="M100,46 L100,182 M44,112 L100,130 L156,112"/>
          </g>
          <ellipse cx="70" cy="88" rx="12" ry="20" fill="#fff" opacity="0.55" transform="rotate(-24 70 88)"/>`;

      // 달빛 — 초승달과 은은한 무리
      case 'moon':
        return `<circle cx="100" cy="122" r="44" fill="${t[0]}" opacity="0.10"/>
          <circle cx="100" cy="122" r="30" fill="${t[0]}" opacity="0.10"/>
          <path d="M112,100 a26,26 0 1 0 0,44 a20,20 0 1 1 0,-44 Z" fill="${t[0]}" opacity="0.92"/>
          <g fill="${t[0]}" opacity="0.8">
            <path d="${starPath(64, 100, 5)}"/><path d="${starPath(142, 138, 4)}"/>
            <path d="${starPath(74, 148, 3.4)}"/>
          </g>`;

      // 별빛 — 여기저기 찬란하게
      case 'stars': {
        const big = [[62, 96, 7], [140, 104, 6], [100, 146, 6.5], [78, 142, 4.6], [126, 142, 4.2],
          [52, 126, 4.4], [150, 130, 4], [112, 90, 4.6], [86, 108, 4]];
        const small = [[70, 118, 2], [94, 128, 1.8], [118, 118, 2.2], [134, 88, 1.7], [60, 148, 1.8],
          [106, 108, 1.6], [146, 116, 1.9], [82, 84, 1.7], [124, 158, 1.8], [96, 166, 1.6]];
        return `<g fill="${t[0]}">${big.map(([x, y, r]) => `<path d="${starPath(x, y, r)}"/>`).join('')}</g>
          <g fill="#fff">${small.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
          <g fill="#fff" opacity="0.85">
            <circle class="twinkle" style="animation-delay:0.2s" cx="62" cy="96" r="2.6"/>
            <circle class="twinkle" style="animation-delay:0.9s" cx="140" cy="104" r="2.4"/>
            <circle class="twinkle" style="animation-delay:1.5s" cx="100" cy="146" r="2.4"/>
          </g>`;
      }

      // 용비늘 — **비늘만** 그린다.
      // 처음에는 몸통을 감아 도는 용을 그렸는데, 이 크기에서는 뱀으로 읽혔다.
      // 이름이 '용비늘 솥' 이니 용이 아니라 비늘이 주인공인 게 맞다.
      case 'dragon': {
        const W = 13, H = 23, STEP = 11;   // 반폭 · 높이 · 줄 간격
        // STEP 이 H 의 절반쯤이라 **위 줄이 아래 줄의 절반을 덮는다** —
        // 겹침이 적으면 둥근 밑단이 안 보여 벽돌처럼 각져 보인다
        let s = '';
        // 아래 줄부터 그린다. 지붕 기와처럼 위 비늘이 아래 비늘 위로 올라와야 한다
        for (let row = 0, y = 186; y > 30; row++, y -= STEP) {
          const off = row % 2 ? W : 0;
          for (let x = 6 + off; x < 202; x += W * 2) {
            s += `<g>
              <path d="M${x - W},${y} L${x + W},${y}
                       Q${x + W},${y + H * 0.72} ${x},${y + H}
                       Q${x - W},${y + H * 0.72} ${x - W},${y} Z"
                    fill="url(#${u}_scale)" stroke="${art.trim[2]}" stroke-width="1" stroke-linejoin="round"/>
              <path d="M${x - W + 2.5},${y + H * 0.30} Q${x},${y + H - 2.5} ${x + W - 2.5},${y + H * 0.30}"
                    stroke="${art.trim[0]}" stroke-width="1.1" opacity="0.55" fill="none"/>
              <path d="M${x},${y + 3} L${x},${y + H * 0.62}"
                    stroke="${art.trim[2]}" stroke-width="0.7" opacity="0.35" fill="none"/>
            </g>`;
          }
        }
        return s;
      }

      // 전설 — 룬 문자가 원을 그리며 새겨져 있다
      case 'runes': {
        const glyphs = [
          'M-5,-7 L-5,7 M-5,-7 L5,0 M-5,0 L5,7',        // ᚱ 비슷
          'M-5,7 L0,-7 L5,7 M-3,2 L3,2',                 // ᚨ
          'M-5,-7 L-5,7 M5,-7 L5,7 M-5,-7 L5,7',         // ᚾ
          'M0,-7 L0,7 M-5,-3 L5,-3',                     // 십자
          'M-5,-7 L0,0 L-5,7 M0,0 L5,0',                 // ᚲ
          'M-4,-7 L4,-7 L-4,7 L4,7',                     // ᛉ 변형
        ];
        let s = '';
        glyphs.forEach((g, i) => {
          const a = (-90 + i * 60) * Math.PI / 180;   // 원 한 바퀴에 고르게
          const x = (100 + Math.cos(a) * 52).toFixed(1), y = (118 + Math.sin(a) * 44).toFixed(1);
          s += `<g transform="translate(${x},${y})"><path d="${g}" stroke="${t[0]}" stroke-width="2.4"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
        });
        return `<circle cx="100" cy="118" r="52" fill="none" stroke="${t[1]}" stroke-width="1.6" opacity="0.55"/>
          <circle cx="100" cy="118" r="44" fill="none" stroke="${t[1]}" stroke-width="1" opacity="0.35"/>
          <g class="rune-glow" opacity="0.95">${s}</g>
          <circle cx="100" cy="118" r="58" fill="${t[0]}" opacity="0.07"/>`;
      }

      default:
        return '';
    }
  }

  // 몸통 **밖으로** 나가도 되는 층. 떠다니는 빛가루처럼 솥 주위를 도는 것들이 여기 온다.
  // (deco 는 몸통 타원으로 잘리므로 밖으로 떠오를 수가 없다)
  function decoOver(kind, art) {
    if (kind !== 'runes') return '';
    const t = art.trim;
    // 자리는 **정해 둔다** — 난수를 쓰면 다시 그릴 때마다 빛가루가 순간이동한다
    const motes = [[46, 128, 2.2, 0], [62, 92, 1.6, 0.7], [88, 76, 2, 1.4], [126, 78, 1.7, 2.1],
      [152, 96, 2.3, 2.8], [166, 132, 1.8, 3.5], [140, 158, 2, 0.4], [70, 160, 1.6, 1.1],
      [104, 168, 2.2, 1.8], [36, 106, 1.5, 2.5]];
    return `<g fill="${t[0]}">${motes.map(([x, y, r, d]) =>
      `<circle class="cd-mote" style="animation-delay:${d}s" cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  }

  // ─── 솥 한 대 ────────────────────────────────────────────────
  function svg(item) {
    const art = Object.assign({}, DEF, (item && item.art) || {});
    const b = art.body, t = art.trim;
    const B = BODY;
    // **그라디언트 id 는 솥마다 달라야 한다.** 한 문서에 같은 id 가 둘 있으면
    // 브라우저는 먼저 나온 것만 쓴다 — 대조표를 뽑았더니 열한 대가 전부
    // 첫 번째 솥(무쇠)의 어두운 몸통색으로 나왔다. 화면에는 한 대만 뜨지만,
    // 언젠가 두 대를 나란히 놓는 순간 같은 함정에 빠진다.
    const u = (item && item.id) || 'cd';
    const gBody = u + '_body', gTrim = u + '_trim', gBrew = u + '_brew',
      gGlow = u + '_glow', cBody = u + '_clipBody', cBrew = u + '_clipBrew';
    return `<svg class="cauldron-svg" viewBox="0 0 200 198" xmlns="http://www.w3.org/2000/svg"
        role="img" aria-label="${(item && item.name) || ''}">
      <defs>
        <radialGradient id="${gBody}" cx="0.38" cy="0.3" r="0.9">
          <stop offset="0" stop-color="${b[0]}"/><stop offset="0.55" stop-color="${b[1]}"/><stop offset="1" stop-color="${b[2]}"/>
        </radialGradient>
        <linearGradient id="${gTrim}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${t[0]}"/><stop offset="0.5" stop-color="${t[1]}"/><stop offset="1" stop-color="${t[2]}"/>
        </linearGradient>
        <radialGradient id="${gBrew}" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stop-color="#efb0f4"/><stop offset="0.45" stop-color="#b662d0"/><stop offset="1" stop-color="#5b2a74"/>
        </radialGradient>
        <radialGradient id="${gGlow}" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="rgba(242,184,255,0.9)"/><stop offset="1" stop-color="rgba(242,184,255,0)"/>
        </radialGradient>
        <linearGradient id="${u}_scale" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${t[0]}"/><stop offset="0.38" stop-color="${t[1]}"/><stop offset="1" stop-color="${t[2]}"/>
        </linearGradient>
        <clipPath id="${cBody}"><ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.rx}" ry="${B.ry}"/></clipPath>
        <clipPath id="${cBrew}"><ellipse cx="100" cy="57" rx="52" ry="14"/></clipPath>
      </defs>
      <!-- 그림자 -->
      <ellipse cx="100" cy="191" rx="72" ry="7" fill="rgba(80,60,40,0.16)"/>
      <!-- 뒤쪽 다리 2개 -->
      <g fill="url(#${gTrim})" stroke="${t[2]}" stroke-width="1.5" stroke-linejoin="round">
        <path d="M54,150 C45,164 41,178 49,186 L66,186 C63,173 63,160 68,150 Z"/>
        <path d="M146,150 C155,164 159,178 151,186 L134,186 C137,173 137,160 132,150 Z"/>
      </g>
      <!-- 몸통 -->
      <ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.rx}" ry="${B.ry}" fill="url(#${gBody})"/>
      <ellipse cx="66" cy="82" rx="20" ry="30" fill="${b[0]}" opacity="0.35" transform="rotate(-20 66 82)"/>
      <!-- 솥마다 다른 장식 (몸통 안쪽으로 잘린다) -->
      <g clip-path="url(#${cBody})">${deco(art.deco, art, u)}</g>
      <!-- 측면 고리 손잡이 -->
      <g stroke="url(#${gTrim})" fill="none" stroke-width="6">
        <ellipse cx="23" cy="80" rx="12" ry="16"/>
        <ellipse cx="177" cy="80" rx="12" ry="16"/>
      </g>
      <rect x="29" y="58" width="15" height="13" rx="3" fill="url(#${gTrim})" stroke="${t[2]}" stroke-width="1"/>
      <rect x="156" y="58" width="15" height="13" rx="3" fill="url(#${gTrim})" stroke="${t[2]}" stroke-width="1"/>
      <!-- 테두리 밴드 -->
      <ellipse cx="100" cy="65" rx="70" ry="23" fill="${t[2]}"/>
      <ellipse cx="100" cy="60" rx="70" ry="23" fill="url(#${gTrim})"/>
      <g fill="${t[2]}">
        <circle cx="46" cy="68" r="2.4"/><circle cx="64" cy="76" r="2.6"/><circle cx="84" cy="80" r="2.6"/>
        <circle cx="116" cy="80" r="2.6"/><circle cx="136" cy="76" r="2.6"/><circle cx="154" cy="68" r="2.4"/>
      </g>
      <!-- 개구부(내부 어둠) -->
      <ellipse cx="100" cy="57" rx="56" ry="16" fill="#241b2e"/>
      <!-- 물약(보라 발광) -->
      <ellipse cx="100" cy="57" rx="52" ry="14" fill="url(#${gBrew})"/>
      <ellipse class="brew-glow" cx="100" cy="55" rx="40" ry="10.5" fill="url(#${gGlow})"/>
      <g clip-path="url(#${cBrew})">
        <circle class="bub" style="animation-delay:0s"    cx="80"  cy="58" r="3.2" fill="#f4d9fb"/>
        <circle class="bub" style="animation-delay:0.5s"  cx="106" cy="54" r="2.4" fill="#f4d9fb"/>
        <circle class="bub" style="animation-delay:1s"    cx="124" cy="59" r="2.8" fill="#f4d9fb"/>
        <circle class="bub" style="animation-delay:1.5s"  cx="90"  cy="60" r="2"   fill="#f4d9fb"/>
        <circle class="bub" style="animation-delay:2s"    cx="132" cy="55" r="2"   fill="#f4d9fb"/>
      </g>
      <g fill="#fff">
        <circle class="twinkle" style="animation-delay:0s"   cx="86"  cy="52" r="1.5"/>
        <circle class="twinkle" style="animation-delay:0.6s" cx="112" cy="50" r="1.7"/>
        <circle class="twinkle" style="animation-delay:1.1s" cx="128" cy="55" r="1.3"/>
        <circle class="twinkle" style="animation-delay:1.7s" cx="98"  cy="53" r="1.2"/>
      </g>
      <!-- 전면 메달리온 -->
      <ellipse cx="100" cy="94" rx="19" ry="16" fill="url(#${gTrim})" stroke="${t[2]}" stroke-width="1.5"/>
      <ellipse cx="100" cy="94" rx="13" ry="10.5" fill="${t[2]}"/>
      <path d="M100,86 C97,90 97,93 100,95 C103,93 103,90 100,86 Z" fill="url(#${gTrim})"/>
      <path d="M92,92 C95,92 98,94 100,98 C97,99 92,97 92,92 Z M108,92 C105,92 102,94 100,98 C103,99 108,97 108,92 Z" fill="url(#${gTrim})"/>
      <rect x="98.7" y="94" width="2.6" height="8" rx="1" fill="url(#${gTrim})"/>
      <!-- 솥 주위를 떠다니는 것 (몸통 밖으로 나갈 수 있다) -->
      ${decoOver(art.deco, art)}
      <!-- 앞쪽 가운데 다리 -->
      <path d="M87,166 C85,179 89,188 100,188 C111,188 115,179 113,166 C108,170 92,170 87,166 Z"
            fill="url(#${gTrim})" stroke="${t[2]}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M100,170 L100,184 M95,176 L105,176" stroke="${t[2]}" stroke-width="1.4" fill="none"/>
    </svg>`;
  }

  window.Cauldron = { svg };
})();
