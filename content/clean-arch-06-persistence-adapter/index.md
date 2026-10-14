---
title: "[만들면서 배우는 클린 아키텍처] 영속성 어댑터 구현하기"
tags: ["클린 아키텍처","육각형 아키텍처","Spring Data JPA","SOLID"]
summary: "영속성 어댑터의 책임과 인터페이스 분리 원칙에 따라 포트를 좁게 나누는 방법을 정리하고, 스프링 데이터 JPA 예제와 트랜잭션 경계 설정 방식을 설명합니다."
---

이전에 [웹 어댑터 구현하기](../clean-arch-05-web-adapter/)에 대해 작성하였습니다. 이번 글에서는 애플리케이션 서비스에 영속성 기능을 제공하는 영속성 어댑터의 책임과, 포트 인터페이스와 영속성 어댑터를 나누는 방법, 스프링 데이터 JPA로 구현한 예제, 트랜잭션 경계를 어디에 두는지에 대해 정리하도록 하겠습니다.

## 의존성 역전

영속성 어댑터는 애플리케이션 서비스에 영속성 기능을 제공하기 위해 [의존성 역전 원칙](../clean-arch-02-dependency-inversion/)을 적용합니다. 서비스와 포트, 영속성 어댑터의 관계는 아래와 같습니다.

![서비스는 포트를 호출하고 영속성 어댑터는 포트를 구현해 의존성이 애플리케이션 코어를 향하는 구조](images/01_dependency-inversion.svg)

육각형 아키텍처에서 영속성 어댑터는 '주도되는' 혹은 '아웃고잉' 어댑터입니다. 애플리케이션에 의해 호출될 뿐, 애플리케이션을 호출하지는 않기 때문입니다.

포트는 애플리케이션 서비스와 영속성 코드 사이의 간접 계층입니다. 이 간접 계층을 두는 이유는 영속성 문제에 신경 쓰지 않고 도메인 코드를 개발하기 위해서, 즉 영속성 계층에 대한 코드 의존성을 없애기 위해서입니다.

## 영속성 어댑터의 책임

영속성 어댑터는 일반적으로 아래와 같은 일을 합니다.

1. 입력을 받습니다.
2. 입력을 데이터베이스 포맷으로 매핑합니다.
3. 입력을 데이터베이스로 보냅니다.
4. 데이터베이스 출력을 애플리케이션 포맷으로 매핑합니다.
5. 출력을 반환합니다.

다섯 단계를 코어와 영속성 어댑터, 데이터베이스로 나누어 보면 아래와 같습니다.

![영속성 어댑터가 코어의 입력 모델을 받아 DB 포맷으로 매핑해 쿼리를 보내고, DB 응답을 애플리케이션 포맷으로 매핑해 코어의 출력 모델로 반환하는 다섯 단계](images/02_adapter-responsibility.svg)

영속성 어댑터는 포트 인터페이스를 통해 입력을 받습니다. 이때 입력 모델은 영속성 어댑터 내부가 아니라 애플리케이션 코어에 있기 때문에, 영속성 어댑터 내부를 변경해도 코어에는 영향이 없습니다.

다음으로 영속성 어댑터는 데이터베이스에 쿼리를 날리고 쿼리 결과를 받아옵니다. 마지막으로 데이터베이스 응답을 포트에 정의된 출력 모델로 매핑해서 반환합니다. 출력 모델 역시 영속성 어댑터가 아니라 **애플리케이션 코어에 위치하는 것이 중요합니다.**

입출력 모델이 영속성 어댑터가 아니라 애플리케이션 코어에 있다는 점을 제외하면, 책임은 전통적인 영속성 계층의 책임과 크게 다르지 않습니다.

## 포트 인터페이스 나누기

일반적으로는 아래 그림처럼 특정 엔티티가 필요로 하는 모든 데이터베이스 연산을 하나의 리포지토리 인터페이스에 넣어 둡니다.

![SendMoneyService와 RegisterAccountService가 모든 연산을 담은 AccountRepository 하나에 의존하는 구조](images/03_wide-port.svg)

