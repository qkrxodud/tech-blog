---
title: "Stream을 활용한 예제 모음"
tags: ["Java","Stream","컬렉션","함수형 프로그래밍","리팩터링"]
summary: "for문 대신 자바 Stream을 활용해 리스트·맵 변환, 중복 체크, null 처리, reduce 등을 정리한 예제 모음입니다."
---

자바를 다시 사용하면서 for문에 너무 익숙해져 있다는 것을 느꼈습니다. Stream 사용 예제를 적어두고 활용하도록 노력하려고 합니다.

## stream을 사용해서 List<List<Integer>> → List<Lotto> 로 변경

```java
// 변경 전
public static Lottos fromManualLottos(List<List<Integer>>  manualLottos) {
        List<Lotto> lottos = new ArrayList<>();
        for (int i = 0; i < manualLottos.size(); i++) {
            lottos.add(Lotto.fromManualLotto(new LottoPolicyStrategy(), manualLottos.get(i)));
        }
        return new Lottos(lottos);
}

// 변경 후
public static Lottos fromManualLottos(ManualLottoParam manualLotto) {
    List<Lotto> lottos = manualLotto.getManualLottos()
            .stream()
            .map(numbers -> Lotto.fromManualLotto(new LottoPolicyStrategy(), numbers.getLottoNumbers()))
            .collect(Collectors.toList());

    return new Lottos(lottos);
}
```

## stream을 사용해서 List를 Map으로 변경

```java
private Map<Integer, Integer> convertLottoNumbersToMap(Lotto winningLotto) {
    return winningLotto.getNumbers()
            .stream()
            .collect(Collectors.toMap(LottoNumber::getNumber, LottoNumber::getNumber));
}
```

Duplicate Key Error를 방지하기 위해 `Function.identity()` 함수를 사용합니다.

```java
Map<Long, Object> memberMapData = new HashMap<>();
List<Member> members = MemberRepository.getMemberList();

if (CollectionUtils.isNotEmpty(members)) {
	memberMapData = members.stream()
                    .collect(Collectors.toMap(Member::getMemberId, Function.identity()));
}
```

List를 스트림을 사용해 Map으로 변경할 때, key는 id로 받고 해당하는 객체를 그대로 사용하기 위해 Function.identity를 사용합니다.

## stream을 사용해서 enum 값 찾기

```java
return Arrays.stream(values())
                .filter(value -> rank == value.rank)
                .findFirst()
                .orElse(WinningAmountByRank.EMPTY);
```

## stream을 사용해서 list 값 합치기

```java
public double calculatorProfit(Lottos lottos, int purchaseAmount) {
    double sum = lottos.getLottos()
            .stream()
            .mapToInt(lotto -> WinningAmountByRank.from(getWinningResult(lotto)).getAmount()).sum();

    return sum / purchaseAmount;
}
```

## stream을 사용해 중복값 체크

```java
if(manualLottoNumbers.size() != manualLottoNumbers.stream()
        .distinct()
        .count()){
    throw new IllegalArgumentException("중복 값이 있습니다.");
}
```

## stream의 null check

1. Null 자체가 Stream이 되면 NPE가 발생합니다.
2. Null인 경우 emptyCollection을 리턴합니다.
3. Null인 경우 emptyList를 리턴합니다.

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

emptyIfNull 함수는 빈 값일 때 emptyCollection을 리턴하도록 설계되어 있습니다.

```java
// CollectionUtils 클래스
public static <T> Collection<T> emptyIfNull(Collection<T> collection) {
        return collection == null ? emptyCollection() : collection;
    }
```

컬렉션의 값을 체크할 때는 CollectionUtils 클래스를 애용하는 것이 좋습니다.

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

## stream으로 List 값을 String으로 합치기

```java
String victoryMessage = winners.stream().map(n -> String.valueOf(n.getName()))
                .collect(Collectors.joining(", "));
```

## reduce 사용법

List에 담긴 모든 숫자의 합을 구합니다.

```java
// nextstep.fp.StreamStudy 클래스의 sumAll method 참고

List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);

public int sumAll(List<Integer> numbers) {
    return numbers.stream().reduce(0, (x, y) -> x + y);
}
```

reduce를 잘 설명한 블로그가 있어 참조를 남겨둡니다.

[Java - Stream.reduce() 사용 방법 및 예제](https://codechacha.com/ko/java8-stream-reduction/#4-병렬-처리에서-reduce는-순차적으로-처리)
