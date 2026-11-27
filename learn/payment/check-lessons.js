// 학습 페이지의 장 데이터(lessons/chNN.js)를 점검한다.
//   node learn/payment/check-lessons.js        (모든 장)
//   node learn/payment/check-lessons.js 4 7    (고른 장만)
// 모양(노드·흐름·단계)이 맞는지와, 설명에 적은 숫자·코드가 원래 글에 있는지를 본다.
// 숫자와 코드가 글에 없으면 지어낸 것일 수 있어 오류로 친다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const TAGS = ['출발', '문제', '결정', '비교', '결과', '한계', '정리'];
const KINDS = ['client', 'server', 'pg', 'db', 'kafka', 'scheduler', 'service', 'ops'];
const FLOWS = ['req', 'res', 'fail', 'event', 'write', 'query'];
const TONES = ['ok', 'warn', 'bad', 'info', 'muted', undefined];

const only = process.argv.slice(2).map(Number);
const chapters = only.length ? only : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
let errors = 0, warnings = 0;

for (const ch of chapters) {
  const file = path.join(__dirname, 'lessons', `ch${String(ch).padStart(2, '0')}.js`);
  const err = (m) => { errors++; console.log(`  오류 ${m}`); };
  const warn = (m) => { warnings++; console.log(`  경고 ${m}`); };
  console.log(`${ch}장`);
  if (!fs.existsSync(file)) { err('파일 없음'); continue; }
  const ctx = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx); } catch (e) { err('문법: ' + e.message); continue; }
  const L = ctx.window.LESSONS && ctx.window.LESSONS[ch];
  if (!L) { err(`window.LESSONS[${ch}]가 없음`); continue; }

  const postFile = path.join(ROOT, 'content', L.slug || '', 'index.md');
  if (!fs.existsSync(postFile)) { err(`글 없음: ${L.slug}`); continue; }
  const post = fs.readFileSync(postFile, 'utf8');
  const flat = post.replace(/\s+/g, ' ');
  // 코드 블록 안의 '## ...' 줄은 소제목이 아니라 "글에서 보기" 링크가 닿지 않는다.
  let inCode = false;
  const headings = post.split('\n').filter((l) => {
    if (/^```/.test(l)) { inCode = !inCode; return false; }
    return !inCode && /^#{2,3} /.test(l);
  }).map((l) => l.replace(/^#+ /, '').trim());

  for (const k of ['title', 'goal', 'branch']) if (!L[k]) err(`${k} 없음`);
  const ids = new Set();
  for (const n of L.nodes || []) {
    if (ids.has(n.id)) err(`노드 id 겹침: ${n.id}`);
    ids.add(n.id);
    if (!KINDS.includes(n.kind)) err(`노드 ${n.id} kind: ${n.kind}`);
    if (!(n.x >= 85 && n.x <= 915 && n.y >= 100 && n.y <= 470)) err(`노드 ${n.id} 자리가 화면 밖: ${n.x},${n.y}`);
    if (n.label && n.label.length > 9) warn(`노드 ${n.id} 이름이 김: ${n.label}`);
  }
  const nodes = [...(L.nodes || [])];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (Math.abs(a.x - b.x) < 200 && Math.abs(a.y - b.y) < 150) err(`노드 ${a.id}·${b.id}가 너무 가까움`);
  }
  const edge = (e, where) => { if (!ids.has(e[0]) || !ids.has(e[1])) err(`${where} 선의 노드 없음: ${e[0]}-${e[1]}`); };
  (L.edges || []).forEach((e) => edge(e, '기본'));

  const steps = L.steps || [];
  if (steps.length < 8 || steps.length > 16) warn(`단계 수 ${steps.length} (8~16 권장)`);
  (L.learn || []).forEach((it) => { if (!(it.step >= 0 && it.step < steps.length)) err(`learn 단계 번호 밖: ${it.text}`); });

  steps.forEach((s, i) => {
    const at = `${i + 1}단계`;
    if (!TAGS.includes(s.tag)) err(`${at} tag: ${s.tag}`);
    if (!s.short || s.short.length > 8) warn(`${at} short가 없거나 김: ${s.short}`);
    if (!s.title) err(`${at} title 없음`);
    if (!Array.isArray(s.body) || !s.body.length) err(`${at} body 없음`);
    if (s.src && !headings.includes(s.src)) err(`${at} src 소제목이 글에 없음: ${s.src}`);
    if (!s.src) warn(`${at} src 없음`);
    (s.edges || []).forEach((e) => edge(e, at));
    (s.hide || []).concat(s.focus || []).forEach((id) => { if (!ids.has(id)) err(`${at} 없는 노드: ${id}`); });
    const checkStates = (st, where) => Object.keys(st || {}).forEach((id) => {
      if (!ids.has(id)) err(`${where} 없는 노드 상태: ${id}`);
      if (!TONES.includes(st[id].tone)) err(`${where} tone: ${st[id].tone}`);
    });
    checkStates(s.states, at);
    const flows = [];
    (s.flows || []).forEach((f) => (Array.isArray(f) ? flows.push(...f) : flows.push(f)));
    flows.forEach((f) => {
      if (f.from) {
        if (!ids.has(f.from) || !ids.has(f.to)) err(`${at} 흐름의 노드 없음: ${f.from}→${f.to}`);
        if (!FLOWS.includes(f.kind || 'req')) err(`${at} 흐름 kind: ${f.kind}`);
        const all = (L.edges || []).concat(s.edges || []);
        if (!all.some((e) => (e[0] === f.from && e[1] === f.to) || (e[0] === f.to && e[1] === f.from))) warn(`${at} 선 없이 흐름: ${f.from}→${f.to}`);
      } else if (!ids.has(f.at)) err(`${at} at 노드 없음: ${f.at}`);
      if (f.label && f.label.length > 26) warn(`${at} 흐름 이름이 김: ${f.label}`);
      checkStates(f.then, at);
    });

    // 사실 대조: 설명·지표·흐름 이름에 나온 숫자와 `코드`가 글에 있어야 한다.
    const texts = [...s.body, s.note || '', s.title, ...(s.changed || []).map((c) => c[1]),
      ...(s.metrics || []).map((m) => m.value), ...flows.map((f) => f.label || '')];
    Object.values(s.states || {}).concat(...flows.map((f) => Object.values(f.then || {})))
      .forEach((st) => texts.push(st.badge || '', st.note || ''));
    for (const t of texts) {
      for (const code of t.match(/`([^`]+)`/g) || []) {
        const c = code.slice(1, -1);
        if (!flat.includes(c)) err(`${at} 글에 없는 코드: ${c}`);
      }
      for (const num of t.replace(/`[^`]+`/g, '').match(/\d+(?:[.,]\d+)*/g) || []) {
        if (num.length >= 2 && !flat.includes(num)) err(`${at} 글에 없는 숫자: ${num} (「${t.slice(0, 40)}」)`);
      }
    }
  });
}
// 이야기 대본(talks/talkNN.js): 단계 수가 같고, 숫자와 `코드`가 글에 있어야 한다.
for (const ch of chapters) {
  const file = path.join(__dirname, 'talks', `talk${String(ch).padStart(2, '0')}.js`);
  const lessonFile = path.join(__dirname, 'lessons', `ch${String(ch).padStart(2, '0')}.js`);
  const err = (m) => { errors++; console.log(`  오류 ${ch}장 대본: ${m}`); };
  if (!fs.existsSync(file)) { err('파일 없음'); continue; }
  const ctx = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(lessonFile, 'utf8'), ctx);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
  } catch (e) { err('문법: ' + e.message); continue; }
  const L = ctx.window.LESSONS[ch], T = ctx.window.TALKS && ctx.window.TALKS[ch];
  if (!Array.isArray(T)) { err(`window.TALKS[${ch}]가 없음`); continue; }
  if (T.length !== L.steps.length) err(`단계 수 ${T.length} ≠ 장 데이터 ${L.steps.length}`);
  const flat = fs.readFileSync(path.join(ROOT, 'content', L.slug, 'index.md'), 'utf8').replace(/\s+/g, ' ');
  T.forEach((lines, i) => {
    const at = `${i + 1}단계`;
    if (!Array.isArray(lines) || lines.length < 2) { err(`${at} 대사가 2줄 미만`); return; }
    if (lines.length > 7) err(`${at} 대사가 7줄 넘음`);
    lines.forEach((l) => {
      if (l.who !== 'host' && l.who !== 'dev') err(`${at} who: ${l.who}`);
      if (!l.text) { err(`${at} 빈 대사`); return; }
      if (l.text.length > 200) err(`${at} 대사가 200자 넘음`);
      for (const code of l.text.match(/`([^`]+)`/g) || []) {
        if (!flat.includes(code.slice(1, -1))) err(`${at} 글에 없는 코드: ${code}`);
      }
      for (const num of l.text.replace(/`[^`]+`/g, '').match(/\d+(?:[.,]\d+)*/g) || []) {
        if (num.length >= 2 && !flat.includes(num)) err(`${at} 글에 없는 숫자: ${num} (「${l.text.slice(0, 40)}」)`);
      }
    });
  });
}
console.log(`\n오류 ${errors}, 경고 ${warnings}`);
process.exit(errors ? 1 : 0);
