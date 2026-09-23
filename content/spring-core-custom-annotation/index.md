---
title: "의존관계 주입 애노테이션 직접 만들기"
tags: ["Spring","의존성 주입","Qualifier","어노테이션","DiscountPolicy"]
summary: "문자열 기반 @Qualifier의 오타 위험을 없애기 위해 전용 애노테이션을 직접 만들어 타입 안전하게 의존관계를 주입하는 방법을 정리합니다."
---

@Qualifier("mainDiscountPolicy")처럼 문자로 적으면 컴파일 시 타입 체크가 되지 않습니다. 이렇게 될 경우 mainDisccountPolicy처럼 오타가 나도 해당 코드에 문제가 발생했는지 모르고 진행될 수 있습니다.

애노테이션을 직접 만들어서 이 부분을 개선해 보겠습니다.

## MainDiscountPolicy 애노테이션 만들기

애노테이션은 상속이라는 개념이 없습니다. 이렇게 여러 애노테이션을 모아서 사용하는 기능은 스프링이 지원해 주는 것입니다.

예시 코드: MainDiscountPolicy

```java
package hello.core.annotation;

import org.springframework.beans.factory.annotation.Qualifier;

import java.lang.annotation.*;

@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER,
        ElementType.TYPE, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Qualifier("mainDiscountPolicy")// 해당하는 애노테이션을 지정해준다.public @interface MainDiscountPolicy {

}
```

## 주입되는 Qualifier 수정하기

String이 아닌 애노테이션으로 변경하면 코드에 오타가 발생했을 때 바로 알아챌 수 있습니다.

이제 빈이 충돌 났을 때 위와 같이 @MainDiscountPolicy 애노테이션을 통해서 맞춰줄 수 있습니다.

변경 전

```java
@Autowired
public OrderServiceImpl(MemberRepository memberRepository,
						@Qualifier("mainDiscountPolicy") DiscountPolicy discountPolicy) {
     this.memberRepository = memberRepository;
     this.discountPolicy = discountPolicy;
}
```

변경 후

```java
@Autowired
public OrderServiceImpl(MemberRepository memberRepository,
						@MainDiscountPolicy DiscountPolicy discountPolicy)) {
     this.memberRepository = memberRepository;
     this.discountPolicy = discountPolicy;
}
```

## 결론

위와 같이 번거롭게 변경을 왜 해줘야 하는지 처음에는 와닿지 않았습니다.

하지만 String 자체는 컴파일 시 오류를 찾아내기가 너무 어렵기 때문에, 번거롭더라도 이렇게 애노테이션을 만들어서 사용하는 것을 적극 권장합니다.

다만 무엇보다 중요한 것은 적절한 위치에 @Qualifier와 @Primary를 사용하는 것이 제일 좋다는 점입니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
