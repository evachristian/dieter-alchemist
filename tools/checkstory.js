// 2~5막을 **진짜 화면에서 처음부터 끝까지 걸어 본다** (QUEST.md · STORY.md).
//
// `checktalk` 은 표만 보고, `checkask` 는 키워드만 본다. 여기서 보는 것은
// **퀘스트가 이야기를 따라 실제로 열리고 끝나는가**다:
//
//   · 조건(`need`)이 차면 칩이 «저절로» 뜨는가 — 매력이 오를 때까지 안 기다리는가
//   · 목표가 «상태형»이라 이미 이룬 것에서도 안 막히는가
//   · 완료 컷씬이 돌고 보상이 들어오는가 (장 · 결정 · 재료)
//   · **q_seal 이 공방을 5단계로 올려 엔딩 조건을 채우는가**
//     ⚠️ 이것이 없던 동안 `roomLevel` 은 개발용 스위치로만 올라갔다 —
//     만들어 놓은 엔딩에 **정상 플레이로는 아무도 못 닿는** 상태였다
//   · 에필로그를 본 뒤에 5막 퀘스트가 오는가
//
// ⚠️ 진행이 막히는 버그는 화면에 **아무 오류도 안 띄운다.** 사람은 그냥 그만둔다.
//
// 사용: node tools/checkstory.js      (종료 코드 0 = 통과)
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
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify({
      ver: 8, name: '테스터', nameClaimed: true, tutorialDone: true,
    }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  // 1막은 여기서 볼 것이 아니다 — **다 끝낸 사람**으로 세워 놓고 시작한다.
  // ⚠️ 매력은 넉넉히 올려 둔다. 2막부터의 관문은 매력이 아니라 이야기라는 것이
  // 이 검사의 전제이고, 매력이 모자라서 안 열리면 그 전제부터 틀린 것이 된다
  await page.evaluate(() => {
    S.tutorialDone = true;
    S.charmPeak = 200;
    S.crystal = 0;
    S.quest = { active: null, n: 0, done: D.QUESTS.filter(q => q.act === 1).map(q => q.id), queue: [] };
    S.seenCuts = D.CUTS.filter(c => c.act === 1).map(c => c.id);
    S.keywords = ['kw_hunger'];
    S.villages = [];
    S.bond = {};
    refreshQuests(); render();
  });

  // 컷씬을 **끝까지 눌러서** 넘긴다 (건너뛰지 않는다 — 대사가 다 있는지도 같이 본다)
  const walkCut = async () => {
    for (let i = 0; i < 12; i++) {
      const st = await page.evaluate(() => {
        const el = document.getElementById('cutScene');
        if (!el || el.hidden) return null;
        const t = (document.getElementById('cutText').textContent || '').trim();
        cutNext();
        return t;
      });
      if (st === null) break;
      if (!st || /^c_[a-z_]+_\d+$/.test(st)) return `대사가 비었다 (${st})`;
      await page.waitForTimeout(40);
    }
    return null;
  };

  // 이야기를 한 걸음 민다 — 그 사람에게 그 키워드를 «실제로» 물어본다
  const ask = async (npc, kw) => {
    await page.evaluate(([n, k]) => { doAsk(n, k); }, [npc, kw]);
    await page.waitForTimeout(80);
  };
  const now = () => page.evaluate(() => {
    const q = activeQuest();
    return q ? { id: q.id, n: questProgress(q), max: q.goal.n, full: questFull(q) } : null;
  });
  // 완료 → (컷씬) → 보상. 컷씬을 다 넘긴 뒤 한 번 더 눌러야 보상이 들어온다
  const claim = async () => {
    await page.evaluate(() => claimQuest());
    await page.waitForTimeout(60);
    const bad = await walkCut();
    await page.evaluate(() => claimQuest());
    await page.waitForTimeout(80);
    return bad;
  };

  // ── 2막 ──────────────────────────────────────────────────────
  // 호감도 3단계에서 「유리관」이 나온다. 여기서는 그 앞을 다시 걷지 않고
  // 키워드를 손에 쥐여 준 다음, **퀘스트가 저절로 오는지**만 본다
  ok(!(await now()), '1막을 다 끝낸 자리에서는 할 퀘스트가 없다', JSON.stringify(await now()));
  // ⚠️ **키워드를 손으로 꽂아 놓고 `refreshQuests()` 를 직접 부르면 안 된다.**
  // 그러면 「물어봤더니 칩이 떴다」가 아니라 「검사기가 칩을 띄웠다」를 재는 것이라,
  // `doAsk` 에서 새로고침을 통째로 지워도 통과한다 (사보타주로 확인했다).
  // 실제 경로 그대로 — **오릭스와 3단계 친해진 뒤 「사과」를 물어** 「유리관」을 얻는다
  // 「사과」까지 오는 길(노래 → 사과)은 `checkask` 가 이미 걷는다. 여기서는 거기까지를
  // 손에 쥐여 주되, **그 뒤부터는 전부 진짜로 물어본다.**
  // 「아름다움」은 부엌에서 나온다 — 3막에서 여왕에게 가져갈 것이라 여기서 받아 둔다
  await page.evaluate(() => {
    S.bond.sp_orix = D.BOND_TIERS[3].at;
    S.keywords.push('kw_apple');
    render();
  });
  await ask('sp_clemen', 'kw_hunger');
  ok(await page.evaluate(() => S.keywords.includes('kw_beauty')),
    '부엌에서 「아름다움」을 얻는다');
  await ask('sp_orix', 'kw_apple');
  ok(await page.evaluate(() => S.keywords.includes('kw_glass')),
    '오릭스에게 「사과」를 물어 「유리관」을 얻는다');
  let q = await now();
  ok(q && q.id === 'q_glass', '「유리관」을 얻자마자 2막 퀘스트가 온다', q && q.id);
  ok(q && !q.full, 'q_glass 는 아직 0/1 이다', q && `${q.n}/${q.max}`);

  await ask('sp_sylvan', 'kw_glass');
  q = await now();
  ok(q && q.full, '호수를 찾아내면 q_glass 가 완료로 바뀐다', q && `${q.n}/${q.max}`);
  let cutBad = await claim();
  ok(!cutBad, 'q_glass 완료 컷씬의 대사가 다 있다', cutBad || '');
  const gotGlass = await page.evaluate(() => ({
    crystal: S.crystal, pages: S.discovered.length, mist: (S.inventory || {}).mist_drop || 0 }));
  ok(gotGlass.crystal >= 180, 'q_glass 보상 — 현자의 결정이 들어왔다', `${gotGlass.crystal}`);
  ok(gotGlass.mist >= 8, 'q_glass 보상 — 재료가 들어왔다', `안개방울 ${gotGlass.mist}`);
  q = await now();
  ok(q && q.id === 'q_mine', '이어서 q_mine 이 온다', q && q.id);

  await ask('sp_orix', 'kw_glass');            // 갱도가 열리고 「불로장생」을 준다
  q = await now();
  ok(q && q.full, '갱도를 찾아내면 q_mine 이 완료로 바뀐다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_mine 완료 컷씬의 대사가 다 있다', cutBad || '');
  q = await now();
  ok(q && q.id === 'q_life', '「불로장생」을 얻어 q_life 가 온다', q && q.id);

  // 조합 여섯 — **이벤트형이라 받은 뒤부터 센다**
  await page.evaluate(() => { for (let i = 0; i < 6; i++) questBump('brew'); });
  q = await now();
  ok(q && q.full, '물약 여섯을 만들면 q_life 가 찬다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_life 완료 컷씬의 대사가 다 있다', cutBad || '');

  // ── 3막 ──────────────────────────────────────────────────────
  q = await now();
  ok(q && q.id === 'q_spire', '3막 q_spire 가 온다', q && q.id);
  await ask('sp_stark', 'kw_life');            // 첨탑이 열린다
  q = await now();
  ok(q && q.full, '첨탑이 열리면 q_spire 가 찬다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_spire 완료 컷씬의 대사가 다 있다', cutBad || '');

  q = await now();
  ok(q && q.id === 'q_self', '첨탑에 닿아 q_self 가 온다', q && q.id);
  await ask('sp_ygritte', 'kw_beauty');        // 여왕이 「진짜 나」를 흘린다
  q = await now();
  ok(q && q.full, '「진짜 나」를 얻으면 q_self 가 찬다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_self 완료 컷씬의 대사가 다 있다', cutBad || '');

  // ── 4막 — **엔딩에 닿을 수 있는가** ────────────────────────────
  q = await now();
  ok(q && q.id === 'q_seal', '4막 q_seal 이 온다', q && q.id);
  const before = await page.evaluate(() => ({ room: S.roomLevel, seal: sealReady() }));
  ok(!before.seal, '공방을 올리기 전에는 봉인 조건이 «안» 찬다', `방 ${before.room}단계`);
  // ⚠️ **q_life 의 보상으로 이미 무쇠가 열 개 있다.** 「0이 되는가」로 재면 그 열 개
  // 때문에 실패하는데, 그건 게임이 아니라 검사가 틀린 것이다 — 「스무 개가 줄었는가」로 잰다
  const ironBefore = await page.evaluate(() => { addInv('iron_ore', 20); renderQuestChip();
    return (S.inventory || {}).iron_ore || 0; });
  q = await now();
  ok(q && q.full, '무쇠 스무 개를 모으면 q_seal 이 찬다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_seal 완료 컷씬의 대사가 다 있다', cutBad || '');
  const after = await page.evaluate(() => ({
    room: S.roomLevel, max: roomMax(), seal: sealReady(), iron: (S.inventory || {}).iron_ore || 0 }));
  ok(after.room >= after.max, 'q_seal 이 공방을 마지막 단계로 올린다', `${after.room}/${after.max}`);
  ok(after.seal, '⭐ 엔딩 조건(sealReady)이 정상 플레이로 찬다', `방 ${after.room}단계`);
  ok(ironBefore - after.iron === 20, '갖다준 무쇠 스무 개가 소모된다',
    `${ironBefore} → ${after.iron}`);

  // ── 5막 — 에필로그를 본 뒤에만 ────────────────────────────────
  q = await now();
  ok(!q, '엔딩을 보기 전에는 5막 퀘스트가 «안» 뜬다', q && q.id);
  await page.evaluate(() => { playCut('c_epilogue'); });
  await walkCut();
  await page.waitForTimeout(80);
  q = await now();
  ok(q && q.id === 'q_table', '에필로그를 보면 5막 퀘스트가 온다', q && q.id);
  await page.evaluate(() => { for (let i = 0; i < 5; i++) questBump('kitchen'); });
  q = await now();
  ok(q && q.full, '다섯 밤을 같이 먹으면 q_table 이 찬다', q && `${q.n}/${q.max}`);
  cutBad = await claim();
  ok(!cutBad, 'q_table 완료 컷씬의 대사가 다 있다', cutBad || '');
  const done = await page.evaluate(() => S.quest.done.length);
  ok(done === (await page.evaluate(() => D.QUESTS.length)),
    '열다섯 퀘스트가 모두 끝났다', `${done}개`);

  ok(!errs.length, '콘솔 오류 없음', errs[0] || '');
  await browser.close();

  console.log(out.join('\n'));
  console.log(failed ? `\n❌ ${failed}건` : '\n2~5막 진행 검사 전부 통과 ✅');
  process.exit(failed ? 1 : 0);
})();
