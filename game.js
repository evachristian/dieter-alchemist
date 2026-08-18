// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 게임 로직 & UI
// ═══════════════════════════════════════════════════════════════
const D = window.GameData;
const SAVE_KEY = 'dieter_alchemist_save_v1';
// 세이브 버전 — 기본값을 바꿨을 때 예전 세이브에도 한 번 반영하기 위해 사용
//  1: 최초  /  2: 시작 외형을 튜토리얼 인트로의 공주(갈색 긴 머리 + 연두 드레스)로 통일
//  3: 시작부터 알고 있는 하급 물약 2종
//  4: 플레이 기록(record) 추가
//  5: 이름이 서버에 예약됐는지 (nameClaimed) — 오프라인이면 임시 이름으로 먼저 진행한다
const SAVE_VER = 5;

// 처음부터 알고 있는 레시피. defaultState 와 migrate 가 같이 쓰므로 값이 어긋나지 않는다.
const STARTER_RECIPES = ['vitality', 'blush'];

// ─── i18n 단축 헬퍼 (i18n.js 없으면 한국어 원문 유지) ───
const T  = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const N  = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름
const TN = ko => (window.I18N ? I18N.n(ko, ko) : ko);          // 등급 이름

// ─── 상태 ───
const defaultState = () => ({
  inventory: {},          // { ingredientId: count }
  potions:   {},          // { potionId: count } (미사용 물약 보관)
  creatures: [],          // [creatureId, ...] (전시 중)
  stats:     { beauty: 0, charm: 0 },
  discovered: [...STARTER_RECIPES],   // 처음부터 알고 있는 하급 물약 2종
  cauldron:  [],          // 현재 마법 솥에 넣은 재료 id (솥의 구멍 수만큼)
  gathered:  0,           // 총 채집 횟수 (통계)
  outfit:    { ...D.DEFAULT_OUTFIT },  // 아바타 착장 (슬롯 → 아이템 id)
  unlocked:  [],          // 해금한 커스터마이징 아이템 id 목록 (starter 외)
  energy:    D.ENERGY.cap,  // 현재 에너지 (행동력)
  energyDay: dayKey(),      // 마지막 충전 기준 로컬 날짜 키 (YYYYMMDD)
  name:      '',            // 연금술사 이름 (튜토리얼 종료 후 입력)
  // 그 이름을 서버가 이 playerId 앞으로 잡아 줬는가.
  // 오프라인이면 일단 false 로 두고 게임을 진행시킨 뒤, 서버에 닿았을 때 확정한다.
  // (그사이 남이 같은 이름을 가져갔으면 다시 짓게 한다)
  nameClaimed: false,
  // 아우라 세부 수치 (각 0~1000)
  aura:      { happy: 100, grace: 100, unique: 100, grit: 100, luck: 100 },
  cauldronId: 'cd_iron',    // 사용 중인 마법 솥
  firstTs:   Date.now(),    // 첫 플레이 시각 — 키 성장의 기준
  record:    newRecord(),   // 플레이 기록 (누적 통계)
  rev:       0,             // 저장 횟수 — 서버 동기화에서 어느 쪽이 최신인지 판단
  ver:       SAVE_VER,      // 세이브 버전 (마이그레이션용)
});

// ─── 플레이 기록 ───
// 게임을 초기화하기 전까지 계속 쌓인다. 되돌아가서 셀 수 없는 값들이라
// (실패한 조합, 접속한 날 수 등) 그때그때 세어 둔다.
function newRecord() {
  return {
    gathered:    0,   // 채집 횟수
    specials:    0,   // 특별한 재료를 뽑은 횟수 (0.1%)
    itemsGot:    0,   // 얻은 재료 개수 (누적)
    brews:       0,   // 조합 시도
    brewOk:      0,   // 성공
    brewFail:    0,   // 실패 (찌꺼기)
    discoveries: 0,   // 새로 알아낸 레시피
    drinks:      0,   // 마신 물약
    creatures:   0,   // 만든 크리처 (누적 — 전시 목록과 달리 줄지 않는다)
    pots:        ['cd_iron'],   // 써 본 마법 솥 (중복 없이)
    playSec:     0,   // 실제로 화면을 보고 있던 시간 (초)
    days:        1,   // 접속한 날 수
    lastDay:     dayKey(),
    firstTs:     Date.now(),
    lastTs:      Date.now(),
  };
}
// 기록 갱신 — 필드가 없던 예전 세이브도 안전하게 다룬다
function rec(key, n) {
  if (!S.record) S.record = newRecord();
  S.record[key] = (S.record[key] || 0) + (n === undefined ? 1 : n);
}

// 플레이 시간 — 화면을 실제로 보고 있는 동안만 센다.
// 매초 저장하면 낭비라 30초에 한 번만 기록에 반영한다.
let _playTick = 0;
function tickPlayTime() {
  if (document.hidden || !S.record) return;
  S.record.playSec = (S.record.playSec || 0) + 1;
  // 날짜가 바뀌었으면 접속한 날 수를 올린다
  const today = dayKey();
  if (S.record.lastDay !== today) {
    S.record.lastDay = today;
    S.record.days = (S.record.days || 0) + 1;
  }
  if (++_playTick >= 30) { _playTick = 0; save(); }
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const st = Object.assign(defaultState(), parsed);
      st.outfit = Object.assign({ ...D.DEFAULT_OUTFIT }, st.outfit || {});
      st.aura = Object.assign({ happy: 100, grace: 100, unique: 100, grit: 100, luck: 100 }, st.aura || {});
      if (!st.firstTs) st.firstTs = Date.now();
      if (!st.cauldronId) st.cauldronId = 'cd_iron';
      if (!Array.isArray(st.unlocked)) st.unlocked = [];
      st.record = Object.assign(newRecord(), st.record || {});
      if (typeof st.rev !== 'number') st.rev = 0;
      // 버전은 '저장된 값' 에서 읽어야 한다.
      // (defaultState 가 최신 버전을 채워 넣으므로 병합 후의 st.ver 로는 판별할 수 없음)
      migrate(st, parsed.ver || 1);
      return st;
    }
  } catch (e) { console.warn('load failed', e); }
  return defaultState();
}
// 저장 — 로컬에 쓰고, 서버 동기화가 붙어 있으면 올려 보낸다.
// rev 는 저장할 때마다 1씩 오르는 번호로, 어느 쪽 세이브가 최신인지 판단하는 기준이다.
function save() {
  S.rev = (S.rev || 0) + 1;
  if (S.record) S.record.lastTs = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  if (window.Sync) Sync.push(S);
}
// 서버에서 더 최신 세이브를 받아 왔을 때 (sync.js 가 호출)
function adoptState(state) {
  S = Object.assign(defaultState(), state);
  S.outfit = Object.assign({ ...D.DEFAULT_OUTFIT }, S.outfit || {});
  S.record = Object.assign(newRecord(), S.record || {});
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  if (typeof render === 'function') render();
}

// 예전 세이브에 새 기본값을 한 번만 적용한다.
// (저장된 값이 항상 기본값을 덮어쓰기 때문에, 기본값만 바꾸면 기존 플레이어에게는 반영되지 않는다)
function migrate(st, from) {
  if (from >= SAVE_VER) return;
  if (from < 2) {
    // 시작 외형을 튜토리얼 인트로의 공주로 맞춘다 (옷은 언제든 다시 갈아입을 수 있음)
    st.outfit = { ...D.DEFAULT_OUTFIT };
  }
  if (from < 3) {
    // 시작 레시피 2종을 이미 플레이 중인 세이브에도 열어 준다.
    // (이미 알아낸 레시피는 그대로 두고 없는 것만 채운다)
    if (!Array.isArray(st.discovered)) st.discovered = [];
    STARTER_RECIPES.forEach(id => { if (!st.discovered.includes(id)) st.discovered.push(id); });
  }
  if (from < 5) {
    // 이름 예약이 생기기 전부터 이름을 갖고 있던 사람은 그대로 인정한다.
    // 그들의 이름은 이미 저장(PUT)을 통해 서버 컬럼에 들어가 있고,
    // 여기서 false 로 두면 멀쩡히 쓰던 이름을 다시 지으라고 하게 된다.
    st.nameClaimed = !!st.name;
  }
  st.ver = SAVE_VER;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {}
}

// ─── 유틸 ───
function invCount(id) { return S.inventory[id] || 0; }
function addInv(id, n = 1) { S.inventory[id] = invCount(id) + n; }
function removeInv(id, n = 1) {
  S.inventory[id] = Math.max(0, invCount(id) - n);
  if (S.inventory[id] === 0) delete S.inventory[id];
}
// ─── 체형 (다이어트 진행도) ───
// 시작은 튜토리얼 인트로의 '통통한 공주'. 공방에서 만든 물약을 마셔 ✨비주얼이 오르면
// 단계적으로 날씬해진다. (숫자만 바꾸면 속도/단계 수를 조절할 수 있음)
const BODY_STEPS = 4;          // 완전히 날씬해지기까지의 단계 수
const BODY_PER_STEP = 15;      // 한 단계 내려가는 데 필요한 ✨비주얼
// 0 = 날씬, 1 = 통통 (아바타 build 의 body 인자)
function bodyLevel(beauty) {
  const b = (beauty === undefined ? (S.stats.beauty || 0) : beauty);
  const step = Math.min(BODY_STEPS, Math.floor(b / BODY_PER_STEP));
  return 1 - step / BODY_STEPS;
}

