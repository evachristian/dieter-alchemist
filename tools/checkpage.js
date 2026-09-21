// 비법서 «흘림» — 조합에 성공할 때마다 세고 `D.PAGE_DRIP` 회마다 한 장.
//
// ⚠️ **여기서 재는 것의 핵심은 「한 번에 한 장인가」와 「천장을 안 앞지르는가」다.**
//   · `D.PAGE_DRIP` 회를 채워야 한 장이 오는가 (그 앞에서는 한 장도 안 온다)
//   · 온 장이 **천장 안**인가 (새싹인데 중급 물약이 오면 안 된다)
//   · **천장에 막히면 카운터를 안 쓰는가** ← 밀림을 허용하면 단계가 오르는 순간
//     밀린 몫이 여러 장 한꺼번에 터져, 이 기획이 고치려던 그 문제가 되돌아온다
//   · 토스트가 «이름»을 부르는가 (「새 장이 6장 늘었어요」를 고친 자리다)
//   · 단계가 올라도 그 자리에서는 **한 장도 안 오는가** (천장만 오른다)
//
// ⚠️ **요율·천장을 이 파일에 옮겨 적지 않는다** — `D.PAGE_DRIP` · `D.PAGE_TIERS`
// 를 읽는다. 사본을 만들면 수치를 고쳤을 때 검사기만 옛 값으로 남는다.
//
// 사용: node tools/checkpage.js      (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

