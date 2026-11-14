---
title: "ReentrantLock, ReadWriteLock and StampedLock"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, locks]
summary: When synchronized isn't enough — timed and interruptible locking, conditions, shared read locks and optimistic reads.
catalog: explicit-locks
series: java-concurrency
priority: high
questions:
  - q: What can `ReentrantLock` do that `synchronized` can't?
    a: >-
      Give up instead of waiting forever (`tryLock()`, `tryLock(timeout, unit)`), wait in a way that
      can be interrupted (`lockInterruptibly()`), hand the lock out fairly (`new ReentrantLock(true)`),
      have several wait conditions on one lock (`newCondition()`), and be inspected
      (`isHeldByCurrentThread()`, `getHoldCount()`). Both are reentrant and give the same memory
      visibility guarantees.
  - q: Why must `unlock()` be in a `finally` block?
    a: >-
      Unlike `synchronized`, an explicit lock is not released automatically when an exception leaves
      the block. Without `finally`, one exception leaves the lock held forever and every other thread
      that needs it blocks. Call `lock()` just before the `try`, not inside it, so a failed `lock()`
      doesn't lead to an `unlock()` of a lock you never got.
  - q: What does a fair lock change, and why isn't it the default?
    a: >-
      A fair `ReentrantLock` grants the lock to the thread that has waited longest, which prevents
      starvation. It's much slower under contention, because the lock can't go to a thread that is
      already running and just asked for it. Note that the untimed `tryLock()` ignores fairness and
      takes a free lock immediately.
  - q: How is a `Condition` better than `wait()`/`notify()`?
    a: >-
      One lock can have several conditions, e.g. `notFull` and `notEmpty`, so producers and consumers
      wait separately and `signal()` wakes a thread waiting for the right thing. The rules are the
      same: hold the lock, and `await()` in a `while` loop.
  - q: Can a thread holding a read lock upgrade to the write lock in `ReentrantReadWriteLock`?
    a: >-
      No. If it tries, it waits for all read locks to be released, including its own, so it blocks
      forever. Release the read lock first, then take the write lock and re-check the state.
      Downgrading is allowed: take the write lock, take the read lock, then release the write lock.
  - q: What is an optimistic read in `StampedLock`?
    a: >-
      `tryOptimisticRead()` returns a stamp without locking anything. You read the fields into local
      variables, then call `validate(stamp)`. If no writer took the lock in between, the values are
      consistent; otherwise you retry with a real `readLock()`. It makes reads very cheap when writes
      are rare.
  - q: Where should `lock.lock()` go?
    options:
      - "Just before the `try`, with `unlock()` in its `finally`"
      - "Inside the `try`, with `unlock()` in its `finally`"
      - "Anywhere, because the lock is released when the method returns"
      - "In a `finally` block"
    correct: 1
    a: >-
      If `lock()` is inside the `try` and fails, the `finally` would call `unlock()` on a lock the
      thread doesn't hold, which throws `IllegalMonitorStateException` and hides the original error.
      Explicit locks are never released automatically.
  - q: Which lock is NOT reentrant?
    options:
      - "`StampedLock`"
      - "`ReentrantLock`"
      - "`ReentrantReadWriteLock`"
      - "A `synchronized` monitor"
    correct: 1
    a: >-
      `StampedLock` is not reentrant: a thread that holds its write lock and asks for it again
      deadlocks itself. It also has no `Condition` support.
  - q: Many threads read a configuration map and it changes a few times a day. What fits best?
    options:
      - "A read-write lock (or an immutable map swapped through a `volatile` field)"
      - "A fair `ReentrantLock` around every read and write"
      - "`synchronized` on every read and write"
      - "No locking, since writes are rare"
    correct: 1
    a: >-
      A read-write lock lets all readers run in parallel and only blocks them during the rare writes.
      Replacing an immutable map through a `volatile` reference is even simpler. "No locking" is a
      data race: readers can see a half-updated map.
  - q: A thread blocked in `lock()` is interrupted. What happens?
    options:
      - "It keeps waiting; only `lockInterruptibly()` reacts to interrupts"
      - "`lock()` throws `InterruptedException`"
      - "It gets the lock immediately"
      - "The lock is released by its current owner"
    correct: 1
    a: >-
      `lock()` ignores interrupts while waiting (the flag stays set for later). Use
      `lockInterruptibly()` or `tryLock(timeout, unit)` when a waiting thread must be cancellable.