// ═══════════════════════════════════════════════════════════════
//  신체 수치 (체중 · 키 · 체지방 · 근육량)
//  체형(bodyLevel 1=통통 ~ 0=날씬)과 키에서 계산한다.
//  아바타는 15살에서 시작해 시간이 지나며 170cm 까지 자란다.
//  (나이는 화면에 드러나지 않지만, 추후 '회춘 시스템'을 위해 계산해 둔다)
// ═══════════════════════════════════════════════════════════════
const VITALS = {
  ageStart: 15,               // 시작 나이
  heightMin: 150,             // 시작 키 (cm)
  heightMax: 170,             // 성장 한계 (cm)
  heightPerDay: 0.25,         // 하루에 자라는 키 (cm) → 80일이면 최대치
  bmiFat: 26.5, bmiSlim: 19.0,          // 체형에 따른 BMI
  fatPctFat: 34.0, fatPctSlim: 19.0,    // 체형에 따른 체지방률(%)
  musclePctFat: 27.0, musclePctSlim: 35.0,  // 체중 대비 근육량(%)
  gritMuscleBonus: 3.0,       // 근성 1000일 때 근육량 +3%p
};

const lerp = (a, b, t) => a + (b - a) * t;

// 첫 플레이 이후 지난 날 수 (실수)
function daysPlayed() {
  const ms = Date.now() - (S.firstTs || Date.now());
  return Math.max(0, ms / 86400000);
}
// 나이 — 화면에는 안 보이지만 회춘 시스템을 위해 유지
function ageYears() {
  return VITALS.ageStart + daysPlayed() / 365;
}
function heightCm() {
  return Math.min(VITALS.heightMax, VITALS.heightMin + daysPlayed() * VITALS.heightPerDay);
}
// 체중 = BMI × 키(m)^2. 통통할수록 BMI 가 높다.
function weightKg() {
  const w = bodyLevel();                        // 1 = 통통, 0 = 날씬
  const bmi = lerp(VITALS.bmiSlim, VITALS.bmiFat, w);
  const m = heightCm() / 100;
  return bmi * m * m;
}
function bodyFatPct() {
  const w = bodyLevel();
  return lerp(VITALS.fatPctSlim, VITALS.fatPctFat, w);
}
function bodyFatKg() { return weightKg() * bodyFatPct() / 100; }
// 근육량 = 체중 × 근육 비율. 날씬할수록, 근성이 높을수록 비율이 오른다.
function muscleKg() {
  const w = bodyLevel();
  const pct = lerp(VITALS.musclePctSlim, VITALS.musclePctFat, w)
    + VITALS.gritMuscleBonus * (auraVal('grit') / 1000);
  return weightKg() * pct / 100;
}

// ─── 아우라 세부 수치 (각 0~1000) ───
const AURA_MAX = 1000;
const AURA_KEYS = ['happy', 'grace', 'unique', 'grit', 'luck'];
function auraVal(k) { return Math.max(0, Math.min(AURA_MAX, (S.aura && S.aura[k]) || 0)); }
function addAura(k, n) {
  if (!S.aura) S.aura = {};
  S.aura[k] = Math.max(0, Math.min(AURA_MAX, (S.aura[k] || 0) + n));
}

// ─── 표시용 반올림 (요청한 자릿수 규칙) ───
const fix2 = v => v.toFixed(2);   // 소수 셋째 자리 반올림 → 둘째 자리까지
const fix1 = v => v.toFixed(1);   // 소수 둘째 자리 반올림 → 첫째 자리까지

// 매력 총합이 올라 새 채집지가 열리면 알려 준다
let lastCharmSeen = null;
function checkUnlocks() {
  const now = totalCharm();
  if (lastCharmSeen === null) { lastCharmSeen = now; return; }
  if (now <= lastCharmSeen) { lastCharmSeen = now; return; }
  const opened = D.MAPS.filter(m => m.unlock > lastCharmSeen && m.unlock <= now);
  lastCharmSeen = now;
  if (!opened.length) return;
  const names = opened.map(m => N(m.id, m.name)).join(', ');
  setTimeout(() => {
    toast(T('map_unlocked', { name: names }), null, 3200);
    if (window.Sfx) Sfx.play('success');
  }, 2200);
}

function totalCharm() {
  const creatureBonus = S.creatures.reduce((sum, cid) => {
    const r = D.RECIPES.find(x => x.result.id === cid);
    return sum + (r ? r.result.charmBonus : 0);
  }, 0);
  return S.stats.beauty + S.stats.charm + creatureBonus;
}

// 가중 랜덤 추첨
function weightedPick(pool) {
  const total = pool.reduce((s, id) => s + D.INGREDIENTS[id].weight, 0);
  let r = Math.random() * total;
  for (const id of pool) {
    r -= D.INGREDIENTS[id].weight;
    if (r <= 0) return id;
  }
  return pool[pool.length - 1];
}

// ─── 토스트 ───
// anchor(요소)를 주면 그 아이콘 근처에 말풍선처럼 표시 → 가독성↑
// (문구 길이가 늘어나도 UI와 겹치지 않도록 토스트로 처리)
let toastTimer = null;
function toast(msg, anchor, ms) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  // 줄바꿈이 있거나 문구가 길면 한 줄 말줄임 대신 여러 줄로 표시
  el.classList.toggle('multi', String(msg).indexOf('\n') >= 0 || String(msg).length > 22);

  if (anchor && anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    el.classList.add('anchored');
    el.style.visibility = 'hidden';
    el.classList.add('show');
    // 위치 계산 (화면 밖으로 나가지 않게 보정)
    const tw = el.offsetWidth, th = el.offsetHeight, pad = 8;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
    let top = r.bottom + 8;                       // 기본: 아이콘 아래
    if (top + th > window.innerHeight - pad) top = r.top - th - 8;  // 넘치면 위로
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.visibility = '';
  } else {
    el.classList.remove('anchored');
    el.style.left = ''; el.style.top = '';
    el.classList.add('show');
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms || 1800);
}

// ═══════════════════════════════════════════════════════════════
//  에너지 (행동력) — 현실 24h = 게임 24h, 로컬 자정에 충전
// ═══════════════════════════════════════════════════════════════
// 로컬 날짜 키 (YYYYMMDD 정수) — 날짜가 바뀌면(자정) 값이 달라짐
function dayKey(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
// 다음 로컬 자정까지 남은 ms
function msToNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next - now;
}
function energyCap() { return D.ENERGY.cap + (S.energyBonusCap || 0); }

// 날짜가 넘어갔으면 충전. 충전이 일어났으면 true 반환.
function refreshEnergy() {
  const today = dayKey();
  if (S.energyDay === today) return false;
  // (여러 날 지났어도) 상한까지 충전 — 현재 dailyFill == cap
  S.energy = Math.min(energyCap(), (S.energy || 0) + D.ENERGY.dailyFill);
  S.energyDay = today;
  save();
  return true;
}

