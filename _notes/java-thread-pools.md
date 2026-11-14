---
title: "Executors and ThreadPoolExecutor"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, thread-pools, executors]
summary: How thread pools decide what to do with each task, how to size and configure them, and how to shut them down cleanly.
catalog: thread-pools
series: java-concurrency
priority: high
questions:
  - q: Why use a thread pool instead of creating a thread per task?
    a: >-
      Creating a platform thread is expensive (an OS thread and a stack), and an unlimited number of
      them can exhaust memory or thrash the CPU. A pool reuses a fixed set of threads, caps
      concurrency, queues work when busy, and gives one place to configure naming, error handling
      and shutdown.
  - q: In what order does `ThreadPoolExecutor` decide what to do with a new task?
    a: >-
      If fewer than `corePoolSize` threads are running, it starts a new thread, even if others are
      idle. Otherwise it puts the task in the queue. If the queue is full and fewer than
      `maximumPoolSize` threads are running, it starts an extra thread. Otherwise it rejects the task
      and calls the `RejectedExecutionHandler`.
  - q: What's wrong with `Executors.newFixedThreadPool()` and `newCachedThreadPool()` in a server?
    a: >-
      `newFixedThreadPool` (and `newSingleThreadExecutor`) use an unbounded `LinkedBlockingQueue`, so
      under overload tasks pile up until the JVM runs out of memory. `newCachedThreadPool` has a
      maximum of `Integer.MAX_VALUE` threads, so a burst can create thousands of threads. In
      production, build a `ThreadPoolExecutor` with a bounded queue and an explicit rejection policy.
  - q: How do you size a thread pool?
    a: >-
      For CPU-bound work, about the number of cores (`Runtime.getRuntime().availableProcessors()`),
      since more threads only add switching. For I/O-bound work, more threads, roughly
      `cores × (1 + wait time / compute time)`. Treat that as a starting point and measure;
      the real limit is often a downstream resource such as the database connection pool.
  - q: What is the difference between `shutdown()` and `shutdownNow()`?
    a: >-
      `shutdown()` stops accepting new tasks but lets running and queued tasks finish.
      `shutdownNow()` also interrupts running tasks and returns the queued tasks that never started.
      Neither waits: call `awaitTermination(timeout)` afterwards. The usual pattern is `shutdown()`,
      wait, then `shutdownNow()` if it didn't finish in time.
  - q: What happens to an exception thrown by a task?
    a: >-
      With `execute()`, it propagates out of the worker thread, which dies and is replaced, and the
      uncaught exception handler prints it. With `submit()`, it's caught and stored in the `Future`,
      and only rethrown (wrapped in `ExecutionException`) when someone calls `get()`. If nobody does,
      the error disappears silently.
  - q: "A pool has core 4, max 8 and an unbounded `LinkedBlockingQueue`. Under heavy load, how many threads run?"
    options:
      - "4: extra threads are only created when the queue is full, and it never is"
      - "8"
      - "As many as there are tasks"
      - "1"
    correct: 1
    a: >-
      With an unbounded queue, every task beyond the core threads is queued, so `maximumPoolSize` is
      never used. This is one of the most common thread-pool misconfigurations.
  - q: Which rejection policy slows producers down by running the task on the submitting thread?
    options:
      - "`CallerRunsPolicy`"
      - "`AbortPolicy`"
      - "`DiscardPolicy`"
      - "`DiscardOldestPolicy`"
    correct: 1
    a: >-
      `CallerRunsPolicy` makes the caller do the work, which naturally throttles how fast it submits.
      `AbortPolicy` (the default) throws `RejectedExecutionException`, and the two discard policies
      drop a task silently.
  - q: Which pool runs parallel streams and `CompletableFuture.supplyAsync()` without an executor?
    options:
      - "`ForkJoinPool.commonPool()`"
      - "A new cached thread pool per call"
      - "The thread that calls the method"
      - "A single shared background thread"
    correct: 1
    a: >-
      Both default to the common fork-join pool, sized to the number of cores minus one. Blocking I/O
      in it can starve every other user of that pool, so pass your own executor for I/O work.
  - q: You `submit()` a task that throws, and never call `get()`. What do you see?
    options:
      - "Nothing: the exception is stored in the Future and silently lost"
      - "A stack trace printed by the worker thread"
      - "The pool shuts down"
      - "The exception is thrown to the code that called `submit()`"
    correct: 1
    a: >-
      `submit()` captures the exception in the returned `Future`. Always call `get()`, use
      `execute()` for fire-and-forget tasks, or catch and log inside the task.
