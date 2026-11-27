// 10장 Saga와 보상 트랜잭션 — content/payment-saga-inventory/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[10] = {
  slug: 'payment-saga-inventory',
  branch: 'chapter-10',
  title: 'Saga와 보상 트랜잭션',
  goal: '재고를 재고 서비스로 나눈 뒤, 재고 예약 → 카드사 승인 → 예약 확정 또는 해제(보상)로 결제와 재고를 함께 맞게 끝냅니다.',
  learn: [
    { text: '나뉜 서비스에서 재고가 새는 경우', step: 1 },
    { text: '카드사 승인 전에 재고를 예약하는 이유', step: 2 },
    { text: '오케스트레이션과 코레오그래피', step: 4 },
    { text: '예약 줄과 상태 전이로 순서·중복 막기', step: 6 },
    { text: '답이 없으면 닫고 해제를 보내기', step: 8 },
    { text: '확정·해제를 `payment_outbox`로 보내기', step: 10 },
    { text: '계약 21개와 측정으로 본 결과와 남은 한계', step: 12 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인 요청', x: 95, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '카드사 승인', x: 340, y: 120 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'PaymentHoldings', subMono: true, x: 340, y: 300 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제·payment_outbox', x: 340, y: 462 },
    { id: 'kafka', kind: 'kafka', label: 'Kafka', sub: '재고 명령 토픽', x: 590, y: 462 },
    { id: 'inv', kind: 'service', label: '재고 서비스', sub: 'inventory-service', subMono: true, x: 840, y: 300 },
    { id: 'invdb', kind: 'db', label: '재고 DB', sub: 'inventory_service', subMono: true, x: 840, y: 120 }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db'], ['server', 'inv'], ['inv', 'invdb'], ['db', 'kafka']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '8장 방식을 그대로 HTTP 호출로 바꿨다',
      src: '현재 구조: 8장 방식을 그대로 HTTP 호출로 바꾼 재고 서비스',
      body: [
        '출발 코드는 8장에 결제 서버 안에 있던 재고 표를 재고 서비스로 옮기고, 재고 저장소를 HTTP 호출(`InventoryStockClient`)로 바꿨습니다. 인증 트랜잭션 안에서 상품마다 HTTP로 재고를 줄이고, 결제가 승인 없이 끝나면 상태를 바꾼 트랜잭션 안에서 HTTP로 늘립니다.',
        '재고 서비스는 상품마다 수량 한 줄만 있고, **어느 결제가 무엇을 잡았는지 남기지 않습니다.** 늘리기는 실패해도 로그만 남깁니다.'
      ],
      metrics: [
        { label: '재고 시간 제한', value: '연결 1s · 읽기 5s' },
        { label: '10장 계약', value: '21개 중 7개 실패', tone: 'bad' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'inv', kind: 'req', label: 'POST /stocks/{id}/decrease', mono: true },
        { from: 'inv', to: 'invdb', kind: 'write', label: '수량만 줄임', then: { invdb: { badge: '재고 3', tone: 'info' } } },
        { from: 'inv', to: 'server', kind: 'res', label: '줄임' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } }
      ]
    },
    {
      short: '늦은 답', tag: '문제', title: '재고는 줄었는데 결제는 준비 상태로 남는다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '재고 서비스의 답을 1.5초 붙잡자 결제 서버는 0.5초에 응답 없음으로 인증 트랜잭션째 롤백해 결제는 준비 상태로 남았습니다. 재고 서비스는 이미 줄여 두었기 때문에 **재고는 3(처음 5)**이었습니다.',
        '결제가 기다리다 그만둔 줄이기 요청이 나중에 도착해도, 재고 서비스가 멈춘 동안 늘리기가 연결에 실패해도 재고는 3으로 남았습니다. 출발 코드에서 **692개 중 8개**가 실패했습니다.'
      ],
      note: '계약에서는 재고 서비스 읽기 시간 제한을 0.5초로 줄이고, 늦은 재고 서비스는 1.5초 뒤에 답하게 했습니다.',
      metrics: [
        { label: '읽기 시간 제한(계약)', value: '0.5초' },
        { label: '재고 서비스 답', value: '1.5초 뒤', tone: 'warn' },
        { label: '전체 테스트', value: '692개 중 8개 실패', tone: 'bad' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'inv', kind: 'req', label: '재고 줄이기' },
        { from: 'inv', to: 'invdb', kind: 'write', label: '줄임', then: { invdb: { badge: '재고 3', tone: 'info' } } },
        { from: 'inv', to: 'server', kind: 'fail', label: '0.5초 안에 답 없음', cut: true, slow: true },
        { at: 'db', then: { db: { badge: 'READY', tone: 'warn', note: '인증째 롤백' } } },
        { at: 'invdb', then: { invdb: { badge: '재고 3', tone: 'bad', note: '처음 5, 돌려주지 않음', shake: true } } }
      ]
    },
    {
      short: '예약 먼저', tag: '결정', title: '결정 1. 카드사 승인 전에 동기 HTTP로 재고를 예약한다',
      src: '결정 1. 재고를 언제, 어떻게 잡을까',
      body: [
        '이 장에서는 인증(쿠폰·포인트)을 커밋한 뒤, 카드사에 승인을 요청하기 전에 재고 서비스에 동기 HTTP로 재고를 예약하고, 시간 제한을 **연결 300ms·읽기 1s**로 짧게 두기로 했습니다.',
        '재고가 모자라면 카드사에 요청하지 않고 결제를 `APPROVAL_FAILED`로 닫은 뒤 쿠폰·포인트를 돌려주고 409 `OUT_OF_STOCK`으로 답합니다. 재고를 인증 트랜잭션 밖으로 빼서 HTTP를 기다리는 동안 결제 줄 잠금을 쥐지 않습니다.'
      ],
      note: '비용: 재고 서비스가 느리면 결제도 느려집니다. 재고 서비스가 1.5초 늦게 답하는 동안 응답 중앙값은 18~21ms에서 1027~1038ms로 늘었고, 멈추면 결제를 받지 못합니다.',
      changed: [['+', '`POST /reservations`, 예약 번호 = 결제 번호'], ['~', '재고를 인증 트랜잭션 밖으로'], ['~', '재고 부족 결제는 준비 대신 `APPROVAL_FAILED`']],
      metrics: [
        { label: '재고 시간 제한', value: '연결 300ms · 읽기 1s' },
        { label: '응답 중앙(늦음)', value: '1027~1038ms', tone: 'warn' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: '인증 커밋', then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'inv', kind: 'req', label: 'POST /reservations', mono: true },
        { from: 'inv', to: 'invdb', kind: 'write', label: '예약 줄 + 재고 줄이기', then: { invdb: { badge: 'RESERVED', tone: 'info', note: '재고 3' } } },
        { from: 'inv', to: 'server', kind: 'res', label: '200', mono: true },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200', mono: true }
      ]
    },
    {
      short: '승인 먼저', tag: '비교', title: '비교. 승인을 먼저 받고 모자라면 카드사 취소로 보상',
      src: '결정 1. 재고를 언제, 어떻게 잡을까',
      body: [
        '승인 먼저 비교는 카드사 승인을 먼저 받아 바로 답하고, Kafka로 재고 차감을 보냅니다. 재고 서비스가 줄이지 못했다고 답하면 `ApproveFirstReplyListener`가 카드사에 전액 취소를 보냅니다. **계약 21개 중 7개**가 실패했습니다.',
        '재고가 모자란 주문도 카드사에 승인을 한 번 요청했고 결제는 `APPROVAL_CANCELED`로 끝났습니다. 300건이 몰리자 고객은 승인 답을 300건 받았습니다. 대신 응답은 재고 서비스가 늦거나 멈춰도 늘지 않았습니다.'
      ],
      note: '측정(재고 20개 상품에 30건)에서 승인 답이 30건 나갔고, 그중 10건은 그 뒤 카드사 취소로 보상됐습니다.',
      edges: [['server', 'kafka'], ['kafka', 'inv']],
      metrics: [
        { label: '계약', value: '21개 중 7개 실패', tone: 'bad' },
        { label: '응답 중앙(늦음)', value: '28~33ms', tone: 'good' },
        { label: '승인 답', value: '30건 · 10건 보상 취소', tone: 'bad' }
      ],
      states: { invdb: { badge: '재고 모자람', tone: 'warn' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '승인 답' },
        { from: 'server', to: 'kafka', kind: 'event', label: '차감 요청' },
        { from: 'kafka', to: 'inv', kind: 'event', label: '차감 요청' },
        { from: 'inv', to: 'kafka', kind: 'event', label: '줄이지 못함' },
        { from: 'kafka', to: 'server', kind: 'event', label: '줄이지 못함' },
        { from: 'server', to: 'pg', kind: 'req', label: '전액 취소', then: { pg: { badge: 'CANCELED', tone: 'bad' }, db: { badge: 'APPROVAL_CANCELED', tone: 'bad', note: '카드에 승인과 취소가 남음', shake: true } } }
      ]
    },
    {
      short: '오케스트', tag: '결정', title: '결정 2. Saga 진행을 결제 서버가 결제 상태로 쥔다',
      src: '결정 2. Saga 진행을 누가 쥘까',
      body: [
        '이 장에서는 Saga 진행을 결제 서버가 결제 상태로 쥐기로 했습니다(오케스트레이션). 결제를 바꾸는 기록 다섯 곳이 상태를 바꾼 바로 뒤에 `PaymentHoldings.settle` 한 곳을 부르고, 승인이면 확정, 승인 없이 끝나거나 취소면 해제를 정합니다.',
        '재고 서비스는 **결제 상태를 모른 채** 받은 명령대로 예약 상태만 바꿉니다. 결제 서버가 이미 상태 전이 표와 결과 모름 보정을 쥐고 있어서, 재고 단계도 같은 곳에서 정했습니다.'
      ],
      note: '비용: 결제 서버에 재고 확정·해제 규칙(`settle`)과 재고 명령 보내기가 생기고, `payment_outbox`에 결제 결과 말고 재고 명령 줄이 더 쌓입니다.',
      changed: [['+', '`PaymentHoldings.settle`'], ['+', '`confirmsHoldingsFrom` · `releasesHoldingsFrom`']],
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '계약', value: '21개 모두 통과', tone: 'good' },
        { label: '재고 서비스가 아는 것', value: '명령만', tone: 'good' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' }, invdb: { badge: 'RESERVED', tone: 'info' } },
      focus: ['server'],
      flows: [
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨' },
        { at: 'server', then: { server: { badge: 'settle', tone: 'info', note: '기다리던 결제가 승인 → 확정', noteTone: 'muted' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED + STOCK_CONFIRM', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'db', to: 'kafka', kind: 'event', label: 'STOCK_CONFIRM', mono: true },
        { from: 'kafka', to: 'inv', kind: 'event', label: '확정 명령' },
        { from: 'inv', to: 'invdb', kind: 'write', label: 'CONFIRMED', mono: true, then: { invdb: { badge: 'CONFIRMED', tone: 'ok' } } }
      ]
    },
    {
      short: '코레오', tag: '비교', title: '비교. 재고 서비스가 결제 이벤트를 읽고 스스로 정한다',
      src: '결정 2. Saga 진행을 누가 쥘까',
      body: [
        '코레오그래피 비교는 결제 서버가 쿠폰·포인트만 돌려주고, 재고 서비스의 `PaymentEventReactionListener`가 9장 결제 이벤트를 읽어 `APPROVED`·`CAPTURED`면 확정, 승인 실패·만료·취소면 해제합니다.',
        '결과는 계약으로 갈리지 않았습니다. **코레오그래피도 21개를 모두 통과**했고, 어긋난 재고는 6번 모두 0이었습니다. 재고가 맞춰지기까지 코레오그래피 243~752ms, 운영 352~716ms였습니다.'
      ],
      note: '차이는 코드에서 보았습니다. 재고 서비스가 결제 상태 이름 여섯 개와 그 뜻을 알아야 하고, 재고를 잡지 않은 결제의 실패 이벤트에도 빈 해제 줄을 남깁니다.',
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '계약', value: '21개 모두 통과', tone: 'good' },
        { label: '맞춰진 때', value: '243~752ms' },
        { label: '재고 서비스가 아는 것', value: '결제 상태 여섯 개', tone: 'warn' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' }, invdb: { badge: 'RESERVED', tone: 'info' } },
      focus: ['inv'],
      flows: [
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED + PAYMENT_RESULT', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'db', to: 'kafka', kind: 'event', label: '결제 이벤트' },
        { from: 'kafka', to: 'inv', kind: 'event', label: 'APPROVED', mono: true, then: { inv: { badge: 'CONFIRMING', tone: 'warn', note: '결제 상태를 보고 판단', noteTone: 'warn' } } },
        { from: 'inv', to: 'invdb', kind: 'write', label: 'CONFIRMED', mono: true, then: { invdb: { badge: 'CONFIRMED', tone: 'ok' } } }
      ]
    },
    {
      short: '예약 줄', tag: '결정', title: '결정 3. 결제 번호로 예약 줄을 남기고 상태 전이로 바꾼다',
      src: '결정 3. 재고 서비스는 무엇을 남길까',
      body: [
        '이 장에서는 재고 서비스가 결제 번호를 예약 번호로 `stock_reservation` 줄을 남기고, 잡음(`RESERVED`) → 확정(`CONFIRMED`) / 해제(`RELEASED`) 상태 전이로 재고를 바꾸기로 했습니다.',
        '해제가 예약보다 먼저 오면 상품 없는 해제 줄을 먼저 남기고(`claim`, `insert ignore`), 늦게 온 예약은 **409 `RESERVATION_RELEASED`**로 받지 않습니다. 같은 해제가 두 번 와도 이미 해제된 예약은 바꾸지 않습니다.'
      ],
      note: '비용: 표가 두 개 늘고 결제마다 예약 줄이 남습니다. 빈 해제 줄도 지우지 않고, 해제가 먼저 남은 결제 번호로는 다시 예약할 수 없습니다.',
      changed: [['+', '`stock_reservation`, `stock_reservation_item`'], ['+', '`canConfirm` · `holdsStock`'], ['+', '예약 상태 전이 단위 시험 7개']],
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '해제가 먼저', value: '재고 5', tone: 'good' },
        { label: '같은 해제 두 번', value: '한 번만 반영', tone: 'good' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      focus: ['inv'],
      flows: [
        { from: 'kafka', to: 'inv', kind: 'event', label: '해제(예약보다 먼저)' },
        { from: 'inv', to: 'invdb', kind: 'write', label: '빈 해제 줄 claim', then: { invdb: { badge: 'RELEASED', tone: 'muted', note: '재고 5 그대로', noteTone: 'muted' } } },
        { from: 'server', to: 'inv', kind: 'req', label: '늦게 도착한 예약', slow: true },
        { from: 'inv', to: 'invdb', kind: 'query', label: '잠그고 읽기' },
        { from: 'inv', to: 'server', kind: 'fail', label: '409 RESERVATION_RELEASED', mono: true },
        { at: 'invdb', then: { invdb: { badge: 'RELEASED', tone: 'ok', note: '재고 5' } } }
      ]
    },
    {
      short: '수량만', tag: '비교', title: '비교. 예약 기록 없이 수량만 줄이고 늘리면',
      src: '결정 3. 재고 서비스는 무엇을 남길까',
      body: [
        '수량만 비교는 예약 기록 없이 수량만 줄이고 늘립니다. **계약 21개 중 4개**가 실패했습니다. 해제가 예약보다 먼저 도착하자 늘리기가 먼저 반영돼 재고가 7(처음 5)이 됐고, 늦게 온 줄이기는 그 뒤에 반영됐습니다.',
        '같은 해제가 두 번 와도 두 번 늘려 7이었습니다. 확정 계약 2개는 예약 기록이 없어 0이었습니다.'
      ],
      note: '측정에서도 6번 중 4번 어긋난 재고가 +10이었습니다. 재고 서비스가 멈춘 동안 닫은 결제의 해제가, 돌아온 뒤 줄인 적 없는 재고를 늘렸습니다.',
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '계약', value: '21개 중 4개 실패', tone: 'bad' },
        { label: '어긋난 재고', value: '+10 (6번 중 4번)', tone: 'bad' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      flows: [
        { from: 'kafka', to: 'inv', kind: 'event', label: '해제(예약보다 먼저)' },
        { from: 'inv', to: 'invdb', kind: 'write', label: '늘리기', then: { invdb: { badge: '재고 7', tone: 'bad', note: '처음보다 늘어남', shake: true } } },
        { from: 'server', to: 'inv', kind: 'req', label: '늦게 도착한 줄이기', slow: true },
        { from: 'inv', to: 'invdb', kind: 'write', label: '줄이기', then: { invdb: { badge: '재고 5', tone: 'warn', note: '누가 잡았는지 모름', noteTone: 'warn' } } }
      ]
    },
    {
      short: '닫고 해제', tag: '결정', title: '결정 4. 예약 답이 없으면 결제를 닫고 해제를 보낸다',
      src: '결정 4. 예약 답을 받지 못하면 어떻게 할까',
      body: [
        '이 장에서는 재고 서비스의 답을 받지 못하면(시간 초과·연결 실패) 카드사에 승인을 요청하지 않고 결제를 승인 없이 닫은 뒤, 예약 해제를 보내기로 했습니다. 고객에게는 504 `INVENTORY_NO_RESPONSE`로 답합니다.',
        '재고 서비스가 실제로 잡았으면 해제가 돌려주고, 처리 중이면 같은 예약 줄을 기다렸다 돌려주고, 요청이 늦게 도착하면 먼저 남은 해제 줄에 막히고, 받지 못했으면 빈 해제 줄만 남습니다. **네 경우 모두 결과가 같습니다.**'
      ],
      note: '비용: 재고 서비스가 실제로 재고를 잡았고 답만 늦었어도 결제는 승인 없이 실패로 끝나 고객은 504를 받습니다. 요청을 받지 못한 재고 서비스에도 빈 해제 줄이 남습니다.',
      changed: [['+', '`recordStockNoResponse`'], ['+', '계약 "예약을 처리하는 동안 시간 제한이 지나도"']],
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '계약', value: '21개 모두 통과', tone: 'good' },
        { label: '어긋난 재고', value: '0 (6번)', tone: 'good' },
        { label: '응답 중앙(늦음)', value: '1027~1038ms', tone: 'warn' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' }, db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'inv', kind: 'req', label: '예약' },
        { from: 'inv', to: 'invdb', kind: 'write', label: '예약 줄 + 줄이기', then: { invdb: { badge: 'RESERVED', tone: 'info', note: '재고 3' } } },
        { from: 'inv', to: 'server', kind: 'fail', label: '1s 안에 답 없음', cut: true, slow: true },
        { from: 'server', to: 'db', kind: 'write', label: '승인 실패 + STOCK_RELEASE', mono: false, then: { db: { badge: 'APPROVAL_FAILED', tone: 'warn' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true },
        { from: 'db', to: 'kafka', kind: 'event', label: 'STOCK_RELEASE', mono: true },
        { from: 'kafka', to: 'inv', kind: 'event', label: '해제' },
        { from: 'inv', to: 'invdb', kind: 'write', label: 'RELEASED', mono: true, then: { invdb: { badge: 'RELEASED', tone: 'ok', note: '재고 5' } } }
      ]
    },
    {
      short: '조회 확인', tag: '비교', title: '비교. 답이 없으면 예약을 조회하거나, 실패로만 보면',
      src: '결정 4. 예약 답을 받지 못하면 어떻게 할까',
      body: [
        '조회로 확인하는 비교는 답이 없으면 `GET /reservations/{id}`로 물어 잡혀 있으면 승인까지 가고, 없으면 해제 없이 닫습니다. 예약을 처리하는 중에 물었을 때 아직 커밋되지 않은 예약이 보이지 않아 없다고 닫았고, 그 뒤 예약이 커밋돼 **재고 3**이었습니다. 21개 중 1개가 실패했습니다.',
        '실패로만 보는 비교는 해제를 보내지 않아 답만 늦음·처리 중·늦게 도착한 경우 모두 재고 3으로, 21개 중 3개가 실패했습니다. 측정에서는 6번 모두 어긋난 재고가 −10이었습니다.'
      ],
      note: '조회로 확인하면 재고 서비스가 늦을 때 응답 중앙값이 2040~2045ms였습니다. 예약 1s에 조회도 1s 시간 제한에 걸렸기 때문입니다.',
      metrics: [
        { label: '조회로 확인', value: '21개 중 1개 실패', tone: 'bad' },
        { label: '응답 중앙(늦음)', value: '2040~2045ms', tone: 'bad' },
        { label: '실패로만', value: '21개 중 3개 실패 · −10', tone: 'bad' }
      ],
      states: { invdb: { badge: '재고 5', tone: 'info' } },
      flows: [
        { from: 'server', to: 'inv', kind: 'req', label: '예약' },
        { at: 'invdb', then: { invdb: { badge: '처리 중', tone: 'warn', note: '커밋 전(1초 붙잡힘)', noteTone: 'warn' } } },
        { from: 'inv', to: 'server', kind: 'fail', label: '시간 초과', cut: true },
        { from: 'server', to: 'inv', kind: 'query', label: 'GET /reservations/{id}', mono: true },
        { from: 'inv', to: 'server', kind: 'res', label: '없음' },
        { from: 'server', to: 'db', kind: 'write', label: '해제 없이 닫음', then: { db: { badge: 'APPROVAL_FAILED', tone: 'warn' } } },
        { at: 'invdb', then: { invdb: { badge: '재고 3', tone: 'bad', note: '그 뒤 예약이 커밋됨', shake: true } } }
      ]
    },
    {
      short: 'Outbox', tag: '결정', title: '결정 5. 확정·해제는 상태를 바꾼 트랜잭션에서 payment_outbox에 남긴다',
      src: '결정 5. 확정과 해제를 어떻게 보낼까',
      body: [
        '이 장에서는 예약 확정과 해제를 결제 상태를 바꾼 그 트랜잭션에서 9장 `payment_outbox`에 남기고, 9장 릴레이가 결제 번호를 키로 재고 명령 토픽(`stock-reservation-commands`)에 보내기로 했습니다.',
        '상태가 커밋되면 명령도 반드시 남아, 재고 서비스가 멈춰 있어도 명령을 잃지 않습니다. 재고 서비스가 돌아오면 **읽던 자리부터** 읽어 해제합니다. 결과 모름 결제는 보정이 결과를 정할 때까지 명령을 남기지 않습니다.'
      ],
      note: '비용: 재고가 바로 돌아오지 않습니다. 원복 시간은 중앙값 302~626ms, p95 1321~1553ms였습니다. 같은 명령이 두 번 갈 수 있고, 일반적인 중복 가리기와 재시도는 11장에서 다룹니다.',
      changed: [['+', '`payment_outbox`에 `type` 칸, `STOCK_CONFIRM`·`STOCK_RELEASE`'], ['+', '토픽 `stock-reservation-commands`(파티션 2개)'], ['-', '재고 서비스 HTTP 확정·해제 API']],
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '어긋난 재고', value: '0 (6번)', tone: 'good' },
        { label: '원복 중앙', value: '302~626ms', tone: 'warn' }
      ],
      states: { inv: { badge: '멈춤', tone: 'bad' }, invdb: { badge: 'RESERVED', tone: 'info', note: '재고 3' }, db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '거절' },
        { from: 'server', to: 'db', kind: 'write', label: '승인 실패 + STOCK_RELEASE', mono: false, then: { db: { badge: 'APPROVAL_FAILED', tone: 'warn' } } },
        { from: 'db', to: 'kafka', kind: 'event', label: 'STOCK_RELEASE', mono: true, then: { kafka: { badge: '명령이 남아 있음', tone: 'info' } } },
        { at: 'inv', then: { inv: { badge: '돌아옴', tone: 'ok' } } },
        { from: 'kafka', to: 'inv', kind: 'event', label: '읽던 자리부터', then: { kafka: { badge: '' } } },
        { from: 'inv', to: 'invdb', kind: 'write', label: 'RELEASED', mono: true, then: { invdb: { badge: 'RELEASED', tone: 'ok', note: '재고 5' } } }
      ]
    },
    {
      short: '그 자리', tag: '비교', title: '비교. 상태를 바꾼 자리에서 바로 HTTP로 보내면',
      src: '결정 5. 확정과 해제를 어떻게 보낼까',
      body: [
        '그 자리에서 HTTP로 보내는 비교는 상태를 바꾼 트랜잭션 안에서 재고 서비스에 바로 확정·해제를 보내고, 실패하면 로그만 남깁니다. **계약 21개 중 1개**가 실패했습니다.',
        '재고 서비스가 멈춘 동안 승인이 거절된 결제의 해제가 사라져, 돌아온 뒤에도 재고가 3(처음 5)이었습니다. 측정에서도 6번 모두 어긋난 재고가 −5였습니다.'
      ],
      note: '결제 줄을 잠근 채 재고 서비스의 답을 기다려서, 재고 서비스가 늦을 때 응답 중앙값이 2042~2045ms였습니다.',
      metrics: [
        { label: '계약', value: '21개 중 1개 실패', tone: 'bad' },
        { label: '어긋난 재고', value: '−5 (6번)', tone: 'bad' },
        { label: '응답 중앙(늦음)', value: '2042~2045ms', tone: 'bad' }
      ],
      states: { inv: { badge: '멈춤', tone: 'bad' }, invdb: { badge: 'RESERVED', tone: 'info', note: '재고 3' }, db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '거절' },
        { from: 'server', to: 'inv', kind: 'fail', label: '해제 HTTP', cut: true },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVAL_FAILED', mono: true, then: { db: { badge: 'APPROVAL_FAILED', tone: 'warn', note: '로그만 남김', noteTone: 'warn' } } },
        { at: 'inv', then: { inv: { badge: '돌아옴', tone: 'ok' }, invdb: { badge: '재고 3', tone: 'bad', note: '해제가 사라짐', shake: true } } }
      ]
    },
    {
      short: '결과', tag: '결과', title: '계약 21개와 측정으로 잰 결과',
      src: '테스트 결과',
      body: [
        '10장 완성 코드에서 전체 테스트 **713개가 모두 통과**했고, 출발 코드에서 실패하던 8개(10장 7, 8장 1)도 모두 통과했습니다. 10장 계약 21개를 운영과 코레오그래피 비교로 돌려 42개가 늘었습니다.',
        '측정(재고 20개 상품에 30건)에서 운영은 6번 모두 어긋난 재고가 0이었고, 맞춰진 때는 352~716ms였습니다. 실패 수는 승인 먼저 7, 수량만 4, 실패로만 3, 조회로 확인 1, 그 자리 HTTP 1, 코레오그래피 0이었습니다.'
      ],
      note: '응답 중앙값은 보통 18~21ms, 재고 서비스가 늦을 때 1027~1038ms, 멈췄을 때 13~16ms였습니다.',
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '전체 테스트', value: '713개 통과', tone: 'good' },
        { label: '어긋난 재고', value: '0 (6번)', tone: 'good' },
        { label: '맞춰진 때', value: '352~716ms' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, invdb: { badge: 'CONFIRMED', tone: 'ok' } },
      flows: [
        [
          { from: 'server', to: 'inv', kind: 'req', label: '예약' },
          { from: 'server', to: 'pg', kind: 'req', label: '승인' }
        ],
        { from: 'server', to: 'db', kind: 'write', label: '상태 + 재고 명령' },
        { from: 'db', to: 'kafka', kind: 'event', label: '릴레이' },
        { from: 'kafka', to: 'inv', kind: 'event', label: '확정 또는 해제', then: { invdb: { badge: '어긋남 0', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '재고 서비스가 느리면 결제도 읽기 시간 제한(1s)만큼 느려지고, 멈추면 결제를 받지 못합니다. 답이 늦었을 뿐 실제로 잡았어도 결제는 승인 없이 실패로 끝납니다. 예약 만료(TTL)도 없습니다.',
        '받는 쪽의 일반적인 중복 가리기·재시도·실패 모음이 없어, 처리에 실패한 명령은 Spring Kafka 기본 처리 그대로입니다. **11장에서 다룹니다.**'
      ],
      note: '결정 2는 계약과 측정으로 갈리지 않았습니다. 시간 제한 근거는 같은 머신의 루프백에서 잰 값이고, `insert ignore`가 남기는 중인 트랜잭션을 기다린다는 것도 문서로 확인하지 못했습니다.',
      edges: [['kafka', 'inv']],
      metrics: [
        { label: '응답 중앙(늦음)', value: '1027~1038ms', tone: 'warn' },
        { label: '받는 쪽 재시도', value: '기본 처리', tone: 'warn' }
      ],
      states: { inv: { badge: '같은 명령이 또 오면?', tone: 'warn', note: '11장에서 다룸', noteTone: 'warn' } },
      flows: [
        { from: 'db', to: 'kafka', kind: 'event', label: '적어도 한 번' },
        { from: 'kafka', to: 'inv', kind: 'event', label: '같은 명령 두 번' },
        { at: 'inv', then: { inv: { badge: '상태 전이로만 흡수', tone: 'warn', note: '11장에서 다룸', noteTone: 'warn' } } }
      ]
    }
  ]
};
