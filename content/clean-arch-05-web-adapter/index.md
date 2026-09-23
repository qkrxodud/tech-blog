---
title: "[만들면서 배우는 클린 아키텍처] 웹 어댑터 구현하기"
tags: ["클린 아키텍처","육각형 아키텍처","의존성 역전","컨트롤러 분리"]
summary: "웹 어댑터의 책임과 역할을 정리하고, 하나의 컨트롤러에 여러 연산을 몰아넣기보다 연산별로 작은 컨트롤러를 나누는 방식의 장점을 설명합니다."
---

### **의존성 역전**

애플리케이션 계층은 웹 어댑터가 통신할 수 있는 특정 포트를 제공합니다. 서비스는 이 포트를 구현하고, 웹 어댑터는 이 포트를 호출할 수 있습니다.

자세히 살피면 **의존성 역전 원칙**이 적용된 것을 발견할 수 있습니다.

> 💡 그럼 왜 어댑터와 유스케이스 사이에 또 다른 간접 계층을 넣어야 할까요?
> **`애플리케이션 코어가 외부 세계와 통신할 수 있는 곳에 대한 명세가 포트이기 때문입니다.`** 포트를 적절한 곳에 위치시키면 외부와 어떤 통신이 일어나고 있는지 정확히 알 수 있고, 이는 레거시 코드를 다루는 유지보수 엔지니어에게는 무척 소중한 정보입니다.

### **웹 어댑터의 책임**

웹 어댑터의 책임은 어디서부터 어디까지일까요?

웹 어댑터는 일반적으로 다음과 같은 일을 합니다.

1. HTTP 요청을 자바 객체로 매핑
2. 권한 검사
3. 입력 유효성 검증
4. 입력을 유스케이스의 입력 모델로 매핑
5. 유스케이스 호출
6. 유스케이스의 출력을 HTTP로 매핑
7. HTTP 응답을 반환

우선 웹 어댑터는 URL, 경로, HTTP 메서드, 콘텐츠 타입과 같이 특정 기준을 만족하는 HTTP 요청을 수신해야 합니다. 그러고 나서 HTTP 요청의 파라미터와 콘텐츠를 객체로 역직렬화해야 합니다.

웹 어댑터의 입력 모델을 유스케이스의 입력 모델로 변환할 수 있다는 것을 검증해야 합니다. 이 변환을 방해하는 모든 것이 유효성 검증 에러입니다. 이는 자연스럽게 웹 어댑터의 다음 책임, 즉 변환된 입력 모델로 특정한 유스케이스를 호출하는 것으로 연결됩니다.

이 과정에서 한 군데서라도 문제가 생기면 예외를 던지고, 웹 어댑터는 에러를 호출자에게 보여줄 메시지로 변환해야 합니다.

> 💡 **`HTTP와 관련된 것은 애플리케이션 계층으로 침투해서는 안 됩니다.`** 우리가 바깥 계층에서 HTTP를 다루고 있다는 것을 애플리케이션 코어가 알게 되면 HTTP를 사용하지 않는 또 다른 인커밍 어댑터의 요청에 대해 동일한 도메인 로직을 수행할 수 있는 선택지를 잃게 됩니다.

특정 인커밍 어댑터를 생각할 필요 없이 유스케이스를 먼저 구현하면 경계를 흐리게 만들 유혹에 빠지지 않을 수 있습니다.

### **컨트롤러 나누기**

```java
@RestController
@RequiredArgsConstructor
class AccountController {
	private final GetAccountBalanceQuery getAccountBalanceQuery;
	private final ListAccountsQuery listAccountsQuery;
	private final LoadAccountQuery loadAccountQuery;

	private final SendMoneyUseCase sendMoneyUseCase;
	private final CreateAccountUseCase createAccountUseCase;

	@GetMapping("/accounts")
	List<AccountResource> listAccounts() {
		...
	}

	@GetMapping("/accounts/{accountId}")
	AccountResource getAccount(@PathVariable("accountId") Long accountId) {
		...
	}

	@GetMapping("/accounts/{accouintId}/balance")
	long getAccountBalance(@PathVariable("accountId") Long accountId) {
		...
	}
	...
}
```

계좌 리소스와 관련된 모든 것이 하나의 클래스에 모여 있으며 괜찮아 보입니다. 하지만 이 방식의 단점을 한번 살펴보겠습니다.

