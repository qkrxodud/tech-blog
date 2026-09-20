---
title: "프로젝트 환경설정"
tags: ["Spring Data JPA", "JPA", "Gradle", "H2", "Spring Boot"]
summary: "스프링 데이터 JPA 실습 프로젝트의 Gradle 설정, 라이브러리 구성, H2 데이터베이스 연동과 기본 동작 확인 과정을 정리합니다."
---

## Gradle 전체 설정

- 사용 기능: web, jpa, h2, lombok
    - SpringBootVersion: 2.6.7
    - groupId: study
    - artifactId: data-jpa
    
    ```java
    plugins {
    	id 'org.springframework.boot' version '2.6.7'
    	id 'io.spring.dependency-management' version '1.0.11.RELEASE'
    	id 'java'
    }
    
    group = 'study'
    version = '0.0.1-SNAPSHOT'
    sourceCompatibility = '11'
    
    configurations {
    	compileOnly {
    		extendsFrom annotationProcessor
    	}
    }
    
    repositories {
    	mavenCentral()
    }
    
    dependencies {
    	implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    	implementation 'org.springframework.boot:spring-boot-starter-web'
    	compileOnly 'org.projectlombok:lombok'
    	runtimeOnly 'com.h2database:h2'
    	annotationProcessor 'org.projectlombok:lombok'
    	testImplementation 'org.springframework.boot:spring-boot-starter-test'
    	implementation 'com.github.gavlyukovskiy:p6spy-spring-boot-starter:1.5.7'
    }
    
    tasks.named('test') {
    	useJUnitPlatform()
    }
    ```
    
- 동작 확인
    - 기본 테스트 케이스 실행
    - 스프링 부트 메인 실행 후 에러페이지로 간단하게 동작 확인
    - 테스트 컨트롤러를 만들어서 spring web 동작 확인

## 테스트 컨트롤러

```java
package study.datajpa.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @RequestMapping("/hello")
    public String hello() {
        return "hello";
    }
}
```

> 참고: 최근 Intellij 버전은 Gradle로 실행하는 것이 기본 설정입니다. 이렇게 하면 실행 속도가 느립니다. 다음과 같이 변경하면 자바로 바로 실행하므로 좀 더 빨라집니다.
>
> Preferences → Build, Execution, Deployment → Build Tools → Gradle
>
> Build and run using: Gradle → IntelliJ IDEA
>
> Run tests using: Gradle → IntelliJ IDEA

롬복 적용

1. Preferences → plugin → lombok 검색 실행(재시작)
2. Preferences → Annotation Processors 검색 → Enable annotation processing 체크
3. 임의의 테스트 클래스를 만들고 @Getter, @Setter 확인

## 라이브러리 살펴보기

**gradle 의존관계 보기**

`./gradlew dependencies --configuration compileClasspath`

**스프링 부트 라이브러리 살펴보기**

- spring-boot-starter-web
    - spring-boot-starter-tomcat: 톰캣(웹서버)
    - spring-webmvc: 스프링 웹 MVC
- spring-boot-starter-data-jpa
    - spring-boot-starter-aop
    - spring-boot-starter-jdbc
        - HikariCp 커넥션 풀
    - hibernate + JPA: 하이버네이트 + JPA
    - spring-data-jpa: 스프링 데이터 JPA
- spring-boot-starter(공통): 스프링 부트 + 스프링 코어 + 로깅
- spring-boot
    - spring-core
- spring-boot-starter-logging
    - logback, slf4j

**테스트 라이브러리**

- spring-boot-starter-test
    - junit: 테스트 프레임워크, 스프링 부트 2.2부터 JUnit5(Jupiter) 사용
        - 과거 버전은 vintage
    - mockito: 목 라이브러리
    - assertj: 테스트 코드를 좀 더 편하게 작성하게 도와주는 라이브러리
    - spring-test: 스프링 통합 테스트 지원
- 핵심 라이브러리
    - 스프링 MVC
    - 스프링 ORM
    - JPA, 하이버네이트
    - 스프링 데이터 JPA
- 기타 라이브러리
    - H2 데이터베이스 클라이언트
    - 커넥션 풀: 부트 기본은 HikariCp
    - 로깅 SLF4J&LogBack
    - 테스트

**H2 데이터베이스 설치**

개발이나 테스트 용도로 가볍고 편리한 DB, 웹 화면 제공

