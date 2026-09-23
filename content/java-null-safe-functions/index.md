---
title: "NPE를 막는 자바 방어 코드 모음"
tags: ["Java","NPE","Stream","방어 코드"]
summary: "NPE를 예방하기 위해 사용했던 null 체크, partition, Function.identity() 방어 코드를 모아 정리합니다."
---

프로젝트를 진행하면서 NPE가 발생할 만한 곳에 방어 코드를 작성할 때가 많이 있었습니다.

이를 해결하기 위해 작성했던 함수들이 있는데, 기억하기 위해 정리합니다.

## Stream Null Check

1. null 자체가 Stream이 되면 NPE가 발생합니다.
2. null일 경우 emptyCollection을 리턴합니다.
3. null일 경우 emptyList를 리턴합니다.

```java
List<Member> members = null;

//error
members.stream().filter(Objects::nonNull).forEach(
							Object -> System.out.println(Object::getUsername));

//ok
CollectionUtils.emptyIfNull(members).stream()
				.filter(("coby").equals(Object::getUsername())).collect(Collectors.toList());

//ok
Optional.ofNullable(members)
        .orElseGet(Collections::emptyList).stream()
        .filter(("coby").equals(Object::getUsername())).collect(Collectors.toList())
```

emptyIfNull 함수는 값이 비어 있을 때 emptyCollection을 리턴하도록 설계되어 있습니다.

```java
// CollectionUtils 클래스
public static <T> Collection<T> emptyIfNull(Collection<T> collection) {
        return collection == null ? emptyCollection() : collection;
    }
```

컬렉션의 값을 체크할 때는 CollectionUtils 클래스를 애용합니다.

```java
// CollectionUtils 클래스
// 널과 함께, 값을 체크한다.
public static boolean isEmpty(Collection coll) {
        return coll == null || coll.isEmpty();
    }

public static boolean isNotEmpty(Collection coll) {
    return !isEmpty(coll);
}
```

## partition 메소드

```java
public List divided(List<Long> memberids) {
        // memberids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        int partitionSize = 4;

        List<List<Long>> partition = Lists.partition(memberids, partitionSize);
        return partition;
    }
 // 결과값 [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15]]
```

partition 메소드는 큰 리스트를 리스트 그룹으로 잘라주는 역할을 합니다.

실무에서 왜 partition을 사용했을까요? 이는 where 절에 조건을 잘라서 넣어주기 위해서입니다. **너무 많은 데이터를 넣어서 작업을 진행하려다 보면, 슬로우 쿼리가 발생할 뿐만 아니라 in 절에 오라클 같은 경우 1,000건으로 제한이 있기 때문입니다.** 이를 해결하기 위해 partition을 사용해서 1,000건 이하로만 끊어서 처리하는 경우가 발생할 수 있습니다.

## Function.identity()로 Map 만들기

Stream을 사용해서 map을 만들 때는 Function.identity() 함수를 사용합니다.

```java
Map<Long, Object> memberMapData = new HashMap<>();
List<Member> members = MemberRepository.getMemberList();

if (CollectionUtils.isNotEmpty(members)) {
	memberMapData = members.stream()
                    .collect(Collectors.toMap(Member::getMemberId, Function.identity()));
}
```

List를 스트림으로 Map으로 변경할 때, key는 id로 받고 해당하는 객체를 그대로 쓰기 위해 Function.identity를 사용합니다.
