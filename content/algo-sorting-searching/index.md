---
title: "정렬과 이분 탐색"
tags: ["알고리즘","Java","정렬","이분탐색","코딩테스트"]
summary: "선택·버블·삽입 정렬, LRU 캐시, 이분 탐색 기반 결정 알고리즘까지 코딩 테스트 문제 5개를 자바로 풀이합니다."
---

오늘은 정렬과 이분 탐색을 활용하는 코딩 테스트 문제를 풀이하도록 하겠습니다. 1번부터 3번까지는 같은 입력을 선택 정렬, 버블 정렬, 삽입 정렬로 정렬하는 문제이고, 4번은 LRU 알고리즘으로 캐시 상태를 구하는 문제, 5번은 이분 검색으로 답을 정하는 결정 알고리즘 문제입니다. 문제마다 조건과 예시를 먼저 정리하고, 자바로 작성한 풀이 코드를 이어서 적었습니다.

## 1. 선택 정렬

N개의 숫자가 입력되면 오름차순으로 정렬하여 출력하는 문제입니다. 정렬하는 방법은 선택 정렬입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 자연수 N(1<=N<=100)이 주어집니다. 두 번째 줄에 N개의 자연수가 공백을 사이에 두고 입력되며, 각 자연수는 정수형 범위 안에 있습니다.
- 출력: 오름차순으로 정렬된 수열을 출력합니다.

예시 입력은 아래와 같습니다.

```text
6
13 5 11 7 23 15

```

이때 출력은 아래와 같습니다.

```text
5 7 11 13 15 23
```

선택 정렬은 `i`번째 자리부터 끝까지 중 가장 작은 값의 위치(`index`)를 찾아 `i`번째 값과 바꾸는 방식입니다.

```java
package com.company.sortingandsearching;

import java.util.Scanner;

public class SelectionSort {
    public static void main (String [] args) {
        SelectionSort selectionSort = new SelectionSort();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }

        selectionSort.solution(count, arr);
    }

    void solution(int count, int [] arr) {
        int temp;

        for (int i=0; i<count; i++) {
            int index = i;
            for (int j=i+1; j<count; j++) {
                if(arr[j] < arr[index]) {
                    index = j;
                }
                temp = arr[i];
                arr[i] = arr[index];
                arr[index] = temp;
            }
        }
        for (int i : arr) {
            System.out.println(i);
        }
    }
}
```

이 코드는 예시 입력은 정렬하지만, `11 2 49`를 넣으면 2, 11, 49가 아니라 11, 2, 49 순서 그대로 출력됩니다. 값을 바꾸는 코드가 안쪽 for문 안에 있어 가장 작은 값을 다 찾기 전에 교환이 일어나기 때문이며, 교환을 안쪽 for문이 끝난 뒤로 옮기면 됩니다.

## 2. 버블 정렬

N개의 숫자가 입력되면 오름차순으로 정렬하여 출력하는 문제입니다. 정렬하는 방법은 버블 정렬입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 자연수 N(1<=N<=100)이 주어집니다. 두 번째 줄에 N개의 자연수가 공백을 사이에 두고 입력되며, 각 자연수는 정수형 범위 안에 있습니다.
- 출력: 오름차순으로 정렬된 수열을 출력합니다.

예시 입력은 아래와 같습니다.

```text
6
13 5 11 7 23 15

```

이때 출력은 아래와 같습니다.

```text
5 7 11 13 15 23
```

이웃한 두 값을 비교해 앞의 값이 더 크면 자리를 바꾸었습니다. 한 바퀴를 돌 때마다 가장 큰 값이 뒤로 가기 때문에, 안쪽 반복문은 `count-i-1`까지만 돕니다.

```java
package com.company.sortingandsearching;

import java.util.Scanner;

public class BubbleSort {
    public static void main (String [] args) {
        BubbleSort bubbleSort = new BubbleSort();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }

        bubbleSort.solution(count, arr);
    }

    void solution(int count, int [] arr) {
        for (int i=0; i<count-1; i++) {
            for (int j=0; j<count-i-1; j++) {
                if (arr[j] > arr[j+1]) {
                    int temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                }
            }
        }
        for (int i : arr) {
            System.out.println(i);
        }

    }
}
```

## 3. 삽입 정렬

N개의 숫자가 입력되면 오름차순으로 정렬하여 출력하는 문제입니다. 정렬하는 방법은 삽입 정렬입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 자연수 N(1<=N<=100)이 주어집니다. 두 번째 줄에 N개의 자연수가 공백을 사이에 두고 입력되며, 각 자연수는 정수형 범위 안에 있습니다.
- 출력: 오름차순으로 정렬된 수열을 출력합니다.

