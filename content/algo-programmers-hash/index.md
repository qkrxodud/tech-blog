---
title: "프로그래머스 — 해시"
tags: ["알고리즘","Java","해시","HashMap","프로그래머스","코딩테스트"]
summary: "HashMap을 활용한 프로그래머스 문제 완주하지 못한 선수, 전화번호 목록, 위장을 자바로 풀이합니다."
---

## 1. 완주하지 못한 선수

**문제설명**

수많은 마라톤 선수들이 마라톤에 참여하였습니다. 단 한 명의 선수를 제외하고는 모든 선수가 마라톤을 완주하였습니다.

마라톤에 참여한 선수들의 이름이 담긴 배열 participant와 완주한 선수들의 이름이 담긴 배열 completion이 주어질 때, 완주하지 못한 선수의 이름을 return 하도록 solution 함수를 작성해주세요.

**제한사항**

- 마라톤 경기에 참여한 선수의 수는 1명 이상 100,000명 이하입니다.
- completion의 길이는 participant의 길이보다 1 작습니다.
- 참가자의 이름은 1개 이상 20개 이하의 알파벳 소문자로 이루어져 있습니다.
- 참가자 중에는 동명이인이 있을 수 있습니다.

**입출력 예 설명**

예제 #1 "leo"는 참여자 명단에는 있지만, 완주자 명단에는 없기 때문에 완주하지 못했습니다.

예제 #2 "vinko"는 참여자 명단에는 있지만, 완주자 명단에는 없기 때문에 완주하지 못했습니다.

예제 #3 "mislav"는 참여자 명단에는 두 명이 있지만, 완주자 명단에는 한 명밖에 없기 때문에 한명은 완주하지 못했습니다.

**해결방법**

1. 참여한 대상을 맵에 넣습니다. 넣을 때 초기값을 1로 설정합니다.
2. 완주한 대상을 맵에서 -1로 합칩니다.
3. 참여했는데 완주 못한 값 1을 출력합니다.

```java
import java.util.HashMap;
class Solution {
    public String solution(String[] participant, String[] completion) {
        String result = "";
        HashMap<String, Integer> map = new HashMap<>();
        //초기 값 셋팅
        for (int i = 0; i < participant.length; i++) {
            map.put(participant[i], map.getOrDefault(participant[i], 0)+1);
        }

        for (int i = 0; i < completion.length; i++) {
            map.put(completion[i], map.get(completion[i]) -1);
        }

        for (String s : map.keySet()) {
            if (map.get(s) == 1) {
                result = s;
            }
        }
        System.out.print(result);
        return result;
    }
}
```

## 2. 전화번호 목록

**문제 설명**

전화번호부에 적힌 전화번호 중, 한 번호가 다른 번호의 접두어인 경우가 있는지 확인하려 합니다. 전화번호가 다음과 같을 경우, 구조대 전화번호는 영석이의 전화번호의 접두사입니다.

- 구조대 : 119
- 박준영 : 97 674 223
- 지영석 : 11 9552 4421

전화번호부에 적힌 전화번호를 담은 배열 phone_book 이 solution 함수의 매개변수로 주어질 때, 어떤 번호가 다른 번호의 접두어인 경우가 있으면 false를 그렇지 않으면 true를 return 하도록 solution 함수를 작성해주세요.

**제한 사항**

- phone_book의 길이는 1 이상 1,000,000 이하입니다.
    - 각 전화번호의 길이는 1 이상 20 이하입니다.
    - 같은 전화번호가 중복해서 들어있지 않습니다.

**입출력 예 설명**

입출력 예 #1 앞에서 설명한 예와 같습니다.

입출력 예 #2 한 번호가 다른 번호의 접두사인 경우가 없으므로, 답은 true입니다.

입출력 예 #3 첫 번째 전화번호 "12"가 두 번째 전화번호 "123"의 접두사입니다. 따라서 답은 false입니다.

```java
import java.util.HashMap;
class Solution {
    public boolean solution(String[] phone_book) {
        HashMap<String, Integer> map = new HashMap<>();

        for (int i = 0; i < phone_book.length; i++) 
            map.put(phone_book[i], i);
        
        // i = 0 으로 119 라면
        // j = 0, 1, 2 순으로 for문을 돈다.
        // 이렇게 되면 (substring( 0,1), substring( 0,2) )로 119 => 11 조회
        // 27674223 => substring( 0,1, substring( 0,2), substring( 0,3) ... substring( 0,7)) 조회 하면서 map에 있는지 확인.
        for (int i = 0; i < phone_book.length; i++)
            for (int j = 0; j < phone_book[i].length(); j++)
                if (map.containsKey(phone_book[i].substring(0, j)))
                    return false;

        return true;

    }
}
```

## 3. 위장

**문제 설명**

스파이들은 매일 다른 옷을 조합하여 입어 자신을 위장합니다.

예를 들어 스파이가 오늘 동그란 안경, 긴 코트, 파란색 티셔츠를 입었다면 다음날은 청바지를 추가로 입거나 동그란 안경 대신 검정 선글라스를 착용하거나 해야 합니다.

스파이가 가진 의상들이 담긴 2차원 배열 clothes가 주어질 때 서로 다른 옷의 조합의 수를 return 하도록 solution 함수를 작성해주세요.

**제한 사항**

- clothes의 각 행은 [의상의 이름, 의상의 종류]로 이루어져 있습니다.
- 스파이가 가진 의상의 수는 1개 이상 30개 이하입니다.
- 같은 이름을 가진 의상은 존재하지 않습니다.
- clothes의 모든 원소는 문자열로 이루어져 있습니다.
- 모든 문자열의 길이는 1 이상 20 이하인 자연수이고 알파벳 소문자 또는 '_' 로만 이루어져 있습니다.
- 스파이는 하루에 최소 한 개의 의상은 입습니다.

**입출력 예 설명**

예제 #1

headgear에 해당하는 의상이 yellow_hat, green_turban이고 eyewear에 해당하는 의상이 blue_sunglasses이므로 아래와 같이 5개의 조합이 가능합니다.

```java
1. yellow_hat
2. blue_sunglasses
3. green_turban
4. yellow_hat + blue_sunglasses
5. green_turban + blue_sunglasses
```

예제 #2

face에 해당하는 의상이 crow_mask, blue_sunglasses, smoky_makeup이므로 아래와 같이 3개의 조합이 가능합니다.

```java
1. crow_mask
2. blue_sunglasses
3. smoky_makeup
```

**문제 풀이 방법**

1. 신체 부위 별로 옷 가지 수를 설정합니다.
2. 신체 부위 별로 옷의 경우의 수를 곱합니다. 이때 입지 않은 경우의 수도 추가해줍니다.
3. 모든 경우의 수에서 전부 입지 않은 경우의 수를 -1로 뺍니다.

```java
import java.util.HashMap;
class Solution {
    public int solution(String[][] clothes) {
        HashMap<String, Integer> map = new HashMap<>();
        
        // 신체 종류 별로 옷 가지수 셋팅
        for (String[] clothe : clothes) {
            map.put(clothe[1], map.getOrDefault(clothe[1], 0) +1);
        }

        int answer = 1;
        // 신체 종류 별로 옷의 경우의 수를 곱한다.
        for (String s : map.keySet()) {
            // +1 은 스파이가 입지 않은 경우를 추가로 한다.
            answer *= map.get(s) + 1;
        }
        // -1은 모든 경우의 수에서 1가지는 꼭 입어야 됨으로 모두 입지 않는 경우의 수를 뺀다.
        return answer-1;
    }
}
```
