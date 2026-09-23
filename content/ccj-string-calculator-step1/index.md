---
title: "문자열 계산기 — 1단계"
tags: ["TDD","클린 코드","Java","문자열 계산기","리팩터링"]
summary: "들여쓰기 depth와 메서드 크기 제한, else 금지 조건 아래 문자열 사칙연산 계산기를 구현한 과제와 리뷰 피드백을 정리합니다."
---

## 문자열 사칙 연산 계산기 구현

### 기능 요구사항

- 사용자가 입력한 문자열 값에 따라 사칙연산을 수행할 수 있는 계산기를 구현해야 합니다.
- 입력 문자열의 숫자와 사칙 연산 사이에는 **반드시 빈 공백 문자열**이 있다고 가정합니다.
- **나눗셈의 경우 결과 값을 정수**로 떨어지는 값으로 한정합니다.
- 문자열 계산기는 **사칙연산의 계산 우선순위가 아닌 입력 값에 따라 계산 순서가 결정**됩니다. 즉, 수학에서는 곱셈, 나눗셈이 덧셈, 뺄셈보다 먼저 계산해야 하지만 이를 무시합니다.
- 예를 들어 **`2 + 3 * 4 / 2`**와 같은 문자열을 입력할 경우 **`2 + 3 * 4 / 2`** 실행 결과인 10을 출력해야 합니다.

### 프로그래밍 요구사항

- indent(들여쓰기) depth를 2단계에서 1단계로 줄입니다.
    - depth의 경우 if문을 사용하는 경우 1단계의 depth가 증가합니다. if문 안에 while문을 사용한다면 depth가 2단계가 됩니다.
- 메소드의 크기가 최대 10라인을 넘지 않도록 구현합니다.
    - method가 한 가지 일만 하도록 최대한 작게 만듭니다.
- else를 사용하지 않습니다.

### 피드백

리뷰어: 전반적인 방향성은 나쁘지 않지만, 요구사항을 충족하지 못하는 부분이 있어 이 부분 개선이 필요해 보입니다. 개선 부탁드립니다.

- `else` 사용하지 않는 것이 요구사항 중 하나였던 것으로 알고 있습니다. 이 부분 요구사항을 충족하려면 어떻게 설계해야 할까요?
- 연산자 하나하나에 대한 추상화, 그리고 추상화된 연산자를 탐색하는 로직이 구현된 클래스 혹은 메소드 하나가 필요할 것 같습니다. 고민해 주시면 감사하겠습니다.

생각정리 : 기능에 집중하다 보니 if else 조건을 놓쳐버렸습니다.

```jsx
public String calculator(String leftNumber, String rightNumber) {
    Number left = Number.from(leftNumber);
    Number right = Number.from(rightNumber);

    OperationEnum operationEnum = null;

    if ("+".equals(operation)) {
				operationEnum = OperationEnum.ADD;
    } else if ("-".equals(operation)) {
        operationEnum = OperationEnum.MINUS;
    } else if ("*".equals(operation)) {
        operationEnum = OperationEnum.MULTIPLY;
    } else if ("/".equals(operation)) {
        operationEnum = OperationEnum.DIVIDE;
    }

    return String.valueOf(operationEnum.calculator(left.getNumber(), right.getNumber()));
}
```

- 다음과 같이 변경합니다.

```jsx
public enum OperationEnum {
        ADD("+", (number1, number2) -> number1 + number2),
        MINUS("-", (number1, number2) -> number1 - number2),
        MULTIPLY("*", (number1, number2) -> number1 * number2),
        DIVIDE("/", (number1, number2) -> number1 / number2);

        private final String operation;
        private final IntBinaryOperator expression;

        OperationEnum(String operation, IntBinaryOperator expression) {
            this.operation = operation;
            this.expression = expression;
        }

        public int calculator(int number1, int number2) {
            return getExpression().applyAsInt(number1, number2);
        }

        public static OperationEnum from(String operation) {
            return Arrays.stream(values())
                    .filter(value -> operation.equals(value.operation))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("잘못된 값 입력"));
        }

        public IntBinaryOperator getExpression() {
            return expression;
        }
    }
```

완료된 소스코드 링크 :

[https://github.com/next-step/java-lotto/pull/2943](https://github.com/next-step/java-lotto/pull/2943)

---

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
