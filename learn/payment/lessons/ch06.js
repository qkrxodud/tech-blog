// 6장 PG 웹훅 처리 — content/payment-webhook/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[6] = {
  slug: 'payment-webhook',
  branch: 'chapter-06',
  title: 'PG 웹훅 처리',
  goal: 'PG가 보내는 결제 상태 알림을 신호로만 쓰고, PG에 다시 조회한 상태를 따라가 결제를 PG와 맞춥니다.',
  learn: [
    { text: '본문을 그 자리에서 옮기면 깨지는 경우', step: 2 },
    { text: '알림은 신호, 상태는 PG 결제 조회로', step: 3 },
    { text: '지난 상태는 거부하지 않고 무시하기', step: 5 },
    { text: '`transactionKey`로 처리 자체를 멱등으로', step: 7 },
    { text: '받아 두고 바로 200, 반영은 처리기', step: 9 },
    { text: '결과 모름 취소를 알림으로 바로 짝짓기', step: 11 },
    { text: '같은 알림 묶음 18건으로 잰 결과와 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'fake', kind: 'ops', label: '위조 알림', sub: '인증 없는 주소', x: 95, y: 120 },
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인 요청', x: 95, y: 462 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: '웹훅 받기', x: 345, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '알림 보내기', x: 640, y: 120 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제 · 받은 알림', x: 640, y: 462 },
    { id: 'proc', kind: 'scheduler', label: '주기 작업', sub: '알림 처리 · 보정', x: 905, y: 300, absent: '결정 4에서 만듦' }
  ],
  edges: [['fake', 'server'], ['client', 'server'], ['server', 'pg'], ['server', 'db'], ['proc', 'pg'], ['proc', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '알림 본문의 상태를 그 자리에서 옮긴다',
      src: '현재 구조: 알림 본문의 상태를 그 자리에서 옮기는 웹훅 엔드포인트',
      body: [
        '6장 출발 코드의 `POST /api/v1/webhooks/tosspayments`는 결제 상태 알림이면 주문번호로 결제를 찾고, 본문에 적힌 상태를 허용 전이 표대로 그 자리에서 옮깁니다. 결제가 없으면 404, 표에 없는 행위면 409 `INVALID_PAYMENT_TRANSITION`으로 답합니다.',
        'Mock PG는 승인(`DONE`), 거절(`ABORTED`), 취소(`PARTIAL_CANCELED`, `CANCELED`)로 상태가 바뀌면 `PAYMENT_STATUS_CHANGED`를 보냅니다. **10초 안에 200**을 받지 못하면 같은 본문으로 **7번까지** 다시 보냅니다.'
      ],
      note: '본문에는 `eventId`가 없습니다. 우리는 `data.orderId`와 `data.status`만 읽습니다.',
      hide: ['proc', 'fake'],
      metrics: [
        { label: '응답 기한', value: '10초' },
        { label: '재전송', value: '최대 7번' },
        { label: '6장 테스트', value: '20개 중 14개 실패', tone: 'bad' }
      ],
      states: { pg: { badge: 'DONE', tone: 'ok' }, db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: 'PAYMENT_STATUS_CHANGED', mono: true },
        { from: 'server', to: 'db', kind: 'query', label: '주문번호로 찾기' },
        { from: 'server', to: 'db', kind: 'write', label: '본문 상태대로 전이', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'res', label: '200', mono: true }
      ]
    },
    {
      short: '순서 409', tag: '문제', title: '승인 답보다 먼저 온 알림 뒤에 답 기록이 막힌다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '승인 답보다 먼저 온 승인 알림이 결제를 승인한 뒤, 늦게 온 승인 답을 기록하는 쪽이 `Cannot APPROVE a payment in APPROVED status.`로 막혔습니다. 승인된 결제에 같은 승인 알림이 오면 409로 답했고, 409를 받은 PG는 같은 알림을 다시 보냅니다.',
        '출발 코드에서 6장 테스트 20개 중 **14개가 실패**했습니다(계약 11개, 운영 전용 1개, API 2개). 원인은 전이 표의 거부, 본문을 그대로 믿기, 부분 취소와 취소 이력을 옮기지 않기, 모르는 주문에 404 네 가지입니다.'
      ],
      note: 'Mock PG의 시험용 조작으로 승인을 기록하고 알린 뒤 승인 답만 붙잡아 두어 이 순서를 만듭니다.',
      hide: ['proc', 'fake'],
      metrics: [
        { label: '6장 테스트', value: '20개 중 14개 실패', tone: 'bad' },
        { label: '같은 승인 알림', value: '409', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { at: 'pg', then: { pg: { badge: 'DONE', tone: 'ok', note: '승인 답을 붙잡아 둠', noteTone: 'warn' } } },
        { from: 'pg', to: 'server', kind: 'event', label: 'DONE 알림', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'pg', to: 'server', kind: 'res', label: '늦게 온 승인 답', slow: true },
        { from: 'server', to: 'db', kind: 'fail', label: 'APPROVE', mono: true, cut: true, then: { db: { badge: 'APPROVED', tone: 'bad', note: '답 기록이 막힘', shake: true } } },
        { from: 'pg', to: 'server', kind: 'event', label: '같은 DONE 알림' },
        { from: 'server', to: 'pg', kind: 'fail', label: '409', mono: true, then: { pg: { badge: 'DONE', tone: 'ok', note: '같은 알림을 다시 보냄', noteTone: 'bad' } } }
      ]
    },
    {
      short: '본문 믿음', tag: '문제', title: '위조 알림은 반영하고, PG 쪽 부분 취소는 무시한다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '본문을 그대로 믿어서, PG 기록과 다른 위조 취소 알림으로 승인된 결제가 `APPROVAL_CANCELED`가 되었습니다. PG에 기록이 없는 결과 모름 결제도 위조 승인 알림으로 `APPROVED`가 되었습니다. 알림 주소에는 인증이 없어서 누구나 보낼 수 있습니다.',
        '부분 취소는 옮기지 않아서, PG에서만 일어난 부분 취소 알림을 무시했습니다. 우리 남은 금액은 15000원, PG 잔액은 10000원이었습니다. 모르는 주문의 알림에는 404로 답해, PG는 받지 못한 알림으로 보고 다시 보냅니다.'
      ],
      note: 'PG에서만 일어난 취소는 가맹점 관리 화면에서 한 취소처럼 우리 서버를 거치지 않은 취소입니다.',
      hide: ['proc'],
      metrics: [
        { label: '우리 남은 금액', value: '15000원', tone: 'bad' },
        { label: 'PG 잔액', value: '10000원' },
        { label: '결제 ↔ PG', value: '어긋남', tone: 'bad' }
      ],
      states: { pg: { badge: 'DONE', tone: 'ok' }, db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        { from: 'fake', to: 'server', kind: 'event', label: 'CANCELED 위조', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: '본문 상태대로 전이', then: { db: { badge: 'APPROVAL_CANCELED', tone: 'bad', note: 'PG는 DONE', shake: true } } },
        { at: 'pg', then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info', note: 'PG에서만 일어난 부분 취소', noteTone: 'muted' }, db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'pg', to: 'server', kind: 'event', label: 'PARTIAL_CANCELED', mono: true },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'bad', note: '남은 금액 15000원 그대로', shake: true } } }
      ]
    },
    {
      short: 'PG 재조회', tag: '결정', title: '결정 1. 알림은 신호로만 쓰고 PG에 다시 조회한다',
      src: '결정 1. 알림의 내용을 믿을까',
      body: [
        '이 장에서는 알림을 "이 결제를 다시 보라"는 신호로만 쓰고, PG 결제 조회(`GET /v1/payments/orders/{orderId}`)로 지금 상태와 취소 이력을 다시 읽어 맞추기로 했습니다. 알림이 PG가 보낸 것인지 확인할 방법이 PG에 다시 묻는 것밖에 없었기 때문입니다.',
        '본문을 그대로 믿는 비교 A는 계약 15개 중 **2개가 실패**했습니다. 위조 취소 알림으로 승인된 결제가 승인 취소가 되었고, 위조 승인 알림으로 결과 모름 결제가 승인되었습니다. 서명 헤더는 결제 상태 알림에 붙는지 판단하지 못해 구현하지 않았습니다.'
      ],
      note: '비용: 알림마다 PG 조회가 한 번 생기고, 조회가 실패하면 반영이 늦어집니다. 우리가 아는 주문번호로 알림을 보내면 그때마다 PG 조회가 생기는데, 이 부하는 실행해 보지 않았습니다.',
      changed: [['+', 'PG 조회 결과를 `GatewayPayment`로 읽기'], ['+', '404 `NOT_FOUND_PAYMENT`는 `NOT_FOUND`, 결제를 그대로 둠'], ['~', '반영은 짧은 트랜잭션 `PaymentWebhookRecorder`']],
      hide: ['proc'],
      metrics: [
        { label: '비교 A 계약', value: '15개 중 2개 실패', tone: 'bad' },
        { label: '위조 알림 반영', value: '안 함', tone: 'good' }
      ],
      states: { pg: { badge: 'DONE', tone: 'ok' }, db: { badge: 'APPROVED', tone: 'ok' } },
      focus: ['server'],
      flows: [
        { from: 'fake', to: 'server', kind: 'event', label: 'CANCELED 위조', mono: true },
        { from: 'server', to: 'pg', kind: 'query', label: '주문번호로 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'DONE', mono: true },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'ok', note: 'PG와 같아 그대로 둠', noteTone: 'muted' } } },
        { from: 'server', to: 'fake', kind: 'res', label: '200', mono: true }
      ]
    },
    {
      short: '따라가기', tag: '결정', title: '결정 2. 갈 수 있는 방향이면 따라가고, 지난 상태는 무시한다',
      src: '결정 2. 순서가 바뀐 알림을 어떻게 받을까',
      body: [
        '이 장에서는 PG에서 다시 읽은 상태가 지금 상태에서 갈 수 있는 방향이면 따라가고, 이미 지난 상태면 거부하지 않고 아무것도 하지 않기로 했습니다. 지금 상태를 PG에서 다시 읽으면 알림이 어떤 순서로 오든 같은 곳에 도착하기 때문입니다.',
        '결정은 결제(`Payment.follow`)가 합니다. 결과 모름 결제에 취소 알림이 먼저 오면 다시 조회해 승인한 뒤 PG 취소를 들여와 `APPROVAL_CANCELED`가 되고, 늦게 온 승인 알림은 지난 상태라 아무것도 하지 않습니다.'
      ],
      note: '비용: PG 상태와 짝이 맞지 않는 지난 상태를 알림으로 고치지 못합니다. 우리가 승인 실패로 닫은 결제를 PG에서 `DONE`으로 읽어도 그대로 두고, 로그로도 남기지 않습니다.',
      changed: [['~', '승인 답 기록·결과 모름 기록은 승인 결과를 기다리는 결제일 때만 바꿈'], ['+', '승인 API는 알림이 먼저 남긴 결과로 답함']],
      hide: ['proc'],
      metrics: [
        { label: '순서 바뀐 알림', value: '따라감', tone: 'good' },
        { label: '지난 상태', value: '무시' }
      ],
      states: { pg: { badge: 'CANCELED', tone: 'info' }, db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } },
      focus: ['server'],
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: '취소 알림이 먼저' },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'CANCELED', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: '승인 뒤 취소 들여옴', then: { db: { badge: 'APPROVAL_CANCELED', tone: 'ok' } } },
        { from: 'pg', to: 'server', kind: 'event', label: '늦게 온 승인 알림' },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'CANCELED', mono: true },
        { at: 'db', then: { db: { badge: 'APPROVAL_CANCELED', tone: 'ok', note: '지난 상태라 그대로', noteTone: 'muted' } } }
      ]
    },
    {
      short: '409 거부', tag: '비교', title: '비교 B. 표에 없는 전이는 409로 거부한다',
      src: '비교 B: 허용 전이 표에 없는 전이는 오류로 답함',
      body: [
        '비교 B는 PG에 조회하지만, PG 상태를 행위 하나로 바꿔 지금 상태에서 표에 없으면 거부합니다. 취소 알림이 먼저 온 결과 모름 결제는 조회 결과가 `CANCELED`라 취소 행위가 되는데, 결과 모름에서는 표에 없어서 두 알림 모두 409로 답했고 결제는 결과 모름으로 남았습니다.',
        '비교 B는 계약 15개 중 **3개가 실패**했습니다. 같은 알림 묶음 측정에서는 첫 전송에 200을 받지 못한 알림이 12건, 재전송이 **52번**, 재전송을 다 써도 200을 받지 못한 알림이 6건이었습니다.'
      ],
      note: '시각으로 거르는 비교 C는 본문을 믿을 때만 뜻이 있어 비교 A 위에 얹었고, A와 같은 위조 2개가 실패했습니다. 시각 비교가 더 막아 준 경우는 이번 시험과 측정에 없었습니다.',
      hide: ['proc'],
      metrics: [
        { label: '비교 B 계약', value: '15개 중 3개 실패', tone: 'bad' },
        { label: '재전송', value: '52번', tone: 'bad' },
        { label: '끝내 200 못 받음', value: '6건', tone: 'bad' }
      ],
      states: { pg: { badge: 'CANCELED', tone: 'info' }, db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } },
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: '취소 알림이 먼저' },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'CANCELED', mono: true },
        { from: 'server', to: 'pg', kind: 'fail', label: '409', mono: true, then: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'bad', note: '표에 없는 전이', shake: true } } },
        { from: 'pg', to: 'server', kind: 'event', label: '같은 알림 다시' },
        { from: 'server', to: 'pg', kind: 'fail', label: '409', mono: true, then: { pg: { badge: 'CANCELED', tone: 'info', note: '재전송을 다 쓸 때까지', noteTone: 'bad' } } }
      ]
    },
    {
      short: '취소 이력', tag: '결정', title: '결정 3. PG 취소 이력을 transactionKey로 맞춘다',
      src: '결정 3. 같은 알림이 여러 번 오면 어떻게 할까',
      body: [
        '이 장에서는 중복 알림을 거르는 표를 따로 두지 않고, PG 취소 이력을 `transactionKey`로 맞춰 처리 자체를 멱등으로 하기로 했습니다. PG 취소 이력 가운데 우리 기록에 없는 키만 끝난 취소로 들여오고, 아는 키는 건너뜁니다.',
        '우리 기록에 없는 PG 취소는 PG에서만 일어난 취소입니다. 이 취소를 담으려고 `payment_cancel`의 `idempotency_key`와 `request_digest`를 비워 둘 수 있게 하고, `unique(payment_id, transaction_key)`를 더했습니다.'
      ],
      note: '비용: 우리 표에 없는 PG 취소를 모두 PG에서만 일어난 취소로 들여옵니다. 우리가 요청한 취소의 결과를 아직 모를 때 알림이 오면 같은 취소가 두 번 남을 수 있었고, 결정 5에서 먼저 짝짓기로 막았습니다.',
      changed: [['+', '`unique(payment_id, transaction_key)`'], ['~', '`idempotency_key`, `request_digest`를 비워 둘 수 있음'], ['~', '취소 목록은 `@OrderBy("id asc")`']],
      hide: ['proc'],
      metrics: [
        { label: '중복을 거르는 표', value: '없음' },
        { label: '같은 상태 다시', value: '취소 기록 1건', tone: 'good' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' }, db: { badge: '취소 tx-1', tone: 'ok' } },
      focus: ['server'],
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: 'PARTIAL_CANCELED', mono: true },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'cancels tx-1 · tx-2' },
        { from: 'server', to: 'db', kind: 'write', label: '모르는 tx-2만 들여옴', then: { db: { badge: '취소 tx-1 · tx-2', tone: 'ok' } } },
        { from: 'pg', to: 'server', kind: 'event', label: '같은 상태 다시' },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: 'cancels tx-1 · tx-2' },
        { at: 'db', then: { db: { badge: '취소 tx-1 · tx-2', tone: 'ok', note: '아는 키라 새 줄 없음', noteTone: 'muted' } } }
      ]
    },
    {
      short: '본문 해시', tag: '비교', title: '비교 D. 본문 해시로 같은 알림을 거른다',
      src: '비교 D: 받은 본문을 남겨 같은 본문을 거르고, 알림 한 건을 변화 한 건으로 처리함',
      body: [
        '비교 D는 받은 본문의 SHA-256을 남겨 같은 본문을 거르고, 처리할 때 PG에서 읽은 마지막 취소 하나를 이번 알림이 알린 새 취소로 봅니다. 거르기를 믿기 때문에 처리 자체는 멱등이 아닙니다.',
        '같은 상태가 다른 `createdAt`으로 다시 오면 본문이 달라 걸러지지 않았고, 같은 취소가 두 번 남아 `Expected size: 1 but was: 2`로 실패했습니다. 계약 15개 중 1개가 실패했고, 측정에서는 3건이 어긋났습니다.'
      ],
      note: '결제 상태 알림에는 `eventId`가 없어서, 거르는 표를 둔다면 키로 쓸 값이 본문밖에 없습니다. 전송 헤더는 보낼 때마다 새로 발급되어 쓸 수 없었습니다.',
      hide: ['proc'],
      metrics: [
        { label: '비교 D 계약', value: '15개 중 1개 실패', tone: 'bad' },
        { label: '측정 어긋남', value: '3건', tone: 'bad' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' }, db: { badge: '취소 기록 1건', tone: 'ok' } },
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: '같은 상태, 새 createdAt' },
        { from: 'server', to: 'db', kind: 'query', label: '본문 해시 비교' },
        { at: 'server', then: { server: { badge: '본문이 달라 통과', tone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: '마지막 취소' },
        { from: 'server', to: 'db', kind: 'write', label: '마지막 취소를 새 취소로', then: { db: { badge: '취소 기록 2건', tone: 'bad', note: '같은 취소가 두 번', shake: true } } }
      ]
    },
    {
      short: '바로 200', tag: '결정', title: '결정 4. 받은 알림을 남기고 바로 200으로 답한다',
      src: '결정 4. 언제 200으로 답할까',
      body: [
        '이 장에서는 받은 알림을 `payment_webhook`에 남기고 바로 200으로 답하며, PG 조회와 반영은 주기 처리기가 하기로 했습니다. 받는 쪽이 PG 조회를 기다리지 않으면 조회의 지연이나 실패가 알림의 답에 섞이지 않습니다.',
        '처리기는 처리 전 알림을 받은 순서대로 100건까지 읽어 주문마다 묶고, 주문마다 PG 조회를 한 번 합니다. 결제를 맞춘 것과 알림을 `PROCESSED`로 닫은 것은 같은 트랜잭션에서 반영되고, 조회에 실패하면 `RECEIVED`로 남겨 다음 처리 때 다시 봅니다.'
      ],
      note: '비용: 알림부터 반영까지 처리 주기만큼 늦고, `payment_webhook`이 계속 자랍니다. 조회가 계속 실패하면 주기마다 다시 조회하고, 재처리 횟수에 상한이 없습니다.',
      changed: [['+', '`payment_webhook` 처리 상태 `RECEIVED`, `PROCESSED`, `IGNORED`'], ['+', '`PaymentWebhookProcessor`, `payment.webhook.interval` 1초']],
      metrics: [
        { label: '첫 전송 200 실패', value: '0건', tone: 'good' },
        { label: '가장 늦은 첫 답', value: '12ms', tone: 'good' },
        { label: '처리 주기', value: '1초' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' }, db: { badge: 'APPROVED', tone: 'ok' } },
      focus: ['proc'],
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: 'PAYMENT_STATUS_CHANGED', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: 'RECEIVED', mono: true, then: { db: { badge: '알림 RECEIVED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'res', label: '200', mono: true },
        { from: 'proc', to: 'db', kind: 'query', label: '처리 전 알림 100건까지' },
        { from: 'proc', to: 'pg', kind: 'query', label: '주문마다 조회 한 번' },
        { from: 'pg', to: 'proc', kind: 'res', label: 'PARTIAL_CANCELED', mono: true },
        { from: 'proc', to: 'db', kind: 'write', label: '따라가기 + PROCESSED', then: { db: { badge: '알림 PROCESSED', tone: 'ok' } } }
      ]
    },
    {
      short: '요청 안', tag: '비교', title: '비교 E. 요청 안에서 조회까지 끝내고 답하면',
      src: '비교 E: 받은 요청 안에서 카드사 조회와 반영까지 끝내고 답함',
      body: [
        '비교 E는 결정 3 시점의 운영 구현 그대로, 받은 요청 안에서 PG 조회와 반영까지 끝내고 답합니다. PG 조회가 읽기 시간 제한(1초)보다 늦게(1.5초) 답하자 조회가 시간 초과로 끝나 **504**로 답했고, 계약 15개 중 1개가 실패했습니다.',
        '측정에서는 첫 전송에 200을 받지 못한 알림이 6건, 재전송이 10번, 가장 늦은 첫 답이 1012ms였습니다. 결제는 재전송이 결국 맞춰서 25초 뒤 어긋난 결제는 0건이었습니다.'
      ],
      note: 'PG 조회가 늘 읽기 제한 안에 답하고 재전송을 받는 것이 문제가 되지 않는다면, 요청 안에서 반영해도 결제는 맞습니다.',
      hide: ['proc'],
      metrics: [
        { label: '첫 전송 200 실패', value: '6건', tone: 'bad' },
        { label: '재전송', value: '10번', tone: 'warn' },
        { label: '가장 늦은 첫 답', value: '1012ms', tone: 'bad' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' }, db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: 'PAYMENT_STATUS_CHANGED', mono: true },
        { from: 'server', to: 'pg', kind: 'query', label: '요청 안에서 조회' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 안에 답 없음', cut: true, slow: true },
        { from: 'server', to: 'pg', kind: 'fail', label: '504', mono: true, then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info', note: '같은 알림을 다시 보냄', noteTone: 'warn' } } },
        { from: 'pg', to: 'server', kind: 'event', label: '재전송' }
      ]
    },
    {
      short: '바로 맞춤', tag: '결정', title: '결정 5. 결과 모름 결제·취소는 알림으로 바로 맞춘다',
      src: '결정 5. 결과를 모르는 결제와 취소를 알림으로 바로 맞출까',
      body: [
        '이 장에서는 결과 모름 결제·취소에 알림이 오면 보정 대기 시간을 기다리지 않고 그 결제만 바로 맞추고, 결과를 기다리는 우리 취소는 PG 취소와 먼저 짝지어 닫기로 했습니다. 알림을 받은 결제는 PG가 이미 상태를 바꾼 결제이기 때문입니다.',
        '짝짓기는 5장 보정과 같은 함수(`sameAmountOf`)를 씁니다. 우리 5000원 취소가 결과 모름이고 PG가 그 취소를 tx-9로 끝냈다면, 모르는 키 tx-9를 같은 금액의 우리 취소와 짝지어 `DONE`으로 닫습니다. 짝이 없는 우리 취소를 실패로 닫는 일은 대기 시간이 지난 주기 보정에 남겼습니다.'
      ],
      note: '비용: 금액으로 짝을 지어, 같은 금액의 우리 요청 취소(PG가 처리 중)와 PG에서만 일어난 취소가 함께 있으면 잘못 짝지어질 수 있습니다. 실행해 보지는 않았습니다. 처리기가 한 스레드라 늦게 답하는 조회가 있으면 같은 주기의 다른 주문도 기다립니다.',
      metrics: [
        { label: '남은 금액', value: '10000원', tone: 'good' },
        { label: '취소 기록', value: '한 줄', tone: 'good' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' }, db: { badge: '취소 UNKNOWN 5000원', tone: 'warn' } },
      focus: ['proc'],
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: '취소 알림' },
        { from: 'server', to: 'db', kind: 'write', label: 'RECEIVED', mono: true },
        { from: 'server', to: 'pg', kind: 'res', label: '200', mono: true },
        { from: 'proc', to: 'pg', kind: 'query', label: '다시 조회' },
        { from: 'pg', to: 'proc', kind: 'res', label: '모르는 키 tx-9' },
        { from: 'proc', to: 'db', kind: 'write', label: '같은 금액과 짝지어 DONE', then: { db: { badge: '취소 DONE · 남은 10000원', tone: 'ok' } } }
      ]
    },
    {
      short: '보정만', tag: '비교', title: '비교 F. 알림을 무시하고 주기 보정만 하면',
      src: '비교 F: 알림을 무시하고 주기 보정만 함',
      body: [
        '비교 F는 알림에 받았다고만 답하고 4·5장 보정만 돌립니다. 보정 대기 시간(10초)이 지나지 않은 결제·취소는 보지 않아서 계약 15개 중 **7개가 실패**했습니다. 5장 보정은 우리가 요청한 취소만 보기 때문에, PG에서만 일어난 취소는 대기 시간과 상관없이 끝내 맞춰지지 않았습니다.',
        '측정에서는 25초 뒤 어긋난 결제가 **8건**이었고, 모두 PG에서만 일어난 취소가 있는 시나리오입니다. 결과 모름 결제·취소는 8.6~8.8초 뒤에야 맞았습니다.'
      ],
      note: 'PG에서만 일어나는 취소가 없고 결과 모름이 대기 시간만큼 이어져도 괜찮은 서비스라면, 주기 보정만으로도 결과 모름은 결국 맞춰집니다.',
      metrics: [
        { label: '비교 F 계약', value: '15개 중 7개 실패', tone: 'bad' },
        { label: '어긋난 결제', value: '8건', tone: 'bad' },
        { label: '결과 모름 맞춤', value: '8.6~8.8초', tone: 'warn' }
      ],
      states: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info', note: 'PG에서만 일어난 취소', noteTone: 'muted' }, db: { badge: 'APPROVED', tone: 'ok' } },
      focus: ['proc'],
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: 'PARTIAL_CANCELED', mono: true },
        { from: 'server', to: 'pg', kind: 'res', label: '200만 답함' },
        { from: 'proc', to: 'db', kind: 'query', label: '우리가 요청한 취소만' },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'bad', note: 'PG 취소를 들여오지 못함', shake: true } } }
      ]
    },
    {
      short: '18건 측정', tag: '결과', title: '같은 알림 묶음 18건으로 잰 결과',
      src: '같은 알림 묶음으로 잰 결과',
      body: [
        '출발 코드에서 실패하던 14개가 모두 통과했고, 전체 테스트는 5장의 460개에서 **511개**가 되었습니다. 4장 보정도 웹훅과 같은 `follow`로 닫게 바꿔, 4장 비교 구현 망취소는 보정 계약 9개 중 3개를 지키지 못하게 되었습니다.',
        '9개 시나리오를 2건씩 보낸 같은 알림 묶음 18건에서 운영 구현은 **18건이 모두 PG와 맞았고**, 36개 알림 모두 첫 전송에 200을 받았습니다. 비교 A·C는 위조 2건, D는 3건, F는 8건이 어긋났습니다.'
      ],
      note: '측정은 받은 알림 처리와 4·5장 주기 보정을 0.2초마다 함께 돌리고, 묶음을 다 보낸 뒤 25초까지 봤습니다. 한 번 실행한 값입니다.',
      metrics: [
        { label: '어긋난 결제', value: '0건', tone: 'good' },
        { label: '첫 전송 200 실패', value: '0건', tone: 'good' },
        { label: '전체 테스트', value: '511개 통과', tone: 'good' },
        { label: '라인 커버리지', value: '99.4%' }
      ],
      states: { pg: { badge: '시나리오 9개 × 2건', tone: 'info' }, db: { badge: '결제 18건', tone: 'info' } },
      flows: [
        { from: 'pg', to: 'server', kind: 'event', label: '알림 36개' },
        { from: 'server', to: 'pg', kind: 'res', label: '모두 첫 전송에 200' },
        { from: 'proc', to: 'pg', kind: 'query', label: '주문마다 조회' },
        { from: 'proc', to: 'db', kind: 'write', label: '따라가기', then: { db: { badge: '18건 모두 PG와 같음', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '서명 검증을 구현하지 않아 위조 알림은 PG 조회로만 막고, 알림 주소에는 인증이 없습니다. PG 조회 실패의 재처리에 상한이 없고, 따라갈 수 없는 어긋남은 로그로도 남기지 않습니다.',
        '처리기의 반영과 승인·취소 API의 기록이 같은 결제를 동시에 바꾸는 경우를 막지 않습니다. 결제 서버가 여러 대면 처리기가 서버마다 돌아 같은 알림을 여러 서버가 함께 처리합니다. 둘 다 7장 동시성 제어에서 다룹니다.'
      ],
      note: '5장 취소 API는 지금도 PG 취소 응답의 `cancels` 마지막 칸을 이번 취소로 읽습니다. 알림을 따라갈 때만 목록 전체를 `transactionKey`로 맞춥니다.',
      metrics: [
        { label: '서버', value: '1대 가정', tone: 'warn' },
        { label: '잠금·버전', value: '없음', tone: 'warn' },
        { label: '재처리 상한', value: '없음', tone: 'warn' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' } },
      flows: [
        [
          { from: 'proc', to: 'db', kind: 'write', label: '알림 반영' },
          { from: 'server', to: 'db', kind: 'write', label: '승인·취소 기록' }
        ],
        { at: 'db', then: { db: { badge: '같은 결제를 동시에', tone: 'warn', note: '7장에서 다룸', noteTone: 'warn' } } }
      ]
    }
  ]
};
