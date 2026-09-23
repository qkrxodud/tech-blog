---
title: "Java 기준 멀티스레드와 레이스 컨디션"
tags: ["Java","스레드","레이스 컨디션","synchronized","AtomicInteger"]
summary: "Java에서 멀티스레드 프로그래밍 시 발생하는 레이스 컨디션의 원인을 예제로 살펴보고, synchronized·Lock·Atomic을 활용한 해결 방법을 정리합니다."
---

멀티스레드와 레이스 컨디션(race condition)은 Java 프로그래밍에서 매우 중요한 주제입니다. 특히 병렬 프로그래밍을 다룰 때 필연적으로 마주치는 개념들입니다. 아래에서 Java를 기준으로 이 두 개념을 상세히 설명하고, 예제 코드와 해결 방안을 함께 다루겠습니다.

---

### **1. 멀티스레드란?**

멀티스레드(multithreading)는 하나의 프로세스 내에서 여러 스레드가 동시에 작업을 수행하는 것을 의미합니다. Java에서는 Thread 클래스나 Runnable 인터페이스를 활용해 스레드를 생성하고 관리할 수 있습니다. 멀티스레드는 CPU 코어를 효율적으로 활용하고, 작업을 병렬로 처리해 성능을 향상시키는 데 유용합니다.

### **Java에서 스레드 생성 예제**

```java
public class ThreadExample {
    public static void main(String[] args) {
        // 방법 1: Thread 클래스 상속
        class MyThread extends Thread {
            @Override
            public void run() {
                System.out.println("Thread 상속: " + Thread.currentThread().getName());
            }
        }

        // 방법 2: Runnable 인터페이스 구현
        class MyRunnable implements Runnable {
            @Override
            public void run() {
                System.out.println("Runnable 구현: " + Thread.currentThread().getName());
            }
        }

        MyThread thread1 = new MyThread();
        Thread thread2 = new Thread(new MyRunnable());

        thread1.start(); // 스레드 시작
        thread2.start();
    }
}
```

### **멀티스레드의 장점**

- **효율성**: I/O 작업(파일 읽기/쓰기, 네트워크 요청 등) 중 대기 시간이 발생할 때 다른 작업을 처리할 수 있습니다.
- **성능 향상**: 다중 코어 CPU에서 작업을 분산 처리합니다.
- **응답성**: GUI 애플리케이션에서 사용자 입력을 처리하면서 백그라운드 작업을 수행할 수 있습니다.

### **멀티스레드의 단점**

- **복잡성 증가**: 스레드 간 동기화와 데이터 공유 문제가 발생합니다.
- **레이스 컨디션**: 여러 스레드가 동일한 자원에 접근할 때 발생하는 오류 가능성이 있습니다.

---

### **2. 레이스 컨디션이란?**

레이스 컨디션(race condition)은 여러 스레드가 공유 자원(예: 변수, 객체)에 동시에 접근하고 수정하려 할 때, 실행 순서에 따라 결과가 달라지는 상황을 말합니다. 이는 의도하지 않은 동작이나 버그를 유발할 수 있습니다.

### **레이스 컨디션 발생 예제**

아래는 두 스레드가 공유 변수를 증가시키는 코드입니다.

```java
public class RaceConditionExample {
    static int counter = 0;

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                counter++; // 공유 변수 증가
            }
        };

        Thread thread1 = new Thread(task);
        Thread thread2 = new Thread(task);

        thread1.start();
        thread2.start();

        thread1.join(); // 스레드가 끝날 때까지 대기
        thread2.join();

        System.out.println("최종 값: " + counter);
    }
}

```

**실행 결과 예상**: counter++가 2개의 스레드에서 각각 10,000번 실행되므로 20,000이 나와야 할 것 같습니다.

**실제 결과**: 20,000 미만의 값이 출력될 수 있습니다(예: 19,xxx).

### **왜 이런 일이 발생하나?**

counter++는 단일 연산처럼 보이지만, 실제로는 세 단계로 나뉩니다.

1. **읽기(Read)**: 현재 counter 값을 가져옵니다.
2. **수정(Modify)**: 값을 1 증가시킵니다.
3. **쓰기(Write)**: 증가된 값을 다시 counter에 저장합니다.

