---
title: "DB 비관적 락"
tags: ["비관적 락","갭락","NextKeyLock","동시성","MySQL"]
summary: "비관적 락의 개념과 S-Lock/X-Lock, 갭 락(Next-Key Lock)의 동작을 살펴보고, JPA 동시성 테스트로 재고 차감 문제를 해결하는 과정을 정리한 글입니다."
---

이전에 [낙관적 락](../optimistic-lock/)에 대해 작성하였습니다.

낙관적 락을 요약하자면 아래와 같습니다.

- 데이터를 읽을 때 버전 상태를 확인
- 데이터를 수정할 때 현재 데이터의 버전을 확인합니다. 이때 다른 사용자가 수정하지 않았으면 업데이트가 진행되고, 버전이 변경되었으면 충돌이 난 것으로 확인하여 수정 작업은 실패하고, 충돌된 데이터를 해결하기 위한 추가 작업을 애플리케이션에서 진행합니다.

단점

- 데이터 수정이 많은 로직에서는 충돌이 많이 발생하여, 유저의 피로감이 높아져 서비스 유입에 좋지 않은 결과를 초래할 것입니다.

이를 해결하는 방법 중 하나로 **`비관적 락`**을 사용합니다.

### 비관적 락(Pessimistic)

- 모든 트랜잭션에서 충돌이 날 것이라고 가정하고, 우선적으로 Lock을 점유하여 다른 트랜잭션이 접근하지 못하게 하는 방법입니다.
- 데이터를 수정할 때 X-Lock을 점유하고 있으므로, 충돌이 발생할 가능성이 적습니다.
- 사용자가 수정할 때까지 다른 사용자는 **`스핀락`**으로 대기를 하고 있습니다.

    때문에 비관적 락 같은 경우 Time-out 설정을 통하여, 언제까지 대기를 할 것인지 꼭 지정해 줘야 합니다.

