---
title: "카프카 CLI 다루기"
tags: ["Kafka","CLI","로컬 환경","브로커"]
summary: "카프카 커맨드 라인 툴로 토픽을 다루는 방법과 설정 파일을 수정해 로컬에서 브로커를 실행하는 절차를 정리합니다."
---

## 카프카 커맨드 라인 툴(command-line-tool)

커맨드 라인 툴을 통해 카프카 브로커 운영에 필요한 다양한 명령어를 내립니다.

토픽이나 파티션 개수 변경과 같은 명령을 실행해야 하는 경우도 발생합니다. 그래서 카프카 커맨드 라인 툴과 각 툴별 옵션에 대해 알고 있어야 합니다.

커맨드 라인 툴을 통해 토픽 관련 명령을 실행할 때 필수 옵션과 선택 옵션이 있습니다.

선택 옵션은 지정하지 않을 시 브로커에 설정된 기본 설정값 또는 커맨드 라인 툴의 기본값으로 대체되어 설정됩니다.

> 만약 브로커에 설정된 기본 파티션 값이 10이라면, 내가 원하는 토픽에 5개의 파티션을 만들고자 할 때는 토픽 생성 시 커맨드 라인 툴을 통해 5개의 파티션을 만들도록 지정해줘야 합니다.

## 로컬 카프카 설치 및 실행

- 카프카 바이너리 파일 다운로드
    - https://kafka.apache.org/downloads
- 카프카 바이너리 압축 해제
- 주키퍼 실행
- 카프카 바이너리 실행

## 카프카 바이너리 압축 해제

- bin: 실행할 바이너리랑 쉘 스크립트가 들어 있습니다.
- config: 설정에 필요한 `server.properties` 및 여러 설정 파일이 존재합니다.
- libs: 브로커를 실행할 때 필요한 라이브러리가 존재합니다.

`server.properties`의 주요 설정값은 다음과 같습니다.

- log.dirs: 파일 시스템을 지정하는 부분입니다. 프로듀서가 카프카 브로커로 데이터를 보내면 데이터는 파일 시스템으로 저장됩니다.
- num.partitions: 기본적으로 토픽을 만들 때 만들어지는 파티션의 개수입니다.
- log.retention.hours: 168시간이 지나면 삭제됩니다.
- listeners: 카프카 브로커가 통신을 통해 우리가 받을 IP를 뜻합니다.
- advertised.listeners

## 로컬에서 카프카 브로커 실행

- `server.properties`의 환경설정 값을 수정해야 합니다.
    - 로컬호스트로 브로커가 통신을 할 수 있게 설정해야 합니다.
        - `listeners=PLAINTEXT://localhost:9092`
        - `advertised.listeners=PLAINTEXT://localhost:9092`
    - 파일 시스템을 내가 원하는 위치로 저장할 수 있게 설정해야 합니다.
        - `log.dirs=/Users/coby/Downloads/kafka_2.12-2.5.0/data`

로컬에서 카프카 브로커 실행 순서는 다음과 같습니다.

1. 주키퍼를 실행합니다.
    - `bin/zookeeper-server-start.sh config/zookeeper.properties`
2. 브로커를 실행합니다.
    - `bin/kafka-server-start.sh config/server.properties`
3. 잘 동작되는지 확인합니다.
    - `bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092`
    - `bin/kafka-topics.sh --bootstrap-server localhost:9092 --list`

---

> 이 글은 인프런 최원영 님의 「아파치 카프카 애플리케이션 프로그래밍」을 들으며 정리한 노트입니다.
