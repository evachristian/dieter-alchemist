// 채집지 51곳에 **«형»(field type)** 을 붙인다 — 이름과 재료 풀에서 규칙으로 뽑는다.
//
// **속성(`MAP_ATTRS`)과 다른 축이다.** 속성은 「이 땅의 기운이 무엇인가」(크리처 동행이
// 맞는지)이고, 형은 「여기서 채집이 «어떤 모양»인가」다 — 그냥 줍는 곳인지,
// 미니게임으로 들어가는 곳인지.
//
// 왜 생성기인가 (CLAUDE.md 6번): 쉰한 줄을 손으로 적으면 한 지대가 통째로 한 형이 되거나
// (그러면 「지대 = 형」이라 형이라는 축이 있을 이유가 없어진다) 미니게임이 초반에만
// 몰린다. 규칙으로 뽑고 **분포를 검사한다** — `genmapattr.js` 와 같은 방식이다.
//
// **`MAPS` 배열은 안 건드린다.** 이름·설명·재료 풀이 손으로 쓴 것이라 통째로 다시 쓰면
// 위험하다. 대신 `MAP_TYPES`(맵 id → 형) 표만 따로 뽑아 넣고 `mapType()` 이 찾아 쓴다.
//
// 사용:
//   node tools/genmaptype.js            data.js 를 다시 쓴다
//   node tools/genmaptype.js --check    표와 파일이 어긋났는지만 본다 (npm test)
//   node tools/genmaptype.js --list     배정 결과를 지대별로 훑어본다
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
//
// **미니게임은 «이름이 그 게임인 곳»에만 붙는다.** 「호두 마루」에서 호두를 줍고
// 「파수꾼의 호박 밭」에서 호박을 피한다 — 카드를 보면 무슨 게임인지 이미 알 수 있고,
// 맵을 늘려도 규칙이 저절로 번지지 않는다.
//
// ⚠️ **한때 재료 풀로도 뽑았다** (열매가 셋 이상이면 과수원). 그렇게 하면 아홉 곳이
// 미니게임이 되는데, 2분짜리를 아홉 곳에서 시키면 「꾹 누르기 자동 채집」이 사실상
// 사라진다 — 코지 게임에서 그건 숙제다. 지금은 **이름 규칙뿐이고, 안 걸리면 평범한 곳**이다.
// 미니게임을 늘릴 때도 여기에 한 줄을 적어 **어느 맵인지 눈에 보이게** 한다.
//
// **위에서부터 먼저 걸리는 것을 쓴다** — 순서가 곧 우선순위다.
const NAME_RULES = [
  // 호박 밭 — 파수꾼이 호박을 굴린다 (`pumpkin.js`)
  [/호박/, 'pumpkin'],
  // 호두밭 — 합이 10이면 줍는다 (`walnut.js`)
  [/호두/, 'walnut'],
];

function typeOf(m) {
  for (const [re, k] of NAME_RULES) if (re.test(m.name)) return k;
  return 'field';
}

const OUT = D.MAPS.map(m => ({ id: m.id, zone: m.zone, name: m.name, type: typeOf(m) }));

