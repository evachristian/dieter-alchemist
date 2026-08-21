// 커스터마이징 벌 생성기 — 헤어 30 · 서클렛 20 · 귀걸이 30 · 목걸이 30 · 장갑 20 · 구두 20
//
// **150벌을 손으로 쓰지 않는다.** 칸마다 축 두 개를 두고 곱한다 (CLAUDE.md 6번).
// 손으로 쓰면 중복 id · 중복 조합 · 없는 축 참조가 반드시 섞이는데, 여기서는
// 축 표가 유일한 원본이라 그런 것이 애초에 생기지 않는다. 뽑은 뒤에도 다시 검사한다.
//
// 이름은 **축 라벨을 이어 붙여** 만든다 → 한국어와 영어가 같은 표에서 동시에 나온다.
// 한쪽만 늘어나는 일이 없다 (CLAUDE.md 2번).
//
// 사용:
//   node tools/genwardrobe.js          # data.js · i18n.js 의 표시 구간을 다시 쓴다
//   node tools/genwardrobe.js --check  # 다시 쓰지 않고 검사만 (종료 코드로 알린다)
//
// 고친 뒤에는 반드시 아래를 같이 돌린다:
//   npm run test:i18n · node tools/checkavatar.js · node tools/checkui.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ─── 축 표 ────────────────────────────────────────────────────────
// a = 형태 축(실루엣이 달라진다) · b = 장식/마감 축(위에 얹힌다)
// emoji 는 b축에서 가져온다. **다섯 칸은 중복을 허용한다** (요청 확인받음) —
// 헤어만 이모지를 쓰지 않고 실루엣을 작게 그린다 (Avatar.hairIcon).
const SLOTS = {
  hair: {
    aField: 'back', bField: 'bang', icon: 'draw',
    a: [
      { k: 'long',     ko: '긴 생머리', en: 'Long' },
      { k: 'bob',      ko: '단발',      en: 'Bob' },
      { k: 'twin',     ko: '양갈래',    en: 'Twin Tails' },
      { k: 'ponytail', ko: '포니테일',  en: 'Ponytail' },
      { k: 'wave',     ko: '웨이브',    en: 'Wavy' },
      { k: 'bun',      ko: '올림머리',  en: 'Updo' },
    ],
    b: [
      { k: 'straight', ko: '',          en: '' },   // 기본 — 이름에 안 붙는다
      { k: 'side',     ko: '사이드뱅',  en: 'Side Bangs' },
      { k: 'curtain',  ko: '커튼뱅',    en: 'Curtain Bangs' },
      { k: 'sheer',    ko: '시스루뱅',  en: 'Sheer Bangs' },
      { k: 'none',     ko: '이마 노출', en: 'No Bangs' },
    ],
  },
  circlet: {
    aField: 'band', bField: 'orn',
    a: [
      { k: 'arch',  ko: '아치',   en: 'Arch' },
      { k: 'wide',  ko: '밴드',   en: 'Band' },
      { k: 'chain', ko: '체인',   en: 'Chain' },
      { k: 'crown', ko: '왕관',   en: 'Crown' },
    ],
    b: [
      { k: 'none',   ko: '',       en: '',        emoji: '👑', color: '#ffd76a' },
      { k: 'gem',    ko: '보석',   en: 'Gem',     emoji: '💎', color: '#ffe08a' },
      { k: 'flower', ko: '꽃',     en: 'Flower',  emoji: '🌸', color: '#ff9ec4' },
      { k: 'star',   ko: '별',     en: 'Star',    emoji: '⭐', color: '#ffd0a0' },
      { k: 'ribbon', ko: '리본',   en: 'Ribbon',  emoji: '🎀', color: '#ffd0e6' },
    ],
  },
  earring: {
    aField: 'form', bField: 'charm',
    a: [
      { k: 'stud',    ko: '스터드',   en: 'Stud' },
      { k: 'drop',    ko: '드롭',     en: 'Drop' },
      { k: 'hoop',    ko: '링',       en: 'Hoop' },
      { k: 'chain',   ko: '체인',     en: 'Chain' },
      { k: 'cluster', ko: '뭉치',     en: 'Cluster' },
      { k: 'cuff',    ko: '이어커프', en: 'Ear Cuff' },
    ],
    b: [
      { k: 'circle', ko: '',       en: '',       emoji: '⭕', color: '#ffd76a' },   // 기본
      { k: 'drop',   ko: '물방울',  en: 'Teardrop', emoji: '💧', color: '#8ad0ff' },
      { k: 'star',   ko: '별',      en: 'Star',   emoji: '⭐', color: '#ffe08a' },
      { k: 'heart',  ko: '하트',    en: 'Heart',  emoji: '❤️', color: '#ff9eb0' },
      { k: 'flower', ko: '꽃',      en: 'Flower', emoji: '🌸', color: '#ffb8d9' },
    ],
  },
  necklace: {
    aField: 'chain', bField: 'pend',
    a: [
      { k: 'choker', ko: '초커',     en: 'Choker' },
      { k: 'short',  ko: '숏체인',   en: 'Short Chain' },
      { k: 'long',   ko: '롱체인',   en: 'Long Chain' },
      { k: 'pearl',  ko: '진주',     en: 'Pearl' },
      { k: 'double', ko: '더블체인', en: 'Double Chain' },
      { k: 'ribbon', ko: '리본끈',   en: 'Ribbon Cord' },
    ],
    b: [
      { k: 'none',   ko: '',       en: '',         emoji: '📿', color: '#ffd76a' },
      { k: 'circle', ko: '원형',   en: 'Round',    emoji: '⭕', color: '#ffd76a' },
      { k: 'drop',   ko: '물방울', en: 'Teardrop', emoji: '💧', color: '#8ad0ff' },
      { k: 'star',   ko: '별',     en: 'Star',     emoji: '⭐', color: '#ffe08a' },
      { k: 'heart',  ko: '하트',   en: 'Heart',    emoji: '❤️', color: '#ff9eb0' },
    ],
  },
  glove: {
    aField: 'len', bField: 'finish',
    // 길이는 이미 숫자 필드다 — 축이 공짜로 하나 생긴다 (팔 길이 대비 덮는 비율)
    a: [
      { k: 'wrist',   v: 0.22, ko: '손목',   en: 'Wrist' },
      { k: 'forearm', v: 0.38, ko: '팔뚝',   en: 'Forearm' },
      { k: 'elbow',   v: 0.52, ko: '팔꿈치', en: 'Elbow' },
      { k: 'opera',   v: 0.68, ko: '오페라', en: 'Opera' },
    ],
    b: [
      { k: 'plain',  ko: '',       en: '',       emoji: '🧤', color: '#f2ddc2' },   // 기본
      { k: 'cuff',   ko: '커프',   en: 'Cuff',   emoji: '⭕', color: '#ffb3d1' },
      { k: 'frill',  ko: '프릴',   en: 'Frill',  emoji: '🤍', color: '#fff4fa' },
      { k: 'ribbon', ko: '리본',   en: 'Ribbon', emoji: '🎀', color: '#ffd0e6' },
      { k: 'strap',  ko: '스트랩', en: 'Strap',  emoji: '🧵', color: '#8a5a3c' },
    ],
  },
  shoes: {
    aField: 'rise', bField: 'finish',
    // 목 높이도 숫자 필드(발목 위로 올라오는 px)
    a: [
      { k: 'flat',  v: 0,  ko: '플랫',   en: 'Flat' },
      { k: 'low',   v: 5,  ko: '로우',   en: 'Low' },
      { k: 'ankle', v: 16, ko: '앵클',   en: 'Ankle' },
      { k: 'tall',  v: 34, ko: '롱부츠', en: 'Tall Boot' },
    ],
    b: [
      { k: 'plain',  ko: '',       en: '',       emoji: '👞', color: '#4a3a42' },   // 기본
      { k: 'strap',  ko: '스트랩', en: 'Strap',  emoji: '👠', color: '#8a5a3c' },
      { k: 'ribbon', ko: '리본',   en: 'Ribbon', emoji: '🩰', color: '#ff9ec4' },
      { k: 'sole',   ko: '밑창',   en: 'Sole',   emoji: '👟', color: '#e6e6ee' },
      { k: 'gloss',  ko: '광택',   en: 'Gloss',  emoji: '✨', color: '#b8e4ff' },
    ],
  },
};

