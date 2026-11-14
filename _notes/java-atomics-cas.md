---
title: "Atomics, CAS and the ABA problem"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, atomics, lock-free]
summary: How compare-and-set makes updates safe without locks, where it breaks down, and how to avoid the ABA trap.
catalog: atomics-cas
series: java-concurrency
priority: high
questions:
  - q: What is compare-and-set (CAS)?
    a: >-
      A single atomic operation, supported by the CPU, that says: "if the variable still holds
      `expected`, set it to `next` and return true; otherwise change nothing and return false".
      Java exposes it as `compareAndSet(expected, next)` on the atomic classes. Because the check and
      the write happen as one step, no other thread can slip in between them.
  - q: How does `AtomicInteger` make an update thread-safe without a lock?
    a: >-
      It reads the current value, computes the new one, and tries `compareAndSet(current, next)`. If
      another thread changed the value in the meantime, the CAS fails and it retries with the fresh
      value. Methods such as `incrementAndGet()` and `updateAndGet()` wrap this loop (some use a
      single atomic CPU instruction instead). The field is also `volatile`, so updates are visible.
  - q: What is the ABA problem?
    a: >-
      A thread reads value A, gets delayed, and meanwhile other threads change it to B and back to A.
      Its CAS then succeeds because it only compares values, although the state changed in between.
      It matters when "the same value" doesn't mean "nothing happened", for example a lock-free stack
      whose top node was popped and pushed back with a different `next` link.
  - q: How do you prevent ABA in Java?
    a: >-
      Attach a version number to the value and compare both: `AtomicStampedReference` pairs a
      reference with an `int` stamp that you increment on every change, so A-with-stamp-1 is not equal
      to A-with-stamp-3. `AtomicMarkableReference` pairs it with a boolean. Garbage collection already
      prevents the classic case of a freed node's memory being reused while another thread still
      holds a reference to it.
  - q: When is `LongAdder` better than `AtomicLong`?
    a: >-
      For a counter that many threads update and that is read rarely, e.g. metrics. `LongAdder`
      spreads updates over several cells, so threads rarely collide and retry; `sum()` adds the cells
      up. Use `AtomicLong` when you need an exact, atomic read-and-update, such as generating IDs,
      because `sum()` isn't an atomic snapshot and `LongAdder` has no `compareAndSet`.
  - q: Are CAS loops always faster than locks?
    a: >-
      No. Under low and moderate contention they avoid blocking and context switches, so they're
      usually faster. Under heavy contention many threads keep failing and retrying, burning CPU.
      CAS also only covers one variable: an invariant over several variables needs a lock (or one
      immutable object holding all of them, swapped with `AtomicReference`).
  - q: What does `compareAndSet` on an `AtomicReference` compare?
    options:
      - "Object identity (`==`), not `equals()`"
      - "`equals()`"
      - "`hashCode()`"
      - "The serialized bytes of the objects"
    correct: 1
    a: >-
      CAS compares references. Two equal but different objects, such as two `new String("a")` or
      boxed `Integer`s outside the small-value cache, won't match, so always pass the exact
      reference you read.
  - q: In `updateAndGet(fn)`, how many times can `fn` run for one call?
    options:
      - "More than once, if other threads keep winning the CAS"
      - "Exactly once"
      - "At most once; it is skipped on contention"
      - "Once per CPU core"
    correct: 1
    a: >-
      The method retries its CAS loop on contention and calls `fn` again on each attempt. Keep `fn`
      fast and free of side effects: no logging, I/O or counters inside it.
  - q: Which class detects that a value went A → B → A?
    options:
      - "`AtomicStampedReference`"
      - "`AtomicReference`"
      - "`AtomicInteger`"
      - "`LongAdder`"
    correct: 1
    a: >-
      It stores a version stamp next to the reference and compares both. The others only compare the
      current value, so they can't tell that it changed and came back.
  - q: Ten threads must update `balance` and `lastUpdated` together, always consistently. What fits?
    options:
      - "A lock, or one immutable object holding both fields in an `AtomicReference`"
      - "Two separate `AtomicLong`s"
      - "Two `volatile` fields"
      - "`LongAdder` for each field"
    correct: 1
    a: >-
      Separate atomics are each consistent on their own, but another thread can see one updated and
      the other not. Either guard both with one lock, or put both into an immutable object and swap
      the whole object with a single CAS.
