// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 게임 데이터
//  (독립 신규 게임 / MVP vertical slice)
// ═══════════════════════════════════════════════════════════════

// ─── 재료 (Ingredients) ───
// weight: 채집 시 뽑힐 가중치 (클수록 흔함)
// rare:   맵마다 하나씩 있는 '특별한 재료'. 가중 추첨과 별개로 SPECIAL_RATE 확률로 나온다.
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
};

// 특별한 재료가 나올 확률 (0.001 = 0.1%)
const SPECIAL_RATE = 0.001;

// ─── 채집 지대 (Zones) ─── 채집 화면의 카테고리 탭
const ZONES = [
  { id: 'plain',    emoji: '🌾', name: '포근 평야 지대' },
  { id: 'forest',   emoji: '🌲', name: '울창 숲 지대' },
  { id: 'mountain', emoji: '⛰️', name: '뾰족 산악 지대' },
  { id: 'shore',    emoji: '🐚', name: '반짝 해안 지대' },
  { id: 'waste',    emoji: '🏜️', name: '황량 황무지' },
];

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
  // ── 크리처 ──
  { inputs: ['crystal', 'dew'],
    result: { id: 'butterfly', kind: 'creature', grade: 'basic', emoji: '🦋', name: '반짝 나비',
      desc: '주위를 맴도는 수정빛 나비.', charmBonus: 2 } },
  { inputs: ['mushroom', 'petal'],
    result: { id: 'frog', kind: 'creature', grade: 'basic', emoji: '🐸', name: '꽃개구리',
      desc: '꽃잎을 이고 다니는 귀여운 개구리.', charmBonus: 1 } },
  { inputs: ['berry', 'crystal', 'mushroom'],
    result: { id: 'unicorn', kind: 'creature', grade: 'high', emoji: '🦄', name: '유니콘',
      desc: '순수한 자에게만 나타난다는 전설의 유니콘.', charmBonus: 5 } },
];

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

// ─── 매력 등급 (Charm Tiers) ───
// 매력 총합(비주얼 + 아우라 + 크리처 보너스)에 따른 칭호
const TIERS = [
  { min: 0,   emoji: '🌱', title: '새싹' },
  { min: 15,  emoji: '🌸', title: '꽃봉오리' },
  { min: 35,  emoji: '🧚', title: '요정' },
  { min: 60,  emoji: '👑', title: '뮤즈' },
  { min: 100, emoji: '✨', title: '여신' },
];

// 지대의 해금 점수 = 그 지대에서 가장 먼저 열리는 맵의 점수
function zoneUnlock(zoneId) {
  return MAPS.filter(m => m.zone === zoneId).reduce((min, m) => Math.min(min, m.unlock), Infinity);
}

function getTier(total) {
  let t = TIERS[0];
  for (const tier of TIERS) if (total >= tier.min) t = tier;
  return t;
}

