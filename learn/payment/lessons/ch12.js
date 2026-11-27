// 12장 대사와 장애 대응 — content/payment-reconciliation-resilience/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[12] = {
  slug: 'payment-reconciliation-resilience',
  branch: 'chapter-12',
  title: '대사와 장애 대응',
  goal: '카드사 거래 내역으로 하루치 결제를 맞추고, 상태 이력과 승인 차단기, 운영 지표와 정리를 둡니다.',
  learn: [
    { text: '카드사에서만 취소된 결제가 승인으로 남는 이유', step: 1 },
    { text: '`GET /v1/transactions`로 하는 하루치 대사', step: 4 },
    { text: '거래 내역 대사와 결제마다 조회의 차이', step: 5 },
    { text: '뒤처진 결제만 따라가고 나머지는 운영자 확인', step: 6 },
    { text: '상태를 바꾼 트랜잭션에서 남기는 이력', step: 7 },
    { text: '승인 요청 앞의 차단기와 503', step: 8 },
    { text: '운영 지표와 보존 기간 정리', step: 11 },
    { text: '1장부터 12장까지 쌓인 것', step: 14 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'confirm()', subMono: true, x: 345, y: 300 },
    { id: 'ops', kind: 'ops', label: '운영 지표', sub: 'Micrometer', x: 345, y: 120, absent: '12장에서 만듦' },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: '카드사', x: 640, y: 120 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: '결제·이력·대사 결과', x: 640, y: 462 },
    { id: 'sched', kind: 'scheduler', label: '매일 작업', sub: '대사 · 정리', x: 905, y: 300, absent: '12장에서 만듦' }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db'], ['server', 'ops'], ['sched', 'pg'], ['sched', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '승인은 시간 제한만 거치고, 맞추기는 4·5·6장뿐이다',
      src: '현재 구조: 보정·알림 처리만 있고, 승인은 시간 제한만 두는 결제 서버',
      body: [
        '출발 코드(`ch12-start`)의 운영 코드는 11장 그대로입니다. 결제 서버가 가진 맞추기는 4장 보정, 5장 취소 보정, 6장 받은 알림 처리뿐이고, 상태 이력·대사 결과·운영 지표는 없습니다. 보낸 결과와 받은 기록을 지우는 일도 없습니다.',
        '카드사 승인 요청은 2장의 시간 제한(연결 1초·읽기 5초)만 거칩니다. 답을 받지 못하면 `PaymentGatewayNoResponseException`이 되고, 그 결제는 결과 모름(`APPROVAL_UNKNOWN`)으로 남습니다.'
      ],
      note: '이 글의 카드사는 이 연재에서 PG(Mock PG)를 가리킵니다.',
      hide: ['sched', 'ops'],
      metrics: [
        { label: '읽기 시간 제한', value: '5초' },
        { label: '12장 계약', value: '41개 중 30개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '승인됨', then: { pg: { badge: 'DONE', tone: 'ok' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '승인 결과' }
      ]
    },
    {
      short: '카드사 취소', tag: '문제', title: '카드사에서만 취소된 결제가 승인으로 남는다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '가맹점 관리 화면에서 카드사만 결제를 취소하고(`cancelAtCardCompany`), 그 알림은 처음 전송과 재전송 7번이 모두 닿지 않게 했습니다. 4장 보정, 5장 취소 보정, 6장 알림 처리를 모두 돌려도 전액 취소된 결제는 `APPROVED`였습니다(기대 `APPROVAL_CANCELED`).',
        '부분 취소된 결제의 남은 금액은 **15000원**이었습니다(카드사 10000원). 4장 보정은 결과 모름·인증 상태만 보고 6장은 받은 알림만 보는데, 이 결제는 승인 상태이고 알림이 하나도 닿지 않았습니다.'
      ],
      note: '알림은 받는 곳이 없는 주소(`http://localhost:1/…`)로 보내 닿지 않게 만듭니다.',
      hide: ['sched', 'ops'],
      metrics: [
        { label: '대사 계약', value: '13개 중 9개 실패', tone: 'bad' },
        { label: '남은 금액', value: '15000원 · 카드사 10000원', tone: 'bad' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'DONE', tone: 'ok' } },
      flows: [
        { at: 'pg', then: { pg: { badge: 'CANCELED', tone: 'bad', note: '가맹점 관리 화면 취소', noteTone: 'warn' } } },
        { from: 'pg', to: 'server', kind: 'event', label: '알림 닿지 않음', cut: true },
        { at: 'server', then: { server: { badge: '4·5·6장 맞추기', tone: 'muted', note: '모두 돌려도 그대로', noteTone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'APPROVED', tone: 'bad', note: '기대 APPROVAL_CANCELED', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '남길 곳', tag: '문제', title: '어긋남도, 이력도, 지표도 남길 곳이 없다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '금액이 다른 결제, 우리에게만 있는 결제, 카드사에만 있는 결제, 우리 쪽만 취소된 결제 모두 대사 결과가 0줄이었습니다. 이력 계약은 9개 중 8개가 실패해, 결제가 언제 어떤 길로 지금 상태가 됐는지 되짚을 곳이 없습니다.',
        '운영 신호 계약에서는 지표 6개가 값이 없어 실패했고, 보존 기간이 지난 보낸 결과·받은 기록·처리한 명령을 지우는 계약 3개가 실패했습니다. 통과한 11개는 고치지 않음·남지 않음·지우지 않음·막지 않음 쪽 계약이라 출발 코드에서도 맞았습니다.'
      ],
      hide: ['sched', 'ops'],
      metrics: [
        { label: '상태 이력 계약', value: '9개 중 8개 실패', tone: 'bad' },
        { label: '운영 신호 계약', value: '13개 중 9개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'server', to: 'db', kind: 'query', label: '대사 결과·이력' },
        { from: 'db', to: 'server', kind: 'res', label: '0줄' },
        { at: 'db', then: { db: { badge: '남길 곳 없음', tone: 'bad', note: '보낸 결과·받은 기록도 쌓임', noteTone: 'warn' } } }
      ]
    },
    {
      short: '장애 대기', tag: '문제', title: '카드사 장애 동안 승인이 시간 제한까지 기다린다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '카드사가 답하지 않는 승인이 기준 횟수만큼 쌓인 뒤에도 다음 승인을 카드사에 보냈고(기대 0번, 실제 1번), 그 승인은 계약의 읽기 시간 제한 1초를 기다린 뒤(**1.02초**) 결과 모름으로 남았습니다.',
        '장애 동안 DB 연결도 붙잡는지 봤는데, 재현되지 않았습니다. 2장에서 승인 요청을 트랜잭션 밖으로 뺐기 때문입니다. 운영 읽기 시간 제한 5초로 잰 측정에서는 승인 응답이 중앙 5036~5040ms였고, 60건이 모두 결과 모름이었습니다.'
      ],
      note: '카드사 장애는 Mock PG가 승인 요청을 받고 답하지 않다가 아무것도 남기지 않는 방식(LOST)으로 만들었습니다.',
      hide: ['sched', 'ops'],
      metrics: [
        { label: '기준 뒤 카드사로', value: '1번 보냄', tone: 'bad' },
        { label: '기다린 시간(계약)', value: '1.02초', tone: 'bad' },
        { label: '카드사 장애 계약', value: '6개 중 4개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 안에 답 없음', cut: true, slow: true, then: { pg: { badge: 'LOST', tone: 'bad' } } },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVAL_UNKNOWN', mono: true, then: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '답 없음' }
      ]
    },
    {
      short: '거래 대사', tag: '결정', title: '결정 1. 하루치 거래 내역을 읽어 결제 키로 맞춘다',
      src: '결정 1. 카드사 기록과 우리 결제를 무엇으로 맞춰 볼까',
      body: [
        '이 장에서는 하루치 카드사 거래 내역을 모두 읽어 결제 키로 묶고, 우리 결제와 결제 키로 맞춰 본 뒤 어긋난 결제를 대사 결과 표(`reconciliation_result`)에 남기기로 했습니다.',
        '대사는 작업 잠금(`payment-daily-reconciliation`)을 맡은 서버 한 대만 매일 4시(Asia/Seoul)에 어제를 돕니다. `GET /v1/transactions`로 그날 0시부터 23:59:59까지를 **5000건씩** 묻고, 어긋남은 `STATUS_BEHIND`·`STATUS_MISMATCH`·`AMOUNT_MISMATCH`·`OURS_ONLY`·`PG_ONLY` 다섯 종류로 나눕니다.'
      ],
      note: '비용: 거래 상태의 뜻, 취소 거래의 금액, 거절·만료 거래, 날짜의 시간대와 끝 초는 문서로 확인하지 못한 가정이고, 대사 시각 4시도 가정입니다. 대사는 하루에 한 번이라 알림이 닿지 않은 카드사 쪽 취소는 다음 날 4시 대사 전까지 승인으로 남습니다.',
      changed: [['+', '`GET /v1/transactions` 거래 조회, 읽기 시간 제한 60초'], ['+', '대사 결과 표 `reconciliation_result`'], ['+', '`insert … on duplicate key update`로 같은 날을 다시 돌려도 한 줄']],
      hide: ['ops'],
      focus: ['sched'],
      metrics: [
        { label: '대사', value: '매일 4시' },
        { label: '거래 조회', value: '5000건씩' },
        { label: '대사 계약', value: '13개 통과', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'ok' }, pg: { badge: 'CANCELED', tone: 'bad' } },
      flows: [
        { from: 'sched', to: 'pg', kind: 'query', label: 'GET /v1/transactions', mono: true },
        { from: 'pg', to: 'sched', kind: 'res', label: '5000건씩 쪽마다' },
        { from: 'sched', to: 'db', kind: 'query', label: '그날 인증한 결제' },
        { at: 'sched', then: { sched: { badge: '결제 키로 견줌', tone: 'info' } } },
        { from: 'sched', to: 'db', kind: 'write', label: '대사 결과 한 줄', then: { db: { badge: 'STATUS_BEHIND', tone: 'warn', note: '(날짜, 결제 키, 종류)마다 한 줄', noteTone: 'muted' } } }
      ]
    },
    {
      short: '대사 시간', tag: '비교', title: '비교. 결제마다 카드사 단건 조회',
      src: '카드사 장애와 대사의 측정',
      body: [
        '결제마다 단건 조회하는 비교는 그날 인증한 우리 결제마다 카드사 결제를 조회해 6장 따라가기를 돌립니다. 카드사에서만 취소된 결제는 운영 구현과 같이 모두 맞췄지만, 금액 다름·카드사에만·우리 쪽만 취소를 남기지 못해 대사 계약 13개 중 4개가 실패했습니다.',
        '측정(두 번 실행)에서 결제 1천 건은 운영 306~434ms, 결제마다 조회 4783~4984ms였습니다. 1만 건은 운영 **995~1033ms**(거래 조회 3번, 결제 조회 100번), 결제마다 조회 **35263~36130ms**(결제 조회 1만 번)였습니다.'
      ],
      note: '측정은 우리 결제 N건과 카드사 결제 N건을 만들고 1%를 카드사에서만 전액 취소한 뒤(알림 끔) 대사를 한 번 부른 시간입니다. 두 방식 모두 카드사에서만 취소된 10건·100건을 모두 맞췄습니다.',
      hide: ['ops'],
      focus: ['sched'],
      metrics: [
        { label: '1만 건 · 거래 내역', value: '995~1033ms', tone: 'good' },
        { label: '1만 건 · 결제마다', value: '35263~36130ms', tone: 'bad' },
        { label: '결제마다 계약', value: '13개 중 4개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'sched', to: 'db', kind: 'query', label: '그날 인증한 결제' },
        { from: 'sched', to: 'pg', kind: 'query', label: '결제마다 조회', slow: true },
        { from: 'pg', to: 'sched', kind: 'res', label: '카드사 결제' },
        { at: 'sched', then: { sched: { badge: '조회 1만 번', tone: 'bad', note: '카드사에만 있는 결제는 못 찾음', noteTone: 'bad' } } }
      ]
    },
    {
      short: '뒤처짐만', tag: '결정', title: '결정 2. 뒤처진 결제만 따라가고 나머지는 운영자 확인',
      src: '결정 2. 대사가 찾은 어긋남을 어디까지 고칠까',
      body: [
        '이 장에서는 우리 기록이 카드사보다 뒤처진 결제만 6장 따라가기로 고치고, 금액이 다르거나 한쪽에만 있거나 우리가 앞선 결제는 고치지 않고 운영자 확인으로 남기기로 했습니다.',
        '뒤처진 결제는 거래 내역 값을 그대로 쓰지 않고 카드사에 다시 조회해, 6장 웹훅과 같은 `PaymentWebhookRecorder.follow`로 따라갑니다. 대사 결과는 `FOLLOWED`, 나머지는 `NEEDS_REVIEW`입니다. 기록만 하는 비교는 3개, 모두 카드사에 맞추는 비교는 7개가 실패했습니다.'
      ],
      note: '비용: 운영자 확인으로 남은 줄을 닫는 길(API·명령)은 만들지 않았습니다. 뒤처진 결제마다 카드사 조회가 한 번씩 생겨, 측정에서 1천 건 중 10건, 1만 건 중 100건이 뒤처졌고 조회도 10번·100번이었습니다.',
      changed: [['+', '`FollowBehindResolver`'], ['+', '계기 `DAILY_RECONCILIATION`'], ['~', '우리 금액·한쪽에만 있는 결제는 고치지 않음']],
      hide: ['ops'],
      focus: ['sched'],
      metrics: [
        { label: '고치는 어긋남', value: 'STATUS_BEHIND만' },
        { label: '부분 취소 남은 금액', value: '10000원', tone: 'good' }
      ],
      states: { db: { badge: 'APPROVED', tone: 'warn', note: 'STATUS_BEHIND', noteTone: 'warn' }, pg: { badge: 'CANCELED', tone: 'ok' } },
      flows: [
        { from: 'sched', to: 'pg', kind: 'query', label: '카드사에 다시 조회' },
        { from: 'pg', to: 'sched', kind: 'res', label: 'CANCELED', mono: true },
        { from: 'sched', to: 'db', kind: 'write', label: 'follow', mono: true, then: { db: { badge: 'APPROVAL_CANCELED', tone: 'ok', note: '' } } },
        { at: 'sched', then: { sched: { badge: 'FOLLOWED', tone: 'ok', note: '금액 다름은 NEEDS_REVIEW', noteTone: 'warn' } } }
      ]
    },
    {
      short: '상태 이력', tag: '결정', title: '결정 3. 상태를 바꾼 트랜잭션에서 이력을 한 줄씩 남긴다',
      src: '결정 3. 상태 변경 이력을 어디에 남길까',
      body: [
        '이 장에서는 결제 상태가 바뀔 때마다 그 트랜잭션에서 `payment_status_history`에 이전 상태·다음 상태·행위·계기·바뀐 때를 한 줄씩 남기기로 했습니다. 상태가 롤백되면 이력도 남지 않습니다.',
        '계기는 `CONFIRM`·`APPROVAL_RECONCILIATION`·`WEBHOOK`·`CANCEL`·`CANCEL_RECONCILIATION`·`DAILY_RECONCILIATION` 여섯 가지입니다. 9장 결제 결과 기록(`payment_outbox`)으로 대신하는 비교는 `null -> APPROVED` 한 줄만 남아 9개 중 7개가 실패했습니다.'
      ],
      note: '비용: 상태 전이마다 한 줄이 쌓이고, 이력을 지우는 코드는 없습니다. 12장 이전에 만든 결제에는 이력이 없습니다.',
      changed: [['+', '`payment_status_history`'], ['~', '결제를 바꾸는 기록 셋이 9장 결제 결과 기록과 같은 자리에서 이력을 남김']],
      hide: ['ops'],
      metrics: [
        { label: '상태 이력 계약', value: '9개 통과', tone: 'good' },
        { label: 'outbox로 대신', value: '9개 중 7개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: '인증 + 이력 CONFIRM', then: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '이력 1줄', noteTone: 'muted' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '답 없음', cut: true },
        { from: 'server', to: 'db', kind: 'write', label: '결과 모름 + 이력', then: { db: { badge: 'APPROVAL_UNKNOWN', tone: 'warn', note: '이력 2줄', noteTone: 'muted' } } },
        { from: 'server', to: 'db', kind: 'write', label: '보정 승인 + 이력', then: { db: { badge: 'APPROVED', tone: 'ok', note: '이력 3줄', noteTone: 'muted' } } }
      ]
    },
    {
      short: '차단기', tag: '결정', title: '결정 4. 승인 요청 앞에 차단기를 둔다',
      src: '결정 4. 카드사 장애 동안 승인 요청을 어떻게 할까',
      body: [
        '이 장에서는 카드사 승인 요청에 Resilience4j 서킷 브레이커(이하 차단기)를 두어, 답 없음·카드사 오류가 기준을 넘으면 정한 시간 동안 승인을 요청하지 않고 바로 실패시키기로 했습니다.',
        '열려 있으면 카드사에 보내지 않고 `PaymentGatewayUnavailableException`(**503**, `PAYMENT_GATEWAY_UNAVAILABLE`)을 던지고, `recordApprovalNotRequested`가 결제를 승인 없이 닫고 잡아 둔 재고·쿠폰·포인트를 돌려줍니다. 카드사에 보내지 않았으니 결과 모름이 생기지 않습니다.'
      ],
      note: '비용: 운영 값(최근 20번 중 50%, 최소 10번, 열린 시간 30초)은 운영 기준이 없어 둔 가정입니다. 차단기는 승인에만 두고 취소·조회·보정·대사는 거치지 않으며, 열린 동안에도 재고는 잡았다가 돌려줍니다. 거절(4xx)은 성공으로 셉니다.',
      changed: [['+', '`resilience4j-circuitbreaker` 2.4.0'], ['+', '503 `PAYMENT_GATEWAY_UNAVAILABLE`'], ['~', '시험은 `payment.pg.circuit-breaker.enabled=false`']],
      hide: ['ops'],
      metrics: [
        { label: '차단기', value: 'OPEN', tone: 'bad' },
        { label: '응답', value: '503', tone: 'warn' },
        { label: '카드사 장애 계약', value: '6개 통과', tone: 'good' }
      ],
      states: { pg: { badge: '답 없음', tone: 'bad' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { at: 'server', then: { server: { badge: 'OPEN', tone: 'bad', note: '실패가 기준을 넘음', noteTone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'fail', label: '보내지 않음', cut: true },
        { from: 'server', to: 'db', kind: 'write', label: '승인 없이 닫음', then: { db: { badge: '결과 모름 아님', tone: 'ok', note: '재고·쿠폰·포인트 돌려줌', noteTone: 'muted' } } },
        { from: 'server', to: 'client', kind: 'fail', label: '503', mono: true }
      ]
    },
    {
      short: '장애 측정', tag: '비교', title: '비교. 장애 15초 동안 고객 20명이 승인을 요청하면',
      src: '카드사 장애와 대사의 측정',
      body: [
        '장애 15초 동안 고객 20명이 쉬지 않고 승인을 요청했습니다(두 번 실행). 시간 제한만은 승인 60건이 모두 5초를 기다리고(중앙 5036~5040ms) 모두 결과 모름이 됐습니다. 다시 시도는 20건이 한 건에 15초씩 걸려 모두 결과 모름이었고, 카드사는 같은 결제의 승인을 세 번씩, 모두 60번 받았습니다.',
        '차단기는 처음 20건만 결과 모름이 되고, 나머지 3600여 건은 승인 요청 없이 바로 실패했습니다. 처음 20건을 포함한 **승인 요청 전체(3710건·3643건)의 응답 중앙값이 33ms**였습니다.'
      ],
      note: '처음 20건은 최소 10번이 차기 전에 이미 보낸 요청이라 읽기 시간 제한 5초를 기다렸습니다. 승인 실패는 3690건·3623건이었고, 고객은 결제를 다시 해야 합니다. 계약에서는 시간 제한만과 다시 시도가 각각 6개 중 4개 실패했습니다.',
      hide: ['ops'],
      metrics: [
        { label: '결과 모름 · 시간 제한만', value: '60건', tone: 'bad' },
        { label: '카드사 요청 · 다시 시도', value: '60번', tone: 'bad' },
        { label: '결과 모름 · 차단기', value: '20건', tone: 'warn' },
        { label: '응답 중앙 · 차단기 전체', value: '33ms', tone: 'good' }
      ],
      states: { pg: { badge: 'LOST', tone: 'bad' } },
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '처음 20건' },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '5초 답 없음', cut: true, slow: true },
        { at: 'server', then: { server: { badge: 'OPEN', tone: 'bad' } } },
        { from: 'client', to: 'server', kind: 'req', label: '다음 승인' },
        { from: 'server', to: 'pg', kind: 'fail', label: '보내지 않음', cut: true },
        { from: 'server', to: 'client', kind: 'fail', label: '503 바로 실패' }
      ]
    },
    {
      short: '운영 지표', tag: '결정', title: '결정 5. 밀리고 쌓이는 것을 지표로 낸다',
      src: '결정 5. 밀리고 쌓이는 것을 어떻게 보고, 언제 지울까',
      body: [
        '이 장에서는 실패 모음 수·릴레이 밀림·대사 어긋남·차단기 상태를 Micrometer 지표로 내고, 보존 기간이 지난 보낸 `payment_outbox` 줄과 받은 기록·처리한 명령을 매일 지우기로 했습니다.',
        '지표 여섯 개는 모두 게이지라 읽을 때마다 DB 집계 한 문장이나 브로커 조회로 값을 새로 셉니다. 결제 서버는 `payment.outbox.unsent`·`payment.outbox.oldest-unsent-age`·`payment.reconciliation.open-mismatches`·`payment.pg.circuit.state`를, 주문·재고 서비스는 `order.dead-letter.pending`·`inventory.dead-letter.pending`을 냅니다.'
      ],
      note: '비용: 지표를 읽을 때마다 DB 집계나 브로커 조회가 생깁니다. 주문 서비스는 웹 서버가 없어 지표를 밖에서 볼 수 없고, Prometheus 같은 수집기는 붙이지 않았습니다.',
      changed: [['+', '`management.endpoints.web.exposure.include=health,metrics`'], ['+', '게이지 6개']],
      focus: ['ops'],
      metrics: [
        { label: '지표', value: '게이지 6개' },
        { label: '지표 없음 비교', value: '13개 중 6개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'ops', to: 'server', kind: 'query', label: '/actuator/metrics', mono: true },
        { from: 'server', to: 'db', kind: 'query', label: '집계 한 문장' },
        { from: 'server', to: 'ops', kind: 'res', label: 'outbox.unsent', mono: true, then: { ops: { badge: '릴레이 밀림', tone: 'info' } } },
        { from: 'ops', to: 'server', kind: 'query', label: 'circuit.state', mono: true },
        { from: 'server', to: 'ops', kind: 'res', label: '0 닫힘 · 1 열림', then: { ops: { badge: '차단기 상태', tone: 'info' } } }
      ]
    },
    {
      short: '정리', tag: '결정', title: '결정 5. 보존 기간이 지난 줄을 매일 지운다',
      src: '결정 5. 밀리고 쌓이는 것을 어떻게 보고, 언제 지울까',
      body: [
        '이 장에서는 정리를 매일 4시 30분에 돌리기로 했습니다. 결제 서버는 7일 전에 보낸 `payment_outbox` 줄을 지우고 보내지 않은 줄은 지우지 않습니다. 주문 서비스는 14일 전에 받은 `received_payment_event`, 재고 서비스는 14일 전에 처리한 `processed_stock_command`를 지웁니다.',
        '한 문장으로 오래 잠그지 않도록 `delete … order by id limit 1000`을 되풀이합니다. 지운 뒤 같은 메시지가 다시 와도 11장 결정 2(마지막으로 반영한 번호)가 주문과 예약을 바꾸지 않습니다. 지우지 않음 비교는 정리 계약 3개가 실패했습니다.'
      ],
      note: '가정: 보낸 결과 7일은 Kafka 문서의 `log.retention.hours` 기본값 168시간(7일)에 맞춘 가정이고, 받은 기록·처리한 명령의 14일은 그 두 배로 둔 가정입니다. 운영 기준은 없습니다.',
      changed: [['+', '작업 잠금 `payment-outbox-cleanup`'], ['-', '보낸 지 7일 지난 `payment_outbox` 줄']],
      focus: ['sched'],
      metrics: [
        { label: '보낸 outbox', value: '7일 · 가정', tone: 'warn' },
        { label: '받은 기록·처리한 명령', value: '14일 · 가정', tone: 'warn' },
        { label: '운영 신호 계약', value: '13개 통과', tone: 'good' }
      ],
      flows: [
        { at: 'sched', then: { sched: { badge: '4시 30분 정리', tone: 'info' } } },
        { from: 'sched', to: 'db', kind: 'write', label: '보낸 지 7일 지난 줄' },
        { at: 'db', then: { db: { badge: '1000건씩 지움', tone: 'info', note: '보내지 않은 줄은 남김', noteTone: 'muted' } } }
      ]
    },
    {
      short: '테스트', tag: '결과', title: '출발 코드에서 실패하던 30개가 모두 통과했다',
      src: '테스트 결과',
      body: [
        '12장 완성 코드의 `./gradlew clean check`는 **825개 모두 통과**했습니다. 출발 코드에서 실패하던 30개가 모두 통과했고, 12장 운영 계약 41개를 포함해 11장의 761개에서 64개가 늘었습니다.',
        '계약 네 묶음에서 운영 구현은 모두 0개 실패였습니다. 비교는 결제마다 단건 조회 4개, 기록만 3개, 모두 카드사에 맞춤 7개, 결제 결과 기록으로 대신함 7개, 시간 제한만·다시 시도 각 4개, 지표 없음 6개, 지우지 않음 3개가 실패했습니다.'
      ],
      note: '같은 코드의 첫 `clean check`에서는 결제 API·결제 취소 API 33개가 모든 요청에 404를 받아 실패했고, 다시 돌린 실행에서는 재현되지 않았습니다. 원인은 찾지 못했습니다.',
      metrics: [
        { label: '전체 테스트', value: '825개 통과', tone: 'good' },
        { label: '12장 계약', value: '41개 통과', tone: 'good' },
        { label: '라인 커버리지', value: '96.8%', tone: 'good' }
      ],
      flows: [
        [
          { from: 'sched', to: 'pg', kind: 'query', label: '거래 내역' },
          { from: 'ops', to: 'server', kind: 'query', label: '지표 읽기' }
        ],
        { from: 'server', to: 'db', kind: 'write', label: '상태 + 이력', then: { db: { badge: '어긋남 남김', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '운영자가 확인할 대사 어긋남을 닫는 길(API·명령)이 없어, 사람이 본 뒤에도 그 줄은 그대로 남습니다. 매입 흐름도 없습니다. 운영 코드에 `capture()`를 부르는 흐름이 없고, 이 장에서도 만들지 않았습니다.',
        '차단기 기준값(최근 20번 중 50%, 최소 10번, 30초)과 보존 기간(보낸 `payment_outbox` 7일, 받은 기록·처리한 명령 14일)은 운영 기준 없이 둔 가정입니다. 실패 모음의 수는 지표로 보이지만, 다시 넣기는 여전히 운영자가 명령을 돌려야 합니다.'
      ],
      note: '비정상 종료 뒤 MySQL이 지운 `payment_outbox` 번호를 다시 쓸 수 있다고 문서에 적혀 있고, 그때 받는 쪽이 새 메시지를 버릴 수 있습니다. 재현하지 않았습니다.',
      metrics: [
        { label: '운영자 확인 줄', value: '닫는 길 없음', tone: 'warn' },
        { label: '기준값·보존 기간', value: '가정', tone: 'warn' }
      ],
      states: { db: { badge: 'NEEDS_REVIEW', tone: 'warn', note: '닫는 길 없음', noteTone: 'warn' } },
      flows: [
        { from: 'ops', to: 'server', kind: 'query', label: '대사 어긋남 수' },
        { from: 'server', to: 'db', kind: 'query', label: 'NEEDS_REVIEW', mono: true },
        { from: 'server', to: 'ops', kind: 'res', label: '그대로 남음', then: { ops: { badge: '사람이 확인', tone: 'warn' } } }
      ]
    },
    {
      short: '연재 마침', tag: '정리', title: '1장부터 12장까지 쌓인 것',
      src: '연재를 마치며',
      body: [
        '11장까지 결제 서버가 카드사와 결제를 맞추는 길은 세 가지였습니다. 결과 모름·인증 상태는 4장 보정이 카드사에 조회해 닫고, 결과를 기다리는 취소는 5장 취소 보정이 맞추고, 받은 알림은 6장이 신호로 삼아 카드사 결제를 다시 읽어 따라갑니다. 12장은 여기에 하루치 대사, 상태 이력, 승인 차단기, 운영 지표와 정리를 더했습니다.',
        '이번 글로 결제 시스템 챌린지 연재를 마칩니다. 다음 장은 없습니다. 해결하지 못한 것은 남은 한계에 모아 두었고, 매입 흐름, 운영자가 확인한 대사 어긋남을 닫는 길, 차단기 기준값과 보존 기간의 운영 기준이 그 가운데 남아 있습니다.'
      ],
      note: '1장이 남긴 "상태가 언제 어떻게 바뀌었는지 이력이 남지 않습니다"는 결정 3으로, 9장·10장·11장이 남긴 보낸 `payment_outbox` 줄 문제는 결정 5로 닫았습니다. 1장의 매입 상태 질문에는 "이 대사에는 매입 상태가 필요하지 않았습니다"로 답했습니다.',
      metrics: [
        { label: '연재', value: '12장으로 마침', tone: 'good' },
        { label: '남은 것', value: '매입 · 어긋남 닫기 · 운영 기준', tone: 'warn' }
      ],
      flows: [
        [
          { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
          { from: 'sched', to: 'pg', kind: 'query', label: '하루치 대사' },
          { from: 'ops', to: 'server', kind: 'query', label: '운영 지표' }
        ],
        { from: 'server', to: 'pg', kind: 'req', label: '차단기를 거쳐 승인' },
        { from: 'server', to: 'db', kind: 'write', label: '상태 + 이력', then: { db: { badge: 'APPROVED', tone: 'ok', note: '이력이 남음', noteTone: 'muted' } } }
      ]
    }
  ]
};
