// 튜토리얼을 처음부터 끝까지 **진짜 마우스로** 눌러 본다.
//
// checkUI 는 '그 화면이 읽히는가' 를 보고, 이쪽은 '그 화면을 통과할 수 있는가' 를 본다.
// 튜토리얼은 새 플레이어가 반드시 지나는 외길이라 **한 자리만 막혀도 게임을 시작조차
// 못 한다.** 눈으로는 확인할 수 없다 — 열여덟 단계를 매번 손으로 눌러 볼 수는 없다.
//
// 보는 것:
//   · 인트로가 끝나는 자리에서 튜토리얼이 이어받는가 (인트로 위에 겹치지 않는가)
//   · 열여덟 단계가 끝까지 진행되는가 (막다른 자리가 없는가)
//   · 구멍 안은 진짜로 눌리는가       — 아래 버튼이 클릭을 받는가
//   · 구멍 밖은 진짜로 안 눌리는가     — 막이 정말 막는가
//   · 구멍이 대상 **위에 정확히** 있는가 — 여백(PAD) 안에서 어긋나도 눌리기는 한다
//   · 팝업이 떴을 때 그 팝업이 눌리는가 — 막이 팝업 위를 덮으면 화면이 죽는다
//   · 끝나면 tutorialDone 이 켜지고 잠겼던 것들이 열리는가
//
// **el.click() 을 쓰면 안 된다.** 그것은 pointer-events 를 무시하므로 막이 뚫려
// 있는지 없는지를 전혀 검사하지 못한다 — 반드시 page.mouse.click 으로 누른다.
// 막의 칠해진 자리인지는 path.isPointInFill() 로 판정한다 (pointer-events 설정과 무관하다).
//
// 사용: node tools/checktut.js   (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';
const W = Number(process.env.W) || 390;
const H = Number(process.env.H) || 780;

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

// 튜토리얼이 구멍을 뚫을 만한 것들. 여기 없는 것을 대상으로 삼는 단계가 생기면
// '구멍 안에서 누를 것을 못 찾았다' 로 잡힌다 — 그때 이 목록에 더한다.
const CLICKABLE = '.tab-btn, .room-tab, .recipe-row, .cauldron-actions .btn-primary,'
  + ' .potion-card, .btn-gather, .bag-toggle, .ing-chip, .wr-item';

