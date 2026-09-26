// 정적 사이트 빌드 스크립트
// content/<slug>/index.md (frontmatter + 본문) → dist/ 정적 HTML
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content');

// 스타일·스크립트를 고쳐도 브라우저가 옛 파일을 계속 쓰지 않도록,
// 파일 내용에서 뽑은 해시를 주소에 붙인다.
const assetHash = (() => {
  const h = require('crypto').createHash('sha1');
  for (const f of ['style.css', 'fonts.css', 'search.js', 'theme.js', 'code.js', 'toc.js']) {
    h.update(fs.readFileSync(path.join(ROOT, 'assets', f)));
  }
  return h.digest('hex').slice(0, 8);
})();

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'categories.json'), 'utf8'));
const postMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));
const projectsPath = path.join(ROOT, 'data', 'projects.json');
const projects = fs.existsSync(projectsPath) ? JSON.parse(fs.readFileSync(projectsPath, 'utf8')) : [];

// 글마다 그 파일을 마지막으로 건드린 커밋 해시를 찾아 둔다. 목록에 함께
// 보여 주기 위한 것이라, git 이력을 못 읽는 환경이면 조용히 건너뛴다.
const commitOf = (() => {
  const map = {};
  try {
    const log = require('child_process')
      .execSync('git log --format="C:%h" --name-only -- content', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let cur = null;
    for (const line of log.split('\n')) {
      if (line.startsWith('C:')) { cur = line.slice(2).trim(); continue; }
      const m = line.match(/^content\/([^/]+)\//);
      if (m && cur && !map[m[1]]) map[m[1]] = cur;  // 최신 커밋이 먼저 나온다
    }
  } catch { /* git 없이 빌드해도 문제없다 */ }
  return map;
})();

marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: false });

// ---------- 유틸 ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { attrs: {}, body: raw };
  const attrs = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[')) {
      try { attrs[key] = JSON.parse(val); continue; } catch { /* fallthrough */ }
    }
    if (/^".*"$/.test(val)) val = JSON.parse(val);
    else if (/^\d+$/.test(val)) val = Number(val);
    attrs[key] = val;
  }
  return { attrs, body: raw.slice(m[0].length) };
}

function stripMd(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 본문은 글자 수로, 코드는 줄 수로 센다. stripMd가 코드 블록을 통째로 덜어
// 내기 때문에 글자 수만 세면 코드가 대부분인 글이 1~2분으로 눌린다. 코드는
// 한 줄씩 읽기보다 훑어 내려가므로 마흔 줄을 1분으로 본다.
function readingTime(text, md = '') {
  const codeLines = (md.match(/```[\s\S]*?```/g) || [])
    .reduce((n, block) => n + Math.max(0, block.split('\n').length - 2), 0);
  return Math.max(1, Math.round(text.length / 600 + codeLines / 40));
}

// 본문 그림은 화면에 들어올 만큼만 보여 주고, 눌러서 원본을 열 수 있게 한다.
// 세로로 긴 다이어그램이 많아 크기를 줄이면 글씨가 작아지기 때문이다.
function zoomableImages(html) {
  return html.replace(/<img src="([^"]+)"([^>]*)>/g, (whole, src, rest) => {
    if (/^https?:/.test(src)) return whole;   // 외부 이미지는 그대로 둔다
    return `<a class="img-zoom" href="${src}" target="_blank" rel="noopener">${whole}</a>` +
           `<span class="img-cap">눌러서 원본 크기로 보기</span>`;
  });
}

// 제목 앞의 대괄호 접두어를 덜어낸다. 화면에는 카테고리·시리즈 라벨이 이미
// 붙으므로 "[Java] GC 튜닝" 같은 제목은 라벨과 중복된다.
const TITLE_PREFIXES = /^\s*\[(java|spring|db|git|kafka|clean[ -]?code|리뷰)\]\s*/i;
// 노션에서 같은 제목이 겹칠 때 붙던 "(1)"은 군더더기라 뗀다. 다만 "(2)"가 짝으로
// 있는 제목이라면 두 편을 가르는 표시이므로 남겨야 한다 — 떼면 목록에서 두 글이
// 똑같아 보인다.
const PAIRED = new Set(
  postMeta
    .map(m => {
      const f = path.join(CONTENT, m.slug, 'index.md');
      if (!fs.existsSync(f)) return null;
      const t = (fs.readFileSync(f, 'utf8').match(/^title: "(.*)"/m) || [])[1] || '';
      const pair = t.match(/^(.*?)\s*\(2\)\s*$/);
      return pair ? pair[1].trim() : null;
    })
    .filter(Boolean)
);

function cleanTitle(raw, inSeries) {
  let t = raw.trim();
  // 짝이 있는지는 접두어를 떼기 전 원래 제목끼리 견준다.
  const paired = PAIRED.has((t.match(/^(.*?)\s*\(1\)\s*$/) || [, ''])[1].trim());
  // 시리즈 글은 시리즈 박스가 맥락을 주므로 대괄호 접두어를 모두 덜어낸다.
  if (inSeries) t = t.replace(/^\s*\[[^\]]+\]\s*/, '');
  while (TITLE_PREFIXES.test(t)) {
    const stripped = t.replace(TITLE_PREFIXES, '');
    // 접두어를 떼면 "[Kafka] 재처리" → "재처리"처럼 뜻이 흐려지는 제목이 있다.
    // 그런 경우엔 대괄호만 벗기고 단어는 제목에 남긴다.
    if (stripped.trim().length < 10) { t = t.replace(/^\s*\[([^\]]+)\]\s*/, '$1 '); break; }
    t = stripped;
  }
  if (!paired) t = t.replace(/\s*\(1\)\s*$/, '');
  return t.trim();
}

