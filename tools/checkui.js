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
    // VERBOSE 면 **무엇이 걸렸는지**까지 낸다. 숫자만 보고 원인을 찾느라
    // 브라우저를 따로 띄우게 되는 일이 잦았다
    if (process.env.VERBOSE && r.total) {
      // ⚠️ **`checkUI()` 는 언어 × 라벨 2배까지 돌린다.** 지금 상태만 다시 재면
      // 「2배 확대에서만 나는 위반」이 통째로 안 보인다 — 실제로 8건을 놓칠 뻔했다.
      // 그래서 `checkUI` 가 돌면서 모아 둔 것을 그대로 낸다
      const rows = await page.evaluate(async () => {
        const res = await window.checkUI();
        const clean = a => (a || []).slice(0, 10).map(({ el, ...r }) => r);
        return JSON.stringify({ 요약: (res.report || []).filter(x => x.대비위반 || x.넘침),
          줄: clean(res.report && res.report.stressRows) }, null, 1);
      });
      console.log(`\n--- ${label} ---\n${rows}`);
    }
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
              daily: { walnut: 3, wheat: 2 }, days: 5, plotMax: 5,
            // 칸의 **세 가지 상태를 다 낸다** — 하나만 재면 나머지 둘의 줄을
            // 한 번도 안 본다 (다 자란 칸은 배경색까지 다르다)
            plots: [
              { crop: 'whisper_corn', at: t - 3600e3, ready: t + 8 * 3600e3, n: 3, stash: {} },
              { crop: 'shadow_eggplant', at: t - 13 * 3600e3, ready: t - 60e3, n: 3, stash: {} },
              { crop: null, stash: { walnut: 12, wheat: 9, dew: 6, sun_seed: 4 } },
              { crop: null, stash: {} },
            ],
              // 방어대는 **다섯 자리**다. 찬 자리와 빈자리를 섞어 둔다 —
              // 다 채운 상태로만 재면 빈자리(점선 테두리)를 한 번도 안 본다
              def: [
              { id: 'unicorn', attr: 'light', grade: 'high', power: 64, loyalty: 40 },
              { id: 'boulder_bear', attr: 'earth', grade: 'mid', power: 36, loyalty: 0 },
              null, null, null,
            ], atk: [null, null, null, null, null], teamN: 5, winNeed: 3,
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
          // **심기 시트** — 작물 여섯이 이름·속성 딱지·드는 값·시간까지 한 칸에 든다.
          // ⚠️ **낼 수 있는 것과 없는 것을 같이 낸다** — 못 내는 칸은 회색으로 남는데,
          // 다 낼 수 있는 상태로만 재면 그 표현을 한 번도 안 본다
          const ptBad = await page.evaluate(() => {
            // 첫 작물만 낼 수 있게 하고 나머지는 모자라게 둔다
            const first = D.FARM_CROPS[0];
            D.FARM_CROPS.forEach(c => Object.keys(c.cost).forEach(id => { S.inventory[id] = 0; }));
            Object.keys(first.cost).forEach(id => { S.inventory[id] = first.cost[id]; });
            FARM.plots[3].stash = {};
            openPlant(3);
            if (!document.getElementById('plantPick').classList.contains('show')) return '시트가 안 떴다';
            const rows = document.querySelectorAll('#plantList .plant-item');
            const off = document.querySelectorAll('#plantList .plant-item.off').length;
            if (rows.length !== D.FARM_CROPS.length) return `작물이 ${rows.length}칸이다 (${D.FARM_CROPS.length} 기대)`;
            return off === D.FARM_CROPS.length - 1 ? null : `회색이 ${off}칸이다 (${D.FARM_CROPS.length - 1} 기대)`;
          });
          if (ptBad) results.push({ 화면: `${t}/심기`, 오류: ptBad });
          else { await page.waitForTimeout(280); await run(`${t}/심기`); }
          const ptBad2 = await page.evaluate(() => window.__cardFits('#plantPick'));
          if (ptBad2) results.push({ 화면: `${t}/심기`, 오류: ptBad2 });
          await page.evaluate(() => { closePlant(); FARM = null; setGatherTab('field'); devFillItems(); });
          await page.waitForTimeout(150);
        }

        // **부대 짜기 · 다섯 판 결과** (5단계) — 눌러야만 뜬다.
        // ⚠️ 부대 시트는 **찬 자리와 빈자리를 섞어** 재고, 목록에는 **이미 선 아이**가
        // 회색으로 남아야 한다 (다 채운 상태로만 재면 그 표현을 한 번도 안 본다)
        {
          const tmBad = await page.evaluate(() => {
            const five = ['flame_fox', 'boulder_bear', 'sky_falcon', 'deepsea_whale', 'unicorn'];
            S.creatures = [...new Set([...(S.creatures || []), ...five])];
            S.farmDef = ['flame_fox', 'boulder_bear', null, null, null];   // 둘만 세운다
            openTeam('def');
            if (!document.getElementById('teamPick').classList.contains('show')) return '시트가 안 떴다';
            const slots = document.querySelectorAll('#teamSlots .tm-slot').length;
            const off = document.querySelectorAll('#teamList .pal-item.off').length;
            if (slots !== 5) return `자리가 ${slots}칸이다 (5 기대)`;
            return off >= 1 ? null : '이미 선 아이가 회색으로 안 남는다';
          });
          if (tmBad) results.push({ 화면: `${t}/부대짜기`, 오류: tmBad });
          else { await page.waitForTimeout(280); await run(`${t}/부대짜기`); }
          const tmBad2 = await page.evaluate(() => window.__cardFits('#teamPick'));
          if (tmBad2) results.push({ 화면: `${t}/부대짜기`, 오류: tmBad2 });
          await page.evaluate(() => closeTeam());
          await page.waitForTimeout(150);

          // 다섯 판 결과 — **이긴 줄과 진 줄이 다 나오게** 심는다 (배경색이 다르다)
          const rrBad = await page.evaluate(() => {
            const b = (id, attr) => ({ id, attr, grade: 'high', power: 64, loyalty: 0 });
            showRaidResult('Wwwwwwwwwwww', {
              win: false, wins: 2, winNeed: 3, items: {},
              mine: [b('flame_fox', 'fire'), b('boulder_bear', 'earth'), b('sky_falcon', 'wind'),
                     null, null],
              def: [b('unicorn', 'light'), b('deepsea_whale', 'water'), null,
                    b('moss_deer', 'earth'), null],
              rounds: [0, 1, 2, 3, 4].map(i => ({ i, win: i < 2, chance: 0.5 })),
            });
            if (!document.getElementById('raidResult').classList.contains('show')) return '시트가 안 떴다';
            const rows = document.querySelectorAll('#raidResult .rr-row').length;
            const won = document.querySelectorAll('#raidResult .rr-row.won').length;
            if (rows !== 5) return `줄이 ${rows}개다 (5 기대)`;
            return won === 2 ? null : `이긴 줄이 ${won}개다 (2 기대)`;
          });
          if (rrBad) results.push({ 화면: `${t}/다섯판`, 오류: rrBad });
          else { await page.waitForTimeout(280); await run(`${t}/다섯판`); }
          const rrBad2 = await page.evaluate(() => window.__cardFits('#raidResult'));
          if (rrBad2) results.push({ 화면: `${t}/다섯판`, 오류: rrBad2 });
          await page.evaluate(() => closeRaidResult());
          await page.waitForTimeout(150);

          // 이긴 판 — **여기에만 있는 것들**을 잰다: 도장 · 전리품 · 특수 작물 딱지.
          // 진 판만 재면 승리 연출은 한 번도 검사받지 못한다 (배경색도 크기도 다르다)
          const rwBad = await page.evaluate(() => {
            const b = (id, attr) => ({ id, attr, grade: 'high', power: 64, loyalty: 0 });
            const crop = (window.GameData.FARM_CROPS || [])[0];
            showRaidResult('Wwwwwwwwwwww', {
              win: true, wins: 4, winNeed: 3,
              // **특수 작물과 이삭을 같이** 심는다 — 크기가 갈리는 자리다
              items: crop ? { [crop.id]: 1, firefly: 3, walnut: 2 } : { firefly: 3 },
              mine: [b('deepsea_whale', 'water'), b('sky_falcon', 'wind'),
                     b('ember_newt', 'fire'), b('unicorn', 'light'), null],
              def: [b('flame_fox', 'fire'), b('deepsea_whale', 'water'),
                    b('unicorn', 'light'), null, b('moss_deer', 'earth')],
              rounds: [0, 1, 2, 3, 4].map(i => ({ i, win: i !== 2, chance: 0.5 })),
            });
            const q = document.querySelectorAll('#raidResult .rr-row');
            if (q.length !== 5) return `줄이 ${q.length}개다`;
            if (!document.querySelector('#raidResult .rr-stamp.win')) return '승리 도장이 없다';
            const items = document.querySelectorAll('#raidResult .rr-item');
            if (items.length !== (crop ? 3 : 1)) return `전리품이 ${items.length}칸이다`;
            if (crop && !document.querySelector('#raidResult .rr-item.crop')) {
              return '특수 작물이 이삭과 같은 크기로 나왔다';
            }
            // 한 마디가 **상성을 실제로 읽는가** — 물이 불을 이긴 1번은 진한 줄이어야 한다.
            // 이걸 안 보면 속성 표가 뒤집혀 있어도 「글자가 있으니 통과」가 된다
            const first = q[0].querySelector('.rr-quip');
            if (!first || !first.classList.contains('attr')) return '상성으로 이긴 판이 안 표시된다';
            // 내 자리가 빈 5번은 「보낼 애가 없었어요」여야 한다
            const last = q[4].querySelector('.rr-quip');
            if (!last || !last.textContent.trim()) return '빈 자리에 한 마디가 없다';
            return null;
          });
          if (rwBad) results.push({ 화면: `${t}/다섯판승`, 오류: rwBad });
          else { await page.waitForTimeout(280); await run(`${t}/다섯판승`); }
          const rwBad2 = await page.evaluate(() => window.__cardFits('#raidResult'));
          if (rwBad2) results.push({ 화면: `${t}/다섯판승`, 오류: rwBad2 });
          await page.evaluate(() => closeRaidResult());
          await page.waitForTimeout(150);
        }

        // **퀘스트** (QUEST.md 1단계) — 칩 · 시트 · 완료 · 보상.
        //
        // ⚠️ 여기서 제일 중요한 것은 **칩이 무엇을 덮고 있는가**다. 칩은 화면 위에
        // 떠 있어서, 밑에 눌러야 할 것이 깔리면 그 버튼을 «영영» 못 누른다.
        // 스크린샷의 그 자리가 마이 룸에서는 옷장 칸이었다 (`QUEST.md` 2-1).
        {
          const qBad = await page.evaluate(async () => {
            S.quest = { active: null, n: 0, done: [], queue: [] };
            S.charmPeak = 0;
            refreshQuests(); render();
            const chip = document.getElementById('questChip');
            if (!chip || chip.hidden) return '칩이 안 뜬다';
            if (!S.quest.active) return '퀘스트가 안 열렸다';
            // **한 번에 하나만.** 조건을 다 채워도 칩은 하나여야 한다
            S.charmPeak = 9999; refreshQuests(); render();
            if (document.querySelectorAll('.quest-chip:not([hidden])').length !== 1) {
              return '칩이 둘 이상 뜬다 (한 번에 하나여야 한다)';
            }
            if (S.quest.queue.length !== D.QUESTS.length - 1) {
              return `큐가 ${S.quest.queue.length}개다 (${D.QUESTS.length - 1} 기대)`;
            }
            // ⚠️ **칩 밑에 갇히는 것이 없어야 한다.**
            //
            // 칩은 떠 있으니 «지금» 무언가를 덮는 것은 정상이다 — 밀어 내리면 비켜난다.
            // 진짜로 잡아야 할 것은 **맨 아래까지 밀어 내렸을 때도 덮여 있는 것**이다.
            // 그건 아무리 스크롤해도 못 누르는 버튼이고, 그래서 `body.has-quest` 가
            // 화면 아래를 칩 높이만큼 비운다 (`QUEST.md` 2-1).
            if (!document.body.classList.contains('has-quest')) return '칩이 떴는데 아래를 안 비웠다';
            // ⚠️ **비운 자리가 칩을 덮을 만큼인지 «수치로» 본다.**
            //   비운 값 = `.screen` 의 padding-bottom
            //   필요한 값 = 화면 바닥에서 칩 «위»까지
            // 눌러 보는 것만으로는 못 잡는다 — 지금은 맨 아래에 개발용 블록이 있어서
            // 여유가 남아 돌고, 그게 사라지는 날 조용히 깨진다 (실제로 사보타주가 통과했다)
            const scr = document.querySelector('.screen.active');
            const chipTop = chip.getBoundingClientRect().top;
            const need = Math.round(window.innerHeight - chipTop);
            const have = Math.round(parseFloat(getComputedStyle(scr).paddingBottom) || 0);
            if (have < need) return `아래를 ${have}px 비웠는데 칩이 ${need}px 을 먹는다`;
            const sc = document.scrollingElement;
            sc.scrollTop = sc.scrollHeight;                 // 맨 아래까지
            await new Promise(r => requestAnimationFrame(r));
            const r = chip.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            if (!top || !top.closest('#questChip')) return '칩이 다른 것에 덮여 있다';
            chip.style.visibility = 'hidden';
            const under = document.elementFromPoint(cx, cy);
            chip.style.visibility = '';
            const hit = under && under.closest('button, a, input, .spot-card, .ward-item, [onclick]');
            if (hit && !hit.closest('#questChip')) {
              return `맨 아래까지 내려도 칩이 «${(hit.className || hit.tagName).trim()}» 를 덮는다`;
            }
            sc.scrollTop = 0;
            return null;
          });
          if (qBad) results.push({ 화면: `${t}/퀘스트칩`, 오류: qBad });
          else { await page.waitForTimeout(200); await run(`${t}/퀘스트칩`); }

          // 시트 — NPC 한 마디 · 목표 · 진행 막대 · **어디로 가면 되는지** · 보상
          const qsBad = await page.evaluate(() => {
            // 컷씬은 **제 검사가 따로 있다** — 여기서는 본 것으로 쳐서 시트만 본다
            const q0 = D.questOf(S.quest.active);
            S.seenCuts = D.CUTS.map(c => c.id);
            openQuest();
            if (!document.getElementById('questSheet').classList.contains('show')) return '시트가 안 떴다';
            if (!document.querySelector('#questSheet .q-face svg')) return 'NPC 초상이 없다';
            if (!document.querySelector('#questSheet .q-bar span')) return '진행 막대가 없다';
            // 비법서 부품을 그대로 쓰는가 — 재료 줄이 있어야 한다 (`pageRowsFor`)
            if (!document.querySelector('#questSheet .pg-row')) return '어디로 가면 되는지가 없다';
            const btn = document.querySelector('#questSheet .q-claim');
            if (!btn || !btn.disabled) return '아직 못 냈는데 「가져가기」가 살아 있다';
            return null;
          });
          if (qsBad) results.push({ 화면: `${t}/퀘스트시트`, 오류: qsBad });
          else { await page.waitForTimeout(280); await run(`${t}/퀘스트시트`); }
          const qsBad2 = await page.evaluate(() => window.__cardFits('#questSheet'));
          if (qsBad2) results.push({ 화면: `${t}/퀘스트시트`, 오류: qsBad2 });

          // **끝까지 눌러 본다** — 진행 → 완료 → 보상 → 다음 것.
          // ⚠️ 진행도는 **받은 뒤부터** 센다. `record` 를 그대로 보면 이미 마흔 번
          // 조합한 사람에게 「2번 조합」이 즉시 완료되고 이야기가 통째로 스킵된다
          const qcBad = await page.evaluate(() => {
            const q = D.questOf(S.quest.active);
            if (!q || q.goal.kind !== 'brew') return `첫 퀘스트가 조합이 아니다 (${q && q.goal.kind})`;
            S.seenCuts = D.CUTS.map(c => c.id);      // 컷씬은 따로 잰다

            S.record.brews = 999;                      // 이미 많이 해 본 사람
            renderQuestChip();
            if (questProgress(q) !== 0) return `이미 ${questProgress(q)} 진행돼 있다 (0 기대 — record 를 보고 있다)`;
            const r = D.RECIPES.find(x => x.result.id === q.goal.id);
            r.inputs.forEach(id => { S.inventory[id] = 30; });
            const c0 = S.crystal || 0;
            for (let i = 0; i < q.goal.n; i++) { S.energy = 900; S.cauldron = r.inputs.slice(); brew(); }
            if (typeof closeBrewModal === 'function') closeBrewModal();
            if (questProgress(q) !== q.goal.n) return `진행이 ${questProgress(q)} 다 (${q.goal.n} 기대)`;
            openQuest();
            if (document.querySelector('#questSheet .q-claim').disabled) return '다 했는데 「가져가기」가 잠겨 있다';
            claimQuest();
            if (S.quest.done[0] !== q.id) return '마친 목록에 안 들어갔다';
            if (S.quest.active === q.id) return '마쳤는데 아직 그 퀘스트다';
            if (!S.quest.active) return '다음 퀘스트가 안 나왔다 (큐가 차 있는데)';
            // 보상 — 조합 보상(brewReward)과 섞이지 않게 «퀘스트 몫만» 따로 센다
            const want = (q.reward.crystal || 0) + D.ENERGY.brewReward * q.goal.n;
            const got = (S.crystal || 0) - c0;
            if (got !== want) return `결정이 ${got} 늘었다 (${want} 기대)`;
            return null;
          });
          if (qcBad) results.push({ 화면: `${t}/퀘스트완료`, 오류: qcBad });

          // **컷씬** — 초상화 + 말풍선. 눌러서 넘기고, 끝나면 시트가 이어받는다.
          //
          // ⚠️ 여기서 제일 중요한 것은 **컷씬이 보상을 주지 않는다**는 것이다.
          // 재생과 지급이 한 함수에 있으면 스토리 다시보기가 보상을 또 준다 —
          // 만들기 전에 `QUEST.md` 8-5 에 함정으로 적어 두었던 자리다
          const cutBad = await page.evaluate(() => {
            S.quest = { active: null, n: 0, done: [], queue: [] };
            S.seenCuts = []; S.charmPeak = 0;
            refreshQuests(); render();
            const q = D.questOf(S.quest.active);
            if (!q || !q.cut || !q.cut.in) return '첫 퀘스트에 인트로 컷씬이 없다';
            openQuest();                       // 처음 누르면 «컷씬»이 먼저다
            const cut = document.getElementById('cutScene');
            if (cut.hidden) return '처음 눌렀는데 컷씬이 안 뜬다';
            if (document.getElementById('questSheet').classList.contains('show')) {
              return '컷씬보다 시트가 먼저 떴다';
            }
            const c = D.cutOf(q.cut.in);
            if (document.querySelectorAll('#cutDots i').length !== c.lines.length) {
              return `닷이 ${document.querySelectorAll('#cutDots i').length}개다 (${c.lines.length} 기대)`;
            }
            if (!document.querySelector('#cutFace svg')) return '초상화가 없다';
            // **누가 말하는지가 「부르는 말」로 뜬다** — 설정상의 이름(알테이아)이 아니라
            if (document.getElementById('cutWho').textContent !== speakerName(c.lines[0][0])) {
              return `말하는 사람이 «${document.getElementById('cutWho').textContent}» 다`;
            }
            // 열쇠가 그대로 보이면 문구가 빠진 것이다
            const line = document.getElementById('cutText').textContent;
            if (!line || /^c_\w+_\d+$/.test(line)) return `대사가 «${line}» 다`;
            for (let i = 0; i < c.lines.length; i++) cutNext();
            if (!cut.hidden) return '끝까지 넘겼는데 컷씬이 안 닫힌다';
            if (!document.getElementById('questSheet').classList.contains('show')) {
              return '컷씬이 끝났는데 시트가 안 열린다';
            }
            if (!(S.seenCuts || []).includes(q.cut.in)) return '본 것으로 안 적혔다';
            // **두 번째부터는 바로 시트다** — 진행을 보려고 누를 때마다 대사가
            // 다시 나오면 그건 방해다
            closeQuest(); openQuest();
            if (!cut.hidden) return '이미 본 컷씬이 또 뜬다';
            closeQuest();
            return null;
          });
          if (cutBad) results.push({ 화면: `${t}/컷씬`, 오류: cutBad });
          else {
            await page.evaluate(() => { S.seenCuts = []; closeQuest(); openQuest(); });
            await page.waitForTimeout(280); await run(`${t}/컷씬`);
            await page.evaluate(() => { while (!document.getElementById('cutScene').hidden) cutNext(); closeQuest(); });
          }

          // **완료 컷씬 → 보상** 의 순서와, **다시보기가 보상을 또 주지 않는가**
          const rpBad = await page.evaluate(() => {
            // ⚠️ **앞 검사가 남긴 상태에 기대지 않는다.** 처음부터 다시 세운다 —
            // 뒤에 오는 검사가 남의 값을 보게 되는 사고를 이 파일에서 세 번 냈다
            S.quest = { active: null, n: 0, done: [], queue: [] };
            S.seenCuts = []; S.charmPeak = 0; S.crystal = 1000;
            refreshQuests(); render();
            const q = D.questOf(S.quest.active);
            S.seenCuts = [q.cut.in];                 // 인트로만 본 상태 = 완료 컷씬이 남았다
            const r = D.RECIPES.find(x => x.result.id === q.goal.id);
            r.inputs.forEach(id => { S.inventory[id] = 30; });
            S.quest.n = q.goal.n;
            const c0 = S.crystal || 0;
            openQuest(); claimQuest();
            // 컷씬이 도는 동안에는 **아직 안 준다** — 보상 토스트가 마지막에 남아야 한다
            if (document.getElementById('cutScene').hidden) return '완료 컷씬이 안 떴다';
            if ((S.crystal || 0) !== c0) return '컷씬이 도는데 벌써 보상을 줬다';
            if (S.quest.done.length) return '컷씬이 도는데 벌써 마친 것으로 쳤다';
            while (!document.getElementById('cutScene').hidden) cutNext();
            if ((S.crystal || 0) - c0 !== (q.reward.crystal || 0)) {
              return `보상이 ${(S.crystal || 0) - c0} 다 (${q.reward.crystal} 기대)`;
            }
            // ⚠️ **다시보기는 보상을 다시 주지 않는다.** 재생과 지급이 갈라져 있어야 한다
            const c1 = S.crystal || 0, done1 = S.quest.done.length;
            playCut(q.cut.out);
            while (!document.getElementById('cutScene').hidden) cutNext();
            if ((S.crystal || 0) !== c1) return `다시 보니 결정이 ${(S.crystal || 0) - c1} 더 늘었다`;
            if (S.quest.done.length !== done1) return '다시 보니 마친 목록이 늘었다';
            return null;
          });
          if (rpBad) results.push({ 화면: `${t}/컷씬보상`, 오류: rpBad });

          // **스토리 다시보기** — 본 것만 나오고, 못 본 것은 개수만
          const stBad = await page.evaluate(() => {
            openStory();
            if (!document.getElementById('storySheet').classList.contains('show')) return '시트가 안 떴다';
            const rows = document.querySelectorAll('#storySheet .st-row').length;
            const seen = (S.seenCuts || []).length;
            if (rows !== seen) return `줄이 ${rows}개다 (본 것 ${seen}개 기대)`;
            if (!document.querySelector('#storySheet .st-left')) return '못 본 개수가 안 나온다';
            // **제목이 새어 나가면 안 된다** — 못 본 컷씬의 이름이 화면에 있으면 스포일러다
            const html = document.getElementById('storyBody').textContent;
            const leak = D.CUTS.filter(c => !(S.seenCuts || []).includes(c.id))
              .find(c => html.indexOf(I18N.t(c.id + '_title')) >= 0);
            return leak ? `못 본 컷씬 제목이 보인다 (${leak.id})` : null;
          });
          if (stBad) results.push({ 화면: `${t}/스토리다시보기`, 오류: stBad });
          else { await page.waitForTimeout(280); await run(`${t}/스토리다시보기`); }
          const stBad2 = await page.evaluate(() => window.__cardFits('#storySheet'));
          if (stBad2) results.push({ 화면: `${t}/스토리다시보기`, 오류: stBad2 });
          await page.evaluate(() => { closeStory(); S.seenCuts = []; });
          await page.evaluate(() => {
            closeQuest();
            S.quest = { active: null, n: 0, done: [], queue: [] };
            S.charmPeak = 0; S.record.brews = 0; render();
          });
          await page.waitForTimeout(150);
        }

        // **채집 값이 지대마다 다른가.** 카드에 적힌 ⚡ 값과 **실제로 깎이는 값**이
        // 같아야 한다 — 둘이 갈리면 「10 이라더니 17 이 깎였다」가 되고, 그건
        // 사람이 게임을 못 믿게 되는 종류의 버그다
        {
          const apBad = await page.evaluate(() => {
            S.charmPeak = 9999;                       // 다섯 지대를 다 열어 놓고 본다
            setGatherTab('field');
            const seen = [];
            for (const z of D.ZONES) {
              const m = D.MAPS.find(x => x.zone === z.id);
              gatherZone = z.id; renderGather();
              const el = document.querySelector(`.spot-card[data-spot="${m.id}"] .cost-tag`);
              if (!el) return `${z.id} 의 채집 값이 카드에 없다`;
              const shown = Number(el.textContent.replace(/[^0-9]/g, ''));
              if (shown !== D.zoneAp(z.id)) return `${z.name} 카드에 ${shown} 이라고 적혔다 (${D.zoneAp(z.id)} 기대)`;
              // **실제로 깎이는 값**과 같은가 — 화면과 계산이 갈리는지를 본다
              S.energy = 900;
              const before = S.energy;
              gather(m.id);
              const paid = before - S.energy;
              if (paid !== shown) return `${z.name}: 적힌 값 ${shown} · 깎인 값 ${paid}`;
              seen.push(shown);
            }
            // 앞이 싸고 뒤가 비싸야 한다 (오름차순)
            const up = seen.every((v, i) => i === 0 || v >= seen[i - 1]);
            return up ? null : `지대 값이 오름차순이 아니다: ${seen.join(' · ')}`;
          });
          if (apBad) results.push({ 화면: `${t}/지대별AP`, 오류: apBad });
          await page.evaluate(() => { gatherZone = 'plain'; renderGather(); });
          await page.waitForTimeout(150);
        }

        // **탐험 일지** — 사건마다 문장이 하나씩 붙는다.
        //
        // ⚠️ 여기서 재는 것은 대비·넘침만이 아니다. **모든 사건 열쇠를 하나씩 심어 보고
        // 문장이 실제로 나오는지**를 본다 — 일지는 세이브에 id 만 담고 문장은 읽을 때
        // 만들므로, 문구를 빠뜨리면 **그 줄이 조용히 사라진다** (`diaryLine` 이 빈
        // 문자열을 돌려주고 렌더가 그 줄을 건너뛴다). 화면은 멀쩡해 보이는데 사건만 없다.
        //
        // 열쇠 목록은 `DIARY_ICON` 에서 가져온다 — 새 사건을 만들면 아이콘을 넣는
        // 순간 이 검사가 그 열쇠까지 같이 본다 (검사기에 목록을 옮겨 적으면 어긋난다)
        {
          // 모든 문구가 쓸 수 있는 값을 한꺼번에 담는다. `diaryLine` 은 제가
          // 필요한 것만 꺼내 쓰므로 남는 값은 그냥 안 쓰인다.
          // ⚠️ **한 날이 한 쪽이다** — 사건 열쇠를 여러 날에 나눠 심으면 한 번에
          // 한 쪽만 보이므로 「문구가 빠졌나」를 못 잰다. 열쇠는 **같은 날**에 몰아 심는다
          const seed = `
            const K = Object.keys(window.DIARY_ICON || {});
            const bag = { id: 'unicorn', food: (D.FOODS[0] || {}).id, who: 'Wwwwwwwwwwww',
              items: { firefly: 3, walnut: 2 }, attr: 'fire', map: D.MAPS[0].id,
              n: 3, wins: 4, step: 2 };
            const mk = (k, v, off) => { const d = new Date(Date.now() - off);
              return { t: d.getTime() - K.indexOf(k) * 1000, y: d.getFullYear() - 1800,
                m: d.getMonth() + 1, d: d.getDate(), k, v: { ...bag, ...v } }; };
          `;
          const diBad = await page.evaluate(`(() => {
            ${seed}
            if (K.length < 5) return '사건 열쇠가 ' + K.length + '개다';
            // 오늘 하루에 사건 전부 + 「마지막 단계」 한 줄. 앞의 이틀은 쪽 넘기기용이다
            const day = 24 * 60 * 60 * 1000;
            S.diary = K.map(k => mk(k, {}, 0));
            S.diary.push(mk('di_slim', { done: 1 }, 0));
            S.diary.push(mk('di_binge', {}, day));
            S.diary.push(mk('di_binge', {}, day * 2));
            openDiary();
            if (!document.getElementById('diaryModal').classList.contains('show')) return '시트가 안 떴다';
            const rows = [...document.querySelectorAll('#diaryModal .di-row .di-txt')];
            if (rows.length !== K.length + 1) {
              return '줄이 ' + rows.length + '개다 (' + (K.length + 1) + ' 기대) — 문구가 빠진 사건이 있다';
            }
            // **끼울 값이 남아 있으면 안 된다.** '{who}' 가 그대로 보이는 것은
            // 「문구는 있는데 값이 안 들어간」 자리다 — 눈으로는 잘 안 걸린다
            const raw = rows.find(r => /[{}]/.test(r.textContent));
            if (raw) return '끼우지 못한 값이 보인다: ' + raw.textContent.slice(0, 40);
            // 조사 자리표가 그대로 남았는지 — 「이(가)」 같은 괄호는 문장을 무너뜨린다
            const par = rows.find(r => /\\(가\\)|\\(을\\)|\\(를\\)|\\(이\\)/.test(r.textContent));
            if (par) return '조사 괄호가 남았다: ' + par.textContent.slice(0, 40);
            // 이웃 이름이 색으로 갈리는가 — 밭 기록과 같은 규칙이다
            if (!document.querySelector('#diaryModal .di-who')) return '이웃 이름이 강조되지 않는다';
            return null;
          })()`);
          if (diBad) results.push({ 화면: `${t}/탐험일지`, 오류: diBad });
          else { await page.waitForTimeout(280); await run(`${t}/탐험일지`); }
          const diBad2 = await page.evaluate(() => window.__cardFits('#diaryModal'));
          if (diBad2) results.push({ 화면: `${t}/탐험일지`, 오류: diBad2 });

          // **한 사건에 스무 가지** — 본문 다섯 × 꼬리말 넷. 표에 적어 둔 수만큼
          // `<열쇠>_1` … `_5` 와 `<열쇠>_t1` … `_t4` 가 있어야 한다.
          // 하나만 빠져도 그 자리만 조용히 비는데, 화면은 멀쩡해 보여서 눈으로는 안 걸린다
          const tlBad = await page.evaluate(() => {
            const B = window.DIARY_BODIES || {}, TL = window.DIARY_TAILS || {};
            const keys = Object.keys(TL);
            if (!keys.length) return '꼬리말 표가 비었다';
            const miss = [];
            keys.forEach(k => {
              for (let i = 1; i <= (B[k] || 0); i++) if (I18N.t(`${k}_${i}`) === `${k}_${i}`) miss.push(`${k}_${i}`);
              for (let i = 1; i <= TL[k]; i++) if (I18N.t(`${k}_t${i}`) === `${k}_t${i}`) miss.push(`${k}_t${i}`);
            });
            if (miss.length) return `문구가 없다: ${miss.slice(0, 5).join(' · ')}`;
            // **곱이 스무 가지여야 한다.** 한쪽만 늘리면 조용히 어긋난다
            const off = keys.filter(k => (B[k] || 0) * TL[k] !== window.DIARY_VARIANTS);
            if (off.length) {
              const k = off[0];
              return `${k} 는 ${B[k] || 0}×${TL[k]}=${(B[k] || 0) * TL[k]}가지다 (${window.DIARY_VARIANTS} 기대)`;
            }
            // 사건마다 아이콘이 있는가 — 아이콘 표가 곧 사건 목록이라 짝이 맞아야 한다
            const noIcon = keys.filter(k => k !== 'di_slim_done' && !window.DIARY_ICON[k]);
            if (noIcon.length) return `아이콘이 없는 사건: ${noIcon.join(' · ')}`;
            // 화면에 실제로 붙었는가. **다 붙어야 한다** — 표에 적힌 사건은 전부 꼬리말을 갖는다
            const shown = document.querySelectorAll('#diaryModal .di-tail').length;
            const rows = document.querySelectorAll('#diaryModal .di-row').length;
            return shown === rows ? null : `꼬리말이 ${shown}/${rows} 줄에만 붙었다`;
          });
          if (tlBad) results.push({ 화면: `${t}/일지꼬리말`, 오류: tlBad });

          // ⚠️ **스무 가지가 실제로 다 나오는가.** 표에 5·4 라고 적어 두는 것과
          // 뽑기가 스무 자리를 다 짚는 것은 다른 얘기다. 화면만 보면 「매번 다르네」로
          // 보이므로 눈으로는 절대 못 잡는다 — 200줄을 뽑아 가짓수를 센다.
          //
          // 잡아야 할 것은 둘이다:
          //   ① 시각을 안 보고 뽑으면 **한 사건이 늘 같은 문장**이 된다 (1가지)
          //   ② 꼬리말만 바뀌고 본문이 하나면 「비슷한 말」이 스무 번 나온다
          //
          // 여담 — 다섯과 넷은 **서로소**라, 본문과 꼬리말을 같은 시드로 뽑아도
          // (h%5, h%4)가 스무 자리를 다 짚는다. 소금을 나눈 것은 그래도 둘이
          // 함께 움직이지 않게 하려는 것이고, 수를 6×4 처럼 바꾸면 그 성질이 깨진다 —
          // 그때는 이 검사가 12가지로 줄어든 것을 잡아 준다
          const vaBad = await page.evaluate((want) => {
            const bag = { id: 'unicorn', food: (D.FOODS[0] || {}).id, who: '수수',
              items: { firefly: 3 }, attr: 'fire', map: D.MAPS[0].id, n: 3, wins: 4, step: 2 };
            const base = Date.now();
            const worst = [];
            Object.keys(window.DIARY_TAILS).forEach(k => {
              const seen = new Set(), heads = new Set();
              for (let i = 0; i < 200; i++) {
                const s = diaryLine({ t: base + i * 1000, k: k === 'di_slim_done' ? 'di_slim' : k,
                  v: k === 'di_slim_done' ? { ...bag, done: 1 } : bag });
                seen.add(s);
                // 본문이 실제로 갈리는가 (꼬리말만 바뀌면 하나다).
                // ⚠️ **앞 몇 글자로 견주면 안 된다** — `{who}` 가 `<b class="di-who">…`
                // 로 펴져서 스물여섯 자가 전부 같은 태그다. 꼬리말 표시로 정확히 자른다
                heads.add(s.split('<span class="di-tail">')[0]);
              }
              worst.push({ k, n: seen.size, h: heads.size });
            });
            window.__diaryVariety = worst.reduce((m, x) => Math.min(m, x.n), 99)
              + '~' + worst.reduce((m, x) => Math.max(m, x.n), 0) + '가지';
            // 200번 뽑아 스무 자리를 못 다 짚을 일은 거의 없지만, 살짝 여유를 둔다
            const thin = worst.find(x => x.n < want - 2);
            if (thin) return `${thin.k} 가 ${thin.n}가지밖에 안 나온다 (${want} 기대)`;
            // 본문은 다섯 벌이니 200번 뽑으면 다섯이 다 나와야 한다
            const flat = worst.find(x => x.h < 5);
            return flat ? `${flat.k} 의 본문이 ${flat.h}가지뿐이다 (꼬리말만 바뀐다)` : null;
          }, 20);
          // 통과해도 **잰 값을 남긴다.** 조용히 지나가면 이 검사가 도는지조차
          // 알 수 없다 (이웃 밭 검사에서 실제로 겪었다 — 한 번도 안 돌던 검사를
          // 「전부 통과」로 읽었다)
          results.push(vaBad
            ? { 화면: `${t}/일지스무가지`, 오류: vaBad }
            : { 화면: `${t}/일지스무가지`, pass: true,
                가짓수: await page.evaluate(() => window.__diaryVariety) });

          // **쪽 넘기기** — 한 날이 한 쪽이다. 끝에 닿으면 그쪽 버튼이 잠긴다.
          // ⚠️ 눌러서 **날짜가 실제로 바뀌는지**를 본다. 쪽수 글자만 보면
          // 본문을 안 갈아 끼워도 통과한다
          const pgBad = await page.evaluate(() => {
            const date = () => (document.querySelector('#diaryModal .di-date') || {}).textContent;
            const btns = () => [...document.querySelectorAll('#diaryNav .di-nav-btn')];
            const page = () => (document.querySelector('#diaryNav .di-page') || {}).textContent;
            if (btns().length !== 2) return `넘기기 버튼이 ${btns().length}개다 (2 기대)`;
            const p1 = page(), d1 = date();
            // 첫 쪽에서는 **최근 쪽(▶)이 잠겨** 있어야 한다
            if (!btns()[1].disabled) return '첫 쪽인데 최근 쪽 버튼이 살아 있다';
            if (btns()[0].disabled) return '뒤에 이틀이 더 있는데 과거 쪽 버튼이 잠겼다';
            diaryFlip(1);
            if (date() === d1) return `쪽을 넘겼는데 날짜가 그대로다 (${d1})`;
            if (page() === p1) return `쪽을 넘겼는데 쪽수가 그대로다 (${p1})`;
            diaryFlip(1);                       // 마지막 쪽 (사흘치를 심었다)
            if (!btns()[0].disabled) return '마지막 쪽인데 과거 쪽 버튼이 살아 있다';
            // 끝에서 더 눌러도 넘어가지 않는다
            const last = page(); diaryFlip(1);
            if (page() !== last) return '마지막 쪽에서 더 넘어갔다';
            diaryFlip(-1); diaryFlip(-1);
            return date() === d1 ? null : `되돌아왔는데 첫 쪽이 아니다 (${date()} · ${d1} 기대)`;
          });
          if (pgBad) results.push({ 화면: `${t}/일지쪽넘기기`, 오류: pgBad });
          else {
            // 중간 쪽에서도 한 번 잰다 — 양쪽 버튼이 다 살아 있는 유일한 상태다
            await page.evaluate(() => diaryFlip(1));
            await page.waitForTimeout(200); await run(`${t}/일지쪽넘기기`);
          }
          // ⚠️ **심은 것을 치운다.** 남겨 두면 뒤에 오는 검사가 남의 값을 보게 된다
          // (작물 검사와 부대 검사에서 실제로 두 번 겪었다)
          await page.evaluate(() => { closeDiary(); S.diary = []; });
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

        // **장이 없는 조합은 AP 를 한 푼도 안 쓴다.**
        //
        // 이 검사가 이 시스템의 전부다. 플레이테스터가 그만둔 이유가 「AP 와 재료를
        // 내고 나서 실패를 통보받는 것」이었고, 비법서는 그걸 없애려고 만들었다.
        // ⚠️ **AP 가 안 깎이는 것을 «수치로» 봐야 한다** — 토스트가 떴는지만 보면
        // 먼저 깎고 나서 안내하는 코드도 통과한다
        const noPage = await page.evaluate(() => {
          const ids = Object.keys(D.INGREDIENTS).filter(id => !D.INGREDIENTS[id].rare);
          for (const a of ids) for (const b of ids) {
            if (a === b || D.RECIPE_MAP[D.recipeKey([a, b])]) continue;
            S.inventory[a] = (S.inventory[a] || 0) + 3;
            S.inventory[b] = (S.inventory[b] || 0) + 3;
            S.energy = 900; S.cauldron = [a, b]; S.want = [];
            const had = { ap: S.energy, a: invCount(a), b: invCount(b) };
            brew();
            if (S.energy !== had.ap) return `AP 가 ${had.ap - S.energy} 깎였다 (0 이어야 한다)`;
            if (invCount(a) !== had.a || invCount(b) !== had.b) return '재료가 사라졌다';
            if (document.querySelector('#brewModal.show')) return '장도 없는데 결과 모달이 떴다';
            return null;
          }
          return '장이 없는 조합을 못 찾았다';
        });
        if (noPage) results.push({ 화면: `${t}/장없는조합`, 오류: noPage });

        // **조합에 성공하면 현자의 결정이 들어온다** — 실패가 사라지면서
        // 이것이 유일한 수급원이 됐다. 0 이면 AP 충전도 밭 칸도 영영 못 연다
        const rew = await page.evaluate(() => {
          const r = D.RECIPES.find(x => x.result.kind === 'potion' && hasPage(x.result.id));
          if (!r) return '가진 장이 하나도 없다';
          r.inputs.forEach(id => { S.inventory[id] = (S.inventory[id] || 0) + 5; });
          S.energy = 900; S.cauldron = r.inputs.slice(); S.want = [];
          const c0 = S.crystal || 0;
          brew();
          const got = (S.crystal || 0) - c0;
          if (typeof closeBrewModal === 'function') closeBrewModal();
          return got === D.ENERGY.brewReward ? null
            : `결정이 ${got} 들어왔다 (${D.ENERGY.brewReward} 기대)`;
        });
        if (rew) results.push({ 화면: `${t}/조합보상`, 오류: rew });
        await page.waitForTimeout(150);

        // **비법서 한 장** — 재료마다 「무엇을 얼마나 · 어디서 · 언제 · 누구와」.
        // ⚠️ **열린 맵과 잠긴 맵을 «같이» 보여 주는 장으로 잰다** — 다 열린 장으로만
        // 재면 잠금 표현을 한 번도 안 본다 (밭 심기 시트에서 겪은 것과 같은 구멍이다)
        const pgBad = await page.evaluate(() => {
          S.charmPeak = 0; S.stats.charm = 0; S.stats.beauty = 0;   // 평야만 열린 상태
          const zoneOf = id => {
            const m = D.MAPS.find(x => (x.pool || []).includes(id) || x.special === id);
            return m ? m.zone : null;
          };
          // **가진 장 중에서 고르지 않는다.** 어느 장을 갖고 있느냐는 단계에 따라
          // 달라져서, 그때그때 「조건에 맞는 장이 없다」로 검사가 통째로 안 돌 수 있다.
          // 조건에 맞는 레시피를 먼저 찾고 **그 장을 심는다**
          const r = D.RECIPES.find(x => x.inputs.some(i => zoneOf(i) === 'plain')
            && x.inputs.some(i => zoneOf(i) && zoneOf(i) !== 'plain'));
          if (!r) return '열린 맵과 잠긴 맵이 같이 든 레시피가 데이터에 없다';
          if (!hasPage(r.result.id)) S.discovered.push(r.result.id);
          openPage(r.result.id);
          if (!document.getElementById('pageSheet').classList.contains('show')) return '시트가 안 떴다';
          const rows = document.querySelectorAll('#pageSheet .pg-row');
          const want = new Set(r.inputs).size;      // **같은 재료는 한 줄로 묶는다**
          if (rows.length !== want) return `줄이 ${rows.length}개다 (${want} 기대 — 같은 재료를 안 묶었다)`;
          // **분량** — ⚠️ 지금 데이터에는 겹치는 재료가 한 곳도 없어서(136 전부 ×1)
          // 진짜 레시피로는 이 자리를 한 번도 못 잰다. 그래서 **일부러 겹치게 만들어**
          // 재고 되돌린다. 이걸 안 하면 「묶는 코드」가 영영 검사받지 않는다
          {
            const keep = r.inputs.slice();
            r.inputs = keep.concat([keep[0]]);        // 첫 재료를 하나 더
            renderPage();
            const n2 = document.querySelectorAll('#pageSheet .pg-row').length;
            const tag = document.querySelector('#pageSheet .pg-n');
            r.inputs = keep; renderPage();            // 반드시 되돌린다
            if (n2 !== want) return `겹친 재료가 ${n2}줄이 됐다 (${want} 기대 — 안 묶었다)`;
            if (!tag || tag.textContent !== '×2') return `분량이 «${tag && tag.textContent}» 다 (×2 기대)`;
          }
          // 어디서 나는지 · 갈 수 있는지
          if (!document.querySelector('#pageSheet .pg-where')) return '어디서 나는지가 없다';
          if (!document.querySelector('#pageSheet .pg-row.locked')) return '잠긴 맵의 재료가 표시되지 않는다';
          if (!document.querySelector('#pageSheet .pg-lock')) return '잠긴 맵에 해금 매력이 안 적힌다';
          // 열린 맵에는 AP 와 시간대·속성 힌트가 붙는다
          if (!document.querySelector('#pageSheet .pg-ap')) return '채집 AP 가 안 적힌다';
          return null;
        });
        if (pgBad) results.push({ 화면: `${t}/비법서`, 오류: pgBad });
        else { await page.waitForTimeout(280); await run(`${t}/비법서`); }
        const pgBad2 = await page.evaluate(() => window.__cardFits('#pageSheet'));
        if (pgBad2) results.push({ 화면: `${t}/비법서`, 오류: pgBad2 });
        await page.evaluate(() => { closePage(); S.cauldron = []; });
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
          // ⚠️ **날짜 키에서 숫자를 빼면 안 된다.** `dayKey()` 는 YYYYMMDD 를 한 덩어리
          // 정수로 packing 한 값이라, 1일에 5를 빼면 「8월 96일」(20260896)이 된다 —
          // `daysBetween` 이 −64를 내놓고 기록이 한 줄만 쌓여 **매달 1~5일에만
          // 실패하는 검사**였다 (9월 1일에 실제로 걸렸다). 게임처럼 날짜를 뺀다
          const back = nowDate(); back.setDate(back.getDate() - 5);
          S.produced = []; S.producedDay = dayKey(back);
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
            daily: { walnut: 3, wheat: 2 }, days: 5, plotMax: 5,
            // 칸의 **세 가지 상태를 다 낸다** — 하나만 재면 나머지 둘의 줄을
            // 한 번도 안 본다 (다 자란 칸은 배경색까지 다르다)
            plots: [
              { crop: 'whisper_corn', at: t - 3600e3, ready: t + 8 * 3600e3, n: 3, stash: {} },
              { crop: 'shadow_eggplant', at: t - 13 * 3600e3, ready: t - 60e3, n: 3, stash: {} },
              { crop: null, stash: { walnut: 12, wheat: 9, dew: 6, sun_seed: 4 } },
              { crop: null, stash: {} },
            ],
            def: [
              { id: 'unicorn', attr: 'light', grade: 'high', power: 64, loyalty: 40 },
              { id: 'boulder_bear', attr: 'earth', grade: 'mid', power: 36, loyalty: 0 },
              null, null, null,
            ], atk: [null, null, null, null, null], teamN: 5, winNeed: 3,
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
          const b = (id, attr) => ({ id, attr, grade: 'high', power: 64, loyalty: 0 });
          // 내 출정대 — **불 둘만 세우고 나머지는 빈자리**로 둔다 (빈자리도 그려야 한다)
          // ⚠️ **방어대에 설 아이를 «앞»에 둔다.** 뒤에 두면 정렬을 안 해도
          // 회색이 이미 맨 아래라 「맨 아래로 내린다」를 한 번도 검사하지 못한다
          // (정렬을 빼는 사보타주가 그대로 통과했다)
          S.creatures = [...new Set(['unicorn', 'boulder_bear',
            'ember_phoenix', 'flame_fox', ...(S.creatures || [])])];
          S.farmAtk = ['ember_phoenix', 'flame_fox', null, null, null];
          // **방어대에도 세워 둔다** — 안 세우면 공격대 고르기에 회색이 하나도
          // 없어서 「다른 부대에 선 아이」 표시를 한 번도 못 잰다
          S.farmDef = ['unicorn', 'boulder_bear', null, null, null];
          S.petField = 'ember_phoenix';
          // ⚠️ **칸(plots)도 같이 심는다.** 안 심으면 미리보기가 전부 「빈 칸」으로
          // 그려져 **작물 · 자라는 중 · 이삭 세 가지를 한 번도 안 잰다** —
          // 색도 크기도 다 다른 칸들이라 그 상태가 통과로 나오면 아무 의미가 없다
          const now = (FARM && FARM.now) || Date.now();
          const crop = (D.FARM_CROPS || [])[0];
          RAIDS = [
            // 불 > 땅 = 유리한 자리가 많다. **네 가지 칸이 다 나오는 밭**이다
            { name: 'Wwwwwwwwwwww', charm: 999, count: 15, stash: { walnut: 9, wheat: 6 },
              floor: 6,
              plots: [
                { crop: crop && crop.id, ready: now - 1000, n: 3, ears: 0 },   // 다 자란 작물
                { crop: crop && crop.id, ready: now + 6 * 3600e3, n: 3, ears: 0 }, // 자라는 중
                { crop: null, ready: 0, n: 0, ears: 9 },                        // 이삭
                { crop: null, ready: 0, n: 0, ears: 6 },
                { crop: null, ready: 0, n: 0, ears: 0 },                        // 빈 칸
              ],
              def: [b('boulder_bear', 'earth'), b('moss_deer', 'earth'), null, null, null] },
            // 물 > 불 = 불리. **바닥에 걸려 가져갈 게 없는 밭** (이삭 4 · 바닥 6)
            { name: '물의수호자', charm: 300, count: 4, stash: { dew: 4 }, floor: 6,
              plots: [{ crop: null, ready: 0, n: 0, ears: 4 }, { crop: null, ready: 0, n: 0, ears: 0 }],
              def: [b('deepsea_whale', 'water'), b('coral_seahorse', 'water'), null, null, null] },
            // 보통 (순환에 없는 짝) — 이삭만 있고 바닥 위로 남는 밭
            { name: '밭주인', charm: 220, count: 9, stash: { firefly: 9 }, floor: 6,
              plots: [{ crop: null, ready: 0, n: 0, ears: 9 }, { crop: null, ready: 0, n: 0, ears: 0 }],
              def: [b('unicorn', 'light'), null, null, null, null] },
            // 지키개가 하나도 없는 밭 · 칸도 안 온 밭 (옛 서버라면 plots 가 없다)
            { name: '빈터', charm: 10, count: 2, stash: { sun_seed: 2 },
              def: [null, null, null, null, null] },
          ];
          const el = document.getElementById('raidPick');
          el.classList.add('show');
          document.getElementById('raidTitle').textContent = I18N.t('raid_title');
          renderRaidList();
          const tags = [...document.querySelectorAll('#raidList .raid-tag')].map(x => x.className);
          const kinds = new Set(tags.map(c => c.replace('raid-tag ', '')));
          if (kinds.size !== 3) return `상성 딱지가 ${[...kinds].join('/')} 뿐이다 (셋 다 나와야 한다)`;
          // ── 가기 전에 보이는 밭 ──
          const rows = document.querySelectorAll('#raidList .raid-item');
          const strip = rows[0].querySelectorAll('.plot-strip .ps-cell');
          if (strip.length !== 5) return `칸이 ${strip.length}개다 (자리 다섯과 같아야 한다)`;
          // **네 가지가 다 그려지는가** — 색도 뜻도 다 다르다
          for (const k of ['crop', 'grow', 'ears', 'none']) {
            if (!rows[0].querySelector('.ps-cell.' + k)) return `${k} 칸이 안 그려진다`;
          }
          // **자리 번호 = 칸 번호**가 화면에서도 맞는가 — 지키개 줄과 칸 줄의
          // 같은 번호가 가로로 같은 자리에 있어야 세로로 읽힌다
          const foe = rows[0].querySelectorAll('.tm-slot, .tm-cell');
          if (foe.length === 5) {
            const fx = foe[2].getBoundingClientRect(), px = strip[2].getBoundingClientRect();
            const off = Math.abs((fx.left + fx.right) / 2 - (px.left + px.right) / 2);
            if (off > 12) return `3번 지키개와 3번 칸이 ${Math.round(off)}px 어긋났다`;
          }
          // 바닥에 걸린 밭은 「없다」고 말해야 한다 (이삭 4 · 바닥 6)
          if (!rows[1].querySelector('.ps-sum.bad')) return '바닥에 걸린 밭이 「없다」고 안 알린다';
          // 바닥 위로 남는 밭은 개수를 알려 준다 (이삭 9 · 바닥 6 → 3)
          const sum3 = rows[2].querySelector('.ps-sum');
          if (!sum3 || !/3/.test(sum3.textContent)) return `가져갈 수 있는 개수가 틀렸다 (${sum3 && sum3.textContent})`;
          // 칸이 안 온 밭(옛 서버)에서도 안 죽는가
          if (!rows[3].querySelector('.plot-strip')) return '칸이 없는 밭에서 미리보기가 통째로 빠졌다';
          return null;
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

        // ── 겹친 시트 — **나중에 연 것이 위에 와야 한다** ──
        //
        // ⚠️ `.modal` 이 전부 `z-index: 50` 이라, 둘이 같이 떠 있으면 **DOM 순서가
        // 이긴다** — 여는 순서와는 아무 상관이 없다. `#teamPick` 이 `#raidPick`
        // 보다 index.html 앞쪽에 있어서 「바꾸기」를 누르면 부대 고르기가 **뒤로 떴다**
        // (신고받았다). 눈으로는 「안 열렸다」로 보인다.
        //
        // **`classList.contains('show')` 로 검사하면 안 된다** — 뒤에 떠 있어도
        // 그건 참이다. 실제로 **눌리는 쪽**을 hit-test 해야 잡힌다
        const stackBad = await page.evaluate(() => {
          openTeam('atk');
          const card = document.querySelector('#teamPick .modal-card');
          if (!card) return '부대 고르기 카드가 없다';
          const r = card.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return '부대 고르기가 안 떴다';
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          const top = hit && hit.closest('.modal');
          if (!top || top.id !== 'teamPick') {
            return `이웃 밭 위에서 「바꾸기」를 눌렀는데 위에 있는 것은 #${top ? top.id : '없음'} 이다`;
          }
          // ── 방어대에 선 아이는 공격대에서 **회색 + 맨 아래** ──
          //
          // 한 마리는 한쪽에만 설 수 있다. 그것을 «고르기 전에» 알려 주지 않으면
          // 눌러 보고 나서야 안다. 회색만으로는 부족해서 맨 아래로 내린다 —
          // 고를 수 있는 것이 위에 모여야 「누굴 넣지」가 한눈에 끝난다
          const rows = [...document.querySelectorAll('#teamList .pal-item')];
          const marked = rows.filter(e => e.dataset.other === '1');
          if (!marked.length) return '방어대에 선 아이가 회색으로 안 나온다';
          const first = rows.findIndex(e => e.dataset.other === '1');
          const after = rows.slice(first).every(e => e.dataset.other === '1');
          if (!after) return '회색이 맨 아래로 안 내려갔다';
          if (!marked[0].classList.contains('off')) return '회색 표시(.off)가 안 붙었다';
          if (!marked[0].querySelector('.raid-tag.locked')) return '「방어대」 딱지가 없다';
          // 누르면 **바로 안 넣고** 물어본다
          marked[0].click();
          const ask = document.getElementById('confirmModal');
          if (!ask || !ask.classList.contains('show')) return '회색을 눌렀는데 확인 패널이 안 뜬다';
          // 확인 패널은 부대 고르기 **위에** 떠야 한다 (z-index 60)
          const ac = ask.querySelector('.modal-card').getBoundingClientRect();
          const ah = document.elementFromPoint((ac.left + ac.right) / 2, (ac.top + ac.bottom) / 2);
          const atop = ah && ah.closest('.modal');
          if (!atop || atop.id !== 'confirmModal') {
            return `확인 패널 위에 있는 것이 #${atop ? atop.id : '없음'} 이다`;
          }
          closeConfirm();
          return null;
        });
        if (stackBad) results.push({ 화면: `${t}/겹친시트`, 오류: stackBad });
        else { await page.waitForTimeout(200); await run(`${t}/겹친시트`); }
        await page.evaluate(() => closeTeam());
        await page.waitForTimeout(120);
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
