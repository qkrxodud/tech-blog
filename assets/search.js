// 전체 글 클라이언트 검색 (제목/태그/요약/본문 부분 일치)
(function () {
  var overlay = document.getElementById('search-overlay');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var rel = window.__REL__ || './';
  var index = null;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 제목·태그·요약은 가벼워 먼저 받아 바로 찾을 수 있게 하고, 본문은 뒤따라
  // 받아 같은 자리에 붙인다. 본문이 도착하면 이미 친 검색어로 한 번 더 그린다.
  var bodyLoading = false;
  function loadBody() {
    if (bodyLoading) return;
    bodyLoading = true;
    fetch(rel + 'search-body.json')
      .then(function (r) { return r.json(); })
      .then(function (texts) {
        for (var i = 0; i < index.length && i < texts.length; i++) index[i].text = texts[i];
        if (input.value) render(input.value);
      })
      .catch(function () { bodyLoading = false; });
  }

  function open() {
    overlay.hidden = false;
    input.focus();
    if (!index) {
      fetch(rel + 'search-index.json')
        .then(function (r) { return r.json(); })
        .then(function (d) { index = d; if (input.value) render(input.value); loadBody(); });
    }
  }
  function close() { overlay.hidden = true; }

  function snippet(text, q) {
    var lower = text.toLowerCase();
    var pos = lower.indexOf(q.toLowerCase());
    if (pos < 0) return esc(text.slice(0, 90));
    var start = Math.max(0, pos - 35);
    var chunk = text.slice(start, start + 110);
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (start > 0 ? '…' : '') + esc(chunk).replace(re, function (m) { return '<mark>' + esc(m) + '</mark>'; }) + '…';
  }

  function render(q) {
    q = q.trim();
    if (!q) { results.innerHTML = '<div class="search-hint">검색어를 입력하시면 전체 글에서 찾아드립니다.</div>'; return; }
    if (!index) { results.innerHTML = '<div class="search-hint">검색 인덱스를 불러오는 중입니다…</div>'; return; }
    var ql = q.toLowerCase();
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var p = index[i];
      var score = 0;
      if (p.title.toLowerCase().indexOf(ql) >= 0) score += 100;
      if ((p.series || '').toLowerCase().indexOf(ql) >= 0) score += 40;
      for (var t = 0; t < p.tags.length; t++) if (p.tags[t].toLowerCase().indexOf(ql) >= 0) { score += 50; break; }
      if (p.summary.toLowerCase().indexOf(ql) >= 0) score += 30;
      if ((p.text || '').toLowerCase().indexOf(ql) >= 0) score += 10;
      if (score > 0) scored.push({ p: p, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    if (!scored.length) {
      results.innerHTML = '<div class="search-hint">"' + esc(q) + '"에 대한 검색 결과가 없습니다.</div>';
      return;
    }
    results.innerHTML = scored.slice(0, 20).map(function (r) {
      var p = r.p;
      var source = p.title.toLowerCase().indexOf(ql) >= 0 ? p.summary : (p.summary.toLowerCase().indexOf(ql) >= 0 ? p.summary : (p.text || p.summary));
      var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return '<a class="search-item" href="' + rel + p.url + '">' +
        '<div class="si-cat">' + esc((p.series || p.category).toUpperCase()) + '</div>' +
        '<div class="si-title">' + esc(p.title).replace(re, function (m) { return '<mark>' + esc(m) + '</mark>'; }) + '</div>' +
        '<div class="si-snippet">' + snippet(source, q) + '</div></a>';
    }).join('');
  }

  document.getElementById('search-open').addEventListener('click', open);
  document.getElementById('search-close').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) close();
    if (e.key === '/' && overlay.hidden && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); open();
    }
  });
  var to;
  input.addEventListener('input', function () {
    clearTimeout(to);
    to = setTimeout(function () { render(input.value); }, 120);
  });
})();