---

## The idea

Locks make threads take turns. **Atomics** take a different, optimistic approach: let threads
update freely, and detect when two of them collided. The building block is
**compare-and-set (CAS)**, a single CPU instruction that changes a value only if it still holds
what you last saw. Classes such as `AtomicInteger`, `AtomicLong` and `AtomicReference` are built
on it, and so are many classes in `java.util.concurrent`.

## How it works

### The CAS retry loop

<figure class="figure" tabindex="0">
<svg viewBox="0 60 760 210" role="img" aria-labelledby="cas-title cas-desc" data-routes='[{"pts": [[95, 125], [285, 125], [490, 125], [680, 125]], "cls": "ok", "w": 2}, {"pts": [[95, 125], [285, 125], [490, 125], [490, 230], [95, 230], [95, 125], [285, 125], [490, 125], [680, 125]], "cls": "bad", "w": 1}]'><title id="cas-title">A compare-and-set retry loop</title><desc id="cas-desc">The thread reads the current value, computes the new value, then calls compareAndSet with the value it read and the new value. If the variable still holds the value it read, the update is applied and the loop ends. If another thread changed it in between, compareAndSet returns false and the thread starts again by reading the current value.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="90" width="150" height="70" rx="10"/><text class="d-text" x="95" y="122" text-anchor="middle">Read</text><text class="d-sub" x="95" y="140" text-anchor="middle">current = get()</text><rect class="d-box" x="210" y="90" width="150" height="70" rx="10"/><text class="d-text" x="285" y="122" text-anchor="middle">Compute</text><text class="d-sub" x="285" y="140" text-anchor="middle">next = f(current)</text><rect class="d-box hi" x="400" y="80" width="180" height="90" rx="10"/><text class="d-text" x="490" y="122" text-anchor="middle">compareAndSet</text><text class="d-sub" x="490" y="140" text-anchor="middle">(current, next)</text><rect class="d-box" x="620" y="90" width="120" height="70" rx="10"/><text class="d-text" x="680" y="122" text-anchor="middle">Done</text><text class="d-sub" x="680" y="140" text-anchor="middle">value updated</text><line class="d-line" x1="170" y1="125" x2="208" y2="125" marker-end="url(#ah)"/><line class="d-line" x1="360" y1="125" x2="398" y2="125" marker-end="url(#ah)"/><line class="d-line hi" x1="580" y1="125" x2="618" y2="125" marker-end="url(#ah-hi)"/><text class="d-label hi" x="599" y="115" text-anchor="middle">true</text><line class="d-line" x1="490" y1="170" x2="490" y2="230"/><line class="d-line" x1="490" y1="230" x2="95" y2="230"/><line class="d-line" x1="95" y1="230" x2="95" y2="162" marker-end="url(#ah)"/><text class="d-label" x="292" y="252" text-anchor="middle">false: another thread changed it, so read again</text></svg>
<figcaption>No thread ever waits for a lock. If two threads race, exactly one compareAndSet succeeds and the other simply retries with the fresh value.</figcaption>
</figure>

```java
AtomicInteger max = new AtomicInteger(Integer.MIN_VALUE);

void offer(int value) {
    int current;
    do {
        current = max.get();
        if (value <= current) return;              // nothing to do
    } while (!max.compareAndSet(current, value));  // someone changed it: retry
}
```

You rarely write that loop by hand. The atomic classes provide it:

| Method | What it does |
| --- | --- |
| `get()` / `set(v)` | Read / write with `volatile` semantics |
| `incrementAndGet()`, `addAndGet(d)` | Atomic arithmetic |
| `compareAndSet(expected, next)` | The CAS itself; returns whether it applied |
| `updateAndGet(fn)` | Apply a function atomically, retrying as needed |
| `accumulateAndGet(x, fn)` | Combine with another value, e.g. `Math::max` |
| `getAndSet(v)` | Swap in a new value, return the old one |

