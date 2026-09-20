---
title: "[GIT] commit message 규칙"
tags: ["Git", "커밋 메시지", "커밋 컨벤션", "협업", "nextstep"]
summary: "Git 커밋 메시지를 작성할 때 지켜야 할 7가지 규칙과 타입(feat, fix 등) 구분 기준을 정리합니다."
---

오늘은 nextstep에서 다른 개발자들이 커밋한 메시지를 보다가, 규칙이 있는 것을 보고 정리하게 되었습니다.

저도 해당하는 규칙을 지키고 싶고, 적용하는 습관을 가지려고 보기 쉬운 곳에 작성하게 되었습니다.

### Commit Message 규칙 7가지

1. 제목과 본문을 빈 행으로 구분한다
2. 제목을 50글자 내로 제한
3. 제목 첫 글자는 대문자로 작성
4. 제목 끝에 마침표 넣지 않기
5. 제목은 명령문으로 사용하며 과거형을 사용하지 않는다
6. 본문의 각 행은 72글자 내로 제한
7. 어떻게 보다는 무엇과 왜를 설명한다

Commit Message 구조

```markdown
type(타입) : title(제목)

body(본문, 생략 가능)

Resolves : #issue, ...(해결한 이슈 , 생략 가능)

See also : #issue, ...(참고 이슈, 생략 가능)
```

Commit Message 타입(type)

1. feat : 새로운 기능 추가
2. fix : 버그 수정
3. Docs : 문서 수정
4. Style : 스타일 관련 코드 
5. refactor: 코드 리팩토링
6. test : 테스트코드, 리팩토링 테스트 코드 추가
7. CHORE: 빌드, 패키지 매니저 수정

해당하는 링크를 참조하여 작성하였습니다.

[Git Commit Message 규칙](https://jason-api.tistory.com/89)
