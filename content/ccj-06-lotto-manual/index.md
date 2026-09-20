---
title: "로또 수동 — 4단계"
tags: ["클린 코드", "Java", "일급 컬렉션", "값 객체", "TDD", "예외 처리"]
summary: "로또 수동 구매 기능을 값 객체와 일급 컬렉션으로 설계하고 리뷰를 반영해 구조를 리팩토링한 기록입니다."
---

## 로또 수동

### 기능 요구사항

- 현재 로또 생성기는 자동 생성 기능만 제공합니다. 사용자가 수동으로 추첨 번호를 입력할 수 있도록 해야 합니다.
- 입력한 금액, 자동 생성 숫자, 수동 생성 번호를 입력하도록 해야 합니다.

```java
구입금액을 입력해 주세요.
14000

수동으로 구매할 로또 수를 입력해 주세요.
3

수동으로 구매할 번호를 입력해 주세요.
8, 21, 23, 41, 42, 43
3, 5, 11, 16, 32, 38
7, 11, 16, 35, 36, 44

수동으로 3장, 자동으로 11개를 구매했습니다.
[8, 21, 23, 41, 42, 43]
[3, 5, 11, 16, 32, 38]
[7, 11, 16, 35, 36, 44]
[1, 8, 11, 31, 41, 42]
[13, 14, 16, 38, 42, 45]
[7, 11, 30, 40, 42, 43]
[2, 13, 22, 32, 38, 45]
[23, 25, 33, 36, 39, 41]
[1, 3, 5, 14, 22, 45]
[5, 9, 38, 41, 43, 44]
[2, 8, 9, 18, 19, 21]
[13, 14, 18, 21, 23, 35]
[17, 21, 29, 37, 42, 45]
[3, 8, 27, 30, 35, 44]

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

- **규칙 3: 모든 원시값과 문자열을 포장합니다.**
- **규칙 5: 줄여 쓰지 않습니다(축약 금지).**
- **예외 처리를 통해 에러가 발생하지 않도록 합니다.**
- 모든 기능을 TDD로 구현해 단위 테스트가 존재해야 합니다. 단, UI(System.out, System.in) 로직은 제외합니다.
- java enum을 적용해 프로그래밍을 구현합니다.
- 규칙 8: 일급 콜렉션을 씁니다.
- indent(인덴트, 들여쓰기) depth를 2를 넘지 않도록 구현합니다. 1까지만 허용합니다.
- 함수(또는 메소드)의 길이가 15라인을 넘어가지 않도록 구현합니다.
- 자바 코드 컨벤션을 지키면서 프로그래밍합니다.
- else 예약어를 쓰지 않습니다.

### 힌트

- 규칙 3: 모든 원시값과 문자열을 포장합니다.
    - 로또 숫자 하나는 int 타입입니다. 이 숫자 하나를 추상화한 LottoNo 객체를 추가해 구현합니다.
- 예외 처리를 통해 에러가 발생하지 않도록 합니다.
    - 사용자가 잘못된 값을 입력했을 때 java exception으로 에러 처리를 합니다.
    - java8에 추가된 Optional을 적용해 NullPointerException이 발생하지 않도록 합니다.

### 기능 목록 및 commit 로그 요구사항

- 기능을 구현하기 전에 README.md 파일에 구현할 기능 목록을 정리해 추가합니다.
- git의 commit 단위는 앞 단계에서 README.md 파일에 정리한 기능 목록 단위로 추가합니다.

## 피드백

리뷰어:
- 입력되는 로또 번호에 대해 일급 콜렉션 객체를 설계해서, 2차원 배열 형태의 리스트 사용을 없애 보시면 좋겠습니다.

생각정리:
- 입력받은 값에 대해서 잠시 저장해두고, 결국에는 일급 컬렉션으로 변경해서 서비스로 진행되는데, 이 부분도 변경하는 게 좋을지 고민이 되었습니다.
- 고민이 된 이유
    - 만들게 되면 파라미터 객체가 만들어진다고 생각되는데, 전부 변경이 돼야 되는 것인지 궁금했습니다. (지금까지 입력받은 값들은 일반 컬렉션과, 일반 변수로 입력을 받아서 컨트롤러에서 변경되는 구조입니다.)
    - input 객체에서 도메인 객체를 사용하는 건 좋지 않다고 생각이 들었습니다.

    ```java
    List<List<Integer>> lists = InputView.askManualLottoNumbers(manualLottoCount);
    Lottos manualLotto = lottoService.createManualLotto(lists);
    OutputView.outPutLottos(manualLotto);
    ```

리뷰어:
- 모두 변경하시면 됩니다.
- 도메인 객체를 사용하는 게 당연히 좋진 않은데요, 그렇다면 view에서도 이런 구조를 갖는 일급 콜렉션 객체를 따로 만드시면 해결된다고 생각하기는 합니다.

```java
public static List<List<Integer>> askManualLottoNumbers(int manualLottoCount) {
        System.out.println("수동으로 구매할 번호를 입력해 주세요.");
        newLineRemove();
        List<List<Integer>> manualLottos = new ArrayList<>();
        for (int i = 0 ; i <manualLottoCount; i++) {
            manualLottos.add(createManualLotto());
        }
        return manualLottos;
    }
