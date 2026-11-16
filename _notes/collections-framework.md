---
title: "The collections framework: interfaces and how to choose"
short_title: "Java collections: how to choose"
topic: Java collections
date: 2026-11-16
tags: [java, collections, list, set, map, queue]
summary: The main collection interfaces, what each implementation is good at, and a quick way to pick the right one.
catalog: collections-framework
series: java-collections
priority: high
questions:
  - q: What are the main interfaces in the Java collections framework?
    a: >-
      `Collection` is the root for groups of elements. `List` is ordered and allows duplicates
      (index-based access). `Set` holds no duplicates. `Queue` hands elements out in a defined
      order, usually first in, first out; `Deque` adds both ends, so it also works as a stack.
      `Map` stores key-value pairs with unique keys and is *not* a `Collection`, though it
      offers collection views: `keySet()`, `values()` and `entrySet()`.
  - q: What is the difference between `HashMap`, `LinkedHashMap` and `TreeMap`?
    a: >-
      All map unique keys to values. `HashMap` is the fastest (average O(1) `get`/`put`) and has
      no reliable order. `LinkedHashMap` is a `HashMap` that also remembers insertion order (or
      access order, useful for caches). `TreeMap` keeps keys sorted, with O(log n) operations,
      and adds navigation such as `firstKey`, `floorKey` and `subMap`. Sets follow the same
      pattern: `HashSet`, `LinkedHashSet`, `TreeSet`.
  - q: How do you choose a collection?
    a: >-
      Ask what you need to do most. Access by position, or keep duplicates in order: `List`
      (usually `ArrayList`). Unique elements and fast `contains`: `Set` (`HashSet`). Look up a
      value by a key: `Map` (`HashMap`). Sorted order: the `Tree` variants. Insertion order:
      the `Linked` variants. Process items in arrival or priority order: `ArrayDeque` or
      `PriorityQueue`.
  - q: Why program to the interface, as in `List<String> names = new ArrayList<>()`?
    a: >-
      The rest of the code depends only on the `List` contract, so you can change the
      implementation in one place (for example to `LinkedList` or an unmodifiable list) without
      touching callers. Methods should likewise accept and return interfaces: `List`, `Map`,
      `Collection`, not `ArrayList` or `HashMap`.
  - q: Is `Map` a `Collection`?
    a: >-
      No. A `Map` stores pairs, so it doesn't fit `Collection`'s single-element methods such as
      `add(E)`. It provides three views that are collections: `keySet()` (a `Set`), `values()`
      (a `Collection`) and `entrySet()` (a `Set` of `Map.Entry`). Changes to a view, such as
      removing a key from `keySet()`, change the map.
  - q: Which collections are thread-safe?
    a: >-
      None of the common ones: `ArrayList`, `HashMap`, `HashSet`, `ArrayDeque` and the rest
      assume one thread at a time. For concurrent use, choose a concurrent collection such as
      `ConcurrentHashMap`, `CopyOnWriteArrayList` or a `BlockingQueue` (covered in the
      concurrency series). The old `Vector`, `Hashtable` and `Stack` are synchronized but slow
      and legacy.
  - q: You need unique elements, kept in sorted order. Which do you pick?
    options:
      - "`TreeSet`"
      - "`HashSet`"
      - "`LinkedHashSet`"
      - "`ArrayList`"
    correct: 1
    a: >-
      `TreeSet` keeps elements sorted (by natural order or a `Comparator`). `HashSet` has no
      order, and `LinkedHashSet` keeps insertion order, not sorted order.
  - q: Which of these is NOT a `Collection`?
    options:
      - "`HashMap`"
      - "`ArrayDeque`"
      - "`TreeSet`"
      - "`LinkedList`"
    correct: 1
    a: >-
      Maps are a separate hierarchy. `ArrayDeque` is a `Deque` (a `Queue`), `TreeSet` is a `Set`
      and `LinkedList` is both a `List` and a `Deque`.
  - q: What is the average time for `HashMap.get` with a good `hashCode`?
    options:
      - "O(1)"
      - "O(log n)"
      - "O(n)"
      - "O(n log n)"
    correct: 1
    a: >-
      Constant time on average: the hash picks a bucket directly. `TreeMap.get` is O(log n). A
      bad `hashCode` that piles keys into one bucket makes `HashMap` slower (O(log n) once Java 8
      turns that bucket into a tree).
  - q: You need to iterate a map in the order keys were first inserted. Which do you use?
    options:
      - "`LinkedHashMap`"
      - "`HashMap`"
      - "`TreeMap`"
      - "`EnumMap`"
    correct: 1
    a: >-
      `LinkedHashMap` keeps a linked list through its entries in insertion order. `HashMap`
      gives no guarantee, and `TreeMap` sorts by key.