1. 가장 큰 클래스가 30,000줄이라고 하면, 시간이 지나면서 컨트롤러에 200줄만 늘어나도 50줄을 파악하는 것에 비해 난이도가 높아집니다.
2. 컨트롤러에 코드가 많으면 그에 해당하는 테스트 코드도 많을 것입니다. 특정 프로덕션 코드에 해당하는 테스트 코드를 찾기 어렵습니다.
3. 모든 연산을 하나의 컨트롤러에 넣는 것이 데이터 구조의 재활용을 촉진합니다. 앞의 예제 코드에서 많은 연산들이 AccountResource 모델 클래스를 공유합니다. 아마 AccountResource에는 id 필드가 있을 것입니다. 그렇지만 id는 create 연산에서는 필요 없기 때문에 도움이 되기보다는 헷갈릴 수 있습니다.

그래서 각 연산에 대해 가급적이면 별도의 패키지 안에 별도의 컨트롤러를 만드는 방식을 선호합니다.

```java
package io.reflectoring.buckpal.account.adapter.in.web;

import io.reflectoring.buckpal.account.application.port.in.SendMoneyUseCase;
import io.reflectoring.buckpal.account.application.port.in.SendMoneyCommand;
import io.reflectoring.buckpal.common.WebAdapter;
import io.reflectoring.buckpal.account.domain.Account.AccountId;
import io.reflectoring.buckpal.account.domain.Money;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@WebAdapter
@RestController
@RequiredArgsConstructor
class SendMoneyController {

	private final SendMoneyUseCase sendMoneyUseCase;

	@PostMapping(path = "/accounts/send/{sourceAccountId}/{targetAccountId}/{amount}")
	void sendMoney(
			@PathVariable("sourceAccountId") Long sourceAccountId,
			@PathVariable("targetAccountId") Long targetAccountId,
			@PathVariable("amount") Long amount) {

		SendMoneyCommand command = new SendMoneyCommand(
				new AccountId(sourceAccountId),
				new AccountId(targetAccountId),
				Money.of(amount));

		sendMoneyUseCase.sendMoney(command);
	}

}
```

각 컨트롤러가 CreateAccountResource나 UpdateAccountResource 같은 컨트롤러 자체의 모델을 가지고 있거나, 앞의 예제 코드처럼 원시값을 받아도 됩니다.

이러한 전용 모델 클래스들은 컨트롤러의 패키지에 대해 private으로 선언할 수 있기 때문에 실수로 다른 곳에서 재사용될 일이 없습니다.

또, 컨트롤러명과 서비스명에 대해서도 잘 생각해봐야 합니다. 예를 들어, CreateAccount보다는 RegisterAccount가 더 나은 이름 같지 않은가요?

이렇게 나누는 스타일의 또 다른 장점은 서로 다른 연산에 대해 동시 작업이 쉬워진다는 것입니다. 두 명의 개발자가 서로 다른 연산에 대한 코드를 짜고 있다면 병합 충돌이 일어나지 않을 것입니다.

### **유지보수 가능한 소프트웨어를 만드는 데 어떻게 도움이 될까?**

웹 컨트롤러를 나눌 때는 모델을 공유하지 않는 여러 작은 클래스들을 만드는 것을 두려워해서는 안 됩니다. 작은 클래스들은 더 파악하기 쉽고, 더 테스트하기 쉬우며, 동시 작업을 지원합니다.

### **리뷰**

오늘 어댑터와 포트, 그리고 컨트롤러의 사용법에 대해 읽었습니다. 어댑터와 서비스 사이의 포트 계층을 넣어 유지보수하는 사람들이 외부와 어떤 데이터를 주고받는지 한눈에 볼 수 있게 만들고, 또한 적절한 유효성 검증을 통해 애플리케이션 코어의 접근을 막는 것도 중요하다는 것을 알 수 있었습니다. 그리고 컨트롤러를 작은 클래스로 만드는 것을 두려워하면 안 된다는 것도 알 수 있었습니다. 테스트 코드와 유지보수 측면에서 큰 장점이 있습니다. 책을 다 읽고 빨리 코드를 작성해 보고 싶다는 생각이 듭니다.

04 [만들면서 배우는 클린 아키텍처] 유스케이스 구현하기

06 [만들면서 배우는 클린 아키텍처] 영속성 어댑터 구현하기

[만들면서 배우는 클린 아키텍처 - YES24](http://www.yes24.com/Product/Goods/105138479)
