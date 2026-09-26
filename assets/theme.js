// 화면 테마. 어두운 화면이 기본이고, 헤더의 버튼으로 바꾸면 그 선택을 기억한다.
// 기기 설정은 따르지 않는다. 터미널 창 모양의 화면이라 어두운 쪽을 기본으로 둔다.
// 페이지가 그려지기 전에 정해야 밝은 화면이 번쩍이지 않으므로 head에서 바로 실행한다.
(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function resolve() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* 저장을 막아 둔 브라우저 */ }
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  }
  function apply(mode) {
    root.setAttribute('data-theme', mode);
    // 휴대전화에서 주소창까지 같은 색으로 맞춘다.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', mode === 'dark' ? '#0f1412' : '#fdfdfc');
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = mode === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', mode === 'dark' ? '밝은 화면으로' : '어두운 화면으로');
    }
    // 댓글창도 같은 테마로 맞춘다.
    var f = document.querySelector('iframe.giscus-frame');
    if (f) f.contentWindow.postMessage(
      { giscus: { setConfig: { theme: mode === 'dark' ? 'dark' : 'light' } } }, 'https://giscus.app');
  }

  apply(resolve());

  document.addEventListener('DOMContentLoaded', function () {
    apply(resolve());
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* 무시 */ }
      apply(next);
    });
  });

})();
