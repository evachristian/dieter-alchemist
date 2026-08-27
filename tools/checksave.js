// 세이브 마이그레이션 검사 — **예전 버전 세이브를 심어 놓고** 진행이 살아남는지 본다.
//
// 왜 필요한가: 새 플레이어(세이브 없음)만 보면 마이그레이션은 한 번도 실행되지 않는다.
// 이 프로젝트에서 실제로 겪은 사고 두 가지가 여기서만 잡힌다.
//
//   1) load() 는 game.js 를 **끝까지 읽기 전에** 불린다. migrate 가 파일 아래쪽의
//      const 를 건드리면 ReferenceError 가 나는데, load() 의 catch 가 그것을 삼켜
//      **세이브가 통째로 기본값으로 되돌아간다.** 화면에는 아무 오류도 안 뜬다 —
//      그냥 어제까지 키우던 캐릭터가 처음 상태로 보인다.
//   2) 기본값만 바꾸고 마이그레이션을 안 쓰면, 이미 플레이 중인 사람에게는 반영되지 않는다.
//
// 그래서 보는 것 세 가지:
//   · 심어 둔 진행(이름·착장·재료)이 그대로 살아 있는가  → 기본값으로 떨어지지 않았는가
//   · 콘솔에 'load failed' 가 찍히지 않았는가            → 조용히 삼킨 예외가 없는가
//   · 버전별로 옮겨져야 할 값이 실제로 옮겨졌는가        → CASES 의 expect
//
// 사용: node tools/checksave.js   (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

