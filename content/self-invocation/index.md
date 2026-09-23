---
title: "self-invocation"
tags: ["Spring AOP","@Transactional","self-invocation","REQUIRES_NEW","프록시"]
summary: "같은 클래스 내부 호출에서 @Transactional이 조용히 무시되는 self-invocation 문제의 원인과, REQUIRES_NEW를 안전하게 쓰는 해결 방법을 정리합니다."
---

## 들어가며

같은 클래스 안에서 메서드가 자기 자신을 `this.메서드()`로 호출하면, 그 메서드에 붙은 `@Transactional`이 **동작하지 않습니다.** 이를 self-invocation 문제라고 부릅니다.

이유는 한 줄로 정리됩니다. Spring AOP는 원본 객체를 **프록시로 감싸서** 트랜잭션 같은 부가 기능을 프록시에만 심어두는데, 내부 호출(`this`)은 그 프록시를 거치지 않기 때문입니다. (프록시가 정확히 어떻게 동작하고 어떻게 만들어지는지는 별도 글에서 다룹니다.)

이 글에서는 self-invocation이 실무에서 `@Transactional`, 특히 `REQUIRES_NEW`를 쓸 때 어떻게 터지는지와, 어떻게 해결하는지에 집중합니다.

---

## 1. self-invocation이란

먼저 현상부터 보겠습니다. `foo()`가 같은 클래스의 `bar()`를 호출하는 객체가 있습니다.

```java
public class SimplePojo implements Pojo {

    @Override
    public void foo() {
        log.info("### foo");
        bar();              // this.bar()
    }

    @Override
    public void bar() {
        log.info("### bar");
    }
}
```

그리고 메서드 호출 전에 메서드 이름을 찍는 부가 기능(advice)을 준비합니다. `>>> execute method [...]` 로그를 찍는 주체가 바로 이 객체입니다.

```java
@Slf4j
public class ExecuteLoggingAdvice implements MethodInterceptor {

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        log.info(">>> execute method [{}]", invocation.getMethod().getName());  // 부가 기능
        return invocation.proceed();   // 실제 타겟 메서드 호출
    }
}
```

이제 `SimplePojo`를 프록시로 감싸면서 이 `ExecuteLoggingAdvice`를 붙입니다.

```java
ProxyFactory factory = new ProxyFactory(new SimplePojo());
factory.addInterface(Pojo.class);
factory.addAdvice(new ExecuteLoggingAdvice());   // ★ 로그 advice 등록

Pojo pojo = (Pojo) factory.getProxy();
pojo.foo();
```

`foo()`를 호출하면 직관적으로는 `foo`와 `bar` 양쪽 모두 advice 로그가 찍힐 것 같습니다. 하지만 실제로는 `foo`만 찍히고 `bar`는 찍히지 않습니다.

```java
>>> execute method [foo]
### foo
### bar                       ← advice 없이 그냥 실행됨
```

프록시를 거쳐 `foo()`까지는 부가 기능이 잘 적용됐지만, `foo()` 내부에서 부른 `bar()`에는 적용되지 않았습니다. 이것이 self-invocation입니다.

핵심 원리만 짚어 보면, 부가 기능은 **프록시에만** 들어있습니다. 원본 타겟 객체는 자기를 감싼 프록시의 존재조차 모릅니다. 그래서 타겟 메서드 안에서 `this.bar()`를 부르면, `this`는 프록시가 아니라 **순수한 원본 객체**이므로 부가 기능을 거칠 방법이 없습니다. 이것이 프록시 기반 AOP의 구조적 한계입니다.

> Spring 공식 문서도 같은 설명을 합니다. 호출이 타겟 객체에 도달한 이후 그 객체가 `this.bar()`처럼 자기 자신을 호출하면, 그 호출은 프록시가 아니라 `this` 참조에 대해 일어나므로 advice가 적용될 기회가 없습니다.

---

## 2. 실무에서 터지는 지점: @Transactional과 REQUIRES_NEW

self-invocation이 가장 치명적으로 드러나는 곳이 트랜잭션 전파 옵션, 특히 `REQUIRES_NEW`입니다.

`REQUIRES_NEW`의 핵심은 **"기존 트랜잭션이 있어도 그걸 잠시 보류(suspend)하고 완전히 독립된 새 트랜잭션을 시작한다"**는 것입니다. 대표 용도는 "메인 로직은 실패하면 롤백하되, 시도 이력·로그는 무조건 남기고 싶다"는 경우입니다.