// ─── 이미 있던 24벌 ───────────────────────────────────────────────
// **id 를 새로 뽑으면 안 된다.** 지금 그 옷을 입고 있는 세이브가 있어서,
// id 가 바뀌면 착장이 통째로 날아간다. 그래서 '지금 모습 그대로 나오는 조합' 에
// 원래 id·이름·색을 붙이고, 나머지 조합만 새 id 를 받는다.
//
// ko/en 을 적은 것은 **그 이름으로 알아보는 벌**뿐이다 (유리구두·티아라 …).
// 나머지는 적지 않는다 — 축에서 지은 이름이 150벌 사이에서 읽기 쉽다.
// 재질 이름(레이스·니트·가죽·새틴)은 일부러 뺐다: 그 넷의 차이는 대부분 색이고,
// 색은 팔레트와 염색약이 맡는다.
const LEGACY = {
  hair: {
    'long/straight':     { id: 'hair_long',     starter: true },
    'bob/straight':      { id: 'hair_bob',      starter: true },
    'twin/straight':     { id: 'hair_twin',     starter: true },
    'ponytail/straight': { id: 'hair_ponytail' },
    'wave/side':         { id: 'hair_wave' },
  },
  circlet: {
    'arch/flower': { id: 'circlet_flower', color: '#ff9ec4' },
    'crown/gem':   { id: 'circlet_tiara',  ko: '티아라', en: 'Tiara', color: '#ffe08a' },
    'arch/ribbon': { id: 'circlet_band',   color: '#ffd0e6' },
  },
  earring: {
    'drop/drop':   { id: 'earring_drop', color: '#8ad0ff' },
    'hoop/circle': { id: 'earring_hoop', color: '#ffd76a' },
    'stud/star':   { id: 'earring_star', color: '#ffe08a' },
  },
  necklace: {
    'choker/none':  { id: 'necklace_choker',  color: '#ff9ec4', emoji: '🎀' },
    'pearl/none':   { id: 'necklace_pearl',   color: '#ffffff', emoji: '🤍' },
    'short/circle': { id: 'necklace_pendant', color: '#ffd76a', emoji: '📿' },
  },
  glove: {
    'wrist/frill':   { id: 'glove_lace',    color: '#fff4fa' },
    'wrist/plain':   { id: 'glove_knit',    color: '#f2ddc2' },
    'wrist/strap':   { id: 'glove_leather', color: '#8a5a3c' },
    'forearm/cuff':  { id: 'glove_satin',   color: '#ffb3d1' },
    'opera/cuff':    { id: 'glove_opera',   color: '#b31f4a' },
  },
  shoes: {
    'flat/ribbon': { id: 'shoes_ballet',   ko: '발레플랫', en: 'Ballet Flats',   color: '#ff9ec4', emoji: '🩰' },
    'flat/strap':  { id: 'shoes_maryjane', ko: '메리제인', en: 'Mary Janes',     color: '#4a3a42', emoji: '👞' },
    'low/sole':    { id: 'shoes_sneaker',  ko: '스니커즈', en: 'Sneakers',       color: '#ffffff', emoji: '👟' },
    'ankle/plain': { id: 'shoes_boots',    ko: '앵클부츠', en: 'Ankle Boots',    color: '#8a5a3c', emoji: '🥾' },
    'flat/gloss':  { id: 'shoes_glass',    ko: '유리구두', en: 'Glass Slippers', color: '#b8e4ff', emoji: '👠' },
  },
};