- 비관적 락의 경우 next-Lock(갭락)을 사용하기 때문에, 갭락이 무엇이고 어떻게 동작하는지 알아두면 비관적 락을 사용할 때 큰 도움이 될 것입니다.
    - 갭락 혹은 next-lock은 레코드 자체에 락을 거는 것뿐만 아니라, 해당 레코드 앞뒤의 "갭"에도 락을 거는 방식입니다. 이는 트랜잭션이 실행되는 동안 해당 범위에 새로운 레코드가 삽입되는 것을 방지합니다. 갭락 설명 블로그 : [https://idea-sketch.tistory.com/46](https://idea-sketch.tistory.com/46)

> 💡 S-Lock이란?
> Shared Lock이라고 하며, 다수의 트랜잭션이 동시에 특정 리소스(예: 데이터베이스의 행이나 테이블)를 읽을 수 있도록 허용하는 잠금 메커니즘입니다. 가장 큰 특징으로는 **`S-Lock이 걸려 있는 동안에는 X-Lock을 획득할 수 없으며, 수정이 불가능합니다.`**
>
> X-Lock이란?
> **`Exclusive Lock`**이라 하며, 데이터베이스의 특정 리소스에 단일 트랜잭션만 접근 가능하도록 합니다. X-Lock이 걸린 상태에서는 **`S-Lock, X-Lock이 접근하지 못합니다.`**

### 동시성 테스트

아래 코드는 동시성 테스트를 위한 코드입니다.

- 동시성 테스트 코드

큰 특징은

1. newFixedThreadPool
    - Java의 스레드를 생성하는 함수로, 10개의 스레드를 생성하였습니다.
2. CountDownLatch
    - new CountDownLatch(THREAD_COUNT) : 스레드 작업 카운트를 적시하여, 차후에 함수에서 사용합니다.
    - latch.await(10, TimeUnit.SECONDS) : 위에 적시한 스레드 카운트가 0이 될 때까지 기다리고 이후에 작업을 진행합니다.

```java
package com.webtoonrank.demo.core.domain.product.service;

@SpringBootTest
public class ProductServiceTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    private static final int THREAD_COUNT = 10;

    @BeforeEach
    public void setup() {
        ProductEntity product = new ProductEntity("Test Product", 20);
        productRepository.save(product);
    }

    @Test
    public void testConcurrentStockDecrease() throws InterruptedException {
        ExecutorService executorService = Executors.newFixedThreadPool(THREAD_COUNT);
        CountDownLatch latch = new CountDownLatch(THREAD_COUNT);

        ProductEntity productEntity = productRepository.findAll().get(0);
        Long productId = productEntity.getId();

        for (int i = 0; i < THREAD_COUNT; i++) {
            executorService.submit(() -> {
                try {
                    boolean success = productService.decreaseStock(productId, 1);
                    System.out.println("Stock decreased: " + success);
                } catch (RuntimeException runtimeException) {
                    System.out.println(runtimeException.getMessage());
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(10, TimeUnit.SECONDS);

        ProductEntity product = productRepository.findById(productId).orElseThrow();
        System.out.println("Final stock: " + product.getStock());
        assertThat(product.getStock()).isEqualTo(20 - THREAD_COUNT);
    }
}
```

상품 ProductEntity로 상품의 재고를 세팅한 후 decreaseStock을 통하여 재고를 줄이는 로직입니다.

```java
package com.webtoonrank.demo.storage;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Getter
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private int stock;

    public ProductEntity(String name, int stock) {
        this.name = name;
        this.stock = stock;
    }

    public ProductEntity() {

    }

    public boolean decreaseStock(int quantity) {
        if (this.stock >= quantity) {
            this.stock -= quantity;
            return true;
        } else {
            return false;
        }
    }
}
```

일반적으로 생각했을 때 스레드 개수만큼 **`productService.decreaseStock(productId, 1);`로 차감하여 `[초기 재고 수량 20 - 스레드의 카운트]`만큼 나올 것이라고 기대합니다. 하지만 실제로는 기대한 값이 나오지 않습니다.**

이렇게 나오는 이유는 아래와 같습니다.

- 즉 데이터가 커밋되기 전에 조회되어, 재고 카운트를 20으로 인지하기 때문에 동시성 이슈가 발생합니다.

### 비관적 락을 사용한 동시성 문제 해결

- 비관적 락 사용자 1

1. 사용자 1: X-Lock을 획득하여 다른 사용자가 접근하지 못하게 합니다.
2. 사용자 2: 스핀락을 통하여 락을 획득할 때까지 대기합니다.
3. 사용자 3: 같은 사유로 락을 획득할 때까지 대기합니다.
4. 사용자 4: 같은 사유로 락을 획득할 때까지 대기합니다.

- 사용자 2 락 획득

1. 사용자 1: 데이터를 update or insert 후 X-Lock을 반환합니다.
2. 사용자 2: X-Lock을 획득하여 update or insert를 진행합니다.
3. 사용자 3: 스핀락을 통하여 락을 획득할 때까지 대기합니다.
4. 사용자 4: 같은 사유로 락을 획득할 때까지 대기합니다.

**그렇다면 비관적 락은 왜 사용하는 것일까요?**

- **데이터 무결성 보장**: **`데이터 무결성을 강력하게 보장`**할 수 있어, 특히 트랜잭션 처리에서 안정성을 높일 수 있습니다.
- **충돌 방지**: 데이터에 락을 설정함으로써, **`동시에 발생할 수 있는 데이터 수정 충돌을 효과적으로 방지`**할 수 있습니다.

**비관적 락은 언제 사용하면 좋을까요?**

- **`여러 사용자가 동시에 같은 데이터를 수정할 가능성이 높은 경우`**, 예를 들어 은행 시스템의 계좌 이체와 같은 트랜잭션 처리에서 자주 사용됩니다.
- 데이터의 정확성과 일관성이 매우 중요한 경우

### 실습

- JPA에서 비관적 락을 사용하는 방법

```java
public interface ProductRepository extends JpaRepository<ProductEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductEntity p WHERE p.id = :id")
    @QueryHints({@QueryHint(name = "javax.persistence.lock.timeout", value = "10000")})
    Optional<ProductEntity> findByIdWithPessimisticLock(Long id);
}
```

- select for update를 사용하여 X-Lock을 획득하는 것을 볼 수 있습니다.

- 동시성 또한 문제없이 통과한 것을 볼 수 있습니다.
    - final stock : 10

오늘은 비관적 락에 대해 설명하였습니다.

비관적 락을 사용하면서 중요한 점은, timeout 설정을 하지 않으면 락을 획득할 때까지 계속 대기해야 되는 상황이 발생할 수 있으므로 지정하는 게 좋으며, 갭락(next-lock)으로 인해 발생할 수 있는 문제에 대해 생각하고 구현해야 합니다.

다음에는 **`분산락`**에 대해 작성하도록 하겠습니다.

- 비관적 락에서 next-lock에 의해 발생되는 DeadLock 예제

1. **트랜잭션 A**가 `users` 테이블에서 `id < 5`인 레코드를 조회하며, `3 < id < 5` 범위에 대해 Next-Key Lock을 설정합니다.

```sql
START TRANSACTION;
SELECT * FROM users WHERE id < 5 FOR UPDATE; -- 갭 락: 3 < id < 5
```

2. **트랜잭션 B**가 동시에 `users` 테이블에서 `id < 3`인 레코드를 조회하며, `1 < id < 3` 범위에 대해 Next-Key Lock을 설정합니다.

```sql
START TRANSACTION;
SELECT * FROM users WHERE id < 3 FOR UPDATE; -- 갭 락: 1 < id < 3
```

3. **트랜잭션 A**가 `id = 2`에 레코드를 삽입하려고 시도하지만, 이 범위는 트랜잭션 B에 의해 잠겨 있어 대기합니다.

```sql
INSERT INTO users (id, name) VALUES (2, 'Alice'); -- 트랜잭션 B의 갭 락 때문에 대기
```

4. **트랜잭션 B**도 동시에 `id = 4`에 레코드를 삽입하려고 시도하지만, 이 범위는 트랜잭션 A에 의해 잠겨 있어 대기합니다.

```sql
INSERT INTO users (id, name) VALUES (4, 'Bob'); -- 트랜잭션 A의 갭 락 때문에 대기
```

### 결과

트랜잭션 A와 트랜잭션 B는 각각 상대방이 설정한 Next-Key Lock으로 인해 교착 상태(데드락)에 빠지게 됩니다. 시스템은 이 데드락을 감지하고, 둘 중 하나의 트랜잭션을 롤백하여 문제를 해결하게 됩니다.
