---
title: "@Mock, @MockBean, @Spy, @SpyBean, @InjectMocks"
tags: ["Spring","테스트 코드","Mockito","MockBean","SpyBean"]
summary: "Mockito의 @Mock, @MockBean, @Spy, @SpyBean, @InjectMocks 애노테이션의 차이와 단위·통합 테스트에서의 활용법을 예제 코드로 정리합니다."
---

### @Mock

**정의**

- 단위 테스트를 위한 가짜(Mock) 객체를 생성
- 실제 객체 없이도 테스트 가능

**특징**

- 모든 메소드는 기본적으로 아무 동작도 하지 않음
- when().thenReturn() 등으로 원하는 동작 정의 필요
- 단위 테스트에서 주로 사용

```java
@ExtendWith(MockitoExtension.class)
class MailServiceTest {
    @Mock
    private MailSendClient mailSendClient;
    
    @Mock 
    private MailSendHistoryRepository mailSendHistoryRepository;
    
    @InjectMocks
    private MailService mailService;
    
    @DisplayName("메일 전송 테스트 - Mock 사용")
    @Test
    void sendMailTest() {
        // given
        String to = "test@test.com";
        String subject = "테스트";
        String content = "테스트 내용";
        String fromEmail = "from@test.com";
        
        //동작 정의
        when(mailSendClient.sendEmail(anyString(), anyString(), anyString(), anyString()))
            .thenReturn(true);
            
        // when
        boolean result = mailService.sendEmail(to, subject, content, fromEmail);
        
        // then
        assertThat(result).isTrue();
        verify(mailSendClient, times(1))
            .sendEmail(to, subject, content, fromEmail);
    }
}
```

### @MockBean

**정의**

- 스프링 컨텍스트에서 특정 빈을 가짜 객체로 대체
- 통합 테스트에서 사용

**특징**

- 스프링 부트 테스트에서 사용
- ApplicationContext에 Mock 객체를 등록
- 기존에 등록된 빈을 Mock으로 교체

```java
@SpringBootTest
class MailServiceIntegrationTest {
    @MockBean
    private MailSendClient mailSendClient;
    
    @Autowired
    private MailService mailService;
    
    @DisplayName("메일 전송 테스트 - MockBean 사용")
    @Test
    void sendMailTest() {
        // given
        String to = "test@test.com";
        String subject = "테스트";
        String content = "테스트 내용";
        String fromEmail = "from@test.com";
        
        //동작 정의
        when(mailSendClient.sendEmail(anyString(), anyString(), anyString(), anyString()))
            .thenReturn(true);
            
        // when
        boolean result = mailService.sendEmail(to, subject, content, fromEmail);
        
        // then
        assertThat(result).isTrue();
    }
}
```

### @InjectMocks

**정의**

- @Mock으로 생성된 객체들을 자동으로 주입
- 의존성 주입(DI)을 테스트에서 구현

**특징**

- @Mock 객체들을 자동으로 주입받음
- 생성자, 세터, 필드 주입 지원
- 여러 Mock 객체들의 의존 관계 설정 시 유용

### @Spy

**정의**

- 실제 객체의 일부 메소드만 Mock으로 지정
- 나머지는 실제 객체의 메소드 사용

**특징**

- 실제 객체의 메소드를 선택적으로 오버라이드
- 특정 메소드만 스터빙하고 싶을 때 유용
- 부분적인 Mock이 필요할 때 사용

```java
@ExtendWith(MockitoExtension.class)
class MailServiceTest {
    @Spy
    private MailSendClient mailSendClient;
    
    @Mock
    private MailSendHistoryRepository mailSendHistoryRepository;
    
    @InjectMocks
    private MailService mailService;
    
    @DisplayName("메일 전송 테스트 - Spy 사용")
    @Test
    void sendMailTest() {
        // given
        String to = "test@test.com";
        String subject = "테스트";
        String content = "테스트 내용";
        String fromEmail = "from@test.com";
        
        // 특정 메소드만 스터빙
        doReturn(true)
            .when(mailSendClient)
            .sendEmail(anyString(), anyString(), anyString(), anyString());
            
        // when
        boolean result = mailService.sendEmail(to, subject, content, fromEmail);
        
        // then
        assertThat(result).isTrue();
        // 실제 호출 여부 확인
        verify(mailSendClient, times(1))
            .sendEmail(to, subject, content, fromEmail);
    }
}
```

### @SpyBean

**정의**

- 스프링 빈의 일부 메소드만 Mock으로 교체
- 나머지는 실제 빈의 동작 유지

**특징**