예시 입력은 아래와 같습니다.

```text
6
11 7 5 6 10 9

```

이때 출력은 아래와 같습니다.

```text
5 6 7 9 10 11
```

`i`번째 값을 `temp`에 담고, 앞쪽에서 `temp`보다 큰 값을 한 칸씩 뒤로 민 다음 빈자리에 `temp`를 넣었습니다.

```java
package com.company.sortingandsearching;

import java.util.Scanner;

public class InsertSort {
    public static void main (String [] args) {
        InsertSort insertSort = new InsertSort();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int [] arr = new int[count];
        for (int i=0; i<count; i++) {
            arr[i] = in.nextInt();
        }

        insertSort.solution(count, arr);
    }

    void solution(int count, int [] arr) {
        for (int i=1; i<count; i++) {
            int temp = arr[i],j;
            for (j=i-1; j>=0; j--) {
                if (temp < arr[j]) {
                    arr[j+1] = arr[j];
                } else {
                    break;
                }
            }
             arr[j+1] = temp;
        }
        for (int i : arr) {
            System.out.print(i);
        }
    }

}

```

## 4. Least Recently Used

캐시 메모리는 CPU와 주기억장치(DRAM) 사이의 고속 임시 메모리로서, CPU가 처리할 작업을 저장해 놓았다가 필요할 때 바로 사용해서 처리 속도를 높이는 장치입니다. 워낙 비싸고 용량이 작아 효율적으로 사용해야 합니다.

철수의 컴퓨터는 캐시 메모리 사용 규칙이 LRU 알고리즘을 따릅니다. LRU 알고리즘은 Least Recently Used의 약자로, 직역하자면 가장 최근에 사용되지 않은 것 정도의 의미를 가지고 있습니다. 캐시에서 작업을 제거할 때 가장 오랫동안 사용하지 않은 것을 제거하겠다는 알고리즘입니다.

캐시의 크기가 주어지고 캐시가 비어 있는 상태에서 N개의 작업을 CPU가 차례로 처리한다면, N개의 작업을 처리한 후 캐시 메모리의 상태를 가장 최근 사용된 작업부터 차례대로 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 캐시의 크기인 S(3<=S<=10)와 작업의 개수 N(5<=N<=1,000)이 입력됩니다. 두 번째 줄에 N개의 작업 번호가 처리 순으로 주어지며, 작업 번호는 1~100입니다.
- 출력: 마지막 작업 후 캐시 메모리의 상태를 가장 최근 사용된 작업부터 차례로 출력합니다.

예시 입력은 아래와 같습니다.

```text
5 9
1 2 3 2 6 2 3 5 7

```

이때 출력은 아래와 같습니다.

```text
7 5 3 2 6
```

작업이 캐시에 있는지 먼저 찾아 위치를 `pos`에 담았습니다. 캐시에 없으면(`pos == -1`) 맨 뒤부터 한 칸씩 뒤로 밀어 가장 오래된 작업을 밀어내고, 캐시에 있으면 그 위치까지만 뒤로 민 다음, 두 경우 모두 맨 앞에 현재 작업을 넣었습니다.

```java
package com.company.sortingandsearching;

import java.util.Scanner;

public class LeastRecentlyUsed {
    public static void main (String [] args) {
        LeastRecentlyUsed leastRecentlyUsed = new LeastRecentlyUsed();
        Scanner in = new Scanner(System.in);

        int cashMemoryCount = in.nextInt();
        int [] cashMemory = new int[cashMemoryCount];

        int inputDataCount = in.nextInt();
        int [] inputData = new int[inputDataCount];

        for (int i=0; i<inputDataCount; i++) {
            inputData[i] = in.nextInt();
        }

        leastRecentlyUsed.solution(cashMemoryCount, cashMemory, inputDataCount, inputData);
    }

    void solution(int cashMemoryCount, int [] cashMemory, int inputDataCount, int [] inputData) {
        for (int i=0; i<inputDataCount; i++) {
            int pos = -1;
            for (int j=0; j<cashMemoryCount; j++) {
                if (inputData[i] == cashMemory[j]) pos = j;
            }

            if (pos == -1) {
                for(int j=cashMemoryCount-1; j>=1; j--) {
                    cashMemory[j] = cashMemory[j-1];
                }
                cashMemory[0] = inputData[i];
            } else {
                for(int j=pos; j>=1; j--) {
                    cashMemory[j] = cashMemory[j-1];
                }
                cashMemory[0] = inputData[i];
            }
        }
        for (int i1 : cashMemory) {
            System.out.println(i1);
        }

    }
}
```

## 5. 이분 검색 — 뮤직비디오(결정 알고리즘)