// 검사할 옛 세이브들. **진행이 들어 있어야 한다** — 빈 세이브는 기본값과 구별되지 않아
// '되돌아갔는지' 를 알 수 없다.
const CASES = [
  {
    name: '세이브 1 (버전 표기가 없던 시절)',
    save: { name: '올드원', nameClaimed: true, gathered: 42, inventory: { herb: 7 } },
    expect: (S) => [
      S.name === '올드원' || `이름이 사라졌다 (${S.name})`,
      S.gathered === 42 || `채집 횟수가 사라졌다 (${S.gathered})`,
      (S.inventory || {}).herb === 7 || '가방이 비었다',
      S.tutorialDone === true || '이미 플레이 중이던 사람은 튜토리얼을 마친 것으로 쳐야 한다',
      (S.tut || {}).done === true || '옛 세이브에 튜토리얼이 처음부터 다시 뜬다',
      (S.discovered || []).includes('vitality') || '시작 레시피가 안 채워졌다',
    ],
  },
  {
    // 튜토리얼이 생기기 직전 버전. **tutorialDone 을 켜 주는 코드가 없던 시절**이라
    // 한참 플레이한 사람도 이 값이 false 로 남아 있다 — 3구 솥·크리처 탭·옷장
    // 열두 칸이 잠긴 채였다. 세이브 10 이 그것까지 같이 풀어 준다.
    name: '세이브 9 (튜토리얼이 생기기 전) — 이제 와서 튜토리얼이 뜨면 안 된다',
    save: { ver: 9, name: '고인물', nameClaimed: true, tutorialDone: false,
            stats: { beauty: 45, charm: 88 }, inventory: { herb: 12 },
            unlocked: ['dress_gown'] },
    visit: 'showcase',
    expect: (S) => [
      (S.tut || {}).done === true || '한참 플레이한 사람에게 튜토리얼이 처음부터 뜬다',
      S.tutorialDone === true || 'tutorialDone 이 안 켜졌다 (솥·크리처·옷장이 잠긴 채로 남는다)',
      S.stats.charm === 88 || `진행이 사라졌다 (매력 ${S.stats.charm})`,
      (S.inventory || {}).herb === 12 || '가방이 비었다',
      (S.unlocked || []).includes('dress_gown') || '갖고 있던 옷이 사라졌다',
    ],
  },
  {
    // 반대쪽 — **세이브가 아예 없는 새 플레이어에게는 튜토리얼이 떠야 한다.**
    // 위의 마이그레이션을 너무 넓게 잡으면 이쪽이 조용히 같이 꺼진다
    name: '새 플레이어 — 튜토리얼이 뜬다',
    save: null,
    visit: 'showcase',
    expect: (S) => [
      (S.tut || {}).done === false || '새 플레이어인데 튜토리얼이 이미 끝나 있다',
      S.tutorialDone === false || '새 플레이어인데 졸업해 있다',
      S.__tutOn === true || '튜토리얼 막이 안 떴다',
    ],
  },
  {
    name: '세이브 7 (옷 잠금이 생기기 전)',
    save: { ver: 6, name: '세븐', nameClaimed: true, tutorialDone: true,
            outfit: { dress: 'dress_gown', shoes: 'shoes_glass' } },
    expect: (S) => [
      S.outfit.dress === 'dress_gown' || `입고 있던 옷이 바뀌었다 (${S.outfit.dress})`,
      (S.unlocked || []).includes('dress_gown') || '입고 있던 옷이 잠긴 채로 남았다',
    ],
  },
  {
    name: '세이브 8 (헤어컬러 칸이 있던 시절) — 핑크 머리',
    save: { ver: 8, name: '핑크', nameClaimed: true, tutorialDone: true,
            outfit: { hair: 'hair_wave', hairColor: 'hcol_pink' } },
    expect: (S) => [
      S.name === '핑크' || '이름이 사라졌다',
      S.outfit.hair === 'hair_wave' || `머리 모양이 바뀌었다 (${S.outfit.hair})`,
      // 세이브 11 에서 염색이 칸(hair) → 옷(hair_wave) 으로 옮겨 갔다.
      // 두 마이그레이션이 이어 달리므로 **최종 자리**에서 확인한다
      S.itemColor.hair_wave === 'c_blossom' || `머리색이 안 옮겨졌다 (${JSON.stringify(S.itemColor)})`,
      S.dyeForever.hair_wave === true || '옮긴 머리색이 24시간짜리로 잡혔다 (풀려 버린다)',
      (S.unlocked || []).includes('c_blossom') || '쓰고 있던 색인데 안 가진 것으로 남았다',
    ],
  },
  {
    name: '세이브 8 — 기본(브라운) 머리는 건드리지 않는다',
    save: { ver: 8, name: '브라운', nameClaimed: true, tutorialDone: true,
            outfit: { hair: 'hair_bob', hairColor: 'hcol_brown' } },
    expect: (S) => [
      !Object.keys(S.itemColor || {}).length || `안 골랐던 사람에게 염색이 생겼다 (${JSON.stringify(S.itemColor)})`,
    ],
  },
  {
    name: '세이브 9 (리그가 없던 시절) — 첫 진입에 강등당하지 않는다',
    save: { ver: 9, name: '리그전', nameClaimed: true, tutorialDone: true,
            stats: { beauty: 60, charm: 140 } },
    // 정산(settleLeague)은 **랭킹 화면을 열 때** 돈다 — 안 열어 보면 이 케이스는
    // 그냥 기본값만 확인하고 지나간다
    visit: 'league',
    expect: (S) => [
      S.league === 0 || `맨 아래 리그에서 시작해야 한다 (${S.league})`,
      (S.week && S.week.score) === 0 || `이번 주 점수가 0이 아니다 (${S.week && S.week.score}))`,
      // 겨룰 지난 주가 없는데 정산하면 12위로 처리돼 강등 배너가 뜬다
      !S.leagueLast || `첫 진입인데 지난 주 결과가 생겼다 (${JSON.stringify(S.leagueLast)})`,
    ],
  },
  {
    name: '세이브 8 — 이미 머리를 염색해 둔 사람은 덮어쓰지 않는다',
    save: { ver: 8, name: '이미', nameClaimed: true, tutorialDone: true,
            outfit: { hair: 'hair_bob', hairColor: 'hcol_pink' },
            outfitColor: { hair: 'c_mint' }, dyePerm: { hair: true } },
    expect: (S) => [
      S.itemColor.hair_bob === 'c_mint' || `고른 색을 옛 값이 덮었다 (${JSON.stringify(S.itemColor)})`,
    ],
  },
  {
    // 염색이 **칸에서 옷으로** 옮겨 간 판이다. 옮겨 주지 않으면 어제까지 보던
    // 색이 오늘 원래 색으로 돌아간다 — 화면에는 아무 오류도 안 뜬다
    name: '세이브 10 (염색이 칸에 붙어 있던 시절)',
    save: { ver: 10, name: '염색', nameClaimed: true, tutorialDone: true,
            outfit: { glove: 'glove_knit', shoes: 'shoes_flat_plain' },
            outfitColor: { glove: 'c_cherry', shoes: 'c_mint' },
            dyePerm: { glove: true },
            dyeUntil: { shoes: Date.now() + 3600000 },
            unlocked: ['c_mint'] },
    expect: (S) => [
      S.itemColor.glove_knit === 'c_cherry' || `영원 염색이 안 옮겨졌다 (${JSON.stringify(S.itemColor)})`,
      S.dyeForever.glove_knit === true || '영원 염색이 24시간짜리로 잡혔다',
      S.itemColor.shoes_flat_plain === 'c_mint' || '마법 염색이 안 옮겨졌다',
      (S.dyeEnd.shoes_flat_plain > Date.now()) || `마법 염색의 남은 시간이 사라졌다 (${S.dyeEnd.shoes_flat_plain})`,
      !S.dyeForever.shoes_flat_plain || '24시간짜리가 영원 염색으로 바뀌었다',
      // 옮긴 뒤에는 옛 칸이 남아 있으면 안 된다 — 남으면 다음 판에서 또 옮긴다
      !S.outfitColor && !S.dyeUntil && !S.dyePerm || '옛 칸 구조가 그대로 남았다',
      // **다른 장갑으로 갈아입으면 원래 색이어야 한다** (이게 고치려던 버그다)
      !S.itemColor.glove_wrist_cuff || '다른 장갑까지 물들었다',
    ],
  },
  {
    // ⚠️ **이 프로젝트에서 제일 위험한 마이그레이션이다.**
    // 크리처 매력이 「가진 것 전부(중복까지)」에서 「장착한 한 마리」로 바뀌었다.
    // 그냥 바꾸면 매력 총합이 내려가고, isMapOpen() 이 그 값을 보므로
    // **열려 있던 맵과 지대가 다시 잠긴다.** 유니콘 셋을 가진 사람은 −12 다.
    //
    // 옛 규칙 총합 = 비주얼 100 + 매력 100 + (나비 2 + 유니콘 6 × 3) = 220.
    // 옮겨 적기가 제대로 됐으면 불러온 뒤에도 **정확히 220** 이어야 한다.
    name: '세이브 11 (크리처 매력이 무한 누적이던 시절) — 총합도 열린 맵도 그대로',
    save: { ver: 11, name: '크리처', nameClaimed: true, tutorialDone: true,
            stats: { beauty: 100, charm: 100 },
            creatures: ['butterfly', 'unicorn', 'unicorn', 'unicorn'] },
    visit: 'showcase',
    // **약한 크리처로 바꿔 보고** 맵이 다시 잠기는지 화면 안에서 잰다
    probe: () => {
      const before = GameData.MAPS.filter(isMapOpen).length;
      setRoomPet('butterfly');
      const after = GameData.MAPS.filter(isMapOpen).length;
      const charmAfter = totalCharm();
      setRoomPet('unicorn');
      return { before, after, charmAfter };
    },
    expect: (S) => [
      S.__charm === 220 || `매력 총합이 달라졌다 (${S.__charm} — 220 이어야 한다)`,
      S.petRoom === 'unicorn' || `제일 센 크리처가 자동 장착되지 않았다 (${S.petRoom})`,
      // 잃는 만큼(나비2 + 유니콘 두 마리 12 = 14)을 stats.charm 으로 옮겨 적었는가
      S.stats.charm === 114 || `옮겨 적기가 틀렸다 (매력 ${S.stats.charm} — 114 여야 한다)`,
      (S.creatures || []).length === 4 || '가진 크리처가 사라졌다',
      S.charmPeak >= 220 || `해금 최고 기록이 안 채워졌다 (${S.charmPeak})`,
      // 약한 것으로 바꾸면 **총합은 내려가야 한다** (그게 고르는 맛이다)
      S.__probe.charmAfter === 216 || `애착을 바꿔도 총합이 안 변한다 (${S.__probe.charmAfter})`,
      // 그런데 **맵은 하나도 안 잠겨야 한다** — 해금은 최고 기록으로 판정하기 때문
      S.__probe.after >= S.__probe.before
        || `약한 크리처로 바꾸니 맵이 ${S.__probe.before - S.__probe.after}개 다시 잠겼다`,
    ],
  },
];

