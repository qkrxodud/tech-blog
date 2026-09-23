---
title: "자동차 경주 — 3단계"
tags: ["클린 코드","TDD","Java","자동차 경주","코드 리뷰"]
summary: "자동차 경주 게임을 처음 구현하며 View 책임 분리와 축약어 지양, 경계값 테스트에 대한 리뷰 피드백을 정리합니다."
---

## 기능 요구사항

- 초간단 자동차 경주 게임을 구현합니다.
- 주어진 횟수 동안 n대의 자동차는 전진 또는 멈출 수 있습니다.
- 사용자는 몇 대의 자동차로 몇 번의 이동을 할 것인지를 입력할 수 있어야 합니다.
- 전진하는 조건은 0에서 9 사이에서 random 값을 구한 후 random 값이 4 이상일 경우입니다.
- 자동차의 상태를 화면에 출력합니다. 어느 시점에 출력할 것인지에 대한 제약은 없습니다.

### 실행 결과

위 요구사항에 따라 3대의 자동차가 5번 움직였을 경우 프로그램을 실행한 결과는 다음과 같습니다.

## 코드 구성

자동차 구현

- Car.java

```java
package study.step3;

import java.util.Random;

public class Car {
    private StringBuilder move;
    private static final Random random  = new Random();
    private static final int STARTING_CONDITION = 4;
    private static final int RANDOM_RANGE = 10;
    private static final String MOVE = "-";

    Car() {
        move = new StringBuilder();
    }

    public void calcMove() {
        moveCar(isMove(random.nextInt(RANDOM_RANGE)));
    }

    public Boolean isMove(int input) {
        if (input >= STARTING_CONDITION) {
            return true;
        }
        return false;
    }

    public void moveCar(boolean moveResult) {
        if (moveResult) {
            move.append(MOVE);
        }
    }

    public String getMoveValue() {
        return move.toString();
    }
}
```

트랙 구현

- Track.java

```java
package study.step3;

import java.util.ArrayList;
import java.util.List;

public class Track {
    private List<Car> cars = new ArrayList<>();
    private int attemptCount;
    private ResultView resultView;

    Track( int attemptCount, ResultView resultView) {
        this.attemptCount = attemptCount;
        this.resultView = resultView;
    }

    public void setCar(int count) {
        for (int i = 0; i < count; i++) {
            cars.add(new Car());
        }
    };

    public void startRacing() {
        for (int i = 0; i < attemptCount; i++) {
            startCar(cars);
            resultView.outPut(cars);
        }
    }

    public void startCar(List<Car> cars) {
        for(int i = 0; i < cars.size(); i++) {
            cars.get(i).calcMove();
            cars.get(i).getMoveValue();
        }
    }

    public int getCarsCount() {
        return cars.size();
    }

    public int getAttemptCount() {
        return attemptCount;
    }

}
```

입력 화면

- InputView.java

```java
package study.step3;

import java.util.Scanner;

public class InputView {
    private static final Scanner scanner = new Scanner(System.in);
    private int carCount;
    private int attemptCount;

    public void inputNumberOfCars() {
        System.out.println("자동차 대수는 몇 대 인가요?\n");
        carCount = scanner.nextInt();
    }

    public void inputNumberOfAttempts() {
        System.out.println("시도할 회수는 몇 회 인가요?\n");
        attemptCount = scanner.nextInt();
    }

    public int getCarCount() {
        return carCount;
    }

    public int getAttemptCount() {
        return attemptCount;
    }
}
```

출력화면

- Result.java

```java
package study.step3;

import java.util.List;

public class ResultView {
    public void outPut(List<Car> cars) {
        System.out.println("START============");
        for (Car car : cars) {
            System.out.println(car.getMoveValue());
        }
        System.out.println("END============");
    }
}
```

## 피드백

리뷰어: 자동차의 위치를 `-`와 같은 기호로 변경해 출력하는 것은 View 클래스가 처리하는 것이 좋다는 의견을 받았습니다.

생각정리: 화면이 변경되어도 클래스 로직은 변경되지 않도록 철저하게 뷰를 분리하는 것이 좋겠습니다.

```java
import java.util.Random;

public class Car {
    private StringBuilder move;
```

다음과 같이 변경했습니다.

