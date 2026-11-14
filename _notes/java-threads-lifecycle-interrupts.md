---
title: "Threads in Java: lifecycle, start vs run, and interrupts"
short_title: "Java threads: lifecycle and interrupts"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, threads]
summary: How a thread is created, waits and ends, why run() is not start(), and how to stop a thread properly.
catalog: thread-basics
series: java-concurrency
priority: high
questions:
  - q: What is the difference between `start()` and `run()`?
    a: >-
      `start()` asks the JVM to create a new thread, which then calls `run()`. Calling `run()`
      directly is an ordinary method call: the code runs on the current thread and nothing runs
      in parallel. A thread can only be started once.
  - q: What is the difference between the BLOCKED and WAITING states?
    a: >-
      BLOCKED means the thread wants a monitor lock (to enter or re-enter a `synchronized` block)
      that another thread holds. WAITING means it is waiting, with no time limit, for another
      thread to act: `wait()`, `join()` or `LockSupport.park()`. With a timeout, the same calls
      give TIMED_WAITING. Threads waiting on a `ReentrantLock` show as WAITING, because the lock
      parks them; they are not BLOCKED.
  - q: How is `sleep()` different from `wait()`?
    a: >-
      `Thread.sleep()` pauses the current thread for a time and keeps any locks it holds.
      `Object.wait()` must be called while holding that object's monitor; it releases the monitor
      and waits until `notify()`/`notifyAll()`, a timeout, an interrupt, or a spurious wakeup, then
      takes the monitor back before returning.
  - q: How do you stop a thread safely?
    a: >-
      Ask it to stop with `interrupt()`, and write the thread so it checks
      `Thread.currentThread().isInterrupted()` and treats `InterruptedException` as a signal to
      finish. With executors, use `Future.cancel(true)` or `shutdownNow()`, which interrupt the
      worker. `Thread.stop()` is unsafe and no longer works (it throws
      `UnsupportedOperationException` since Java 20).
  - q: What happens when a thread throws an exception nobody catches?
    a: >-
      Only that thread ends; other threads keep running. The thread's
      `UncaughtExceptionHandler` (or the default one, which prints the stack trace) is called.
      With `ExecutorService.submit()`, the exception is stored in the `Future` and rethrown,
      wrapped in `ExecutionException`, when you call `get()`.
  - q: What is a daemon thread?
    a: >-
      A background thread that doesn't keep the JVM alive: the JVM exits when only daemon threads
      remain, without waiting for them, so their `finally` blocks may not run. Call
      `setDaemon(true)` before `start()`; afterwards it throws `IllegalThreadStateException`.
  - q: What happens if you call `start()` twice on the same `Thread`?
    options:
      - "It throws `IllegalThreadStateException`"
      - "The `run()` method runs a second time"
      - "The second call is silently ignored"
      - "The thread restarts from the beginning"
    correct: 1
    a: >-
      A `Thread` object can only be started once. The second `start()` throws
      `IllegalThreadStateException`. To run the work again, create a new thread or submit the
      task to an executor.
  - q: A thread is waiting to enter a `synchronized` block that another thread holds. What is its state?
    options:
      - "BLOCKED"
      - "WAITING"
      - "TIMED_WAITING"
      - "RUNNABLE"
    correct: 1
    a: >-
      Waiting for a monitor lock is exactly what BLOCKED means. WAITING and TIMED_WAITING are for
      `wait()`, `join()`, `park()` and their timed versions.
  - q: Which of these releases the monitor while it waits?
    options:
      - "`Object.wait()`"
      - "`Thread.sleep()`"
      - "`Thread.yield()`"
      - "A busy loop that checks a flag"
    correct: 1
    a: >-
      `wait()` releases the monitor of the object it's called on and takes it back before
      returning. `sleep()` and `yield()` keep every lock the thread holds, and a busy loop holds
      locks and burns CPU.
  - q: Your code catches `InterruptedException` but can't rethrow it. What should it do?
    options:
      - "Restore the flag with `Thread.currentThread().interrupt()`"
      - "Ignore it and carry on"
      - "Call `Thread.stop()` on the current thread"
      - "Call `System.exit(1)`"
    correct: 1
    a: >-
      Throwing `InterruptedException` clears the interrupt flag. Setting it again keeps the
      cancellation request visible to code further up the stack, such as a thread pool that is
      shutting down. Ignoring it loses the request.