이렇게 하나의 아웃고잉 포트 인터페이스에 모든 데이터베이스 연산을 모아 두면, 모든 서비스가 실제로는 필요하지 않은 메서드에도 의존하게 됩니다.

> 💡 필요 없는 화물을 운반하는 무언가에 의존하고 있으면 예상하지 못했던 문제가 생길 수 있습니다.
> 로버트 C. 마틴

인터페이스 분리 원칙(ISP)이 이 문제의 답을 제시합니다. 클라이언트가 오로지 자신이 필요로 하는 메서드만 알면 되도록, 넓은 인터페이스를 특화된 인터페이스로 분리해야 한다는 원칙입니다. 이 원칙을 적용하면 아래와 같이 나눌 수 있습니다.

![SendMoneyService는 LoadAccountPort와 UpdateAccountStatePort에, RegisterAccountService는 CreateAccountPort에만 의존하는 구조](images/04_narrow-ports.svg)

이제 각 서비스는 실제로 필요한 메서드에만 의존합니다. 또한 포트의 이름만 보고도 포트의 역할을 알 수 있습니다.

이렇게 좁은 포트를 만들면 서비스 코드를 작성할 때 필요한 포트만 연결하면 되고, 함께 따라오는 불필요한 메서드가 없습니다(책에서는 이를 플러그 앤드 플레이 경험이라고 표현합니다).

다만 모든 상황에 '포트 하나당 하나의 메서드'를 적용하기는 어렵습니다. 응집성이 높고 함께 사용될 때가 많아서 하나의 인터페이스에 묶고 싶은 데이터베이스 연산들도 있을 수 있습니다.

## 영속성 어댑터 나누기

포트뿐 아니라 영속성 어댑터도 여러 개로 나눌 수 있습니다. 아래는 애그리거트당 하나의 영속성 어댑터를 만든 구조입니다.

![AccountPersistenceAdapter가 LoadAccountPort와 UpdateAccountStatePort를, UserPersistenceAdapter가 CreateAccountPort를 구현하는 구조](images/05_split-adapters.svg)

이렇게 하면 영속성 어댑터들이 각 영속성 기능을 이용하는 도메인 경계를 따라 자연스럽게 나뉩니다.

도메인 코드는 영속성 포트에 정의된 명세를 어떤 클래스가 충족시키는지에는 관심이 없습니다. 모든 포트가 구현돼 있기만 하다면, 영속성 계층에서는 어떤 방식으로 구현해도 됩니다.

바운디드 컨텍스트 간의 경계를 명확하게 구분하고 싶다면, 아래처럼 각 바운디드 컨텍스트가 자신의 영속성 어댑터를 가지고 있어야 합니다.

![account 컨텍스트와 billing 컨텍스트가 각각 자신의 영속성 어댑터를 가지고 자기 포트만 구현하는 구조](images/06_bounded-context.svg)

## 스프링 데이터 JPA 예제

먼저 도메인 모델인 Account 클래스입니다.

```java
package io.reflectoring.buckpal.account.domain;

import java.time.LocalDateTime;
import java.util.Optional;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Value;

@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Account {

	@Getter private final AccountId id;

	@Getter private final Money baselineBalance;

	@Getter private final ActivityWindow activityWindow;

	
	public static Account withoutId(
					Money baselineBalance,
					ActivityWindow activityWindow) {
		return new Account(null, baselineBalance, activityWindow);
	}

	public static Account withId(
					AccountId accountId,
					Money baselineBalance,
					ActivityWindow activityWindow) {
		return new Account(accountId, baselineBalance, activityWindow);
	}

	public Optional<AccountId> getId(){
		return Optional.ofNullable(this.id);
	}

	public Money calculateBalance() {
		return Money.add(
				this.baselineBalance,
				this.activityWindow.calculateBalance(this.id));
	}

	public boolean withdraw(Money money, AccountId targetAccountId) {

		if (!mayWithdraw(money)) {
			return false;
		}

		Activity withdrawal = new Activity(
				this.id,
				this.id,
				targetAccountId,
				LocalDateTime.now(),
				money);
		this.activityWindow.addActivity(withdrawal);
		return true;
	}

	private boolean mayWithdraw(Money money) {
		return Money.add(
				this.calculateBalance(),
				money.negate())
				.isPositiveOrZero();
	}

	public boolean deposit(Money money, AccountId sourceAccountId) {
		Activity deposit = new Activity(
				this.id,
				sourceAccountId,
				this.id,
				LocalDateTime.now(),
				money);
		this.activityWindow.addActivity(deposit);
		return true;
	}

	@Value
	public static class AccountId {
		private Long value;
	}

}
```

