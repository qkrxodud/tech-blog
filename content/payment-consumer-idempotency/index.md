---
title: "컨슈머 멱등성·재시도·DLQ"
tags: ["결제", "Kafka", "멱등성", "DLQ", "MySQL"]
summary: "메시지를 받는 주문 서비스·재고 서비스에서 같은 메시지와 늦게 온 옛 메시지를 가리고, 처리에 실패한 메시지를 다시 시도해 실패 모음(DLT)에 모으는 방법을 정하고, 비교 구현과 측정으로 확인한 결과를 정리합니다."
---

이전에 [Saga와 보상 트랜잭션](../payment-saga-inventory/)에 대해 작성하였습니다. 그 글에서는 재고를 재고 서비스로 나누고, 결제 서버가 결제 상태에 따라 재고 예약 확정·해제 명령을 `payment_outbox`에 남겨 9장 [Transactional Outbox와 Kafka](../payment-outbox-kafka/)의 릴레이로 보내도록 했습니다. 그리고 다음 글 예고에 "받는 쪽이 같은 메시지를 어떻게 가리고, 처리에 실패한 메시지를 언제 다시 시도하고 어디에 모을지를 정해야 합니다."라고 적었습니다.

9장부터 결제 서버는 결제 결과를 적어도 한 번 보냅니다. 릴레이가 보낸 뒤 보낸 때를 남기기 전에 서버가 멈추면 받는 쪽은 같은 이벤트를 다시 받을 수 있습니다. 10장에서 더한 재고 명령도 같은 릴레이로 나갑니다. 이 메시지를 받는 곳은 두 곳입니다. 주문 서비스는 결제 결과 이벤트를 받아 주문 상태를 바꾸고, 재고 서비스는 확정·해제 명령을 받아 예약 상태를 바꿉니다. 10장까지 주문 서비스는 받은 결과를 모두 남기고 받은 순서대로 주문 상태를 바꿨고, 재고 서비스는 같은 명령이 다시 오면 예약 상태 전이로만 한 번 반영했습니다. 처리에 실패한 메시지는 둘 다 Spring Kafka 기본 처리(바로 다시 시도, 10번째에 로그를 남기고 넘어감) 그대로였습니다.

오늘은 연재의 열한 번째 글이자 3부 "서비스를 분리하면"의 마지막 글로, 메시지를 받는 쪽에서 같은 메시지와 늦게 온 옛 메시지를 가리고, 처리에 실패한 메시지를 다시 시도하고 모으는 방법을 정리하도록 하겠습니다. 같은 메시지를 어떻게 가릴지, 늦게 온 옛 메시지를 어떻게 거를지, 실패한 메시지를 언제 다시 시도할지, 다시 시도를 다 쓴 메시지를 어디에 모을지를 차례로 정하고, 다른 선택지를 같은 계약 테스트와 같은 측정으로 비교합니다.

![11장 개요 — 결제 서버의 payment_outbox 번호를 단 메시지를 9장 릴레이가 적어도 한 번 보내(보낸 때를 남기기 전에 서버가 멈추면 같은 메시지를 다시 받을 수 있음) Kafka의 payment-events(결제 결과)와 stock-reservation-commands(확정·해제 명령)로 나가고, 받는 쪽 주문 서비스는 결제 결과로 주문 상태를, 재고 서비스는 명령으로 예약 상태를 바꿈. 이 장은 받는 쪽 두 곳에 같은 규칙을 넣어 같은 메시지 가리기, 늦게 온 옛 메시지 거르기, 실패한 메시지를 언제 다시 시도할지, 다시 시도를 다 쓴 메시지를 어디에 모을지 네 가지를 정하고, Redis·보낸 줄 지우기·예약 만료(TTL)는 범위 밖으로 둔 그림](images/00_chapter-overview.svg)

범위를 먼저 밝히겠습니다. 받는 쪽 두 곳, 주문 서비스의 결제 결과 소비자와 재고 서비스의 재고 명령 소비자에 같은 규칙을 넣었습니다. Redis는 쓰지 않았습니다. 보낸 `payment_outbox` 줄을 지우는 일과 예약 만료(TTL)는 이 장에서도 하지 않았습니다.

