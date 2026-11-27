// 2장 가장 단순한 결제 구현과 트랜잭션 경계 — content/payment-transaction-boundary/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[2] = {
  slug: 'payment-transaction-boundary',
  branch: 'chapter-02',
  title: '가장 단순한 결제 구현과 트랜잭션 경계',
  goal: 'PG 승인 호출을 트랜잭션 밖으로 빼고, 거절을 결과로 기록하며, PG를 기다리는 동안 DB 연결을 놓게 합니다.',
  learn: [
    { text: 'PG 호출을 감싼 트랜잭션이 연결을 쥐는 이유', step: 2 },
    { text: '트랜잭션을 나누는 법과 같은 클래스 호출 함정', step: 6 },
    { text: '거절을 예외 대신 결과로 기록하기', step: 7 },
    { text: 'Open Session In View와 연결 반납', step: 9 },
    { text: '시간 제한과 결과를 모르는 결제', step: 10 },
    { text: '241개 테스트·k6 측정과 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'client', kind: 'client', label: '클라이언트', sub: '승인·조회 요청', x: 95, y: 300 },
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'confirm()', subMono: true, x: 345, y: 300 },
    { id: 'pg', kind: 'pg', label: 'Mock PG', sub: 'mock-pg 모듈', x: 640, y: 120 },
    { id: 'db', kind: 'db', label: 'MySQL', sub: 'Hikari 연결', x: 640, y: 462 }
  ],
  edges: [['client', 'server'], ['server', 'pg'], ['server', 'db']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '인증 기록, PG 호출, 결과 기록을 트랜잭션 하나로 묶었다',
      src: '현재 구조: 트랜잭션 하나로 묶은 승인 API',
      body: [
        '승인 API(`POST /api/v1/payments/{orderId}/confirm`)는 결제를 읽어 인증을 기록하고, PG에 승인을 요청하고, 결과를 기록하는 일을 `@Transactional` 하나로 묶었습니다. 거절이면 승인 거절로 바꾸고 예외를 던집니다.',
        'PG가 2xx로 답하면 승인, 4xx면 거절로 읽고, 그 밖의 상태 코드는 `PaymentGatewayFailedException`(502)으로, 입출력 실패는 `PaymentGatewayNoResponseException`으로 바꿉니다. Mock PG는 실제 HTTP로 답하는 별도 모듈입니다.'
      ],
      metrics: [
        { label: '트랜잭션', value: '하나' },
        { label: '출발 코드 테스트', value: '13개 중 6개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '커밋 전, 연결을 쥔 채', noteTone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '200 승인' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '커밋', noteTone: 'muted' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '거절 사라짐', tag: '문제', title: '거절을 예외로 알리면 거절 기록이 롤백된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '거절이면 `failApproval()`로 승인 거절 상태로 바꾼 뒤 예외를 던지는데, 그 예외 때문에 트랜잭션이 롤백되면서 승인 거절 기록과 그 앞의 인증 기록까지 함께 사라집니다.',
        '그래서 결제는 `APPROVAL_FAILED`가 아니라 처음 상태인 `READY`로 남았습니다. API는 전역 예외 처리기를 거쳐 **422**로 거절을 알렸지만, DB에는 거절된 흔적이 없습니다.'
      ],
      metrics: [
        { label: '거절 기록', value: '사라짐', tone: 'bad' },
        { label: '결제 상태', value: 'READY', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'muted' } },
      flows: [
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '400 CARD_REJECTED', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVAL_FAILED', mono: true, then: { db: { badge: 'APPROVAL_FAILED', tone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'READY', tone: 'bad', note: '롤백으로 기록이 사라짐', noteTone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '422', mono: true }
      ]
    },
    {
      short: '연결 바닥', tag: '문제', title: 'PG 답을 기다리는 동안 DB 연결이 바닥난다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '트랜잭션이 PG 호출을 감싸고 있으므로, 승인 한 건은 PG가 답할 때까지 DB 연결 하나를 쥐고 있습니다. 연결이 2개뿐인데 승인 두 건이 모두 PG를 기다리면, PG와 상관없는 조회조차 연결을 얻지 못합니다.',
        '조회는 250ms 뒤 `CannotCreateTransactionException`으로 실패했고, API로 돌린 테스트에서는 **500** 응답이 되었습니다.'
      ],
      note: '계약 테스트는 DB 연결 2개, 연결 대기 250ms(HikariCP가 허용하는 최솟값)로 줄이고, Mock PG가 800ms 뒤에 답하게 해서 이 상황을 만듭니다.',
      metrics: [
        { label: 'DB 연결(시험)', value: '2개 모두 사용 중', tone: 'bad' },
        { label: 'Mock PG 응답', value: '800ms 뒤', tone: 'warn' },
        { label: '조회', value: '250ms 뒤 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 두 건' },
        { from: 'server', to: 'db', kind: 'write', label: '트랜잭션 두 개', then: { db: { badge: '연결 2개 모두 쥠', tone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인 두 건', then: { pg: { badge: '800ms 뒤 답', tone: 'warn' } } },
        { from: 'client', to: 'server', kind: 'query', label: '다른 결제 조회' },
        { from: 'server', to: 'db', kind: 'fail', label: '250ms 기다림', cut: true, then: { db: { badge: '연결 2개 모두 쥠', tone: 'bad', note: '남은 연결 없음', noteTone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '500', mono: true }
      ]
    },
    {
      short: '끝까지 대기', tag: '문제', title: '시간 제한이 없어 느린 PG를 끝까지 기다린다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '출발 코드는 JDK `HttpClient`에 읽기 시간 제한을 주지 않았고, PG 설정 클래스(`PgProperties`)에는 `baseUrl`만 있어 1초 설정도 읽지 않습니다. PG가 3초 뒤에 답하게 하자 테스트는 약 3초 뒤 승인으로 끝났습니다.',
        '그동안 DB 연결도 함께 붙잡혀 있습니다. 출발 코드에서 테스트 **13개 중 6개가 실패**했고, 원인은 거절 기록, 연결 바닥, 시간 제한 세 가지였습니다.'
      ],
      metrics: [
        { label: '읽기 시간 제한', value: '없음', tone: 'bad' },
        { label: '출발 코드 테스트', value: '13개 중 6개 실패', tone: 'bad' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '연결을 쥔 채', noteTone: 'warn' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '약 3초 뒤 승인', slow: true },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '이제야 연결 반납', noteTone: 'warn' } } }
      ]
    },
    {
      short: '나누기', tag: '결정', title: '결정 1. PG 승인 호출을 트랜잭션 밖에서 한다',
      src: '결정 1. PG 승인 호출을 트랜잭션 안에서 할까 밖에서 할까',
      body: [
        '이 장에서는 트랜잭션을 나눠 PG 승인 호출을 트랜잭션 밖에서 하기로 했습니다. 인증을 기록하고 커밋한 뒤, 트랜잭션 없이 PG를 호출하고, 새 트랜잭션에서 결과를 기록합니다. PG를 기다리는 동안에는 **연결을 쓰지 않습니다**.',
        '나눈 구현은 같은 계약 테스트를 모두 통과했고, k6로 잰 조회 p95도 1.4초에서 10ms 수준으로 줄었습니다. 커밋 뒤 비동기로 호출하는 방식은 API의 약속이 바뀌어 구현하지 않았습니다.'
      ],
      note: '비용: 커밋이 한 번에서 두 번으로 늘고, PG를 기다리는 동안 결제가 `AUTHENTICATED`로 밖에 보입니다. 결과 기록을 트리거로 막아 보니 두 구조 모두 Mock PG에 승인이 1건 남았고, 결제는 나눈 구조에서 `AUTHENTICATED`, 하나로 묶은 구조에서 `READY`였습니다.',
      changed: [['~', '`@Transactional` 하나 → 짧은 트랜잭션 둘'], ['+', 'PG 호출은 트랜잭션 밖']],
      metrics: [
        { label: '커밋', value: '두 번', tone: 'warn' },
        { label: '조회 p95(k6)', value: '1.4초 → 10ms 수준', tone: 'good' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 요청' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED 커밋', then: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '연결 반납', noteTone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인(트랜잭션 밖)' },
        { from: 'pg', to: 'server', kind: 'res', label: '200 승인' },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVED 커밋', then: { db: { badge: 'APPROVED', tone: 'ok', note: '연결 반납', noteTone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: '빈 분리', tag: '결정', title: '결정 2. 기록을 맡는 빈을 따로 둔다',
      src: '결정 2. 트랜잭션을 어떻게 나눌까',
      body: [
        '이 장에서는 기록을 맡는 빈(`PaymentRecorder`)을 따로 두기로 했습니다. 승인 서비스에는 `@Transactional`이 없고, 인증 기록과 결과 기록은 `PaymentRecorder`의 짧은 트랜잭션에 맡깁니다. 결과를 기록할 때는 결제를 다시 읽습니다.',
        '`TransactionTemplate`으로 경계를 직접 긋는 비교 B\'도 계약 테스트 4개를 통과했습니다. 빈을 고른 것은 `PaymentPrepareService`, `PaymentQueryService`가 모두 `@Transactional` 메서드로 경계를 표시하고 있어서, **트랜잭션 경계가 곧 메서드 경계**로 보이는 방식을 이어 갈 수 있기 때문입니다.'
      ],
      note: '비용: 클래스가 하나 늘고, 누군가 두 기록 메서드를 승인 서비스 안으로 합치면 같은 클래스 안 호출 함정이 그대로 재현됩니다. 그래서 `PaymentRecorder`에 따로 둔 이유를 주석으로 남겼습니다.',
      changed: [['+', '`PaymentRecorder`의 `@Transactional` 기록 메서드 둘'], ['-', '승인 서비스의 `@Transactional`']],
      metrics: [
        { label: '계약 테스트', value: '4개 통과', tone: 'good' },
        { label: '비교 B\'', value: '4개 통과', tone: 'good' }
      ],
      flows: [
        { from: 'server', to: 'db', kind: 'write', label: 'authenticate()', mono: true, then: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '프록시를 거쳐 커밋', noteTone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '200 승인' },
        { from: 'server', to: 'db', kind: 'write', label: 'recordApproval', mono: true, then: { db: { badge: 'APPROVED', tone: 'ok', note: '다시 읽고 커밋', noteTone: 'ok' } } }
      ]
    },
    {
      short: '같은 클래스', tag: '비교', title: '비교. 같은 클래스 안에서 부르면 트랜잭션이 걸리지 않는다',
      src: '결정 2. 트랜잭션을 어떻게 나눌까',
      body: [
        '같은 클래스 안에 `@Transactional` 기록 메서드를 두고 `this`로 부르면 스프링의 트랜잭션 프록시를 거치지 않습니다. 인증 기록이 저장되지 않았고, 결과를 기록할 때 다시 읽은 결제는 여전히 `READY`라서 승인 전이가 거부되었습니다.',
        '승인 테스트는 `Cannot APPROVE a payment in READY status.`로, 거절 테스트는 `APPROVAL_FAILED` 대신 `READY`로 **실패**했습니다. 연결 대기와 시간 제한 테스트는 오래 열린 트랜잭션이 없어 통과했습니다.'
      ],
      metrics: [
        { label: '계약 테스트', value: '4개 중 2개 실패', tone: 'bad' },
        { label: '인증 기록', value: '저장 안 됨', tone: 'bad' }
      ],
      states: { db: { badge: 'READY', tone: 'muted' } },
      flows: [
        { from: 'server', to: 'db', kind: 'fail', label: 'this.authenticate', mono: true, cut: true, then: { db: { badge: 'READY', tone: 'bad', note: '트랜잭션 없음', noteTone: 'bad' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '200 승인' },
        { from: 'server', to: 'db', kind: 'query', label: '다시 읽음' },
        { at: 'server', then: { server: { badge: '승인 전이 거부', tone: 'bad', note: 'READY에서 APPROVE', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '거절 기록', tag: '결정', title: '결정 3. 거절도 결과로 기록하고 200의 status로 알린다',
      src: '결정 3. 거절을 어떻게 알릴까',
      body: [
        '이 장에서는 거절도 결과로 기록하고 커밋한 뒤, 200 응답의 `status`에 담아 알리기로 했습니다. 카드사의 거절은 요청이 잘못된 것이 아니라 결제가 정상적으로 처리된 결과라고 보았습니다.',
        '`noRollbackFor`를 붙인 비교 A\'는 거절 기록은 남겼지만, 연결 대기 테스트는 출발 코드와 똑같이 실패했습니다. **거절 처리 방식만 바꿔서는** 결정 1의 문제가 그대로 남습니다.'
      ],
      note: '비용: API를 부르는 쪽은 HTTP 상태만 보고 성공으로 판단하면 안 되고 반드시 `status`를 봐야 합니다. 422로 답하면 HTTP 상태만으로 거절을 알 수 있었습니다. 거절을 기록한 뒤 422로 알리는 방식은 구현해 돌려 보지 않았습니다.',
      changed: [['~', '거절: 예외·롤백 → `APPROVAL_FAILED` 커밋'], ['~', '응답: 422 → 200 + `status`']],
      metrics: [
        { label: '거절 기록', value: '남음', tone: 'good' },
        { label: '거절 응답', value: '200', tone: 'warn' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'res', label: '400 CARD_REJECTED', mono: true },
        { from: 'server', to: 'db', kind: 'write', label: 'APPROVAL_FAILED 커밋', then: { db: { badge: 'APPROVAL_FAILED', tone: 'ok', note: '거절 기록이 남음', noteTone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: '200 APPROVAL_FAILED', mono: true }
      ]
    },
    {
      short: 'OSIV 끔', tag: '결정', title: '결정 4. Open Session In View를 끈다',
      src: '결정 4. Open Session In View를 켤까 끌까',
      body: [
        '이 장에서는 Open Session In View를 끄기로(`spring.jpa.open-in-view=false`) 했습니다. 이 설정은 웹 요청이 끝날 때까지 영속성 컨텍스트와 그 DB 연결을 요청에 묶어 두고, Spring Boot에서는 기본으로 켜져 있습니다.',
        '끄면 인증 기록과 결과 기록 트랜잭션이 끝날 때마다 연결을 반납해, **PG를 기다리는 동안 다른 조회가 연결을 얻습니다**.'
      ],
      note: '비용: 트랜잭션 밖(컨트롤러나 응답 변환)에서는 지연 로딩을 할 수 없습니다. 지금 결제 엔티티에는 연관관계가 없어 영향이 없지만, 연관관계가 생기면 필요한 데이터를 서비스의 트랜잭션 안에서 모두 읽어 와야 합니다.',
      changed: [['+', '`spring.jpa.open-in-view=false`']],
      metrics: [
        { label: 'Open Session In View', value: '끔', tone: 'good' },
        { label: '대기 중 조회(API)', value: '200', tone: 'good' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 두 건' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED 커밋', then: { db: { badge: 'AUTHENTICATED', tone: 'info', note: '연결 반납', noteTone: 'ok' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인 두 건', then: { pg: { badge: '800ms 뒤 답', tone: 'warn' } } },
        { from: 'client', to: 'server', kind: 'query', label: '다른 결제 조회' },
        { from: 'server', to: 'db', kind: 'query', label: '조회' },
        { from: 'server', to: 'client', kind: 'res', label: '200' }
      ]
    },
    {
      short: 'OSIV 켬', tag: '비교', title: '비교. 켜 두면 트랜잭션을 나눠도 조회가 500으로 실패한다',
      src: '결정 4. Open Session In View를 켤까 끌까',
      body: [
        '트랜잭션을 나눈 구현에 Open Session In View만 다시 켜서 API 테스트를 돌리자 조회가 **500**으로 실패했습니다. 서버 로그에는 `Connection is not available, request timed out after 260ms`가 남았습니다.',
        '웹 요청이 끝날 때까지 연결이 요청에 묶여 있어, 서비스에서 트랜잭션을 나눠도 PG를 기다리는 동안 연결을 놓지 않은 것입니다. 서비스를 직접 부르는 계약 테스트는 웹 요청을 거치지 않아, 이 문제는 API로 돌린 테스트에서만 드러납니다.'
      ],
      note: '설정한 대기 시간은 250ms이고, 로그의 260ms는 실제로 기다린 시간이라 실행마다 조금씩 다릅니다.',
      metrics: [
        { label: 'Open Session In View', value: '켬', tone: 'bad' },
        { label: '대기 중 조회(API)', value: '500', tone: 'bad' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 두 건' },
        { from: 'server', to: 'db', kind: 'write', label: 'AUTHENTICATED 커밋', then: { db: { badge: '연결 2개 모두 쥠', tone: 'warn', note: '요청이 끝날 때까지', noteTone: 'warn' } } },
        { from: 'server', to: 'pg', kind: 'req', label: '승인 두 건' },
        { from: 'client', to: 'server', kind: 'query', label: '다른 결제 조회' },
        { from: 'server', to: 'db', kind: 'fail', label: '연결 없음', cut: true, then: { db: { badge: '연결 2개 모두 쥠', tone: 'bad', note: '요청이 끝날 때까지', noteTone: 'bad', shake: true } } },
        { from: 'server', to: 'client', kind: 'fail', label: '500', mono: true }
      ]
    },
    {
      short: '시간 제한', tag: '결정', title: '결정 5. PG 호출에 연결 1초, 읽기 5초 시간 제한을 둔다',
      src: '결정 5. PG 호출에 시간 제한을 둘까',
      body: [
        '이 장에서는 PG 호출에 연결 1초, 읽기 5초 시간 제한을 두기로 했습니다. Mock PG를 기준으로 정한 값이고 근거가 있는 운영 값은 아닙니다. 시간 안에 답이 오지 않으면 결제를 `AUTHENTICATED`로 둔 채 **504와 `PAYMENT_GATEWAY_NO_RESPONSE`**로 답합니다.',
        '다만 시간 제한으로 끝난 요청은 실패가 아니라 결과를 모르는 상태입니다. Mock PG가 1.5초 뒤 승인하게 하고 읽기 시간 제한을 1초로 둔 테스트에서, 결제 서버는 응답 없음을 알렸지만 Mock PG에는 그 뒤에 승인이 1건 남았습니다.'
      ],
      note: '비용: 시간 제한을 두면 "PG에는 승인, 우리는 인증 상태"인 결제가 생길 수 있습니다. 이 결제를 어떻게 보정할지는 4장에서 다룹니다.',
      changed: [['+', '`payment.pg.connect-timeout=1s`'], ['+', '`payment.pg.read-timeout=5s`']],
      metrics: [
        { label: '연결 시간 제한', value: '1초' },
        { label: '읽기 시간 제한', value: '5초' },
        { label: '결제 ↔ PG', value: '어긋날 수 있음', tone: 'warn' }
      ],
      states: { db: { badge: 'AUTHENTICATED', tone: 'info' } },
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '승인' },
        { from: 'pg', to: 'server', kind: 'fail', label: '1초 안에 답 없음', cut: true, slow: true },
        { from: 'server', to: 'client', kind: 'fail', label: '504', mono: true },
        { at: 'pg', then: { pg: { badge: '승인 1건', tone: 'ok', note: '1.5초 뒤 승인을 마침', noteTone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'bad', note: 'PG에는 승인, 우리는 인증', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: 'Mock PG', tag: '결정', title: '결정 6. Mock PG를 실제 HTTP로 답하는 별도 모듈로 만든다',
      src: '결정 6. Mock PG를 어떤 형태로 만들까',
      body: [
        '이 장에서는 Mock PG를 실제 HTTP로 답하는 별도 모듈로 직접 만들기로 했습니다. 읽기 시간 제한은 `JdkClientHttpRequestFactory`가 실제 HTTP 요청에서 거는 것이라, 인터페이스를 가짜로 대신하면 **시간 제한 설정을 지나가지 않습니다**.',
        '승인 API `POST /v1/payments/confirm`은 시나리오의 지연 시간만큼 기다렸다가 승인(200), 거절(400), 서버 오류(500) 중 하나로 답하고, 시나리오는 `PUT /control/scenario`로 바꿉니다. 6장 웹훅도 같은 Mock PG에 더합니다.'
      ],
      note: '비용: 빌드가 멀티 모듈이 되고 테스트마다 Mock PG를 띄우는 시간이 듭니다. WireMock은 비교 구현하지 않아 차이를 확인하지 못했습니다.',
      changed: [['+', '`mock-pg` 모듈'], ['+', '제어 API `PUT /control/scenario`']],
      metrics: [
        { label: 'Mock PG', value: '별도 모듈' },
        { label: '시간 제한', value: '실제로 지나감', tone: 'good' }
      ],
      focus: ['pg'],
      flows: [
        { from: 'server', to: 'pg', kind: 'req', label: '실제 HTTP 승인' },
        { at: 'pg', then: { pg: { badge: '시나리오 지연', tone: 'info', note: 'Thread.sleep 뒤 답', noteTone: 'muted' } } },
        { from: 'pg', to: 'server', kind: 'res', label: '200 DONE', mono: true }
      ]
    },
    {
      short: '결과', tag: '결과', title: '241개 테스트 통과, k6 조회 p95 10.09ms',
      src: '테스트 결과',
      body: [
        '전체 241개(1장 218개 + 2장 23개)가 통과했고, 출발 코드에서 실패하던 6개도 모두 통과했습니다. 라인 커버리지는 98.9%입니다. 계약을 지키지 못하는 비교 구현은 `./gradlew knownFailingTest`로 따로 돌려 13개 중 6개 실패를 기록합니다.',
        'k6로 기본 설정(Hikari 연결 10개, 연결 대기 30초), 1초 뒤 승인하는 Mock PG에서 쟀습니다. **조회 p95는 1.4초·1.21초에서 10.09ms·10.46ms로**, 30초 동안 끝난 승인은 308건·307건에서 580건·600건으로 바뀌었습니다.'
      ],
      note: '두 코드 모두 실패한 요청은 없었습니다. 연결 대기 시간이 기본값 30초라서, 출발 코드에서도 조회가 실패하기 전에 연결을 얻었기 때문입니다.',
      metrics: [
        { label: '전체 테스트', value: '241개 통과', tone: 'good' },
        { label: '조회 p95', value: '1.4초 → 10.09ms', tone: 'good' },
        { label: '30초 동안 승인', value: '308건 → 580건', tone: 'good' }
      ],
      flows: [
        { from: 'client', to: 'server', kind: 'req', label: '승인 VU 20명' },
        { from: 'server', to: 'pg', kind: 'req', label: '1초 뒤 승인' },
        { from: 'client', to: 'server', kind: 'query', label: '조회 초당 20건' },
        { from: 'server', to: 'db', kind: 'query', label: '조회', then: { db: { badge: '연결 10개', tone: 'ok', note: 'PG 대기 중엔 놓음', noteTone: 'ok' } } },
        { from: 'server', to: 'client', kind: 'res', label: 'p95 10.09ms' }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: 'PG와 우리 기록이 어긋나는 순간은 남는다',
      src: '남은 한계',
      body: [
        '승인 요청 금액을 검증하지 않고, 같은 주문번호로 다시 준비하면 500으로 끝나며, PG가 준 `paymentKey`를 저장하지 않습니다. 3장에서 다룹니다.',
        'PG가 승인한 뒤 결과 기록이 실패하거나 시간 제한으로 기다리기를 그만두면, Mock PG에는 승인이 남고 결제는 `AUTHENTICATED`로 남습니다. `AUTHENTICATED` 하나로는 "승인 요청 전"과 "결과를 모름"을 구분하지 못합니다. 4장에서 다룹니다.'
      ],
      metrics: [
        { label: '금액 검증', value: '없음', tone: 'warn' },
        { label: '결제 ↔ PG', value: '어긋날 수 있음', tone: 'warn' }
      ],
      flows: [
        { at: 'pg', then: { pg: { badge: '승인 1건', tone: 'ok', note: 'PG에는 승인이 남음', noteTone: 'warn' } } },
        { at: 'db', then: { db: { badge: 'AUTHENTICATED', tone: 'warn', note: '승인 요청 전? 결과 모름?', noteTone: 'warn' } } }
      ]
    }
  ]
};
