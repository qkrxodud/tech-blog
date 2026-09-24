---
title: "검색 쿼리 기본"
tags: ["ElasticSearch","검색쿼리","match","term","terms"]
summary: "ElasticSearch의 match, term, terms 쿼리를 예제와 함께 정리하고 각각 어떤 상황에 적합한지 설명합니다."
---

## 키워드가 포함된 데이터를 조회하고 싶을 때

```json
### **인덱스 생성 및 매핑 정의하기**
PUT /boards
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text"
      }
    }
  }
}

### **데이터 삽입하기**
POST /boards/_doc
{
  "title": "편의점 과자 내돈내산 후기"
}

### **도큐먼트 검색해보기**
GET /boards/_search
{
  "query": {
    "match": {
      "title": "편의점 후기" 
    }
  }
}
```

## 특정 값과 정확하게 일치하는 데이터를 조회하고 싶을 때

- term 쿼리는 특정 값과 정확히 일치하는 모든 도큐먼트를 조회합니다.
- term 쿼리는 text를 제외한 모든 타입에서 사용합니다.

```json
### 인덱스 생성 및 정의
PUT /boards
{
  "mappings": {
    "properties": {
      "board_id": {
        "type": "long"
      },
      "category": {
        "type": "keyword"
      }
    }
  }
}

### 데이터 삽입
POST /boards/_doc
{
  "board_id": 1,
  "category": "자유 게시판"
}

POST /boards/_doc
{
  "board_id": 2,
  "category": "익명 게시판"
}

POST /boards/_doc
{
  "board_id": 3,
  "category": "광고 게시판"
}

### 도큐먼트 검색
GET /boards/_search
{
  "query": {
    "term": {
      "category": "자유"
    }
  }
}

GET /boards/_search
{
  "query": {
    "term": {
      "category": "자유게시판"
    }
  }
}

GET /boards/_search
{
  "query": {
    "term": {
      "board_id": 13
    }
  }
}

GET /boards/_search
{
  "query": {
    "term": {
      "category": "자유 게시판"
    }
  }
}

GET /boards/_search
{
  "query": {
    "term": {
      "board_id": 1
    }
  }
}

## SQL문으로
### SELECT * FROM boards WHERE category = "자유 게시판"
### SELECT * FROM boards WHERE board_id = 152
```

## 여러 개의 값 중 하나라도 일치하는 도큐먼트 조회

`SELECT * FROM boards WHERE category IN ("자유 게시판", "익명 게시판")`처럼 `category`가 `자유 게시판` 또는 `익명 게시판`인 모든 데이터를 조회하고 싶다고 가정해 보겠습니다.

```json
GET /boards/_search
{
  "query": {
    "terms": {
      "category": ["자유 게시판", "익명 게시판"]
    }
  }
}
```

> 이 글은 인프런 박재성 님의 [실전에서 바로 써먹는 Elasticsearch 입문 (검색 최적화편)](https://www.inflearn.com/course/실전-elasticsearch-입문)을 들으며 정리한 노트입니다.