// 에너지 소모 시도. 부족하면 false.
function spendEnergy(n) {
  refreshEnergy();
  if ((S.energy || 0) < n) return false;
  S.energy -= n;
  save();
  renderEnergy();
  return true;
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function renderEnergy() {
  const cap = energyCap();
  const cur = Math.max(0, Math.min(cap, S.energy || 0));
  const pct = cap > 0 ? (cur / cap) * 100 : 0;

  const fill = document.getElementById('enFill');
  const text = document.getElementById('enText');
  if (fill) fill.style.width = pct.toFixed(1) + '%';
  if (text) text.textContent = `${cur}/${cap}`;
}

function apHelp(el) { toast(T('ap_help'), el); }

// 등급 아이콘 안내 — "○○ 단계"
function tierHelp(el) {
  const tier = D.getTier(totalCharm());
  toast(T('tier_stage', { tier: TN(tier.title) }), el);
}

// ─── 글로벌 시계 (한국 UTC+9 / UTC-7) ───
// 낮(06~18시)=☀️ 해, 밤=🌙 달 로 오전/오후를 예쁘게 표시
function zoneTime(offsetHours) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const d = new Date(utcMs + offsetHours * 3600000);
  const h = d.getHours();
  const emoji = (h >= 6 && h < 18) ? '☀️' : '🌙';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${emoji} ${hh}:${pad2(d.getMinutes())}`;
}
function renderClock() {
  const a = document.getElementById('clockKST');
  if (a) a.textContent = `UTC+09:00 (${T('tz_kr')}) ${zoneTime(9)}`;
}

// 1초 틱: 카운트다운 갱신 + 자정 롤오버 자동 충전
function energyTick() {
  renderClock();
  tickPlayTime();
  if (refreshEnergy()) render();   // 충전되면 화면 전체 갱신(비활성 상태 등)
  else renderEnergy();
}

// ═══════════════════════════════════════════════════════════════
//  탭 전환
// ═══════════════════════════════════════════════════════════════
let currentTab = 'showcase';
function switchTab(tab) {
  currentTab = tab;
  window.currentTab = tab;   // 인트로에서 '이전 화면' 복귀에 사용
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.screen').forEach(s =>
    s.classList.toggle('active', s.id === 'screen-' + tab));
  render();
}

// ═══════════════════════════════════════════════════════════════
//  채집 (Gather)
// ═══════════════════════════════════════════════════════════════
function gather(mapId) {
  const map = D.MAPS.find(m => m.id === mapId);
  if (!map) return;
  if (!isMapOpen(map)) { toast(unlockText(map.unlock)); return; }
  if (!spendEnergy(D.ENERGY.cost.gather)) {
    toast(T('no_energy'));
    return;
  }
  // 0.1% 확률로 그 맵에서만 나오는 '특별한 재료'
  const isSpecial = Math.random() < D.SPECIAL_RATE;
  const id = isSpecial ? map.special : weightedPick(map.pool);
  addInv(id, 1);
  S.gathered++;
  rec('gathered'); rec('itemsGot');
  if (isSpecial) rec('specials');
  save();
  const ing = D.INGREDIENTS[id];
  if (isSpecial) {
    toast(T('got_special', { emoji: ing.emoji, name: N(ing.id, ing.name) }), null, 3200);
    if (window.Sfx) Sfx.play('success');
  } else {
    toast(T('got_item', { emoji: ing.emoji, name: N(ing.id, ing.name) }));
  }
  // 채집 애니메이션
  const card = document.querySelector(`.spot-card[data-spot="${mapId}"]`);
  if (card) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
  render();
}

// ═══════════════════════════════════════════════════════════════
//  공방 / 가마솥 (Atelier)
// ═══════════════════════════════════════════════════════════════
function addToCauldron(id) {
  if (S.cauldron.length >= cauldronSlots()) { toast(T('cauldron_full', { n: cauldronSlots() })); return; }
  if (invCount(id) - S.cauldron.filter(x => x === id).length <= 0) {
    toast(T('not_enough_mat')); return;
  }
  S.cauldron.push(id);
  save(); render();
}
function removeFromCauldron(idx) {
  S.cauldron.splice(idx, 1);
  save(); render();
}
function clearCauldron() { S.cauldron = []; save(); render(); }

// 채집 가방 접기/펼치기 (기본: 닫힘)
let bagOpen = false;
function toggleBag() { bagOpen = !bagOpen; applyBagState(); }
function applyBagState() {
  const bag = document.getElementById('ingredientBag');
  const chev = document.getElementById('bagChevron');
  if (bag) bag.style.display = bagOpen ? '' : 'none';
  if (chev) chev.textContent = bagOpen ? '▾' : '▸';
}

function brew() {
  if (S.cauldron.length < 2) { toast(T('need_two')); return; }
  if (!spendEnergy(D.ENERGY.cost.brew)) {
    toast(T('no_energy'));
    return;
  }
  // 재료 소모
  for (const id of S.cauldron) removeInv(id, 1);
  const key = D.recipeKey(S.cauldron);
  const result = D.RECIPE_MAP[key];
  S.cauldron = [];

  rec('brews');
  if (!result) {
    rec('brewFail');
    save(); render();
    showBrewResult(D.SLUDGE, false);
    return;
  }

  rec('brewOk');
  const isNew = !S.discovered.includes(result.id);
  if (isNew) {
    rec('discoveries');
    S.discovered.push(result.id);
    lastFound = result.id;              // 레시피 북에서 맨 위로 올려 강조
    // 발견한 카테고리로 레시피 북을 자동 전환
    const cat = D.RECIPE_CATS.find(c => c.match({ result }));
    if (cat) recipeTab = cat.id;
  }

  if (result.kind === 'potion') {
    S.potions[result.id] = (S.potions[result.id] || 0) + 1;
  } else if (result.kind === 'creature') {
    rec('creatures');
    S.creatures.push(result.id);
    // 크리처는 행운을 부른다 — 전시 매력 보너스 × 8 만큼 행운 상승
    addAura('luck', (result.charmBonus || 0) * 8);
  }
  save(); render();
  checkUnlocks();
  showBrewResult(result, isNew);
  // ??? 였던 레시피가 열리면 알림 (조합 결과 모달 위에 표시)
  if (isNew) {
    setTimeout(() => toast(T('recipe_found', { name: N(result.id, result.name) }), null, 3000), 900);
  }
}

// ═══════════════════════════════════════════════════════════════
//  물약 사용 (Showcase)
// ═══════════════════════════════════════════════════════════════
function drinkPotion(potionId) {
  if ((S.potions[potionId] || 0) <= 0) return;
  const r = D.RECIPES.find(x => x.result.id === potionId);
  if (!r) return;
  S.potions[potionId]--;
  if (S.potions[potionId] === 0) delete S.potions[potionId];
  rec('drinks');
  const beforeBody = bodyLevel();
  S.stats.beauty += r.result.beauty || 0;
  S.stats.charm  += r.result.charm  || 0;
  // 물약마다 아우라 세부 수치가 다르게 오른다 (아우라 획득량 × 5)
  const gain = (r.result.charm || 0) * 5;
  if (gain > 0) {
    const kinds = AURA_BY_POTION[r.result.id] || AURA_KEYS;
    kinds.forEach(k => addAura(k, Math.round(gain / kinds.length)));
  }
  save();
  toast(T('drank', { emoji: r.result.emoji, name: N(r.result.id, r.result.name), b: r.result.beauty, c: r.result.charm }));
  render();
  checkUnlocks();
  // 살 빠지는 연출 — 단계가 내려가면 크게, 아니면 반짝임만
  const afterBody = bodyLevel();
  playSlimFx(afterBody < beforeBody ? (afterBody === 0 ? 'done' : 'step') : 'sip');
  if (afterBody < beforeBody) {
    setTimeout(() => {
      toast(T(afterBody === 0 ? 'body_done' : 'body_down'), null, 2600);
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
//  조합 결과 모달
// ═══════════════════════════════════════════════════════════════
function showBrewResult(result, isNew) {
  const modal = document.getElementById('brewModal');
  const body = document.getElementById('brewModalBody');
  const success = result.kind !== 'sludge';
  let statLine = '';
  if (result.kind === 'potion') {
    statLine = `<div class="brew-stats">${T('brew_stat', { b: result.beauty, c: result.charm })}</div>`;
  } else if (result.kind === 'creature') {
    statLine = `<div class="brew-stats">${T('brew_creature', { n: result.charmBonus })}</div>`;
  }
  body.innerHTML = `
    ${isNew ? `<div class="brew-new">${T('brew_new')}</div>` : ''}
    <div class="brew-emoji ${success ? 'pop' : ''}">${result.emoji}</div>
    <div class="brew-name">${N(result.id, result.name)}</div>
    <div class="brew-desc">${N(result.id + '_desc', result.desc)}</div>
    ${statLine}
  `;
  modal.classList.add('show');
  window.Sfx && Sfx.play(success ? 'success' : 'fail');
}
function closeBrewModal() {
  document.getElementById('brewModal').classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════
//  렌더링
// ═══════════════════════════════════════════════════════════════
function render() {
  renderHeader();
  renderEnergy();
  renderClock();
  if (currentTab === 'gather') renderGather();
  if (currentTab === 'atelier') renderAtelier();
  if (currentTab === 'showcase') renderShowcase();
  // 스크롤 핸들러는 document 에 위임돼 있어 다시 붙일 필요가 없다. 선택 탭 정렬만 해 준다.
  document.querySelectorAll('.cat-tabs').forEach(centerActiveTab);
}

function renderHeader() {
  const total = totalCharm();
  const tier = D.getTier(total);
  document.getElementById('hdrTier').textContent = tier.emoji;   // 아이콘만 (문구는 토스트로)
  document.getElementById('hdrCharm').textContent = total;       // 매력 총합 점수
}

function renderGather() {
  const cost = D.ENERGY.cost.gather;
  const canGather = (S.energy || 0) >= cost;

  // 지대 탭 — 잠긴 지대는 자물쇠로 표시하고 조건을 안내
  const zoneEl = document.getElementById('zoneTabs');
  if (zoneEl) {
    zoneEl.innerHTML = D.ZONES.map(z => {
      const open = isZoneOpen(z);
      return `<button class="cat-tab ${gatherZone === z.id ? 'active' : ''} ${open ? '' : 'locked'}"
        onclick="setGatherZone('${z.id}', this)">${open ? z.emoji : '🔒'} ${N(z.id, z.name)}</button>`;
    }).join('');
  }

  const el = document.getElementById('spotList');
  el.innerHTML = D.MAPS.filter(m => m.zone === gatherZone).map(spot => {
    // 잠긴 맵: 이름만 남기고 해금 조건을 보여 준다
    if (!isMapOpen(spot)) {
      return `
        <div class="spot-card locked" data-spot="${spot.id}" onclick="lockedMapInfo('${spot.id}', this)">
          <div class="spot-emoji">🔒</div>
          <div class="spot-info">
            <div class="spot-name">${N(spot.id, spot.name)}</div>
            <div class="spot-desc">${unlockText(spot.unlock)}</div>
          </div>
          <div class="spot-go">${T('locked_go')}</div>
        </div>`;
    }
    const chips = spot.pool.map(id => D.INGREDIENTS[id].emoji).join(' ');
    const sp = D.INGREDIENTS[spot.special];
    // 특별한 재료는 한 번이라도 얻었을 때만 정체를 보여 준다
    const found = invCount(spot.special) > 0;
    const spChip = `<span class="spot-special ${found ? 'found' : ''}" title="${T('special_hint')}">${found ? sp.emoji : '❔'}</span>`;
    return `
      <div class="spot-card ${canGather ? '' : 'low-energy'}" data-spot="${spot.id}" onclick="gather('${spot.id}')">
        <div class="spot-emoji">${spot.emoji}</div>
        <div class="spot-info">
          <div class="spot-name">${N(spot.id, spot.name)}</div>
          <div class="spot-desc">${N(spot.id + '_desc', spot.desc)}</div>
          <div class="spot-pool">${chips} ${spChip}</div>
        </div>
        <div class="spot-go">${T('gather_go')} <span class="cost-tag">⚡${cost}</span></div>
      </div>`;
  }).join('');
}

function renderAtelier() {
  // 가마솥 슬롯
  // 솥 선택 줄
  const cdEl = document.getElementById('cauldronPicker');
  if (cdEl) {
    cdEl.innerHTML = D.CAULDRONS.map(c => {
      const open = isCauldronOpen(c);
      return `<button class="cat-tab ${S.cauldronId === c.id ? 'active' : ''} ${open ? '' : 'locked'}"
        onclick="chooseCauldron('${c.id}', this)">${open ? c.emoji : '🔒'} ${N(c.id, c.name)} ${c.slots}${T('slot_unit')}</button>`;
    }).join('');
  }

  // 재료 구멍 — 솥의 구멍 수만큼 원형으로 배치
  const slots = document.getElementById('cauldronSlots');
  const n = cauldronSlots();
  slots.className = 'cauldron-slots n' + n;
  let slotsHtml = '';
  // 구멍이 많을수록 원을 조금 키워 서로 붙지 않게 한다 (36% → 41%)
  const radius = n <= 6 ? 36 : 36 + (n - 6) * (5 / 6);
  for (let i = 0; i < n; i++) {
    const id = S.cauldron[i];
    // 원 위에 고르게 배치 (위쪽부터 시계 방향)
    const ang = -Math.PI / 2 + i * 2 * Math.PI / n;
    const rx = 50 + Math.cos(ang) * radius, ry = 50 + Math.sin(ang) * radius;
    const pos = `left:${rx.toFixed(1)}%;top:${ry.toFixed(1)}%`;
    if (id) {
      const rare = D.INGREDIENTS[id].rare ? ' rare' : '';
      slotsHtml += `<div class="c-slot filled${rare}" style="${pos}" onclick="removeFromCauldron(${i})">
        ${D.INGREDIENTS[id].emoji}<span class="c-slot-x">✕</span></div>`;
    } else {
      slotsHtml += `<div class="c-slot empty" style="${pos}">+</div>`;
    }
  }
  slots.innerHTML = slotsHtml;

  // 조합 비용 표시
  const bc = document.getElementById('brewCost');
  if (bc) bc.textContent = `⚡${D.ENERGY.cost.brew}`;

  // 인벤토리 (재료)
  const invEl = document.getElementById('ingredientBag');
  const ids = Object.keys(S.inventory);
  if (ids.length === 0) {
    invEl.innerHTML = `<div class="empty-hint">채집으로 재료를 모아보세요 🌿</div>`;
  } else {
    invEl.innerHTML = ids.map(id => {
      const ing = D.INGREDIENTS[id];
      const inCauldron = S.cauldron.filter(x => x === id).length;
      const avail = invCount(id) - inCauldron;
      return `
        <div class="ing-chip ${avail <= 0 ? 'disabled' : ''}" onclick="addToCauldron('${id}')">
          <span class="ing-emoji">${ing.emoji}</span>
          <span class="ing-name">${N(ing.id, ing.name)}</span>
          <span class="ing-count">×${avail}</span>
        </div>`;
    }).join('');
  }

  // 채집 가방 접힘/펼침 상태 반영
  const bagCount = document.getElementById('bagCount');
  if (bagCount) bagCount.textContent = ids.length ? T('bag_kinds', { n: ids.length }) : T('bag_empty');
  applyBagState();

  // 레시피 북 — 카테고리 탭 + 해당 카테고리 목록
  const catEl = document.getElementById('recipeTabs');
  if (catEl) {
    catEl.innerHTML = D.RECIPE_CATS.map(c =>
      `<button class="cat-tab rb-tab ${recipeTab === c.id ? 'active' : ''}" onclick="setRecipeTab('${c.id}')">${N(c.id + '_cat', c.label)}</button>`
    ).join('');
  }
  const cat = D.RECIPE_CATS.find(c => c.id === recipeTab) || D.RECIPE_CATS[0];
  // 알아낸 레시피를 위로 (방금 알아낸 것이 가장 위), ??? 는 아래로
  const catRecipes = D.RECIPES.filter(cat.match).slice().sort((a, b) => {
    const rank = r => (r.result.id === lastFound ? 0 : S.discovered.includes(r.result.id) ? 1 : 2);
    return rank(a) - rank(b);
  });

  const bookEl = document.getElementById('recipeBook');
  bookEl.innerHTML = catRecipes.map(r => {
    const found = S.discovered.includes(r.result.id);
    const inputs = r.inputs.map(id => D.INGREDIENTS[id].emoji).join(' + ');
    if (found) {
      // 재료가 다 있고 구멍도 충분하면 눌러서 한 번에 담을 수 있다
      const ready = canFillRecipe(r);
      return `<div class="recipe-row clickable ${ready ? '' : 'short'} ${r.result.id === lastFound ? 'just-found' : ''}"
        data-recipe="${r.result.id}" onclick="fillFromRecipe('${r.result.id}', this)">
        <span class="recipe-in">${inputs}</span>
        <span class="recipe-arrow">→</span>
        <span class="recipe-out">${r.result.emoji} ${N(r.result.id, r.result.name)}</span>
      </div>`;
    }
    return `<div class="recipe-row locked">
      <span class="recipe-in">? + ?</span>
      <span class="recipe-arrow">→</span>
      <span class="recipe-out">❓ ???</span>
    </div>`;
  }).join('');
  // 진행도는 현재 카테고리 기준
  const catFound = catRecipes.filter(r => S.discovered.includes(r.result.id)).length;
  document.getElementById('recipeProgress').textContent =
    `${catFound} / ${catRecipes.length}`;
}

function renderShowcase() {
  const total = totalCharm();
  const tier = D.getTier(total);

  // 아바타(내 캐릭터) + 전시 크리처
  const stage = document.getElementById('charStage');
  const creatureEmojis = S.creatures.map(cid => {
    const r = D.RECIPES.find(x => x.result.id === cid);
    return r ? `<span class="stage-creature">${r.result.emoji}</span>` : '';
  }).join('');
  const avatarSvg = window.Avatar ? window.Avatar.build(S.outfit, bodyLevel(), tuneScales()) : tier.emoji;
  const sceneSvg = window.Avatar && window.Avatar.roomScene ? window.Avatar.roomScene() : '';
  stage.innerHTML = `
    <div class="room-scene">${sceneSvg}</div>
    <div class="char-aura" style="--glow:${Math.min(total, 100)}">
      <div class="char-body">${avatarSvg}</div>
      <div id="slimFx" class="slim-fx"></div>
      <div class="stage-creatures">${creatureEmojis}</div>
    </div>`;
  // 물약을 마신 직후면 살 빠지는 연출을 이어서 재생
  if (pendingSlimFx) { const lv = pendingSlimFx; pendingSlimFx = null; playSlimFx(lv); }

  // 옷장
  renderWardrobe();

  // 하위 탭(옷/물약/크리처) 표시 상태 반영
  updateRoomTabs();

  // 제목 — "'이름'의 룸" (이름이 아직 없으면 기본 문구)
  const titleEl = document.getElementById('roomTitle');
  if (titleEl) titleEl.textContent = S.name ? T('screen_room_named', { name: S.name }) : T('screen_room');

  // 신체 · 아우라 상세 수치
  renderVitals();

  // 바디 파츠 조절 (임시 · 테스트용)
  renderBodyTune();

  // 스탯
  document.getElementById('statBeauty').textContent = S.stats.beauty;
  document.getElementById('statCharm').textContent = S.stats.charm;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('showcaseTier').textContent = tier.emoji;  // 아이콘만
  const tierNameEl = document.getElementById('tierName');
  if (tierNameEl) tierNameEl.textContent = T('tier_stage', { tier: TN(tier.title) });

  // 보유 물약
  const potEl = document.getElementById('potionShelf');
  const pids = Object.keys(S.potions);
  const potionHint = document.getElementById('potionHint');
  if (potionHint) potionHint.style.display = pids.length === 0 ? 'none' : 'block';
  if (pids.length === 0) {
    potEl.innerHTML = `<div class="empty-hint clickable" onclick="switchTab('atelier')">${T('empty_potions')}</div>`;
  } else {
    potEl.innerHTML = pids.map(pid => {
      const r = D.RECIPES.find(x => x.result.id === pid);
      if (!r) return '';
      return `<div class="potion-card" onclick="drinkPotion('${pid}')">
        <div class="potion-emoji">${r.result.emoji}</div>
        <div class="potion-name">${N(r.result.id, r.result.name)}</div>
        <div class="potion-eff">✨+${r.result.beauty} 💖+${r.result.charm}</div>
        <div class="potion-count">×${S.potions[pid]}</div>
        <div class="potion-use">${T('hint_drink').replace('👆 ','')}</div>
      </div>`;
    }).join('');
  }

  // 크리처 컬렉션
  const colEl = document.getElementById('creatureCollection');
  if (S.creatures.length === 0) {
    colEl.innerHTML = `<div class="empty-hint clickable" onclick="switchTab('atelier')">${T('empty_creatures')}</div>`;
  } else {
    const counts = {};
    S.creatures.forEach(c => counts[c] = (counts[c] || 0) + 1);
    colEl.innerHTML = Object.keys(counts).map(cid => {
      const r = D.RECIPES.find(x => x.result.id === cid);
      if (!r) return '';
      return `<div class="creature-card">
        <div class="creature-emoji">${r.result.emoji}</div>
        <div class="creature-name">${N(r.result.id, r.result.name)}</div>
        <div class="creature-eff">💖+${r.result.charmBonus}</div>
        ${counts[cid] > 1 ? `<div class="creature-count">×${counts[cid]}</div>` : ''}
      </div>`;
    }).join('');
  }
}

// ─── 나의 방 하위 탭 (옷 / 물약 / 크리처) ───
let roomTab = 'clothes';
function setRoomTab(t) { roomTab = t; updateRoomTabs(); }
function updateRoomTabs() {
  document.querySelectorAll('.room-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.rtab === roomTab));
  document.querySelectorAll('.room-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'roomPanel-' + roomTab));
}

// ═══════════════════════════════════════════════════════════════
//  옷장 (Wardrobe) — 아바타 착장 + 커스터마이징 잠금/해금
// ═══════════════════════════════════════════════════════════════
let wardrobeTab = 'hair';

// ═══════════════════════════════════════════════════════════════
//  콘텐츠 해금 — 매력 총합이 기준 점수에 닿으면 열린다
//  안내 문구: "○○ 단계 N점 달성 시 오픈" (단계 이름은 N 에서 자동 계산)
// ═══════════════════════════════════════════════════════════════
function isMapOpen(m)  { return totalCharm() >= m.unlock; }
function isZoneOpen(z) { return totalCharm() >= D.zoneUnlock(z.id); }
// 해금 조건 문구 — 점수에 해당하는 단계 이름을 붙여 준다
function unlockText(score) {
  const tier = D.getTier(score);
  return T('unlock_at', { tier: TN(tier.title), score: score });
}

// ─── 마법 솥 ───
// 선택한 솥의 구멍 수만큼 재료를 넣을 수 있다 (3구 → 12구)
function currentCauldron() {
  return D.CAULDRONS.find(c => c.id === S.cauldronId) || D.CAULDRONS[0];
}
function cauldronSlots() { return currentCauldron().slots; }
function isCauldronOpen(c) { return totalCharm() >= c.unlock; }
function chooseCauldron(id, el) {
  const c = D.CAULDRONS.find(x => x.id === id);
  if (!c) return;
  if (!isCauldronOpen(c)) { toast(unlockText(c.unlock), el); return; }
  S.cauldronId = id;
  if (S.record && !S.record.pots.includes(id)) S.record.pots.push(id);
  // 구멍이 줄어들면 넘치는 재료는 가방으로 되돌린다
  while (S.cauldron.length > c.slots) S.cauldron.pop();
  save(); render();
  toast(T('cauldron_picked', { name: N(c.id, c.name), n: c.slots }), el);
}

// 채집 지대 (채집 화면의 카테고리 탭)
let gatherZone = 'plain';
function setGatherZone(id, el) {
  const z = D.ZONES.find(x => x.id === id);
  if (z && !isZoneOpen(z)) { toast(unlockText(D.zoneUnlock(id)), el); return; }
  gatherZone = id;
  render();
  centerActiveTab(document.querySelector('#zoneTabs'), true);
}
// 잠긴 맵을 눌렀을 때 조건 안내
function lockedMapInfo(mapId, el) {
  const m = D.MAPS.find(x => x.id === mapId);
  if (m) toast(unlockText(m.unlock), el);
}

// 레시피 북 카테고리 (하급/중급/상급 물약 · 크리처)
let recipeTab = 'low';
let lastFound = null;      // 방금 알아낸 레시피 id (목록 맨 위로 올려 강조)
// 탭을 고른 순간에는 그 탭이 화면 밖이면 당겨온다 (다시 그리기만으로는 당기지 않는다 — centerActiveTab 참고)
function setRecipeTab(id) {
  recipeTab = id; render();
  centerActiveTab(document.querySelector('#recipeTabs'), true);
}
function setWardrobeTab(slot) {
  wardrobeTab = slot; renderWardrobe();
  centerActiveTab(document.querySelector('#wardrobe .cat-tabs'), true);
}

function slotMeta(slot) { return D.WARDROBE_SLOTS.find(m => m.slot === slot); }
// 아이템 보유 여부: 잠금 슬롯이 아니거나 / '없음' / starter / 해금목록에 있으면 보유
function isOwned(slot, it) {
  if (!slotMeta(slot) || !slotMeta(slot).gated) return true;
  if (it.kind === 'none' || it.starter) return true;
  return S.unlocked.includes(it.id);
}

function equip(slot, id) {
  const it = (D.WARDROBE[slot] || []).find(x => x.id === id);
  if (!it) return;
  if (!isOwned(slot, it)) { toast(T('locked_item')); return; }
  // 상·하의를 고르면 원피스는 벗고, 원피스를 고르면 그대로 (렌더에서 상하의 무시)
  if (slot === 'top' || slot === 'bottom') S.outfit.dress = 'dress_none';
  S.outfit[slot] = id;
  save();
  renderShowcase();  // 아바타 + 옷장 동시 갱신
}

// 커스터마이징 해금 (추후 진행 보상에서 호출) — 콘솔/보상 공용 API
function unlockCosmetic(id) {
  for (const m of D.WARDROBE_SLOTS) {
    const it = (D.WARDROBE[m.slot] || []).find(x => x.id === id);
    if (!it) continue;
    if (isOwned(m.slot, it)) return false;   // 이미 보유
    S.unlocked.push(id);
    save();
    wardrobeTab = m.slot;
    toast(T('unlocked', { name: N(it.id, it.name) }));
    if (currentTab === 'showcase') renderShowcase();
    return true;
  }
  return false;
}
window.unlockCosmetic = unlockCosmetic;

// 테스트용: 잠긴 아이템 중 하나를 무작위 해금
function unlockRandom() {
  const locked = [];
  D.WARDROBE_SLOTS.filter(m => m.gated).forEach(m =>
    (D.WARDROBE[m.slot] || []).forEach(it => { if (!isOwned(m.slot, it)) locked.push(it.id); }));
  if (!locked.length) { toast(T('all_unlocked')); return; }
  unlockCosmetic(locked[Math.floor(Math.random() * locked.length)]);
}

function renderWardrobe() {
  const el = document.getElementById('wardrobe');
  if (!el) return;
  const dressed = S.outfit.dress && S.outfit.dress !== 'dress_none';
  const meta = slotMeta(wardrobeTab);

  const tabs = D.WARDROBE_SLOTS.map(m => {
    const dimmed = dressed && (m.slot === 'top' || m.slot === 'bottom');
    return `<button class="cat-tab wr-tab ${wardrobeTab === m.slot ? 'active' : ''} ${dimmed ? 'dim' : ''}"
      onclick="setWardrobeTab('${m.slot}')">${m.emoji} ${N(m.slot, m.label)}</button>`;
  }).join('');

  const list = D.WARDROBE[wardrobeTab] || [];
  const items = list.map(it => {
    const on = S.outfit[wardrobeTab] === it.id;
    const owned = isOwned(wardrobeTab, it);
    let ic;
    if (it.kind === 'none') ic = '🚫';
    else if (it.emoji) ic = it.emoji;
    else ic = `<span class="wr-swatch" style="background:${it.color || '#ccc'}"></span>`;
    const lock = owned ? '' : '<span class="wr-lock">🔒</span>';
    return `<button class="wr-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}" onclick="equip('${wardrobeTab}','${it.id}')">
      <span class="wr-ic">${ic}${lock}</span><span class="wr-nm">${N(it.id, it.name)}</span></button>`;
  }).join('');

  // 잠금 슬롯이면 보유 현황 + 획득 안내
  let foot = '';
  if (meta && meta.gated) {
    const total = list.length, have = list.filter(it => isOwned(wardrobeTab, it)).length;
    foot = `<div class="wr-foot">
      <span class="wr-count">${T('wr_owned', { have: have, total: total })}</span>
      <button class="wr-gift" onclick="unlockRandom()">${T('wr_gift')}</button>
    </div>`;
  }
  const hint = dressed && (wardrobeTab === 'top' || wardrobeTab === 'bottom')
    ? `<div class="wr-hint">${T('dress_hint')}</div>` : '';

  // 탭 줄은 다시 그릴 때마다 새 요소가 된다 — 굴려 둔 위치와 '맞춤 끝' 표시를 그대로 물려준다.
  // (안 물려주면 탭이나 아이템을 만질 때마다 선택 탭으로 튕겨 스크롤이 안 되는 것처럼 보인다)
  const prevRow = el.querySelector('.cat-tabs');
  const keepLeft = prevRow ? prevRow.scrollLeft : 0;
  const keepCentered = prevRow ? prevRow.dataset.centered : '';

  el.innerHTML = `<div class="cat-tabs wr-tabs">${tabs}</div>${hint}<div class="wr-items">${items}</div>${foot}`;

  const row = el.querySelector('.cat-tabs');
  row.scrollLeft = keepLeft;
  if (keepCentered) row.dataset.centered = keepCentered;
  centerActiveTab(row);          // 처음 한 번만 맞춘다 (선택 변경은 setWardrobeTab 이 따로 처리)
}

// ═══════════════════════════════════════════════════════════════
//  바디 파츠 조절 (임시 · 테스트용 — 출시 때 이 블록과 index.html 의 #bodyTune 을 지운다)
//  버튼을 누르고 있으면 값이 계속 오르내린다.
//  세이브에는 넣지 않는다 — 별도 localStorage 키로만 두어 SAVE_VER·migrate 를 건드리지 않고,
//  서버로도 올라가지 않게 한다 (테스트 값이 남의 기기까지 따라다니면 곤란하다)
// ═══════════════════════════════════════════════════════════════
const TUNE_KEY = 'dieter_alchemist_bodytune_v1';
// 상한은 파츠마다 다르다. 아바타 캔버스(viewBox 200×348)를 벗어나면 잘려 보이므로
// **실측한 안전 한계 안에서** 잡았다 (체형 통통~날씬 전 구간 기준):
//   얼굴  120% 에서 머리 위가 잘린다 (200% 면 위로 100px — 캔버스의 3분의 1) → 114
//   몸통  170% 까지는 안 잘리지만 그만큼 키우면 판때기처럼 보인다 → 150
//   팔    혼자서는 200% 도 안 잘리는데, 몸통을 키우면 팔이 바깥으로 밀려나서
//         몸통 150% + 팔 200% 조합이 좌우로 9.1px 넘친다 → 150 (그 조합에서 0)
//   허벅지·종아리는 조합에서도 200% 까지 안전
// **한 파츠씩만 재면 안 된다** — 조합에서 처음 넘쳤다. 바꾸려면 조합으로 다시 재라.
const TUNE_PARTS = [
  { k: 'torso', label: '몸통',   max: 150 },
  { k: 'arm',   label: '팔',     max: 150 },
  { k: 'thigh', label: '허벅지', max: 200 },
  { k: 'calf',  label: '종아리', max: 200 },
  { k: 'face',  label: '얼굴',   max: 114 },
];
const TUNE_MIN = 50, TUNE_STEP = 2;   // % 단위 (100 = 기본)
const tuneMaxOf = k => (TUNE_PARTS.find(p => p.k === k) || { max: 200 }).max;

function defaultTune() {
  const o = {};
  TUNE_PARTS.forEach(p => { o[p.k] = 100; });
  return o;
}
let bodyTune = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}');
    const o = Object.assign(defaultTune(), saved);
    // 예전에 저장된 값이 새 상한을 넘을 수 있다 (상한을 낮춘 뒤 처음 켤 때) — 범위 안으로 당긴다
    TUNE_PARTS.forEach(p => {
      const v = Number(o[p.k]);
      o[p.k] = Number.isFinite(v) ? Math.max(TUNE_MIN, Math.min(p.max, v)) : 100;
    });
    return o;
  } catch (e) { return defaultTune(); }
})();

// Avatar.build 에 넘길 배율 (100% → 1.0)
function tuneScales() {
  const o = {};
  TUNE_PARTS.forEach(p => { o[p.k] = (bodyTune[p.k] || 100) / 100; });
  return o;
}

function bumpTune(k, dir) {
  const cur = bodyTune[k] || 100;
  const next = Math.max(TUNE_MIN, Math.min(tuneMaxOf(k), cur + dir * TUNE_STEP));
  if (next === cur) return false;                 // 끝까지 갔으면 반복을 멈춘다
  bodyTune[k] = next;
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(bodyTune)); } catch (e) {}
  renderShowcase();                               // 아바타 + 수치 같이 갱신
  return true;
}
window.bumpTune = bumpTune;

function resetTune() {
  bodyTune = defaultTune();
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(bodyTune)); } catch (e) {}
  renderShowcase();
}
window.resetTune = resetTune;

// 누르고 있으면 계속 증감 — 첫 입력 즉시 1회, 400ms 뒤부터 60ms 간격 반복
let tuneHold = null;
function startTuneHold(k, dir) {
  stopTuneHold();
  if (!bumpTune(k, dir)) return;
  const timer = setTimeout(() => {
    const iv = setInterval(() => { if (!bumpTune(k, dir)) stopTuneHold(); }, 60);
    if (tuneHold) tuneHold.interval = iv;
  }, 400);
  tuneHold = { timeout: timer, interval: null };
}
function stopTuneHold() {
  if (!tuneHold) return;
  clearTimeout(tuneHold.timeout);
  if (tuneHold.interval) clearInterval(tuneHold.interval);
  tuneHold = null;
}
window.startTuneHold = startTuneHold;
window.stopTuneHold = stopTuneHold;

function renderBodyTune() {
  const el = document.getElementById('bodyTune');
  if (!el) return;
  const rows = TUNE_PARTS.map(p => {
    const v = bodyTune[p.k] || 100;
    // pointerdown 으로 시작해 pointerup/leave/cancel 로 멈춘다 (터치·마우스 공통)
    const btn = (dir, sign) => `<button class="tune-btn" aria-label="${p.label} ${sign}"
      onpointerdown="startTuneHold('${p.k}',${dir})"
      onpointerup="stopTuneHold()" onpointerleave="stopTuneHold()" onpointercancel="stopTuneHold()"
      oncontextmenu="return false">${sign}</button>`;
    const atMax = v >= p.max;
    return `<div class="tune-row">
      <span class="tune-label">${p.label}${atMax ? ' <span class="tune-cap">최대</span>' : ''}</span>
      ${btn(-1, '−')}
      <span class="tune-val${v === 100 ? '' : ' on'}">${v}%</span>
      ${btn(1, '+')}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="tune-head">🧪 바디 파츠 조절 (임시)
      <button class="tune-reset" onclick="resetTune()">되돌리기</button></div>${rows}`;
}

// 카테고리 탭 줄(.cat-tabs)의 좌우 스크롤 — UI_POLICY.md 참고
// 스크롤바는 감추고, 마지막 버튼이 잘려 보이는 것으로 '더 있다'를 알린다.
// 터치는 브라우저 기본 스크롤을 쓰고, 데스크톱을 위해 마우스 휠 / 끌어서 스크롤을 더한다.
//
// 핸들러는 요소마다 붙이지 않고 document 에 한 번만 붙인다(이벤트 위임).
// 예전에는 요소마다 붙였는데, .cat-tabs 는 다시 그릴 때마다 통째로 새 요소가 되므로
// render() 를 거치지 않는 경로(setWardrobeTab → renderWardrobe, equip → renderShowcase)로
// 다시 그리면 새 줄에는 아무것도 안 붙어 데스크톱에서 스크롤이 죽었다.
// 터치는 브라우저 기본 스크롤이라 멀쩡했던 탓에 '가끔 되는' 것처럼 보였다.
// 위임하면 어느 경로로 몇 번을 다시 그리든 항상 동작한다.
function tabsAt(e) {
  const el = e.target && e.target.closest ? e.target.closest('.cat-tabs') : null;
  return el && el.scrollWidth > el.clientWidth ? el : null;   // 넘치지 않으면 볼일 없다
}

function initTabScroll() {
  // 마우스 휠(세로) → 가로 스크롤
  document.addEventListener('wheel', e => {
    const el = tabsAt(e);
    if (!el) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // 가로 휠은 그대로
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  // 마우스로 끌어서 스크롤
  let drag = null, startX = 0, startLeft = 0, moved = 0;
  document.addEventListener('pointerdown', e => {
    moved = 0;
    if (e.pointerType === 'touch') return;                  // 터치는 기본 동작 사용
    drag = tabsAt(e);
    if (!drag) return;
    startX = e.clientX; startLeft = drag.scrollLeft;
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > moved) moved = Math.abs(dx);
    if (moved > 3) { drag.scrollLeft = startLeft - dx; drag.classList.add('dragging'); e.preventDefault(); }
  });
  const release = () => {
    if (drag) drag.classList.remove('dragging');
    drag = null;
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  // 끌고 난 직후의 클릭은 탭 전환으로 치지 않는다
  document.addEventListener('click', e => {
    const el = e.target && e.target.closest ? e.target.closest('.cat-tabs') : null;
    if (el && moved > 6) { e.stopPropagation(); e.preventDefault(); }
    moved = 0;
  }, true);
}

// 선택된 탭이 화면 밖이면 가운데로 당겨온다 — **선택이 바뀐 순간에만** (`sel=true`).
// 예전에는 .wr-tab.active 를 찾아 옷장 줄에서만 동작했다. 지대·레시피 줄은 .cat-tab 뿐이라 빠져 있었다.
//
// 다시 그릴 때마다 당겨오면 안 된다. 선택 탭에서 멀리 굴려 둔 상태에서 아이템을 하나 만지면
// (equip → 다시 그리기) 줄이 선택 탭으로 도로 끌려가, 스크롤은 되는데 손대면 되돌아가는 꼴이 된다.
// 쓰는 사람에게는 "터치하다 보면 스크롤이 안 된다" 로 보인다 — 실제로 그렇게 잡혔다.
// 그래서 평소(다시 그리기)에는 요소마다 딱 한 번, 처음 만들어졌을 때만 맞춘다.
function centerActiveTab(el, sel) {
  if (!el) return;
  if (!sel && el.dataset.centered) return;   // 이미 한 번 맞췄으면 사용자가 굴린 위치를 지킨다
  el.dataset.centered = '1';
  const active = el.querySelector('.cat-tab.active');
  if (!active) return;
  // 좌표는 rect 로 잰다. offsetLeft 는 offsetParent 기준이라 .cat-tabs 가 static 이면
  // 줄 자신의 위치까지 섞여 들어와 엉뚱한 값이 나온다 (탭 오른쪽 끝이 scrollWidth 를 넘어 보였다)
  const aR = active.getBoundingClientRect(), eR = el.getBoundingClientRect();
  const l = el.scrollLeft + (aR.left - eR.left), r = l + aR.width;
  // 이미 다 보이면 건드리지 않는다 (1px 은 소수점 오차 여유)
  if (l >= el.scrollLeft - 1 && r <= el.scrollLeft + el.clientWidth + 1) return;
  el.scrollLeft = Math.max(0, l - (el.clientWidth - aR.width) / 2);
}

// ═══════════════════════════════════════════════════════════════
//  살 빠지는 연출 (물약을 마셨을 때)
//   sip  — 마시기만 함: 가벼운 반짝임
//   step — 체형 단계가 한 칸 내려감: 몸이 쏙 줄어드는 연출 + 반짝이
//   done — 완전히 날씬해짐: 가장 크게
// ═══════════════════════════════════════════════════════════════
let pendingSlimFx = null;      // render() 로 아바타가 다시 그려진 뒤 재생하려고 보관

function playSlimFx(level) {
  const box = document.getElementById('slimFx');
  const body = document.querySelector('#charStage .char-body');
  if (!box || !body) { pendingSlimFx = level; return; }   // 마이 룸이 아직 안 그려졌으면 대기

  // 몸이 줄어드는 느낌 (단계가 내려간 경우만)
  if (level !== 'sip') {
    body.classList.remove('slim-pop');
    void body.offsetWidth;                                // 애니메이션 재시작
    body.classList.add('slim-pop');
    setTimeout(() => body.classList.remove('slim-pop'), 1200);
  }

  // 위로 떠오르는 반짝이
  const n = level === 'done' ? 16 : level === 'step' ? 11 : 5;
  box.innerHTML = Array.from({ length: n }, (_, i) => {
    const x = 12 + Math.random() * 76;                    // 아바타 폭 안에서 (%)
    const delay = (i * 0.07).toFixed(2);
    const dur = (1.1 + Math.random() * 0.7).toFixed(2);
    const size = (level === 'sip' ? 9 : 11) + Math.random() * 7;
    const ch = ['✨', '💫', '⭐'][i % 3];
    return `<span class="slim-star" style="left:${x.toFixed(1)}%;font-size:${size.toFixed(0)}px;
      animation-delay:${delay}s;animation-duration:${dur}s">${ch}</span>`;
  }).join('');
  setTimeout(() => { if (box) box.innerHTML = ''; }, 2400);

  if (window.Sfx) Sfx.play(level === 'sip' ? 'sparkle' : 'success');
}

