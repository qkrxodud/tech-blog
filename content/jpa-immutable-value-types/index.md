---
title: "값 타입 공유와 불변 객체"
tags: ["JPA","값 타입","불변 객체","값 타입 컬렉션","Embeddable"]
summary: "값 타입을 공유할 때 발생하는 부작용과 불변 객체 설계, 값 타입 컬렉션의 제약과 이를 엔티티로 대체하는 실무 방법을 정리합니다."
---

## 값 타입 공유 참조

- 임베디드 타입 같은 값 타입을 여러 엔티티에서 공유하면 위험합니다.
- 부작용(side effect)이 발생하는 문제는 원인을 찾기도 힘듭니다.

```java
public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.

        EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.

        EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
            Address address = new Address("test1", "test1", "test1");
            Member member1 = new Member();
            member1.setName("test...");
            member1.setHomeAddress(address);
            em.persist(member1);

            Member member3 = new Member();
            member3.setName("test...");
            member3.setHomeAddress(address);
            em.persist(member3);

            member1.getHomeAddress().setStreet("newCity");
```

- 위 코드를 보면 address를 여러 엔티티가 공유하는 구조로 되어 있습니다. 이 상태에서 member1의 값을 위와 같이 변경하면 member3도 함께 변경되는 것을 알 수 있습니다.
- 이는 예외가 발생하는 것도 아니고 DB 값만 다르게 들어가므로 side effect가 발생하고 원인을 찾기도 어렵습니다.

### 해결 방법

- 객체 타입을 수정할 수 없게 만들면 부작용을 원천 차단할 수 있습니다.
- 값 타입은 불변 객체로 설계해야 합니다.
- 불변 객체: 생성 시점 이후 절대 값을 변경할 수 없는 객체입니다.
- 생성자로만 값을 설정하고 수정자(setter)를 만들지 않으면 됩니다.

```java
package helloJpa;

import javax.persistence.Embeddable;
import java.time.LocalDateTime;

@Embeddable
public class Period {

//기간 Periodprivate LocalDateTime startDate;
    private LocalDateTime endDate;

    public Period(LocalDateTime startDate, LocalDateTime endDate) {
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public Period() {

    }
}

```

```java
Member member1 = new Member();
member1.setName("test...");
member1.setHomeAddress(new Address("test1", "test1", "test1"));
em.persist(member1);

Member member3 = new Member();
member3.setName("test...");
member3.setHomeAddress(new Address("test2", "test2", "test2"));
em.persist(member3);
```

- 값을 생성자로만 세팅되게 설정하고, 변경할 것이 있으면 메인 프로세스에서 생성자를 통해 값을 다시 넣어주면 됩니다.

## 값 타입 컬렉션

- 관계형 데이터베이스는 기본적으로 객체의 컬렉션을 담을 수 있는 구조가 없습니다.
- 값만 넣을 수 있습니다.
- 값 타입과 엔티티의 다른 점은 위와 같이 값들이 전부 묶여서 PK를 구성한다는 것입니다.

### 값 타입 컬렉션

- 값 타입을 하나 이상 저장할 때 사용합니다.
- @ElementCollection, @CollectionTable을 사용합니다.
- 데이터베이스는 컬렉션을 같은 테이블에 저장할 수 없습니다.
- 컬렉션을 저장하기 위한 별도의 테이블이 필요합니다.

### 값 타입 컬렉션

- 값 타입 저장 예제
- 값 타입 조회 예제
    - 값 타입 컬렉션도 지연 로딩 전략을 사용합니다.
- 값 타입 수정 예제
- 참고: 값 타입 컬렉션은 영속성 전이(Cascade) + 고아 객체 제거 기능을 필수로 가진다고 볼 수 있습니다.

### 값 타입 컬렉션의 제약사항

- 값 타입은 엔티티와 다르게 식별자 개념이 없습니다.
- 값을 변경하면 추적이 어렵습니다.
- 값 타입 컬렉션에 변경 사항이 발생하면, 주인 엔티티와 연관된 모든 데이터를 삭제하고 값 타입 컬렉션에 있는 현재 값을 모두 다시 저장합니다.
- 값 타입 컬렉션을 매핑하는 테이블은 모든 컬럼을 묶어서 기본키를 구성해야 합니다: null 입력 불가, 중복 저장 불가.