// 페이지의 H1은 글 제목 하나여야 한다. 본문에 남은 H1은 한 단계씩 낮춘다.
// (코드 블록 안의 `#`는 건드리지 않는다.)
function demoteHeadings(body) {
  const blocks = body.split(/(```[\s\S]*?```)/g);
  return blocks.map((chunk, i) => {
    if (i % 2 === 1) return chunk;
    if (!/^# /m.test(chunk)) return chunk;
    return chunk.replace(/^(#{1,5}) /gm, (m, h) => '#'.repeat(h.length + 1) + ' ');
  }).join('');
}

// 코드 블록에 언어 이름과 복사 버튼을 붙인다.
// 노션이 언어를 엉뚱하게 잡아 둔 블록이 섞여 있어(자바 코드에 arduino, fsharp),
// 믿을 수 있는 것만 이름을 보여 주고 나머지는 이름 없이 복사 버튼만 둔다.
const LANG_LABEL = {
  java: 'Java', kotlin: 'Kotlin', sql: 'SQL', json: 'JSON', yaml: 'YAML', yml: 'YAML',
  xml: 'XML', html: 'HTML', css: 'CSS', javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript', bash: 'Shell', sh: 'Shell', shell: 'Shell',
  properties: 'Properties', gradle: 'Gradle', dockerfile: 'Dockerfile', python: 'Python',
};

// 소제목에 닻을 박고 차례를 뽑는다.
// 닻 이름은 s1, s2… 처럼 번호로 둔다. 소제목이 한글이라 그대로 쓰면 주소를
// 복사했을 때 %ED%94%84… 로 늘어져 알아볼 수 없게 되기 때문이다.
function headingAnchors(html) {
  const toc = [];
  let n = 0;
  const out = html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (whole, tag, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (!text) return whole;
    const id = `s${++n}`;
    toc.push({ level: Number(tag[1]), id, text });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  return { html: out, toc };
}

// 차례는 소제목이 다섯 개는 넘어야 쓸모가 있다. 서너 개짜리 글은 그냥 훑으면 된다.
const TOC_MIN = 5;
function tocBox(toc) {
  if (toc.length < TOC_MIN) return '';
  const items = toc.map(t =>
    `<a class="toc-i lv${t.level}" href="#${t.id}">${esc(t.text)}</a>`).join('\n');
  return `<nav class="toc" aria-label="이 글의 차례">
  <button class="toc-head" type="button" aria-expanded="false" aria-controls="toc-list">이 글의 차례<span class="toc-n">${toc.length}</span></button>
  <div class="toc-list" id="toc-list">${items}</div>
</nav>`;
}

// 코드에 색을 입힌다. 빌드할 때 한 번 칠해 두면 글을 읽는 쪽에서 내려받는
// 스크립트가 없다. 노션에서 잘못 붙어 온 언어 이름(arduino, fsharp …)은
// 아는 것만 칠하므로 자연히 걸러진다.
let hljs = null;
try { hljs = require('highlight.js'); } catch { /* 색 없이 진행 */ }

const HL_LANG = {
  java: 'java', kotlin: 'kotlin', sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
  xml: 'xml', html: 'xml', css: 'css', less: 'less', scss: 'scss',
  javascript: 'javascript', js: 'javascript', jsx: 'javascript',
  typescript: 'typescript', ts: 'typescript', tsx: 'typescript',
  bash: 'bash', sh: 'bash', shell: 'bash', properties: 'properties', gradle: 'gradle',
  dockerfile: 'dockerfile', python: 'python', c: 'c', cpp: 'cpp', swift: 'swift',
  markdown: 'markdown', md: 'markdown', diff: 'diff', ini: 'ini', toml: 'ini',
};

const unesc = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function highlightCode(html) {
  if (!hljs) return html;
  return html.replace(/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g, (whole, lang, code) => {
    const name = HL_LANG[lang.toLowerCase()];
    if (!name || !hljs.getLanguage(name)) return whole;
    // 문법이 어긋난 조각(설명용으로 잘라 붙인 코드)이 많아 중간에 멈추지 않게 한다.
    const painted = hljs.highlight(unesc(code), { language: name, ignoreIllegals: true }).value;
    return `<pre><code class="language-${lang} hljs">${painted}</code></pre>`;
  });
}

function codeBlocks(html) {
  return html
    .replace(/<pre><code(?: class="language-([^"]*)")?>/g, (_, lang) => {
      const label = LANG_LABEL[(lang || '').toLowerCase()];
      const bar = `<div class="code-bar">${label ? `<span class="code-lang">${esc(label)}</span>` : ''}<button class="code-copy" type="button" aria-label="코드 복사">복사</button></div>`;
      return `<div class="code-wrap">${bar}<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>`;
    })
    .replace(/<\/code><\/pre>/g, '</code></pre></div>');
}

// 본문의 로컬 이미지 링크를 images/ 안의 실제 파일명으로 맞춘다.
// 원본 파일명에 공백·괄호가 섞여 있어 링크가 어긋나기 쉬우므로, 파일명 앞의
// 일련번호(01_, 02_ …)를 키로 삼아 실제 파일을 찾는다.
function fixImageLinks(body, slug) {
  const dir = path.join(CONTENT, slug, 'images');
  if (!fs.existsSync(dir)) return body;
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  const byNum = {};
  for (const f of files) {
    const m = f.match(/^(\d+)_/);
    if (m) byNum[m[1]] = f;
  }
  const used = new Set();
  const out = body.replace(/!\[[^\]]*\]\(\s*(?:\.\/)?images\/(\d+)[^\n]*?\.(?:png|jpe?g|gif|webp|svg)\)?/gi,
    (whole, num) => {
      const file = byNum[num.padStart(2, '0')] || byNum[num];
      if (!file) { console.warn(`이미지 없음: ${slug} / ${num}`); return whole; }
      used.add(file);
      return `![](images/${file})`;
    });
  // 번호 접두어가 없는 파일은 위 정규식에 걸리지 않으므로 본문에 이름이 있는지로 확인한다.
  const missing = files.filter(f => !used.has(f) && !out.includes(f));
  if (missing.length) console.warn(`본문에 삽입되지 않은 이미지: ${slug} → ${missing.join(', ')}`);
  return out;
}

// 그림에 설명문(alt)을 채운다. 화면을 못 보는 분에게는 이것이 그림의 전부이고,
// 검색엔진도 이 글을 읽는다. 원본에는 하나도 없어서, 그림 바로 앞의 소제목을
// 가져다 쓴다. 그림 자체를 묘사하진 못해도 "무엇을 설명하는 그림인지"는 전한다.
function fillAltText(body) {
  const lines = body.split('\n');
  let heading = null, inCode = false, n = 0;
  const out = lines.map(line => {
    if (/^```/.test(line)) { inCode = !inCode; return line; }
    if (inCode) return line;
    const h = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (h) { heading = h[1].replace(/[*`#]/g, '').trim(); n = 0; return line; }
    return line.replace(/^(\s*)!\[\]\(/, (m, indent) => {
      if (!heading) return m;
      n++;
      const label = n > 1 ? `${heading} — 그림 ${n}` : heading;
      return `${indent}![${label.replace(/[[\]]/g, '')}](`;
    });
  });
  return out.join('\n');
}

// ---------- 콘텐츠 로드 ----------
const posts = [];
for (const meta of postMeta) {
  const mdPath = path.join(CONTENT, meta.slug, 'index.md');
  if (!fs.existsSync(mdPath)) { console.warn('누락:', meta.slug); continue; }
  const raw = fs.readFileSync(mdPath, 'utf8');
  const parsed = parseFrontmatter(raw);
  const attrs = parsed.attrs;
  const body = fillAltText(demoteHeadings(fixImageLinks(parsed.body, meta.slug)));
  const plain = stripMd(body);
  const firstImg = (body.match(/!\[[^\]]*\]\((images\/[^)]+)\)/) || [])[1] || null;
  posts.push({
    ...meta,
    title: cleanTitle(attrs.title || meta.slug, Boolean(meta.series)),
    tags: attrs.tags || [],
    summary: attrs.summary || '',
    body, plain,
    minutes: readingTime(plain, body),
    thumb: firstImg,
    catName: config.categories[meta.category].name,
    url: `posts/${meta.slug}/`,
    commit: commitOf[meta.slug] || null,
  });
}

// 최신 글이 먼저 오도록 정렬한다. 작성일을 아는 글이 먼저고, 모르는 글은
// 그 뒤에 둔다. 모르는 시점을 가늠한 값(order)은 저희끼리 앞뒤를 맞추는 데만
// 쓴다. 예전에는 이 값을 날짜와 같은 줄에 세웠는데, 가늠한 값이 올해 초로
// 잡히는 바람에 날짜도 안 보이는 글이 최신 글 자리를 계속 차지했다.
//
// 연재는 한 덩어리로 다룬다. 편마다 쓴 날이 달라 그대로 날짜순으로 세우면
// 8편이 1편보다 위에 오는 식으로 흩어져 읽는 순서가 무너지기 때문이다.
// 연재가 놓일 자리는 그 연재에서 가장 최근에 쓴 날로 정하고, 안에서는 1편부터
// 차례로 붙인다.
const when = p => (p.date ? `1 ${p.date}` : `0 ${p.order || '0000-00-00'}`);
const seriesLatest = {};
for (const p of posts) {
  if (!p.series) continue;
  const w = when(p);
  if (!seriesLatest[p.series] || w > seriesLatest[p.series]) seriesLatest[p.series] = w;
}
const rank = p => (p.series ? seriesLatest[p.series] : when(p));
posts.sort((a, b) => {
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? 1 : -1;
  // 같은 자리에 선 글끼리는 같은 연재면 편 순서, 아니면 각자의 날짜순
  if (a.series && a.series === b.series) return (a.seriesOrder || 0) - (b.seriesOrder || 0);
  if (a.series !== b.series) return (a.series ? 1 : 0) - (b.series ? 1 : 0);
  return when(a) < when(b) ? 1 : -1;
});

const byCategory = {};
for (const p of posts) (byCategory[p.category] ??= []).push(p);

// 태그로도 글을 모아 볼 수 있게 한다. 한 편에만 달린 태그는 페이지를 만들어도
// 그 글 하나만 나오므로, 둘 이상에 달린 것만 추린다.
// 디렉터리는 사람이 읽는 이름 그대로 만들고, 주소에 넣을 때만 인코딩한다.
// 인코딩한 문자열로 폴더를 만들면 브라우저가 주소를 되돌려 요청하면서 어긋난다.
// 한글 태그를 주소에 그대로 쓰면 북마크하거나 공유할 때 %ED%81%B4… 같은
// 알아볼 수 없는 문자열이 된다. data/tag-slugs.json에 적어 둔 영문 이름을 쓰고,
// 화면에 보이는 태그 이름은 원문 그대로 둔다.
const TAG_SLUGS = (() => {
  const f = path.join(ROOT, 'data', 'tag-slugs.json');
  if (!fs.existsSync(f)) return {};
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete raw._comment;
  return raw;
})();
const tagSlug = t => {
  if (TAG_SLUGS[t]) return TAG_SLUGS[t];
  const s = t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
  // 영문이 하나도 남지 않는 태그(순한글)는 위 표에 넣어 두어야 한다.
  if (!s) console.warn(`태그 주소 없음: "${t}" — data/tag-slugs.json에 영문 이름을 적어 주세요`);
  return s || encodeURIComponent(t);
};
const tagHref = t => encodeURIComponent(tagSlug(t));
const byTag = {};
for (const p of posts) for (const t of p.tags) (byTag[t] ??= []).push(p);
const tagPages = Object.entries(byTag)
  .filter(([, list]) => list.length > 1)
  .sort((a, b) => b[1].length - a[1].length);
const tagLinked = new Set(tagPages.map(([t]) => t));
const seriesMap = {};
for (const p of posts) if (p.series) (seriesMap[p.series] ??= []).push(p);
for (const s of Object.values(seriesMap)) s.sort((a, b) => a.seriesOrder - b.seriesOrder);

// 연재도 태그와 같은 이유로 주소는 영문을 쓴다.
const SERIES_SLUGS = (() => {
  const f = path.join(ROOT, 'data', 'series-slugs.json');
  if (!fs.existsSync(f)) return {};
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete raw._comment;
  return raw;
})();
const seriesSlug = name => {
  if (SERIES_SLUGS[name]) return SERIES_SLUGS[name];
  const s = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
  if (!s) console.warn(`연재 주소 없음: "${name}" — data/series-slugs.json에 영문 이름을 적어 주세요`);
  return s || encodeURIComponent(name);
};
// 연재가 놓인 자리를 그 연재에서 가장 최근에 쓴 날로 본다(홈 정렬과 같은 기준).
const seriesEntries = Object.entries(seriesMap).sort((a, b) => {
  const last = l => l.map(p => p.date).filter(Boolean).sort().pop() || '0000-00-00';
  return last(b[1]) < last(a[1]) ? -1 : last(b[1]) > last(a[1]) ? 1 : 0;
});
// 연재의 기간과 대표 그림처럼 여러 곳에서 되쓰는 값
function seriesInfo(name) {
  const list = seriesMap[name];
  const dates = list.map(p => p.date).filter(Boolean).sort();
  const span = !dates.length ? ''
    : dates[0] === dates[dates.length - 1]
      ? dates[0].replace(/-/g, '.')
      : `${dates[0].replace(/-/g, '.')} — ${dates[dates.length - 1].replace(/-/g, '.')}`;
  return {
    list, span,
    href: `series/${seriesSlug(name)}/`,
    minutes: list.reduce((n, p) => n + p.minutes, 0),
    catName: list[0].catName,
    category: list[0].category,
    thumbOf: list.find(p => p.thumb) || null,
  };
}

// 링크를 공유했을 때 보이는 카드 이미지. 글마다 한 장씩 만든다.
// sharp가 없는 환경에서도 빌드는 되게 하고, 그때는 카드만 생략한다.
const ogQueue = [];
let ogCard = null;
try { ogCard = require('./scripts/og-card.js'); } catch { /* 카드 없이 진행 */ }

// 카카오톡·슬랙 같은 곳은 한 번 가져간 카드 이미지를 오래 붙들고 있다.
// 카드 모양을 고칠 때 이 숫자를 올리면 주소가 달라져 새 이미지를 다시 가져간다.
const OG_VERSION = 3;
const ogUrl = rel => `${config.baseUrl}/${rel}?v=${OG_VERSION}`;

// 홈·카테고리처럼 글이 아닌 페이지에도 대표 카드를 붙인다.
function ogForPage(title, kind, meta, name) {
  if (!ogCard) return null;
  const rel = `og/_${name}.png`;
  ogQueue.push({ out: rel, opts: { title, kind, meta, site: config.siteTitle } });
  return ogUrl(rel);
}

function ogFor(p) {
  if (!ogCard) return null;
  const rel = `og/${p.slug}.png`;
  ogQueue.push({
    out: rel,
    opts: {
      title: p.title,
      kind: p.series ? `${p.series} · ${p.seriesOrder}/${seriesMap[p.series].length}` : p.catName,
      meta: `${p.date ? p.date.replace(/-/g, '.') + ' — ' : ''}${p.minutes} min`,
      site: config.siteTitle,
    },
  });
  return ogUrl(rel);
}

// 화면 위쪽의 '홈 / 연재 / 글' 자취를 검색엔진도 읽을 수 있게 같은 내용을
// 구조화 데이터로 적어 준다. 검색 결과에 주소 대신 이 자취가 표시된다.
function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({
      '@type': 'ListItem', position: i + 1, name,
      item: `${config.baseUrl}/${url}`,
    })),
  };
}

