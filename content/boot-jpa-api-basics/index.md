---
title: "스프링 부트와 JPA로 만드는 API 기본"
tags: ["Spring Boot","JPA","API","DTO","Java"]
summary: "회원 등록·수정·조회 API를 예제로, 엔티티 대신 DTO를 사용해 API 스펙과 엔티티를 분리하는 방법을 정리합니다."
---

## API 패키지 구성

화면에 구성되는 정보와 API로 제공되는 정보는 서로 다르기 때문에, 패키지를 두 개로 나누는 경우가 많습니다.

## 회원 등록 API

### V1 엔티티를 Request Body에 직접 매핑

- V1 엔티티를 Request Body에 직접 매핑
    - 문제점
        - 엔티티에 프레젠테이션 계층을 위한 로직이 추가됩니다.
        - 엔티티에 API 검증을 위한 로직이 들어갑니다. (@NotEmpty 등등)
        - 실무에서는 회원 엔티티를 위한 API가 다양하게 만들어지는데, 한 엔티티에 각각의 API를 위한 모든 요청 요구사항을 담기는 어렵습니다.
        - **엔티티가 변경되면 API 스펙이 변합니다. → 엔티티를 손대서 API 스펙이 변경되면서 사이드 이펙트가 발생합니다.**

            → **해결 방법: API 요청 스펙에 맞추어 별도의 DTO를 파라미터로 받습니다.**

## V2 엔티티 대신에 DTO를 RequestBody에 매핑

```java
@PostMapping("/api/v2/members")
public CreateMemberResponse saveMemberV2(@RequestBody @Valid CreateMemberRequest request) {
	Member member = new Member();
	member.setName(request.getName());
	Long id = memberService.join(member);
	return new CreateMemberResponse(id);
}

@Data
    static class CreateMemberRequest {
        private String name;
    }

@Data
@AllArgsConstructor
static class CreateMemberResponse {
    private Long id;
}
```

- CreateMemberRequest를 Member 엔티티 대신 RequestBody와 매핑합니다.
- 엔티티와 프레젠테이션 계층을 위한 로직을 분리할 수 있습니다.
- 엔티티와 API 스펙을 명확하게 분리할 수 있습니다.
- 엔티티가 변해도 API 스펙이 변하지 않습니다.

## 회원 수정 API

```java
package jpabook.jpashop.api;

import jpabook.jpashop.domain.Member;
import jpabook.jpashop.service.MemberService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class MemberApiController {

    private final MemberService memberService;

    @PutMapping("/api/v2/members/{id}")
    public UpdateMemberResponse updateMemberV2(@PathVariable("id") Long id,
                                               @RequestBody @Valid UpdateMemberRequest request) {

        memberService.update(id, request.getName());
        Member findMember =  memberService.findOne(id);
        return  new UpdateMemberResponse(findMember.getId(), findMember.getName());
    }

    @Data
    static class UpdateMemberRequest {
        private String name;
    }

    @Data
    @AllArgsConstructor
    static class UpdateMemberResponse {
        private Long id;
        private String name;
    }
}
```

회원 수정도 DTO를 요청 파라미터에 매핑합니다.

```java
public class MemberService {
	private final MemberRepository memberRepository;
	
	@Transactional
	public void update(Long id, String name) {
		Member member = memberRepository.findOne(id);
		member.setName(name);
	}
}
```

업데이트의 경우 가급적 변경 감지를 사용해야 합니다.

업데이트 후 멤버를 반환해도 되지만, 애매해지는 부분이 있습니다.

커맨드(변경성 업데이트)와 쿼리(조회하는 쿼리)를 철저하게 분리하는 것이 좋습니다.

→ MemberService의 update는 리턴을 받지 않고 업데이트합니다.

→ Member findMember = memberService.findOne(id);로 다시 조회합니다.

## 회원 조회 API

```java
package jpabook.jpashop.api;

import jpabook.jpashop.domain.Member;
import jpabook.jpashop.service.MemberService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class MemberApiController {

    private final MemberService memberService;

    @GetMapping("/api/v1/members")
    public List<Member> membersV1() {
        return memberService.findMembers();
    }

    @GetMapping("/api/v2/members")
    public Result memberV2() {
        List<Member> findMembers = memberService.findMembers();
        List<MemberDto> memberDtos = findMembers.stream()
                .map(m -> new MemberDto(m.getName()))
                .collect(Collectors.toList());

        return new Result(memberDtos);
    }

    @Data
    @AllArgsConstructor
    static class MemberDto {
        private String name;
    }

    @Data
    @AllArgsConstructor
    static class Result<T> {
        private T data;
    }   
}
```

```java
@GetMapping("/api/v1/members")
public List<Member> membersV1() {
    return memberService.findMembers();
}
```

조회 V1: 응답 값으로 엔티티를 직접 외부에 노출합니다.

- 문제점
    - 엔티티에 프레젠테이션 계층을 위한 로직이 추가됩니다.
    - 기본적으로 엔티티의 모든 값이 노출됩니다.
    - 응답 스펙을 맞추기 위해 로직이 추가됩니다. (@JsonIgnore, 별도의 뷰 로직 등등)
    - 실무에서는 같은 엔티티에 대해 API가 용도에 따라 다양하게 만들어지는데, 한 엔티티에 각각의
    API를 위한 프레젠테이션 응답 로직을 담기는 어렵습니다.
    - 엔티티가 변경되면 API 스펙이 변합니다.
    - 추가로 컬렉션을 직접 반환하면 향후 API 스펙을 변경하기 어렵습니다. (별도의 Result 클래스 생성으로
    해결)
- 결론
    - API 응답 스펙에 맞추어 별도의 DTO를 반환합니다.
    
    **엔티티를 외부에 노출하지 마세요!**
    
    > 실무에서는 member 엔티티의 데이터가 필요한 API가 계속 증가하게 됩니다. 어떤 API는 name 필드가
    필요하지만, 어떤 API는 name 필드가 필요 없을 수 있습니다. **결론적으로 엔티티 대신에 API 스펙에 맞는
    별도의 DTO를 노출해야 합니다.**
    > 
    

```java
@GetMapping("/api/v2/members")
public Result memberV2() {
    List<Member> findMembers = memberService.findMembers();
    List<MemberDto> memberDtos = findMembers.stream()
            .map(m -> new MemberDto(m.getName()))
            .collect(Collectors.toList());

    return new Result(memberDtos);
}
```

회원 조회 V2: 응답 값으로 엔티티가 아닌 별도의 DTO를 사용합니다.

- 엔티티를 DTO로 변환해서 반환합니다.
- 엔티티가 변해도 API 스펙이 변경되지 않습니다.
- 추가로 Result 클래스로 컬렉션을 감싸서 향후 필요한 필드를 추가할 수 있습니다.

> 이 글은 인프런 김영한 님의 [실전! 스프링 부트와 JPA 활용](https://www.inflearn.com/course/스프링부트-JPA-활용-1)을 들으며 정리한 노트입니다.
