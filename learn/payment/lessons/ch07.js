// 7장 결제 동시성 제어 — content/payment-concurrency/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[7] = {
  slug: 'payment-concurrency',
  branch: 'chapter-07',
  title: '결제 동시성 제어',
  goal: '같은 결제·주문에 겹친 요청과 서버마다 도는 주기 작업을 결제 줄 잠금과 작업 잠금으로 가립니다.',
  learn: [
    { text: '잠그지 않고 읽으면 겹친 기록이 서로를 못 본다', step: 1 },
    { text: '결제 줄 잠금 `select … for update`', step: 4 },
    { text: '무엇이 버전을 올리느냐에 따라 갈리는 결과', step: 6 },
    { text: 'PG 답을 기다리는 결제에 다시 온 승인은 202', step: 7 },
    { text: '잠글 줄이 없는 동시 준비는 중복 거부를 잡기', step: 8 },
    { text: '작업 잠금 `job_lock`으로 서버 한 대만', step: 10 },
    { text: '동시 요청 30개로 잰 결과와 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'c1', kind: 'client', label: '클라이언트 A', sub: '요청 1', x: 95, y: 120 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '잔액 검사', x: 95, y: 300 },
    { id: 'c2', kind: 'client', label: '클라이언트 B', sub: '요청 2', x: 95, y: 470 },
    { id: 'srvA', kind: 'server', label: '서버 A', sub: '결제 서버', x: 345, y: 120 },
    { id: 'srvB', kind: 'server', label: '서버 B', sub: 'OtherPaymentServer', subMono: true, x: 345, y: 470 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제 줄 · job_lock', x: 680, y: 300 }
  ],
  edges: [['c1', 'srvA'], ['c2', 'srvB'], ['srvA', 'pg'], ['srvB', 'pg'], ['srvA', 'db'], ['srvB', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '결제를 잠그지 않고 읽어 바꾼다',
      src: '현재 구조: 잠그지 않고 읽어 바꾸는 기록과 서버마다 도는 주기 작업',
      body: [
        '7장 출발 코드는 6장 완성 코드 그대로입니다. 승인 기록(`PaymentRecorder`), 취소 기록(`PaymentCancelRecorder`), 알림 반영(`PaymentWebhookRecorder`)이 짧은 트랜잭션이고, 셋 모두 결제를 주문번호로 그냥 읽어서 바꿉니다.',
        '취소는 받을 수 있는 금액을 결제가 가진 취소 줄들의 합으로 계산합니다. 주기 작업(승인 보정, 취소 보정, 받은 알림 처리)은 서버마다 `@Scheduled`로 돌고, 서버끼리 나누는 장치는 없습니다.'
      ],
      note: '이 장에서 "서버가 여러 대"는 시험 JVM 안에 결제 서버를 한 대 더 띄워 재현합니다. 두 서버는 같은 MySQL과 같은 Mock PG를 씁니다. 그림은 겹친 두 요청을 서버 A·B로 나눠 그렸습니다.',
      metrics: [
        { label: '결제 금액', value: '15000원' },
        { label: '7장 테스트', value: '27개 중 15개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        { from: 'c1', to: 'srvA', kind: 'req', label: '10000원 취소' },
        { from: 'srvA', to: 'db', kind: 'query', label: '주문번호로 그냥 읽기' },
        { from: 'srvA', to: 'db', kind: 'write', label: 'REQUESTED 10000원', then: { db: { badge: '요청 줄 10000원', tone: 'info' } } },
        { from: 'srvA', to: 'pg', kind: 'req', label: '취소' },
        { from: 'pg', to: 'srvA', kind: 'res', label: '취소됨' },
        { from: 'srvA', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: '남은 금액 5000원', tone: 'ok' } } },
        { from: 'srvA', to: 'c1', kind: 'res', label: '200', mono: true }
      ]
    },
    {
      short: '취소 겹침', tag: '문제', title: '남은 금액을 함께 넘는 취소 두 건이 모두 PG로 간다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '15000원 결제에 10000원 취소 두 건이 겹치면, 취소 A가 요청 줄을 남기다 붙잡힌 사이 취소 B도 A의 요청 줄을 보지 못하고 같은 줄을 남깁니다. B는 "남은 금액보다 큼"을 받지 않고 PG까지 갑니다.',
        '결제 금액을 넘는 취소를 막은 것은 Mock PG의 잔액 검사입니다. PG가 B를 403 `NOT_CANCELABLE_AMOUNT`로 거절해 A는 `DONE`, B는 `FAILED`로 기록되고 둘 다 200을 받습니다.'
      ],
      note: '겹치는 순간은 MySQL 트리거로 고정했습니다. 트리거가 먼저 보낸 요청의 기록 한 건을 그 줄의 잠금을 쥔 채 `do sleep(1)`로 1초 붙잡습니다.',
      metrics: [
        { label: '7장 테스트', value: '27개 중 15개 실패', tone: 'bad' },
        { label: 'PG로 간 취소', value: '2건', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        [
          { from: 'c1', to: 'srvA', kind: 'req', label: '취소 A 10000원' },
          { from: 'c2', to: 'srvB', kind: 'req', label: '취소 B 10000원' }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: 'REQUESTED 10000원', then: { db: { badge: 'A 요청 줄', tone: 'info', note: '트리거가 1초 붙잡음', noteTone: 'muted' } } },
        { from: 'srvB', to: 'db', kind: 'query', label: '잠그지 않고 읽기' },
        { from: 'srvB', to: 'db', kind: 'write', label: 'REQUESTED 10000원', then: { db: { badge: '요청 줄 두 개', tone: 'warn', note: 'B는 A의 줄을 못 봄', noteTone: 'warn' } } },
        [
          { from: 'srvA', to: 'pg', kind: 'req', label: '취소 A' },
          { from: 'srvB', to: 'pg', kind: 'req', label: '취소 B' }
        ],
        { from: 'pg', to: 'srvA', kind: 'res', label: '취소됨' },
        { from: 'pg', to: 'srvB', kind: 'fail', label: '403 NOT_CANCELABLE_AMOUNT', mono: true, then: { pg: { badge: '잔액 검사가 막음', tone: 'warn' } } },
        [
          { from: 'srvA', to: 'c1', kind: 'res', label: '200', mono: true },
          { from: 'srvB', to: 'c2', kind: 'res', label: '200', mono: true }
        ],
        { at: 'db', then: { db: { badge: 'A DONE · B FAILED', tone: 'bad', note: '넘는 취소가 PG까지 감', shake: true } } }
      ]
    },
    {
      short: '덮어쓰기', tag: '문제', title: '승인 답 기록이 알림 반영을 덮어쓴다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '승인 답을 붙잡은 사이 가맹점 관리 화면의 전액 취소 알림을 반영하던 기록이 있었는데, 그 반영이 커밋되기 전에 읽은 승인 답 기록이 뒤에 커밋되면서 결제를 승인으로 덮어썼습니다. PG는 `CANCELED`인데 결제는 `APPROVED`로 남았습니다.',
        '같은 결제 키로 승인 두 건이 겹치면 PG 승인 요청이 2번 갔고, 다른 결제 키 둘이면 PG에 승인이 2건 남았습니다. 같은 결제를 바꾸는 동시 기록 계약 11개 중 6개가 실패했습니다.'
      ],
      note: '승인 답 붙잡기는 6장에서 만든 Mock PG의 시험용 조작입니다.',
      metrics: [
        { label: '같은 결제 기록 계약', value: '11개 중 6개 실패', tone: 'bad' },
        { label: '결제 ↔ PG', value: '어긋남', tone: 'bad' }
      ],
      states: { pg: { badge: 'CANCELED', tone: 'info' }, db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        [
          { from: 'srvA', to: 'db', kind: 'query', label: '알림 반영이 읽음' },
          { from: 'srvB', to: 'db', kind: 'query', label: '승인 답 기록이 읽음' }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: '승인 취소로', then: { db: { badge: 'APPROVAL_CANCELED', tone: 'ok' } } },
        { from: 'srvB', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'bad', note: 'PG는 CANCELED', shake: true } } }
      ]
    },
    {
      short: '서버 두 대', tag: '문제', title: '서버 두 대가 같은 주기 작업을 함께 돈다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '서버 두 대가 같은 때 주기 작업을 돌리자, 결과 모름 결제 세 건의 승인 보정과 결과 모름 취소 세 건의 취소 보정에서 결제마다 PG 조회가 2번씩([2, 2, 2]) 갔습니다. 4장 비교 구현 망취소는 결제마다 PG 취소를 2번 보냈습니다. 결과(승인, 남은 금액)는 모두 PG와 맞았습니다.',
        'PG 답을 기다리는 결제에 같은 결제 키로 다시 온 승인은 409였고, 같은 주문의 준비가 동시에 오면 나중 준비가 주문번호 중복 거부를 그대로 받아 500으로 끝났습니다.'
      ],
      note: '두 서버는 래치로 같은 때 주기 작업을 시작하고, PG는 조회와 취소에 0.5초 늦게 답해서 한 서버가 끝나기 전에 다른 서버도 시작하게 했습니다.',
      metrics: [
        { label: '서버 여러 대 계약', value: '6개 중 4개 실패', tone: 'bad' },
        { label: '결제마다 PG 조회', value: '2번', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } },
      flows: [
        [
          { from: 'srvA', to: 'db', kind: 'query', label: '결과 모름 결제 고르기' },
          { from: 'srvB', to: 'db', kind: 'query', label: '결과 모름 결제 고르기' }
        ],
        [
          { from: 'srvA', to: 'pg', kind: 'query', label: '조회' },
          { from: 'srvB', to: 'pg', kind: 'query', label: '조회' }
        ],
        { at: 'pg', then: { pg: { badge: '같은 결제를 두 번', tone: 'bad', shake: true } } },
        [
          { from: 'pg', to: 'srvA', kind: 'res', label: 'DONE', mono: true },
          { from: 'pg', to: 'srvB', kind: 'res', label: 'DONE', mono: true }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: 'APPROVE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '결과는 PG와 맞음', noteTone: 'muted' } } }
      ]
    },
    {
      short: '결제 줄 잠금', tag: '결정', title: '결정 1. 결제를 바꾸는 기록은 결제 줄을 잠그고 읽는다',
      src: '결정 1. 같은 결제를 바꾸는 기록을 무엇으로 가릴까',
      body: [
        '이 장에서는 같은 결제를 바꾸는 기록(승인 앞뒤, 취소, 보정, 알림 반영)이 결제 줄을 `select … for update`로 잠그고 읽기로 했습니다. PG 호출은 2장에서 트랜잭션 밖으로 나가 있어서, 잠금은 기록하는 짧은 트랜잭션 동안만 쥡니다.',
        '취소 B는 `findByOrderIdForUpdate`에서 A의 커밋을 기다렸다가 취소 목록을 읽습니다. 받을 수 있는 금액은 15000 − 10000 = 5000원이라 `CancelAmountExceedsBalanceException`으로 거부되고, PG에는 가지 않습니다.'
      ],
      note: '비용: 같은 결제에 겹친 요청이 순서대로 기다립니다. 1000원 부분 취소 30개를 한꺼번에 보낸 측정에서 응답 중앙값이 잠그지 않을 때의 약 두 배가 되었습니다.',
      changed: [['+', '`@Lock(PESSIMISTIC_WRITE)` `findByOrderIdForUpdate`'], ['~', '2·4·5·6장 기록 클래스의 `find` 한 줄씩']],
      metrics: [
        { label: '같은 결제 기록 계약', value: '11개 통과', tone: 'good' },
        { label: 'PG로 간 취소', value: '1건', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      focus: ['db'],
      flows: [
        [
          { from: 'c1', to: 'srvA', kind: 'req', label: '취소 A 10000원' },
          { from: 'c2', to: 'srvB', kind: 'req', label: '취소 B 10000원' }
        ],
        [
          { from: 'srvA', to: 'db', kind: 'query', label: 'for update', mono: true, then: { db: { badge: 'A가 잠금', tone: 'info' } } },
          { from: 'srvB', to: 'db', kind: 'query', label: 'for update', mono: true, then: { srvB: { badge: '잠금 대기', tone: 'warn' } } }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: 'REQUESTED 10000원', then: { db: { badge: '커밋, 잠금 풀림', tone: 'info' } } },
        [
          { from: 'srvA', to: 'pg', kind: 'req', label: '취소' },
          { from: 'srvB', to: 'db', kind: 'query', label: '취소 목록 읽기', then: { srvB: { badge: '5000원만 남음', tone: 'warn' } } }
        ],
        { from: 'srvB', to: 'c2', kind: 'fail', label: '409 남은 금액보다 큼' },
        { from: 'pg', to: 'srvA', kind: 'res', label: '취소됨' },
        { from: 'srvA', to: 'db', kind: 'write', label: '다시 잠그고 DONE', then: { db: { badge: '남은 금액 5000원', tone: 'ok' } } }
      ]
    },
    {
      short: '변경 번호', tag: '비교', title: '비교. 변경 번호 비교는 PG에 보낸 뒤의 답 기록을 되돌린다',
      src: '결정 1. 같은 결제를 바꾸는 기록을 무엇으로 가릴까',
      body: [
        '변경 번호 비교는 커밋 직전에 `update … where version = 읽은 번호`로 번호가 같을 때만 올리고, 어긋나면 409로 답합니다. 취소 줄만 더하는 기록에서도 번호를 올리는 `OPTIMISTIC_FORCE_INCREMENT`와 같은 동작이고, 11개 중 **2개가 실패**했습니다.',
        '첫 5000원 취소가 PG 답(0.3초 뒤)을 기다리는 동안 두 번째 5000원 취소가 요청 줄을 남기다 1초 붙잡히고, 그사이 온 첫 취소의 답 기록이 번호 충돌로 409가 되어 되돌려졌습니다. 우리 남은 금액 10000원과 PG 잔액 5000원이 어긋났습니다.'
      ],
      note: '상태 조건 UPDATE는 결제 상태가 그대로인 취소 요청에서 조건이 늘 맞아 11개 중 3개가 실패했습니다. 두 비교 모두 충돌을 그대로 드러내려고 재시도를 넣지 않았습니다.',
      metrics: [
        { label: '변경 번호 비교', value: '11개 중 2개 실패', tone: 'bad' },
        { label: '우리 남은 금액', value: '10000원', tone: 'bad' },
        { label: 'PG 잔액', value: '5000원' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        { from: 'c1', to: 'srvA', kind: 'req', label: '첫 5000원 취소' },
        { from: 'srvA', to: 'db', kind: 'write', label: '요청 줄 · 번호 올림' },
        { from: 'srvA', to: 'pg', kind: 'req', label: '취소' },
        { from: 'c2', to: 'srvB', kind: 'req', label: '두 번째 5000원 취소' },
        { from: 'srvB', to: 'db', kind: 'write', label: '요청 줄 · 번호 올림', then: { db: { badge: '두 번째 기록', tone: 'info', note: '트리거가 1초 붙잡음', noteTone: 'muted' } } },
        { from: 'pg', to: 'srvA', kind: 'res', label: '취소됨', then: { pg: { badge: '잔액 5000원', tone: 'ok' } } },
        { from: 'srvA', to: 'db', kind: 'fail', label: '답 기록 번호 충돌', cut: true, then: { db: { badge: '요청 상태로 남음', tone: 'bad', note: '우리 10000원 ≠ PG 5000원', shake: true } } },
        { from: 'srvA', to: 'c1', kind: 'fail', label: '409', mono: true }
      ]
    },
    {
      short: '@Version', tag: '비교', title: '비교. @Version 그대로는 취소 줄을 보지 못한다',
      src: '결정 1. 같은 결제를 바꾸는 기록을 무엇으로 가릴까',
      body: [
        '결제에 JPA `@Version`을 그대로 둔 비교는 11개 중 **4개가 실패**했습니다. 취소 요청은 `payment_cancel`에 줄을 더할 뿐 결제 줄을 바꾸지 않아서 버전이 오르지 않고, 남은 금액을 함께 넘는 취소 둘이 모두 PG로 갔습니다.',
        '같은 결제 키 승인 둘은 PG 요청은 한 번이었지만, 나중 승인이 `ObjectOptimisticLockingFailureException`으로 500을 받았습니다. 변경 번호 비교는 충돌을 409로 바꿔 답하고, `@Version` 그대로는 그 예외를 그대로 둡니다.'
      ],
      note: 'Hibernate 문서도 버전이 "automatically incremented or updated each time the entity is updated"라고 적고 있습니다. Redis 분산 잠금은 연재 목차에 Redis를 쓰는 장이 없어 구현하지 않았습니다.',
      metrics: [
        { label: '@Version 그대로', value: '11개 중 4개 실패', tone: 'bad' },
        { label: 'PG로 간 취소', value: '2건', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        [
          { from: 'c1', to: 'srvA', kind: 'req', label: '취소 A 10000원' },
          { from: 'c2', to: 'srvB', kind: 'req', label: '취소 B 10000원' }
        ],
        [
          { from: 'srvA', to: 'db', kind: 'write', label: '취소 줄만 더함' },
          { from: 'srvB', to: 'db', kind: 'write', label: '취소 줄만 더함' }
        ],
        { at: 'db', then: { db: { badge: '버전 그대로', tone: 'warn', note: '결제 줄은 안 바뀜', noteTone: 'warn' } } },
        [
          { from: 'srvA', to: 'pg', kind: 'req', label: '취소 A' },
          { from: 'srvB', to: 'pg', kind: 'req', label: '취소 B' }
        ],
        { at: 'pg', then: { pg: { badge: '넘는 취소가 도착', tone: 'bad', shake: true } } }
      ]
    },
    {
      short: '202 확인 중', tag: '결정', title: '결정 2. PG 답을 기다리는 결제에 다시 온 같은 승인은 202',
      src: '결정 2. PG 답을 기다리는 결제에 같은 승인이 다시 오면 어떻게 답할까',
      body: [
        '이 장에서는 PG 답을 기다리는 결제(`AUTHENTICATED`)에 같은 결제 키로 승인이 다시 오면, PG를 부르지 않고 4장의 결과 모름처럼 202 확인 중으로 답하기로 했습니다. 다른 결제 키는 지금처럼 409입니다.',
        '같은 결제 키는 이미 PG에 보낸 요청이라 결과를 모르는 결제와 클라이언트에게 같은 뜻이기 때문입니다. 운영 구현은 결과를 남긴 결제뿐 아니라 PG 답을 기다리는 결제도 포함하는 `isRequestedWith`로 판단합니다.'
      ],
      note: '비용: 202 응답에는 승인 결과가 없어 클라이언트가 결제 조회(`GET /api/v1/payments/{orderId}`)로 다시 확인해야 합니다. 첫 요청을 기다리는 비교도 계약 4개를 모두 통과했지만, 요청 하나가 PG 연결과 읽기 시간 제한까지 붙잡힙니다.',
      changed: [['~', '같은 결제 키 재요청 409 → 202'], ['+', '`isRequestedWith`, `ConfirmAttempt`']],
      metrics: [
        { label: '다시 온 승인', value: '202', tone: 'warn' },
        { label: 'PG 재호출', value: '없음', tone: 'good' },
        { label: '409 비교', value: '4개 중 1개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'c1', to: 'srvA', kind: 'req', label: '승인' },
        { from: 'srvA', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'srvA', to: 'pg', kind: 'req', label: '승인', then: { pg: { badge: '처리 중', tone: 'info', note: '0.8초 뒤 답', noteTone: 'muted' } } },
        { from: 'c2', to: 'srvB', kind: 'req', label: '같은 결제 키로 다시' },
        { from: 'srvB', to: 'db', kind: 'query', label: '이미 요청한 결제?' },
        { from: 'srvB', to: 'c2', kind: 'res', label: '202 확인 중' },
        { from: 'pg', to: 'srvA', kind: 'res', label: '승인됨', then: { pg: { badge: 'DONE', tone: 'ok', note: '' } } },
        { from: 'srvA', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } }
      ]
    },
    {
      short: '동시 준비', tag: '결정', title: '결정 3. 같은 주문의 동시 준비는 중복 거부를 잡아 다시 읽는다',
      src: '결정 3. 같은 주문의 준비가 동시에 오면 어떻게 할까',
      body: [
        '이 장에서는 같은 주문의 준비가 동시에 오면 주문번호 중복 거부(`uk_payment_order_id`)를 잡아, 새 트랜잭션에서 먼저 남은 결제를 다시 읽고 3장 규칙대로 답하기로 했습니다. 금액이 같으면 그 결제(201), 다르면 이미 있는 주문(409)입니다.',
        '결정 1의 잠금으로는 막을 수 없습니다. 준비가 동시에 올 때는 잠글 결제 줄이 아직 없기 때문입니다. 중복 거부가 난 트랜잭션은 이미 되돌리기로 표시되어서, 준비 기록을 `PaymentPrepareRecorder`라는 다른 빈으로 옮겼습니다.'
      ],
      note: '비용: 겹친 나중 준비가 저장에 실패하고 되돌린 뒤 한 번 더 읽습니다. MySQL 이름 잠금(`GET_LOCK`) 비교도 계약 4개를 모두 통과했지만, 준비 한 건에 연결이 둘 듭니다.',
      changed: [['+', '`PaymentPrepareRecorder`'], ['~', '`PaymentPrepareService`가 `DataIntegrityViolationException`을 잡음']],
      metrics: [
        { label: '잡지 않음', value: '4개 중 2개 실패', tone: 'bad' },
        { label: '나중 준비', value: '201 또는 409', tone: 'good' }
      ],
      states: { db: { badge: '결제 없음', tone: 'muted' } },
      flows: [
        [
          { from: 'c1', to: 'srvA', kind: 'req', label: '준비 A' },
          { from: 'c2', to: 'srvB', kind: 'req', label: '준비 B' }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: '새 결제 저장', then: { db: { badge: 'A 저장 중', tone: 'info', note: '트리거가 1초 붙잡음', noteTone: 'muted' } } },
        { from: 'srvB', to: 'db', kind: 'query', label: '주문번호로 찾기: 없음' },
        { from: 'srvB', to: 'db', kind: 'fail', label: 'uk_payment_order_id 중복', mono: true, cut: true, then: { srvB: { badge: '트랜잭션 1 되돌림', tone: 'warn' } } },
        { from: 'srvB', to: 'db', kind: 'query', label: '새 트랜잭션에서 다시 읽기' },
        [
          { from: 'srvA', to: 'c1', kind: 'res', label: '201', mono: true },
          { from: 'srvB', to: 'c2', kind: 'res', label: '201 같은 금액' }
        ],
        { at: 'db', then: { db: { badge: '결제 하나', tone: 'ok' } } }
      ]
    },
    {
      short: '같은 키 취소', tag: '결정', title: '결정 4. 같은 키 동시 취소는 잠금 뒤 5장 규칙으로',
      src: '결정 4. 같은 키의 취소가 동시에 오면 어떻게 할까',
      body: [
        '이 장에서는 같은 `Idempotency-Key`로 동시에 온 취소를 결정 1의 잠금 뒤 5장 규칙(같은 키로 다시 온 요청)대로 처리하기로 했습니다. 코드는 바꾸지 않았고, 테스트로 확인했습니다.',
        '출발 코드에서는 나중 취소가 `uk_payment_cancel_idempotency_key` 중복으로 내부 오류를 받았습니다. 잠금이 들어가면 나중 취소는 결제 줄에서 기다렸다가 앞 취소가 남긴 요청 줄을 찾고, 아직 PG 답을 남기지 못한 취소면 같은 키로 PG에 다시 보냅니다.'
      ],
      note: '비용: 8번 반복에서 매번 PG 취소 요청은 2번, 실제 취소는 1번이었습니다. PG가 같은 키에 다시 취소하지 않는다는 5장의 가정에 기댑니다.',
      metrics: [
        { label: 'PG 취소 요청', value: '2번', tone: 'warn' },
        { label: '실제 취소', value: '1번', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        [
          { from: 'c1', to: 'srvA', kind: 'req', label: '같은 키 취소' },
          { from: 'c2', to: 'srvB', kind: 'req', label: '같은 키 취소' }
        ],
        { from: 'srvA', to: 'db', kind: 'write', label: '잠그고 요청 줄', then: { srvB: { badge: '잠금 대기', tone: 'warn' } } },
        { from: 'srvA', to: 'pg', kind: 'req', label: '같은 키로 취소' },
        { from: 'srvB', to: 'db', kind: 'query', label: '같은 키 요청 줄 찾음', then: { srvB: { badge: '', tone: 'muted' } } },
        { from: 'srvB', to: 'pg', kind: 'req', label: '같은 키로 다시' },
        { at: 'pg', then: { pg: { badge: '실제 취소 1번', tone: 'ok' } } },
        { from: 'srvB', to: 'c2', kind: 'res', label: '끝난 10000원 취소' }
      ]
    },
    {
      short: '작업 잠금', tag: '결정', title: '결정 5. 주기 작업은 작업 잠금으로 서버 한 대만 돈다',
      src: '결정 5. 주기 작업을 서버끼리 어떻게 나눌까',
      body: [
        '이 장에서는 주기 작업(승인·취소 보정, 받은 알림 처리)을 작업 잠금 테이블(`job_lock`)로 한 번에 서버 한 대만 돌리기로 했습니다. 맡기는 "맡은 시간이 지났을 때만 바꾼다"는 UPDATE 한 문장이라, 나중 문장은 이미 바뀐 줄을 다시 보고 0줄을 바꿉니다.',
        '못 맡은 서버는 기다리지 않고 이번 주기를 넘깁니다. 다 돌면, 도중에 실패해도 `locked_until`을 그때로 당겨 다음 주기에 아무 서버나 맡게 합니다.'
      ],
      note: '비용: 한 작업을 서버끼리 나눠 돌릴 수 없고, 작업을 맡은 서버가 죽으면 `locked_until`까지 그 작업이 멈춥니다. 맡는 시간(`payment.job-lock.lease`)은 15분입니다.',
      changed: [['+', '`job_lock` 테이블, 서버 이름 `locked_by`'], ['+', '맡는 시간 15분']],
      metrics: [
        { label: '서버 여러 대 계약', value: '6개 통과', tone: 'good' },
        { label: '결제마다 PG 조회', value: '1번', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } },
      focus: ['db'],
      flows: [
        [
          { from: 'srvA', to: 'db', kind: 'write', label: 'job_lock 맡기', mono: true, then: { srvA: { badge: '1줄 바꿈', tone: 'ok' } } },
          { from: 'srvB', to: 'db', kind: 'write', label: 'job_lock 맡기', mono: true, then: { srvB: { badge: '0줄, 이번 주기 넘김', tone: 'muted' } } }
        ],
        { from: 'srvA', to: 'pg', kind: 'query', label: '결제마다 조회' },
        { from: 'pg', to: 'srvA', kind: 'res', label: 'DONE', mono: true },
        { from: 'srvA', to: 'db', kind: 'write', label: 'APPROVE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'srvA', to: 'db', kind: 'write', label: 'locked_until 당김', mono: true, then: { srvA: { badge: '', tone: 'muted' } } }
      ]
    },
    {
      short: '점유 비교', tag: '비교', title: '비교. 결제마다 점유해도 더 빠르지 않았다',
      src: '결정 5. 주기 작업을 서버끼리 어떻게 나눌까',
      body: [
        '결제·알림마다 점유 시각을 두는 비교는 대상 줄에 `claimed_by`, `claimed_until`을 조건부 UPDATE로 먼저 적고 자기가 맡은 줄만 처리합니다. 계약 6개를 모두 통과했습니다.',
        '결과 모름 결제 20건을 서버 1·2·3대가 같은 때 보정한 측정에서 PG 조회 횟수는 작업 잠금 20/20/20, 나누지 않음 20/40/60, 결제마다 점유 20/20/20이었습니다. 주기 한 번에 걸린 시간은 구현과 서버 수에 상관없이 2263~2584ms였습니다.'
      ],
      note: '점유 비교는 첫 서버가 한 번에 100건까지 맡아 20건을 모두 가져갔을 것입니다(서버별로 맡은 건수는 기록하지 않았습니다). 나눠 갖는 효과는 대상이 맡는 단위보다 많아야 나옵니다.',
      metrics: [
        { label: '작업 잠금 · 3대', value: 'PG 조회 20번', tone: 'good' },
        { label: '나누지 않음 · 3대', value: 'PG 조회 60번', tone: 'bad' },
        { label: '주기 한 번', value: '2263~2584ms' }
      ],
      states: { db: { badge: '결과 모름 20건', tone: 'warn' } },
      flows: [
        [
          { from: 'srvA', to: 'db', kind: 'write', label: 'claimed_by 적기', mono: true },
          { from: 'srvB', to: 'db', kind: 'write', label: 'claimed_by 적기', mono: true }
        ],
        { at: 'db', then: { db: { badge: '맡은 줄만 처리', tone: 'info' } } },
        { from: 'srvA', to: 'pg', kind: 'query', label: '맡은 결제 조회' },
        { from: 'pg', to: 'srvA', kind: 'res', label: '결과' },
        { from: 'srvA', to: 'db', kind: 'write', label: '보정 기록', then: { db: { badge: 'PG 조회 20번', tone: 'ok' } } }
      ]
    },
    {
      short: '30개 측정', tag: '결과', title: '같은 결제에 1000원 취소 30개를 보낸 측정',
      src: '같은 결제에 동시 요청 N개를 보낸 측정',
      body: [
        '출발 코드에서 실패하던 15개가 모두 통과했고, 전체 테스트는 6장의 511개에서 **561개**가 되었습니다. 기본 테스트에 둔 비교 셋(첫 요청 기다리기, 이름 잠금, 결제마다 점유)도 계약을 모두 통과했습니다.',
        '승인된 15000원 결제에 1000원 부분 취소 30개를 한꺼번에 보내자, 결제 줄 잠금만 PG 취소 요청이 정확히 **15**였습니다. 잠그지 않음과 `@Version` 그대로는 20~23이 PG로 가서 넘친 5~8개를 PG가 거절했습니다. 응답 중앙값은 결제 줄 잠금 88~90ms, 잠그지 않음 42~65ms였습니다.'
      ],
      note: '연결 풀은 기본값 10개라 N=30이어도 한 번에 기록하는 요청은 10개까지입니다. 트리거로 겹침을 고정하지 않고 PG는 바로 답하며, 전체를 한 번 실행한 값입니다.',
      metrics: [
        { label: 'PG 취소 요청', value: '15', tone: 'good' },
        { label: '응답 중앙값', value: '88~90ms', tone: 'warn' },
        { label: '전체 테스트', value: '561개 통과', tone: 'good' },
        { label: '라인 커버리지', value: '99.3%' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        { from: 'c1', to: 'srvA', kind: 'req', label: '1000원 취소 30개' },
        { from: 'srvA', to: 'db', kind: 'query', label: 'for update 차례로', then: { db: { badge: '결제 줄에서 순서대로', tone: 'info' } } },
        { from: 'srvA', to: 'pg', kind: 'req', label: '남은 금액 안의 15개' },
        { from: 'srvA', to: 'c1', kind: 'fail', label: '15개는 보내기 전에 거부' },
        { at: 'db', then: { db: { badge: '남은 금액 = PG 잔액', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '잠금 대기 시간을 정하지 않았습니다. MySQL `innodb_lock_wait_timeout`은 기본값 50초라, 같은 결제에 겹친 기록은 최대 50초까지 기다린 뒤 오류를 받을 수 있습니다. 교착 상태도 시험하지 않았습니다.',
        '작업을 맡은 서버가 죽으면 맡는 시간(15분)이 지날 때까지 보정과 알림 처리가 멈춥니다. 보정 한 주기는 최악이면 20분으로 맡는 시간보다 길어, 그때는 두 서버가 같은 작업을 함께 돌 수 있습니다.'
      ],
      note: '서버 여러 대는 한 JVM 안의 두 앱으로만 재현했습니다. 서버 사이 네트워크나 DB 연결이 끊기는 경우는 다루지 않았습니다.',
      metrics: [
        { label: '잠금 대기 상한', value: '50초', tone: 'warn' },
        { label: '맡는 시간', value: '15분', tone: 'warn' },
        { label: '한 주기 최악', value: '20분', tone: 'bad' }
      ],
      states: { db: { badge: 'job_lock: 서버 A', tone: 'info' } },
      flows: [
        { at: 'srvA', then: { srvA: { badge: '맡은 채 죽으면?', tone: 'bad', shake: true } } },
        { from: 'srvB', to: 'db', kind: 'write', label: 'job_lock 맡기', mono: true, then: { srvB: { badge: '0줄, 15분까지 못 맡음', tone: 'warn' } } }
      ]
    }
  ]
};
