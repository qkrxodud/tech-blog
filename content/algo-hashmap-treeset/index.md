---
title: "해시맵과 트리셋"
tags: ["알고리즘","Java","HashMap","TreeSet","코딩테스트"]
summary: "HashMap과 TreeSet을 활용해 투표 집계, 아나그램 판별, 슬라이딩 윈도우 매출 분석 등 문제 5개를 자바로 풀이합니다."
---

오늘은 HashMap과 TreeSet을 활용하는 코딩 테스트 문제를 풀이하도록 하겠습니다. 1번부터 4번까지는 HashMap에 값별 개수를 세어 두고 비교하는 문제이고, 5번은 TreeSet으로 중복을 없애고 정렬된 값에서 K번째 수를 찾는 문제입니다. 문제마다 조건과 예시를 먼저 정리하고, 자바로 작성한 풀이 코드를 이어서 적었습니다.

## 1. 학급 회장

학급 회장을 뽑는데 후보로 기호 A, B, C, D, E 후보가 등록을 했습니다. 투표용지에는 반 학생들이 자기가 선택한 후보의 기호(알파벳)가 쓰여 있으며, 선생님은 그 기호를 발표하고 있습니다.

선생님의 발표가 끝난 후 어떤 기호의 후보가 학급 회장이 되었는지 출력하는 문제입니다. 반드시 한 명의 학급 회장이 선출되도록 투표 결과가 나왔다고 가정합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에는 반 학생 수 N(5<=N<=50)이 주어집니다. 두 번째 줄에 N개의 투표용지에 쓰여 있던 각 후보의 기호가 선생님이 발표한 순서대로 문자열로 입력됩니다.
- 출력: 학급 회장으로 선택된 기호를 출력합니다.

예시 입력은 아래와 같습니다.

```text
15
BACBACCACCBDEDE

```

이때 출력은 아래와 같습니다.

```text
C
```

`getOrDefault()`로 기호별 득표 수를 HashMap에 세고, `keySet()`을 순회하면서 가장 많이 나온 기호를 찾았습니다.

```java
package com.company.hashmap;

import java.util.HashMap;
import java.util.Scanner;

public class ClassPresident {
    public static void main(String [] args) {
        ClassPresident classPresident = new ClassPresident();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        String str = "";
        str = in.next();
        classPresident.solution(count, str);
    }

    void solution(int count, String str) {
        int max = Integer.MIN_VALUE;
        char leader = 'N';
        char [] arr = str.toCharArray();

        HashMap<Character, Integer> vote = new HashMap<>();
        for (char c : arr) {
            vote.put(c, vote.getOrDefault(c, 0)+1);
        }

        for (Character character : vote.keySet()) {
            int value = vote.get(character);
            if (max<value) {
                leader = character;
                max = value;
            }
        }
        System.out.println(leader);
    }
}
```

## 2. 아나그램

Anagram(아나그램)은 두 문자열의 알파벳 나열 순서는 다르지만 그 구성이 일치하는 경우를 말합니다.

예를 들어 AbaAeCe와 baeeACA는 알파벳의 나열 순서는 다르지만, 그 구성을 살펴보면 A(2), a(1), b(1), C(1), e(2)로 알파벳과 그 개수가 모두 일치합니다. 즉 어느 한 단어를 재배열하면 상대편 단어가 될 수 있는 것을 아나그램이라 합니다.

길이가 같은 두 개의 단어가 주어지면 두 단어가 아나그램인지 판별하는 문제입니다. 아나그램을 판별할 때 대소문자를 구분합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 첫 번째 단어가 입력되고, 두 번째 줄에 두 번째 단어가 입력됩니다. 단어의 길이는 100을 넘지 않습니다.
- 출력: 두 단어가 아나그램이면 "YES"를 출력하고, 아니면 "NO"를 출력합니다.

첫 번째 예시 입력은 아래와 같습니다.

```text
AbaAeCe
baeeACA

```

이때 출력은 아래와 같습니다.

```text
YES
```

두 번째 예시 입력은 아래와 같습니다.

```text
abaCC
Caaab

```

이때 출력은 아래와 같습니다.

```text
NO
```

첫 번째 단어의 문자 개수를 HashMap에 더하고, 두 번째 단어의 문자 개수만큼 다시 빼서 0이 아닌 값이 남아 있으면 NO로 판단하였습니다. 아래 코드는 import 문을 빼고 클래스만 옮긴 것입니다.

