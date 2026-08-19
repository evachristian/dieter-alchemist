// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 튜토리얼 인트로 (최초 진입 1회)
//  중세 배경 / 공주(통통) + 요정 대모 / 6컷 시나리오
// ═══════════════════════════════════════════════════════════════
(function () {
  const SEEN_KEY = 'dieter_alchemist_intro_seen_v1';

  // ─── 공용 파츠 ───────────────────────────────────────────────
  const SKIN = '#ffdcc4', SKIN_SH = '#f2c6a6', HAIR = '#7b5640', HAIR_SH = '#63432f';

  // 중세 실내 배경 — 9:16 세로 (400 x 711)
  function bg() {
    return `
      <rect x="0" y="0" width="400" height="711" fill="url(#iWall)"/>
      <g stroke="rgba(120,90,60,0.16)" stroke-width="2">
        <line x1="0" y1="110" x2="400" y2="110"/><line x1="0" y1="210" x2="400" y2="210"/>
        <line x1="0" y1="310" x2="400" y2="310"/><line x1="0" y1="410" x2="400" y2="410"/><line x1="0" y1="510" x2="400" y2="510"/>
        <line x1="70" y1="0" x2="70" y2="110"/><line x1="200" y1="0" x2="200" y2="110"/><line x1="320" y1="0" x2="320" y2="110"/>
        <line x1="30" y1="110" x2="30" y2="210"/><line x1="150" y1="110" x2="150" y2="210"/><line x1="270" y1="110" x2="270" y2="210"/>
        <line x1="90" y1="210" x2="90" y2="310"/><line x1="230" y1="210" x2="230" y2="310"/><line x1="350" y1="210" x2="350" y2="310"/>
        <line x1="40" y1="310" x2="40" y2="410"/><line x1="180" y1="310" x2="180" y2="410"/><line x1="310" y1="310" x2="310" y2="410"/>
      </g>
      <!-- 아치창 + 달 -->
      <path d="M262,300 L262,150 A58,58 0 0 1 378,150 L378,300 Z" fill="#5b4636"/>
      <path d="M270,294 L270,153 A50,50 0 0 1 370,153 L370,294 Z" fill="url(#iSky)"/>
      <circle cx="348" cy="150" r="17" fill="#fff3cf"/><circle cx="340" cy="145" r="13" fill="url(#iSky)" opacity="0.55"/>
      <circle cx="292" cy="146" r="2" fill="#fff"/><circle cx="308" cy="126" r="1.6" fill="#fff"/>
      <circle cx="356" cy="230" r="1.8" fill="#fff"/><circle cx="288" cy="248" r="1.5" fill="#fff"/>
      <line x1="320" y1="98" x2="320" y2="294" stroke="#5b4636" stroke-width="5"/>
      <line x1="270" y1="212" x2="370" y2="212" stroke="#5b4636" stroke-width="5"/>
      <!-- 벽 촛대 -->
      <g>
        <rect x="66" y="252" width="6" height="26" rx="2" fill="#7a5f3a"/>
        <rect x="58" y="242" width="22" height="12" rx="4" fill="#a8874f"/>
        <ellipse cx="69" cy="232" rx="5" ry="8" fill="#ffcf6a" class="i-flame"/>
        <circle cx="69" cy="234" r="22" fill="#ffd98a" opacity="0.16"/>
      </g>
      <!-- 바닥 -->
      <rect x="0" y="440" width="400" height="271" fill="url(#iFloor)"/>
      <rect x="0" y="440" width="400" height="6" fill="#8a6038"/>
      <g stroke="#8a6038" stroke-width="2" opacity="0.5">
        <line x1="130" y1="446" x2="30" y2="711"/><line x1="200" y1="446" x2="200" y2="711"/><line x1="270" y1="446" x2="370" y2="711"/>
      </g>
      <line x1="0" y1="530" x2="400" y2="530" stroke="#8a6038" stroke-width="1.6" opacity="0.45"/>`;
  }

  // 통통한 공주 — 앞모습으로 치킨 먹는 중
  function princessEating() {
    return `<g>
      <ellipse cx="150" cy="286" rx="52" ry="8" fill="rgba(80,60,40,0.18)"/>
      <!-- 드레스(넉넉한 실루엣) -->
      <path d="M104,286 C100,236 112,206 150,206 C188,206 200,236 196,286 Z" fill="#7fa06a"/>
      <path d="M112,262 L188,262" stroke="#6a8a58" stroke-width="4"/>
      <!-- 팔: 오른팔은 치킨을 들고 입으로, 왼팔은 접시 옆으로 -->
      <path d="M108,228 C100,216 106,204 118,202" stroke="#7fa06a" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M190,226 C200,240 198,256 190,264" stroke="#7fa06a" stroke-width="16" fill="none" stroke-linecap="round"/>
      <circle cx="192" cy="266" r="8" fill="${SKIN}"/>
      <!-- 뒷머리 -->
      <ellipse cx="150" cy="176" rx="40" ry="38" fill="${HAIR}"/>
      <path d="M112,178 C106,214 114,244 128,246 C118,222 116,198 120,184 Z" fill="${HAIR}"/>
      <path d="M188,178 C194,214 186,244 172,246 C182,222 184,198 180,184 Z" fill="${HAIR}"/>
      <!-- 얼굴 (통통) -->
      <ellipse cx="150" cy="180" rx="34" ry="33" fill="${SKIN}"/>
      <ellipse cx="150" cy="205" rx="17" ry="9" fill="${SKIN_SH}" opacity="0.5"/>
      <!-- 행복하게 먹는 표정 (^ ^) -->
      <path d="M130,178 Q137,171 144,178" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M156,178 Q163,171 170,178" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="126" cy="188" rx="7" ry="4.6" fill="#ff9db4" opacity="0.5"/>
      <ellipse cx="174" cy="188" rx="7" ry="4.6" fill="#ff9db4" opacity="0.5"/>
      <!-- 우물우물 입 -->
      <ellipse class="i-mouth" cx="150" cy="194" rx="8" ry="6" fill="#b5566a"/>
      <!-- 앞머리 -->
      <path d="M116,174 C114,146 128,136 150,136 C172,136 186,146 184,174
        C180,160 168,152 150,152 C132,152 120,160 116,174 Z" fill="${HAIR}"/>
      <!-- 치킨을 쥔 손 + 입가로 가져가는 치킨 다리 -->
      <g class="i-munch">
        <!-- 손바닥 -->
        <ellipse cx="120" cy="203" rx="9.5" ry="8.5" fill="${SKIN}"/>
        <!-- 치킨(살점 + 뼈) -->
        <ellipse cx="128" cy="194" rx="11" ry="8.5" fill="#d99341" transform="rotate(-18 128 194)"/>
        <rect x="134" y="186" width="12" height="5" rx="2.5" fill="#f2e2c8" transform="rotate(-18 140 188)"/>
        <!-- 쥐고 있는 손가락 (치킨 위로) -->
        <path d="M114,199 q6,-4 12,-2" stroke="${SKIN}" stroke-width="4.6" fill="none" stroke-linecap="round"/>
        <path d="M116,204 q6,-3 12,-1" stroke="${SKIN}" stroke-width="4.6" fill="none" stroke-linecap="round"/>
        <path d="M119,209 q6,-3 11,-1" stroke="${SKIN_SH}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      </g>
      <!-- 치킨 접시 -->
      <ellipse cx="150" cy="284" rx="36" ry="9.5" fill="#e6dbc6"/>
      <ellipse cx="150" cy="281" rx="31" ry="8" fill="#fffaf0"/>
      <ellipse cx="139" cy="276" rx="11" ry="8" fill="#d99341"/><rect x="129" y="274" width="8" height="4" rx="2" fill="#f2e2c8"/>
      <ellipse cx="163" cy="278" rx="10" ry="7" fill="#c9853a"/><rect x="169" y="276" width="8" height="4" rx="2" fill="#f2e2c8"/>
    </g>`;
  }

  // 이마에 흐르는 왕 땀 (당황 연출)
  function sweatDrop(x, y, s, cls) {
    return `<g class="i-sweat ${cls || ''}" style="transform-box:view-box; transform-origin:${x}px ${y}px">
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M0,-15 C5.5,-4.5 11,2 11,7.5 A11,11 0 1 1 -11,7.5 C-11,2 -5.5,-4.5 0,-15 Z"
              fill="#9fdff7" stroke="#57b4de" stroke-width="1.6" opacity="0.95"/>
        <ellipse cx="-3.8" cy="4.5" rx="3.2" ry="4.6" fill="#ffffff" opacity="0.8"/>
      </g>
    </g>`;
  }

  // 통통한 공주 — 앞모습 (표정 지정)
  // bubble: 머리 위 말풍선 / sweat: 이마에 흐르는 왕 땀
  // over: 앞머리 위에 그릴 요소 (땀방울 등)
  function princessFront(mood, bubble, sweat) {
    let eyes, mouth, extra = '', over = '';
    if (mood === 'shy') {
      eyes = `<path d="M132,176 Q138,170 144,176" stroke="#4a3a42" stroke-width="2.6" fill="none" stroke-linecap="round"/>
              <path d="M156,176 Q162,170 168,176" stroke="#4a3a42" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      mouth = `<path d="M144,190 Q150,186 156,190" stroke="#c97b86" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      extra = `<g class="i-blush" fill="#ff9db4" opacity="0.55"><ellipse cx="128" cy="186" rx="8" ry="5"/><ellipse cx="172" cy="186" rx="8" ry="5"/></g>`;
      // 이마(관자놀이)에서 흘러내리는 왕 땀 — 두 방울을 시차를 두고 반복
      if (sweat) over = sweatDrop(178, 158, 0.45, '') + sweatDrop(122, 162, 0.33, 'd2');
    } else if (mood === 'smile') {
      // 엔딩용 — 활짝 웃는 표정
      eyes = `<path d="M132,178 Q138,170 144,178" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>
              <path d="M156,178 Q162,170 168,178" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
      mouth = `<path d="M142,188 Q150,196 158,188" stroke="#c97b86" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      extra = `<g class="i-blush" fill="#ff9db4" opacity="0.6"><ellipse cx="127" cy="186" rx="8.5" ry="5.2"/><ellipse cx="173" cy="186" rx="8.5" ry="5.2"/></g>`;
    } else if (mood === 'ask') {
      eyes = `<ellipse cx="138" cy="176" rx="5.4" ry="6.6" fill="#4a3a42"/><ellipse cx="162" cy="176" rx="5.4" ry="6.6" fill="#4a3a42"/>
              <circle cx="140" cy="173.5" r="1.9" fill="#fff"/><circle cx="164" cy="173.5" r="1.9" fill="#fff"/>`;
      mouth = `<ellipse cx="150" cy="191" rx="4" ry="3" fill="#b5566a"/>`;
    } else if (mood === 'dizzy') {
      // 텔레포트 후유증: 빙글빙글 도는 눈
      // 두 눈이 '각자 제자리에서' 회전하도록 눈마다 그룹 + 회전 중심 지정
      eyes = `<g fill="none" stroke="#4a3a42" stroke-width="2.2" stroke-linecap="round">
          <g class="i-dizzy" style="transform-box:view-box; transform-origin:138px 176px">
            <path d="M138,176 m0,-7 a7,7 0 1 1 -5,12 a4.5,4.5 0 1 1 5,-7.5 a2.4,2.4 0 1 1 -2,3"/>
          </g>
          <g class="i-dizzy" style="transform-box:view-box; transform-origin:162px 176px">
            <path d="M162,176 m0,-7 a7,7 0 1 1 -5,12 a4.5,4.5 0 1 1 5,-7.5 a2.4,2.4 0 1 1 -2,3"/>
          </g>
        </g>`;
      mouth = `<ellipse cx="150" cy="193" rx="6.5" ry="5" fill="#b5566a"/>`;
      extra = `<g fill="#ff9db4" opacity="0.5"><ellipse cx="126" cy="188" rx="7" ry="4.6"/><ellipse cx="174" cy="188" rx="7" ry="4.6"/></g>`;
    } else { // scream
      eyes = `<path d="M132,178 L144,172 M132,172 L144,178" stroke="#4a3a42" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M156,172 L168,178 M156,178 L168,172" stroke="#4a3a42" stroke-width="2.6" stroke-linecap="round"/>`;
      mouth = `<ellipse cx="150" cy="193" rx="7" ry="9" fill="#b5566a"/>`;
    }
    return `<g>
      <ellipse cx="150" cy="286" rx="52" ry="8" fill="rgba(80,60,40,0.18)"/>
      <path d="M104,286 C100,236 112,206 150,206 C188,206 200,236 196,286 Z" fill="#7fa06a"/>
      <path d="M112,262 L188,262" stroke="#6a8a58" stroke-width="4"/>
      <path d="M108,224 C96,242 96,258 102,268" stroke="#7fa06a" stroke-width="17" fill="none" stroke-linecap="round"/>
      <path d="M192,224 C204,242 204,258 198,268" stroke="#7fa06a" stroke-width="17" fill="none" stroke-linecap="round"/>
      <circle cx="100" cy="270" r="8" fill="${SKIN}"/><circle cx="200" cy="270" r="8" fill="${SKIN}"/>
      <!-- 뒷머리 -->
      <ellipse cx="150" cy="176" rx="40" ry="38" fill="${HAIR}"/>
      <path d="M112,178 C106,214 114,244 128,246 C118,222 116,198 120,184 Z" fill="${HAIR}"/>
      <path d="M188,178 C194,214 186,244 172,246 C182,222 184,198 180,184 Z" fill="${HAIR}"/>
      <!-- 얼굴 (통통) -->
      <ellipse cx="150" cy="180" rx="34" ry="33" fill="${SKIN}"/>
      <ellipse cx="150" cy="205" rx="17" ry="9" fill="${SKIN_SH}" opacity="0.5"/>
      ${extra}
      ${eyes}
      ${mouth}
      <!-- 앞머리 (부드러운 라운드 뱅) -->
      <path d="M116,174 C114,146 128,136 150,136 C172,136 186,146 184,174
        C180,160 168,152 150,152 C132,152 120,160 116,174 Z" fill="${HAIR}"/>
      ${over}
      ${bubble ? speechBubble() : ''}
    </g>`;
  }

  // ─── Scene #2: 어둡고 허름한 연금술 공방 ───
  function bg2() {
    return `
      <rect x="0" y="0" width="400" height="711" fill="url(#iWall2)"/>
      <g stroke="rgba(40,32,26,0.28)" stroke-width="2">
        <line x1="0" y1="110" x2="400" y2="110"/><line x1="0" y1="210" x2="400" y2="210"/>
        <line x1="0" y1="310" x2="400" y2="310"/><line x1="0" y1="410" x2="400" y2="410"/>
        <line x1="80" y1="0" x2="80" y2="110"/><line x1="230" y1="0" x2="230" y2="110"/>
        <line x1="40" y1="110" x2="40" y2="210"/><line x1="170" y1="110" x2="170" y2="210"/><line x1="300" y1="110" x2="300" y2="210"/>
        <line x1="110" y1="210" x2="110" y2="310"/><line x1="260" y1="210" x2="260" y2="310"/>
      </g>
      <!-- 갈라진 벽 -->
      <path d="M60,120 L70,160 L58,196 L72,240" stroke="rgba(40,32,26,0.3)" stroke-width="2.4" fill="none"/>
      <path d="M340,220 L330,260 L344,300" stroke="rgba(40,32,26,0.26)" stroke-width="2" fill="none"/>
      <!-- 작은 창 (빛 조금) -->
      <rect x="286" y="150" width="66" height="86" rx="6" fill="#3a3550"/>
      <rect x="292" y="156" width="54" height="74" rx="4" fill="url(#iSky2)"/>
      <line x1="319" y1="156" x2="319" y2="230" stroke="#3a3550" stroke-width="4"/>
      <line x1="292" y1="193" x2="346" y2="193" stroke="#3a3550" stroke-width="4"/>
      <!-- 거미줄 (좌상단) -->
      <g stroke="rgba(255,255,255,0.18)" stroke-width="1.6" fill="none">
        <path d="M0,0 L64,64 M0,30 L64,64 M30,0 L64,64"/>
        <path d="M12,12 Q30,20 34,34 M24,24 Q42,32 46,46"/>
      </g>
      <!-- 선반 + 낡은 병 -->
      <rect x="30" y="270" width="96" height="7" rx="2" fill="#4a3a2c"/>
      <rect x="44" y="246" width="13" height="24" rx="4" fill="#5f7a6a" opacity="0.9"/>
      <rect x="66" y="252" width="12" height="18" rx="5" fill="#7a5f6a" opacity="0.9"/>
      <rect x="88" y="242" width="12" height="28" rx="4" fill="#6a6a4a" opacity="0.9"/>
      <!-- 바닥 -->
      <rect x="0" y="440" width="400" height="271" fill="url(#iFloor2)"/>
      <rect x="0" y="440" width="400" height="6" fill="#43331f"/>
      <g stroke="#43331f" stroke-width="2" opacity="0.5">
        <line x1="130" y1="446" x2="30" y2="711"/><line x1="200" y1="446" x2="200" y2="711"/><line x1="270" y1="446" x2="370" y2="711"/>
      </g>
      <!-- 어두운 비네트 -->
      <rect x="0" y="0" width="400" height="711" fill="url(#iVig)"/>`;
  }

  // 큰 가마솥 (마법으로 등장)
  function bigCauldron() {
    return `<g class="i-cauldron">
      <ellipse cx="300" cy="556" rx="66" ry="10" fill="rgba(0,0,0,0.28)"/>
      <g fill="#b8912f" stroke="#5a4420" stroke-width="1.5">
        <path d="M258,506 C250,522 247,536 254,544 L268,544 C266,532 266,518 270,506 Z"/>
        <path d="M342,506 C350,522 353,536 346,544 L332,544 C334,532 334,518 330,506 Z"/>
      </g>
      <ellipse cx="300" cy="480" rx="62" ry="52" fill="#2f2a38"/>
      <ellipse cx="276" cy="456" rx="16" ry="24" fill="#4c4658" opacity="0.4" transform="rotate(-20 276 456)"/>
      <g stroke="#b8912f" fill="none" stroke-width="5">
        <ellipse cx="240" cy="452" rx="10" ry="13"/><ellipse cx="360" cy="452" rx="10" ry="13"/>
      </g>
      <ellipse cx="300" cy="443" rx="57" ry="18" fill="#8a6a24"/>
      <ellipse cx="300" cy="439" rx="57" ry="18" fill="#b8912f"/>
      <ellipse cx="300" cy="437" rx="46" ry="12" fill="#241b2e"/>
      <ellipse cx="300" cy="437" rx="43" ry="10.5" fill="url(#iBrew)"/>
      <ellipse class="i-spark" cx="300" cy="435" rx="30" ry="7" fill="#f2b8ff" opacity="0.7"/>
      <path d="${star(320, 424, 4)}" fill="#fff3b0"/>
      <path d="${star(282, 428, 3)}" fill="#fff3b0"/>
      <!-- 앞 다리 -->
      <path d="M288,524 C286,540 291,550 300,550 C309,550 314,540 312,524 C308,528 292,528 288,524 Z" fill="#b8912f" stroke="#5a4420" stroke-width="1.5"/>
    </g>`;
  }

  // 머리 위 말풍선 (느낌표 + 물음표)
  function speechBubble() {
    return `<g class="i-bubble">
      <path d="M176,126 L168,148 L188,134 Z" fill="#fffdf6" stroke="#e2d6c4" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="196" cy="106" rx="30" ry="23" fill="#fffdf6" stroke="#e2d6c4" stroke-width="2"/>
      <text x="196" y="117" text-anchor="middle" font-size="28" font-weight="900"
        font-family="'Noto Sans KR', sans-serif" fill="#c9566e">!?</text>
    </g>`;
  }

  // 요정 대모 (신데렐라풍: 하늘색 후드망토 + 지팡이)
  function fairy(pose) {
    // 완드: 손(302,268)을 축으로 회전 → 항상 손에 쥔 상태
    const tap = pose === 'tap';
    const cast = pose === 'cast' || pose === 'castbig' || tap;
    // 표정: 기본은 걱정, 'smile'/'castbig'은 미소, 'glance'는 공주 쪽 곁눈질
    const happy = pose === 'smile' || pose === 'castbig';
    const glance = pose === 'glance';
    // 곁눈질 — 흰자 위에서 눈동자가 공주(왼쪽) 쪽으로 굴러간다
    const glanceFace = `
      <path d="M316,176 Q322,172 327,176" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round" transform="rotate(-14 321.5 174)"/>
      <path d="M333,176 Q338,172 344,176" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round" transform="rotate(10 338.5 174)"/>
      <ellipse cx="322" cy="187" rx="6.2" ry="6.6" fill="#fffdfd" stroke="#d8d0dc" stroke-width="0.9"/>
      <ellipse cx="338" cy="187" rx="6.2" ry="6.6" fill="#fffdfd" stroke="#d8d0dc" stroke-width="0.9"/>
      <g class="i-glance">
        <ellipse cx="322" cy="187" rx="3.5" ry="4.6" fill="#4a3a42"/>
        <ellipse cx="338" cy="187" rx="3.5" ry="4.6" fill="#4a3a42"/>
        <circle cx="323" cy="185.2" r="1.2" fill="#fff"/><circle cx="339" cy="185.2" r="1.2" fill="#fff"/>
      </g>
      <ellipse cx="313" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.6"/>
      <ellipse cx="347" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.6"/>
      <!-- 살짝 삐딱한 입 (미심쩍은 표정) -->
      <path d="M324,201 Q329,198 336,200" stroke="#c97b86" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
    const face = glance ? glanceFace : happy
      ? `<path d="M315,177 Q322,174 328,178" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round"/>
         <path d="M332,178 Q338,174 345,177" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round"/>
         <path d="M317,188 Q322,182 327,188" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>
         <path d="M333,188 Q338,182 343,188" stroke="#4a3a42" stroke-width="2.8" fill="none" stroke-linecap="round"/>
         <ellipse cx="313" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.7"/>
         <ellipse cx="347" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.7"/>
         <path d="M324,198 Q330,205 336,198" stroke="#c97b86" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M316,176 Q322,172 327,176" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round" transform="rotate(-12 321.5 174)"/>
         <path d="M333,176 Q338,172 344,176" stroke="#8a7a86" stroke-width="2.2" fill="none" stroke-linecap="round" transform="rotate(12 338.5 174)"/>
         <ellipse cx="322" cy="187" rx="4" ry="5" fill="#4a3a42"/><ellipse cx="338" cy="187" rx="4" ry="5" fill="#4a3a42"/>
         <circle cx="323.4" cy="185" r="1.4" fill="#fff"/><circle cx="339.4" cy="185" r="1.4" fill="#fff"/>
         <ellipse cx="313" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.6"/>
         <ellipse cx="347" cy="195" rx="5" ry="3.4" fill="#ffb0c4" opacity="0.6"/>
         <path d="M325,201 Q330,197 335,201" stroke="#c97b86" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    // tap: 완드를 공주(왼쪽) 쪽으로 크게 기울여 '톡' 치는 자세
    const wandRot = tap ? -62 : (cast ? -34 : -14);
    const wandCls = tap ? 'i-wandtap' : (cast ? 'i-wandcast' : '');
    const wand = `<g transform="rotate(${wandRot} 302 268)"><g class="${wandCls}">
        <rect x="300" y="188" width="4.6" height="88" rx="2.3" fill="#d8c49a"/>
        <path d="${star(302.3, 182, cast ? 11 : 9)}" fill="#fff3b0" stroke="#ffe07a" stroke-width="1.5"/>
        <!-- 쥔 손 -->
        <circle cx="302" cy="268" r="7.5" fill="${SKIN}"/>
        <path d="M296,264 q6,-2.5 12,0" stroke="${SKIN_SH}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
        <path d="M296,270 q6,-2.5 12,0" stroke="${SKIN_SH}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      </g></g>`;
    return `<g>
      <ellipse cx="330" cy="288" rx="42" ry="7" fill="rgba(80,60,40,0.16)"/>
      <!-- 망토(넉넉) -->
      <path d="M296,288 C292,240 306,206 330,206 C354,206 368,240 364,288 Z" fill="#8fc5e8"/>
      <path d="M330,206 C318,206 310,214 308,226 L352,226 C350,214 342,206 330,206 Z" fill="#a8d6f2"/>
      <!-- 팔 -->
      <path d="M304,232 C294,244 296,258 302,266" stroke="#8fc5e8" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M356,232 C366,242 366,254 360,262" stroke="#8fc5e8" stroke-width="14" fill="none" stroke-linecap="round"/>
      <circle cx="302" cy="268" r="7" fill="${SKIN}"/>
      <!-- 후드 뒤판 (얼굴보다 먼저) -->
      <path d="M330,142 C304,142 288,162 288,190 C288,204 293,216 301,224 L359,224 C367,216 372,204 372,190 C372,162 356,142 330,142 Z" fill="#7fb8de"/>
      <!-- 얼굴 -->
      <ellipse cx="330" cy="186" rx="26" ry="26" fill="${SKIN}"/>
      ${face}
      <!-- 백발 앞머리 -->
      <path d="M306,180 C304,160 316,152 330,152 C344,152 356,160 354,180 C348,170 340,166 330,170 C320,166 312,170 306,180 Z" fill="#eeeaf2"/>
      <!-- 후드 앞테두리 (얼굴 감싸는 띠) -->
      <path d="M330,142 C304,142 288,162 288,190 C288,199 290,207 294,214 L303,209 C300,203 299,197 299,190 C299,168 313,152 330,152 C347,152 361,168 361,190 C361,197 360,203 357,209 L366,214 C370,207 372,199 372,190 C372,162 356,142 330,142 Z" fill="#a8d6f2"/>
      ${wand}
    </g>`;
  }

  function star(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.45;
      d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + 'Z';
  }

  // 반짝이 파티클
  function sparkles(n, seedX, seedY, spread) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = seedX + ((i * 53) % spread) - spread / 2;
      const y = seedY + ((i * 37) % spread) - spread / 2;
      const r = 2 + (i % 3);
      s += `<path class="i-spark" style="animation-delay:${(i * 0.18).toFixed(2)}s" d="${star(x, y, r)}" fill="#fff3b0"/>`;
    }
    return s;
  }

  // ─── 배치 (9:16 캔버스 위에 캐릭터 앉히기) ───────────────────
  // 두 캐릭터의 발끝이 같은 바닥선(y=650)에 오도록 스케일/이동
  const P = s => `<g transform="translate(-90, 76) scale(1.5)">${s}</g>`;      // 공주 (왼쪽)
  const F = s => `<g transform="translate(-157, 108) scale(1.38)">${s}</g>`;   // 요정 (오른쪽)

  // ─── 씬 정의 ────────────────────────────────────────────────
  const IT = (k) => (window.I18N ? I18N.t(k) : k);
  // sfx: 해당 컷이 표시될 때 재생할 효과음 이름 (설정에서 Off 시 무음)
  // sfx2: 조금 늦게 한 번 더 재생 (예: 땀 → 두 번째 방울)
  const SCENES = [
    // 치킨을 뜯는 소리 "냠냠냠…"
    { art: () => bg() + P(princessEating()), sp: 'sp_narrator', key: 'intro_1', sfx: 'chew' },
    { art: () => bg() + P(princessEating()) + F(fairy('idle')) + sparkles(7, 300, 370, 130), sp: 'sp_fairy', key: 'intro_2', sfx: 'sparkle' },
    // 이마에 왕 땀 — "뚝…"
    { art: () => bg() + P(princessFront('shy', false, true)) + F(fairy('glance')), sp: 'sp_princess', key: 'intro_3', sfx: 'sweat', sfx2: ['sweat', 950] },
    { art: () => bg() + P(princessFront('shy')) + F(fairy('idle')) + sparkles(6, 300, 380, 120), sp: 'sp_fairy', key: 'intro_4', sfx: 'sparkle' },
    // "?!" — 놀라는 소리 "허억?"
    { art: () => bg() + P(princessFront('ask', true)) + F(fairy('idle')), sp: 'sp_princess', key: 'intro_5', sfx: 'gasp' },
    { art: () => bg() + P(princessFront('ask')) + F(fairy('cast')) + sparkles(9, 285, 340, 150), sp: 'sp_fairy', key: 'intro_6', sfx: 'magic' },
    // 요정이 별 지팡이로 공주를 '톡' — 마법이 뻗어나감 (대사 없음, 짧게)
    { art: () => bg() + P(princessFront('ask')) + F(fairy('tap')) + tapSpark(158, 420) + sparkles(8, 250, 400, 120),
      sp: 'sp_narrator', key: 'intro_8', hold: 900, sfx: 'tap' },
    // 텔레포트 시전 — 마법 강조 (빛기둥 + 마법진 + 반짝이)
    { art: () => bg() + teleportFx() + `<g class="i-vanish">${P(princessFront('scream'))}</g>` + F(fairy('cast')) + sparkles(16, 140, 380, 210),
      sp: 'sp_princess', key: 'intro_7', sfx: 'magic' },
    // 공주가 '펑!' 하고 사라진 직후 (대사 없음) → 2초 뒤 자동으로 Scene #2
    { art: () => bg() + teleportFx(true) + burst(145, 400, 1.15) + F(fairy('cast')) + sparkles(12, 140, 400, 200),
      sp: 'sp_narrator', key: 'intro_8', hold: 2000, flash: true, sfx: 'pop' },

    // ── Scene #2: 어둡고 허름한 연금술 공방 ──
    // Scene #2 첫 컷: '펑!' 하고 나타남 + 화면 전환 플래시
    { art: () => bg2() + burst(145, 400, 1.15) + P(princessFront('dizzy')) + F(fairy('idle')) + sparkles(6, 250, 380, 150),
      sp: 'sp_fairy', key: 'intro_9', flash: true, sfx: 'pop', sfx2: ['dizzy', 420] },
    { art: () => bg2() + P(princessFront('dizzy')) + F(fairy('idle')),
      sp: 'sp_princess', key: 'intro_10' },
    // 요정이 마법으로 큰 가마솥을 만든다 → 가마솥 등장 + 미소
    { art: () => bg2() + P(princessFront('ask')) + F(fairy('castbig')) + bigCauldron() + sparkles(12, 300, 470, 170),
      sp: 'sp_fairy', key: 'intro_11', sfx: 'bubble' },
  ];

  // ─── 엔딩: 이름을 지은 뒤 요정 대모의 마무리 대사 → '시작하기' ───
  let endName = '';
  const ENDING = [
    { art: () => bg2() + P(princessFront('smile')) + F(fairy('smile')) + bigCauldron() + sparkles(10, 300, 460, 170),
      sp: 'sp_fairy', key: 'name_ok', vars: () => ({ name: endName }), sfx: 'sparkle' },
    { art: () => bg2() + P(princessFront('smile')) + F(fairy('smile')) + bigCauldron() + sparkles(8, 280, 450, 190),
      sp: 'sp_fairy', key: 'intro_start_q', end: true, sfx: 'sparkle' },
  ];

  // 지팡이 끝에서 튀는 마법 스파크 (톡 치는 지점)
  function tapSpark(cx, cy) {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * 45) * Math.PI / 180;
      rays += `<line x1="${(cx + Math.cos(a) * 9).toFixed(1)}" y1="${(cy + Math.sin(a) * 9).toFixed(1)}"
        x2="${(cx + Math.cos(a) * 20).toFixed(1)}" y2="${(cy + Math.sin(a) * 20).toFixed(1)}"
        stroke="#fff3b0" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    return `<g class="i-tapspark">
      <circle cx="${cx}" cy="${cy}" r="11" fill="#fff7e0" opacity="0.9"/>
      <circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="#ffe07a" stroke-width="3"/>
      ${rays}
      <path d="${star(cx + 16, cy - 12, 4)}" fill="#fff3b0"/>
      <path d="${star(cx - 14, cy + 10, 3.4)}" fill="#fff3b0"/>
    </g>`;
  }

  // 펑! 파열 이펙트 — cx,cy 중심으로 확산하는 링 + 방사선 + 파편
  function burst(cx, cy, scale) {
    const k = scale || 1;
    let rays = '', bits = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * 30) * Math.PI / 180;
      const r1 = 26 * k, r2 = 52 * k;
      rays += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}"
        x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"
        stroke="#fff3b0" stroke-width="${3 * k}" stroke-linecap="round"/>`;
    }
    for (let i = 0; i < 10; i++) {
      const a = (i * 36 + 12) * Math.PI / 180, r = (44 + (i % 3) * 12) * k;
      bits += `<path d="${star(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (3 + (i % 3)) * k)}" fill="#ffe6a8"/>`;
    }
    return `<g class="i-burst">
      <circle cx="${cx}" cy="${cy}" r="${30 * k}" fill="none" stroke="#fff" stroke-width="${5 * k}" opacity="0.95"/>
      <circle cx="${cx}" cy="${cy}" r="${16 * k}" fill="#fff7e0" opacity="0.9"/>
      <g class="i-burst-rays">${rays}</g>
      <g class="i-burst-bits">${bits}</g>
    </g>`;
  }

  // 텔레포트 연출 (빛기둥 + 바닥 마법진). gone=true 면 공주가 사라진 뒤
  function teleportFx(gone) {
    return `<g class="i-tele-fx">
      <path d="M96,120 L204,120 L232,470 L68,470 Z" fill="url(#iBeam)" opacity="${gone ? 0.45 : 0.7}"/>
      <ellipse cx="150" cy="470" rx="${gone ? 74 : 62}" ry="${gone ? 20 : 17}" fill="none" stroke="#e6c4ff" stroke-width="3" opacity="0.9"/>
      <ellipse cx="150" cy="470" rx="${gone ? 52 : 42}" ry="${gone ? 14 : 11}" fill="none" stroke="#fff3b0" stroke-width="2" opacity="0.8"/>
      <ellipse cx="150" cy="470" rx="${gone ? 30 : 24}" ry="${gone ? 8 : 6.5}" fill="#f2d9ff" opacity="0.5"/>
      <g class="i-rune" stroke="#e6c4ff" stroke-width="2" fill="none" opacity="0.85">
        <path d="M150,440 L178,470 L150,500 L122,470 Z"/>
        <path d="M126,456 L174,484 M174,456 L126,484"/>
      </g>
    </g>`;
  }


  // ─── 렌더 / 진행 ─────────────────────────────────────────────
  let idx = 0, onDone = null;
  let auto = true, autoTimer = null;   // 자동 재생 기본 켜짐
  let isReplay = false, prevTab = null;  // 다시보기 여부 / 재생 전 화면
  let artFlip = false;                   // 아트 크로스페이드 레이어 토글
  let sfxTimer = null;                   // 컷 안에서 지연 재생하는 효과음
  function clearSfx() { if (sfxTimer) { clearTimeout(sfxTimer); sfxTimer = null; } }
  let list = SCENES;                     // 현재 재생 목록 (본편 / 엔딩)

  // 대사 재생 배속 (1.25 = 1.25배 빠르게)
  const SPEED = 1.25;

  // 대사를 보이스로 읽는다고 가정한 표시 시간 (ms)
  // 한국어/영어 모두 자연스럽게: 기본 1.5초 + 글자수 비례, 최소 2.2초 ~ 최대 9초 (배속 적용)
  function readMs(text) {
    const t = String(text || '');
    const hasKo = /[가-힣]/.test(t);
    const perChar = hasKo ? 105 : 62;          // 한글은 글자당 정보량이 커서 길게
    const lines = (t.match(/\n/g) || []).length; // 줄바꿈마다 호흡
    const ms = 1500 + t.length * perChar + lines * 350;
    return Math.max(2200, Math.min(9000, ms)) / SPEED;
  }

  function paint() {
    const s = list[idx];
    const art = document.getElementById('introArt');
    const box = document.getElementById('introText');
    const name = document.getElementById('introSpeaker');
    if (!art || !box) return;

    const svgMarkup = `<svg viewBox="0 0 400 711" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" class="intro-svg">
      <defs>
        <linearGradient id="iWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e9d8bd"/><stop offset="1" stop-color="#cfae83"/>
        </linearGradient>
        <linearGradient id="iFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#bb8b5a"/><stop offset="1" stop-color="#96683c"/>
        </linearGradient>
        <linearGradient id="iSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2c2b52"/><stop offset="1" stop-color="#584a7a"/>
        </linearGradient>
        <!-- Scene #2: 어둡고 허름한 공방 -->
        <linearGradient id="iWall2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cbb99c"/><stop offset="1" stop-color="#9e8a70"/>
        </linearGradient>
        <linearGradient id="iFloor2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7a5a38"/><stop offset="1" stop-color="#5a4026"/>
        </linearGradient>
        <linearGradient id="iSky2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#20203c"/><stop offset="1" stop-color="#3b3358"/>
        </linearGradient>
        <radialGradient id="iVig" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.35" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(10,6,18,0.55)"/>
        </radialGradient>
        <radialGradient id="iBrew" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="#efb0f4"/><stop offset="0.5" stop-color="#b662d0"/><stop offset="1" stop-color="#5b2a74"/>
        </radialGradient>
        <linearGradient id="iBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(230,196,255,0.75)"/><stop offset="1" stop-color="rgba(230,196,255,0.05)"/>
        </linearGradient>
      </defs>
      ${s.art()}
    </svg>`;

    // 두 레이어를 번갈아 쓰며 크로스페이드 → 어두워졌다 밝아지는 끊김 제거
    let layers = art.querySelectorAll('.i-layer');
    if (layers.length < 2) {
      art.innerHTML = '<div class="i-layer"></div><div class="i-layer"></div>';
      layers = art.querySelectorAll('.i-layer');
    }
    const nextLayer = layers[artFlip ? 0 : 1];
    const currLayer = layers[artFlip ? 1 : 0];
    nextLayer.innerHTML = svgMarkup;
    nextLayer.classList.add('on');
    currLayer.classList.remove('on');
    artFlip = !artFlip;

    const sp = IT(s.sp);
    name.textContent = sp || '';
    name.style.display = sp ? '' : 'none';
    box.textContent = sceneText(s);

    // 진행 표시
    const dots = document.getElementById('introDots');
    if (dots) {
      dots.innerHTML = list.map((_, i) =>
        `<span class="i-dot ${i === idx ? 'on' : ''}"></span>`).join('');
    }
    // 장면 전환 플래시 (텔레포트 전/후)
    if (s.flash) {
      const fl = document.getElementById('introFlash');
      if (fl) { fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
    }

    // 대사만 부드럽게 전환 (무대 전체를 페이드하지 않음)
    const boxEl = document.getElementById('introBox');
    if (boxEl) { boxEl.classList.remove('i-in'); void boxEl.offsetWidth; boxEl.classList.add('i-in'); }

    // 컷 효과음 (설정에서 사운드 Off 면 Sfx 쪽에서 무시됨)
    clearSfx();
    if (window.Sfx) {
      if (s.sfx) Sfx.play(s.sfx);
      if (s.sfx2) sfxTimer = setTimeout(() => Sfx.play(s.sfx2[0]), s.sfx2[1]);
    }

    // 마지막 엔딩 컷: 자동 진행 없이 '시작하기' 버튼만 표시
    const foot = document.getElementById('introFoot');
    const startBtn = document.getElementById('introStart');
    if (startBtn) startBtn.style.display = s.end ? '' : 'none';
    if (s.end) {
      if (foot) foot.style.visibility = 'hidden';
      clearAuto();
      return;
    }

    // hold 씬: 자동 재생과 무관하게 지정 시간 뒤 자동 진행 (조작 UI 숨김)
    if (s.hold) {
      if (foot) foot.style.visibility = 'hidden';
      clearAuto();
      autoTimer = setTimeout(next, s.hold);
    } else {
      if (foot) foot.style.visibility = '';
      scheduleAuto(sceneText(s));
    }
  }

  // 컷 대사 (엔딩처럼 이름 같은 변수를 끼워 넣는 경우 포함)
  function sceneText(s) {
    return window.I18N ? I18N.t(s.key, s.vars ? s.vars() : undefined) : s.key;
  }

  // ─── 자동 재생 ───
  function clearAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
  function scheduleAuto(text) {
    clearAuto();
    if (!auto) return;
    autoTimer = setTimeout(() => { if (auto) next(); }, readMs(text));
  }
  function toggleAuto(el) {
    auto = !auto;
    const btn = document.getElementById('introAuto');
    if (btn) btn.classList.toggle('on', auto);
    if (auto) scheduleAuto(sceneText(list[idx]));
    else clearAuto();
    // 켬/끔 안내 토스트 (버튼 근처)
    if (typeof window.toast === 'function') {
      window.toast(IT(auto ? 'auto_on' : 'auto_off'), el || btn);
    }
  }

  function next() {
    clearAuto();
    if (idx < list.length - 1) { idx++; paint(); return; }
    // 본편이 끝났고 아직 이름이 없으면 → 이름 입력 → 엔딩 → 시작하기
    if (list === SCENES && needsName()) { askName(); return; }
    finish();
  }

  // 건너뛰기: 이름이 필요하면 마지막 컷으로 건너뛰고 이름 입력부터 진행
  function skip() {
    clearAuto(); clearSfx();
    if (list === SCENES && needsName()) {
      idx = SCENES.length - 1;
      paint();
      askName();
      return;
    }
    finish();
  }

  function needsName() {
    return !isReplay && typeof window.needsPlayerName === 'function' && window.needsPlayerName();
  }

  // 인트로 화면은 그대로 둔 채 이름 입력 팝업만 띄운다
  function askName() {
    clearAuto(); clearSfx();
    showControls(false);
    if (typeof window.askPlayerName === 'function') window.askPlayerName();
    else finish();
  }

  // 이름이 정해지면 요정 대모의 마무리 대사 재생
  function startEnding(playerName) {
    endName = playerName || '';
    list = ENDING;
    idx = 0;
    auto = true;
    // 엔딩에서는 하단 조작만 되살리고 '건너뛰기'는 계속 숨긴다
    const foot = document.getElementById('introFoot');
    if (foot) foot.style.visibility = '';
    paint();
  }

  // 건너뛰기 / 하단 조작 UI 표시 토글
  function showControls(show) {
    const sk = document.querySelector('#intro .i-skip');
    if (sk) sk.style.display = show ? '' : 'none';
    const foot = document.getElementById('introFoot');
    if (foot) foot.style.visibility = show ? '' : 'hidden';
  }

  function isPlaying() {
    const el = document.getElementById('intro');
    return !!el && el.style.display !== 'none' && !el.classList.contains('hide');
  }

  function finish() {
    clearAuto();
    clearSfx();
    auto = true;
    const el = document.getElementById('intro');
    if (!el) return;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    el.classList.add('hide');
    setTimeout(() => {
      el.style.display = 'none';     // 제거하지 않고 숨김 → 다시보기 가능
      el.classList.remove('hide');
      // 최초 진입이면 '마이 룸', 다시보기면 보던 화면으로 복귀
      if (typeof window.switchTab === 'function') {
        window.switchTab(isReplay && prevTab ? prevTab : 'showcase');
      }
      isReplay = false; prevTab = null;
      list = SCENES;                 // 다음 재생을 위해 본편으로 복귀
      showControls(true);
      const sb = document.getElementById('introStart');
      if (sb) sb.style.display = 'none';
      if (onDone) onDone();
    }, 600);
  }

  function hasSeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  // 최초 진입일 때만 시작. 이미 봤으면 false 반환.
  function start(cb, force) {
    onDone = cb;
    const el = document.getElementById('intro');
    if (!el) return false;
    if (hasSeen() && !force) { el.style.display = 'none'; return false; }
    // 다시보기면 재생 전 화면을 기억해 두었다가 끝나고 복귀
    isReplay = !!force;
    prevTab = (typeof window.currentTab === 'string') ? window.currentTab : null;
    el.classList.remove('hide');
    el.style.display = 'flex';
    idx = 0;
    list = SCENES;
    showControls(true);
    artFlip = false;
    const artEl = document.getElementById('introArt');
    if (artEl) artEl.innerHTML = '';    // 레이어 초기화 (재생 시 잔상 방지)
    auto = true;                       // 기본 켜짐
    const ab = document.getElementById('introAuto');
    if (ab) ab.classList.add('on');
    paint();
    return true;
  }

  // 인트로의 공주 그림을 밖에서도 쓸 수 있게 내보낸다.
  // 튜토리얼을 마치기 전의 마이 룸은 이 그림을 그대로 세운다 — 아직 연금술사가 되기
  // 전이라 바디 파츠로 조립한 아바타가 아니라 '방금 들어온 그 공주' 여야 한다.
  function princessArt(mood) { return princessFront(mood || 'smile'); }

  window.Intro = { start, next, skip, finish, startEnding, isPlaying, hasSeen, toggleAuto, princessArt, SEEN_KEY };
})();
