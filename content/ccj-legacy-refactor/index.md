---
title: "레거시 코드 리팩터링 — 1단계"
tags: ["TDD","리팩터링","클린 코드","Java","레거시 코드"]
summary: "레거시 QnaService의 삭제 로직을 도메인 모델로 옮기는 리팩터링 과제와 그에 대한 리뷰 피드백을 정리합니다."
---

## 질문 삭제하기 요구사항

- 질문 데이터를 완전히 삭제하는 것이 아니라 데이터의 상태를 삭제 상태(deleted - boolean type)로 변경합니다.
- 로그인 사용자와 질문한 사람이 같은 경우 삭제 가능합니다.
- 답변이 없는 경우 삭제가 가능합니다.
- 질문자와 답변글의 모든 답변자가 같은 경우 삭제가 가능합니다.
- 질문을 삭제할 때 답변 또한 삭제해야 하며, 답변의 삭제 또한 삭제 상태(deleted)로 변경합니다.
- 질문자와 답변자가 다른 경우 답변을 삭제할 수 없습니다.
- 질문과 답변 삭제 이력에 대한 정보를 DeleteHistory를 활용해 남깁니다.

## 리팩터링 요구사항

- nextstep.qna.service.QnaService의 deleteQuestion()는 앞의 질문 삭제 기능을 구현한 코드입니다. 이 메서드는 단위 테스트하기 어려운 코드와 단위 테스트 가능한 코드가 섞여 있습니다.
- QnaService의 deleteQuestion() 메서드에서 단위 테스트 가능한 코드(핵심 비즈니스 로직)를 도메인 모델 객체에 구현합니다.
- QnaService의 비즈니스 로직을 도메인 모델로 이동하는 리팩터링을 진행할 때 TDD로 구현합니다.
- QnaService의 deleteQuestion() 메서드에 대한 단위 테스트는 src/test/java 폴더의 nextstep.qna.service.QnaServiceTest입니다. 도메인 모델로 로직을 이동한 후에도 QnaServiceTest의 모든 테스트는 통과해야 합니다.

```java
public class QnAService {
    public void deleteQuestion(NsUser loginUser, long questionId) throws CannotDeleteException {
        Question question = questionRepository.findById(questionId).orElseThrow(NotFoundException::new);
        if (!question.isOwner(loginUser)) {
            throw new CannotDeleteException("질문을 삭제할 권한이 없습니다.");
        }

        List<Answer> answers = question.getAnswers();
        for (Answer answer : answers) {
            if (!answer.isOwner(loginUser)) {
                throw new CannotDeleteException("다른 사람이 쓴 답변이 있어 삭제할 수 없습니다.");
            }
        }

        List<DeleteHistory> deleteHistories = new ArrayList<>();
        question.setDeleted(true);
        deleteHistories.add(new DeleteHistory(ContentType.QUESTION, questionId, question.getWriter(), LocalDateTime.now()));
        for (Answer answer : answers) {
            answer.setDeleted(true);
            deleteHistories.add(new DeleteHistory(ContentType.ANSWER, answer.getId(), answer.getWriter(), LocalDateTime.now()));
        }
        deleteHistoryService.saveAll(deleteHistories);
    }
}
```

## 피드백

리뷰어: Service Layer 로직을 도메인 객체로 이동, 정말 잘 했습니다. 💯 특별히 피드백할 부분이 보이지 않습니다. 빠른 미션 진행을 위해 제가 대신 리뷰를 진행했습니다. 내일 강의 마지막 날이지만 2단계까지 한번 도전해 보시죠.

- 깃허브 링크 :

[https://github.com/next-step/java-lms/pull/154](https://github.com/next-step/java-lms/pull/154)

---

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
