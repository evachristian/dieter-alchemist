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
//  6: 튜토리얼을 마쳤는지 (tutorialDone) — 마치기 전에는 마이 룸에 인트로의 공주가 서 있다
//  7: 옷·악세사리 8칸도 획득 대상이 됨 (gated) — 시작 착장은 공주 드레스 한 벌뿐
//  8: 표정이 '어리둥절' 하나로 시작 — 방긋·윙크·활짝은 이제 얻어야 쓴다
const SAVE_VER = 8;

// 처음부터 알고 있는 레시피. defaultState 와 migrate 가 같이 쓰므로 값이 어긋나지 않는다.
const STARTER_RECIPES = ['vitality', 'blush'];

// 세이브 8 이전에 '처음부터 갖고 있던' 표정. 예전 세이브에는 그대로 채워 준다
const OLD_STARTER_FACES = ['exp_smile', 'exp_wink', 'exp_happy'];

// 세이브 7 에서 잠금 대상이 된 칸들. 예전 세이브에는 이 칸의 옷을 전부 채워 준다.
const NEW_GATED_SLOTS = ['top', 'bottom', 'dress', 'circlet', 'earring', 'necklace', 'glove', 'shoes'];

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
  // 옷 색 (슬롯 → COLORS 의 id). 비어 있으면 그 칸은 아이템 원래 색을 쓴다.
  // **기본값이 빈 객체라 예전 세이브에도 그대로 맞는다** — 마이그레이션이 필요 없다
  outfitColor: {},
  // 염색이 풀리는 시각 (슬롯 → epoch ms). 마법 염색약은 24시간짜리다.
  // **색과 따로 두는 이유**: 예전 세이브에 남아 있는 색은 만료 시각이 없으므로
  // 자동으로 '풀린 것' 이 된다 — 마이그레이션 없이 옛 값이 조용히 무효가 된다
  dyeUntil: {},
  dye: 0,                 // 마법 염색약 보유 개수
  // 현자의 결정 보유 개수 (조합 실패로 얻어 AP 충전에 쓴다).
  // **새로 생긴 칸이라 마이그레이션이 필요 없다** — 예전 세이브에는 이 키가 없고,
  // Object.assign(defaultState(), 저장값) 이 기본값 0 을 그대로 남긴다
  crystal: 0,
  unlocked:  [],          // 해금한 커스터마이징 아이템 id 목록 (starter 외)
  energy:    D.ENERGY.cap,  // 현재 에너지 (행동력)
  energyDay: dayKey(),      // 마지막 충전 기준 로컬 날짜 키 (YYYYMMDD)
  name:      '',            // 연금술사 이름 (튜토리얼 종료 후 입력)
  // 그 이름을 서버가 이 playerId 앞으로 잡아 줬는가.
  // 오프라인이면 일단 false 로 두고 게임을 진행시킨 뒤, 서버에 닿았을 때 확정한다.
  // (그사이 남이 같은 이름을 가져갔으면 다시 짓게 한다)
  nameClaimed: false,
  // 튜토리얼을 마쳤는가. 마치기 전의 마이 룸에는 인트로에서 막 넘어온 공주가
  // 그대로 서 있고, 마치는 순간 바디 파츠로 조립한 아바타로 바뀐다.
  tutorialDone: false,
  // 아우라 세부 수치 (각 0~1000)
  aura:      { happy: 100, grace: 100, unique: 100, grit: 100, luck: 100 },
  cauldronId: 'cd_iron_old',  // 사용 중인 마법 솥 (시작은 튜토리얼용 2구)
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
    pots:        ['cd_iron_old'],   // 써 본 마법 솥 (중복 없이)
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
  if (expireDye()) { save(); if (currentTab === 'showcase') renderShowcase(); }
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
      if (!st.outfitColor || typeof st.outfitColor !== 'object') st.outfitColor = {};
      if (!st.dyeUntil || typeof st.dyeUntil !== 'object') st.dyeUntil = {};
      st.aura = Object.assign({ happy: 100, grace: 100, unique: 100, grit: 100, luck: 100 }, st.aura || {});
      if (!st.firstTs) st.firstTs = Date.now();
      if (!st.cauldronId) st.cauldronId = 'cd_iron_old';
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
  if (!S.outfitColor || typeof S.outfitColor !== 'object') S.outfitColor = {};
  if (!S.dyeUntil || typeof S.dyeUntil !== 'object') S.dyeUntil = {};
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
  if (from < 6) {
    // **이미 플레이 중인 사람은 튜토리얼을 마친 것으로 친다.**
    // 기본값이 false 라, 여기서 채워 주지 않으면 잘 하고 있던 사람들의 아바타가
    // 어느 날 갑자기 인트로의 공주로 되돌아간다. (기본값을 바꿀 때의 그 함정 — CLAUDE.md)
    st.tutorialDone = true;
  }
  if (from < 7) {
    // 옷·악세사리 8칸이 잠금 대상이 됐다. **이미 플레이 중인 사람은 전부 갖고 있던 것**이므로
    // 여기서 채워 주지 않으면 어제까지 입던 옷이 오늘 갑자기 자물쇠로 바뀐다.
    // (기존 진행은 지우지 않고 없는 것만 채운다 — CLAUDE.md)
    if (!Array.isArray(st.unlocked)) st.unlocked = [];
    NEW_GATED_SLOTS.forEach(slot => (D.WARDROBE[slot] || []).forEach(it => {
      if (!st.unlocked.includes(it.id)) st.unlocked.push(it.id);
    }));
  }
  if (from < 8) {
    // 방긋·윙크·활짝은 예전에 처음부터 갖고 있던 표정이다.
    // 채워 주지 않으면 어제까지 쓰던 얼굴이 오늘 자물쇠로 바뀐다 (CLAUDE.md)
    if (!Array.isArray(st.unlocked)) st.unlocked = [];
    OLD_STARTER_FACES.forEach(id => { if (!st.unlocked.includes(id)) st.unlocked.push(id); });
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
// 물약을 마실 때마다 신체 수치가 **조금씩** 움직이도록 연속값으로 둔다.
// 예전에는 floor(비주얼/15) 라 15점을 채우기 전까지는 아무 변화가 없었다
// (체중·체지방이 4번만 뚝뚝 끊겨 바뀌었다). 이제 1점만 올라도 그만큼 반영된다.
const BODY_MAX_BEAUTY = BODY_STEPS * BODY_PER_STEP;   // 완전히 날씬해지는 비주얼 (60)
function bodyLevel(beauty) {
  const b = (beauty === undefined ? (S.stats.beauty || 0) : beauty);
  return 1 - Math.min(1, Math.max(0, b / BODY_MAX_BEAUTY));
}
// 살 빠지는 연출은 여전히 '단계' 로 친다 — 매번 크게 터지면 시끄럽다
function bodyStep(beauty) {
  const b = (beauty === undefined ? (S.stats.beauty || 0) : beauty);
  return Math.min(BODY_STEPS, Math.floor(b / BODY_PER_STEP));
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
  // 비주얼이 오르면 자세가 펴져 키가 아주 조금 는다 (물약 한 병이 체감되도록)
  heightPerBeauty: 0.05,      // 비주얼 1점당 cm
  heightBeautyMax: 3.0,       // 그래도 이만큼까지만 (BODY_MAX_BEAUTY 60점에서 +3cm)
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
// 아래 수치들은 모두 beauty 를 넘겨 '그 비주얼이었다면 얼마인지' 를 물어볼 수 있다.
// 물약의 '?' 안내가 마시기 전/후를 같은 식으로 계산해 차이를 보여 주는 데 쓴다.
//
// 키 — 날짜로 자라는 것에 더해, 비주얼이 오르면 자세가 펴져 아주 조금 커진다.
// (heightMax 를 넘지 않게 잘라 준다)
function heightCm(beauty) {
  const b = (beauty === undefined ? (S.stats.beauty || 0) : beauty);
  const grown = VITALS.heightMin + daysPlayed() * VITALS.heightPerDay;
  const bonus = Math.min(VITALS.heightBeautyMax,
                         Math.max(0, b) * VITALS.heightPerBeauty);
  return Math.min(VITALS.heightMax, grown + bonus);
}
// 체중 = BMI × 키(m)^2. 통통할수록 BMI 가 높다.
function weightKg(beauty) {
  const w = bodyLevel(beauty);                  // 1 = 통통, 0 = 날씬
  const bmi = lerp(VITALS.bmiSlim, VITALS.bmiFat, w);
  const m = heightCm(beauty) / 100;
  return bmi * m * m;
}
function bodyFatPct(beauty) {
  return lerp(VITALS.fatPctSlim, VITALS.fatPctFat, bodyLevel(beauty));
}
function bodyFatKg(beauty) { return weightKg(beauty) * bodyFatPct(beauty) / 100; }
// 근육량 = 체중 × 근육 비율. 날씬할수록, 근성이 높을수록 비율이 오른다.
function muscleKg(beauty) {
  const pct = lerp(VITALS.musclePctSlim, VITALS.musclePctFat, bodyLevel(beauty))
    + VITALS.gritMuscleBonus * (auraVal('grit') / 1000);
  return weightKg(beauty) * pct / 100;
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
function toast(msg, anchor, ms, place) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  // 줄바꿈이 있거나 문구가 길면 한 줄 말줄임 대신 여러 줄로 표시
  el.classList.toggle('multi', String(msg).indexOf('\n') >= 0 || String(msg).length > 22);

  // anchor 는 요소 또는 **선택자**다.
  // 선택자를 받는 이유: render() 로 화면을 다시 그리고 나면 눌렀던 요소는 이미
  // 문서에서 떨어져 나가 좌표가 0,0 이 된다. 그러면 토스트가 눌린 자리가 아니라
  // **화면 왼쪽 위 구석**에 뜬다 (레시피 줄에서 실제로 그랬다).
  // 다시 그린 뒤에는 선택자를 넘겨 새 요소를 찾게 한다.
  if (typeof anchor === 'string') anchor = document.querySelector(anchor);
  // 떨어져 나간 요소나 크기가 0인 요소는 붙일 데가 없다 — 기본 자리로 떨어뜨린다.
  // (구석에 뜨는 것보다 늘 뜨던 자리에 뜨는 편이 낫다)
  const ar = (anchor && anchor.isConnected && anchor.getBoundingClientRect)
    ? anchor.getBoundingClientRect() : null;
  if (ar && ar.width > 0 && ar.height > 0) {
    const r = ar;
    el.classList.add('anchored');
    el.style.visibility = 'hidden';
    el.classList.add('show');
    // 위치 계산 (화면 밖으로 나가지 않게 보정)
    const tw = el.offsetWidth, th = el.offsetHeight, pad = 8;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
    // 기본은 아래 (헤더의 ? 아이콘 같은 것은 위로 올리면 화면 밖이다).
    // place='above' 면 위 — 목록의 줄처럼 **누른 것을 가리면 안 되는** 자리에 쓴다
    let top = (place === 'above') ? r.top - th - 8 : r.bottom + 8;
    // 넘치면 반대편으로 넘긴다
    if (place === 'above') { if (top < pad) top = r.bottom + 8; }
    else if (top + th > window.innerHeight - pad) top = r.top - th - 8;
    // **그래도 화면 밖이면 안으로 당긴다.** 스크롤로 밀려 나간 요소에 붙이면
    // 토스트까지 같이 화면 밖으로 나가 아무것도 안 보인다 (솥 탭에서 실제로 그랬다)
    top = Math.max(pad, Math.min(top, window.innerHeight - th - pad));
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

  // 현자의 결정 보유 개수 — AP 알약 안, + 버튼 바로 앞
  const gem = document.getElementById('hdrCrystal');
  if (gem) gem.textContent = fmtCount(S.crystal || 0);
}

// 헤더용 짧은 수 — 자릿수가 늘어도 게이지를 잡아먹지 않게 **최대 5글자**로 묶는다.
// (6글자가 되면 320px 에서 + 버튼이 알약 밖으로 6px 밀려났다)
// 1만 미만은 있는 그대로("9,999"), 그 위는 K·M 으로 접는다.
// **올림하지 않고 버린다** — 99,999 를 "100.0K" 로 보여 주면 6글자가 되고,
// 아직 10만이 아닌데 10만인 것처럼 읽힌다.
// 정확한 값은 충전 패널의 '보유' 줄에서 그대로 보여 준다 — 접는 건 헤더뿐이다.
function fmtCount(n) {
  if (n < 10000) return n.toLocaleString();                 // "9,999"
  for (const [div, unit] of [[1e3, 'K'], [1e6, 'M'], [1e9, 'B']]) {
    const v = n / div;
    if (v < 1000) {
      // 100 이상이면 소수점을 뗀다 — "999K"(4) 는 되고 "999.9K"(6) 는 안 된다
      return v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) + unit
                     : String(Math.floor(v)) + unit;
    }
  }
  return '999B+';
}

// ─── AP 충전 (현자의 결정 → AP) ───
// 헤더의 + 버튼. 확인 패널에 '보유 / 지불' 을 나란히 보여 준다.
// 이번 충전에 드는 결정 — **모자란 만큼만** 낸다.
// D.ENERGY.chargeCost 는 '가득(cap) 채울 때 드는 값' 이고, 여기서 비례로 나눈다.
// 지금은 1000 / 1000 이라 AP 하나에 결정 하나다.
// 나누는 값이 energyCap() 이 아니라 D.ENERGY.cap 인 이유: 상한이 늘어난 플레이어의
// AP 값이 싸지면 안 된다 — **AP 하나의 값은 누구에게나 같아야 한다.**
function chargeCost() {
  const need = Math.max(0, energyCap() - (S.energy || 0));
  return Math.ceil(need * D.ENERGY.chargeCost / D.ENERGY.cap);
}

function askCharge() {
  const cap = energyCap();
  refreshEnergy();
  if ((S.energy || 0) >= cap) { toast(T('ap_full')); return; }
  const cost = chargeCost(), have = S.crystal || 0;
  // 결정 아이콘은 **누를 수 있다** — 무엇인지·어디서 얻는지 토스트로 알려 준다
  const row = (label, n, lack) => `<div class="cf-row">
      <span class="cf-label">${label}</span>
      <button class="cf-gem" onclick="crystalHelp(this,'panel')" aria-label="${T('crystal_name')}">${D.CRYSTAL.emoji}</button>
      <span class="cf-n${lack ? ' lack' : ''}">${T('n_ea', { n: n.toLocaleString() })}</span>
    </div>`;
  showConfirm(T('ap_charge_ask'), () => doCharge(),
    row(T('ap_charge_have'), have, have < cost) + row(T('ap_charge_pay'), cost, false));
}
window.askCharge = askCharge;

// AP 안내 — ⚡ 와 게이지를 누르면
function apHelp(el) { toast(T('ap_help'), el, 3000); }
window.apHelp = apHelp;

// 결정 아이콘 안내. 헤더에서는 **무엇에 쓰는지**, 충전 패널에서는 **어디서 얻는지**를
// 알려 준다 — 그 자리에서 궁금한 것이 서로 다르다.
function crystalHelp(el, where) {
  toast(T(where === 'panel' ? 'crystal_help' : 'crystal_help_hdr'), el, 3200);
}
window.crystalHelp = crystalHelp;

function doCharge() {
  // 패널을 띄운 뒤에도 AP 는 줄어들 수 있다(채집·조합) — 낼 값은 **누른 시점에** 다시 센다
  const cost = chargeCost();
  if (cost <= 0) { toast(T('ap_full')); return; }
  if ((S.crystal || 0) < cost) {
    // 모자라면 다이아 구매로 이어진다 (아직 상점이 없다 → openDiamondShop 참고)
    toast(T('crystal_short'));
    setTimeout(openDiamondShop, 900);
    return;
  }
  S.crystal -= cost;
  S.energy = energyCap();
  S.energyDay = dayKey();
  save(); render();
  toast(T('ap_charged'));
  window.Sfx && Sfx.play('success');
}

// ─── 다이아 상점 ───
// 현자의 결정이 모자랄 때 이어지는 자리. 수량을 고르면 확인 버튼이 그 가격이 된다.
// **결제는 아직 없다** — buyDiamond() 안쪽만 채우면 된다.
let _shopPick = 0;   // 고른 상품 (D.SHOP 의 인덱스)
function openDiamondShop(pick) {
  _shopPick = Math.max(0, Math.min(D.SHOP.length - 1, pick || 0));
  const opts = D.SHOP.map((s, i) => `<button class="cat-tab${i === _shopPick ? ' active' : ''}"
      onclick="openDiamondShop(${i})">${T('n_ea', { n: s.n.toLocaleString() })}</button>`).join('');
  showConfirm(T('shop_ask'), buyDiamond,
    `<div class="cat-tabs shop-opts">${opts}</div>`,
    T('shop_price', { krw: D.SHOP[_shopPick].krw.toLocaleString() }));
}
window.openDiamondShop = openDiamondShop;

// 결제. 붙기 전까지는 안내하고 패널을 닫는다 (showConfirm 의 콜백이라 이미 닫혀 있다).
function buyDiamond() { toast(T('shop_unavailable'), null, 3000); }

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
  // 방 모서리에 얹히는 자리라 짧게 — "🌙 10:42 UTC+9"
  if (a) a.textContent = `${zoneTime(9)} UTC+9`;
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
// 파수꾼의 호박 밭 — 미니게임을 띄우고, 끝나면 주운 것을 가방에 넣는다.
// AP 는 들어갈 때 이미 냈으므로 여기서 또 빼지 않는다.
function startPumpkinRun(map) {
  window.Pumpkin.start(map, (res) => {
    const got = (res && res.picked) || [];
    got.forEach(id => addInv(id, 1));
    S.gathered++;
    rec('gathered');
    got.forEach(() => rec('itemsGot'));
    const specials = got.filter(id => id === map.special).length;
    for (let i = 0; i < specials; i++) rec('specials');
    save();
    if (specials) {
      const sp = D.INGREDIENTS[map.special];
      toast(T('got_special', { emoji: sp.emoji, name: N(sp.id, sp.name) }), null, 3200);
      if (window.Sfx) Sfx.play('success');
    }
    render();
  });
}

// 한 번 채집한다. **계속해도 되는지**를 돌려준다 —
// 꾹 누르기 자동 채집(startGatherHold)이 이 값을 보고 멈춘다.
// AP 가 떨어졌거나 미니게임으로 들어갔으면 false 다.
function gather(mapId) {
  const map = D.MAPS.find(m => m.id === mapId);
  if (!map) return false;
  if (!isMapOpen(map)) { toast(unlockText(map.unlock)); return false; }
  if (!spendEnergy(D.ENERGY.cost.gather)) {
    toast(T('no_energy'));
    return false;
  }
  // 특별한 맵 — 바로 줍지 않고 미니게임으로 들어간다. 보상은 끝난 뒤 받는다.
  if (map.mini === 'pumpkin' && window.Pumpkin) {
    startPumpkinRun(map);
    return false;
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
  return true;
}

// ─── 맵 카드 꾹 누르기 = 자동 연속 채집 ───
//
// 톡 누르면 한 번(= 기존 onclick), 꾹 누르고 있으면 계속 줍는다.
//
// 즉시 줍지 않고 HOLD_DELAY 를 두는 이유: 목록을 **손가락으로 밀어 내릴 때**
// 누른 순간 채집되면 스크롤만 해도 AP 가 샌다. 그래서 처음 한 번은 onclick 에
// 맡긴다 — 끌어서 스크롤하면 click 이 애초에 발생하지 않는다.
const HOLD_DELAY = 450;   // 이만큼 누르고 있어야 자동 채집이 시작된다
const HOLD_EVERY = 420;   // 자동 채집 간격
const HOLD_MOVE  = 10;    // 이만큼(px) 움직이면 스크롤로 보고 취소한다
let gatherHold = null;

function startGatherHold(mapId, ev) {
  stopGatherHold();
  gatherHold = {
    id: mapId, x: ev ? ev.clientX : 0, y: ev ? ev.clientY : 0,
    fired: false, timer: null, interval: null,
  };
  gatherHold.timer = setTimeout(() => {
    if (!gatherHold) return;
    gatherHold.fired = true;                 // 이 뒤의 click 은 무시한다 (한 번 더 줍히지 않게)
    if (!gather(mapId)) { stopGatherHold(); return; }
    gatherHold.interval = setInterval(() => {
      if (!gather(mapId)) stopGatherHold();  // AP 가 떨어지면 스스로 멈춘다
    }, HOLD_EVERY);
  }, HOLD_DELAY);
}
function stopGatherHold() {
  if (!gatherHold) return;
  clearTimeout(gatherHold.timer);
  if (gatherHold.interval) clearInterval(gatherHold.interval);
  // 손을 뗀 직후의 click 한 번만 막는다
  const fired = gatherHold.fired;
  gatherHold = null;
  return fired;
}

// 자동 채집이 돌았다면 이어서 오는 click 은 버린다
let swallowTap = false;
function tapGather(mapId) {
  if (swallowTap) { swallowTap = false; return; }
  gather(mapId);
}

// **손을 떼는 것은 document 에서 받는다.** gather() 안의 render() 가 카드를
// 통째로 새로 그려서, 카드에 붙인 pointerup 은 영영 오지 않는다 — 그러면
// 손을 떼도 자동 채집이 멈추지 않는다. (탭 스크롤에서 겪었던 것과 같은 함정)
document.addEventListener('pointerup', () => { swallowTap = !!stopGatherHold(); });
document.addEventListener('pointercancel', () => { stopGatherHold(); });
// 목록을 밀어 내리는 중이면 채집이 아니다
document.addEventListener('pointermove', (e) => {
  if (!gatherHold || gatherHold.fired) return;
  if (Math.abs(e.clientX - gatherHold.x) > HOLD_MOVE ||
      Math.abs(e.clientY - gatherHold.y) > HOLD_MOVE) stopGatherHold();
});
window.addEventListener('scroll', () => { if (gatherHold && !gatherHold.fired) stopGatherHold(); }, true);

window.startGatherHold = startGatherHold;
window.stopGatherHold = stopGatherHold;
window.tapGather = tapGather;

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
    // 실패해도 빈손으로 보내지 않는다 — 현자의 결정이 남는다
    S.crystal = (S.crystal || 0) + D.ENERGY.failReward;
    save(); render();
    showBrewResult(D.CRYSTAL, false);
    return;
  }

  rec('brewOk');
  const isNew = !S.discovered.includes(result.id);
  if (isNew) {
    rec('discoveries');
    S.discovered.push(result.id);
    lastFound = result.id;              // 레시피 북에서 맨 위로 올려 강조
    // 발견한 카테고리로 레시피 북을 자동 전환
    recipeKind = result.kind;
    if (result.grade) recipeTab = result.grade;
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
// 물약 카드의 '?' — 이 물약을 마시면 신체 수치가 얼마나 움직이는지 미리 보여 준다.
// 값은 하드코딩하지 않고 **실제 계산식에 마신 뒤 비주얼을 넣어** 차이를 낸다.
// (수치 규칙을 고치면 이 안내도 저절로 따라온다)
function potionDelta(r) {
  const b0 = S.stats.beauty || 0;
  const b1 = b0 + (r.result.beauty || 0);
  return [
    { label: T('v_weight'),  d: weightKg(b1)   - weightKg(b0),   unit: 'kg', dec: 2 },
    { label: T('v_fat_pct'), d: bodyFatPct(b1) - bodyFatPct(b0), unit: '%',  dec: 2 },
    { label: T('v_fat_kg'),  d: bodyFatKg(b1)  - bodyFatKg(b0),  unit: 'kg', dec: 2 },
    { label: T('v_muscle'),  d: muscleKg(b1)   - muscleKg(b0),   unit: 'kg', dec: 2 },
    { label: T('v_height'),  d: heightCm(b1)   - heightCm(b0),   unit: 'cm', dec: 2 },
  ];
}

function showPotionEffect(potionId, anchor) {
  const r = D.RECIPES.find(x => x.result.id === potionId);
  if (!r) return;
  const lines = potionDelta(r)
    .filter(x => Math.abs(x.d) >= 0.005)          // 반올림하면 0 이 되는 항목은 빼고 보여 준다
    .map(x => `${x.label} ${x.d > 0 ? '+' : '−'}${Math.abs(x.d).toFixed(x.dec)}${x.unit}`);
  const head = T('potion_effect_head', { name: N(r.result.id, r.result.name) });
  toast(lines.length ? `${head}\n${lines.join('\n')}` : `${head}\n${T('potion_effect_none')}`,
        anchor, 4200);
}
window.showPotionEffect = showPotionEffect;

function drinkPotion(potionId) {
  if ((S.potions[potionId] || 0) <= 0) return;
  const r = D.RECIPES.find(x => x.result.id === potionId);
  if (!r) return;
  S.potions[potionId]--;
  if (S.potions[potionId] === 0) delete S.potions[potionId];
  rec('drinks');
  const beforeStep = bodyStep();
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
  // (수치 자체는 연속으로 조금씩 움직이지만 연출까지 매번 터뜨리면 시끄럽다)
  const afterStep = bodyStep();
  playSlimFx(afterStep > beforeStep ? (afterStep === BODY_STEPS ? 'done' : 'step') : 'sip');
  if (afterStep > beforeStep) {
    setTimeout(() => {
      toast(T(afterStep === BODY_STEPS ? 'body_done' : 'body_down'), null, 2600);
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
//  조합 결과 모달
// ═══════════════════════════════════════════════════════════════
function showBrewResult(result, isNew) {
  const modal = document.getElementById('brewModal');
  const body = document.getElementById('brewModalBody');
  const success = result.kind !== 'crystal';
  let statLine = '';
  if (result.kind === 'crystal') {
    statLine = `<div class="brew-stats">${T('brew_crystal', { n: D.ENERGY.failReward })}</div>`;
  }
  if (result.kind === 'potion') {
    // 물약은 '비주얼/아우라' 숫자 대신 **실제로 몸이 어떻게 바뀌는지**를 보여 준다.
    // 물약 카드의 '?' 안내와 같은 계산을 쓴다 (potionDelta) — 규칙을 고치면 둘 다 따라온다.
    const rows = potionDelta({ result })
      .filter(x => Math.abs(x.d) >= 0.005)
      .map(x => `<span class="brew-stat-item">${x.label} ${x.d > 0 ? '+' : '−'}${Math.abs(x.d).toFixed(x.dec)}${x.unit}</span>`)
      .join('');
    statLine = `<div class="brew-stats brew-vitals">${rows || T('potion_effect_none')}</div>`;
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
  applyDevTools();   // 임시(출시 때 지운다): 화면마다 있는 개발용 블록의 접힘 상태를 맞춘다
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
    // 임시: 개발용 '모든 히든 재료 오픈' 스위치가 켜져 있으면 얻지 않았어도 정체를 보여 준다
    const found = devFlag(DEV_SPECIALS_KEY) || invCount(spot.special) > 0;
    const spChip = `<span class="spot-special ${found ? 'found' : ''}" title="${T('special_hint')}">${found ? sp.emoji : '❔'}</span>`;
    // 특별한 맵(미니게임이 있는 맵)은 카드 왼쪽 위에 배지를 단다 — UI_POLICY.md 참고
    const badge = spot.mini ? `<span class="spot-badge">${T('special_map')}</span>` : '';
    return `
      <div class="spot-card ${canGather ? '' : 'low-energy'}${spot.mini ? ' special' : ''}"
           data-spot="${spot.id}" onclick="tapGather('${spot.id}')"
           onpointerdown="startGatherHold('${spot.id}', event)" oncontextmenu="return false">
        ${badge}
        <div class="spot-emoji">${spot.emoji}</div>
        <div class="spot-info">
          <div class="spot-name">${N(spot.id, spot.name)}</div>
          <div class="spot-desc">${N(spot.id + '_desc', spot.desc)}</div>
          <div class="spot-pool">${chips} ${spChip}</div>
        </div>
        <div class="spot-go">${T('gather_go')} <span class="cost-tag">⚡${cost}</span></div>
      </div>`;
  }).join('');

  renderGatherDev();   // 임시(출시 때 지운다)
}

function renderAtelier() {
  // 가마솥 슬롯
  // 솥 선택 줄
  const cdEl = document.getElementById('cauldronPicker');
  if (cdEl) {
    cdEl.innerHTML = D.CAULDRONS.map(c => {
      const open = isCauldronOpen(c);
      return `<button class="cat-tab ${S.cauldronId === c.id ? 'active' : ''} ${open ? '' : 'locked'}"
        data-pot="${c.id}" onclick="chooseCauldron('${c.id}', this)">${open ? c.emoji : '🔒'} ${N(c.id, c.name)} ${c.slots}${T('slot_unit')}</button>`;
    }).join('');
  }

  // 솥 그림 — 고른 솥에 맞는 것으로 갈아 끼운다.
  // 예전에는 index.html 에 무쇠 솥 하나가 박혀 있어, 어떤 솥을 골라도 그림이 같았다.
  const artEl = document.getElementById('cauldronArt');
  if (artEl && window.Cauldron) {
    const cur = D.CAULDRONS.find(x => x.id === S.cauldronId) || D.CAULDRONS[0];
    // 같은 솥이면 다시 그리지 않는다 — 매 렌더마다 갈아 끼우면 거품·반짝임이 처음부터 다시 돈다
    if (artEl.dataset.pot !== cur.id) {
      artEl.dataset.pot = cur.id;
      artEl.innerHTML = Cauldron.svg(Object.assign({}, cur, { name: N(cur.id, cur.name) }));
    }
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
  // 윗단 — 물약 / 크리처. 마이 룸 인벤토리와 같은 세그먼트 모양이라 라벨도 같은 것을 쓴다
  const kindEl = document.getElementById('recipeKinds');
  if (kindEl) {
    kindEl.innerHTML = [['potion', 'room_potions'], ['creature', 'room_creatures']].map(([k, key]) =>
      `<button class="room-tab ${recipeKind === k ? 'active' : ''}" onclick="setRecipeKind('${k}')">${T(key)}</button>`
    ).join('');
  }
  // 아랫단 — 등급. 물약이든 크리처든 같은 네 등급을 쓴다.
  // 라벨은 "기초 물약" / "기초 크리처" 처럼 등급 + 종류로 짓는다
  const kindWord = T(recipeKind === 'creature' ? 'kind_creature' : 'kind_potion');
  const catEl = document.getElementById('recipeTabs');
  if (catEl) {
    catEl.innerHTML = D.RECIPE_GRADES.map(g =>
      `<button class="cat-tab rb-tab ${recipeTab === g.id ? 'active' : ''}" onclick="setRecipeTab('${g.id}')">${
        T('g_' + g.id)} ${kindWord}</button>`
    ).join('');
  }
  // 알아낸 레시피를 위로 (방금 알아낸 것이 가장 위), ??? 는 아래로
  const catRecipes = currentRecipeList().slice().sort((a, b) => {
    const rank = r => (r.result.id === lastFound ? 0 : S.discovered.includes(r.result.id) ? 1 : 2);
    return rank(a) - rank(b);
  });

  const bookEl = document.getElementById('recipeBook');
  if (!catRecipes.length) {
    // 등급 칸은 늘 네 개인데 그 등급의 레시피가 아직 없을 수 있다 (크리처 중급 등)
    bookEl.innerHTML = `<div class="empty-hint">${T('empty_grade')}</div>`;
    document.getElementById('recipeProgress').textContent = '0 / 0';
    renderAtelierDev();
    return;
  }
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

  renderAtelierDev();   // 임시(출시 때 지운다)
}

// 마이 룸에 세울 인물.
//
// 튜토리얼을 마치기 전에는 **인트로에서 막 넘어온 공주 그대로**다.
// 아직 연금술사가 되기 전이라 바디 파츠로 조립한 아바타가 아니라, 인트로에서 보던
// 그 그림이어야 한다. 튜토리얼을 마치는 순간 아바타로 바뀐다.
//
// 인트로 그림은 300 폭 좌표계에 그려져 있다 — 가운데 x=150, 발밑(그림자 중심) y=286,
// 머리끝 y≈136, 폭은 약 116. 아바타와 나란히 서도 어색하지 않게 옮겨 놓는다.
//
// **상자를 옆으로 넓힌다.** 공주는 통통해서 세로 대비 폭이 아바타의 1.5배다.
// 아바타와 같은 200 폭 상자에 키를 맞춰 넣으면 팔이 잘리고, 폭에 맞춰 줄이면
// 키가 74% 밖에 안 돼 아이처럼 보였다. `.avatar-svg` 는 `height:312px; width:auto` 라
// 상자를 넓히면 **키는 그대로 두고 폭만** 늘어난다 — 그래서 상자를 260 으로 잡았다.
// (그려지는 폭 312 × 260/348 ≈ 233px, .char-aura 240px 안에 들어온다)
//
// 그림자는 그림이 이미 갖고 있으니 따로 그리지 않는다. 발밑은 아바타와 같은 y=342 에
// 맞춘다 — 그림자 끝이 상자 아래로 조금 넘지만, 아바타(아래끝 350)도 마찬가지다.
const PRINCESS_BOX    = 260;    // 상자 폭 (아바타는 200)
// 전신 그림 기준 — 머리 끝(136) ~ **신발 아래끝**(294) = 158.
// 아바타(머리 21 ~ 바닥 342 = 321)와 같은 키가 되도록 321/158 ≈ 2.03 배.
// **발 '중심' 이 아니라 아래끝을 바닥에 맞춘다** — 중심으로 맞췄더니 신발 아랫부분이
// viewBox 밖으로 나가 잘렸다. 이 값을 바꾸면 아바타와 키가 어긋난다
const PRINCESS_SCALE  = 2.03;
const PRINCESS_FEET   = 294;    // 그림 안에서 신발이 바닥에 닿는 y
const PRINCESS_GROUND = 342;    // 발밑. 아바타의 그림자 높이와 같은 줄
function princessFigure() {
  // 전신(full) — 마이 룸에서는 방 한가운데 서 있으므로 다리·신발이 있어야 한다
  const art = window.Intro && window.Intro.princessArt ? window.Intro.princessArt('puzzled', true) : '';
  if (!art) return '';
  const s = PRINCESS_SCALE;
  const tx = (PRINCESS_BOX / 2 - 150 * s).toFixed(2);
  const ty = (PRINCESS_GROUND - PRINCESS_FEET * s).toFixed(2);
  return `<svg class="avatar-svg" viewBox="0 0 ${PRINCESS_BOX} 348" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="${T('a11y_princess')}">
    <g transform="translate(${tx},${ty}) scale(${s})">${art}</g>
  </svg>`;
}
function roomFigure(tier) {
  if (!S.tutorialDone) {
    const p = princessFigure();
    if (p) return p;               // 인트로가 없으면(스크립트 누락) 아바타로 떨어진다
  }
  return window.Avatar ? window.Avatar.build(outfitWithColors(), bodyLevel(), tuneScales()) : tier.emoji;
}

// 착장 + 고른 색을 합쳐 Avatar 에 넘긴다.
// 색은 id 로 저장하고 그릴 때만 hex 로 편다 — 나중에 팔레트의 색을 조정해도
// 이미 그 색을 고른 사람의 옷이 같이 따라온다 (hex 를 저장하면 옛 색으로 굳는다)
function outfitWithColors() {
  const colors = {};
  // slotColor() 를 지나므로 **못 가진 색은 자동으로 빠진다** — 세이브에 남아 있어도
  // 아바타에는 안 나온다 (원래 색으로 떨어진다)
  Object.keys(S.outfitColor || {}).forEach(slot => {
    const hex = slotColor(slot);
    if (hex) colors[slot] = hex;
  });
  return Object.assign({}, S.outfit, { colors });
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
  const avatarSvg = roomFigure(tier);
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

  // 개발용 도구 (임시 · 테스트용) — 접힘 상태는 render() 끝에서 한 번에 맞춘다
  renderRoomDevGift();
  renderBodyTune();
  renderRoomDevTail();

  // 스탯
  document.getElementById('statBeauty').textContent = S.stats.beauty;
  document.getElementById('statCharm').textContent = S.stats.charm;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('showcaseTier').textContent = tier.emoji;  // 아이콘만
  // 단계 이름만 짧게 ("여신 단계" 가 아니라 "여신")
  const tierNameEl = document.getElementById('tierName');
  if (tierNameEl) tierNameEl.textContent = TN(tier.title);
  // 화면에서 "매력 총합" 글자를 뺀 대신, 소리로는 무엇의 수인지 알 수 있게 한다
  const totalBox = document.querySelector('.stat-box.highlight');
  if (totalBox) totalBox.setAttribute('aria-label',
    `${T('tier_stage', { tier: TN(tier.title) })} · ${T('stat_total')} ${total}`);

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
      // '?' 는 이름 옆에 인라인으로 둔다 — 모서리에 두면 개수(×N)와 자리가 겹친다.
      // 카드 안에 있지만 마시기와 별개다 — stopPropagation 이 없으면 눌러도 마셔진다.
      return `<div class="potion-card" onclick="drinkPotion('${pid}')">
        <div class="potion-emoji">${r.result.emoji}</div>
        <div class="potion-name">${N(r.result.id, r.result.name)}<button class="potion-why"
          aria-label="${T('potion_why')}"
          onclick="event.stopPropagation(); showPotionEffect('${pid}', this)">?</button></div>
        <div class="potion-count">×${S.potions[pid]}</div>
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
// 튜토리얼을 마치기 전에는 크리처 칸이 잠긴다.
// (아직 공주가 방에 막 들어온 참이라 크리처를 모을 단계가 아니다)
function isRoomTabOpen(t) { return t !== 'creatures' || !!S.tutorialDone; }

function setRoomTab(t, anchor) {
  if (!isRoomTabOpen(t)) { toast(T('locked_tutorial'), anchor); return; }
  roomTab = t; updateRoomTabs();
}
function updateRoomTabs() {
  // 잠긴 칸을 보고 있었는데 잠겼다면(되돌리기 등) 옷으로 물러난다
  if (!isRoomTabOpen(roomTab)) roomTab = 'clothes';
  document.querySelectorAll('.room-tab').forEach(b => {
    const open = isRoomTabOpen(b.dataset.rtab);
    b.classList.toggle('active', open && b.dataset.rtab === roomTab);
    b.classList.toggle('locked', !open);
    // 자물쇠는 **진짜 글자**로 넣는다. CSS ::before 로 붙였더니 checkLocked 가
    // "자물쇠 표시가 없음" 으로 잡았고, 그 지적이 맞다 — 생성된 콘텐츠는 접근성
    // 트리에 안 올라가서 소리로 읽히지 않는다.
    // i18n 이 언어를 바꿀 때 data-i18n 요소의 textContent 를 통째로 갈아 끼우지만,
    // setLang 은 apply() 다음에 render() 를 부르므로 여기서 다시 붙는다.
    const lock = b.querySelector('.rt-lock');
    if (!open && !lock) b.insertAdjacentHTML('afterbegin', '<span class="rt-lock">🔒</span> ');
    if (open && lock) lock.remove();
    // aria-disabled 는 쓰지 않는다 — 이 버튼은 눌리지 않는 게 아니라 '눌러서 이유를
    // 듣는' 버튼이다. 대신 이름에 잠금 사유까지 붙여 준다.
    if (open) b.removeAttribute('aria-label');
    else b.setAttribute('aria-label', `${T(b.dataset.i18n)} (${T('locked_tutorial')})`);
  });
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
// 임시(출시 때 devFlag 조건을 지운다): 개발용 '모든 맵 오픈' 스위치가 켜져 있으면 전부 열린 것으로 본다
function isMapOpen(m)  { return devFlag(DEV_MAPS_KEY) || totalCharm() >= m.unlock; }
function isZoneOpen(z) { return devFlag(DEV_MAPS_KEY) || totalCharm() >= D.zoneUnlock(z.id); }
// 해금 조건 문구 — 점수에 해당하는 단계 이름을 붙여 준다
function unlockText(score) {
  const tier = D.getTier(score);
  return T('unlock_at', { tier: TN(tier.title), score: score });
}

// ─── 마법 솥 ───
// 선택한 솥의 구멍 수만큼 재료를 넣을 수 있다 (3구 → 12구)
function currentCauldron() {
  const c = D.CAULDRONS.find(x => x.id === S.cauldronId);
  // 고른 솥이 잠겼으면(튜토리얼 되돌리기 등) 열려 있는 첫 솥으로 물러난다 —
  // 잠긴 솥의 구멍 수로 계속 조합하게 두면 안 된다
  if (c && isCauldronOpen(c)) return c;
  return D.CAULDRONS.find(isCauldronOpen) || D.CAULDRONS[0];
}
function cauldronSlots() { return currentCauldron().slots; }
// 3구 무쇠 솥만 점수가 아니라 **튜토리얼 완료**로 잠긴다.
// (임시: 개발용 '솥 오픈' 스위치가 켜져 있으면 그것도 연다)
function isCauldronOpen(c) {
  if (devPotOpen(c.id)) return true;
  if (c.needsTutorial && !S.tutorialDone) return false;
  return totalCharm() >= c.unlock;
}
function chooseCauldron(id, el) {
  const c = D.CAULDRONS.find(x => x.id === id);
  if (!c) return;
  if (!isCauldronOpen(c)) { toast(c.needsTutorial ? T('locked_tutorial') : unlockText(c.unlock), el); return; }
  S.cauldronId = id;
  if (S.record && !S.record.pots.includes(id)) S.record.pots.push(id);
  // 구멍이 줄어들면 넘치는 재료는 가방으로 되돌린다
  while (S.cauldron.length > c.slots) S.cauldron.pop();
  save(); render();
  // 위와 같은 이유 — 솥 탭도 다시 그려졌다
  const nm = N(c.id, c.name);
  toast(T('cauldron_picked', { name: nm, n: c.slots, josa: josa(nm, '으로') }), `[data-pot="${id}"]`);
}

// 채집 지대 (채집 화면의 카테고리 탭)
let gatherZone = 'plain';
function setGatherZone(id, el) {
  const z = D.ZONES.find(x => x.id === id);
  if (z && !isZoneOpen(z)) { toast(unlockText(D.zoneUnlock(id)), el); return; }
  gatherZone = id;
  render();
}
// 잠긴 맵을 눌렀을 때 조건 안내
function lockedMapInfo(mapId, el) {
  const m = D.MAPS.find(x => x.id === mapId);
  if (m) toast(unlockText(m.unlock), el);
}

// 레시피 북 카테고리 (하급/중급/상급 물약 · 크리처)
// 레시피 북은 두 단이다 — 종류(물약/크리처)를 먼저 고르고, 물약이면 등급을 고른다
let recipeKind = 'potion';
let recipeTab = 'basic';
// 지금 보고 있는 목록 — 종류와 등급을 둘 다 만족하는 레시피
function currentRecipeList() {
  return D.RECIPES.filter(r => r.result.kind === recipeKind && r.result.grade === recipeTab);
}
function setRecipeKind(k) { recipeKind = k; render(); }
window.setRecipeKind = setRecipeKind;
let lastFound = null;      // 방금 알아낸 레시피 id (목록 맨 위로 올려 강조)
function setRecipeTab(id) { recipeTab = id; render(); }
// 지금 보여 줄 옷장 칸 목록.
// 튜토리얼 전에는 원피스 하나뿐이다 — 공주가 입고 들어온 그 옷만 갈아입을 수 있다.
const TUTORIAL_SLOTS = ['dress'];
function wardrobeSlots() {
  if (S.tutorialDone) return D.WARDROBE_SLOTS;
  return D.WARDROBE_SLOTS.filter(m => TUTORIAL_SLOTS.includes(m.slot));
}
function setWardrobeTab(slot) {
  if (slot !== wardrobeTab) dyeOpen = null;   // 다른 칸으로 가면 펼친 컬러칩은 닫는다
  if (!wardrobeSlots().some(m => m.slot === slot)) return;   // 없는 칸은 무시
  wardrobeTab = slot; renderWardrobe();
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

// 테스트용: 잠긴 아이템 중 하나를 무작위 해금.
// slot 을 주면 그 칸에서만 고른다 (개발용 블록의 종류별 버튼).
function unlockRandom(slot) {
  const from = slot ? D.WARDROBE_SLOTS.filter(m => m.slot === slot)
                    : D.WARDROBE_SLOTS.filter(m => m.gated);
  const locked = [];
  from.forEach(m => (D.WARDROBE[m.slot] || []).forEach(it => {
    if (!isOwned(m.slot, it)) locked.push(it.id);
  }));
  if (!locked.length) { toast(T('all_unlocked')); return; }
  unlockCosmetic(locked[Math.floor(Math.random() * locked.length)]);
}
window.unlockRandom = unlockRandom;

// 테스트용: 잠긴 아이템을 전부 해금. (하나씩 토스트를 띄우지 않고 한 번에 넣는다)
function unlockAllCosmetics() {
  let n = 0;
  D.WARDROBE_SLOTS.filter(m => m.gated).forEach(m =>
    (D.WARDROBE[m.slot] || []).forEach(it => {
      if (isOwned(m.slot, it)) return;
      S.unlocked.push(it.id);
      n++;
    }));
  if (!n) { toast(T('all_unlocked')); return; }
  save();
  toast(T('dev_all_wear_done', { n: n }));
  renderShowcase();
}
window.unlockAllCosmetics = unlockAllCosmetics;

// 잠금이 걸린 칸마다 '랜덤 획득' 버튼을 하나씩. 이모지로 어느 칸인지 알아본다.
function renderRoomDevGift() {
  const el = document.getElementById('roomDevGift');
  if (!el) return;
  const gated = D.WARDROBE_SLOTS.filter(m => m.gated);
  el.innerHTML = `<div class="dev-row">` + gated.map(m => {
      const list = D.WARDROBE[m.slot] || [];
      const have = list.filter(it => isOwned(m.slot, it)).length;
      const done = have >= list.length;
      return `<button class="btn btn-dev dev-gift${done ? ' done' : ''}" onclick="unlockRandom('${m.slot}')"
        aria-label="${N(m.slot, m.label)} ${T('wr_gift')}">${m.emoji} ${N(m.slot, m.label)}
        <span class="dev-gift-n">${have}/${list.length}</span></button>`;
    }).join('')
    + `<button class="btn btn-dev" onclick="unlockAllCosmetics()">🎁 ${T('dev_all_wear')}</button>`
    + `<button class="btn btn-dev" onclick="unlockAllColors()">🎨 ${T('dev_all_color')}</button>`
    + `<button class="btn btn-dev" onclick="devGiveDye(1000)">🧪 ${T('dev_dye')}</button>`
    + `<button class="btn btn-dev" onclick="devGiveCrystal(1000)">💎 ${T('dev_crystal')}</button>`
    + `<button class="btn btn-dev" onclick="unlockAllOf('expression')">😄 ${T('dev_all_face')}</button></div>`;
}

function renderWardrobe() {
  const el = document.getElementById('wardrobe');
  if (!el) return;
  const dressed = S.outfit.dress && S.outfit.dress !== 'dress_none';
  // 튜토리얼을 마치기 전에는 원피스 한 칸만 남긴다 — 처음부터 열두 칸을 늘어놓지 않는다
  const slots = wardrobeSlots();
  if (!slots.some(m => m.slot === wardrobeTab)) wardrobeTab = slots[0].slot;

  // 보유 개수는 **고른 탭 안에만** 쓴다. 예전에는 목록 아래에 따로 한 줄이 있었는데,
  // 색 보유 개수까지 생기면서 같은 화면에 '보유' 가 여러 군데 흩어져 무엇의 수인지 헷갈렸다.
  const tabs = slots.map(m => {
    const dimmed = dressed && (m.slot === 'top' || m.slot === 'bottom');
    const on = wardrobeTab === m.slot;
    const list = D.WARDROBE[m.slot] || [];
    const n = on && m.gated
      ? `<span class="wr-tab-n">${list.filter(x => isOwned(m.slot, x)).length}/${list.length}</span>` : '';
    return `<button class="cat-tab wr-tab ${on ? 'active' : ''} ${dimmed ? 'dim' : ''}"
      onclick="setWardrobeTab('${m.slot}')"
      aria-label="${N(m.slot, m.label)}${on && m.gated ? ' · ' + T('wr_owned', { have: list.filter(x => isOwned(m.slot, x)).length, total: list.length }) : ''}"
      >${m.emoji} ${N(m.slot, m.label)}${n}</button>`;
  }).join('');

  const list = D.WARDROBE[wardrobeTab] || [];
  const items = list.map(it => {
    const on = S.outfit[wardrobeTab] === it.id;
    const owned = isOwned(wardrobeTab, it);
    let ic;
    if (it.kind === 'none') ic = '🚫';
    else if (it.emoji) ic = it.emoji;
    // 지금 입고 있는 옷만 **고른 색**으로 보여 준다. 목록 전체에 칠하면
    // 검정을 골랐을 때 모든 옷이 똑같은 검정 동그라미가 돼 서로 구분이 안 된다
    else ic = `<span class="wr-swatch" style="background:${(on && slotColor(wardrobeTab)) || it.color || '#ccc'}"></span>`;
    const lock = owned ? '' : '<span class="wr-lock">🔒</span>';
    return `<button class="wr-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}" onclick="equip('${wardrobeTab}','${it.id}')">
      <span class="wr-ic">${ic}${lock}</span><span class="wr-nm">${N(it.id, it.name)}</span></button>`;
  }).join('');

  const hint = dressed && (wardrobeTab === 'top' || wardrobeTab === 'bottom')
    ? `<div class="wr-hint">${T('dress_hint')}</div>` : '';

  el.innerHTML = `<div class="cat-tabs wr-tabs">${tabs}</div>${hint}<div class="wr-items">${items}</div>`
    + colorRow(wardrobeTab);

}

// ─── 옷 색 고르기 ──────────────────────────────────────────────
// 색만 다른 옷을 60벌 늘어놓는 대신, 입고 있는 옷의 색을 갈아입힌다.
// 색 이름은 **고른 것 하나만 글자로** 보여 준다 — 60개에 전부 이름을 달면
// 글자가 너무 작아져 읽을 수 없다 (나머지는 aria-label 로 읽어 준다).
// 팔레트의 색은 **획득해야 쓸 수 있다.** 옷이 그렇듯 색도 획득 대상이다.
// 아이템과 같은 S.unlocked 에 넣는다 — 색 id 는 c_ 로 시작해 아이템 id 와 겹치지 않는다.
// (획득 조건은 아직 붙이지 않았다. 지금은 개발용 블록으로만 연다)
function isColorOwned(id) { return (S.unlocked || []).includes(id); }

// ─── 마법 염색약 ───────────────────────────────────────────────
// 색을 입히는 것은 **소모품 한 개**를 쓰는 일이고, 그 효과는 24시간이면 풀린다.
// 그래서 색은 '가진 것' 이 아니라 '빌린 것' 이다 — 되돌아오는 것이 규칙이다.
const DYE_MS = 24 * 60 * 60 * 1000;

function dyeLeft(slot) {
  const t = (S.dyeUntil || {})[slot];
  return t ? t - Date.now() : 0;
}
// 시간이 다 된 염색을 걷어낸다. 하나라도 걷어냈으면 true (부른 쪽이 저장·다시 그리기)
function expireDye() {
  if (!S.dyeUntil) return false;
  let changed = false;
  Object.keys(S.dyeUntil).forEach(slot => {
    if (dyeLeft(slot) > 0) return;
    delete S.dyeUntil[slot];
    if (S.outfitColor) delete S.outfitColor[slot];
    changed = true;
  });
  return changed;
}

// 받침이 있으면 앞것, 없으면 뒷것 ('가디건을' / '원피스를').
// 한글이 아니면 조사를 붙이지 않는다 — 영어 문장은 조사를 쓰지 않으므로 빈 값이 맞다.
// '으로' 만 규칙이 하나 더 있다: 받침이 없거나 **ㄹ 받침**이면 '로' 다 ('솥으로' / '칼로').
function josa(word, pair) {
  const w = String(word || '');
  const c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return '';
  const b = (c - 0xac00) % 28;                 // 받침 코드 (0 = 없음, 8 = ㄹ)
  if (pair === '으로') return (b === 0 || b === 8) ? '로' : '으로';
  return pair[b !== 0 ? 0 : 1];
}

// '원래 색'(아이템이 갖고 태어난 색)은 언제나 쓸 수 있다 — 그 옷을 가졌으면 그 색도 가진 것이다.
// 고른 색을 잃었거나(초기화) **염색이 풀렸으면** 원래 색으로 떨어진다.
function slotColor(slot) {
  const id = (S.outfitColor || {})[slot];
  if (!id || !isColorOwned(id) || dyeLeft(slot) <= 0) return null;
  const c = D.COLORS.find(x => x.id === id);
  return c ? c.hex : null;
}

// 지금 그 칸에 입고 있는 옷
function wornItem(slot) {
  const it = (D.WARDROBE[slot] || []).find(x => x.id === S.outfit[slot]);
  return (it && it.kind !== 'none') ? it : null;
}

// 염색약 쓰기 버튼 — 없으면 열지 않는다
let dyeOpen = null;      // 컬러칩을 펼쳐 놓은 칸 (한 번에 하나)
function toggleDye(slot) {
  if ((S.dye || 0) <= 0) { toast(T('dye_none')); return; }
  dyeOpen = (dyeOpen === slot) ? null : slot;
  renderWardrobe();
}
function dyeHelp() { toast(T('dye_help'), null, 3600); }
window.toggleDye = toggleDye;
window.dyeHelp = dyeHelp;

function colorRow(slot) {
  if (!D.COLORABLE_SLOTS.includes(slot)) return '';
  const it = wornItem(slot);
  if (!it) return '';                                  // '없음' 을 입었으면 물들일 것이 없다
  const have = S.dye || 0;
  // **줄 전체가 버튼이다.** 글자만 눌리면 어디를 눌러야 하는지 알기 어렵다.
  // 화살표로 열림/닫힘을 알린다 — 눌러도 아무 일이 없어 보이는 순간이 없어야 한다.
  // '?' 는 이 줄 안에 있지만 **따로 동작한다** (stopPropagation) — 안내를 보려다 열리면 안 된다
  const open = dyeOpen === slot;
  const head = `<div class="dye-bar ${have ? '' : 'off'}" role="button" tabindex="0"
      aria-expanded="${open}" aria-label="${T('dye_use')}"
      onclick="toggleDye('${slot}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDye('${slot}')}">
      <span class="dye-label">${T('dye_use')}</span>
      <button class="dye-help" onclick="event.stopPropagation();dyeHelp()"
        aria-label="${T('dye_help_label')}">?</button>
      <span class="dye-caret" aria-hidden="true">▾</span>
      <span class="dye-have">${T('dye_have', { n: have })}</span>
    </div>`;
  if (!open) return head;

  const curId = (S.outfitColor || {})[slot] || '';
  const cur = (isColorOwned(curId) && dyeLeft(slot) > 0) ? curId : '';
  const curName = cur ? N(cur, (D.COLORS.find(x => x.id === cur) || {}).name) : T('wr_color_orig');
  const owned = D.COLORS.filter(c => isColorOwned(c.id)).length;
  const dots = D.COLORS.map(c => {
    const on = cur === c.id;
    const got = isColorOwned(c.id);
    // 잠긴 색은 **채도를 낮추지 않는다.** 색 자체가 내용이라 흐리게 하면 무엇을 얻는지 안 보인다.
    // 대신 불투명도를 낮추고 자물쇠를 얹는다 (색에 기대지 않는 신호 — UI_POLICY 7장)
    return `<button class="wr-color ${on ? 'on' : ''} ${got ? '' : 'locked'}" style="background:${c.hex}"
      onclick="askDye('${slot}','${c.id}')"
      aria-label="${N(c.id, c.name)}${got ? '' : ' 🔒'}"${on ? ' aria-current="true"' : ''}
      >${got ? '' : '<span class="wr-clock">🔒</span>'}</button>`;
  }).join('');
  // 맨 앞은 '원래 색' — 되돌리는 데는 염색약을 쓰지 않는다
  const orig = `<button class="wr-color wr-color-orig ${cur ? '' : 'on'}" style="background:${it.color || '#ccc'}"
    onclick="undye('${slot}')" aria-label="${T('wr_color_orig')}"></button>`;
  return head + `<div class="wr-color-head">
      <span class="wr-color-tt">${T('wr_color')}</span><span class="wr-color-nm">${curName}</span>
    </div><div class="wr-colors">${orig}${dots}</div>
    <div class="wr-color-foot"><span class="wr-color-n">${T('wr_owned', { have: owned, total: D.COLORS.length })}</span></div>`;
}

// 색을 눌렀을 때 — 잠겼으면 막고, 아니면 확인 패널을 띄운다
function askDye(slot, colorId) {
  const c = D.COLORS.find(x => x.id === colorId);
  if (!c) return;
  if (!isColorOwned(colorId)) {
    // 어떤 색을 눌렀는지 같이 알려 준다 — 60개가 늘어서 있어 색만으로는 무엇을 눌렀는지 모른다
    toast(T('locked_color', { name: N(c.id, c.name) }));
    return;
  }
  if ((S.dye || 0) <= 0) { toast(T('dye_none')); return; }
  const it = wornItem(slot);
  if (!it) return;
  const item = N(it.id, it.name), color = N(c.id, c.name);
  showConfirm(T('dye_confirm', { item, color, josa: josa(item, '을를') }),
    () => applyDye(slot, colorId));
}
window.askDye = askDye;

function applyDye(slot, colorId) {
  if ((S.dye || 0) <= 0) { toast(T('dye_none')); return; }
  const c = D.COLORS.find(x => x.id === colorId);
  const it = wornItem(slot);
  if (!c || !it) return;
  S.dye--;
  S.outfitColor[slot] = colorId;
  S.dyeUntil[slot] = Date.now() + DYE_MS;
  dyeOpen = null;        // 다 썼으면 접는다 — 열어 둔 채로 두면 방금 바뀐 아바타가 안 보인다
  save();
  toast(T('dye_done', { item: N(it.id, it.name), color: N(c.id, c.name) }));
  renderShowcase();                  // 아바타 + 옷장 동시 갱신
}

// 원래 색으로 되돌리기 — 염색약을 쓰지 않는다
function undye(slot) {
  delete S.outfitColor[slot];
  delete S.dyeUntil[slot];
  save();
  renderShowcase();
}
window.undye = undye;

// 테스트용: 한 칸을 통째로 연다
function unlockAllOf(slot) {
  const got = (D.WARDROBE[slot] || []).filter(it => !isOwned(slot, it));
  if (!got.length) { toast(T('all_unlocked')); return; }
  got.forEach(it => S.unlocked.push(it.id));
  save();
  wardrobeTab = slot;
  toast(T('unlocked', { name: N(got[0].id, got[0].name) + ' 외 ' + (got.length - 1) }));
  renderShowcase();
}
window.unlockAllOf = unlockAllOf;

// 테스트용: 팔레트를 통째로 연다
function unlockAllColors() {
  const got = D.COLORS.filter(c => !isColorOwned(c.id));
  if (!got.length) { toast(T('all_unlocked')); return; }
  got.forEach(c => S.unlocked.push(c.id));
  save();
  toast(T('dev_all_color_done', { n: got.length }));
  renderShowcase();
}
window.unlockAllColors = unlockAllColors;

// 테스트용: 마법 염색약 채우기
function devGiveDye(n) {
  S.dye = (S.dye || 0) + (n || 5);
  save();
  toast(T('dev_dye_done', { n: S.dye }));
  renderShowcase();
}
window.devGiveDye = devGiveDye;

// 테스트용: 현자의 결정 채우기 (충전 1회 분)
function devGiveCrystal(n) {
  S.crystal = (S.crystal || 0) + (n || D.ENERGY.chargeCost);
  save(); render();
  toast(T('dev_crystal_done', { n: S.crystal.toLocaleString() }));
}
window.devGiveCrystal = devGiveCrystal;

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
// 라벨은 i18n 을 지난다 — 개발용이라도 영어에서 한글이 남으면 폭 검사를 못 받는다
const TUNE_PARTS = [
  { k: 'torso', max: 150 },
  { k: 'waist', max: 150 },
  { k: 'hip',   max: 150 },
  { k: 'arm',   max: 150 },
  { k: 'thigh', max: 200 },
  { k: 'calf',  max: 200 },
  { k: 'face',  max: 114 },
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

// ─── 개발용 도구 (임시 · 출시 때 이 블록과 화면의 .dev-tools 를 지운다) ───
//
// 화면마다 하나씩 둔다. 각 블록은 data-dev 로 자기 이름을 갖고, 열고 닫은 상태는
// 그 이름으로 따로 기억한다 — 마이 룸에서 열어 뒀다고 채집에서도 열려 있으면 곤란하다.
// 기본은 닫힘. 세이브와 무관한 이 기기의 화면 설정이라 SAVE_VER 는 건드리지 않는다.
const DEV_OPEN_KEY = 'dieter_alchemist_devopen_v1';
function devOpenKey(name) { return DEV_OPEN_KEY + (name ? '_' + name : ''); }
function devToolsOpen(name) {
  try { return localStorage.getItem(devOpenKey(name)) === '1'; } catch (e) { return false; }
}
function applyDevTools() {
  document.querySelectorAll('.dev-tools').forEach(box => {
    const open = devToolsOpen(box.dataset.dev);
    box.classList.toggle('open', open);
    const btn = box.querySelector('.dev-toggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = box.querySelector('.dev-caret');
    if (caret) caret.textContent = open ? '▾' : '▸';
  });
}
function toggleDevTools(name) {
  try { localStorage.setItem(devOpenKey(name), devToolsOpen(name) ? '0' : '1'); } catch (e) {}
  applyDevTools();
}
window.toggleDevTools = toggleDevTools;

// ─── 채집 화면 개발용 스위치 ───
//
// 맵 해금과 히든 재료 공개는 **세이브에 쓰지 않는다.** 켠 채로 저장했다가
// 서버에 올라가면 다른 기기에서도 다 열린 상태가 되고, 되돌릴 방법이 없다.
// 이 기기에만 남는 표시로 두고, 판정하는 곳에서 그때그때 본다.
const DEV_MAPS_KEY     = 'dieter_alchemist_devmaps_v1';
const DEV_SPECIALS_KEY = 'dieter_alchemist_devspecials_v1';
function devFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function devToggleFlag(key) {
  try { localStorage.setItem(key, devFlag(key) ? '0' : '1'); } catch (e) {}
  render();
}
function devAllMaps()     { devToggleFlag(DEV_MAPS_KEY); }
function devAllSpecials() { devToggleFlag(DEV_SPECIALS_KEY); }

// 모든 재료를 1000개씩. 이건 진짜 소지품이라 세이브에 들어간다.
function devFillItems() {
  const ids = Object.keys(D.INGREDIENTS);
  ids.forEach(id => { S.inventory[id] = 1000; });
  save();
  toast(T('dev_items_done', { n: ids.length }));
  render();
}

function renderGatherDev() {
  const el = document.getElementById('gatherDevBody');
  if (!el) return;
  const sw = (on, label, fn) =>
    `<button class="btn btn-dev${on ? ' on' : ''}" onclick="${fn}()">${on ? '☑' : '☐'} ${label}</button>`;
  el.innerHTML =
    `<button class="btn btn-dev" onclick="fillEnergy()">${T('dev_fill_ap')}</button>` +
    sw(devFlag(DEV_MAPS_KEY), T('dev_all_maps'), 'devAllMaps') +
    sw(devFlag(DEV_SPECIALS_KEY), T('dev_all_specials'), 'devAllSpecials') +
    `<button class="btn btn-dev" onclick="devFillItems()">${T('dev_fill_items')}</button>`;
}

// 튜토리얼 완료 표시. 채집 쪽 스위치들과 달리 이건 **세이브에 들어간다** —
// 진짜 진행 상태이고, 기기를 바꿔도 따라가야 하기 때문이다.
// 껐다 켤 수 있게 둔 이유: 꺼서 인트로 공주 상태를 다시 확인할 수 있어야 한다.
function devToggleTutorial() {
  S.tutorialDone = !S.tutorialDone;
  save();
  toast(T(S.tutorialDone ? 'dev_tut_done' : 'dev_tut_undone'));
  render();
}
function renderRoomDevTail() {
  const el = document.getElementById('roomDevTail');
  if (!el) return;
  const on = !!S.tutorialDone;
  el.innerHTML = `<button class="btn btn-dev${on ? ' on' : ''}" onclick="devToggleTutorial()">${
    on ? '☑' : '☐'} ${T('dev_tutorial')}</button>`;
}
window.devToggleTutorial = devToggleTutorial;

// ─── 공방 화면 개발용 스위치 ───
//
// 솥 해금은 세이브에 쓰지 않는다 (채집의 맵/히든과 같은 이유 — 서버에 올라가면
// 다른 기기에서도 다 열린 채가 되고 되돌릴 방법이 없다).
// 레시피는 다르다. '알아낸 레시피' 는 진짜 진행이라 세이브에 들어간다.
const DEV_POTS_KEY = 'dieter_alchemist_devpots_v1';
function devPots() {
  try { return JSON.parse(localStorage.getItem(DEV_POTS_KEY) || '[]'); } catch (e) { return []; }
}
function devPotOpen(id) { return devPots().indexOf(id) >= 0; }
function devTogglePot(id) {
  const list = devPots();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  try { localStorage.setItem(DEV_POTS_KEY, JSON.stringify(list)); } catch (e) {}
  render();
}
function devAllPots() {
  // 하나라도 잠겨 있으면 전부 열고, 이미 다 열려 있으면 전부 되돌린다
  const every = D.CAULDRONS.every(c => devPotOpen(c.id));
  try {
    localStorage.setItem(DEV_POTS_KEY, JSON.stringify(every ? [] : D.CAULDRONS.map(c => c.id)));
  } catch (e) {}
  render();
}

// 레시피 열기 — 카테고리 하나 또는 전부. 세이브에 들어간다.
function devOpenRecipes(catId) {
  const cat = catId === 'all' ? null : D.RECIPE_CATS.find(c => c.id === catId);
  const list = cat ? D.RECIPES.filter(cat.match) : D.RECIPES;
  let n = 0;
  list.forEach(r => {
    if (!S.discovered.includes(r.result.id)) { S.discovered.push(r.result.id); n++; }
  });
  save();
  toast(T('dev_recipes_done', { n }));
  render();
}

function renderAtelierDev() {
  const el = document.getElementById('atelierDevBody');
  if (!el) return;
  const pots = D.CAULDRONS.map(c => {
    const on = devPotOpen(c.id);
    return `<button class="btn btn-dev${on ? ' on' : ''}" onclick="devTogglePot('${c.id}')">${
      on ? '☑' : '☐'} ${N(c.id, c.name)} ${c.slots}${T('slot_unit')}</button>`;
  }).join('');
  const allOn = D.CAULDRONS.every(c => devPotOpen(c.id));
  const cats = D.RECIPE_CATS.map(c =>
    `<button class="btn btn-dev" onclick="devOpenRecipes('${c.id}')">📖 ${N(c.id + '_cat', c.label)}</button>`
  ).join('');
  el.innerHTML =
    `<button class="btn btn-dev" onclick="fillEnergy()">${T('dev_fill_ap')}</button>` +
    `<div class="dev-group">${T('dev_pots')}</div>` +
    `<button class="btn btn-dev${allOn ? ' on' : ''}" onclick="devAllPots()">${
      allOn ? '☑' : '☐'} ${T('dev_all_pots')}</button>` + pots +
    `<div class="dev-group">${T('dev_recipes')}</div>` +
    `<button class="btn btn-dev" onclick="devOpenRecipes('all')">${T('dev_all_recipes')}</button>` + cats;
}

window.devTogglePot = devTogglePot;
window.devAllPots = devAllPots;
window.devOpenRecipes = devOpenRecipes;

window.devAllMaps = devAllMaps;
window.devAllSpecials = devAllSpecials;
window.devFillItems = devFillItems;

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
      <span class="tune-label">${T('part_' + p.k)}${atMax ? ` <span class="tune-cap">${T('tune_max')}</span>` : ''}</span>
      ${btn(-1, '−')}
      <span class="tune-val${v === 100 ? '' : ' on'}">${v}%</span>
      ${btn(1, '+')}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="tune-head">
      <button class="tune-reset" onclick="resetTune()">${T('tune_reset')}</button></div>${rows}`;
}

// 카테고리 탭 줄(.cat-tabs)은 **줄바꿈**한다 — UI_POLICY.md 참고.
// 예전에는 가로 스크롤이라 휠·끌기 핸들러와 선택 탭 정렬이 필요했는데,
// 줄바꿈이 되면서 화면 밖에 숨는 탭이 없어져 전부 지웠다.

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
  // render() 가 줄을 새로 그렸다 — 넘겨받은 el 은 이미 문서에서 떨어졌으므로 새로 찾는다
  toast(T('recipe_filled', { name: N(r.result.id, r.result.name) }),
    `[data-recipe="${resultId}"]`, null, 'above');
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
// 글자만 보내면 무엇을 자랑하는지가 안 보인다. **방에 서 있는 내 아바타를 그대로 그린
// 카드 이미지**를 만들어 보낸다. 화면을 캡처하는 게 아니라 같은 SVG 를 캔버스에 다시 그린다 —
// 화면 밖으로 잘리지도, 개발용 블록이 딸려 오지도 않는다.
const CARD_W = 720, CARD_H = 1000, CARD_ROOM_H = 660;

// SVG 문자열 → 이미지. **width/height 를 박아 넣어야 한다** —
// viewBox 만 있으면 브라우저마다 기본 크기(300×150)로 그려 버린다.
function svgToImage(svg, w, h) {
  const sized = svg.replace(/<svg /, `<svg width="${w}" height="${h}" `);
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => no(new Error('svg 래스터화 실패'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
  });
}

// SVG 가 스스로 밝힌 크기. **아바타(200×348)와 인트로 공주(260×348)는 가로가 다르다** —
// 한쪽 비율로 못 박으면 다른 쪽이 좌우에 여백을 두고 작게 그려진다(letterbox).
function svgBox(svg, dw, dh) {
  const m = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (!m) return { w: dw, h: dh };
  const v = m[1].trim().split(/\s+/).map(Number);
  return (v.length === 4 && v[2] > 0 && v[3] > 0) ? { w: v[2], h: v[3] } : { w: dw, h: dh };
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// 과시 카드 한 장을 그려 PNG Blob 으로 돌려준다
async function shareCardBlob() {
  const total = totalCharm();
  const tier = D.getTier(total);
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = CARD_H;
  const ctx = cv.getContext('2d');

  const ink = cssVar('--ink', '#5a4a55'), inkSoft = cssVar('--ink-soft', '#6e5d69');
  ctx.fillStyle = cssVar('--card', '#ffffff');
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ① 방 배경 — viewBox 400×320 을 'slice'(cover)로 채운다. CSS 의 preserveAspectRatio 와 같은 규칙
  if (window.Avatar && Avatar.roomScene) {
    const k = Math.max(CARD_W / 400, CARD_ROOM_H / 320);
    const w = 400 * k, h = 320 * k;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, CARD_W, CARD_ROOM_H); ctx.clip();
    ctx.drawImage(await svgToImage(Avatar.roomScene(), Math.round(w), Math.round(h)),
      (CARD_W - w) / 2, CARD_ROOM_H - h, w, h);   // xMid YMax
    ctx.restore();
  }

  // ② 아바타 — 방 바닥에 발이 닿게. 화면과 같이 **높이를 맞추고 가로는 비율대로** 둔다
  const fig = roomFigure(tier);
  const box = svgBox(fig, 200, 348);
  const avH = 560, avW = avH * box.w / box.h;
  ctx.save();
  ctx.shadowColor = 'rgba(180,140,160,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
  ctx.drawImage(await svgToImage(fig, Math.round(avW), avH),
    (CARD_W - avW) / 2, CARD_ROOM_H - avH - 30, avW, avH);
  ctx.restore();

  // ③ 전시 중인 크리처 — 벽과 바닥 쪽으로. **창문(오른쪽 위)은 피한다** — 겹치면 유리에 붙은 것처럼 보인다
  const spots = [[0.15, 0.24], [0.12, 0.60], [0.85, 0.82], [0.30, 0.88]];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '46px "Noto Sans KR", sans-serif';
  S.creatures.slice(0, 4).forEach((cid, i) => {
    const r = D.RECIPES.find(x => x.result.id === cid);
    if (r) ctx.fillText(r.result.emoji, CARD_W * spots[i][0], CARD_ROOM_H * spots[i][1]);
  });

  // ④ 아래 정보 판
  ctx.fillStyle = cssVar('--cream', '#fff7f2');
  ctx.fillRect(0, CARD_ROOM_H, CARD_W, CARD_H - CARD_ROOM_H);
  // 이름 → 단계 → '매력 총합' → 큰 숫자 → 게임 이름.
  // 숫자 **위에** 라벨을 두는 이유: 아래에 두면 게임 이름과 붙어 두 줄이 한 덩어리로 보인다
  let y = CARD_ROOM_H + 56;
  if (S.name) {
    ctx.fillStyle = inkSoft;
    ctx.font = '800 34px "Noto Sans KR", sans-serif';
    ctx.fillText(S.name, CARD_W / 2, y);
  }
  y += 60;
  ctx.fillStyle = ink;
  ctx.font = '800 46px "Noto Sans KR", sans-serif';
  ctx.fillText(`${tier.emoji} ${TN(tier.title)}`, CARD_W / 2, y);
  y += 60;
  ctx.fillStyle = inkSoft;
  ctx.font = '700 24px "Noto Sans KR", sans-serif';
  ctx.fillText(T('stat_total'), CARD_W / 2, y);
  y += 62;
  ctx.fillStyle = ink;
  ctx.font = '900 80px "Noto Sans KR", sans-serif';
  ctx.fillText(String(total), CARD_W / 2, y);
  ctx.fillStyle = inkSoft;
  ctx.font = '700 24px "Noto Sans KR", sans-serif';
  ctx.fillText(T('app_title'), CARD_W / 2, CARD_H - 32);

  return new Promise((ok, no) =>
    cv.toBlob(b => (b ? ok(b) : no(new Error('PNG 만들기 실패'))), 'image/png'));
}

async function flexCharm() {
  const total = totalCharm();
  const tier = D.getTier(total);
  const text = T('share_text', { total: total, emoji: tier.emoji, tier: TN(tier.title) });

  // **여기서부터는 사용자가 방금 누른 그 순간이다.** 브라우저는 공유·클립보드를
  // '누른 직후' 에만 허용하는데, 그림을 그리는 사이에 그 자격이 만료된다.
  // 그래서 ClipboardItem 은 **기다리기 전에** 만들어 둔다 — 이 객체는 Blob 대신
  // Promise 를 받아 주므로, 그림이 늦게 완성돼도 붙여넣기가 살아 있다.
  let blobP = null, clip = null;
  try {
    blobP = shareCardBlob();
    blobP.catch(() => {});     // 아래에서 안 쓰이고 실패해도 경고가 안 뜨게
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      clip = new ClipboardItem({ 'image/png': blobP });
    }
  } catch (e) { blobP = null; clip = null; }

  // ① 공유 시트 (모바일) — 이미지를 그대로 다른 앱에 보낸다
  if (blobP && navigator.share && navigator.canShare) {
    try {
      const file = new File([await blobP], 'charm.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // 사용자가 공유를 닫은 것 — 실패가 아니다
    }
  }
  // ② 이미지 복사
  if (clip) {
    try { await navigator.clipboard.write([clip]); toast(T('copied_img')); return; } catch (e) {}
  }
  // ③ 내려받기
  if (blobP) {
    try {
      const url = URL.createObjectURL(await blobP);
      const a = document.createElement('a');
      a.href = url; a.download = 'charm.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(T('saved_img'));
      return;
    } catch (e) {}
  }
  // ④ 그림이 안 되면 예전처럼 글자라도
  if (navigator.share) { navigator.share({ title: T('app_title'), text }).catch(() => {}); }
  else if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast(T('copied'))); }
  else toast(text);
}
window.shareCardBlob = shareCardBlob;

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
// html 을 주면 문구 아래에 붙는다 (보유/지불 같은 표). **문구 자체는 언제나 textContent 다** —
// 이름처럼 사람이 넣은 값이 들어와도 태그로 해석되지 않게.
function showConfirm(msg, cb, html, okLabel) {
  document.getElementById('confirmText').textContent = msg;
  const extra = document.getElementById('confirmExtra');
  extra.innerHTML = html || '';
  extra.style.display = html ? '' : 'none';
  document.getElementById('confirmOk').textContent = okLabel || T('btn_ok');
  _confirmCb = cb;
  document.getElementById('confirmModal').classList.add('show');
}
function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('show');
  // 라벨을 되돌려 놓지 않으면 다음 패널이 남의 가격표를 달고 뜬다
  document.getElementById('confirmOk').textContent = T('btn_ok');
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
