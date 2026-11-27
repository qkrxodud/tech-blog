// 8장 결제와 재고·포인트·쿠폰 — content/payment-stock-point-coupon/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[8] = {
  slug: 'payment-stock-point-coupon',
  branch: 'chapter-08',
  title: '결제와 재고·포인트·쿠폰',
  goal: '결제 금액을 서버가 정하고, 재고·쿠폰·포인트를 승인 요청 전에 잡았다가 결제가 승인 없이 끝나면 한 번 돌려줍니다.',
  learn: [
    { text: '고객 금액을 믿으면 생기는 일', step: 1 },
    { text: '읽고 뺀 값을 쓰면 넘겨 파는 이유', step: 2 },
    { text: '서버가 금액을 정하고 다르면 400', step: 4 },
    { text: '인증 트랜잭션에서 잡는 이유', step: 6 },
    { text: '조건부 UPDATE 한 문장으로 줄이기', step: 8 },
    { text: '상태 전이에서 한 번 돌려주기', step: 10 },
    { text: '쿠폰을 `ISSUED`일 때만 `USED`로', step: 11 },
    { text: '테스트 결과와 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '주문 A', sub: '준비·승인 요청', x: 95, y: 170 },
    { id: 'client2', kind: 'client', label: '주문 B', sub: '겹친 주문', x: 95, y: 420, absent: '겹칠 때만' },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'PaymentRecorder', subMono: true, x: 345, y: 295 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '카드사 승인', x: 640, y: 120 },
    { id: 'pay', kind: 'db', label: '결제 줄', sub: 'payment', subMono: true, x: 640, y: 295 },
    { id: 'hold', kind: 'db', label: '재고·쿠폰·포인트', sub: '같은 MySQL', x: 640, y: 465 },
    { id: 'sched', kind: 'scheduler', label: '보정·알림', sub: '결제를 닫는 다른 길', x: 905, y: 295 }
  ],
  edges: [
    ['client', 'server'], ['client2', 'server'], ['server', 'pg'], ['server', 'pay'], ['server', 'hold'],
    ['sched', 'pg'], ['sched', 'pay'], ['sched', 'hold']
  ],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '고객 금액을 믿고, 승인 뒤에 읽어 줄인다',
      src: '현재 구조: 고객 금액을 믿고 승인 뒤에 줄이는 결제',
      body: [
        '출발 코드는 상품·재고·포인트·쿠폰을 가장 먼저 떠오르는 방법으로 넣었습니다. 준비는 고객이 보낸 금액을 그대로 결제에 남기고, 재고·쿠폰·포인트는 PG가 승인했다는 답을 기록하는 트랜잭션에서 줄입니다.',
        '재고는 지금 수량을 읽고 거기서 수량을 뺀 값을 씁니다. 포인트 잔액도 같은 모양이고, 쿠폰은 준비 때 확인했으니 쓴 것으로 바꾸기만 합니다. 거절·결과 모름·취소에는 **아무것도 하지 않습니다**.'
      ],
      hide: ['client2', 'sched'],
      metrics: [
        { label: '결제 금액', value: '고객이 보낸 값' },
        { label: '줄이는 때', value: '승인 답 기록' },
        { label: '8장 테스트', value: '42개 중 21개 실패', tone: 'bad' }
      ],
      states: { hold: { badge: '재고 5 · 3000원 · ISSUED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '준비(고객 금액)' },
        { from: 'server', to: 'pay', kind: 'write', label: 'READY', mono: true, then: { pay: { badge: 'READY', tone: 'info' } } },
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pay', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { pay: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } },
        [
          { from: 'server', to: 'pay', kind: 'write', label: 'APPROVED', mono: true, then: { pay: { badge: 'APPROVED', tone: 'ok' } } },
          { from: 'server', to: 'hold', kind: 'write', label: '읽은 값에서 빼서 씀', then: { hold: { badge: '재고 3 · 2000원 · USED', tone: 'info' } } }
        ],
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '금액 조작', tag: '문제', title: '17000원 주문을 1000원으로 낮춰도 승인된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '상품 2개(10000원 × 2) − 쿠폰 2000원 − 포인트 1000원 = 17000원인 주문을 1000원으로 낮춰 보내도 준비됐고(**API 201**), PG에서 **1000.00원이 승인**됐습니다.',
        '3장에서 승인 때 결제에 남은 금액과 비교하도록 했지만, 남은 금액이 처음부터 고객이 보낸 금액이라 아무것도 막지 못했습니다.'
      ],
      note: '처음 작성한 "낮춘 금액이 승인되지 않는다" 테스트는 PG가 받은 `1000.00`과 `1000`을 `equals`로 비교해 잘못 통과했습니다. 값으로 비교하도록 고쳤습니다.',
      hide: ['client2', 'sched'],
      metrics: [
        { label: '계산한 금액', value: '17000원' },
        { label: 'PG 승인', value: '1000.00원', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '1000원으로 준비' },
        { from: 'server', to: 'pay', kind: 'write', label: '금액 1000원', then: { pay: { badge: 'READY · 1000원', tone: 'warn' } } },
        { from: 'server', to: 'client', kind: 'res', label: '201', mono: true },
        { from: 'client', to: 'server', kind: 'req', label: '1000원 승인 요청' },
        { from: 'server', to: 'pay', kind: 'query', label: '남은 금액과 비교' },
        { from: 'server', to: 'pg', kind: 'req', label: '1000원 승인' },
        { at: 'pg', then: { pg: { badge: '1000.00원 승인', tone: 'bad', note: '17000원 주문인데', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '겹친 주문', tag: '문제', title: '겹친 두 주문이 같은 재고·쿠폰·포인트를 쓴다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '재고 1개에 두 주문이 겹치면 둘 다 승인되고 PG 승인도 2건 남았습니다. 재고 10개에 30건이 한꺼번에 오면 30건이 모두 승인됐는데, 남은 재고는 −20이 아니라 **6**이었습니다. 읽고 뺀 값을 쓰는 사이에 서로 덮어썼기 때문입니다.',
        '같은 쿠폰을 담은 두 주문도, 포인트 1000원인 회원이 각각 1000원을 쓰는 두 주문도 둘 다 승인됐습니다. 쿠폰 확인이 준비 때 한 번뿐이었고, 두 기록이 같은 1000원을 읽고 0을 썼습니다.'
      ],
      note: '겹침은 먼저 보낸 주문의 인증 기록을 트리거로 1초 붙잡고, 잠든 것을 확인한 뒤 두 번째 주문의 승인을 보내 고정했습니다.',
      hide: ['sched'],
      metrics: [
        { label: '재고 1개에 두 주문', value: '둘 다 승인', tone: 'bad' },
        { label: '재고 10개에 30건', value: '30건 승인 · 남은 재고 6', tone: 'bad' }
      ],
      states: { hold: { badge: '재고 1', tone: 'info' } },
      flows: [
        [
          { from: 'client', to: 'server', kind: 'req', label: 'A 승인 요청' },
          { from: 'client2', to: 'server', kind: 'req', label: 'B 승인 요청' }
        ],
        { from: 'server', to: 'pg', kind: 'req', label: 'A·B 승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '둘 다 승인됨', then: { pg: { badge: '승인 2건', tone: 'bad' } } },
        { from: 'server', to: 'hold', kind: 'query', label: '둘 다 1을 읽음' },
        { from: 'server', to: 'hold', kind: 'write', label: '둘 다 0을 씀', then: { hold: { badge: '재고 0 · 승인 2건', tone: 'bad', note: '재고 1개를 둘에게 팖', shake: true } } }
      ]
    },
    {
      short: '안 돌려줌', tag: '문제', title: '전액 취소해도 줄인 것이 돌아오지 않는다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '되돌리기 계약의 처음 값은 재고 5, 포인트 3000원, 쿠폰 쓸 수 있음입니다. 전액 취소한 뒤에도, 부분 취소가 쌓여 남은 금액이 0원이 된 뒤에도 **재고 3·포인트 2000원·쿠폰 쓰임** 그대로였습니다.',
        '거절·PG 쪽 만료·결과 모름 뒤 승인 실패의 되돌리기 계약 6개는 출발 코드에서 통과했습니다. 승인 뒤에만 줄이므로 줄어든 것이 없었기 때문입니다. 이 6개는 결정 2로 인증 때 잡게 바꾼 뒤 실패로 바뀌었습니다.'
      ],
      hide: ['client2', 'sched'],
      metrics: [
        { label: '8장 테스트', value: '42개 중 21개 실패', tone: 'bad' },
        { label: '돌려주는 곳', value: '없음', tone: 'bad' }
      ],
      states: { pay: { badge: 'APPROVED', tone: 'ok' }, hold: { badge: '재고 3 · 2000원 · USED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '전액 취소' },
        { from: 'server', to: 'pg', kind: 'req', label: '취소' },
        { from: 'pg', to: 'server', kind: 'res', label: '취소됨', then: { pg: { badge: '취소', tone: 'info' } } },
        { from: 'server', to: 'pay', kind: 'write', label: 'APPROVAL_CANCELED', mono: true, then: { pay: { badge: 'APPROVAL_CANCELED', tone: 'info' } } },
        { at: 'hold', then: { hold: { badge: '재고 3 · 2000원 · USED', tone: 'bad', note: '5 · 3000원 · ISSUED여야 함', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '서버 금액', tag: '결정', title: '결정 1. 결제 금액은 서버가 계산한다',
      src: '결정 1. 결제 금액을 누가 정할까',
      body: [
        '이 장에서는 상품을 담은 준비의 결제 금액을 서버가 **상품가 합 − 쿠폰 할인 − 쓴 포인트**로 계산해 결제에 남기고, 고객 금액이 다르면 400 `AMOUNT_MISMATCH`로 받지 않기로 했습니다.',
        '승인 때의 비교가 결제에 남은 금액을 기준으로 하기 때문입니다. 고객 금액을 믿는 비교는 계약 4개 중 2개가 실패했고, 1000원으로 낮춘 주문이 PG에서 1000.00원으로 승인됐습니다.'
      ],
      note: '비용: 준비 요청마다 상품과 쿠폰을 읽어야 합니다(측정하지 않음). 상품 없이 금액만 보낸 준비는 앞 장 계약을 지키려고 지금도 받은 금액으로 준비됩니다.',
      changed: [['+', '`Payment.order`가 금액을 정함'], ['~', '준비에서 `verifyAmount`로 고객 금액 비교'], ['+', '다르면 400 `AMOUNT_MISMATCH`']],
      hide: ['client2', 'sched'],
      metrics: [
        { label: '결제 금액', value: '서버 계산 17000원', tone: 'good' },
        { label: '고객 금액 믿음', value: '4개 중 2개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '1000원으로 준비' },
        { from: 'server', to: 'hold', kind: 'query', label: '상품가·쿠폰 읽기' },
        { at: 'server', then: { server: { badge: '17000원 계산', tone: 'info' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '400 AMOUNT_MISMATCH', mono: true },
        { at: 'pay', then: { pay: { badge: '결제 남지 않음', tone: 'muted' } } }
      ]
    },
    {
      short: '인증 때 잡기', tag: '결정', title: '결정 2. 승인 요청 직전, 인증 트랜잭션에서 잡는다',
      src: '결정 2. 재고·쿠폰·포인트를 언제 잡을까',
      body: [
        '이 장에서는 재고·쿠폰·포인트를 PG에 승인을 요청하기 직전, 인증을 남기는 트랜잭션 안에서 잡기로 했습니다. 하나라도 모자라면 409로 받지 않고 PG에 승인을 요청하지 않습니다.',
        '모자라면 인증 트랜잭션이 통째로 롤백됩니다. 포인트가 500원인 회원이 1000원을 쓰는 주문은 `INSUFFICIENT_POINT`를 받았고, 재고 5·쿠폰 `ISSUED` 그대로, PG 승인 요청 0, 결제는 `READY`였습니다.'
      ],
      note: '비용: 거절·결과 모름·만료 때 잡은 것을 돌려줘야 합니다(결정 4). PG 답을 기다리는 동안 재고가 묶이고, 결과 모름이면 보정이 닫을 때까지 묶입니다.',
      changed: [['~', '잡는 곳: 승인 답 기록 → 인증 기록'], ['+', '순서: 상품 번호 순 재고 → 쿠폰 → 포인트'], ['+', '409 `OUT_OF_STOCK`·`COUPON_NOT_AVAILABLE`·`INSUFFICIENT_POINT`']],
      hide: ['client2', 'sched'],
      metrics: [
        { label: '잡는 때', value: '승인 요청 직전' },
        { label: '모자라면', value: '409 · PG 요청 0', tone: 'good' }
      ],
      states: { hold: { badge: '재고 5 · 3000원 · ISSUED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pay', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { pay: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'hold', kind: 'write', label: 'PaymentHoldings.hold', mono: true, then: { hold: { badge: '재고 3 · 2000원 · USED', tone: 'warn', note: '같은 트랜잭션에서 잡음', noteTone: 'muted' } } },
        { at: 'server', then: { server: { badge: '커밋', tone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '그다음 승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } }
      ]
    },
    {
      short: '승인 뒤 잡기', tag: '비교', title: '비교. 승인 뒤에 잡으면 PG에 승인과 취소가 남는다',
      src: '결정 2. 재고·쿠폰·포인트를 언제 잡을까',
      body: [
        '승인 뒤 잡기는 계약 6개 중 3개가 실패했습니다. 재고 0개 상품의 주문도 PG에 승인을 요청했고, 승인된 뒤 취소됐습니다. 고객이 받는 답은 `OUT_OF_STOCK`으로 같지만 그 사이 PG에는 **승인 1건과 취소 1건**이 남았습니다.',
        '준비 때 잡기는 6개 중 1개가 실패했습니다. 준비만 하고 승인을 요청하지 않은 주문이 재고를 3에서 2로 줄였습니다.'
      ],
      note: '재고가 모자라는 일이 드물고 카드에 승인과 취소가 함께 남아도 괜찮다면 승인 뒤 잡기가 맞을 수 있습니다.',
      hide: ['client2', 'sched'],
      metrics: [
        { label: '승인 뒤 잡기', value: '6개 중 3개 실패', tone: 'bad' },
        { label: '준비 때 잡기', value: '6개 중 1개 실패', tone: 'bad' }
      ],
      states: { hold: { badge: '재고 0', tone: 'warn' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: '승인', tone: 'ok' } } },
        { from: 'server', to: 'hold', kind: 'fail', label: '재고 0이라 못 잡음', cut: true },
        { from: 'server', to: 'pg', kind: 'req', label: '전액 취소', then: { pg: { badge: '승인 1 · 취소 1', tone: 'bad', note: '고객 카드에 남음', noteTone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '409 OUT_OF_STOCK', mono: true }
      ]
    },
    {
      short: '조건부', tag: '결정', title: '결정 3. 재고를 조건부 UPDATE 한 문장으로 줄인다',
      src: '결정 3. 같은 상품에 몰린 주문의 재고를 어떻게 줄일까',
      body: [
        '이 장에서는 재고를 조건부 UPDATE 한 문장(`… where product_id = ? and quantity >= ?`)으로 줄이고, 바뀐 줄이 없으면 재고가 모자란 것으로 보기로 했습니다. 포인트 잔액도 같은 방법으로 씁니다.',
        '나중 주문의 UPDATE는 앞 주문의 커밋까지 기다린 뒤, 앞 주문이 줄인 수량으로 조건을 보고 0줄을 바꿨습니다(`OUT_OF_STOCK`). 5번 반복해 같은 결과였습니다.'
      ],
      note: '비용: 같은 상품의 주문이 재고 줄에서 차례로 기다립니다. 잠금은 인증 트랜잭션이 끝날 때까지 이어져, 쿠폰·포인트를 잡고 인증을 남기는 시간도 기다립니다.',
      changed: [['~', '재고·포인트: 읽고 쓰기 → 조건부 UPDATE'], ['+', '바뀐 줄 0이면 모자람']],
      hide: ['sched'],
      metrics: [
        { label: '잠그지 않음', value: '6개 중 5개 실패', tone: 'bad' },
        { label: '조건부 UPDATE', value: '6개 통과', tone: 'good' }
      ],
      states: { hold: { badge: '재고 1', tone: 'info' } },
      flows: [
        [
          { from: 'client', to: 'server', kind: 'req', label: 'A 승인 요청' },
          { from: 'client2', to: 'server', kind: 'req', label: 'B 승인 요청' }
        ],
        { from: 'server', to: 'hold', kind: 'write', label: 'A: 1줄 바꿈', then: { hold: { badge: '재고 0', tone: 'warn', note: 'A 커밋까지 잠금', noteTone: 'muted' } } },
        { from: 'server', to: 'hold', kind: 'fail', label: 'B: 기다린 뒤 0줄', slow: true },
        { from: 'server', to: 'client2', kind: 'fail', label: '409 OUT_OF_STOCK', mono: true },
        { from: 'server', to: 'pg', kind: 'req', label: 'A만 승인', then: { pg: { badge: '승인 1건', tone: 'ok' } } }
      ]
    },
    {
      short: '300건 측정', tag: '비교', title: '비교. 재고 100개에 300건, 네 방식의 측정',
      src: '결정 3. 같은 상품에 몰린 주문의 재고를 어떻게 줄일까',
      body: [
        '`select … for update`와 변경 번호 + 다시 시도도 계약 6개를 모두 통과했습니다. 그래서 재고 100개 상품에 승인 요청 300건을 한꺼번에 보내 쟀습니다. 변경 번호는 다시 시도가 **841~851번** 일어났고 응답 중앙값은 906~1327ms로 조건부 UPDATE의 두 배 정도였습니다.',
        '`select … for update`와의 차이는 보이지 않았습니다. 응답 중앙값 범위가 461~590ms와 437~629ms로 겹쳤습니다. 잠그지 않음은 300건이 모두 승인돼 과판매가 200이었습니다.'
      ],
      note: 'DB 연결은 HikariCP 기본 10개이고 Mock PG는 바로 답합니다. 이 두 조건이 결과의 모양을 정했을 수 있습니다.',
      metrics: [
        { label: '조건부 UPDATE', value: '461~590ms · 과판매 0', tone: 'good' },
        { label: 'for update', value: '437~629ms · 과판매 0', tone: 'good' },
        { label: '변경 번호', value: '906~1327ms', tone: 'warn' },
        { label: '잠그지 않음', value: '과판매 200', tone: 'bad' }
      ],
      hide: ['client2', 'sched'],
      states: { hold: { badge: '재고 100', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 300건 한꺼번에' },
        { from: 'server', to: 'hold', kind: 'write', label: 'version 어긋남', slow: true },
        { from: 'hold', to: 'server', kind: 'fail', label: '처음부터 다시', then: { hold: { badge: '다시 시도 841~851번', tone: 'warn' } } },
        { at: 'hold', then: { hold: { badge: '승인 100 · 재고 0', tone: 'ok', note: '조건부 UPDATE·for update·변경 번호', noteTone: 'muted' } } }
      ]
    },
    {
      short: '한 번 돌려줌', tag: '결정', title: '결정 4. 상태가 바뀌는 그 트랜잭션에서 한 번 돌려준다',
      src: '결정 4. 잡아 둔 것을 언제, 몇 번 돌려줄까',
      body: [
        '이 장에서는 잡아 둔 재고·포인트·쿠폰을 결제 상태가 승인 실패·만료·승인 취소·매입 취소로 바뀌는 그 트랜잭션에서 한 번 돌려주기로 했습니다. 결과 모름은 보정이 정할 때까지 쥔 채로 둡니다.',
        '기록들은 모두 7장의 결제 줄 잠금(`findByOrderIdForUpdate`) 안에서 결제를 읽습니다. 같은 거절을 겹쳐 닫아도 나중 기록은 이미 승인 실패가 된 결제를 읽어 `releasesHoldingsFrom`이 거짓이 되고, 상태를 바꾼 먼저 기록만 돌려줍니다.'
      ],
      note: '비용: 결과 모름 동안 재고·포인트·쿠폰이 묶이고, 포인트 이력 테이블(`point_history`)이 하나 늘어납니다. 부분 취소에서는 돌아오지 않습니다.',
      changed: [['+', '기록 다섯 곳이 `releaseIfClosed` 호출'], ['+', '`point_history` `(payment_id, type)` unique 키'], ['-', '결과 모름으로 가는 전이에서는 돌려주지 않음']],
      hide: ['client2'],
      metrics: [
        { label: '되돌리기 계약', value: '11개 통과', tone: 'good' },
        { label: '겹친 거절', value: '한 번만 돌아옴', tone: 'good' }
      ],
      states: { pay: { badge: 'AUTHENTICATED', tone: 'info' }, hold: { badge: '재고 3 · 2000원 · USED', tone: 'warn' } },
      focus: ['sched'],
      flows: [
        { from: 'pg', to: 'server', kind: 'res', label: '거절', then: { pg: { badge: '거절', tone: 'bad' } } },
        { from: 'server', to: 'pay', kind: 'write', label: 'APPROVAL_FAILED', mono: true, then: { pay: { badge: 'APPROVAL_FAILED', tone: 'bad' } } },
        { from: 'server', to: 'hold', kind: 'write', label: 'releaseIfClosed', mono: true, then: { hold: { badge: '재고 5 · 3000원 · ISSUED', tone: 'ok' } } },
        { from: 'sched', to: 'pay', kind: 'query', label: '줄 잠금 뒤 읽음' },
        { at: 'sched', then: { sched: { badge: '이미 APPROVAL_FAILED', tone: 'muted', note: '돌려주지 않음', noteTone: 'muted' } } }
      ]
    },
    {
      short: '곳마다 따로', tag: '비교', title: '비교. 실패를 기록하는 곳마다 따로 돌려주면',
      src: '결정 4. 잡아 둔 것을 언제, 몇 번 돌려줄까',
      body: [
        '곳마다 따로 되돌리는 비교는 기록이 상태를 바꿨는지 보지 않고, 결제가 끝난 상태면 돌려줍니다. 거절 답 기록·보정·알림 처리가 저마다 재고 2개씩을 돌려줘 **재고가 9(처음 5)**가 됐습니다. 포인트는 이력이 두 번째부터 막아 3000원이었습니다.',
        '이력까지 없으면 포인트도 5000원이 됐습니다. 이력 없이 잔액만 고친 비교는 계약을 모두 지켰습니다. 한 번만 돌려주는 것은 상태 전이와 결제 줄 잠금이 하는 일이고, 이력은 포인트만 지킵니다.'
      ],
      hide: ['client2'],
      metrics: [
        { label: '곳마다 따로', value: '11개 중 1개 실패', tone: 'bad' },
        { label: '곳마다 따로 + 이력 없이', value: '2개 실패', tone: 'bad' },
        { label: '이력 없이 잔액만', value: '11개 통과', tone: 'good' }
      ],
      states: { pay: { badge: 'APPROVAL_FAILED', tone: 'bad' }, hold: { badge: '재고 3 · 2000원', tone: 'warn' } },
      focus: ['sched'],
      flows: [
        { from: 'server', to: 'hold', kind: 'write', label: '거절 답 기록이 돌려줌', then: { hold: { badge: '재고 5 · 3000원', tone: 'ok' } } },
        { from: 'sched', to: 'hold', kind: 'write', label: '보정이 또 돌려줌', then: { hold: { badge: '재고 7 · 3000원', tone: 'warn' } } },
        { from: 'sched', to: 'hold', kind: 'write', label: '알림 처리도', then: { hold: { badge: '재고 9 · 3000원', tone: 'bad', note: '포인트는 이력이 막음', noteTone: 'muted', shake: true } } }
      ]
    },
    {
      short: '쿠폰', tag: '결정', title: '결정 5. 쿠폰은 ISSUED일 때만 USED로 바꾼다',
      src: '결정 5. 같은 쿠폰을 담은 두 주문을 어떻게 가릴까',
      body: [
        "이 장에서는 쿠폰을 조건부 UPDATE(`… where id = ? and status = 'ISSUED'`)로 쓰고, 바뀐 줄이 없으면 409 `COUPON_NOT_AVAILABLE`로 받지 않기로 했습니다.",
        '읽고 확인한 뒤 저장은 계약 3개 중 2개가 실패해 겹친 두 주문이 모두 승인됐습니다. 사용 기록 테이블(`coupon_usage`)도 3개를 모두 통과했지만, 쿠폰 줄이 `ISSUED` 그대로라 준비 때의 쿠폰 확인이 그 기록을 보지 않습니다.'
      ],
      note: '비용: 쿠폰을 쓴 이력이 쿠폰 줄의 지금 상태와 `payment_id` 하나로만 남습니다. 돌려주면 `payment_id`가 지워집니다.',
      changed: [["~", "쿠폰: 읽고 저장 → `status = 'ISSUED'` 조건부 UPDATE"]],
      hide: ['sched'],
      metrics: [
        { label: '조건부 UPDATE', value: '3개 통과', tone: 'good' },
        { label: '읽고 확인한 뒤 저장', value: '3개 중 2개 실패', tone: 'bad' }
      ],
      states: { hold: { badge: '쿠폰 ISSUED', tone: 'info' } },
      flows: [
        [
          { from: 'client', to: 'server', kind: 'req', label: 'A 같은 쿠폰' },
          { from: 'client2', to: 'server', kind: 'req', label: 'B 같은 쿠폰' }
        ],
        { from: 'server', to: 'hold', kind: 'write', label: 'A: ISSUED → USED', then: { hold: { badge: '쿠폰 USED', tone: 'warn' } } },
        { from: 'server', to: 'hold', kind: 'fail', label: 'B: 0줄', slow: true },
        { from: 'server', to: 'client2', kind: 'fail', label: '409 COUPON_NOT_AVAILABLE', mono: true }
      ]
    },
    {
      short: '테스트 결과', tag: '결과', title: '648개 통과, 출발에서 실패하던 21개도 통과',
      src: '테스트 결과',
      body: [
        '8장 완성 코드에서 전체 테스트는 7장의 561개에서 **648개**가 되었고 모두 통과했습니다. 출발 코드에서 실패하던 21개가 모두 통과했고, 라인 커버리지는 97.2%였습니다.',
        '되돌리기 계약 11개 가운데 겹쳐 닫는 두 계약을 뺀 9개는 네 구현 모두 통과했습니다. 한 기록만 결제를 닫는 경우에는 어디서 되돌려도 결과가 같았습니다.'
      ],
      note: '계약을 지키지 못하는 비교는 `./gradlew knownFailingTest`로 돌렸고, 8장 비교는 47개 중 16개가 실패했습니다.',
      hide: ['client2'],
      metrics: [
        { label: '전체 테스트', value: '648개 통과', tone: 'good' },
        { label: '출발 실패', value: '21개 모두 통과', tone: 'good' },
        { label: '과판매', value: '0', tone: 'good' },
        { label: '라인 커버리지', value: '97.2%' }
      ],
      states: { hold: { badge: '재고 5 · 3000원 · ISSUED', tone: 'info' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '서버가 17000원' },
        { from: 'server', to: 'hold', kind: 'write', label: '인증 때 조건부로 잡음', then: { hold: { badge: '재고 3 · 2000원 · USED', tone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '거절', then: { pg: { badge: '거절', tone: 'bad' } } },
        { from: 'server', to: 'hold', kind: 'write', label: '한 번 돌려줌', then: { hold: { badge: '재고 5 · 3000원 · ISSUED', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '인증 트랜잭션이 여러 줄을 잠근다',
      src: '남은 한계',
      body: [
        '인증 트랜잭션이 결제 줄 하나가 아니라 결제·재고·쿠폰·포인트 여러 줄을 잠그게 되었습니다. 재고는 상품 번호 순으로 잡도록 했을 뿐 **교착 상태는 시험하지 않았습니다**.',
        '`memberId`는 고객이 보낸 값을 믿고, 우리 쪽 결제를 `EXPIRED`로 만드는 길이 없습니다. 재고나 포인트가 다른 서비스로 나뉘는 경우는 9장으로 넘깁니다.'
      ],
      note: '조건부 UPDATE를 `select … for update`보다 앞에 둔 이유를 이번 측정은 뒷받침하지 않았습니다. 대기는 300건까지만 재었습니다.',
      hide: ['client2', 'sched'],
      metrics: [
        { label: '잠그는 줄', value: '결제 + 재고·쿠폰·포인트', tone: 'warn' },
        { label: '교착 상태', value: '시험 안 함', tone: 'warn' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pay', kind: 'write', label: '결제 줄 잠금', then: { pay: { badge: '잠금', tone: 'warn' } } },
        { from: 'server', to: 'hold', kind: 'write', label: '재고·쿠폰·포인트 줄', then: { hold: { badge: '커밋까지 잠금', tone: 'warn', note: '교착 상태는 시험 안 함', noteTone: 'warn' } } }
      ]
    }
  ]
};
