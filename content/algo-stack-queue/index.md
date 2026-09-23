---
title: "스택과 큐"
tags: ["알고리즘","Java","스택","큐","코딩테스트"]
summary: "스택과 큐를 이용해 괄호 검증, 후위 연산, 카카오 인형뽑기 등 코딩 테스트 문제 8개를 자바로 풀이합니다."
---

## 1. 올바른 괄호

괄호가 입력되면 올바른 괄호이면 "YES", 올바르지 않으면 "NO"를 출력합니다.

(())() 이것은 괄호의 쌍이 올바르게 위치하는 것이지만, (()()))은 올바른 괄호가 아닙니다.

**입력**

첫 번째 줄에 괄호 문자열이 입력됩니다. 문자열의 최대 길이는 30입니다.

**출력**

첫 번째 줄에 YES, NO를 출력합니다.

**예시 입력 1**

```
(()(()))(()

```

**예시 출력 1**

```
NO
```

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

입력된 문자열에서 소괄호 ( ) 사이에 존재하는 모든 문자를 제거하고 남은 문자만 출력하는 프로그램을 작성합니다.

**입력**

첫 줄에 문자열이 주어집니다. 문자열의 길이는 100을 넘지 않습니다.

**출력**

남은 문자만 출력합니다.

**예시 입력 1**

```
(A(BC)D)EF(G(H)(IJ)K)LM(N)

```

**예시 출력 1**

```
EFLM
```

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

게임개발자인 죠르디는 크레인 인형뽑기 기계를 모바일 게임으로 만들려고 합니다.

죠르디는 게임의 재미를 높이기 위해 화면 구성과 규칙을 다음과 같이 게임 로직에 반영하려고 합니다.

게임 화면은 1 x 1 크기의 칸들로 이루어진 N x N 크기의 정사각 격자이며 위쪽에는 크레인이 있고 오른쪽에는 바구니가 있습니다. 각 격자 칸에는 다양한 인형이 들어 있으며 인형이 없는 칸은 빈칸입니다.

모든 인형은 1 x 1 크기의 격자 한 칸을 차지하며 격자의 가장 아래 칸부터 차곡차곡 쌓여 있습니다.

게임 사용자는 크레인을 좌우로 움직여서 멈춘 위치에서 가장 위에 있는 인형을 집어 올릴 수 있습니다. 집어 올린 인형은 바구니에 쌓이게 되는데, 이때 바구니의 가장 아래 칸부터 인형이 순서대로 쌓이게 됩니다.

[1번, 5번, 3번] 위치에서 순서대로 인형을 집어 올려 바구니에 담으면 위와 같은 모습이 됩니다.

만약 같은 모양의 인형 두 개가 바구니에 연속해서 쌓이게 되면 두 인형은 터뜨려지면서 바구니에서 사라지게 됩니다.

위 상태에서 이어서 [5번] 위치에서 인형을 집어 바구니에 쌓으면 같은 모양 인형 두 개가 없어집니다.

크레인 작동 시 인형이 집어지지 않는 경우는 없으나 만약 인형이 없는 곳에서 크레인을 작동시키는 경우에는 아무런 일도 일어나지 않습니다.

또한 바구니는 모든 인형이 들어갈 수 있을 만큼 충분히 크다고 가정합니다.

게임 화면의 격자의 상태가 담긴 2차원 배열 board와 인형을 집기 위해 크레인을 작동시킨 위치가 담긴 배열 moves가 매개변수로 주어질 때, 크레인을 모두 작동시킨 후 터트려져 사라진 인형의 개수를 구하는 프로그램을 작성합니다.

**입력**

첫 줄에 자연수 N(5<=N<=30)이 주어집니다.

두 번째 줄부터 N*N board 배열이 주어집니다.

board의 각 칸에는 0 이상 100 이하인 정수가 담겨있습니다.

0은 빈 칸을 나타냅니다.

1 ~ 100의 각 숫자는 각기 다른 인형의 모양을 의미하며 같은 숫자는 같은 모양의 인형을 나타냅니다.

board배열이 끝난 다음줄에 moves 배열의 길이 M이 주어집니다.

마지막 줄에는 moves 배열이 주어집니다.

moves 배열의 크기는 1 이상 1,000 이하입니다.

moves 배열 각 원소들의 값은 1 이상이며 board 배열의 가로 크기 이하인 자연수입니다.

**출력**

첫 줄에 터트려져 사라진 인형의 개수를 출력합니다.

