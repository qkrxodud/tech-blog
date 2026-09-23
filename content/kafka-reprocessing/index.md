---
title: "[Kafka] 재처리"
tags: ["Kafka","AckMode","offset commit","멱등성"]
summary: "Kafka 운영 중 발생한 주기적 재처리 문제를 계기로 offset commit의 동작 방식과 Spring Kafka AckMode의 종류별 특징을 정리합니다."
---

2024년 11월에 Kafka를 신규로 도입하여 약 1년간 운영하였습니다.

운영 기간 동안 다양한 신규 개발 건이 지속적으로 발생하면서, 데이터 재처리는 **Consumer가 아닌 Producer 측으로 재요청을 보내는 방식**으로 처리해 왔습니다.

Consumer는 멱등성을 보장하도록 **Upsert 방식**으로 구현되어 있었기 때문에, 동일 메시지가 재전송되더라도 데이터 정합성에는 문제가 없다는 전제하에 해당 방식을 선택하였습니다.

그러나 운영 결과, 예상보다 **API 구간에서 약 4개월 주기로 Connection Timeout이 발생**하였고, 이로 인해 **주기적인 재처리 작업이 필요한 상황**이 반복되었습니다.

단발성 이슈가 아닌 운영 관점에서 관리가 필요한 문제로 판단하였습니다.

## Offset Commit의 기본 개념

Kafka Consumer가 메시지를 처리한 후 offset을 commit한다는 것은 **Kafka의 내부 토픽인 `__consumer_offsets`에 처리 위치를 저장하는 행위**입니다. Consumer는 이 offset 값을 참조해서 다음에 읽어올 메시지의 위치를 파악합니다.

Commit 방식은 크게 **자동 커밋**과 **수동 커밋** 두 가지가 있으며, `enable.auto.commit` 설정으로 제어할 수 있습니다.

### Kafka 클라이언트의 자동 커밋 설정

### enable.auto.commit

