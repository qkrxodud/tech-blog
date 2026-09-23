---
title: "여러 조건을 함께 만족시키기 — bool 쿼리"
tags: ["ElasticSearch", "bool쿼리", "must", "filter", "검색쿼리"]
summary: "ElasticSearch에서 2가지 이상의 조건을 동시에 만족시키는 데이터를 조회할 때 사용하는 bool 쿼리와 must, filter의 차이를 정리합니다."
---

## 2가지 이상의 조건을 만족시키는 데이터를 조회하고 싶을 때 (bool: filter, must)

1가지 조건이 아닌 2가지 이상의 조건을 만족시키는 쿼리를 작성하려면 **bool 쿼리**를 활용해야 합니다. 즉, **bool 쿼리**는 여러 쿼리를 조합하기 위해서 사용하는 개념입니다. **bool 쿼리**에는 크게 4가지 기능이 있습니다.

- must: SQL문에서의 `AND` 역할을 합니다.
- filter: SQL문에서의 `AND` 역할을 합니다.
- must_not: SQL문에서의 `NOT` 역할을 합니다.
- should: 조건을 만족하면 좋고, 아니면 말고입니다.

이 중에서 2가지 조건을 전부 만족시키는 데이터를 조회하기 위해서 `must`와 `filter`에 대해 알아보겠습니다.

filter와 must 비교입니다.

`filter`와 `must`의 가장 큰 차이는 `filter`는 score(점수)에 영향을 주지 않고, `must`는 score(점수)에 영향을 준다는 점입니다. 여기서 말하는 **score(점수)**는 검색을 할 때 관련도가 얼마나 높은지를 나타내는 수치입니다.

```json
// 기존 인덱스 삭제
DELETE /boards

// 인덱스 생성
PUT /boards
{
  "mappings": {
    "properties": {
      "board_id": {
        "type": "long"
      },
      "title": {
        "type": "text", // 유연한 검색이 필요하므로 text 타입으로 선언
        "analyzer": "nori" // 한글 데이터를 토큰으로 정확하게 나누기 위해
      },
      "category": {
        "type": "keyword" // 유연한 검색이 필요없으므로 keyword 타입으로 선언
      },
      "is_notice": { // (공지글 여부)
        "type": "boolean"
      },
      "created_at": {
        "type": "date"
      }
    }
  }
}

// 데이터 삽입
POST /boards/_doc
{
  "board_id": 1,
  "title": "엘라스틱서치는 정말 강력한 검색엔진이에요",
  "category": "자유 게시판",
  "is_notice": false,
  "created_at": "2025-05-01T12:00:00"
}

GET /boards/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "검색엔진" } } // 유연한 검색이 필요 (must)
      ],
      "filter": [
        { "term": { "category": "자유 게시판" } }, // 정확한 검색이 필요 (filter)
        { "term": { "is_notice": false } } // 정확한 검색이 필요 (filter)
      ]
    }
  }
}
```
