---
title: "[도메인 주도 개발 시작하기] 스프링 데이터 JPA를 이용한 조회 기능"
tags: ["DDD","Spring Data JPA","Specification","Pageable","Subselect"]
summary: "도메인 주도 개발 시작하기 5장을 정리하며, 스펙을 이용한 동적 검색, 정렬·페이징 처리, @Subselect를 이용한 조회 전용 모델 구현 방법을 다룹니다."
---

> CQRS
> 명령 Command 모델과 조회 모델을 분리하는 패턴.
> **명령 모델은 상태를 변경하는 기능을 구현할 때 사용**하고 **조회 모델은 데이터를 조회하는 기능을 구현할 때 사용**합니다.

### 검색을 위한 스펙

검색 조건이 고정되어 있고 단순하면 특정 조건으로 조회하는 기능으로 만듭니다.

```java
public interface OrderDateDao {
		Optional<OrderDate> findById(OrderNo id);
		List<OrderDate> findByOrderer(String ordererId, Date fromDate, Date toDate);
		...
}
```

검색 조건을 다양하게 조합해야 할 때 사용할 수 있는 것이 스펙입니다. 스펙은 애그리거트가 특정 조건을 충족하는지를 검색할 때 사용하는 인터페이스입니다.

```java
public interface Speficication<T> {
		public boolean isSatisfiedBy(T agg);
}
```

Order 애그리거트 객체가 특정 고객의 주문인지 확인하는 스펙은 다음과 같이 구현할 수 있습니다.

```java
public class OrdererSpec implements Specification<Order> {
		private String ordererId;
		
		public OrdererSpec(String ordererId) {
			this.ordererId = ordererId;
		}

		public boolean isSatisfiedBy(Order agg) {
				return agg.getOrdererId().getMemberId().getId().equals(ordererId);
		}
}
```

리포지터리나 DAO는 검색 대상을 걸러내는 용도로 스펙을 사용합니다. 메모리에 모든 애그리거트를 보관하고 있다면 다음과 같이 사용할 수 있습니다.

```java
public class MemoryOrderRepository implements OrdererRepository {
		
		public List<Order> findAll(Specification<Order> spec) {
			List<Order> allOrders = findAll();
			return allOrders.stream()
											.filter(order -> spec.isSatisfiedBy(order))
											.toList();		
		}
		...
}
```

리포지터리가 스펙을 이용해서 검색 대상을 걸러주므로 특정 조건을 충족하는 애그리거트를 찾고 싶으면 원하는 스펙을 생성해서 리포지터리에 전달하면 됩니다.

```java
Speficication<Order> ordererSpec = new OrdererSpe("madvirus");
List<Order> orders = orderRepository.findAll(ordererSpec);
```

### 스프링 데이터 JPA를 이용한 스펙 구현

스프링 데이터 JPA는 검색 조건을 표현하기 위한 인터페이스 Specification을 제공합니다.

```java

package org.springframework.data.jpa.domain;

import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;

/**
 * Specification in the sense of Domain Driven Design.
 * 
 * @author Oliver Gierke
 * @author Thomas Darimont
 */
public interface Specification<T> {

	/**
	 * Creates a WHERE clause for a query of the referenced entity in form of a {@link Predicate} for the given
	 * {@link Root} and {@link CriteriaQuery}.
	 * 
	 * @param root
	 * @param query
	 * @return a {@link Predicate}, must not be {@literal null}.
	 */
	Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb);
}
```

해당 스펙은 아래와 같이 작성할 수 있습니다.

```java
public class OrdererSpec Implements Sepcification<OrderSumary> {
		private String ordererId;

		public OrdererIdSpec(String ordererId) {
				this.ordererId = ordererId;
		}

		@Override
		Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb){
				return cb.equal(root.get(OrderSuary_.orderId), ordererId); 
		}
}
```

스펙 생성 기능을 별도 클래스에 모은 예입니다.

```jsx
public class OrderSumarySpecs {
	public static Sepcification<OrderSumary> orderId(String ordererId) {
		return (Root<OrderSumary> root, CriteriaQuery<?> query,
			 CriteriaBuilder cb) -> 
					cb.equal(root.<String>get("orderId"), ordererId);
	}

	public static Sepcification<OrderSumary> orderDateBetween(LocalDateTime from
			LocalDateTime to) {
		return (Root<OrderSumary> root, CriteriaQuery<?> query,
			 CriteriaBuilder cb) -> 
					cb.between(root.get(OrderSumary_.orderDAte), from, to);
	}
}
```

스펙 인터페이스는 함수형 인터페이스이므로 위와 같이 람다식을 이용해 객체를 생성할 수 있습니다.

### 리포지터리/DAO에서 스펙 사용하기

스펙 인터페이스를 파라미터로 갖는 findAll() 메서드입니다.

