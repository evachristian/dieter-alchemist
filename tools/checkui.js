// a11y.js 의 checkUI() 를 헤드리스 크로미움에서 돌리는 하네스.
//
// 화면을 손댔으면 커밋 전에 이걸 돌린다. 브라우저 콘솔에서 `await checkUI()` 를
// 치는 것과 같은 검사이고, 결과도 같다 — 사람이 창을 열지 못하는 환경(클라우드 세션·CI)을
// 위한 것이다. 예전에는 "브라우저가 없으니 검증기를 못 돌린다" 며 그냥 넘기곤 했다.
//
// 사용:
//   npm start &                       # 서버가 떠 있어야 한다
//   node tools/checkui.js                       # 지금 화면만
//   node tools/checkui.js showcase atelier gather   # 탭을 옮겨 가며
//   BASE=https://... node tools/checkui.js showcase # 배포본을 상대로
//   W=265 node tools/checkui.js showcase         # 좁은 화면에서 (UI_POLICY '가변 폭')
//   FULL=1 node tools/checkui.js showcase atelier   # 가진 것을 채우고, 접힌 것까지 펼쳐서
//   TUT=1 node tools/checkui.js                  # 튜토리얼 화면(막·말풍선·지시문)만
//   VERBOSE=1 node tools/checkui.js              # 페이지 콘솔까지 같이 출력
//
// 종료 코드: 0 = 전부 pass, 1 = 통과 못한 화면 있음, 2 = 하네스 자체가 실패
const BASE = process.env.BASE || 'http://localhost:8080';
const TABS = process.argv.slice(2);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('playwright 가 없다. `npm i -D playwright` 로 설치하거나,');
  console.error('playwright 가 설치된 디렉터리에서 이 파일을 돌린다.');
  console.error('(저장소 의존성에는 넣지 않았다 — 게임 실행에는 필요 없는 검사 도구다)');
  process.exit(2);
}

