// 키워드 대화를 **진짜 화면에서 끝까지 걸어 본다** (STORY.md 「키워드 시스템」).
//
// `checktalk.js` 는 표만 본다 — 표가 맞아도 화면에서 안 눌리면 아무 소용이 없다.
// 여기서 보는 것:
//   · 마을 셋이 전부 잠긴 채로 시작하는가 (부엌 말고는 갈 데가 없다)
//   · 부엌 칩 → 일곱 굴뚝이 열리는가
//   · 마을 안에서 칩을 눌러 대답이 «말풍선에» 뜨는가
//   · 사슬 끝까지 걸어 다섯이 다 열리는가 (도중에 둘로 갈린다)
//   · 다시 물어도 되고, **주는 것은 한 번뿐인가**
//   · 새로 물어볼 것이 있는 마을 탭에 점(●)이 뜨는가 — 「길 잃음 방지」
//   · **아직 안 물어본 칩의 우상단에 점이 뜨는가** (이미 물어본 것·잠긴 것에는 안 뜬다)
//   · **부엌 점이 밥을 먹으면 꺼지는가** — 마을이 열린 뒤에는 「오늘 밥」만 뜻한다
//
// 사용: node tools/checkask.js      (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
// 미리 깔려 있는 크로미움이 있으면 그것을 쓴다 (checktut·checkui 와 같은 규칙)
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
  // 인트로를 건너뛰고 시작한다 (여기서 볼 것이 아니다 — checkui·checktut 과 같은 규칙)
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    // ⚠️ **이미 있으면 안 덮어쓴다.** 덮어쓰면 새로고침 검사가 스스로 세이브를 지워
    // 「안 남았다」가 나온다 (게임이 아니라 검사기의 잘못이다 — 실제로 그랬다)
    if (!localStorage.getItem('dieter_alchemist_save_v1'))
      localStorage.setItem('dieter_alchemist_save_v1',
        JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  // ⚠️ **부팅을 «기다려서» 본다** — 고정 시간만 두면 느린 날 `S` 가 아직 없어
  // 바로 아래 `page.evaluate` 가 `ReferenceError` 로 통째로 터진다.
  // `S` 는 최상위 `let` 이라 `window.S` 로는 안 보인다 — **이름으로 찾는다**
  // (아래 새로고침 자리와 같은 규칙이다)
  await page.waitForFunction(
    () => typeof S !== 'undefined' && typeof render === 'function',
    null, { timeout: 20000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  // 떠 있는 장면을 **끝까지 넘기고** 줄마다 「누가 · 무슨 말」을 모아 온다.
  //
  // ⚠️ **`cutNext()` 를 부르는 것으로는 못 가른다** — 화면이 안 떠도 그냥 지나간다.
  // 그래서 **떠 있는 동안만** 돌고, 한 줄도 못 읽었으면 빈 배열이 나온다 (그때 실패한다).
  // ⚠️ 장면이 안 닫히는 사고를 대비해 한계를 둔다 — 검사기가 멈추면 무엇이 틀렸는지
  // 결과에 안 남는다 (`checkrock` 에서 배운 자리다)
  async function playThrough() {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const on = await page.evaluate(() => {
        const el = document.getElementById('cutScene');
        if (!el || el.hidden) return null;
        return { who: (document.getElementById('cutWho').textContent || '').trim(),
                 text: (document.getElementById('cutText').textContent || '').trim() };
      });
      if (!on) break;
      out.push(on);
      await page.evaluate(() => cutNext());
      await page.waitForTimeout(50);
    }
    return out;
  }

  // 부엌이 열려 있어야 이야기가 시작된다.
  // ⚠️ `c_meet_in` 을 본 것으로 두는 것이 곧 **셰프가 왔다**(`chefHired`)이다 —
  // 그것이 부엌을 연다. 나오는 컷씬 둘도 같이 심어 둔다 (여기서 볼 것이 아니다)
  await page.evaluate(() => {
    S.tutorialDone = true;
    S.name = '테스트';
    S.seenCuts = ['c_clemen_meet', 'c_meet_in', 'c_meet_out'];
    save(); render();
  });

  // ── 시작 상태 — **첫 키워드는 첫 퀘스트가 준다**
  //
  // ⚠️⚠️ 한때 「정신적 허기」가 `defaultState` 의 기본값이라 **튜토리얼을 막 마친
  // 화면에서 부엌에 이미 물어볼 것이 하나 떠 있었다** — 아직 클레멘을 만나지도 않았는데.
  // 지금은 「부엌에서 같이 먹기」를 끝내야 들어온다. **빈손인 쪽도 재야 한다**:
  // 「받은 뒤」만 재면 순서가 뒤집혀도 통과한다
  let st = await page.evaluate(() => ({ kw: S.keywords.slice(), vl: S.villages.slice() }));
  ok(st.kw.length === 0, '첫 퀘스트 «전»에는 키워드가 하나도 없다', st.kw.join(',') || '(없음)');
  ok(st.vl.length === 0, '마을은 전부 잠겨 있다', `열린 곳 ${st.vl.length}`);
  ok(await page.evaluate(() => { const q = activeQuest(); return q && q.id; }) === 'q_meet',
     '첫 퀘스트가 「셰프를 고용했어요」로 서 있다');

  await page.evaluate(() => openKitchen());
  await page.waitForSelector('#kitchenSheet.show', { timeout: 4000 });
  ok(await page.$$eval('#kitchenSheet .ask-chip', els => els.length) === 0,
     '그때 부엌에는 물어볼 칩이 하나도 없다');
  ok(!!(await page.$('#kitchenSheet .ask-none')), '대신 「아직 물어볼 것이 없어요」가 선다');

  // ── 부엌 버튼의 점(●) — **두 가지를 뜻하는 자리다**
  //
  // 원래 뜻은 「오늘 밥」이고, 마을이 **하나도 안 열렸을 때만** 「물어볼 것」도 같이 켠다.
  // 겹쳐 두면 물어본 대답이 다음 키워드를 줘서 **밥을 먹어도 점이 영영 안 꺼진다** —
  // 실제로 「다 먹었는데 레드닷이 안 사라진다」로 신고받은 자리다.
  const kdot = () => page.evaluate(() => !document.getElementById('kitchenDot').hidden);
  ok(await kdot(), '밥 전에는 점이 켜져 있다');
  await page.evaluate(() => { eatWithClemen(); });

  // ── 첫 퀘스트를 낸다 → 그 보상이 「정신적 허기」다
  ok(await page.evaluate(() => questFull(activeQuest())), '한 번 같이 먹으면 첫 퀘스트가 찬다');
  await page.evaluate(() => { claimQuest(); });
  await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ kw: S.keywords.slice(), done: (S.quest.done || []).slice() }));
  ok(st.done.includes('q_meet'), '첫 퀘스트가 끝난다');
  ok(st.kw.length === 1 && st.kw[0] === 'kw_hunger',
     '그 보상으로 「정신적 허기」가 들어온다', st.kw.join(',') || '(없음)');

  await page.evaluate(() => { openKitchen(); });
  await page.waitForSelector('#kitchenSheet.show .ask-chip', { timeout: 4000 });
  ok(await kdot(), '마을이 하나도 없으면 밥을 먹어도 점이 남는다 (갈 곳이 여기뿐이다)');
  let chips = await page.$$eval('#kitchenSheet .ask-chip', els => els.map(e => e.textContent.trim()));
  ok(chips.length === 1 && chips[0].includes('허기'), '부엌 칩은 가진 것 하나뿐', chips.join(' / '));
  ok(chips[0].includes('🆕'), '아직 안 물어본 것에 🆕 가 붙는다');

  await page.click('#kitchenSheet .ask-chip');
  await page.waitForTimeout(120);
  // ⚠️ **대답은 이제 «컷씬»이다** — 공주가 묻고, 그 사람이 답한다.
  // 끝까지 넘겨야 `doAsk` 의 뒷정리(새 키워드·마을 토스트)가 돈다
  // ⚠️ **줄 수를 검사기에 박지 않는다** — 대답마다 다르다(`more`). 표에서 읽는다
  const wantN = await page.evaluate(() => {
    const a = D.ASKS.find(x => x.npc === 'sp_clemen' && x.kw === 'kw_hunger');
    return 2 + ((a.more || []).length);
  });
  let scene = await playThrough();
  ok(scene.length === wantN, '대답이 여러 줄짜리 «대화»로 돈다', `${scene.length}줄 (${wantN} 기대)`);
  ok(wantN > 2, '이어지는 줄이 실제로 붙어 있다 — 한 줄로 끝나지 않는다', `${wantN}줄`);
  ok(scene[0].text.includes('허기'), '공주가 «그 키워드»를 짚어 묻는다', (scene[0].text || '').slice(0, 24));
  ok(scene[0].who !== scene[1].who, '묻는 사람과 답하는 사람이 다르다',
     `${scene[0].who} → ${scene[1].who}`);
  // **말이 오간다** — 그 사람만 계속 떠드는 것이 아니라 공주가 중간에 끼어든다.
  // ⚠️ 이것이 없으면 「여러 줄」이 그냥 «긴 대답»과 구별이 안 된다
  ok(new Set(scene.map(s => s.who)).size === 2, '두 사람이 번갈아 말한다',
     scene.map(s => s.who).join(' → '));
  ok(scene.every(s => s.text && !/^ak_|^ask_/.test(s.text)),
     '어느 줄도 열쇠 이름이 새지 않는다', scene.map(s => s.text.slice(0, 8)).join(' / '));
  let said = scene[1].text;
  ok(said.includes('일곱 굴뚝'), '클레멘이 그 자리에서 답한다', said.slice(0, 24));
  st = await page.evaluate(() => ({ kw: S.keywords.slice(), vl: S.villages.slice() }));
  ok(st.vl.includes('vl_chimney'), '일곱 굴뚝이 열린다');
  // ⚠️ **한 줄이 「키워드 + 마을」을 같이 주지 않는다** (2막에서 정한 규칙을 1막에도).
  // 예전에는 이 줄이 「아름다움」까지 같이 줘서 **첫 줄 하나로 이야기가 두 칸 갔다** —
  // 아름다움은 굴뚝에 가서 오릭스에게 받는다
  ok(st.kw.length === 1 && !st.kw.includes('kw_beauty'),
     '그 줄은 «마을만» 연다 — 키워드는 안 늘어난다', st.kw.join(','));
  // 마을이 열리면 안내는 **마을 탭의 점**이 맡는다 → 부엌 점은 「오늘 밥」만 뜻한다.
  // ⚠️ **여기서 `render()` 를 부르지 않는다.** `doAsk` 가 스스로 뱃지를 다시 그리는지를
  // 보는 자리라, 먼저 그려 주면 안 그려도 통과한다 (실제로 켜진 채 남아 있었다)
  ok(!(await kdot()), '마을이 열리고 밥도 먹었으면 점이 그 자리에서 꺼진다');
  // 다음 날 — 밥으로만 켜졌다 꺼진다
  await page.evaluate(() => { S.kitchenDay = 0; render(); });
  ok(await kdot(), '다음 날 밥 전에는 다시 켜진다');
  await page.evaluate(() => { eatWithClemen(); });
  ok(!(await kdot()), '밥을 먹으면 꺼진다');

  chips = await page.$$eval('#kitchenSheet .ask-chip', els => els.map(e => e.textContent.trim()));
  ok(chips.length === 1, '부엌 칩은 그대로 하나다 (아름다움은 굴뚝에서 받는다)', chips.join(' / '));
  ok(!chips.find(c => c.includes('허기')).includes('🆕'), '물어본 것은 🆕 가 사라진다 (칩은 남는다)');

  // **다시 물어도 되지만 주는 것은 한 번뿐이다**
  const before = await page.evaluate(() => S.keywords.length);
  await page.click('#kitchenSheet .ask-chip');
  await page.waitForTimeout(120);
  ok((await playThrough()).length === wantN, '다시 물어도 장면은 그대로 돈다');
  ok(await page.evaluate(() => S.keywords.length) === before, '다시 물어도 키워드가 두 번 안 들어온다');

  await page.evaluate(() => closeKitchen());

  // ── 1막 사슬의 «속도 문» — 그 퀘스트를 끝내야 열린다 (`need.quest` · data.js 의 ASKS 머리말)
  //
  // ⚠️⚠️ **끝낸 것으로 심기 «전»에 잠겨 있는지 먼저 본다.** 그냥 심고 지나가면
  // **문을 아무 데나 옮겨도 통과한다** — 호감도 문턱을 「3」으로 박아 두었다가 겪은
  // 그 사고와 같은 종류다. 지금은 ① 그 앞에서는 잠겨 있고 ② 그 퀘스트를 끝내면
  // 풀리는지를 **문 일곱에서 전부** 본다.
  // ⚠️ 퀘스트는 «끝낸 것으로 심는다» — 여기서 볼 것은 퀘스트 진행이 아니라 **문**이다
  // (퀘스트를 진짜로 걷는 것은 `checkstory`·`checkbond` 의 몫이다)
  let gateN = 0;
  const chipLocked = (kwName) => page.$$eval('#villageBody .ask-chip',
    (els, n) => { const e = els.find(x => x.textContent.includes(n)); return e ? e.classList.contains('locked') : null; }, kwName);
  async function openGate(village, spot, kwName, quest) {
    await page.evaluate(([v, s]) => { switchTab('gather'); setGatherTab('village'); setVillage(v); tapVillageSpot(v, s); },
      [village, spot]);
    await page.waitForSelector('#villageBody .ask-chip', { timeout: 2000 }).catch(() => {});
    const before = await chipLocked(kwName);
    ok(before === true, `「${kwName}」은 ${quest} 전에는 잠겨 있다`,
       before === null ? '칩이 아예 없다' : '');
    // ⚠️ **첫 문에서는 «눌러 본다».** 막기만 하면 버그로 읽히므로 `doAsk` 는
    // ① 키워드를 안 주고 ② **무엇을 하면 되는지** 말해 주고 ③ **퀘스트 시트로 데려간다**.
    // 잠금/해제만 재면 그 갈래는 한 줄도 안 도는데 화면은 멀쩡해 보인다
    if (!gateN) {
      await flushToasts();
      const kwBefore = await page.evaluate(() => S.keywords.length);
      await page.$$eval('#villageBody .ask-chip',
        (els, n) => els.find(x => x.textContent.includes(n)).click(), kwName);
      await page.waitForTimeout(160);
      const r = await page.evaluate(() => ({
        kw: S.keywords.length,
        sheet: !!document.querySelector('#questSheet.show'),
        cut: !document.getElementById('cutScene').hidden,
        tst: (document.getElementById('toast') || {}).textContent || '',
      }));
      ok(r.kw === kwBefore, '퀘스트로 잠긴 칩은 눌러도 키워드가 안 들어온다', `${kwBefore} → ${r.kw}`);
      ok(r.tst.includes(await page.evaluate(q => T(q + '_name'), quest)),
         '왜 안 되는지 말해 준다 — «어느 퀘스트»인지까지', r.tst.slice(0, 40));
      // 퀘스트 시트로 데려간다. ⚠️ 아직 안 본 인트로 컷씬이 있으면 그쪽이 먼저 뜬다 —
      // 둘 다 「그래서 뭘 하면 되는데」에 답하는 자리라 어느 쪽이든 맞다
      ok(r.sheet || r.cut, '퀘스트 시트(또는 그 컷씬)로 데려간다', `시트 ${r.sheet} · 컷씬 ${r.cut}`);
      await page.evaluate(() => {
        while (!document.getElementById('cutScene').hidden) cutNext();
        if (typeof closeQuest === 'function') closeQuest();
      });
      await page.waitForTimeout(120);
      await page.evaluate(([v, s2]) => { switchTab('gather'); setGatherTab('village'); setVillage(v); tapVillageSpot(v, s2); },
        [village, spot]);
      await page.waitForSelector('#villageBody .ask-chip', { timeout: 2000 }).catch(() => {});
    }
    await page.evaluate((q) => { questState().done.push(q); render(); }, quest);
    const after = await chipLocked(kwName);
    ok(after === false, `${quest} 를 끝내면 그 자리에서 풀린다`,
       after === null ? '칩이 사라졌다' : '');
    gateN++;
  }

  // **예약된 토스트를 다 흘려보낸다** — `doAsk` 는 새 키워드·새 마을 알림을
  // `setTimeout(…, 900 + i*700)` 으로 미뤄 두므로, 그냥 읽으면 **몇 단계 전의 말**을
  // 지금 누른 칩의 대답으로 착각한다 (실제로 그렇게 통과하고 있었다).
  // 토스트는 3초를 머무르고 사이 간격은 0.7초라, **1.2초 동안 한 번도 안 떴으면** 다 흘러간 것이다.
  // ⚠️ **한 곳에 둔다** — 두 벌로 두면 한쪽만 고쳐서 어긋난다
  async function flushToasts() {
    for (let t = 0, quiet = 0; t < 100; t++) {
      quiet = (await page.evaluate(() => document.getElementById('toast').classList.contains('show'))) ? 0 : quiet + 1;
      if (quiet >= 10) return true;
      await page.waitForTimeout(120);
    }
    return false;
  }

  // ── 마을 안에서 사슬을 끝까지
  async function askIn(village, spot, kwName) {
    await page.evaluate(([v, s]) => { switchTab('gather'); setGatherTab('village'); setVillage(v); tapVillageSpot(v, s); },
      [village, spot]);
    // **짧게 기다린다.** 사슬이 끊기면 이 자리는 영영 안 나타나는데, 기본 30초로 두면
    // 검사가 실패 대신 **멈춰 버린다** — 못 갔다는 사실이 결과에 안 나온다
    try { await page.waitForSelector('#villageBody .ask-chip', { timeout: 2000 }); }
    catch (e) { return null; }
    const idx = await page.$$eval('#villageBody .ask-chip',
      (els, n) => els.findIndex(e => e.textContent.includes(n)), kwName);
    if (idx < 0) return null;
    await page.$$eval('#villageBody .ask-chip', (els, i) => els[i].click(), idx);
    await page.waitForTimeout(120);
    // 마을에서도 대답은 **장면**이다.
    // ⚠️ **돌려줄 것은 «둘째 줄»이다** — 첫 줄은 공주의 질문이고, 뒤는 이어지는
    // 주고받음(`more`)이다. 마지막 줄을 돌려주면 그 사람의 «마무리»를 본 대답으로
    // 착각해 「오릭스가 유리관 이야기를 꺼낸다」 같은 줄이 통째로 어긋난다
    const sc = await playThrough();
    if (sc.length) askShape.push(sc.map(s => s.who));
    return sc.length > 1 ? sc[1].text : null;
  }
  // 마을에서 돈 장면들의 «모양» — 아래에서 한꺼번에 본다
  const askShape = [];

  // ⚠️ **「아름다움」은 이제 오릭스가 준다** — 클레멘의 첫 줄은 «마을만» 연다.
  // 굴뚝에 처음 들어서면 물을 수 있는 것은 「정신적 허기」 하나이고 그것도 잠겨 있다
  await openGate('vl_chimney', 'vs_chimney_forge', '허기', 'q_walk');
  let line = await askIn('vl_chimney', 'vs_chimney_forge', '허기');
  ok(line && line.includes('아름다움'), '오릭스가 「아름다움」을 넘겨 준다', (line || '').slice(0, 24));
  ok(await page.evaluate(() => S.keywords.includes('kw_beauty')), '「아름다움」을 얻는다');

  await openGate('vl_chimney', 'vs_chimney_forge', '아름다움', 'q_kitchen');

  // **칩 우상단의 레드닷** — 마을 탭·건물·부엌 버튼의 점과 같은 뜻이다.
  // ⚠️ **여기서 잰다** — 지금 오릭스에게 「허기」(이미 물어본 것)와 「아름다움」(새 것)이
  // 나란히 서 있다. 부엌에서 재던 자리인데, 첫 줄이 키워드를 안 주게 되면서 거기는
  // **칩이 하나뿐이라 «새 칩» 쪽을 한 번도 안 재는 자리**가 됐다.
  // ⚠️ **양쪽을 몇 개 쟀는지도 같이 낸다.** 한쪽이 0이면 그 방향은 아예 안 잰 것이라
  // 「0건」이 통과가 아니라 「재 본 적 없다」가 된다 (checkavatar 의 발등·부츠와 같은 규칙)
  const chipDots = await page.$$eval('#villageBody .ask-chip', els => els.map(e => ({
    fresh: e.classList.contains('fresh'),
    dot: !!e.querySelector(".tab-dot"),
    // 절대 배치라도 **가로로 삐져나오면** 칩이 줄 끝에 설 때 넘친다 (`__cardFits` 가 잡는다)
    over: e.scrollWidth - e.clientWidth,
  })));
  const chipFreshN = chipDots.filter(d => d.fresh).length, chipOldN = chipDots.length - chipFreshN;
  ok(chipFreshN > 0 && chipOldN > 0, '새 칩과 이미 물어본 칩을 «둘 다» 쟀다', `새 ${chipFreshN} · 물어본 것 ${chipOldN}`);
  ok(chipDots.filter(d => d.fresh).every(d => d.dot), '아직 안 물어본 칩에는 우상단에 점이 붙는다');
  ok(chipDots.filter(d => !d.fresh).every(d => !d.dot), '이미 물어본 칩에는 점이 없다');
  ok(chipDots.every(d => d.over <= 1), '점이 칩 밖으로 삐져나오지 않는다', `최대 ${Math.max(...chipDots.map(d => d.over))}px`);

  line = await askIn('vl_chimney', 'vs_chimney_forge', '아름다움');
  ok(line && line.includes('깎인'), '오릭스가 장면에서 답한다', (line || '').slice(0, 20));
  ok(await page.evaluate(() => S.keywords.includes('kw_gem')), '「광석」을 얻는다');
  await openGate('vl_chimney', 'vs_chimney_forge', '광석', 'q_bring');
  await askIn('vl_chimney', 'vs_chimney_forge', '광석');
  await openGate('vl_chimney', 'vs_chimney_forge', '여왕', 'q_egg');
  await askIn('vl_chimney', 'vs_chimney_forge', '여왕');
  ok(await page.evaluate(() => S.keywords.includes('kw_song')), '「노래」까지 이어진다');

  // 굴뚝의 여관 — 카이로스. **점이 여기 떠 있어야 한다** (아직 안 물어본 것이 있다)
  await page.evaluate(() => { setVillage('vl_chimney'); leaveSpot(); });
  await page.waitForSelector('#villageBody .vil-pin', { timeout: 2000 }).catch(() => {});
  const pinDot = await page.$$eval('#villageBody .vil-pin',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.vspot));
  ok(pinDot.includes('vs_chimney_inn'), '새로 물어볼 것이 있는 건물에 점이 뜬다', pinDot.join(','));

  await openGate('vl_chimney', 'vs_chimney_inn', '노래', 'q_soup');
  await askIn('vl_chimney', 'vs_chimney_inn', '노래');
  await askIn('vl_chimney', 'vs_chimney_inn', '독사과');
  ok(await page.evaluate(() => S.villages.includes('vl_apple')), '붉은 사과밭이 열린다');

  await openGate('vl_apple', 'vs_apple_empty', '독사과', 'q_sip');
  await askIn('vl_apple', 'vs_apple_empty', '독사과');
  await askIn('vl_apple', 'vs_apple_empty', '저주');
  ok(await page.evaluate(() => S.villages.includes('vl_mirror')), '거울 골짜기가 열린다');

  line = await askIn('vl_mirror', 'vs_mirror_pond', '저주');
  ok(line && line.includes('모르겠'), '유타르크는 저주에 「모르겠다」고 한다', (line || '').slice(0, 20));

  // ── 여기서 사슬이 둘로 갈린다 — 사냥꾼 쉼터 · 가시덤불 마을
  await openGate('vl_mirror', 'vs_mirror_pond', '여왕', 'q_bloom');
  await askIn('vl_mirror', 'vs_mirror_pond', '여왕');
  ok(await page.evaluate(() => S.keywords.includes('kw_order')), '「암살 의뢰」를 얻는다');
  await askIn('vl_chimney', 'vs_chimney_inn', '암살 의뢰');
  ok(await page.evaluate(() => S.villages.includes('vl_hunter')), '사냥꾼 쉼터가 열린다');

  line = await askIn('vl_hunter', 'vs_hunter_lodge', '아름다움');
  ok(line && line.includes('살아 있는'), '슈타르크는 「살아 있는 것」이라 답한다', (line || '').slice(0, 20));
  await askIn('vl_hunter', 'vs_hunter_lodge', '여왕');
  ok(await page.evaluate(() => S.keywords.includes('kw_prince')), '「왕자」를 얻는다');
  await askIn('vl_chimney', 'vs_chimney_forge', '왕자');
  ok(await page.evaluate(() => S.villages.includes('vl_thorn')), '가시덤불 마을이 열린다');

  line = await askIn('vl_thorn', 'vs_thorn_barrack', '아름다움');
  ok(line && line.includes('나 같은'), '발렌은 「나 같은 거지」라고 답한다', (line || '').slice(0, 20));

  // ── 가까워져야 나오는 말 (호감도)
  //
  // ⚠️ **자물쇠는 감추지 않고 보여 준다.** 안 보이면 「없는 것」이고, 보이면
  // 「아직 못 여는 것」이다 — 코지 게임에서 갈 곳을 알려 주는 쪽이 낫다.
  // 그 대신 **길잡이 점(●)에는 안 센다** — 점을 따라갔는데 못 여는 것뿐이면 점이 거짓말이 된다
  await page.evaluate(() => { switchTab('gather'); setGatherTab('village');
    setVillage('vl_chimney'); tapVillageSpot('vl_chimney', 'vs_chimney_forge'); });
  await page.waitForSelector('#villageBody .ask-chip', { timeout: 2000 });
  let lockTxt = await page.$$eval('#villageBody .ask-chip.locked', els => els.map(e => e.textContent.trim()));
  ok(lockTxt.length === 1 && lockTxt[0].includes('🔒'), '아직 못 여는 대답은 🔒 로 보인다 (감추지 않는다)',
     lockTxt.join(' / '));
  ok(lockTxt[0] && lockTxt[0].includes('독사과'), '그것이 「독사과」 줄이다', lockTxt.join(' / '));
  // ⚠️ 자물쇠가 통째로 사라졌으면 **여기서 죽지 말고 그렇다고 알린다** —
  // 크래시는 「무엇이 틀렸나」를 안 알려 준다 (checklore 에서 배운 것과 같다)
  const dimmed = lockTxt.length ? await page.$eval('#villageBody .ask-chip.locked',
    e => getComputedStyle(e).filter.includes('saturate')) : false;
  ok(dimmed, '잠긴 콘텐츠 공통 표현(saturate)을 쓴다');
  // ⚠️ **잠긴 칩에는 점이 없다** — 길잡이 점이 「못 여는 것」을 가리키면 거짓말이 된다
  // (바로 아래 `asksNew` 가 안 센다는 것과 같은 규칙이고, 화면 쪽이 이것이다)
  ok(lockTxt.length ? await page.$eval('#villageBody .ask-chip.locked',
       e => !e.querySelector(".tab-dot")) : false, '잠긴 칩에는 점이 안 붙는다');

  let kwN = await page.evaluate(() => S.keywords.length);
  // ⚠️ **앞 단계가 «예약해 둔» 토스트를 먼저 흘려보낸다.** `doAsk` 는 새 키워드·새 마을
  // 알림을 `setTimeout(…, 900 + i*700)` 으로 미뤄 두는데(대답을 읽기 전에 덮지 않으려는
  // 것이다), 그것이 지금 누를 칩의 토스트를 **나중에 덮어쓴다** — 실제로 여기서 읽히던
  // 것은 몇 단계 전의 「거울 골짜기로 가는 길이 열렸어요!」였다.
  // 옛 검사가 `tst.length > 0` 으로 통과하고 있던 이유가 그것이다 (아무 글자나 있으면 됐다).
  // 토스트는 3초를 머무르고 사이 간격은 0.7초라, **1.2초 동안 한 번도 안 떴으면** 다 흘러간 것이다
  const drained = await flushToasts();
  ok(drained, '앞 단계의 예약 토스트가 다 흘러갔다 (안 그러면 남의 말을 읽는다)');
  // 자물쇠가 없으면 그 자리의 칩을 그냥 누른다 — 「막혔는가」는 그래도 재야 한다
  await page.$$eval('#villageBody .ask-chip',
    els => (els.find(e => e.classList.contains('locked')) ||
            els.find(e => e.textContent.includes('독사과')) || els[0]).click());
  // ⚠️ **기다리지 않고 바로 읽는다.** 잠긴 갈래는 동기라 이미 떠 있고, 기다리면
  // 다음 예약 토스트가 들어올 틈만 준다
  const tst = await page.$eval('#toast', e => e.classList.contains('show') ? e.textContent.trim() : '');
  await page.waitForTimeout(80);
  ok(await page.evaluate(() => S.keywords.length) === kwN, '눌러도 키워드가 안 들어온다');
  ok(!(await page.evaluate(() => S.keywords.includes('kw_glass'))), '「유리관」은 아직 없다');
  // ⚠️ **「무슨 말이든 떴는가」로 재면 안 된다.** 예전에는 `tst.length > 0` 이 뒤에
  // 붙어 있어서 **무슨 글자가 떠도 통과**했다 — 「스스로 맞는 검사」다.
  // 모자란 것은 호감도이고 **몇 단계**가 모자란지가 그 문장의 알맹이라, 그 이름을 본다
  const tierNm = await page.evaluate(() => {
    const a = D.ASKS.find(x => x.npc === 'sp_orix' && x.kw === 'kw_apple');
    const t = D.BOND_TIERS[D.askNeedBond(a)];
    return N(t.id, t.name);
  });
  ok(tst.includes(tierNm), '왜 안 되는지 말해 준다 — 몇 단계가 모자란지까지',
     `${tierNm} · ${tst.slice(0, 40)}`);
  // ⚠️ **말해 주는 것만으로는 부족하다.** 호감도는 물약을 «선물»해야 오르는데
  // 매력은 물약을 «마셔서» 오르므로 **둘이 서로 다른 동작**이고, 그 연결이 화면
  // 어디에도 안 적혀 있었다 (`PLAYFLOW.md` 8장). 그래서 **그 사람의 선물 시트를 연다**
  const gift = await page.evaluate(() => {
    const m = document.getElementById('giftSheet');
    return { show: !!(m && m.classList.contains('show')),
             npc: typeof giftNpc === 'undefined' ? null : giftNpc,
             need: (document.querySelector('#giftBody .gift-need') || {}).textContent || '' };
  });
  ok(gift.show && gift.npc === 'sp_orix', '잠긴 칩을 누르면 그 사람의 선물 시트가 열린다',
     `show ${gift.show} · ${gift.npc}`);
  ok(gift.need.trim().length > 0, '시트가 다음 단계까지 남은 점수를 적어 준다',
     gift.need.trim().slice(0, 30));
  // 열어 둔 채로 두면 뒤의 단계가 시트에 막힌다
  await page.evaluate(() => closeGift());
  await page.waitForTimeout(60);
  // 길잡이 점은 잠긴 것을 안 센다
  ok(await page.evaluate(() => asksNew('sp_orix')) === 0, '잠긴 것은 길잡이 점에 안 센다');

  // 호감도를 올린다 (물약을 선물해 오르는 값이다 — 여기서는 값만 심는다).
  //
  // ⚠️ **단계를 «3» 으로 박아 두지 않는다.** 예전에는 그렇게 써 있었는데, 표를
  // 어느 값으로 내려도 3 이면 늘 풀려서 **문턱을 아무 데나 옮겨도 통과했다.**
  // 표에서 읽어 **바로 한 칸 아래에서는 잠겨 있고, 그 단계에서 풀리는지**를 본다 —
  // 문턱 «그 자리»를 재야 표를 고쳤을 때 이 검사가 따라온다
  const need = await page.evaluate(() =>
    D.askNeedBond(D.ASKS.find(a => a.npc === 'sp_orix' && a.kw === 'kw_apple')));
  ok(need >= 1, '「독사과」에 호감도 문턱이 걸려 있다', `${need}단계`);
  // 한 칸 아래 — **문턱의 바로 앞**까지 올려도 아직 잠겨 있어야 한다
  await page.evaluate((n) => { S.bond.sp_orix = D.BOND_TIERS[n].at - 1; save();
    tapVillageSpot('vl_chimney', 'vs_chimney_forge'); }, need);
  await page.waitForTimeout(80);
  ok(await page.$$eval('#villageBody .ask-chip.locked', els => els.length) === 1,
     '문턱 한 점 앞까지는 아직 잠겨 있다',
     `${await page.evaluate(() => bondOf('sp_orix'))}점`);
  await page.evaluate((n) => { S.bond.sp_orix = D.BOND_TIERS[n].at; save();
    tapVillageSpot('vl_chimney', 'vs_chimney_forge'); }, need);
  await page.waitForTimeout(80);
  ok(await page.$$eval('#villageBody .ask-chip.locked', els => els.length) === 0,
     '그 단계가 되면 자물쇠가 풀린다',
     await page.evaluate((n) => D.BOND_TIERS[n].name, need));
  ok(await page.evaluate(() => asksNew('sp_orix')) === 1, '풀린 순간 길잡이 점이 켜진다');
  line = await askIn('vl_chimney', 'vs_chimney_forge', '독사과');
  ok(line && line.includes('유리'), '오릭스가 유리관 이야기를 꺼낸다', (line || '').slice(0, 24));
  ok(await page.evaluate(() => S.keywords.includes('kw_glass')), '「유리관」을 얻는다');

  // ── 탭의 점 — 다 물어보고 나면 꺼진다
  await page.evaluate(() => { leaveSpot(); });
  await page.waitForSelector('#villageTabs .cat-tab', { timeout: 2000 }).catch(() => {});
  let dots = await page.$$eval('#villageTabs .cat-tab',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.village));
  ok(dots.length > 0, '아직 안 물어본 마을 탭에 점이 있다', dots.join(','));

  // ── 윗단 «마을» 갈래의 점 — 안쪽 점이 하나라도 있으면 켜진다
  // ⚠️ 안쪽(마을 탭·건물)에만 찍으면 «필드»에 서 있는 사람에게는 아예 안 보인다 —
  // 갈 곳을 알려 주는 점이 갈 곳에 들어가야만 보이면 뜻이 없다
  const gtDots = () => page.$$eval('.gt-tabs .room-tab',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.gtab));
  let gt = await gtDots();
  ok(gt.includes('village'), '안쪽에 점이 있으면 윗단 «마을» 갈래에도 점이 뜬다', gt.join(',') || '(없음)');
  ok(!gt.includes('field') && !gt.includes('farm'), '필드·밭 갈래에는 안 붙는다', gt.join(',') || '(없음)');
  // ⚠️⚠️ **`I18N.apply()` 를 «그리기 없이» 불러 본다.** 그 함수는 `data-i18n` 요소의
  // `textContent` 를 통째로 갈아 끼우므로, 라벨을 버튼에 바로 달아 두면 점이 **그 자리에서
  // 사라진다** — 지금은 `setLang` 도 부팅도 곧바로 `render()` 를 부르기 때문에 그 사고가
  // 안 보일 뿐이다. `setLang('en')` 으로 재면 **다시 그려져서** 무엇을 해 놔도 통과한다
  // (그렇게 짰다가 사보타주가 그대로 지나갔다). 그리기를 빼야 구조가 재진다
  await page.evaluate(() => { I18N.apply(); });
  await page.waitForTimeout(60);
  gt = await gtDots();
  ok(gt.includes('village'), '다시 그리지 않아도 점이 살아 있다 (라벨이 안쪽 span 이다)',
     gt.join(',') || '(없음)');

  // 남은 것을 전부 물어본다
  await page.evaluate(() => {
    D.ASKS.forEach(a => { if (S.keywords.includes(a.kw)) doAsk(a.npc, a.kw); });
    leaveSpot();
  });
  await page.waitForTimeout(120);
  dots = await page.$$eval('#villageTabs .cat-tab',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.village));
  ok(dots.length === 0, '다 물어보면 점이 꺼진다', dots.join(','));
  // ⚠️ **켜지는 것만 재면 「끄는 줄」을 빼도 통과한다** — 안 꺼지는 점은 거짓말이다
  gt = await gtDots();
  ok(!gt.includes('village'), '다 물어보면 윗단 «마을» 갈래의 점도 꺼진다', gt.join(',') || '(없음)');

  // ── 새로고침해도 남는가 (세이브)
  // ⚠️ **저장이 끝난 것을 보고 나서 새로고침한다.** 그냥 기다렸다 새로고침했더니
  // 아주 가끔 아직 안 써진 상태로 다시 읽어 **「세이브가 통째로 날아갔다」**로 보였다
  // (kw 1 · talked 0 — 기본값 그대로). 검사기가 거짓으로 빨개지는 자리다
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('dieter_alchemist_save_v1');
      if (!raw) return false;
      const p = JSON.parse(raw);
      return Array.isArray(p.villages) && p.villages.length >= 8
        && Array.isArray(p.talked) && p.talked.length >= 40;
    } catch (e) { return false; }
  }, { timeout: 10000 });
  await page.reload({ waitUntil: 'load' });
  // ⚠️ **고정 시간으로 기다리지 않는다.** 1200ms 뒤에 읽었더니 아주 가끔 아직
  // `load()` 전이라 `S` 가 기본값이었고, 그 순간을 「세이브가 통째로 날아갔다」
  // (kw 1 · talked 0)로 읽었다 — 게임이 아니라 검사기가 거짓으로 빨개지는 자리다.
  // `.catch` 를 붙여 **진짜로 안 살아났을 때는 기다리다 죽지 말고** 아래에서
  // 제대로 실패하게 둔다 (그래야 무엇이 몇 개인지가 결과에 찍힌다)
  //
  // ⚠️ **`window.S` 로 기다리면 안 된다 — 영영 안 온다.** `game.js` 의 `S` 는 최상위
  // `let` 이라 **`window` 에 안 붙는다** (`escHtml` 에서 배운 것과 같고, `checksave.js`
  // 에도 같은 주석이 있다). 그렇게 써 놓고 「막아 뒀다」고 적어 두었더니 이 기다림은
  // **10초를 그냥 흘려보내는 죽은 코드**였고, 그 10초가 넉넉한 날만 통과했다 —
  // 「네 번에 한 번쯤 거짓으로 빨개진다」로 신고받은 자리다. **전역은 «이름»으로 찾는다.**
  //
  // ⚠️ **볼 값 «그대로» 기다린다.** 옛 조건(`S.villages.length > 0`)은 부팅 도중
  // 잠깐 서 있는 «덜 찬 상태»도 통과시켜, 막았다 해도 같은 순간을 읽을 수 있었다
  const revived = await page.waitForFunction(
    () => typeof S !== 'undefined'
       && (S.villages || []).length >= 8 && (S.talked || []).length >= 40,
    null, { timeout: 15000 }).then(() => true).catch(() => false);
  // 실패했을 때 **게임이 잃은 것인지 검사기가 일찍 읽은 것인지**를 가르려고
  // 그 순간의 localStorage 도 같이 낸다 (「무엇이 몇 개인지가 결과에 찍힌다」)
  st = await page.evaluate(() => {
    const has = typeof S !== 'undefined';
    let ls;
    try {
      const p = JSON.parse(localStorage.getItem('dieter_alchemist_save_v1') || 'null');
      ls = p ? `ver ${p.ver} · 마을 ${(p.villages || []).length} · 물어본 것 ${(p.talked || []).length}`
             : '세이브 없음';
    } catch (e) { ls = '세이브가 깨졌다'; }
    return { has, ls, kw: has ? S.keywords.length : -1, vl: has ? S.villages.slice() : [],
      tk: has ? S.talked.length : -1, sl: has && S.keywords.includes('kw_seal') };
  });
  const why = revived ? '' : ` · 15초를 기다려도 안 살아났다 (S ${st.has ? '있음' : '없음'} · localStorage ${st.ls})`;
  // 다섯 → 일곱(2막) → **여덟**(3막). 「유리관」 하나가 문을 둘 열고
  // (실반은 «어디», 오릭스는 «누가»), 「불로장생」을 슈타르크에게 가져가면 첨탑이 열린다 —
  // 그는 원래 그녀가 고용한 암살자라 성 안을 아는 유일한 사람이다
  ok(st.vl.length === 8, '연 마을 여덟이 세이브에 남는다', st.vl.join(',') + why);
  // 열넷 중 열셋 — **못 얻는 것은 「엄마의 봉인」 하나뿐**이고, 그것이 맞는 상태다.
  // 카이로스·발렌의 호감도가 있어야 나오는데 여기서 올린 것은 오릭스 하나다.
  // 「불로장생」은 오릭스의 유리관 대답이, 「진짜 나」는 첨탑에서 여왕이 바로 준다
  // ⚠️ 물어본 것이 40 → **41** 이 된 것은 1막 사슬에 줄이 하나 늘었기 때문이다
  // (「오릭스 + 정신적 허기 → 아름다움」 · 클레멘의 첫 줄에서 옮겨 온 마디)
  ok(st.kw === 13 && st.tk === 41, '키워드 13 · 물어본 것 41 이 남는다', `kw ${st.kw} · talked ${st.tk}${why}`);
  ok(!st.sl, '호감도를 안 올린 사람의 말은 아직 안 들었다 (봉인)');

  // ── 마을에서 돈 장면들도 **대화**인가
  //
  // ⚠️ 부엌 하나만 재면 「그 한 줄만 여러 줄이고 나머지 마흔여섯은 그대로」여도
  // 통과한다 — 몇 개를 쟀는지를 같이 낸다 (한쪽이 0이면 그 방향은 안 잰 것이다)
  ok(askShape.length >= 5, '마을에서도 장면을 여러 번 쟀다', `${askShape.length}개`);
  ok(askShape.every(s => s.length >= 3), '마을의 대답도 여러 줄이다',
     `제일 짧은 것 ${Math.min(...askShape.map(s => s.length))}줄`);
  ok(askShape.every(s => new Set(s).size === 2), '마을에서도 두 사람이 번갈아 말한다',
     (askShape.find(s => new Set(s).size !== 2) || []).join(' → ') || '전부 둘');

  // ⚠️ **문을 몇 개 쟀는지 표와 견준다** — 새 문을 붙이고 검사를 안 늘리면
  // 「0건」이 통과가 아니라 「그 문은 한 번도 안 쟀다」가 된다 (이 저장소의 단골 구멍이다)
  const gateTotal = await page.evaluate(() => D.ASKS.filter(a => D.askNeedQuest(a)).length);
  ok(gateN === gateTotal, '퀘스트 문을 «다» 재 봤다', `${gateN} / ${gateTotal}`);

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('── 키워드 대화');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n키워드 대화 검사 전부 통과 ✅');
})();
