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
  for (const f of ['style.css', 'search.js']) {
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

function readingTime(text) {
  return Math.max(1, Math.round(text.length / 600));
}

// 제목 앞의 대괄호 접두어를 덜어낸다. 화면에는 카테고리·시리즈 라벨이 이미
// 붙으므로 "[Java] GC 튜닝" 같은 제목은 라벨과 중복된다.
const TITLE_PREFIXES = /^\s*\[(java|spring|db|git|kafka|clean[ -]?code|리뷰)\]\s*/i;
function cleanTitle(raw, inSeries) {
  let t = raw.trim();
  // 시리즈 글은 시리즈 박스가 맥락을 주므로 대괄호 접두어를 모두 덜어낸다.
  if (inSeries) t = t.replace(/^\s*\[[^\]]+\]\s*/, '');
  while (TITLE_PREFIXES.test(t)) {
    const stripped = t.replace(TITLE_PREFIXES, '');
    // 접두어를 떼면 "[Kafka] 재처리" → "재처리"처럼 뜻이 흐려지는 제목이 있다.
    // 그런 경우엔 대괄호만 벗기고 단어는 제목에 남긴다.
    if (stripped.trim().length < 10) { t = t.replace(/^\s*\[([^\]]+)\]\s*/, '$1 '); break; }
    t = stripped;
  }
  return t.replace(/\s*\(1\)\s*$/, '').trim();
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

// ---------- 콘텐츠 로드 ----------
const posts = [];
for (const meta of postMeta) {
  const mdPath = path.join(CONTENT, meta.slug, 'index.md');
  if (!fs.existsSync(mdPath)) { console.warn('누락:', meta.slug); continue; }
  const raw = fs.readFileSync(mdPath, 'utf8');
  const parsed = parseFrontmatter(raw);
  const attrs = parsed.attrs;
  const body = demoteHeadings(fixImageLinks(parsed.body, meta.slug));
  const plain = stripMd(body);
  const firstImg = (body.match(/!\[[^\]]*\]\((images\/[^)]+)\)/) || [])[1] || null;
  posts.push({
    ...meta,
    title: cleanTitle(attrs.title || meta.slug, Boolean(meta.series)),
    tags: attrs.tags || [],
    summary: attrs.summary || '',
    body, plain,
    minutes: readingTime(plain),
    thumb: firstImg,
    catName: config.categories[meta.category].name,
    url: `posts/${meta.slug}/`,
    commit: commitOf[meta.slug] || null,
  });
}

// 최신 글이 먼저 오도록 정렬한다. 작성일을 아는 글은 그 날짜로, 모르는 글은
// 노션 페이지 순서에서 가늠한 시점(order)으로 세운다.
//
// 연재는 한 덩어리로 다룬다. 편마다 쓴 날이 달라 그대로 날짜순으로 세우면
// 8편이 1편보다 위에 오는 식으로 흩어져 읽는 순서가 무너지기 때문이다.
// 연재가 놓일 자리는 그 연재에서 가장 최근에 쓴 날로 정하고, 안에서는 1편부터
// 차례로 붙인다.
const when = p => p.date || p.order || '0000-00-00';
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
const seriesMap = {};
for (const p of posts) if (p.series) (seriesMap[p.series] ??= []).push(p);
for (const s of Object.values(seriesMap)) s.sort((a, b) => a.seriesOrder - b.seriesOrder);

// ---------- 공통 템플릿 ----------
function page({ rel, title, description, canonicalPath, content, extraHead = '', shellPath = '~/tech-blog', isHome = false }) {
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
<link rel="alternate" type="application/rss+xml" title="${esc(config.siteTitle)}" href="${config.baseUrl}/rss.xml">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rel}assets/style.css?v=${assetHash}">
${extraHead}
</head>
<body>
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
      <a href="${rel}about/">소개</a>
      <button class="search-btn" id="search-open" aria-label="검색">⌕<span class="kbd">/</span></button>
    </nav>
  </header>