```

다음과 같이 변경합니다.

```java
public static ManualLottoParam askManualLotto(int manualLottoCount) {
        System.out.println("수동으로 구매할 번호를 입력해 주세요.");
        newLineRemove();
        List<ManualLottoNumbersParam> manualLotto = new ArrayList<>();
        for (int i = 0 ; i <manualLottoCount; i++) {
            manualLotto.add(createManualLottoNumbers());
        }
        return ManualLottoParam.from(manualLotto);
    }
```

리뷰어: 이 메소드보단 (구입해야 할 총 장수, 입력받은 매뉴얼 로또 입력 값 리스트) 파라메터를 갖는 메소드가 나오면 조금 더 좋을 것 같습니다.

생각정리: 두 개의 메소드를 분리해서 구현한 다음 합치면 관리하는 측면에서 좀 더 수정하기 용이하다고 생각했는데, 수동 로또를 구현하고 자동 로또를 구현하면서 합치는 게 좀 더 자연스러운 것 같았습니다.

```java
public Lottos combineLotto(Lottos autoLottos, Lottos manualLottos) {
        autoLottos.combineLottos(manualLottos);
        return autoLottos;
    }
```

다음과 같이 변경합니다.

```java
public Lottos createAutoLottos(int count, Lottos manualLotto) {
        Lottos from = Lottos.from(count);
        manualLotto.combineLottos(from);
        return manualLotto;
}
```

리뷰어: 스트림 API를 사용하면 굉장히 클린하게 개선이 가능한 로직인 것 같기는 합니다! 다른 곳에서는 스트림을 사용하셨길래 의견 드립니다.

생각정리: 여러 가지 언어를 다뤄봐서 stream보다는 for문이 익숙한 경향이 없지 않아 있습니다. for문을 작성할 때 stream으로 최대한 변경해 보도록 하겠습니다. 수정하겠습니다.

```java
List<Lotto> lottos = new ArrayList<>();
        for (int i = 0; i < manualLottos.size(); i++) {
            lottos.add(Lotto.fromManualLotto(new LottoPolicyStrategy(), manualLottos.get(i)));
        }
        return new Lottos(lottos);
```

다음과 같이 변경합니다.

```java
public static Lottos fromManualLottos(ManualLottoParam manualLotto) {
        List<Lotto> lottos = manualLotto.getManualLottos()
                .stream()
                .map(numbers -> Lotto.fromManualLotto(new LottoPolicyStrategy(), numbers.getLottoNumbers()))
                .collect(Collectors.toList());

        return new Lottos(lottos);
    }
```

깃허브 링크: [https://github.com/next-step/java-lotto/pull/3104](https://github.com/next-step/java-lotto/pull/3104)

## 후기

4단계도 머지 완료되었습니다. 1단계에서도 느끼는 거지만 챕터별로 진행되다 보니 많은 개발자와 리뷰하는 것도 좋지만, 많은 소통을 못했다는 아쉬움도 큰 것 같습니다. 한 사람과 같이 하다 보면 많은 이야기들을 할 수 있을 것 같은데, 다음 챕터에서는 좀 더 적극적으로 이야기 전달을 해볼 생각입니다.

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