- [https://www.h2database.com](https://www.h2database.com)
- 다운로드 및 설치
- h2 데이터베이스 버전은 스프링 부트 버전에 맞춥니다.
- 데이터베이스 파일 생성 방법
    - `jdbc:h2:~/datajpa` (최소 한번)
    - `~/datajpa.mv.db` 파일 생성 확인
    - 이후부터는 `jdbc:h2:tcp://localhost/~/datajpa` 이렇게 접속

## 스프링 데이터 JPA와 DB설정, 동작확인

application.yaml

```java
spring:
  datasource:
    url: jdbc:h2:tcp://localhost/~/jpashop
    username: sa
    password : 1
    driver-class-name: org.h2.Driver

  jpa:
    hibernate:
      ddl-auto: create
    properties:
      hibernate:
#        show_sql: true
        format_sql: true
#        default_batch_fetch_size : 1000

logging:
  level:
    org.hibernate.SQL: debug
#    org.hibernate.type: trace
```

- spring.jpa.hibernate.ddl-auto: create
    - 이 옵션은 애플리케이션 실행 시점에 테이블을 drop 하고, 다시 생성합니다.

> 참고: **모든 로그 출력은 가급적 로거를 통해 남겨야 합니다.**
>
> `show_sql:` 옵션은 `System.out`에 하이버네이트 실행 SQL을 남깁니다.
>
> `org.hibernate.SQL` 옵션은 logger를 통해 하이버네이트 실행 SQL을 남깁니다.

## 실제 동작하는지 확인하기

회원 엔티티

```java
package study.datajpa.Entity;

import lombok.Getter;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;

@Entity
@Getter
public class Member {

    @Id @GeneratedValue
    private Long id;
    private String name;

    protected Member() {

    }

    public Member(String name) {
        this.name = name;
    }
}
```

회원 JPA 리포지토리

```java
package study.datajpa.repository;

import org.springframework.stereotype.Repository;
import study.datajpa.Entity.Member;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

@Repository
public class MemberJpaRepository {
    @PersistenceContext
    private EntityManager em;

    public Member save(Member member) {
        em.persist(member);
        return member;
    }

    public Member find(Long id) {
        return em.find(Member.class, id);
    }
}
```

JPA 기반 테스트

```java
package study.datajpa.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;
import study.datajpa.Entity.Member;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
@Rollback(false)
class MemberJpaRepositoryTest {

    @Autowired
    MemberJpaRepository jpaRepository;

    @Test
    public void testMember() {
        Member member = new Member("memberA");
        Member saveMember = jpaRepository.save(member);
        Member findMember = jpaRepository.find(saveMember.getId());

        assertThat(findMember.getId()).isEqualTo(member.getId());
        assertThat(findMember.getName()).isEqualTo(member.getName());

        assertThat(findMember).isEqualTo(member);
    }
}
```

스프링 데이터 JPA 리포지토리

```java
package study.datajpa.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import study.datajpa.Entity.Member;

public interface MemberRepository extends JpaRepository<Member, Long> {
}
```

스프링 데이터 JPA 기반 테스트

```java
package study.datajpa.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;
import study.datajpa.Entity.Member;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
@Rollback(value = false)

class MemberRepositoryTest {

    @Autowired
    MemberRepository memberRepository;

    @Test
    public void testMember() {
        Member member = new Member("memberA");
        Member saveMember = memberRepository.save(member);

        Member findMember = memberRepository.findById(member.getId()).get();

        assertThat(findMember.getId()).isEqualTo(member.getId());
        assertThat(findMember.getName()).isEqualTo(member.getName());

        assertThat(findMember).isEqualTo(member);
    }

}
```

- Entity, Repository 동작 확인
- jar 빌드해서 동작 확인

> 참고: 스프링 부트를 통해 복잡한 설정이 다 자동화되었습니다. persistence.xml 도 없고, LocalContainerEntityManagerFactoryBean 도 없습니다. 스프링 부트를 통한 추가 설정은 스프링 부트 매뉴얼을 참고하세요.

## 쿼리 파라미터 로그 남기기

- 로그에 `org.hibernate.type`을 추가하면 SQL 실행 파라미터를 로그로 남길 수 있습니다.
- 외부 라이브러리 사용
    - https://github.com/gavlyukovskiy/spring-boot-data-source-decorator
- 스프링 부트를 사용하면 라이브러리만 추가하면 됩니다.

> 이 글은 인프런 김영한 님의 [실전! 스프링 데이터 JPA](https://www.inflearn.com/course/스프링-데이터-JPA-실전)을 들으며 정리한 노트입니다.
