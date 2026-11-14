---
title: "ConcurrentHashMap and concurrent collections"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, collections, concurrenthashmap]
summary: How ConcurrentHashMap stays fast under concurrency, its atomic operations, and which concurrent collection fits which job.
catalog: concurrent-collections
series: java-concurrency
priority: high
questions:
  - q: How does `ConcurrentHashMap` work in Java 8 and later?
    a: >-
      It's an array of bins, like `HashMap`. Inserting into an empty bin uses a CAS, with no lock.
      Changing a non-empty bin locks only that bin (`synchronized` on its first node), so writers to
      different bins don't block each other. Reads don't lock at all; they rely on `volatile` reads.
      Long bins become red-black trees, and resizing is shared: threads that touch the map help move
      bins to the new table.
  - q: How was it different in Java 7?
    a: >-
      Java 7 split the map into segments (16 by default), each a small hash table guarded by its own
      `ReentrantLock`. At most 16 writers could proceed in parallel. Java 8 replaced segments with
      per-bin locking and CAS, which scales further and uses less memory.
  - q: How is `ConcurrentHashMap` different from `Hashtable` and `Collections.synchronizedMap`?
    a: >-
      `Hashtable` and `synchronizedMap` use one lock for the whole map, so every read and write waits
      for every other. Iterating them needs manual locking or it throws
      `ConcurrentModificationException`. `ConcurrentHashMap` locks per bin, never locks reads,
      offers atomic compound operations, and has weakly consistent iterators that never throw.
  - q: Why doesn't `ConcurrentHashMap` allow null keys or values?
    a: >-
      In a concurrent map, `get(key)` returning `null` must mean "absent". If null values were
      allowed, you couldn't tell "absent" from "mapped to null", and checking with `containsKey`
      first would be a race because another thread can change the map in between.
  - q: How do you make a check-then-act on a map atomic?
    a: >-
      Use the map's atomic methods instead of `get`-then-`put`: `putIfAbsent`, `computeIfAbsent`,
      `compute`, `merge`, and `replace(key, old, new)`. The function you pass to `compute*` runs
      while the bin is locked, so keep it short and never update the same map inside it.
  - q: What is the difference between fail-fast and weakly consistent iterators?
    a: >-
      Fail-fast iterators (`ArrayList`, `HashMap`) throw `ConcurrentModificationException`, on a
      best-effort basis, if the collection changes during iteration. Weakly consistent iterators
      (`ConcurrentHashMap`, `ConcurrentLinkedQueue`) never throw; they may or may not show changes
      made after they were created. `CopyOnWriteArrayList` iterators work on a fixed snapshot.
  - q: Many threads count word frequencies in a `ConcurrentHashMap<String, Integer>`. Which call is safe?
    options:
      - "`counts.merge(word, 1, Integer::sum)`"
      - "`counts.put(word, counts.getOrDefault(word, 0) + 1)`"
      - "`if (counts.containsKey(word)) counts.put(word, counts.get(word) + 1); else counts.put(word, 1);`"
      - "`counts.get(word) + 1`"
    correct: 1
    a: >-
      `merge` reads and updates the value atomically. The other versions read, compute and write in
      separate steps, so two threads can read the same count and lose an update.
  - q: What does `ConcurrentHashMap.size()` return while other threads are writing?
    options:
      - "An estimate that may already be out of date"
      - "An exact count, taken under a global lock"
      - "It throws `ConcurrentModificationException`"
      - "Always 0 until writes stop"
    correct: 1
    a: >-
      With concurrent updates, any size is a moment-in-time estimate. Use `mappingCount()` for maps
      that may exceed `Integer.MAX_VALUE` entries; neither should be used to make decisions about
      the map's contents.
  - q: Which collection is designed for a list that's read very often and changed rarely, like listeners?
    options:
      - "`CopyOnWriteArrayList`"
      - "`Collections.synchronizedList(new ArrayList<>())`"
      - "`Vector`"
      - "`LinkedBlockingQueue`"
    correct: 1
    a: >-
      Every write copies the array, so writes are expensive, but reads and iteration need no lock and
      never throw. That fits read-mostly lists such as event listeners.
  - q: Which queue has no capacity and hands each element directly from producer to consumer?
    options:
      - "`SynchronousQueue`"
      - "`ArrayBlockingQueue`"
      - "`LinkedBlockingQueue`"
      - "`PriorityBlockingQueue`"
    correct: 1
    a: >-
      A `put` waits until a `take` receives the element. `newCachedThreadPool` uses it, so each task
      goes straight to a thread.
