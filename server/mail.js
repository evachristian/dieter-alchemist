// ═══════════════════════════════════════════════════════════════
//  우편 — **서버가 보낸다** (MAIL.md · 2026-10-14)
//
//  까마귀 택배회사가 매일 **오전 5:00 (KST)** 에 그날의 우편을 꺼낸다.
//  기기 시계는 우편에 아무 영향이 없다 — 「우편일」은 서버 시각에서만 나온다.
//
//  이 파일은 **순수한 규칙**이다 (입출력 없음). `index.js` 가 레코드를 읽어 와
//  `deliver()` · `claim()` 에 넘기고, 바뀐 것을 저장한다. 밭의 `battle.js` 와 같은 자리다.
//
//  ⚠️ **운은 전부 씨앗**(`seed(…)`)이다 — `Math.random()` 을 안 쓴다 (MAIL.md 1번 · 10번 원칙).
//     같은 사람·같은 날이면 늘 같은 결과라 검사할 수 있다.
//  ⚠️ **판정에 필요한 것은 저장된 세이브에서 직접 읽는다** — 호감도·매력·본 컷씬.
//     클라이언트가 보내는 값을 믿지 않는다 (밭의 전투력과 같은 규칙).
//  ⚠️ **물건을 «넣는» 것은 클라이언트다** — 옷장·가방·💎 는 로컬 세이브가 정본이라,
//     서버는 「무엇을 받았는가」만 돌려준다 (`claim`). 이미 가진 벌이면 클라이언트가 💎 로 바꾼다.
// ═══════════════════════════════════════════════════════════════
const B = require('./battle');
const D = B.D;

const DAY = 86400000;
const KST = 9 * 3600000;      // 시간대는 KST 하나다 — 해외 플레이어도 같다 (사람이 정했다)
const CUT = 5 * 3600000;      // 05:00 에 하루가 넘어간다

// 우편일 — 「KST 로 옮긴 뒤 5시간을 뺀 날짜」의 날 번호. 정수라 빼면 곧 날 수다
//   ⚠️ YYYYMMDD 를 빼서 날 수를 세지 않는다 (달을 넘는 날 71 이 나온다)
const mailDay = ts => Math.floor((ts + KST - CUT) / DAY);
// 우편일의 «달력» (그 날짜의 KST 연·월·일)
function cal(d) {
  const t = new Date(d * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}
const dayOf = (y, m, dd) => Math.floor(Date.UTC(y, m - 1, dd) / DAY);

// ─── 씨앗 ─────────────────────────────────────────────────────
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  // 한 번 더 섞는다 — FNV 만으로는 끝자리만 다른 열쇠가 너무 비슷하게 나온다
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
const seed = (...parts) => hash32(parts.join('|')) / 4294967296;

// ─── 달력 — 엄마의 편지 (MAIL.md 2-10) ─────────────────────────
// 부활절 — 서방 교회력 (그레고리력 · 익명 계산법). 해마다 3/22 ~ 4/25
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}
// 추수감사절 — 11월 넷째 목요일 (사람이 정했다)
function thanksgiving(y) {
  const first = new Date(Date.UTC(y, 10, 1)).getUTCDay();        // 11월 1일의 요일
  const firstThu = 1 + ((4 - first + 7) % 7);
  return { m: 11, d: firstThu + 21 };
}
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// ─── 세이브에서 읽는 것 ─────────────────────────────────────────
const seen = (st, cut) => Array.isArray(st.seenCuts) && st.seenCuts.includes(cut);
const questDone = (st, q) => !!(st.quest && Array.isArray(st.quest.done) && st.quest.done.includes(q));
const graduated = st => !!st.tutorialDone;
const chefHired = st => seen(st, 'c_meet_in') || questDone(st, 'q_meet');
const endingSeen = st => seen(st, 'c_epilogue');
const bondPts = (st, sp) => Number((st.bond || {})[sp]) || 0;
const bondTier = (st, sp) => D.bondTierOf(bondPts(st, sp));
const charmPeak = st => Number(st.charmPeak) || 0;
// 친함(2) 이상인 사람 — 점수 높은 순 · 같으면 SPEAKERS 순
function friends(st) {
  const order = D.SPEAKERS.map(s => s.id);
  return Object.keys(D.BONDS)
    .filter(sp => bondTier(st, sp) >= 2)
    .sort((a, b) => (bondPts(st, b) - bondPts(st, a)) || (order.indexOf(a) - order.indexOf(b)));
}
// 생일 'MM-DD' — 없으면 «공방에 온 날»(졸업한 우편일)이 생일이다 (2-10)
function birthdayOf(st, rec) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(st.birthday || ''));
  if (m) return { m: +m[1], d: +m[2], set: true };
  const c = cal(rec.gradDay != null ? rec.gradDay : 0);
  return { m: c.m, d: c.d, set: false };
}
function isBirthday(bd, c) {
  if (bd.m === c.m && bd.d === c.d) return true;
  // 2월 29일 생일은 평년에 2월 28일에 온다
  return bd.m === 2 && bd.d === 29 && !isLeap(c.y) && c.m === 2 && c.d === 28;
}

