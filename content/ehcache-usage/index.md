---
title: "[JAVA] Ehcache 사용방법 (1)"
tags: ["Ehcache","Spring 캐싱","@Cacheable","CacheManager","성능 최적화"]
summary: "Spring Boot에서 Ehcache로 캐시를 설정하고 @Cacheable로 조회 성능을 개선하는 방법을 정리합니다."
---

오늘은 카테고리 작업을 하면서 요청사항으로, 캐시 업데이트 시간을 빠르게 단축해달라는 요청사항을 받았습니다. 캐싱 관련해서 세팅을 해본 적이 따로 없어서 어디서부터 어디까지 작업을 해야 될지 몰랐는데, 배우게 되어 작성하게 되었습니다.

Spring에서 캐싱 작업은 보통 Ehcache를 사용합니다.

사용하는 이유로는 거의 변경되지 않는 DB의 값을 메모리 혹은 디스크에 보관하다가 호출되었을 때 DB를 조회하지 않고 메모리 혹은 디스크에서 조회해서 값을 노출합니다. 이렇게 사용하게 될 시 DB의 부하는 줄일 수 있으며, 조회속도는 올릴 수 있는 장점이 있습니다. 하지만 실시간으로 변경이 안된다는 단점이 있습니다.

```java
<?xml version="1.0" encoding="UTF-8"?>
<ehcache xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="http://ehcache.org/ehcache.xsd"updateCheck="false">

<ehcache xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="http://ehcache.org/ehcache.xsd"
    updateCheck="false">
    
    <diskStore path="java.io.tmpdir" />
    
    <cache name="getCategoryCache"
           maxEntriesLocalHeap="1000"  
           maxEntriesLocalDisk="10000" 
           eternal="false"
           diskSpoolBufferSizeMB="20"
           timeToIdleSeconds="1800" timeToLiveSeconds="1800"
           memoryStoreEvictionPolicy="LFU"
           transactionalMode="off">
           <persistence strategy="localTempSwap" />
    </cache>
</ehcache>
```

| property | desc |  |
| --- | --- | --- |
| maxEntriesLocalHeap | 힙 메모리 양 |  |
| maxEntriesLocalDisk | 로컬디스크에 유지될 최대 객체수 |  |
| eternal | 시간 설정에 대한 무시 설정 |  |
| diskSpoolBufferSizeMB | 디스크 캐시에 쓰기 모드로 들어갈때, 사용될 비동기 모드 스풀 버퍼 크기 설정 , OutOfMemory 에러가 발생 시 수치를 낮추도록 합니다. |  |
| timeToIdleSeconds | 다음 시간 동안 유휴상태(Idle) 후 갱신할지 설정 |  |
| timeToLiveSeconds | 다음 갱신 하기 까지 캐시가 유지 되는 시간 (0이면 만료시간을 지정하지 않는다고 보고 유지 되지 않음, default: 0) |  |
| memoryStoreEvictionPolicy | 객체의 갯수가 설정된 maxElementsInMemory에 도달 했을 경우 메모리에서 객체들을 어떻게 제거 할지 에 대한 제거 알고리즘 | FIFO:First In First Out
LFU Least Frequently Used.
LRU Least Recently Used. |
| transactionalMode | copyOnRead , copyOnWrite 시 트랜잭션 모드를 설정 |  |

**사용방법**

Spring Boot에서 Ehcache를 사용하기 위해서는 @EnableCaching을 @Configuration에 추가합니다.

```java
@Configuration
@EnableCaching
public class CacheConfiguration {

    @Bean
    public CacheManager cacheManager() {
        EhCacheManagerFactoryBean cacheManagerFactoryBean = new EhCacheManagerFactoryBean();
        // ehcache 설정 정보를 담은 xml 위치
				cacheManagerFactoryBean.setConfigLocation(new ClassPathResource("ehcache.xml"));
        // cachemanager의 싱글톤 여부를 지정하는 값으로 true로 설정시 만약 기존 cachemanager가 존재하지 않을 경우 새로 생성
				cacheManagerFactoryBean.setShared(true);

        return cacheManagerFactoryBean;
    }

		@Bean
		EhCacheCacheManager ehCacheCacheManager(EhCacheManagerFactoryBean ehCacheManagerFactoryBean) {
			EhCacheCacheManager ehCacheCacheManager = new EhCacheCacheManager();
			ehCacheCacheManager.setCacheManager(ehCacheManagerFactoryBean.getObject());
			return ehCacheCacheManager;
		}
}
```

cacheManager를 커스터마이징 하고 싶다면 아래와 같이 **CacheManagerCustomizer**의 인터페이스를 상속해서 구현한 다음 Bean 으로 등록합니다.

```java
@Component
public class CustomCacheManger implements CacheManagerCustomizer<ConcurrentMapCacheManager> {

    @Override
    public void customize(ConcurrentMapCacheManager cacheManager) {
        cacheManager.setAllowNullValues(false);

    }
}
```

사용할 Service에 `@Cacheable` 추가합니다.

```java
@Cacheable(value="getCategoryCache", key="#using")
    public List<Category> getCategories(Using using) {
		...
		return;
}
```

`@Cacheable(cacheNames = "getCategoryCache", key = "#using")`

- `ehcache.xml`에서 지정한 `getCategoryCache` 캐시를 사용합니다.
- `key`는 메서드 argument인 `using`을 사용하겠다는 의미입니다.
- using에 따라 별도로 캐시됩니다.
- `getCategoryCache`는 메서드의 argument에 따라 캐시되기 때문에 `using`의 캐시 여부를 체크합니다.
- 캐시가 있으면 내용을 전달하고, 없으면 캐시를 진행합니다.

참고 : [https://kimyhcj.tistory.com/253](https://kimyhcj.tistory.com/253)

참고 : [https://ifuwanna.tistory.com/222](https://ifuwanna.tistory.com/222)
