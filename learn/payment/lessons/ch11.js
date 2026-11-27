// 11장 컨슈머 멱등성·재시도·DLQ — content/payment-consumer-idempotency/index.md에서만 가져온 사실
window.LESSONS = window.LESSONS || {};
window.LESSONS[11] = {
  slug: 'payment-consumer-idempotency',
  branch: 'chapter-11',
  title: '컨슈머 멱등성·재시도·DLQ',
  goal: '메시지를 받는 주문 서비스·재고 서비스에서 같은 메시지와 늦게 온 옛 메시지를 가리고, 실패한 메시지를 다시 시도해 실패 모음(DLT)에 모읍니다.',
  learn: [
    { text: '적어도 한 번 보내면 받는 쪽에 생기는 일', step: 1 },
    { text: '번호를 고유 키 표에 같은 트랜잭션으로 남기기', step: 3 },
    { text: '마지막으로 반영한 번호로 옛 메시지 거르기', step: 5 },
    { text: '일시 오류와 영구 오류, 같은 자리 다시 시도', step: 7 },
    { text: '실패 모음 `<토픽>.DLT`와 다시 넣기', step: 9 },
    { text: '계약 24개와 측정으로 본 결과와 남은 한계', step: 11 }
  ],
  nodes: [
    { id: 'server', kind: 'server', label: '결제 서버', sub: 'payment_outbox', subMono: true, x: 95, y: 300 },
    { id: 'kafka', kind: 'kafka', label: 'Kafka', sub: '원래 토픽', x: 340, y: 300 },
    { id: 'order', kind: 'service', label: '주문 서비스', sub: '결제 결과 소비자', x: 600, y: 180 },
    { id: 'inv', kind: 'service', label: '재고 서비스', sub: '재고 명령 소비자', x: 600, y: 420 },
    { id: 'odb', kind: 'db', label: '주문 DB', sub: '주문·받은 기록', x: 860, y: 120 },
    { id: 'dlt', kind: 'kafka', label: '실패 모음', sub: '<토픽>.DLT', subMono: true, x: 860, y: 300, absent: '결정 4에서 만듦' },
    { id: 'idb', kind: 'db', label: '재고 DB', sub: '예약', x: 860, y: 470 }
  ],
  edges: [['server', 'kafka'], ['kafka', 'order'], ['kafka', 'inv'], ['order', 'odb'], ['inv', 'idb'], ['order', 'dlt'], ['inv', 'dlt'], ['dlt', 'kafka']],
  steps: [
    {
      short: '출발 구조', tag: '출발', title: '받은 순서대로 따르고, 실패하면 기본 처리에 맡긴다',
      src: '현재 구조: 받은 순서대로 따르고, 실패하면 기본 처리에 맡기는 소비자',
      body: [
        '9장부터 결제 서버는 결제 결과를 **적어도 한 번** 보냅니다. 주문 서비스는 결제 결과를 받을 때마다 받은 기록에 한 줄을 남기고 주문 상태를 그 결과대로 바꾸며, 재고 서비스는 확정 명령이면 확정하고 그 밖의 명령은 모두 해제로 처리합니다.',
        '처리에 실패하면 둘 다 Spring Kafka 기본 처리(`FixedBackOff(0L, 9)`)를 씁니다. 처음 1번에 간격 없이 9번 더, 모두 10번 읽은 뒤 ERROR 로그를 남기고 넘어갑니다.'
      ],
      note: '받는 쪽이 가릴 번호는 이미 메시지에 실려 있습니다. 결제 이벤트의 `eventId`와 재고 명령의 `commandId` 모두 `payment_outbox`의 번호(auto_increment)입니다.',
      hide: ['dlt'],
      metrics: [
        { label: '실패 처리', value: '10번 뒤 로그' },
        { label: '11장 계약', value: '24개 중 18개 실패', tone: 'bad' }
      ],
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '릴레이' },
        [
          { from: 'kafka', to: 'order', kind: 'event', label: '결제 결과' },
          { from: 'kafka', to: 'inv', kind: 'event', label: '확정·해제' }
        ],
        [
          { from: 'order', to: 'odb', kind: 'write', label: '받은 기록 + 주문', then: { odb: { badge: 'PAID', tone: 'ok' } } },
          { from: 'inv', to: 'idb', kind: 'write', label: '예약 상태 전이', then: { idb: { badge: 'CONFIRMED', tone: 'ok' } } }
        ]
      ]
    },
    {
      short: '중복·옛것', tag: '문제', title: '같은 결과를 두 번 남기고, 옛 승인이 취소를 되돌린다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '결제 서버가 같은 결과를 다시 보내자 받은 기록이 **2줄**(기대 1) 남았고, 같은 결과를 다시 읽자 주문 상태는 같았지만 `updated_at`이 다시 바뀌었습니다.',
        '취소를 먼저 반영한 뒤 그보다 0.2초 먼저 만든 승인이 늦게 오자 주문이 `PAID`로 돌아갔습니다(기대 `CANCELED`). 재고 서비스에서는 10장 예약 상태 전이가 막아 두 문제 모두 재현되지 않았습니다.'
      ],
      hide: ['dlt'],
      metrics: [
        { label: '받은 기록', value: '2줄 (기대 1)', tone: 'bad' },
        { label: '전체 테스트', value: '737개 중 18개 실패', tone: 'bad' }
      ],
      states: { odb: { badge: 'PAID', tone: 'ok' } },
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '같은 결과 다시' },
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'write', label: '받은 기록 한 줄 더', then: { odb: { badge: '받은 기록 2줄', tone: 'bad', note: 'updated_at도 다시 바뀜', noteTone: 'bad' } } },
        { at: 'odb', then: { odb: { badge: 'CANCELED', tone: 'ok', note: '다른 결제: 취소 먼저 반영', noteTone: 'muted' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '옛 승인(늦게)', slow: true },
        { from: 'order', to: 'odb', kind: 'write', label: '받은 순서대로 따름', then: { odb: { badge: 'PAID', tone: 'bad', note: '기대 CANCELED', shake: true } } }
      ]
    },
    {
      short: '잃음·막힘', tag: '문제', title: '처리할 수 없는 메시지가 사라지고, 장애 동안 온 메시지를 잃는다',
      src: '현재 구조의 문제: 테스트로 재현하기',
      body: [
        '모르는 결제 상태와 읽을 수 없는 본문은 기본 처리 10번 뒤 로그만 남고 넘어가, 30초 동안 실패 모음에 나타나지 않았습니다. 재고 서비스는 모르는 명령("HOLD")을 해제로 처리해 예약을 풀었습니다(기대 `RESERVED`).',
        '받는 쪽 저장소를 6초 읽기 전용으로 돌린 동안 온 메시지는 **기본 처리 10번을 장애 중에 다 써** 반영되지 않았습니다. 모르는 상태 바로 뒤에 같은 파티션으로 보낸 결과는 4.60초 뒤에 반영됐습니다(기대 2초 안).'
      ],
      note: '기본 처리 10번은 이 환경에서 다시 읽을 때마다 약 0.5초씩, 모두 약 4.6초 걸렸습니다. 그래서 계약의 장애를 그보다 긴 6초로 두었습니다.',
      hide: ['dlt'],
      metrics: [
        { label: '6초 장애', value: '메시지 잃음', tone: 'bad' },
        { label: '뒤 결과 반영', value: '4.60초 뒤', tone: 'bad' }
      ],
      states: { idb: { badge: 'RESERVED', tone: 'info' } },
      flows: [
        [
          { from: 'kafka', to: 'order', kind: 'event', label: '모르는 상태' },
          { from: 'kafka', to: 'inv', kind: 'event', label: 'HOLD', mono: true }
        ],
        [
          { at: 'order', then: { order: { badge: '간격 없이 10번', tone: 'warn', note: '뒤 결과가 기다림', noteTone: 'warn' } } },
          { from: 'inv', to: 'idb', kind: 'write', label: '해제로 처리', then: { idb: { badge: 'RELEASED', tone: 'bad', note: '기대 RESERVED', shake: true } } }
        ],
        { at: 'order', then: { order: { badge: 'ERROR 로그', tone: 'bad', note: '메시지가 사라짐', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '번호 표', tag: '결정', title: '결정 1. 처리한 번호를 고유 키 표에 같은 트랜잭션으로 남긴다',
      src: '결정 1. 같은 메시지를 어떻게 가릴까',
      body: [
        '이 장에서는 처리한 메시지 번호를 받는 쪽 상태 변경과 같은 트랜잭션에서 두 번 오를 수 없는 표에 남기고, 이미 있으면 아무것도 바꾸지 않기로 했습니다. 주문 서비스는 `event_id`에 고유 키를 더하고 `insert ignore`로 남겨, 남겨졌을 때만 주문을 바꿉니다.',
        '같은 트랜잭션이라 주문이 바뀌면 번호도 반드시 남고, 롤백되면 번호도 남지 않아 다시 시도할 수 있습니다. 재고 서비스도 `processed_stock_command`에 같은 방식으로 남깁니다.'
      ],
      note: '비용: 받는 쪽마다 번호 표에 메시지마다 한 줄이 쌓이고, 지우는 코드는 없습니다. 이미 쓰는 DB를 옮기는 스크립트도 만들지 않았습니다.',
      changed: [['+', '`received_payment_event.event_id` 고유 키'], ['+', '`processed_stock_command`(`command_id` 고유)'], ['~', '받은 기록을 JPA 엔티티에서 빼 JDBC로']],
      hide: ['dlt'],
      metrics: [
        { label: '받은 기록', value: '1줄', tone: 'good' },
        { label: 'Kafka 트랜잭션', value: '비교 안 함' }
      ],
      focus: ['order'],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'write', label: 'insert ignore → 1줄', then: { odb: { badge: 'PAID', tone: 'ok', note: '번호와 주문을 함께 커밋', noteTone: 'muted' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '같은 결과 다시' },
        { from: 'order', to: 'odb', kind: 'write', label: 'insert ignore → 0줄', then: { odb: { badge: 'PAID', tone: 'ok', note: '아무것도 바꾸지 않음', noteTone: 'muted' } } }
      ]
    },
    {
      short: '가리지 않음', tag: '비교', title: '비교. 가리지 않거나 상태 전이 규칙만으로 흡수하면',
      src: '결정 1. 같은 메시지를 어떻게 가릴까',
      body: [
        '가리지 않음과 상태 전이만은 각각 **1개**가 실패했습니다. 둘 다 결제 서버가 다시 보낸 결과를 받은 기록에 2줄 남겼습니다. 상태 전이만은 같은 상태로는 갈 수 없어 주문을 바꾸지 않지만, 받은 기록은 한 줄 더 남습니다.',
        '재고 서비스에서 명령 번호로 가리지 않는 비교는 운영과 같이 12개를 모두 통과했습니다. 재고 서비스에도 같은 규칙을 넣었지만, 이 장의 계약으로는 넣기 전후의 차이가 없었습니다.'
      ],
      note: 'Kafka 트랜잭션(exactly-once)은 받는 쪽 DB 반영까지 묶지 못해 구현하지 않았습니다.',
      hide: ['dlt'],
      metrics: [
        { label: '가리지 않음', value: '1개 실패', tone: 'bad' },
        { label: '상태 전이만', value: '1개 실패', tone: 'bad' },
        { label: '재고 서비스 비교', value: '12개 통과', tone: 'good' }
      ],
      states: { odb: { badge: 'PAID', tone: 'ok' } },
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '같은 결과 다시' },
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'write', label: '받은 기록 한 줄 더', then: { odb: { badge: '받은 기록 2줄', tone: 'bad', note: '주문은 그대로', noteTone: 'muted', shake: true } } }
      ]
    },
    {
      short: '마지막 번호', tag: '결정', title: '결정 2. 마지막으로 반영한 번호보다 크지 않으면 반영하지 않는다',
      src: '결정 2. 늦게 온 옛 메시지를 어떻게 거를까',
      body: [
        '이 장에서는 주문(재고 서비스는 예약)마다 마지막으로 반영한 `payment_outbox` 번호를 남기고, 그보다 번호가 크지 않은 메시지는 반영하지 않기로 했습니다. 주문 서비스는 `orders.last_event_id`를, 재고 서비스는 `stock_reservation.last_command_id`를 쥡니다.',
        '같은 결제의 기록은 결제 줄을 잠근 트랜잭션에서 남기므로 뒤 기록의 번호가 더 큽니다. 주문 줄은 `select … for update`로 잠그고 읽어 번호 비교가 어긋나지 않게 합니다.'
      ],
      note: '비용: 받는 쪽이 `payment_outbox` 번호 순서에 기댑니다. 그 순서가 커밋 순서라는 것은 잠금 구조에서 끌어낸 가정이고, MySQL 문서로 확인하지 않았습니다.',
      changed: [['+', '`orders.last_event_id`'], ['+', '`stock_reservation.last_command_id`'], ['+', '`isAfterLastApplied` · `isAfterLastCommand`']],
      hide: ['dlt'],
      metrics: [
        { label: '늦은 옛 승인', value: '걸러짐', tone: 'good' },
        { label: '주문 상태', value: 'CANCELED', tone: 'good' }
      ],
      states: { odb: { badge: 'CANCELED', tone: 'ok', note: 'last_event_id = 취소 번호', noteTone: 'muted' } },
      focus: ['order'],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '옛 승인(번호 작음)', slow: true },
        { from: 'order', to: 'odb', kind: 'query', label: '주문 줄 잠그고 읽기' },
        { at: 'order', then: { order: { badge: '번호가 크지 않음', tone: 'info' } } },
        { from: 'order', to: 'odb', kind: 'write', label: '받은 기록만 남김', then: { odb: { badge: 'CANCELED', tone: 'ok', note: '주문은 그대로', noteTone: 'muted' } } }
      ]
    },
    {
      short: '만든 시각', tag: '비교', title: '비교. 만든 시각으로 비교하거나 거르지 않으면',
      src: '결정 2. 늦게 온 옛 메시지를 어떻게 거를까',
      body: [
        '만든 시각(`occurredAt`)으로 비교하면 옛 승인은 막았지만 **1개**가 실패했습니다. 승인을 남긴 서버보다 시계가 0.3초 늦은 서버가 0.2초 뒤에 남긴 취소를 옛 결과로 보고 무시해, 주문이 결제 완료로 남았습니다.',
        '거르지 않음은 2개가 실패했습니다. 취소 뒤 늦게 온 옛 승인과, 실패 모음에서 다시 넣은 옛 승인이 더 새 취소 뒤에 반영돼 주문이 결제 완료로 돌아갔습니다.'
      ],
      note: '재고 명령에는 만든 시각이 실리지 않아 재고 쪽 시각 비교는 만들지 않았습니다. 옛 명령을 거르지 않는 재고 비교는 12개를 모두 통과했습니다.',
      hide: ['dlt'],
      metrics: [
        { label: '만든 시각', value: '1개 실패', tone: 'bad' },
        { label: '거르지 않음', value: '2개 실패', tone: 'bad' }
      ],
      states: { odb: { badge: 'PAID', tone: 'ok' } },
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '취소(시계 0.3초 늦음)' },
        { at: 'order', then: { order: { badge: '옛 결과로 봄', tone: 'bad' } } },
        { at: 'odb', then: { odb: { badge: 'PAID', tone: 'bad', note: '기대 CANCELED', shake: true } } }
      ]
    },
    {
      short: '같은 자리', tag: '결정', title: '결정 3. 일시 오류는 같은 자리에서 1·2·4·8초 다시 시도한다',
      src: '결정 3. 처리에 실패한 메시지를 언제 다시 시도할까',
      body: [
        '이 장에서는 일시 오류는 같은 자리에서 간격을 늘려 가며 다시 시도해 같은 키의 순서를 지키고(blocking), 영구 오류는 다시 시도하지 않기로 했습니다. 모르는 상태·명령, 읽을 수 없는 본문, 빠진 값은 영구 오류입니다.',
        '1·2·4·8초(합 15초)는 이 머신에서 MySQL 8.4 컨테이너를 다시 띄워 쿼리를 받기까지 잰 **2.62~3.04초**의 약 5배입니다. 재고 서비스는 이제 `RELEASE`만 해제하고 그 밖의 명령은 영구 오류로 알립니다.'
      ],
      note: '비용: 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 메시지가 기다립니다. 측정에서 일시 오류 하나가 뒤 결과를 15736~15933ms 막았습니다. 5배 여유는 가정입니다.',
      changed: [['+', '`DefaultErrorHandler` + `ExponentialBackOffWithMaxRetries`'], ['+', '`UnknownStockCommandException`'], ['~', '모르는 명령은 해제하지 않음']],
      hide: ['dlt'],
      metrics: [
        { label: '다시 시도', value: '1·2·4·8초 (합 15초)' },
        { label: '6초 장애', value: '반영됨', tone: 'good' },
        { label: '막는 시간', value: '15736~15933ms', tone: 'warn' }
      ],
      states: { odb: { badge: '읽기 전용', tone: 'warn' } },
      focus: ['order'],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'fail', label: '쓰기 거부', cut: true },
        { at: 'order', then: { order: { badge: '같은 자리 다시 시도', tone: 'warn', note: '1·2·4·8초', noteTone: 'warn' }, kafka: { badge: '취소가 뒤에서 기다림', tone: 'warn' } } },
        { at: 'odb', then: { odb: { badge: '돌아옴', tone: 'ok' } } },
        { from: 'order', to: 'odb', kind: 'write', label: '승인 반영', then: { odb: { badge: 'PAID', tone: 'ok' }, order: { badge: '', tone: 'muted' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '취소', then: { kafka: { badge: '', tone: 'muted' } } },
        { from: 'order', to: 'odb', kind: 'write', label: '보낸 순서대로', then: { odb: { badge: 'CANCELED', tone: 'ok' } } }
      ]
    },
    {
      short: '재시도 토픽', tag: '비교', title: '비교. 다시 시도 토픽으로 넘기면 순서가 바뀐다',
      src: '결정 3. 처리에 실패한 메시지를 언제 다시 시도할까',
      body: [
        '다시 시도 토픽(non-blocking)은 실패한 메시지를 `<토픽>-retry-…`로 넘기고 원래 토픽의 뒤 메시지를 이어서 처리합니다. 같은 주문의 결과가 `[APPROVAL_CANCELED, APPROVED]` 순서로 받아져, **주문 서비스 2개, 재고 서비스 1개**가 실패했습니다.',
        '뒤 메시지를 막는 시간은 41~50ms로 짧았습니다. 대신 30초 읽기 전용 장애에서는 메시지마다 따로 15초를 다 써, 실패 모음으로 간 수가 28~30건으로 운영(2건)보다 많았습니다.'
      ],
      note: 'Spring Kafka 기본 처리 비교는 주문 서비스 8개, 재고 서비스 7개가 실패했습니다. 6초 장애에 메시지를 잃었고, 실패 모음이 없습니다.',
      hide: ['dlt'],
      metrics: [
        { label: '계약', value: '주문 2개 · 재고 1개 실패', tone: 'bad' },
        { label: '막는 시간', value: '41~50ms', tone: 'good' },
        { label: '30초 장애 실패 모음', value: '28~30건', tone: 'bad' }
      ],
      states: { odb: { badge: '읽기 전용', tone: 'warn' } },
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'fail', label: '쓰기 거부', cut: true },
        { from: 'order', to: 'kafka', kind: 'event', label: '다시 시도 토픽으로', then: { odb: { badge: '돌아옴', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '취소 먼저' },
        { from: 'order', to: 'odb', kind: 'write', label: 'APPROVAL_CANCELED', mono: true, then: { odb: { badge: 'CANCELED', tone: 'ok' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '승인(다시 시도)' },
        { at: 'order', then: { order: { badge: '순서가 바뀜', tone: 'bad', note: '늦은 승인은 결정 2가 거름', noteTone: 'muted', shake: true } } }
      ]
    },
    {
      short: '실패 모음', tag: '결정', title: '결정 4. 다 쓴 메시지와 영구 오류는 <토픽>.DLT에 모은다',
      src: '결정 4. 다시 시도를 다 쓴 메시지를 어디에 모을까',
      body: [
        '이 장에서는 다시 시도를 다 쓴 메시지와 영구 오류 메시지를 `<토픽>.DLT`에 원인 머리와 함께 모으고, 운영자가 원래 토픽으로 다시 넣는 명령을 두기로 했습니다. `DeadLetterPublishingRecoverer`가 같은 번호 파티션에 원래 키·본문 그대로 싣고, 실린 뒤에야 그 자리를 넘어갑니다.',
        '다시 넣기는 같은 서비스를 리스너 없이 다시 넣기 모드로 한 번 띄우는 명령입니다. 다시 넣은 메시지는 **처음 온 메시지와 같은 규칙(결정 1·2)**으로 처리돼, 아직 반영 전이면 반영되고 더 새 것이 반영됐으면 무시됩니다.'
      ],
      note: '비용: 실패 모음에 간 메시지는 운영자가 명령을 돌려야 원래 토픽으로 돌아갑니다. 받는 쪽 토픽마다 실패 모음 토픽이 늘고, 파티션 수를 원래 토픽과 맞춰야 합니다.',
      changed: [['+', '`payment-events.DLT`, `stock-reservation-commands.DLT`'], ['+', '`DeadLetterReplayCommand`']],
      metrics: [
        { label: '영구 오류', value: '바로 실패 모음', tone: 'good' },
        { label: '11장 계약', value: '24개 모두 통과', tone: 'good' }
      ],
      focus: ['dlt'],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '모르는 상태' },
        { from: 'order', to: 'dlt', kind: 'event', label: '원인 머리 kafka_dlt-*', then: { dlt: { badge: '1건', tone: 'warn' } } },
        { at: 'dlt', then: { dlt: { badge: '1건', tone: 'warn', note: '운영자가 다시 넣기 명령', noteTone: 'muted' } } },
        { from: 'dlt', to: 'kafka', kind: 'event', label: '같은 파티션에 다시 넣기', then: { dlt: { badge: '', tone: 'muted' } } },
        { from: 'kafka', to: 'order', kind: 'event', label: '결정 1·2 그대로' }
      ]
    },
    {
      short: 'DB 실패 표', tag: '비교', title: '비교. 로그만 남기거나 자기 DB 실패 표에 남기면',
      src: '결정 4. 다시 시도를 다 쓴 메시지를 어디에 모을까',
      body: [
        '로그만은 두 서비스 모두 **5개**가 실패했습니다. 실패 모음 계약 3개와 다시 넣기 2개입니다. 측정의 30초 장애에서는 운영이 실패 모음에 남긴 2건을 잃었습니다.',
        'DB 실패 표(`failed_message`)는 두 서비스 모두 3개가 실패했습니다. 영구 오류는 남았지만, 저장소가 쓰기를 거부하는 동안 다시 시도를 다 쓴 메시지는 **실패 표에도 남지 못해** 그 자리를 넘어가지 않고 계속 다시 시도했습니다.'
      ],
      hide: ['dlt'],
      metrics: [
        { label: '로그만', value: '5개 실패', tone: 'bad' },
        { label: 'DB 실패 표', value: '3개 실패', tone: 'bad' }
      ],
      states: { odb: { badge: '읽기 전용', tone: 'warn' } },
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: 'APPROVED', mono: true },
        { from: 'order', to: 'odb', kind: 'fail', label: '쓰기 거부', cut: true },
        { from: 'order', to: 'odb', kind: 'fail', label: 'failed_message 기록', mono: false, cut: true },
        { at: 'order', then: { order: { badge: '계속 다시 시도', tone: 'bad', note: '실패 표도 같은 저장소', noteTone: 'bad', shake: true } } }
      ]
    },
    {
      short: '테스트', tag: '결과', title: '출발 코드에서 실패하던 18개가 모두 통과했다',
      src: '테스트 결과',
      body: [
        '11장 완성 코드에서 전체 테스트 **761개가 모두 통과**했고, 출발 코드에서 실패하던 18개(주문 서비스 11, 재고 서비스 7)도 모두 통과했습니다. 11장 운영 계약 24개와, 운영과 같은 결과라 기본 시험에 둔 재고 서비스 결정 1·2 비교 24개로 48개가 늘었습니다.',
        '결정 커밋마다 주문 서비스 계약 실패는 11 → 9 → 8 → 5 → 0개, 재고 서비스는 7 → 7 → 7 → 5 → 0개로 줄었습니다.'
      ],
      note: '11장 비교는 144개(계약 12개 × 열두 구현) 중 39개가 실패했습니다. 기본 시험 48개를 3번 다시 돌려 3번 모두 통과했습니다.',
      metrics: [
        { label: '전체 테스트', value: '761개 통과', tone: 'good' },
        { label: '11장 운영 계약', value: '24개 통과', tone: 'good' },
        { label: '11장 비교', value: '144개 중 39개 실패' }
      ],
      states: { odb: { badge: 'PAID', tone: 'ok' }, idb: { badge: 'CONFIRMED', tone: 'ok' } },
      flows: [
        { from: 'server', to: 'kafka', kind: 'event', label: '적어도 한 번' },
        [
          { from: 'kafka', to: 'order', kind: 'event', label: '같은 결과 · 옛 결과' },
          { from: 'kafka', to: 'inv', kind: 'event', label: '같은 명령 · 옛 명령' }
        ],
        [
          { at: 'order', then: { order: { badge: '한 번만 반영', tone: 'ok' } } },
          { at: 'inv', then: { inv: { badge: '한 번만 반영', tone: 'ok' } } }
        ]
      ]
    },
    {
      short: '30초 장애', tag: '결과', title: '받는 쪽 저장소를 30초 막은 동안의 측정',
      src: '받는 쪽 저장소를 막은 동안의 측정',
      body: [
        'MySQL을 30초 읽기 전용으로 돌리고 0.5초마다 새 결제의 승인 결과를 실어 60건을 보냈습니다. 운영은 6번 모두 **반영 58·실패 모음 2·잃음 0**이었습니다. 파티션마다 맨 앞 1건이 15초를 다 써 실패 모음으로 가고, 나머지는 기다렸다 반영됐습니다.',
        '같은 장애에서 기본 처리는 11~12건을 잃었고, 다시 시도 토픽은 실패 모음이 28~30건, 로그만은 2건을 잃었습니다. 10초 장애에서는 운영이 20건을 모두 반영했습니다.'
      ],
      note: '다시 시도 간격·횟수는 운영 값(1·2·4·8초)이고 주문 서비스에서만 쟀습니다. k6는 돌리지 않았습니다.',
      metrics: [
        { label: '보냄', value: '60건' },
        { label: '반영 · 실패 모음', value: '58 · 2', tone: 'good' },
        { label: '잃음', value: '0', tone: 'good' }
      ],
      states: { odb: { badge: '읽기 전용 30초', tone: 'warn' } },
      focus: ['dlt'],
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '0.5초마다 60건' },
        { from: 'order', to: 'odb', kind: 'fail', label: '쓰기 거부', cut: true },
        { from: 'order', to: 'dlt', kind: 'event', label: '파티션마다 맨 앞 1건', then: { dlt: { badge: '2건', tone: 'warn' } } },
        { at: 'odb', then: { odb: { badge: '돌아옴', tone: 'ok' } } },
        { from: 'order', to: 'odb', kind: 'write', label: '나머지 58건 반영', then: { odb: { badge: '잃음 0', tone: 'ok' } } }
      ]
    },
    {
      short: '남은 한계', tag: '한계', title: '아직 풀지 못한 것',
      src: '남은 한계',
      body: [
        '일시 오류 메시지 하나가 다시 시도를 다 쓸 때까지 같은 파티션의 뒤 메시지가 기다립니다(15736~15933ms). 실패 모음에 간 메시지는 운영자가 다시 넣기 명령을 돌려야 반영되고, 다시 넣기는 자동으로 돌지 않습니다.',
        '받은 기록, 처리한 명령 기록, 보낸 `payment_outbox` 줄을 지우지 않고 예약 만료(TTL)도 없습니다. 저장소 장애는 `read_only`로만 만들었고, 연결이 끊기는 장애는 만들지 않았습니다.'
      ],
      note: '다시 시도 15초의 5배 여유, `payment_outbox` 번호가 커밋 순서대로 커진다는 것, `insert ignore`가 남기는 중인 트랜잭션을 기다린다는 것은 문서로 확인하지 않은 가정입니다.',
      metrics: [
        { label: '막는 시간', value: '15736~15933ms', tone: 'warn' },
        { label: '다시 넣기', value: '운영자가 직접', tone: 'warn' }
      ],
      states: { dlt: { badge: '2건 대기', tone: 'warn', note: '운영자가 돌려야 함', noteTone: 'warn' } },
      flows: [
        { from: 'kafka', to: 'order', kind: 'event', label: '일시 오류' },
        { at: 'order', then: { order: { badge: '15초 다시 시도', tone: 'warn' }, kafka: { badge: '뒤 메시지 대기', tone: 'warn' } } },
        { from: 'order', to: 'dlt', kind: 'event', label: '다 씀' }
      ]
    }
  ]
};
