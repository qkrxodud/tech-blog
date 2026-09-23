---
title: "웹 개발 기초: 정적 컨텐츠, MVC와 템플릿 엔진"
tags: ["Spring Boot","MVC","Thymeleaf","템플릿 엔진","정적 컨텐츠"]
summary: "스프링 부트가 정적 컨텐츠와 MVC 템플릿 엔진, API 응답을 각각 어떻게 처리하는지 예제 코드로 정리합니다."
---

## 정적 콘텐츠

- 웹 브라우저에 파일을 그대로 전송해주는 방식입니다.

스프링 부트는 기본적으로 정적 콘텐츠를 제공합니다.

1. main > resource > static 디렉터리를 생성
2. static 디렉터리 밑에 hello-static.html 파일을 생성

url: `http://localhost:8080/hello-static.html`로 바로 접근할 수 있습니다.

**접근 순서**

1. 내장 톰캣 서버에서 요청을 받습니다.
2. 스프링 컨테이너에서 관련 컨트롤러를 찾습니다.
3. 없으면 resources:static/hello-static.html을 찾습니다.
4. 이후 웹 브라우저를 통해서 전송합니다.

## MVC와 템플릿 엔진

- 서버에서 데이터를 변형해서 HTML 형식으로 바꿔서 전송해주는 방식입니다.
- API는 json 데이터 포맷으로 데이터를 클라이언트에 전송해주는 방식이며, 서버끼리 통신할 때 사용합니다.

M : Model

V : View

C : Controller

관심사를 분리하기 위해 나온 패턴입니다. 과거에는 뷰 안에서 데이터 접근과 로직을 같이 구성해서 소스 관리가 너무 힘들었습니다.

현재는 화면 구성은 View에만, 비즈니스 로직과 서버에 관련된 영역은 Controller에, 화면에 필요한 데이터를 담을 때는 Model을 사용해서 구성합니다.

1. Main> java> hello> hellospring> controller> HelloController.java 생성
2. resources> templates> hello.html 생성
3. 작동 방식

```java
package hello.hellospring.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class HelloController {

    @GetMapping("hello")
    public String hello(Model model) {
        model.addAttribute("data", "hello cozing");
        return "hello";
    }
}
```

```html
<html xmlns:th="http://www.thymeleaf.org">
<body>
<p th:text="'hello' + ${data}">hello! empty</p>
</body>
</html>
```

**접근 순서**

1. 웹 브라우저에서 내장 톰캣 서버로 요청을 보냅니다.
2. 스프링 컨테이너에서 관련 컨트롤러를 찾습니다.
3. HelloController의 @GetMapping("hello")에 접근합니다.
4. model.addAttribute를 통해서 data의 key 값에 value를 담습니다.
5. 이후 ViewResolver를 통해 HTML로 변환한 뒤 웹 브라우저에 출력합니다.

## MVC와 템플릿 엔진에서 파라미터 전달방법

1. Main> java> hello> hellospring> controller> HelloController.java의 GetMapping("hello-mvc")를 추가합니다.
2. resources> templates> hello-mvc.html을 생성합니다.
3. 매개변수 값으로 @RequestPara("name") String name으로 파라미터 값을 받을 수 있습니다. 주의해야 할 점은 RequestParam의 required 값이 디폴트로 true가 설정되어 있는데, 이는 파라미터 값을 전달해 주지 않으면 에러가 발생한다는 것입니다.

required 값을 false로 주면 파라미터 값을 전달하지 않아도 html이 출력됩니다.

```java
package hello.hellospring.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class HelloController {

    @GetMapping("hello")
    public String hello(Model model) {
        model.addAttribute("data", "hello cozing");
        return "hello";
    }

    @GetMapping("hello-mvc")
    public String helloMvc(@RequestParam("name") String name, Model model) {
        model.addAttribute("name", name);
        return "hello-mvc";
    }

}
```

```java
<html xmlns:th="http://www.thymeleaf.org">
<body>
<p th:text="'hello' + ${name}">hello! empty</p>
</body>
</html>
```

**접근 순서**

1. 웹 브라우저에서 내장 톰캣 서버로 요청을 보냅니다.
2. 스프링 컨테이너에서 관련 컨트롤러를 찾습니다.
3. HelloController의 @GetMapping("hello-mvc")에 접근합니다.
4. model.addAttribute를 통해서 data의 key 값에 value를 담습니다.
5. 이후 ViewResolver를 통해 HTML로 변환한 뒤 웹 브라우저에 출력합니다.

## API

1. Main> java> hello> hellospring> controller> HelloController.java의 GetMapping("hello-api")를 추가합니다.
2. @ResponseBody를 추가합니다.
3. 응답으로 json 형식으로 보낼 객체를 생성합니다.
4. 객체를 반환합니다.

ResponseBody : http의 body 응답 부분에 값을 직접 넣어 주겠다는 의미입니다.

```java
package hello.hellospring.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class HelloController {

    @GetMapping("hello")
    public String hello(Model model) {
        model.addAttribute("data", "hello cozing");
        return "hello";
    }

    @GetMapping("hello-mvc")
    public String helloMvc(@RequestParam(value = "name", required = false) String name, Model model) {
        model.addAttribute("name", name);
        return "hello-mvc";
    }

    @GetMapping("hello-api")
    @ResponseBody
    public HelloApi helloApi(@RequestParam("name") String name) {
        HelloApi helloApi = new HelloApi();
        helloApi.setName(name);
        return helloApi;
    }

    static class HelloApi {
        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }

}
```

**접근 순서**

1. 웹 브라우저에서 내장 톰캣 서버로 요청을 보냅니다.
2. 스프링 컨테이너에서 관련 컨트롤러를 찾습니다.
3. HelloController의 @GetMapping("hello-api")에 접근합니다.
4. 객체를 생성합니다.
5. setter를 통해서 값을 넣고 객체를 반환합니다.
6. json 형태의 데이터가 출력됩니다.

> 결론
>
> 스프링에서 원하는 웹페이지나 데이터를 보내고자 할 때는 Controller를 통해 구분해서 보내면 됩니다. 구분은 GetMapping으로 값을 넣어 주면 되고, 추가로 데이터를 보내고 싶을 때는 ResponseBody를 사용하면 됩니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
