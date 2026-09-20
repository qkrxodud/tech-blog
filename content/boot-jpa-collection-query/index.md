---
title: "컬렉션 조회 최적화"
tags: ["Spring Boot", "JPA", "API", "성능 최적화", "컬렉션 조회", "DTO"]
summary: "일대다 컬렉션을 포함한 주문 조회 API를 엔티티 노출부터 페치 조인, 배치 사이즈, DTO 직접 조회, 플랫 데이터까지 단계별로 최적화하는 방법을 정리합니다."
---

주문 내역에서 추가로 주문한 상품 정보를 조회해보겠습니다.

Order 기준으로 컬렉션인 `OrderItem`과 `Item`이 필요합니다.

앞의 예제에서는 toOne(OneToOne, ManyToOne) 관계만 있었습니다. 이번에는 컬렉션인 일대다 관계(OneToMany)를 조회하고, 최적화하는 방법을 알아보겠습니다.

## 주문 조회 V1: 엔티티 직접 노출

다음은 엔티티를 직접 노출하는 V1 코드입니다.

```java
package jpabook.jpashop.api;

import jpabook.jpashop.domain.Address;
import jpabook.jpashop.domain.Order;
import jpabook.jpashop.domain.OrderItem;
import jpabook.jpashop.repository.OrderRepository;
import jpabook.jpashop.repository.OrderSearch;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class OrderApiController {

    private final OrderRepository orderRepository;

    @GetMapping("/api/v1/orders")
    public Result ordersV1() {
        List<Order> all = orderRepository.findAllByString(new OrderSearch());
        for (Order order : all) {
            order.getMember().getName();
            order.getDelivery().getAddress();
            List<OrderItem> orderItems = order.getOrderItems();
            orderItems.stream().forEach(o -> o.getItem().getName());
        }
        return new Result(all);
    }
}
```

- `orderItem`, `item` 관계를 직접 초기화하면 `Hibernate5Module` 설정에 의해 엔티티를 JSON으로 생성합니다.
- 양방향 연관관계는 무한 루프에 걸리지 않게 한곳에 `@JsonIgnore`를 추가해야 합니다.
- **엔티티를 직접 노출하므로 좋은 방법은 아닙니다.**

## 주문 조회 V2: 엔티티를 DTO로 변환

다음은 ordersV2 메서드입니다.

```java
@GetMapping("/api/v2/orders")
    public Result ordersV2() {
        List<Order> all = orderRepository.findAllByString(new OrderSearch());
        List<OrderDto> collect = all.stream()
                .map(o -> new OrderDto(o))
                .collect(Collectors.toList());
        return new Result(collect);
    }
```

OrderApiController에 전체 코드를 추가합니다.

```java
		@GetMapping("/api/v2/orders")
    public Result ordersV2() {
        List<Order> all = orderRepository.findAllByString(new OrderSearch());
        List<OrderDto> collect = all.stream()
                .map(o -> new OrderDto(o))
                .collect(Collectors.toList());
        return new Result(collect);
    }

    @Getter
    static class OrderDto {

        private Long orderId;
        private String name;
        private LocalDateTime orderDate;
        private Address address;
        private List<OrderItemDto> orderItems;

        public OrderDto(Order order) {
            orderId = order.getId();
            name = order.getMember().getName();
            orderDate = order.getOrderDate();
            address = order.getMember().getAddress();
            orderItems = order.getOrderItems().stream()
                    .map(o-> new OrderItemDto(o))
                    .collect(Collectors.toList());
        }
    }
```

- 지연 로딩으로 너무 많은 SQL이 실행됩니다.
- SQL 실행 수는 다음과 같습니다.
    - `order` 1번
    - `member`, `address` N번(order 조회수 만큼)
    - `orderItem` N번(order 조회 수 만큼)
    - `item` N번(orderItem 조회 수 만큼)

> 참고 : 지연 로딩은 영속성 컨텍스트에 있으면 영속성 컨텍스트에 있는 엔티티를 사용하고 없으면 SQL을 실행합니다. 따라서 같은 영속성 컨텍스트에서 이미 로딩한 회원 엔티티를 추가로 조회하면 SQL을 실행하지 않습니다.
>

