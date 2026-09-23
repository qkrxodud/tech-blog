// 코드 블록의 복사 버튼. 버튼은 빌드가 미리 심어 두고, 여기서는 누를 때
// 일어날 일만 맡는다.
(function () {
  const FEEDBACK_MS = 1400;

  async function copy(text) {
    // 클립보드 API는 https(또는 localhost)에서만 쓸 수 있다. 막힌 환경에서는
    // 옛 방식으로 되돌린다.
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.code-copy');
    if (!btn) return;
    const wrap = btn.closest('.code-wrap');
    const code = wrap && wrap.querySelector('pre code');
    if (!code) return;

    try {
      await copy(code.innerText.replace(/\n$/, ''));
      btn.textContent = '복사했습니다';
      btn.classList.add('done');
    } catch {
      btn.textContent = '복사 실패';
      btn.classList.add('fail');
    }
    setTimeout(() => {
      btn.textContent = '복사';
      btn.classList.remove('done', 'fail');
    }, FEEDBACK_MS);
  });
})();
