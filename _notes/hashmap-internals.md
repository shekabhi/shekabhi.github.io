---
title: "HashMap internals: buckets, resizing, treeification"
short_title: "HashMap internals"
topic: Java collections
date: 2026-11-16
tags: [java, collections, hashmap, hashing]
summary: How HashMap turns a key into a bucket, what happens on a collision, when and how the table grows, and why a bucket can become a tree.
catalog: hashmap-internals
series: java-collections
priority: high
questions:
  - q: How does `HashMap` decide which bucket a key goes in?
    a: >-
      It takes the key's `hashCode()`, mixes the high 16 bits into the low 16 (`h ^ (h >>> 16)`),
      and keeps only the low bits with `hash & (table.length - 1)`. The table length is always a
      power of two, so that mask is the same as `hash % length`, only faster. Mixing the high
      bits in matters because a small table only looks at the lowest few bits.
  - q: What happens when two keys land in the same bucket?
    a: >-
      That's a collision. The bucket holds a small linked list of entries; a lookup walks it,
      comparing the stored hash first and then calling `equals`. Since Java 8, a bucket with 8 or
      more entries is turned into a balanced red-black tree (if the table has at least 64
      buckets), so a badly distributed bucket costs O(log n) instead of O(n).
  - q: When does a `HashMap` resize, and what does resizing do?
    a: >-
      When the number of entries exceeds `capacity × load factor`: 12 for the default 16 buckets
      and load factor 0.75. The table doubles, and every entry is moved. Because the size is a
      power of two, each entry either stays at its index `i` or moves to `i + oldCapacity`,
      depending on one extra bit of its hash. Resizing is O(n), so the cost of `put` is O(1)
      only on average (amortised).
  - q: What is the load factor, and why 0.75?
    a: >-
      It's how full the table may get before it grows. A lower value means fewer collisions but
      more memory; a higher value saves memory but makes chains longer. 0.75 is the default
      trade-off. You can pass a different one to the constructor, but it's rarely worth it.
  - q: How do you create a `HashMap` that holds 100 entries without resizing?
    a: >-
      Use `HashMap.newHashMap(100)` (Java 19+), which accounts for the load factor and allocates
      256 buckets. `new HashMap<>(100)` is a common mistake: it allocates 128 buckets, whose
      threshold is 96, so it still resizes before reaching 100. On older Java, use
      `new HashMap<>((int) (100 / 0.75f) + 1)`.
  - q: Why does `HashMap` iteration order change?
    a: >-
      Iteration walks the table bucket by bucket. When the table grows, entries move to new
      indexes, so the order changes. It can also differ between Java versions. If order matters,
      use `LinkedHashMap` (insertion or access order) or `TreeMap` (sorted).
  - q: With the default settings, on which `put` does a new `HashMap` first resize?
    options:
      - "The 13th: 16 buckets × 0.75 = 12 entries"
      - "The 17th: when all 16 buckets are used"
      - "The 9th"
      - "Never; HashMap grows chains instead"
    correct: 1
    a: >-
      The threshold is capacity × load factor = 12. Adding the 13th entry doubles the table to 32
      buckets (and the threshold to 24).
  - q: When the table doubles from 16 to 32, where can an entry from bucket 5 go?
    options:
      - "Bucket 5 or bucket 21"
      - "Any bucket"
      - "Always bucket 10"
      - "Always bucket 5"
    correct: 1
    a: >-
      With a power-of-two size, one more bit of the hash is used. If that bit is 0 the entry
      stays at 5; if it's 1 it moves to 5 + 16 = 21. No full rehash of the key is needed.
  - q: "`\"Aa\"` and `\"BB\"` have the same `hashCode`. What happens when both go into one `HashMap`?"
    options:
      - "Both are stored in the same bucket, and `equals` tells them apart"
      - "The second replaces the first"
      - "`put` throws an exception"
      - "The map resizes until they separate"
    correct: 1
    a: >-
      Equal hash codes only mean the same bucket. Keys are replaced only when `equals` says they
      are equal. Collisions cost a little speed, never correctness.
  - q: When does a bucket turn into a tree?
    options:
      - "When it has at least 8 entries and the table has at least 64 buckets"
      - "As soon as two keys collide"
      - "When the map has more than 1,000 entries"
      - "Never; buckets are always linked lists"
    correct: 1
    a: >-
      `TREEIFY_THRESHOLD` is 8 and `MIN_TREEIFY_CAPACITY` is 64. A smaller table resizes instead,
      which usually spreads the keys out. A tree turns back into a list when it shrinks to 6.
---

## The idea

A `HashMap` is an **array of buckets**. To store a key it computes a number from the key's
`hashCode`, uses that number to pick a bucket, and puts the entry there. Looking a key up
repeats the same calculation, goes straight to that bucket and checks only the few entries in
it. That's why `get` and `put` take constant time on average, however big the map is.

The rest of the design deals with the two things that can go wrong: **collisions** (several
keys in one bucket) and **fullness** (too many entries for the number of buckets).

## How it works

### From key to bucket