---

## The idea

`synchronized` is simple and usually enough, but it can't wait with a timeout, can't be
interrupted while waiting, has only one wait set, and never lets readers share. The
`java.util.concurrent.locks` package fills those gaps:

- **`ReentrantLock`**: `synchronized` with extra controls.
- **`ReentrantReadWriteLock`**: many readers *or* one writer.
- **`StampedLock`**: a faster read-write lock with optimistic reads, at the cost of being harder
  to use.

## How it works

### `ReentrantLock`

```java
private final ReentrantLock lock = new ReentrantLock();   // new ReentrantLock(true) for fair

void update() {
    lock.lock();            // before the try
    try {
        // critical section
    } finally {
        lock.unlock();      // always released, even on exceptions
    }
}
```

| Method | Behaviour |
| --- | --- |
| `lock()` | Waits until it gets the lock; ignores interrupts |
| `lockInterruptibly()` | Waits, but throws `InterruptedException` if interrupted |
| `tryLock()` | Takes the lock if free right now, else returns `false` |
| `tryLock(time, unit)` | Waits up to the timeout; interruptible |
| `newCondition()` | A separate wait set bound to this lock |

### Conditions

Each `Condition` is its own wait set, so different kinds of waiters don't wake each other:

```java
private final Condition notFull = lock.newCondition();
private final Condition notEmpty = lock.newCondition();

// producer, holding the lock:
while (count == capacity) notFull.await();
// ... add item ...
notEmpty.signal();          // wakes a consumer, never another producer
```

### Read-write locks

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 270" role="img" aria-labelledby="rw-title rw-desc"><title id="rw-title">A read-write lock over time</title><desc id="rw-desc">Reader 1 and Reader 2 hold the read lock at the same time. A writer arrives and waits until both readers finish, then holds the write lock alone. Reader 3 arrives while the writer holds the lock and waits until the writer finishes, then reads.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-text" x="20" y="51">Reader 1</text><rect class="d-box" x="130" y="30" width="210" height="32" rx="7"/><text class="d-sub" x="235" y="51" text-anchor="middle">read</text><text class="d-text" x="20" y="101">Reader 2</text><rect class="d-box" x="190" y="80" width="190" height="32" rx="7"/><text class="d-sub" x="285" y="101" text-anchor="middle">read</text><text class="d-text" x="20" y="151">Writer</text><line class="d-line" x1="240" y1="146" x2="380" y2="146" stroke-dasharray="4 5"/><text class="d-label" x="310" y="140" text-anchor="middle">waits</text><rect class="d-box hi" x="380" y="130" width="160" height="32" rx="7"/><text class="d-sub" x="460" y="151" text-anchor="middle">write, alone</text><text class="d-text" x="20" y="201">Reader 3</text><line class="d-line" x1="430" y1="196" x2="540" y2="196" stroke-dasharray="4 5"/><text class="d-label" x="485" y="190" text-anchor="middle">waits</text><rect class="d-box" x="540" y="180" width="180" height="32" rx="7"/><text class="d-sub" x="630" y="201" text-anchor="middle">read</text><line class="d-line" x1="130" y1="236" x2="740" y2="236" marker-end="url(#ah)"/><text class="d-label" x="740" y="256" text-anchor="end">time</text><text class="d-label hi" x="260" y="256" text-anchor="middle">readers share</text><text class="d-label hi" x="460" y="256" text-anchor="middle">writer is exclusive</text></svg>
<figcaption>Any number of readers can hold the read lock together. A writer needs the lock to itself, so it waits for current readers to finish, and new readers wait for it.</figcaption>
</figure>

