// 첫 방문 인트로. 블로그와 같은 터미널 창이 모눈 바탕 가운데 떠서
// 명령 몇 줄을 쳐 보이고, 사이트 이름이 찍히면 스르르 사라지며 원래 열려던 페이지가 드러난다.
// 누르거나 Enter·Esc를 치면 바로 넘어간다.
// 한 번 보여 주면 24시간 동안은 다시 띄우지 않는다. 그 뒤에 들어오면 다시 보여 준다.
// 블로그 화면이 먼저 번쩍이지 않도록 head에서 바로 실행해 덮개를 깐다.
// 색과 창 모양은 style.css의 변수와 .term 규칙을 그대로 빌려 쓴다.
(function () {
  var KEY = 'intro-seen-at';
  var TTL = 24 * 60 * 60 * 1000;
  var TYPE = 34;    // 한 글자 치는 간격
  var HOLD = 900;   // 다 찍고 머무는 시간
  var FADE = 650;   // 사라지는 데 걸리는 시간
  var root = document.documentElement;

  // 저장을 막아 둔 브라우저에서는 매번 인트로가 뜨게 되므로 아예 띄우지 않는다.
  var now = Date.now();
  try {
    var last = Number(localStorage.getItem(KEY));
    if (last && now - last < TTL) return;
    localStorage.setItem(KEY, String(now));
  } catch (e) { return; }

  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var me = document.currentScript;
  var posts = me && me.getAttribute('data-posts');

  var css = '' +
    'html.intro-on,html.intro-on body{overflow:hidden}' +
    '.intro{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;cursor:pointer;' +
      'background:var(--page-bg);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:32px 32px;' +
      'opacity:1;transition:opacity ' + FADE + 'ms ease}' +
    '.intro.out{opacity:0;pointer-events:none}' +
    '.intro .term{width:min(600px,100%);transform:translateY(8px);opacity:0;transition:transform .45s ease,opacity .45s ease}' +
    '.intro.in .term{transform:none;opacity:1}' +
    '.intro.out .term{transform:scale(1.03)}' +
    '.intro-body{padding:20px 24px 26px;min-height:240px;font:400 13px/1.85 var(--mono);color:var(--body)}' +
    '.intro-ln{white-space:pre-wrap;word-break:break-all}' +
    '.intro-ln .arrow{color:var(--accent)}' +
    '.intro-ln .path{color:var(--dim)}' +
    '.intro-ln .paren{color:var(--pale)}' +
    '.intro-ln .branch{color:oklch(0.55 0.15 155)}' +
    '.intro-ln.out{color:var(--muted)}' +
    '.intro-ln .ok{color:var(--accent)}' +
    '.intro-bar{display:inline-block;width:12ch;height:.7em;border:1px solid var(--kbd-line);vertical-align:-1px;margin-left:1ch;position:relative}' +
    '.intro-bar i{position:absolute;inset:0;right:auto;width:0;background:var(--accent);transition:width .7s steps(12)}' +
    '.intro-logo{margin-top:14px;font:900 26px/1.3 "IBM Plex Sans KR","Noto Sans KR",sans-serif;letter-spacing:-.03em;color:var(--ink)}' +
    '.intro-tag{font:400 12.5px var(--mono);color:var(--faint);margin-top:6px}' +
    '.intro-tag .cmt{color:var(--pale)}' +
    '.intro-hint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font:400 11.5px var(--mono);color:var(--faint)}' +
    '@media (max-width:560px){.intro-body{padding:16px 16px 20px;font-size:12px;min-height:220px}.intro-logo{font-size:22px}}' +
    '@media (prefers-reduced-motion: reduce){.intro,.intro .term,.intro-bar i{transition:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '코징의 개발탐방 인트로. 누르면 블로그로 들어갑니다.');
  el.innerHTML =
    '<div class="term">' +
      '<div class="term-bar"><span class="dot-r"></span><span class="dot-y"></span><span class="dot-g"></span>' +
      '<span class="term-path">~/tech-blog — zsh</span></div>' +
      '<div class="intro-body"></div>' +
    '</div>' +
    '<div class="intro-hint">클릭하거나 Enter를 누르면 바로 들어갑니다</div>';
  // body가 아직 없으므로 html 바로 아래에 붙인다. 파서가 뒤이어 body를 만들어도 덮개는 위에 남는다.
  root.appendChild(el);
  root.classList.add('intro-on');

  var body = el.querySelector('.intro-body');
  var timers = [], done = false;
  function later(fn, ms) { timers.push(setTimeout(fn, still ? 0 : ms)); }

  function line(cls) {
    var d = document.createElement('div');
    d.className = 'intro-ln' + (cls ? ' ' + cls : '');
    body.appendChild(d);
    return d;
  }
  function prompt(d, home) {
    d.innerHTML = home
      ? '<span class="arrow">➜</span>  <span class="path">~</span> '
      : '<span class="arrow">➜</span>  <span class="path">~/tech-blog</span> <span class="paren">git:(</span><span class="branch">main</span><span class="paren">)</span> ';
  }
  // 명령을 한 글자씩 쳐 넣고, 다 치면 next를 부른다.
  function type(home, cmd, next) {
    var d = line();
    prompt(d, home);
    var t = document.createTextNode('');
    var caret = document.createElement('span');
    caret.className = 'caret';
    d.appendChild(t); d.appendChild(caret);
    var i = 0;
    (function step() {
      if (still) i = cmd.length;
      t.data = cmd.slice(0, i);
      if (i++ < cmd.length) return later(step, TYPE);
      caret.remove();
      later(next, 220);
    })();
  }

  function run() {
    type(true, 'cd tech-blog', function () {
      type(false, 'npm run build', function () {
        var d = line('out');
        d.innerHTML = '  글 ' + (posts || '') + '편을 불러오는 중<span class="intro-bar"><i></i></span>';
        var bar = d.querySelector('i');
        later(function () { bar.style.width = '100%'; }, 30);
        later(function () {
          line('out').innerHTML = '  <span class="ok">✓</span> 빌드 완료';
          later(function () {
            type(false, 'open .', function () {
              var logo = line();
              logo.className = 'intro-logo';
              logo.innerHTML = '코징의 개발탐방<span class="caret"></span>';
              var tag = line();
              tag.className = 'intro-tag';
              tag.innerHTML = '<span class="cmt">//</span> Java, Spring, 데이터베이스, 아키텍처를 탐구하는 백엔드 개발 블로그';
              // 움직임을 줄인 기기에서는 한 번에 다 보여 주는 대신 조금 더 오래 머문다.
              timers.push(setTimeout(leave, still ? 1800 : HOLD));
            });
          }, 260);
        }, 820);
      });
    });
  }

  function leave() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey);
    el.classList.add('out');
    root.classList.remove('intro-on');
    setTimeout(function () { el.remove(); style.remove(); }, still ? 0 : FADE);
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leave(); }
  }

  requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
  later(run, 350);
  el.addEventListener('click', leave);
  document.addEventListener('keydown', onKey);
})();