## 주문 조회 V3: 엔티티를 DTO로 변환 - 페치 조인 최적화

OrderApiController에 ordersV3를 추가합니다.

```java
/**
 * 유연하고
 * 성능 차이는 많이 나지 않는다.
 * @return
 */
@GetMapping("/api/v3/orders")
  public List<OrderDto> ordersV3() {
      List<Order> orders = orderRepository.findAllWithItem();
      List<OrderDto> result = orders.stream()
              .map(o -> new OrderDto(o))
              .collect(toList());
      return result;
  }
```

OrderRepository에 findAllWithItem 함수를 추가합니다.

```java
public List<Order> findAllWithItem() {
        return em.createQuery(
                        "select distinct o from Order o" +
                                " join fetch o.member m" +
                                " join fetch o.delivery d" +
                                " join fetch o.orderItems oi" +
                                " join fetch oi.item i", Order.class)
                .getResultList();
    }
```

- 페치 조인으로 SQL이 1번만 실행됩니다.
- `distinct`를 사용한 이유는 1대다 조인이 있으므로 데이터베이스 row가 증가하기 때문입니다. 그 결과 같은 order 엔티티의 조회 수도 증가하게 됩니다. JPA의 distinct는 SQL에 distinct를 추가하고, 더해서 같은 엔티티가 조회되면 애플리케이션에서 중복을 걸러줍니다. 이 예에서는 order가 컬렉션 페치 조인 때문에 중복 조회되는 것을 막아줍니다.
- 단점
    - 페이징이 불가능합니다.

> 참고: 컬렉션 페치 조인을 사용하면 페이징이 불가능합니다. 하이버네이트는 경고 로그를 남기면서 모든 데이터를 DB에서 읽어오고, **메모리에서 페이징 해버립니다.(매우 위험)**
>

> 참고: 컬렉션 페치 조인은 1개만 사용할 수 있습니다. 컬렉션 둘 이상 페치 조인을 사용하면 안 됩니다. **데이터가 부정합하게 조회될 수 있습니다.**
>

## 주문 조회 V3.1: 엔티티를 DTO로 변환 - 페이징과 한계 돌파

- 컬렉션을 페치 조인하면 페이징이 불가능합니다.
    - 컬렉션을 페치 조인하면 일대다 조인이 데이터가 예측할 수 없이 증가합니다.
    - 일대다에서 일(1)을 기준으로 페이징을 하는 것이 목적입니다. 그런데 데이터는 다(N)를 기준으로 row가 생성됩니다.
    - Order를 기준으로 페이징 하고 싶은데, 다(N)인 OrderItem을 조인하면 OrderItem이 기준이 되어버립니다.
- 이 경우 하이버네이트는 경고 로그를 남기고 모든 DB 데이터를 읽어서 메모리에서 페이징을 시도합니다. **최악의 경우 장애로 이어질 수 있습니다.**

**한계 돌파**

그러면 페이징과 컬렉션 엔티티를 함께 조회하려면 어떻게 해야 할까요?

- 먼저 ToOne(OneToOne, ManyToOne) 관계를 모두 페치 조인합니다. ToOne 관계는 row 수를 증가시키지 않으므로 페이징 쿼리에 영향을 주지 않습니다.
- 컬렉션은 지연 로딩으로 조회합니다.
- 지연 로딩 성능 최적화를 위해 `hibernate.default_batch_fetch_size`, `@BatchSize`를 적용합니다.
    - hibernate.default_batch_fetch_size: 글로벌 설정
    - @BatchSize: 개별 최적화
    - **이 옵션을 사용하면 컬렉션이나 프록시 객체를 한꺼번에 설정한 size만큼 IN 쿼리로 조회합니다.**

OrderRepository에 다음 코드를 추가합니다.

```java
public List<Order> findAllWithMemberDelivery(int offset, int limit) {
        return em.createQuery(
                "select o from Order o " +
                        " join fetch o.member m " +
                        " join fetch o.delivery d" , Order.class
        ).setFirstResult(offset)
				 .setMaxResults(limit)
			   .getResultList()
    }
```

