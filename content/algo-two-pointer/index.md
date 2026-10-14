---
title: "투 포인터와 슬라이딩 윈도우"
tags: ["알고리즘","Java","투포인터","슬라이딩윈도우","코딩테스트"]
summary: "투 포인터와 슬라이딩 윈도우 기법으로 배열 병합, 최대 매출, 연속 부분수열 등 문제 6개를 자바로 풀이합니다."
---

오늘은 투 포인터와 슬라이딩 윈도우로 풀 수 있는 문제들을 정리하도록 하겠습니다. 투 포인터는 배열 위에 두 개의 위치(포인터)를 두고 조건에 따라 한쪽씩 옮기면서 탐색하는 방법이고, 슬라이딩 윈도우는 일정한 길이의 구간을 한 칸씩 밀면서 빠지는 값과 들어오는 값만 반영해 계산하는 방법입니다. 두 방법 모두 이중 반복문 대신 배열을 한 번 훑는 것으로 답을 구할 수 있습니다.

## 1. 두 배열 합치기

오름차순으로 정렬된 두 배열이 주어지면 두 배열을 오름차순으로 합쳐 출력하는 문제입니다.

입력 조건은 아래와 같습니다.

- 첫 번째 줄에 첫 번째 배열의 크기 N(1<=N<=100)이 주어집니다.
- 두 번째 줄에 N개의 배열 원소가 오름차순으로 주어집니다.
- 세 번째 줄에 두 번째 배열의 크기 M(1<=M<=100)이 주어집니다.
- 네 번째 줄에 M개의 배열 원소가 오름차순으로 주어집니다.
- 각 리스트의 원소는 int형 변수의 크기를 넘지 않습니다.

예시 입력과 출력은 아래와 같습니다.

```text
3
1 3 5
5
2 3 6 7 9

```

```text
1 2 3 3 5 6 7 9
```

### 풀이

두 배열에 포인터 p1, p2를 하나씩 두고, 두 포인터가 가리키는 값 중 작은 값을 결과에 담은 뒤 그 포인터만 한 칸 옮깁니다. 한쪽 배열을 모두 담으면 다른 쪽 배열에 남은 원소를 차례로 붙입니다.

```java
package com.company.array;

import java.util.ArrayList;
import java.util.Scanner;

public class ArraySum {
    public static void main(String[] args) {
        ArraySum arraySum = new ArraySum();
        Scanner in = new Scanner(System.in);
        int array1Count = in.nextInt();
        int [] array1 = new int[array1Count];
        for (int i=0; i<array1Count; i++) {
            array1[i] = in.nextInt();
        }
        int array2Count = in.nextInt();
        int [] array2 = new int[array2Count];
        for (int i=0; i<array2Count; i++) {
            array2[i] = in.nextInt();
        }
        arraySum.solution(array1Count, array2Count, array1, array2);
    }

    void solution(int array1Count, int array2Count, int [] array1, int [] array2) {
        ArrayList<Integer> answer = new ArrayList<>();
        int p1 = 0, p2 = 0;

        while (p1<array1Count && p2<array2Count) {
            if (array1[p1] < array2[p2]) {
                answer.add(array1[p1]);
                p1++;
            } else {
                answer.add(array2[p2]);
                p2++;
            }
        }

        while(p1<array1Count) {
            answer.add(array1[p1]);
            p1++;
        }

        while(p2<array2Count) {
            answer.add(array2[p2]);
            p2++;
        }

        for (Integer integer : answer) {
            System.out.print(integer+" ");
        }

    }
}
```

## 2. 공통 원소 구하기

A, B 두 개의 집합이 주어지면 두 집합의 공통 원소를 추출하여 오름차순으로 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력
  - 첫 번째 줄에 집합 A의 크기 N(1<=N<=30,000)이 주어집니다.
  - 두 번째 줄에 N개의 원소가 주어집니다. 원소는 중복되어 주어지지 않습니다.
  - 세 번째 줄에 집합 B의 크기 M(1<=M<=30,000)이 주어집니다.
  - 네 번째 줄에 M개의 원소가 주어집니다. 원소는 중복되어 주어지지 않습니다.
  - 각 집합의 원소는 1,000,000,000 이하의 자연수입니다.
- 출력: 두 집합의 공통 원소를 오름차순 정렬하여 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
5
1 3 9 5 2
5
3 2 5 7 8

```

```text
2 3 5
```

### 풀이

두 배열을 먼저 오름차순으로 정렬합니다. 그다음 포인터 p1, p2가 가리키는 값이 같으면 결과에 담고 두 포인터를 모두 옮기고, 다르면 더 작은 값을 가리키는 포인터를 옮깁니다. 정렬된 상태에서 비교하므로 결과도 오름차순으로 담깁니다.

```java
package com.company.twopointer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Scanner;

