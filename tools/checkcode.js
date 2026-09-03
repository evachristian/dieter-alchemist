// 복구 코드로 «다른 기기에서 이어하기» 를 진짜로 해 본다.
//
// ⚠️ **여기서 재는 것의 핵심은 「오타 하나로 진행이 날아가지 않는가」다.**
// 예전에는 `prompt()` 로 받은 코드를 **형식만 보고** 곧바로 신원을 갈아엎은 뒤
// 로컬 세이브를 지우고 새로고침했다 — 그 코드가 서버에 없으면(오타 · 잘린 코드)
// 되돌릴 방법 없이 **빈손으로 새 게임이 시작된다.** 원래 신원까지 잃은 채로.
// 지금은 `Sync.peek()` 이 신원을 안 건드리고 먼저 물어본다.
//
// 같이 보는 것:
//   · 진짜 코드는 **누구의 세이브인지** 보여 준 다음에야 갈아탄다
//   · 잘린 코드(403) · 없는 아이디(404) · 형식 오류를 **갈라서** 말하는가
//   · 실패했을 때 **이 기기의 신원과 세이브가 그대로인가** ← 제일 중요한 줄
//   · 갈아타면 그 캐릭터로 «진짜» 이어지는가 (이름·매력이 따라오는가)
//   · 코드를 복사하면 톱니의 점이 꺼지는가
//
// 서버가 있어야 한다 — **이 스크립트가 스스로 띄운다** (checkfarm 과 같은 방식).
// 사용: node tools/checkcode.js      (종료 코드 0 = 통과)
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

