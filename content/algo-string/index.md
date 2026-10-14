---
title: "문자열 다루기"
tags: ["알고리즘","Java","문자열","코딩테스트","정규식"]
summary: "문자 카운트, 대소문자 변환, 팰린드롬 판별, 문자열 압축 등 문자열 처리 문제 12개를 자바로 풀이합니다."
---

오늘은 자바로 문자열을 다루는 문제들을 정리하도록 하겠습니다. 문자 찾기, 대소문자 변환, 단어 뒤집기, 회문 판별, 문자열 압축처럼 코딩 테스트에서 자주 나오는 문자열 문제 12개를 풀이하였고, 풀이에 사용한 `toCharArray()`, `StringBuilder.reverse()`, `replaceAll()`, `Integer.parseInt(str, 2)` 같은 메서드도 함께 확인할 수 있습니다.

## 1. 문자 찾기

한 개의 문자열과 특정 문자를 입력받아, 해당 특정 문자가 입력받은 문자열에 몇 개 존재하는지 알아내는 문제입니다. 대소문자를 구분하지 않으며, 문자열의 길이는 100을 넘지 않습니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 문자열이 주어지고, 두 번째 줄에 문자가 주어집니다. 문자열은 영어 알파벳으로만 구성되어 있습니다.
- 출력: 첫 줄에 해당 문자의 개수를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
Computercooler
c

```

```text
2
```

### 풀이

문자열을 `toCharArray()`로 문자 배열로 바꾼 뒤, 문자를 하나씩 확인하면서 입력받은 문자와 같으면 개수를 셉니다.

```java
package com.company;

import java.util.Scanner;

public class MainCharSearch {
    public void solution(String str, char c) {
        int count = 0;

        str.toUpperCase();
        Character.toUpperCase(c);

        for(char x : str.toCharArray()) {
            if (x == c) {
                count++;
            }
        }

        System.out.println(count);
    }

    public static void main(String[] args) {
        MainCharSearch T = new MainCharSearch();
        Scanner in = new Scanner(System.in);

        //입력
        String str = in.next();
        char c = in.next().charAt(0);

        T.solution(str, c);

    }
}
```

## 2. 대소문자 변환

대문자와 소문자가 같이 존재하는 문자열을 입력받아 대문자는 소문자로, 소문자는 대문자로 변환하여 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 문자열이 입력됩니다. 문자열의 길이는 100을 넘지 않으며, 영어 알파벳으로만 구성되어 있습니다.
- 출력: 첫 줄에 대문자는 소문자로, 소문자는 대문자로 변환된 문자열을 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
StuDY

```

```text
sTUdy
```

### 풀이

문자마다 `Character.isLowerCase()`로 소문자인지 확인하는 `isUpper()` 메서드를 두고, 대문자이면 `Character.toLowerCase()`로, 소문자이면 `Character.toUpperCase()`로 바꿔 결과 문자열에 이어 붙입니다.

```java
package com.company;

import java.util.Scanner;

public class MainUpperLower {
    public static String solution(String str) {
        String answer = "";

        for (char c : str.toCharArray()) {
            if (isUpper(c)) {
                answer += Character.toLowerCase(c);
            } else {
                answer += Character.toUpperCase(c);
            }
        }
        return answer;
    }
		
    //대문자 체크
    public static boolean isUpper(char c) {
        boolean result = true;
        if (Character.isLowerCase(c)) {
            result = false;
        }
        return result;
    }
		
	
    public static void main(String[] args) {
				// 입력값
        Scanner in = new Scanner(System.in);
        String str = in.next();
				
				//로직
        System.out.println(solution(str));

    }
}
```

## 3. 문장 속 단어 찾기

한 개의 문장이 주어지면 그 문장 속에서 가장 긴 단어를 출력하는 문제입니다. 문장 속의 각 단어는 공백으로 구분됩니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 길이가 100을 넘지 않는 한 개의 문장이 주어집니다. 문장은 영어 알파벳으로만 구성되어 있습니다.
- 출력: 첫 줄에 가장 긴 단어를 출력합니다. 가장 길이가 긴 단어가 여러 개일 경우 문장 속에서 가장 앞쪽에 위치한 단어를 답으로 합니다.

예시 입력과 출력은 아래와 같습니다.

```text
it is time to study

```

```text
study
```

### 풀이

문장을 공백이 포함된 한 줄로 받아야 하므로 `nextLine()`으로 입력받고, `split(" ")`으로 단어를 나눕니다. 단어의 길이가 지금까지의 최댓값보다 클 때만 답을 바꾸기 때문에, 길이가 같은 단어가 여러 개이면 가장 앞쪽의 단어가 남습니다.

