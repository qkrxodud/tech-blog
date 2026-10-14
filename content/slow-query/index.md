---
title: "슬로우 쿼리 개선"
tags: ["MySQL","슬로우 쿼리","쿼리 최적화","STRAIGHT_JOIN"]
summary: "응답에 6초 이상 걸리던 페이지의 원인을 실행계획으로 분석하고, MySQL 옵티마이저가 데이터가 적은 테이블을 드라이빙 테이블로 고르며 생긴 문제를 STRAIGHT_JOIN으로 해결한 경험을 정리합니다."
---

실무에서 특정 웹페이지에 접근하면 응답 속도가 6초 이상 걸리는 페이지가 있었습니다. 오늘은 이 문제를 해결하기 위해 원인을 분석했던 방법을 정리하겠습니다.

## 응답 시간 확인

해당 페이지는 DB 조회와 API 통신으로 데이터를 조합해서 노출합니다. 그래서 근본적인 원인이 어느 쪽인지 확인하기 위해 아래와 같이 응답 시간을 직접 측정하였습니다.

```java
 public static double measureExecutionTime(long startTime) {
        long endTime = System.nanoTime();
        return (endTime - startTime) / 1_000_000.0; // ms 단위 변환
    }
```

측정해 보니 DB 조회 응답이 느린 것을 확인하였습니다. 조회 쿼리는 아래와 같습니다.

```sql
(생략)
FROM gift_detection detection
         INNER JOIN gift_detect_result detectionResult ON detection.id = detectionResult.detection_id
         INNER JOIN gift_inspection giftInspection ON detection.id = giftInspection.detection_id
         INNER JOIN rule rule ON detection.rule_id = rule.code
WHERE detection.check_ts >= '2024-05-01'
  AND detection.check_ts <= '2025-02-12'
  AND rule.channel = 'GIFT'
  AND rule.status = 'ACTIVE'
(생략)
```

## Join을 하나씩 소거하며 확인

여기서 Join을 하나씩 소거해 가면서 응답 시간을 확인해 보았습니다.

1. rule 테이블의 조인과 조건을 삭제했을 때 응답이 6초 → 1.0~1.3초까지 빨라지는 것을 확인하였습니다.
2. 이어서 조인은 그대로 두고 조건만 하나씩 삭제해 보았습니다.
    1. channel을 삭제하였을 때는 똑같이 6초가량 걸렸습니다.
    2. status를 삭제하였을 때는 6초 → 1.0~1.3초까지 응답이 빨라졌습니다.

측정 결과를 나란히 놓으면 다음과 같습니다.

![원래 쿼리와 channel 조건 삭제는 약 6초, rule 조인·조건 삭제와 status 조건 삭제는 1.0~1.3초로 rule.status 조건이 있을 때만 느려지는 측정 결과](images/03_join-elimination.svg)

rule 테이블 전체를 빼지 않아도 `rule.status` 조건 하나만 빼면 빨라진다는 점에서, 원인을 status 조건으로 좁힐 수 있었습니다.

## 실행계획 확인

rule 테이블의 status 조건을 삭제했을 때 조회 응답이 빨라지는 이유를 확인하기 위해, MySQL Workbench에서 Explain으로 실행계획을 확인하였습니다. 결과는 아래와 같습니다.

![](images/01_image.webp)

테이블 순서를 보면 rule 테이블이 드라이빙 테이블이 되었고, detection 테이블이 드리븐 테이블이 되었습니다. 다음으로 `rule.status` 조회 조건을 삭제한 쿼리의 실행계획을 확인하였습니다.

```sql
(생략)
FROM gift_detection detection
         INNER JOIN gift_detect_result detectionResult ON detection.id = detectionResult.detection_id
         INNER JOIN gift_inspection giftInspection ON detection.id = giftInspection.detection_id
         INNER JOIN rule rule ON detection.rule_id = rule.code
WHERE detection.check_ts >= '2024-05-01'
  AND detection.check_ts <= '2025-02-12'
  AND rule.channel = 'GIFT'
(생략)
```

![](images/02_image-1.webp)

이번에는 드라이빙 테이블이 detection으로 변경된 것을 확인할 수 있습니다.