const PORT = Number(process.env.PORT) || 8123;
const BASE = `http://localhost:${PORT}`;
const out = [];
let failed = 0;
function ok(cond, msg, extra) {
  out.push(`  ${cond ? 'OK ' : '❌ '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
}

// 스플래시·인트로를 치우고 메인 화면으로
async function boot(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });
}

(async () => {
  const srv = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')],
    { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  const done = () => { try { srv.kill(); } catch (e) {} };
  process.on('exit', done);
  await new Promise(r => setTimeout(r, 1500));

  const browser = await chromium.launch(launchOpts());
  const errs = [];

  // ── 기기 A — 캐릭터를 만들고 코드를 받는다
  const A = await browser.newContext();
  const a = await A.newPage();
  a.on('pageerror', e => errs.push('A: ' + e));
  await a.addInitScript(() => localStorage.setItem('dieter_alchemist_intro_seen_v1', '1'));
  await boot(a);
  const code = await a.evaluate(async () => {
    S.name = '기기에이'; S.nameClaimed = true; S.tutorialDone = true;
    S.stats.charm = 137; S.crystal = 500;
    save();
    await Sync.pushNow(S);
    return Sync.code();
  });
  ok(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code), '기기 A 가 복구 코드를 낸다',
     code.slice(0, 14) + '…');

  // 코드를 복사하면 톱니의 점이 꺼진다
  // ⚠️ 복사는 **비동기다** (`navigator.clipboard` 가 프라미스라, 막히면 폴백으로 떨어진다).
  // 바로 재면 아직 안 꺼져 있어서 「안 꺼진다」로 잘못 잡힌다
  const dotBefore = await a.evaluate(() => {
    S.codeSeen = false; renderActBadges();
    copyRecoveryCode(document.getElementById('btnSettings'));
    return !document.getElementById('gearDot').hidden;
  });
  await a.waitForTimeout(400);
  const dot = await a.evaluate(() => {
    renderActBadges();
    return { after: !document.getElementById('gearDot').hidden, seen: S.codeSeen };
  });
  const dotOk = { before: dotBefore, after: dot.after, seen: dot.seen };
  ok(dotOk.before && !dotOk.after && dotOk.seen, '코드를 복사하면 톱니의 점이 꺼진다',
     `${dotOk.before ? '켜짐' : '꺼짐'} → ${dotOk.after ? '켜짐' : '꺼짐'}`);

  // ⚠️ **열어서 «본» 것만으로도 꺼져야 한다.** 예전에는 «복사»해야만 꺼져서,
  // 설정을 열어 코드를 눈으로 적어 둔 사람에게는 점이 **영영 안 꺼졌다**
  // (「왜인지 사라지질 않아」로 신고받았다). 점의 뜻은 「아직 안 본 것이 있다」이지
  // 「아직 복사 안 했다」가 아니다
  const dotOpen = await a.evaluate(() => {
    S.codeSeen = false; renderActBadges();
    const on = !document.getElementById('gearDot').hidden;
    openSettings(); closeSettings();
    renderActBadges();
    return { before: on, after: !document.getElementById('gearDot').hidden, seen: S.codeSeen };
  });
  ok(dotOpen.before && !dotOpen.after && dotOpen.seen,
     '설정을 «열기만» 해도 톱니의 점이 꺼진다',
     `${dotOpen.before ? '켜짐' : '꺼짐'} → ${dotOpen.after ? '켜짐' : '꺼짐'}`);

  // ── 기기 B — 다른 브라우저 컨텍스트 (localStorage 가 따로다)
  const B = await browser.newContext();
  const b = await B.newPage();
  b.on('pageerror', e => errs.push('B: ' + e));
  await b.addInitScript(() => localStorage.setItem('dieter_alchemist_intro_seen_v1', '1'));
  await boot(b);
  const own = await b.evaluate(() => {
    S.name = '기기비'; S.nameClaimed = true; S.stats.charm = 4; save();
    return { code: Sync.code(), name: S.name };
  });
  ok(own.code !== code, '기기 B 는 처음에 다른 신원이다');

  // ═══ ⚠️ 여기가 핵심 — 틀린 코드로는 «아무것도» 안 바뀐다 ═══
  const bad = [
    ['형식이 아니다',   'abcdefg',                      'sync_bad_code'],
    ['없는 아이디',     'AAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBB', 'sync_no_such'],
    ['코드가 잘렸다',   code.split('.')[0] + '.' + 'X'.repeat(24), 'sync_wrong_secret'],
  ];
  for (const [what, wrong, wantKey] of bad) {
    const r = await b.evaluate(async ([c, k]) => {
      openRestore();
      document.getElementById('restoreInput').value = c;
      await checkRestoreCode();
      const el = document.getElementById('restoreFound');
      return {
        msg: (el.querySelector('.rs-bad') || {}).textContent || '',
        want: T(k),
        go: !!el.querySelector('.rs-go'),          // 「이어하기」 버튼이 뜨면 안 된다
        code: Sync.code(), name: S.name, charm: S.stats.charm,
      };
    }, [wrong, wantKey]);
    ok(r.msg === r.want && !r.go, `틀린 코드 — ${what}`, r.msg || '(안내가 없다)');
    // ⚠️ **이 줄이 예전에 깨지던 자리다**
    ok(r.code === own.code && r.name === own.name,
       `   …신원과 세이브가 그대로다 (${what})`,
       `${r.name} · ${r.code === own.code ? '같은 신원' : '⚠️ 신원이 바뀌었다'}`);
  }

  // ── 진짜 코드 — **누구인지 보여 준 다음에야** 갈아탄다
  const found = await b.evaluate(async (c) => {
    openRestore();
    document.getElementById('restoreInput').value = c;
    await checkRestoreCode();
    const el = document.getElementById('restoreFound');
    return {
      name: (el.querySelector('.rs-name') || {}).textContent || '',
      meta: (el.querySelector('.rs-meta') || {}).textContent || '',
      go: !!el.querySelector('.rs-go'),
      stillMe: Sync.code(),           // 아직 갈아타면 안 된다 — 확인만 한 것이다
    };
  }, code);
  ok(found.name === '기기에이' && found.go, '진짜 코드는 «누구인지»를 보여 준다',
     `${found.name} · ${found.meta}`);
  ok(found.stillMe === own.code, '   …확인만 해서는 아직 안 갈아탄다');
  ok(/137/.test(found.meta), '   …매력·저장 시각이 같이 뜬다 (내 것이 맞나 판단할 거리)',
     found.meta);

  // ── 갈아탄다 (확인 모달의 「예」까지)
  await b.evaluate(() => {
    doRestore();
    const yes = document.querySelector('#confirmModal .btn-primary');
    if (yes) yes.click();
  });
  await b.waitForTimeout(400);
  await b.waitForLoadState('load');
  await b.waitForTimeout(2400);
  await b.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });
  await b.waitForTimeout(1200);            // Sync.pull 이 끝나기를 기다린다
  const after = await b.evaluate(() => ({ name: S.name, charm: S.stats.charm, code: Sync.code() }));
  ok(after.code === code, '기기 B 가 A 의 신원으로 갈아탔다');
  ok(after.name === '기기에이' && after.charm === 137,
     '   …그 캐릭터로 «진짜» 이어진다 (이름·매력이 따라온다)',
     `${after.name} · 매력 ${after.charm}`);

  // ── 개발용 계정 보관함 — 담아 두고, 초기화하고, 꺼내 온다
  //
  // ⚠️ **초기화는 «공장 초기화»여야 한다.** 예전에는 세이브와 인트로 표시 둘만
  // 지워서 몸 슬라이더 · 개발용 스위치 · 통계 · **신원(playerId)** 이 그대로 남았다.
  // 신원이 남으면 새 캐릭터가 옛 아이디를 물려받아, 아이디로 시드를 잡는 것들이
  // 초기화해도 안 바뀐다. 「새 이름으로 시작하면 처음 실행한 것과 똑같다」를 잰다.
  async function resetHere() {
    await b.evaluate(() => {
      askResetGame();
      const yes = document.querySelector('#confirmModal .btn-primary');
      if (yes) yes.click();
    });
    await b.waitForTimeout(600);
    await b.waitForLoadState('load');
    await b.waitForTimeout(2400);
    await b.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.classList.add('done');
      const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    });
  }
  const wasCode = await b.evaluate(() => {
    // 남아 있으면 안 되는 것들을 일부러 만들어 둔다
    localStorage.setItem('dieter_alchemist_bodytune_v1', JSON.stringify({ torso: 140 }));
    localStorage.setItem('dieter_alchemist_devpots_v1', JSON.stringify(['pot_iron3']));
    return Sync.code();
  });
  await resetHere();

  const fresh = await b.evaluate(() => ({
    code: Sync.code(),
    left: Object.keys(localStorage).filter(k => k.indexOf('dieter_alchemist_') === 0).sort(),
    name: S.name || '', tut: !!S.tutorialDone,
  }));
  ok(fresh.code !== wasCode, '초기화하면 **신원까지 새로 난다**',
     `${String(wasCode).slice(0, 8)}… → ${String(fresh.code).slice(0, 8)}…`);
  ok(!fresh.name && !fresh.tut, '   …진행도 처음 상태다 (이름 없음 · 튜토리얼 안 끝남)',
     `이름 «${fresh.name}» · 튜토리얼 ${fresh.tut}`);
  // ⚠️ 인트로 표시(`intro_seen`)는 **이 검사기가** 매 로드마다 다시 심는다
  // (인트로를 건너뛰려고). 초기화가 안 지운 것이 아니다
  const junk = fresh.left.filter(k => !/devaccounts|player_v1|save_v1|intro_seen/.test(k));
  ok(junk.length === 0, '   …몸 슬라이더·개발용 스위치 같은 찌꺼기가 안 남는다', junk.join(', '));

  // 새 캐릭터를 하나 만들어 서버에 올리고 → **담고 새 캐릭터로** → 꺼내 온다
  //
  // ⚠️ **여기서 「게임 초기화」를 쓰면 안 된다.** 그건 서버 사본까지 지워서
  // 방금 담아 둔 계정이 죽는다 — 보관함에 열쇠만 남고 열 문이 없어진다.
  // 「담고 새 캐릭터로」가 보관함의 짝이다 (서버는 그대로 두고 이 기기만 되돌린다).
  const kept = await b.evaluate(async () => {
    S.name = '보관함시험'; S.nameClaimed = true; S.tutorialDone = true;
    save(); await Sync.pushNow(S);
    return { code: Sync.code() };
  });

  await b.evaluate(() => {
    devAcctNew();
    const yes = document.querySelector('#confirmModal .btn-primary');
    if (yes) yes.click();
  });
  await b.waitForTimeout(700);
  await b.waitForLoadState('load');
  await b.waitForTimeout(2400);
  await b.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });
  const after2 = await b.evaluate(() => ({
    code: Sync.code(), vault: devAccounts().length, name: S.name || '' }));
  ok(after2.vault === 1, '계정 보관함에 지금 계정이 담긴다', `${after2.vault}개`);
  ok(after2.code !== kept.code && !after2.name,
     '   …「담고 새 캐릭터로」는 처음 상태로 되돌린다',
     `${String(kept.code).slice(0, 8)}… → ${String(after2.code).slice(0, 8)}…`);
  await b.evaluate((c) => { devAcctUse(c); }, kept.code);
  await b.waitForTimeout(1200);
  const backFound = await b.evaluate(() => {
    const el = document.getElementById('restoreFound');
    return { name: (el.querySelector('.rs-name') || {}).textContent || '',
             go: !!el.querySelector('.rs-go') };
  });
  ok(backFound.go && backFound.name === '보관함시험',
     '보관함에서 꺼내면 **복구 코드와 같은 길**을 지난다 (먼저 «누구인지»를 보여 준다)',
     backFound.name);
  await b.evaluate(() => {
    doRestore();
    const yes = document.querySelector('#confirmModal .btn-primary');
    if (yes) yes.click();
  });
  await b.waitForTimeout(500);
  await b.waitForLoadState('load');
  await b.waitForTimeout(2400);
  await b.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });
  await b.waitForTimeout(1200);
  const back = await b.evaluate(() => ({ code: Sync.code(), name: S.name }));
  ok(back.code === kept.code && back.name === '보관함시험',
     '   …담아 둔 캐릭터로 그대로 돌아온다', `${back.name}`);

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  done();
  console.log('── 복구 코드로 이어하기');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n복구 코드 검사 전부 통과 ✅');
})();