Account 클래스는 getter와 setter만 가진 간단한 데이터 클래스가 아니며, 최대한 불변성을 유지하도록 만들어져 있습니다.

데이터베이스와 통신할 때 스프링 데이터 JPA를 사용하므로, 계좌의 데이터베이스 상태를 표현하는 `@Entity` 애너테이션이 추가된 클래스도 필요합니다.

```java
package io.reflectoring.buckpal.account.adapter.out.persistence;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Table;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "account")
@Data
@AllArgsConstructor
@NoArgsConstructor
class AccountJpaEntity {

	@Id
	@GeneratedValue
	private Long id;

}
```

다음은 activity 테이블을 표현하는 클래스입니다.

```java
package io.reflectoring.buckpal.account.adapter.out.persistence;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Table;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "activity")
@Data
@AllArgsConstructor
@NoArgsConstructor
class ActivityJpaEntity {

	@Id
	@GeneratedValue
	private Long id;

	@Column
	private LocalDateTime timestamp;

	@Column
	private Long ownerAccountId;

	@Column
	private Long sourceAccountId;

	@Column
	private Long targetAccountId;

	@Column
	private Long amount;

}
```

다음으로 스프링 데이터를 사용해, 기본적인 CRUD 기능과 데이터베이스에서 활동(activity)들을 로드하기 위한 커스텀 쿼리를 제공하는 리포지토리 인터페이스를 만듭니다.

```java
package io.reflectoring.buckpal.account.adapter.out.persistence;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ActivityRepository extends JpaRepository<ActivityJpaEntity, Long> {

	@Query("select a from ActivityJpaEntity a " +
			"where a.ownerAccountId = :ownerAccountId " +
			"and a.timestamp >= :since")
	List<ActivityJpaEntity> findByOwnerSince(
			@Param("ownerAccountId") Long ownerAccountId,
			@Param("since") LocalDateTime since);

	@Query("select sum(a.amount) from ActivityJpaEntity a " +
			"where a.targetAccountId = :accountId " +
			"and a.ownerAccountId = :accountId " +
			"and a.timestamp < :until")
	Long getDepositBalanceUntil(
			@Param("accountId") Long accountId,
			@Param("until") LocalDateTime until);

	@Query("select sum(a.amount) from ActivityJpaEntity a " +
			"where a.sourceAccountId = :accountId " +
			"and a.ownerAccountId = :accountId " +
			"and a.timestamp < :until")
	Long getWithdrawalBalanceUntil(
			@Param("accountId") Long accountId,
			@Param("until") LocalDateTime until);

}
```

스프링 부트는 이 리포지토리를 자동으로 찾고, 스프링 데이터는 실제로 데이터베이스와 통신하는 리포지토리 인터페이스의 구현체를 제공합니다.

이제 이 리포지토리들을 사용해 `LoadAccountPort`와 `UpdateAccountStatePort`를 구현하는 영속성 어댑터를 작성합니다.

