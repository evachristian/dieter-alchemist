// ═══════════════════════════════════════════════════════════════
//  UI 색상 (테마) — window.Theme
//
//  고른 색은 `<html data-theme="...">` 하나로 말한다. 값은 전부 style.css 의
//  `:root[data-theme="..."]` 블록에 있고, 여기서는 **무엇을 고를 수 있는지와
//  무엇을 골랐는지**만 다룬다 — 색값을 여기 또 적지 않는다 (두 벌이 되면
//  한쪽만 고치게 된다).
//
//  ⚠️⚠️ **이 파일은 `<head>` 에서 «미루지 않고» 읽힌다.** 다른 스크립트처럼
//  문서 끝에 두면 첫 페인트가 기본 색으로 한 번 그려진 뒤에 테마가 얹혀서
//  **켤 때마다 화면이 번쩍인다** (다크를 고른 사람에게는 흰 화면이 한 번 친다).
//  `defer` 도 같은 이유로 안 붙인다.
//
//  ⚠️ **세이브에 안 넣는다.** 사운드·바디파츠와 같은 결이다 — 기기마다 고르는
//  것이고, 무엇보다 `load()` 보다 훨씬 «먼저» 읽어야 해서 세이브에 두면
//  첫 페인트에 늦는다. 그래서 `SAVE_VER` 도 안 올라간다.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var KEY = 'dieter_alchemist_theme_v1';

  // 순서가 곧 설정 화면의 순서다. `sw` 는 컬러칩에 칠할 색 —
  // ⚠️ **그 테마의 「주 강조」(`--pink-2`)와 같은 값이어야 한다.** 칩이 실제 화면과
  //    다른 색이면 고르기 전에는 무엇이 될지 알 수가 없다.
  //    `tools/checktheme.js` 가 style.css 에서 읽어 이 표와 대조한다
  var THEMES = [
    { id: 'beige',    sw: '#cfa368' },
    { id: 'ecru',     sw: '#ddd2b6' },
    { id: 'blue',     sw: '#aad8f2' },
    { id: 'pink',     sw: '#ffb8d9' },
    { id: 'purple',   sw: '#cbb6f2' },
    { id: 'charcoal', sw: '#a24a33' },
  ];
  var DEFAULT = 'ecru';

  function has(id) { return THEMES.some(function (t) { return t.id === id; }); }

  function read() {
    var v = null;
    // 시크릿 창·저장 차단에서는 localStorage 를 읽는 것만으로도 던진다
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return has(v) ? v : DEFAULT;
  }

  var cur = read();

  function paint(id) {
    var root = document.documentElement;
    root.setAttribute('data-theme', id);
    // 주소창 색도 같이 간다 — 안 맞추면 다크에서 위쪽 띠만 분홍으로 남는다.
    // ⚠️ `<head>` 에서 도는 시점에는 `<meta>` 가 아직 없을 수도 있어 그때는 건너뛴다
    // (`apply` 가 설정에서 다시 불릴 때 맞춰진다).
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) {
      var bg = getComputedStyle(root).getPropertyValue('--bg-1').trim();
      if (bg) m.setAttribute('content', bg);
    }
  }

  paint(cur);   // ← 첫 페인트 전에 여기서 끝난다

  window.Theme = {
    list: function () { return THEMES.slice(); },
    get: function () { return cur; },
    DEFAULT: DEFAULT,
    KEY: KEY,
    set: function (id) {
      if (!has(id)) return false;
      cur = id;
      try { localStorage.setItem(KEY, id); } catch (e) {}
      paint(id);
      return true;
    },
    // 문서가 다 뜬 뒤에 한 번 더 — `<head>` 에서는 `<meta>` 를 아직 못 봤다
    _late: function () { paint(cur); },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.Theme._late);
  } else {
    window.Theme._late();
  }
})();
