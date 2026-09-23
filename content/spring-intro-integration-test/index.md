---
title: "스프링 통합 테스트"
tags: ["Spring","테스트 코드","@SpringBootTest","@Transactional","통합 테스트"]
summary: "@SpringBootTest와 @Transactional로 회원 서비스의 회원가입, 중복 검증, 조회 기능을 통합 테스트하는 과정을 정리합니다."
---

지금까지의 기능들을 테스트해보겠습니다.

1. test > java > hello.hellospring > service 경로에 MemberServiceIntegrationTest.java를 생성합니다.
2. @SpringBootTest: 스프링 부팅을 시작해줍니다.
3. @Transactional: DB 테스트 중 insert, update, delete 되는 기능을 확인한 후 롤백시켜줍니다. 테스트를 지속적으로 할 수 있게 유지시켜줍니다.

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemberRepository;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertThrows;

//이전에 실행 시켰던 것을 다시 재실행 shift + F10@SpringBootTest
@Transactional
class MemberServiceIntegrationTest {

    @Autowired MemberService memberService;
    @Autowired MemberRepository memberRepository;

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
    }

    @Test
    void 회원조회() {
        Member member1 = new Member();
        member1.setName("typark");
        memberService.findByName(member1.getName());
        Assertions.assertThat(memberService.findMembers().size()).isEqualTo(1);
    }
}
```

> 결론
>
> 이제 통합 테스트를 진행해봤습니다. @SpringBootTest와 @Transactional로 편하게 조회할 수 있을 뿐만 아니라, 이전 시간에 이야기했던 SpringConfig를 통해서 테스트 또한 따로 변경 없이 DB 접근 후 통합 테스트가 가능했습니다. 하지만 강사님이 이야기하는, 테스트를 잘하는 사람들은 메모리로 빠르게 단위 테스트를 한 후 마지막에 스프링에 접근해서 통합 테스트를 한다고 합니다. 물론 통합 테스트도 중요하지만, 진짜로 잘하는 개발자는 순수한 단위 테스트를 잘하는 개발자입니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
