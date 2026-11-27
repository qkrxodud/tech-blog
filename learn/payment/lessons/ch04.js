// 4장 PG 응답을 받지 못한 결제와 보정 — content/payment-approval-unknown/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[4] = {
  slug: 'payment-approval-unknown',
  branch: 'chapter-04',
  title: 'PG 응답을 받지 못한 결제와 보정',
  goal: 'PG 답을 받지 못한 결제를 결과 모름으로 표시하고, 대기 시간 뒤 PG에 조회해 맞춥니다.',
  learn: [
    { text: '시간 초과·기록 실패가 PG와 어긋나는 이유', step: 2 },
    { text: '결과 모름 상태 `APPROVAL_UNKNOWN`', step: 4 },
    { text: '조회 보정과 망취소의 차이', step: 6 },
    { text: '바로 조회하면 안 되는 이유와 대기 시간', step: 8 },
    { text: '기록 실패 결제도 보정 대상에 넣기', step: 9 },
    { text: '결과 모름 동안의 202 응답', step: 10 },
    { text: '같은 12건으로 잰 결과와 남은 한계', step: 12 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'confirm()', subMono: true, x: 345, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '카드사 승인', x: 640, y: 120 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제 상태', x: 640, y: 462 },
    { id: 'sched', kind: 'scheduler', label: '주기 보정', sub: '@Scheduled', subMono: true, x: 905, y: 300, absent: '4장에서 만듦' }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db'], ['sched', 'pg'], ['sched', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '인증을 기록하고 PG에 승인을 요청한다',
      src: '현재 구조: 결과를 모르는 결제를 인증 상태로 두는 승인 API',
      body: [
        '4장 출발 코드의 승인 서비스는 3장 완성 코드와 같습니다. 인증을 기록한 뒤 PG에 승인을 요청하고, 답을 받으면 결과를 기록합니다.',
        'PG 클라이언트의 시간 제한은 2장에서 정한 **연결 1초, 읽기 5초**입니다.'
      ],
      hide: ['sched'],
      metrics: [
        { label: '읽기 시간 제한', value: '5초' },
        { label: '4장 테스트', value: '320개 중 51개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: 'DONE', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '시간 초과', tag: '문제', title: 'PG 답이 늦으면 결제는 인증 상태에 머문다',
      src: '현재 구조: 결과를 모르는 결제를 인증 상태로 두는 승인 API',
      body: [
        'PG 답이 읽기 시간 제한 안에 오지 않으면 `PaymentGatewayNoResponseException`이 올라가 **504와 `PAYMENT_GATEWAY_NO_RESPONSE`**로 답합니다.',
        '결제는 인증 기록 트랜잭션이 남긴 `AUTHENTICATED`에 머뭅니다. 그런데 PG는 늦게라도 승인을 마칠 수 있습니다.'
      ],
      note: '계약 테스트는 읽기 시간 제한을 1초로 줄이고 Mock PG가 1.5초 뒤에 답하게 해서 이 상황을 만듭니다.',
      hide: ['sched'],
      metrics: [
        { label: '읽기 시간 제한(시험)', value: '1초' },
        { label: 'Mock PG 응답', value: '1.5초 뒤', tone: 'warn' },
        { label: '결제 ↔ PG', value: '어긋남', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 안에 답 없음', cut: true, slow: true },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true },
        { at: 'pg', then: { pg: { badge: 'DONE', tone: 'ok', note: '0.5초 뒤 승인을 마침', noteTone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'bad', note: 'PG는 승인, 우리는 인증', shake: true } } }
      ]
    },
    {
      short: '기록 실패', tag: '문제', title: 'PG가 승인했는데 결과 기록이 실패한다',
      src: '현재 구조: 결과를 모르는 결제를 인증 상태로 두는 승인 API',
      body: [
        '2장에서 확인한 것처럼, PG 승인 뒤 결과 기록이 실패해도 결제는 `AUTHENTICATED`로 남습니다.',
        'PG가 승인도 거절도 아닌 서버 오류로 답하면 **502**로 답하고, 이때도 결제는 `AUTHENTICATED`입니다.'
      ],
      note: '기록 실패는 2장과 같이 승인 상태로 바꾸는 저장을 MySQL 트리거로 막아서 만듭니다.',
      hide: ['sched'],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: 'DONE', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'fail', label: 'APPROVED 저장', mono: false, cut: true },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'bad', note: '트리거가 저장을 막음', shake: true } } }
      ]
    },
    {
      short: '재요청 409', tag: '문제', title: '다시 보내면 409, 이유를 구분하지 못한다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '같은 결제 키로 다시 왔는데 결제가 `AUTHENTICATED`이면 409로 답합니다. 앞 요청이 PG 답을 기다리는 중인지, 시간 제한으로 결과를 모르는지, 502로 끝났는지 구분하지 못합니다.',
        '출발 코드에서 4장 테스트 320개 중 **51개가 실패**했습니다. 보정 계약 9개 중 6개가 실패했고, 대표적으로 PG는 `DONE`인데 결제는 `AUTHENTICATED`였습니다.'
      ],
      hide: ['sched'],
      metrics: [
        { label: '4장 테스트', value: '320개 중 51개 실패', tone: 'bad' },
        { label: '보정 계약', value: '9개 중 6개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'bad' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 결제 키로 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '상태 확인' },
        { from: 'server', to: 'client', kind: 'fail', label: '409', mono: true }
      ]
    },
    {
      short: '결과 모름', tag: '결정', title: '결정 1. 결과 모름 상태를 새로 둔다',
      src: '결정 1. 결과를 모르는 결제를 어떻게 표시할까',
      body: [
        '이 장에서는 PG 답을 받지 못한 결제를 새 상태 `APPROVAL_UNKNOWN`(결과 모름)으로 남기기로 했습니다.',
        '`AUTHENTICATED`만으로는 재요청에도 보정에도 결과 모름 결제를 가려낼 수 없었기 때문입니다. 결과 모름은 승인이 남았을 수 있으므로 **PG에 확인한 결과로만** 승인이나 승인 실패로 닫고, 만료나 매입으로는 닫지 않습니다.'
      ],
      note: '비용: 전이 조합 테스트가 상태 9개 × 행위 7개에서 10개 × 8개로 커졌고, State 패턴과 Spring Statemachine 비교 구현에도 같은 전이를 넣어야 했습니다. 승인 시도마다 행을 남기는 별도 테이블은 구현하지 않았습니다.',
      changed: [['+', '상태 `APPROVAL_UNKNOWN`, 행위 `MARK_APPROVAL_UNKNOWN`'], ['~', '전이 조합 9 × 7 → 10 × 8'], ['~', '5xx·기록 실패 결제는 여전히 `AUTHENTICATED`']],
      hide: ['sched'],
      metrics: [
        { label: '전이 조합', value: '10 × 8' },
        { label: '결제 상태', value: 'APPROVAL_UNKNOWN', tone: 'warn' }
      ],
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '시간 초과', cut: true },
        { from: 'server', to: 'db', kind: 'write', label: 'MARK_APPROVAL_UNKNOWN', mono: true, then: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true }
      ]
    },
    {
      short: '조회 보정', tag: '결정', title: '결정 2. PG에 주문번호로 조회해 맞춘다',
      src: '결정 2. 결과를 모르는 결제를 어떻게 맞출까',
      body: [
        '결과 모름 결제를 PG에 **주문번호로 조회**해, 조회 결과대로 승인이나 승인 실패로 닫기로 했습니다. 주문번호는 결제 서버가 만들어 준비 때부터 결제 행에 늘 있는 키입니다.',
        '응답은 세 가지로 읽습니다. `DONE`·`PARTIAL_CANCELED`는 승인이 남음, `ABORTED`·`CANCELED`·`EXPIRED`와 404 `NOT_FOUND_PAYMENT`는 승인이 없음, `READY`·`IN_PROGRESS` 같은 값은 아직 정할 수 없어 그대로 둡니다.'
      ],
      note: '404는 본문 코드가 `NOT_FOUND_PAYMENT`일 때만 "승인 없음"으로 읽습니다. 주소를 잘못 부른 404를 승인 없음으로 읽으면 승인된 결제를 실패로 닫게 됩니다.',
      changed: [['+', '`GET /v1/payments/orders/{orderId}` 조회 보정'], ['+', '응답 읽기 `PgPaymentStatus` 테스트 9개']],
      metrics: [
        { label: '보정 계약', value: '9개 통과', tone: 'good' },
        { label: '결제 ↔ PG', value: '맞음', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' }, pg: { badge: 'DONE', tone: 'ok' } },
      focus: ['sched'],
      flows: [
        { from: 'sched', to: 'db', kind: 'query', label: '결과 모름 결제 고르기' },
        { from: 'sched', to: 'pg', kind: 'query', label: '주문번호로 조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: 'DONE', mono: true },
        { from: 'sched', to: 'db', kind: 'write', label: 'APPROVE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } }
      ]
    },
    {
      short: '망취소', tag: '비교', title: '비교 A. 묻지 않고 취소를 보내는 망취소',
      src: '결정 2. 결과를 모르는 결제를 어떻게 맞출까',
      body: [
        '망취소는 결과를 묻지 않고 PG에 취소를 보낸 뒤 승인 실패로 닫습니다. 망취소도 **보정 계약 9개를 모두 통과**했습니다. 계약은 PG 취소와 우리 쪽 승인 실패를 짝이 맞는 것으로 보기 때문입니다.',
        '차이는 같은 결제 묶음에서 드러났습니다. PG가 승인한 6건을 조회 보정은 모두 `APPROVED`로 남겼고, 망취소는 6건 모두 취소해 **승인으로 남은 결제가 0건**이었습니다.'
      ],
      note: 'PG에 조회 API가 없거나 조회 답을 믿기 어려운 연동이라면 망취소가 맞습니다.',
      metrics: [
        { label: '보정 계약', value: '9개 통과', tone: 'good' },
        { label: '매출로 남는 결제', value: '6건 중 0건', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' }, pg: { badge: 'DONE', tone: 'ok' } },
      focus: ['sched'],
      flows: [
        { from: 'sched', to: 'pg', kind: 'req', label: '결제 키로 취소', then: { pg: { badge: 'CANCELED', tone: 'bad' } } },
        { from: 'pg', to: 'sched', kind: 'res', label: '취소됨' },
        { from: 'sched', to: 'db', kind: 'write', label: 'FAIL_APPROVAL', mono: true, then: { db: { badge: 'APPROVAL_FAILED', tone: 'bad', note: 'PG에서 끝난 승인을 되돌림' } } }
      ]
    },
    {
      short: '바로 조회', tag: '비교', title: '비교 C. 시간 초과 직후 바로 조회하면',
      src: '결정 3. 언제 맞출까',
      body: [
        'Mock PG가 1.5초 뒤 승인하는 결제를 1초 시간 초과 직후에 조회하면, PG에는 아직 기록이 없어 404 `NOT_FOUND_PAYMENT`를 받고 승인 실패로 닫습니다.',
        '그 뒤 0.5초 만에 PG에는 승인이 남습니다. 바로 조회하는 비교 C는 **계약 9개 중 4개가 실패**했습니다.'
      ],
      note: 'PG가 처리를 마치기 전에 조회하면 "기록 없음"을 "승인 없음"과 구분할 수 없습니다.',
      hide: ['sched'],
      metrics: [
        { label: '보정 계약', value: '9개 중 4개 실패', tone: 'bad' },
        { label: '결제 ↔ PG', value: '어긋남', tone: 'bad' }
      ],
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 시간 초과', cut: true },
        { from: 'server', to: 'pg', kind: 'query', label: '바로 조회' },
        { from: 'pg', to: 'server', kind: 'res', label: '404 NOT_FOUND_PAYMENT', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVAL_FAILED', mono: true, then: { db: { badge: 'APPROVAL_FAILED', tone: 'bad' } } },
        { at: 'pg', then: { pg: { badge: 'DONE', tone: 'ok', note: '0.5초 뒤 승인이 남음', noteTone: 'bad' }, db: { badge: 'APPROVAL_FAILED', tone: 'bad', note: 'PG는 승인, 우리는 실패', shake: true } } }
      ]
    },
    {
      short: '대기 시간', tag: '결정', title: '결정 3. 대기 시간이 지난 결제만 주기 보정에서 조회한다',
      src: '결정 3. 언제 맞출까',
      body: [
        '승인을 요청한 지 `wait-after-request`가 지난 결제만, 따로 도는 주기 보정에서 조회하기로 했습니다. 대기 시간을 재려고 결제에 `authenticated_at` 컬럼을 더했습니다.',
        '보정은 오래된 것부터 **100건씩** 고르고, 앞 보정이 끝난 뒤 `interval`만큼 쉬고 다시 돕니다(`fixedDelayString`). 기본값은 둘 다 1분입니다.'
      ],
      note: '비용: 결과 모름이 확정되기까지 기본값이면 1분에서 2분 사이가 걸리고, 그동안 고객은 "확인 중"을 봅니다. PG가 첫 보정의 조회에만 늦게 답하게 하자 확정까지 보정 2번, 16322ms가 걸렸습니다.',
      changed: [['+', '`authenticated_at` 컬럼'], ['+', '`wait-after-request` 1분, `interval` 1분'], ['+', '한 번에 100건, 오래된 것부터']],
      metrics: [
        { label: '대기 시간', value: '1분' },
        { label: '보정 주기', value: '1분' },
        { label: '확정까지', value: '1~2분', tone: 'warn' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn', note: '인증 뒤 1분이 지남', noteTone: 'muted' }, pg: { badge: 'DONE', tone: 'ok', note: '처리를 마친 뒤', noteTone: 'muted' } },
      focus: ['sched'],
      flows: [
        { from: 'sched', to: 'db', kind: 'query', label: '인증한 지 1분 지난 것 100건' },
        { from: 'sched', to: 'pg', kind: 'query', label: '조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: 'DONE', mono: true },
        { from: 'sched', to: 'db', kind: 'write', label: 'APPROVE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '' } } }
      ]
    },
    {
      short: '기록 실패 맞춤', tag: '결정', title: '결정 4. 인증 상태에 남은 결제도 보정 대상에 넣는다',
      src: '결정 4. 결과 기록에 실패한 결제는 어떻게 할까',
      body: [
        '기록을 막는 DB 실패가 일어난 순간에는 결과 모름조차 기록할 수 없습니다. 그래서 대기 시간이 지난 `AUTHENTICATED` 결제도 결과 모름과 같은 보정 대상에 넣기로 했습니다.',
        '요청 안에서 0.1초씩 쉬며 세 번까지 기록해 보는 비교 D는 **계약 9개 중 1개**, 기록 실패 테스트가 실패했습니다. 재시도가 모두 실패한 결제가 보정 대상이 아니라서 그대로 남았습니다.'
      ],
      note: '이 대상에는 PG가 5xx로 답해 502로 끝난 결제도 들어갑니다. Mock PG에 기록이 없어 조회가 404를 받고 `APPROVAL_FAILED`로 닫혔습니다.',
      changed: [['~', '보정 대상 `TARGETS` = `APPROVAL_UNKNOWN`, `AUTHENTICATED`']],
      metrics: [
        { label: '보정 대상', value: '결과 모름 + 인증' },
        { label: '비교 D 어긋남', value: '12건 중 2건', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '기록 실패로 남은 결제', noteTone: 'muted' }, pg: { badge: 'DONE', tone: 'ok' } },
      focus: ['sched'],
      flows: [
        { from: 'sched', to: 'db', kind: 'query', label: '오래된 AUTHENTICATED도', mono: false },
        { from: 'sched', to: 'pg', kind: 'query', label: '조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: 'DONE', mono: true },
        { from: 'sched', to: 'db', kind: 'write', label: 'APPROVE', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '' } } }
      ]
    },
    {
      short: '202 응답', tag: '결정', title: '결정 5. 결과 모름 결제의 재요청에는 202로 답한다',
      src: '결정 5. 결과를 모르는 동안 어떻게 답할까',
      body: [
        '첫 요청의 시간 초과는 지금처럼 **504**로 답합니다. 그 요청은 실제로 PG 답을 받지 못했고, 오류 응답 모양을 2장부터 전역 예외 처리기 한 곳에서 정해 왔기 때문입니다.',
        '결과 모름 결제에 같은 결제 키로 다시 온 요청에는 PG를 부르지 않고 **202와 `APPROVAL_UNKNOWN`**으로 답합니다. 클라이언트는 결제 조회 API로 상태가 바뀌었는지 다시 확인합니다.'
      ],
      note: '비용: 202 응답에는 언제 다시 확인하라는 정보를 담지 않았습니다. 결제가 `AUTHENTICATED`이면 재요청은 여전히 409입니다.',
      changed: [['+', '재요청 202 + `APPROVAL_UNKNOWN`'], ['~', '첫 시간 초과는 504 그대로']],
      metrics: [
        { label: '첫 응답', value: '504' },
        { label: '재요청', value: '202', tone: 'warn' },
        { label: 'PG 재호출', value: '없음', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '같은 결제 키로 다시' },
        { from: 'server', to: 'db', kind: 'query', label: '상태 확인' },
        { from: 'server', to: 'client', kind: 'res', label: '202 APPROVAL_UNKNOWN', mono: true },
        { from: 'client', to: 'server', kind: 'query', label: '결제 조회 GET' },
        { from: 'server', to: 'client', kind: 'res', label: '지금 상태' }
      ]
    },
    {
      short: '12건 측정', tag: '결과', title: '같은 결제 12건으로 잰 결과',
      src: '같은 결제 묶음으로 잰 결과',
      body: [
        '늦은 승인 4건, 늦은 거절 3건, 닿지 않은 요청 3건, 기록 실패 2건으로 이루어진 같은 12건을 구현마다 보정했습니다.',
        '조회 보정과 망취소 모두 **PG와 어긋난 결제 0건, 보정 1번**에 끝났습니다. 매출로 남는 결제는 조회 보정 6건, 망취소 0건이었습니다. 비교 B(아무것도 안 함)는 12건, 비교 C는 6건, 비교 D는 2건이 어긋났습니다.'
      ],
      note: '4장 완성 코드의 전체 테스트는 373개 모두 통과했고, 출발 코드에서 실패하던 51개가 모두 통과했습니다.',
      metrics: [
        { label: '어긋난 결제', value: '0건', tone: 'good' },
        { label: '매출로 남는 결제', value: '6건', tone: 'good' },
        { label: '보정', value: '1번 · 1403ms' },
        { label: '전체 테스트', value: '373개 통과', tone: 'good' }
      ],
      states: { pg: { badge: 'DONE 6 · ABORTED 3 · NONE 3', tone: 'info' }, db: { badge: 'APPROVED 6 · FAILED 6', tone: 'ok' } },
      flows: [
        [
          { from: 'sched', to: 'pg', kind: 'query', label: '12건 조회' },
          { from: 'sched', to: 'db', kind: 'query', label: '결과 모름 10 · 인증 2' }
        ],
        { from: 'pg', to: 'sched', kind: 'res', label: '승인 6 · 없음 6' },
        { from: 'sched', to: 'db', kind: 'write', label: '어긋남 0건', then: { db: { badge: 'APPROVED 6 · FAILED 6', tone: 'ok', note: '조회 보정' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '결제 서버가 여러 대면 보정 작업이 서버마다 돌아, 같은 결과 모름 결제를 여러 서버가 동시에 조회하고 기록합니다. 7장 동시성 제어에서 다룹니다.',
        '닫히지 않는 결제가 100건 넘게 쌓이면 그 뒤 결제는 보정되지 않습니다. 보정 대기 시간을 PG 시간 제한보다 짧게 설정해도 서버를 시작할 때 막는 검사가 없습니다.'
      ],
      note: '실제 PG가 5xx로 답하면서 승인을 남기는지는 확인하지 못했습니다. Mock PG는 남기지 않는다고 가정했습니다.',
      metrics: [
        { label: '서버', value: '1대 가정', tone: 'warn' },
        { label: '한 번에 보정', value: '100건', tone: 'warn' }
      ],
      edges: [['server', 'sched', { dashed: true }]],
      states: { sched: { badge: '서버마다 돌면?', tone: 'warn', note: '7장에서 다룸', noteTone: 'warn' } },
      flows: [
        [
          { from: 'sched', to: 'pg', kind: 'query', label: '서버 A 조회' },
          { from: 'server', to: 'pg', kind: 'query', label: '서버 B 조회' }
        ],
        { at: 'pg', then: { pg: { badge: '같은 결제를 두 번', tone: 'warn' } } }
      ]
    }
  ]
};
