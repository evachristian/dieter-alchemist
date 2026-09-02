// 인물·대사 표 검사 — 화면에 안 나타나는 어긋남을 잡는다.
//
// **여기서 잡는 것들은 전부 「조용히 잘못되는」 종류다.**
//   · 표정 이름이 틀리면 → 기본 표정으로 조용히 떨어진다. 화면은 멀쩡해 보인다
//   · moods 길이가 lines 와 다르면 → 뒷줄이 전부 기본 표정이 된다
//   · 건물이 없는 사람을 가리키면 → 그 자리에 아무도 안 선다
//   · TALKS 에만 있고 아무 건물에도 안 앉은 사람 → 그 대사는 영영 안 보인다
//
// 사용: node tools/checktalk.js   (종료 코드 0 = 이상 없음)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
require(path.join(ROOT, 'i18n.js'));
// 인트로 그림을 쓰는 인물이 있어서 같이 읽는다 (그림 함수만 정의하고 DOM 은 안 건드린다)
require(path.join(ROOT, 'intro.js'));
const D = global.window.GameData;
const I = global.window.I18N;
const Intro = global.window.Intro;

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

// ── 표정 부품 이름이 진짜 있는가
//
// ⚠️ **없는 부품 이름은 조용히 기본으로 떨어진다.** `EYE[m.eye] || EYE.normal` 이라
// `eye: 'wied'` 라고 오타를 내도 화면은 멀쩡하고, 그 표정만 영영 기본 눈이 된다.
// 그래서 `portrait.js` 에서 부품 이름을 읽어 대조한다 (소스를 그대로 본다 —
// 사본을 두면 부품을 늘릴 때 한쪽만 고치게 된다).
{
  const pt = fs.readFileSync(path.join(ROOT, 'portrait.js'), 'utf8');
  const keysOf = (head) => {
    const at = pt.indexOf(head);
    if (at < 0) return null;
    const open = pt.indexOf('{', at);
    let i = open, d = 0, end = open;
    for (; i < pt.length; i++) {
      if (pt[i] === '{') d++;
      else if (pt[i] === '}') { d--; if (!d) { end = i; break; } }
    }
    const body = pt.slice(open + 1, end);
    const out = new Set();
    body.replace(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm, (_, k) => { out.add(k); return _; });
    return out;
  };
  const EYES = keysOf('const EYE = ');
  const MOUTHS = keysOf('const MOUTH = ');
  const BROWS = keysOf('const BROW = ');
  if (!EYES || !MOUTHS || !BROWS) {
    console.error('portrait.js 에서 EYE/MOUTH/BROW 를 못 찾았다 — 이 검사기가 그 구조를 따라가야 한다');
    process.exit(2);
  }
  let moodN = 0;
  D.SPEAKERS.forEach(sp => {
    Object.entries(sp.moods || {}).forEach(([name, m]) => {
      moodN++;
      // 인트로 그림을 쓰는 사람은 눈·입을 안 쓴다 (art 로만 그린다) — 있으면 대비용이다
      if (m.eye && !EYES.has(m.eye)) bad.push(`${sp.id}/${name}: 그런 눈이 없다 (${m.eye})`);
      if (m.mouth && !MOUTHS.has(m.mouth)) bad.push(`${sp.id}/${name}: 그런 입이 없다 (${m.mouth})`);
      if (m.brow && !BROWS.has(m.brow)) bad.push(`${sp.id}/${name}: 그런 눈썹이 없다 (${m.brow})`);
    });
  });
  global.__moodN = moodN;
  global.__partN = `눈 ${EYES.size} · 입 ${MOUTHS.size} · 눈썹 ${BROWS.size}`;
}

