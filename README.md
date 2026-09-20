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

그다음 `data/posts.json`에 항목을 추가합니다. 연재물이면 `series`와 `seriesOrder`를 함께 적으면 시리즈 목록과 이전/다음 링크가 자동으로 연결됩니다.

```json
{ "slug": "my-post", "category": "spring", "series": "시리즈명", "seriesOrder": 3 }
```

카테고리를 새로 만들려면 `data/categories.json`의 `categories`에 항목을 추가하고, `groups` 중 한 곳에 이름을 넣어 "모든 주제" 패널에 노출시킵니다.

## 빌드가 해주는 일

- 제목 앞의 `[Java]`, `[Clean Code]` 같은 접두어 정리 — 화면에 카테고리·시리즈 라벨이 따로 붙기 때문입니다. 다만 떼면 뜻이 흐려지는 짧은 제목은 대괄호만 벗깁니다.
- 본문 이미지 링크를 `images/` 안의 실제 파일과 일련번호 기준으로 대조해 교정
- 전문 검색 인덱스(`search-index.json`), `sitemap.xml`, `rss.xml`, `robots.txt` 생성
- 글마다 JSON-LD(BlogPosting)와 Open Graph 메타 태그 삽입

## 검색

헤더의 `⌕` 버튼이나 `/` 키로 검색창을 엽니다. 제목·태그·요약·본문을 대상으로 하며, 일치한 위치를 발췌해 보여줍니다. 별도 서버 없이 `search-index.json` 하나를 내려받아 브라우저에서 처리합니다.
