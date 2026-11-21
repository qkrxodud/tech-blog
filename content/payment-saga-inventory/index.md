---
title: "Saga와 보상 트랜잭션"
tags: ["결제", "Saga", "보상 트랜잭션", "Kafka", "Transactional Outbox", "MySQL"]
summary: "재고를 다른 서비스로 나눈 뒤 결제와 재고를 함께 맞게 끝내기 위해 재고 예약 시점·Saga 진행 주체·예약 기록·답이 없을 때·확정과 해제 전달 방식을 정하고, 비교 구현과 측정으로 확인한 결과를 정리합니다."
---

이전에 [Transactional Outbox와 Kafka](../payment-outbox-kafka/)에 대해 작성하였습니다. 그 글에서는 결제 결과를 결제 상태를 바꾼 트랜잭션에서 `payment_outbox`에 남기고, 작업 잠금을 맡은 릴레이 한 대가 결제 번호를 키로 Kafka에 보내도록 했습니다. 그리고 다음 글 예고에 "재고가 다른 서비스로 나뉘면 결제가 승인 없이 끝나거나 취소됐을 때 그 서비스의 재고를 무엇으로 돌려줄지를 정해야 합니다."라고 적었습니다.

8장 [결제와 재고·포인트·쿠폰](../payment-stock-point-coupon/)까지 재고는 결제와 같은 MySQL에 있어서, 결제 상태를 바꾸는 트랜잭션에서 잡고 돌려줄 수 있었습니다. 재고가 다른 서비스로 나뉘면 결제 하나가 재고 서비스의 재고 잡기와 결제 서버의 승인·취소에 걸치게 되고, 이 둘을 한 트랜잭션으로 묶을 수 없습니다. 한쪽이 끝난 뒤 다른 쪽이 실패하면 이미 끝난 쪽을 따로 되돌려야 합니다. 이렇게 여러 서비스에 걸친 일을 서비스마다의 짧은 트랜잭션으로 나눠 차례로 진행하고, 뒤 단계가 실패하면 앞 단계를 되돌리는 일(보상 트랜잭션)을 보내는 방식을 Saga라고 부릅니다. 이 장의 Saga는 재고 예약 → 카드사 승인 → 예약 확정 또는 해제이고, 보상은 예약 해제입니다.

![10장의 Saga — 결제 하나가 재고 서비스의 재고 예약과 결제 서버의 카드사 승인에 걸쳐 한 트랜잭션으로 묶을 수 없어, 재고 예약 → 카드사 승인 → 승인이면 예약 확정, 승인 없이 끝나거나 전액 취소면 예약 해제(보상)로 진행함. 결제 서버에는 결제·쿠폰·포인트·상품·payment_outbox가 그대로 있고, 이 장에서 나눈 재고 서비스(inventory-service)는 같은 MySQL 컨테이너의 다른 스키마 inventory_service를 다른 계정으로 씀. 이 장에서 정하는 것은 재고를 언제 어떻게 잡을지, Saga 진행을 누가 쥘지, 재고 서비스가 무엇을 남길지, 예약 답을 받지 못하면 어떻게 할지, 확정과 해제를 어떻게 보낼지 다섯 가지이고, 받는 쪽의 중복 가리기·재시도·DLQ는 11장, 예약 만료는 넣지 않았음](images/00_saga-overview.svg)

오늘은 연재의 열 번째 글이자 3부 "서비스를 분리하면"의 두 번째 글로, 재고를 다른 서비스로 나눈 뒤 결제와 재고를 함께 맞게 끝내는 방법을 정리하도록 하겠습니다. 결정마다 다른 선택지를 같은 계약 테스트와 같은 측정으로 비교합니다.

범위를 먼저 밝히겠습니다. 이 장에서 새로 나눈 서비스는 재고 서비스(`inventory-service` 모듈) 하나입니다. DB는 결제 서버와 같은 MySQL 컨테이너의 다른 스키마(`inventory_service`)를 다른 계정으로 씁니다. 9장 주문 서비스와 같은 방식입니다. 쿠폰과 포인트는 8장 그대로 결제 서버에 남겼고, 상품(가격)도 결제 서버에 있습니다. Redis는 쓰지 않았습니다. 받는 쪽의 일반적인 중복 가리기·재시도·실패 모음(DLQ)은 11장 몫이라, 재고 서비스는 같은 명령이 다시 오면 예약 상태 전이로만 한 번 반영합니다. 예약이 정해진 시간 뒤 스스로 풀리는 예약 만료(TTL)는 넣지 않았습니다.

이 장의 출발 코드 앞에는 패키지를 옮긴 커밋 두 개가 있습니다. 결제 애그리거트(`Payment`·`PaymentStatus`·`CancelRequest`)가 던지는 예외가 `global/error`에 있어 domain이 global에 기대고 있었기 때문에, `ErrorCode`·`ErrorType`·`PaymentChallengeException`과 예외들을 `domain/error`로 옮기고 `global/error`에는 `GlobalExceptionHandler`와 `ErrorResponse`만 남겼습니다. 주기 작업 잠금 창구 `JobLockRepository`는 업무 규칙이 아닌 운영상의 조정 장치이고 쓰는 곳도 `ExclusiveJobRunner` 하나뿐이라 `application/payment`로 옮겼습니다.

그래서 [결제 기초: 인증, 승인, 매입, 취소와 상태 머신](../payment-state-machine/)의 `global/error` 같은 앞 글의 패키지 경로와 테스트 출력의 예외 경로(`com.example.payment.global.error.exception…`)는 지금 코드와 다릅니다. 동작과 테스트 내용은 바뀌지 않았습니다.