**예시 입력 1**

```
5
0 0 0 0 0
0 0 1 0 3
0 2 5 0 1
4 2 4 4 2
3 5 1 3 1
8
1 5 3 5 1 2 1 4

```

**예시 출력 1**

```
4
```

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

후위연산식이 주어지면 연산한 결과를 출력하는 프로그램을 작성합니다.

만약 3*(5+2)-9 을 후위연산식으로 표현하면 352+*9- 로 표현되며 그 결과는 12입니다.

**입력**

첫 줄에 후위연산식이 주어집니다. 연산식의 길이는 50을 넘지 않습니다.

식은 1~9의 숫자와 +, -, *, / 연산자로만 이루어집니다.

**출력**

연산한 결과를 출력합니다.

**예시 입력 1**

```
352+*9-

```

**예시 출력 1**

```
12
```

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

여러 개의 쇠막대기를 레이저로 절단하려고 합니다. 효율적인 작업을 위해서 쇠막대기를 아래에서 위로 겹쳐 놓고, 레이저를 위에서 수직으로 발사하여 쇠막대기들을 자릅니다. 쇠막대기와 레이저의 배치는 다음 조건을 만족합니다.

- 쇠막대기는 자신보다 긴 쇠막대기 위에만 놓일 수 있습니다.
- 쇠막대기를 다른 쇠막대기 위에 놓는 경우 완전히 포함되도록 놓되, 끝점은 겹치지 않도록 놓습니다.
- 각 쇠막대기를 자르는 레이저는 적어도 하나 존재합니다.
- 레이저는 어떤 쇠막대기의 양 끝점과도 겹치지 않습니다.

쇠막대기와 레이저의 배치는 수평으로 그려진 굵은 실선을 쇠막대기로, 점을 레이저의 위치로, 수직으로 그려진 점선 화살표를 레이저의 발사 방향으로 나타낼 수 있습니다.

이러한 레이저와 쇠막대기의 배치는 다음과 같이 괄호를 이용하여 왼쪽부터 순서대로 표현할 수 있습니다.

1. 레이저는 여는 괄호와 닫는 괄호의 인접한 쌍 '( )'으로 표현됩니다. 또한, 모든 '( )'는 반드시 레이저를 표현합니다.
2. 쇠막대기의 왼쪽 끝은 여는 괄호 '('로, 오른쪽 끝은 닫힌 괄호 ')'로 표현됩니다.

쇠막대기는 레이저에 의해 몇 개의 조각으로 잘려지는데, 아래 예시에서 가장 위에 있는 두 개의 쇠막대기는 각각 3개와 2개의 조각으로 잘려지고, 이와 같은 방식으로 주어진 쇠막대기들은 총 17개의 조각으로 잘려집니다.

쇠막대기와 레이저의 배치를 나타내는 괄호 표현이 주어졌을 때, 잘려진 쇠막대기 조각의 총 개수를 구하는 프로그램을 작성합니다.

**입력**

한 줄에 쇠막대기와 레이저의 배치를 나타내는 괄호 표현이 공백없이 주어집니다. 괄호 문자의 개수는 최대 100,000입니다.

**출력**

잘려진 조각의 총 개수를 나타내는 정수를 한 줄에 출력합니다.

**예시 입력 1**

```
()(((()())(())()))(())

```

**예시 출력 1**

```
17
```

**예시 입력 2**

```
(((()(()()))(())()))(()())
```

**예시 출력 2**

```
24
```

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

정보 왕국의 이웃 나라 외동딸 공주가 숲속의 괴물에게 잡혀갔습니다.

정보 왕국에는 왕자가 N명이 있는데 서로 공주를 구하러 가겠다고 합니다.

정보왕국의 왕은 다음과 같은 방법으로 공주를 구하러 갈 왕자를 결정하기로 했습니다.

왕은 왕자들을 나이 순으로 1번부터 N번까지 차례로 번호를 매깁니다.

그리고 1번 왕자부터 N번 왕자까지 순서대로 시계 방향으로 돌아가며 동그랗게 앉게 합니다.

그리고 1번 왕자부터 시계방향으로 돌아가며 1부터 시작하여 번호를 외치게 합니다.

한 왕자가 K(특정숫자)를 외치면 그 왕자는 공주를 구하러 가는데서 제외되고 원 밖으로 나오게 됩니다.

그리고 다음 왕자부터 다시 1부터 시작하여 번호를 외칩니다.