// ── 초상화 사양
const NEED = ['hair', 'hairColor', 'skin', 'cloth'];
D.SPEAKERS.forEach(sp => {
  NEED.forEach(k => { if (!sp[k]) bad.push(`${sp.id}: 초상화에 ${k} 가 없다`); });
  if (!sp.moods || !sp.moods.def) bad.push(`${sp.id}: 기본 표정(def)이 없다`);
  // ── 인트로 그림을 쓰는 인물 (요정 대모·공주)
  // 없는 표정 이름을 적으면 **조용히 첫 표정으로 떨어진다** — 화면은 멀쩡해 보인다
  if (!sp.introArt) return;
  const poses = Intro && Intro.bustPoses ? Intro.bustPoses(sp.introArt) : null;
  if (!poses) { bad.push(`${sp.id}: 인트로에 '${sp.introArt}' 그림이 없다`); return; }
  Object.entries(sp.moods).forEach(([name, m]) => {
    if (!m.art) bad.push(`${sp.id}: 표정 '${name}' 에 인트로 표정(art)이 없다`);
    else if (!poses.includes(m.art))
      bad.push(`${sp.id}: 표정 '${name}' 의 인트로 표정 '${m.art}' 이 없다 (있는 것: ${poses.join(', ')})`);
  });
});

// ═══════════════════════════════════════════════════════════════
//  키워드 그래프 (STORY.md 「키워드 시스템 › 데이터와 검사」)
// ═══════════════════════════════════════════════════════════════
//
// **이 표는 손으로 쓰면 반드시 막힌다.** 그리고 진행이 막히는 버그는 화면에
// 아무 오류도 안 띄운다 — 플레이어는 그냥 게임을 그만둔다. 그래서 여기서 «걸어 본다».

// 시작 키워드는 **game.js 의 defaultState 가 정본**이다 (`keywords: [...]`).
// 여기에 사본을 두면 한쪽만 고쳤을 때 검사기만 옛 규칙으로 돈다.
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const startM = gameSrc.match(/^\s*keywords:\s*\[([^\]]*)\]/m);
if (!startM) {
  console.error('game.js 의 defaultState 에서 `keywords:` 를 못 찾았다 — 이 검사기가 그것을 따라가야 한다');
  process.exit(2);
}
const START = (startM[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));

// 사람이 어느 마을에 앉아 있나. **없으면 늘 닿는다** — 클레멘(부엌)이 그 경우다
const npcVillage = {};
D.VILLAGES.forEach(v => (v.spots || []).forEach(s => { if (s.npc) npcVillage[s.npc] = v.id; }));

// ── 표 자체가 성립하는가
const seenPair = new Set();
D.ASKS.forEach(a => {
  const where = `${a.npc}/${a.kw}`;
  if (!D.speaker(a.npc)) bad.push(`ASKS ${where}: 그런 인물이 없다`);
  if (!D.keyword(a.kw)) bad.push(`ASKS ${where}: 그런 키워드가 없다`);
  if (seenPair.has(where)) bad.push(`ASKS ${where}: 같은 사람에게 같은 것을 두 번 적었다 (앞엣것이 조용히 이긴다)`);
  seenPair.add(where);
  // 표정 이름이 틀리면 **조용히 기본 표정으로 떨어진다** — 화면은 멀쩡해 보인다
  const sp = D.speaker(a.npc);
  if (sp && a.mood && (!sp.moods || !sp.moods[a.mood]))
    bad.push(`ASKS ${where}: 표정 '${a.mood}' 이 없다 (조용히 기본으로 떨어진다)`);
  if (!a.line) bad.push(`ASKS ${where}: 대답(line)이 없다`);
  else if (I.t(a.line) === a.line) bad.push(`ASKS ${where}: 대답 문구가 없다 (${a.line}) — 화면에 키 이름이 그대로 뜬다`);
  (a.gives || []).forEach(k => { if (!D.keyword(k)) bad.push(`ASKS ${where}: 없는 키워드를 준다 (${k})`); });
  (a.opens || []).forEach(v => {
    if (!D.VILLAGES.find(x => x.id === v)) bad.push(`ASKS ${where}: 없는 마을을 연다 (${v})`);
  });
  // 아무 건물에도 안 앉았고 부엌에도 없는 사람은 **말을 걸 자리가 없다**
  if (!npcVillage[a.npc] && a.npc !== 'sp_clemen')
    bad.push(`ASKS ${where}: ${a.npc} 는 앉은 자리가 없다 — 이 대답은 영영 안 보인다`);
});

