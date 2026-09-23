---
title: "프로토타입 스코프와 싱글톤 빈"
tags: ["Spring","빈스코프","싱글톤","ObjectProvider"]
summary: "싱글톤과 프로토타입 빈 스코프의 차이를 살펴보고, 싱글톤 빈이 프로토타입 빈을 주입받을 때 발생하는 문제를 예제로 정리합니다."
---

## 빈 스코프란

스코프는 번역 그대로 빈이 존재할 수 있는 범위를 뜻합니다.

스프링은 다음과 같은 다양한 스코프를 지원합니다.

- 싱글톤 : 기본 스코프, 스프링 컨테이너의 시작과 종료까지 유지되는 가장 넓은 범위의 스코프입니다.
- 프로토타입 : 스프링 컨테이너는 프로토타입 빈의 생성과 의존관계 주입까지만 관여하고 더는 관리하지 않는 매우 짧은 범위의 스코프입니다.
- 웹 관련 스코프
    - request : 웹 요청이 들어오고 나갈 때까지 유지되는 스코프입니다.
    - session : 웹 세션이 생성되고 종료될 때까지 유지되는 스코프입니다.
    - application : 웹의 서블릿 컨텍스트와 같은 범위로 유지되는 스코프입니다.

## 프로토타입 스코프

싱글톤 스코프의 빈을 조회하면 스프링 컨테이너는 항상 같은 인스턴스의 스프링 빈을 반환합니다. 반면에 프로토타입 스코프를 스프링 컨테이너에 조회하면 스프링 컨테이너는 항상 새로운 인스턴스를 생성해서 반환합니다.

**싱글톤 빈 요청**

1. 싱글톤 스코프의 빈을 스프링 컨테이너에 요청합니다.
2. 스프링 컨테이너는 본인이 관리하는 스프링 빈을 반환합니다.
3. 이후에 스프링 컨테이너에 같은 요청이 와도 같은 객체 인스턴스의 스프링 빈을 반환합니다.

**프로토타입 빈 요청 1**

1. 프로토타입 스코프의 빈을 스프링 컨테이너에 요청합니다.
2. 스프링 컨테이너는 이 시점에 프로토타입 빈을 생성하고, 필요한 의존관계를 주입합니다.

**프로토타입 빈 요청 2**

3. 스프링 컨테이너는 생성한 프로토타입 빈을 클라이언트에 반환합니다.

4. 이후에 스프링 컨테이너에 같은 요청이 오면 항상 새로운 프로토타입 빈을 생성해서 반환합니다.

**정리**

**핵심은 스프링 컨테이너는 프로토타입 빈을 생성하고, 의존관계 주입, 초기화까지만 처리한다는 것입니다.**

클라이언트에 빈을 반환하고, 이후 스프링 컨테이너는 생성된 프로토타입 빈을 관리하지 않습니다. 그래서 @PreDestroy 같은 종료 메서드가 호출되지 않습니다.

싱글톤 스코프 빈 테스트

```java
package hello.core.scope;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Scope;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import static org.assertj.core.api.Assertions.*;

public class SingletonTest {

    @Test
    public void singletonBeanFind() {
        AnnotationConfigApplicationContext ac = new AnnotationConfigApplicationContext(SingletonBean.class);
        SingletonBean singletonBean1 = ac.getBean(SingletonBean.class);
        SingletonBean singletonBean2 = ac.getBean(SingletonBean.class);
        System.out.println("singletonBean1 = " + singletonBean1);
        System.out.println("singletonBean2 = " + singletonBean1);
        assertThat(singletonBean1).isSameAs(singletonBean2);

        ac.close();
    }

    @Scope("singleton")
    static class SingletonBean {
        @PostConstruct
        public void init() {
            System.out.println("singletonBean. init");
        }

        @PreDestroy
        public  void destroy() {
            System.out.println("singletonBean. destroy");
        }
    }
}

```

실행결과

- 빈 초기화 메서드를 실행하고
- 같은 인스턴스의 빈을 조회하고
- 종료 메서드까지 정상 호출된 것을 확인할 수 있습니다.

프로토타입 스코프 빈 테스트

```java
package hello.core.scope;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Scope;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import static org.assertj.core.api.Assertions.assertThat;

public class prototypeTest {

    @Test
    public void prototypeBeanFind() {

        AnnotationConfigApplicationContext ac = new AnnotationConfigApplicationContext(ProtoTypeBean.class);
        System.out.println("find prototypeBean1");
        ProtoTypeBean protoTypeBean1 = ac.getBean(ProtoTypeBean.class);
        System.out.println("find prototypeBean2");
        ProtoTypeBean protoTypeBean2 = ac.getBean(ProtoTypeBean.class);
        System.out.println("protoTypeBean1 = " + protoTypeBean1);
        System.out.println("protoTypeBean2 = " + protoTypeBean2);
        assertThat(protoTypeBean1).isNotSameAs(protoTypeBean2);

        ac.close();
    }

    @Scope("prototype")
    static class ProtoTypeBean {

        @PostConstruct
        public void init() {
            System.out.println("prototypeBean. init");
        }

        @PreDestroy
        public  void destroy() {
            System.out.println("prototypeBean. destroy");
        }
    }
}
```