---

## The idea

The collections framework is a small set of **interfaces** (`List`, `Set`, `Queue`, `Deque`,
`Map`) with several **implementations** each. The interface says what you can do; the
implementation decides how fast it is, what order you get, and whether `null` and duplicates
are allowed.

Choosing well comes down to one question: **what will this code do most often?** Look up by key,
check membership, keep things in order, or take the next item to process.

## How it works

### The interfaces

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 334" role="img" aria-labelledby="cf-title cf-desc"><title id="cf-title">The collection interfaces</title><desc id="cf-desc">Iterable is the root. Collection extends it, and List, Set and Queue extend Collection. SortedSet extends Set, and Deque extends Queue. Map is a separate hierarchy with SortedMap below it. Under each interface are its main implementations: ArrayList and LinkedList for List; HashSet and LinkedHashSet for Set; TreeSet for SortedSet; PriorityQueue for Queue; ArrayDeque and LinkedList for Deque; HashMap and LinkedHashMap for Map; TreeMap for SortedMap.</desc><defs><marker id="cf-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="200" y="10" width="140" height="36" rx="8"/><text class="d-text" x="270" y="33" text-anchor="middle">Iterable</text><rect class="d-box" x="200" y="66" width="140" height="36" rx="8"/><text class="d-text" x="270" y="89" text-anchor="middle">Collection</text><line class="d-line" x1="270" y1="66" x2="270" y2="48" marker-end="url(#cf-ah)"/><rect class="d-box hi" x="20" y="132" width="140" height="36" rx="8"/><text class="d-text" x="90" y="155" text-anchor="middle">List</text><rect class="d-box hi" x="200" y="132" width="140" height="36" rx="8"/><text class="d-text" x="270" y="155" text-anchor="middle">Set</text><rect class="d-box hi" x="380" y="132" width="140" height="36" rx="8"/><text class="d-text" x="450" y="155" text-anchor="middle">Queue</text><line class="d-line" x1="90" y1="132" x2="230" y2="104" marker-end="url(#cf-ah)"/><line class="d-line" x1="270" y1="132" x2="270" y2="104" marker-end="url(#cf-ah)"/><line class="d-line" x1="450" y1="132" x2="310" y2="104" marker-end="url(#cf-ah)"/><rect class="d-box" x="200" y="198" width="140" height="36" rx="8"/><text class="d-text" x="270" y="221" text-anchor="middle">SortedSet</text><line class="d-line" x1="270" y1="198" x2="270" y2="170" marker-end="url(#cf-ah)"/><rect class="d-box" x="380" y="198" width="140" height="36" rx="8"/><text class="d-text" x="450" y="221" text-anchor="middle">Deque</text><line class="d-line" x1="450" y1="198" x2="450" y2="170" marker-end="url(#cf-ah)"/><rect class="d-box hi" x="580" y="66" width="160" height="36" rx="8"/><text class="d-text" x="660" y="89" text-anchor="middle">Map</text><rect class="d-box" x="580" y="132" width="160" height="36" rx="8"/><text class="d-text" x="660" y="155" text-anchor="middle">SortedMap</text><line class="d-line" x1="660" y1="132" x2="660" y2="104" marker-end="url(#cf-ah)"/><text class="d-label" x="660" y="36" text-anchor="middle">NOT A COLLECTION</text><text class="d-sub" x="90" y="190" text-anchor="middle">ArrayList</text><text class="d-sub" x="90" y="208" text-anchor="middle">LinkedList</text><text class="d-sub" x="270" y="254" text-anchor="middle">TreeSet (SortedSet)</text><text class="d-sub" x="270" y="272" text-anchor="middle">HashSet, LinkedHashSet</text><text class="d-sub" x="270" y="290" text-anchor="middle">(plain Set)</text><text class="d-sub" x="450" y="254" text-anchor="middle">ArrayDeque, LinkedList (Deque)</text><text class="d-sub" x="450" y="272" text-anchor="middle">PriorityQueue</text><text class="d-sub" x="450" y="290" text-anchor="middle">(plain Queue)</text><text class="d-sub" x="660" y="230" text-anchor="middle">HashMap, LinkedHashMap</text><text class="d-sub" x="660" y="250" text-anchor="middle">TreeMap (SortedMap)</text><text class="d-label" x="20" y="326">Arrows point from an interface to the one it extends; grey text names the main implementations.</text></svg>
<figcaption><code>Map</code> sits apart: it stores key-value pairs, so it isn't a <code>Collection</code>, but it offers collection views of its keys, values and entries.</figcaption>
</figure>