${content}
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
    data-theme="light"
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
  const dates = list.map(p => p.date).filter(Boolean).sort();
  const span = dates.length
    ? (dates[0] === dates[dates.length - 1]
        ? dates[0].replace(/-/g, '.')
        : `${dates[0].replace(/-/g, '.')} — ${dates[dates.length - 1].replace(/-/g, '.')}`)
    : '';
  const withThumb = list.find(p => p.thumb);
  const thumb = withThumb
    ? `<a class="row-thumb" href="${rel}${withThumb.url}"><img src="${rel}posts/${withThumb.slug}/${encodeURI(withThumb.thumb)}" alt="" loading="lazy"></a>`
    : '';
  return `<article class="post-row">
  <div class="row-main">
    <div class="row-cat accent">${esc(name.toUpperCase())} <span class="ser-count">전체 ${list.length}편</span></div>
    <h2 class="row-title"><a href="${rel}${lead.url}">${esc(lead.title)}</a></h2>
    <p class="row-summary">${esc(lead.summary)}</p>
    <div class="row-meta">${span ? `${esc(span)} · ` : ''}${esc(lead.catName)}<a class="ser-more" href="${rel}category/${lead.category}/">연재 ${list.length}편 모두 보기 →</a></div>
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
  write('index.html', page({ rel, title: config.siteTitle, description: config.description, canonicalPath: '', content, isHome: true }));
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
    const cls = isCurrent ? ' class="current"' : '';
    const name = isCurrent ? `${esc(p.title)} <span class="now">← 지금 읽는 글</span>` : `<a href="${rel}${p.url}">${esc(p.title)}</a>`;
    return `<div class="series-item"${cls}><span class="num">${num}</span><span class="s-title">${name}</span></div>`;
  }).join('\n');
  return `<div class="series-box${compact ? ' compact' : ''}">
  <div class="series-head"><div class="series-name">${compact ? '이 시리즈 · ' : '연재 · '}${esc(seriesName)}</div><div class="series-count">전체 ${list.length}편</div></div>
  <div class="series-list">${items}</div>
</div>`;
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
    }));
  }
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
    const bodyHtml = marked.parse(p.body);
    let content = `<div class="post-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> <a href="${rel}category/${p.category}/">${esc(crumbLabel.toUpperCase())}</a>${p.series ? ` <span class="sep">· ${p.seriesOrder}/${seriesMap[p.series].length}</span>` : ''}</div>
  <h1 class="post-title">${esc(p.title)}</h1>
  <div class="post-meta">${esc(config.author)}${p.date ? ` · ${esc(p.date.replace(/-/g, '.'))}` : ''} · ${esc(p.catName)} — ${p.minutes} min</div>
  ${p.tags.length ? `<div class="post-tags">${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join(' ')}</div>` : ''}
</div>
<div class="post-body">${bodyHtml}</div>`;
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
    content += '\n' + commentBox(rel);
    const desc = p.summary || p.plain.slice(0, 150);
    write(`posts/${p.slug}/index.html`, page({
      rel, title: `${p.title} — ${config.siteTitle}`, description: desc,
      canonicalPath: p.url, content, shellPath: `~/tech-blog/posts/${p.slug}`,
      extraHead: `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description: desc, author: { '@type': 'Person', name: config.author },
        url: `${config.baseUrl}/${p.url}`, keywords: p.tags.join(', '),
        ...(p.date ? { datePublished: p.date } : {}),
      })}</script>`,
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

// ---------- 소개 ----------
function buildAbout() {
  const rel = '../';
  const aboutMd = fs.readFileSync(path.join(CONTENT, 'about.md'), 'utf8');
  const content = `<div class="post-header">
  <div class="crumbs"><a href="${rel}">홈</a> <span class="sep">/</span> 소개</div>
  <h1 class="post-title">소개</h1>
</div>
<div class="post-body">${marked.parse(aboutMd)}</div>`;
  write('about/index.html', page({ rel, title: `소개 — ${config.siteTitle}`, description: config.description, canonicalPath: 'about/', content, shellPath: '~/tech-blog/about' }));
}

// ---------- 검색 인덱스 / 사이트맵 / RSS / 404 ----------
function buildAux() {
  const index = posts.map(p => ({
    title: p.title, url: p.url, category: p.catName, series: p.series || null,
    tags: p.tags, summary: p.summary, text: p.plain.slice(0, 4000), minutes: p.minutes,
  }));
  write('search-index.json', JSON.stringify(index));

  const urls = ['', 'about/', 'archive/', ...Object.keys(config.categories).map(c => `category/${c}/`), ...posts.map(p => p.url)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${config.baseUrl}/${u}</loc></url>`).join('\n')}
</urlset>`);

  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${config.baseUrl}/sitemap.xml\n`);

  write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(config.siteTitle)}</title>
<link>${config.baseUrl}/</link>
<description>${esc(config.description)}</description>
<language>ko</language>
${posts.map(p => {
  const pub = p.date ? `<pubDate>${new Date(`${p.date}T09:00:00+09:00`).toUTCString()}</pubDate>` : '';
  return `<item><title>${esc(p.title)}</title><link>${config.baseUrl}/${p.url}</link><guid>${config.baseUrl}/${p.url}</guid><description>${esc(p.summary)}</description><category>${esc(p.catName)}</category>${pub}</item>`;
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
buildPosts();
buildAbout();
buildAux();
console.log(`빌드 완료: 글 ${posts.length}개, 카테고리 ${Object.keys(config.categories).length}개`);