OrderApiController에 다음 코드를 추가합니다.

```java
/**
 * 유연하고
 * 성능 차이는 많이 나지 않는다.
 * @return
 */
    @GetMapping("/api/v3.1/orders")
    public List<OrderDto> ordersV3_page(@RequestParam(value = "offset", defaultValue = "0") int offset,
                                        @RequestParam(value = "limit", defaultValue = "100") int limit)
    {
        List<Order> orders = orderRepository.findAllWithMemberDelivery(offset, limit);
        List<OrderDto> result = orders.stream()
                .map(o -> new OrderDto(o))
                .collect(toList());
        return result;
    }
```

최적화 옵션은 다음과 같습니다.

```java
spring:
 jpa:
 properties:
 hibernate:
 default_batch_fetch_size: 1000
```

- 개별로 설정하려면 `@BatchSize`를 적용하면 됩니다. (컬렉션은 컬렉션 필드에, 엔티티는 엔티티 클래스에 적용)
- 장점
    - 쿼리 호출 수가 1 + N → 1 + 1로 최적화됩니다.
    - 조인보다 DB 데이터 전송량이 최적화됩니다. (Order와 OrderItem을 조인하면 Order가 OrderItem 만큼 중복해서 조회됩니다. 이 방법은 각각 조회하므로 전송해야 할 중복 데이터가 없습니다.)
    - 페치 조인 방식과 비교해서 쿼리 호출 수가 약간 증가하지만, DB 데이터 전송량이 감소합니다.
    - 컬렉션 페치 조인은 페이징이 불가능하지만 이 방법은 페이징이 가능합니다.
- 결론
    - ToOne 관계는 페치 조인해도 페이징에 영향을 주지 않습니다. 따라서 ToOne 관계는 페치 조인으로 쿼리 수를 줄여서 해결하고, 나머지는 `hibernate.default_batch_fetch_size`로 최적화합니다.

> 참고: `default_batch_fetch_size`의 크기는 적당한 사이즈를 골라야 하는데, **100~1000 사이를 선택하는 것을 권장합니다.** 이 전략은 SQL IN 절을 사용하는데, 데이터베이스에 따라 IN 절 파라미터를 1000으로 제한하기도 합니다. 1000으로 잡으면 한 번에 1000개를 DB에서 애플리케이션으로 불러오므로 DB에 순간 부하가 증가할 수 있습니다. 하지만 애플리케이션은 100이든 1000이든 결국 전체 데이터를 로딩해야 하므로 메모리 사용량은 같습니다. 100으로 설정하는 것이 성능상 가장 좋지만, 결국 DB든 애플리케이션이든 순간 부하를 어디까지 견딜 수 있는지로 결정하면 됩니다.
>

## 주문 조회 V4: JPA에서 DTO 직접 조회

OrderApiController에 다음 코드를 추가합니다.

```java
	private final OrderQueryRepository orderQueryRepository;

	@GetMapping("/api/v4/orders")
	public List<OrderQueryDto> ordersV4() {
		 return orderQueryRepository.findOrderQueryDtos();
	}
```

OrderQueryRepository를 생성합니다.

```java
package jpabook.jpashop.repository.order.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import javax.persistence.EntityManager;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class OrderQueryRepository {

    private final EntityManager em;

    public List<OrderQueryDto> findOrderQueryDtos() {
        List<OrderQueryDto> orders = findOrders();

        for (OrderQueryDto order : orders) {
            List<OrderItemQueryDto> orderItems = findOrderItems(order.getOrderId());
            order.setOrderItems(orderItems);
        }
        return orders;
    }

    private List<OrderItemQueryDto> findOrderItems(Long orderId) {
        return em.createQuery(
                "select new jpabook.jpashop.repository.order.query.OrderItemQueryDto(oi.order.id, i.name, oi.orderPrice, oi.count)" +
                        "  from OrderItem oi " +
                        "  join oi.item i " +
                        "  where oi.order.id = :orderId", OrderItemQueryDto.class)
                .setParameter("orderId", orderId)
                .getResultList();
    }
 
    private List<OrderQueryDto> findOrders() {
        return em.createQuery(
                "select new jpabook.jpashop.repository.order.query.OrderQueryDto(o.id, m.name, o.orderDate, o.status, d.address) " +
                        " from Order o " +
                        " join o.member m " +
                        " join o.delivery d", OrderQueryDto.class
        ).getResultList();
    }
}
```