```java
package com.company;

import java.util.Scanner;

public class searchChar {
    public String solution(String str) {
        String answer = "";
        int min = Integer.MIN_VALUE;
			
        String[] s = str.split(" ");
        for (String s1 : s) {
            int len = s1.length();
            if (len > min) {
                min = len;
                answer = s1;
            }
        }
        System.out.println(answer);
        return answer;
    }

    public static void main(String[] args) {
        searchChar searchChar = new searchChar();
				//입력
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();
				
				//로직
        searchChar.solution(str);

    }
}
```

## 4. 단어 뒤집기

N개의 단어가 주어지면 각 단어를 뒤집어 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 자연수 N(3<=N<=20)이 주어집니다. 두 번째 줄부터 N개의 단어가 각 줄에 하나씩 주어집니다. 단어는 영어 알파벳으로만 구성되어 있습니다.
- 출력: N개의 단어를 입력된 순서대로 한 줄에 하나씩 뒤집어서 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
3
good
Time
Big

```

```text
doog
emiT
giB
```

### 풀이

`StringBuilder`의 `reverse()`로 뒤집는 방법도 있지만(주석으로 남긴 코드), 아래 코드에서는 단어를 문자 배열로 바꾼 뒤 양 끝의 lt, rt를 서로 바꾸면서 가운데로 좁혀 오는 방식으로 직접 뒤집었습니다.

```java
package com.company;

import java.util.ArrayList;
import java.util.Scanner;

class MainRevers {

//단순한 리버스
//    static public ArrayList<String> solution(String[] str) {
//        ArrayList<String> strings = new ArrayList<>();
//        for (String string : str) {
//            String temp = new StringBuilder(string).reverse().toString();
//            strings.add(temp);
//        }
//        return strings;
//    }

    // 지정 리버스
    static public ArrayList<String> solution(String[] str) {

        ArrayList<String> strings = new ArrayList<>();
        for (String string : str) {

            char[] chars = string.toCharArray(); // String을 캐릭터로 변경된다.
            int lt = 0, rt= string.length()-1;
            while(lt < rt) {
                char tmp = chars[lt];
                chars[lt] = chars[rt];
                chars[rt] = tmp;
                lt ++;
                rt --;
            }
            String temp = string.valueOf(chars);
            strings.add(temp);
        }
        return strings;
    }

    public static void main(String[] args) {
        MainRevers T = new MainRevers();
        Scanner in = new Scanner(System.in);

        // 입력값
        int inputNumber = in.nextInt();
        String[] str = new String[inputNumber];

        for (int i = 0; i < str.length; i++) {
            str[i] = in.next();
        }

        // 결과 값
        ArrayList<String> solution = solution(str);
        for (String s : solution) {
            System.out.println(s);
        }

    }
}
```

## 5. 특정 문자 뒤집기

영어 알파벳과 특수문자로 구성된 문자열이 주어지면 영어 알파벳만 뒤집고, 특수문자는 자기 자리에 그대로 있는 문자열을 만들어 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 길이가 100을 넘지 않는 문자열이 주어집니다.
- 출력: 첫 줄에 알파벳만 뒤집힌 문자열을 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
a#b!GE*T@S

```

```text
S#T!EG*b@a
```

### 풀이

4번과 같이 lt, rt를 양 끝에 둡니다. 다만 lt 위치가 알파벳이 아니면 lt만, rt 위치가 알파벳이 아니면 rt만 옮기고, 둘 다 알파벳일 때만 두 문자를 바꿉니다. 알파벳 여부는 `Character.isAlphabetic()`으로 확인합니다.

```java
package com.company;

import java.util.Scanner;

public class SearchSpecialSentence {
    public String solution(String str) {
        String answer = "";
        char[] s = str.toCharArray();
        int lt = 0, rt = s.length -1;

        while(lt<rt) {
            if (!isAlpha(s[lt])) {
                lt++;
            } else if (!isAlpha(s[rt])) {
                rt--;
            } else {
                char temp = s[lt];
                s[lt] = s[rt];
                s[rt] = temp;
                lt++;
                rt--;
            }
        }
        answer = String.valueOf(s);
        System.out.println(answer);
        return answer;
    }

    private boolean isAlpha(char c) {
        boolean result = true;
        if (!Character.isAlphabetic(c)) {
            result = false;
        }
        return  result;
    }

    public static void main(String[] args) {
        SearchSpecialSentence searchChar = new SearchSpecialSentence();
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();

        searchChar.solution(str);

    }
}
```

