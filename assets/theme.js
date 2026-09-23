// 화면 테마. 처음에는 기기 설정을 따르고, 한 번 고르면 그 선택을 기억한다.
// 페이지가 그려지기 전에 정해야 밝은 화면이 번쩍이지 않으므로 head에서 바로 실행한다.
(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function resolve() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* 저장을 막아 둔 브라우저 */ }
    return saved || (systemDark() ? 'dark' : 'light');
  }
  function apply(mode) {
    root.setAttribute('data-theme', mode);
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

  // 직접 고르지 않았다면 기기 설정이 바뀔 때 따라간다.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (e) { /* 무시 */ }
      if (!saved) apply(systemDark() ? 'dark' : 'light');
    });
  }
})();