// 클라우드 세션에는 크로미움이 미리 깔려 있다. 로컬이면 playwright 가 받아 둔 것을 쓴다.
function launchOpts() {
  const preinstalled = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  try {
    if (require('fs').existsSync(preinstalled)) return { executablePath: preinstalled };
  } catch (e) {}
  return {};
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  // 창 크기가 0 이면 검증기가 '잴 수 없다' 로 pass:false 를 낸다 — 실제 크기를 준다.
  // (폭 0 상태의 0건은 통과가 아니다 — CLAUDE.md 참고)
  // 폭은 W 로 바꿀 수 있다 — .app 이 max-width:480px 이라 그보다 넓으면 결과가 같다.
  // 좁은 화면(375·320·265)은 따로 돌려야 한다: 그때만 나오는 넘침이 있다.
  const ctx = await browser.newContext({
    viewport: { width: Number(process.env.W) || 1280, height: Number(process.env.H) || 900 },
  });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  // 첫 로드 전에 localStorage 를 심어 인트로를 건너뛰고 메인 화면부터 시작한다.
  // FULL 이면 튜토리얼까지 마친 상태로 — 크리처 탭 같은 것이 잠겨 있으면 잴 수 없다.
  // TUT 이면 **세이브를 아예 심지 않는다** — 진짜 새 플레이어라야 튜토리얼이 뜬다.
  await page.addInitScript((mode) => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    if (mode === 'tut') { localStorage.removeItem('dieter_alchemist_save_v1'); return; }
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      mode === 'full' ? { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true, crystal: 1240 }
                      : { ver: 5, name: 'Tester', nameClaimed: true }));
  }, process.env.TUT ? 'tut' : (process.env.FULL ? 'full' : 'plain'));

  await page.goto(BASE, { waitUntil: 'load' });
  // 스플래시가 스스로 사라지길 기다리되, 안 사라지면 직접 치운다
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash');
    if (s) s.classList.add('done');
    const i = document.getElementById('intro');
    if (i) i.style.display = 'none';
  });
  await page.waitForTimeout(300);

  // ─── FULL: '가진 것' 을 채우고 접힌 것을 펼친다 ───
  // **아무것도 없는 세이브는 검사망에 큰 구멍을 남긴다.** 재료·물약이 하나도 없으면
  // 가방 칸도 선반 칸도 아예 그려지지 않아 checkUI 가 볼 것이 없고, 접혀 있는 가방은
  // display:none 이라 또 빠진다. 실제로 이 구멍에 재료 개수 글자(1.4:1)와
  // 물약 카드의 '?'(10.6px)가 오래 숨어 있었다.
  if (process.env.FULL) {
    const seeded = await page.evaluate(() => {
      if (typeof devFillItems !== 'function') return '개발용 함수가 없다';
      devFillItems();                      // 재료 전부
      const pots = D.RECIPES.filter(r => r.result.kind === 'potion').slice(0, 3);
      const crs  = D.RECIPES.filter(r => r.result.kind === 'creature').slice(0, 2);
      pots.forEach((r, i) => { S.potions[r.result.id] = i + 1; });
      // ⚠️ **같은 크리처를 하나 더 넣는다.** 초과분(2번째부터)만 「녹일 수 있는 크리처」
      // 칩으로 공방 가방에 뜬다 — 한 마리씩만 심으면 그 칩을 **한 번도 안 재게 된다**
      // (재료가 없으면 가방 칸이 아예 안 그려지는 것과 같은 구멍이다)
      S.creatures = crs.map(r => r.result.id).concat(crs.length ? [crs[0].result.id] : []);
      if (typeof bagOpen !== 'undefined' && !bagOpen) toggleBag();   // 채집 가방 펼치기
      // 마을은 여는 조건이 아직 없다 — 개발용 스위치가 유일한 열쇠라 여기서 켜 준다.
      // 안 켜면 마을 안(지도·명판)이 통째로 검사에서 빠진다
      try { localStorage.setItem('dieter_alchemist_devvillage_v1', '1'); } catch (e) {}
      // 랭킹 탭은 '여신' 단계(매력 100)부터 나타난다 — 매력을 안 주면 그 화면이
      // 통째로 검사에서 빠진다. 지난 주 결과 배너도 같이 띄워 둔다 (그것도 화면이다)
      // 운동 — 근성을 **중간쯤**으로 잡아 잠긴 종목과 열린 종목이 같이 나오게 한다.
      // 음식도 몇 개 넣는다: 없으면 음식 칸이 아예 안 그려져 검사망에 구멍이 남는다
      S.aura = Object.assign({}, S.aura, { grit: 200 });
      // 「흡입」 뱃지는 안 본 밤이 있어야 뜬다. 없으면 hidden 이라 검사에서 빠진다
      S.binges = [{ food: 'food_cake', happy: 20, grit: 8, fit: 0.8 }];
      D.FOODS.slice(0, 3).forEach((f, i) => { S.foods[f.id] = i + 1; });
      S.stats.charm = Math.max(S.stats.charm || 0, D.LEAGUE.openAt + 40);
      S.league = 26;
      S.week = { key: weekKey(), score: 480 };
      S.leagueLast = { rank: 2, from: 25, to: 26, kind: 'up', key: weekKey() };
      // 개발용(임시) 블록도 펼친다. 접혀 있으면 display:none 이라 검사에서 통째로 빠지는데,
      // 그 안에도 화면에 뜨는 버튼이 들어 있다 (출시 전까지는 사람이 실제로 보는 자리다)
      ['gather', 'atelier', 'room'].forEach(name => {
        if (typeof toggleDevTools === 'function' && !devToolsOpen(name)) toggleDevTools(name);
      });
      save(); render();
      return null;
    });
    if (seeded) { console.error('FULL 준비 실패:', seeded); process.exit(2); }
    await page.waitForTimeout(250);
  }

  // ─── 잠긴 탭이 정말 안 보이는가 ───────────────────────────
  // **`hidden` 속성만으로는 안 숨는다.** 브라우저 기본 `[hidden]{display:none}` 은
  // 특정도가 낮아서 `.tab-btn{display:flex}` 같은 규칙에 진다 — 속성은 켜져 있는데
  // 화면에는 그대로 보인다. 실제로 랭킹 탭이 '새싹' 단계에서 보였다.
  // 그래서 속성이 아니라 **그려진 크기**로 본다.
  const gate = await page.evaluate((full) => {
    const btn = document.querySelector('.tab-btn[data-tab="league"]');
    if (!btn) return '랭킹 탭 버튼이 없다';
    const shown = btn.getBoundingClientRect().width > 0 && getComputedStyle(btn).display !== 'none';
    // FULL 이면 매력을 채웠으므로 보여야 하고, 아니면(매력 0) 안 보여야 한다
    if (full && !shown) return "매력을 채웠는데 랭킹 탭이 안 보인다";
    if (!full && shown) return "매력 0 인데 랭킹 탭이 보인다 (hidden 속성이 CSS 에 지고 있다)";
    return null;
  }, !!process.env.FULL);

  // ─── 시트 하나가 화면 안에 다 들어가는가 ──────────────────
  //
  // ⚠️ **`checkLayout()` 만으로는 시트 안의 넘침을 못 잡는다.** 그쪽은 정해진
  // 선택자(버튼·칩·카드…)만 재는데 시트 속의 줄들은 대개 그냥 `div` 라 대상이 아니고,
  // 목록은 `overflow-y:auto` 라 **가로 overflow 도 auto 로 계산돼** 넘침 검사에서 빠진다.
  // 실제로 `.farm-row` 를 일부러 `nowrap` 으로 만들어도 전부 통과로 나왔다.
  //
  // 그래서 시트는 **자기 상자보다 내용이 넓은 요소**를 직접 찾는다. 진짜로 옆으로
  // 스크롤되게 만든 곳(`overflow-x: auto/scroll`)만 빼고 본다.
  await page.evaluate(() => {
    window.__cardFits = (sel) => {
      const card = document.querySelector(sel + ' .modal-card');
      if (!card) return '시트 카드가 없다';
      const r = card.getBoundingClientRect();
      const W = document.documentElement.clientWidth, H = window.innerHeight;
      if (r.left < -0.5 || r.right > W + 0.5) {
        return `카드가 가로로 넘쳤다 (${Math.round(r.left)}..${Math.round(r.right)} / ${W})`;
      }
      if (r.top < -0.5 || r.bottom > H + 0.5) {
        return `카드가 세로로 넘쳤다 (${Math.round(r.top)}..${Math.round(r.bottom)} / ${H})`;
      }
      for (const el of [card, ...card.querySelectorAll('*')]) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.overflowX === 'auto' || st.overflowX === 'scroll') continue;
        const over = el.scrollWidth - el.clientWidth;
        if (over > 1) {
          const who = el.className || el.tagName.toLowerCase();
          return `${who} 안의 내용이 ${over}px 넘쳤다 (${el.clientWidth}px 칸에 ${el.scrollWidth}px)`;
        }
      }
      return null;
    };
  });

  const results = [];
  if (gate) results.push({ 화면: '(탭 잠금)', 오류: gate });
  const run = async (label) => {
    // checkUI 는 async 다 — 여기서 await 하지 않으면 Promise 가 잡혀 0건으로 보인다
    const r = await page.evaluate(() => window.checkUI());
    results.push({ 화면: label, ...r, report: undefined });
  };

  // ─── TUT: 튜토리얼 화면 ─────────────────────────────────────
  // **평소 검사에서 통째로 빠지는 화면이다.** 세이브가 없는 새 플레이어에게만 뜨는데,
  // 위의 준비 스크립트는 늘 세이브를 심어 인트로·튜토리얼을 건너뛰기 때문이다.
  // 대사만 있는 단계 · 구멍이 하나인 단계 · 구멍이 둘인 단계 · 지시문이 붙는 단계를
  // 골고루 잰다 (말풍선이 위로 가는 경우와 아래로 가는 경우가 여기서 갈린다).
  if (process.env.TUT) {
    const CASES = [
      { step: 0,  beat: 2, tab: 'showcase', label: '0 첫 주머니(구멍없음)' },
      { step: 1,  beat: 0, tab: 'showcase', label: '1 공방으로(탭 구멍)' },
      { step: 2,  beat: 0, tab: 'atelier',  label: '2 레시피 고르기' },
      { step: 6,  beat: 0, tab: 'showcase', label: '6 물약 마시기', pre: 'potion' },
      { step: 8,  beat: 0, tab: 'gather',   label: '8 채집' },
      { step: 13, beat: 3, tab: 'atelier',  label: '13 실패도 정보(긴 대사)' },
      { step: 14, beat: 1, tab: 'showcase', label: '14 위쪽 줄(구멍 둘)' },
      { step: 16, beat: 2, tab: 'showcase', label: '16 갈아입기' },
    ];
    for (const c of CASES) {
      const bad = await page.evaluate((c) => {
        if (!window.Tut) return 'tutorial.js 가 없다';
        // 물약 칸을 재려면 선반에 물약이 있어야 한다 (없으면 구멍 뚫을 카드가 없다)
        if (c.pre === 'potion') { S.potions.vitality = 1; roomTab = 'stuff'; }
        switchTab(c.tab);
        Tut.goto(c.step, c.beat);
        if (c.pre === 'potion') { setRoomTab('stuff'); setStuffTab('potions'); Tut.refresh(); }
        const el = document.getElementById('tut');
        if (!el.classList.contains('on')) return '튜토리얼 막이 안 떴다';
        // **loose = 구멍 뚫을 대상을 못 찾았다는 뜻이다.** 그 상태의 0건은 통과가 아니다 —
        // 막이 클릭을 막지도 않고, 화살표도 없는 화면을 잰 것이다
        if (el.classList.contains('loose')) return '구멍 대상을 못 찾았다 (loose)';
        return null;
      }, c);
      if (bad) { results.push({ 화면: `튜토리얼/${c.label}`, 오류: bad }); continue; }
      await page.waitForTimeout(220);
      await run(`튜토리얼/${c.label}`);
      // 말풍선이 자기가 가리키는 구멍을 덮으면 안 된다 (덮으면 무엇을 누르라는지 안 보인다)
      const over = await page.evaluate(() => {
        const talk = document.querySelector('#tut .tut-talk');
        const holes = [...document.querySelectorAll('#tut .tut-arrow')];
        if (!talk || !holes.length || holes[0].style.display === 'none') return null;
        const a = talk.getBoundingClientRect(), b = holes[0].getBoundingClientRect();
        return (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
          ? '말풍선이 화살표를 덮는다' : null;
      });
      if (over) results.push({ 화면: `튜토리얼/${c.label}`, 오류: over });
    }
  }

  if (process.env.TUT) {
    // 튜토리얼만 재고 끝낸다 (막이 덮인 채로 일반 화면을 재면 그건 다른 화면이다)
  } else if (!TABS.length) {
    await run('(현재)');
  } else {
    for (const t of TABS) {
      // 탭 이름이 틀리면 switchTab 은 모든 .screen 을 꺼 버린다. 그러면 잴 것이 없어
      // '위반 0건 · pass:true' 가 나온다 — 검사하지 않은 화면을 통과로 착각하게 된다.
      // 그래서 해당 화면이 실제로 켜졌는지까지 확인한다.
      const r = await page.evaluate((t) => {
        if (typeof window.switchTab !== 'function') return { 오류: 'switchTab 없음' };
        window.switchTab(t);
        const scr = document.getElementById('screen-' + t);
        if (!scr) return { 오류: `그런 화면이 없다 (#screen-${t})` };
        if (!scr.classList.contains('active')) return { 오류: `화면이 켜지지 않았다 (#screen-${t})` };
        return null;
      }, t);
      if (r) { results.push({ 화면: t, ...r }); continue; }
      await page.waitForTimeout(250);
      // 탐험도 갈래마다 내용이 통째로 다르다 — 안 보는 쪽은 display:none 이라
      // 통째로 검사에서 빠진다 (마을은 지금 전부 잠긴 화면이라 특히 빠지기 쉽다)
      if (process.env.FULL && t === 'gather') {
        for (const sub of ['field', 'village']) {
          const bad = await page.evaluate((s) => {
            setGatherTab(s);
            return gatherTab === s ? null : `갈래가 열리지 않았다 (${s})`;
          }, sub);
          if (bad) { results.push({ 화면: `${t}/${sub}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${sub}`);
        }
        // **채집 단서 토스트**도 평소에는 안 보인다 (opacity 0 · 화면 밖).
        // 흰 글자를 진한 바탕에 얹는 몇 안 되는 자리이고, **여러 줄로 꺾이는 유일한 토스트**다 —
        // 280px 로 두었을 때 한 문장이 다섯 줄이 됐던 자리라 폭을 실제로 재야 한다
        {
          const bad = await page.evaluate(() => {
            setGatherTab('field');
            const cr = (S.creatures || [])[0];
            if (!cr) return '가진 크리처가 없다';
            S.petField = cr;
            // 조각 중 **제일 긴 것**을 골라 띄운다. 짧은 것이 걸리면 안 재고 지나간다
            let longest = '';
            for (let i = 0; i < 4000; i++) {
              for (const k of ['pal', 'rare']) {
                const s = gatherClue('p_hill', k);
                if (s && s.length > longest.length) longest = s;
              }
            }
            if (!longest) return '단서가 한 번도 안 나왔다';
            const ing = D.INGREDIENTS[D.MAPS[0].pool[0]], bi = D.INGREDIENTS[D.MAPS[0].pool[1]];
            toast(T('got_item_pal', { emoji: ing.emoji, name: N(ing.id, ing.name),
              emoji2: bi.emoji, name2: N(bi.id, bi.name), clue: longest }),
              `.spot-card[data-spot="p_hill"] .btn-gather`, 60000, 'above');
            return document.getElementById('toast').classList.contains('show') ? null : '토스트가 안 떴다';
          });
          if (bad) results.push({ 화면: `${t}/채집단서`, 오류: bad });
          else { await page.waitForTimeout(300); await run(`${t}/채집단서`); }
          // 토스트가 화면 밖으로 나가면 무엇이 나왔는지 아예 못 본다.
          // **줄 수도 같이 잰다** — 넓은 창에서는 아무리 세로로 길어져도 안 넘쳐서
          // 「화면 밖인가」만 보면 통과한다. 폭을 90px 로 줄여도 잡히지 않았다.
          // 다섯 줄짜리 토스트가 원래 사고였으니 거기서 끊는다
          const bad2 = await page.evaluate(() => {
            const el = document.getElementById('toast');
            const r = el.getBoundingClientRect();
            const W = document.documentElement.clientWidth, H = window.innerHeight;
            if (r.left < -0.5 || r.right > W + 0.5) return `가로로 넘쳤다 (${Math.round(r.left)}..${Math.round(r.right)} / ${W})`;
            if (r.top < -0.5 || r.bottom > H + 0.5) return `세로로 넘쳤다 (${Math.round(r.top)}..${Math.round(r.bottom)} / ${H})`;
            const cs = getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight);
            const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
            const lines = Math.round(inner / lh);
            if (lines > 5) return `${lines}줄이다 (다섯 줄까지)`;
            return null;
          });
          if (bad2) results.push({ 화면: `${t}/채집단서`, 오류: bad2 });
          await page.evaluate(() => { document.getElementById('toast').classList.remove('show', 'multi', 'anchored'); S.petField = null; });
          await page.waitForTimeout(150);
        }
        // **동행 고르기 시트는 눌러야만 뜬다.** 안 열면 통째로 검사에서 빠지는데,
        // 크리처 그림 · 이름 · 속성 딱지가 한 줄에 같이 들어가는 자리라 폭이 제일 빡빡하다.
        // 한 줄 자체도 **동행이 있을 때와 없을 때 모양이 다르다** (없을 때는 흐린 글자
        // 하나뿐이라 위의 gather/field 가 이미 재고 있다) — 여기서는 있는 쪽을 잰다
        {
          const bad = await page.evaluate(() => {
            setGatherTab('field');
            const cr = (S.creatures || [])[0];
            if (!cr) return '가진 크리처가 없다 (FULL 준비가 덜 됐다)';
            setFieldPet(cr);
            return document.querySelector('#palRow .pal-art') ? null : '동행 한 줄이 안 그려졌다';
          });
          if (bad) results.push({ 화면: `${t}/동행있음`, 오류: bad });
          else { await page.waitForTimeout(250); await run(`${t}/동행있음`); }

          const bad2 = await page.evaluate(() => {
            openPalPick();
            const m = document.getElementById('palPick');
            if (!m || !m.classList.contains('show')) return '고르기 시트가 안 열렸다';
            // 「혼자 간다」 + 가진 크리처 **종류** 수만큼이어야 한다.
            // ⚠️ **개체 수가 아니라 종류다** — `S.creatures` 에는 중복이 들어갈 수 있고
            // (7단계에서 그 초과분이 재료가 된다) 고르기 목록은 중복을 접는다.
            // 개체 수로 견주고 있었는데, 중복이 하나도 없던 시절이라 우연히 맞았다
            const kinds = new Set(S.creatures || []).size;
            const n = document.querySelectorAll('#palPickList .pal-item').length;
            return n === kinds + 1 ? null : `고를 칸이 ${n}개다 (종류 ${kinds} + 1 이어야 한다)`;
          });
          if (bad2) results.push({ 화면: `${t}/동행고르기`, 오류: bad2 });
          else { await page.waitForTimeout(250); await run(`${t}/동행고르기`); }
          await page.evaluate(() => { closePalPick(); setFieldPet(null); });
          await page.waitForTimeout(150);
        }
        // **밭 탭** (FARM.md 2단계) — 여신 단계부터 보인다. FULL 이 매력을 채워 두므로
        // 여기서는 열려 있다. ⚠️ 서버에 밭이 없으면 「지금은 볼 수 없다」 한 줄만
        // 남으므로 **값을 심어 놓고** 잰다 (그 상태의 0건은 아무것도 안 잰 것이다)
        {
          const bad = await page.evaluate(async () => {
            if (!farmOpen()) return '매력을 채웠는데 밭이 안 열렸다';
            setGatherTab('farm');
            // ⚠️ **서버에 다녀오는 것을 먼저 끝낸다.** 탭에 들어서면 `pullFarm()` 이
            // 돌고, 이 검사 서버에는 이 플레이어의 밭이 없어서 잠시 뒤 `FARM = null`
            // 로 덮인다 — 먼저 심으면 심은 값이 그 뒤에 지워진다
            await pullFarm();
            const t = Date.now();
            FARM = {
              now: t, stash: { walnut: 12, wheat: 9, dew: 6, sun_seed: 4 }, count: 31,
              grownAt: t - 3600e3, nextGrowAt: t + 20 * 3600e3,
              shieldUntil: t + 5400e3, raids: 1, raidMax: 3, nextRaidAt: t + 3 * 3600e3,
              daily: { walnut: 3, wheat: 2 }, days: 5,
              def: { id: 'unicorn', attr: 'light', grade: 'high', power: 64, loyalty: 40 },
              atk: null,
              log: [
                { t: t - 60e3, by: 'Wwwwwwwwwwww', win: true, items: { walnut: 4, wheat: 3 } },
                { t: t - 3600e3, by: '도둑고양이', win: false, items: {} },
              ],
            };
            renderFarm();
            const n = document.querySelectorAll('#farmPanelBody .farm-logrow').length;
            return n === 2 ? null : `밭 탭에 침입 기록이 ${n}줄이다 (2줄이어야 한다)`;
          });
          if (bad) results.push({ 화면: `${t}/밭탭`, 오류: bad });
          else {
            await page.waitForTimeout(280);
            // **재기 직전에 아직 그대로인지 본다** — `pullFarm()` 이 끝나면서 심은 값을
            // 지우고 「지금은 볼 수 없다」로 바뀌어 있을 수 있다
            const gone = await page.evaluate(() =>
              document.querySelectorAll('#farmPanelBody .farm-logrow').length !== 2);
            if (gone) results.push({ 화면: `${t}/밭탭`, 오류: '재기 전에 화면이 비었다 (심은 값이 날아갔다)' });
            await run(`${t}/밭탭`);
          }
          // 탭 줄이 셋이 됐다 — **한 줄 안에 다 들어가는가** (265px 영어가 제일 빡빡하다)
          const bad2 = await page.evaluate(() => {
            const row = document.querySelector('.gt-tabs');
            const over = row.scrollWidth - row.clientWidth;
            if (over > 1) return `탭 줄이 ${over}px 넘쳤다 (${row.clientWidth}px 칸에 ${row.scrollWidth}px)`;
            const btns = [...row.querySelectorAll('.room-tab')].filter(b => !b.hidden);
            if (btns.length !== 3) return `보이는 탭이 ${btns.length}칸이다 (3칸이어야 한다)`;
            // 라벨이 칸 밖으로 나가지 않는가
            for (const b of btns) {
              if (b.scrollWidth - b.clientWidth > 1) {
                return `탭 라벨이 넘쳤다: "${b.textContent.trim()}" (${b.clientWidth}px 칸에 ${b.scrollWidth}px)`;
              }
            }
            return null;
          });
          if (bad2) results.push({ 화면: `${t}/밭탭`, 오류: bad2 });
          await page.evaluate(() => { FARM = null; setGatherTab('field'); });
          await page.waitForTimeout(150);
        }

        // 마을은 셋이고 **건물 수가 다르다.** 여덟인 마을과 넷인 마을을 다 본다 —
        // 그림 높이가 건물 수를 따라가므로 명판이 겹치는지는 여덟짜리로만 잡힌다
        for (const vid of ['vl_chimney', 'vl_mirror']) {
          const bad = await page.evaluate((id) => {
            setGatherTab('village');
            setVillage(id);
            return document.querySelector('.vil-map') ? null : `마을 지도가 안 떴다 (${id})`;
          }, vid);
          if (bad) { results.push({ 화면: `${t}/${vid}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${vid}`);
          // **명판끼리 겹치는지는 checkUI 가 못 본다.** 그것은 부모 밖으로 나가는 것이
          // 아니라 형제끼리 포개지는 것이라, 넘침 검사에 안 걸린다.
          // 이 화면은 앱에서 유일하게 절대 위치로 놓는 곳이라 여기서만 따로 본다.
          const over = await page.evaluate(() => {
            const r = [...document.querySelectorAll('.vil-pin, .vil-desc')].map(e => e.getBoundingClientRect());
            for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
              const a = r[i], b = r[j];
              if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
                return `띠 ${i + 1}번과 ${j + 1}번이 겹친다 (명판·마을 설명)`;
            }
            return null;
          });
          if (over) results.push({ 화면: `${t}/${vid}`, 오류: over });
          // **「일곱 굴뚝」은 지도에서 굴뚝이 일곱 개 세어져야 한다.**
          // 데이터의 건물 수는 checktalk 이 보지만, 굴뚝을 그렸는지는 그림을 봐야 안다
          if (vid === 'vl_chimney') {
            const n = await page.evaluate(() => document.querySelectorAll('.vil-svg .chim').length);
            if (n !== 7) results.push({ 화면: `${t}/${vid}`, 오류: `굴뚝이 ${n}개다 (일곱이어야 한다)` });
          }
        }
        // **건물 안(NPC 화면)**은 또 한 단 들어가야 나온다. 거래가 있는 자리와
        // 없는 자리를 다 본다 — 버튼이 하나일 때와 둘일 때 줄 모양이 다르다
        // **대화 중인 화면**은 대화를 시작해야 나온다 — 초상화·말풍선·닷이
        // 그때만 그려지므로 안 켜면 통째로 검사에서 빠진다
        {
          const bad = await page.evaluate(() => {
            setGatherTab('village');
            setVillage('vl_chimney');
            tapVillageSpot('vl_chimney', 'vs_chimney_forge');
            npcAct('talk', 'vs_chimney_forge');
            return document.querySelector('.npc-dots') ? null : '대화가 안 시작됐다';
          });
          if (bad) results.push({ 화면: `${t}/대화중`, 오류: bad });
          else {
            await page.waitForTimeout(250);
            await run(`${t}/대화중`);
            // 마지막 줄까지 넘겨 본다 (표정이 바뀌는 줄이 뒤에 있다)
            await page.evaluate(() => { talkNext('vs_chimney_forge'); talkNext('vs_chimney_forge'); });
            await page.waitForTimeout(250);
            await run(`${t}/대화끝`);
          }
          await page.evaluate(() => leaveSpot());
          await page.waitForTimeout(120);
        }
        for (const sid of ['vs_chimney_shop', 'vs_chimney_tower']) {
          const bad = await page.evaluate((id) => {
            setGatherTab('village');
            setVillage('vl_chimney');
            tapVillageSpot('vl_chimney', id);
            return document.querySelector('.npc-stage') ? null : `건물 안이 안 열렸다 (${id})`;
          }, sid);
          if (bad) { results.push({ 화면: `${t}/${sid}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${sid}`);
          // **오른쪽 끝은 언제나 「대화」여야 한다.** 거래가 없는 자리에서 대화가
          // 가운데로 옮겨 가면 손이 가는 곳이 화면마다 달라진다 (UI_POLICY 참고)
          const bad2 = await page.evaluate(() => {
            const acts = [...document.querySelectorAll('.npc-act')];
            if (!acts.length) return '버튼이 없다';
            const row = document.querySelector('.npc-acts').getBoundingClientRect();
            const last = acts[acts.length - 1];
            if (!last.classList.contains('main')) return '오른쪽 끝이 대화가 아니다';
            const r = last.getBoundingClientRect();
            if (Math.abs(r.right - (row.right - 12)) > 2) return '대화 버튼이 오른쪽 끝에 안 붙어 있다';
            return null;
          });
          if (bad2) results.push({ 화면: `${t}/${sid}`, 오류: bad2 });
          await page.evaluate(() => leaveSpot());
          await page.waitForTimeout(120);
          await page.waitForTimeout(150);
        }
        continue;
      }
      // **조합 결과 모달은 지금까지 한 번도 재 본 적이 없다.** 조합에 실패해야만 뜨는
      // 화면이라 평소 검사에서 통째로 빠진다 (접힌 블록·잠긴 탭과 같은 종류의 구멍이다).
      // 그래서 공방을 잰 뒤 **일부러 실패시켜** 모달까지 한 번 잰다.
      if (process.env.FULL && t === 'atelier') {
        await run(t);
        const bad = await page.evaluate(() => {
          // 어느 레시피도 아닌 조합을 만들어 실패시킨다 (성공하면 모달 모양이 달라진다)
          const two = Object.keys(D.INGREDIENTS).filter(id => !D.INGREDIENTS[id].rare);
          for (const a of two) for (const b of two) {
            if (a === b || D.RECIPE_MAP[D.recipeKey([a, b])]) continue;
            S.inventory[a] = (S.inventory[a] || 0) + 1;
            S.inventory[b] = (S.inventory[b] || 0) + 1;
            S.energy = 99999; S.cauldron = [a, b]; S.want = [];
            brew();
            return document.querySelector('#brewModal.show') ? null : '실패 모달이 안 떴다';
          }
          return '실패할 조합을 못 찾았다';
        });
        if (bad) { results.push({ 화면: `${t}/실패모달`, 오류: bad }); continue; }
        await page.waitForTimeout(250);
        await run(`${t}/실패모달`);
        await page.evaluate(() => closeBrewModal());
        await page.waitForTimeout(150);
        continue;
      }
      // 마이 룸은 하위 탭마다 내용이 통째로 다르다 — FULL 이면 셋을 다 돌아본다
      if (process.env.FULL && t === 'showcase') {
        // 스탯은 접었을 때와 펼쳤을 때가 **다른 화면**이다 — 접으면 카드도 테두리도 없이
        // 글자가 앱 배경 위에 바로 앉는다. 한쪽만 재면 다른 쪽은 통째로 검사에서 빠진다
        for (const lite of [false, true]) {
          const bad = await page.evaluate((want) => {
            if (typeof toggleStats !== 'function') return 'toggleStats 가 없다';
            const box = document.getElementById('roomStats');
            if (box.classList.contains('lite') !== want) toggleStats();
            return box.classList.contains('lite') === want ? null : '스탯 접힘이 안 바뀐다';
          }, lite);
          if (bad) { results.push({ 화면: `${t}/스탯${lite ? '접음' : '펼침'}`, 오류: bad }); continue; }
          await page.waitForTimeout(200);
          await run(`${t}/스탯${lite ? '접음' : '펼침'}`);
        }
        // 아래 하위 탭 검사는 펼친 상태로 본다 (원래 모습)
        await page.evaluate(() => {
          const box = document.getElementById('roomStats');
          if (box.classList.contains('lite')) toggleStats();
        });
        // 잡화는 그 안에 또 하위 탭이 둘이다 (물약 / 음식) — 둘 다 재야 한다.
        // 한쪽만 재면 다른 쪽 목록이 통째로 검사에서 빠진다
        const SUBS = [['clothes'], ['stuff', 'potions'], ['stuff', 'foods'], ['stuff', 'feeds'], ['creatures']];
        for (const [sub, inner] of SUBS) {
          const bad = await page.evaluate(([s, i]) => {
            setRoomTab(s);
            if (i) setStuffTab(i);
            return roomTab === s ? null : `하위 탭이 열리지 않았다 (${s})`;
          }, [sub, inner]);
          const name = inner ? `${sub}/${inner}` : sub;
          if (bad) { results.push({ 화면: `${t}/${name}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${name}`);
        }
        // **먹이주기 팝업** — 눌러야만 뜬다. 크리처 줄 · 먹이 줄 · 수량 · 버튼이
        // 한 화면에 다 들어가는 자리라 265px 영어가 제일 빡빡하다
        const feedBad = await page.evaluate(() => {
          const cr = (S.creatures || [])[0];
          if (!cr) return '가진 크리처가 없다';
          // 먹이를 넣어 둔다 — 없으면 「먹이가 없어요」 한 줄만 뜨고 목록이 통째로 빠진다
          D.FEEDS.forEach((f, i) => { S.feeds[f.id] = (i + 1) * 3; });
          setRoomTab('creatures');
          openFeed(cr);
          if (!document.getElementById('feedPick').classList.contains('show')) return '팝업이 안 떴다';
          const n = document.querySelectorAll('.feed-item').length;
          return n === D.FEEDS.length ? null : `먹이 칸이 ${n}개다 (${D.FEEDS.length} 이어야 한다)`;
        });
        if (feedBad) results.push({ 화면: `${t}/먹이주기`, 오류: feedBad });
        else { await page.waitForTimeout(280); await run(`${t}/먹이주기`); }
        // 팝업이 화면 밖으로 나가면 「먹이기」 버튼을 못 누른다
        const feedBad2 = await page.evaluate(() => {
          const c = document.querySelector('#feedPick .modal-card');
          if (!c) return '팝업 카드가 없다';
          const r = c.getBoundingClientRect();
          const W = document.documentElement.clientWidth, H = window.innerHeight;
          if (r.left < -0.5 || r.right > W + 0.5) return `가로로 넘쳤다 (${Math.round(r.left)}..${Math.round(r.right)} / ${W})`;
          if (r.top < -0.5 || r.bottom > H + 0.5) return `세로로 넘쳤다 (${Math.round(r.top)}..${Math.round(r.bottom)} / ${H})`;
          return null;
        });
        if (feedBad2) results.push({ 화면: `${t}/먹이주기`, 오류: feedBad2 });
        await page.evaluate(() => closeFeed());
        await page.waitForTimeout(150);

        // **생산 기록 시트** (8단계) — 눌러야만 뜬다.
        // ⚠️ 기록을 심어 놓고 열어야 한다. 비어 있으면 「아직 없어요」 한 줄만 떠서
        // **날짜 + 재료 여러 개가 든 줄을 한 번도 못 잰다** — 그 줄이 제일 긴 줄이다
        // (하루에 두 크리처가 서로 다른 것을 만들면 덩어리가 둘이 된다)
        const pdBad = await page.evaluate(() => {
          const a = D.RECIPES.find(r => r.result.kind === 'creature' && r.result.attr === 'fire');
          const b = D.RECIPES.find(r => r.result.kind === 'creature' && r.result.attr === 'water'
            && r.result.grade === 'high');
          if (!a || !b) return '속성 크리처를 못 찾았다';
          S.creatures = [...new Set([...(S.creatures || []), a.result.id, b.result.id])];
          S.petRoom = a.result.id; S.petField = b.result.id;
          S.produced = []; S.producedDay = dayKey() - 5;
          settleProduce();
          openProduceLog();
          if (!document.getElementById('produceLog').classList.contains('show')) return '시트가 안 떴다';
          const n = document.querySelectorAll('#produceList .pd-row').length;
          return n === PRODUCE_DAYS ? null : `기록이 ${n}줄이다 (${PRODUCE_DAYS}줄이어야 한다)`;
        });
        if (pdBad) results.push({ 화면: `${t}/생산기록`, 오류: pdBad });
        else { await page.waitForTimeout(280); await run(`${t}/생산기록`); }
        const pdBad2 = await page.evaluate(() => {
          const c = document.querySelector('#produceLog .modal-card');
          if (!c) return '시트 카드가 없다';
          const r = c.getBoundingClientRect();
          const W = document.documentElement.clientWidth, H = window.innerHeight;
          if (r.left < -0.5 || r.right > W + 0.5) return `가로로 넘쳤다 (${Math.round(r.left)}..${Math.round(r.right)} / ${W})`;
          if (r.top < -0.5 || r.bottom > H + 0.5) return `세로로 넘쳤다 (${Math.round(r.top)}..${Math.round(r.bottom)} / ${H})`;
          return null;
        });
        if (pdBad2) results.push({ 화면: `${t}/생산기록`, 오류: pdBad2 });
        await page.evaluate(() => closeProduceLog());
        await page.waitForTimeout(150);

        // **밭 · 이웃 밭** (9단계) — 눌러야만 뜨고, 게다가 **서버가 있어야 뜬다.**
        // 여기서는 서버를 띄우지 않고 값만 심어 **화면만** 잰다 —
        // 실제로 거두고 털리는지는 `npm run test:farm` 이 진짜 서버로 본다.
        //
        // ⚠️ **제일 빡빡한 값을 심는다.** 이삭 한 가지 · 침입 기록 한 줄로 재면
        // 아무 데서도 안 걸린다: 여러 종류가 든 이삭 줄과 **이름이 제일 긴 사람**이
        // 가져간 기록 줄이 이 시트에서 제일 긴 줄이다 (영어 이름은 12자까지다)
        const fmBad = await page.evaluate(() => {
          const LONG = 'Wwwwwwwwwwww';                 // 이름 최대 폭 (NAME_MAX_W = 12)
          const t = Date.now();
          FARM = {
            now: t, stash: { walnut: 12, wheat: 9, dew: 6, sun_seed: 4 }, count: 31,
            grownAt: t - 3600e3, nextGrowAt: t + 20 * 3600e3,
            shieldUntil: t + 5400e3, raids: 1, raidMax: 3, nextRaidAt: t + 3 * 3600e3,
            daily: { walnut: 3, wheat: 2 }, days: 5,
            def: { id: 'unicorn', attr: 'light', grade: 'high', power: 64, loyalty: 40 },
            atk: { id: 'ember_phoenix', attr: 'fire', grade: 'high', power: 64, loyalty: 0 },
            log: [
              { t: t - 60e3, by: LONG, win: true, items: { walnut: 4, wheat: 3 } },
              { t: t - 3600e3, by: '도둑고양이', win: false, items: {} },
            ],
          };
          // ⚠️ **`openFarm()` 을 쓰지 않는다.** 그건 서버에서 밭을 다시 받아 오는데,
          // 여기는 서버에 밭이 없어서 잠시 뒤 `FARM = null` 로 덮이고 화면이
          // 「지금은 볼 수 없다」 한 줄로 바뀐다 — 그 상태를 재면 **아무것도 안 잰 것**이
          // 통과로 나온다 (예전 78건 유령과 같은 종류의 실수다). 시트만 직접 연다
          document.getElementById('farmSheet').classList.add('show');
          renderFarm();
          const n = document.querySelectorAll('#farmBody .farm-logrow').length;
          return n === 2 ? null : `침입 기록이 ${n}줄이다 (2줄이어야 한다)`;
        });
        if (fmBad) results.push({ 화면: `${t}/밭`, 오류: fmBad });
        else {
          await page.waitForTimeout(280);
          // **재기 직전에 다시 확인한다** — 기다리는 사이에 값이 날아갔으면 잰 것이 없다
          const gone = await page.evaluate(() =>
            document.querySelectorAll('#farmBody .farm-logrow').length !== 2);
          if (gone) results.push({ 화면: `${t}/밭`, 오류: '재기 전에 화면이 비었다 (심은 값이 날아갔다)' });
          await run(`${t}/밭`);
        }
        const fmBad2 = await page.evaluate(() => window.__cardFits('#farmSheet'));
        if (fmBad2) results.push({ 화면: `${t}/밭`, 오류: fmBad2 });
        await page.evaluate(() => { closeFarm(); FARM = null; });
        await page.waitForTimeout(150);

        // 이웃 밭 — **상성 딱지 세 가지가 다 나오게** 심는다.
        // 하나만 재면 나머지 둘의 대비를 한 번도 안 본다 (배경색이 셋 다 다르다)
        const rdBad = await page.evaluate(() => {
          const D2 = window.GameData;
          const b = (id, attr) => ({ id, attr, grade: 'high', power: 64, loyalty: 0 });
          S.petField = 'ember_phoenix';                                  // 불
          if (!S.creatures.includes('ember_phoenix')) S.creatures.push('ember_phoenix');
          RAIDS = [
            { name: 'Wwwwwwwwwwww', charm: 999, count: 15,
              stash: { walnut: 9, wheat: 6 }, def: b('boulder_bear', 'earth') },   // 불 > 땅 = 유리
            { name: '물의수호자', charm: 300, count: 4,
              stash: { dew: 4 }, def: b('deepsea_whale', 'water') },               // 물 > 불 = 불리
            { name: '밭주인', charm: 220, count: 9,
              stash: { firefly: 9 }, def: b('unicorn', 'light') },                 // 보통
            { name: '빈터', charm: 10, count: 2, stash: { sun_seed: 2 }, def: null }, // 지키개 없음
          ];
          const el = document.getElementById('raidPick');
          el.classList.add('show');
          document.getElementById('raidTitle').textContent = I18N.t('raid_title');
          renderRaidList();
          const tags = [...document.querySelectorAll('#raidList .raid-tag')].map(x => x.className);
          const kinds = new Set(tags.map(c => c.replace('raid-tag ', '')));
          return kinds.size === 3 ? null : `상성 딱지가 ${[...kinds].join('/')} 뿐이다 (셋 다 나와야 한다)`;
        });
        if (rdBad) results.push({ 화면: `${t}/이웃밭`, 오류: rdBad });
        else {
          await page.waitForTimeout(280);
          const gone = await page.evaluate(() =>
            document.querySelectorAll('#raidList .raid-item').length !== 4);
          if (gone) results.push({ 화면: `${t}/이웃밭`, 오류: '재기 전에 목록이 비었다' });
          await run(`${t}/이웃밭`);
        }
        const rdBad2 = await page.evaluate(() => window.__cardFits('#raidPick'));
        if (rdBad2) results.push({ 화면: `${t}/이웃밭`, 오류: rdBad2 });
        await page.evaluate(() => { closeRaidPick(); FARM = null; RAIDS = null; });
        await page.waitForTimeout(150);

        // 방에 **어항이 선 모습**도 잰다. FULL 이 심는 두 마리는 땅·공중이라
        // 물고기를 따로 넣지 않으면 어항이 통째로 검사에서 빠진다 —
        // 방 그림 위에 얹히는 유일한 큰 소품이라 넘치는지 한 번은 봐야 한다
        const fishBad = await page.evaluate(() => {
          const f = D.RECIPES.find(r => r.result.kind === 'creature' && r.result.move === 'water');
          if (!f) return '물(water) 크리처가 없다';
          if (!S.creatures.includes(f.result.id)) S.creatures.push(f.result.id);
          setRoomTab('creatures');
          setRoomPet(f.result.id);
          const el = document.querySelector('.stage-creature.cr-water');
          if (!el) return '어항이 안 그려졌다';
          // 방 그림(.room-scene) 밖으로 나가면 안 된다.
          // ⚠️ **`.char-aura` 로 재면 안 된다.** 그것은 아바타를 담는 240px 상자이고,
          // 그 안에서 아바타가 179px 을 쓴다 — 96px 어항을 아우라 안에 가두면
          // **반드시 치마와 겹친다** (실제로 롱스커트와 47px 겹쳤다).
          // 어항이 설 자리는 아바타 옆의 **방 바닥**이고, 그 넓이를 아는 것은 방 그림이다.
          const r = el.getBoundingClientRect(), a = document.querySelector('.room-scene').getBoundingClientRect();
          if (r.left < a.left - 0.5 || r.right > a.right + 0.5 || r.bottom > a.bottom + 0.5) {
            return `어항이 방 밖으로 나갔다 (${Math.round(r.left)}..${Math.round(r.right)} / ${Math.round(a.left)}..${Math.round(a.right)})`;
          }
          return null;
        });
        if (fishBad) results.push({ 화면: `${t}/어항`, 오류: fishBad });
        else { await page.waitForTimeout(300); await run(`${t}/어항`); }

        // 운동 팝업 — 잠긴 종목·잠긴 시간이 **둘 다 있는** 상태로 잰다.
        // 전부 열려 있으면 잠금 표현이 검사에서 빠지고, 전부 잠겨 있으면
        // 고른 칸의 대비를 못 잰다 (FULL 준비에서 근성을 그 사이 값으로 잡아 뒀다)
        const exBad = await page.evaluate(() => {
          if (typeof openExercise !== 'function') return 'openExercise 가 없다';
          openExercise();
          return document.querySelector('.ex-item') ? null : '운동 팝업이 안 떴다';
        });
        if (exBad) results.push({ 화면: `${t}/운동`, 오류: exBad });
        else { await page.waitForTimeout(250); await run(`${t}/운동`); }
        await page.evaluate(() => closeConfirm());
        await page.waitForTimeout(150);

        // 「혼자 먹은 밤」 컷씬 — **평소에는 display:none 이라 검사에서 통째로 빠진다.**
        // 어두운 바탕에 흰 글자를 얹는 유일한 화면이라 반드시 재야 한다
        // **다섯 밤을 심는다.** 잔소리 장면(요정 대모)이 다섯 번째를 다 보고 나야 뜨는데,
        // 두 밤만 심으면 그 화면이 통째로 검사에서 빠진다 — 어두운 바탕에 금색 이름
        // (`.bs-who`)을 얹는 유일한 자리다
        const bsBad = await page.evaluate(() => {
          if (typeof playBinge !== 'function') return 'playBinge 가 없다';
          S.binges = ['food_cake', 'food_meat', 'food_bread', 'food_salad', 'food_porridge']
            .map(food => ({ food, happy: 20, grit: 8, fit: 0.8 }));
          render();                      // 뱃지도 같이 재려면 먼저 그려야 한다
          playBinge();
          return document.getElementById('bingeScene').classList.contains('show')
            ? null : '컷씬이 안 떴다';
        });
        if (bsBad) results.push({ 화면: `${t}/혼자먹은밤`, 오류: bsBad });
        else { await page.waitForTimeout(250); await run(`${t}/혼자먹은밤`); }

        // 다섯 밤을 다 보고 난 뒤의 잔소리 장면
        const scoldBad = await page.evaluate(() => {
          for (let i = 0; i < 5 && (S.binges || []).length; i++) bingeNext();
          const who = document.getElementById('bsWho');
          if (!document.getElementById('bingeScene').classList.contains('show')) {
            return '다섯 밤을 다 봤는데 잔소리 장면이 안 떴다 (그냥 닫혔다)';
          }
          return who && !who.hidden ? null : '말하는 사람(요정 대모) 줄이 안 뜬다';
        });
        if (scoldBad) results.push({ 화면: `${t}/잔소리`, 오류: scoldBad });
        else { await page.waitForTimeout(250); await run(`${t}/잔소리`); }

        await page.evaluate(() => { closeBingeScene(); S.binges = []; render(); });
        await page.waitForTimeout(200);
        // **볼 것이 없을 때의 「흡입」 버튼도 잰다.** FULL 은 뱃지가 뜨도록 밤을 심어 두므로,
        // 여기서 비우지 않으면 **0 일 때의 모습이 한 번도 검사받지 않는다** —
        // 실제로 그 구멍에 「빨간 0 뱃지」가 숨어 있었다 (hidden 인데 display:flex 라 그려졌다)
        await run(`${t}/흡입뱃지없음`);
        continue;
      }
      await run(t);
    }
  }

  // ─── 스탯을 접었을 때 방 배경이 그 자리를 덮는가 (FULL) ───────
  //
  // 접으면 스탯은 테두리 없는 글자 한 줄이라 방 그림을 아래로 늘여 받아 준다.
  // 그림은 `preserveAspectRatio="…slice"` 라 **상자만 늘이면 확대율이 올라가
  // 좌우가 잘린다** — 창문과 선반이 화면 밖으로 나간다. 그래서 늘일 픽셀을
  // viewBox 단위로 환산해 바닥을 진짜로 더 그린다 (game.js 의 roomPadBottom).
  //
  // 눈으로는 잘 안 보이는 실수다: 상자 높이로 되짚어 계산하면 **폭이 넓은 화면에서만**
  // 그림이 40px 쯤 아래로 미끄러진다 (실제로 한 번 그렇게 짰다). 그래서 확대율·좌우
  // 잘림·그림의 세로 위치 셋을 접기 전후로 견준다.
  if (process.env.FULL) {
    const geom = () => page.evaluate(() => {
      const svg = document.querySelector('.room-svg');
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      const H = Number(svg.getAttribute('viewBox').split(' ')[3]);
      const scale = Math.max(r.width / 400, r.height / H);
      const stats = document.getElementById('roomStats').getBoundingClientRect();
      const inv = document.querySelector('.room-inv').getBoundingClientRect();
      return {
        scale, unitsW: r.width / scale,
        // 상자 위에서 '원래 바닥 끝(viewBox y=320)' 까지 — 그림이 위아래로 밀렸는지
        floorY: r.height - (H - 320) * scale,
        // 스탯 글자를 덮었는가 / 인벤토리 카드를 침범하지 않았는가 (상자 바닥 기준)
        overStats: r.bottom - stats.bottom, underInv: inv.top - r.bottom,
      };
    });
    const setLite = (w) => page.evaluate((want) => {
      if (typeof toggleStats !== 'function') return null;
      const box = document.getElementById('roomStats');
      if (box.classList.contains('lite') !== want) toggleStats();
      return box.classList.contains('lite');
    }, w);

    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('showcase'); });
    await page.waitForTimeout(250);
    if (await setLite(false) === null) {
      results.push({ 화면: '방 배경 늘이기', 오류: 'toggleStats 가 없다' });
    } else {
      await page.waitForTimeout(150);
      const open = await geom();
      await setLite(true);
      await page.waitForTimeout(150);
      const lite = await geom();
      const bad = [];
      if (!open || !lite) bad.push('방 그림을 못 찾았다');
      else {
        if (Math.abs(open.scale - lite.scale) > 0.005) bad.push(`확대율이 달라졌다 ${open.scale.toFixed(3)} → ${lite.scale.toFixed(3)}`);
        if (Math.abs(open.unitsW - lite.unitsW) > 1) bad.push(`좌우 잘림이 달라졌다 ${open.unitsW.toFixed(1)} → ${lite.unitsW.toFixed(1)} 단위`);
        if (Math.abs(open.floorY - lite.floorY) > 1.5) bad.push(`그림이 ${(lite.floorY - open.floorY).toFixed(1)}px 밀렸다`);
        if (lite.overStats < 0) bad.push(`스탯 글자를 ${(-lite.overStats).toFixed(1)}px 못 덮었다`);
        if (lite.underInv < 0) bad.push(`인벤토리 카드를 ${(-lite.underInv).toFixed(1)}px 침범했다`);
      }
      results.push(bad.length
        ? { 화면: '방 배경 늘이기', 오류: bad.join(' · ') }
        : { 화면: '방 배경 늘이기', pass: true, total: 0, blocked: false });
    }
  }

  // ─── 화면 설정이 이 기기에 남는가 (FULL, 맨 마지막) ───────────
  //
  // 스탯 접힘은 **세이브가 아니라 이 기기의 localStorage** 에 있다.
  // 그래서 「새로고침해도 그대로인가」는 checkUI 로는 안 잡힌다 — 한 번 껐다 켜 봐야 안다.
  // **양쪽 방향을 다 본다.** 접힘만 확인하면, 「값이 있으면 무조건 접힘」 같은 구현이
  // 통과해 버린다 (펼침을 저장하는 쪽이 조용히 깨진다).
  //
  // 새로고침을 하면 페이지 상태가 초기화되므로 **모든 측정이 끝난 뒤**에 돈다.
  if (process.env.FULL) {
    const reload = async () => {
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForTimeout(2200);
      await page.evaluate(() => {
        const s = document.getElementById('splash'); if (s) s.classList.add('done');
        const i = document.getElementById('intro'); if (i) i.style.display = 'none';
        if (typeof switchTab === 'function') switchTab('showcase');
      });
      await page.waitForTimeout(250);
    };
    const setLite = (want) => page.evaluate((w) => {
      if (typeof toggleStats !== 'function') return null;
      const box = document.getElementById('roomStats');
      if (box.classList.contains('lite') !== w) toggleStats();
      return box.classList.contains('lite');
    }, want);
    const isLite = () => page.evaluate(() =>
      document.getElementById('roomStats').classList.contains('lite'));

    for (const want of [true, false]) {
      const name = want ? '접음' : '펼침';
      const set = await setLite(want);
      if (set === null) { results.push({ 화면: '스탯 설정 유지', 오류: 'toggleStats 가 없다' }); break; }
      if (set !== want) { results.push({ 화면: `스탯 설정 유지/${name}`, 오류: '접힘이 안 바뀐다' }); continue; }
      await reload();
      const after = await isLite();
      results.push(after === want
        ? { 화면: `스탯 설정 유지/${name}`, pass: true, total: 0, blocked: false }
        : { 화면: `스탯 설정 유지/${name}`, 오류: `새로고침하니 ${after ? '접힘' : '펼침'} 으로 돌아갔다` });
    }
  }

  console.log('\n=== checkUI 결과 ===');
  for (const r of results) console.log(JSON.stringify(r));

  // pass 가 true 가 아닌 것은 전부 실패로 친다.
  // '위반 0건' 이어도 잴 수 없었던 경우(blocked·창 크기 0)가 있으므로 total 만 보지 않는다.
  const bad = results.filter(r => r.pass !== true);
  console.log(bad.length ? `\n❌ 통과 못한 화면 ${bad.length}건` : '\n✅ 전부 통과');

  if (process.env.VERBOSE) {
    console.log('\n=== 페이지 콘솔 ===');
    logs.forEach(l => console.log(l));
  }
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('하네스 실패:', e); process.exit(2); });
