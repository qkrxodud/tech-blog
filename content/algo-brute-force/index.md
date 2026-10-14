---
title: "완전 탐색 문제 풀이"
tags: ["알고리즘","프로그래머스","코딩테스트","Java"]
summary: "프로그래머스 완전 탐색 문제 중 모의고사 문제를 풀이하며 접근 방법을 정리합니다."
---

오늘은 프로그래머스의 완전 탐색 문제 중 모의고사를 자바로 풀이한 내용을 정리하도록 하겠습니다.

## 모의고사

### 문제 설명

수포자는 수학을 포기한 사람의 준말입니다. 수포자 삼인방은 모의고사에 수학 문제를 전부 찍으려 합니다. 수포자는 1번 문제부터 마지막 문제까지 다음과 같이 찍습니다.

- 1번 수포자가 찍는 방식: 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, ...
- 2번 수포자가 찍는 방식: 2, 1, 2, 3, 2, 4, 2, 5, 2, 1, 2, 3, 2, 4, 2, 5, ...
- 3번 수포자가 찍는 방식: 3, 3, 1, 1, 2, 2, 4, 4, 5, 5, 3, 3, 1, 1, 2, 2, 4, 4, 5, 5, ...

1번 문제부터 마지막 문제까지의 정답이 순서대로 담긴 배열 answers가 주어졌을 때, 가장 많은 문제를 맞힌 사람이 누구인지 배열에 담아 return 하도록 solution 함수를 작성해주세요.

### 제한 조건

- 시험은 최대 10,000 문제로 구성되어있습니다.
- 문제의 정답은 1, 2, 3, 4, 5 중 하나입니다.
- 가장 높은 점수를 받은 사람이 여럿일 경우, return하는 값을 오름차순 정렬해 주세요.

### 입출력 예 설명

입출력 예 #1

- 수포자 1은 모든 문제를 맞혔습니다.
- 수포자 2는 모든 문제를 틀렸습니다.
- 수포자 3은 모든 문제를 틀렸습니다.

따라서 가장 문제를 많이 맞힌 사람은 수포자 1입니다.

입출력 예 #2

- 모든 사람이 2문제씩을 맞췄습니다.

### 문제 풀이

세 수포자의 답은 일정한 패턴이 반복되므로, 문제 번호를 패턴 길이로 나눈 나머지로 각 수포자가 찍은 답을 구할 수 있습니다. 풀이 순서는 아래와 같습니다.

1. 수포자별로 반복되는 패턴을 배열로 선언합니다.
2. answers의 각 문제마다 문제 번호를 패턴 길이로 나눈 나머지 위치의 값과 정답을 비교해 점수를 셉니다.
3. 세 사람 중 가장 큰 점수를 구합니다.
4. 가장 큰 점수와 각 수포자의 점수를 비교해, 같은 사람을 순서대로 결과에 담습니다.

코드는 아래와 같습니다.

```java
import java.util.ArrayList;
class Solution {
    public int[] solution(int[] answers) {
        int answerLen = answers.length;
        int [] answer;
        int [] pattern_1 = {1, 2, 3, 4, 5};
        int [] pattern_2 = {2, 1, 2, 3, 2, 4, 2, 5};
        int [] pattern_3 = {3, 3, 1, 1, 2, 2, 4, 4, 5, 5};

        int student_1 = 0, student_2 = 0, student_3 = 0;
        int maxGrade = 0;

        for (int i = 0; i < answerLen; i++) {
            if (pattern_1[i%5] == answers[i]) {
                student_1 ++;
            }

            if (pattern_2[i%8] == answers[i]) {
                student_2 ++;
            }

            if (pattern_3[i%10] == answers[i]) {
                student_3 ++;
            }
        }
        maxGrade = Math.max(student_1, Math.max(student_2, student_3));

        ArrayList<Integer> arrayList = new ArrayList<>();
        if (student_1 == maxGrade) arrayList.add(1);
        if (student_2 == maxGrade) arrayList.add(2);
        if (student_3 == maxGrade) arrayList.add(3);
        answer = new int[arrayList.size()];
        for ( int i = 0; i < arrayList.size(); i++) {
            answer[i] = arrayList.get(i);
        }
        return answer;
    }
}
```

## 마무리

오늘은 프로그래머스의 완전 탐색 문제인 모의고사를 수포자별 패턴과 나머지 연산으로 풀이한 내용에 대해 정리하였습니다.