```java
package study.step3;

import java.util.Random;

public class Car {
    private int move = 0;
    private static final Random random = new Random();
    private static final int STARTING_CONDITION = 4;
    private static final int RANDOM_RANGE = 10;
    private int attemptCount = 0;
```

출력에서 화면에 노출되는 `-`는 뷰로 분리했습니다.

```java
package study.step3;

import java.util.List;

public class ResultView {
    public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            changeCarMoveToString(stringBuilder, car);
            stringBuilder.append("\n");
        }
        System.out.println(stringBuilder);
    }

    private static void changeCarMoveToString(StringBuilder stringBuilder, Car car) {
        for (int i = 0; i < car.getMove(); i++) {
            stringBuilder.append("-");
        }
    }
}
```

리뷰어: 객체지향 생활 체조 원칙 중 `원칙 줄여쓰지 않는다(축약 금지)`를 언급하며, `calc`와 같은 축약어보다는 완전한 언어를 쓰는 것이 좋다는 의견을 받았습니다.

생각정리: 실무에서는 계산할 때 `calc`라는 표현을 많이 써온 것 같습니다. 하지만 이동하는 함수라면 `calcMove`보다는 자동차 입장에서 `move`라는 행위로 보는 것이 좋다는 의견이 있었습니다. 맞는 말인 것 같고, 주체가 누구인지를 고려하며 더 생각해봐야겠습니다.

```java
	move = new StringBuilder();
}

public void calcMove() {
```

다음과 같이 변경했습니다.

```java
public void move() {
	if (isMove(random.nextInt(RANDOM_RANGE))) {
	    move++;
	}
  attemptCount++;
}
```

리뷰어: 단위 테스트를 작성할 때 경계 조건을 테스트하면 좋겠다는 의견을 받았습니다. 자동차의 이동 여부를 결정하는 기준값이 `4`이므로, `4`를 전달했을 때 이동하는지, `3`을 전달했을 때 멈추는지를 검증하는 것이었습니다.

생각정리: TDD를 하지 않아서 어떤 경계를 테스트해야 하는지 아직 부족한 것 같습니다. 객체의 입장에서 값을 결정하는 부분을 테스트하려고 노력하겠습니다.

```java
for (int i = 0; i < 10; i++) {
            if (i >= 4) {
                //when
                move = car.isMove(i);
                //then
                assertThat(move).isEqualTo(true);
            }
        }
```

다음과 같이 변경했습니다.

```java
@Test
public void 자동차테스트_이동() {
    //given
    Boolean move;

    for (int i = 0; i < 10; i++) {
        if (i >= 4) {
            //when
            move = car.isMove(i);
            //then
            assertThat(move).isEqualTo(true);
        }
    }
}

@Test
public void 자동차이동테스트_멈춤() {
    //given
    Boolean move;

    for (int i = 0; i < 4; i++) {
        if (i < 4) {
            //when
            move = car.isMove(i);
            //then
            assertThat(move).isEqualTo(false);
        }
    }
}
```

리뷰어: `Track` 인스턴스를 생성할 때 자동차를 대수만큼 생성해서 전달하는 방법을 제안받았습니다. 누군가 실수로 `setCar()`를 호출하지 않으면 의도치 않은 결과가 발생할 수 있다는 이유였습니다.

생각정리: 트랙 입장에서 자동차를 설정한다는 느낌으로 `set`을 사용했지만, 좋은 방식이 아님에도 의미적으로 나쁘지 않다고 생각해 작성했습니다. 처음에는 생성자로 했었는데, 역시 `set`은 의도치 않은 결과를 발생시킬 여지가 충분하므로 생성자를 사용하겠습니다.

```java
public void setCar(int count) {
    for (int i = 0; i < count; i++) {
        cars.add(new Car());
    }
};
```

다음과 같이 변경했습니다.

```java
Track(int carCount, int finish) {
        this.finish = finish;
        for (int i = 0; i < carCount; i++) {
            cars.add(new Car());
        }
    }
```