// 누를 듯한 링크의 문서를 미리 받아 둔다. 목록에서 글로, 글에서 연재로 오가는
// 일이 잦은데 매번 흰 화면을 거쳤다. 링크에 손이 머무르면(moderate) 그때 받는다.
//
// 미리 '받기'(prefetch)만 하고 미리 '그리기'(prerender)는 하지 않는다. 미리
// 그리면 그 페이지의 스크립트까지 돌아, 읽지도 않은 글이 방문 수로 잡힌다.
// 글이 HTML 한 장뿐이라 받아 두는 것만으로도 눌렀을 때 기다릴 것이 없다.
// 모르는 브라우저는 이 줄을 무시하고 예전처럼 동작한다.
function speculationTag() {
  const base = new URL(config.baseUrl).pathname.replace(/\/$/, '');
  const rules = { prefetch: [{ where: { href_matches: `${base}/*` }, eagerness: 'moderate' }] };
  return `\n<script type="speculationrules">${JSON.stringify(rules)}</script>`;
}

// 어떤 글이 읽히는지 보려면 방문 기록이 남아야 한다. 정적 사이트라 서버 기록이
// 없어 바깥 서비스를 하나 붙인다. data/categories.json의 analytics에 값을 적을
// 때만 스크립트가 실리고, 비워 두면 아무것도 들어가지 않는다.
//   goatcounter — 가입한 이름 (https://<이름>.goatcounter.com)
//   cloudflare  — Web Analytics 토큰
// 둘 다 적혀 있으면 goatcounter를 쓴다. 두 벌을 함께 실을 이유가 없다.
function analyticsTag() {
  const a = config.analytics || {};
  const safe = (v, re) => String(v || '').replace(re, '');
  const gc = safe(a.goatcounter, /[^a-zA-Z0-9-]/g);
  if (gc) return `\n<script data-goatcounter="https://${gc}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`;
  const cf = safe(a.cloudflare, /[^a-zA-Z0-9]/g);
  if (cf) return `\n<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${cf}"}'></script>`;
  return '';
}

