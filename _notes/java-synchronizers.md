---
title: "CountDownLatch, CyclicBarrier and Semaphore"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, synchronizers]
summary: Ready-made tools for making threads wait for each other — one-off start signals, repeated meeting points and limits on concurrency.
catalog: synchronizers
series: java-concurrency
priority: high
questions:
  - q: What is the difference between `CountDownLatch` and `CyclicBarrier`?
    a: >-
      A `CountDownLatch` lets one or more threads wait until a count reaches zero; other threads
      count it down and don't wait themselves. It's single-use. A `CyclicBarrier` makes a fixed
      number of threads wait for each other: each calls `await()` and they all continue together
      when the last arrives. It resets automatically, so it can be reused for each round.
  - q: Can a `CountDownLatch` be reset?
    a: >-
      No. Once the count reaches zero, `await()` returns immediately forever. For a repeating meeting
      point use `CyclicBarrier`; for more flexible phases, or a number of parties that changes, use
      `Phaser`.
  - q: What happens if one thread waiting at a `CyclicBarrier` is interrupted or times out?
    a: >-
      The barrier is broken: that thread gets `InterruptedException` or `TimeoutException`, and all
      the other waiting threads get `BrokenBarrierException`. The barrier stays broken until someone
      calls `reset()`.
  - q: What does a `Semaphore` do, and where is it useful?
    a: >-
      It holds a number of permits. `acquire()` takes one, waiting if none are left, and `release()`
      gives one back. It's used to limit how many threads do something at once, for example at most
      10 concurrent calls to a slow downstream service, or to build a bounded resource pool.
  - q: How is a `Semaphore` different from a lock?
    a: >-
      A lock has an owner: only the thread that locked it can unlock it, and it's usually reentrant.
      A `Semaphore` has no owner: any thread can `release()`, even one that never acquired, which
      increases the number of permits. A semaphore with one permit can act as a mutex, but it isn't
      reentrant.
  - q: What does the barrier action of a `CyclicBarrier` do?
    a: >-
      It's an optional `Runnable` passed to the constructor. It runs once per round, on the last
      thread to arrive, before any of the waiting threads are released, which makes it a good place
      to merge the results of that round.
  - q: The main thread must wait until 3 services have started, once. What fits best?
    options:
      - "`CountDownLatch(3)`"
      - "`CyclicBarrier(3)`"
      - "`Semaphore(3)`"
      - "`Thread.sleep()` long enough"
    correct: 1
    a: >-
      Each service calls `countDown()` when ready, and the main thread calls `await()`. The services
      themselves don't need to wait for each other, which is what a barrier would make them do.
  - q: Which tool is reusable after all parties have met?
    options:
      - "`CyclicBarrier`"
      - "`CountDownLatch`"
      - "Both"
      - "Neither"
    correct: 1
    a: >-
      `CyclicBarrier` resets automatically after each round. A `CountDownLatch` stays at zero once
      it gets there.
  - q: You want at most 10 threads calling a downstream API at the same time. What fits best?
    options:
      - "`Semaphore(10)` around the call"
      - "`CountDownLatch(10)`"
      - "`CyclicBarrier(10)`"
      - "A `synchronized` method"
    correct: 1
    a: >-
      Each caller acquires a permit before the call and releases it in `finally`. A `synchronized`
      method would allow only one call at a time.
  - q: A thread calls `release()` on a `Semaphore` it never acquired. What happens?
    options:
      - "The number of available permits goes up by one"
      - "It throws `IllegalMonitorStateException`"
      - "Nothing; the call is ignored"
      - "The thread blocks"
    correct: 1
    a: >-
      Semaphores don't track owners, so an extra `release()` quietly adds a permit and the limit
      silently grows. Pair every `acquire()` with exactly one `release()` in `finally`.
---

## The idea

Locks protect data. **Synchronizers** coordinate threads: "wait until these three things are
ready", "everyone meet here before the next step", "no more than ten at a time". Java ships
tested implementations, so you don't have to build them from `wait`/`notify`.

## How it works

| Tool | Question it answers | Reusable? |
| --- | --- | --- |
| `CountDownLatch` | "Wait until N events have happened" | No |
| `CyclicBarrier` | "N threads wait for each other, then all continue" | Yes, every round |
| `Semaphore` | "At most N threads at a time" | Yes |
| `Phaser` | Like a barrier, with phases and a changing number of threads | Yes |
| `Exchanger` | "Two threads swap objects at a meeting point" | Yes |

### `CountDownLatch`

Created with a count. Workers call `countDown()`; waiters call `await()` and continue when the
count reaches zero. Counting down never waits.

### `CyclicBarrier`

