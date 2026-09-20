---
title: "YAML 문법"
tags: ["Kubernetes", "YAML", "문법", "DevOps", "설정관리"]
summary: "들여쓰기, 맵과 배열, 주석, 줄바꿈 표현 등 쿠버네티스 매니페스트 작성에 필요한 YAML 기본 문법을 정리합니다."
---

## 기본 문법

### 들여쓰기 (indent)

들여쓰기는 기본적으로 2칸 또는 4칸을 지원합니다.

2칸 들여쓰기 (추천)

```yaml
person:
  name: Coby
  job: Developer
  skills: 
    - docker
    - kubernetes
```

4칸 들여쓰기

```yaml
person:
    name: Coby
    job: Developer
    skills: 
        - docker
        - kubernetes
```

### 데이터 정의 (map)

데이터는 `key` : `value` 형식으로 정의합니다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: echo
  labels:
		type: app
```

### 배열 정의(array)

배열은 `-`로 표시합니다.

```yaml
person:
  name: Coby
  job: Developer
  skills:
		- doker
		- kubernetes
```

### 주석(comment)

주석은 `#`으로 표시합니다.

전체 라인 주석 처리

```yaml
# comment
person:
  name: Coby
  job: Developer
  skills:
    - docker
    - kubernetes
```

일부 주석 처리

```yaml
person: 
  name: Coby # subicura
  job: Developer
  skills:
    - docker
    - kubernetes
```

### 참/거짓, 숫자 표현

참/거짓은 `true`, `false` 외에 `yes`, `no`도 지원합니다.

참/거짓

```yaml
study_hard: yes
give_up: no
hello: true
world: TRUE
manual: false
```

숫자

정수 또는 실수를 따옴표(")없이 사용하면 숫자로 인식합니다.

```yaml
# number
version: 1.2

# String
version: "1.2"
```

### 줄바꿈 (newline)

여러 줄을 표현하는 방법입니다.

"|" 지시어는 마지막 줄바꿈을 포함합니다.

```yaml
newlines_sample: |
            number one line
            
            second line

            last line
```

"|-" 지시어는 마지막 줄바꿈을 제외합니다.

```yaml
newlines_sample: |-
            number one line

            second line

            last line
```

">" 지시어는 중간에 들어간 빈 줄을 제외합니다.

```yaml
newlines_sample: >
            number one line

            second line

            last line
```

## 주의사항

### 띄어쓰기

key와 value 사이에는 반드시 빈칸이 필요합니다.

```yaml
# error (not key-value, string)
key:value

# ok
key: value
```

### 문자열 따옴표

대부분의 문자열은 따옴표 없이 사용할 수 있지만, `:`가 들어간 경우는 반드시 따옴표가 필요합니다.

```yaml
# error
windows_drive: c:

# ok
windows_drive: "c:"
windows_drive: 'c:'
```

## 참고

JSON을 YAML로 변환해주는 사이트입니다.

[https://www.json2yaml.com/](https://www.json2yaml.com/)

YAML 문법을 체크해주는 사이트입니다.

[http://www.yamllint.com/](http://www.yamllint.com/)

> 이 글은 인프런의 [초보를 위한 쿠버네티스 안내서](https://www.inflearn.com/course/쿠버네티스-입문)을 들으며 정리한 노트입니다.