### 값 타입 컬렉션 대안

- 실무에서는 상황에 따라 값 타입 컬렉션 대신 일대다 관계를 고려합니다.
- 일대다 관계를 위한 엔티티를 만들고, 여기에서 값 타입을 사용합니다.
- 영속성 전이(Cascade) + 고아 객체 제거를 사용해서 값 타입 컬렉션처럼 사용합니다.
- 예) AddressEntity

```java
package helloJpa;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "ADDRESS")
public class AddressEntity {
    @Id
    @GeneratedValue
    private Long id;
    private Address address;

    public AddressEntity(String city, String street, String zipcode) {
        this.address = new Address(city, street, zipcode);
    }

    public AddressEntity() {

    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Address getAddress() {
        return address;
    }

    public void setAddress(Address address) {
        this.address = address;
    }
}

```

```java
package helloJpa;

import javax.persistence.Embeddable;

@Embeddable
public class Address {

//주소 Periodprivate String city;
    private String street;
    private String zipcode;

    public Address(String city, String street, String zipcode) {
        this.city = city;
        this.street = street;
        this.zipcode = zipcode;
    }

    public Address() {
    }

    public String getCity() {
        return city;
    }

    public String getStreet() {
        return street;
    }

    public String getZipcode() {
        return zipcode;
    }
}

```

```java
public static void main(String[] args) {
    EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.

    EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.

    EntityTransaction tx = em.getTransaction();
    tx.begin();

    try {
        Member member1 = new Member();
        member1.setName("member1");
        member1.setHomeAddress(new Address("homeCity", "street", "zipcode"));
        member1.getFavoriteFoods().add("치킨");
        member1.getFavoriteFoods().add("족발");
        member1.getFavoriteFoods().add("피자");

        member1.getAddressHistory().add(new AddressEntity("old1", "street", "zipcode"));
        member1.getAddressHistory().add(new AddressEntity("old2", "street", "zipcode"));

```

- 실무에서는 값 타입 컬렉션보다 위와 같이 값 타입 컬렉션을 엔티티로 매핑해서 많이 사용합니다. 값 타입 컬렉션에 변경이 발생하면 연관된 모든 데이터가 삭제된 후 다시 인서트되기 때문입니다.

그렇다면 값 타입 컬렉션은 언제 사용할까요?

예) 메뉴에서 체크박스로 조회할 때 "나는 [치킨, 피자]를 좋아한다"처럼 추적할 필요 없이 조회만 할 때 사용하면 됩니다.

### 값 타입 컬렉션 대안

- 실무에서 상황에 따라 값 타입 컬렉션 대신 일대다 관계를 고려합니다.
- 일대다 관계를 위한 엔티티를 만들고, 여기에서 값 타입을 사용합니다.
- 영속성 전이(Cascade) + 고아 객체 제거를 사용해서 값 타입 컬렉션처럼 사용합니다.
- 예) AddressEntity

## 정리

**엔티티 타입의 특징**

- 식별자가 있습니다.
- 생명주기를 관리합니다.
- 공유할 수 있습니다.

**값 타입의 특징**

- 식별자가 없습니다.
- 생명주기를 엔티티에 의존합니다.
- 공유하지 않는 것이 안전합니다.
- 불변 객체로 만드는 것이 안전합니다.

### 주의해야 할 점

값 타입은 정말 값 타입이라고 판단될 때만 사용합니다.

엔티티와 값 타입을 혼동해서 엔티티를 값 타입으로 만들면 안 됩니다.

식별자가 필요하고 지속해서 값을 추적, 변경해야 한다면 그것은 값 타입이 아닌 엔티티입니다.

> 결론
> 

실무에서는 값 타입 컬렉션을 엔티티로 매핑해서 사용하고, 정말 간단한 조회 같은 경우에만 값 타입을 사용해서 객체지향적으로 설계해서 사용합니다. 항상 중요한 것은 안전하게 컬렉션을 엔티티로 매핑해서 사용하는 것입니다.

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
