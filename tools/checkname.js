// 여왕의 이름이 화면에 새지 않는가.
//
// ⚠️ **이 약속 하나가 마지막 장면 전체를 지탱한다** (STORY.md 「여왕」).
// 거울이 그녀를 기억해 내며 부르는 이름이라, 그 전에 **한 번이라도** 화면에 뜨면
// 「평생 아무 이름도 부른 적 없던 자가 부른다」가 성립하지 않는다.
// 설정상의 이름은 `SPEAKERS` 와 `NAMES` 에 그대로 두고(공주·요정 대모와 같은 방식),
// 화면에서는 `speakerName()` 이 「여왕」으로 갈아 끼운다.
//
// 두 가지를 본다.
//   ① 문자열 — 화면에 나갈 수 있는 «모든» 번역 문구에 이름이 섞였는가 (두 언어)
//   ② 진짜 화면 — 첨탑에서 여왕을 만나 대사·칩·이름표를 다 펼쳐 놓고 DOM 을 훑는다
//
// ①만으로는 부족하다: `N(sp.id, sp.name)` 처럼 **표에서 직접 읽어 그리는 길**이
// 하나라도 남아 있으면 문구에는 없는데 화면에는 뜬다. 그래서 ②가 있다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const NAME_KO = '이그리트';
const NAME_EN = 'Ygritte';
const bad = [];
const rows = [];

// ─── ① 문자열 ────────────────────────────────────────────────
// 이름을 **담아도 되는 곳**은 둘뿐이다 — 설정값 그 자체다.
//   data.js 의 `SPEAKERS[].name` · i18n.js 의 `NAMES.en.sp_ygritte`
// 나머지 어디에 있으면 화면으로 새어 나갈 수 있다.
//
// ⚠️ **이 절반은 브라우저가 없어도 돈다.** 그래서 `checktalk` 이 이것만 따로 불러
// `npm test` 마다 돌린다 — 제일 깨지기 쉬운 약속이라 매번 봐야 한다.
// (사본을 만들지 않고 여기 한 곳에서 내보낸다)
const ALLOW = [
  /name: '이그리트'/,                    // data.js — 설정상의 이름
  /sp_ygritte: 'Ygritte'/,               // i18n.js — 같은 것의 영어
];
function scanStrings() {
  const out = [];
  const files = ['data.js', 'i18n.js', 'game.js', 'intro.js', 'tutorial.js'];
  files.forEach(file => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.indexOf(NAME_KO) < 0 && line.indexOf(NAME_EN) < 0) return;
      if (line.trim().startsWith('//')) return;             // 주석은 화면에 안 나간다
      if (ALLOW.some(re => re.test(line))) return;
      out.push(`${file}:${i + 1} 여왕의 이름이 문자열에 있다 — ${line.trim().slice(0, 70)}`);
    });
  });
  return out;
}
module.exports = { scanStrings };
if (require.main !== module) return;

scanStrings().forEach(m => bad.push(m));
rows.push(`문자열 — 허용된 두 곳(설정값) 말고는 없음`);

(async () => {
  // ─── ② 진짜 화면 ───────────────────────────────────────────
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const lang of ['ko', 'en']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(l => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_lang_v1', l);
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify({
        ver: 8, name: '테스터', nameClaimed: true, tutorialDone: true, lang: l,
        // 여왕에게 물을 수 있는 것을 «전부» 들려 보낸다 — 칩이 하나라도 빠지면
        // 그 대답은 검사하지 않은 것이 된다
        keywords: ['kw_hunger', 'kw_beauty', 'kw_life', 'kw_mother', 'kw_order',
                   'kw_queen', 'kw_glass', 'kw_seal', 'kw_self'],
        villages: ['vl_chimney', 'vl_apple', 'vl_mirror', 'vl_hunter', 'vl_thorn',
                   'vl_glass', 'vl_mine', 'vl_spire'],
        talked: [],
      }));
    }, lang);
    await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      const s = document.getElementById('splash'); if (s) s.classList.add('done');
      const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    });
    // 첨탑 → 거울의 방
    await page.evaluate(() => {
      switchTab('gather'); setGatherTab('village'); setVillage('vl_spire');
      tapVillageSpot('vl_spire', 'vs_spire_mirror');
    });
    await page.waitForTimeout(400);
    // 이름표에 무엇이 떠 있는가
    const shown = await page.$eval('#villageBody .npc-name', e => e.textContent.trim())
      .catch(() => '(못 찾음)');
    // ⚠️ **매 걸음마다 담아 둔다.** 마지막에 한 번만 읽으면 그때 화면에 남아 있는
    // 것만 보게 된다 — 잡담 줄에 이름을 흘려 놓고도 「안 샘」이 나왔다 (사보타주로 확인).
    const seenText = [];
    const grab = async () => {
      seenText.push(await page.evaluate(() => document.body.innerText));
    };
    await grab();
    // ⚠️ **「대화」를 눌러야 잡담이 시작된다.** 말풍선만 두드리면 인사말에 머무르고
    // (`.npc-bubble.live` 가 아니다), 잡담 줄은 한 번도 화면에 안 뜬다 —
    // 거기에 이름을 흘려 놓고도 「안 샘」이 나왔다 (사보타주로 확인한 자리다)
    await page.$eval('#villageBody .npc-act.main', e => e.click()).catch(() => {});
    await page.waitForTimeout(250);
    await grab();
    // 인사말 → 잡담을 먼저 다 넘긴다 (칩을 누르면 말풍선이 대답으로 바뀐다)
    for (let i = 0; i < 6; i++) {
      await page.$eval('#villageBody .npc-bubble', e => e.click()).catch(() => {});
      await page.waitForTimeout(120);
      await grab();
    }
    // 물어볼 것을 하나씩 다 눌러 본다 — 대답마다 이름이 섞였는지 본다
    const chips = await page.$$eval('#villageBody .ask-chip', els => els.length);
    let seen = 0;
    for (let i = 0; i < chips; i++) {
      await page.$$eval('#villageBody .ask-chip', (els, k) => els[k] && els[k].click(), i);
      await page.waitForTimeout(150);
      await grab();
      seen++;
    }
    const text = seenText.join('\n');
    if (text.indexOf('이그리트') >= 0 || text.indexOf('Ygritte') >= 0) {
      bad.push(`${lang}: 여왕의 이름이 화면에 떴다 — 마지막 장면이 죽는다`);
    }
    const want = lang === 'ko' ? '여왕' : 'Queen';
    if (shown.indexOf(want) < 0) {
      bad.push(`${lang}: 이름표가 「${want}」가 아니다 — ${shown}`);
    }
    if (errs.length) bad.push(`${lang}: 콘솔 오류 — ${errs[0]}`);
    rows.push(`${lang} 이름표 「${shown}」 · 물어본 것 ${seen}개 · 이름 안 샘`);
    await page.close();
  }
  await browser.close();

  console.log(`여왕의 이름: ${rows.join(' · ')}`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  console.log('✅ 여왕의 이름이 화면 어디에도 안 나온다');
})();
