---
title: "프로그래머스 — 정렬"
tags: ["알고리즘","Java","정렬","프로그래머스","코딩테스트"]
summary: "정렬을 활용한 프로그래머스 문제 K번째 수와 가장 큰 수를 자바로 풀이하고 compareTo 동작 원리를 정리합니다."
---

오늘은 프로그래머스의 정렬 문제 중 K번째 수와 가장 큰 수를 자바로 풀이한 내용을 정리하도록 하겠습니다. 가장 큰 수 풀이에서 사용하는 `compareTo`의 동작도 함께 정리하겠습니다.

## 1. K번째 수

### 문제 설명

배열 array의 i번째 숫자부터 j번째 숫자까지 자르고 정렬했을 때, k번째에 있는 수를 구하려 합니다.

예를 들어 array가 [1, 5, 2, 6, 3, 7, 4], i = 2, j = 5, k = 3이라면

1. array의 2번째부터 5번째까지 자르면 [5, 2, 6, 3]입니다.
2. 1에서 나온 배열을 정렬하면 [2, 3, 5, 6]입니다.
3. 2에서 나온 배열의 3번째 숫자는 5입니다.

배열 array, [i, j, k]를 원소로 가진 2차원 배열 commands가 매개변수로 주어질 때, commands의 모든 원소에 대해 앞서 설명한 연산을 적용했을 때 나온 결과를 배열에 담아 return 하도록 solution 함수를 작성해주세요.

### 제한 사항

- array의 길이는 1 이상 100 이하입니다.
- array의 각 원소는 1 이상 100 이하입니다.
- commands의 길이는 1 이상 50 이하입니다.
- commands의 각 원소는 길이가 3입니다.

### 입출력 예 설명

[1, 5, 2, 6, 3, 7, 4]를 2번째부터 5번째까지 자른 후 정렬합니다. [2, 3, 5, 6]의 세 번째 숫자는 5입니다.

[1, 5, 2, 6, 3, 7, 4]를 4번째부터 4번째까지 자른 후 정렬합니다. [6]의 첫 번째 숫자는 6입니다.

[1, 5, 2, 6, 3, 7, 4]를 1번째부터 7번째까지 자릅니다. [1, 2, 3, 4, 5, 6, 7]의 세 번째 숫자는 3입니다.

### 문제 풀이

풀이 순서는 아래와 같습니다.

- commands의 원소를 하나씩 꺼내 1차원 배열로 받습니다.
- 꺼낸 배열에서 i, j, k 값을 추출합니다. 배열은 0부터 시작하므로 각각 1을 뺍니다.
- array에서 i번째부터 j번째까지의 값을 새 배열에 담아 정렬합니다.
- 정렬한 배열의 k번째 값을 answer 배열에 담습니다.

코드는 아래와 같습니다.

```java
import java.util.Arrays;
class Solution {
    public int[] solution(int[] array, int[][] commands) {
       int [] answer = new int[commands.length];
        for (int i = 0; i < commands.length; i++) {
            // command를 1차원 배열로 담는다.
            int [] arr = commands[i];
            
            // 배열은 0 부터 시작 임으로 -1을 해준다.
            int start = arr[0] - 1;
            int end = arr[1] - 1;
            int digit = arr[2] - 1;
            
            // start - end + 1 = 배열의 크기  
            int len = end - start + 1;
            
            // 0 부터 크기 만큼의 배열을 만들어준다.
            int [] temp;
            temp = new int[len];
            int count = 0;
            for (int j = start; j <= end; j++){
                temp[count] = array[j];
                count++;
            }
            
            // 배열을 정렬 한 다음
            Arrays.sort(temp);
            //digit의 값을 answer에 넣어준다.
            answer[i] = temp[digit];
        }
        return answer;
    }
}
```

## 2. 가장 큰 수

### 문제 설명

0 또는 양의 정수가 주어졌을 때, 정수를 이어 붙여 만들 수 있는 가장 큰 수를 알아내 주세요.

예를 들어, 주어진 정수가 [6, 10, 2]라면 [6102, 6210, 1062, 1026, 2610, 2106]를 만들 수 있고, 이중 가장 큰 수는 6210입니다.

