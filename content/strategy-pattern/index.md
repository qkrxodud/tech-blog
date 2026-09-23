---
title: "전략 패턴"
tags: ["디자인 패턴","전략 패턴","의존성 주입","리팩터링"]
summary: "전략 패턴을 활용해 자동차 이동 로직의 랜덤 값 생성 부분을 인터페이스로 분리하고, 의존성 주입으로 유연하게 교체하는 방법을 정리합니다."
---

전략 패턴은 알고리즘들의 패밀리를 정의하고, 각 패밀리를 별도의 클래스에 넣은 후 그들의 객체들을 상호교환할 수 있도록 하는 행동 디자인 패턴입니다.

아래 소스코드를 살펴보겠습니다.

현재 상황: move의 randomInt 값이 0~10 사이의 값입니다.

클라이언트 요청사항: 예) 랜덤 값의 범위를 0~10이 아닌 0~100으로 늘려주세요.

변경하려면 수정해야 할 영역이 많아집니다. 이때 전략 패턴을 사용하면 다음과 같이 개선할 수 있습니다.

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

- 다음과 같이 변경합니다.
    - 자동차에서는 인터페이스로 정의하여 DI(의존성 주입)로 구현하고,
    - 외부에서 해당 인터페이스를 구현하여 move의 값을 전달합니다.
    - 이제 언제든지 해당 값들을 인터페이스를 구현해서 유연하게 구현할 수 있습니다.
    
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
    

### 후기

오늘은 전략 패턴을 이용하여 클래스의 중요한 역할을 하는 부분을 유연하게 변경했습니다. 전략 패턴을 사용하면 테스트 코드도 유연하게 작성할 수 있을 뿐만 아니라, 언제든지 클라이언트 요청에 대해 유연하게 변경할 수 있을 것 같습니다. 이 점을 잘 인지하고 핵심 기능에 적용하면 좋을 것 같다는 생각이 들었습니다.