---

## The idea

A **thread** is an independent path of execution inside a process. Threads in the same
process share the heap (objects, static fields), but each has its own stack and program
counter. That sharing is what makes threads fast to communicate, and what makes concurrency
bugs possible.

In Java, a classic `Thread` is a **platform thread**, backed one-to-one by an operating-system
thread. Java 21 adds lightweight **virtual threads**, covered later in this series.

## How it works

### Creating a thread

```java
// 1. Pass a Runnable (preferred: the task is separate from the thread)
Thread t = new Thread(() -> System.out.println("hello from " + Thread.currentThread().getName()));
t.start();

// 2. Need a result? Use Callable with an executor instead of a raw thread
try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
    Future<Integer> answer = pool.submit(() -> 6 * 7);
    System.out.println(answer.get());   // 42
}
```

`ExecutorService` is `AutoCloseable` since Java 19, so try-with-resources shuts the pool down
and waits for the tasks.

### `start()` vs `run()`

```java
Thread t = new Thread(() -> System.out.println(Thread.currentThread().getName()));
t.run();    // prints "main": just a method call on the current thread
t.start();  // prints "Thread-0": runs on the new thread
t.start();  // IllegalThreadStateException: a thread starts only once
```

### The six states

| State | What it means | How a thread gets there |
| --- | --- | --- |
| `NEW` | Created; `start()` not called yet | `new Thread(...)` |
| `RUNNABLE` | Running, or ready to run | `start()`; also while blocked in I/O, from the JVM's view |
| `BLOCKED` | Waiting for a monitor lock | Entering a `synchronized` block another thread holds |
| `WAITING` | Waiting with no time limit | `wait()`, `join()`, `LockSupport.park()` |
| `TIMED_WAITING` | Waiting with a time limit | `sleep(ms)`, `wait(ms)`, `join(ms)`, `parkNanos()` |
| `TERMINATED` | Finished | `run()` returned or threw |

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 380" role="img" aria-labelledby="ts-title ts-desc" data-routes='[{"pts": [[140, 188], [300, 188], [470, 188], [630, 188]], "cls": "hi", "w": 2}, {"pts": [[140, 188], [300, 188], [365, 150], [365, 82], [405, 82], [405, 150], [470, 188], [630, 188]], "cls": "bad", "w": 1}, {"pts": [[140, 188], [300, 188], [340, 226], [270, 300], [340, 226], [470, 188], [630, 188]], "cls": "ev", "w": 1}, {"pts": [[140, 188], [300, 188], [430, 226], [500, 300], [430, 226], [470, 188], [630, 188]], "cls": "ok", "w": 1}]'><title id="ts-title">Java thread states</title><desc id="ts-desc">NEW goes to RUNNABLE on start(). RUNNABLE goes to TERMINATED when run() ends. RUNNABLE goes to BLOCKED when a monitor lock is held by another thread, and back when the lock is acquired. RUNNABLE goes to WAITING on wait(), join() or park(), and back on notify(), unpark() or when the joined thread ends. RUNNABLE goes to TIMED_WAITING on sleep(ms), wait(ms) or join(ms), and back when the time is up, on notify() or on interrupt.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="160" width="120" height="56" rx="10"/><text class="d-text" x="80" y="185" text-anchor="middle">NEW</text><text class="d-sub" x="80" y="203" text-anchor="middle">created</text><rect class="d-box hi" x="300" y="150" width="170" height="76" rx="10"/><text class="d-text" x="385" y="185" text-anchor="middle">RUNNABLE</text><text class="d-sub" x="385" y="203" text-anchor="middle">running or ready</text><rect class="d-box" x="630" y="160" width="120" height="56" rx="10"/><text class="d-text" x="690" y="185" text-anchor="middle">TERMINATED</text><text class="d-sub" x="690" y="203" text-anchor="middle">finished</text><rect class="d-box" x="300" y="10" width="170" height="72" rx="10"/><text class="d-text" x="385" y="43" text-anchor="middle">BLOCKED</text><text class="d-sub" x="385" y="61" text-anchor="middle">waiting for a lock</text><rect class="d-box" x="130" y="300" width="210" height="66" rx="10"/><text class="d-text" x="235" y="330" text-anchor="middle">WAITING</text><text class="d-sub" x="235" y="348" text-anchor="middle">until notify / unpark / join ends</text><rect class="d-box" x="420" y="300" width="220" height="66" rx="10"/><text class="d-text" x="530" y="330" text-anchor="middle">TIMED_WAITING</text><text class="d-sub" x="530" y="348" text-anchor="middle">until time's up / notify / interrupt</text><line class="d-line hi" x1="140" y1="188" x2="298" y2="188" marker-end="url(#ah-hi)"/><text class="d-label hi" x="219" y="178" text-anchor="middle">start()</text><line class="d-line" x1="470" y1="188" x2="628" y2="188" marker-end="url(#ah)"/><text class="d-label" x="549" y="178" text-anchor="middle">run() ends</text><line class="d-line" x1="365" y1="150" x2="365" y2="84" marker-end="url(#ah)"/><text class="d-label" x="355" y="122" text-anchor="end">lock is held</text><line class="d-line" x1="405" y1="84" x2="405" y2="148" marker-end="url(#ah)"/><text class="d-label" x="415" y="122" text-anchor="start">lock acquired</text><line class="d-line" x1="340" y1="226" x2="270" y2="298" marker-end="url(#ah)" marker-start="url(#ah)"/><text class="d-label" x="294" y="262" text-anchor="end">wait() · join() · park()</text><line class="d-line" x1="430" y1="226" x2="500" y2="298" marker-end="url(#ah)" marker-start="url(#ah)"/><text class="d-label" x="476" y="262" text-anchor="start">sleep(ms) · wait(ms) · join(ms)</text></svg>
<figcaption>A thread moves through six states. After <code>wait()</code> returns, the thread must take the monitor back, so it can pass through BLOCKED on its way to RUNNABLE.</figcaption>
</figure>

### `sleep` vs `wait` vs `join` vs `yield`

| Call | Belongs to | Releases locks? | Wakes up when |
| --- | --- | --- | --- |
| `Thread.sleep(ms)` | `Thread` (static) | No | Time passes, or interrupted |
| `obj.wait()` | `Object` | Releases `obj`'s monitor only | `notify`/`notifyAll`, timeout, interrupt, or spuriously |
| `t.join()` | `Thread` | No (other locks) | Thread `t` finishes, or interrupted |
| `Thread.yield()` | `Thread` (static) | No | Immediately; it's only a hint to the scheduler |

## In code: stopping a thread with interrupts

Java has no safe way to force a thread to stop. Instead, one thread **asks** with `interrupt()`,
and the other **cooperates**:

```java
Thread worker = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            processNextItem();
            Thread.sleep(100);                    // blocking calls throw when interrupted
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();   // throwing cleared the flag: set it again
            break;                                // and finish
        }
    }
    cleanUp();
});

worker.start();
// ... later
worker.interrupt();   // ask it to stop
worker.join();        // wait until it has
```

Two things happen on `interrupt()`:

- If the thread is blocked in `sleep()`, `wait()`, `join()` and similar calls, that call throws
  `InterruptedException` and **clears** the flag.
- Otherwise only the flag is set, and the thread sees it the next time it checks
  `isInterrupted()`.

## Pitfalls

- **Calling `run()` instead of `start()`.** Everything quietly runs on the calling thread.
- **Swallowing `InterruptedException`** with an empty `catch`. The stop request is lost, and
  thread pools may hang on shutdown.
- **Using `Thread.stop()`, `suspend()` or `resume()`.** They were deprecated because they leave
  shared objects half-updated or deadlocked; `stop()` now just throws.
- **A new `Thread` per request** in a server. Creating platform threads is expensive and
  unbounded; use a thread pool, or virtual threads on Java 21+.
- **Forgetting about uncaught exceptions.** A thread that dies silently looks like a hang. Set an
  `UncaughtExceptionHandler`, or use `submit()` and check the `Future`.
- **Daemon threads doing important work.** The JVM can exit in the middle of it.

## When to use what

| Need | Use |
| --- | --- |
| Run a task in the background, no result | `Runnable` on an `ExecutorService` |
| Run a task and get a result or exception back | `Callable` + `Future` |
| Compose async steps | `CompletableFuture` (later in this series) |
| Many blocking tasks, e.g. one per request | Virtual threads (Java 21+) |
| A raw `new Thread(...)` | Small programs, demos, or a single long-lived worker |

## Further reading

- [`Thread.State` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.State.html)
- [`Thread` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.html)