리뷰어: 정적 메서드만을 갖는 유틸리티 클래스이니 `private` 생성자를 추가하는 것을 제안받았습니다. 참고 자료로 [이펙티브 자바 아이템 4. 인스턴스화를 막으려거든 private 생성자를 사용하라](https://velog.io/@lychee/이펙티브-자바-아이템-4-인스턴스화를-막으려거든-private-생성자를-사용하라)를 공유받았습니다.

생각정리: 한 번도 정적 메서드만 있다고 해서 막으려고 생각해본 적이 없습니다. 메모리에 올라가 있기 때문에 바로 사용할 수 있었는데, 생성자도 막는 것이 더 안전하다는 것을 알게 되었습니다.

생성자를 막는 것이 안전한 이유는, 생성자를 명시하지 않으면 컴파일러가 기본 생성자를 구현하기 때문에 상속받아서 인스턴스화를 할 수 있기 때문입니다. 이것도 막기 위해 `private` 생성자를 만듭니다.

```java
package study.step3;

import java.util.List;

public class ResultView {
    public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            changeCarMoveToString(stringBuilder, car);
            stringBuilder.append("\n");
        }
        System.out.println(stringBuilder);
    }

    private static void changeCarMoveToString(StringBuilder stringBuilder, Car car) {
        for (int i = 0; i < car.getMove(); i++) {
            stringBuilder.append("-");
        }
    }
}
```

다음과 같이 변경했습니다.

```java
public class InputView {

    private InputView() {
        // 생성자 내부 호출 -> 명시적 Exception
        throw new AssertionError();
    }
```

## 피드백 이후 소스코드

자동차 구현

- Car.java

```java
package study.step3;

import java.util.Random;

public class Car {
    private int move = 0;
    private static final Random random = new Random();
    private static final int STARTING_CONDITION = 4;
    private static final int RANDOM_RANGE = 10;
    private int attemptCount = 0;
    private int finish;

    Car(int finish) {
        this.finish = finish;
    }

    public void move() {
        moveCar(isMove(random.nextInt(RANDOM_RANGE)));
        attemptCount++;
    }

    public Boolean isMove(int input) {
        return input >= STARTING_CONDITION;
    }

    public void moveCar(boolean moveResult) {
        if (moveResult) {
            move++;
        }
    }

    public Boolean isFinish() {
        return finish == attemptCount;
    }

    public int getMove() {
        return move;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

}
```

트랙 구현

- Track.java

```java
package study.step3;

import java.util.ArrayList;
import java.util.List;

public class Track {
    private List<Car> cars = new ArrayList<>();

    Track(int carCount, int finish) {
        for (int i = 0; i < carCount; i++) {
            cars.add(new Car(finish));
        }
    }

    public void startRacing() {
        for (Car car : cars) {
            car.move();
        }
    }

    public Boolean isRaceEnd() {
        int lastCarNumber = cars.size() - 1;
        return cars.get(lastCarNumber).isFinish();
    }

    public List<Car> getCars() {
        return cars;
    }

}
```

입력 화면

- InputView.java

```java
package study.step3;

import java.util.Scanner;

public class InputView {

    public static Scanner createScanner() {
        return new Scanner(System.in);
    }

    public static void askCarCount() {
        System.out.println("자동차 대수는 몇 대 인가요?\n");
    }

    public static void aksFinishCount() {
        System.out.println("마지막 바퀴는 몇바퀴 인가요?\n");
    }
}
```

출력화면

- Result.java

```java
package study.step3;

import java.util.List;

public class ResultView {
    public static void outPut(Track track) {
        StringBuilder stringBuilder = new StringBuilder();
        List<Car> cars = track.getCars();
        for (Car car : cars) {
            changeCarMoveToString(stringBuilder, car);
            stringBuilder.append("\n");
        }
        System.out.println(stringBuilder);
    }

    private static void changeCarMoveToString(StringBuilder stringBuilder, Car car) {
        for (int i = 0; i < car.getMove(); i++) {
            stringBuilder.append("-");
        }
    }
}
```

## 후기

오늘은 자동차 경주를 만들었습니다. 혼자 생각하는 것보다 누군가와 함께한다는 것이 정말 큰 도움이 된다는 것을 다시 한번 느꼈습니다. 잘 굴러가면 되는 것이 아니라 모르는 사람도 보고 수정할 수 있게, 그리고 안전하게 만드는 것이 대단한 일이라는 것을 다시 한번 느꼈습니다. 많이 물어보고 많이 배워서 유지보수하기 쉬운 소스를 지향하겠습니다.

깃허브 링크: [https://github.com/next-step/java-racingcar/pull/4367](https://github.com/next-step/java-racingcar/pull/4367)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
