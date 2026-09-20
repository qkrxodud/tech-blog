---
title: "[Java] @JsonIgnoreProperties(ignoreUnknown=true)"
tags: ["Java", "Jackson", "JsonIgnoreProperties", "역직렬화", "REST API"]
summary: "@JsonIgnoreProperties(ignoreUnknown=true) 어노테이션으로 정의되지 않은 JSON 프로퍼티를 무시해 역직렬화 오류를 방지하는 방법을 정리합니다."
---

> API 연동된 객체 안에 JsonIgnoreProperties 발견

오늘은 API를 연동하면서 처음 보는 어노테이션을 보고 알게 되어 작성하려고 합니다.

JsonIgnoreProperties라는 어노테이션이며, 해당 어노테이션의 역할은 REST API를 통해 들어온 JSON 데이터의 body를 역직렬화해서 객체를 만들 때, 없는 데이터가 있을 시 발생하는 에러를 무시하게 해주는 역할을 합니다.

어떻게 사용하면 되는지 작성해 보겠습니다.

참조, 사용방법 : [https://www.baeldung.com/jackson-annotations](https://www.baeldung.com/jackson-annotations)

> 사용방법

아래와 같은 클래스가 있다고 가정해 보겠습니다.

```java
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties({"password"})
public class User {
    private String username;
    private String password;
    private String email;

    // getters and setters
}
```

위 예제에서는 **`password`** 프로퍼티가 JSON으로 변환되지 않거나, JSON에서 역직렬화할 때 해당 프로퍼티가 무시됩니다.

예를 들어, 아래와 같이 **`User`** 객체를 JSON으로 직렬화할 경우

```java
User user = new User();
user.setUsername("john");
user.setPassword("secret");
user.setEmail("john@example.com");

ObjectMapper objectMapper = new ObjectMapper();
String jsonString = objectMapper.writeValueAsString(user);

System.out.println(jsonString);
```

아래와 같은 JSON 데이터가 생성됩니다.

```json
{
    "username": "john",
    "email": "john@example.com"
}
```

따라서, **`@JsonIgnoreProperties`**는 **JSON 직렬화 및 역직렬화에서 특정 프로퍼티를 제외하고 싶을 때** 사용할 수 있는 유용한 어노테이션입니다.

> JsonIgnoreProperties(ignoreUnknown = true) 사용방법

**`@JsonIgnoreProperties(ignoreUnknown = true)`** 는 Spring에서 JSON 직렬화 및 역직렬화 시, 알 수 없는 프로퍼티를 무시하도록 지정하는 어노테이션입니다. JSON 문자열에 포함된 프로퍼티 이름이 클래스에 정의된 프로퍼티와 일치하지 않을 때 사용합니다.

예를 들어, 아래와 같이 **`User`** 클래스에서 **`username`**과 **`email`** 프로퍼티를 가지고 있다고 가정해 보겠습니다.

```java
public class User {
    private String username;
    private String email;

    // getters and setters
}
```

하지만 클라이언트 측에서 password를 추가해서 전송한다고 가정해 보겠습니다.

```json
{
    "username": "john",
    "email": "john@example.com",
    "password": "secret"
}
```

원래대로라면 password를 작성하지 않았기 때문에 에러가 발생하겠지만, JsonIgnoreProperties(ignoreUnknown = true)를 통해서 이를 무시하고, 클래스에 선언되어 있는 데이터만 가져올 수 있게 됩니다.

> 후기

오늘은 **JsonIgnoreProperties**에 대해 찾아보게 되었습니다. API라면 클라이언트, 서버 측 모두 언제 어떻게 바뀔지 모르기 때문에 위와 같은 어노테이션을 써도 좋겠지만, 다르게 생각해 보면 변경됨에 따라 최신화해 주는 것도 중요한 부분이기 때문에 협의하에 잘 작성하는 것이 좋지 않을까 생각합니다.