// ---------- 공통 템플릿 ----------
function page({ rel, title, description, canonicalPath, content, extraHead = '', shellPath = '~/tech-blog', isHome = false, ogImage = null }) {
  const canonical = `${config.baseUrl}/${canonicalPath}`;
  const tagline = isHome
    ? `<div class="site-tagline"><span class="cmt">//</span> Java, Spring, 데이터베이스, 아키텍처를 탐구하는 백엔드 개발 블로그</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(config.siteTitle)}">
${ogImage ? `<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(config.siteTitle)}" href="${config.baseUrl}/rss.xml">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${rel}assets/fonts.css?v=${assetHash}">
<link rel="stylesheet" href="${rel}assets/style.css?v=${assetHash}">
<script src="${rel}assets/theme.js?v=${assetHash}"></script>${speculationTag()}${analyticsTag()}
${extraHead}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="wrap">
 <div class="term">
  <div class="term-bar">
    <span class="dot-r"></span><span class="dot-y"></span><span class="dot-g"></span>
    <span class="term-path">${esc(shellPath)} — zsh</span>
  </div>
  <div class="term-body">
  <header class="site-header">
    <a class="brand" href="${rel}">
      <div class="prompt"><span class="arrow">➜</span> ${esc(shellPath)} <span class="paren">git:(</span><span class="branch">main</span><span class="paren">)</span></div>
      <div class="logo">코징의 개발탐방<span class="caret"></span></div>
      ${tagline}
    </a>
    <nav>
      <a href="${rel}">홈</a>
      <a href="${rel}series/">연재</a>
      <a href="${rel}tag/">태그</a>
      <a href="${rel}about/">소개</a>
      <button class="search-btn" id="search-open" aria-label="검색">⌕<span class="kbd">/</span></button>
      <button class="theme-btn" id="theme-toggle" aria-label="화면 밝기 전환">☾</button>
    </nav>
  </header>
<main id="main">
${content}
</main>
  </div>
  <div class="term-status">
    <span class="st-branch">● main</span>
    <span>${posts.length} posts</span>
    <span class="st-hide">UTF-8</span>
    <span class="st-hide">LF</span>
    <span class="st-right">© 2026 ${esc(config.author)}</span>
    <span><a href="${rel}rss.xml">RSS</a> · <a href="https://github.com/qkrxodud/tech-blog">GitHub</a></span>
  </div>
 </div>
</div>
<div class="search-overlay" id="search-overlay" hidden>
  <div class="search-box">
    <div class="search-head">
      <input type="search" id="search-input" placeholder="제목, 태그, 본문 검색…" autocomplete="off">
      <button id="search-close" aria-label="닫기">✕</button>
    </div>
    <div class="search-results" id="search-results"><div class="search-hint">검색어를 입력하시면 전체 글에서 찾아드립니다.</div></div>
  </div>
</div>
<script>window.__REL__=${JSON.stringify(rel)};</script>
<script src="${rel}assets/search.js?v=${assetHash}" defer></script>
<script src="${rel}assets/code.js?v=${assetHash}" defer></script>
<script src="${rel}assets/toc.js?v=${assetHash}" defer></script>
</body>
</html>`;
}

// 댓글은 giscus로 단다. 글마다 pathname으로 GitHub Discussions의 글타래를
// 찾고, 없으면 첫 댓글이 달릴 때 만들어진다.
function commentBox(rel) {
  const c = config.comments;
  if (!c) return '';
  return `<section class="comments">
  <h2 class="comments-head">댓글</h2>
  <p class="comments-note">GitHub 계정으로 로그인하시면 댓글과 질문을 남기실 수 있습니다. 남겨 주신 글은 이 저장소의 <a href="https://github.com/${c.repo}/discussions">Discussions</a>에 쌓입니다.</p>
  <script src="https://giscus.app/client.js"
    data-repo="${esc(c.repo)}"
    data-repo-id="${esc(c.repoId)}"
    data-category="${esc(c.category)}"
    data-category-id="${esc(c.categoryId)}"
    data-mapping="pathname"
    data-strict="1"
    data-reactions-enabled="1"
    data-emit-metadata="0"
    data-input-position="top"
    data-theme="preferred_color_scheme"
    data-lang="ko"
    data-loading="lazy"
    crossorigin="anonymous"
    async></script>
</section>`;
}

function seriesLabel(p) {
  if (!p.series) return `<div class="row-cat">${esc(p.catName.toUpperCase())}</div>`;
  const s = seriesMap[p.series];
  return `<div class="row-cat accent">${esc(p.series.toUpperCase())} · ${p.seriesOrder}/${s.length}</div>`;
}

function postRow(p, rel) {
  const thumb = p.thumb
    ? `<a class="row-thumb" href="${rel}${p.url}"><img src="${rel}posts/${p.slug}/${encodeURI(p.thumb)}" alt="" loading="lazy"></a>`
    : '';
  return `<article class="post-row">
  <div class="row-main">
    ${seriesLabel(p)}
    <h2 class="row-title"><a href="${rel}${p.url}">${esc(p.title)}</a></h2>
    <p class="row-summary">${esc(p.summary)}</p>
    <div class="row-meta">${p.date ? `${esc(p.date.replace(/-/g, '.'))} · ` : ''}${p.commit ? `<span class="sha">${esc(p.commit)}</span> · ` : ''}${esc(p.catName)} — ${p.minutes} min</div>
  </div>
  ${thumb}
