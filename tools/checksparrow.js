// 노을 밀밭 · 참새 쫓기를 **진짜 화면에서 쏴 본다**.
//
// 캔버스 안은 DOM 이 아니라 `checkUI()` 가 아무것도 못 본다 — 대비도 넘침도 잴 것이
// 없다. 그래서 「화살이 날아가는가」·「놀라서 날아가는가」는 여기서만 잡힌다.
//
// 여기서 보는 것:
//   · 밀밭 형 맵을 누르면 **채집 대신** 참새 쫓기가 뜨는가 (AP 는 그때 나간다)
//   · 평범한 맵은 **그대로 줍는가** (미니게임이 새지 않는가)
//   · **진짜 마우스**로 참새를 누르면 쫓아지는가 (칸 ↔ 화면 셈이 맞는가)
//   · 화살이 **날아가는가** — 누른 순간 맞지 않고 «도착해서» 맞는가
//   · 빗나가도 · 아무 데나 눌러도 **잃는 것이 없는가**
//   · **활을 당기는 시간**(`SHOT_MS`)이 연사를 막는가
//   · 화살 하나가 곁의 둘을 **같이** 놀래키는가 (`HIT_R`)
//   · 제 발로 날아간 참새는 놓친 것으로만 세는가 (**쫓은 수는 안 줄어드는가**)
//   · 놀란 자리에 **깃털**이 흩어지고 사라지는가 (연출을 «상태 수»로 잰다)
//   · 화면이 **노을빛**인가 · 참새가 정말 **그려지는가** (캔버스 픽셀을 읽는다)
//   · 쫓은 수만큼 재료가 가방에 들어오는가 (`REWARD_PER` 마리마다 하나)
//
// 사용: node tools/checksparrow.js      (종료 코드 0 = 통과)
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
    if (!localStorage.getItem('dieter_alchemist_save_v1'))
      localStorage.setItem('dieter_alchemist_save_v1',
        JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  // **부팅을 «기다려서» 본다** — `S` 는 최상위 `let` 이라 `window.S` 로는 안 보인다
  await page.waitForFunction(
    () => typeof S !== 'undefined' && typeof render === 'function' && window.Sparrow,
    null, { timeout: 20000 });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.tutorialDone = true; S.energy = 5000; S.charmPeak = 200;
    save(); render();
  });

  // ── 형 분류가 화면까지 왔는가
  const kinds = await page.evaluate(() => {
    const sw = D.MAPS.filter(m => D.mapType(m.id) === 'sparrow');
    const mini = D.MAPS.filter(m => D.fieldMini(m.id));
    const plain = D.MAPS.filter(m => D.mapType(m.id) === 'field');
    return {
      sw: sw.map(m => m.id), swN: sw.length, miniN: mini.length, plainN: plain.length,
      first: sw[0] && sw[0].id, zone: sw[0] && sw[0].zone,
      mini: sw[0] ? D.fieldMini(sw[0].id) : null,
      plainMini: plain[0] ? D.fieldMini(plain[0].id) : 'X',
    };
  });
  ok(kinds.swN > 0, '밀밭 형 맵이 있다', kinds.sw.join(','));
  ok(kinds.plainN > kinds.miniN * 2, '평범하게 줍는 곳이 훨씬 많다 (자동 채집이 살아 있다)',
     `평범 ${kinds.plainN} · 미니게임 ${kinds.miniN}`);
  ok(kinds.mini === 'sparrow', '밀밭 형은 참새 쫓기로 간다', String(kinds.mini));
  ok(kinds.plainMini === null, '평범한 맵에는 미니게임이 없다', String(kinds.plainMini));

  // ── ⚠️ **진짜로 채집 버튼을 누른다.** `Sparrow.start()` 를 직접 부르면
  //    `gather()` 의 갈래(형 → 미니게임)를 통째로 건너뛰어, 그 줄을 지워도 통과한다
  const mapId = kinds.first;
  const before = await page.evaluate(() => S.energy);
  await page.evaluate((id) => {
    switchTab('gather'); setGatherTab('field');
    const m = D.MAPS.find(x => x.id === id);
    S.charmPeak = Math.max(S.charmPeak, (m.unlock || 0) + 10);
    render();
    setGatherZone(m.zone);                    // 목록은 지금 선 지대의 것만 그린다
  }, mapId);
  await page.waitForTimeout(120);
  const tapped = await page.evaluate((id) => {
    const b = document.querySelector(`.spot-card[data-spot="${id}"] .btn-gather`);
    if (!b) return '카드가 없다';
    b.click();
    return null;
  }, mapId);
  ok(!tapped, '밀밭 맵 카드가 화면에 있다', tapped || '');
  await page.waitForTimeout(240);

  const opened = await page.evaluate(() => ({
    host: !!document.getElementById('sparrowGame'),
    playing: window.Sparrow.isPlaying(),
    energy: S.energy,
  }));
  ok(opened.host && opened.playing, '채집 버튼을 누르면 참새 쫓기가 뜬다',
     `host ${opened.host} · playing ${opened.playing}`);
  ok(opened.energy < before, 'AP 는 들어갈 때 나간다', `${before} → ${opened.energy}`);
  // ⚠️ **여기서 죽지 말고 그렇다고 알린다** — 크래시는 무엇이 틀렸나를 안 알려 준다
  if (!opened.playing) return done(browser, page, errs);

  const tag = await page.evaluate((id) =>
    (document.querySelector(`.spot-card[data-spot="${id}"] .spot-badge`) || {}).textContent || '', mapId);
  ok(/참새|Sparrow/.test(tag), '카드가 «어느 게임인지»를 미리 적어 둔다', tag.trim());

  // 캔버스 좌표 ↔ 화면 좌표. **진짜 마우스로 누르려면 이 셈이 맞아야 한다** —
  // `_shoot()` 으로만 재면 40px 어긋나도 통과한다 (호두·돌깨기에서 배운 자리다)
  const box = await page.evaluate(() => {
    const r = document.querySelector('#sparrowGame .sw-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  const clickAt = async (cx, cy) => {
    await page.mouse.click(box.left + cx, box.top + cy);
  };
  // 판을 비우고 시작한다 — 저절로 날아든 참새가 섞이면 무엇을 쟀는지 흐려진다
  const clear = () => page.evaluate(() => {
    const st = Sparrow._state();
    st.birds = []; st.feathers = []; st.arrows = [];
    st.scared = 0; st.missed = 0; st.shots = 0; st.lastShot = -9999;
    st.nextSpawn = 9e9;                       // 재는 동안은 새로 안 날아들게
  });

  // ── 화살이 «날아간다» ─────────────────────────────────────
  // ⚠️ 누른 자리에서 바로 맞으면 그건 씨름이 아니라 그냥 누르기다.
  // **활에서 먼 자리**에 앉혀 놓고 «맞기까지 걸린 시간»을 잰다 (0ms 면 날아간 적이 없다)
  await clear();
  const far = { x: box.w * 0.2, y: box.h * 0.42 };
  await page.evaluate(p => Sparrow._perch(p.x, p.y), far);
  await page.evaluate(() => {
    window.__tl = { sawArrow: false, hitAt: -1 };
    const id = setInterval(() => {
      const b = Sparrow.boardState();
      if (!b) return clearInterval(id);
      if (b.arrows > 0 && b.scared === 0) window.__tl.sawArrow = true;
      if (b.scared > 0 && window.__tl.hitAt < 0) {
        window.__tl.hitAt = performance.now() - Sparrow._state().lastShot;
        clearInterval(id);
      }
    }, 8);
  });
  await clickAt(far.x, far.y);
  await page.waitForTimeout(700);
  const tl = await page.evaluate(() => window.__tl);
  const s1 = await page.evaluate(() => Sparrow.boardState());
  ok(s1.scared === 1, '진짜 마우스로 참새를 누르면 쫓아진다 (칸 ↔ 화면 셈이 맞는다)',
     `쫓음 ${s1.scared} · 쏨 ${s1.shots}`);
  ok(tl.sawArrow, '화살이 «날아가는 동안»이 있다 (누르자마자 맞지 않는다)');
  ok(tl.hitAt >= 80, '누른 자리까지 날아가서 맞는다', `${Math.round(tl.hitAt)}ms`);

  // ── 연출 — 깃털 ───────────────────────────────────────────
  // ⚠️ 「점수가 올랐다」만 보면 참새가 그냥 사라져도 통과한다 (돌깨기의 파편과 같다)
  const fe = await page.evaluate(() => Sparrow.boardState().feathers);
  ok(fe > 0, '놀란 자리에 깃털이 흩어진다', `${fe}조각`);
  await page.waitForTimeout(1100);
  const fe2 = await page.evaluate(() => Sparrow.boardState().feathers);
  ok(fe2 === 0, '깃털은 곧 사라진다 (판에 안 쌓인다)', `${fe2}조각`);

  // ── 빗나가도 · 아무 데나 눌러도 잃는 것이 없다 ───────────
  await clear();
  await page.evaluate(p => Sparrow._perch(p.x, p.y), { x: box.w * 0.25, y: box.h * 0.5 });
  await clickAt(box.w * 0.8, box.h * 0.6);        // 참새에서 한참 떨어진 자리
  await page.waitForTimeout(600);
  const miss = await page.evaluate(() => Sparrow.boardState());
  ok(miss.shots === 1 && miss.scared === 0 && miss.missed === 0 && miss.birds.length === 1,
     '빗나가도 잃는 것이 없다 (그냥 밭에 꽂힐 뿐이다)',
     `쏨 ${miss.shots} · 쫓음 ${miss.scared} · 놓침 ${miss.missed}`);

  // ── 활을 당기는 시간이 연사를 막는다 ─────────────────────
  await clear();
  await clickAt(box.w * 0.5, box.h * 0.5);
  await clickAt(box.w * 0.5, box.h * 0.5);        // 곧바로 한 번 더
  const rapid = await page.evaluate(() => Sparrow.boardState().shots);
  ok(rapid === 1, '활을 당기는 동안에는 다시 못 쏜다 (마구 눌러도 안 된다)', `${rapid}발`);
  const cd = await page.evaluate(() => Sparrow.SHOT_MS);
  await page.waitForTimeout(cd + 120);
  await clickAt(box.w * 0.5, box.h * 0.5);
  const rapid2 = await page.evaluate(() => Sparrow.boardState().shots);
  ok(rapid2 === 2, `${cd}ms 지나면 다시 쏜다 (벌이 아니라 «당기는 시간»이다)`, `${rapid2}발`);

  // ── 화살 하나가 곁의 둘을 같이 놀래킨다 ──────────────────
  await clear();
  const mid = { x: box.w * 0.5, y: box.h * 0.55 };
  const hitR = await page.evaluate(() => Sparrow.HIT_R);
  await page.evaluate(p => { Sparrow._perch(p.x - p.d, p.y); Sparrow._perch(p.x + p.d, p.y); },
                      { x: mid.x, y: mid.y, d: hitR * 0.5 });
  await clickAt(mid.x, mid.y);
  await page.waitForTimeout(700);
  const two = await page.evaluate(() => Sparrow.boardState());
  ok(two.scared === 2, '잘 노리면 화살 하나로 둘을 쫓는다', `쫓음 ${two.scared}`);

  // ── 제 발로 날아간 것은 «놓친 것»일 뿐이다 ───────────────
  await clear();
  await page.evaluate(p => {
    const id = Sparrow._perch(p.x, p.y);
    const b = Sparrow._state().birds.find(x => x.id === id);
    b.stayFor = 150;                              // 곧 제 발로 날아가게
    Sparrow._state().scared = 3;                  // 이미 셋을 쫓아 둔 상태에서 본다
  }, { x: box.w * 0.6, y: box.h * 0.5 });
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => Sparrow.boardState());
  ok(left.missed === 1, '시간이 지나면 참새가 제 발로 날아간다', `놓침 ${left.missed}`);
  ok(left.scared === 3, '놓쳐도 쫓은 수는 그대로다 (잃는 것이 없다)', `쫓음 ${left.scared}`);

  // ── 그림 — **캔버스 픽셀을 읽어서** 잰다 ─────────────────
  // ⚠️ DOM 이 아니라 아무 검사도 안 보는 자리다. 호두·돌깨기와 같은 방식.
  await clear();
  const pin = { x: box.w * 0.45, y: box.h * 0.55 };
  await page.evaluate(p => Sparrow._perch(p.x, p.y), pin);
  await page.waitForTimeout(240);
  const px = await page.evaluate((p) => {
    const cv = document.querySelector('#sparrowGame .sw-canvas');
    const g = cv.getContext('2d');
    const k = cv.width / cv.getBoundingClientRect().width;      // CSS px → 백버퍼 px (DPR)
    // ① 노을빛인가 — 하늘 띠를 «빽빽하게» 훑는다.
    // ⚠️ 성기게 세면 그물·물고기 자리에 따라 흔들린다 (낚시에서 겪은 자리다)
    const sky = g.getImageData(0, Math.round(cv.height * 0.28), cv.width,
                               Math.round(cv.height * 0.14));
    let warm = 0, tot = 0;
    for (let i = 0; i < sky.data.length; i += 4 * 3) {
      tot++;
      if (sky.data[i] > sky.data[i + 2] + 30) warm++;           // 붉은 쪽이 푸른 쪽보다
    }
    // ② 참새가 «정말» 그려지는가 — 몸의 어두운 칠(날개·꼬리·눈)을 센다.
    // 밀·하늘·땅은 전부 이보다 밝아서 여기 안 걸린다
    const dark = (cx, cy) => {
      const s = 44 * k;
      const d = g.getImageData(Math.round(cx * k - s / 2), Math.round(cy * k - s / 2),
                               Math.round(s), Math.round(s)).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (d[i + 3] > 128 && l < 60) n++;
      }
      return n;
    };
    return { warm, tot, bird: dark(p.x, p.y), empty: dark(p.x + 130, p.y) };
  }, pin);
  ok(px.tot > 400 && px.warm / px.tot > 0.85, '화면이 «노을빛»이다 (붉은 쪽이 푸른 쪽보다)',
     `${px.warm}/${px.tot}점`);
  // ⚠️ **가르는 잣대여야 한다** — 참새 자리와 «빈 자리»를 같이 재서 견준다.
  // 한쪽만 재면 무엇을 그려 놔도 통과한다
  ok(px.bird > 40 && px.bird > px.empty * 4, '참새가 밀밭 위에 그려져 있다',
     `참새 자리 ${px.bird}점 · 빈 자리 ${px.empty}점`);

  // ── 결과 화면 · 재료 ─────────────────────────────────────
  // ⚠️ **«0개짜리 보상»으로 재지 않는다** — 반드시 재료가 나오는 수까지 올려 놓는다
  const res = await page.evaluate(() => {
    const invBefore = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    // ⚠️ **수치를 여기 옮겨 적지 않는다** — 「재료 다섯 개가 나오는 수」를 게임에서 셈한다
    // (`REWARD_PER` 를 올렸을 때 이 줄이 «0개짜리 보상»으로 조용히 내려앉지 않게)
    const scared = Sparrow.REWARD_PER * 5;
    Sparrow._state().scared = scared;
    Sparrow._finish();
    return { scared, invBefore, per: Sparrow.REWARD_PER,
             want: Math.min(Sparrow.REWARD_MAX, Math.floor(scared / Sparrow.REWARD_PER)) };
  });
  await page.waitForTimeout(120);
  const shown = await page.evaluate(() => {
    const b = document.querySelector('#sparrowGame .sw-result');
    return { show: !!(b && b.classList.contains('show')),
             text: (b && b.textContent || '').trim().slice(0, 40) };
  });
  ok(shown.show, '끝나면 결과가 뜬다', shown.text);
  ok(shown.text.includes(String(res.scared)), '결과가 «몇 마리를 쫓았는지»를 말한다',
     shown.text.split('\n')[0]);
  await page.evaluate(() => document.querySelector('#sparrowGame .sw-close').click());
  await page.waitForTimeout(160);

  const after = await page.evaluate(() => ({
    inv: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0),
    host: !!document.getElementById('sparrowGame'),
    playing: window.Sparrow.isPlaying(),
  }));
  ok(!after.host && !after.playing, '나가면 화면이 걷힌다');
  // ⚠️ 히든 재료가 확률로 하나 더 붙을 수 있다 — 그래서 «이상»으로 본다
  ok(after.inv - res.invBefore >= res.want,
     `${res.scared}마리 → 재료 ${res.want}개 이상이 가방에 들어온다 (${res.per}마리에 하나)`,
     `+${after.inv - res.invBefore}`);
  ok(res.want >= 4, '잰 것이 «0개짜리 보상»이 아니다', `${res.want}개 기대`);

  // ── 평범한 맵은 **그대로 줍는다** (미니게임이 새지 않는가)
  const plainId = await page.evaluate(() =>
    D.MAPS.filter(m => D.mapType(m.id) === 'field' && m.unlock === 0)[0].id);
  const plain = await page.evaluate((id) => {
    const n0 = Object.values(S.inventory || {}).reduce((a, b) => a + b, 0);
    const okc = gather(id);
    return { okc, got: Object.values(S.inventory || {}).reduce((a, b) => a + b, 0) - n0,
             host: !!document.getElementById('sparrowGame') };
  }, plainId);
  ok(plain.okc === true && !plain.host, '평범한 맵은 미니게임 없이 그대로 줍는다');
  ok(plain.got >= 1, '그 자리에서 재료가 들어온다', `+${plain.got}`);

  await done(browser, page, errs);
})();

// **중간에 멈춰도 여기를 지난다** — 그래야 「어디까지 맞고 어디서 틀렸나」가 남는다
async function done(browser, page, errs) {
  if (errs && errs.length) ok(false, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('── 노을 밀밭 · 참새 쫓기');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n참새 쫓기 검사 전부 통과 ✅');
}
