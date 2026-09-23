---
title: "수강신청 DB 적용 — 3단계"
tags: ["TDD","클린 코드","Java","매핑","수강신청"]
summary: "2단계에서 만든 도메인 구조를 유지하면서 DB 테이블과 매핑한 수강신청 미션 3단계 리뷰 기록입니다."
---

## 핵심 학습 목표

- 2단계에서 구현한 객체 구조(도메인 구조)를 가능한 유지하면서 DB 테이블과 매핑합니다.
- 성능보다 도메인 객체에 로직을 구현하는 것을 목표로 연습합니다.
    - 객체 구조를 유지하기 위해 여러 번의 DB 쿼리를 실행해도 괜찮습니다.

## 수강 신청 기능 요구사항 — 2단계와 동일

- 과정(Course)은 기수 단위로 여러 개의 강의(Session)를 가질 수 있습니다.
- 강의는 시작일과 종료일을 가집니다.
- 강의는 강의 커버 이미지 정보를 가집니다.
- 강의는 무료 강의와 유료 강의로 나뉩니다.
- 강의 상태는 준비중, 모집중, 종료 3가지 상태를 가집니다.
- 강의 수강신청은 강의 상태가 모집중일 때만 가능합니다.
- 강의는 강의 최대 수강 인원을 초과할 수 없습니다.

## 프로그래밍 요구사항

- 앞 단계에서 구현한 도메인 모델을 DB 테이블과 매핑하고, 데이터를 저장합니다.

## 피드백

리뷰어:

도메인 객체와 DB를 매핑하느라 노력한 흔적이 보이네요. 👍

DB 매핑 객체를 도메인 객체로 변환하는 부분도 보이네요.

도메인 객체와 DB 매핑 객체 관련해 피드백을 남겨봤어요.

- 리뷰어: 메서드 이름을 putStudent, removeStudent로 정하면 자료구조에 데이터를 추가하고 제거하는 느낌이 듭니다. 이보다는 도메인 의도가 드러나도록 enroll(수강신청), cancel(수강취소)와 같은 이름으로 구현하면 어떨까요?

    ```java

    public void changeStudents(Students students) {
        this.students = students;
    }

    public void removeStudent(NsUser nsUser) {
    ```

    - 생각정리: 자료구조 데이터를 추가하고 제거한다는 느낌보다는, 동작에 초점을 맞춰 함수명을 작명하도록 해야겠습니다.

        ```java
        public void enroll(NsUser nsUser) {
                checkValidation();
                students.enroll(nsUser);
            }

            public void cancel(NsUser nsUser) {
                students.removeEntity(nsUser);
            }
        ```

- 리뷰어: 수강신청한 학생의 목록은 SessionUserMapping을 가지는 것은 어떨까요?

    ```java
    private List<NsUser> users = new ArrayList<>();
    ```

    - 생각정리: 어차피 수강에 대한 데이터는 SessionUserMapping이 갖고 있으니, 해당하는 객체로 옮기는 것이 맞다고 생각합니다.

        ```java
        private List<SessionUserMapping> users = new ArrayList<>();
        ```

관련 PR: [https://github.com/next-step/java-lms/pull/201](https://github.com/next-step/java-lms/pull/201)

---

> 이 글은 넥스트스텝의 [TDD, 클린 코드 with Java](https://edu.nextstep.camp/c/O0pDe1b) 과정을 들으며 정리한 노트입니다.
