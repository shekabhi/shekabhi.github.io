---
title: "Futures and CompletableFuture"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, async, completablefuture]
summary: Compose async work without blocking — chaining, combining, timeouts, error handling, and choosing where it runs.
catalog: completable-future
series: java-concurrency
priority: high
questions:
  - q: What can `CompletableFuture` do that a plain `Future` can't?
    a: >-
      A `Future` can only be polled, cancelled, or waited on with a blocking `get()`. A
      `CompletableFuture` can be chained (`thenApply`, `thenCompose`), combined with others
      (`thenCombine`, `allOf`, `anyOf`), given error handlers (`exceptionally`, `handle`), timed out
      (`orTimeout`), and completed manually (`complete`), all without blocking a thread while waiting.
  - q: What's the difference between `thenApply` and `thenCompose`?
    a: >-
      `thenApply` maps the result with a normal function, like `map`. `thenCompose` is for a function
      that itself returns a `CompletableFuture`, like `flatMap`: it flattens the result, so you get
      `CompletableFuture<T>` instead of `CompletableFuture<CompletableFuture<T>>`.
  - q: Which thread runs `supplyAsync` and the callbacks?
    a: >-
      `supplyAsync(supplier)` without an executor runs on `ForkJoinPool.commonPool()`. A callback
      like `thenApply` runs on the thread that completes the previous stage, or on the calling thread
      if that stage is already complete. The `...Async` variants (e.g. `thenApplyAsync`) run on the
      common pool or on the executor you pass.
  - q: How do you handle errors in a chain?
    a: >-
      An exception skips the following normal stages and travels down the chain. `exceptionally(fn)`
      replaces it with a fallback value, `handle((value, error) -> ...)` sees both outcomes and returns
      a new value, and `whenComplete` observes without changing the result. The exception usually
      arrives wrapped in `CompletionException`, so unwrap `getCause()` when you inspect it.
  - q: How do you wait for many futures and collect their results?
    a: >-
      `CompletableFuture.allOf(futures...)` returns a future that completes when all of them have,
      but its type is `CompletableFuture<Void>`. Chain `thenApply(v -> futures.stream().map(CompletableFuture::join).toList())`
      to collect the values; `join()` doesn't block there because they're all done. `anyOf` completes
      with the first result.
  - q: What is the difference between `get()` and `join()`?
    a: >-
      Both block until the result is ready. `get()` throws checked exceptions (`InterruptedException`,
      `ExecutionException`), so it needs try/catch; `join()` throws the unchecked
      `CompletionException`, which is handy inside lambdas and streams.
  - q: Your function returns `CompletableFuture<User>`. Which method chains it without nesting futures?
    options:
      - "`thenCompose`"
      - "`thenApply`"
      - "`thenAccept`"
      - "`thenRun`"
    correct: 1
    a: >-
      `thenApply` would produce `CompletableFuture<CompletableFuture<User>>`. `thenCompose` flattens
      it, like `flatMap`.
  - q: Where does `CompletableFuture.supplyAsync(task)` run when no executor is given?
    options:
      - "`ForkJoinPool.commonPool()`"
      - "A new thread for every call, always"
      - "The calling thread"
      - "A dedicated single-thread executor"
    correct: 1
    a: >-
      The common pool is shared by the whole JVM (and parallel streams), so pass your own executor
      for blocking I/O. (In the rare case the common pool's parallelism is below 2, a new thread is
      used per task.)
  - q: What does `CompletableFuture.allOf(a, b, c)` return?
    options:
      - "A `CompletableFuture<Void>` that completes when all three complete"
      - "A `CompletableFuture<List<T>>` with all three results"
      - "The result of the fastest one"
      - "Nothing; it blocks until all three are done"
    correct: 1
    a: >-
      `allOf` only signals completion. Read the values afterwards with `join()` on each future.
  - q: Does `cancel(true)` on a `CompletableFuture` interrupt the task that's running?
    options:
      - "No: it completes the future exceptionally, but the running code isn't interrupted"
      - "Yes, always"
      - "Only for tasks running in the common pool"
      - "Only if the task calls `Thread.sleep()`"
    correct: 1
    a: >-
      A `CompletableFuture` isn't tied to the thread computing it, so `cancel` just completes it with a
      `CancellationException`. The supplier keeps running unless it checks for cancellation itself.
