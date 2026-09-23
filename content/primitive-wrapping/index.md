---
title: "원시값 포장"
tags: ["Java","클린 코드","원시값 포장","값 객체","객체지향"]
summary: "원시 타입 변수를 값 객체로 감싸면 유효성 검증 책임이 객체 안으로 옮겨져 코드가 더 명확해지는 이유를 예제로 설명합니다."
---

변수를 선언하는 방법에는 두 가지가 있습니다.

원시 타입 변수를 선언하는 것과, 원시 타입의 변수를 객체화하는 것입니다.

원시 타입의 변수를 객체화하는 것에 어떤 이점이 있는지 확인해 보겠습니다.

1. **객체 내부에서 유효성 값을 체크할 수 있습니다.**

```java
public Car(String name) {
    checkName(name);
    this.name = name;
}

public void checkName(String name) {
        if (name.length() > 5) {
            throw new IllegalArgumentException("이름이 다섯자 이상입니다.");
        }
    }
```

예를 들면 위와 같은 자동차 객체에 이름이 변수로 선언되어 있다고 하면, 해당하는 값이 유효한지 체크하는 것은 자동차 객체 안에서 값을 체크해야 될 것입니다. 이름 변수 한 개만 있다면 그나마 다행이겠지만, 여러 가지의 값들이 있다고 생각하면 모든 유효성 체크를 자동차에게 전달하게 될 것입니다.

```java
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

하지만 원시 타입의 변수를 객체로 만들게 된다면, 자연스럽게 원시 타입의 유효성 체크가 객체로 들어가게 되고, Car 객체에는 순수하게 자동차에 대한 유효성 및 로직들이 담기게 됩니다. → 이렇게 하면 관리하는 측면에서도 좀 더 명확하게 신규 기능 추가 및 수정을 할 수 있습니다.

후기

오늘은 원시값 포장에 대해 리뷰받게 되었습니다. 좀 더 추가적인 내용도 검색해서 보았지만, 아직 실습에 적용하지는 않았기 때문에 추가로 작성하게 될 때 이어서 작성하도록 하겠습니다.
