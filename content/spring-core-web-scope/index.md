---
title: "웹 스코프"
tags: ["Spring","빈스코프","웹스코프","request스코프","CGLIB프록시"]
summary: "웹 스코프와 request 스코프의 동작 방식을 살펴보고, ObjectProvider와 CGLIB 프록시로 스코프 문제를 해결하는 방법을 정리합니다."
---

지금까지 싱글톤과 프로토타입 스코프를 학습했습니다. 싱글톤은 스프링 컨테이너의 시작과 끝까지 함께하는 매우 긴 스코프이고, 프로토타입은 생성과 의존관계 주입, 그리고 초기화까지만 진행하는 특별한 스코프입니다.

이번에는 웹 스코프에 대해서 알아보겠습니다.

웹 스코프의 특징

- 웹 스코프는 웹 환경에서만 동작합니다.
- 웹 스코프는 프로토타입과 다르게 스프링이 해당 스코프의 종료 시점까지 관리합니다. 따라서 종료 메서드가 호출됩니다.

웹 스코프 종류

- request: HTTP 요청 하나가 들어오고 나갈 때까지 유지되는 스코프이며, 각각의 HTTP 요청마다 별도의 빈 인스턴스가 생성되고 관리됩니다.
- session: HTTP Session과 동일한 생명주기를 가지는 스코프입니다.
- application: 서블릿 컨텍스트(ServletContext)와 동일한 생명주기를 가지는 스코프입니다.
- websocket: 웹 소켓과 동일한 생명주기를 가지는 스코프입니다.

사실 세션이나, 서블릿 컨텍스트, 웹 소켓 같은 용어를 잘 모르는 분들도 있을 것입니다. 여기서는 request 스코프를 예제로 설명하겠습니다. 나머지도 범위만 다르지 동작 방식은 비슷합니다.

## HTTP request 요청 당 각각 할당되는 request 스코프

## request 스코프 예제 만들기

웹 환경 추가

build.gradle

> //web 라이브러리 추가

- 기대하는 공통 포맷: [UUID][requestURL] {message}
- UUID를 사용해서 HTTP 요청을 구분합니다.
- requestURL 정보도 추가로 넣어서 어떤 URL을 요청해서 남은 로그인지 확인합니다.

## 스코프와 Provider

1) MyLogger 만들기

```kotlin
package hello.core.common;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.UUID;

@Component
@Scope(value = "request")// "request"public class MyLogger {
    private String uuid;
    private String requestURL;

    public void setRequestURL (String requestURL) {
        this.requestURL  = requestURL;
    }

    public void log(String message) {
        System.out.println("[" + uuid + "]" + "[" + requestURL + "]"
         +  message);
    }

    @PostConstruct
    public void init() {
        uuid = UUID.randomUUID().toString();
        System.out.println("[" + uuid + "] request scope bean create:" + this);
    }

    @PreDestroy
    public void close() {
        System.out.println("[" + uuid + "] request scope bean close:" + this);
    }

}

```

2) LogDemoService 만들기

- request 스코프는 HTTP 요청이 들어오고 나가는 것까지의 로직이기 때문에 스프링이 시작될 때 빈으로 등록이 안 되어 있으므로, @Autowired를 통해서 등록을 못 시키는 오류가 발생합니다.
- 이를 해결하기 위해서 ObjectProvider를 사용해 아래와 같이 DL(Dependencies LookUp)을 사용해줘야 합니다.

```java
package hello.core.web;

import hello.core.common.MyLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LogDemoService {
    private final ObjectProvider<MyLogger> myLoggerProvider;

    public void logic(String id) {
        MyLogger myLogger = myLoggerProvider.getObject();
        myLogger.log("service id = " + id);
    }
}
```

3) LogDemoController 만들기

```java
package hello.core.web;

import hello.core.common.MyLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;

@Controller
@RequiredArgsConstructor
public class LogDemoController {
    private final LogDemoService logDemoService;
    private final ObjectProvider<MyLogger> myLoggerObjectProvider;

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        String requestURL = request.getRequestURL().toString();
        MyLogger myLogger = myLoggerObjectProvider.getObject();
        myLogger.setRequestURL(requestURL);

        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

## 스코프와 프록시

이번에는 프록시 방식을 사용해보겠습니다.

```java
package hello.core.common;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.UUID;

@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class MyLogger {
    ...
}
```

- 여기가 핵심입니다. proxyMode = ScopedProxyMode.TARGET_CLASS를 추가해줍니다.
    - 적용 대상이 인터페이스가 아닌 클래스면 TARGET_CLASS를 선택합니다.
    - 적용 대상이 인터페이스면 INTERFACES를 선택합니다.
- 이렇게 하면 MyLogger의 가짜 프록시 클래스를 만들어두고 HTTP request와 상관없이 가짜 프록시 클래스를 다른 빈에 미리 주입해 둘 수 있습니다.

2) LogDemoService 원복

```java
package hello.core.web;

