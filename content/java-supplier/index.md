---
title: "[Java] 공급자 Supplier<T>"
tags: ["Java","Supplier","함수형 인터페이스","람다","지연 초기화"]
summary: "Java의 함수형 인터페이스 Supplier의 개념과 사용법, 지연 초기화(Lazy Initialization)에 활용되는 이유를 예제로 정리합니다."
---

### Supplier

공급자 Supplier 인터페이스는 Java의 함수형 프로그래밍을 지원하는 인터페이스 중 하나로, 아래와 같은 상황에서 사용합니다.

```java
public interface Supplier<T> {

    /**
     * Gets a result.
     *
     * @return a result
     */
    T get();
}
```

### 사용방법

**Supplier 사용 방법**

**`Supplier`** 인터페이스는 **`get`** 메서드를 정의하며, 이 메서드를 구현하여 객체를 생성하고 반환합니다.

```java
import java.util.function.Supplier;

public class SupplierExample {
    public static void main(String[] args) {
        // Supplier를 사용하여 문자열을 생성하는 팩토리 함수
        Supplier<String> stringSupplier = () -> "Hello, World!";

        // Supplier의 get 메서드를 호출하여 객체 생성
        String message = stringSupplier.get();

        System.out.println(message); // "Hello, World!"
    }
}
```

**Custom 클래스와 함께 사용하는 Supplier**

```java
import java.util.function.Supplier;

class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

    @Override
    public String toString() {
        return "Person{name='" + name + "', age=" + age + '}';
    }
}

public class SupplierWithCustomClass {
    public static void main(String[] args) {
        // 사용자 정의 클래스 Person을 생성하는 Supplier
        Supplier<Person> personSupplier = () -> new Person("Alice", 30);

        // Supplier의 get 메서드를 호출하여 Person 객체 생성
        Person person = personSupplier.get();

        // Person 객체 출력
        System.out.println(person);  // 출력: Person{name='Alice', age=30}
    }
}
```

**Primitive 타입에 대한 Supplier**

```java
import java.util.function.IntSupplier;
import java.util.function.DoubleSupplier;
import java.util.function.LongSupplier;

public class PrimitiveSupplierExample {
    public static void main(String[] args) {
        // IntSupplier를 사용하여 int 값을 생성
        IntSupplier intSupplier = () -> 42;
        int intValue = intSupplier.getAsInt();
        System.out.println("Int Value: " + intValue);  // 출력: Int Value: 42

        // DoubleSupplier를 사용하여 double 값을 생성
        DoubleSupplier doubleSupplier = () -> 3.14;
        double doubleValue = doubleSupplier.getAsDouble();
        System.out.println("Double Value: " + doubleValue);  // 출력: Double Value: 3.14

        // LongSupplier를 사용하여 long 값을 생성
        LongSupplier longSupplier = () -> 123456789L;
        long longValue = longSupplier.getAsLong();
        System.out.println("Long Value: " + longValue);  // 출력: Long Value: 123456789
    }
}
```

### 왜 사용하는가?

1. 지연 초기화(Lazy Initialization): **Supplier**를 사용하면 객체 생성을 **필요한 순간까지 미룰 수 있습니다.** 이는 성능 향상 및 자원 절약을 위해 유용합니다.

```java
public class LazyEvaluation {
		public static void main(String[] args) {
				long start = System.currentTimeMillis();
				printIfValidIndex(10, getValue());
				printIfValidIndex(-10, getValue());
				System.out.println("It took" + ((System.currentTimeMillis() - start) / 1000) + " Second");
		}

		private static String getValue() {
				try {
						TimeUnit.SECONDS.sleep(1);
				} catch (InterruptedException e) {
						e.printStackTrace();
				}
		}
		
		private static void printIfValidIndex(int number, String value) {
				if (number > 0) {
						System.out.println(value);
						return;
				}
				System.out.println("Invalid");
		}
}
```

위 예시는 `printIfValidIndex` 함수가 호출되기 전에 `getValue`가 호출되기 때문에 2초의 지연이 발생합니다.

```java
public class LazyEvaluation {
		public static void main(String[] args) {
				long start = System.currentTimeMillis();
				printIfValidIndex(10, () -> getValue());
				printIfValidIndex(-10, () -> getValue());
				System.out.println("It took" + ((System.currentTimeMillis() - start) / 1000) + " Second");
		}

		private static String getValue() {
				try {
						TimeUnit.SECONDS.sleep(1);
				} catch (InterruptedException e) {
						e.printStackTrace();
				}
		}
		
		private static void printIfValidIndex(int number, Supplier<String> valueSupplier) {
				if (number > 0) {
						System.out.println(valueSupplier.get());
						return;
				}
				System.out.println("Invalid");
		}
}
```

위 예시는 람다식을 사용해서 `() -> getValue()`를 Supplier로 받아 사용하는 예시로, `printIfValidIndex`가 호출될 때 `valueSupplier.get()`을 사용해서 호출합니다. 이를 통해 조건이 맞을 경우에만 호출되어 1초만 지연됩니다.

참고

[[Java] 공급자 Supplier<T>](https://hwan33.tistory.com/17)