### Implementations at a glance

| Implementation | Interface | Order | Duplicates / `null` | Typical cost |
| --- | --- | --- | --- | --- |
| `ArrayList` | `List` | Insertion (by index) | Yes / yes | `get(i)` O(1); add at end amortised O(1); insert in the middle O(n) |
| `LinkedList` | `List`, `Deque` | Insertion | Yes / yes | Add or remove at the ends O(1); `get(i)` O(n) |
| `HashSet` | `Set` | None you can rely on | No / one `null` | `add`, `contains` O(1) average |
| `LinkedHashSet` | `Set` | Insertion | No / one `null` | O(1) average, a little more memory |
| `TreeSet` | `SortedSet`, `NavigableSet` | Sorted | No / no `null` | O(log n) |
| `ArrayDeque` | `Deque` | Ends only | Yes / no `null` | O(1) at both ends |
| `PriorityQueue` | `Queue` | Smallest first (heap) | Yes / no `null` | `offer`, `poll` O(log n); `peek` O(1) |
| `HashMap` | `Map` | None you can rely on | Unique keys / one `null` key | `get`, `put` O(1) average |
| `LinkedHashMap` | `Map` | Insertion or access | Unique keys / one `null` key | O(1) average |
| `TreeMap` | `SortedMap`, `NavigableMap` | Sorted by key | Unique keys / no `null` key | O(log n) |

### Choosing in four questions

1. **Key-value lookups?** Use a `Map`, usually `HashMap`.
2. **Unique elements, or fast `contains`?** Use a `Set`, usually `HashSet`.
3. **Process items in arrival or priority order?** Use `ArrayDeque` (FIFO or stack) or
   `PriorityQueue`.
4. **Otherwise**, a `List`: almost always `ArrayList`.

Then pick the variant for order: plain `Hash` for none, `Linked` for insertion order, `Tree`
for sorted.

## In code: same data, different collections