```jsx
public interface OrderSumaryDao 
			extends Repository<OrderSumary, String> {
			List<OrderSumary> findAll(Sepcification<OrderSummary> sepc);
}
```

구현 클래스

```java
// 스팩 객체를 생성
Sepcification<OrderSumary> spec = new OrderIdSpec("user1");
// findAll() 메서드를 이용해서 검색
List<OrderSumary> results = orderSummaryDao.findAll(spec);

```

### 스펙 조합

스프링 데이터 JPA가 제공하는 스펙 인터페이스는 스펙을 조합할 수 있는 두 메서드를 제공하고 있습니다.

```java
public interface Sepcification<T> extends Serializable {
		... 생략

		default Sepcification<T> and (@Nullable Sepcification<T> other) {...}
		default Sepcification<T> or (@Nullable Sepcification<T> other) {...}

		@Nullable
		Predicate toPredicate(Root<T> root,
												CriteriaQuery<?> query,
												CriteriaBuilder criteriaBuilder);
}
```

구현 클래스

```java
Sepcification<OrderSumary> sepc1 = OrderSumarySpecs.orderId("user1");
Sepcification<OrderSumary> sepc2 = OrderSumarySpecs.orderDateBetween(
				LocalDateTime.of(2022.1,1,0,0,0)
				LocalDateTime.of(2022.1,2,0,0,0));

Sepcification<OrderSumary> spec3 = spec1.and(sepc2);
```

구현 클래스 2

```java
Sepcification<OrderSumary> sepc1 = OrderSumarySpecs.orderId("user1")
							.and(OrderSumarySpecs.orderDateBetween(from, to));
)
```

구현 클래스 3

- not() 메서드 제공

```java
Sepcification<OrderSumary> sepc = Sepcification.not(OrderSumarySpecs.orderId("user1"));
```

구현 클래스 4

- null 가능성이 있는 스펙 객체와 다른 스펙을 조합해야 할 때가 있습니다. 이 경우 다음 코드처럼 null 여부를 판단해 NullPointerException이 발생하는 것을 방지해야 하는데, null 여부를 매번 검사하려면 다소 귀찮습니다.

```java
Sepcification<OrderSumary> nullableSpec = createNullableSpec(); // null 일 수 있음
Specification<OrderSumary> otherSpec = createOtherSpec();

Specification<OrderSumary> spec = 
			nullableSpec = null ? otherSpec : nullableSpec.and(otherSpec);
```

where() 메서드를 사용하면 이런 귀찮음을 줄일 수 있습니다.

```java
Specification<OrderSumary> spec = 
	Specification.where(createNullableSpec()).and(createOtherSpec());
```

### 정렬 지정하기

JPA는 두 가지 방법을 사용해서 정렬을 지정할 수 있습니다.

- 메서드 이름에 OrderBy를 사용해서 정렬 기준 지정
- Sort를 인자로 전달

조회하는 find 메서드는 이름 뒤에 OrderBy를 사용해서 정렬 순서를 지정할 수 있습니다.

```java
public interface ORderSummaryDao extends Repository<OrderSumary, String> {

		List<OrderSummary> findByOrderByNumberDesc(String ordererId);
}
```

두 개 이상의 프로퍼티에 대한 정렬 순서를 지정하는 예입니다.

```java
findByOrdererIdOrderByOrderDateDescNumberAsc
```

장점

- 사용하는 방법이 간단합니다.

단점

- 정렬 프로퍼티가 2개 이상이면 메서드 이름이 길어집니다.
- 정렬 순서가 고정되기 때문에 상황에 따라 정렬 순서를 변경할 수 없습니다.

스프링 데이터 JPA에서 정렬 순서를 지정하는 방법입니다.

```java
public interface OrderSummaryDao extends Repository<OrderSummary, String> {

	List<OrderSummary> findByOrderId(String orderId, Sort sort);
	List<OrderSummary> findByAll(Specification<OrderSummary> spec, Sort sort);
}
```

find 메서드를 사용하는 코드는 알맞은 sort 객체를 생성해서 전달하면 됩니다.

```java
Sort sort = Sort.by("number").ascending();
List<OrderSummary> results = orderSummaryDao.findByOrderId("user1", sort);
```

### 페이징 처리하기

스프링 데이터 JPA는 페이징 처리를 위해 Pageable 타입을 이용합니다. Sort 타입과 마찬가지로 find 메서드에 Pageable 타입 파라미터를 사용하면 페이징을 자동으로 처리해 줍니다.

```java
public interface MemberDataDao extends Reposiotry<MemberData, String> {
	
		List<MemberData> findByNameLike(String name, Pageable pageable);
}
```

```java
PageRequest pageReq = PageRequest.of(1, 10);
List<MemberData> user = memeberDataDao.findByNameLike("사용자", pageReq);
```

