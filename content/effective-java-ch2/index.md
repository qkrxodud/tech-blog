---
title: "이펙티브 자바 2장: 객체 생성과 파괴"
tags: ["이펙티브 자바","Java","정적 팩터리 메서드","빌더 패턴","객체지향 설계"]
summary: "이펙티브 자바 2장을 바탕으로 정적 팩터리 메서드와 빌더 패턴을 활용한 올바른 객체 생성 방법을 정리합니다."
---

객체를 만들어야 할 때와 만들지 말아야 할 때를 구분하는 법, 올바른 객체 생성 방법과 불필요한 생성을 피하는 방법에 대해 정리합니다.

## 생성자 대신 정적 팩터리 메서드를 고려하라

**장점**

1. 이름을 가질 수 있습니다.
    
    ```jsx
    BigInteger bigInteger = new BigInteger(int ,int, Random);
    BigInteger bigInteger = BigInteger.probablePrime();
    ```
    
2. 호출할 때마다 인스턴스를 새로 생성하지는 않아도 됩니다.
    
    ```jsx
    Boolean isTrue = new Boolean(true);
    Boolean isFalse = new Boolean(false);
    ```
    
    ```jsx
    Boolean isTrue = Boolean.valueOf(true);
    Boolean isfalse = Boolean.valueOf(false);
    
    public final class Boolean implements java.io.Serializable, Comparable<Boolean>{
    	public static final Boolean TRUE = new Boolean(true);
      public static final Boolean FALSE = new Boolean(false);
    
    	public static Boolean valueOf(boolean b) {
    	    return (b ? TRUE : FALSE);
    	}
    }
    ```
    
3. 반환 타입의 하위 타입 객체를 반환할 수 있는 능력이 있습니다.
    
    ```jsx
    public Member {
    		public Member() {}
    }
    
    public RegularMember extends Member {
    		public RegularMember() {}
    }
    
    public GeneralMember extends Member {
    		public GeneralMember() {}
    }
    
    public MemberFactory {
    		private static final String MEMBER_ERROR = "일치하는 회원이 없습니다.";
    	
    		public static Member of(Type type) {
    			if (type.isRegularMember) {
    				return new RegularMember();
    			}
    			if (type.isGeneralMember) {
    				return new GeneralMember();
    			}
    			new throw MemberException(MEMBER_ERROR);
    		}
    }
    ```
    
4. 입력 매개변수에 따라 매번 다른 클래스의 객체를 반환할 수 있습니다.
    
    ```jsx
    // Shape 인터페이스
    interface Shape {
        void draw();
    }
    
    // Circle 클래스
    class Circle implements Shape {
        @Override
        public void draw() {
            System.out.println("원 그리기");
        }
    }
    
    // Rectangle 클래스
    class Rectangle implements Shape {
        @Override
        public void draw() {
            System.out.println("사각형 그리기");
        }
    }
    
    class ShapeFactory {
        public static Shape createShape(String shapeType) {
            if (shapeType.equalsIgnoreCase("원")) {
                return new Circle();
            } else if (shapeType.equalsIgnoreCase("사각형")) {
                return new Rectangle();
            } else {
                return null;
            }
        }
    }
    ```
    
5. 정적 팩터리 메서드를 작성하는 시점에는 반환할 객체의 클래스가 존재하지 않아도 됩니다.

**단점**

1. 상속을 하려면 public 이나 protected 생성자가 필요하니 정적 팩터리 메서드만 제공하면 하위 클래스를 만들 수 없습니다.
2. 정적 팩터리 메서드는 프로그래머가 찾기 어렵습니다.

정적 팩터리 메서드를 사용하는 방법

- `from` : 하나의 매개 변수를 받아서 객체를 생성
- `of` : 여러개의 매개 변수를 받아서 객체를 생성
- `getInstance` | `instance` : 인스턴스를 생성. 이전에 반환했던 것과 같을 수 있음.
- `newInstance` | `create` : 새로운 인스턴스를 생성
- `get[OtherType]` : 다른 타입의 인스턴스를 생성. 이전에 반환했던 것과 같을 수 있음.
- `new[OtherType]` : 다른 타입의 새로운 인스턴스를 생성.

