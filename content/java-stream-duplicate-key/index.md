---
title: "Collectors.toMap에서 만난 Duplicate Key 예외"
tags: ["Java","Stream","Collectors","toMap","예외 처리"]
summary: "Collectors.toMap()에서 키가 중복될 때 발생하는 Duplicate Key 예외와 Merge Function으로 해결하는 방법을 정리합니다."
---

## 발생 원인

Java 8에서 제공하는 Stream API의 Collectors 클래스의 toMap() 메서드는 Map을 반환합니다.

그러나 이 메서드는 스트림에서 처리하는 요소 중에서 키가 중복되는 경우 Duplicate Key Error를 발생시킵니다.

```java
Map<String, Integer> map = new HashMap<>();
map.put("A", 1);
map.put("B", 2);
map.put("C", 3);
map.put("D", 4);
map.put("D", 5);

// Duplicate key error: java.lang.IllegalStateException: Duplicate key 4
//Map<String, Integer> result = map.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
```

## 해결 방법

이러한 오류가 발생하는 경우에는 toMap() 메서드의 두 번째 매개변수로 Merge Function을 전달하여 해결합니다.

Merge Function은 중복 키가 발생할 때 값을 병합하는 방법을 정의합니다.

아래는 toMap() 메서드에서 Merge Function을 사용하여 중복 키 오류를 해결하는 방법입니다.

```java
Map<String, Integer> result = map.entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (v1, v2) -> v1 + v2));

System.out.println(result); // {A=1, B=2, C=3, D=9}
```

## 후기

오늘은 컬렉션 중에 toMap을 할 때 자주 발생할 수 있는 Duplicate Key Error에 대하여 정리하였습니다. 컬렉션이 맵으로 변경되기 쉬운 만큼 조건을 잘 걸어줘야 하며, 추가로 null도 filter로 걸러주는 게 좀 더 안정적인 방법이지 않을까 싶습니다.