Page 타입을 사용하면 데이터 목록뿐만 아니라 조건에 해당하는 전체 개수도 구할 수 있습니다.

```java
public interface MemberDataDao extends Reposiotry<MemberData, String> {
		Page<MemberData> findByBlocked(boolean blocked, Pageable pageable);
}
```

스펙을 사용하는 findAll() 메서드도 Pageable을 사용할 수 있습니다.

```java
public interface MemberDataDao extends Reposiotry<MemberData, String> {
		Page<MemberData> findAll(Specification<MemberData> spec, Pageable pageable);
}
```

### 스펙 조합을 위한 스펙 빌더 클래스

스펙 조합 방법입니다.

```java
Specification<MemberData> spec = Specification.where(null);
if (searchRequest.isOnlyNotBlocked()) {
		spec = spec.and(MemberDataSpecs.nonBlocked());
}

if (StringUtils.hasText(serachReqeust.getName())) {
		spec = spec.and(MemberDataSpecs.serarchRequest.getName())
}
List<MemberData> result = memberDataDao.findAll(spec, PageRequest.of(0.5));	
```

이 코드는 if와 각 스펙을 조합하는 코드가 섞여 있어 실수하기 쉽고 복잡한 구조를 갖습니다.

```java
Specification<MemberData> spec = SpecBuilder.Builder(MemberData.class)
		.ifTrue(searchRequest.isOnlyNotBlocked(),
						() -> MemberDataSpecs.nonBlocked())
		.ifHasText(searchRequest.getName(),
						name -> MemberDataSpecs.nameLike(serachRequest.getNmae()))
		.toSpec();

List<MemberData> result = memberDataDao.findAll(spec, PageRequest.of(0.5));	
```

스펙 빌더 코드는 다음과 같습니다.

```java
public class SpecBuilder {
    public static <T> Builder<T> builder(Class<T> type) {
        return new Builder<T>();
    }

    public static class Builder<T> {
        private List<Specification<T>> specs = new ArrayList<>();

        private void addSpec(Specification<T> spec) {
            if (spec != null) {
                specs.add(spec);
            }
        }

        public Builder<T> and(Specification<T> spec) {
            addSpec(spec);
            return this;
        }

        public Builder<T> ifHasText(String str,
                                    Function<String, Specification<T>> specSupplier) {
            if (StringUtils.hasText(str)) {
                addSpec(specSupplier.apply(str));
            }
            return this;
        }

        public Builder<T> ifTrue(Boolean cond,
                                 Supplier<Specification<T>> specSupplier) {
            if (cond != null && cond.booleanValue()) {
                addSpec(specSupplier.get());
            }
            return this;
        }

        public <V> Builder<T> ifNotNull(V value,
                                        Function<V, Specification<T>> specSupplier) {
            if (value != null) {
                addSpec(specSupplier.apply(value));
            }
            return this;
        }

        public Specification<T> toSpec() {
            Specification<T> spec = Specification.where(null);
            for (Specification<T> s : specs) {
                spec = spec.and(s);
            }
            return spec;
        }
    }
}
```

### 동적 인스턴스 생성

```java
public interface OrderSumaryDao extends Repository<OrderSumary, String> {
	
	@Query("""    
            select new com.myshop.order.query.dto.OrderView(
                o.number, o.state, m.name, m.id, p.name
            )
            from Order o join o.orderLines ol, Member m, Product p
            where o.orderer.memberId.id = :ordererId
            and o.orderer.memberId.id = m.id
            and index(ol) = 0
            and ol.productId.id = p.id
            order by o.number.number desc
            """)
    List<OrderView> findOrderView(String ordererId);

}
```

```java
public class OrderView {

    private final String number;
    private final OrderState state;
    private final String memberName;
    private final String memberId;
    private final String productName;

    public OrderView(OrderNo number, OrderState state, String memberName, MemberId memberId, String productName) {
        this.number = number.getNumber();
        this.state = state;
        this.memberName = memberName;
        this.memberId = memberId.getId();
        this.productName = productName;
    }

    public String getNumber() {
        return number;
    }

    public OrderState getState() {
        return state;
    }

    public String getMemberName() {
        return memberName;
    }

    public String getMemberId() {
        return memberId;
    }

    public String getProductName() {
        return productName;
    }
}
```

조회 전용 모델을 만드는 이유는 표현 영역을 통해 사용자에게 데이터를 보여주기 위함입니다. 많은 웹 프레임워크는 새로 추가한 밸류 타입을 알맞은 형식으로 출력하지 못하므로 위 코드처럼 값을 기본 타입으로 변환하면 편리합니다.

### 하이버네이트 @Subselect 사용

@Subselect는 쿼리 결과를 @Entity로 매핑할 수 있는 기능입니다.

