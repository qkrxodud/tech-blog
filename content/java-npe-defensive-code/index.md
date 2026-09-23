---
title: "이미지 다운로드에서 터진 NPE와 방어 코드"
tags: ["Java","NullPointerException","방어 코드","예외 처리","로깅"]
summary: "프록시 서버를 거쳐 이미지를 받아오는 코드에서 방어 코드와 예외 처리가 부실해 발생한 NPE를 해결한 과정을 정리합니다."
---

## 문제 상황

개발 서버에서 이미지를 직접 받을 수 없어서, 이미지를 프록시 서버에서 먼저 받은 후 개발 서버에서 프록시 서버의 이미지를 다시 받는 구조였습니다. 이 과정에서 방어 코드와 try-catch가 잘못되어 계속 에러가 발생했고, 이를 해결하려면 방금 언급한 방어 코드와 `try-catch`를 제대로 작성해야 했습니다.

그리고 작업을 하면서 한 가지 더 확인한 것은 로그를 잘 작성해야 한다는 점입니다. 에러가 발생했지만 잘못된 try-catch 때문에 어느 부분에서 문제가 발생하는지 찾기가 어려웠습니다.

```java
try {
	ResponseEntity<Resource> responseEntity = new RestTemplate(new SimpleClientHttpRequestFactory()).exchange(uri, HttpMethod.GET, null, Resource.class);
	InputStream in = responseEntity.getBody().getInputStream();
	fileBytes = IOUtils.toByteArray(in);
} catch (RestClientException re| IOException io) {
	log.error("fail. tracking info {}", new InternalLogger(CrudType.READ, uri.getPath(), rce))
}

```

## 원인 분석

1) `responseEntity.getBody()`를 호출할 때 값이 있는지 체크해야 합니다. 무조건 있다고 생각한 순간, 없는 파일의 `getBody()`를 가져오게 되기 때문입니다.

2) `catch`에서 `re`, `io` 예외는 잘 잡았지만 `RuntimeException`은 잡지 않았기 때문에, 값이 null로 왔을 때 `RuntimeException`이 발생하면서 로그에 찍히지 않고 예외만 발생했습니다.

큰 문제점 두 가지가 있었고, 해결 방법은 1) 방어 코드 추가, 2) catch 추가였습니다.

```java
try {
    ResponseEntity<Resource> responseEntity = new RestTemplate(new SimpleClientHttpRequestFactory()).exchange(uri, HttpMethod.GET, null, Resource.class);
    if (Objects.isNull(responseEntity.getBody())) {
        return new byte[0];
    }
    InputStream in = responseEntity.getBody().getInputStream();
    fileBytes = IOUtils.toByteArray(in);
} catch(RestClientException | IOException rce) {
	log.error("fail. tracking info {}", new restLogger(DataType.READ, uri.getPath(), rce));
} catch (RuntimeException runtimeException) {
	log.error("fail. tracking info {}", new restLogger(DataType.READ, uri.getPath(), runtimeException));
}
```

## 배운 점

여기서 배워야 할 점은, `RestClientException`과 `IOException` 같은 경우 `restLogger` 객체를 생성해서 안에 명시해주고 `toString`을 적어, 어떤 로그가 발생하는지 명확하게 해줬다는 점입니다. 물론 오류도 중요하지만, 정확하게 명시하는 로그는 나중에 큰 도움이 될 것으로 판단됩니다.