이렇게 해서 마지막까지 남은 왕자가 공주를 구하러 갈 수 있습니다.

예를 들어 총 8명의 왕자가 있고, 3을 외친 왕자가 제외된다고 하겠습니다. 처음에는 3번 왕자가 3을 외쳐 제외됩니다.

이어 6, 1, 5, 2, 8, 4번 왕자가 차례대로 제외되고 마지막까지 남게 된 7번 왕자에게 공주를 구하러 갑니다.

N과 K가 주어질 때 공주를 구하러 갈 왕자의 번호를 출력하는 프로그램을 작성합니다.

**입력**

첫 줄에 자연수 N(5<=N<=1,000)과 K(2<=K<=9)가 주어집니다.

**출력**

첫 줄에 마지막 남은 왕자의 번호를 출력합니다.

**예시 입력 1**

```
8 3
```

**예시 출력 1**

```
7
```

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

## 7. 교육과정설계

현수는 1년 과정의 수업계획을 짜야 합니다.

수업중에는 필수과목이 있습니다. 이 필수과목은 반드시 이수해야 하며, 그 순서도 정해져 있습니다.

만약 총 과목이 A, B, C, D, E, F, G가 있고, 여기서 필수과목이 CBA로 주어지면 필수과목은 C, B, A과목이며 이 순서대로 꼭 수업계획을 짜야 합니다.

여기서 순서란 B과목은 C과목을 이수한 후에 들어야 하고, A과목은 C와 B를 이수한 후에 들어야 한다는 것입니다.

현수가 C, B, D, A, G, E로 수업계획을 짜면 제대로 된 설계이지만 C, G, E, A, D, B 순서로 짰다면 잘못 설계된 수업계획이 됩니다.

수업계획은 그 순서대로 앞에 수업이 이수되면 다음 수업을 시작한다는 것으로 해석합니다.

수업계획서상의 각 과목은 무조건 이수된다고 가정합니다.

필수과목순서가 주어지면 현수가 짠 N개의 수업설계가 잘된 것이면 "YES", 잘못된 것이면 "NO"를 출력하는 프로그램을 작성합니다.

**입력**

첫 줄에 한 줄에 필수과목의 순서가 주어집니다. 모든 과목은 영문 대문자입니다.

두 번 째 줄부터 현수가 짠 수업설계가 주어집니다.(수업설계의 길이는 30이하입니다)

**출력**

첫 줄에 수업설계가 잘된 것이면 "YES", 잘못된 것이면 "NO"를 출력합니다.

**예시 입력 1**

```
CBA
CBDAGE

```

**예시 출력 1**

```
YES
```

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

메디컬 병원 응급실에는 의사가 한 명밖에 없습니다.

응급실은 환자가 도착한 순서대로 진료를 합니다. 하지만 위험도가 높은 환자는 빨리 응급조치를 의사가 해야 합니다.

이런 문제를 보완하기 위해 응급실은 다음과 같은 방법으로 환자의 진료순서를 정합니다.

- 환자가 접수한 순서대로의 목록에서 제일 앞에 있는 환자목록을 꺼냅니다.
- 나머지 대기 목록에서 꺼낸 환자 보다 위험도가 높은 환자가 존재하면 대기목록 제일 뒤로 다시 넣습니다. 그렇지 않으면 진료를 받습니다.

즉 대기목록에 자기 보다 위험도가 높은 환자가 없을 때 자신이 진료를 받는 구조입니다.

현재 N명의 환자가 대기목록에 있습니다.

N명의 대기목록 순서의 환자 위험도가 주어지면, 대기목록상의 M번째 환자는 몇 번째로 진료를 받는지 출력하는 프로그램을 작성합니다.

대기목록상의 M번째는 대기목록의 제일 처음 환자를 0번째로 간주하여 표현한 것입니다.

**입력**

첫 줄에 자연수 N(5<=N<=100)과 M(0<=M<N) 주어집니다.

두 번째 줄에 접수한 순서대로 환자의 위험도(50<=위험도<=100)가 주어집니다.

위험도는 값이 높을 수록 더 위험하다는 뜻입니다. 같은 값의 위험도가 존재할 수 있습니다.

**출력**

M번째 환자의 몇 번째로 진료받는지 출력하세요.

**예시 입력 1**

```
5 2
60 50 70 80 90

```

**예시 출력 1**

```
3
```

**예시 입력 2**

```
6 3
70 60 90 60 60 60

```

**예시 출력 2**

```
4
```

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