```java
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.Subselect;
import org.hibernate.annotations.Synchronize;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import java.time.LocalDateTime;

@Entity
@Immutable
@Subselect(
        """
        select o.order_number as number,
        o.version,
        o.orderer_id,
        o.orderer_name,
        o.total_amounts,
        o.receiver_name,
        o.state,
        o.order_date,
        p.product_id,
        p.name as product_name
        from purchase_order o inner join order_line ol
            on o.order_number = ol.order_number
            cross join product p
        where
        ol.line_idx = 0
        and ol.product_id = p.product_id"""
)
@Synchronize({"purchase_order", "order_line", "product"})
public class OrderSummary {
    @Id
    private String number;
    private long version;
    @Column(name = "orderer_id")
    private String ordererId;
    @Column(name = "orderer_name")
    private String ordererName;
    @Column(name = "total_amounts")
    private int totalAmounts;
    @Column(name = "receiver_name")
    private String receiverName;
    private String state;
    @Column(name = "order_date")
    private LocalDateTime orderDate;
    @Column(name = "product_id")
    private String productId;
    @Column(name = "product_name")
    private String productName;

    protected OrderSummary() {
    }

   ...
}
```

`@Immutable`, `@Subselect`, `@Synchronize`는 하이버네이트 전용 애너테이션인데, 이 태그를 사용하면 테이블이 아닌 쿼리 결과를 @Entity로 매핑할 수 있습니다.

DBMS가 여러 테이블을 조인해서 조회한 결과를 한 테이블처럼 보여주기 위한 용도로 뷰를 사용하는 것처럼, `@Subselect`를 사용하면 쿼리 실행 결과를 매핑할 테이블처럼 사용합니다.

**`@Subselect`로 조회한 `@Entity` 역시 수정할 수 없습니다.** → 수정을 하게 되면 매핑할 테이블이 없기 때문에 오류가 발생합니다. 이러한 문제를 방지하기 위해 `@Immutable`을 사용합니다.

`@Immutable`을 사용하면 하이버네이트는 해당 엔티티의 매핑 필드·프로퍼티가 변경되어도 DB에 반영하지 않고 무시합니다.

```java
//purchase_order 테이블에서 조회
Order order = orderRepostiory.findById(orderNumber);
order.changeShipping(newInfo);//상태변경

// 변경 내역이 DB에 반영되지 않았는데 purchase_order 테이블에서 조회
List<OrderSummary> summarises = orderSummaryRepository.findByOrdererId(userId);
```

Order의 상태를 변경한 뒤 orderSummary를 조회하면, 하이버네이트가 트랜잭션을 커밋하는 시점에 변경 사항을 DB에 저장하기 때문에 문제가 생깁니다. Order의 변경 내역이 아직 purchase_order 테이블에 반영되지 않은 상태에서 purchase_order 테이블을 사용하는 orderSummary를 조회하게 되어, orderSummary에는 최신 값이 아닌 이전 값이 담기게 됩니다.

이런 문제를 해결하기 위해 `@Synchronize`를 사용합니다. @Synchronize는 해당 엔티티와 관련된 테이블 목록을 명시합니다. **하이버네이트는 엔티티를 로딩하기 전에 저장한 테이블과 관련된 변경이 발생하면 플러시를 먼저 합니다.** 따라서 orderSummary를 로딩하는 시점에는 변경 내역이 반영됩니다.

```java
// @Subselect를 적용한 @Entity는 일반 @Entity와 동일한 방법으로 조회할 수 있다.
Specification<OrderSummary> spec = orderDateBetween(from, to);
Pageable pageable = PageRequests.of(1,10);
List<OrderSummary> results = orderSummaryDao.findAll(spec, pageable);
```

@Subselect는 이름처럼 @Subselect의 값으로 지정한 쿼리를 from 절의 서브 쿼리로 사용합니다.

```sql
select osm.number as number1_0, ... 새략
  from(
	select o.order_number as number,
        o.version,
        o.orderer_id,
        o.orderer_name,
        o.total_amounts,
        o.receiver_name,
        o.state,
        o.order_date,
        p.product_id,
        p.name as product_name
        from purchase_order o inner join order_line ol
            on o.order_number = ol.order_number
            cross join product p
        where
        ol.line_idx = 0
        and ol.product_id = p.product_id
) osm
where osm.orderer_id = ? order by osm.number desc;
```

[도메인 주도 개발 시작하기 - 예스24](https://www.yes24.com/Product/Goods/108431347?pid=123487&cosemkid=go16481149689793107&gclid=Cj0KCQjwgNanBhDUARIsAAeIcAvU1218EfnAWaB7jwT88mKqCJ9UJbgjm5qk12G3_kgbQFKtHnPTQaUaArR8EALw_wcB)
