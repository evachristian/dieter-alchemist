// 인물·대사 표 검사 — 화면에 안 나타나는 어긋남을 잡는다.
//
// **여기서 잡는 것들은 전부 「조용히 잘못되는」 종류다.**
//   · 표정 이름이 틀리면 → 기본 표정으로 조용히 떨어진다. 화면은 멀쩡해 보인다
//   · moods 길이가 lines 와 다르면 → 뒷줄이 전부 기본 표정이 된다
//   · 건물이 없는 사람을 가리키면 → 그 자리에 아무도 안 선다
//   · TALKS 에만 있고 아무 건물에도 안 앉은 사람 → 그 대사는 영영 안 보인다
//
// 사용: node tools/checktalk.js   (종료 코드 0 = 이상 없음)
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
const D = global.window.GameData;

const bad = [];
const placed = new Set();

// ── 건물에 앉은 사람
D.VILLAGES.forEach(v => (v.spots || []).forEach(s => {
  if (!s.npc) return;
  placed.add(s.npc);
  if (!D.speaker(s.npc)) bad.push(`${v.id}/${s.id}: 그런 인물이 없다 (${s.npc})`);
}));

// ── 대사표
Object.entries(D.TALKS).forEach(([id, t]) => {
  const sp = D.speaker(id);
  if (!sp) { bad.push(`TALKS: 그런 인물이 없다 (${id})`); return; }
  if (!t.lines || !t.lines.length) bad.push(`${id}: 대사가 비었다`);
  if (!placed.has(id)) bad.push(`${id}: 대사는 있는데 **아무 건물에도 안 앉았다** — 영영 안 보인다`);
  // 인사말도 있어야 한다 — 없으면 들어설 때마다 대화 첫 줄이 다시 나와
  // 인사가 아니라 되감기처럼 읽힌다
  if (!t.greet) bad.push(`${id}: 인사말(greet)이 없다 — 들어설 때 대화 첫 줄이 그대로 나온다`);
  if (t.greetMood && (!sp.moods || !sp.moods[t.greetMood]))
    bad.push(`${id}: 인사말 표정 '${t.greetMood}' 이 없다 (조용히 기본으로 떨어진다)`);
  const ms = t.moods || [];
  if (ms.length && ms.length !== t.lines.length)
    bad.push(`${id}: moods(${ms.length}) 와 lines(${t.lines.length}) 길이가 다르다 — 뒷줄이 기본 표정이 된다`);
  ms.forEach((m, i) => {
    if (!sp.moods || !sp.moods[m]) bad.push(`${id}: ${i + 1}번째 줄의 표정 '${m}' 이 없다 (조용히 기본으로 떨어진다)`);
  });
});

// ── 마을 이름이 데이터와 맞는가
// **「일곱 굴뚝」은 건물이 일곱이어야 한다.** 이름이 지도에서 그대로 세어지는 마을이라,
// 건물을 하나 더하거나 빼면 이름이 조용히 거짓말이 된다. 화면은 멀쩡해 보인다.
const CHIMNEY = D.VILLAGES.find(v => v.id === 'vl_chimney');
if (CHIMNEY && (CHIMNEY.spots || []).length !== 7)
  bad.push(`vl_chimney: 「일곱 굴뚝」인데 건물이 ${(CHIMNEY.spots || []).length}채다 — 이름이 거짓말이 된다`);

// ── 초상화 사양
const NEED = ['hair', 'hairColor', 'skin', 'cloth'];
D.SPEAKERS.forEach(sp => {
  NEED.forEach(k => { if (!sp[k]) bad.push(`${sp.id}: 초상화에 ${k} 가 없다`); });
  if (!sp.moods || !sp.moods.def) bad.push(`${sp.id}: 기본 표정(def)이 없다`);
});

console.log(`인물 ${D.SPEAKERS.length}명 · 대사 ${Object.keys(D.TALKS).length}묶음 · 앉은 자리 ${placed.size}곳`);
if (!bad.length) { console.log('✅ 인물·대사 표에 어긋난 곳 없음'); process.exit(0); }
console.log(`❌ ${bad.length}건`);
bad.forEach(m => console.log('   ' + m));
process.exit(1);
