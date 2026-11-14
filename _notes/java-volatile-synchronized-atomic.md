---
title: volatile vs synchronized vs AtomicInteger
topic: Java
date: 2026-11-10
tags: [java, concurrency, multithreading]
summary: Two different problems, visibility and atomicity, and which tool fixes which.
reviewed: false
catalog: jmm-volatile
questions:
  - q: Why isn't `count++` thread-safe, even on a `volatile int`?
    a: >-
      It's a read-modify-write. `volatile` guarantees visibility and ordering, not atomicity, so two
      threads can read the same value and one update is lost.
  - q: When is `volatile` enough on its own?
    a: >-
      When one thread writes and others read, and the new value doesn't depend on the old one.
      For example a stop flag, or publishing a reference to a fully built immutable object.
  - q: AtomicInteger or LongAdder for a hot counter?
    a: >-
      `AtomicInteger` uses CAS on one variable: great for counters and sequences, but under heavy
      contention threads keep retrying. `LongAdder` spreads updates across cells and adds them up
      on read, so it's faster with many writers, but `sum()` isn't an atomic snapshot.
  - q: How do you make "increment only if below a limit" atomic?
    a: >-
      Use `updateAndGet(x -> x < limit ? x + 1 : x)` or a `compareAndSet` loop. Calling `get()`
      and then `incrementAndGet()` is a race: two threads can both pass the check.
  - q: Which makes `count++` safe from many threads without a lock?
    options:
      - "`AtomicInteger.incrementAndGet()`"
      - "Declaring the field `volatile int count`"
      - "Calling `Thread.yield()` before `count++`"
      - "Declaring the field `final`"
    correct: 1
    a: >-
      `incrementAndGet()` does the read-modify-write atomically with CAS. `volatile` gives
      visibility but not atomicity, `yield()` changes nothing about the race, and a `final` field
      can't be incremented at all.
  - q: What does `volatile` guarantee?
    options:
      - "Visibility and ordering of reads and writes to that field"
      - "Atomic read-modify-write operations"
      - "Mutual exclusion, like `synchronized`"
      - "Faster arithmetic on that field"
    correct: 1
    a: >-
      A write to a `volatile` field is visible to every thread that reads it afterwards, and it
      can't be reordered around other memory operations. It doesn't make compound operations
      such as `count++` atomic, and it doesn't lock anything.
---

## The bug everyone writes once

```java
class Counter {
    private int count = 0;

    void increment() {
        count++;   // looks like one step, is really three
    }
}
```

`count++` is **read, add, write**. Two threads can both read `41`, both write
`42`, and one increment is lost. Run it with 8 threads and a million increments
each, and the total comes out short.

## Two different problems

| Problem | What goes wrong | Example |
| --- | --- | --- |
| **Visibility** | One thread's write isn't seen by another (CPU caches, reordering) | A `stop` flag that a worker thread never sees change |
| **Atomicity** | A multi-step update is interrupted halfway | `count++` losing increments |

## Which tool fixes which

| Tool | Visibility | Atomic read-modify-write | Blocks threads |
| --- | --- | --- | --- |
| `volatile` | Yes | **No** | No |
| `synchronized` / `Lock` | Yes | Yes | Yes |
| `AtomicInteger` (CAS) | Yes | Yes, for one variable | No |
| `LongAdder` | Yes (on `sum()`) | Yes, for counting | No |

## In practice

```java
// A flag written by one thread, read by others: visibility is all you need.
private volatile boolean running = true;

// A counter or sequence: atomic and lock-free.
private final AtomicInteger requests = new AtomicInteger();
requests.incrementAndGet();

// Many threads incrementing, rare reads (metrics): less contention than AtomicLong.
private final LongAdder hits = new LongAdder();
hits.increment();
long total = hits.sum();

// Several fields that must change together: you need a lock.
synchronized void transfer(Account from, Account to, long amount) {
    from.debit(amount);
    to.credit(amount);
}
```

## Gotchas

- **`volatile int count; count++;` is still broken.** `volatile` makes the write
  visible; it doesn't make the increment atomic.
- **Check-then-act on an atomic is still a race:**

  ```java
  if (counter.get() < limit) counter.incrementAndGet();   // two threads can both pass the check
  ```

  Do it in one atomic step instead:

  ```java
  int result = counter.updateAndGet(x -> x < limit ? x + 1 : x);
  ```

- **Atomics protect one variable.** As soon as an invariant spans two fields, use a lock.
