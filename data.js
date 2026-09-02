// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 게임 데이터
//  (독립 신규 게임 / MVP vertical slice)
// ═══════════════════════════════════════════════════════════════

// ─── 재료 (Ingredients) ───
// weight: 채집 시 뽑힐 가중치 (클수록 흔함)
// rare:   맵마다 하나씩 있는 '특별한 재료'. 가중 추첨과 별개로 specialTier() 확률로 나온다.
const INGREDIENTS = {
  // ── 뾰족 산악 지대 ──
  iron_ore:      { id: 'iron_ore', emoji: '⛏️', name: '무쇠 광석', zone: 'mountain', weight: 24 },
  crystal:       { id: 'crystal', emoji: '🔹', name: '수정', zone: 'mountain', weight: 6 },
  cave_moss:     { id: 'cave_moss', emoji: '🪨', name: '동굴 이끼', zone: 'mountain', weight: 26 },
  snow_bud:      { id: 'snow_bud', emoji: '❄️', name: '설화 봉오리', zone: 'mountain', weight: 14 },
  eagle_feather: { id: 'eagle_feather', emoji: '🪶', name: '매 깃털', zone: 'mountain', weight: 12 },
  echo_stone:    { id: 'echo_stone', emoji: '🗿', name: '메아리 돌', zone: 'mountain', weight: 18 },
  pine_cone:     { id: 'pine_cone', emoji: '🌰', name: '솔방울', zone: 'mountain', weight: 28 },
  mist_drop:     { id: 'mist_drop', emoji: '💧', name: '산안개 방울', zone: 'mountain', weight: 20 },
  flint:         { id: 'flint', emoji: '🔥', name: '부싯돌', zone: 'mountain', weight: 22 },
  cloud_moss:    { id: 'cloud_moss', emoji: '☁️', name: '구름 이끼', zone: 'mountain', weight: 10 },
  // ── 포근 평야 지대 ──
  herb:          { id: 'herb', emoji: '🌿', name: '약초', zone: 'plain', weight: 30 },
  berry:         { id: 'berry', emoji: '🍓', name: '산딸기', zone: 'plain', weight: 30 },
  wheat:         { id: 'wheat', emoji: '🌾', name: '밀 이삭', zone: 'plain', weight: 28 },
  clover:        { id: 'clover', emoji: '🍀', name: '네잎 클로버', zone: 'plain', weight: 10 },
  honey:         { id: 'honey', emoji: '🍯', name: '들꿀', zone: 'plain', weight: 16 },
  thistle:       { id: 'thistle', emoji: '🌱', name: '엉겅퀴', zone: 'plain', weight: 24 },
  sun_seed:      { id: 'sun_seed', emoji: '🌻', name: '해바라기 씨', zone: 'plain', weight: 22 },
  dew:           { id: 'dew', emoji: '💧', name: '이슬', zone: 'plain', weight: 16 },
  walnut:        { id: 'walnut', emoji: '🥜', name: '호두', zone: 'plain', weight: 20 },
  butter_flower: { id: 'butter_flower', emoji: '🧈', name: '버터꽃', zone: 'plain', weight: 12 },
  // 파수꾼의 호박 밭 전용 (이 맵에서만 나온다)
  zucchini:        { id: 'zucchini', emoji: '🥒', name: '애호박', zone: 'plain', weight: 30 },
  old_pumpkin:     { id: 'old_pumpkin', emoji: '🎃', name: '늙은호박', zone: 'plain', weight: 18 },
  sweet_pumpkin:   { id: 'sweet_pumpkin', emoji: '🟠', name: '단호박', zone: 'plain', weight: 24 },
  chestnut_pumpkin:{ id: 'chestnut_pumpkin', emoji: '🌰', name: '밤호박', zone: 'plain', weight: 20 },
  // ── 울창 숲 지대 ──
  petal:         { id: 'petal', emoji: '🌸', name: '꽃잎', zone: 'forest', weight: 26 },
  mushroom:      { id: 'mushroom', emoji: '🍄', name: '버섯', zone: 'forest', weight: 14 },
  fern:          { id: 'fern', emoji: '🪴', name: '고사리', zone: 'forest', weight: 26 },
  moss_branch:   { id: 'moss_branch', emoji: '🌳', name: '이끼 가지', zone: 'forest', weight: 24 },
  firefly:       { id: 'firefly', emoji: '🐛', name: '반딧불이', zone: 'forest', weight: 12 },
  spider_silk:   { id: 'spider_silk', emoji: '🕸️', name: '거미줄 실', zone: 'forest', weight: 16 },
  owl_feather:   { id: 'owl_feather', emoji: '🦉', name: '부엉이 깃털', zone: 'forest', weight: 10 },
  tree_resin:    { id: 'tree_resin', emoji: '🟠', name: '나무 수액', zone: 'forest', weight: 20 },
  night_dew:     { id: 'night_dew', emoji: '🌙', name: '밤이슬', zone: 'forest', weight: 18 },
  wild_ivy:      { id: 'wild_ivy', emoji: '🍃', name: '들담쟁이', zone: 'forest', weight: 28 },
  // ── 황량 황무지 ──
  sand_grain:    { id: 'sand_grain', emoji: '🏖️', name: '까끌 모래', zone: 'waste', weight: 30 },
  cactus:        { id: 'cactus', emoji: '🌵', name: '가시선인장', zone: 'waste', weight: 22 },
  bone_frag:     { id: 'bone_frag', emoji: '🦴', name: '마른 뼛조각', zone: 'waste', weight: 16 },
  frog_egg:      { id: 'frog_egg', emoji: '🐸', name: '개구리 알', zone: 'waste', weight: 18 },
  rust_nail:     { id: 'rust_nail', emoji: '🔩', name: '녹슨 못', zone: 'waste', weight: 24 },
  salt_crust:    { id: 'salt_crust', emoji: '🧂', name: '소금 결정', zone: 'waste', weight: 20 },
  mirage_shard:  { id: 'mirage_shard', emoji: '🌀', name: '신기루 조각', zone: 'waste', weight: 8 },
  dry_root:      { id: 'dry_root', emoji: '🪵', name: '마른 뿌리', zone: 'waste', weight: 26 },
  lizard_scale:  { id: 'lizard_scale', emoji: '🦎', name: '도마뱀 비늘', zone: 'waste', weight: 14 },
  black_feather: { id: 'black_feather', emoji: '🖤', name: '검은 깃털', zone: 'waste', weight: 12 },
  // ── 반짝 해안 지대 ──
  shell:         { id: 'shell', emoji: '🐚', name: '조개껍데기', zone: 'shore', weight: 30 },
  seaweed:       { id: 'seaweed', emoji: '🥬', name: '미역 줄기', zone: 'shore', weight: 26 },
  pearl_bit:     { id: 'pearl_bit', emoji: '⚪', name: '작은 진주', zone: 'shore', weight: 8 },
  coral:         { id: 'coral', emoji: '🪸', name: '산호 조각', zone: 'shore', weight: 14 },
  starfish:      { id: 'starfish', emoji: '⭐', name: '불가사리', zone: 'shore', weight: 16 },
  sea_glass:     { id: 'sea_glass', emoji: '🔷', name: '파도 유리', zone: 'shore', weight: 18 },
  driftwood:     { id: 'driftwood', emoji: '🪵', name: '유목', zone: 'shore', weight: 24 },
  crab_claw:     { id: 'crab_claw', emoji: '🦀', name: '게 집게', zone: 'shore', weight: 20 },
  foam:          { id: 'foam', emoji: '🫧', name: '물거품', zone: 'shore', weight: 28 },
  sea_dew:       { id: 'sea_dew', emoji: '💦', name: '바다 이슬', zone: 'shore', weight: 12 },
  // ── 특별한 재료 (맵당 1종, 확률 0.1%) ──
  sp_starore:      { id: 'sp_starore', emoji: '🌟', name: '별빛 원석', zone: 'mountain', weight: 0, rare: true },
  sp_laketear:     { id: 'sp_laketear', emoji: '💠', name: '호수의 눈물', zone: 'mountain', weight: 0, rare: true },
  sp_rockchip:     { id: 'sp_rockchip', emoji: '🪨', name: '흔들바위 조각', zone: 'mountain', weight: 0, rare: true },
  sp_cloudwool:    { id: 'sp_cloudwool', emoji: '🧶', name: '구름 솜', zone: 'mountain', weight: 0, rare: true },
  sp_goldfeather:  { id: 'sp_goldfeather', emoji: '🥇', name: '매의 황금깃', zone: 'mountain', weight: 0, rare: true },
  sp_everfrost:    { id: 'sp_everfrost', emoji: '🌬️', name: '영원의 서리꽃', zone: 'mountain', weight: 0, rare: true },
  sp_echogem:      { id: 'sp_echogem', emoji: '🔮', name: '메아리 수정', zone: 'mountain', weight: 0, rare: true },
  sp_rustykey:     { id: 'sp_rustykey', emoji: '🗝️', name: '녹슨 열쇠', zone: 'mountain', weight: 0, rare: true },
  sp_meteor:       { id: 'sp_meteor', emoji: '☄️', name: '유성 파편', zone: 'mountain', weight: 0, rare: true },
  sp_fireheart:    { id: 'sp_fireheart', emoji: '🔥', name: '불의 심장', zone: 'mountain', weight: 0, rare: true },
  sp_sunbead:      { id: 'sp_sunbead', emoji: '🔆', name: '햇살 결정', zone: 'plain', weight: 0, rare: true },
  sp_silverspoon:  { id: 'sp_silverspoon', emoji: '🥄', name: '미식가의 은수저', zone: 'plain', weight: 0, rare: true },
  sp_mirrorbit:    { id: 'sp_mirrorbit', emoji: '🔹', name: '거울 조각', zone: 'plain', weight: 0, rare: true },
  sp_goldwalnut:   { id: 'sp_goldwalnut', emoji: '🏆', name: '황금 호두', zone: 'plain', weight: 0, rare: true },
  sp_windseed:     { id: 'sp_windseed', emoji: '🌪️', name: '바람의 씨앗', zone: 'plain', weight: 0, rare: true },
  sp_queenhoney:   { id: 'sp_queenhoney', emoji: '👑', name: '여왕벌의 꿀', zone: 'plain', weight: 0, rare: true },
  sp_duskear:      { id: 'sp_duskear', emoji: '🌆', name: '노을 이삭', zone: 'plain', weight: 0, rare: true },
  sp_fiveleaf:     { id: 'sp_fiveleaf', emoji: '🍀', name: '행운의 다섯잎', zone: 'plain', weight: 0, rare: true },
  sp_lostribbon:   { id: 'sp_lostribbon', emoji: '🎀', name: '잃어버린 리본', zone: 'plain', weight: 0, rare: true },
  sp_fallenstar:   { id: 'sp_fallenstar', emoji: '⭐', name: '떨어진 별', zone: 'plain', weight: 0, rare: true },
  sp_pumpkinseed:  { id: 'sp_pumpkinseed', emoji: '🌱', name: '뒤로 깠다는 호박씨', zone: 'plain', weight: 0, rare: true },
  sp_mistseed:     { id: 'sp_mistseed', emoji: '🫧', name: '안개의 씨앗', zone: 'forest', weight: 0, rare: true },
  sp_lostcompass:  { id: 'sp_lostcompass', emoji: '🧭', name: '길잃은 나침반', zone: 'forest', weight: 0, rare: true },
  sp_capcrown:     { id: 'sp_capcrown', emoji: '👑', name: '버섯왕관', zone: 'forest', weight: 0, rare: true },
  sp_fireflyjar:   { id: 'sp_fireflyjar', emoji: '🏮', name: '반딧불 유리병', zone: 'forest', weight: 0, rare: true },
  sp_owleye:       { id: 'sp_owleye', emoji: '👁️', name: '부엉이의 눈', zone: 'forest', weight: 0, rare: true },
  sp_silverweb:    { id: 'sp_silverweb', emoji: '🪡', name: '은실 거미줄', zone: 'forest', weight: 0, rare: true },
  sp_spiritbit:    { id: 'sp_spiritbit', emoji: '🧚', name: '정령의 조각', zone: 'forest', weight: 0, rare: true },
  sp_whisperbloom: { id: 'sp_whisperbloom', emoji: '🌺', name: '속삭임 꽃', zone: 'forest', weight: 0, rare: true },
  sp_moondust:     { id: 'sp_moondust', emoji: '💫', name: '달빛 가루', zone: 'forest', weight: 0, rare: true },
  sp_mosskey:      { id: 'sp_mosskey', emoji: '🔑', name: '이끼 낀 열쇠', zone: 'forest', weight: 0, rare: true },
  sp_frogcrown:    { id: 'sp_frogcrown', emoji: '👑', name: '청개구리 왕관', zone: 'waste', weight: 0, rare: true },
  sp_desertglass:  { id: 'sp_desertglass', emoji: '🔷', name: '사막의 유리', zone: 'waste', weight: 0, rare: true },
  sp_saltrose:     { id: 'sp_saltrose', emoji: '🌹', name: '소금 장미', zone: 'waste', weight: 0, rare: true },
  sp_brokenspoke:  { id: 'sp_brokenspoke', emoji: '⚙️', name: '부서진 바퀴살', zone: 'waste', weight: 0, rare: true },
  sp_thorncrown:   { id: 'sp_thorncrown', emoji: '🌵', name: '가시 왕관', zone: 'waste', weight: 0, rare: true },
  sp_fossil:       { id: 'sp_fossil', emoji: '🦕', name: '고대의 화석', zone: 'waste', weight: 0, rare: true },
  sp_miragevial:   { id: 'sp_miragevial', emoji: '🧪', name: '신기루 유리병', zone: 'waste', weight: 0, rare: true },
  sp_boltcore:     { id: 'sp_boltcore', emoji: '⚡', name: '번개 맞은 철심', zone: 'waste', weight: 0, rare: true },
  sp_goldscale:    { id: 'sp_goldscale', emoji: '🟡', name: '도마뱀의 금비늘', zone: 'waste', weight: 0, rare: true },
  sp_crowtreasure: { id: 'sp_crowtreasure', emoji: '💍', name: '까마귀의 보물', zone: 'waste', weight: 0, rare: true },
  sp_starsand:     { id: 'sp_starsand', emoji: '✨', name: '별모래', zone: 'shore', weight: 0, rare: true },
  sp_singingconch: { id: 'sp_singingconch', emoji: '🎺', name: '노래하는 소라', zone: 'shore', weight: 0, rare: true },
  sp_waveheart:    { id: 'sp_waveheart', emoji: '💙', name: '파도의 심장', zone: 'shore', weight: 0, rare: true },
  sp_beaconember:  { id: 'sp_beaconember', emoji: '🕯️', name: '등대의 불씨', zone: 'shore', weight: 0, rare: true },
  sp_coralcrown:   { id: 'sp_coralcrown', emoji: '👑', name: '산호 왕관', zone: 'shore', weight: 0, rare: true },
  sp_gullletter:   { id: 'sp_gullletter', emoji: '✉️', name: '갈매기의 편지', zone: 'shore', weight: 0, rare: true },
  sp_captainwatch: { id: 'sp_captainwatch', emoji: '⏱️', name: '선장의 회중시계', zone: 'shore', weight: 0, rare: true },
  sp_rainbowfoam:  { id: 'sp_rainbowfoam', emoji: '🌈', name: '무지개 거품', zone: 'shore', weight: 0, rare: true },
  sp_duskshell:    { id: 'sp_duskshell', emoji: '🌇', name: '노을 조개', zone: 'shore', weight: 0, rare: true },
  sp_mermaidscale: { id: 'sp_mermaidscale', emoji: '🧜‍♀️', name: '인어의 비늘', zone: 'shore', weight: 0, rare: true },
  // ── 특수 작물 (밭에서만 나온다 · FARM.md) ──
  // **`rare` 가 아니다.** `rare` 는 채집에서 0.1% 로 나오는 히든이고 확률표를 탄다.
  // 이쪽은 **채집으로는 아예 안 나온다**(어느 맵의 pool 에도 없다) — `farm: true` 로 표시한다.
  // 손으로 고치지 않는다: `npm run gen:farm` (tools/genfarm.js)
  // <<<GEN:farm-ing
  ember_chili: { id: 'ember_chili', emoji: '🌶️', name: '불꽃 고추', zone: 'farm', weight: 0, farm: true },
  stone_potato: { id: 'stone_potato', emoji: '🥔', name: '바위 감자', zone: 'farm', weight: 0, farm: true },
  whisper_corn: { id: 'whisper_corn', emoji: '🌽', name: '속삭임 옥수수', zone: 'farm', weight: 0, farm: true },
  tear_lotus: { id: 'tear_lotus', emoji: '🪷', name: '눈물 연꽃', zone: 'farm', weight: 0, farm: true },
  dawn_tomato: { id: 'dawn_tomato', emoji: '🍅', name: '새벽 토마토', zone: 'farm', weight: 0, farm: true },
  shadow_eggplant: { id: 'shadow_eggplant', emoji: '🍆', name: '그림자 가지', zone: 'farm', weight: 0, farm: true },
// GEN:farm-ing>>>
};

// 특별한 재료가 나올 확률은 **맵마다 다르다** — SPECIAL_TIERS · specialTier() 를 볼 것.
// 예전에는 여기 있던 SPECIAL_RATE(0.1%) 하나로 51곳이 전부 같았다. 지운 이유는
// 쓰지 않는 값이 남아 있으면 다음 사람이 그것을 진짜 확률로 읽기 때문이다.

// ─── 채집 지대 (Zones) ─── 채집 화면의 카테고리 탭
// `ap` = 그 지대에서 한 번 채집하는 데 드는 AP.
//
// **앞은 싸고 뒤는 비싸다.** 예전에는 어디서나 10 이었는데, 그러면 초반에 재료를
// 모으는 값과 후반에 모으는 값이 같아 **초반이 필요 이상으로 팍팍했다** —
// 플레이테스트에서 「AP 가 금방 닳는다」로 돌아온 자리다.
//
// ⚠️ **오름차순이어야 한다.** 뒤 지대가 더 싸면 앞 지대를 지날 이유가 없어진다.
// `tools/checkbalance.js` 가 순서와 리그 상한을 같이 본다.
const ZONES = [
  { id: 'plain',    emoji: '🌾', name: '포근 평야 지대', ap: 6 },
  { id: 'forest',   emoji: '🌲', name: '울창 숲 지대',   ap: 8 },
  { id: 'mountain', emoji: '⛰️', name: '뾰족 산악 지대', ap: 11 },
  { id: 'shore',    emoji: '🐚', name: '반짝 해안 지대', ap: 14 },
  { id: 'waste',    emoji: '🏜️', name: '황량 황무지',   ap: 17 },
];
// 지대의 채집 값. 모르는 지대는 예전 값(10)으로 떨어진다 — 밭 작물처럼
// **채집으로 얻는 것이 아닌 재료**는 이 표를 아예 안 지난다
function zoneAp(id) { const z = ZONES.find(x => x.id === id); return z && z.ap ? z.ap : 10; }

