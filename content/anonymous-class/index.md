---
title: "익명 클래스"
tags: ["Java","익명 클래스","람다","함수형 인터페이스","리팩터링"]
summary: "자바의 익명 클래스가 무엇인지 살펴보고, 중복 코드를 익명 클래스로 리팩토링하는 예제와 인터페이스 구현 방식, 사용 시 얻을 수 있는 이점을 정리합니다."
---

### 익명클래스 설명

자바에서 익명 클래스(anonymous class)는 **`이름이 없는 클래스`**로, **일회용**으로 사용됩니다.

익명 클래스는 클래스의 정의와 함께 객체를 생성할 수 있습니다. 익명 클래스는 인터페이스나 추상 클래스를 상속받아 구현하는 경우가 많습니다.

아래 예시를 보겠습니다.

### 숫자 더하기 함수

1) 모든 수를 더하는 함수

2) 짝수만 더하는 함수

3) 3보다 큰 수를 더하는 함수

공통적으로 사용되는 영역이 많고, 다르게 작성되는 영역은 if문 밖에 없습니다.

```java
public static int sumAll(List<Integer> numbers) {
        int total = 0;
        for (int number : numbers) {
            total += number;
        }
        return total;
    }

public static int sumAllEven(List<Integer> numbers) {
    int total = 0;
    for (int number : numbers) {
        if (number % 2 == 0) {
            total += number;
        }
    }
    return total;
}

public static int sumAllOverThree(List<Integer> numbers) {
    int total = 0;
    for (int number : numbers) {
        if (number > 3) {
            total += number;
        }
    }
    return total;
}
```

- 코드 수정
    
    ```java
    @Test
        public void sumAll() throws Exception {
            int sum = Lambda.sumAllConditional(numbers, number -> true);
            assertThat(sum).isEqualTo(21);
        }
    
        @Test
        public void sumAllEven() throws Exception {
            int sum = Lambda.sumAllConditional(numbers, number -> number % 2 == 0);
            assertThat(sum).isEqualTo(12);
        }
    
        @Test
        public void sumAllOverThree() throws Exception {
            int sum = Lambda.sumAllConditional(numbers, number -> number > 3);
            assertThat(sum).isEqualTo(15);
        }
    ```
    
    ```java
    public static int sumAllConditional(List<Integer> numbers, Conditional conditional) {
            int total = 0;
            for (int number : numbers) {
                if (conditional.data(number)) {
                    total += number;
                }
            }
            return total;
        }
    ```
    
    ```java
    public interface Conditional {
        boolean data(Integer number);
    }
    ```
    

위와 같이 공통 영역은 하나의 함수로 작성해주고, if문의 분기 처리를 익명 함수로 처리하여 가독성을 끌어올릴 수 있습니다.

### 객체로 사용 방법

예를 들어, Insect 인터페이스를 구현하는 예제를 작성하려면, 일반적인 방법으로는 클래스를 만들고 Insect를 구현하도록 선언해야 합니다. 하지만 익명 클래스를 사용하면 이를 더 간단하게 구현할 수 있습니다.

다음은 Insect 인터페이스를 구현하는 익명 클래스의 예시입니다.

```java
interface Insect {
    void crawl();
}

public class Conditional {
    public static void main(String[] args) {
        Insect ant = () -> System.out.println("Ant is crawling");
        ant.crawl();
    }
}
```

### 이점

1. **코드 가독성 향상:** 익명 클래스를 사용하면 코드가 간결해지고, 클래스의 정의와 객체의 생성이 한눈에 보입니다.
2. **코드 재사용성 향상:** 익명 클래스는 일회용으로 사용되기 때문에 다른 곳에서 재사용할 필요가 없습니다. 따라서 코드의 재사용성을 떨어뜨리는 요소를 제거할 수 있습니다.
3. **코드 작성 편의성 향상**: 익명 클래스를 사용하면 클래스를 정의하고 객체를 생성하는 과정을 하나로 합칠 수 있습니다. 이를 통해 코드 작성이 더 간편해집니다.
4. **코드 오버헤드 감소**: 익명 클래스를 사용하면 클래스 파일을 생성하지 않기 때문에, 클래스 파일에 대한 오버헤드를 줄일 수 있습니다.
5. **코드 유연성 향상:** 익명 클래스를 사용하면 클래스의 구현을 런타임 시에 변경할 수 있습니다. 이를 통해 코드의 유연성이 높아집니다.
6. **코드 가시성 향상**: 익명 클래스를 사용하면 클래스의 이름이 없기 때문에 코드의 가시성이 향상됩니다. 클래스의 이름이 없기 때문에 클래스 이름에 대한 고민을 덜 할 수 있습니다.