</article>`;
}

// 홈에서는 연재를 한 줄로 접는다. 열 편짜리 연재가 첫 화면을 다 차지하면
// 다른 주제가 묻히기 때문이다. 대표는 첫 편으로 두어 처음부터 읽기 시작할 수
// 있게 하고, 전체 편수와 쓴 기간을 함께 보여 준다.
function seriesRow(name, rel) {
  const list = seriesMap[name];
  const lead = list[0];
  const { span, href } = seriesInfo(name);
  const withThumb = list.find(p => p.thumb);
  const thumb = withThumb
    ? `<a class="row-thumb" href="${rel}${withThumb.url}"><img src="${rel}posts/${withThumb.slug}/${encodeURI(withThumb.thumb)}" alt="" loading="lazy"></a>`
    : '';
  return `<article class="post-row">
  <div class="row-main">
    <div class="row-cat accent">${esc(name.toUpperCase())} <span class="ser-count">전체 ${list.length}편</span></div>
    <h2 class="row-title"><a href="${rel}${lead.url}">${esc(lead.title)}</a></h2>
    <p class="row-summary">${esc(lead.summary)}</p>
    <div class="row-meta">${span ? `${esc(span)} · ` : ''}${esc(lead.catName)}<a class="ser-more" href="${rel}${href}">연재 ${list.length}편 모두 보기 →</a></div>
  </div>
  ${thumb}
</article>`;
}

// ---------- 홈 ----------
function homeTabs(rel, activeSlug) {
  const tabs = [`<a class="tab${activeSlug === null ? ' active' : ''}" href="${rel}">전체</a>`];
  for (const c of config.homeTabs) {
    tabs.push(`<a class="tab${activeSlug === c ? ' active' : ''}" href="${rel}category/${c}/">${esc(config.categories[c].name)}</a>`);
  }
  const rest = Object.keys(config.categories).length - config.homeTabs.length;
  tabs.push(`<button class="tab tab-all" id="panel-toggle">모든 주제 +${rest} <span id="panel-arrow">▾</span></button>`);
  return `<div class="tabs">${tabs.join('\n')}</div>`;
}

function topicPanel(rel) {
  const cols = config.groups.map(g => {
    const items = g.categories.map(c => {
      const n = (byCategory[c] || []).length;
      return `<a href="${rel}category/${c}/"><span>${esc(config.categories[c].name)}</span><span class="count">${n}</span></a>`;
    }).join('\n');
    return `<div class="panel-col"><div class="panel-title">${esc(g.name)}</div><div class="panel-items">${items}</div></div>`;
  }).join('\n');
  return `<div class="topic-panel" id="topic-panel" hidden><div class="panel-grid">${cols}</div></div>
<script>document.addEventListener('DOMContentLoaded',function(){var t=document.getElementById('panel-toggle'),p=document.getElementById('topic-panel'),a=document.getElementById('panel-arrow');if(t)t.addEventListener('click',function(){p.hidden=!p.hidden;a.textContent=p.hidden?'▾':'▴';});});</script>`;
}

// 만들어 운영 중인 서비스를 홈 맨 위에 둔다. 글보다 먼저 보여 주고 싶은
// 것이라 탭 위에 놓았다.
function projectSection(rel) {
  if (!projects.length) return '';
  const cards = projects.map(p => {
    const stack = (p.stack || []).map(s => `<span class="pj-tag">${esc(s)}</span>`).join('');
    const related = p.postSlug && posts.some(x => x.slug === p.postSlug)
      ? `<a class="pj-post" href="${rel}posts/${p.postSlug}/">만든 이야기 →</a>` : '';
    return `<article class="pj-card">
  <a class="pj-main" href="${esc(p.url)}" target="_blank" rel="noopener">
    <div class="pj-name">${esc(p.name)}<span class="pj-go">↗</span></div>
    <div class="pj-tagline">${esc(p.tagline)}</div>
    <p class="pj-desc">${esc(p.description)}</p>
  </a>
  <div class="pj-foot">${stack}${related}</div>
</article>`;
  }).join('\n');
  return `<section class="projects">
  <div class="cmd"><span class="sig">$</span> ls projects/ <span class="cmt"># 만든 것들 — 직접 만들어 운영하고 있는 서비스입니다</span></div>
  <div class="pj-grid">${cards}</div>
</section>`;
}

const HOME_LIMIT = 24;

function buildHome() {
  const rel = './';
  // 연재는 첫 편을 만났을 때 한 줄로 접고, 나머지 편은 건너뛴다.
  const folded = new Set();
  const items = [];
  for (const p of posts) {
    if (p.series) {
      if (folded.has(p.series)) continue;
      folded.add(p.series);
      items.push(seriesRow(p.series, rel));
    } else {
      items.push(postRow(p, rel));
    }
    if (items.length >= HOME_LIMIT) break;
  }
  const rows = items.join('\n');
  const more = `<a class="more-link" href="${rel}archive/">전체 글 ${posts.length}편 보기 →</a>`;
  const listCmd = `<div class="cmd"><span class="sig">$</span> ls -lt posts/ <span class="cmt">| head -${items.length}  # 연재는 첫 편만</span></div>`;
  const content = `${projectSection(rel)}\n${homeTabs(rel, null)}\n${topicPanel(rel)}\n${listCmd}\n<div class="post-list">${rows}</div>\n${more}`;
  write('index.html', page({ rel, title: config.siteTitle, description: config.description, canonicalPath: '', content, isHome: true, ogImage: ogForPage(config.siteTitle, "blog", `글 ${posts.length}편`, "home") }));
}