// ─── 채집 맵 (Maps) ─── 지대마다 10곳
// pool: 일반 재료 5종 (weight 로 가중 추첨) / special: 0.1% 확률의 특별 재료
const MAPS = [
  // ── 포근 평야 지대 ── (해금 0~30점)
  { id: 'p_hill', zone: 'plain', emoji: '☀️', name: '햇살 언덕',
    desc: '하루 종일 볕이 드는 언덕.',
    pool: ['herb', 'berry', 'sun_seed', 'wheat', 'dew'], unlock: 0, special: 'sp_sunbead' },
  { id: 'p_gourmet', zone: 'plain', emoji: '🍽️', name: '미식가의 들',
    desc: '맛있는 것만 자란다는 들.',
    pool: ['berry', 'honey', 'walnut', 'wheat', 'herb'], unlock: 0, special: 'sp_silverspoon' },
  { id: 'p_mirror', zone: 'plain', emoji: '🪞', name: '거울 저수지',
    desc: '하늘을 그대로 비추는 저수지.',
    pool: ['dew', 'wheat', 'thistle', 'herb', 'butter_flower'], unlock: 0, special: 'sp_mirrorbit' },
  { id: 'p_walnut', zone: 'plain', emoji: '🌰', name: '호두 마루',
    desc: '호두나무가 줄지어 선 마루.',
    pool: ['walnut', 'wheat', 'thistle', 'berry', 'herb'], unlock: 0, special: 'sp_goldwalnut' },
  { id: 'p_windmill', zone: 'plain', emoji: '🌬️', name: '바람개비 밭',
    desc: '바람개비가 끝없이 돌아가는 밭.',
    pool: ['wheat', 'sun_seed', 'thistle', 'clover', 'herb'], unlock: 4, special: 'sp_windseed' },
  { id: 'p_bee', zone: 'plain', emoji: '🐝', name: '꿀벌 목장',
    desc: '벌들이 부지런히 오가는 목장.',
    pool: ['honey', 'butter_flower', 'berry', 'thistle', 'herb'], unlock: 8, special: 'sp_queenhoney' },
  { id: 'p_sunset', zone: 'plain', emoji: '🌇', name: '노을 밀밭',
    desc: '노을에 물드는 밀밭.',
    pool: ['wheat', 'sun_seed', 'walnut', 'dew', 'berry'], unlock: 12, special: 'sp_duskear' },
  { id: 'p_clover', zone: 'plain', emoji: '🍀', name: '네잎 들판',
    desc: '네잎 클로버가 숨어 있는 들판.',
    pool: ['clover', 'herb', 'dew', 'thistle', 'butter_flower'], unlock: 18, special: 'sp_fiveleaf' },
  { id: 'p_picnic', zone: 'plain', emoji: '🧺', name: '소풍 바위',
    desc: '소풍 오기 좋은 널찍한 바위.',
    pool: ['berry', 'honey', 'walnut', 'herb', 'wheat'], unlock: 24, special: 'sp_lostribbon' },
  { id: 'p_starfield', zone: 'plain', emoji: '✨', name: '별헤는 평지',
    desc: '누워서 별을 세는 평지.',
    pool: ['dew', 'butter_flower', 'clover', 'thistle', 'sun_seed'], unlock: 30, special: 'sp_fallenstar' },
  // 특별 맵 — 누르면 채집이 아니라 미니게임(호박 피하기)으로 들어간다. mini 키가 그 표시다.
  { id: 'p_pumpkin', zone: 'plain', emoji: '🎃', name: '파수꾼의 호박 밭',
    desc: '함부로 들어가면 파수꾼이 호박을 굴려 혼쭐 내준다는 소문의 호박 밭.',
    pool: ['zucchini', 'old_pumpkin', 'sweet_pumpkin', 'chestnut_pumpkin'], unlock: 20,
    special: 'sp_pumpkinseed', mini: 'pumpkin' },
  // ── 울창 숲 지대 ── (해금 38~102점)
  { id: 'f_mist', zone: 'forest', emoji: '🌫️', name: '안개 숲 외곽',
    desc: '늘 옅은 안개가 낀 숲의 가장자리.',
    pool: ['night_dew', 'moss_branch', 'fern', 'wild_ivy', 'petal'], unlock: 38, special: 'sp_mistseed' },
  { id: 'f_path', zone: 'forest', emoji: '🚶', name: '완만한 숲길',
    desc: '걷기 좋은 완만한 숲길.',
    pool: ['wild_ivy', 'fern', 'moss_branch', 'petal', 'tree_resin'], unlock: 44, special: 'sp_lostcompass' },
  { id: 'f_mushroom', zone: 'forest', emoji: '🍄', name: '버섯 마을',
    desc: '버섯이 집처럼 솟은 자리.',
    pool: ['mushroom', 'fern', 'tree_resin', 'moss_branch', 'night_dew'], unlock: 50, special: 'sp_capcrown' },
  { id: 'f_firefly', zone: 'forest', emoji: '🐛', name: '반딧불 늪가',
    desc: '밤이면 반딧불이 가득한 늪가.',
    pool: ['firefly', 'night_dew', 'mushroom', 'moss_branch', 'wild_ivy'], unlock: 56, special: 'sp_fireflyjar' },
  { id: 'f_owl', zone: 'forest', emoji: '🦉', name: '부엉이 고목',
    desc: '부엉이가 사는 늙은 나무.',
    pool: ['owl_feather', 'spider_silk', 'moss_branch', 'tree_resin', 'wild_ivy'], unlock: 62, special: 'sp_owleye' },
  { id: 'f_spider', zone: 'forest', emoji: '🕸️', name: '거미줄 다리',
    desc: '거미줄이 다리처럼 걸린 골짜기.',
    pool: ['spider_silk', 'fern', 'tree_resin', 'moss_branch', 'firefly'], unlock: 70, special: 'sp_silverweb' },
  { id: 'f_spirit', zone: 'forest', emoji: '🌳', name: '이끼 정령터',
    desc: '정령이 머문다는 이끼 낀 터.',
    pool: ['moss_branch', 'fern', 'night_dew', 'petal', 'wild_ivy'], unlock: 78, special: 'sp_spiritbit' },
  { id: 'f_bush', zone: 'forest', emoji: '🍃', name: '속삭이는 덤불',
    desc: '바람이 지나면 속삭이는 덤불.',
    pool: ['wild_ivy', 'petal', 'fern', 'spider_silk', 'tree_resin'], unlock: 86, special: 'sp_whisperbloom' },
  { id: 'f_moon', zone: 'forest', emoji: '🌙', name: '달빛 공터',
    desc: '달빛만 내려앉는 작은 공터.',
    pool: ['night_dew', 'firefly', 'petal', 'moss_branch', 'owl_feather'], unlock: 94, special: 'sp_moondust' },
  { id: 'f_door', zone: 'forest', emoji: '🚪', name: '오래된 나무문',
    desc: '숲 한가운데 서 있는 문.',
    pool: ['tree_resin', 'spider_silk', 'fern', 'moss_branch', 'owl_feather'], unlock: 102, special: 'sp_mosskey' },
  // ── 뾰족 산악 지대 ── (해금 112~210점)
  { id: 'm_mine', zone: 'mountain', emoji: '⛏️', name: '버려진 광산',
    desc: '오래전 버려진 갱도. 광석이 굴러다닌다.',
    pool: ['iron_ore', 'crystal', 'cave_moss', 'flint', 'echo_stone'], unlock: 112, special: 'sp_starore' },
  { id: 'm_lake', zone: 'mountain', emoji: '🏞️', name: '고요 호수',
    desc: '바람 한 점 없는 산정 호수.',
    pool: ['mist_drop', 'cave_moss', 'snow_bud', 'cloud_moss', 'pine_cone'], unlock: 122, special: 'sp_laketear' },
  { id: 'm_rock', zone: 'mountain', emoji: '🗿', name: '흔들 바위산',
    desc: '건드리면 흔들리는 거대한 바위들.',
    pool: ['echo_stone', 'iron_ore', 'cave_moss', 'flint', 'pine_cone'], unlock: 132, special: 'sp_rockchip' },
  { id: 'm_cloud', zone: 'mountain', emoji: '☁️', name: '구름모자 산중턱',
    desc: '구름이 모자처럼 걸린 중턱.',
    pool: ['cloud_moss', 'mist_drop', 'snow_bud', 'eagle_feather', 'cave_moss'], unlock: 142, special: 'sp_cloudwool' },
  { id: 'm_eyrie', zone: 'mountain', emoji: '🪶', name: '매 둥지 절벽',
    desc: '매들이 둥지를 튼 아찔한 절벽.',
    pool: ['eagle_feather', 'cloud_moss', 'echo_stone', 'pine_cone', 'mist_drop'], unlock: 152, special: 'sp_goldfeather' },
  { id: 'm_frost', zone: 'mountain', emoji: '❄️', name: '서리 골짜기',
    desc: '한여름에도 서리가 남는 골짜기.',
    pool: ['snow_bud', 'mist_drop', 'cave_moss', 'cloud_moss', 'crystal'], unlock: 162, special: 'sp_everfrost' },
  { id: 'm_echo', zone: 'mountain', emoji: '📣', name: '메아리 협곡',
    desc: '소리가 몇 번이고 되돌아오는 협곡.',
    pool: ['echo_stone', 'iron_ore', 'flint', 'cave_moss', 'pine_cone'], unlock: 174, special: 'sp_echogem' },
  { id: 'm_ropeway', zone: 'mountain', emoji: '🚡', name: '낡은 삭도 터',
    desc: '광석을 나르던 삭도의 흔적.',
    pool: ['iron_ore', 'flint', 'echo_stone', 'pine_cone', 'cave_moss'], unlock: 186, special: 'sp_rustykey' },
  { id: 'm_observe', zone: 'mountain', emoji: '🔭', name: '별빛 전망대',
    desc: '밤이면 별이 쏟아지는 전망대.',
    pool: ['cloud_moss', 'snow_bud', 'eagle_feather', 'mist_drop', 'crystal'], unlock: 198, special: 'sp_meteor' },
  { id: 'm_ash', zone: 'mountain', emoji: '🌋', name: '화산재 능선',
    desc: '따뜻한 재가 쌓인 능선.',
    pool: ['flint', 'iron_ore', 'cave_moss', 'echo_stone', 'pine_cone'], unlock: 210, special: 'sp_fireheart' },
  // ── 반짝 해안 지대 ── (해금 224~350점)
  { id: 's_beach', zone: 'shore', emoji: '🏖️', name: '반짝 모래사장',
    desc: '햇빛에 모래가 반짝이는 해변.',
    pool: ['shell', 'foam', 'starfish', 'sea_glass', 'crab_claw'], unlock: 224, special: 'sp_starsand' },
  { id: 's_cave', zone: 'shore', emoji: '🐚', name: '소라 동굴',
    desc: '파도 소리가 울리는 소라 모양 동굴.',
    pool: ['shell', 'coral', 'pearl_bit', 'sea_glass', 'sea_dew'], unlock: 238, special: 'sp_singingconch' },
  { id: 's_rock', zone: 'shore', emoji: '🌊', name: '파도 바위',
    desc: '파도가 끊임없이 부딪는 바위.',
    pool: ['foam', 'crab_claw', 'driftwood', 'starfish', 'shell'], unlock: 252, special: 'sp_waveheart' },
  { id: 's_light', zone: 'shore', emoji: '🔦', name: '등대 언덕',
    desc: '밤새 불을 밝히는 등대.',
    pool: ['driftwood', 'sea_glass', 'seaweed', 'sea_dew', 'shell'], unlock: 266, special: 'sp_beaconember' },
  { id: 's_coral', zone: 'shore', emoji: '🪸', name: '산호 여울',
    desc: '산호가 자라는 얕은 여울.',
    pool: ['coral', 'pearl_bit', 'starfish', 'foam', 'seaweed'], unlock: 280, special: 'sp_coralcrown' },
  { id: 's_gull', zone: 'shore', emoji: '🕊️', name: '갈매기 절벽',
    desc: '갈매기가 줄지어 앉은 절벽.',
    pool: ['shell', 'starfish', 'crab_claw', 'seaweed', 'driftwood'], unlock: 294, special: 'sp_gullletter' },
  { id: 's_wreck', zone: 'shore', emoji: '⛵', name: '난파선 잔해',
    desc: '모래에 반쯤 묻힌 난파선.',
    pool: ['driftwood', 'crab_claw', 'sea_dew', 'pearl_bit', 'sea_glass'], unlock: 308, special: 'sp_captainwatch' },
  { id: 's_foam', zone: 'shore', emoji: '🫧', name: '물거품 웅덩이',
    desc: '물거품이 고이는 웅덩이.',
    pool: ['foam', 'sea_dew', 'sea_glass', 'coral', 'starfish'], unlock: 322, special: 'sp_rainbowfoam' },
  { id: 's_pier', zone: 'shore', emoji: '🌅', name: '해질녘 방파제',
    desc: '노을이 내려앉는 방파제.',
    pool: ['shell', 'crab_claw', 'starfish', 'seaweed', 'foam'], unlock: 336, special: 'sp_duskshell' },
  { id: 's_mermaid', zone: 'shore', emoji: '🧜', name: '인어의 바위',
    desc: '인어가 앉았다는 바위.',
    pool: ['pearl_bit', 'sea_glass', 'coral', 'sea_dew', 'shell'], unlock: 350, special: 'sp_mermaidscale' },
  // ── 황량 황무지 ── (해금 366~510점)
  { id: 'w_swamp', zone: 'waste', emoji: '🐸', name: '청개구리의 늪',
    desc: '청개구리 울음이 그치지 않는 늪.',
    pool: ['frog_egg', 'dry_root', 'black_feather', 'sand_grain', 'salt_crust'], unlock: 366, special: 'sp_frogcrown' },
  { id: 'w_dune', zone: 'waste', emoji: '🏜️', name: '까끌 모래 언덕',
    desc: '발이 푹푹 빠지는 모래 언덕.',
    pool: ['sand_grain', 'cactus', 'mirage_shard', 'lizard_scale', 'salt_crust'], unlock: 382, special: 'sp_desertglass' },
  { id: 'w_salt', zone: 'waste', emoji: '🧂', name: '소금 평원',
    desc: '하얗게 마른 소금 평원.',
    pool: ['salt_crust', 'sand_grain', 'bone_frag', 'mirage_shard', 'lizard_scale'], unlock: 398, special: 'sp_saltrose' },
  { id: 'w_cart', zone: 'waste', emoji: '🛞', name: '부서진 수레길',
    desc: '수레가 다니던 길의 잔해.',
    pool: ['rust_nail', 'sand_grain', 'dry_root', 'bone_frag', 'lizard_scale'], unlock: 414, special: 'sp_brokenspoke' },
  { id: 'w_thorn', zone: 'waste', emoji: '🌵', name: '가시덤불 협곡',
    desc: '가시덤불이 빼곡한 협곡.',
    pool: ['cactus', 'dry_root', 'sand_grain', 'lizard_scale', 'frog_egg'], unlock: 430, special: 'sp_thorncrown' },
  { id: 'w_bone', zone: 'waste', emoji: '🦴', name: '뼈의 골짜기',
    desc: '오래된 뼈가 흩어진 골짜기.',
    pool: ['bone_frag', 'dry_root', 'sand_grain', 'rust_nail', 'black_feather'], unlock: 446, special: 'sp_fossil' },
  { id: 'w_mirage', zone: 'waste', emoji: '🌀', name: '신기루 오아시스',
    desc: '다가가면 사라지는 오아시스.',
    pool: ['mirage_shard', 'salt_crust', 'sand_grain', 'frog_egg', 'bone_frag'], unlock: 462, special: 'sp_miragevial' },
  { id: 'w_tower', zone: 'waste', emoji: '🗼', name: '녹슨 철탑',
    desc: '벼락을 맞은 채 서 있는 철탑.',
    pool: ['rust_nail', 'sand_grain', 'salt_crust', 'black_feather', 'bone_frag'], unlock: 478, special: 'sp_boltcore' },
  { id: 'w_lizard', zone: 'waste', emoji: '🦎', name: '도마뱀 바위굴',
    desc: '도마뱀들이 볕을 쬐는 바위굴.',
    pool: ['lizard_scale', 'sand_grain', 'cactus', 'dry_root', 'bone_frag'], unlock: 494, special: 'sp_goldscale' },
  { id: 'w_crow', zone: 'waste', emoji: '🐦‍⬛', name: '까마귀 언덕',
    desc: '까마귀가 모이는 마른 언덕.',
    pool: ['black_feather', 'rust_nail', 'sand_grain', 'dry_root', 'bone_frag'], unlock: 510, special: 'sp_crowtreasure' },
];

// ─── 레시피 (Recipes) ───
// inputs: 정렬된 재료 id 배열 (조합 판정용). result: 산출물 정의.
// kind: 'potion' | 'creature'
// 물약(potion) → 마시면 스탯 영구 상승 (소모)
// 크리처(creature) → 방에 전시, 패시브 매력 보너스
// ─── 마법 솥 (Cauldrons) ───
// slots: 재료를 넣을 수 있는 구멍 수 / unlock: 매력 총합 해금 점수
// 솥 그림은 **실루엣 하나에 색·장식만 갈아 끼운다** (옷과 같은 방식).
// art.body 몸통 3색(밝은→어두운) · art.trim 테두리/손잡이/다리 3색 · art.deco 장식 이름
// 장식은 cauldron.js 가 그린다: rust 녹 · shine 광택 · granite 점박이 · facet 결정면 ·
//                              moon 달 · stars 별 · dragon 용 · runes 룬
const CAULDRONS = [
  // 2구 — 튜토리얼용. 여기서 기초 물약(재료 2개짜리)을 배운다
  { id: 'cd_iron_old', emoji: '🪣', name: '낡은 무쇠 솥', slots: 2, unlock: 0,
    art: { body: ['#5c5750', '#3a352f', '#221f1b'], trim: ['#a08a63', '#7a663f', '#4e3f22'], deco: 'rust' } },
  // 3구 — 튜토리얼을 마쳐야 열린다 (점수가 아니라 진행으로 잠긴 유일한 솥)
  { id: 'cd_iron', emoji: '🫕', name: '무쇠 솥', slots: 3, unlock: 0, needsTutorial: true,
    art: { body: ['#544d5c', '#332e3a', '#1b1822'], trim: ['#ecca72', '#b8912f', '#7d5f1f'] } },
  // 돌 → 구리 순. 흔한 돌이 먼저고 금속이 나중이다
  { id: 'cd_stone', emoji: '🪨', name: '돌 솥', slots: 4, unlock: 20,
    art: { body: ['#b8b2a8', '#8b8579', '#514c44'], trim: ['#9a948a', '#6f6a61', '#454138'], deco: 'granite' } },
  { id: 'cd_copper', emoji: '🥘', name: '구리 솥', slots: 5, unlock: 60,
    art: { body: ['#e6cd94', '#b0913f', '#65511a'], trim: ['#f6e0aa', '#c4a049', '#7a5c1c'], deco: 'shine' } },
  { id: 'cd_silver', emoji: '🍲', name: '은빛 솥', slots: 6, unlock: 110,
    art: { body: ['#f2f4f8', '#b9c0cc', '#6e7684'], trim: ['#ffffff', '#c8cfda', '#79808c'], deco: 'shine' } },
  { id: 'cd_gold', emoji: '🏺', name: '황금 솥', slots: 7, unlock: 170,
    art: { body: ['#ffe9a8', '#e0b036', '#8d6614'], trim: ['#fff4c8', '#f0cd5c', '#9c7318'], deco: 'shine' } },
  { id: 'cd_crystal', emoji: '💠', name: '수정 솥', slots: 8, unlock: 240,
    art: { body: ['#e8f6ff', '#9fd0ee', '#4a7ea8'], trim: ['#ffffff', '#cfe3f2', '#7f96ab'], deco: 'facet' } },
  { id: 'cd_moon', emoji: '🌙', name: '달빛 솥', slots: 9, unlock: 320,
    art: { body: ['#5a6a9c', '#2f3a63', '#171c33'], trim: ['#f4f6ff', '#c3cbe4', '#7b849e'], deco: 'moon' } },
  { id: 'cd_star', emoji: '⭐', name: '별빛 솥', slots: 10, unlock: 410,
    art: { body: ['#6a4f9e', '#3a2663', '#1b1030'], trim: ['#ffe9a8', '#d8b45c', '#8a6a24'], deco: 'stars' } },
  { id: 'cd_dragon', emoji: '🐉', name: '용비늘 솥', slots: 11, unlock: 510,
    art: { body: ['#4c6a52', '#263b2c', '#101a13'], trim: ['#ffe08a', '#d8a63c', '#8a6412'], deco: 'dragon' } },
  // **마지막 한 대만 실루엣 규칙을 깬다** — 왕관·후광·룬 고리·빛기둥.
  // 색만 바꿔서는 '마지막 솥' 이 '색 다른 솥' 으로 읽힌다
  { id: 'cd_myth', emoji: '👑', name: '전설의 솥', slots: 12, unlock: 620,
    art: { body: ['#7a4a90', '#43225a', '#1d0e2b'], trim: ['#fff0b8', '#e6c05c', '#9c7a1c'],
      deco: 'runes', aura: '#ffd970', crown: true, orbit: true, beam: true } },
];

