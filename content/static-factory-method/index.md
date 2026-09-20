---
title: "정적 팩토리 메소드 패턴"
tags: ["정적팩토리메서드", "디자인패턴", "Java", "리팩토링", "네이밍컨벤션"]
summary: "정적 팩토리 메소드 패턴으로 객체 생성 로직을 캡슐화하는 방법과, from·of·getInstance 등 네이밍 컨벤션을 정리합니다."
---

정적 메소드 패턴이란 객체 생성의 역할을 하는 클래스 메서드라는 의미로 요약할 수 있습니다.

아래 트랙에서 Cars 객체를 생성할 때, 아래와 같이 for문을 돌면서 Cars를 추가하고 있습니다.

아래와 같이(정적 팩토리 메소드 패턴을 사용하지 않을 때) 작성하면 한눈에 보기에도 불편하다고 생각될 것입니다. 정적 팩토리 메소드 패턴을 사용하면 생성할 때 진행해야 할 로직들이 내부로 숨겨지는 것을 볼 수 있고, from을 통해 Cars가 만들어진다는 것을 의미적으로도 파악할 수 있습니다.

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

- 다음과 같이 변경합니다.

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
        }ㅇㅇ
    ```

이외에도 장점이 더 있지만, 직접 사용해보고 느낀 점이 생기면 추가로 적어보겠습니다.

정적 팩토리 메서드 네이밍 컨벤션

- `from` : 하나의 매개 변수를 받아서 객체를 생성
- `of` : 여러개의 매개 변수를 받아서 객체를 생성
- `getInstance` | `instance` : 인스턴스를 생성. 이전에 반환했던 것과 같을 수 있음.
- `newInstance` | `create` : 새로운 인스턴스를 생성
- `get[OtherType]` : 다른 타입의 인스턴스를 생성. 이전에 반환했던 것과 같을 수 있음.
- `new[OtherType]` : 다른 타입의 새로운 인스턴스를 생성.

참고: [https://tecoble.techcourse.co.kr/post/2020-05-26-static-factory-method/](https://tecoble.techcourse.co.kr/post/2020-05-26-static-factory-method/)