public class FindCommonElements {
    public static void main(String [] args) {
        FindCommonElements findCommonElements = new FindCommonElements();
        Scanner in = new Scanner(System.in);
        int array1Count = in.nextInt();
        int [] array1 = new int[array1Count];
        for (int i=0; i<array1Count; i++) {
            array1[i] = in.nextInt();
        }
        int array2Count = in.nextInt();
        int [] array2 = new int[array2Count];
        for (int i=0; i<array2Count; i++) {
            array2[i] = in.nextInt();
        }

        findCommonElements.solution(array1Count, array2Count, array1, array2);
    }

    void solution(int array1Count, int array2Count, int [] array1, int [] array2) {
        ArrayList<Integer> answer = new ArrayList<>();
        int p1 = 0, p2 = 0;
        Arrays.sort(array1);
        Arrays.sort(array2);

        while(p1 < array1Count && p2 < array2Count) {
            if (array1[p1] == array2[p2]) {
                answer.add(array1[p1]);
                p1++;
                p2++;
            } else if (array1[p1] < array2[p2]) {
                p1++;
            } else {
                p2++;
            }
        }

        for (Integer integer : answer) {
            System.out.print(integer + " ");
        }

    }
}
```

## 3. 최대 매출

현수의 아빠는 제과점을 운영합니다. 현수 아빠는 현수에게 N일 동안의 매출 기록을 주고 연속된 K일 동안의 최대 매출액이 얼마인지 구하라고 했습니다.

만약 N=10이고 10일간의 매출 기록이 아래와 같다고 하겠습니다.

12 15 11 20 25 10 20 19 13 15

이때 K=3이면 연속된 3일간의 최대 매출액은 11+20+25=56만 원입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 N(5<=N<=100,000)과 K(2<=K<=N)가 주어집니다. 두 번째 줄에 N개의 숫자열이 주어집니다. 각 숫자는 500 이하의 음이 아닌 정수입니다.
- 출력: 첫 줄에 최대 매출액을 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
10 3
12 15 11 20 25 10 20 19 13 15

```

```text
56
```

### 풀이

슬라이딩 윈도우로 풀이하였습니다. 처음 K일의 매출 합을 구한 뒤, 구간을 한 칸씩 밀면서 빠지는 날의 매출(`sales[i-cnsctDays]`)을 빼고 새로 들어오는 날의 매출(`sales[i]`)을 더해 최댓값을 갱신합니다. 매번 K일을 다시 더하지 않아도 됩니다.

```java
package com.company.twopointer;

import java.util.Scanner;

public class MaximumSales {
    public static void main(String [] args) {
        MaximumSales maximumSales = new MaximumSales();
        Scanner in = new Scanner(System.in);
        int maxDay = in.nextInt();
        int cnsctDays = in.nextInt();
        int [] sales = new int[maxDay];
        for (int i=0; i<maxDay; i++) {
            sales[i] = in.nextInt();
        }
        maximumSales.solution(maxDay, cnsctDays, sales);
    }

    void solution(int maxDay, int cnsctDays, int [] sales) {
        int sum = 0;
        int answer = 0;
        // 초기값
        for (int i=0; i<cnsctDays; i++) {
            sum += sales[i];
        }

        for (int i=cnsctDays; i<maxDay; i++) {
            sum = sum - sales[i-cnsctDays] + sales[i];
            answer = Math.max(answer, sum);
        }
    }
}
```

## 4. 연속 부분수열

N개의 수로 이루어진 수열이 주어집니다. 이 수열에서 연속 부분수열의 합이 특정 숫자 M이 되는 경우가 몇 번 있는지 구하는 문제입니다.

만약 N=8, M=6이고 수열이 다음과 같다고 하겠습니다.

1 2 1 3 1 1 1 2

이때 합이 6이 되는 연속 부분수열은 {2, 1, 3}, {1, 3, 1, 1}, {3, 1, 1, 1}로 총 3가지입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫째 줄에 N(1≤N≤100,000), M(1≤M≤100,000,000)이 주어집니다. 수열의 원소값은 1,000을 넘지 않는 자연수입니다.
- 출력: 첫째 줄에 경우의 수를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
8 6
1 2 1 3 1 1 1 2

```

```text
3
```

### 풀이

구간의 왼쪽 끝 lt와 오른쪽 끝 rt를 두고, rt를 한 칸씩 늘리면서 구간 합 sum에 값을 더합니다. sum이 M과 같으면 경우의 수를 하나 늘리고, sum이 M 이상인 동안에는 lt 위치의 값을 빼면서 lt를 옮깁니다. 값을 뺀 뒤에도 sum이 M과 같으면 경우의 수를 늘립니다.

```java
package com.company.twopointer;

import java.util.Scanner;