OrderQueryDto를 생성합니다.

```java
package jpabook.jpashop.repository.order.query;

import jpabook.jpashop.domain.Address;
import jpabook.jpashop.domain.OrderStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderQueryDto {
    private Long orderId;
    private String name;
    private LocalDateTime orderDate;
    private OrderStatus orderStatus;
    private Address address;
    private List<OrderItemQueryDto> orderItems;

    public OrderQueryDto(Long orderId, String name, LocalDateTime orderDate, OrderStatus orderStatus, Address address) {
        this.orderId = orderId;
        this.name = name;
        this.orderDate = orderDate;
        this.orderStatus = orderStatus;
        this.address = address;
    }
}
```

OrderItemQueryDto를 생성합니다.

```java
package jpabook.jpashop.repository.order.query;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

@Data
public class OrderItemQueryDto {

    @JsonIgnore
    private Long orderId; //주문번호
    private String itemName;//상품 명
    private int orderPrice; //주문 가격
    private int count; //주문 수량
    public OrderItemQueryDto(Long orderId, String itemName, int orderPrice, int count) {
        this.orderId = orderId;
        this.itemName = itemName;
        this.orderPrice = orderPrice;
        this.count = count;
    }
}
```

- Query: 루트 1번, 컬렉션 N번 실행됩니다.
- ToOne(N:1, 1:1) 관계들을 먼저 조회하고, ToMany(1:N) 관계는 각각 별도로 처리합니다.
    - 이런 방식을 선택한 이유는 다음과 같습니다.
    - ToOne 관계는 조인해도 데이터 row 수가 증가하지 않습니다.
    - ToMany(1:N) 관계는 조인하면 row 수가 증가합니다.
- row 수가 증가하지 않는 ToOne 관계는 조인으로 최적화하기 쉬우므로 한 번에 조회하고, ToMany 관계는 최적화하기 어려우므로 `findOrderItems()` 같은 별도의 메서드로 조회합니다.

## 주문 조회 V5: JPA에서 DTO 직접 조회 - 컬렉션 조회 최적화

OrderApiController에 다음 코드를 추가합니다.

```java
@GetMapping("/api/v5/orders")
public List<OrderQueryDto> orderV5() {
    return orderQueryRepository.finAllByDto_optimization();
}
```

OrderQueryRepository에 다음 코드를 추가합니다.

```java
/**
 * 최적화
 * Query: 루트 1번, 컬렉션 1번
 * 데이터를 한꺼번에 처리할 때 많이 사용하는 방식
 *
 */
public List<OrderQueryDto> finAllByDto_optimization() {
    List<OrderQueryDto> result = findOrders();

    //orderItem 컬렉션을 MAP 한방에 조회
    Map<Long, List<OrderItemQueryDto>> orderItemMap = findOrderItemMap(toOrderIds(result));
    result.forEach(o-> o.setOrderItems(orderItemMap.get(o.getOrderId())));

    return result;
}

private List<Long> toOrderIds(List<OrderQueryDto> result) {
    return result.stream()
            .map(o -> o.getOrderId())
            .collect(Collectors.toList());
}

private Map<Long, List<OrderItemQueryDto>> findOrderItemMap(List<Long> orderIds) {
    List<OrderItemQueryDto> orderItems = em.createQuery(
                    "select new jpabook.jpashop.repository.order.query.OrderItemQueryDto(oi.order.id, i.name, oi.orderPrice, oi.count)" +
                            " from OrderItem oi" +
                            " join oi.item i" +
                           " where oi.order.id in :orderIds", OrderItemQueryDto.class)
            .setParameter("orderIds", orderIds)
            .getResultList();

    return orderItems.stream()
            .collect(Collectors.groupingBy(OrderItemQueryDto::getOrderId));
}
```

