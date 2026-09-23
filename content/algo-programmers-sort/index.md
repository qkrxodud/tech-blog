---
title: "프로그래머스 — 정렬"
tags: ["알고리즘","Java","정렬","프로그래머스","코딩테스트"]
summary: "정렬을 활용한 프로그래머스 문제 K번째 수와 가장 큰 수를 자바로 풀이하고 compareTo 동작 원리를 정리합니다."
---

## 1. K번째 수

**문제 설명**

배열 array의 i번째 숫자부터 j번째 숫자까지 자르고 정렬했을 때, k번째에 있는 수를 구하려 합니다.

예를 들어 array가 [1, 5, 2, 6, 3, 7, 4], i = 2, j = 5, k = 3이라면

1. array의 2번째부터 5번째까지 자르면 [5, 2, 6, 3]입니다.
2. 1에서 나온 배열을 정렬하면 [2, 3, 5, 6]입니다.
3. 2에서 나온 배열의 3번째 숫자는 5입니다.

배열 array, [i, j, k]를 원소로 가진 2차원 배열 commands가 매개변수로 주어질 때, commands의 모든 원소에 대해 앞서 설명한 연산을 적용했을 때 나온 결과를 배열에 담아 return 하도록 solution 함수를 작성해주세요.

**제한사항**

- array의 길이는 1 이상 100 이하입니다.
- array의 각 원소는 1 이상 100 이하입니다.
- commands의 길이는 1 이상 50 이하입니다.
- commands의 각 원소는 길이가 3입니다.

**입출력 예 설명**

[1, 5, 2, 6, 3, 7, 4]를 2번째부터 5번째까지 자른 후 정렬합니다. [2, 3, 5, 6]의 세 번째 숫자는 5입니다.

[1, 5, 2, 6, 3, 7, 4]를 4번째부터 4번째까지 자른 후 정렬합니다. [6]의 첫 번째 숫자는 6입니다.

[1, 5, 2, 6, 3, 7, 4]를 1번째부터 7번째까지 자릅니다. [1, 2, 3, 4, 5, 6, 7]의 세 번째 숫자는 3입니다.

**문제 풀이**

- 2차원 배열을 1차원 배열로 푼다.
- 1차원 배열로 j, k, i 값을 추출한 다음
- array에서 필요한 j에서 k값을 추출 한 후
- i에 해당하는 값을 answer 배열에 담는다.

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

**문제설명**

0 또는 양의 정수가 주어졌을 때, 정수를 이어 붙여 만들 수 있는 가장 큰 수를 알아내 주세요.

예를 들어, 주어진 정수가 [6, 10, 2]라면 [6102, 6210, 1062, 1026, 2610, 2106]를 만들 수 있고, 이중 가장 큰 수는 6210입니다.

0 또는 양의 정수가 담긴 배열 numbers가 매개변수로 주어질 때, 순서를 재배치하여 만들 수 있는 가장 큰 수를 문자열로 바꾸어 return 하도록 solution 함수를 작성해주세요.

**제한 사항**

- numbers의 길이는 1 이상 100,000 이하입니다.
- numbers의 원소는 0 이상 1,000 이하입니다.
- 정답이 너무 클 수 있으니 문자열로 바꾸어 return 합니다.

**문제 풀이**

- `int` 형을 `String`으로 변환합니다.
- String으로 변환된 값을 합친 후 `compareTo` 함수를 사용합니다.
- 0 만 여러개 있는 경우 하나의 0을 리턴해 준다.

**compareTo의 동작 설명**

```java
public Class ComapreToEx{
	public static void main (String [] args) {
		String str = "abcd";

		System.out.println(str.compareTo("abcd")) // 동일 함으로 0
		System.out.println(str.compareTo("abc")) // 결과 : 1
		System.out.println(str.compareTo("a")) // 결과 : 3
		System.out.println(str.compareTo("c")) // 결과 : -2
	}
}
```

`compareTo`는 기준값에 비교 대상이 있으면 서로의 문자열 길이의 차이값을 리턴해 줍니다.

- "abcd".compareTo("abcd") = 4 - 4 ⇒ 0으로 동일합니다.
- "abcd".compareTo("abc") = 4 - 3 ⇒ 1로 앞의 값이 더 큽니다.
- "abcd".compareTo("a") = 4 - 1 ⇒ 3으로 앞의 값이 더 큽니다.

`compareTo`는 같은 위치의 문자만 비교합니다. 맨 앞 글자가 다르기 때문에 아스키 값으로 비교 처리합니다.

- "abcd".compareTo("c") = a(아스키 코드) - c(아스키코드) ⇒ 97-99 = -2

**해결 코드**

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

참고 블로그: [https://mine-it-record.tistory.com/133](https://mine-it-record.tistory.com/133)
