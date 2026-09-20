---
title: "문자열 덧셈 계산기로 배우는 TDD — 2단계"
tags: ["클린 코드", "Java", "TDD", "리팩토링", "객체지향 생활체조"]
summary: "문자열 덧셈 계산기를 TDD로 구현하고 리뷰 피드백에 따라 상수화, 책임 분리, 예외 처리를 리팩토링한 기록입니다."
---

## 문자열 덧셈 계산기를 통한 TDD 실습

### 기능 요구사항

- 쉼표(,) 또는 콜론(:)을 구분자로 가지는 문자열을 전달하는 경우 구분자를 기준으로 분리한 각 숫자의 합을 반환합니다 (예: "" => 0, "1,2" => 3, "1,2,3" => 6, "1,2:3" => 6).
- 앞의 기본 구분자(쉼표, 콜론)외에 커스텀 구분자를 지정할 수 있습니다. 커스텀 구분자는 문자열 앞부분의 "//"와 "\n" 사이에 위치하는 문자를 커스텀 구분자로 사용합니다. 예를 들어 "//;\n1;2;3"과 같이 값을 입력할 경우 커스텀 구분자는 세미콜론(;)이며, 결과 값은 6이 반환되어야 합니다.
- 문자열 계산기에 숫자 이외의 값 또는 음수를 전달하는 경우 RuntimeException 예외를 throw합니다.

### 프로그래밍 요구사항

- 메소드가 너무 많은 일을 하지 않도록 분리하기 위해 노력해 봅니다.

## 코드 구성

작성한 코드는 다음과 같습니다.

```java
package study;

import java.util.Arrays;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class StringAddCalculator {
    private String regex = ",|:";
    private String StringInput;
    private Matcher matcher;

    public int splitAndSum(String input) {
        StringInput = input;
        setMatch(StringInput);

        if (isPatternMatch(matcher)) {
            changeRegex(matcher);
            changeStringInput(matcher);
        }

        String[] strings = splitSentences(StringInput);
        int[] arr = changeStringArrToIntArr(strings);
        return sumIntArr(arr);
    }

    // Match 셋팅
    private void setMatch(String input) {
        if (Objects.isNull(input)) {
            return;
        }
        matcher = Pattern.compile("//(.)\n(.*)").matcher(input);
    }

    // 패턴 맞는지 확인하기
    private boolean isPatternMatch(Matcher matcher) {
        if (Objects.isNull(matcher)) {
            return false;
        }
        return matcher.find() == true ? true : false;
    }

    // 패턴값 변경하기.
    private void changeRegex(Matcher matcher) {
        regex = matcher.group(1);
    }

    // 입력값 변경하기
    private void changeStringInput(Matcher matcher) {
        StringInput = matcher.group(2);
    }

    // 문장 나누기 하기
    private String[] splitSentences(String input) {
        if (!Objects.isNull(input)) {
            return new String[0];
        }
        return input.split(regex);
    }

    // 문장배열 숫자 배열로 변경하기.
    private int[] changeStringArrToIntArr(String[] strings) {
        int [] arr = new int[strings.length];
        for (int i = 0; i < strings.length; i++) {
            arr[i] = Integer.parseInt(strings[i]);
            if (arr[i] < 0) {
                throw new RuntimeException("음수가 입력되었습니다. 입력숫자를 확인해주세요.");
            }
        }
        return arr;
    }

    // 숫자배열 합치기.
    private int sumIntArr(int[] arr) {
        return Arrays.stream(arr).sum();
    }

}
```

## 피드백

**1) `static final` 키워드를 붙여서 상수로**

**2) 숫자를 구분하는 '구분 문자'라는 것을 좀 더 명확하게**

- 네이밍 관련 링크
    - [https://tecoble.techcourse.co.kr/post/2020-04-24-variable_naming/](https://tecoble.techcourse.co.kr/post/2020-04-24-variable_naming/)
    - [https://edu.nextstep.camp/s/wLaV8qhA/ls/OfAcbLUS](https://edu.nextstep.camp/s/wLaV8qhA/ls/OfAcbLUS)

```java
import java.util.regex.Pattern;

public class StringAddCalculator {
    private String regex = ",|:";
```

다음과 같이 변경합니다.

```java
public class StringAddCalculator {
    private static final String DELIMITER = ",|:";
    private static final String CUSTOM_DELIMITER = "//(.)\n(.*)";
```

**3) 매번 계산할 때마다 Pattern 인스턴스를 생성하는 대신에, 미리 하나의 인스턴스를 생성해놓고 이를 재사용**

```java
if (Objects.isNull(input)) {
    return;
}
matcher = Pattern.compile("//(.)\n(.*)").matcher(input);
```

다음과 같이 변경합니다.

```java
public class StringAddCalculator {
    private static final String DELIMITER = ",|:";
    private static final String CUSTOM_DELIMITER = "//(.)\n(.*)";
    private static final Pattern CUSTOM_DELIMITER_PATTERN = Pattern.compile(CUSTOM_DELIMITER);
		
		private String[] splitString(String input) {
	        String delimiter = DELIMITER;
	        Matcher matcher = CUSTOM_DELIMITER_PATTERN.matcher(input);
	
	        if (isPatternMatch(matcher)) {
	            delimiter = changeDelimiter(matcher);
	            input = changeInput(matcher);
	        }
	
	        return input.split(delimiter);
	    }
```

**4) 상수 변경 및 멤버변수를 지역변수로 변경**

- 숫자 `1` 와 `2` 는 상수로 선언해서 의미를 부여해 봅니다.
- 멤버 변수를 지역변수로 변경합니다.

```java
private void changeRegex(Matcher matcher) {
        regex = matcher.group(1);
}

// 입력값 변경하기
private void changeStringInput(Matcher matcher) {
    StringInput = matcher.group(2);
}
```