```java
public class Anagram {
    public static void main(String [] args) {
        Anagram anagram = new Anagram();
        Scanner in = new Scanner(System.in);
        String str1 = in.next();
        String str2 = in.next();
        anagram.solution(str1, str2);
    }

    void solution(String str1, String str2) {
        HashMap<Character, Integer> map = new HashMap<>();
        String result = "YES";

        char[] arr1 = str1.toCharArray();

        for (char c : arr1) {
            map.put(c, map.getOrDefault(c,0)+1);
        }

        char[] arr2 = str2.toCharArray();
        for (char c : arr2) {
            map.put(c, map.get(c)-1);
        }

        for (Character character : map.keySet()) {
            if(map.get(character) != 0) {
                result = "NO";
            }
        }
        System.out.println(result);
    }
}
```

## 3. 매출액의 종류

현수의 아빠는 제과점을 운영합니다. 현수 아빠는 현수에게 N일 동안의 매출 기록을 주고, 연속된 K일 동안의 매출액의 종류를 각 구간별로 구하라고 했습니다.

만약 N=7이고 7일 간의 매출 기록이 아래와 같을 때 K=4이면,

```text
20 12 20 10 23 17 10
```

각 연속 4일간의 구간의 매출 종류는 다음과 같습니다.

- 첫 번째 구간 [20, 12, 20, 10]의 매출액 종류는 20, 12, 10으로 3입니다.
- 두 번째 구간 [12, 20, 10, 23]의 매출액 종류는 4입니다.
- 세 번째 구간 [20, 10, 23, 17]의 매출액 종류는 4입니다.
- 네 번째 구간 [10, 23, 17, 10]의 매출액 종류는 3입니다.

N일간의 매출 기록과 연속 구간의 길이 K가 주어지면, 첫 번째 구간부터 각 구간별 매출액의 종류를 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 N(5<=N<=100,000)과 K(2<=K<=N)가 주어집니다. 두 번째 줄에 N개의 숫자열이 주어지며, 각 숫자는 500 이하의 음이 아닌 정수입니다.
- 출력: 첫 줄에 각 구간의 매출액 종류를 순서대로 출력합니다.

예시 입력은 아래와 같습니다.

```text
7 4
20 12 20 10 23 17 10
```

이때 출력은 아래와 같습니다.

```text
3 4 4 3
```

처음 K-1일의 매출액을 HashMap에 미리 넣어 두고, `rt`를 한 칸씩 옮기면서 새 매출액을 더한 뒤 `map.size()`를 구간의 매출액 종류로 기록하였습니다. 그다음 `lt` 위치의 매출액 개수를 하나 줄이고, 0이 되면 HashMap에서 지워 다음 구간으로 넘어갑니다.

```java
package com.company.hashmap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Scanner;

public class SaleType {
    public static void main(String [] args) {
        SaleType saleType = new SaleType();

        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int k = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }

        saleType.solution(count, k, arr);
    }

    void solution(int count, int k, int [] arr) {
        ArrayList<Integer> answer = new ArrayList<>();
        for (Integer integer : answer) {

        }
        HashMap<Integer, Integer> map = new HashMap<>();
        for (int i=0; i<k-1; i++) {
            map.put(arr[i], map.getOrDefault(arr[i],0)+1);
        }

        int lt = 0;
        for (int rt=k-1; rt<count; rt++) {
            map.put(arr[rt], map.getOrDefault(arr[rt],0)+1);
            answer.add(map.size());
            map.put(arr[lt], map.getOrDefault(arr[lt],0)-1);
            int getLtval = map.get(arr[lt]);
            if (getLtval == 0) {
                map.remove(arr[lt]);
            }
            lt++;
        }

        for (Integer integer : answer) {
            System.out.println(integer);

        }
    }
}
```

## 4. 모든 아나그램 찾기

S 문자열에서 T 문자열과 아나그램이 되는 S의 부분 문자열의 개수를 구하는 문제입니다. 아나그램을 판별할 때 대소문자를 구분하며, 부분 문자열은 연속된 문자열이어야 합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 첫 번째 S 문자열이 입력되고, 두 번째 줄에 T 문자열이 입력됩니다. S 문자열의 길이는 10,000을 넘지 않으며, T 문자열은 S 문자열보다 길이가 작거나 같습니다.
- 출력: S 단어에서 T 문자열과 아나그램이 되는 부분 문자열의 개수를 출력합니다.

예시 입력은 아래와 같습니다.

```text
bacaAacba
abc

```

이때 출력은 아래와 같습니다.

```text
3

```

3번 문제와 같은 방식으로 T 문자열의 길이만큼 구간을 옮기면서, 구간의 문자 개수를 담은 HashMap이 T 문자열의 HashMap과 같으면(`equals()`) 개수를 하나 늘렸습니다.

