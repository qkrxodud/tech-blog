---
title: "[Java] @Transactional try ~ catch 롤백 안 되는 원인"
tags: ["Spring","Transactional","롤백","TransactionAspectSupport","RuntimeException"]
summary: "@Transactional 안에서 try ~ catch로 예외를 감쌀 때 롤백이 동작하지 않는 원인을 TransactionAspectSupport 내부 동작으로 분석하고 해결 방법을 정리합니다."
---

@Transactional Try ~ catch를 적용한 경우의 코드는 다음과 같습니다.

```java
@Transactional
public Long save(Object object) {
		Long saveId;
    try {
			saveId = repository.save(Object);
    } catch (RuntimeException re ) {
			log.error("save fail, message: {},", re.getMessage());
    }
    return saveId;
}
```

### 문제 발생

@Transactional 안에 try ~ catch로 감싸져 있는 코드가 있었습니다. 문제는 try ~ catch 안에서 익셉션이 발생했을 때 롤백이 동작하지 않는 것이었습니다.

@Transactional에 대해 찾아보게 되었습니다.

@Transactional을 동작시키면 아래의 순서로 동작하게 됩니다.

1. `service` 레이어에서 `Exception` 발생
2. `TransactionAspectSupport.java`의 `invokeWithinTransaction` 함수를 실행
3. `invokeWithinTransaction`의 try ~ catch에서 `completeTransactionAfterThrowing` 실행

```java
protected Object invokeWithinTransaction(Method method, Class<?> targetClass, final InvocationCallback invocation)
			throws Throwable {

		// If the transaction attribute is null, the method is non-transactional.
		final TransactionAttribute txAttr = getTransactionAttributeSource().getTransactionAttribute(method, targetClass);
		final PlatformTransactionManager tm = determineTransactionManager(txAttr);
		final String joinpointIdentification = methodIdentification(method, targetClass, txAttr);

		if (txAttr == null || !(tm instanceof CallbackPreferringPlatformTransactionManager)) {
			// Standard transaction demarcation with getTransaction and commit/rollback calls.
			TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, joinpointIdentification);
			Object retVal = null;
			try {
				// This is an around advice: Invoke the next interceptor in the chain.
				// This will normally result in a target object being invoked.
				retVal = invocation.proceedWithInvocation();
			}
			catch (Throwable ex) {
				// target invocation exception
				completeTransactionAfterThrowing(txInfo, ex);
				throw ex;
			}
			finally {
				cleanupTransactionInfo(txInfo);
			}
			commitTransactionAfterReturning(txInfo);
			return retVal;
		}
		....
```

`TransactionAspectSupport.java`

1. `completeTransactionAfterThrowing` 함수 실행
2. `txInfo.transactionAttribute.rollbackOn(ex)` 동작

```java
protected void completeTransactionAfterThrowing(TransactionInfo txInfo, Throwable ex) {
		if (txInfo != null && txInfo.hasTransaction()) {
			if (logger.isTraceEnabled()) {
				logger.trace("Completing transaction for [" + txInfo.getJoinpointIdentification() +
						"] after exception: " + ex);
			}
			if (txInfo.transactionAttribute.rollbackOn(ex)) {
				...
```

구현체 `RuleBasedTransactionAttribute.java`

1. rollbackOn은 `if (winner == null)`이면 `super.rollbackOn(ex);` 동작

```java
@Override
	public boolean rollbackOn(Throwable ex) {
		if (logger.isTraceEnabled()) {
			logger.trace("Applying rules to determine whether transaction should rollback on " + ex);
		}

		RollbackRuleAttribute winner = null;
		int deepest = Integer.MAX_VALUE;

		if (this.rollbackRules != null) {
			for (RollbackRuleAttribute rule : this.rollbackRules) {
				int depth = rule.getDepth(ex);
				if (depth >= 0 && depth < deepest) {
					deepest = depth;
					winner = rule;
				}
			}
		}

		if (logger.isTraceEnabled()) {
			logger.trace("Winning rollback rule is: " + winner);
		}

		// User superclass behavior (rollback on unchecked) if no rule matches.
		if (winner == null) {
			logger.trace("No relevant rollback rule found: applying default rules");
			return super.rollbackOn(ex);
		}

		return !(winner instanceof NoRollbackRuleAttribute);
	}
```

구현체 `DefaultTransactionAttribute.java`의 `rollbackOn`을 보면

- RuntimeException
- Error

에 대해 `롤백`을 처리하는 것을 확인할 수 있습니다.

```java
@Override
public boolean rollbackOn(Throwable ex) {
   return (ex instanceof RuntimeException || ex instanceof Error);
}
```

@Transactional은 RuntimeException과 Error를 잡는 것을 확인하였습니다.

그렇다면 왜 @Transactional 안의 try ~ catch에서는 롤백이 되지 않는 것일까요?

**그 이유는 서비스 레이어에서 try ~ catch로 예외를 잡을 경우**, `TransactionAspectSupport.java`의 `invokeWithinTransaction`에서 catch로 잡지 못하게 되어, 롤백이 진행되지 않기 때문입니다.

### 해결 방법

- try ~ catch로 감싼 후 예외가 발생했을 때 throw로 Unchecked Exception을 발생시킵니다.

```java
@Transactional
public Long save(Object object) {
		Long saveId;
    try {
			saveId = repository.save(Object);
    } catch (RuntimeException re ) {
			log.error("save fail, message: {},", re.getMessage());
			throw new RuntimeException("UnChecked Exception");
    }
    return saveId;
}
```

### 후기

오늘은 *트랜잭션에 대해* 분석하게 되었습니다. 기본적으로 트랜잭션은 RuntimeException과 Error에 대해 롤백이 *진행되며,* checkException에 대해서는 catch에서 RuntimeException을 발생시켜 *롤백시켜* 줄 수 있다는 것을 알 수 있었습니다. 추가로 왜 try ~ catch에서 롤백이 되지 않는지 명확하게 알 수 있는 기회였습니다.
