---
title: "Sets: HashSet, LinkedHashSet, TreeSet, EnumSet"
short_title: "Java sets: Hash, Linked, Tree, Enum"
topic: Java collections
date: 2026-11-16
tags: [java, collections, set, hashset, treeset, enumset]
summary: How each Set implementation stores elements and decides what counts as a duplicate, set algebra in one line each, TreeSet navigation, and why EnumSet is so fast.
catalog: sets
series: java-collections
priority: high
questions:
  - q: How is `HashSet` implemented?
    a: >-
      As a `HashMap` in disguise: each element is stored as a key, with one shared dummy object as
      the value. So it inherits everything from the `HashMap` chapter: `add`, `remove` and
      `contains` are O(1) on average, duplicates are decided by `hashCode` and `equals`, one
      `null` is allowed, and the iteration order is not something to rely on.
  - q: What is the difference between `HashSet`, `LinkedHashSet` and `TreeSet`?
    a: >-
      `HashSet` is the fastest and has no meaningful order. `LinkedHashSet` adds a linked list
      through its elements to keep insertion order, at a small memory cost. `TreeSet` keeps
      elements sorted in a red-black tree, with O(log n) operations and navigation methods such
      as `floor`, `ceiling`, `headSet` and `subSet`.
  - q: How does a `TreeSet` decide that two elements are duplicates?
    a: >-
      With `compareTo` (or the comparator it was given), not with `equals`. If the comparison
      returns 0, the second element isn't added. With `String.CASE_INSENSITIVE_ORDER`, `"Java"`
      and `"JAVA"` count as the same element. Keep the comparator consistent with `equals`
      unless that merging is what you want.
  - q: What is `EnumSet`, and why use it?
    a: >-
      A `Set` for the constants of one `enum`, stored as a bit vector: one bit per constant, in a
      single `long` for up to 64 constants. Every operation is a few bit operations, iteration
      follows declaration order, and it uses almost no memory. It has handy factories:
      `EnumSet.of(...)`, `range(from, to)`, `allOf`, `noneOf` and `complementOf`.
  - q: How do you compute a union, intersection or difference of two sets?
    a: >-
      Copy one set, then call `addAll` (union), `retainAll` (intersection) or `removeAll`
      (difference) with the other. These methods change the set they're called on, so copy
      first if you need to keep the original. Each returns `true` if the set changed.
  - q: Why does `set.add(x)` return a boolean?
    a: >-
      It returns `false` when `x` was already present, so `if (!seen.add(id))` detects
      duplicates without a separate `contains` call (and without looking the element up twice).
  - q: "A `TreeSet` built with `String.CASE_INSENSITIVE_ORDER` gets `\"Java\"`, `\"JAVA\"`, `\"java\"` and `\"Kotlin\"`. What does it contain?"
    options:
      - "`[Java, Kotlin]`"
      - "`[JAVA, Java, Kotlin, java]`"
      - "`[java, Kotlin]`"
      - "It throws an exception"
    correct: 1
    a: >-
      The comparator says the three spellings are equal, so only the first one added is kept.
      `TreeSet` uses the comparator, never `equals`, to find duplicates.
  - q: "`TreeSet` holds 900, 1030, 1200, 1400 and 1630. What is `ceiling(1100)`?"
    options:
      - "1200"
      - "1030"
      - "1100"
      - "`null`"
    correct: 1
    a: >-
      `ceiling` returns the least element greater than or equal to the argument; `floor(1100)`
      would return 1030.
  - q: "What happens with `Set.of(\"x\", \"x\")`?"
    options:
      - "It throws `IllegalArgumentException`"
      - "It returns a set with one element"
      - "It returns a set with two elements"
      - "It doesn't compile"
    correct: 1
    a: >-
      The `Set.of` factories reject duplicate elements (and `null`) so that a typo in a list of
      constants is caught immediately. To remove duplicates from data, use `new HashSet<>(list)`
      or `Set.copyOf(list)`.
  - q: You add an `ArrayList` to a `HashSet`, then add an element to that list. What does `set.contains(list)` return?
    options:
      - "`false`: its hash code changed, so the set looks in the wrong bucket"
      - "`true`"
      - "It throws `ConcurrentModificationException`"
      - "It depends on the list's size"
    correct: 1
    a: >-
      A list's `hashCode` depends on its contents. The element is stored under the old hash, so
      it can't be found, yet it still counts towards `size()`. Elements of hash-based sets must
      not change while they're in the set.
