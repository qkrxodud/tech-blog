// _tistory_ready/<dir>/images → content/<slug>/images 복사
// 파일명은 URL 안전하게 정리한다(공백·괄호 등이 마크다운 링크를 깨뜨리기 때문).
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC) { console.error('사용법: node import-images.js <_tistory_ready 경로>'); process.exit(1); }

function safeName(f) {
  const ext = path.extname(f);
  return path.basename(f, ext)
    .replace(/\s+/g, '-')
    .replace(/[()[\]{}'"#?%&,]/g, '')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    + ext.toLowerCase();
}

const posts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'posts.json'), 'utf8'));
let total = 0;
for (const p of posts) {
  // dir이 없는 글은 노션 일괄 변환을 거치지 않고 직접 추가한 것이라 임포트 대상이 아니다.
  if (!p.dir) continue;
  const imgDir = path.join(SRC, p.dir, 'images');
  if (!fs.existsSync(imgDir)) continue;
  const files = fs.readdirSync(imgDir).filter(f => !f.startsWith('.'));
  if (!files.length) continue;
  const dst = path.join(__dirname, '..', 'content', p.slug, 'images');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const f of files) {
    fs.copyFileSync(path.join(imgDir, f), path.join(dst, safeName(f)));
    total++;
  }
}
console.log('이미지 복사 완료:', total, '개');
