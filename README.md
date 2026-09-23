# 코징의 개발탐방

Java · Spring · 데이터베이스 · 아키텍처를 다루는 기술 블로그입니다.
의존성 없는 정적 사이트 생성기로, 마크다운을 읽어 `dist/`에 HTML을 만듭니다.

## 실행

```bash
npm install
npm run build   # dist/ 생성
npm run serve   # http://localhost:4173 에서 미리보기
```

`main` 브랜치에 푸시하면 GitHub Actions가 빌드해 GitHub Pages로 배포합니다.

## 구조

```
content/<slug>/index.md     글 본문 (frontmatter + 마크다운)
content/<slug>/images/      글에 들어가는 이미지
data/posts.json             글 목록 — slug, 카테고리, 시리즈, 순서
data/categories.json        카테고리 정의, 그룹, 사이트 메타
assets/                     스타일시트와 검색 스크립트
build.js                    빌드 스크립트
scripts/check.js            빌드 결과 점검 (링크, 문체, 편집 흔적)
scripts/CONVERT_RULES.md    노션 글을 옮길 때의 규칙
scripts/LECTURE_RULES.md    강의 수강 노트를 옮길 때의 규칙
```

## 강의 수강 노트에 대하여

강의를 들으며 정리한 노트가 상당수 있습니다. 이 글들은 **이미지를 싣지 않습니다.** 원본 노트의 그림이 대부분 유료 강의 슬라이드 캡처라 그대로 옮길 수 없기 때문입니다. 대신 글 끝에 어떤 강의를 듣고 정리했는지 출처를 답니다. 자세한 기준은 `scripts/LECTURE_RULES.md`에 있고, `scripts/check.js`가 이 글들에 이미지가 딸려 들어오지 않았는지 확인해 줍니다.

출처 줄은 `scripts/normalize-attribution.js`가 한 가지 형식으로 맞춰 줍니다. 강의마다 문구가 정해져 있으니, 새 강의 노트를 옮겼다면 그 스크립트의 표에 한 줄 더하고 돌리면 됩니다.

그림을 빼고 나면 소제목만 남고 내용이 비는 자리가 생깁니다. 이때 없는 설명을 지어내지 말고, 소제목이 하던 말을 본문 문장으로 풀어 쓰거나 소제목을 없애세요. `check.js`가 이런 자리를 찾아 줍니다.

## 글 추가하기

`content/<slug>/index.md`를 만들고 frontmatter를 채웁니다.

```markdown
---
title: "글 제목"
tags: ["태그1", "태그2"]
summary: "목록에 노출될 한두 문장 소개입니다."
---

본문을 존댓말로 작성합니다.
```

그다음 `data/posts.json`에 항목을 추가합니다. `date`에 작성일(`"2026-09-03"`)을 적으면 글 목록에 날짜가 뜨고 최신순 정렬에 반영됩니다. 연재물이면 `series`와 `seriesOrder`를 함께 적으면 시리즈 목록과 이전/다음 링크가 자동으로 연결됩니다.

```json
{ "slug": "my-post", "category": "spring", "series": "시리즈명", "seriesOrder": 3 }
```

카테고리를 새로 만들려면 `data/categories.json`의 `categories`에 항목을 추가하고, `groups` 중 한 곳에 이름을 넣어 "모든 주제" 패널에 노출시킵니다.

## 글 순서와 작성일

글은 최신순으로 정렬됩니다. 기준은 `data/posts.json`의 두 필드입니다.

- `date` — 확인된 작성일입니다. 화면과 RSS에 그대로 나옵니다.
- `order` — 날짜를 모르는 글의 정렬용 값입니다. **화면에는 나오지 않습니다.**

노션에서 옮겨 온 글 중 상당수는 작성일 기록이 없었습니다. 있는 것은 데이터베이스 CSV와 본문 속성 줄에서 모았고(`scripts/collect-dates.js`), 없는 것은 노션 페이지 ID가 생성 순서를 따른다는 점을 이용해 앞뒤만 가늠했습니다(`scripts/collect-order.js`). 가늠한 시점을 작성일인 양 띄우지 않으려고 `order`로 따로 둡니다. 둘 다 없는 옛 글은 목록 뒤쪽에 놓이며, 연재 안에서는 편 순서를 지킵니다.