// '없음' 칸 — 축 조합 밖에 따로 둔다 (헤어에는 없음이 없다: 민머리는 만들지 않는다)
const NONE_ROW = {
  circlet:  { id: 'circlet_none',  ko: '없음', en: 'None' },
  earring:  { id: 'earring_none',  ko: '없음', en: 'None' },
  necklace: { id: 'necklace_none', ko: '없음', en: 'None' },
  glove:    { id: 'glove_none',    ko: '없음', en: 'None' },
  shoes:    { id: 'shoes_none',    ko: '없음', en: 'None' },
};

// ─── 뽑기 ─────────────────────────────────────────────────────────
function build() {
  const out = {};        // slot → 아이템 배열
  const names = {};      // id → { ko, en }
  const problems = [];
  const seenId = new Set();

  for (const [slot, ax] of Object.entries(SLOTS)) {
    const items = [];
    if (NONE_ROW[slot]) {
      const n = NONE_ROW[slot];
      items.push({ id: n.id, slot, kind: 'none', name: n.ko });
      names[n.id] = { ko: n.ko, en: n.en };
    }
    const seenCombo = new Set();
    for (const a of ax.a) {
      for (const b of ax.b) {
        const key = `${a.k}/${b.k}`;
        if (seenCombo.has(key)) { problems.push(`${slot}: 조합 중복 ${key}`); continue; }
        seenCombo.add(key);
        const leg = (LEGACY[slot] || {})[key];
        const id = leg ? leg.id : `${slot}_${a.k}_${b.k}`;
        if (seenId.has(id)) { problems.push(`${slot}: id 중복 ${id}`); continue; }
        seenId.add(id);

        // 이름은 축 라벨을 이어 붙인다. 옛 벌은 원래 이름을 지킨다 —
        // '발레플랫' 을 '플랫 리본' 으로 바꿔 부를 이유가 없다
        const ko = (leg && leg.ko) || (b.ko ? `${a.ko} ${b.ko}` : a.ko);
        const en = (leg && leg.en) || (b.en ? `${a.en} ${b.en}` : a.en);
        names[id] = { ko, en };

        const it = { id, slot, kind: a.k, name: ko };
        it[ax.aField] = (a.v !== undefined) ? a.v : a.k;
        it[ax.bField] = b.k;
        if (ax.icon !== 'draw') {
          it.color = (leg && leg.color) || b.color;
          it.emoji = (leg && leg.emoji) || b.emoji;
        }
        if (leg && leg.starter) it.starter = true;
        items.push(it);
      }
    }
    out[slot] = items;
  }

  // 옛 벌이 하나도 안 빠졌는지 — 빠지면 그 옷을 입고 있던 세이브가 깨진다
  for (const [slot, map] of Object.entries(LEGACY)) {
    for (const [key, leg] of Object.entries(map)) {
      if (!out[slot].some(it => it.id === leg.id)) problems.push(`${slot}: 옛 id 가 사라졌다 ${leg.id} (${key})`);
    }
  }
  // 축 값이 실제로 렌더러가 아는 값인지는 checkavatar 가 그림으로 확인한다
  return { out, names, problems };
}

