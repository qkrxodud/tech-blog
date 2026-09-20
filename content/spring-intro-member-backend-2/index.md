---
title: "회원 관리 예제 — 백엔드 개발 (2)"
tags: ["Spring", "회원 관리", "Service", "JUnit", "의존성 주입"]
summary: "회원가입 중복 검증 로직을 담은 Service 계층을 구현하고, given-when-then 패턴으로 정상 케이스와 예외 케이스를 테스트합니다."
---

## 1. Service 구현

- Service를 구현하다 보면 비즈니스 네이밍과 비슷하다는 것을 알 수 있습니다. 그래야 기획자가 말하는 부분의 로직을 찾기가 쉽습니다.
- Model 같은 경우는 단순히 기계적으로 개발스럽게 만듭니다.

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemberRepository;
import hello.hellospring.repository.MemoryMemberRepository;

import java.util.List;
import java.util.Optional;

public class MemberService {
    MemberRepository memberRepository = new MemoryMemberRepository();

/**
     * 회원가입
     */public Long join(Member member) {
// alt + ctrl + v 함수 리턴 값을 변수로 자동완성// 같이 이름이 있는 중복 회원 X
        validateDuplicateMember(member);// 중복회원 검증this.memberRepository.save(member);
        return member.getId();
    }

    public List<Member> findMembers() {
        return memberRepository.findAll();
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
}
```

## 2. JUnit Test 구현

- Service를 구현했으므로 테스트 케이스를 작성합니다.
- test> java> hello.hellospring> repository> service> MemoryServiceTest.java

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemoryMemberRepository;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

//이전에 실행 시켰던 것을 다시 재실행 shift + F10class MemberServiceTest {
    MemberService memberService;
    MemoryMemberRepository memberRepository;

    @BeforeEach
    public void beforeEach() {
        memberRepository = new MemoryMemberRepository();
        memberService = new MemberService(memberRepository);
    }

    @AfterEach
    public void afterEach() {
        memberRepository.clearStore();
    }

    @Test
    void 회원가입() {
//given 주어주다
        Member member1 = new Member();
        member1.setName("hello");

// when 실행했을때
        memberService.join(member1);

// then 결과값
        Assertions.assertThat(memberService.findOne(member1.getId()).get().equals(member1));
    }

    @Test
    void 중복_회원_예외() {
//given 주어주다
        Member member1 = new Member();
        member1.setName("spring");

        Member member2 = new Member();
        member2.setName("spring");

// when 실행했을때
        memberService.join(member1);
//then
        assertThrows(IllegalStateException.class, ()-> memberService.join(member2));

/*
        try {
            memberService.join(member2);
            fail();
        } catch ( IllegalStateException e) {
            Assertions.assertThat(e.getMessage()).isEqualTo("이미 존재하는 회원입니다.");
        }
    */
    }

    @Test
    void 회원조회() {
        Member member1 = new Member();
        member1.setName("spring3");
        memberService.join(member1);
        Assertions.assertThat(memberService.findMembers().size()).isEqualTo(1);
    }

    @Test
    void findOne() {
        Member member1 = new Member();
        member1.setName("spring");
        memberService.join(member1);
        Assertions.assertThat(memberService.findOne(member1.getId()).get()).isEqualTo(member1);
    }
}
```

- 테스트 케이스는 잘되는 케이스도 있지만, 예외가 잘 나오는지도 확인해야 합니다. 이 때문에 예외 함수를 만들어서 해당 기능이 잘 작동하는지 확인합니다.
- assertThrows : Exception이 함수 내에서 지정한 IllegalStateException이 맞는지 확인합니다.
- @BeforeEach : @Test 함수 실행 전에 항상 실행시켜주는 함수입니다.
- beforeEach로 DI를 구현하고, 외부에서 생성자를 통해 만든 후 내부 클래스로 선언합니다.

DI에 대해서는 [이전에 작성한 글](https://cozing.tistory.com/53?category=1076708)에 좀 더 자세히 정리해 두었습니다.

> 결론
>
> 이를 통해서 Model, Service의 흐름을 익힐 수 있었고, 테스트 케이스를 통해서 예외까지 확인하는 방법을 알 수 있었습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