```java
package io.reflectoring.buckpal.account.adapter.out.persistence;

import javax.persistence.EntityNotFoundException;

import java.time.LocalDateTime;
import java.util.List;

import io.reflectoring.buckpal.account.application.port.out.LoadAccountPort;
import io.reflectoring.buckpal.account.application.port.out.UpdateAccountStatePort;
import io.reflectoring.buckpal.account.domain.Account;
import io.reflectoring.buckpal.account.domain.Account.AccountId;
import io.reflectoring.buckpal.account.domain.Activity;
import io.reflectoring.buckpal.common.PersistenceAdapter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@PersistenceAdapter
class AccountPersistenceAdapter implements
		LoadAccountPort,
		UpdateAccountStatePort {

	private final SpringDataAccountRepository accountRepository;
	private final ActivityRepository activityRepository;
	private final AccountMapper accountMapper;

	@Override
	public Account loadAccount(
					AccountId accountId,
					LocalDateTime baselineDate) {

		AccountJpaEntity account =
				accountRepository.findById(accountId.getValue())
						.orElseThrow(EntityNotFoundException::new);

		List<ActivityJpaEntity> activities =
				activityRepository.findByOwnerSince(
						accountId.getValue(),
						baselineDate);

		Long withdrawalBalance = orZero(activityRepository
				.getWithdrawalBalanceUntil(
						accountId.getValue(),
						baselineDate));

		Long depositBalance = orZero(activityRepository
				.getDepositBalanceUntil(
						accountId.getValue(),
						baselineDate));

		return accountMapper.mapToDomainEntity(
				account,
				activities,
				withdrawalBalance,
				depositBalance);

	}

	private Long orZero(Long value){
		return value == null ? 0L : value;
	}

	@Override
	public void updateActivities(Account account) {
		for (Activity activity : account.getActivityWindow().getActivities()) {
			if (activity.getId() == null) {
				activityRepository.save(accountMapper.mapToJpaEntity(activity));
			}
		}
	}

}
```

`loadAccount()`는 계좌와 기준일 이후의 활동, 기준일 전까지의 출금·입금 합계를 조회한 뒤 `AccountMapper`로 도메인 엔티티를 만들어 반환합니다. `updateActivities()`는 활동 중 ID가 없는 새 활동만 JPA 엔티티로 매핑해 저장합니다.

## 데이터베이스 트랜잭션은 어떻게 해야 할까?

다음으로 트랜잭션 경계를 어디에 두어야 하는지 살펴보겠습니다.

영속성 어댑터는 어떤 데이터베이스 연산이 같은 유스케이스에 포함되는지 알지 못하기 때문에, 언제 트랜잭션을 열고 닫을지 결정할 수 없습니다. 따라서 이 책임은 영속성 어댑터 **호출을 관장하는 서비스에 위임**해야 합니다.

![SendMoneyService가 트랜잭션을 열고 LoadAccountPort와 UpdateAccountStatePort를 차례로 호출한 뒤 커밋하는 흐름](images/07_transaction-boundary.svg)

서비스에 `@Transactional`을 붙이면 아래와 같습니다.

```java
@Transactional
public class SendMoneyService implements SendMoneyUseCase {
	...
}
```

서비스가 `@Transactional` 애너테이션 없이 깔끔하게 유지되길 원한다면, AspectJ 같은 도구를 이용해 관점 지향 프로그래밍으로 트랜잭션 경계를 코드에 위빙할 수도 있습니다.

## 유지보수 가능한 소프트웨어를 만드는 데 어떻게 도움이 될까?

도메인 코드에 플러그인처럼 동작하는 영속성 어댑터를 만들면 도메인 코드가 영속성과 관련된 것들로부터 분리되어 풍부한 도메인 모델을 만들 수 있습니다.

좁은 포트 인터페이스를 사용하면 포트마다 다른 방식으로 구현할 수 있는 유연함이 생깁니다. 심지어 포트 뒤에서 애플리케이션이 모르게 다른 영속성 기술을 사용할 수도 있습니다. 포트의 명세만 지켜진다면 영속성 계층 전체를 교체할 수도 있습니다.

## 마무리

오늘은 영속성 어댑터의 책임과 포트 인터페이스·영속성 어댑터를 나누는 방법, 스프링 데이터 JPA로 구현한 영속성 어댑터, 그리고 트랜잭션 경계를 서비스에 두는 이유에 대해 정리하였습니다. 하나의 리포지토리에 모든 연산을 모아 두던 방식 대신, 서비스가 필요한 메서드만 가진 좁은 포트에 의존하도록 나누는 점이 기억에 남았습니다. 다음 글에서는 [경계 간 매핑하기](../clean-arch-08-boundary-mapping/)에 대해 정리하도록 하겠습니다.

참조 : [만들면서 배우는 클린 아키텍처 - YES24](http://www.yes24.com/Product/Goods/105138479)