- Query: 루트 1번, 컬렉션 1번 총 2번의 쿼리가 실행됩니다.
- ToOne 관계들을 먼저 조회하고, 여기서 얻은 식별자 orderId로 ToMany 관계인 `orderItem`을 한꺼번에 조회합니다.
- MAP을 사용해서 매칭 성능을 향상시킵니다.

## 주문 조회 V6: JPA에서 DTO로 직접 조회, 플랫 데이터 최적화

OrderFlatDto를 생성합니다.

```java
package jpabook.jpashop.repository.order.query;

import jpabook.jpashop.domain.Address;
import jpabook.jpashop.domain.OrderStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(of = "orderId")
public class OrderFlatDto {
    private Long orderId;
    private String name;
    private LocalDateTime orderDate;
    private OrderStatus orderStatus;
    private Address address;
    private String itemName;//상품 명
    private int orderPrice; //주문 가격
    private int count; //주문 수량

    public OrderFlatDto(Long orderId, String name, LocalDateTime orderDate, OrderStatus orderStatus, Address address, String itemName, int orderPrice, int count) {
        this.orderId = orderId;
        this.name = name;
        this.orderDate = orderDate;
        this.orderStatus = orderStatus;
        this.address = address;
        this.itemName = itemName;
        this.orderPrice = orderPrice;
        this.count = count;
    }
}
```

OrderQueryRepository에 다음 코드를 추가합니다.

```java
public List<OrderFlatDto> findAllByDto_flat() {
        return em.createQuery(
                " select new jpabook.jpashop.repository.order.query.OrderFlatDto(o.id, m.name, o.orderDate, o.status, m.address, i.name, i.price, oi.count)" +
                        " from Order o " +
                        " join o.member m " +
                        " join o.delivery d " +
                        " join o. orderItems oi " +
                        " join oi.item i ", OrderFlatDto.class)
                .getResultList();
    }
```

OrderQueryDto에 생성자를 추가합니다.

```java
public OrderQueryDto(Long orderId, String name, LocalDateTime orderDate, OrderStatus orderStatus, Address address, List<OrderItemQueryDto> orderItems) {
        this.orderId = orderId;
        this.name = name;
        this.orderDate = orderDate;
        this.orderStatus = orderStatus;
        this.address = address;
        this.orderItems = orderItems;
    }
```

OrderApiController에 다음 코드를 추가합니다.

```java
@GetMapping("/api/v6/orders")
    public List<OrderQueryDto> ordersV6() {
        List<OrderFlatDto> flats = orderQueryRepository.findAllByDto_flat();
        return flats.stream()
                .collect(groupingBy(o -> new OrderQueryDto(o.getOrderId(), o.getName(), o.getOrderDate(), o.getOrderStatus(), o.getAddress()), mapping(o -> new OrderItemQueryDto(o.getOrderId(), o.getItemName(), o.getOrderPrice(), o.getCount()), toList())
                )).entrySet().stream()
                .map(e -> new OrderQueryDto(e.getKey().getOrderId(), e.getKey().getName(), e.getKey().getOrderDate(), e.getKey().getOrderStatus(), e.getKey().getAddress(), e.getValue())).collect(toList());
    }
```

- 장점
    - Query를 1번만 실행합니다.
- 단점
    - 쿼리는 한 번이지만 조인으로 인해 DB에서 애플리케이션으로 전달하는 데이터에 중복 데이터가 추가되므로 상황에 따라 V5보다 더 느릴 수도 있습니다.
    - 애플리케이션에서 추가 작업이 큽니다.
    - 페이징이 불가능합니다.

## API 개발 고급 정리

지금까지 다룬 내용을 정리하면 다음과 같습니다.

- 엔티티 조회
    - 엔티티를 조회해서 그대로 반환: V1
    - 엔티티 조회 후 DTO로 변환: V2
    - 페치 조인으로 쿼리 수 최적화: V3
    - 컬렉션 페이징과 한계 돌파: V3.1
        - 컬렉션은 페치 조인 시 페이징이 불가능합니다.
        - ToOne 관계는 페치 조인으로 쿼리 수를 최적화합니다.
        - 컬렉션은 페치 조인 대신 지연 로딩을 유지하고, `hibernate.default_batch_fetch_size`, `@BatchSize`로 최적화합니다.
