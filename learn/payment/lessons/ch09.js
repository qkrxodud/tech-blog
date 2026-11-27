// 9장 Transactional Outbox와 Kafka — content/payment-outbox-kafka/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[9] = {
  slug: 'payment-outbox-kafka',
  branch: 'chapter-09',
  title: 'Transactional Outbox와 Kafka',
  goal: '결제 결과를 상태를 바꾼 트랜잭션에 남기고, 릴레이 한 대가 결제 번호를 키로 Kafka에 보내 주문 서비스가 받게 합니다.',
  learn: [
    { text: '트랜잭션 안에서 바로 보내면 생기는 유실·유령', step: 2 },
    { text: '키 없이 보내면 순서가 바뀌는 이유', step: 3 },
    { text: '같은 트랜잭션에 남기는 Transactional Outbox', step: 5 },
    { text: '번호 순으로 읽어 보내는 폴링 릴레이', step: 7 },
    { text: '작업 잠금으로 릴레이 한 대만 돌기', step: 8 },
    { text: '결제 번호 키와 보내지 못한 결제 기다리기', step: 10 },
    { text: '적어도 한 번과 중복', step: 11 },
    { text: '4초 끊은 측정과 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인·취소 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'PaymentRecorder', subMono: true, x: 330, y: 130 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: 'payment_outbox', subMono: true, x: 330, y: 440 },
    { id: 'relay', kind: 'scheduler', label: '릴레이', sub: 'PaymentOutboxScheduler', subMono: true, x: 580, y: 300, absent: '결정 2에서 만듦' },
    { id: 'relay2', kind: 'scheduler', label: '서버 B 릴레이', sub: 'OtherPaymentServer', subMono: true, x: 580, y: 470, absent: '서버 두 대일 때' },
    { id: 'kafka', kind: 'kafka', label: 'Kafka', sub: 'payment-events · 파티션 2', x: 830, y: 130 },
    { id: 'order', kind: 'service', label: '주문 서비스', sub: 'order-service', subMono: true, x: 830, y: 440 }
  ],
  edges: [['client', 'server'], ['server', 'db'], ['db', 'relay'], ['relay', 'kafka'], ['kafka', 'order']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '상태를 바꾼 트랜잭션 안에서 바로 보낸다',
      src: '현재 구조: 상태를 바꾼 자리에서 바로 보내는 결제 이벤트',
      body: [
        '출발 코드는 결제가 결과 상태로 바뀐 바로 그 자리, 같은 트랜잭션 안에서 Kafka에 **키 없이** 보내고 `join()`으로 브로커의 답을 기다립니다. 보내지 못하면 로그만 남기고 결제 기록을 롤백하지는 않습니다.',
        '주문 서비스는 결제 이벤트 토픽을 파티션마다 따로 읽고, 받은 이벤트를 그대로 남긴 뒤 `Order.follow`로 주문 상태를 바꿉니다. 승인·매입은 `PAID`, 승인 실패·만료는 `PAYMENT_FAILED`, 취소는 `CANCELED`가 됩니다.'
      ],
      note: '시험의 프로듀서 시간 제한은 `delivery.timeout.ms=3000`, `request.timeout.ms=2000`, `max.block.ms=3000`으로 줄였습니다. 브로커는 시험 JVM 안의 TCP 중계(`BrokerLink`)로 끊거나 늦춥니다.',
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '보내는 때', value: '커밋 전' },
        { label: '토픽 파티션', value: '2개' },
        { label: '9장 테스트', value: '7개 중 5개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED · 커밋 전', tone: 'info' } } },
        { from: 'server', to: 'kafka', kind: 'event', label: '키 없이 send' },
        { from: 'kafka', to: 'server', kind: 'res', label: 'join() 답', mono: true },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '결제 이벤트', then: { order: { badge: 'PAID', tone: 'ok' } } }
      ]
    },
    {
      short: '유실', tag: '문제', title: '브로커가 끊긴 동안 승인한 결제의 이벤트를 잃는다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '결제 직전에 브로커를 끊고 4초 뒤에 되돌렸습니다. 트랜잭션 안의 보내기가 3초 뒤 실패하자 로그만 남기고 결제는 승인으로 커밋됐습니다.',
        '브로커를 되돌린 뒤 15초를 기다려도 승인은 오지 않았습니다. **다시 보낼 곳에 아무것도 남지 않았기** 때문입니다.'
      ],
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '브로커 끊김', value: '4초', tone: 'warn' },
        { label: '15초 안 도착', value: '없음', tone: 'bad' }
      ],
      states: { kafka: { badge: '끊김', tone: 'bad' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'kafka', kind: 'fail', label: '3초 뒤 실패', cut: true, slow: true },
        { from: 'server', to: 'db', kind: 'write', label: '그대로 커밋', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { at: 'kafka', then: { kafka: { badge: '되돌림', tone: 'ok' } } },
        { at: 'order', then: { order: { badge: '승인 안 옴', tone: 'bad', note: '15초를 기다려도', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '유령', tag: '문제', title: '커밋이 실패한 결제의 승인이 간다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '결제를 승인 상태로 바꾸는 UPDATE를 트리거로 막아 커밋이 실패했고, 결제는 인증 상태로 남았습니다. 그런데 승인 이벤트는 주문 서비스에 도착했습니다. **커밋 전에 이미 보냈기** 때문입니다.',
        '이 결제는 4장의 보정이 나중에 PG 기록대로 승인으로 맞출 수 있지만, 이벤트가 도착한 때에는 결제 서버에 없는 승인이었습니다.'
      ],
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '결제', value: 'AUTHENTICATED', tone: 'warn' },
        { label: '주문', value: 'PAID', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '승인 send' },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인', then: { order: { badge: 'PAID', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'fail', label: '커밋 실패', cut: true },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'bad', note: '결제는 승인이 아님', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '순서', tag: '문제', title: '같은 결제의 승인과 취소가 거꾸로 처리된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '주문 서비스가 승인 이벤트를 남기는 기록을 트리거로 1초 붙잡은 사이 결제를 전액 취소했습니다. 키가 없어 취소 이벤트가 다른 파티션으로 갔고, 다른 소비자가 먼저 처리했습니다.',
        '받은 순서는 **[취소, 승인]**이었고, 결제는 승인 취소인데 주문은 결제 완료(`PAID`)로 남았습니다. `Order.follow`는 앞서 받은 결과보다 오래된 결과인지 보지 않습니다.'
      ],
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '받은 순서', value: '[취소, 승인]', tone: 'bad' },
        { label: '주문', value: 'PAID', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVAL_CANCELED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '승인 → 파티션 0' },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인', slow: true, then: { order: { badge: '1초 붙잡힘', tone: 'warn' } } },
        { from: 'server', to: 'kafka', kind: 'event', label: '취소 → 파티션 1' },
        { from: 'kafka', to: 'order', kind: 'event', label: '취소 먼저', then: { order: { badge: 'CANCELED', tone: 'info' } } },
        { at: 'order', then: { order: { badge: 'PAID', tone: 'bad', note: '늦은 승인이 덮어씀', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '응답 지연', tag: '문제', title: '브로커가 느리면 결제 응답이 느려진다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '브로커 답을 1.5초 붙잡자 결제 승인이 3.05초 걸렸고, 그동안 트랜잭션은 7장의 **결제 줄 잠금을 쥐고** 있었습니다.',
        '이 값은 컨텍스트가 뜬 뒤 첫 승인을 잰 것이라, 시험을 한 번 승인해 둔 뒤 재게 고쳤습니다. 고친 시험에서 출발 구조는 1.53초였고, 어느 쪽이든 1초 계약을 넘었습니다.'
      ],
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '브로커 답', value: '1.5초 늦음', tone: 'warn' },
        { label: '결제 승인', value: '1.53초', tone: 'bad' },
        { label: '계약', value: '1초 안' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'kafka', kind: 'event', label: 'send' },
        { from: 'kafka', to: 'server', kind: 'res', label: '답 1.5초 늦음', slow: true },
        { at: 'db', then: { db: { badge: '결제 줄 잠금', tone: 'warn', note: '답을 기다리는 동안', noteTone: 'muted' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '1.53초 뒤 응답' }
      ]
    },
    {
      short: 'outbox', tag: '결정', title: '결정 1. 같은 트랜잭션에 남기고, 그 자리에서 보내지 않는다',
      src: '결정 1. 결제 결과를 언제 남기고 언제 보낼까',
      body: [
        '이 장에서는 결제 결과를 결제 상태를 바꾼 그 트랜잭션에서 `payment_outbox`에 한 줄 남기고, 브로커에 보내는 일은 그 자리에서 하지 않기로 했습니다. 이 방식을 Transactional Outbox라고 부릅니다.',
        '상태가 커밋되면 알릴 결과도 반드시 남고, 커밋이 실패하면 함께 남지 않습니다. 보내지 않으므로 브로커가 끊기거나 느려도 결제 응답이 기다리지 않습니다. 줄 번호(`id`)는 남긴 순서대로 커져 이벤트의 고유 번호가 됩니다.'
      ],
      note: '비용: 표가 하나 늘고 따로 보내는 일이 있어야 합니다. 브로커를 4초 끊은 측정에서 도착 지연 중앙값이 바로 보냄은 9~14ms, 남겨 두고 보냄은 3340~4551ms였습니다.',
      changed: [['+', '`payment_outbox`(`sent_at`은 비워 둠)'], ['~', '`PaymentEvents`는 남기기만 함'], ['-', 'Kafka 트랜잭션 묶기는 구현하지 않음']],
      hide: ['relay', 'relay2'],
      metrics: [
        { label: '남기는 곳', value: '같은 트랜잭션', tone: 'good' },
        { label: '브로커 기다림', value: '없음', tone: 'good' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED + outbox', then: { db: { badge: 'outbox 한 줄 · sent_at 빔', tone: 'info' } } },
        { from: 'server', to: 'client', kind: 'res', label: '바로 응답' },
        { at: 'kafka', then: { kafka: { badge: '아직 보내지 않음', tone: 'muted' } } }
      ]
    },
    {
      short: '커밋 뒤', tag: '비교', title: '비교. 커밋 뒤에 보내면 유령은 막지만 유실은 남는다',
      src: '결정 1. 결제 결과를 언제 남기고 언제 보낼까',
      body: [
        '커밋 뒤 보내기(`@TransactionalEventListener(AFTER_COMMIT)`)는 계약 7개 중 4개가 실패했습니다. 커밋이 실패하면 보내지 않아 **유령은 막았습니다**.',
        '대신 커밋 뒤 보내기가 3초 뒤 실패하면 다시 보낼 것이 남아 있지 않습니다. 응답도 1.53초로 늘었습니다. 커밋 뒤에도 같은 요청 스레드에서 답을 기다린 것으로 보입니다.'
      ],
      note: '커밋 뒤 리스너가 같은 스레드에서 돈다는 문서 문장은 찾지 못해, 실행 결과로만 압니다.',
      hide: ['relay', 'relay2'],
      edges: [['server', 'kafka']],
      metrics: [
        { label: '커밋 뒤 보냄', value: '7개 중 4개 실패', tone: 'bad' },
        { label: '바로 보냄', value: '7개 중 5개 실패', tone: 'bad' },
        { label: '응답', value: '1.53초', tone: 'bad' }
      ],
      states: { kafka: { badge: '끊김', tone: 'bad' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: '커밋', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'kafka', kind: 'fail', label: '커밋 뒤 send', cut: true, slow: true },
        { from: 'server', to: 'client', kind: 'fail', label: '기다린 뒤 응답' },
        { at: 'order', then: { order: { badge: '승인 안 옴', tone: 'bad', note: '다시 보낼 것이 없음', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '폴링 릴레이', tag: '결정', title: '결정 2. 릴레이가 번호 순으로 읽어 보낸다',
      src: '결정 2. 남긴 결과를 무엇이 읽어 보낼까',
      body: [
        '이 장에서는 남긴 결제 결과를 주기 폴링 릴레이가 번호 순으로 읽어 보내고, 브로커가 받았다고 답하면 보낸 때를 남기기로 했습니다. 500ms마다 `sent_at`이 빈 줄을 50건까지 읽어 하나씩 보냅니다.',
        '이 결정을 넣은 커밋에서 운영 계약 7개 중 5개가 통과했습니다. 끊긴 동안 승인한 결제의 승인이 돌아온 뒤 도착했고, 브로커가 1.5초 늦어도 승인은 **약 17ms**에 답했습니다. 남은 2개는 아직 키가 없어 실패한 순서 계약입니다.'
      ],
      note: '비용: 결과는 길게는 한 주기만큼 늦게 나가고, 보낼 것이 없어도 주기마다 DB를 읽습니다(측정하지 않음). binlog를 읽는 CDC는 Kafka Connect를 따로 운영해야 해 구현하지 않았습니다.',
      changed: [['+', '`PaymentOutboxScheduler` 500ms마다'], ['+', '`findUnsent(50)` → send → `markSent`']],
      hide: ['relay2'],
      focus: ['relay'],
      metrics: [
        { label: '주기', value: '500ms' },
        { label: '한 주기', value: '50건까지' },
        { label: '승인 응답', value: '약 17ms', tone: 'good' }
      ],
      states: { db: { badge: 'outbox 한 줄 · sent_at 빔', tone: 'info' } },
      flows: [
        { from: 'relay', to: 'db', kind: 'query', label: 'findUnsent(50)', mono: true },
        { from: 'relay', to: 'kafka', kind: 'event', label: '번호 순 send' },
        { from: 'kafka', to: 'relay', kind: 'res', label: '받았다는 답' },
        { from: 'relay', to: 'db', kind: 'write', label: 'markSent', mono: true, then: { db: { badge: 'sent_at 남김', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인', then: { order: { badge: 'PAID', tone: 'ok' } } }
      ]
    },
    {
      short: '한 대만', tag: '결정', title: '결정 3. 작업 잠금을 맡은 한 대만 릴레이한다',
      src: '결정 3. 서버가 여러 대일 때 누가 보낼까',
      body: [
        '이 장에서는 서버가 여러 대여도 결제 결과 릴레이는 7장 작업 잠금(`job_lock`)을 맡은 한 대만 돌기로 했습니다. 맡지 못한 서버는 기다리지 않고 이번 주기를 넘깁니다.',
        '한 대가 번호 순으로 보내야 같은 결제의 이벤트가 만든 순서대로 나가고, 같은 결과를 서버마다 한 번씩 보내지 않습니다. 7장의 보정·알림 처리와 같은 주기 작업 방식을 이어 쓸 수 있다는 점도 있었습니다.'
      ],
      note: '비용: 보내는 양을 서버 수만큼 늘릴 수 없습니다(측정 88~98건/초). 맡은 서버가 죽으면 `payment.job-lock.lease`(15분)가 지날 때까지 릴레이가 멈춥니다.',
      changed: [['+', '작업 이름 `payment-outbox-relay`'], ['~', '`ExclusiveJobRunner`로 릴레이를 감쌈']],
      edges: [['db', 'relay2'], ['relay2', 'kafka']],
      focus: ['relay', 'relay2'],
      metrics: [
        { label: '보내는 서버', value: '한 대' },
        { label: '중복', value: '0', tone: 'good' },
        { label: '처리량', value: '88~98건/초' }
      ],
      states: { db: { badge: '승인 n · 취소 n+1', tone: 'info' } },
      flows: [
        [
          { from: 'relay', to: 'db', kind: 'query', label: 'job_lock 맡음', mono: false, then: { relay: { badge: '맡음', tone: 'ok' } } },
          { from: 'relay2', to: 'db', kind: 'query', label: 'job_lock 못 맡음', then: { relay2: { badge: '이번 주기 넘김', tone: 'muted' } } }
        ],
        { from: 'relay', to: 'kafka', kind: 'event', label: 'n, n+1 번호 순' },
        { from: 'kafka', to: 'order', kind: 'event', label: '[n, n+1]', then: { order: { badge: 'CANCELED', tone: 'ok' } } }
      ]
    },
    {
      short: '나눠 보내기', tag: '비교', title: '비교. 잠그지 않으면 중복, 한 줄씩 나누면 순서가 어긋난다',
      src: '결정 3. 서버가 여러 대일 때 누가 보낼까',
      body: [
        '잠그지 않으면 두 서버가 같은 두 결과를 저마다 보내 받은 번호가 **[6, 7, 6, 7]**, 중복 2건이었습니다. 200건 측정에서 처리량은 77~86건/초로 늘지 않았고 중복이 198~200건이었습니다.',
        '한 줄씩 `select … for update skip locked`로 나누면 중복은 없었지만, 한 서버가 승인을 붙잡힌 채 보내는 사이 다른 서버가 취소를 먼저 보냈습니다. 받은 번호는 [7, 6], 주문은 결제 완료로 남았습니다. 처리량은 146~159건/초였습니다.'
      ],
      note: '받는 쪽이 늦게 온 옛 이벤트를 걸러 낼 수 있다면 한 줄씩 나눠 보내는 방식이 맞을 수 있습니다. 이 장의 주문 서비스는 거르지 않습니다(11장).',
      edges: [['db', 'relay2'], ['relay2', 'kafka']],
      focus: ['relay', 'relay2'],
      metrics: [
        { label: '잠그지 않음', value: '중복 198~200', tone: 'bad' },
        { label: '한 줄씩', value: '146~159건/초', tone: 'warn' },
        { label: '순서 위반 결제', value: '2~8건', tone: 'bad' }
      ],
      states: { db: { badge: '승인 6 · 취소 7', tone: 'info' } },
      flows: [
        [
          { from: 'relay', to: 'kafka', kind: 'event', label: '잠금 없이 6, 7' },
          { from: 'relay2', to: 'kafka', kind: 'event', label: '잠금 없이 6, 7' }
        ],
        { from: 'kafka', to: 'order', kind: 'event', label: '[6, 7, 6, 7]', then: { order: { badge: '중복 2', tone: 'bad' } } },
        [
          { from: 'relay', to: 'kafka', kind: 'event', label: '6 잠가 보냄 · 1초', slow: true },
          { from: 'relay2', to: 'kafka', kind: 'event', label: '7 먼저 보냄' }
        ],
        { from: 'kafka', to: 'order', kind: 'event', label: '[7, 6]', then: { order: { badge: 'PAID', tone: 'bad', note: 'skip locked: 취소가 먼저', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '결제 번호 키', tag: '결정', title: '결정 4. 결제 번호를 키로, 못 보낸 결제는 기다린다',
      src: '결정 4. 같은 결제의 이벤트 순서를 어떻게 지킬까',
      body: [
        '이 장에서는 메시지 키를 결제 번호로 하고, 프로듀서를 `acks=all`, `enable.idempotence=true`로 두고, 한 결제의 이벤트를 보내지 못하면 그 결제의 다음 이벤트는 보내지 않고 기다리기로 했습니다.',
        '키가 같으면 같은 파티션에 실려 받는 쪽이 보낸 순서대로 읽습니다. 보내지 못한 결제는 그 주기 동안 `waiting`에 모아 다음 결과를 건너뛰고, 다른 결제의 결과는 이어서 보냅니다. 키 없이 보내는 비교는 계약 7개 중 2개가 실패했습니다.'
      ],
      note: '비용: 못 보낸 결제의 다음 이벤트도 다음 주기까지 늦고, 한 결제의 이벤트는 소비자 하나가 처리합니다. 브로커가 한 대·복제본 1이라 `acks=all`이 여러 복제본을 기다리는 경우는 시험하지 못했습니다.',
      changed: [['+', '키 = 결제 번호'], ['+', '`acks=all`, `enable.idempotence=true`'], ['+', '보내지 못한 결제는 `waiting`']],
      hide: ['relay2'],
      focus: ['relay'],
      metrics: [
        { label: '키 없이', value: '7개 중 2개 실패', tone: 'bad' },
        { label: '키 = 결제 번호', value: '7개 통과', tone: 'good' }
      ],
      states: { db: { badge: '승인 n · 취소 n+1', tone: 'info' } },
      flows: [
        { from: 'relay', to: 'kafka', kind: 'event', label: '키 = 결제 번호', then: { kafka: { badge: '같은 파티션', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인 n', slow: true, then: { order: { badge: 'PAID', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '취소 n+1', then: { order: { badge: 'CANCELED', tone: 'ok', note: '승인 처리 뒤에 취소', noteTone: 'muted' } } }
      ]
    },
    {
      short: '적어도 한 번', tag: '결정', title: '결정 5. 보내고, 답이 오면 남긴다',
      src: '결정 5. 보내기와 보낸 기록 가운데 무엇을 먼저 할까',
      body: [
        '이 장에서는 릴레이의 보장을 적어도 한 번으로 하기로 했습니다. 먼저 보내고 받았다는 답이 온 뒤에 보낸 것을 남기며, 이벤트의 고유 번호로 받는 쪽이 같은 이벤트를 가릴 수 있게 합니다.',
        '보낸 것을 남기는 UPDATE를 막아 두 걸음 사이에서 죽게 하자, 승인이 같은 고유 번호로 **두 번 도착**했습니다(중복 1). 먼저 남기는 최대 한 번 비교는 8개 중 3개가 실패했습니다. 남긴 뒤 죽으면 그 승인은 다시 보내지 않아 15초 안에 도착하지 않았습니다.'
      ],
      note: '비용: 같은 이벤트가 두 번 갈 수 있고, 받는 쪽이 중복을 가려야 합니다. 이 장의 주문 서비스는 몇 번 왔는지 셀 수만 있고, 가리는 일은 11장에서 합니다.',
      hide: ['relay2'],
      focus: ['relay'],
      metrics: [
        { label: '유실', value: '0', tone: 'good' },
        { label: '중복', value: '1', tone: 'warn' },
        { label: '먼저 남김', value: '8개 중 3개 실패', tone: 'bad' }
      ],
      states: { db: { badge: '승인 · sent_at 빔', tone: 'info' } },
      flows: [
        { from: 'relay', to: 'kafka', kind: 'event', label: '승인 send' },
        { from: 'kafka', to: 'relay', kind: 'res', label: '받았다는 답' },
        { from: 'relay', to: 'db', kind: 'fail', label: 'markSent 전에 죽음', cut: true, then: { relay: { badge: '다시 한 주기', tone: 'warn' } } },
        { from: 'relay', to: 'db', kind: 'query', label: 'sent_at 빈 줄 다시', mono: false },
        { from: 'relay', to: 'kafka', kind: 'event', label: '같은 번호 다시' },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인 두 번', then: { order: { badge: '중복 1 · 유실 0', tone: 'warn' } } }
      ]
    },
    {
      short: '측정·결과', tag: '결과', title: '브로커를 4초 끊어도 잃지 않고, 응답은 기다리지 않는다',
      src: '브로커를 4초 끊은 동안과 쌓인 200건을 보낸 측정',
      body: [
        '결제 60건을 승인하고 바로 전액 취소해 이벤트 120건을 만들고, 그사이 브로커를 4초 끊었습니다. 바로 보냄과 커밋 뒤 보냄은 6번 모두 3건을 잃었고, 남겨 두고 릴레이(운영)는 **유실·중복·순서 위반이 0**, 승인 응답 최대는 20~56ms였습니다.',
        '대신 운영의 도착 지연은 중앙값 3340~4551ms였습니다. 끊긴 동안 남은 결과가 브로커가 돌아온 뒤 나가기 때문입니다. 전체 테스트는 8장의 648개에서 671개가 되었고 모두 통과했습니다.'
      ],
      note: '출발 코드에서 실패하던 5개가 모두 통과했고, 라인 커버리지는 97.1%였습니다. 서비스를 시험 JVM 안에서 바로 불러 쟀고 k6는 돌리지 않았습니다.',
      hide: ['relay2'],
      metrics: [
        { label: '유실·중복·순서', value: '0', tone: 'good' },
        { label: '승인 응답 최대', value: '20~56ms', tone: 'good' },
        { label: '도착 지연 중앙', value: '3340~4551ms', tone: 'warn' },
        { label: '전체 테스트', value: '671개 통과', tone: 'good' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '60건 승인·취소' },
        [
          { from: 'server', to: 'db', kind: 'write', label: 'outbox에 남김', then: { db: { badge: '이벤트 120건', tone: 'info' } } },
          { from: 'server', to: 'client', kind: 'res', label: '20~56ms' }
        ],
        { at: 'kafka', then: { kafka: { badge: '4초 끊김', tone: 'bad' } } },
        { from: 'relay', to: 'kafka', kind: 'fail', label: '끊긴 동안 실패', cut: true },
        { at: 'kafka', then: { kafka: { badge: '되돌림', tone: 'ok' } } },
        { from: 'relay', to: 'kafka', kind: 'event', label: '돌아온 뒤 보냄', slow: true },
        { from: 'kafka', to: 'order', kind: 'event', label: '120건', then: { order: { badge: '유실·중복·순서 0', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '받는 쪽은 중복과 옛 이벤트를 가리지 않는다',
      src: '남은 한계',
      body: [
        '적어도 한 번이라 같은 이벤트가 두 번 올 수 있고, 주문 서비스는 받은 순서대로 마지막 이벤트를 따릅니다. 중복 가리기·재시도·실패 모음은 **11장**에서 다룹니다.',
        '보낸 `payment_outbox` 줄을 지우지 않아 계속 쌓이고, 릴레이 한 대가 처리량의 상한(88~98건/초)입니다. 부분 취소와 결과 모름은 알리지 않습니다.'
      ],
      note: '운영 프로듀서 시간 제한(10초·5초·10초)과 한 주기 50건은 계산으로만 정했고 실행으로 확인하지 않았습니다. 브로커는 한 대·복제본 1이라 장애 조치도 시험하지 않았습니다.',
      hide: ['relay2'],
      metrics: [
        { label: '받는 쪽 중복 가리기', value: '없음(11장)', tone: 'warn' },
        { label: '릴레이 상한', value: '88~98건/초', tone: 'warn' }
      ],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '같은 이벤트 두 번', then: { order: { badge: '그대로 두 줄', tone: 'warn', note: '11장에서 가림', noteTone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'outbox 줄이 계속 쌓임', tone: 'warn' } } },
        { at: 'relay', then: { relay: { badge: '한 대가 상한', tone: 'warn' } } }
      ]
    }
  ]
};