`rule.status` 조건이 들어가면 느려지는 이유는 다음과 같습니다. rule이 드라이빙 테이블로 지정되면서 조인에 사용된 rule_id가 인덱스로 사용되었고, 이 때문에 조회 조건인 detection.check_ts의 인덱스가 동작하지 않아 정렬하는 데 많은 시간이 소요되었습니다. 두 실행계획을 비교하면 다음과 같습니다.

![status 조건이 있으면 rule이 드라이빙 테이블이 되어 detection은 rule_id 인덱스로 조인되고 check_ts 인덱스를 쓰지 못해 정렬이 오래 걸리고, status 조건이 없으면 detection이 드라이빙 테이블이 되는 비교](images/04_driving-table.svg)

그렇다면 드라이빙 테이블은 왜 바뀌었는지 궁금해져서, MySQL 옵티마이저에 대해 찾아보았습니다.

---

## MySQL 옵티마이저

MySQL 옵티마이저는 SQL 쿼리를 가장 효율적으로 실행하기 위한 실행 계획을 수립하는 핵심 구성 요소입니다. 쿼리 실행 계획은 데이터를 어떻게 읽고 처리할지 결정하는 일련의 단계로, 옵티마이저는 다양한 요소를 고려하여 최적의 계획을 선택합니다.

### 옵티마이저의 주요 기능

**쿼리 분석 및 재작성**

옵티마이저는 SQL 쿼리를 분석하고 필요에 따라 재작성하여 실행 효율성을 높입니다. 예를 들어, 불필요한 조건이나 중복된 연산을 제거하거나, 쿼리 순서를 변경하여 더 나은 성능을 얻을 수 있습니다.

**실행 계획 수립**

옵티마이저는 다양한 실행 계획을 생성하고 각 계획의 비용을 추정하여 가장 효율적인 계획을 선택합니다. 이때 사용되는 비용은 CPU 사용량, 메모리 사용량, 디스크 I/O 등 다양한 요소를 종합적으로 고려합니다.

**인덱스 활용**

옵티마이저는 쿼리 실행 시 인덱스를 활용하여 데이터 접근 속도를 향상시킵니다. 적절한 인덱스를 선택하고 활용하는 것은 쿼리 성능에 큰 영향을 미칩니다.

**조인 최적화**

여러 테이블을 조인하는 쿼리의 경우, 옵티마이저는 조인 순서와 조인 방식을 선택합니다. MySQL의 기본 조인 방식은 `Nested Loop Join`이고, 8.0.18부터는 인덱스를 사용할 수 없는 조인에 Hash Join을 사용할 수 있습니다. 다른 DBMS에 있는 Merge Join(Sort Merge Join)은 MySQL에서 제공하지 않습니다.

**서브쿼리 최적화**

옵티마이저는 서브쿼리를 분석하고 필요에 따라 재작성하거나 다른 방식으로 처리하여 성능을 향상시킵니다.

**병렬 처리**

MySQL은 하나의 쿼리를 여러 스레드로 나눠 실행하는 병렬 쿼리를 일반적으로 지원하지 않습니다. 8.0.14부터 InnoDB가 클러스터 인덱스를 병렬로 읽는 기능(`innodb_parallel_read_threads`)이 추가되었지만, `SELECT COUNT(*)`와 `CHECK TABLE` 같은 일부 작업에만 적용됩니다.

---

## Nested Loop Join

Nested Loop Join(중첩 루프 조인)은 두 개의 테이블을 조인할 때 사용하는 가장 기본적인 방식입니다. 하나의 테이블(외부 테이블, Outer Table)의 각 행을 가져와 다른 테이블(내부 테이블, Inner Table)과 비교하며 매칭되는 데이터를 찾습니다.

동작 방식은 아래와 같습니다.

1. 외부 루프 (Outer Table): 첫 번째 테이블의 각 행을 하나씩 가져옵니다.
    1. 일반적으로 데이터량이 적은 테이블이 외부 테이블로 선택되는 경우가 많습니다.
2. 내부 루프 (Inner Table): 가져온 행과 조인 조건이 맞는 행을 두 번째 테이블에서 찾습니다. 내부 테이블의 조인 컬럼에 인덱스가 있으면 인덱스로 찾고, 없으면 모든 행을 비교합니다.
3. 매칭된 데이터 반환: 조인 조건을 만족하는 경우 결과에 추가하고, 다음 행으로 이동합니다.