So the example above is simply `max.accumulateAndGet(value, Math::max)`.

### Lock-free, not wait-free

A CAS loop is **lock-free**: even if a thread is paused at the worst moment, others still make
progress, and no thread can block the rest. It is not **wait-free**: an unlucky thread can keep
losing the race and retrying. Under heavy contention, those retries cost CPU time.

### The ABA problem

CAS only asks "is the value still A?", not "has anything happened since?":

| Step | Thread 1 | Thread 2 | Value |
| --- | --- | --- | --- |
| 1 | reads A, then is paused | | A |
| 2 | | changes A → B | B |
| 3 | | changes B → A | A |
| 4 | `compareAndSet(A, C)` succeeds | | C |

For a counter this is harmless. For a linked structure it can corrupt data: if A is a stack's
top node that was popped and pushed back with a different successor, thread 1 installs a stale
link. The fix is to compare a **version** as well as the value.

## In code

### A lock-free stack

```java
class LockFreeStack<T> {
    private record Node<T>(T value, Node<T> next) {}
    private final AtomicReference<Node<T>> top = new AtomicReference<>();

    void push(T value) {
        Node<T> current, node;
        do {
            current = top.get();
            node = new Node<>(value, current);
        } while (!top.compareAndSet(current, node));
    }

    T pop() {
        Node<T> current;
        do {
            current = top.get();
            if (current == null) return null;
        } while (!top.compareAndSet(current, current.next()));
        return current.value();
    }
}
```

Each push creates a new node, and the garbage collector won't reuse a node's memory while any
thread still references it, so this classic stack is safe from ABA in Java.

### Guarding against ABA with a stamp

```java
AtomicStampedReference<String> ref = new AtomicStampedReference<>("A", 0);

int[] stampHolder = new int[1];
String seen = ref.get(stampHolder);   // value and stamp, read together
int seenStamp = stampHolder[0];

// ... meanwhile another thread may change A -> B -> A, bumping the stamp each time ...

boolean applied = ref.compareAndSet(seen, "C", seenStamp, seenStamp + 1);
// false if the stamp moved on, even though the value is "A" again
```

### A high-traffic counter

```java
LongAdder requests = new LongAdder();
requests.increment();          // from many threads, very little contention
long total = requests.sum();   // for a metrics endpoint; not an atomic snapshot
```

## Pitfalls

- **Check-then-act on an atomic.** `if (count.get() < limit) count.incrementAndGet();` lets two
  threads pass the check. Use `updateAndGet` or a CAS loop.
- **Side effects inside `updateAndGet` / `accumulateAndGet` functions.** They may run several
  times.
- **Expecting `AtomicReference` to compare with `equals()`.** It compares references.
- **Several atomics for one invariant.** Each is atomic alone; together they're not.
- **Ignoring contention.** A hot CAS loop on one variable can be slower than a lock; consider
  `LongAdder`, or splitting the state.
- **Mutable objects inside an `AtomicReference`.** Swapping the reference is atomic, but changing
  the object's fields afterwards isn't. Store immutable objects.

## When to use what

| Need | Use |
| --- | --- |
| A counter or ID generator | `AtomicLong` / `AtomicInteger` |
| A hot counter read rarely (metrics) | `LongAdder` |
| A running max, min or other combination | `accumulateAndGet` or `LongAccumulator` |
| Swap a whole immutable object (config, snapshot) | `AtomicReference` |
| Compare a version too, to avoid ABA | `AtomicStampedReference` |
| Several variables that must change together | A lock, or one immutable object in an `AtomicReference` |
| Atomic updates to a field of many objects | `AtomicIntegerFieldUpdater` or `VarHandle` |

## Further reading

- [`java.util.concurrent.atomic` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/package-summary.html)
- [`AtomicStampedReference` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/AtomicStampedReference.html)
- [`LongAdder` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html)
