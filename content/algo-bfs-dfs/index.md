---
title: "BFS와 DFS"
tags: ["알고리즘","Java","BFS","DFS","코딩테스트"]
summary: "BFS와 DFS를 이용해 최단 경로, 부분집합, 배낭형 문제 등 코딩 테스트 문제 6개를 자바로 풀이합니다."
---

## 1. 송아지 찾기

현수는 송아지를 잃어버렸습니다. 다행히 송아지에는 위치추적기가 달려 있습니다.

현수의 위치와 송아지의 위치가 수직선상의 좌표점으로 주어지면 현수는 현재 위치에서 송아지의 위치까지 다음과 같은 방법으로 이동합니다.

송아지는 움직이지 않고 제자리에 있습니다.

현수는 스카이 콩콩을 타고 가는데 한 번의 점프로 앞으로 1, 뒤로 1, 앞으로 5를 이동할 수 있습니다.

최소 몇 번의 점프로 현수가 송아지의 위치까지 갈 수 있는지 구하는 프로그램을 작성합니다.

**입력**

첫 번째 줄에 현수의 위치 S와 송아지의 위치 E가 주어집니다. 직선의 좌표점은 1부터 10,000까지입니다.

**출력**

점프의 최소횟수를 구합니다. 답은 1이상이며 반드시 존재합니다.

**문제 해결 방법**

1) 현수의 점프를 배열로 만듭니다.

2) BFS로 현수와 송아지의 거리를 배열만큼의 숫자를 더해 구합니다.

```java
package com.company.dfsandbfs;

import java.util.LinkedList;
import java.util.Queue;
import java.util.Scanner;

public class BFSSearchCow {
    int answer = 0;
    int [] jump = {1, -1, 5};
    int [] ch;
    Queue<Integer> queue = new LinkedList<>();

    public static void main(String[] args) {
        BFSSearchCow main = new BFSSearchCow();
        Scanner in = new Scanner(System.in);
        int person = in.nextInt();
        int cow= in.nextInt();
        System.out.println(main.BFS(person, cow));

    }
    int BFS(int person, int cow) {
        ch = new int [10001];
        ch[person] = 1;
        queue.offer(person);
        int L = 0;
        // Q 비어 있을 때 까지 진행
        while(!queue.isEmpty()) {
            int len = queue.size();

            // Q size 만큼 for문을 실행한다.
            for (int i=0; i<len; i++) {
                // Q 에서 맨 처음 들어간 값을 빼고.
                int x = queue.poll();
                if (x == cow) return L;
                // 3개의 조건의 값을 Q의 값과 계산 후
                // 넣는다.
                for (int j=0; j<3; j++) {
                    int nx = x + jump[j];
                    if (nx >=1 && nx <10000 && ch[nx] ==0) {
                        ch[nx] = 1;
                        queue.offer(nx);
                    }
                }
            }
            L++;
        }
    return 0;
    }
}
```

## 2. 합이 같은 부분집합

N개의 원소로 구성된 자연수 집합이 주어지면, 이 집합을 두 개의 부분집합으로 나누었을 때 두 부분집합의 원소의 합이 서로 같은 경우가 존재하면 "YES"를 출력하고, 그렇지 않으면 "NO"를 출력하는 프로그램을 작성합니다.

둘로 나뉘는 두 부분집합은 서로소 집합이며, 두 부분집합을 합하면 입력으로 주어진 원래의 집합이 되어야 합니다.

예를 들어 {1, 3, 5, 6, 7, 10}이 입력되면 {1, 3, 5, 7} = {6, 10}으로 두 부분집합의 합이 16으로 같은 경우가 존재하는 것을 알 수 있습니다.

**입력**

첫 번째 줄에 자연수 N(1<=N<=10)이 주어집니다.

두 번째 줄에 집합의 원소 N개가 주어집니다. 각 원소는 중복되지 않습니다.

**출력**