이 장의 코드는 [payment-challenge](https://github.com/qkrxodud/payment-challenge/tree/chapter-11)의 `chapter-11` 브랜치에 있고, 출발 코드는 `ch11-start`, 완성 코드는 `ch11` 태그입니다.

## 현재 구조: 받은 순서대로 따르고, 실패하면 기본 처리에 맡기는 소비자

출발 코드(`ch11-start`)의 운영 코드는 10장 그대로입니다. 주문 서비스는 결제 이벤트를 받을 때마다 받은 기록(`received_payment_event`)에 한 줄을 남기고, 주문 상태를 그 이벤트의 결제 결과대로 바꿉니다. 받은 기록의 이벤트 번호(`event_id`)에는 고유 키가 없어 같은 번호도 한 줄 더 남고, 앞서 받은 결과보다 오래된 결과인지는 보지 않습니다.

```java
// order-service/src/main/java/com/example/order/application/order/OrderPaymentService.java (ch11-start)
@Transactional
public void apply(PaymentEventCommand command) {
    Instant now = clock.instant();
    receivedPaymentEventRepository.save(ReceivedPaymentEvent.of(command.eventId(), command.orderId(),
            command.paymentStatus(), command.occurredAt(), command.partition(), command.offset(), now));
    PaymentOutcome outcome = PaymentOutcome.valueOf(command.paymentStatus());
    orderRepository.findByOrderId(command.orderId())
            .ifPresentOrElse(order -> order.follow(outcome, now),
                    () -> orderRepository.save(Order.paidWith(command.orderId(), outcome, now)));
}
```

재고 서비스는 확정 명령이면 확정하고, 그 밖의 명령은 모두 해제로 처리합니다. 같은 확정이나 해제가 다시 오면 10장 예약 상태 전이(확정은 잡힌 예약만, 해제는 재고를 쥔 예약만 바꿈)가 한 번만 반영합니다.

```java
// inventory-service/src/main/java/com/example/inventory/presentation/command/StockCommandListener.java (ch11-start)
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

두 서비스 모두 처리에 실패했을 때의 처리기를 따로 두지 않아 Spring Kafka 기본 처리를 씁니다. 문서에는 "By default, after ten failures, the failed record is logged (at the ERROR level)."라고 적혀 있고, 기본값은 처음 1번에 더해 간격 없이 9번 다시 시도하는(모두 10번) `FixedBackOff(0L, 9)`입니다. 다시 시도할 때는 실패한 메시지를 포함해 남은 메시지를 다시 읽도록 그 자리로 되돌아갑니다("If retries are not exhausted, perform seeks so that all the remaining records (including the failed record) will be redelivered."). 읽은 자리(오프셋)는 리스너 컨테이너가 커밋하고, 기본 AckMode는 `BATCH`입니다.

![11장 출발 코드(ch11-start)에서 결제 결과 하나가 지나는 순서 — 9장 릴레이가 결제 번호를 키로 payment-events에 보내면 주문 서비스가 PaymentEventListener.receive와 readValue로 읽고, OrderPaymentService.apply 트랜잭션에서 고유 키가 없는 받은 기록에 같은 번호도 한 줄 더 남긴 뒤 PaymentOutcome.valueOf, findByOrderId, Order.follow로 옛 결과인지 보지 않고 받은 순서대로 주문을 바꾸고 커밋함. 재고 서비스는 isConfirm이면 confirm, 그 밖의 명령은 모르는 명령까지 모두 release로 처리하고, 같은 확정·해제는 10장 예약 상태 전이가 한 번만 반영함. 실패하면 두 서비스 모두 처리기 없이 Spring Kafka 기본 처리 FixedBackOff(0L, 9)로 같은 자리에서 처음 1번에 간격 없이 9번 더(모두 10번, 이 환경에서 약 0.5초씩, 모두 약 4.6초) 읽은 뒤 ERROR 로그를 남기고 넘어가 메시지가 사라짐](images/01_start-structure-sequence.svg)

받는 쪽이 메시지를 가릴 때 쓸 번호는 이미 메시지에 실려 있습니다. 결제 이벤트의 `eventId`와 재고 명령의 `commandId` 모두 결제 서버 `payment_outbox`의 번호(auto_increment)입니다(`PaymentOutbox.toEvent`·`toStockCommand`). 같은 결제의 결과와 재고 명령이 같은 표에서 번호를 받습니다.

출발 코드에 소비자 계약을 먼저 작성했습니다. 앞 장들처럼 지켜야 하는 규칙은 추상 클래스에 두고 구현마다 상속해 같은 테스트를 돌립니다. 주문 서비스는 `PaymentEventConsumerContract` 12개, 재고 서비스는 `StockCommandConsumerContract` 12개이고, 다음을 봅니다.

- 같은 메시지를 다시 읽어도 한 번만 반영되는지(주문 서비스는 결제 서버가 같은 결과를 다시 보낸 경우도 봄)
- 새 결과 뒤에 늦게 온 옛 결과를 반영하지 않는지, 서버 시계가 달라 만든 시각이 뒤바뀐 새 결과는 반영하는지
- 모르는 상태·명령과 읽을 수 없는 본문을 다시 시도하지 않고 실패 모음(DLQ, Dead Letter Queue — 이 장에서는 `<토픽>.DLT` 토픽)에 남기며, 같은 자리의 뒤 메시지를 붙잡지 않는지
- 받는 쪽 저장소가 잠시 쓰기를 거부한 동안 온 메시지가 저장소가 돌아오면 반영되는지
- 다시 시도를 다 쓴 메시지가 원인과 함께 실패 모음에 남는지, 실패 모음에서 다시 넣은 메시지가 같은 규칙을 따르는지(아직 반영 전이면 반영, 더 새 것이 반영됐으면 무시)
- 같은 결제의 메시지가 앞 메시지를 다시 시도하는 동안에도 보낸 순서대로 반영되는지

![11장 소비자 계약 — 주문 서비스의 PaymentEventConsumerContract 12개와 재고 서비스의 StockCommandConsumerContract 12개가 같은 여섯 갈래를 봄. 같은 메시지를 다시 읽어도 한 번만 반영(주문은 결제 서버가 같은 결과를 다시 보낸 경우도), 새 결과 뒤 늦게 온 옛 결과는 반영하지 않고 시계가 달라 시각이 뒤바뀐 새 결과는 반영, 모르는 상태·명령과 읽을 수 없는 본문은 다시 시도 없이 실패 모음 토픽(.DLT)에 남기고 같은 자리의 뒤 메시지를 붙잡지 않음, 저장소가 잠시 쓰기를 거부한 동안 온 메시지가 돌아오면 반영, 다 쓴 메시지는 원인과 함께 실패 모음에 남고 다시 넣으면 아직 반영 전이면 반영·더 새 것이 반영됐으면 무시, 같은 결제의 메시지는 다시 시도 중에도 보낸 순서대로 반영. 계약의 다시 시도 간격은 2·4·4·4초(합 14초), 저장소 장애는 6초인 그림](images/02_contract-groups.svg)

시험 도구는 아래와 같이 만들었습니다.

- 메시지는 시험이 받는 쪽 토픽에 직접 싣습니다(`MessageFeed`, 키 = 결제 번호). 이벤트·명령 번호는 결제 서버 번호와 겹치지 않게 10억대에서 시작합니다. "결제 서버가 같은 결과를 다시 보냄" 하나만 결제 서버를 거치고, 보낸 결과의 `sent_at`을 비워 릴레이가 다시 보내게 합니다(9·10장과 같은 방법).
- 받는 쪽 저장소 장애는 MySQL 관리자 계정으로 `set global read_only = on/off`를 걸어 만듭니다(`ReceiverOutage`). 받는 쪽 계정의 쓰기가 곧바로 오류 1290으로 실패합니다. 두 서비스와 결제 서버가 같은 MySQL 컨테이너를 써 함께 막히고, 연결이 끊기는 장애는 만들지 않았습니다.
- 한 주문·예약의 변경만 실패시키는 장애는 트리거(`signal sqlstate '45000'`)로 만들고, 일시 오류로 분류됩니다.
- "다 처리했다"는 받는 쪽 소비자 그룹이 커밋한 자리가 토픽 끝에 닿은 때로 봅니다(`TopicLag`).
- 결제 이벤트 토픽은 컨텍스트마다 새 이름으로 만듭니다. 이벤트 번호가 컨텍스트(MySQL 컨테이너)마다 1부터라, 같은 토픽을 쓰면 다른 컨텍스트의 이벤트가 같은 번호로 들어와 결정 1에 걸러지기 때문입니다. 10장 재고 명령 토픽과 같은 이유입니다.

계약에서는 다시 시도 간격을 2·4·4·4초(합 14초)로 줄이고, 받는 쪽 저장소 장애를 6초 냅니다. 처음에는 1초씩 3번·장애 1.5초로 두었는데 출발 코드에서도 장애 계약이 통과했습니다. Spring Kafka 기본 처리의 10번이 이 환경에서 바로 끝나지 않고 다시 읽을 때마다 약 0.5초씩, 모두 약 4.6초 걸렸기 때문입니다(로그의 시도 간격). 0.5초는 소비자 `fetch.max.wait.ms` 기본값(500ms)과 같아 다시 읽는 요청이 그만큼 기다린 것으로 보이지만, 확인하지 않았습니다(가정). 그래서 장애를 기본 처리 시간보다 길고 계약의 다시 시도보다 짧은 6초로 늘렸습니다. 다시 시도하지 않았는지는 "처리할 수 없는 결과 뒤의 결과는 첫 다시 시도 간격(2초) 안에 반영된다"로 봅니다.

![11장 계약의 시험 도구와 시간 값 — MessageFeed는 받는 쪽 토픽에 결제 번호 키로 직접 싣고 번호는 10억대부터, ReceiverOutage는 관리자 계정의 read_only on/off로 받는 쪽 쓰기를 오류 1290으로 막으며 결제 서버와 두 서비스가 함께 막힘, 트리거 signal sqlstate 45000은 한 주문·예약의 변경만 일시 오류로 실패시킴, TopicLag는 소비자 그룹이 커밋한 자리가 토픽 끝에 닿으면 다 처리한 것으로 봄, 결제 이벤트 토픽은 컨텍스트마다 새 이름임. 연결이 끊기는 장애는 만들지 않았고, 처리 뒤 커밋 전 재기동은 같은 메시지를 한 번 더 실어 대신함(가정). 시간 축에서 기본 처리 모두 10번(처음 1 + 다시 9)은 약 0.5초씩 모두 약 4.6초(0.5초가 fetch.max.wait.ms 500ms와 같은지는 확인하지 않음), 처음 둔 장애 1.5초·1초씩 3번은 출발 코드에서도 통과, 계약 장애 6초, 계약 다시 시도 2·4·4·4초(합 14초)이고 첫 간격 2초 안에 뒤 결과가 반영되는지로 다시 시도하지 않았는지를 봄. 운영 값은 1·2·4·8초(합 15초)로 따로 둔 그림](images/03_test-setup.svg)

밝혀 둘 가정이 하나 있습니다. 소비자가 처리한 뒤 읽은 자리를 커밋하기 전에 다시 뜨는 경우는 따로 만들지 않았습니다. 받는 쪽에서는 같은 메시지를 다시 받는 것과 같다고 보고, 시험이 같은 메시지를 토픽에 한 번 더 싣는 것으로 대신했습니다.

## 현재 구조의 문제: 테스트로 재현하기

아래는 같은 결과를 다시 읽는 계약과 취소 뒤에 옛 승인이 늦게 오는 계약입니다. 옛 승인은 취소보다 0.2초 먼저 만든 결과로 싣습니다.

```java
// src/test/java/com/example/payment/application/payment/PaymentEventConsumerContract.java
@Test
@DisplayName("같은 결제 결과를 다시 읽어도 주문은 다시 바뀌지 않는다")
void rereadResultDoesNotChangeOrderAgain() {
    Event approved = Event.approved(newPayment());
    send(approved);
    awaitStatus(approved.orderId(), "PAID");
    Instant firstChange = orderServer.updatedAtOf(approved.orderId());

    send(approved);
    orderServer.awaitCaughtUp(ARRIVAL);

    assertThat(orderServer.updatedAtOf(approved.orderId())).isEqualTo(firstChange);
}

@Test
@DisplayName("취소 뒤에 그보다 먼저 만든 승인이 늦게 와도 주문은 취소 상태로 남는다")
void lateOlderApprovalDoesNotRevertCanceledOrder() {
    Event approved = Event.approved(newPayment());
    Event canceled = approved.next("APPROVAL_CANCELED", Duration.ofMillis(200));

    send(canceled);
    awaitStatus(approved.orderId(), "CANCELED");
    send(approved);
    orderServer.awaitCaughtUp(ARRIVAL);

    assertThat(orderServer.statusOf(approved.orderId())).isEqualTo("CANCELED");
}
```

출발 코드에서 `./gradlew clean test`(별도 worktree)를 돌린 결과는 아래와 같습니다. 같은 실행에서 앞 장 시험 713개는 모두 통과했습니다.

```text
# 태그 ch11-start 의 코드(운영 코드는 10장 그대로)에서 ./gradlew clean test — 전체 tests=737 failures=18 errors=0 time=1076.124s
## 결제 결과 받기(주문 서비스) — 운영 구현
FAIL 모르는 결제 상태가 실린 결과는 실패 모음에 남는다 (30.3s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 실패 모음에서 다시 넣은 결과는 아직 반영되지 않았으면 반영된다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 주문 서비스의 저장소가 잠시 쓰기를 거부한 동안 온 결과도 저장소가 돌아오면 반영된다 (36.1s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Condition with Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract was not fulfilled within 30 seconds.
FAIL 취소 뒤에 그보다 먼저 만든 승인이 늦게 와도 주문은 취소 상태로 남는다 (0.18s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: "CANCELED" but was: "PAID"
FAIL 처리할 수 없는 결과가 있어도 같은 자리의 뒤 결과는 첫 다시 시도 간격 안에 반영된다 (4.63s) | java.lang.AssertionError: java.lang.AssertionError: Expecting actual: 4.600917125S to be less than: 2S 
FAIL 읽을 수 없는 결과는 실패 모음에 남는다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 다시 시도를 다 쓴 결과는 실패 모음에 그 원인과 함께 남는다 (30.1s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 같은 주문의 결과는 앞 결과를 다시 시도하는 동안에도 보낸 순서대로 받는다 (36.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Condition with Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract was not fulfilled within 30 seconds.
PASS 결제 서버 시계가 서로 달라 새 결과의 만든 시각이 앞선 결과보다 이르게 찍혀도 새 결과가 반영된다 (0.165s)
FAIL 같은 결제 결과를 다시 읽어도 주문은 다시 바뀌지 않는다 (0.173s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 2026-11-21T04:54:55.521497Z but was: 2026-11-21T04:54:55.571885Z
FAIL 실패 모음에서 다시 넣은 결과는 그사이 더 새 결과가 반영됐으면 무시된다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 결제 서버가 같은 결제 결과를 다시 보내도 주문 서비스는 받은 결과를 한 번만 남긴다 (0.322s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 1 but was: 2
## 재고 명령 받기(재고 서비스) — 운영 구현
FAIL 모르는 재고 명령은 실패 모음에 남는다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 실패 모음에서 다시 넣은 명령은 아직 반영되지 않았으면 반영된다 (30.3s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
PASS 같은 해제를 다시 읽어도 재고는 한 번만 돌아온다 (0.217s)
FAIL 모르는 재고 명령은 예약을 바꾸지 않는다 (0.195s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: "RESERVED" but was: "RELEASED"
FAIL 읽을 수 없는 재고 명령은 실패 모음에 남는다 (30.1s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 실패 모음에서 다시 넣은 명령은 그사이 더 새 명령이 반영됐으면 무시된다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 다시 시도를 다 쓴 명령은 실패 모음에 그 원인과 함께 남는다 (30.3s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 재고 서비스의 저장소가 잠시 쓰기를 거부한 동안 온 명령도 저장소가 돌아오면 반영된다 (36.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Condition with Lambda expression in com.example.payment.application.payment.StockCommandConsumerContract was not fulfilled within 30 seconds.
PASS 같은 예약의 확정을 다시 시도하는 동안 해제가 와도 예약은 해제로 끝나고 재고는 돌아온다 (6.24s)
PASS 처리할 수 없는 명령이 있어도 같은 자리의 뒤 명령은 첫 다시 시도 간격 안에 반영된다 (0.159s)
PASS 해제 뒤에 그보다 먼저 만든 확정이 늦게 와도 예약은 해제 상태로 남는다 (0.185s)
PASS 같은 확정을 다시 읽어도 예약이 잡은 재고는 한 번만 줄어 있다 (0.204s)
```

737개 중 18개가 실패했고, 모두 11장 계약입니다. 주문 서비스 12개 중 11개, 재고 서비스 12개 중 7개입니다. 이 장에서 다룰 문제는 다섯 가지로 나눌 수 있습니다.

![11장 출발 코드에서 재현한 문제 다섯 가지 — 1 같은 메시지 두 번: 주문 서비스는 다시 보낸 결과에 받은 기록 2줄(기대 1), 다시 읽은 결과에 주문 상태는 같지만 updated_at이 다시 바뀜. 재고 서비스는 10장 예약 상태 전이로 재현되지 않음. 2 늦게 온 옛 메시지: 취소 뒤 옛 승인에 PAID(기대 CANCELED), 시계가 다른 서버의 새 결과는 받은 순서대로 따라 통과. 재고는 해제가 끝 상태라 재현되지 않음. 3 처리할 수 없는 메시지: 모르는 상태와 읽을 수 없는 본문은 기본 처리 10번 뒤 로그만 남아 30초 동안 실패 모음에 없음, 재고는 읽을 수 없는 명령도 같고 모르는 명령 HOLD를 해제로 처리해 RELEASED(기대 RESERVED). 4 일시 장애: 6초 read_only 동안 온 결과와 명령이 기본 처리 10번을 장애 중에 다 써 반영되지 않고, 주문의 다시 시도 중 순서도 앞 승인을 잃어 실패, 1.5초 장애로는 재현되지 않음. 5 같은 파티션 막힘: 모르는 상태 뒤 결과가 4.60초 뒤 반영(기대 2초 안), 재고는 모르는 명령을 해제로 처리해 통과. 나머지는 실패 모음·다시 넣기 계약 3개씩이고, 737개 중 18개(주문 12 중 11, 재고 12 중 7)가 실패하고 앞 장 713개는 통과한 그림](images/04_start-problems.svg)

첫째, 같은 메시지가 두 번 오면 주문 서비스가 두 번 반영합니다. 결제 서버가 같은 결과를 다시 보내자 받은 기록이 2줄 남았고(기대 1), 같은 결과를 다시 읽자 주문 상태는 같은 값이었지만 `updated_at`이 다시 바뀌었습니다. 재고 서비스에서는 재현되지 않았습니다. 같은 확정·해제를 다시 읽어도 10장 예약 상태 전이가 이미 지난 상태로 보고 바꾸지 않아, 두 계약 모두 통과했습니다.

둘째, 늦게 온 옛 메시지가 주문 상태를 되돌립니다. 취소를 먼저 반영한 뒤 그보다 먼저 만든 승인이 오자 주문이 결제 완료(`PAID`)로 돌아갔습니다(기대 `CANCELED`). 출발 코드는 받은 순서대로 따르므로, 서버 시계가 달라 만든 시각이 뒤바뀐 새 결과의 계약은 통과했습니다. 재고 서비스에서는 재현되지 않았습니다. 해제 뒤에 그보다 먼저 만든 확정이 와도 해제는 끝 상태라 예약이 되살아나지 않았습니다.

주문 서비스에서 첫째·둘째 문제가 생기는 순서를 그리면 아래와 같습니다.

![11장 출발 코드의 주문 서비스에서 첫째·둘째 문제가 생기는 순서 — OrderPaymentService.apply는 받은 결과를 받은 기록(received_payment_event, 고유 키 없음)에 남긴 뒤 주문을 결과대로 바꾸고 updated_at을 지금 시각으로 바꿈. 첫째: 승인(번호 N)이 오면 받은 기록 1줄, 주문 PAID. 같은 승인 N이 다시 오면(결제 서버가 다시 보내거나 다시 읽음) 받은 기록이 2줄(기대 1)이 되고, 주문은 PAID 그대로지만 updated_at이 다시 바뀜. 둘째: 다른 결제에서 취소(승인보다 0.2초 뒤에 만든 결과)를 먼저 반영해 CANCELED가 된 뒤 그보다 먼저 만든 승인이 늦게 오면 받은 순서대로 따라 PAID로 돌아감(기대 CANCELED). 재고 서비스는 10장 예약 상태 전이로 두 문제 모두 재현되지 않은 그림](images/25_start-duplicate-late-order.svg)

셋째, 처리할 수 없는 메시지가 사라지거나 잘못 반영됩니다. 모르는 결제 상태가 실린 결과와 읽을 수 없는 본문은 기본 처리 10번 뒤 로그만 남고 넘어가, 30초 동안 실패 모음에 나타나지 않았습니다. 재고 서비스의 읽을 수 없는 명령도 같았습니다. 재고 서비스는 모르는 명령("HOLD")을 해제로 처리해 예약을 풀었습니다(기대 `RESERVED`, 실제 `RELEASED`). 10장 코드가 확정이 아니면 해제로 보기 때문입니다. 계획에 없던 형태라 실행에서 본 것으로 적습니다.

넷째, 일시 장애 동안 온 메시지를 잃습니다. 받는 쪽 저장소를 6초 읽기 전용으로 돌린 동안 온 결과와 명령은 장애가 끝난 뒤 30초를 기다려도 반영되지 않았습니다. 기본 처리 10번을 장애 중에 다 써 버렸기 때문입니다. 앞에서 적었듯 1.5초 장애로는 재현되지 않았습니다. 주문 서비스의 "다시 시도 중 순서" 계약도 같은 이유로 실패했습니다. 앞 결과(승인)를 잃어 두 번째 결과가 받은 기록에 오지 않았습니다.

다섯째, 처리할 수 없는 메시지 하나가 같은 파티션을 막습니다. 모르는 상태가 실린 결과 바로 뒤에 같은 파티션으로 보낸 결과는 4.60초 뒤에 반영됐습니다(기대 2초 안). 기본 처리 10번이 끝날 때까지 뒤 결과가 기다렸습니다. 재고 서비스의 같은 계약은 통과했는데, 모르는 명령을 실패로 보지 않고 해제로 처리했기 때문입니다.

나머지는 다시 시도를 다 쓴 메시지의 실패 모음 계약과 다시 넣기 계약 2개로, 두 서비스에서 3개씩입니다. 실패 모음이 없어 모두 30초를 기다리다 실패했습니다.

## 선택지와 트레이드오프

이 문제를 해결하면서 내린 결정은 네 가지이고, 커밋도 결정 번호 순서대로 했습니다. 결정 1·2의 비교 구현은 다른 결정(3·4 포함)을 운영과 같게 두어, 비교의 차이가 그 결정에서만 나오게 했습니다.

### 결정 1. 같은 메시지를 어떻게 가릴까

이 장에서는 처리한 메시지 번호를 받는 쪽 상태 변경과 같은 트랜잭션에서 두 번 오를 수 없는 표에 남기고, 이미 있으면 아무것도 바꾸지 않기로 했습니다.

검토한 선택지는 네 가지입니다.

- 번호를 고유 키가 있는 표에 상태 변경과 같은 트랜잭션으로 남김
- 가리지 않음(9·10장의 주문 서비스)
- 상태 전이 규칙만으로 흡수(10장 재고 서비스 방식)
- Kafka 트랜잭션(exactly-once, `read_committed`)

Kafka 트랜잭션은 구현하지 않았고, 비교로 돌리지 않았습니다. 받는 쪽 DB 반영까지 묶지 못하기 때문입니다. Spring Kafka 문서의 exactly-once도 "read → process → write" 순서를 말하고, DB는 말하지 않습니다.

주문 서비스는 받은 기록의 `event_id`에 고유 키를 더하고, `insert ignore` 한 문장으로 번호를 남깁니다. 남겨졌을 때만 주문을 바꿉니다.

```java
// order-service/src/main/java/com/example/order/application/order/OrderPaymentService.java
@Transactional
public void apply(PaymentEventCommand command) {
    Instant now = clock.instant();
    // 11장 결정 3: 영구 오류(모르는 상태, 빠진 값)는 기록을 남기기 전에 알린다 — 다시 시도하지 않는다
    PaymentOutcome outcome = PaymentOutcome.from(command.paymentStatus(), command.eventId());
    long eventNumber = command.eventNumber();
    command.requireComplete();
    if (receivedPaymentEventRepository.claim(ReceivedPaymentEvent.of(command.eventId(), command.orderId(),
            command.paymentStatus(), command.occurredAt(), command.partition(), command.offset(), now))) {
        follow(command.orderId(), outcome, eventNumber, now);
    }
}
```

```java
// order-service/src/main/java/com/example/order/infrastructure/persistence/order/ReceivedPaymentEventRepositoryAdapter.java
@Override
public boolean claim(ReceivedPaymentEvent event) {
    return jdbcTemplate.update("insert ignore into received_payment_event "
                    + "(event_id, order_id, payment_status, occurred_at, partition_no, offset_no, received_at) values (?, ?, ?, ?, ?, ?, ?)",
            event.getEventId(), event.getOrderId(), event.getPaymentStatus(), Timestamp.from(event.getOccurredAt()),
            event.getPartitionNo(), event.getOffsetNo(), Timestamp.from(event.getReceivedAt())) == 1;
}
```

같은 트랜잭션이라 주문이 바뀌면 번호도 반드시 남고, 주문이 바뀌지 못하고 롤백되면 번호도 남지 않아 다시 시도할 수 있습니다. 영구 오류인지(모르는 상태, 빠진 값)는 기록을 남기기 전에 봅니다(결정 3). 주석에는 같은 번호를 다른 트랜잭션이 남기는 중이면 그 트랜잭션이 끝날 때까지 기다린 뒤 답한다고 적었는데, 10장과 마찬가지로 MySQL 문서로 확인하지는 않았습니다. 받은 기록은 JPA 엔티티에서 빼고 JDBC로 남깁니다.

![결정 1 OrderPaymentService.apply 코드 순서 — 결제 결과(eventId N)가 들어오면 한 트랜잭션 안에서 1 PaymentOutcome.from·eventNumber·requireComplete로 영구 오류를 확인하고(영구 오류면 기록 전에 멈추고 다시 시도하지 않음), 2 claim이 event_id 고유 키 표에 insert ignore로 번호를 남겨 1줄이면 3 follow로 주문 상태를 바꾸고(마지막 번호 확인은 결정 2) 4 번호와 주문 변경을 함께 커밋함. 같은 결과가 다시 오면 2에서 0줄이라 아무것도 바꾸지 않고 커밋하고, 주문 변경이 실패해 롤백되면 번호 줄도 함께 롤백돼 다시 시도할 수 있음. 받은 기록은 JPA 엔티티에서 빼 JDBC로 남기고, 재고 서비스도 processed_stock_command(command_id 고유)에 남겨 처음 온 번호일 때만 예약을 바꿈. 같은 번호를 남기는 중인 트랜잭션을 기다린다는 주석은 MySQL 문서로 확인하지 않았고, 가리는 이유는 결제 서버가 적어도 한 번 보내고 커밋 전 재기동이면 같은 메시지를 다시 읽기 때문인 그림](images/05_d1-sequence.svg)

재고 서비스도 같은 방식입니다. 처리한 명령 표(`processed_stock_command`, `command_id` 고유)에 먼저 남기고, 처음 온 번호일 때만 예약을 바꿉니다. 10장 예약 상태 전이는 그대로 두고, 그 위에 메시지마다 한 번만 처리하는 규칙을 얹었습니다.

```java
// inventory-service/src/main/java/com/example/inventory/application/command/StockCommandService.java
@Transactional
public void confirm(String commandId, Long reservationId) {
    if (processedStockCommandRepository.claim(ProcessedStockCommand.of(commandId, reservationId, CONFIRM, clock.instant()))) {
        reservationRecorder.confirm(reservationId, Long.parseLong(commandId));
    }
}

@Transactional
public void release(String commandId, Long reservationId) {
    if (processedStockCommandRepository.claim(ProcessedStockCommand.of(commandId, reservationId, RELEASE, clock.instant()))) {
        reservationRecorder.release(reservationId, Long.parseLong(commandId));
    }
}
```

같은 메시지를 가려야 하는 이유는 결제 서버가 적어도 한 번 보내고(9장), 소비자가 처리한 뒤 읽은 자리를 커밋하기 전에 다시 뜨면 같은 메시지를 다시 읽기 때문입니다.

비교 구현 두 개는 각각 1개가 실패했습니다.

```text
## 결제 결과 받기(주문 서비스) — 비교(결정 1): 가리지 않음
FAIL 결제 서버가 같은 결제 결과를 다시 보내도 주문 서비스는 받은 결과를 한 번만 남긴다 (0.552s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 1 but was: 2
## 결제 결과 받기(주문 서비스) — 비교(결정 1): 상태 전이 규칙만으로 흡수
FAIL 결제 서버가 같은 결제 결과를 다시 보내도 주문 서비스는 받은 결과를 한 번만 남긴다 (0.254s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: 1 but was: 2
```

가리지 않음과 상태 전이만은 모두 결제 서버가 다시 보낸 결과를 받은 기록에 2줄 남겼습니다. 상태 전이만은 같은 결과가 다시 오면 같은 상태로는 갈 수 없어 주문을 바꾸지 않지만, 받은 기록은 한 줄 더 남습니다. 다시 읽은 결과로 주문이 다시 바뀌는 것(출발 코드의 `updated_at`)은 두 비교 모두 통과했습니다. 가리지 않음에서는 결정 2가 막았고, 상태 전이만은 결정 2가 없던 결정 1 커밋 때도 같은 상태로는 갈 수 없어 주문이 바뀌지 않았습니다. 결정 1 커밋 때는 가리지 않음이 11개(출발 코드와 같음), 상태 전이만이 10개 실패했습니다.

재고 서비스에서 명령 번호로 가리지 않는 비교(10장 상태 전이만)는 운영과 같이 12개를 모두 통과해 기본 시험에 두었습니다. 같은 확정·해제를 다시 읽는 계약은 결정 1이 있든 없든 10장 상태 전이로 통과했습니다. 재고 서비스에도 같은 규칙을 넣었지만, 이 장의 계약 12개로는 넣기 전후의 차이가 없었습니다.

![결정 1 선택지 비교 — 결제 서버가 같은 결과를 다시 보내면 고유 키 표 + 같은 트랜잭션(이 장에서 고름)은 insert ignore가 0줄이라 받은 기록 1줄이고 계약 12개를 모두 통과함. 가리지 않음(9·10장 주문 서비스)과 상태 전이 규칙만(10장 재고 서비스 방식)은 받은 기록 2줄(기대 1)로 1개씩 실패하고, 다시 읽은 결과로 주문이 다시 바뀌지 않는 것은 운영은 insert ignore 0줄, 가리지 않음은 결정 2, 상태 전이만은 결정 1 커밋 때도 같은 상태로는 갈 수 없어 막혀 세 방식 모두 통과함(결정 2가 없던 결정 1 커밋 때는 가리지 않음 11개, 상태 전이만 10개 실패). Kafka 트랜잭션(read_committed)은 받는 쪽 DB 반영까지 묶지 못해 비교로 돌리지 않았고, 문서의 exactly-once도 read → process → write를 말함. 재고 서비스는 명령 번호로 가리지 않는 비교도 12개 모두 통과해, 같은 규칙을 넣었지만 넣기 전후의 차이가 없었던 그림](images/06_d1-options.svg)

이 선택으로 치르는 비용은 두 가지입니다.

- 받는 쪽마다 번호를 남기는 표가 있고, 메시지마다 한 줄이 쌓입니다. 지우는 코드는 없습니다.
- 9장·10장 표를 이미 쓰고 있는 DB에는 `create table if not exists`가 새 칸과 키를 더하지 않습니다. 옮길 때는 `orders.last_event_id`·`stock_reservation.last_command_id` 칸을 더하고, `received_payment_event`의 같은 번호 줄을 지운 뒤 고유 키를 더해야 하며, 옮기는 스크립트는 만들지 않았습니다.

다른 선택이 맞는 경우도 있습니다. 받은 기록이 몇 줄 남는지는 상관없고 상태 전이로 같은 결과가 되는 업무라면, 결정 2와 함께 둔 상태 전이 규칙만으로도 이 장의 다른 계약은 모두 통과했습니다.

### 결정 2. 늦게 온 옛 메시지를 어떻게 거를까

이 장에서는 주문(재고 서비스는 예약)마다 마지막으로 반영한 `payment_outbox` 번호를 남기고, 그보다 번호가 크지 않은 메시지는 반영하지 않기로 했습니다.

검토한 선택지는 세 가지입니다.

- 마지막으로 반영한 번호와 비교
- 만든 시각(`occurredAt`)으로 비교
- 거르지 않음(9장 방식, 마지막으로 받은 결과가 상태를 정함)

계획에서는 "더 작은 번호"를 반영하지 않기로 했는데, 구현은 같은 번호도 반영하지 않습니다. 같은 번호는 같은 메시지라 결정 1이 먼저 거릅니다.

주문 서비스는 `orders.last_event_id`에 마지막으로 반영한 번호를 쥐고, 처음 온 이벤트라도 그보다 크지 않으면 주문을 바꾸지 않습니다. 받은 기록에는 남겨, 다시 와도 다시 보지 않습니다.

```java
// order-service/src/main/java/com/example/order/domain/order/Order.java
// 11장 결정 2: 마지막으로 반영한 이벤트보다 뒤에 만든 이벤트인가(번호가 더 큰가)
public boolean isAfterLastApplied(long eventId) {
    return eventId > lastEventId;
}

// 받은 결제 결과대로 주문 상태를 바꾸고 그 이벤트의 번호를 마지막으로 반영한 번호로 남긴다.
// 옛 이벤트인지(isAfterLastApplied)는 부르는 쪽이 먼저 본다
public void follow(PaymentOutcome outcome, long eventId, Instant now) {
    this.paymentStatus = outcome;
    this.status = outcome.getOrderStatus();
    this.lastEventId = eventId;
    this.updatedAt = now;
}
```

```java
// order-service/src/main/java/com/example/order/application/order/OrderPaymentService.java
private void follow(String orderId, PaymentOutcome outcome, long eventId, Instant now) {
    orderRepository.findByOrderIdForUpdate(orderId)
            .ifPresentOrElse(order -> followIfNewer(order, outcome, eventId, now),
                    () -> orderRepository.save(Order.paidWith(orderId, outcome, eventId, now)));
}

private static void followIfNewer(Order order, PaymentOutcome outcome, long eventId, Instant now) {
    if (order.isAfterLastApplied(eventId)) {
        order.follow(outcome, eventId, now);
    }
}
```

주문 줄은 `select … for update`로 잠그고 읽습니다. 소비자 재배치로 같은 주문의 이벤트가 겹쳐 처리돼도 번호 비교가 어긋나지 않게 하기 위해서입니다.

재고 서비스는 `stock_reservation.last_command_id`를 쥡니다. HTTP로 잡은 예약에는 아직 번호가 없어, 비어 있으면 어느 명령이든 새 명령으로 봅니다.

```java
// inventory-service/src/main/java/com/example/inventory/domain/reservation/StockReservation.java
// 11장 결정 2: 마지막으로 반영한 명령보다 뒤에 만든 명령인가(번호가 더 큰가). 아직 명령을 반영하지 않은 예약이면 어느 명령이든 새 명령이다
public boolean isAfterLastCommand(long commandId) {
    return Objects.isNull(lastCommandId) || commandId > lastCommandId;
}
```

```java
// inventory-service/src/main/java/com/example/inventory/application/reservation/ReservationRecorder.java
// 잡아 둔 예약을 확정한다. 이미 확정·해제됐거나 없는 예약이면 아무것도 바꾸지 않는다.
// 11장 결정 2: 이 예약에 마지막으로 반영한 명령보다 먼저 만든 명령(commandId 가 더 작음)이면 아무것도 바꾸지 않는다
@Transactional
public void confirm(Long reservationId, long commandId) {
    Instant now = clock.instant();
    stockReservationRepository.findForUpdate(reservationId)
            .filter(reservation -> reservation.isAfterLastCommand(commandId))
            .filter(reservation -> reservation.confirm(commandId, now))
            .ifPresent(stockReservationRepository::updateStatus);
}
```

번호로 비교할 수 있는 근거는 보내는 쪽 구조입니다. `payment_outbox.id`는 auto_increment이고, 같은 결제의 결과와 재고 명령은 결제 줄을 `select … for update`로 잠근 기록(7장 [결제 동시성 제어](../payment-concurrency/) 결정 1, `PaymentRecorder`·`PaymentCancelRecorder`·`PaymentWebhookRecorder`의 `findByOrderIdForUpdate`) 안에서 남깁니다. 그래서 뒤 트랜잭션의 insert는 앞 트랜잭션이 커밋한 뒤에 일어나 번호가 더 큽니다. 서버 두 대도 같은 DB의 같은 번호를 씁니다. 다만 auto_increment가 같은 결제 안에서 커밋 순서대로 커진다는 것은 이 잠금 구조에서 끌어낸 가정이고, MySQL 문서로 따로 확인하지 않았습니다.

![결정 2 번호로 비교할 수 있는 근거와 가정 — 같은 결제의 기록을 서버 A와 B가 남길 때 둘 다 findByOrderIdForUpdate로 결제 줄을 잠그므로, 서버 A가 상태를 바꾸고 publishIfChanged로 payment_outbox id N을 남겨 커밋한 뒤에야 잠금을 기다리던 서버 B가 상태를 바꾸고 id N+k(N보다 큼)를 남김. 서버 두 대도 같은 DB의 같은 번호를 쓰지만, auto_increment가 같은 결제 안에서 커밋 순서대로 커진다는 것은 잠금 구조에서 끌어낸 가정이고 MySQL 문서로 확인하지 않음. 받는 쪽 주문 서비스는 orders.last_event_id가 N이면 N+k는 반영하고 N 이하는 바꾸지 않으며(isAfterLastApplied, 주문 줄 select for update, 받은 기록에는 남김), 재고 서비스는 last_command_id가 비어 있으면(HTTP로 잡은 예약) 어느 명령이든 새 명령으로 보고 그 밖에는 번호가 클 때만 반영함. 계획은 더 작은 번호였고 구현은 같은 번호도 반영하지 않으며(같은 번호는 결정 1이 먼저 거름), eventId와 commandId 모두 payment_outbox.id인 그림](images/07_d2-number-basis.svg)

옛 메시지를 걸러야 하는 이유는 다시 넣은 메시지나 늦게 온 옛 메시지가 새 결과 뒤에 와도 상태가 되돌아가지 않게 하기 위해서입니다. 만든 시각으로 비교하지 않은 이유는 결제 서버가 여러 대면(7장) 서버마다 시계가 달라 시각이 만든 순서와 어긋날 수 있기 때문이고, 아래 실행에서 그대로 나타났습니다.

```text
## 결제 결과 받기(주문 서비스) — 비교(결정 2): 옛 결과를 거르지 않음
FAIL 취소 뒤에 그보다 먼저 만든 승인이 늦게 와도 주문은 취소 상태로 남는다 (0.174s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: "CANCELED" but was: "PAID"
FAIL 실패 모음에서 다시 넣은 결과는 그사이 더 새 결과가 반영됐으면 무시된다 (16.6s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: "CANCELED" but was: "PAID"
## 결제 결과 받기(주문 서비스) — 비교(결정 2): 만든 시각으로 비교
FAIL 결제 서버 시계가 서로 달라 새 결과의 만든 시각이 앞선 결과보다 이르게 찍혀도 새 결과가 반영된다 (0.159s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: expected: "CANCELED" but was: "PAID"
```

거르지 않음은 2개가 실패했습니다. 취소 뒤 늦게 온 옛 승인과, 실패 모음에서 다시 넣은 옛 승인이 더 새 취소 뒤에 반영돼 주문이 결제 완료로 돌아갔습니다. 만든 시각으로 비교하면 옛 승인은 막았지만 1개가 실패했습니다. 승인을 남긴 서버보다 시계가 0.3초 늦은 서버가 0.2초 뒤에 남긴 취소를 옛 결과로 보고 무시해, 주문이 결제 완료로 남았습니다. 이 계약은 7장의 서버 두 대 구성에서 가져온 상황입니다.

재고 명령에는 만든 시각이 실리지 않아 재고 쪽 시각 비교는 만들지 않았습니다. 옛 명령을 거르지 않는 비교(10장 상태 전이만)는 운영과 같이 12개를 모두 통과해 기본 시험에 두었습니다. 해제 뒤 늦게 온 옛 확정은 10장 상태 전이(해제는 끝)로 막혔습니다. 결정 1과 마찬가지로, 재고 서비스의 결정 2도 이 장의 계약 12개로는 넣기 전후의 차이가 없었습니다.

![결정 2 선택지 비교 — 주문 서비스에서 취소(번호 큼, 0.2초 뒤)가 먼저 반영된 뒤 옛 승인이 늦게 오면 번호 비교(이 장에서 고름)와 만든 시각 비교는 승인을 무시해 취소를 유지하고, 거르지 않음은 PAID로 되돌아감. 시계가 0.3초 늦은 서버 B가 0.2초 뒤 남긴 취소(찍힌 시각 t−0.1초)는 번호 비교와 거르지 않음이 반영하고 만든 시각 비교는 옛 결과로 무시해 PAID로 남음. 실패 모음에서 다시 넣은 옛 승인이 더 새 취소 뒤에 오면 번호와 시각 비교는 무시하고 거르지 않음은 PAID로 되돌아감. 11장 계약 실패는 0개, 1개(시계 계약), 2개(늦은·다시 넣은 옛 승인)이고, 재고 서비스는 명령에 만든 시각이 없어 시각 비교를 만들지 않았으며 옛 명령을 거르지 않는 비교도 12개 모두 통과해 넣기 전후의 차이가 없었던 그림](images/08_d2-options.svg)

이 선택으로 치르는 비용은 세 가지입니다.

- 받는 쪽이 결제 서버 `payment_outbox` 번호의 순서에 기댑니다. 그 순서가 커밋 순서라는 것은 위의 가정입니다.
- 같은 주문의 이벤트마다 주문 줄을 잠그고 읽습니다.
- 번호가 숫자가 아닌 메시지는 영구 오류로 봅니다(결정 3). 9장 비교 두 개는 이 때문에 실패가 늘었습니다(테스트 결과에서 다룹니다).

다른 선택이 맞는 경우도 있습니다. 보내는 쪽 번호를 메시지에 실을 수 없고 메시지를 만드는 서버의 시계가 맞는다고 볼 수 있다면, 만든 시각으로 비교하는 쪽도 이 장에서 놓친 계약은 시계 계약 하나였습니다.

### 결정 3. 처리에 실패한 메시지를 언제 다시 시도할까

이 장에서는 일시 오류는 같은 자리에서 간격을 늘려 가며 다시 시도해 같은 키의 순서를 지키고(blocking), 영구 오류는 다시 시도하지 않기로 했습니다.

검토한 선택지는 세 가지입니다.

- 같은 자리에서 간격을 늘려 다시 시도(blocking, 1·2·4·8초)
- Spring Kafka 기본 처리(간격 없이 10번, 로그)
- 다시 시도 토픽(non-blocking): 실패한 메시지를 다시 시도 토픽(`<토픽>-retry-…`)으로 넘기고, 원래 토픽의 뒤 메시지는 이어서 처리

두 서비스 모두 `DefaultErrorHandler` 빈에 `ExponentialBackOffWithMaxRetries`를 두고, 다시 시도해도 결과가 같은 예외는 다시 시도하지 않게 등록했습니다. 실패 모음에 싣는 부분(`DeadLetterPublishingRecoverer`)은 결정 4에서 다룹니다.

```java
// order-service/src/main/java/com/example/order/infrastructure/kafka/KafkaConsumerConfig.java
@Bean
DefaultErrorHandler paymentEventErrorHandler(RetryProperties retryProperties, DeadLetterProperties deadLetterProperties,
                                             KafkaTemplate<String, String> kafkaTemplate) {
    DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate,
            (record, failure) -> new TopicPartition(deadLetterProperties.getTopic(), record.partition()));
    DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff(retryProperties));
    handler.addNotRetryableExceptions(JacksonException.class, UnknownPaymentStatusException.class,
            InvalidPaymentEventException.class);
    return handler;
}
```

영구 오류로 보는 것은 아래와 같고, 그 밖의 오류(DB가 쓰기를 거부함 등)는 일시 오류로 봅니다.

- 주문 서비스: Jackson 읽기 실패, 모르는 결제 상태(`UnknownPaymentStatusException`), 고유 번호·주문번호·만든 때가 빠지거나 번호가 숫자가 아닌 이벤트(`InvalidPaymentEventException`)
- 재고 서비스: Jackson 읽기 실패, 모르는 명령(`UnknownStockCommandException`), 명령 번호·예약 번호가 빠지거나 번호가 숫자가 아닌 명령(`InvalidStockCommandException`)

재고 서비스는 10장까지 확정이 아니면 모두 해제로 처리했는데, 이제 해제(`RELEASE`)만 해제하고 그 밖의 명령은 예약을 바꾸지 않고 영구 오류로 알립니다.

```java
// inventory-service/src/main/java/com/example/inventory/presentation/command/StockCommandListener.java
@KafkaListener(topics = "${inventory.stock-commands.topic}")
public void receive(ConsumerRecord<String, String> record) {
    StockCommandMessage command = jsonMapper.readValue(record.value(), StockCommandMessage.class);
    command.requireComplete();
    if (command.isConfirm()) {
        stockCommandService.confirm(command.commandId(), command.reservationId());
        return;
    }
    if (command.isRelease()) {
        stockCommandService.release(command.commandId(), command.reservationId());
        return;
    }
    throw new UnknownStockCommandException(command.commandId());
}
```

다시 시도 값은 아래와 같습니다.

```properties
# order-service/src/main/resources/order-service.properties
# 11장 결정 3: 일시 오류(DB 가 쓰기를 거부함 등)는 같은 자리에서 1·2·4·8초 뒤에 다시 시도한다(4번, 기다림 합 15초).
# 근거: 이 머신에서 MySQL 8.4 컨테이너를 다시 띄워 쿼리를 받기까지 2.6~3.0초(5번, docs/ch11/04) — 15초는 그 5배다(5배 여유는 가정).
# 한 번 기다리는 가장 긴 시간(8초)은 소비자가 그룹에서 빠지는 max.poll.interval.ms(기본 5분)보다 훨씬 짧다.
# 비용: 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 이벤트가 기다린다(docs/ch11/04 의 막는 시간)
order.retry.initial-interval=1s
order.retry.multiplier=2
order.retry.max-interval=8s
order.retry.max-retries=4
```

1·2·4·8초는 이 머신에서 MySQL 8.4 컨테이너를 다시 띄워 쿼리를 받기까지 걸린 시간을 근거로 했습니다. `docker restart` 뒤 `docker exec … mysql -e 'select 1'`이 성공할 때까지 0.1초마다 봤고, 5번 잰 값이 2.62~3.04초였습니다. 시험 밖에서 잰 값이고 `docker exec` 시간이 들어 있습니다.

```text
# 다. 다시 시도 값(1·2·4·8초)의 근거로 잰 MySQL 8.4 재시작 시간(시험 밖, 2026-11-21). mysql:8.4 컨테이너 하나를 띄운 뒤 `docker restart -t 10` 하고,
#     `docker exec … mysql -uroot -e 'select 1'` 이 성공할 때까지 0.1초마다 본 시간(docker exec 의 시간이 들어 있다). 5번.
restart #1: 3.04s
restart #2: 2.69s
restart #3: 2.62s
restart #4: 2.62s
restart #5: 2.63s
```

잰 것은 이 머신의 컨테이너 재시작 시간뿐입니다. 기다림 합 15초는 그 약 5배이고, 5배라는 여유는 가정입니다. 운영 DB 전환 시간의 기준은 따로 없습니다. 한 번 기다리는 가장 긴 시간(8초)은 `max.poll.interval.ms` 기본값(5분)보다 짧습니다.

![결정 3 다시 시도 값의 근거 — 시험 밖에서 MySQL 8.4 컨테이너를 docker restart 한 뒤 select 1이 성공할 때까지 잰 시간은 5번 2.62~3.04초(docker exec 시간 포함)이고, 운영 다시 시도는 같은 자리에서 1·2·4·8초(누적 1·3·7·15초, 기다림 합 15초)임. 15초는 잰 값의 약 5배이고 5배 여유는 가정이며, 계약에서만 2·4·4·4초(합 14초)를 씀. 한 번 기다리는 가장 긴 8초는 max.poll.interval.ms 기본값 5분보다 짧음. 잰 것은 이 머신의 재시작 시간뿐이고 운영 DB 전환 시간의 기준은 없으며, 비용은 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 메시지가 기다리는 것인 그림](images/09_d3-retry-value.svg)

같은 자리에서 다시 시도하는 이유는 같은 결제의 결과가 보낸 순서대로 반영돼야 하기 때문입니다(9장의 키 = 결제 번호). 영구 오류를 다시 시도하지 않는 이유는 영구 오류가 같은 파티션의 뒤 메시지를 다시 시도 시간만큼 붙잡지 않게 하기 위해서입니다.

Spring Kafka 기본 처리는 주문 서비스 8개, 재고 서비스 7개가 실패했습니다. 6초 장애에 메시지를 잃었고 모르는 상태 뒤의 결과가 4.6초 뒤에 반영됐으며 실패 모음이 없습니다. 재고 서비스의 "확정을 다시 시도하는 동안 해제" 계약은 통과했는데, 확정은 잃었지만 해제가 재고를 돌려줬기 때문입니다.

다시 시도 토픽은 주문 서비스 2개, 재고 서비스 1개가 실패했습니다.

```text
## 결제 결과 받기(주문 서비스) — 비교(결정 3): 다시 시도 토픽(non-blocking)
FAIL 다시 시도를 다 쓴 결과는 실패 모음에 그 원인과 함께 남는다 (15.4s) | java.lang.AssertionError: java.lang.AssertionError: Expecting not blank but was: ""
FAIL 같은 주문의 결과는 앞 결과를 다시 시도하는 동안에도 보낸 순서대로 받는다 (6.27s) | org.opentest4j.AssertionFailedError: org.opentest4j.AssertionFailedError: Expecting actual: ["APPROVAL_CANCELED", "APPROVED"] to contain exactly (and in same order): ["APPROVED", "APPROVAL_CANCELED"] but there were differences at these indexes: - element at index 0: expected "APPROVED" but was "APPR
## 재고 명령 받기(재고 서비스) — 비교(결정 3): 다시 시도 토픽(non-blocking)
FAIL 다시 시도를 다 쓴 명령은 실패 모음에 그 원인과 함께 남는다 (15.5s) | java.lang.AssertionError: java.lang.AssertionError: Expecting not blank but was: ""
```

같은 주문의 결과가 `[APPROVAL_CANCELED, APPROVED]` 순서로 받아졌습니다. 승인을 다시 시도하는 동안 뒤에 보낸 취소가 먼저 반영됐고, 늦게 온 승인은 결정 2가 걸러 주문은 취소로 끝났습니다. 문서에도 "By using this strategy you lose Kafka's ordering guarantees for that topic."이라고 적혀 있습니다. 재고 서비스의 순서 계약은 예약 상태 전이로 결과가 같아 통과했습니다. 두 서비스 모두 다시 시도를 다 쓴 메시지는 `<토픽>.DLT`에 갔지만, 이 시험이 읽는 원인 머리(헤더, `kafka_dlt-exception-*`)가 비어 있었습니다. 머리 이름이 다른지, 실리지 않는지는 더 보지 않았습니다. 다시 시도 토픽은 `RetryTopicSchedulerWrapper` 빈이 없으면 뜨지 않았습니다(실행으로 봄).

![결정 3 선택지 비교 — 같은 파티션에 같은 주문의 승인과 취소를 보내고 승인이 일시 오류일 때, 같은 자리에서 간격을 늘려 다시 시도하는 운영(blocking)은 취소가 뒤에서 기다려, 계약(다시 시도 2·4·4·4초, 6초 장애)에서는 장애가 끝난 뒤 다시 시도에서 승인이 반영되고 취소가 이어 받은 순서대로 반영됨. 측정(운영 값 1·2·4·8초로 계속 실패시켜 15초를 다 쓰고 실패 모음으로 감)에서 일시 오류가 뒤 결과를 막은 시간은 첫 실행 15813~15933ms·두 번째 15736~15759ms이고, 영구 오류는 바로 실패 모음으로 58~70ms·42~46ms임. Spring Kafka 기본 처리는 처음 1번에 간격 없이 9번 더(모두 10번, 약 4.6초) 읽은 뒤 ERROR 로그로 넘어가 6초 장애에 승인을 잃고 실패 모음이 없으며, 막는 시간은 일시 4630~4650ms·4572~4599ms, 영구 4612~4618ms·4572~4605ms임. 다시 시도 토픽(non-blocking)은 승인을 다시 시도 토픽으로 넘겨 취소가 먼저 반영되고 늦게 온 승인은 결정 2가 걸러 받은 순서가 APPROVAL_CANCELED, APPROVED로 바뀌며, 막는 시간은 일시 45~48ms·41~50ms, 영구 49~57ms·46~51ms이고 다 쓴 메시지의 원인 머리가 비어 있음. 11장 계약 실패는 운영 0·0, 기본 처리 주문 8·재고 7, 다시 시도 토픽 주문 2·재고 1인 그림](images/10_d3-options.svg)

이 선택으로 치르는 비용은 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 메시지가 기다린다는 것입니다. 측정(주문 서비스, 운영 값 1·2·4·8초, 한 결제를 트리거로 계속 실패시킨 뒤 같은 파티션에 다른 결제 결과를 실음, 방식마다 3번씩 두 번 실행)에서 일시 오류 메시지 하나가 같은 파티션의 뒤 결과를 첫 실행 15813\~15933ms, 두 번째 실행 15736\~15759ms 막았습니다. 다시 시도 토픽은 같은 경우 41\~50ms였고, 기본 처리는 4572\~4650ms였습니다.

다른 선택이 맞는 경우도 있습니다. 같은 키의 순서가 결과를 바꾸지 않는 업무라면 다시 시도 토픽은 뒤 메시지를 막지 않았습니다. 다만 측정의 30초 읽기 전용 장애(0.5초마다 60건)에서는 메시지마다 따로 15초를 다 써, 실패 모음으로 간 수가 28~30건으로 운영(2건)보다 많았습니다.

### 결정 4. 다시 시도를 다 쓴 메시지를 어디에 모을까

이 장에서는 다시 시도를 다 쓴 메시지와 영구 오류 메시지를 `<토픽>.DLT`에 원인 머리와 함께 모으고, 운영자가 원래 토픽으로 다시 넣는 명령을 두기로 했습니다.

검토한 선택지는 세 가지입니다.

- 실패 모음 토픽(`<토픽>.DLT`)과 다시 넣기 명령
- 로그만 남김(결정 3까지의 운영)
- 받는 쪽 자기 DB의 실패 표(`failed_message`)

결정 3의 처리기에 `DeadLetterPublishingRecoverer`를 붙여, 실패 모음 토픽의 같은 번호 파티션에 원래 키·본문 그대로 싣습니다. Spring Kafka가 원인(예외 종류·문장·스택)과 원래 자리(토픽·파티션·위치·시각)를 머리(`kafka_dlt-*`)에 붙입니다. 실패 모음에 실린 뒤에야 그 자리를 넘어가고, 싣지 못하면 넘어가지 않고 다시 시도합니다. 실패 모음 토픽은 서비스가 뜰 때 만들고(파티션 2), 원래 메시지와 같은 번호 파티션에 싣기 때문에 파티션 수가 원래 토픽과 같아야 합니다.

```java
// order-service/src/main/java/com/example/order/infrastructure/kafka/KafkaConsumerConfig.java
// 11장 결정 4: 서비스가 뜰 때 실패 모음 토픽이 없으면 만든다(있으면 그대로 둔다). 단일 브로커라 복제본은 하나다
@Bean
NewTopic paymentEventDeadLetterTopic(DeadLetterProperties deadLetterProperties) {
    return TopicBuilder.name(deadLetterProperties.getTopic())
            .partitions(deadLetterProperties.getPartitions())
            .replicas(1)
            .build();
}
```

`DeadLetterPublishingRecoverer`의 기본 토픽 이름(`.DLT`인지 `-dlt`인지)과 머리 목록은 문서를 끝까지 읽지 못해 확인하지 못했습니다. 그래서 운영 코드는 기본값에 기대지 않고 토픽과 파티션을 직접 정합니다. 원인 머리가 실리는 것은 계약 실행으로 봤습니다.

다시 넣기는 같은 서비스를 다시 넣기 모드로 한 번 띄우는 명령입니다.

```java
// order-service/src/main/java/com/example/order/presentation/command/DeadLetterReplayCommand.java

/**
 * 11장 결정 4: 운영자가 실패 모음을 원래 토픽으로 다시 넣는 명령. 주문 서비스를 다시 넣기 모드로 한 번 띄우면 다시 넣고 끝난다 —
 * java -jar order-service.jar --spring.config.name=order-service --order.dead-letter.replay=true --spring.kafka.listener.auto-startup=false
 * (리스너를 띄우지 않아 이 프로세스는 결제 이벤트를 읽지 않는다. 다시 넣은 이벤트는 떠 있는 주문 서비스가 읽는다)
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "order.dead-letter.replay", havingValue = "true")
public class DeadLetterReplayCommand implements ApplicationRunner {

    private final DeadLetterReplayer deadLetterReplayer;

    @Override
    public void run(ApplicationArguments arguments) {
        int replayed = deadLetterReplayer.replayAll();
        log.info("Replayed {} dead letter payment events to the original topic.", replayed);
    }
}
```

```java
// order-service/src/main/java/com/example/order/infrastructure/kafka/KafkaDeadLetterReplayer.java
// 명령을 시작한 뒤에 들어온 이벤트는 다음 명령으로 넘긴다(커밋하지 않는다)
private int replayIfBefore(Consumer<String, String> consumer, ConsumerRecord<String, String> record,
                           Map<TopicPartition, Long> ends) {
    TopicPartition partition = new TopicPartition(record.topic(), record.partition());
    if (record.offset() >= ends.get(partition)) {
        return 0;
    }
    kafkaTemplate.send(new ProducerRecord<>(deadLetterProperties.getSourceTopic(), record.partition(), record.key(),
            record.value())).join();
    Map<TopicPartition, OffsetAndMetadata> done = new HashMap<>();
    done.put(partition, new OffsetAndMetadata(record.offset() + 1));
    consumer.commitSync(done);
    return 1;
}
```

리스너를 띄우지 않아 이 프로세스는 메시지를 읽지 않고, 다시 넣은 메시지는 떠 있는 서비스가 읽습니다. 명령을 시작한 때의 실패 모음 토픽 끝까지를 원래 토픽의 같은 파티션에 같은 키·본문으로 싣고, 브로커가 받았다고 답한 뒤 한 건마다 다시 넣기 그룹(`<소비자 그룹>-dlt-replay`)에 커밋합니다. 도중에 멈추면 다음 명령이 커밋한 자리부터 다시 넣고, 다시 넣은 메시지가 두 번 가도 받는 쪽 결정 1이 한 번만 반영합니다. 재고 서비스는 `--spring.main.web-application-type=none`을 더해 웹도 끕니다.

명령이 끝나면 프로세스가 스스로 끝나는지는 시험 밖에서 확인했습니다. bootJar를 따로 띄운 MySQL 8.4·Kafka 4.2.0 컨테이너에 붙여 실제 JVM으로 돌렸고, 실패 모음에 메시지를 1건씩 둔 뒤 주문 서비스는 "Replayed 1 …" 로그 뒤 종료 코드 0으로 6초에, 재고 서비스는 3초에 끝났습니다. 주문 서비스를 한 번 더 돌리면 "Replayed 0 …" 뒤 종료 코드 0으로 끝났습니다. 다시 넣기 그룹이 넘긴 자리를 기억하기 때문입니다. 끝나게 하는 코드는 따로 필요 없었습니다.

이 확인에서 두 서비스는 `--spring.config.name=order-service`(재고는 `inventory-service`)를 함께 줘야 설정 파일을 읽는다는 것도 봤습니다. 주지 않으면 DB 계정이 비어 뜨지 못했습니다(종료 코드 1). 주문 서비스(9장)와 재고 서비스(10장)를 따로 띄울 때 늘 필요한 인자인데, 처음에는 명령 예와 주석에 빠져 있어 더했습니다.

![결정 4 다시 넣기 순서 — 운영자가 java -jar order-service.jar에 --spring.config.name=order-service, --order.dead-letter.replay=true, --spring.kafka.listener.auto-startup=false를 주어 같은 서비스를 리스너 없이 다시 넣기 모드로 띄우면 DeadLetterReplayCommand.run이 KafkaDeadLetterReplayer.replayAll을 불러 partitionsFor·assign·endOffsets로 명령을 시작한 때의 실패 모음 끝을 잡고, replayUntil·poll로 읽은 메시지를 replayIfBefore가 원래 토픽 payment-events의 같은 파티션에 같은 키·본문으로 send(…).join()한 뒤 한 건마다 다시 넣기 그룹에 commitSync함. Replayed 1 로그 뒤 종료 코드 0으로 주문 6초·재고 3초에 끝나고, 다시 넣은 메시지는 떠 있는 주문 서비스가 읽어 아직 반영 전이면 반영하고 더 새 취소 뒤면 결정 2가 거름. 다시 돌리면 Replayed 0 뒤 종료 코드 0, 도중에 멈추면 커밋한 자리부터 다시 넣고 두 번 가도 결정 1이 한 번만 반영하며, --spring.config.name이 없으면 DB 계정이 비어 종료 코드 1, 재고 서비스는 웹도 끄는 그림](images/11_d4-replay-sequence.svg)

실패 모음을 두는 이유는 결정 3까지는 다시 시도를 다 쓰거나 영구 오류면 로그만 남고 메시지가 사라졌기 때문입니다.

다시 넣은 메시지는 처음 온 메시지와 같은 규칙(결정 1·2)으로 처리됩니다. 계약에서 아직 반영되지 않은 결과·명령은 다시 넣으면 반영됐고, 그사이 더 새 결과(취소)·명령(해제)이 반영됐으면 무시됐습니다. 주문 서비스에서 이 무시를 만든 것은 결정 2이고, 거르지 않는 비교는 다시 넣은 옛 승인에 결제 완료로 되돌아갔습니다. 재고 서비스는 결정 2를 뺀 비교에서도 이 계약을 통과했습니다.

로그만은 두 서비스 모두 5개가 실패했습니다. 실패 모음 계약 3개와 다시 넣기 2개입니다. DB 실패 표는 두 서비스 모두 3개가 실패했습니다.

```text
## 결제 결과 받기(주문 서비스) — 비교(결정 4): 다시 시도를 다 쓰면 받는 쪽 저장소의 실패 표에 남김
FAIL 실패 모음에서 다시 넣은 결과는 아직 반영되지 않았으면 반영된다 (30.1s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 다시 시도를 다 쓴 결과는 실패 모음에 그 원인과 함께 남는다 (30.2s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
FAIL 실패 모음에서 다시 넣은 결과는 그사이 더 새 결과가 반영됐으면 무시된다 (30.1s) | org.awaitility.core.ConditionTimeoutException: org.awaitility.core.ConditionTimeoutException: Lambda expression in com.example.payment.application.payment.PaymentEventConsumerContract expected the predicate to return <true> but it returned <false> for input of <Optional.empty> within 30 seconds.
```

영구 오류는 실패 표에 남았지만, 저장소가 쓰기를 거부하는 동안 다시 시도를 다 쓴 메시지는 실패 표에도 남지 못했습니다. 그때 Spring Kafka는 그 자리를 넘어가지 않고 계속 다시 시도해, 30초 안에 실패 표에 나타나지 않았습니다. 다시 넣기 두 계약도 같은 이유로 실패했습니다.

![결정 4 선택지 비교 — 모르는 상태나 읽을 수 없는 본문 같은 영구 오류는 실패 모음 토픽(.DLT) + 다시 넣기(이 장에서 고름)가 다시 시도 없이 원인 머리 kafka_dlt와 함께 실패 모음에 남기고, 로그만은 ERROR 로그만 남겨 메시지가 사라지며, DB 실패 표는 failed_message에 남김. 저장소 장애로 다시 시도를 다 쓴 메시지는 운영이 실패 모음에 실은 뒤 넘어가 다시 넣으면 결정 1·2대로 처리되고, 로그만은 사라지며, DB 실패 표는 저장소가 막혀 실패 표에도 못 남겨 그 자리를 넘어가지 않고 계속 다시 시도함. 11장 계약 실패는 0개, 5개(실패 모음 3·다시 넣기 2), 3개(다 쓴 결과·다시 넣기 2)이고, 30초 장애 측정은 잃음 0·실패 모음 2, 잃음 2, 반영 60·실패 표 0(저장소가 돌아온 뒤 반영)임. 운영의 비용은 운영자가 다시 넣기 명령을 돌려야 하고 받는 쪽 토픽마다 실패 모음 토픽이 늘어 파티션 수를 원래 토픽과 맞춰야 하는 것인 그림](images/12_d4-options.svg)

이 선택으로 치르는 비용은 두 가지입니다.

- 실패 모음에 간 메시지는 운영자가 명령을 돌려야 원래 토픽으로 돌아갑니다. 측정의 30초 읽기 전용 장애(0.5초마다 60건, 파티션 2개)에서는 파티션마다 맨 앞 메시지 1건씩, 2건이 실패 모음에 남았습니다.
- 받는 쪽 토픽마다 실패 모음 토픽이 하나씩 늘고, 파티션 수를 원래 토픽과 맞춰야 합니다.

다른 선택이 맞는 경우도 있습니다. 모아야 할 것이 모르는 상태 같은 영구 오류뿐이고 받는 쪽 저장소 장애로 다시 시도를 다 쓰는 일은 없다고 볼 수 있다면, DB 실패 표도 이 장에서 영구 오류는 남겼습니다.

## 구현

결정을 모아 바꾼 11장 완성 코드에서, 결제 결과 하나가 받는 쪽을 지나는 메서드 순서는 아래와 같습니다.

1. 보내기(9장 그대로): 결제 줄을 잠근 기록 트랜잭션에서 `payment_outbox`에 줄을 남김(번호 auto_increment) → `PaymentOutboxRelay.relay` → `KafkaPaymentEventSender.send`(토픽 `payment-events`, 키 = 결제 번호) → `markSent`
2. 받기: `PaymentEventListener.receive`(파티션마다 소비자 하나) → `JsonMapper.readValue`(읽지 못하면 영구 오류) → `OrderPaymentService.apply`(트랜잭션 시작)
3. 영구 오류 확인: `PaymentOutcome.from`(모르는 상태) → `PaymentEventCommand.eventNumber`(숫자가 아닌 번호) → `requireComplete`(빠진 값)
4. 결정 1: `ReceivedPaymentEventRepository.claim`(`insert ignore`) → 이미 있으면 아무것도 바꾸지 않고 커밋
5. 결정 2: `follow` → `findByOrderIdForUpdate`(주문 줄 잠금) → 주문이 없으면 `Order.paidWith`, 있으면 `isAfterLastApplied` → `Order.follow`(상태와 `last_event_id`) → 커밋 → 컨테이너가 읽은 자리를 커밋
6. 실패하면(결정 3): `DefaultErrorHandler` → 영구 오류면 바로 7로, 일시 오류면 같은 자리로 되돌아가 1·2·4·8초 뒤 2부터 다시
7. 결정 4: `DeadLetterPublishingRecoverer` → `payment-events.DLT`의 같은 번호 파티션에 원래 키·본문과 `kafka_dlt-*` 머리 → 그 자리를 넘어감
8. 다시 넣기(운영자): 다시 넣기 모드로 띄움 → `DeadLetterReplayCommand.run` → `KafkaDeadLetterReplayer.replayAll` → `endOffsets` → `replayUntil` → `replayIfBefore` → 원래 토픽 같은 파티션에 `send(...).join()` → `commitSync` → 떠 있는 주문 서비스가 2부터 같은 규칙으로 처리

![11장 완성 코드에서 결제 결과 하나가 받는 쪽을 지나는 순서 — 1 결제 서버가 결제 줄을 잠근 기록 트랜잭션에서 payment_outbox에 번호 붙은 줄을 남겨 커밋하고 릴레이가 relay·send로 결제 번호를 키로 payment-events에 보낸 뒤 markSent함. 2 주문 서비스 소비자가 receive·readValue로 읽고 apply 트랜잭션을 시작해 3 from·eventNumber·requireComplete로 영구 오류를 확인하고, 4 claim이 insert ignore로 번호를 남겨 0줄이면 그대로 커밋하며, 5 findByOrderIdForUpdate·isAfterLastApplied 뒤 Order.follow로 상태와 last_event_id를 바꾸고 커밋함. 6 실패하면 DefaultErrorHandler가 일시 오류는 같은 자리에서 1·2·4·8초 뒤 2부터 다시 하고 영구 오류는 바로 7로 보내며, 7 DeadLetterPublishingRecoverer가 실패 모음의 같은 번호 파티션에 kafka_dlt 머리와 함께 실은 뒤 그 자리를 넘어가고, 8 운영자가 다시 넣으면 원래 토픽 같은 파티션으로 돌아가 2부터 같은 규칙으로 처리됨. 재고 명령도 StockCommandListener.receive·readValue·requireComplete·모르는 명령은 UnknownStockCommandException·StockCommandService(claim)·ReservationRecorder(findForUpdate·isAfterLastCommand·confirm/release·updateStatus)로 같은 순서를 지나고 6~8은 같음. 첫 봉투는 정상 길, 둘째 봉투는 실패 뒤 실패 모음과 다시 넣기 길을 따라가는 그림](images/13_chapter-sequence.svg)

재고 명령은 `StockCommandListener.receive` → `readValue` → `requireComplete` → 확정·해제가 아니면 `UnknownStockCommandException` → `StockCommandService.confirm`/`release`(트랜잭션: `ProcessedStockCommandRepository.claim`) → `ReservationRecorder.confirm`/`release`(해제는 예약이 아직 없으면 해제된 줄을 먼저 남김, `findForUpdate` → `isAfterLastCommand` → `StockReservation.confirm`/`release` → `updateStatus`, 해제면 재고를 돌려줌) 순서이고, 6~8은 주문 서비스와 같습니다(`stock-reservation-commands.DLT`).

재고 명령이 받는 쪽을 지나는 순서를 그리면 아래와 같습니다.

![11장 완성 코드에서 재고 명령 하나가 재고 서비스를 지나는 순서 — StockCommandListener.receive가 readValue로 읽고 requireComplete로 명령 번호·예약 번호를 확인한 뒤(없거나 번호가 숫자가 아니면 영구 오류), 확정이면 confirm, 해제면 release로 가고 둘 다 아니면 UnknownStockCommandException으로 예약을 바꾸지 않음(10장은 확정이 아니면 해제했음). StockCommandService 한 트랜잭션에서 processed_stock_command(command_id 고유)에 insert ignore로 번호를 남겨 0줄이면 아무것도 바꾸지 않고 커밋하고, 1줄이면 ReservationRecorder로 감. 확정은 findForUpdate → isAfterLastCommand → StockReservation.confirm → updateStatus, 해제는 예약이 아직 없으면 해제된 줄을 먼저 남기고 끝내며, 있으면 findForUpdate → isAfterLastCommand → release → updateStatus 뒤 재고를 돌려줌. 마지막 명령 번호보다 먼저 만든 명령이거나 이미 지난 상태면 바꾸지 않음. 영구 오류는 바로, 일시 오류는 같은 자리에서 1·2·4·8초 다시 시도한 뒤 stock-reservation-commands.DLT로 가는 것은 주문 서비스와 같은 그림](images/23_inventory-command-order.svg)

### 앞 장 코드에서 바뀐 것

- 주문 서비스: `received_payment_event.event_id`에 고유 키를 더하고, 받은 기록을 JPA 엔티티에서 빼 `insert ignore`로 남깁니다. `orders`에 `last_event_id` 칸을 더했습니다.
- 재고 서비스: `processed_stock_command` 표와 `stock_reservation.last_command_id` 칸을 더하고, 확정·해제 진입점을 `StockCommandService`로 옮겼습니다. 모르는 명령을 해제로 처리하지 않습니다.
- 10장 비교 구성품(코레오그래피 `PaymentEventReactionListener`, 그 자리 HTTP `ReservationCommandController`)의 재고 서비스 쪽을 새 진입점(`StockCommandService`, `ReservationRecorder`)에 맞췄습니다.
- 9장 릴레이 계약 두 개는 결제 서버가 보낸 중복을 받은 기록으로 셌는데, 결정 1부터 한 번만 남아 토픽에서 세도록 시험을 고쳤습니다(`OrderServer.sentEventIds`).
- 다른 결제 서버(`OtherPaymentServer`)에 컨텍스트마다 새 결제 이벤트 토픽을 넘기지 않던 출발 구조 시험 도구의 잘못을 결정 1 커밋에서 고쳤습니다(출발 구조 실행의 기본 시험에는 드러나지 않음).

## 테스트 결과

11장 완성 코드에서 전체 테스트(`./gradlew clean check`)를 돌린 결과는 아래와 같습니다. 11장 운영 계약과 두 소비자 모듈 테스트만 남기고 나머지 통과 목록은 생략했습니다.

```text
# 11장 마무리 코드(570f3f5 — 태그 ch11 과 코드가 같다)에서 ./gradlew clean check — tests=761 failures=0 errors=0 time=895.610s, BUILD SUCCESSFUL in 15m 10s (2026-11-22)
# 커버리지(JaCoCo, 결제 서버 — PaymentChallengeApplication 제외, 기준 90%): INSTRUCTION 4884/5024 97.2%, BRANCH 287/303 94.7%, LINE 1082/1118 96.8%, COMPLEXITY 510/536 95.1%, METHOD 371/382 97.1%, CLASS 109/111 98.2%
# 주문 서비스·재고 서비스 모듈에는 커버리지 검사를 걸지 않았다(mock-pg 와 같다) — 11장 소비자 코드는 결제 서버 시험(11장 계약)이 같은 JVM 에서 돌리지만 이 수치에 들어 있지 않다.
## 결제 결과 받기(주문 서비스) — 운영 구현
PASS 모르는 결제 상태가 실린 결과는 실패 모음에 남는다 (1.33s)
PASS 실패 모음에서 다시 넣은 결과는 아직 반영되지 않았으면 반영된다 (16.4s)
PASS 주문 서비스의 저장소가 잠시 쓰기를 거부한 동안 온 결과도 저장소가 돌아오면 반영된다 (6.16s)
PASS 취소 뒤에 그보다 먼저 만든 승인이 늦게 와도 주문은 취소 상태로 남는다 (0.144s)
PASS 처리할 수 없는 결과가 있어도 같은 자리의 뒤 결과는 첫 다시 시도 간격 안에 반영된다 (0.073s)
PASS 읽을 수 없는 결과는 실패 모음에 남는다 (1.32s)
PASS 다시 시도를 다 쓴 결과는 실패 모음에 그 원인과 함께 남는다 (15.6s)
PASS 같은 주문의 결과는 앞 결과를 다시 시도하는 동안에도 보낸 순서대로 받는다 (6.3s)
PASS 결제 서버 시계가 서로 달라 새 결과의 만든 시각이 앞선 결과보다 이르게 찍혀도 새 결과가 반영된다 (0.208s)
PASS 같은 결제 결과를 다시 읽어도 주문은 다시 바뀌지 않는다 (0.177s)
PASS 실패 모음에서 다시 넣은 결과는 그사이 더 새 결과가 반영됐으면 무시된다 (16.6s)
PASS 결제 서버가 같은 결제 결과를 다시 보내도 주문 서비스는 받은 결과를 한 번만 남긴다 (0.285s)
## 재고 명령 받기(재고 서비스) — 운영 구현
PASS 모르는 재고 명령은 실패 모음에 남는다 (1.36s)
PASS 실패 모음에서 다시 넣은 명령은 아직 반영되지 않았으면 반영된다 (16s)
PASS 같은 해제를 다시 읽어도 재고는 한 번만 돌아온다 (0.218s)
PASS 모르는 재고 명령은 예약을 바꾸지 않는다 (0.656s)
PASS 읽을 수 없는 재고 명령은 실패 모음에 남는다 (1.37s)
PASS 실패 모음에서 다시 넣은 명령은 그사이 더 새 명령이 반영됐으면 무시된다 (16.5s)
PASS 다시 시도를 다 쓴 명령은 실패 모음에 그 원인과 함께 남는다 (15.6s)
PASS 재고 서비스의 저장소가 잠시 쓰기를 거부한 동안 온 명령도 저장소가 돌아오면 반영된다 (6.37s)
PASS 같은 예약의 확정을 다시 시도하는 동안 해제가 와도 예약은 해제로 끝나고 재고는 돌아온다 (6.26s)
PASS 처리할 수 없는 명령이 있어도 같은 자리의 뒤 명령은 첫 다시 시도 간격 안에 반영된다 (0.131s)
PASS 해제 뒤에 그보다 먼저 만든 확정이 늦게 와도 예약은 해제 상태로 남는다 (0.22s)
PASS 같은 확정을 다시 읽어도 예약이 잡은 재고는 한 번만 줄어 있다 (0.234s)
```

같은 출력의 맨 끝에는 주문 서비스 모듈 13개, 재고 서비스 모듈 10개 테스트를 붙였습니다(두 모듈에는 커버리지 검사를 걸지 않음).

```text
## 주문은 나중에 받은 결제 결과를 따른다
PASS 결과를 따르면 그 결과를 마지막으로 반영한 결과로 기억한다 (0.03s)
PASS 주문은 마지막으로 받은 결제 결과를 기억한다 (0.004s)
PASS 결제 완료 주문에 취소가 오면 주문은 취소 상태가 된다 (0.001s)
PASS 마지막으로 반영한 결과보다 먼저 만든 결과는 옛 결과로 본다 (0s)
PASS 마지막으로 반영한 결과 그 자체도 새 결과로 보지 않는다 (0.001s)
PASS 마지막으로 반영한 결과보다 뒤에 만든 결과는 새 결과다 (0s)
## 결제 결과가 오면 주문 상태가 정해진다
PASS 결제가 "APPROVED" 이면 주문은 "PAID" 이다 (0.008s)
PASS 결제가 "CAPTURED" 이면 주문은 "PAID" 이다 (0s)
PASS 결제가 "APPROVAL_FAILED" 이면 주문은 "PAYMENT_FAILED" 이다 (0.001s)
PASS 결제가 "EXPIRED" 이면 주문은 "PAYMENT_FAILED" 이다 (0.001s)
PASS 결제가 "APPROVAL_CANCELED" 이면 주문은 "CANCELED" 이다 (0.001s)
PASS 결제가 "CAPTURE_CANCELED" 이면 주문은 "CANCELED" 이다 (0.001s)
PASS 모르는 결제 상태는 결제 결과로 받지 않는다 (0.004s)
## 재고 예약의 상태 전이
PASS 이미 확정된 예약에 다시 온 확정은 아무것도 바꾸지 않는다 (0.042s)
PASS 해제된 예약에 늦게 온 확정은 예약을 되살리지 않는다 (0.006s)
PASS 아직 명령을 받지 않은 예약에는 어느 명령이든 새 명령이다 (0.001s)
PASS 잡아 둔 예약을 해제하면 잡은 재고를 돌려줄 때다 (0.001s)
PASS 예약보다 먼저 온 해제가 남긴 줄은 잡은 재고 없이 해제된 상태다 (0.004s)
PASS 마지막으로 반영한 명령보다 뒤에 만든 명령은 새 명령이다 (0s)
PASS 잡아 둔 예약은 확정된다 (0.001s)
PASS 확정된 예약도 결제가 취소되면 해제되고 잡은 재고를 돌려줄 때다 (0s)
PASS 마지막으로 반영한 명령보다 먼저 만든 명령은 옛 명령이다 (0.001s)
PASS 이미 해제된 예약에 다시 온 해제는 재고를 다시 돌려주지 않는다 (0s)
```

- 출발 코드에서 실패하던 18개(주문 서비스 11, 재고 서비스 7)가 모두 통과하였습니다.
- 전체는 10장의 713개에서 761개가 되었습니다. 11장 운영 계약 24개(주문 12, 재고 12)와, 운영과 같은 결과라 기본 시험에 둔 재고 서비스 결정 1·2 비교 24개로 48개가 늘었습니다. 주문 서비스 모듈 13개와 재고 서비스 모듈 10개도 통과했습니다.
- 위 커버리지는 결제 서버의 수치입니다(애플리케이션 시작 클래스 제외, 라인 96.8%). 주문 서비스·재고 서비스 모듈에는 커버리지 검사를 걸지 않았고, 이 장의 운영 코드는 모두 이 두 모듈에 있어 위 수치에 들어 있지 않습니다.
- 반복 실행으로 흔들리는지 확인했습니다. 11장 기본 시험 48개를 3번 다시 돌려 3번 모두 통과했고(310·309·310초), 11장 비교 144개는 두 번 실행의 통과·실패가 144개 모두 같았습니다. 겹침과 실패 시점은 트리거와 `read_only` 전환을 시험이 정한 때에 걸어 고정했습니다. 시간으로 판정하는 계약은 "처리할 수 없는 결과 뒤의 결과는 2초 안에 반영된다" 하나이고, 위 실행에서 테스트 시간 0.073초(재고 0.131초) 안에 반영됐습니다.

![결정 커밋마다 11장 운영 계약 12개 중 실패 수 — 주문 서비스는 출발(eb61745) 11, 결정 1(182c99f) 9, 결정 2(c624b5d) 8, 결정 3(c4471f8) 5, 결정 4(148624b) 0이고, 재고 서비스는 7, 7, 7, 5, 0임. 결정 1에서 다시 보낸·다시 읽은 결과, 결정 2에서 늦은 옛 승인이 통과하고 재고는 10장 상태 전이로 변화가 없었으며, 결정 3 뒤 남은 것은 실패 모음·다시 넣기 계약이었음. 태그 ch11에서 clean check 761개가 모두 통과했고(10장 713개 + 운영 계약 24개 + 기본 시험에 둔 재고 결정 1·2 비교 24개), 커버리지는 결제 서버 수치로 두 소비자 모듈은 검사 밖이며, 기본 시험 48개 3번 반복과 비교 144개 두 번 실행이 같았던 그림](images/14_commit-progression.svg)

계약을 지키지 못하는 비교 구현은 `./gradlew knownFailingTest`로 돌렸습니다. 651개 중 169개가 실패했습니다. 11장 비교는 144개(계약 12개 × 열두 구현) 중 39개가 실패했습니다. 뒤이어 도는 7장 `jpaVersionTest`는 11개 중 4개가 실패해 앞 장과 같았습니다.

11장 계약 12개씩을 구현마다 모으면 아래와 같습니다. 주문 서비스는 다음과 같습니다.

- 운영 0개 실패
- 출발 구조 11개: 받은 기록 2줄, 다시 읽은 결과에 주문 다시 바뀜, 늦은 옛 승인에 결제 완료, 모르는 상태·읽을 수 없는 본문·다 쓴 결과가 실패 모음에 없음, 뒤 결과 4.6초, 6초 장애에 잃음, 다시 시도 중 순서, 다시 넣기 2
- 결정 1 가리지 않음 1개, 상태 전이만 1개: 둘 다 결제 서버가 다시 보낸 결과의 받은 기록 2줄
- 결정 2 거르지 않음 2개(늦은 옛 승인, 다시 넣은 옛 승인), 만든 시각 1개(시계가 늦은 서버의 취소 무시)
- 결정 3 기본 처리 8개(실패 모음 3, 뒤 결과 4.6초, 6초 장애, 다시 넣기 2, 다시 시도 중 순서), 다시 시도 토픽 2개(다시 시도 중 순서, 원인 머리 빔)
- 결정 4 로그만 5개(실패 모음 3, 다시 넣기 2), DB 실패 표 3개(다 쓴 결과의 실패 모음, 다시 넣기 2)

![주문 서비스의 11장 계약 12개를 출발 구조, 운영, 가리지 않음, 상태 전이만, 거르지 않음, 만든 시각, 기본 처리, 다시 시도 토픽, 로그만, DB 실패 표 구현마다 통과·실패 칸으로 그린 격자 — 실패 수는 차례로 11, 0, 1, 1, 2, 1, 8, 2, 5, 3임. 출발 구조는 시계 계약만 통과했고, 가리지 않음과 상태 전이만은 다시 보낸 결과의 받은 기록 2줄, 거르지 않음은 늦은 옛 승인과 다시 넣은 옛 승인에 PAID, 만든 시각은 시계가 다른 서버의 취소를 무시해 PAID, 기본 처리는 실패 모음 세 계약·2초 안(4.61초)·6초 장애·다시 넣기 둘·순서, 다시 시도 토픽은 원인 빔과 순서 뒤바뀜, 로그만은 실패 모음 세 계약과 다시 넣기 둘, DB 실패 표는 다 쓴 결과와 다시 넣기 둘이 실패한 그림](images/15_result-grid-order.svg)

재고 서비스는 다음과 같습니다.

- 운영 0개 실패
- 출발 구조 7개: 모르는 명령에 예약 해제, 실패 모음 3, 다시 넣기 2, 6초 장애에 잃음
- 결정 1 명령 번호로 가리지 않음 0개, 결정 2 옛 명령 거르지 않음 0개(기본 시험)
- 결정 3 기본 처리 7개(실패 모음 3, 뒤 명령 4.6초, 6초 장애, 다시 넣기 2), 다시 시도 토픽 1개(원인 머리 빔)
- 결정 4 로그만 5개, DB 실패 표 3개

![재고 서비스의 11장 계약 12개를 출발 구조, 운영, 번호로 가리지 않음, 옛 명령 거르지 않음, 기본 처리, 다시 시도 토픽, 로그만, DB 실패 표 구현마다 통과·실패 칸으로 그린 격자 — 실패 수는 차례로 7, 0, 0, 0, 7, 1, 5, 3임. 같은 확정·해제 다시 읽기, 해제 뒤 늦은 옛 확정, 확정 다시 시도 중 해제는 모든 구현이 통과했고, 출발 구조는 모르는 명령에 RELEASED·실패 모음 세 계약·6초 장애·다시 넣기 둘, 기본 처리는 실패 모음 세 계약·2초 안(4.61초)·6초 장애·다시 넣기 둘, 다시 시도 토픽은 원인 빔, 로그만은 실패 모음 세 계약과 다시 넣기 둘, DB 실패 표는 다 쓴 명령과 다시 넣기 둘이 실패한 그림](images/16_result-grid-inventory.svg)

주문 서비스의 "같은 결제 결과를 다시 읽어도 주문은 다시 바뀌지 않는다"와 재고 서비스의 같은 확정·해제 다시 읽기, 해제 뒤 옛 확정, 모르는 명령이 예약을 바꾸지 않음, 확정을 다시 시도하는 동안 해제는 모든 비교 구현이 통과했습니다.

2~10장 비교는 507개 중 130개가 실패해 10장 기록(125개)과 달라졌습니다. 달라진 것은 아래 세 가지입니다.

- 9장 결제 이벤트 비교 '커밋 뒤에 보냄'(4개 → 7개)과 '그 자리에서 바로 보냄'(5개 → 7개): 두 비교는 이벤트 고유 번호를 UUID로 보냅니다. 11장 주문 서비스는 숫자가 아닌 번호를 영구 오류로 보아(결정 3) 주문을 바꾸지 않으므로, 승인·거절·순서 계약이 도착을 기다리다 실패했습니다. 실패 모음에 간 것까지 따로 확인하지는 않았습니다. 9장 비교 코드는 바꾸지 않고, 11장 규칙이 낳은 결과로 기록했습니다.
- 9장 '키 없이 보냄'(2개 → 1개)과 릴레이 '한 줄씩 skip locked'(3개 → 2개): "승인 뒤 전액 취소된 결제의 주문은 취소 상태다"가 통과했습니다. 순서가 바뀌어 늦게 온 승인을 결정 2가 거릅니다.
- 10장 '수량만'(4개 → 5개)과 '실패로만'(3개 → 4개): 몰림 계약(서버 두 대·300건, 겹침을 고정하지 않음) 하나씩입니다. 10장에 적은 흔들림입니다.

달라진 비교와 그 원인을 나눠 그리면 아래와 같습니다.

![2~10장 비교가 10장 기록과 달라진 세 원인 — 10장 기록 125개 실패가 11장 코드 아래에서 130개가 됨. 9장 결제 이벤트 비교 커밋 뒤에 보냄(4 → 7)과 그 자리에서 바로 보냄(5 → 7)은 이벤트 번호를 UUID로 보내 11장 주문 서비스가 숫자가 아닌 번호를 영구 오류로 보아(결정 3) 승인·거절·순서 계약이 도착을 기다리다 실패해 5개 늘었고(실패 모음에 간 것은 따로 확인하지 않음), 9장 키 없이 보냄(2 → 1)과 릴레이 한 줄씩 skip locked(3 → 2)는 순서가 바뀌어 늦게 온 승인을 결정 2가 걸러 "승인 뒤 전액 취소된 결제의 주문은 취소 상태다"가 통과해 2개 줄었으며, 10장 수량만(4 → 5)과 실패로만(3 → 4)은 겹침을 고정하지 않은 몰림 계약(서버 두 대·300건) 하나씩으로 10장에 적은 흔들림이라 2개 늘어 125 + 5 − 2 + 2 = 130인 그림](images/24_comparison-changes.svg)

### 받는 쪽 저장소를 막은 동안의 측정

`./gradlew consumerMeasurement`로 주문 서비스에서 두 가지를 쟀습니다. 다시 시도 간격·횟수는 운영 값(1·2·4·8초)이고, 비교 구현도 같은 값을 씁니다(기본 처리만 `FixedBackOff(0, 9)`). k6는 돌리지 않았습니다.

- 받는 쪽 저장소 장애: MySQL을 10초 또는 30초 읽기 전용으로 돌리고, 그동안 0.5초마다 새 결제의 승인 결과를 하나씩 싣습니다(10초 20건, 30초 60건, 키가 달라 파티션 2개에 흩어짐). 장애를 걷은 뒤 모두 반영되거나 실패 모음에 남을 때까지(최대 60초) 기다리고 2초 더 봅니다. 반영은 주문이 바뀐 수, 실패 모음은 `<토픽>.DLT`(DB 실패 표는 `failed_message`)에 남은 수, 잃음은 둘 다 아닌 수입니다. 반영 지연은 결과를 토픽에 실은 때(브로커 시각)부터 주문 서비스가 받아 남긴 때까지입니다.
- 막는 시간: 한 결제의 결과가 계속 쓰이지 못하게(트리거, 일시 오류) 한 채 그 결과를 싣고, 바로 뒤에 같은 파티션의 다른 결제 결과를 실어 뒤 결과가 반영되기까지 걸린 시간을 쟀습니다. 모르는 결제 상태(영구 오류) 뒤도 같은 방법으로 쟀습니다.

방식마다 3번(#1~#3) 돌렸고, 측정 전에 한 건을 먼저 반영해 두었습니다. 같은 코드로 전체를 두 번 실행했고, 첫 실행 앞의 시험 실행은 받은 때를 읽는 코드의 형 변환 오류로 멈춰 고치고 버렸습니다. 아래는 두 번째 실행입니다.

```text
## 두 번째 실행(후속 작업)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 10초 | #1 | 보냄 20 | 반영 17 | 실패 모음 0 | 잃음 3 | 반영 지연 ms 중앙 4557·p95 8529·최대 8529 (17건)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 10초 | #2 | 보냄 20 | 반영 17 | 실패 모음 0 | 잃음 3 | 반영 지연 ms 중앙 5077·p95 9030·최대 9030 (17건)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 10초 | #3 | 보냄 20 | 반영 17 | 실패 모음 0 | 잃음 3 | 반영 지연 ms 중앙 4573·p95 8522·최대 8522 (17건)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 30초 | #1 | 보냄 60 | 반영 49 | 실패 모음 0 | 잃음 11 | 반영 지연 ms 중앙 13113·p95 23587·최대 24561 (49건)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 30초 | #2 | 보냄 60 | 반영 49 | 실패 모음 0 | 잃음 11 | 반영 지연 ms 중앙 12643·p95 23531·최대 25032 (49건)
결정 3 비교 — Spring Kafka 기본 처리 | 가. 장애 30초 | #3 | 보냄 60 | 반영 49 | 실패 모음 0 | 잃음 11 | 반영 지연 ms 중앙 12630·p95 24071·최대 25031 (49건)
결정 3 비교 — Spring Kafka 기본 처리 | 나. 막는 시간 | #1 | 일시 오류 뒤 4599ms / 영구 오류 뒤 4572ms
결정 3 비교 — Spring Kafka 기본 처리 | 나. 막는 시간 | #2 | 일시 오류 뒤 4576ms / 영구 오류 뒤 4605ms
결정 3 비교 — Spring Kafka 기본 처리 | 나. 막는 시간 | #3 | 일시 오류 뒤 4572ms / 영구 오류 뒤 4594ms
결정 4 비교 — DB 실패 표 | 가. 장애 10초 | #1 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10723·p95 15203·최대 15226 (20건)
결정 4 비교 — DB 실패 표 | 가. 장애 10초 | #2 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10744·p95 15221·최대 15233 (20건)
결정 4 비교 — DB 실패 표 | 가. 장애 10초 | #3 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 11270·p95 15214·최대 15250 (20건)
결정 4 비교 — DB 실패 표 | 가. 장애 30초 | #1 | 보냄 60 | 반영 60 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 16841·p95 30036·최대 31010 (60건)
결정 4 비교 — DB 실패 표 | 가. 장애 30초 | #2 | 보냄 60 | 반영 60 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 16329·p95 29263·최대 30760 (60건)
결정 4 비교 — DB 실패 표 | 가. 장애 30초 | #3 | 보냄 60 | 반영 60 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 16568·p95 30018·최대 31012 (60건)
결정 4 비교 — DB 실패 표 | 나. 막는 시간 | #1 | 일시 오류 뒤 15708ms / 영구 오류 뒤 45ms
결정 4 비교 — DB 실패 표 | 나. 막는 시간 | #2 | 일시 오류 뒤 15794ms / 영구 오류 뒤 45ms
결정 4 비교 — DB 실패 표 | 나. 막는 시간 | #3 | 일시 오류 뒤 15775ms / 영구 오류 뒤 52ms
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 10초 | #1 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10290·p95 15234·최대 15247 (20건)
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 10초 | #2 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10301·p95 15249·최대 15259 (20건)
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 10초 | #3 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10778·p95 15219·최대 15229 (20건)
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 30초 | #1 | 보냄 60 | 반영 58 | 실패 모음 0 | 잃음 2 | 반영 지연 ms 중앙 15298·p95 29173·최대 29699 (58건)
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 30초 | #2 | 보냄 60 | 반영 58 | 실패 모음 0 | 잃음 2 | 반영 지연 ms 중앙 15457·p95 29188·최대 29733 (58건)
결정 4 비교 — 다 쓰면 로그만 | 가. 장애 30초 | #3 | 보냄 60 | 반영 58 | 실패 모음 0 | 잃음 2 | 반영 지연 ms 중앙 15806·p95 29732·최대 30217 (58건)
결정 4 비교 — 다 쓰면 로그만 | 나. 막는 시간 | #1 | 일시 오류 뒤 15753ms / 영구 오류 뒤 53ms
결정 4 비교 — 다 쓰면 로그만 | 나. 막는 시간 | #2 | 일시 오류 뒤 15737ms / 영구 오류 뒤 55ms
결정 4 비교 — 다 쓰면 로그만 | 나. 막는 시간 | #3 | 일시 오류 뒤 15700ms / 영구 오류 뒤 46ms
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 10초 | #1 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10705·p95 15181·최대 15204 (20건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 10초 | #2 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10762·p95 15201·최대 15220 (20건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 10초 | #3 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 10210·p95 15192·최대 15206 (20건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 30초 | #1 | 보냄 60 | 반영 58 | 실패 모음 2 | 잃음 0 | 반영 지연 ms 중앙 15352·p95 29311·최대 29798 (58건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 30초 | #2 | 보냄 60 | 반영 58 | 실패 모음 2 | 잃음 0 | 반영 지연 ms 중앙 15373·p95 28781·최대 30264 (58건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 가. 장애 30초 | #3 | 보냄 60 | 반영 58 | 실패 모음 2 | 잃음 0 | 반영 지연 ms 중앙 16312·p95 29455·최대 30451 (58건)
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 나. 막는 시간 | #1 | 일시 오류 뒤 15736ms / 영구 오류 뒤 46ms
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 나. 막는 시간 | #2 | 일시 오류 뒤 15755ms / 영구 오류 뒤 45ms
운영 — blocking 다시 시도(1·2·4·8초) + DLT | 나. 막는 시간 | #3 | 일시 오류 뒤 15759ms / 영구 오류 뒤 42ms
결정 3 비교 — 다시 시도 토픽 | 가. 장애 10초 | #1 | 보냄 20 | 반영 19 | 실패 모음 1 | 잃음 0 | 반영 지연 ms 중앙 7057·p95 15546·최대 15546 (19건)
결정 3 비교 — 다시 시도 토픽 | 가. 장애 10초 | #2 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 7049·p95 15549·최대 15553 (20건)
결정 3 비교 — 다시 시도 토픽 | 가. 장애 10초 | #3 | 보냄 20 | 반영 20 | 실패 모음 0 | 잃음 0 | 반영 지연 ms 중앙 7079·p95 15106·최대 15544 (20건)
결정 3 비교 — 다시 시도 토픽 | 가. 장애 30초 | #1 | 보냄 60 | 반영 31 | 실패 모음 29 | 잃음 0 | 반영 지연 ms 중앙 15041·p95 15562·최대 15584 (31건)
결정 3 비교 — 다시 시도 토픽 | 가. 장애 30초 | #2 | 보냄 60 | 반영 31 | 실패 모음 29 | 잃음 0 | 반영 지연 ms 중앙 15051·p95 15567·최대 15610 (31건)
결정 3 비교 — 다시 시도 토픽 | 가. 장애 30초 | #3 | 보냄 60 | 반영 30 | 실패 모음 30 | 잃음 0 | 반영 지연 ms 중앙 15049·p95 15605·최대 16066 (30건)
결정 3 비교 — 다시 시도 토픽 | 나. 막는 시간 | #1 | 일시 오류 뒤 41ms / 영구 오류 뒤 46ms
결정 3 비교 — 다시 시도 토픽 | 나. 막는 시간 | #2 | 일시 오류 뒤 47ms / 영구 오류 뒤 49ms
결정 3 비교 — 다시 시도 토픽 | 나. 막는 시간 | #3 | 일시 오류 뒤 50ms / 영구 오류 뒤 51ms
```

두 실행의 범위는 아래와 같습니다. 두 실행이 다른 곳은 실행마다 따로 적었습니다.

- 운영(blocking + DLT): 10초 장애에서 6번 모두 반영 20·잃음 0이었고, 지연 중앙값은 첫 실행 10322\~10891ms, 두 번째 10210\~10762ms였습니다. 30초 장애에서는 6번 모두 반영 58·실패 모음 2·잃음 0이었습니다. 파티션마다 맨 앞 1건이 15초를 다 써 실패 모음으로 가고, 나머지는 기다렸다 반영됐습니다. 지연 중앙값은 15529\~17971ms, 15352\~16312ms였습니다. 막는 시간은 일시 오류 뒤 첫 실행 15813\~15933ms·두 번째 15736\~15759ms, 영구 오류 뒤 58\~70ms·42\~46ms였습니다.
- Spring Kafka 기본 처리: 10초 장애에서 6번 모두 3건을 잃었습니다. 30초 장애에서 잃은 수는 첫 실행 12·11·12, 두 번째 11·11·11로 두 실행이 달랐습니다. 막는 시간은 일시·영구 모두 첫 실행 4612\~4650ms, 두 번째 4572\~4605ms였습니다. 처음 1번 뒤 다시 9번이 약 0.5초씩 걸린 시간입니다.
- 다시 시도 토픽: 10초 장애에서 첫 실행은 3번 모두 잃음 0·실패 모음 0이었고, 두 번째 실행은 #1에서 1건이 실패 모음으로 갔습니다(#2·#3은 0). 장애가 끝나기 직전에 실린 결과가 다시 시도 토픽에서 15초를 다 쓴 것으로 보이지만 원인은 더 보지 않았습니다. 지연 중앙값은 7085\~7124ms, 7049\~7079ms였습니다. 30초 장애에서는 반영 30\~32·실패 모음 28\~30(첫 실행), 반영 30\~31·실패 모음 29\~30(두 번째)이고 잃음은 0이었습니다. 메시지마다 따로 15초를 다 썼습니다. 막는 시간은 일시 오류 뒤 45\~48ms·41\~50ms, 영구 오류 뒤 49\~57ms·46\~51ms였습니다.

![받는 쪽 저장소를 막은 동안의 측정(주문 서비스, 방식마다 3번씩 두 번 실행) — 장애 10초·20건에서 운영(blocking + DLT)은 두 실행 모두 반영 20·잃음 0(지연 중앙 10322~10891ms, 10210~10762ms), 기본 처리는 반영 17·잃음 3(4561~4590ms, 4557~5077ms), 다시 시도 토픽은 첫 실행 반영 20, 두 번째 실행 #1만 반영 19·실패 모음 1(7085~7124ms, 7049~7079ms), 로그만과 DB 실패 표는 반영 20·잃음 0임. 장애 30초·60건에서 운영은 반영 58·실패 모음 2·잃음 0(15529~17971ms, 15352~16312ms), 기본 처리는 첫 실행 반영 48~49·잃음 12·11·12, 두 번째 반영 49·잃음 11·11·11, 다시 시도 토픽은 반영 30~32·실패 모음 28~30과 반영 30~31·실패 모음 29~30, 로그만은 반영 58·잃음 2, DB 실패 표는 반영 60·실패 표 0·잃음 0인 그림](images/17_measurement-outage.svg)

- 로그만: 10초 장애에서 잃음 0, 30초 장애에서 6번 모두 2건을 잃었습니다. 운영이 실패 모음에 남긴 2건이 로그로만 남은 것입니다. 막는 시간은 일시 오류 뒤 15839\~15969ms·15700\~15753ms로 운영과 같은 모양이었습니다.
- DB 실패 표: 10초 장애에서 잃음 0, 30초 장애에서 6번 모두 반영 60·실패 표 0·잃음 0이었습니다. 다시 시도를 다 쓴 맨 앞 메시지를 실패 표에 남기지 못해 Spring Kafka가 그 자리를 넘어가지 않고 계속 다시 시도했고, 저장소가 돌아온 뒤 반영됐습니다(실행에서 본 것). 계약(30초 안에 실패 모음에 남음)은 같은 이유로 실패했습니다. 막는 시간은 일시 오류 뒤 15764\~15889ms·15708\~15794ms였습니다.

![막는 시간 측정(주문 서비스, 방식마다 3번씩 두 번 실행, 로그 눈금) — 일시 오류 결과 뒤 같은 파티션 결과가 반영되기까지 운영(blocking + DLT)은 첫 실행 15813~15933ms·두 번째 15736~15759ms, 로그만 15839~15969ms·15700~15753ms, DB 실패 표 15764~15889ms·15708~15794ms로 다시 시도 합 15초 근처이고, 기본 처리는 4630~4650ms·4572~4599ms, 다시 시도 토픽은 45~48ms·41~50ms임. 영구 오류 뒤는 운영 58~70ms·42~46ms, 기본 처리 4612~4618ms·4572~4605ms, 다시 시도 토픽 49~57ms·46~51ms, 로그만 56~62ms·46~55ms, DB 실패 표 48~65ms·45~52ms이고, 운영의 일시 오류 값은 두 실행 범위가 겹치지 않아 따로 적은 그림](images/18_measurement-blocking.svg)

## 남은 한계

이 장의 구조로도 아래 문제들은 아직 해결하지 못합니다.

- 일시 오류 메시지 하나가 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 메시지가 기다립니다. 결정 3의 비용으로 남겼고, 측정(주문 서비스, 운영 값으로 한 결제를 계속 실패시킨 뒤)에서 15736~15933ms(두 실행)였습니다.
- 다시 시도 15초의 근거는 이 머신에서 잰 MySQL 컨테이너 재시작 시간(2.62~3.04초)이고, 5배 여유는 가정입니다. 운영 DB 전환 시간의 기준은 없습니다.
- 측정의 30초 장애에서는 파티션마다 맨 앞 메시지가 실패 모음으로 갔고, 이 메시지는 운영자가 다시 넣기 명령을 돌려야 반영됩니다. 다시 넣기는 자동으로 돌지 않습니다.
- `payment_outbox` 번호가 같은 결제 안에서 커밋 순서대로 커진다는 것은 결제 줄 잠금 구조에서 끌어낸 가정이고, MySQL 문서로 확인하지 않았습니다. `insert ignore`가 같은 번호를 남기는 중인 트랜잭션을 기다린다는 것도 문서로 확인하지 않았습니다.

![남은 한계 중 결정의 비용과 가정으로 남긴 것 — 일시 오류 메시지 하나가 같은 파티션의 뒤 메시지를 15813~15933ms·15736~15759ms 막는 결정 3의 비용, 이 머신에서 잰 MySQL 재시작 2.62~3.04초의 약 5배로 둔 다시 시도 15초(5배 여유는 가정, 운영 DB 전환 기준 없음), 30초 장애에서 파티션마다 맨 앞 메시지 2건이 실패 모음으로 가 운영자가 다시 넣기를 돌려야 반영되는 것, payment_outbox 번호가 커밋 순서대로 커진다는 것과 insert ignore가 남기는 중인 트랜잭션을 기다린다는 것을 문서로 확인하지 않은 가정, 재고 서비스 결정 1·2는 넣기 전후 차이가 없고 재고 운영 계약 실패는 결정 3·4에서 7·5·0개로 줄어든 것, 받은 기록·처리한 명령 기록·보낸 payment_outbox 줄을 지우지 않고 TTL도 없는 것, 이미 만든 DB를 옮기는 스크립트가 없는 것(옮길 때는 orders.last_event_id·stock_reservation.last_command_id 칸을 더하고 received_payment_event의 같은 번호 줄을 지운 뒤 고유 키를 더해야 하며, create table if not exists는 새 칸·키를 더하지 않음)을 카드로 나눈 그림](images/19_limits-costs.svg)

- 재고 서비스의 결정 1·2는 이 장의 계약 12개에서 넣기 전후의 차이가 없었습니다. 재고 서비스의 운영 계약 실패는 결정 3·4 커밋에서 줄었습니다(7개 → 5개 → 0개).
- 받은 기록, 처리한 명령 기록, 보낸 `payment_outbox` 줄을 지우지 않습니다. 예약 만료(TTL)도 없습니다.
- 이미 만든 DB를 옮기는 스크립트가 없습니다. `orders.last_event_id`·`stock_reservation.last_command_id` 칸을 더하고, `received_payment_event`의 같은 번호 줄을 지운 뒤 고유 키를 더해야 합니다.
- 9장 비교 '커밋 뒤에 보냄'·'그 자리에서 바로 보냄'은 UUID 번호 때문에 11장 주문 서비스에서 처리되지 않습니다.
- 받는 쪽 저장소 장애는 `read_only`로만 만들었고, 연결이 끊기는 장애는 만들지 않았습니다.
- 기본 처리의 0.5초 간격이 `fetch.max.wait.ms` 때문인지, 다시 시도 토픽의 원인 머리가 빈 이유, 두 번째 측정 #1에서 1건이 실패 모음으로 간 원인은 더 보지 않았습니다.

![남은 한계 중 확인하지 못한 것과 다루지 않은 것 — 9장 비교 커밋 뒤에 보냄·그 자리에서 바로 보냄은 UUID 번호라 11장 주문 서비스가 영구 오류로 보아 실패가 4개에서 7개, 5개에서 7개로 늘었고, 저장소 장애는 read_only로만 만들고 연결 끊김은 만들지 않았으며, 기본 처리 0.5초 간격의 원인·다시 시도 토픽 원인 머리가 빈 이유·두 번째 측정 #1의 1건은 더 보지 않았고, DeadLetterPublishingRecoverer의 기본 토픽 이름·머리 목록과 원인 사슬 분류는 문서로 확인하지 못했으며(읽은 문서 4.2.0, 쓰는 판 4.1.2), Kafka 트랜잭션은 비교로 돌리지 않았고, 두 소비자 모듈에는 커버리지 검사를 걸지 않은 것을 카드로 나눈 그림](images/20_limits-unverified.svg)

- `DeadLetterPublishingRecoverer`의 기본 토픽 이름과 머리 목록, 기본 처리기의 예외 분류가 원인 사슬(`ListenerExecutionFailedException` 안의 `JacksonException` 등)을 따라가는지는 문서로 확인하지 못했습니다. 모르는 상태·읽을 수 없는 본문이 첫 간격 안에 실패 모음으로 간 계약 실행으로만 압니다. 읽은 문서는 4.2.0 판이고, 쓰는 판은 Spring Kafka 4.1.2입니다.
- Kafka 트랜잭션(exactly-once)은 비교로 돌리지 않았습니다.
- 주문 서비스·재고 서비스 모듈에는 커버리지 검사를 걸지 않았습니다.

앞 글에서 11장으로 넘긴 항목은 이렇게 되었습니다.

- 1장 [결제 기초: 인증, 승인, 매입, 취소와 상태 머신](../payment-state-machine/) 연재 목차의 "11장 컨슈머 멱등성·재시도·DLQ": 받는 쪽 두 곳에 메시지 번호로 한 번만 반영하기, 마지막 번호로 옛 메시지 거르기, 같은 자리에서 다시 시도하기, 실패 모음과 다시 넣기를 넣었습니다.
- 9장 [Transactional Outbox와 Kafka](../payment-outbox-kafka/) 도입의 "받는 쪽의 중복 가리기·재시도·실패 모음(DLQ)은 11장 몫": 결정 1·3·4로 넣었습니다.

![앞 글에서 11장으로 넘긴 항목 중 1장 목차와 9장 — 1장 목차의 11장 컨슈머 멱등성·재시도·DLQ는 결정 1~4, 9장 도입의 중복 가리기·재시도·실패 모음은 결정 1·3·4, 9장 결정 3(릴레이 나누기)의 옛 이벤트를 거르지 않는 문제는 결정 2로 다뤄 한 줄씩 skip locked 비교 실패가 3개에서 2개로 줄었고, 9장 결정 5 비용의 중복 가리기는 결정 1(event_id 고유 키), 9장 남은 한계는 결정 1~4(기본 처리는 비교로 돌려 주문 8·재고 7 실패), 9장 마무리의 다시 재 볼 필요는 가리지 않음·상태 전이만·거르지 않음·만든 시각 비교를 같은 계약으로 돌린 결정 1·2로 다룬 그림](images/21_handover-1.svg)

- 9장 결정 3(릴레이 나누기)의 "이 장의 주문 서비스는 옛 이벤트를 거르지 않으므로(11장) 나눠 보낸 만큼 주문 상태가 틀렸습니다": 결정 2로 늦게 온 승인을 거르게 되어, '한 줄씩 skip locked' 비교의 실패가 3개에서 2개로 줄었습니다. 나머지 2개는 남았습니다.
- 9장 결정 5 비용의 "받는 쪽이 중복을 가려야 합니다 … 가리는 일은 11장에서 합니다": 받은 기록의 `event_id`에 고유 키를 더해 같은 번호는 한 번만 남고 한 번만 반영합니다.
- 9장 남은 한계의 "받는 쪽은 중복과 늦게 온 옛 이벤트를 가리지 않습니다 … 처리에 실패한 이벤트도 Spring Kafka 기본 처리(바로 다시 시도, 10번째에 로그를 남기고 넘어감) 그대로입니다": 결정 1~4로 다뤘습니다. 기본 처리는 비교로 돌려 주문 서비스 8개, 재고 서비스 7개가 실패했습니다.
- 9장 마무리의 "중복과 옛 이벤트를 받는 쪽에서 어떻게 가릴지는 11장에서 다시 재 볼 필요가": 가리지 않음·상태 전이만·거르지 않음·만든 시각 비교를 같은 계약으로 돌렸습니다.

![앞 글에서 11장으로 넘긴 항목 중 10장 — 10장 결정 3과 남은 한계의 일반적인 중복 가리기와 기본 처리 그대로인 실패한 명령은 결정 1~4로 다뤄 재고 서비스에도 처리한 명령 표, 마지막 명령 번호, 같은 자리 다시 시도, 실패 모음 stock-reservation-commands.DLT를 넣었고 일반 중복 가리기와 옛 명령 거르기는 이 장의 계약에서 10장 상태 전이만과 결과가 같았음. 10장 다음 글 예고의 가리기·다시 시도·모으기는 결정 1·3·4로 답해, 같은 메시지는 번호를 남긴 표로 가리고 일시 오류는 같은 자리에서 1·2·4·8초 다시 시도하며 다 쓰거나 영구 오류면 실패 모음에 모으는 그림](images/22_handover-2.svg)

- 10장 [Saga와 보상 트랜잭션](../payment-saga-inventory/) 결정 3의 "받은 메시지 번호를 남겨 거르는 일반적인 중복 가리기 … 일반 중복 가리기는 11장에서 다룹니다"와 남은 한계의 "처리에 실패한 명령은 Spring Kafka 기본 처리 그대로입니다. 11장에서 다룹니다": 재고 서비스에도 처리한 명령 표, 마지막 명령 번호, 다시 시도, 실패 모음을 넣었습니다. 일반 중복 가리기와 옛 명령 거르기는 이 장의 계약에서 10장 상태 전이만과 결과가 같았습니다.
- 10장 다음 글 예고의 "받는 쪽이 같은 메시지를 어떻게 가리고, 처리에 실패한 메시지를 언제 다시 시도하고 어디에 모을지": 같은 메시지는 번호를 남긴 표로 가리고, 일시 오류는 같은 자리에서 1·2·4·8초 다시 시도하고, 다 쓰거나 영구 오류면 `<토픽>.DLT`에 모읍니다.

## 요약

오늘은 메시지를 받는 쪽(주문 서비스·재고 서비스)에서 같은 메시지와 늦게 온 옛 메시지를 가리고, 처리에 실패한 메시지를 다시 시도하고 모으는 방법을 정리하였습니다. 요약하자면 아래와 같습니다.

- 10장 그대로인 출발 코드에서는 11장 계약 24개 중 18개(주문 서비스 11, 재고 서비스 7)가 실패했습니다. 같은 결과가 두 번 오면 받은 기록이 2줄 남았고, 늦게 온 옛 승인이 취소된 주문을 결제 완료로 되돌렸고, 처리할 수 없는 메시지는 로그만 남고 사라졌고(재고 서비스는 모르는 명령을 해제로 처리), 6초 장애 동안 온 메시지를 잃었습니다. 재고 서비스의 같은 명령·옛 명령은 10장 상태 전이로 재현되지 않았습니다.
- 같은 메시지는 `payment_outbox` 번호를 상태 변경과 같은 트랜잭션에서 고유 키가 있는 표에 `insert ignore`로 남겨 가립니다. 가리지 않음과 상태 전이만은 받은 기록을 2줄 남겼고, Kafka 트랜잭션은 받는 쪽 DB 반영까지 묶지 못해 비교로 돌리지 않았습니다.
- 옛 메시지는 주문·예약마다 마지막으로 반영한 번호보다 크지 않으면 반영하지 않습니다. 거르지 않으면 늦은 옛 승인과 다시 넣은 옛 승인에 결제 완료로 되돌아갔고, 만든 시각으로 비교하면 시계가 늦은 서버의 취소를 무시했습니다. 번호가 커밋 순서대로 커진다는 것은 결제 줄 잠금에서 끌어낸 가정입니다.
- 일시 오류는 같은 자리에서 1·2·4·8초(합 15초) 다시 시도하고, 영구 오류는 다시 시도하지 않습니다. 15초는 잰 MySQL 재시작 2.62\~3.04초의 약 5배이고 5배 여유는 가정입니다. 기본 처리는 6초 장애에 메시지를 잃었고, 다시 시도 토픽은 같은 주문의 결과 순서가 바뀌었습니다. 대신 측정에서 계속 실패하는 일시 오류 하나가 다시 시도 15초를 다 쓰는 동안 같은 파티션을 약 15.7\~15.9초 막았습니다.
- 다 쓴 메시지와 영구 오류는 `<토픽>.DLT`에 원인 머리와 함께 모으고, 운영자가 다시 넣기 모드로 서비스를 한 번 띄워 원래 토픽에 다시 넣습니다. 다시 넣은 메시지는 결정 1·2를 그대로 따릅니다. 측정의 30초 읽기 전용 장애(60건)에서 운영은 잃음 0·실패 모음 2, 로그만은 2건을 잃었고, DB 실패 표는 저장소가 막힌 동안 실패 표에 남기지 못했습니다.

## 다음 글 예고

다음 글에서는 4부 운영의 마지막 글로 12장 대사와 장애 대응을 다룹니다. 이 장의 실패 모음은 운영자가 명령을 돌려야 원래 토픽으로 돌아가고, 다시 시도 15초의 여유는 운영 기준 없이 둔 가정이며, 보낸 `payment_outbox` 줄과 받은 기록은 지우지 않고 쌓입니다.

참조 :

- [payment-challenge — chapter-11 브랜치](https://github.com/qkrxodud/payment-challenge/tree/chapter-11)
- [Spring for Apache Kafka — Handling Exceptions (DefaultErrorHandler)](https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html#default-eh)
- [Spring for Apache Kafka — Non-Blocking Retries: How the Pattern Works](https://docs.spring.io/spring-kafka/reference/retrytopic/how-the-pattern-works.html)
- [Spring for Apache Kafka — Committing Offsets](https://docs.spring.io/spring-kafka/reference/kafka/receiving-messages/message-listener-container.html#committing-offsets)
- [Spring for Apache Kafka — Exactly Once Semantics](https://docs.spring.io/spring-kafka/reference/kafka/exactly-once.html)
- [Saga와 보상 트랜잭션](../payment-saga-inventory/)
- [Transactional Outbox와 Kafka](../payment-outbox-kafka/)
- [결제 동시성 제어](../payment-concurrency/)
