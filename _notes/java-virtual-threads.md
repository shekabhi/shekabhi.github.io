---
title: "Virtual threads and structured concurrency"
short_title: "Virtual threads in Java"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, virtual-threads, loom]
summary: Cheap threads for blocking work in Java 21+ — how they run, when they help, what pinning is, and how they change thread pools.
catalog: virtual-threads
series: java-concurrency
priority: high
questions:
  - q: What is a virtual thread?
    a: >-
      A `Thread` managed by the JVM instead of the operating system (final in Java 21). Many virtual
      threads share a few carrier threads, which are ordinary platform threads in a fork-join pool.
      A virtual thread's stack lives on the heap, so creating one costs about as much as creating an
      object, and you can have millions.
  - q: What happens when a virtual thread blocks?
    a: >-
      For most blocking operations (socket I/O, `sleep`, `BlockingQueue.take`, `Lock`s, waiting on a
      future) the JVM unmounts it: it saves its stack to the heap and frees the carrier to run
      another virtual thread. When the operation completes, the virtual thread is scheduled again,
      possibly on a different carrier.
  - q: When do virtual threads help, and when don't they?
    a: >-
      They help with many concurrent tasks that spend most of their time waiting: HTTP calls,
      database queries, message handling. They let plain blocking code scale like async code. They
      don't make CPU-bound work faster, since the number of carriers is still about the number of
      cores, and they don't add capacity to a database that only has 10 connections.
  - q: What is pinning?
    a: >-
      A virtual thread is pinned when it blocks but can't be unmounted, so it ties up its carrier. In
      Java 21–23 this happened when blocking inside a `synchronized` block or method; Java 24 removed
      that case (JEP 491). It still happens while running native code (JNI) or blocking inside some
      class initializers. With few carriers, a lot of pinning can stall the application. The JFR
      event `jdk.VirtualThreadPinned` reports it.
  - q: Should you pool virtual threads?
    a: >-
      No. Pools exist because platform threads are expensive; virtual threads aren't, so create one
      per task (`Executors.newVirtualThreadPerTaskExecutor()`). To limit how many tasks hit a scarce
      resource at once, use a `Semaphore` or the resource's own pool, not a fixed-size thread pool.
  - q: What is structured concurrency?
    a: >-
      An API (`StructuredTaskScope`, still a preview feature) that treats a group of subtasks as one
      unit: you fork them inside a scope, join them, and the scope makes sure they all finish or are
      cancelled before the block exits. If one fails, the others can be cancelled automatically, so
      no subtask is left running in the background.
  - q: How do you create a virtual thread per task?
    options:
      - "`Executors.newVirtualThreadPerTaskExecutor()`"
      - "`Executors.newFixedThreadPool(1_000_000)`"
      - "`new Thread(r).setVirtual(true)`"
      - "`ForkJoinPool.commonPool().submit(r)`"
    correct: 1
    a: >-
      You can also use `Thread.ofVirtual().start(r)` or `Thread.startVirtualThread(r)`. There's no
      `setVirtual` method; a thread is virtual or not from creation.
  - q: Which workload gains the most from virtual threads?
    options:
      - "10,000 concurrent requests that each wait on HTTP and database calls"
      - "Resizing a large image on all CPU cores"
      - "A tight loop computing prime numbers"
      - "A single long-running batch job"
    correct: 1
    a: >-
      Virtual threads make waiting cheap. CPU-bound work is limited by the number of cores either
      way.
  - q: Your app moves to virtual threads and opens 5,000 database queries at once against a 10-connection pool. What limits throughput?
    options:
      - "The connection pool: only 10 queries can run at a time"
      - "Nothing; virtual threads remove the limit"
      - "The number of carrier threads"
      - "The garbage collector"
    correct: 1
    a: >-
      Virtual threads remove the thread bottleneck, which exposes the next one. The other 4,990
      tasks wait for a connection; size the pool for the database and limit concurrency with a
      `Semaphore` if needed.
  - q: In Java 21, which of these pins a virtual thread to its carrier?
    options:
      - "Blocking on I/O inside a `synchronized` block"
      - "`Thread.sleep()` outside any lock"
      - "Waiting on a `ReentrantLock`"
      - "`BlockingQueue.take()`"
    correct: 1
    a: >-
      In Java 21–23, a virtual thread can't unmount while it holds a monitor, so blocking inside
      `synchronized` pins it. The other three unmount normally. Java 24 fixed the `synchronized`
      case.
