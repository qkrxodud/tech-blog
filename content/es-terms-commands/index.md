---
title: "RDBMS와 ElasticSearch 용어 대응시키기"
tags: ["ElasticSearch", "MySQL", "용어정리", "매핑"]
summary: "RDBMS와 ElasticSearch의 용어 차이를 정리하고, 인덱스 생성·매핑 정의·도큐먼트 삽입 같은 기본 명령어를 실습합니다."
---

RDBMS와 ES의 용어가 다르기 때문에 나중에 용어에서 헷갈리지 않게 잘 정리해야 됩니다.

이론을 들으면서 가장 헷갈렸던 것이 인덱스였습니다.

MySQL에서는 검색 시 인덱스를 사용하지만 엘라스틱서치에서는 인덱스가 테이블처럼 불리기 때문입니다.

| MySQL | Elasticsearch |
| --- | --- |
| 테이블(table) | 인덱스(index) |
| 컬럼(column) | 필드(field) |
| 레코드(record), 로우(row) | 도큐먼트(document) |
| 스키마(schema) | 매핑(mapping) |

## 인덱스 생성하기 및 조회

(MySQL 기준 테이블 생성하기)

```markdown
### 인덱스 생성
PUT /users

### 인덱스 확인
GET /users

```

## 인덱스 삭제

```markdown
### 인덱스 생성
PUT /users

### 인덱스 삭제
DELETE /boards
```

## 매핑 정의

(MySQL 기준 테이블 스키마 정의)

```markdown
### 맵핑 정의
PUT /users/_mappings
{
  "properties": {
    "name": { "type": "keyword" },
    "age": { "type": "integer" },
    "is_active": { "type": "boolean" }
  }
}

```

## 도큐먼트 삽입 및 조회

(MySQL 기준 레코드 삽입)

```markdown
# 도큐먼트 삽입
POST /users/_doc
{
  "name": "Alice",
  "age": 28,
  "is_active": true
}

```

간단한 C/R/U/D 작업을 완료하였고, 해당 명령어를 진행할 때 JSON 형태의 데이터로 검색을 진행해야 된다는 것을 알았습니다. 이어서 단어 검색과 역인덱스로 진행하도록 하겠습니다.
