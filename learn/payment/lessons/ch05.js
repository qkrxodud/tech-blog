// 5장 결제 취소와 부분 취소 — content/payment-partial-cancel/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[5] = {
  slug: 'payment-partial-cancel',
  branch: 'chapter-05',
  title: '결제 취소와 부분 취소',
  goal: '취소마다 한 줄을 남겨 남은 금액 안에서 여러 번 취소하고, 같은 취소 요청은 Idempotency-Key로 가립니다.',
  learn: [
    { text: '부분 취소 한 번에 결제가 닫히는 이유', step: 1 },
    { text: '취소마다 한 줄 남기는 `payment_cancel`', step: 3 },
    { text: '상태는 그대로, 남은 금액 0원이면 `cancel()`', step: 4 },
    { text: '`Idempotency-Key` 필수와 422', step: 5 },
    { text: '`REQUESTED`를 먼저 기록하고 보정으로 맞추기', step: 8 },
    { text: 'PG에도 같은 멱등키 넘기기', step: 10 },
    { text: '같은 취소 묶음 12건으로 잰 결과', step: 12 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '취소 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'cancel', subMono: true, x: 345, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '부분 취소·멱등키', x: 640, y: 120 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제·취소 기록', x: 640, y: 462 },
    { id: 'sched', kind: 'scheduler', label: '주기 보정', sub: '4장 보정을 넓힘', x: 905, y: 300 }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db'], ['sched', 'pg'], ['sched', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '받은 금액으로 PG에 취소를 보내고 상태만 바꾼다',
      src: '현재 구조: 받은 금액으로 PG에 취소를 보내고 상태만 바꾸는 취소 API',
      body: [
        '5장 출발 코드의 취소 API는 결제를 읽고, 받은 금액으로 PG에 취소를 보내고, PG가 취소하면 1장부터 있던 `cancel()` 전이를 부릅니다. 2장처럼 PG 호출은 트랜잭션 밖에서 합니다.',
        '취소 이력과 남은 금액은 어디에도 남기지 않고, `Idempotency-Key` 헤더도 받지만 쓰지는 않습니다. 계약은 **결제 금액 15000원, 부분 취소 5000원**으로 돌립니다.'
      ],
      note: 'Mock PG는 `cancelAmount`로 부분 취소하고 `balanceAmount`와 `cancels`를 돌려줍니다. 잔액이 0원이 되면 `CANCELED`, 남으면 `PARTIAL_CANCELED`입니다.',
      hide: ['sched'],
      metrics: [
        { label: '결제 금액', value: '15000원' },
        { label: '5장 테스트', value: '37개 중 29개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '취소 요청' },
        { from: 'server', to: 'db', kind: 'query', label: '결제 읽기' },
        { from: 'server', to: 'pg', kind: 'req', label: '받은 금액으로 취소' },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨', then: { pg: { badge: 'CANCELED', tone: 'info' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'cancel()', mono: true, then: { db: { badge: 'APPROVAL_CANCELED', tone: 'info' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '부분 취소', tag: '문제', title: '5000원만 취소해도 결제가 닫힌다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '출발 코드는 금액과 상관없이 `cancel()` 전이를 부르므로, 5000원만 취소해도 결제는 `APPROVAL_CANCELED`가 됩니다. 두 번째 부분 취소는 PG에서 취소된 뒤 우리 쪽 전이가 막혀, **PG에는 취소가 두 건인데 우리는 409**로 답합니다.',
        '남은 금액을 모르니 PG에 보내기 전에 막을 수도 없습니다. 남은 금액보다 큰 취소는 PG가 거절한 뒤에야 502로 끝났고, 승인 결과를 모르는 결제는 PG에 취소가 나간 뒤 전이에서 막혔습니다.'
      ],
      hide: ['sched'],
      metrics: [
        { label: 'PG 취소', value: '2건', tone: 'bad' },
        { label: '우리 응답', value: '409', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '5000원 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원' },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨', then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'cancel()', mono: true, then: { db: { badge: 'APPROVAL_CANCELED', tone: 'bad', note: '5000원만 취소했는데', shake: true } } },
        { from: 'client', to: 'server', kind: 'req', label: '두 번째 5000원' },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원', then: { pg: { badge: '취소 2건', tone: 'warn' } } },
        { from: 'server', to: 'db', kind: 'fail', label: 'cancel() 거부', mono: false, cut: true },
        { from: 'server', to: 'client', kind: 'fail', label: '409', mono: true }
      ]
    },
    {
      short: '같은 키', tag: '문제', title: '같은 취소 요청을 가리지 못한다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '같은 Idempotency-Key로 다시 온 취소가 **PG에 두 번** 갔습니다. 시간 제한을 넘긴 취소를 같은 키로 다시 보내면 PG에서 두 번 취소되어, PG 잔액은 5000원인데 우리는 10000원으로 답했습니다.',
        '출발 코드에서 5장 테스트 37개 중 **29개**(계약 19개, API 10개)가 실패했습니다. API 쪽에서는 키가 없거나 300자를 넘어도 200으로 받았습니다.'
      ],
      note: '결과를 모르는 취소와 기록에 실패한 취소는 남을 곳이 없었습니다. 기록 실패 테스트는 `payment_cancel` 테이블이 없어 트리거를 만드는 단계에서 실패했습니다.',
      hide: ['sched'],
      metrics: [
        { label: '5장 테스트', value: '37개 중 29개 실패', tone: 'bad' },
        { label: 'PG 잔액', value: '5000원', tone: 'bad' },
        { label: '우리 답', value: '10000원', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '5000원 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 시간 초과', cut: true, slow: true, then: { pg: { badge: '잔액 10000원', tone: 'info' } } },
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원', then: { pg: { badge: '잔액 5000원', tone: 'bad', note: '두 번 취소', shake: true } } },
        { from: 'server', to: 'client', kind: 'res', label: '남은 10000원' }
      ]
    },
    {
      short: '취소 기록', tag: '결정', title: '결정 1. 취소마다 payment_cancel에 한 줄을 남긴다',
      src: '결정 1. 취소를 어떻게 기록할까',
      body: [
        '이 장에서는 취소마다 한 줄을 남기는 `payment_cancel` 테이블에 PG 취소를 기록하고, 남은 금액은 끝난 취소의 합으로 계산하기로 했습니다. 같은 요청 가리기, 결과 모름 보정, PG의 `transactionKey` 짝짓기가 모두 **취소 한 건 단위**로 값을 들고 있어야 하기 때문입니다.',
        '취소(`PaymentCancel`)는 결제(`Payment`)에 딸린 기록이라 결제를 거쳐서만 만들고 바꿉니다. 결제 행에 합계만 두는 방식은 구현하지 않았습니다.'
      ],
      note: '비용: 외래 키 때문에 4장 보정 테스트의 `delete from payment` 정리가 실패해 고쳤습니다. 결제 조회 API(`GET /api/v1/payments/{orderId}`)로는 남은 금액을 볼 수 없습니다.',
      changed: [['+', '`payment_cancel` 테이블'], ['+', '`PaymentCancel`, `@OneToMany`'], ['~', '남은 금액 = 결제 금액 − `DONE` 취소의 합']],
      hide: ['sched'],
      metrics: [
        { label: '결제 금액', value: '15000원' },
        { label: '남은 금액', value: '10000원', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '5000원 취소' },
        { from: 'server', to: 'db', kind: 'write', label: 'payment_cancel 한 줄', mono: false },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원' },
        { from: 'pg', to: 'server', kind: 'res', label: 'transactionKey', mono: true, then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '취소 1줄 · 남은 10000원', noteTone: 'muted' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '상태 유지', tag: '결정', title: '결정 2. 상태는 그대로, 남은 금액 0원이면 cancel()',
      src: '결정 2. 부분 취소된 결제는 어떤 상태로 둘까',
      body: [
        '이 장에서는 결제 상태는 그대로 두고 남은 금액 안에서 취소를 받으며, 남은 금액이 0원이 되면 기존 `CANCEL` 전이로 닫기로 했습니다. 새 상태를 두면 승인 후와 매입 후 두 개로 늘어나기 때문입니다.',
        '취소를 받을지는 **PG에 보내기 전에** 결제가 판단합니다. 전이 표에 `CANCEL`이 없는 상태면 409 `INVALID_PAYMENT_TRANSITION`, 0원 이하면 400 `INVALID_AMOUNT`, 받을 수 있는 금액을 넘으면 409 `CANCEL_AMOUNT_EXCEEDS_BALANCE`입니다.'
      ],
      note: '비용: 부분 취소된 결제도 `APPROVED`로 보여 상태만으로는 구별할 수 없고, 남은 금액을 보려면 취소 기록을 읽어야 합니다.',
      changed: [['~', '남은 금액이 0원일 때만 `cancel()`'], ['+', '`Payment.checkCancel`']],
      hide: ['sched'],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: '남은 15000원', noteTone: 'muted' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '5000원 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원' },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨', then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '남은 10000원', noteTone: 'muted' } } },
        { from: 'client', to: 'server', kind: 'req', label: '10000원 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '10000원' },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨', then: { pg: { badge: 'CANCELED', tone: 'info' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'cancel()', mono: true, then: { db: { badge: 'APPROVAL_CANCELED', tone: 'info', note: '남은 0원', noteTone: 'muted' } } }
      ]
    },
    {
      short: '키 필수', tag: '결정', title: '결정 3. Idempotency-Key를 반드시 받고, 같은 키에 다른 내용이면 422',
      src: '결정 3. 같은 취소 요청을 무엇으로 가릴까',
      body: [
        '이 장에서는 취소 요청에 `Idempotency-Key`를 반드시 받고, 같은 키로 같은 내용이 다시 오면 PG를 부르지 않고 남긴 결과로 답하며, 같은 키에 다른 내용이 오면 422로 답하기로 했습니다. 같은 금액의 정상 부분 취소가 여러 번 있을 수 있어 **키 없이는 재시도와 새 취소를 가릴 수 없습니다.**',
        '같은 내용인지는 금액과 사유를 SHA-256으로 줄인 `request_digest`로 비교합니다. 다시 온 요청에는 그 취소가 끝났을 때 남은 금액 `balance_after`로 처음과 같은 답을 줍니다.'
      ],
      note: '비용: 클라이언트가 취소마다 키를 만들어 보관해야 하고, 키 없는 취소는 400 `INVALID_IDEMPOTENCY_KEY`로 막힙니다. 토스페이먼츠·Stripe는 키를 선택으로 받아 약속이 다릅니다.',
      changed: [['+', '`request_digest`, `balance_after`'], ['+', '`unique(payment_id, idempotency_key)`'], ['+', '422 `IDEMPOTENCY_KEY_REUSED`']],
      hide: ['sched'],
      metrics: [
        { label: '키 길이', value: '300자 이하' },
        { label: '다시 온 cancel-1', value: '남은 10000원', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: 'cancel-1, cancel-2 DONE', noteTone: 'muted' }, pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: 'cancel-1 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '같은 키·request_digest', mono: false },
        { from: 'server', to: 'client', kind: 'res', label: '처음 답 10000원' },
        { from: 'client', to: 'server', kind: 'req', label: 'cancel-1 다른 금액' },
        { from: 'server', to: 'db', kind: 'query', label: 'digest 다름' },
        { from: 'server', to: 'client', kind: 'fail', label: '422', mono: true }
      ]
    },
    {
      short: '자연 키', tag: '비교', title: '비교 A. 같은 금액·사유를 같은 요청으로 보면',
      src: '결정 3. 같은 취소 요청을 무엇으로 가릴까',
      body: [
        '비교 A는 키 자리에 금액·사유로 만든 값을 넣습니다. 키를 바꾼 **같은 금액의 두 번째 부분 취소**를 첫 취소의 재요청으로 보고 처음 답을 돌려줘서, PG에는 취소가 한 건만 남았습니다.',
        '같은 키에 다른 금액이 온 경우는 다른 자연 키가 되어 새 취소로 받았습니다. 비교 A는 계약 24개 중 2개가 실패했습니다.'
      ],
      note: '같은 취소 묶음에서 비교 A는 실제 취소 12건, 덜 취소된 결제 2건이었습니다.',
      hide: ['sched'],
      metrics: [
        { label: '취소 계약', value: '24개 중 2개 실패', tone: 'bad' },
        { label: '덜 취소된 결제', value: '2건', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: '5000원 취소 DONE', noteTone: 'muted' }, pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '새 키 · 5000원' },
        { from: 'server', to: 'db', kind: 'query', label: '같은 금액·사유?' },
        { from: 'server', to: 'client', kind: 'res', label: '처음 답' },
        { at: 'pg', then: { pg: { badge: '취소 1건', tone: 'bad', note: '두 번째 취소가 안 감', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '지금 상태', tag: '비교', title: '비교 B. 키를 쓰지 않고 지금 결제 상태로 답하면',
      src: '결정 3. 같은 취소 요청을 무엇으로 가릴까',
      body: [
        '비교 B는 3장 승인 재요청 방식입니다. 부분 취소 뒤에는 결제가 아직 승인 상태라 **재요청을 새 취소로** 보내고, 전액 취소 뒤에는 새 취소까지 재요청으로 봤습니다. 계약 24개 중 6개가 실패했습니다.',
        '같은 취소 묶음에서 PG가 실제로 취소한 건은 18건으로 뜻한 14건보다 많았습니다. 그런데 우리 기록에도 새 줄로 남겨, 남은 금액과 카드사 잔액이 다른 결제는 0건으로 보였습니다.'
      ],
      note: '우리 기록과 PG 잔액이 함께 더 줄어서 둘을 비교하면 같아 보입니다. 기록이 PG와 맞는지만 봐서는 부족한 경우입니다.',
      hide: ['sched'],
      metrics: [
        { label: '취소 계약', value: '24개 중 6개 실패', tone: 'bad' },
        { label: '더 취소된 결제', value: '4건', tone: 'bad' },
        { label: '잔액이 다른 결제', value: '0건' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: '남은 10000원', noteTone: 'muted' }, pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '아직 APPROVED', mono: true },
        { from: 'server', to: 'pg', kind: 'req', label: '새 취소로 5000원', then: { pg: { badge: '한 번 더 취소', tone: 'bad', shake: true } } },
        { from: 'server', to: 'db', kind: 'write', label: '새 줄', then: { db: { badge: 'APPROVED', tone: 'warn', note: '남은 5000원, PG와 같아 보임', noteTone: 'warn' } } }
      ]
    },
    {
      short: '먼저 기록', tag: '결정', title: '결정 4. REQUESTED를 먼저 기록하고, 결과 모름은 보정으로 맞춘다',
      src: '결정 4. 기록과 PG 호출을 어떤 순서로 할까',
      body: [
        '이 장에서는 취소 요청을 먼저 기록하고(`REQUESTED`), PG 호출은 트랜잭션 밖에서 한 뒤 결과를 따로 기록하며, PG 답을 받지 못한 취소는 결과 모름(`UNKNOWN`)으로 남겨 4장 보정을 넓혀 맞추기로 했습니다. PG를 부르기 전에 남긴 줄이 있어야 **보정이 맞출 대상이 생기기** 때문입니다.',
        '보정은 대기 시간이 지난 취소가 있는 결제를 골라 주문번호로 PG에 조회하고, `cancels` 가운데 같은 금액의 `DONE` 취소가 있으면 `DONE`, 없으면 `FAILED`로 닫습니다.'
      ],
      note: '비용: 취소마다 트랜잭션이 두 번 돌고, 결과 모름 확정까지 대기 시간과 보정 주기(기본 1분, 1분)가 걸립니다. 금액으로 짝을 지어, 같은 금액의 결과 모름 취소가 여럿이면 어느 키가 `DONE`이 되는지는 실제와 바뀔 수 있습니다.',
      changed: [['+', '`REQUESTED` → `DONE`·`FAILED`·`UNKNOWN`'], ['+', '`PaymentCancelRecorder`, `PaymentCancelReconciler`'], ['~', '받을 수 있는 금액에서 결과를 기다리는 취소도 뺌']],
      metrics: [
        { label: '시간 초과 응답', value: '504' },
        { label: '보정 뒤', value: 'PG와 같음', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      focus: ['sched'],
      flows: [
        { from: 'server', to: 'db', kind: 'write', label: 'REQUESTED 커밋', then: { db: { badge: 'REQUESTED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '5000원', then: { pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } } },
        { from: 'pg', to: 'server', kind: 'fail', label: '시간 초과', cut: true, slow: true },
        { from: 'server', to: 'db', kind: 'write', label: 'UNKNOWN', mono: true, then: { db: { badge: 'UNKNOWN', tone: 'warn' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true },
        { from: 'sched', to: 'db', kind: 'query', label: '대기 시간 지난 취소' },
        { from: 'sched', to: 'pg', kind: 'query', label: '주문번호로 조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: 'cancels DONE', mono: true },
        { from: 'sched', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: 'DONE', tone: 'ok', note: '남은 10000원', noteTone: 'muted' } } }
      ]
    },
    {
      short: 'PG 먼저', tag: '비교', title: '비교 C. PG를 먼저 부르고 답을 받은 뒤에 기록하면',
      src: '결정 4. 기록과 PG 호출을 어떤 순서로 할까',
      body: [
        '비교 C는 확인만 하고 아무것도 남기지 않은 채 PG를 부릅니다. 시간 초과로 끝난 취소는 **우리 쪽에 남은 것이 없어** 보정이 그 결제를 대상으로 고르지 않고, 남은 금액 15000원이 PG 잔액 10000원과 어긋났습니다.',
        '계약 24개 중 3개가 실패했고, 메시지는 모두 `[결제에 남은 취소] Expecting actual not to be empty`였습니다. 시간 초과 뒤 같은 키로 다시 온 테스트는 PG가 멱등키로 첫 응답을 돌려줘 통과했습니다.'
      ],
      note: '같은 취소 묶음에서 비교 C는 PG가 뜻한 만큼 14건을 취소했지만, 잔액이 다른 결제가 4건이었습니다.',
      metrics: [
        { label: '취소 계약', value: '24개 중 3개 실패', tone: 'bad' },
        { label: '잔액이 다른 결제', value: '4건', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: '남은 15000원', noteTone: 'muted' }, pg: { badge: 'DONE', tone: 'ok' } },
      focus: ['sched'],
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '5000원', then: { pg: { badge: '잔액 10000원', tone: 'info' } } },
        { from: 'pg', to: 'server', kind: 'fail', label: '시간 초과', cut: true, slow: true },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true },
        { from: 'sched', to: 'db', kind: 'query', label: '기다리는 취소 없음' },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'bad', note: '남은 15000원 ≠ PG 10000원', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: 'PG 멱등키', tag: '결정', title: '결정 5. 고객의 Idempotency-Key를 PG에도 넘긴다',
      src: '결정 5. PG에도 멱등키를 넘길까',
      body: [
        '이 장에서는 고객이 보낸 `Idempotency-Key`를 PG 취소 요청 헤더에도 그대로 넘기고, 결과를 남기지 못한 취소에 같은 키로 다시 오면 PG에 같은 키로 다시 보내 **PG의 첫 응답으로 닫기로** 했습니다.',
        'PG가 409 `IDEMPOTENT_REQUEST_PROCESSING`으로 답하면 취소를 그대로 두고 202로 답합니다. 202는 4장의 결과 모름 승인 재요청과 같은 뜻으로 씁니다.'
      ],
      note: '비용: 고객의 키가 그대로 PG로 나가고, 키 길이 상한을 PG(300자)와 맞춰야 합니다. 토스페이먼츠 멱등키의 15일 유효 기간은 Mock PG가 흉내 내지 않아 확인하지 못했습니다.',
      changed: [['+', 'PG 취소 헤더 `Idempotency-Key`'], ['+', '처리 중이면 202']],
      metrics: [
        { label: 'PG 취소', value: '한 번', tone: 'good' },
        { label: '재요청 답', value: '200', tone: 'good' }
      ],
      states: { db: { badge: 'UNKNOWN', tone: 'warn' }, pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '결과 기다리는 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '같은 Idempotency-Key', mono: false },
        { from: 'pg', to: 'server', kind: 'res', label: '첫 응답' },
        { from: 'server', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: 'DONE', tone: 'ok', note: '남은 10000원', noteTone: 'muted' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '키 안 넘김', tag: '비교', title: '비교 D. PG에 멱등키를 넘기지 않으면',
      src: '결정 5. PG에도 멱등키를 넘길까',
      body: [
        '비교 D는 멱등키 헤더를 붙이지 않는 PG 클라이언트만 바꿔 끼웠습니다. 시간 초과 뒤 같은 키로 다시 온 취소를 PG가 **새 취소로 받아 두 번 취소**했고(`expected: 1 but was: 2`), 우리는 10000원으로 답했지만 PG 잔액은 5000원이었습니다.',
        '계약 24개 중 2개가 실패했습니다. 두 번째 PG 취소는 우리 기록 어디에도 남지 않습니다.'
      ],
      note: '같은 취소 묶음에서 비교 D는 실제 취소 16건, 더 취소된 결제 2건, 잔액이 다른 결제 2건이었습니다.',
      metrics: [
        { label: '취소 계약', value: '24개 중 2개 실패', tone: 'bad' },
        { label: 'PG 잔액', value: '5000원', tone: 'bad' },
        { label: '우리 답', value: '10000원', tone: 'bad' }
      ],
      states: { db: { badge: 'UNKNOWN', tone: 'warn' }, pg: { badge: '잔액 10000원', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'pg', kind: 'req', label: '헤더 없이 5000원', then: { pg: { badge: '잔액 5000원', tone: 'bad', note: '한 번 더 취소', noteTone: 'bad', shake: true } } },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨' },
        { from: 'server', to: 'db', kind: 'write', label: 'DONE', mono: true, then: { db: { badge: 'DONE', tone: 'bad', note: '남은 10000원' } } },
        { from: 'server', to: 'client', kind: 'res', label: '남은 10000원' }
      ]
    },
    {
      short: '12건 측정', tag: '결과', title: '같은 취소 묶음 12건으로 잰 결과',
      src: '같은 취소 묶음으로 잰 결과',
      body: [
        '결제 12건(모두 15000원 승인, 부분 취소 5000원)을 여섯 경우에 2건씩 두고, 고객이 뜻한 PG 취소는 14건입니다. 운영 구현은 PG가 **14건을 취소**해 뜻한 수와 같았고, 잔액이 다른 결제는 0건이었습니다.',
        '전체 테스트는 4장의 373개에 5장 87개를 더해 **460개가 모두 통과**했습니다. 라인 커버리지는 99.3%(567줄 중 563줄)입니다.'
      ],
      note: '받은 요청 16건 가운데 2건은 시간 초과 뒤 같은 키로 다시 보내 PG가 첫 응답을 돌려준 요청입니다. 비교 구현은 `knownFailingTest`에서 164개 중 39개가 실패했습니다.',
      metrics: [
        { label: 'PG 실제 취소', value: '14건', tone: 'good' },
        { label: '잔액이 다른 결제', value: '0건', tone: 'good' },
        { label: '전체 테스트', value: '460개 통과', tone: 'good' },
        { label: '보정까지', value: '6726ms' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '12건 묶음' },
        { from: 'server', to: 'pg', kind: 'req', label: '요청 16건', then: { pg: { badge: '취소 14건', tone: 'ok' } } },
        [
          { from: 'sched', to: 'pg', kind: 'query', label: '보정 조회' },
          { from: 'sched', to: 'db', kind: 'query', label: '기다리는 취소' }
        ],
        { from: 'sched', to: 'db', kind: 'write', label: '어긋남 0건', then: { db: { badge: 'APPROVED 10 · 취소 2', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '같은 결제에 같은 금액의 결과 모름 취소가 여럿이면, 보정이 금액으로 짝을 지어 **어느 키가 `DONE`이 될지는 실제와 바뀔 수 있습니다.** 끝난 취소의 금액 합은 맞습니다. PG 취소 응답의 `cancels` 마지막 칸을 이번 취소로 읽는데, 순서를 보장한다는 문구는 찾지 못했습니다.',
        '같은 키의 취소나 같은 결제의 다른 취소가 동시에 들어오는 경우는 다루지 않았고, 7장 동시성 제어에서 다룹니다.'
      ],
      note: '결제 조회 API에 남은 금액이 없고 취소 목록 API도 없어서, 클라이언트는 취소 응답의 `balanceAmount`로만 남은 금액을 압니다.',
      metrics: [
        { label: '서버', value: '한 대 가정', tone: 'warn' },
        { label: '짝짓기', value: '금액 기준', tone: 'warn' }
      ],
      states: { db: { badge: 'UNKNOWN 2개', tone: 'warn', note: '같은 5000원', noteTone: 'muted' }, pg: { badge: 'PARTIAL_CANCELED', tone: 'info' } },
      focus: ['sched'],
      flows: [
        { from: 'sched', to: 'pg', kind: 'query', label: '주문번호로 조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: '5000원 취소' },
        { from: 'sched', to: 'db', kind: 'write', label: '금액으로 짝짓기', then: { db: { badge: '어느 키가 DONE?', tone: 'warn', note: '금액 합은 맞음', noteTone: 'muted' } } }
      ]
    }
  ]
};
