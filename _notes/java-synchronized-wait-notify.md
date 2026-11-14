---
title: "synchronized, monitors and wait/notify in Java"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, synchronized, monitors]
summary: What a monitor is, what synchronized really locks, and how to use wait/notify without lost wakeups.
catalog: synchronized
series: java-concurrency
priority: high
questions:
  - q: What does a `synchronized` instance method lock, and what does a `static synchronized` method lock?
    a: >-
      An instance method locks `this`, the object it's called on. A `static synchronized` method
      locks the `Class` object, e.g. `Counter.class`. They are different locks, so a static and an
      instance method of the same class can run at the same time.
  - q: Why must `wait()` be called inside a loop?
    a: >-
      When `wait()` returns, the condition you waited for may not hold: another thread may have
      taken the lock first and changed the state, `notifyAll()` may have woken several threads for
      one item, or the thread may wake spuriously. Re-checking with `while (!condition) wait();`
      handles all three.
  - q: Why must `wait()` and `notify()` be called while holding the object's lock?
    a: >-
      Otherwise they throw `IllegalMonitorStateException`. The rule prevents a lost wakeup: if
      checking the condition and calling `wait()` weren't done under the same lock, a `notify()`
      could happen between the check and the wait, and the thread would sleep forever.
  - q: When is `notify()` safe, and when do you need `notifyAll()`?
    a: >-
      `notify()` wakes one arbitrary waiter. It's only safe when every waiter waits for the same
      condition and any one of them can make progress. If threads wait for different conditions
      on the same object (e.g. "not full" and "not empty"), `notify()` can wake the wrong one and
      the right one never wakes, so use `notifyAll()`, or `Condition` objects with a `Lock`.
  - q: What does reentrant mean for `synchronized`?
    a: >-
      A thread that already holds a monitor can enter another block on the same monitor without
      blocking itself. The JVM counts the entries and releases the lock when the count drops to
      zero. Without this, a synchronized method calling another synchronized method on the same
      object would deadlock.
  - q: Besides mutual exclusion, what does `synchronized` guarantee?
    a: >-
      Visibility and ordering. Releasing a monitor happens-before every later acquisition of the
      same monitor, so everything a thread wrote before leaving the block is visible to the next
      thread that enters a block on that monitor.
  - q: A thread calls `notify()` while another thread is in `wait()` on the same object. What happens first to the waiting thread?
    options:
      - "It moves to the entry set and must reacquire the lock before continuing"
      - "It continues running immediately, in parallel with the notifier"
      - "It gets the lock immediately, even though the notifier still holds it"
      - "It is terminated"
    correct: 1
    a: >-
      `notify()` doesn't hand over the lock. The woken thread competes for the monitor like any
      other and only returns from `wait()` once it holds it, which is at the earliest when the
      notifier leaves its synchronized block.
  - q: Which object is the best choice to synchronize on?
    options:
      - "A `private final Object lock = new Object()` field"
      - "A string literal such as `\"LOCK\"`"
      - "A boxed `Integer` field that gets reassigned"
      - "A `public` field other classes can reach"
    correct: 1
    a: >-
      A private final lock object can't be used by outside code and never changes. String literals
      are interned and shared across the whole JVM, boxed values change identity when reassigned
      (and small ones are cached and shared), and a public object can be locked by anyone.
  - q: What happens if a thread calls `wait()` without holding the object's monitor?
    options:
      - "`IllegalMonitorStateException` is thrown"
      - "It waits normally"
      - "It acquires the monitor automatically, then waits"
      - "The call returns immediately and does nothing"
    correct: 1
    a: >-
      `wait()`, `notify()` and `notifyAll()` all require the caller to own the object's monitor;
      otherwise they throw `IllegalMonitorStateException`.
  - q: Two threads call `count++` on a shared counter, one inside `synchronized (a)` and the other inside `synchronized (b)`. Is the counter safe?
    options:
      - "No: they hold different locks, so they don't exclude each other"
      - "Yes: any `synchronized` block makes `count++` atomic"
      - "Yes, as long as `count` is also `volatile`"
      - "Only on machines with a single CPU core"
    correct: 1
    a: >-
      Mutual exclusion only applies between threads using the same monitor. Every access to a
      piece of shared state must be guarded by one and the same lock.
---

## The idea

Every Java object has a built-in lock called a **monitor**. `synchronized` makes a thread take
that lock before running a block of code and release it afterwards, so only one thread at a
time can run code guarded by the same monitor. On top of the lock, each monitor has
`wait()`/`notify()`, which let threads sleep until another thread changes the shared state.

## How it works

### What gets locked

```java
class Counter {
    private final Object lock = new Object();
    private int count;

    synchronized void a() { count++; }          // locks this

    static synchronized void b() { }            // locks Counter.class

    void c() {
        synchronized (lock) { count++; }         // locks the lock object
    }
}
```

A synchronized method is shorthand for wrapping its whole body in `synchronized (this)` (or
`synchronized (Counter.class)` for static methods). Methods `a()` and `c()` above use different
monitors, so they **do not** protect `count` from each other: mixing them is a bug.

### The monitor: entry set, owner, wait set

