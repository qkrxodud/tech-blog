---
title: "빈 생명주기 콜백"
tags: ["Spring","스프링 빈","PostConstruct","PreDestroy","InitializingBean"]
summary: "스프링 빈의 생명주기와 초기화·소멸 콜백을 인터페이스, 설정 정보, @PostConstruct/@PreDestroy 세 가지 방식으로 비교해 정리합니다."
---

## 빈 생명주기 콜백 시작

데이터베이스 커넥션 풀이나, 네트워크 소켓처럼 애플리케이션 시작 시점에 필요한 연결을 미리 해두고, 애플리케이션 종료 시점에 연결을 모두 종료하는 작업을 진행하려면 객체의 초기화와 종료 작업이 필요합니다.

간단하게 외부 네트워크에 미리 연결하는 객체를 생성한다고 가정해보겠습니다. 단순히 문자만 출력하도록 했습니다.

다음 예제를 보겠습니다.

1) 네트워크 클라이언트 객체 생성

```java
package hello.core.lifecycle;

public class NetworkClient {
    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url" + url);
        connect();
        call("초기화 연결 메세지");
    }

    public void setUrl(String url) {
        this.url = url;
    }

//서비스를 시작시 호출
	 public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("client: " + url + " message = " + message);
    }

//서비스를 시작시 호출
		public void disConnect() {
        System.out.println("close: " + url);
    }
}
```

2) 빈 생명주기 클라이언트 테스트 생성

```java
package hello.core.lifecycle;
import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
public class BeanLifeCycleTest {
    @Test
    public void lifeCycleTest() {
        ConfigurableApplicationContext ac = new
                AnnotationConfigApplicationContext(LifeCycleConfig.class);
        NetworkClient client = ac.getBean(NetworkClient.class);
        ac.close();//스프링 컨테이너를 종료, ConfigurableApplicationContext 필요
    }

    @Configuration
    static class LifeCycleConfig {
        @Bean
        public NetworkClient networkClient() {
            NetworkClient networkClient = new NetworkClient();
            networkClient.setUrl("http://hello-spring.dev");
            return networkClient;
        }
    }
}
```

실행해보면 다음과 같이 null 값으로 나옵니다.

```java
생성자 호출, url = null
connect: null
call: null message = 초기화 연결 메시지
```

객체를 생성한 다음 외부에서 수정자 주입을 통해서 setUrl()이 호출되어야 url이 존재하게 됩니다.

스프링 빈은 간단하게 다음과 같은 라이프사이클을 가집니다.

**객체 생성 -> 의존관계 주입**

스프링 빈은 객체를 생성하고, 의존관계 주입이 다 끝난 다음에야 필요한 데이터를 사용할 수 있는 준비가 완료됩니다. 따라서 초기화 작업은 의존관계 주입이 모두 완료되고 난 다음에 호출해야 합니다. 그런데 개발자가 의존관계 주입이 모두 완료된 시점을 어떻게 알 수 있을까요? 스프링은 의존관계 주입이 완료되면 스프링 빈에게 콜백 메서드를 통해서 초기화 시점을 알려주는 다양한 기능을 제공합니다. 또한 스프링은 스프링 컨테이너가 종료되기 직전에 소멸 콜백을 줍니다. 따라서 안전하게 종료 작업을 진행할 수 있습니다.

**스프링 빈의 이벤트 라이프사이클**

**스프링 컨테이너 생성 -> 스프링 빈 생성 -> 의존관계 주입 -> 초기화 콜백 -> 사용 -> 소멸 전 콜백 -> 스프링 종료**

- 초기화 콜백 : 빈이 생성되고, 빈 의존관계 주입이 완료된 후 호출
- 소멸전 콜백 : 빈이 소멸되기 직전에 호출

> 참고
>
> 생성자는 필수 정보(파라미터)를 받고, 메모리를 할당해서 객체를 생성하는 책임을 가집니다. 반면에 초기화는 이렇게 생성된 값들을 활용해서 외부 커넥션을 연결하는 등 무거운 동작을 수행합니다.
>
> 따라서 생성자 안에서 무거운 초기화 작업을 함께 하는 것보다는 객체를 생성하는 부분과 초기화하는 부분을 명확하게 나누는 것이 유지보수 관점에서 좋습니다.

## 스프링은 크게 3가지 방법으로 빈 생명주기 콜백을 지원합니다

- 인터페이스(InitializingBean, DisposableBean)
- 설정 정보에 초기화 메서드, 종료 메서드 지정
- @PostConstruct, @PreDestroy 애노테이션 지원

**1) 인터페이스 InitializingBean, DisposableBean**

- InitializingBean : afterPropertiesSet() 메서드로 초기화를 지원합니다.
- DisposableBean : destroy() 메서드로 소멸을 지원합니다.

**단점**

- 스프링 전용 인터페이스입니다.
- 초기화, 소멸 메서드의 이름을 변경할 수 없습니다.
- 내가 코드를 고칠 수 없는 외부 라이브러리에 적용할 수 없습니다.

