---
title: "[인프런 워밍업 클럽 백엔드 스터디 2기] 1주차 발자국"
tags: ["인프런 워밍업 클럽", "회고", "클린코드", "추상화", "SOLID"]
summary: "인프런 워밍업 클럽 백엔드 스터디 2기 1주차 회고로, 추상화와 이름 짓기, SOLID 원칙을 적용해 주문 검증 로직을 리팩터링한 과정을 정리합니다."
---

기존에 프로젝트를 진행하면서 테스트 코드를 작성하고 싶은 니즈가 있었기 때문에, 여러 인터넷 강의를 보던 중 **[Practical Testing: 실용적인 테스트 가이드]**라는 인터넷 강의를 보게 되었습니다. 책으로 보던 테스트 코드와 다르게 실무에서 어떻게 사용하는지 상세하게 설명해 주는 것이 좋아 완강하게 되었고, 실무에서도 직접 사용하였습니다.

2개월 후 이메일을 통해 인프런 워밍업 클럽이라는 메일을 확인하게 되었습니다. 업무와 개인 프로젝트를 진행하느라 바쁘지만 다른 사람들의 개발 방식과 내가 개발적으로 놓치고 있는 것이 많을 것이라는 생각에 참여하게 되었습니다.

### **Day 2 "추상과 구체"**

1. "추상과 구체"에 대하여 인터넷 강의를 듣고 작성하게 되었습니다.

```erlang
스타크래프트 배럭의 유닛 생성 과정

1. 유닛 생성 주문
사용자가 배럭에서 어떤 유닛을 생성할지 선택하는 단계입니다. 배럭에서는 마린, 파이어뱃, 매딕, 고스트 등 다양한 유닛을 생성할 수 있으며, 선택 방식은 마우스 클릭이나 단축키를 통해 이루어집니다. 핵심은 배럭이 "유닛 생성 주문"을 받기만 하면, 그 다음 과정은 자동으로 진행된다는 점입니다.

2. 유닛 생성
유닛이 생성되는 과정입니다. 각 유닛마다 사용하는 무기나 특성이 다르지만, 결국 배럭에서 유닛이 "생성된다"는 본질적인 행위는 동일합니다. 예를 들어, 마린은 총을 쏘고, 파이어뱃은 화염방사기를 쓰고, 고스트는 저격총을 들고 있지만, 이 모든 유닛들은 결국 배럭에서 생성된다는 공통점을 가지고 있습니다.

3. 유닛 생성 알림
유닛이 완성되면 사용자에게 이를 알려주는 단계입니다. 사운드를 통해 알릴 수도 있고, 미니맵에 표시될 수도 있습니다. 중요한 것은 유닛이 생성되었음을 사용자에게 확실히 전달하는 것입니다.

정리
배럭에서 유닛을 생성하는 과정은 크게 "유닛 생성 주문 → 유닛 생성 → 유닛 생성 알림"의 흐름을 따릅니다. 유닛마다 특성은 다르지만, 이 과정은 본질적으로 동일하며, 이를 통해 유닛 생성의 핵심 개념을 추상화할 수 있습니다.
```

**추상과 구체에서 제가 생각했던 핵심은**

추상화는 중요한 정보는 가려내어 남기고, 덜 중요한 정보는 생략하여 버린다는 말이었습니다. 그렇다면 어떻게 하면 이런 추상화를 잘하는 방법이 있을까라는 생각을 하게 되었습니다.

1. 이름 짓기
    1. **이름을 짓는다는 행위**는 **추상적 사고를 기반**으로 합니다. 표현하고자 하는 구체에서 **정말 중요한 핵심 개념만을 추출**하여 잘 드러내게 표현한다는 말입니다. 그렇다면 어떻게 하면 이름을 잘 지을 수 있을까요?
        1. 단수와 복수를 구분하고
        2. 이름을 줄이지 않고
        3. 은어/방언을 사용하지 않고
        4. 좋은 코드를 보고 습득하는 것입니다.
2. 추상화 레벨
    1. 고수준 레벨은 소스코드의 전반적인 흐름에 대한 내용입니다.
    2. 저수준 레벨은 세부사항에 대해 작성하는 코드입니다.

제가 현재까지 협업했던 실무에서 생각보다 추상화 레벨이 비슷한 분류로 묶여있던 프로젝트는 별로 없었던 것 같습니다. 함수로 호출하기 전에 for, if, while 저수준의 추상화 레벨에서 고수준의 추상화 레벨을 동작시키는 경우도 많았고, [고수준 > 저수준 > 고수준 > 저수준]으로 들어가는 함수들이 즐비하게 있었습니다. 그렇다면 **어떻게 하면 일관성 있게 추상화 레벨을 지킬 수 있을까**라는 생각을 하게 되었습니다.