## 6. 중복 문자 제거

문자열에서 중복된 문자를 제거하는 문제입니다.

### 풀이

`indexOf()`는 문자가 처음 나온 위치를 돌려줍니다. 각 문자의 `indexOf()` 결과가 현재 위치 i와 같으면 그 문자가 처음 나온 것이므로 결과에 더하고, 다르면 앞에서 이미 나온 문자이므로 건너뜁니다.

```java
package com.company;

import java.util.Scanner;

public class RemoveDuplicateChar {
    public String solution(String str) {
        String answer = "";
        for (int i = 0; i < str.length(); i++) {
            // System.out.println(str.charAt(i) + "/" + str.indexOf(str.charAt(i)) +"/"+ i);
            if (isSameNumber(str.indexOf(str.charAt(i)), i)) {
                answer += str.charAt(i);
            }
        }
        System.out.println(answer);
        return answer;
    }

    private boolean isSameNumber(int n1, int n2) {
        boolean result = true;
        if (n1 != n2) {
            result = false;
        }
        return  result;
    }

    public static void main(String[] args) {
        RemoveDuplicateChar searchChar = new RemoveDuplicateChar();
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();

        searchChar.solution(str);
    }
}
```

## 7. 회문 문자열

앞에서 읽을 때나 뒤에서 읽을 때나 같은 문자열을 회문 문자열이라고 합니다. 문자열이 입력되면 해당 문자열이 회문 문자열이면 "YES", 회문 문자열이 아니면 "NO"를 출력하는 문제입니다. 단, 회문을 검사할 때 대소문자를 구분하지 않습니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 길이 100을 넘지 않는, 공백이 없는 문자열이 주어집니다.
- 출력: 첫 번째 줄에 회문 문자열인지의 결과를 YES 또는 NO로 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
gooG

```

```text
YES
```

### 풀이

대소문자를 구분하지 않도록 먼저 `toLowerCase()`로 모두 소문자로 바꿉니다. 그다음 `StringBuilder`의 `reverse()`로 뒤집은 문자열을 만들고, 원래 문자열과 `equals()`로 비교합니다.

```java
package com.company;

import java.util.Scanner;

public class SearchPalindrome {
    public String solution(String str) {
        str = str.toLowerCase();
        String answer = "NO";
        StringBuilder stringBuilder = new StringBuilder(str);
        String reversStr = stringBuilder.reverse().toString();
        if(str.equals(reversStr)) {
            answer = "YES";
        }
        System.out.println(answer);
        return answer;
    }

    public static void main(String[] args) {
        SearchPalindrome searchChar = new SearchPalindrome();
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();

        searchChar.solution(str);
    }
}
```

## 8. 팰린드롬 — 정규식으로 특수문자 제거

앞에서 읽을 때나 뒤에서 읽을 때나 같은 문자열을 팰린드롬이라고 합니다. 문자열이 입력되면 해당 문자열이 팰린드롬이면 "YES", 아니면 "NO"를 출력하는 문제입니다. 단, 회문을 검사할 때 알파벳만 가지고 검사하며 대소문자를 구분하지 않습니다. 알파벳 이외의 문자들은 무시합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 길이 100을 넘지 않는, 공백이 없는 문자열이 주어집니다.
- 출력: 첫 번째 줄에 팰린드롬인지의 결과를 YES 또는 NO로 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
found7, time: study; Yduts; emit, 7Dnuof

```

```text
YES
```

### 풀이

7번과 같은 방식이지만, 비교하기 전에 알파벳이 아닌 문자를 지웁니다. `toUpperCase()`로 모두 대문자로 바꾼 뒤 `replaceAll("[^A-Z]", "")`를 적용하면 A부터 Z까지가 아닌 문자가 모두 빈 문자열로 바뀝니다.

```java
package com.company;

import java.util.Scanner;

public class SearchPalindromeEffective {
    public String solution(String str) {
        String answer = "NO";
        // 특수문자 삭제
        str = str.toUpperCase().replaceAll("[^A-Z]", "");
        String reversStr = new StringBuilder(str).reverse().toString();

        if (str.equals(reversStr)) {
            answer = "YES";
        }

        System.out.println(answer);
        return answer;
    }

    public static void main(String[] args) {
        SearchPalindromeEffective searchChar = new SearchPalindromeEffective();
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();

        searchChar.solution(str);
    }
}
```

## 9. 숫자만 추출

문자와 숫자가 섞여 있는 문자열이 주어지면 그중 숫자만 추출하여 그 순서대로 자연수를 만드는 문제입니다.