---

## The idea

Wrapping a `HashMap` in one big lock makes it safe but slow: every thread waits for every
other. The concurrent collections in `java.util.concurrent` are built so threads interfere as
little as possible. Some lock small parts of the structure, some use CAS, some copy on write,
and the blocking queues add waiting for producers and consumers.

## How it works

### Inside `ConcurrentHashMap`

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 260" role="img" aria-labelledby="chm-title chm-desc"><title id="chm-title">Inside ConcurrentHashMap (Java 8 and later)</title><desc id="chm-desc">The map is an array of bins. An empty bin gets its first entry with a compare-and-set, without locking. A bin holding a linked list is updated while holding a lock on its first node, so writers to other bins aren't blocked. A bin that grows long turns into a red-black tree. Reads never take a lock.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="60" y="20" text-anchor="start">Node[] table</text><rect class="d-box" x="60" y="30" width="70" height="44" rx="10"/><text class="d-text" x="95" y="57" text-anchor="middle">bin 0</text><rect class="d-box" x="140" y="30" width="70" height="44" rx="10"/><text class="d-text" x="175" y="57" text-anchor="middle">bin 1</text><rect class="d-box" x="220" y="30" width="70" height="44" rx="10"/><text class="d-text" x="255" y="57" text-anchor="middle">bin 2</text><rect class="d-box" x="300" y="30" width="70" height="44" rx="10"/><text class="d-text" x="335" y="57" text-anchor="middle">bin 3</text><rect class="d-box" x="380" y="30" width="70" height="44" rx="10"/><text class="d-text" x="415" y="57" text-anchor="middle">bin 4</text><rect class="d-box" x="460" y="30" width="70" height="44" rx="10"/><text class="d-text" x="495" y="57" text-anchor="middle">bin 5</text><rect class="d-box hi" x="540" y="30" width="70" height="44" rx="10"/><text class="d-text" x="575" y="57" text-anchor="middle">bin 6</text><rect class="d-box" x="620" y="30" width="70" height="44" rx="10"/><text class="d-text" x="655" y="57" text-anchor="middle">bin 7</text><rect class="d-box" x="145" y="110" width="60" height="36" rx="10"/><text class="d-text" x="175" y="133" text-anchor="middle">k : v</text><rect class="d-box" x="145" y="170" width="60" height="36" rx="10"/><text class="d-text" x="175" y="193" text-anchor="middle">k : v</text><line class="d-line" x1="175" y1="74" x2="175" y2="108" marker-end="url(#ah)"/><line class="d-line" x1="175" y1="146" x2="175" y2="168" marker-end="url(#ah)"/><text class="d-label" x="175" y="232" text-anchor="middle">list: lock its first node</text><rect class="d-box" x="385" y="110" width="60" height="36" rx="10"/><text class="d-text" x="415" y="133" text-anchor="middle">k : v</text><rect class="d-box" x="345" y="180" width="60" height="36" rx="10"/><text class="d-text" x="375" y="203" text-anchor="middle">k : v</text><rect class="d-box" x="425" y="180" width="60" height="36" rx="10"/><text class="d-text" x="455" y="203" text-anchor="middle">k : v</text><line class="d-line" x1="415" y1="74" x2="415" y2="108" marker-end="url(#ah)"/><line class="d-line" x1="400" y1="146" x2="380" y2="178" marker-end="url(#ah)"/><line class="d-line" x1="430" y1="146" x2="450" y2="178" marker-end="url(#ah)"/><text class="d-label" x="415" y="240" text-anchor="middle">long bin → red-black tree</text><text class="d-label hi" x="575" y="100" text-anchor="middle">empty bin:</text><text class="d-label hi" x="575" y="116" text-anchor="middle">insert with CAS, no lock</text><text class="d-label hi" x="575" y="190" text-anchor="middle">get() never locks</text></svg>
<figcaption>Locking is per bin, not per map, so threads writing to different bins don't wait for each other, and readers never wait at all.</figcaption>
</figure>

- **Empty bin**: the first entry is inserted with a CAS, without a lock.
- **Non-empty bin**: the writer locks only that bin's first node.
- **Long bin**: at 8 entries, a bin becomes a red-black tree (once the table has at least 64
  bins; before that, the table grows instead), so lookups stay fast even with bad hash codes.
- **Reads** never lock, so `get` runs in parallel with everything.
- **Resizing** is shared: threads that update the map during a resize help move bins.
- **No `null`** keys or values.

### Atomic operations

| Method | Atomically |
| --- | --- |
| `putIfAbsent(k, v)` | Adds only if absent |
| `computeIfAbsent(k, fn)` | Computes and adds if absent; `fn` runs at most once per key |
| `compute(k, fn)` | Replaces the value using the old one |
| `merge(k, v, fn)` | Adds `v`, or combines it with the existing value |
| `replace(k, old, new)` | Compare-and-set on a single key |

### Map choices

| Map | Locking | Iteration while others write |
| --- | --- | --- |
| `HashMap` | None (not thread-safe) | Fail-fast |
| `Hashtable` / `Collections.synchronizedMap` | One lock for everything | Must lock manually |
| `ConcurrentHashMap` | Per bin, reads lock-free | Weakly consistent, never throws |
| `ConcurrentSkipListMap` | Lock-free, sorted | Weakly consistent |

### Blocking queues

| Queue | Bound | Notes |
| --- | --- | --- |
| `ArrayBlockingQueue` | Fixed capacity | One lock; optional fairness |
| `LinkedBlockingQueue` | Optional (default `Integer.MAX_VALUE`) | Separate put and take locks |
| `SynchronousQueue` | Zero | Direct hand-off |
| `PriorityBlockingQueue` | Unbounded | Elements in priority order |
| `DelayQueue` | Unbounded | An element is available only after its delay |
| `LinkedTransferQueue` | Unbounded | `transfer` waits until a consumer receives it |

Each queue offers three styles: `put` / `take` wait, `offer` / `poll` return `false` / `null`
(optionally after a timeout), and `add` / `remove` throw.

### Other concurrent collections

- **`CopyOnWriteArrayList` / `CopyOnWriteArraySet`**: every write copies the array; iteration
  sees a snapshot and never throws. Great for listener lists, bad for frequent writes.
- **`ConcurrentLinkedQueue` / `ConcurrentLinkedDeque`**: lock-free, unbounded, non-blocking.
- **`ConcurrentSkipListMap` / `ConcurrentSkipListSet`**: sorted, concurrent `TreeMap` / `TreeSet`.

## In code

### Counting and caching safely

```java
ConcurrentHashMap<String, Integer> counts = new ConcurrentHashMap<>();
for (String word : words) {
    counts.merge(word, 1, Integer::sum);                    // atomic increment
}

// for very hot counters, avoid contention on the same bin
ConcurrentHashMap<String, LongAdder> hits = new ConcurrentHashMap<>();
hits.computeIfAbsent("/orders", k -> new LongAdder()).increment();

// a cache: the loader runs at most once per key
ConcurrentHashMap<Long, Product> cache = new ConcurrentHashMap<>();
Product p = cache.computeIfAbsent(productId, repository::load);
```

### Producer and consumer with a `BlockingQueue`

```java
BlockingQueue<String> queue = new ArrayBlockingQueue<>(100);
final String DONE = "__done__";                              // a "poison pill" to stop the consumer

Thread producer = new Thread(() -> {
    try {
        for (String line : lines) queue.put(line);           // waits when the queue is full
        queue.put(DONE);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});

Thread consumer = new Thread(() -> {
    try {
        for (String line = queue.take(); !line.equals(DONE); line = queue.take()) {
            process(line);                                   // waits when the queue is empty
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});
```

## Pitfalls

- **`get` then `put`** on a concurrent map. Each call is safe; the pair isn't. Use `merge` or
  `compute*`.
- **Slow or recursive functions in `computeIfAbsent`**, which hold the bin lock while they run;
  updating the same map inside them can deadlock or throw.
- **Relying on `size()`** under concurrent writes.
- **Unbounded queues** between fast producers and slow consumers, which grow until memory runs
  out.
- **`CopyOnWriteArrayList` with frequent writes**: each write copies the whole array.
- **Iterating a `synchronizedMap` without holding its lock.**
- **Putting mutable objects in a concurrent map and changing them later.** The map makes its
  own operations safe, not your objects.

## When to use what

| Need | Use |
| --- | --- |
| A shared map | `ConcurrentHashMap` |
| A shared sorted map | `ConcurrentSkipListMap` |
| Counters per key | `ConcurrentHashMap` with `merge`, or `LongAdder` values |
| Producer–consumer with back-pressure | `ArrayBlockingQueue` (or a bounded `LinkedBlockingQueue`) |
| A non-blocking queue | `ConcurrentLinkedQueue` |
| Read-mostly list, e.g. listeners | `CopyOnWriteArrayList` |
| Scheduled or delayed items | `DelayQueue` |

## Further reading

- [`ConcurrentHashMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html)
- [`BlockingQueue` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html)