// ─── 옷장 (Wardrobe) ───
// 아바타 장비 카탈로그. 슬롯별 목록의 첫 항목은 항상 '없음'(kind:'none').
// 옷: 상의(top)/하의(bottom)는 따로 착용, 원피스(dress)는 상하 일체.
//     원피스 착용 시 상·하의는 렌더링에서 무시됨.
// 악세사리: 서클렛(circlet)/귀걸이(earring)/목걸이(necklace) — 추후 슬롯 추가 가능.
const WARDROBE = {
  // ── 커스터마이징 (잠금/해금 대상) ──
  // starter: true → 처음부터 보유 / (없으면 잠김 → 플레이하며 획득)
  hair: [
    { id: 'hair_long',     slot: 'hair', kind: 'long',     name: '긴 생머리', emoji: '💁‍♀️', starter: true },
    { id: 'hair_bob',      slot: 'hair', kind: 'bob',      name: '단발',     emoji: '💇‍♀️', starter: true },
    { id: 'hair_twin',     slot: 'hair', kind: 'twin',     name: '양갈래',   emoji: '👧',    starter: true },
    { id: 'hair_ponytail', slot: 'hair', kind: 'ponytail', name: '포니테일', emoji: '🎠' },
    { id: 'hair_wave',     slot: 'hair', kind: 'wave',     name: '웨이브',   emoji: '🌊' },
  ],
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
    { id: 'exp_cool',     slot: 'expression', kind: 'cool',     name: '시크',   emoji: '😎' },
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
    { id: 'dress_princess', slot: 'dress', kind: 'princess', name: '공주 드레스', color: '#7fa06a', starter: true },
    { id: 'dress_onepiece', slot: 'dress', kind: 'aline', name: '원피스', color: '#ffc2e2', hemY: 270, flare: 46, neck: 'round', sleeve: 'short' },
    { id: 'dress_gown',     slot: 'dress', kind: 'gown',  name: '드레스', color: '#b8d4ff', hemY: 320, flare: 40, neck: 'round', sleeve: 'short' },
    { id: 'dress_short', slot: 'dress', kind: 'aline', name: '숏 원피스',  color: '#ffd0e0', hemY: 262, flare: 30, neck: 'round',  sleeve: 'short' },
    { id: 'dress_midi',  slot: 'dress', kind: 'aline', name: '미디 원피스', color: '#c0d8ff', hemY: 300, flare: 40, neck: 'v',      sleeve: 'short' },
    { id: 'dress_maxi',  slot: 'dress', kind: 'gown',  name: '맥시 원피스', color: '#d8c0ff', hemY: 332, flare: 54, neck: 'square', sleeve: 'cap' },
    { id: 'dress_puff',  slot: 'dress', kind: 'aline', name: '퍼프 원피스', color: '#ffe8b0', hemY: 268, flare: 34, neck: 'round',  sleeve: 'short', puff: true },
    { id: 'dress_slip',  slot: 'dress', kind: 'gown',  name: '슬립 드레스', color: '#e0c8d8', hemY: 312, flare: 22, neck: 'v',      sleeve: 'none' },
  ],
  circlet: [
    { id: 'circlet_none',   slot: 'circlet', kind: 'none',   name: '없음' },
    { id: 'circlet_flower', slot: 'circlet', kind: 'flower', name: '꽃 서클렛', color: '#ff9ec4', emoji: '🌸' },
    { id: 'circlet_tiara',  slot: 'circlet', kind: 'tiara',  name: '티아라',    color: '#ffe08a', emoji: '👑' },
    { id: 'circlet_band',   slot: 'circlet', kind: 'band',   name: '리본밴드',  color: '#ffd0e6', emoji: '🎀' },
  ],
  earring: [
    { id: 'earring_none', slot: 'earring', kind: 'none', name: '없음' },
    { id: 'earring_drop', slot: 'earring', kind: 'drop', name: '물방울', color: '#8ad0ff', emoji: '💧' },
    { id: 'earring_hoop', slot: 'earring', kind: 'hoop', name: '링',    color: '#ffd76a', emoji: '⭕' },
    { id: 'earring_star', slot: 'earring', kind: 'star', name: '별',    color: '#ffe08a', emoji: '⭐' },
  ],
  necklace: [
    { id: 'necklace_none',    slot: 'necklace', kind: 'none',    name: '없음' },
    { id: 'necklace_pendant', slot: 'necklace', kind: 'pendant', name: '펜던트', color: '#ffd76a', emoji: '📿' },
    { id: 'necklace_pearl',   slot: 'necklace', kind: 'pearl',   name: '진주',   color: '#ffffff', emoji: '🤍' },
    { id: 'necklace_choker',  slot: 'necklace', kind: 'choker',  name: '초커',   color: '#ff9ec4', emoji: '🎀' },
  ],
  // 장갑 — len 은 팔 길이 대비 덮는 비율 (0.18 = 손목까지, 0.62 = 팔꿈치 위까지)
  glove: [
    { id: 'glove_none',    slot: 'glove', kind: 'none',    name: '없음' },
    { id: 'glove_lace',    slot: 'glove', kind: 'lace',    name: '레이스', color: '#fff4fa', len: 0.20, emoji: '🤍' },
    { id: 'glove_knit',    slot: 'glove', kind: 'knit',    name: '니트',   color: '#f2ddc2', len: 0.24, emoji: '🧶' },
    { id: 'glove_leather', slot: 'glove', kind: 'leather', name: '가죽',   color: '#8a5a3c', len: 0.26, emoji: '🧤' },
    { id: 'glove_satin',   slot: 'glove', kind: 'satin',   name: '새틴',   color: '#ffb3d1', len: 0.44, emoji: '🎀' },
    { id: 'glove_opera',   slot: 'glove', kind: 'opera',   name: '오페라', color: '#b31f4a', len: 0.62, emoji: '👑' },
  ],
  // 구두 — rise 는 발목 위로 올라오는 높이(px). 0 이면 발만 덮는다
  shoes: [
    { id: 'shoes_none',     slot: 'shoes', kind: 'none',     name: '없음' },
    { id: 'shoes_ballet',   slot: 'shoes', kind: 'ballet',   name: '발레플랫', color: '#ff9ec4', rise: 0,  emoji: '🩰' },
    { id: 'shoes_maryjane', slot: 'shoes', kind: 'maryjane', name: '메리제인', color: '#4a3a42', rise: 0,  emoji: '👞' },
    { id: 'shoes_sneaker',  slot: 'shoes', kind: 'sneaker',  name: '스니커즈', color: '#ffffff', rise: 5,  emoji: '👟' },
    { id: 'shoes_boots',    slot: 'shoes', kind: 'boots',    name: '앵클부츠', color: '#8a5a3c', rise: 16, emoji: '🥾' },
    { id: 'shoes_glass',    slot: 'shoes', kind: 'glass',    name: '유리구두', color: '#b8e4ff', rise: 0,  emoji: '👠' },
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
// 색을 갈아입힐 수 있는 칸. 헤어컬러는 그 자체가 색이라 여기 넣지 않는다.
const COLORABLE_SLOTS = ['top', 'bottom', 'dress', 'circlet', 'earring', 'necklace', 'glove', 'shoes'];

// 옷장 슬롯 메타 (UI 탭 순서/라벨)
// gated: true → 잠금/해금 대상 (starter 아이템만 처음 보유, 나머지는 획득 필요)
const WARDROBE_SLOTS = [
  { slot: 'hair',      label: '헤어',    emoji: '💇', gated: true },
  { slot: 'hairColor', label: '헤어컬러', emoji: '🎨', gated: true },
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
  dailyFill: 1000,
  cost: { gather: 10, brew: 25 },
  // 현자의 결정으로 AP 를 가득 채우는 값.
  // **무한 AP 가 되지 않게 잡은 수치다** — 실패 한 번(조합 25 AP)에 결정 10 개이므로
  // 1000 개를 모으려면 100 번 실패해야 하고, 그동안 2500 AP 를 쓴다.
  // 결정 하나가 AP 하나보다 값이 나가면(실패당 25 개 이상) 일부러 실패해서
  // AP 를 무한히 버는 고리가 생긴다. 수치를 바꿀 때 이 관계를 먼저 볼 것.
  chargeCost: 1000,   // 충전 1회에 드는 현자의 결정
  failReward: 10,     // 조합 실패 1회에 주는 현자의 결정
};

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
  INGREDIENTS, ZONES, MAPS, SPECIAL_RATE, zoneUnlock, CAULDRONS, RECIPES, RECIPE_MAP, CRYSTAL, TIERS,
  WARDROBE, WARDROBE_SLOTS, DEFAULT_OUTFIT, ENERGY, RECIPE_CATS, RECIPE_GRADES,
  COLORS, COLORABLE_SLOTS,
  getTier, recipeKey,
};