```java
package hello.core.lifecycle;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;

public class NetworkClient implements InitializingBean, DisposableBean {
    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url" + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

//서비스를 시작시 호출public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("client: " + url + " message = " + message);
    }

//서비스를 시작시 호출public void disConnect() {
        System.out.println("close: " + url);
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        connect();
        call("초기화 연결 메시지");
    }

    @Override
    public void destroy() throws Exception {
        disConnect();
    }

}
```

**2) 빈등록 초기화, 소멸 메서드 지정**

**설정 정보 사용 특징**

- 메서드 이름을 자유롭게 줄 수 있습니다.
- 스프링 빈이 스프링 코드에 의존하지 않습니다.
- **코드가 아니라 설정 정보를 사용하기 때문에 코드를 고칠 수 없는 외부 라이브러리에도 초기화, 종료 메서드를 적용할 수 있습니다.**

**종료 메서드 추론**

- @Bean의 destroyMethod 속성에는 아주 특별한 기능이 있습니다.
- 라이브러리는 대부분 close, shutdown이라는 이름의 종료 메서드를 사용합니다.
- @Bean의 destroyMethod는 기본값이 (inferred)(추론)으로 등록되어 있습니다. 이 추론 기능은 close, shutdown라는 이름의 메서드를 자동으로 호출해줍니다.
- 이름 그대로 종료 메서드를 추론해서 호출해줍니다. 따라서 직접 스프링 빈으로 등록하면 종료 메서드는 따로 적어주지 않아도 잘 동작합니다.
- 추론 기능을 사용하기 싫으면 destroyMethod="" 처럼 빈 공백을 지정하면 됩니다.

```java
package hello.core.lifecycle;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;

public class NetworkClient {
    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url" + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

//서비스를 시작시 호출public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("client: " + url + " message = " + message);
    }

//서비스를 시작시 호출public void disConnect() {
        System.out.println("close: " + url);
    }

    public void init() {
        System.out.println("NetworkClient.init");
        connect();
        call("초기화 연결 메시지");
    }
    public void close() {
        System.out.println("NetworkClient.close");
        disConnect();
    }

}
```

```java
package hello.core.lifecycle;
import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
public class BeanLifeCycleTest {
    @Test
    public void lifeCycleTest() {
        ConfigurableApplicationContext ac = new
                AnnotationConfigApplicationContext(LifeCycleConfig.class);
        NetworkClient client = ac.getBean(NetworkClient.class);
        ac.close();//스프링 컨테이너를 종료, ConfigurableApplicationContext 필요
    }

    @Configuration
    static class LifeCycleConfig {
        @Bean(initMethod = "init", destroyMethod = "close")
        public NetworkClient networkClient() {
            NetworkClient networkClient = new NetworkClient();
            networkClient.setUrl("http://hello-spring.dev");
            return networkClient;
        }
    }
}
```

**3) 애노테이션 @PostConstruct, @PreDestroy**

**@PostConstruct, @PreDestroy 애노테이션 특징**

- 최신 스프링에서 가장 권장하는 방법입니다.
- 애노테이션 하나만 붙이면 되므로 매우 편리합니다.
- 패키지를 잘 보면 javax.annotation.PostConstruct입니다. 스프링에 종속적인 기술이 아니라 JSR-250라는 자바 표준입니다. 따라서 스프링이 아닌 다른 컨테이너에서도 동작합니다.
- 컴포넌트 스캔과 잘 어울립니다.
- 유일한 단점은 외부 라이브러리에는 적용하지 못한다는 것입니다. 외부 라이브러리를 초기화, 종료해야 하면 @Bean의 기능을 사용합시다.

**정리**

- **@PostConstruct, @PreDestroy 애노테이션을 사용합시다**
- **코드를 고칠 수 없는 외부 라이브러리를 초기화, 종료해야 하면 @Bean의 initMethod, destroyMethod를 사용합시다**

```java
package hello.core.lifecycle;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

public class NetworkClient {
    private String url;

    public NetworkClient() {
        System.out.println("생성자 호출, url" + url);
    }

    public void setUrl(String url) {
        this.url = url;
    }

//서비스를 시작시 호출public void connect() {
        System.out.println("connect: " + url);
    }

    public void call(String message) {
        System.out.println("client: " + url + " message = " + message);
    }

//서비스를 시작시 호출public void disConnect() {
        System.out.println("close: " + url);
    }

    @PostConstruct
    public void init() {
        System.out.println("NetworkClient.init");
        connect();
        call("초기화 연결 메시지");
    }

    @PreDestroy
    public void close() {
        System.out.println("NetworkClient.close");
        disConnect();
    }

}
```

## 결론

빈의 라이프사이클을 잘 파악할 수 있었고, 특히 생성자와 초기화를 어떻게 적절히 사용하면 좋은지 전달해 주신 게 좋았던 것 같습니다. 해당하는 이유 없이 라이프사이클을 통해서 초기화를 한다면, 왜 사용하는지 파악이 힘들었을 것 같습니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
