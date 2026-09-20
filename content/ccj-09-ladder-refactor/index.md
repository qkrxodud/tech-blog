---
title: "사다리 리팩터링 — 4단계"
tags: ["클린 코드", "TDD", "자바", "사다리 게임", "리팩터링"]
summary: "사다리 게임 코드를 리팩터링하며 방어적 복사와 전략 인터페이스 설계에 대한 리뷰 피드백을 정리합니다."
---

## 기능 요구사항

기능 요구사항은 3단계와 같습니다.

### 실행 결과

위 요구사항에 따라 4명의 사람을 위한 5개 높이 사다리를 만들 경우, 프로그램을 실행한 결과는 다음과 같습니다.

```java
참여할 사람 이름을 입력하세요. (이름은 쉼표(,)로 구분하세요)
pobi,honux,crong,jk

실행 결과를 입력하세요. (결과는 쉼표(,)로 구분하세요)
꽝,5000,꽝,3000

최대 사다리 높이는 몇 개인가요?
5

사다리 결과

pobi  honux crong   jk
    |-----|     |-----|
    |     |-----|     |
    |-----|     |     |
    |     |-----|     |
    |-----|     |-----|
꽝    5000  꽝    3000

결과를 보고 싶은 사람은?
pobi

실행 결과
꽝

결과를 보고 싶은 사람은?
all

실행 결과
pobi : 꽝
honux : 3000
crong : 꽝
jk : 5000
```

## 피드백

리뷰어: 이 모델의 역할은 `lines` 상태를 변경하는 것 같습니다. 객체 참조를 통해 외부에서 받아온 객체의 상태를 변경하다 보면 해당 객체가 어떻게 변경되는지 파악하기 어려워집니다. 또한 `LadderGameController`에서도 내부 상태가 변경될 것을 예상하고 `lines`를 활용하고 있어서 결국 `Ladder`의 캡슐화가 깨진 것이 아닌지 지적받았습니다. 내부 데이터를 보호하고 참조값 공유를 끊기 위해 방어적 복사를 이용하는 방향을 제안받았고, 참고 자료로 [[얕은복사 / 깊은복사] 방어적 복사란 ?](https://velog.io/@miot2j/얕은복사-깊은복사-방어적-복사란)를 공유받았습니다.

```java
public void playGame() {
        IntStream.range(0, players.getPlayerCount())
                .forEach(index -> lines.getConnectNumber(players.getPlayers().get(index)));
                .forEach(index -> lines.move(players.getPlayers().get(index)));
    }
```

방어적 복사를 사용하는 이유는 객체의 취약점을 보완하기 위해서입니다(내부 데이터를 보호하고 참조값 공유를 끊기 위해 사용합니다).

생각정리: 주소값으로 연결되어 있다는 것은 알았지만, 방어적 복사를 통해 데이터를 보호한다는 것은 처음 알게 되었습니다. 알아두면 보호 목적으로 잘 사용할 수 있을 것 같습니다.

```java
public Ladder(Players players, Lines lines) {
        this.players = new Players(players.getPlayers());
        this.lines = new Lines(lines.getLines());
    }

    public void playGame() {
        players.move(lines);
    }
```

리뷰어: 메서드의 역할에 비해 메서드명이 어색하다는 의견을 받았습니다. 내부에는 특별한 조건이 있지만 클라이언트 입장에서는 그냥 왼쪽으로 옮겨갈 것이라고 생각될 수 있다는 이유였습니다.

```java
public void moveLeft(List<Boolean> points) {
        if (points.get(point - 1)) {
            point += Direction.LEFT.value;
        }
    }
```

생각정리: 왼쪽으로 움직이는 행위만 작동시키면 되는데, if까지 엮이면서 오해의 소지가 있다고 생각합니다.

```java
public void moveLeft() {
        point += LEFT;
    }	
```

리뷰어: `public enum`으로 분리한 이유를 질문받았습니다. 내부에서만 사용되고 있고 결국 `value`만 바로 꺼내 사용하고 있어서 장점이 없어 보인다는 의견이었습니다.

```java
public enum Direction {
        LEFT(-1),
        RIGHT(1);

        private final int value;

        Direction(int value) {
            this.value = value;
        }

    }
```

생각정리: 아무런 동작을 하지 않는다면 정적 변수로 선언해서 사용해도 되는데, 굳이 변경하는 이유를 물어본 것 같습니다. enum의 함수에서 동작을 처리하도록 하거나, 정적 변수를 사용해서 작성하겠습니다.

```java
public class Player {
    private static final int LEFT = -1;
    private static final int RIGHT = 1;
```

리뷰어: 내부에서 `ConnectionStrategy`를 직접 생성하고 사용하고 있어서 인터페이스로 분리한 장점이 없어 보인다는 의견을 받았습니다. 이 객체에서 `Random` 요소를 분리하기 위해 외부에서 주입받는 방법을 제안받았습니다.

```java
IntStream.range(RANGE_START, rangeEnd)
                .forEach(count -> {
                    if (count == ZERO || !points.get(count - 1)) {
                        connectLine(() -> RANDOM.nextBoolean());
                        return;
                    }
                    connectLine(() -> false);
                });
    }

    public void connectLine(ConnectionStrategy connectionStrategy) {
        if (connectionStrategy.isConnection()) {
            points.add(true);
            return;
        }
        points.add(false);
    }
```

생각정리: 익명 클래스를 사용해서 외부에서 주입받는 형식으로 코드를 작성했는데, 정작 사용하는 곳이 내부이니 장점이 나오지 않는 것 같습니다. 외부에서 사용해서 전달해주는 방식으로 변경하고, 유연하게 대처할 수 있게 구현하겠습니다.

```java
public void connectLine(ConnectionStrategy connectionStrategy) {
      if (connectionStrategy.isConnection()) {
          points.add(true);
          return;
      }
      points.add(false);
  }
```

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
