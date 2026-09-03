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
//  9: '헤어컬러' 칸이 없어지고 머리도 염색으로 색을 정한다
// 10: 튜토리얼(S.tut)이 생겼다 — 이 버전 이전의 세이브는 튜토리얼을 본 적이 없으므로
//     다시 보여 주지 않고 **마친 것으로 친다** (그래야 tutorialDone 도 같이 켜진다)
const SAVE_VER = 13;

// 처음부터 알고 있는 레시피. defaultState 와 migrate 가 같이 쓰므로 값이 어긋나지 않는다.
const STARTER_RECIPES = ['vitality', 'blush'];

// 세이브 8 이전에 '처음부터 갖고 있던' 표정. 예전 세이브에는 그대로 채워 준다
const OLD_STARTER_FACES = ['exp_smile', 'exp_wink', 'exp_happy'];

// 세이브 7 에서 잠금 대상이 된 칸들. 예전 세이브에는 이 칸의 옷을 전부 채워 준다.
const NEW_GATED_SLOTS = ['top', 'bottom', 'dress', 'circlet', 'earring', 'necklace', 'glove', 'shoes'];

// 세이브 9 이전의 '헤어컬러' 칸 → 팔레트 색. 그 칸이 없어졌으므로,
// 브라운이 아닌 머리색을 골라 뒀던 사람은 그 색을 잃지 않게 염색으로 옮긴다.
// 팔레트에 똑같은 색이 없어 **가장 가까운 색**으로 보낸다 (RGB 거리로 골랐다).
// 핑크만 거리가 더 가까운 '코랄 핑크' 대신 '벚꽃' 이다 — 코랄 쪽은 살구색으로 기울어
// 머리색으로 보면 분홍이 아니게 된다.
const OLD_HAIR_COLOR = {
  hcol_black:  'c_softblack',   // #3b2f2c → #2c2c30
  hcol_blonde: 'c_gold',        // #e6c37a → #e6c05c
  hcol_pink:   'c_blossom',     // #ffa6cf → #ffc2d4
  hcol_lav:    'c_lavender',    // #c4a9ff → #cbb6ff
  hcol_mint:   'c_mint',        // #8fe0c0 → #a8e6cf
  hcol_silver: 'c_silver',      // #d6d6e2 → #d9d9e0
};

// **마이그레이션이 쓰는 값은 전부 이 위쪽에 둔다.** load() 는 이 파일이 끝까지
// 읽히기 전(맨 아래가 아니라 중간)에 불린다 — 아래쪽에 const 로 두면 migrate 가
// 그 값에 닿는 순간 ReferenceError 가 나고, load() 의 catch 가 그것을 삼켜
// **세이브가 통째로 기본값으로 되돌아간다.** (실제로 그렇게 만들었다가 잡았다)

// ─── i18n 단축 헬퍼 (i18n.js 없으면 한국어 원문 유지) ───
const T  = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const N  = (id, ko) => (window.I18N ? I18N.n(id, ko) : ko);   // 데이터 이름
const TN = ko => (window.I18N ? I18N.n(ko, ko) : ko);          // 등급 이름

// ─── 상태 ───
const defaultState = () => ({
  inventory: {},          // { ingredientId: count }
  potions:   {},          // { potionId: count } (미사용 물약 보관)
  creatures: [],          // [creatureId, ...] (가진 것. 중복이 들어갈 수 있다)
  // 크리처 생산 (8단계) — 없던 칸을 더하는 것이라 마이그레이션이 필요 없다
  produced: [],           // 최근 5일치 기록 [{ day, items:{id:n}, seen }]
  producedDay: 0,         // 마지막으로 정산한 날짜 키
  // 밭을 마지막으로 연 시각 (9단계). **밭 자체는 서버가 갖는다** — 여기 남기면
  // 두 벌이 되고 어느 쪽이 맞는지 판단할 근거가 없다. 이 값은 「침입 기록을 어디까지
  // 봤나」 하나뿐이다. 없던 칸을 더하는 것이라 마이그레이션이 필요 없다
  farmSeenAt: 0,
  // 탐험 일지 — 그날 있었던 일 (최근 것부터 `DIARY_MAX` 줄까지).
  // **없던 칸을 더하는 것**이라 `SAVE_VER` 를 안 올린다 —
  // 옛 세이브에는 이 칸이 없고 `defaultState()` 의 `[]` 가 그대로 남는다
  // (`CREATURE.md` 11장의 `petField` 와 같은 경우다)
  diary: [],
  // 퀘스트 (`QUEST.md`). **없던 칸을 더하는 것**이라 `SAVE_VER` 를 안 올린다.
  // · `active` — 지금 하는 것 하나. **한 번에 하나만 내보낸다** (목록은 곧 숙제다)
  // · `n`      — 지금 퀘스트의 진행 수. **받은 뒤부터 센다**
  // · `done`   — 마친 것 (순서대로 · 스토리 다시보기가 이 순서를 쓴다)
  // · `queue`  — 조건은 찼는데 아직 안 내보낸 것
  quest: { active: null, n: 0, done: [], queue: [] },
  // 부엌에 마지막으로 간 날 (`STORY.md` 요리사 클레멘). **그날 밤은 혼자가 아니다.**
  kitchenDay: 0,
  // 본 컷씬 — 스토리 다시보기 목록 (2단계에서 쓴다)
  seenCuts: [],
  // ─── 키워드 (STORY.md 「키워드 시스템」) ─────────────────────
  // **셋 다 없던 칸이라 `SAVE_VER` 를 안 올린다.** 옛 세이브에는 이 키가 아예 없어서
  // `Object.assign(defaultState(), 저장값)` 이 여기 적힌 기본값을 그대로 남긴다.
  //
  // ⚠️ `keywords` 의 기본값이 **빈 배열이 아니다.** 「정신적 허기」는 누가 알려 준 것이
  // 아니라 공주가 처음부터 지고 있는 것이고(인트로가 그 이야기다), 이것이 하나 있어야
  // 이야기가 시작된다 — 마을이 전부 잠긴 채로 「물어볼 것이 없다」가 되면
  // 아무 데도 못 간다. 옛 세이브도 이 기본값을 그대로 받으므로 막히지 않는다.
  keywords: ['kw_hunger'],
  // 이미 물어본 것 — `'npc|kw'` 꼴. 회색으로 표시하고, 다시 물어도 된다
  talked: [],
  // ─── 흐린 장 (비법서가 수수께끼가 된다) ───────────────────
  // ⚠️ **셋 다 없던 칸이라 SAVE_VER 를 안 올린다.**
  // `known`    — 레시피 id → 그 장에서 «밝혀낸» 재료 id 들
  // `gathered` — 재료 id → 여태 모아 본 누적 수. **`inventory` 를 쓰면 안 된다**
  //              (그건 «지금 가진 것»이라 쓰면 줄어들어서, 숙련이 도로 사라진다)
  known: {},
  gathered: {},
  // 지금 «무엇을 만들려는 중»인가 (비법서에서 고른 장). 모르는 칸을 채워 볼 때
  // 무엇과 맞춰 볼지가 이것으로 정해진다. **손으로 담기 시작하면 놓는다**
  guess: null,
  // 복구 코드를 한 번이라도 봤는가 (복사했거나 시트에서 확인했거나).
  // **세이브에 둔다** — 「이 기기에서 봤나」가 아니라 「이 캐릭터의 코드를 아는가」라서,
  // 기기를 옮기면 그 사실도 따라가야 한다. 없던 칸이라 SAVE_VER 는 안 올린다
  codeSeen: false,
  // 키워드로 연 마을 (`ASKS` 의 `opens`). **점수로 두 번 잠그지 않는다**
  villages: [],
  // ─── 호감도 (STORY.md 「남자 NPC 여섯 › 공통 규칙」) ────────
  // ⚠️ **매력·비주얼이 여기 안 들어간다.** 예뻐질수록 좋아해 주는 구조가 되면
  // 주제와 정면으로 부딪힌다 — 오르는 것은 **공주가 만들어 준 것**뿐이다.
  // ⚠️ **내려가지 않는다.** 코지 게임에서 관리 압박은 독이다.
  // `bond`   — 사람 id → 점수. `gifted` — 사람 id → 이미 준 물약 종류
  // (「처음 주는 종류」를 크게 치려면 무엇을 줬는지 사람마다 따로 기억해야 한다)
  bond: {},
  gifted: {},
  // 일지에 **어느 시각의 밭 기록까지 옮겨 적었나.** `farmSeenAt`(배지용)과 따로 둔다 —
  // 하나로 쓰면 밭 탭을 열어 배지를 지우는 순간 아직 안 적은 침입이 영영 안 적힌다
  diaryFarmAt: 0,
  // 밭 부대 — **자리 번호 = 칸 번호다** (FARM.md 5장). 1번이 1번 칸을 지키고
  // 쳐들어간 1번과 붙는다. **서버가 이 칸을 읽어 판정한다** (`server/battle.js`).
  // 한 번도 안 짰으면 서버가 애착/동행 한 마리를 1번 자리에 세워 준다 —
  // 어제까지 지키던 아이가 오늘 사라지면 그건 기능이 는 것이 아니라 뺏긴 것이다
  farmDef: [null, null, null, null, null],   // 내 밭을 지키는 다섯
  farmAtk: [null, null, null, null, null],   // 남의 밭으로 가는 다섯
  // 마이 룸에 두는 **애착 크리처 한 마리.** 매력에 반영되는 것도 이 한 마리뿐이다.
  // 예전에는 가진 전부가 중복까지 다 더해져 무한 누적이었다 (CREATURE.md 0장)
  petRoom: null,
  // 탐험에 데려갈 크리처. **애착(petRoom)과 따로다** — 방에 둔 아이와 데리고 나갈 아이를
  // 다르게 고를 수 있어야 「무엇을 고르느냐」가 두 번 생긴다
  petField: null,
  // 여태 닿은 최고 매력. **해금 판정은 이 값으로 한다** — 위의 charmPeak() 참고
  charmPeak: 0,
  stats:     { beauty: 0, charm: 0 },
  discovered: [...STARTER_RECIPES],   // 처음부터 알고 있는 하급 물약 2종
  cauldron:  [],          // 현재 마법 솥에 넣은 재료 id (솥의 구멍 수만큼)
  gathered:  0,           // 총 채집 횟수 (통계)
  outfit:    { ...D.DEFAULT_OUTFIT },  // 아바타 착장 (슬롯 → 아이템 id)
  // 옷 색 (**아이템 id** → COLORS 의 id). 비어 있으면 그 옷은 원래 색을 쓴다.
  //
  // **칸(slot)이 아니라 옷 한 벌에 붙는다.** 예전에는 칸에 붙어 있어서,
  // 장갑 하나를 물들이면 가진 장갑이 **전부** 그 색이 됐다 — 염색약 한 개로
  // 그 칸 전체를 칠하는 셈이라, 아이템을 늘려도 색이 개성이 되지 못했다.
  itemColor: {},
  // 마법 염색이 풀리는 시각 (**아이템 id** → epoch ms). 24시간짜리다.
  // **색과 따로 두는 이유**: 영원 염색약은 여기 안 들어오므로, 시각이 없는 것은
  // 곧 '영원한 색' 이거나 '풀린 색' 이다 — 어느 쪽인지는 dyeForever 가 가른다
  dyeEnd: {},
  dye: 0,                 // 마법 염색약 보유 개수 (24시간)
  // 영원 염색약 — **색깔마다 따로 있는 아이템**이다 (색 id → 개수).
  // 마법 염색약이 '아무 색이나 24시간' 이라면, 이쪽은 '이 색으로 영영' 이다.
  // 그래서 개수 하나가 아니라 색깔별 칸을 둔다
  dyeEver: {},
  // 영원 염색약으로 물들인 옷 (**아이템 id** → true). **만료 시각이 없다는 것만으로는
  // 영원한 색인지 알 수 없다** — 예전 세이브에도 시각 없는 색이 남아 있어서,
  // 그건 '풀린 것' 으로 봐야 한다. 그래서 영원한 것은 여기 따로 표시한다
  dyeForever: {},
  // 현자의 결정 보유 개수 (조합 실패로 얻어 AP 충전에 쓴다).
  // **새로 생긴 칸이라 마이그레이션이 필요 없다** — 예전 세이브에는 이 키가 없고,
  // Object.assign(defaultState(), 저장값) 이 기본값 0 을 그대로 남긴다
  crystal: 0,
  // 음식 (음식 id → 개수). 새로 생긴 칸이라 마이그레이션이 필요 없다
  foods: {},
  // 먹이 (먹이 id → 개수). 사람이 먹는 음식과 **다른 칸**이다 (CREATURE.md 7장)
  feeds: {},
  // 크리처별 상태 — { [크리처id]: { loyalty, buffEnd } }
  // 로열티는 영구히 쌓이고, 버프는 시각이라 지나면 저절로 풀린다.
  // **가진 크리처만 담기는 것이 아니다** — 재료로 녹인 뒤에도 남을 수 있으니 읽는 곳에서 거른다
  pets: {},
  // 단련도 — **운동으로 쌓고 방치로 잃는다.** 몸(체중·체지방·근육량·체형)은
  // 비주얼이 아니라 `비주얼 + 단련`(bodyPoint)을 본다.
  //
  // 축을 나눈 이유: 운동이 비주얼을 주면 **물약의 싼 대체재**가 된다. 하급 물약 한 병이
  // 비주얼 1이라, 운동 한 번에 1만 줘도 채집·조합을 통째로 건너뛰는 길이 생긴다.
  // 게다가 비주얼은 매력 총합에 들어가 리그 점수까지 흔든다 — 운동의 보상은 **몸**이다.
  //
  // **음수로 내려간다.** 그래야 방치가 물약으로 쌓은 진행을 실제로 갉아먹는다
  // (bodyPoint 가 0 밑으로는 안 내려가므로 통통이 하한이다).
  // 새로 생긴 칸이라 마이그레이션이 필요 없다 — 옛 세이브에는 없고 기본값 0 이 남는다
  fit: 0,
  // 포만감 (0~100) — **높을수록 배부르다.** 시간이 지나면 준다.
  // 행복이 높으면 천천히, 낮으면 빨리 준다 — STORY.md 의 「정신적 허기는
  // 애정결핍이다」가 수치로 나오는 자리다. 마음이 채워져 있으면 덜 먹어도 된다
  fullness: 100,
  // 스태미나 — 운동에 드는 값. **상한이 몸(근육량·포만감)에 따라 변하므로
  // 저장값은 언제나 상한으로 잘라서 읽는다.** 기본값을 상한보다 크게 두면
  // 새 플레이어가 가득 찬 상태로 시작한다 (defaultState 는 S 가 아직 없어
  // 상한을 계산할 수 없다 — 그래서 여기서 정확한 값을 넣을 방법이 없다)
  stamina: 9999,
  // 포만감·스태미나를 마지막으로 계산한 시각. **값을 계속 더하지 않고 볼 때 계산한다**
  // (AP 의 자정 충전과 같은 생각이지만, 이쪽은 연속이라 시각이 필요하다)
  bodyTs: 0,
  lastWorkoutTs: 0,       // 마지막으로 운동한 시각 (방치 감소의 기준)
  decayTs: 0,             // 방치 감소를 **어디까지 반영했는지**. 두 번 깎지 않기 위한 값
  bingeDay: 0,            // 「혼자 먹은 밤」을 마지막으로 판정한 날짜 키
  // **아직 안 본** 폭식 이벤트. 밤 하나에 칸 하나 — 보면 앞에서부터 지운다.
  // 토스트로 흘려보내지 않는 이유: 그날 밤은 이 게임에서 제일 중요한 장면이라
  // 「나중에 보겠다」가 가능해야 한다 (STORY.md 「혼자 먹은 밤」)
  binges: [],
  // 눌러서 고른 레시피가 요구하는 재료 목록 (표시용).
  // **조합해도 지워지지 않는다** — 재료가 남아 있으면 솥이 저절로 다시 채워지고,
  // 모자란 자리는 회색 재료로 남아 무엇이 없는지 보여 준다.
  // 새로 생긴 칸이라 마이그레이션이 필요 없다 (없으면 기본값 [] 이 남는다)
  want: [],
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
  // **켜 주는 곳은 튜토리얼(tutorial.js)의 졸업 단계 한 곳뿐이다.**
  tutorialDone: false,
  // 튜토리얼 진행 (tutorial.js). 중간에 창을 닫아도 그 자리에서 이어지도록 세이브에 둔다.
  //  step = 몇 번째 단계 / beat = 그 단계의 몇 번째 대사 / did = 한 번만 도는 효과의 표시
  tut: { step: 0, beat: 0, done: false, did: {} },
  // 마이 룸 배경 단계 (1~5). 기본은 2단계다 — 1단계는 거미줄까지 있는 '텅 빈 골방'
  // 이라 첫인상이 너무 휑하다. 기본값은 avatar.js 한 곳(ROOM_DEFAULT)에서만 정한다.
  // 새로 생긴 칸이라 마이그레이션이 필요 없다 — 이 칸이 처음 나가는 판에서 기본값도
  // 같이 나가므로, 옛 기본값(1)을 들고 있는 세이브가 세상에 없다.
  // 아직 올려 주는 게임 조건은 없고 개발용 스위치로만 바뀐다.
  roomLevel: roomDefault(),
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
    palFinds:    0,   // 동행 크리처가 덤으로 찾아 준 횟수
    brews:       0,   // 조합 시도
    brewOk:      0,   // 성공
    brewFail:    0,   // 실패 (찌꺼기)
    discoveries: 0,   // 새로 알아낸 레시피
    drinks:      0,   // 마신 물약
    workouts:    0,   // 운동한 횟수
    meals:       0,   // 먹은 음식
    aloneNights: 0,   // 혼자 먹은 밤 (STORY.md 「혼자 먹은 밤」)
    foodsGot:    0,   // 채집으로 얻은 음식
    feedsGot:    0,   // 채집으로 얻은 먹이 (크리처용)
    fed:         0,   // 크리처에게 먹인 횟수
    exMin:       0,   // 운동한 시간 (분, 누적)
    creatures:   0,   // 만든 크리처 (누적 — 전시 목록과 달리 줄지 않는다)
    produced:    0,   // 크리처가 만들어 준 날 수 (8단계)
    harvested:   0,   // 밭에서 거둔 이삭 개수 (9단계)
    planted:     0,   // 밭에 심은 횟수
    raids:       0,   // 이웃 밭에 나간 횟수
    raidWon:     0,   // 그중 뚫은 횟수
    pots:        ['cd_iron_old'],   // 써 본 마법 솥 (중복 없이)
    playSec:     0,   // 실제로 화면을 보고 있던 시간 (초)
    days:        1,   // 접속한 날 수
    lastDay:     dayKey(),
    firstTs:     Date.now(),
    lastTs:      Date.now(),
  };
}
// 기록 갱신 — 필드가 없던 예전 세이브도 안전하게 다룬다
// ═══════════════════════════════════════════════════════════════
//  탐험 일지
//
//  **그날 있었던 일을 문장으로 남긴다.** 수치(`S.record`)는 「몇 번 했나」를 세지만
//  일지는 「무슨 일이 있었나」를 적는다 — 며칠 만에 들어왔을 때 그사이에
//  누가 다녀갔는지, 무엇을 얻었는지가 한 줄씩 남아 있어야 이야기가 이어진다.
//
//  글은 **귀엽게** 쓴다 (`STORY.md` 의 결). 공주가 제 일기에 적는 말투다 —
//  「아아, 속상하다」 · 「히히」 처럼 혼잣말이 섞인다.
// ═══════════════════════════════════════════════════════════════
const DIARY_MAX = 120;        // 이 줄 수를 넘으면 오래된 것부터 버린다 (세이브 크기)

// 로엔 제국력 — **현실 연도에서 1800 을 뺀다.**
// 2026년 → 226년 · 2027년 → 227년 · 2127년 → 327년.
// `nowDate()` 를 지난다 (시계를 옮겨 놓고 검사할 수 있어야 한다 — `CLAUDE.md`)
const ERA_OFFSET = 1800;
function eraYear(d = nowDate()) { return d.getFullYear() - ERA_OFFSET; }

// 일지 한 줄을 남긴다. `k` 는 문구 열쇠(`di_*`), `v` 는 그 문구에 끼울 값.
//
// ⚠️ **`v` 에는 이름이 아니라 id 를 담는다.** 적을 때 `N()` 으로 풀어서 넣으면
// 그때의 언어가 세이브에 그대로 굳는다 — 영어로 바꾼 뒤에 일지를 열면 예전 줄만
// 한국어로 남는다. 문장은 **읽을 때** 만든다 (`diaryLine`).
//
// `at` 은 그 일이 **실제로 일어난 시각**이다. 남이 내 밭에 다녀간 줄은 서버가 적어
// 둔 시각을 그대로 쓴다 — 「내가 접속한 날」에 몰아 적으면 사흘치가 한 날짜에 쌓인다.
function diaryAdd(k, v, at) {
  if (!Array.isArray(S.diary)) S.diary = [];
  const d = at ? new Date(at) : nowDate();
  S.diary.push({ t: d.getTime(), y: eraYear(d), m: d.getMonth() + 1, d: d.getDate(), k, v: v || {} });
  // **오래된 것부터 버린다.** 세이브가 무한히 커지면 동기화가 느려진다.
  // 시각 순서로 두고 자른다 — 뒤늦게 도착한 옛 줄(밭 기록)이 섞여도 뒤죽박죽이 안 된다
  S.diary.sort((a, b) => a.t - b.t);
  if (S.diary.length > DIARY_MAX) S.diary = S.diary.slice(-DIARY_MAX);
}

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

// 세이브의 모양을 맞춘다. **불러오기와 서버에서 받아오기 둘 다 이걸 쓴다** —
// 예전에는 두 곳에 같은 정리를 따로 적어 두었다가, 한쪽에만 새 칸을 넣어
// 서버에서 받아온 세이브만 고쳐지는 일이 있었다.
function normalizeState(st) {
  st.outfit = Object.assign({ ...D.DEFAULT_OUTFIT }, st.outfit || {});
  if (typeof st.fit !== 'number' || !isFinite(st.fit)) st.fit = 0;
  if (!st.foods || typeof st.foods !== 'object') st.foods = {};
  if (!Array.isArray(st.binges)) st.binges = [];
  const NUM_DEF = { fullness: 100, stamina: 9999, bodyTs: 0, lastWorkoutTs: 0,
                    decayTs: 0, bingeDay: 0 };
  Object.keys(NUM_DEF).forEach(k => {
    if (typeof st[k] !== 'number' || !isFinite(st[k])) st[k] = NUM_DEF[k];
  });
  if (!st.itemColor || typeof st.itemColor !== 'object') st.itemColor = {};
  if (!st.dyeEnd || typeof st.dyeEnd !== 'object') st.dyeEnd = {};
  if (!st.dyeForever || typeof st.dyeForever !== 'object') st.dyeForever = {};
  // 영원 염색약은 처음에 '개수 하나'(숫자)였다가 색깔별 칸으로 바뀌었다.
  // 옛 값은 색을 알 수 없으니 버린다 (개발용으로만 있던 값이다)
  if (!st.dyeEver || typeof st.dyeEver !== 'object') st.dyeEver = {};
  if (!Array.isArray(st.want)) st.want = [];
  // 튜토리얼 진행 — 모양이 깨져 있으면 맞춘다.
  // 값이 통째로 없을 때는 **tutorialDone 을 따라간다** — 졸업한 사람에게 튜토리얼이
  // 처음부터 다시 뜨는 것이 이 값이 틀렸을 때 가장 나쁜 결과다
  if (!st.tut || typeof st.tut !== 'object') {
    st.tut = { step: 0, beat: 0, done: !!st.tutorialDone, did: {} };
  }
  if (!st.tut.did || typeof st.tut.did !== 'object') st.tut.did = {};
  st.roomLevel = Math.min(roomMax(), Math.max(1, Math.round(Number(st.roomLevel) || roomDefault())));
  // 리그 — 사다리 밖의 값이 들어오면 그릴 것이 없어 화면이 비어 버린다
  const lgMax = (D.LEAGUES ? D.LEAGUES.length : 32) - 1;
  st.league = Math.max(0, Math.min(lgMax, Math.round(Number(st.league) || 0)));
  if (!st.week || typeof st.week !== 'object') st.week = { key: '', score: 0 };
  st.week.key = String(st.week.key || '');
  st.week.score = Math.max(0, Math.round(Number(st.week.score) || 0));
  return st;
}

// 방 배경 단계의 최댓값·기본값. 그림이 avatar.js 에 있으니 숫자도 거기서 가져온다
// (index.html 에서 avatar.js 가 game.js 보다 먼저 온다). 못 읽으면 같은 값으로 떨어진다
function roomMax() {
  return (window.Avatar && Avatar.ROOM_MAX) || 5;
}
function roomDefault() {
  return (window.Avatar && Avatar.ROOM_DEFAULT) || 2;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const st = Object.assign(defaultState(), parsed);
      normalizeState(st);
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
  S = normalizeState(Object.assign(defaultState(), state));
  S.record = Object.assign(newRecord(), S.record || {});
  // **받아온 세이브도 마이그레이션을 지난다.** 불러오기와 같은 손질을 하지 않으면
  // 기기를 바꾼 사람만 새 기본값을 못 받는다 — 튜토리얼을 마친 사람에게
  // 튜토리얼이 처음부터 다시 뜨는 식으로 드러난다. 버전은 **받아온 값**에서 읽는다
  migrate(S, (state && state.ver) || 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  if (typeof render === 'function') render();
  if (window.Tut) Tut.refresh();
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
  if (from < 9) {
    // '헤어컬러' 칸이 사라지고, 머리도 다른 칸처럼 **염색해서** 색을 정하게 됐다.
    // 브라운 말고 다른 색을 골라 뒀던 사람의 머리색이 오늘 갑자기 브라운으로
    // 돌아가면 안 된다 — 가장 가까운 팔레트 색으로 옮기고 '영원 염색' 으로 잡아 둔다.
    // (그 색을 쓰고 있었으니 팔레트에서도 가진 것으로 친다)
    const to = OLD_HAIR_COLOR[(st.outfit || {}).hairColor];
    if (to && !(st.outfitColor || {}).hair) {
      // **옛 칸 구조(outfitColor/dyePerm)에 그대로 쓴다.** 바로 아래 v11 이 그것을
      // 아이템별 구조로 옮겨 준다 — 여기서 새 구조에 직접 쓰면 옮기는 규칙이 두 벌이 된다.
      // 기본값에서 빠진 칸이므로 없으면 만들어 준다
      st.outfitColor = st.outfitColor || {};
      st.dyePerm = st.dyePerm || {};
      st.outfitColor.hair = to;
      st.dyePerm.hair = true;
      if (!st.unlocked.includes(to)) st.unlocked.push(to);
    }
  }

  if (from < 10) {
    // 튜토리얼이 생기기 전부터 하던 사람에게 이제 와서 '첫 물약을 만들어 보자' 를
    // 띄우면 안 된다. **이미 마친 것으로 친다** — 그리고 그 김에 tutorialDone 도
    // 켜 준다. 켜 주는 코드가 없던 탓에 3구 무쇠 솥·크리처 탭·옷장 열두 칸이
    // 잠긴 채로 남아 있던 세이브들이 여기서 함께 풀린다.
    st.tut = { step: 0, beat: 0, done: true, did: {} };
    st.tutorialDone = true;
  }

  if (from < 11) {
    // 염색이 **칸(slot)에서 옷(아이템 id)으로** 옮겨 갔다.
    // 예전에는 장갑 하나를 물들이면 가진 장갑이 전부 그 색이 됐다.
    //
    // **지금 입고 있는 옷에 옮겨 붙인다.** 물들일 때 입고 있던 옷이 그것이었을
    // 가능성이 가장 높고, 무엇보다 화면이 그대로 유지된다 — 어제까지 보던 색이
    // 오늘 원래 색으로 돌아가면 그게 더 큰 손실이다.
    // (그 칸에 아무것도 안 입고 있었으면 옮길 곳이 없으니 버린다)
    const oc = st.outfitColor || {}, du = st.dyeUntil || {}, dp = st.dyePerm || {};
    Object.keys(oc).forEach(slot => {
      const id = (st.outfit || {})[slot];
      if (!id || st.itemColor[id]) return;
      st.itemColor[id] = oc[slot];
      if (dp[slot]) st.dyeForever[id] = true;
      else if (du[slot]) st.dyeEnd[id] = du[slot];
    });
    delete st.outfitColor; delete st.dyeUntil; delete st.dyePerm;
  }
  if (from < 12) {
    // ⚠️ **크리처 매력이 무한 누적이던 것을 없앤다.**
    // 예전에는 `S.creatures` 전부(중복까지)의 charmBonus 를 다 더했다.
    // 이제는 **마이 룸에 장착한 한 마리만** 반영된다 (CREATURE.md 0장).
    //
    // 그냥 바꾸면 **매력 총합이 내려간다.** `isMapOpen()` 이 그 값을 보므로
    // **열려 있던 맵과 지대가 다시 잠긴다** — 유니콘 셋을 가진 사람은 −12 다.
    // 그래서 잃는 만큼을 `stats.charm` 으로 **옮겨 적는다.** 지우는 게 아니라 옮기는 것이다.
    const list = Array.isArray(st.creatures) ? st.creatures : [];
    const bonus = (id) => {
      const r = D.RECIPES.find(x => x.result.id === id && x.result.kind === 'creature');
      return r ? (r.result.charmBonus || 0) : 0;
    };
    const all = list.reduce((s, id) => s + bonus(id), 0);
    // 제일 센 것을 자동으로 장착해 준다 — 고르라고 하면 그 전까지 매력이 비어 보인다
    let best = null, bestN = -1;
    list.forEach(id => { const n = bonus(id); if (n > bestN) { bestN = n; best = id; } });
    if (!st.petRoom && best) st.petRoom = best;
    const keep = st.petRoom ? bonus(st.petRoom) : 0;
    if (!st.stats) st.stats = { beauty: 0, charm: 0 };
    st.stats.charm = (st.stats.charm || 0) + Math.max(0, all - keep);
    // 해금 최고 기록도 지금 값으로 채워 둔다 — 0 이면 이미 연 맵이 전부 닫힌다
    st.charmPeak = Math.max(st.charmPeak || 0,
      (st.stats.beauty || 0) + (st.stats.charm || 0) + keep);
  }

  if (from < 13) {
    // ⚠️ **비법서가 「흐린 장」이 됐다** — 재료 두 칸이 가려지고 저어서 밝힌다.
    // 그런데 **이미 하던 사람은 그 장으로 벌써 물약을 만들고 있었다.**
    // 그냥 바꾸면 어제까지 만들던 물약이 오늘 갑자기 수수께끼가 된다 —
    // 새 재미를 주려다 «가지고 있던 것을 뺏는» 꼴이다.
    //
    // 그래서 **이미 가진 장은 전부 밝혀진 것으로 친다.** 수수께끼는 이 뒤에
    // 새로 들어오는 장부터다. (`defaultState` 는 빈 채로 둔다 — 새 플레이어는
    // 첫 장부터 흐린 것이 맞다)
    st.known = st.known || {};
    (Array.isArray(st.discovered) ? st.discovered : []).forEach(id => {
      const r = D.RECIPES.find(x => x.result.id === id);
      if (!r) return;
      const h = D.hiddenOf(r);
      if (h.length) st.known[id] = h.slice();
    });
    // 여태 모아 본 누적은 알 길이 없다 — **지금 가진 것만큼은 모아 본 것이 맞다.**
    // 0 에서 시작하면 이미 재료를 잔뜩 쌓아 둔 사람이 숙련만 0 인 이상한 상태가 된다
    st.gathered = st.gathered || {};
    Object.keys(st.inventory || {}).forEach(id => {
      st.gathered[id] = Math.max(st.gathered[id] || 0, st.inventory[id] || 0);
    });
  }

  st.ver = SAVE_VER;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {}
}

// ─── 유틸 ───
function invCount(id) { return S.inventory[id] || 0; }
// ⚠️ **누적도 여기서 센다.** 재료가 들어오는 길이 채집·답례·생산·수확으로 여럿인데,
// 다 여기를 지난다 — 새 경로를 만들면 「많이 모은 재료」가 길마다 달라진다
function addInv(id, n = 1) {
  S.inventory[id] = invCount(id) + n;
  if (!S.gathered) S.gathered = {};
  S.gathered[id] = (S.gathered[id] || 0) + n;
}
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
// 몸이 보는 값 — **비주얼 + 단련.** 물약이 비주얼을 올리고, 운동이 단련을 올린다.
// 아래 신체 수치는 전부 이 값을 본다 (매력 총합은 여전히 비주얼 + 매력이다).
// 인자를 주면 '그 비주얼이었다면' 을 물어볼 수 있다 — 물약 미리보기가 그렇게 쓴다.
function bodyPoint(beauty) {
  const b = (beauty === undefined ? (S.stats.beauty || 0) : beauty);
  return Math.max(0, b + (S.fit || 0));
}
function bodyLevel(beauty) {
  return 1 - Math.min(1, bodyPoint(beauty) / BODY_MAX_BEAUTY);
}
// 살 빠지는 연출은 여전히 '단계' 로 친다 — 매번 크게 터지면 시끄럽다
function bodyStep(beauty) {
  return Math.min(BODY_STEPS, Math.floor(bodyPoint(beauty) / BODY_PER_STEP));
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
  // 매력이 오르는 자리가 곧 퀘스트가 열리는 자리다 — 판정을 두 곳에 두지 않는다
  refreshQuests();
  renderQuestChip();
  const now = totalCharm();
  if (lastCharmSeen === null) { lastCharmSeen = now; return; }
  if (now <= lastCharmSeen) { lastCharmSeen = now; return; }
  const opened = D.MAPS.filter(m => m.unlock > lastCharmSeen && m.unlock <= now);
  lastCharmSeen = now;
  // **비법서의 새 장도 여기서 온다.** 단계가 오르는 자리가 곧 장이 오는 자리다 —
  // 따로 판정을 두면 「매력이 올랐다」를 두 곳에서 세게 된다.
  // 맵 안내보다 **먼저** 띄운다: 맵이 열려도 만들 것을 모르면 갈 이유가 없다
  const pages = grantPages(true);
  if (pages) {
    setTimeout(() => {
      toast(T('page_got', { n: pages }), null, 3600);
      if (window.Sfx) Sfx.play('success');
    }, 1200);
  }
  if (!opened.length) return;
  const names = opened.map(m => N(m.id, m.name)).join(', ');
  setTimeout(() => {
    toast(T('map_unlocked', { name: names }), null, 3200);
    if (window.Sfx) Sfx.play('success');
  }, 2200);
}

// ─── 크리처 ─────────────────────────────────────────────────
// 크리처 결과물 찾기. **없는 id 를 견뎌야 한다** — 세이브에는 남았는데 데이터에서
// 빠진 크리처가 있을 수 있다 (초기화·데이터 변경). 그 자리에서 null 로 떨어뜨린다
function creatureOf(id) {
  if (!id) return null;
  const r = D.RECIPES.find(x => x.result.id === id && x.result.kind === 'creature');
  return r ? r.result : null;
}
function ownsCreature(id) { return !!id && S.creatures.includes(id); }
// 결과물 한 개의 **그림**. 물약·실패작은 이모지, 크리처는 SVG 다.
// 이 한 곳을 지나게 해서 `result.emoji` 를 여기저기서 읽지 않게 한다 —
// 크리처에서 emoji 를 뺐을 때 조합 팝업·레시피 북·과시 카드가 한꺼번에 깨졌다
function resultArt(r, size) {
  if (!r) return '';
  if (r.kind === 'creature' && window.Creature) return Creature.icon(r, size || 40);
  return r.emoji || '';
}
// ─── 솥에 넣는 것 = 재료 + **녹일 수 있는 크리처** (7단계) ───
//
// 「크리처는 가마솥에서 태어난다. 그러니 가마솥으로 돌아갈 수도 있다」 —
// 상급 크리처의 조합에 **같은 속성의 중급 크리처**가 하나 들어간다.
// 중복으로 나온 개체가 처음으로 쓸모를 갖는 자리다 (`CREATURE.md` 9장).
//
// ⚠️ **조회를 여기 한 곳으로 모은다.** 예전에는 가방·솥 구멍·레시피 줄·`weightedPick`
// 이 저마다 `D.INGREDIENTS[id]` 를 **바로** 읽었다 — 입력에 크리처 id 가 섞이는 순간
// 그 조회가 전부 `undefined` 가 되어 화면이 통째로 깨진다.
function itemOf(id) { return D.INGREDIENTS[id] || creatureOf(id) || null; }
const isMeltItem = id => !D.INGREDIENTS[id] && !!creatureOf(id);
// ⚠️ **한 마리는 남긴다.** 초과분(2번째부터)만 재료가 된다 —
// 그래서 장착 중인 크리처가 사라질 일도, 로열티·버프가 날아갈 일도 없다
// (기획 초안은 「녹이면 로열티도 사라진다」였는데, 마지막 한 마리를 못 녹이게
//  막는 편이 확인 모달로 겁을 주는 것보다 낫다)
function meltCount(id) {
  return Math.max(0, S.creatures.filter(x => x === id).length - 1);
}
// 지금 솥에 넣을 수 있는 개수 — 재료면 가방, 크리처면 **초과분**
function stockOf(id) { return isMeltItem(id) ? meltCount(id) : invCount(id); }
// 소모 — 재료는 가방에서, 크리처는 **뒤에서부터 한 개체**를 뺀다
function spendItem(id, n = 1) {
  if (!isMeltItem(id)) { removeInv(id, n); return; }
  for (let i = 0; i < n; i++) {
    const at = S.creatures.lastIndexOf(id);
    if (at >= 0) S.creatures.splice(at, 1);
  }
}
// 솥·가방·레시피 줄에 쓰는 **그림 한 조각**. 재료는 이모지, 크리처는 SVG 다
function itemArt(id, size) {
  const it = itemOf(id);
  if (!it) return '';
  return isMeltItem(id) ? resultArt(it, size || 30) : it.emoji;
}
const itemName = id => { const it = itemOf(id); return it ? N(id, it.name) : id; };

// 지금 마이 룸에 있는 애착 크리처. **가진 것인지 한 번 거른다**
function roomPet() { return ownsCreature(S.petRoom) ? creatureOf(S.petRoom) : null; }
// 탐험에 데리고 나가는 크리처. 여기도 **가진 것인지 한 번 거른다** —
// 재료로 녹였거나 데이터에서 빠진 id 가 세이브에 남을 수 있다
function fieldPet() { return ownsCreature(S.petField) ? creatureOf(S.petField) : null; }

// ─── 동행 보너스 ─────────────────────────────────────────────
// **덤** — 채집 한 번에 재료가 하나 더 나온다.
//
// 왜 덤인가: 채집은 이미 100% 재료를 준다. 「획득 확률」로 올릴 자리가 없다.
// 히든 재료(0.1%)에 배율만 곱하면 화면에 아무 변화가 없어서 아무도 못 느낀다 —
// 덤은 토스트가 두 줄이 되고 가방 숫자가 눈에 띄게 는다 (CREATURE.md 5장).
//
// ⚠️ **곱셈이 아니라 덧셈으로 쌓는다.** 덤은 자주 일어나는 일이라 곱하면 금세 상한에
// 붙어 버리고, 그러면 조건을 하나 더 맞춘 보람이 사라진다. (히든은 반대로 곱셈이다 —
// 0.1% 대라 열두 배를 해도 1.2% 다. CREATURE.md 5장)
const PAL = {
  base: 0.08,        // 데려가기만 해도
  sameAttr: 0.10,    // 크리처 속성 = 맵 속성
  weather: 0.06,     // 크리처 속성 = 지금 날씨가 편드는 속성
  daypart: 0.06,     // 크리처 속성 = 지금 시간대가 편드는 속성
  buff: 0.10,        // 먹이 버프가 걸려 있는 동안 (6단계)
  max: 0.45,         // 상한. 1.0 에 붙으면 조건을 맞춘 보람이 사라진다
};
// 무엇이 맞았는지를 **하나로 모아** 돌려준다. 확률을 내는 곳과 화면에 적는 곳이
// 갈라지면 「맞았다고 써 있는데 확률은 그대로」가 생긴다 — 같은 함수를 지나게 한다
function palMatch(mapId) {
  const pet = fieldPet();
  if (!pet || !pet.attr) return null;
  const we = weatherOf(mapId);
  const dp = daypartNow();
  return {
    pet,
    attr:    D.mapAttr(mapId) === pet.attr,
    weather: !!we && we.attr === pet.attr,
    daypart: !!dp && dp.attrs.indexOf(pet.attr) >= 0,
    buff:    buffLeft(pet.id) > 0,
    we, dp,
  };
}
function palBonusRate(mapId) {
  const m = palMatch(mapId);
  if (!m) return 0;
  return Math.min(PAL.max, PAL.base
    + (m.attr    ? PAL.sameAttr : 0)
    + (m.weather ? PAL.weather  : 0)
    + (m.daypart ? PAL.daypart  : 0)
    + (m.buff    ? PAL.buff     : 0));
}

// ─── 먹이 · 로열티 · 버프 (CREATURE.md 7장) ──────────────────
//
// 먹이 하나가 **두 가지**를 한다. 하나로 묶으면 안 된다:
//   · 로열티 — 영구히 쌓이고, 덤이 나올 때 **개수**를 늘린다
//   · 버프   — 일시적이고, 덤이 나올 **확률**을 올린다 (PAL.buff)
//
// 로열티를 확률에 얹지 않는 이유: 확률에는 이미 넷이 붙어 있어서 다섯째를 같은 자리에
// 얹으면 무엇이 효과가 있는지 아무도 모른다. 개수는 토스트에 그대로 보인다.
function feedOf(id) { return D.FEEDS.find(f => f.id === id) || null; }
function feedCount(id) { return (S.feeds || {})[id] || 0; }
// 크리처 상태 칸을 **필요할 때 만든다.** 서른 마리 몫을 미리 잡아 두면 세이브만 커진다
function petState(id) {
  if (!S.pets) S.pets = {};
  if (!S.pets[id]) S.pets[id] = { loyalty: 0, buffEnd: 0 };
  return S.pets[id];
}
function loyaltyOf(id) { return (S.pets && S.pets[id] ? S.pets[id].loyalty : 0) || 0; }
// 버프가 몇 밀리초 남았나. **`nowDate()` 를 지난다** — 시계를 옮겨 놓고 검사해야 한다
function buffLeft(id) {
  const p = S.pets && S.pets[id];
  if (!p || !p.buffEnd) return 0;
  return Math.max(0, p.buffEnd - nowDate().getTime());
}
// 덤이 나올 때 **몇 개**인가. 동행의 로열티만 본다
function palBonusCount() {
  const pet = fieldPet();
  return pet ? D.loyaltyBonus(loyaltyOf(pet.id)) : 1;
}

// ─── 채집 결과의 「단서」 (CREATURE.md 6장) ───────────────────
//
// 「🌿 이끼」 한 줄 옆에 **왜 그게 나왔는지**를 붙인다. 조건을 맞춘 보람이 화면에
// 안 보이면 동행 시스템은 숫자놀음으로만 남는다.
//
// **문장을 다 쓸 수는 없다.** 맵 51 × 날씨 6 × 시간 4 × 속성 6 = 7천 가지가 넘고
// 그것도 두 언어다. 그래서 **조각을 조립한다**: {왜} + {결과}.
// 조각이 셋씩·넷씩이라 문장 수가 곱으로 는다.
//
// ⚠️ **맵 조각은 안 만들었다.** 51곳의 산문을 두 언어로 쓰면 백 번 읽는 한 줄치고
// 손이 너무 많이 간다 — 게다가 맵 이름은 방금 누른 카드에 이미 적혀 있다.
// 지금은 날씨·시간대·속성만 말한다.
//
// ⚠️ **매번 띄우지 않는다.** 꾹 누르기 자동 채집이 있어서 매번 두 줄이 되면 잔소리가 된다.
// 덤·히든이 나온 순간에만 반드시 띄우고(그때가 「왜?」가 생기는 순간이다),
// 평범하게 하나 주웠을 때는 **조건이 하나도 안 맞았을 때만 가끔** 권유한다.
const CLUE = { miss: 0.14 };
// 조각 — 실제 문장은 i18n 에 있다. 여기는 **어느 조각을 쓰는지**만 안다
const CLUE_WHY = {
  attr: ['clue_attr_1', 'clue_attr_2', 'clue_attr_3'],
  we:   ['clue_we_1', 'clue_we_2', 'clue_we_3'],
  dp:   ['clue_dp_1', 'clue_dp_2', 'clue_dp_3'],
};
const CLUE_GOT   = ['clue_got_1', 'clue_got_2', 'clue_got_3'];
// 덤이 여럿일 때 쓰는 꼬리. **「하나 더」라고 하면 거짓말이 된다** —
// 로열티를 올려 놨는데 화면은 그대로면 올린 보람이 사라진다
const CLUE_GOTN  = ['clue_gotn_1', 'clue_gotn_2', 'clue_gotn_3'];
const CLUE_RARE  = ['clue_rare_1', 'clue_rare_2', 'clue_rare_3'];
const CLUE_LUCK  = ['clue_luck_1', 'clue_luck_2', 'clue_luck_3'];
const CLUE_MISS  = ['clue_miss_1', 'clue_miss_2', 'clue_miss_3'];
const CLUE_ALONE = ['clue_alone_1', 'clue_alone_2', 'clue_alone_3'];
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 조사는 **조각마다 다른 것이 필요하다**(이/가 · 은/는 · 을/를). 조각 하나하나에서
// 고르게 하면 빠뜨리는 데가 생기므로 **세 벌을 미리 다 만들어 넘긴다** —
// 안 쓰는 것은 그냥 안 쓰인다. 영어 조각은 이것들을 아예 안 본다
function clueVars(pal) {
  const nm = pal ? N(pal.id, pal.name) : '';
  return { pal: nm, josaIga: josa(nm, '이가'), josaEun: josa(nm, '은는'), josaEul: josa(nm, '을를') };
}

// kind: 'pal'(덤) · 'rare'(히든) · 'plain'(평범하게 하나)
// 붙일 말이 없으면 빈 문자열을 돌려준다 — 부르는 쪽이 그때는 예전 토스트를 쓴다
function gatherClue(mapId, kind, n) {
  const pal = fieldPet();
  const at = D.creatureAttr(D.mapAttr(mapId));
  const attrName = at ? N(at.id, at.name) : '';
  // 동행이 아예 없을 때 — **여기가 이 시스템에서 제일 값진 한 줄이다.**
  // 「다음엔 누구를 데려와 봐」가 다음 채집의 이유를 만든다
  if (!pal) {
    if (kind !== 'plain' || Math.random() >= CLUE.miss) return '';
    return T(pickOne(CLUE_ALONE));
  }
  const v = clueVars(pal);
  const m = palMatch(mapId);
  const hit = [];
  if (m.attr)    hit.push(['attr', { attr: attrName }]);
  if (m.weather) hit.push(['we', { we: N(m.we.id, m.we.name) }]);
  if (m.daypart) hit.push(['dp', { dp: N(m.dp.id, m.dp.name) }]);
  if (kind === 'plain') {
    if (hit.length || !attrName || Math.random() >= CLUE.miss) return '';
    return T(pickOne(CLUE_MISS), Object.assign({ attr: attrName }, v));
  }
  const tail = kind === 'rare'
    ? T(pickOne(CLUE_RARE), v)
    : T(pickOne(n > 1 ? CLUE_GOTN : CLUE_GOT), Object.assign({ n }, v));
  // 맞은 것이 여럿이면 그중 하나만 말한다. 셋을 다 늘어놓으면 토스트가 다섯 줄이 된다
  if (!hit.length) return T(pickOne(CLUE_LUCK), v) + ' ' + tail;
  const one = pickOne(hit);
  return T(pickOne(CLUE_WHY[one[0]]), Object.assign({}, v, one[1])) + ' ' + tail;
}

// ─── 히든 재료 ───────────────────────────────────────────────
// 맵마다 기본 확률이 다르고(D.specialTier), 조건이 맞으면 **곱해서** 오른다.
// 동행이 없으면 배율이 없다 — 맵의 기본 확률 그대로다.
const PAL_SP = { attr: 3, weather: 2, daypart: 2 };   // 다 맞으면 12배
function specialMult(mapId) {
  const m = palMatch(mapId);
  if (!m) return 1;
  return (m.attr ? PAL_SP.attr : 1) * (m.weather ? PAL_SP.weather : 1)
       * (m.daypart ? PAL_SP.daypart : 1);
}
function specialRate(map) {
  // **거울 정령의 지식**이 여기에 곱해진다 (STORY.md 「지식」).
  // 확률에 이미 셋(속성·날씨·시간대)이 붙어 있어서 네 번째다 — 그래서 배수로만 둔다
  return D.specialTier(map.unlock).rate * specialMult(map.id) * bondMult('lore');
}

// ─── 날씨 ────────────────────────────────────────────────────
// ⚠️ **`Math.random()` 으로 정하면 안 된다.** `render()` 는 아주 자주 불려서
// 화면을 다시 그릴 때마다 날씨가 바뀐다 — 채집 한 번에 비가 왔다 갔다 한다.
// 리그 NPC 와 같은 방식으로 **시간과 맵 id 에서 결정론적으로** 뽑는다.
//
// `nowDate()` 를 지나야 `tools/checktime.js` 가 시계를 옮겨 놓고 검사할 수 있다.
// 세이브에는 안 남긴다 — 남기면 기기마다 달라지고 동기화 충돌거리가 하나 는다.
function weatherSlot(d = nowDate()) {
  return Math.floor(d.getTime() / (D.WEATHER_HOURS * 3600e3));
}
function weatherOf(mapId, d = nowDate()) {
  if (!mapId) return null;
  return D.WEATHERS[hash32(mapId + ':' + weatherSlot(d)) % D.WEATHERS.length];
}

// ─── 시간대 ──────────────────────────────────────────────────
// 경계는 운동(EX_WHEN)과 어긋나지 않는다 — 운동의 「낮」을 낮·해질녘으로 한 번 더 자른 것뿐이다.
// D.DAYPARTS 는 from 이 오름차순이고, 첫 칸(아침 5시)보다 이른 시각은 전날 밤이다
function daypartNow(d = nowDate()) {
  const h = d.getHours();
  const list = D.DAYPARTS;
  for (let i = list.length - 1; i >= 0; i--) if (h >= list[i].from) return list[i];
  return list[list.length - 1];      // 00~05 시 = 밤
}

// ⚠️ **해금은 「지금 매력」이 아니라 「여태 닿은 최고 매력」으로 판정한다.**
// 애착 크리처를 센 것에서 약한 것으로 바꾸면 총합이 내려간다 — 그게 이 시스템의
// 고르는 맛이다. 그런데 `isMapOpen()` 이 총합을 그대로 보면 **열려 있던 맵이 다시 잠긴다.**
// 한 번 연 것은 무슨 이유로도 닫히면 안 된다.
//
// 최고 기록은 저장해 둔다 — 안 그러면 새로고침할 때마다 지금 값으로 되돌아간다.
function charmPeak() {
  const now = totalCharm();
  if (now > (S.charmPeak || 0)) S.charmPeak = now;
  return S.charmPeak || 0;
}

// **매력에 반영되는 크리처는 장착한 한 마리뿐이다.**
// 예전에는 `S.creatures` 전부를 중복까지 다 더해서, 같은 것을 여러 번 만들기만 해도
// 매력이 끝없이 올랐다. 그것을 없애면서 세이브 12 로 잃는 만큼을 stats.charm 에 옮겼다.
function totalCharm() {
  const pet = roomPet();
  return S.stats.beauty + S.stats.charm + (pet ? (pet.charmBonus || 0) : 0);
}

// 가중 랜덤 추첨
// 음식 가중 추첨 — 많이 채우는 것일수록 드물다
// 먹이 가중 추첨 — 로열티가 큰 것일수록 드물다 (음식과 같은 방식)
function pickFeed() {
  const total = D.FEEDS.reduce((s, f) => s + (f.w || 1), 0);
  let r = Math.random() * total;
  for (const f of D.FEEDS) { r -= (f.w || 1); if (r <= 0) return f; }
  return D.FEEDS[D.FEEDS.length - 1];
}

function pickFood() {
  const total = D.FOODS.reduce((s, f) => s + (f.w || 1), 0);
  let r = Math.random() * total;
  for (const f of D.FOODS) { r -= (f.w || 1); if (r <= 0) return f; }
  return D.FOODS[D.FOODS.length - 1];
}

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
// ─── 지금 시각 ───
// **시간에 기대는 것은 전부 이 한 곳을 지난다.** `new Date()` 를 여기저기서 부르면
// 시계를 옮겨 놓고 검사할 수가 없다 — 「하루 뒤」를 만들 구멍이 없어진다.
// (tools/checktime.js 가 Date.now 하나만 갈아 끼우고 나머지가 다 따라오는 이유다)
function nowDate() { return new Date(Date.now()); }

// 로컬 날짜 키 (YYYYMMDD 정수) — 날짜가 바뀌면(자정) 값이 달라짐
function dayKey(d = nowDate()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
// 다음 로컬 자정까지 남은 ms
function msToNextMidnight() {
  const now = nowDate();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next - now;
}
// ─── AP 상한 ─────────────────────────────────────────────────
//
// **매력 단계가 오르면 상한도 오른다.** 새싹 1000 → 여신 1800 (`capPerTier` 200).
// 뒤로 갈수록 채집이 비싸지므로(`zoneAp`) 상한이 그대로면 후반이 앞보다 좁아진다.
//
// ⚠️ **`charmPeak()`(여태 닿은 최고 매력)으로 판정한다.** 총합을 그대로 보면
// 애착 크리처를 약한 것으로 바꾼 순간 상한이 내려가고, **지금 들고 있던 AP 가
// 갈 곳을 잃는다.** 맵·밭 해금과 같은 규칙이다 — 한 번 오른 것은 안 내려간다.
//
// `S.energyBonusCap` 은 **나중에 붙을 것을 위한 자리**다 (아이템·업적 등).
// 지금은 아무도 안 올린다 — `defaultState()` 에도 없어서 늘 0 이다.
function capTier() {
  const peak = charmPeak();
  let n = 0;
  D.TIERS.forEach(t => { if (peak >= t.min) n++; });
  return Math.max(0, n - 1);            // 새싹(0) ~ 여신(4)
}
function energyCap() {
  return D.ENERGY.cap + capTier() * (D.ENERGY.capPerTier || 0) + (S.energyBonusCap || 0);
}

// ─── 채집에 드는 AP ──────────────────────────────────────────
// **지대마다 다르다.** 앞은 싸고 뒤는 비싸다 (`D.ZONES[].ap`).
// 맵 id 를 넘기면 그 맵의 값을, 아무것도 안 넘기면 기본값을 준다 —
// 화면 어디서도 `D.ENERGY.cost.gather` 를 **직접 읽지 않는다**: 직접 읽으면
// 버튼에 적힌 값과 실제로 깎이는 값이 갈린다 (그게 제일 나쁜 종류의 버그다)
function gatherCost(mapId) {
  const m = mapId && D.MAPS.find(x => x.id === mapId);
  const base = m ? D.zoneAp(m.zone) : D.ENERGY.cost.gather;
  // **왕자의 호위**가 위험 지대의 값을 깎아 준다 (STORY.md 「호위 → 위험 지대 탐험」).
  // ⚠️ 여기 한 곳을 지나므로 **버튼에 적힌 값과 깎이는 값이 갈리지 않는다.**
  // 평야보다 싸지지는 않게 바닥을 둔다 — 후반 지대가 초반보다 싸면 지대 순서가 뒤집힌다
  const floor = D.zoneAp('plain');
  return Math.max(floor, base - bondApCut(m ? m.zone : null));
}
window.gatherCost = gatherCost;

// ═══════════════════════════════════════════════════════════════
//  퀘스트 (QUEST.md · 1단계 「그릇」)
//
//  **숙제가 되면 진다.** 본받는 모델이 듀오링고라 규칙이 넷뿐이다:
//    ① 기한이 없다 — 며칠 뒤에 들어와도 그대로 기다린다
//    ② 실패가 없다 — 진행도는 뒤로 안 간다. 포기 버튼도 없다
//    ③ 한 번에 하나 — 목록이 생기는 순간 그건 할 일 목록이고, 할 일 목록은 숙제다
//    ④ 어디로 가면 되는지까지 말한다
// ═══════════════════════════════════════════════════════════════

// 여는 조건. ⚠️ **`charmPeak()`(여태 닿은 최고 매력)으로 판정한다.**
// 지금 총합을 보면 애착 크리처를 약한 것으로 바꾼 순간 열려 있던 퀘스트가 사라진다 —
// 맵 해금·밭 탭·AP 상한에서 **같은 사고를 세 번** 냈다.
function questReady(q) { return charmPeak() >= (q.at || 0); }

function questState() {
  if (!S.quest || typeof S.quest !== 'object') S.quest = { active: null, n: 0, done: [], queue: [] };
  if (!Array.isArray(S.quest.done)) S.quest.done = [];
  if (!Array.isArray(S.quest.queue)) S.quest.queue = [];
  return S.quest;
}
function activeQuest() { const q = questState(); return q.active ? D.questOf(q.active) : null; }

// 조건이 찬 것을 큐에 담고, 하는 것이 없으면 하나를 꺼내 준다.
// **완료하자마자 다음 것을 바로 내보낸다** — 하루 제한 같은 걸 두지 않는다
// (한 번에 하나라서 잘 하는 사람에게는 이미 느리다 · `QUEST.md` 8-4)
function refreshQuests() {
  const st = questState();
  if (!S.tutorialDone) return;           // 튜토리얼 중에는 안 준다 (막이 겹친다)
  D.QUESTS.forEach(q => {
    if (st.done.includes(q.id) || st.active === q.id || st.queue.includes(q.id)) return;
    if (questReady(q)) st.queue.push(q.id);
  });
  if (!st.active && st.queue.length) { st.active = st.queue.shift(); st.n = 0; }
}
window.refreshQuests = refreshQuests;

// ─── 진행도 ──────────────────────────────────────────────────
//
// 목표는 **이벤트형**과 **상태형** 둘이다.
//
// · 이벤트형(`brew` `creature` `drink` `visit` `farm`) — 그 일이 일어난 자리에서
//   `questBump()` 를 부른다. **받은 뒤부터 세므로** 「이미 마흔 번 조합한 사람에게
//   5번 조합을 주면 즉시 완료」가 아예 생기지 않는다.
//   ⚠️ `S.record` 를 그대로 보면 그 사고가 난다 — 그래서 자기 카운터를 따로 둔다
// · 상태형(`deliver` `charm`) — 볼 때마다 지금 값으로 잰다. 진행도가 뒤로 갈 수
//   있는 것은 `deliver` 뿐인데, 그건 「갖다줘」라서 자연스럽다
function questProgress(q) {
  const st = questState();
  const g = q.goal || {};
  if (g.kind === 'deliver') return Math.min(g.n, invCount(g.id));
  if (g.kind === 'charm')   return Math.min(g.n, charmPeak());
  return Math.min(g.n, st.n || 0);
}
function questFull(q) { return questProgress(q) >= (q.goal ? q.goal.n : 0); }

// 이벤트 하나를 센다. **지금 하는 퀘스트의 목표와 맞을 때만** 오른다
function questBump(kind, id, n) {
  const q = activeQuest();
  if (!q || !q.goal || q.goal.kind !== kind) return;
  if (q.goal.id && q.goal.id !== id) return;      // 특정 물약·크리처를 지목한 퀘스트
  const st = questState();
  st.n = Math.min(q.goal.n, (st.n || 0) + (n === undefined ? 1 : n));
  renderQuestChip();
}
window.questBump = questBump;

// ─── 보상 ────────────────────────────────────────────────────
//
// ⚠️ **컷씬 재생과 보상 지급을 갈라 놓는다.** 한 함수에 두면 스토리 다시보기가
// 보상을 또 준다 (`QUEST.md` 8-5). 여기는 **보상만** 한다.
// 낼 때 — **완료 컷씬이 먼저, 보상이 나중**이다. 보상 토스트가 마지막에 남아야
// 「받았다」로 끝난다. ⚠️ 컷씬이 도는 동안 또 누를 수 있으므로 한 번만 지나가게 막는다
let claiming = false;
function claimQuest() {
  const q = activeQuest();
  if (!q || !questFull(q) || claiming) return;
  const out = q.cut && q.cut.out;
  if (out && !(S.seenCuts || []).includes(out)) {
    claiming = true;
    closeQuest();
    playCut(out, () => { claiming = false; claimQuest(); });
    return;
  }
  const st = questState();
  const r = q.reward || {};
  // 「갖다줘」는 **낼 때 소모한다.** 그래야 갖다준 것이 된다
  if (q.goal.kind === 'deliver') spendItem(q.goal.id, q.goal.n);
  // **비법서 장** — 이제 여기가 장이 나오는 첫 자리다 (단계 지급은 그물이다).
  // 이미 가진 것은 안 센다: 그물이 먼저 준 뒤라면 「받았는데 아무 일도 안 일어난다」가
  // 되는데, `checkdata` 가 퀘스트를 그물보다 먼저 오게 붙들고 있다
  let gotPages = 0;
  (r.pages || []).forEach(spec => {
    D.pagesForSpec(spec).forEach(id => { if (!hasPage(id)) { S.discovered.push(id); gotPages++; } });
  });
  if (r.crystal) S.crystal = (S.crystal || 0) + r.crystal;
  if (r.energy) S.energy = Math.min(energyCap(), (S.energy || 0) + r.energy);
  if (r.items) Object.keys(r.items).forEach(id => addInv(id, r.items[id]));
  st.done.push(q.id);
  st.active = null; st.n = 0;
  rec('quests');
  diaryAdd('di_quest', { id: q.id, who: q.npc });
  refreshQuests();                       // 다음 것을 바로 내보낸다
  save();
  closeQuest();
  // **조사를 붙인다** — 「을(를)」은 이 프로젝트에서 금지다 (일지·밭 기록과 같은 규칙)
  { const nm = T(q.id + '_name'); toast(T('q_done_toast', { name: nm, nj: josa(nm, '을를') }), null, 3200); }
  // 장이 들어왔으면 **따로 한 번 더 알린다** — 결정·재료와 한 줄에 섞으면
  // 「비법서가 늘었다」가 안 읽힌다. 이게 이 퀘스트의 진짜 보상이다
  if (gotPages) setTimeout(() => toast(T('page_got', { n: gotPages }), null, 3600), 1400);
  if (window.Sfx) Sfx.play('success');
  render();
}
window.claimQuest = claimQuest;

// ═══════════════════════════════════════════════════════════════
//  부엌 — 요리사 클레멘 (STORY.md)
//
//  **그는 대가 없이 준다.** AP 도, 재료도, 현자의 결정도 안 든다.
//  폭식해도 그의 호감도는 안 깎이고, 다음 날 아침 아무 말 없이 또 차린다 —
//  「온기만이 등가 교환의 밖에 있다」가 이 인물의 전부다.
//
//  ⚠️ **부엌은 퀘스트와 상관없이 열려 있다.** 「혼자 먹은 밤」은 지금까지
//  **피할 방법이 없는 페널티**였는데(판정 기준이 「혼자 먹었느냐」인데 같이 먹을
//  사람이 없었다), 그 해소를 «선택 콘텐츠»인 퀘스트 뒤에 숨기면 안 된다.
//  튜토리얼을 마치면 바로 열린다.
// ═══════════════════════════════════════════════════════════════
function kitchenOpen() { return !!S.tutorialDone; }
window.kitchenOpen = kitchenOpen;

// 오늘 이미 같이 먹었나
function ateToday() { return (S.kitchenDay || 0) === dayKey(); }

function openKitchen() {
  if (!kitchenOpen()) return;
  // **처음 오면 인사부터.** 퀘스트가 아니라 부엌 자체가 그를 소개한다
  if (!(S.seenCuts || []).includes('c_clemen_meet')) { playCut('c_clemen_meet', openKitchen); return; }
  renderKitchen();
  const m = document.getElementById('kitchenSheet');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closeKitchen() {
  const m = document.getElementById('kitchenSheet');
  if (m) m.classList.remove('show');
  clearAsk();          // 다음에 열면 오늘의 한 마디부터 (방금 들은 말이 남아 있으면 인사가 아니다)
}
window.openKitchen = openKitchen;
window.closeKitchen = closeKitchen;

function renderKitchen() {
  const ti = document.getElementById('kitchenTitle');
  const el = document.getElementById('kitchenBody');
  if (ti) ti.textContent = T('kt_title');
  if (!el) return;
  const done = ateToday();
  // 오늘의 한 마디 — **날짜로 고정한다.** 다시 그릴 때마다 말이 바뀌면
  // 「내가 잘못 읽었나」가 된다 (일지 꼬리말·날씨와 같은 규칙)
  const i = diaryHash('kt|' + dayKey()) % KITCHEN_LINES;
  // 물어본 것이 있으면 **그 대답이 오늘의 한 마디보다 먼저다** (마을 말풍선과 같은 규칙)
  const ask = shownAsk('sp_clemen');
  el.innerHTML = `
    <div class="q-say">
      <span class="q-face" aria-hidden="true">${
        window.Portrait ? Portrait.bust(D.speaker('sp_clemen'),
          ask ? (ask.mood || 'def') : (done ? 'smile' : 'def'), { bare: true }) : ''}</span>
      <span class="q-line">
        <b class="q-who">${speakerName('sp_clemen')}</b>
        <span class="q-text">${ask ? T(ask.line) : T(done ? 'kt_after' : `kt_say_${i + 1}`)}</span>
      </span>
    </div>
    <div class="kt-note">${T('kt_free')}</div>
    <button class="btn ${done ? 'btn-ghost' : 'btn-primary'} kt-eat"
      onclick="eatWithClemen()"${done ? ' disabled' : ''}>
      ${T(done ? 'kt_done' : 'kt_eat')}</button>
    ${askRowHtml('sp_clemen')}`;
}
window.renderKitchen = renderKitchen;
const KITCHEN_LINES = 5;

// 같이 먹는다. **아무것도 안 든다.**
function eatWithClemen() {
  if (!kitchenOpen() || ateToday()) return;
  S.kitchenDay = dayKey();
  // 배가 부르다 — 혼자 먹은 밤의 `fullnessBack` 과 같은 값이다.
  // 「따뜻한 밥」이 야식보다 덜 채우면 그건 벌이지 온기가 아니다
  S.fullness = Math.max(fullness(), BINGE.fullnessBack);
  S.bodyTs = Date.now();
  rec('meals');
  questBump('kitchen');
  diaryAdd('di_meal', { who: 'sp_clemen' });
  save();
  renderKitchen();
  render();
  toast(T('kt_ate'), null, 3000);
  if (window.Sfx) Sfx.play('success');
}
window.eatWithClemen = eatWithClemen;

// ═══════════════════════════════════════════════════════════════
//  키워드 대화 — 한 사람에게 들은 것을 다른 사람에게 가져간다
//  (STORY.md 「키워드 시스템」 · 표는 `data.js` 의 `ASKS`)
// ═══════════════════════════════════════════════════════════════
//
// **그 사람이 반응하는 것 중 «내가 가진 것»만 보여 준다.** 전부 늘어놓으면 나중에
// 백 개가 되고, 반응 없는 걸 골라 헛걸음하는 재미는 코지 게임에 안 맞는다.
//
// ⚠️ **다시 물어도 된다.** 이미 물어본 것은 회색이 될 뿐 사라지지 않는다 —
// 사라지면 「아까 그 사람이 뭐라고 했더라」를 확인할 방법이 없어진다.
// 대신 주는 것(`gives`·`opens`)은 **처음 한 번만** 들어온다.
function hasKw(id) { return !!(S.keywords && S.keywords.includes(id)); }
function askKey(npc, kw) { return npc + '|' + kw; }
function askedAlready(npc, kw) { return !!(S.talked && S.talked.includes(askKey(npc, kw))); }
// 이 사람에게 지금 물어볼 수 있는 것 (= 그가 반응하고 + 내가 가진 것)
function asksAvail(npc) { return D.asksOf(npc).filter(a => hasKw(a.kw)); }
// 호감도가 모자라 아직 못 여는 대답인가.
//
// **호감도가 이야기를 민다** — 물약을 만들어 주고 → 가까워지고 → 그제야 하는 말이 있다.
// ⚠️ **잠긴 것도 «보여 준다».** 아예 감추면 무엇을 하면 되는지 알 수가 없다
// (「길 잃음 방지가 제일 중요하다」 — STORY.md). 대신 무엇이 모자란지 적는다
function askLocked(a) { return bondTier(a.npc) < D.askNeedBond(a); }
// 아직 한 번도 안 물어본 것의 수 — 마을 탭·건물의 점(●)이 이 수를 본다.
// ⚠️ **잠긴 것은 안 센다.** 점을 보고 갔는데 못 여는 것뿐이면 그 점이 거짓말이 된다
function asksNew(npc) {
  return asksAvail(npc).filter(a => !askedAlready(npc, a.kw) && !askLocked(a)).length;
}

// 지금 화면에 떠 있는 대답. **저장하지 않는다** — 진행이 아니라 방금 들은 말이고,
// 화면을 떠났다 오면 인사말부터가 맞다 (대사 `talkIdx` 와 같은 규칙)
let askNpc = null, askKw = null;
function clearAsk() { askNpc = null; askKw = null; }
function shownAsk(npc) {
  if (askNpc !== npc || !askKw) return null;
  return D.ASKS.find(a => a.npc === npc && a.kw === askKw) || null;
}

// 「물어볼 것」 칩 줄. **부엌과 마을이 같은 것을 쓴다** — 두 벌이면 한쪽만 고치게 된다
// (밭 시트와 밭 탭에서 배운 것과 같다).
function askRowHtml(npc) {
  const list = asksAvail(npc);
  if (!list.length) return `<div class="ask-box"><div class="ask-none">${T('ask_none')}</div></div>`;
  const chips = list.map(a => {
    const k = D.keyword(a.kw);
    const lock = askLocked(a);
    const fresh = !lock && !askedAlready(npc, a.kw);
    const tn = lock ? D.BOND_TIERS[D.askNeedBond(a)] : null;
    return `<button class="ask-chip ${fresh ? 'fresh' : ''} ${lock ? 'locked' : ''} ${
      askNpc === npc && askKw === a.kw ? 'on' : ''}"
      data-ask="${a.kw}"${lock ? ` title="${T('ask_locked', { tier: N(tn.id, tn.name) })}"` : ''}
      onclick="doAsk('${npc}','${a.kw}')">${lock ? '🔒 ' : (fresh ? '🆕 ' : '')}${
      N(a.kw, k ? k.name : a.kw)}</button>`;
  }).join('');
  return `<div class="ask-box">
      <div class="ask-title">${T('ask_title')}</div>
      <div class="ask-chips">${chips}</div>
    </div>`;
}

// 물어본다. 대답을 띄우고, 처음이면 주는 것을 넣는다.
function doAsk(npc, kw) {
  const a = D.ASKS.find(x => x.npc === npc && x.kw === kw);
  if (!a || !hasKw(kw)) return;
  // 아직 못 여는 대답 — **무엇을 하면 되는지** 말해 준다 (막기만 하면 버그로 읽힌다)
  if (askLocked(a)) {
    const who = speakerName(npc);
    toast(T('ask_locked_toast', { who, nj: josa(who, '은는') }), `.ask-chip[data-ask="${kw}"]`, 3400, 'above');
    if (window.Sfx) Sfx.play('fail');
    return;
  }
  askNpc = npc; askKw = kw;
  const first = !askedAlready(npc, kw);
  const got = [], opened = [];
  if (first) {
    S.talked.push(askKey(npc, kw));
    (a.gives || []).forEach(id => { if (!hasKw(id)) { S.keywords.push(id); got.push(id); } });
    (a.opens || []).forEach(id => {
      if (!S.villages.includes(id)) { S.villages.push(id); opened.push(id); }
    });
    save();
  }
  // 부엌이냐 마을이냐에 따라 다시 그릴 화면이 다르다
  if (document.getElementById('kitchenSheet').classList.contains('show')) renderKitchen();
  else renderGather();
  if (window.Sfx) Sfx.play('pick');
  // **알림은 대답 «뒤에** 온다.** 대답을 읽기도 전에 토스트가 덮으면
  // 그 사람이 무슨 말을 했는지가 안 남는다
  got.forEach((id, i) => {
    const k = D.keyword(id);
    setTimeout(() => toast(T('ask_new', { name: N(id, k ? k.name : id) }), null, 3000), 900 + i * 700);
  });
  opened.forEach((id, i) => {
    const v = D.VILLAGES.find(x => x.id === id);
    const nm = N(id, v ? v.name : id);
    setTimeout(() => {
      toast(T('ask_opened', { name: nm, nj: josa(nm, '으로') }), null, 3400);
      if (window.Sfx) Sfx.play('success');
    }, 900 + (got.length + i) * 700);
  });
}
window.doAsk = doAsk;

// 이 마을에 **새로 물어볼 것이 있는가.** 「길 잃음 방지가 제일 중요하다」(STORY.md) —
// 무엇을 물을지는 안 알려 주고 **갈 곳만** 알려 준다.
function villageNews(v) {
  if (!isVillageOpen(v)) return false;
  return (v.spots || []).some(s => s.npc && asksNew(s.npc) > 0);
}
// 부엌에 새로 물어볼 것이 있는가 (마이 룸의 🍲 에 점을 찍는다)
function kitchenNews() { return kitchenOpen() && asksNew('sp_clemen') > 0; }
window.kitchenNews = kitchenNews;

// ═══════════════════════════════════════════════════════════════
//  호감도 — 만들어 주면 오르고, 그들이 공급으로 갚는다
//  (STORY.md 「남자 NPC 여섯 › 공통 규칙」 · 표는 `data.js` 의 `BONDS`)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️ **이 파일 어디에서도 호감도에 `totalCharm()` · `S.stats.beauty` 를 넣지 않는다.**
// 예뻐질수록 좋아해 주는 구조는 `intro_6` 의 주제와 정면으로 부딪힌다.
// 오르는 것은 **공주가 만들어 준 물약**뿐이고, `checkbond` 가 그것을 수치로 잰다
// (매력을 999 로 올려 놓고 호감도가 한 톨도 안 움직이는지 본다).
function bondOf(npc) { return (S.bond && S.bond[npc]) || 0; }
function bondTier(npc) { return D.bondTierOf(bondOf(npc)); }
function hasBond(npc) { return !!D.BONDS[npc]; }
function giftedTo(npc) { return (S.gifted && S.gifted[npc]) || []; }

// 이 물약을 주면 몇 점인가. **값이 큰 물약이 아니라 «새로운» 물약이 크게 오른다** —
// 좋은 것만 치면 초반 레시피가 통째로 죽은 콘텐츠가 된다
function giftGain(npc, potionId) {
  const b = D.BONDS[npc];
  if (!b) return 0;
  const r = D.RECIPES.find(x => x.result.id === potionId);
  if (!r || r.result.kind !== 'potion') return 0;
  const g = D.BOND_GAIN;
  return (giftedTo(npc).includes(potionId) ? g.again : g.fresh)
       + (r.result.grade === b.like ? g.like : 0);
}

// 물약을 준다. **물약은 사라진다** — 이것이 유일한 제동이다.
// 하루 몇 번 같은 제한은 안 건다: 「오늘 여섯 명 다 돌아야 한다」가 되면 그게 숙제다
function giveGift(npc, potionId) {
  if (!hasBond(npc) || (S.potions[potionId] || 0) <= 0) return;
  const gain = giftGain(npc, potionId);
  if (!gain) return;
  const before = bondTier(npc);
  S.potions[potionId]--;
  if (S.potions[potionId] === 0) delete S.potions[potionId];
  if (!S.gifted[npc]) S.gifted[npc] = [];
  if (!S.gifted[npc].includes(potionId)) S.gifted[npc].push(potionId);
  S.bond[npc] = bondOf(npc) + gain;
  const after = bondTier(npc);
  const r = D.RECIPES.find(x => x.result.id === potionId);
  save();
  renderGather();
  renderGift();
  const nm = N(potionId, r.result.name);
  toast(T('gift_done', { name: nm, nj: josa(nm, '을를'), who: speakerName(npc), n: gain }), null, 3000);
  if (window.Sfx) Sfx.play('pick');
  // **단계가 올랐으면 답례.** 토스트를 겹치지 않게 뒤에 세운다
  if (after > before) for (let t = before + 1; t <= after; t++) bondReward(npc, t);
}
window.giveGift = giveGift;

// 갚는 쪽 — **그 사람의 자리에서 나는 것**이다. 공급이 곧 그 인물의 설명이 된다
function bondReward(npc, tier) {
  const gift = D.BOND_GIFTS[tier];
  const b = D.BONDS[npc];
  if (!gift || !b) return;
  b.ing.forEach(id => addInv(id, gift.n));
  if (gift.crystal) S.crystal = (S.crystal || 0) + gift.crystal;
  // **난쟁이의 보석** — 단계마다 악세사리 한 벌 (STORY.md 「보석 → 악세사리」).
  // 다섯 중 이것만 상시 효과가 아니다: 그가 주는 것은 보석 «자체»가 아니라
  // 그것으로 만든 물건이라 한 번 받으면 그대로 남는다
  const wear = b.give === 'gem' && D.BOND_GIVES.gem.slots[tier];
  if (wear) unlockNextIn(wear);
  save();
  const what = b.ing.map(id => {
    const it = D.INGREDIENTS[id];
    return `${it ? it.emoji : ''}${N(id, it ? it.name : id)} ×${gift.n}`;
  }).join(' · ');
  const tn = D.BOND_TIERS[tier];
  setTimeout(() => {
    const who = speakerName(npc);
    toast(T('bond_up', { who, nj: josa(who, '과와'), tier: N(tn.id, tn.name) }), null, 3400);
    if (window.Sfx) Sfx.play('success');
  }, 1200);
  setTimeout(() => toast(T('bond_gift', { what, c: gift.crystal }), null, 3600), 2600);
}

// ── 그들이 «주는 것» (STORY.md 「남자 NPC 여섯」의 표) ─────────
//
// ⚠️ **효과는 이미 있는 함수 한 곳을 지난다.** 새 경로를 만들면 화면에 적힌 값과
// 실제로 먹는 값이 갈린다 — 지대별 AP 에서 배운 것과 같은 규칙이다.
// 그 덕에 호위(채집 AP)·단백질(운동의 단련)·노래(아우라)는 **저절로 화면에 보인다.**
function bondGiveTier(kind) {
  const npc = D.bondGiver(kind);
  return npc ? bondTier(npc) : 0;
}
// %로 붙는 것 — 배수로 돌려준다 (1.0 = 없음)
function bondMult(kind) {
  const g = D.BOND_GIVES[kind];
  if (!g || g.kind !== 'pct') return 1;
  return 1 + (g.v[bondGiveTier(kind)] || 0) / 100;
}
// 위험 지대 채집 AP 를 깎아 주는 몫. **그가 데려다주는 지대만이다**
function bondApCut(zoneId) {
  const g = D.BOND_GIVES.guard;
  if (!g || !zoneId || g.zones.indexOf(zoneId) < 0) return 0;
  return g.v[bondGiveTier('guard')] || 0;
}

// 하트 다섯 칸. **채운 칸 수가 곧 단계**라 색이 없어도 읽힌다
// (색만으로 구분하지 않는다 — UI_POLICY.md)
function bondHtml(npc) {
  if (!hasBond(npc)) return '';
  const t = bondTier(npc);
  const tn = D.BOND_TIERS[t];
  const pips = D.BOND_TIERS.map((_, i) =>
    `<span class="bd-pip ${i <= t ? 'on' : ''}" aria-hidden="true">${i <= t ? '♥' : '♡'}</span>`).join('');
  return `<span class="bd-row" title="${N(tn.id, tn.name)}">
      <span class="bd-pips">${pips}</span>
      <span class="bd-name">${N(tn.id, tn.name)}</span>
    </span>`;
}

// 「이 사람이 주는 것」 한 줄. **지금 몫과 다음 단계 몫을 같이 적는다** —
// 지금 것만 적으면 더 친해질 이유가 안 읽히고, 다음 것만 적으면 지금 뭘 받고 있는지 모른다.
//
// ⚠️ 담당이 없는 사람(실반)은 이 줄을 아예 안 낸다. 「없음」이라고 적으면
// 뭔가 빠진 것처럼 보이는데, 그는 원래 재료로 갚는 사람이다.
function giveHtml(npc, tier) {
  const kind = (D.BONDS[npc] || {}).give;
  const g = kind && D.BOND_GIVES[kind];
  if (!g) return '';
  const val = i => {
    if (g.kind === 'pct') return T('give_pct', { n: g.v[i] });
    if (g.kind === 'ap')  return T('give_ap',  { n: g.v[i] });
    return g.slots[i] ? T('give_wear') : '—';
  };
  const now = tier > 0 ? val(tier) : T('give_none');
  const nx = tier < D.BOND_TIERS.length - 1
    ? `<span class="give-next">${T('give_next', { v: val(tier + 1) })}</span>` : '';
  return `<div class="give-row">
      <span class="give-what">${T('give_' + kind)}</span>
      <span class="give-now">${now}</span>${nx}
    </div>`;
}

// ── 선물 시트 ────────────────────────────────────────────────
// 가진 물약을 늘어놓고 **오를 점수를 미리 보여 준다.** 주고 나서야 알면
// 「새 종류가 크다」는 규칙을 아무도 눈치 못 챈다
let giftNpc = null;
function openGift(npc) {
  if (!hasBond(npc)) return;
  giftNpc = npc;
  // ⚠️ **띄우고 나서 그린다.** `renderGift()` 는 시트가 닫혀 있으면 아무것도 안 한다
  // (선물할 때마다 닫힌 시트를 다시 그리지 않으려는 것) — 순서를 바꾸면 «빈 시트»가 뜬다
  const m = document.getElementById('giftSheet');
  if (m) m.classList.add('show');
  renderGift();
  if (window.Sfx) Sfx.play('pick');
}
function closeGift() {
  const m = document.getElementById('giftSheet');
  if (m) m.classList.remove('show');
  giftNpc = null;
}
window.openGift = openGift;
window.closeGift = closeGift;

function renderGift() {
  const m = document.getElementById('giftSheet');
  if (!m || !m.classList.contains('show') || !giftNpc) return;
  const npc = giftNpc;
  const b = D.BONDS[npc];
  const ti = document.getElementById('giftTitle');
  if (ti) ti.textContent = T('gift_title', { who: speakerName(npc) });
  const el = document.getElementById('giftBody');
  if (!el) return;
  const ids = Object.keys(S.potions || {}).filter(id => (S.potions[id] || 0) > 0);
  // 오를 점수가 큰 것부터 — 무엇을 주면 좋은지가 줄 순서로 읽힌다
  ids.sort((a, c) => giftGain(npc, c) - giftGain(npc, a));
  const likeName = T('grade_' + b.like);
  const rows = ids.map(id => {
    const r = D.RECIPES.find(x => x.result.id === id);
    if (!r) return '';
    const gain = giftGain(npc, id);
    const fresh = !giftedTo(npc).includes(id);
    const liked = r.result.grade === b.like;
    return `<button class="gift-row" data-gift="${id}" onclick="giveGift('${npc}','${id}')">
        <span class="gift-em" aria-hidden="true">${r.result.emoji}</span>
        <span class="gift-nm">${N(id, r.result.name)}<span class="gift-have">×${S.potions[id]}</span></span>
        <span class="gift-gain">+${gain}</span>
        <span class="gift-tags">${fresh ? `<span class="gift-tag new">${T('gift_first')}</span>` : ''}${
          liked ? `<span class="gift-tag like">${T('gift_like')}</span>` : ''}</span>
      </button>`;
  }).join('');
  const t = bondTier(npc);
  const next = D.BOND_TIERS[t + 1];
  el.innerHTML = `
    <div class="gift-head">
      ${bondHtml(npc)}
      <span class="gift-need">${next
        ? T('bond_next', { n: next.at - bondOf(npc), tier: N(next.id, next.name) })
        : T('bond_max')}</span>
    </div>
    <div class="gift-like">${T('gift_likes',
        { who: speakerName(npc), nj: josa(speakerName(npc), '은는'), grade: likeName })}</div>
    ${giveHtml(npc, t)}
    ${rows ? `<div class="gift-list">${rows}</div>`
           : `<div class="gift-none">${T('gift_none')}</div>`}`;
}
window.renderGift = renderGift;

// ─── 컷씬 (QUEST.md 2-2) ─────────────────────────────────────
//
// **초상화 + 말풍선.** 아무 데나 눌러 넘긴다.
//
// ⚠️ **재생과 보상 지급을 갈라 놓는다.** `playCut()` 은 «보여 주기»만 하고,
// 보상은 `claimQuest()` 가 한다. 한 함수에 두면 스토리 다시보기가 보상을 또 준다
// (`QUEST.md` 8-5 — 만들기 전에 미리 적어 둔 함정이다).
let cutNow = null, cutAt = 0, cutThen = null;

// `id` 컷씬을 처음부터 재생한다. 끝나면 `then()` 을 부른다.
// **본 것으로 적는다** — 스토리 다시보기 목록이 이 표를 쓴다
function playCut(id, then) {
  const c = D.cutOf(id);
  if (!c || !c.lines.length) { if (then) then(); return; }
  cutNow = c; cutAt = 0; cutThen = then || null;
  if (!Array.isArray(S.seenCuts)) S.seenCuts = [];
  if (!S.seenCuts.includes(id)) { S.seenCuts.push(id); save(); }
  const el = document.getElementById('cutScene');
  if (el) el.hidden = false;
  drawCut();
  if (window.Sfx) Sfx.play('pick');
}
window.playCut = playCut;

function drawCut() {
  if (!cutNow) return;
  const [spId, mood] = cutNow.lines[cutAt];
  const sp = D.speaker(spId);
  const face = document.getElementById('cutFace');
  const who = document.getElementById('cutWho');
  const txt = document.getElementById('cutText');
  const dots = document.getElementById('cutDots');
  if (face) face.innerHTML = sp && window.Portrait ? Portrait.bust(sp, mood || 'def', { bare: true }) : '';
  // **「부르는 말」로 뜬다** — 공주는 플레이어가 지은 이름으로, 요정 대모는
  // 「요정 대모」로 (설정상의 이름 「알테이아」는 본인도 안 쓴다 · STORY.md 「호칭 규칙」)
  if (who) who.textContent = speakerName(spId);
  if (txt) txt.textContent = T(`${cutNow.id}_${cutAt + 1}`);
  if (dots) {
    dots.innerHTML = cutNow.lines
      .map((_, i) => `<i class="${i === cutAt ? 'on' : ''}"></i>`).join('');
  }
}

function cutNext() {
  if (!cutNow) return;
  if (cutAt < cutNow.lines.length - 1) { cutAt++; drawCut(); return; }
  const then = cutThen;
  cutNow = null; cutThen = null;
  const el = document.getElementById('cutScene');
  if (el) el.hidden = true;
  if (then) then();
}
window.cutNext = cutNext;

// ─── 스토리 다시보기 (설정) ──────────────────────────────────
//
// ⚠️ **본 것만 보여 준다.** 안 본 컷씬을 제목까지 늘어놓으면 스포일러다 —
// 못 본 것은 막마다 **개수만** 알려 준다.
// ⚠️ **다시 보기는 보상을 다시 주지 않는다** (`playCut` 은 보여 주기만 한다)
function openStory() {
  renderStory();
  const m = document.getElementById('storySheet');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closeStory() {
  const m = document.getElementById('storySheet');
  if (m) m.classList.remove('show');
}
window.openStory = openStory;
window.closeStory = closeStory;

function renderStory() {
  const ti = document.getElementById('storyTitle');
  const el = document.getElementById('storyBody');
  if (ti) ti.textContent = T('st_title');
  if (!el) return;
  const seen = Array.isArray(S.seenCuts) ? S.seenCuts : [];
  const acts = [...new Set(D.CUTS.map(c => c.act))].sort((a, b) => a - b);
  const html = acts.map(act => {
    const list = D.CUTS.filter(c => c.act === act);
    const got = list.filter(c => seen.includes(c.id));
    // **아직 아무것도 못 본 막은 통째로 안 내놓는다** — 막 제목만으로도 스포일러다
    if (!got.length) return '';
    const rows = got.map(c =>
      `<button class="st-row" onclick="closeStory();playCut('${c.id}')">
        <span class="st-ic" aria-hidden="true">${
          window.Portrait ? Portrait.bust(D.speaker(c.lines[0][0]), 'def', { bare: true }) : ''}</span>
        <span class="st-name">${T(c.id + '_title')}</span>
      </button>`).join('');
    const left = list.length - got.length;
    return `<div class="st-act">
      <div class="st-actname">${T('st_act', { n: act })}</div>
      ${rows}
      ${left ? `<div class="st-left">🔒 ${T('st_left', { n: left })}</div>` : ''}
    </div>`;
  }).join('');
  el.innerHTML = html || `<div class="empty-hint">${T('st_empty')}</div>`;
}
window.renderStory = renderStory;

// ─── 칩 (화면 하단의 NPC 얼굴) ────────────────────────────────
//
// ⚠️ **퀘스트가 없으면 칩도 없앤다.** 회색으로 남겨 두면 「내가 뭘 안 한 건가」가 된다.
// ⚠️ **완료 배지는 낼 것이 있을 때만.** 늘 붉은 점을 달고 있으면 그건 알림이지 초대가 아니다
function renderQuestChip() {
  const el = document.getElementById('questChip');
  if (!el) return;
  const q = activeQuest();
  // **칩이 뜨면 화면 아래를 그만큼 비운다** — 안 비우면 옷장 칸 위에 앉는다
  document.body.classList.toggle('has-quest', !!q);
  if (!q) { el.hidden = true; return; }
  el.hidden = false;
  const now = questProgress(q), max = q.goal.n;
  const full = now >= max;
  const fresh = !(S.quest.n || now) && !full;      // 아직 한 걸음도 안 뗀 것
  // **아직 한 번도 안 열어 본 퀘스트**에 점(●). 인트로 컷씬을 봤는지가 곧 열어 봤는지다 —
  // 새 칸을 만들 것 없이 `seenCuts` 하나로 판정된다.
  // 다 찬 것에는 이미 「!」 뱃지가 붙으므로 **점은 안 찍는다** (둘이 겹치면 뭘 뜻하는지 흐려진다)
  const unseen = !full && !!(q.cut && q.cut.in) && !(S.seenCuts || []).includes(q.cut.in);
  el.classList.toggle('done', full);
  el.classList.toggle('fresh', fresh);
  // 진행도는 **얼굴 둘레의 링**이다 — 숫자를 안 읽어도 얼마나 남았는지 보인다
  const R = 26, C = 2 * Math.PI * R;
  const sp = D.speaker(q.npc);
  el.innerHTML = `
    <svg class="qc-ring" viewBox="0 0 60 60" aria-hidden="true">
      <circle class="qc-track" cx="30" cy="30" r="${R}"/>
      <circle class="qc-fill" cx="30" cy="30" r="${R}"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - now / max)}"/>
    </svg>
    <span class="qc-face">${sp && window.Portrait ? Portrait.bust(sp, 'def', { bare: true }) : '🧚'}</span>
    ${full ? `<span class="qc-badge">!</span>` : ''}
    ${unseen ? '<span class="tab-dot qc-dot" aria-hidden="true"></span>' : ''}`;
  el.setAttribute('aria-label', T(q.id + '_name'));
}
window.renderQuestChip = renderQuestChip;

// ─── 시트 ────────────────────────────────────────────────────
function openQuest() {
  const q = activeQuest();
  if (!q) return;
  // **처음 누르면 인트로 컷씬부터.** 한 번 본 뒤에는 바로 시트가 열린다 —
  // 진행을 확인하려고 누를 때마다 대사가 다시 나오면 그건 방해다
  const inCut = q.cut && q.cut.in;
  if (inCut && !(S.seenCuts || []).includes(inCut)) { playCut(inCut, openQuest); return; }
  renderQuestSheet();
  const m = document.getElementById('questSheet');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closeQuest() {
  const m = document.getElementById('questSheet');
  if (m) m.classList.remove('show');
}
window.openQuest = openQuest;
window.closeQuest = closeQuest;

function renderQuestSheet() {
  const q = activeQuest();
  const body = document.getElementById('questBody');
  const ti = document.getElementById('questTitle');
  if (!q || !body) return;
  if (ti) ti.textContent = T(q.id + '_name');
  const now = questProgress(q), max = q.goal.n;
  const full = now >= max;

  // **어디로 가면 되는지까지 말한다.** 비법서에서 만든 부품을 그대로 쓴다 —
  // 무엇을 해야 할지 알아도 어디로 갈지 모르면 게임이 그 자리에서 멈춘다
  let where = '';
  const targetId = q.goal.id;
  if (targetId && (q.goal.kind === 'deliver')) {
    where = pageRowsFor([targetId]);
  } else if (targetId && (q.goal.kind === 'brew' || q.goal.kind === 'creature')) {
    const r = D.RECIPES.find(x => x.result.id === targetId);
    if (r) where = pageRowsFor(r.inputs);
  }

  body.innerHTML = `
    <div class="q-say">
      <span class="q-face" aria-hidden="true">${
        window.Portrait ? Portrait.bust(D.speaker(q.npc), 'def', { bare: true }) : ''}</span>
      <span class="q-line">
        <b class="q-who">${speakerName(q.npc)}</b>
        <span class="q-text">${T(q.id + '_in')}</span>
      </span>
    </div>
    <div class="q-goal">${T(q.id + '_desc')}</div>
    <div class="q-bar"><span style="width:${Math.round(now / max * 100)}%"></span></div>
    <div class="q-num ${full ? 'ok' : ''}">${now} / ${max}</div>
    ${where ? `<div class="q-where">${where}</div>` : ''}
    <div class="q-reward">${T('q_reward')} ${rewardText(q.reward)}</div>
    <button class="btn ${full ? 'btn-primary' : 'btn-ghost'} q-claim"
      onclick="claimQuest()"${full ? '' : ' disabled'}>
      ${T(full ? 'q_claim' : 'q_not_yet')}</button>`;
}
window.renderQuestSheet = renderQuestSheet;

const rewardText = r => [
  // **장을 맨 앞에.** 결정보다 이쪽이 크다.
  // ⚠️ **아직 «없는» 장만 센다.** 퀘스트를 미루다 그물(단계 지급)이 먼저 주고 나면
  // 실제로 들어오는 것은 0장인데, 「📖 24장」이라고 적혀 있으면 거짓말이 된다
  (() => {
    const n = ((r && r.pages) || []).reduce((k, sp) =>
      k + D.pagesForSpec(sp).filter(id => !hasPage(id)).length, 0);
    return n ? `📖 ${T('q_pages', { n })}` : '';
  })(),
  r && r.crystal ? `✨ ${r.crystal}` : '',
  r && r.energy ? `⚡ ${r.energy}` : '',
  ...(r && r.items ? Object.keys(r.items).map(id => `${itemArt(id, 18)} ${itemName(id)} ×${r.items[id]}`) : []),
].filter(Boolean).join(' · ');

// ═══════════════════════════════════════════════════════════════
//  연금술 비법서
//
//  **레시피는 맞히는 것이 아니라 «장»을 갖는 것이다.**
//
//  예전에는 재료를 아무렇게나 넣어 보다가 맞으면 그 레시피를 알게 됐다.
//  그런데 재료가 111개라 **세 가지 조합만 해도 22만 가지**이고 그중 진짜 레시피는
//  스물넷 — 눈감고 맞을 확률이 0.01% 였다. 한 번 틀릴 때마다 AP 25 와 넣은 재료가
//  통째로 날아가니, 플레이테스트에서 「계속 실패하니까 재미가 없다」로 돌아왔다.
//  **재미가 없던 게 아니라 설계상 맞을 수가 없었다.**
//
//  이제 병목은 **맞히기가 아니라 모으기**다. 장이 있으면 무엇을 얼마나 넣는지
//  다 보이고, 그 재료가 어느 맵에 있는지 · 그 맵이 열렸는지 · 어느 시간대에 어떤
//  크리처와 가야 잘 나오는지까지 비법서가 알려 준다.
//
//  `S.discovered` 를 그대로 **「가진 장」**으로 읽는다. 배열이 안 바뀌므로
//  **마이그레이션이 필요 없고**, 예전에 알아낸 레시피는 그대로 그 사람의 장이 된다.
// ═══════════════════════════════════════════════════════════════
function hasPage(id) { return !!(S.discovered && S.discovered.includes(id)); }
window.hasPage = hasPage;

// 장이 나오는 두 길과 그 표는 **`data.js` 에 있다** (`D.PAGE_TIERS` · `D.pagesForSpec`).
// 검사기(`tools/checkdata.js`)가 게임을 안 띄우고도 「136장이 다 나오는지」와
// 「퀘스트가 그물보다 먼저 오는지」를 재야 해서 데이터 쪽에 두었다.
//
// ⚠️ **여기서 같은 이름으로 다시 선언하지 않는다.** 모듈 시스템이 없어서
// data.js 와 game.js 의 최상위 `const` 는 **같은 전역 하나**다 — 이름이 겹치면
// `Identifier has already been declared` 로 **game.js 가 통째로 안 실행된다.**
// 화면은 그냥 빈 껍데기가 되고, 콘솔을 안 열면 원인을 못 찾는다 (실제로 겪었다).
// `npm test` 의 `checkglobals` 가 이걸 잡는다.
// 여태 닿은 단계까지의 장을 **없는 것만** 채운다 (그물). 몇 장이 들어왔는지 돌려준다.
function pagesForTier(i) {
  return (D.PAGE_TIERS[i] || []).reduce((a, spec) => a.concat(D.pagesForSpec(spec)), []);
}

// 여태 닿은 단계까지의 장을 **없는 것만** 채운다. 몇 장이 들어왔는지 돌려준다.
//
// ⚠️ **튜토리얼 전에는 한 장도 안 준다.** 튜토리얼이 시작 레시피(`vitality`)로
// 조합을 가르치는데, 그 앞에 서른 장이 쏟아지면 가리켜야 할 줄을 못 찾는다.
// ⚠️ **이미 가진 것은 안 건드린다** — 예전에 알아낸 레시피가 그대로 남아야 한다.
function grantPages(silent) {
  if (!S.tutorialDone) return 0;
  if (!Array.isArray(S.discovered)) S.discovered = [];
  const top = capTier();
  let got = 0;
  for (let i = 0; i <= top; i++) {
    pagesForTier(i).forEach(id => { if (!hasPage(id)) { S.discovered.push(id); got++; } });
  }
  if (got) {
    save();
    if (!silent) toast(T('page_got', { n: got }), null, 3600);
    if (window.Sfx) Sfx.play('success');
  }
  return got;
}
window.grantPages = grantPages;

// ═══════════════════════════════════════════════════════════════
//  크리처 생산 (CREATURE.md 8장) — 하루에 한 번, 저절로 쌓인다
// ═══════════════════════════════════════════════════════════════
//
// **장착한 한 마리 + 동행 한 마리만 만든다.** 가진 것이 전부 만들면 0장에서 없앤
// 「무한 누적」이 생산물 쪽으로 되살아난다 — 같은 크리처를 스무 마리 만들어 두는 것이
// 가장 좋은 수가 되고, 그러면 고르는 재미가 사라진다.
// (둘이 같은 마리여도 된다 — 그때는 한 몫만 만든다)
//
// ⚠️ **방치 상한을 둔다.** 한 달 만에 들어온 사람에게 30일치를 쏟으면
// 「돌아왔더니 다 있네」가 되어 매일 들어올 이유가 없어진다.
// **상한과 기록 길이를 같은 값으로 둔다** — 그래야 「5일치까지만 쌓인다」가
// 설명 없이 읽힌다 (기록이 5줄인데 상한이 30이면 아무도 눈치 못 챈다).
const PRODUCE_DAYS = 5;
// 지금 만드는 크리처들 — **가진 것인지 한 번 거른다** (재료로 녹였을 수 있다)
function producers() {
  return [...new Set([S.petRoom, S.petField])]
    .filter(id => ownsCreature(id))
    .map(creatureOf)
    .filter(c => c && c.makes && D.INGREDIENTS[c.makes.id]);
}
// 하루치 — { 재료id: 개수 }
function produceOnce() {
  const items = {};
  producers().forEach(c => { items[c.makes.id] = (items[c.makes.id] || 0) + c.makes.n; });
  return items;
}
// 날짜가 넘어간 만큼 정산한다. 새로 들어온 날 수를 돌려준다.
// **AP 자정 충전과 같은 자리에서** 부른다 — 날짜 판정이 두 벌이 되면 반드시 어긋난다
function settleProduce() {
  const today = dayKey();
  // 처음 들어온 사람은 기준이 없다. 지금부터 센다 (며칠치를 한 번에 주지 않는다)
  if (!S.producedDay) { S.producedDay = today; return 0; }
  if (S.producedDay === today) return 0;
  const days = Math.min(PRODUCE_DAYS, Math.max(1, daysBetween(S.producedDay, today)));
  S.producedDay = today;
  const items = produceOnce();
  if (!Object.keys(items).length) return 0;      // 아무도 안 데리고 있으면 안 쌓인다
  for (let i = days - 1; i >= 0; i--) {
    Object.keys(items).forEach(id => addInv(id, items[id]));
    // 날짜는 **거슬러 올라가며** 적는다 — 「어제 · 그제」가 기록에 남아야 한다.
    // ⚠️ ms 를 빼지 않고 **날짜를 뺀다** — 서머타임이 있는 지역에서 하루가 23시간인
    // 날이 있고, 그때 ms 뺄셈은 같은 날짜를 두 번 적는다
    const d = nowDate(); d.setDate(d.getDate() - i);
    S.produced.push({ day: dayKey(d), items, seen: false });
  }
  if (S.produced.length > PRODUCE_DAYS) S.produced = S.produced.slice(-PRODUCE_DAYS);
  rec('produced', days);
  return days;
}
const produceUnseen = () => (S.produced || []).filter(p => !p.seen).length;

// 날짜가 넘어갔으면 충전. 충전이 일어났으면 true 반환.
function refreshEnergy() {
  const today = dayKey();
  if (S.energyDay === today) return false;
  // 날짜가 넘어갔으니 방치 감소·밤 판정도 여기서 한 번 본다 (창을 며칠 열어 둔 경우)
  decayIdle();
  settleProduce();                       // 크리처 생산도 같은 자리에서 (8단계)
  if (checkBinge()) renderActBadges();   // 뱃지만 켠다 (토스트로 안 알린다)
  // (여러 날 지났어도) **상한까지** 충전한다.
  // ⚠️ 예전에는 `energy + dailyFill`(고정 1000)을 상한으로 잘랐다. 상한이 매력
  // 단계로 늘어나게 되면서 그 식은 **늘어난 몫을 영영 안 채운다** — 여신(1800)이
  // 되어도 0 에서 시작하면 1000 까지만 찼을 것이다. 상한이 곧 하루 충전량이다
  S.energy = energyCap();
  S.energyDay = today;
  save();
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  포만감 · 스태미나 — 시간이 채우고, 운동이 쓴다 (EXERCISE.md)
// ═══════════════════════════════════════════════════════════════
//
// **값을 계속 더하지 않는다.** 마지막으로 계산한 시각(bodyTs)만 두고, 볼 때
// 그동안 흐른 시간만큼 한 번에 옮긴다 — 창을 닫아 둔 사이에도 시간은 흐른다.
const FULLNESS = {
  max: 100,
  happyMax: 5.0,      // 행복 0   → 시간당 이만큼 준다 (하루 -120)
  happyMin: 2.0,      // 행복 1000 → 시간당 이만큼    (하루 -48)
};
const STAMINA = {
  base: 20,           // 아무것도 없어도 이만큼
  perMuscle: 1.0,     // 근육량 1kg 당
  perFull: 0.25,      // 포만감 1 당
  perHour: 6,         // 시간당 회복 — 상한 60 기준 10시간에 가득
};
// 한 번에 반영하는 시간의 상한. 오래 쉬었다 온 사람에게 몇 달치를 한꺼번에
// 계산해 봤자 어차피 바닥/가득이고, 큰 수가 오가면 오차만 커진다
const BODY_TICK_MAX_H = 24 * 7;

// 포만감이 시간당 얼마나 주는가 — 행복이 높으면 천천히, 낮으면 빨리
function fullnessDropPerHour() {
  return lerp(FULLNESS.happyMax, FULLNESS.happyMin, auraVal('happy') / AURA_MAX);
}
function fullness() { return Math.max(0, Math.min(FULLNESS.max, S.fullness || 0)); }

// 스태미나 상한 = 밑값 + 근육량 + 포만감.
// **근육량이 근성을 보므로 운동할수록 상한도 는다** — 이 되먹임이 너무 세면
// 후반에 무한 운동이 된다. perMuscle 을 올리기 전에 근성 1000 에서의 값을 먼저 잴 것
function staminaMax() {
  return Math.round(STAMINA.base + muscleKg() * STAMINA.perMuscle
    + fullness() * STAMINA.perFull);
}
// **저장값은 언제나 상한으로 잘라서 읽는다** — 상한이 몸에 따라 변하기 때문이다
function stamina() { return Math.max(0, Math.min(staminaMax(), S.stamina || 0)); }

// 흐른 시간만큼 포만감·스태미나를 옮긴다. 하나라도 움직였으면 true
function tickBody() {
  const now = Date.now();
  if (!S.bodyTs) { S.bodyTs = now; return false; }
  const h = Math.min(BODY_TICK_MAX_H, (now - S.bodyTs) / 3600000);
  if (h <= 0) return false;
  S.bodyTs = now;

  const f0 = fullness(), st0 = stamina();
  const drop = fullnessDropPerHour();
  S.fullness = Math.max(0, f0 - drop * h);
  // **굶으면 스태미나가 안 찬다.** 포만감이 도중에 바닥나면 그 전까지만 회복한다 —
  // 이 한 줄을 빼면 굶은 채로 오래 두는 것이 오히려 이득이 된다
  const fedH = drop > 0 ? Math.min(h, f0 / drop) : h;
  S.stamina = Math.min(staminaMax(), st0 + STAMINA.perHour * fedH);
  return Math.abs(fullness() - f0) > 0.01 || Math.abs(stamina() - st0) > 0.01;
}

// ─── 방치하면 되돌아간다 ────────────────────────────────────
//
// **이 게임에서 처음으로 수치가 내려가는 곳이다.** 조심해서 다룰 것 —
// 오래 쉬었다 돌아온 사람이 「내 캐릭터가 망가졌다」고 느끼면 그대로 떠난다.
// 그래서 셋을 둔다: 하루는 봐 주고(graceDays), 한 번에 최대 7일치까지만 깎고,
// 깎였으면 **말해 준다** (조용히 줄어 있는 것이 제일 나쁘다).
const DECAY = {
  gritPerDay: 8,      // 근성
  fitPerDay: 0.6,     // 단련
  graceDays: 1,       // 이만큼은 봐 준다
  maxDays: 7,         // 한 번에 반영하는 상한
};
const DAY_MS = 86400000;

// 깎였으면 { grit, fit, days } 를, 아니면 null 을 돌려준다
function decayIdle() {
  const now = Date.now();
  // 아직 한 번도 운동한 적이 없으면 기준이 없다 — 지금부터 센다
  if (!S.lastWorkoutTs) { S.lastWorkoutTs = now; S.decayTs = now; return null; }
  // **이미 반영한 데까지는 다시 안 깎는다** (decayTs). 이게 없으면 부를 때마다 깎인다
  const from = Math.max(S.lastWorkoutTs + DECAY.graceDays * DAY_MS, S.decayTs || 0);
  S.decayTs = now;
  const days = Math.min(DECAY.maxDays, (now - from) / DAY_MS);
  if (days <= 0) return null;

  const g0 = auraVal('grit'), f0 = S.fit || 0;
  addAura('grit', -Math.round(DECAY.gritPerDay * days));
  S.fit = +(f0 - DECAY.fitPerDay * days).toFixed(3);
  const dg = g0 - auraVal('grit'), df = +(f0 - S.fit).toFixed(2);
  if (dg <= 0 && df <= 0) return null;
  return { grit: dg, fit: df, days: Math.floor(days) };
}

// ═══════════════════════════════════════════════════════════════
//  혼자 먹은 밤 (STORY.md 「폭식 시스템의 판정 기준」)
// ═══════════════════════════════════════════════════════════════
//
// **판정 기준은 무엇을 먹었느냐가 아니라 「혼자 먹었느냐」다.**
// 밤에 몰래 혼자 먹는 것과 누가 차려 준 것을 먹는 것은 같은 '먹는 행위' 인데,
// 하나는 **연결의 대체물**이고 하나는 **연결 그 자체**다.
//
// ⚠️ **덜 먹는 게임이 아니라 혼자 먹지 않는 게임이다.** 그래서 벌이 「많이 먹어서」로
// 읽히면 안 된다 — 깎이는 것의 중심은 체지방이 아니라 **행복**이고, 행복이 깎이면
// 포만감이 더 빨리 줄어 또 혼자 먹게 된다. 그 나선이 이 시스템의 전부다.
// (STORY.md — 정신적 허기는 애정결핍이지 마법 탓이 아니다)
//
// 지금은 **늘 혼자다.** 요리사 클레멘이 들어오면 여기에 「부엌에 갔었나」 갈래가
// 붙고, 갔던 밤은 폭식이 아니라 **함께한 식사**가 된다 (포만감은 차고, 깎이는 것은 없다).
// 그가 깎지 않는 것이 그의 이름이다 — clementia, 벌할 수 있는데 벌하지 않는 것.
const BINGE = {
  atFullness: 15,     // 날이 바뀔 때 포만감이 이보다 낮으면 혼자 먹는다
  fullnessBack: 70,   // 먹고 나면 이만큼까지 찬다 — **배는 부르다**
  happy: -20,         // 행복. **이게 고리의 핵심이다** (낮으면 더 빨리 배고파진다)
  fit: -0.8,          // 단련 — 체지방·체중이 는다
  grit: -8,           // 근성 — 혼자 쌓은 것은 혼자 무너진다 (STORY.md 「양날」)
  maxNights: 3,       // 오래 비웠어도 한 번에 이만큼까지만
  keep: 5,            // 안 본 장면을 이만큼까지만 들고 있는다
};

// 혼자 먹은 밤이 있었으면 { nights, happy, fit, grit } 를, 아니면 null
// **tickBody() 다음에 부른다** — 비운 사이에 줄어든 포만감을 보고 판정해야 한다
function checkBinge() {
  const today = dayKey();
  // 처음 들어온 사람은 기준이 없다. 지금부터 센다
  if (!S.bingeDay) { S.bingeDay = today; return null; }
  if (S.bingeDay === today) return null;

  // 며칠이 지났는지 — 날짜 키는 정수라 뺄셈이 안 되므로 **마지막 계산 시각**으로 센다.
  // (bodyTs 는 tickBody 가 방금 지금으로 맞춰 놓았으므로 lastWorkoutTs 를 쓰지 않는다)
  let nights = Math.min(BINGE.maxNights, Math.max(1, daysBetween(S.bingeDay, today)));
  // ⚠️ **부엌에 간 밤은 혼자가 아니다** (`STORY.md` 요리사 클레멘).
  // 판정 기준은 처음부터 「혼자 먹었느냐」였는데 같이 먹을 사람이 없어서
  // 늘 참이었다 — 피할 방법이 없는 페널티였다. 이제 갈래가 하나 생긴다.
  // 정산하는 구간(`S.bingeDay` ~ 어제) 안에 부엌에 간 날이 있으면 **그 밤 하나를 뺀다**
  const warm = (S.kitchenDay || 0) >= S.bingeDay && (S.kitchenDay || 0) < today ? 1 : 0;
  nights = Math.max(0, nights - warm);
  S.bingeDay = today;
  if (warm) { rec('warmNights'); diaryAdd('di_meal_night', { who: 'sp_clemen' }); }
  if (!nights) return null;                    // 밤이 하나뿐이었고 그 밤은 함께였다
  if (fullness() > BINGE.atFullness) return null;

  // **밤마다 한 칸씩 쌓는다.** 여러 밤을 하나로 뭉치면 「그날 밤」이 사라진다
  for (let i = 0; i < nights; i++) {
    const h0 = auraVal('happy'), g0 = auraVal('grit'), f0 = S.fit || 0;
    addAura('happy', BINGE.happy);
    addAura('grit', BINGE.grit);
    S.fit = +(f0 + BINGE.fit).toFixed(3);
    S.binges.push({ food: pickBingeFood().id,
      happy: h0 - auraVal('happy'), grit: g0 - auraVal('grit'), fit: +(f0 - S.fit).toFixed(2) });
  }
  // 오래된 것부터 버린다 — 몇 달 만에 돌아온 사람에게 스무 장면을 보게 할 수는 없다
  if (S.binges.length > BINGE.keep) S.binges = S.binges.slice(-BINGE.keep);
  // 배는 부르다 — 여러 밤이어도 마지막 밤의 배부름만 남는다
  S.fullness = Math.max(fullness(), BINGE.fullnessBack);
  rec('aloneNights', nights);
  // 일지 — **먹은 것 이름을 그대로 적는다.** 「폭식 1회」보다 「구운 고기를 폭식했다」가
  // 나중에 읽을 때 그날이 떠오른다
  {
    const last = S.binges[S.binges.length - 1];
    diaryAdd('di_binge', { food: (last && last.food) || '', n: nights });
  }
  return { nights };
}

// 그날 밤 먹은 것. **많이 채우는 것일수록 잘 나온다** — 혼자 먹는 밤엔 큰 걸 먹는다.
// ⚠️ 무엇을 먹었느냐는 **수치에 영향을 주지 않는다.** 판정 기준은 「혼자 먹었느냐」다
// (STORY.md). 음식 이름은 그 밤을 부르는 말일 뿐이다.
function pickBingeFood() {
  const total = D.FOODS.reduce((n, f) => n + f.full, 0);
  let r = Math.random() * total;
  for (const f of D.FOODS) { r -= f.full; if (r <= 0) return f; }
  return D.FOODS[D.FOODS.length - 1];
}

// 날짜 키(YYYYMMDD 정수) 두 개 사이의 날 수. 정수 뺄셈이 안 되므로 날짜로 되돌린다
function daysBetween(fromKey, toKey) {
  const toDate = k => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  return Math.round((toDate(toKey) - toDate(fromKey)) / DAY_MS);
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
// 헤더의 + 버튼. 확인 패널에서 **슬라이더로 채울 만큼을 고르고**, 게이지와
// 지불 값이 같이 따라간다. 상한은 '모자란 만큼' 이다 — 가득 넘게 살 수는 없다.
//
// 원하는 만큼만 충전한다 — 슬라이더로 고른 값. 패널을 열 때 '모자란 만큼' 으로 맞춰 둔다.
let chargeAmt = 0;

// n AP 를 채우는 데 드는 결정 수.
// D.ENERGY.chargeCost 는 '가득(cap) 채울 때 드는 값' 이고, 여기서 비례로 나눈다.
// 지금은 1000 / 1000 이라 AP 하나에 결정 하나다.
// 나누는 값이 energyCap() 이 아니라 D.ENERGY.cap 인 이유: 상한이 늘어난 플레이어의
// AP 값이 싸지면 안 된다 — **AP 하나의 값은 누구에게나 같아야 한다.**
function costFor(n) {
  return Math.ceil(Math.max(0, n) * D.ENERGY.chargeCost / D.ENERGY.cap);
}

function askCharge() {
  const cap = energyCap();
  refreshEnergy();
  const cur = Math.max(0, Math.min(cap, S.energy || 0));
  if (cur >= cap) { toast(T('ap_full')); return; }
  const need = cap - cur;
  chargeAmt = need;                       // 기본은 가득 채우는 값

  // 결정 아이콘은 **누를 수 있다** — 무엇인지·어디서 얻는지 토스트로 알려 준다
  const gem = `<button class="cf-gem" onclick="crystalHelp(this,'panel')"
    aria-label="${T('crystal_name')}">${D.CRYSTAL.emoji}</button>`;
  // 게이지 — 지금 AP(노랑)와 **이번에 채울 만큼**(연분홍)을 이어 붙여 보여 준다.
  // 숫자만 있으면 320 이 많은 건지 적은 건지 감이 안 온다.
  const html = `
    <div class="ap-chg">
      <div class="ap-chg-track">
        <span class="ap-chg-now" style="width:${(cur / cap * 100).toFixed(1)}%"></span>
        <span id="chgAdd" class="ap-chg-add" style="left:${(cur / cap * 100).toFixed(1)}%;width:${(need / cap * 100).toFixed(1)}%"></span>
        <span id="chgText" class="ap-chg-text">${cur + need} / ${cap}</span>
      </div>
      <input id="chgRange" class="ap-chg-range" type="range" min="1" max="${need}" value="${need}" step="1"
        aria-label="${T('ap_charge_amt')}" oninput="chargeSlide(this.value)" onchange="chargeSlide(this.value)">
      <div class="cf-row">
        <span class="cf-label">${T('ap_charge_amt')}</span>
        <span class="cf-ap">⚡</span>
        <span id="chgAmt" class="cf-n">${T('n_ap', { n: need.toLocaleString() })}</span>
      </div>
      <div class="cf-row">
        <span class="cf-label">${T('ap_charge_have')}</span>${gem}
        <span id="chgHave" class="cf-n">${T('n_ea', { n: (S.crystal || 0).toLocaleString() })}</span>
      </div>
      <div class="cf-row">
        <span class="cf-label">${T('ap_charge_pay')}</span>${gem}
        <span id="chgPay" class="cf-n">${T('n_ea', { n: costFor(need).toLocaleString() })}</span>
      </div>
    </div>`;
  showConfirm(T('ap_charge_ask'), () => doCharge(), html);
  chargeSlide(need);      // 모자람 표시(빨간 글씨)를 처음부터 맞춰 둔다
}
window.askCharge = askCharge;

// 슬라이더를 움직일 때 — 게이지·충전량·지불이 같이 따라간다
function chargeSlide(v) {
  const cap = energyCap();
  const cur = Math.max(0, Math.min(cap, S.energy || 0));
  const n = Math.max(1, Math.min(cap - cur, Math.round(Number(v) || 0)));
  chargeAmt = n;
  const cost = costFor(n), have = S.crystal || 0;
  const add = document.getElementById('chgAdd');
  if (add) add.style.width = (n / cap * 100).toFixed(1) + '%';
  const txt = document.getElementById('chgText');
  if (txt) txt.textContent = `${cur + n} / ${cap}`;
  const amt = document.getElementById('chgAmt');
  if (amt) amt.textContent = T('n_ap', { n: n.toLocaleString() });
  const pay = document.getElementById('chgPay');
  if (pay) {
    pay.textContent = T('n_ea', { n: cost.toLocaleString() });
    // 모자라면 지불 쪽을 붉게 — 보유가 아니라 **낼 값**에 표시한다.
    // 슬라이더를 내리면 낼 수 있게 되는 값이므로, 움직일 대상 옆에 있어야 읽힌다
    pay.classList.toggle('lack', have < cost);
  }
}
window.chargeSlide = chargeSlide;

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
  // 패널을 띄운 뒤에도 AP 는 줄어들 수 있다(채집·조합) — 채울 양과 낼 값은
  // **누른 시점에** 다시 센다. 고른 양이 남은 자리보다 크면 남은 자리까지만 채운다
  const cap = energyCap();
  const cur = Math.max(0, Math.min(cap, S.energy || 0));
  const n = Math.max(0, Math.min(cap - cur, chargeAmt || 0));
  if (n <= 0) { toast(T('ap_full')); return; }
  const cost = costFor(n);
  if ((S.crystal || 0) < cost) {
    // 모자라면 다이아 구매로 이어진다 (아직 상점이 없다 → openDiamondShop 참고)
    toast(T('crystal_short'));
    setTimeout(openDiamondShop, 900);
    return;
  }
  S.crystal -= cost;
  S.energy = cur + n;
  // 가득 채웠을 때만 '오늘 채웠다' 로 본다 — 조금만 채우고 날짜를 밀면
  // 자정 충전(dailyFill)을 통째로 잃는다
  if (S.energy >= cap) S.energyDay = dayKey();
  save(); render();
  toast(T(S.energy >= cap ? 'ap_charged' : 'ap_charged_n', { n: n.toLocaleString() }));
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
  const now = nowDate();
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
  // 포만감·스태미나도 여기서 흐른다. **1초마다 저장하지는 않는다** —
  // 화면만 갱신하고, 저장은 다른 행동이 일어날 때 같이 실린다
  const moved = tickBody();
  if (refreshEnergy()) render();   // 충전되면 화면 전체 갱신(비활성 상태 등)
  else {
    renderEnergy();
    if (moved && currentTab === 'showcase') renderBodyState();
  }
}

// ═══════════════════════════════════════════════════════════════
//  탭 전환
// ═══════════════════════════════════════════════════════════════
let currentTab = 'showcase';
function switchTab(tab) {
  // 랭킹은 '여신' 단계부터다. 잠긴 채로 들어오면(옛 세이브의 마지막 탭 등)
  // 빈 화면이 뜨므로 홈으로 돌린다
  if (tab === 'league' && !leagueOpen()) tab = 'showcase';
  currentTab = tab;
  window.currentTab = tab;   // 인트로에서 '이전 화면' 복귀에 사용
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.screen').forEach(s =>
    s.classList.toggle('active', s.id === 'screen-' + tab));
  render();
  // 튜토리얼 신호는 **화면을 다 그린 뒤에** 보낸다 — 튜토리얼이 다음 단계의
  // 구멍을 뚫으려면 그 버튼이 이미 문서에 있어야 한다
  if (window.Tut) Tut.fire('tab:' + tab);
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
  // **맵마다 값이 다르다** (`zoneAp`). 카드에 적힌 값과 같은 함수를 지난다
  if (!spendEnergy(gatherCost(mapId))) {
    toast(T('no_energy'));
    return false;
  }
  // 특별한 맵 — 바로 줍지 않고 미니게임으로 들어간다. 보상은 끝난 뒤 받는다.
  if (map.mini === 'pumpkin' && window.Pumpkin) {
    startPumpkinRun(map);
    return false;
  }
  // 그 맵에서만 나오는 '특별한 재료'. **맵마다 기본 확률이 다르고**(초반 0.5% ~ 후반 0.05%),
  // 동행의 속성·날씨·시간대가 맞으면 최대 12배까지 곱해진다 (CREATURE.md 5장)
  const isSpecial = Math.random() < specialRate(map);
  const id = isSpecial ? map.special : weightedPick(map.pool);
  addInv(id, 1);
  S.gathered++;
  rec('gathered'); rec('itemsGot');
  // 퀘스트 — **한 번 채집한 것을 한 걸음으로 센다** (재료 개수가 아니라).
  // 동행이 덤을 주면 두 걸음이 되어 「여덟 번」이 네 번이 될 수 있다
  questBump('visit', mapId);
  if (isSpecial) rec('specials');
  // 동행 크리처가 하나 더 찾아 준다. **히든 재료를 또 뽑지는 않는다** —
  // 덤으로 히든이 두 배 나오면 그쪽이 본 효과가 되어 버린다 (CREATURE.md 5장)
  const pal = fieldPet();
  // **로열티가 개수를 정한다** (1~3개). 확률은 위의 네 항이 정한다 — 축이 둘로 갈려 있다
  const bonusN = (pal && Math.random() < palBonusRate(mapId)) ? palBonusCount() : 0;
  const bonusId = bonusN ? weightedPick(map.pool) : null;
  if (bonusId) { addInv(bonusId, bonusN); rec('itemsGot', bonusN); rec('palFinds'); }
  // 음식은 **재료와 별개로** 같이 나온다 (재료를 대신 뺏지 않는다).
  // 요리사 클레멘이 들어오면 이 자리를 그가 가져간다 — STORY.md
  const food = Math.random() < D.FOOD_RATE ? pickFood() : null;
  if (food) { S.foods[food.id] = foodCount(food.id) + 1; rec('foodsGot'); }
  // 먹이도 **재료와 별개로** 같이 나온다 (CREATURE.md 7장). 음식과도 별개다 —
  // 한쪽이 나왔다고 다른 쪽이 안 나오지는 않는다
  const feed = Math.random() < D.FEED_RATE ? pickFeed() : null;
  if (feed) { S.feeds[feed.id] = feedCount(feed.id) + 1; rec('feedsGot'); }
  save();
  const ing = D.INGREDIENTS[id];
  // 토스트는 **누른 버튼 옆**에 띄운다. 화면 아래 기본 자리에 뜨면 목록을 한참 내려온
  // 상태에서는 방금 누른 곳과 너무 멀어 무엇이 나왔는지 눈이 따라가지 못한다.
  // 요소가 아니라 **선택자**를 넘기는 이유: 바로 아래 render() 가 카드를 새로 그려서
  // 지금 이 버튼은 문서에서 떨어져 나간다 (좌표가 0,0 이 되어 왼쪽 위 구석에 뜬다).
  const at = `.spot-card[data-spot="${mapId}"] .btn-gather`;
  if (bonusId) {
    // 덤이 나오면 **한 줄로 합쳐서** 알린다 — 토스트를 두 번 띄우면 앞것이 잘린다.
    // 둘째 줄은 단서가 **대신** 맡는다. 「하나 더 찾았어요」를 따로 두면 단서까지
    // 세 줄이 되는데, 단서가 이미 누가 왜 찾았는지를 말하고 있다
    const bi = D.INGREDIENTS[bonusId];
    // 로열티가 높으면 덤이 여러 개다 — **개수를 적는다.** 안 적으면 가방 숫자만
    // 조용히 늘어 로열티를 올린 보람이 화면에서 사라진다
    toast(T('got_item_pal', {
      emoji: ing.emoji, name: N(ing.id, ing.name),
      emoji2: bi.emoji, name2: N(bi.id, bi.name) + (bonusN > 1 ? ` ×${bonusN}` : ''),
      clue: gatherClue(mapId, 'pal', bonusN),
    }), at, 3400, 'above');
    if (window.Sfx) Sfx.play('success');
  } else if (isSpecial) {
    // 일지 — 히든 재료는 맵마다 하나뿐이라 **어쩌다 한 번**이다. 평범한 채집까지
    // 적으면 일지가 통째로 채집 로그가 되어 진짜 사건이 묻힌다
    diaryAdd('di_rare', { id: ing.id, map: mapId });
    const clue = gatherClue(mapId, 'rare');
    const nm = N(ing.id, ing.name);
    toast(clue
      ? T('got_special_clue', { emoji: ing.emoji, name: nm, clue })
      : T('got_special', { emoji: ing.emoji, name: nm, josa: josa(nm, '을를') }),
      at, 3400, 'above');
    if (window.Sfx) Sfx.play('success');
  } else if (food) {
    // 둘이 같이 나오면 **한 줄로 합쳐서** 알린다 — 토스트를 두 번 띄우면 앞것이 잘린다
    toast(T('got_item_food', { emoji: ing.emoji, name: N(ing.id, ing.name),
      femoji: food.emoji, fname: N(food.id, food.name) }), at, 2600, 'above');
  } else {
    // 평범하게 하나 주웠을 때는 단서가 **대개 빈 문자열**이다 (CLUE.miss 확률로만 뜬다)
    const clue = gatherClue(mapId, 'plain');
    const nm = N(ing.id, ing.name);
    toast(clue
      ? T('got_item_clue', { emoji: ing.emoji, name: nm, clue })
      : T('got_item', { emoji: ing.emoji, name: nm }),
      at, clue ? 3000 : null, 'above');
  }
  // 채집 애니메이션
  const card = document.querySelector(`.spot-card[data-spot="${mapId}"]`);
  if (card) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
  render();
  if (window.Tut) Tut.fire('gather');
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
//  리그 (주간 랭킹)
// ═══════════════════════════════════════════════════════════════
// 듀오링고의 리그와 같은 규칙이다: 12명이 한 조가 되어 **한 주 동안 얻은 점수**로
// 겨루고, 월요일 0시에 정산해 1~3위는 위 리그로, 9~12위는 아래 리그로 간다.
//
// 점수는 **그 주에 물약을 마셔서 오른 매력**이다. 채집·조합만으로는 오르지 않는다 —
// 마시는 것이 이 게임에서 '진도를 냈다' 는 뜻이고, 매력은 이미 모든 해금의 기준이다.
//
// 상대 11명은 **NPC 다.** 진짜 플레이어끼리 조를 짜려면 서버가 주간 점수와 조 편성을
// 들고 있어야 하는데(지금은 누적 매력 순위표뿐이다), 그때까지 화면이 비어 있으면
// 이 시스템은 확인할 수도 없다. NPC 는 주차·리그로 시드를 고정해 만들므로
// **새로고침해도 같은 명단, 같은 점수**다 — 나중에 자리만 실제 사람으로 바꿔 끼운다.

// 주차 키 — 로컬 월요일 0시가 경계다. 'YYYY-Www'
function weekKey(d = nowDate()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // 목요일 기준 ISO 주차 (월요일 시작). getDay(): 0=일 … 6=토
  const day = (t.getDay() + 6) % 7;           // 0=월 … 6=일
  t.setDate(t.getDate() - day + 3);           // 그 주의 목요일
  const first = new Date(t.getFullYear(), 0, 4);
  const fday = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - fday + 3);
  const wk = 1 + Math.round((t - first) / (7 * 86400000));
  return `${t.getFullYear()}-W${wk < 10 ? '0' + wk : wk}`;
}
// 이번 주가 끝나기까지 남은 ms (다음 월요일 0시)
function msToWeekEnd(d = nowDate()) {
  const day = (d.getDay() + 6) % 7;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - day), 0, 0, 0, 0);
  return end - d;
}
// 이번 주가 얼마나 지났나 (0 ~ 1). NPC 점수가 주 초반에 낮은 이유
function weekProgress(d = nowDate()) {
  const day = (d.getDay() + 6) % 7;
  return Math.min(1, (day + d.getHours() / 24) / 7);
}

// ─── 결정적 난수 ───
// 같은 주 · 같은 리그면 **언제 봐도 같은 명단**이어야 한다. 새로고침마다 상대가
// 바뀌면 순위를 겨룬다는 느낌이 아예 성립하지 않는다.
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 리그가 높을수록 상대가 세다 — 이 값이 그 주 1위의 대략적인 점수다.
//
// 맨 아래 40점 → 맨 위 1590점(32칸). 칸당 **26 → 50** 으로 올렸다:
// 비법서와 함께 들어온 두 가지가 한 주 상한을 1312 → 2720 점으로 밀어 올렸기
// 때문이다 — ① AP 상한이 매력 단계로 늘어난다(여신 1800) ② 초반 지대의 채집이
// 싸졌다. 26 짜리 사다리는 상한의 **31%** 라 맨 위가 32주짜리 산책이 됐었다.
// ⚠️ **`tools/checkbalance.js` 가 이 관계를 잰다** — 40~70% 밖으로 나가면 실패한다
function leaguePace(i) { return 40 + i * 50; }

// 같은 조 NPC 11명. rank 는 여기서 정하지 않는다 (내 점수와 섞어서 매긴다)
function leagueNpcs(lgIndex, wkKey, atProgress) {
  const n = D.LEAGUE.size - 1;
  const rnd = rng32(hash32(wkKey + '|' + lgIndex));
  const pace = leaguePace(lgIndex);
  const used = new Set();
  const out = [];
  for (let i = 0; i < n; i++) {
    // 이름 — 앞말 × 뒷말. **앞말이 겹치지 않게** 고른다.
    // 이름 전체로만 걸러 내면 '꽃알·꽃실·꽃씨·꽃깃' 처럼 한 앞말이 몰려서
    // 12명이 서로 다른 사람으로 읽히지 않는다 (앞말이 12개라 11명까지는 항상 가능하다)
    let head, tail;
    do { head = D.NPC_HEAD[Math.floor(rnd() * D.NPC_HEAD.length)]; } while (used.has(head.id));
    used.add(head.id);
    tail = D.NPC_TAIL[Math.floor(rnd() * D.NPC_TAIL.length)];
    // 이번 주에 낼 목표 점수 — 1위 근처부터 꼴찌까지 넓게 흩는다
    const target = Math.round(pace * (0.12 + 0.95 * Math.pow(rnd(), 1.35)));
    // 사람마다 달리는 속도가 다르다. 주 초반에 다 몰려 있으면 순위가 의미 없다
    const speed = 0.65 + rnd() * 0.7;
    const score = Math.max(0, Math.round(target * Math.min(1, atProgress * speed)));
    out.push({ npc: true, head, tail, score });
  }
  return out;
}
function npcName(row) {
  return N(row.head.id, row.head.name) + N(row.tail.id, row.tail.name);
}

// 지금(또는 주가 끝난 시점)의 순위표. 내 자리를 섞어 점수 내림차순으로 매긴다.
// 동점이면 내가 위로 간다 — 내 순위가 남의 정렬 순서 때문에 흔들리면 안 된다.
function leagueBoard(atProgress) {
  const p = (atProgress === undefined) ? weekProgress() : atProgress;
  const me = { me: true, score: (S.week && S.week.score) || 0, name: S.name || T('me') };
  const rows = leagueNpcs(S.league, S.week.key || weekKey(), p).concat([me]);
  rows.sort((a, b) => (b.score - a.score) || ((a.me ? 0 : 1) - (b.me ? 0 : 1)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// 순위 → 승급 / 잔류 / 강등
function rankKind(rank) {
  if (rank <= D.LEAGUE.up) return 'up';
  if (rank > D.LEAGUE.size - D.LEAGUE.down) return 'down';
  return 'stay';
}

// 주가 바뀌었으면 정산한다. 화면을 열 때마다 부른다 (싸다 — 키만 비교한다)
//
// **지난 주 순위는 저장한 값에서 다시 계산한다.** 내 점수는 세이브에 있고 NPC 는
// 주차·리그 시드로 되살아나므로, 며칠 뒤에 켜도 같은 결과가 나온다.
// 여러 주를 비웠어도 **정산은 한 번만** 한다 — 안 한 주마다 강등시키면
// 오래 쉬었다 돌아온 사람이 맨 아래까지 떨어진다.
function settleLeague() {
  const now = weekKey();
  if (!S.week.key) { S.week.key = now; return false; }   // 첫 진입 — 겨룰 지난 주가 없다
  if (S.week.key === now) return false;

  const rows = leagueNpcs(S.league, S.week.key, 1)
    .concat([{ me: true, score: S.week.score || 0 }]);
  rows.sort((a, b) => (b.score - a.score) || ((a.me ? 0 : 1) - (b.me ? 0 : 1)));
  const rank = rows.findIndex(r => r.me) + 1;
  const kind = rankKind(rank);
  const from = S.league;
  const max = D.LEAGUES.length - 1;
  const to = kind === 'up' ? Math.min(max, from + 1)
           : kind === 'down' ? Math.max(0, from - 1) : from;

  S.league = to;
  S.leagueLast = { rank, from, to, kind, key: S.week.key };
  S.week = { key: now, score: 0 };
  save();
  return true;
}

// 랭킹 탭은 '여신' 단계부터 열린다 — 그 전에는 탭 자체가 없다
function leagueOpen() { return charmPeak() >= D.LEAGUE.openAt; }

// 물약을 마셔 매력이 올랐을 때 이번 주 점수에 더한다
function addWeekScore(n) {
  if (!(n > 0)) return;
  if (!S.week.key) S.week.key = weekKey();
  S.week.score = (S.week.score || 0) + n;
}

// 지난 주 결과 배너를 닫는다 (한 번 보고 나면 치운다)
function closeLeagueLast() {
  S.leagueLast = null;
  save();
  renderLeague();
}
window.closeLeagueLast = closeLeagueLast;

// ─── 랭킹 화면 ─────────────────────────────────────────────────
// 듀오링고의 리더보드와 같은 짜임이다: 리그 배지 → 남은 시간 → 12행 순위표.
// 승급 구간(1~3)과 강등 구간(9~12) **사이에 선을 그어** 지금 어느 쪽인지 한눈에 보이게 한다.
function leagueName(i) {
  const lg = D.league(i);
  return N(lg.fam.id, lg.fam.name) + ' ' + lg.step;
}
window.leagueName = leagueName;

// '3일 5시간 남음' — 하루가 안 남으면 시간·분으로 내려간다
function leagueLeftText() {
  const ms = msToWeekEnd();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  if (d > 0) return T('lg_left_dh', { d, h });
  const m = Math.max(1, Math.floor(ms / 60000) % 60);
  return T('lg_left_hm', { h, m });
}

function leagueBadgeSvg(lg, size) {
  const c = lg.fam.color, c2 = shadeHex(c, 34);
  return `<svg class="lg-badge-svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="${c}" opacity="0.16"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="3"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="${c2}" stroke-width="5"
      stroke-dasharray="1.5 8" opacity="0.8"/>
  </svg>`;
}
// 색을 어둡게 (avatar.js 의 shade 와 같은 계산 — 여기서는 hex 만 다룬다)
function shadeHex(hex, amt) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = Math.max(0, (n >> 16) - amt), g = Math.max(0, ((n >> 8) & 255) - amt), b = Math.max(0, (n & 255) - amt);
  return `rgb(${r},${g},${b})`;
}

function renderLeague() {
  const el = document.getElementById('leagueBody');
  if (!el) return;
  settleLeague();                    // 주가 바뀌었으면 여기서 정산된다

  const lg = D.league(S.league);
  const rows = leagueBoard();
  const myRank = (rows.find(r => r.me) || {}).rank || D.LEAGUE.size;

  // 지난 주 결과 — 한 번 보여 주고 닫는다
  let last = '';
  if (S.leagueLast) {
    const L = S.leagueLast;
    const msg = L.kind === 'up'   ? T('lg_res_up',   { n: L.rank, to: leagueName(L.to) })
              : L.kind === 'down' ? T('lg_res_down', { n: L.rank, to: leagueName(L.to) })
                                  : T('lg_res_stay', { n: L.rank, to: leagueName(L.to) });
    last = `<div class="lg-last lg-${L.kind}" role="status">
      <span class="lg-last-ic" aria-hidden="true">${L.kind === 'up' ? '▲' : L.kind === 'down' ? '▼' : '＝'}</span>
      <span class="lg-last-tx">${msg}</span>
      <button class="lg-last-x" onclick="closeLeagueLast()" aria-label="${T('btn_ok')}">✕</button>
    </div>`;
  }

  // 사다리에서 지금 어디인가 — 32개 중 몇 번째인지 보여 준다
  const ladder = `<div class="lg-ladder">
    <span class="lg-ladder-n">${lg.index + 1} / ${D.LEAGUES.length}</span>
    <span class="lg-ladder-track"><span class="lg-ladder-fill"
      style="width:${((lg.index + 1) / D.LEAGUES.length * 100).toFixed(1)}%;background:${lg.fam.color}"></span></span>
    <span class="lg-ladder-top">${lg.top ? T('lg_top') : leagueName(lg.index + 1)}</span>
  </div>`;

  const upN = D.LEAGUE.up, downFrom = D.LEAGUE.size - D.LEAGUE.down + 1;
  const list = rows.map(r => {
    const kind = rankKind(r.rank);
    // 구간이 바뀌는 자리에 선을 긋는다 — 3위/4위 사이, 8위/9위 사이
    const sep = (r.rank === upN + 1) ? `<div class="lg-sep"><span>${T('lg_zone_stay')}</span></div>`
              : (r.rank === downFrom) ? `<div class="lg-sep lg-sep-down"><span>${T('lg_zone_down')}</span></div>`
              : '';
    const face = r.me ? (S.tutorialDone ? '👤' : '👑') : '🧪';
    return sep + `<div class="lg-row ${r.me ? 'me' : ''} lg-${kind}">
      <span class="lg-rank">${r.rank}</span>
      <span class="lg-face" aria-hidden="true">${face}</span>
      <span class="lg-name">${r.me ? (S.name || T('me')) : npcName(r)}</span>
      <span class="lg-score">${T('lg_pts', { n: r.score.toLocaleString() })}</span>
    </div>`;
  }).join('');

  el.innerHTML = last + `
    <div class="lg-head">
      <div class="lg-badge">${leagueBadgeSvg(lg, 92)}<span class="lg-badge-em">${lg.fam.emoji}</span></div>
      <div class="lg-title">${leagueName(lg.index)}</div>
      <div class="lg-sub">${T('lg_rule', { up: upN, down: D.LEAGUE.down })}</div>
      ${ladder}
      <div class="lg-timer">⏳ ${leagueLeftText()}</div>
    </div>
    <div class="lg-zone-head">${T(rankKind(myRank) === 'up' ? 'lg_now_up'
      : rankKind(myRank) === 'down' ? 'lg_now_down' : 'lg_now_stay', { n: myRank })}</div>
    <div class="lg-list">${list}</div>
    <div class="lg-foot">${T('lg_score_help')}</div>`;

  renderLeagueDev();   // 임시(출시 때 지운다)
}

// ═══════════════════════════════════════════════════════════════
//  공방 / 가마솥 (Atelier)
// ═══════════════════════════════════════════════════════════════
// 고른 레시피(S.want)를 지금 가진 재료로 다시 채운다.
// 담을 수 있는 것만 담고, 없는 것은 담지 않는다 (그 자리는 회색 재료로 보인다).
function refillFromWant() {
  if (!S.want || !S.want.length) return;
  const left = {};
  S.want.forEach(id => { left[id] = stockOf(id); });
  S.cauldron = S.want.filter(id => (left[id]-- > 0));
}

// 구멍마다 '무엇이 있어야 하는지 / 지금 있는지' 를 낸다.
// 레시피를 고르지 않았으면 담긴 것만 그대로 보여 준다.
function slotView() {
  const n = cauldronSlots();
  const out = [];
  if (S.want && S.want.length) {
    const have = {};
    S.cauldron.forEach(id => { have[id] = (have[id] || 0) + 1; });
    S.want.forEach(id => {
      const ok = have[id] > 0;
      if (ok) have[id]--;
      out.push({ id, ghost: !ok });
    });
  } else {
    S.cauldron.forEach(id => out.push({ id, ghost: false }));
  }
  while (out.length < n) out.push(null);
  return out.slice(0, n);
}

// 회색 재료를 눌렀을 때 — 무엇이 모자란지 알려 준다
function lackHint(el) { toast(T('mat_lack'), el); }
window.lackHint = lackHint;

function addToCauldron(id) {
  if (S.cauldron.length >= cauldronSlots()) { toast(T('cauldron_full', { n: cauldronSlots() })); return; }
  if (stockOf(id) - S.cauldron.filter(x => x === id).length <= 0) {
    // 크리처는 **한 마리를 남겨야** 해서 「가진 것이 있는데 못 넣는」 경우가 있다 —
    // 그때는 이유를 따로 말해 준다. 안 그러면 버그로 읽힌다
    toast(T(isMeltItem(id) && S.creatures.includes(id) ? 'melt_keep_one' : 'not_enough_mat'));
    return;
  }
  S.cauldron.push(id);
  // ⚠️ **흐린 장을 채우는 중이면 목표를 안 놓는다.** 모르는 칸에 넣어 보는 것 자체가
  // 「손으로 담기」라서, 예전 규칙 그대로 두면 넣는 순간 목표가 사라져 **영영 못 맞힌다.**
  // 아직 모르는 칸이 남아 있는 동안만 붙들고, 다 채우면 평소 규칙으로 돌아간다
  const g = S.guess && D.RECIPES.find(x => x.result.id === S.guess);
  if (!(g && unknownOf(g).length)) { S.want = []; S.guess = null; }
  save(); render();
  if (window.Tut) Tut.fire('put');
}
function removeFromCauldron(idx) {
  // 화면의 idx 는 '구멍 번호' 다 — 회색 자리가 섞여 있으면 S.cauldron 의 순서와 다르다.
  // 그 구멍에 실제로 담긴 것이 몇 번째인지 세어서 뺀다.
  const view = slotView();
  const cell = view[idx];
  if (!cell || cell.ghost) return;
  const real = view.slice(0, idx).filter(c => c && !c.ghost).length;
  S.cauldron.splice(real, 1);
  S.want = []; S.guess = null;   // 손으로 뺐으면 레시피 선택은 놓는다
  save(); render();
}
function clearCauldron() { S.cauldron = []; S.want = []; S.guess = null; save(); render(); }

// 채집 가방 접기/펼치기 (기본: 닫힘)
let bagOpen = false;
function toggleBag() {
  bagOpen = !bagOpen;
  applyBagState();
  if (window.Tut) Tut.fire('bag:' + (bagOpen ? 'open' : 'close'));
}
function applyBagState() {
  const bag = document.getElementById('ingredientBag');
  const chev = document.getElementById('bagChevron');
  if (bag) bag.style.display = bagOpen ? '' : 'none';
  if (chev) chev.textContent = bagOpen ? '▾' : '▸';
}

// ─── 실패한 조합이 정답에서 얼마나 멀었나 ────────────────────────
// **실패를 위로금이 아니라 정보로 만든다.** 현자의 결정만 주면 다음 시도가 앞의
// 시도와 아무 관계가 없어서, 100가지 레시피를 순서대로 다 넣어 보는 것 말고는 길이 없다.
// 몇 가지가 맞았는지만 알려 주면 **다음 시도가 앞의 시도 위에 쌓인다** — 무작정 넣기가
// 추리가 되고, 그게 효율을 쫓는 사람에게도 가장 빠른 길이 된다.
//
// **재료 가짓수가 같은 레시피끼리만 견준다.** 2가지를 넣었는데 3가지짜리 레시피와
// 견주어 '2개 맞음' 이라고 하면, 실은 하나가 모자란 것이라 안내가 거짓말이 된다.
// 돌려주는 값: 겹친 가짓수 / -1 이면 그 가짓수의 레시피가 아예 없다.
function brewNear(inputs) {
  const n = inputs.length;
  let best = -1;
  for (const r of D.RECIPES) {
    if (r.inputs.length !== n) continue;
    if (best < 0) best = 0;
    // **같은 재료를 두 번 넣을 수 있으므로 다중집합으로 센다.**
    // 단순 includes 로 세면 [약초, 약초] 가 [약초, 산딸기] 에 2개 맞은 것이 된다.
    const pool = r.inputs.slice();
    let hit = 0;
    for (const id of inputs) {
      const i = pool.indexOf(id);
      if (i >= 0) { pool.splice(i, 1); hit++; }
    }
    if (hit > best) best = hit;
  }
  // n개가 다 맞았다면 애초에 성공했어야 한다 — 여기 왔다는 것은 계산이 어긋난 것이다
  return Math.min(best, n - 1);
}

// 위 결과를 사람이 읽을 문장으로. 실패 모달 아래에 한 줄로 들어간다.
function brewNearText(inputs) {
  const n = inputs.length;
  const hit = brewNear(inputs);
  if (hit < 0)      return T('brew_near_nosize', { n: n });
  if (hit === 0)    return T('brew_near_zero');
  if (hit === n - 1) return T('brew_near_one', { k: hit });
  return T('brew_near', { k: hit });
}

function brew() {
  if (S.cauldron.length < 2) { toast(T('need_two')); return; }
  // ⚠️ **AP 를 쓰기 «전»에 막는다.** 비법서에 없는 조합은 아예 안 만들어지므로,
  // 먼저 깎고 나서 「없는 장입니다」라고 하면 예전의 그 좌절이 이름만 바꿔 돌아온다.
  //
  // **없는 레시피와 「장이 없는 레시피」를 구분해서 말하지 않는다.** 갈라 말하면
  // 아무거나 넣어 보며 «조합이 존재하는지»를 알아낼 수 있게 되어, 비법서가
  // 유일한 길이라는 규칙에 뒷문이 생긴다
  // ═══ 흐린 장 — 아직 모르는 칸이 있는 장을 만들어 보는 중이면 여기서 갈린다 ═══
  //
  // ⚠️ **틀려도 재료가 안 없어진다.** 이 한 줄이 부담을 없앤다 — 잃을 것이 없으니
  // 마음껏 넣어 볼 수 있고, 그래서 「실패」라는 말이 화면에 안 나온다.
  // AP 만 든다 (그것도 안 들면 아무 생각 없이 눌러 보게 된다).
  {
    const g = S.guess && D.RECIPES.find(x => x.result.id === S.guess);
    const un = g ? unknownOf(g) : [];
    if (g && un.length && hasPage(g.result.id)) {
      if (!spendEnergy(D.ENERGY.cost.brew)) { toast(T('no_energy')); return; }
      // 담긴 것 중 **모르는 칸의 정답이 있으면 그 자리가 밝혀진다.**
      // 하나만 맞아도 진도가 나가므로 **절대 안 막힌다**
      const got = un.filter(id => S.cauldron.indexOf(id) >= 0);
      got.forEach(id => learnIng(g.result.id, id));
      rec('brews');
      // 다시 담아 준다 — 이제 밝혀진 칸까지 자동으로 채워진다
      const left = unknownOf(g);
      S.want = g.inputs.filter(id => left.indexOf(id) < 0);
      refillFromWant();
      save(); render();
      if (got.length) {
        const names = got.map(id => itemName(id)).join(', ');
        toast(T(left.length ? 'lore_got' : 'lore_all', { names, n: left.length }), null, 3600);
        if (window.Sfx) Sfx.play('success');
      } else {
        toast(T('lore_miss'), null, 3200);
        if (window.Sfx) Sfx.play('pick');
      }
      if (window.Tut) Tut.fire('brew:fail');
      return;
    }
  }
  const ready = D.RECIPE_MAP[D.recipeKey(S.cauldron)];
  if (!ready || !hasPage(ready.id)) {
    toast(T('brew_no_page'), null, 3000);
    if (window.Sfx) Sfx.play('fail');
    // ⚠️ **튜토리얼에 「해 봤다」고 알려 준다.** `brew_again` 단계가
    // `['brew:ok','brew:fail']` 을 기다리는데, 여기서 조용히 돌아가면
    // 막이 영영 안 걷혀 **새 플레이어가 갇힌다** (막다른 길을 만들지 않는다)
    if (window.Tut) Tut.fire('brew:fail');
    return;
  }
  if (!spendEnergy(D.ENERGY.cost.brew)) {
    toast(T('no_energy'));
    return;
  }
  // 실패 안내에 쓸 조합을 **지우기 전에** 챙겨 둔다
  const tried = S.cauldron.slice();
  // 재료 소모 — 크리처가 섞여 있으면 그 개체도 같이 사라진다 (`spendItem`)
  for (const id of S.cauldron) spendItem(id, 1);
  const key = D.recipeKey(S.cauldron);
  const result = D.RECIPE_MAP[key];
  S.cauldron = [];
  // 고른 레시피가 있으면 남은 재료로 **다시 채운다.** 같은 것을 여러 번 만들 때
  // 매번 레시피를 다시 누르지 않아도 된다. 모자라면 그 자리는 회색으로 남는다.
  refillFromWant();

  rec('brews');
  // ⚠️ **여기까지 오면 실패하지 않는다.** 위에서 이미 「장이 있는 조합」만
  // 통과시켰기 때문이다. 이 갈래는 세이브가 깨졌거나 데이터가 어긋났을 때의
  // 안전망으로만 남겨 둔다 — 재료와 AP 를 먹고 아무것도 안 주는 일이 없게
  if (!result) {
    rec('brewFail');
    S.crystal = (S.crystal || 0) + D.ENERGY.failReward;
    save(); render();
    if (window.Tut) Tut.fire('brew:fail');
    showBrewResult(D.CRYSTAL, false, brewNearText(tried));
    return;
  }

  rec('brewOk');
  // **현자의 결정은 이제 성공에서 나온다.** 실패가 사라지면서 유일한 수급원이
  // 없어졌고, 그대로 두면 AP 충전도 밭 칸도 영영 못 여는 게임이 된다.
  // 조합 값(25)보다 반드시 작다 — 같기만 해도 조합을 돌려 AP 를 무한히 번다
  S.crystal = (S.crystal || 0) + (D.ENERGY.brewReward || 0);
  const isNew = !S.discovered.includes(result.id);
  if (isNew) {
    rec('discoveries');
    S.discovered.push(result.id);
    // 일지 — **물약만 적는다.** 크리처는 바로 아래에서 따로 한 줄을 남기므로
    // 여기서도 적으면 같은 일이 두 줄이 된다
    if (result.kind === 'potion') diaryAdd('di_find', { id: result.id });
    lastFound = result.id;              // 레시피 북에서 맨 위로 올려 강조
    // 발견한 카테고리로 레시피 북을 자동 전환
    recipeKind = result.kind;
    if (result.grade) recipeTab = result.grade;
  }

  if (result.kind === 'potion') {
    S.potions[result.id] = (S.potions[result.id] || 0) + 1;
    questBump('brew', result.id);
  } else if (result.kind === 'creature') {
    questBump('creature', result.id);
    rec('creatures');
    S.creatures.push(result.id);
    // 일지 — 속성마다 한 마디가 다르다. 서른 마리에 한 줄씩 쓰면 예순 줄이 되고,
    // 그중 대부분은 한 번도 안 읽힌다. **속성 여섯이면 결은 충분히 산다**
    diaryAdd('di_creature', { id: result.id, attr: result.attr || 'fire' });
    // 크리처는 행운을 부른다 — 전시 매력 보너스 × 8 만큼 행운 상승
    addAura('luck', (result.charmBonus || 0) * 8);
  }
  save(); render();
  checkUnlocks();
  if (window.Tut) Tut.fire('brew:ok');
  showBrewResult(result, isNew);
  // 모르던 레시피가 열리면 알림 (조합 결과 모달 위에 표시)
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
  questBump('drink', potionId);
  const beforeStep = bodyStep();
  S.stats.beauty += r.result.beauty || 0;
  S.stats.charm  += r.result.charm  || 0;
  addWeekScore(r.result.charm || 0);   // 리그 주간 점수 = 그 주에 오른 매력
  // 물약마다 아우라 세부 수치가 다르게 오른다 (아우라 획득량 × 5)
  // **음유 시인의 노래**가 아우라 획득에 붙는다 (STORY.md 「아우라는 카이로스가 채운다」)
  const gain = Math.round((r.result.charm || 0) * 5 * bondMult('aura'));
  if (gain > 0) {
    const kinds = AURA_BY_POTION[r.result.id] || AURA_KEYS;
    kinds.forEach(k => addAura(k, Math.round(gain / kinds.length)));
  }
  save();
  toast(T('drank', { emoji: r.result.emoji, name: N(r.result.id, r.result.name), b: r.result.beauty, c: r.result.charm }));
  render();
  checkUnlocks();
  if (window.Tut) Tut.fire('drink');
  // 살 빠지는 연출 — 단계가 내려가면 크게, 아니면 반짝임만
  // (수치 자체는 연속으로 조금씩 움직이지만 연출까지 매번 터뜨리면 시끄럽다)
  const afterStep = bodyStep();
  playSlimFx(afterStep > beforeStep ? (afterStep === BODY_STEPS ? 'done' : 'step') : 'sip');
  // 일지 — **단계가 내려간 날만 적는다.** 물약은 하루에도 여러 번 마시므로
  // 한 모금마다 적으면 일지가 물약 영수증이 된다. 몸이 실제로 달라진 날이 사건이다
  if (afterStep > beforeStep) {
    diaryAdd('di_slim', { step: afterStep, done: afterStep === BODY_STEPS ? 1 : 0 });
    setTimeout(() => {
      toast(T(afterStep === BODY_STEPS ? 'body_done' : 'body_down'), null, 2600);
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
//  조합 결과 모달
// ═══════════════════════════════════════════════════════════════
function showBrewResult(result, isNew, near) {
  const modal = document.getElementById('brewModal');
  const body = document.getElementById('brewModalBody');
  const success = result.kind !== 'crystal';
  let statLine = '';
  if (result.kind === 'crystal') {
    // 현자의 결정 + **얼마나 가까웠는지.** 둘을 한 줄에 붙이지 않는 이유는
    // 하나는 보상이고 하나는 단서라 읽는 목적이 다르기 때문이다
    statLine = `<div class="brew-stats">${T('brew_crystal', { n: D.ENERGY.failReward })}</div>`
      + (near ? `<div class="brew-near">${near}</div>` : '');
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
    <div class="brew-emoji ${success ? 'pop' : ''}">${resultArt(result)}</div>
    <div class="brew-name">${N(result.id, result.name)}</div>
    ${result.desc ? `<div class="brew-desc">${N(result.id + '_desc', result.desc)}</div>` : ''}
    ${statLine}
  `;
  modal.classList.add('show');
  window.Sfx && Sfx.play(success ? 'success' : 'fail');
}
function closeBrewModal() {
  document.getElementById('brewModal').classList.remove('show');
  // 모달이 떠 있는 동안 튜토리얼은 스스로 숨는다 — 닫혔으니 다시 나오라고 알려 준다
  if (window.Tut) Tut.refresh();
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
  if (currentTab === 'league') renderLeague();
  renderTabBar();
  // 퀘스트 칩은 **모든 탭에 뜬다** — 퀘스트는 특정 화면의 것이 아니다
  renderQuestChip();
  applyDevTools();   // 임시(출시 때 지운다): 화면마다 있는 개발용 블록의 접힘 상태를 맞춘다
  // 화면이 통째로 다시 그려졌다 — 튜토리얼의 구멍도 다시 재야 한다
  if (window.Tut) Tut.refresh();
}

// 랭킹 탭은 '여신' 단계부터 나타난다. 잠긴 탭을 자물쇠로 보여 주지 않는 이유:
// 하단 탭은 **지금 갈 수 있는 곳**의 목록이고, 셋에서 넷으로 늘면 그것만으로도
// 새로 열렸다는 것이 눈에 띈다 (좁은 화면에서 라벨 자리도 아깝다)
function renderTabBar() {
  const btn = document.querySelector('.tab-btn[data-tab="league"]');
  if (btn) btn.hidden = !leagueOpen();
}

function renderHeader() {
  const total = totalCharm();
  const tier = D.getTier(total);
  document.getElementById('hdrTier').textContent = tier.emoji;   // 아이콘만 (문구는 토스트로)
  document.getElementById('hdrCharm').textContent = total;       // 매력 총합 점수
}

function renderGather() {
  // 채집 값이 **맵마다 갈렸다.** 여기서 한 벌로 잴 수가 없어서 카드마다 다시 잰다 —
  // 평야는 갈 수 있는데 황무지는 못 가는 상태가 정상이고, 그게 화면에 보여야 한다

  // 필드 / 마을 / 밭 — 윗단 세 칸. 밭은 여신 단계부터 보인다
  const fOpen = farmOpen();
  const fBtn = document.getElementById('gtabFarm');
  if (fBtn) fBtn.hidden = !fOpen;
  // 잠겼는데 밭에 서 있으면(개발용으로 열었다 닫은 경우 등) 필드로 되돌린다 —
  // 안 그러면 탭 줄에 없는 화면이 그대로 남는다
  if (gatherTab === 'farm' && !fOpen) gatherTab = 'field';
  document.querySelectorAll('.gt-tabs .room-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.gtab === gatherTab));
  ['field', 'village', 'farm'].forEach(t => {
    const p = document.getElementById('gatherPanel-' + t);
    if (p) p.classList.toggle('active', t === gatherTab);
  });
  if (gatherTab === 'farm') renderFarm();
  // 안내 문구는 **지금 상태를 말해야 한다.** 마을이 열렸는데도 "아직 열리지 않았어요"
  // 라고 적혀 있으면 그 자체가 거짓말이다 (개발용 스위치로 열어 두고 한참 못 봤다)
  const subEl = document.getElementById('gatherSub');
  if (subEl) subEl.textContent = gatherSubText();
  renderPalRow();
  renderDayPart();

  renderVillages();

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
    // 재료 이모지는 **눌러서 이름을 볼 수 있다.**
    const poolChip = (id, cls, label, call) =>
      `<button class="spot-chip ${cls}" aria-label="${label}"
        onclick="${call}" oncontextmenu="return false">`;
    const chips = spot.pool.map(id => {
      const ing = D.INGREDIENTS[id];
      return poolChip(id, '', N(id, ing.name), `ingHint('${id}',this)`) + ing.emoji + '</button>';
    }).join('');
    const sp = D.INGREDIENTS[spot.special];
    // 특별한 재료는 한 번이라도 얻었을 때만 정체를 보여 준다
    // 임시: 개발용 '모든 히든 재료 오픈' 스위치가 켜져 있으면 얻지 않았어도 정체를 보여 준다
    const found = devFlag(DEV_SPECIALS_KEY) || invCount(spot.special) > 0;
    const spChip = poolChip(spot.special, `spot-special ${found ? 'found' : ''}`,
      found ? N(sp.id, sp.name) : T('special_hint'), `specialHint('${spot.id}',this)`)
      + (found ? sp.emoji : '❔') + '</button>';
    // 특별한 맵(미니게임이 있는 맵)은 카드 왼쪽 위에 배지를 단다 — UI_POLICY.md 참고
    const badge = spot.mini ? `<span class="spot-badge">${T('special_map')}</span>` : '';
    // 속성은 **글자로** 적는다 (이모지 아님 — CREATURE.md 2장). 오른쪽 위 배지.
    // 재료 칩(둥근 알약)과 자리·모양이 달라야 무엇이 무엇인지 헷갈리지 않는다
    const at = D.creatureAttr(D.mapAttr(spot.id));
    // 날씨는 **이모지**다 (속성은 글자). 이모지 하나로는 「비가 추적추적」이 안 읽혀서
    // 누르면 토스트로 이름을 알려 준다 — 속성에는 토스트가 없다. 이름이 이미 적혀 있어서다
    const we = weatherOf(spot.id);
    // 둘을 한 상자에 담아 오른쪽 위에 붙인다. 따로 절대배치하면 영어처럼 속성 이름이
    // 길어질 때 서로 겹친다 (`Water` 는 `물` 의 세 배다)
    const attrBadge = (we || at) ? `<div class="spot-tags">`
      + (we ? `<button class="spot-weather" onclick="weatherInfo('${spot.id}', this)"
               aria-label="${N(we.id, we.name)}">${we.emoji}</button>` : '')
      + (at ? `<span class="spot-attr" style="--at:${at.color}">${N(at.id, at.name)}</span>` : '')
      + `</div>` : '';
    // 카드 몸통은 **누르는 곳이 아니다.** 채집은 오른쪽 버튼만 한다 —
    // 재료 이름을 보려다, 목록을 밀어 내리려다 AP 가 새던 자리였다
    // **이 맵의 값**으로 다시 잰다 — 지대마다 달라서 하나로 뭉뚱그릴 수 없다.
    // 평야는 갈 수 있는데 황무지는 못 가는 상태가 정상이고, 그게 화면에 보여야 한다
    const cost = gatherCost(spot.id);
    const canGather = (S.energy || 0) >= cost;
    return `
      <div class="spot-card ${canGather ? '' : 'low-energy'}${spot.mini ? ' special' : ''}"
           data-spot="${spot.id}">
        ${badge}${attrBadge}
        <div class="spot-emoji">${spot.emoji}</div>
        <div class="spot-info">
          <div class="spot-name">${N(spot.id, spot.name)}</div>
          <div class="spot-desc">${N(spot.id + '_desc', spot.desc)}</div>
          <div class="spot-pool">${chips}${spChip}</div>
        </div>
        <button class="btn-gather" onclick="tapGather('${spot.id}')"
          onpointerdown="startGatherHold('${spot.id}', event)"
          oncontextmenu="return false">${T('gather_go')} <span class="cost-tag">⚡${cost}</span></button>
      </div>`;
  }).join('');

  renderGatherDev();   // 임시(출시 때 지운다)
}

// ─── 마을 ───────────────────────────────────────────────────
// **마을은 키워드로 연다** (STORY.md 「마을 해금」 · `ASKS` 의 `opens`).
// 점수는 시간이 해결해 주지만 키워드는 「누굴 만났느냐」라서 열렸을 때
// 「내가 열었다」가 남는다. ⚠️ **두 번 잠그지 않는다** — 여기에 매력 점수 조건을
// 또 걸지 않는다. 둘이 겹치면 왜 안 열리는지 플레이어가 알 수 없다.
//
// 개발용 스위치는 그대로 둔다 — 검증기가 「셋 중 하나만 열린」 줄 모양을
// 만들어 보는 데 쓴다 (전부 열기 / 마을 하나만 열기).
function isVillageOpen(v) {
  return (S.villages || []).includes(v.id) || devFlag(DEV_VILLAGE_KEY) || devFlag(devVillageKey(v.id));
}

// 탐험 화면 위쪽 한 줄. 갈래 · 마을 해금 여부 · 마을 안인지에 따라 달라진다.
function gatherSubText() {
  if (gatherTab === 'farm') return T('screen_farm_sub');
  if (gatherTab !== 'village') return T('screen_gather_sub');
  const list = D.villagesShown();
  return list.some(isVillageOpen) ? T('screen_village_sub_open') : T('screen_village_sub');
}

function renderVillages() {
  const list = D.villagesShown();
  const tabEl = document.getElementById('villageTabs');
  const el = document.getElementById('villageBody');
  if (!el) return;

  if (tabEl) {
    tabEl.innerHTML = list.map(v => {
      const open = isVillageOpen(v);
      // **갈 곳만 알려 준다** — 무엇을 물을지는 안 알려 준다 (STORY.md 「길 잃음 방지」)
      const dot = villageNews(v) ? '<span class="tab-dot" aria-hidden="true"></span>' : '';
      return `<button class="cat-tab ${villageTab === v.id ? 'active' : ''} ${open ? '' : 'locked'}"
        data-village="${v.id}" onclick="setVillage('${v.id}')">${open ? v.emoji : '🔒'} ${N(v.id, v.name)}${dot}</button>`;
    }).join('');
  }

  const v = list.find(x => x.id === villageTab) || list[0];
  if (!v) { el.innerHTML = ''; return; }
  const spot = villageSpotIn && (v.spots || []).find(x => x.id === villageSpotIn);
  if (spot) renderVillageSpot(el, v, spot);
  else renderVillageMap(el, v);
}

// 말풍선에 붙는 이름.
//
// **설정 문서의 이름과 화면에 뜨는 이름은 다르다** (STORY.md 「호칭 규칙」).
//  · 공주의 진짜 이름 「그위리엘」은 본인도 모르는 이름이고 마지막에 되찾는다.
//    그때까지 화면에 뜨는 것은 **플레이어가 지은 연금술사 이름**이다
//  · 요정 대모는 이름(알테이아)으로 불리지 않는다. 인트로가 쓰는 문자열(`sp_fairy`)을
//    그대로 쓰므로 인트로와 튜토리얼이 어긋날 수가 없다
//
// SPEAKERS 의 `name` 은 그대로 둔다 — 그쪽은 설정상의 이름이고, 나중에 그 이름이
// 밝혀지는 장면에서 쓸 값이다. 여기서는 **부르는 말**만 정한다.
function speakerName(id) {
  if (id === 'sp_gwiriel') return S.name || T('sp_princess');
  if (id === 'sp_althea') return T('sp_fairy');
  const sp = D.speaker(id);
  return sp ? N(sp.id, sp.name) : '';
}
window.speakerName = speakerName;

// ── 마을 지도 ────────────────────────────────────────────────
// 배경은 village.js 가 SVG 로 그리고, **건물 이름표는 HTML 명판**으로 얹는다.
// 자리(x/y)는 데이터 한 곳에 있어서 그림과 이름표가 어긋날 수가 없다.
//
// **잠긴 마을도 지도까지는 보여 준다.** 무엇이 기다리고 있는지 읽어 보는 것이
// 지금 이 화면에서 할 수 있는 전부이고, 그것까지 막으면 탭 셋이 자물쇠 세 개로만 남는다.
// 잠겨 있으면 지도 전체가 흐려지고(공통 잠금 표현) 건물을 눌러도 안내만 나온다.
function renderVillageMap(el, v) {
  const open = isVillageOpen(v);
  const spots = v.spots || [];
  // 명판은 좌우에 번갈아 붙는 **띠**다. 자리의 x 가 절반보다 왼쪽이면 왼쪽 끝에,
  // 오른쪽이면 오른쪽 끝에 붙인다 — 데이터의 지그재그가 그대로 좌우가 된다
  // 자리의 x 로 명판을 어디에 붙일지 정한다 — 왼쪽 끝 · 오른쪽 끝 · 가운데.
  // (건물이 홀수면 마지막 하나가 가운데에 남는다)
  const side = x => (x < 40 ? 'l' : x > 60 ? 'r' : 'c');
  const pins = spots.map(s => `
    <button class="vil-pin ${side(s.x)}" style="top:${s.y}%"
      data-vspot="${s.id}" onclick="tapVillageSpot('${v.id}','${s.id}')">
      <span class="vil-pin-ic">${open ? s.emoji : '🔒'}</span>
      <span class="vil-pin-nm">${N(s.id, s.name)}</span>
      ${open && s.npc && asksNew(s.npc) ? '<span class="tab-dot" aria-hidden="true"></span>' : ''}
    </button>`).join('');
  // **마을 설명은 지도 위에 겹쳐 놓지 않는다.** 좁은 화면·영어·2배 확대에서
  // 설명 줄이 길어지면 첫 명판과 겹친다 (검증기가 265px 거울 골짜기에서 잡았다).
  // 지도 바로 위에 띠로 두면 길이가 어떻든 겹칠 수가 없다.
  el.innerHTML = `
    <div class="vil-desc">${N(v.id + '_desc', v.desc)}</div>
    <div class="vil-map ${open ? '' : 'locked'}" data-village-map="${v.id}">
      ${(window.Village ? Village.scene(v) : '')}
      ${pins}
    </div>`;
}

// 건물을 누르면 그 안으로 들어간다 — 거기서 사람을 만난다.
function tapVillageSpot(vid, sid) {
  const v = D.VILLAGES.find(x => x.id === vid);
  const s = v && (v.spots || []).find(x => x.id === sid);
  if (!s) return;
  if (!isVillageOpen(v)) {
    toast(T('village_locked', { name: N(v.id, v.name) }), `.vil-pin[data-vspot="${sid}"]`, null, 'above');
    return;
  }
  villageSpotIn = sid;
  talkIdx = null;
  renderGather();
  window.scrollTo(0, 0);
}
window.tapVillageSpot = tapVillageSpot;

// ── 건물 안 (NPC 를 만나는 화면) ──────────────────────────────
// **아직 사람이 없다.** 배경과 버튼만 있고, 대사는 자리를 채워 두는 문구다.
// 사람이 생기면 여기에 초상화(STORY.md 의 SPEAKERS 표)와 대사 · 키워드가 들어온다.
//
// **「거래」는 기본으로 있고, 없는 곳만 데이터에서 뺀다** (`spot.trade === false`).
// 있는 쪽이 훨씬 많을 것이라 없는 쪽을 적는 편이 표가 짧다 —
// 예: 병영에서 만난 왕자에게는 거래가 없다.
// 대화 중이면 몇 번째 줄인지. null 이면 대화 중이 아니다.
// (화면을 떠나면 처음부터 — 진행이 아니라 인사말이라 저장할 것이 없다)
let talkIdx = null;

function renderVillageSpot(el, v, s) {
  const trade = s.trade !== false;
  const sp = s.npc && D.speaker(s.npc);
  const lines = (sp && D.TALKS[sp.id] && D.TALKS[sp.id].lines) || [];
  const moods = (sp && D.TALKS[sp.id] && D.TALKS[sp.id].moods) || [];
  const greetMood = (sp && D.TALKS[sp.id] && D.TALKS[sp.id].greetMood) || 'def';
  const talking = talkIdx !== null && lines.length;
  const talk = (sp && D.TALKS[sp.id]) || null;
  // 키워드로 물은 대답이 떠 있으면 **그것이 인사말·대사보다 먼저다** —
  // 방금 누른 것에 답하지 않고 인사말이 그대로 있으면 안 눌린 것처럼 보인다
  const ask = sp ? shownAsk(sp.id) : null;
  // 들어섰을 때는 **인사말**, 대화를 시작하면 대사. 사람이 없으면 빈 자리 문구.
  // 인사말이 없는 사람은 첫 대사로 떨어진다 (없어도 화면이 비지 않게)
  const line = ask ? T(ask.line)
    : (talking ? T(lines[talkIdx])
    : (talk && talk.greet ? T(talk.greet)
    : (lines.length ? T(lines[0]) : T('npc_line_soon'))));
  // 마지막 줄에서는 ▾ 를 지운다 — 더 없는데 계속 있으면 눌러도 안 넘어가는 것처럼 보인다
  const more = !ask && talking && talkIdx < lines.length - 1;
  const dots = (!ask && talking)
    ? `<div class="npc-dots">${lines.map((_, i) =>
        `<span class="npc-dot ${i === talkIdx ? 'on' : ''}"></span>`).join('')}</div>` : '';

  el.innerHTML = `
    <div class="npc-head">
      <button class="btn-back" onclick="leaveSpot()" aria-label="${T('npc_back_map')}">‹</button>
      <span class="npc-place">${s.emoji} ${N(s.id, s.name)}</span>
    </div>
    <div class="npc-bubble ${talking ? 'live' : ''}"
      ${talking ? `onclick="talkNext('${s.id}')" role="button" tabindex="0"` : ''}>
      ${sp ? `<div class="npc-name">${speakerName(sp.id)}${bondHtml(sp.id)}</div>` : ''}
      <div class="npc-line">${line}</div>
      ${dots}
      ${more ? '<span class="npc-more">▾</span>' : ''}
    </div>
    ${sp ? askRowHtml(sp.id) : ''}
    <div class="npc-stage">
      ${(window.Village ? Village.interior(s, v.id) : '')}
      ${sp && window.Portrait
        ? `<div class="npc-figure">${Portrait.bust(Object.assign({}, sp, { name: speakerName(sp.id) }),
             ask ? (ask.mood || 'def') : (talking ? (moods[talkIdx] || 'def') : greetMood), { bare: true })}</div>`
        : ''}
      <div class="npc-acts">
        ${sp && hasBond(sp.id)
          ? `<button class="npc-act" onclick="openGift('${sp.id}')">${T('npc_gift')}</button>`
          : (trade ? `<button class="npc-act" onclick="npcAct('trade','${s.id}')">${T('npc_trade')}</button>` : '')}
        <button class="npc-act main" onclick="npcAct('talk','${s.id}')">${T('npc_talk')}</button>
      </div>
    </div>`;
}

// 말풍선을 누르면 다음 줄. 마지막에서 한 번 더 누르면 대화가 끝난다.
function talkNext(sid) {
  const v = D.VILLAGES.find(x => x.id === villageTab);
  const s = v && (v.spots || []).find(x => x.id === sid);
  const sp = s && s.npc && D.speaker(s.npc);
  const lines = (sp && D.TALKS[sp.id] && D.TALKS[sp.id].lines) || [];
  if (!lines.length) return;
  // 대사를 넘기기 시작하면 키워드 대답은 물러난다 — 둘이 같은 말풍선을 쓴다
  const wasAsk = !!(sp && shownAsk(sp.id));
  clearAsk();
  talkIdx = wasAsk ? 0 : ((talkIdx === null || talkIdx >= lines.length - 1) ? null : talkIdx + 1);
  renderGather();
}
window.talkNext = talkNext;

function npcAct(kind, sid) {
  if (kind === 'talk') {
    const v = D.VILLAGES.find(x => x.id === villageTab);
    const s = v && (v.spots || []).find(x => x.id === sid);
    const sp = s && s.npc && D.speaker(s.npc);
    const lines = (sp && D.TALKS[sp.id] && D.TALKS[sp.id].lines) || [];
    if (!lines.length) { toast(T('npc_talk_soon'), '.npc-act.main', null, 'above'); return; }
    clearAsk();
    talkIdx = 0;
    renderGather();
    return;
  }
  toast(T('npc_trade_soon'), '.npc-act:not(.main)', null, 'above');
}
window.npcAct = npcAct;

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
  const view = slotView();
  for (let i = 0; i < n; i++) {
    const cell = view[i];
    // 원 위에 고르게 배치 (위쪽부터 시계 방향)
    const ang = -Math.PI / 2 + i * 2 * Math.PI / n;
    const rx = 50 + Math.cos(ang) * radius, ry = 50 + Math.sin(ang) * radius;
    const pos = `left:${rx.toFixed(1)}%;top:${ry.toFixed(1)}%`;
    if (cell && cell.ghost) {
      // 고른 레시피가 요구하는데 가방에 없는 재료 — 회색으로 자리만 잡아 둔다.
      // **✕ 를 달지 않는다** (뺄 것이 없다). 누르면 무엇이 모자란지 알려 준다.
      slotsHtml += `<div class="c-slot lack${isMeltItem(cell.id) ? ' pet' : ''}" style="${pos}"
        data-lack="${cell.id}" onclick="lackHint(this)">${itemArt(cell.id)}</div>`;
    } else if (cell) {
      const it = itemOf(cell.id);
      const rare = (it && it.rare) ? ' rare' : '';
      slotsHtml += `<div class="c-slot filled${rare}${isMeltItem(cell.id) ? ' pet' : ''}" style="${pos}"
        onclick="removeFromCauldron(${i})">${itemArt(cell.id)}<span class="c-slot-x">✕</span></div>`;
    } else {
      slotsHtml += `<div class="c-slot empty" style="${pos}">+</div>`;
    }
  }
  slots.innerHTML = slotsHtml;

  // 조합 비용 표시
  const bc = document.getElementById('brewCost');
  if (bc) bc.textContent = `⚡${D.ENERGY.cost.brew}`;

  // 인벤토리 (재료 + **녹일 수 있는 크리처**)
  //
  // 크리처를 뒤에 이어 붙인다 — 솥에 넣는 것이 같으니 고르는 자리도 같아야 한다.
  // 따로 칸을 만들면 「상급 조합에 크리처가 들어간다」를 레시피 줄에서 보고도
  // 어디서 집는지 못 찾는다 (실제로 재료·물약을 다른 칸에 두면 늘 그렇게 된다)
  const invEl = document.getElementById('ingredientBag');
  const ids = Object.keys(S.inventory);
  const melts = [...new Set(S.creatures)].filter(id => meltCount(id) > 0 && creatureOf(id));
  if (ids.length === 0 && melts.length === 0) {
    invEl.innerHTML = `<div class="empty-hint">채집으로 재료를 모아보세요 🌿</div>`;
  } else {
    const chip = (id, art, cls) => {
      const inCauldron = S.cauldron.filter(x => x === id).length;
      const avail = stockOf(id) - inCauldron;
      return `
        <div class="ing-chip ${cls} ${avail <= 0 ? 'disabled' : ''}" onclick="addToCauldron('${id}')">
          <span class="ing-emoji">${art}</span>
          <span class="ing-name">${itemName(id)}</span>
          <span class="ing-count">×${avail}</span>
        </div>`;
    };
    invEl.innerHTML = ids.map(id => chip(id, D.INGREDIENTS[id].emoji, '')).join('')
      + melts.map(id => chip(id, itemArt(id, 26), 'pet')).join('');
  }

  // 채집 가방 접힘/펼침 상태 반영
  const bagCount = document.getElementById('bagCount');
  const kinds = ids.length + melts.length;
  if (bagCount) bagCount.textContent = kinds ? T('bag_kinds', { n: kinds }) : T('bag_empty');
  applyBagState();

  // 레시피 북 — 카테고리 탭 + 해당 카테고리 목록
  // 윗단 — 물약 / 크리처. 마이 룸 인벤토리와 같은 세그먼트 모양이라 라벨도 같은 것을 쓴다
  const kindEl = document.getElementById('recipeKinds');
  if (kindEl) {
    kindEl.innerHTML = [['potion', 'stuff_potions'], ['creature', 'room_creatures']].map(([k, key]) =>
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
  // 알아낸 레시피를 위로 (방금 알아낸 것이 가장 위), 모르는 것은 아래로
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
  // 지금 솥에 담아 둔 레시피 — 그 줄을 골라 둔 것으로 표시한다.
  // 재료 목록이 곧 열쇠다 (같은 조합의 레시피는 둘 있을 수 없다)
  const wantKey = (S.want && S.want.length) ? D.recipeKey(S.want) : '';
  bookEl.innerHTML = catRecipes.map(r => {
    const found = S.discovered.includes(r.result.id);
    // 재료 이모지 하나하나가 **누를 수 있는 것**이다 — 눌러야 이름을 알 수 있다.
    // 줄 자체도 누르는 것이라(솥에 담기) stopPropagation 으로 갈라 놓는다
    const inputs = r.inputs.map(id =>
      `<button class="ing-dot${isMeltItem(id) ? ' pet' : ''}"
        onclick="event.stopPropagation();ingHint('${id}',this)"
        aria-label="${itemName(id)}">${itemArt(id, 22)}</button>`
    ).join('<span class="ing-plus">+</span>');
    if (found) {
      // 재료가 다 있어야 담을 수 있다. 모자라면 회색으로 두고, 눌렀을 때 이유를 알려 준다
      const ready = hasAllInputs(r);
      const picked = wantKey && D.recipeKey(r.inputs) === wantKey;
      // 📖 — 비법서의 그 장을 펼친다 (재료 ×수량 · 어느 맵 · 열렸는지 · 언제 · 누구와).
      // **줄 자체는 솥에 담는 것**이라 `stopPropagation` 으로 갈라 놓는다
      return `<div class="recipe-row clickable ${ready ? '' : 'short'} ${picked ? 'on' : ''} ${r.result.id === lastFound ? 'just-found' : ''}"
        data-recipe="${r.result.id}" onclick="fillFromRecipe('${r.result.id}', this)">
        <span class="recipe-in">${inputs}</span>
        <span class="recipe-arrow">→</span>
        <span class="recipe-out">${resultArt(r.result, 22)} ${N(r.result.id, r.result.name)}</span>
        <button class="recipe-page" onclick="event.stopPropagation();openPage('${r.result.id}')"
          aria-label="${T('pg_open')}">📖</button>
      </div>`;
    }
    // **아직 장이 없는 레시피.** 물음표 개수가 곧 재료 개수다 — 몇 가지가 드는지는
    // 알려 줘도 되는 정보이고, 그래야 어떤 솥이 필요한지 가늠할 수 있다.
    // 이제 이 줄의 뜻은 「알아내라」가 아니라 **「이 장을 구해라」**다
    const marks = r.inputs.map(() => '?').join(' + ');
    return `<div class="recipe-row locked" data-unknown="${r.result.id}"
      onclick="unknownRecipeHint(this)">
      <span class="recipe-in">${marks}</span>
      <span class="recipe-arrow">→</span>
      <span class="recipe-out">❓</span>
    </div>`;
  }).join('');
  // 진행도 — 이제 「가진 장 / 그 등급의 장 수」다
  const catFound = catRecipes.filter(r => hasPage(r.result.id)).length;
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
  // 아바타에는 안 나온다 (원래 색으로 떨어진다).
  // **입고 있는 칸을 돈다** — 염색은 옷에 붙어 있으므로, 안 입은 옷의 색은 볼 이유가 없다
  Object.keys(S.outfit || {}).forEach(slot => {
    const hex = slotColor(slot);
    if (hex) colors[slot] = hex;
  });
  return Object.assign({}, S.outfit, { colors });
}

// ─── 마이 룸 배경 ────────────────────────────────────────────
//
// 스탯을 접으면(.lite) 그 자리는 테두리 없는 글자 한 줄뿐이라 **앱 배경이 그대로 드러난다.**
// 방 그림을 그만큼 아래로 늘여 글자가 방 바닥 위에 앉게 한다.
//
// **CSS 로 상자만 늘이면 안 된다.** 그림은 `preserveAspectRatio="…slice"` 라 상자가
// 세로로 길어지면 확대율이 올라가 **좌우가 잘린다** — 창문과 선반이 화면 밖으로 나간다.
// 그래서 늘일 픽셀을 viewBox 단위로 환산해 `roomScene` 에 넘기고, 그림이 **바닥을 진짜로
// 더 그리게** 한다. 확대율이 그대로라 좌우 잘림도 그대로다.
// 아래로 늘이는 양 (px). 「스탯 자세히 보기」 **글자 아래까지** 덮어야 해서
// 스탯 덩어리 높이(접었을 때)보다 조금 더 준다. 다만 인벤토리 카드는 침범하면 안 된다 —
// 둘 다 checkui 의 「방 배경 늘이기」가 잰다
const ROOM_BLEED = 78;
const SCENE_INSET = { x: 16, top: 14, bottom: 8 };     // .room-scene 이 .char-stage 밖으로 나간 만큼
const STAGE_H = 320;                                   // .char-aura 의 높이
// ↑ 셋 다 style.css 의 값과 짝이다. 한쪽만 고치면 이음매가 어긋난다.

function roomPadBottom(bleed) {
  if (!bleed) return 0;
  const canvas = document.querySelector('.room-canvas');
  const w = (canvas ? canvas.clientWidth : 360) + SCENE_INSET.x * 2;
  const h = STAGE_H + SCENE_INSET.top + SCENE_INSET.bottom;
  const scale = Math.max(w / 400, h / 320);            // slice — 상자를 덮는 쪽 배율
  // 늘어난 픽셀을 **그 배율 그대로** viewBox 단위로 바꾼다. 이렇게 잡으면 확대율도,
  // 이미 잘려 있던 좌우·위도 그대로라 **그림이 한 칸도 안 움직인다.**
  // (상자 높이로 되짚어 계산하면 폭이 넓은 화면에서 그림이 40px 쯤 미끄러진다)
  return Math.max(0, Math.round(bleed / scale));
}

// 방에 놓는 애착 크리처 한 마리. **어디에 있느냐(`move`)로 세 갈래다.**
//   ground 네 발로 선다 · air 떠 있다 · water **어항에 들어간다**
//
// 어항은 방 배경(roomScene)이 아니라 **여기서 크리처와 같은 상자 안에** 그린다 —
// 배경은 `preserveAspectRatio="…slice"` 라 창 비율에 따라 확대·잘림이 달라져서
// 배경에 그리면 비율이 바뀔 때 물고기가 어항 밖으로 새어 나간다 (creature.js 참고)
function petStage(pet) {
  if (!pet || !window.Creature) return '';
  if (pet.move === 'water') {
    const b = Creature.bowl();
    // 어항 안에서는 바닥 그림자를 뺀다 — 물속에 그림자가 깔리면 유리 위에 앉은 것처럼 보인다
    return `<span class="stage-creature cr-water">${b.back}`
      + `<span class="cr-swim">${Creature.draw(pet, { flat: true, noShadow: true })}</span>`
      + `${b.front}</span>`;
  }
  return `<span class="stage-creature ${pet.move === 'air' ? 'cr-air' : 'cr-ground'}">`
    + `${Creature.draw(pet, { flat: true })}</span>`;
}

function renderRoomScene() {
  const scene = document.querySelector('.room-scene');
  if (!scene || !window.Avatar || !window.Avatar.roomScene) return;
  const bleed = statsLite() ? ROOM_BLEED : 0;
  const canvas = document.querySelector('.room-canvas');
  if (canvas) {
    canvas.classList.toggle('bleed', !!bleed);
    canvas.style.setProperty('--room-bleed', bleed + 'px');
  }
  scene.innerHTML = window.Avatar.roomScene(S.roomLevel, null, roomPadBottom(bleed));
}

function renderShowcase() {
  const total = totalCharm();
  const tier = D.getTier(total);

  // 아바타(내 캐릭터) + **애착 크리처 한 마리.**
  // 예전에는 가진 것 전부(최대 넷)를 늘어놓았는데, 이제 방에 있는 것은 고른 한 마리다
  const stage = document.getElementById('charStage');
  const pet = roomPet();
  const petArt = (pet && window.Creature)
    ? petStage(pet) : '';
  const avatarSvg = roomFigure(tier);
  stage.innerHTML = `
    <div class="room-scene"></div>
    <div class="char-aura" style="--glow:${Math.min(total, 100)}">
      <div class="char-body">${avatarSvg}</div>
      <div id="slimFx" class="slim-fx"></div>
      <div class="stage-creatures">${petArt}</div>
    </div>`;
  renderRoomScene();   // 배경은 스탯이 접혔는지에 따라 아래로 더 그려진다
  // 물약을 마신 직후면 살 빠지는 연출을 이어서 재생
  if (pendingSlimFx) { const lv = pendingSlimFx; pendingSlimFx = null; playSlimFx(lv); }

  // 옷장
  renderWardrobe();

  // 하위 탭(옷/잡화/크리처) 표시 상태 반영
  updateRoomTabs();
  updateStuffTabs();

  // 제목 — "'이름'의 룸" (이름이 아직 없으면 기본 문구)
  const titleEl = document.getElementById('roomTitle');
  if (titleEl) titleEl.textContent = S.name ? T('screen_room_named', { name: S.name }) : T('screen_room');

  // 신체 · 아우라 상세 수치
  renderVitals();
  renderBodyState();
  renderActBadges();

  // 스탯을 접었는지 펼쳤는지 (이 기기의 화면 설정)
  applyStatsView();

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

  renderFoods();
  renderFeeds();

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

  renderCreatures();
}

// ─── 크리처 도감 ────────────────────────────────────────────
// **가진 것만 보여 주면 도감이 아니다.** 못 가진 것도 `❓` 로 자리를 남겨야
// 「무엇이 더 있는지」가 보이고, 속성 탭도 그제야 쓸모가 생긴다 —
// 가진 것만 있으면 처음에는 모든 탭이 비어 있다.
let creatureTab = 'all';
function setCreatureTab(k) { creatureTab = k; renderCreatures(); }
window.setCreatureTab = setCreatureTab;

function renderCreatures() {
  const tabsEl = document.getElementById('creatureTabs');
  const colEl = document.getElementById('creatureCollection');
  if (!colEl) return;

  const all = D.RECIPES.filter(r => r.result.kind === 'creature').map(r => r.result);
  const counts = {};
  S.creatures.forEach(c => counts[c] = (counts[c] || 0) + 1);
  const owned = (id) => (counts[id] || 0) > 0;

  // ── 속성 탭. **글자로 적는다** (이모지 아님 — CREATURE.md 2장).
  //
  // ⚠️ **탭에 「5/30」을 같이 적으면 안 된다.** 칸 폭이 두 배가 되어
  // 265px 영어에서 **네 줄**이 됐다 — 탭 줄이 화면의 3분의 1을 먹는다.
  // 가진 수는 아래 한 줄에 **지금 탭 것만** 적는다 (일곱 번 셀 필요가 없다).
  if (tabsEl) {
    const tabs = [{ k: 'all', name: T('cr_all') }]
      .concat(D.CREATURE_ATTRS.map(a => ({ k: a.k, name: N(a.id, a.name) })));
    tabsEl.innerHTML = tabs.map(t =>
      `<button class="cat-tab${creatureTab === t.k ? ' active' : ''}"
        data-cr-tab="${t.k}" onclick="setCreatureTab('${t.k}')">${t.name}</button>`).join('');
  }

  const list = creatureTab === 'all' ? all : all.filter(c => c.attr === creatureTab);
  const countEl = document.getElementById('creatureCount');
  if (countEl) countEl.textContent = T('cr_count', { n: list.filter(c => owned(c.id)).length, m: list.length });
  const on = roomPet();
  colEl.innerHTML = list.map(c => {
    const name = N(c.id, c.name);
    const attr = D.creatureAttr(c.attr);
    const tag = attr ? `<span class="cr-attr" style="--at:${attr.color}">${N(attr.id, attr.name)}</span>` : '';
    // ── 못 가진 것 — 물음표 한 칸. **이름도 안 알려 준다** (레시피 북과 같은 규칙)
    if (!owned(c.id)) {
      return `<div class="creature-cell"><div class="creature-card unknown" aria-label="${T('cr_unknown')}">
        <div class="creature-art">❓</div>
        <div class="creature-name">${T('cr_unknown')}</div>
        <div class="creature-eff">${tag}</div>
      </div></div>`;
    }
    // ── 가진 것 — **누르면 마이 룸에 두는 애착 크리처가 된다.**
    // 블럭 하나가 곧 버튼이다. 해제 버튼은 따로 없다 — 다른 것을 누르면 그것으로 바뀐다
    const cur = on && on.id === c.id;
    const lv = loyaltyOf(c.id);
    const left = buffLeft(c.id);
    // **먹이 버튼은 카드 밖에 둔다.** 카드가 곧 `<button>` 이라 그 안에 또 버튼을 넣으면
    // 겹친 버튼이 되어 어느 쪽이 눌리는지 브라우저마다 다르다
    return `<div class="creature-cell">
      <button class="creature-card${cur ? ' on' : ''}" data-cr="${c.id}"
      aria-pressed="${cur}" aria-label="${T('pet_pick', { name })}"
      onclick="setRoomPet('${c.id}')">
      <div class="creature-art">${window.Creature ? Creature.icon(c, 46) : ''}</div>
      <div class="creature-name">${name}</div>
      <div class="creature-eff">${tag}💖+${c.charmBonus}</div>
      <div class="cr-loyal" aria-label="${T('loyal_of', { n: lv })}">🦴${lv}<span class="cr-drop">×${D.loyaltyBonus(lv)}</span></div>
      ${counts[c.id] > 1 ? `<div class="creature-count">×${counts[c.id]}</div>` : ''}
      ${cur ? `<div class="creature-on">${T('pet_on')}</div>` : ''}
      ${left > 0 ? `<div class="cr-buff">⏳${leftText(left)}</div>` : ''}
      </button>
      <button class="cr-feed" aria-label="${T('feed_open', { name })}"
        onclick="openFeed('${c.id}')">🦴</button>
    </div>`;
  }).join('');
}

// 남은 시간 — 한 시간이 안 남았으면 분으로 적는다. 「0시간」은 끝난 것처럼 읽힌다
function leftText(ms) {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? T('left_h', { n: Math.floor(m / 60) }) : T('left_m', { n: m });
}

// ─── 먹이주기 팝업 ───────────────────────────────────────────
// 크리처 고르기 → 먹이 종류 → 수량. 셋을 **한 화면에** 둔다 —
// 단계를 나누면 「뒤로」가 필요해지고, 세 번 눌러야 한 번 먹인다
let feedPet = null, feedKind = null, feedQty = 1;
function openFeed(petId) {
  const owned = [...new Set(S.creatures)].filter(ownsCreature);
  if (!owned.length) { toast(T('feed_no_pet')); return; }
  feedPet = ownsCreature(petId) ? petId : owned[0];
  // 가진 먹이 중 첫 번째를 미리 골라 둔다 — 아무것도 안 골라 두면 「먹이기」가 죽어 보인다
  const have = D.FEEDS.filter(f => feedCount(f.id) > 0);
  feedKind = have.length ? have[0].id : null;
  feedQty = 1;
  const m = document.getElementById('feedPick');
  if (m) m.classList.add('show');
  renderFeedPick();
}
window.openFeed = openFeed;
function closeFeed() {
  const m = document.getElementById('feedPick');
  if (m) m.classList.remove('show');
}
window.closeFeed = closeFeed;
function setFeedPet(id) { if (ownsCreature(id)) { feedPet = id; renderFeedPick(); } }
window.setFeedPet = setFeedPet;
function setFeedKind(id) {
  if (feedCount(id) <= 0) return;
  feedKind = id;
  feedQty = Math.min(feedQty, feedCount(id));
  renderFeedPick();
}
window.setFeedKind = setFeedKind;
function setFeedQty(n) {
  const max = feedKind ? feedCount(feedKind) : 1;
  feedQty = Math.max(1, Math.min(max, n));
  renderFeedPick();
}
window.setFeedQty = setFeedQty;

function renderFeedPick() {
  const titleEl = document.getElementById('feedTitle');
  const petEl = document.getElementById('feedPick-pets');
  const listEl = document.getElementById('feedList');
  const qtyEl = document.getElementById('feedQty');
  const goEl = document.getElementById('feedGo');
  if (!petEl || !listEl) return;
  if (titleEl) titleEl.textContent = T('feed_title');

  const owned = [...new Set(S.creatures)].filter(ownsCreature);
  petEl.innerHTML = owned.map(id => {
    const c = creatureOf(id);
    const on = id === feedPet;
    return `<button class="feed-pet${on ? ' on' : ''}" onclick="setFeedPet('${id}')"
      aria-pressed="${on}" aria-label="${N(c.id, c.name)}">
      <span class="feed-pet-art">${window.Creature ? Creature.icon(c, 30) : ''}</span>
    </button>`;
  }).join('');

  const pet = creatureOf(feedPet);
  const lv = loyaltyOf(feedPet);
  const left = buffLeft(feedPet);
  const nameEl = document.getElementById('feedPetName');
  if (nameEl) {
    nameEl.innerHTML = `${pet ? N(pet.id, pet.name) : ''}`
      + `<span class="feed-lv">🦴${lv}/${D.LOYALTY_MAX} · ${T('feed_drop', { n: D.loyaltyBonus(lv) })}</span>`
      + (left > 0 ? `<span class="feed-buff">⏳${leftText(left)}</span>` : '');
  }

  const have = D.FEEDS.filter(f => feedCount(f.id) > 0);
  if (!have.length) {
    listEl.innerHTML = `<div class="empty-hint clickable" onclick="closeFeed(); switchTab('gather')">${T('empty_feeds')}</div>`;
    if (qtyEl) qtyEl.innerHTML = '';
    if (goEl) goEl.hidden = true;
    return;
  }
  if (goEl) goEl.hidden = false;
  listEl.innerHTML = have.map(f => {
    const on = f.id === feedKind;
    return `<button class="feed-item${on ? ' on' : ''}" onclick="setFeedKind('${f.id}')" aria-pressed="${on}">
      <span class="feed-emoji">${f.emoji}</span>
      <span class="feed-name">${N(f.id, f.name)}</span>
      <span class="feed-eff">🦴+${f.loyalty} · ⏳${T('left_h', { n: f.hours })}</span>
      <span class="feed-n">×${feedCount(f.id)}</span>
    </button>`;
  }).join('');

  const f = feedOf(feedKind);
  const max = f ? feedCount(f.id) : 1;
  if (qtyEl) {
    qtyEl.innerHTML = `
      <button class="qty-btn" onclick="setFeedQty(${feedQty - 1})" aria-label="−">−</button>
      <span class="qty-n">${feedQty}</span>
      <button class="qty-btn" onclick="setFeedQty(${feedQty + 1})" aria-label="+">+</button>
      <button class="qty-all" onclick="setFeedQty(${max})">${T('feed_all')}</button>`;
  }
  if (goEl) {
    // **먹여도 로열티가 안 오르는 경우를 미리 알린다** (이미 가득). 버프는 그래도 걸린다
    const gain = f ? Math.min(D.LOYALTY_MAX - lv, f.loyalty * feedQty) : 0;
    goEl.textContent = T('feed_go', { n: gain });
  }
}

// 실제로 먹인다
function doFeed() {
  const f = feedOf(feedKind), pet = creatureOf(feedPet);
  if (!f || !pet) return;
  const n = Math.min(feedQty, feedCount(f.id));
  if (n <= 0) return;
  S.feeds[f.id] -= n;
  if (S.feeds[f.id] <= 0) delete S.feeds[f.id];
  const p = petState(feedPet);
  const before = p.loyalty || 0;
  p.loyalty = Math.min(D.LOYALTY_MAX, before + f.loyalty * n);
  // **버프는 이어 붙이지 않고 「지금부터 다시」다.** 쌓이면 사탕을 몰아 먹여
  // 하루짜리 버프를 만들 수 있는데, 그러면 「나가기 직전에 먹인다」가 사라진다
  p.buffEnd = nowDate().getTime() + f.hours * 3600e3;
  rec('fed', n);
  save();
  const nm = N(pet.id, pet.name);
  const gain = p.loyalty - before;
  toast(T('feed_done', {
    emoji: f.emoji, name: nm, josa: josa(nm, '이가'),
    n: gain, drop: D.loyaltyBonus(p.loyalty), h: leftText(f.hours * 3600e3),
  }), null, 3200);
  if (window.Sfx) Sfx.play('success');
  feedQty = 1;
  renderFeedPick();
  render();
}
window.doFeed = doFeed;

// 애착 크리처를 바꾼다.
// **같은 것을 다시 누르면 아무 일도 안 일어난다** — 안 바뀌었는데 「교체되었어요」가
// 뜨면 거짓말이고, 해제할 방법을 찾다가 같은 것을 누른 사람에게는 더 헷갈린다
function setRoomPet(id) {
  if (!ownsCreature(id)) return;
  if (S.petRoom === id) return;
  const before = roomPet();
  S.petRoom = id;
  const now = creatureOf(id);
  const name = N(now.id, now.name);
  toast(before
    ? T('pet_swap', { from: N(before.id, before.name), to: name, josa: josa(name, '으로') })
    : T('pet_set', { name, josa: josa(name, '을를') }));
  save();
  render();
  // 매력이 달라졌으므로 새로 열린 맵이 있는지 본다 (물약을 마셨을 때와 같다)
  checkUnlocks();
}
window.setRoomPet = setRoomPet;

// ─── 동행 고르기 ────────────────────────────────────────────
// 탐험 화면 위쪽 한 줄을 누르면 시트가 뜬다. **가진 것만** 나온다 —
// 여기는 고르는 곳이지 보는 곳이 아니다 (못 가진 것을 보는 곳은 도감이다)
function renderPalRow() {
  const el = document.getElementById('palRow');
  if (!el) return;
  const pet = fieldPet();
  const attr = pet && D.creatureAttr(pet.attr);
  const nm = pet ? N(pet.id, pet.name) : '';
  el.innerHTML = pet
    ? `<span class="pal-art">${window.Creature ? Creature.icon(pet, 30) : ''}</span>
       <span class="pal-name">${T('pal_row', { name: nm, josa: josa(nm, '과와') })}</span>
       ${attr ? `<span class="cr-attr" style="--at:${attr.color}">${N(attr.id, attr.name)}</span>` : ''}`
    : `<span class="pal-name pal-off">${T('pal_row_none')}</span>`;
  el.setAttribute('aria-label', T('pal_pick_title'));
}

function openPalPick() {
  const el = document.getElementById('palPick');
  if (!el) return;
  const t = document.getElementById('palPickTitle');
  if (t) t.textContent = T('pal_pick_title');
  const list = document.getElementById('palPickList');
  if (list) {
    // 가진 것만. 중복은 한 줄로 묶는다 — 데려가는 것은 어차피 한 마리다
    const ids = [...new Set(S.creatures)].filter(id => creatureOf(id));
    if (!ids.length) {
      list.innerHTML = `<div class="empty-hint">${T('pal_empty')}</div>`;
    } else {
      const cur = S.petField;
      // 「안 데려감」을 맨 위에 둔다 — 되돌릴 길이 늘 첫 칸에 있어야 한다
      const none = `<button class="pal-item${!cur ? ' on' : ''}" onclick="setFieldPet(null)">
        <span class="pal-art">🚶</span><span class="pal-name">${T('pal_none')}</span></button>`;
      list.innerHTML = none + ids.map(id => {
        const c = creatureOf(id);
        const attr = D.creatureAttr(c.attr);
        return `<button class="pal-item${cur === id ? ' on' : ''}" onclick="setFieldPet('${id}')">
          <span class="pal-art">${window.Creature ? Creature.icon(c, 34) : ''}</span>
          <span class="pal-name">${N(c.id, c.name)}</span>
          ${attr ? `<span class="cr-attr" style="--at:${attr.color}">${N(attr.id, attr.name)}</span>` : ''}
        </button>`;
      }).join('');
    }
  }
  el.classList.add('show');
}
window.openPalPick = openPalPick;

function closePalPick() {
  const el = document.getElementById('palPick');
  if (el) el.classList.remove('show');
}
window.closePalPick = closePalPick;

function setFieldPet(id) {
  if (id && !ownsCreature(id)) return;
  S.petField = id || null;
  const c = id ? creatureOf(id) : null;
  const name = c ? N(c.id, c.name) : '';
  toast(c ? T('pal_set', { name, josa: josa(name, '을를') }) : T('pal_off'));
  save();
  closePalPick();
  render();
}
window.setFieldPet = setFieldPet;

// ─── 스탯 간단히 / 자세히 ────────────────────────────────────
//
// 마이 룸의 능력치 덩어리는 세로를 많이 먹는다 — 늘 보고 싶은 것은 **단계와 매력 총합**
// 둘뿐이라, 접으면 그 둘만 **테두리 없이** 남기고 나머지(신체·아우라·기록·과시)를 감춘다.
//
// **세이브에 넣지 않는다.** 진행이 아니라 이 기기에서 화면을 어떻게 볼지의 문제라,
// 개발용 블록의 접힘 상태와 같은 자리에 둔다 (SAVE_VER 를 건드릴 이유가 없다).
const STATS_LITE_KEY = 'dieter_alchemist_statslite_v1';
function statsLite() {
  try { return localStorage.getItem(STATS_LITE_KEY) === '1'; } catch (e) { return false; }
}
function applyStatsView() {
  const box = document.getElementById('roomStats');
  const btn = document.getElementById('statsToggle');
  if (!box || !btn) return;
  const lite = statsLite();
  box.classList.toggle('lite', lite);
  // 접으면 글자가 카드가 아니라 **방 배경 위**에 앉는다 (renderRoomScene 이 배경을 내려 준다).
  // 그림 위 글자의 가독성은 대비로 못 재므로 공통 규칙인 `.on-room-bg`(흰 글자 + 퍼지는 음영)를
  // 그대로 쓴다 — a11y.js 가 이 클래스를 보고 음영 겹수·불투명도를 대신 검사한다
  box.classList.toggle('on-room-bg', lite);
  // 화살표는 **여는 쪽**을 가리킨다 — 접혀 있으면 아래(펼침), 펼쳐져 있으면 위(접힘)
  btn.textContent = (lite ? '▾ ' : '▴ ') + T(lite ? 'stats_more' : 'stats_less');
  btn.setAttribute('aria-expanded', lite ? 'false' : 'true');
}
function toggleStats() {
  try { localStorage.setItem(STATS_LITE_KEY, statsLite() ? '0' : '1'); } catch (e) {}
  applyStatsView();
  renderRoomScene();
}
window.toggleStats = toggleStats;

// ─── 나의 방 하위 탭 (옷 / 물약 / 크리처) ───
let roomTab = 'clothes';
// 튜토리얼을 마치기 전에는 크리처 칸이 잠긴다.
// (아직 공주가 방에 막 들어온 참이라 크리처를 모을 단계가 아니다)
function isRoomTabOpen(t) { return t !== 'creatures' || !!S.tutorialDone; }

// 잡화 안의 하위 탭 (물약 / 음식). **이 기기의 화면 상태라 세이브에 안 넣는다** —
// 옷장의 슬롯 탭(wardrobeTab)과 같은 자리다
let stuffTab = 'potions';
function setStuffTab(t) {
  stuffTab = t;
  updateStuffTabs();
}
window.setStuffTab = setStuffTab;
function updateStuffTabs() {
  document.querySelectorAll('.stuff-tabs .cat-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.stuff === stuffTab));
  document.querySelectorAll('.stuff-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'stuffPanel-' + stuffTab));
}

function setRoomTab(t, anchor) {
  if (!isRoomTabOpen(t)) { toast(T('locked_tutorial'), anchor); return; }
  roomTab = t; updateRoomTabs();
  if (window.Tut) Tut.fire('rtab:' + t);
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
function isMapOpen(m)  { return devFlag(DEV_MAPS_KEY) || charmPeak() >= m.unlock; }
function isZoneOpen(z) { return devFlag(DEV_MAPS_KEY) || charmPeak() >= D.zoneUnlock(z.id); }
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
  // 구멍이 줄어들면 넘치는 재료는 가방으로 되돌린다.
  // 손으로 솥을 바꾼 것이므로 레시피 선택도 놓는다 (구멍 수가 안 맞을 수 있다)
  S.want = [];
  while (S.cauldron.length > c.slots) S.cauldron.pop();
  save(); render();
  // 위와 같은 이유 — 솥 탭도 다시 그려졌다
  const nm = N(c.id, c.name);
  toast(T('cauldron_picked', { name: nm, n: c.slots, josa: josa(nm, '으로') }), `[data-pot="${id}"]`);
}

// 탐험의 세 갈래 (윗단) — 필드 / 마을 / 밭 (밭은 여신 단계부터 · `FARM.md` 2단계).
// **세이브에 넣지 않는다.** 지대·옷장 탭과 같이 화면을 열 때마다 처음 자리에서
// 시작하는 값이라, 저장하면 마이그레이션만 늘고 얻는 것이 없다
let gatherTab = 'field';
function setGatherTab(t) {
  gatherTab = t;
  render();
  // **밭에 들어설 때만 서버에 물어본다.** `render()` 마다 부르면 화면을 그릴 때마다
  // 요청이 나간다 (밭은 서버가 정본이라 조회가 곧 정산이기도 하다)
  if (t === 'farm') pullFarm();
}
window.setGatherTab = setGatherTab;

// 지금 보고 있는 마을 (아랫단 탭).
// **탭이 곧 마을 전환이다** — 목록 → 들어가기 → 뒤로 하는 단계를 두지 않는다.
// 마을은 셋뿐이고 탭 줄이 이미 그 셋을 다 보여 주므로, 한 단을 더 두면
// 같은 것을 두 번 고르게 하는 셈이 된다.
let villageTab = D.VILLAGES[0].id;
// 지금 들어가 있는 **건물**. null 이면 마을 지도다 (탭 상태와 같이 저장하지 않는다)
let villageSpotIn = null;
function setVillage(id) { villageTab = id; villageSpotIn = null; talkIdx = null; clearAsk(); renderGather(); }
window.setVillage = setVillage;
function leaveSpot() { villageSpotIn = null; talkIdx = null; clearAsk(); renderGather(); }
window.leaveSpot = leaveSpot;
// 잠긴 마을 카드를 눌렀을 때 — 조건이 정해지면 여기서 조건을 안내한다
function villageInfo(id, el) {
  const v = D.VILLAGES.find(x => x.id === id);
  if (v) toast(T('village_locked', { name: N(v.id, v.name) }), el);
}
window.villageInfo = villageInfo;

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

function equip(slot, id, el) {
  const it = (D.WARDROBE[slot] || []).find(x => x.id === id);
  if (!it) return;
  const name = N(it.id, it.name);
  // 칸에 이름이 없으므로 **누른 자리 옆에** 이름을 띄운다.
  // 요소가 아니라 선택자를 넘긴다 — 아래 renderShowcase() 가 칸을 새로 그려서
  // 이 버튼은 문서에서 떨어져 나가고, 좌표가 0,0 이 되어 왼쪽 위 구석에 뜬다
  const at = `.wr-items .wr-item[aria-label^="${name.replace(/"/g, '')}"]`;
  if (!isOwned(slot, it)) { toast(T('locked_named', { name }), el, null, 'above'); return; }
  // 상·하의를 고르면 원피스는 벗고, 원피스를 고르면 그대로 (렌더에서 상하의 무시)
  if (slot === 'top' || slot === 'bottom') S.outfit.dress = 'dress_none';
  S.outfit[slot] = id;
  save();
  renderShowcase();  // 아바타 + 옷장 동시 갱신
  toast(name, at, null, 'above');
  if (window.Tut) Tut.fire('equip:' + id);
}

// ─── 헤어는 두 칸으로 고른다 (전체 실루엣 × 앞머리) ────────────────
// 30벌을 한 줄에 늘어놓으면 '긴 생머리 시스루뱅' 과 '단발 시스루뱅' 이 서로 무엇이
// 다른지 훑어서는 안 읽힌다. 뒷머리 6 · 앞머리 5 로 나눠 고르면 11칸이면 되고,
// **고른 둘이 만나는 벌**이 실제로 입는 벌이다 — 벌 id 는 그대로라 세이브도 그대로다.
function hairItemNow() {
  const list = D.WARDROBE.hair || [];
  return list.find(x => x.id === S.outfit.hair) || list[0];
}
function hairItemOf(back, bang) {
  return (D.WARDROBE.hair || []).find(x => x.back === back && x.bang === bang);
}

// 축 하나를 갈아 끼운다. 나머지 축은 지금 쓰고 있는 것을 그대로 둔다.
function equipHair(axis, k) {
  const cur = hairItemNow();
  if (!cur) return;
  const it = hairItemOf(axis === 'back' ? k : cur.back, axis === 'bang' ? k : cur.bang);
  if (!it) return;
  const name = N(it.id, it.name);
  // 누른 칸 옆에 띄운다. 요소가 아니라 선택자를 넘기는 이유는 equip() 과 같다 —
  // 아래 renderShowcase() 가 칸을 새로 그려 이 버튼이 문서에서 떨어져 나간다
  const at = `.wr-items[data-axis="${axis}"] .wr-item[data-k="${k}"]`;
  // **잠금은 조합 단위다.** 뒷머리를 바꾸면 앞머리 칸의 잠금도 같이 달라진다 —
  // 가진 것은 어디까지나 '긴 생머리 시스루뱅' 이라는 한 벌이지 '시스루뱅' 이 아니다
  if (!isOwned('hair', it)) { toast(T('locked_named', { name }), at, null, 'above'); return; }
  S.outfit.hair = it.id;
  save();
  renderShowcase();
  toast(name, at, null, 'above');
}
window.equipHair = equipHair;

// 축 한 줄. 칸에 이름을 같이 적는다 — 11칸이라 자리가 있고, 앞머리는 실루엣만으로는
// 구분이 어렵다 (30벌짜리 줄에서 이름을 뺀 것과 다른 상황이다)
function hairAxisRow(axis, list, cur) {
  const items = list.map(ax => {
    const it = hairItemOf(axis === 'back' ? ax.k : cur.back, axis === 'bang' ? ax.k : cur.bang);
    if (!it) return '';
    const on = (axis === 'back' ? cur.back : cur.bang) === ax.k;
    const owned = isOwned('hair', it);
    // 그림은 **고르면 나올 모습 그대로** 그린다: 나머지 축은 지금 쓰는 것을 물려받는다.
    // 색도 그 머리에 물들여 둔 색이다 — 염색은 칸이 아니라 옷에 붙으므로,
    // 다른 머리로 갈아 끼우면 그 머리의 색으로 나온다
    // 앞머리 칸은 이마만 확대한다 — 머리 전체를 담으면 다섯 개가 같은 그림으로 보인다
    const ic = Avatar.hairIcon(it, itemHex(it), axis === 'bang' ? 'face' : null);
    const lock = owned ? '' : '<span class="wr-lock">🔒</span>';
    const name = N(ax.id, ax.name);
    return `<button class="wr-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}" data-k="${ax.k}"
      aria-label="${N(it.id, it.name)}${owned ? '' : ' 🔒'}"${on ? ' aria-current="true"' : ''}
      onclick="equipHair('${axis}','${ax.k}')">
      <span class="wr-ic">${ic}${lock}</span><span class="wr-nm">${name}</span></button>`;
  }).join('');
  return `<div class="wr-items wr-axis" data-axis="${axis}">${items}</div>`;
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

// 그 칸에서 **잠긴 것 중 첫 번째**를 연다. ⚠️ `unlockRandom` 과 달리 `Math.random()` 을
// 안 쓴다 — 보상은 되풀이해도 같은 것이 나와야 검사할 수 있고, 무작위면 「어제 받은 것을
// 오늘 또 받았다」가 생긴다 (날씨·일지와 같은 규칙이다).
// 그 칸이 다 찼으면 조용히 넘어간다 — 재료·결정은 이미 들어갔으니 보상이 빈손은 아니다.
function unlockNextIn(slot) {
  const it = (D.WARDROBE[slot] || []).find(x => !isOwned(slot, x));
  return it ? unlockCosmetic(it.id) : false;
}
window.unlockNextIn = unlockNextIn;

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
    + `<button class="btn btn-dev" onclick="devGiveDyeEver(1000)">♾️ ${T('dev_dye_ever')}</button>`
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
  // 튜토리얼 전에는 가진 것만 보여 주므로(아래) 보유 개수도 적지 않는다 —
  // 한 칸만 놓고 '2/9' 라고 하면 나머지 일곱이 어디 있는지 되묻게 된다
  const showCount = !!S.tutorialDone;
  const tabs = slots.map(m => {
    const dimmed = dressed && (m.slot === 'top' || m.slot === 'bottom');
    const on = wardrobeTab === m.slot;
    const list = D.WARDROBE[m.slot] || [];
    const n = on && m.gated && showCount
      ? `<span class="wr-tab-n">${list.filter(x => isOwned(m.slot, x)).length}/${list.length}</span>` : '';
    return `<button class="cat-tab wr-tab ${on ? 'active' : ''} ${dimmed ? 'dim' : ''}"
      onclick="setWardrobeTab('${m.slot}')"
      aria-label="${N(m.slot, m.label)}${on && m.gated && showCount ? ' · ' + T('wr_owned', { have: list.filter(x => isOwned(m.slot, x)).length, total: list.length }) : ''}"
      >${m.emoji} ${N(m.slot, m.label)}${n}</button>`;
  }).join('');

  // 튜토리얼을 마치기 전에는 **가진 것만** 보여 준다.
  // 인트로가 끝나고 처음 들어온 화면에 잠긴 칸 여덟 개가 늘어서 있으면
  // 무엇을 하라는 화면인지 읽히지 않는다. '없음' 도 뺀다 —
  // 가진 옷이 한 벌뿐이라 벗을 이유가 없고, 눌러도 할 일이 없는 칸이다.
  const onlyMine = !S.tutorialDone;
  const list = (D.WARDROBE[wardrobeTab] || [])
    .filter(it => !onlyMine || (it.kind !== 'none' && isOwned(wardrobeTab, it)));
  const items = list.map(it => {
    const on = S.outfit[wardrobeTab] === it.id;
    const owned = isOwned(wardrobeTab, it);
    let ic;
    if (it.kind === 'none') ic = '🚫';
    // 머리는 이모지 대신 **실루엣을 작게 그려서** 보여 준다 (아바타와 같은 함수라
    // 머리 모양을 고치면 이 그림도 같이 바뀐다). 헤어 칸은 보통 아래 두 줄짜리
    // 축 화면으로 가고, 이 줄은 축 표가 없을 때를 위한 대비다
    else if (wardrobeTab === 'hair' && window.Avatar && Avatar.hairIcon) {
      // 그 머리에 물들여 둔 색으로 그린다 — 염색해 놓고 목록만 브라운이면 무엇을 고르는지 헷갈린다
      ic = Avatar.hairIcon(it, itemHex(it));
    }
    else if (it.emoji) ic = it.emoji;
    // **각자 자기 색으로** 보여 준다. 염색이 옷에 붙으므로 칸마다 색이 다르고,
    // 그래서 목록 전체가 같은 색이 되는 일이 없다 (예전에는 칸에 붙어 있어서
    // 지금 입은 것만 칠했다 — 안 그러면 60벌이 전부 같은 동그라미가 됐다)
    else ic = `<span class="wr-swatch" style="background:${itemHex(it) || '#ccc'}"></span>`;
    const lock = owned ? '' : '<span class="wr-lock">🔒</span>';
    // 이름은 칸에 쓰지 않는다. 30벌짜리 칸에서는 '긴 생머리 시스루뱅' 같은 이름이
    // 세 줄을 넘겨 잘렸고, 글자는 11px 밑으로 못 줄인다 (TEXT_POLICY 1).
    // **눌렀을 때 토스트로 알려 준다** — 그림만 남기니 한 화면에 훨씬 많이 들어간다.
    // aria-label 에는 그대로 넣는다: 화면 낭독기에는 이름이 유일한 단서다
    return `<button class="wr-item ${on ? 'on' : ''} ${owned ? '' : 'locked'}" data-item="${it.id}"
      aria-label="${N(it.id, it.name)}${owned ? '' : ' 🔒'}"${on ? ' aria-current="true"' : ''}
      onclick="equip('${wardrobeTab}','${it.id}',this)">
      <span class="wr-ic">${ic}${lock}</span></button>`;
  }).join('');

  const hint = dressed && (wardrobeTab === 'top' || wardrobeTab === 'bottom')
    ? `<div class="wr-hint">${T('dress_hint')}</div>` : '';

  // 헤어만 한 줄이 아니라 두 줄이다 — 전체 실루엣과 앞머리를 따로 고른다
  let body;
  if (wardrobeTab === 'hair' && window.Avatar && Avatar.hairIcon && D.HAIR_AXES) {
    const cur = hairItemNow();
    body = `<div class="wr-sec">${T('wr_sec_back')}</div>${hairAxisRow('back', D.HAIR_AXES.back, cur)}`
         + `<div class="wr-sec">${T('wr_sec_bang')}</div>${hairAxisRow('bang', D.HAIR_AXES.bang, cur)}`;
  } else {
    body = `<div class="wr-items">${items}</div>`;
  }

  el.innerHTML = `<div class="cat-tabs wr-tabs">${tabs}</div>${hint}${body}`
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

// 지금 그 칸에 입고 있는 옷의 id. **염색은 칸이 아니라 이 id 에 붙는다** —
// 부르는 쪽은 여전히 칸으로 물어보고, 옷으로 옮기는 것은 여기 한 곳에서 한다
function wornId(slot) { const it = wornItem(slot); return it ? it.id : null; }

function dyeLeft(slot) { return itemDyeLeft(wornId(slot)); }
function itemDyeLeft(itemId) {
  const t = itemId && (S.dyeEnd || {})[itemId];
  return t ? t - Date.now() : 0;
}
// 옷이 갖고 태어난 색과 **같은 색이 팔레트에 있으면** 그 색이다.
// 있으면 이름을 알려 줄 수 있고, 팔레트에서는 그 칩을 감춘다 (같은 것이 두 번 나오니까).
function origColor(it) {
  const hex = String((it && it.color) || '').toLowerCase();
  return hex ? D.COLORS.find(c => c.hex.toLowerCase() === hex) : null;
}

// 지금 그 칸에 색이 살아 있는가 — 24시간짜리가 남았거나, 영원 염색약을 썼거나
function dyeActive(slot) {
  const id = wornId(slot);
  return !!(id && (S.dyeForever || {})[id]) || dyeLeft(slot) > 0;
}
// 시간이 다 된 염색을 걷어낸다. 하나라도 걷어냈으면 true (부른 쪽이 저장·다시 그리기)
// **입고 있지 않은 옷도 함께 본다** — 벗어 둔 사이에도 24시간은 흐른다
function expireDye() {
  if (!S.dyeEnd) return false;
  let changed = false;
  Object.keys(S.dyeEnd).forEach(itemId => {
    if (itemDyeLeft(itemId) > 0) return;
    delete S.dyeEnd[itemId];
    if (S.itemColor) delete S.itemColor[itemId];
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

// 지금 그 칸에 **실제로 입혀져 있는 색 id.** 없으면 null.
//
// 두 염색약은 조건이 다르다 — 한 조건으로 묶으면 한쪽이 조용히 안 먹는다.
//  · 마법 염색약 : 팔레트 색을 얻어 뒀고(isColorOwned) 24시간이 남아 있어야 한다
//  · 영원 염색약 : **그 색 염색약 자체가 아이템**이라 팔레트 색을 따로 얻어 둘 필요가 없고,
//                  기한도 없다. applyDye 가 dyeEnd 를 지우고 dyeForever 만 남기기 때문에,
//                  여기서 dyeLeft 만 보면 영원 염색약이 **아예 안 먹는다** (실제로 그랬다 —
//                  칠했다는 토스트는 뜨는데 아바타는 원래 색 그대로였다)
//
// '원래 색'(아이템이 갖고 태어난 색)은 언제나 쓸 수 있다 — 그 옷을 가졌으면 그 색도 가진 것이다.
// 고른 색을 잃었거나(초기화) 마법 염색이 풀렸으면 원래 색으로 떨어진다.
function dyedColorId(slot) { return itemColorId(wornId(slot)); }
function itemColorId(itemId) {
  const id = itemId && (S.itemColor || {})[itemId];
  if (!id) return null;
  if ((S.dyeForever || {})[itemId]) return id;
  return (isColorOwned(id) && itemDyeLeft(itemId) > 0) ? id : null;
}
function slotColor(slot) { return hexOf(dyedColorId(slot)); }
// 그 옷에 **실제로 입혀지는 색.** 염색이 살아 있으면 그 색, 아니면 옷이 갖고 태어난 색
function itemHex(it) { return (it && hexOf(itemColorId(it.id))) || (it && it.color) || null; }
function hexOf(colorId) {
  const c = colorId && D.COLORS.find(x => x.id === colorId);
  return c ? c.hex : null;
}

// 지금 그 칸에 입고 있는 옷
function wornItem(slot) {
  const it = (D.WARDROBE[slot] || []).find(x => x.id === S.outfit[slot]);
  return (it && it.kind !== 'none') ? it : null;
}

// 염색약 쓰기 버튼 — 없으면 열지 않는다
// 컬러칩을 펼쳐 놓은 곳 (한 번에 하나) — '칸:종류' 로 적는다.
// 종류가 둘이라(마법 / 영원) 칸만으로는 어느 줄이 열렸는지 알 수 없다.
let dyeOpen = null;
// 영원 염색약은 색깔별로 있으니, 줄에 적는 '보유' 는 전부 더한 값이다
function everCount(colorId) { return ((S.dyeEver || {})[colorId] | 0); }
function everTotal() { return Object.values(S.dyeEver || {}).reduce((a, b) => a + (b | 0), 0); }
function dyeStock(kind) { return kind === 'ever' ? everTotal() : (S.dye || 0); }
function toggleDye(slot, kind) {
  if (dyeStock(kind) <= 0) { toast(T(kind === 'ever' ? 'dye_ever_none' : 'dye_none')); return; }
  const key = slot + ':' + kind;
  dyeOpen = (dyeOpen === key) ? null : key;
  renderWardrobe();
}
function dyeHelp(kind) { toast(T(kind === 'ever' ? 'dye_ever_help' : 'dye_help'), null, 3600); }
window.toggleDye = toggleDye;
window.dyeHelp = dyeHelp;

function colorRow(slot) {
  if (!D.COLORABLE_SLOTS.includes(slot)) return '';
  const it = wornItem(slot);
  if (!it) return '';                                  // '없음' 을 입었으면 물들일 것이 없다
  // 염색약은 두 가지다 — 24시간짜리 마법 염색약과, 원래 색을 아예 바꾸는 영원 염색약.
  // **줄 전체가 버튼이다.** 글자만 눌리면 어디를 눌러야 하는지 알기 어렵다.
  // 화살표로 열림/닫힘을 알린다 — 눌러도 아무 일이 없어 보이는 순간이 없어야 한다.
  // '?' 는 이 줄 안에 있지만 **따로 동작한다** (stopPropagation) — 안내를 보려다 열리면 안 된다
  const KINDS = [
    { kind: 'magic', ic: '🧪', label: 'dye_use',      help: 'dye_help_label' },
    { kind: 'ever',  ic: '♾️', label: 'dye_ever_use', help: 'dye_ever_help_label' },
  ];
  const bar = (k) => {
    const have = dyeStock(k.kind);
    const on = dyeOpen === slot + ':' + k.kind;
    return `<div class="dye-bar ${have ? '' : 'off'}" role="button" tabindex="0"
      aria-expanded="${on}" aria-label="${T(k.label)}"
      onclick="toggleDye('${slot}','${k.kind}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDye('${slot}','${k.kind}')}">
      <span class="dye-ic" aria-hidden="true">${k.ic}</span>
      <span class="dye-label">${T(k.label)}</span>
      <button class="dye-help" onclick="event.stopPropagation();dyeHelp('${k.kind}')"
        aria-label="${T(k.help)}">?</button>
      <span class="dye-caret" aria-hidden="true">▾</span>
      <span class="dye-have">${T('dye_have', { n: have })}</span>
    </div>`;
  };
  const head = `<div class="dye-bars">${KINDS.map(bar).join('')}</div>`;
  const openKind = dyeOpen && dyeOpen.startsWith(slot + ':') ? dyeOpen.split(':')[1] : null;
  if (!openKind) return head;

  // 지금 무슨 색인지는 아바타에 실제로 입혀진 것과 같은 규칙으로 본다 —
  // 여기만 따로 판정하면 아바타는 물들었는데 이름은 '원래 색' 이라고 적힌다
  const cur = dyedColorId(slot) || '';
  const curName = cur ? N(cur, (D.COLORS.find(x => x.id === cur) || {}).name) : T('wr_color_orig');

  // ─── 영원 염색약 — 색깔마다 따로 있는 **아이템 칸** ───
  // 마법 염색약처럼 60색 팔레트를 펼치지 않는다. 가진 염색약만 네모 칸으로 늘어놓는다:
  // 색이 곧 아이템이라, 안 가진 색을 잠긴 점으로 보여 줄 이유가 없다.
  if (openKind === 'ever') {
    const same0 = origColor(it);     // 원래 색과 같은 것은 굳이 물들일 이유가 없다
    const mine = D.COLORS.filter(c => everCount(c.id) > 0 && (!same0 || c.id !== same0.id));
    const cells = mine.map(c => `<button class="dye-item" onclick="askDye('${slot}','${c.id}','ever')"
        aria-label="${N(c.id, c.name)} ${T('n_ea', { n: everCount(c.id) })}">
        <span class="dye-sw" style="background:${c.hex}"></span>
        <span class="dye-nm">${N(c.id, c.name)}</span>
        <span class="dye-n">×${everCount(c.id).toLocaleString()}</span>
      </button>`).join('');
    // 되돌리기는 염색약을 쓰지 않는다 — 마법 염색약 팔레트와 같은 자리에 같은 뜻으로 둔다
    const back = `<button class="dye-item dye-item-orig" onclick="undye('${slot}',this)"
        aria-label="${origName(it)}">
        <span class="dye-sw" style="background:${it.color || '#ccc'}"></span>
        <span class="dye-nm">${T('wr_color_orig')}</span>
      </button>`;
    return head + `<div class="wr-color-head">
        <span class="wr-color-tt">${T('wr_color')}</span><span class="wr-color-nm">${curName}</span>
      </div><div class="dye-items">${back}${cells}</div>`;
  }

  const same = origColor(it);          // 옷의 원래 색과 같은 팔레트 색 (있으면 칩을 감춘다)
  const owned = D.COLORS.filter(c => isColorOwned(c.id)).length;
  const dots = D.COLORS.filter(c => !same || c.id !== same.id).map(c => {
    const on = cur === c.id;
    const got = isColorOwned(c.id);
    // 잠긴 색은 **채도를 낮추지 않는다.** 색 자체가 내용이라 흐리게 하면 무엇을 얻는지 안 보인다.
    // 대신 불투명도를 낮추고 자물쇠를 얹는다 (색에 기대지 않는 신호 — UI_POLICY 7장)
    return `<button class="wr-color ${on ? 'on' : ''} ${got ? '' : 'locked'}" style="background:${c.hex}"
      onclick="askDye('${slot}','${c.id}','${openKind}')"
      aria-label="${N(c.id, c.name)}${got ? '' : ' 🔒'}"${on ? ' aria-current="true"' : ''}
      >${got ? '' : '<span class="wr-clock">🔒</span>'}</button>`;
  }).join('');
  // 맨 앞은 '원래 색' — 되돌리는 데는 염색약을 쓰지 않는다.
  // 누르면 되돌리면서 **그 색의 이름**을 알려 준다 (색만 보고는 무엇인지 모른다)
  const orig = `<button class="wr-color wr-color-orig ${cur ? '' : 'on'}" style="background:${it.color || '#ccc'}"
    onclick="undye('${slot}',this)" aria-label="${origName(it)}"></button>`;
  return head + `<div class="wr-color-head">
      <span class="wr-color-tt">${T('wr_color')}</span><span class="wr-color-nm">${curName}</span>
    </div><div class="wr-colors">${orig}${dots}</div>
    <div class="wr-color-foot"><span class="wr-color-n">${T('wr_owned', { have: owned, total: D.COLORS.length })}</span></div>`;
}

// 색을 눌렀을 때 — 잠겼으면 막고, 아니면 확인 패널을 띄운다
function askDye(slot, colorId, kind) {
  const c = D.COLORS.find(x => x.id === colorId);
  if (!c) return;
  const ever = kind === 'ever';
  // 마법 염색약은 **색을 획득했는지**를 보고, 영원 염색약은 **그 색 염색약을 가졌는지**를 본다.
  // 영원 염색약은 색이 곧 아이템이라 따로 색을 얻어 둘 필요가 없다.
  if (ever) {
    if (everCount(colorId) <= 0) { toast(T('dye_ever_none_color', { name: N(c.id, c.name) })); return; }
  } else {
    if (!isColorOwned(colorId)) {
      // 어떤 색을 눌렀는지 같이 알려 준다 — 60개가 늘어서 있어 색만으로는 무엇을 눌렀는지 모른다
      toast(T('locked_color', { name: N(c.id, c.name) }));
      return;
    }
    if ((S.dye || 0) <= 0) { toast(T('dye_none')); return; }
  }
  const it = wornItem(slot);
  if (!it) return;
  const item = N(it.id, it.name), color = N(c.id, c.name);
  showConfirm(T(ever ? 'dye_ever_confirm' : 'dye_confirm', { item, color, josa: josa(item, '을를') }),
    () => applyDye(slot, colorId, kind));
}
window.askDye = askDye;

function applyDye(slot, colorId, kind) {
  const ever = kind === 'ever';
  if (ever ? everCount(colorId) <= 0 : (S.dye || 0) <= 0) {
    toast(T(ever ? 'dye_ever_none' : 'dye_none')); return;
  }
  const c = D.COLORS.find(x => x.id === colorId);
  const it = wornItem(slot);
  if (!c || !it) return;
  if (ever) {
    S.dyeEver[colorId] = everCount(colorId) - 1;
    if (S.dyeEver[colorId] <= 0) delete S.dyeEver[colorId];   // 다 쓴 칸은 지운다
  } else S.dye--;
  // **그 옷 한 벌에만 붙는다.** 칸에 붙이면 가진 장갑이 전부 같은 색이 된다
  S.itemColor[it.id] = colorId;
  if (ever) {
    // 영원 염색약 — 만료 시각을 지우고 '영원함' 표시를 남긴다
    S.dyeForever[it.id] = true;
    delete S.dyeEnd[it.id];
  } else {
    delete S.dyeForever[it.id];
    S.dyeEnd[it.id] = Date.now() + DYE_MS;
  }
  dyeOpen = null;        // 다 썼으면 접는다 — 열어 둔 채로 두면 방금 바뀐 아바타가 안 보인다
  save();
  // 색 이름 뒤의 조사는 받침에 따라 달라진다 ('크림으로' / '진주로')
  const cn = N(c.id, c.name);
  toast(T(ever ? 'dye_ever_done' : 'dye_done',
    { item: N(it.id, it.name), color: cn, josa: josa(cn, '으로') }));
  renderShowcase();                  // 아바타 + 옷장 동시 갱신
}

// 원래 색의 이름 — 팔레트에 같은 색이 있으면 그 이름, 없으면 그냥 '원래 색'
function origName(it) {
  const c = origColor(it);
  return c ? N(c.id, c.name) : T('wr_color_orig');
}

// 마법 염색약이 걸려 있을 때의 안내 — 지금 무슨 색인지 / 언제 돌아오는지
function revertMsg(slot, it, left) {
  const c = D.COLORS.find(x => x.id === (S.itemColor || {})[wornId(slot)]);
  const color = c ? N(c.id, c.name) : T('wr_color');
  const h = Math.ceil(left / 3600000);
  const t = h > 1 ? T('dye_left_h', { h }) : T('dye_left_m', { m: Math.max(1, Math.ceil(left / 60000)) });
  const o = origColor(it);
  return o ? T('dye_revert_in', { color, t, orig: N(o.id, o.name) })
           : T('dye_revert_in_plain', { color, t });
}

// 원래 색으로 되돌리기 — 염색약을 쓰지 않는다.
// 누른 자리에 **그 색의 이름**을 띄운다 (색 조각만 보고는 무슨 색인지 모른다)
function undye(slot, el) {
  const it = wornItem(slot);
  // **마법 염색약이 걸려 있으면 되돌리지 않는다.** 그건 24시간이 지나면 저절로 풀리는 것이고,
  // 여기서 지워 버리면 쓴 염색약이 그냥 사라진다. 대신 언제 돌아오는지 알려 준다.
  const left = dyeLeft(slot);
  if (it && left > 0) { toast(revertMsg(slot, it, left), el, 4200); return; }
  const id = it && it.id;
  if (id) {
    delete S.itemColor[id];
    delete S.dyeEnd[id];
    if (S.dyeForever) delete S.dyeForever[id];
  }
  save();
  renderShowcase();
  const c = it && origColor(it);
  toast(c ? T('wr_color_orig_named', { name: N(c.id, c.name) }) : T('wr_color_orig'), el);
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

// 테스트용: 영원 염색약 채우기 — **색깔을 무작위로 골라** n 개를 나눠 담는다.
// (색이 곧 아이템이라 '몇 개' 만으로는 만들 수 없다)
function devGiveDyeEver(n) {
  const total = n || 5;
  for (let i = 0; i < total; i++) {
    const c = D.COLORS[Math.floor(Math.random() * D.COLORS.length)];
    S.dyeEver[c.id] = everCount(c.id) + 1;
  }
  save();
  toast(T('dev_dye_ever_done', { n: everTotal().toLocaleString(), k: Object.keys(S.dyeEver).length }));
  renderShowcase();
}
window.devGiveDyeEver = devGiveDyeEver;

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
  { k: 'hip',   max: 150, min: 20 },
  { k: 'arm',   max: 150 },
  { k: 'thigh', max: 200 },
  { k: 'calf',  max: 200 },
  { k: 'face',  max: 114 },
];
// % 단위 (100 = 기본). **하한도 부위마다 다를 수 있다** — `TUNE_PARTS` 의 `min` 이 있으면 그것.
// 엉덩이만 20 인 이유: 다른 부위는 50% 밑으로 가면 뼈만 남은 것처럼 보이는데,
// 엉덩이는 20% 라도 골반이 좁은 몸으로 보인다 (허벅지 윗머리가 같이 들어온다).
//
// ⚠️ **여기를 열어 두는 것만으로는 아무 일도 안 일어난다.** 한동안 20%~150% 가
// 전부 같은 폭으로 그려졌다 — `avatar.js` 의 `hipBaseHalf` 에서 허리·허벅지가
// 하한 노릇을 해 배율을 통째로 삼켰기 때문이다. **상한·하한을 바꿨으면
// `node tools/checkavatar.js` 의 「슬라이더」가 그 구간을 실제로 재는지 볼 것**
const TUNE_MIN = 50, TUNE_STEP = 2;
const tunePart = k => TUNE_PARTS.find(p => p.k === k) || {};
const tuneMaxOf = k => { const v = tunePart(k).max; return v == null ? 200 : v; };
const tuneMinOf = k => { const v = tunePart(k).min; return v == null ? TUNE_MIN : v; };

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
      o[p.k] = Number.isFinite(v) ? Math.max(tuneMinOf(p.k), Math.min(p.max, v)) : 100;
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
  const next = Math.max(tuneMinOf(k), Math.min(tuneMaxOf(k), cur + dir * TUNE_STEP));
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
// 마을을 여는 조건이 아직 없다 — 그때까지 이 스위치가 유일한 열쇠다 (isVillageOpen).
// **마을 하나만 열어 보는 스위치도 따로 둔다.** 전부 열면 '첫 마을만 열린 상태'
// (탭 셋 중 하나만 열려 있을 때의 줄 모양·잠금 표현)를 확인할 수가 없다.
const DEV_VILLAGE_KEY = 'dieter_alchemist_devvillage_v1';
function devVillageKey(id) { return DEV_VILLAGE_KEY + '_' + id; }
function devFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function devToggleFlag(key) {
  try { localStorage.setItem(key, devFlag(key) ? '0' : '1'); } catch (e) {}
  render();
}
// ─── 개발용 컨트롤 만드는 법 (네 화면이 같은 것을 쓴다) ───────
//
// **두 가지뿐이다.** 실행(누르면 지금 일어난다)과 스위치(켜고 끄는 상태).
// 예전에는 둘 다 전체 폭 버튼이라 눌러 보기 전에는 구별이 안 됐고,
// 하나에 한 줄씩 써서 마이 룸 블록이 화면 두 개 반 높이였다.
// **여기 넷만 쓰면 네 화면의 개발용 블록이 저절로 같은 모양이 된다.**
const devGroup = t => `<div class="dev-group">${t}</div>`;
const devAct = (label, call) => `<button class="btn btn-dev" onclick="${call}">${label}</button>`;
const devSw = (on, label, call) =>
  `<button class="dev-sw${on ? ' on' : ''}" onclick="${call}" aria-pressed="${on}">${
    on ? '☑' : '☐'}<span class="dev-sw-t">${label}</span></button>`;
const devActs = list => `<div class="dev-acts">${list.filter(Boolean).join('')}</div>`;
const devSws = list => `<div class="dev-sws">${list.filter(Boolean).join('')}</div>`;

function devAllMaps()     { devToggleFlag(DEV_MAPS_KEY); }
function devAllSpecials() { devToggleFlag(DEV_SPECIALS_KEY); }
function devVillages()    { devToggleFlag(DEV_VILLAGE_KEY); }
// 마을 하나만 열기/닫기. 보고 있던 마을을 닫으면 그 자리에 잠긴 지도가 그대로 남는다
// (잠긴 마을도 지도까지는 보여 주는 것이 원래 규칙이다 — renderVillageMap 참고)
function devVillageOne(id) { devToggleFlag(devVillageKey(id)); }
window.devVillages = devVillages;
window.devVillageOne = devVillageOne;

// 서리(약탈)를 막는 것을 전부 푼다 — **내 약탈권**과 **모두의 방패**다.
// 이것도 밭과 같은 이유로 서버에 있다 (`FARM.md` 7장 — 밭은 서버가 정본이다)
async function devFreeRaids() {
  if (!farmOpen()) { toast(T('dev_farm_locked')); return; }
  if (farmBusy) return;
  farmBusy = true;
  const r = await Sync.freeRaids();
  farmBusy = false;
  if (r.status === 404 && r.body && r.body.error === 'dev_off') {
    toast(T('dev_farm_off'), null, 3600); return;
  }
  if (r.status !== 200 || !r.body) { toast(T('farm_err')); return; }
  await refreshFarm();
  renderFarm();
  render();
  toast(T('dev_raid_done', { n: r.body.raids, s: r.body.cleared }), null, 3200);
}
window.devFreeRaids = devFreeRaids;

// 크리처 서른 종을 전부 얻는다. **이건 진짜 진행이라 세이브에 들어간다**
// (재료 1000개와 같다 — 맵/솥 스위치처럼 이 기기에만 남는 표시가 아니다).
//
// 매력은 **장착한 한 마리만** 반영하므로(1단계) 다 얻어도 총합이 폭발하지 않는다.
// `S.pets` 는 필요할 때 만들어지므로 여기서 미리 안 만든다 (`petState`)
function devAllCreatures() {
  const ids = D.RECIPES.filter(r => r.result && r.result.kind === 'creature').map(r => r.result.id);
  const before = (S.creatures || []).length;
  S.creatures = [...new Set([...(S.creatures || []), ...ids])];
  const added = S.creatures.length - before;
  save();
  render();
  toast(added
    ? T('dev_creatures_done', { n: ids.length, a: added })
    : T('dev_creatures_all', { n: ids.length }));
}
window.devAllCreatures = devAllCreatures;

// 모든 밭을 상한까지 채운다 (이삭 5일치 + 심어 둔 작물은 전부 다 자란 것으로).
//
// ⚠️ **다른 개발용 스위치와 달리 서버에 부탁한다.** 밭은 서버가 정본이라
// (`FARM.md` 7장) 여기서 `FARM` 을 채워 놔도 다음 조회에 서버 값으로 덮인다.
// 서버가 `DEV_TOOLS=1` 로 떠 있지 않으면 404 가 오고, 그때는 그렇다고 말해 준다 —
// 버튼이 그냥 안 먹히면 고장으로 읽힌다
async function devFinishFarm() {
  if (!farmOpen()) { toast(T('dev_farm_locked')); return; }
  if (farmBusy) return;
  farmBusy = true;
  const r = await Sync.farmDev();
  farmBusy = false;
  // **`dev_off` 일 때만** 「DEV_TOOLS 를 켜세요」다. 그냥 404 는 세이브가 아직
  // 서버에 없다는 뜻일 수도 있다 (authRow 도 404 를 낸다)
  if (r.status === 404 && r.body && r.body.error === 'dev_off') {
    toast(T('dev_farm_off'), null, 3600); return;
  }
  if (r.status !== 200 || !r.body) { toast(T('farm_err')); return; }
  await refreshFarm();
  renderFarm();
  render();
  // 하루치를 만드는 크리처가 없으면 채울 것도 없다 — 0 이면 그렇다고 말해 준다
  toast(T(r.body.count ? 'dev_farm_done' : 'dev_farm_none', { n: r.body.count }), null, 3200);
}
window.devFinishFarm = devFinishFarm;

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
  el.innerHTML =
    devGroup(T('dev_g_act')) +
    devActs([
      devAct(T('dev_fill_ap'), 'fillEnergy()'),
      devAct(T('dev_fill_items'), 'devFillItems()'),
      devAct(T('dev_farm_fill'), 'devFinishFarm()'),
      devAct(T('dev_raid_free'), 'devFreeRaids()'),
    ]) +
    devGroup(T('dev_g_open')) +
    devSws([
      devSw(devFlag(DEV_MAPS_KEY), T('dev_all_maps'), 'devAllMaps()'),
      devSw(devFlag(DEV_SPECIALS_KEY), T('dev_all_specials'), 'devAllSpecials()'),
      devSw(devFlag(DEV_VILLAGE_KEY), T('dev_villages'), 'devVillages()'),
      // 마을 하나씩 — 지금 화면에 나오는 마을만 (안 나오는 마을은 열어도 볼 곳이 없다)
      ...D.villagesShown().map(v =>
        devSw(devFlag(devVillageKey(v.id)), `${v.emoji} ${N(v.id, v.name)}`, `devVillageOne('${v.id}')`)),
    ]) +
    // **호감도 단계를 사람마다 골라 본다.** 올리려면 물약을 스무 개씩 만들어 줘야 해서
    // 눈으로 확인할 길이 이것뿐이다 (방 배경 단계와 같은 이유).
    // ⚠️ 여기서는 **답례를 주지 않는다** — 단계만 맞춘다. 답례까지 나오면
    // 「눌러서 재료 받기」가 되고, 진짜 경로(선물 → 단계 → 답례)는 여전히 안 검사된다
    devGroup(T('dev_g_bond')) +
    D.bondNpcs().map(npc => {
      const t = bondTier(npc);
      const btns = D.BOND_TIERS.map((_, i) =>
        `<button class="btn btn-dev${i === t ? ' on' : ''}" onclick="devBondSet('${npc}',${i})"
          aria-label="${speakerName(npc)} ${i}">${i}</button>`).join('');
      return `<div class="dev-row dev-bond"><span class="dev-bond-t">${speakerName(npc)}</span>${btns}</div>`;
    }).join('');
}

// 호감도 단계를 그 자리에 맞춘다. **세이브에 들어간다** — 진짜 진행 값이라
// 튜토리얼 완료·방 배경 단계와 같은 부류다. 내리는 것도 되게 둔다:
// 게임 규칙으로는 안 내려가지만, 낮은 단계 화면을 다시 보려면 이 길이 있어야 한다
function devBondSet(npc, tier) {
  const t = Math.max(0, Math.min(D.BOND_TIERS.length - 1, tier | 0));
  S.bond[npc] = D.BOND_TIERS[t].at;
  save();
  const tn = D.BOND_TIERS[t];
  toast(T('dev_bond_done', { who: speakerName(npc), tier: N(tn.id, tn.name) }), null, 2600);
  render();
}
window.devBondSet = devBondSet;

// 튜토리얼 완료 표시. 채집 쪽 스위치들과 달리 이건 **세이브에 들어간다** —
// 진짜 진행 상태이고, 기기를 바꿔도 따라가야 하기 때문이다.
// 껐다 켤 수 있게 둔 이유: 꺼서 인트로 공주 상태를 다시 확인할 수 있어야 한다.
function devToggleTutorial() {
  S.tutorialDone = !S.tutorialDone;
  save();
  toast(T(S.tutorialDone ? 'dev_tut_done' : 'dev_tut_undone'));
  render();
}
// 방 배경 단계를 골라 본다. 아직 올려 주는 게임 조건이 없어서 눈으로 확인할 길이
// 이것뿐이다. 단계는 세이브에 들어간다 (튜토리얼 스위치와 같은 이유 — 진짜 진행 값이다).
function devRoomLevel(n) {
  S.roomLevel = Math.min(roomMax(), Math.max(1, n | 0));
  save();
  toast(T('dev_room_lv_done', { n: S.roomLevel }));
  renderShowcase();
}
window.devRoomLevel = devRoomLevel;

function renderRoomDevTail() {
  const el = document.getElementById('roomDevTail');
  if (!el) return;
  const on = !!S.tutorialDone;
  const lv = S.roomLevel || roomDefault();
  const bgBtns = Array.from({ length: roomMax() }, (_, i) => i + 1).map(n =>
    `<button class="btn btn-dev${n === lv ? ' on' : ''}" onclick="devRoomLevel(${n})"
      aria-label="${T('dev_room_lv')} ${n}">${n}</button>`).join('');
  el.innerHTML =
    devGroup(T('dev_g_act')) +
    devActs([
      devAct(T('dev_fill_ap'), 'fillEnergy()'),
      devAct(T('dev_all_creatures'), 'devAllCreatures()'),
      // 튜토리얼을 처음부터 다시 본다. tutorialDone 스위치와 다르다 —
      // 이쪽은 진행(S.tut)까지 되감아서 첫 대사부터 나온다
      devAct(T('dev_tut_replay'), 'devReplayTutorial()'),
      // 폭식은 **날이 바뀔 때만** 일어나서 그냥은 볼 수가 없다 (하루를 기다려야 한다).
      // 그래서 한 밤을 강제로 만든다 — 수치도 실제와 똑같이 깎인다
      devAct(T('dev_binge'), 'devBinge()'),
      // 스토리를 통째로 열어 본다 — 컷씬·키워드·마을·퀘스트가 서로 물려 있어서
      // 손으로 하나씩 열면 순서를 틀리기 쉽다
      devAct(T('dev_all_story'), 'devAllStory()'),
      // 「혼자 먹은 밤」의 **갈래**를 보려면 어젯밤에 부엌에 다녀와 있어야 한다
      devAct(T('dev_kitchen'), 'devKitchenVisit()'),
      // 여러 캐릭터를 오가며 시험하려면 신원을 «보관»해 둘 데가 있어야 한다
      devAct(T('dev_acct'), 'openDevAccounts()'),
    ]) +
    devGroup(T('dev_g_open')) +
    devSws([devSw(on, T('dev_tutorial'), 'devToggleTutorial()')]) +
    `<div class="dev-row dev-roomlv"><span class="dev-roomlv-t">🏠 ${T('dev_room_lv')}</span>${bgBtns}</div>`;
}
// 개발용: **스토리를 통째로 연다.**
//
// 컷씬·키워드·마을·퀘스트가 서로 물려 있어서 손으로 하나씩 열면 순서를 틀리기 쉽다 —
// 마을을 열어도 키워드가 없으면 안에서 할 것이 없고, 퀘스트는 매력이 있어야 나온다.
// ⚠️ **세이브에 들어간다** (진짜 진행 값이라 튜토리얼 완료·호감도 단계와 같은 부류다).
// 되돌리려면 게임 초기화뿐이므로 한 번 묻는다.
function devAllStory() {
  showConfirm(T('dev_all_story_ask'), () => {
    S.tutorialDone = true;
    S.keywords = D.KEYWORDS.map(k => k.id);            // 물어볼 것 전부
    S.villages = D.villagesShown().map(v => v.id);     // 마을 전부
    S.seenCuts = D.CUTS.map(c => c.id);                // 스토리 다시보기에 전부
    // 퀘스트는 **매력으로 열린다** — 점수를 안 올리면 칩이 안 뜬다.
    // 마지막 퀘스트의 문턱까지 올려 두고 큐를 다시 채운다
    const top = D.QUESTS.reduce((n, q) => Math.max(n, q.at || 0), 0);
    S.charmPeak = Math.max(S.charmPeak || 0, top);
    refreshQuests();
    save();
    toast(T('dev_all_story_done', {
      kw: S.keywords.length, vl: S.villages.length, cut: S.seenCuts.length }), null, 3400);
    render();
  });
}
window.devAllStory = devAllStory;

// 개발용: **어젯밤에 부엌에 다녀온 것으로 친다.**
//
// ⚠️ **오늘이 아니라 어제로 잡는다.** 「오늘 다녀온 상태」는 그냥 부엌에 가서
// 「같이 먹기」를 누르면 되는 일이라 버튼이 필요 없다. 버튼이 필요한 것은
// **어젯밤 다녀온 상태**다 — 「혼자 먹은 밤」은 날이 바뀔 때 정산되므로,
// 그 갈래(`checkBinge` 의 `warm`)는 어제여야만 보인다.
// `S.bingeDay` 도 어제로 맞춰 준다: 정산 구간이 그보다 앞이면 그 밤이 안 세어진다.
function devKitchenVisit() {
  const y = dayKey(new Date(nowDate().getTime() - DAY_MS));
  S.kitchenDay = y;
  S.bingeDay = Math.min(S.bingeDay || y, y);
  save();
  toast(T('dev_kitchen_done'), null, 3200);
  render();
}
window.devKitchenVisit = devKitchenVisit;

// 개발용: 「혼자 먹은 밤」 한 번을 지금 만든다.
// **실제 경로를 그대로 지난다** — 포만감을 비우고 어제로 돌려 checkBinge() 를 부른다.
// 따로 이벤트를 손으로 만들면 진짜 경로가 안 검사된다
function devBinge() {
  S.fullness = 0;
  S.bingeDay = dayKey(new Date(Date.now() - DAY_MS));
  const r = checkBinge();
  save();
  render();
  toast(r ? T('dev_binge_ok', { n: bingeCount() }) : T('dev_binge_no'));
}
window.devBinge = devBinge;
window.devToggleTutorial = devToggleTutorial;
// 튜토리얼 되감기 — 인트로 다시보기와 짝이 되는 개발용 버튼
function devReplayTutorial() {
  if (!window.Tut) { toast('tutorial.js'); return; }
  Tut.replay();
}
window.devReplayTutorial = devReplayTutorial;

// ─── 랭킹 화면 개발용 스위치 ───
// 리그가 32개이고 정산은 주에 한 번뿐이라, 눌러서 확인할 길이 없으면
// 승급·강등을 한 번도 못 보고 출시하게 된다.
function devLeagueMove(d) {
  S.league = Math.max(0, Math.min(D.LEAGUES.length - 1, S.league + d));
  save();
  toast(leagueName(S.league));
  renderLeague();
}
function devLeagueScore(n) {
  addWeekScore(n);
  save();
  toast(T('lg_pts', { n: S.week.score.toLocaleString() }));
  renderLeague();
}
// 지난 주로 되돌려 정산을 강제한다 — 승급/강등 배너를 눌러서 확인하는 유일한 길
function devLeagueEndWeek() {
  const past = new Date(Date.now() - 7 * 86400000);
  S.week.key = weekKey(past);
  save();
  settleLeague();
  renderLeague();
}
window.devLeagueMove = devLeagueMove;
window.devLeagueScore = devLeagueScore;
window.devLeagueEndWeek = devLeagueEndWeek;

function renderLeagueDev() {
  const el = document.getElementById('leagueDevBody');
  if (!el) return;
  el.innerHTML = devGroup(T('dev_g_act')) + devActs([
    devAct(`▼ ${T('dev_lg_down')}`, 'devLeagueMove(-1)'),
    devAct(`▲ ${T('dev_lg_up')}`, 'devLeagueMove(1)'),
    devAct(`+50 ${T('lg_pts_unit')}`, 'devLeagueScore(50)'),
    devAct(`+500 ${T('lg_pts_unit')}`, 'devLeagueScore(500)'),
    devAct(`⏭ ${T('dev_lg_week')}`, 'devLeagueEndWeek()'),
  ]);
}

// ─── 공방 화면 개발용 스위치 ───
//
// 솥 해금은 세이브에 쓰지 않는다 (채집의 맵/히든과 같은 이유 — 서버에 올라가면
// 다른 기기에서도 다 열린 채가 되고 되돌릴 방법이 없다).
// 레시피는 다르다. '알아낸 레시피' 는 진짜 진행이라 세이브에 들어간다.
// ─── 개발용 계정 보관함 ──────────────────────────────────────
//
// 「여러 캐릭터를 만들어 가며 시험한다」를 하려면, 초기화하기 «전에» 지금 신원을
// 어딘가 적어 둬야 한다. 복구 코드를 손으로 옮겨 적는 대신 여기 담아 둔다.
//
// ⚠️ **이 칸만은 게임 초기화가 안 지운다**(`wipeLocalAll`). 게임 상태가 아니라
// 도구라서다 — 초기화할 때마다 같이 날아가면 애초에 쓸 수가 없다.
// ⚠️ **담기는 것은 복구 코드다.** 세이브 사본이 아니라 «열쇠»이므로,
// 그 계정의 진행은 서버에 있는 것을 그대로 다시 받아 온다.
const DEV_ACCT_KEY = 'dieter_alchemist_devaccounts_v1';
// 이름은 사람이 지은 문자열이라 그대로 HTML 에 넣지 않는다.
// (`NAME_ALLOW` 가 막고는 있지만 화면에 글자를 넣는 자리는 늘 한 번 막아 둔다)
const esc = t => String(t).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function devAccounts() {
  try {
    const v = JSON.parse(localStorage.getItem(DEV_ACCT_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function saveDevAccounts(list) {
  try { localStorage.setItem(DEV_ACCT_KEY, JSON.stringify(list)); } catch (e) {}
}
// 지금 계정을 담는다. **같은 코드면 이름·시각만 새로 적는다** — 누를 때마다
// 같은 줄이 쌓이면 목록이 금세 못 쓰게 된다
function devAcctSave() {
  if (!window.Sync) { toast(T('dev_acct_nosync')); return; }
  const code = Sync.code();
  if (!code) { toast(T('dev_acct_nosync')); return; }
  const list = devAccounts();
  const row = { code, name: S.name || T('dev_acct_noname'), at: nowDate().toISOString() };
  const i = list.findIndex(x => x.code === code);
  if (i >= 0) list[i] = row; else list.unshift(row);
  saveDevAccounts(list.slice(0, 12));
  renderDevAccounts();
  toast(T('dev_acct_saved', { who: row.name, j: josa(row.name, '을를') }), null, 2600);
}
// 담아 둔 계정으로 갈아탄다. **복구 코드와 같은 길을 지난다** —
// 「먼저 받아 보고, 있으면 갈아탄다」(`doRestore`)를 두 벌로 만들지 않는다
function devAcctUse(code) {
  const m = document.getElementById('devAcctSheet');
  if (m) m.classList.remove('show');
  openRestore();
  const i = document.getElementById('restoreInput');
  if (i) { i.value = code; }
  checkRestoreCode();
}
// ⚠️ **「담고 새 캐릭터로」가 보관함의 짝이다.**
// 그냥 「게임 초기화」를 쓰면 **서버 사본까지 지워서**(`Sync.wipe`) 방금 담아 둔
// 계정이 죽는다 — 보관함에 열쇠만 남고 열 문이 없어진다.
// 여기서는 **서버는 그대로 두고** 이 기기의 신원만 버린다.
// (진짜 「게임 초기화」는 그대로 파괴적이어야 한다 — 사람이 지우겠다고 한 것이다)
function devAcctNew() {
  if (!window.Sync) { toast(T('dev_acct_nosync')); return; }
  showConfirm(T('dev_acct_new_ask'), () => {
    devAcctSave();
    wipeLocalAll();
    Sync.forget();
    location.reload();
  });
}
function devAcctDrop(code) {
  saveDevAccounts(devAccounts().filter(x => x.code !== code));
  renderDevAccounts();
}
function openDevAccounts() {
  const m = document.getElementById('devAcctSheet');
  if (m) m.classList.add('show');
  renderDevAccounts();
}
function closeDevAccounts() {
  const m = document.getElementById('devAcctSheet');
  if (m) m.classList.remove('show');
}
function renderDevAccounts() {
  const el = document.getElementById('devAcctList');
  if (!el) return;
  const list = devAccounts();
  const mine = window.Sync ? Sync.code() : '';
  el.innerHTML = list.length ? list.map(a => {
    const now = a.code === mine;
    // 코드를 통째로 보여 주지 않는다 — 길어서 줄이 넘친다. 앞뒤만 보인다
    const short = a.code.length > 16 ? a.code.slice(0, 8) + '…' + a.code.slice(-4) : a.code;
    return `<div class="gift-row">
        <span class="gift-nm">${esc(a.name)}${now ? ` <span class="gift-tag">${T('dev_acct_now')}</span>` : ''}</span>
        <span class="ask-none">${esc(short)}</span>
        <button class="btn btn-dev" onclick="devAcctUse('${esc(a.code)}')"
          ${now ? 'disabled' : ''}>${T('dev_acct_use')}</button>
        <button class="btn btn-dev" onclick="devAcctDrop('${esc(a.code)}')">${T('dev_acct_drop')}</button>
      </div>`;
  }).join('') : `<div class="ask-none">${T('dev_acct_empty')}</div>`;
}
window.openDevAccounts = openDevAccounts;
window.closeDevAccounts = closeDevAccounts;
window.devAcctSave = devAcctSave;
window.devAcctNew = devAcctNew;
window.devAcctUse = devAcctUse;
window.devAcctDrop = devAcctDrop;

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
  const allOn = D.CAULDRONS.every(c => devPotOpen(c.id));
  el.innerHTML =
    devGroup(T('dev_g_act')) +
    devActs([devAct(T('dev_fill_ap'), 'fillEnergy()')]) +
    devGroup(T('dev_pots')) +
    devSws([
      devSw(allOn, T('dev_all_pots'), 'devAllPots()'),
      ...D.CAULDRONS.map(c =>
        devSw(devPotOpen(c.id), `${N(c.id, c.name)} ${c.slots}${T('slot_unit')}`, `devTogglePot('${c.id}')`)),
    ]) +
    devGroup(T('dev_recipes')) +
    devActs([
      devAct(T('dev_all_recipes'), "devOpenRecipes('all')"),
      ...D.RECIPE_CATS.map(c =>
        devAct(`📖 ${N(c.id + '_cat', c.label)}`, `devOpenRecipes('${c.id}')`)),
    ]);
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
    // **슬라이더 값과 «실제 몸» 은 다른 수치다.**
    // 슬라이더는 개발용 배율이고, 물약·폭식으로 바뀌는 것은 몸무게(`bodyLevel`)다.
    // 둘을 곱한 것이 지금 그려지는 크기 — 그것을 «처음 몸»(슬라이더 100% ·
    // 통통 `bodyLevel` 1)에 견줘 보여 준다. 식은 `Avatar.partRatio` 한 곳에 있다
    // (여기서 다시 쓰면 패널이 그림과 다른 말을 한다)
    const pct = window.Avatar && Avatar.partRatio
      ? Avatar.partRatio(p.k, tuneScales(), bodyLevel()) * 100 : null;
    // 소수 셋째 자리까지 — 물약 한 병이 만드는 차이가 그 자리에서 보인다
    const real = pct == null ? ''
      : `<span class="tune-real${pct > 100.0005 ? ' up' : pct < 99.9995 ? ' down' : ''}"
           title="${T('tune_real_t')}">${pct > 100.0005 ? '▲' : pct < 99.9995 ? '▼' : '='} ${pct.toFixed(3)}%</span>`;
    return `<div class="tune-row">
      <span class="tune-label">${T('part_' + p.k)}${atMax ? ` <span class="tune-cap">${T('tune_max')}</span>` : ''}</span>
      ${btn(-1, '−')}
      <span class="tune-val${v === 100 ? '' : ' on'}">${v}%${real}</span>
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
// 재료가 가방에 다 있어야 담긴다. **솥은 알아서 맞춰 준다** (아래 potFor).
// `skip` 을 주면 그 재료는 안 따진다 — **아직 무엇인지 모르는 칸**이 그렇다
// (모르는 재료를 가졌는지 따질 수가 없다)
function hasAllInputs(r, skip) {
  const need = {};
  r.inputs.forEach(id => { if (!skip || skip.indexOf(id) < 0) need[id] = (need[id] || 0) + 1; });
  return Object.keys(need).every(id => stockOf(id) >= need[id]);
}

// 재료 n 가지가 들어가는 **가장 작은 솥**. 열려 있는 것 중에서 찾고,
// 없으면 열어야 할 솥을 두 번째 값으로 돌려준다 ('○○이(가) 필요해요' 안내용).
// 가장 작은 것을 고르는 이유: 2가지 레시피에 12구 솥을 꺼내 놓으면
// 빈 구멍 열 개가 무엇을 더 넣으라는 뜻으로 읽힌다.
function potFor(n) {
  const fit = D.CAULDRONS.filter(c => c.slots >= n).sort((a, b) => a.slots - b.slots);
  const open = fit.find(c => isCauldronOpen(c));
  return { open, need: open ? null : fit[0] };
}

function fillFromRecipe(resultId, el) {
  const r = D.RECIPES.find(x => x.result.id === resultId);
  if (!r) return;
  const { open, need } = potFor(r.inputs.length);
  if (!open) {
    // 그만한 솥이 아직 없다 — 어떤 솥이 필요한지 이름으로 알려 준다
    const nm = need ? N(need.id, need.name) : '';
    toast(T('need_pot', { name: nm, josa: josa(nm, '이가') }), el);
    return;
  }
  // ⚠️ **모르는 칸은 「모자란다」로 막지 않는다.** 아직 무엇인지 모르는 재료를
  // 가졌는지 따질 수가 없다 — 아는 칸만 보고 판정한다
  const un = unknownOf(r);
  if (!hasAllInputs(r, un)) { toast(T('mat_short'), el); return; }
  // 재료 가짓수에 딱 맞는 솥으로 갈아 끼운다 (이미 그 솥이면 그대로)
  if (S.cauldronId !== open.id) {
    S.cauldronId = open.id;
    if (S.record && !S.record.pots.includes(open.id)) S.record.pots.push(open.id);
  }
  // **아는 것만 담는다.** 모르는 칸은 빈자리로 남고, 거기에 넣어 보는 것이
  // 이 시스템의 조작 전부다
  S.want = r.inputs.filter(id => un.indexOf(id) < 0);
  S.guess = r.result.id;            // 지금 «무엇을 만들려는 중»인가
  refillFromWant();
  save(); render();
  // render() 가 줄을 새로 그렸다 — 넘겨받은 el 은 이미 문서에서 떨어졌으므로 새로 찾는다
  toast(T('recipe_filled', { name: N(r.result.id, r.result.name) }),
    `[data-recipe="${resultId}"]`, null, 'above');
  if (window.Sfx) Sfx.play('pick');
  if (window.Tut) Tut.fire('want:' + resultId);
}

// 아직 모르는 레시피를 눌렀을 때
function unknownRecipeHint(el) { toast(T('recipe_unknown'), el, null, 'above'); }
window.unknownRecipeHint = unknownRecipeHint;

// ─── 비법서 한 장 펼쳐 보기 ───────────────────────────────────
//
// **장을 가지면 「어디로 가면 되는지」까지 알게 된다.** 이게 이 시스템의 값어치다 —
// 재료 이름만 알려 주면 맵 51곳의 대응표를 사람이 외워야 한다.
//
// 재료 하나가 어디서 나는가. ⚠️ **채집으로 안 나오는 재료가 절반이다** —
// 히든(맵마다 하나) · 밭 작물 · 크리처가 만드는 것 · 조합해서 얻는 것.
// 「어느 맵」만 찾으면 그 절반이 통째로 빈칸이 된다
function ingSource(id) {
  const pool = D.MAPS.filter(m => (m.pool || []).includes(id));
  if (pool.length) return { kind: 'gather', maps: pool };
  const sp = D.MAPS.filter(m => m.special === id);
  if (sp.length) return { kind: 'rare', maps: sp };
  if ((D.FARM_CROPS || []).some(c => c.id === id)) return { kind: 'farm', maps: [] };
  const mk = D.RECIPES.find(r => r.result.makes && r.result.makes.id === id);
  if (mk) return { kind: 'produce', by: mk.result, maps: [] };
  if (D.RECIPES.some(r => r.result.id === id)) return { kind: 'brew', maps: [] };
  return { kind: 'unknown', maps: [] };
}

// 그 재료를 캐러 갈 **제일 쉬운 맵** — 열린 것 중 제일 싼 곳, 없으면 제일 빨리 열릴 곳.
// 여러 곳에서 나는 재료가 많아서(최대 10곳) 다 늘어놓으면 줄이 통째로 표가 된다
function bestMapFor(maps) {
  if (!maps.length) return null;
  const open = maps.filter(m => isMapOpen(m));
  if (open.length) {
    return open.slice().sort((a, b) => gatherCost(a.id) - gatherCost(b.id))[0];
  }
  return maps.slice().sort((a, b) => a.unlock - b.unlock)[0];
}

let pageRecipe = null;
function openPage(id) {
  pageRecipe = id;
  renderPage();
  const m = document.getElementById('pageSheet');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closePage() {
  const m = document.getElementById('pageSheet');
  if (m) m.classList.remove('show');
}
window.openPage = openPage;
window.closePage = closePage;

function renderPage() {
  const r = D.RECIPES.find(x => x.result.id === pageRecipe);
  const el = document.getElementById('pageBody');
  const ti = document.getElementById('pageTitle');
  if (!r || !el) return;
  if (ti) ti.textContent = T('pg_title', { name: N(r.result.id, r.result.name) });

  el.innerHTML = pageRowsFor(r.inputs, r.result.id);
}
window.renderPage = renderPage;

// 재료 목록 → 「무엇을 얼마나 · 어디서 · 갈 수 있는지 · 언제 · 누구와」 줄들.
//
// **비법서와 퀘스트가 같은 것을 쓴다.** 두 벌로 두면 한쪽만 고치게 되고,
// 그러면 「비법서에는 나오는데 퀘스트에는 안 나오는 맵」 같은 것이 생긴다
// (밭 시트와 밭 탭을 `farmHtml()` 하나로 그리는 것과 같은 이유다)
// ═══════════════════════════════════════════════════════════════
//  흐린 장 — 아는 칸과 모르는 칸
// ═══════════════════════════════════════════════════════════════
//
// 「안다」가 되는 길은 셋이다. **하나라도 되면 이름이 보인다.**
//   1. 그 칸이 애초에 안 가려져 있다 (`hiddenOf` 가 안 고른 자리)
//   2. 저어서 밝혀냈다 (`S.known`)
//   3. 그 재료를 많이 모아 봤다 (`S.gathered` ≥ `masteryAt`) — **모든 장에서** 밝다
//
// 3번이 있어서 **추리가 싫은 사람도 막히지 않는다.** 채집만 해도 비법서가 밝아진다.
function ingMastered(id) { return ((S.gathered || {})[id] || 0) >= D.LORE.masteryAt; }
function knownIn(recipeId) { return (S.known && S.known[recipeId]) || []; }
function ingKnown(recipeId, ingId, hidden) {
  const h = hidden || [];
  if (h.indexOf(ingId) < 0) return true;             // 안 가려진 자리
  if (knownIn(recipeId).indexOf(ingId) >= 0) return true;
  return ingMastered(ingId);
}
// 그 장에서 아직 모르는 재료들
function unknownOf(r) {
  const hidden = D.hiddenOf(r);
  return hidden.filter(id => !ingKnown(r.result.id, id, hidden));
}
// 밝혀낸다. **한 번 밝힌 것은 다시 안 어두워진다**
function learnIng(recipeId, ingId) {
  if (!S.known) S.known = {};
  if (!S.known[recipeId]) S.known[recipeId] = [];
  if (S.known[recipeId].indexOf(ingId) < 0) S.known[recipeId].push(ingId);
}

// 수수께끼 한 줄 — **지대 + 흔한 정도**. 후보가 일곱쯤 남는다.
// ⚠️ 이모지를 넣으면 후보가 평균 1.05개라 답을 적어 주는 것이 된다 (`data.js` 의 ⚠️)
function ingRiddle(id) {
  const src = ingSource(id);
  const map = bestMapFor(src.maps);
  const zone = map && D.ZONES.find(z => z.id === map.zone);
  const rar = D.ingRarity(id);
  return T('pg_riddle', {
    zone: zone ? `${zone.emoji} ${N(zone.id, zone.name)}` : T('pg_riddle_where'),
    rar: T(rar),
  });
}

// `recipeId` 를 같이 주면 **가려진 칸은 수수께끼로** 그린다.
// 안 주면 예전처럼 전부 이름으로 나온다 (퀘스트 시트가 그렇게 쓴다)
function pageRowsFor(inputs, recipeId) {
  const r = recipeId && D.RECIPES.find(x => x.result.id === recipeId);
  const hidden = r ? D.hiddenOf(r) : [];
  // **같은 재료를 묶어 분량으로 적는다.** 비법서에는 「분량」이 적혀 있다는 설정이고,
  // 화면으로도 이모지 여섯 개보다 「×3」이 훨씬 빨리 읽힌다.
  //
  // ⚠️ **지금 데이터에는 겹치는 재료가 한 곳도 없다** (136 레시피 전부 ×1).
  // 그래서 `×n` 은 아직 화면에 안 나온다 — 분량을 진짜로 쓰려면 레시피 생성기
  // (`tools/gen*.js`)에서 같은 재료를 두 번 넣어야 한다. 묶는 쪽을 미리 해 둔 것은
  // 그때 화면을 다시 손대지 않으려는 것이다
  const need = {};
  inputs.forEach(id => { need[id] = (need[id] || 0) + 1; });

  return Object.keys(need).map(id => {
    const n = need[id], have = stockOf(id);
    // ⚠️ **모르는 칸은 여기서 «완전히» 갈라진다.** 아래로 내려가면 어디서 나는지·
    // AP·시간대까지 다 적히는데, 그건 이름을 아는 것이나 마찬가지다
    if (recipeId && !ingKnown(recipeId, id, hidden)) {
      return `<div class="pg-row unknown">
        <span class="pg-ic pg-q" aria-hidden="true">？</span>
        <span class="pg-main">
          <span class="pg-name">${T('pg_unknown')}${n > 1 ? ` <b class="pg-n">×${n}</b>` : ''}</span>
          <span class="pg-where">${ingRiddle(id)}</span>
          <span class="pg-tip"><span class="pg-hintway">${T('pg_howto')}</span></span>
        </span>
        <span class="pg-have lack">?</span>
      </div>`;
    }
    const src = ingSource(id);
    const map = bestMapFor(src.maps);
    let where = '', tip = '', locked = false;
    if (map) {
      const zone = D.ZONES.find(z => z.id === map.zone);
      const open = isMapOpen(map);
      locked = !open;
      where = `${zone ? zone.emoji : ''} ${zone ? N(zone.id, zone.name) : ''} · ${N(map.id, map.name)}`
        + (src.maps.length > 1 ? ' ' + T('pg_more', { n: src.maps.length - 1 }) : '');
      if (open) {
        // **어떤 크리처와 · 언제 가면 좋은가.** 맵의 속성이 곧 답이고, 그 속성을
        // 편드는 시간대가 하나씩 있다 (`D.DAYPARTS`). 확률표를 밖에서 외워 오라고
        // 하지 않으려고 만든 자리다 — 지금까지는 채집 토스트로만 새어 나왔다
        const at = D.creatureAttr(D.mapAttr(map.id));
        const dp = D.DAYPARTS.find(p => at && p.attrs.indexOf(at.k) >= 0);
        tip = `<span class="pg-ap">⚡${gatherCost(map.id)}</span>`
          + (at ? ` <span class="pg-attr" style="--at:${at.color}">${N(at.id, at.name)}</span>` : '')
          + (dp ? ` <span class="pg-dp">${dp.emoji} ${N(dp.id, dp.name)}</span>` : '');
        if (src.kind === 'rare') tip += ` <span class="pg-rare">${T('pg_rare')}</span>`;
      } else {
        where = `${where}`;
        tip = `<span class="pg-lock">🔒 ${T('pg_lock', { n: map.unlock })}</span>`;
      }
    } else {
      // 채집으로 안 나오는 것들 — 밭 · 크리처 생산 · 조합
      where = T(src.kind === 'farm' ? 'pg_from_farm'
        : src.kind === 'produce' ? 'pg_from_pet'
        : src.kind === 'brew' ? 'pg_from_brew' : 'pg_from_unknown',
        { name: src.by ? N(src.by.id, src.by.name) : '' });
    }
    const okAmt = have >= n;
    return `<div class="pg-row${locked ? ' locked' : ''}">
      <span class="pg-ic" aria-hidden="true">${itemArt(id, 26)}</span>
      <span class="pg-main">
        <span class="pg-name">${itemName(id)}${n > 1 ? ` <b class="pg-n">×${n}</b>` : ''}</span>
        <span class="pg-where">${where}</span>
        ${tip ? `<span class="pg-tip">${tip}</span>` : ''}
      </span>
      <span class="pg-have ${okAmt ? 'ok' : 'lack'}">${have} / ${n}</span>
    </div>`;
  }).join('');
}
window.pageRowsFor = pageRowsFor;


// 레시피 줄의 재료 이모지를 눌렀을 때 — 그 자리에 이름을 띄운다.
// 이모지만으로는 무엇인지 알 수 없는 재료가 많다 (씨앗·이끼·조각 종류가 특히 그렇다)
function ingHint(id, el) {
  const it = itemOf(id);
  if (!it) return;
  // 크리처는 「무엇인지」만으로는 모자란다 — **녹여서 넣는 것**이라고 말해 준다
  toast(isMeltItem(id) ? T('melt_hint', { name: itemName(id) }) : itemName(id), el, null, 'above');
}
window.ingHint = ingHint;

// 맵마다 하나씩 있는 특별한 재료 칩. 아직 못 찾았으면 **정체 대신 힌트만** 알려 준다 —
// 눌러서 이름이 나오면 0.1% 로 찾아내는 재미가 없어진다
// 날씨 이모지를 누르면 이름과 **편드는 속성**을 알려 준다. 속성만 적어 두면
// 「이게 왜 좋은 건데」가 화면 어디에도 없다 — 표를 밖에서 외워 오라는 뜻이 된다
function weatherInfo(mapId, el) {
  const we = weatherOf(mapId);
  if (!we) return;
  const at = D.creatureAttr(we.attr);
  toast(T('weather_info', { emoji: we.emoji, name: N(we.id, we.name),
    attr: at ? N(at.id, at.name) : '' }), el, 2600, 'above');
}
window.weatherInfo = weatherInfo;

function daypartInfo(el) {
  const dp = daypartNow();
  if (!dp) return;
  const names = dp.attrs.map(k => { const a = D.creatureAttr(k); return a ? N(a.id, a.name) : k; });
  toast(T('daypart_info', { emoji: dp.emoji, name: N(dp.id, dp.name),
    attr: names.join(' · '), time: zoneTime(9) }), el, 2600, 'above');
}
window.daypartInfo = daypartInfo;

function renderDayPart() {
  const el = document.getElementById('dayPart');
  if (!el) return;
  const dp = daypartNow();
  if (!dp) return;
  el.innerHTML = `${dp.emoji} <span class="dp-name">${N(dp.id, dp.name)}</span>`;
  el.setAttribute('aria-label', N(dp.id, dp.name));
}

function specialHint(mapId, el) {
  const map = D.MAPS.find(m => m.id === mapId);
  if (!map) return;
  const found = devFlag(DEV_SPECIALS_KEY) || invCount(map.special) > 0;
  if (found) { ingHint(map.special, el); return; }
  toast(T('special_hint'), el, null, 'above');
}
window.specialHint = specialHint;

// ─── 신체 · 아우라 상세 수치 표시 ───
// 부호를 붙인 숫자 ('+1.8' / '−0.6' / '0'). 0 에는 부호를 안 붙인다
function signed(n, dec) {
  const v = Number(n) || 0;
  if (Math.abs(v) < Math.pow(10, -dec) / 2) return (0).toFixed(dec);
  return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(dec);
}

// 지금 상태 두 칸 — 1초마다 갱신되므로 **여기만 따로** 그린다
// (renderShowcase 를 통째로 다시 부르면 아바타가 매초 새로 그려진다)
function renderBodyState() {
  const f = document.getElementById('statFull');
  const st = document.getElementById('statStam');
  if (f) {
    f.textContent = `${Math.floor(fullness())} / ${FULLNESS.max}`;
    // 이대로 날이 바뀌면 혼자 먹게 되는 자리 — **미리 보이게 한다.**
    // 아침에 와서 "왜 깎였지" 를 알게 되는 것보다, 밤에 "아 먹어야겠다" 가 낫다
    f.classList.toggle('low', fullness() <= BINGE.atFullness);
  }
  if (st) st.textContent = `${Math.floor(stamina())} / ${staminaMax()}`;
  // 소리로 읽을 이름 — index.html 에 한국어를 박아 두면 영어 화면에서 한글이 읽힌다
  const wf = document.getElementById('whyFull');
  if (wf) wf.setAttribute('aria-label', T('why_of', { name: T('now_full') }));
  const ws = document.getElementById('whyStam');
  if (ws) ws.setAttribute('aria-label', T('why_of', { name: T('now_stam') }));
}

// 두 칸을 누르면 무엇인지 알려 준다 — 처음 보는 사람에게는 숫자만으로는 안 읽힌다.
// **수치를 적지 않는다.** 시간당 감소량·회복량까지 적어 두면 도움말이 아니라 사양서가 된다 —
// 여기서 알아야 할 것은 「무엇이 이걸 움직이나」 하나다.
function fullnessHelp(el) { toast(T('now_full_help'), el, 4600); }
window.fullnessHelp = fullnessHelp;
function staminaHelp(el) { toast(T('now_stam_help'), el, 4600); }
window.staminaHelp = staminaHelp;

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
    row(T('v_muscle'), `${fix2(muscleKg())} kg`) +
    // 단련도 — 운동이 몸을 얼마나 바꿔 놨는지. **부호를 붙여 보여 준다**:
    // 방치하면 음수로 내려가는 값이라, 0 을 기준으로 어느 쪽인지가 이 칸의 전부다
    row(T('v_fit'), signed(S.fit || 0, 1));

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
    row(T('rec_workouts'), T('rec_workouts_v', { n: r.workouts || 0, m: r.exMin || 0 })) +
    row(T('rec_meals'), `${r.meals || 0}`) +
    row(T('rec_alone'), `${r.aloneNights || 0}`) +
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
    ctx.drawImage(await svgToImage(Avatar.roomScene(S.roomLevel), Math.round(w), Math.round(h)),
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

  // ③ 애착 크리처 **한 마리** — 아바타 왼쪽 바닥에.
  // **창문(오른쪽 위)은 피한다** — 겹치면 유리에 붙은 것처럼 보인다.
  // 예전에는 가진 것 넷을 방 여기저기 흩어 놓았는데, 이제 방에 있는 것은 고른 한 마리다
  const pet = roomPet();
  if (pet && window.Creature) {
    const CR = 132;
    ctx.drawImage(await svgToImage(Creature.draw(pet, { flat: true }), CR, CR),
      CARD_W * 0.14, CARD_ROOM_H * 0.74, CR, CR);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

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
  // ⚠️ **열어서 «본» 순간 점을 끈다.** 예전에는 복구 코드를 «복사»해야만 꺼져서,
  // 열어 보고 눈으로 적어 둔 사람에게는 **영영 안 꺼졌다** (그렇게 신고받았다).
  // 점의 뜻은 「아직 안 본 것이 있다」이지 「아직 복사 안 했다」가 아니다.
  if (!S.codeSeen) { S.codeSeen = true; save(); renderActBadges(); }
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

// ═══════════════════════════════════════════════════════════════
//  음식 (EXERCISE.md) — 먹으면 포만감이 찬다
// ═══════════════════════════════════════════════════════════════
function foodOf(id) { return D.FOODS.find(x => x.id === id) || null; }
function foodCount(id) { return (S.foods || {})[id] || 0; }

function renderFoods() {
  const el = document.getElementById('foodShelf');
  const hint = document.getElementById('foodHint');
  if (!el) return;
  const ids = D.FOODS.filter(f => foodCount(f.id) > 0).map(f => f.id);
  if (hint) hint.style.display = ids.length ? 'block' : 'none';
  if (!ids.length) {
    // 채집으로 나온다는 것을 여기서 알려 준다 — 빈 칸만 두면 어디서 얻는지 모른다
    el.innerHTML = `<div class="empty-hint clickable" onclick="switchTab('gather')">${T('empty_foods')}</div>`;
    return;
  }
  el.innerHTML = ids.map(id => {
    const f = foodOf(id);
    return `<div class="potion-card" onclick="eatFood('${id}')">
      <div class="potion-emoji">${f.emoji}</div>
      <div class="potion-name">${N(f.id, f.name)}<button class="potion-why"
        aria-label="${T('food_why')}"
        onclick="event.stopPropagation(); showFoodEffect('${id}', this)">?</button></div>
      <div class="potion-count">×${foodCount(id)}</div>
    </div>`;
  }).join('');
}

// ─── 잡화 › 먹이 칸 ───
// 여기서는 **보여 주기만** 한다. 실제로 먹이는 곳은 먹이주기 팝업 하나뿐이다 —
// 먹이는 「누구에게」가 반드시 필요해서, 크리처를 안 고르고 누를 수 있으면 안 된다
function renderFeeds() {
  const el = document.getElementById('feedShelf');
  const hint = document.getElementById('feedHint');
  if (!el) return;
  const ids = D.FEEDS.filter(f => feedCount(f.id) > 0).map(f => f.id);
  if (hint) hint.style.display = ids.length ? 'block' : 'none';
  if (!ids.length) {
    el.innerHTML = `<div class="empty-hint clickable" onclick="switchTab('gather')">${T('empty_feeds')}</div>`;
    return;
  }
  el.innerHTML = ids.map(id => {
    const f = feedOf(id);
    return `<div class="potion-card" onclick="openFeed(S.petField || S.petRoom)">
      <div class="potion-emoji">${f.emoji}</div>
      <div class="potion-name">${N(f.id, f.name)}<button class="potion-why"
        aria-label="${T('feed_why')}"
        onclick="event.stopPropagation(); showFeedEffect('${id}', this)">?</button></div>
      <div class="potion-count">×${feedCount(id)}</div>
    </div>`;
  }).join('');
}

function showFeedEffect(id, anchor) {
  const f = feedOf(id);
  if (!f) return;
  toast(`${f.emoji} ${N(f.id, f.name)}\n${T('feed_eff', { n: f.loyalty, h: leftText(f.hours * 3600e3) })}`,
    anchor, 4200);
}
window.showFeedEffect = showFeedEffect;

// 먹으면 무슨 일이 일어나는지 — 물약의 '?' 와 같은 규칙이다
function showFoodEffect(id, anchor) {
  const f = foodOf(id);
  if (!f) return;
  const lines = [`🍚 ${T('now_full')} +${f.full}`];
  if (f.happy) lines.push(`💖 ${T('a_happy')} ${signed(f.happy, 0)}`);
  if (f.fit) lines.push(`🏃 ${T('v_fit')} ${signed(f.fit, 1)}`);
  toast(`${N(f.id, f.name)}\n${lines.join('\n')}`, anchor, 4200);
}
window.showFoodEffect = showFoodEffect;

function eatFood(id) {
  const f = foodOf(id);
  if (!f || foodCount(id) <= 0) return;
  tickBody();
  // **절반 넘게 버려질 상황이면 안 먹는다.** 넘치는 만큼은 그냥 사라지는데,
  // 포만감 98 에서 케이크(+50)를 눌러 48을 날리는 것이 화면에는 전혀 안 보인다.
  // 「가득일 때만 막기」로는 이 손해를 못 막는다 — 가득 직전이 제일 위험하다
  if (fullness() + f.full * 0.5 > FULLNESS.max) { toast(T('food_full')); return; }
  S.foods[id]--;
  if (S.foods[id] <= 0) delete S.foods[id];
  S.fullness = Math.min(FULLNESS.max, fullness() + f.full);
  if (f.happy) addAura('happy', f.happy);
  if (f.fit) S.fit = +((S.fit || 0) + f.fit).toFixed(3);
  rec('meals');
  save();
  toast(T('food_ate', { emoji: f.emoji, name: N(f.id, f.name), n: f.full }));
  render();
}
window.eatFood = eatFood;

// ─── 「흡입」 — 혼자 먹은 밤을 보는 컷씬 ──────────────────────
//
// 토스트로 흘려보내지 않는다. **등을 돌린 뒷모습**이 이 장면의 전부라, 흘러가는
// 글자로는 전달되지 않는다. 안 본 밤이 있으면 버튼에 **붉은 뱃지**로 몇 번인지 알린다.
function bingeCount() { return (S.binges || []).length; }

function renderActBadges() {
  // 부엌 — 튜토리얼을 마치면 보이고, **오늘 안 먹었으면 점이 켜진다.**
  // 숫자가 아니라 점인 이유: 하루에 한 번이라 셀 것이 없다
  const kb = document.getElementById('actKitchen');
  if (kb) kb.hidden = !kitchenOpen();
  // **새로 물어볼 것이 있어도 켠다** — 마을이 전부 잠겨 있을 때 이야기가 시작되는
  // 자리가 여기뿐이라, 「밥은 먹었다」로 점이 꺼지면 갈 곳이 아예 안 보인다
  // 복구 코드를 아직 안 본 사람에게 톱니에 점. **한 번 보면 다시 안 뜬다** —
  // 계속 떠 있으면 그것도 잔소리가 된다
  const gd = document.getElementById('gearDot');
  if (gd) gd.hidden = !!S.codeSeen;
  const kd = document.getElementById('kitchenDot');
  if (kd) kd.hidden = !kitchenOpen() || (ateToday() && !kitchenNews());
  const el = document.getElementById('bingeBadge');
  if (!el) return;
  const n = bingeCount();
  el.textContent = n > 9 ? '9+' : String(n);
  el.hidden = n === 0;
  const btn = document.getElementById('actBinge');
  if (btn) btn.setAttribute('aria-label',
    n ? T('act_binge_n', { n }) : T('act_binge'));
  // 생산 (8단계) — 안 본 날 수를 같은 규칙으로 적는다
  const pe = document.getElementById('produceBadge');
  if (pe) {
    const k = produceUnseen();
    pe.textContent = k > 9 ? '9+' : String(k);
    pe.hidden = k === 0;
    const pb = document.getElementById('actProduce');
    if (pb) pb.setAttribute('aria-label', k ? T('act_produce_n', { n: k }) : T('act_produce'));
  }
  // 밭 (9단계) — **안 본 침입 기록 수.** 이삭이 여문 것은 뱃지로 안 알린다:
  // 매일 여물어서 뱃지가 늘 켜져 있으면 아무것도 안 알리는 것과 같다
  const fe = document.getElementById('farmBadge');
  if (fe) {
    const k = farmUnseen();
    fe.textContent = k > 9 ? '9+' : String(k);
    fe.hidden = k === 0;
    const fb = document.getElementById('actFarm');
    if (fb) fb.setAttribute('aria-label', k ? T('act_farm_n', { n: k }) : T('act_farm'));
  }
}

// ─── 생산 기록 (최근 5일치) ──────────────────────────────────
//
// 만든 것은 **저절로 가방에 들어간다** — 이 시트는 「무엇이 들어왔는지」만 보여 준다.
// 수확 버튼을 따로 누르게 하면, 며칠 안 들어온 사람이 돌아왔을 때 **누르는 일**이
// 하나 더 생길 뿐이고 안 누르면 쌓이지도 않아 상한이 두 겹이 된다.
function openProduceLog() {
  const list = (S.produced || []).slice().reverse();     // 최근 것이 위로
  const el = document.getElementById('produceList');
  const ti = document.getElementById('produceTitle');
  const who = producers();
  if (ti) {
    // **조사를 붙인다** — 「불씨 도롱뇽이」 / 「심해 고래가」. 「이(가)」로 두면
    // 화면에 괄호가 그대로 남는다 (`josa` 는 마지막 이름의 받침을 본다)
    const names = who.map(c => N(c.id, c.name)).join(' · ');
    ti.textContent = who.length
      ? T('pd_title', { who: names, josa: josa(names, '이가') })
      : T('pd_none_pet');
  }
  if (el) {
    el.innerHTML = list.length
      ? list.map(p => {
          const items = Object.keys(p.items).map(id =>
            `<span class="pd-item">${itemArt(id)} ${itemName(id)} ×${p.items[id]}</span>`).join('');
          return `<div class="pal-item pd-row"><span class="pd-day">${fmtDayKey(p.day)}</span>
            <span class="pd-items">${items}</span></div>`;
        }).join('')
      : `<div class="empty-hint">${T('pd_empty', { n: PRODUCE_DAYS })}</div>`;
  }
  // 열면 다 본 것으로 친다
  (S.produced || []).forEach(p => { p.seen = true; });
  save();
  renderActBadges();
  const m = document.getElementById('produceLog');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closeProduceLog() {
  const m = document.getElementById('produceLog');
  if (m) m.classList.remove('show');
}
// 날짜 키(YYYYMMDD) → 「8/30」. 오늘·어제는 말로 적는다
function fmtDayKey(k) {
  const today = dayKey();
  if (k === today) return T('pd_today');
  if (daysBetween(k, today) === 1) return T('pd_yesterday');
  return `${Math.floor(k / 100) % 100}/${k % 100}`;
}
window.openProduceLog = openProduceLog;
window.closeProduceLog = closeProduceLog;

// ═══════════════════════════════════════════════════════════════
//  탐험 일지 — 읽는 쪽
//
//  세이브에는 **id 와 숫자만** 들어 있다 (`diaryAdd`). 문장은 여기서 만든다 —
//  그래야 언어를 바꿨을 때 옛 줄까지 같이 따라온다.
//
//  ⚠️ **조사도 여기서 붙인다.** 「유니콘를」이 되면 아무리 귀여운 문장도 무너진다.
//  `josa()` 는 «날것» 이름의 받침을 보므로 이모지·태그를 붙이기 «전»에 고른다.
// ═══════════════════════════════════════════════════════════════

// 한 줄을 문장으로 푼다. 열쇠를 모르면 빈 문자열 — 예전 세이브에 지금은 없는
// 열쇠가 남아 있어도 그 줄만 빠지고 일지는 그대로 열린다
function diaryLine(e) {
  const v = e.v || {};
  const p = {};
  // 재료·크리처·물약 이름 (있으면). **이모지는 문장에 안 넣는다** — 앞에 아이콘 칸이 따로 있다.
  // `itemOf` 는 재료와 크리처만 안다 — 물약은 레시피 결과에 있으므로 한 번 더 본다
  if (v.id) {
    const r = !itemOf(v.id) && D.RECIPES.find(x => x.result.id === v.id);
    p.name = r ? N(r.result.id, r.result.name) : itemName(v.id);
    p.nj = josa(p.name, '을를'); p.ni = josa(p.name, '이가');
  }
  if (v.food) { const f = foodOf(v.food); p.food = f ? N(f.id, f.name) : ''; p.fj = josa(p.food, '을를'); }
  if (v.who) {
    // **이웃 이름이거나 인물 id 다.** 밭 기록은 남이 지은 이름(그래서 `escHtml`),
    // 퀘스트는 `SPEAKERS` 의 id(`sp_*`) — 그건 이름으로 풀어야 한다.
    // ⚠️ 「부르는 말」로 푼다 (`speakerName`): 요정 대모는 설정상의 이름(알테이아)이
    // 아니라 「요정 대모」로 불린다 (STORY.md 「호칭 규칙」)
    const raw = /^sp_/.test(v.who) ? speakerName(v.who) : v.who;
    p.who = `<b class="di-who">${escHtml(raw)}</b>`; p.wj = josa(raw, '이가');
  }
  if (v.items) { p.items = stashText(v.items) || T('di_nothing'); p.ij = josa(p.items, '을를'); }
  if (v.attr) p.quip = T('di_cr_' + v.attr);
  if (v.map) {
    const m = D.MAPS.find(x => x.id === v.map);
    p.map = m ? N(m.id, m.name) : ''; p.mj = josa(p.map, '을를');
  }
  p.n = v.n || 0; p.wins = v.wins || 0; p.step = v.step || 0;
  // 마지막 단계에 닿은 날은 다른 문장이다 — 매번 같은 줄이면 마지막 날이 안 특별해진다
  const key = e.k === 'di_slim' && v.done ? 'di_slim_done' : e.k;
  const body = diaryPick(key, '', DIARY_BODIES, e, p);
  if (!body) return '';                       // 모르는 열쇠는 그 줄만 뺀다
  const tail = diaryPick(key, 't', DIARY_TAILS, e, p);
  return tail ? `${body} <span class="di-tail">${tail}</span>` : body;
}

// ═══ 한 사건에 스무 가지 ═══════════════════════════════════════
//
// **같은 일이 늘 같은 문장이면 두 번째부터는 아무도 안 읽는다.**
// 그래서 한 줄을 **본문 다섯 × 꼬리말 넷 = 스무 가지**로 짰다.
//
// 스무 줄을 통째로 쓰지 않고 둘로 나눈 이유: 열아홉 번째 「히든 재료를 주웠다」
// 농담은 반드시 약해지는데, **약한 농담은 없는 농담보다 나쁘다.** 다섯 × 넷이면
// 쓰는 양은 절반인데 읽는 사람에게는 시작도 끝도 매번 다르게 보인다.
//
// **본문이 「무슨 일이 있었나」라면 꼬리말은 「그래서 내 기분이 어땠나」다.**
// 웃음은 사건이 아니라 반응에서 나온다 — 「우리 애들이 막아 냈다」는 사실이고,
// 「요정 대모가 또 그만 먹어요! 하겠지」가 웃긴 자리다.
//
// 농담의 과녁은 늘 **우리 쪽**이다 (약탈 연출과 같은 규칙 — `roundQuip`).
// 잔소리하는 요정 대모 · 말 안 듣는 크리처 · 변명하는 공주 본인 셋이면 충분하다.
// **남을 비웃는 농담은 안 만든다** — 코지 게임이고, 이웃은 다음 주에 내가 털릴 사람이다.
//
// ⚠️ **두 표의 곱이 스무 가지다.** 한쪽만 늘리면 곱이 어긋나므로 검사기가
// `본문 × 꼬리말 === DIARY_VARIANTS` 를 본다.
const DIARY_VARIANTS = 20;
const DIARY_BODIES = {
  di_binge: 5, di_creature: 5, di_find: 5, di_rare: 5,
  di_slim: 5, di_slim_done: 5, di_raid_win: 5, di_raid_empty: 5,
  di_raid_lose: 5, di_robbed: 5, di_kept: 5, di_quest: 5,
  di_meal: 5, di_meal_night: 5,
};
const DIARY_TAILS = {
  di_binge: 4, di_creature: 4, di_find: 4, di_rare: 4,
  di_slim: 4, di_slim_done: 4, di_raid_win: 4, di_raid_empty: 4,
  di_raid_lose: 4, di_robbed: 4, di_kept: 4, di_quest: 4,
  di_meal: 4, di_meal_night: 4,
};
window.DIARY_BODIES = DIARY_BODIES;
window.DIARY_TAILS = DIARY_TAILS;
window.DIARY_VARIANTS = DIARY_VARIANTS;

// FNV-1a. `(h * 31 + c)` 로 돌리면 **끝만 다른 시드가 이웃한 값으로 몰린다** —
// 본문과 꼬리말이 같은 시드에서 나오면 스무 가지가 아니라 다섯 가지가 된다.
// 소금(`salt`)을 앞에 붙여 둘을 서로 독립으로 뽑는다
function diaryHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ⚠️ **`Math.random()` 이면 안 된다.** 일지는 열 때마다 다시 그리므로 볼 때마다
// 문장이 바뀐다 — 「내가 잘못 읽었나」가 된다 (날씨·약탈 한 마디와 같은 이유).
// 줄이 적힌 시각으로 시드를 고정하면 **줄마다 다르되 그 줄은 늘 같다.**
function diaryPick(key, salt, table, e, p) {
  const n = table[key] || 0;
  if (!n) return '';
  const i = diaryHash(`${salt}|${key}|${e.t || 0}`) % n;
  const k = `${key}_${salt}${i + 1}`;
  const s = T(k, p);
  return s === k ? '' : s;                    // 없는 문구는 그 자리만 빈다
}

// 줄 앞의 아이콘. 사건마다 하나씩 — 훑을 때 「그날 뭐가 있었나」가 먼저 읽힌다
const DIARY_ICON = {
  di_binge: '🍽️', di_creature: '🥚', di_find: '📖', di_rare: '✨',
  di_slim: '🎀', di_raid_win: '🌾', di_raid_empty: '🌾', di_raid_lose: '💦',
  di_robbed: '😿', di_kept: '🛡️', di_quest: '📜',
  di_meal: '🍲', di_meal_night: '🌙',
};
// **이 표가 사건의 목록이다.** 검사기가 여기 있는 열쇠를 하나씩 심어 보고
// 문장이 나오는지 본다 — 새 사건을 만들면 아이콘을 여기 넣는 것만으로 검사에 걸린다
window.DIARY_ICON = DIARY_ICON;

function openDiary() {
  diaryPage = 0;                 // **열면 늘 오늘부터.** 어제 넘겨 본 자리로 열면 놀란다
  renderDiary();
  const m = document.getElementById('diaryModal');
  if (m) m.classList.add('show');
  if (window.Sfx) Sfx.play('pick');
}
function closeDiary() {
  const m = document.getElementById('diaryModal');
  if (m) m.classList.remove('show');
}

// 지금 펼쳐 놓은 쪽. **0 이 제일 최근 날**이고 커질수록 과거로 간다.
// 세이브에 안 남긴다 — 어제 어디까지 넘겨 봤는지는 다음에 열 때 알 바가 아니다
let diaryPage = 0;

// 날짜별로 묶는다. **한 날이 한 쪽이다** — 책장을 넘기듯 하루씩 본다.
// 날은 새것이 앞(0쪽), 그 안은 **일어난 순서대로**다 — 하루치는 아침부터 읽어야
// 이야기가 되고, 날은 오늘부터 봐야 찾기가 쉽다
function diaryDays() {
  const all = Array.isArray(S.diary) ? S.diary : [];
  const days = [];
  all.slice().sort((a, b) => a.t - b.t).forEach(e => {
    const k = `${e.y}-${e.m}-${e.d}`;
    const last = days[days.length - 1];
    if (last && last.k === k) last.rows.push(e);
    else days.push({ k, y: e.y, m: e.m, d: e.d, rows: [e] });
  });
  return days.reverse();
}

// 쪽을 넘긴다. `d` 가 +1 이면 **과거로**(다음 쪽), −1 이면 최근으로
function diaryFlip(d) {
  const n = diaryDays().length;
  const next = Math.max(0, Math.min(n - 1, diaryPage + d));
  if (next === diaryPage) return;             // 끝에서 눌러도 아무 일 없다
  diaryPage = next;
  renderDiary();
  if (window.Sfx) Sfx.play('pick');
}
window.diaryFlip = diaryFlip;

function renderDiary() {
  const ti = document.getElementById('diaryTitle');
  if (ti) ti.textContent = T('di_title');
  const era = document.getElementById('diaryEra');
  if (era) era.textContent = T('di_era', { y: eraYear() });
  const el = document.getElementById('diaryBody');
  const nav = document.getElementById('diaryNav');
  if (!el) return;
  const days = diaryDays();
  if (!days.length) {
    el.innerHTML = `<div class="empty-hint">${T('di_empty')}</div>`;
    if (nav) nav.innerHTML = '';
    return;
  }
  // 줄이 지워져 쪽수가 줄어들 수 있다 (`DIARY_MAX`) — 범위를 벗어나면 당겨 온다
  if (diaryPage > days.length - 1) diaryPage = days.length - 1;

  const g = days[diaryPage];
  const rows = g.rows.map(e => {
    const s = diaryLine(e);
    if (!s) return '';
    return `<div class="di-row"><span class="di-ic" aria-hidden="true">${DIARY_ICON[e.k] || '·'}</span>
      <span class="di-txt">${s}</span></div>`;
  }).join('');
  el.innerHTML = `<div class="di-day"><div class="di-date">${T('di_day', { m: g.m, d: g.d })}</div>${
    rows || `<div class="empty-hint">${T('di_empty')}</div>`}</div>`;

  // 쪽 넘기기. **왼쪽이 과거다** — 책장을 뒤로 넘기는 방향과 같다.
  // 끝에 닿은 쪽은 `disabled` 로 둔다: 눌러도 아무 일 없는 버튼을 살려 두지 않는다
  if (nav) {
    nav.innerHTML = `
      <button class="di-nav-btn" onclick="diaryFlip(1)"${diaryPage >= days.length - 1 ? ' disabled' : ''}
        aria-label="${T('di_prev')}">◀</button>
      <span class="di-page">${T('di_page', { i: diaryPage + 1, n: days.length })}</span>
      <button class="di-nav-btn" onclick="diaryFlip(-1)"${diaryPage <= 0 ? ' disabled' : ''}
        aria-label="${T('di_next')}">▶</button>`;
  }
}
window.openDiary = openDiary;
window.closeDiary = closeDiary;
window.renderDiary = renderDiary;

// ═══════════════════════════════════════════════════════════════
//  밭 · 약탈 (CREATURE.md 10장 · 9단계)
//
//  **서버가 정본을 갖는 유일한 화면이다.** 게임의 다른 모든 것은 로컬이 진짜고
//  서버는 사본인데(`sync.js`), 밭만 반대다 — 남이 내 밭에서 가져간 결과가 적히는
//  곳이라 세이브 안에 두면 내가 다음에 저장하는 순간 없던 일이 된다.
//
//  그래서 여기서는 **모아 두거나 나중에 다시 보내지 않는다.** 못 닿으면 못 닿았다고
//  말한다. 빈 밭으로 그려 놓으면 「털렸구나」로 읽힌다 — 그것이 제일 나쁜 오해다.
//
//  ⚠️ **가방으로 들어가는 생산(8단계)은 그대로다.** 밭은 그것과 별개로 한 몫이
//  더 쌓이는 자리이고, 대신 남이 털어 갈 수 있다. **잃는 것은 언제나 「아직 안 받은
//  덤」**이지 이미 가진 재료가 아니다 — 코지 게임에서 가진 것을 뺏기면 다시 안 켠다.
// ═══════════════════════════════════════════════════════════════
//
// 서버가 준 밭. **세이브에 안 남긴다** — 남기면 두 벌이 되고, 어느 쪽이 맞는지
// 판단할 근거가 없다 (날씨를 세이브에 안 남기는 것과 같은 이유)
let FARM = null;
let farmBusy = false;

// 서버에서 밭을 받아 온다. 못 받으면 FARM 을 null 로 둔다 (= 「모른다」)
async function refreshFarm() {
  if (!window.Sync || !Sync.enabled()) { FARM = null; return null; }
  const r = await Sync.farmGet();
  FARM = r.status === 200 && r.body ? r.body : null;
  diaryFromFarm();
  renderActBadges();
  return FARM;
}

// 서버의 침입 기록을 일지로 옮겨 적는다.
//
// **여기가 유일하게 「내가 없는 동안 일어난 일」이 들어오는 자리다.** 나머지 줄은
// 전부 내가 버튼을 눌러서 생긴 것이고, 이것만 남이 만든다 — 며칠 만에 들어와도
// 그사이 누가 다녀갔는지가 일지에 그날 날짜로 남아야 한다.
//
// ⚠️ **같은 줄을 두 번 적지 않는다.** 서버 기록은 열 줄까지 남아 있어서 밭을
// 열 때마다 통째로 다시 온다 — 마지막으로 옮겨 적은 시각(`S.diaryFarmAt`)보다
// 뒤엣것만 적는다
function diaryFromFarm() {
  if (!FARM || !Array.isArray(FARM.log) || !FARM.log.length) return;
  const from = S.diaryFarmAt || 0;
  const fresh = FARM.log.filter(x => (x.t || 0) > from);
  if (!fresh.length) return;
  // 서버는 새것부터 주지만 일지는 시각 순으로 쌓는다
  fresh.slice().sort((a, b) => (a.t || 0) - (b.t || 0)).forEach(x => {
    diaryAdd(x.win ? 'di_robbed' : 'di_kept',
      { who: x.by || '', items: x.items || {} }, x.t || Date.now());
  });
  S.diaryFarmAt = Math.max(from, ...fresh.map(x => x.t || 0));
  save();
}
window.refreshFarm = refreshFarm;

// 안 본 침입 기록 수 — `S.farmSeenAt`(밭을 마지막으로 연 시각) 뒤에 온 것만 센다
function farmUnseen() {
  if (!FARM || !Array.isArray(FARM.log)) return 0;
  const seen = S.farmSeenAt || 0;
  return FARM.log.filter(x => (x.t || 0) > seen).length;
}

// **남이 지은 이름은 그대로 붙이지 않는다.** 서버의 `NAME_ALLOW` 가 글자·숫자·한글만
// 통과시키지만, 그건 지금 규칙이고 밭에 적힌 이름은 남이 쓴 값이다 — 화면에 넣기 전에
// 한 번 접는다 (이 게임에서 **남이 쓴 글자가 내 화면에 나오는 첫 자리**다)
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// { 재료id: 개수 } → 「🪰 반딧불이 ×9」 줄
const stashLine = st => Object.keys(st || {})
  .map(id => `<span class="pd-item">${itemArt(id)} ${itemName(id)} ×${st[id]}</span>`).join('');
// 토스트용 — 그림 없이 말로만
const stashText = st => Object.keys(st || {})
  .map(id => `${itemName(id)} ${st[id]}`).join(' · ');

// 칸 한 줄. 상태가 셋이다 — **심었고 자라는 중 · 다 자람 · 비어 있음(이삭)**
function plotRow(p, i, now) {
  const no = `<span class="plot-no">${i + 1}</span>`;
  if (p.crop) {
    const left = (p.ready || 0) - now;
    const ready = left <= 0;
    return `<div class="plot-row${ready ? ' ripe' : ''}">${no}
      <span class="plot-what">${itemArt(p.crop)} ${itemName(p.crop)} ×${p.n || 0}</span>
      <span class="plot-when">${ready ? T('plot_ready') : T('plot_left', { t: leftText(left) })}</span>
    </div>`;
  }
  const ears = countOfObj(p.stash);
  // **빈 칸은 누르면 심는 자리다.** 이삭이 남아 있으면 먼저 거둬야 한다 —
  // 심으면서 이삭을 조용히 버리는 것보다 「먼저 거두세요」가 낫다
  return `<button class="plot-row plot-open" onclick="openPlant(${i})">${no}
    <span class="plot-what">${ears ? stashLine(p.stash) : `<span class="farm-none">${T('plot_empty')}</span>`}</span>
    <span class="plot-when">${ears ? T('plot_ears') : T('plot_sow')}</span>
  </button>`;
}
const countOfObj = o => Object.values(o || {}).reduce((a, b) => a + b, 0);

// 부대 한 줄 — 다섯 자리를 작게 늘어놓는다.
// **번호를 붙인다.** 자리 번호가 곧 칸 번호이자 붙는 상대의 번호라, 번호가 없으면
// 「몇 번이 몇 번과 붙는지」를 눈으로 셀 수가 없다
// `wide` 를 주면 **다섯이 폭을 나눠 갖고 한 줄에 선다**(`.tm-row.big`).
// 이웃 밭 목록에서 꼭 필요하다 — 아래의 칸 다섯과 **세로로 맞춰 읽는** 줄이라
// 4+1 로 접히는 순간 「3번을 이기면 3번 칸」이라는 연결이 통째로 깨진다
// (265px 에서 3번끼리 46px 어긋난 것을 검사기가 잡았다)
function teamRow(team, kind, vs, wide) {
  // 내 줄이면 **자리마다 누를 수 있다** — 3번을 바꾸려고 1번부터 짚어 갈 이유가 없다.
  // 상대 줄('foe')은 누를 것이 아니므로 그냥 칸이다
  const own = kind === 'def' || kind === 'atk';
  const cells = [];
  for (let i = 0; i < 5; i++) {
    const b = team && team[i];
    const c = b ? creatureOf(b.id) : null;
    // 색은 **찾아 온 크리처**에서 뽑는다. 서버가 준 `b.attr` 에만 기대면 로컬에서
    // 만든 `{id}` 짜리 줄(출정대·방어대)은 색이 통째로 빠진다
    const attr = c ? D.creatureAttr(c.attr) : null;
    // 상대 줄이면 **내 같은 자리와의 상성**으로 테두리를 물들인다
    const tag = vs ? matchTag(vs[i] ? creatureOf(vs[i].id) : null, b) : null;
    const inner = `<span class="tm-no">${i + 1}</span>
      ${c && window.Creature ? Creature.icon(c, 26) : ''}`;
    // ⚠️ `big` 은 **줄과 칸 양쪽에** 붙어야 한다. 줄에만 붙이면 `nowrap` 만 걸리고
    // 칸은 40px 로 박혀 있어서 다섯이 그대로 밖으로 밀려 나간다 (157px 칸에 236px)
    const cls = `tm-slot${wide ? ' big' : ''}${tag ? ' ' + tag.k : ''}${b ? '' : ' off'}`;
    const st = attr ? `style="--at:${attr.color}"` : '';
    cells.push(own
      ? `<button class="${cls}" ${st} onclick="openTeam('${kind}', ${i})"
          aria-label="${T('team_slot_n', { n: i + 1 })}">${inner}</button>`
      : `<span class="${cls}" ${st}>${inner}</span>`);
  }
  return `<div class="tm-row${wide ? ' big' : ''}">${cells.join('')}</div>`;
}

// **처음 열면 센 다섯을 세워 준다.** 빈 밭은 그냥 털리는 밭이라,
// 「아무것도 안 한 상태」가 곧 손해가 되면 안 된다 — 바꾸는 것은 언제든 된다.
// **한 자리라도 사람이 채워 뒀으면 안 건드린다.**
function autoTeam(key) {
  const arr = teamArr(key);
  if (arr.some(Boolean)) return false;
  // ⚠️ **다른 부대에 선 아이는 빼고 고른다.** 한 마리는 한쪽에만 설 수 있는데,
  // 그냥 센 순서로 다섯을 뽑으면 방어대와 공격대가 **같은 다섯**이 되어
  // 부대 고르기 화면이 통째로 회색이 된다
  const other = teamArr(key === 'atk' ? 'def' : 'atk');
  const ids = [...new Set(S.creatures)]
    .filter(id => creatureOf(id) && other.indexOf(id) < 0);
  if (!ids.length) return false;
  ids.sort((a, b) => combatPower(creatureOf(b)) - combatPower(creatureOf(a)));
  ids.slice(0, 5).forEach((id, i) => { arr[i] = id; });
  save();
  return true;
}

// **밭은 랭킹과 같은 자리에서 열린다** (매력 100 = 여신 · `FARM.md` 1장).
// 남과 부딪히는 기능이 이 둘뿐이라, 한 문 뒤에 두면 「여신이 되면 사람들 사이로
// 나간다」는 한 문장이 된다. 따로 열면 설명이 두 벌이 된다.
//
// ⚠️ **`charmPeak()`(여태 닿은 최고 매력)으로 판정한다.** 총합을 그대로 보면 애착
// 크리처를 약한 것으로 바꾼 순간 밭 탭이 통째로 사라진다 — 맵에서 겪은 사고와 같다.
// **한 번 연 것은 무슨 이유로도 닫히지 않는다.**
function farmOpen() { return charmPeak() >= D.LEAGUE.openAt; }
window.farmOpen = farmOpen;

// 밭을 연다. **여신부터는 탐험의 밭 탭으로 보낸다** — 같은 것을 두 자리에서
// 다르게 보여 주지 않는다. 그 전에는 지금까지처럼 마이 룸 시트로 연다
// (작은 밭이 그대로 큰 밭의 튜토리얼 노릇을 한다)
function openFarm() {
  if (farmOpen()) {
    closeFarm();                 // 여신이 되기 전에 열어 둔 시트가 남아 있을 수 있다
    switchTab('gather');
    setGatherTab('farm');
    if (window.Sfx) Sfx.play('pick');
    return;
  }
  const el = document.getElementById('farmSheet');
  if (!el) return;
  el.classList.add('show');
  renderFarm();                       // 먼저 그리고(있는 값으로) 받아 온 뒤 다시 그린다
  pullFarm();
  if (window.Sfx) Sfx.play('pick');
}

// 서버에서 받아 와 다시 그리고, 「어디까지 봤나」를 적는다.
// **연 뒤에 적는다** — 먼저 적으면 못 받았을 때도 「봤다」가 되어 침입 기록을 영영 못 본다
function pullFarm() {
  // **밭을 볼 때 방어대를 세워 준다.** 빈 밭은 그냥 털리는 밭이라, 「아무것도 안 한
  // 상태」가 곧 손해가 되면 안 된다 (autoTeam 은 한 자리라도 채워 뒀으면 안 건드린다)
  if (autoTeam('def')) toast(T('team_auto'), null, 3200);
  return refreshFarm().then(() => {
    if (FARM) { S.farmSeenAt = FARM.now || Date.now(); save(); }
    renderFarm();
    renderActBadges();
  });
}
window.pullFarm = pullFarm;
function closeFarm() {
  const el = document.getElementById('farmSheet');
  if (el) el.classList.remove('show');
}

// 마이 룸 시트와 탐험의 밭 탭에 **같은 것을 같은 함수가 그린다.**
// 두 벌로 두면 한쪽만 고치는 일이 반드시 생긴다
function renderFarm() {
  const ti = document.getElementById('farmTitle');
  if (ti) ti.textContent = T('farm_title');
  const html = farmHtml();
  ['farmBody', 'farmPanelBody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function farmHtml() {
  // 못 닿았을 때 — **빈 밭으로 그리지 않는다.** 버튼도 안 내놓는다
  // (눌러도 아무 일 없는 버튼을 두지 않는다)
  if (!FARM) return `<div class="empty-hint">${T('farm_offline')}</div>`;

  const now = FARM.now || Date.now();
  const rows = [];
  rows.push(`<div class="farm-lead">${T('farm_lead')}</div>`);
  // **방어대 다섯 자리** — 자리 번호 = 칸 번호다 (5단계).
  //
  // ⚠️ **`FARM.def`(서버가 준 값)로 그리지 않는다.** 부대는 세이브 안에 있고
  // 세이브는 클라이언트가 정본이다 — 서버 값으로 그리면 자리를 바꿔도 화면이
  // 그대로다(저장이 올라가고 밭을 다시 받아 와야 바뀐다). 실제로 그 버그가 났다.
  // 서버 값은 「서버가 지금 무엇으로 지켜 줄지」이고, 여기서 보여 줄 것은
  // 「내가 방금 고른 것」이다
  const def = myDefTeam();
  rows.push(`<div class="farm-row farm-logk">${T('farm_def')}
    <button class="tm-edit" onclick="openTeam('def')">${T('team_edit')}</button></div>`);
  rows.push(teamRow(def, 'def'));
  if (def.every(x => !x)) rows.push(`<div class="farm-hint">${T('farm_def_none')}</div>`);

  // ─── 칸 (FARM.md 3장) ───
  // **칸 하나 = 심으면 특수 작물, 비워 두면 크리처의 이삭.**
  // 한 줄에 「번호 · 무엇이 · 언제」가 같이 있어야 몇 번을 손봐야 하는지 안 외운다
  const plots = Array.isArray(FARM.plots) ? FARM.plots : [];
  rows.push(`<div class="farm-row farm-logk">${T('farm_plots')}</div>`);
  rows.push('<div class="plot-list">' + plots.map((p, i) => plotRow(p, i, now)).join('') + '</div>');
  // 다음 칸 — 다 샀으면 아예 안 내놓는다
  if (plots.length < (FARM.plotMax || D.PLOT_COST.length)) {
    const cost = D.PLOT_COST[plots.length] || 0;
    const can = (S.crystal || 0) >= cost;
    rows.push(`<button class="plot-buy${can ? '' : ' lack'}" onclick="buyPlot()">
      ➕ ${T('farm_plot_buy', { n: plots.length + 1 })}
      <span class="plot-cost">💎 ${fmtCount(cost)}</span></button>`);
  }
  const nextGrow = (FARM.nextGrowAt || 0) - now;
  if (nextGrow > 0 && FARM.daily && Object.keys(FARM.daily).length) {
    rows.push(`<div class="farm-hint">${T('farm_next', { t: leftText(nextGrow) })}
      · ${T('farm_cap', { n: FARM.days })}</div>`);
  }
  // 방패 — 걸려 있는 동안은 아무도 못 턴다
  if ((FARM.shieldUntil || 0) > now) {
    rows.push(`<div class="farm-row farm-shield">🛡 ${T('farm_shield',
      { t: leftText(FARM.shieldUntil - now) })}</div>`);
  }
  // 약탈권
  const nextRaid = (FARM.nextRaidAt || 0) - now;
  rows.push(`<div class="farm-row"><span class="farm-k">${T('farm_raids_k')}</span>
    <span>${FARM.raids}/${FARM.raidMax}${
      FARM.raids < FARM.raidMax && nextRaid > 0
        ? ` <span class="farm-hint">${T('farm_raids_next', { t: leftText(nextRaid) })}</span>` : ''}</span></div>`);

  // 침입 기록
  const log = Array.isArray(FARM.log) ? FARM.log : [];
  rows.push(`<div class="farm-row farm-logk">${T('farm_log')}</div>`);
  rows.push(log.length
    ? `<div class="farm-log">${log.map(x => {
        const who = x.by || T('farm_someone');
        // **조사를 붙인다** — 「도둑고양이가」 / 「루비는」. 「이(가)」로 두면 화면에
        // 괄호가 그대로 남는다. 가져간 것에도 붙는다: 「반딧불이 3을」 / 「호두 2를」
        const it = stashText(x.items);
        // **이름은 색으로 띄운다** — 줄이 여럿이면 누가 왔는지가 제일 먼저 읽혀야 한다.
        // ⚠️ `escHtml` 을 지난다. 남이 지은 글자가 내 화면의 HTML 로 들어가는
        // 자리다 (이웃 밭 목록에서 이미 같은 이유로 escHtml 을 쓴다).
        // **조사는 «날것» 이름으로 고른다** — 태그가 붙은 문자열은 끝 글자가 `>` 다
        const whoHtml = `<b class="farm-who">${escHtml(who)}</b>`;
        return `<div class="farm-logrow">${x.win
          ? T('farm_log_win', { who: whoHtml, josa: josa(who, '이가'), items: it, ij: josa(it, '을를') })
          : T('farm_log_lose', { who: whoHtml, josa: josa(who, '을를') })}</div>`;
      }).join('')}</div>`
    : `<div class="farm-hint">${T('farm_log_none')}</div>`);

  // 버튼도 여기서 같이 낸다 — 본문과 버튼이 따로 있으면 못 닿았을 때 한쪽만 숨는다
  // ⚠️ **id 를 안 붙인다.** 같은 HTML 이 시트와 탭 두 곳에 들어가므로 id 를 쓰면
  // 문서에 같은 id 가 둘이 된다 (`getElementById` 가 어느 쪽을 줄지 정해져 있지 않다)
  rows.push(`<div class="farm-btns">
    <button class="btn btn-primary farm-do-harvest" onclick="harvestFarm()"${FARM.count ? '' : ' disabled'}>
      ${FARM.count ? T('farm_harvest_n', { n: FARM.count }) : T('farm_harvest')}</button>
    <button class="btn btn-ghost farm-do-raid" onclick="openRaidPick()">${T('farm_go_raid')}</button>
  </div>`);
  return rows.join('');
}

// 거두기 — 서버가 밭을 비우고 목록을 돌려주면 그것을 가방에 넣는다.
// **nonce 로 멱등이다** — 응답을 못 받고 다시 눌러도 두 번 들어오지 않는다
async function harvestFarm() {
  if (farmBusy || !FARM || !FARM.count) return;
  farmBusy = true;
  const r = await Sync.harvest(Sync.nonce());
  farmBusy = false;
  if (r.status !== 200 || !r.body || !r.body.items) {
    toast(T(r.status === 409 ? 'farm_empty' : 'farm_err'));
    await refreshFarm(); renderFarm();
    return;
  }
  const items = r.body.items;
  Object.keys(items).forEach(id => addInv(id, items[id]));
  rec('harvested', Object.values(items).reduce((a, b) => a + b, 0));
  save();
  toast(T('farm_got', { items: stashText(items) }), null, 2600);
  if (window.Sfx) Sfx.play('pick');
  await refreshFarm();
  renderFarm();
  render();
}

// ─── 심기 ────────────────────────────────────────────────────
//
// **씨앗 칸을 만들지 않았다.** 심을 때 작물을 고르고 **이미 있는 재료**를 낸다 —
// 「씨앗」이라는 새 물건을 만들면 재료·음식·먹이에 이어 네 번째 가방이 생기고,
// 그것을 얻는 길·보관 화면·번역이 한 벌씩 더 필요하다 (`FARM.md` 4장)
let plantAt = -1;

const costOk = c => Object.keys(c.cost).every(id => invCount(id) >= c.cost[id]);

function openPlant(i) {
  const p = (FARM && FARM.plots && FARM.plots[i]) || null;
  if (!p) return;
  if (countOfObj(p.stash)) { toast(T('plot_ears_first')); return; }
  plantAt = i;
  const el = document.getElementById('plantPick');
  if (!el) return;
  const ti = document.getElementById('plantTitle');
  if (ti) ti.textContent = T('plant_title', { n: i + 1 });
  const list = document.getElementById('plantList');
  if (list) {
    list.innerHTML = D.FARM_CROPS.map(c => {
      const attr = D.creatureAttr(c.attr);
      const ok = costOk(c);
      // **없는 재료를 회색으로 남긴다.** 목록에서 빼 버리면 무엇이 모자란지 모른다
      const cost = Object.keys(c.cost).map(id =>
        `<span class="pd-item${invCount(id) >= c.cost[id] ? '' : ' lack'}">${itemArt(id)} ${itemName(id)}
          ${invCount(id)}/${c.cost[id]}</span>`).join('');
      return `<button class="pal-item plant-item${ok ? '' : ' off'}" onclick="doPlant('${c.id}')">
        <span class="plant-head">${itemArt(c.id)} <span class="raid-name">${itemName(c.id)}</span>
          ${attr ? `<span class="cr-attr" style="--at:${attr.color}">${N(attr.id, attr.name)}</span>` : ''}</span>
        <span class="pd-items">${cost}</span>
        <span class="farm-hint">${T('plant_time', { t: leftText(c.hours * 3600e3) , n: c.n })}</span>
      </button>`;
    }).join('');
  }
  el.classList.add('show');
}
function closePlant() {
  const el = document.getElementById('plantPick');
  if (el) el.classList.remove('show');
}

async function doPlant(cropId) {
  const c = D.farmCrop(cropId);
  if (!c || farmBusy || plantAt < 0) return;
  if (!costOk(c)) { toast(T('mat_short')); return; }
  farmBusy = true;
  const r = await Sync.plant(plantAt, cropId, Sync.nonce());
  farmBusy = false;
  if (r.status !== 200 || !r.body) {
    const e = (r.body && r.body.error) || '';
    toast(T(e === 'plot_ears' ? 'plot_ears_first' : e === 'plot_busy' ? 'plant_busy' : 'farm_err'));
    await refreshFarm(); renderFarm();
    return;
  }
  // **값은 심은 것이 확인된 다음에 낸다.** 먼저 깎으면 서버에 못 닿았을 때
  // 재료만 사라진다 (재료는 세이브 안에 있어 서버가 대신 돌려줄 수 없다)
  Object.keys(c.cost).forEach(id => removeInv(id, c.cost[id]));
  rec('planted');
  save();
  closePlant();
  const nm = itemName(cropId);
  toast(T('plant_done', { name: nm, josa: josa(nm, '을를') }), null, 2600);
  if (window.Sfx) Sfx.play('pick');
  await refreshFarm();
  renderFarm();
  render();
}

// 칸 하나를 더 산다 — **현자의 결정**으로 낸다 (AP 충전에 이은 두 번째 출구)
async function buyPlot() {
  if (farmBusy || !FARM) return;
  const n = (FARM.plots || []).length;
  const cost = D.PLOT_COST[n] || 0;
  if (n >= (FARM.plotMax || D.PLOT_COST.length)) { toast(T('farm_plot_max')); return; }
  if ((S.crystal || 0) < cost) { openDiamondShop(); return; }
  farmBusy = true;
  const r = await Sync.addPlot(Sync.nonce());
  farmBusy = false;
  if (r.status !== 200 || !r.body) { toast(T('farm_err')); return; }
  S.crystal = Math.max(0, (S.crystal || 0) - cost);
  save();
  toast(T('farm_plot_got', { n: n + 1 }), null, 2400);
  if (window.Sfx) Sfx.play('success');
  await refreshFarm();
  renderFarm();
  render();
}

// ─── 부대 짜기 (FARM.md 5장) ─────────────────────────────────
//
// **자리를 먼저 고르고 크리처를 고른다.** 한 화면에 둘 다 두면 「몇 번 자리에
// 넣는 것인지」가 늘 보인다 — 단계를 나누면 「뒤로」가 필요해지고 다섯 번 왕복한다.
let teamKey = 'def';        // 'def' 내 밭을 지키는 다섯 / 'atk' 남의 밭으로 가는 다섯
let teamAt = 0;             // 지금 고르고 있는 자리

const teamArr = key => {
  const k = key === 'atk' ? 'farmAtk' : 'farmDef';
  if (!Array.isArray(S[k]) || S[k].length !== 5) S[k] = [null, null, null, null, null];
  return S[k];
};

function openTeam(key, at) {
  teamKey = key === 'atk' ? 'atk' : 'def';
  teamAt = Number.isInteger(at) && at >= 0 && at < 5 ? at : 0;
  const el = document.getElementById('teamPick');
  if (!el) return;
  el.classList.add('show');
  renderTeam();
}
function closeTeam() {
  const el = document.getElementById('teamPick');
  if (el) el.classList.remove('show');
}

function renderTeam() {
  const ti = document.getElementById('teamTitle');
  if (ti) ti.textContent = T(teamKey === 'atk' ? 'team_title_atk' : 'team_title_def');
  const arr = teamArr(teamKey);
  const slots = document.getElementById('teamSlots');
  if (slots) {
    slots.innerHTML = arr.map((id, i) => {
      const c = id ? creatureOf(id) : null;
      const attr = c ? D.creatureAttr(c.attr) : null;
      return `<button class="tm-slot big${i === teamAt ? ' on' : ''}${c ? '' : ' off'}"
        ${attr ? `style="--at:${attr.color}"` : ''} onclick="pickSlot(${i})">
        <span class="tm-no">${i + 1}</span>
        ${c && window.Creature ? Creature.icon(c, 34) : ''}
      </button>`;
    }).join('');
  }
  const list = document.getElementById('teamList');
  if (list) {
    // 가진 것만. **이미 다른 자리에 선 아이는 회색**이다 — 목록에서 빼면
    // 「내 유니콘이 어디 갔지」가 되고, 그대로 두면 같은 아이를 두 자리에 넣게 된다
    const ids = [...new Set(S.creatures)].filter(id => creatureOf(id));
    // **한 마리는 방어대·공격대 둘 중 한쪽에만 선다.** 다른 쪽에 서 있는 아이는
    // 회색으로 두고 **맨 아래로 내린다** — 고를 수 있는 것이 위에 모여야
    // 「누굴 넣지」가 한눈에 끝난다. 누르면 옮길지 물어본다 (`setSlot`)
    const otherArr = teamArr(teamKey === 'atk' ? 'def' : 'atk');
    // ⚠️ **이 부대에 이미 서 있는 아이는 회색이 아니다.** 옛 세이브는 양쪽에
    // 같은 아이가 겹쳐 있을 수 있는데(예전 `autoTeam` 이 그렇게 채웠다),
    // 그것까지 회색으로 두면 «지금 서 있는 자리»가 못 서는 것처럼 보인다
    const taken = id => otherArr.indexOf(id) >= 0 && arr.indexOf(id) < 0;
    // 회색만 뒤로 민다 — 나머지 순서는 그대로 (정렬이 바뀌면 찾던 자리가 없어진다)
    const sorted = ids.filter(id => !taken(id)).concat(ids.filter(taken));
    const none = `<button class="pal-item" onclick="setSlot(null)">
      <span class="pal-art">➖</span><span class="pal-name">${T('team_clear')}</span></button>`;
    list.innerHTML = none + sorted.map(id => {
      const c = creatureOf(id);
      const attr = D.creatureAttr(c.attr);
      const at = arr.indexOf(id);
      const busy = at >= 0 && at !== teamAt;
      const other = taken(id);
      return `<button class="pal-item${arr[teamAt] === id ? ' on' : ''}${busy || other ? ' off' : ''}"
        onclick="setSlot('${id}')" ${other ? 'data-other="1"' : ''}>
        <span class="pal-art">${window.Creature ? Creature.icon(c, 34) : ''}</span>
        <span class="pal-name">${N(c.id, c.name)}</span>
        ${attr ? `<span class="cr-attr" style="--at:${attr.color}">${N(attr.id, attr.name)}</span>` : ''}
        <span class="farm-pow">${T('farm_power', { n: combatPower(c) })}</span>
        ${other ? `<span class="raid-tag locked">${T(teamKey === 'atk' ? 'team_in_def' : 'team_in_atk')}</span>`
          : busy ? `<span class="raid-tag">${T('team_swap', { n: at + 1 })}</span>` : ''}
      </button>`;
    }).join('');
  }
}
// 전투력 — **서버와 같은 규칙이다.** 여기 것은 안내용이고 판정은 서버가 한다
// (`server/battle.js`). 둘 다 `data.js` 의 `combat` 한 표를 읽으므로 같이 바뀐다
const combatPower = c => {
  const b = (c && c.combat) || {};
  return (b.atk || 0) + (b.matk || 0) + (b.def || 0) + (b.mdef || 0);
};

function pickSlot(i) { teamAt = i; renderTeam(); }
function setSlot(id) {
  const arr = teamArr(teamKey);
  if (id && !ownsCreature(id)) return;
  // **다른 부대에 서 있는 아이는 그냥 못 데려온다.** 그냥 막으면 「왜 안 되지」로
  // 끝나므로 «옮길지» 를 물어본다 — 한 마리가 양쪽에 설 수 없다는 규칙을
  // 이 한 번의 물음이 알려 준다
  const otherKey = teamKey === 'atk' ? 'def' : 'atk';
  if (id && teamArr(otherKey).indexOf(id) >= 0) {
    const c = creatureOf(id);
    // ⚠️ 지금 자리(`teamAt`)와 부대(`teamKey`)를 **붙들어 둔다.** 확인 패널이
    // 떠 있는 동안에도 사람은 뒤의 자리를 누를 수 있고, 그러면 옮긴 아이가
    // 엉뚱한 자리에 들어간다
    const at = teamAt, key = teamKey;
    showConfirm(T(key === 'atk' ? 'team_move_to_atk' : 'team_move_to_def'), () => {
      const from = teamArr(key === 'atk' ? 'def' : 'atk');
      const i = from.indexOf(id);
      if (i >= 0) from[i] = null;
      teamAt = at; teamKey = key;
      putSlot(id);
      toast(T('team_moved', { name: N(c.id, c.name) }));
    }, null, T('team_move_ok'));
    return;
  }
  putSlot(id);
}
// 실제로 자리에 넣는다 (물어볼 것이 없을 때의 몸통)
function putSlot(id) {
  const arr = teamArr(teamKey);
  const at = id ? arr.indexOf(id) : -1;
  // **이미 다른 자리에 선 아이를 고르면 두 자리를 맞바꾼다.**
  // 자리 대 자리로 붙으므로 **순서가 곧 전략**인데, 「이미 3번에 있어요」로 막으면
  // 순서를 바꾸려고 비우고 다시 넣기를 반복하게 된다.
  // (같은 아이가 두 자리에 서는 일은 맞바꾸기로도 안 생긴다)
  if (at >= 0 && at !== teamAt) {
    arr[at] = arr[teamAt];
    arr[teamAt] = id;
  } else {
    arr[teamAt] = id || null;
    // 채운 경우에만 다음 빈 자리로 옮겨 준다 — 다섯 번 다 손으로 짚게 하지 않는다.
    // **비운 경우는 그 자리에 머문다** (비우자마자 딴 데로 가면 다시 짚어야 한다)
    if (id) { const nx = arr.indexOf(null); teamAt = nx >= 0 ? nx : teamAt; }
  }
  save();
  renderTeam();
  renderFarm();
  // 이웃 밭이 열려 있으면 상성 딱지가 바뀐다 — 같이 다시 그린다
  if (document.getElementById('raidPick').classList.contains('show')) renderRaidList();
  if (window.Sfx) Sfx.play('pick');
}

window.openTeam = openTeam;
window.autoTeam = autoTeam;
window.closeTeam = closeTeam;
window.pickSlot = pickSlot;
window.setSlot = setSlot;

// ─── 이웃 밭 ─────────────────────────────────────────────────
let RAIDS = null;

function openRaidPick() {
  // 나갈 때도 세워 준다 — 한 마리만 나가면 다섯 판 중 넷을 그냥 진다
  // (autoTeam 은 한 자리라도 사람이 채워 뒀으면 안 건드린다)
  autoTeam('atk');
  // **출정대를 봐야 한다.** 예전에는 동행(`petField`) 하나만 봤는데, 5단계부터는
  // 출정대가 따로 있어서 동행이 없어도 나갈 수 있다 (그 반대도 마찬가지다)
  const has = teamArr('atk').some(id => id && ownsCreature(id))
    || (S.petField && ownsCreature(S.petField));
  if (!has) { toast(T('farm_no_pal')); return; }
  if (FARM && FARM.raids < 1) {
    const t = (FARM.nextRaidAt || 0) - (FARM.now || Date.now());
    toast(T('farm_no_raids', { t: leftText(Math.max(60000, t)) }));
    return;
  }
  const el = document.getElementById('raidPick');
  if (!el) return;
  el.classList.add('show');
  const ti = document.getElementById('raidTitle');
  if (ti) ti.textContent = T('raid_title');
  const list = document.getElementById('raidList');
  if (list) list.innerHTML = `<div class="empty-hint">${T('raid_loading')}</div>`;
  Sync.raidTargets().then(r => {
    RAIDS = r.status === 200 && r.body ? r.body.targets || [] : null;
    renderRaidList();
  });
}
function closeRaidPick() {
  const el = document.getElementById('raidPick');
  if (el) el.classList.remove('show');
}

function renderRaidList() {
  const list = document.getElementById('raidList');
  if (!list) return;
  if (!RAIDS) { list.innerHTML = `<div class="empty-hint">${T('farm_err')}</div>`; return; }
  if (!RAIDS.length) { list.innerHTML = `<div class="empty-hint">${T('raid_none')}</div>`; return; }
  // 내 출정대 (안 짰으면 동행 한 마리가 1번 자리 — 서버와 같은 규칙)
  const mine = myAtkTeam();
  const head = document.getElementById('raidMine');
  if (head) {
    head.innerHTML = `<div class="farm-row farm-logk">${T('raid_mine')}
      <button class="tm-edit" onclick="openTeam('atk')">${T('team_edit')}</button></div>`
      // 내 출정대도 **한 줄에 다섯**이다. 바로 아래 이웃 밭들이 한 줄로 서는데
      // 이것만 3+2 로 접히면 같은 다섯인지 눈에 안 들어온다
      + teamRow(mine.map(x => (x ? { id: x.id, attr: (creatureOf(x.id) || {}).attr } : null)), 'atk', null, true);
  }
  list.innerHTML = RAIDS.map((t, i) => {
    // **상성을 자리마다 미리 보여 준다.** 순환(불➔땅➔바람➔물, 빛↔암흑)을 쓰는
    // 자리라, 결과만 보고는 무엇이 왜 유리했는지 아무도 못 배운다.
    // 줄 머리의 딱지는 **다섯 자리를 통틀어** 유리한 자리가 많은지 적은지다
    const def = Array.isArray(t.def) ? t.def : [];
    const mineC = k => (mine[k] ? creatureOf(mine[k].id) : null);
    let good = 0, bad = 0;
    def.forEach((b, k) => {
      if (!b) return;
      const g = matchTag(mineC(k), b).k;
      if (g === 'good') good++; else if (g === 'bad') bad++;
    });
    const tag = good > bad ? { k: 'good', txt: T('raid_good') }
      : bad > good ? { k: 'bad', txt: T('raid_bad') } : { k: 'even', txt: T('raid_even') };
    // **이름을 onclick 안에 넣지 않는다.** 남이 지은 글자라 따옴표 하나로 코드가 되고,
    // 실제로 이 게임에서 남이 쓴 글자가 내 화면에 나오는 첫 자리다. 자리 번호만 넘긴다
    return `<button class="pal-item raid-item" onclick="doRaid(${i})">
      <span class="raid-name">${escHtml(t.name)}
        <span class="raid-tag ${tag.k}">${tag.txt}</span></span>
      ${teamRow(def, 'foe', mine, true)}
      ${plotStrip(t)}
    </button>`;
  }).join('');
}

// ═══ 가기 전에 보이는 밭 (FARM.md 9-3) ═══════════════════════
//
// **「가 보니 아무것도 없었다」를 없앤다.** 예전에는 이삭 개수 한 줄만 보여 줬는데,
// 그것만으로는 세 가지를 알 수 없었다:
//   ① 어느 «칸»에 있나 — 자리 번호 = 칸 번호라 **이길 자리가 정해져 있다.**
//      이삭이 1번 칸에만 있으면 2~5번을 다 이겨도 빈손이다 (실제로 신고가 왔다)
//   ② 작물이 **다 자랐나** — 자라는 중인 칸은 이겨도 안 건드린다
//   ③ **바닥**에 걸리나 — 하루치는 못 가져간다
//
// 그래서 칸 다섯을 **지키개 줄 바로 아래, 같은 다섯 칸으로** 그린다.
// 세로로 읽으면 「3번 크리처를 이기면 → 3번 칸의 🌶 를 가져온다」가 한눈에 보인다.
// 가로로 늘어놓기만 하고 자리를 안 맞추면 이 연결이 통째로 사라진다.
function plotStrip(t) {
  const plots = Array.isArray(t.plots) ? t.plots : [];
  const now = (FARM && FARM.now) || Date.now();
  const cells = [];
  let takeable = 0;                 // 다 자란 작물이 있는 칸 (이겨서 바로 나오는 칸)
  let earsSeen = 0;                 // 칸에 보이는 이삭 합계
  let soon = null;                  // 제일 먼저 다 자라는 칸
  for (let i = 0; i < 5; i++) {
    const p = plots[i];
    if (!p) { cells.push(`<span class="ps-cell none" aria-hidden="true">·</span>`); continue; }
    if (p.crop) {
      const ripe = (p.ready || 0) <= now;
      // ⚠️ **이모지는 `FARM_CROPS` 에 없다.** 그 표는 축(속성·시간·개수·값)만 갖고,
      // 이모지와 이름은 재료 표에 있다 — `itemOf()` 를 지나야 한다.
      // 처음에 `c.emoji` 로 썼다가 칸에 글자 「undefined」가 그대로 찍혔다 (검사기가 잡았다)
      const it = itemOf(p.crop);
      const emo = (it && it.emoji) || '🌱';
      if (ripe) {
        takeable++;
        cells.push(`<span class="ps-cell crop" title="${T('ps_ripe')}">${emo}<b>${p.n || 0}</b></span>`);
      } else {
        // **자라는 중인 칸은 이겨도 못 가져간다.** 그것을 «가기 전에» 알려 준다 —
        // 모르면 여기를 노리고 순서를 짜게 된다.
        // ⚠️ 남은 시간을 «칸 안»에 적지 않는다 — 265px 에서 칸 하나가 30px 인데
        // 「6시간」은 그보다 넓고, 11px 밑으로 줄이면 글자 크기 기준에 걸린다.
        // 자리는 칸이 알려 주고, 시간은 아래 요약 줄이 말한다
        if (!soon || (p.ready || 0) < soon.at) soon = { at: p.ready || 0, i: i + 1 };
        cells.push(`<span class="ps-cell grow" title="${T('ps_grow')}">⏳</span>`);
      }
      continue;
    }
    const ears = p.ears || 0;
    if (ears > 0) { earsSeen += ears; cells.push(`<span class="ps-cell ears">🌾<b>${ears}</b></span>`); }
    else cells.push(`<span class="ps-cell none" aria-hidden="true">·</span>`);
  }
  // 바닥 — 서버가 그 사람의 하루치로 계산해 보내 준다.
  // **이삭에만 걸린다** (작물은 안 걸린다)
  const floor = Math.max(0, t.floor || 0);
  const ears = Math.max(0, t.count || earsSeen);
  const canTake = Math.max(0, ears - floor);
  const hasCrop = takeable > 0;
  // ⚠️ **이삭이 보인다고 가져갈 수 있는 것이 아니다.** 바닥(하루치)에 걸리면
  // 이삭이 네 개 있어도 한 개도 못 가져간다 — 처음에 「이삭이 있으면 가져갈 수 있다」로
  // 세었다가 검사기가 잡았다. 여기가 이 미리보기를 만든 이유 그 자체다
  const anything = hasCrop || canTake > 0;
  // 한 줄 요약. **「없다」를 분명히 말한다** — 흐리게 적으면 가 보고 나서야 안다
  const sum = !anything
    ? `<span class="ps-sum bad">${T('ps_nothing')}</span>`
    : `<span class="ps-sum${hasCrop ? ' crop' : ''}">${
        hasCrop ? T('ps_has_crop', { n: takeable }) : T('ps_has', { n: canTake })}</span>`;
  const notes = [];
  if (soon) notes.push(T('ps_grow_at', { n: soon.i, t: leftText(Math.max(60000, soon.at - now)) }));
  if (!hasCrop && floor > 0 && canTake < ears) notes.push(T('ps_floor', { n: floor }));
  const note = notes.length ? `<span class="ps-floor">${notes.join(' · ')}</span>` : '';
  // **무엇이 있는지는 여전히 적는다.** 칸 줄은 「어느 칸에 · 가져갈 수 있나」를 말하고
  // 이 줄은 「무엇이」를 말한다 — 처음에 이 줄을 빼 버렸더니 재료 이름이 통째로
  // 화면에서 사라졌다 (`checkfarm` 이 잡았다)
  const what = (t.stash && Object.keys(t.stash).length)
    ? `<span class="pd-items raid-crop">${stashLine(t.stash)}</span>` : '';
  return `<span class="plot-strip">${cells.join('')}</span>${sum}${note}${what}`;
}

// 내 부대 — 서버의 `teamOf()` 와 **같은 규칙**이다 (안 짰으면 애착·동행이 1번 자리).
// 두 군데에 있다는 것을 알고 둔다: 여기 것은 **화면에 보여 줄 것**이고 판정은 서버가
// 한다. 그래도 화면은 **로컬 세이브**로 그려야 한다 — 자리를 바꾼 순간 보여야 하는
// 것은 「내가 방금 고른 것」이고, 서버는 아직 그것을 모른다
function myTeam(key, fallback) {
  const out = teamArr(key).map(id => (id && ownsCreature(id) ? { id } : null));
  if (out.every(x => !x) && S[fallback] && ownsCreature(S[fallback])) out[0] = { id: S[fallback] };
  return out;
}
// **`function` 으로 둔다** (화살표 상수가 아니라). 이 파일은 위에서 아래로 읽히는데
// `farmHtml()` 은 파일 중간에서 이걸 부른다 — 상수로 두면 읽는 순서에 따라
// ReferenceError 가 날 수 있다 (세이브가 통째로 날아간 그 사고와 같은 종류다)
function myDefTeam() { return myTeam('def', 'petRoom'); }
function myAtkTeam() { return myTeam('atk', 'petField'); }

// 내 동행이 그 지키개에게 유리한가 — 서버의 `attrMul` 과 같은 규칙이다.
// **두 군데에 있다는 것을 알고 둔다** (이름 규칙이 양쪽에 있는 것과 같다):
// 여기 것은 안내용이고 판정은 서버가 한다. `D.CREATURE_ATTRS` 의 `beats` 한 표에서
// 둘 다 나오므로, 표를 고치면 양쪽이 같이 바뀐다
function matchTag(mine, def) {
  if (!mine || !def) return { k: 'even', txt: T('raid_even') };
  const a = D.creatureAttr(mine.attr), b = D.creatureAttr(def.attr);
  if (a && a.beats === def.attr) return { k: 'good', txt: T('raid_good') };
  if (b && b.beats === mine.attr) return { k: 'bad', txt: T('raid_bad') };
  return { k: 'even', txt: T('raid_even') };
}

async function doRaid(i) {
  const t = RAIDS && RAIDS[i];
  if (!t || farmBusy) return;
  const name = t.name;
  farmBusy = true;
  // ⚠️ **부대를 먼저 올린다.** 판정은 서버가 **서버에 있는 세이브**로 한다 —
  // 방금 바꾼 출정대가 아직 3초 디바운스에 걸려 있으면 옛 부대로 싸운다
  await Sync.pushNow(S);
  const r = await Sync.raid(name, Sync.nonce());
  farmBusy = false;
  closeRaidPick();
  if (r.status !== 200 || !r.body) {
    const e = (r.body && r.body.error) || '';
    toast(T(e === 'target_shielded' ? 'raid_shielded'
      : e === 'target_empty' || e === 'target_gone' ? 'raid_gone'
      : e === 'no_raids' ? 'raid_no_left'
      : e === 'no_companion' ? 'farm_no_pal' : 'farm_err'), null, 2600);
    await refreshFarm(); renderFarm();
    return;
  }
  rec('raids');
  const items = r.body.items || {};
  if (r.body.win) {
    Object.keys(items).forEach(id => addInv(id, items[id]));
    rec('raidWon');
  }
  // 일지 — **이겨서 빈손인 경우를 따로 적는다.** 바닥 규칙(`RAID_FLOOR_DAYS`)이
  // 만든 진짜 상태라, 나중에 읽을 때 「왜 빈손이었지?」가 남으면 안 된다
  diaryAdd(r.body.win ? (Object.keys(items).length ? 'di_raid_win' : 'di_raid_empty') : 'di_raid_lose',
    { who: name, items, wins: r.body.wins || 0 });
  save();
  if (window.Sfx) Sfx.play(r.body.win ? 'success' : 'fail');
  showRaidResult(name, r.body);
  await refreshFarm();
  renderFarm();
  render();
}

// ═══ 약탈 연출 (FARM.md 6단계) ═══════════════════════════════
//
// 다섯 판을 **한 줄씩** 보여 준다. 토스트 한 줄로는 「어느 자리에서 졌는지」를
// 못 알려 주고, 그걸 모르면 다음에 순서를 바꿔 볼 수가 없다 — 이 시스템의 목적이
// 「무엇이 왜 유리했는지 배우는 것」이라 결과가 곧 다음 판의 설명이어야 한다.
//
// **개그는 지어내지 않는다.** 한 마디가 전부 «실제로 일어난 상태»에서 나온다 —
// 상성으로 이겼나 · 빈자리였나 · 이겼는데 바닥이라 빈손인가. 그래서 웃긴 줄이
// 곧 제일 쓸모 있는 줄이다. 지어낸 농담을 얹으면 두 번째 볼 때부터는 방해가 된다.
//
// 시점은 **「우리 애들」**이다. 플레이어가 아니라 크리처가 다녀온다 —
// 코지 게임이라 «남을 비웃는 농담»은 안 만든다. 웃음거리는 늘 우리 쪽이다.

// 두 벌 중 하나를 고른다. **크리처 조합으로 고정한다** — `Math.random()` 이면
// 다시 그릴 때마다 말이 바뀌어 「내가 잘못 읽었나」가 된다 (날씨와 같은 이유다).
// 문구가 한 벌뿐이면 세 번째 판부터는 아무도 안 읽는다
function pickQuip(key, a, b) {
  const seed = String(a || '') + '|' + String(b || '');
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const alt = key + '2';
  return (h & 1) && I18N && I18N.t(alt) !== alt ? alt : key;
}

// 한 판의 한 마디. 이긴 쪽/진 쪽과 **속성 상성**을 같이 본다
function roundQuip(mine, theirs, win) {
  // **내 자리가 빈 것을 먼저 본다.** 상대 자리가 비었다고 말해 주는 것보다
  // 「보낼 애가 없었다」가 훨씬 쓸모 있다 — 채우면 바로 나아지는 자리다
  if (!mine) return { key: 'rq_noone', attr: false };
  if (!theirs) return { key: 'rq_empty', attr: false };     // 빈자리를 이겼다
  const a = D.CREATURE_ATTRS.find(x => x.k === mine.attr);
  const b = D.CREATURE_ATTRS.find(x => x.k === theirs.attr);
  const iBeat = !!(a && a.beats === theirs.attr);
  const theyBeat = !!(b && b.beats === mine.attr);
  const two = (k, hard) => ({ key: pickQuip(k, mine.id, theirs.id), attr: hard });
  if (win && iBeat) return two('rq_beat_' + mine.attr, true);
  if (win && theyBeat) return two('rq_upset', true);
  if (win) return { key: 'rq_win', attr: false };
  if (theyBeat) return two('rq_counter', true);
  return { key: 'rq_lose', attr: false };
}

// 마지막 한 마디. **빈손이 우선이다** — 「이겼는데 가져올 게 없다」는
// 바닥 규칙(RAID_FLOOR_DAYS)이 만든 진짜 상태라, 웃기면서 규칙을 알려 준다.
// 전승 자랑보다 이쪽을 먼저 보여 줘야 「왜 빈손이지?」가 안 남는다
function finalQuip(b, gotN) {
  const wins = b.wins || 0;
  if (!b.win) return wins === 0 ? 'rf_zero' : 'rf_lose';
  if (!gotN) return 'rf_nothing';
  if (wins >= (b.rounds || []).length) return 'rf_perfect';
  if (wins === (b.winNeed || 3)) return 'rf_close';
  return 'rf_win';
}

function showRaidResult(name, b) {
  const el = document.getElementById('raidResult');
  if (!el) return;
  const ti = document.getElementById('raidResTitle');
  // **「서리해 왔어요」는 진짜 가져왔을 때만.** 이겼어도 빈손일 수 있다
  // (이긴 자리의 칸이 비었거나 바닥에 걸렸거나) — 그때까지 자랑하면
  // 제목과 본문이 서로 다른 말을 한다
  const gotN = Object.keys(b.items || {}).length;
  if (ti) ti.textContent = T(b.win && gotN ? 'rr_head_win' : 'rr_head', { who: name });

  const body = document.getElementById('raidResBody');
  if (body) {
    const mine = b.mine || [], def = b.def || [];
    const cell = x => {
      const c = x ? creatureOf(x.id) : null;
      return c
        ? `${window.Creature ? Creature.icon(c, 24) : ''} ${N(c.id, c.name)}`
        : `<span class="farm-none">${T('rr_none')}</span>`;
    };
    const rounds = b.rounds || [];
    // `--i` 가 곧 들어오는 차례다. **CSS 가 늦추고 JS 는 안 늦춘다** —
    // setTimeout 으로 붙이면 검증기가 재는 순간 없는 줄이 생긴다 (style.css 주석)
    const rows = rounds.map((r, k) => {
      const q = roundQuip(mine[r.i], def[r.i], r.win);
      return `<div class="rr-row${r.win ? ' won' : ''}" style="--i:${k}">
      <span class="tm-no">${r.i + 1}</span>
      <span class="rr-side">${cell(mine[r.i])}</span>
      <span class="rr-vs">vs</span>
      <span class="rr-side">${cell(def[r.i])}</span>
      <span class="rr-mark">${T(r.win ? 'rr_won' : 'rr_lost')}</span>
      <span class="rr-quip${q.attr ? ' attr' : ''}">${T(q.key)}</span>
    </div>`;
    }).join('');

    // 도장과 그 뒤는 **판이 다 지나간 뒤에** 온다. 초 단위를 여기서 한 번만 계산해
    // CSS 변수로 넘긴다 — 값이 두 군데 있으면 판 수를 바꿀 때 한쪽만 고치게 된다
    const after = (rounds.length * 0.18 + 0.2).toFixed(2) + 's';
    const stamp = `<span class="rr-stamp${b.win ? ' win' : ''}"
      style="animation-delay:${after}">${T(b.win ? 'rr_stamp_win' : 'rr_stamp_lose')}</span>`;

    const items = b.items || {};
    const ids = Object.keys(items);      // gotN 과 같은 값이다 (위에서 제목이 먼저 쓴다)
    const lootAt = (rounds.length * 0.18 + 0.62).toFixed(2) + 's';
    const isCrop = id => (D.FARM_CROPS || []).some(c => c.id === id);
    const anyCrop = ids.some(isCrop);
    // **특수 작물을 앞에, 크게.** 이삭은 매일 쌓이지만 작물은 남이 심어 기다린 것이라
    // 같은 크기로 내놓으면 약탈의 목적이 화면에서 사라진다
    const sorted = ids.slice().sort((x, y) => (isCrop(y) ? 1 : 0) - (isCrop(x) ? 1 : 0));
    const loot = ids.length
      ? (anyCrop ? `<span class="rr-crop-tag" style="animation-delay:${lootAt}">${T('rr_crop')}</span>` : '')
        + `<div class="rr-loot">` + sorted.map((id, k) => {
          const it = itemOf(id);
          const crop = isCrop(id);
          return `<span class="rr-item${crop ? ' crop' : ''}"
            style="--i:${k};--d:${lootAt}">${it ? it.emoji : ''} ${N(id, it ? it.name : id)}
            <b class="rr-n">×${items[id]}</b></span>`;
        }).join('') + `</div>`
      : '';

    const fin = `<div class="rr-fin" style="animation-delay:${
      (rounds.length * 0.18 + 0.5).toFixed(2)}s">${T(finalQuip(b, ids.length))}</div>`;
    // **세 판을 못 이기면 빈손이다** — 두 판을 이겼어도 그렇다. 그 말을 적어 준다
    // ⚠️ **「{n}판 이상 이겨야」는 못 이겼을 때만 맞는 말이다.**
    // 예전에는 가져온 것이 없으면 이겼는데도 이 줄이 떴다 — 4승 1패인데
    // 「3판 이상 이겨야」라고 적혀 있으면 규칙을 거꾸로 배운다 (신고받았다).
    // 이긴 채로 빈손인 이유는 따로 있고 그것은 `rf_nothing` 이 말해 준다
    const why = (!b.win)
      ? `<div class="farm-hint">${T('rr_empty', { n: b.winNeed || 3 })}</div>` : '';
    // **`--slam` 하나로 「도장이 닿는 순간」을 넘긴다.** 시트가 내려앉는 연출과
    // 도장이 같은 시각이어야 「쿵」으로 읽힌다 — 숫자를 두 군데 적으면 어긋난다
    body.innerHTML = `<div class="rr-slamzone" style="--slam:${after}">`
      + `<div class="rr-list">${rows}</div>${stamp}${fin}${loot}${why}</div>`;
  }
  el.classList.add('show');
}
function closeRaidResult() {
  const el = document.getElementById('raidResult');
  if (el) el.classList.remove('show');
}
window.closeRaidResult = closeRaidResult;

window.openFarm = openFarm;
window.closeFarm = closeFarm;
window.harvestFarm = harvestFarm;
window.openPlant = openPlant;
window.closePlant = closePlant;
window.doPlant = doPlant;
window.buyPlot = buyPlot;
window.openRaidPick = openRaidPick;
window.closeRaidPick = closeRaidPick;
window.doRaid = doRaid;

function openBingeScene() {
  const n = bingeCount();
  // 볼 것이 없으면 그렇게 말해 준다 — 버튼이 그냥 안 먹히면 고장으로 읽힌다
  if (!n) { toast(T('bs_none'), document.getElementById('actBinge')); return; }
  // 여러 밤이면 먼저 물어본다. 세 장면이 예고 없이 이어지면 갇힌 느낌이 든다
  if (n > 1) { showConfirm(T('bs_ask_all', { n }), playBinge, null, T('bs_ask_ok')); return; }
  playBinge();
}
window.openBingeScene = openBingeScene;

// 이번에 몇 밤째를 보고 있는지 — 대사의 「(2번)」과 잔소리 조건이 이걸 본다
let bingeSeen = 0;

// 한 번에 이만큼을 내리 보고 나면 요정 대모가 참다 못해 나온다.
// **다섯인 이유**: BINGE.keep 이 5 라 한 번에 쌓일 수 있는 최대치다 —
// 여기까지 왔다는 것은 닷새를 내리 혼자 먹었다는 뜻이다.
// **쓰는 곳(playBinge)보다 위에 둔다** — let 은 끌어올려지지 않는다
const BINGE_SCOLD = 5;
let bingeScolding = false;

function playBinge() {
  bingeSeen = 0;
  bingeScolding = false;
  const el = document.getElementById('bingeScene');
  if (!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  document.addEventListener('keydown', bingeKey);
  renderBinge();
}

function renderBinge() {
  const e = (S.binges || [])[0];
  if (!e) { closeBingeScene(); return; }
  const f = foodOf(e.food) || D.FOODS[0];
  const name = N(f.id, f.name);
  const art = document.getElementById('bsArt');
  // **지금 그 캐릭터의 뒷모습이다** — 착장·머리·체형을 그대로 따라간다
  if (art && window.Avatar && Avatar.crouchBack) {
    art.innerHTML = Avatar.crouchBack(outfitWithColors(), bodyLevel(), f.emoji);
  }
  const who = document.getElementById('bsWho');
  if (who) who.hidden = true;                 // 폭식 장면에는 말하는 사람이 없다
  const line = document.getElementById('bsLine');
  if (line) line.textContent = T('bs_line', {
    name, josa: josa(name, '을를'), n: bingeSeen + 1 });
  const st = document.getElementById('bsStats');
  if (st) {
    st.hidden = false;
    st.textContent = [
      `${T('a_happy')} −${e.happy}`,
      `${T('a_grit')} −${e.grit}`,
      `${T('v_fit')} −${Math.abs(e.fit).toFixed(2)}`,
    ].join(' · ');
  }
  const tail = document.getElementById('bsTail');
  if (tail) { tail.hidden = false; tail.textContent = T('bs_tail'); }
  const next = document.getElementById('bsNext');
  if (next) next.textContent = T(bingeCount() > 1 ? 'bs_next' : 'bs_done');
}

// 본 것은 **지운다** — 그래서 뱃지가 준다
function bingeNext() {
  if (bingeScolding) { closeBingeScene(); return; }   // 잔소리를 듣고 나면 방으로
  (S.binges || []).shift();
  bingeSeen++;
  save();
  renderActBadges();
  if (bingeCount()) { renderBinge(); return; }
  if (bingeSeen >= BINGE_SCOLD) { renderBingeScold(); return; }
  closeBingeScene();
}
window.bingeNext = bingeNext;

// 요정 대모의 대노 — 같은 층을 그대로 쓴다. 새 오버레이를 만들면 나가는 길도
// 두 벌이 되고, 둘 중 하나만 고치는 일이 반드시 생긴다
function renderBingeScold() {
  bingeScolding = true;
  const art = document.getElementById('bsArt');
  if (art && window.Portrait) {
    // **배경 판 없이(bare)** — 판을 깔면 이 어두운 장면에 카드 한 장을 붙인 것처럼 보인다
    art.innerHTML = Portrait.bust(D.speaker('sp_althea'), 'cross', { bare: true });
  }
  const who = document.getElementById('bsWho');
  // 이름은 설정상의 「알테이아」가 아니라 **부르는 말**이다 (STORY.md 호칭 규칙)
  if (who) { who.hidden = false; who.textContent = speakerName('sp_althea'); }
  const line = document.getElementById('bsLine');
  if (line) line.textContent = T('bs_scold');
  const st = document.getElementById('bsStats');
  if (st) { st.textContent = ''; st.hidden = true; }
  const tail = document.getElementById('bsTail');
  if (tail) { tail.textContent = ''; tail.hidden = true; }
  const next = document.getElementById('bsNext');
  if (next) next.textContent = T('bs_scold_ok');
}

// 우상단 「✕ 닫기」를 뺐으므로 **키보드에는 나갈 길이 없어진다.**
// 화면 전체가 그림이라 '바깥 터치' 로 쓸 여백도 없다 — Esc 하나를 남긴다.
// 열 때 걸고 닫을 때 떼어서, 다른 화면의 Esc 까지 가로채지 않게 한다.
function bingeKey(e) { if (e.key === 'Escape') { e.preventDefault(); closeBingeScene(); } }

function closeBingeScene() {
  const el = document.getElementById('bingeScene');
  if (!el) return;
  document.removeEventListener('keydown', bingeKey);
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  // 몸이 달라졌을 수 있다 (단련이 깎였다) — 방으로 돌아가며 다시 그린다
  render();
}
window.closeBingeScene = closeBingeScene;

// ═══════════════════════════════════════════════════════════════
//  운동 (EXERCISE.md)
// ═══════════════════════════════════════════════════════════════
//
// **즉시 끝난다.** 「30분 뒤에 돌아오세요」로 하지 않는다 — 채집·조합과 같은 방식이라
// 새 개념이 안 늘고, 팝업에 타이머가 안 들어간다. 나중에 바꾸고 싶으면
// lastWorkoutTs 옆에 끝나는 시각을 하나 더 두면 된다.
let exPickId = null, exPickMin = 0;

// ─── 언제 운동했는가 ──────────────────────────────────────────
//
// **같은 운동도 시간에 따라 남는 것이 다르다.**
//
// 밤에 혼자 몰아붙이면 근성은 더 붙지만 마음이 깎이고, 배가 더 고파진 채로 자게 된다 —
// 그 밤이 바로 「혼자 먹은 밤」이다. `STORY.md` 의 **근성의 양날**이 여기 그대로 온다:
// 근성을 **혼자만의 것**으로 쌓으면 이그리트가 되고, 그러지 않으면 공주가 된다.
//
// ⚠️ 이것은 「밤 운동은 나쁘다」는 잔소리가 아니다. **고르는 문제**로 두는 것이다 —
// 근성이 급하면 밤에 하면 되고, 대신 그날 밤이 위험해진다. 팝업이 그 값을 미리 보여 준다.
const EX_WHEN = {
  morning: { grit: 1.0,  happy: 6,  full: 1.0, emoji: '🌅' },
  day:     { grit: 1.0,  happy: 0,  full: 1.0, emoji: '☀️' },
  night:   { grit: 1.25, happy: -8, full: 1.3, emoji: '🌙' },
};
// 아침 05~11 · 낮 11~21 · 밤 21~05.
// **nowDate() 를 지난다** — 시계를 옮겨 놓고 검사할 수 있어야 한다
function exWhenKey() {
  const h = nowDate().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 21) return 'day';
  return 'night';
}
function exWhen() { return EX_WHEN[exWhenKey()]; }

function exOf(id) { return D.EXERCISES.find(x => x.id === id) || null; }
function exOpen(ex) { return auraVal('grit') >= (ex.need || 0); }
// 종목 × 시간의 값. 화면에 적는 것과 실제로 빼는 것이 **같은 함수**를 지난다 —
// 따로 계산하면 적힌 값과 빠지는 값이 조용히 어긋난다
function exCost(ex, min) {
  const w = exWhen();
  return {
    ap:    Math.round(ex.ap * min),
    stam:  Math.round(ex.stam * min),
    grit:  Math.round(ex.grit * min * w.grit),
    // **사냥꾼의 단백질**이 여기 붙는다 — 운동 팝업에 적히는 값이 그대로 커진다
    fit:   +(ex.fit * min * bondMult('meat')).toFixed(2),
    full:  +(ex.full * min * w.full).toFixed(1),
    happy: w.happy,
  };
}
// 그 시간을 고를 수 있는가 — 스태미나가 있어야 한다 (AP 는 충전할 수 있으니 막지 않는다)
function exMinOk(ex, min) { return exCost(ex, min).stam <= stamina(); }

function openExercise() {
  tickBody();
  // 처음 열면 **열려 있는 것 중 제일 센 종목**을 골라 둔다 — 매번 산책부터 고르게 하면
  // 근성을 올린 보람이 안 난다
  const open = D.EXERCISES.filter(exOpen);
  exPickId = (open[open.length - 1] || D.EXERCISES[0]).id;
  const ex = exOf(exPickId);
  // 시간도 **지금 할 수 있는 것 중 제일 긴 것**으로. 하나도 못 하면 제일 짧은 것을 둔다
  const oks = D.EXERCISE_MINS.filter(m => exMinOk(ex, m));
  exPickMin = oks.length ? oks[oks.length - 1] : D.EXERCISE_MINS[0];
  showConfirm(T('ex_ask'), doWorkout, exPanel(), T('ex_go'));
  exSync();
}
window.openExercise = openExercise;

function exPanel() {
  const items = D.EXERCISES.map(ex => {
    const on = exOpen(ex);
    // 잠긴 것도 **보여 준다** — 무엇이 기다리는지 알아야 근성을 올릴 이유가 생긴다
    return `<button class="ex-item ${on ? '' : 'locked'}" data-ex="${ex.id}"
      aria-label="${N(ex.id, ex.name)}${on ? '' : ' 🔒'}"
      onclick="exPick('${ex.id}')">
      <span class="ex-emoji">${ex.emoji}</span>
      <span class="ex-name">${N(ex.id, ex.name)}</span>
      ${on ? '' : `<span class="ex-need">🔒 ${T('a_grit')} ${ex.need}</span>`}
    </button>`;
  }).join('');
  // 자물쇠 글자는 **비워 두고 exSync 가 채운다** — 스태미나에 따라 매번 달라지기 때문이다.
  // (색만으로 잠금을 알리면 색약 사용자에게 안 전달된다 — UI_POLICY 7장 · checkLocked)
  const mins = D.EXERCISE_MINS.map(m =>
    `<button class="ex-min" data-min="${m}" onclick="exMin(${m})">${T('ex_min', { n: m })}<span class="ex-min-lock"></span></button>`).join('');
  return `<div class="ex-box">
    <div class="ex-now">
      <span>🍚 <b id="exFull">0</b></span>
      <span>🏃 <b id="exStam">0</b></span>
    </div>
    <div class="ex-items">${items}</div>
    <div class="ex-mins">${mins}</div>
    <div id="exWhen" class="ex-when"></div>
    <div id="exDesc" class="ex-desc"></div>
    <div id="exLine" class="ex-line"></div>
    <div id="exGain" class="ex-gain"></div>
  </div>`;
}

function exPick(id) {
  const ex = exOf(id);
  if (!ex) return;
  if (!exOpen(ex)) { toast(T('ex_locked', { name: N(ex.id, ex.name), n: ex.need })); return; }
  exPickId = id;
  // 고른 종목으로 못 하는 시간이면 할 수 있는 것 중 제일 긴 것으로 내려 준다 —
  // 못 누르는 칸만 남겨 두면 '왜 시작이 안 되지' 로 끝난다
  if (!exMinOk(ex, exPickMin)) {
    const oks = D.EXERCISE_MINS.filter(m => exMinOk(ex, m));
    exPickMin = oks.length ? oks[oks.length - 1] : D.EXERCISE_MINS[0];
  }
  exSync();
}
window.exPick = exPick;

function exMin(m) {
  const ex = exOf(exPickId);
  if (!ex) return;
  if (!exMinOk(ex, m)) { toast(T('ex_no_stam')); return; }
  exPickMin = m;
  exSync();
}
window.exMin = exMin;

// 고른 것에 맞춰 패널을 갱신한다. **다시 그리지 않고 값만 바꾼다** —
// innerHTML 을 갈아 끼우면 누른 버튼이 문서에서 떨어져 나가 토스트가 붙을 곳을 잃는다
function exSync() {
  const ex = exOf(exPickId);
  if (!ex) return;
  const c = exCost(ex, exPickMin);
  const f = document.getElementById('exFull');
  const st = document.getElementById('exStam');
  if (f) f.textContent = `${Math.floor(fullness())} / ${FULLNESS.max}`;
  if (st) st.textContent = `${Math.floor(stamina())} / ${staminaMax()}`;

  document.querySelectorAll('.ex-item').forEach(b =>
    b.classList.toggle('on', b.dataset.ex === exPickId));
  document.querySelectorAll('.ex-min').forEach(b => {
    const m = Number(b.dataset.min);
    const lock = !exMinOk(ex, m);
    b.classList.toggle('on', m === exPickMin);
    // 스태미나가 모자란 시간은 잠금 표현으로 (UI_POLICY 7장 — 눌리기는 한다)
    b.classList.toggle('locked', lock);
    const g = b.querySelector('.ex-min-lock');
    if (g) g.textContent = lock ? ' 🔒' : '';
  });

  // 지금이 언제인지 **고르기 전에** 보여 준다 — 누르고 나서 알면 고른 것이 아니다
  const when = document.getElementById('exWhen');
  if (when) {
    const w = exWhen();
    when.textContent = `${w.emoji} ${T('ex_when_' + exWhenKey())}`;
    when.classList.toggle('night', exWhenKey() === 'night');
  }
  const desc = document.getElementById('exDesc');
  if (desc) desc.textContent = T(ex.id + '_d');
  const line = document.getElementById('exLine');
  if (line) line.innerHTML =
    `<span class="ex-cost">⚡ ${T('n_ap', { n: c.ap })}</span>`
    + `<span class="ex-cost">🏃 −${c.stam}</span>`
    + `<span class="ex-cost">🍚 −${c.full}</span>`;
  const gain = document.getElementById('exGain');
  if (gain) gain.textContent = T('ex_gain', { grit: c.grit, fit: c.fit.toFixed(2) })
    + (c.happy ? ` · ${T('a_happy')} ${signed(c.happy, 0)}` : '');
}

function doWorkout() {
  const ex = exOf(exPickId);
  if (!ex) return;
  tickBody();
  const c = exCost(ex, exPickMin);
  if (c.stam > stamina()) { toast(T('ex_no_stam')); return; }
  if (!spendEnergy(c.ap)) { toast(T('no_energy')); return; }

  const beforeStep = bodyStep();
  S.stamina = Math.max(0, stamina() - c.stam);
  S.fullness = Math.max(0, fullness() - c.full);
  S.fit = +((S.fit || 0) + c.fit).toFixed(3);
  addAura('grit', c.grit);
  if (c.happy) addAura('happy', c.happy);
  S.lastWorkoutTs = S.decayTs = Date.now();
  rec('workouts');
  rec('exMin', exPickMin);
  save();
  toast(T('ex_done', { emoji: ex.emoji, name: N(ex.id, ex.name), n: exPickMin,
                       grit: c.grit, fit: c.fit.toFixed(2) }), null, 3000);
  render();
  // 살이 빠지는 연출은 물약과 같은 것을 쓴다 — 단계가 내려가면 크게, 아니면 반짝임만
  playSlimFx(bodyStep() > beforeStep ? 'step' : 'sip');
  checkUnlocks();
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
// ─── 게임 초기화 = **공장 초기화** ───────────────────────────
//
// 「새 이름으로 시작하면 게임을 처음 실행한 것과 똑같아야 한다.」
// 그래서 세이브만 지우지 않고 **`dieter_alchemist_` 로 시작하는 것을 전부** 지운다 —
// 예전에는 세이브와 인트로 표시 둘만 지워서, 몸 슬라이더 · 개발용 스위치 ·
// 통계 · **신원(playerId)** 이 그대로 남았다. 신원이 남으면 아이디로 시드를 잡는
// 것들이 초기화해도 안 바뀐다.
//
// ⚠️ **개발용 계정 보관함만 남긴다.** 그건 게임 상태가 아니라 «도구»라,
// 초기화할 때마다 같이 날아가면 여러 계정을 옮겨 다니며 시험할 수가 없다.
//
// ⚠️ **순서가 있다** — 서버 사본을 먼저 지우고(열쇠가 필요하다) 그다음에 신원을 버린다.
const RESET_KEEP = [/* 개발용 계정 보관함 */];
function wipeLocalAll() {
  const keep = new Set(RESET_KEEP.concat([DEV_ACCT_KEY]));
  const doomed = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('dieter_alchemist_') === 0 && !keep.has(k)) doomed.push(k);
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  return doomed;
}
function askResetGame() {
  showConfirm(T('confirm_reset_game'), async () => {
    // 서버 사본을 먼저 지운다. 로컬만 지우면 다음 접속 때 서버에서 되살아난다.
    // (서버가 죽어 있어도 초기화 자체는 진행한다 — 로컬이 진짜이므로)
    if (window.Sync) { try { await Sync.wipe(); } catch (e) {} }
    wipeLocalAll();
    if (window.Sync) { try { Sync.forget(); } catch (e) {} }
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
  const done = () => {
    // 복사했으면 **본 것으로 친다** — 톱니의 점이 꺼진다
    if (!S.codeSeen) { S.codeSeen = true; save(); renderActBadges(); }
    toast(T('sync_copied'), el, 2400);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {
    const i = document.getElementById('syncCode'); if (i) { i.select(); done(); }
  });
  else { const i = document.getElementById('syncCode'); if (i) { i.select(); document.execCommand('copy'); done(); } }
}

// ─── 코드로 이어하기 ─────────────────────────────────────────
//
// ⚠️ **먼저 받아 보고, 있으면 갈아탄다.** 예전에는 `prompt()` 로 받은 코드를
// 형식만 보고 곧바로 신원을 갈아엎은 뒤 로컬 세이브를 지우고 새로고침했다 —
// 오타가 하나 있으면 **되돌릴 방법 없이 빈손으로 새 게임**이 시작됐다.
// 원래 신원까지 잃은 채로. 지금은 `Sync.peek()` 이 신원을 안 건드리고 물어보고,
// **누구의 세이브인지 보여 준 다음에야** 갈아탄다.
let restoreFound = null;      // peek 이 찾아 온 것 (화면에 보여 줄 요약)
function openRestore() {
  restoreFound = null;
  const m = document.getElementById('restoreSheet');
  if (m) m.classList.add('show');
  renderRestore();
  const i = document.getElementById('restoreInput');
  if (i) { i.value = ''; i.focus(); }
  if (window.Sfx) Sfx.play('pick');
}
function closeRestore() {
  const m = document.getElementById('restoreSheet');
  if (m) m.classList.remove('show');
  restoreFound = null;
}
window.openRestore = openRestore;
window.closeRestore = closeRestore;

function renderRestore(msg) {
  const ti = document.getElementById('restoreTitle');
  if (ti) ti.textContent = T('sync_restore');
  const el = document.getElementById('restoreFound');
  if (!el) return;
  if (msg) { el.innerHTML = `<div class="rs-bad">${msg}</div>`; return; }
  if (!restoreFound) { el.innerHTML = ''; return; }
  const st = restoreFound.state || {};
  const nm = st.name || T('sp_princess');
  const charm = Math.round((st.stats && st.stats.charm) || 0);
  el.innerHTML = `
    <div class="rs-found">
      <div class="rs-name">${nm}</div>
      <div class="rs-meta">${T('sync_found_meta', { charm, when: agoText(restoreFound.savedAt) })}</div>
    </div>
    <button class="btn btn-primary rs-go" onclick="doRestore()">${T('sync_restore_go')}</button>`;
}

// 「얼마 전」 — 정확한 시각보다 이쪽이 「내 것이 맞나」를 빨리 판단하게 해 준다
function agoText(ts) {
  // ⚠️ 서버는 `savedAt` 을 **ISO 문자열**로 준다 (`store.js`). 숫자로 알고 빼면
  // NaN 이 되어 「NaN일 전 저장」이 화면에 뜬다 (실제로 그랬다)
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!t || isNaN(t)) return T('sync_ago_unknown');
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 60) return T('sync_ago_min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return T('sync_ago_hour', { n: h });
  return T('sync_ago_day', { n: Math.floor(h / 24) });
}

// 붙여넣은 코드를 **신원을 안 건드리고** 확인한다
async function checkRestoreCode() {
  const i = document.getElementById('restoreInput');
  const code = i ? i.value.trim() : '';
  restoreFound = null;
  if (!code) { renderRestore(T('sync_need_code')); return; }
  if (!window.Sync) { renderRestore(T('sync_no_server')); return; }
  renderRestore(T('sync_checking'));
  const r = await Sync.peek(code);
  if (!r.ok) {
    // **왜 안 되는지를 갈라서 말한다.** 「코드가 틀렸다」 하나로 묶으면
    // 오프라인인 사람이 코드를 계속 다시 치게 된다
    renderRestore(T({ bad: 'sync_bad_code', none: 'sync_no_such',
                      wrong: 'sync_wrong_secret', net: 'sync_cant_reach' }[r.why] || 'sync_bad_code'));
    return;
  }
  restoreFound = r;
  renderRestore();
  if (window.Sfx) Sfx.play('success');
}
window.checkRestoreCode = checkRestoreCode;

// 진짜로 갈아탄다. **지금 기기의 진행은 사라지므로** 한 번 더 묻는다
function doRestore() {
  const i = document.getElementById('restoreInput');
  const code = i ? i.value.trim() : '';
  if (!restoreFound || !window.Sync) return;
  showConfirm(T('sync_restore_confirm'), () => {
    if (!Sync.useCode(code)) { toast(T('sync_bad_code')); return; }
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  });
}
window.doRestore = doRestore;

// (보관) 예전 이름 — 설정 화면이 이 이름으로 부르고 있었다
function askUseRecoveryCode() { openRestore(); }

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
  tickBody();               // 창을 닫아 둔 사이에 흐른 포만감·스태미나
  // 쉬는 동안 되돌아간 만큼. **조용히 줄어 있으면 안 된다** — 알려 준다
  const lost = decayIdle();
  // 혼자 먹은 밤. **tickBody 다음이라야** 비운 사이에 줄어든 포만감을 보고 판정한다.
  // **토스트로 알리지 않는다** — 마이 룸의 「흡입」 버튼에 뱃지가 붙고, 눌러서 본다.
  // 흘러가는 토스트로 때우기에는 그날 밤이 이 게임에서 너무 중요한 장면이다
  const alone = checkBinge();
  if (lost || alone) save();
  if (lost) {
    setTimeout(() => toast(T('decay_back', {
      d: lost.days, grit: lost.grit, fit: lost.fit.toFixed(2) }), null, 5200), 900);
  }
  switchTab('showcase');
  // **비법서를 한 번 맞춰 둔다.** `checkUnlocks()` 는 매력이 «오를 때»만 도는데,
  // 이미 여신인 사람은 다음에 물약을 마실 때까지 제 단계의 장을 못 받는다.
  // 조용히(`true`) 채운다 — 켤 때마다 「새 장 30장!」이 뜨면 그건 소식이 아니다
  grantPages(true);
  // 퀘스트도 같이 맞춘다 — 조건이 이미 찬 사람에게 칩이 바로 떠야 한다
  refreshQuests();
  // 튜토리얼 — 인트로를 아직 안 봤으면 여기서는 그냥 돌아가고,
  // 인트로가 끝나면서 index.html 이 걸어 둔 콜백이 다시 부른다
  if (window.Tut) Tut.maybeStart();
  // 서버에 더 최신 세이브가 있으면 그걸로 이어서 한다 (없으면 지금 것을 올린다)
  if (window.Sync) {
    Sync.onStatus(renderSyncChip);
    // 오프라인에서 지은 임시 이름은 서버에 닿을 때마다 확정을 시도한다.
    // (상태가 offline 을 벗어나는 순간이 곧 '닿았다' 는 뜻이다)
    Sync.onStatus(st => { if (st !== 'offline' && st !== 'off') ensureNameClaimed(); });
    Sync.pull(S).then(r => {
      if (r && r.action === 'adopt') toast(T('sync_pulled'), null, 2800);
      ensureNameClaimed();
      // 밭을 한 번 받아 온다 — **자는 사이에 털렸는지**를 알려면 이 한 번이 필요하다.
      // 세이브를 먼저 맞춘 뒤에 부른다 (adopt 로 `farmSeenAt` 이 바뀔 수 있다)
      refreshFarm();
    });
  } else {
    renderSyncChip('off');
  }
  setInterval(energyTick, 1000);  // 카운트다운 + 자정 자동 충전
  // 백그라운드 → 포그라운드 복귀 시 즉시 반영
  document.addEventListener('visibilitychange', () => { if (!document.hidden) energyTick(); });
});
