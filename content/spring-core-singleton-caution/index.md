---
title: "싱글톤 방식의 주의점"
tags: ["Spring","싱글톤","무상태","StatefulService","스프링 빈"]
summary: "싱글톤 빈은 상태를 공유하기 때문에 무상태로 설계해야 한다는 점을 StatefulService 예제로 확인합니다."
---

## 싱글톤 패턴의 주의할 점

- 싱글톤 패턴은 객체 인스턴스를 하나만 생성해서 공유하는 방식이므로, 클라이언트가 하나의 같은 객체 인스턴스를 공유하기 때문에 상태를 유지하지 않도록 설계해야 합니다.
- 무상태(stateless)로 설계해야 합니다.
- 스프링 빈의 필드에 공유 값을 설정하면 정말 큰 장애가 발생할 수 있습니다!

## 객체 생성

예시 코드: StatefulService

```java
package hello.core.singleton;

public class StatefulService {
    private int price;//상태를 유지하는 필드

		public void order(String name, int price) {
        System.out.println("name = " + name + " price = " + price);
        this.price = price;//여기가 문제!
    }

    public int getPrice() {
        return price;
    }
}
```

## 빈을 등록 후 사용

예시 코드: StatefulServiceTest

```java
package hello.core.singleton;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;

public class StatefulServiceTest {
    @Test
    void statefulServiceSingleton() {
        ApplicationContext ac = new AnnotationConfigApplicationContext(TestConfig.class);
        StatefulService statefulService1 = ac.getBean("statefulService", StatefulService.class);
        StatefulService statefulService2 = ac.getBean("statefulService", StatefulService.class);
//ThreadA: A사용자 10000원 주문
        statefulService1.order("userA", 10000);
//ThreadB: B사용자 20000원 주문
        statefulService2.order("userB", 20000);
//ThreadA: 사용자A 주문 금액 조회int price = statefulService1.getPrice();
//ThreadA: 사용자A는 10000원을 기대했지만, 기대와 다르게 20000원 출력
        System.out.println("price = " + price);
        Assertions.assertThat(statefulService1.getPrice()).isEqualTo(20000);
    }

    static class TestConfig {
        @Bean
        public StatefulService statefulService() {
            return new StatefulService();
        }
    }
}
```

## 문제 발생

- 하나의 객체가 가진 공유 필드 안에 값을 세팅했기 때문에, 특정 클라이언트가 다른 클라이언트의 값을 변경하는 문제가 발생합니다.
- 사용자 A의 주문 금액은 10,000원인데 20,000원이라는 결과가 나왔습니다.
- 그래서 공유 필드는 항상 조심해야 합니다. 스프링 빈은 항상 무상태(stateless)로 설계해야 합니다.

## StatefulService와 StatefulServiceTest 수정

예시 코드: StatefulService

```java
package hello.core.singleton;

public class StatefulService {

    public int order(String name, int price) {
        System.out.println("name = " + name + " price = " + price);
        return price;//여기가 문제!
    }
}
```

예시 코드: StatefulServiceTest

```java
package hello.core.singleton;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;

public class StatefulServiceTest {
    @Test
    void statefulServiceSingleton() {
        ApplicationContext ac = new AnnotationConfigApplicationContext(TestConfig.class);
        StatefulService statefulService1 = ac.getBean("statefulService", StatefulService.class);
        StatefulService statefulService2 = ac.getBean("statefulService", StatefulService.class);
//ThreadA: A사용자 10000원 주문int price1 = statefulService1.order("userA", 10000);
//ThreadB: B사용자 20000원 주문int price2 = statefulService2.order("userB", 20000);
//ThreadA: 사용자A 주문 금액 조회//ThreadA: 사용자A는 10000원을 기대했지만, 기대와 다르게 20000원 출력
        System.out.println("price1 = " + price1);
        System.out.println("price1 = " + price2);
    }

    static class TestConfig {
        @Bean
        public StatefulService statefulService() {
            return new StatefulService();
        }
    }
}
```

스프링 빈을 무상태로 변경했습니다.

## 결론

이번 예시는 멀티 스레드를 사용하지 않아서 복잡하지 않았지만, 실제 실무에서는 싱글톤의 값을 변경함으로써 문제가 많이 발생한다고 합니다. 이를 명심하고 무상태로 만들 수 있게 주의해야 합니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