다음과 같이 변경합니다.

```java
public class StringAddCalculator {
		private static final int ZERO = 0;
		private static final int FIRST = 1;
		
		private String changeDelimiter(Matcher matcher) {
		    return matcher.group(FIRST);
		}
		
		// 입력값 변경하기
		private String changeInput(Matcher matcher) {
		    return matcher.group(SECOND);
		}
```

**5) 객체지향 생활 체조 원칙의 `규칙 1: 한 메서드에 오직 한 단계의 들여쓰기만 한다.`**

```java
for (int i = 0; i < strings.length; i++) {
    arr[i] = Integer.parseInt(strings[i]);
    if (arr[i] < 0) {
        throw new RuntimeException("음수가 입력되었습니다. 입력숫자를 확인해주세요.");
    }
}
```

다음과 같이 변경합니다.

```java
private int[] convertToNumberArray(String[] strings) {
    int [] arr = new int[strings.length];
    for (int i = 0; i < strings.length; i++) {
        arr[i] = Integer.parseInt(strings[i]);
        throwExceptionIfNegative(arr[i]);
    }
    return arr;
}

private void throwExceptionIfNegative(int input) {
    if (input < 0) {
        throw new RuntimeException("음수가 입력되었습니다. 입력숫자를 확인해주세요.");
    }
}
```

**6) `null` 또는 빈 문자열을 테스트할 경우, `@NullAndEmptySource` 어노테이션을 활용해 보는 것을 추천합니다.**

- 관련링크: [https://gmlwjd9405.github.io/2019/11/27/junit5-guide-parameterized-test.html](https://gmlwjd9405.github.io/2019/11/27/junit5-guide-parameterized-test.html)

```java
@Test
    @DisplayName("null 또는 빈 문자열 입력시 splitAndSum 체크")
    public void splitAndSum_null_또는_빈문자() {
				int result = stringAddCalculator.splitAndSum(null);
        assertThat(result).isEqualTo(0);

        result = stringAddCalculator.splitAndSum("");
        assertThat(result).isEqualTo(0);
    }
```

다음과 같이 변경합니다.

```java
@ParameterizedTest
    @DisplayName("null 또는 빈 문자열 입력시 splitAndSum 체크")
    @NullAndEmptySource
    public void splitAndSum_null_또는_빈문자(String text) {
        int result = stringAddCalculator.splitAndSum(text);
        assertThat(result).isEqualTo(0);
    }
```

**7) 파일 끝에는 개행을 해야 합니다.**

- 관련링크: [https://velog.io/@doondoony/posix-eol](https://velog.io/@doondoony/posix-eol)

**8) 다음과 같이 줄일 수 있습니다.**

```java
if (Objects.isNull(input) || "".equals(input)) {
    return true;
}
return false;
```

다음과 같이 변경합니다.

```java
private boolean isNotValidValue(String input) {
    return Objects.isNull(input) || "".equals(input);
}
```

## 피드백 이후 소스코드

```java
package study;

import java.util.Arrays;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class StringAddCalculator {
    private static final String DELIMITER = ",|:";
    private static final String CUSTOM_DELIMITER = "//(.)\n(.*)";
    private static final Pattern CUSTOM_DELIMITER_PATTERN = Pattern.compile(CUSTOM_DELIMITER);
    private static final int ZERO = 0;
    private static final int FIRST = 1;
    private static final int SECOND = 2;

    public int splitAndSum(String input) {
        if (isNotValidValue(input)) {
            return ZERO;
        }
        return sumIntArr(convertToNumberArray(splitString(input)));
    }

    private boolean isNotValidValue(String input) {
        return Objects.isNull(input) || "".equals(input);
    }

    // 문장 나누기 하기
    private String[] splitString(String input) {
        String delimiter = DELIMITER;
        Matcher matcher = CUSTOM_DELIMITER_PATTERN.matcher(input);

        if (isPatternMatch(matcher)) {
            delimiter = changeDelimiter(matcher);
            input = changeInput(matcher);
        }

        return input.split(delimiter);
    }

    // 패턴 맞는지 확인하기
    private boolean isPatternMatch(Matcher matcher) {
        return matcher.find();
    }

    // 패턴값 변경하기.
    private String changeDelimiter(Matcher matcher) {
        return matcher.group(FIRST);
    }

    // 입력값 변경하기
    private String changeInput(Matcher matcher) {
        return matcher.group(SECOND);
    }

    // 문장배열 숫자 배열로 변경하기
    private int[] convertToNumberArray(String[] strings) {
        int [] arr = new int[strings.length];
        for (int i = 0; i < strings.length; i++) {
            arr[i] = Integer.parseInt(strings[i]);
            throwExceptionIfNegative(arr[i]);
        }
        return arr;
    }

    // 음수값이면 예외 발생
    private void throwExceptionIfNegative(int input) {
        if (input < 0) {
            throw new RuntimeException("음수가 입력되었습니다. 입력숫자를 확인해주세요.");
        }
    }

    // 숫자배열 합치기.
    private int sumIntArr(int[] arr) {
        return Arrays.stream(arr).sum();
    }
}
```

## 후기

오늘은 문자열 덧셈 계산기를 이용한 소스코드를 작성했습니다.

기존의 소스코드의 습관이란, 고치기 힘든 것 같습니다. 습관을 고치기 위해서는 항상 인지하고, 이해하고 고치려고 노력해야 되는 것 같습니다. 위에 보여준 예시를 항상 기억하고, 고치려고 마음먹어 보겠습니다.

깃허브 링크: [https://github.com/next-step/java-racingcar/pull/4211](https://github.com/next-step/java-racingcar/pull/4211)

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
