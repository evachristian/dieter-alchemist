// 우편 검사 — 서버 시계를 옮겨 놓고 (MAIL.md 8-1b) · `npm test` 가 돈다
//
// 엔진(server/mail.js)은 순수 함수라 시계를 «넘겨» 잰다. API 는 메모리 저장소로 한 바퀴 돈다.
// ⚠️ 기기 시계는 어디에도 안 나온다 — 우편일은 서버 시각에서만 나온다.
const M = require('./mail');
const D = require('./battle').D;

const out = [];
const ok = (c, m) => { out.push((c ? '  OK  ' : '  !!  ') + m); if (!c) process.exitCode = 1; };
const PID = 'p_mailtest_aaaaaaaaaaaa';
const H = 3600000;
// KST 의 그 날 그 시각(ms)
const kst = (y, m, d, h = 9, mi = 0) => Date.UTC(y, m - 1, d, h, mi) - 9 * H;
const grad = (extra = {}) => Object.assign({ tutorialDone: true, seenCuts: [], bond: {}, charmPeak: 0 }, extra);

(async () => {
  out.push('── 우편일 · 05:00 경계 (KST)');
  {
    const a = M.mailDay(kst(2027, 3, 2, 4, 59)), b = M.mailDay(kst(2027, 3, 2, 5, 0));
    const c = M.cal(b);
    ok(b - a === 1 && c.m === 3 && c.d === 2, `04:59 KST 는 어제 · 05:00 은 오늘 (${M.cal(a).d} → ${c.d})`);
    ok(M.mailDay(kst(2026, 10, 2, 9)) - M.mailDay(kst(2026, 9, 28, 9)) === 4, '9/28 → 10/2 는 4일 (달을 넘어도)');
    ok(M.mailDay(kst(2027, 1, 1, 6)) - M.mailDay(kst(2026, 12, 31, 6)) === 1, '12/31 → 1/1 은 하루 (해를 넘어도)');
  }

  out.push('── 달력 — 부활절 · 추수감사절');
  {
    // 서방 교회력 부활절 (알려진 값)
    const E = { 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21], 2031: [4, 13], 2032: [3, 28], 2033: [4, 17], 2034: [4, 9], 2035: [3, 25] };
    const bad = Object.entries(E).filter(([y, [m, d]]) => { const e = M.easter(+y); return e.m !== m || e.d !== d; });
    ok(!bad.length, `부활절 2027~2035 아홉 해가 표와 같다${bad.length ? ' — 틀림 ' + bad.map(x => x[0]).join(',') : ''}`);
    const T = { 2026: 26, 2027: 25, 2028: 23, 2029: 22, 2030: 28 };
    const badT = Object.entries(T).filter(([y, d]) => M.thanksgiving(+y).d !== d);
    ok(!badT.length, '추수감사절 = 11월 넷째 목요일 (2026~2030)');
  }

  out.push('── 트랙 — 얻는 길은 꼭 하나 (MAIL.md 4-1)');
  {
    const paths = new Map(); const add = (id, w) => paths.set(id, [...(paths.get(id) || []), w]);
    Object.entries(M.TRACKS.people).forEach(([k, l]) => l.forEach(id => add(id, k)));
    M.TRACKS.sys.forEach(id => add(id, 'sys'));
    Object.entries(M.TRACKS.att).forEach(([k, l]) => l.forEach(id => add(id, 'att.' + k)));
    M.ORIX_TIER.forEach(id => add(id, 'orix'));
    add('shoes_maryjane', 'tutorial');
    (D.QUESTS || []).forEach(q => ((q.reward && q.reward.wear) || []).forEach(id => add(id, 'quest.' + q.id)));
    D.MOM_WEAR.forEach(it => add(it.id, 'mom'));
    const gated = D.WARDROBE_SLOTS.filter(m => m.gated)
      .flatMap(m => (D.WARDROBE[m.slot] || []).filter(it => it.kind !== 'none' && !it.starter)).map(it => it.id)
      .concat(D.COLORS.map(c => c.id));
    const none = gated.filter(id => !paths.has(id));
    const two = [...paths].filter(([, v]) => v.length > 1);
    ok(gated.length > 250 && !none.length && !two.length,
      `${gated.length}개 — 길 없음 ${none.length} · 길 둘 ${two.length}${none.length ? ' ' + none.slice(0, 5) : ''}${two.length ? ' ' + JSON.stringify(two.slice(0, 3)) : ''}`);
    const momInTracks = D.MOM_WEAR.filter(it => [...Object.values(M.TRACKS.people), ...Object.values(M.TRACKS.att), M.TRACKS.sys].some(l => l.includes(it.id)));
    ok(D.MOM_WEAR.length === 10 && !momInTracks.length, `엄마의 물건 열 벌은 엄마의 편지에만 (${D.MOM_WEAR.length})`);
  }

  out.push('── 출석 · 부재');
  {
    let rec = null; const st = grad();
    const t0 = kst(2027, 3, 1, 9);
    let r = M.deliver(rec, st, PID, t0); rec = r.rec;
    const att = () => rec.box.filter(m => m.k === 'att').length;
    ok(att() === 1, `첫 요청 → 출석 한 통 (${att()})`);
    r = M.deliver(rec, st, PID, t0 + 2 * H); rec = r.rec;
    ok(att() === 1, '같은 우편일에 두 번 → 그대로 한 통');
    r = M.deliver(rec, st, PID, kst(2027, 3, 2, 4, 59)); rec = r.rec;
    ok(att() === 1, '다음 날 04:59 → 아직 어제');
    r = M.deliver(rec, st, PID, kst(2027, 3, 2, 5, 0)); rec = r.rec;
    ok(att() === 2 && rec.att === 2, '다음 날 05:00 → 한 통 더');
    // 사흘 비우고 오면 출석은 한 통 · 부재 묶음은 클레멘(부엌 전이면 요정 대모)
    r = M.deliver(rec, st, PID, kst(2027, 3, 5, 9)); rec = r.rec;
    const away = rec.box.filter(m => m.k === 'away');
    ok(att() === 3, `사흘 비우고 와도 출석은 한 통 (몰아 주지 않는다 · ${att()})`);
    ok(away.length === 1 && away[0].from === 'sp_althea', `3일 → 부엌 전이라 요정 대모 한 통 (${away.map(m => m.from)})`);
    ok(away[0].sentDay < M.mailDay(kst(2027, 3, 5, 9)), '부재 편지의 보낸 날은 과거다');
    r = M.deliver(rec, st, PID, kst(2027, 3, 5, 20)); rec = r.rec;
    ok(rec.box.filter(m => m.k === 'away').length === 1, '같은 귀환에 두 번 물어도 한 번');
    // 20일 비움 + 친함 둘 + 부엌 → 14 묶음 «하나»: 요정 대모 + 클레멘 + 친함 모두
    const st2 = grad({ seenCuts: ['c_meet_in'], bond: { sp_orix: 30, sp_kairos: 60, sp_stark: 5 } });
    r = M.deliver(rec, st2, PID, kst(2027, 3, 25, 9)); rec = r.rec;
    const away2 = rec.box.filter(m => m.k === 'away').slice(1).map(m => m.from).sort();
    ok(JSON.stringify(away2) === JSON.stringify(['sp_althea', 'sp_clemen', 'sp_kairos', 'sp_orix']),
      `20일 → 14 묶음 하나 (요정 대모 · 클레멘 · 친함 이상 모두 · 안면은 빠짐): ${away2}`);
    const twoDay = M.deliver(M.deliver(null, st, PID, kst(2027, 3, 1)).rec, st, PID, kst(2027, 3, 3)).rec;
    ok(!twoDay.box.some(m => m.k === 'away'), '2일 → 부재 없음');
    // 처음 레코드를 만든 날은 부재가 아니다 (lastDay 가 없다)
    ok(!M.deliver(null, st2, PID, kst(2027, 3, 1)).rec.box.some(m => m.k === 'away'), '처음 켠 날 부재 묶음 없음');
    // 졸업 전에는 아무것도 없다
    ok(!M.deliver(null, { tutorialDone: false }, PID, kst(2027, 3, 1)).rec.box.length, '졸업 전에는 우편이 없다');
  }

  out.push('── 반짝이 덤 · 씨앗');
  {
    const a = M.deliver(null, grad(), PID, kst(2027, 5, 1)).rec.box[0];
    const b = M.deliver(null, grad(), PID, kst(2027, 5, 1)).rec.box[0];
    ok(JSON.stringify(a.gifts) === JSON.stringify(b.gifts), '같은 사람·같은 날 = 같은 덤');
    // 300일 연속 출석 — 덤 비율과 천장
    let rec = null, streak = 0, maxStreak = 0, sparks = 0;
    for (let i = 0; i < 300; i++) {
      rec = M.deliver(rec, grad(), PID, kst(2027, 1, 1) + i * M.DAY).rec;
      const m = rec.box[rec.box.length - 1];
      if (m.k !== 'att') { /* 엄마의 편지 등 */ }
      const last = rec.box.filter(x => x.k === 'att').pop();
      if (last.vars.spark) { sparks++; streak = 0; } else { streak++; maxStreak = Math.max(maxStreak, streak); }
      rec.box = []; rec.auto = [];
    }
    ok(maxStreak <= M.SPARK_PITY, `덤 없는 날이 ${M.SPARK_PITY}일을 안 넘는다 (최장 ${maxStreak})`);
    ok(sparks / 300 > 0.28 && sparks / 300 < 0.5, `덤 비율 ${(sparks / 3).toFixed(0)}% (30% + 천장)`);
  }

  out.push('── 엄마의 편지');
  {
    // 3/1 졸업 · 생일 6/15 → 3/2 첫 공방 · 3/28 부활절 · 4/1 매달 1 · 6/15 생일
    const st = grad({ birthday: '06-15' });
    let rec = null; const kinds = [];
    for (let i = 0; i < 320; i++) {
      rec = M.deliver(rec, st, PID, kst(2027, 3, 1, 9) + i * M.DAY).rec;
      rec.box.filter(m => m.k === 'mom').forEach(m => kinds.push(M.cal(m.day).m + '/' + M.cal(m.day).d + ':' + m.key));
      rec.box = [];
    }
    ok(kinds[0] === '3/2:ml_mom_first', `첫 공방은 졸업 다음 날 (${kinds[0]})`);
    ok(kinds.includes('3/28:ml_mom_easter'), '부활절 3/28 (2027)');
    ok(kinds.includes('4/1:ml_mom_m1'), '매달 1일');
    ok(kinds.includes('6/15:ml_mom_bday1'), '생일 6/15');
    ok(kinds.includes('11/25:ml_mom_thanks'), '추수감사절 11/25 (2027)');
    ok(kinds.includes('12/25:ml_mom_xmas'), '크리스마스');
    const perDay = new Map(); kinds.forEach(k => perDay.set(k.split(':')[0], (perDay.get(k.split(':')[0]) || 0) + 1));
    ok([...perDay.values()].every(n => n === 1), '하루에 엄마의 편지는 한 통');
    // 조건부(첫 선물 · 첫 친구)가 첫 공방 편지와 같은 날 겹치지 않는다 — 하루에 하나씩 밀린다
    {
      const stC = grad({ bond: { sp_orix: 30 } });
      let rc = null; const per = new Map();
      for (let i = 0; i < 6; i++) { rc = M.deliver(rc, stC, PID, kst(2027, 3, 1, 9) + i * M.DAY).rec; rc.box.filter(m => m.k === 'mom').forEach(m => per.set(m.day, [...(per.get(m.day) || []), m.key])); rc.box = []; }
      const days = [...per.values()];
      ok(days.every(v => v.length === 1) && days.flat().includes('ml_mom_gift') && days.flat().includes('ml_mom_friend'),
        `조건부도 하루 한 통 (${days.map(v => v.join('+')).join(' / ')})`);
    }
    // 겹치는 날 — 1/1 은 새해가 매달 편지를 이긴다
    ok(kinds.some(k => k.startsWith('1/1:ml_mom_newyear')) && !kinds.some(k => k.startsWith('1/1:ml_mom_m')), '1/1 은 새해 편지 (매달은 밀린다)');
    // 생일이 없으면 «공방에 온 날»이 생일
    let r2 = null; const k2 = [];
    for (let i = 0; i < 370; i++) { r2 = M.deliver(r2, grad(), PID, kst(2027, 3, 1, 9) + i * M.DAY).rec; r2.box.filter(m => m.k === 'mom').forEach(m => k2.push(M.cal(m.day).m + '/' + M.cal(m.day).d + ':' + m.key)); r2.box = []; }
    ok(k2.includes('3/1:ml_mom_bday1'), `생일이 없으면 공방에 온 날 (${k2.filter(k => k.includes('bday'))})`);
    // 2/29 생일 → 평년에는 2/28
    let r3 = null; const k3 = [];
    for (let i = 0; i < 430; i++) { r3 = M.deliver(r3, grad({ birthday: '02-29' }), PID, kst(2027, 1, 10, 9) + i * M.DAY).rec; r3.box.filter(m => m.k === 'mom').forEach(m => k3.push(M.cal(m.day).m + '/' + M.cal(m.day).d + ':' + m.key)); r3.box = []; }
    ok(k3.includes('2/28:ml_mom_bday1') && k3.includes('2/29:ml_mom_bday2'), `2/29 생일 — 평년 2/28 · 윤년 2/29 (${k3.filter(k => k.includes('bday'))})`);
    // 엔딩 뒤 — 생일만 · 스무 해에서 끝 · 「우리 공주 그위리엘」
    const stE = grad({ birthday: '06-15', seenCuts: ['c_epilogue'] });
    let r4 = null; const k4 = []; let addr = new Set();
    for (let y = 0; y < 25; y++) {
      for (const [m, d] of [[6, 14], [6, 15], [6, 16], [12, 25], [1, 1]]) {
        r4 = M.deliver(r4, stE, PID, kst(2027 + y, m, d, 9)).rec;
        r4.box.filter(x => x.k === 'mom').forEach(x => { k4.push(x.key); addr.add(x.vars.addr); });
        r4.box = [];
      }
    }
    const bd = k4.filter(k => /bday/.test(k));
    ok(bd.length === M.MOM_BDAY_MAX && bd[19] === 'ml_mom_bday20', `엔딩 뒤 생일 편지는 스무 해에서 끝 (${bd.length})`);
    ok(!k4.some(k => /xmas|newyear|easter|thanks|_m\d/.test(k)), '엔딩 뒤에는 생일·진실 편지만');
    ok(k4.includes('ml_mom_truth'), '엔딩을 보면 진실 편지 (조건부)');
    ok(addr.size === 1 && addr.has('g'), '엔딩 뒤 편지는 「우리 공주 그위리엘」');
    // 비운 날의 편지도 그 날짜로 쌓인다
    let r5 = M.deliver(null, grad({ birthday: '06-15' }), PID, kst(2027, 3, 1, 9)).rec;
    r5 = M.deliver(r5, grad({ birthday: '06-15' }), PID, kst(2027, 7, 3, 9)).rec;
    const moms = r5.box.filter(m => m.k === 'mom').map(m => m.key);
    ok(moms.includes('ml_mom_first') && moms.includes('ml_mom_m3') && moms.includes('ml_mom_bday1'), `넉 달 비워도 그동안의 엄마 편지가 그 날짜로 (${moms.length}통)`);
  }

  out.push('── 사람 · 시스템');
  {
    const st = grad({ seenCuts: ['c_meet_in'], bond: { sp_orix: 30 }, charmPeak: 40 });
    let rec = null; const from = [];
    for (let i = 0; i < 60; i++) { rec = M.deliver(rec, st, PID, kst(2027, 3, 1, 9) + i * M.DAY).rec; rec.box.forEach(m => from.push(m.k + ':' + m.from)); rec.box = []; }
    ok(from.includes('npc:sp_althea') && from.includes('npc:sp_clemen') && from.includes('npc:sp_orix'), '요정 대모 · 클레멘 · 친함인 오릭스가 편지를 보낸다');
    ok(!from.includes('npc:sp_kairos'), '안 친한 사람은 안 보낸다');
    ok(from.filter(f => f === 'sys:scribe').length === 2, '매력 40 → 시스템 우편 둘 (15 · 35)');
  }

  out.push('── 받기 — 멱등');
  {
    let rec = M.deliver(null, grad(), PID, kst(2027, 3, 1)).rec;
    const id = rec.box[0].id;
    let c1 = M.claim(rec, [id], 'nonce_aaaaaa'); rec = c1.rec;
    const c2 = M.claim(rec, [id], 'nonce_aaaaaa');
    const c3 = M.claim(c2.rec, [id], 'nonce_bbbbbb');
    ok(c1.out.gifts.length > 0 && JSON.stringify(c1.out) === JSON.stringify(c2.out), '같은 nonce 두 번 = 같은 선물 목록');
    ok(c3.out.gifts.length === 0, '다른 nonce 로 이미 받은 우편 = 빈 목록');
    ok(rec.box.length === 0 && rec.letters.length === 1, '받은 우편은 편지첩으로');
  }

  out.push('── API (메모리 저장소)');
  {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    delete process.env.DATABASE_URL; delete process.env.DATA_DIR;
    const { app, store } = require('./index.js');
    const srv = app.listen(0); await new Promise(r => srv.once('listening', r));
    const base = 'http://127.0.0.1:' + srv.address().port;
    const J = async (method, url, body, sec) => {
      const r = await fetch(base + url, { method, headers: Object.assign({}, body ? { 'Content-Type': 'application/json' } : {}, sec ? { 'X-Secret': sec } : {}), body: body ? JSON.stringify(body) : undefined });
      let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j };
    };
    const ID = 'p_' + 'm'.repeat(20), SEC = 'm'.repeat(32);
    await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 1, state: { tutorialDone: true, bond: {}, charmPeak: 0 } });
    let r = await J('GET', `/api/mail/${ID}`, null, SEC);
    ok(r.status === 200 && r.body.box.length === 1, `GET → 출석 한 통 (${r.status} · ${r.body && r.body.box && r.body.box.length})`);
    const id = r.body.box[0].id;
    // 저장이 우편을 안 지운다 (저장소가 옮겨 담는다)
    await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 2, state: { tutorialDone: true, bond: {}, charmPeak: 0 } });
    r = await J('GET', `/api/mail/${ID}`, null, SEC);
    ok(r.body.box.length === 1 && r.body.box[0].id === id, 'PUT /api/save 가 우편함을 안 지운다');
    r = await J('POST', `/api/mail/${ID}/claim`, { secret: SEC, nonce: 'claim_1234', ids: [id] });
    const again = await J('POST', `/api/mail/${ID}/claim`, { secret: SEC, nonce: 'claim_1234', ids: [id] });
    ok(r.status === 200 && r.body.gifts.length > 0 && JSON.stringify(r.body.gifts) === JSON.stringify(again.body.gifts), '받기 → 선물 목록 · 같은 nonce 면 같은 답');
    r = await J('GET', `/api/mail/${ID}`, null, 'z'.repeat(32));
    ok(r.status === 403, `틀린 비밀키 → ${r.status}`);
    // 개발용 시계 — 하루 옮기면 한 통 더
    await J('POST', `/api/mail/${ID}/dev`, { secret: SEC, days: 1 });
    r = await J('GET', `/api/mail/${ID}`, null, SEC);
    ok(r.body.box.some(m => m.k === 'att'), '개발용 시계를 하루 옮기면 다음 출석');
    await new Promise(x => srv.close(x));
    void store;
  }
  {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    process.env.DEV_TOOLS = '0';
    const { app } = require('./index.js');
    const srv = app.listen(0); await new Promise(r => srv.once('listening', r));
    const r = await fetch('http://127.0.0.1:' + srv.address().port + `/api/mail/p_${'q'.repeat(20)}/dev`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'q'.repeat(32), days: 1 }) });
    ok(r.status === 404, `DEV_TOOLS=0 이면 우편 시계 → ${r.status}`);
    await new Promise(x => srv.close(x));
    delete process.env.DEV_TOOLS;
  }

  console.log(out.join('\n'));
  console.log(process.exitCode ? '\n우편 검사에 실패가 있습니다.' : '\n우편 검사 전부 통과 ✅');
})();
