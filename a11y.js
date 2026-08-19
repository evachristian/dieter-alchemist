// ═══════════════════════════════════════════════════════════════
//  텍스트 스타일 정책 검증기
//  TEXT_POLICY.md 에 정리된 규칙을 실제 화면에서 자동으로 검사한다.
//
//  사용법
//    checkTextStyle()            현재 보이는 화면 검사 → 콘솔 표 + 결과 반환
//    checkTextStyle({ all:true }) 숨겨진 화면(다른 탭/모달)까지 강제로 검사
//    URL 에 ?a11y=1 을 붙이면 로드 직후 자동 실행
//
//  재기 전에 끝이 있는 애니메이션·트랜지션을 모두 끝 상태로 보낸다(settle).
//  화면이 페이드 인 도중이면 글자가 배경에 묻혀 대비가 1.00 으로 나오기 때문이다.
//  애니메이션을 살려 둔 채 재려면 `{ settle:false }`.
// ═══════════════════════════════════════════════════════════════
(function () {
  // ─── 정책 상수 (TEXT_POLICY.md 와 반드시 일치) ───
  const POLICY = {
    // 대비 (WCAG 2.1)
    contrastNormal: 4.5,          // 일반 텍스트
    contrastLarge: 3.0,           // 큰 텍스트 (24px+ 또는 18.66px+ && bold)
    largePx: 24,
    largeBoldPx: 18.66,
    boldMin: 700,
    // 폰트
    minFontPx: 11,                // 이보다 작은 글씨 금지
    allowedWeights: [400, 500, 700, 800, 900],   // 실제로 로드한 웨이트만
    allowedFamily: 'Noto Sans KR',               // body 스택의 첫 폰트
    // 검사 제외
    //  · 장식용 그래픽/이모지 — 읽는 글자가 아님
    //  · 완전 비활성 컴포넌트 — WCAG 도 inactive 요소는 대비 요건에서 제외한다
    // 잠긴 요소(.locked)는 예외로 두지 않는다 — 흐리게 만든 뒤에도 읽혀야 하고,
    // 특히 '언제 열리는지' 안내는 잠긴 카드에서 유일하게 읽어야 하는 정보다.
    skipSelector: '[data-a11y-skip], .i-dot, .avatar-svg, svg, .brew-emoji, .spot-emoji,'
      + ' .wr-tab.dim, [disabled], [aria-disabled="true"]',
    // 잠금 표현 (UI_POLICY 7장)
    lockedSelector: '.spot-card.locked, .cat-tab.locked, .wr-item.locked, .room-tab.locked',
    lockMaxSaturate: 0.4,     // 이보다 채도가 높으면 '잠김'으로 안 보인다
    lockMaxOpacity: 0.92,     // 살짝이라도 투명해야 뒤로 물러나 보인다
    lockMinOpacity: 0.7,      // 그렇다고 글자를 못 읽을 만큼 흐리면 안 된다
  };

  // 이모지만으로 이루어진 글자는 대비 검사에서 제외한다.
  // 이모지는 색을 스스로 가진 그림 글자라 CSS color 가 적용되지 않는다 —
  // 대비를 재도 의미가 없다. (✕ · → 같은 단색 기호는 색이 먹으므로 그대로 검사한다)
  const PICTO = /\p{Extended_Pictographic}/u;
  const PICTO_ONLY = /^[\s\u200D\uFE0E\uFE0F\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}]+$/u;
  function pictogramOnly(text) { return PICTO.test(text) && PICTO_ONLY.test(text); }

  // ─── 색 계산 ───
  function parseColor(str) {
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function luminance(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(fg, bg) {
    const l1 = luminance(fg), l2 = luminance(bg);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  // 반투명 전경색을 배경 위에 합성
  function over(fg, bg) {
    if (fg.a >= 1) return fg;
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    };
  }
  function hexOf(c) {
    const h = v => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }

  // 조상을 거슬러 올라가며 실제로 눈에 보이는 배경색을 합성한다.
  // 그라데이션/이미지가 깔린 경우엔 정확한 값을 알 수 없으므로 approx 로 표시.
  function effectiveBg(el) {
    let acc = null, approx = false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') approx = true;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 1) return { color: acc, approx };
      }
    }
    // 여기까지 왔다는 건 불투명한 배경을 끝내 못 만났다는 뜻이다 — 흰색은 '측정값' 이 아니라
    // 가정이므로 반드시 추정으로 표시한다. (예전에는 실측 흰색과 구분이 안 돼
    // "실측인데 #ffffff/#ffffff" 처럼 보였다)
    const white = { r: 255, g: 255, b: 255, a: 1 };
    return { color: acc ? over(acc, white) : white, approx: true };
  }

  // ─── 측정 조건 ───
  // 대비는 '다 그려진 화면' 에서만 의미가 있다. 페이드 인 도중에 재면 글자가 배경에
  // 묻힌 값이 나와 멀쩡한 화면이 위반으로 잡힌다. 특히 창이 숨겨지거나 백그라운드면
  // 프레임 시계가 멈춰 `.screen` 의 fade 가 **첫 프레임(불투명도 0)에 그대로 서 있고**,
  // 그 화면의 글자가 통째로 '흰 글자 / 흰 배경 / 대비 1.00' 으로 보고됐다 (78건짜리 유령).
  //
  // 그래서 재기 전에 끝이 있는 애니메이션·트랜지션을 전부 끝 상태로 보낸다.
  // 프레임이 안 도는 환경에서도 즉시 반영되므로 측정 조건이 결정적으로 정해진다.
  // 무한 반복(장식용 반짝임 등)은 끝이 없으니 건드리지 않는다.
  function settle() {
    if (typeof document.getAnimations !== 'function') return 0;
    let n = 0;
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getComputedTiming();
      if (!t || t.iterations === Infinity) continue;
      try { a.finish(); n++; } catch (e) { /* 끝낼 수 없는 것은 그대로 둔다 */ }
    }
    return n;
  }

  // 이 아래로는 사람 눈에 안 보이는 것으로 친다 (읽을 수 없으니 대비를 따질 대상도 아니다)
  const INVISIBLE = 0.01;

  // 잴 수 있는 상태인가 — 창이 접혀 폭이 0 이면 모든 요소가 부모 밖으로 나간 것처럼 보이고
  // (넘침 22건이 그렇게 나왔다) 글자는 자리를 못 잡아 검사에서 통째로 빠진다.
  // 0건이 '통과' 로 보이는 게 더 위험하므로 아예 잴 수 없다고 알린다.
  function measurable(kind) {
    const de = document.documentElement;
    const w = Math.min(window.innerWidth, de.clientWidth);
    const h = Math.min(window.innerHeight, de.clientHeight);
    if (w > 0 && h > 0) return true;
    console.warn(`[${kind}] 창 크기가 ${w}×${h} 라 잴 수 없다 — 창을 띄운 뒤 다시 실행할 것`);
    return false;
  }
  const unmeasurable = () => ({ pass: false, unmeasurable: true, count: 0, rows: [], hiddenByOpacity: 0 });

  // 요소가 자기 자신의 텍스트를 직접 가지고 있는가 (자식 요소의 글자는 제외)
  function ownText(el) {
    let s = '';
    for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue;
    return s.trim();
  }
  // 보이는가 — **조상까지 본다.** 자기 opacity 가 1이어도 조상이 투명하면 화면에 없는 글자다.
  // (getClientRects 는 opacity: 0 인 요소도 자리를 차지하므로 그것만으로는 판정할 수 없다)
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (effectiveOpacity(el) <= INVISIBLE) return false;
    return el.getClientRects().length > 0;
  }
  // 조상까지 곱해진 실효 opacity (반투명하게 흐려진 글씨도 잡아내기 위함)
  function effectiveOpacity(el) {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || 1);
    return o;
  }

  function checkTextStyle(opts) {
    opts = opts || {};
    if (!measurable('텍스트 정책')) return unmeasurable();
    if (opts.settle !== false) settle();   // 재기 전에 화면을 끝난 상태로 맞춘다
    const rows = [];
    const seen = new Set();
    const nodes = document.querySelectorAll('body *');
    let hiddenByOpacity = 0;   // 자리는 잡았는데 조상이 투명해서 안 보이는 글자 (측정 조건 경고용)

    for (const el of nodes) {
      if (el.closest(POLICY.skipSelector)) continue;
      const text = ownText(el);
      if (!text) continue;
      if (!opts.all && !visible(el)) {
        const cs0 = getComputedStyle(el);
        if (cs0.display !== 'none' && cs0.visibility !== 'hidden' && el.getClientRects().length) hiddenByOpacity++;
        continue;
      }
      if (seen.has(el)) continue;
      seen.add(el);

      const cs = getComputedStyle(el);
      const sizePx = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const isLarge = sizePx >= POLICY.largePx || (sizePx >= POLICY.largeBoldPx && weight >= POLICY.boldMin);
      const need = isLarge ? POLICY.contrastLarge : POLICY.contrastNormal;

      const bgInfo = effectiveBg(el);
      let fg = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
      // 요소 자체의 opacity 로 흐려진 글씨는 배경과 섞인 것으로 계산
      const eo = effectiveOpacity(el);
      fg = over({ ...fg, a: fg.a * eo }, bgInfo.color);
      const ratio = contrast(fg, bgInfo.color);

      const issues = [];
      // 이모지만 있는 칸은 대비를 재지 않는다 (색을 스스로 가진 그림 글자)
      if (ratio < need && !pictogramOnly(text)) {
        issues.push(`대비 ${ratio.toFixed(2)}:1 (필요 ${need}:1)`);
      }
      if (sizePx < POLICY.minFontPx) {
        issues.push(`글자 ${sizePx.toFixed(1)}px (최소 ${POLICY.minFontPx}px)`);
      }
      if (POLICY.allowedWeights.indexOf(weight) < 0) {
        issues.push(`웨이트 ${weight} 미로드 (허용 ${POLICY.allowedWeights.join('/')})`);
      }
      if (cs.fontFamily.indexOf(POLICY.allowedFamily) < 0) {
        issues.push(`폰트 ${cs.fontFamily.split(',')[0]} (본문 스택 상속만 허용)`);
      }
      if (!issues.length) continue;

      rows.push({
        선택자: selectorOf(el),
        텍스트: text.length > 18 ? text.slice(0, 18) + '…' : text,
        글자색: hexOf(fg),
        배경색: hexOf(bgInfo.color) + (bgInfo.approx ? ' (추정)' : ''),
        대비: ratio.toFixed(2),
        크기: `${sizePx.toFixed(0)}px/${weight}`,
        위반: issues.join(', '),
        el,
      });
    }

    const pass = rows.length === 0;
    if (typeof console.table === 'function' && rows.length) {
      console.groupCollapsed(`[텍스트 정책] 위반 ${rows.length}건`);
      console.table(rows.map(({ el, ...r }) => r));
      console.groupEnd();
    } else if (pass) {
      console.log('[텍스트 정책] 위반 없음 ✅');
    }
    // 안 보여서 건너뛴 글자가 있으면 알려 준다 — 대개 다른 화면/닫힌 레이어라 정상이지만,
    // 지금 보고 있는 화면의 글자가 여기 잡힌다면 측정 조건이 잘못된 것이다
    if (hiddenByOpacity) {
      console.log(`[텍스트 정책] 투명한 조상에 가려 건너뛴 글자 ${hiddenByOpacity}건 `
        + '(닫힌 레이어면 정상. 보고 있는 화면이 통째로 여기 잡히면 측정 조건을 의심할 것)');
    }
    return { pass, count: rows.length, rows, hiddenByOpacity, policy: POLICY };
  }

  function selectorOf(el) {
    if (el.id) return '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }

  // ═══════════════════════════════════════════════════════════════
  //  레이아웃 검증 — 문구 길이가 달라져도 겹치거나 깨지지 않는가
  //  (언어를 추가하면 라벨 길이가 달라진다. UI_POLICY.md '가변 폭' 규칙)
  // ═══════════════════════════════════════════════════════════════
  const LAYOUT = {
    tolerance: 0.5,                       // 반올림 오차 허용 (px)
    // 검사 대상 — 눌리는 요소와 값이 바뀌는 텍스트
    targetSelector: 'button, .cat-tab, .set-opt, .room-tab, .tab-btn, .spot-card, .stat-box,'
      + ' .recipe-row, .wr-item, .ing-chip, .potion-card, .clock-item, .wr-count, .recipe-progress',
    // 넘쳐도 되는 곳 — 지금은 없다.
    // 예전에는 .cat-tabs 가 가로 스크롤이라 예외였는데, 줄바꿈으로 바뀌어
    // **넘치면 진짜 버그**가 됐다. 예외로 두면 그걸 가려 버린다.
    scrollerSelector: '',
  };

  function rectOf(el) { return el.getBoundingClientRect(); }
  function overlaps(a, b, tol) {
    return a.left < b.right - tol && b.left < a.right - tol
        && a.top < b.bottom - tol && b.top < a.bottom - tol;
  }
  function positioned(el) {
    const pos = getComputedStyle(el).position;
    return pos === 'absolute' || pos === 'fixed' || pos === 'sticky';
  }

  function checkLayout(opts) {
    opts = opts || {};
    if (!measurable('레이아웃')) return unmeasurable();
    if (opts.settle !== false) settle();   // 페이드 인 도중의 transform 으로 위치가 밀린 채 재지 않도록
    const tol = LAYOUT.tolerance;
    const found = [];
    const add = (kind, el, detail, level) =>
      found.push({ 종류: kind, 선택자: selectorOf(el), 텍스트: (ownText(el) || el.textContent || '').trim().slice(0, 16),
                   내용: detail, 수준: level || '위반', el });

    const targets = [...document.querySelectorAll(LAYOUT.targetSelector)].filter(visible);

    // ① 형제끼리 겹침 — 같은 부모 아래 나란히 놓인 요소는 절대 겹치면 안 된다
    const byParent = new Map();
    for (const el of targets) {
      if (positioned(el)) continue;
      const p = el.parentElement;
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(el);
    }
    for (const [, sibs] of byParent) {
      for (let i = 0; i < sibs.length; i++) {
        for (let j = i + 1; j < sibs.length; j++) {
          if (sibs[i].contains(sibs[j]) || sibs[j].contains(sibs[i])) continue;
          const a = rectOf(sibs[i]), b = rectOf(sibs[j]);
          if (overlaps(a, b, tol)) {
            add('겹침', sibs[i], `${selectorOf(sibs[j])} 와 겹침 (${Math.round(Math.min(a.right, b.right) - Math.max(a.left, b.left))}px)`);
          }
        }
      }
    }

    // ② 부모 밖으로 삐져나감 (가로 스크롤 컨테이너 안은 설계상 정상)
    for (const el of targets) {
      if (positioned(el)) continue;
      const p = el.parentElement;
      // scrollerSelector 가 비면 예외가 없다는 뜻 (빈 문자열을 closest 에 넘기면 예외를 던진다)
      if (!p || (LAYOUT.scrollerSelector && el.closest(LAYOUT.scrollerSelector))) continue;
      const pr = rectOf(p), r = rectOf(el);
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') continue;
      const padL = parseFloat(ps.paddingLeft) || 0, padR = parseFloat(ps.paddingRight) || 0;
      const over = Math.max(r.right - (pr.right - padR), (pr.left + padL) - r.left);
      if (over > tol) add('넘침', el, `부모(${selectorOf(p)}) 밖으로 ${Math.round(over)}px`);
    }

    // ③ 라벨 잘림 — 말줄임으로 버티고는 있지만 글자를 다 못 읽는 상태
    for (const el of targets) {
      if (getComputedStyle(el).whiteSpace !== 'nowrap') continue;
      const cut = el.scrollWidth - el.clientWidth;
      if (cut > 1) add('잘림', el, `라벨이 ${Math.round(cut)}px 잘림`, '주의');
    }

    // ④ 페이지 자체에 가로 스크롤이 생겼는가
    const de = document.documentElement;
    if (de.scrollWidth - de.clientWidth > 1) {
      found.push({ 종류: '가로스크롤', 선택자: '(문서)', 텍스트: '',
        내용: `문서가 뷰포트보다 ${de.scrollWidth - de.clientWidth}px 넓음`, 수준: '위반', el: document.body });
    }

    const violations = found.filter(f => f.수준 === '위반');
    if (found.length && typeof console.table === 'function') {
      console.groupCollapsed(`[레이아웃] 위반 ${violations.length}건 / 주의 ${found.length - violations.length}건`);
      console.table(found.map(({ el, ...r }) => r));
      console.groupEnd();
    } else if (!found.length) {
      console.log('[레이아웃] 이상 없음 ✅');
    }
    return { pass: violations.length === 0, count: violations.length, rows: found };
  }

  // 라벨을 인위적으로 늘려 '더 긴 언어'를 흉내 낸다 (되돌리는 함수를 반환)
  function stressLabels(factor) {
    const saved = [];
    for (const el of document.querySelectorAll(LAYOUT.targetSelector)) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue;
        if (!t || !t.trim()) continue;
        saved.push([n, t]);
        n.nodeValue = new Array(factor).fill(t.trim()).join(' ');
      }
    }
    return () => saved.forEach(([n, t]) => { n.nodeValue = t; });
  }

  // 모든 언어 + 라벨을 늘린 상태까지 한 번에 검사
  async function checkUI(opts) {
    opts = opts || {};
    const stress = opts.stress || 2;      // 기본: 라벨 길이 2배까지 견디는지
    // rAF 는 창이 숨겨지거나 백그라운드면 멈추고, 타이머도 1초 이상으로 늘어난다 —
    // 예전에는 여기서 영영 안 끝나 자동화가 통째로 멈췄다.
    // 언어를 바꾼 뒤의 다시 그리기는 동기라 프레임을 꼭 기다릴 필요가 없고,
    // 애니메이션 상태는 settle() 이 맞춰 주므로 프레임을 못 받아도 결과는 같다.
    const frame = () => {
      if (document.visibilityState === 'hidden') return Promise.resolve();
      return new Promise(r => {
        let done = false;
        const fin = () => { if (done) return; done = true; r(); };
        requestAnimationFrame(() => requestAnimationFrame(fin));
        setTimeout(fin, 150);
      });
    };
    const langs = (window.I18N ? I18N.langs().map(l => l.code) : ['ko']);
    const before = window.I18N ? I18N.getLang() : null;
    const report = [];
    let blocked = false;   // 잴 수 없는 조건이었나 (0건을 통과로 착각하지 않기 위해)

    for (const code of langs) {
      if (window.I18N) I18N.setLang(code);
      await frame();
      const text = checkTextStyle();
      const layout = checkLayout();
      const locked = checkLocked();
      if (text.unmeasurable || layout.unmeasurable || locked.unmeasurable) blocked = true;
      report.push({ 언어: code, 배율: '1x', 대비위반: text.count,
                    레이아웃위반: layout.count, 잠금표현위반: locked.count,
                    안보여서건너뜀: text.hiddenByOpacity });

      const restore = stressLabels(stress);
      await frame();
      const stressed = checkLayout();
      restore();
      await frame();
      report.push({ 언어: code, 배율: stress + 'x', 대비위반: '-',
                    레이아웃위반: stressed.count, 잠금표현위반: '-', 안보여서건너뜀: '-' });
      if (stressed.count) report.stressRows = (report.stressRows || []).concat(stressed.rows);
    }
    if (before && window.I18N) { I18N.setLang(before); await frame(); }

    const total = report.reduce((n, r) => n + (Number(r.대비위반) || 0)
      + (Number(r.레이아웃위반) || 0) + (Number(r.잠금표현위반) || 0), 0);
    console.table(report);
    if (blocked) console.warn('[UI 정책] 잴 수 없는 조건이었다 — 창을 띄운 뒤 다시 실행할 것 (0건은 통과가 아니다)');
    else console.log(total === 0 ? '[UI 정책] 전체 통과 ✅' : `[UI 정책] 총 ${total}건 확인 필요`);
    return { pass: !blocked && total === 0, total, blocked, report };
  }

  // ═══════════════════════════════════════════════════════════════
  //  잠금 표현 검증 — 잠긴 것이 열린 것과 눈에 띄게 달라 보이는가
  //  (UI_POLICY.md 7장. 자물쇠 아이콘만으로는 훑어볼 때 구분이 안 된다)
  // ═══════════════════════════════════════════════════════════════
  function saturateOf(el) {
    // filter 문자열에서 saturate()/grayscale() 을 읽어 실효 채도를 구한다
    const f = getComputedStyle(el).filter;
    if (!f || f === 'none') return 1;
    let s = 1;
    const sat = f.match(/saturate\(([\d.]+)(%?)\)/);
    if (sat) s *= parseFloat(sat[1]) / (sat[2] ? 100 : 1);
    const gray = f.match(/grayscale\(([\d.]+)(%?)\)/);
    if (gray) s *= 1 - parseFloat(gray[1]) / (gray[2] ? 100 : 1);
    return s;
  }

  function checkLocked(opts) {
    opts = opts || {};
    if (!measurable('잠금 표현')) return unmeasurable();
    if (opts.settle !== false) settle();
    const found = [];
    const els = [...document.querySelectorAll(POLICY.lockedSelector)]
      .filter(el => opts.all || visible(el));

    for (const el of els) {
      const sat = saturateOf(el);
      const op = effectiveOpacity(el);
      const issues = [];
      if (sat > POLICY.lockMaxSaturate && op > POLICY.lockMaxOpacity) {
        issues.push(`채도 ${sat.toFixed(2)} / 불투명도 ${op.toFixed(2)} — 둘 다 그대로라 잠겨 보이지 않음`);
      }
      if (op < POLICY.lockMinOpacity) {
        issues.push(`불투명도 ${op.toFixed(2)} — 너무 흐려 글자를 읽기 어려움 (최소 ${POLICY.lockMinOpacity})`);
      }
      // 자물쇠는 색에 의존하지 않는 신호라 반드시 있어야 한다
      if (!/🔒|🔐|잠김|Locked/i.test(el.textContent || '')) {
        issues.push('자물쇠 표시가 없음 — 색약 사용자에게 잠금이 전달되지 않음');
      }
      if (!issues.length) continue;
      found.push({ 선택자: selectorOf(el), 텍스트: (el.textContent || '').trim().slice(0, 16),
                   채도: sat.toFixed(2), 불투명도: op.toFixed(2), 위반: issues.join(', ') });
    }

    // 같은 종류의 '열린' 요소와 실제로 달라 보이는지도 확인
    for (const sel of POLICY.lockedSelector.split(',').map(s => s.trim())) {
      const base = sel.replace('.locked', '');
      const open = [...document.querySelectorAll(base)]
        .filter(e => !e.classList.contains('locked') && visible(e))[0];
      const lock = [...document.querySelectorAll(sel)].filter(e => visible(e))[0];
      if (!open || !lock) continue;
      if (saturateOf(open).toFixed(2) === saturateOf(lock).toFixed(2)
          && effectiveOpacity(open).toFixed(2) === effectiveOpacity(lock).toFixed(2)) {
        found.push({ 선택자: sel, 텍스트: '', 채도: '-', 불투명도: '-',
                     위반: `열린 ${base} 와 채도·불투명도가 똑같음` });
      }
    }

    if (found.length && typeof console.table === 'function') {
      console.groupCollapsed(`[잠금 표현] 위반 ${found.length}건`);
      console.table(found);
      console.groupEnd();
    } else if (!found.length) {
      console.log('[잠금 표현] 이상 없음 ✅ (검사 ' + els.length + '건)');
    }
    return { pass: found.length === 0, count: found.length, checked: els.length, rows: found };
  }

  window.checkTextStyle = checkTextStyle;
  window.checkLocked = checkLocked;
  window.checkLayout = checkLayout;
  window.__stress = stressLabels;   // 테스트용: 라벨 길이를 배로 늘림
  window.__settle = settle;         // 테스트용: 진행 중인 애니메이션을 끝 상태로 보냄
  window.checkUI = checkUI;
  window.TEXT_POLICY = POLICY;
  window.LAYOUT_POLICY = LAYOUT;

  // ?a11y=1 이면 로드 후 자동 검사
  if (/[?&]a11y=1/.test(location.search)) {
    window.addEventListener('load', () => setTimeout(() => checkTextStyle(), 400));
  }
})();
