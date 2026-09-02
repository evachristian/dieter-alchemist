// 호감도를 **진짜 화면에서** 올려 본다 (STORY.md 「남자 NPC 여섯 › 공통 규칙」).
//
// ⚠️ **여기서 재는 것의 핵심은 「매력이 안 섞이는가」다.**
// 예뻐질수록 남자들이 좋아해 주는 구조가 되면 `intro_6` 의 주제와 정면으로 부딪힌다 —
// 공주가 살을 빼는 이유가 남에게 잘 보이기 위해서가 되어 버린다.
// 그래서 매력·비주얼을 999 로 올려 놓고 **호감도가 한 톨도 안 움직이는지**를 수치로 본다.
// 부엌의 「0 깎였는가」와 같은 종류의 검사다: 무너지면 인물이 아니라 주제가 무너진다.
//
// 같이 보는 것:
//   · 처음 주는 종류가 크고(+3), 두 번째부터는 작다(+1) — 초반 레시피가 안 죽는가
//   · 좋아하는 등급이면 +2
//   · **물약이 사라지는가** (유일한 제동이다)
//   · 단계가 오르면 답례가 «한 번만» 오는가
//   · **내려가지 않는가** — 게임 규칙으로 깎이는 길이 없다
//   · 클레멘에게는 호감도가 없는가 (그는 대가 없이 주는 쪽이다)
//
// 사용: node tools/checkbond.js      (종료 코드 0 = 통과)
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
    // ⚠️ **이미 있으면 안 덮어쓴다** — 덮어쓰면 새로고침 검사가 스스로 세이브를 지워
    // 「안 남았다」가 나온다 (게임이 아니라 검사기의 잘못이다)
    if (!localStorage.getItem('dieter_alchemist_save_v1'))
      localStorage.setItem('dieter_alchemist_save_v1',
        JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    S.villages = D.villagesShown().map(v => v.id);
    S.keywords = D.KEYWORDS.map(k => k.id);
    render();
  });

  // ── 클레멘에게는 호감도가 없다
  ok(await page.evaluate(() => !D.BONDS.sp_clemen && !hasBond('sp_clemen')),
     '클레멘에게는 호감도가 없다 (대가 없이 주는 쪽이다)');
  ok(await page.evaluate(() => D.bondNpcs().length === 6), '호감도가 붙은 사람은 여섯');

  // ═══ ⚠️ 핵심 — 매력·비주얼이 호감도를 못 건드린다 ═══
  const charmTest = await page.evaluate(() => {
    S.bond = {}; S.gifted = {};
    const before = bondOf('sp_orix');
    S.stats.charm = 999; S.stats.beauty = 999; S.charmPeak = 999;
    render();
    return { before, after: bondOf('sp_orix'), tier: bondTier('sp_orix') };
  });
  ok(charmTest.after === charmTest.before && charmTest.tier === 0,
     '⚠️ 매력·비주얼 999 로도 호감도가 안 움직인다',
     `${charmTest.before} → ${charmTest.after} (단계 ${charmTest.tier})`);

  // ── 점수가 붙는 방식
  const gains = await page.evaluate(() => {
    S.bond = {}; S.gifted = {}; S.potions = {};
    const b = D.BONDS.sp_orix;
    const liked = D.RECIPES.find(r => r.result.kind === 'potion' && r.result.grade === b.like);
    const plain = D.RECIPES.find(r => r.result.kind === 'potion' && r.result.grade !== b.like);
    S.potions[liked.result.id] = 3;
    S.potions[plain.result.id] = 3;
    const first = giftGain('sp_orix', plain.result.id);
    giveGift('sp_orix', plain.result.id);
    const again = giftGain('sp_orix', plain.result.id);
    const likeGain = giftGain('sp_orix', liked.result.id);
    return { first, again, likeGain, score: bondOf('sp_orix'),
             left: S.potions[plain.result.id] || 0, g: D.BOND_GAIN };
  });
  ok(gains.first === gains.g.fresh, '처음 주는 종류는 크게 오른다', `+${gains.first}`);
  ok(gains.again === gains.g.again, '두 번째부터는 작다 (초반 레시피가 안 죽는다)', `+${gains.again}`);
  ok(gains.likeGain === gains.g.fresh + gains.g.like, '좋아하는 등급이면 덤이 붙는다', `+${gains.likeGain}`);
  ok(gains.score === gains.first, '준 만큼만 오른다', `${gains.score}`);
  ok(gains.left === 2, '**물약이 사라진다** (유일한 제동이다)', `남은 것 ${gains.left}`);

  // ── 없는 물약은 못 준다
  const cheat = await page.evaluate(() => {
    S.bond = { sp_orix: 0 }; S.potions = {};
    giveGift('sp_orix', 'vitality');
    return bondOf('sp_orix');
  });
  ok(cheat === 0, '안 가진 물약으로는 못 올린다', `${cheat}`);

  // ── 단계가 오르면 답례가 한 번만
  const rew = await page.evaluate(async () => {
    S.bond = {}; S.gifted = {}; S.potions = {}; S.inventory = {}; S.crystal = 0;
    const b = D.BONDS.sp_orix;
    // 1단계 문턱을 넘을 만큼만 준다
    const pots = D.RECIPES.filter(r => r.result.kind === 'potion').slice(0, 6);
    pots.forEach(r => { S.potions[r.result.id] = 1; });
    let n = 0;
    for (const r of pots) {
      if (bondTier('sp_orix') >= 1) break;
      giveGift('sp_orix', r.result.id); n++;
    }
    await new Promise(r => setTimeout(r, 3200));   // 답례 토스트가 setTimeout 뒤에 온다
    const g = D.BOND_GIFTS[1];
    return { tier: bondTier('sp_orix'), n,
             ing: b.ing.map(id => S.inventory[id] || 0), want: g.n,
             crystal: S.crystal, wantC: g.crystal };
  });
  ok(rew.tier === 1, '문턱을 넘으면 단계가 오른다', `${rew.n}개 주고 단계 ${rew.tier}`);
  ok(rew.ing.every(v => v === rew.want), '답례 재료가 «한 번만» 들어온다',
     `${rew.ing.join('/')} (${rew.want} 기대)`);
  ok(rew.crystal === rew.wantC, '답례 결정도 한 번만', `${rew.crystal} (${rew.wantC} 기대)`);

  // ── 내려가지 않는다 — 게임 규칙에 깎는 길이 없다
  const down = await page.evaluate(() => {
    S.bond = { sp_orix: 50 };
    const before = bondOf('sp_orix');
    // 매력을 다 잃고, 물약을 다 마시고, 하루가 지나도
    S.stats.charm = 0; S.stats.beauty = 0; refreshEnergy(); render();
    return { before, after: bondOf('sp_orix') };
  });
  ok(down.after >= down.before, '내려가지 않는다', `${down.before} → ${down.after}`);

  // ── 화면 — 선물 시트가 뜨고 하트가 단계를 보여 준다
  const ui = await page.evaluate(() => {
    S.bond = { sp_orix: 24 }; S.potions = {};
    D.RECIPES.filter(r => r.result.kind === 'potion').slice(0, 4)
      .forEach(r => { S.potions[r.result.id] = 2; });
    switchTab('gather'); setGatherTab('village'); setVillage('vl_chimney');
    tapVillageSpot('vl_chimney', 'vs_chimney_forge');
    const pips = document.querySelectorAll('#villageBody .bd-pip.on').length;
    const btn = [...document.querySelectorAll('#villageBody .npc-act')]
      .find(b => b.textContent.trim() === T('npc_gift'));
    if (!btn) return '선물 버튼이 없다';
    openGift('sp_orix');
    if (!document.getElementById('giftSheet').classList.contains('show')) return '시트가 안 떴다';
    const rows = document.querySelectorAll('#giftSheet .gift-row').length;
    if (rows !== 4) return `줄이 ${rows}개다 (4 기대)`;
    if (!document.querySelector('#giftSheet .gift-tag.new')) return '「처음」 딱지가 없다';
    // 채운 하트 수 = 단계 + 1 (0단계도 한 칸은 찬다)
    if (pips !== bondTier('sp_orix') + 1) return `하트가 ${pips}칸이다 (단계 ${bondTier('sp_orix')})`;
    return null;
  });
  ok(ui === null, '선물 버튼 · 시트 · 하트가 단계를 보여 준다', typeof ui === 'string' ? ui : '');

  // ── 하트 색 — ⚠️ `checkTextStyle()` 은 여기를 «못 본다**
  //
  // 그 검사는 **그림 글자(이모지)의 대비를 재지 않는다** — 색을 스스로 가진 글자라
  // 재는 것이 뜻이 없기 때문이다. 그런데 ♥/♡ 는 그림 글자로 분류되면서도
  // **우리가 색을 칠하고**, 게다가 단계를 나타내는 유일한 그림이다.
  // 실제로 3.56:1 짜리 분홍을 넣어도 `checkUI()` 는 0건으로 통과했다.
  // 그래서 여기서 직접 잰다 — 정책을 느슨하게 푸는 대신 이 자리만 콕 집는다.
  const pip = await page.evaluate(() => {
    S.bond = { sp_orix: 24 };
    switchTab('gather'); setGatherTab('village'); setVillage('vl_chimney');
    tapVillageSpot('vl_chimney', 'vs_chimney_forge');
    const rgb = t => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const bgOf = el => {                       // 위로 올라가며 처음 만나는 불투명 배경
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const a = (c.match(/[\d.]+/g) || [])[3];
        if (c && c !== 'transparent' && a !== '0') return rgb(c);
      }
      return [255, 255, 255];
    };
    return [...document.querySelectorAll('#villageBody .bd-pip')].map(e => ({
      on: e.classList.contains('on'), fg: rgb(getComputedStyle(e).color), bg: bgOf(e),
    }));
  });
  const lum = c => {
    const v = c.map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const worst = pip.reduce((w, p) => Math.min(w, ratio(p.fg, p.bg)), 99);
  ok(pip.length > 0 && worst >= 4.5, '하트도 4.5:1 을 지킨다 (검증기가 그림 글자로 봐서 안 잰다)',
     `${pip.length}칸 · 가장 낮은 대비 ${worst.toFixed(2)}:1`);

  // ── 개발용 단계 스위치
  const dev = await page.evaluate(() => {
    closeGift();
    devBondSet('sp_valen', 3);
    if (bondTier('sp_valen') !== 3) return `단계가 ${bondTier('sp_valen')} 다 (3 기대)`;
    devBondSet('sp_valen', 0);
    if (bondTier('sp_valen') !== 0) return '0 으로 되돌려지지 않는다';
    return null;
  });
  ok(dev === null, '개발용 단계 스위치가 사람마다 먹는다', typeof dev === 'string' ? dev : '');

  // ── 새로고침해도 남는가
  await page.evaluate(() => { S.bond = { sp_stark: 24 }; S.gifted = { sp_stark: ['vitality'] }; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const kept = await page.evaluate(() => ({ n: bondOf('sp_stark'), g: (S.gifted.sp_stark || []).length }));
  ok(kept.n === 24 && kept.g === 1, '세이브에 남는다', `${kept.n} · 준 종류 ${kept.g}`);

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('── 호감도');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n호감도 검사 전부 통과 ✅');
})();
