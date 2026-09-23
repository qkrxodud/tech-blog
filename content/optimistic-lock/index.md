---
title: "DB 낙관적 락"
tags: ["낙관적 락","동시성","JPA","@Version","MySQL"]
summary: "재고 차감 동시성 테스트로 문제를 재현하고, JPA @Version 기반 낙관적 락의 동작 원리와 사용 시점, 주의할 점을 정리합니다."
---

이전에 카프카 동시성 이슈에 대해 작성하였습니다.

[Java] Kafka 동시성 발생

글을 작성하면서 찾았던 낙관적 락, 비관적 락, 분산락에 대해 설명하고, 기록하도록 하겠습니다.

### 동시성 테스트

아래 코드는 동시성 테스트를 위한 코드입니다.

큰 특징은 다음과 같습니다.

1. newFixedThreadPool
    - Java의 스레드를 생성하는 함수로, 10개의 스레드를 생성하였습니다.
2. CountDownLatch
    - new CountDownLatch(THREAD_COUNT) : 스레드 작업 카운트를 명시하여, 차후 함수에서 사용합니다.
    - latch.await(10, TimeUnit.SECONDS) : 위에 명시한 스레드 카운트가 0이 될 때까지 기다리고 이후에 작업을 진행합니다.

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

일반적으로 생각했을 때 스레드 개수만큼 **`productService.decreaseStock(productId, 1);`로 차감하여 `[초기 재고 수량 20 - 스레드 카운트]`만큼 나올 것이라고 기대합니다. 하지만 결과는 아래와 같습니다.**

<!-- 이미지 누락: Untitled.png (원본 내보내기에 미포함 — 동시성 테스트 실행 결과 캡처) -->

이렇게 나오는 이유는 아래와 같습니다.

<!-- 이미지 누락: Untitled 1.png (원본 내보내기에 미포함 — 동시성 발생 흐름 그림) -->

- 즉 데이터가 커밋되기 전에 조회되고, 재고 카운트를 20으로 인지하여 동시성 이슈가 발생합니다.

### 낙관적 락을 사용한 동시성 문제 해결

1. 낙관적 락(Optimistic Lock)
    - 데이터 충돌 가능성이 낮다고 가정하고, 트랜잭션이 완료될 때까지 잠금을 걸지 않고 데이터를 처리하는 방법입니다.

<!-- 이미지 누락: Untitled 2.png (원본 내보내기에 미포함 — 낙관적 락 version 갱신 흐름 그림) -->

- 위 그림을 보면 사용자 1은 update 시점에 version = 1을 찾고 업데이트를 통해서 version = 2로 올린 것을 확인할 수 있습니다. 나머지 유저들은 version = 1을 찾고 2로 업데이트하려고 하지만, 사용자 1이 version을 2로 업데이트했기 때문에 Exception이 발생되어 롤백이 진행됩니다.

**[정리하자면]**

1. 사용자 1 : update 성공, version = 2로 업데이트
2. 사용자 2 : update 실패, version = 1을 사용자 1이 업데이트했기 때문에 찾을 수 없어서 Exception 발생
3. 사용자 3 : update 실패, version = 1을 사용자 1이 업데이트했기 때문에 찾을 수 없어서 Exception 발생
4. 사용자 4 : update 실패, version = 1을 사용자 1이 업데이트했기 때문에 찾을 수 없어서 Exception 발생

이제 사용자 1은 원하는 주문을 성공하였고, 나머지 **`유저들은 다시 시도하면서 데이터의 일관성을 유지하면서 주문을 진행할 수`** 있습니다.

그렇다면 낙관적 락은 왜 사용하는 것일까요?

- 버전을 통해서 **`동시성을 해결`**하고, 트랜잭션이 완료될 때까지 락을 걸지 않기 때문에, 데이터베이스의 **`락 경합이 줄어들어 전체 시스템의 성능이 향상`**됩니다.

낙관적 락은 언제 사용하면 좋을까요?

- **`읽기 로직이 많고 쓰기 로직이 적을 때 사용하는 게 좋습니다.`** 이유는 위에 언급한 것처럼 애플리케이션 레벨에서 version을 통해서 관리하고, update하는 시점에 version을 갱신하여 일치하는 트랜잭션만 처리되고 나머지는 Exception을 통해 롤백되기 때문입니다.

[실습]

- JPA에서 낙관적 락 사용법
    - @Version
      private Integer version; 만 선언하면 JPA가 자동으로 업데이트 시 값을 수정해 줍니다.

```java
@Entity
@Getter
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private int stock;

    @Version
    private Integer version;

    ....

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

아래 테스트 결과를 보면

- org.springframework.orm.ObjectOptimisticLockingFailureException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect) : [com.webtoonrank.demo.storage.ProductEntity#1] 를 통해서 트랜잭션이 실패하고, 롤백되는 것을 확인할 수 있습니다.

<!-- 이미지 누락: Untitled 3.png (원본 내보내기에 미포함 — 낙관적 락 적용 후 테스트 실행 결과 캡처) -->

오늘은 낙관적 락에 대해 설명하였습니다.

직접 테스트 코드를 작성하면서 확인하였고, 낙관적 락을 언제 사용하면 좋을지 알 수 있었습니다.

한 가지 주의해야 할 점은 **데드락 상황이** 다음과 같이 발생할 수 있다는 것입니다.

1. **트랜잭션 A**가 `Table1`의 행을 수정하면서 `Table2`의 참조 무결성을 확인하기 위해 `Table2`의 잠금을 요청합니다.
2. **트랜잭션 B**가 동시에 `Table2`의 행을 수정하면서 `Table1`의 참조 무결성을 확인하기 위해 `Table1`의 잠금을 요청합니다.
3. 이때 트랜잭션 A와 트랜잭션 B는 각각 상대방이 보유한 락을 기다리게 되어 데드락 상태에 빠질 수 있습니다.

오늘은 낙관적 락에 대해

- 언제 사용하면 좋을지?
- 왜 사용하는지?
- 주의해야 할 점
- 사용 방법

을 알아보았으며, 추후에 비관적 락, 분산락에 대해서도 설명하도록 하겠습니다.

감사합니다.