만약 "tge0a1h205er"에서 숫자만 추출하면 0, 1, 2, 0, 5이고, 이것으로 자연수를 만들면 1205가 됩니다. 추출하여 만들어지는 자연수는 100,000,000을 넘지 않습니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 숫자가 섞인 문자열이 주어집니다. 문자열의 길이는 100을 넘지 않습니다.
- 출력: 첫 줄에 자연수를 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
g0en2T0s8eSoft

```

```text
208
```

### 풀이

문자 '0'부터 '9'까지의 아스키 코드는 48부터 57까지입니다. 이 범위의 문자만 골라 `answer*10+(c-48)`로 한 자리씩 이어 붙이면, 맨 앞에 나온 0은 자연수에 영향을 주지 않습니다.

```java
package com.company;

import java.util.Scanner;

public class ExtraNumber {
    public int solution(String str) {
        int answer = 0;
        char [] chars = str.toCharArray();
        for (char c : chars) {
            if (c >= 48 && c <= 57) {
                answer = answer*10+(c-48);
            }
        }
        return answer;
    }

    public static void main(String[] args) {
        ExtraNumber extraNumber = new ExtraNumber();
        Scanner in = new Scanner(System.in);
        String str = in.next();

        System.out.println(extraNumber.solution(str));

    }
}
```

## 10. 가장 짧은 문자 거리

한 개의 문자열 s와 문자 t가 주어지면 문자열 s의 각 문자가 문자 t와 떨어진 최소 거리를 출력하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 번째 줄에 문자열 s와 문자 t가 주어집니다. 문자열과 문자는 소문자로만 주어집니다. 문자열의 길이는 100을 넘지 않습니다.
- 출력: 첫 번째 줄에 문자열 s의 각 문자가 문자 t와 떨어진 거리를 순서대로 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
teachermode e

```

```text
1 0 1 2 1 0 1 2 2 1 0
```

### 풀이

문자열을 왼쪽에서 오른쪽으로 한 번, 오른쪽에서 왼쪽으로 한 번 훑습니다. 거리 p는 문자 t를 만나면 0으로 두고, 그 밖의 문자에서는 1씩 늘립니다. 왼쪽부터 훑을 때 구한 거리를 먼저 담아 두고, 오른쪽부터 훑을 때는 두 거리 중 작은 값을 남깁니다. p의 처음 값을 1000으로 두어, 한쪽에 t가 없는 위치는 반대쪽에서 잰 거리가 남도록 하였습니다.

```java
package com.company;

import java.util.Scanner;

public class DistanceChar {
    public void solution(String str, char c) {
        int[] answer = new int[str.length()];
        char[] chars = str.toCharArray();

        int p = 1000;
        for (int i = 0; i < chars.length; i++) {
            if (chars[i] == c) {
                p = 0;
            } else {
                p++;
            }
            answer[i] = p;
        }
        
        p = 1000;
        for (int i = chars.length-1; i >= 0; i--) {
            if (chars[i] == c) {
                p = 0;
            } else {
                p++;
                answer[i] = Math.min(answer[i], p);
            }
        }
        for (int i : answer) {
            System.out.print(i);
        }
    }

    public static void main(String[] args) {
        DistanceChar distanceChar = new DistanceChar();
        Scanner in = new Scanner(System.in);
        String str = in.next();
        char c = in.next().charAt(0);

        distanceChar.solution(str, c);
    }
}
```

## 11. 문자열 압축

알파벳 대문자로 이루어진 문자열을 입력받아, 같은 문자가 연속으로 반복되는 경우 반복되는 문자 바로 오른쪽에 반복 횟수를 표기하는 방법으로 문자열을 압축하는 문제입니다. 단, 반복 횟수가 1인 경우는 생략합니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에 문자열이 주어집니다. 문자열의 길이는 100을 넘지 않습니다.
- 출력: 첫 줄에 압축된 문자열을 출력합니다.

예시 입력 1과 출력은 아래와 같습니다.

```text
KKHSSSSSSSE

```

```text
K2HS7E

```

예시 입력 2와 출력은 아래와 같습니다.

```text
KSTTTSEEKFKKKDJJGG
```

```text
KST3SE2KFK3DJ2G2
```

### 풀이

현재 문자와 다음 문자를 비교하면서 같으면 횟수 cnt를 늘리고, 다르면 현재 문자와 (1보다 클 때만) 횟수를 결과에 붙인 뒤 cnt를 1로 되돌립니다. 마지막 문자도 다음 문자와 비교할 수 있도록 문자열 끝에 공백 한 칸을 붙여 두었습니다.