// 전체 글을 카테고리별로 모아 한 페이지에 싣는다. 목록이 길어 제목만 나열한다.
function buildArchive() {
  const rel = '../';
  const sections = [];
  for (const [slug, cat] of Object.entries(config.categories)) {
    const list = byCategory[slug] || [];
    if (!list.length) continue;
    const items = list.map(p => {
      const badge = p.series ? `<span class="arc-series">${esc(p.series)} ${p.seriesOrder}</span>` : '';
      return `<li><a href="${rel}${p.url}">${esc(p.title)}</a>${badge}</li>`;
    }).join('\n');
    sections.push(`<section class="arc-section">
  <h2 class="arc-head"><a href="${rel}category/${slug}/">${esc(cat.name)}</a> <span class="arc-count">${list.length}</span></h2>
  <ul class="arc-list">${items}</ul>
</section>`);
  }
  const content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> 전체 글</div>
  <h1 class="cat-title">전체 글 <span class="cat-count">${posts.length} posts</span></h1>
  <p class="cat-desc">지금까지 쓴 글을 주제별로 모았습니다. 찾는 내용이 있으시면 검색(<code>/</code> 키)을 이용하셔도 됩니다.</p>
</div>
${sections.join('\n')}`;
  write('archive/index.html', page({
    rel, title: `전체 글 — ${config.siteTitle}`,
    description: `${config.siteTitle}의 전체 글 ${posts.length}편을 주제별로 모았습니다.`,
    canonicalPath: 'archive/', content, shellPath: '~/tech-blog/archive',
  }));
}

// ---------- 카테고리 ----------
function seriesBox(seriesName, rel, currentSlug, compact) {
  const list = seriesMap[seriesName];
  const items = list.map(p => {
    const num = String(p.seriesOrder).padStart(2, '0');
    const isCurrent = p.slug === currentSlug;
    const name = isCurrent ? `${esc(p.title)} <span class="now">← 지금 읽는 글</span>` : `<a href="${rel}${p.url}">${esc(p.title)}</a>`;
    return `<div class="series-item${isCurrent ? ' current' : ''}"><span class="num">${num}</span><span class="s-title">${name}</span></div>`;
  }).join('\n');
  const href = `${rel}series/${seriesSlug(seriesName)}/`;
  return `<div class="series-box${compact ? ' compact' : ''}">
  <div class="series-head"><div class="series-name">${compact ? '이 시리즈 · ' : '연재 · '}<a href="${href}">${esc(seriesName)}</a></div><div class="series-count">전체 ${list.length}편</div></div>
  <div class="series-list">${items}</div>
</div>`;
}

// ---------- 연재 ----------
// 연재에 속한 글이 전체의 3분의 2라서, 연재마다 제 주소를 준다. 카테고리
// 페이지는 여러 연재와 단편이 섞여 있어 "1편부터 읽기"의 입구가 되지 못한다.
function buildSeries() {
  for (const [name, list] of seriesEntries) {
    const rel = '../../';
    const info = seriesInfo(name);
    const items = list.map(p => `<article class="ser-row">
  <div class="ser-num">${String(p.seriesOrder).padStart(2, '0')}</div>
  <div class="ser-main">
    <h2 class="ser-title"><a href="${rel}${p.url}">${esc(p.title)}</a></h2>
    <p class="ser-summary">${esc(p.summary)}</p>
    <div class="ser-meta">${p.date ? `${esc(p.date.replace(/-/g, '.'))} · ` : ''}${p.minutes} min</div>
  </div>
</article>`).join('\n');

    const content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> <a href="${rel}series/">연재</a></div>
  <h1 class="cat-title">${esc(name)} <span class="cat-count">${list.length} posts</span></h1>
  <p class="cat-desc">${esc(info.span ? `${info.span} · ` : '')}${esc(info.catName)} · 다 읽는 데 약 ${info.minutes}분</p>
  <div class="ser-actions"><a class="ser-start" href="${rel}${list[0].url}">1편부터 읽기 →</a><a class="ser-cat" href="${rel}category/${info.category}/">${esc(info.catName)} 주제의 다른 글</a></div>
</div>
<div class="ser-list">${items}</div>`;

    write(`${info.href}index.html`, page({
      rel, title: `${name} — ${config.siteTitle}`,
      description: `${name} 연재 ${list.length}편입니다. ${list[0].summary}`,
      canonicalPath: info.href, content, shellPath: `~/tech-blog/series/${seriesSlug(name)}`,
      ogImage: ogForPage(name, 'series', `전체 ${list.length}편`, `ser-${seriesSlug(name)}`),
    }));
  }

  // 연재 모아 보기
  const rel = '../';
  const cards = seriesEntries.map(([name, list]) => {
    const info = seriesInfo(name);
    // 카테고리 이름이 연재 이름과 같은 경우가 있다(클린 아키텍처). 두 번 적지 않는다.
    const chip = info.catName === name ? '' : `<span class="ser-card-cat">${esc(info.catName)}</span>`;
    return `<a class="ser-card" href="${rel}${info.href}">
  <div class="ser-card-head"><span class="ser-card-n">${list.length}편</span>${chip}</div>
  <div class="ser-card-name">${esc(name)}</div>
  <div class="ser-card-first">1편 · ${esc(list[0].title)}</div>
  ${info.span ? `<div class="ser-card-when">${esc(info.span)}</div>` : ''}
</a>`;
  }).join('\n');
  const inSeries = seriesEntries.reduce((n, [, l]) => n + l.length, 0);
  const content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> 연재</div>
  <h1 class="cat-title">연재 <span class="cat-count">${seriesEntries.length}종</span></h1>
  <p class="cat-desc">한 주제를 여러 편에 걸쳐 쓴 글입니다. 전체 ${posts.length}편 가운데 ${inSeries}편이 연재에 속해 있습니다. 순서가 있으니 1편부터 읽으시면 가장 잘 읽힙니다.</p>
</div>
<div class="ser-grid">${cards}</div>`;
  write('series/index.html', page({
    rel, title: `연재 — ${config.siteTitle}`,
    description: `${seriesEntries.length}종 연재, ${inSeries}편을 순서대로 모았습니다.`,
    canonicalPath: 'series/', content, shellPath: '~/tech-blog/series',
    ogImage: ogForPage('연재', 'series', `${seriesEntries.length}종 · ${inSeries}편`, 'series-index'),
  }));
}

function buildCategories() {
  for (const [slug, cat] of Object.entries(config.categories)) {
    const rel = '../../';
    const list = byCategory[slug] || [];
    const seriesNames = [...new Set(list.filter(p => p.series).map(p => p.series))];
    const standalone = list.filter(p => !p.series);
    let content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> 주제</div>
  <h1 class="cat-title">${esc(cat.name)} <span class="cat-count">${list.length} posts</span></h1>
  <p class="cat-desc">${esc(cat.description)}</p>
</div>`;
    for (const sn of seriesNames) content += '\n' + seriesBox(sn, rel, null, false);
    if (standalone.length) {
      if (seriesNames.length) content += `\n<div class="section-label">단편 글</div>`;
      content += `\n<div class="post-list">${standalone.map(p => postRow(p, rel)).join('\n')}</div>`;
    }
    write(`category/${slug}/index.html`, page({
      rel, title: `${cat.name} — ${config.siteTitle}`, description: cat.description,
      canonicalPath: `category/${slug}/`, content, shellPath: `~/tech-blog/category/${slug}`,
      ogImage: ogForPage(cat.name, "category", `글 ${list.length}편`, `cat-${slug}`),
    }));
  }
}

// 글 끝에 붙는 "함께 읽어 볼 글". 연재 글은 이전·다음과 연재 상자가 길을
// 내주지만 단독 글은 다 읽으면 갈 곳이 없다. 태그가 겹치는 정도를 주로 보고,
// 같은 주제면 조금 더 얹는다. 같은 연재의 글은 이미 위에 목록이 있으니 뺀다.
function relatedPosts(p, howMany = 3) {
  const mine = new Set(p.tags);
  const other = q => q.slug !== p.slug && !(p.series && q.series === p.series);
  const scored = [];
  for (const q of posts) {
    if (!other(q)) continue;
    const shared = q.tags.filter(t => mine.has(t));
    if (!shared.length) continue;
    scored.push({ q, score: shared.length * 3 + (q.category === p.category ? 1 : 0), shared });
  }
  scored.sort((a, b) => b.score - a.score || ((b.q.date || '') < (a.q.date || '') ? -1 : 1));

  // 태그가 같은 연재 안에서만 겹치는 글은 여기서 빈손이 된다. 그럴 때는 같은
  // 주제의 다른 글로 채운다. 아무것도 안 보여 주는 것보다는 길이 된다.
  if (scored.length < howMany) {
    const have = new Set(scored.map(s => s.q.slug));
    for (const q of byCategory[p.category] || []) {
      if (scored.length >= howMany) break;
      if (!other(q) || have.has(q.slug)) continue;
      scored.push({ q, score: 0, shared: [] });
      have.add(q.slug);
    }
  }
  return scored.slice(0, howMany);
}