// 물약 → 아우라 세부 수치 매핑 (레시피를 추가하면 여기도 한 줄 추가)
const AURA_BY_POTION = {
  blush:     ['happy'],            // 홍조 물약 → 행복
  fragrance: ['grace'],            // 향기 물약 → 우아함
  mystic:    ['unique'],           // 신비 물약 → 개성
  vitality:  ['grit'],             // 생기 물약 → 근성
  rainbow:   AURA_KEYS,            // 무지개 엘릭서 → 전부
};

// ─── 레시피를 눌러 재료 자동 삽입 ───
// 필요한 재료가 가방에 다 있고 솥 구멍도 충분해야 담긴다.
function canFillRecipe(r) {
  if (r.inputs.length > cauldronSlots()) return false;
  const need = {};
  r.inputs.forEach(id => { need[id] = (need[id] || 0) + 1; });
  return Object.keys(need).every(id => invCount(id) >= need[id]);
}
function fillFromRecipe(resultId, el) {
  const r = D.RECIPES.find(x => x.result.id === resultId);
  if (!r) return;
  if (r.inputs.length > cauldronSlots()) {
    toast(T('need_bigger_pot', { n: r.inputs.length }), el);
    return;
  }
  if (!canFillRecipe(r)) { toast(T('not_enough_mat'), el); return; }
  S.cauldron = r.inputs.slice();
  save(); render();
  toast(T('recipe_filled', { name: N(r.result.id, r.result.name) }), el);
  if (window.Sfx) Sfx.play('pick');
}

