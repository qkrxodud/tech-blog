// 결제 시스템 챌린지 학습 페이지.
// lessons/chNN.js가 window.LESSONS[N]에 장 하나를 넣고, 이 파일이 그 장을 단계별 흐름도로 그린다.
(function () {
  'use strict';

  var PARTS = [
    { name: '1부 단일 서버', color: 'oklch(0.7 0.12 150)', chapters: [1, 2, 3, 4, 5, 6] },
    { name: '2부 서버가 여러 대가 되면', color: 'oklch(0.7 0.12 250)', chapters: [7, 8] },
    { name: '3부 서비스를 분리하면', color: 'oklch(0.72 0.13 70)', chapters: [9, 10, 11] },
    { name: '4부 운영', color: 'oklch(0.68 0.14 25)', chapters: [12] }
  ];
  var KIND_NAMES = { req: '요청', res: '응답', fail: '실패·시간 초과', event: '이벤트·메시지', write: 'DB 기록', query: '조회·확인' };
  var NODE_W = 160, NODE_H = 96, SIDE = 10;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var STORE = 'learn-payment-v1';

  var lessons = window.LESSONS || {};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  var cur = { ch: null, step: 0, run: 0, playing: false, timer: null };
  var progress = loadProgress();

  // ---------- 저장한 진행 상태 ----------
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* 저장을 막아 둔 브라우저 */ }
  }
  function seen(ch) { return (progress[ch] && progress[ch].max) || -1; }
  function markSeen(ch, step) {
    var p = progress[ch] || (progress[ch] = { max: -1 });
    if (step > p.max) { p.max = step; saveProgress(); }
  }
  function finished(ch) { var l = lessons[ch]; return l && seen(ch) >= l.steps.length - 1; }

  // ---------- 작은 도우미 ----------
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  // 설명 글에는 `코드`와 **굵게**만 쓴다.
  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  function postUrl(lesson, heading) {
    var base = '../../posts/' + lesson.slug + '/';
    return heading ? base + '#:~:text=' + encodeURIComponent(heading) : base;
  }
  function partOf(ch) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].chapters.indexOf(ch) >= 0) return PARTS[i];
    return PARTS[0];
  }

  // ---------- 장 목록 ----------
  function renderCourse() {
    var nav = $('course-nav');
    nav.innerHTML = '';
    PARTS.forEach(function (part) {
      var box = document.createElement('div');
      box.className = 'part';
      var done = part.chapters.filter(finished).length;
      box.innerHTML = '<div class="part-name"><span class="dot" style="background:' + part.color + '"></span>' +
        esc(part.name) + '<span class="cnt">' + done + '/' + part.chapters.length + '</span></div>';
      part.chapters.forEach(function (ch) {
        var l = lessons[ch];
        var a = document.createElement('a');
        a.className = 'ch-link' + (ch === cur.ch ? ' on' : '') + (l ? '' : ' soon');
        a.href = '#ch' + ch;
        a.innerHTML = '<span class="no">' + ch + '장</span><span>' + esc(l ? l.title : '준비 중') + '</span>' +
          (finished(ch) ? '<span class="done" aria-label="다 봄">✓</span>' : '');
        box.appendChild(a);
      });
      nav.appendChild(box);
    });
    var total = Object.keys(lessons).length;
    $('course-count').textContent = total + '장';
    var all = 0;
    for (var ch = 1; ch <= 12; ch++) if (finished(ch)) all++;
    $('progress-count').textContent = all + ' / 12';
  }

  // ---------- 장 열기 ----------
  function openChapter(ch, step) {
    var lesson = lessons[ch];
    stopPlay();
    if (!lesson) {
      cur.ch = ch;
      renderCourse();
      $('lesson-title').textContent = ch + '장은 준비 중입니다';
      $('stage').innerHTML = '';
      return;
    }
    cur.ch = ch;
    var part = partOf(ch);
    $('crumbs').textContent = part.name + ' / ' + ch + '장 · 12장 중';
    $('lesson-title').textContent = lesson.title;
    $('lesson-goal').textContent = lesson.goal;
    document.title = ch + '장 ' + lesson.title + ' — 결제 시스템 챌린지 학습';
    $('chips').innerHTML =
      '<span class="chip">단계 ' + lesson.steps.length + '개</span>' +
      '<a class="chip" href="' + postUrl(lesson) + '">글 읽기 →</a>' +
      (lesson.branch ? '<a class="chip" href="https://github.com/qkrxodud/payment-challenge/tree/' + esc(lesson.branch) + '">코드 ' + esc(lesson.branch) + '</a>' : '');
    renderLegend(lesson);
    renderStepbar(lesson);
    renderLearn(lesson);
    renderCourse();
    goStep(Math.max(0, Math.min(step || 0, lesson.steps.length - 1)), true);
  }

  function renderLegend(lesson) {
    var kinds = {};
    lesson.steps.forEach(function (s) { flatFlows(s.flows).forEach(function (f) { if (f.from) kinds[f.kind || 'req'] = 1; }); });
    $('legend').innerHTML = Object.keys(KIND_NAMES).filter(function (k) { return kinds[k]; }).map(function (k) {
      return '<span class="k-' + k + '"><i></i>' + KIND_NAMES[k] + '</span>';
    }).join('');
  }

  function renderStepbar(lesson) {
    var bar = $('stepbar');
    bar.innerHTML = '';
    lesson.steps.forEach(function (s, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="lbl">' + esc(s.short) + '</span>';
      b.addEventListener('click', function () { stopPlay(); goStep(i); });
      li.appendChild(b);
      bar.appendChild(li);
    });
  }

  function renderLearn(lesson) {
    var max = seen(cur.ch);
    $('learn-list').innerHTML = (lesson.learn || []).map(function (item) {
      var got = max >= item.step;
      return '<li class="' + (got ? 'got' : '') + '"><span class="box">' + (got ? '✓' : '') + '</span><span>' + inline(item.text) + '</span></li>';
    }).join('');
  }

  // ---------- 단계 ----------
  function goStep(i, first) {
    var lesson = lessons[cur.ch];
    cur.step = i;
    markSeen(cur.ch, i);
    var s = lesson.steps[i];
    var n = lesson.steps.length;
    var hash = '#ch' + cur.ch + (i ? '/' + (i + 1) : '');
    if (location.hash !== hash) history.replaceState(null, '', hash);

    $('step-pos').textContent = 'STEP ' + (i + 1) + ' / ' + n;
    $('steps-pos').textContent = (i + 1) + '단계 / ' + n;
    var tag = $('step-tag');
    tag.textContent = s.tag;
    tag.className = 'tag t-' + s.tag;
    $('step-title').textContent = s.title;
    $('step-body').innerHTML = s.body.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('');
    $('step-note').hidden = !s.note;
    $('step-note-text').innerHTML = s.note ? inline(s.note) : '';
    var ch = s.changed || [];
    $('step-changed').hidden = !ch.length;
    $('step-changed-list').innerHTML = ch.map(function (c) {
      var cls = c[0] === '+' ? 'add' : c[0] === '-' ? 'del' : 'mod';
      return '<li class="' + cls + '"><b>' + (c[0] === '~' ? '~' : c[0]) + '</b><span>' + inline(c[1]) + '</span></li>';
    }).join('');
    var src = $('step-src');
    if (s.src) { src.href = postUrl(lesson, s.src); src.textContent = '글에서 보기: ' + s.src + ' →'; src.hidden = false; }
    else src.hidden = true;
    $('prev').disabled = i === 0;
    $('next').textContent = i === n - 1 ? (cur.ch < 12 ? (cur.ch + 1) + '장으로 →' : '처음 장으로 →') : '다음: ' + lesson.steps[i + 1].short + ' →';

    [].forEach.call($('stepbar').children, function (li, k) {
      li.className = k < i ? 'past' : k === i ? 'on' : '';
      // 페이지는 두고 단계 막대만 옆으로 밀어 지금 단계를 가운데에 둔다
      if (k === i) {
        var bar = $('stepbar');
        bar.scrollTo({ left: li.offsetLeft - bar.clientWidth / 2 + li.clientWidth / 2, behavior: first || reduced ? 'auto' : 'smooth' });
      }
    });
    renderMetrics(lesson, i);
    renderLearn(lesson);
    if (i === n - 1) renderCourse();
    playStep();
    talkStep();
  }

  // 지표는 그 단계에 없으면 앞 단계 것을 이어 쓴다.
  function renderMetrics(lesson, i) {
    var m = null;
    for (var k = i; k >= 0 && !m; k--) m = lesson.steps[k].metrics;
    var box = $('metrics');
    var before = box.getAttribute('data-sig');
    var sig = JSON.stringify(m || []);
    box.innerHTML = (m || []).map(function (x) {
      return '<div class="metric ' + (x.tone || '') + '"><div class="m-label">' + esc(x.label) + '</div><div class="m-value">' + esc(x.value) + '</div></div>';
    }).join('');
    if (before && before !== sig && !reduced) [].forEach.call(box.children, function (c) { c.classList.add('flash'); });
    box.setAttribute('data-sig', sig);
  }

  // ---------- 흐름도 ----------
  function flatFlows(flows) {
    var out = [];
    (flows || []).forEach(function (f) { if (Array.isArray(f)) out.push.apply(out, f); else out.push(f); });
    return out;
  }

  var scene = null;

  function drawScene(lesson, step) {
    var svg = $('stage');
    svg.innerHTML = '';
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: 'g', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M0 20 L20 0 L40 20 L20 40 Z', class: 'grid-line', fill: 'none' }, pat);
    el('rect', { x: 0, y: 0, width: 1000, height: 560, fill: 'url(#g)' }, svg);

    var nodes = {};
    lesson.nodes.forEach(function (n) { nodes[n.id] = n; });
    var hidden = {};
    (step.hide || []).forEach(function (id) { hidden[id] = 1; });
    var hot = {};
    flatFlows(step.flows).forEach(function (f) { if (f.from) hot[pairKey(f.from, f.to)] = 1; });

    var edgeLayer = el('g', {}, svg);
    var edges = (lesson.edges || []).concat(step.edges || []);
    edges.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      if (!a || !b) return;
      var p = clip(a, b), q = clip(b, a);
      var dashed = (e[2] && e[2].dashed) || hidden[e[0]] || hidden[e[1]];
      el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'edge' + (dashed ? ' dashed' : '') + (hot[pairKey(e[0], e[1])] ? ' hot' : '') }, edgeLayer);
    });

    var nodeLayer = el('g', {}, svg);
    var nodeEls = {};
    lesson.nodes.forEach(function (n) {
      nodeEls[n.id] = drawNode(nodeLayer, n, hidden[n.id], (step.focus || []).indexOf(n.id) >= 0);
    });
    var trailLayer = el('g', {}, svg);
    var tokenLayer = el('g', {}, svg);
    $('flowlog').innerHTML = '';
    scene = { svg: svg, nodes: nodes, nodeEls: nodeEls, trailLayer: trailLayer, tokenLayer: tokenLayer, trails: {} };

    var states = step.states || {};
    Object.keys(states).forEach(function (id) { setState(id, states[id], false); });
  }

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  // 노드 상자 테두리에서 상대 노드 쪽으로 나가는 점
  function clip(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var hw = NODE_W / 2 + 8, hh = NODE_H / 2 + SIDE / 2 + 8;
    var t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: a.x + dx * t, y: a.y + SIDE / 2 + dy * t };
  }

  var ICONS = {
    client: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9c0-3.9 3.1-7 7-7s7 3.1 7 7z',
    server: 'M4 4h16v6H4zM4 14h16v6H4zM7 6.5h2v1H7zM7 16.5h2v1H7z',
    pg: 'M3 6h18v12H3zM3 9h18v2.5H3zM6 14h5v1.5H6z',
    db: 'M12 3c4.4 0 8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6c0-1.7 3.6-3 8-3zm0 2c-3.5 0-6 .9-6 1s2.5 1 6 1 6-.9 6-1-2.5-1-6-1z',
    kafka: 'M12 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5 15a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM19 15a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM11 8h2v4l5 3-1 1.7-5-3-5 3-1-1.7 5-3z',
    scheduler: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm-1 4v6l5 3 1-1.6-4-2.4V7z',
    service: 'M12 2l9 5v10l-9 5-9-5V7zm0 2.3L5.5 8 12 11.6 18.5 8z',
    ops: 'M3 20h18v-2H3zM5 16h3V9H5zM10.5 16h3V4h-3zM16 16h3v-5h-3z'
  };

  function drawNode(layer, n, dim, focus) {
    var g = el('g', { class: 'node' + (dim ? ' dim' : '') + (focus ? ' focus' : ''), transform: 'translate(' + n.x + ',' + n.y + ')' }, layer);
    var inner = el('g', {}, g);
    var kind = n.kind || 'server';
    var x = -NODE_W / 2, y = -NODE_H / 2;
    el('rect', { class: 'side', x: x, y: y + SIDE, width: NODE_W, height: NODE_H, rx: 16, fill: 'var(--k-' + kind + '-ink)' }, inner);
    el('rect', { class: 'face', x: x, y: y, width: NODE_W, height: NODE_H, rx: 16, fill: 'var(--k-' + kind + ')' }, inner);
    el('rect', { class: 'ring', x: x - 4, y: y - 4, width: NODE_W + 8, height: NODE_H + SIDE + 8, rx: 19, style: 'transform-box:fill-box;transform-origin:center' }, inner);
    var ic = el('g', { transform: 'translate(-12,' + (y + 10) + ')' }, inner);
    el('path', { d: ICONS[kind] || ICONS.server, fill: 'var(--k-' + kind + '-ink)', 'fill-rule': 'evenodd' }, ic);
    var label = el('text', { class: 'label', x: 0, y: 17 }, inner);
    label.textContent = n.label;
    var sub = null;
    if (n.sub) {
      sub = el('text', { class: 'sub' + (n.subMono ? ' mono' : ''), x: 0, y: 38 }, inner);
      sub.textContent = n.sub;
    }
    fit(label, NODE_W - 18);
    if (sub) fit(sub, NODE_W - 14);
    if (dim) {
      var t = el('text', { class: 'sub', x: 0, y: y + NODE_H + SIDE + 18 }, g);
      t.textContent = n.absent || '아직 없음';
    }
    return { g: g, inner: inner, badge: null, note: null };
  }

  // 노드 위 배지(상태)와 아래 메모
  function setState(id, st, animate) {
    var ne = scene && scene.nodeEls[id];
    if (!ne) return;
    if ('badge' in st) {
      if (ne.badge) ne.badge.remove();
      ne.badge = null;
      if (st.badge) {
        ne.badge = pill(ne.g, 0, -NODE_H / 2 - 22, st.badge, 'badge ' + (st.tone || 'muted'), true);
        if (animate && !reduced) ne.badge.firstChild.classList.add('pop');
      }
    }
    if ('note' in st) {
      if (ne.note) ne.note.remove();
      ne.note = null;
      if (st.note) {
        ne.note = el('text', { class: 'node-note ' + (st.noteTone || st.tone || 'muted'), x: 0, y: NODE_H / 2 + SIDE + 22 }, ne.g);
        ne.note.textContent = st.note;
      }
    }
    if (animate && !reduced && st.shake) {
      ne.inner.classList.remove('shake'); void ne.inner.getBBox(); ne.inner.classList.add('shake');
    }
  }

  // 상자보다 긴 이름은 글자 폭을 좁혀 상자 안에 넣는다
  function fit(t, max) {
    var w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
    if (w > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  }

  function pill(parent, x, y, text, cls, mono) {
    // 바깥 g는 자리를, 안쪽 g는 튀어나오는 움직임을 맡는다. 움직임의 transform이 자리를 덮지 않게 나눈다.
    var outer = el('g', { class: cls, transform: 'translate(' + x + ',' + y + ')' }, parent);
    var g = el('g', {}, outer);
    var r = el('rect', { rx: 13, ry: 13, height: 26, y: -13 }, g);
    var t = el('text', { y: 5, class: mono ? 'mono' : null }, g);
    t.textContent = text;
    var w = Math.max(40, (t.getComputedTextLength ? t.getComputedTextLength() : text.length * 8) + 20);
    r.setAttribute('width', w);
    r.setAttribute('x', -w / 2);
    return outer;
  }

  function pulse(id) {
    var ne = scene.nodeEls[id];
    if (!ne || reduced) return;
    ne.g.classList.remove('pulse'); void ne.g.getBBox(); ne.g.classList.add('pulse');
  }

  // ---------- 움직임 ----------
  function playStep() {
    var lesson = lessons[cur.ch];
    var step = lesson.steps[cur.step];
    var run = ++cur.run;
    drawScene(lesson, step);
    var groups = (step.flows || []).map(function (f) { return Array.isArray(f) ? f : [f]; });
    var gi = 0;
    function nextGroup() {
      if (run !== cur.run) return;
      if (gi >= groups.length) { onStepDone(run); return; }
      var group = groups[gi++];
      var left = group.length;
      group.forEach(function (f) {
        animateFlow(f, run, function () { if (--left === 0) setTimeout(nextGroup, reduced ? 0 : 260); });
      });
    }
    setTimeout(nextGroup, reduced ? 0 : 350);
  }

  function animateFlow(f, run, done) {
    var kind = f.kind || 'req';
    logFlow(f, f.from ? kind : 'at');
    // 노드 자리에서 일어나는 일(기록 실패, 상태 변화)
    if (!f.from) {
      pulse(f.at);
      setState(f.at, f.then && f.then[f.at] ? f.then[f.at] : {}, true);
      applyThen(f, f.at);
      setTimeout(done, reduced ? 0 : 750);
      return;
    }
    var a = scene.nodes[f.from], b = scene.nodes[f.to];
    var p = clip(a, b), q = clip(b, a);
    var stop = f.cut ? 0.55 : 1;
    var dur = reduced ? 0 : (f.slow ? 1900 : 1150);
    var tok = el('g', { class: 'token k-' + kind }, scene.tokenLayer);
    el('circle', { r: 9 }, tok);
    var label = f.label ? pill(tok, 0, -24, f.label, 'pill k-' + kind, !!f.mono) : null;
    pulse(f.from);
    var t0 = null;
    function frame(ts) {
      if (run !== cur.run) { tok.remove(); return; }
      if (t0 == null) t0 = ts;
      var k = dur ? Math.min(1, (ts - t0) / dur) : 1;
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var x = p.x + (q.x - p.x) * e * stop, y = p.y + (q.y - p.y) * e * stop;
      tok.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      if (k < 1) { requestAnimationFrame(frame); return; }
      tok.remove();
      if (f.cut) xmark(x, y);
      else pulse(f.to);
      if (f.label) trail(f, p, q, kind);
      applyThen(f, f.to);
      setTimeout(done, reduced ? 0 : 120);
    }
    requestAnimationFrame(frame);
  }

  function applyThen(f, fallback) {
    if (!f.then) return;
    Object.keys(f.then).forEach(function (id) { if (id !== fallback || f.from) setState(id, f.then[id], true); });
  }

  function xmark(x, y) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ')' }, scene.trailLayer);
    el('line', { x1: -8, y1: -8, x2: 8, y2: 8, class: 'xmark-line' }, g);
    el('line', { x1: -8, y1: 8, x2: 8, y2: -8, class: 'xmark-line' }, g);
  }

  // 지나간 흐름의 이름은 선 옆에 남겨 둔다. 같은 선에 여러 개면 비켜 쌓는다.
  // 지나간 흐름의 이름은 선 가운데에 남긴다. 한 선에는 가장 최근 것 하나만 두고, 전체 순서는 아래 기록 줄에 적는다.
  function trail(f, p, q, kind) {
    var key = pairKey(f.from, f.to);
    if (scene.trails[key]) scene.trails[key].remove();
    var frac = f.cut ? 0.28 : 0.5;
    scene.trails[key] = pill(scene.trailLayer, p.x + (q.x - p.x) * frac, p.y + (q.y - p.y) * frac, f.label, 'pill trail k-' + kind, !!f.mono);
  }

  function logFlow(f, kind) {
    var li = document.createElement('li');
    li.className = 'k-' + kind;
    var who = f.from ? scene.nodes[f.from].label + ' → ' + scene.nodes[f.to].label : scene.nodes[f.at].label;
    var what = f.label || (f.then && f.then[f.at] && f.then[f.at].note) || '';
    li.innerHTML = '<i></i><span class="who">' + esc(who) + '</span>' + (what ? '<span class="what">' + esc(what) + '</span>' : '');
    $('flowlog').appendChild(li);
  }

  function onStepDone(run) {
    if (!cur.playing || run !== cur.run) return;
    cur.timer = setTimeout(function () {
      if (!cur.playing) return;
      var lesson = lessons[cur.ch];
      if (cur.step < lesson.steps.length - 1) goStep(cur.step + 1);
      else stopPlay();
    }, reduced ? 4000 : 2600);
  }


  // ---------- 이야기로 듣기 ----------
  // talks/talkNN.js가 window.TALKS[N]에 단계마다 [{ who: 'host'|'dev', text }] 대본을 넣는다.
  // 브라우저의 음성 읽기로 진행자와 개발자 목소리를 번갈아 읽고, 단계 대본이 끝나면 다음 단계로 넘어간다.
  var talks = window.TALKS || {};
  var synth = window.speechSynthesis;
  var SPEEDS = [0.9, 1.0, 1.15, 1.3];
  var WHO = { host: '진행자', dev: '개발자' };
  var talk = { on: false, line: 0, token: 0, speed: 1, voices: null };

  function pickVoices() {
    if (!synth) return null;
    var ko = synth.getVoices().filter(function (v) { return /^ko/i.test(v.lang); });
    if (!ko.length) return null;
    // 목소리가 둘 이상이면 나눠 쓰고, 하나뿐이면 높낮이로 구분한다
    return { host: ko[0], dev: ko[1] || ko[0], same: ko.length < 2 };
  }
  if (synth) {
    talk.voices = pickVoices();
    synth.addEventListener && synth.addEventListener('voiceschanged', function () { talk.voices = pickVoices(); talkNote(); });
  }
  function talkNote() {
    var note = '';
    if (!synth) note = '이 브라우저는 음성 읽기를 지원하지 않아 대본만 보여 드립니다.';
    else if (!talk.voices) note = '한국어 목소리가 없어 기본 목소리로 읽습니다.';
    $('talk-note').textContent = note;
  }

  function talkLines() {
    var t = talks[cur.ch];
    return (t && t[cur.step]) || [];
  }

  function talkStep() {
    var lines = talkLines();
    $('talk').hidden = !talks[cur.ch];
    var box = $('talk-lines');
    box.innerHTML = lines.map(function (l, k) {
      return '<li class="' + (l.who === 'host' ? 'host' : 'dev') + '" data-k="' + k + '"><span class="who">' + WHO[l.who === 'host' ? 'host' : 'dev'] + '</span><span class="say">' + inline(l.text) + '</span></li>';
    }).join('');
    box.scrollTop = 0;
    if (talk.on) {
      talk.token++;
      if (synth) synth.cancel();
      var token = talk.token;
      // 흐름도가 먼저 움직이기 시작한 뒤 읽는다
      setTimeout(function () { if (token === talk.token) speak(0, token); }, reduced ? 0 : 700);
    }
  }

  // 코드는 읽기 좋게: 백틱을 떼고 밑줄을 띄어 읽는다
  function spoken(text) {
    return text.replace(/\*\*/g, '').replace(/`([^`]+)`/g, function (m, c) { return c.replace(/_/g, ' '); });
  }

  function mark(k) {
    var box = $('talk-lines');
    box.classList.toggle('playing', talk.on);
    [].forEach.call(box.children, function (li, n) {
      li.classList.toggle('now', n === k);
      if (n === k) box.scrollTop = li.offsetTop - box.offsetTop - 8;
    });
  }

  function speak(k, token) {
    if (!talk.on || token !== talk.token) return;
    var lines = talkLines();
    if (k >= lines.length) {
      mark(-1);
      var lesson = lessons[cur.ch];
      setTimeout(function () {
        if (!talk.on || token !== talk.token) return;
        if (cur.step < lesson.steps.length - 1) goStep(cur.step + 1);
        else stopTalk();
      }, 900);
      return;
    }
    talk.line = k;
    mark(k);
    var l = lines[k];
    if (!synth) { setTimeout(function () { speak(k + 1, token); }, 2500); return; }
    var u = new SpeechSynthesisUtterance(spoken(l.text));
    u.lang = 'ko-KR';
    u.rate = talk.speed;
    var v = talk.voices;
    if (v) {
      u.voice = l.who === 'host' ? v.host : v.dev;
      if (v.same) u.pitch = l.who === 'host' ? 1.15 : 0.85;
    }
    // 끝 알림이 오지 않는 브라우저가 있어, 글자 수로 잡은 시간의 두 배가 지나면 다음 줄로 넘어간다
    var done = false;
    var next = function (wait) {
      if (done) return;
      done = true;
      clearTimeout(watch);
      setTimeout(function () { speak(k + 1, token); }, wait);
    };
    var watch = setTimeout(function () { next(0); }, (1500 + l.text.length * 160 / talk.speed) * 2);
    // 소리 없이 곧바로 끝났다고 알리는 환경도 있어, 자막을 읽을 만큼은 머문다
    var started = Date.now(), least = l.text.length * 70 / talk.speed;
    u.onend = function () { next(Math.max(250, least - (Date.now() - started))); };
    u.onerror = function (e) {
      if (e.error === 'interrupted' || e.error === 'canceled') { done = true; clearTimeout(watch); return; }
      if (e.error === 'not-allowed') {
        done = true; clearTimeout(watch);
        stopTalk();
        $('talk-note').textContent = '브라우저가 음성 재생을 막았습니다. 듣기 버튼을 한 번 더 눌러 주세요.';
        return;
      }
      // 읽기에 실패한 줄은 읽는 데 걸렸을 시간만큼 자막을 보여 주고 넘어간다
      next(1500 + l.text.length * 120 / talk.speed);
    };
    synth.speak(u);
  }

  function startTalk() {
    stopPlay();
    talkNote();
    talk.on = true;
    talk.token++;
    var b = $('talk-play');
    b.classList.add('on');
    b.textContent = '❚❚ 멈춤';
    if (synth) synth.cancel();
    speak(talk.line < talkLines().length ? talk.line : 0, talk.token);
  }
  function stopTalk() {
    talk.on = false;
    talk.token++;
    if (synth) synth.cancel();
    var b = $('talk-play');
    b.classList.remove('on');
    b.textContent = '▶ 듣기';
    $('talk-lines').classList.remove('playing');
  }

  $('talk-play').addEventListener('click', function () { if (talk.on) stopTalk(); else { talk.line = 0; startTalk(); } });
  $('talk-speed').addEventListener('click', function () {
    talk.speed = SPEEDS[(SPEEDS.indexOf(talk.speed) + 1) % SPEEDS.length];
    this.textContent = (talk.speed === 1 ? '1.0' : String(talk.speed)) + 'x';
    if (talk.on) startTalk();
  });
  $('talk-sub').addEventListener('change', function () { $('talk-lines').classList.toggle('off', !this.checked); });
  window.addEventListener('pagehide', function () { if (synth) synth.cancel(); });
  talkNote();

  // ---------- 조작 ----------
  function stopPlay() {
    cur.playing = false;
    clearTimeout(cur.timer);
    var b = $('play');
    b.classList.remove('on');
    b.textContent = '▶ 자동 재생';
  }
  function togglePlay() {
    if (cur.playing) { stopPlay(); return; }
    stopTalk();
    cur.playing = true;
    var b = $('play');
    b.classList.add('on');
    b.textContent = '❚❚ 멈춤';
    var lesson = lessons[cur.ch];
    if (cur.step === lesson.steps.length - 1) goStep(0); else playStep();
  }
  function next() {
    var lesson = lessons[cur.ch];
    if (!lesson) return;
    if (cur.step < lesson.steps.length - 1) goStep(cur.step + 1);
    else location.hash = '#ch' + (cur.ch < 12 ? cur.ch + 1 : 1);
  }
  function prev() { if (cur.step > 0) goStep(cur.step - 1); }

  $('next').addEventListener('click', function () { stopPlay(); next(); });
  $('prev').addEventListener('click', function () { stopPlay(); prev(); });
  $('replay').addEventListener('click', function () { if (lessons[cur.ch]) playStep(); });
  $('play').addEventListener('click', function () { if (lessons[cur.ch]) togglePlay(); });
  document.querySelector('.course-head').addEventListener('click', function () {
    document.querySelector('.course').classList.toggle('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') { stopPlay(); next(); }
    else if (e.key === 'ArrowLeft') { stopPlay(); prev(); }
    else if (e.key === 'r' || e.key === 'R') { if (lessons[cur.ch]) playStep(); }
    else if (e.key === ' ' && !(e.target.closest && e.target.closest('button, a'))) { e.preventDefault(); if (lessons[cur.ch]) togglePlay(); }
    else return;
  });

  function route() {
    var m = /^#ch(\d+)(?:\/(\d+))?$/.exec(location.hash);
    var ch = m ? Number(m[1]) : (progress.last || 1);
    var step = m && m[2] ? Number(m[2]) - 1 : 0;
    if (ch < 1 || ch > 12) ch = 1;
    progress.last = ch;
    saveProgress();
    if (ch !== cur.ch) openChapter(ch, step);
    else if (lessons[ch] && step !== cur.step) goStep(step);
    document.querySelector('.course').classList.remove('open');
  }
  window.addEventListener('hashchange', route);
  route();
})();