A `ReentrantReadWriteLock` has two linked locks. The **read lock** can be held by many threads
at once, as long as no one holds the write lock. The **write lock** is exclusive. It pays off
when reads are frequent, take a while, and writes are rare. For tiny critical sections, its
extra bookkeeping can make it slower than a plain lock.

### `StampedLock` and optimistic reads

Every acquisition returns a `long` **stamp** that you pass back to unlock. Its special trick is
`tryOptimisticRead()`: read without locking, then check that no writer interfered.

## In code

### Avoiding deadlock with `tryLock`

```java
boolean transfer(Account from, Account to, long amount) throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
    while (System.nanoTime() < deadline) {
        if (from.lock.tryLock()) {
            try {
                if (to.lock.tryLock()) {
                    try {
                        from.balance -= amount;
                        to.balance += amount;
                        return true;
                    } finally {
                        to.lock.unlock();
                    }
                }
            } finally {
                from.lock.unlock();
            }
        }
        Thread.sleep(ThreadLocalRandom.current().nextInt(1, 10));  // back off, then retry
    }
    return false;   // gave up instead of deadlocking
}
```

### A read-mostly cache with `ReentrantReadWriteLock`

```java
class Cache<K, V> {
    private final Map<K, V> map = new HashMap<>();
    private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();

    V get(K key) {
        rw.readLock().lock();
        try {
            return map.get(key);
        } finally {
            rw.readLock().unlock();
        }
    }

    void put(K key, V value) {
        rw.writeLock().lock();
        try {
            map.put(key, value);
        } finally {
            rw.writeLock().unlock();
        }
    }
}
```

### An optimistic read with `StampedLock`

```java
class Point {
    private final StampedLock sl = new StampedLock();
    private double x, y;

    void move(double dx, double dy) {
        long stamp = sl.writeLock();
        try {
            x += dx;
            y += dy;
        } finally {
            sl.unlockWrite(stamp);
        }
    }

    double distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead();     // no lock taken
        double cx = x, cy = y;                   // copy into locals
        if (!sl.validate(stamp)) {               // a writer got in: read again, properly
            stamp = sl.readLock();
            try {
                cx = x;
                cy = y;
            } finally {
                sl.unlockRead(stamp);
            }
        }
        return Math.hypot(cx, cy);
    }
}
```

## Pitfalls

- **Forgetting `finally`.** One exception and the lock is held forever.
- **`lock()` inside the `try`.** A failed `lock()` turns into a misleading
  `IllegalMonitorStateException` from `unlock()`.
- **Upgrading a read lock to a write lock.** It deadlocks; release the read lock first.
- **Re-entering a `StampedLock`.** It isn't reentrant, so a nested `writeLock()` deadlocks.
- **Using the fields of an optimistic read before `validate()`**, or reading them more than
  once. Copy into locals, validate, then use the locals.
- **Fair locks by default.** They cost a lot of throughput; use them only when starvation is a
  real problem.
- **Reaching for a read-write lock for tiny critical sections**, where a plain lock (or a
  `ConcurrentHashMap`) is faster and simpler.

## When to use what

| Need | Use |
| --- | --- |
| Simple mutual exclusion | `synchronized` |
| Timeout, interruptible wait, or fairness | `ReentrantLock` |
| Several wait conditions on one lock | `ReentrantLock` + `Condition` |
| Many readers, few writers, reentrancy needed | `ReentrantReadWriteLock` |
| Very hot reads, rare writes, short read sections | `StampedLock` with optimistic reads |
| A concurrent map | `ConcurrentHashMap`, not a map wrapped in a lock |

## Further reading

- [`ReentrantLock` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html)
- [`ReentrantReadWriteLock` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/ReentrantReadWriteLock.html)
- [`StampedLock` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/StampedLock.html)