// ─── 신체 · 아우라 상세 수치 표시 ───
function renderVitals() {
  const bodyEl = document.getElementById('vitalsBody');
  const auraEl = document.getElementById('vitalsAura');
  if (!bodyEl || !auraEl) return;

  const row = (label, value) =>
    `<div class="vitals-row"><dt>${label}</dt><dd>${value}</dd></div>`;

  bodyEl.innerHTML =
    row(T('v_weight'), `${fix2(weightKg())} kg`) +
    row(T('v_height'), `${fix1(heightCm())} cm`) +
    row(T('v_fat_pct'), `${fix2(bodyFatPct())} %`) +
    row(T('v_fat_kg'), `${fix2(bodyFatKg())} kg`) +
    row(T('v_muscle'), `${fix2(muscleKg())} kg`);

  auraEl.innerHTML = AURA_KEYS.map(k =>
    row(T('a_' + k), `${auraVal(k)} / ${AURA_MAX}`)).join('');

  renderRecord(row);
}

// ─── 플레이 기록 ───
// 세어 둔 값(record)과 지금 상태에서 바로 알 수 있는 값(열린 채집지 수 등)을 함께 보여 준다.
function renderRecord(row) {
  const listEl = document.getElementById('recordList');
  const briefEl = document.getElementById('recordBrief');
  if (!listEl) return;
  const r = S.record || newRecord();

  const openMaps = D.MAPS.filter(isMapOpen).length;
  const succRate = r.brews ? Math.round(r.brewOk / r.brews * 100) : 0;

  listEl.innerHTML =
    row(T('rec_days'), T('rec_days_v', { n: r.days || 1 })) +
    row(T('rec_playtime'), playTimeText(r.playSec || 0)) +
    row(T('rec_gathered'), `${r.gathered || 0}`) +
    row(T('rec_specials'), `${r.specials || 0}`) +
    row(T('rec_brews'), `${r.brews || 0} (${T('rec_succ', { n: succRate })})`) +
    row(T('rec_discoveries'), `${S.discovered.length} / ${D.RECIPES.length}`) +
    row(T('rec_drinks'), `${r.drinks || 0}`) +
    row(T('rec_creatures'), `${r.creatures || 0}`) +
    row(T('rec_maps'), `${openMaps} / ${D.MAPS.length}`) +
    row(T('rec_pots'), `${(r.pots || []).length} / ${D.CAULDRONS.length}`) +
    row(T('rec_cosmetics'), `${S.unlocked.length}`) +
    row(T('rec_started'), dateText(r.firstTs || S.firstTs));

  if (briefEl) briefEl.textContent = T('rec_brief', { d: r.days || 1, g: r.gathered || 0 });
}