// ─── 트랙 — 수집품마다 «얻는 길은 꼭 하나» (MAIL.md 4-1) ───────
// 표를 손으로 적지 않는다 — `data.js` 의 옷장·팔레트에서 **같은 규칙으로** 뽑는다.
// 옷을 늘리면 그 벌은 저절로 출석 트랙 꼬리에 붙는다
const ORIX_TIER = ((D.BOND_GIVES.gem || {}).ids || []).filter(Boolean);
const TUTORIAL_GIFT = ['shoes_maryjane'];
const SYSTEM_COLORS = [
  { at: 15, color: 'c_blossom', crystal: 50 },
  { at: 35, color: 'c_mint', crystal: 80 },
  { at: 60, color: 'c_lavender', crystal: 120 },
  { at: 100, color: 'c_pearl', crystal: 200 },
];
const VALEN_COLORS = ['c_gold', 'c_burgundy', 'c_navy', 'c_emerald'];

function interleave(...lists) {
  const out = []; const n = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < n; i++) lists.forEach(l => { if (i < l.length) out.push(l[i]); });
  return out;
}
function buildTracks() {
  const W = D.WARDROBE;
  const taken = new Set([...ORIX_TIER, ...TUTORIAL_GIFT]);
  const pool = slot => (W[slot] || []).filter(it => it.kind !== 'none' && !it.starter && !it.mom && !taken.has(it.id)).map(it => it.id);
  const take = ids => { const got = ids.filter(id => !taken.has(id)); got.forEach(id => taken.add(id)); return got; };
  const exists = (slot, ids) => ids.filter(id => (W[slot] || []).some(it => it.id === id));

  // 사람의 트랙 — 그 사람의 «일»에서 나온 것만 (STORY.md 「그들이 주는 것」)
  const people = {};
  people.sp_althea = take(interleave(
    exists('top', ['top_tee', 'top_blouse', 'top_knit', 'top_cardigan']),
    exists('bottom', ['bottom_skirt', 'bottom_askirt', 'bottom_longskirt']),
    exists('dress', ['dress_onepiece', 'dress_midi', 'dress_puff', 'dress_gown']),
    (W.hair || []).filter(it => it.bang === 'curtain' && !it.starter).map(it => it.id)));
  people.sp_orix = take(interleave(...['circlet', 'earring', 'necklace'].map(s =>
    pool(s).filter(id => /_(gem|star)$/.test(id) || /pearl/.test(id)))));
  people.sp_kairos = take(exists('expression', ['exp_haha', 'exp_star', 'exp_love', 'exp_awe', 'exp_relief',
    'exp_warm', 'exp_proud', 'exp_curious', 'exp_ohh', 'exp_resolve', 'exp_tease']));
  people.sp_yutark = take([...pool('tattoo'), ...exists('brow', ['brow_soft', 'brow_arch', 'brow_angled',
    'brow_round', 'brow_thin', 'brow_bold', 'brow_short'])]);
  people.sp_stark = take(interleave(
    exists('glove', ['glove_leather', 'glove_knit', 'glove_wrist_cuff', 'glove_forearm_strap', 'glove_elbow_strap', 'glove_opera_strap']),
    exists('shoes', ['shoes_boots', 'shoes_ankle_strap', 'shoes_ankle_sole', 'shoes_tall_plain', 'shoes_tall_strap', 'shoes_tall_sole'])));
  people.sp_valen = take(VALEN_COLORS.filter(c => D.COLORS.some(x => x.id === c)));
  people.sp_kairos = people.sp_kairos;   // (순서 그대로)
  const sys = take(SYSTEM_COLORS.map(s => s.color));

  // 출석 — 남은 것 전부. 칸마다 «뒤쪽 4분의 1»은 주간 상자(D7)로 간다 (드문 것이 상자에)
  const rest = slot => pool(slot).filter(id => !taken.has(id));
  const split = ids => { const k = Math.floor(ids.length * 0.25); return [ids.slice(0, ids.length - k), ids.slice(ids.length - k)]; };
  const box = [];
  const front = slot => { const [a, b] = split(rest(slot)); box.push(b); return a; };
  const att = {
    color: take(D.COLORS.map(c => c.id).filter(id => !taken.has(id))),
    clothes: null, exp: null, jewel: null, acc: null,
  };
  const hair = front('hair'), top = rest('top'), bottom = rest('bottom'), brow = rest('brow');
  att.clothes = take(interleave(top, bottom, hair, brow));
  // 코(2026-10-16)는 표정 «뒤»에 붙인다 — 끼워 넣으면 이미 돌던 표정 순서가 통째로 밀린다
  att.exp = take([...rest('expression'), ...rest('nose')]);
  att.jewel = take(interleave(front('earring'), front('necklace')));
  att.acc = take(interleave(front('glove'), front('shoes'), front('circlet')));
  const dresses = rest('dress');
  att.box = take(interleave(dresses, ...box));
  return { people, sys, att };
}
const TRACKS = buildTracks();

