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
// **위에서부터 먼저 걸리는 것을 쓴다.** 순서가 곧 우선순위다 — 「파수꾼의 호박 밭」은
// 이름에 `호박` 이 있어서 호박 밭 형이 먼저 걸려야 한다. 그 뒤에 과수원 규칙이 오면
// 그 맵의 호박 넷이 열매로 세어져 **과수원 형이 되어 미니게임이 바뀐다.**
//
// ⚠️ **열매를 헐겁게 잡지 않는다.** 처음에 `이끼 가지`·`고사리` 까지 열매로 세었더니
// **숲 열 곳 중 아홉 곳**이 과수원이 됐다 — 고사리는 열매가 아니고, 그렇게 되면
// 「과수원 형」이 사실상 「숲」의 다른 이름이 된다.
const NAME_RULES = [
  // 호박 밭 — 파수꾼이 호박을 굴린다 (`pumpkin.js`)
  [/호박/, 'pumpkin'],
  // 과수원 — **이름이 이미 나무·열매인 곳.** 재료를 안 봐도 여기가 어디인지 알 수 있다
  [/호두|버섯|고목|덤불|나무문|과수/, 'orchard'],
];

// 나무·덩굴·줄기에 **«달려서 따는»** 것. 곡식(밀)·풀(약초)·이슬은 열매가 아니다.
const FRUIT = [
  'berry',          // 🍓 산딸기
  'walnut',         // 🥜 호두
  'pine_cone',      // 🌰 솔방울
  'mushroom',       // 🍄 버섯
  'tree_resin',     // 🟠 나무 수액
  'cactus',         // 🌵 가시선인장
  'honey',          // 🍯 들꿀 — 벌이 꽃에서 모은 것이라 «따는» 쪽에 든다
  'zucchini', 'old_pumpkin', 'sweet_pumpkin', 'chestnut_pumpkin',
];
// 이름으로는 안 걸리는데 **재료가 열매뿐인** 곳 (「미식가의 들」·「소풍 바위」).
// 셋 이상으로 잡는 이유는 위의 ⚠️ 그대로다 — 둘이면 숲이 통째로 걸린다
const FRUIT_MIN = 3;

function typeOf(m) {
  for (const [re, k] of NAME_RULES) if (re.test(m.name)) return k;
  const n = (m.pool || []).filter(i => FRUIT.includes(i)).length;
  return n >= FRUIT_MIN ? 'orchard' : 'field';
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
const PINNED = { p_pumpkin: 'pumpkin' };
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
// **과수원이 한 지대에만 있으면 안 된다** — 그건 지대의 다른 이름일 뿐이다.
// (산악·해안에 과수원이 없는 것은 맞는 모양이다 — 나무가 자라는 땅에만 있다)
const orchardZones = Object.entries(byZone).filter(([, m]) => m.orchard).map(([z]) => z);
if (orchardZones.length < 2) {
  problems.push(`과수원이 ${orchardZones.join(',') || '아무 지대에도'} 만 있다 — 지대 둘 이상에 걸쳐야 한다`);
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
