---
title: "회원 관리 예제 — 백엔드 개발 (1)"
tags: ["Spring","회원 관리","Repository","JUnit","테스트 코드"]
summary: "회원 도메인과 메모리 기반 리포지토리를 인터페이스로 설계하고, JUnit으로 저장/조회 기능을 검증하는 과정을 정리합니다."
---

**비즈니스 요구사항 정리**

- 데이터 : 회원 ID, 이름
- 기능 : 회원 등록, 조회
- 아직 데이터 저장소가 선정되지 않음(가상의 시나리오)

**일반적인 웹 애플리케이션 계층 구조**

- 컨트롤러 : 웹 MVC의 컨트롤러 역할
- 서비스 : 핵심 비즈니스 로직 구현
- 리포지토리 : 데이터베이스에 접근, 도메인 객체를 DB에 저장하고 관리
- 도메인 : 비즈니스 도메인 객체, 예) 회원, 주문, 쿠폰 등 주로 데이터베이스에 저장하고 관리됨

## 1. Repository interface 구현

- 현재 비즈니스 로직에서 데이터 저장소가 선정되지 않았다고 가정하기 때문에, 인터페이스로 구현하고 차후 저장소가 선정되면 변경합니다.

```java
package hello.hellospring.repository;

import hello.hellospring.domain.Member;

import java.util.List;
import java.util.Optional;

public interface MemberRepository {
    Member save(Member member);// 저장
		Optional<Member> findById(Long id);// 아이디 조회
		Optional<Member> findByName(String name);// 이름으로 조회
		List<Member> findAll();// 전체 조회
}
```

## 2. Member 도메인 구현

- id는 자동으로 추가되도록 long으로 설정합니다.

```java
package hello.hellospring.domain;

public class Member {

    Long id;
    String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
```

## 3. MemoryMemberRepository 인터페이스 구현체 구현

- 저장소는 모든 클래스에서 데이터를 사용하므로 static으로 구현했고, 맵을 통해 key 값으로 출력될 수 있게 설계했습니다.

```java
package hello.hellospring.repository;

import hello.hellospring.domain.Member;

import java.util.*;

public class MemoryMemberRepository implements MemberRepository{
    private static Map<Long, Member> store = new HashMap<>();
    private static long seq = 0L;

    @Override
    public Member save(Member member) {
        member.setId(++seq);
        store.put(member.getId(), member);
        return member;
    }

    @Override
    public Optional<Member> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Member> findByName(String name) {
        return store.values().stream().filter(member -> member.getName().equals(name)).findAny();
    }

    @Override
    public List<Member> findAll() {
        return new ArrayList<>(store.values());
    }

    public void clearStore() {
        store.clear();
    }
}
```

## 4. JUnit 테스트 구현

- 도메인과 리포지토리 설계를 마쳤다면 간단한 테스트가 가능합니다.
- test> java> hello.hellospring> repository> MemoryMemberRepositoryTest를 만듭니다.

```java
package hello.hellospring.repository;

import hello.hellospring.domain.Member;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

public class MemoryMemberRepositoryTest {
    MemoryMemberRepository repository = new MemoryMemberRepository();

    @AfterEach
    public void afterEach() {
        repository.clearStore();
    }

    @Test
    public void save() {
        Member member = new Member();
        member.setName("spring");

        repository.save(member);

        assertThat(repository.findById(member.getId()).get()).isEqualTo(member);
    }

    @Test
    public void findByName() {
        Member member1 = new Member();
        member1.setName("spring1");
        repository.save(member1);

        Member member2 = new Member();
        member2.setName("spring2");
        repository.save(member2);

        assertThat(repository.findByName("spring1").get()).isEqualTo(member1);
    }

    @Test
    public void findById() {
        Member member1 = new Member();
        member1.setName("spring1");
        repository.save(member1);

        Member member2 = new Member();
        member2.setName("spring2");
        repository.save(member2);

        assertThat(repository.findById(member1.getId()).get()).isEqualTo(member1);
    }

    @Test
    public void findAll() {
        Member member1 = new Member();
        member1.setName("spring1");
        repository.save(member1);

        Member member2 = new Member();
        member2.setName("spring2");
        repository.save(member2);

        assertThat(repository.findAll().size()).isEqualTo(2);
    }

}
```

모든 테스트는 순서와 상관없이 함수 별로 따로 동작하게 해야 합니다.

이 때문에 afterEach 함수를 통해서 각 함수가 실행될 때마다 MemoryMemberRepository를 clear로 초기화해줘야 합니다.

- @AfterEach : 각 함수가 끝나는 시점에 항상 실행시켜주는 애노테이션입니다.
- @Test : JUnit 애노테이션으로, 해당 함수가 테스트 메서드이며 각자 실행된다는 것을 명시합니다.
- assertThat : 기대한 값과 실제 값이 맞는지 확인하는 함수입니다.

이를 통해서 순서와 상관없이 각각의 함수를 테스트하고 잘 동작하는지 확인할 수 있습니다.

물론 클래스 전체를 동작시킬 수도 있습니다.

> 결론
>
> 저는 개인적으로 다른 것보다 테스트하는 클래스를 만들고 각각의 함수별로 테스트하는 것을 처음 접해보았습니다. 항상 개발을 하다 보면 테스트보다는 동작을 우선시하게 되는데, 이러한 기능이 있다면 생각지 못한 예외들에 대해서 좀 더 유연하게 대처할 수 있을 것 같고, 이런 간단한 테스트 말고 TDD도 공부해야겠다는 생각이 들었습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