```java
int h = key.hashCode();
int hash = h ^ (h >>> 16);              // spread: mix the high bits into the low bits
int index = hash & (table.length - 1);  // table.length is a power of two, so this is hash % length
```

With 16 buckets only the lowest 4 bits of the hash choose the bucket, so the high bits would be
ignored without the spreading step. That matters for keys whose hash codes differ only in their
high bits.

### Collisions and growth

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 300" role="img" aria-labelledby="rz-title rz-desc"><title id="rz-title">A HashMap resizing from 16 to 32 buckets</title><desc id="rz-desc">In a 16-bucket table, apple is in bucket 1, and pear and kiwi collide in bucket 2, chained one after the other; fig is in bucket 5. After the 13th entry the table doubles to 32 buckets. Each entry either stays at the same index or moves up by 16: apple moves to 17, pear moves to 18, kiwi stays at 2 and fig stays at 5, so the collision between pear and kiwi disappears.</desc><defs><marker id="rz-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="rz-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="22">16 BUCKETS · resizes after 12 entries</text><rect class="d-box" x="20" y="34" width="56" height="36" rx="5"/><text class="d-sub" x="48" y="57" text-anchor="middle">0</text><rect class="d-box" x="80" y="34" width="56" height="36" rx="5"/><text class="d-sub" x="108" y="57" text-anchor="middle">1</text><rect class="d-box warn" x="140" y="34" width="56" height="36" rx="5"/><text class="d-sub" x="168" y="57" text-anchor="middle">2</text><rect class="d-box" x="200" y="34" width="56" height="36" rx="5"/><text class="d-sub" x="228" y="57" text-anchor="middle">…</text><rect class="d-box" x="260" y="34" width="56" height="36" rx="5"/><text class="d-sub" x="288" y="57" text-anchor="middle">5</text><text class="d-sub" x="345" y="57">… 15</text><rect class="d-box" x="70" y="90" width="76" height="30" rx="6"/><text class="d-sub" x="108" y="110" text-anchor="middle">apple</text><rect class="d-box warn" x="130" y="90" width="76" height="30" rx="6" transform="translate(28 0)"/><text class="d-sub" x="196" y="110" text-anchor="middle">pear</text><rect class="d-box warn" x="158" y="132" width="76" height="30" rx="6"/><text class="d-sub" x="196" y="152" text-anchor="middle">kiwi</text><rect class="d-box" x="250" y="90" width="76" height="30" rx="6"/><text class="d-sub" x="288" y="110" text-anchor="middle">fig</text><line class="d-line" x1="108" y1="70" x2="108" y2="88" marker-end="url(#rz-ah)"/><line class="d-line" x1="168" y1="70" x2="190" y2="88" marker-end="url(#rz-ah)"/><line class="d-line" x1="196" y1="120" x2="196" y2="130" marker-end="url(#rz-ah)"/><line class="d-line" x1="288" y1="70" x2="288" y2="88" marker-end="url(#rz-ah)"/><text class="d-label warn" x="250" y="152">collision: one chain</text><line class="d-line hi" x1="380" y1="110" x2="440" y2="110" marker-end="url(#rz-ah-hi)"/><text class="d-label hi" x="410" y="98" text-anchor="middle">13th put</text><text class="d-label" x="460" y="22">32 BUCKETS · stay at i, or move to i + 16</text><rect class="d-box" x="460" y="34" width="134" height="30" rx="6"/><text class="d-sub" x="527" y="54" text-anchor="middle">2 · kiwi (stays)</text><rect class="d-box" x="604" y="34" width="134" height="30" rx="6"/><text class="d-sub" x="671" y="54" text-anchor="middle">5 · fig (stays)</text><rect class="d-box hi" x="460" y="80" width="134" height="30" rx="6"/><text class="d-sub" x="527" y="100" text-anchor="middle">17 · apple (1+16)</text><rect class="d-box hi" x="604" y="80" width="134" height="30" rx="6"/><text class="d-sub" x="671" y="100" text-anchor="middle">18 · pear (2+16)</text><text class="d-label" x="460" y="140">pear and kiwi no longer share a bucket</text><text class="d-label" x="20" y="210">A chain of 8 or more in a table of 64+ buckets becomes a red-black tree:</text><text class="d-label" x="20" y="230">lookups in that bucket go from O(n) to O(log n).</text><text class="d-label" x="20" y="262">Bucket numbers are the real ones for these keys on Java 21 (see the program below).</text></svg>
<figcaption>Growing doubles the table and splits each bucket in two. Entries move by exactly the old size, or not at all.</figcaption>
</figure>

| Setting | Default | Meaning |
| --- | --- | --- |
| Initial capacity | 16 buckets, allocated on the first `put` | Always a power of two |
| Load factor | 0.75 | Grow when entries > capacity × 0.75 |
| Resize | Doubles the table | Each entry stays at `i` or moves to `i + old capacity` |
| Treeify threshold | 8 entries in one bucket | Becomes a red-black tree (if the table has 64+ buckets) |
| Untreeify threshold | 6 | A shrunken tree goes back to a list |

### What `get` costs

| Situation | Cost |
| --- | --- |
| Good `hashCode`, normal load | O(1) on average |
| Many keys in one bucket, keys `Comparable` | O(log n) for that bucket (tree) |
| Many keys in one bucket, keys not comparable | Close to O(n) for that bucket |
| A `put` that triggers a resize | O(n) once, O(1) amortised |

## In code: watching the internals

```java
import java.util.*;

public class HashMapInside {
    // The same steps HashMap uses (Java 8+): spread the hash, then mask it to the table size
    static int spread(Object key) {
        int h = key.hashCode();
        return h ^ (h >>> 16);              // mix the high bits into the low bits
    }

    static int bucket(Object key, int tableSize) {
        return spread(key) & (tableSize - 1);   // tableSize is a power of two
    }

    public static void main(String[] args) {
        // 1. Where keys land in a 16-bucket table
        for (String key : List.of("apple", "pear", "fig", "kiwi")) {
            System.out.printf("%-6s hashCode %11d -> bucket %2d of 16, %2d of 32%n",
                    key, key.hashCode(), bucket(key, 16), bucket(key, 32));
        }

        // 2. A real collision: different strings, same hashCode
        System.out.println("\"Aa\".hashCode() = " + "Aa".hashCode() + ", \"BB\".hashCode() = " + "BB".hashCode());
        Map<String, Integer> colliding = new HashMap<>();
        colliding.put("Aa", 1);
        colliding.put("BB", 2);                 // same bucket; equals tells them apart
        System.out.println("both stored: " + colliding.size() + ", get(\"BB\") = " + colliding.get("BB"));

        // 3. Resizing moves entries, so iteration order can change
        Map<Integer, String> map = new HashMap<>();   // 16 buckets, resizes after 12 entries
        map.put(16, "sixteen");                 // 16 & 15 = bucket 0
        map.put(1, "one");                      // bucket 1
        System.out.println("before resize: " + map.keySet());
        for (int k = 100; k < 111; k++) map.put(k, "x");   // 13 entries: over 16 * 0.75
        List<Integer> order = new ArrayList<>(map.keySet());
        order.retainAll(List.of(1, 16));
        System.out.println("after resize:  " + order + "   (16 moved to bucket 16 of 32)");

        // 4. One null key is allowed, and lives in bucket 0
        map.put(null, "nothing");
        System.out.println("null key: " + map.get(null));

        // 5. Pre-size when you know the count (Java 19+): room for 100 entries, no resizing
        Map<String, Integer> sized = HashMap.newHashMap(100);
        System.out.println("newHashMap(100) empty: " + sized.isEmpty());
    }
}
```
{: .runnable}

```text
apple  hashCode    93029210 -> bucket  1 of 16, 17 of 32
pear   hashCode     3436774 -> bucket  2 of 16, 18 of 32
fig    hashCode      101380 -> bucket  5 of 16,  5 of 32
kiwi   hashCode     3292336 -> bucket  2 of 16,  2 of 32
"Aa".hashCode() = 2112, "BB".hashCode() = 2112
both stored: 2, get("BB") = 2
before resize: [16, 1]
after resize:  [1, 16]   (16 moved to bucket 16 of 32)
null key: nothing
newHashMap(100) empty: true
```
{: .run-output}

- `pear` and `kiwi` collide in a 16-bucket table and separate at 32.
- `"Aa"` and `"BB"` have identical hash codes; both are kept, because `equals` tells them apart.
- Key `16` sits in bucket 0 and comes first, until the 13th entry doubles the table and moves it
  to bucket 16, after key `1`. Iteration order changed without anyone touching those keys.

## Pitfalls

- **A poor `hashCode`.** Returning a constant, or using only a field with few values, piles keys
  into a few buckets. Use `Objects.hash` over the same fields as `equals`, or a record.
- **Mutable keys.** If a key's hash changes after it's stored, the map looks in the wrong bucket
  (see the Core Java chapter on `equals` and `hashCode`).
- **`new HashMap<>(n)` to "hold n entries".** It still resizes before `n`; use
  `HashMap.newHashMap(n)`.
- **Relying on iteration order.** It changes on resize and between versions.
- **Sharing a `HashMap` between threads.** Concurrent writes can lose entries or corrupt the
  table during a resize; use `ConcurrentHashMap`.

## When to use what

| Need | Use |
| --- | --- |
| General key-value lookups | `HashMap` |
| A map you'll fill with a known number of entries | `HashMap.newHashMap(n)` |
| Iteration in insertion or access order | `LinkedHashMap` |
| Sorted keys, range queries | `TreeMap` |
| `enum` keys | `EnumMap` (an array inside, no hashing) |
| Shared between threads | `ConcurrentHashMap` |
| Keys compared by identity (`==`), rare | `IdentityHashMap` |

## Further reading

- [`HashMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html)
- [`HashMap.newHashMap` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html#newHashMap(int))
- [JEP 180: Handle frequent HashMap collisions with balanced trees](https://openjdk.org/jeps/180)