function relatedBox(p, rel) {
  const picks = relatedPosts(p);
  if (!picks.length) return '';
  const items = picks.map(({ q, shared }) => {
    // 겹치는 태그가 없어 주제만으로 고른 글은 태그 자리에 날짜를 둔다.
    const foot = shared.length
      ? `<div class="rel-tags">${shared.slice(0, 3).map(t => `#${esc(t)}`).join(' ')}</div>`
      : `<div class="rel-tags plain">${esc(q.date ? q.date.replace(/-/g, '.') : `${q.minutes} min`)}</div>`;
    return `<a class="rel-card" href="${rel}${q.url}">
  <div class="rel-cat">${esc(q.series || q.catName)}</div>
  <div class="rel-title">${esc(q.title)}</div>
  ${foot}
</a>`;
  }).join('\n');
  return `<div class="rel-box">
  <div class="rel-head">함께 읽어 볼 글</div>
  <div class="rel-grid">${items}</div>
</div>`;
}

// ---------- 글 상세 ----------
function buildPosts() {
  posts.forEach((p, i) => {
    const rel = '../../';
    // 이전/다음: 시리즈가 있으면 시리즈 순서, 없으면 카테고리 순서
    let prev = null, next = null;
    if (p.series) {
      const s = seriesMap[p.series];
      const idx = s.indexOf(p);
      prev = s[idx - 1] || null; next = s[idx + 1] || null;
    } else {
      const c = byCategory[p.category].filter(x => !x.series);
      const idx = c.indexOf(p);
      prev = c[idx - 1] || null; next = c[idx + 1] || null;
    }
    const crumbLabel = p.series ? p.series : p.catName;
    const crumbHref = p.series ? `series/${seriesSlug(p.series)}/` : `category/${p.category}/`;
    const anchored = headingAnchors(highlightCode(codeBlocks(zoomableImages(marked.parse(p.body)))));
    const bodyHtml = anchored.html;
    let content = `<div class="post-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> <a href="${rel}${crumbHref}">${esc(crumbLabel.toUpperCase())}</a>${p.series ? ` <span class="sep">· ${p.seriesOrder}/${seriesMap[p.series].length}</span>` : ''}</div>
  <h1 class="post-title">${esc(p.title)}</h1>
  <div class="post-meta">${esc(config.author)}${p.date ? ` · ${esc(p.date.replace(/-/g, '.'))}` : ''} · ${esc(p.catName)} — ${p.minutes} min</div>
  ${p.tags.length ? `<div class="post-tags">${p.tags.map(t => tagLinked.has(t)
      ? `<a class="tag" href="${rel}tag/${tagHref(t)}/">#${esc(t)}</a>`
      : `<span class="tag plain">#${esc(t)}</span>`).join(' ')}</div>` : ''}
</div>
<div class="post-main">${tocBox(anchored.toc)}<div class="post-body">${bodyHtml}</div></div>`;
    if (p.series) content += '\n' + seriesBox(p.series, rel, p.slug, true);
    if (prev || next) {
      content += `\n<div class="pn-nav">`;
      content += prev
        ? `<a class="pn prev" href="${rel}${prev.url}"><div class="pn-label">← 이전 글</div><div class="pn-title">${esc(prev.title)}</div></a>`
        : `<div class="pn empty"></div>`;
      content += next
        ? `<a class="pn next" href="${rel}${next.url}"><div class="pn-label">다음 글 →</div><div class="pn-title">${esc(next.title)}</div></a>`
        : `<div class="pn empty"></div>`;
      content += `</div>`;
    }
    content += '\n' + relatedBox(p, rel);
    content += '\n' + commentBox(rel);
    const desc = p.summary || p.plain.slice(0, 150);
    write(`posts/${p.slug}/index.html`, page({
      rel, title: `${p.title} — ${config.siteTitle}`, description: desc,
      canonicalPath: p.url, content, shellPath: `~/tech-blog/posts/${p.slug}`, ogImage: ogFor(p),
      extraHead: `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description: desc, author: { '@type': 'Person', name: config.author },
        url: `${config.baseUrl}/${p.url}`, keywords: p.tags.join(', '),
        ...(p.date ? { datePublished: p.date } : {}),
      })}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb([
        ['홈', ''],
        [crumbLabel, crumbHref],
        [p.title, p.url],
      ]))}</script>`,
    }));
    // 이미지 복사
    const imgSrc = path.join(CONTENT, p.slug, 'images');
    if (fs.existsSync(imgSrc)) {
      const imgDst = path.join(DIST, 'posts', p.slug, 'images');
      fs.mkdirSync(imgDst, { recursive: true });
      for (const f of fs.readdirSync(imgSrc)) fs.copyFileSync(path.join(imgSrc, f), path.join(imgDst, f));
    }
  });
}

// ---------- 태그 ----------
function buildTags() {
  const rel = '../../';
  for (const [tag, list] of tagPages) {
    const rows = list.map(p => postRow(p, rel)).join('\n');
    const content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> <a href="${rel}tag/">태그</a></div>
  <h1 class="cat-title">#${esc(tag)} <span class="cat-count">${list.length} posts</span></h1>
  <p class="cat-desc">카테고리를 가로질러 <strong>${esc(tag)}</strong>를 다룬 글을 모았습니다.</p>
</div>
<div class="post-list">${rows}</div>`;
    write(`tag/${tagSlug(tag)}/index.html`, page({
      rel, title: `#${tag} — ${config.siteTitle}`,
      description: `${tag}를 다룬 글 ${list.length}편을 모았습니다.`,
      canonicalPath: `tag/${tagHref(tag)}/`, content, shellPath: `~/tech-blog/tag/${tag}`,
    }));
  }

  // 태그 모아 보기. 글이 많이 달린 태그일수록 크게 보여 준다.
  const rel1 = '../';
  const max = tagPages.length ? tagPages[0][1].length : 1;
  const cloud = tagPages.map(([t, list]) => {
    const w = list.length / max;
    const size = (13 + w * 9).toFixed(1);
    const tone = w > 0.5 ? 'hot' : w > 0.2 ? 'warm' : '';
    return `<a class="tg ${tone}" href="${rel1}tag/${tagHref(t)}/" style="font-size:${size}px">${esc(t)}<span class="tg-n">${list.length}</span></a>`;
  }).join('\n');
  const content = `<div class="cat-header">
  <div class="crumbs"><a href="${rel1}">홈</a> <span class="sep">/</span> 태그</div>
  <h1 class="cat-title">태그 <span class="cat-count">${tagPages.length}개</span></h1>
  <p class="cat-desc">두 편 이상에 달린 태그입니다. 카테고리와 달리 주제를 가로질러 묶이므로, 같은 기술을 다룬 글을 한눈에 모아 볼 때 쓰시면 됩니다.</p>
</div>
<div class="tag-cloud">${cloud}</div>`;
  write('tag/index.html', page({
    rel: rel1, title: `태그 — ${config.siteTitle}`,
    description: `${tagPages.length}개 태그로 글을 모아 봅니다.`,
    canonicalPath: 'tag/', content, shellPath: '~/tech-blog/tag',
  }));
}