// ─── 파일에 써 넣기 ───────────────────────────────────────────────
function lit(v) { return typeof v === 'string' ? `'${v}'` : String(v); }

function itemLine(it) {
  const keys = ['id', 'slot', 'kind', 'name', 'back', 'bang', 'band', 'orn', 'form', 'charm',
                'chain', 'pend', 'len', 'rise', 'finish', 'color', 'emoji', 'starter'];
  const parts = keys.filter(k => it[k] !== undefined).map(k => `${k}: ${lit(it[k])}`);
  return `    { ${parts.join(', ')} },`;
}

function replaceBlock(file, tag, body) {
  const src = fs.readFileSync(file, 'utf8');
  const head = `// <<<GEN:${tag}`, tail = `// GEN:${tag}>>>`;
  const i = src.indexOf(head), j = src.indexOf(tail);
  if (i < 0 || j < 0) { console.error(`${path.basename(file)} 에 ${head} ~ ${tail} 표시가 없다`); process.exit(2); }
  const before = src.slice(0, src.indexOf('\n', i) + 1);
  const next = src.slice(j);
  const out = before + body + next;
  if (out === src) return false;
  if (!CHECK) fs.writeFileSync(file, out);
  return true;
}

const { out, names, problems } = build();

if (problems.length) {
  console.error('❌ 축 표에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
  process.exit(1);
}

// data.js — 여섯 칸의 배열
let dataBody = '';
for (const slot of Object.keys(SLOTS)) {
  const ax = SLOTS[slot];
  const n = out[slot].filter(it => it.kind !== 'none').length;
  dataBody += `  // ${slot} — ${ax.a.length} × ${ax.b.length} = ${n}\n`;
  dataBody += `  ${slot}: [\n${out[slot].map(itemLine).join('\n')}\n  ],\n`;
}

// i18n.js — 같은 표에서 뽑은 영어 이름
const enLines = [];
for (const slot of Object.keys(SLOTS)) {
  const ids = out[slot].map(it => it.id);
  for (let i = 0; i < ids.length; i += 3) {
    enLines.push('      ' + ids.slice(i, i + 3).map(id => `${id}: '${names[id].en}'`).join(', ') + ',');
  }
}

const changedData = replaceBlock(path.join(ROOT, 'data.js'), 'wardrobe', dataBody);
const changedI18n = replaceBlock(path.join(ROOT, 'i18n.js'), 'wardrobe-en', enLines.join('\n') + '\n');

const total = Object.values(out).reduce((n, l) => n + l.filter(it => it.kind !== 'none').length, 0);
const per = Object.keys(SLOTS).map(s => `${s} ${out[s].filter(it => it.kind !== 'none').length}`).join(' · ');
if (CHECK) {
  if (changedData || changedI18n) {
    console.error('❌ 생성 결과가 파일과 다르다 — `node tools/genwardrobe.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 생성 결과가 파일과 같다 (${per} = ${total}벌)`);
} else {
  console.log(`✅ ${per} = ${total}벌 · id 중복 0 · 조합 중복 0 · 옛 id 24개 유지`);
}
