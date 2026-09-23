---
title: "[Java] 실무에서 잘못 사용하고 있던 Transaction"
tags: ["Spring","Transactional","프록시 패턴","트랜잭션","롤백"]
summary: "실무 프로젝트 전반에 REQUIRES_NEW가 남용되던 원인을 프록시 패턴과 롤백 시점 이해 부족에서 찾아 분석한 경험을 공유합니다."
---

오늘은 프로젝트를 진행하면서 잘못 사용하고 있는 `Transaction`으로 발생되었던 문제에 대해서 작성하려고 합니다. 실무에서 직접 경험한 내용으로 생각보다 `Transaction`의 특성, 성질을 모르고 습관처럼 작성하는 경우가 많았습니다.

또한 함수 위에 `Transaction`을 걸었다고 무조건 롤백이 된다고 믿고 진행되는 경우도 많아 아래와 같은 내용을 작성하게 되었습니다.

---

### 프로젝트 잘못사용하고 있는 트랜잭션

프로젝트를 처음 접하였을 때 모든 트랜잭션을 위와 같은 방법으로 사용하고 있었습니다.

```java
 @Transactional(propagation = Propagation.REQUIRES_NEW)
```

해당하는 옵션은 아래 같은 성격을 갖고 있습니다.

### **propagation : 전파옵션**

- 트랜잭션 동작 도중 다른 트랜잭션을 호출(실행)하는 상황에 선택할 수 있는 옵션입니다.
    - **REQUIRED**
        - 디폴트 속성, 부모 트랜잭션 내에서 실행하며 부모 트랜잭션이 없을 경우 새로운 트랜잭션을 생성합니다.
    - **SUPPORTS**
        - 이미 시작된 트랜잭션이 있으면 참여하고 그렇지 않으면 트랜잭션 없이 진행하게 만듭니다.
    - **REQUIRES_NEW**
        - 부모 트랜잭션을 무시하고 새로운 트랜잭션이 생성합니다.
        - 무조건 새로운 트랜잭션을 생성합니다.
        - 이미 진행중인 트랜잭션이 있으면 트랜잭션을 잠시 보류시킵니다.
    - **MANDATORY**
        - REQUIRED와 비슷하게 이미 시작된 트랜잭션이 있으면 참여합니다.
        - 트랜잭션이 시작된 것이 없으면 새로 시작하는 대신 예외를 발생시킵니다.
        - 혼자서는 독립적으로 트랜잭션을 진행하면 안 되는 경우에 사용합니다.
    - **NOT_SUPPORTED**
        - 트랜잭션을 사용하지 않게합니다.
        - 이미 진행 중인 트랜잭션이 있으면 보류시킵니다.
    - **NESTED**
        - 이미 진행중인 트랜잭션이 있으면 중첩 트랜잭션을 시작합니다.
        - 중첩 트랜잭션은 트랜잭션 안에서 다시 트랜잭션을 만듭니다.

그중에서 왜 프로젝트 전반에 트랜잭션에 **REQUIRES_NEW가 걸려있었던 것일까?**

동료들에게 물어본 결과

- 롤백이 안 되서 걸었다
- 하이버네이트를 너무 신뢰하지 말고, 서비스를 운영해야 된다.

라고 전달받았습니다. 프로젝트 전반에 이렇게 전파옵션을 주는 게 맞을까? 라는 생각이 들면서 **프로젝트 전반에 걸려있는 트랜잭션을 분석하게 되었고 아래와 같은 문제를 갖고 사용하고 있었습니다.**

---

### 1. Spring **Transaction**의 프록시 패턴을 이해하지 않고 사용하는 문제점

Spring Transaction은 프록시 패턴으로 구현이 되어있습니다.

Spring은 AOP(Aspect-Oriented Programming, 관점 지향 프로그래밍)를 사용하여 트랜잭션 관리 기능을 프록시 패턴으로 구현합니다. 구체적으로는, 트랜잭션이 적용된 메서드를 호출할 때, 실제 메서드를 호출하기 전에 **`프록시 객체가 트랜잭션을 시작하고, 메서드 호출 후에는 트랜잭션을 커밋하거나 롤백하는 방식`**으로 동작합니다.

> **프록시 패턴이란?**
>
> 프록시 패턴(Proxy Pattern)은 실제 객체에 대한 접근을 제어하거나 추가 기능을 부여하기 위해 그 객체를 감싸는 대리 객체를 사용하는 디자인 패턴입니다. 프록시 객체는 클라이언트가 실제 객체를 호출하는 것처럼 보이게 하면서, 중간에 로직을 삽입할 수 있습니다.

그렇다면, 같은 클래스 내부에서 트랜잭션 함수에서 트랜잭션 함수로 호출하게 될 경우 과연 롤백이 잘될 것인가? 라는 의문을 품을 수 있습니다.