이 장의 코드는 [payment-challenge](https://github.com/qkrxodud/payment-challenge/tree/chapter-10)의 `chapter-10` 브랜치에 있고, 출발 코드는 `ch10-start`, 완성 코드는 `ch10` 태그입니다.

## 현재 구조: 8장 방식을 그대로 HTTP 호출로 바꾼 재고 서비스

이 장의 문제를 재현하려면 재고가 먼저 다른 서비스에 있어야 합니다. 그래서 출발 코드(`ch10-start`)에서 8장에 결제 서버 안에 있던 재고 표를 재고 서비스로 옮기고, 결제 서버의 재고 저장소(8장 `StockRepository`)를 재고 서비스 HTTP 호출(`InventoryStockClient`)로 바꿨습니다. 잡고 돌려주는 자리는 8장 그대로입니다. 인증 트랜잭션 안에서 상품마다 HTTP로 재고를 줄이고, 결제가 승인 없이 끝나거나 전액 취소되면 상태를 바꾼 그 트랜잭션 안에서 HTTP로 늘립니다. 어느 결제가 무엇을 잡았는지 남기는 기록은 없습니다.

```java
// src/main/java/com/example/payment/infrastructure/inventory/InventoryStockClient.java (ch10-start)
@Override
public boolean decrease(Long productId, int quantity) {
    try {
        return inventoryRestClient.post()
                .uri("/stocks/{productId}/decrease", productId)
                .body(new StockChangeRequest(quantity))
                .exchange((request, response) -> isDecreased(productId, response.getStatusCode().value()));
    } catch (ResourceAccessException noResponse) {
        throw new InventoryNoResponseException("product-" + productId);
    }
}

@Override
public void increase(Long productId, int quantity) {
    try {
        inventoryRestClient.post()
                .uri("/stocks/{productId}/increase", productId)
                .body(new StockChangeRequest(quantity))
                .retrieve()
                .toBodilessEntity();
    } catch (RestClientException notIncreased) {
        log.warn("Could not return stock of product {}: {}.", productId, notIncreased.getClass().getSimpleName());
    }
}
```

줄이기가 409로 답하면 재고 없음으로 보고 인증 트랜잭션째 롤백합니다. 답을 받지 못하면(시간 초과·연결 실패) 응답 없음으로 알리고, 이때도 인증 트랜잭션째 롤백해 결제는 준비 상태로 남습니다. 늘리기는 실패해도 결제 기록을 막지 않도록 로그만 남깁니다. 시간 제한은 PG와 같은 연결 1s·읽기 5s로 두었습니다.

![10장 출발 코드(ch10-start)에서 결제 하나가 지나는 순서 — 고객의 승인 요청을 받은 결제 서버가 인증 트랜잭션에서 결제 줄을 잠그고 PaymentHoldings.hold 안에서 상품마다 재고 서비스에 POST /stocks/{id}/decrease를 보내 답을 기다린 뒤(연결 1s·읽기 5s) 쿠폰·포인트를 잡고 커밋함. 409나 응답 없음이면 인증 트랜잭션째 되돌려 결제는 준비 상태로 남음. 트랜잭션 밖에서 PG 승인을 받고, recordApproval 트랜잭션에서 settleWith·releaseIfClosed를 거쳐 거절·만료·전액 취소면 POST /stocks/{id}/increase를 보내며 실패하면 로그만 남김. 재고 서비스는 상품마다 수량 한 줄만 있고 누가 잡았는지 남기지 않음](images/01_start-structure-sequence.svg)

재고 서비스는 상품마다 한 줄인 재고 표(8장 `stock`)와 `POST /stocks/{id}/decrease`·`increase` API를 가집니다. 웹 진입점이 있어 결제 서버처럼 전역 예외 처리기를 두었습니다. 결제 서버의 `stock` 표와 재고 저장소 구현은 걷어 냈습니다.

시험에서는 재고 서비스를 시험 컨텍스트마다 시험 JVM 안에 하나씩 띄우고(`InventoryServer`), 결제 서버는 시험 JVM 안의 TCP 중계(`InventoryLink`)를 거쳐 재고 서비스를 부르게 했습니다. 9장의 브로커 중계와 같은 방법이고, 중계로 세 가지를 합니다.

- 끊기(`cut`): 열린 연결을 모두 닫고, 되돌릴 때까지 새 연결도 받자마자 닫습니다.
- 답 늦추기(`slowAnswers`): 재고 서비스가 보낸 답을 정한 시간만큼 붙잡습니다. 재고 서비스는 이미 처리를 끝낸 상태입니다.
- 요청 붙잡기(`holdRequests`/`releaseRequests`): 결제 서버가 보낸 요청을 재고 서비스에 넘기지 않고 쥐고 있다가 나중에 넘깁니다. 결제 서버가 기다리다 연결을 닫아도 쥔 요청은 재고 서비스에 닿습니다(늦게 도착한 요청).

재고 서비스가 멈춘 것은 중계를 끊고 재고 서비스의 Kafka 리스너를 멈춰 만듭니다. 재고 서비스가 예약을 처리하는 중인 것은 재고 서비스 DB의 재고 줄이기를 트리거로 1초 붙잡아 만듭니다(7장 [결제 동시성 제어](../payment-concurrency/)의 `SlowWrites`와 같은 방법). 재고를 읽을 때는(`Shop.stockOf`) 결제 서버의 `payment_outbox`에 남은 것을 모두 보내고, 재고 서비스의 소비자 그룹이 토픽 끝까지 읽기를 기다린 뒤에 읽습니다. 계약에서 말하는 "결국"의 끝이 이 시점입니다.

재고 명령 토픽은 컨텍스트마다 새 이름으로 만들었습니다. 결제 번호는 컨텍스트(MySQL 컨테이너)마다 1부터 다시 매겨지기 때문에, 같은 토픽을 쓰면 다른 컨텍스트의 해제 명령이 이 재고 서비스에 빈 해제 줄을 남겨 같은 번호의 예약을 막을 수 있어서입니다.

## 현재 구조의 문제: 테스트로 재현하기

출발 코드에 아래 테스트를 먼저 작성했습니다. 앞 장들처럼 지켜야 하는 규칙은 추상 클래스(`SagaContract`)에 두고, 구현마다 상속해 같은 테스트를 돌립니다. 계약은 21개이고 다음을 봅니다.

- 재고가 모자라면 카드사에 승인을 요청하지 않고, 결제는 승인 없이 실패로 끝나며, 쓴 쿠폰·포인트를 돌려주고 재고를 그대로 두는지
- 승인된 결제의 예약은 확정되고, 카드사 거절·만료·전액 취소·보정이 승인 실패로 닫은 결제의 재고는 처음으로 돌아오는지
- 결과 모름 동안은 예약을 그대로 두고, 보정이 승인으로 닫으면 확정되는지
- 재고 서비스의 답이 늦거나, 예약을 처리하는 동안 시간 제한이 지나거나, 결제가 그만둔 요청이 나중에 도착해도 재고가 처음으로 돌아오는지
- 같은 해제나 확정이 두 번 와도 재고가 한 번만 바뀌는지
- 재고 서비스가 멈춘 동안 승인 없이 끝난 결제의 재고가 재고 서비스가 돌아온 뒤 처음으로 돌아오는지
- 재고 100개에 서버 두 대로 주문 300건이 몰려도 승인이 100건을 넘지 않고, 몇 건을 취소한 뒤 남은 재고와 승인이 남은 결제의 수량을 더하면 처음 재고인지

계약에서는 재고 서비스 읽기 시간 제한을 0.5초로 줄이고, 늦은 재고 서비스와 카드사는 1.5초 뒤에 답하게 했습니다. 아래는 답이 늦은 경우와 요청이 늦게 도착한 경우의 계약입니다.

```java
// src/test/java/com/example/payment/application/payment/SagaContract.java
@Test
@DisplayName("재고 서비스의 답이 시간 제한보다 늦어도 그 주문이 잡은 재고는 처음으로 돌아온다")
void lateInventoryAnswerReturnsStock() {
    inventory.link().slowAnswers(LATE);
    orderAndConfirm(order(productId, QUANTITY));

    inventory.link().restore();

    assertThat(shop.stockOf(productId) + approvedQuantityOf(productId)).isEqualTo(STOCK);
}

@Test
@DisplayName("해제보다 늦게 도착한 예약은 재고를 줄이지 않는다")
void reservationAfterReleaseDoesNotTakeStock() {
    inventory.link().holdRequests();
    orderAndConfirm(order(productId, QUANTITY));
    shop.settle();

    inventory.link().releaseRequests();
    inventory.link().awaitDelivered();

    assertThat(shop.stockOf(productId) + approvedQuantityOf(productId)).isEqualTo(STOCK);
}
```

여기서 밝혀 둘 것이 두 가지 있습니다. 첫째, 위 두 계약과 "해제가 예약보다 먼저 도착해도 재고는 처음보다 늘지 않는다"는 처음에 남은 재고를 처음 재고(5)와 바로 비교했습니다. 결정 1의 비교 구현(승인 먼저)에서는 답이 늦은 주문도 승인되기 때문에 남은 재고만으로는 맞지 않아, 출발 구조를 커밋한 뒤 세 계약의 비교식을 "남은 재고 + 승인이 남은 결제의 수량 = 처음 재고"로 바꿨습니다.

또 결정 4에서 계약 하나("재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다")를 더했습니다. 아래 출발 코드 결과는 바뀐 계약 21개로 출발 코드를 다시 돌린 것입니다. 출발 코드는 그대로 두고 임시 브랜치에서 계약만 얹었으며, 시험 도구에 재고 줄이기 붙잡기를 풀고 기다리는 `InventoryServer.releaseHold()` 하나를 더했습니다.

둘째, 앞 장 시험의 준비를 재고 서비스로 옮겼습니다. 8장 시험의 재고는 재고 서비스 DB에 두고, 8장 재고 줄이기 비교(잠그지 않음·`for update`·변경 번호)는 재고 서비스 안의 재고 저장소를 바꿔 끼웁니다. 같은 상품 겹침 시험(`StockContract`)은 결제 인증 기록 대신 재고 서비스의 재고 줄이기를 1초 붙잡는데, 운영 시간 제한(1초)에 걸려 두 주문이 모두 그만두었기 때문에 그 시험만 재고 서비스 시간 제한을 5초로 두었습니다. 계약 문장과 기대값은 바꾸지 않았습니다.

출발 코드에서 돌린 결과는 아래와 같습니다. 같은 실행(`./gradlew clean test`)에서 나머지 앞 장 시험은 모두 통과했습니다. 테스트 이름과 이 글의 '카드사'는 이 연재에서 PG(Mock PG)를 가리킵니다.

```text
# 태그 ch10-start 의 코드(바꾸지 않음)에 ch10 의 10장 계약(SagaContract 21개 — 비교식 3개를 바꾸고 결정 4에서 1개를 더한 것)을 얹어 ./gradlew clean test — 전체 tests=692 failures=8 errors=0 time=484.526s
## 결제와 나눈 재고를 함께 끝내기 — 운영 구현
PASS 승인 요청이 닿지 않아 카드사에서 만료된 결제를 보정이 닫으면 재고는 처음으로 돌아온다 (1.194s)
PASS 해제가 예약보다 먼저 도착해도 재고는 처음보다 늘지 않는다 (0.633s)
PASS 결과를 모르던 결제를 보정이 승인 실패로 닫으면 재고는 처음으로 돌아온다 (1.7s)
PASS 승인 결과를 모르는 동안은 재고 예약을 그대로 둔다 (1.153s)
FAIL 재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다 (1.176s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
PASS 승인된 결제를 전액 취소하면 재고는 처음으로 돌아온다 (0.174s)
FAIL 재고 서비스가 멈춘 동안 승인 없이 끝난 주문의 재고는 재고 서비스가 돌아오면 처음으로 돌아온다 (0.235s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
FAIL 해제보다 늦게 도착한 예약은 재고를 줄이지 않는다 (0.728s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
FAIL 재고 서비스가 재고가 모자라다고 답한 결제는 승인 없이 실패로 끝난다 (0.052s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: APPROVAL_FAILED but was: READY
PASS 재고 100개에 두 서버로 주문 300건이 한꺼번에 와도 승인된 주문은 100건을 넘지 않는다 (2.43s)
FAIL 결과를 모르던 결제를 보정이 승인으로 닫으면 재고 예약은 확정된다 (2.648s) | org.springframework.jdbc.BadSqlGrammarException: org.springframework.jdbc.BadSqlGrammarException: PreparedStatementCallback; bad SQL grammar [select coalesce(sum(i.quantity), 0) from stock_reservation_item i join stock_reservation r on r.reservation_id = i.reservation_id where r.status = 'CONFIRMED' and i.product_id = ?]
FAIL 승인된 주문의 재고 예약은 확정된다 (0.131s) | org.springframework.jdbc.BadSqlGrammarException: org.springframework.jdbc.BadSqlGrammarException: PreparedStatementCallback; bad SQL grammar [select coalesce(sum(i.quantity), 0) from stock_reservation_item i join stock_reservation r on r.reservation_id = i.reservation_id where r.status = 'CONFIRMED' and i.product_id = ?]
PASS 재고가 모자라 받지 않은 주문은 재고를 그대로 둔다 (0.112s)
PASS 재고 서비스가 재고가 모자라다고 답한 주문은 카드사에 승인을 요청하지 않는다 (0.043s)
PASS 카드사가 승인을 거절한 주문의 재고는 처음으로 돌아온다 (0.13s)
PASS 재고가 모자라 받지 않은 주문은 쓴 쿠폰·포인트를 돌려준다 (0.052s)
PASS 재고 서비스의 답이 시간 제한보다 늦은 주문은 카드사에 승인을 요청하지 않는다 (0.555s)
PASS 같은 해제가 두 번 와도 재고는 한 번만 돌아온다 (0.218s)
FAIL 재고 서비스의 답이 시간 제한보다 늦어도 그 주문이 잡은 재고는 처음으로 돌아온다 (0.633s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
PASS 재고 100개에 두 서버로 주문 300건이 몰린 뒤 일부를 취소해도 남은 재고와 승인이 남은 결제의 수량을 더하면 처음 재고다 (3.53s)
PASS 같은 확정이 두 번 와도 재고는 승인된 수량만큼만 줄어 있다 (0.201s)
## 잡지 못한 주문
FAIL 포인트가 모자라 받지 않은 주문은 먼저 잡은 재고와 쿠폰도 남기지 않는다 (0.174s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: Expecting actual: [4, "ISSUED"] to contain exactly (and in same order): [5, "ISSUED"] but some elements were not found: [5] and others were not expected: [4]
```

692개 중 8개가 실패했습니다. 10장 계약 21개 중 7개와 8장 계약 1개입니다. 이 장에서 다룰 문제는 다섯 가지로 나눌 수 있습니다.

첫째, 답이 늦으면 재고는 줄었는데 결제는 실패합니다. 재고 서비스의 답을 1.5초 붙잡자 결제 서버는 0.5초에 응답 없음으로 인증 트랜잭션을 롤백해 결제는 준비 상태로 남았습니다. 재고 서비스는 이미 줄여 두었기 때문에 재고는 3(처음 5)으로 남았습니다. 더한 계약인 "예약을 처리하는 동안 시간 제한이 지나는" 경우도 같은 이유로 재고 3이었습니다.

둘째, 해제와 예약의 순서가 바뀌면 재고가 틀어집니다. 출발 코드는 응답 없음이면 결제를 롤백할 뿐 해제(늘리기)를 보내지 않아서, "해제가 예약보다 먼저 도착한다"는 상황 자체가 생기지 않았고 그 계약은 통과했습니다. 대신 결제가 기다리다 그만둔 줄이기 요청이 나중에 재고 서비스에 도착하자 그대로 반영돼 재고 3으로 샜습니다. 해제가 실제로 먼저 도착하는 경우는 결정 3의 비교 구현(수량만)에서 재현했고, 그때는 재고가 7로 늘었습니다.

셋째, 같은 돌려주기가 두 번 오면 두 번 돌려줄 수 있습니다. 출발 코드에서는 재현되지 않았습니다. 출발 코드는 늘리기를 HTTP로 한 번만 보내고, 계약의 "다시 보내기"는 `payment_outbox` 줄만 다시 보내기 때문입니다. 이 문제는 결정 3의 비교 구현(수량만, 해제를 릴레이로 보냄)에서 재현했고 재고가 7이 됐습니다.

넷째, 재고 서비스가 멈춘 동안 돌려주기가 사라집니다. 재고 서비스가 멈춘 동안 승인이 거절된 결제의 늘리기는 연결에 실패해 로그만 남았고, 재고 서비스가 돌아온 뒤에도 재고는 3이었습니다. 다시 보낼 곳에 아무것도 남지 않았기 때문입니다.

다섯째, 재고 서비스가 느리면 결제 응답도 느려집니다. 이 문제는 결정 1을 고르면서 받아들인 비용이라 뒤의 측정에서 다룹니다.

![10장 출발 코드에서 재현한 문제 다섯 가지 — 1 늦은 답: 재고 서비스가 이미 재고를 줄였는데 답을 1.5초 붙잡자 결제 서버는 0.5초에 응답 없음으로 인증째 되돌려 결제는 READY, 재고는 3(처음 5)이고 처리 중 시간 초과도 재고 3. 2 순서: 중계가 줄이기 요청을 붙잡은 동안 결제가 그만두고 해제는 보내지 않았으며, 늦게 도착한 요청이 그대로 반영돼 재고 3. 해제가 먼저 도착하는 경우는 결정 3 비교에서 재고 7. 3 두 번: 출발 코드에서는 재현되지 않았고 결정 3 비교(수량만)에서 재고 7. 4 멈춤: 재고 서비스가 멈춘 동안 거절된 결제의 늘리기가 연결에 실패해 로그만 남고 돌아와도 재고 3. 5 응답 지연: 결정 1의 비용으로 측정에서 다룸. 전체 692개 중 8개가 실패했고(10장 21개 중 7개, 8장 1개는 재고 4), 재고가 모자란 결제는 READY로 남았으며 확정 계약 2개는 stock_reservation 표를 읽지 못했음](images/02_start-problems.svg)

그 밖의 실패도 있습니다. 재고가 모자란 결제는 8장처럼 인증째 롤백해 준비 상태로 남았는데, 10장 계약은 승인 없이 실패로 끝나기를 기대합니다. 확정 계약 2개는 예약 기록이 없어 `stock_reservation` 표를 읽지 못했습니다. 8장 계약 "포인트가 모자라 받지 않은 주문은 먼저 잡은 재고와 쿠폰도 남기지 않는다"는 재고를 HTTP로 먼저 줄인 뒤 포인트에서 인증 트랜잭션이 롤백돼도 재고 서비스의 재고는 돌아오지 않아 재고 4(처음 5)로 실패했습니다.

## 선택지와 트레이드오프

이 문제를 해결하면서 내린 결정은 다섯 가지입니다. 결정 번호는 글의 순서이고, 커밋은 1·3·2·4·5 순서로 했습니다. 결정 2의 비교 구현(코레오그래피)이 결정 3의 예약 기록이 있어야 돌기 때문입니다.

### 결정 1. 재고를 언제, 어떻게 잡을까

이 장에서는 인증(쿠폰·포인트)을 커밋한 뒤, 카드사에 승인을 요청하기 전에 재고 서비스에 동기 HTTP로 재고를 예약하고, 시간 제한을 연결 300ms·읽기 1s로 짧게 두기로 했습니다.

검토한 선택지는 세 가지입니다.

- 카드사 승인 전에 재고 서비스에 동기 HTTP로 예약
- 카드사 승인을 먼저 받고 Kafka로 재고 차감을 보낸 뒤, 재고가 모자라면 카드사 취소로 보상(승인 먼저)
- 완전 비동기: 결제는 '재고 확인 중'(202)으로 답하고, 예약 응답 이벤트를 받은 뒤 승인

완전 비동기는 구현하지 않았고, 비교로 돌리지 않았습니다. 승인 요청에 바로 승인이나 재고 없음으로 답하던 API 약속이 바뀌어 같은 테스트로 비교할 수 없기 때문입니다.

운영 `PaymentConfirmService`는 인증을 남긴 뒤, 카드사에 승인을 요청하기 전에 재고를 잡습니다.

```java
// src/main/java/com/example/payment/application/payment/PaymentConfirmService.java
public PaymentResult confirm(ConfirmPaymentCommand command) {
    ConfirmAttempt attempt = paymentRecorder.authenticate(command);
    if (attempt.isRepeated()) {
        return attempt.repeated();
    }
    reserveStock(attempt);
    PaymentApproval approval = requestApproval(command.paymentKey(), attempt);
    return paymentRecorder.recordApproval(command.orderId(), approval);
}

// 10장 결정 1: 카드사에 승인을 요청하기 전에 재고 서비스에 재고를 잡는다. 모자라면 결제를 승인 없이 닫고 재고 없음(409)으로 답한다.
// 10장 결정 4: 답을 받지 못하면(시간 초과·연결 실패) 카드사에 승인을 요청하지 않고 결제를 승인 없이 닫은 뒤 해제를 보낸다(504).
// 재고 서비스가 실제로 잡았든(답만 늦음), 아직 받지 못했든(요청이 늦게 도착), 아예 받지 못했든 결과가 같다 — 잡았으면 해제가 돌려주고,
// 늦게 도착하면 먼저 남은 해제에 막히고, 받지 못했으면 해제가 빈 해제 줄만 남긴다
private void reserveStock(ConfirmAttempt attempt) {
    boolean reserved;
    try {
        reserved = paymentHoldings.reserveStock(attempt.paymentId(), attempt.orderId(), attempt.items());
    } catch (InventoryNoResponseException noResponse) {
        paymentRecorder.recordStockNoResponse(attempt.orderId());
        throw noResponse;
    }
    if (reserved) {
        return;
    }
    paymentRecorder.recordStockRefused(attempt.orderId());
    throw new OutOfStockException(attempt.orderId());
}
```

결제에 담긴 상품은 한 요청으로 넘깁니다. 재고 서비스는 한 트랜잭션에서 상품 번호 순으로 줄이고, 하나라도 모자라면 아무것도 줄이지 않습니다. 결정 1을 넣은 커밋에서는 답을 받지 못했을 때도 재고가 모자란 것과 같이 닫았고, 재고 서비스가 실제로 잡았는지는 결정 4에서 다룹니다.

재고를 인증 트랜잭션 밖으로 뺀 이유는 두 가지입니다. HTTP를 기다리는 동안 결제 DB 트랜잭션과 결제 줄 잠금을 쥐지 않기 위해서이고, 포인트가 모자라 인증이 롤백될 때 재고 서비스에 이미 줄인 재고가 남지 않게 하려는 것입니다. 출발 코드에서 8장 계약 1개가 이것으로 실패했고, 결정 1 커밋에서 통과했습니다.

재고가 모자라면 결제를 승인 없이 실패(`APPROVAL_FAILED`)로 닫고 쿠폰·포인트를 돌려준 뒤 409(`OUT_OF_STOCK`)로 답합니다. 8장과 달라진 점이 있습니다. 8장에서는 재고가 모자라면 인증째 롤백해 결제가 준비 상태로 남았는데, 이제는 인증을 남긴 뒤 재고를 잡기 때문에 승인 실패로 닫습니다. 그래서 재고가 모자란 결제도 결과 상태가 되고, 9장 릴레이를 거쳐 주문 서비스에 결제 실패(`PAYMENT_FAILED`)가 갑니다. 409로 답하는 것과 카드사에 승인을 요청하지 않는 것은 8장 그대로이고, 포인트·쿠폰이 모자란 결제는 8장처럼 준비 상태로 남습니다.

시간 제한은 아래처럼 두었습니다.

```properties
# src/main/resources/application.properties
# 10장 결정 1: 카드사에 승인을 요청하기 전에 재고 서비스에 동기 HTTP 로 재고를 잡는다. 재고 서비스의 답을 기다리는 동안이 그대로 결제 응답에
# 더해지므로 시간 제한을 짧게 둔다. 재고 잡기는 재고 서비스 DB 의 짧은 트랜잭션 하나다(측정은 docs/ch10/04).
# 읽기 1s: 예약 300건 동시 최대 746ms. 연결 300ms: 새 연결 1000개 동시 최대 128ms(같은 머신 — 망을 건너는 시간은 재지 않음)
payment.inventory.base-url=http://localhost:8091
payment.inventory.connect-timeout=300ms
payment.inventory.read-timeout=1s
```

읽기 1s는 결정 1 커밋에서 정한 값이고, 뒤에 잰 예약 응답 시간으로 근거를 남겼습니다. 재고가 넉넉한 상품에 예약을 하나씩 50건 보내면 중앙값 3\~4ms·p99 6\~25ms였고, 스레드 300개에서 한꺼번에 300건 보내면 중앙값 299\~418ms·p99 539\~740ms·최대 544\~746ms였습니다. 6번(두 번 실행 × 3번) 모두 1초를 넘은 요청은 없었습니다. 1s는 300건 동시 최대보다 크고, 재고 서비스가 늦을 때 결제 응답에 더해지는 상한이 됩니다.

연결 300ms도 결정 1 커밋에서 정한 값이고, 재고 서비스 포트에 TCP 연결을 직접 맺은 시간을 뒤에 재어 근거를 더했습니다. 하나씩 50번은 최대 0\~2ms, 300개 동시는 최대 0\~86ms, 1000개 동시는 최대 1\~128ms였고, 300ms를 넘거나 실패한 연결은 6번 모두 0건이었습니다. 두 측정 모두 시험 JVM과 재고 서비스가 같은 머신(루프백)이라 망을 건너는 시간은 들어 있지 않습니다. 운영 망의 연결·응답 시간은 재지 않았고, 이 값이 운영에서도 맞다는 것은 가정입니다.

![결정 1 시간 제한 근거 — 예약 응답 시간은 하나씩 50건이 중앙 3~4ms·p99 6~25ms, 300건 동시가 중앙 299~418ms·p99 539~740ms·최대 544~746ms로 6번 모두 1초를 넘은 요청이 없어 읽기 시간 제한을 1s로 두었음. 재고 서비스 포트에 TCP 연결을 맺은 시간은 하나씩 50번 최대 0~2ms, 300개 동시 최대 0~86ms, 1000개 동시 최대 1~128ms로 300ms를 넘거나 실패한 연결이 없어 연결 시간 제한을 300ms로 두었음. 두 측정 모두 같은 머신의 루프백이라 망을 건너는 시간은 들어 있지 않고, 운영 망에서도 맞다는 것은 가정임](images/03_d1-timeout-basis.svg)

승인 먼저 비교(`ApproveFirstConfirmService`)는 카드사 승인을 먼저 받고, 승인됐으면 재고 서비스에 Kafka로 차감을 보낸 뒤 바로 답합니다. 재고 서비스가 줄이지 못했다고 답하면 결제 서버 쪽 리스너(`ApproveFirstReplyListener`)가 카드사에 전액 취소를 보내 보상합니다.

```java
// src/test/java/com/example/payment/application/payment/comparison/ApproveFirstConfirmService.java
public PaymentResult confirm(ConfirmPaymentCommand command) {
    PaymentResult result = paymentConfirmService.confirm(command);
    if (result.status() == PaymentStatus.APPROVED) {
        requestDecrease(command.orderId());
    }
    return result;
}
```

승인 먼저는 계약 21개 중 7개가 실패했습니다.

```text
## 결제와 나눈 재고를 함께 끝내기 — 비교(결정 1): 승인 먼저, Kafka 로 재고 차감, 모자라면 카드사 취소로 보상
FAIL 승인 결과를 모르는 동안은 재고 예약을 그대로 둔다 (1.157s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 3 but was: 5
FAIL 재고 서비스가 재고가 모자라다고 답한 결제는 승인 없이 실패로 끝난다 (0.2s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: APPROVAL_FAILED but was: APPROVAL_CANCELED
FAIL 재고 100개에 두 서버로 주문 300건이 한꺼번에 와도 승인된 주문은 100건을 넘지 않는다 (5.287s) | java.lang.AssertionError: java.lang.AssertionError: Expecting actual: 300L to be less than or equal to: 100L
FAIL 결과를 모르던 결제를 보정이 승인으로 닫으면 재고 예약은 확정된다 (9.181s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 2 but was: 0
FAIL 승인된 주문의 재고 예약은 확정된다 (0.286s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 2 but was: 0
FAIL 재고 서비스가 재고가 모자라다고 답한 주문은 카드사에 승인을 요청하지 않는다 (0.173s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 0 but was: 1
FAIL 재고 서비스의 답이 시간 제한보다 늦은 주문은 카드사에 승인을 요청하지 않는다 (0.168s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 0 but was: 1
```

재고가 모자란 주문도 카드사에 승인을 한 번 요청했고, 결제는 승인 취소로 끝났습니다. 재고 서비스의 답이 늦어도 카드사에 승인을 요청했습니다. 결과 모름 동안은 재고를 잡지 않아 재고가 5 그대로였습니다. 300건이 몰리자 고객은 승인 답을 300건 받았고, 재고를 넘은 주문의 취소는 그 뒤에 일어났습니다. 확정 계약 2개는 예약 기록이 없어 0이었습니다.

![결정 1 선택지 비교 — 예약 먼저(이 장에서 고름)는 인증을 커밋한 뒤 재고 서비스에 동기 HTTP로 예약하고(연결 300ms·읽기 1s) 카드사 승인 뒤 확정하며, 재고가 모자라면 카드사에 요청하지 않고 409 OUT_OF_STOCK으로 답해 계약 21개를 모두 통과함. 승인 먼저(비교)는 카드사 승인 뒤 바로 답하고 Kafka -requests로 차감을 보내 -replies 답이 모자라면 ApproveFirstReplyListener가 카드사 전액 취소로 보상해, 재고 부족에도 카드사 승인 1건, APPROVAL_CANCELED, 늦은 답에도 카드사 승인 1건, 결과 모름 동안 재고 5, 몰림에 승인 답 300, 확정 2개 0으로 7개가 실패함. 완전 비동기(202 재고 확인 중)는 API 약속이 바뀌어 구현하지 않았음. 측정 응답 중앙은 운영 18~21·1027~1038·13~16ms, 승인 먼저 28~36·28~33·27~34ms이고 승인 답은 10건과 30건임](images/04_d1-options.svg)

뒤의 측정(재고 20개 상품에 30건)에서도 같은 모양이었습니다. 승인 먼저는 재고 서비스가 늦거나 멈춰도 응답 중앙값이 보통 28\~36ms·늦음 28\~33ms·멈춤 27\~34ms로 재고 서비스와 상관없었습니다. 대신 승인 답이 30건 나갔고 그중 10건은 그 뒤 카드사 취소로 보상됐습니다.

카드사 승인 전에 잡는 이유는 8장의 "승인해 놓고 재고가 없는 결제를 만들지 않는다"는 규칙과, 승인 요청에 바로 승인이나 재고 없음으로 답하는 지금 API를 그대로 지키기 위해서입니다.

이 선택으로 치르는 비용은 두 가지입니다.

- 재고 서비스가 느리면 결제도 그만큼 느려집니다. 측정에서 재고 서비스가 답을 1.5초 늦게 주는 동안 운영의 결제 응답 중앙값은 1027\~1038ms로, 보통 때 18\~21ms에서 읽기 시간 제한(1s)만큼 늘었습니다.
- 재고 서비스가 멈추면 결제를 받지 못합니다. 멈춘 동안의 결제는 연결에 실패해 중앙값 13\~16ms 만에 승인 없이 닫혔습니다.

다른 선택이 맞는 경우도 있습니다. 결제 응답이 재고 서비스의 상태에 묶이면 안 되고, 재고가 모자란 주문을 카드사 취소로 보상해 고객 카드에 승인과 취소가 함께 남아도 괜찮다면 승인 먼저가 맞을 수 있습니다. 완전 비동기는 API 약속이 바뀌어 같은 테스트로 비교할 수 없어 돌려 보지 않았습니다.

### 결정 2. Saga 진행을 누가 쥘까

이 장에서는 Saga 진행을 결제 서버가 결제 상태로 쥐기로 했습니다(오케스트레이션). 다음 단계는 결제 상태가 정하고, 예약·확정·해제는 결제 서버가 정해 재고 서비스에 보냅니다. 재고 서비스는 결제 상태를 모른 채 받은 명령대로 예약 상태만 바꿉니다. Saga의 진행을 한 곳이 쥐고 참여자에게 명령하는 방식을 오케스트레이션, 참여자가 서로의 이벤트를 보고 스스로 움직이는 방식을 코레오그래피라고 부릅니다.

검토한 선택지는 두 가지입니다.

- 오케스트레이션: 결제 서버가 상태 전이를 재고 단계로 바꿔 명령을 보냄
- 코레오그래피: 결제 서버는 예약만 하고, 재고 서비스가 9장 결제 이벤트를 읽어 스스로 확정·해제

결제 서버에서 상태 전이를 재고 단계로 바꾸는 곳은 `PaymentHoldings.settle` 하나입니다. 결제를 바꾸는 기록 다섯 곳(승인 답 기록, 결과 모름 보정, 취소 답 기록, 취소 보정, 알림 반영)이 상태를 바꾼 바로 뒤에 이 메서드를 부릅니다. 승인 결과를 기다리던 결제가 승인되면 확정, 재고를 쥔 결제가 승인 실패·만료·승인 취소·매입 취소가 되면 해제입니다.

```java
// src/main/java/com/example/payment/application/payment/PaymentHoldings.java
// 10장 결정 3: 결제를 바꾸는 기록이 상태를 바꾼 바로 뒤에 부른다. 승인으로 닫았으면 재고 예약을 확정하고,
// 승인 없이 끝냈거나 승인을 모두 취소했으면 잡아 둔 것을 돌려준다(재고 예약은 해제)
public void settle(Payment payment, PaymentStatus before) {
    confirmIfApproved(payment, before);
    releaseIfClosed(payment, before);
}

private void confirmIfApproved(Payment payment, PaymentStatus before) {
    if (payment.confirmsHoldingsFrom(before) && payment.hasItems()) {
        stockCommands.confirm(payment);
    }
}
```

확정할 때인지는 결제가 판단합니다.

```java
// src/main/java/com/example/payment/domain/payment/Payment.java
// 10장 결정 3: 이 상태(before)에서 지금 상태로 오며 승인이 정해졌는가(승인 결과를 기다리던 결제가 승인됨) — 잡아 둔 재고를 확정할 때다
public boolean confirmsHoldingsFrom(PaymentStatus before) {
    return before.isAwaitingApprovalResult() && status.holdsApproval();
}
```

코레오그래피 비교에서는 결제 서버가 확정·해제를 보내지 않고 쿠폰·포인트만 돌려줍니다(`ChoreographyHoldings`). 재고 서비스 쪽에 끼운 리스너가 결제 이벤트(9장 결제 결과, `payment_outbox` → 릴레이 → Kafka)를 읽고 스스로 정합니다.

```java
// src/test/java/com/example/payment/application/payment/comparison/PaymentEventReactionListener.java
private static final Set<String> CONFIRMING = Set.of("APPROVED", "CAPTURED");
private static final Set<String> RELEASING = Set.of("APPROVAL_FAILED", "EXPIRED", "APPROVAL_CANCELED", "CAPTURE_CANCELED");

@KafkaListener(topics = "${inventory.payment-events.topic}")
public void receive(ConsumerRecord<String, String> record) {
    PaymentEventMessage event = jsonMapper.readValue(record.value(), PaymentEventMessage.class);
    if (CONFIRMING.contains(event.status())) {
        reservationService.confirm(event.paymentId());
        return;
    }
    if (RELEASING.contains(event.status())) {
        reservationService.release(event.paymentId());
    }
}
```

같은 계약으로 돌리려고 결제 이벤트 토픽 이름도 컨텍스트마다 따로 두고, 재고를 읽기 전에 재고 서비스가 그 토픽까지 다 읽기를 기다리게 했습니다.

결과는 계약으로 갈리지 않았습니다. 코레오그래피는 같은 계약 21개를 모두 통과했고, 운영도 21개를 모두 통과했습니다. 결정 2를 넣은 커밋에서는 그때의 운영(확정·해제를 그 자리에서 HTTP로 보냄)이 못 지키던 늦은 답·늦게 도착한 예약·멈춘 동안 해제 3개도 코레오그래피는 통과했습니다. 결제 결과를 9장 Outbox로 보내고, 재고를 잡지 못해 닫은 결제도 승인 실패 이벤트로 해제됐기 때문입니다. 코레오그래피는 계약을 지키므로 known-failing이 아니라 기본 시험에 있습니다(8장 `for update` 비교와 같습니다). 어긋난 재고는 6번 모두 0이었고, 재고가 맞춰지기까지 걸린 시간은 코레오그래피 243\~752ms, 운영 352\~716ms였습니다.

계약과 측정으로는 드러나지 않는 차이는 코드에서 두 가지를 보았습니다.

- 재고 서비스가 결제 상태 이름 여섯 개와 그 뜻을 알아야 합니다. 위 리스너의 두 목록(`CONFIRMING`, `RELEASING`)이 그것이고, 어느 결제 상태가 재고를 돌려줄 때인지가 재고 서비스 코드에 들어갑니다.
- 코레오그래피는 재고를 잡지 않은 결제의 실패 이벤트에도 해제를 남깁니다. 재고가 모자라 닫힌 결제나 상품 없이 금액만 받은 결제가 그렇습니다. 계약에는 해가 없었지만 재고 서비스에 빈 해제 줄이 쌓입니다(코드로 본 것이고, 줄 수는 세지 않았습니다).

![결정 2 선택지 비교 — 오케스트레이션(이 장에서 고름)은 결제를 바꾸는 기록 다섯 곳이 PaymentHoldings.settle 한 곳을 불러 승인이면 확정, 승인 없이 끝나거나 취소면 해제를 정하고 payment_outbox에 STOCK_CONFIRM·STOCK_RELEASE 줄을 남겨 릴레이가 stock-reservation-commands로 보내며, 재고 서비스는 결제 상태를 모른 채 받은 명령대로 예약 상태만 바꿈. 코레오그래피(비교)는 결제 서버가 쿠폰·포인트만 돌려주고 PAYMENT_RESULT 줄만 남기며, 재고 서비스의 PaymentEventReactionListener가 payment-events를 읽어 APPROVED·CAPTURED면 확정, APPROVAL_FAILED·EXPIRED·APPROVAL_CANCELED·CAPTURE_CANCELED면 해제함. 둘 다 계약 21개를 모두 통과했고 측정 어긋난 재고는 6번 모두 0, 맞춰진 때는 352~716ms와 243~752ms였음. 차이는 결제 서버에 settle과 재고 명령이 생기는 것과, 재고 서비스가 결제 상태 여섯 개의 뜻을 알고 재고를 잡지 않은 결제에도 빈 해제 줄을 남기는 것이며, 결과는 계약과 측정으로 갈리지 않았음](images/05_d2-options.svg)

오케스트레이션으로 둔 이유는 결제 서버가 이미 상태 전이 표(1장)와 결과 모름 보정(4장 [PG 응답을 받지 못한 결제와 보정](../payment-approval-unknown/))을 쥐고 있어, 재고 단계도 같은 곳에서 정하면 재고 서비스가 결제의 규칙(어느 상태가 재고를 돌려줄 때인가)을 따로 알 필요가 없기 때문입니다.

이 선택으로 치르는 비용은 두 가지입니다.

- 결제 서버가 재고 단계를 알고 명령을 남겨야 합니다. 결제 서버에 재고 확정·해제 규칙(`settle`)과 재고 명령 보내기가 생깁니다.
- `payment_outbox`에 결제 결과 말고 재고 명령 줄이 더 쌓입니다(결정 5).

다른 선택이 맞는 경우도 있습니다. 재고 서비스가 결제 상태 여섯 개의 뜻을 알아도 괜찮고, 결제 서버가 참여 서비스마다 명령을 남기지 않게 하고 싶다면 코레오그래피로도 이 장의 계약을 모두 지킬 수 있었습니다.

### 결정 3. 재고 서비스는 무엇을 남길까

이 장에서는 재고 서비스가 결제 번호를 예약 번호로 `stock_reservation` 줄을 남기고, 잡음(`RESERVED`) → 확정(`CONFIRMED`) / 해제(`RELEASED`) 상태 전이로 재고를 바꾸기로 했습니다. 해제가 예약보다 먼저 오면 상품 없는 해제 줄을 먼저 남겨 늦게 온 예약을 막습니다.

검토한 선택지는 두 가지입니다.

- 예약 줄을 남기고 상태 전이로 바꿈
- 예약 기록 없이 재고 수량만 바로 줄이고 늘림(결정 1까지의 재고 서비스)

재고 서비스에 표 두 개를 두었습니다. 예약 번호는 결제 번호이고 기본 키라, 같은 번호의 예약은 한 줄뿐입니다.

```sql
-- inventory-service/src/main/resources/inventory-schema.sql
-- 10장 결정 3: 결제 하나가 잡은 재고(예약) 한 줄. 예약 번호는 결제 번호다(결제 하나에 예약 하나).
-- RESERVED(잡음) → CONFIRMED(결제 승인으로 확정) / RELEASED(돌려줌). 확정된 예약도 결제가 전액 취소되면 RELEASED 가 된다.
-- 해제가 예약보다 먼저 오면 담긴 상품 없이 RELEASED 줄을 먼저 남긴다 — 그 뒤 늦게 온 예약은 이 줄에 막혀 받지 않는다
create table if not exists stock_reservation (
    reservation_id bigint      not null,
    status         varchar(20) not null,
    created_at     datetime(6) not null,
    updated_at     datetime(6) not null,
    primary key (reservation_id)
);

-- 10장 결정 3: 예약이 잡은 상품과 수량. 돌려줄 때 이 수량만큼 돌려준다
create table if not exists stock_reservation_item (
    id             bigint not null auto_increment,
    reservation_id bigint not null,
    product_id     bigint not null,
    quantity       int    not null,
    primary key (id),
    key idx_stock_reservation_item_reservation_id (reservation_id)
);
```

예약과 해제는 둘 다 예약 줄을 먼저 남기려고(`claim`) 합니다. 줄이 새로 남았으면 예약은 상품 번호 순으로 재고를 줄이고, 해제는 상품 없는 해제 줄을 남긴 것으로 끝냅니다. 줄이 이미 있으면 그 줄을 잠그고 읽어 판단합니다.

```java
// inventory-service/src/main/java/com/example/inventory/application/reservation/ReservationRecorder.java
// 예약 줄을 먼저 남기고 담긴 상품의 재고를 줄인다. 하나라도 모자라면 재고 없음으로 알려 예약 줄째 되돌린다.
// 같은 번호의 줄이 이미 있으면: 해제된 줄(해제가 먼저 도착함)이면 받지 않고, 잡혀 있거나 확정된 줄이면 다시 온 예약으로 보고 그대로 둔다
@Transactional
public void reserve(Long reservationId, List<StockLine> items) {
    if (stockReservationRepository.claim(StockReservation.reserve(reservationId, items, clock.instant()))) {
        sorted(items).forEach(this::decrease);
        return;
    }
    StockReservation existing = stockReservationRepository.findForUpdate(reservationId).orElseThrow();
    if (existing.isReleased()) {
        throw new ReservationReleasedException(reservationId);
    }
}

// 예약을 해제하고 잡은 재고를 돌려준다. 예약이 아직 없으면 해제된 줄을 먼저 남긴다(늦게 온 예약을 막는다).
// 이미 해제된 예약이면 아무것도 바꾸지 않는다
@Transactional
public void release(Long reservationId) {
    Instant now = clock.instant();
    if (stockReservationRepository.claim(StockReservation.releasedBeforeReserved(reservationId, now))) {
        return;
    }
    stockReservationRepository.findForUpdate(reservationId)
            .filter(reservation -> reservation.release(now))
            .ifPresent(this::returnStock);
}
```

어느 상태에서 무엇을 바꿀지는 예약 상태가 정합니다. 확정은 잡힌 예약만, 해제는 재고를 쥔 예약(`RESERVED`·`CONFIRMED`)만 바꿉니다. 이미 지난 상태면 아무것도 바꾸지 않아, 같은 확정이나 해제가 두 번 와도 한 번만 반영됩니다. 받은 메시지 번호를 남겨 거르는 일반적인 중복 가리기가 아니라 예약 상태 전이의 규칙이고, 일반 중복 가리기는 11장에서 다룹니다.

```java
// inventory-service/src/main/java/com/example/inventory/domain/reservation/ReservationStatus.java
// 확정할 수 있는 상태인가(잡아 둔 예약만). 이미 확정·해제된 예약에 다시 온 확정은 아무것도 바꾸지 않는다
public boolean canConfirm() {
    return this == RESERVED;
}

// 돌려줄 재고를 쥐고 있는 상태인가(잡음, 확정). 이미 해제된 예약에 다시 온 해제는 아무것도 바꾸지 않는다
public boolean holdsStock() {
    return this == RESERVED || this == CONFIRMED;
}
```

![결정 3 재고 서비스의 예약 줄 상태 전이 — 예약이 먼저 도착하면 claim이 성공해 RESERVED(잡음)가 되고 상품 번호 순으로 재고를 줄임. 해제가 먼저 도착하면 claim이 성공해 상품 없는 RELEASED 줄(빈 해제 줄)을 남김. RESERVED는 확정(canConfirm)으로 CONFIRMED, 해제(holdsStock)로 RELEASED가 되고, CONFIRMED도 전액 취소면 RELEASED가 됨. 해제하면 returnStock이 담은 수량만큼 재고를 늘림. CONFIRMED에 다시 온 확정, RELEASED에 다시 온 해제와 늦게 온 확정은 아무것도 바꾸지 않고, RELEASED에 늦게 온 예약은 409 RESERVATION_RELEASED로 받지 않음](images/06_d3-reservation-states.svg)

이미 해제된 번호로 예약이 오면 409(`RESERVATION_RELEASED`)로 받지 않고, 결제 서버는 재고가 모자란 것과 같이 잡지 않은 것으로 봅니다. 줄 남기기(`claim`)는 같은 키의 줄이 이미 있으면 넣지 않고 넘어가는 `insert ignore` 한 문장입니다. 같은 번호를 다른 트랜잭션이 남기는 중이면 그 트랜잭션이 끝날 때까지 기다린 뒤 이미 있는 줄로 본다는 것이 코드의 전제입니다. 일반 INSERT가 중복 키를 만나면 공유 잠금을 건다는 문서(MySQL 8.4 "Locks Set by Different SQL Statements in InnoDB"의 "If a duplicate-key error occurs, a shared lock on the duplicate index record is set.")는 있지만, `insert ignore`의 경우는 문서로 확인하지 못했습니다. 뒤의 "예약을 처리하는 동안 시간 제한이 지나는" 계약이 통과한 실행으로만 아는 가정입니다. 재고 서비스 모듈에는 예약 상태 전이 단위 시험 7개를 더했습니다.

수량만 비교는 결정 1까지의 재고 서비스를 시험 구성품으로 옮긴 것입니다. 예약 기록 없이 `POST /stocks/decrease`·`increase`로 수량만 줄이고 늘리고, 해제는 결정 5부터 같은 릴레이로 수량을 실어 보냅니다. 계약 21개 중 4개가 실패했습니다.

```text
## 결제와 나눈 재고를 함께 끝내기 — 비교(결정 3): 예약 기록 없이 수량만 바로 줄이고 늘림
FAIL 해제가 예약보다 먼저 도착해도 재고는 처음보다 늘지 않는다 (0.661s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 7
FAIL 결과를 모르던 결제를 보정이 승인으로 닫으면 재고 예약은 확정된다 (5.298s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 2 but was: 0
FAIL 승인된 주문의 재고 예약은 확정된다 (0.156s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 2 but was: 0
FAIL 같은 해제가 두 번 와도 재고는 한 번만 돌아온다 (0.281s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 7
```

해제가 예약보다 먼저 도착하자 늘리기가 먼저 반영돼 재고가 7(처음 5)이 됐습니다. 재고가 새는 것이 아니라 처음보다 늘어났고, 늦게 온 줄이기는 그 뒤에 반영됐습니다. 같은 해제가 두 번 와도 두 번 늘려 7이었습니다. 확정 계약 2개는 예약 기록이 없어 0이었습니다. 몰림 뒤 취소 계약은 이번 기록에서는 통과했지만, 결정 5 커밋 실행에서는 남은 재고와 승인 수량의 합이 191(처음 100)로 실패했습니다. 이 계약은 겹침을 고정하지 않아 시간 초과가 몇 건 나느냐에 따라 흔들립니다.

측정에서도 수량만은 6번 중 4번 어긋난 재고가 +10이었습니다. 재고 서비스가 멈춘 동안 닫은 결제의 해제가, 재고 서비스가 돌아온 뒤 줄인 적 없는 재고를 늘렸습니다.

![결정 3 선택지 비교 — 예약 줄과 상태 전이(이 장에서 고름)는 해제가 예약보다 먼저 오면 claim으로 빈 해제 줄을 남겨 재고 5를 그대로 두고 늦은 예약을 409로 막아 재고 5이며, 같은 해제가 두 번 오면 첫 해제만 RELEASED로 바꿔 재고 3에서 5로 돌려주고 두 번째는 바꾸지 않음. 계약 실패 0, 측정 어긋난 재고 0(6번). 수량만(비교)은 해제가 먼저 오면 늘리기가 먼저 반영돼 재고 7이 되고 늦게 온 줄이기가 그 뒤에 반영되며, 같은 해제가 두 번 오면 두 번 늘려 재고 7이 됨. 계약 21개 중 4개 실패(나머지 2개는 확정 계약 0), 측정 어긋난 재고 +10(4번)·0(2번)](images/07_d3-options.svg)

8장의 되돌리기 비교 두 개는 이 결정으로 결과가 바뀌었습니다. "실패를 기록하는 곳마다 따로 되돌리기"와 "곳마다 따로 + 포인트 이력 없이"에서 "승인 거절의 기록·보정·알림 처리가 겹쳐도 재고는 한 번만 돌아온다"가 이제 통과합니다. 거절 답 기록·보정·알림 처리가 저마다 해제를 남겨도 재고 서비스가 예약 상태 전이로 한 번만 돌려주기 때문입니다. 포인트는 결제 서버에 남아 있어 포인트 계약은 그대로 실패했습니다.

예약 줄을 남기는 이유는 수량만 바꾸면 어느 결제가 무엇을 잡았는지 남지 않아, 해제가 예약보다 먼저 오거나 같은 해제가 두 번 오면 재고가 틀어지기 때문입니다.

이 선택으로 치르는 비용은 두 가지입니다.

- 표가 두 개 늘고, 결제마다 예약 줄이 남습니다. 해제가 먼저 와서 남긴 빈 해제 줄도 지우지 않습니다.
- 해제가 먼저 남은 결제 번호로는 다시 예약할 수 없습니다(409 `RESERVATION_RELEASED`).

다른 선택이 맞는 경우도 있습니다. 8장처럼 재고를 줄이고 돌려주는 일이 결제와 같은 트랜잭션에서 한 번씩만 일어나 순서가 바뀌거나 두 번 올 일이 없다면, 수량만 바꾸는 것으로 충분했습니다.

### 결정 4. 예약 답을 받지 못하면 어떻게 할까

이 장에서는 재고 서비스의 답을 받지 못하면(시간 초과·연결 실패) 카드사에 승인을 요청하지 않고 결제를 승인 없이 닫은 뒤, 예약 해제를 보내기로 했습니다.

검토한 선택지는 세 가지입니다.

- 결제를 닫고 해제를 보냄
- 예약을 조회해 확인한 뒤 진행(`GET /reservations/{id}`)
- 실패로만 보고 해제를 보내지 않음(결정 1\~3의 운영)

운영은 결제를 바꾸는 다른 기록과 같은 길(`settle`)로 해제를 보내고 쿠폰·포인트를 돌려준 뒤 504(`INVENTORY_NO_RESPONSE`)로 답합니다. 재고가 모자란 답(409)은 잡힌 것이 없으므로 해제하지 않습니다.

```java
// src/main/java/com/example/payment/application/payment/PaymentRecorder.java
// 10장 결정 4: 재고 서비스의 답을 받지 못했다. 카드사에 승인을 요청하지 않았으니 승인 없이 실패로 닫고, 잡았을지 모르는 재고 예약을 해제하고
// 쿠폰·포인트를 돌려준다(8장 결정 4와 같은 길). 그 사이 다른 길로 결과가 남은 결제는 건드리지 않는다
@Transactional
public void recordStockNoResponse(String orderId) {
    Payment payment = find(orderId);
    PaymentStatus before = payment.getStatus();
    if (payment.isAwaitingApprovalResult()) {
        payment.failApproval();
    }
    paymentHoldings.settle(payment, before);
    paymentEvents.publishIfChanged(payment, before);
}
```

조회로 확인하는 비교(`InquiringHoldings`)는 답이 없으면 그 예약을 재고 서비스에 물어, 잡혀 있으면 카드사에 승인을 요청하고 없거나 해제됐으면 해제 없이 닫습니다. 조회도 답이 없으면 응답 없음으로 닫습니다.

```java
// src/test/java/com/example/payment/application/payment/comparison/InquiringHoldings.java
@Override
public boolean reserveStock(Long paymentId, String orderId, List<PaymentItem> items) {
    try {
        return super.reserveStock(paymentId, orderId, items);
    } catch (InventoryNoResponseException noResponse) {
        return isHeld(paymentId, orderId);
    }
}
```

처음 계약으로는 조회 비교가 답만 늦은 경우와 요청이 늦게 도착한 경우를 모두 통과했습니다. 답만 늦은 때는 조회가 잡힌 예약을 보고 승인까지 갔고, 요청이 중계에서 붙잡힌 때는 조회도 붙잡혀 응답 없음으로 닫히며 해제를 보냈기 때문입니다. 두 방식을 가르려고 결정 4에서 계약 "재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다"를 더했습니다. 재고 서비스 DB의 재고 줄이기를 1초 붙잡아, 예약이 아직 커밋되지 않은 동안 시간 제한이 지나게 하는 계약입니다.

두 비교의 실패는 아래와 같습니다. 실패로만 보는 비교는 21개 중 3개, 조회로 확인하는 비교는 1개가 실패했습니다.

```text
## 결제와 나눈 재고를 함께 끝내기 — 비교(결정 4): 재고 서비스 답이 없으면 실패로만 보고 해제를 보내지 않음
FAIL 재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다 (1.219s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
FAIL 해제보다 늦게 도착한 예약은 재고를 줄이지 않는다 (0.719s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
FAIL 재고 서비스의 답이 시간 제한보다 늦어도 그 주문이 잡은 재고는 처음으로 돌아온다 (0.645s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
## 결제와 나눈 재고를 함께 끝내기 — 비교(결정 4): 재고 서비스 답이 없으면 예약을 조회해 확인한 뒤 진행
FAIL 재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다 (1.195s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
```

실패로만 보면 재고 서비스가 실제로 잡았거나(답만 늦음), 처리 중이었거나, 요청이 늦게 도착한 경우 모두 그 재고가 돌아오지 않아 재고 3이었습니다. 조회로 확인하면 예약을 처리하는 중에 물었을 때 아직 커밋되지 않은 예약이 보이지 않아 없다고 닫았고, 그 뒤 예약이 커밋돼 재고 3이었습니다.

운영은 네 경우 모두 결과가 같습니다. 재고 서비스가 실제로 잡았으면 해제가 돌려주고, 처리 중이면 해제가 같은 예약 줄을 기다렸다가 돌려주고, 요청이 늦게 도착하면 먼저 남은 해제 줄에 막히고, 아예 받지 못했으면 빈 해제 줄만 남습니다(결정 3). 결정 4를 넣은 커밋에서 운영은 21개 중 1개(멈춘 동안 해제 유실)만 실패했고, 이것은 결정 5에서 다룹니다.

![결정 4 선택지 비교 격자 — 재고 서비스 쪽에서 답만 늦음(이미 잡음), 처리 중(커밋 전), 요청이 늦게 도착, 받지 못함의 네 경우마다, 닫고 해제를 보내는 운영은 해제가 돌려주거나, 같은 예약 줄을 기다렸다 돌려주거나, 먼저 남은 해제 줄에 막히거나, 빈 해제 줄만 남아 모두 재고 5다(받지 못함은 계약이 없고 결정 4 커밋의 이유로 적은 경우라 점선). 조회로 확인하는 비교는 답만 늦으면 잡힌 예약을 보고 승인까지 가고, 처리 중이면 커밋 전이라 보이지 않아 해제 없이 닫아 재고 3, 요청이 늦게 도착하면 조회도 붙잡혀 해제를 보냄. 실패로만 보는 비교는 앞의 세 경우 모두 재고 3임. 계약 실패는 0·1·3, 측정 어긋난 재고는 0·0·−10, 늦음 응답 중앙은 1027~1038·2040~2045·1029~1035ms](images/08_d4-options.svg)

측정에서도 갈렸습니다. 실패로만 보는 비교는 6번 모두 어긋난 재고가 −10이었습니다. 재고 서비스가 늦은 동안의 10건이 줄인 재고가 돌아오지 않았습니다. 조회로 확인하는 비교는 어긋난 재고가 0이었지만, 재고 서비스가 늦을 때 응답 중앙값이 2040\~2045ms였습니다. 예약 1s에 조회도 1s 시간 제한에 걸렸기 때문입니다. 운영은 1027\~1038ms였습니다.

조회 비교를 돌리다 재고 서비스 코드를 한 곳 고쳤습니다. 트랜잭션 밖 조회가 예약 줄을 읽는 행 매퍼 안에서 담긴 상품을 다시 조회해 연결을 하나 더 쥐었는데, 몰림 시험에서 연결 풀(10개)이 바닥나 30초 기다리다 실패(`CannotGetJdbcConnectionException` 278번)하고 재고 명령 소비가 멈췄습니다. 줄을 다 읽은 뒤에 상품을 읽게 고친 뒤에는 조회 비교가 처리 중 시간 초과 1개만 실패했습니다.

![결정 4 조회 비교를 돌리다 고친 재고 서비스 코드 — 고치기 전에는 트랜잭션 밖 조회 find가 예약 줄을 읽는 행 매퍼 안에서 담긴 상품을 다시 조회해 연결을 하나 더 쥐었고, 몰림 시험에서 연결 풀 10개가 바닥나 30초 기다리다 CannotGetJdbcConnectionException이 278번 나며 재고 명령 소비가 멈췄음. 고친 뒤에는 예약 줄을 다 읽은 뒤 itemsOf로 상품을 읽어 연결을 하나씩만 쓰고, 조회 비교는 처리 중 시간 초과 1개만 실패했음](images/09_d4-pool-fix.svg)

닫고 해제하는 이유는 위 네 경우 모두 결과가 같기 때문입니다. 또 재고 서비스에 다시 물어보지 않으므로 재고 서비스가 느릴 때 요청을 더 얹지 않습니다.

이 선택으로 치르는 비용은 두 가지입니다.

- 재고 서비스가 실제로 재고를 잡았고 답만 늦었어도 결제는 승인 없이 실패로 끝납니다. 고객은 504를 받습니다.
- 요청을 받지 못한 재고 서비스에도 해제가 가서 빈 해제 줄이 남습니다.

다른 선택이 맞는 경우도 있습니다. 답만 늦은 결제를 실패로 닫는 비용이 크고, 처리 중인 예약을 조회가 볼 수 있는 구조라면 조회로 확인하는 쪽이 맞을 수 있습니다. 이 장의 재고 서비스는 커밋되지 않은 예약을 조회에 보여 주지 않아 계약 1개가 실패했고, 재고 서비스가 늦을 때 응답도 두 배로 늘었습니다.

### 결정 5. 확정과 해제를 어떻게 보낼까

이 장에서는 예약 확정과 해제를 결제 상태를 바꾼 그 트랜잭션에서 9장 `payment_outbox`에 남기고, 9장 릴레이가 결제 번호를 키로 재고 명령 토픽에 보내기로 했습니다. 결과 모름 결제는 4장 보정이 결과를 정할 때까지 명령을 남기지 않아 예약을 쥔 채로 둡니다.

검토한 선택지는 두 가지입니다.

- 상태를 바꾼 트랜잭션에서 `payment_outbox`에 남기고 릴레이가 Kafka로 보냄
- 상태를 바꾼 자리에서 바로 HTTP로 보냄(결정 3\~4의 운영, 실패하면 로그만)

`payment_outbox`에 종류(`type`) 칸을 더해 결제 결과(`PAYMENT_RESULT`)와 재고 명령(`STOCK_CONFIRM`·`STOCK_RELEASE`)을 같은 표에 남깁니다.

```java
// src/main/java/com/example/payment/application/payment/StockCommands.java
public void confirm(Payment payment) {
    paymentOutboxRepository.save(PaymentOutbox.stockCommand(payment, OutboxType.STOCK_CONFIRM, clock.instant()));
}

public void release(Payment payment) {
    paymentOutboxRepository.save(PaymentOutbox.stockCommand(payment, OutboxType.STOCK_RELEASE, clock.instant()));
}
```

릴레이는 9장과 같은 순서(번호 순)와 같은 보장(적어도 한 번, 받았다는 답이 온 뒤 보낸 때를 남김)으로 보내고, 종류에 따라 토픽만 나눕니다.

```java
// src/main/java/com/example/payment/application/payment/PaymentOutboxRelay.java
// 10장 결정 5: 재고 명령은 재고 서비스의 토픽으로, 결제 결과는 결제 이벤트 토픽으로 보낸다
private void send(PaymentOutbox outbox) {
    if (outbox.isStockCommand()) {
        stockCommandSender.send(outbox.toStockCommand());
        return;
    }
    paymentEventSender.send(outbox.toEvent());
}
```

재고 명령 토픽은 `stock-reservation-commands`(파티션 2개)이고, 키는 결제 번호(= 예약 번호)입니다. 같은 예약의 확정과 해제가 같은 파티션에 실려 재고 서비스가 보낸 순서대로 읽습니다.

```java
// src/main/java/com/example/payment/infrastructure/kafka/KafkaStockCommandSender.java
kafkaTemplate.send(inventoryProperties.getCommandsTopic(), String.valueOf(command.getReservationId()), body).join();
```

재고 서비스는 파티션마다 따로 읽고(`concurrency=2`), 결정 3의 상태 전이로 확정·해제합니다. 재고 서비스의 HTTP 확정·해제 API는 걷어 내고 예약과 조회만 남겼습니다.

```java
// inventory-service/src/main/java/com/example/inventory/presentation/command/StockCommandListener.java
@KafkaListener(topics = "${inventory.stock-commands.topic}")
public void receive(ConsumerRecord<String, String> record) {
    StockCommandMessage command = jsonMapper.readValue(record.value(), StockCommandMessage.class);
    if (command.isConfirm()) {
        reservationService.confirm(command.reservationId());
        return;
    }
    reservationService.release(command.reservationId());
}
```

그 자리에서 HTTP로 보내는 비교(`DirectHttpHoldings`)는 상태를 바꾼 트랜잭션 안에서 재고 서비스에 바로 확정·해제를 보내고, 실패하면 로그만 남깁니다. 결제 줄을 잠근 채 재고 서비스의 답을 기다립니다. 계약 21개 중 1개가 실패했습니다.

```text
## 결제와 나눈 재고를 함께 끝내기 — 비교(결정 5): 상태를 바꾼 자리에서 바로 HTTP 로 확정·해제
FAIL 재고 서비스가 멈춘 동안 승인 없이 끝난 주문의 재고는 재고 서비스가 돌아오면 처음으로 돌아온다 (0.25s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 5 but was: 3
```

재고 서비스가 멈춘 동안 승인이 거절된 결제의 해제가 사라져, 돌아온 뒤에도 재고가 3(처음 5)이었습니다. 측정에서도 6번 모두 어긋난 재고가 −5였습니다. 멈춘 동안 취소한 5건의 해제가 사라졌습니다. 재고 서비스가 늦을 때 응답 중앙값은 2042\~2045ms였습니다. 예약 1s에 해제 HTTP 1s를 더 기다렸기 때문입니다. 운영은 6번 모두 어긋난 재고가 0이었습니다.

![결정 5 선택지 비교 — 재고 서비스가 멈춘 동안 카드사가 거절한 결제에서, 상태 전이 트랜잭션에서 payment_outbox에 남기는 운영은 결제 상태와 STOCK_RELEASE 줄을 함께 커밋하고 릴레이가 stock-reservation-commands로 보내 브로커가 받으며, 재고 서비스가 돌아오면 읽던 자리부터 읽어 해제해 재고 5가 됨. 상태를 바꾼 자리에서 바로 HTTP로 보내는 비교는 결제 줄을 잠근 채 HTTP 해제를 보내다 연결에 실패해 로그만 남기고, 돌아와도 재고는 3임. 계약 실패 0과 1, 측정 어긋난 재고 0과 −5, 늦음 응답 중앙 1027~1038ms와 2042~2045ms. 운영의 원복 시간은 25건 중앙 302~626ms, p95 1321~1553ms](images/10_d5-options.svg)

`payment_outbox`에 남기는 이유는 상태가 커밋되면 명령도 반드시 남고, 재고 서비스가 멈춰 있어도 결제 기록(거절 답·취소·보정)이 기다리거나 명령을 잃지 않기 때문입니다. 재고 서비스가 돌아오면 남은 명령이 갑니다.

이 선택으로 치르는 비용은 세 가지입니다.

- 재고가 바로 돌아오지 않습니다. 측정에서 승인 없이 끝나거나 취소된 결제 25건의 원복 시간(승인·취소 요청을 보낸 때부터 재고 서비스가 해제한 때까지)은 중앙값 302\~626ms, p95 1321\~1553ms였습니다. 멈춘 동안의 결제는 재고 서비스가 멈춘 시간이 들어 있습니다.
- 릴레이가 적어도 한 번 보내므로 같은 명령이 두 번 갈 수 있습니다. 재고 서비스는 예약 상태 전이로 한 번만 반영하지만, 일반적인 중복 가리기와 처리 실패의 재시도는 없습니다(11장).
- 보낸 `payment_outbox` 줄을 지우지 않아, 이제 결제 결과에 재고 명령까지 쌓입니다.

다른 선택이 맞는 경우도 있습니다. 재고 서비스가 멈추지 않는다고 볼 수 있다면, 그 자리에서 보내는 방식도 이 장의 다른 계약은 모두 통과했습니다. 이 방식이 놓친 계약은 "재고 서비스가 멈춘 동안 승인 없이 끝난 주문의 재고는 재고 서비스가 돌아오면 처음으로 돌아온다" 하나입니다.

## 구현

결정을 모아 바꾼 10장 완성 코드에서, 상품을 담은 결제 하나가 지나는 메서드 순서는 아래와 같습니다.

1. 인증: `PaymentConfirmService.confirm` → `PaymentRecorder.authenticate`(트랜잭션 시작) → `findByOrderIdForUpdate`로 결제 줄 잠금(7장) → `verifyAmount`(3장 [결제 금액 검증과 멱등성](../payment-amount-idempotency/)) → `Payment.authenticate` → `PaymentHoldings.hold`로 쿠폰·포인트 조건부 UPDATE(8장) → 커밋
2. 예약: `reserveStock` → `PaymentHoldings.reserveStock` → `InventoryClient.reserve`(`POST /reservations`, 예약 번호 = 결제 번호, 연결 300ms·읽기 1s) → 재고 서비스 `ReservationController.reserve` → `ReservationService.reserve` → `ReservationRecorder.reserve`(트랜잭션: `claim`으로 예약 줄 `insert ignore` → 상품 번호 순으로 재고 조건부 UPDATE) → 200
   - 409(재고 없음·이미 해제된 예약)면 `recordStockRefused` → `failApproval` → `releaseUnreservedIfClosed`(쿠폰·포인트만) → `publishIfChanged` → 409 `OUT_OF_STOCK`
   - 답이 없으면 `recordStockNoResponse` → `failApproval` → `settle` → `StockCommands.release`(`STOCK_RELEASE` 줄)와 쿠폰·포인트 돌려줌 → `publishIfChanged` → 504 `INVENTORY_NO_RESPONSE`

![10장 완성 코드에서 상품을 담은 결제가 지나는 순서 ① 인증과 예약 — 고객의 승인 요청을 받은 결제 서버가 인증 트랜잭션에서 결제 줄을 잠그고 verifyAmount·Payment.authenticate·PaymentHoldings.hold로 쿠폰·포인트를 잡은 뒤 커밋함. 그다음 트랜잭션 밖에서 재고 서비스에 POST /reservations(예약 번호 = 결제 번호, 연결 300ms·읽기 1s)를 보내고, 재고 서비스는 한 트랜잭션에서 claim으로 예약 줄을 insert ignore하고 상품 번호 순으로 재고를 조건부 UPDATE한 뒤 커밋해 200으로 답함. 409(재고 없음·이미 해제된 예약)면 recordStockRefused가 결제를 승인 실패로 닫고 쿠폰·포인트만 돌려준 뒤 409 OUT_OF_STOCK, 답이 없으면 recordStockNoResponse가 승인 실패로 닫고 settle로 STOCK_RELEASE 줄과 쿠폰·포인트를 돌려준 뒤 504 INVENTORY_NO_RESPONSE로 답함](images/11_chapter-sequence-reserve.svg)

3. 승인: `requestApproval` → `PaymentGateway.approve`(트랜잭션 밖) → `PaymentRecorder.recordApproval`(트랜잭션 시작) → 결제 줄 잠금 → `settleWith` → `PaymentHoldings.settle`(승인이면 `StockCommands.confirm`으로 `STOCK_CONFIRM` 줄, 거절이면 `STOCK_RELEASE` 줄) → `PaymentEvents.publishIfChanged`(`PAYMENT_RESULT` 줄) → 커밋
4. 릴레이: `PaymentOutboxScheduler.relay`(500ms) → `ExclusiveJobRunner.run(OUTBOX)` → `PaymentOutboxRelay.relay` → `findUnsent(50)`(번호 순) → `relayUnlessWaiting` → `isNotSent` → `send`: 재고 명령이면 `KafkaStockCommandSender.send`(토픽 `stock-reservation-commands`, 키 = 결제 번호), 결제 결과면 `KafkaPaymentEventSender.send` → 답이 오면 `markSent`
5. 받기: 재고 서비스 `StockCommandListener.receive`(파티션마다 소비자 하나) → `ReservationService.confirm`/`release` → `ReservationRecorder.confirm`(잠그고 읽기 → `StockReservation.confirm` → `updateStatus`) / `ReservationRecorder.release`(빈 해제 줄 `claim` 또는 잠그고 읽기 → `StockReservation.release` → `returnStock`으로 상태와 재고를 함께 바꿈) → 커밋

결과 모름은 `recordApprovalUnknown`이 `settle`을 부르지 않아 명령을 남기지 않습니다. 나중에 4장 보정(`recordInquiry`)이나 알림 반영이 결과를 정할 때 `settle`이 확정이나 해제를 남깁니다. 같은 결제의 줄은 종류와 상관없이 번호 순으로 나가므로, 승인 답 기록에서는 `STOCK_CONFIRM`이 `PAYMENT_RESULT`보다 먼저 남고 먼저 나갑니다.

![10장 완성 코드에서 상품을 담은 결제가 지나는 순서 ② 승인·릴레이·받기 — 결제 서버가 트랜잭션 밖에서 PaymentGateway.approve로 승인 답을 받은 뒤 recordApproval 트랜잭션에서 결제 줄을 잠그고 settleWith·PaymentHoldings.settle을 거쳐 payment_outbox에 STOCK_CONFIRM 줄(n)과 publishIfChanged의 PAYMENT_RESULT 줄(n+1)을 남기고 상태와 함께 커밋한 뒤 고객에게 승인으로 답함. 500ms마다 작업 잠금을 맡은 서버 한 대의 릴레이가 findUnsent(50)로 줄을 번호 순으로 읽어 줄 n은 결제 번호 키로 stock-reservation-commands에, 줄 n+1은 payment-events에 보내고 받았다는 답이 오면 markSent함. 재고 서비스의 StockCommandListener가 명령을 받아 ReservationRecorder.confirm으로 예약 줄을 잠그고 읽어 RESERVED에서 CONFIRMED로 바꾸고 커밋함. 결과 모름이면 settle을 부르지 않아 4장 보정까지 예약을 유지하고, 거절이면 settle이 STOCK_RELEASE 줄을 남겨 release로 재고를 돌려줌](images/12_chapter-sequence-relay.svg)

```java
// src/main/java/com/example/payment/application/payment/PaymentRecorder.java
@Transactional
public PaymentResult recordApproval(String orderId, PaymentApproval approval) {
    Payment payment = find(orderId);
    PaymentStatus before = payment.getStatus();
    if (payment.isAwaitingApprovalResult()) {
        settleWith(payment, approval);
    }
    paymentHoldings.settle(payment, before);
    paymentEvents.publishIfChanged(payment, before);
    return PaymentResult.from(payment);
}
```

### 앞 장 코드에서 바뀐 것

- 8장 `PaymentHoldings.hold`는 이제 쿠폰·포인트만 잡습니다. 결제 서버의 재고 저장소(`StockRepository`)와 `stock` 표를 걷어 내고, 재고는 `StockReservations`(재고 서비스 HTTP)로 잡습니다.
- 4·5·6장([결제 취소와 부분 취소](../payment-partial-cancel/), [PG 웹훅 처리](../payment-webhook/))의 기록 다섯 곳(승인 답, 결과 모름 보정, 취소 답, 취소 보정, 알림 반영)이 8장 `releaseIfClosed` 대신 `settle`을 부릅니다.
- 재고가 모자란 결제는 준비 상태 대신 승인 실패로 닫히고, 주문 서비스에 결제 실패가 갑니다.
- 9장 `payment_outbox`에 `type` 칸을 더하고, 9장 릴레이가 종류에 따라 결제 이벤트 토픽과 재고 명령 토픽으로 나눠 보냅니다.
- 앞 장 시험은 준비만 재고 서비스로 옮겼고, 계약 문장과 기대값은 그대로입니다.

## 테스트 결과

10장 완성 코드에서 전체 테스트(`./gradlew clean check`)를 돌린 결과는 아래와 같습니다. 10장 운영 계약과 재고 서비스 모듈 테스트만 남기고 나머지 통과 목록은 생략했습니다.

```text
tests=713 failures=0 errors=0 time=540.369s
## 결제와 나눈 재고를 함께 끝내기 — 운영 구현
PASS 승인 요청이 닿지 않아 카드사에서 만료된 결제를 보정이 닫으면 재고는 처음으로 돌아온다 (1.205s)
PASS 해제가 예약보다 먼저 도착해도 재고는 처음보다 늘지 않는다 (0.644s)
PASS 결과를 모르던 결제를 보정이 승인 실패로 닫으면 재고는 처음으로 돌아온다 (1.74s)
PASS 승인 결과를 모르는 동안은 재고 예약을 그대로 둔다 (1.159s)
PASS 재고 서비스가 예약을 처리하는 동안 시간 제한이 지나도 그 주문이 잡은 재고는 처음으로 돌아온다 (1.21s)
PASS 승인된 결제를 전액 취소하면 재고는 처음으로 돌아온다 (0.186s)
PASS 재고 서비스가 멈춘 동안 승인 없이 끝난 주문의 재고는 재고 서비스가 돌아오면 처음으로 돌아온다 (0.524s)
PASS 해제보다 늦게 도착한 예약은 재고를 줄이지 않는다 (0.716s)
PASS 재고 서비스가 재고가 모자라다고 답한 결제는 승인 없이 실패로 끝난다 (0.055s)
PASS 재고 100개에 두 서버로 주문 300건이 한꺼번에 와도 승인된 주문은 100건을 넘지 않는다 (2.438s)
PASS 결과를 모르던 결제를 보정이 승인으로 닫으면 재고 예약은 확정된다 (5.457s)
PASS 승인된 주문의 재고 예약은 확정된다 (0.139s)
PASS 재고가 모자라 받지 않은 주문은 재고를 그대로 둔다 (0.143s)
PASS 재고 서비스가 재고가 모자라다고 답한 주문은 카드사에 승인을 요청하지 않는다 (0.056s)
PASS 카드사가 승인을 거절한 주문의 재고는 처음으로 돌아온다 (0.154s)
PASS 재고가 모자라 받지 않은 주문은 쓴 쿠폰·포인트를 돌려준다 (0.056s)
PASS 재고 서비스의 답이 시간 제한보다 늦은 주문은 카드사에 승인을 요청하지 않는다 (0.57s)
PASS 같은 해제가 두 번 와도 재고는 한 번만 돌아온다 (0.276s)
PASS 재고 서비스의 답이 시간 제한보다 늦어도 그 주문이 잡은 재고는 처음으로 돌아온다 (0.67s)
PASS 재고 100개에 두 서버로 주문 300건이 몰린 뒤 일부를 취소해도 남은 재고와 승인이 남은 결제의 수량을 더하면 처음 재고다 (6.346s)
PASS 같은 확정이 두 번 와도 재고는 승인된 수량만큼만 줄어 있다 (0.256s)
(나머지 통과한 테스트 목록 생략)
coverage (JaCoCo, PaymentChallengeApplication 제외)
INSTRUCTION 4894/5024 97.4%
BRANCH 287/303 94.7%
LINE 1084/1118 97.0%
COMPLEXITY 510/536 95.1%
METHOD 371/382 97.1%
CLASS 109/111 98.2%

# inventory-service 모듈 테스트(커버리지 검사 없음)
tests=7 failures=0 errors=0 time=0.075s
## 재고 예약의 상태 전이
PASS 이미 확정된 예약에 다시 온 확정은 아무것도 바꾸지 않는다 (0.047s)
PASS 해제된 예약에 늦게 온 확정은 예약을 되살리지 않는다 (0.004s)
PASS 잡아 둔 예약을 해제하면 잡은 재고를 돌려줄 때다 (0.0s)
PASS 예약보다 먼저 온 해제가 남긴 줄은 잡은 재고 없이 해제된 상태다 (0.004s)
PASS 잡아 둔 예약은 확정된다 (0.0s)
PASS 확정된 예약도 결제가 취소되면 해제되고 잡은 재고를 돌려줄 때다 (0.001s)
PASS 이미 해제된 예약에 다시 온 해제는 재고를 다시 돌려주지 않는다 (0.0s)
```

- 출발 코드에서 실패하던 8개(10장 7, 8장 1)가 모두 통과하였습니다.
- 전체는 9장의 671개에서 713개가 되었습니다. 10장 계약 21개를 운영(`SagaTest`)과 코레오그래피 비교(`ChoreographySagaTest`)로 돌려 42개가 늘었습니다. 라인 커버리지는 97.0%(1118줄 중 1084줄)였습니다(애플리케이션 시작 클래스 제외). 재고 서비스 모듈 7개와 주문 서비스 모듈 10개도 통과했고, 두 모듈에는 커버리지 검사를 걸지 않았습니다.
- 반복 실행으로 흔들리는지 확인했습니다. 10장 기본 테스트 42개를 5번 돌려 5번 모두 통과했고, 10장 known-failing 비교 105개를 3번 돌려 16·16·18개가 실패했습니다. 겹침을 고정한 계약은 3번 모두 같았고, 달라진 것은 몰림 계약(서버 두 대·300건, 겹침을 고정하지 않음) 하나입니다. 실패로만과 수량만이 세 번째 실행에서만 실패했습니다. 0.5초를 넘긴 예약이 몇 건 나느냐에 달렸습니다.
- 측정 커밋에서 기본 시험의 측정 제외를 빠뜨려, 한 번은 `./gradlew clean check`가 측정까지 돌아 18분 28초가 걸리고 같은 실행에서 8장 되돌리기 계약 11개 중 10개가 5초 대기를 넘겨 실패했습니다. 측정을 뺀 뒤 다시 돌린 결과가 위 기록이고, 두 일이 이어진 원인은 더 좁히지 않았습니다.

계약을 지키지 못하는 비교 구현은 `./gradlew knownFailingTest`로 돌렸습니다. 507개 중 125개가 실패했습니다. 10장 비교는 105개(계약 21개 × 다섯 구현) 중 16개가 실패했습니다. 2\~9장 비교는 9장 기록과 실패한 테스트 이름이 같고, 다른 것은 앞에서 본 8장 되돌리기 비교 두 개(1개 → 0개, 2개 → 1개)입니다. 뒤이어 도는 7장 `jpaVersionTest`는 11개 중 4개가 실패해 9장과 같았습니다. 후속 작업 뒤에 다시 돌린 `knownFailingTest`는 126개가 실패했는데, 더해진 1개는 위의 흔들리는 몰림 계약(수량만)이었습니다.

10장 계약 21개를 구현마다 모으면 아래와 같습니다.

- 운영(예약 먼저 · 답 없으면 닫고 해제 · 확정·해제는 Outbox) 0개 실패
- 출발 구조(8장 방식을 HTTP로) 7개: 늦은 답, 처리 중 시간 초과, 늦게 도착한 예약, 멈춘 동안 해제 유실, 재고 부족 결제가 준비 상태, 확정 2개
- 결정 1 승인 먼저 7개: 재고 부족 주문의 카드사 승인 요청, 재고 부족 결제가 승인 취소, 늦은 답의 카드사 승인 요청, 결과 모름 동안 잡지 않음, 300건 몰림에 승인 답 300, 확정 2개
- 결정 2 코레오그래피 0개
- 결정 3 수량만 4개: 해제 먼저(재고 7), 같은 해제 두 번(재고 7), 확정 2개
- 결정 4 실패로만 3개(늦은 답, 처리 중 시간 초과, 늦게 도착한 예약), 조회로 확인 1개(처리 중 시간 초과)
- 결정 5 그 자리에서 HTTP 1개(멈춘 동안 해제 유실)

재고가 모자랄 때 재고를 그대로 두고 쿠폰·포인트를 돌려주는 계약, 카드사 거절·만료·전액 취소·보정 실패의 원복 계약, 같은 확정 두 번 계약은 모든 구현이 통과했습니다.

![10장 계약 21개를 출발 구조, 운영, 승인 먼저, 코레오그래피, 수량만, 실패로만, 조회로 확인, 그 자리 HTTP 구현마다 통과·실패 칸으로 그린 격자 — 실패 수는 출발 구조 7, 운영 0, 승인 먼저 7, 코레오그래피 0, 수량만 4, 실패로만 3, 조회로 확인 1, 그 자리 HTTP 1임. 출발 구조는 재고 부족 결제가 READY, 확정 2개가 표 없음, 늦은 답·처리 중 시간 초과·늦게 온 예약·멈춘 동안 원복이 재고 3으로 실패했음. 승인 먼저는 재고 부족과 늦은 답에도 카드사 요청 1건, 승인 취소, 확정 2개 0, 결과 모름 동안 재고 5, 몰림에 승인 300으로 실패했음. 수량만은 확정 2개 0과 해제 먼저·같은 해제 두 번이 재고 7, 실패로만은 늦은 답·처리 중 시간 초과·늦게 온 예약이 재고 3, 조회로 확인은 처리 중 시간 초과가 재고 3, 그 자리 HTTP는 멈춘 동안 원복이 재고 3으로 실패했음](images/13_result-grid.svg)

### 재고 서비스를 늦추고 멈춘 동안의 측정

`./gradlew sagaMeasurement`로 두 가지를 쟀습니다. 서비스를 시험 JVM 안에서 바로 불러 쟀고, k6는 돌리지 않았습니다.

- 방식마다(`SagaMeasurement`): 재고 20개 상품에 주문을 한 건씩 차례로 보냅니다. 보통 10건 → 재고 서비스가 답을 1.5초 늦게 주는 동안 10건 → 재고 서비스가 멈춘 동안(중계 끊음 + 재고 명령 읽기 멈춤) 10건과 승인된 결제 5건 전액 취소 → 재고 서비스를 되돌리고 20초까지 기다립니다. 결제 서버 재고 시간 제한은 운영 값(연결 300ms·읽기 1s)이고, 릴레이는 운영처럼 0.5초마다 돕니다. 카드사는 바로 승인합니다.
- 예약 응답 시간(`ReservationLatencyMeasurement`): 재고가 넉넉한 상품에 예약 요청을 하나씩 50건, 스레드 300개에서 한꺼번에 300건 보내 결제 서버 쪽에서 쟀습니다(시간 제한 10초로 늘림).

방식마다 3번(#1\~#3) 돌렸고, 앞에 1건을 버렸습니다. 전체를 두 번 실행했습니다. 첫 실행 앞의 시험 실행은 원복 시간을 결제 결과를 남긴 때 기준으로 쟀다가, 그 자리에서 HTTP 비교가 결과를 남기기 전에 해제해 음수가 나와 요청을 보낸 때 기준으로 고치고 버렸습니다. 본문의 범위는 두 실행 6번을 합친 값입니다. 아래는 두 번째 실행입니다.

```text
결정 1 비교: 승인 먼저(Kafka 차감, 보상 취소) | #1 | 응답 ms 보통 중앙 34·p95 37·최대 37 / 늦음 중앙 33·p95 37·최대 37 / 멈춤 중앙 31·p95 40·최대 40 | 승인 답 30 | 넘겨 판 수량 0 | 어긋난 재고 -5 | 맞춰진 때 안 맞음 | 원복 ms 기록 없음
결정 1 비교: 승인 먼저(Kafka 차감, 보상 취소) | #2 | 응답 ms 보통 중앙 28·p95 33·최대 33 / 늦음 중앙 29·p95 32·최대 32 / 멈춤 중앙 29·p95 33·최대 33 | 승인 답 30 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 3289ms | 원복 ms 기록 없음
결정 1 비교: 승인 먼저(Kafka 차감, 보상 취소) | #3 | 응답 ms 보통 중앙 28·p95 29·최대 29 / 늦음 중앙 28·p95 41·최대 41 / 멈춤 중앙 28·p95 43·최대 43 | 승인 답 30 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 3216ms | 원복 ms 기록 없음
결정 2 비교: 코레오그래피 | #1 | 응답 ms 보통 중앙 23·p95 26·최대 26 / 늦음 중앙 1032·p95 1046·최대 1046 / 멈춤 중앙 17·p95 21·최대 21 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 752ms | 원복 ms 중앙 280·p95 1427·최대 2000 (25건)
결정 2 비교: 코레오그래피 | #2 | 응답 ms 보통 중앙 21·p95 23·최대 23 / 늦음 중앙 1031·p95 1047·최대 1047 / 멈춤 중앙 15·p95 27·최대 27 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 601ms | 원복 ms 중앙 575·p95 1184·최대 1867 (25건)
결정 2 비교: 코레오그래피 | #3 | 응답 ms 보통 중앙 20·p95 22·최대 22 / 늦음 중앙 1034·p95 1041·최대 1041 / 멈춤 중앙 15·p95 23·최대 23 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 243ms | 원복 ms 중앙 278·p95 1168·최대 2160 (25건)
결정 5 비교: 그 자리에서 HTTP 로 확정·해제 | #1 | 응답 ms 보통 중앙 26·p95 30·최대 30 / 늦음 중앙 2044·p95 2051·최대 2051 / 멈춤 중앙 17·p95 22·최대 22 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -5 | 맞춰진 때 안 맞음 | 원복 ms 중앙 1030·p95 1044·최대 1044 (10건)
결정 5 비교: 그 자리에서 HTTP 로 확정·해제 | #2 | 응답 ms 보통 중앙 25·p95 34·최대 34 / 늦음 중앙 2042·p95 2068·최대 2068 / 멈춤 중앙 16·p95 28·최대 28 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -5 | 맞춰진 때 안 맞음 | 원복 ms 중앙 1031·p95 1054·최대 1054 (10건)
결정 5 비교: 그 자리에서 HTTP 로 확정·해제 | #3 | 응답 ms 보통 중앙 24·p95 28·최대 28 / 늦음 중앙 2042·p95 2063·최대 2063 / 멈춤 중앙 14·p95 25·최대 25 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -5 | 맞춰진 때 안 맞음 | 원복 ms 중앙 1030·p95 1043·최대 1043 (10건)
결정 4 비교: 답 없으면 조회로 확인 | #1 | 응답 ms 보통 중앙 20·p95 24·최대 24 / 늦음 중앙 2042·p95 2069·최대 2069 / 멈춤 중앙 18·p95 25·최대 25 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 709ms | 원복 ms 중앙 627·p95 2548·최대 2574 (25건)
결정 4 비교: 답 없으면 조회로 확인 | #2 | 응답 ms 보통 중앙 18·p95 23·최대 23 / 늦음 중앙 2044·p95 2050·최대 2050 / 멈춤 중앙 15·p95 20·최대 20 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 585ms | 원복 ms 중앙 549·p95 2503·최대 2545 (25건)
결정 4 비교: 답 없으면 조회로 확인 | #3 | 응답 ms 보통 중앙 19·p95 22·최대 22 / 늦음 중앙 2043·p95 2052·최대 2052 / 멈춤 중앙 14·p95 17·최대 17 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 468ms | 원복 ms 중앙 364·p95 2546·최대 2600 (25건)
결정 4 비교: 답 없으면 실패로만(해제 안 보냄) | #1 | 응답 ms 보통 중앙 19·p95 28·최대 28 / 늦음 중앙 1033·p95 1036·최대 1036 / 멈춤 중앙 18·p95 28·최대 28 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -10 | 맞춰진 때 안 맞음 | 원복 ms 중앙 267·p95 281·최대 281 (5건)
결정 4 비교: 답 없으면 실패로만(해제 안 보냄) | #2 | 응답 ms 보통 중앙 21·p95 45·최대 45 / 늦음 중앙 1032·p95 1048·최대 1048 / 멈춤 중앙 15·p95 19·최대 19 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -10 | 맞춰진 때 안 맞음 | 원복 ms 중앙 360·p95 366·최대 366 (5건)
결정 4 비교: 답 없으면 실패로만(해제 안 보냄) | #3 | 응답 ms 보통 중앙 18·p95 22·최대 22 / 늦음 중앙 1030·p95 1042·최대 1042 / 멈춤 중앙 12·p95 17·최대 17 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 -10 | 맞춰진 때 안 맞음 | 원복 ms 중앙 323·p95 329·최대 329 (5건)
운영(예약 먼저 · 답 없으면 닫고 해제 · 확정·해제는 Outbox) | #1 | 응답 ms 보통 중앙 18·p95 25·최대 25 / 늦음 중앙 1027·p95 1035·최대 1035 / 멈춤 중앙 13·p95 18·최대 18 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 707ms | 원복 ms 중앙 593·p95 1509·최대 1540 (25건)
운영(예약 먼저 · 답 없으면 닫고 해제 · 확정·해제는 Outbox) | #2 | 응답 ms 보통 중앙 18·p95 22·최대 22 / 늦음 중앙 1030·p95 1034·최대 1034 / 멈춤 중앙 16·p95 31·최대 31 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 603ms | 원복 ms 중앙 593·p95 1392·최대 1620 (25건)
운영(예약 먼저 · 답 없으면 닫고 해제 · 확정·해제는 Outbox) | #3 | 응답 ms 보통 중앙 18·p95 21·최대 21 / 늦음 중앙 1032·p95 1043·최대 1043 / 멈춤 중앙 15·p95 23·최대 23 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 352ms | 원복 ms 중앙 302·p95 1553·최대 1562 (25건)
결정 3 비교: 수량만 | #1 | 응답 ms 보통 중앙 17·p95 18·최대 18 / 늦음 중앙 1036·p95 1048·최대 1048 / 멈춤 중앙 18·p95 24·최대 24 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 10 | 맞춰진 때 안 맞음 | 원복 ms 기록 없음
결정 3 비교: 수량만 | #2 | 응답 ms 보통 중앙 18·p95 20·최대 20 / 늦음 중앙 1036·p95 1046·최대 1046 / 멈춤 중앙 14·p95 23·최대 23 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 0 | 맞춰진 때 472ms | 원복 ms 기록 없음
결정 3 비교: 수량만 | #3 | 응답 ms 보통 중앙 19·p95 38·최대 38 / 늦음 중앙 1029·p95 1034·최대 1034 / 멈춤 중앙 12·p95 21·최대 21 | 승인 답 10 | 넘겨 판 수량 0 | 어긋난 재고 10 | 맞춰진 때 안 맞음 | 원복 ms 기록 없음
예약 응답 시간 | #1 | 하나씩 50건 ms 중앙 4·p95 6·p99 7·최대 7 | 한꺼번에 300건 ms 중앙 393·p95 655·p99 677·최대 683 | 1초 넘음 0건
예약 응답 시간 | #2 | 하나씩 50건 ms 중앙 4·p95 7·p99 25·최대 25 | 한꺼번에 300건 ms 중앙 360·p95 661·p99 682·최대 685 | 1초 넘음 0건
예약 응답 시간 | #3 | 하나씩 50건 ms 중앙 3·p95 6·p99 11·최대 11 | 한꺼번에 300건 ms 중앙 299·p95 521·p99 539·최대 544 | 1초 넘음 0건
```

응답은 결제 준비와 승인 요청이 답할 때까지의 시간이고, 구간마다 10건씩 셉니다. 승인 답은 고객이 받은 승인 답 수(뒤에 보상 취소된 것 포함)입니다. 넘겨 판 수량은 끝난 뒤 승인이 남은 결제의 수량에서 처음 재고를 뺀 값입니다(0보다 작으면 0). 어긋난 재고는 20초 뒤 (남은 재고 + 승인이 남은 결제의 수량) − 처음 재고로, 음수는 끝내 돌아오지 않은 재고, 양수는 처음보다 늘어난 재고입니다. 맞춰진 때는 재고 서비스를 되돌린 때부터 그 합이 처음 재고와 같아질 때까지이고(100ms마다 봄), 원복은 승인 없이 끝나거나 취소된 결제마다 그 요청을 보낸 때부터 재고 서비스가 그 예약을 해제한 때까지입니다. 수량만과 승인 먼저는 예약 기록이 없어 원복을 재지 못했습니다.

- 운영은 6번 모두 어긋난 재고가 0이었고, 맞춰진 때는 352\~716ms였습니다. 응답 중앙값은 보통 18\~21ms, 늦음 1027\~1038ms, 멈춤 13\~16ms였습니다. 원복은 25건 기준 중앙값 302\~626ms, p95 1321\~1553ms였습니다.
- 승인 먼저는 응답 중앙값이 보통 28\~36ms, 늦음 28\~33ms, 멈춤 27\~34ms로 재고 서비스가 늦거나 멈춰도 늘지 않았습니다. 대신 승인 답이 30건(재고 20개)이었고 10건은 그 뒤 보상 취소됐습니다. 어긋난 재고는 5번 0, 1번 −5였고, 맞춰진 때는 499\~3289ms(5번)와 안 맞음 1번이었습니다.
- 코레오그래피는 운영과 같은 모양이었습니다. 늦음 응답 중앙값 1031\~1038ms, 어긋난 재고 0(6번), 맞춰진 때 243\~752ms, 원복 중앙값 278\~575ms·p95 1168\~1465ms였습니다.
- 수량만은 어긋난 재고가 4번 +10, 2번 0이었습니다. 0이었던 두 번은 472ms, 476ms에 맞춰졌고 나머지는 20초 안에 맞지 않았습니다.
- 실패로만은 6번 모두 −10이었고, 조회로 확인은 어긋난 재고 0이었지만 늦음 응답 중앙값이 2040\~2045ms였습니다.
- 그 자리에서 HTTP는 6번 모두 −5였고, 늦음 응답 중앙값이 2042\~2045ms였습니다.
- 넘겨 판 수량은 모든 방식에서 0이었습니다. 이 측정은 30건을 한 건씩 차례로 보내 겹치지 않았고, 넘겨 파는 문제는 계약의 몰림 시험(승인 먼저의 승인 답 300)에서만 보였습니다.

![재고 서비스를 늦추고 멈춘 동안의 측정 비교(6번) — 결제 응답 중앙값은 운영 보통 18~21·늦음 1027~1038·멈춤 13~16ms, 승인 먼저 28~36·28~33·27~34ms, 코레오그래피 19~23·1031~1038·15~18ms, 수량만 16~19·1028~1036·12~18ms, 실패로만 18~21·1029~1035·12~18ms, 조회로 확인 18~23·2040~2045·14~18ms, 그 자리 HTTP 23~28·2042~2045·14~17ms. 어긋난 재고는 운영·코레오그래피·조회로 확인이 6번 모두 0, 승인 먼저가 5번 0과 1번 −5, 수량만이 4번 +10과 2번 0, 실패로만이 6번 −10, 그 자리 HTTP가 6번 −5. 맞춰진 때는 운영 352~716ms, 승인 먼저 499~3289ms(5번), 코레오그래피 243~752ms, 수량만 472·476ms(2번), 조회로 확인 468~716ms. 넘겨 판 수량은 모두 0](images/14_measurement-compare.svg)

연결 시간 제한의 근거로 잰 연결 시간은 아래와 같습니다. 재고 서비스(Tomcat) 포트에 TCP 연결을 하나씩 50번, 스레드 300개·1000개에서 한꺼번에 맺어 걸린 시간을 쟀고, 방식마다 3번씩 두 번 실행했습니다(앞에 20번 버림).

```text
연결 시간 | #1 | 하나씩 50번 ms 중앙 0·p95 0·p99 0·최대 0 | 한꺼번에 300 ms 중앙 5·p95 32·p99 33·최대 33 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 3·p95 52·p99 84·최대 85 · 300ms 넘음 0건, 실패 0건
연결 시간 | #2 | 하나씩 50번 ms 중앙 0·p95 0·p99 0·최대 0 | 한꺼번에 300 ms 중앙 0·p95 0·p99 0·최대 0 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 0·p95 0·p99 0·최대 1 · 300ms 넘음 0건, 실패 0건
연결 시간 | #3 | 하나씩 50번 ms 중앙 0·p95 0·p99 0·최대 0 | 한꺼번에 300 ms 중앙 0·p95 0·p99 0·최대 1 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 0·p95 2·p99 3·최대 4 · 300ms 넘음 0건, 실패 0건
연결 시간 | #1 | 하나씩 50번 ms 중앙 0·p95 0·p99 1·최대 1 | 한꺼번에 300 ms 중앙 4·p95 85·p99 86·최대 86 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 0·p95 3·p99 4·최대 11 · 300ms 넘음 0건, 실패 0건
연결 시간 | #2 | 하나씩 50번 ms 중앙 0·p95 0·p99 0·최대 0 | 한꺼번에 300 ms 중앙 0·p95 0·p99 0·최대 0 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 0·p95 96·p99 127·최대 128 · 300ms 넘음 0건, 실패 0건
연결 시간 | #3 | 하나씩 50번 ms 중앙 0·p95 0·p99 2·최대 2 | 한꺼번에 300 ms 중앙 0·p95 4·p99 4·최대 4 · 300ms 넘음 0건, 실패 0건 | 한꺼번에 1000 ms 중앙 2·p95 77·p99 79·최대 108 · 300ms 넘음 0건, 실패 0건
```

300ms는 측정한 최대(128ms)보다 커서 값을 그대로 두었습니다.

## 남은 한계

이 장의 구조로도 아래 문제들은 아직 해결하지 못합니다.

- 재고 서비스가 느리면 결제도 읽기 시간 제한(1s)만큼 느려지고, 멈추면 결제를 받지 못합니다. 결정 1의 비용으로 남겼습니다. 측정에서 재고 서비스가 늦는 동안 응답 중앙값은 1027\~1038ms였습니다.
- 재고 서비스의 답이 늦었을 뿐 실제로 잡았어도 결제는 승인 없이 실패로 끝납니다(결정 4).
- 쿠폰과 포인트는 결제 서버에 그대로 있습니다. 이 장에서 나눈 것은 재고뿐이고, 포인트가 다른 서비스로 나뉘는 경우는 다루지 않았습니다. 8장 되돌리기 비교의 포인트 계약도 그대로 실패합니다.
- 예약 만료(TTL)가 없습니다. 예약을 남긴 뒤 결제 서버가 결과를 정하지 못하면, 예약은 4장 보정이나 알림 반영이 결제를 닫을 때까지 남습니다. 예약이 스스로 풀리지 않고, 결제 서버가 예약 직전·직후에 죽는 경우는 실행으로 확인하지 않았습니다.
- 받는 쪽의 일반적인 중복 가리기·재시도·실패 모음이 없습니다. 재고 서비스는 같은 확정·해제를 예약 상태 전이로만 한 번 반영하고, 처리에 실패한 명령은 Spring Kafka 기본 처리 그대로입니다. 11장에서 다룹니다.
- 빈 해제 줄과 보낸 `payment_outbox` 줄을 지우지 않습니다. 결제마다 예약 줄과 재고 명령 줄이 쌓입니다.
- 결정 2는 계약과 측정으로 갈리지 않았습니다. 코레오그래피도 계약 21개를 모두 통과했고, 오케스트레이션을 고른 실행 근거는 이 장에 없습니다.
- 시간 제한 근거(예약 응답 p99, 연결 시간)는 같은 머신의 루프백에서 잰 값이고, 운영 망에서도 맞다는 것은 가정입니다.
- `insert ignore`가 같은 번호를 남기는 중인 트랜잭션을 기다린다는 것은 MySQL 문서로 확인하지 못했고, 계약이 통과한 실행으로만 압니다.
- 몰림 계약(서버 두 대·300건)은 겹침을 고정하지 않아 비교 구현에서 실행마다 결과가 흔들렸습니다.
- 완전 비동기(202)는 API 약속이 바뀌어 비교로 돌리지 않았습니다.
- 재고 서비스 모듈에는 커버리지 검사를 걸지 않았습니다(주문 서비스·mock-pg와 같습니다).

![10장 구조로 남은 한계 — 결정의 비용으로 남긴 것은 재고 서비스가 느리면 결제도 읽기 1s만큼 느려지고(늦음 응답 중앙 1027~1038ms) 멈추면 결제를 받지 못하는 것과 답만 늦어도 승인 없이 실패하는 것임. 받는 쪽의 일반적인 중복 가리기·재시도·실패 모음은 11장으로 넘겼음. 쿠폰·포인트 분리, 예약 만료(TTL), 결제 서버가 예약 직전·직후에 죽는 경우는 다루지 않았음. 빈 해제 줄, 보낸 payment_outbox 줄, 예약 줄은 지우지 않고 쌓임. 결정 2가 계약과 측정으로 갈리지 않은 것, 루프백에서 잰 시간 제한 근거, insert ignore의 기다림, 흔들리는 몰림 계약, 돌리지 않은 완전 비동기, 재고 서비스 모듈 커버리지는 실행이나 문서로 확인하지 못했음](images/15_remaining-limits.svg)

앞 글에서 10장으로 넘긴 항목은 이렇게 되었습니다.

- 1장 [결제 기초: 인증, 승인, 매입, 취소와 상태 머신](../payment-state-machine/) 연재 목차의 "10장 Saga와 보상 트랜잭션": 재고를 재고 서비스로 나누고, 재고 예약 → 카드사 승인 → 예약 확정 또는 해제를 결제 서버가 결제 상태로 진행하도록 했습니다. 보상은 예약 해제이고, 확정·해제는 상태 전이 트랜잭션에서 `payment_outbox`에 남겨 보냅니다.
- 8장 [결제와 재고·포인트·쿠폰](../payment-stock-point-coupon/) 도입의 "이미 끝난 일을 되돌리는 보상 트랜잭션은 10장": 이 장의 보상은 승인 없이 끝나거나 전액 취소된 결제의 예약 해제입니다. 카드사 승인을 먼저 받고 재고가 없으면 카드사 취소로 되돌리는 보상은 결정 1의 비교로만 돌렸고, 계약 7개가 실패했습니다.
- 9장 [Transactional Outbox와 Kafka](../payment-outbox-kafka/) 도입과 넘겨받은 항목의 "재고를 다른 서비스로 나누는 일은 10장": 재고를 `inventory-service`로 나눴습니다. 쿠폰·포인트는 결제 서버에 남았습니다.
- 9장 넘겨받은 항목의 "다른 서비스의 데이터를 그 결과로 돌려주는 일은 재고를 나누는 10장": 결제 결과를 받은 쪽이 스스로 돌려주는 방식(코레오그래피)은 비교로 돌렸고, 운영은 결제 서버가 같은 `payment_outbox`와 9장 릴레이로 재고 명령을 보냅니다.
- 9장 다음 글 예고의 "그 서비스의 재고를 무엇으로 돌려줄지": 결제 번호로 남긴 예약 줄의 해제 명령으로 돌려줍니다. 해제가 예약보다 먼저 와도, 두 번 와도, 재고 서비스가 멈춘 동안 생겨도 재고가 한 번만 돌아오는 것을 계약으로 확인했습니다.

## 요약

오늘은 Saga와 보상 트랜잭션을 정리하였습니다. 요약하자면 아래와 같습니다.

- 8장 방식을 그대로 HTTP 호출로 바꾼 출발 코드에서는 10장 계약 21개 중 7개와 8장 계약 1개가 실패했습니다. 재고 서비스의 답이 늦으면 재고는 줄었는데 결제는 준비 상태로 남았고, 결제가 그만둔 요청이 나중에 도착해 재고를 줄였고, 재고 서비스가 멈춘 동안의 돌려주기가 사라졌습니다.
- 재고는 인증을 커밋한 뒤, 카드사 승인 전에 재고 서비스에 동기 HTTP로 예약합니다. 시간 제한은 결정 1 커밋에서 연결 300ms·읽기 1s로 정했고, 뒤에 루프백에서 잰 예약 300건 동시 최대 544\~746ms와 연결 1000개 동시 최대 1\~128ms로 근거를 더했습니다. 승인 먼저는 응답이 재고 서비스와 상관없었지만 계약 7개가 실패했고, 재고가 모자란 주문도 카드사에서 승인된 뒤 취소됐습니다.
- 결제 서버가 결제 상태에 따라 재고 서비스에 예약 확정 또는 해제 명령을 보냅니다. 코레오그래피도 같은 계약 21개를 모두 통과해 계약으로는 갈리지 않았고, 차이는 재고 서비스가 결제 상태 여섯 개의 뜻을 알아야 한다는 점과, 재고를 잡지 않은 결제에도 빈 해제 줄을 남긴다는 점(코드로 본 것)이었습니다.
- 재고 서비스는 결제 번호로 예약 줄을 남기고 잡음 → 확정 / 해제로 바꿉니다. 수량만 바꾸면 해제가 먼저 오거나 두 번 올 때 재고가 7(처음 5)로 늘었습니다.
- 예약 답을 받지 못하면 카드사에 승인을 요청하지 않고 결제를 닫은 뒤 해제를 보냅니다. 실패로만 보면 측정에서 재고 10개가 돌아오지 않았고, 조회로 확인하면 처리 중인 예약을 보지 못해 계약 1개가 실패하고 늦을 때 응답이 2040\~2045ms로 늘었습니다.
- 확정·해제는 상태 전이 트랜잭션에서 `payment_outbox`에 남기고 9장 릴레이가 결제 번호 키로 보냅니다. 그 자리에서 HTTP로 보내면 재고 서비스가 멈춘 동안의 해제 5건이 사라졌습니다. 운영은 6번 모두 어긋난 재고가 0이었고, 원복 중앙값은 302\~626ms였습니다.

## 다음 글 예고

다음 글에서는 11장 컨슈머 멱등성·재시도·DLQ를 다룹니다. 이 장의 재고 서비스는 같은 확정·해제를 예약 상태 전이로만 한 번 반영하고, 9장의 주문 서비스는 받은 이벤트를 그대로 따릅니다. 처리에 실패한 명령과 이벤트도 Spring Kafka 기본 처리 그대로입니다. 받는 쪽이 같은 메시지를 어떻게 가리고, 처리에 실패한 메시지를 언제 다시 시도하고 어디에 모을지를 정해야 합니다.

참조 :

- [payment-challenge — chapter-10 브랜치](https://github.com/qkrxodud/payment-challenge/tree/chapter-10)
- [Locks Set by Different SQL Statements in InnoDB — MySQL 8.4 Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
