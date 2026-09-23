---
title: "프로토타입과 싱글톤을 함께 쓸 때 Provider로 푸는 법"
tags: ["Spring","빈스코프","프로토타입","ObjectProvider","DL"]
summary: "싱글톤 빈이 프로토타입 빈을 매번 새로 받아 쓰지 못하는 문제를 ObjectProvider로 해결하는 방법을 정리합니다."
---

## ObjectFactory, ObjectProvider

의존관계를 외부에서 주입(DI)받는 게 아니라 이렇게 직접 필요한 의존관계를 찾는 것을 Dependency Lookup(DL), 의존관계 조회(탐색)라고 합니다.

지정한 빈을 컨테이너에서 대신 찾아주는 DL 서비스를 제공하는 것이 바로 ObjectProvider입니다. 참고로 과거에는 ObjectFactory가 있었는데, 여기에 편의 기능을 추가해서 ObjectProvider가 만들어졌습니다.

예시 코드: SingletonWithPrototypeTest1

```java
package hello.core.scope;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Scope;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import static org.assertj.core.api.Assertions.assertThat;

public class SingletonWithPrototypeTest1 {

    @Test
    void singletonClientUsePrototype() {
        AnnotationConfigApplicationContext ac = new AnnotationConfigApplicationContext(ClientBean.class, PrototypeBean.class);

        ClientBean clientBean1 = ac.getBean(ClientBean.class);
        int count1 = clientBean1.logic();
        assertThat(count1).isEqualTo(1);

        ClientBean clientBean2 = ac.getBean(ClientBean.class);
        int count2 = clientBean2.logic();
        assertThat(count2).isEqualTo(1);

    }

    static class ClientBean {
        @Autowired
        private ObjectProvider<PrototypeBean> prototypeBeanProvider;
        public int logic() {
            PrototypeBean prototypeBean = prototypeBeanProvider.getObject();
            prototypeBean.addCount();
            int count = prototypeBean.getCount();
            return count;
        }
    }

    @Scope("prototype")
    static class PrototypeBean {
        private int count = 0;
        public void addCount() {
            count++;
        }
        public int getCount() {
            return count;
        }
        @PostConstruct
        public void init() {
            System.out.println("PrototypeBean.init " + this);
        }
        @PreDestroy
        public void destroy() {
            System.out.println("PrototypeBean.destroy");
        }
    }

}

```

실행해보면 prototypeBeanProvider.getObject()를 통해서 항상 새로운 프로토타입 빈이 생성되는 것을 확인할 수 있습니다.

- ObjectProvider의 getObject()를 호출하면 내부에서는 스프링 컨테이너를 통해 해당 빈을 찾아서 반환합니다(DL).
- 스프링이 제공하는 기능을 사용하지만, 기능이 단순하므로 단위 테스트를 만들거나 mock 코드를 만들기가 훨씬 쉬워집니다.
- ObjectProvider는 지금 딱 필요한 DL 정도의 기능만 제공합니다.
- 특징 ObjectFactory: 기능이 단순, 별도의 라이브러리 필요 없음, 스프링에 의존
- ObjectProvider: ObjectFactory 상속, 옵션, 스트림 처리 등 편의 기능이 많고, 별도의 라이브러리 필요 없음, 스프링에 의존

## 결론

싱글톤 빈과 함께 사용할 때는 ObjectProvider를 사용하는 것을 권장합니다. 다만 Spring이 아닌 순수 자바에서 사용한다면 javax.inject.Provider를 사용해야 하는데, 거의 사용할 일이 없을 것 같으므로 이런 것이 있다는 정도만 인지하고 넘어갑니다. 그리고 무엇보다도 싱글톤과 함께 사용되는 프로토타입 빈이라면 ObjectProvider.getObject()를 통해서 가져와야 한다는 것을 기억해 둡니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
