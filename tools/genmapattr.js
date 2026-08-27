// 채집지 51곳에 **속성**을 붙인다 — 이름의 낱말에서 규칙으로 뽑는다.
//
// 왜 생성기인가 (CLAUDE.md 6번): 쉰한 줄을 손으로 적으면 한 지대가 통째로 한 속성이
// 되거나(그러면 「지대 = 속성」이라 속성이라는 축이 있을 이유가 없어진다) 여섯 중 하나가
// 아예 안 쓰이는 일이 생긴다. 규칙으로 뽑고 **분포를 검사한다.**
//
// **`MAPS` 배열은 안 건드린다.** 이름·설명·재료 풀이 손으로 쓴 것이라 통째로 다시 쓰면
// 위험하다. 대신 `MAP_ATTRS`(맵 id → 속성) 표만 따로 뽑아 넣고 `mapAttr()` 이 찾아 쓴다.
//
// 사용:
//   node tools/genmapattr.js            data.js 를 다시 쓴다
//   node tools/genmapattr.js --check    표와 파일이 어긋났는지만 본다 (npm test)
//   node tools/genmapattr.js --list     배정 결과를 지대별로 훑어본다
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const LIST = process.argv.includes('--list');

global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
const D = global.window.GameData;

// ─── 규칙 ─────────────────────────────────────────────────────
// **위에서부터 먼저 걸리는 것을 쓴다.** 순서가 곧 우선순위다 —
// 「반딧불 늪가」는 `늪`(물)이 먼저 걸려야 한다. 불 쪽에 `불` 을 넣으면
// **반딧불이 불 속성이 된다** (실제로 그렇게 뽑혔다).
const RULES = [
  // 물 — 고인 물 · 흐르는 물 · 언 물
  [/저수지|호수|늪|여울|파도|물거품|인어|서리|우물|샘/, 'water'],
  // 불 — 붉은 것 · 뜨거운 것 · 마른 열기
  [/노을|해질녘|화산|잿|도마뱀|녹슨|소금/, 'fire'],
  // 빛 — 빛나는 것 · 하늘에 뜬 것
  [/햇살|별|반짝|등대|정령|달빛|신기루/, 'light'],
  // 암흑 — 가려진 것 · 남은 것 · 밤에 도는 것
  [/안개|부엉이|거미|까마귀|뼈|가시|난파|동굴|호박/, 'dark'],
  // 바람 — 높은 곳 · 흔들리는 것
  [/바람|구름|절벽|메아리|덤불|갈매기|삭도/, 'wind'],
];
// 안 걸리면 **땅**이다. 흙·돌·풀은 이 게임에서 가장 흔한 배경이라 기본값으로 맞다
const FALLBACK = 'earth';

function attrOf(name) {
  for (const [re, k] of RULES) if (re.test(name)) return k;
  return FALLBACK;
}

const OUT = D.MAPS.map(m => ({ id: m.id, zone: m.zone, name: m.name, attr: attrOf(m.name) }));

// ─── 검사 ─────────────────────────────────────────────────────
const problems = [];
const attrKeys = D.CREATURE_ATTRS.map(a => a.k);
const total = {}, byZone = {};
for (const o of OUT) {
  if (!attrKeys.includes(o.attr)) problems.push(`${o.id}: 없는 속성 ${o.attr}`);
  total[o.attr] = (total[o.attr] || 0) + 1;
  (byZone[o.zone] = byZone[o.zone] || {})[o.attr] = (byZone[o.zone][o.attr] || 0) + 1;
}
// **여섯이 다 쓰여야 한다.** 안 쓰이는 속성이 있으면 그 속성 크리처 다섯 마리가
// 갈 곳이 없다 (2단계에서는 표시만이지만, 4단계에서 확률이 붙으면 바로 드러난다)
for (const k of attrKeys) {
  if (!total[k]) problems.push(`속성 ${k}: 쓰이는 맵이 하나도 없다`);
  else if (total[k] < 4) problems.push(`속성 ${k}: ${total[k]}곳뿐 — 너무 적다 (4곳 이상)`);
}
// **한 지대가 한 속성으로 통일되면 안 된다.** 그러면 「지대 = 속성」이라 축이 겹친다
for (const [z, m] of Object.entries(byZone)) {
  const kinds = Object.keys(m).length;
  if (kinds < 3) problems.push(`지대 ${z}: 속성이 ${kinds}가지뿐 — 지대와 속성이 같은 축이 된다`);
}

if (LIST) {
  for (const z of D.ZONES) {
    const list = OUT.filter(o => o.zone === z.id);
    const cnt = {};
    list.forEach(o => cnt[o.attr] = (cnt[o.attr] || 0) + 1);
    console.log(`── ${z.name}  (${Object.entries(cnt).map(([k, n]) => k + ' ' + n).join(' · ')})`);
    list.forEach(o => console.log(`   ${o.attr.padEnd(6)} ${o.name}`));
  }
  console.log('\n전체:', Object.entries(total).map(([k, n]) => `${k} ${n}`).join(' · '));
}
if (problems.length) {
  console.error('❌ 속성 배정에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
  process.exit(1);
}

// ─── 파일에 써 넣기 ───────────────────────────────────────────
function replaceBlock(file, tag, body) {
  const src = fs.readFileSync(file, 'utf8');
  const head = `// <<<GEN:${tag}`, tail = `// GEN:${tag}>>>`;
  const i = src.indexOf(head), j = src.indexOf(tail);
  if (i < 0 || j < 0) { console.error(`${path.basename(file)} 에 ${head} ~ ${tail} 표시가 없다`); process.exit(2); }
  const out = src.slice(0, src.indexOf('\n', i) + 1) + body + src.slice(j);
  if (out === src) return false;
  if (!CHECK) fs.writeFileSync(file, out);
  return true;
}

let body = 'const MAP_ATTRS = {\n';
for (const z of D.ZONES) {
  const list = OUT.filter(o => o.zone === z.id);
  const cnt = {};
  list.forEach(o => cnt[o.attr] = (cnt[o.attr] || 0) + 1);
  body += `  // ${z.name} — ${Object.entries(cnt).map(([k, n]) => k + ' ' + n).join(' · ')}\n`;
  list.forEach(o => { body += `  ${o.id}: '${o.attr}',`.padEnd(30) + `// ${o.name}\n`; });
}
body += '};\n';

const changed = replaceBlock(path.join(ROOT, 'data.js'), 'mapattr', body);
if (CHECK) {
  if (changed) {
    console.error('❌ 맵 속성 표와 파일이 어긋났다 — `node tools/genmapattr.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 채집지 ${OUT.length}곳의 속성이 규칙과 같다`);
  process.exit(0);
}
console.log(`✅ 채집지 ${OUT.length}곳에 속성 배정 · `
  + Object.entries(total).map(([k, n]) => `${k} ${n}`).join(' · '));