---

## The idea

A `Set` is a collection with **no duplicates**. All the interesting differences between the
implementations come down to two questions: **how does it decide that two elements are the
same**, and **in what order does it give them back?**

## How it works

### Four sets, four strategies

| Implementation | Stored as | Duplicate means | Order | `add` / `contains` | `null` |
| --- | --- | --- | --- | --- | --- |
| `HashSet` | Keys of a `HashMap` | `hashCode` + `equals` | None you can rely on | O(1) average | One |
| `LinkedHashSet` | Keys of a `LinkedHashMap` | `hashCode` + `equals` | Insertion | O(1) average | One |
| `TreeSet` | Keys of a `TreeMap` (red-black tree) | `compareTo` or the comparator returns 0 | Sorted | O(log n) | No |
| `EnumSet` | A bit vector | Same constant | Declaration order | O(1), a few bit operations | No |

`HashSet` really is built on `HashMap`: every element is a key and one shared object is the
value. Everything from the `HashMap` internals chapter applies to it.

### Set algebra

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 230" role="img" aria-labelledby="sa-title sa-desc"><title id="sa-title">Union, intersection and difference</title><desc id="sa-desc">Two sets: java with Arjun, Diya and Kabir, and redis with Diya, Kabir and Meera. Their union is Arjun, Diya, Kabir and Meera, made with addAll. Their intersection is Diya and Kabir, made with retainAll. The difference java minus redis is Arjun, made with removeAll.</desc><ellipse class="d-box" cx="240" cy="96" rx="150" ry="78" style="fill-opacity:.6"/><ellipse class="d-box hi" cx="400" cy="96" rx="150" ry="78" style="fill-opacity:.35"/><text class="d-label" x="40" y="58">java</text><text class="d-label hi" x="536" y="40">redis</text><text class="d-text" x="170" y="101" text-anchor="middle">Arjun</text><text class="d-text" x="320" y="88" text-anchor="middle">Diya</text><text class="d-text" x="320" y="114" text-anchor="middle">Kabir</text><text class="d-text" x="470" y="101" text-anchor="middle">Meera</text><text class="d-label" x="590" y="70">union · addAll</text><text class="d-sub" x="590" y="88">Arjun, Diya, Kabir, Meera</text><text class="d-label hi" x="590" y="118">intersection · retainAll</text><text class="d-sub" x="590" y="136">Diya, Kabir</text><text class="d-label" x="590" y="166">difference · removeAll</text><text class="d-sub" x="590" y="184">Arjun</text><text class="d-label" x="20" y="218">Each method changes the set it's called on, so copy the set first, then call it on the copy.</text></svg>
<figcaption>Three set operations, each one call, each changing the set you call it on.</figcaption>
</figure>

| Operation | Code | Result for the sets above |
| --- | --- | --- |
| Union | `union = new TreeSet<>(java); union.addAll(redis);` | Arjun, Diya, Kabir, Meera |
| Intersection | `both = new TreeSet<>(java); both.retainAll(redis);` | Diya, Kabir |
| Difference | `only = new TreeSet<>(java); only.removeAll(redis);` | Arjun |
| Subset test | `java.containsAll(other)` | `true` if every element of `other` is in `java` |

### TreeSet navigation

`TreeSet` is a `NavigableSet`, with the same kind of lookups as `TreeMap`: `first`, `last`,
`floor`, `ceiling`, `lower`, `higher`, `headSet`, `tailSet`, `subSet`, `descendingSet`,
`pollFirst` and `pollLast`.

## In code: sets in action

