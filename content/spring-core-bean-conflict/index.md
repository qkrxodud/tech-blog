---
title: "조회 빈이 2개 이상 충돌할 때"
tags: ["Spring", "의존관계주입", "Autowired", "Qualifier", "Primary"]
summary: "스프링에서 @Autowired로 조회한 빈이 2개 이상일 때 발생하는 충돌을 필드명 매칭, @Qualifier, @Primary로 해결하는 방법을 정리합니다."
---

@Autowired는 타입(Type)으로 조회합니다.

따라서 부모 클래스를 상속받은 자식 클래스라면 @Component를 통해 언제든지 충돌이 나는 경우가 발생할 수 있습니다.

다음 예를 살펴보겠습니다.

예시 코드: OrderServiceImpl, RateDiscountPolicy, FixDiscountPolicy

```java
package hello.core.order;

import hello.core.discount.DiscountPolicy;
import hello.core.member.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService{
    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

/*@Autowired
    public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }*/
@Override
    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        Member newMember = memberRepository.findById(memberId);
        int discountPrice = discountPolicy.discount(newMember, itemPrice);

        return new Order(memberId, itemName, itemPrice, discountPrice);
    }

// 테스트 용도
public MemberRepository getMemberRepository() {
        return memberRepository;
    }
}
```

```java
package hello.core.discount;

import hello.core.member.Grade;
import hello.core.member.Member;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.stereotype.Component;

@Component
public class RateDiscountPolicy implements DiscountPolicy{

    ...
}
```

```java
package hello.core.discount;

import hello.core.member.Grade;
import hello.core.member.Member;

@Componet
public class FixDiscountPolicy implements DiscountPolicy {
    private int discountFixAmount = 1000;

   ...
}
```

위와 같이 @Autowired가 걸려 있는 경우 DiscountPolicy 타입의 빈이 2개이므로 충돌이 발생합니다(NoUniqueBeanDefinitionException).

오류 메시지도 친절하게 하나의 빈을 기대했는데 fixDiscountPolicy와 rateDiscountPolicy 2개가 발견되었다고 알려줍니다.

이때 하위 타입으로 지정할 수도 있지만, 하위 타입으로 지정하는 것은 DIP를 위배하고 유연성이 떨어집니다.

조회 대상 빈이 2개 이상일 때 해결 방법

- @Autowired 필드명 매칭
- @Qualifier끼리 매칭 → 빈 이름 매칭
- @Primary 사용

**[해결 방법 1] - @Autowired 필드명 매칭**

- @Autowired는 타입 매칭을 시도한 후 빈이 2개 이상이면 파라미터 이름으로 빈 이름을 매칭합니다.
- 다음 예시를 보면 DiscountPolicy를 상속받은 두 클래스(FixDiscountPolicy와 RateDiscountPolicy)에 둘 다 @Component를 등록했지만, 2개가 발견된 후 필드명과 매칭되는 rateDiscountPolicy가 실행됩니다.

**결론(스캔 순서):** 타입 조회 → 2개 이상 발견 → 필드명과 매칭되는 클래스 연결

예시 코드: OrderServiceImpl

```java
package hello.core.order;

import hello.core.discount.DiscountPolicy;
import hello.core.member.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService{
    private final MemberRepository memberRepository;
    private final DiscountPolicy rateDiscountPolicy;// 필드명을 수정

	...
}
```

**[해결 방법 2] - @Qualifier 사용**

@Qualifier는 추가 구분자를 붙여주는 방법입니다.

주입 시 추가적인 방법을 제공하는 것이지 빈 이름을 변경하는 것은 아닙니다.

1) 빈 등록 시 @Qualifier를 붙여줍니다.

```java
@Component
@Qualifier("mainDiscountPolicy")
public class RateDiscountPolicy implements DiscountPolicy {}
```

```java
@Component
@Qualifier("fixDiscountPolicy")
public class FixDiscountPolicy implements DiscountPolicy {}
```

2) 주입 시 @Qualifier를 붙여주고 등록한 이름을 적어줍니다.

```java
@Autowired
public OrderServiceImpl(MemberRepository memberRepository,
						@Qualifier("mainDiscountPolicy") DiscountPolicy discountPolicy) {
     this.memberRepository = memberRepository;
     this.discountPolicy = discountPolicy;
}
```

**결론(스캔 순서):** @Qualifier끼리 매칭 → 빈 이름 매칭 → 둘 다 없으면 NoSuchBeanDefinitionException 발생

**[해결 방법 3] - @Primary 설정**

@Primary는 우선순위를 정하는 방법입니다. @Autowired 시 여러 빈이 매칭되면 @Primary가 우선권을 가집니다.

1) 빈 등록 시 @Primary를 붙여줍니다.

```java
@Component
@Primary
public class RateDiscountPolicy implements DiscountPolicy {}

@Component
public class FixDiscountPolicy implements DiscountPolicy {}
```

2) 사용 코드

```java
//생성자@Autowired
public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
    this.memberRepository = memberRepository;
    this.discountPolicy = discountPolicy;
}

//수정자@Autowired
public DiscountPolicy setDiscountPolicy(DiscountPolicy discountPolicy) {
    return discountPolicy;
}
```

코드를 실행하면 @Primary를 등록한 빈이 실행되는 것을 확인할 수 있습니다.

그렇다면 @Primary와 @Qualifier 중 어떤 것을 사용하면 좋을지 고민이 될 수 있습니다.

@Qualifier의 단점은 주입받을 때 다음과 같이 모든 코드에 @Qualifier를 붙여줘야 한다는 점입니다.

```java
@Autowired
public OrderServiceImpl(MemberRepository memberRepository, @Qualifier("mainDiscountPolicy") DiscountPolicy discountPolicy) {
    this.memberRepository = memberRepository;
    this.discountPolicy = discountPolicy;
}
```

**@Primary, @Qualifier 활용**

- 코드에서 자주 사용하는 메인 데이터베이스의 커넥션을 획득하는 스프링 빈이 있고,
- 코드에서 특별한 기능으로 가끔 사용하는 서브 데이터베이스의 커넥션을 획득하는 스프링 빈이 있다고 가정해보겠습니다.
- 메인 데이터베이스의 커넥션을 획득하는 스프링 빈은 @Primary를 적용해서 조회하는 곳에서 @Qualifier 지정 없이 편리하게 조회하고,
- 서브 데이터베이스 커넥션 빈을 획득할 때는 @Qualifier를 지정해서 명시적으로 획득하는 방식으로 사용하면 코드를 깔끔하게 유지할 수 있습니다.
- 물론 이때 메인 데이터베이스의 스프링 빈을 등록할 때 @Qualifier를 지정해주는 것도 상관없습니다.

**우선순위**

@Primary는 기본값처럼 동작하고, @Qualifier는 매우 상세하게 동작합니다.

이런 경우 어떤 것이 우선권을 가져갈까요? 스프링은 자동보다는 수동이, 넓은 범위의 선택권보다는 좁은 범위의 선택권이 우선순위가 높습니다. 따라서 여기서도 @Qualifier가 우선권이 높습니다.

## 결론

이번에는 @Component가 2개 이상으로 충돌이 났을 때 대처 방법을 정리했습니다.

강의에서 무엇보다 중요했던 것은 애매한 것보다 확실한 것을 사용해야 한다는 점이었습니다.

예를 들어 위와 같이 @Qualifier끼리 매칭하고 없을 때 빈 이름으로 매칭한다고 해서 빈 이름만으로 등록할 경우, 추후 발생하는 오류를 찾기가 더 힘들어질 수 있습니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