// ─── 출석 7일 주기 (MAIL.md 2-2) ────────────────────────────────
const ATT_POOL = { 1: 'color', 2: 'clothes', 3: 'exp', 4: 'color', 5: 'jewel', 6: 'acc' };
const ATT_ORDER = [1, 2, 3, 4, 5, 6];

// 열린 지대의 재료 (밭 작물 · 히든 제외) — 씨앗으로 둘을 골라 합 n 개
function openIngs(st) {
  const peak = charmPeak(st);
  const zones = D.ZONES.filter(z => D.zoneUnlock(z.id) <= peak).map(z => z.id);
  const crops = new Set((D.FARM_CROPS || []).map(c => c.id));
  return Object.values(D.INGREDIENTS)
    .filter(it => zones.includes(it.zone) && !it.rare && (it.weight || 0) > 0 && !crops.has(it.id))
    .map(it => it.id).sort();
}
function ingPack(st, key, n) {
  const list = openIngs(st);
  if (!list.length) return [];
  const a = list[Math.floor(seed(key, 'a') * list.length)];
  const b = list[Math.floor(seed(key, 'b') * list.length)];
  const na = Math.ceil(n / 2), nb = n - na;
  return a === b ? [{ t: 'ing', id: a, n }] : [{ t: 'ing', id: a, n: na }, { t: 'ing', id: b, n: nb }];
}
const foodAt = i => D.FOODS[i % D.FOODS.length].id;

// ─── 반짝이 덤 (연속 불규칙 · MAIL.md 4-6 ①) ────────────────────
const SPARK = [
  { p: 0.70, k: 'none' },
  { p: 0.15, k: 'crystal' },
  { p: 0.08, k: 'ing' },
  { p: 0.04, k: 'food' },
  { p: 0.02, k: 'dye' },
  { p: 0.01, k: 'early' },
];
const SPARK_PITY = 4;          // 4일 연속 «없음»이면 5일째는 반드시
function sparkRoll(pid, day) {
  let r = seed(pid, day, 'spark'), acc = 0;
  for (const s of SPARK) { acc += s.p; if (r < acc) return s.k; }
  return 'none';
}

