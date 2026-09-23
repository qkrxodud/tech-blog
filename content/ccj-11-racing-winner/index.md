---
title: "자동차 경주 우승자 — 4단계"
tags: ["클린 코드","TDD","Java","자동차 경주","원시값 포장"]
summary: "자동차 이름과 우승자 판별 기능을 추가하며 원시값 포장과 일급 컬렉션 설계에 대한 리뷰 피드백을 정리합니다."
---

## 기능 요구사항

- 각 자동차에 이름을 부여할 수 있습니다. 자동차 이름은 5자를 초과할 수 없습니다.
- 전진하는 자동차를 출력할 때 자동차 이름을 같이 출력합니다.
- 자동차 이름은 쉼표(,)를 기준으로 구분합니다.
- 자동차 경주 게임을 완료한 후 누가 우승했는지 알려줍니다. 우승자는 한 명 이상일 수 있습니다.

### 실행 결과

위 요구사항에 따라 3대의 자동차가 5번 움직였을 경우 프로그램을 실행한 결과는 다음과 같습니다.

```java
경주할 자동차 이름을 입력하세요(이름은 쉼표(,)를 기준으로 구분).
pobi,crong,honux
시도할 회수는 몇회인가요?
5

실행 결과
pobi : -
crong : -
honux : -

pobi : --
crong : -
honux : --

pobi : ---
crong : --
honux : ---

pobi : ----
crong : ---
honux : ----

pobi : -----
crong : ----
honux : -----

pobi : -----
crong : ----
honux : -----

pobi, honux가 최종 우승했습니다.
```

## 피드백

