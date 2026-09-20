---
title: "생성자 주입을 선택해야 하는 이유"
tags: ["Spring", "생성자주입", "DI", "Lombok", "RequiredArgsConstructor"]
summary: "수정자 주입 대신 생성자 주입을 권장하는 이유와, 롬복의 @RequiredArgsConstructor로 생성자 코드를 줄이는 방법을 정리합니다."
---

## DI를 사용할 때 생성자 주입을 선택해야 합니다

과거에는 수정자 주입과 필드 주입을 많이 사용했지만, 최근에는 스프링을 포함한 DI 프레임워크 대부분이 생성자 주입을 권장합니다. 그 이유는 다음과 같습니다.

**불변**

- 대부분의 의존관계 주입은 한 번 일어나면 애플리케이션 종료 시점까지 의존관계를 변경할 일이 없습니다. 오히려 대부분의 의존관계는 애플리케이션 종료 전까지 변하면 안 됩니다.
- 수정자 주입을 사용하면 setXxx 메서드를 public으로 열어두어야 합니다. 이는 누군가의 실수로 변경될 수도 있고, 변경하면 안 되는 메서드를 열어두는 것은 좋은 설계 방법이 아닙니다.
- 생성자 주입은 객체를 생성할 때 딱 1번만 호출되므로 이후에 호출되는 일이 없습니다. 따라서 불변하게 설계할 수 있습니다.

## 롬복 사용법

개발을 해보면, 두 부분이 다 불변이고, 그래서 다음과 같이 생성자에 final 키워드를 사용하게 됩니다.

그런데 생성자도 만들어야 하고, 주입받은 값을 대입하는 코드도 만들어야 하고, 필드 주입처럼 좀 더 편리하게 사용하는 방법은 없을까요?

역시 개발자는 귀찮은 것을 못 참습니다.

다음 기본 코드를 최적화해보겠습니다.

**1) build.gradle에 라이브러리 및 환경 추가**

```java
plugins {
     id 'org.springframework.boot' version '2.3.2.RELEASE'
     id 'io.spring.dependency-management' version '1.0.9.RELEASE'
     id 'java'
}

group = 'hello'
version = '0.0.1-SNAPSHOT'
sourceCompatibility = '11'

//lombok 설정 추가 시작
configurations {
    compileOnly {
    extendsFrom annotationProcessor
    }
}
//lombok 설정 추가 끝

repositories {
	mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter'
//lombok 라이브러리 추가 시작
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    testCompileOnly 'org.projectlombok:lombok'
    testAnnotationProcessor 'org.projectlombok:lombok'
//lombok 라이브러리 추가 끝
    testImplementation('org.springframework.boot:spring-boot-starter-test') {
    	exclude group: 'org.junit.vintage', module: 'junit-vintage-engine'
    }
}
test {
	useJUnitPlatform()
}
```

**2) 롬복 적용 및 사용법**

- @RequiredArgsConstructor : final이 붙은 필드를 모아서 생성자를 자동으로 만들어줍니다.
- @Setter, @Getter : 필드를 확인한 후 setter와 getter를 자동으로 만들어줍니다.
- 롬복을 통해서 생성자를 한 개 만들어줌으로써 자동으로 @Autowired가 걸립니다.

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
    private final DiscountPolicy discountPolicy;

/*@Autowired
    public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }*/@Override
    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        Member newMember = memberRepository.findById(memberId);
        int discountPrice = discountPolicy.discount(newMember, itemPrice);

        return new Order(memberId, itemName, itemPrice, discountPrice);
    }

// 테스트 용도public MemberRepository getMemberRepository() {
        return memberRepository;
    }
}
```

자동으로 Setter와 Getter를 만들어 주므로, 우리는 사용하기만 하면 됩니다.

예시 코드: Member

```java
package hello.core.member;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Member {

    private Long id;
    private String name;
    private Grade grade;

    public Member(Long id, String name, Grade grade) {
        this.id = id;
        this.name = name;
        this.grade = grade;
    }

/*public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Grade getGrade() {
        return grade;
    }

    public void setGrade(Grade grade) {
        this.grade = grade;
    }*/
}
```

> 결론
>

DI 의존성 주입은 생성자 주입을 통해서 넣는 것을 지향하는 게 좋습니다.

그리고 롬복을 사용하면 코드가 깔끔해지면서 관리하는 측면에서 편해집니다. 하지만 주의해야 할 점이 있습니다.

@Autowired가 없어도 의존성 주입이 잘되는 이유는 생성자가 1개일 때는 자동으로 Spring에서 @Autowired를 해주기 때문입니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
