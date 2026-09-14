// 튜토리얼 글자 검사 — **브라우저 없이** 본다 (`npm test` 가 돌린다).
//
// 튜토리얼의 지시문은 화면의 «이름»을 부른다 — 「🎒 잡화 칸을 누르세요」처럼.
// 그 이름이 화면과 어긋나면 새 플레이어는 있지도 않은 칸을 찾는다.
// 실제로 마이 룸의 탭이 「🧴 물약」에서 「🎒 잡화」로 바뀐 뒤에도 지시문은
// 「🧴 물약 칸을 누르세요」로 남아 있었다 — 구멍은 잡화 탭에 뚫려 있는데
// 글은 다른 이름을 불렀다. 눌러 보는 검사(`checktut`)는 통과였다: 구멍은 맞았으니까.
//
// 화면의 진짜 이름과 견주는 것은 `checktut` 의 「지시문↔대상」이 한다 (두 언어).
// 이쪽은 화면 없이도 잡을 수 있는 것만 본다:
//   ① 단계표가 가리키는 대사·지시문 키가 두 언어에 다 있는가
//      (`checki18n` 은 ko 에만 있는 키를 잡지만, 양쪽에 다 없는 오타는 못 잡는다 —
//       화면에는 키 이름이 그대로 뜬다)
//   ② 「X 칸」 / “the X section” 이 부르는 X 가 **마이 룸 탭의 이름**인가
//      (튜토리얼에서 「칸」은 마이 룸 탭이다 — 옷 · 잡화 · 크리처)
//   ③ 지시문의 「따옴표 이름」이 그 언어의 이름표(NAMES·STRINGS)에 있는가
//      (「생기 물약」 · "Vitality Potion")
//
// 사용: node tools/checktuttext.js   (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} },
                    getElementById: () => null, addEventListener() {} };
require(path.join(ROOT, 'data.js'));
require(path.join(ROOT, 'i18n.js'));
require(path.join(ROOT, 'tutorial.js'));

const I = global.window.I18N;
const Tut = global.window.Tut;
const LANGS = ['ko', 'en'];

// i18n.js 는 표를 안 내보낸다 — `t(key, lang)` 이 없으니 파일에서 표를 직접 읽는다.
// (checki18n 과 같은 방식: `STRINGS`·`NAMES` 리터럴을 평가한다)
const src = require('fs').readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
function table(name) {
  const at = src.indexOf(`const ${name} = {`);
  if (at < 0) throw new Error(`i18n.js 에서 ${name} 을 못 찾았다`);
  // 같은 들여쓰기의 `};` 까지가 그 표다
  const end = src.indexOf('\n  };', at);
  return new Function(src.slice(at, end + 5).replace(`const ${name} =`, 'return'))();
}
const STRINGS = table('STRINGS');
const NAMES = table('NAMES');

const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;
const plain = (s) => String(s || '').replace(EMOJI, '').replace(/\s+/g, ' ').trim();
// 한국어 조사 떼기 — 「잡화 칸을」의 「칸을」이 아니라 「잡화」를 보는 자리라 짧게만
const stem = (w) => w.replace(/(을|를|이|가|은|는|의|에서|에|도|로|으로)$/u, '');

const bad = [];
const steps = Tut.stepList();

// ① 단계표의 키가 두 언어에 다 있는가
for (const s of steps) {
  for (const key of [...s.talk, ...(s.act ? [s.act] : [])]) {
    LANGS.forEach(l => {
      if (typeof STRINGS[l][key] !== 'string') bad.push(`${s.id}: ${l} 에 ${key} 가 없다 — 화면에 키 이름이 그대로 뜬다`);
    });
  }
}

// 마이 룸 탭의 이름 — 「칸」이 가리키는 것
const roomTabs = {};
LANGS.forEach(l => {
  roomTabs[l] = Object.keys(STRINGS[l]).filter(k => /^room_(clothes|stuff|creatures)$/.test(k))
    .map(k => plain(STRINGS[l][k]).toLowerCase());
});

// 이 언어의 이름표 전부 (③ 이 여기서 찾는다).
// 한국어 이름은 NAMES 가 아니라 **data.js 의 `name`** 에 있다 (NAMES 는 번역만 든다) —
// 그래서 ko 는 GameData 를 통째로 훑어 `name` 문자열을 모은다
const dataNames = new Set();
(function walk(o, depth) {
  if (!o || typeof o !== 'object' || depth > 6) return;
  if (typeof o.name === 'string') dataNames.add(plain(o.name).toLowerCase());
  Object.values(o).forEach(v => walk(v, depth + 1));
})(global.window.GameData, 0);
const labels = {};
LANGS.forEach(l => {
  const set = new Set(l === 'ko' ? dataNames : []);
  Object.values(STRINGS[l]).forEach(v => { if (typeof v === 'string') set.add(plain(v).toLowerCase()); });
  Object.values(NAMES[l] || {}).forEach(v => { if (typeof v === 'string') set.add(plain(v).toLowerCase()); });
  labels[l] = set;
});

let looked = { section: 0, quote: 0 };
LANGS.forEach(l => {
  const S = STRINGS[l];
  Object.keys(S).filter(k => /^tut_/.test(k)).forEach(key => {
    const text = S[key];
    if (typeof text !== 'string') return;
    // ② 「X 칸」 / "the X section"
    const sec = l === 'ko'
      ? [...plain(text).matchAll(/(\S+) 칸/gu)].map(m => m[1])
      : [...plain(text).matchAll(/\bthe (\S+) section\b/giu)].map(m => m[1]);
    sec.forEach(x => {
      looked.section++;
      const name = stem(x).toLowerCase();
      if (!roomTabs[l].includes(name))
        bad.push(`${key} [${l}]: 「${x} 칸/section」 — 마이 룸에 그런 탭이 없다 (있는 것: ${roomTabs[l].join(' · ')})`);
    });
    // ③ 지시문의 따옴표 이름
    if (/^tut_act_/.test(key)) {
      const q = [...text.matchAll(/「([^」]+)」|"([^"]+)"|“([^”]+)”/gu)].map(m => m[1] || m[2] || m[3]);
      q.forEach(x => {
        looked.quote++;
        if (!labels[l].has(plain(x).toLowerCase()))
          bad.push(`${key} [${l}]: 「${x}」 — 그 언어의 이름표에 없는 이름이다`);
      });
    }
  });
});

const acts = steps.filter(s => s.act).length;
console.log(`튜토리얼 ${steps.length}단계 · 지시문 ${acts}개 · 「칸」 ${looked.section}곳 · 따옴표 ${looked.quote}곳 (두 언어)`);
// 아무것도 안 잰 0건은 통과가 아니다 — 지시문 자체가 없어졌으면 그것부터 알린다
if (!acts) bad.push('지시문이 있는 단계가 하나도 없다');
if (!looked.section) bad.push('「칸」을 부르는 줄이 하나도 없다 — 마이 룸 탭을 가리키는 단계가 사라졌는가');
if (!looked.quote) bad.push('따옴표로 이름을 부르는 지시문이 하나도 없다');
if (!bad.length) { console.log('✅ 튜토리얼 글자 검사 통과'); process.exit(0); }
console.log(`❌ ${bad.length}건`);
bad.forEach(m => console.log('   ' + m));
process.exit(1);
