---
title: "Set 컬렉션으로 배우는 학습 테스트 — 1단계"
tags: ["클린 코드", "Java", "JUnit5", "ParameterizedTest", "학습 테스트"]
summary: "Set 컬렉션을 대상으로 학습 테스트를 작성하고 JUnit5의 ParameterizedTest로 중복 코드를 제거한 기록입니다."
---

## Set Collection에 대한 학습 테스트

다음과 같은 Set 데이터가 주어졌을 때 요구사항을 만족해야 합니다.

```java
public class SetTest {
    private Set<Integer> numbers;

    @BeforeEach
    void setUp() {
        numbers = new HashSet<>();
        numbers.add(1);
        numbers.add(1);
        numbers.add(2);
        numbers.add(3);
    }

    // Test Case 구현
}
```

### 요구사항 1

- Set의 size() 메소드를 활용해 Set의 크기를 확인하는 학습테스트를 구현합니다.

### 요구사항 2

- Set의 contains() 메소드를 활용해 1, 2, 3의 값이 존재하는지를 확인하는 학습테스트를 구현하려 합니다.
- 구현하고 보니 다음과 같이 중복 코드가 계속해서 발생합니다.
- JUnit의 ParameterizedTest를 활용해 중복 코드를 제거해 봅니다.

```java
    @Test
    void contains() {
        assertThat(numbers.contains(1)).isTrue();
        assertThat(numbers.contains(2)).isTrue();
        assertThat(numbers.contains(3)).isTrue();
    }
```

## 코드 구성

작성한 코드는 다음과 같습니다.

```java
package study;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

public class SetTest {
    private Set<Integer> numbers;

    @BeforeEach
    void setUp() {
        numbers = new HashSet<>();
        numbers.add(1);
        numbers.add(1);
        numbers.add(2);
        numbers.add(3);
    }

    
    @Test
    @DisplayName("Set의 size() 메소드를 활용해 set의 크기 확인")
    public void compareSetSize() throws Exception {
        //given
        //when
        int size = numbers.size();
        //then
        assertThat(size).isEqualTo(3);
    }

    @ParameterizedTest
    @DisplayName("Set의 contains() 메소드를 활용해 1, 2, 3의 값이 존재하는지를 확인")
    @ValueSource(ints = {1,2,3} )
    public void contains(int input) throws Exception {
        //given
        //when
        //then
        assertThat(numbers.contains(input)).isTrue();
    }

    @DisplayName("부분적으로 값이 다른 것도 체크")
    @ParameterizedTest
    @CsvSource(value = {"1:true", "2:true", "3:true", "4:false","5:false" }, delimiter = ':')
    public void searchPartialValue(String input, String expected) throws Exception {
        //given
        int number = Integer.parseInt(input);
        boolean result = Boolean.parseBoolean(expected);
        //when
        boolean contains = numbers.contains(number);
        //then
        assertThat(contains).isEqualTo(result);
    }

}
```

## 피드백

**1) 다양한 API를 활용**

```java
assertThat(size).isEqualTo(3); 
```

다음과 같이 변경합니다.

```java
assertThat(numbers).hasSize(3);
```

**2) Boolean 타입을 직접 전달받을 수 있습니다.**

```java
@DisplayName("부분적으로 값이 다른 것도 체크")
    @ParameterizedTest
    @CsvSource(value = {"1:true", "2:true", "3:true", "4:false","5:false" }, delimiter = ':')
    public void searchPartialValue(String input, String expected) throws Exception {
```

다음과 같이 변경합니다.

```java
public void searchPartialValue(String input, String expected) throws Exception {
    public void searchPartialValue(String input, boolean expected) throws Exception {
```

## 후기

오늘은 간단하게, 테스트를 어떻게 진행하는지와 깃을 어떻게 사용하는지에 대해 간단한 설명을 들었습니다. TDD 함수를 위와 같은 형태로 조금씩 사용해 보았는데, 다양한 함수를 사용하지 않아서 그런지 아직은 어색한 부분이 있었습니다. 이를 인지하면서, 사용하지 않았던 부분도 계속해서 노력하여 사용해 보려고 합니다. 적극적으로 습관이 되도록 사용해보겠습니다!

깃허브 링크: [https://github.com/next-step/java-racingcar/pull/4092](https://github.com/next-step/java-racingcar/pull/4092)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
