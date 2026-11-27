// 3장 결제 금액 검증과 멱등성 — content/payment-amount-idempotency/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[3] = {
  slug: 'payment-amount-idempotency',
  branch: 'chapter-03',
  title: '결제 금액 검증과 멱등성',
  goal: '승인 요청 금액을 저장한 금액과 비교하고, 같은 요청이 다시 오면 PG를 다시 부르지 않고 기록된 결과로 답합니다.',
  learn: [
    { text: '받은 금액을 그대로 보내면 생기는 일', step: 1 },
    { text: '저장한 금액과 비교하고 PG에는 저장한 금액 보내기', step: 4 },
    { text: '`BigDecimal`의 `equals`와 `compareTo`', step: 6 },
    { text: '금액이 다를 때 상태를 바꾸지 않는 이유', step: 7 },
    { text: '`paymentKey`로 같은 승인 요청 가리기', step: 8 },
    { text: '같은 주문번호로 다시 온 준비 요청', step: 10 },
    { text: '0원 준비를 `Payment.create`에서 막기', step: 11 },
    { text: '테스트 결과와 남은 한계', step: 12 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '준비·승인 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'confirm()', subMono: true, x: 360, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '받은 금액 승인', x: 700, y: 130 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제 상태', x: 700, y: 460 }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '받은 금액을 그대로 PG에 보낸다',
      src: '현재 구조: 받은 금액을 그대로 보내는 승인 API',
      body: [
        '결제창에서 인증을 마친 고객이 돌아올 때 `paymentKey`, `orderId`, `amount`를 함께 받습니다. 3장 출발 코드는 승인 요청에 금액을 더하고, **받은 금액을 그대로 PG에 보내도록** 바꿨습니다.',
        '결제 준비(`POST /api/v1/payments`)는 2장과 같습니다. 주문번호와 금액을 받아 `READY` 결제를 저장하고, 금액은 검사하지 않습니다.'
      ],
      note: 'Mock PG는 받은 금액을 그대로 승인하고, 승인한 금액을 주문별로 기록해 테스트에서 볼 수 있게 했습니다.',
      metrics: [
        { label: '준비 금액', value: '15000' },
        { label: '3장 테스트', value: '23개 중 10개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: 'paymentKey · amount', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '받은 금액으로 승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '금액 조작', tag: '문제', title: '15000원 결제가 100원으로 승인된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '15000원으로 준비한 결제에 100원으로 승인을 요청하자, 결제는 `APPROVED`가 되었고 Mock PG에는 **100원 승인**이 남았습니다(`Expecting empty but was: [100]`).',
        '금액 없이 승인을 요청한 API 테스트도 200으로 승인되었습니다. 우리 기록으로는 15000원 결제가 승인된 것처럼 보이지만, 실제로 카드사에 승인된 금액은 100원이거나 비어 있습니다.'
      ],
      metrics: [
        { label: '준비 금액', value: '15000' },
        { label: 'PG 승인 금액', value: '100', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '100원으로 승인' },
        { from: 'server', to: 'pg', kind: 'req', label: '100원 승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '100원 승인', tone: 'bad' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'bad', note: '15000원 결제로 기록', shake: true } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '재요청 409', tag: '문제', title: '같은 승인 요청을 다시 보내면 409로 끝난다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '첫 요청에서 이미 `APPROVED`가 된 결제에 인증 전이를 다시 시도하므로, 상태 머신이 `Cannot AUTHENTICATE a payment in APPROVED status.`로 거부하고 API는 **409**로 답했습니다.',
        '첫 응답을 받지 못해 다시 보낸 클라이언트는 이 409만 보고는 결제가 승인됐는지 알 수 없습니다. 거절된 결제도 같은 이유로 거절 결과 대신 409를 받았습니다.'
      ],
      note: '"카드사에는 한 번만 승인을 요청한다"는 출발 코드에서도 통과했습니다. PG를 부르기 전에 상태 전이에서 막혔기 때문입니다. PG를 두 번 부르지 않는 것과 같은 결과로 답하는 것은 다른 규칙입니다.',
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: '승인 1번', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 요청 다시' },
        { from: 'server', to: 'db', kind: 'query', label: 'authenticate()', mono: true },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'bad', note: '인증 전이 거부', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '409', mono: true }
      ]
    },
    {
      short: '준비 500', tag: '문제', title: '같은 주문번호로 다시 준비하면 500',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '같은 주문번호로 다시 준비하면 `order_id`의 고유 키에 걸려 저장이 실패하고, 이 오류를 처리하는 곳이 없어서 **500**이 됩니다. 금액이 같든 다르든 똑같습니다.',
        '3장 테스트 23개 중 **10개가 실패**했습니다. 계약 7개 중 4개, 결제 API 16개 중 6개입니다. 출발 코드 전체로는 253개 중 10개가 실패했습니다.'
      ],
      note: '실패 10개는 금액을 바꾼 승인 4개, 같은 승인 요청 다시 보내기 3개, 같은 주문번호로 다시 준비 2개, 0원 준비 1개입니다.',
      metrics: [
        { label: '3장 테스트', value: '23개 중 10개 실패', tone: 'bad' },
        { label: '승인 요청 확인 계약', value: '7개 중 4개 실패', tone: 'bad' },
        { label: '결제 API', value: '16개 중 6개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 주문번호로 준비' },
        { from: 'server', to: 'db', kind: 'fail', label: 'order_id 고유 키', mono: true, cut: true },
        { at: 'db', then: { db: { badge: 'READY', tone: 'info', note: '저장 실패', noteTone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '500', mono: true }
      ]
    },
    {
      short: '금액 비교', tag: '결정', title: '결정 1. 저장한 금액과 비교하고, 다르면 PG를 부르지 않는다',
      src: '결정 1. 승인 금액을 어디서 확인할까',
      body: [
        '이 장에서는 승인 요청으로 받은 금액을 저장한 금액과 비교하고, 다르면 PG를 부르지 않고 거부하기로 했습니다. 인증된 금액이 준비한 금액과 다르다는 사실을 우리 서버가 알 수 있는 곳은 돌아온 요청의 `amount`뿐입니다.',
        '비교를 통과하면 PG에는 요청 금액이 아니라 **저장한 금액**을 보냅니다. 두 값은 같은 금액이지만, 소수 자릿수까지 같다는 보장은 없기 때문입니다.'
      ],
      note: '비용: 요청 항목이 하나 늘고, 금액이 없는 요청이나 다른 요청에 어떻게 답할지 정해야 합니다(결정 3).',
      changed: [['+', '승인 요청의 `amount`를 저장한 금액과 비교'], ['~', 'PG에는 저장한 금액을 보냄']],
      metrics: [
        { label: 'PG 호출', value: '0건', tone: 'good' },
        { label: '결제 상태', value: 'READY', tone: 'good' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '100원으로 승인' },
        { from: 'server', to: 'db', kind: 'query', label: '저장한 15000.00' },
        { at: 'server', then: { server: { badge: '금액 다름', tone: 'bad' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '400 AMOUNT_MISMATCH', mono: true },
        { at: 'pg', then: { pg: { badge: '호출 0건', tone: 'muted' } } }
      ]
    },
    {
      short: '값만 비교', tag: '결정', title: '결정 2. 금액은 값만 비교하는 compareTo로',
      src: '결정 2. 금액을 어떻게 비교할까',
      body: [
        '이 장에서는 금액을 값만 비교하는 `compareTo`로 비교하기로 했습니다. DB 컬럼이 `decimal(19, 2)`라서 다시 읽으면 `15000.00`이 되고, 요청 JSON의 금액은 `15000`입니다.',
        '`compareTo`로 비교하면 0이라 금액 확인을 통과하고, 저장한 금액으로 PG에 승인을 요청합니다.'
      ],
      note: '비용: 거의 없습니다. `compareTo(...) != 0`이 한눈에 덜 읽혀서 `Payment` 안의 `isDifferentAmount`로 감쌌습니다.',
      changed: [['+', '`isDifferentAmount`']],
      metrics: [
        { label: 'DB 금액', value: '15000.00' },
        { label: '요청 금액', value: '15000' },
        { label: 'compareTo', value: '같음', tone: 'good' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '15000으로 승인' },
        { from: 'server', to: 'db', kind: 'query', label: '15000.00' },
        { at: 'server', then: { server: { badge: 'compareTo = 0', tone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '저장한 금액으로 승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } }
      ]
    },
    {
      short: 'equals', tag: '비교', title: '비교 B. equals로 비교하면 정상 승인까지 거부한다',
      src: '결정 2. 금액을 어떻게 비교할까',
      body: [
        '`equals`는 수치와 소수 자릿수가 모두 같아야 같다고 봅니다. 그래서 DB에서 읽은 `15000.00`과 요청의 `15000`을 다른 금액으로 보고 `AMOUNT_MISMATCH`로 거부합니다.',
        '`equals`로 비교한 비교 B는 **계약 7개 중 5개가 실패**했습니다. 실패하지 않은 2개는 금액이 다를 때 거부하는 테스트로, 모든 요청을 거부하니 통과한 것입니다.'
      ],
      metrics: [
        { label: '승인 요청 확인 계약', value: '7개 중 5개 실패', tone: 'bad' },
        { label: 'PG 호출', value: '0건', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '15000으로 승인' },
        { from: 'server', to: 'db', kind: 'query', label: '15000.00' },
        { at: 'server', then: { server: { badge: 'equals = false', tone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '400 AMOUNT_MISMATCH', mono: true }
      ]
    },
    {
      short: '상태 유지', tag: '결정', title: '결정 3. 금액이 다르면 상태를 바꾸지 않고 400으로 거부한다',
      src: '결정 3. 금액이 다를 때 결제 상태를 바꿀까',
      body: [
        '이 장에서는 금액이 다르면 결제 상태를 바꾸지 않고 400으로 거부하기로 했습니다. PG에 승인을 요청하지 않았으니 정리할 것이 없고, 클라이언트 버그로 잘못된 금액이 올 수도 있어 **같은 결제로 다시 시도**할 수 있게 둡니다.',
        '응답은 400과 `AMOUNT_MISMATCH`입니다. 금액이 아예 없으면 `INVALID_AMOUNT`로 구분하고, 0원이나 음수는 준비한 금액과 다르므로 `AMOUNT_MISMATCH`입니다.'
      ],
      note: '비용: 조작 시도가 DB에 남지 않고 로그에만 남습니다. 인증 실패(`AUTH_FAILED`)로 닫는 쪽은 구현하지 않았습니다.',
      changed: [['+', '`AMOUNT_MISMATCH`, `INVALID_AMOUNT`']],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '100원으로 승인' },
        { from: 'server', to: 'client', kind: 'fail', label: '400 AMOUNT_MISMATCH', mono: true, then: { db: { badge: 'READY', tone: 'info', note: '상태 그대로' } } },
        { from: 'client', to: 'server', kind: 'req', label: '올바른 금액으로 다시' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '' } } }
      ]
    },
    {
      short: '결제 키', tag: '결정', title: '결정 4. paymentKey를 저장해 같은 요청에는 기록된 결과로 답한다',
      src: '결정 4. 같은 승인 요청이 다시 오면 어떻게 답할까',
      body: [
        '이 장에서는 결제에 `paymentKey`를 저장해, 같은 키로 다시 온 요청에는 PG를 다시 부르지 않고 기록된 결과로 답하기로 했습니다. 응답에 담기는 주문번호, 금액, 상태는 결제 한 행에서 언제든 다시 만들 수 있습니다.',
        '같은 키가 `APPROVED` 결제에 오면 승인으로, `APPROVAL_FAILED` 결제에 오면 거절로 답합니다. 다른 키로 오면 상태 전이를 시도해 **409**로 거부됩니다.'
      ],
      note: '비용: `payment_key` 컬럼이 생기고 인증 메서드가 `authenticate(paymentKey)`로 바뀌어 1·2장 테스트 호출부도 고쳤습니다. 응답을 지금 상태로 다시 만들어, 첫 응답 뒤 매입이나 취소가 있었다면 지금 상태를 받습니다.',
      changed: [['+', '`payment_key` 컬럼'], ['+', '`isConfirmedWith`'], ['~', '`authenticate(paymentKey)`']],
      metrics: [
        { label: 'PG 호출', value: '첫 요청 한 번', tone: 'good' },
        { label: '같은 키', value: '200', tone: 'good' },
        { label: '다른 키', value: '409' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok', note: 'payment_key 저장', noteTone: 'muted' }, pg: { badge: '승인 1번', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '키·상태 확인' },
        { from: 'server', to: 'client', kind: 'res', label: '200 승인' },
        { from: 'client', to: 'server', kind: 'req', label: '다른 키로' },
        { from: 'server', to: 'client', kind: 'fail', label: '409', mono: true }
      ]
    },
    {
      short: '상태만', tag: '비교', title: '비교 D. 결제 키 없이 상태만으로 가리면',
      src: '결정 4. 같은 승인 요청이 다시 오면 어떻게 답할까',
      body: [
        '비교 D는 결제가 `APPROVED`나 `APPROVAL_FAILED`이면 누가 보냈든 그 결과로 답합니다. 재시도 테스트는 모두 통과했지만 **다른 결제 키로 온 요청까지 승인으로** 답해 계약 7개 중 1개가 실패했습니다.',
        '그 요청을 보낸 쪽은 자기 결제창의 결제가 승인됐다고 받아들이지만, PG에는 그 결제 키로 승인된 것이 없습니다. 다시 온 요청을 가리지 않는 비교 C는 같은 요청에도 409로 답해 2개가 실패했습니다.'
      ],
      note: '세 방식 모두 다시 온 요청에서는 PG를 부르지 않아 PG 호출은 첫 요청의 한 번뿐입니다. 갈리는 것은 응답입니다.',
      metrics: [
        { label: '비교 D', value: '7개 중 1개 실패', tone: 'bad' },
        { label: '비교 C', value: '7개 중 2개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: '승인 1번', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '다른 키로' },
        { from: 'server', to: 'db', kind: 'query', label: '상태만 확인' },
        { from: 'server', to: 'client', kind: 'res', label: '200 승인', then: { pg: { badge: '그 키로는 승인 없음', tone: 'bad', shake: true } } }
      ]
    },
    {
      short: '준비 재요청', tag: '결정', title: '결정 5. 같은 주문번호·같은 금액이면 있는 결제를 돌려준다',
      src: '결정 5. 같은 주문번호로 다시 준비하면 어떻게 할까',
      body: [
        '이 장에서는 같은 주문번호가 같은 금액으로 다시 오면 이미 있는 결제를 지금 상태로 돌려주고, 금액이 다르면 409로 거부하기로 했습니다. 준비를 재시도한 클라이언트는 처음 요청이 저장됐는지와 상관없이 **201**을 받습니다.',
        '금액이 다르면 같은 주문번호로 다른 주문을 만들려는 것이라 409와 `DUPLICATE_ORDER`로 답합니다. 금액이 없거나 0 이하이면 400과 `INVALID_AMOUNT`입니다.'
      ],
      note: '비용: 실수로 두 번 보낸 준비도 성공으로 처리됩니다. 준비 요청 두 개가 동시에 들어오면 여전히 500이 될 수 있고, 7장에서 다룹니다.',
      changed: [['+', '`DUPLICATE_ORDER`'], ['~', '주문번호로 먼저 찾고 있으면 금액 확인']],
      states: { db: { badge: 'READY', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 주문 · 같은 금액' },
        { from: 'server', to: 'db', kind: 'query', label: '주문번호로 찾기' },
        { from: 'server', to: 'client', kind: 'res', label: '201 READY', mono: true },
        { from: 'client', to: 'server', kind: 'req', label: '같은 주문 · 다른 금액' },
        { from: 'server', to: 'db', kind: 'query', label: '주문번호로 찾기' },
        { from: 'server', to: 'client', kind: 'fail', label: '409 DUPLICATE_ORDER', mono: true }
      ]
    },
    {
      short: '0원 준비', tag: '결정', title: '결정 6. 0 이하 금액은 Payment.create에서 막는다',
      src: '결정 6. 금액이 0 이하인 준비를 어디서 막을까',
      body: [
        '이 장에서는 금액이 0 이하인 준비를 `Payment.create`에서 막기로 했습니다. 1장에서 상태 전이 규칙을 `Payment` 안에 둔 것과 같은 이유로, API가 아닌 경로로 결제를 만들어도 같은 규칙이 적용됩니다.',
        '출발 코드에서는 0원 준비가 **201**로 저장됐습니다. 이제는 저장하기 전에 막혀 400과 `INVALID_AMOUNT`로 답합니다.'
      ],
      note: '비용: Bean Validation처럼 필드 오류를 모아 알리지 못하고 첫 오류 하나만 알립니다. 요청 DTO의 `@Positive`와 `@Valid`는 구현하지 않았습니다.',
      changed: [['+', '`Payment.create` 금액 검사']],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '0원 준비' },
        { at: 'server', then: { server: { badge: 'Payment.create', tone: 'bad', note: '양수만 존재' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '400 INVALID_AMOUNT', mono: true },
        { at: 'db', then: { db: { badge: '저장 안 함', tone: 'muted' } } }
      ]
    },
    {
      short: '테스트 결과', tag: '결과', title: '270개 통과, 비교 구현 4개의 실패',
      src: '테스트 결과',
      body: [
        '출발 코드에서 실패하던 10개가 모두 통과했고, 전체 270개(2장까지 241개 + 3장 29개)가 통과했습니다. 라인 커버리지는 **99.5%**(214줄 중 213줄)입니다.',
        '비교 구현 4개를 같은 계약 7개로 돌리자 비교 A 2개, B 5개, C 2개, D 1개가 실패했습니다. `knownFailingTest` 전체는 41개 중 16개 실패입니다.'
      ],
      note: '이번 장에는 처리량·지연·경합에 대한 주장이 없어서 k6는 돌리지 않았습니다.',
      metrics: [
        { label: '전체 테스트', value: '270개 통과', tone: 'good' },
        { label: '라인 커버리지', value: '99.5%', tone: 'good' },
        { label: '비교 구현', value: '41개 중 16개 실패' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: '승인 1번', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '100원으로 승인' },
        { from: 'server', to: 'client', kind: 'fail', label: '400', mono: true },
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'client', kind: 'res', label: '200 승인' }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '같은 결제 키로 다시 왔는데 결제가 `AUTHENTICATED`이면 여전히 409입니다. PG 답을 기다리는 중인지, 결과를 모르는지, 502로 끝났는지 구분하지 못하고, 4장에서 다룹니다.',
        '같은 요청이 동시에 들어오는 경우는 확인하지 않았습니다(7장). 다시 온 요청에 지금 상태로 답하는 방식은 부분 취소에 쓸 수 없어서, 5장에서 `Idempotency-Key`를 다룹니다.'
      ],
      note: '금액 조작 시도는 로그에만 남고 결제 기록에는 남지 않습니다.',
      metrics: [
        { label: 'AUTHENTICATED 재요청', value: '409', tone: 'warn' },
        { label: '동시 요청', value: '7장', tone: 'warn' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'warn' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'client', to: 'server', kind: 'req', label: '같은 키로 다시' },
        { from: 'server', to: 'client', kind: 'fail', label: '409', mono: true },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'warn', note: '결과가 아직 없음', noteTone: 'warn' } } }
      ]
    }
  ]
};
