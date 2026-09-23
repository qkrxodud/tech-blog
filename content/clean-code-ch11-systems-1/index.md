---
title: "[Clean Code] 11장 시스템 (1)"
tags: ["클린 코드","의존성 주입","추상 팩토리","DI"]
summary: "클린 코드 11장을 읽고 시스템 제작과 사용의 분리, Main 분리, 추상 팩토리, 의존성 주입 개념을 예제와 함께 정리합니다."
---

- **도시가 잘 돌아가는 이유**
    - 수도권 관리팀, 전력 관리팀, 교통 관리 팀, 치안 관리 팀, 건축물 관리 팀 등 각 분야를 관리하는 팀이 있습니다.
    - 적절한 추상화와 모듈 때문입니다. 그래서 큰 그림을 이해하지 못할지라도 개인과 개인이 관리하는 '구성요소'는 효율적으로 돌아갑니다.

- 흔히 소프트웨어 팀도 도시처럼 구성합니다.
    - 깨끗한 코드를 구현하면 낮은 추상화 수준에서 관심사를 분리하기 쉬워집니다.

높은 추상화 수준, 즉 시스템 수준에서도 깨끗함을 유지하는 방법을 살펴보겠습니다.

- **시스템 제작과 시스템 사용을 분리하라**

    제작은 사용과 아주 다릅니다.

    > 💡 소프트웨어 시스템은 (애플리케이션 객체를 제작하고 의존성을 서로 '연결' 하는) 준비 과정과 (준비 과정 이후에 이어지는) 런타임 로직을 분리해야 합니다.

    대다수의 애플리케이션은 시작 단계라는 관심사를 분리하지 않습니다.

    준비 과정 코드를 주먹구구식으로 구현할 뿐만 아니라 런타임 로직과 마구 뒤섞습니다.

    아래 예제를 보겠습니다.

    ```java
    public Service getService() {
          if (service == null)
              service = new MyServiceImpl(...);// 모든 상황에 적합한 기본값일까?return service;
      }
    ```

    이것이 초기화 지연 혹은 계산 지연이라는 기법입니다.

    **장점**은

    - 실제로 필요할 때까지 객체를 생성하지 않으므로 불필요한 부하가 걸리지 않습니다.
    - 어떠한 경우에도 null 포인터를 반환하지 않습니다.

    **단점**은

    - getService 메서드가 MyServiceImpl과 생성자 인수에 명시적으로 의존합니다.
    - 런타임 로직에서 MyServiceImpl 객체를 전혀 사용하지 않더라도 의존성을 해결하지 않으면 컴파일이 안 됩니다.
    - MyServiceImpl이 무거운 객체라면 단위 테스트에서 getService 메서드를 호출하기 전에 적절한 테스트 전용 객체를 Service 필드에 할당해야 합니다.
    - 일반 런타임 로직에다 객체 생성 로직을 섞어놓은 탓에 (Service가 null인 경로와 null이 아닌 경로 등) 모든 실행 경로도 테스트해야 합니다. 책임이 둘이라는 말은 메서드가 작업을 두 가지 이상 수행한다는 의미입니다. 단일 책임 원칙 위배입니다.
    - 무엇보다! MyServiceImpl이 모든 상황에 적합한 객체인지 모른다는 사실입니다.

    초기화 지연 기법을 한 번 정도 사용한다면 별로 심각한 문제가 아닙니다. 하지만 많은 애플리케이션이 이처럼 좀스러운 설정 기법을 수시로 사용합니다.


- **Main 분리**

    시스템 생성과 시스템 사용을 분리하는 한 가지 방법으로, 생성과 관련한 코드는 모두 main이나 main이 호출하는 모듈로 옮기고, 나머지 시스템은 모든 객체가 생성되었고 모든 의존성이 연결되었다고 가정합니다.


- **팩토리**

    물론 때로는 객체가 생성되는 시점을 애플리케이션이 결정할 필요도 생깁니다.

    예를 들어, 주문처리 시스템에서 애플리케이션은 LineItem 인스턴스를 생성해 Order에 추가합니다. 이때는 ABSTRACT FACTORY 패턴을 사용합니다.

    여기서 ABSTRACT FACTORY 패턴? 이 부분이 와닿지 않았습니다.

    또한 설명도 코드가 없이 진행되는 부분이 있어서, 따로 찾아서 이해해보았습니다.

    *추상 팩토리 패턴*

    > 💡 서로 관련이 있는 객체들을 통째로 묶어서 팩토리 클래스로 만들고, 이들 팩토리를 조건에 따라 생성하도록 다시 팩토리를 만들어서 객체를 생성하는 패턴

    예를 들어

    자동차 관련 클래스로 정의해 보았습니다.

    ```java
    public enum CarType {
    	SPORTS, SUV, ...
    }

    // 메인클레스 구현
    public class Main {
    	public static void main(String [] args) {
            CarFactory carFactory = new CarFactory();
        	CarProcessing carProcessing = CarProcessing(carFactory);

        }
    }

    // 자동차 프로세싱 클래스 구현
    public class CarProcessing {
    	public void createCarProcessing(CarFactory carFactory) {
       		carFactory.createCar(CarType.SPORTS);
            ...// 추가적인 다른 로직들
        }

    }

    // 추상 클래스 팩토리 구성
    public class CarFactory {
    	public Car createCar(CarType Type) {
        	Car car = null;
            switch (type) {
            	case SPORTS :
                	car = new SportsCar();
                	break;
                case SUV :
                	car = new SUVCar();
                	break;
                   	 .
                   	 .
                   	 .
            }
            return car;
        }
    }

    // 추상 클래스 구성
    public interface Car {

    }

    // 스포츠카 클래스 구성
    public class SportsCar implements Car {
        public SportsCar() {
            System.out.println("슈퍼카 생성")
        }
    }

    // SUV카 클래스 구성
    public class SUVCar implements Car {
        public SUVCar() {
            System.out.println("슈퍼카 생성")
        }
    }
    ```

    의존성이 main에서 CarProcessing 애플리케이션으로 향합니다.

    즉, CarProcessing 애플리케이션은 Car 인터페이스가 생성되는 구체적인 방법을 모릅니다. 그 방법은 main 쪽에 있는 CarFactory입니다.

    그럼에도 CarProcessing 애플리케이션은 Car 인스턴스가 생성되는 시점을 완벽하게 통제하며, 필요하다면 CarProcessing 애플리케이션에서만 사용하는 생성자 인수도 넘길 수 있습니다.