---

## The idea

For years, Java servers used one platform thread per request. Platform threads are OS threads:
each reserves memory for its stack and costs a context switch, so a server could afford a few
hundred. When requests mostly wait on databases and HTTP calls, those threads sit idle, and
the only way to scale further was complex asynchronous code.

**Virtual threads** (Java 21) keep the simple style, one thread per task with plain blocking
code, but make threads so cheap that you can have millions.

## How it works

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 300" role="img" aria-labelledby="vt-title vt-desc" data-routes='[{"pts": [[80, 44], [200, 168], [220, 262]], "cls": "hi", "w": 1}, {"pts": [[320, 44], [420, 168], [440, 262]], "cls": "ok", "w": 1}, {"pts": [[560, 44], [640, 168]], "cls": "ev", "w": 1}]'><title id="vt-title">Virtual threads mounted on carrier threads</title><desc id="vt-desc">Many virtual threads share a few carrier threads, which are ordinary platform threads running on the CPU cores. A virtual thread that is running is mounted on a carrier. When it blocks, for example waiting for I/O, it is unmounted: its stack is saved on the heap and the carrier is free to run another virtual thread.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="380" y="14" text-anchor="middle">millions possible, cheap to create</text><rect class="d-box" x="30" y="24" width="100" height="40" rx="10"/><text class="d-text" x="80" y="49" text-anchor="middle">virtual 1</text><rect class="d-box" x="150" y="24" width="100" height="40" rx="10"/><text class="d-text" x="200" y="49" text-anchor="middle">virtual 2</text><rect class="d-box" x="270" y="24" width="100" height="40" rx="10"/><text class="d-text" x="320" y="49" text-anchor="middle">virtual 3</text><rect class="d-box" x="390" y="24" width="100" height="40" rx="10"/><text class="d-text" x="440" y="49" text-anchor="middle">virtual 4</text><rect class="d-box" x="510" y="24" width="100" height="40" rx="10"/><text class="d-text" x="560" y="49" text-anchor="middle">virtual 5</text><rect class="d-box" x="630" y="24" width="100" height="40" rx="10"/><text class="d-text" x="680" y="49" text-anchor="middle">virtual 6</text><rect class="d-box hi" x="130" y="140" width="180" height="56" rx="10"/><text class="d-text" x="220" y="165" text-anchor="middle">Carrier 1</text><text class="d-sub" x="220" y="183" text-anchor="middle">platform thread</text><rect class="d-box hi" x="350" y="140" width="180" height="56" rx="10"/><text class="d-text" x="440" y="165" text-anchor="middle">Carrier 2</text><text class="d-sub" x="440" y="183" text-anchor="middle">platform thread</text><rect class="d-box" x="570" y="132" width="170" height="72" rx="10"/><text class="d-text" x="655" y="165" text-anchor="middle">Parked</text><text class="d-sub" x="655" y="183" text-anchor="middle">waiting for I/O,</text><text class="d-sub" x="655" y="199" text-anchor="middle">stack on the heap</text><rect class="d-box" x="130" y="240" width="400" height="44" rx="10"/><text class="d-text" x="330" y="267" text-anchor="middle">CPU cores</text><line class="d-line hi" x1="80" y1="64" x2="200" y2="138" marker-end="url(#ah-hi)"/><line class="d-line hi" x1="320" y1="64" x2="420" y2="138" marker-end="url(#ah-hi)"/><text class="d-label hi" x="110" y="108" text-anchor="end">mounted</text><line class="d-line" x1="560" y1="64" x2="640" y2="130" stroke-dasharray="4 5" marker-end="url(#ah)"/><line class="d-line" x1="680" y1="64" x2="680" y2="130" stroke-dasharray="4 5" marker-end="url(#ah)"/><text class="d-label" x="690" y="108" text-anchor="start">unmounted</text><line class="d-line" x1="220" y1="196" x2="220" y2="238" marker-end="url(#ah)"/><line class="d-line" x1="440" y1="196" x2="440" y2="238" marker-end="url(#ah)"/></svg>
<figcaption>Blocking a virtual thread costs almost nothing: it steps off its carrier until the I/O completes. Platform threads can’t do that, which is why they had to be pooled.</figcaption>
</figure>

- A small pool of **carrier threads** (a `ForkJoinPool`, one per core by default) runs virtual
  threads.
- When a virtual thread blocks on I/O, a lock, `sleep` or a queue, it is **unmounted**: its
  stack is copied to the heap and the carrier picks up another virtual thread.
- When the operation completes, the virtual thread is **mounted** again, often on a different
  carrier.
- It's still a `java.lang.Thread`: debuggers, stack traces and `ThreadLocal` work as usual.

| Aspect | Platform thread | Virtual thread |
| --- | --- | --- |
| Managed by | The operating system | The JVM |
| Creation cost | Expensive; pooled | Cheap; one per task |
| Practical count | Hundreds to a few thousand | Millions |
| Blocking | Holds an OS thread | Releases its carrier (unless pinned) |
| Best for | CPU-bound work, long-lived workers | Many tasks that mostly wait |

### Pinning

A virtual thread that blocks while it can't be unmounted is **pinned** and keeps its carrier
busy. Causes: blocking inside `synchronized` (Java 21–23 only; fixed in Java 24 by JEP 491),
native code, and some class initialization. Find it with the JFR event
`jdk.VirtualThreadPinned`.

### Structured concurrency

`StructuredTaskScope` (a preview API) groups related subtasks: fork them in a scope, join,
and the scope guarantees none outlive the block. If one fails, the others are cancelled. The
API has changed between previews, so check the docs for your JDK version before using it.

## In code

### One virtual thread per task

```java
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> pages = urls.stream()
            .map(url -> executor.submit(() -> fetch(url)))   // blocking call, cheap thread
            .toList();
    for (Future<String> page : pages) {
        process(page.get());
    }
}   // close() waits for all tasks
```

### Limiting a scarce resource

```java
private final Semaphore dbPermits = new Semaphore(10);   // match the connection pool

Order load(long id) throws InterruptedException {
    dbPermits.acquire();
    try {
        return repository.findById(id);
    } finally {
        dbPermits.release();
    }
}
```

### Other ways to start one

```java
Thread t1 = Thread.ofVirtual().name("importer").start(() -> importFile(path));
Thread t2 = Thread.startVirtualThread(() -> sendEmail(order));
```

In Spring Boot 3.2+ on Java 21, `spring.threads.virtual.enabled=true` runs request handling and
`@Async` tasks on virtual threads.

## Pitfalls

- **Pooling virtual threads.** Create one per task; limit resources with semaphores.
- **Expecting CPU-bound speed-ups.** There are still only as many carriers as cores.
- **Pinning on Java 21–23**: long blocking calls inside `synchronized`. Upgrade, or use
  `ReentrantLock` there.
- **Large `ThreadLocal` values.** A million threads each holding a copy add up; consider scoped
  values.
- **Unbounded fan-out to downstream services.** Cheap threads make it easy to overwhelm a
  database or an API.
- **Assuming thread identity is stable.** A virtual thread can resume on a different carrier, so
  never rely on the carrier thread (e.g. carrier-level caches).

## When to use what

| Workload | Use |
| --- | --- |
| Many concurrent blocking tasks (HTTP, DB, messaging) | Virtual threads |
| CPU-heavy computation | A platform thread pool sized to the cores, or `ForkJoinPool` |
| Limiting access to a resource | `Semaphore`, connection pools |
| A group of subtasks that must finish together | Structured concurrency (preview) or `CompletableFuture.allOf` |
| Event streams with back-pressure | Reactive libraries |

## Further reading

- [JEP 444: Virtual Threads](https://openjdk.org/jeps/444)
- [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)
- [Virtual threads guide (Oracle)](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)