```java
package com.company.hashmap;

import java.util.HashMap;
import java.util.Scanner;

public class SearchAllAnagram {
    public static void main(String [] args) {
        SearchAllAnagram searchAllAnagram = new SearchAllAnagram();
        Scanner in = new Scanner(System.in);
        String str1 = in.next();
        String str2 = in.next();
        searchAllAnagram.solution(str1, str2);
    }

    void solution(String str1 ,String str2) {
        int answer = 0;
        HashMap<Character, Integer> map = new HashMap<>();
        HashMap<Character, Integer> map2 = new HashMap<>();
        char [] arr1 = str1.toCharArray();
        char [] arr2 = str2.toCharArray();
        for (char c : arr2) {
            map2.put(c, map.getOrDefault(c, 0)+1);
        }

        for (int i=0; i<arr2.length-1; i++) {
            map.put(arr1[i], map.getOrDefault(arr1[i], 0)+1);
        }

        int lt = 0;
        for (int rt = arr2.length-1; rt<arr1.length; rt++) {
            map.put(arr1[rt], map.getOrDefault(arr1[rt], 0)+1);
            if (map.equals(map2)) {
                answer++;
            }
            map.put(arr1[lt], map.getOrDefault(arr1[lt], 0)-1);
            if (map.get(arr1[lt]) == 0) {
                map.remove(arr1[lt]);
            }
            lt++;
        }
        System.out.println(answer);
    }
}
```

이 코드는 예시 입력에서는 3을 출력하지만, S가 `aabab`, T가 `aab`처럼 T에 같은 문자가 두 번 이상 있으면 기대값 2(`aab`, `aba`) 대신 0을 출력합니다. T의 개수를 셀 때 `map2.put(c, map.getOrDefault(c, 0)+1)`로 비어 있는 `map`의 값을 읽어 모든 문자의 개수가 1로 담기기 때문이며, `map2.getOrDefault(c, 0)`을 읽어야 합니다.

## 5. K번째 큰수

현수는 1부터 100 사이의 자연수가 적힌 N장의 카드를 가지고 있습니다. 같은 숫자의 카드가 여러 장 있을 수 있습니다.

현수는 이 중 3장을 뽑아 각 카드에 적힌 수를 합한 값을 기록하려고 합니다. 3장을 뽑을 수 있는 모든 경우를 기록하고, 기록한 값 중 K번째로 큰 수를 출력하는 문제입니다.

만약 큰 수부터 만들어진 수가 25 25 23 23 22 20 19……이고 K 값이 3이라면 K번째 큰 값은 22입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 자연수 N(3<=N<=100)과 K(1<=K<=50)가 입력되고, 그다음 줄에 N개의 카드 값이 입력됩니다.
- 출력: 첫 줄에 K번째 수를 출력합니다. K번째 수가 존재하지 않으면 -1을 출력합니다.

예시 입력은 아래와 같습니다.

```text
10 3
13 15 34 23 45 65 33 11 26 42

```

이때 출력은 아래와 같습니다.

```text
143
```

삼중 반복문으로 세 장을 뽑는 모든 합을 `Comparator.reverseOrder()`로 만든 TreeSet에 넣었습니다. TreeSet은 같은 값을 한 번만 저장하고 내림차순으로 정렬해 두기 때문에, 앞에서부터 K번째 값을 꺼내면 답이 됩니다.

```java
package com.company.hashmap;

import java.util.Comparator;
import java.util.Scanner;
import java.util.TreeSet;

public class LargestNumber {
    public static void main(String [] args) {
        LargestNumber largestNumber = new LargestNumber();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int k = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }

        largestNumber.solution(count, k, arr);
    }

    void solution(int count, int k, int [] arr) {
        int answer = -1;
        int numberCount = 0;
        TreeSet<Integer> tSet = new TreeSet<>(Comparator.reverseOrder());
        for (int i=0; i<count; i++) {
            for (int j=i+1; j<count; j++) {
                for (int l=j+1; l<count; l++) {
                    tSet.add(arr[i] + arr[j] + arr[l]);
                }
            }
        }
        for (Integer integer : tSet) {
            numberCount++;
            if (numberCount == k) {
                answer = integer;
            }
        }
        System.out.println(answer);
    }
}
```

## 마무리

오늘은 HashMap과 TreeSet을 활용하는 코딩 테스트 문제 5개를 풀이하였습니다. 1번부터 4번까지는 HashMap에 문자나 숫자별 개수를 세어 비교하였고, 그중 3번과 4번은 `lt`, `rt`로 구간을 한 칸씩 옮기면서 HashMap을 갱신하였습니다. 5번은 TreeSet이 중복을 없애고 정렬된 상태를 유지하는 점을 이용해 K번째 큰 수를 구하였습니다.
