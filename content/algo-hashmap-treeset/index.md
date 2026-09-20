---
title: "해시맵과 트리셋"
tags: ["알고리즘", "자바", "HashMap", "TreeSet", "코딩테스트"]
summary: "HashMap과 TreeSet을 활용해 투표 집계, 아나그램 판별, 슬라이딩 윈도우 매출 분석 등 문제 5개를 자바로 풀이합니다."
---

## 1. 학급 회장

학급 회장을 뽑는데 후보로 기호 A, B, C, D, E 후보가 등록을 했습니다.

투표용지에는 반 학생들이 자기가 선택한 후보의 기호(알파벳)가 쓰여져 있으며 선생님은 그 기호를 발표하고 있습니다.

선생님의 발표가 끝난 후 어떤 기호의 후보가 학급 회장이 되었는지 출력하는 프로그램을 작성합니다.

반드시 한 명의 학급회장이 선출되도록 투표결과가 나왔다고 가정합니다.

**입력**

첫 줄에는 반 학생수 N(5<=N<=50)이 주어집니다.

두 번째 줄에 N개의 투표용지에 쓰여져 있던 각 후보의 기호가 선생님이 발표한 순서대로 문자열로 입력됩니다.

**출력**

학급 회장으로 선택된 기호를 출력합니다.

**예시 입력 1**

```
15
BACBACCACCBDEDE

```

**예시 출력 1**

```
C
```

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

Anagram이란 두 문자열이 알파벳의 나열 순서는 다르지만 그 구성이 일치하면 두 단어는 아나그램이라고 합니다.

예를 들면 AbaAeCe와 baeeACA는 알파벳의 나열 순서는 다르지만 그 구성을 살펴보면 A(2), a(1), b(1), C(1), e(2)로 알파벳과 그 개수가 모두 일치합니다. 즉 어느 한 단어를 재배열하면 상대편 단어가 될 수 있는 것을 아나그램이라 합니다.

길이가 같은 두 개의 단어가 주어지면 두 단어가 아나그램인지 판별하는 프로그램을 작성합니다. 아나그램 판별시 대소문자가 구분됩니다.

**입력**

첫 줄에 첫 번째 단어가 입력되고, 두 번째 줄에 두 번째 단어가 입력됩니다.

단어의 길이는 100을 넘지 않습니다.

**출력**

두 단어가 아나그램이면 "YES"를 출력하고, 아니면 "NO"를 출력합니다.

**예시 입력 1**

```
AbaAeCe
baeeACA

```

**예시 출력 1**

```
YES
```

**예시 입력 2**

```
abaCC
Caaab

```

**예시 출력 2**

```
NO
```

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

현수의 아빠는 제과점을 운영합니다. 현수아빠는 현수에게 N일 동안의 매출기록을 주고 연속된 K일 동안의 매출액의 종류를 각 구간별로 구하라고 했습니다.

만약 N=7이고 7일 간의 매출기록이 아래와 같고, 이때 K=4이면

```
20 12 20 10 23 17 10
```

각 연속 4일간의 구간의 매출종류는 다음과 같습니다.

첫 번째 구간은 [20, 12, 20, 10]는 매출액의 종류가 20, 12, 10으로 3입니다.

두 번째 구간은 [12, 20, 10, 23]는 매출액의 종류가 4입니다.

세 번째 구간은 [20, 10, 23, 17]는 매출액의 종류가 4입니다.

네 번째 구간은 [10, 23, 17, 10]는 매출액의 종류가 3입니다.

N일간의 매출기록과 연속구간의 길이 K가 주어지면 첫 번째 구간부터 각 구간별 매출액의 종류를 출력하는 프로그램을 작성합니다.

**입력**

첫 줄에 N(5<=N<=100,000)과 K(2<=K<=N)가 주어집니다.

두 번째 줄에 N개의 숫자열이 주어집니다. 각 숫자는 500이하의 음이 아닌 정수입니다.

**출력**

첫 줄에 각 구간의 매출액 종류를 순서대로 출력합니다.

**예시 입력 1**

```
7 4
20 12 20 10 23 17 10
```

**예시 출력 1**

```
3 4 4 3
```

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

S문자열에서 T문자열과 아나그램이 되는 S의 부분문자열의 개수를 구하는 프로그램을 작성합니다.

아나그램 판별시 대소문자가 구분됩니다. 부분문자열은 연속된 문자열이어야 합니다.

**입력**

첫 줄에 첫 번째 S문자열이 입력되고, 두 번째 줄에 T문자열이 입력됩니다.

S문자열의 길이는 10,000을 넘지 않으며, T문자열은 S문자열보다 길이가 작거나 같습니다.

**출력**

S단어에 T문자열과 아나그램이 되는 부분문자열의 개수를 출력합니다.

**예시 입력 1**

```
bacaAacba
abc

```

**예시 출력 1**

```
3

```

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

## 5. K번째 큰수

현수는 1부터 100사이의 자연수가 적힌 N장의 카드를 가지고 있습니다. 같은 숫자의 카드가 여러장 있을 수 있습니다.

현수는 이 중 3장을 뽑아 각 카드에 적힌 수를 합한 값을 기록하려고 합니다. 3장을 뽑을 수 있는 모든 경우를 기록합니다.

기록한 값 중 K번째로 큰 수를 출력하는 프로그램을 작성합니다.

만약 큰 수부터 만들어진 수가 25 25 23 23 22 20 19......이고 K값이 3이라면 K번째 큰 값은 22입니다.

**입력**

첫 줄에 자연수 N(3<=N<=100)과 K(1<=K<=50) 입력되고, 그 다음 줄에 N개의 카드값이 입력됩니다.

**출력**

첫 줄에 K번째 수를 출력합니다. K번째 수가 존재하지 않으면 -1를 출력합니다.

**예시 입력 1**

```
10 3
13 15 34 23 45 65 33 11 26 42

```

**예시 출력 1**

```
143
```

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