- DTO 직접 조회
    - JPA에서 DTO를 직접 조회: V4
    - 컬렉션 조회 최적화 - 일대다 관계인 컬렉션은 IN 절을 활용해서 메모리에 미리 조회해서 최적화: V5
    - 플랫 데이터 최적화 - JOIN 결과를 그대로 조회한 후 애플리케이션에서 원하는 모양으로 직접 변환: V6

**권장 순서**

1. 엔티티 조회 방식으로 우선 접근합니다.
    1. 페치 조인으로 쿼리 수를 최적화합니다.
    2. 컬렉션을 최적화합니다.
        1. 페이징이 필요하면 `hibernate.default_batch_fetch_size`, `@BatchSize`로 최적화합니다.
        2. 페이징이 필요 없으면 페치 조인을 사용합니다.
2. 엔티티 조회 방식으로 해결이 안 되면 DTO 조회 방식을 사용합니다.
3. DTO 조회 방식으로 해결이 안 되면 Native SQL이나 스프링 JdbcTemplate을 사용합니다.

> 참고: **엔티티 조회** 방식은 페치 조인이나 `hibernate.default_batch_fetch_size`, `@BatchSize`같이 **코드를 거의 수정하지 않고, 옵션만 약간 변경해서 다양한 성능 최적화를 시도할 수 있습니다.** 반면 **DTO를 직접 조회**하는 방식은 **성능을 최적화하거나 성능 최적화 방식을 변경할 때 많은 코드를 변경해야 합니다.**
>

> 참고: 개발자는 성능 최적화와 코드 복잡도 사이에서 줄타기를 해야 합니다. 항상 그런 것은 아니지만, 보통 성능 최적화는 단순한 코드를 복잡한 코드로 몰고 갑니다. 엔티티 조회 방식은 JPA가 많은 부분을 최적화해주기 때문에, 단순한 코드를 유지하면서 성능을 최적화할 수 있습니다. 반면 DTO 조회 방식은 SQL을 직접 다루는 것과 유사하기 때문에, 둘 사이에서 줄타기를 해야 합니다.
>

DTO 조회 방식의 선택지는 다음과 같습니다.

- DTO로 조회하는 방법도 각각 장단점이 있습니다. V4, V5, V6에서 단순하게 쿼리가 1번 실행된다고 V6가 항상 좋은 방법인 것은 아닙니다.
- V4는 코드가 단순합니다. 특정 주문 한 건만 조회하면 이 방식을 사용해도 성능이 잘 나옵니다. 예를 들어서 조회한 Order 데이터가 1건이면 OrderItem을 찾기 위한 쿼리도 1번만 실행하면 됩니다.
- V5는 코드가 복잡합니다. 여러 주문을 한꺼번에 조회하는 경우에는 V4 대신 이것을 최적화한 V5 방식을 사용해야 합니다. 예를 들어서 조회한 Order 데이터가 1000건인데 V4 방식을 그대로 사용하면, 쿼리가 총 1 + 1000번 실행됩니다. 여기서 1은 Order를 조회한 쿼리고, 1000은 조회된 Order의 row 수입니다. V5 방식으로 최적화하면 쿼리가 총 1 + 1번만 실행됩니다. 상황에 따라 다르겠지만 운영 환경에서 100배 이상의 성능 차이가 날 수 있습니다.
- V6는 완전히 다른 접근 방식입니다. 쿼리 한 번으로 최적화되어서 상당히 좋아 보이지만, Order를 기준으로 페이징이 불가능합니다. 실무에서는 이 정도 데이터면 수백이나 수천 건 단위로 페이징 처리가 꼭 필요하므로, 이 경우 선택하기 어려운 방법입니다. 그리고 데이터가 많으면 중복 전송이 증가해서 V5와 비교했을 때 성능 차이도 미비합니다.

> 이 글은 인프런 김영한 님의 [실전! 스프링 부트와 JPA 활용](https://www.inflearn.com/course/스프링부트-JPA-활용-1)을 들으며 정리한 노트입니다.
