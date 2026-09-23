---
title: "배열 — 1차원과 2차원"
tags: ["알고리즘","Java","배열","코딩테스트","자료구조"]
summary: "1차원·2차원 배열을 활용해 정렬, 소수 판별, 격자 탐색 등 코딩 테스트 기본 문제 8개를 자바로 풀이합니다."
---

## 1. 큰 수 출력하기

N개의 정수를 입력받아, 자신의 바로 앞 수보다 큰 수만 출력하는 프로그램을 작성합니다.

(첫 번째 수는 무조건 출력합니다.)

**입력**

첫 줄에 자연수 N(1<=N<=100)이 주어지고, 그 다음 줄에 N개의 정수가 입력됩니다.

**출력**

자신의 바로 앞 수보다 큰 수만 한 줄로 출력합니다.

**예시 입력 1**

```
6
7 3 9 5 6 12

```

**예시 출력 1**

```
7 9 6 12
```

```java
package com.company.array;

import java.util.ArrayList;
import java.util.Scanner;

public class PrintBigNumber {
    public static void main(String [] ars) {
        PrintBigNumber printBigNumber = new PrintBigNumber();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] numbers = new int[count];

        for (int i = 0; i < count; i++) {
            numbers[i] = in.nextInt();
        }

        System.out.println(printBigNumber.solution(numbers));
    }

    private ArrayList<Integer> solution(int [] numbers) {
        ArrayList<Integer> result = new ArrayList<>();
        result.add(numbers[0]);

        for (int i=1; i<numbers.length; i++) {
            if (numbers[i-1] < numbers[i]) {
                result.add(numbers[i]);
            }
        }
        return result;
    }
}
```

## 2. 보이는 학생

선생님이 N명의 학생을 일렬로 세웠습니다. 일렬로 서 있는 학생의 키가 앞에서부터 순서대로 주어질 때, 맨 앞에 서 있는 선생님이 볼 수 있는 학생의 수를 구하는 프로그램을 작성합니다. (앞에 서 있는 사람들보다 크면 보이고, 작거나 같으면 보이지 않습니다.)

**입력**

첫 줄에 정수 N(5<=N<=100,000)이 입력됩니다. 그 다음 줄에 N명의 학생의 키가 앞에서부터 순서대로 주어집니다.

**출력**

선생님이 볼 수 있는 최대 학생 수를 출력합니다.

**예시 입력 1**

```
8
130 135 148 140 145 150 150 153

```

**예시 출력 1**

```
5
```

```java
package com.company.array;

import java.util.Scanner;

public class SeeStudents {
    public static void main(String [] ars) {
        SeeStudents seeStudents = new SeeStudents();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] numbers = new int[count];

        for (int i = 0; i < count; i++) {
            numbers[i] = in.nextInt();
        }

        seeStudents.solution(numbers);
    }

    private void solution(int [] numbers) {
        int count = 0;
        int temp = 0;
        for (int number : numbers) {
            if (temp < number) {
                temp = number;
                count ++;
            }
        }
        System.out.println(count);
    }
}
```

## 3. 가위바위보

A, B 두 사람이 가위바위보 게임을 합니다. 총 N번의 게임을 하여 A가 이기면 A를 출력하고, B가 이기면 B를 출력합니다. 비길 경우에는 D를 출력합니다.

가위, 바위, 보의 정보는 1은 가위, 2는 바위, 3은 보로 정합니다.

두 사람의 각 회의 가위, 바위, 보 정보가 주어지면 각 회를 누가 이겼는지 출력하는 프로그램을 작성합니다.

**입력**

첫 번째 줄에 게임 횟수인 자연수 N(1<=N<=100)이 주어집니다.

두 번째 줄에는 A가 낸 가위, 바위, 보 정보가 N개 주어집니다.

세 번째 줄에는 B가 낸 가위, 바위, 보 정보가 N개 주어집니다.

**출력**

각 줄에 각 회의 승자를 출력합니다. 비겼을 경우는 D를 출력합니다.

**예시 입력 1**

```
5
2 3 3 1 3
1 1 2 2 3

```

**예시 출력 1**

```
A
B
A
B
D
```

