---
title: "컴포넌트 스캔과 자동 의존관계 설정"
tags: ["Spring","컴포넌트 스캔","의존성 주입","스프링 빈","자동 의존관계"]
summary: "@Component 애노테이션이 붙은 클래스를 스프링 빈으로 자동 등록하고, 생성자를 통해 의존관계를 자동으로 주입받는 컴포넌트 스캔 방식을 정리합니다."
---

스프링 빈을 등록하고, 의존관계를 설정합니다.

회원 컨트롤러가 회원 서비스와 레포지토리를 사용할 수 있도록 의존관계를 설정해보겠습니다.

## 컴포넌트 스캔

컴포넌트 스캔은 다음과 같은 순서로 이루어집니다.

1. 스프링이 시작되면 스프링 컨테이너가 생성됩니다.
2. 이후 스프링이 @Component를 사용하는 클래스들을 스캔한 후 빈 형식으로 스프링 컨테이너에 올려놓습니다. 이를 스프링 빈을 등록한다고 합니다.
3. 빈을 등록하면 싱글톤 형식으로, 사용자가 원하는 곳에 스프링이 DI를 통해서 직접 넣어줍니다.

@Service, @Controller, @Repository 내부에는 @Component가 포함되어 있기 때문에 빈으로 등록될 수 있습니다.

내부에 @Component를 통해서 스캔해 등록하는 것이기 때문에, 이를 컴포넌트 스캔 방식이라고 스프링에서는 말합니다.

```java
package hello.hellospring.controller;

import hello.hellospring.service.MemberService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

@Controller
public class MemberController {

//스프링 컨테이너에 등록 하고 사용하는게좋다.private final MemberService memberService;

// DI를 통해서 스프링 컨테이너에서 넣어준다.@Autowired
    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }
}
```

위 소스를 보면 생성자를 통해서 MemberService를 주입해주는 로직을 볼 수 있습니다.

이는 @Service 내부에 @Component가 선언되어 있고, 스프링 컨테이너에 빈을 등록해 두었기 때문에 컨트롤러에서 Service를 생성하지 않고 의존성 주입을 받을 수 있는 것입니다.

```java
package hello.hellospring.service;

import hello.hellospring.domain.Member;
import hello.hellospring.repository.MemberRepository;
import hello.hellospring.repository.MemoryMemberRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

//test case 생성 alt + enter@Service
public class MemberService {
	private final MemberRepository memberRepository;

    @Autowired
    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }
    ...
}
```

위 MemberRepository도 @Repository로 내부에 @Component가 선언되어 있기 때문에 빈에 등록하고 사용할 수 있습니다.

```java
package hello.hellospring.repository;

import hello.hellospring.domain.Member;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
public class MemoryMemberRepository implements MemberRepository{
	...
}
```

> 결론
>
> 스프링 컨테이너에 @Component를 스캔하고 등록하면, 위와 같이 생성자에서 new를 쓰지 않고 DI를 통해서 싱글톤 방식으로 하나의 객체를 사용할 수 있다는 것을 알 수 있습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