// ─── 검사 ─────────────────────────────────────────────────────
const problems = [];
const typeKeys = D.FIELD_TYPES.map(t => t.k);
const total = {}, byZone = {};
for (const o of OUT) {
  if (!typeKeys.includes(o.type)) problems.push(`${o.id}: 없는 형 ${o.type}`);
  total[o.type] = (total[o.type] || 0) + 1;
  (byZone[o.zone] = byZone[o.zone] || {})[o.type] = (byZone[o.zone][o.type] || 0) + 1;
}
// ⚠️ **옛 배정을 새로 뽑지 않는다** (genwardrobe 의 `LEGACY` 와 같은 규칙).
// 호박 밭은 이미 미니게임이 붙어 나간 맵이라, 규칙을 고치다 형이 바뀌면
// **그 맵의 채집이 조용히 다른 게임으로 바뀐다.** 여기서 못 박는다
const PINNED = { p_pumpkin: 'pumpkin', p_walnut: 'walnut' };
for (const [id, want] of Object.entries(PINNED)) {
  const got = (OUT.find(o => o.id === id) || {}).type;
  if (got !== want) problems.push(`${id}: 형이 ${got} 다 — ${want} 로 못 박혀 있다`);
}
// **평범한 채집이 대다수여야 한다.** 미니게임이 절반을 넘으면 「꾹 누르기 자동 채집」이
// 사실상 사라진다 — 코지 게임에서 매번 2분짜리를 시키는 것은 숙제다
const miniN = OUT.filter(o => o.type !== 'field').length;
if (miniN > OUT.length * 0.3) {
  problems.push(`미니게임 맵이 ${miniN}곳 — 쉰한 곳의 30% 를 넘으면 자동 채집이 사라진다`);
}
if (!miniN) problems.push('미니게임이 붙은 맵이 하나도 없다');
// **한 지대가 통째로 한 형이 되면 안 된다** — 그러면 「지대 = 형」이라 축이 겹친다
for (const [z, m] of Object.entries(byZone)) {
  if (Object.keys(m).length === 1 && m.field === undefined) {
    problems.push(`지대 ${z}: 전부 ${Object.keys(m)[0]} 형 — 평범하게 주울 곳이 없다`);
  }
}
// **미니게임마다 갈 곳이 있어야 한다.** 이름 규칙이 어긋나면 그 게임이 붙은 맵이
// 하나도 없어지는데, 화면에는 아무 오류도 안 뜬다 — 만들어 놓은 게임에 영영 못 닿는다
for (const t of D.FIELD_TYPES) {
  if (t.mini && !total[t.k]) problems.push(`${t.k} 형인 맵이 하나도 없다 — ${t.mini} 게임에 닿을 길이 없다`);
}
// **미니게임 하나는 «처음부터» 열려 있어야 한다.** 미니게임 맵이 둘뿐이라, 둘 다
// 매력을 모아야 열리는 곳이면 새 플레이어는 한참 동안 미니게임을 한 번도 못 본다
// (지금 호두 마루가 `unlock: 0` 이다)
const miniMaps = OUT.filter(o => o.type !== 'field')
  .map(o => D.MAPS.find(m => m.id === o.id));
if (miniMaps.length && !miniMaps.some(m => !m.unlock)) {
  problems.push('미니게임 맵이 전부 잠겨 있다 — 하나는 `unlock: 0` 이어야 처음부터 만난다 ('
    + miniMaps.map(m => `${m.name} ${m.unlock}`).join(' · ') + ')');
}

if (LIST) {
  for (const z of D.ZONES) {
    const list = OUT.filter(o => o.zone === z.id);
    const cnt = {};
    list.forEach(o => cnt[o.type] = (cnt[o.type] || 0) + 1);
    console.log(`── ${z.name}  (${Object.entries(cnt).map(([k, n]) => k + ' ' + n).join(' · ')})`);
    list.filter(o => o.type !== 'field').forEach(o => console.log(`   ${o.type.padEnd(8)} ${o.name}`));
  }
  console.log('\n전체:', Object.entries(total).map(([k, n]) => `${k} ${n}`).join(' · '));
}
if (problems.length) {
  console.error('❌ 형 배정에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
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

// **평범한 곳(`field`)은 안 적는다.** 쉰한 줄 중 마흔 줄이 `'field'` 이면 표를 읽을 때
// 「어디가 특별한가」가 안 보인다 — `mapType()` 이 없는 것을 `field` 로 떨어뜨린다
let body = 'const MAP_TYPES = {\n';
for (const z of D.ZONES) {
  const list = OUT.filter(o => o.zone === z.id && o.type !== 'field');
  if (!list.length) continue;
  body += `  // ${z.name}\n`;
  list.forEach(o => { body += `  ${o.id}: '${o.type}',`.padEnd(30) + `// ${o.name}\n`; });
}
body += '};\n';

const changed = replaceBlock(path.join(ROOT, 'data.js'), 'maptype', body);
if (CHECK) {
  if (changed) {
    console.error('❌ 채집지 형 표와 파일이 어긋났다 — `node tools/genmaptype.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 채집지 ${OUT.length}곳의 형이 규칙과 같다 (`
    + Object.entries(total).map(([k, n]) => `${k} ${n}`).join(' · ') + ')');
  process.exit(0);
}
console.log(`✅ 채집지 ${OUT.length}곳에 형 배정 · `
  + Object.entries(total).map(([k, n]) => `${k} ${n}`).join(' · '));