---

## The idea

A `Future` is a placeholder for a result that isn't ready yet. The only way to use it is to
**block** with `get()`. `CompletableFuture` (Java 8) lets you describe what should happen
**when** the result arrives: transform it, combine it with others, recover from errors. No
thread sits waiting in between.

## How it works

<figure class="figure" tabindex="0">
<svg viewBox="0 10 760 250" role="img" aria-labelledby="cf-title cf-desc" data-routes='[{"pts": [[105, 50], [325, 100], [520, 100], [690, 100]], "cls": "ok", "w": 2}, {"pts": [[105, 150], [325, 100], [520, 100], [690, 100]], "cls": "hi", "w": 2}, {"pts": [[105, 150], [325, 100], [520, 220], [690, 220], [690, 100]], "cls": "bad", "w": 1}]'><title id="cf-title">A CompletableFuture pipeline</title><desc id="cf-desc">Two supplyAsync calls fetch the user and the orders in parallel. thenCombine waits for both, then thenApply builds the page. If any step fails, exceptionally produces a fallback page instead, and the result is still a page.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="20" width="170" height="60" rx="10"/><text class="d-text" x="105" y="47" text-anchor="middle">supplyAsync</text><text class="d-sub" x="105" y="65" text-anchor="middle">fetch user</text><rect class="d-box" x="20" y="120" width="170" height="60" rx="10"/><text class="d-text" x="105" y="147" text-anchor="middle">supplyAsync</text><text class="d-sub" x="105" y="165" text-anchor="middle">fetch orders</text><rect class="d-box hi" x="250" y="70" width="150" height="60" rx="10"/><text class="d-text" x="325" y="97" text-anchor="middle">thenCombine</text><text class="d-sub" x="325" y="115" text-anchor="middle">both done</text><rect class="d-box" x="450" y="70" width="140" height="60" rx="10"/><text class="d-text" x="520" y="97" text-anchor="middle">thenApply</text><text class="d-sub" x="520" y="115" text-anchor="middle">build page</text><rect class="d-box" x="640" y="70" width="100" height="60" rx="10"/><text class="d-text" x="690" y="105" text-anchor="middle">Page</text><rect class="d-box warn" x="450" y="190" width="140" height="60" rx="10"/><text class="d-text" x="520" y="217" text-anchor="middle">exceptionally</text><text class="d-sub" x="520" y="235" text-anchor="middle">fallback page</text><line class="d-line" x1="190" y1="50" x2="248" y2="88" marker-end="url(#ah)"/><line class="d-line" x1="190" y1="150" x2="248" y2="112" marker-end="url(#ah)"/><line class="d-line hi" x1="400" y1="100" x2="448" y2="100" marker-end="url(#ah-hi)"/><line class="d-line" x1="590" y1="100" x2="638" y2="100" marker-end="url(#ah)"/><line class="d-line warn" x1="325" y1="130" x2="448" y2="212" marker-end="url(#ah-warn)"/><text class="d-label warn" x="372" y="184" text-anchor="end">any step fails</text><line class="d-line warn" x1="590" y1="220" x2="690" y2="220"/><line class="d-line warn" x1="690" y1="220" x2="690" y2="132" marker-end="url(#ah-warn)"/></svg>
<figcaption>The two fetches run in parallel, so the page takes as long as the slower one, not the sum. Errors skip the normal steps and land in <code>exceptionally</code>.</figcaption>
</figure>

### Starting

