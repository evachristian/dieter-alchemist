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
      (S.discovered || []).includes('vitality') || '시작 레시피가 안 채워졌다',
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
      S.outfitColor.hair === 'c_blossom' || `머리색이 안 옮겨졌다 (${S.outfitColor.hair})`,
      S.dyePerm.hair === true || '옮긴 머리색이 24시간짜리로 잡혔다 (풀려 버린다)',
      (S.unlocked || []).includes('c_blossom') || '쓰고 있던 색인데 안 가진 것으로 남았다',
    ],
  },
  {
    name: '세이브 8 — 기본(브라운) 머리는 건드리지 않는다',
    save: { ver: 8, name: '브라운', nameClaimed: true, tutorialDone: true,
            outfit: { hair: 'hair_bob', hairColor: 'hcol_brown' } },
    expect: (S) => [
      !S.outfitColor.hair || `안 골랐던 사람에게 염색이 생겼다 (${S.outfitColor.hair})`,
    ],
  },
  {
    name: '세이브 8 — 이미 머리를 염색해 둔 사람은 덮어쓰지 않는다',
    save: { ver: 8, name: '이미', nameClaimed: true, tutorialDone: true,
            outfit: { hair: 'hair_bob', hairColor: 'hcol_pink' },
            outfitColor: { hair: 'c_mint' }, dyePerm: { hair: true } },
    expect: (S) => [
      S.outfitColor.hair === 'c_mint' || `고른 색을 옛 값이 덮었다 (${S.outfitColor.hair})`,
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
        localStorage.setItem('dieter_alchemist_save_v1', s);
        localStorage.setItem('__seeded', '1');
      }
    }, JSON.stringify(c.save));

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (process.env.V) console.error('  goto 완료');
    // **S 는 최상위 `let` 이라 window.S 로는 안 보인다** (let/const 는 window 에 안 붙는다).
    // window.S 를 기다리면 영영 오지 않아 하네스가 통째로 멈춘다 — 어휘 이름으로 본다
    await page.waitForFunction(() => typeof S !== 'undefined' && !!window.GameData,
      null, { timeout: 15000 });
    const S = await page.evaluate(() => JSON.parse(JSON.stringify(S)));
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
