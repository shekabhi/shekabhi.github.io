---
title: "Race conditions, deadlock, livelock and starvation"
short_title: "Race conditions and deadlock in Java"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, deadlock, debugging]
summary: The four classic ways concurrent code goes wrong, how to recognise each one, and how to prevent or diagnose it.
catalog: concurrency-bugs
series: java-concurrency
priority: high
questions:
  - q: What is the difference between a data race and a race condition?
    a: >-
      A data race is a memory-model term: two threads access the same variable, at least one
      writes, and there is no happens-before ordering between them, so a thread can see stale or
      torn values. A race condition is a logic bug: the result depends on the timing of threads,
      e.g. check-then-act or read-modify-write. You can have a race condition without a data race
      (each step uses a thread-safe map, but the two steps together aren't atomic).
  - q: What are the four conditions for a deadlock?
    a: >-
      Mutual exclusion (a resource can be held by only one thread), hold and wait (a thread holds
      one resource while waiting for another), no preemption (a resource can't be taken away; the
      holder must release it), and circular wait (a cycle of threads, each waiting for the next).
      All four must hold at once, so breaking any one prevents deadlock.
  - q: How do you prevent deadlock in practice?
    a: >-
      Most often by lock ordering: every thread takes locks in the same global order, e.g. by
      account ID, which makes circular wait impossible. Other options are `tryLock` with a timeout
      (give up and retry instead of waiting forever), holding only one lock at a time, keeping
      critical sections short, and never calling unknown code (callbacks, listeners) while holding
      a lock.
  - q: How do you find a deadlock in a running Java application?
    a: >-
      Take a thread dump with `jstack <pid>` or `jcmd <pid> Thread.print`. The JVM detects
      deadlocks and prints "Found one Java-level deadlock" with each thread, the lock it holds and
      the lock it's waiting for. In code, `ThreadMXBean.findDeadlockedThreads()` returns the
      deadlocked thread IDs, covering both `synchronized` monitors and `ReentrantLock`s.
  - q: What is a livelock?
    a: >-
      Threads aren't blocked, but they keep reacting to each other and make no progress, like two
      people stepping aside the same way in a corridor. In code it typically comes from retry logic:
      both threads fail, back off for the same time and collide again. Random backoff (jitter)
      breaks the symmetry.
  - q: What is starvation, and what causes it?
    a: >-
      A thread is ready to run but never gets the resource it needs, while others keep getting it.
      Causes include unfair locks that let newcomers barge ahead, threads holding a lock for a long
      time, a stream of readers keeping a writer out, and thread priorities. Fixes are fair locks
      where needed, shorter critical sections, and bounded queues.
  - q: Two threads lock the same two accounts for a transfer, but in opposite orders. What can happen?
    options:
      - "Deadlock: each holds one lock and waits forever for the other"
      - "Livelock: both keep retrying"
      - "Nothing; Java detects it and releases a lock"
      - "Starvation of a third thread only"
    correct: 1
    a: >-
      This is the classic deadlock. Java detects it in thread dumps but never breaks it: both
      threads stay `BLOCKED` until the JVM exits. Locking the accounts in a fixed order (e.g. lower
      ID first) prevents it.
  - q: Which of the four deadlock conditions does consistent lock ordering remove?
    options:
      - "Circular wait"
      - "Mutual exclusion"
      - "No preemption"
      - "Hold and wait"
    correct: 1
    a: >-
      If every thread takes locks in the same order, no thread can hold a "later" lock while
      waiting for an "earlier" one, so a cycle can't form.
  - q: Two threads keep retrying a failed operation after the same fixed delay and keep colliding. What is this, and the usual fix?
    options:
      - "Livelock; add random jitter to the backoff"
      - "Deadlock; use a fair lock"
      - "Starvation; raise the thread priority"
      - "A data race; make the field `volatile`"
    correct: 1
    a: >-
      Both threads are busy, so it isn't a deadlock, but neither makes progress. Randomising the
      delay makes it very unlikely they collide again and again.
  - q: Which command shows a Java-level deadlock in a running JVM?
    options:
      - "`jstack <pid>`"
      - "`jps -l`"
      - "`jstat -gc <pid>`"
      - "`java -version`"
    correct: 1
    a: >-
      `jstack` (or `jcmd <pid> Thread.print`) prints all thread stacks and a "Found one Java-level
      deadlock" section. `jps` only lists JVMs, and `jstat` shows GC statistics.
---

## The idea

Concurrent code goes wrong in a few recurring ways:

| Problem | What you see | Threads are |
| --- | --- | --- |
| **Race condition** | Wrong or lost results, sometimes | Running |
| **Deadlock** | The app (or part of it) freezes forever | `BLOCKED` / `WAITING` |
| **Livelock** | Busy CPU, no progress | Running |
| **Starvation** | Some requests are extremely slow or never finish | Ready, but never chosen |

## How it works

### Race conditions

The two shapes to recognise:

```java
// check-then-act: two threads can both see "absent" and both create
if (!cache.containsKey(key)) {
    cache.put(key, load(key));
}

// read-modify-write: two threads can read the same value; one update is lost
balance = balance + amount;
```

Each line can be thread-safe on its own and still be wrong, because the **sequence** isn't
atomic. Fixes: one atomic operation (`cache.computeIfAbsent(key, this::load)`,
`AtomicLong.addAndGet`), or a lock around the whole sequence.

### Deadlock

<figure class="figure" tabindex="0">
<svg viewBox="0 10 760 280" role="img" aria-labelledby="dl-title dl-desc"><title id="dl-title">A deadlock between two threads</title><desc id="dl-desc">Thread 1 holds lock A and waits for lock B. Thread 2 holds lock B and waits for lock A. Each waits for a lock the other will only release after it gets the lock it is waiting for, so neither can continue.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="310" y="20" width="140" height="56" rx="10"/><text class="d-text" x="380" y="53" text-anchor="middle">Lock A</text><rect class="d-box" x="310" y="224" width="140" height="56" rx="10"/><text class="d-text" x="380" y="257" text-anchor="middle">Lock B</text><rect class="d-box warn" x="40" y="118" width="170" height="64" rx="10"/><text class="d-text" x="125" y="147" text-anchor="middle">Thread 1</text><text class="d-sub" x="125" y="165" text-anchor="middle">holds A, wants B</text><rect class="d-box warn" x="550" y="118" width="170" height="64" rx="10"/><text class="d-text" x="635" y="147" text-anchor="middle">Thread 2</text><text class="d-sub" x="635" y="165" text-anchor="middle">holds B, wants A</text><line class="d-line" x1="180" y1="118" x2="308" y2="58" marker-end="url(#ah)"/><text class="d-label" x="232" y="78" text-anchor="end">holds</text><line class="d-line warn" x1="180" y1="182" x2="308" y2="242" marker-end="url(#ah-warn)"/><text class="d-label warn" x="232" y="232" text-anchor="end">waits for</text><line class="d-line" x1="580" y1="182" x2="452" y2="242" marker-end="url(#ah)"/><text class="d-label" x="528" y="232" text-anchor="start">holds</text><line class="d-line warn" x1="580" y1="118" x2="452" y2="58" marker-end="url(#ah-warn)"/><text class="d-label warn" x="528" y="78" text-anchor="start">waits for</text><text class="d-label warn" x="380" y="155" text-anchor="middle">circular wait: neither</text><text class="d-label warn" x="380" y="171" text-anchor="middle">can ever continue</text></svg>
<figcaption>Thread 1 waits for B, which Thread 2 holds; Thread 2 waits for A, which Thread 1 holds. Break any one of the four conditions below and this cycle can’t form; in practice that usually means taking locks in a fixed order.</figcaption>
</figure>

A deadlock needs **all four** of these at once (the Coffman conditions):

| Condition | Meaning | How to break it |
| --- | --- | --- |
| Mutual exclusion | Only one thread can hold the lock | Use lock-free structures or immutable data |
| Hold and wait | Holding one lock while waiting for another | Take all locks at once, or hold only one at a time |
| No preemption | Nobody can take a lock away | `tryLock` with a timeout: give up and release |
| Circular wait | A cycle of waiting threads | **Always take locks in the same global order** |

Java never breaks a deadlock for you. The threads stay blocked until the JVM stops.

### Livelock and starvation

**Livelock**: threads keep responding to each other without progress, typically two retry loops
with identical delays. Add random jitter to backoff.

**Starvation**: a thread is always passed over. Watch for long-held locks, unfair locks under
heavy load, and readers continuously holding a read-write lock while a writer waits.

## In code

### Creating a deadlock, then fixing it

```java
class Account {
    final long id;
    long balance;
    Account(long id, long balance) { this.id = id; this.balance = balance; }
}

// DEADLOCK-PRONE: transfer(a, b) and transfer(b, a) lock in opposite orders
static void transferUnsafe(Account from, Account to, long amount) {
    synchronized (from) {
        synchronized (to) {
            from.balance -= amount;
            to.balance += amount;
        }
    }
}

// FIXED: always lock the account with the lower id first
static void transfer(Account from, Account to, long amount) {
    Account first = from.id < to.id ? from : to;
    Account second = first == from ? to : from;
    synchronized (first) {
        synchronized (second) {
            from.balance -= amount;
            to.balance += amount;
        }
    }
}
```

The fixed version's lock order no longer depends on the direction of the transfer, so the cycle
in the diagram can't form. For a version that gives up instead of waiting, see `tryLock` in the
previous chapter on explicit locks.

### Finding a deadlock

In a thread dump (`jstack <pid>` or `jcmd <pid> Thread.print`), look for this section:

```text
Found one Java-level deadlock:
=============================
"transfer-2":
  waiting to lock monitor 0x00007f... (object 0x0000000711a2c8f0, a Account),
  which is held by "transfer-1"
"transfer-1":
  waiting to lock monitor 0x00007f... (object 0x0000000711a2c900, a Account),
  which is held by "transfer-2"
```

To check from inside the application, e.g. in a health check:

```java
ThreadMXBean threads = ManagementFactory.getThreadMXBean();
long[] ids = threads.findDeadlockedThreads();   // null when there is no deadlock
if (ids != null) {
    for (ThreadInfo info : threads.getThreadInfo(ids)) {
        System.err.println(info.getThreadName() + " waiting for " + info.getLockName()
                + " held by " + info.getLockOwnerName());
    }
}
```

## Pitfalls

- **Thinking thread-safe parts make a thread-safe whole.** Two `ConcurrentHashMap` calls in a row
  are not atomic together.
- **Lock ordering that depends on arguments**, like `transfer(from, to)`. Order by something
  stable such as an ID.
- **Calling unknown code while holding a lock**: listeners, callbacks, overridable methods. They
  may take other locks in an order you can't control.
- **Nested locks across classes.** Lock order is easy to keep inside one class and easy to break
  across two.
- **Deadlocks between threads and a bounded thread pool**: a task that waits for another task
  submitted to the same full pool waits forever, with no locks involved.
- **Retries without jitter**, which turn contention into livelock.
- **"It passed the tests."** Race conditions are timing-dependent and may only show up under
  production load.

## When to use what

| Situation | Approach |
| --- | --- |
| Check-then-act on a map | `computeIfAbsent`, `putIfAbsent`, `merge` |
| Read-modify-write on a number | Atomics, or one lock around the sequence |
| Several locks needed together | A fixed global lock order |
| Must not wait forever | `tryLock(timeout)` and retry with random backoff |
| Diagnose a hang in production | Thread dump: `jstack` / `jcmd Thread.print` |
| Monitor for deadlocks | `ThreadMXBean.findDeadlockedThreads()` in a health check |

## Further reading

- [`ThreadMXBean` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.management/java/lang/management/ThreadMXBean.html)
- [`jstack` (JDK tools reference)](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jstack.html)