- 스프링 컨텍스트에서 동작
- 실제 빈의 일부 동작만 수정 가능
- 통합 테스트에서 부분적인 Mock이 필요할 때 사용

```java
@SpringBootTest
class MailServiceIntegrationTest {
    @SpyBean
    private MailSendClient mailSendClient;
    
    @Autowired
    private MailService mailService;
    
    @DisplayName("메일 전송 테스트 - SpyBean 사용")
    @Test
    void sendMailTest() {
        // given
        String to = "test@test.com";
        String subject = "테스트";
        String content = "테스트 내용";
        String fromEmail = "from@test.com";
        
        // 특정 메소드만 스터빙하고 나머지는 실제 동작 수행
        doReturn(true)
            .when(mailSendClient)
            .sendEmail(anyString(), anyString(), anyString(), anyString());
            
        // when
        boolean result = mailService.sendEmail(to, subject, content, fromEmail);
        
        // then
        assertThat(result).isTrue();
    }
}
```

### 문제

아래 3개의 테스트가 있습니다.
내용을 살펴보고, 각 항목을 @BeforeEach, given절, when절에 배치한다면 어떻게 배치하고 싶으신가요?
(@BeforeEach에 올라간 내용은 공통 항목으로 합칠 수 있습니다. ex. 1-1과 2-1을 하나로 합쳐서 @BeforeEach에 배치)

```java
@BeforeEach 
void setUp() {
    ❓
} 

@DisplayName("사용자가 댓글을 작성할 수 있다.")
@Test
void writeComment() {
    1-1. 사용자 생성에 필요한 내용 준비
    1-2. 사용자 생성
    1-3. 게시물 생성에 필요한 내용 준비
    1-4. 게시물 생성
    1-5. 댓글 생성에 필요한 내용 준비
    1-6. 댓글 생성

    // given
    ❓

    // when
    ❓

    // then
    검증
}

@DisplayName("사용자가 댓글을 수정할 수 있다.")
@Test
void updateComment() {
    2-1. 사용자 생성에 필요한 내용 준비
    2-2. 사용자 생성
    2-3. 게시물 생성에 필요한 내용 준비
    2-4. 게시물 생성
    2-5. 댓글 생성에 필요한 내용 준비
    2-6. 댓글 생성
    2-7. 댓글 수정

    // given
    ❓

    // when
    ❓

    // then
    검증
}

@DisplayName("자신이 작성한 댓글이 아니면 수정할 수 없다.")
@Test
void cannotUpdateCommentWhenUserIsNotWriter() {
    3-1. 사용자1 생성에 필요한 내용 준비
    3-2. 사용자1 생성
    3-3. 사용자2 생성에 필요한 내용 준비
    3-4. 사용자2 생성
    3-5. 사용자1의 게시물 생성에 필요한 내용 준비
    3-6. 사용자1의 게시물 생성
    3-7. 사용자1의 댓글 생성에 필요한 내용 준비
    3-8. 사용자1의 댓글 생성
    3-9. 사용자2가 사용자1의 댓글 수정 시도

    // given
    ❓

    // when
    ❓

    // then
    검증        
}
```

```java
@BeforeEach
void setUp() {
		(1-1. 사용자 생성에 필요한 내용 준비 ,3-1. 사용자1 생성에 필요한 내용 준비, 3-3. 사용자2 생성에 필요한 내용 준비)
		(1-3. 게시물 생성에 필요한 내용 준비 ,	3-5. 사용자1의 게시물 생성에 필요한 내용 준비)
		(1-5. 댓글 생성에 필요한 내용 준비, 3-7. 사용자1의 댓글 생성에 필요한 내용 준비)
}

@DisplayName(""사용자가 댓글을 작성할 수 있다."")
@Test
void writeComment() {
		// given
		1-2. 사용자 생성
		1-4. 게시물 생성
		

		// when
		1-6. 댓글 생성
		
		// then
		검증
}

@DisplayName(""사용자가 댓글을 수정할 수 있다."")
@Test
void updateComment() {
		// given
		2-2. 사용자 생성
		2-4. 게시물 생성
		2-6. 댓글 생성
		

		// when
		2-7. 댓글 수정
		
		// then
		검증
}

@DisplayName(""자신이 작성한 댓글이 아니면 수정할 수 없다."")
@Test
void cannotUpdateCommentWhenUserIsNotWriter() {
    // given
    3-2. 사용자1 생성
    3-4. 사용자2 생성

    3-6. 사용자1의 게시물 생성
    3-8. 사용자1의 댓글 생성

    // when
    3-9. 사용자2가 사용자1의 댓글 수정 시도

    // then
    검증        
}
```