function playTimeText(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? T('rec_hm', { h, m }) : T('rec_m', { m });
}
function dateText(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

// ─── 과시(공유) ───
function flexCharm() {
  const total = totalCharm();
  const tier = D.getTier(total);
  const text = T('share_text', { total: total, emoji: tier.emoji, tier: TN(tier.title) });
  if (navigator.share) {
    navigator.share({ title: '다이어터 연금술사', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast(T('copied')));
  } else {
    toast(text);
  }
}

// ═══════════════════════════════════════════════════════════════
//  설정 팝업 (항목은 계속 추가 가능 / 터치 즉시 적용, 적용 버튼 없음)
// ═══════════════════════════════════════════════════════════════
function openSettings() {
  renderSettings();
  renderSyncSettings();
  document.getElementById('settingsModal').classList.add('show');
}
function closeSettings() {
  document.getElementById('settingsModal').classList.remove('show');
}
function renderSettings() {
  const el = document.getElementById('setLangList');
  if (el && window.I18N) {
    const cur = I18N.getLang();
    el.innerHTML = I18N.langs().map(l =>
      `<button class="set-opt ${l.code === cur ? 'on' : ''}" onclick="chooseLang('${l.code}')">${l.label}</button>`
    ).join('');
  }
  // 사운드 On/Off (기본 On)
  const se = document.getElementById('setSoundList');
  if (se) {
    const on = window.Sfx ? Sfx.isOn() : true;
    se.innerHTML =
      `<button class="set-opt ${on ? 'on' : ''}" onclick="chooseSound(true)">${T('sound_on')}</button>` +
      `<button class="set-opt ${on ? '' : 'on'}" onclick="chooseSound(false)">${T('sound_off')}</button>`;
  }
}
function chooseLang(code) {
  if (window.I18N) I18N.setLang(code);   // 즉시 적용
  renderSettings();
}
function chooseSound(on) {
  if (window.Sfx) Sfx.setOn(on);         // 즉시 적용 + localStorage 저장
  renderSettings();
}
// 임시: 캐시 지우기 (브라우저 캐시 + Service Worker + 저장 데이터 유지 여부 선택)
// 테스트 편의용 — 출시 버전에서는 제거
function clearCacheHard() {
  const done = () => {
    // URL에 타임스탬프를 붙여 캐시된 HTML/JS/CSS를 무시하고 새로 받게 함
    const base = location.href.split('#')[0].split('?')[0];
    location.replace(base + '?cb=' + Date.now());
  };
  const jobs = [];
  // Cache Storage 비우기
  if (window.caches && caches.keys) {
    jobs.push(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).catch(() => {}));
  }
  // Service Worker 해제
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    jobs.push(navigator.serviceWorker.getRegistrations()
      .then(rs => Promise.all(rs.map(r => r.unregister()))).catch(() => {}));
  }
  Promise.all(jobs).then(done, done);
}