> **핵심정리**
> 정적 팩터리 메서드와 public 생성자는 각자의 쓰임새가 있으니 상대적인 장단점을 이해하고 사용하는 것이 좋습니다. 그렇다고 하더라도 정적 팩터리를 사용하는 게 유리한 경우가 더 많으므로, 무작정 public 생성자를 제공하던 습관이 있다면 고치는 것이 좋습니다.

## 생성자에 매개변수가 많다면 빌더를 고려하라

정적 팩터리와 생성자에는 제약이 하나 있습니다. 선택적 매개변수가 많을 때 적절히 대응하기 어렵다는 점입니다.

```jsx
public class Product {
    private String name;
    private String description;
    private double price;
    private int quantity;

    public Product(String name) {
        this.name = name;
    }

    public Product(String name, String description) {
        this(name);
        this.description = description;
    }

    public Product(String name, String description, double price) {
        this(name, description);
        this.price = price;
    }

    public Product(String name, String description, double price, int quantity) {
        this(name, description, price);
        this.quantity = quantity;
    }
}
```

보통 이런 생성자는 사용자가 설정하길 원치 않는 매개변수까지 포함하기 쉬운데, 어쩔 수 없이 그런 매개변수에도 값을 지정해줘야 합니다. **점층적 생성자 패턴도 쓸 수는 있지만, 매개변수 개수가 많아지면 클라이언트 코드를 작성하거나 읽기 어렵습니다.** 다행히 우리에겐 점층적 생성자 패턴의 안정성과 자바빈즈 패턴의 가독성을 겸비한 빌더 패턴이 있습니다.

```jsx
public class Product {
    private String name;
    private String description;
    private double price;
    private int quantity;

    private Product(Builder builder) {
        this.name = builder.name;
        this.description = builder.description;
        this.price = builder.price;
        this.quantity = builder.quantity;
    }

    public static class Builder {
        private String name;
        private String description;
        private double price;
        private int quantity;

        public Builder(String name) {
            this.name = name;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder price(double price) {
            this.price = price;
            return this;
        }

        public Builder quantity(int quantity) {
            this.quantity = quantity;
            return this;
        }

        public Product build() {
            return new Product(this);
        }
    }
}
```

```jsx
Product product = new Product.Builder("Sample Product")
        .description("This is a sample product.")
        .price(19.99)
        .quantity(100)
        .build();
```

빌더 패턴은 계층적으로 설계된 클래스와 함께 쓰기에 좋습니다.

```java
public abstract class Pizza{
   public enum Topping { HAM, MUSHROOM, ONION, PEPPER, SAUSAGE }
   final Set<Topping> toppings;

   abstract static class Builder<T extends Builder<T>> {
      EnumSet<Topping> toppings = EnumSet.noneOf(Topping.class);
      public T addTopping(Topping topping) {
         toppings.add(Objects.requireNonNull(topping));
         return self();
      }

      abstract Pizza build();

      protected abstract T self();
   }

   Pizza(Builder<?> builder) {
      toppings = builder.toppings.clone();
   }
}

```

`Pizza.Builder` 클래스는 재귀적 타입 한정을 이용하는 제네릭 타입입니다. 여기에 추상 메서드인 `self()`를 두어, 하위 클래스가 자기 자신의 타입을 반환하도록 했습니다.

```java
public class NyPizza extends Pizza {
   public enum Size { SMALL, MEDIUM, LARGE }
   private final Size size;

   public static class Builder extends Pizza.Builder<Builder> {
      private final Size size;

      public Builder(Size size) {
         this.size = Objects.requireNonNull(size);
      }

      @Override public NyPizza build() {
         return new NyPizza(this);
      }

      @Override protected Builder self() { return this; }
   }

   private NyPizza(Builder builder) {
      super(builder);
      size = builder.size;
   }
}
```

```java

public class Calzone extends Pizza {
   private final boolean sauceInside;

   public static class Builder extends Pizza.Builder<Builder> {
      private boolean sauceInside = false;

      public Builder sauceInside() {
         sauceInside = true;
         return this;
      }

      @Override public Calzone build() {
         return new Calzone(this);
      }

      @Override protected Builder self() { return this; }
   }

   private Calzone(Builder builder) {
      super(builder);
      sauceInside = builder.sauceInside;
   }
}
```