```java
import java.util.*;

public class Choosing {
    public static void main(String[] args) {
        List<String> input = List.of("pear", "apple", "fig", "apple", "banana");

        // Lists keep insertion order and allow duplicates
        System.out.println("ArrayList:     " + new ArrayList<>(input));

        // Sets drop duplicates; each keeps a different order
        System.out.println("HashSet:       " + new HashSet<>(input));        // by hash: don't rely on it
        System.out.println("LinkedHashSet: " + new LinkedHashSet<>(input));  // insertion order
        System.out.println("TreeSet:       " + new TreeSet<>(input));        // sorted

        // Maps: keys are unique, the same three orderings
        Map<String, Integer> hash = new HashMap<>(), linked = new LinkedHashMap<>(), tree = new TreeMap<>();
        for (String fruit : input) {
            hash.merge(fruit, 1, Integer::sum);
            linked.merge(fruit, 1, Integer::sum);
            tree.merge(fruit, 1, Integer::sum);
        }
        System.out.println("HashMap:       " + hash);
        System.out.println("LinkedHashMap: " + linked);
        System.out.println("TreeMap:       " + tree);

        // Queue (FIFO) and Deque used as a stack (LIFO)
        Deque<String> queue = new ArrayDeque<>(), stack = new ArrayDeque<>();
        for (String fruit : List.of("a", "b", "c")) { queue.offer(fruit); stack.push(fruit); }
        System.out.println("queue poll:    " + queue.poll() + ", stack pop: " + stack.pop());

        // PriorityQueue hands out the smallest first, whatever the insertion order
        PriorityQueue<Integer> pq = new PriorityQueue<>(List.of(42, 7, 19, 3));
        StringBuilder out = new StringBuilder();
        while (!pq.isEmpty()) out.append(pq.poll()).append(' ');
        System.out.println("PriorityQueue: " + out.toString().trim());

        // Map is not a Collection, but it has three collection views
        System.out.println("keySet:        " + tree.keySet() + ", values: " + tree.values());
    }
}
```
{: .runnable}

```text
ArrayList:     [pear, apple, fig, apple, banana]
HashSet:       [banana, apple, pear, fig]
LinkedHashSet: [pear, apple, fig, banana]
TreeSet:       [apple, banana, fig, pear]
HashMap:       {banana=1, apple=2, pear=1, fig=1}
LinkedHashMap: {pear=1, apple=2, fig=1, banana=1}
TreeMap:       {apple=2, banana=1, fig=1, pear=1}
queue poll:    a, stack pop: c
PriorityQueue: 3 7 19 42
keySet:        [apple, banana, fig, pear], values: [2, 1, 1, 1]
```
{: .run-output}

The `HashSet` and `HashMap` order comes from the hash codes and table size. It's stable for the
same data on the same JVM, but don't depend on it: it can change when the map grows or between
Java versions.

## Pitfalls

- **Relying on `HashMap` or `HashSet` iteration order.** Tests pass until a resize or upgrade.
  Use `LinkedHashMap` or `TreeMap` when order matters.
- **Declaring variables as implementations.** `ArrayList<String> names` ties every caller to one
  class; declare `List<String>`.
- **`contains` on a big `List` inside a loop.** Each call is O(n); put the items in a `HashSet`
  first.
- **Legacy classes.** `Vector`, `Hashtable` and `Stack` are synchronized and slow. Use
  `ArrayList`, `HashMap` and `ArrayDeque`, or a concurrent collection when threads share it.
- **Using collections from several threads.** The standard ones aren't thread-safe; see the
  concurrency series for `ConcurrentHashMap` and friends.

## When to use what

| Need | Use |
| --- | --- |
| A list you read by index and add to at the end | `ArrayList` |
| A FIFO queue or a stack | `ArrayDeque` |
| The smallest (or highest-priority) item first | `PriorityQueue` |
| Fast membership tests | `HashSet` |
| Unique items in insertion order | `LinkedHashSet` |
| Unique items, sorted, with range queries | `TreeSet` |
| Key-value lookups | `HashMap` |
| Key-value with insertion order, or an LRU cache | `LinkedHashMap` |
| Key-value sorted by key, floor and ceiling lookups | `TreeMap` |
| Keys from an `enum` | `EnumMap` / `EnumSet` |

## Further reading

- [The Java Tutorials: Collections](https://docs.oracle.com/javase/tutorial/collections/index.html)
- [Collections framework overview (Java 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/doc-files/coll-overview.html)
