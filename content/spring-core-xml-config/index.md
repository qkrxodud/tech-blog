---
title: "XML로 스프링 빈 설정하기"
tags: ["Spring","XML","BeanDefinition","스프링 컨테이너","AppConfig"]
summary: "자바 코드 대신 XML로 스프링 빈을 설정하는 방법과, 다양한 설정 형식을 가능하게 하는 BeanDefinition 추상화를 정리합니다."
---

지금은 많이 사용하지 않지만 과거에는 XML로 Config 설정을 했습니다.

XML 빈 설정을 하는 것을 보니 예전에 학원에서 배웠던 XML 파일이 생각났습니다.

Config.java에서 Config.xml로 어떻게 변경하는지 살펴보겠습니다.

## appConfig.xml의 소스 구성

```java
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">
    <bean id="memberService" class="hello.core.member.MemberServiceImpl">
        <constructor-arg name="memberRepository" ref="memberRepository"/>
    </bean>
    <bean id="memberRepository" class="hello.core.member.MemoryMemberRepository"/>

    <bean id="orderService" class="hello.core.order.OrderServiceImpl">
        <constructor-arg name="memberRepository" ref="memberRepository"/>
        <constructor-arg name="discountPolicy" ref="discountPolicy"/>
    </bean>

    <bean id="discountPolicy" class="hello.core.discount.RateDiscountPolicy"/>
</beans>
```

## appConfig.xml 단위 테스트

```java
package hello.core.xml;

import hello.core.member.MemberService;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.GenericXmlApplicationContext;

import static org.assertj.core.api.Assertions.*;

public class XmlAppContext {
    @Test
    void xmlAppContext() {
        ApplicationContext ac = new GenericXmlApplicationContext("appConfig.xml");

        MemberService memberService = ac.getBean("memberService", MemberService.class);
        assertThat(memberService).isInstanceOf(MemberService.class);

    }
}
```

## 스프링 빈 설정 메타 정보 - BeanDefinition

- 스프링은 어떻게 이런 다양한 설정 형식을 지원하는 것일까요? 그 중심에는 BeanDefinition이라는 추상화가 있습니다.
- 역할과 구현을 개념적으로 나눈 것입니다.
    - XML을 읽어서 BeanDefinition을 만들고
    - 자바 코드를 읽어서 BeanDefinition을 만들면 됩니다.
    - 스프링 컨테이너는 자바 코드인지 XML인지 몰라도 되며, 오직 BeanDefinition만 알면 됩니다.
- BeanDefinition을 빈 설정 메타 정보라고 합니다.
    - @Bean, <bean> 태그당 각각 하나씩 메타 정보가 생성됩니다.
- 스프링 컨테이너는 이 메타 정보를 기반으로 스프링 빈을 생성합니다.

## 코드 레벨을 높여 깊이 들어가보기

- AnnotationConfigApplicationContext는 AnnotatedBeanDefinitionReader를 사용해서 AppConfig.class를 읽고 BeanDefinition을 생성합니다.
- GenericXmlApplicationContext는 XmlBeanDefinitionReader를 사용해서 appConfig.xml을 읽고 BeanDefinition을 생성합니다.
- 새로운 형식의 설정 정보가 추가되면 XxxBeanDefinitionReader를 만들어 BeanDefinition을 생성하면 됩니다.

> 결론
>

스프링의 메타 정보도 역할과 구현을 구분해서, ApplicationContext는 BeanDefinition만 DI로 받고 무엇이 오든 동작하도록 잘 설계되어 있었습니다. 이를 통해 확장성이 얼마나 용이한지 다시 한번 느낄 수 있었습니다.

---

> 이 글은 인프런 김영한 님의 [스프링 핵심 원리 — 기본편](https://www.inflearn.com/course/스프링-핵심-원리-기본편)을 들으며 정리한 노트입니다.