**Test Code**

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public void outerMethod() {
        User outerUser = User.builder()
                .name("Outer User")
                .build();

        userRepository.save(UserEntity.of(outerUser));
        try {
            innerMethod();
        } catch (Exception e) {
            System.out.println("Exception caught in outerMethod: " + e.getMessage());
        }
    }

    @Transactional
    public void innerMethod() {
        User innerUser = User.builder()
                .name("Inner User")
                .build();

        userRepository.save(UserEntity.of(innerUser));
        throw new RuntimeException("Error in innerMethod");
    }
}
```

```java
@Test
    public void testTransactionRollback() {
        try {
            userService.outerMethod();
        } catch (Exception e) {
           
        }

        // Outer User는 저장되어 있어야 하고 Inner User는 저장되지 않아야 함
        List<User> users = new UserEntities(userRepository.findAll())
                .toModels();

        assertEquals(1, users.size());
        assertEquals("Outer User", users.get(0).getName());
    }
```

테스트 코드를 보면

1. outerMethod를 호출
2. 내부적으로 try - catch로 innerMethod를 호출
3. innerMethod에서 throw new RuntimeException를 발생함으로 1개의 user만 등록될 것이라 생각할 수 있습니다. 하지만 결과는 아래와 같습니다.

이는 **`클래스 내부에서 내부로 프록시 패턴을 사용하지 않고 트랜잭션을 사용`**하여, 롤백이 되지 않는 것입니다.
<!-- 이미지 누락: image.png — 원본 내보내기에 첨부 파일이 포함되지 않아 복원하지 못했습니다. -->
때문에 트랜잭션은 프록시 패턴을 사용하고 있고, 프록시 패턴을 사용하려면 클래스에서 클래스로 호출해야 된다는 것을 알 수 있습니다.

---

### 2. Spring **Transaction**의 롤백 시점을 이해하지 않고 사용하는 문제

Spring Transaction은 Exception이 발생될 때 RollBack을 실행합니다.

아래 Transaction 내부 함수로 들어가 보도록 하겠습니다.

`DefaultTransactionAttribute.java`의 `rollbackOn` 함수를 보도록 하겠습니다.

```java
@Override
public boolean rollbackOn(Throwable ex) {
   return (ex instanceof RuntimeException || ex instanceof Error);
}
```

- 때문에 트랜잭션은 RuntimeException or Error 가 발생될 때 롤백이 발생된다는 것을 알 수 있습니다.

때문에 Transaction 함수 내부에서 Try-catch를 하게 되면 예외를 잡게 돼서 롤백이 안 되는 것을 확인할 수 있습니다.

**Test Code**

```java
    @Transactional
    public void innerMethod() {
        User innerUser = User.builder()
                .name("Inner User")
                .build();
        try {
            userRepository.save(UserEntity.of(innerUser));
            throw new RuntimeException("Error in innerMethod");
        } catch (RuntimeException e) {
            System.out.println("Exception caught in innerMethod: " + e.getMessage());
        }
    }
```

```java
@Test
    public void testTransactionRollback() {
        try {
            userService.innerMethod();
        } catch (Exception e) {
            // Outer method should catch the exception and prevent propagation
        }

        // Inner User는 throw로 인해 롤백되어 user.size = 0이 되어야된다.
        List<User> users = new UserEntities(userRepository.findAll())
                .toModels();

        assertEquals(0, users.size());
    }
```

테스트 코드를 보면

1. innerMethod() 호출
2. @Transaction 내부의 Try - catch의 save를 호출
3. throw new RuntimeException 발생
4. Try - catch로 예외를 잡아버림
5. 이로 인해 롤백이 안 됨
<!-- 이미지 누락: image 1.png — 원본 내보내기에 첨부 파일이 포함되지 않아 복원하지 못했습니다. -->
---

이제 처음으로 돌아가서 `@Transactional(propagation = Propagation.REQUIRES_NEW)`을 주고 사용했던 이유에 대해 공유하도록 하겠습니다.

모든 서비스에서 사용하는 트랜잭션을 직접 확인해 보았습니다.

해당하는 함수로 트랜잭션의 이름을 확인할 수 있었습니다.

```java
**String transactionName = TransactionSynchronizationManager.getCurrentTransactionName();**
```

해당하는 함수로 트랜잭션 이름을 확인해 본 결과 컨트롤러의 이름으로 트랜잭션이 잡혀있었으며, 왜 이렇게 잡혀있는지 분석하기 시작하였습니다.

확인한 결과 아래와 같이 AOP로 Controller에 전부 트랜잭션이 잡혀있는 것을 확인하였습니다.

```java
<aop:config>
        <aop:pointcut id="txPointcut" expression="execution(.... *Controller.*(..))" />
        <aop:advisor advice-ref="txAdvice" pointcut-ref="txPointcut" />
    </aop:config>
```

때문에 해당하는 프로젝트의 컨트롤러를 Ctr로 변경 후 테스트해 본 결과 롤백이 잘 되는 것을 확인하였고, 당분간 `Ctr`로 변경한 후 전부 변경되었을 때 Controller로 변경하기로 합의하였습니다.

오늘은 `@Transactional(propagation = Propagation.REQUIRES_NEW)`으로 시작하여, 잘못 사용하는 트랜잭션을 전부 확인했던 내용을 공유하게 되었습니다. 현재는 올바르게 사용 중에 있으며, 당연하게 Transaction을 사용하기보다 어떻게 동작하는지 알고 있으면 문제 발생 시 도움이 될 것 같아 공유하게 되었습니다. 감사합니다.
