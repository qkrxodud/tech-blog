// 글의 차례. 목록 자체는 빌드가 미리 심어 두고, 여기서는 두 가지만 맡는다.
//  - 넓은 화면에서는 펼쳐 둔다 (좁은 화면에서는 접힌 채로 두어 본문을 가리지 않는다)
//  - 지금 읽고 있는 자리를 표시한다
(function () {
  const toc = document.querySelector('.toc');
  if (!toc) return;

  const head = toc.querySelector('.toc-head');
  const list = toc.querySelector('.toc-list');
  const links = [...list.querySelectorAll('.toc-i')];
  const WIDE = window.matchMedia('(min-width: 1080px)');

  function setOpen(on) {
    toc.classList.toggle('open', on);
    head.setAttribute('aria-expanded', String(on));
  }
  // 넓은 화면에서는 옆에 붙어 있어 본문을 가리지 않으므로 늘 펼쳐 둔다.
  function sync() { setOpen(WIDE.matches); }
  sync();
  WIDE.addEventListener('change', sync);
  head.addEventListener('click', () => setOpen(!toc.classList.contains('open')));

  // 지금 읽는 자리 표시. 화면 위쪽에 걸친 소제목 가운데 가장 아래 것을 고른다.
  const targets = links
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!targets.length || !('IntersectionObserver' in window)) return;

  const seen = new Map();
  let current = null;

  function mark() {
    let pick = null;
    for (const el of targets) {
      const top = el.getBoundingClientRect().top;
      if (top <= 120) pick = el; else break;
    }
    if (!pick) pick = seen.size ? targets[0] : null;
    if (!pick || pick === current) return;
    current = pick;
    for (const a of links) {
      a.classList.toggle('here', a.getAttribute('href') === '#' + pick.id);
    }
  }

  // 스크롤마다 계산하면 잦으니, 화면에 걸친 소제목이 바뀔 때만 다시 센다.
  const io = new IntersectionObserver(entries => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
    mark();
  }, { rootMargin: '-100px 0px -70% 0px' });
  for (const el of targets) io.observe(el);

  // 관찰만으로는 빠르게 스크롤할 때 놓치는 구간이 있어 스크롤도 함께 본다.
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { mark(); ticking = false; });
  }, { passive: true });
})();
