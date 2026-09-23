---
title: "중급 문법"
tags: ["Querydsl","DTO 프로젝션","동적 쿼리","벌크 연산","JPA"]
summary: "Querydsl의 프로젝션과 DTO 조회 방법, BooleanBuilder와 Where절을 활용한 동적 쿼리, 벌크 연산과 SQL Function 호출법을 정리합니다."
---

## 프로젝션과 결과 반환 - 기본

**프로젝션: select 대상 지정**

**프로젝션 대상이 하나**

```java
@Test
   public void simpleProjection() {
       List<String> fetch = queryFactory
               .select(member.username)
               .from(member)
               .fetch();
       for (String username : fetch) {
           System.out.println("username = " + username);
       }
   }
```

- 프로젝션 대상이 하나면 타입을 명확하게 지정할 수 있습니다.
- 프로젝션 대상이 둘 이상이면 튜플이나 DTO로 조회합니다.

**튜플조회**

프로젝션 대상이 둘 이상일 때 사용합니다.

`com.query.core.Tuple`

```java
@Test
    public void tupleProjection() {
       List<Tuple> fetch = queryFactory
               .select(member.username, member.age)
               .from(member)
               .fetch();

       for (Tuple tuple : fetch) {
           String username = tuple.get(member.username);
           Integer integer = tuple.get(member.age);

           System.out.println("username = " +username);
           System.out.println("age = " + integer);
       }
   }
```

> 참고: 리포지토리 계층에서 사용하는 것을 권장합니다. 튜플은 Querydsl에 종속적인 타입이기 때문에 유지보수 측면에서 외부로 나갈 때는 DTO로 바꾸는 것이 바람직합니다.

## 프로젝션과 결과 반환 - DTO 조회

**실무에서 많이 사용하는 방법입니다.**

순수 JPA에서 DTO를 조회합니다.

**MemberDto**

```java
package study.querydsl.dto;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberDto {

    private String username;
    private int age;

    public MemberDto(String username, int age) {
        this.username = username;
        this.age = age;
    }
}
```

**순수 JPA에서 DTO 조회 코드**

```java
@Test
    public void findMemberDtoByJQPL() {
       List<MemberDto> resultList = em.createQuery("select new study.querydsl.dto.MemberDto(m.username, m.age) from Member m", MemberDto.class)
               .getResultList();

       for (MemberDto member1 : resultList) {
           System.out.println("member  = " + member1.getUsername());
           System.out.println("member  = " + member1.getAge());
       }
   }
```

**단점**

- 순수 JPA에서 DTO를 조회할 때는 new 명령어를 사용해야 합니다.
- DTO의 package 이름을 다 적어줘야 해서 지저분합니다.
- 생성자 방식만 지원합니다.

**Querydsl 빈 생성(Bean population)**

결과를 DTO로 반환할 때 사용합니다.

다음 3가지 방법을 지원합니다.

- 프로퍼티 접근
- 필드 직접 접근
- 생성자 사용

**프로퍼티 접근 - setter**

```java
@Test
    public void findMemberDtoBySetter() {
       List<MemberDto> fetch = queryFactory
               .select(Projections.bean(MemberDto.class,
                       member.username,
                       member.age))
               .from(member)
               .fetch();

       for (MemberDto memberDto : fetch) {
           System.out.println(memberDto.getUsername());
           System.out.println(memberDto.getAge());
       }
   }
```

**필드 직접 접근**

```java
@Test
    public void findMemberDtoByFields() {
       List<MemberDto> fetch = queryFactory
               .select(Projections.fields(MemberDto.class,
                       member.username,
                       member.age))
               .from(member)
               .fetch();
       for (MemberDto memberDto : fetch) {
           System.out.println(memberDto.getUsername());
           System.out.println(memberDto.getAge());
       }
   }
```

**별칭이 다를 때**

```java
package study.querydsl.dto;

import lombok.Data;

@Data
public class UserDto {

    private String username;
    private int age;
}
```

```java
@Test
    public void findUserDtoByFields() {
        QMember subMember = new QMember("subMember");

        List<UserDto> fetch = queryFactory
                .select(Projections.fields(UserDto.class,
                        member.username.as("name"),
                        ExpressionUtils.as(
                                JPAExpressions
                                .select(subMember.age.max())
                                .from(subMember), "age")))
                .from(member)
                .fetch();
        for (UserDto userDto : fetch) {
            System.out.println(userDto.getUsername());
            System.out.println(userDto.getAge());
        }
    }
```

- 프로퍼티나 필드 접근 생성 방식에서 이름이 다를 때의 해결 방안입니다.
- `ExpressionUtils.as(source,alias)`: 필드나 서브 쿼리에 별칭을 적용합니다.
- `username.as("memberName")`: 필드에 별칭을 적용합니다.

**생성자 사용**

```java
@Test
    public void findMemberDtoByConstructor() {
       List<MemberDto> fetch = queryFactory
               .select(Projections.constructor(MemberDto.class,
                       member.username,
                       member.age))
               .from(member)
               .fetch();
       for (MemberDto memberDto : fetch) {
           System.out.println(memberDto.getUsername());
           System.out.println(memberDto.getAge());
       }
   }
```

## 프로젝션과 결과 반환 - @QueryProjection

**생성자 + @QueryProjection**

```java
package study.querydsl.dto;

import com.querydsl.core.annotations.QueryProjection;
import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberDto {

    private String username;
    private int age;

    @QueryProjection
    public MemberDto(String username, int age) {
        this.username = username;
        this.age = age;
    }
}
```

- ./gradlew compileQuerydsl
- QMemberDto 생성을 확인합니다.

**@QueryProjection 활용**