첫 번째 줄에 "YES" 또는 "NO"를 출력합니다.

**예시 입력 1**

```
6
1 3 5 6 7 10

```

**예시 출력 1**

```
YES
```

**문제 해결 방법**

1) 주어진 배열의 값을 전부 더해서 total을 만듭니다.

2) total - (DFS의 sum) 값을 뺀 값이 sum과 같을 때 YES를 출력합니다.

```java
package com.company.dfsandbfs;

import java.util.Scanner;

public class DFSSubset {
    static String answer = "NO";
    static int [] arr;
    static int count, total = 0;

    public static void main(String[] args) {
        DFSSubset dfsSubset = new DFSSubset();
        Scanner in = new Scanner(System.in);
        count = in.nextInt();

        arr = new int[count];
        for (int i = 0; i < count; i++) {
            arr[i] = in.nextInt();
            total += arr[i];
        }
        dfsSubset.solution();
    }
    void solution() {
        DFS(0, 0);
        System.out.println(answer);
    }

    void DFS(int L, int sum) {
        if ((total - sum) == sum) {
            answer = "YES";
            return;
        }
        if (count != L) {
            DFS(L + 1, sum + arr[L]);
            DFS(L + 1, sum);
        }
    }

}
```

## 3. 바둑이 승차

철수는 그의 바둑이들을 데리고 시장에 가려고 합니다. 그런데 그의 트럭은 C킬로그램 넘게 태울 수가 없습니다.

철수는 C를 넘지 않으면서 그의 바둑이들을 가장 무겁게 태우고 싶습니다.

N마리의 바둑이와 각 바둑이의 무게 W가 주어지면, 철수가 트럭에 태울 수 있는 가장 무거운 무게를 구하는 프로그램을 작성합니다.

**입력**

첫 번째 줄에 자연수 C(1<=C<=100,000,000)와 N(1<=N<=30)이 주어집니다.

둘째 줄부터 N마리 바둑이의 무게가 주어집니다.

**출력**

첫 번째 줄에 가장 무거운 무게를 출력합니다.

**예시 입력 1**

```
259 5
81
58
42
33
61

```

**예시 출력 1**

```
242
```

**문제 해결 방법**

1) 가장 무거운 무게를 구하므로 DFS를 사용합니다.

2) 최대 무게를 담는 변수를 만듭니다(maxTemp).

3) 바둑이를 담는 경우와 담지 않는 경우로 DFS를 적용합니다.

4) sum과 최대 무게를 비교해서 최대 무게를 갱신합니다.

5) 최대 무게보다는 크고, 트럭의 무게보다 작은 값을 리턴합니다.

```java
package com.company.dfsandbfs;

import java.util.Scanner;

public class DFSDogRide {
    static int weight = 0;
    static int [] arr;
    static int count, total = 0;
    static int maxTemp = 0;

    public static void main(String[] args) {
        DFSDogRide dfsDogRide = new DFSDogRide();
        Scanner in = new Scanner(System.in);
        weight = in.nextInt();
        count = in.nextInt();
        arr = new int[count];
        for (int i = 0; i < count; i++) {
            arr[i] = in.nextInt();
            total += arr[i];
        }
        dfsDogRide.solution();
    }
    void solution() {
        DFS(0, 0);
        System.out.println(maxTemp);
    }

    void DFS(int L, int sum) {
        if (L == count) {
            if (sum < weight && sum > maxTemp) {
                maxTemp = sum;
            }
        } else {
            DFS(L+1, sum + arr[L]);
            DFS(L+1, sum);
        }
    }
}
```

## 4. 동전교환

여러 단위의 동전들이 주어져 있을 때 거스름돈을 가장 적은 수의 동전으로 교환해 주려면 어떻게 주면 되는지 구합니다.

각 단위의 동전은 무한정 쓸 수 있습니다.

**입력**