```java
package com.company.array;

import java.util.Scanner;

public class RockPaperScissors {

    public static void main(String [] args) {
        RockPaperScissors rockPaperScissors = new RockPaperScissors();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] numbersA = rockPaperScissors.initData(in, count);
        int [] numbersB = rockPaperScissors.initData(in, count);

        rockPaperScissors.solution(numbersA, numbersB, count);
    }

    int[] initData(Scanner in, int count) {
        int [] numbers = new int[count];

        for (int i=0; i<count; i++) {
            numbers[i] = in.nextInt();
        }
        return numbers;
    }

    void solution(int [] numbersA, int [] numbersB, int count) {
        char result;
        for (int i = 0; i < count; i++) {
            if (numbersA[i] == numbersB[i]) {
                result = 'D';
            } else if (numbersA[i] == 1 && numbersB[i] == 2) {
                result = 'B';

            } else if (numbersA[i] == 2 && numbersB[i] == 3) {
                result = 'B';

            } else if (numbersA[i] == 3 && numbersB[i] == 1) {
                result = 'B';
            } else {
                result = 'A';
            }
            System.out.println(result);
        }
    }
}
```

## 4. 피보나치 수열

피보나치 수열을 출력합니다. 피보나치 수열이란 앞의 2개의 수를 합하여 다음 숫자가 되는 수열입니다.

입력은 피보나치 수열의 총 항의 수입니다. 만약 7이 입력되면 1 1 2 3 5 8 13을 출력하면 됩니다.

**입력**

첫 줄에 총 항수 N(3<=N<=45)이 입력됩니다.

**출력**

첫 줄에 피보나치 수열을 출력합니다.

**예시 입력 1**

```
10
```

**예시 출력 1**

```
1 1 2 3 5 8 13 21 34 55
```

```java
package com.company.array;

import java.util.ArrayList;
import java.util.Scanner;

public class FibonacciNumbers {
    public static void main(String [] ars) {
        FibonacciNumbers fibonacciNumbers = new FibonacciNumbers();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        fibonacciNumbers.solution(count);
    }

    private void solution(int count) {
        ArrayList<Integer> result = new ArrayList<>();
        int [] arr = new int[count];
        arr[0] = 1;
        arr[1] = 1;
        for (int i = 2; i < count; i++) {
            arr[i] = arr[i-2] + arr[i-1];
        }
        for (int i : arr) {
            System.out.println(i + " ");
        }
    }
}
```

## 5. 소수 개수

자연수 N이 입력되면 1부터 N까지의 소수의 개수를 출력하는 프로그램을 작성합니다.

만약 20이 입력되면 1부터 20까지의 소수는 2, 3, 5, 7, 11, 13, 17, 19로 총 8개입니다.

**입력**

첫 줄에 자연수의 개수 N(2<=N<=200,000)이 주어집니다.

**출력**

첫 줄에 소수의 개수를 출력합니다.

**예시 입력 1**

```
20
```

**예시 출력 1**

```
8
```

```java
package com.company.array;

import java.util.Scanner;

public class DecimalCount {
    public static void main(String [] ars) {
        DecimalCount decimalCount = new DecimalCount();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        decimalCount.solution(count);
    }

    private void solution(int count) {
        int decimalCount = 0;
        int [] ch = new int[count+1];
        for (int i=2; i<=count; i++) {
            if(ch[i] == 0) {
                decimalCount++;
                for(int j=i; j<=count; j=j+i) {
                    ch[j] = 1;
                }
            }
        }
        System.out.println(decimalCount);
    }
}
```

## 6. 뒤집은 소수

N개의 자연수가 입력되면 각 자연수를 뒤집은 후 그 뒤집은 수가 소수이면 그 소수를 출력하는 프로그램을 작성합니다.

예를 들어 32를 뒤집으면 23이고, 23은 소수입니다. 그러면 23을 출력합니다. 단 910을 뒤집으면 19로 숫자화해야 합니다.

첫 자리부터의 연속된 0은 무시합니다.

**입력**

첫 줄에 자연수의 개수 N(3<=N<=100)이 주어지고, 그 다음 줄에 N개의 자연수가 주어집니다.

각 자연수의 크기는 100,000를 넘지 않습니다.

**출력**

첫 줄에 뒤집은 소수를 출력합니다. 출력순서는 입력된 순서대로 출력합니다.

**예시 입력 1**

```
9
32 55 62 20 250 370 200 30 100

```

**예시 출력 1**

```
23 2 73 2 3
```

