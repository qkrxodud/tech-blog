---
title: "Bean Validation으로 요청 값 검증하기"
tags: ["Java","Spring Boot","Validation","Bean Validation"]
summary: "Spring Boot에서 제공하는 유효성 검사 어노테이션 종류와 실제 사용 예시를 정리합니다."
---

오늘은 Validation으로 다양한 값을 확인하는 방법을 정리합니다.

Spring Boot에서는 다양한 유효성 검사 어노테이션을 제공합니다. 그중 하나인 @Validation은 전달받은 데이터를 유용하고 쉽게 유효성 검사를 할 수 있게 해줍니다.

사용 방법은 유효성 검증 규칙을 정의하고 검증을 진행하면 됩니다.

## Validation 어노테이션 종류

Spring Boot에서 제공하는 Validation 어노테이션은 다음과 같습니다.

1. @NotNull: 값이 null이 아닌지 확인
2. @NotEmpty: 문자열, 컬렉션 또는 배열이 null이 아니고 값이 있는지 확인
3. @NotBlank: 문자열이 null이 아니고, trim() 후 길이가 0보다 큰지 확인
4. @Min: 숫자가 특정 최소값 이상인지 확인
5. @Max: 숫자가 특정 최대값 이하인지 확인
6. @DecimalMin: 숫자가 특정 최소값 이상인지 확인 (소수점 이하 포함)
7. @DecimalMax: 숫자가 특정 최대값 이하인지 확인 (소수점 이하 포함)
8. @Size: 문자열, 컬렉션 또는 배열의 크기가 특정 범위 내에 있는지 확인
9. @Email: 문자열이 유효한 이메일 주소 형식인지 확인
10. @Pattern: 문자열이 특정 패턴과 일치하는지 확인

그 외에도 다양한 기능을 제공해줍니다.

## 사용 방법

1. null 값 체크

```java
public void createUser(@Valid @RequestBody User user) {
    // ...
}
public class User {
    @NotNull
    private String name;
    // ...
}
```

2. 공백 체크

```java
public void createPost(@Valid @RequestBody Post post) {
    // ...
}
public class Post {
    @NotBlank
    private String title;
    // ...
}
```

3. 최소값/최대값 충족 확인

```java
public void createProduct(@Valid @RequestBody Product product) {
    // ...
}
public class Product {
    @Min(1)
    private int quantity;
    @Max(100)
    private double price;
    // ...
}
```

4. Size에 속하는지 체크

```java
public void updateProfile(@Valid @RequestBody Profile profile) {
    // ...
}
public class Profile {
    @Size(min = 1, max = 100)
    private String bio;
    // ...
}
```

5. Pattern: 값이 특정 패턴을 따르는지 확인합니다.

```java
public void createAccount(@Valid @RequestBody Account account) {
    // ...
}
public class Account {
    @Pattern(regexp = "[A-Za-z0-9]+")
    private String username;
    // ...
}
```

위와 같이 사용하면 됩니다.

## 후기

오늘은 @Validation의 사용법에 대해 작성했습니다. 편하게 유효성을 체크할 수 있어서 좋았으며, 내가 직접 정의해야만 유효성이 체크된다는 점이 안정적으로 느껴졌습니다. 어떤 어노테이션들은 클래스 위에 선언하기만 하면 자동으로 처리해 주어서 편리하지만 그만큼 위험성도 있는데, @Validation은 제가 지정한 것들만 적용된다는 점에서 알아두면 좋을 것 같습니다.
