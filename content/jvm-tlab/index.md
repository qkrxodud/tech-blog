---
title: "JVM TLAB (Thread Local Allocation Buffer)"
tags: ["JVM","TLAB","GC","Eden","메모리 할당"]
summary: "멀티스레드 환경에서 객체 할당 경합을 줄이는 JVM의 TLAB(Thread Local Allocation Buffer) 동작 원리와 주요 튜닝 플래그를 정리합니다."
---

## 1. TLAB이 왜 필요한가?

Java에서 `new` 키워드로 객체를 생성하면 JVM은 Heap 메모리에 공간을 할당합니다. 특히 Young Generation의 **Eden 영역**에 객체가 먼저 놓이게 됩니다.

싱글 스레드 환경에서는 문제가 없지만, **멀티 스레드 환경**에서는 심각한 문제가 생깁니다. 두 스레드가 동시에 메모리 할당을 요청하면 같은 메모리 블록을 받을 수 있기 때문입니다.

```text
Thread A ──▶ Eden [____할당 포인터____] ◀── Thread B
                    ↑ 두 스레드가 동시에 같은 위치 요청!
```

이를 해결하기 위한 단순한 방법은 **락(Lock)으로 동기화**하는 것이지만, 객체 생성이 매우 빈번한 Java 특성상 락 경합이 극심한 성능 병목이 됩니다.

## 2. TLAB의 개념

TLAB(Thread Local Allocation Buffer)은 Eden 내부에서 특정 스레드에게 **전용으로 할당된 영역**입니다. 즉, 해당 영역에는 오직 하나의 스레드만 새 객체를 할당할 수 있으며, 각 스레드는 자신만의 TLAB을 가집니다.

```text
┌──────────────────────────────────────────────┐
│                  Eden Space                  │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│  │  Thread-1  │ │  Thread-2  │ │ Thread-3 │  │
│  │   TLAB     │ │   TLAB     │ │  TLAB    │  │
│  └────────────┘ └────────────┘ └──────────┘  │
│         공유 Eden 영역 (Slow Allocation)       │
└──────────────────────────────────────────────┘
```

## 3. 핵심 동작 방식: Pointer Bump Allocation

가장 빈번한 "정상" 경로는 단순히 TLAB의 현재 커서(포인터)에 객체 크기를 더하고 진행하는 것입니다. 이 때문에 이 방식을 **"포인터 범프 할당(Pointer Bump Allocation)"**이라고도 합니다.

```java
// TLAB 내 객체 할당 의사 코드
Object allocate(size) {
    if (tlab.top + size <= tlab.end) {
        Object obj = tlab.top;
        tlab.top += size;  // 포인터만 이동! 동기화 불필요
        return obj;
    }
    // TLAB이 부족하면 다른 처리
}
```

이 방식의 핵심은 **동기화가 전혀 필요 없다**는 점입니다. 각 스레드가 자신만의 영역에서만 포인터를 움직이기 때문입니다.

## 4. TLAB 공간이 부족할 때: 4가지 선택지

객체를 할당하려는데 TLAB에 공간이 부족하면 JVM은 네 가지 선택을 할 수 있습니다. 첫째로 해당 스레드를 위해 새 TLAB 공간을 할당(TLAB 확장)하고, 둘째로 TLAB 외부(공유 Eden 영역)에서 해당 객체에 대한 메모리를 할당하며, 셋째로 GC를 통해 메모리 회수를 시도하고, 넷째로 메모리 할당에 실패하고 에러를 던집니다. 네 번째는 최악의 경우이며 JVM은 이를 최대한 피하려 합니다.

### TLAB Retirement (은퇴) 메커니즘

TLAB 남은 공간이 **임계값(Refill Waste)**보다 작으면, JVM은 현재 TLAB을 "은퇴(retire)"시키고 새 TLAB을 받아옵니다. 반대로 남은 공간이 임계값보다 크면, 큰 객체를 TLAB 외부(공유 Eden)에 직접 할당합니다(Slow Allocation).

기본적으로 이 임계값은 TLAB 크기의 1%이며, `-XX:TLABWasteTargetPercent=N` 플래그로 결정됩니다(기본값 1). Slow Allocation이 증가할수록 더 많은 Slow Allocation을 줄이기 위해 JVM은 이 값을 `-XX:TLABWasteIncrement=N`에 의해 결정된 값만큼 증가시킵니다(기본값 4).