const RECIPES = [
  // ── 하급 물약 30종 (재료 2~3 · 평야/숲 초반 재료) ──
  { inputs: ['berry', 'herb'],
    result: { id: 'vitality', kind: 'potion', grade: 'basic', emoji: '🧴', name: '생기 물약',
      desc: '생기 기운이 감도는 기본 물약.', beauty: 1, charm: 0 } },
  { inputs: ['honey', 'sun_seed'],
    result: { id: 'blush', kind: 'potion', grade: 'basic', emoji: '💄', name: '홍조 물약',
      desc: '홍조 기운이 감도는 기본 물약.', beauty: 1, charm: 1 } },
  { inputs: ['butter_flower', 'honey'],
    result: { id: 'fragrance', kind: 'potion', grade: 'basic', emoji: '🌷', name: '향기 물약',
      desc: '향기 기운이 감도는 기본 물약.', beauty: 1, charm: 2 } },
  { inputs: ['clover', 'herb'],
    result: { id: 'p_03', kind: 'potion', grade: 'basic', emoji: '💧', name: '이슬 물약',
      desc: '이슬 기운이 감도는 기본 물약.', beauty: 1, charm: 3 } },
  { inputs: ['dew', 'wheat'],
    result: { id: 'p_04', kind: 'potion', grade: 'basic', emoji: '🌱', name: '새싹 물약',
      desc: '새싹 기운이 감도는 기본 물약.', beauty: 1, charm: 0 } },
  { inputs: ['dew', 'thistle'],
    result: { id: 'p_05', kind: 'potion', grade: 'basic', emoji: '🍃', name: '산들 물약',
      desc: '산들 기운이 감도는 기본 물약.', beauty: 1, charm: 1 } },
  { inputs: ['butter_flower', 'clover', 'wheat'],
    result: { id: 'p_06', kind: 'potion', grade: 'low', emoji: '☀️', name: '햇살 물약',
      desc: '햇살 기운이 감도는 기본 물약.', beauty: 1, charm: 2 } },
  { inputs: ['herb', 'honey', 'walnut'],
    result: { id: 'p_07', kind: 'potion', grade: 'low', emoji: '🙂', name: '미소 물약',
      desc: '미소 기운이 감도는 기본 물약.', beauty: 1, charm: 3 } },
  { inputs: ['butter_flower', 'dew', 'wheat'],
    result: { id: 'p_08', kind: 'potion', grade: 'low', emoji: '😴', name: '꿀잠 물약',
      desc: '꿀잠 기운이 감도는 기본 물약.', beauty: 2, charm: 0 } },
  { inputs: ['berry', 'dew', 'walnut'],
    result: { id: 'p_09', kind: 'potion', grade: 'low', emoji: '🌼', name: '들꽃 물약',
      desc: '들꽃 기운이 감도는 기본 물약.', beauty: 2, charm: 1 } },
  { inputs: ['clover', 'dew', 'thistle'],
    result: { id: 'p_10', kind: 'potion', grade: 'low', emoji: '🌿', name: '풀잎 물약',
      desc: '풀잎 기운이 감도는 기본 물약.', beauty: 2, charm: 2 } },
  { inputs: ['dew', 'sun_seed', 'wheat'],
    result: { id: 'p_11', kind: 'potion', grade: 'low', emoji: '🔆', name: '맑음 물약',
      desc: '맑음 기운이 감도는 기본 물약.', beauty: 2, charm: 3 } },
  { inputs: ['butter_flower', 'thistle', 'wheat'],
    result: { id: 'p_12', kind: 'potion', grade: 'low', emoji: '🔥', name: '온기 물약',
      desc: '온기 기운이 감도는 기본 물약.', beauty: 2, charm: 0 } },
  { inputs: ['berry', 'herb', 'honey'],
    result: { id: 'p_13', kind: 'potion', grade: 'low', emoji: '💕', name: '다정 물약',
      desc: '다정 기운이 감도는 기본 물약.', beauty: 2, charm: 1 } },
  { inputs: ['butter_flower', 'herb', 'wheat'],
    result: { id: 'p_14', kind: 'potion', grade: 'low', emoji: '🥣', name: '소박 물약',
      desc: '소박 기운이 감도는 기본 물약.', beauty: 2, charm: 2 } },
  { inputs: ['berry', 'dew', 'thistle'],
    result: { id: 'p_15', kind: 'potion', grade: 'low', emoji: '🌬️', name: '상쾌 물약',
      desc: '상쾌 기운이 감도는 기본 물약.', beauty: 2, charm: 3 } },
  { inputs: ['butter_flower', 'dew', 'thistle'],
    result: { id: 'p_16', kind: 'potion', grade: 'low', emoji: '🍬', name: '달콤 물약',
      desc: '달콤 기운이 감도는 기본 물약.', beauty: 3, charm: 0 } },
  { inputs: ['butter_flower', 'clover', 'thistle'],
    result: { id: 'p_17', kind: 'potion', grade: 'low', emoji: '🧸', name: '포근 물약',
      desc: '포근 기운이 감도는 기본 물약.', beauty: 3, charm: 1 } },
  { inputs: ['fern', 'moss_branch', 'thistle'],
    result: { id: 'p_18', kind: 'potion', grade: 'low', emoji: '🥒', name: '싱그런 물약',
      desc: '싱그런 기운이 감도는 기본 물약.', beauty: 3, charm: 2 } },
  { inputs: ['berry', 'honey', 'sun_seed'],
    result: { id: 'p_19', kind: 'potion', grade: 'low', emoji: '🌾', name: '보리 물약',
      desc: '보리 기운이 감도는 기본 물약.', beauty: 3, charm: 3 } },
  { inputs: ['fern', 'petal', 'walnut'],
    result: { id: 'p_20', kind: 'potion', grade: 'low', emoji: '🌰', name: '씨앗 물약',
      desc: '씨앗 기운이 감도는 기본 물약.', beauty: 3, charm: 0 } },
  { inputs: ['berry', 'fern', 'sun_seed'],
    result: { id: 'p_21', kind: 'potion', grade: 'low', emoji: '🫧', name: '잔잔 물약',
      desc: '잔잔 기운이 감도는 기본 물약.', beauty: 3, charm: 1 } },
  { inputs: ['clover', 'thistle', 'walnut'],
    result: { id: 'p_22', kind: 'potion', grade: 'low', emoji: '🕊️', name: '순한 물약',
      desc: '순한 기운이 감도는 기본 물약.', beauty: 3, charm: 2 } },
  { inputs: ['honey', 'sun_seed', 'thistle'],
    result: { id: 'p_23', kind: 'potion', grade: 'low', emoji: '🎈', name: '가벼운 물약',
      desc: '가벼운 기운이 감도는 기본 물약.', beauty: 3, charm: 3 } },
  { inputs: ['honey', 'petal', 'thistle'],
    result: { id: 'p_24', kind: 'potion', grade: 'low', emoji: '🧁', name: '부드런 물약',
      desc: '부드런 기운이 감도는 기본 물약.', beauty: 4, charm: 0 } },
  { inputs: ['dew', 'honey', 'wheat'],
    result: { id: 'p_25', kind: 'potion', grade: 'low', emoji: '💦', name: '촉촉 물약',
      desc: '촉촉 기운이 감도는 기본 물약.', beauty: 4, charm: 1 } },
  { inputs: ['dew', 'mushroom', 'thistle'],
    result: { id: 'p_26', kind: 'potion', grade: 'low', emoji: '🍑', name: '발그레 물약',
      desc: '발그레 기운이 감도는 기본 물약.', beauty: 4, charm: 2 } },
  { inputs: ['berry', 'dew', 'mushroom'],
    result: { id: 'p_27', kind: 'potion', grade: 'low', emoji: '🍂', name: '소슬 물약',
      desc: '소슬 기운이 감도는 기본 물약.', beauty: 4, charm: 3 } },
  { inputs: ['butter_flower', 'fern', 'thistle'],
    result: { id: 'p_28', kind: 'potion', grade: 'low', emoji: '🕯️', name: '은은 물약',
      desc: '은은 기운이 감도는 기본 물약.', beauty: 4, charm: 0 } },
  { inputs: ['dew', 'moss_branch', 'wheat'],
    result: { id: 'p_29', kind: 'potion', grade: 'low', emoji: '🍓', name: '산딸기 물약',
      desc: '산딸기 기운이 감도는 기본 물약.', beauty: 4, charm: 1 } },
  // ── 중급 물약 50종 (재료 4~6) ──
  { inputs: ['moss_branch', 'mushroom', 'thistle', 'walnut'],
    result: { id: 'mystic', kind: 'potion', grade: 'mid', emoji: '🔮', name: '신비 물약',
      desc: '신비 의 힘을 담아 정제한 물약.', beauty: 2, charm: 2 } },
  { inputs: ['berry', 'butter_flower', 'firefly', 'night_dew'],
    result: { id: 'm_31', kind: 'potion', grade: 'mid', emoji: '🧚', name: '숲의 정령 물약',
      desc: '숲의 정령 의 힘을 담아 정제한 물약.', beauty: 2, charm: 3 } },
  { inputs: ['butter_flower', 'dew', 'owl_feather', 'walnut'],
    result: { id: 'm_32', kind: 'potion', grade: 'mid', emoji: '🌫️', name: '안개 물약',
      desc: '안개 의 힘을 담아 정제한 물약.', beauty: 2, charm: 4 } },
  { inputs: ['clover', 'fern', 'night_dew', 'wild_ivy'],
    result: { id: 'm_33', kind: 'potion', grade: 'mid', emoji: '🍄', name: '버섯 물약',
      desc: '버섯 의 힘을 담아 정제한 물약.', beauty: 2, charm: 5 } },
  { inputs: ['honey', 'night_dew', 'spider_silk', 'wheat'],
    result: { id: 'm_34', kind: 'potion', grade: 'mid', emoji: '🐛', name: '반딧불 물약',
      desc: '반딧불 의 힘을 담아 정제한 물약.', beauty: 2, charm: 6 } },
  { inputs: ['berry', 'fern', 'herb', 'moss_branch'],
    result: { id: 'm_35', kind: 'potion', grade: 'mid', emoji: '🦉', name: '부엉이 물약',
      desc: '부엉이 의 힘을 담아 정제한 물약.', beauty: 2, charm: 2 } },
  { inputs: ['berry', 'dew', 'night_dew', 'spider_silk'],
    result: { id: 'm_36', kind: 'potion', grade: 'mid', emoji: '🕸️', name: '거미실 물약',
      desc: '거미실 의 힘을 담아 정제한 물약.', beauty: 2, charm: 3 } },
  { inputs: ['clover', 'fern', 'honey', 'owl_feather'],
    result: { id: 'm_37', kind: 'potion', grade: 'mid', emoji: '🟠', name: '수액 물약',
      desc: '수액 의 힘을 담아 정제한 물약.', beauty: 2, charm: 4 } },
  { inputs: ['berry', 'firefly', 'mushroom', 'spider_silk'],
    result: { id: 'm_38', kind: 'potion', grade: 'mid', emoji: '🌙', name: '밤이슬 물약',
      desc: '밤이슬 의 힘을 담아 정제한 물약.', beauty: 2, charm: 5 } },
  { inputs: ['butter_flower', 'clover', 'night_dew', 'tree_resin'],
    result: { id: 'm_39', kind: 'potion', grade: 'mid', emoji: '🍃', name: '담쟁이 물약',
      desc: '담쟁이 의 힘을 담아 정제한 물약.', beauty: 2, charm: 6 } },
  { inputs: ['dew', 'fern', 'mushroom', 'walnut'],
    result: { id: 'm_40', kind: 'potion', grade: 'mid', emoji: '⛏️', name: '무쇠 물약',
      desc: '무쇠 의 힘을 담아 정제한 물약.', beauty: 3, charm: 2 } },
  { inputs: ['firefly', 'herb', 'moss_branch', 'owl_feather'],
    result: { id: 'm_41', kind: 'potion', grade: 'mid', emoji: '💎', name: '수정 물약',
      desc: '수정 의 힘을 담아 정제한 물약.', beauty: 3, charm: 3 } },
  { inputs: ['dew', 'sun_seed', 'wheat', 'wild_ivy'],
    result: { id: 'm_42', kind: 'potion', grade: 'mid', emoji: '❄️', name: '설화 물약',
      desc: '설화 의 힘을 담아 정제한 물약.', beauty: 3, charm: 4 } },
  { inputs: ['butter_flower', 'moss_branch', 'owl_feather', 'thistle'],
    result: { id: 'm_43', kind: 'potion', grade: 'mid', emoji: '🪶', name: '매의 눈 물약',
      desc: '매의 눈 의 힘을 담아 정제한 물약.', beauty: 3, charm: 5 } },
  { inputs: ['honey', 'petal', 'spider_silk', 'walnut'],
    result: { id: 'm_44', kind: 'potion', grade: 'mid', emoji: '🗿', name: '메아리 물약',
      desc: '메아리 의 힘을 담아 정제한 물약.', beauty: 3, charm: 6 } },
  { inputs: ['flint', 'mushroom', 'petal', 'thistle'],
    result: { id: 'm_45', kind: 'potion', grade: 'mid', emoji: '🌲', name: '솔향 물약',
      desc: '솔향 의 힘을 담아 정제한 물약.', beauty: 3, charm: 2 } },
  { inputs: ['cave_moss', 'eagle_feather', 'moss_branch', 'night_dew'],
    result: { id: 'm_46', kind: 'potion', grade: 'mid', emoji: '💧', name: '산안개 물약',
      desc: '산안개 의 힘을 담아 정제한 물약.', beauty: 3, charm: 3 } },
  { inputs: ['butter_flower', 'eagle_feather', 'iron_ore', 'wild_ivy'],
    result: { id: 'm_47', kind: 'potion', grade: 'mid', emoji: '🔥', name: '부싯 물약',
      desc: '부싯 의 힘을 담아 정제한 물약.', beauty: 3, charm: 4 } },
  { inputs: ['clover', 'flint', 'herb', 'honey', 'wheat'],
    result: { id: 'm_48', kind: 'potion', grade: 'mid', emoji: '☁️', name: '구름 물약',
      desc: '구름 의 힘을 담아 정제한 물약.', beauty: 3, charm: 5 } },
  { inputs: ['butter_flower', 'dew', 'mushroom', 'petal', 'spider_silk'],
    result: { id: 'm_49', kind: 'potion', grade: 'mid', emoji: '🪨', name: '동굴 물약',
      desc: '동굴 의 힘을 담아 정제한 물약.', beauty: 3, charm: 6 } },
  { inputs: ['cloud_moss', 'echo_stone', 'honey', 'night_dew', 'wheat'],
    result: { id: 'm_50', kind: 'potion', grade: 'mid', emoji: '🏞️', name: '고요 물약',
      desc: '고요 의 힘을 담아 정제한 물약.', beauty: 4, charm: 2 } },
  { inputs: ['butter_flower', 'cloud_moss', 'eagle_feather', 'honey', 'walnut'],
    result: { id: 'm_51', kind: 'potion', grade: 'mid', emoji: '⭐', name: '별빛 물약',
      desc: '별빛 의 힘을 담아 정제한 물약.', beauty: 4, charm: 3 } },
  { inputs: ['clover', 'eagle_feather', 'firefly', 'iron_ore', 'snow_bud'],
    result: { id: 'm_52', kind: 'potion', grade: 'mid', emoji: '🌇', name: '노을 물약',
      desc: '노을 의 힘을 담아 정제한 물약.', beauty: 4, charm: 4 } },
  { inputs: ['butter_flower', 'cave_moss', 'fern', 'tree_resin', 'wild_ivy'],
    result: { id: 'm_53', kind: 'potion', grade: 'mid', emoji: '🐝', name: '꿀벌 물약',
      desc: '꿀벌 의 힘을 담아 정제한 물약.', beauty: 4, charm: 5 } },
  { inputs: ['clover', 'crystal', 'dew', 'mist_drop', 'spider_silk'],
    result: { id: 'm_54', kind: 'potion', grade: 'mid', emoji: '🍀', name: '클로버 물약',
      desc: '클로버 의 힘을 담아 정제한 물약.', beauty: 4, charm: 6 } },
  { inputs: ['echo_stone', 'herb', 'honey', 'sun_seed', 'wild_ivy'],
    result: { id: 'm_55', kind: 'potion', grade: 'mid', emoji: '🌬️', name: '바람개비 물약',
      desc: '바람개비 의 힘을 담아 정제한 물약.', beauty: 4, charm: 2 } },
  { inputs: ['crystal', 'eagle_feather', 'firefly', 'mushroom', 'sun_seed'],
    result: { id: 'm_56', kind: 'potion', grade: 'mid', emoji: '🥜', name: '호두 물약',
      desc: '호두 의 힘을 담아 정제한 물약.', beauty: 4, charm: 3 } },
  { inputs: ['cloud_moss', 'night_dew', 'thistle', 'walnut', 'wild_ivy'],
    result: { id: 'm_57', kind: 'potion', grade: 'mid', emoji: '🌻', name: '해바라기 물약',
      desc: '해바라기 의 힘을 담아 정제한 물약.', beauty: 4, charm: 4 } },
  { inputs: ['crystal', 'mist_drop', 'petal', 'pine_cone', 'spider_silk'],
    result: { id: 'm_58', kind: 'potion', grade: 'mid', emoji: '🧈', name: '버터 물약',
      desc: '버터 의 힘을 담아 정제한 물약.', beauty: 4, charm: 5 } },
  { inputs: ['honey', 'moss_branch', 'mushroom', 'pine_cone', 'snow_bud'],
    result: { id: 'm_59', kind: 'potion', grade: 'mid', emoji: '🌱', name: '엉겅퀴 물약',
      desc: '엉겅퀴 의 힘을 담아 정제한 물약.', beauty: 4, charm: 6 } },
  { inputs: ['berry', 'cave_moss', 'crystal', 'owl_feather', 'tree_resin'],
    result: { id: 'm_60', kind: 'potion', grade: 'mid', emoji: '🌾', name: '밀이삭 물약',
      desc: '밀이삭 의 힘을 담아 정제한 물약.', beauty: 5, charm: 2 } },
  { inputs: ['butter_flower', 'firefly', 'iron_ore', 'night_dew', 'pine_cone'],
    result: { id: 'm_61', kind: 'potion', grade: 'mid', emoji: '🪞', name: '거울 물약',
      desc: '거울 의 힘을 담아 정제한 물약.', beauty: 5, charm: 3 } },
  { inputs: ['clover', 'iron_ore', 'owl_feather', 'pine_cone', 'snow_bud'],
    result: { id: 'm_62', kind: 'potion', grade: 'mid', emoji: '🌺', name: '속삭임 물약',
      desc: '속삭임 의 힘을 담아 정제한 물약.', beauty: 5, charm: 4 } },
  { inputs: ['butter_flower', 'cave_moss', 'echo_stone', 'flint', 'pine_cone'],
    result: { id: 'm_63', kind: 'potion', grade: 'mid', emoji: '🪴', name: '고사리 물약',
      desc: '고사리 의 힘을 담아 정제한 물약.', beauty: 5, charm: 5 } },
  { inputs: ['berry', 'crystal', 'petal', 'pine_cone', 'wheat'],
    result: { id: 'm_64', kind: 'potion', grade: 'mid', emoji: '🌳', name: '이끼 물약',
      desc: '이끼 의 힘을 담아 정제한 물약.', beauty: 5, charm: 6 } },
  { inputs: ['clover', 'crystal', 'honey', 'mist_drop', 'owl_feather'],
    result: { id: 'm_65', kind: 'potion', grade: 'mid', emoji: '💫', name: '달빛 물약',
      desc: '달빛 의 힘을 담아 정제한 물약.', beauty: 5, charm: 2 } },
  { inputs: ['berry', 'crystal', 'eagle_feather', 'night_dew', 'walnut', 'wheat'],
    result: { id: 'm_66', kind: 'potion', grade: 'mid', emoji: '🌸', name: '꽃잎비 물약',
      desc: '꽃잎비 의 힘을 담아 정제한 물약.', beauty: 5, charm: 3 } },
  { inputs: ['butter_flower', 'firefly', 'iron_ore', 'mist_drop', 'spider_silk', 'walnut'],
    result: { id: 'm_67', kind: 'potion', grade: 'mid', emoji: '🚶', name: '숲길 물약',
      desc: '숲길 의 힘을 담아 정제한 물약.', beauty: 5, charm: 4 } },
  { inputs: ['cloud_moss', 'echo_stone', 'flint', 'petal', 'snow_bud', 'wild_ivy'],
    result: { id: 'm_68', kind: 'potion', grade: 'mid', emoji: '🌅', name: '아침 물약',
      desc: '아침 의 힘을 담아 정제한 물약.', beauty: 5, charm: 5 } },
  { inputs: ['clover', 'eagle_feather', 'herb', 'mist_drop', 'wheat', 'wild_ivy'],
    result: { id: 'm_69', kind: 'potion', grade: 'mid', emoji: '🌆', name: '저녁 물약',
      desc: '저녁 의 힘을 담아 정제한 물약.', beauty: 5, charm: 6 } },
  { inputs: ['crystal', 'eagle_feather', 'moss_branch', 'owl_feather', 'seaweed', 'snow_bud'],
    result: { id: 'm_70', kind: 'potion', grade: 'mid', emoji: '🌁', name: '연무 물약',
      desc: '연무 의 힘을 담아 정제한 물약.', beauty: 6, charm: 2 } },
  { inputs: ['coral', 'flint', 'mushroom', 'pearl_bit', 'sun_seed', 'thistle'],
    result: { id: 'm_71', kind: 'potion', grade: 'mid', emoji: '🧊', name: '서리 물약',
      desc: '서리 의 힘을 담아 정제한 물약.', beauty: 6, charm: 3 } },
  { inputs: ['butter_flower', 'coral', 'honey', 'owl_feather', 'seaweed', 'shell'],
    result: { id: 'm_72', kind: 'potion', grade: 'mid', emoji: '🗻', name: '바위 물약',
      desc: '바위 의 힘을 담아 정제한 물약.', beauty: 6, charm: 4 } },
  { inputs: ['cave_moss', 'cloud_moss', 'fern', 'flint', 'pearl_bit', 'seaweed'],
    result: { id: 'm_73', kind: 'potion', grade: 'mid', emoji: '⚒️', name: '광맥 물약',
      desc: '광맥 의 힘을 담아 정제한 물약.', beauty: 6, charm: 5 } },
  { inputs: ['cloud_moss', 'flint', 'herb', 'iron_ore', 'seaweed', 'wheat'],
    result: { id: 'm_74', kind: 'potion', grade: 'mid', emoji: '🫁', name: '심호흡 물약',
      desc: '심호흡 의 힘을 담아 정제한 물약.', beauty: 6, charm: 6 } },
  { inputs: ['berry', 'herb', 'mushroom', 'owl_feather', 'snow_bud', 'wheat'],
    result: { id: 'm_75', kind: 'potion', grade: 'mid', emoji: '🧘', name: '명상 물약',
      desc: '명상 의 힘을 담아 정제한 물약.', beauty: 6, charm: 2 } },
  { inputs: ['dew', 'honey', 'owl_feather', 'snow_bud', 'spider_silk', 'thistle'],
    result: { id: 'm_76', kind: 'potion', grade: 'mid', emoji: '⚡', name: '활력 물약',
      desc: '활력 의 힘을 담아 정제한 물약.', beauty: 6, charm: 3 } },
  { inputs: ['cloud_moss', 'eagle_feather', 'echo_stone', 'mist_drop', 'moss_branch', 'owl_feather'],
    result: { id: 'm_77', kind: 'potion', grade: 'mid', emoji: '⚖️', name: '균형 물약',
      desc: '균형 의 힘을 담아 정제한 물약.', beauty: 6, charm: 4 } },
  { inputs: ['cave_moss', 'clover', 'herb', 'seaweed', 'thistle', 'wild_ivy'],
    result: { id: 'm_78', kind: 'potion', grade: 'mid', emoji: '🎗️', name: '절제 물약',
      desc: '절제 의 힘을 담아 정제한 물약.', beauty: 6, charm: 5 } },
  { inputs: ['butter_flower', 'coral', 'echo_stone', 'flint', 'petal', 'wheat'],
    result: { id: 'm_79', kind: 'potion', grade: 'mid', emoji: '⏳', name: '인내 물약',
      desc: '인내 의 힘을 담아 정제한 물약.', beauty: 6, charm: 6 } },
  // ── 상급 물약 20종 (재료 7~12) ──
  { inputs: ['fern', 'firefly', 'frog_egg', 'mirage_shard', 'pearl_bit', 'seaweed', 'sp_frogcrown'],
    result: { id: 'rainbow', kind: 'potion', grade: 'high', emoji: '🌈', name: '무지개 엘릭서',
      desc: '전설로만 전해지는 무지개 엘릭서. 특별한 재료가 필요하다.', beauty: 6, charm: 6 } },
  { inputs: ['crab_claw', 'echo_stone', 'firefly', 'foam', 'moss_branch', 'petal', 'sp_singingconch'],
    result: { id: 'h_81', kind: 'potion', grade: 'high', emoji: '👑', name: '여신의 이슬',
      desc: '전설로만 전해지는 여신의 이슬. 특별한 재료가 필요하다.', beauty: 6, charm: 6 } },
  { inputs: ['black_feather', 'crab_claw', 'foam', 'frog_egg', 'owl_feather', 'sea_glass', 'sp_saltrose'],
    result: { id: 'h_82', kind: 'potion', grade: 'high', emoji: '🔱', name: '불멸',
      desc: '전설로만 전해지는 불멸. 특별한 재료가 필요하다.', beauty: 7, charm: 7 } },
  { inputs: ['lizard_scale', 'mirage_shard', 'mist_drop', 'night_dew', 'sea_glass', 'sp_beaconember', 'tree_resin'],
    result: { id: 'h_83', kind: 'potion', grade: 'high', emoji: '🌊', name: '심해',
      desc: '전설로만 전해지는 심해. 특별한 재료가 필요하다.', beauty: 7, charm: 7 } },
  { inputs: ['bone_frag', 'cloud_moss', 'echo_stone', 'foam', 'mushroom', 'pine_cone', 'shell', 'sp_thorncrown'],
    result: { id: 'h_84', kind: 'potion', grade: 'high', emoji: '⚪', name: '진주',
      desc: '전설로만 전해지는 진주. 특별한 재료가 필요하다.', beauty: 8, charm: 8 } },
  { inputs: ['black_feather', 'bone_frag', 'dry_root', 'flint', 'moss_branch', 'pine_cone', 'salt_crust', 'sp_gullletter'],
    result: { id: 'h_85', kind: 'potion', grade: 'high', emoji: '🪸', name: '산호',
      desc: '전설로만 전해지는 산호. 특별한 재료가 필요하다.', beauty: 8, charm: 8 } },
  { inputs: ['bone_frag', 'firefly', 'frog_egg', 'lizard_scale', 'moss_branch', 'salt_crust', 'shell', 'sp_miragevial'],
    result: { id: 'h_86', kind: 'potion', grade: 'high', emoji: '🧜‍♀️', name: '인어',
      desc: '전설로만 전해지는 인어. 특별한 재료가 필요하다.', beauty: 9, charm: 9 } },
  { inputs: ['cave_moss', 'crab_claw', 'foam', 'lizard_scale', 'pine_cone', 'rust_nail', 'shell', 'sp_rainbowfoam'],
    result: { id: 'h_87', kind: 'potion', grade: 'high', emoji: '🌪️', name: '폭풍',
      desc: '전설로만 전해지는 폭풍. 특별한 재료가 필요하다.', beauty: 9, charm: 9 } },
  { inputs: ['cave_moss', 'crab_claw', 'eagle_feather', 'mushroom', 'pearl_bit', 'pine_cone', 'sea_glass', 'shell', 'sp_goldscale'],
    result: { id: 'h_88', kind: 'potion', grade: 'high', emoji: '🌟', name: '사막의 별',
      desc: '전설로만 전해지는 사막의 별. 특별한 재료가 필요하다.', beauty: 10, charm: 10 } },
  { inputs: ['bone_frag', 'cave_moss', 'driftwood', 'echo_stone', 'flint', 'salt_crust', 'sand_grain', 'shell', 'sp_mermaidscale'],
    result: { id: 'h_89', kind: 'potion', grade: 'high', emoji: '🌀', name: '신기루',
      desc: '전설로만 전해지는 신기루. 특별한 재료가 필요하다.', beauty: 10, charm: 10 } },
  { inputs: ['bone_frag', 'dry_root', 'lizard_scale', 'mushroom', 'salt_crust', 'shell', 'snow_bud', 'sp_frogcrown', 'wild_ivy'],
    result: { id: 'h_90', kind: 'potion', grade: 'high', emoji: '🌹', name: '소금꽃',
      desc: '전설로만 전해지는 소금꽃. 특별한 재료가 필요하다.', beauty: 11, charm: 11 } },
  { inputs: ['bone_frag', 'cloud_moss', 'dry_root', 'firefly', 'foam', 'lizard_scale', 'rust_nail', 'snow_bud', 'sp_singingconch'],
    result: { id: 'h_91', kind: 'potion', grade: 'high', emoji: '🦕', name: '화석',
      desc: '전설로만 전해지는 화석. 특별한 재료가 필요하다.', beauty: 11, charm: 11 } },
  { inputs: ['crystal', 'dry_root', 'echo_stone', 'mirage_shard', 'rust_nail', 'salt_crust', 'sand_grain', 'sea_glass', 'seaweed', 'sp_saltrose'],
    result: { id: 'h_92', kind: 'potion', grade: 'high', emoji: '🐦‍⬛', name: '까마귀',
      desc: '전설로만 전해지는 까마귀. 특별한 재료가 필요하다.', beauty: 12, charm: 12 } },
  { inputs: ['cave_moss', 'crab_claw', 'dry_root', 'foam', 'lizard_scale', 'moss_branch', 'salt_crust', 'sea_dew', 'seaweed', 'sp_beaconember'],
    result: { id: 'h_93', kind: 'potion', grade: 'high', emoji: '☄️', name: '유성',
      desc: '전설로만 전해지는 유성. 특별한 재료가 필요하다.', beauty: 12, charm: 12 } },
  { inputs: ['black_feather', 'bone_frag', 'driftwood', 'petal', 'pine_cone', 'sea_dew', 'sea_glass', 'snow_bud', 'sp_thorncrown', 'starfish'],
    result: { id: 'h_94', kind: 'potion', grade: 'high', emoji: '🔥', name: '불의 심장',
      desc: '전설로만 전해지는 불의 심장. 특별한 재료가 필요하다.', beauty: 13, charm: 13 } },
  { inputs: ['coral', 'crab_claw', 'fern', 'flint', 'mushroom', 'pearl_bit', 'petal', 'sea_dew', 'seaweed', 'sp_gullletter'],
    result: { id: 'h_95', kind: 'potion', grade: 'high', emoji: '♾️', name: '영원',
      desc: '전설로만 전해지는 영원. 특별한 재료가 필요하다.', beauty: 13, charm: 13 } },
  { inputs: ['eagle_feather', 'flint', 'foam', 'frog_egg', 'mirage_shard', 'pearl_bit', 'rust_nail', 'shell', 'sp_miragevial', 'spider_silk', 'tree_resin'],
    result: { id: 'h_96', kind: 'potion', grade: 'high', emoji: '🌄', name: '여명',
      desc: '전설로만 전해지는 여명. 특별한 재료가 필요하다.', beauty: 14, charm: 14 } },
  { inputs: ['cloud_moss', 'crystal', 'driftwood', 'foam', 'lizard_scale', 'petal', 'pine_cone', 'rust_nail', 'sea_glass', 'seaweed', 'sp_rainbowfoam'],
    result: { id: 'h_97', kind: 'potion', grade: 'high', emoji: '🌒', name: '황혼',
      desc: '전설로만 전해지는 황혼. 특별한 재료가 필요하다.', beauty: 14, charm: 14 } },
  { inputs: ['bone_frag', 'crystal', 'foam', 'frog_egg', 'moss_branch', 'pearl_bit', 'pine_cone', 'sand_grain', 'snow_bud', 'sp_goldscale', 'tree_resin'],
    result: { id: 'h_98', kind: 'potion', grade: 'high', emoji: '✨', name: '창조',
      desc: '전설로만 전해지는 창조. 특별한 재료가 필요하다.', beauty: 15, charm: 15 } },
  { inputs: ['cactus', 'coral', 'driftwood', 'dry_root', 'fern', 'moss_branch', 'pine_cone', 'sea_dew', 'sp_mermaidscale', 'starfish', 'tree_resin', 'wild_ivy'],
    result: { id: 'h_99', kind: 'potion', grade: 'high', emoji: '🏆', name: '완성',
      desc: '전설로만 전해지는 완성. 특별한 재료가 필요하다.', beauty: 15, charm: 15 } },
  // ── 밭 물약 6종 (FARM.md 4장) ──
  // **밭이 없으면 못 만든다** — 특수 작물이 하나씩 들어간다. 그것이 밭을 파는 이유다.
  // 여섯의 값(비주얼·아우라)은 **일부러 같다**: 하나가 더 좋으면 모두 그것만 심고
  // 나머지 다섯 작물이 죽은 콘텐츠가 된다. 무엇을 심을지는 **가진 재료**가 정해야 한다.
  // 손으로 고치지 않는다: `npm run gen:farm` (tools/genfarm.js)
  // <<<GEN:farm-recipe
  { inputs: ['dry_root', 'ember_chili', 'flint', 'lizard_scale', 'salt_crust', 'sand_grain'],
    result: { id: 'hf_fire', kind: 'potion', grade: 'high', emoji: '🌋', name: '용암의 숨',
      desc: '밭에서 기른 불꽃 고추 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
  { inputs: ['bone_frag', 'cave_moss', 'echo_stone', 'iron_ore', 'pine_cone', 'stone_potato'],
    result: { id: 'hf_earth', kind: 'potion', grade: 'high', emoji: '🗿', name: '대지의 맹세',
      desc: '밭에서 기른 바위 감자 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
  { inputs: ['cloud_moss', 'eagle_feather', 'mist_drop', 'owl_feather', 'spider_silk', 'whisper_corn'],
    result: { id: 'hf_wind', kind: 'potion', grade: 'high', emoji: '🌬️', name: '바람의 노래',
      desc: '밭에서 기른 속삭임 옥수수 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
  { inputs: ['coral', 'foam', 'pearl_bit', 'sea_dew', 'seaweed', 'tear_lotus'],
    result: { id: 'hf_water', kind: 'potion', grade: 'high', emoji: '🌊', name: '심연의 눈물',
      desc: '밭에서 기른 눈물 연꽃 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
  { inputs: ['crystal', 'dawn_tomato', 'honey', 'sea_glass', 'snow_bud', 'starfish'],
    result: { id: 'hf_light', kind: 'potion', grade: 'high', emoji: '☀️', name: '새벽의 관',
      desc: '밭에서 기른 새벽 토마토 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
  { inputs: ['black_feather', 'frog_egg', 'mushroom', 'night_dew', 'rust_nail', 'shadow_eggplant'],
    result: { id: 'hf_dark', kind: 'potion', grade: 'high', emoji: '🌑', name: '그믐의 장막',
      desc: '밭에서 기른 그림자 가지 없이는 빚을 수 없다.', beauty: 16, charm: 16 } },
// GEN:farm-recipe>>>
  // ── 크리처 30종 ──
  // **손으로 고치지 않는다.** 축 표(tools/gencreature.js)에서 뽑아 넣는다 —
  // 손으로 쓰면 조합 중복이 반드시 섞이고(RECIPE_MAP 이 조용히 덮어쓴다) 영어 이름이 빠진다.
  //   node tools/gencreature.js
  // 그림은 이모지가 아니라 `art` 부품 조합이다 (creature.js 가 SVG 로 그린다).
  // <<<GEN:creature
  // 불 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['sun_seed', 'tree_resin'],
    result: { id: 'ember_newt', kind: 'creature', grade: 'basic', name: '불씨 도롱뇽',
      attr: 'fire', charmBonus: 2, move: 'ground',
      combat: { atk: 6, matk: 4, def: 3, mdef: 3 },
      makes: { id: 'sun_seed', n: 1 },
      art: { body: 'quad', ear: 'none', horn: 'none', wing: 'none', tail: 'long', eye: 'dot', pat: 'spot' } } },
  { inputs: ['spider_silk', 'thistle'],
    result: { id: 'ash_moth', kind: 'creature', grade: 'basic', name: '잿빛 나방',
      attr: 'fire', charmBonus: 2, move: 'air',
      combat: { atk: 6, matk: 4, def: 3, mdef: 3 },
      makes: { id: 'sun_seed', n: 1 },
      art: { body: 'bug', ear: 'tuft', horn: 'none', wing: 'butterfly', tail: 'none', eye: 'dot', pat: 'stripe' } } },
  { inputs: ['berry', 'dry_root', 'flint'],
    result: { id: 'flame_fox', kind: 'creature', grade: 'mid', name: '화염 여우',
      attr: 'fire', charmBonus: 4, move: 'ground',
      combat: { atk: 14, matk: 9, def: 7, mdef: 6 },
      makes: { id: 'sun_seed', n: 2 },
      art: { body: 'quad', ear: 'tuft', horn: 'none', wing: 'none', tail: 'puff', eye: 'sharp', pat: 'none' } } },
  { inputs: ['flint', 'mushroom', 'walnut'],
    result: { id: 'charcoal_toad', kind: 'creature', grade: 'mid', name: '숯불 두꺼비',
      attr: 'fire', charmBonus: 4, move: 'ground',
      combat: { atk: 14, matk: 9, def: 7, mdef: 6 },
      makes: { id: 'sun_seed', n: 2 },
      art: { body: 'blob', ear: 'none', horn: 'none', wing: 'none', tail: 'none', eye: 'sleepy', pat: 'spot' } } },
  { inputs: ['eagle_feather', 'flame_fox', 'flint', 'sun_seed'],
    result: { id: 'ember_phoenix', kind: 'creature', grade: 'high', name: '불꽃 봉황',
      attr: 'fire', charmBonus: 6, move: 'air',
      combat: { atk: 26, matk: 16, def: 13, mdef: 9 },
      makes: { id: 'sun_seed', n: 3 },
      art: { body: 'bird', ear: 'none', horn: 'none', wing: 'bird', tail: 'long', eye: 'sharp', pat: 'glow' } } },
  // 땅 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['clover', 'moss_branch'],
    result: { id: 'pebble_turtle', kind: 'creature', grade: 'basic', name: '조약돌 거북',
      attr: 'earth', charmBonus: 2, move: 'ground',
      combat: { atk: 3, matk: 2, def: 7, mdef: 4 },
      makes: { id: 'walnut', n: 1 },
      art: { body: 'blob', ear: 'none', horn: 'none', wing: 'none', tail: 'none', eye: 'sleepy', pat: 'spot' } } },
  { inputs: ['fern', 'walnut'],
    result: { id: 'root_mole', kind: 'creature', grade: 'basic', name: '뿌리 두더지',
      attr: 'earth', charmBonus: 2, move: 'ground',
      combat: { atk: 3, matk: 2, def: 7, mdef: 4 },
      makes: { id: 'walnut', n: 1 },
      art: { body: 'bear', ear: 'round', horn: 'none', wing: 'none', tail: 'puff', eye: 'dot', pat: 'none' } } },
  { inputs: ['cave_moss', 'herb', 'moss_branch'],
    result: { id: 'moss_deer', kind: 'creature', grade: 'mid', name: '이끼 사슴',
      attr: 'earth', charmBonus: 4, move: 'ground',
      combat: { atk: 7, matk: 5, def: 16, mdef: 8 },
      makes: { id: 'walnut', n: 2 },
      art: { body: 'deer', ear: 'long', horn: 'antler', wing: 'none', tail: 'leaf', eye: 'round', pat: 'spot' } } },
  { inputs: ['crystal', 'echo_stone', 'wild_ivy'],
    result: { id: 'crystal_pangolin', kind: 'creature', grade: 'mid', name: '수정 천산갑',
      attr: 'earth', charmBonus: 4, move: 'ground',
      combat: { atk: 7, matk: 5, def: 16, mdef: 8 },
      makes: { id: 'walnut', n: 2 },
      art: { body: 'bear', ear: 'none', horn: 'crystal', wing: 'none', tail: 'long', eye: 'dot', pat: 'stripe' } } },
  { inputs: ['echo_stone', 'iron_ore', 'moss_deer', 'pine_cone'],
    result: { id: 'boulder_bear', kind: 'creature', grade: 'high', name: '바위 곰',
      attr: 'earth', charmBonus: 6, move: 'ground',
      combat: { atk: 13, matk: 10, def: 29, mdef: 12 },
      makes: { id: 'walnut', n: 3 },
      art: { body: 'bear', ear: 'round', horn: 'none', wing: 'none', tail: 'puff', eye: 'sharp', pat: 'spot' } } },
  // 바람 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['butter_flower', 'clover'],
    result: { id: 'dandelion_hare', kind: 'creature', grade: 'basic', name: '민들레 토끼',
      attr: 'wind', charmBonus: 2, move: 'ground',
      combat: { atk: 5, matk: 5, def: 3, mdef: 3 },
      makes: { id: 'wheat', n: 1 },
      art: { body: 'deer', ear: 'long', horn: 'none', wing: 'none', tail: 'puff', eye: 'round', pat: 'none' } } },
  { inputs: ['owl_feather', 'wheat'],
    result: { id: 'breeze_sparrow', kind: 'creature', grade: 'basic', name: '산들 참새',
      attr: 'wind', charmBonus: 2, move: 'air',
      combat: { atk: 5, matk: 5, def: 3, mdef: 3 },
      makes: { id: 'wheat', n: 1 },
      art: { body: 'bird', ear: 'none', horn: 'none', wing: 'bird', tail: 'none', eye: 'dot', pat: 'none' } } },
  { inputs: ['eagle_feather', 'wheat', 'wild_ivy'],
    result: { id: 'whirl_marten', kind: 'creature', grade: 'mid', name: '회오리 담비',
      attr: 'wind', charmBonus: 4, move: 'ground',
      combat: { atk: 11, matk: 11, def: 7, mdef: 7 },
      makes: { id: 'wheat', n: 2 },
      art: { body: 'quad', ear: 'tuft', horn: 'none', wing: 'none', tail: 'long', eye: 'sharp', pat: 'stripe' } } },
  { inputs: ['cloud_moss', 'clover', 'snow_bud'],
    result: { id: 'cloud_goat', kind: 'creature', grade: 'mid', name: '구름 염소',
      attr: 'wind', charmBonus: 4, move: 'ground',
      combat: { atk: 11, matk: 11, def: 7, mdef: 7 },
      makes: { id: 'wheat', n: 2 },
      art: { body: 'deer', ear: 'long', horn: 'pair', wing: 'none', tail: 'puff', eye: 'sleepy', pat: 'none' } } },
  { inputs: ['cloud_moss', 'eagle_feather', 'sun_seed', 'whirl_marten'],
    result: { id: 'sky_falcon', kind: 'creature', grade: 'high', name: '하늘 매',
      attr: 'wind', charmBonus: 6, move: 'air',
      combat: { atk: 19, matk: 19, def: 13, mdef: 13 },
      makes: { id: 'wheat', n: 3 },
      art: { body: 'bird', ear: 'none', horn: 'none', wing: 'bird', tail: 'long', eye: 'sharp', pat: 'stripe' } } },
  // 물 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['mushroom', 'petal'],
    result: { id: 'frog', kind: 'creature', grade: 'basic', name: '꽃개구리',
      attr: 'water', charmBonus: 2, move: 'ground',
      combat: { atk: 2, matk: 4, def: 3, mdef: 7 },
      makes: { id: 'dew', n: 1 },
      art: { body: 'blob', ear: 'none', horn: 'none', wing: 'none', tail: 'none', eye: 'round', pat: 'spot' } } },
  { inputs: ['dew', 'night_dew'],
    result: { id: 'droplet_otter', kind: 'creature', grade: 'basic', name: '물방울 수달',
      attr: 'water', charmBonus: 2, move: 'ground',
      combat: { atk: 2, matk: 4, def: 3, mdef: 7 },
      makes: { id: 'dew', n: 1 },
      art: { body: 'quad', ear: 'round', horn: 'none', wing: 'none', tail: 'long', eye: 'round', pat: 'none' } } },
  { inputs: ['coral', 'foam', 'seaweed'],
    result: { id: 'coral_seahorse', kind: 'creature', grade: 'mid', name: '산호 해마',
      attr: 'water', charmBonus: 4, move: 'water',
      combat: { atk: 5, matk: 9, def: 7, mdef: 15 },
      makes: { id: 'dew', n: 2 },
      art: { body: 'fish', ear: 'fin', horn: 'none', wing: 'fin', tail: 'fish', eye: 'dot', pat: 'glow' } } },
  { inputs: ['moss_branch', 'night_dew', 'shell'],
    result: { id: 'dew_snail', kind: 'creature', grade: 'mid', name: '이슬 달팽이',
      attr: 'water', charmBonus: 4, move: 'ground',
      combat: { atk: 5, matk: 9, def: 7, mdef: 15 },
      makes: { id: 'dew', n: 2 },
      art: { body: 'blob', ear: 'long', horn: 'none', wing: 'none', tail: 'none', eye: 'sleepy', pat: 'glow' } } },
  { inputs: ['coral_seahorse', 'pearl_bit', 'sea_dew', 'seaweed'],
    result: { id: 'deepsea_whale', kind: 'creature', grade: 'high', name: '심해 고래',
      attr: 'water', charmBonus: 6, move: 'water',
      combat: { atk: 10, matk: 16, def: 13, mdef: 25 },
      makes: { id: 'dew', n: 3 },
      art: { body: 'fish', ear: 'fin', horn: 'none', wing: 'fin', tail: 'fish', eye: 'sleepy', pat: 'glow' } } },
  // 빛 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['crystal', 'dew'],
    result: { id: 'butterfly', kind: 'creature', grade: 'basic', name: '반짝 나비',
      attr: 'light', charmBonus: 2, move: 'air',
      combat: { atk: 2, matk: 7, def: 2, mdef: 5 },
      makes: { id: 'firefly', n: 1 },
      art: { body: 'bug', ear: 'tuft', horn: 'none', wing: 'butterfly', tail: 'none', eye: 'round', pat: 'glow' } } },
  { inputs: ['sun_seed', 'wheat'],
    result: { id: 'sunbeam_hen', kind: 'creature', grade: 'basic', name: '햇살 암탉',
      attr: 'light', charmBonus: 2, move: 'ground',
      combat: { atk: 2, matk: 7, def: 2, mdef: 5 },
      makes: { id: 'firefly', n: 1 },
      art: { body: 'bird', ear: 'none', horn: 'none', wing: 'none', tail: 'puff', eye: 'dot', pat: 'none' } } },
  { inputs: ['butter_flower', 'honey', 'snow_bud'],
    result: { id: 'starlit_fawn', kind: 'creature', grade: 'mid', name: '별무리 사슴',
      attr: 'light', charmBonus: 4, move: 'ground',
      combat: { atk: 5, matk: 16, def: 5, mdef: 10 },
      makes: { id: 'firefly', n: 2 },
      art: { body: 'deer', ear: 'long', horn: 'antler', wing: 'none', tail: 'leaf', eye: 'round', pat: 'glow' } } },
  { inputs: ['honey', 'mist_drop', 'owl_feather'],
    result: { id: 'dawn_owl', kind: 'creature', grade: 'mid', name: '여명 부엉이',
      attr: 'light', charmBonus: 4, move: 'air',
      combat: { atk: 5, matk: 16, def: 5, mdef: 10 },
      makes: { id: 'firefly', n: 2 },
      art: { body: 'bird', ear: 'tuft', horn: 'none', wing: 'bird', tail: 'none', eye: 'round', pat: 'spot' } } },
  { inputs: ['berry', 'crystal', 'mushroom'],
    result: { id: 'unicorn', kind: 'creature', grade: 'high', name: '유니콘',
      attr: 'light', charmBonus: 6, move: 'ground',
      combat: { atk: 10, matk: 29, def: 10, mdef: 15 },
      makes: { id: 'firefly', n: 3 },
      art: { body: 'deer', ear: 'long', horn: 'single', wing: 'none', tail: 'long', eye: 'round', pat: 'glow' } } },
  // 암흑 — 기초 2 · 중급 2 · 상급 1
  { inputs: ['firefly', 'night_dew'],
    result: { id: 'newmoon_bat', kind: 'creature', grade: 'basic', name: '그믐 박쥐',
      attr: 'dark', charmBonus: 2, move: 'air',
      combat: { atk: 4, matk: 6, def: 2, mdef: 4 },
      makes: { id: 'mushroom', n: 1 },
      art: { body: 'bug', ear: 'long', horn: 'none', wing: 'bat', tail: 'none', eye: 'dot', pat: 'none' } } },
  { inputs: ['petal', 'spider_silk'],
    result: { id: 'shadow_cat', kind: 'creature', grade: 'basic', name: '그림자 고양이',
      attr: 'dark', charmBonus: 2, move: 'ground',
      combat: { atk: 4, matk: 6, def: 2, mdef: 4 },
      makes: { id: 'mushroom', n: 1 },
      art: { body: 'quad', ear: 'tuft', horn: 'none', wing: 'none', tail: 'long', eye: 'sharp', pat: 'none' } } },
  { inputs: ['berry', 'mist_drop', 'wild_ivy'],
    result: { id: 'nightmist_fox', kind: 'creature', grade: 'mid', name: '밤안개 여우',
      attr: 'dark', charmBonus: 4, move: 'ground',
      combat: { atk: 9, matk: 14, def: 5, mdef: 8 },
      makes: { id: 'mushroom', n: 2 },
      art: { body: 'quad', ear: 'tuft', horn: 'none', wing: 'none', tail: 'puff', eye: 'sleepy', pat: 'stripe' } } },
  { inputs: ['bone_frag', 'flint', 'lizard_scale'],
    result: { id: 'obsidian_lizard', kind: 'creature', grade: 'mid', name: '흑요석 도마뱀',
      attr: 'dark', charmBonus: 4, move: 'ground',
      combat: { atk: 9, matk: 14, def: 5, mdef: 8 },
      makes: { id: 'mushroom', n: 2 },
      art: { body: 'quad', ear: 'none', horn: 'crystal', wing: 'none', tail: 'long', eye: 'sharp', pat: 'stripe' } } },
  { inputs: ['black_feather', 'bone_frag', 'night_dew', 'nightmist_fox'],
    result: { id: 'abyss_raven', kind: 'creature', grade: 'high', name: '심연 까마귀',
      attr: 'dark', charmBonus: 6, move: 'air',
      combat: { atk: 16, matk: 26, def: 10, mdef: 12 },
      makes: { id: 'mushroom', n: 3 },
      art: { body: 'bird', ear: 'none', horn: 'none', wing: 'bird', tail: 'long', eye: 'sharp', pat: 'glow' } } },
// GEN:creature>>>
];

// ─── 크리처 속성 ───
// 불 ➔ 땅 ➔ 바람 ➔ 물 ➔ 불 (화살표 = 강하다) · 빛 ↔ 암흑 (서로 카운터).
// **순환은 채집에 안 쓴다** — 나중의 전투·약탈용이다 (CREATURE.md 2장).
// 이름은 **글자로 표시한다** (이모지 아님). 크리처 표와 같은 생성기에서 나온다.
// <<<GEN:creature-attrs
const CREATURE_ATTRS = [
  { id: 'attr_fire', k: 'fire', name: '불', color: '#f0743c', beats: 'earth' },
  { id: 'attr_earth', k: 'earth', name: '땅', color: '#b0834e', beats: 'wind' },
  { id: 'attr_wind', k: 'wind', name: '바람', color: '#7cc6bb', beats: 'water' },
  { id: 'attr_water', k: 'water', name: '물', color: '#4f9ada', beats: 'fire' },
  { id: 'attr_light', k: 'light', name: '빛', color: '#e8b545', beats: 'dark' },
  { id: 'attr_dark', k: 'dark', name: '암흑', color: '#6f6191', beats: 'light' },
];
// GEN:creature-attrs>>>
function creatureAttr(k) { return CREATURE_ATTRS.find(a => a.k === k) || null; }

// 채집지의 속성 — **이름의 낱말에서 규칙으로 뽑는다** (tools/genmapattr.js).
// MAPS 배열은 손으로 쓴 것이라 안 건드리고, id → 속성 표만 따로 둔다. 손으로 고치지 않는다:
//   node tools/genmapattr.js
// <<<GEN:mapattr
const MAP_ATTRS = {
  // 포근 평야 지대 — light 2 · earth 5 · water 1 · wind 1 · fire 1 · dark 1
  p_hill: 'light',            // 햇살 언덕
  p_gourmet: 'earth',         // 미식가의 들
  p_mirror: 'water',          // 거울 저수지
  p_walnut: 'earth',          // 호두 마루
  p_windmill: 'wind',         // 바람개비 밭
  p_bee: 'earth',             // 꿀벌 목장
  p_sunset: 'fire',           // 노을 밀밭
  p_clover: 'earth',          // 네잎 들판
  p_picnic: 'earth',          // 소풍 바위
  p_starfield: 'light',       // 별헤는 평지
  p_pumpkin: 'dark',          // 파수꾼의 호박 밭
  // 울창 숲 지대 — dark 3 · earth 3 · water 1 · light 2 · wind 1
  f_mist: 'dark',             // 안개 숲 외곽
  f_path: 'earth',            // 완만한 숲길
  f_mushroom: 'earth',        // 버섯 마을
  f_firefly: 'water',         // 반딧불 늪가
  f_owl: 'dark',              // 부엉이 고목
  f_spider: 'dark',           // 거미줄 다리
  f_spirit: 'light',          // 이끼 정령터
  f_bush: 'wind',             // 속삭이는 덤불
  f_moon: 'light',            // 달빛 공터
  f_door: 'earth',            // 오래된 나무문
  // 뾰족 산악 지대 — earth 2 · water 2 · wind 4 · light 1 · fire 1
  m_mine: 'earth',            // 버려진 광산
  m_lake: 'water',            // 고요 호수
  m_rock: 'earth',            // 흔들 바위산
  m_cloud: 'wind',            // 구름모자 산중턱
  m_eyrie: 'wind',            // 매 둥지 절벽
  m_frost: 'water',           // 서리 골짜기
  m_echo: 'wind',             // 메아리 협곡
  m_ropeway: 'wind',          // 낡은 삭도 터
  m_observe: 'light',         // 별빛 전망대
  m_ash: 'fire',              // 화산재 능선
  // 반짝 해안 지대 — light 2 · dark 2 · water 4 · wind 1 · fire 1
  s_beach: 'light',           // 반짝 모래사장
  s_cave: 'dark',             // 소라 동굴
  s_rock: 'water',            // 파도 바위
  s_light: 'light',           // 등대 언덕
  s_coral: 'water',           // 산호 여울
  s_gull: 'wind',             // 갈매기 절벽
  s_wreck: 'dark',            // 난파선 잔해
  s_foam: 'water',            // 물거품 웅덩이
  s_pier: 'fire',             // 해질녘 방파제
  s_mermaid: 'water',         // 인어의 바위
  // 황량 황무지 — water 1 · earth 2 · fire 3 · dark 3 · light 1
  w_swamp: 'water',           // 청개구리의 늪
  w_dune: 'earth',            // 까끌 모래 언덕
  w_salt: 'fire',             // 소금 평원
  w_cart: 'earth',            // 부서진 수레길
  w_thorn: 'dark',            // 가시덤불 협곡
  w_bone: 'dark',             // 뼈의 골짜기
  w_mirage: 'light',          // 신기루 오아시스
  w_tower: 'fire',            // 녹슨 철탑
  w_lizard: 'fire',           // 도마뱀 바위굴
  w_crow: 'dark',             // 까마귀 언덕
};
// GEN:mapattr>>>
function mapAttr(id) { return MAP_ATTRS[id] || null; }

// ─── 날씨 여섯 ───
//
// **여섯 날씨가 여섯 속성을 하나씩 맡는다.** 하나가 둘을 맡거나 비는 속성이 있으면
// 「내 크리처는 언제 좋은가」를 외워야 한다. 하나씩이면 볼 것이 없다.
//
// ❄️ 가 빛인 이유는 눈밭이 볕을 되쏘기 때문이다. 억지스럽지만, 여섯을 하나씩 맡기려면
// 어딘가는 이렇게 이어야 한다 — 비는 쪽이 생기는 것보다 낫다.
//
// ⚠️ **맵마다 나오는 날씨를 가리지 않는다.** 화산에 눈이 오는 것이 이상하긴 한데,
// 가리기 시작하면 속성마다 「날씨가 맞을 확률」이 달라져서 어떤 크리처는 영영 손해다.
const WEATHERS = [
  { id: 'we_sun',  k: 'sun',  emoji: '☀️',  name: '해가 쨍쨍',     attr: 'fire'  },
  { id: 'we_rain', k: 'rain', emoji: '🌧️', name: '비가 추적추적', attr: 'water' },
  { id: 'we_wind', k: 'wind', emoji: '🌬️', name: '바람 쌩쌩',     attr: 'wind'  },
  { id: 'we_sand', k: 'sand', emoji: '🌪️', name: '모래 폭풍',     attr: 'earth' },
  { id: 'we_fog',  k: 'fog',  emoji: '🌫️', name: '안개 자욱',     attr: 'dark'  },
  { id: 'we_snow', k: 'snow', emoji: '❄️',  name: '눈이 펄펄',     attr: 'light' },
];
// 날씨가 바뀌는 주기. 3시간이면 하루에 여덟 번 — 한 번 앉아서 채집하는 동안은 안 바뀌고,
// 다음에 들어왔을 때는 대개 바뀌어 있다
const WEATHER_HOURS = 3;

// ─── 시간대 넷 ───
//
// **운동의 세 구간(EX_WHEN: 아침 05·낮 11·밤 21) 위에 얹는다.** 경계를 따로 잡으면
// 20시 30분에 「운동은 낮인데 채집은 밤」이 되어 설명이 두 벌이 된다.
// 여기서는 운동의 「낮」을 낮과 해질녘으로 **한 번 더 자를** 뿐이다 —
// 낱말이 하나 늘 뿐 경계는 하나도 안 어긋난다. (CREATURE.md 14장에서 정했다)
//
// 속성은 시간대마다 하나씩 또는 둘씩 붙는다. 넷에 여섯이라 딱 나뉘지 않는데,
// **긴 시간대에 적게 붙인다** — 밤이 여덟 시간으로 제일 길어서 암흑 하나만 맡는다.
const DAYPARTS = [
  { id: 'dp_morning', k: 'morning', emoji: '🌅', name: '아침',   from: 5,  attrs: ['water', 'wind'] },
  { id: 'dp_day',     k: 'day',     emoji: '☀️', name: '낮',     from: 11, attrs: ['fire', 'earth'] },
  { id: 'dp_dusk',    k: 'dusk',    emoji: '🌆', name: '해질녘', from: 17, attrs: ['light'] },
  { id: 'dp_night',   k: 'night',   emoji: '🌙', name: '밤',     from: 21, attrs: ['dark'] },
];

// ─── 히든 재료 등급 ───
//
// 예전에는 51곳이 전부 SPECIAL_RATE(0.1%) 하나였다. **맵의 해금 매력으로 등급을 나눈다** —
// 데이터에 칸을 더하지 않는 이유는 51곳에 손으로 붙이면 새 맵이 늘 때 반드시 빠뜨리기
// 때문이다. 규칙이면 새 맵도 저절로 등급을 받는다.
//
// 초반 맵의 히든이 흔해지는 것은 **일부러 그렇게 한 것**이다. 처음 몇 시간 안에
// 「히든이라는 것이 있구나」를 한 번은 봐야 조건을 맞출 마음이 생긴다.
// ⚠️ specials 기록은 행운 아우라로 간다 — 확률을 올린 만큼 행운이 빨리 쌓인다 (CREATURE.md 5장)
const SPECIAL_TIERS = [
  { need: 300, rate: 0.0005, label: '귀한' },   // 후반
  { need: 100, rate: 0.002,  label: '보통' },   // 중반
  { need: 0,   rate: 0.005,  label: '흔한' },   // 초반
];
function specialTier(unlock) {
  return SPECIAL_TIERS.find(t => (unlock || 0) >= t.need) || SPECIAL_TIERS[SPECIAL_TIERS.length - 1];
}

// ═══════════════════════════════════════════════════════════════
//  밭 — 특수 작물과 칸 (FARM.md)
// ═══════════════════════════════════════════════════════════════
// 작물 표는 **손으로 고치지 않는다**: `npm run gen:farm` (tools/genfarm.js).
// 한국어 이름·이모지는 위의 INGREDIENTS 에, 영어 이름은 i18n.js 에 같은 표에서 나온다.
//
//   cost   심는 값 { 재료id: 개수 } — 그 속성 크리처의 생산물 + 늦게 열리는 지대 재료
//   hours  자라는 데 걸리는 시간 (**임시값**)
//   n      거두는 개수 (**임시값**)
// <<<GEN:farm-crops
const FARM_CROPS = [
  { id: 'ember_chili', attr: 'fire', hours: 12, n: 3,
    cost: { sun_seed: 3, flint: 2 } },
  { id: 'stone_potato', attr: 'earth', hours: 12, n: 3,
    cost: { walnut: 3, echo_stone: 2 } },
  { id: 'whisper_corn', attr: 'wind', hours: 12, n: 3,
    cost: { wheat: 3, eagle_feather: 2 } },
  { id: 'tear_lotus', attr: 'water', hours: 12, n: 3,
    cost: { dew: 3, sea_dew: 2 } },
  { id: 'dawn_tomato', attr: 'light', hours: 12, n: 3,
    cost: { firefly: 3, sea_glass: 2 } },
  { id: 'shadow_eggplant', attr: 'dark', hours: 12, n: 3,
    cost: { mushroom: 3, black_feather: 2 } },
];
// GEN:farm-crops>>>
const farmCrop = id => FARM_CROPS.find(c => c.id === id) || null;

// 칸을 여는 값 (현자의 결정). 번호는 0부터 — 앞의 둘은 처음부터 있다.
// **AP 충전 값과 같이 봐야 한다** (`ENERGY.chargeCost` 1000 · `failReward` 10):
// 다섯 칸을 다 여는 데 700이면 「AP 한 번 안 채우면 칸 하나」쯤이다. 전부 임시값.
const PLOT_COST = [0, 0, 100, 200, 400];

// ═══════════════════════════════════════════════════════════════
//  퀘스트 (QUEST.md) — 1단계 「그릇」
//
//  **이야기를 나르는 그릇이자, 다음 할 일이자, 나중에 비법서 장이 나올 자리다.**
//
//  · `at`  — 여는 조건. **여태 닿은 최고 매력**(`charmPeak`)으로 판정한다.
//            매력이 내려가도 **한 번 열린 퀘스트는 안 닫힌다** (맵·밭과 같은 규칙)
//  · `npc` — 칩에 뜰 얼굴. `SPEAKERS` 의 id 를 가리킨다
//  · `goal`— 목표 하나. 종류는 game.js 의 `questProgress` 참고
//  · `act` — 스토리 다시보기의 묶음 (`STORY.md` 의 3막)
//
//  ⚠️ **`id` 는 세이브에 들어간다.** 옷·크리처 id 와 같은 규칙 — 한 번 나가면 안 바꾼다.
//  이름·설명·대사는 전부 `i18n.js` 에 있다 (`<id>_name` `<id>_desc` `<id>_in` `<id>_out`).
//
//  ⚠️ **보상에 비법서 장이 아직 없다.** 지금은 단계마다 자동으로 주고 있고
//  (`PAGE_TIERS`), 그것을 퀘스트로 옮기는 것은 3단계다 (`QUEST.md` 10장).
//  둘을 같이 두면 이미 가진 장을 또 주게 되어 「받았는데 아무 일도 안 일어난다」가 된다.
// ═══════════════════════════════════════════════════════════════
const QUESTS = [
  { id: 'q_first', npc: 'sp_althea', act: 1, at: 0,
    goal: { kind: 'brew', id: 'vitality', n: 2 },
    reward: { pages: ['potion:low'], crystal: 40, items: { dew: 5 } }, cut: { in: 'c_first_in', out: 'c_first_out' } },
  { id: 'q_walk', npc: 'sp_althea', act: 1, at: 6,
    goal: { kind: 'visit', n: 8 },
    reward: { pages: ['creature:basic'], crystal: 60 }, cut: { in: 'c_walk_in', out: 'c_walk_out' } },
  // 요리사 클레멘 (STORY.md 1순위). **부엌 자체는 퀘스트와 상관없이 열려 있다** —
  // 「혼자 먹은 밤」의 페널티를 피할 길을 선택 콘텐츠 뒤에 숨기면 안 된다
  { id: 'q_kitchen', npc: 'sp_clemen', act: 1, at: 10,
    goal: { kind: 'kitchen', n: 3 },
    reward: { crystal: 70, items: { wheat: 8 } }, cut: { in: 'c_kitchen_in', out: 'c_kitchen_out' } },
  { id: 'q_bring', npc: 'sp_althea', act: 1, at: 14,
    goal: { kind: 'deliver', id: 'herb', n: 10 },
    reward: { pages: ['potion:mid#0'], crystal: 80, items: { berry: 6 } }, cut: { in: 'c_bring_in', out: 'c_bring_out' } },
  { id: 'q_egg', npc: 'sp_althea', act: 1, at: 22,
    goal: { kind: 'creature', n: 1 },
    reward: { pages: ['potion:mid#1'], crystal: 120 }, cut: { in: 'c_egg_in', out: 'c_egg_out' } },
  { id: 'q_soup', npc: 'sp_clemen', act: 1, at: 26,
    goal: { kind: 'deliver', id: 'wheat', n: 12 },
    reward: { crystal: 140, items: { herb: 10 } }, cut: { in: 'c_soup_in', out: 'c_soup_out' } },
  { id: 'q_sip', npc: 'sp_althea', act: 1, at: 32,
    goal: { kind: 'drink', n: 5 },
    reward: { pages: ['creature:mid'], crystal: 150, items: { dew: 8 } }, cut: { in: 'c_sip_in', out: 'c_sip_out' } },
  { id: 'q_bloom', npc: 'sp_althea', act: 1, at: 45,
    goal: { kind: 'charm', n: 60 },
    reward: { pages: ['potion:high', 'creature:high'], crystal: 200 }, cut: { in: 'c_bloom_in', out: 'c_bloom_out' } },
];
function questOf(id) { return QUESTS.find(q => q.id === id) || null; }

// ─── 장이 나오는 두 길 ────────────────────────────────────────
//
// **퀘스트가 먼저, 단계 지급이 그물이다** (`QUEST.md` 6장).
//
// 예전에는 단계마다 서른 장이 툭 들어왔다 — 「요정 대모가 줬다」는 문장 없이.
// 이제 장은 **퀘스트 보상**으로 나오고, 같은 묶음을 단계 지급이 **한 단계 늦게**
// 한 번 더 준다.
//
// ⚠️ **그물을 없애지 않는다.** 퀘스트가 유일한 출구가 되면 하나가 막히는 순간
// 게임이 통째로 멈춘다. 퀘스트를 하면 빠르고, 안 해도 느릴 뿐 못 하게 되진 않는다.
//
// ⚠️ **새싹(0)의 기초 물약 여섯 장은 그대로 자동이다.** 첫 퀘스트가 「생기 물약을
// 만들어라」인데 그 장이 없으면 시작조차 못 한다.
//
// `tools/checkdata.js` 가 둘을 합쳐 **136장이 다 나오는지**와
// **퀘스트가 그물보다 먼저 오는지**를 본다.
const PAGE_TIERS = [
  ['potion:basic'],                             // 새싹 0   — 시작 밑천 (퀘스트 없이 자동)
  ['potion:low'],                               // 꽃봉오리 15 — q_first 의 그물
  ['creature:basic'],                           // 요정 35  — q_walk 의 그물
  ['potion:mid#0', 'potion:mid#1'],             // 뮤즈 60  — q_bring · q_egg 의 그물
  ['creature:mid', 'potion:high', 'creature:high'],   // 여신 100 — q_sip · q_bloom 의 그물
];
// `kind:grade` 또는 `kind:grade#절반`(0=앞, 1=뒤). 절반은 **id 순으로 가른다** —
// 정렬이 정해져 있어야 다시 불러도 같은 장이 같은 단계에 온다
function pagesForSpec(spec) {
  const half = spec.indexOf('#');
  const idx = half >= 0 ? Number(spec.slice(half + 1)) : -1;
  const [kind, grade] = (half >= 0 ? spec.slice(0, half) : spec).split(':');
  const list = RECIPES
    .filter(r => r.result.kind === kind && r.result.grade === grade)
    .map(r => r.result.id).sort();
  if (idx < 0) return list;
  const cut = Math.ceil(list.length / 2);
  return idx === 0 ? list.slice(0, cut) : list.slice(cut);
}


// ─── 컷씬 (QUEST.md 2-2 · 2단계) ─────────────────────────────
//
// **초상화 + 말풍선.** 인트로처럼 손으로 그린 SVG 장면을 퀘스트마다 만들지 않는다 —
// 인트로 한 편에 장면 열넷 × SVG 함수가 들어갔다. 큰 그림은 막이 바뀌는 자리에만 쓴다.
//
// · `lines` 한 줄 = `[인물 id, 표정]`. 대사는 `<컷씬 id>_1` `_2` … 로 i18n 에 있다
// · `act`  — 스토리 다시보기의 묶음 (`STORY.md` 의 3막)
// · 제목은 `<컷씬 id>_title`
//
// ⚠️ **`id` 는 세이브(`S.seenCuts`)에 들어간다.** 한 번 나가면 안 바꾼다.
const CUTS = [
  { id: 'c_first_in',  act: 1, lines: [['sp_althea', 'warm'], ['sp_gwiriel', 'soft'], ['sp_althea', 'wink']] },
  { id: 'c_first_out', act: 1, lines: [['sp_gwiriel', 'smile'], ['sp_althea', 'warm']] },
  { id: 'c_walk_in',   act: 1, lines: [['sp_althea', 'def'], ['sp_gwiriel', 'shock']] },
  { id: 'c_walk_out',  act: 1, lines: [['sp_gwiriel', 'smile'], ['sp_althea', 'wink']] },
  { id: 'c_bring_in',  act: 1, lines: [['sp_althea', 'def'], ['sp_gwiriel', 'soft']] },
  { id: 'c_bring_out', act: 1, lines: [['sp_althea', 'warm'], ['sp_gwiriel', 'smile']] },
  { id: 'c_egg_in',    act: 1, lines: [['sp_althea', 'def'], ['sp_gwiriel', 'shock']] },
  { id: 'c_egg_out',   act: 1, lines: [['sp_gwiriel', 'smile'], ['sp_althea', 'warm']] },
  { id: 'c_sip_in',    act: 1, lines: [['sp_althea', 'scold'], ['sp_gwiriel', 'soft']] },
  { id: 'c_sip_out',   act: 1, lines: [['sp_gwiriel', 'smile'], ['sp_althea', 'warm']] },
  { id: 'c_bloom_in',  act: 1, lines: [['sp_althea', 'warm'], ['sp_gwiriel', 'soft']] },
  { id: 'c_bloom_out', act: 1, lines: [['sp_althea', 'cross'], ['sp_gwiriel', 'smile'], ['sp_althea', 'warm']] },
  // ─ 요리사 클레멘 ─
  // **그는 대가 없이 준다** (STORY.md). 폭식해도 안 깎고 다음 날 아침 아무 말 없이
  // 또 차린다. 그래서 대사에 조건이 없다 — 「먹어요」 뿐이다
  { id: 'c_clemen_meet', act: 1, lines: [['sp_gwiriel', 'shock'], ['sp_clemen', 'def'], ['sp_gwiriel', 'soft'], ['sp_clemen', 'smile']] },
  { id: 'c_kitchen_in',  act: 1, lines: [['sp_clemen', 'def'], ['sp_gwiriel', 'soft']] },
  { id: 'c_kitchen_out', act: 1, lines: [['sp_gwiriel', 'smile'], ['sp_clemen', 'smile']] },
  { id: 'c_soup_in',     act: 1, lines: [['sp_clemen', 'def'], ['sp_gwiriel', 'smile']] },
  { id: 'c_soup_out',    act: 1, lines: [['sp_clemen', 'smile'], ['sp_gwiriel', 'soft'], ['sp_clemen', 'def']] },
];
function cutOf(id) { return CUTS.find(c => c.id === id) || null; }

// ─── 레시피 북 카테고리 ───
// 물약은 등급(grade)으로, 크리처는 kind 로 분류한다.
// 등급 기준: 하급 = 효과 합 3 이하 / 중급 = 4~6 / 상급 = 7 이상
const RECIPE_CATS = [
  { id: 'basic',    label: '기초 물약', match: r => r.result.kind === 'potion' && r.result.grade === 'basic' },
  { id: 'low',      label: '하급 물약', match: r => r.result.kind === 'potion' && r.result.grade === 'low' },
  { id: 'mid',      label: '중급 물약', match: r => r.result.kind === 'potion' && r.result.grade === 'mid' },
  { id: 'high',     label: '상급 물약', match: r => r.result.kind === 'potion' && r.result.grade === 'high' },
  { id: 'creature', label: '크리처',   match: r => r.result.kind === 'creature' },
];

// ─── 실패작 (Sludge) ───
// 알려지지 않은/유효하지 않은 조합의 결과물
// 레시피 북의 아랫단 — 물약이든 크리처든 같은 네 등급을 쓴다
const RECIPE_GRADES = [
  { id: 'basic', label: '기초' },
  { id: 'low',   label: '하급' },
  { id: 'mid',   label: '중급' },
  { id: 'high',  label: '상급' },
];

// ─── 현자의 결정 (연금 실패 보상) ───
// 예전에는 실패하면 '수상한 진흙' 이 나왔다 — 아무 쓸모가 없어서 실패가 순손실이었다.
// 지금은 결정이 남고, 모아서 AP 를 충전한다.
// **아이콘은 임시로 이모지 💎 를 쓴다** (다른 아이콘과 같은 처지 — CLAUDE.md '아직 안 한 것')
// id 가 'crystal' 이 아니라 'sage_crystal' 인 이유: 산에서 캐는 재료 '수정' 이
// 이미 id 'crystal' 을 쓰고 있다. 같은 id 를 쓰면 NAMES 에서 이름이 서로 덮인다.
// 그 재료의 이모지도 💎 였는데, 화폐와 같은 그림이면 헷갈려서 🔹 로 옮겼다.
const CRYSTAL = {
  id: 'sage_crystal', kind: 'crystal', emoji: '💎', name: '현자의 결정',
  desc: '조합은 실패했지만 결정이 남았다. 모으면 AP 를 충전할 수 있다.',
};

// ─── 다이아 상품 ───
// **결제는 아직 붙지 않았다.** 지금은 값만 보여 주고 '지금은 구매하실 수 없습니다' 로 끝난다.
// 결제를 붙일 때 game.js 의 buyDiamond() 안쪽만 채우면 된다.
const SHOP = [
  { n: 1000,   krw: 1000 },
  { n: 10000,  krw: 9000 },
  { n: 100000, krw: 88000 },
];

// ─── 매력 등급 (Charm Tiers) ───
// 매력 총합(비주얼 + 아우라 + 크리처 보너스)에 따른 칭호
const TIERS = [
  { min: 0,   emoji: '🌱', title: '새싹' },
  { min: 15,  emoji: '🌸', title: '꽃봉오리' },
  { min: 35,  emoji: '🧚', title: '요정' },
  { min: 60,  emoji: '👑', title: '뮤즈' },
  { min: 100, emoji: '✨', title: '여신' },
];

// ═══════════════════════════════════════════════════════════════
//  마을 — 탐험의 두 번째 갈래
// ═══════════════════════════════════════════════════════════════
// 탐험은 **필드**(재료를 캐는 곳)와 **마을**(사람을 만나는 곳)로 나뉜다.
// 이름은 백설공주 쪽 이야기에서 따왔다 — 굴뚝 일곱, 독사과, 말하는 거울,
// 차마 베지 못한 사냥꾼, 유리관, 난쟁이 광산, 가시울타리, 여왕의 탑.
//
// **여는 조건은 아직 정해지지 않았다.** 그래서 지금은 전부 잠겨 있고,
// `open` 을 판정하는 자리(game.js 의 isVillageOpen)만 만들어 두었다.
// 조건이 정해지면 여기에 `unlock` 같은 칸을 붙이고 그 함수만 고치면 된다.
//
// `spots` 는 **마을 안에 들어갔을 때 보이는 건물**이다. 누르면 그 자리의 사람과 이야기한다
// (대화는 아직 없다). 자리는 x/y 퍼센트로 두고 **좌우로 번갈아** 놓는다 —
// 좁은 화면에서도 이름표가 서로 부딪히지 않는 배치다.
// shape 는 village.js 가 그 자리에 그릴 건물 모양이다.
const VILLAGES = [
  // **일곱 굴뚝에는 건물이 일곱이고, 일곱 채 모두 굴뚝이 있다.** 이름이 지도에서
  // 그대로 세어진다 — 여기에 건물을 더하거나 굴뚝 없는 건물을 넣으면 이름이 거짓말이 된다
  // (tools/checktalk.js 가 그것을 지킨다). 나머지 두 마을은 넷.
  // **자리는 2열이다.** 한 줄에 하나씩 놓았더니 여덟 채가 세로로 늘어져
  // 한 화면에 안 들어왔다 — 지도를 보려고 스크롤하는 것은 지도가 아니다.
  // 그림 높이는 **줄 수**(=건물 수의 절반)를 따라간다 (village.js 의 hFor)
  { id: 'vl_chimney', emoji: '🏘️', name: '일곱 굴뚝',     desc: '굴뚝 일곱 개가 나란히 선 산속 마을.',
    spots: [
      { id: 'vs_chimney_cottage', emoji: '🏠', name: '일곱 오두막',  shape: 'house', x: 26, y: 15 },
      { id: 'vs_chimney_forge',   emoji: '⚒️', name: '대장간',       shape: 'forge', x: 74, y: 15, npc: 'sp_orix' },
      // 카이로스는 떠도는 사람이라 거처가 없다 — 오늘은 여기 있다
      { id: 'vs_chimney_inn',     emoji: '🛖', name: '여관',         shape: 'house', x: 26, y: 38, npc: 'sp_kairos', trade: false },
      { id: 'vs_chimney_shop',    emoji: '🧺', name: '잡화점',       shape: 'shop',  x: 74, y: 38 },
      { id: 'vs_chimney_mine',    emoji: '⛏️', name: '광산',         shape: 'mine',  x: 26, y: 61 },
      { id: 'vs_chimney_lab',     emoji: '⚗️', name: '연금술 방',    shape: 'lab',   x: 74, y: 61 },
      // 홀수라 마지막 하나는 가운데. trade: false — 거래가 없는 자리.
      // 있는 쪽이 훨씬 많아 **없는 쪽만 적는다**
      { id: 'vs_chimney_tower',   emoji: '🔮', name: '마법사의 탑',  shape: 'tower', x: 50, y: 85, trade: false },
    ] },
  { id: 'vl_apple',   emoji: '🍎', name: '붉은 사과밭',   desc: '한 알만 베어 물어도 잠든다는 과수원.',
    spots: [
      { id: 'vs_apple_orchard', emoji: '🍎', name: '과수원',   shape: 'farm',  x: 26, y: 26 },
      { id: 'vs_apple_press',   emoji: '🍯', name: '착즙간',   shape: 'shop',  x: 74, y: 26 },
      { id: 'vs_apple_empty',   emoji: '🏚️', name: '빈 농가',  shape: 'ruin',  x: 26, y: 70, npc: 'sp_sylvan' },
      { id: 'vs_apple_watch',   emoji: '🔥', name: '감시탑',   shape: 'tower', x: 74, y: 70 },
    ] },
  { id: 'vl_mirror',  emoji: '🪞', name: '거울 골짜기',   desc: '물으면 어김없이 대답이 돌아오는 골짜기.',
    spots: [
      { id: 'vs_mirror_pond',   emoji: '🪞', name: '거울못',    shape: 'water', x: 26, y: 26, npc: 'sp_yutark', trade: false },
      { id: 'vs_mirror_shrine', emoji: '⛩️', name: '낡은 사당', shape: 'ruin',  x: 74, y: 26 },
      { id: 'vs_mirror_bridge', emoji: '🌫️', name: '안개 다리', shape: 'well',  x: 26, y: 70 },
      { id: 'vs_mirror_cairn',  emoji: '🗿', name: '돌무지',    shape: 'tower', x: 74, y: 70 },
    ] },
  { id: 'vl_hunter',  emoji: '🏹', name: '사냥꾼 쉼터',   desc: '차마 베지 못한 사냥꾼이 머무는 오두막.' },
  { id: 'vl_glass',   emoji: '⚰️', name: '유리관 호수',   desc: '물밑에 유리관이 가라앉아 있다는 호숫가.' },
  { id: 'vl_mine',    emoji: '⛏️', name: '은빛 갱도',     desc: '곡괭이 소리가 밤낮으로 울리는 은광촌.' },
  { id: 'vl_thorn',   emoji: '🌹', name: '가시덤불 마을', desc: '가시울타리가 성을 통째로 감싼 마을.' },
  { id: 'vl_spire',   emoji: '🏰', name: '여왕의 첨탑',   desc: '가장 아름다운 이를 묻는 거울이 걸린 탑.' },
];
// 지금 화면에 내보일 마을 수 (임시).
// **여덟 곳을 한꺼번에 잠긴 채로 늘어놓으면 '못 하는 것' 의 목록이 된다.**
// 셋만 보여 두고, 마을이 열리는 규칙이 정해지면 이 수도 그 규칙을 따라간다.
const VILLAGE_SHOWN = 3;
function villagesShown() { return VILLAGES.slice(0, VILLAGE_SHOWN); }

// ═══════════════════════════════════════════════════════════════
//  인물 — 초상화 사양과 대사
// ═══════════════════════════════════════════════════════════════
// **초상화를 한 명씩 그리지 않는다.** portrait.js 가 부품(머리·수염·눈·장식)을 갖고 있고
// 여기서는 **조합만** 준다. 표정을 하나 늘려도 부품 한 곳만 고치면 아홉 명이 같이 바뀐다.
//
// `moods` 는 표정표다. **눈과 입만 바꾼다** — 머리와 옷은 그대로여야 같은 사람으로 보인다.
// 이름·설명은 STORY.md 에 있다.
const SPEAKERS = [
  { id: 'sp_stark', name: '슈타르크', hair: 'short', hairColor: '#4a3a2e', beard: 'stub',
    skin: '#e8c3a3', cloth: '#6b5a44', bg: '#dfe6d8', deco: 'hood', decoColor: '#4f5f42',
    moods: { def: { eye: 'sharp', mouth: 'flat' }, warm: { eye: 'soft', mouth: 'calm' } } },
  { id: 'sp_orix', name: '오릭스', hair: 'short', hairColor: '#b4552e', beard: 'full',
    skin: '#f0cfae', cloth: '#7b6a4a', bg: '#f2e4cf', deco: 'none',
    moods: { def: { eye: 'smile', mouth: 'grin' }, wink: { eye: 'closed', mouth: 'smirk' } } },
  { id: 'sp_valen', name: '발렌', hair: 'short', hairColor: '#e2c473', beard: 'none',
    skin: '#f3d7bd', cloth: '#3f5f9e', bg: '#dde5f4', deco: 'circlet', decoColor: '#ffd76a',
    moods: { def: { eye: 'sharp', mouth: 'smirk' }, soft: { eye: 'normal', mouth: 'calm' } } },
  { id: 'sp_kairos', name: '카이로스', hair: 'wave', hairColor: '#6b4a3a', beard: 'none',
    skin: '#f0d2b6', cloth: '#8a6aa8', bg: '#ece2f4', deco: 'scarf', decoColor: '#c78fb0',
    moods: { def: { eye: 'soft', mouth: 'smile' }, sing: { eye: 'closed', mouth: 'grin' } } },
  { id: 'sp_clemen', name: '클레멘', hair: 'short', hairColor: '#2f2a2c', beard: 'none',
    skin: '#eec9a8', cloth: '#c9b39a', bg: '#f4ead9', deco: 'apron', decoColor: '#f6f1e6',
    moods: { def: { eye: 'soft', mouth: 'calm' }, smile: { eye: 'smile', mouth: 'smile' } } },
  { id: 'sp_yutark', name: '유타르크', hair: 'long', hairColor: '#cfd3de', beard: 'none',
    skin: '#f2e2dc', cloth: '#4a4257', bg: '#d9dde8', deco: 'mirror', decoColor: '#b9c2d4',
    eyeColor: '#7a4a58',
    moods: { def: { eye: 'smile', mouth: 'smirk' }, true: { eye: 'normal', mouth: 'flat' } } },
  // 요정 대모와 공주는 **인트로에 이미 그려져 있다.** `introArt` 가 있으면 초상화도
  // 그 그림에서 머리·어깨만 잘라 쓴다 (portrait.js → Intro.bustArt).
  // 표정마다 `art` 로 인트로의 어느 표정을 쓸지 적는다 — 여기 없는 이름을 적으면
  // 조용히 기본 표정으로 떨어지므로 checktalk 이 그것을 본다.
  // eye/mouth 는 intro.js 가 없을 때를 위한 대비다 (부품 조합으로 떨어진다).
  { id: 'sp_althea', name: '알테이아', hair: 'updo', hairColor: '#eeeaf2', beard: 'none',
    skin: '#ffdcc4', cloth: '#8fc5e8', bg: '#e6edf4', deco: 'hood', decoColor: '#7fb8de',
    introArt: 'fairy',
    moods: { def:   { eye: 'soft',   mouth: 'calm',  art: 'idle' },
             scold: { eye: 'sharp',  mouth: 'flat',  art: 'glance' },
             // 대노 — 「혼자 먹은 밤」을 다섯 번 보고 나면 나온다 (scold 는 미심쩍은 곁눈질이라 약하다)
             cross: { eye: 'sharp',  mouth: 'flat',  art: 'cross' },
             warm:  { eye: 'smile',  mouth: 'smile', art: 'smile' },
             wink:  { eye: 'closed', mouth: 'grin',  art: 'smile' } } },
  // 공주 — 인트로 그림과 같은 갈색 긴 머리 · 연두 드레스
  { id: 'sp_gwiriel', name: '그위리엘', hair: 'long', hairColor: '#7b5640', beard: 'none',
    skin: '#ffdcc4', cloth: '#7fa06a', bg: '#eef1e6', deco: 'none',
    introArt: 'princess',
    moods: { def:   { eye: 'normal', mouth: 'flat', art: 'puzzled' },
             smile: { eye: 'smile',  mouth: 'grin', art: 'smile' },
             soft:  { eye: 'soft',   mouth: 'calm', art: 'shy' },
             shock: { eye: 'normal', mouth: 'grin', art: 'ask' } } },
  { id: 'sp_sylvan', name: '실반', hair: 'wild', hairColor: '#5a4a32', beard: 'full',
    skin: '#e0c09a', cloth: '#6f7f52', bg: '#e2e9d6', deco: 'leaf', decoColor: '#6f9455',
    moods: { def: { eye: 'normal', mouth: 'flat' }, warm: { eye: 'smile', mouth: 'smile' } } },
  { id: 'sp_ygritte', name: '이그리트', hair: 'long', hairColor: '#b8442c', beard: 'none',
    skin: '#f4dcc6', cloth: '#6b2a3c', bg: '#eddad4', deco: 'crown', decoColor: '#e8c463',
    eyeColor: '#2f2a30',
    moods: { def: { eye: 'sharp', mouth: 'flat' }, cold: { eye: 'sharp', mouth: 'smirk' } } },
];
function speaker(id) { return SPEAKERS.find(x => x.id === id) || null; }

// 대사 — 지금은 **인사말 몇 줄**뿐이다. 키워드로 열리는 대화 루트는 아직 없다
// (STORY.md 「키워드 시스템」). 줄 수가 곧 대화 화면의 닷 개수다.
// 문자열은 i18n 의 `tk_*` 키로 건다 — 여기 한국어를 직접 적지 않는다.
// `greet` 는 **그 자리에 들어섰을 때** 건네는 한마디다. 대화(`lines`)와 따로 둔다 —
// 들어설 때마다 대화 첫 줄이 다시 나오면 인사가 아니라 되감기처럼 읽힌다.
//
// `moods` 는 줄마다의 표정이고 **줄 수와 길이가 같아야 한다.**
// 없거나 모자라면 기본 표정(`def`)을 쓴다 — 표정 이름은 SPEAKERS 의 `moods` 에 있는 것만.
// (없는 이름을 적으면 조용히 기본으로 떨어져서 티가 안 난다. checktalk 이 그것을 잡는다)
const TALKS = {
  sp_orix:   { greet: 'tk_orix_greet',   greetMood: 'def',
               lines: ['tk_orix_1', 'tk_orix_2', 'tk_orix_3'], moods: ['def', 'def', 'wink'] },
  sp_kairos: { greet: 'tk_kairos_greet', greetMood: 'def',
               lines: ['tk_kairos_1', 'tk_kairos_2'],          moods: ['def', 'sing'] },
  sp_sylvan: { greet: 'tk_sylvan_greet', greetMood: 'def',
               lines: ['tk_sylvan_1', 'tk_sylvan_2'],          moods: ['def', 'warm'] },
  sp_yutark: { greet: 'tk_yutark_greet', greetMood: 'def',
               lines: ['tk_yutark_1', 'tk_yutark_2', 'tk_yutark_3'], moods: ['def', 'true', 'def'] },
};

// ═══════════════════════════════════════════════════════════════
//  키워드 — 한 사람에게 들은 것을 다른 사람에게 가져간다 (STORY.md 「키워드 시스템」)
// ═══════════════════════════════════════════════════════════════
// **이 시스템 자체가 주제다.** 말 그대로 사람과 사람을 «잇는» 것이 조작이 된다.
// 그래서 개념 키워드(「아름다움」)를 여럿에게 들고 다니는 행위가 곧 답을 찾는 과정이다.
//
// ⚠️ **이름이 `TALKS` 가 아니라 `ASKS` 다.** STORY.md 의 예시는 `TALKS` 로 적혀 있는데
// 그 이름은 위의 인사말·대사 표가 이미 쓰고 있다. 전역이 하나뿐인 프로젝트라
// (모듈 없음 — CLAUDE.md 「전역 이름」) 같은 이름을 두 번 쓸 수가 없다.
//
// `kind` 는 STORY.md 의 세 종류다 — 인물 / 사물·사건 / **개념**.
// 개념은 여럿이 같은 질문에 **다르게** 답하는 것이라 아껴 쓴다 (지금은 「아름다움」 하나).
const KEYWORDS = [
  { id: 'kw_hunger', kind: 'idea',  name: '정신적 허기' },
  { id: 'kw_beauty', kind: 'idea',  name: '아름다움' },
  { id: 'kw_gem',    kind: 'thing', name: '광석' },
  { id: 'kw_song',   kind: 'thing', name: '노래' },
  { id: 'kw_apple',  kind: 'thing', name: '독사과' },
  { id: 'kw_curse',  kind: 'thing', name: '저주' },
  { id: 'kw_queen',  kind: 'who',   name: '여왕' },
  { id: 'kw_mother', kind: 'who',   name: '엄마' },
];
function keyword(id) { return KEYWORDS.find(x => x.id === id) || null; }

// 「누구에게 무엇을 물으면 무슨 말이 돌아오는가」의 표.
//
//   npc   — 물어볼 사람 (SPEAKERS 의 id)
//   kw    — 물어볼 것 (KEYWORDS 의 id). **가진 키워드만 화면에 뜬다**
//   line  — 돌아오는 말 (i18n 의 `ak_*`)
//   mood  — 그때의 표정 (SPEAKERS 의 moods 에 있는 것만)
//   gives — 이 대답이 주는 새 키워드 (선택)
//   opens — 이 대답이 여는 마을 (선택)
//
// **마을은 키워드로 연다** (STORY.md 「마을 해금」). 점수는 시간이 해결해 주지만
// 키워드는 「누굴 만났느냐」라서 열렸을 때 「내가 열었다」가 남는다.
// **두 번 잠그지 않는다** — 여기에 점수 조건을 또 걸지 않는다.
//
// ⚠️ **이 표는 손으로 쓰면 반드시 막힌다.** `tools/checktalk.js` 가 도달 불가능한
// 키워드 · 죽은 키워드 · 순환 · **막다른 진행**(가진 것으로 아무 마을도 못 여는 상태)을
// 본다. 진행이 막히는 버그는 화면에 아무 오류도 안 띄우고, 플레이어는 그냥 그만둔다.
//
// 한 사람이 동시에 반응하는 키워드는 **3~5개**로 유지한다 (checktalk 이 센다).
// 전부 늘어놓으면 나중에 백 개가 되고, 반응 없는 걸 골라 헛걸음하는 재미는
// 코지 게임에 안 맞는다.
const ASKS = [
  // 🍳 클레멘 — **부엌은 늘 닿는다.** 마을이 전부 잠겨 있어도 여기서 이야기가 시작된다
  { npc: 'sp_clemen', kw: 'kw_hunger', line: 'ak_clemen_hunger', mood: 'def',
    gives: ['kw_beauty'], opens: ['vl_chimney'] },
  { npc: 'sp_clemen', kw: 'kw_beauty', line: 'ak_clemen_beauty', mood: 'smile' },
  { npc: 'sp_clemen', kw: 'kw_queen',  line: 'ak_clemen_queen',  mood: 'def', gives: ['kw_mother'] },
  { npc: 'sp_clemen', kw: 'kw_mother', line: 'ak_clemen_mother', mood: 'smile' },
  // ⛏️ 오릭스 — **키워드를 가장 많이 주는 사람** (STORY.md). 말 많은 인물이 하나 필요하다
  { npc: 'sp_orix', kw: 'kw_beauty', line: 'ak_orix_beauty', mood: 'wink', gives: ['kw_gem'] },
  { npc: 'sp_orix', kw: 'kw_gem',    line: 'ak_orix_gem',    mood: 'def',  gives: ['kw_queen'] },
  { npc: 'sp_orix', kw: 'kw_queen',  line: 'ak_orix_queen',  mood: 'def',  gives: ['kw_song'] },
  // 🎻 카이로스 — 떠돌이라 거처가 없다. 오늘은 일곱 굴뚝의 여관에 있다
  { npc: 'sp_kairos', kw: 'kw_song',   line: 'ak_kairos_song',   mood: 'sing', gives: ['kw_apple'] },
  { npc: 'sp_kairos', kw: 'kw_beauty', line: 'ak_kairos_beauty', mood: 'sing' },
  { npc: 'sp_kairos', kw: 'kw_apple',  line: 'ak_kairos_apple',  mood: 'def',  opens: ['vl_apple'] },
  // 🌱 실반 — 과수원을 빼앗긴 사람. **개념 키워드에는 답하지 않는다**
  // (「아름다움」에 답하는 것은 남자 NPC 여섯이고 그는 그 여섯이 아니다 — STORY.md)
  { npc: 'sp_sylvan', kw: 'kw_apple',  line: 'ak_sylvan_apple',  mood: 'def',  gives: ['kw_curse'] },
  { npc: 'sp_sylvan', kw: 'kw_curse',  line: 'ak_sylvan_curse',  mood: 'def',  opens: ['vl_mirror'] },
  { npc: 'sp_sylvan', kw: 'kw_mother', line: 'ak_sylvan_mother', mood: 'warm' },
  // 🪞 유타르크 — **답을 피한다.** 「아름다움」에 답하는 것은 최후의 순간 딱 한 번이고,
  // 「저주」에는 정말로 모른다고 한다 — **거짓말이 아니다** (STORY.md 「대표 사례」)
  { npc: 'sp_yutark', kw: 'kw_beauty', line: 'ak_yutark_beauty', mood: 'def' },
  { npc: 'sp_yutark', kw: 'kw_curse',  line: 'ak_yutark_curse',  mood: 'true' },
  { npc: 'sp_yutark', kw: 'kw_queen',  line: 'ak_yutark_queen',  mood: 'def' },
  { npc: 'sp_yutark', kw: 'kw_mother', line: 'ak_yutark_mother', mood: 'true' },
];
function asksOf(npc) { return ASKS.filter(a => a.npc === npc); }

// 지대의 해금 점수 = 그 지대에서 가장 먼저 열리는 맵의 점수
function zoneUnlock(zoneId) {
  return MAPS.filter(m => m.zone === zoneId).reduce((min, m) => Math.min(min, m.unlock), Infinity);
}

function getTier(total) {
  let t = TIERS[0];
  for (const tier of TIERS) if (total >= tier.min) t = tier;
  return t;
}

// ═══════════════════════════════════════════════════════════════
//  리그 (주간 랭킹) — 듀오링고식 승급/강등 사다리
// ═══════════════════════════════════════════════════════════════
// 32개 리그를 손으로 쓰지 않는다. **계열 8 × 단계 4** 로 곱한다.
// 이름도 여기서 조합한다 — 리그마다 번역을 따로 두지 않고 `계열 이름 + 단계 숫자` 로
// 만들기 때문에, 번역이 필요한 것은 **계열 이름 8개뿐**이다.
// (32개를 다 등록하면 한쪽 언어만 빠지는 일이 반드시 생긴다 — CLAUDE.md 2번)
//
// 계열 순서가 곧 사다리 순서다. 흙 Ⅰ(맨 아래) → 별빛 Ⅳ(맨 위).
const LEAGUE_FAMS = [
  { id: 'lgf_clay',    name: '흙',   emoji: '🟤', color: '#a98a6a' },
  { id: 'lgf_iron',    name: '무쇠', emoji: '⚙️', color: '#7f858e' },
  { id: 'lgf_copper',  name: '구리', emoji: '🥉', color: '#c4834f' },
  { id: 'lgf_silver',  name: '은',   emoji: '🥈', color: '#9aa3b2' },
  { id: 'lgf_gold',    name: '황금', emoji: '🥇', color: '#c9a24a' },
  { id: 'lgf_crystal', name: '수정', emoji: '💎', color: '#5fa8bd' },
  { id: 'lgf_moon',    name: '달빛', emoji: '🌙', color: '#8a76c4' },
  { id: 'lgf_star',    name: '별빛', emoji: '⭐', color: '#d4a537' },
];
const LEAGUE_STEPS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'];

// 리그 규칙. **승급 3 + 잔류 5 + 강등 4 = 조 인원 12** 가 맞아야 한다 —
// 어긋나면 아무 데도 속하지 않는 순위가 생긴다.
const LEAGUE = {
  size: 12,      // 한 조 인원 (나 + NPC 11)
  up: 3,         // 1~3위 승급
  down: 4,       // 9~12위 강등
  openAt: 100,   // 이 매력 총합(= '여신' 단계)부터 랭킹 탭이 열린다
};

// 리그 사다리 — 계열 × 단계를 곱해 만든다. index 0 이 맨 아래다
const LEAGUES = LEAGUE_FAMS.flatMap((fam, fi) =>
  LEAGUE_STEPS.map((step, si) => ({
    index: fi * LEAGUE_STEPS.length + si,
    fam, step,
    top: fi === LEAGUE_FAMS.length - 1 && si === LEAGUE_STEPS.length - 1,
  })));

function league(i) {
  return LEAGUES[Math.max(0, Math.min(LEAGUES.length - 1, i | 0))];
}

// ─── NPC 연금술사 이름 ───────────────────────────────────────
// 96개 이름을 쓰지 않고 **앞말 12 × 뒷말 8** 로 곱한다 (리그와 같은 방식).
// 번역이 필요한 것은 낱말 20개뿐이다.
const NPC_HEAD = [
  { id: 'npc_star', name: '별' },   { id: 'npc_moon', name: '달' },
  { id: 'npc_dew',  name: '이슬' }, { id: 'npc_bloom', name: '꽃' },
  { id: 'npc_frost', name: '서리' }, { id: 'npc_mist', name: '안개' },
  { id: 'npc_dusk', name: '노을' }, { id: 'npc_dawn', name: '새벽' },
  { id: 'npc_wind', name: '바람' }, { id: 'npc_wave', name: '물결' },
  { id: 'npc_ember', name: '잉걸' }, { id: 'npc_ash', name: '재' },
];
const NPC_TAIL = [
  { id: 'npc_leaf', name: '잎' },   { id: 'npc_drop', name: '방울' },
  { id: 'npc_dust', name: '가루' }, { id: 'npc_shard', name: '조각' },
  { id: 'npc_seed', name: '씨' },   { id: 'npc_plume', name: '깃' },
  { id: 'npc_thread', name: '실' }, { id: 'npc_grain', name: '알' },
];

// ─── 옷장 (Wardrobe) ───
// 아바타 장비 카탈로그. 슬롯별 목록의 첫 항목은 항상 '없음'(kind:'none').
// 옷: 상의(top)/하의(bottom)는 따로 착용, 원피스(dress)는 상하 일체.
//     원피스 착용 시 상·하의는 렌더링에서 무시됨.
// 악세사리: 서클렛(circlet)/귀걸이(earring)/목걸이(necklace) — 추후 슬롯 추가 가능.
const WARDROBE = {
  // ── 커스터마이징 (잠금/해금 대상) ──
  // starter: true → 처음부터 보유 / (없으면 잠김 → 플레이하며 획득)
  // ── 커스터마이징 (잠금/해금 대상) ──
  // starter: true → 처음부터 보유 / (없으면 잠김 → 플레이하며 획득)
  //
  // **아래 여섯 칸(헤어·서클렛·귀걸이·목걸이·장갑·구두)은 손으로 고치지 않는다.**
  // 축 표(tools/genwardrobe.js)에서 뽑아 넣는다 — 손으로 쓰면 중복 id·중복 조합이
  // 반드시 섞이고, 영어 이름 한쪽만 빠진다. 고치려면 축 표를 고치고 다시 돌린다:
  //   node tools/genwardrobe.js
  // <<<GEN:wardrobe
  // hair — 6 × 5 = 30
  hair: [
    { id: 'hair_long', slot: 'hair', kind: 'long', name: '긴 생머리', back: 'long', bang: 'straight', color: '#7b5640', starter: true },
    { id: 'hair_long_side', slot: 'hair', kind: 'long', name: '긴 생머리 사이드뱅', back: 'long', bang: 'side', color: '#7b5640' },
    { id: 'hair_long_curtain', slot: 'hair', kind: 'long', name: '긴 생머리 커튼뱅', back: 'long', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_long_sheer', slot: 'hair', kind: 'long', name: '긴 생머리 시스루뱅', back: 'long', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_long_none', slot: 'hair', kind: 'long', name: '긴 생머리 올 백', back: 'long', bang: 'none', color: '#7b5640' },
    { id: 'hair_bob', slot: 'hair', kind: 'bob', name: '단발', back: 'bob', bang: 'straight', color: '#7b5640', starter: true },
    { id: 'hair_bob_side', slot: 'hair', kind: 'bob', name: '단발 사이드뱅', back: 'bob', bang: 'side', color: '#7b5640' },
    { id: 'hair_bob_curtain', slot: 'hair', kind: 'bob', name: '단발 커튼뱅', back: 'bob', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_bob_sheer', slot: 'hair', kind: 'bob', name: '단발 시스루뱅', back: 'bob', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_bob_none', slot: 'hair', kind: 'bob', name: '단발 올 백', back: 'bob', bang: 'none', color: '#7b5640' },
    { id: 'hair_twin', slot: 'hair', kind: 'twin', name: '양갈래', back: 'twin', bang: 'straight', color: '#7b5640', starter: true },
    { id: 'hair_twin_side', slot: 'hair', kind: 'twin', name: '양갈래 사이드뱅', back: 'twin', bang: 'side', color: '#7b5640' },
    { id: 'hair_twin_curtain', slot: 'hair', kind: 'twin', name: '양갈래 커튼뱅', back: 'twin', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_twin_sheer', slot: 'hair', kind: 'twin', name: '양갈래 시스루뱅', back: 'twin', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_twin_none', slot: 'hair', kind: 'twin', name: '양갈래 올 백', back: 'twin', bang: 'none', color: '#7b5640' },
    { id: 'hair_ponytail', slot: 'hair', kind: 'ponytail', name: '포니테일', back: 'ponytail', bang: 'straight', color: '#7b5640' },
    { id: 'hair_ponytail_side', slot: 'hair', kind: 'ponytail', name: '포니테일 사이드뱅', back: 'ponytail', bang: 'side', color: '#7b5640' },
    { id: 'hair_ponytail_curtain', slot: 'hair', kind: 'ponytail', name: '포니테일 커튼뱅', back: 'ponytail', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_ponytail_sheer', slot: 'hair', kind: 'ponytail', name: '포니테일 시스루뱅', back: 'ponytail', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_ponytail_none', slot: 'hair', kind: 'ponytail', name: '포니테일 올 백', back: 'ponytail', bang: 'none', color: '#7b5640' },
    { id: 'hair_wave_straight', slot: 'hair', kind: 'wave', name: '웨이브', back: 'wave', bang: 'straight', color: '#7b5640' },
    { id: 'hair_wave', slot: 'hair', kind: 'wave', name: '웨이브 사이드뱅', back: 'wave', bang: 'side', color: '#7b5640' },
    { id: 'hair_wave_curtain', slot: 'hair', kind: 'wave', name: '웨이브 커튼뱅', back: 'wave', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_wave_sheer', slot: 'hair', kind: 'wave', name: '웨이브 시스루뱅', back: 'wave', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_wave_none', slot: 'hair', kind: 'wave', name: '웨이브 올 백', back: 'wave', bang: 'none', color: '#7b5640' },
    { id: 'hair_bun_straight', slot: 'hair', kind: 'bun', name: '올림머리', back: 'bun', bang: 'straight', color: '#7b5640' },
    { id: 'hair_bun_side', slot: 'hair', kind: 'bun', name: '올림머리 사이드뱅', back: 'bun', bang: 'side', color: '#7b5640' },
    { id: 'hair_bun_curtain', slot: 'hair', kind: 'bun', name: '올림머리 커튼뱅', back: 'bun', bang: 'curtain', color: '#7b5640' },
    { id: 'hair_bun_sheer', slot: 'hair', kind: 'bun', name: '올림머리 시스루뱅', back: 'bun', bang: 'sheer', color: '#7b5640' },
    { id: 'hair_bun_none', slot: 'hair', kind: 'bun', name: '올림머리 올 백', back: 'bun', bang: 'none', color: '#7b5640' },
  ],
  // circlet — 4 × 5 = 20
  circlet: [
    { id: 'circlet_none', slot: 'circlet', kind: 'none', name: '없음' },
    { id: 'circlet_arch_none', slot: 'circlet', kind: 'arch', name: '아치', band: 'arch', orn: 'none', color: '#ffd76a', emoji: '👑' },
    { id: 'circlet_arch_gem', slot: 'circlet', kind: 'arch', name: '아치 보석', band: 'arch', orn: 'gem', color: '#ffe08a', emoji: '💎' },
    { id: 'circlet_flower', slot: 'circlet', kind: 'arch', name: '아치 꽃', band: 'arch', orn: 'flower', color: '#ff9ec4', emoji: '🌸' },
    { id: 'circlet_arch_star', slot: 'circlet', kind: 'arch', name: '아치 별', band: 'arch', orn: 'star', color: '#ffd0a0', emoji: '⭐' },
    { id: 'circlet_band', slot: 'circlet', kind: 'arch', name: '아치 리본', band: 'arch', orn: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'circlet_wide_none', slot: 'circlet', kind: 'wide', name: '밴드', band: 'wide', orn: 'none', color: '#ffd76a', emoji: '👑' },
    { id: 'circlet_wide_gem', slot: 'circlet', kind: 'wide', name: '밴드 보석', band: 'wide', orn: 'gem', color: '#ffe08a', emoji: '💎' },
    { id: 'circlet_wide_flower', slot: 'circlet', kind: 'wide', name: '밴드 꽃', band: 'wide', orn: 'flower', color: '#ff9ec4', emoji: '🌸' },
    { id: 'circlet_wide_star', slot: 'circlet', kind: 'wide', name: '밴드 별', band: 'wide', orn: 'star', color: '#ffd0a0', emoji: '⭐' },
    { id: 'circlet_wide_ribbon', slot: 'circlet', kind: 'wide', name: '밴드 리본', band: 'wide', orn: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'circlet_chain_none', slot: 'circlet', kind: 'chain', name: '체인', band: 'chain', orn: 'none', color: '#ffd76a', emoji: '👑' },
    { id: 'circlet_chain_gem', slot: 'circlet', kind: 'chain', name: '체인 보석', band: 'chain', orn: 'gem', color: '#ffe08a', emoji: '💎' },
    { id: 'circlet_chain_flower', slot: 'circlet', kind: 'chain', name: '체인 꽃', band: 'chain', orn: 'flower', color: '#ff9ec4', emoji: '🌸' },
    { id: 'circlet_chain_star', slot: 'circlet', kind: 'chain', name: '체인 별', band: 'chain', orn: 'star', color: '#ffd0a0', emoji: '⭐' },
    { id: 'circlet_chain_ribbon', slot: 'circlet', kind: 'chain', name: '체인 리본', band: 'chain', orn: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'circlet_crown_none', slot: 'circlet', kind: 'crown', name: '왕관', band: 'crown', orn: 'none', color: '#ffd76a', emoji: '👑' },
    { id: 'circlet_tiara', slot: 'circlet', kind: 'crown', name: '티아라', band: 'crown', orn: 'gem', color: '#ffe08a', emoji: '💎' },
    { id: 'circlet_crown_flower', slot: 'circlet', kind: 'crown', name: '왕관 꽃', band: 'crown', orn: 'flower', color: '#ff9ec4', emoji: '🌸' },
    { id: 'circlet_crown_star', slot: 'circlet', kind: 'crown', name: '왕관 별', band: 'crown', orn: 'star', color: '#ffd0a0', emoji: '⭐' },
    { id: 'circlet_crown_ribbon', slot: 'circlet', kind: 'crown', name: '왕관 리본', band: 'crown', orn: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
  ],
  // earring — 6 × 5 = 30
  earring: [
    { id: 'earring_none', slot: 'earring', kind: 'none', name: '없음' },
    { id: 'earring_stud_circle', slot: 'earring', kind: 'stud', name: '스터드', form: 'stud', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_stud_drop', slot: 'earring', kind: 'stud', name: '스터드 물방울', form: 'stud', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_star', slot: 'earring', kind: 'stud', name: '스터드 별', form: 'stud', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_stud_heart', slot: 'earring', kind: 'stud', name: '스터드 하트', form: 'stud', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_stud_flower', slot: 'earring', kind: 'stud', name: '스터드 꽃', form: 'stud', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
    { id: 'earring_drop_circle', slot: 'earring', kind: 'drop', name: '드롭', form: 'drop', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_drop', slot: 'earring', kind: 'drop', name: '드롭 물방울', form: 'drop', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_drop_star', slot: 'earring', kind: 'drop', name: '드롭 별', form: 'drop', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_drop_heart', slot: 'earring', kind: 'drop', name: '드롭 하트', form: 'drop', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_drop_flower', slot: 'earring', kind: 'drop', name: '드롭 꽃', form: 'drop', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
    { id: 'earring_hoop', slot: 'earring', kind: 'hoop', name: '링', form: 'hoop', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_hoop_drop', slot: 'earring', kind: 'hoop', name: '링 물방울', form: 'hoop', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_hoop_star', slot: 'earring', kind: 'hoop', name: '링 별', form: 'hoop', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_hoop_heart', slot: 'earring', kind: 'hoop', name: '링 하트', form: 'hoop', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_hoop_flower', slot: 'earring', kind: 'hoop', name: '링 꽃', form: 'hoop', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
    { id: 'earring_chain_circle', slot: 'earring', kind: 'chain', name: '체인', form: 'chain', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_chain_drop', slot: 'earring', kind: 'chain', name: '체인 물방울', form: 'chain', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_chain_star', slot: 'earring', kind: 'chain', name: '체인 별', form: 'chain', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_chain_heart', slot: 'earring', kind: 'chain', name: '체인 하트', form: 'chain', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_chain_flower', slot: 'earring', kind: 'chain', name: '체인 꽃', form: 'chain', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
    { id: 'earring_cluster_circle', slot: 'earring', kind: 'cluster', name: '뭉치', form: 'cluster', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_cluster_drop', slot: 'earring', kind: 'cluster', name: '뭉치 물방울', form: 'cluster', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_cluster_star', slot: 'earring', kind: 'cluster', name: '뭉치 별', form: 'cluster', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_cluster_heart', slot: 'earring', kind: 'cluster', name: '뭉치 하트', form: 'cluster', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_cluster_flower', slot: 'earring', kind: 'cluster', name: '뭉치 꽃', form: 'cluster', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
    { id: 'earring_cuff_circle', slot: 'earring', kind: 'cuff', name: '이어커프', form: 'cuff', charm: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_cuff_drop', slot: 'earring', kind: 'cuff', name: '이어커프 물방울', form: 'cuff', charm: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_cuff_star', slot: 'earring', kind: 'cuff', name: '이어커프 별', form: 'cuff', charm: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'earring_cuff_heart', slot: 'earring', kind: 'cuff', name: '이어커프 하트', form: 'cuff', charm: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'earring_cuff_flower', slot: 'earring', kind: 'cuff', name: '이어커프 꽃', form: 'cuff', charm: 'flower', color: '#ffb8d9', emoji: '🌸' },
  ],
  // necklace — 6 × 5 = 30
  necklace: [
    { id: 'necklace_none', slot: 'necklace', kind: 'none', name: '없음' },
    { id: 'necklace_choker', slot: 'necklace', kind: 'choker', name: '초커', chain: 'choker', pend: 'none', color: '#ff9ec4', emoji: '🎀' },
    { id: 'necklace_choker_circle', slot: 'necklace', kind: 'choker', name: '초커 원형', chain: 'choker', pend: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'necklace_choker_drop', slot: 'necklace', kind: 'choker', name: '초커 물방울', chain: 'choker', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_choker_star', slot: 'necklace', kind: 'choker', name: '초커 별', chain: 'choker', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_choker_heart', slot: 'necklace', kind: 'choker', name: '초커 하트', chain: 'choker', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'necklace_short_none', slot: 'necklace', kind: 'short', name: '숏체인', chain: 'short', pend: 'none', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_pendant', slot: 'necklace', kind: 'short', name: '숏체인 원형', chain: 'short', pend: 'circle', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_short_drop', slot: 'necklace', kind: 'short', name: '숏체인 물방울', chain: 'short', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_short_star', slot: 'necklace', kind: 'short', name: '숏체인 별', chain: 'short', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_short_heart', slot: 'necklace', kind: 'short', name: '숏체인 하트', chain: 'short', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'necklace_long_none', slot: 'necklace', kind: 'long', name: '롱체인', chain: 'long', pend: 'none', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_long_circle', slot: 'necklace', kind: 'long', name: '롱체인 원형', chain: 'long', pend: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'necklace_long_drop', slot: 'necklace', kind: 'long', name: '롱체인 물방울', chain: 'long', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_long_star', slot: 'necklace', kind: 'long', name: '롱체인 별', chain: 'long', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_long_heart', slot: 'necklace', kind: 'long', name: '롱체인 하트', chain: 'long', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'necklace_pearl', slot: 'necklace', kind: 'pearl', name: '진주', chain: 'pearl', pend: 'none', color: '#ffffff', emoji: '🤍' },
    { id: 'necklace_pearl_circle', slot: 'necklace', kind: 'pearl', name: '진주 원형', chain: 'pearl', pend: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'necklace_pearl_drop', slot: 'necklace', kind: 'pearl', name: '진주 물방울', chain: 'pearl', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_pearl_star', slot: 'necklace', kind: 'pearl', name: '진주 별', chain: 'pearl', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_pearl_heart', slot: 'necklace', kind: 'pearl', name: '진주 하트', chain: 'pearl', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'necklace_double_none', slot: 'necklace', kind: 'double', name: '더블체인', chain: 'double', pend: 'none', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_double_circle', slot: 'necklace', kind: 'double', name: '더블체인 원형', chain: 'double', pend: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'necklace_double_drop', slot: 'necklace', kind: 'double', name: '더블체인 물방울', chain: 'double', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_double_star', slot: 'necklace', kind: 'double', name: '더블체인 별', chain: 'double', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_double_heart', slot: 'necklace', kind: 'double', name: '더블체인 하트', chain: 'double', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
    { id: 'necklace_ribbon_none', slot: 'necklace', kind: 'ribbon', name: '리본끈', chain: 'ribbon', pend: 'none', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_ribbon_circle', slot: 'necklace', kind: 'ribbon', name: '리본끈 원형', chain: 'ribbon', pend: 'circle', color: '#ffd76a', emoji: '⭕' },
    { id: 'necklace_ribbon_drop', slot: 'necklace', kind: 'ribbon', name: '리본끈 물방울', chain: 'ribbon', pend: 'drop', color: '#8ad0ff', emoji: '💧' },
    { id: 'necklace_ribbon_star', slot: 'necklace', kind: 'ribbon', name: '리본끈 별', chain: 'ribbon', pend: 'star', color: '#ffe08a', emoji: '⭐' },
    { id: 'necklace_ribbon_heart', slot: 'necklace', kind: 'ribbon', name: '리본끈 하트', chain: 'ribbon', pend: 'heart', color: '#ff9eb0', emoji: '❤️' },
  ],
  // glove — 4 × 5 = 20
  glove: [
    { id: 'glove_none', slot: 'glove', kind: 'none', name: '없음' },
    { id: 'glove_knit', slot: 'glove', kind: 'wrist', name: '손목', len: 0.22, finish: 'plain', color: '#f2ddc2', emoji: '🧤' },
    { id: 'glove_wrist_cuff', slot: 'glove', kind: 'wrist', name: '손목 커프', len: 0.22, finish: 'cuff', color: '#ffb3d1', emoji: '⭕' },
    { id: 'glove_lace', slot: 'glove', kind: 'wrist', name: '손목 프릴', len: 0.22, finish: 'frill', color: '#fff4fa', emoji: '🤍' },
    { id: 'glove_wrist_ribbon', slot: 'glove', kind: 'wrist', name: '손목 리본', len: 0.22, finish: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'glove_leather', slot: 'glove', kind: 'wrist', name: '손목 스트랩', len: 0.22, finish: 'strap', color: '#8a5a3c', emoji: '🧵' },
    { id: 'glove_forearm_plain', slot: 'glove', kind: 'forearm', name: '팔뚝', len: 0.38, finish: 'plain', color: '#f2ddc2', emoji: '🧤' },
    { id: 'glove_satin', slot: 'glove', kind: 'forearm', name: '팔뚝 커프', len: 0.38, finish: 'cuff', color: '#ffb3d1', emoji: '⭕' },
    { id: 'glove_forearm_frill', slot: 'glove', kind: 'forearm', name: '팔뚝 프릴', len: 0.38, finish: 'frill', color: '#fff4fa', emoji: '🤍' },
    { id: 'glove_forearm_ribbon', slot: 'glove', kind: 'forearm', name: '팔뚝 리본', len: 0.38, finish: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'glove_forearm_strap', slot: 'glove', kind: 'forearm', name: '팔뚝 스트랩', len: 0.38, finish: 'strap', color: '#8a5a3c', emoji: '🧵' },
    { id: 'glove_elbow_plain', slot: 'glove', kind: 'elbow', name: '팔꿈치', len: 0.52, finish: 'plain', color: '#f2ddc2', emoji: '🧤' },
    { id: 'glove_elbow_cuff', slot: 'glove', kind: 'elbow', name: '팔꿈치 커프', len: 0.52, finish: 'cuff', color: '#ffb3d1', emoji: '⭕' },
    { id: 'glove_elbow_frill', slot: 'glove', kind: 'elbow', name: '팔꿈치 프릴', len: 0.52, finish: 'frill', color: '#fff4fa', emoji: '🤍' },
    { id: 'glove_elbow_ribbon', slot: 'glove', kind: 'elbow', name: '팔꿈치 리본', len: 0.52, finish: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'glove_elbow_strap', slot: 'glove', kind: 'elbow', name: '팔꿈치 스트랩', len: 0.52, finish: 'strap', color: '#8a5a3c', emoji: '🧵' },
    { id: 'glove_opera_plain', slot: 'glove', kind: 'opera', name: '오페라', len: 0.68, finish: 'plain', color: '#f2ddc2', emoji: '🧤' },
    { id: 'glove_opera', slot: 'glove', kind: 'opera', name: '오페라 커프', len: 0.68, finish: 'cuff', color: '#b31f4a', emoji: '⭕' },
    { id: 'glove_opera_frill', slot: 'glove', kind: 'opera', name: '오페라 프릴', len: 0.68, finish: 'frill', color: '#fff4fa', emoji: '🤍' },
    { id: 'glove_opera_ribbon', slot: 'glove', kind: 'opera', name: '오페라 리본', len: 0.68, finish: 'ribbon', color: '#ffd0e6', emoji: '🎀' },
    { id: 'glove_opera_strap', slot: 'glove', kind: 'opera', name: '오페라 스트랩', len: 0.68, finish: 'strap', color: '#8a5a3c', emoji: '🧵' },
  ],
  // shoes — 4 × 5 = 20
  shoes: [
    { id: 'shoes_none', slot: 'shoes', kind: 'none', name: '없음' },
    { id: 'shoes_flat_plain', slot: 'shoes', kind: 'flat', name: '플랫', rise: 0, finish: 'plain', color: '#4a3a42', emoji: '👞' },
    { id: 'shoes_maryjane', slot: 'shoes', kind: 'flat', name: '메리제인', rise: 0, finish: 'strap', color: '#4a3a42', emoji: '👞' },
    { id: 'shoes_ballet', slot: 'shoes', kind: 'flat', name: '발레플랫', rise: 0, finish: 'ribbon', color: '#ff9ec4', emoji: '🩰' },
    { id: 'shoes_flat_sole', slot: 'shoes', kind: 'flat', name: '플랫 밑창', rise: 0, finish: 'sole', color: '#e6e6ee', emoji: '👟' },
    { id: 'shoes_glass', slot: 'shoes', kind: 'flat', name: '유리구두', rise: 0, finish: 'gloss', color: '#b8e4ff', emoji: '👠' },
    { id: 'shoes_low_plain', slot: 'shoes', kind: 'low', name: '로우', rise: 5, finish: 'plain', color: '#4a3a42', emoji: '👞' },
    { id: 'shoes_low_strap', slot: 'shoes', kind: 'low', name: '로우 스트랩', rise: 5, finish: 'strap', color: '#8a5a3c', emoji: '👠' },
    { id: 'shoes_low_ribbon', slot: 'shoes', kind: 'low', name: '로우 리본', rise: 5, finish: 'ribbon', color: '#ff9ec4', emoji: '🩰' },
    { id: 'shoes_sneaker', slot: 'shoes', kind: 'low', name: '스니커즈', rise: 5, finish: 'sole', color: '#ffffff', emoji: '👟' },
    { id: 'shoes_low_gloss', slot: 'shoes', kind: 'low', name: '로우 광택', rise: 5, finish: 'gloss', color: '#b8e4ff', emoji: '✨' },
    { id: 'shoes_boots', slot: 'shoes', kind: 'ankle', name: '앵클부츠', rise: 16, finish: 'plain', color: '#8a5a3c', emoji: '🥾' },
    { id: 'shoes_ankle_strap', slot: 'shoes', kind: 'ankle', name: '앵클 스트랩', rise: 16, finish: 'strap', color: '#8a5a3c', emoji: '👠' },
    { id: 'shoes_ankle_ribbon', slot: 'shoes', kind: 'ankle', name: '앵클 리본', rise: 16, finish: 'ribbon', color: '#ff9ec4', emoji: '🩰' },
    { id: 'shoes_ankle_sole', slot: 'shoes', kind: 'ankle', name: '앵클 밑창', rise: 16, finish: 'sole', color: '#e6e6ee', emoji: '👟' },
    { id: 'shoes_ankle_gloss', slot: 'shoes', kind: 'ankle', name: '앵클 광택', rise: 16, finish: 'gloss', color: '#b8e4ff', emoji: '✨' },
    { id: 'shoes_tall_plain', slot: 'shoes', kind: 'tall', name: '롱부츠', rise: 34, finish: 'plain', color: '#4a3a42', emoji: '👞' },
    { id: 'shoes_tall_strap', slot: 'shoes', kind: 'tall', name: '롱부츠 스트랩', rise: 34, finish: 'strap', color: '#8a5a3c', emoji: '👠' },
    { id: 'shoes_tall_ribbon', slot: 'shoes', kind: 'tall', name: '롱부츠 리본', rise: 34, finish: 'ribbon', color: '#ff9ec4', emoji: '🩰' },
    { id: 'shoes_tall_sole', slot: 'shoes', kind: 'tall', name: '롱부츠 밑창', rise: 34, finish: 'sole', color: '#e6e6ee', emoji: '👟' },
    { id: 'shoes_tall_gloss', slot: 'shoes', kind: 'tall', name: '롱부츠 광택', rise: 34, finish: 'gloss', color: '#b8e4ff', emoji: '✨' },
  ],
// GEN:wardrobe>>>
  hairColor: [
    { id: 'hcol_brown',  slot: 'hairColor', kind: 'color', name: '브라운',   color: '#7b5640', starter: true },
    { id: 'hcol_black',  slot: 'hairColor', kind: 'color', name: '블랙',     color: '#3b2f2c', starter: true },
    { id: 'hcol_blonde', slot: 'hairColor', kind: 'color', name: '금발',     color: '#e6c37a', starter: true },
    { id: 'hcol_pink',   slot: 'hairColor', kind: 'color', name: '핑크',     color: '#ffa6cf', starter: true },
    { id: 'hcol_lav',    slot: 'hairColor', kind: 'color', name: '라벤더',   color: '#c4a9ff', starter: true },
    { id: 'hcol_mint',   slot: 'hairColor', kind: 'color', name: '민트',     color: '#8fe0c0' },
    { id: 'hcol_silver', slot: 'hairColor', kind: 'color', name: '실버',     color: '#d6d6e2' },
  ],
  // 표정 — 튜토리얼을 막 마친 얼굴이 '어리둥절' 이다. 나머지는 얻어야 쓴다
  expression: [
    { id: 'exp_puzzled',  slot: 'expression', kind: 'puzzled',  name: '어리둥절', emoji: '😯', starter: true },
    { id: 'exp_smile',    slot: 'expression', kind: 'smile',    name: '방긋',   emoji: '🙂' },
    { id: 'exp_wink',     slot: 'expression', kind: 'wink',     name: '윙크',   emoji: '😉' },
    { id: 'exp_happy',    slot: 'expression', kind: 'happy',    name: '활짝',   emoji: '😄' },
    { id: 'exp_surprise', slot: 'expression', kind: 'surprise', name: '놀람',   emoji: '😲' },
    { id: 'exp_cool',     slot: 'expression', kind: 'cool',     name: '시크',   emoji: '😑' },
  ],
  tattoo: [
    { id: 'tattoo_none', slot: 'tattoo', kind: 'none',  name: '없음' },
    { id: 'tattoo_star', slot: 'tattoo', kind: 'star',  name: '별',     color: '#c98bd6', emoji: '⭐' },
    { id: 'tattoo_tear', slot: 'tattoo', kind: 'tear',  name: '물방울', color: '#8ad0ff', emoji: '💧' },
    { id: 'tattoo_heart',slot: 'tattoo', kind: 'heart', name: '하트',   color: '#ff8fb0', emoji: '❤️' },
    { id: 'tattoo_rune', slot: 'tattoo', kind: 'rune',  name: '룬문양', color: '#a98bff', emoji: '✴️' },
  ],

  // ── 옷 / 악세사리 ──
  // 상의 — 실루엣은 하나고 **소매·넥라인·단추**로 갈린다 (renderTop 이 이 세 필드를 본다)
  //   sleeve : none(민소매) / cap(캡) / short(반팔) / half(7부) / long(긴팔)
  //   neck   : round(라운드) / v(브이넥) / square(스퀘어) / polo(폴라)
  //   button : true 면 앞섶에 단추가 세로로 붙는다
  top: [
    { id: 'top_none',   slot: 'top', kind: 'none',  name: '없음' },
    { id: 'top_tee',    slot: 'top', kind: 'tee',    name: '기본 티', color: '#ffb8d9', sleeve: 'short', neck: 'round' },
    { id: 'top_blouse', slot: 'top', kind: 'blouse', name: '블라우스', color: '#fff0b8', sleeve: 'short', neck: 'round', button: true },
    { id: 'top_knit',   slot: 'top', kind: 'knit',   name: '니트',   color: '#c9b6ff', sleeve: 'long',  neck: 'round' },
    { id: 'top_hoodie', slot: 'top', kind: 'hoodie', name: '후드티', color: '#9fe0c4', sleeve: 'long',  neck: 'round' },
    { id: 'top_shirt',      slot: 'top', kind: 'shirt',      name: '셔츠',      color: '#cfe3ff', sleeve: 'short', neck: 'round',  button: true },
    { id: 'top_turtle',     slot: 'top', kind: 'turtle',     name: '폴라니트',  color: '#f0c9d8', sleeve: 'long',  neck: 'polo' },
    { id: 'top_cardigan',   slot: 'top', kind: 'cardigan',   name: '가디건',    color: '#ffd9a8', sleeve: 'long',  neck: 'v',      button: true },
    { id: 'top_sleeveless', slot: 'top', kind: 'sleeveless', name: '민소매',    color: '#b8e6d8', sleeve: 'none',  neck: 'round' },
    { id: 'top_vneck',      slot: 'top', kind: 'vneck',      name: '브이넥 티', color: '#d8c4ff', sleeve: 'short', neck: 'v' },
  ],
  // 하의 — 치마(skirt) 계열과 바지(shorts/pants) 계열 두 갈래. 나머지는 필드가 정한다
  //   hemY  : 밑단 높이(px). 246 무릎 위 · 268 무릎 · 288 무릎 아래 · 306 종아리 중간 · 330 발목
  //   flare : 엉덩이보다 밑단이 얼마나 더 퍼지는지(px). 0 이면 H 라인
  //   balloon: true 면 중간이 부풀고 밑단이 다시 오므라든다 (벌룬)
  //   belt  : true 면 허리춤에 띠가 붙는다
  bottom: [
    { id: 'bottom_none',   slot: 'bottom', kind: 'none',   name: '없음' },
    { id: 'bottom_skirt',  slot: 'bottom', kind: 'skirt',  name: '주름치마', color: '#c9b6ff', hemY: 252, flare: 12, belt: true },
    { id: 'bottom_shorts', slot: 'bottom', kind: 'shorts', name: '반바지',  color: '#ffc2a8', hemY: 246 },
    { id: 'bottom_pants',  slot: 'bottom', kind: 'pants',  name: '청바지',  color: '#a8c4ec', hemY: 332 },
    { id: 'bottom_hskirt',   slot: 'bottom', kind: 'skirt', name: 'H라인 스커트',    color: '#8f9fb8', hemY: 268, flare: 0 },
    { id: 'bottom_askirt',   slot: 'bottom', kind: 'skirt', name: '벨트 A라인 스커트', color: '#ffb8a8', hemY: 288, flare: 20, belt: true },
    { id: 'bottom_balloon',  slot: 'bottom', kind: 'skirt', name: '벌룬 스커트',     color: '#ffe0a0', hemY: 262, flare: 22, balloon: true },
    { id: 'bottom_longskirt',slot: 'bottom', kind: 'skirt', name: '롱스커트',        color: '#a8d8c0', hemY: 330, flare: 24 },
    { id: 'bottom_capri',    slot: 'bottom', kind: 'pants', name: '카프리 팬츠',     color: '#d8c0a8', hemY: 306 },
  ],
  // 원피스 — 상의의 넥라인/소매 필드를 그대로 쓰고, 치마 쪽은 hemY·flare 로 갈린다
  //   puff: true 면 어깨에 볼륨(퍼프 소매)이 붙는다
  dress: [
    { id: 'dress_none',     slot: 'dress', kind: 'none',  name: '없음' },
    { id: 'dress_princess', slot: 'dress', kind: 'princess', name: '공주 드레스', color: '#7fa06a', neck: 'round', starter: true },
    { id: 'dress_onepiece', slot: 'dress', kind: 'aline', name: '원피스', color: '#ffc2e2', hemY: 270, flare: 46, neck: 'round', sleeve: 'short' },
    { id: 'dress_gown',     slot: 'dress', kind: 'gown',  name: '드레스', color: '#b8d4ff', hemY: 320, flare: 40, neck: 'round', sleeve: 'short' },
    { id: 'dress_short', slot: 'dress', kind: 'aline', name: '숏 원피스',  color: '#ffd0e0', hemY: 262, flare: 30, neck: 'round',  sleeve: 'short' },
    { id: 'dress_midi',  slot: 'dress', kind: 'aline', name: '미디 원피스', color: '#c0d8ff', hemY: 300, flare: 40, neck: 'v',      sleeve: 'short' },
    { id: 'dress_maxi',  slot: 'dress', kind: 'gown',  name: '맥시 원피스', color: '#d8c0ff', hemY: 332, flare: 54, neck: 'square', sleeve: 'cap' },
    { id: 'dress_puff',  slot: 'dress', kind: 'aline', name: '퍼프 원피스', color: '#ffe8b0', hemY: 268, flare: 34, neck: 'round',  sleeve: 'short', puff: true },
    { id: 'dress_slip',  slot: 'dress', kind: 'gown',  name: '슬립 드레스', color: '#e0c8d8', hemY: 312, flare: 22, neck: 'v',      sleeve: 'none' },
  ],
};

// ─── 옷 색 팔레트 ───────────────────────────────────────────────
// 옷 하나를 60벌로 늘리는 대신 **색을 따로 고르게** 한다. 아이템 목록에 색만 다른
// 옷이 60개 늘어서면 4열 그리드가 15줄이 되고 서로 구분도 안 된다.
// 고른 색은 아이템의 color 를 덮어쓴다 (안 고르면 아이템 원래 색 그대로).
//
// **id 는 hcol_* (헤어컬러) 와 겹치지 않게 c_ 로 시작한다.**
// 이름은 i18n 의 NAMES.en 에도 반드시 같이 넣는다 — 안 넣으면 영어 화면에 한글이 남는다.
const COLORS = [
  // 화이트 — 흰색도 여러 갈래다. 노란 기운(아이보리·크림) / 회색 기운(진주) / 갈색 기운(에크루)
  { id: 'c_white',     name: '리얼 화이트',   hex: '#ffffff' },
  { id: 'c_ivory',     name: '아이보리',      hex: '#fffdf0' },
  { id: 'c_pearl',     name: '진주',          hex: '#f6f2ea' },
  { id: 'c_cream',     name: '크림',          hex: '#fff4d6' },
  { id: 'c_ecru',      name: '에크루',        hex: '#efe4d0' },
  { id: 'c_offwhite',  name: '오프 화이트',   hex: '#faf6f2' },
  // 블랙 — 순흑은 화면에서 무거워서, 푸른 기운·회색 기운을 섞은 쪽을 더 많이 쓴다
  { id: 'c_black',     name: '리얼 블랙',     hex: '#0a0a0a' },
  { id: 'c_blueblack', name: '블루 블랙',     hex: '#121729' },
  { id: 'c_softblack', name: '소프트 블랙',   hex: '#2c2c30' },
  { id: 'c_charcoal',  name: '차콜',          hex: '#3d3d43' },
  { id: 'c_ink',       name: '잉크',          hex: '#1e2a3d' },
  // 그레이
  { id: 'c_silver',    name: '실버',          hex: '#d9d9e0' },
  { id: 'c_lightgray', name: '라이트 그레이', hex: '#c0c0c8' },
  { id: 'c_gray',      name: '그레이',        hex: '#9a9aa4' },
  { id: 'c_smoke',     name: '스모크',        hex: '#75747d' },
  { id: 'c_deepgray',  name: '딥 그레이',     hex: '#54535b' },
  // 베이지 · 브라운
  { id: 'c_sand',      name: '샌드',          hex: '#e9d7ba' },
  { id: 'c_latte',     name: '라떼',          hex: '#d8c0a4' },
  { id: 'c_camel',     name: '카멜',          hex: '#c19a6b' },
  { id: 'c_taupe',     name: '토프',          hex: '#b09b86' },
  { id: 'c_cocoa',     name: '코코아',        hex: '#8b6b53' },
  { id: 'c_choco',     name: '초콜릿',        hex: '#5f4435' },
  { id: 'c_mocha',     name: '모카',          hex: '#705749' },
  // 핑크
  { id: 'c_babypink',  name: '베이비 핑크',   hex: '#ffd7e6' },
  { id: 'c_blossom',   name: '벚꽃',          hex: '#ffc2d4' },
  { id: 'c_coralpink', name: '코랄 핑크',     hex: '#ffb0b8' },
  { id: 'c_rose',      name: '로즈',          hex: '#f78da7' },
  { id: 'c_dustyrose', name: '더스티 로즈',   hex: '#d99aa8' },
  { id: 'c_magenta',   name: '마젠타',        hex: '#d94f8a' },
  { id: 'c_fuchsia',   name: '푸시아',        hex: '#ff5fa2' },
  // 레드
  { id: 'c_scarlet',   name: '스칼렛',        hex: '#e03131' },
  { id: 'c_cherry',    name: '체리',          hex: '#c9184a' },
  { id: 'c_burgundy',  name: '버건디',        hex: '#7b1e33' },
  { id: 'c_brick',     name: '브릭',          hex: '#b34a3a' },
  { id: 'c_tomato',    name: '토마토',        hex: '#ff6b4a' },
  // 오렌지 · 옐로
  { id: 'c_apricot',   name: '애프리콧',      hex: '#ffcaa0' },
  { id: 'c_tangerine', name: '탠저린',        hex: '#ff9f45' },
  { id: 'c_amber',     name: '앰버',          hex: '#f0a202' },
  { id: 'c_mustard',   name: '머스터드',      hex: '#d9a520' },
  { id: 'c_butter',    name: '버터',          hex: '#ffe9a8' },
  { id: 'c_lemon',     name: '레몬',          hex: '#fff07a' },
  { id: 'c_gold',      name: '골드',          hex: '#e6c05c' },
  // 그린
  { id: 'c_mint',      name: '민트',          hex: '#a8e6cf' },
  { id: 'c_sage',      name: '세이지',        hex: '#b5c7a3' },
  { id: 'c_olive',     name: '올리브',        hex: '#7d8c4a' },
  { id: 'c_forest',    name: '포레스트',      hex: '#3f6b48' },
  { id: 'c_emerald',   name: '에메랄드',      hex: '#2f9e6e' },
  { id: 'c_lime',      name: '라임',          hex: '#b8e05a' },
  { id: 'c_herb',      name: '허브',          hex: '#6fae7a' },
  // 블루
  { id: 'c_iceblue',   name: '아이스 블루',   hex: '#d6ecff' },
  { id: 'c_sky',       name: '스카이',        hex: '#8fc7f0' },
  { id: 'c_cobalt',    name: '코발트',        hex: '#2f6fd0' },
  { id: 'c_navy',      name: '네이비',        hex: '#23335e' },
  { id: 'c_denim',     name: '데님',          hex: '#5b7fae' },
  { id: 'c_teal',      name: '틸',            hex: '#2f8f8f' },
  { id: 'c_aqua',      name: '아쿠아',        hex: '#7fdfe0' },
  // 퍼플
  { id: 'c_lavender',  name: '라벤더',        hex: '#cbb6ff' },
  { id: 'c_lilac',     name: '라일락',        hex: '#ddc4ec' },
  { id: 'c_violet',    name: '바이올렛',      hex: '#8b5fd6' },
  { id: 'c_plum',      name: '플럼',          hex: '#6b3f6e' },
];
// 색을 갈아입힐 수 있는 칸.
// **헤어도 여기 있다.** 예전에는 '헤어컬러' 라는 칸을 따로 두고 7색 중에서 골랐는데,
// 옷은 60색 팔레트로 염색하면서 머리만 7색인 것이 앞뒤가 안 맞았다.
// 이제 머리도 '헤어 아이템의 원래 색(브라운)을 염색한다' 는 같은 규칙을 쓴다.
const COLORABLE_SLOTS = ['hair', 'top', 'bottom', 'dress', 'circlet', 'earring', 'necklace', 'glove', 'shoes'];

// 헤어 축 표 — **뒷머리(전체 실루엣) × 앞머리** 를 따로 고른다.
// 30벌을 한 칸에 늘어놓으면 무엇이 무엇과 다른지 읽히지 않는다. 6 + 5 칸으로 고르면
// 고른 둘이 만나는 벌 하나가 실제로 입는 벌이다 (id 는 그대로라 세이브도 그대로).
// 아래는 tools/genwardrobe.js 의 헤어 축 표에서 뽑는다 — 손으로 고치지 않는다.
// <<<GEN:hairaxes
const HAIR_AXES = {
  back: [
    { id: 'hairback_long', k: 'long', name: '긴 생머리' },
    { id: 'hairback_bob', k: 'bob', name: '단발' },
    { id: 'hairback_twin', k: 'twin', name: '양갈래' },
    { id: 'hairback_ponytail', k: 'ponytail', name: '포니테일' },
    { id: 'hairback_wave', k: 'wave', name: '웨이브' },
    { id: 'hairback_bun', k: 'bun', name: '올림머리' },
  ],
  bang: [
    { id: 'hairbang_straight', k: 'straight', name: '기본' },
    { id: 'hairbang_side', k: 'side', name: '사이드뱅' },
    { id: 'hairbang_curtain', k: 'curtain', name: '커튼뱅' },
    { id: 'hairbang_sheer', k: 'sheer', name: '시스루뱅' },
    { id: 'hairbang_none', k: 'none', name: '올 백' },
  ],
};
// GEN:hairaxes>>>

// 옷장 슬롯 메타 (UI 탭 순서/라벨)
// gated: true → 잠금/해금 대상 (starter 아이템만 처음 보유, 나머지는 획득 필요)
const WARDROBE_SLOTS = [
  { slot: 'hair',      label: '헤어',    emoji: '💇', gated: true },
  { slot: 'expression',label: '표정',    emoji: '😊', gated: true },
  { slot: 'tattoo',    label: '문신',    emoji: '⚜️', gated: true },
  // 옷·악세사리도 전부 획득 대상이다. 인트로를 마친 시점에 손에 있는 옷은
  // 인트로에서 입고 있던 '공주 드레스' 한 벌뿐이고, 나머지는 아직 얻지 않았다.
  { slot: 'top',       label: '상의',    emoji: '👕', gated: true },
  { slot: 'bottom',    label: '하의',    emoji: '👖', gated: true },
  { slot: 'dress',     label: '원피스',  emoji: '🥻', gated: true },   // 👗 는 '옷' 탭이 쓴다
  { slot: 'circlet',   label: '서클렛',  emoji: '👑', gated: true },
  { slot: 'earring',   label: '귀걸이',  emoji: '💎', gated: true },
  { slot: 'necklace',  label: '목걸이',  emoji: '📿', gated: true },
  { slot: 'glove',     label: '장갑',    emoji: '🧤', gated: true },
  { slot: 'shoes',     label: '구두',    emoji: '👠', gated: true },
];

// ─── 에너지 (Energy / 행동력) ───
// 현실 24시간 = 게임 24시간. 로컬 자정(00:00)마다 dailyFill 만큼 충전.
// cap: 현재 상한(=하루 충전량). 추후 유료 구매 시 상한 확장 여지.
// cost: 행동별 소모량. 추후 크리처/공간 돌보기 등 추가 예정.
const ENERGY = {
  cap: 1000,
  // **자정에 상한까지 채운다.** 상한이 매력 단계로 늘어나므로(`energyCap`)
  // 고정 숫자를 더하면 늘어난 만큼은 영영 안 찬다 — game.js 의 `refreshEnergy()` 가
  // `energyCap()` 을 쓴다. 이 값은 옛 세이브·검사기용 기준값으로 남겨 둔다
  dailyFill: 1000,
  // 매력 **단계**가 하나 오를 때마다 상한이 이만큼 늘어난다 (`D.TIERS` 다섯 칸).
  // 새싹 1000 → 여신 1800. 판정은 `charmPeak()` 다 — 애착 크리처를 바꿔 총합이
  // 내려가도 **상한은 안 줄어든다**: 줄이면 지금 들고 있던 AP 가 갈 곳을 잃는다
  capPerTier: 200,
  // 채집은 **지대마다 다르다** (`zoneAp`). 여기 있는 gather 는 그 표에 없는 곳의
  // 기본값이다. 조합은 어디서나 같다 — 공방은 한 곳뿐이라 나눌 축이 없다
  cost: { gather: 10, brew: 25 },
  // 조합에 **성공**하면 주는 현자의 결정.
  //
  // ⚠️ **이것이 결정의 유일한 수급원이다.** 예전에는 조합 «실패»가 그 자리였는데,
  // 비법서가 들어오면서 실패가 사라졌다 — 그대로 두었으면 AP 충전도 밭 칸도
  // 영영 못 여는 게임이 됐을 것이다.
  // **조합 값(25)보다 반드시 작아야 한다.** 같기만 해도 조합을 돌려 AP 를 무한히 번다
  brewReward: 5,
  // 현자의 결정으로 AP 를 가득 채우는 값.
  // **무한 AP 가 되지 않게 잡은 수치다** — 결정 하나가 AP 하나 값이므로,
  // 조합 한 번(25 AP)에 결정 10 개를 돌려받으면 매번 15 AP 씩 손해다.
  // 실패 보상이 조합 값(25)을 넘으면 일부러 실패해서 AP 를 무한히 버는 고리가 생긴다.
  // 수치를 바꿀 때 이 관계를 먼저 볼 것.
  // **가득(cap) 채울 때** 드는 값. 실제로 내는 값은 모자란 만큼만이라
  // game.js 의 chargeCost() 가 여기서 비례로 나눈다 (지금은 AP 하나에 결정 하나).
  chargeCost: 1000,
  failReward: 10,     // 조합 실패 1회에 주는 현자의 결정
};

// ─── 운동 (EXERCISE.md) ───────────────────────────────────────
// **근성이 문을 연다.** 근성이 오를수록 고강도 종목이 열리고, 고강도일수록
// 근성이 더 오른다 — 다만 스태미나도 그만큼 더 든다.
//
// 값은 전부 **1분당**이다. 「종목 × 시간」으로 곱해서 쓴다.
//   need  이 종목이 열리는 근성
//   stam  스태미나 소모 · ap AP 소모 · grit 근성 상승 · fit 단련 상승 · full 포만감 소모
//
// ⚠️ 밸런스의 축 셋을 같이 보고 정한 값이다. 하나만 바꾸지 말 것.
//   1. AP 는 하루 1000 이고 채집 10 · 조합 25 다. 운동에 하루 200~300 쯤 쓰는 것을 봤다
//   2. 스태미나 상한은 초반에 ~60 이다. 서킷 60분(300)은 애초에 못 고르는 것이 맞다
//   3. 근성은 1000 이 상한이다. 달리기 60분이 +60 이라 서킷(600)까지 여러 주 걸린다
const EXERCISES = [
  { id: 'ex_walk',    emoji: '🚶', name: '산책',      need: 0,
    stam: 1.0, ap: 1.0, grit: 0.4, fit: 0.010, full: 0.3 },
  { id: 'ex_stretch', emoji: '🧘', name: '스트레칭',  need: 50,
    stam: 1.5, ap: 1.5, grit: 0.6, fit: 0.015, full: 0.4 },
  { id: 'ex_run',     emoji: '🏃', name: '달리기',    need: 150,
    stam: 2.5, ap: 2.5, grit: 1.0, fit: 0.030, full: 0.7 },
  { id: 'ex_lift',    emoji: '🏋️', name: '근력 운동', need: 350,
    stam: 3.5, ap: 3.5, grit: 1.4, fit: 0.045, full: 1.0 },
  { id: 'ex_circuit', emoji: '🤸', name: '서킷',      need: 600,
    stam: 5.0, ap: 5.0, grit: 2.0, fit: 0.070, full: 1.4 },
];
// 고를 수 있는 시간 (분)
const EXERCISE_MINS = [10, 20, 30, 60];

// ─── 음식 (EXERCISE.md) ───────────────────────────────────────
// 먹으면 **포만감**이 찬다. 포만감은 스태미나 상한을 정하므로, 결국 음식이 운동을 굴린다.
//
// **무엇을 먹느냐가 선택이어야 한다.** 그래서 「많이 채우지만 단련을 깎는」 음식을 둔다 —
// 안 그러면 사람은 언제나 제일 큰 것만 먹고, 목록이 다섯 줄일 이유가 없어진다.
//   full 포만감 · happy 행복(아우라) · fit 단련
//   w    채집에서 나오는 가중치 (많이 채우는 것일수록 드물다)
//
// 지금은 **채집에서 재료와 함께** 나온다. 요리사 클레멘이 들어오면 그가 주는 것으로
// 옮긴다 — 폭식 시스템의 반대편이라 서사가 거기에 맞는다 (STORY.md).
const FOODS = [
  { id: 'food_porridge', emoji: '🥣', name: '죽',        full: 15, w: 30 },
  { id: 'food_bread',    emoji: '🍞', name: '빵',        full: 25, w: 26 },
  { id: 'food_salad',    emoji: '🥗', name: '샐러드',    full: 20, happy: 5,  w: 20 },
  { id: 'food_meat',     emoji: '🍗', name: '구운 고기', full: 40, fit: -0.2, w: 16 },
  { id: 'food_cake',     emoji: '🍰', name: '케이크',    full: 50, happy: 20, fit: -0.5, w: 8 },
];
// 채집 한 번에 음식이 같이 나올 확률. 하루 AP 1000 이면 채집 100번이라
// 대략 12개가 나온다 — 운동 두어 번 분의 포만감이다
const FOOD_RATE = 0.12;

// ═══════════════════════════════════════════════════════════════
//  먹이 — 크리처가 먹는 것 (CREATURE.md 7장)
// ═══════════════════════════════════════════════════════════════
//
// **음식과 먹이는 다른 것이다.** 음식은 사람이 먹고 포만감이 차고, 먹이는 크리처가 먹고
// 로열티와 버프가 붙는다. 같은 탭에 두면 「케이크를 크리처에게 먹이나?」가 된다.
//
// 먹이 하나가 **두 가지**를 한다 — 이 둘을 하나로 묶으면 안 된다 (7장):
//   · 로열티(영구·쌓인다)  → 덤이 나올 때 **개수**가 는다
//   · 버프(일시적·시간이 지나면 사라진다) → 덤이 나올 **확률**이 오른다
// 버프만 있으면 먹이가 그냥 소모품이고, 로열티만 있으면 「나가기 전에 먹인다」는
// 순간의 판단이 사라진다.
//
// 셋의 값이 **비례하지 않게** 잡았다. 들풀은 로열티당 싸고 버프가 짧다 —
// 로열티를 쌓을 때는 들풀, 지금 한 번 나갈 때는 사탕. 비례하면 고를 이유가 없다.
const FEEDS = [
  { id: 'feed_grass', emoji: '🌿', name: '들풀 뭉치', loyalty: 2,  hours: 1, w: 60 },
  { id: 'feed_dew',   emoji: '🫐', name: '이슬 열매', loyalty: 6,  hours: 3, w: 30 },
  { id: 'feed_star',  emoji: '🍬', name: '별빛 사탕', loyalty: 15, hours: 8, w: 10 },
];
// 채집 한 번에 먹이가 같이 나올 확률. 음식(0.12)보다 낮게 둔다 —
// 로열티 100 까지가 들풀로 50개쯤이라, 이 값이면 며칠은 걸린다
const FEED_RATE = 0.09;

// 로열티가 덤 **개수**를 정한다. 확률이 아니다 —
// 확률에는 이미 넷(기본·속성·날씨·시간)이 붙어 있어서, 다섯 번째를 같은 자리에 얹으면
// 무엇이 효과가 있는지 아무도 모른다 (CREATURE.md 7장)
const LOYALTY_MAX = 100;
const LOYALTY_STEPS = [0, 40, 80];        // 이 값을 넘으면 덤이 한 개씩 는다 → 1 · 2 · 3개
function loyaltyBonus(v) {
  let n = 0;
  for (const s of LOYALTY_STEPS) if ((v || 0) >= s) n++;
  return Math.max(1, n);
}

// 새 캐릭터 기본 착장
const DEFAULT_OUTFIT = {
  hair: 'hair_long', hairColor: 'hcol_brown', expression: 'exp_puzzled', tattoo: 'tattoo_none',
  // 시작 착장은 인트로의 공주 그대로 — 원피스 한 벌뿐이고 상·하의는 아직 없다
  top: 'top_none', bottom: 'bottom_none', dress: 'dress_princess',
  circlet: 'circlet_none', earring: 'earring_none', necklace: 'necklace_none',
  glove: 'glove_none', shoes: 'shoes_none',
};

// 조합 판정용: 재료 id 배열을 정렬해 문자열 키로
function recipeKey(ids) {
  return [...ids].sort().join('+');
}

// 레시피 빠른 조회 맵
const RECIPE_MAP = {};
for (const r of RECIPES) RECIPE_MAP[recipeKey(r.inputs)] = r.result;

window.GameData = {
  INGREDIENTS, ZONES, MAPS, zoneUnlock, zoneAp, CAULDRONS, RECIPES, RECIPE_MAP, CRYSTAL, SHOP, TIERS,
  VILLAGES, VILLAGE_SHOWN, villagesShown, SPEAKERS, speaker, TALKS,
  KEYWORDS, keyword, ASKS, asksOf,
  WARDROBE, WARDROBE_SLOTS, HAIR_AXES, DEFAULT_OUTFIT, ENERGY, RECIPE_CATS, RECIPE_GRADES,
  EXERCISES, EXERCISE_MINS, FOODS, FOOD_RATE,
  FEEDS, FEED_RATE, LOYALTY_MAX, LOYALTY_STEPS, loyaltyBonus,
  COLORS, COLORABLE_SLOTS,
  LEAGUE, LEAGUE_FAMS, LEAGUE_STEPS, LEAGUES, league, NPC_HEAD, NPC_TAIL,
  CREATURE_ATTRS, creatureAttr, MAP_ATTRS, mapAttr,
  FARM_CROPS, farmCrop, PLOT_COST, QUESTS, questOf, CUTS, cutOf, PAGE_TIERS, pagesForSpec,
  WEATHERS, WEATHER_HOURS, DAYPARTS, SPECIAL_TIERS, specialTier,
  getTier, recipeKey,
};