(async () => {
  const browser = await chromium.launch(launchOpts());
  const bad = [];

  for (const c of CASES) {
    if (process.env.V) console.error('· 시작', c.name);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const warns = [];
    page.on('console', m => { const t = m.text(); if (/load failed/i.test(t)) warns.push(t); });
    page.on('pageerror', e => warns.push('pageerror: ' + e.message));
    // 첫 로드 **전에** 심는다. reload 마다 다시 심으면 화면에서 바뀐 값이 지워진다
    await ctx.addInitScript((s) => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      if (!localStorage.getItem('__seeded')) {
        // s 가 null 이면 **아무것도 심지 않는다** (세이브 없는 새 플레이어)
        if (s) localStorage.setItem('dieter_alchemist_save_v1', s);
        else localStorage.removeItem('dieter_alchemist_save_v1');
        localStorage.setItem('__seeded', '1');
      }
    }, c.save === null ? null : JSON.stringify(c.save));

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (process.env.V) console.error('  goto 완료');
    // **S 는 최상위 `let` 이라 window.S 로는 안 보인다** (let/const 는 window 에 안 붙는다).
    // window.S 를 기다리면 영영 오지 않아 하네스가 통째로 멈춘다 — 어휘 이름으로 본다
    await page.waitForFunction(() => typeof S !== 'undefined' && !!window.GameData,
      null, { timeout: 15000 });
    // 그 화면에서만 도는 코드가 있는 경우 한 번 열어 본다 (예: 리그 정산)
    if (c.visit) {
      await page.evaluate((tab) => { if (typeof switchTab === 'function') switchTab(tab); }, c.visit);
      await page.waitForTimeout(300);
    }
    const S = await page.evaluate(() => {
      const out = JSON.parse(JSON.stringify(S));
      // 튜토리얼 막이 실제로 떠 있는지 (세이브 값만으로는 화면을 알 수 없다)
      const el = document.getElementById('tut');
      out.__tutOn = !!(el && el.classList.contains('on'));
      // **세이브 값만으로는 못 보는 것**이 있다 — 매력 총합처럼 계산해야 나오는 값,
      // 그리고 열린 맵 수. expect() 는 노드에서 도는 JSON 사본을 볼 뿐이라
      // 여기서 미리 재 둔다 (아래 probe 로 케이스마다 더 잴 수도 있다)
      out.__charm = typeof totalCharm === 'function' ? totalCharm() : null;
      out.__openMaps = typeof isMapOpen === 'function'
        ? GameData.MAPS.filter(isMapOpen).length : null;
      return out;
    });
    // 케이스가 화면 안에서 더 확인할 것이 있으면 여기서 잰다
    if (c.probe) S.__probe = await page.evaluate(c.probe);
    await ctx.close();
    if (process.env.V) console.error('· 끝', c.name);

    if (!S) { bad.push(`${c.name} · 세이브가 아예 안 올라왔다`); continue; }
    // load() 가 예외를 삼키면 화면에는 조용히 기본값이 뜬다 — 경고를 실패로 친다
    warns.forEach(w => bad.push(`${c.name} · ${w}`));
    if (S.ver !== undefined && S.ver < 1) bad.push(`${c.name} · 버전이 이상하다 (${S.ver})`);
    c.expect(S).forEach(r => { if (r !== true) bad.push(`${c.name} · ${r}`); });
  }

  await browser.close();
  console.log(`옛 세이브 ${CASES.length}가지를 심어 불러오기`);
  if (!bad.length) { console.log('✅ 진행이 그대로 살아남음'); process.exit(0); }
  console.log(`❌ ${bad.length}건`);
  bad.forEach(m => console.log('   ' + m));
  process.exit(1);
})().catch(e => { console.error('하네스 실패:', e); process.exit(2); });