import hello.core.common.MyLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LogDemoService {
    private final MyLogger myLogger;

    public void logic(String id) {
        myLogger.log("service id = " + id);
    }
}
```

3) LogDemoController 원복

```java
package hello.core.web;

import hello.core.common.MyLogger;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;

@Controller
@RequiredArgsConstructor
public class LogDemoController {
    private final LogDemoService logDemoService;
    private final MyLogger myLogger;

    @RequestMapping("log-demo")
    @ResponseBody
    public String logDemo(HttpServletRequest request) {
        String requestURL = request.getRequestURL().toString();
        myLogger.setRequestURL(requestURL);
        myLogger.log("controller test");
        logDemoService.logic("testId");
        return "OK";
    }
}
```

먼저 주입된 myLogger를 확인해보겠습니다.

> System.out.println("myLogger = " + myLogger.getClass());

출력 결과

> myLogger = class hello.core.common.MyLogger$$EnhancerBySpringCGLIB$$b68 b726 d

**CGLIB라는 라이브러리로 내 클래스를 상속받은 가짜 프록시 객체를 만들어서 주입합니다.**

- @Scope의 proxyMode = ScopedProxyMode.TARGET_CLASS를 설정하면 스프링 컨테이너는 CGLIB라는 바이트코드를 조작하는 라이브러리를 사용해서, MyLogger를 상속받은 가짜 프록시 객체를 생성합니다.
- 결과를 확인해보면 우리가 등록한 순수한 MyLogger 클래스가 아니라 MyLogger$$EnhancerBySpringCGLIB이라는 클래스로 만들어진 객체가 대신 등록된 것을 확인할 수 있습니다.
- 그리고 스프링 컨테이너에 "myLogger"라는 이름으로 진짜 대신에 이 가짜 프록시 객체를 등록합니다.
- ac.getBean("myLogger", MyLogger.class)로 조회해도 프록시 객체가 조회되는 것을 확인할 수 있습니다.
- 그래서 의존관계 주입도 이 가짜 프록시 객체가 주입됩니다.

**가짜 프록시 객체는 요청이 오면 그때 내부에서 진짜 빈을 요청하는 위임 로직이 들어있습니다.**

- 가짜 프록시 객체는 내부에 진짜 myLogger를 찾는 방법을 알고 있습니다.
- 클라이언트가 myLogger.logic()을 호출하면 사실은 가짜 프록시 객체의 메서드를 호출한 것입니다.
- 가짜 프록시 객체는 request 스코프의 진짜 myLogger.logic()를 호출합니다.
- 가짜 프록시 객체는 원본 클래스를 상속받아서 만들어졌기 때문에 이 객체를 사용하는 클라이언트 입장에서는 사실 원본인지 아닌지도 모르게, 동일하게 사용할 수 있습니다(다형성).

**동작 정리**

- CGLIB라는 라이브러리로 내 클래스를 상속받은 가짜 프록시 객체를 만들어서 주입합니다.
- 이 가짜 프록시 객체는 실제 요청이 오면 그때 내부에서 실제 빈을 요청하는 위임 로직이 들어있습니다.
- 가짜 프록시 객체는 실제 request scope와는 관계가 없습니다. 그냥 가짜이고, 내부에 단순한 위임 로직만 있고, 싱글톤처럼 동작합니다.

**특징 정리**

- 프록시 객체 덕분에 클라이언트는 마치 싱글톤 빈을 사용하듯이 편리하게 request scope를 사용할 수 있습니다.
- 사실 Provider를 사용하든, 프록시를 사용하든 핵심 아이디어는 진짜 객체 조회를 꼭 필요한 시점까지 지연 처리한다는 점입니다.
- 단지 애노테이션 설정 변경만으로 원본 객체를 프록시 객체로 대체할 수 있습니다. 이것이 바로 다형성과 DI 컨테이너가 가진 큰 강점입니다.
- 꼭 웹 스코프가 아니어도 프록시는 사용할 수 있습니다.

**주의점**

- 마치 싱글톤을 사용하는 것 같지만 다르게 동작하기 때문에 결국 주의해서 사용해야 합니다.
- 이런 특별한 scope는 꼭 필요한 곳에만 최소화해서 사용해야 합니다. 무분별하게 사용하면 유지보수하기 어려워집니다.

프록시의 추가 설명

[https://cozing.tistory.com/54?category=1076708](https://cozing.tistory.com/54?category=1076708)

## 결론

스프링 핵심원리 기본편이 끝났습니다.

스프링이 전반적으로 어떻게 동작되며, 어떻게 다형성을 적용하는지 잘 알 수 있었습니다. 지금처럼 여유가 있을 때 생각해 보면 개발 3년 동안 어떻게 동작하는지 원리를 파악하지 않고 사용하는 방법만 인지하고 썼던 경험이 많은 것 같습니다. 때문에 처음 개발 속도는 빨랐을지언정 나중 발전 속도는 좀 더뎠던 것 같습니다. 지금처럼 동작 원리를 잘 파악하고, 최적으로 사용할 수 있기를 바랍니다.

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