> Setting enable.auto.commit means that offsets are committed automatically with a frequency controlled by the config auto.commit.interval.ms.
>
> 출처: [Kafka Official Documentation](https://kafka.apache.org/23/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)

- `enable.auto.commit=true` (기본값): 자동 커밋 활성화
- `enable.auto.commit=false`: 수동 커밋 모드

자동 커밋을 사용할 경우, `auto.commit.interval.ms`에 설정한 시간 간격마다 자동으로 offset이 commit됩니다.

```java
private Map<String, Object> consumerConfigs() {
    Map<String, Object> props = new HashMap<>();
    props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
    return configs;
}
```

## 자동 커밋의 문제점

`enable.auto.commit=true`로 설정하면 **메시지 처리 여부와 상관없이** 일정 시간이 지나면 자동으로 offset이 갱신됩니다. 이로 인해 두 가지 문제가 발생할 수 있습니다.

**1. 메시지 중복 처리**

poll로 가져온 메시지들을 아직 다 처리하지 못했고 commit 타이밍도 안 된 상황에서 오류가 발생하면, Consumer는 같은 메시지를 다시 가져와서 처리하게 됩니다.

**2. 메시지 유실**

poll로 가져온 메시지를 아직 다 처리하지 못한 상황에서 commit 타이밍이 되어 commit이 실행되고, 이후 메시지 처리 중 오류가 발생하면 처리하지 못한 메시지를 다시 읽어오지 않아 **유실**됩니다.

## Spring Kafka의 AckMode

이런 문제를 방지하기 위해 `enable.auto.commit=false`로 설정하면 Kafka 클라이언트의 자동 커밋이 비활성화됩니다.

**여기서 주의할 점!**

`enable.auto.commit=false`로 설정해도 offset commit이 정상적으로 일어나고 lag도 쌓이지 않는 것을 확인할 수 있습니다. **이는 Kafka 클라이언트의 자동 커밋은 비활성화되지만, Spring Kafka가 자체적으로 offset을 commit하기 때문입니다.**

Spring Kafka는 **AckMode** 설정을 통해 commit 방식을 제어하며, 기본값은 `BATCH`입니다.

- Kafka 클라이언트 자동 커밋과 달리 `auto.commit.interval.ms`의 영향을 받지 않음
- Listener 메서드가 완료되면 **배치 단위로 자동 commit** 실행

**진정한 수동 커밋을 위한 설정**

**결론적으로**, `enable.auto.commit=false`만으로는 충분하지 않습니다.

완전한 수동 커밋을 원한다면:

1. `enable.auto.commit=false` 설정
2. **AckMode 설정을 함께 사용**하여 Spring Kafka의 자동 commit까지 제어

이렇게 해야 진정한 의미의 수동 커밋을 구현할 수 있고, 메시지 처리 로직에 맞춰 정확한 시점에 offset을 commit할 수 있습니다.

## 그렇다면 왜? Spring Kafka는 자동 커밋을 기본으로 셋팅하는가?

Kafka의 설계 철학: "일단 동작하게"

Kafka Client의 `enable.auto.commit` 기본값이 `true`로 설정된 이유는 **Kafka의 설계 철학**과 사용자 경험을 이해하면 명확해집니다.

### 1. 진입 장벽을 낮추기 위한 선택

Kafka를 처음 사용하는 개발자도 쉽게 시작할 수 있도록 설계되었습니다.

기본값이 false였다면

```java
// 이렇게 작성하면
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        System.out.println(record.value());
    }
    // 커밋을 안 함 → 무한 반복으로 같은 메시지 재처리!
    // "왜 같은 메시지가 계속 나와요?" 질문 폭주
}
```

offset commit의 개념조차 모른 채 "왜 작동이 안 되지?"라고 할 수 있습니다.

상황에 맞는 선택이 중요합니다.

| 기준 | 자동 커밋(true) | 수동 커밋(false) |
| --- | --- | --- |
| **적합한 경우** | 로그 수집, 모니터링, 통계 | 금융, 결제, 재고, 알림 |
| **중복 처리** | 허용 가능 | 절대 불가 |
| **구현 난이도** | 쉬움 | 복잡함 |
| **성능** | 빠름 | 약간 느림 (수동 제어) |

## AckMode 종류와 특징

**RECORD**

- **커밋 시점**: 리스너가 각 레코드를 처리한 직후
- **특징**: 가장 안전하지만 성능이 가장 느림
- **사용 케이스**: 메시지 손실이 절대 허용되지 않는 중요한 트랜잭션

단점

- **최저 처리량**: 레코드마다 네트워크 I/O 발생
- **높은 브로커 부하**: 커밋 요청이 메시지 수만큼 증가
- **레이턴시 증가**: 커밋 대기 시간 누적
- **비효율적 리소스 사용**: CPU, 네트워크 대역폭 낭비

**BATCH (기본값)**

- **커밋 시점**: `poll()` 로 가져온 전체 배치 처리 완료 후
- **특징**: RECORD보다 성능 좋고, 안전성도 양호
- **사용 케이스**: 일반적인 배치 처리 시나리오

**단점**

- **배치 전체 재처리**: 중간 실패 시 처리된 메시지도 재처리됨
- **메모리 사용량**: 배치 크기만큼 메모리 필요
- **제한적인 제어**: 세밀한 커밋 제어 불가
- **중복 처리 가능성**: 배치 사이즈가 클수록 증가

**TIME**

- **커밋 시점**: 설정된 시간 간격마다
- **특징**: 주기적 커밋으로 성능과 안전성 균형
- **사용 케이스**: 대용량 스트림 처리

**COUNT**

- **커밋 시점**: 설정된 메시지 개수마다
- **특징**: 처리량 기반 커밋
- **사용 케이스**: 균일한 메시지 크기의 대량 처리

**COUNT_TIME**

- **커밋 시점**: COUNT 또는 TIME 중 먼저 도달하는 조건
- **특징**: COUNT + TIME의 조합
- **사용 케이스**: 메시지 유입량이 불규칙한 경우

**MANUAL**

- **커밋 시점**: 개발자가 `acknowledge()` 호출 시
- **특징**: 완전한 제어 가능
- **사용 케이스**: 복잡한 비즈니스 로직, 조건부 커밋

**MANUAL_IMMEDIATE**

- **커밋 시점**: `acknowledge()` 호출 즉시 카프카로 커밋
- **특징**: MANUAL과 달리 즉시 커밋 (배치 처리 없음)
- **사용 케이스**: 실시간성이 중요한 경우

성능과 안정성을 종합적으로 고려한 결과, 재처리 방식은 아래와 같이 결정했습니다.

안정성을 최우선으로 한다면 **RECORD 방식**이 가장 적합합니다. 다만 현재 상황에서는 **토픽 단위로 메시지를 수신하여 재처리하는 방식으로도 충분하다**고 판단했습니다.

재처리 과정에서 문제가 지속될 경우에는 **프로듀서 측에 해당 데이터를 재요청하여 처리**할 수 있습니다. 또한 현재 로직이 **멱등하게 설계되어 있기 때문에**, 전체적인 유연성과 운영 편의성을 고려했을 때 **MANUAL 방식이 가장 적합**하다고 판단했습니다.

재처리 로직은 **try-catch 블록을 활용해 재시도 횟수를 제한하는 방식**으로 구현할 예정입니다.