두 스레드가 동시에 이 작업을 수행하면 다음과 같은 상황이 발생할 수 있습니다.

- 스레드 1: counter를 읽음 (값: 5)
- 스레드 2: counter를 읽음 (값: 5)
- 스레드 1: 값을 6으로 증가시켜 저장
- 스레드 2: 값을 6으로 증가시켜 저장
→ 결과적으로 counter는 6이 되지만, 두 스레드가 각각 1씩 증가시켰으니 7이 되어야 했던 상황이 무시됩니다.

이처럼 **`스레드 실행 순서에 따라 결과가 달라지는 것이 레이스 컨디션`**입니다.

---

### **3. 레이스 컨디션 해결 방법**

Java에서는 동기화(synchronization)와 같은 메커니즘을 사용해 레이스 컨디션을 방지할 수 있습니다. 주요 방법은 다음과 같습니다.

### **(1) synchronized 키워드 사용**

synchronized 블록이나 메서드를 사용하면 특정 코드 블록에 한 번에 하나의 스레드만 접근할 수 있습니다.

```java
public class SynchronizedExample {
    static int counter = 0;

    public static synchronized void increment() { // 메서드 수준 동기화
        counter++;
    }

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                increment();
            }
        };

        Thread thread1 = new Thread(task);
        Thread thread2 = new Thread(task);

        thread1.start();
        thread2.start();

        thread1.join();
        thread2.join();

        System.out.println("최종 값: " + counter); // 항상 20,000 출력
    }
}
```

### **(2) Lock 인터페이스 사용**

java.util.concurrent.locks 패키지의 ReentrantLock을 사용하면 더 유연한 동기화가 가능합니다.

```java
import java.util.concurrent.locks.ReentrantLock;

public class LockExample {
    static int counter = 0;
    static ReentrantLock lock = new ReentrantLock();

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                lock.lock(); // 락 획득
                try {
                    counter++;
                } finally {
                    lock.unlock(); // 락 해제
                }
            }
        };

        Thread thread1 = new Thread(task);
        Thread thread2 = new Thread(task);

        thread1.start();
        thread2.start();

        thread1.join();
        thread2.join();

        System.out.println("최종 값: " + counter); // 항상 20,000 출력
    }
}
```

### **(3) Atomic 클래스 사용**

java.util.concurrent.atomic 패키지의 AtomicInteger 같은 클래스는 락 없이도 원자적 연산을 보장합니다.

```java
import java.util.concurrent.atomic.AtomicInteger;

public class AtomicExample {
    static AtomicInteger counter = new AtomicInteger(0);

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                counter.incrementAndGet(); // 원자적 증가
            }
        };

        Thread thread1 = new Thread(task);
        Thread thread2 = new Thread(task);

        thread1.start();
        thread2.start();

        thread1.join();
        thread2.join();

        System.out.println("최종 값: " + counter.get()); // 항상 20,000 출력
    }
}
```

### **(4) 기타 방법**

- **volatile 키워드**: 변수의 가시성을 보장하지만, 원자성은 보장하지 않으므로 레이스 컨디션 해결에는 제한적입니다.
- **ThreadLocal**: 각 스레드마다 독립적인 변수 사본을 제공해 공유 문제를 회피합니다.

---

### **4. 멀티스레드와 레이스 컨디션의 주의점**

- **데드락(Deadlock)**: synchronized나 Lock을 사용할 때 스레드가 서로 필요한 자원을 기다리며 교착 상태에 빠질 수 있습니다.
- **성능 저하**: 과도한 동기화는 스레드 대기 시간을 늘려 멀티스레드의 이점을 상쇄할 수 있습니다.
- **테스트의 어려움**: 레이스 컨디션은 실행 환경에 따라 재현되지 않을 수 있어 디버깅이 까다롭습니다.

---

### **5. 결론**

Java에서 멀티스레드는 강력한 기능이지만, 공유 자원에 대한 접근을 신중히 관리해야 합니다. 레이스 컨디션은 동기화 메커니즘(synchronized, Lock, Atomic)을 통해 해결할 수 있으며, 상황에 따라 적합한 방법을 선택하는 것이 중요합니다. 간단한 경우에는 Atomic 클래스를, 복잡한 경우에는 Lock이나 synchronized를 사용하는 식으로 설계하면 됩니다.
