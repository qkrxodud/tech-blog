---
title: "자동차 경주 리팩터링 — 5단계"
tags: ["클린 코드","TDD","Java","자동차 경주","전략 패턴"]
summary: "자동차 경주 코드를 MVC 패턴으로 리팩터링하며 사용자 정의 예외와 전략 패턴 적용에 대한 리뷰 피드백을 정리합니다."
---

## 리팩토링 요구사항

- 핵심 비즈니스 로직을 가지는 객체는 domain 패키지에, UI 관련 객체는 view 패키지에 구현합니다.
- MVC 패턴 기반으로 리팩토링해, view 패키지의 객체가 domain 패키지 객체에 의존할 수 있지만 domain 패키지의 객체는 view 패키지 객체에 의존하지 않도록 구현합니다.

## 피드백

리뷰어: 사용자 정의 예외는 `enum`이 아니라 `RuntimeException`을 상속받는 클래스로 정의해보면 어떤지 제안받았습니다.

생각정리: `enum`도 좋은 방법이라고 생각했는데, `RuntimeException`을 상속받아서 출력하는 것을 원했던 것 같습니다.

```java
public enum CustomException {
    NAME_MAX_LENGTH(5,  "이름이 다섯자 이상입니다.");
    private final int length;
    private final String message;

    CustomException(int length, String message) {
        this.length = length;
        this.message = message;
    }

    public int getLength() {
        return length;
    }

    public String getMessage() {
        return message;
    }
}
```

다음과 같이 변경했습니다.

```java
package study.step5.exception;

public class NameMaxLengthException extends RuntimeException {

	  public NameMaxLengthException(String message) {
        super(message);
    }
}
```

리뷰어: 요구사항에 따르면 자동차는 4 이상의 숫자를 전달받은 경우만 이동할 수 있는데, 0부터 3까지의 숫자가 전달되면 자동차의 위치 값이 0으로 유지되어야 하지 않는지 질문받았습니다.

생각정리: 파라미터로 전달하면 이동했는지 멈췄는지 한눈에 볼 수 있어서 작성했는데, 성공하는 경우만 작성해야 하는 것인지 질문했습니다. 다른 사람이 봤을 때 왜 실패했는지 확인하려 할 것 같습니다. 통과하는 테스트 코드만을 작성하겠습니다.

리뷰어: 모든 테스트는 통과되도록 작성해야 합니다. 0부터 3이라는 숫자가 전달됐을 때 기대한 대로 자동차가 움직이지 않는 것을 검증하는 것이 맞지 않는지 지적받았습니다. 실패하는 테스트 코드가 남아 있으면 다른 개발자가 봤을 때 해당 기능이 정상적으로 동작한다고 생각하기 어렵다는 이유였습니다.

리뷰어: `Cars`에 정적 팩토리 메서드를 추가해보는 것을 제안받았습니다(예: `Cars cars = Cars.from(carNames)`).

생각정리: 의미적으로 한눈에 볼 수 있어서 좋았습니다.

```java
public class Track {
    private static final String DELIMITER = ",|:";

    private int attemptCount;
    private Cars cars;

    public Track(final String carNames, final int attemptCount) {
        this.attemptCount = attemptCount;
        createCars(carNames);
    }

    private void createCars(final String carNames) {
        List<Car> cars = new ArrayList<>();
        for (String carName : carNames.split(DELIMITER)) {
            cars.add(new Car(carName));
        }
        this.cars = new Cars(cars);
    }
```

다음과 같이 변경했습니다.

```java
public class Track {
    private int attemptCount;
    private Cars cars;

    public Track(final String carNames, final int attemptCount) {
        this.attemptCount = attemptCount;
        createCars(carNames);
    }

    private void createCars(final String carNames) {
        this.cars = Cars.from(carNames);
    }
```

```java
public class Cars {
    private static final String DELIMITER = ",|:";

    private List<Car> cars;

    public Cars(List<Car> cars) {
        this.cars = cars;
    }

    public static Cars from(final String carNames) {
        List<Car> cars = new ArrayList<>();
        for (String carName : carNames.split(DELIMITER)) {
            cars.add(new Car(carName));
        }
        return new Cars(cars);
    }
```

리뷰어: 객체지향 생활 체조 원칙의 `규칙 4: 한 줄에 점을 하나만 찍는다`를 참고해보라는 의견과, 지역 변수 선언 없이 곧바로 반환해도 충분하다는 의견, 메서드 이름을 잘 지어주셔서 `isWinner()`처럼 따로 메서드를 분리할 필요가 없다는 의견을 받았습니다.

생각정리: 설명해주신 대로 변경하니 한눈에 보기 편합니다.

```java
public List<Car> getWinners() {
        int winnerPosition = getWinnerPosition();
        List<Car> winners = cars.stream().filter(car -> isWinner(car, winnerPosition))
                .collect(Collectors.toList());

        return winners;
```

다음과 같이 변경했습니다.

```java
public List<Car> getWinners() {
    int winnerPosition = getWinnerPosition();

		return cars.stream()
            .filter(car -> car.isWinner(winnerPosition))
            .collect(Collectors.toList());
}
```

리뷰어: 추후 자동차 이동 조건에 대한 요구사항이 변경되더라도 자동차가 유연하게 움직일 수 있도록, 교육 자료의 자동차 경주 피드백을 참고해 전략 패턴을 적용해보는 것을 제안받았습니다.

```java
public class Car implements Comparable<Car> {
    private static final int STARTING_CONDITION = 4;
    private Position position;
    private Name name;

    public Car(final String name) {
        this.name = new Name(name);
        this.position = new Position();
    }

    public void move(int randomInt) {
        moveCar(isMove(randomInt));
    }
```

다음과 같이 변경했습니다. 자동차에서는 인터페이스로 정의해 DI로 의존성을 주입받도록 만들고, 외부에서 해당 인터페이스를 구현해 move의 값을 넘깁니다. 이렇게 하면 언제든지 인터페이스를 상속받아 유연하게 구현할 수 있습니다.

```java
package study.step5.domain.strategy;

public interface MoveStrategy {

    int move();
}
```

```java
package study.step5.domain.strategy;

import java.util.Random;

public class CarMoveStrategy implements MoveStrategy {
    private static final int RANDOM_RANGE = 10;
    private static final Random RANDOM = new Random();

    @Override
    public int move() {
        return RANDOM.nextInt(RANDOM_RANGE);
    }
}
```

```java
public class Car implements Comparable<Car> {
    private static final int STARTING_CONDITION = 4;

    private Position position;
    private Name name;

    public Car(final String name) {
        this.name = new Name(name);
        this.position = new Position();
    }

    public void move(MoveStrategy moveStrategy) {
        moveCar(isMove(moveStrategy.move()));
    }
```

## 후기

오늘은 소스코드를 MVC 패턴으로 변경해보았고, 정적 팩토리 메서드 패턴과 전략 패턴을 사용해보았습니다. 이러한 패턴을 이용해 소스코드를 좀 더 간결하고 유연하게 변경할 수 있다는 것을 알게 되었고, 언제든지 바뀔 것 같은 기능에는 전략 패턴을 사용해보는 것이 좋겠다고 생각했습니다.

깃허브 링크: [https://github.com/next-step/java-racingcar/pull/4564](https://github.com/next-step/java-racingcar/pull/4564)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