두 스크립트는 노션 내보내기 폴더가 있을 때만 의미가 있습니다. 새 글은 `date`를 직접 적는 편이 정확합니다.

## 빌드가 해주는 일

- 제목 앞의 `[Java]`, `[Clean Code]` 같은 접두어 정리 — 화면에 카테고리·시리즈 라벨이 따로 붙기 때문입니다. 다만 떼면 뜻이 흐려지는 짧은 제목은 대괄호만 벗깁니다.
- 본문 이미지 링크를 `images/` 안의 실제 파일과 일련번호 기준으로 대조해 교정
- 전문 검색 인덱스(`search-index.json`), `sitemap.xml`, `rss.xml`, `robots.txt` 생성
- 글마다 JSON-LD(BlogPosting)와 Open Graph 메타 태그 삽입

## 댓글

글마다 아래쪽에 댓글란이 있습니다. [giscus](https://giscus.app)를 쓰며, 댓글은 이 저장소의 [Discussions](https://github.com/qkrxodud/tech-blog/discussions)에 쌓입니다. 글과 글타래는 URL 경로로 연결되고, 첫 댓글이 달릴 때 글타래가 자동으로 만들어집니다.

댓글을 남기려면 GitHub 로그인이 필요합니다. 설정값(저장소 ID, 카테고리 ID)은 `data/categories.json`의 `comments`에 모여 있습니다.

동작하려면 저장소에 [giscus 앱](https://github.com/apps/giscus)이 설치되어 있어야 하고, Discussions가 켜져 있어야 합니다. 둘 중 하나라도 빠지면 댓글란 자리에 안내 문구가 대신 뜹니다.

## 태그

글에 단 태그 중 **두 편 이상에 달린 것**은 목록 페이지가 생깁니다(`/tag/<이름>/`). 카테고리가 큰 갈래라면 태그는 그걸 가로지르는 갈래여서, 같은 기술을 다룬 글을 모아 볼 때 씁니다. 헤더의 "태그"에서 전체를 볼 수 있고, 많이 달린 태그일수록 크게 보입니다.

같은 말이 여러 표기로 갈리면 따로 묶이므로(`Java`와 `자바`), `scripts/normalize-tags.js`의 표에 대표 표기를 적어 두고 돌리면 한 번에 맞춰집니다.

## 공유 카드

글을 링크로 공유하면 터미널 창 모양의 카드가 썸네일로 뜹니다. `scripts/og-card.js`가 제목·연재 위치·날짜를 넣어 빌드할 때마다 그립니다(`dist/og/<slug>.png`). `sharp`를 쓰며, 설치돼 있지 않으면 카드만 빠지고 빌드는 그대로 됩니다.

## 화면 밝기

기기 설정을 따르고, 헤더의 버튼으로 바꾸면 그 선택을 기억합니다. 색은 `assets/style.css` 맨 위의 변수로 모여 있어 `:root`와 `:root[data-theme="dark"]` 두 벌만 손보면 전체가 바뀝니다.

## 그림

`scripts/to-webp.js`를 돌리면 본문 그림을 무손실 WebP로 바꾸고 마크다운 링크까지 고쳐 줍니다. 다이어그램·스크린샷이라 화질 손실 없이 30% 수준으로 줄어듭니다.

그림 설명문(alt)은 빌드가 **바로 앞 소제목**에서 채웁니다. 더 정확한 설명을 넣고 싶으면 마크다운에 직접 `![설명](images/…)`으로 적으면 그대로 쓰입니다.

## 검색

헤더의 `⌕` 버튼이나 `/` 키로 검색창을 엽니다. 제목·태그·요약·본문을 대상으로 하며, 일치한 위치를 발췌해 보여줍니다. 별도 서버 없이 `search-index.json` 하나를 내려받아 브라우저에서 처리합니다.
