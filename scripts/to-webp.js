// 본문 그림을 WebP로 바꾼다. 다이어그램과 스크린샷이라 무손실로 옮겨도
// PNG의 4분의 1 수준으로 줄어든다. 화질은 그대로다.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const kb = n => Math.round(n / 1024);

(async () => {
  let before = 0, after = 0, moved = 0, kept = 0;

  for (const dir of fs.readdirSync(CONTENT)) {
    const imgDir = path.join(CONTENT, dir, 'images');
    if (!fs.existsSync(imgDir)) continue;
    const md = path.join(CONTENT, dir, 'index.md');
    if (!fs.existsSync(md)) continue;
    let body = fs.readFileSync(md, 'utf8');

    for (const file of fs.readdirSync(imgDir)) {
      if (!/\.(png|jpe?g)$/i.test(file)) continue;
      const src = path.join(imgDir, file);
      const srcSize = fs.statSync(src).size;
      const outName = file.replace(/\.(png|jpe?g)$/i, '.webp');
      const out = path.join(imgDir, outName);

      before += srcSize;
      let buf;
      try {
        const meta = await sharp(src).metadata();
        let img = sharp(src);
        // WebP가 담을 수 있는 한 변의 최대가 16383px이다. 화면에서는 어차피
        // 한참 작게 보이므로, 넘치는 그림은 긴 쪽을 4000px로 줄여 담는다.
        if (Math.max(meta.width || 0, meta.height || 0) > 16000) {
          img = img.resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true });
        }
        buf = await img.webp({ lossless: true, effort: 6 }).toBuffer();
      } catch (e) {
        console.warn(`건너뜀: ${dir}/${file} — ${e.message}`);
        after += srcSize; kept++; continue;
      }

      // 드물게 WebP가 더 큰 그림이 있다. 그럴 때는 원본을 그대로 둔다.
      if (buf.length >= srcSize) { after += srcSize; kept++; continue; }

      fs.writeFileSync(out, buf);
      fs.unlinkSync(src);
      body = body.split(file).join(outName);
      after += buf.length;
      moved++;
    }
    fs.writeFileSync(md, body);
  }

  console.log(`WebP 변환 ${moved}장 (원본 유지 ${kept}장)`);
  console.log(`이미지 용량 ${kb(before)}KB → ${kb(after)}KB (${Math.round(after / before * 100)}%)`);
})();