// 임시: 튜토리얼 인트로 다시보기
function replayIntro() {
  closeSettings();
  try { localStorage.removeItem(window.Intro ? Intro.SEEN_KEY : 'dieter_alchemist_intro_seen_v1'); } catch (e) {}
  // 리로드 없이 즉시 재생 (로고 인트로/마이 룸을 거치지 않음)
  if (window.Intro) Intro.start(null, true);
  else location.reload();
}

// ═══════════════════════════════════════════════════════════════
//  이름 입력 플로우 (튜토리얼 인트로가 끝나면 1회)
// ═══════════════════════════════════════════════════════════════
// 한글 1글자 = 2폭, 영문/숫자 1글자 = 1폭 → 한글 6글자 = 영문 12글자 = 12폭
const NAME_MAX_W = 12;
// 이름에 허용하는 문자 (한글 음절/자모 · 영문 · 숫자) — 그 외는 특수 문자로 간주
const NAME_ALLOW = /^[0-9A-Za-zᄀ-ᇿ㄰-㆏가-힣]+$/;
const NAME_KO = /[ᄀ-ᇿ㄰-㆏가-힣]/;

function nameWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += NAME_KO.test(ch) ? 2 : 1;
  return w;
}

// 튜토리얼 종료 후 호출 (이미 이름이 있으면 표시하지 않음)
function askPlayerName(force) {
  if (!force && S.name) return;
  const inp = document.getElementById('nameInput');
  if (inp) inp.value = '';
  clearNameError();
  const m = document.getElementById('nameModal');
  if (!m) return;
  m.classList.add('show');
  setTimeout(() => { try { if (inp) inp.focus(); } catch (e) {} }, 150);
}
function closeNameModal() {
  const m = document.getElementById('nameModal');
  if (m) m.classList.remove('show');
}
function clearNameError() {
  const e = document.getElementById('nameError');
  if (e) e.textContent = '';
}
// kind 가 'info' 면 안내(확인 중…)라 실패 효과음을 내지 않는다.
// 색은 style.css 의 .name-error[data-kind="info"] 가 맡는다 — 대비는 TEXT_POLICY 를 따른다.
function setNameError(msg, kind) {
  const e = document.getElementById('nameError');
  if (e) {
    e.textContent = msg;
    if (kind) e.dataset.kind = kind; else delete e.dataset.kind;
  }
  if (kind !== 'info' && window.Sfx) Sfx.play('fail');
}

// 서버에 이름을 확인하는 동안 입력과 버튼을 잠근다 (연타·중복 예약 방지)
function setNameBusy(on) {
  const inp = document.getElementById('nameInput');
  const btn = document.getElementById('nameSubmit');
  if (inp) inp.disabled = !!on;
  if (btn) { btn.disabled = !!on; btn.classList.toggle('is-busy', !!on); }
}
// '?' 아이콘 → 입력 조건 안내
function showNameRules(el) { toast(T('name_rules'), el); }

