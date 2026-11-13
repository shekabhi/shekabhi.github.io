---
title: volatile vs synchronized vs AtomicInteger
topic: Java
date: 2026-11-10
tags: [java, concurrency, multithreading]
summary: Two different problems, visibility and atomicity, and which tool fixes which.
reviewed: false
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
