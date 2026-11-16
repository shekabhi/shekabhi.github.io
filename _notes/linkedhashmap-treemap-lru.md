---
title: "LinkedHashMap, TreeMap and an LRU cache"
short_title: "LinkedHashMap, TreeMap, LRU cache"
topic: Java collections
date: 2026-11-16
tags: [java, collections, linkedhashmap, treemap, lru-cache]
summary: How LinkedHashMap keeps order, how to build an LRU cache with it in a few lines, and how TreeMap keeps keys sorted and answers floor, ceiling and range queries.
catalog: linkedhashmap-treemap
series: java-collections
priority: high
questions:
  - q: How does `LinkedHashMap` keep its order?
    a: >-
      It's a `HashMap` whose entries are also linked in a doubly linked list. Lookups use the
      hash table as usual; iteration follows the list. By default the list is in insertion
      order (re-inserting an existing key doesn't move it). Constructed with
      `accessOrder = true`, every `get` or `put` moves the entry to the end, so the list runs
      from least to most recently used.
  - q: How do you build an LRU cache in Java?
    a: >-
      Extend `LinkedHashMap`, call `super(capacity, 0.75f, true)` to switch on access order,
      and override `removeEldestEntry` to return `size() > maxEntries`. The map calls it after
      each `put`; returning `true` removes the eldest entry, which in access order is the least
      recently used. It's not thread-safe; for a shared cache, use a library such as Caffeine,
      or guard it with a lock.
  - q: How does `TreeMap` store its entries?
    a: >-
      In a red-black tree, a self-balancing binary search tree, ordered by the keys' natural
      order or by a `Comparator` passed to the constructor. `get`, `put` and `remove` are
      O(log n), and iteration is always in sorted key order. It uses `compareTo` (or the
      comparator), not `equals` and `hashCode`, to find keys.
  - q: What navigation methods does `TreeMap` offer?
    a: >-
      `firstKey`/`lastKey`, `floorKey(k)` (greatest key ≤ k), `ceilingKey(k)` (least key ≥ k),
      `lowerKey`/`higherKey` (strictly less or greater), range views `headMap`, `tailMap` and
      `subMap`, `descendingMap`, and `pollFirstEntry`/`pollLastEntry` to remove from the ends.
      Each has an `Entry` version, such as `floorEntry`.
  - q: When would you choose `TreeMap` over `HashMap`?
    a: >-
      When you need sorted iteration, or questions like "the nearest key at or below this
      value", "everything between these two keys" or "the smallest key". Examples: score
      bands, time-series by timestamp, price levels in an order book. If you only look up exact
      keys, `HashMap` is faster.
  - q: What happens when a `TreeMap`'s comparator says two different keys are equal?
    a: >-
      The map treats them as the same key: the second `put` replaces the value and keeps the
      first key object. With `String.CASE_INSENSITIVE_ORDER`, `"Java"` and `"JAVA"` are one
      entry. That's often the point, but it means the map no longer behaves like a `HashMap`
      with the same keys.
  - q: "An LRU cache of capacity 3 holds `home`, `about`, `work` (oldest first). You call `get(\"home\")`, then `put(\"play\")`. Which key is evicted?"
    options:
      - "`about`"
      - "`home`"
      - "`work`"
      - "None; the cache grows to 4"
    correct: 1
    a: >-
      `get("home")` moved `home` to the most-recent end, so `about` became the least recently
      used and is removed when `play` pushes the size over 3.
  - q: "`grades` maps 60, 70, 80 and 90 to letters. What does `grades.floorKey(84)` return?"
    options:
      - "80"
      - "90"
      - "84"
      - "`null`"
    correct: 1
    a: >-
      `floorKey` returns the greatest key less than or equal to the argument. `ceilingKey(84)`
      would return 90.
  - q: In an insertion-ordered `LinkedHashMap`, you `put` an existing key again. Where does it appear when iterating?
    options:
      - "In its original position, with the new value"
      - "At the end"
      - "At the start"
      - "Twice"
    correct: 1
    a: >-
      Insertion order is about when the key was first added. Only an access-ordered map moves
      entries on `put` or `get`.
  - q: What is the time complexity of `TreeMap.get`?
    options:
      - "O(log n)"
      - "O(1)"
      - "O(n)"
      - "O(n log n)"
    correct: 1
    a: >-
      A balanced tree of n keys is about log₂ n levels deep, and a lookup walks one path from
      the root.
---

## The idea

`HashMap` is fast but has no order you can use. Two siblings add order:

- **`LinkedHashMap`** keeps the speed of a hash table and adds a **linked list through its
  entries**, in insertion order or in access order. Access order is all you need for an LRU cache.
- **`TreeMap`** gives up some speed for **sorted keys**, and can answer questions a hash table
  can't: the nearest key, the smallest key, everything in a range.

## How it works

### LinkedHashMap: a hash table plus a list

Lookups go through the hash table. Iteration follows a doubly linked list that runs through the
same entries, so it costs nothing extra to keep order.

| Mode | Constructor | The list is ordered by | Moves on `get`? |
| --- | --- | --- | --- |
| Insertion order (default) | `new LinkedHashMap<>()` | When each key was first added | No |
| Access order | `new LinkedHashMap<>(16, 0.75f, true)` | Least to most recently used | Yes, to the end |

### An LRU cache in a dozen lines

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 250" role="img" aria-labelledby="lru-title lru-desc"><title id="lru-title">How an access-ordered LinkedHashMap works as an LRU cache</title><desc id="lru-desc">The cache starts as home, about, work, from least to most recently used. get home moves home to the most recent end, giving about, work, home. put play adds play at the end; the size is now over the capacity of 3, so the eldest entry, about, is removed, leaving work, home, play.</desc><defs><marker id="lru-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="22">LEAST RECENTLY USED ←</text><text class="d-label" x="740" y="22" text-anchor="end">→ MOST RECENTLY USED</text><text class="d-label" x="20" y="54">start</text><rect class="d-box" x="130" y="36" width="110" height="30" rx="6"/><text class="d-sub" x="185" y="56" text-anchor="middle">home</text><rect class="d-box" x="250" y="36" width="110" height="30" rx="6"/><text class="d-sub" x="305" y="56" text-anchor="middle">about</text><rect class="d-box" x="370" y="36" width="110" height="30" rx="6"/><text class="d-sub" x="425" y="56" text-anchor="middle">work</text><text class="d-label" x="20" y="124">get(home)</text><rect class="d-box" x="130" y="106" width="110" height="30" rx="6"/><text class="d-sub" x="185" y="126" text-anchor="middle">about</text><rect class="d-box" x="250" y="106" width="110" height="30" rx="6"/><text class="d-sub" x="305" y="126" text-anchor="middle">work</text><rect class="d-box hi" x="370" y="106" width="110" height="30" rx="6"/><text class="d-sub" x="425" y="126" text-anchor="middle">home</text><text class="d-label hi" x="500" y="126">moved to the end</text><text class="d-label" x="20" y="194">put(play)</text><rect class="d-box warn" x="130" y="176" width="110" height="30" rx="6" style="stroke-dasharray:5 4"/><text class="d-sub" x="185" y="196" text-anchor="middle">about ✕</text><rect class="d-box" x="250" y="176" width="110" height="30" rx="6"/><text class="d-sub" x="305" y="196" text-anchor="middle">work</text><rect class="d-box" x="370" y="176" width="110" height="30" rx="6"/><text class="d-sub" x="425" y="196" text-anchor="middle">home</text><rect class="d-box hi" x="490" y="176" width="110" height="30" rx="6"/><text class="d-sub" x="545" y="196" text-anchor="middle">play</text><text class="d-label warn" x="130" y="232">size 4 > capacity 3: removeEldestEntry evicts the head</text></svg>
<figcaption>With access order on, the head of the list is always the least recently used entry, which is exactly what an LRU cache should evict.</figcaption>
</figure>

### TreeMap: sorted keys and navigation

| Method | Returns | For keys 60, 70, 80, 90 and argument 84 |
| --- | --- | --- |
| `floorKey(k)` | Greatest key ≤ k | 80 |
| `ceilingKey(k)` | Least key ≥ k | 90 |
| `lowerKey(k)` / `higherKey(k)` | Strictly less / greater | 80 / 90 |
| `headMap(k)` | Keys < k | For 80: {60, 70} |
| `tailMap(k, true)` | Keys ≥ k | For 80: {80, 90} |
| `subMap(a, b)` | a ≤ keys < b | For 70, 90: {70, 80} |
| `firstKey()` / `lastKey()` | Smallest / largest | 60 / 90 |
| `pollFirstEntry()` | Removes and returns the smallest | 60=D |

The range views (`headMap`, `tailMap`, `subMap`) are live views: changes go through to the map.

## In code: an LRU cache and grade bands

```java
import java.util.*;

public class LruCache {
    // An LRU cache in a few lines: access order + evict the eldest entry when over capacity
    static class Lru<K, V> extends LinkedHashMap<K, V> {
        private final int capacity;

        Lru(int capacity) {
            super(16, 0.75f, true);                 // true = order by access, not insertion
            this.capacity = capacity;
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity;               // called after every put
        }
    }

    public static void main(String[] args) {
        // Insertion order: re-putting an existing key doesn't move it
        Map<String, Integer> insertion = new LinkedHashMap<>();
        insertion.put("b", 1); insertion.put("a", 2); insertion.put("b", 3);
        System.out.println("insertion order:   " + insertion);

        Lru<String, String> cache = new Lru<>(3);
        cache.put("home", "<html>home</html>");
        cache.put("about", "<html>about</html>");
        cache.put("work", "<html>work</html>");
        System.out.println("cache:             " + cache.keySet());
        cache.get("home");                          // home becomes the most recently used
        System.out.println("after get(home):   " + cache.keySet());
        cache.put("play", "<html>play</html>");     // over capacity: evicts the least recent
        System.out.println("after put(play):   " + cache.keySet());

        // TreeMap: sorted keys plus navigation
        TreeMap<Integer, String> grades = new TreeMap<>(Map.of(90, "A", 80, "B", 70, "C", 60, "D"));
        int score = 84;
        System.out.println("floorEntry(84):    " + grades.floorEntry(score));      // greatest key <= 84
        System.out.println("ceilingKey(84):    " + grades.ceilingKey(score));      // least key >= 84
        System.out.println("headMap(80):       " + grades.headMap(80));            // keys < 80
        System.out.println("tailMap(80, true): " + grades.tailMap(80, true));      // keys >= 80
        System.out.println("first / last:      " + grades.firstKey() + " / " + grades.lastKey());
        System.out.println("descending:        " + grades.descendingMap());

        // A case-insensitive TreeMap treats "Java" and "JAVA" as the same key
        TreeMap<String, Integer> tags = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        tags.put("Java", 1);
        tags.put("JAVA", 2);
        System.out.println("case-insensitive:  " + tags);
    }
}
```
{: .runnable}

```text
insertion order:   {b=3, a=2}
cache:             [home, about, work]
after get(home):   [about, work, home]
after put(play):   [work, home, play]
floorEntry(84):    80=B
ceilingKey(84):    90
headMap(80):       {60=D, 70=C}
tailMap(80, true): {80=B, 90=A}
first / last:      60 / 90
descending:        {90=A, 80=B, 70=C, 60=D}
case-insensitive:  {Java=2}
```
{: .run-output}

- Re-putting `"b"` kept its first position in the insertion-ordered map.
- `get("home")` refreshed `home`, so `about` was evicted when `play` arrived.
- `floorEntry(84)` finds the grade band for a score in one call.
- The case-insensitive comparator made `"Java"` and `"JAVA"` one key: the value was replaced,
  the first key's spelling kept.

## Pitfalls

- **Forgetting the `true` in the constructor.** Without access order, the "LRU" cache evicts the
  oldest *inserted* entry, which is FIFO.
- **Sharing a `LinkedHashMap` cache between threads.** In access order even `get` changes the
  list, so concurrent reads can corrupt it. Lock it, or use a concurrent cache library.
- **Assuming `get` is read-only in an access-ordered map.** It moves the entry; iterating while
  calling `get` throws `ConcurrentModificationException`.
- **`TreeMap` with `null` keys.** Natural ordering can't compare `null`; `put(null, ...)`
  throws `NullPointerException`.
- **A comparator inconsistent with `equals`.** The map may merge keys that `equals` calls
  different, or the other way round.
- **Mutating keys inside a `TreeMap`.** Changing a field the comparator uses breaks the tree's
  order, and lookups stop working.

## When to use what

| Need | Use |
| --- | --- |
| Fast lookups, predictable insertion-order iteration | `LinkedHashMap` |
| A small, single-threaded LRU cache | `LinkedHashMap` with access order + `removeEldestEntry` |
| A cache shared between threads, with expiry | A cache library (for example Caffeine) |
| Sorted iteration by key | `TreeMap` |
| Nearest key, ranges, smallest or largest key | `TreeMap` (`floor`, `ceiling`, `subMap`, `firstKey`) |
| Sorted and concurrent | `ConcurrentSkipListMap` |

## Further reading

- [`LinkedHashMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html)
- [`TreeMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html)
- [`NavigableMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/NavigableMap.html)
