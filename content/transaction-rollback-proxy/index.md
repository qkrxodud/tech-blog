---
title: "[Java] @Transactional 롤백 안 되는 원인 [프록시]"
tags: ["@Transactional","프록시","자기 호출","REQUIRES_NEW","Spring AOP"]
summary: "같은 서비스 안에서 @Transactional 메서드를 자기 호출하면 프록시가 적용되지 않아 롤백이 안 되는 원인을 정리합니다."
---

오늘은 회사 동료분이 트랜잭션이 안 되는 원인을 공유해 주셔서, 좋은 글이라 작성하게 되었습니다.

**요청사항**

- 회원 전체데이터를 일괄로 수정
- 수정 도중 실패한다면 실패한 회원만 롤백
- 회원 수정 이력에는 실패와 성공에 대한 데이터를 저장

**구현 방법**

- 일괄로 회원정보를 수정하는 함수를 `@Transactional`로 구현
- 단일 회원정보를 수정하는 함수를 `@Transactional`로 구현 → 전파 속성을 `propagation = Propagation.REQUIRES_NEW`로 설정
- 단일 회원정보 함수를 빠져나와 → 일괄 처리에 실패와 성공한 케이스에 대해 저장하는 로직 구현

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberService{
    
    private final MemberRepository memberRepository;
    private final MemberHistoryRepository memberHistoryRepository;
    
    
    @Transactional
    public saveMembers(List<Member> members) {
        for (Member member : members) {
            this.saveMember(member);
        }
        memberHistoryRepository.save(members);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public saveMember(Member member) {
        memberRepository.save(member);
    }

}
```

**문제 발생**

- 회원 하나에서 exception이 발생하면 트랜잭션이 전부 롤백되는 현상이 발생합니다.

**문제 원인**

- **하나의 Bean에서 `@Transactional` 함수를 호출하면 프록시 함수로** 인식하지 못하게 되고 결국 일반 함수로 호출되는 것처럼 동작합니다. 이 때문에 일괄 롤백이 진행됩니다.

**문제 해결방법**

- 서비스를 분리하여 호출하면 제대로 트랜잭션이 동작합니다. ***하지만 궁금한 점은 서비스에서 서비스를 호출하게 되면 복잡도가 올라가게 되므로 질문을 하였습니다.***

**답변 내용**

> 💡 서비스에서 서비스를 호출하는 구조는 피하고 도메인 레이어에 도메인 서비스를 둬서 처리하는 것을 최범균님이 쓰신 '도메인 주도 개발 시작하기(DDD Start)'에서 본 적이 있습니다.
>
> 그리고 여러 건 처리를 할 때와 단건 처리를 할 때 트랜잭션을 명시적으로 처리하면 부분 실패와 성공에 대해 읽고 수정하기가 더 좋을 것 같습니다.

도메인 주도 개발 시작하기에 대해 읽어보고 후기를 작성하도록 하겠습니다.

### 결론

같은 서비스 레이어에서 `@Transactional` → `@Transactional` 함수를 호출하면 일반 함수와 같이 작동한다는 것을 알 수 있었고, 이를 방지하기 위해서는 서비스 레이어를 분리해야 합니다. 그러나 복잡도가 올라가기 때문에 이를 해결하기 위해 도메인 주도 개발에 대해 알아보고 정리하도록 하겠습니다.

### 프록시 관련 설명

[Spring JPA] 프록시

12장 시스템 (2)