```java
import java.util.*;

public class Sets {
    enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

    public static void main(String[] args) {
        // add returns false for a duplicate: a cheap "seen before?" check
        Set<String> seen = new HashSet<>();
        for (String id : List.of("a7", "b2", "a7")) {
            if (!seen.add(id)) System.out.println("duplicate:        " + id);
        }

        // Union, intersection and difference (each changes the set it's called on)
        Set<String> java = new TreeSet<>(Set.of("Diya", "Arjun", "Kabir"));
        Set<String> redis = new TreeSet<>(Set.of("Kabir", "Meera", "Diya"));
        Set<String> union = new TreeSet<>(java);        union.addAll(redis);
        Set<String> both = new TreeSet<>(java);         both.retainAll(redis);
        Set<String> onlyJava = new TreeSet<>(java);     onlyJava.removeAll(redis);
        System.out.println("union:            " + union);
        System.out.println("intersection:     " + both);
        System.out.println("difference:       " + onlyJava);

        // TreeSet navigation
        TreeSet<Integer> slots = new TreeSet<>(List.of(900, 1030, 1200, 1400, 1630));
        System.out.println("ceiling(1100):    " + slots.ceiling(1100));      // next free slot at or after 11:00
        System.out.println("floor(1100):      " + slots.floor(1100));
        System.out.println("headSet(1200):    " + slots.headSet(1200));       // before 12:00
        System.out.println("subSet(1000,1500): " + slots.subSet(1000, 1500));
        System.out.println("descendingSet:    " + slots.descendingSet());

        // EnumSet: a bit vector, in declaration order
        EnumSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);
        System.out.println("range MON..FRI:   " + EnumSet.range(Day.MON, Day.FRI));
        System.out.println("complementOf:     " + EnumSet.complementOf(weekend));

        // Set.of rejects duplicates and nulls
        try {
            Set.of("x", "x");
        } catch (IllegalArgumentException e) {
            System.out.println("Set.of(x, x):     IllegalArgumentException");
        }
        try {
            Set.of("x", null);
        } catch (NullPointerException e) {
            System.out.println("Set.of(x, null):  NullPointerException");
        }

        // A TreeSet decides duplicates with compareTo, not equals
        Set<String> ignoreCase = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        ignoreCase.addAll(List.of("Java", "JAVA", "java", "Kotlin"));
        System.out.println("case-insensitive: " + ignoreCase);

        // Changing an element after adding it loses it
        Set<List<Integer>> sets = new HashSet<>();
        List<Integer> point = new ArrayList<>(List.of(1, 2));
        sets.add(point);
        point.add(3);                                           // its hashCode changes
        System.out.println("mutated contains: " + sets.contains(point) + ", size " + sets.size());
    }
}
```
{: .runnable}

```text
duplicate:        a7
union:            [Arjun, Diya, Kabir, Meera]
intersection:     [Diya, Kabir]
difference:       [Arjun]
ceiling(1100):    1200
floor(1100):      1030
headSet(1200):    [900, 1030]
subSet(1000,1500): [1030, 1200, 1400]
descendingSet:    [1630, 1400, 1200, 1030, 900]
range MON..FRI:   [MON, TUE, WED, THU, FRI]
complementOf:     [MON, TUE, WED, THU, FRI]
Set.of(x, x):     IllegalArgumentException
Set.of(x, null):  NullPointerException
case-insensitive: [Java, Kotlin]
mutated contains: false, size 1
```
{: .run-output}

- `seen.add` returning `false` found the duplicate without a separate `contains`.
- `ceiling(1100)` found the next slot at or after 11:00.
- `EnumSet.complementOf(weekend)` gave the weekdays, in declaration order.
- The case-insensitive `TreeSet` kept one spelling of "Java".
- The mutated list is lost inside the `HashSet`, but still counted in its size.

## Pitfalls

- **Mutating elements of a `HashSet`** (or the comparator fields of `TreeSet` elements). The set
  can no longer find them.
- **A `TreeSet` comparator that disagrees with `equals`.** Elements you consider different can be
  silently dropped.
- **`null` in a `TreeSet` or `EnumSet`.** It throws `NullPointerException`.
- **`Set.of` for data.** It throws on duplicates; use `new HashSet<>(list)` or `Set.copyOf`.
- **Relying on `HashSet` order.** Use `LinkedHashSet` or `TreeSet` when order matters.
- **`HashSet<MyEnum>`.** It works, but `EnumSet` is smaller, faster and ordered.

## When to use what

| Need | Use |
| --- | --- |
| Fast membership tests, remove duplicates | `HashSet` |
| Remove duplicates but keep the original order | `LinkedHashSet` |
| Sorted unique elements, nearest-value and range queries | `TreeSet` |
| A set of `enum` constants (flags, days, permissions) | `EnumSet` |
| A fixed set of constants | `Set.of(...)` |
| A set shared between threads | `ConcurrentHashMap.newKeySet()` or `ConcurrentSkipListSet` |

## Further reading

- [`HashSet` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashSet.html)
- [`TreeSet` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeSet.html)
- [`EnumSet` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/EnumSet.html)