## 5. TLAB 크기 결정 방식

기본적으로 TLAB은 각 스레드마다 동적으로 크기가 조정됩니다. TLAB 크기는 Eden의 크기, 스레드 수, 그리고 스레드별 할당 속도를 기반으로 재계산됩니다.

스레드가 종료될 때는 다음과 같이 처리됩니다.

- 이미 생성된 객체들은 Eden 영역에 그대로 남아 GC가 관리합니다.
- 남은 미사용 공간은 Eden에 반환되며, JVM이 GC가 힙을 파싱할 수 있도록 **더미(Filler) 객체**로 채웁니다.

## 6. 성능 효과

TLAB 없이 단일 스레드에서도 CAS(Compare-And-Swap) 원자 연산이 필요하기 때문에 TLAB을 사용했을 때 대비 성능이 절반 수준에 그칩니다. x86 코어에서 일반적인 store는 즉시 프로세서 캐시에 도달하지 않고 "스토어 버퍼"에 먼저 쓰이고 실행이 계속되는 반면, CAS 연산은 그렇지 않기 때문입니다.

실제 벤치마크에서 TLAB 활성화 시 단일 스레드로도 초당 약 2.5GB/s의 할당 속도, 16바이트 객체 기준 초당 1억 6천만 개의 객체를 생성할 수 있습니다.

## 7. 주요 JVM 플래그 정리

| 플래그 | 설명 | 기본값 |
| --- | --- | --- |
| `-XX:+UseTLAB` | TLAB 활성화 | true (기본 활성화) |
| `-XX:-UseTLAB` | TLAB 비활성화 | - |
| `-XX:TLABSize=N` | TLAB 초기 크기 설정 | 0 (자동) |
| `-XX:MinTLABSize=N` | TLAB 최소 크기 | - |
| `-XX:MaxTLABSize=N` | TLAB 최대 크기 | - |
| `-XX:TLABWasteTargetPercent=N` | Slow Allocation 임계값 (%) | 1 |
| `-XX:TLABWasteIncrement=N` | Slow Alloc 발생 시 임계값 증가량 | 4 |
| `-XX:TLABRefillWasteFraction=N` | TLAB 재충전 낭비 비율 | - |

## 8. TLAB 통계 확인 방법

GC 로그에서 TLAB 동작을 관찰할 수 있습니다.

```bash
# GC 로그 활성화
-XX:+PrintTLAB
-Xlog:gc+tlab=trace  # JDK 9 이상
```

로그 예시 해석은 다음과 같습니다.

```text
TLAB: gc thread: 0x... [id: 1234]
  desired_size: 491KB
  slow allocs: 7  waste 44%
  refills: 111
  waste: 0.1%
```

- `slow allocs`: TLAB 외부 할당 횟수 → 높으면 문제입니다.
- `refills`: TLAB 재충전 횟수입니다.
- `waste`: 낭비 비율 → 낮을수록 효율적입니다.

## 9. 실무에서 주의해야 할 점

**TLAB 외부 할당(Slow Allocation)이 많은 경우의 원인과 해결책**

1. **큰 배열/객체**: TLAB에 맞지 않는 큰 객체는 무조건 공유 Eden에 할당됩니다. → 객체 크기를 줄이거나 `MaxTLABSize`를 늘려볼 것
2. **스레드가 너무 많음**: 스레드 수가 많아지면 각 TLAB 크기가 작아져 자주 재충전이 필요합니다. → 스레드 풀 크기 조정
3. **할당 속도가 지나치게 높음**: GC 튜닝과 함께 Eden 크기(`Xmn`) 조정을 고려합니다.

> **핵심 정리**: TLAB은 기본적으로 활성화되어 있고 JVM이 자동으로 최적화하므로 대부분의 경우 건드릴 필요가 없습니다. 그러나 Slow Allocation 비율이 높거나 할당 관련 성능 이슈가 있을 때, TLAB 통계를 분석하여 객체 크기를 줄이거나 스레드/힙 튜닝을 하는 접근이 효과적입니다.

[What Is a TLAB or Thread-Local Allocation Buffer in Java? | Baeldung](https://www.baeldung.com/java-jvm-tlab)
