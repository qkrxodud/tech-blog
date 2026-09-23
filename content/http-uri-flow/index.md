---
title: "URI와 웹 브라우저 요청 흐름"
tags: ["HTTP","웹 네트워크","URI","URL"]
summary: "URI, URL, URN의 개념과 URL 문법을 정리하고, 브라우저가 서버에 요청을 보내 응답을 렌더링하기까지의 흐름을 살펴봅니다."
---

## URI(Uniform Resource Identifier)

URI는 로케이터(Locator), 이름(Name), 또는 둘 다로 추가 분류될 수 있습니다.

### URI

- **U**niform: 리소스 식별하는 통일된 방식
- **R**esource: 자원, URI로 식별할 수 있는 모든 것(제한 없음)
- **I**dentifier: 다른 항목과 구분하는 데 필요한 정보

- URL: Uniform Resource Locator
- URN: Uniform Resource Name

### URL, URN

- URL - Locator: 리소스가 있는 위치를 지정
- URN - Name: 리소스에 이름을 부여
- 위치는 변할 수 있지만, 이름은 변하지 않습니다.
- urn:isbn:899....
- URN 이름만으로 실제 리소스를 찾을 수 있는 방법이 보편화되지 않았습니다.
- **앞으로 URI를 URL과 같은 의미로 이야기하겠습니다.**

### URL 전체 문법

- **scheme://[userinfo@]host[:port][/path][?query][#fragment]**
- https://www.google.com:443/search?q=hello&hl=ko

- 프로토콜(https)
    - 주로 프로토콜 사용
    - 프로토콜: 어떤 방식으로 자원에 접근할 것인가 하는 약속 규칙
        - 예) http, https, ftp 등
- 호스트명(www.google.com)
    - 도메인명 또는 IP 주소를 직접 사용 가능
- 포트(443)
    - 접속 포트
    - 일반적으로 생략, 생략 시 http는 80, https는 443
- 패스(/search)
    - 리소스 경로, 계층적 구조
- 쿼리 파라미터(q=hello&hl=ko)
    - key=value 형태
    - ?로 시작, &로 추가 가능
    - query parameter, query string 등으로 불림, 웹서버에 제공하는 파라미터, 문자 형태
- 프래그먼트(#fragment)
    - html 내부 북마크 등에 사용
    - 서버에 전송하는 정보 아님

## 웹 브라우저 요청 흐름

1. **사용자가 URL을 통해서 서버에 요청을 합니다.**
    - 사용자 요청 메시지를 생성합니다.
    - HTTP 요청 메시지 형태로 만듭니다.
2. **HTTP 메시지를 전송하기 위한 준비를 합니다.**
    - TCP/IP 패킷 생성 과정을 거칩니다.
    - SOCKET 라이브러리에서 3-way handshake를 통해 연결해 줍니다.
3. **패킷을 생성한 후 전송 데이터에 HTTP 메시지를 넣어 줍니다.**
    - 전송 데이터를 생성합니다.
4. **요청 패킷을 노드를 통해서 서버로 전송합니다.**
    - 요청 패킷을 서버에 전달합니다.
5. **구글 서버에 요청 패킷이 전달되면 응답 메시지를 만듭니다.**
    - 응답 메시지를 생성합니다.
    - http 버전이랑 정상 응답인 200 OK를 담습니다.
    - 응답하는 데이터가 텍스트에 HTML 형식입니다. 언어는 UTF-8입니다.
    - 실제 HTML 데이터의 길이도 포함됩니다.
6. **만든 응답 메시지를 클라이언트 서버로 다시 전송해 줍니다.**
    - 응답 메시지를 클라이언트에 전송합니다.
7. **클라이언트에서 웹 브라우저가 HTML을 렌더링해서 정보를 확인합니다.**
    - HTML을 렌더링합니다.

---

> 이 글은 인프런 김영한 님의 [모든 개발자를 위한 HTTP 웹 기본 지식](https://www.inflearn.com/course/http-웹-네트워크)을 들으며 정리한 노트입니다.
