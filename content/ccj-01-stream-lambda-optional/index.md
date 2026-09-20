---
title: "스트림, 람다, Optional — 1단계"
tags: ["클린 코드", "Java", "스트림", "람다", "Optional"]
summary: "익명 클래스를 람다로 바꾸고 스트림의 map, filter, reduce와 Optional을 활용해 리팩토링한 학습 기록입니다."
---

## 스트림, 람다, Optional

## 람다 실습 1 - 익명 클래스를 람다로 전환

```java
// nextstep.fp.CarTest의 이동, 정지 method
public class CarTest {
    @Test
    public void 이동() {
        Car car = new Car("pobi", 0);
        Car actual = car.move(new MoveStrategy() {
            @Override
            public boolean isMovable() {
                return true;
            }
        });
        assertEquals(new Car("pobi", 1), actual);
    }

    @Test
    public void 정지() {
        Car car = new Car("pobi", 0);
        Car actual = car.move(new MoveStrategy() {
            @Override
            public boolean isMovable() {
                return false;
            }
        });
        assertEquals(new Car("pobi", 0), actual);
    }
}
```

다음과 같이 변경합니다.

```java
@Test
    public void 이동() {
        Car car = new Car("pobi", 0);
        Car actual = car.move(() -> true);
        assertThat(actual).isEqualTo(new Car("pobi", 1));
    }

    @Test
    public void 정지() {
        Car car = new Car("pobi", 0);
        Car actual = car.move(() -> false);
        assertThat(actual).isEqualTo(new Car("pobi", 0));
    }	
```

## 람다 실습 2 - 람다를 활용해 중복 제거

```java
// nextstep.fp.Lambda의 sumAll method
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);

public int sumAll(List<Integer> numbers) {
    int total = 0;
    for (int number : numbers) {
        total += number;
    }
    return total;
}

List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);
public int sumAllEven(List<Integer> numbers) {
    int total = 0;
    for (int number : numbers) {
        if (number % 2 == 0) {
            total += number;
        }
    }
    return total;
}
```

다음과 같이 변경합니다.

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

## 스트림(stream)

### map, filter, reduce

Collection에 담긴 데이터를 처리하려면 Collection을 순회하면서 각 Element를 처리하는 것이 일반적입니다. 앞으로는 순회하는 것을 잊고, Element 처리에만 집중합니다.

### filter

요구사항은 파일 문자 중 길이가 12보다 큰 문자의 수를 구하는 것입니다.

```java
String contents = new String(Files.readAllBytes(
  Paths.get("../ war-and-peace.txt")), StandardCharsets.UTF_8);
List<String> words = Arrays.asList(contents.split("[\\P{L}]+"));

long count = 0;
for (String w : words) {
  if (w.length() > 12) count++;  
}
```

### filter 활용해 구현

```java
String contents = new String(Files.readAllBytes(
  Paths.get("../alice.txt")), StandardCharsets.UTF_8);
List<String> words = Arrays.asList(contents.split("[\\P{L}]+"));

long count =
  words.stream().filter(w -> w.length() > 12).count();

```

### map

List에 담긴 모든 숫자 값을 2배한 결과 List를 생성합니다.

```java
// nextstep.fp.StreamStudy 클래스의 doubleNumbers method 참고
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);
List<Integer> dobuleNumbers =
  numbers.stream().map(x -> 2 * x).collect(Collectors.toList());

```

### reduce

List에 담긴 모든 숫자의 합을 구합니다.

```java
// nextstep.fp.StreamStudy 클래스의 sumAll method 참고

List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);

public int sumAll(List<Integer> numbers) {
    return numbers.stream().reduce(0, (x, y) -> x + y);
}
```

reduce를 잘 설명한 블로그가 있어서 참조합니다.

[Java - Stream.reduce() 사용 방법 및 예제](https://codechacha.com/ko/java8-stream-reduction/#4-병렬-처리에서-reduce는-순차적으로-처리)

### map, reduce, filter 실습 1

List에 담긴 모든 숫자 중 3보다 큰 숫자를 2배 한 후 모든 값의 합을 구합니다. 지금까지 학습한 map, reduce, filter를 활용해 구현해야 합니다.

```java
public static long sumOverThreeAndDouble(List<Integer> numbers) {
    return numbers.stream()
            .filter(number -> number > 3)
            .map(number -> number * 2)
            .reduce(0, (total, number) -> total + number);
}
```

### map, reduce, filter 실습 2

nextstep.fp.StreamStudy 클래스의 printLongestWordTop100() 메서드를 구현합니다. 요구사항은 다음과 같습니다.

- 단어의 길이가 12자를 초과하는 단어를 추출합니다.
- 12자가 넘는 단어 중 길이가 긴 순서로 100개의 단어를 추출합니다.
- 단어 중복을 허용하지 않는다. 즉, 서로 다른 단어 100개를 추출해야 합니다.
- 추출한 100개의 단어를 출력합니다. 모든 단어는 소문자로 출력해야 합니다.

```java
public static void printLongestWordTop100() throws IOException {
    String contents = new String(Files.readAllBytes(Paths
            .get("src/main/resources/fp/war-and-peace.txt")), StandardCharsets.UTF_8);
    List<String> words = Arrays.asList(contents.split("[\\P{L}]+"));
    words.stream()
            .filter(word -> word.length() > 12)
            .sorted(Comparator.comparing(String::length))
            .distinct()
            .reduce("", (total, word) -> total + word + ", ").toLowerCase();
}
```

### 요구사항 1 - Optional을 활용해 조건에 따른 반환

nextstep.optional.User의 ageIsInRange1() 메소드는 30살 이상, 45살 이하에 해당하는 User가 존재하는 경우 true를 반환하는 메소드입니다.

같은 기능을 Optional을 활용해 ageIsInRange2() 메소드에 구현합니다. 메소드 인자로 받은 User를 Optional로 생성하면 stream의 map, filter와 같은 메소드를 사용하는 것이 가능합니다.

nextstep.optional.UserTest의 테스트가 모두 pass해야 합니다.

```java
public static boolean ageIsInRange2(User user) {
    return Optional.ofNullable(user)
            .filter(userData -> userData.getAge() != null)
            .filter(userData -> userData.getAge() >= 30 && userData.getAge() <= 45)
            .map(userData -> true)
            .orElse(false);
}
```

### 요구사항 2 - Optional에서 값을 반환

> nextstep.optional.Users의 getUser() 메소드를 자바 8의 stream과 Optional을 활용해 구현합니다.
> 자바 8의 stream과 Optional을 사용하도록 리팩토링한 후 UsersTest의 단위 테스트가 통과해야 합니다.

```java
User getUser(String name) {
    return users.stream()
            .filter(user -> user.matchName(name))
            .findFirst()
            .orElse(DEFAULT_USER);
}
```

### 요구사항 3 - Optional에서 exception 처리

> nextstep.optional.ExpressionTest의 테스트가 통과하도록 Expression의 of 메소드를 구현합니다.
> 단, of 메소드를 구현할 때 자바 8의 stream을 기반으로 구현합니다.

```java
static Expression of(String expression) {

    return Arrays.stream(values())
            .filter(expressionData -> matchExpression(expressionData, expression))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(String.format("%s는 사칙연산에 해당하지 않는 표현식입니다.", expression)));
}
```

관련 PR: [https://github.com/next-step/java-ladder/pull/1696/files](https://github.com/next-step/java-ladder/pull/1696/files)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
