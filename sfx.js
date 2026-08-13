// ═══════════════════════════════════════════════════════════════
//  효과음 (WebAudio 합성 — 외부 음원 파일 없이 동작)
//  설정 팝업의 '사운드' On/Off 와 연동. 기본값 On.
// ═══════════════════════════════════════════════════════════════
(function () {
  const SOUND_KEY = 'dieter_alchemist_sound_v1';

  // 기본 On (저장값이 '0' 일 때만 Off)
  let on = true;
  try { on = localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) {}

  let ctx = null, noiseBuf = null;
  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    // 브라우저 정책상 사용자 조작 전에는 suspended 상태 → 조작 시 깨움
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // ─── 기본 음원 빌더 ───
  function tone(freq, dur, type = 'sine', gain = 0.08, when = 0, freqTo = null) {
    if (!on) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noiseBuffer(c) {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(c.sampleRate * 1.2);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // 노이즈 버스트 (숨소리 / 폭발 / 바스락)
  function noise(dur, gain = 0.08, when = 0, filter = 'bandpass', freq = 900, q = 1, freqTo = null) {
    if (!on) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const bq = c.createBiquadFilter();
    bq.type = filter; bq.frequency.setValueAtTime(freq, t); bq.Q.value = q;
    if (freqTo) bq.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq); bq.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ─── 이름별 효과음 ───
  const BANK = {
    // UI
    success() { tone(523, 0.12, 'triangle', 0.09, 0); tone(659, 0.12, 'triangle', 0.09, 0.1); tone(784, 0.22, 'triangle', 0.09, 0.2); },
    fail()    { tone(196, 0.25, 'sawtooth', 0.06, 0); tone(147, 0.30, 'sawtooth', 0.06, 0.12); },
    pick()    { tone(660, 0.08, 'sine', 0.06); },

    // ── UI 버튼음 (짧고 작게 — 다른 효과음을 가리지 않도록) ──
    ui_tap()     { tone(1180, 0.045, 'triangle', 0.042); tone(1980, 0.035, 'sine', 0.018, 0.012); },
    ui_tab()     { tone(880, 0.05, 'triangle', 0.040); tone(1320, 0.07, 'sine', 0.026, 0.03); },
    ui_confirm() { tone(784, 0.055, 'triangle', 0.045); tone(1175, 0.10, 'sine', 0.032, 0.05); },
    ui_back()    { tone(660, 0.055, 'triangle', 0.038); tone(440, 0.10, 'sine', 0.030, 0.045); },
    click()      { BANK.ui_tap(); },

    // 인트로 — 치킨 먹는 소리 "냠냠냠…"
    chew() {
      for (let i = 0; i < 3; i++) {
        const w = i * 0.26;
        noise(0.13, 0.07, w, 'lowpass', 620, 0.8, 300);
        tone(150 - i * 8, 0.14, 'sine', 0.05, w, 96);
      }
    },
    // 요정 등장 / 반짝임
    sparkle() {
      tone(1318, 0.10, 'sine', 0.05, 0);
      tone(1760, 0.10, 'sine', 0.045, 0.08);
      tone(2093, 0.20, 'sine', 0.04, 0.16);
    },
    // 이마에 땀 — 뚝
    sweat() {
      tone(420, 0.16, 'sine', 0.05, 0, 180);
      noise(0.07, 0.03, 0.02, 'bandpass', 1400, 3);
    },
    // 놀람 "허억?!"
    gasp() {
      noise(0.32, 0.09, 0, 'bandpass', 700, 1.2, 2000);   // 숨 들이켜는 소리
      tone(300, 0.30, 'sine', 0.05, 0.02, 720);           // 올라가는 억양
      tone(880, 0.09, 'triangle', 0.05, 0.34);            // 물음표 "?"
    },
    // 지팡이로 톡
    tap() {
      tone(1600, 0.07, 'triangle', 0.06, 0);
      tone(2400, 0.12, 'sine', 0.04, 0.04);
    },
    // 마법 시전
    magic() {
      tone(330, 0.55, 'sine', 0.05, 0, 1400);
      noise(0.55, 0.045, 0, 'bandpass', 500, 1.5, 3000);
      tone(1046, 0.18, 'triangle', 0.04, 0.4);
    },
    // 텔레포트 "펑!"
    pop() {
      noise(0.30, 0.13, 0, 'lowpass', 2200, 0.7, 200);
      tone(180, 0.30, 'sine', 0.10, 0, 48);
      tone(1200, 0.10, 'triangle', 0.05, 0);
      tone(1568, 0.22, 'sine', 0.035, 0.10);
    },
    // 어질어질
    dizzy() {
      tone(500, 0.5, 'sine', 0.04, 0, 300);
      tone(300, 0.5, 'sine', 0.035, 0.1, 520);
    },
    // 가마솥 등장 — 보글보글
    bubble() {
      tone(120, 0.4, 'sine', 0.07, 0, 220);
      for (let i = 0; i < 5; i++) tone(320 + i * 90, 0.09, 'sine', 0.035, 0.16 + i * 0.11, 640 + i * 60);
    },
  };

  const SFX = {
    play(name) {
      if (!on) return;
      const fn = BANK[name];
      if (fn) { try { fn(); } catch (e) {} }
    },
    isOn() { return on; },
    setOn(v) {
      on = !!v;
      try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) {}
      if (on) { ac(); SFX.play('click'); }
    },
    toggle() { SFX.setOn(!on); return on; },
    // 첫 사용자 조작에서 오디오 컨텍스트를 깨우기 위한 훅
    unlock() { if (on) ac(); },
    SOUND_KEY,
  };

  // 첫 터치/클릭/키 입력 때 한 번 오디오 컨텍스트 활성화
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, function once() {
      SFX.unlock();
      window.removeEventListener(ev, once);
    }, { passive: true }));

  // ─── 모든 UI 버튼에 버튼음 (이벤트 위임 — 나중에 그려지는 버튼도 자동 적용) ───
  // 소리를 넣고 싶지 않은 요소에는 data-nosfx 속성을 달면 됨
  const TAP_SEL = [
    'button', '.tab-btn', '[role="button"]', '[data-sfx]',
    '.spot-card', '.c-slot', '.ing-chip', '.potion-card',
    '.empty-hint.clickable', '.bag-toggle', '.wr-item', '.set-opt',
    '.stat-box[onclick]',
  ].join(',');

  function uiSound(el) {
    if (el.dataset && el.dataset.sfx) return el.dataset.sfx;   // 개별 지정 우선
    const c = el.classList;
    if (c.contains('tab-btn')) return 'ui_tab';
    if (c.contains('btn-primary')) return 'ui_confirm';
    if (c.contains('btn-ghost') || c.contains('set-x') || c.contains('i-skip')) return 'ui_back';
    return 'ui_tap';
  }

  // pointerdown 시점에 재생 → 누르는 즉시 반응하고, 결과음(성공/실패)보다 먼저 들림
  document.addEventListener('pointerdown', function (e) {
    if (!on) return;
    const t = e.target;
    if (!t || !t.closest) return;
    // 모달 딤 영역 터치 = 닫기
    if (t.classList && t.classList.contains('modal')) { SFX.play('ui_back'); return; }
    const el = t.closest(TAP_SEL);
    if (!el || el.disabled) return;
    if (el.hasAttribute('data-nosfx') || el.closest('[data-nosfx]')) return;
    SFX.play(uiSound(el));
  }, true);

  window.Sfx = SFX;
})();