// ─── 사람의 편지 주기 (평균 · 흔들림 ×0.6~1.4 · 최소 3일) ───────
const NPC_EVERY = { sp_althea: 7, sp_clemen: 7, sp_orix: 7, sp_kairos: 14, sp_yutark: 14, sp_stark: 14, sp_valen: 28, sp_sylvan: 14 };
const NPC_ORDER = ['sp_althea', 'sp_clemen', 'sp_orix', 'sp_kairos', 'sp_yutark', 'sp_stark', 'sp_valen', 'sp_sylvan'];
function npcOpen(st, sp) {
  if (sp === 'sp_althea') return true;
  if (sp === 'sp_clemen') return chefHired(st);
  return bondTier(st, sp) >= 2;
}
function npcGap(pid, sp, n) {
  const k = 0.6 + seed(pid, sp, n, 'gap') * 0.8;
  return Math.max(3, Math.round(NPC_EVERY[sp] * k));
}

// ─── 엄마의 편지 (MAIL.md 2-10) ────────────────────────────────
const MOM_BDAY_MAX = 20;       // 생일 편지는 스무 해까지 (사람이 정했다)
const MOM_MONTHLY_MAX = 12;
// 매달 편지가 싣는 엄마의 물건 — 없는 차례는 말린 꽃
const MOM_MONTHLY_GIFT = { 1: 'mom_glove_alchemy', 2: 'mom_earring_pearl', 3: 'mom_top_cardigan',
  5: 'mom_shoes_walk', 7: 'mom_circlet_pin', 9: 'exp_mom_smile' };
// 엄마의 색 — 새해·생일(둘째 해부터) 영원 염색약
const MOM_COLORS = ['c_lilac', 'c_babypink', 'c_iceblue', 'c_butter', 'c_sage', 'c_lavender', 'c_rose', 'c_sky', 'c_apricot', 'c_pearl'];
const MOM_PRIORITY = ['first', 'bday', 'newyear', 'easter', 'thanks', 'xmas', 'monthly'];

// ─── 레코드 ───────────────────────────────────────────────────
function emptyMail() {
  return {
    v: 1, att: 0, lastDay: null, delivered: null, gradDay: null, seq: 0, shift: 0,
    box: [], auto: [], letters: [],
    ptr: {}, npc: {}, npcNext: {}, npcN: {}, sysSent: [],
    mom: { sent: [], bday: 0, monthly: 0, sched: [] },
    awayFor: null, sparkMiss: 0, claimed: {},
  };
}
function norm(rec) {
  const r = Object.assign(emptyMail(), rec || {});
  r.mom = Object.assign({ sent: [], bday: 0, monthly: 0, sched: [] }, r.mom || {});
  ['box', 'auto', 'letters', 'sysSent'].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
  ['ptr', 'npc', 'npcNext', 'npcN', 'claimed'].forEach(k => { if (!r[k] || typeof r[k] !== 'object') r[k] = {}; });
  return r;
}

const BOX_MAX = 60;
function push(rec, mail) {
  rec.seq += 1;
  const m = Object.assign({ id: 'm' + rec.seq, gifts: [], vars: {} }, mail);
  if (m.sentDay == null) m.sentDay = m.day;
  rec.box.push(m);
  // 상한을 넘으면 제일 오래된 것을 «대신 받아» 둔다 — 버리지 않는다 (MAIL.md 2-3).
  // 클라이언트가 다음에 `auto` 를 가져가 넣고 `ack` 한다
  while (rec.box.length > BOX_MAX) {
    const old = rec.box.shift();
    rec.auto.push({ nonce: 'auto-' + old.id, gifts: old.gifts, from: old.from, key: old.key });
    keepLetter(rec, old);
  }
  return m;
}
function keepLetter(rec, m) {
  rec.letters.push({ id: m.id, k: m.k, from: m.from, key: m.key, vars: m.vars, day: m.day, sentDay: m.sentDay, gifts: m.gifts });
  if (rec.letters.length > 200) rec.letters.splice(0, rec.letters.length - 200);
}