// ---------- 소개 ----------
// 소개 페이지의 숫자와 연재 목록은 글이 늘 때마다 손으로 고치면 금세
// 어긋난다. 글 데이터에서 그때그때 만들어 붙인다.
function aboutStats(rel) {
  const dates = posts.map(p => p.date).filter(Boolean).sort();
  const since = dates.length ? dates[0].slice(0, 4) : null;
  const tiles = [
    ['글', `${posts.length}편`],
    ['주제', `${Object.keys(config.categories).length}개`],
    ['연재', `${Object.keys(seriesMap).length}종`],
    ...(since ? [['기록 시작', `${since}년`]] : []),
  ].map(([k, v]) => `<div class="stat"><div class="stat-v">${esc(v)}</div><div class="stat-k">${esc(k)}</div></div>`).join('');

  const rows = Object.entries(seriesMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => {
      const dl = list.map(p => p.date).filter(Boolean).sort();
      const span = dl.length ? `<span class="sl-when">${esc(dl[0].slice(0, 7).replace('-', '.'))}</span>` : '';
      return `<li><a href="${rel}series/${seriesSlug(name)}/">${esc(name)}</a> <span class="sl-n">${list.length}편</span>${span}</li>`;
    }).join('\n');

  return `<h2>숫자로 보는 블로그</h2>
<div class="stats">${tiles}</div>
<h2>연재하는 글</h2>
<p>한 주제를 여러 편에 걸쳐 쓴 글들입니다. 제목을 누르시면 그 주제의 글을 순서대로 보실 수 있습니다.</p>
<ul class="series-list-about">${rows}</ul>`;
}

function buildAbout() {
  const rel = '../';
  const aboutMd = fs.readFileSync(path.join(CONTENT, 'about.md'), 'utf8');
  const content = `<div class="post-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> 소개</div>
  <h1 class="post-title">소개</h1>
</div>
<div class="post-body">${highlightCode(codeBlocks(marked.parse(aboutMd)))}\n${aboutStats(rel)}</div>`;
  write('about/index.html', page({ rel, title: `소개 — ${config.siteTitle}`, description: config.description, canonicalPath: 'about/', content, shellPath: '~/tech-blog/about' }));
}

// ---------- 검색 인덱스 / 사이트맵 / RSS / 404 ----------
function buildAux() {
  // 검색 자료는 두 벌로 나눈다. 제목·태그·요약만 담은 쪽은 가벼워 검색창을 열자마자
  // 결과가 나오고, 본문은 뒤따라 받아 붙는다. 한 벌로 두면 본문 때문에 첫 검색이
  // 내려받기를 기다린다. 두 파일은 같은 순서라 자리끼리 짝이 맞는다.
  const index = posts.map(p => ({
    title: p.title, url: p.url, category: p.catName, series: p.series || null,
    tags: p.tags, summary: p.summary, minutes: p.minutes,
  }));
  write('search-index.json', JSON.stringify(index));
  write('search-body.json', JSON.stringify(posts.map(p => p.plain.slice(0, 4000))));

  // 주소마다 마지막으로 달라진 날을 함께 적는다. 이것이 없으면 검색엔진이 214편
  // 가운데 무엇이 새것인지 알 길이 없어 다시 훑을 이유를 못 찾는다.
  // 날짜를 모르는 글에는 적지 않는다. 없는 것보다 틀린 날짜가 나쁘다.
  const newest = list => list.map(p => p.date).filter(Boolean).sort().pop() || null;
  const siteNewest = newest(posts);
  const urls = [
    ['', siteNewest], ['about/', null], ['archive/', siteNewest],
    ['tag/', siteNewest], ['series/', siteNewest],
    ...seriesEntries.map(([name]) => [`series/${seriesSlug(name)}/`, newest(seriesMap[name])]),
    ...tagPages.map(([t, list]) => [`tag/${tagHref(t)}/`, newest(list)]),
    ...Object.keys(config.categories).map(c => [`category/${c}/`, newest(byCategory[c] || [])]),
    ...posts.map(p => [p.url, p.date || null]),
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${config.baseUrl}/${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`);

  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${config.baseUrl}/sitemap.xml\n`);

  // 구독자가 리더 안에서 다 읽을 수 있도록 본문을 함께 싣는다. 다만 214편을
  // 전부 담으면 한 번 받을 때마다 1MB에 가까워지므로 최신 것만 둔다. 지난 글은
  // 사이트에서 읽으면 된다.
  const FEED_ITEMS = 30;
  // 본문의 이미지·링크는 글 폴더를 기준으로 한 상대 주소라 리더에서는 깨진다.
  // 글 주소를 앞에 붙여 절대 주소로 바꾼다.
  const absolutize = (html, postUrl) => {
    const base = `${config.baseUrl}/${postUrl}`;
    return html.replace(/(<(?:img|a)\b[^>]*?\s(?:src|href)=")([^"]+)/g, (whole, head, ref) => {
      if (/^(https?:|mailto:|#|data:)/.test(ref)) return whole;
      return head + new URL(ref, base).href;
    });
  };

  write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${esc(config.siteTitle)}</title>
<link>${config.baseUrl}/</link>
<atom:link href="${config.baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
<description>${esc(config.description)}</description>
<language>ko</language>
${posts.slice(0, FEED_ITEMS).map(p => {
  const pub = p.date ? `<pubDate>${new Date(`${p.date}T09:00:00+09:00`).toUTCString()}</pubDate>` : '';
  const body = absolutize(marked.parse(p.body), p.url);
  return `<item><title>${esc(p.title)}</title><link>${config.baseUrl}/${p.url}</link><guid>${config.baseUrl}/${p.url}</guid><description>${esc(p.summary)}</description><content:encoded><![CDATA[${body}]]></content:encoded><category>${esc(p.catName)}</category>${pub}</item>`;
}).join('\n')}
</channel></rss>`);

  const rel = './';
  write('404.html', page({
    rel, title: `페이지를 찾을 수 없습니다 — ${config.siteTitle}`, description: config.description, canonicalPath: '404.html',
    content: `<div class="post-header"><h1 class="post-title">페이지를 찾을 수 없습니다</h1></div>
<div class="post-body"><p>주소가 바뀌었거나 삭제된 페이지입니다. <a href="/tech-blog/">홈으로 돌아가시면</a> 전체 글 목록을 보실 수 있습니다.</p></div>`,
  }));
}

// ---------- 실행 ----------
function write(relPath, data) {
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
buildHome();
buildArchive();
buildCategories();
buildSeries();
buildTags();
buildPosts();
buildAbout();
buildAux();
(async () => {
  if (ogCard && ogQueue.length) {
    fs.mkdirSync(path.join(DIST, "og"), { recursive: true });
    for (const job of ogQueue) await ogCard.renderCard(job.opts, path.join(DIST, job.out));
    console.log(`공유 카드 ${ogQueue.length}장 생성`);
  }
  console.log(`빌드 완료: 글 ${posts.length}개, 카테고리 ${Object.keys(config.categories).length}개`);
})();
