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
      S.creatures = crs.map(r => r.result.id);
      if (typeof bagOpen !== 'undefined' && !bagOpen) toggleBag();   // 채집 가방 펼치기
      // 마을은 여는 조건이 아직 없다 — 개발용 스위치가 유일한 열쇠라 여기서 켜 준다.
      // 안 켜면 마을 안(지도·명판)이 통째로 검사에서 빠진다
      try { localStorage.setItem('dieter_alchemist_devvillage_v1', '1'); } catch (e) {}
      // 랭킹 탭은 '여신' 단계(매력 100)부터 나타난다 — 매력을 안 주면 그 화면이
      // 통째로 검사에서 빠진다. 지난 주 결과 배너도 같이 띄워 둔다 (그것도 화면이다)
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
        if (c.pre === 'potion') { S.potions.vitality = 1; roomTab = 'potions'; }
        switchTab(c.tab);
        Tut.goto(c.step, c.beat);
        if (c.pre === 'potion') { setRoomTab('potions'); Tut.refresh(); }
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
        for (const sub of ['clothes', 'potions', 'creatures']) {
          const bad = await page.evaluate((s) => {
            setRoomTab(s);
            return roomTab === s ? null : `하위 탭이 열리지 않았다 (${s})`;
          }, sub);
          if (bad) { results.push({ 화면: `${t}/${sub}`, 오류: bad }); continue; }
          await page.waitForTimeout(250);
          await run(`${t}/${sub}`);
        }
        continue;
      }
      await run(t);
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