// 트랙에서 다음 것 하나
function nextOf(rec, name, list) {
  const i = rec.ptr[name] || 0;
  if (i >= list.length) return null;
  rec.ptr[name] = i + 1;
  return list[i];
}
const giftOfId = id => (/^c_/.test(id) ? { t: 'color', id, n: 1 } : { t: 'wear', id, n: 1 });

// ─── 하루치 — 출석 ────────────────────────────────────────────
function attendance(rec, st, pid, today) {
  rec.att += 1;
  const n = rec.att, d = ((n - 1) % 7) + 1, week = Math.ceil(n / 7);
  const key = pid + '|att|' + n;
  const gifts = [];
  if (d <= 6) {
    const pool = ATT_POOL[d];
    const id = nextOf(rec, pool, TRACKS.att[pool]);
    if (id) gifts.push(giftOfId(id));
    if (d === 1) gifts.push({ t: 'crystal', n: 30 });
    if (d === 2 || d === 6) gifts.push(...ingPack(st, key, 5));
    if (d === 3) gifts.push({ t: 'feed', id: 'feed_dew', n: 1 });
    if (d === 4) gifts.push({ t: 'dye', n: 1 });
    if (d === 5) gifts.push({ t: 'food', id: foodAt(week * 2), n: 1 }, { t: 'food', id: foodAt(week * 2 + 1), n: 1 });
    if (d === 4) rec.weekColor = id || null;
  } else {
    const k = week <= 14 ? 2 : 1;
    for (let i = 0; i < k; i++) { const id = nextOf(rec, 'box', TRACKS.att.box); if (id) gifts.push(giftOfId(id)); }
    gifts.push({ t: 'crystal', n: 100 });
    // 영원 염색약 — 그 주 D4 의 색. 없으면(트랙이 끝났으면) 팔레트를 주마다 돈다
    const col = rec.weekColor || D.COLORS[(week - 1) % D.COLORS.length].id;
    gifts.push({ t: 'dyeEver', id: col, n: 1 });
  }
  // 반짝이 덤
  let sp = sparkRoll(pid, today);
  if (sp === 'none' && rec.sparkMiss >= SPARK_PITY) sp = 'crystal';
  const spark = [];
  if (sp === 'crystal') spark.push({ t: 'crystal', n: 10 });
  if (sp === 'ing') spark.push(...ingPack(st, key + '|spark', 3));
  if (sp === 'food') spark.push({ t: 'food', id: foodAt(n), n: 1 });
  if (sp === 'dye') spark.push({ t: 'dye', n: 1 });
  if (sp === 'early') {
    // 출석 트랙의 «다음 칸»을 미리 — 새 것을 만들지 않는다 (얻는 길은 그대로 하나)
    for (const dd of [...ATT_ORDER.slice(d % 7), ...ATT_ORDER]) {
      const pool = ATT_POOL[dd];
      const id = pool && nextOf(rec, pool, TRACKS.att[pool]);
      if (id) { spark.push(giftOfId(id)); break; }
    }
    if (!spark.length) spark.push({ t: 'crystal', n: 10 });
  }
  rec.sparkMiss = spark.length ? 0 : rec.sparkMiss + 1;
  push(rec, { k: 'att', from: 'crow', key: d === 7 ? 'ml_crow_box' : 'ml_crow_day', day: today,
    gifts: [...gifts, ...spark], vars: { n, d, week, spark: spark.length ? 1 : 0 } });
}