![](https://cdn.inflearn.com/public/files/posts/cd66c914-fa4f-4455-b8de-e3cf524657d8/a62e16f6-d39a-491f-9f5f-1ec3b68caa7b.png)

이는 **소스코드의 수정과 변경을 무서워하면 안 되는 것** 같습니다. 예를 들면 초기에 코드를 작성하다가 기획서가 변경될 수도 있고, 스스로 잘못 구성하다 문득 좋은 방법이 떠오를 수도 있습니다. 이때 벌써 많은 시간과 코드를 구성해서 알고 있으면서도 넘어가는 경우가 저 또한 많았습니다. 하지만 결국에는 우회해서 코드의 추상화 레벨을 맞추지도 않고 작성했던 코드들이 미래에는 분석하기도 힘들고, 수정하고 있는 제 자신을 발견하니 넘어가면 안 되겠구나 생각하게 되었고, **현재는 시간이 걸리더라도 변경하고 추상화 레벨을 인지하면서 작성하려고 노력**하고 있습니다.

### **Day 4 SOLID를 활용하여 아래 코드를 수정**

S - **Single Responsibility Principle (SRP)** : 정의: 클래스는 단 하나의 책임만 가져야 합니다.

O - **Open/Closed Principle (OCP)** : 소프트웨어 엔티티는 확장에는 열려 있어야 하지만 수정에는 닫혀 있어야 합니다.

L - **Liskov Substitution Principle (LSP)** : 자식 클래스는 부모 클래스에서 호출하는 동작에 대체가 가능해야 합니다.

I - **Interface Segregation Principle (ISP)** : 하나의 일반적인 인터페이스보다는 여러 개의 구체적인 인터페이스가 더 좋다.

D - **Dependency Inversion Principle (DIP)** : 고수준 모듈은 저수준 모듈에 의존해서는 안 되며, 둘 다 추상화에 의존해야 합니다.

```java
public boolean validateOrder(Order order) {
    if (order.getItems().size() == 0) {
        log.info("주문 항목이 없습니다.");
        return false;
    } else {
        if (order.getTotalPrice() > 0) {
            if (!order.hasCustomerInfo()) {
                log.info("사용자 정보가 없습니다.");
                return false;
            } else {
                return true;
            }
        } else if (!(order.getTotalPrice() > 0)) {
            log.info("올바르지 않은 총 가격입니다.");
            return false;
        }
    }
    return true;
}
```

**관점 지향으로 변경**

클래스에는 단 하나의 책임만 가져야 합니다.

현재 클래스 전체가 작성되어 있지는 않지만, 각각의 유효성 체크를 `Order`에서만 진행하는 것이 과연 단 하나의 책임인가?라는 생각이 들었습니다.

그래서 아래와 같이 `item`, `items`, `user` 3개의 객체를 만들고 역할과 책임을 분리해 작성했습니다.

item.java

```kotlin
@Getter
public class Item {
    private Long id;
    private String name;
    private BigDecimal price;

    @Builder
    public Item(Long id, String name, BigDecimal price) {
        this.id = id;
        this.name = name;
        this.price = price;
    }
}
```

Items.java

```java
public class Items {
    private final List<Item> itemList;

    public Items(List<Item> itemList) {
        this.itemList = List.copyOf(itemList);
    }

    boolean isItemNotAvailable() {
        return CollectionUtils.isEmpty(itemList);
    }

    public boolean isInvalidTotalPrice() {
        return calculateTotalPrice().compareTo(BigDecimal.ZERO) < 0;
    }

    private BigDecimal calculateTotalPrice() {
        return itemList.stream()
                .map(Item::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
```

User.java

```kotlin
@Getter
public class User {
    private Long id;
    private String name;

    @Builder
    public User(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public boolean isNullCustomerInfo() {
        return Objects.isNull(id);
    }

}
```

이를 통해 아래의 `validateOrder`에서 어떤 데이터가 올바르지 않은지 한눈에 볼 수 있게 변환했습니다.

```java
@Slf4j
@Getter
public class Order {
    private Items items;
    private User user;

    @Builder
    public Order(Items items, User user) {
        this.items = items;
        this.user = user;
    }

    public boolean validateOrder() {
        if (items.isItemNotAvailable()) {
            log.info("주문 항목이 없습니다.");
            return false;
        }

        if (items.isInvalidTotalPrice()) {
            log.info("올바르지 않은 총 가격입니다.");
            return false;
        }

        if (user.isNullCustomerInfo()) {
            log.info("사용자 정보가 없습니다.");
            return false;
        }

        return true;
    }
}
```

### **지속하고 싶은 부분**

이제 1주 차 발자국을 완료했습니다. 클린 코드에 다시 생각해 볼 수 있는 기회였으며 강의 내용은 하나같이 전부 필요한 내용이라고 생각됩니다. 습관이라는 게 마음대로 쉽게 변하지 않는다고 생각합니다. 인지하고 변화하려는 끊임없는 노력이 필요하다고 생각되고, 회고를 통해 항상 볼 수 있는 예제를 잘 만들어놓으면 크게 도움이 된다고 생각하고 작성하도록 하겠습니다.

### **아쉬웠던 점**

아직 1주 차이지만 생각보다 혼자 하고 있다는 생각이 더 드는 것 같습니다. 다른 사람들이 작성한 내용은 볼 수 있어서 좋았지만 생각보다 피드백이 없었던 것 같습니다. 1기, 2기, 3기 이후에 좋은 개발자분들과 함께 피드백을 많이 받을 수 있으면 좋겠다는 생각이 들었고, 저 또한 노력하도록 하겠습니다.

### **시도해볼 점**

앞으로 많이 남았지만 완강하고, 미션을 완료하게 된다면 여기에서 머무르는 것이 아니라 주도적으로 회사에서도 진행해 봐도 좋을 것 같습니다. 남들에게 공유해 주면서 많은 지식을 쌓을 수 있을 것 같습니다.

감사합니다.

---

## **실용적인 테스트와 클린 코드 학습 회고**

## **학습 배경**

- [Practical Testing: 실용적인 테스트 가이드] 강의를 수강하며 실무에서 적용 가능한 테스트 작성법 학습
- 인프런 워밍업 클럽 참여를 통한 추가 학습 진행

## **Day 2: "추상과 구체" 학습 내용**

### **스타크래프트 배럭의 유닛 생성 과정 예시**

1. **유닛 생성 주문**
    - 사용자가 배럭에서 유닛(마린, 파이어뱃, 매딕, 고스트 등) 선택
    - 마우스 클릭이나 단축키로 주문
    - 주문 후 과정은 자동 진행
2. **유닛 생성**
    - 각 유닛별 특성은 다르지만 '생성'이라는 본질적 행위는 동일
    - 예: 마린(총), 파이어뱃(화염방사기), 고스트(저격총)
3. **유닛 생성 알림**
    - 사운드나 미니맵 표시를 통한 알림
    - 사용자에게 명확한 피드백 제공

### **추상화에 대한 인사이트**

1. **추상화의 핵심**
    - 중요 정보는 유지하고 덜 중요한 정보는 생략
2. **효과적인 이름 짓기 원칙**
    - 단수/복수 구분하기
    - 축약어 사용 피하기
    - 은어/방언 사용 피하기
    - 좋은 코드 참고하기
3. **추상화 레벨**
    - 고수준: 전반적인 흐름
    - 저수준: 세부 구현 사항
4. **실무 적용시 개선점**
    - 일관된 추상화 레벨 유지
    - 필요시 과감한 리팩토링
    - 코드 수정을 두려워하지 않기

## **Day 4: SOLID 원칙 적용 실습**

### **SOLID 원칙 요약**

- **SRP**: 단일 책임 원칙
- **OCP**: 개방-폐쇄 원칙
- **LSP**: 리스코프 치환 원칙
- **ISP**: 인터페이스 분리 원칙
- **DIP**: 의존관계 역전 원칙

### **코드 리팩토링 예시**

리팩토링 전 코드에서 다음과 같이 개선:

1. **역할 분리**
    - Item: 상품 정보 관리
    - Items: 상품 목록 및 검증
    - User: 사용자 정보 및 검증
    - Order: 주문 검증 통합

## **회고**

### **좋았던 점**

- 클린 코드에 대한 새로운 시각 획득
- 실무 적용 가능한 구체적 예제 학습
- 지속적인 개선을 위한 동기부여

### **아쉬운 점**

- 참여자 간 피드백 부족
- 보다 활발한 상호작용 필요

### **향후 계획**

1. 강의 완강 및 미션 수행
2. 학습 내용 회사 업무 적용
3. 동료들과 지식 공유
