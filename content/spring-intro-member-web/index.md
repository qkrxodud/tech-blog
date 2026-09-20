---
title: "회원 웹 기능 — 등록, 출력"
tags: ["Spring", "Thymeleaf", "MVC", "회원 관리", "폼 처리"]
summary: "Thymeleaf로 홈, 회원 등록 폼, 회원 목록 화면을 구성하고 HomeController에서 등록·조회 요청을 처리하는 과정을 정리합니다."
---

## 1) Index 페이지 구성

- 기본 url 페이지로 접근 시 Index 페이지로 접근할 수 있게 화면을 구성합니다.
- resource > templates > home.html

```html
<!DOCTYPE HTML>
<html xmlns:th="http://www.thymeleaf.org">
<body>
<div class="container">
    <div>
        <h1>Hello Spring</h1>
        <p>회원 기능</p>
        <p>
            <a href="/members/new">회원 가입</a>
            <a href="/members">회원 목록</a>
        </p>
    </div>
</div><!-- /container --></body>
</html>
```

## 2) 회원 등록 폼

- 신규 회원을 등록할 수 있는 폼을 만들고, 리포지토리에 연결합니다.
- resource > templates > members > createMemberForm.html

```html
<!DOCTYPE HTML>
<html xmlns:th="http://www.thymeleaf.org">
<body>
<div class="container">
    <form action="/members/new" method="post">
        <div class="form-group">
            <label for="name">이름</label>
            <input type="text" id="name" name="name" placeholder="이름을
입력하세요">
        </div>
        <button type="submit">등록</button>
    </form>
</div> <!-- /container -->
</body>
</html>
```

## 3) 회원 출력 페이지 구성

- Thymeleaf의 each 루프를 통해서 리스트 페이지를 구현할 수 있습니다.

```html
<!DOCTYPE HTML>
<html xmlns:th="http://www.thymeleaf.org">
<body>
<div class="container">
    <div>
        <table>
            <thead>
            <tr>
                <th>#</th>
                <th>이름</th>
            </tr>
            </thead>
            <tbody>
            <tr th:each="member : ${members}">
                <td th:text="${member.id}"></td>
                <td th:text="${member.name}"></td>
            </tr>
            </tbody>
        </table>
    </div>
</div><!-- /container --></body>
</html>
```

## 4) HomeController 작성

인덱스 페이지와 회원 등록 페이지로 이동할 수 있게 @GetMapping을 작성합니다.

1. Post 방식으로 넘어오는 값을 받기 위해 @PostMapping을 작성합니다.
2. Post로 넘어오는 값을 받기 위해 MemberForm.java를 작성합니다.
3. MemoryMemberRepository의 데이터를 저장하기 위해서 MemberService를 주입받습니다.
4. 값이 저장 완료되었으면 redirect:/ 값을 줘서 홈으로 이동시킵니다.
5. memberService를 통해서 저장된 데이터를 불러온 후 addAttribute를 통해서 html에 데이터를 넘겨줍니다.
6. java > hello.hellospring > controller > HomeController

리다이렉트 부연 설명 : re(다시) + 지시하다(direct), 다시 지시하는 것을 말합니다.

즉 members/new로 들어왔지만 서버에서 '/'로 가도록 다시 지시한 것을 의미합니다.

```java
package hello.hellospring.controller;

import hello.hellospring.domain.Member;
import hello.hellospring.service.MemberService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

import java.util.List;

@Controller
public class HomeController {
    private MemberService memberService;

    public HomeController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping("/")
    public String home() {
        return "home";
    }

    @GetMapping("members/new")
    public String createForm() {
        return "members/createMemberForm";
    }

    @PostMapping("members/new")
    public String create(MemberForm memberForm) {
        Member member = new Member();
        member.setName(memberForm.getName());

        memberService.join(member);

        return "redirect:/";
    }

// 이전 파일 보기 ctrl+e@GetMapping("/members")
    public String list(Model model) {
        List<Member> members =  memberService.findMembers();
        model.addAttribute("members", members);
        return "members/list";
    }
}
```

## 5) MemberForm 객체

- Post 방식으로 넘어오는 값을 받기 위해 MemberForm 객체를 만듭니다.
- java > hello.hellospring > controller > MemberForm

```java
package hello.hellospring.controller;

public class MemberForm {
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
```

> 결론
>
> 이제 홈페이지에서 데이터를 전달받고 저장하는 기능을 완료했습니다.
>
> 하면서 느꼈던 것은 '참 자동으로 잘 연결시켜 주는구나'라는 점이었습니다.
>
> 제가 개발해 왔던 PHP의 옛날 방식은 POST 방식으로 전달받았던 값들을 일일이 넣어 주었는데, 객체 하나를 만듦으로써 값들을 편리하게 넣고 받아서 쓸 수 있다는 게 놀라웠습니다.
>
> 물론 예전에 Spring을 했을 때도 가능했겠지만, 지금 와서 더 이해가 잘되는 느낌이랄까, 좋은 자극이 된 것 같습니다.

> 이 글은 인프런 김영한 님의 [스프링 입문 — 코드로 배우는 스프링 부트, 웹 MVC, DB 접근 기술](https://www.inflearn.com/course/스프링-입문-스프링부트)을 들으며 정리한 노트입니다.