// ─── 부재 묶음 (MAIL.md 2-9) ───────────────────────────────────
function absence(rec, st, pid, today) {
  if (rec.lastDay == null) return;
  const gap = today - rec.lastDay;
  if (gap < 3 || rec.awayFor === rec.lastDay) return;
  rec.awayFor = rec.lastDay;
  const fr = friends(st);
  const hired = chefHired(st);
  const sent = (from, key, gifts, at) => push(rec, { k: 'away', from, key, day: today, gifts,
    sentDay: Math.min(today - 1, rec.lastDay + at + Math.floor(seed(pid, rec.lastDay, from) * 2)) });
  const mat = sp => [{ t: 'ing', id: D.BONDS[sp].ing[0], n: 2 }];
  if (gap >= 14) {
    sent('sp_althea', 'ml_away_althea', [{ t: 'crystal', n: 20 }], 7);
    if (hired) sent('sp_clemen', 'ml_away_clemen', [{ t: 'food', id: foodAt(gap), n: 1 }], 3);
    fr.forEach(sp => sent(sp, 'ml_away_' + sp.slice(3), mat(sp), 10));
  } else if (gap >= 7) {
    sent('sp_althea', 'ml_away_althea', [{ t: 'crystal', n: 20 }], 7);
    fr.slice(0, 2).forEach(sp => sent(sp, 'ml_away_' + sp.slice(3), mat(sp), 5));
  } else {
    if (hired) sent('sp_clemen', 'ml_away_clemen', [{ t: 'food', id: foodAt(gap), n: 1 }], 3);
    else sent('sp_althea', 'ml_away_althea', [{ t: 'food', id: foodAt(gap), n: 1 }], 3);
  }
}

// ─── 엄마의 편지 — 하루 하나 · 우선순위 ──────────────────────────
function momFor(rec, st, day) {
  if (rec.gradDay == null || day <= rec.gradDay) return null;
  const sent = rec.mom.sent;
  const c = cal(day);
  const after = endingSeen(st);
  const cands = [];
  if (day === rec.gradDay + 1 && !sent.includes('first')) cands.push('first');
  if (isBirthday(birthdayOf(st, rec), c) && rec.mom.bday < MOM_BDAY_MAX && !sent.includes('bday_' + c.y)) cands.push('bday');
  if (!after) {
    if (c.m === 1 && c.d === 1 && !sent.includes('newyear')) cands.push('newyear');
    const e = easter(c.y); if (c.m === e.m && c.d === e.d && !sent.includes('easter')) cands.push('easter');
    const t = thanksgiving(c.y); if (c.m === t.m && c.d === t.d && !sent.includes('thanks')) cands.push('thanks');
    if (c.m === 12 && c.d === 25 && !sent.includes('xmas')) cands.push('xmas');
    if (c.d === 1 && rec.mom.monthly < MOM_MONTHLY_MAX) cands.push('monthly');
  }
  if (!cands.length) return null;
  const kind = MOM_PRIORITY.find(k => cands.includes(k));
  return { kind, c };
}
function momLetter(rec, st, pid, day, kind, c) {
  const addr = endingSeen(st) ? 'g' : 'a';     // 엔딩 뒤에는 「우리 공주 그위리엘」 (사람이 정했다)
  const gifts = [];
  let key;
  if (kind === 'first') { rec.mom.sent.push('first'); key = 'ml_mom_first'; gifts.push({ t: 'wear', id: 'mom_necklace_key', n: 1 }); }
  else if (kind === 'bday') {
    rec.mom.bday += 1; rec.mom.sent.push('bday_' + c.y);
    key = 'ml_mom_bday' + rec.mom.bday;
    if (rec.mom.bday === 1) gifts.push({ t: 'wear', id: 'mom_dress_ball', n: 1 });
    else gifts.push({ t: 'dyeEver', id: MOM_COLORS[(rec.mom.bday - 2) % MOM_COLORS.length], n: 1 }, { t: 'ing', id: 'petal', n: 1 });
  }
  else if (kind === 'newyear') { rec.mom.sent.push('newyear'); key = 'ml_mom_newyear'; gifts.push({ t: 'dyeEver', id: MOM_COLORS[0], n: 1 }); }
  else if (kind === 'easter') { rec.mom.sent.push('easter'); key = 'ml_mom_easter'; gifts.push({ t: 'wear', id: 'mom_circlet_wildflower', n: 1 }); }
  else if (kind === 'thanks') { rec.mom.sent.push('thanks'); key = 'ml_mom_thanks'; gifts.push({ t: 'food', id: 'food_apple', n: 2 }); }
  else if (kind === 'xmas') { rec.mom.sent.push('xmas'); key = 'ml_mom_xmas'; gifts.push({ t: 'wear', id: 'mom_necklace_star', n: 1 }); }
  else if (kind === 'monthly') {
    rec.mom.monthly += 1; const n = rec.mom.monthly;
    key = 'ml_mom_m' + n;
    if (MOM_MONTHLY_GIFT[n]) gifts.push({ t: 'wear', id: MOM_MONTHLY_GIFT[n], n: 1 });
    else gifts.push({ t: 'ing', id: 'petal', n: 1 });
  }
  else if (kind === 'gift' || kind === 'friend' || kind === 'truth') { key = 'ml_mom_' + kind; }
  rec.mom.lastDay = day;
  push(rec, { k: 'mom', from: 'mom', key, day, gifts, vars: { addr } });
}
// 조건부 셋 — 그 일을 처음 알게 된 다음 날 05:00 (MAIL.md 2-10)
function momConditions(rec, st, today) {
  const want = [];
  if (Object.keys(D.BONDS).some(sp => bondPts(st, sp) > 0)) want.push('gift');
  if (friends(st).length) want.push('friend');
  if (endingSeen(st)) want.push('truth');
  want.forEach(k => {
    const tag = 'cond_' + k;
    if (rec.mom.sent.includes(tag)) return;
    rec.mom.sent.push(tag);
    rec.mom.sched.push({ kind: k, day: today + 1 });
  });
}