// 한 사람이 동시에 반응하는 키워드는 **3~5개**로 유지한다 (STORY.md 「화면」).
// 넘으면 칩 줄이 화면을 먹고, 반응 없는 것을 골라 헛걸음하는 재미는 코지 게임에 안 맞는다
const byNpc = {};
D.ASKS.forEach(a => { (byNpc[a.npc] = byNpc[a.npc] || []).push(a.kw); });
Object.entries(byNpc).forEach(([npc, list]) => {
  if (list.length > 5) bad.push(`ASKS ${npc}: 반응하는 키워드가 ${list.length}개다 (3~5개로 유지한다)`);
});

// ── 걸어 본다 — 시작 키워드만 들고 어디까지 갈 수 있나
const have = new Set(START);
const openV = new Set();
const reached = new Set();
for (let pass = 0; pass < D.ASKS.length + 2; pass++) {
  let moved = false;
  D.ASKS.forEach((a, i) => {
    if (reached.has(i)) return;
    const vi = npcVillage[a.npc];
    if (vi && !openV.has(vi)) return;          // 그 마을이 아직 안 열렸다
    if (!have.has(a.kw)) return;               // 그 키워드가 아직 없다
    reached.add(i); moved = true;
    (a.gives || []).forEach(k => have.add(k));
    (a.opens || []).forEach(v => openV.add(v));
  });
  if (!moved) break;
}

// **도달 불가능** — 아무도 주지 않는 키워드를 조건으로 쓰거나, 못 여는 마을 안에 있는 대답
D.ASKS.forEach((a, i) => {
  if (reached.has(i)) return;
  const vi = npcVillage[a.npc];
  const why = (vi && !openV.has(vi)) ? `${vi} 를 열 수가 없다` : `«${a.kw}» 를 아무도 안 준다`;
  bad.push(`도달 불가능: ${a.npc} 에게 «${a.kw}» 를 물을 수가 없다 — ${why}`);
});

// **죽은 키워드** — 가질 수는 있는데 아무도 반응하지 않는 것
const asked = new Set(D.ASKS.map(a => a.kw));
D.KEYWORDS.forEach(k => {
  if (!asked.has(k.id)) bad.push(`죽은 키워드: «${k.id}» 에 아무도 반응하지 않는다 — 들고 다닐 데가 없다`);
});

// **막다른 진행** — 지금 내보이는 마을 중 끝내 못 여는 곳
D.villagesShown().forEach(v => {
  if (!openV.has(v.id)) bad.push(`막다른 진행: ${v.id} 는 키워드로 열 방법이 없다 (탭에 자물쇠만 남는다)`);
});

// **순환** — 「A 안에서만 들을 수 있는 말이 B 를 열고, B 안의 말이 A 를 연다」
// 위의 걸어 보기에도 「도달 불가능」으로 잡히지만, 원인이 고리라는 것은 따로 말해 줘야
// 어디를 고칠지 안다 (전부 안 열린다고만 나오면 시작점을 찾을 수가 없다)
const edges = {};
D.ASKS.forEach(a => {
  const from = npcVillage[a.npc] || '*';       // '*' = 늘 닿는 자리 (부엌)
  (a.opens || []).forEach(to => { (edges[from] = edges[from] || []).push(to); });
});
const state = {};
const cyc = [];
function walk(n, trail) {
  if (state[n] === 1) { cyc.push(trail.slice(trail.indexOf(n)).concat(n).join(' → ')); return; }
  if (state[n] === 2) return;
  state[n] = 1;
  (edges[n] || []).forEach(to => walk(to, trail.concat(n)));
  state[n] = 2;
}
walk('*', []);
Object.keys(edges).forEach(n => { if (!state[n]) walk(n, []); });
cyc.forEach(c => bad.push(`순환: 마을이 서로를 연다 (${c}) — 둘 다 영영 안 열린다`));

console.log(`인물 ${D.SPEAKERS.length}명 · 대사 ${Object.keys(D.TALKS).length}묶음 · 앉은 자리 ${placed.size}곳`);
console.log(`표정 ${global.__moodN}가지 (부품 ${global.__partN})`);
console.log(`키워드 ${D.KEYWORDS.length}개 · 물어볼 것 ${D.ASKS.length}줄 · 시작 [${START.join(', ')}] → 마을 ${openV.size}곳 개방`);
if (!bad.length) { console.log('✅ 인물·대사 표에 어긋난 곳 없음'); process.exit(0); }
console.log(`❌ ${bad.length}건`);
bad.forEach(m => console.log('   ' + m));
process.exit(1);