public class ContinuousSubsequence {
    public static void main(String [] args) {
        ContinuousSubsequence continuousSubsequence = new ContinuousSubsequence();
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int m = in.nextInt();
        int [] numbers = new int[n];
        for (int i=0; i<n; i++) {
            numbers[i] = in.nextInt();
        }
        continuousSubsequence.solution(n, m, numbers);
    }

    void solution(int n, int m, int [] numbers) {
        int sum=0, lt=0;
        int count = 0;
        for (int rt=0; rt<n; rt++) {
           sum += numbers[rt];
           if (sum == m) {
               count++;
           }
           while (m<=sum) {
               sum -= numbers[lt];
               lt++;
               if (sum == m) {
                   count++;
               }
           }
        }
        System.out.println(count);
    }

}
```

## 5. 연속된 자연수의 합

양의 정수 N이 입력되면 2개 이상의 연속된 자연수의 합으로 정수 N을 표현하는 방법의 가짓수를 출력하는 문제입니다.

만약 N=15이면 아래와 같이 총 3가지의 경우가 존재합니다.

- 7+8=15
- 4+5+6=15
- 1+2+3+4+5=15

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 양의 정수 N(7<=N<1000)이 주어집니다.
- 출력: 첫 줄에 총 경우의 수를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
15
```

```text
3
```

### 풀이

2개 이상의 수를 더해야 하므로 N의 절반 정도까지의 수만 배열에 담고, 4번 문제와 같은 방식으로 lt와 rt를 옮기면서 합이 N이 되는 구간의 수를 셉니다.

```java
package com.company.twopointer;

import java.util.Scanner;

public class SumConsecutiveNumbers {
    public static void main(String [] args) {
        SumConsecutiveNumbers sumConsecutiveNumbers = new SumConsecutiveNumbers();
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int mok = n/2;
        int mod = n%2;
        int arrCount = mok+mod;
        int [] numbers = new int[arrCount];
        for (int i=0; i<arrCount; i++) {
            numbers[i] = i;
        }
        sumConsecutiveNumbers.solution(n, numbers, arrCount);
    }

    void solution(int n, int [] numbers,int count) {
        int sum = 0, lt = 0, answer = 0;

        for (int rt=0; rt<count; rt++)  {
            sum += numbers[rt];
            if (sum == n) {
                answer ++;
            }
            while (n<=sum) {
                sum -= numbers[lt];
                lt++;
                if (sum == n) {
                    answer ++;
                }
            }
        }
        System.out.println(answer);

    }
}
```

## 6. 최대 길이 연속부분수열

0과 1로 구성된 길이가 N인 수열이 주어집니다. 이 수열에서 최대 k번 0을 1로 변경할 수 있을 때, 최대 k번의 변경을 통해 1로만 구성된 최대 길이의 연속부분수열을 찾는 문제입니다.

만약 길이가 14인 다음과 같은 수열이 주어지고 k=2라고 하겠습니다.

1 1 0 0 1 1 0 1 1 0 1 1 0 1

이때 만들 수 있는, 1이 연속된 연속부분수열의 최대 길이는 8입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 수열의 길이인 자연수 N(5<=N<100,000)이 주어집니다. 두 번째 줄에 N 길이의 0과 1로 구성된 수열이 주어집니다.
- 출력: 첫 줄에 최대 길이를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
14 2
1 1 0 0 1 1 0 1 1 0 1 1 0 1

```

```text
8
```

### 풀이

rt를 한 칸씩 옮기면서 구간 안에서 1로 바꾼 0의 개수(kCount)를 셉니다. kCount가 k를 넘으면 lt를 옮기면서 구간에서 빠지는 0만큼 kCount를 줄입니다. 매번 구간의 길이 `rt-lt+1`과 지금까지의 최댓값을 비교해 답을 갱신합니다.

```java
package com.company.twopointer;

import java.util.Scanner;

public class MaximumSales {
    public static void main(String [] args) {
        MaximumSales maximumSales = new MaximumSales();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int k = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }
        maximumSales.solution(count, k, arr);
    }

    void solution(int count, int k, int [] arr) {
        int lt = 0;
        int kCount = 0;
        int answer = 0;

        for (int rt = 0; rt<count; rt++) {
            if (arr[rt] == 0) {
                kCount ++;
            }
            while (k < kCount) {
                if (arr[lt] == 0) {
                    kCount --;
                }
                lt++;
            }
            answer = Math.max(answer, rt-lt+1);
        }
        System.out.println(answer);
    }
}
```

## 마무리

오늘은 투 포인터와 슬라이딩 윈도우를 이용해 푸는 문제 6개를 정리하였습니다. 1, 2번처럼 정렬된 두 배열을 비교할 때는 배열마다 포인터를 두었고, 3번부터 6번까지처럼 연속된 구간을 다룰 때는 구간의 양 끝을 포인터로 두고 옮기면서 풀이하였습니다.