---

## The idea

A **thread pool** keeps a set of worker threads and a queue of tasks. You hand it work; it
decides whether to run it now, queue it, start another thread, or refuse it. In Java the
interface is `ExecutorService`, and the main implementation is `ThreadPoolExecutor`.

## How it works

### The seven settings

```java
new ThreadPoolExecutor(
    corePoolSize,      // threads kept even when idle
    maximumPoolSize,   // upper limit, used only when the queue is full
    keepAliveTime,     // idle time before extra (non-core) threads exit
    unit,
    workQueue,         // where tasks wait: bounded or not decides a lot
    threadFactory,     // names, daemon flag, uncaught-exception handler
    handler            // what happens when the pool is saturated
);
```

### What happens on `submit()`

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 260" role="img" aria-labelledby="tpe-title tpe-desc" data-routes='[{"pts": [[100, 10], [100, 72], [290, 72], [290, 212]], "cls": "hi", "w": 3}, {"pts": [[100, 10], [100, 72], [100, 212]], "cls": "ok", "w": 1}, {"pts": [[100, 10], [100, 72], [290, 72], [480, 72], [480, 212]], "cls": "ev", "w": 1}, {"pts": [[100, 10], [100, 72], [290, 72], [480, 72], [665, 72]], "cls": "bad", "w": 1}]'><title id="tpe-title">What happens when you submit a task to ThreadPoolExecutor</title><desc id="tpe-desc">First, if fewer than corePoolSize threads are running, a new core thread runs the task. Otherwise the task goes into the queue if it has room. If the queue is full and fewer than maximumPoolSize threads are running, a new extra thread runs it. Otherwise the task is rejected and the rejection handler decides what happens.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="40" width="160" height="64" rx="10"/><text class="d-text" x="100" y="77" text-anchor="middle">threads &lt; core?</text><rect class="d-box" x="210" y="40" width="160" height="64" rx="10"/><text class="d-text" x="290" y="77" text-anchor="middle">queue has room?</text><rect class="d-box" x="400" y="40" width="160" height="64" rx="10"/><text class="d-text" x="480" y="77" text-anchor="middle">threads &lt; max?</text><rect class="d-box warn" x="590" y="40" width="150" height="64" rx="10"/><text class="d-text" x="665" y="69" text-anchor="middle">Rejected</text><text class="d-sub" x="665" y="87" text-anchor="middle">handler decides</text><rect class="d-box" x="20" y="180" width="160" height="64" rx="10"/><text class="d-text" x="100" y="209" text-anchor="middle">New core thread</text><text class="d-sub" x="100" y="227" text-anchor="middle">runs the task</text><rect class="d-box hi" x="210" y="180" width="160" height="64" rx="10"/><text class="d-text" x="290" y="209" text-anchor="middle">Queued</text><text class="d-sub" x="290" y="227" text-anchor="middle">until a thread is free</text><rect class="d-box" x="400" y="180" width="160" height="64" rx="10"/><text class="d-text" x="480" y="209" text-anchor="middle">New extra thread</text><text class="d-sub" x="480" y="227" text-anchor="middle">runs the task</text><line class="d-line" x1="180" y1="72" x2="208" y2="72" marker-end="url(#ah)"/><text class="d-label" x="194" y="62" text-anchor="middle">no</text><line class="d-line" x1="370" y1="72" x2="398" y2="72" marker-end="url(#ah)"/><text class="d-label" x="384" y="62" text-anchor="middle">no</text><line class="d-line warn" x1="560" y1="72" x2="588" y2="72" marker-end="url(#ah-warn)"/><text class="d-label warn" x="574" y="62" text-anchor="middle">no</text><line class="d-line" x1="100" y1="104" x2="100" y2="178" marker-end="url(#ah)"/><text class="d-label" x="110" y="146" text-anchor="start">yes</text><line class="d-line hi" x1="290" y1="104" x2="290" y2="178" marker-end="url(#ah-hi)"/><text class="d-label hi" x="300" y="146" text-anchor="start">yes</text><line class="d-line" x1="480" y1="104" x2="480" y2="178" marker-end="url(#ah)"/><text class="d-label" x="490" y="146" text-anchor="start">yes</text></svg>
<figcaption>The order surprises people: extra threads beyond the core size are only created when the queue is <strong>full</strong>. With an unbounded queue, the pool never grows past its core size.</figcaption>
</figure>

### Queues

| Queue | Behaviour | Typical use |
| --- | --- | --- |
| `ArrayBlockingQueue(n)` | Bounded | Production pools with back-pressure |
| `LinkedBlockingQueue()` | Unbounded unless you pass a capacity | `newFixedThreadPool`; risky under overload |
| `SynchronousQueue` | No capacity: hands a task directly to a thread | `newCachedThreadPool` |
| `PriorityBlockingQueue` | Unbounded, ordered by priority | Priority work |

### Rejection policies

| Policy | On a saturated pool |
| --- | --- |
| `AbortPolicy` (default) | Throws `RejectedExecutionException` |
| `CallerRunsPolicy` | Runs the task on the submitting thread, which slows the producer |
| `DiscardPolicy` | Drops the new task silently |
| `DiscardOldestPolicy` | Drops the oldest queued task, then retries |

### The `Executors` factory methods

| Method | What you actually get | Risk |
| --- | --- | --- |
| `newFixedThreadPool(n)` | n threads, unbounded queue | Out of memory under overload |
| `newSingleThreadExecutor()` | 1 thread, unbounded queue | Same |
| `newCachedThreadPool()` | 0 core, `Integer.MAX_VALUE` max, `SynchronousQueue` | Thousands of threads in a burst |
| `newScheduledThreadPool(n)` | Delayed/periodic tasks, unbounded queue | Same as fixed |
| `newVirtualThreadPerTaskExecutor()` | A new virtual thread per task (Java 21) | Fine for blocking work; limit downstream calls separately |

### Sizing

- **CPU-bound** (computation): about `availableProcessors()` threads.
- **I/O-bound** (waiting on network or disk): `cores × (1 + wait / compute)`, e.g. 8 cores and
  tasks that wait 90 ms per 10 ms of CPU → 8 × 10 = 80 threads.
- Check the bottleneck: 80 threads sharing a 10-connection database pool still do 10 queries at
  a time.

## In code

### A production-style pool

```java
ThreadFactory named = new ThreadFactory() {
    private final AtomicInteger n = new AtomicInteger();
    public Thread newThread(Runnable r) {
        Thread t = new Thread(r, "orders-worker-" + n.incrementAndGet());
        t.setUncaughtExceptionHandler((th, e) -> System.err.println(th.getName() + " failed: " + e));
        return t;
    }
};

ThreadPoolExecutor pool = new ThreadPoolExecutor(
        8, 16,                                   // core, max
        60, TimeUnit.SECONDS,                    // extra threads exit after 60 s idle
        new ArrayBlockingQueue<>(500),           // bounded: back-pressure instead of OOM
        named,
        new ThreadPoolExecutor.CallerRunsPolicy());
```

### Shutting down cleanly

```java
static void shutdownGracefully(ExecutorService pool) {
    pool.shutdown();                                         // no new tasks
    try {
        if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
            List<Runnable> neverStarted = pool.shutdownNow(); // interrupt running tasks
            System.err.println(neverStarted.size() + " tasks never ran");
            pool.awaitTermination(10, TimeUnit.SECONDS);
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();
    }
}
```

On Java 19+, `ExecutorService` is `AutoCloseable`: `try (var pool = ...) { ... }` calls
`close()`, which shuts down and waits for the tasks to finish.

## Pitfalls

- **Unbounded queues** hide overload until memory runs out, and make `maximumPoolSize` useless.
- **Expecting max threads before the queue fills.** The queue is filled first.
- **Lost exceptions from `submit()`** when nobody calls `get()`.
- **Blocking I/O in the common fork-join pool** (parallel streams, default `supplyAsync`), which
  starves every other user of it.
- **Tasks waiting for other tasks in the same bounded pool.** If all threads wait for queued
  tasks, the pool deadlocks.
- **Never shutting a pool down.** Its non-daemon threads keep the JVM from exiting.
- **Unnamed threads** (`pool-3-thread-7`), which make thread dumps hard to read.
- **Forgetting `ThreadLocal` cleanup**: pooled threads are reused, so values leak between tasks.

## When to use what

| Need | Use |
| --- | --- |
| General work in a server | `ThreadPoolExecutor` with a bounded queue and named threads |
| Many blocking tasks (Java 21+) | `Executors.newVirtualThreadPerTaskExecutor()` |
| Delayed or periodic jobs | `ScheduledThreadPoolExecutor` (or a scheduler in Spring) |
| Divide-and-conquer computation | `ForkJoinPool` with `RecursiveTask` |
| Quick scripts and tests | The `Executors` factory methods are fine |

## Further reading

- [`ThreadPoolExecutor` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)
- [`ExecutorService` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ExecutorService.html)
