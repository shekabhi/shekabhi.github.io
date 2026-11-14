---
title: "Concurrency in Spring"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, spring-boot, async]
summary: Request threads, singleton beans, @Async and its executor, transactions and security context across threads, and virtual threads in Spring Boot.
catalog: spring-concurrency
series: java-concurrency
questions:
  - q: Are Spring beans thread-safe?
    a: >-
      Not automatically. Beans are singletons by default, so one instance serves every request thread
      at the same time. They're safe when they're stateless (only dependencies and configuration in
      fields, all request data in parameters and local variables). Mutable instance fields are shared
      state and need synchronization, or should move to a request-scoped bean or a parameter.
  - q: How does `@Async` work, and why doesn't calling it from the same class work?
    a: >-
      With `@EnableAsync`, Spring wraps the bean in a proxy. A call through the proxy submits the
      method to a task executor and returns immediately. A call from inside the same class
      (`this.send()`) skips the proxy, so it runs synchronously on the caller's thread. Put the async
      method in another bean, and make it public.
  - q: Which executor does `@Async` use in Spring Boot, and why should you configure it?
    a: >-
      Boot auto-configures a `ThreadPoolTaskExecutor` (`applicationTaskExecutor`) with 8 core threads
      and, by default, an unbounded queue, so under load tasks pile up in memory instead of being
      rejected. Set `spring.task.execution.pool.queue-capacity` and `max-size` (or define your own
      executor bean) so overload is visible. With `spring.threads.virtual.enabled=true`, it uses
      virtual threads instead.
  - q: What happens to an exception thrown by an `@Async` method?
    a: >-
      If the method returns `CompletableFuture` (or `Future`), the exception completes the future
      exceptionally and the caller sees it when it reads the result. If the method returns `void`,
      nobody can see it: it goes to the `AsyncUncaughtExceptionHandler`, which by default only logs
      it.
  - q: Does `@Transactional` work across threads?
    a: >-
      No. Spring binds the transaction (and its database connection) to the current thread. Work
      done in an `@Async` method, a `CompletableFuture` or a new thread is outside the caller's
      transaction: it doesn't see uncommitted changes, isn't rolled back with it, and lazy loading of
      entities from the caller's session can fail with `LazyInitializationException`.
  - q: Why is the logged-in user missing inside an `@Async` method?
    a: >-
      `SecurityContextHolder` uses a `ThreadLocal` by default, and the task runs on an executor
      thread. Wrap the executor in `DelegatingSecurityContextAsyncTaskExecutor`, or add a
      `TaskDecorator` that copies the context (and the logging `MDC`) into the task and clears it
      afterwards.
  - q: A method annotated with `@Async` is called from another method in the same class. Where does it run?
    options:
      - "Synchronously, on the caller's thread"
      - "On the async executor, as usual"
      - "On a new virtual thread"
      - "It throws an exception"
    correct: 1
    a: >-
      `@Async` is applied by a proxy, and internal `this.` calls bypass the proxy. Move the method to
      a separate bean.
  - q: By default, how many threads run `@Scheduled` methods in Spring Boot?
    options:
      - "One"
      - "One per scheduled method"
      - "As many as CPU cores"
      - "200, shared with Tomcat"
    correct: 1
    a: >-
      The default scheduler has a single thread (`spring.task.scheduling.pool.size=1`), so one slow
      job delays all the others. Increase the pool size if jobs can overlap.
  - q: What enables virtual threads for request handling in Spring Boot 3.2+ on Java 21?
    options:
      - "`spring.threads.virtual.enabled=true`"
      - "`server.tomcat.threads.max=1000000`"
      - "`@EnableVirtualThreads`"
      - "Nothing; it's always on with Java 21"
    correct: 1
    a: >-
      With that property, Tomcat request handling, `@Async` tasks and several other executors use
      virtual threads. It's off by default.
  - q: An `@Async void` method throws. Who sees the exception?
    options:
      - "Only the `AsyncUncaughtExceptionHandler`, which logs it by default"
      - "The caller, as a `RuntimeException`"
      - "Tomcat, which returns HTTP 500"
      - "Nobody; Spring retries the method"
    correct: 1
    a: >-
      The caller has already moved on and holds no future to check. Return `CompletableFuture` if
      the caller needs to know about failures.
---

## The idea

A Spring Boot web app is concurrent even if you never create a thread: each request runs on its
own thread from the web server's pool, and they all share the same bean instances. Add
`@Async`, `@Scheduled` or `CompletableFuture`, and work moves between threads, leaving behind
anything stored in `ThreadLocal`s.

## How it works