```java

package com.company;

import java.util.Scanner;

public class CompressionString {
    public String solution(String str) {
        String answer = "";
        str += " ";
        char [] chars = str.toCharArray();
        int cnt = 1;
        for (int i = 0; i < str.length()-1; i++) {
            if (chars[i] == chars[i+1]) {
                cnt += 1;

            } else {
                answer += chars[i];
                if (cnt > 1) {
                    answer += cnt;
                }
                cnt = 1;
            }

        }
        System.out.println(answer);
        return answer;
    }

    public static void main(String[] args) {
        CompressionString compressionString = new CompressionString();
        Scanner in = new Scanner(System.in);
        String str = in.nextLine();

        compressionString.solution(str);

    }
}
```

## 12. 암호 해독 — replace()와 parseInt(String, 2)

현수는 영희에게 알파벳 대문자로 구성된 비밀편지를 매일 컴퓨터를 이용해 보냅니다. 비밀편지는 현수와 영희가 서로 약속한 암호로 구성되어 있으며, 알파벳 한 문자마다 `#` 또는 `*`이 일곱 개로 구성되어 있습니다.

만약 현수가 `#*****#`으로 구성된 문자를 보냈다면 영희는 현수와 약속한 규칙대로 다음과 같이 해석합니다.

1. `#*****#`를 일곱 자리의 이진수로 바꿉니다. `#`은 이진수의 1로, `*`은 이진수의 0으로 변환합니다. 결과는 "1000001"로 변환됩니다.
2. 바뀐 2진수를 10진수로 바꿉니다. "1000001"을 10진수로 바꾸면 65가 됩니다.
3. 아스키 번호 65를 문자로 변환합니다. 아스키 번호 65는 대문자 'A'입니다.

참고로 대문자들의 아스키 번호는 'A'는 65번, 'B'는 66번, 'C'는 67번 등 차례대로 1씩 증가하여 'Z'는 90번입니다.

현수가 4개의 문자를 다음과 같이 신호로 보냈다고 하겠습니다.

`#****###**#####**#####**##**`

이 신호를 4개의 문자 신호로 구분하면 아래와 같고, 최종적으로 "COOL"로 해석됩니다.

- `#****##` → 'C'
- `#**####` → 'O'
- `#**####` → 'O'
- `#**##**` → 'L'

현수가 보낸 신호를 해석하는 프로그램을 작성하는 문제입니다.

입력과 출력 조건은 아래와 같습니다.

- 입력: 첫 줄에는 보낸 문자의 개수(10을 넘지 않습니다)가 입력됩니다. 다음 줄에는 문자 개수의 일곱 배만큼의 `#` 또는 `*` 신호가 입력됩니다. 현수는 항상 대문자로 해석할 수 있는 신호를 보낸다고 가정합니다.
- 출력: 영희가 해석한 문자열을 출력합니다.

예시 입력과 출력은 아래와 같습니다.

```text
4
#****###**#####**#####**##**

```

```text
COOL
```

### 풀이

신호를 앞에서부터 7자리씩 `substring()`으로 잘라 냅니다. 잘라 낸 신호는 `replace()`로 `#`은 "1", `*`은 "0"으로 바꾸고, `Integer.parseInt(str, 2)`로 2진수 문자열을 10진수로 바꾼 뒤 `(char)`로 형변환해 문자를 만듭니다.

```java
package com.company;

import java.util.Scanner;

public class SecretLetter {
    
    public String solution(int number, String str) {
        String answer = "";
        for (int i = 0; i < number; i++) {
            String temp = str.substring(0, 7);
            str = str.substring(7);

            int n = convertStringToNumber(temp);

            answer += (char)n;
        }
        return answer;
    }

    public int convertStringToNumber(String temp) {
        String str = temp.replace("#", "1").replace("*", "0");
        return Integer.parseInt(str, 2);
    }

    public static void main(String[] args) {
        SecretLetter secretLetter = new SecretLetter();
        Scanner in = new Scanner(System.in);
        int number = in.nextInt();
        String str = in.next();

        System.out.println(secretLetter.solution(number, str));

    }
}
```

## 마무리

오늘은 자바로 문자열을 다루는 문제 12개를 정리하였습니다. 문자 배열로 바꿔 하나씩 확인하는 방법을 기본으로, 뒤집기와 회문 판별에는 양 끝의 lt, rt를 옮기는 방법이나 `StringBuilder.reverse()`를, 특수문자 제거에는 정규식을, 진법 변환에는 `Integer.parseInt(str, 2)`를 사용하였습니다.
