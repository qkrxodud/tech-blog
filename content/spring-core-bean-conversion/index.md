---
title: "스프링 빈으로 전환하기"
tags: ["Spring","스프링 빈","Configuration","Bean","ApplicationContext"]
summary: "순수 자바 코드로 작성했던 AppConfig를 @Configuration과 @Bean으로 전환해 스프링 컨테이너에 빈을 등록하는 과정을 정리합니다."
---

지금까지 순수한 자바 코드만으로 DI를 적용했는데, 이제 스프링으로 전환해보겠습니다.

## AppConfig.java 수정

- @Configuration : 스프링에게 설정 정보를 제공합니다.
- @Bean : 스프링 컨테이너에 해당하는 빈을 등록합니다.
- Code
    
    ```java
    package hello.core;
    
    import hello.core.discout.DiscountPolicy;
    import hello.core.discout.RateDiscountPolicy;
    import hello.core.member.MemberRepository;
    import hello.core.member.MemberService;
    import hello.core.member.MemberServiceImpl;
    import hello.core.member.MemoryMemberRepository;
    import hello.core.order.OrderService;
    import hello.core.order.OrderServiceImpl;
    import org.springframework.context.annotation.Bean;
    import org.springframework.context.annotation.Configuration;
    
    @Configuration
    public class AppConfig {
    
        @Bean
        public MemberService memberService() {
            return new MemberServiceImpl(memberRepository());
        }
    
        @Bean
        public OrderService orderService() {
            return new OrderServiceImpl(memberRepository(), discountPolicy());
        }
    
        @Bean
        public MemberRepository memberRepository() {
            return new MemoryMemberRepository();
        }
    
        @Bean
        public DiscountPolicy discountPolicy() {
            return new RateDiscountPolicy();
        }
    }
    ```
    

실행 시 로그를 보면 Spring 라이브러리를 등록한 다음 Spring 컨테이너에 함수명이 빈으로 등록되는 것을 확인할 수 있습니다.

## 스프링 컨테이너에 등록된 빈을 조회합니다

- 이제 스프링 프레임워크가 제공해주는 클래스를 통해서 객체를 사용할 수 있습니다. (DI를 통해서)
- ApplicationContext를 스프링 컨테이너라고 합니다.
- ApplicationContext는 인터페이스입니다.
- applicationContext에 애노테이션 기반의 Config를 사용하겠다고 선언했습니다.
- Code
    
    ```java
    package hello.core;
    
    import hello.core.member.Grade;
    import hello.core.member.Member;
    import hello.core.member.MemberService;
    import hello.core.member.MemberServiceImpl;
    import hello.core.order.Order;
    import hello.core.order.OrderService;
    import hello.core.order.OrderServiceImpl;
    import org.springframework.context.ApplicationContext;
    import org.springframework.context.annotation.AnnotationConfigApplicationContext;
    
    public class OrderApp {
        public static void main(String[] args) {
    
            ApplicationContext applicationContext = new AnnotationConfigApplicationContext(AppConfig.class);
            MemberService memberService = applicationContext.getBean("memberService", MemberService.class);
            OrderService orderService = applicationContext.getBean("orderService", OrderService.class);
    
            Long memberId = 1L;
            Member memberA = new Member(memberId, "memberA", Grade.VIP);
            memberService.join(memberA);
    
            Order order = orderService.createOrder(memberId,"itemA", 100000);
    
            System.out.println("Order = " + order.toString());
        }
    }
    ```
    

> 결론
>

순수 자바로 구현했던 것을 Spring으로 구현하는 중이며, Spring 컨테이너에 빈으로 등록할 때 주의할 점을 자세히 알아보겠습니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
