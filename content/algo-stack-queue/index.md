---
title: "스택과 큐"
tags: ["알고리즘","Java","자료구조","코딩테스트"]
summary: "스택과 큐를 이용해 괄호 검증, 후위 연산, 카카오 인형뽑기 등 코딩 테스트 문제 8개를 자바로 풀이합니다."
---

오늘은 스택과 큐를 이용해 풀 수 있는 문제들을 정리하도록 하겠습니다. 스택은 나중에 넣은 값을 먼저 꺼내는 자료구조(LIFO)이고, 큐는 먼저 넣은 값을 먼저 꺼내는 자료구조(FIFO)입니다. 1번부터 5번까지는 `Stack`으로, 6번부터 8번까지는 `Queue`로 풀이하였습니다.

## 1. 올바른 괄호

괄호가 입력되면 올바른 괄호이면 "YES", 올바르지 않으면 "NO"를 출력하는 문제입니다. 예를 들어 (())()는 괄호의 쌍이 올바르게 위치하지만, (()()))은 올바른 괄호가 아닙니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 괄호 문자열이 입력됩니다. 문자열의 최대 길이는 30입니다.
- 출력: 첫 번째 줄에 YES 또는 NO를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
(()(()))(()

```

```text
NO
```

### 풀이

여는 괄호는 스택에 넣고, 닫는 괄호가 나오면 스택에서 하나를 꺼냅니다. 닫는 괄호가 나왔는데 스택이 비어 있거나, 문자열을 모두 확인한 뒤에도 스택에 괄호가 남아 있으면 올바르지 않은 괄호로 판단합니다.

```java
package com.company.stackandqueue;

import java.util.Scanner;
import java.util.Stack;

public class CorrectParenthesis {
    public static void main (String [] args) {
        CorrectParenthesis correctParenthesis = new CorrectParenthesis();
        Scanner in = new Scanner(System.in);
        String str = in.next();
        correctParenthesis.solution(str);
    }

    boolean solution(String str) {
        boolean answer = true;
        Stack<Character> stack = new Stack<>();
        char [] ar = str.toCharArray();
        for (char c : ar) {
            if (c == '(') {
                stack.push(c);
            } else {
                if (!stack.isEmpty()) {
                    stack.pop();
                } else {
                    answer = false;
                }
            }
        }
        if(!stack.isEmpty()) answer = false;
        System.out.println(answer);
        return answer;
    }
}
```

## 2. 괄호 문자 제거

입력된 문자열에서 소괄호 ( ) 사이에 존재하는 모든 문자를 제거하고 남은 문자만 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 문자열이 주어집니다. 문자열의 길이는 100을 넘지 않습니다.
- 출력: 남은 문자만 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
(A(BC)D)EF(G(H)(IJ)K)LM(N)

```

```text
EFLM
```

### 풀이

닫는 괄호가 아닌 문자는 모두 스택에 넣고, 닫는 괄호가 나오면 여는 괄호가 나올 때까지 스택에서 꺼냅니다. 이렇게 하면 괄호 안의 문자가 함께 빠지고, 마지막에 스택에 남은 문자가 답이 됩니다.

```java
package com.company.stackandqueue;

import java.util.Scanner;
import java.util.Stack;

public class removeParenthesis {
    public static void main (String [] args) {
        removeParenthesis removeParenthesis = new removeParenthesis();
        Scanner in = new Scanner(System.in);
        String str = in.next();
        removeParenthesis.solution(str);
    }

    void solution(String str) {
        String answer = "";
        Stack<Character> stack = new Stack<>();

        char [] ar = str.toCharArray();
        for (char c : ar) {
            if (c == ')') {
                while (stack.pop() != '(');
            } else {
                stack.push(c);
            }
        }

        for (Character character : stack) {
            answer += character;
        }
        System.out.println(answer);
    }
}
```

## 3. 크레인 인형뽑기 (카카오)

게임 개발자인 죠르디는 크레인 인형뽑기 기계를 모바일 게임으로 만들려고 합니다. 게임의 재미를 높이기 위해 화면 구성과 규칙을 다음과 같이 게임 로직에 반영하려고 합니다.

게임 화면은 1 x 1 크기의 칸들로 이루어진 N x N 크기의 정사각 격자이며, 위쪽에는 크레인이 있고 오른쪽에는 바구니가 있습니다. 각 격자 칸에는 다양한 인형이 들어 있으며, 인형이 없는 칸은 빈칸입니다. 모든 인형은 1 x 1 크기의 격자 한 칸을 차지하며 격자의 가장 아래 칸부터 차곡차곡 쌓여 있습니다.

게임 사용자는 크레인을 좌우로 움직여서 멈춘 위치에서 가장 위에 있는 인형을 집어 올릴 수 있습니다. 집어 올린 인형은 바구니에 쌓이는데, 이때 바구니의 가장 아래 칸부터 인형이 순서대로 쌓입니다. 예를 들어 [1번, 5번, 3번] 위치에서 순서대로 인형을 집어 올리면 세 인형이 그 순서대로 바구니에 쌓입니다.

만약 같은 모양의 인형 두 개가 바구니에 연속해서 쌓이게 되면 두 인형은 터뜨려지면서 바구니에서 사라집니다. 위 상태에서 이어서 [5번] 위치에서 인형을 집어 바구니에 쌓으면 같은 모양 인형 두 개가 없어집니다.

크레인 작동 시 인형이 집어지지 않는 경우는 없으나, 인형이 없는 곳에서 크레인을 작동시키는 경우에는 아무런 일도 일어나지 않습니다. 또한 바구니는 모든 인형이 들어갈 수 있을 만큼 충분히 크다고 가정합니다.

게임 화면의 격자 상태가 담긴 2차원 배열 board와 인형을 집기 위해 크레인을 작동시킨 위치가 담긴 배열 moves가 매개변수로 주어질 때, 크레인을 모두 작동시킨 후 터트려져 사라진 인형의 개수를 구하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력
  - 첫 줄에 자연수 N(5<=N<=30)이 주어집니다.
  - 두 번째 줄부터 N*N board 배열이 주어집니다.
  - board의 각 칸에는 0 이상 100 이하인 정수가 담겨 있습니다. 0은 빈칸을 나타냅니다.
  - 1 ~ 100의 각 숫자는 각기 다른 인형의 모양을 의미하며, 같은 숫자는 같은 모양의 인형을 나타냅니다.
  - board 배열이 끝난 다음 줄에 moves 배열의 길이 M이 주어지고, 마지막 줄에 moves 배열이 주어집니다.
  - moves 배열의 크기는 1 이상 1,000 이하입니다.
  - moves 배열 각 원소들의 값은 1 이상이며 board 배열의 가로 크기 이하인 자연수입니다.
- 출력: 첫 줄에 터트려져 사라진 인형의 개수를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
5
0 0 0 0 0
0 0 1 0 3
0 2 5 0 1
4 2 4 4 2
3 5 1 3 1
8
1 5 3 5 1 2 1 4

```

```text
4
```

### 풀이

바구니를 스택으로 둡니다. moves의 위치마다 board의 해당 열을 위에서부터 내려가며 처음 만나는 인형을 꺼내고, 그 칸은 0으로 바꿉니다. 꺼낸 인형이 스택 맨 위의 인형과 같으면 스택에서 꺼내고 사라진 인형 수에 2를 더하며, 다르면 스택에 넣습니다.

```java
package com.company.stackandqueue;

import java.util.Scanner;
import java.util.Stack;

public class KakaoBalloonPop {
    public static void main (String [] args) {
        KakaoBalloonPop kakaoBalloonPop = new KakaoBalloonPop();
        Scanner in = new Scanner(System.in);
        int boardCount = in.nextInt();
        int [][] board = new int[boardCount][boardCount];
        for(int i=0; i<boardCount; i++) {
            for(int j=0; j<boardCount; j++) {
                board[i][j] = in.nextInt();
            }
        }

        int moveCount = in.nextInt();
        int [] moves = new int[moveCount];
        for(int i=0; i<moveCount; i++) {
            moves[i] = in.nextInt();
        }
        kakaoBalloonPop.solution(boardCount, board, moveCount, moves);
    }

    void solution(int boardCount, int [][] board, int moveCount, int [] moves) {
        int answer = 0;
        Stack<Integer> stack = new Stack<>();
        for(int i=0; i<moveCount; i++) {
            for(int j=0; j<boardCount; j++) {
                if (board[j][moves[i]-1] != 0) {
                    int temp = board[j][moves[i]-1];
                    board[j][moves[i]-1] = 0;
                    if (!stack.isEmpty() && temp == stack.peek()) {
                        answer+=2;
                        stack.pop();
                    } else {
                        stack.push(temp);
                    }
                    break;
                }
            }
        }
        System.out.println(answer);
    }
}
```

## 4. 후위식 연산

후위연산식이 주어지면 연산한 결과를 출력하는 문제입니다. 예를 들어 3*(5+2)-9를 후위연산식으로 표현하면 352+*9-이고, 그 결과는 12입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 후위연산식이 주어집니다. 연산식의 길이는 50을 넘지 않습니다. 식은 1~9의 숫자와 +, -, *, / 연산자로만 이루어집니다.
- 출력: 연산한 결과를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
352+*9-

```

```text
12
```

### 풀이

숫자는 스택에 넣고, 연산자가 나오면 스택에서 두 개를 꺼내 계산한 뒤 결과를 다시 스택에 넣습니다. 먼저 꺼낸 값이 오른쪽 피연산자(rt), 나중에 꺼낸 값이 왼쪽 피연산자(lt)가 되므로 `lt-rt`, `lt/rt`처럼 순서를 지켜 계산합니다.

```java
package com.company.stackandqueue;

import java.util.Scanner;
import java.util.Stack;

public class Postfix {
    public static void main (String [] args) {
        Postfix postfix = new Postfix();
        Scanner in = new Scanner(System.in);
        String str = in.next();

        postfix.solution(str);

    }

    void solution(String str) {
        char [] arr = str.toCharArray();
        Stack<Integer> stack = new Stack<>();

        for (char c : arr) {
            if ( Character.isDigit(c)) {
                stack.push((c - '0'));
                //숫자
            } else {
                //특수문자
                int rt = stack.pop();
                int lt = stack.pop();
                int calcResult = 0;
                switch (c) {
                    case '+' :
                        calcResult = lt+rt;
                        break;
                    case '-' :
                        calcResult = lt-rt;
                        break;
                    case '*' :
                        calcResult = lt*rt;
                        break;
                    case '/' :
                        calcResult = lt/rt;
                        break;
                }
                stack.push(calcResult);
            }
        }
        System.out.println(stack.get(0));
    }

}
```

## 5. 쇠막대기

여러 개의 쇠막대기를 레이저로 절단하려고 합니다. 효율적인 작업을 위해 쇠막대기를 아래에서 위로 겹쳐 놓고, 레이저를 위에서 수직으로 발사하여 쇠막대기들을 자릅니다. 쇠막대기와 레이저의 배치는 다음 조건을 만족합니다.

- 쇠막대기는 자신보다 긴 쇠막대기 위에만 놓일 수 있습니다.
- 쇠막대기를 다른 쇠막대기 위에 놓는 경우 완전히 포함되도록 놓되, 끝점은 겹치지 않도록 놓습니다.
- 각 쇠막대기를 자르는 레이저는 적어도 하나 존재합니다.
- 레이저는 어떤 쇠막대기의 양 끝점과도 겹치지 않습니다.

이러한 레이저와 쇠막대기의 배치는 다음과 같이 괄호를 이용하여 왼쪽부터 순서대로 표현할 수 있습니다.

1. 레이저는 여는 괄호와 닫는 괄호의 인접한 쌍 '( )'으로 표현됩니다. 또한, 모든 '( )'는 반드시 레이저를 표현합니다.
2. 쇠막대기의 왼쪽 끝은 여는 괄호 '('로, 오른쪽 끝은 닫힌 괄호 ')'로 표현됩니다.

쇠막대기는 레이저에 의해 몇 개의 조각으로 잘리는데, 예시 입력 1의 배치에서 가장 위에 있는 두 개의 쇠막대기는 각각 3개와 2개의 조각으로 잘리고, 같은 방식으로 주어진 쇠막대기들은 총 17개의 조각으로 잘립니다.

쇠막대기와 레이저의 배치를 나타내는 괄호 표현이 주어졌을 때, 잘린 쇠막대기 조각의 총 개수를 구하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 한 줄에 쇠막대기와 레이저의 배치를 나타내는 괄호 표현이 공백 없이 주어집니다. 괄호 문자의 개수는 최대 100,000입니다.
- 출력: 잘린 조각의 총 개수를 나타내는 정수를 한 줄에 출력합니다.

예시 입력 1과 출력은 아래와 같습니다.

```text
()(((()())(())()))(())

```

```text
17
```

예시 입력 2와 출력은 아래와 같습니다.

```text
(((()(()()))(())()))(()())
```

```text
24
```

### 풀이

여는 괄호는 스택에 넣고, 닫는 괄호가 나오면 스택에서 하나를 꺼냅니다. 이때 바로 앞 문자가 여는 괄호였다면 레이저이므로, 스택에 남아 있는 괄호 수(레이저가 지나가는 쇠막대기 수)만큼 조각을 더합니다. 바로 앞 문자가 닫는 괄호였다면 쇠막대기 하나가 끝난 것이므로 마지막 조각 1개를 더합니다.

```java
package com.company.stackandqueue;

import java.util.Scanner;
import java.util.Stack;

public class IronRod {
    public static void main (String [] args) {
        IronRod ironRod = new IronRod();
        Scanner in = new Scanner(System.in);
        String str = in.next();
        ironRod.solution(str);
    }

    void solution(String str) {
        Stack<Character> stack = new Stack<>();
        int answer = 0;
        char [] arr = str.toCharArray();
        for (int i=0; i<arr.length; i++) {
            if (arr[i] == '(') {
                stack.push(arr[i]);
            } else {
                stack.pop();
                if (arr[i-1] == '(') {
                    answer += stack.size();
                } else {
                    answer += 1;
                }

            }
        }
        System.out.println(answer);

    }
}
```

## 6. 공주 구하기

정보 왕국의 이웃 나라 외동딸 공주가 숲속의 괴물에게 잡혀갔습니다. 정보 왕국에는 왕자가 N명이 있는데 서로 공주를 구하러 가겠다고 합니다. 정보 왕국의 왕은 다음과 같은 방법으로 공주를 구하러 갈 왕자를 결정하기로 했습니다.

- 왕은 왕자들을 나이 순으로 1번부터 N번까지 차례로 번호를 매깁니다.
- 1번 왕자부터 N번 왕자까지 순서대로 시계 방향으로 돌아가며 동그랗게 앉게 합니다.
- 1번 왕자부터 시계 방향으로 돌아가며 1부터 시작하여 번호를 외치게 합니다.
- 한 왕자가 K(특정 숫자)를 외치면 그 왕자는 공주를 구하러 가는 데서 제외되고 원 밖으로 나오게 됩니다.
- 그리고 다음 왕자부터 다시 1부터 시작하여 번호를 외칩니다.

이렇게 해서 마지막까지 남은 왕자가 공주를 구하러 갈 수 있습니다.

예를 들어 총 8명의 왕자가 있고, 3을 외친 왕자가 제외된다고 하겠습니다. 처음에는 3번 왕자가 3을 외쳐 제외됩니다. 이어 6, 1, 5, 2, 8, 4번 왕자가 차례대로 제외되고, 마지막까지 남게 된 7번 왕자가 공주를 구하러 갑니다.

N과 K가 주어질 때 공주를 구하러 갈 왕자의 번호를 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 자연수 N(5<=N<=1,000)과 K(2<=K<=9)가 주어집니다.
- 출력: 첫 줄에 마지막 남은 왕자의 번호를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
8 3
```

```text
7
```

### 풀이

1번부터 N번까지 왕자 번호를 큐에 넣습니다. 큐 앞에서 꺼낸 번호를 다시 뒤에 넣는 방식으로 원을 따라 도는 것을 표현하고, 제외할 왕자는 꺼낸 뒤 다시 넣지 않습니다. 큐에 한 명만 남으면 그 번호를 출력합니다.

```java
package com.company.stackandqueue;

import java.util.LinkedList;
import java.util.Queue;
import java.util.Scanner;

public class SaveThePrincess {
    public static void main (String [] args) {
        SaveThePrincess saveThePrincess = new SaveThePrincess();
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int k = in.nextInt();

        saveThePrincess.solution(n, k);
    }

    void solution(int n, int k) {
        Queue<Integer> queue = new LinkedList<>();
        for (int i=1; i<=n; i++) {
            queue.offer(i);
        }
        while(!queue.isEmpty()) {
            for (int i=0; i<k; i++) {
                queue.offer(queue.poll());
            }
            queue.poll();
            if (queue.size() == 1) {
                System.out.println(queue.poll());
            }
        }
    }
}
```

이 코드는 예시 입력 `8 3`을 넣으면 기대값 7이 아니라 6을 출력합니다. 안쪽 for문이 K명을 뒤로 보낸 다음 맨 앞의 왕자를 제외해 K번째가 아니라 K+1번째 왕자가 빠지기 때문이며, 뒤로 보내는 횟수를 K-1번으로 줄이면 됩니다.

## 7. 교육과정 설계

현수는 1년 과정의 수업 계획을 짜야 합니다. 수업 중에는 필수과목이 있는데, 이 필수과목은 반드시 이수해야 하며 그 순서도 정해져 있습니다.

만약 총 과목이 A, B, C, D, E, F, G가 있고, 여기서 필수과목이 CBA로 주어지면 필수과목은 C, B, A과목이며 이 순서대로 꼭 수업 계획을 짜야 합니다. 여기서 순서란 B과목은 C과목을 이수한 후에 들어야 하고, A과목은 C와 B를 이수한 후에 들어야 한다는 것입니다.

현수가 C, B, D, A, G, E로 수업 계획을 짜면 제대로 된 설계이지만, C, G, E, A, D, B 순서로 짰다면 잘못 설계된 수업 계획이 됩니다. 수업 계획은 그 순서대로 앞의 수업이 이수되면 다음 수업을 시작하는 것으로 해석하고, 수업 계획서상의 각 과목은 무조건 이수된다고 가정합니다.

필수과목 순서가 주어졌을 때, 현수가 짠 N개의 수업 설계가 잘된 것이면 "YES", 잘못된 것이면 "NO"를 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 필수과목의 순서가 주어집니다. 모든 과목은 영문 대문자입니다. 두 번째 줄부터 현수가 짠 수업 설계가 주어집니다(수업 설계의 길이는 30 이하입니다).
- 출력: 첫 줄에 수업 설계가 잘된 것이면 "YES", 잘못된 것이면 "NO"를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
CBA
CBDAGE

```

```text
YES
```

### 풀이

필수과목을 순서대로 큐에 넣습니다. 수업 계획의 과목을 앞에서부터 확인하면서 그 과목이 큐에 있으면 큐에서 하나를 꺼내 같은 과목인지 비교하고, 다르면 잘못된 설계로 판단합니다. 계획을 모두 확인한 뒤에도 큐에 필수과목이 남아 있으면 이수하지 않은 필수과목이 있는 것이므로 역시 잘못된 설계입니다.

```java
package com.company.stackandqueue;

import java.util.LinkedList;
import java.util.Queue;
import java.util.Scanner;

public class EducationPlan {
    public static void main (String [] args) {
        EducationPlan educationPlan = new EducationPlan();
        Scanner in = new Scanner(System.in);
        String need = in.next();
        String plan = in.next();

        educationPlan.solution(need, plan);
    }

    void solution(String need, String plan) {
        boolean result = true;
        Queue<Character> queue = new LinkedList<>();
        for (Character c : need.toCharArray()) {
            queue.offer(c);
        }

        for (Character c : plan.toCharArray()) {
            if (queue.contains(c)) {
                if (queue.poll() != c) {
                    result = false;
                }
            }
        }
        if(queue.size() > 0) {
            result = false;
        }
        System.out.println(result);
    }
}
```

## 8. 응급실

메디컬 병원 응급실에는 의사가 한 명밖에 없습니다. 응급실은 환자가 도착한 순서대로 진료를 합니다. 하지만 위험도가 높은 환자는 의사가 빨리 응급조치를 해야 합니다. 이런 문제를 보완하기 위해 응급실은 다음과 같은 방법으로 환자의 진료 순서를 정합니다.

- 환자가 접수한 순서대로의 목록에서 제일 앞에 있는 환자를 꺼냅니다.
- 나머지 대기 목록에서 꺼낸 환자보다 위험도가 높은 환자가 존재하면 대기 목록 제일 뒤로 다시 넣습니다. 그렇지 않으면 진료를 받습니다.

즉, 대기 목록에 자기보다 위험도가 높은 환자가 없을 때 자신이 진료를 받는 구조입니다.

현재 N명의 환자가 대기 목록에 있습니다. N명의 대기 목록 순서의 환자 위험도가 주어지면, 대기 목록상의 M번째 환자가 몇 번째로 진료를 받는지 출력하는 문제입니다. 대기 목록상의 M번째는 대기 목록의 제일 처음 환자를 0번째로 간주하여 표현한 것입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 자연수 N(5<=N<=100)과 M(0<=M<N)이 주어집니다. 두 번째 줄에 접수한 순서대로 환자의 위험도(50<=위험도<=100)가 주어집니다. 위험도는 값이 높을수록 더 위험하다는 뜻이며, 같은 값의 위험도가 존재할 수 있습니다.
- 출력: M번째 환자가 몇 번째로 진료받는지 출력합니다.

예시 입력 1과 출력은 아래와 같습니다.

```text
5 2
60 50 70 80 90

```

```text
3
```

예시 입력 2와 출력은 아래와 같습니다.

```text
6 3
70 60 90 60 60 60

```

```text
4
```

### 풀이

환자의 접수 순서(seq)와 위험도(risk)를 함께 담는 `Patient` 클래스를 만들어 큐에 넣습니다. 큐에서 환자를 꺼낸 뒤 남은 환자 중 위험도가 더 높은 환자가 있으면 다시 큐 뒤에 넣고, 없으면 진료 순서를 하나 늘립니다. 진료받은 환자의 seq가 M과 같을 때의 순서를 출력합니다.

```java
class Patient {
    private int seq;
    private int risk;

    public Patient(int seq, int risk) {
        this.seq = seq;
        this.risk = risk;
    }

    public int getSeq() {
        return seq;
    }

    public int getRisk() {
        return risk;
    }

    @Override
    public String toString() {
        return "Patient{" +
                "seq=" + seq +
                ", risk=" + risk +
                '}';
    }
}

public class EmergencyRoom {
    public static void main (String [] args) {

        EmergencyRoom educationPlan = new EmergencyRoom();
        Scanner in = new Scanner(System.in);
        int humanCount = in.nextInt();
        int number = in.nextInt();
        int [] risks = new int[humanCount];
        for (int i=0; i<humanCount; i++) {
            risks[i] = in.nextInt();
        }

        educationPlan.solution(humanCount, number, risks);
    }

    void solution(int humanCount, int number, int [] risks) {
        int answer = 0;
        Queue<Patient> queue = new LinkedList<>();
        for (int i=0; i<humanCount; i++) {
            queue.offer(new Patient(i, risks[i]));
        }
        while(!queue.isEmpty()) {
            Patient temp = queue.poll();
            for (Patient patient : queue) {
                if (temp.getRisk() < patient.getRisk()) {
                    queue.offer(temp);
                    temp = null;
                    break;
                }
            }
            //진료를 받을 수 있음
            if (temp != null) {
                answer++;
                if (temp.getSeq() == number) System.out.println(answer);
            }

        }
    }
}
```

## 마무리

오늘은 스택과 큐를 이용해 푸는 문제 8개를 정리하였습니다. 괄호의 짝을 맞추거나 가장 최근에 넣은 값과 비교해야 할 때는 스택을, 정해진 순서대로 돌아가며 처리해야 할 때는 큐를 사용하였습니다.
