---
title: "AppConfig 리팩터링"
tags: ["Spring","AppConfig","리팩터링","OCP","의존성 역전"]
summary: "중복이 있던 AppConfig를 리팩터링해 역할과 구현이 한눈에 드러나도록 정리하고, 그 과정에서 지켜지는 SOLID 원칙을 살펴봅니다."
---

## AppConfig 리팩터링 설명

현재 AppConfig를 보면 "중복"이 있고, "역할"에 따른 "구현"이 잘 보이지 않습니다.

한눈에 보일 수 있도록 수정해보겠습니다.

## AppConfig 코드 리팩터링

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
    
    public class AppConfig {
    
        public MemberService memberService() {
            return new MemberServiceImpl(memberRepository());
        }
    
        public OrderService orderService() {
            return new OrderServiceImpl(memberRepository(), discountPolicy());
        }
    
        public MemberRepository memberRepository() {
            return new MemoryMemberRepository();
        }
    
        public DiscountPolicy discountPolicy() {
            return new RateDiscountPolicy();
        }
    }
    ```
    

이렇게 코드를 사용 영역과 구성 영역으로 분리했습니다.

장점

- 중복 코드 제거와 리팩터링을 통해서 우리는 이제 구현이 어떻게 되어 있는지 한눈에 확인할 수 있으며, 어떻게 동작되는지 짐작할 수도 있게 되었습니다.
- OCP: 구성과 사용 영역을 분리함으로써 구성에서의 확장성이 용이해지고, 수정에는 닫혀 있게 설계되었습니다.
- SRP: 구현 객체를 생성하고 연결하는 책임은 AppConfig가 담당하고, 클라이언트 객체는 실행하는 책임만 담당합니다.
- DIP: 클라이언트 코드가 추상화 인터페이스에만 의존하도록 변경되었습니다.

> 결론
>

구성과 사용 영역을 분리해서 소스 코드의 확장성을 용이하게 만들고, 수정에는 닫혀 있어서 기획자의 정책 수정에도 언제든지 변경 가능한 소스 코드를 구현했습니다. Spring이 어떻게 탄생했는지 한 걸음 더 다가섰습니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
