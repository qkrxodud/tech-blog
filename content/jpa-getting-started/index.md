---
title: "JPA 시작하기"
tags: ["JPA","Hibernate","EntityManager","persistence.xml","JPQL"]
summary: "JPA 프로젝트에 필요한 라이브러리 설정부터 EntityManager로 엔티티를 저장·조회하는 기본 동작 방식, JPQL 사용법까지 정리합니다."
---

## 1. 라이브러리 추가

- pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>jpa-basic</groupId>
    <artifactId>ex1-hello-jpa</artifactId>
    <version>1.0.0</version>

    <dependencies>
<!-- JPA 하이버네이트 --><dependency>
            <groupId>org.hibernate</groupId>
            <artifactId>hibernate-entitymanager</artifactId>
            <version>5.3.10.Final</version>
        </dependency>
<!-- H2 데이터베이스 --><dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <version>1.4.200</version>
        </dependency>

        <dependency>
            <groupId>javax.xml.bind</groupId>
            <artifactId>jaxb-api</artifactId>
            <version>2.3.0</version>
        </dependency>
    </dependencies>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
    </properties>

</project>
```

## 2. JPA 설정하기

- JPA 설정 파일
- /META-INF/persistence.xml 위치
- persistence-unit name으로 이름 지정
- javax.persistence로 시작: JPA 표준 속성
- hibernate로 시작: 하이버네이트 전용 속성
- persistence.xml 생성

```xml
<?xml version="1.0" encoding="UTF-8"?>
<persistence version="2.2"
             xmlns="http://xmlns.jcp.org/xml/ns/persistence" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/persistence http://xmlns.jcp.org/xml/ns/persistence/persistence_2_2.xsd">
    <persistence-unit name="hello">
        <properties>
<!-- 필수 속성 --><property name="javax.persistence.jdbc.driver" value="org.h2.Driver"/>
            <property name="javax.persistence.jdbc.user" value="sa"/>
            <property name="javax.persistence.jdbc.password" value=""/>
            <property name="javax.persistence.jdbc.url" value="jdbc:h2:tcp://localhost/~/test"/>
            <property name="hibernate.dialect" value="org.hibernate.dialect.H2Dialect"/>

<!-- 옵션 --><property name="hibernate.show_sql" value="true"/><!--쿼리가 로그에 보인다. --><property name="hibernate.format_sql" value="true"/><!--쿼리가 로그 정렬되서 보이게 해준다. --><property name="hibernate.use_sql_comments" value="true"/><!--쿼리가 왜 나오는지 알려준다. --><!--<property name="hibernate.hbm2ddl.auto" value="create" />--></properties>
    </persistence-unit>
</persistence>

```

## 3. JPA 구동 방식

1. Persistence에서 persistence.xml 설정 정보를 조회합니다.
2. Persistence에서 EntityManagerFactory를 생성합니다.
3. EntityManagerFactory에서 EntityManager를 생성합니다.

## 4. 기본 동작 방식 구현

### 1) 객체와 테이블을 생성하고 매핑하기

- @Entity : JPA가 관리할 객체
- @Id : 데이터베이스 PK와 매핑

```java
package helloJpa;

import javax.persistence.Entity;
import javax.persistence.Id;

@Entity
public class Member {

    @Id
    private Long id;
    private String name;

    public void setId(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
```

### 2) 회원 저장, 등록, 수정, 삭제 구현하기

- EntityManagerFactory는 애플리케이션에서 한 개만 만들어져야 합니다.
- EntityManager는 하나의 단위를 만들 때마다 만들어 줘야 합니다. 그래서 절대 EntityManager는 스레드 간에 공유하면 안 됩니다.
- JPA는 트랜잭션 안에서 동작해야 하며, JPA가 잘 작동하면 커밋을 통해서 DB insert를 완료해줘야 합니다.
- insert 도중 에러가 발생하면 롤백시켜줘야 합니다.
- 항상 사용 후에는 close를 해줘야 합니다.

```arduino
package helloJpa;

import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.EntityTransaction;
import javax.persistence.Persistence;

public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.

        EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.

        EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
            Member member = new Member();
            member.setId(1L);
            member.setName("HelloA");
            em.persist(member);
            tx.commit();
        } catch (Exception e) {
            tx.rollback();
        } finally {
            em.close();
        }
        emf.close();
    }
}

```

## 5. JPQL 소개

- JPA는 가장 단순한 조회 방법
    - EntityManager.find()
    - 객체 그래프 탐색(a.getB(). getC())
- 나이가 18살 이상인 회원을 모두 검색하고 싶다면?

```swift
package helloJpa;

import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.EntityTransaction;
import javax.persistence.Persistence;
import java.util.List;

public class JpaMain {

    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("hello");// 애플리케이션 에서 한개만 만들어 져야된다.
				EntityManager em = emf.createEntityManager();//하나의 단위를 만들때마다 만들어 줘야된다.
				EntityTransaction tx = em.getTransaction();
        tx.begin();

        try {
// Member findMember = em.find(Member.class, 1L);// findMember.setName("HelloJpa");// JPQL 사용방법List<Member> resultList = em.createQuery("select m from Member as m", Member.class).
                    getResultList();

            for (Member member : resultList) {
                System.out.println("member.name = " + member.getName());
            }

            tx.commit();
        } catch (Exception e) {
            tx.rollback();
        } finally {
            em.close();
        }
        emf.close();
    }
}

```

- JPA로 조회하기 힘든 쿼리가 있다면, JPQL을 통해서 조회하면 됩니다. 하지만 여기서도 중요한 점이 있습니다.
- JPQL은 객체 엔티티를 기반으로 조회한다는 것입니다. 이는 환경설정에서 H2 Database가 아닌 MySQL DB로 변경 시 해당하는 쿼리에 맞게 자동으로 조회하는 역할을 해줍니다.(SQL을 추상화해서 특정 데이터베이스 SQL에 의존하지 않습니다.)

**결론**

- JPA, JPQL은 모두 객체의 엔티티를 기반으로 조회하기 때문에 데이터베이스를 변경하면 그에 맞게 JPA가 자동으로 쿼리를 변경해줍니다.
- 이제 데이터베이스 기반과 객체지향에서 발생하는 괴리에서 벗어날 수 있습니다.

> 이 글은 인프런 김영한 님의 [자바 ORM 표준 JPA 프로그래밍 — 기본편](https://www.inflearn.com/course/ORM-JPA-Basic)을 들으며 정리한 노트입니다.