**실행결과**

- 프로토타입 빈의 특징을 정리하면 스프링 컨테이너에 요청할 때마다 새로 생성됩니다.
- 스프링 컨테이너는 프로토타입 빈의 생성과 의존관계 주입 그리고 초기화까지만 관여합니다.
- 종료 메서드가 호출되지 않습니다.
- 그래서 프로토타입 빈은 프로토타입 빈을 조회한 클라이언트가 관리해야 합니다. 종료 메서드에 대한 호출도 클라이언트가 직접 해야 합니다.

## 프로토타입 빈 - 싱글톤 빈과 함께 사용 시 문제점

스프링 컨테이너에 프로토타입 스코프의 빈을 요청하면 항상 새로운 객체 인스턴스를 생성해서 반환합니다. 하지만 싱글톤 빈과 함께 사용할 때는 의도한 대로 잘 동작하지 않으므로 주의해야 합니다.

**싱글톤에서 프로토타입 빈 사용 1**

- ClientBean은 싱글톤이므로, 보통 스프링 컨테이너 생성 시점에 함께 생성되고, 의존관계 주입도 발생합니다.
- ClientBean은 의존관계 자동 주입을 사용합니다. 주입 시점에 스프링 컨테이너에 프로토타입 빈을 요청합니다.
- 스프링 컨테이너는 프로토타입 빈을 생성해서 ClientBean에 반환합니다. 프로토타입 빈의 count 필드 값은 0입니다.
- 이제 ClientBean은 프로토타입 빈을 내부 필드에 보관합니다. (정확히는 참조값을 보관합니다.)

**싱글톤에서 프로토타입 빈 사용 2**

- 클라이언트 A는 ClientBean을 스프링 컨테이너에 요청해서 받습니다. 싱글톤이므로 항상 같은 ClientBean이 반환됩니다.
- 클라이언트 A는 ClientBean.logic()을 호출합니다.
- ClientBean은 prototypeBean의 addCount()를 호출해서 프로토타입 빈의 count를 증가시킵니다. count값이 1이 됩니다.

**싱글톤에서 프로토타입 빈 사용 3**

- 클라이언트 B는 clientBean을 스프링 컨테이너에 요청해서 받습니다. 싱글톤이므로 항상 같은 clientBean이 반환됩니다.
- 여기서 중요한 점이 있는데, ClientBean이 내부에 가지고 있는 프로토타입 빈은 이미 과거에 주입이 끝난 빈입니다. 주입 시점에 스프링 컨테이너에 요청해서 프로토타입 빈이 새로 생성된 것이지, 사용할 때마다 새로 생성되는 것이 아닙니다.
- 클라이언트 B는 clientBean.logic()을 호출합니다.
- clientBean은 prototypeBean의 addCount()를 호출해서 프로토타입 빈의 count를 증가시킵니다. 원래 count값이 1이었으므로 2가 됩니다.

테스트 코드

```java
package hello.core.scope;

import org.junit.jupiter.api.Test;
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
        assertThat(count2).isEqualTo(2);

    }

    static class ClientBean {
        private final PrototypeBean prototypeBean;
        @Autowired
        public ClientBean(PrototypeBean prototypeBean) {
            this.prototypeBean = prototypeBean;
        }
        public int logic() {
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

스프링은 일반적으로 싱글톤 빈을 사용하므로, 싱글톤 빈이 프로토타입 빈을 사용하게 됩니다. 그런데 싱글톤 빈은 생성 시점에만 의존관계 주입을 받기 때문에, 프로토타입 빈이 새로 생성되기는 하지만, 싱글톤 빈과 함께 계속 유지되는 것이 문제입니다.

## 결론

프로토타입 스코프는 스프링 컨테이너가 요청할 때마다 새로 생성됩니다.

또한 의존관계 주입과 초기화까지 관여합니다. 종료 메서드는 호출되지 않습니다.

그리고 특히 주의할 점은 싱글톤 빈과 함께 사용될 때 @Autowired로 프로토타입 스코프를 호출하면 주소값이 유지되면서, 한 개의 참조값으로만 설정된다는 것입니다.

이를 해결하기 위해 Provider를 사용하는데, 다음 장에서 살펴보겠습니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
