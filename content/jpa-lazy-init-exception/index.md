---
title: "LazyInitializationException이 나는 이유"
tags: ["JPA","LazyInitializationException","FetchType.LAZY","Transactional","Quartz"]
summary: "배치에서 Quartz로 실행할 때만 FetchType.LAZY 객체를 불러오지 못하고 LazyInitializationException이 발생한 원인과 해결 방법을 정리합니다."
---

오늘은 작업을 하다가 동료가 물어본 예외에 대해 정리하려고 합니다.

배치에서 `FetchType.LAZY`를 통해 데이터를 불러오고 있는 상황이었는데, 테스트 코드에서는 잘 작동했지만 Quartz를 통해 실행될 때만 `FetchType.LAZY`로 설정한 객체 값을 불러오지 못하는 문제가 발생했습니다(`LazyInitializationException` 발생).

작업하면서 오래 걸렸던 이유는 '테스트 코드에서는 잘 작동되는데, 왜 Quartz에서만 안 되는 것인가?'였습니다.

## FetchType.LAZY

기본적으로 `FetchType.LAZY`는 프록시 패턴을 기반으로, 실제로 조회될 때 값을 불러오는 방식입니다. 이렇게 함으로써 자원을 좀 더 효율적으로 사용할 수 있습니다. 사용하지 않는 객체까지 계속 불러온다면 메모리만 낭비하게 됩니다.

그렇다면 현재 문제점은 `@Transactional`이 동작하지 않고, `Lazy` 로딩을 사용해서 영속성 상태가 아닌 값을 불러오다 보니 프록시 패턴을 제대로 사용하지 못하고 있다는 것이었습니다.

이를 확인하기 위해 현재 사용하는 위치가 `@Controller`인지 `@Service`인지 확인했고, Quartz에서 실행되는 `@Component`에서 `@Transactional`이 선언되어 있었던 것을 발견했습니다. `@Service`에서 작동시키는 게 어떤지 의견을 드려 해결하게 되었습니다.

## 해결 방법

영속성 상태가 아닌 값을 레이지 로딩으로 불러올 때 발생하는 예외이며, 같은 문제가 발생한다면 다음과 같은 방법으로 해결할 수 있습니다.

1. 함수에 `@Transactional`을 선언
2. 즉시 로딩으로 변경 (`FetchType.EAGER`)
3. Spring 환경 설정 변경 → `spring.jpa.open-in-view=true` (기본값: false)
    - 다만 이 설정은 `@Transactional`이 종료되어도 세션을 컨트롤러 응답 시점까지 유지시키는 방법이라, 세션 유지 시간이 길어지기 때문에 권장하지 않는 방법입니다.
