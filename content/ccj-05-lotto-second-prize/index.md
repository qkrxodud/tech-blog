---
title: "로또 게임 2등 — 3단계"
tags: ["클린 코드","Java","enum","일급 컬렉션","TDD","리팩터링"]
summary: "로또 2등 당첨 로직을 enum과 일급 컬렉션으로 구현하고 싱글톤, 스트림 리팩토링을 반영한 기록입니다."
---

## 로또 게임(2등)

### 기능 요구사항

- 2등을 위해 추가 번호를 하나 더 추첨합니다.
- 당첨 통계에 2등도 추가해야 합니다.

```java
[... 생략 ...]

지난 주 당첨 번호를 입력해 주세요.
1, 2, 3, 4, 5, 6
보너스 볼을 입력해 주세요.
7

당첨 통계
---------
3개 일치 (5000원)- 1개
4개 일치 (50000원)- 0개
5개 일치 (1500000원)- 0개
5개 일치, 보너스 볼 일치(30000000원) - 0개
6개 일치 (2000000000원)- 0개
총 수익률은 0.35입니다.(기준이 1이기 때문에 결과적으로 손해라는 의미임)
```

### 프로그래밍 요구사항

- 모든 기능을 TDD로 구현해 단위 테스트가 존재해야 합니다. 단, UI(System.out, System.in) 로직은 제외합니다.
- **java enum을 적용해 프로그래밍을 구현합니다.**
- **규칙 8: 일급 콜렉션을 씁니다.**
- indent(인덴트, 들여쓰기) depth를 2를 넘지 않도록 구현합니다. 1까지만 허용합니다.
- 함수(또는 메소드)의 길이가 15라인을 넘어가지 않도록 구현합니다.
- 자바 코드 컨벤션을 지키면서 프로그래밍합니다.
- else 예약어를 쓰지 않습니다.

### 힌트

- 일급 콜렉션을 씁니다.
    - 6개의 숫자 값을 가지는 java collection을 감싸는 객체를 추가해 구현해 봅니다.
- 하드 코딩을 하지 않기 위해 상수 값을 사용하면 많은 상수 값이 발생합니다. 자바의 enum을 활용해 상수 값을 제거합니다. 즉, enum을 활용해 일치하는 수를 로또 등수로 변경해 봅니다.

### 기능 목록 및 commit 로그 요구사항

- 기능을 구현하기 전에 README.md 파일에 구현할 기능 목록을 정리해 추가합니다.
- git의 commit 단위는 앞 단계에서 README.md 파일에 정리한 기능 목록 단위로 추가합니다.

## 피드백

리뷰어: 이 enum에서만 관리하면 되므로, enum에서 해당 필드를 public하게 노출시키고 여기 이 추출들은 제거하는 것이 조금 더 자연스러운 구현인 듯합니다.

생각정리: enum에서 표현해 주었는데, 내부에서 굳이 필드를 `WinningAmountByRank`로는 줄 필요가 없을 것 같습니다.

```java
public enum WinningAmountByRank {
    FIRST(WinningAmountByRank.FIRST_PLACE, 2000000000, "FIRST_PLACE"),
    SECOND(WinningAmountByRank.SECOND_PLACE, 1500000, "SECOND_PLACE"),
    THIRD(WinningAmountByRank.THIRD_PLACE, 50000, "THIRD_PLACE"),
    FOURTH(WinningAmountByRank.FOURTH_PLACE, 5000, "FOURTH_PLACE"),
    EMPTY(WinningAmountByRank.EMPTY_PLACE, 0, "EMPTY_PLACE");

    public static final int FIRST_PLACE = 6;
    public static final int SECOND_PLACE = 5;
    public static final int THIRD_PLACE = 4;
    public static final int FOURTH_PLACE = 3;
    public static final int EMPTY_PLACE = 0;
```

다음과 같이 변경합니다.

```java
public enum WinningAmountByRank {
    FIRST(6, 2000000000, "FIRST_PLACE"),
    BONUS(37, 30000000, "BONUS_PLACE"),
    SECOND(5, 1500000, "SECOND_PLACE"),
    THIRD(4, 50000, "THIRD_PLACE"),
    FOURTH(3, 5000, "FOURTH_PLACE"),
    EMPTY(0, 0, "EMPTY_PLACE");

    private final int rank;
    private final int amount;
    private final String key;
```

리뷰어: `LottoService`에서 또 의견을 드리겠지만, 서비스 객체가 파라메터에 따라 생성되는 것이 조금 신기하고 어색하게 느껴집니다. 생성자로 `lottoCount`가 넘어가야 할 이유가 있으려나요?

생각정리: 서비스 객체를 생성자를 써서 필드를 남길 필요가 없었는데, 싱글톤 패턴이라고 생각했을 때 Thread safe에 맞지 않을 것 같았습니다.

```java
public class LottoService {
    private Lottos lottos;

    public LottoService(int lottoCount) {
        this.lottos = new Lottos(lottoCount);
    }
```

다음과 같이 싱글톤을 적용해 변경합니다.

```java
public class LottoService {
    // singleton 적용
    private static LottoService lottoService = null;

    public static LottoService createLottoService() {
        if (Objects.isNull(lottoService)) {
            return new LottoService();
        }
        return lottoService;
    }
```

리뷰어: 스트림 기반으로 개선해 보시면 좋겠네요!

생각정리: 스트림 안에서 너무 많은 기능을 첨부하는 소스코드를 보았습니다. 복잡해서 거부감이 있었는데, 하나의 기능에 집중하는 스트림을 사용한다면 충분히 가독성 면에서도 좋다고 생각됩니다.

```java
public void calculatorProfit() {
        double winningAmount = 0;
        for (Lotto lotto : lottos.getLottos()) {
            int winningCount = getWinningResult(lotto);
            WinningAmountByRank from = WinningAmountByRank.from(winningCount);
            winningResult.put(from.getKey(), winningResult.getOrDefault(from.getKey(), 0) + 1);
            winningAmount += from.getAmount();
        }
        profit = winningAmount / purchaseAmount;
    }
```

다음과 같이 변경합니다.

```java
public double calculatorProfit(Lottos lottos, int purchaseAmount) {
        double sum = lottos.getLottos()
                .stream()
                .mapToInt(lotto -> WinningAmountByRank.from(getWinningResult(lotto)).getAmount()).sum();

        return sum / purchaseAmount;
    }
```

## 후기

오늘은 로또 3단계 로또 게임 2등을 진행했습니다. 서비스 객체로 생각했을 때, 필드값을 지정해 준다면 과연 thread safe에 안전한가에 대해서 다시 한번 생각할 수 있는 기회였습니다. 테스트 코드도 객체를 완성할 때마다 작성할 수 있도록 구현해 보겠습니다!

깃허브링크: [https://github.com/next-step/java-lotto/pull/3055](https://github.com/next-step/java-lotto/pull/3055)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