이번 쿼리의 rule과 detection에 대입해서 그리면 다음과 같습니다.

![외부 테이블 rule의 행을 하나씩 꺼내 내부 테이블 detection에서 rule_id가 같은 행을 찾고, 매칭된 행을 결과에 추가한 뒤 다음 rule 행으로 넘어가는 Nested Loop Join](images/05_nested-loop-join.svg)

외부 테이블의 행 하나마다 내부 테이블을 한 번씩 찾기 때문에, 어느 테이블을 바깥에 두느냐에 따라 내부 테이블에서 사용하는 인덱스가 달라집니다.

---

## 원인: 데이터량이 적은 테이블이 드라이빙 테이블로 선택됨

앞에서 본 것처럼 데이터량이 적은 테이블이 외부 테이블로 선택되는 경우가 많습니다.

이번 경우 rule 테이블이 gift_detection 테이블보다 데이터가 현저하게 적습니다. 그래서 DB 옵티마이저가 데이터량이 더 적은 rule 테이블을 드라이빙(Driving) 테이블로, detection 테이블을 드리븐(Driven) 테이블로 선택하게 된 것입니다.

이 때문에 rule과 detection 테이블이 조인될 때 rule_id 인덱스를 사용하게 되었고, MySQL은 보통 한 테이블에 접근할 때 인덱스 하나를 골라 사용하기 때문에(조건에 따라 index merge로 여러 인덱스를 합치는 경우도 있습니다) 조회 조건의 detection.check_ts는 인덱스로 사용되지 않아 정렬하는 데 많은 시간이 소요되었습니다.

## 해결 방법

조회 속도를 올리는 방법으로는 아래 두 가지를 생각할 수 있습니다.

1. 조인과 조건에 사용하는 컬럼을 복합 인덱스(rule_id, check_ts)로 지정합니다.
2. `STRAIGHT_JOIN`을 통하여 FROM 절에 명시된 순서대로 조인하도록 힌트를 줍니다.

저 같은 경우 조회 조건의 컬럼이 동적으로 변하기 때문에 `STRAIGHT_JOIN`을 선택하여 해결하였습니다.

![rule_id와 check_ts 복합 인덱스로 한 인덱스에서 조인과 조회 조건을 함께 처리하는 방법과, STRAIGHT_JOIN으로 FROM 절 순서대로 detection을 드라이빙 테이블로 고정하는 방법 중 조회 조건이 동적이라 STRAIGHT_JOIN을 선택한 흐름](images/06_fix-options.svg)

---

## 요약

### 문제점

- 특정 웹페이지 로딩 속도가 6초 이상으로 느렸으며, 원인은 DB 조회 응답 시간 때문이었습니다.

### 분석 결과

- 쿼리에서 `rule` 테이블의 `status` 조건이 문제였습니다. 해당 조건을 삭제하면 응답 시간이 1초 내외로 단축되었습니다.

### 원인

- MySQL 옵티마이저가 `rule` 테이블을 드라이빙 테이블로 선택하면서 `rule_id` 인덱스가 사용되었고, 이로 인해 `detection.check_ts` 인덱스가 사용되지 않아 정렬에 많은 시간이 소요되었습니다.

### 해결 방법

- `STRAIGHT_JOIN` 힌트를 사용하여 FROM 절에 명시된 순서대로 조인하도록 유도하여 문제를 해결했습니다.

### 교훈

- MySQL 옵티마이저가 항상 최적의 실행 계획을 선택하는 것은 아니므로, 실행 계획을 확인하고 필요에 따라 힌트를 사용하여 옵티마이저의 동작을 제어해야 합니다.

오늘은 특정 페이지의 조회 속도가 느려서 해결한 경험에 대해 정리하였습니다. DB 옵티마이저가 데이터가 적은 rule 테이블을 자동으로 드라이빙 테이블로 선택해서 발생한 문제였습니다. 비슷한 경험이 있다면 `Explain`으로 실행계획을 확인해서 드라이빙 테이블과 드리븐 테이블을 확인하고, 개발자가 원하는 순서로 지정하는 방법으로 해결할 수 있을 것 같습니다.
