---
title: "Layered Architecture 구조별 테스트 작성법"
tags: ["Spring", "테스트 코드", "Layered Architecture", "DataJpaTest", "WebMvcTest"]
summary: "Persistence, Business, Presentation 계층의 역할과 계층별 테스트 전략, @DataJpaTest·@WebMvcTest 활용법을 정리합니다."
---

### persistence Layer

- Data Access의 역할, 비즈니스 가공 로직이 포함되어서는 안 됩니다.
- Data에 대한 CRUD에만 집중한 레이어

### business Layer

- 비즈니스 로직을 구현하는 역할
- Persistence Layer와의 상호작용(Data를 읽고 쓰는 행위)을 통해 비즈니스 로직을 전개시킵니다.
- 트랜잭션을 보장해야 합니다.

### Presentation Layer

- 외부 세계의 요청을 가장 먼저 받는 계층
- 파라미터에 대한 최소한의 검증을 수행합니다.

---

글을 작성하면서 개인적인 생각을 작성해보도록 하겠습니다.

코드를 작성하면서 가장 자주 마주하는 문제 중 하나는 Persistence Layer에서 발생하는 예외입니다. 객체 초기화 시 누락된 값으로 인한 예외나, null 값을 Enum으로 변환할 때 생기는 예외 등 생각보다 많은 예외가 이 레이어에서 발생하곤 합니다.

많은 사람들이 Business Layer가 중요하다고 생각하지만, 개인적으로는 Persistence Layer의 비중이 더 크다고 봅니다. 비즈니스 로직의 핵심은 검증된 데이터를 가공하는 것이며, 모든 데이터가 정확하고 필요한 위치에 잘 들어가 있다면 비즈니스 로직을 구현하는 것이 오히려 수월해질 수 있습니다. 그러나 데이터가 예상과 다르거나 올바르게 저장되지 않으면, 비즈니스를 구현하기 전에 항상 값의 유효성을 확인하고 검증하는 번거로움이 발생합니다. 이로 인해 데이터에 대한 신뢰가 떨어지게 되고, 코드의 복잡성이 증가하게 됩니다.

따라서, 각 레이어의 테스트 코드가 모두 중요하지만, 개인적으로 Persistence Layer에 대한 테스트의 비중을 더 높게 두는 편입니다. 이 레이어에서의 안정성이 확보되면, 나머지 비즈니스 로직 구현이 훨씬 수월해지기 때문입니다.

강의를 진행하면서 중요한 부분들을 깨알같이 짚어주는 느낌이 듭니다.

특히 아래와 같은 내용들이 인상 깊었습니다.

- @SpringBootTest, @DataJpaTest, @WebMvcTest의 차이점
    - @SpringBootTest : @Transactional이 없음
    - @DataJpaTest : @Transactional이 존재
- 클래스 상단의 @Transactional 선언과 테스트 코드 일관성: 클래스에 @Transactional을 선언하면 더티 체킹(Dirty Checking)으로 인해 테스트 결과가 달라질 수 있다는 점도 중요한 포인트입니다. 특히 테스트에서의 일관성을 유지하려면 이 부분을 신중하게 처리해야 합니다.
- CQRS와 @Transactional, @Transactional(readOnly = true)의 사용법과 master와 slave를 나눠서 사용하는 법:

    [도메인 주도 개발 시작하기] CQRS

    > 💡
    >
    > 클래스 상단에 기본으로 @Transactional(readOnly = true)를 사용하고, update, insert, delete는 @Transactional을 통해 데이터를 가공합니다.
    >
    > 면접에서 받은 질문 중 하나가 생각납니다. 함수에서 각각의 데이터를 조회할 때 트랜잭션이 걸려 있지 않으면, 매번 새로운 DB 커넥션을 생성하게 되어 비효율적이라는 것이었습니다. 이 문제를 해결하기 위해 @Transactional(readOnly = true)를 사용하면, 조회 작업 시 커넥션 풀을 통해 이미 사용 중인 커넥션을 계속 재사용할 수 있어 훨씬 효율적이라는 것입니다.

- serviceRequest 객체와 response 객체가 왜 필요한지, 왜 의존성을 두 개로 나눠서 사용하면 좋은지도 차후 확장성 면에서 좋다는 점이 인상 깊었습니다.

---

몰랐던 테스트 코드 작성법은 작성하고, 적용하겠습니다.

```java
    		List<Item> itemList = new ArrayList<>();
        Item item1 = Item.builder()
                .id(1L)
                .name("자전거")
                .price(new BigDecimal(100000))
                .build();

        Item item2 = Item.builder()
                .id(2L)
                .name("킥보드")
                .price(new BigDecimal(200000))
                .build();

        itemList.add(item1);
        itemList.add(item2);

        Items items = new Items(itemList);

        //when
        //then
        Assertions.assertThat(items.getItemList())
                .hasSize(2)
                .extracting("id", "name", "price") // 검증하고자 하는 필드
                .containsExactlyInAnyOrder(
                        tuple(1L, "자전거", new BigDecimal(100000)),
                        tuple(2L, "킥보드", new BigDecimal(200000))
                ); // 순서 상관없이 확인 해준다.
```

```java
@WebMvcTest(controllers = ProductController.class)
class ProductControllerTest {
		@Autowired
		private MockMvc mockMvc;
		
		@Autowired
		private ObjectMapper objectMapper; // 직렬화 역직렬화
		
		@MockBean
		private ProductService productService;
		
		@DisplayName("신규 상품을 등록한다.")
		@Test
		void createProduct() {
				// given
				ProductCreateRequest request = ProductCreateRequest.builder()
						.type(ProductType.HANDMADE)
						.sellingStatus(ProductSellingStatus.SELLING)
						.name("아메리카노")
						.price(4000)
						.build();
						
				mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/products/new")
							  .content(objectMapper.writeValueAsString(request))
							  .contentType(MediaType.APPLICATION_JSON)
			  ).andExpect(MockMvcRequestMatchers.status().isOk());
		}

}
```
