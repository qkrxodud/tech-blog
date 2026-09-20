---
title: "[Spring] Spring Annotation 그리고 Custom Annotation"
tags: ["Spring", "어노테이션", "Custom Annotation", "Component Scan", "Retention"]
summary: "Spring이 @Component, @Service 같은 어노테이션을 인식하는 원리와 Target, Retention 등 메타 어노테이션의 의미를 정리합니다."
---

## Custom Annotation

---

@Component 어노테이션

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Indexed
public @interface Component {
```

- Target: 어노테이션을 작성할 곳을 명시, 기본값은 Default(모든 필드)
    - ElementType.PACKAGE : 패키지 선언
    - ElementType.TYPE : 타입 선언
    - ElementType.ANNOTATION_TYPE : 어노테이션 타입 선언
    - ElementType.CONSTRUCTOR : 생성자 선언
    - ElementType.FIELD : 멤버 변수 선언
    - ElementType.LOCAL_VARIABLE : 지역 변수 선언
    - ElementType.METHOD : 메서드 선언
    - ElementType.PARAMETER : 전달인자 선언
    - ElementType.TYPE_PARAMETER : 전달인자 타입 선언
    - ElementType.TYPE_USE : 타입 선언

- Retention : 어노테이션의 지속 시간
    - source: 소스 코드까지만 유효
    - class : 런타임 시 클래스 메모리에 읽어오면 해당 정보는 사라짐
    - runtime : 클래스를 메모리로 읽어 왔을 때까지
- Documented : Java Doc의 문서화 여부 지정

---

### Spring Annotation은 어떻게 사용할까?

Spring에서 애플리케이션 실행 시 @Service, @Component가 붙은 클래스들은 어떻게 읽어 들이는 걸까요?

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component
public @interface Service {

	/**
	 * The value may indicate a suggestion for a logical component name,
	 * to be turned into a Spring bean in case of an autodetected component.
	 * @return the suggested component name, if any (or empty String otherwise)
	 */
	@AliasFor(annotation = Component.class)
	String value() default "";

}
```

- ElementType.TYPE : Class나 Interface를 타겟으로 합니다.
- RetentionPolicy.RUNTIME : 클래스를 메모리로 읽어 왔을 때까지
- @Component : 컴포넌트 어노테이션을 사용 중입니다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Indexed
public @interface Component {

	/**
	 * The value may indicate a suggestion for a logical component name,
	 * to be turned into a Spring bean in case of an autodetected component.
	 * @return the suggested component name, if any (or empty String otherwise)
	 */
	String value() default "";

}

```

```java
protected Set<BeanDefinitionHolder> doScan(String... basePackages) {
		Assert.notEmpty(basePackages, "At least one base package must be specified");
		Set<BeanDefinitionHolder> beanDefinitions = new LinkedHashSet<>();
		for (String basePackage : basePackages) {
			Set<BeanDefinition> candidates = findCandidateComponents(basePackage);
			for (BeanDefinition candidate : candidates) {
				ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(candidate);
				candidate.setScope(scopeMetadata.getScopeName());
				String beanName = this.beanNameGenerator.generateBeanName(candidate, this.registry);
				if (candidate instanceof AbstractBeanDefinition abstractBeanDefinition) {
					postProcessBeanDefinition(abstractBeanDefinition, beanName);
				}
				if (candidate instanceof AnnotatedBeanDefinition annotatedBeanDefinition) {
					AnnotationConfigUtils.processCommonDefinitionAnnotations(annotatedBeanDefinition);
				}
				if (checkCandidate(beanName, candidate)) {
					BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(candidate, beanName);
					definitionHolder =
							AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
					beanDefinitions.add(definitionHolder);
					registerBeanDefinition(definitionHolder, this.registry);
				}
			}
		}
		return beanDefinitions;
	}
```

- `ClassPathBeanDefinitionScanner`의 `doScan`을 통해 `@Component`를 찾아서 Spring이 시작될 때 빈으로 찾습니다.