<figure class="figure" tabindex="0">
<svg viewBox="0 100 760 230" role="img" aria-labelledby="mon-title mon-desc" data-routes='[{"pts": [[15, 158], [175, 158], [420, 158], [670, 158]], "cls": "hi", "w": 2}, {"pts": [[15, 158], [175, 158], [420, 158], [420, 283], [300, 283], [175, 283], [175, 158], [420, 158], [670, 158]], "cls": "ev", "w": 1}]'><title id="mon-title">How a Java monitor works</title><desc id="mon-desc">A thread entering a synchronized block joins the entry set, BLOCKED, until it acquires the lock and becomes the owner. The owner either exits the block, releasing the lock, or calls wait(), which releases the lock and moves it to the wait set, WAITING. notify() or notifyAll() moves waiting threads back to the entry set, where they compete for the lock again.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="90" y="120" width="170" height="76" rx="10"/><text class="d-text" x="175" y="155" text-anchor="middle">Entry set</text><text class="d-sub" x="175" y="173" text-anchor="middle">BLOCKED, wants the lock</text><rect class="d-box hi" x="340" y="120" width="160" height="76" rx="10"/><text class="d-text" x="420" y="155" text-anchor="middle">Owner</text><text class="d-sub" x="420" y="173" text-anchor="middle">holds the lock</text><rect class="d-box" x="600" y="128" width="140" height="60" rx="10"/><text class="d-text" x="670" y="155" text-anchor="middle">Released</text><text class="d-sub" x="670" y="173" text-anchor="middle">left the block</text><rect class="d-box" x="300" y="250" width="240" height="66" rx="10"/><text class="d-text" x="420" y="280" text-anchor="middle">Wait set</text><text class="d-sub" x="420" y="298" text-anchor="middle">WAITING, lock released</text><line class="d-line" x1="15" y1="158" x2="88" y2="158" marker-end="url(#ah)"/><text class="d-label" x="50" y="148" text-anchor="middle">enter</text><line class="d-line hi" x1="260" y1="158" x2="338" y2="158" marker-end="url(#ah-hi)"/><text class="d-label hi" x="299" y="148" text-anchor="middle">acquire</text><line class="d-line" x1="500" y1="158" x2="598" y2="158" marker-end="url(#ah)"/><text class="d-label" x="549" y="148" text-anchor="middle">exit</text><line class="d-line" x1="420" y1="196" x2="420" y2="248" marker-end="url(#ah)"/><text class="d-label" x="430" y="228" text-anchor="start">wait()</text><line class="d-line" x1="300" y1="283" x2="175" y2="283"/><line class="d-line" x1="175" y1="283" x2="175" y2="198" marker-end="url(#ah)"/><text class="d-label" x="292" y="304" text-anchor="end">notify() · notifyAll()</text></svg>
<figcaption>Every object has one monitor. Only the owner runs the block. A woken thread doesn't continue straight away: it goes back to the entry set and must win the lock again.</figcaption>
</figure>

1. A thread reaching `synchronized` joins the **entry set** and is `BLOCKED` until the lock is free.
2. One thread becomes the **owner** and runs the block. The lock is **reentrant**: the owner can
   enter other blocks on the same monitor.
3. The owner leaves the block (normally or with an exception) and the lock is released.
4. Or the owner calls `wait()`: it releases the lock and moves to the **wait set** (`WAITING`).
5. `notify()` moves one waiting thread back to the entry set; `notifyAll()` moves all of them.
   They return from `wait()` only after winning the lock again.

### Visibility comes for free

Unlocking a monitor *happens-before* every later lock of the same monitor. Everything written
inside (or before) a synchronized block is visible to the next thread that locks the same
monitor, so fields guarded consistently by one lock don't also need `volatile`.

## In code: a bounded buffer with wait/notify

```java
public class BoundedBuffer<T> {
    private final Object lock = new Object();
    private final Deque<T> items = new ArrayDeque<>();
    private final int capacity;

    public BoundedBuffer(int capacity) { this.capacity = capacity; }

    public void put(T item) throws InterruptedException {
        synchronized (lock) {
            while (items.size() == capacity) {   // while, not if
                lock.wait();
            }
            items.addLast(item);
            lock.notifyAll();                    // wake consumers (and producers; they re-check)
        }
    }

    public T take() throws InterruptedException {
        synchronized (lock) {
            while (items.isEmpty()) {
                lock.wait();
            }
            T item = items.removeFirst();
            lock.notifyAll();                    // wake producers waiting for space
            return item;
        }
    }
}
```

Producers wait for "not full" and consumers for "not empty" on the **same** monitor, so this
uses `notifyAll()`. With `notify()`, a producer could wake another producer while the buffer is
full, and the consumer that should have run keeps sleeping. In real code, prefer
`ArrayBlockingQueue`, which does exactly this for you.

## Pitfalls

- **`if` instead of `while` around `wait()`.** Spurious wakeups and competing threads break it.
- **Locking on shared or changing objects:** string literals, boxed numbers, `getClass()`, or a
  field that gets reassigned. Use a `private final Object`.
- **Guarding the same state with different locks**, e.g. a synchronized method and a block on
  another object. Every access needs the same monitor.
- **Calling slow or foreign code while holding the lock**: I/O, network calls, callbacks or
  listeners. It slows everyone down and is a common cause of deadlock.
- **`notify()` when threads wait for different conditions**, which leads to missed wakeups.
- **Locking only the writes.** Reads of shared mutable state need the lock too, or they may see
  stale or half-updated values.
- **Synchronizing too much:** a whole method when only two lines touch shared state.

## When to use what

| Need | Use |
| --- | --- |
| Simple mutual exclusion, short critical sections | `synchronized` |
| Try with a timeout, interruptible locking, fairness | `ReentrantLock` (next chapters) |
| Several wait conditions on one lock | `Lock` + separate `Condition` objects |
| Many readers, few writers | `ReentrantReadWriteLock` or `StampedLock` |
| A single counter or reference | Atomics (`AtomicInteger`, `AtomicReference`) |
| Producer-consumer hand-off | A `BlockingQueue`, not hand-written wait/notify |

On Java 21–23, a virtual thread that blocks inside `synchronized` pins its carrier thread;
Java 24 removed that limitation (JEP 491).

## Further reading

- [JLS §17.1: Synchronization](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html#jls-17.1)
- [`Object.wait()` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html#wait())
- [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)
