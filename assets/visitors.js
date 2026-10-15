// 접속자 수. Firebase Realtime Database 하나로 세 숫자를 센다.
//   지금   — presence 아래 항목 수. 페이지를 열면 자기 항목을 만들고, 탭을 닫거나
//            연결이 끊기면 Firebase가 지운다(onDisconnect).
//   오늘   — counters/daily/<한국 날짜>. 브라우저 세션마다 한 번만 +1.
//   누적   — counters/total. 오늘과 같은 때에 함께 +1.
//   최근 7일 — counters/daily에서 오늘까지 7일치를 막대로 그린다. 기록이 없는 날은 0.
// 설정이 없거나 규칙이 막고 있으면 숫자 자리에 '--'를 둔 채 조용히 끝난다.
// SDK가 크므로 페이지가 다 그려진 뒤에 불러온다.
(function () {
  var fb = window.__VISITORS__ || {};
  if (!fb.databaseURL) return;
  var base = (fb.path || 'techblog').replace(/[^a-zA-Z0-9_-]/g, '');
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

  var show = function (name, v) {
    var text = v == null || isNaN(v) ? '--' : Number(v).toLocaleString('ko-KR');
    document.querySelectorAll('[data-visitors="' + name + '"]').forEach(function (el) { el.textContent = text; });
  };
  var today = function () { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); };
  var dayKey = function (offset) { return new Date(Date.now() + 9 * 3600 * 1000 - offset * 86400000).toISOString().slice(0, 10); };
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  var chart = function (counts) {
    var boxes = document.querySelectorAll('[data-visitors-chart]');
    if (!boxes.length) return;
    var days = [];
    for (var i = 6; i >= 0; i--) days.push(dayKey(i));
    var max = Math.max.apply(null, days.map(function (d) { return counts[d] || 0; }).concat([1]));
    var html = days.map(function (d, i) {
      var n = counts[d] || 0;
      var w = WEEK[new Date(d + 'T00:00:00Z').getUTCDay()];
      return '<div class="vr-bar' + (i === 6 ? ' is-today' : '') + '" title="' + d + ' · ' + n.toLocaleString('ko-KR') + '명">'
        + '<i style="height:' + Math.max(2, Math.round(n / max * 48)) + 'px"></i><em>' + w + '</em></div>';
    }).join('');
    boxes.forEach(function (el) { el.innerHTML = html; });
  };
  var load = function (src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  };

  var start = function () {
    load(SDK + 'firebase-app-compat.js')
      .then(function () { return load(SDK + 'firebase-database-compat.js'); })
      .then(function () {
        var app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
          apiKey: fb.apiKey, databaseURL: fb.databaseURL, projectId: fb.projectId, appId: fb.appId,
        });
        var db = app.database();
        var day = today();
        var quiet = function () { /* 규칙이 막고 있으면 '--' 그대로 */ };

        var list = db.ref(base + '/presence');
        var mine = list.push();
        db.ref('.info/connected').on('value', function (snap) {
          if (snap.val() !== true) return;
          mine.onDisconnect().remove().catch(quiet);
          mine.set(true).catch(quiet);
        });
        list.on('value', function (snap) { show('now', snap.numChildren()); }, quiet);
        db.ref(base + '/counters/total').on('value', function (snap) { show('total', snap.val() || 0); }, quiet);
        db.ref(base + '/counters/daily/' + day).on('value', function (snap) { show('today', snap.val() || 0); }, quiet);
        if (document.querySelector('[data-visitors-chart]')) {
          chart({});
          db.ref(base + '/counters/daily').orderByKey().startAt(dayKey(6))
            .on('value', function (snap) { chart(snap.val() || {}); }, quiet);
        }

        // 같은 탭에서 글을 옮겨 다녀도 한 번만 센다.
        try {
          if (!sessionStorage.getItem('visitors_counted')) {
            sessionStorage.setItem('visitors_counted', '1');
            var plus = function (v) { return (v || 0) + 1; };
            db.ref(base + '/counters/total').transaction(plus).catch(quiet);
            db.ref(base + '/counters/daily/' + day).transaction(plus).catch(quiet);
          }
        } catch (e) { /* 저장을 막아 둔 브라우저는 세지 않는다 */ }
      })
      .catch(function () { /* SDK를 못 받으면 '--' 그대로 */ });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