// ─── 사람의 편지 ───────────────────────────────────────────────
function npcLetters(rec, st, pid, today) {
  for (const sp of NPC_ORDER) {
    if (!npcOpen(st, sp)) continue;
    if (rec.npcNext[sp] == null) { rec.npcNext[sp] = today + npcGap(pid, sp, 0); continue; }
    if (today < rec.npcNext[sp]) continue;
    const n = (rec.npcN[sp] || 0) + 1; rec.npcN[sp] = n;
    rec.npcNext[sp] = today + npcGap(pid, sp, n);
    const gifts = [];
    const track = TRACKS.people[sp] || [];
    const id = nextOf(rec, 'p_' + sp, track);
    if (id) {
      gifts.push(giftOfId(id));
      if (sp === 'sp_valen') gifts.push({ t: 'dyeEver', id, n: 1 });
    } else if (sp === 'sp_clemen') gifts.push({ t: 'food', id: foodAt(n), n: 3 });
    else if (sp === 'sp_althea') gifts.push({ t: 'crystal', n: 20 });
    else if (D.BONDS[sp]) gifts.push({ t: 'ing', id: D.BONDS[sp].ing[n % D.BONDS[sp].ing.length], n: 3 });
    push(rec, { k: 'npc', from: sp, key: 'ml_npc_' + sp.slice(3) + '_' + ((n - 1) % 3), day: today, gifts, vars: { n } });
  }
}

// ─── 시스템 — 매력 단계 ───────────────────────────────────────
function systemMail(rec, st, today) {
  const peak = charmPeak(st);
  SYSTEM_COLORS.forEach(s => {
    const tag = 'charm_' + s.at;
    if (peak < s.at || rec.sysSent.includes(tag)) return;
    rec.sysSent.push(tag);
    push(rec, { k: 'sys', from: 'scribe', key: 'ml_sys_charm', day: today,
      gifts: [{ t: 'color', id: s.color, n: 1 }, { t: 'crystal', n: s.crystal }], vars: { at: s.at } });
  });
}