```java
public static void main(String [] ars) {
        DecimalCount decimalCount = new DecimalCount();
        Scanner in = new Scanner(System.in);

        int count = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }
        decimalCount.solution(count, arr);
    }

    private void solution(int count, int[] arr) {
        ArrayList<Integer> answer = new ArrayList<>();
        for (int i : arr) {
            int temp = i;
            int res = 0;
            while (temp>0) {
                int t = temp%10;
                res = res*10 + t;
                temp = temp/10;
            }
            if (isPrime(res)) {
                answer.add(res);
            }
        }
        for (Integer integer : answer) {
            System.out.println(integer + " ");
        }
    }

    private boolean isPrime(int res) {
        if (res == 1) return false;
        for (int i=2; i<res; i++) {
            if (res%i == 0) {
                return false;
            }
        }
        return true;
    }
```

## 7. 격자판 최대합

5*5 격자판에 숫자가 적혀 있다고 가정합니다.

N*N의 격자판이 주어지면 각 행의 합, 각 열의 합, 두 대각선의 합 중 가장 큰 합을 출력합니다.

**입력**

첫 줄에 자연수 N이 주어집니다.(2<=N<=50)

두 번째 줄부터 N줄에 걸쳐 각 줄에 N개의 자연수가 주어집니다. 각 자연수는 100을 넘지 않는다.

**출력**

최대합을 출력합니다.

**예시 입력 1**

```
5
10 13 10 12 15
12 39 30 23 11
11 25 50 53 15
19 27 29 37 27
19 13 30 13 19

```

**예시 출력 1**

```
155
```

```java
package com.company.array;

import java.util.Scanner;

public class SumGreatest {

    public static void main(String [] ars) {
        SumGreatest sumGreatest = new SumGreatest();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [][] arr = new int[count][count];
        for (int i=0; i< count; i++) {
            for (int j=0; j< count; j++) {
                arr[i][j] = in.nextInt();
            }
        }
        sumGreatest.solution(count, arr);
    }

    private void solution(int count, int [][] arr) {
        int answer = Integer.MIN_VALUE;
        int sum1, sum2;
        for (int i=0; i<count; i++) {
            sum1 = 0;
            sum2 = 0;
            for (int j=0; j<count; j++) {
                sum1 += arr[i][j];
                sum2 += arr[j][i];
            }
            answer=Math.max(answer, sum1);
            answer=Math.max(answer, sum2);
        }
        sum1 = 0;
        sum2 = 0;
        for (int i=0; i<count; i++) {
            sum1 += arr[i][i];
        }
        for (int i=0; i<count; i++) {
            sum2 += arr[i][count-i-1];
        }
        answer=Math.max(answer, sum1);
        answer=Math.max(answer, sum2);
        System.out.println(answer);
    }

}
```

## 8. 봉우리

지도 정보가 N*N 격자판에 주어집니다. 각 격자에는 그 지역의 높이가 쓰여 있습니다.

각 격자판의 숫자 중 자신의 상하좌우 숫자보다 큰 숫자는 봉우리 지역입니다. 봉우리 지역이 몇 개 있는지 알아내는 프로그램을 작성합니다.

격자의 가장자리는 0으로 초기화되었다고 가정합니다.

만약 N=5이고, 아래 예시와 같은 격자판이 주어지면 봉우리의 개수는 10개입니다.

**입력**

첫 줄에 자연수 N이 주어집니다.(2<=N<=50)

두 번째 줄부터 N줄에 걸쳐 각 줄에 N개의 자연수가 주어집니다. 각 자연수는 100을 넘지 않는다.

**출력**

봉우리의 개수를 출력하세요.

**예시 입력 1**

```
5
5 3 7 2 3
3 7 1 6 1
7 2 5 3 4
4 3 6 4 1
8 7 3 5 2

```

**예시 출력 1**

```
10
```

```java
package com.company.array;

import java.util.Scanner;

public class Peaks {
    public static void main(String [] ars) {
        Peaks peaks = new Peaks();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [][] arr = new int[count][count];
        for (int i=0; i<count; i++) {
            for (int j=0; j<count; j++) {
                arr[i][j] = in.nextInt();
            }
        }
        peaks.solution(count, arr);
    }

    private void solution(int count, int [][] arr) {
        int answer = 0;
        int [] dx = {-1,0,1,0};
        int [] dy = {0,1,0,-1};

        for (int i=0; i<count; i++) {
            for (int j=0; j<count; j++) {
                boolean flag = true;

                for (int k=0; k<4; k++) {
                    int nx = i+dx[k];
                    int ny = j+dy[k];
                    if (nx>=0 && nx<count && ny>=0 && ny<count && arr[i][j] <= arr[nx][ny]) {
                        flag = false;
                        break;
                    }
                }
                if (flag == true) answer++;

            }
        }
        System.out.println(answer);
    }
}
```