리뷰어: 클래스 파일을 작성할 때, [클래스 파일 변수 작성 순서](https://www.oracle.com/java/technologies/javase/codeconventions-fileorganization.html)에서 제안하는 순서대로 작성해보면 좋겠다는 의견을 받았습니다.

생각정리: 클래스 파일 변수를 작성하는 순서는 회사 방식에 맞추려고 했지, 정해진 순서가 있는지는 처음 알았습니다. 인지하고 작성하겠습니다.

```java
private int position = 0;
private static final Random random = new Random();
private static final int STARTING_CONDITION = 4;
private static final int RANDOM_RANGE = 10;
private static final int NAME_MAX_LENGTH = 5;
private int attemptCount = 0;
private String name;
```

다음과 같이 변경했습니다.

```java
private static final Random RANDOM = new Random();
private static final int STARTING_CONDITION = 4;
private static final int RANDOM_RANGE = 10;
private static final int NAME_MAX_LENGTH = 5;

private int position = 0;
private int attemptCount = 0;
private String name;
```

리뷰어: 자동차 이름인 문자열 `name`을 클래스로 포장해보는 것을 제안받았습니다.

생각정리: 모든 값을 원시값 포장하면 클래스가 많이 늘어날 텐데 관리하기 더 힘들지 않을까 하는 생각도 한편으로 들지만, 그래도 로직을 확실히 구분하는 것이 분석하는 데 도움이 많이 될 것 같습니다.

```java
package study.step4;

public class Name {
    private static final intNAME_MAX_LENGTH= 5;

    String name;

    public Name(String name) {
        checkName(name);
        this.name = name;
    }

    private void checkName(String name) {
        if (name.length() >NAME_MAX_LENGTH) {
            throw new IllegalArgumentException("이름이 다섯자 이상입니다.");
        }
    }

    public String getName() {
        return name;
    }

}

```

리뷰어: `String.format()`을 활용하면 어떤 문자열이 생성될지 대략적으로 알 수 있어서 가독성을 높일 수 있다는 의견을 받았습니다.

```java
public class ResultView {

    private ResultView() {
        // 생성자 내부 호출 -> 명시적 Exception
        throw new AssertionError();
    }
    public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            addCarName(stringBuilder, car);
            changeCarMoveToString(stringBuilder, car);
            stringBuilder.append("\n");
       }
		}
```

다음과 같이 변경했습니다.

```java

public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            stringBuilder.append(String.format("%s : %s%n", car.getCarName(), POSITION_CHARTER.repeat(car.getPosition())));
        }
		}

```

리뷰어: 우승자 출력 함수를 stream으로 처리해보면 좋겠다는 의견을 받았습니다.

```java
public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            addCarName(stringBuilder, car);
            changeCarMoveToString(stringBuilder, car);
            stringBuilder.append("\n");
        }
        System.out.println(stringBuilder);
    }
```

다음과 같이 변경했습니다.

```java
public static void outPutWinner(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> winners = track.getWinnerCars();

        String victoryMessage = winners.stream().map(n -> String.valueOf(n.getName()))
                .collect(Collectors.joining(", "));
        stringBuilder.append(victoryMessage).append("가 최종 우승했습니다.");

        System.out.println(stringBuilder);
    }
```

## 코드 구성

자동차 구현

- Car.java

```java
package study.step4;

import java.util.Random;

public class Car implements Comparable<Car> {
    private static final int STARTING_CONDITION = 4;
    private static final int RANDOM_RANGE = 10;
    private static final Random RANDOM = new Random();

    private int attemptCount = 0;
    private Position position;
    private Name name;

    public Car(String name) {
        this.name = new Name(name);
        this.position = new Position();
    }

    public void move() {
        moveCar(isMove(RANDOM.nextInt(RANDOM_RANGE)));
        attemptCount++;
    }

    public Boolean isMove(int input) {
        return input >= STARTING_CONDITION;
    }

    private void moveCar(boolean moveResult) {
        if (moveResult) {
            position.increase();
        }
    }

    public int getPosition() {
        return position.getPosition();
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public String getName() {
        return name.getName();
    }

    @Override
    public int compareTo(Car car) {
        return (this.position.getPosition() > car.position.getPosition()) ? 1 : -1;
    }
}
```

자동차들 구현(일급 컬렉션) — 일급 컬렉션은 이후에 좀 더 활용하며 작성하겠습니다.

- Cars.java

```java
package study.step4;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class Cars {
    private List<Car> cars;

    public Cars(List<Car> cars) {
        this.cars = cars;
    }

    public void startRacing() {
        for (Car car : cars) {
            car.move();
        }
    }

    public int getWinnerPosition() {
        return Collections.max(cars).getPosition();
    }

    public List<Car> getWinners() {
        int winnerPosition = getWinnerPosition();
        List<Car> winners = cars.stream().filter(car -> isWinner(car, winnerPosition)).collect(Collectors.toList());

        return winners;
    }

    private Boolean isWinner(Car car, int winnerPosition) {
        return car.getPosition() == winnerPosition;
    }

    public List<Car> getCars() {
        return cars;
    }
}
```

트랙 구현

- Track.java

```java
package study.step4;

import java.util.ArrayList;
import java.util.List;

public class Track {
    private static final String DELIMITER = ",|:";

    private int attemptCount;
    private Cars cars;

    public Track(String carNames, int finish) {
        this.attemptCount = finish;
        createCars(carNames);
    }

    private void createCars(String carNames) {
        List<Car> cars = new ArrayList<>();
        for (String carName : carNames.split(DELIMITER)) {
            cars.add(new Car(carName));
        }
        this.cars = new Cars(cars);
    }

    public void startRacing() {
        cars.startRacing();
        attemptCount--;
    }

    public Boolean isRaceEnd() {
        return attemptCount == 0;
    }

    public List<Car> getCars() {
        return cars.getCars();
    }

    public List<Car> getWinnerCars() {
        return cars.getWinners();
    }

    public int winnerPosition() {
        return cars.getWinnerPosition();
    }
}
```

입력 화면

- InputView.java

```java
package study.step4;

import java.util.Scanner;

public class InputView {
    public static final Scanner scanner = new Scanner(System.in);

    private InputView() {
        // 생성자 내부 호출 -> 명시적 Exception
        throw new AssertionError();
    }

    public static String askCarName() {
        System.out.println("경주할 자동차 이름을 입력하세요(이름은 쉼표(,)를 기준으로 구분).");
        return scanner.next();
    }

    public static int aksFinishCount() {
        System.out.println("시도할 회수는 몇회인가요?");
        return scanner.nextInt();
    }
}
```

출력화면

- Result.java

```java
package study.step4;

import java.util.List;
import java.util.stream.Collectors;

public class ResultView {
    public static final String POSITION_CHARTER = "-";

    private ResultView() {
        // 생성자 내부 호출 -> 명시적 Exception
        throw new AssertionError();
    }

    public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            stringBuilder.append(String.format("%s : %s%n", car.getName(), changeCarMoveToString(car)));
        }
        System.out.println(stringBuilder);
    }

    public static void outPutWinner(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> winners = track.getWinnerCars();

        String victoryMessage = winners.stream().map(n -> String.valueOf(n.getName()))
                .collect(Collectors.joining(", "));
        stringBuilder.append(victoryMessage).append("가 최종 우승했습니다.");

        System.out.println(stringBuilder);
    }

    private static StringBuilder changeCarMoveToString(Car car) {
        StringBuilder move = new StringBuilder();
        for (int i = 0; i < car.getPosition(); i++) {
            move.append(POSITION_CHARTER);
        }
        return move;
    }
}
```

메인

- Main.java

```java
package study.step4;

public class Main {

    public static void main(String[] args) {
        // 입력 화면
        String carNames = InputView.askCarName();
        int finish = InputView.aksFinishCount();

        //레이싱 경기장
        Track track = new Track(carNames, finish);
        while (!track.isRaceEnd()) {
            track.startRacing();
            ResultView.outPut(track);
        }

        //레이싱 우승자 출력
        ResultView.outPutWinner(track);
    }
}
```

이름 구현

- Name.java

```java
package study.step4;

public class Name {
    private static final int NAME_MAX_LENGTH = 5;

    String name;

    public Name(String name) {
        checkName(name);
        this.name = name;
    }

    private void checkName(String name) {
        if (name.length() > NAME_MAX_LENGTH) {
            throw new IllegalArgumentException("이름이 다섯자 이상입니다.");
        }
    }

    public String getName() {
        return name;
    }

}
```

위치 구현

- Position.java

```java
package study.step4;

public class Position {
    private int position = 0;

    public int getPosition() {
        return position;
    }

    public void increase() {
        position++;
    }
}
```

## 후기

오늘은 자동차 경주 우승자 4단계를 진행했습니다. 일급 컬렉션, 원시값 포장에 대해 알 수 있었고, 이를 사용하면 테스트 코드를 구현하기도 좋고 관리하는 측면에서도 도움이 많이 될 것이라고 생각했습니다. 인지하고 잘 활용할 수 있도록 노력하겠습니다.

깃허브 링크: [https://github.com/next-step/java-racingcar/pull/4467](https://github.com/next-step/java-racingcar/pull/4467)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
