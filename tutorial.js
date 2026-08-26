// ═══════════════════════════════════════════════════════════════
//  튜토리얼 — 인트로 다음, 처음 한 번
// ═══════════════════════════════════════════════════════════════
// 화면을 반투명 검은 막으로 덮고 **눌러야 할 곳에만 구멍을 뚫는다.** 구멍은 그림이
// 아니라 진짜 구멍이다 — 막을 이루는 path 하나에 `fill-rule="evenodd"` 로 안쪽 사각형을
// 빼서, 칠해진 곳만 클릭을 먹고 구멍은 아래 버튼이 그대로 받는다. 막을 네 조각으로
// 잘라 붙이면 경계에서 클릭이 새고, 화면이 움직일 때마다 조각이 어긋난다.
//
// **좌표는 매번 다시 잰다.** 이 게임의 화면은 render() 가 통째로 다시 그리므로
// 요소를 붙들어 두면 다음 렌더에 문서에서 떨어져 나간다 (토스트에서 겪은 것과 같다).
// 그래서 대상은 요소가 아니라 **선택자**로 적고, 그릴 때마다 찾는다.
//
// **막다른 길을 만들지 않는다.** 구멍을 뚫을 대상을 못 찾으면 막이 클릭을 먹지 않는
// 상태(`.loose`)로 떨어진다 — 안내는 그대로 두되 아무 데나 누를 수 있게 열어 둔다.
// 여기서 못 누르면 게임을 시작조차 못 하는 자리라, 안내가 헛도는 편이 갇히는 것보다 낫다.
//
// 진행은 세이브에 들어간다 (`S.tut`). 중간에 창을 닫아도 그 자리에서 이어진다.
(function () {
  // 구멍 여백 / 모서리 — 버튼에 딱 맞추면 테두리가 잘려 보인다
  const PAD = 8, RAD = 14;
  // 졸업 선물 — 옷장을 여는 김에 갈아입을 옷 한 벌도 같이 준다.
  // 한 벌뿐이면 '갈아입기' 라는 말 자체가 성립하지 않는다 (공주 드레스는 이미 입고 있다)
  const GIFT_DRESS = 'dress_onepiece';

  const say = (sp, key, mood) => ({ sp: 'sp_' + sp, key, mood: mood || 'def' });

  // ─── 단계표 ───────────────────────────────────────────────
  // talk   : 말풍선 대사 (닷 개수가 곧 이 길이)
  // tab    : 그 구멍이 있는 화면. 단계에 들어설 때 그 화면으로 옮겨 놓는다 —
  //          새로고침하면 늘 마이 룸에서 다시 시작하므로, 이게 없으면 '솥에 넣으세요'
  //          라고 적힌 막이 마이 룸 위에 떠 있게 된다 (구멍도 못 찾는다)
  // hole   : 구멍을 뚫을 선택자 (여럿이면 배열)
  // act    : 마지막 대사까지 읽은 뒤 말풍선에 남는 **지시문**
  // wait   : 이 신호가 오면 다음 단계로 (배열이면 그중 아무거나)
  // until  : 신호가 와도 이것이 참이어야 넘어간다 (여러 번 해야 하는 단계)
  // skipIf : 참이면 이 단계를 통째로 건너뛴다 (이미 해 둔 상태로 들어온 경우)
  // before : 단계에 들어설 때 / after : 단계를 끝낼 때
  const STEPS = [
    // ── 0단계. 첫 재료 주머니 ──
    { id: 'gift',
      before: () => once('gift', () => { addInv('berry', 1); addInv('herb', 1); }),
      talk: [say('althea', 'tut_g1', 'warm'), say('gwiriel', 'tut_g2'), say('althea', 'tut_g3')] },

    // ── 1단계. 최초의 물약 ──
    { id: 'go_atelier', talk: [say('althea', 'tut_a1')],
      act: 'tut_act_atelier', hole: '.tab-btn[data-tab="atelier"]', wait: 'tab:atelier' },
    { id: 'pick_recipe', talk: [say('althea', 'tut_a2')],
      tab: 'atelier', act: 'tut_act_recipe', hole: '.recipe-row[data-recipe="vitality"]', wait: 'want:vitality' },
    { id: 'do_brew', talk: [say('gwiriel', 'tut_a3'), say('althea', 'tut_a4', 'wink')],
      tab: 'atelier', act: 'tut_act_brew', hole: '.cauldron-actions .btn-primary', wait: 'brew:ok' },

    // ── 2단계. 물약을 마신다 ──
    { id: 'go_room', talk: [say('gwiriel', 'tut_b1', 'smile'), say('althea', 'tut_b2')],
      act: 'tut_act_room', hole: '.tab-btn[data-tab="showcase"]', wait: 'tab:showcase' },
    { id: 'room_potions', talk: [say('althea', 'tut_b3')],
      tab: 'showcase', act: 'tut_act_shelf', hole: '.room-tab[data-rtab="stuff"]', wait: 'rtab:stuff' },
    { id: 'drink', talk: [say('althea', 'tut_b4', 'warm')],
      tab: 'showcase', act: 'tut_act_drink', hole: '.potion-card', wait: 'drink' },

    // ── 3단계. 채집 ──
    { id: 'go_gather',
      talk: [say('gwiriel', 'tut_c1', 'soft'), say('althea', 'tut_c2'), say('althea', 'tut_c3')],
      act: 'tut_act_gather_tab', hole: '.tab-btn[data-tab="gather"]', wait: 'tab:gather' },
    // 두 번 주워야 넘어간다 — 다음 단계에서 솥에 두 가지를 넣어야 하기 때문이다
    { id: 'gather', talk: [say('althea', 'tut_c4')],
      tab: 'gather', act: 'tut_act_gather', hole: '.spot-card[data-spot="p_hill"] .btn-gather',
      wait: 'gather', until: () => invTotal() >= 2 },

    // ── 4단계. 실패도 정보다 ──
    { id: 'back_atelier', talk: [say('althea', 'tut_c5')],
      act: 'tut_act_atelier', hole: '.tab-btn[data-tab="atelier"]', wait: 'tab:atelier' },
    { id: 'open_bag', talk: [say('althea', 'tut_d1')],
      tab: 'atelier', act: 'tut_act_bag', hole: '.bag-toggle', wait: 'bag:open',
      skipIf: () => typeof bagOpen !== 'undefined' && bagOpen },
    { id: 'put_two', talk: [say('althea', 'tut_d2')],
      // 새로고침으로 이 단계에 들어서면 가방이 다시 접혀 있다 (bagOpen 은 세이브에 없다).
      // 접힌 가방은 display:none 이라 뚫을 구멍이 사라진다 — 들어설 때 열어 둔다
      before: () => { if (typeof bagOpen !== 'undefined' && !bagOpen) toggleBag(); },
      tab: 'atelier', act: 'tut_act_put', hole: '#ingredientBag',
      wait: 'put', until: () => S.cauldron.length >= 2 },
    { id: 'brew_again', talk: [say('gwiriel', 'tut_d3')],
      tab: 'atelier', act: 'tut_act_brew', hole: '.cauldron-actions .btn-primary', wait: ['brew:ok', 'brew:fail'] },
    { id: 'fail_info',
      talk: [say('althea', 'tut_e1'), say('althea', 'tut_e2'),
             say('gwiriel', 'tut_e3', 'smile'), say('althea', 'tut_e4', 'warm')] },

    // ── 5단계. 위쪽 줄 (행동력 · 매력 총합) ──
    // 누를 것이 없는 단계다 — 구멍은 '여기를 보라' 는 뜻으로만 뚫는다
    { id: 'header', talk: [say('althea', 'tut_f1'), say('althea', 'tut_f2')],
      hole: ['.ap-wrap', '.header-charm'] },

    // ── 6단계. 졸업 — **여기서 tutorialDone 이 켜진다** ──
    { id: 'graduate', tab: 'showcase',
      talk: [say('althea', 'tut_h1', 'warm'), say('althea', 'tut_h2')],
      after: () => once('grad', graduate) },

    // ── 7단계. 갈아입기 ──
    // **졸업 뒤에 두는 이유**: 튜토리얼 전의 마이 룸에는 인트로의 공주 그림이 서 있어서
    // (roomFigure) 옷을 갈아입어도 화면이 하나도 안 변한다. 아바타가 된 다음이라야
    // 갈아입은 것이 눈에 보인다.
    { id: 'dress',
      before: () => {
        if (typeof setRoomTab === 'function') setRoomTab('clothes');
        if (typeof setWardrobeTab === 'function') setWardrobeTab('dress');
      },
      talk: [say('gwiriel', 'tut_h3', 'shock'), say('althea', 'tut_h4', 'warm'), say('althea', 'tut_h5')],
      tab: 'showcase', act: 'tut_act_dress', hole: '.wr-item[data-item="' + GIFT_DRESS + '"]',
      wait: 'equip:' + GIFT_DRESS },

    { id: 'outro',
      talk: [say('gwiriel', 'tut_i1', 'smile'), say('althea', 'tut_i2'), say('althea', 'tut_i3', 'warm')] },
  ];

  // 졸업 — 잠겨 있던 문을 연다 (3구 무쇠 솥 · 크리처 탭 · 옷장 열두 칸)
  function graduate() {
    S.tutorialDone = true;
    if (!Array.isArray(S.unlocked)) S.unlocked = [];
    if (!S.unlocked.includes(GIFT_DRESS)) S.unlocked.push(GIFT_DRESS);
    // 3구 무쇠 솥으로 바꿔 준다 — 열렸는데 2구에 그대로 두면 열린 줄 모른다
    const pot = D.CAULDRONS.find(c => c.needsTutorial);
    if (pot && typeof isCauldronOpen === 'function' && isCauldronOpen(pot)) {
      S.cauldronId = pot.id;
      if (S.record && !S.record.pots.includes(pot.id)) S.record.pots.push(pot.id);
    }
  }

  // ─── 상태 ─────────────────────────────────────────────────
  function state() {
    if (!S.tut || typeof S.tut !== 'object') S.tut = { step: 0, beat: 0, done: false, did: {} };
    if (!S.tut.did || typeof S.tut.did !== 'object') S.tut.did = {};
    S.tut.step = Math.max(0, S.tut.step | 0);
    S.tut.beat = Math.max(0, S.tut.beat | 0);
    return S.tut;
  }
  // 되돌아와도 한 번만 도는 효과. **표시를 세이브에 남긴다** —
  // 안 남기면 새로고침으로 같은 단계에 다시 들어설 때마다 재료가 또 들어온다
  function once(key, fn) {
    const s = state();
    if (s.did[key]) return;
    s.did[key] = true;
    fn();
  }
  function invTotal() {
    return Object.values(S.inventory || {}).reduce((n, v) => n + (v | 0), 0);
  }
  function step() { return STEPS[state().step] || null; }
  function running() { return !!S && !!S.tut && !S.tut.done && !!STEPS[S.tut.step | 0]; }
  // 지금 띄워도 되는 화면인가. 인트로·모달·미니게임 위에 겹치면 읽을 수 없는 자리에
  // 대사가 뜬다 (모달은 z-index 가 더 높아 막만 아래에 깔린 꼴이 된다)
  function showable() {
    // **인트로가 떠 있는지는 계산된 스타일로 본다.** Intro.isPlaying() 은 인라인
    // style 만 보기 때문에, 아직 한 번도 재생·정지된 적이 없는 첫 로드에서는
    // CSS 의 display:none 을 못 읽고 '재생 중' 이라고 답한다 — 그 한 번 때문에
    // 부팅 직후 튜토리얼이 통째로 안 뜬다 (실제로 그렇게 만들었다가 잡았다)
    const intro = document.getElementById('intro');
    if (intro && getComputedStyle(intro).display !== 'none') return false;
    if (document.querySelector('.modal.show')) return false;
    if (document.getElementById('pumpkinGame')) return false;
    return true;
  }

  function layer() { return document.getElementById('tut'); }

  let lastKey = '';    // 다시 그릴지 판단 (스크롤 때마다 HTML 을 새로 짜지 않는다)
  let busy = false;    // render() → refresh() → render() 되돌이 방지
  // **maybeStart() 를 지나기 전에는 아무것도 그리지 않는다.** refresh() 는 render() 가
  // 부르는 '자리 다시 재기' 일 뿐인데, 이것만으로 막이 떠 버리면 첫 실행에서
  // 인트로가 시작되기 전(0.9초)에 튜토리얼이 인트로 밑에 깔린다 — 그 상태로는
  // enter() 를 안 지나서 첫 재료 주머니도 안 온 채로 대사만 떠 있다
  let started = false;

  // 단계에 들어설 때: 건너뛸 것은 건너뛰고 before 를 돌린다.
  // **여기서 화면을 다시 그리지 않는다** — 부르는 쪽이 paint() 를 이어서 한다
  function enter() {
    const st = state();
    let guard = 0;
    while (st.step < STEPS.length && guard++ <= STEPS.length) {
      const s = STEPS[st.step];
      // 건너뛰기 판정은 **막 들어섰을 때만** 한다. 새로고침으로 대사 도중에
      // 돌아온 경우(beat > 0)까지 건너뛰면 읽던 대사가 통째로 날아간다
      if (st.beat === 0 && s.skipIf && s.skipIf()) { st.step++; continue; }
      // 그 구멍이 있는 화면으로 먼저 옮겨 놓는다 (새로고침하면 늘 마이 룸에서 시작한다)
      if (s.tab && window.currentTab !== s.tab && typeof switchTab === 'function') switchTab(s.tab);
      if (s.before) s.before();
      return;
    }
  }

  function advance() {
    const st = state();
    const s = step();
    busy = true;
    try {
      if (s && s.after) s.after();
      st.step++;
      st.beat = 0;
      enter();
      save();
      if (typeof render === 'function') render();
    } finally { busy = false; }
    if (!running()) { finish(); return; }
    lastKey = '';
    paint();
  }

  function finish() {
    const st = state();
    st.done = true;
    st.beat = 0;
    // **튜토리얼이 끝났는데 졸업이 안 되어 있으면 안 된다.** 이 문이 안 열리면
    // 3구 솥·크리처 탭·옷장 열두 칸이 영영 잠긴 채로 남는다 (원래 있던 버그다)
    if (!S.tutorialDone) graduate();
    save();
    hide();
    if (typeof render === 'function') render();
  }

  // 화면에서 감춘다. **추적 루프는 여기서 멈추지 않는다** — 모달이 떠서 잠깐 숨은
  // 것뿐일 수 있고, 그때 루프까지 멈추면 모달이 닫혀도 아무도 다시 그려 주지 않는다.
  // (닫을 때 render() 를 부르지 않는 모달이 있다 — 설정·확인 패널이 그렇다)
  function hide() {
    const el = layer();
    if (!el) return;
    el.classList.remove('on');
    el.setAttribute('aria-hidden', 'true');
    lastKey = '';
    lastD = '';
  }

  // ─── 그리기 ───────────────────────────────────────────────
  function paint() {
    const el = layer();
    if (!el) return;
    // 튜토리얼이 끝났으면 감추고 루프도 끝낸다
    if (!started || !running()) { hide(); stopTrack(); return; }
    // 모달·인트로가 떠 있는 동안은 감추되 **계속 지켜본다** — 닫히면 스스로 돌아온다
    if (!showable()) { hide(); startTrack(); return; }
    const s = step();
    const beat = Math.min(state().beat, s.talk.length - 1);
    const key = state().step + ':' + beat + ':' + (window.I18N ? I18N.getLang() : 'ko');
    if (key !== lastKey) {
      lastKey = key;
      el.innerHTML = html(s, beat);
      // **새 path 는 d 가 비어 있다.** 자리가 그대로여서 '안 바뀌었다' 고 건너뛰면
      // 막이 통째로 안 그려진다 — 같은 단계의 다음 대사로 넘어갈 때가 그 경우다
      lastD = '';
      bringIntoView(s);
    }
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    place(s);
    startTrack();
  }

  function html(s, beat) {
    const line = s.talk[beat];
    const sp = D.speaker(line.sp);
    const last = beat >= s.talk.length - 1;
    const dots = s.talk.map((_, i) => `<i class="tut-dot ${i <= beat ? 'on' : ''}"></i>`).join('');
    // 지시문은 **마지막 대사까지 읽은 뒤**에만 남긴다. 대사를 읽는 중에 같이 띄우면
    // 지금 무엇을 하라는 것인지 두 줄이 서로 다툰다
    const act = (last && s.act) ? `<div class="tut-act">${T(s.act)}</div>` : '';
    // 다음 화살표는 **누르면 넘어갈 때만** 보인다. 지시를 따라야 넘어가는 자리에
    // 화살표가 있으면 눌러서 건너뛸 수 있는 것처럼 보인다
    const more = (last && s.wait) ? ''
      : `<button class="tut-more" onclick="event.stopPropagation();Tut.tap()"
           aria-label="${T('tut_next')}">▾</button>`;
    return `
      <svg class="tut-mask" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path class="tut-hole" fill-rule="evenodd"></path>
      </svg>
      <div class="tut-arrow" aria-hidden="true">▾</div>
      <div class="tut-talk" onclick="Tut.tap()">
        <div class="tut-face">${window.Portrait
          ? Portrait.bust(Object.assign({}, sp, { name: speakerName(line.sp) }), line.mood, { bare: true })
          : ''}</div>
        <div class="tut-bubble">
          <div class="tut-name">${speakerName(line.sp)}</div>
          <div class="tut-line">${T(line.key)}</div>
          ${act}
          <div class="tut-foot"><div class="tut-dots">${dots}</div>${more}</div>
        </div>
      </div>`;
  }

  function holeSels(s) {
    if (!s.hole) return [];
    return Array.isArray(s.hole) ? s.hole : [s.hole];
  }
  // 구멍 대상의 실제 자리. 못 찾으면 빈 배열 — 그때는 막이 클릭을 먹지 않는다
  function holeRects(s) {
    const out = [];
    for (const sel of holeSels(s)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      out.push(r);
    }
    return out;
  }

  // 대상이 화면 밖이면 보이는 자리로 끌어온다 (레시피 줄은 한참 아래에 있다)
  function bringIntoView(s) {
    const sel = holeSels(s)[0];
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = document.documentElement.clientHeight;
    if (r.width >= 2 && r.top >= 72 && r.bottom <= h - 72) return;
    try { el.scrollIntoView({ block: 'center' }); } catch (e) { el.scrollIntoView(); }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r}`
      + ` V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h}`
      + ` H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r}`
      + ` V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  }

  let lastD = '';   // 같은 자리면 다시 쓰지 않는다 (매 프레임 도는 함수다)

  function place(s) {
    const el = layer();
    const svg = el.querySelector('.tut-mask');
    const path = el.querySelector('.tut-hole');
    const arrow = el.querySelector('.tut-arrow');
    const talk = el.querySelector('.tut-talk');
    if (!svg || !path || !arrow || !talk) return;
    // **좌표계는 이 층의 제 상자다.** documentElement.clientHeight 로 viewBox 를 잡으면
    // 그 값과 층의 실제 높이가 어긋나는 순간(주소창이 접히는 모바일, 스크롤바가 있는
    // 데스크톱) viewBox 가 그림을 통째로 늘려 구멍이 엉뚱한 데로 간다.
    // 화살표도 이 층 안의 absolute 라 같은 기준을 써야 한다.
    const box = el.getBoundingClientRect();
    const W = box.width, H = box.height;
    if (W < 1 || H < 1) return;      // 잴 수 없는 상태 (화면이 접혀 있다)
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const rects = holeRects(s).map(r => ({
      left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height,
      right: r.right - box.left, bottom: r.bottom - box.top,
    }));
    // 뚫을 자리를 못 찾았다 — 막지 않는다 (여기서 갇히면 게임을 시작할 수가 없다)
    el.classList.toggle('loose', !!s.hole && rects.length === 0);

    let d = `M0,0 H${W} V${H} H0 Z`;
    rects.forEach(r => {
      d += ' ' + roundRect(r.left - PAD, r.top - PAD, r.width + PAD * 2, r.height + PAD * 2, RAD);
    });
    if (d !== lastD) { lastD = d; path.setAttribute('d', d); }

    if (!rects.length) {
      arrow.style.display = 'none';
      talk.classList.remove('top');
      talk.classList.add('bot');
      return;
    }
    // 화살표는 구멍의 **빈 쪽**에 붙인다. 구멍이 화면 아래쪽이면 위에서 아래를 가리키고,
    // 위쪽이면 아래에서 위를 가리킨다 (하단 탭 바가 대상인 경우가 잦다)
    const r = rects[0];
    const below = (r.top + r.height / 2) > H * 0.5;
    arrow.style.display = '';
    arrow.textContent = below ? '▾' : '▴';
    arrow.style.left = Math.round(Math.max(24, Math.min(W - 24, r.left + r.width / 2))) + 'px';
    arrow.style.top = Math.round(below ? r.top - PAD - 32 : r.bottom + PAD + 6) + 'px';
    // 말풍선은 구멍의 반대쪽에 — 가리키는 곳을 자기가 덮으면 안 된다
    talk.classList.toggle('top', below);
    talk.classList.toggle('bot', !below);
  }

  // ─── 구멍은 **매 프레임 다시 잰다** ─────────────────────────
  //
  // 한 번 재고 마는 것으로는 못 맞춘다. 화면이 페이드 인 하는 동안 `.screen` 이
  // translateY(6px) 로 밀려 있어서, 그때 잰 구멍은 **끝까지 6px 어긋난 채로 남았다**
  // (스크롤·리사이즈가 없으면 다시 잴 계기가 아예 없다). 부드러운 스크롤·관성 스크롤·
  // 주소창 접힘·폰트 로딩 뒤의 리플로도 전부 같은 종류다.
  //
  // 매 프레임 도는 대신 **바뀐 것만 쓴다**(lastD) — 값이 그대로면 DOM 을 건드리지 않는다.
  let raf = 0;
  function track() {
    raf = 0;
    paint();   // paint() 가 보여 줄지 감출지 정하고 다음 프레임을 잇는다
  }
  function startTrack() { if (!raf) raf = requestAnimationFrame(track); }
  function stopTrack() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  // ─── 진행 ─────────────────────────────────────────────────
  // 말풍선을 누르면 다음 대사로. 마지막 대사면 다음 단계로.
  // (기다릴 신호가 있는 단계는 그 신호가 와야 넘어간다 — 눌러서 건너뛸 수 없다)
  function tap() {
    if (!running() || !showable()) return;
    const s = step();
    const st = state();
    if (st.beat < s.talk.length - 1) { st.beat++; save(); lastKey = ''; paint(); return; }
    if (s.wait) return;
    advance();
  }

  // 게임 쪽에서 보내는 신호 (game.js 곳곳에서 부른다)
  function fire(ev) {
    // enter() 안에서 화면을 옮기면 switchTab 이 이 신호를 다시 보낸다 —
    // 그 사이에 또 단계를 넘기면 한 번 누른 것으로 두 단계가 지나간다
    if (busy || !running()) return;
    const s = step();
    if (!s.wait) return;
    const list = Array.isArray(s.wait) ? s.wait : [s.wait];
    if (!list.includes(ev)) return;
    if (s.until && !s.until()) return;      // 아직 덜 됐다 (두 번 채집 등)
    advance();
  }

  // 화면이 다시 그려졌다 / 스크롤됐다 / 모달이 닫혔다 — 자리만 다시 잰다
  function refresh() {
    if (busy) return;
    busy = true;
    try { paint(); } finally { busy = false; }
  }

  // 인트로가 끝난 뒤 / 새로고침 뒤에 부른다
  function maybeStart() {
    if (!running()) { hide(); return; }
    // 인트로를 아직 안 봤으면 인트로가 끝나면서 이 함수를 다시 부른다
    if (window.Intro && !Intro.hasSeen()) return;
    started = true;
    enter();
    save();
    paint();
  }

  // 특정 단계로 감아 준다 (검사·개발용).
  // **지나치는 단계의 before/after 를 다 돌린다** — 그러지 않으면 졸업(after)이 빠져서
  // 옷장이 닫힌 채로 '새 원피스를 누르세요' 를 재게 된다. 그건 검사가 아니라 착시다.
  function goto(n, beat) {
    if (!S.tut || S.tut.done) S.tut = { step: 0, beat: 0, done: false, did: {} };
    started = true;
    const st = state();
    n = Math.max(0, Math.min(STEPS.length - 1, n | 0));
    if (st.step > n) { st.step = n; st.beat = 0; }
    enter();
    while (st.step < n) {
      const s = STEPS[st.step];
      if (s && s.after) s.after();
      st.step++; st.beat = 0;
      enter();
    }
    st.beat = Math.max(0, Math.min(STEPS[st.step].talk.length - 1, beat | 0));
    lastKey = '';
    save();
    if (typeof render === 'function') render();
    paint();
  }

  // 개발용(임시) — 튜토리얼을 처음부터 다시 본다
  function replay() {
    S.tut = { step: 0, beat: 0, done: false, did: {} };
    S.tutorialDone = false;
    lastKey = '';
    started = true;
    if (typeof switchTab === 'function') switchTab('showcase');
    enter();
    save();
    if (typeof render === 'function') render();
    paint();
  }

  // 창이 숨으면 rAF 가 멈춘다 — 돌아왔을 때 다시 깨운다
  document.addEventListener('visibilitychange', () => { if (!document.hidden && running()) refresh(); });

  // 검사용 — 지금 단계가 어디를 뚫으려 하는지 (checkui·checktut 이 구멍의 자리를 잰다)
  function targets() { const s = step(); return s ? holeSels(s) : []; }

  window.Tut = { maybeStart, refresh, fire, tap, replay, goto, targets,
                 isOn: running, steps: () => STEPS.length, PAD };
})();
