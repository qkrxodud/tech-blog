---
title: "테스트에서 만난 NoUniqueBeanDefinitionException"
tags: ["Spring","트랜잭션","테스트 코드","NoUniqueBeanDefinitionException","PlatformTransactionManager"]
summary: "여러 개의 트랜잭션 매니저 빈이 등록된 환경에서 테스트 코드가 NoUniqueBeanDefinitionException을 던진 원인과 해결 과정을 정리합니다."
---

## 상황 설명

테스트 코드를 작성하는 도중 트랜잭션 관련해서 아래와 같은 에러가 발생하는 것을 확인했습니다.

```
2022-10-14 17:43:26.877 [main] DEBUG o.s.t.c.t.TestContextTransactionUtils.logBeansException(215) - Caught exception while retrieving PlatformTransactionManager for test context [DefaultTestContext@2bea5ab4 testClass = UserRoleTaskTest, testInstance = com.example.batch.task.UserRoleTaskTest@166fa74d, testMethod = testUserBan@UserRoleTaskTest, testException = [null], mergedContextConfiguration = [MergedContextConfiguration@3d8314f0 testClass = UserRoleTaskTest, locations = '{classpath*:context/applicationContext*.xml}', classes = '{}', contextInitializerClasses = '[]', activeProfiles = '{}', propertySourceLocations = '{}', propertySourceProperties = '{}', contextCustomizers = set[[empty]], contextLoader = 'org.springframework.test.context.support.DelegatingSmartContextLoader', parent = [null]]]
org.springframework.beans.factory.NoUniqueBeanDefinitionException: No qualifying bean of type 'org.springframework.transaction.PlatformTransactionManager' available: expected single matching bean but found 4: transactionManagerSlave,transactionManagerRecallSlave,transactionManager,transactionManagerRecall
```

## 문제점

tx:annotation-driven 기반 Multiple Transaction 설정이 원인이었습니다.

더 조사를 해봐야겠지만, 현재 파악한 문제는 다음과 같이 추측됩니다. 해당 빈 설정에서 트랜잭션 빈을 2개 등록해두고, 결국 테스트 코드에서 어떤 빈을 사용할지 선택하지 못해서 발생하는 것으로 보입니다. 이 부분은 좀 더 명확하게 파악해서 수정하겠습니다.

```java
<tx:annotation-driven transaction-manager="transactionManager"/>
<bean id="transactionManager" class="org.springframework.orm.jpa.JpaTransactionManager">
      <property name="dataSource" ref="datasource1" />
</bean>
<bean id="transactionManager" class="org.springframework.orm.jpa.JpaTransactionManager">
      <property name="dataSource" ref="datasource2" />
</bean>
```

## 해결 방법

테스트 코드에서 어떤 트랜잭션을 사용하는지 직접 지정해줌으로써, spring이 어떤 트랜잭션 매니저를 사용할지 명시적으로 작성해주는 것입니다.

```java
@RunWith(SpringJUnit4ClassRunner.class)
@Transactional("transactionManager")
@Slf4j
public class testCode {
```

## 하면서 오류를 발견하기 어려웠던 점

아래의 예시 때문에 트랜잭션이 잘 작동된다고 착각했습니다. 트랜잭션이 잘 작동되는 것이 아니라, RuntimeException으로 인한 롤백이었던 것입니다. 오류가 발생했는데도 잘 작동되는 부분처럼 보여서 원인을 찾는 데 많이 헤맸습니다.

- RuntimeException 때문에 트랜잭션을 롤백할지 결정되며, 딱히 지정된 규칙이 없어서 기본 규칙으로 롤백됩니다.
- RuntimeException 혹은 Error의 경우 rollback하지만, checked exception은 하지 않습니다.

```java
If no custom rollback rules apply,
the transaction will roll back on {@link RuntimeException} and {@link Error}
but not on checked exceptions.
```

트랜잭션 롤백 참조: [응? 이게 왜 롤백되는거지? | 우아한형제들 기술블로그](https://techblog.woowahan.com/2606/)

참조 웹사이트: [tx:annotation-driven기반 Mulitiple Transaction 설정](https://beyondj2ee.wordpress.com/2013/06/15/txannotation-driven%EA%B8%B0%EB%B0%98-mulitiple-transaction-%EC%84%A4%EC%A0%95/)