(async () => {
  const browser = await chromium.launch(launchOpts());
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => {
    // 폰트·파비콘 같은 바깥 자원은 이 검사와 무관하다 (오프라인 환경에서 늘 실패한다)
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('[console] ' + m.text());
  });

  // **진짜 첫 실행에서 시작한다** — 인트로부터 본다. 튜토리얼은 인트로가 끝나는
  // 자리에서 이어받게 되어 있고, 그 이음매가 이 검사의 첫 항목이다.
  // 이름만 미리 넣어 둔다 (이름 입력 팝업은 이 검사의 대상이 아니다).
  // ver 는 최신으로 — 그래야 마이그레이션이 '옛 세이브' 로 보고 튜토리얼을 꺼 버리지 않는다.
  await page.addInitScript(() => {
    localStorage.removeItem('dieter_alchemist_intro_seen_v1');
    localStorage.setItem('dieter_alchemist_save_v1',
      JSON.stringify({ ver: 10, name: 'Tester', nameClaimed: true }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });

  const bad = [];
  {
    const during = await page.evaluate(() => ({
      playing: window.Intro ? Intro.isPlaying() : false,
      tutOn: document.getElementById('tut').classList.contains('on'),
      berry: (S.inventory || {}).berry || 0,
    }));
    if (!during.playing) bad.push('첫 실행인데 인트로가 안 떴다');
    // 인트로(z 9990)가 튜토리얼(z 60)보다 위라 겹쳐도 눈에 안 띈다 — 그래서 여기서 본다
    if (during.tutOn) bad.push('인트로가 도는 동안 튜토리얼 막이 떴다');
    if (during.berry) bad.push('인트로 도중에 첫 재료 주머니가 들어왔다');
    await page.evaluate(() => Intro.skip());
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => ({
      playing: Intro.isPlaying(),
      tutOn: document.getElementById('tut').classList.contains('on'),
      berry: (S.inventory || {}).berry || 0, herb: (S.inventory || {}).herb || 0,
    }));
    if (after.playing) bad.push('인트로가 안 끝났다');
    if (!after.tutOn) bad.push('인트로가 끝났는데 튜토리얼이 이어받지 않았다');
    if (after.berry !== 1 || after.herb !== 1) bad.push('첫 재료 주머니가 안 왔다');
  }

  // ── 튜토리얼 도중에 팝업이 뜨면 (설정 · 확인 패널)
  //
  // 조합 결과 팝업은 아래 흐름에서 저절로 뜨지만, 이 둘은 **닫을 때 render() 를
  // 부르지 않는다** — 막이 스스로 돌아오지 못하면 안내가 통째로 사라진 채 남는다.
  // 첫 단계에서 한 번만 본다 (진행을 건드리지 않는 자리다).
  {
    const on = () => page.evaluate(() => document.getElementById('tut').classList.contains('on'));
    for (const [name, open, btn] of [
      ['설정', () => page.evaluate(() => openSettings()), '#settingsModal .set-x'],
      ['확인 패널', () => page.evaluate(() => showConfirm('검사', () => {})), '#confirmModal .btn-ghost'],
    ]) {
      if (!(await on())) { bad.push(`${name} 검사 전에 막이 안 떠 있다`); break; }
      await open();
      await page.waitForTimeout(320);
      if (await on()) bad.push(`${name}: 팝업 위에 튜토리얼 막이 남아 있다 — 팝업을 누를 수 없다`);
      const hit = await page.evaluate((sel) => {
        const e = document.querySelector(sel);
        if (!e) return { err: '닫기 버튼이 없다' };
        const r = e.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const t = document.elementFromPoint(x, y);
        return { x, y, covered: !(t === e || e.contains(t)),
                 by: t ? (t.id || t.getAttribute('class') || t.tagName) : 'null' };
      }, btn);
      if (hit.err) { bad.push(`${name}: ${hit.err}`); continue; }
      if (hit.covered) bad.push(`${name}: 닫기 버튼이 ${hit.by} 에 덮여 있다`);
      await page.mouse.click(hit.x, hit.y);
      await page.waitForTimeout(520);
      if (!(await on())) bad.push(`${name}: 팝업을 닫았는데 튜토리얼 막이 돌아오지 않는다`);
      await page.evaluate(() => document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')));
      await page.waitForTimeout(200);
    }
  }

  const info = () => page.evaluate(() => {
    const el = document.getElementById('tut');
    return {
      on: !!(el && el.classList.contains('on')),
      loose: !!(el && el.classList.contains('loose')),
      step: S.tut.step, beat: S.tut.beat, done: S.tut.done,
      line: ((el && el.querySelector('.tut-line')) || {}).textContent || '',
      act: ((el && el.querySelector('.tut-act')) || {}).textContent || '',
      dots: el ? el.querySelectorAll('.tut-dot').length : 0,
      more: !!(el && el.querySelector('.tut-more')),
      tab: window.currentTab,
    };
  });

  // 말풍선의 '다음' 을 진짜로 눌러 대사를 끝까지 넘긴다
  async function readAll(log) {
    for (let i = 0; i < 16; i++) {
      const a = await info();
      if (!a.on || !a.more) return a;
      if (log && !log.seen.has(a.step)) { log.seen.add(a.step); log.push(a); }
      const box = await page.evaluate(() => {
        const r = document.querySelector('#tut .tut-more').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(140);
      const b = await info();
      if (b.step === a.step && b.beat === a.beat) return b;
    }
    return info();
  }

  // 막이 정말 막는가 — 막의 칠해진 자리에 있는 탭 버튼을 진짜로 눌러 본다
  async function blockedCheck() {
    const st = await info();
    if (!st.on || st.loose) return null;
    const target = await page.evaluate(() => {
      const path = document.querySelector('#tut .tut-hole');
      if (!path || !path.isPointInFill) return null;
      for (const b of document.querySelectorAll('.tab-btn')) {
        const r = b.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;                 // 숨겨진 탭은 제외
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        // 칠해진 자리 = 막혀 있어야 하는 자리 (구멍은 칠이 빠져 있다)
        if (path.isPointInFill(new DOMPoint(x, y))) return { x, y, tab: b.dataset.tab };
      }
      return null;
    });
    if (!target) return null;
    const before = st.tab;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(160);
    const after = (await info()).tab;
    return after !== before ? `막힌 자리(${target.tab})가 눌렸다 — ${before} → ${after}` : null;
  }

  // 구멍이 대상 위에 **정확히** 뚫려 있는가.
  //
  // 눌리는지만 보면 못 잡는다 — 여백이 8px 있어서 그만큼 어긋나도 한가운데는 여전히
  // 뚫려 있다. 실제로 화면이 페이드 인 하는 동안(`.screen` 이 translateY(6px) 로 밀려
  // 있을 때) 잰 구멍이 **끝까지 6px 어긋난 채로 남아 있었고**, 검사는 통과로 보였다.
  //
  // 막의 칠을 이분법으로 더듬어 네 변의 자리를 재고 대상 + PAD 와 비교한다.
  // 모서리가 둥글기 때문에 각 변의 **한가운데**에서만 더듬는다.
  const EDGE_TOL = 1.5;
  async function alignCheck() {
    return page.evaluate((tol) => {
      const layer = document.getElementById('tut');
      const path = layer.querySelector('.tut-hole');
      const sels = (window.Tut && Tut.targets) ? Tut.targets() : [];
      if (!path || !path.isPointInFill || !sels.length) return null;
      const PAD = Tut.PAD;
      const box = layer.getBoundingClientRect();
      const filled = (x, y) => path.isPointInFill(new DOMPoint(x, y));
      // 뚫린 곳(from) ↔ 칠해진 곳(to) 사이의 경계
      const edge = (from, to, at, horiz) => {
        let a = from, b = to;
        for (let i = 0; i < 24; i++) {
          const m = (a + b) / 2;
          if (filled(horiz ? m : at, horiz ? at : m)) b = m; else a = m;
        }
        return (a + b) / 2;
      };
      const out = [];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const L = r.left - box.left, R = r.right - box.left;
        const T = r.top - box.top, B = r.bottom - box.top;
        const cx = (L + R) / 2, cy = (T + B) / 2;
        if (filled(cx, cy)) { out.push(`${sel}: 한가운데가 안 뚫렸다`); continue; }
        const REACH = PAD + 24;
        const sides = [
          ['위',   () => edge(cy, T - REACH, cx, false), T - PAD, () => filled(cx, T - REACH)],
          ['아래', () => edge(cy, B + REACH, cx, false), B + PAD, () => filled(cx, B + REACH)],
          ['왼',   () => edge(cx, L - REACH, cy, true),  L - PAD, () => filled(L - REACH, cy)],
          ['오른', () => edge(cx, R + REACH, cy, true),  R + PAD, () => filled(R + REACH, cy)],
        ];
        let measured = 0;
        for (const [name, get, want, reachable] of sides) {
          // 그 방향이 화면 밖이거나 옆에 다른 구멍이 붙어 있으면 잴 수 없다 (건너뛴다)
          if (!reachable()) continue;
          measured++;
          const got = get();
          if (Math.abs(got - want) > tol)
            out.push(`${sel}: 구멍 ${name}쪽이 ${(got - want).toFixed(1)}px 어긋났다`);
        }
        if (!measured) out.push(`${sel}: 구멍 경계를 한 변도 잴 수 없었다`);
      }
      return out.length ? out : null;
    }, EDGE_TOL);
  }

  // 구멍 안의 눌러야 할 것을 진짜 마우스로 누른다
  async function doAct() {
    const target = await page.evaluate((sel) => {
      const layer = document.getElementById('tut');
      const path = layer.querySelector('.tut-hole');
      for (const c of document.querySelectorAll(sel)) {
        const r = c.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (path && path.isPointInFill && path.isPointInFill(new DOMPoint(x, y))) continue;  // 막혀 있다
        const top = document.elementFromPoint(x, y);
        if (!top || layer.contains(top)) continue;             // 말풍선이 덮고 있다
        if (c === top || c.contains(top)) return { x, y, what: c.className.slice(0, 28) };
      }
      return null;
    }, CLICKABLE);
    if (!target) return null;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(340);
    return target.what;
  }

  const lines = [];
  const log = { seen: new Set(), push: (st) => lines.push(
    `  ${String(st.step).padStart(2)} · 닷${st.dots} · ${st.line.slice(0, 22)}${st.act ? ' → ' + st.act : ''}`) };

  let guard = 0, lastSig = '', same = 0;
  while (guard++ < 80) {
    const st = await readAll(log);
    if (!st.on || st.done) break;
    if (!log.seen.has(st.step)) { log.seen.add(st.step); log.push(st); }
    const sig = st.step + ':' + st.beat;
    // 같은 단계를 여러 번 해야 하는 자리가 있다 (두 번 채집 · 재료 두 개 담기)
    same = (sig === lastSig) ? same + 1 : 0;
    if (same >= 4) { bad.push(`${st.step}단계에서 더 진행되지 않는다 — 막다른 자리다`); break; }
    lastSig = sig;
    if (st.loose) bad.push(`${st.step}단계: 구멍 대상을 못 찾았다 (막이 클릭을 막지 않는 상태)`);

    const b = await blockedCheck();
    if (b) bad.push(`${st.step}단계: ${b}`);

    const mis = await alignCheck();
    if (mis) mis.forEach(m => bad.push(`${st.step}단계: ${m}`));

    const did = await doAct();

    // ── 조합 결과 팝업 — **진짜 마우스로 닫는다**
    //
    // 예전에는 closeBrewModal() 을 직접 불러서 닫았는데, 그러면 막이 팝업을 덮고
    // 있어도 검사가 통과한다. 실제로 그랬다: 막(z 60)이 팝업(z 50)보다 위에 있어서
    // 「확인」이 눌리지 않았고, 플레이어에게는 **화면 전체가 먹통이 된 것**으로 보였다.
    if (await page.evaluate(() => !!document.querySelector('#brewModal.show'))) {
      const top = await page.evaluate(() => {
        const btn = document.querySelector('#brewModal .btn-primary');
        if (!btn) return { err: '확인 버튼이 없다' };
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const el = document.elementFromPoint(x, y);
        return { x, y, covered: !(el === btn || btn.contains(el)),
                 by: el ? (el.id || el.getAttribute('class') || el.tagName) : 'null' };
      });
      if (top.err) bad.push(`${st.step}단계: ${top.err}`);
      else {
        if (top.covered) bad.push(`${st.step}단계: 조합 결과 팝업의 「확인」이 무언가에 덮여 있다 (${top.by})`);
        await page.mouse.click(top.x, top.y);
        await page.waitForTimeout(300);
        if (await page.evaluate(() => !!document.querySelector('#brewModal.show')))
          bad.push(`${st.step}단계: 「확인」을 눌러도 팝업이 안 닫힌다 — 화면이 먹통이 된다`);
        // 팝업이 닫혔으면 막이 **스스로 돌아와야** 한다 (안 돌아오면 안내가 사라진다)
        await page.waitForTimeout(260);
        const back = await page.evaluate(() =>
          !S.tut.done && document.getElementById('tut').classList.contains('on'));
        if (!back && !(await info()).done)
          bad.push(`${st.step}단계: 팝업을 닫았는데 튜토리얼 막이 돌아오지 않는다`);
      }
    }
    if (!did) {
      const st2 = await info();
      if (st2.step === st.step && st2.beat === st.beat) {
        bad.push(`${st.step}단계: 구멍 안에서 누를 것을 못 찾았다`);
        break;
      }
    }
  }

  const fin = await page.evaluate(() => ({
    step: S.tut.step, done: S.tut.done, tutorialDone: S.tutorialDone,
    pot: S.cauldronId, dress: S.outfit.dress,
    layerOn: document.getElementById('tut').classList.contains('on'),
    creatureOpen: !document.querySelector('.room-tab[data-rtab="creatures"]').classList.contains('locked'),
    wardrobeTabs: document.querySelectorAll('.wr-tab').length,
    brews: S.record.brews, drinks: S.record.drinks, gathered: S.record.gathered,
  }));

  // 끝났으면 **잠겼던 것이 실제로 열려 있어야 한다.** 깃발만 켜고 화면이 그대로면
  // 튜토리얼을 마친 보람이 하나도 없다 (원래 이 문들이 안 열리던 것이 문제였다)
  if (!fin.done) bad.push('튜토리얼이 끝까지 가지 않았다 (' + fin.step + '단계에서 멈춤)');
  if (!fin.tutorialDone) bad.push('tutorialDone 이 안 켜졌다');
  if (fin.layerOn) bad.push('끝났는데 막이 남아 있다');
  if (fin.dress !== 'dress_onepiece') bad.push('선물받은 원피스로 갈아입지 않았다 (' + fin.dress + ')');
  if (!fin.creatureOpen) bad.push('크리처 탭이 안 열렸다');
  if (fin.wardrobeTabs < 11) bad.push('옷장 칸이 안 열렸다 (' + fin.wardrobeTabs + '칸)');
  if (fin.pot !== 'cd_iron') bad.push('3구 무쇠 솥으로 안 바뀌었다 (' + fin.pot + ')');
  bad.push(...errs);

  await browser.close();
  console.log(`튜토리얼 ${log.seen.size}단계를 눌러 봄 (${W}×${H})`);
  if (process.env.V) console.log(lines.join('\n'));
  console.log(`  조합 ${fin.brews} · 마심 ${fin.drinks} · 채집 ${fin.gathered}`);
  if (!bad.length) { console.log('✅ 튜토리얼을 끝까지 통과함'); process.exit(0); }
  console.log(`❌ ${bad.length}건`);
  bad.forEach(m => console.log('   ' + m));
  process.exit(1);
})().catch(e => { console.error('하네스 실패:', e); process.exit(2); });