첫 번째 줄에는 동전의 종류개수 N(1<=N<=12)이 주어집니다. 두 번째 줄에는 N개의 동전의 종류가 주어지고, 그 다음줄에 거슬러 줄 금액 M(1<=M<=500)이 주어집니다. 각 동전의 종류는 100원을 넘지 않습니다.

**출력**

첫 번째 줄에 거슬러 줄 동전의 최소개수를 출력합니다.

**예시 입력 1**

```
3
1 2 5
15

```

**예시 출력 1**

```
3
```

**문제 해결 방법**

1) 가장 적은 개수를 구하므로 DFS를 사용합니다.

2) 동전의 값을 for문으로 DFS에 넘깁니다.

3) sum 값과 동전의 값이 같으면 레벨을 리턴합니다.

```java
package com.company.dfsandbfs;

import java.util.Scanner;

public class DFSExchangeCoin {
    static int count = 0;
    static int [] arr;
    static int diff = 0;
    static int answer = 0;

    public static void main(String [] args) {
        DFSExchangeCoin dfsExchangeCoin = new DFSExchangeCoin();
        Scanner in = new Scanner(System.in);
        count = in.nextInt();
        arr = new int[count];
        for (int i = 0; i < count; i++) {
            arr[i] = in.nextInt();
        }
        diff = in.nextInt();
        dfsExchangeCoin.solution();
        System.out.println(answer);
    }

    void solution() {
        DFS(0, 0);
    }

    void DFS(int L, int sum) {
        if (sum > diff) return;
        if (L >= answer) return;
        if (sum == diff) {
            answer = Math.min(answer, L);
            System.out.println(L);
        } else {
            for (int i = 0; i < count; i++) {
                DFS(L+1, sum + arr[i]);
            }
        }

    }
}
```

## 5. 미로탐색 DFS

7*7 격자판 미로를 탈출하는 경로의 가짓수를 출력하는 프로그램을 작성합니다.

출발점은 격자의 (1, 1) 좌표이고, 탈출 도착점은 (7, 7)좌표입니다. 격자판의 1은 벽이고, 0은 통로입니다.

격자판의 움직임은 상하좌우로만 움직입니다.

아래 예시와 같은 미로가 주어지면 출발점에서 도착점까지 갈 수 있는 방법의 수는 8가지입니다.

**입력**

7*7 격자판의 정보가 주어집니다.

**출력**

첫 번째 줄에 경로의 가짓수를 출력합니다.

**예시 입력 1**

```
0 0 0 0 0 0 0
0 1 1 1 1 1 0
0 0 0 1 0 0 0
1 1 0 1 0 1 1
1 1 0 0 0 0 1
1 1 0 1 1 0 0
1 0 0 0 0 0 0

```

**예시 출력 1**

```
8
```

**문제 해결 방법**

1. 배열의 상하좌우로 움직이는 좌표를 지정합니다.
2. 현재 좌표가 보드 배열의 범위 안에 있는지 확인합니다.
3. 움직이는 좌표의 배열 값이 0인지 확인합니다.
4. 움직인 좌표의 값을 1로 변경한 후 DFS를 실행하고, 배열의 마지막 좌표에 도착했는지 확인합니다.
5. 이후 DFS를 되돌아 나오면서 배열의 값을 다시 0으로 변경시키고 해당 위치로 다시 이동할 수 있는지 확인합니다.

```java
package com.company.dfsandbfs;

import java.util.Scanner;

public class MazeExploration {
    static int [] dx  = {-1, 0, 1, 0};
    static int [] dy  = {0, 1, 0, -1};
    static int [][] board;
    static int answer = 0;

    public static void main (String [] args) {
        MazeExploration mazeExploration = new MazeExploration();
        Scanner in = new Scanner(System.in);
        board = new int [8][8];
        for (int i = 1; i <= 7; i++) {
            for (int j = 1; j <= 7; j++) {
                board[i][j] = in.nextInt();
            }
        }
        board[1][1] = 1;
        mazeExploration.DFS(1,1);
        System.out.println(answer);
    }

    public void DFS(int x, int y) {
        if (x == 7 && y == 7) answer++;
        else {
            for (int i = 0; i<4; i++) {
                int nx = x + dx[i];
                int ny = y + dy[i];
                if (nx >= 1 && nx <=7 && ny >= 1 && ny <=7 && board[nx][ny]==0) {
                    board[nx][ny] = 1;
                    DFS(nx, ny);
                    board[nx][ny] = 0;
                }
            }
        }
    }
}
```

