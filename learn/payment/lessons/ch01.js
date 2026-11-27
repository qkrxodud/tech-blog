// 1장 결제 기초: 인증, 승인, 매입, 취소와 상태 머신 — content/payment-state-machine/index.md에서만 가져온 사실
// 노드는 결제 상태이고, 흐름은 상태를 바꾸는 행위(전이)입니다. 배지 '지금'은 결제가 지금 있는 상태를 가리킵니다.
window.LESSONS = window.LESSONS || {};
window.LESSONS[1] = {
  slug: 'payment-state-machine',
  branch: 'chapter-01',
  title: '결제 기초: 인증, 승인, 매입, 취소와 상태 머신',
  goal: '결제 단계를 상태 9개로 나누고, 허용 전이 표를 거쳐서만 상태가 바뀌게 합니다.',
  learn: [
    { text: '인증·승인·매입·취소와 결제 상태', step: 0 },
    { text: '검사하지 않는 변경 메서드가 놓치는 전이', step: 4 },
    { text: '취소 방향을 위해 상태를 한 필드에 두기', step: 5 },
    { text: '허용 전이 표와 비교 구현 둘', step: 8 },
    { text: '잘못된 전이를 예외로 알리기', step: 9 },
    { text: 'ORDINAL 대신 `varchar(30)`로 저장하기', step: 11 },
    { text: '218개 테스트 결과와 남은 한계', step: 13 }
  ],
  nodes: [
    { id: 'ready', kind: 'service', label: '결제 생성', sub: 'READY', subMono: true, x: 95, y: 290 },
    { id: 'auth', kind: 'service', label: '인증 완료', sub: 'AUTHENTICATED', subMono: true, x: 330, y: 470 },
    { id: 'approved', kind: 'service', label: '승인 완료', sub: 'APPROVED', subMono: true, x: 565, y: 470 },
    { id: 'captured', kind: 'service', label: '매입 완료', sub: 'CAPTURED', subMono: true, x: 800, y: 290 },
    { id: 'apcancel', kind: 'server', label: '승인 취소', sub: 'APPROVAL_CANCELED', subMono: true, x: 800, y: 470 },
    { id: 'cpcancel', kind: 'server', label: '매입 취소', sub: 'CAPTURE_CANCELED', subMono: true, x: 800, y: 110 },
    { id: 'failed', kind: 'ops', label: '실패·만료', sub: 'AUTH_FAILED 외 2개', x: 95, y: 470 }
  ],
  edges: [
    ['ready', 'auth'], ['auth', 'approved'], ['approved', 'captured'],
    ['approved', 'apcancel'], ['captured', 'cpcancel'],
    ['ready', 'failed'], ['auth', 'failed']
  ],
  steps: [
    {
      short: '네 단계', tag: '출발', title: '결제는 인증, 승인, 매입, 취소로 나뉜다',
      src: '결제의 네 단계: 인증, 승인, 매입, 취소',
      body: [
        '카드 결제는 한 번에 끝나지 않습니다. 고객이 결제창에서 카드사 인증을 마치면 `AUTHENTICATED`, 가맹점 서버가 승인을 요청해 결과를 받으면 `APPROVED`, 승인 마감 뒤 PG가 매입을 청구하면 `CAPTURED`가 됩니다.',
        '취소는 매입 전이면 승인 취소(`APPROVAL_CANCELED`), 매입 후면 매입 취소(`CAPTURE_CANCELED`)로 갈라집니다. 인증 실패, 승인 요청 없이 유효 시간이 지난 경우, 승인 거절은 각각 `AUTH_FAILED`, `EXPIRED`, `APPROVAL_FAILED`로 끝납니다.'
      ],
      note: '1장 코드가 구현한 것은 결제 상태의 전이뿐이고, 가맹점 서버의 API와 PG 호출은 2장부터 만듭니다.',
      metrics: [
        { label: '결제 상태', value: '9개' },
        { label: '행위', value: '7개' }
      ],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'auth', kind: 'req', label: 'AUTHENTICATE', mono: true, then: { ready: { badge: '' }, auth: { badge: '지금', tone: 'info' } } },
        { from: 'auth', to: 'approved', kind: 'req', label: 'APPROVE', mono: true, then: { auth: { badge: '' }, approved: { badge: '지금', tone: 'info' } } },
        { from: 'approved', to: 'captured', kind: 'req', label: 'CAPTURE', mono: true, then: { approved: { badge: '' }, captured: { badge: '지금', tone: 'info' } } },
        [
          { from: 'approved', to: 'apcancel', kind: 'req', label: 'CANCEL', mono: true, then: { apcancel: { badge: '매입 전 취소', tone: 'muted' } } },
          { from: 'captured', to: 'cpcancel', kind: 'req', label: 'CANCEL', mono: true, then: { cpcancel: { badge: '매입 후 취소', tone: 'muted' } } }
        ]
      ]
    },
    {
      short: '출발 구조', tag: '출발', title: '변경 메서드는 지금 상태를 보지 않는다',
      src: '현재 구조: 이름은 있지만 검사하지 않는 변경 메서드',
      body: [
        '출발 코드는 결제 상태를 enum 하나로 두고, 결제는 `Payment.create()`로 만들며, 상태는 setter가 아니라 `approve()`, `capture()`, `cancel()`처럼 의도가 드러나는 메서드로만 바꿉니다.',
        '어떤 일이 일어났는지는 메서드 이름으로 드러납니다. 다만 각 메서드는 지금 상태가 무엇인지 보지 않고 **목표 상태를 그대로 대입**합니다.'
      ],
      metrics: [
        { label: '결제 상태', value: '9개' },
        { label: '전이 규칙 테스트', value: '아직 없음' }
      ],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'auth', kind: 'req', label: 'authenticate()', mono: true, then: { ready: { badge: '' }, auth: { badge: '지금', tone: 'info' } } },
        { from: 'auth', to: 'approved', kind: 'req', label: 'approve()', mono: true, then: { auth: { badge: '' }, approved: { badge: '지금', tone: 'info', note: 'APPROVED를 그대로 대입', noteTone: 'muted' } } }
      ]
    },
    {
      short: '승인 전 매입', tag: '문제', title: '승인 전 결제에 매입을 요청해도 매입된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '테스트는 결제를 `perform(action)`과 `status()`로만 다루는 `PaymentTransitionContract`로 만들고, 허용되는 전이만 적은 표(`ALLOWED`)에 없는 조합은 모두 거부되어야 한다고 적었습니다.',
        '개별 테스트 7개와 상태 9개 × 행위 7개 = 63개 조합, 모두 70개를 출발 코드에서 돌리자 **61개가 실패**했습니다. 승인 전 결제(`READY`)에 매입을 요청해도 예외 없이 `CAPTURED`가 되었습니다.'
      ],
      note: '테스트는 운영 코드의 표를 가져다 쓰지 않고 기대 규칙을 따로 적습니다. 운영 코드의 표가 틀리면 테스트도 함께 틀리게 되기 때문입니다.',
      metrics: [
        { label: '전이 규칙 테스트', value: '70개 중 61개 실패', tone: 'bad' },
        { label: '조합', value: '9 × 7 = 63개' }
      ],
      edges: [['ready', 'captured', { dashed: true }]],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'captured', kind: 'fail', label: 'capture()', mono: true, then: { ready: { badge: '' }, captured: { badge: '지금', tone: 'bad', note: '승인 전인데 매입됨', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '취소 방향', tag: '문제', title: '매입이 끝난 결제를 취소해도 승인 취소가 된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '출발 구조의 `cancel()`은 언제나 `APPROVAL_CANCELED`를 대입합니다. 그래서 매입까지 끝난 결제를 취소해도 `CAPTURE_CANCELED`가 아니라 `APPROVAL_CANCELED`가 되었습니다. 승인만 된 결제를 취소하는 테스트는 이 때문에 우연히 맞았습니다.',
        '매입 후 취소는 카드사 처리 기간도, 이후 대사에서 맞춰 볼 대상도 다른데, 상태만 보면 매입 전 취소와 구분할 수 없습니다.'
      ],
      metrics: [
        { label: '전이 규칙 테스트', value: '70개 중 61개 실패', tone: 'bad' },
        { label: '매입 후 취소', value: 'APPROVAL_CANCELED', tone: 'bad' }
      ],
      edges: [['captured', 'apcancel', { dashed: true }]],
      states: { captured: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'captured', to: 'apcancel', kind: 'fail', label: 'cancel()', mono: true, then: { captured: { badge: '' }, apcancel: { badge: '지금', tone: 'bad', note: 'CAPTURE_CANCELED여야 함', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '거부 안 됨', tag: '문제', title: '거부되어야 할 조합이 예외 없이 실행된다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '거부되어야 할 54개 조합 중 **47개가 예외 없이 실행**되었습니다. 40개는 상태가 바뀌었고(승인 전 매입, 취소 후 재승인, 인증 실패 후 승인 등), 7개는 `APPROVED`에서 다시 승인하는 경우처럼 같은 상태를 다시 대입했습니다.',
        '나머지 7개는 `CAPTURE_CANCELED`에서 출발하는 조합인데, `cancel()`이 매입 취소를 만들지 못해 그 상태까지 가지도 못했습니다. 메서드 이름을 명시적으로 만든 것만으로는 지금 상태에서 이 행위를 해도 되는지를 막을 수 없었습니다.'
      ],
      metrics: [
        { label: '예외 없이 실행', value: '54개 중 47개', tone: 'bad' },
        { label: '상태가 바뀜', value: '40개', tone: 'bad' }
      ],
      states: { apcancel: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'apcancel', to: 'approved', kind: 'fail', label: 'approve()', mono: true, then: { apcancel: { badge: '' }, approved: { badge: '지금', tone: 'bad', note: '취소 후 재승인', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '한 필드', tag: '결정', title: '결정 1. 인증·승인·매입을 상태 필드 하나에 둔다',
      src: '결정 1. 결제 단계를 상태로 어떻게 나눌까',
      body: [
        '이 장에서는 인증·승인·매입을 하나의 상태 필드에 모두 두기로 했습니다. 취소가 매입 여부에 따라 `APPROVAL_CANCELED`와 `CAPTURE_CANCELED`로 갈라져야 하는데, 상태가 한 필드에 있으면 **이 분기가 전이 표 한 곳에** 모입니다.',
        '승인 하나로 묶으면 매입 전인지 후인지 알 수 없어 두 취소를 가를 수 없습니다. 토스페이먼츠처럼 결제 상태(`status`)와 매입 상태(`acquireStatus`)를 나누면 두 필드를 함께 봐야 취소 방향이 정해집니다.'
      ],
      note: '비용: 매입 요청됨(`REQUESTED`)·매입 취소 요청됨(`CANCEL_REQUESTED`) 같은 매입의 중간 단계를 표현하지 못하고, 매입을 한 번에 `CAPTURED`가 되는 일로 취급합니다. 인증 실패와 승인 실패를 다른 상태로 두면서 상태가 9개로 늘었습니다.',
      changed: [['+', '상태 필드 하나에 상태 9개'], ['+', '`CANCEL`은 매입 여부에 따라 두 갈래']],
      metrics: [
        { label: '결제 상태', value: '9개' },
        { label: '상태 필드', value: '하나' }
      ],
      states: { approved: { badge: '매입 전', tone: 'info' }, captured: { badge: '매입 후', tone: 'info' } },
      flows: [
        [
          { from: 'approved', to: 'apcancel', kind: 'req', label: 'CANCEL', mono: true, then: { apcancel: { badge: 'APPROVAL_CANCELED', tone: 'ok' } } },
          { from: 'captured', to: 'cpcancel', kind: 'req', label: 'CANCEL', mono: true, then: { cpcancel: { badge: 'CAPTURE_CANCELED', tone: 'ok' } } }
        ]
      ]
    },
    {
      short: '허용 표', tag: '결정', title: '결정 2. 변경 메서드가 허용 전이 표를 거친다',
      src: '결정 2. 상태 전이를 어디서 막을까',
      body: [
        '이 장에서는 enum에 허용 전이 표를 두고, 엔티티의 변경 메서드가 그 표를 거쳐서만 상태를 바꾸기로 했습니다. `capture()`는 `changeStatus()`를 거쳐 `next()`에 묻고, 표에 없는 조합이면 `InvalidPaymentTransitionException`이 납니다.',
        '세 구현 모두 **같은 70개 테스트를 통과**했기 때문에 기준은 읽고 고치는 비용과 의존성이었습니다. 표는 전이 9개가 한 화면에 모이고, 추가 의존성 없이 JPA 엔티티의 상태 컬럼과 그대로 맞물립니다. `PaymentStatus`는 상태 선언을 포함해 34줄입니다.'
      ],
      note: '비용: 표는 "이 상태에서 이 행위를 하면 저 상태가 된다"만 표현합니다. "취소 금액이 남은 금액보다 크면 거부한다" 같은 조건은 엔티티 메서드 안에 따로 써야 해서, 조건이 늘수록 규칙이 표와 메서드 두 곳으로 나뉩니다.',
      changed: [['+', '허용 전이 표 `TRANSITIONS`와 `next()`'], ['~', '변경 메서드는 `changeStatus()`를 거침'], ['~', '`@Builder(access = AccessLevel.PRIVATE)`']],
      metrics: [
        { label: '전이 규칙 테스트', value: '70개 통과', tone: 'good' },
        { label: '코드 양', value: '34줄' }
      ],
      edges: [['ready', 'captured', { dashed: true }]],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'captured', kind: 'fail', label: 'capture()', mono: true, cut: true, then: { ready: { badge: '지금', tone: 'ok', note: 'next()에서 거부', noteTone: 'ok' } } }
      ]
    },
    {
      short: 'State', tag: '비교', title: '비교. State 패턴은 기본 구현이 모두 거부한다',
      src: '결정 2. 상태 전이를 어디서 막을까',
      body: [
        'State 패턴은 기본 구현이 모든 행위를 거부하고, 상태 클래스가 허용되는 행위만 재정의합니다. 승인 전 결제에 매입을 요청하면 기본 구현의 `reject()`에서 걸려 `READY`가 그대로 남습니다.',
        '같은 70개 테스트를 통과했고 코드는 **72줄**이었습니다. 규칙이 상태 클래스마다 흩어져 있어, 전체 전이를 보려면 클래스를 하나씩 열어 봐야 합니다.'
      ],
      note: '상태마다 하는 일이 크게 다르고 조건 붙은 전이가 많아진다면, 상태별 행동을 한 클래스에 모으는 State 패턴이 더 읽기 쉬울 것 같습니다.',
      metrics: [
        { label: '전이 규칙 테스트', value: '70개 통과', tone: 'good' },
        { label: '코드 양', value: '72줄', tone: 'warn' }
      ],
      edges: [['ready', 'captured', { dashed: true }]],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'captured', kind: 'fail', label: 'capture()', mono: true, cut: true, then: { ready: { badge: '지금', tone: 'ok', note: 'reject()에서 거부', noteTone: 'ok' } } }
      ]
    },
    {
      short: '라이브러리', tag: '비교', title: '비교. Spring Statemachine은 거부를 예외로 바꿔야 한다',
      src: '결정 2. 상태 전이를 어디서 막을까',
      body: [
        'Spring Statemachine은 상태·이벤트·전이를 빌더로 선언합니다. 이벤트가 거부되어도 예외가 나지 않고 결과 타입이 `DENIED`로 돌아와서, 예외로 바꾸는 코드를 직접 붙여야 했습니다. 같은 70개 테스트를 통과했고 **47줄**이었습니다.',
        '저장소 README에는 "Spring Statemachine is no longer maintained"라고 적혀 있고, 2026-07-05에 보관 처리되었습니다. 이번 구현은 메모리에서만 돌렸고, DB에 저장된 상태로 머신을 다시 세우는 코드는 만들지 않았습니다.'
      ],
      note: '마지막 버전 4.0.2는 Spring Framework 6.2.19 기준입니다. 이번에는 Spring Framework 7.0.10 위에서도 동작했지만, 버전을 올릴 때 계속 동작한다는 보장은 없습니다.',
      metrics: [
        { label: '전이 규칙 테스트', value: '70개 통과', tone: 'good' },
        { label: '코드 양', value: '47줄' },
        { label: '유지보수', value: '끝남', tone: 'bad' }
      ],
      edges: [['ready', 'captured', { dashed: true }]],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'captured', kind: 'fail', label: 'CAPTURE 이벤트', mono: false, cut: true, then: { ready: { badge: '지금', tone: 'ok', note: 'DENIED를 예외로 바꿈', noteTone: 'ok' } } }
      ]
    },
    {
      short: '예외', tag: '결정', title: '결정 3. 허용되지 않은 전이는 예외로 알린다',
      src: '결정 3. 허용되지 않은 전이를 어떻게 알릴까',
      body: [
        '이 장에서는 허용되지 않은 전이를 예외로 알리기로 했습니다. 성공 여부를 반환하면 호출하는 쪽이 반환값을 확인하지 않을 때 잘못된 전이가 그대로 지나가고, 아무 일도 하지 않으면 조용히 넘어갑니다. 예외는 확인을 빠뜨려도 **호출이 그 자리에서 멈춥니다**.',
        '`InvalidPaymentTransitionException`은 여러 도메인이 함께 쓰는 `global/error`에 두고, 원래 상태와 시도한 행위를 이름(`String`)으로 받아 로그용 문장에 담습니다.'
      ],
      note: '비용: 같은 취소 요청이 네트워크 문제로 두 번 들어오면 두 번째는 `Cannot CANCEL a payment in APPROVAL_CANCELED status.`로 실패합니다. 같은 요청인지 판단하는 일은 3장 멱등성에서 다룹니다.',
      changed: [['+', '`InvalidPaymentTransitionException`'], ['+', '오류 코드 `INVALID_PAYMENT_TRANSITION`']],
      metrics: [
        { label: '잘못된 전이', value: '예외로 멈춤', tone: 'good' },
        { label: '같은 취소 두 번', value: '두 번째 실패', tone: 'warn' }
      ],
      edges: [['captured', 'apcancel', { dashed: true }]],
      states: { apcancel: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'apcancel', to: 'captured', kind: 'fail', label: 'capture()', mono: true, cut: true, then: { apcancel: { badge: '지금', tone: 'ok', note: '예외로 멈춤', noteTone: 'ok' } } },
        { at: 'apcancel', then: { apcancel: { badge: '지금', tone: 'warn', note: '두 번째 cancel()도 예외', noteTone: 'warn', shake: true } } }
      ]
    },
    {
      short: 'ORDINAL', tag: '비교', title: '비교. ORDINAL로 저장하면 상태를 더했을 때 뜻이 바뀐다',
      src: '결정 4. 상태를 DB에 어떻게 저장할까',
      body: [
        'MySQL 8.4(Testcontainers)에서 배포 전 코드(V1)가 저장한 행을, `READY`와 `APPROVED` 사이에 `AUTHENTICATED`를 끼운 코드(V2)가 읽게 했습니다.',
        'ORDINAL은 V1이 `APPROVED`를 저장하면 숫자 1이 들어가고, V2에서는 1번이 `AUTHENTICATED`라서 **승인된 결제가 오류 없이 인증만 끝난 결제로** 읽혔습니다. MySQL enum 컬럼은 정의에 없는 새 상태를 `Data truncated for column \'enum_status\'`로 거부했습니다.'
      ],
      note: 'MySQL enum 컬럼에 새 상태를 쓰려면 애플리케이션 배포 전에 `ALTER TABLE`로 컬럼 정의를 먼저 바꿔야 합니다.',
      metrics: [
        { label: 'ORDINAL', value: '1 → AUTHENTICATED', tone: 'bad' },
        { label: 'MySQL enum', value: '새 상태 거부', tone: 'bad' }
      ],
      states: { approved: { badge: 'V1이 저장', tone: 'info' } },
      flows: [
        { from: 'approved', to: 'auth', kind: 'fail', label: '저장된 숫자 1', then: { approved: { badge: '' }, auth: { badge: 'V2가 읽음', tone: 'bad', note: '승인이 인증으로 읽힘', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: 'varchar', tag: '결정', title: '결정 4. 상태는 varchar(30)에 이름으로, 스키마는 직접 관리한다',
      src: '결정 4. 상태를 DB에 어떻게 저장할까',
      body: [
        '이 장에서는 상태를 `varchar(30)` 컬럼에 enum 이름으로 저장하고, 스키마는 `schema.sql`로 직접 관리하기로 했습니다. `\'APPROVED\'`로 저장되어 V2에서도 `APPROVED`로 읽혔고, 새 상태도 그대로 저장되었습니다.',
        '스키마를 Hibernate(7.4.13)에게 맡기면 `length = 30`을 지정해도 상태 컬럼이 MySQL `enum` 타입으로 만들어졌습니다. 그래서 `spring.jpa.hibernate.ddl-auto=none`으로 두었습니다.'
      ],
      note: '비용: DB가 값을 검사하지 않아 `\'APROVED\'` 같은 오타도 그대로 들어가고, 상태 이름을 바꾸면 기존 행을 함께 바꾸는 마이그레이션이 필요합니다.',
      changed: [['+', '`status varchar(30) not null`'], ['+', '`schema.sql`, `spring.jpa.hibernate.ddl-auto=none`']],
      metrics: [
        { label: '상태 컬럼', value: 'varchar(30)', tone: 'good' },
        { label: '새 상태', value: '그대로 저장', tone: 'good' }
      ],
      states: { approved: { badge: 'V1이 저장', tone: 'info' } },
      flows: [
        { at: 'approved', then: { approved: { badge: "'APPROVED'", tone: 'ok', note: 'V2도 APPROVED로 읽음', noteTone: 'ok' } } }
      ]
    },
    {
      short: '218개', tag: '결과', title: '1장 완성 코드의 테스트 218개',
      src: '테스트 결과',
      body: [
        '출발 구조에서 61개가 실패하던 전이 규칙 테스트가 허용 전이 표 방식에서 **70개 모두 통과**했고, 비교 구현인 State 패턴과 Spring Statemachine도 같은 70개를 통과했습니다.',
        '전이 규칙 테스트 210개를 뺀 8개는 Testcontainers로 띄운 MySQL 8.4에서 돌렸습니다. 전체 218개가 통과했고, JaCoCo로 잰 커버리지는 100%였습니다(애플리케이션 시작 클래스 제외).'
      ],
      metrics: [
        { label: '전체 테스트', value: '218개 통과', tone: 'good' },
        { label: '전이 규칙', value: '70 × 3', tone: 'good' },
        { label: '커버리지', value: '100%', tone: 'good' }
      ],
      states: { ready: { badge: '지금', tone: 'info' } },
      flows: [
        { from: 'ready', to: 'auth', kind: 'req', label: 'AUTHENTICATE', mono: true, then: { ready: { badge: '' }, auth: { badge: '지금', tone: 'ok' } } },
        { from: 'auth', to: 'approved', kind: 'req', label: 'APPROVE', mono: true, then: { auth: { badge: '' }, approved: { badge: '지금', tone: 'ok' } } },
        { from: 'approved', to: 'captured', kind: 'req', label: 'CAPTURE', mono: true, then: { approved: { badge: '' }, captured: { badge: '지금', tone: 'ok' } } },
        { from: 'captured', to: 'cpcancel', kind: 'req', label: 'CANCEL', mono: true, then: { captured: { badge: '' }, cpcancel: { badge: '지금', tone: 'ok', note: '매입 후 취소', noteTone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '한 객체 안의 잘못된 전이만 막는다',
      src: '남은 한계',
      body: [
        '실제 PG를 호출하지 않습니다(2장). 같은 요청이 두 번 들어오면 두 번째는 예외로 실패합니다(3장). 승인 요청의 응답을 받지 못하면 승인이 됐는지 표현할 방법이 없고(4장), 취소는 전액만 가능합니다(5장).',
        '두 요청이 같은 결제를 동시에 읽어 각각 전이하면 객체 안의 검사만으로는 막을 수 없습니다. 7장 동시성 제어에서 다룹니다. 상태가 언제 어떻게 바뀌었는지 이력도 남지 않습니다(12장).'
      ],
      metrics: [
        { label: '막는 범위', value: '한 객체 안', tone: 'warn' },
        { label: '상태 이력', value: '없음', tone: 'warn' }
      ],
      flows: [
        { at: 'auth', then: { auth: { badge: '응답을 못 받으면?', tone: 'warn', note: '4장에서 다룸', noteTone: 'warn' } } },
        { at: 'approved', then: { approved: { badge: '동시에 두 요청?', tone: 'warn', note: '7장에서 다룸', noteTone: 'warn' } } }
      ]
    }
  ]
};