<figure class="figure" tabindex="0">
<svg viewBox="0 20 760 260" role="img" aria-labelledby="spr-title spr-desc" data-routes='[{"pts": [[105, 72], [365, 72], [645, 72]], "cls": "hi", "w": 2}, {"pts": [[105, 72], [365, 72], [365, 235]], "cls": "bad", "w": 1}]'><title id="spr-title">Threads in a Spring web application</title><desc id="spr-desc">Tomcat takes a thread from its pool for each request. That request thread carries ThreadLocal context: the security context, the current transaction and the logging MDC. It calls singleton beans, which are shared by all request threads. When it calls an @Async method, the work moves to a task executor thread, and none of that ThreadLocal context comes along.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="40" width="170" height="64" rx="10"/><text class="d-text" x="105" y="69" text-anchor="middle">Tomcat thread pool</text><text class="d-sub" x="105" y="87" text-anchor="middle">up to 200 threads</text><rect class="d-box hi" x="250" y="30" width="230" height="84" rx="10"/><text class="d-text" x="365" y="69" text-anchor="middle">Request thread</text><text class="d-sub" x="365" y="87" text-anchor="middle">security · transaction · MDC</text><rect class="d-box" x="550" y="40" width="190" height="64" rx="10"/><text class="d-text" x="645" y="69" text-anchor="middle">Singleton beans</text><text class="d-sub" x="645" y="87" text-anchor="middle">shared by every thread</text><rect class="d-box warn" x="250" y="200" width="230" height="70" rx="10"/><text class="d-text" x="365" y="232" text-anchor="middle">@Async executor thread</text><text class="d-sub" x="365" y="250" text-anchor="middle">none of those contexts</text><line class="d-line" x1="190" y1="72" x2="248" y2="72" marker-end="url(#ah)"/><line class="d-line hi" x1="480" y1="72" x2="548" y2="72" marker-end="url(#ah-hi)"/><text class="d-label hi" x="514" y="62" text-anchor="middle">calls</text><line class="d-line warn" x1="365" y1="114" x2="365" y2="198" marker-end="url(#ah-warn)"/><text class="d-label warn" x="375" y="152" text-anchor="start">@Async call:</text><text class="d-label warn" x="375" y="168" text-anchor="start">ThreadLocal context isn't copied</text></svg>
<figcaption>Two facts explain most Spring concurrency bugs: beans are shared by all request threads, and request context lives in <code>ThreadLocal</code>s that stay behind when work moves to another thread.</figcaption>
</figure>

| Where | Threads | Default |
| --- | --- | --- |
| Tomcat request handling | One per in-flight request | `server.tomcat.threads.max=200` |
| `@Async` methods | `applicationTaskExecutor` | 8 core threads, unbounded queue |
| `@Scheduled` methods | The task scheduler | 1 thread |
| Database access | Limited by the connection pool | HikariCP: 10 connections |
| With `spring.threads.virtual.enabled=true` (Boot 3.2+, Java 21) | Virtual threads | One per request / task |

### Thread-bound context

These are stored in `ThreadLocal`s on the request thread and are **not** available on other
threads unless you copy them:

- `SecurityContextHolder` (the logged-in user)
- The current transaction and its database connection
- `RequestContextHolder` (the current HTTP request)
- The logging `MDC` (trace IDs)

## In code

### A bounded async executor that carries context

```java
@Configuration
@EnableAsync
class AsyncConfig {
    @Bean(name = "applicationTaskExecutor")
    ThreadPoolTaskExecutor applicationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(500);                       // bounded: overload is visible
        executor.setThreadNamePrefix("async-");
        executor.setTaskDecorator(task -> {                   // runs on the submitting thread
            Map<String, String> mdc = MDC.getCopyOfContextMap();
            SecurityContext security = SecurityContextHolder.getContext();
            return () -> {                                    // runs on the async thread
                if (mdc != null) MDC.setContextMap(mdc);
                SecurityContextHolder.setContext(security);
                try {
                    task.run();
                } finally {
                    MDC.clear();
                    SecurityContextHolder.clearContext();
                }
            };
        });
        executor.initialize();
        return executor;
    }
}
```

### `@Async` that callers can wait on

```java
@Service
class ReportService {
    @Async
    public CompletableFuture<Report> build(long customerId) {
        Report report = slowQuery(customerId);       // runs on an "async-" thread
        return CompletableFuture.completedFuture(report);
    }
}

@Service
class DashboardService {
    private final ReportService reports;              // another bean: the call goes through the proxy
    DashboardService(ReportService reports) { this.reports = reports; }

    Dashboard dashboard(long customerId) {
        CompletableFuture<Report> report = reports.build(customerId);
        // ... do other work in parallel ...
        return new Dashboard(report.join());
    }
}
```

### A stateful bean: the classic bug

```java
@Service
class PricingService {
    private Customer currentCustomer;                 // BUG: shared by every request thread

    Price quote(Customer customer, Product product) {
        this.currentCustomer = customer;              // another request can overwrite it here
        return calculate(product);                    // ...and calculate() reads the wrong customer
    }
}
```

Fix: pass `customer` as a parameter to `calculate`, and keep the service stateless.

## Pitfalls

- **Mutable fields in singleton beans**, as above.
- **Calling an `@Async` (or `@Transactional`) method from the same class**, which bypasses the
  proxy.
- **The default unbounded `@Async` queue**, which hides overload until memory runs out.
- **`@Async void` methods** whose failures are only logged.
- **Expecting the caller's transaction, user or trace ID on another thread.**
- **Lazy-loaded JPA entities passed to async code**, which fail outside the original session.
- **Slow `@Scheduled` jobs on the single default scheduler thread**, which delay every other job.
- **More request threads than database connections**: 200 threads waiting on 10 connections
  look like a slow app, not a broken one. Size them together, especially with virtual threads.

## When to use what

| Need | Use |
| --- | --- |
| Fire-and-forget background work | `@Async` method in another bean, on a bounded executor |
| Background work the caller needs | `@Async` returning `CompletableFuture` |
| Periodic jobs | `@Scheduled`, with a pool size above 1 if jobs can overlap |
| User, trace ID or MDC in async code | A `TaskDecorator` or `DelegatingSecurityContextAsyncTaskExecutor` |
| Many blocking requests on Java 21+ | `spring.threads.virtual.enabled=true`, with downstream limits |
| Work that must be in the caller's transaction | Keep it on the same thread |

## Further reading

- [Task execution and scheduling (Spring Boot reference)](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)
- [`@Async` (Spring Framework reference)](https://docs.spring.io/spring-framework/reference/integration/scheduling.html#scheduling-annotation-support-async)