// ─── 배달 — GET 마다 «그동안 배달됐어야 할 것»을 꺼내 적는다 (게으른 배달) ─────
//  돌려주는 값: 바뀌었으면 true (저장할지 판단용)
const LOOKBACK = 7400;   // 스무 해 남짓 — 엄마의 생일 편지가 끝나는 길이
function deliver(recIn, st, pid, now) {
  const rec = norm(recIn);
  const before = JSON.stringify(rec);
  const today = mailDay(now + (rec.shift || 0));
  if (!graduated(st || {})) return { rec, changed: false, today };
  st = st || {};
  if (rec.gradDay == null) rec.gradDay = today;
  if (rec.delivered == null) rec.delivered = today - 1;

  // ① 출석 — 그 우편일 첫 요청이 곧 출석이다 (부재를 먼저 잰다)
  if (rec.lastDay !== today) {
    absence(rec, st, pid, today);
    attendance(rec, st, pid, today);
    rec.lastDay = today;
  }
  // ② 엄마의 달력 — 지난 우편일부터 오늘까지 (안 들어온 날도 그 날짜로 쌓인다)
  // ③ 조건부 — 그 일을 처음 알게 된 다음 날 (달력 편지가 «먼저»다)
  momConditions(rec, st, today);
  const from = Math.max(rec.delivered + 1, today - LOOKBACK);
  for (let d = from; d <= today; d++) {
    const hit = momFor(rec, st, d);
    if (hit) momLetter(rec, st, pid, d, hit.kind, hit.c);
    // ⚠️ **엄마의 편지는 하루 한 통이다** — 조건부도 예외가 아니다. 그날 달력 편지가 왔거나
    //    첫 공방 편지보다 앞이면 다음 날로 민다 (하루에 하나씩만 꺼낸다)
    if (rec.mom.lastDay !== d && d > rec.gradDay + 1) {
      const i = rec.mom.sched.findIndex(x => x.day <= d);
      if (i >= 0) { const x = rec.mom.sched.splice(i, 1)[0]; momLetter(rec, st, pid, d, x.kind, cal(d)); }
    }
  }
  rec.delivered = Math.max(rec.delivered, today);
  // ④ 사람 · ⑤ 시스템
  npcLetters(rec, st, pid, today);
  systemMail(rec, st, today);
  return { rec, changed: JSON.stringify(rec) !== before, today };
}

// ─── 받기 — 같은 nonce 면 같은 답 (멱등 · MAIL.md 2-7) ─────────────
function claim(recIn, ids, nonce) {
  const rec = norm(recIn);
  if (rec.claimed[nonce]) return { rec, out: rec.claimed[nonce], changed: false };
  const want = new Set((ids || []).map(String));
  const got = rec.box.filter(m => want.has(m.id));
  rec.box = rec.box.filter(m => !want.has(m.id));
  got.forEach(m => keepLetter(rec, m));
  const out = { ids: got.map(m => m.id), gifts: got.flatMap(m => m.gifts || []) };
  rec.claimed[nonce] = out;
  const keys = Object.keys(rec.claimed);
  if (keys.length > 30) keys.slice(0, keys.length - 30).forEach(k => delete rec.claimed[k]);
  return { rec, out, changed: true };
}
// 자동으로 받아 둔 것(상한 넘김)을 클라이언트가 넣었다고 알린다
function ack(recIn, nonces) {
  const rec = norm(recIn);
  const set = new Set((nonces || []).map(String));
  const n0 = rec.auto.length;
  rec.auto = rec.auto.filter(a => !set.has(a.nonce));
  return { rec, changed: rec.auto.length !== n0 };
}
// 화면에 보낼 것 — 편지첩은 최근 것부터 줄인다
function view(rec, today) {
  return {
    today, att: rec.att, week: Math.ceil(rec.att / 7) || 0,
    box: rec.box, auto: rec.auto, letters: rec.letters.slice(-120),
  };
}

module.exports = {
  DAY, KST, CUT, mailDay, cal, dayOf, easter, thanksgiving, seed,
  TRACKS, SPARK, SPARK_PITY, NPC_EVERY, MOM_BDAY_MAX, MOM_MONTHLY_MAX, MOM_MONTHLY_GIFT, SYSTEM_COLORS, ORIX_TIER,
  emptyMail, norm, deliver, claim, ack, view, buildTracks, friends,
};