<figure class="figure" tabindex="0">
<svg viewBox="0 10 760 250" role="img" aria-labelledby="cb-title cb-desc"><title id="cb-title">Three threads meeting at a CyclicBarrier</title><desc id="cb-desc">Threads A, B and C each do step 1, taking different amounts of time. A and B finish early and wait at the barrier. When C, the last one, arrives, all three continue to step 2 together. The same barrier is then used again at the end of step 2.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-text" x="20" y="51">Thread A</text><rect class="d-box" x="130" y="30" width="130" height="32" rx="7"/><text class="d-sub" x="195" y="51" text-anchor="middle">step 1</text><line class="d-line" x1="260" y1="46" x2="420" y2="46" stroke-dasharray="4 5"/><rect class="d-box" x="420" y="30" width="140" height="32" rx="7"/><text class="d-sub" x="490" y="51" text-anchor="middle">step 2</text><line class="d-line" x1="560" y1="46" x2="600" y2="46" stroke-dasharray="4 5"/><text class="d-text" x="20" y="101">Thread B</text><rect class="d-box" x="130" y="80" width="200" height="32" rx="7"/><text class="d-sub" x="230" y="101" text-anchor="middle">step 1</text><line class="d-line" x1="330" y1="96" x2="420" y2="96" stroke-dasharray="4 5"/><rect class="d-box" x="420" y="80" width="180" height="32" rx="7"/><text class="d-sub" x="510" y="101" text-anchor="middle">step 2</text><text class="d-text" x="20" y="151">Thread C</text><rect class="d-box" x="130" y="130" width="290" height="32" rx="7"/><text class="d-sub" x="275" y="151" text-anchor="middle">step 1</text><rect class="d-box" x="420" y="130" width="100" height="32" rx="7"/><text class="d-sub" x="470" y="151" text-anchor="middle">step 2</text><line class="d-line" x1="520" y1="146" x2="600" y2="146" stroke-dasharray="4 5"/><line class="d-line hi" x1="420" y1="20" x2="420" y2="180"/><line class="d-line hi" x1="600" y1="20" x2="600" y2="180"/><text class="d-label hi" x="420" y="200" text-anchor="middle">barrier</text><text class="d-label hi" x="600" y="200" text-anchor="middle">same barrier, reused</text><text class="d-label" x="295" y="26" text-anchor="middle">waits</text><line class="d-line" x1="130" y1="226" x2="740" y2="226" marker-end="url(#ah)"/><text class="d-label" x="740" y="246" text-anchor="end">time</text></svg>
<figcaption>Dashed lines are time spent waiting. Nobody starts step 2 until everybody has finished step 1, and the barrier resets itself for the next round.</figcaption>
</figure>

Created with a number of parties (and optionally a barrier action). Each thread calls
`await()`; the last one to arrive runs the action and releases everyone. Then the barrier
resets for the next round.

### `Semaphore`

Created with a number of permits (optionally fair). `acquire()` takes one or waits;
`tryAcquire(timeout)` gives up after a while; `release()` returns one.

## In code

### Waiting for services to start

```java
CountDownLatch ready = new CountDownLatch(3);

for (String service : List.of("db", "cache", "queue")) {
    new Thread(() -> {
        connect(service);
        ready.countDown();            // doesn't wait
    }).start();
}

if (!ready.await(30, TimeUnit.SECONDS)) {   // the main thread waits for all three
    throw new IllegalStateException("services didn't start in time");
}
```

### Rounds of parallel work

```java
int workers = 4;
CyclicBarrier endOfRound = new CyclicBarrier(workers,
        () -> System.out.println("round finished, merging results"));   // runs once per round

for (int w = 0; w < workers; w++) {
    int id = w;
    new Thread(() -> {
        try {
            for (int round = 0; round < 3; round++) {
                simulateChunk(id, round);
                endOfRound.await();   // wait for the other workers
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (BrokenBarrierException e) {
            // another worker failed: stop this one too
        }
    }).start();
}
```

### Limiting concurrent calls

```java
private final Semaphore permits = new Semaphore(10);

Response callPartner(Request request) throws InterruptedException {
    if (!permits.tryAcquire(200, TimeUnit.MILLISECONDS)) {
        throw new IllegalStateException("partner API is saturated");   // fail fast
    }
    try {
        return partnerClient.send(request);
    } finally {
        permits.release();            // exactly once per successful acquire
    }
}
```

## Pitfalls

- **Forgetting `countDown()` on a failure path.** The waiting thread hangs; call it in
  `finally`, and `await` with a timeout.
- **Reusing a `CountDownLatch`.** It stays open after reaching zero.
- **Ignoring `BrokenBarrierException`.** One failed party breaks the barrier for everyone.
- **More or fewer threads than the barrier's party count.** With fewer, they wait forever.
- **`release()` without a successful `acquire()`** (for example, in `finally` after a failed
  `tryAcquire`), which silently adds permits.
- **Using a `Semaphore` as a reentrant lock.** A thread that acquires twice with one permit
  blocks itself.

## When to use what

| Need | Use |
| --- | --- |
| Wait for N tasks or events, once | `CountDownLatch` (or `invokeAll` / `CompletableFuture.allOf`) |
| Threads working in rounds | `CyclicBarrier` |
| Rounds where threads join and leave | `Phaser` |
| Limit concurrency to a resource | `Semaphore` |
| Wait for one task's result | `Future` / `CompletableFuture` |
| Pass data between producers and consumers | A `BlockingQueue` |

## Further reading

- [`CountDownLatch` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CountDownLatch.html)
- [`CyclicBarrier` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CyclicBarrier.html)
- [`Semaphore` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Semaphore.html)
