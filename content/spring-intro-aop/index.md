---
title: "AOP가 필요한 상황, 사용법"
tags: ["Spring","AOP","Java","관심사 분리"]
summary: "함수 실행 시간 측정을 예로 삼아 핵심 로직과 공통 관심사를 분리하는 AOP의 필요성과 사용법을 정리합니다."
---

## 상황 발생

- '각각의 함수의 측정 시간을 알고 싶다'는 요청이 들어왔습니다.
- 여기서 핵심 프로세서와 공통 관심사항, 이렇게 2개로 나눠지게 됩니다. 함수 측정 + 프로세서 로직으로 아래 예시를 보겠습니다.

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

//test case 생성 alt + enter@Transactional
public class MemberService {

    private final MemberRepository memberRepository;

    @Autowired
    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

/**
     * 회원가입
     */public Long join(Member member) {
// alt + ctrl + v 함수 리턴 값을 변수로 자동완성// 같이 이름이 있는 중복 회원 Xlong start = System.currentTimeMillis();
        try {
            validateDuplicateMember(member);//중복 회원 검증
            memberRepository.save(member);
            return member.getId();
        } finally {
            long finish = System.currentTimeMillis();
            long timeMs = finish - start;
            System.out.println("join " + timeMs + "ms");
        }
    }

    public List<Member> findMembers() {
        long start = System.currentTimeMillis();
        try {
            return memberRepository.findAll();
        } finally {
            long finish = System.currentTimeMillis();
            long timeMs = finish - start;
            System.out.println("findMembers " + timeMs + "ms");
        }
    }

    public Optional<Member> findOne(Long memberId) {
        return memberRepository.findById(memberId);
    }

// alt + ctrl + shift + t 함수로 뽑아내기private void validateDuplicateMember(Member member) {
        memberRepository.findByName(member.getName())
                .ifPresent(m -> {
                    throw new IllegalStateException("이미 존재하는 회원입니다.");
                });
    }

    public Optional<Member> findByName(String name) {
        return memberRepository.findByName(name);
    }
}
```

처리 함수를 보면, 함수 시간 측정과 프로세서 로직이 섞여 있어서 유지보수가 힘들뿐더러, 함수의 시간을 초 단위로 보고 싶다는 요청이 오면 수정하는 데 너무 많은 시간이 소요될 것입니다. 하지만 AOP를 사용하면, 핵심 기능과 공통 관심사항을 나눠서 코드를 깔끔하게 정리할 수 있습니다.

## AOP 작성

- java 폴더의 hello.hellospring.aop 패키지에 TimeTraceAop.java를 작성합니다.
- @Aspect : 흩어진 관심사를 모듈화합니다.
- @Component : 자바 컨테이너에 등록합니다.
- @Around : 해당하는 영역에 AOP 패키지를 실행시킵니다.

```java
package hello.hellospring.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class TimeTraceAop {

    @Around("execution(* hello.hellospring..*(..))")
    public Object execute(ProceedingJoinPoint joinPoint) throws  Throwable {
        long start = System.currentTimeMillis();
        System.out.println(start);
        try {
            return joinPoint.proceed();
        } finally {
            long finish = System.currentTimeMillis();
            long timeMs = finish - start;
            System.out.println("END : " + joinPoint.toLongString() + "" + timeMs + "ms");
        }
    }
}
```

> 결론

우리는 이제 관심의 분리로 핵심 프로세서와 함수 시간 측정 함수를 분리하였습니다. 각각의 기능을 분리함으로써 유지보수에 엄청난 이점을 갖는 것뿐만 아니라, 개발 속도에서도 우위에 서 있을 수 있습니다. AOP 또한 클린 코드 11장에서 설명하다가 정리하였는데, 여기서 직접 사용해 보니 좀 더 이해하는 데 수월하였습니다.

좀 더 AOP에 자세하게 정리한 적이 있는데, 아래 URL을 확인해 보면 이해하는 데 많은 도움이 될 것입니다.

[https://cozing.tistory.com/54?category=1076708](https://cozing.tistory.com/54?category=1076708)

---

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
