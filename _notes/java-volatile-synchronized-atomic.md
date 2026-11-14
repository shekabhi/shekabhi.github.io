---
title: "The Java memory model: visibility, volatile and happens-before"
short_title: "Java memory model and volatile"
topic: Java concurrency
date: 2026-11-10
updated: 2026-11-14
tags: [java, concurrency, memory-model, volatile]
summary: Why one thread may not see another's writes, the happens-before rules that guarantee it does, and when volatile is the right tool.
catalog: jmm-volatile
series: java-concurrency
priority: high
questions:
  - q: What three problems does the Java memory model deal with?
    a: >-
      Visibility (a write by one thread may stay in a register or CPU cache, or be optimised away,
      so another thread doesn't see it), ordering (the compiler and CPU may reorder independent
      operations, so another thread can observe them in a different order), and atomicity (an
      operation like `count++` is several steps that can interleave with another thread's).
  - q: What is happens-before?
    a: >-
      A guarantee from the Java memory model: if action X happens-before action Y, then everything X
      wrote is visible to Y and X is ordered before Y. It's created by program order within a thread,
      unlocking a monitor before a later lock of it, a `volatile` write before a later read of the
      same variable, `Thread.start()`, `Thread.join()`, and the `java.util.concurrent` utilities, and
      it's transitive. Without a happens-before relation between two threads' accesses, there's a
      data race and no visibility guarantee.
  - q: What does `volatile` guarantee, and what doesn't it?
    a: >-
      Reads and writes of a `volatile` field go to main memory as far as the program can tell: every
      read sees the latest write, and the field's accesses can't be reordered with the operations
      around them in ways that break happens-before. Writes of `volatile long` and `double` are
      atomic too. It does **not** make compound operations atomic: `count++` on a `volatile int` can
      still lose updates.
  - q: Why does double-checked locking need `volatile`?
    a: >-
      `instance = new Singleton()` is allocation, constructor writes and publishing the reference,
      and without `volatile` the reference can become visible before the constructor's writes. A
      second thread that skips the lock (because `instance != null`) can then use a half-built
      object. Making the field `volatile` creates a happens-before edge from the constructor to every
      reader.
  - q: What is safe publication?
    a: >-
      Making a newly created object visible to other threads so they see it fully constructed. Safe
      ways: initialise it in a static initializer; store it in a `volatile` field or an
      `AtomicReference`; store it in a `final` field of a properly constructed object; store it in a
      field guarded by a lock; or put it into a concurrent collection or `BlockingQueue`.
  - q: What special guarantee do `final` fields have?
    a: >-
      If an object is properly constructed (`this` doesn't escape the constructor), every thread
      that sees a reference to it also sees the correct values of its `final` fields, without any
      synchronization. That's why immutable objects with `final` fields are safe to share even when
      published through a data race.
  - q: Why isn't `count++` on a `volatile int` thread-safe?
    options:
      - "It's a read, an add and a write; `volatile` makes each visible but not the three together atomic"
      - "`volatile` only works on `long` and `double`"
      - "`volatile` fields are cached per thread"
      - "It is thread-safe"
    correct: 1
    a: >-
      Two threads can both read 5 and both write 6. Use `AtomicInteger.incrementAndGet()`, a
      `LongAdder`, or a lock.
  - q: A worker loops `while (!stop) { }` and another thread sets `stop = true`. The field isn't volatile. What can happen?
    options:
      - "The loop may never end, because the read may be hoisted out of the loop"
      - "The loop always ends within one iteration"
      - "It throws `IllegalMonitorStateException`"
      - "The JVM makes the field volatile automatically"
    correct: 1
    a: >-
      With no happens-before edge, the JIT compiler may read `stop` once and turn the loop into
      `while (true)`. Declaring `stop` as `volatile` (or using an `AtomicBoolean`) fixes it.
  - q: Which of these does NOT create a happens-before edge between two threads?
    options:
      - "Both threads reading the same non-volatile field"
      - "Calling `start()` on a thread"
      - "Unlocking a monitor that the other thread locks later"
      - "Writing a `volatile` field that the other thread reads later"
    correct: 1
    a: >-
      Plain reads and writes of a non-volatile field don't order anything between threads. The other
      three are standard happens-before rules.
  - q: When is `volatile` alone enough?
    options:
      - "When one thread writes a value that doesn't depend on the old one, e.g. a stop flag"
      - "When many threads increment a shared counter"
      - "When two fields must change together"
      - "Never; it always needs a lock as well"
    correct: 1
    a: >-
      Flags and publishing a reference to an immutable object are the classic cases. Anything that
      reads and then writes, or keeps an invariant across fields, needs atomics or a lock.
---

## The idea

On a modern machine, threads don't read and write one shared memory directly. Values sit in
registers and CPU caches, and both the JIT compiler and the CPU reorder instructions to go
faster. Within one thread, you never notice. Between threads, you can: one thread's write may
arrive late, never, or in a different order.

The **Java memory model (JMM)** says exactly when a write by one thread is guaranteed to be
visible to another. The answer is always the same rule: **when there is a happens-before
relation between them.**

## How it works

### Three problems

| Problem | Example | Fixed by |
| --- | --- | --- |
| Visibility | A stop flag that the worker never sees change | `volatile`, locks, atomics |
| Ordering | A reference published before its constructor's writes | `volatile`, locks, `final` fields |
| Atomicity | Two threads both turning 5 into 6 | Locks, atomics |

### Happens-before

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 310" role="img" aria-labelledby="jmm-title jmm-desc" data-routes='[{"pts": [[185, 66], [185, 166], [575, 166], [575, 266]], "cls": "hi", "w": 1}]'><title id="jmm-title">How a volatile write publishes earlier writes</title><desc id="jmm-desc">Thread A writes data = 42 and then writes the volatile flag ready = true. Thread B reads ready and sees true. Because a volatile write happens-before every later read of the same variable, and program order chains the steps in each thread, Thread B is guaranteed to see data = 42 even though data itself isn't volatile.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-head" x="185" y="24" text-anchor="middle">THREAD A</text><text class="d-head" x="575" y="24" text-anchor="middle">THREAD B</text><rect class="d-box" x="40" y="40" width="290" height="52" rx="10"/><text class="d-text" x="185" y="63" text-anchor="middle">data = 42</text><text class="d-sub" x="185" y="81" text-anchor="middle">plain write</text><rect class="d-box hi" x="40" y="140" width="290" height="52" rx="10"/><text class="d-text" x="185" y="163" text-anchor="middle">ready = true</text><text class="d-sub" x="185" y="181" text-anchor="middle">volatile write</text><rect class="d-box hi" x="430" y="140" width="290" height="52" rx="10"/><text class="d-text" x="575" y="163" text-anchor="middle">if (ready)</text><text class="d-sub" x="575" y="181" text-anchor="middle">volatile read sees true</text><rect class="d-box" x="430" y="240" width="290" height="52" rx="10"/><text class="d-text" x="575" y="263" text-anchor="middle">print(data)</text><text class="d-sub" x="575" y="281" text-anchor="middle">guaranteed to print 42</text><line class="d-line" x1="185" y1="92" x2="185" y2="138" marker-end="url(#ah)"/><text class="d-label" x="195" y="120" text-anchor="start">program order</text><line class="d-line hi" x1="330" y1="166" x2="428" y2="166" marker-end="url(#ah-hi)"/><text class="d-label hi" x="379" y="156" text-anchor="middle">happens-before</text><line class="d-line" x1="575" y1="192" x2="575" y2="238" marker-end="url(#ah)"/><text class="d-label" x="585" y="220" text-anchor="start">program order</text></svg>
<figcaption>Happens-before is transitive: A’s write to <code>data</code> comes before its volatile write, which comes before B’s volatile read, which comes before B reads <code>data</code>. Remove <code>volatile</code> and B may see <code>ready</code> but an old <code>data</code>, or never see <code>ready</code> at all.</figcaption>
</figure>

The rules that create happens-before edges:

| Rule | Edge |
| --- | --- |
| Program order | Each action in a thread → every later action in that thread |
| Monitor lock | Unlocking a monitor → every later lock of the same monitor |
| `volatile` | A write to a volatile field → every later read of that field |
| Thread start | `t.start()` → every action in thread `t` |
| Thread end | Every action in `t` → another thread returning from `t.join()` |
| Concurrency utilities | Putting into a `BlockingQueue` → taking it out; submitting a task → running it; a task finishing → `Future.get()` returning |
| Transitivity | If X → Y and Y → Z, then X → Z |

If two threads access the same variable, at least one writes, and neither access
happens-before the other, it's a **data race**: no guarantees about which value is seen.

### What `volatile` does

- Every read sees the most recent write to that field.
- Writes before a volatile write can't be moved after it, and reads after a volatile read
  can't be moved before it, which is what makes the publishing pattern in the diagram work.
- 64-bit `long` and `double` volatile writes are atomic. Non-volatile ones may be written as two
  halves.
- It doesn't make read-modify-write sequences atomic.

## In code

### A stop flag

```java
class Worker implements Runnable {
    private volatile boolean running = true;   // without volatile, run() may never stop

    public void run() {
        while (running) {
            doWork();
        }
    }

    public void stop() { running = false; }
}
```

### Lazy initialisation with double-checked locking

```java
class Config {
    private static volatile Config instance;   // volatile is essential

    static Config get() {
        Config local = instance;               // one volatile read on the fast path
        if (local == null) {
            synchronized (Config.class) {
                local = instance;
                if (local == null) {
                    instance = local = new Config();
                }
            }
        }
        return local;
    }
}
```

For singletons, the holder-class idiom is simpler and just as lazy; see the chapter on
thread-safe design.

### `volatile` vs `synchronized` vs atomics

| Tool | Visibility | Atomic read-modify-write | Blocks threads |
| --- | --- | --- | --- |
| `volatile` | Yes | No | No |
| `synchronized` / `Lock` | Yes | Yes | Yes |
| `AtomicInteger` (CAS) | Yes | Yes, for one variable | No |

## Pitfalls

- **"It works on my machine."** x86 CPUs reorder less than ARM, so a missing `volatile` can pass
  every test locally and fail on ARM servers or after JIT optimisation.
- **`volatile` on a reference to a mutable object.** It makes the reference visible, not later
  changes to the object's fields.
- **`count++` on a `volatile`.** Still a race.
- **Publishing `this` from a constructor** (registering a listener, starting a thread). Other
  threads can see the object before it's finished, and even `final` fields lose their guarantee.
- **Double-checked locking without `volatile`.**
- **Assuming a write "will show up soon".** Without happens-before, the JMM doesn't promise it
  ever does.

## When to use what

| Need | Use |
| --- | --- |
| A flag or status written by one thread, read by others | `volatile` |
| Publish an immutable object | `volatile` field, `final` field, or `AtomicReference` |
| Counters and other read-modify-write | `AtomicInteger` / `LongAdder` |
| Several fields that change together | A lock |
| Hand data to another thread | A `BlockingQueue` or an executor (they create happens-before for you) |

## Further reading

- [JLS §17.4: Memory Model](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html#jls-17.4)
- [`java.util.concurrent`: memory consistency properties](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html#MemoryVisibility)