// 이름을 정하는 중인가 (연타로 두 번 예약되지 않게)
let _naming = false;

async function submitName() {
  if (_naming) return;
  const inp = document.getElementById('nameInput');
  const raw = inp ? inp.value : '';
  // 조건 1-a: 공백 불가 (빈 값 포함)
  if (!raw || /\s/.test(raw)) { setNameError(T('name_err_space')); return; }
  // 조건 2: 특수 문자 불가
  if (!NAME_ALLOW.test(raw)) { setNameError(T('name_err_char')); return; }
  // 조건 1-b: 한글 6글자 / 영문 12글자 이내
  if (nameWidth(raw) > NAME_MAX_W) {
    setNameError(NAME_KO.test(raw) ? T('name_err_len_ko') : T('name_err_len_en'));
    return;
  }

  // 조건 3: 이름은 유일하다 — 서버가 이 playerId 앞으로 잡아 준다.
  //
  //  · 이미 남이 쓰는 이름(409)이면 여기서 막는다. 다른 이름을 지으면 되는 일이다.
  //  · 서버에 닿지 못하면 막지 않는다. 튜토리얼 마지막 관문에서 오프라인이라는 이유로
  //    게임을 시작조차 못 하게 하는 편이 훨씬 나쁘다. 임시 이름으로 진행시키고
  //    (nameClaimed=false) 서버에 닿았을 때 확정한다 → ensureNameClaimed()
  let claimed = false;
  if (window.Sync && Sync.enabled()) {
    _naming = true;
    setNameError(T('name_checking'), 'info');
    setNameBusy(true);
    let r;
    try { r = await Sync.claimName(raw); } finally { _naming = false; setNameBusy(false); }
    if (r.ok) claimed = true;
    else if (r.reason === 'taken') { setNameError(T('name_err_taken', { name: raw })); return; }
    // 그 외(오프라인·서버 오류)는 임시 이름으로 통과시킨다
  } else {
    // 동기화 자체가 꺼진 경우(file:// 등)는 서버가 없으므로 확정으로 본다
    claimed = true;
  }

  S.name = raw;
  S.nameClaimed = claimed;
  save();
  clearNameError();
  closeNameModal();
  if (window.Sfx) Sfx.play('success');
  if (typeof render === 'function') render();
  // 인트로가 떠 있으면 요정 대모의 마무리 대사 → '시작하기' 로 이어짐
  if (window.Intro && Intro.isPlaying()) Intro.startEnding(raw);
  else toast(T('name_ok', { name: raw }), null, 3200);
  // 임시로 지나간 경우에만 안내 (인트로 대사와 겹치지 않게 뒤에 띄운다)
  if (!claimed) setTimeout(() => toast(T('name_temp', { name: raw }), null, 4200), 3400);
}

// ─── 임시 이름 확정 ───
// 오프라인에서 지은 이름을 서버에 닿았을 때 잡는다.
// 부팅 때와, 오프라인에서 돌아왔을 때 부른다. 여러 번 불려도 안전해야 한다.
// 이미 시도 중이면 '버리지 말고' 그 시도를 같이 기다린다.
// 버리면 그 한 번이 실패했을 때 아무도 다시 시도하지 않아 임시 이름이 영영 임시로 남는다.
let _claimTask = null;
function ensureNameClaimed() {
  if (!S.name || S.nameClaimed) return Promise.resolve();
  if (!window.Sync || !Sync.enabled()) return Promise.resolve();
  if (_claimTask) return _claimTask;
  _claimTask = claimNameNow().finally(() => { _claimTask = null; });
  return _claimTask;
}

async function claimNameNow() {
  const r = await Sync.claimName(S.name);

  if (r.ok) {
    S.nameClaimed = true;
    save();
    return;
  }
  // 그사이 남이 가져갔다 — 다시 짓게 한다. 진행은 그대로 두고 이름만 비운다.
  if (r.reason === 'taken') {
    const lost = S.name;
    S.name = '';
    S.nameClaimed = false;
    save();
    if (typeof render === 'function') render();
    toast(T('name_lost', { name: lost }), null, 5200);
    askPlayerName(true);
  }
  // 오프라인·서버 오류면 아무것도 하지 않는다. 다음 기회에 다시 시도한다.
}

// 인트로가 끝났을 때 이름 입력이 필요한지 (intro.js 에서 호출)
function needsPlayerName() { return !S.name; }

// ─── 확인 모달 (공용) ───
let _confirmCb = null;
function showConfirm(msg, cb) {
  document.getElementById('confirmText').textContent = msg;
  _confirmCb = cb;
  document.getElementById('confirmModal').classList.add('show');
}
function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('show');
  _confirmCb = null;
}
function confirmYes() {
  const cb = _confirmCb;
  closeConfirm();
  if (cb) cb();
}

// ─── 외형 초기화 (착장을 기본값으로) ───
function askResetAppearance() {
  showConfirm(T('confirm_reset_look'), () => {
    S.outfit = { ...D.DEFAULT_OUTFIT };
    save();
    renderShowcase();
    toast(T('appearance_reset'));
  });
}

// ─── 임시(출시 버전에서 제거): AP 가득 충전 ───
function fillEnergy() {
  refreshEnergy();
  S.energy = energyCap();
  S.energyDay = dayKey();
  save();
  render();
  toast(T('ap_filled'));
}

// ─── 게임 초기화 = 신규 시작 (마이 룸 상단 ↺ 버튼) ───
// 세이브와 '튜토리얼 봤음' 표시를 지우고 새로고침 → 로고 → 튜토리얼 → 이름 입력까지 처음부터.
// 언어·사운드 설정은 게임 진행이 아니라 앱 환경설정이라 남겨 둔다.
function askResetGame() {
  showConfirm(T('confirm_reset_game'), async () => {
    // 서버 사본을 먼저 지운다. 로컬만 지우면 다음 접속 때 서버에서 되살아난다.
    // (서버가 죽어 있어도 초기화 자체는 진행한다 — 로컬이 진짜이므로)
    if (window.Sync) { try { await Sync.wipe(); } catch (e) {} }
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(window.Intro ? Intro.SEEN_KEY : 'dieter_alchemist_intro_seen_v1');
    } catch (e) {}
    location.reload();
  });
}

// ═══════════════════════════════════════════════════════════════
//  서버 저장 (sync.js) 연결
// ═══════════════════════════════════════════════════════════════
const SYNC_ICON = { idle: '☁️', pending: '☁️', saving: '🔄', saved: '☁️', offline: '⚠️', off: '📴' };

function renderSyncChip(st) {
  const el = document.getElementById('syncChip');
  if (!el) return;
  el.textContent = `${SYNC_ICON[st] || '☁️'} ${T('sync_' + st)}`;
  el.dataset.state = st;
}

// 상단 표시를 눌렀을 때 안내
function syncHelp(el) {
  const st = window.Sync ? Sync.status : 'off';
  toast(T('sync_help_' + st), el, 3000);
}

// 설정 창의 세이브 항목 채우기
function renderSyncSettings() {
  const codeEl = document.getElementById('syncCode');
  const stateEl = document.getElementById('setSyncState');
  if (codeEl && window.Sync) codeEl.value = Sync.code();
  if (stateEl && window.Sync) {
    const st = Sync.status;
    stateEl.textContent = `${SYNC_ICON[st] || '☁️'} ${T('sync_' + st)}`;
  }
}

function copyRecoveryCode(el) {
  const code = window.Sync ? Sync.code() : '';
  if (!code) return;
  const done = () => toast(T('sync_copied'), el, 2400);
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {
    const i = document.getElementById('syncCode'); if (i) { i.select(); done(); }
  });
  else { const i = document.getElementById('syncCode'); if (i) { i.select(); document.execCommand('copy'); done(); } }
}

// 다른 기기의 복구 코드로 갈아타기 — 지금 기기의 진행은 사라지므로 한 번 묻는다
function askUseRecoveryCode() {
  const code = prompt(T('sync_restore_ask'));
  if (code === null) return;
  if (!window.Sync || !Sync.useCode(code)) { toast(T('sync_bad_code')); return; }
  showConfirm(T('sync_restore_confirm'), async () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });
}

// (보관) 외형만 기본값으로 되돌리기 — 지금은 ↺ 버튼이 '게임 초기화'로 쓰이는 중
function resetGame() { askResetGame(); }

// ─── 부팅 ───
// (스플래시 표시/제거는 index.html 인라인 스크립트에서 처리)
window.render = render;
window.switchTab = switchTab;   // 인트로 종료 후 탭 전환
window.currentTab = currentTab;   // i18n에서 언어 변경 시 재렌더
document.addEventListener('DOMContentLoaded', () => {
  if (window.I18N) I18N.apply();
  initTabScroll();          // 카테고리 탭 줄 좌우 스크롤 (document 위임 — 한 번만)
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));
  refreshEnergy();          // 접속 시 자정 롤오버 반영
  switchTab('showcase');
  // 서버에 더 최신 세이브가 있으면 그걸로 이어서 한다 (없으면 지금 것을 올린다)
  if (window.Sync) {
    Sync.onStatus(renderSyncChip);
    // 오프라인에서 지은 임시 이름은 서버에 닿을 때마다 확정을 시도한다.
    // (상태가 offline 을 벗어나는 순간이 곧 '닿았다' 는 뜻이다)
    Sync.onStatus(st => { if (st !== 'offline' && st !== 'off') ensureNameClaimed(); });
    Sync.pull(S).then(r => {
      if (r && r.action === 'adopt') toast(T('sync_pulled'), null, 2800);
      ensureNameClaimed();
    });
  } else {
    renderSyncChip('off');
  }
  setInterval(energyTick, 1000);  // 카운트다운 + 자정 자동 충전
  // 백그라운드 → 포그라운드 복귀 시 즉시 반영
  document.addEventListener('visibilitychange', () => { if (!document.hidden) energyTick(); });
});