## 6. 미로탐색 BFS

7*7 격자판 미로를 탈출하는 최단경로의 길이를 출력하는 프로그램을 작성합니다.

경로의 길이는 출발점에서 도착점까지 가는데 이동한 횟수를 의미합니다.

출발점은 격자의 (1, 1) 좌표이고, 탈출 도착점은 (7, 7)좌표입니다. 격자판의 1은 벽이고, 0은 도로입니다.

격자판의 움직임은 상하좌우로만 움직입니다.

아래 예시와 같은 미로가 주어지면 최단 경로의 길이는 12입니다.

**입력**

첫 번째 줄부터 7*7 격자의 정보가 주어집니다.

**출력**

첫 번째 줄에 최단으로 움직인 칸의 수를 출력합니다. 도착할 수 없으면 -1를 출력합니다.

**예시 입력 1**

```
0 0 0 0 0 0 0
0 1 1 1 1 1 0
0 0 0 1 0 0 0
1 1 0 1 0 1 1
1 1 0 1 0 0 0
1 0 0 0 1 0 0
1 0 1 0 0 0 0

```

**예시 출력 1**

```
12
```

**문제 해결 방법**

1. 배열의 상하좌우로 움직이는 좌표를 지정합니다.
2. 현재 좌표가 보드 배열의 범위 안에 있는지 확인합니다.
3. 움직이는 좌표의 배열 값이 0인지 확인합니다.
4. 움직인 좌표의 값을 1로 변경한 후 BFS를 실행하고, 다음 dis 값을 현재 dis 배열의 값+1로 설정합니다.
5. 이후 dis[7][7]의 값이 0인지 확인해서 통로가 막혀있는지 확인합니다.
6. 막혀 있지 않다면 dis[7][7]의 최단 거리를 출력합니다.

```java
package com.company.dfsandbfs;

import java.util.LinkedList;
import java.util.Queue;
import java.util.Scanner;

class Point {
    int x;
    int y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }
}

public class MazeExplorationCount {
    static int [] dx  = {-1, 0, 1, 0};
    static int [] dy  = {0, 1, 0, -1};
    static int [][] board, dis;

    public static void main (String [] args) {
        MazeExplorationCount mazeExplorationCount = new MazeExplorationCount();
        Scanner in = new Scanner(System.in);
        board = new int [8][8];
        dis = new int [8][8];
        for (int i = 1; i <= 7; i++) {
            for (int j = 1; j <= 7; j++) {
                board[i][j] = in.nextInt();
            }
        }
        mazeExplorationCount.BFS(1, 1);
        if (dis[7][7] == 0) System.out.println(-1);
        else System.out.println(dis[7][7]);
    }

    public void BFS(int x, int y) {
        Queue<Point> Q = new LinkedList<>();
        Q.offer(new Point(x, y));
        board[x][y] = 1;
        while (!Q.isEmpty()) {
            Point curr = Q.poll();
            for (int i = 0; i < 4; i++) {
                int nx = curr.x + dx[i];
                int ny = curr.y + dy[i];
                if (nx >= 1 && nx <=7 && ny >= 1 && ny <=7 && board[nx][ny]==0) {
                    board[nx][ny] = 1;
                    Q.offer(new Point(nx, ny));
                    dis[nx][ny] = dis[curr.x][curr.y]+1;
                }
            }
        }

    }
}
```