0 또는 양의 정수가 담긴 배열 numbers가 매개변수로 주어질 때, 순서를 재배치하여 만들 수 있는 가장 큰 수를 문자열로 바꾸어 return 하도록 solution 함수를 작성해주세요.

### 제한 사항

- numbers의 길이는 1 이상 100,000 이하입니다.
- numbers의 원소는 0 이상 1,000 이하입니다.
- 정답이 너무 클 수 있으니 문자열로 바꾸어 return 합니다.

### 문제 풀이

풀이 순서는 아래와 같습니다.

- `int` 값을 `String`으로 변환합니다.
- 두 문자열을 서로 순서를 바꿔 이어 붙인 뒤, 그 결과를 `compareTo`로 비교해 정렬합니다.
- 0만 여러 개 있는 경우에는 0 하나를 리턴합니다.

### compareTo의 동작

정렬 기준으로 사용하는 `compareTo`가 어떤 값을 리턴하는지 먼저 확인해 보겠습니다.

```java
public class ComapreToEx{
	public static void main (String [] args) {
		String str = "abcd";

		System.out.println(str.compareTo("abcd")); // 동일 함으로 0
		System.out.println(str.compareTo("abc")); // 결과 : 1
		System.out.println(str.compareTo("a")); // 결과 : 3
		System.out.println(str.compareTo("c")); // 결과 : -2
	}
}
```

비교 대상 문자열이 기준 문자열의 앞부분과 같으면, `compareTo`는 두 문자열의 길이 차이를 리턴합니다.

- "abcd".compareTo("abcd") = 4 - 4 ⇒ 0으로 동일합니다.
- "abcd".compareTo("abc") = 4 - 3 ⇒ 1로 앞의 값이 더 큽니다.
- "abcd".compareTo("a") = 4 - 1 ⇒ 3으로 앞의 값이 더 큽니다.

`compareTo`는 앞에서부터 같은 위치의 문자를 차례로 비교하고, 처음으로 다른 문자가 나오면 두 문자의 코드 값 차이를 리턴합니다. 아래 예시는 맨 앞 글자부터 다르기 때문에 a와 c의 아스키 코드 값을 비교합니다.

- "abcd".compareTo("c") = a(아스키 코드) - c(아스키코드) ⇒ 97-99 = -2

### 해결 코드

위 동작을 이용해 `o2 + o1`과 `o1 + o2`를 비교하면, 이어 붙였을 때 더 큰 수가 되는 순서로 정렬됩니다. 코드는 아래와 같습니다.

```java
package com.company;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;

public class Main {
    static int[] numbers;
    static ArrayList<Integer> list = new ArrayList<>();

    public static void main(String[] args) {
        Main main = new Main();
        numbers = new int[]{3, 30, 601, 621 , 0 ,300, 301, 34, 5, 9};
        for (int i : numbers) {
            list.add(i);
        }
        System.out.println(main.solution());
    }

    public String solution() {
        String answer = "";
        ArrayList<String> strNumbers = new ArrayList();
        // int 형을 String 으로 변환한다.
        for(Integer num : numbers){
            strNumbers.add(String.valueOf(num));
        }

        // 문장의 숫자를 뒷 배열 + 앞 배열을 합친 것과 앞 배열 + 뒷 배열을 합친값을 비교
				// ex) 330.compareTo(303); ==> 3=19(아스키 코드)/ 0=16 (아스키 코드) => 결과: 3
				// 결과 값이 3(양수) 임으로 기준 값이 비교 대상 보다 크다.
        Collections.sort(strNumbers, new Comparator<String>() {
            @Override
            public int compare(String o1, String o2) {
                return (o2+o1).compareTo(o1+o2);

            }
        });
				
				// 시작이 0으로 연달아 나올 경우 0으로 리턴.
        if(strNumbers.get(0).startsWith("0")) return "0";
        for (String s : strNumbers) {
            answer+=s;
        }
        return answer;

    }

}
```

## 마무리

오늘은 프로그래머스의 정렬 문제인 K번째 수와 가장 큰 수를 풀이하고, 정렬 기준으로 사용한 `compareTo`의 동작에 대해 정리하였습니다.

참조 : [https://mine-it-record.tistory.com/133](https://mine-it-record.tistory.com/133)