```java
@Test
    public void findDtoByQueryProjection() {
        List<MemberDto> result = queryFactory
                .select(new QMemberDto(member.username, member.age))
                .from(member)
                .fetch();

        for (MemberDto memberDto : result) {
            System.out.println(" memberDto  = " + memberDto.getUsername());
            System.out.println(" memberDto  = " + memberDto.getAge());
        }
    }
```

> 이 방법은 컴파일로 타입을 체크할 수 있으므로 가장 안전한 방법입니다. 다만 DTO에 Querydsl 애노테이션을 유지해야 하는 점과 DTO까지 Q 파일을 생성해야 하는 단점이 있습니다.
>
> 이렇게 되면 많은 곳에서 사용되는 DTO 관점에서 **Querydsl에 의존관계가 성립되어서 순수하게 사용하지 못하게 되는 단점이 발생합니다.**

**distinct**

```java
List<String> result = queryFactory
 .select(member.username).distinct()
 .from(member)
 .fetch();
```

> 참고: distinct는 JPQL의 distinct와 같습니다.

## 동적 쿼리 - BooleanBuilder 사용

동적 쿼리를 해결하는 두 가지 방식입니다.

- BooleanBuilder
- Where 다중 파라미터 사용

```java
@Test
    public void 동적쿼리_booleanBuilder() throws Exception {
        String usernameParam = "member1";
        Integer agePara = 10;

        List<Member> result = searchMember1(usernameParam, agePara);
        for (Member member1 : result) {
            System.out.println("member1" + member1.getUsername());
            System.out.println("member1" + member1.getAge());
        }
    }

    private List<Member> searchMember1(String usernameParam, Integer agePara) {
        BooleanBuilder builder = new BooleanBuilder();

        if (usernameParam != null) {
            builder.and(member.username.eq(usernameParam));
        }

        if (agePara != null) {
            builder.and(member.age.eq(agePara));
        }
        return queryFactory
                .selectFrom(member)
                .where(builder)
                .fetch();
    }
```

## 동적 쿼리 - Where 다중 파라미터 사용

```java
@Test
    public void 동적쿼리_WhereParam() throws Exception {
        String usernameParam = "member1";
        Integer ageParam = 10;

        List<Member> result = searchMember2(usernameParam, ageParam);
        assertThat(result.size()).isEqualTo(1);
    }

    private List<Member> searchMember2(String usernameCond, Integer ageCond) {
        return queryFactory
                .select(member)
                .from(member)
                .where(allEq(usernameCond, ageCond))
                .fetch();
    }

    private BooleanExpression ageEq(Integer ageCond) {
        return ageCond != null ? member.age.eq(ageCond) : null;
    }

    private BooleanExpression usernameEq(String usernameCond) {
        return usernameCond != null ? member.username.eq(usernameCond) : null;
    }

    private BooleanExpression allEq(String usernameCond, Integer ageCond) {
        return usernameEq(usernameCond).and(ageEq(ageCond));
    }
```

- `where` 조건에 `null` 값은 무시됩니다.
- 메서드를 다른 쿼리에서도 재활용할 수 있습니다.
- 쿼리 자체의 가독성이 높아집니다.

## 수정, 삭제 벌크 연산

**쿼리 한 번으로 대량 데이터 수정**

```java
@Test
    public void bulkUpdate() {
        long count = queryFactory
                .update(member)
                .set(member.username, "비회원")
                .where(member.age.lt(28))
                .execute();

    }
```

**기존 숫자에 1 더하기**

```java
@Test
    public void bulkAddUpdate() {
        long count = queryFactory
                .update(member)
                .set(member.age, member.age.add(1))
                .execute();
    }
```

**기존 숫자에 곱하기**

```java
@Test
    public  void bulkMultiUpdate() {
        long count = queryFactory
                .update(member)
                .set(member.age, member.age.multiply(2))
                .execute();
    }
```

**쿼리 한 번으로 대량 데이터 삭제**

```java
@Test
    public void bulkDelete() {
        long count = queryFactory
                .delete(member)
                .where(member.age.gt(18))
                .execute();
    }
```

> 주의: JPQL 배치와 마찬가지로, 영속성 컨텍스트에 있는 엔티티를 무시하고 실행되기 때문에 배치 쿼리를 실행하고 나면 영속성 컨텍스트를 초기화하는 것이 안전합니다.
>
> em.flush(), em.clear()

## SQL Function 호출하기

SQL function은 JPA와 같이 Dialect에 등록된 내용만 호출할 수 있습니다.

**member→M으로 변경하는 replace 함수 사용**

```java
@Test
    public void sqlFunction() {
        List<String> fetch = queryFactory
                .select(
                        Expressions.stringTemplate("function('replace', {0}, {1}, {2})", member.username, "member", "M")
                )
                .from(member)
                .fetch();

        for (String member : fetch) {
            System.out.println(member);
        }
    }
```

**소문자로 변경해서 비교합니다.**

```java
@Test
    public void sqlLowerFunction() {
        List<String> fetch = queryFactory
                .select(member.username)
                .from(member)
                //.where(member.username.eq(Expressions.stringTemplate("function('lower', {0})", member.username)))
                .where(member.username.eq(member.username.lower()))
                .fetch();
        for (String memberName : fetch) {
            System.out.println(memberName);
        }

    }
```

> DB의 내장 함수를 따로 선언해서 사용해야 하는 경우가 있다면, JPA 기본 문법에서 다이얼렉트 내장 클래스를 상속해서 사용하는 방법을 참고하세요.

> 이 글은 인프런 김영한 님의 [실전! Querydsl](https://www.inflearn.com/course/querydsl-실전)을 들으며 정리한 노트입니다.
