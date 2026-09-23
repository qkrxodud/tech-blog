---
title: "카프카 로컬 환경 설정"
tags: ["Kafka","로컬 환경","주키퍼","CLI"]
summary: "카프카를 로컬에 설치하고 주키퍼와 브로커를 실행한 뒤 토픽을 생성·확인·수정하는 명령어를 정리합니다."
---

## 카프카 로컬 환경 설정

카프카 설치 위치로 이동합니다.

- `/Users/coby/Downloads/kafka_2.12-2.5.0`

주키퍼 실행 명령어

```
bin/zookeeper-server-start.sh config/zookeeper.properties
```

카프카 정상 실행 명령어

```
bin/kafka-server-start.sh config/server.properties
```

카프카가 정상 실행됐는지 확인하는 명령어

```
bin/kafka-broker-api-versions.sh --bootstrap-server {AWS 인스턴스 IP}:9092
```

토픽 생성 명령어

```
bin/kafka-topics.sh --create --bootstrap-server my-kafka:9092 --topic hello.kafka(토픽명)
```

토픽 확인 명령어

```
bin/kafka-topics.sh --bootstrap-server my-kafka:9092 --topic hello.kafka --describe
```

토픽을 만들면서 파티션 개수와 추가 옵션을 더 주는 방법

```
bin/kafka-topics.sh --create --bootstrap-server my-kafka:9092 --partitions 10 --replication-factor 1 --topic hello.kafka2 --config retention.ms=172800000
```

토픽의 파티션 개수를 늘리는 방법

```
bin/kafka-topics.sh --bootstrap-server my-kafka:9092 --topic hello.kafka(토픽명) --alter --partitions 10
```

---

> 이 글은 인프런 최원영 님의 「아파치 카프카 애플리케이션 프로그래밍」을 들으며 정리한 노트입니다.