```java
CompletableFuture<User> user = CompletableFuture.supplyAsync(() -> users.find(id), ioPool);
CompletableFuture<Void> audit = CompletableFuture.runAsync(() -> log.write(event), ioPool);
```

### The main operations

| Method | Like | Use it to |
| --- | --- | --- |
| `thenApply(fn)` | `map` | Transform the result |
| `thenCompose(fn)` | `flatMap` | Chain another async call that returns a future |
| `thenCombine(other, fn)` | `zip` | Merge two independent results |
| `thenAccept(consumer)` / `thenRun(runnable)` | | Consume the result / run something after |
| `allOf(...)` / `anyOf(...)` | | Wait for all / for the first |
| `exceptionally(fn)` | `catch` | Replace an error with a fallback value |
| `handle(fn)` | `catch` + `finally` | See value or error, return a new value |
| `whenComplete(action)` | `finally` | Observe the outcome without changing it |
| `orTimeout(t, unit)` / `completeOnTimeout(v, t, unit)` | | Fail, or use a default, after a time limit (Java 9+) |

### Where code runs

- `supplyAsync(fn)` without an executor runs on `ForkJoinPool.commonPool()`.
- A non-async callback (`thenApply`) runs on whichever thread completed the previous stage, or
  on the calling thread if it was already done.
- `thenApplyAsync(fn, executor)` runs the callback on the executor you choose.

## In code: building a page from two services

```java
ExecutorService ioPool = Executors.newFixedThreadPool(32);

CompletableFuture<Page> page(long userId) {
    CompletableFuture<User> user = CompletableFuture
            .supplyAsync(() -> userService.find(userId), ioPool)
            .orTimeout(800, TimeUnit.MILLISECONDS);

    CompletableFuture<List<Order>> orders = CompletableFuture
            .supplyAsync(() -> orderService.recent(userId), ioPool)
            .completeOnTimeout(List.of(), 800, TimeUnit.MILLISECONDS);   // degrade, don't fail

    return user.thenCombine(orders, Page::new)
               .exceptionally(error -> Page.unavailable());
}
```

The two calls run in parallel, so the page takes as long as the slower call, not the sum. If the
user lookup fails or times out, the result is a fallback page. If only the orders call is slow,
the page shows without orders.

### Waiting for many

```java
List<CompletableFuture<Price>> futures = skus.stream()
        .map(sku -> CompletableFuture.supplyAsync(() -> pricing.price(sku), ioPool))
        .toList();

CompletableFuture<List<Price>> all = CompletableFuture
        .allOf(futures.toArray(CompletableFuture[]::new))
        .thenApply(done -> futures.stream().map(CompletableFuture::join).toList());
```

## Pitfalls

- **Blocking I/O on the common pool.** Pass an executor sized for I/O.
- **Calling `get()` / `join()` too early**, which turns async code back into blocking code.
- **Forgetting that `allOf` returns `Void`.** Collect the values with `join()` afterwards.
- **Losing errors**: a chain with no `exceptionally` / `handle`, whose result nobody reads,
  swallows the exception.
- **Inspecting the wrong exception.** It's often wrapped in `CompletionException`; check
  `getCause()`.
- **Expecting `cancel(true)` to stop the work.** It doesn't interrupt the running task.
- **No timeouts.** One slow dependency then holds every request open. Use `orTimeout` or
  `completeOnTimeout`.

## When to use what

| Need | Use |
| --- | --- |
| Run a task and block for its result | `ExecutorService.submit` + `Future.get` |
| Several independent calls in parallel, then combine | `CompletableFuture` + `thenCombine` / `allOf` |
| A chain of dependent async calls | `thenCompose` |
| Lots of blocking calls, simple sequential code (Java 21+) | Virtual threads, plain blocking code |
| Streams of events, back-pressure | A reactive library (Reactor, RxJava) |

## Further reading

- [`CompletableFuture` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)
- [`CompletionStage` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletionStage.html)