const out = [];
let failed = 0;
function ok(cond, msg, extra) {
  out.push(`  ${cond ? 'OK ' : '❌ '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1',
      JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  // 한 판을 «진짜 버튼»으로 젓는다. ⚠️ 재료를 딱 한 벌만 넣어 두면 개수 패널이
  // 안 뜬다 (두 개 이상 만들 수 있을 때만 묻는다 — 뜨면 막이 기다려 멈춘다)
  const brewOnce = async () => {
    await page.evaluate(() => {
      S.inventory = { berry: 1, herb: 1 };
      S.energy = 9000; S.cauldron = [];
      switchTab('atelier'); fillFromRecipe('vitality');
    });
    await page.click('button[onclick="brew()"]');
    await page.waitForTimeout(120);
    await page.evaluate(() => { const m = document.querySelector('.modal.show'); if (m) m.classList.remove('show'); });
  };

  // ── ① 천장에 막히면 카운터를 «안 쓴다» ────────────────────────
  //
  // 새싹(매력 0)에서 열려 있는 것은 기초 물약 여섯 장뿐이고 그것은 시작 밑천이라
  // 이미 다 가지고 있다 — 즉 **꺼낼 것이 없는** 상태다. 여기서 세기 시작하면
  // 꽃봉오리가 되는 순간 밀린 몫이 한꺼번에 터진다
  const stuck = await page.evaluate(() => {
    S.discovered = D.PAGE_TIERS[0].reduce((a, sp) => a.concat(D.pagesForSpec(sp)), []);
    // ⚠️ `S.stats` 를 «갈아 끼우지» 않는다 — `charm` 칸이 사라져 `totalCharm()` 이
    // NaN 이 되고, 그러면 천장이 무슨 값을 넣어도 0 으로 굳는다 (한 번 겪었다)
    S.stats.beauty = 0; S.stats.charm = 0;
    S.petRoom = null; S.petField = null; S.creatures = []; S.charmPeak = 0;
    S.pageDrip = 0; S.quest = { active: null, n: 0, done: [], queue: [] };
    return { tier: capTier(), pages: S.discovered.length, next: nextFlowPage() };
  });
  ok(stuck.tier === 0 && stuck.next === null,
     '새싹에서는 꺼낼 장이 없다 (천장이 기초 물약까지다)',
     `천장 ${stuck.tier}단계 · 가진 장 ${stuck.pages} · 다음 장 ${stuck.next || '없음'}`);

  const blocked = await page.evaluate(() => {
    const before = S.discovered.length;
    flowPages(D.PAGE_DRIP * 3);                // 넉넉히 돌려 본다
    return { drip: S.pageDrip, grew: S.discovered.length - before };
  });
  ok(blocked.drip === 0 && blocked.grew === 0,
     '   …막힌 동안은 카운터가 «안» 오른다 (밀림이 0이다)',
     `카운터 ${blocked.drip} · 늘어난 장 ${blocked.grew}`);

  // ── ② 천장이 오르면 «한 장씩» 나온다 ─────────────────────────
  const opened = await page.evaluate(() => {
    S.stats.beauty = 500;                      // 꽃봉오리 위로 올린다
    S.charmPeak = totalCharm();
    return { tier: capTier(), next: nextFlowPage() };
  });
  ok(opened.tier >= 1 && !!opened.next,
     '천장이 오르면 꺼낼 장이 생긴다', `천장 ${opened.tier}단계 · 다음 장 ${opened.next}`);

  const burst = await page.evaluate(() => {
    const before = S.discovered.length;
    flowPages(1);                              // 밀림이 있었다면 여기서 터진다
    return S.discovered.length - before;
  });
  ok(burst === 0, '   …천장이 오른 «그 자리»에서는 한 장도 안 쏟아진다 (밀림이 없었다)',
     `늘어난 장 ${burst}`);

  // ── ③ 조합 `PAGE_DRIP` 회에 «정확히 한 장» ───────────────────
  //
  // ⚠️ **카운터를 0 에서 세운다.** 앞 검사가 한 번 흘려 놓은 채로 재면
  // 「3회째에 왔다」로 엉뚱하게 실패한다 (실제로 그랬다)
  await page.evaluate(() => { S.pageDrip = 0; });
  const drip = await page.evaluate(() => D.PAGE_DRIP);
  const seq = [];
  for (let i = 0; i < drip; i++) {
    const before = await page.evaluate(() => S.discovered.length);
    await brewOnce();
    const after = await page.evaluate(() => S.discovered.length);
    seq.push(after - before);
  }
  const early = seq.slice(0, drip - 1).reduce((a, b) => a + b, 0);
  ok(early === 0, `조합 ${drip - 1}회까지는 한 장도 안 온다`, `늘어난 장 ${seq.slice(0, drip - 1).join('+')}`);
  ok(seq[drip - 1] === 1, `   …${drip}회째에 «한 장» 온다`, `${drip}회째 ${seq[drip - 1]}장`);

  // ── ④ 온 장이 «천장 안»이다 ──────────────────────────────────
  const inside = await page.evaluate(() => {
    const top = capTier();
    const flow = D.pageFlow();
    const over = S.discovered.filter(id => {
      const p = flow.find(x => x.id === id);
      return p && p.tier > top;
    });
    return { top, over };
  });
  ok(!inside.over.length, '   …천장 위의 장은 한 장도 안 왔다',
     inside.over.slice(0, 3).join(' · ') || `천장 ${inside.top}단계`);

  // ── ⑤ 토스트가 «이름»을 부른다 ───────────────────────────────
  //
  // 「📖 비법서에 새 장이 6장 늘었어요」를 고친 자리다. 숫자만 뜨면 무엇을
  // 받았는지가 화면 어디에도 안 나온다 — 이 기획의 출발점이다
  const said = await page.evaluate(async () => {
    // ⚠️ 토스트 요소를 «지우지» 않는다 — `toast()` 가 쓰는 `#toast` 한 칸이라
    // 지우면 그 자리에서 터진다 (그렇게 짰다가 콘솔 오류로 잡혔다). 비우기만 한다
    document.getElementById('toast').textContent = '';
    const id = nextFlowPage();
    S.pageDrip = D.PAGE_DRIP - 1;              // 다음 한 번에 나오게 세워 둔다
    const got = flowPages(1);
    pageToast(got, 0);
    await new Promise(r => setTimeout(r, 300));
    const txt = document.getElementById('toast').textContent;
    return { id, name: pageName(id), txt };
  });
  ok(said.txt.includes(said.name),
     '들어온 장을 «이름»으로 알린다', `${said.txt.trim() || '(아무 말도 없다)'} · 「${said.name}」 기대`);

  // ── ⑥ 매력이 올라도 그 자리에서는 장이 «안» 온다 ─────────────
  //
  // 예전에는 단계가 오르는 자리가 곧 장이 오는 자리라, 뮤즈가 되는 순간
  // 중급 물약 **50장**이 한꺼번에 들어왔다
  const onTier = await page.evaluate(() => {
    S.stats.beauty = 4000;                     // 단계를 통째로 올린다
    const before = S.discovered.length;
    checkUnlocks();
    return { grew: S.discovered.length - before, tier: capTier() };
  });
  ok(onTier.grew === 0, '단계가 올라도 그 자리에서는 장이 안 온다 (천장만 오른다)',
     `천장 ${onTier.tier}단계 · 늘어난 장 ${onTier.grew}`);

  // ── ⑦ 퀘스트 몫은 흘림이 «먼저» 안 준다 ──────────────────────
  //
  // 흘림을 끝까지 돌려도 퀘스트 열일곱 장이 **맨 마지막**에 와야 한다.
  // 먼저 오면 퀘스트를 깼을 때 빈손이 된다
  const order = await page.evaluate(() => {
    const byQuest = new Set(D.QUESTS.map(q => (q.reward || {}).page).filter(Boolean));
    S.discovered = D.PAGE_TIERS[0].reduce((a, sp) => a.concat(D.pagesForSpec(sp)), []);
    S.pageDrip = 0;
    const seen = [];
    for (let i = 0; i < D.RECIPES.length * D.PAGE_DRIP + 10; i++) flowPages(1);
    S.discovered.forEach(id => { if (byQuest.has(id)) seen.push(id); });
    // 흘림이 준 차례에서 퀘스트 몫이 «앞»에 끼어 있는가
    const idx = S.discovered.map(id => byQuest.has(id));
    const firstQ = idx.indexOf(true);
    const tailOnly = firstQ >= 0 && idx.slice(firstQ).every(Boolean);
    return { total: S.discovered.length, quest: seen.length, firstQ, tailOnly, all: D.RECIPES.length };
  });
  ok(order.total === order.all, '흘림만으로도 결국 136장이 다 나온다 (막다른 길이 아니다)',
     `${order.total} / ${order.all}장`);
  ok(order.quest > 0 && order.tailOnly,
     '   …퀘스트 몫 열일곱은 «맨 뒤»에 온다 (먼저 오면 퀘스트가 빈손이 된다)',
     `퀘스트 몫 ${order.quest}장 · ${order.firstQ + 1}번째부터 끝까지`);

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('── 비법서 흘림');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n비법서 흘림 검사 전부 통과 ✅');
})();