- **의존성 주입**

    사용과 제작을 분리하는 강력한 메커니즘 하나가 의존성 주입 DI(Dependency Injection)입니다.

    - 제어 역전 기법을 의존성 관리에 적용한 메커니즘입니다. 제어의 역전에서는 한 객체가 맡은 보조 책임을 새로운 객체에게 전적으로 떠넘깁니다.
    - 의존성 관리 맥락에서 객체는 의존성 자체를 인스턴스로 만드는 책임은 지지 않습니다. 대신 다른 전담 메커니즘에게 제어를 역전합니다.

    의존성 주입에 대해 알고 있기는 하나, 위와 같이 얘기를 통해서만 진행한다면 이해하기 어렵다고 느꼈습니다.

    *의존성 주입 코드 부연설명*

    자동차는 자동차 바퀴에 의존해서 달립니다.

    자동차 바퀴가 변경하게 될 시, 자동차는 자동차 바퀴의 모양과 버전에 맞춰 내부를 변경해야 됩니다.

    바퀴의 변경이 자동차의 행위에 영향을 미쳤기 때문입니다. 이때 "자동차는 자동차 바퀴에 의존한다"라고 말할 수 있습니다.

    다음을 코드로 구현해 보도록 하겠습니다.

    ```java
    // 자동차 클레스class Car {
    	private CarWheel carWheel;

        public Car() {
        	carWheel = new CarWheel();
        }
    }
    ```

    다양한 바퀴에 의존할 수 있게 수정해보도록 하겠습니다.

    ```java
    // 자동차 클레스class Car {
    	private CarWheel carWheel;

        public Car() {
        	carWheel = new SportsCarWheel();
    //carWheel = new SuvCarWheel();
        }
    }

    // 자동차 바퀴 인터페이스 클레스
    public interface carWheel {

    }

    // 스포츠자동차 바퀴 클레스
    class SportsCarWheel implements carWheel {
        public SportsCarWheel() {
            System.out.println("스포츠카 바퀴 생성");
        };
    }

    // SUV자동차 바퀴 클레스
    class SuvCarWheel implements carWheel {
        public SportsCarWheel() {
            System.out.println("SUV카 바퀴 생성");
        };
    }
    ```

    이렇게 의존관계를 인터페이스로 추상화하게 만들 경우, 다형성을 활용해 다양한 관계를 맺을 수 있고 낮은 결합도로 관계가 느슨하게 됩니다.

    위 관계는 내부 클래스에서 의존관계를 만들었다면, DI는 외부에서 의존관계를 주입해준다는 것입니다.

    아래 코드를 확인해 보겠습니다.

    ```java
    //자동차 소유자
    class CarOwner {
        private Car car = new Car(new SportsCarWheel());

        public void changeWheel(CarWheel carWheel) {
            car.changeWheel(carWheel);
        }
    }

    // 자동차 클레스
    class Car {
        private CarWheel carWheel;

        public Car(CarWheel carWheel) {
        	this.carWheel = carWheel;
        }

        public void changeWheel(CarWheel carWheel) {
            this.carWheel = carWheel;
        }
    }

    // 자동차 바퀴 인터페이스 클레스
    public interface carWheel {

    }

    // 스포츠자동차 바퀴 클레스
    class SportsCarWheel implements carWheel {
        public SportsCarWheel() {
            System.out.println("스포츠카 바퀴 생성");
        };
    }

    // SUV자동차 바퀴 클레스
    class SuvCarWheel implements carWheel {
        public SportsCarWheel() {
            System.out.println("SUV카 바퀴 생성");
        };
    }
    ```

    위와 같이 필요한 클래스를 직접 생성하는 것이 아닌 외부에서 클래스를 주입해줌으로써 객체 간의 결합도를 낮추고 확장성을 높이는 코드를 구현할 수 있게 됩니다.


## 결론

오늘은 11장 시스템에 대해 설명하게 되었습니다. 글을 읽으면서 코드가 적혀 있지 않아서, 이해하는 부분에서 좀 어려움을 느꼈습니다.

글도 전부 어려운 단어로 작성되어 있어서, 단어 한 개 한 개 생각하면서 읽었습니다.

이렇게 블로그를 정리하면서 작성하니, 완전히 이해하지 못했던 부분을 (다형성, 의존성 주입, 추상화 팩토리) 이해할 수 있어서 좋았고, 개발에 대한 자신감도 좀 더 생겼습니다.

무엇보다, 높은 응집도와 낮은 결합도에 대해 좀 더 깊은 생각을 할 수 있어서 좋았고, 다음 시간에는 11장을 이어서 설명하도록 하겠습니다.