그런데 아래처럼 짜면 의도와 정반대 결과가 나옵니다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderLogRepository orderLogRepository;

    @Transactional
    public void placeOrder(Order order) {
        saveLog(order.getId(), "주문 처리 시작");   // this.saveLog() 내부 호출!
        orderRepository.save(order);
        if (order.getAmount() <= 0) {
            throw new IllegalStateException("잘못된 금액");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)   // 붙어있어도 무시됨
    public void saveLog(Long orderId, String message) {
        orderLogRepository.save(new OrderLog(orderId, message));
    }
}
```

`this.saveLog()`는 내부 호출이라 프록시를 거치지 않고, `REQUIRES_NEW`가 완전히 무시된 채 그냥 `placeOrder`의 트랜잭션 안에서 실행됩니다. 결국 예외가 터지면 **로그도 메인과 함께 롤백되어 사라집니다.** 분리하고 싶었던 로그가 같이 날아가는, 의도와 정반대의 결과입니다.

한 가지 헷갈리기 쉬운 점이 있습니다. 만약 `OrderLogRepository`가 `JpaRepository`를 상속했다면, 구현체인 `SimpleJpaRepository.save`에 자체 `@Transactional`이 붙어 있어 저장 자체는 될 수도 있습니다. 하지만 그건 우리가 의도한 `REQUIRES_NEW` 트랜잭션 덕분이 아니라 JPA 구현체 내부 트랜잭션 덕분일 뿐입니다. 어노테이션은 멀쩡히 붙어 있는데 조용히 동작하지 않으니 디버깅도 까다롭습니다.

---

## 3. 해결 방법

핵심 원리는 하나입니다. **`@Transactional` 메서드는 반드시 프록시를 거쳐 호출돼야 발동합니다.** 이 조건을 만족시키는 방법은 다음과 같습니다.

### 3-1. 정석: 하위 레이어 컴포넌트로 분리

`REQUIRES_NEW` 메서드를 다른 빈으로 빼면, 그 빈의 프록시를 거치는 외부 호출이 되어 정상 동작합니다.

이때 추출한 빈을 동료 `Service`로 두고 `Service → Service`로 호출하면, 지금은 괜찮아도 나중에 반대 방향 의존이 끼어 **순환 참조**로 번질 수 있습니다. 그래서 추출 대상은 **오직 Repository에만 의존하는 하위 레이어 컴포넌트(leaf)**로 두는 것이 안전합니다. 의존 그래프의 말단이라 구조적으로 사이클이 생길 수 없습니다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final OrderLogWriter orderLogWriter;   // ★ 하위 leaf 컴포넌트

    @Transactional
    public void placeOrder(Order order) {
        orderLogWriter.append(order.getId(), "주문 처리 시작");  // 다른 빈 호출 → 프록시 거침
        orderRepository.save(order);
        if (order.getAmount() <= 0) {
            throw new IllegalStateException("잘못된 금액");
        }
    }
}

// 오직 Repository에만 의존하는 leaf 컴포넌트. 어떤 Service도 주입받지 않는다.
@Component
@RequiredArgsConstructor
public class OrderLogWriter {
    private final OrderLogRepository orderLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)   // ★ 이제 진짜 발동
    public void append(Long orderId, String message) {
        orderLogRepository.save(new OrderLog(orderId, message));
    }
}
```

동작 결과:

1. `placeOrder`가 트랜잭션 A 시작
2. `orderLogWriter.append()` → A를 잠시 보류, 새 트랜잭션 B 시작 → 로그 저장 후 **B 즉시 커밋** → A 재개
3. `orderRepository.save(order)`는 A에 속함
4. 예외 발생 → **A 롤백** → 주문은 사라짐
5. 로그(B)는 이미 커밋됐으므로 **DB에 남음** ✅

책임을 분리하면서 self-invocation도 자연스럽게 사라지고, leaf로 두었기에 순환 참조 걱정도 없습니다. 사실상 대부분의 경우 이 방법이면 충분합니다. (참고로 `OrderLogWriter`가 어떤 서비스도 주입받지 않는 한, 생성자 주입이므로 혹시 사이클이 생기더라도 Spring이 기동 시점에 바로 에러로 잡아줍니다.)

### 주의: REQUIRES_NEW의 커넥션 점유

`REQUIRES_NEW`는 바깥 트랜잭션을 보류한 채 새 커넥션으로 동작하기 때문에 그 순간 **커넥션을 2개 동시에 점유합니다.** 로그 한 번 찍는 정도면 괜찮지만, 루프 안에서 남발하면 커넥션 풀이 고갈되고 최악의 경우 데드락과 비슷한 상황도 발생할 수 있습니다. "꼭 독립 커밋이 필요한 지점"에만 좁게 사용하는 것이 좋습니다.

또한 의도가 "주문 성공/실패와 무관하게 이력을 남긴다"가 아니라 "**커밋된 후에만** 후속 작업(알림 발송 등)을 한다"라면, `REQUIRES_NEW`보다 **`@TransactionalEventListener(phase = AFTER_COMMIT)`**가 더 적합합니다. 용도를 구분해서 선택하는 것이 좋습니다.

---

## 4. 정리

- self-invocation은 타겟 객체에서 `this.~~()`로 자기 자신을 호출할 때 발생합니다. 부가 기능은 **프록시에만** 있는데, 내부 호출은 프록시를 거치지 않기 때문입니다.
- 트랜잭션, 특히 `REQUIRES_NEW`에서 가장 치명적으로 드러납니다. 어노테이션이 조용히 무시되어 의도와 정반대 결과가 나옵니다.
- 해결의 핵심은 "`@Transactional` 메서드는 반드시 프록시를 거쳐 호출돼야 한다"는 것입니다. 하위 leaf 컴포넌트로 분리(정석), TransactionTemplate, AspectJ 중 상황에 맞게 선택하면 되며, 대부분은 하위 컴포넌트 분리만으로 충분합니다. 이때 추출한 빈은 Repository에만 의존하는 leaf로 두어 순환 참조를 피합니다.

결국 가장 좋은 방법은 **self-invocation 상황 자체를 만들지 않도록 객체의 책임을 분리하고 외부 호출로 설계하는 것**입니다. 트랜잭션도 깔끔하게 잡히고 코드 구조도 좋아지는 방향입니다.

---

### Reference

- Spring Framework 공식 문서 — Understanding AOP Proxies
- [https://woodcock.tistory.com/30](https://woodcock.tistory.com/30)
