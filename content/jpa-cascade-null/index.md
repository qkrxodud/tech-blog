---
title: "[Java] Spring JPA 1:N 일급컬렉션 Cascade insert시 null 발생"
tags: ["JPA", "Cascade", "CascadeType.MERGE", "일급컬렉션", "OneToMany"]
summary: "일급컬렉션에 Cascade를 적용했을 때 자식 엔티티 Id가 null로 저장되는 문제와 CascadeType.MERGE로 해결하는 방법을 소개합니다."
---

### [문제발생]

> 오늘은 기존 프로젝트에 서비스 로직이 너무 많아서 일급컬렉션을 적용하면서 **insert시 자식의 엔티티 Id 값이 null로 들어가는 현상이 발생하였습니다.**

**Parent 객체**

```java
@Entity
@Table
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Parent {
		...
		@Embedded
    private Childs childs = new Childs();
}
```

**Childs 객체**

```java
@Embeddable
@NoArgsConstructor
@Getter
public class Childs {
		@OneToMany(mappedBy = "monitoring", cascade = {CascadeType.PERSIST}, orphanRemoval = true)
    private List<InspectionMemo> inspectionMemos = new ArrayList<>();
		...
}
```

**Child 객체**

```java
@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class Child {
		...

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monitoring_id")
    private Monitoring monitoring;

...
}
```

**Test Code**

```java
@Test
@Transactional
public void 저장테스트_2() {
    Parent parent = parentRepository.findById(6L);
    Child child = new Child(parent, 12L);
    parent.getChilds().add(child);

    parentRepository.save(parent);
    Assertions.assertThat(parentRepository.findById(6L).getChilds().size()).isEqualTo(1);
}
```

### [문제 원인]

CascadeType.MERGE로 선언하지 않았기 때문입니다.

1. 연관된 엔터티의 업데이트 전파: CascadeType.MERGE를 사용하면 부모 엔터티를 저장(영속화)하거나 병합할 때, 해당 부모 엔터티와 연관된 자식 엔터티도 함께 저장 또는 병합됩니다. 이로써 연관된 자식 엔터티의 변경 내용이 부모 엔터티와 함께 데이터베이스에 반영됩니다.
2. 엔터티 상태의 동기화: CascadeType.MERGE를 사용하면 영속성 컨텍스트 내에서 엔터티의 상태를 데이터베이스와 동기화하는 데 도움이 됩니다. 엔터티 상태의 변경을 컨텍스트에서 관리하는 동안에도 데이터베이스에 변경 내용을 적용할 수 있습니다.
3. 예시: 예를 들어, 주문(Order) 엔터티와 주문 상세 정보(OrderDetail) 엔터티가 있을 때, CascadeType.MERGE를 사용하면 주문 엔터티를 저장하거나 병합할 때 관련된 주문 상세 정보도 함께 저장 또는 병합됩니다. 이로써 주문과 주문 상세 정보 간의 관계를 유지하며 업데이트할 수 있습니다.

CascadeType.MERGE를 사용하지 않는 경우:

1. 연관된 엔터티의 업데이트 전파가 일어나지 않음: CascadeType.MERGE를 사용하지 않는다면 부모 엔터티의 변경이 자식 엔터티로 전파되지 않습니다. 따라서 부모 엔터티를 저장 또는 병합할 때, 연관된 자식 엔터티는 자동으로 업데이트되지 않으며, 개발자가 별도로 관리해야 합니다.
2. 부모-자식 엔터티의 일관성 유지가 어려움: CascadeType.MERGE를 사용하지 않는 경우, 부모와 자식 엔터티 간의 연관관계를 유지하기 위해 개발자가 명시적으로 자식 엔터티를 업데이트해야 합니다.

요약하면, CascadeType.MERGE를 사용하면 부모 엔터티를 저장 또는 병합할 때 연관된 자식 엔터티도 함께 저장 또는 병합되어 엔터티 간의 일관성을 유지할 수 있습니다. 사용하지 않는 경우에는 이러한 변경 내용을 수동으로 관리해야 합니다. 선택은 프로젝트의 요구사항과 상황에 따라 달라질 것이며, 일관성과 효율성을 고려하여 결정해야 합니다.

### [해결 방법]

- CascadeType.MERGE를 추가합니다.

```java
@Embeddable
@NoArgsConstructor
@Getter
public class Childs {
		@OneToMany(mappedBy = "monitoring", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, orphanRemoval = true)
    private List<InspectionMemo> inspectionMemos = new ArrayList<>();
		...
}
```