지니레코드에서는 불세출의 가수 조영필의 라이브 동영상을 DVD로 만들어 판매하려 합니다. DVD에는 총 N개의 곡이 들어가는데, DVD에 녹화할 때에는 라이브에서의 순서가 그대로 유지되어야 합니다.

가수 조영필 씨는 순서가 바뀌는 것을 매우 싫어합니다. 즉, 1번 노래와 5번 노래를 같은 DVD에 녹화하기 위해서는 1번과 5번 사이의 모든 노래도 같은 DVD에 녹화해야 합니다. 또한 한 노래를 쪼개서 두 개의 DVD에 녹화하면 안 됩니다.

지니레코드 입장에서는 이 DVD가 팔릴 것인지 확신할 수 없기 때문에, 이 사업에 낭비되는 DVD를 가급적 줄이려고 합니다. 고민 끝에 지니레코드는 M개의 DVD에 모든 동영상을 녹화하기로 하였고, 이때 DVD의 크기(녹화 가능한 길이)를 최소로 하려고 합니다. 그리고 M개의 DVD는 모두 같은 크기여야 제조 원가가 적게 들기 때문에 꼭 같은 크기로 해야 합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫째 줄에 자연수 N(1≤N≤1,000), M(1≤M≤N)이 주어집니다. 다음 줄에는 조영필이 라이브에서 부른 순서대로 부른 곡의 길이가 분 단위(자연수)로 주어집니다. 부른 곡의 길이는 10,000분을 넘지 않는다고 가정합니다.
- 출력: 첫 번째 줄부터 DVD의 최소 용량 크기를 출력합니다.

예시 입력은 아래와 같습니다.

```text
9 3
1 2 3 4 5 6 7 8 9

```

이때 출력은 아래와 같습니다.

```text
17
```

3개의 DVD 용량이 17분짜리이면 (1, 2, 3, 4, 5), (6, 7), (8, 9)와 같이 3개의 DVD로 녹음할 수 있습니다.

이분 검색으로 최솟값을 찾을 때 알아 두어야 할 점은 아래와 같습니다.

- 이분 검색으로 최솟값을 찾는 방법은 정해 둔 범위 안에 원하는 값이 있을 때 사용합니다.
- `lt`, `rt`, `mid`를 사용해서 범위를 축소합니다.
- 오른쪽 범위를 버릴 때는 `rt = mid - 1`, 왼쪽 범위를 버릴 때는 `lt = mid + 1`로 범위를 줄입니다.

아래 코드에서는 가장 긴 곡의 길이를 `lt`로, 모든 곡 길이의 합을 `rt`로 두고, `mid` 용량으로 필요한 DVD 개수를 `calcAlbumCount()`로 구하였습니다. 필요한 개수가 M개 이하이면 `mid`를 답으로 두고 용량을 줄이고, M개보다 많으면 용량을 늘립니다.

```java
package com.company.sortingandsearching;

import java.util.Arrays;
import java.util.Scanner;

public class DecisionAlgorithm {
    public static void main (String [] args) {
        DecisionAlgorithm decisionAlgorithm = new DecisionAlgorithm();
        Scanner in = new Scanner(System.in);
        int count = in.nextInt();
        int albumCount = in.nextInt();
        int [] arr = new int[count];

        for (int i = 0; i < count; i++) {
            arr[i] = in.nextInt();
        }
        decisionAlgorithm.solution(count, albumCount, arr);
    }

    void solution(int count, int albumCount, int [] arr) {
        int lt = Arrays.stream(arr).max().getAsInt();
        int rt = Arrays.stream(arr).sum();
        int answer = 0;

        while (lt <= rt) {
            int mid = (lt+rt) / 2;
            // 중요 포인트!!!
            int maxAlbumCount = calcAlbumCount(arr, mid);
            if(maxAlbumCount <= albumCount) {
                //용량을 줄인다.
                answer = mid;
                rt = mid -1;
            } else {
                //용량을 늘린다.
                lt = mid + 1;
            }
        }

        System.out.println(answer);

    }
    int calcAlbumCount(int [] arr, int capacity) {
        int cnt = 1, sum = 0;
        for (int i : arr) {
            if (sum + i > capacity) {
                cnt++;
                sum = i;
            } else {
                sum += i;
            }
        }
        return cnt;
    }
}
```

## 마무리

오늘은 정렬과 이분 탐색을 활용하는 코딩 테스트 문제 5개를 풀이하였습니다. 선택·버블·삽입 정렬은 같은 형식의 입력을 값을 바꾸는 방식만 달리해 정렬하였고, 뮤직비디오 문제는 답이 될 수 있는 용량의 범위를 정해 두고 이분 검색으로 좁혀 가는 결정 알고리즘으로 풀었습니다.
