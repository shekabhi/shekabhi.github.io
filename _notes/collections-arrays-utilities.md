---
title: "The Collections and Arrays utilities, and common pitfalls"
short_title: "Collections and Arrays utilities"
topic: Java collections
date: 2026-11-16
tags: [java, collections, arrays, utilities, pitfalls]
summary: The ready-made algorithms in Collections and Arrays, from sorting and binary search to copying, filling and comparing arrays, and a checklist of the collection pitfalls from the whole series.
catalog: collections-utilities
series: java-collections
priority: high
questions:
  - q: What does `Collections.binarySearch` return when the element isn't found?
    a: >-
      A negative number that encodes where the element would go: `-(insertionPoint) - 1`. For
      `[1, 3, 5, 7, 9]`, searching for 4 returns -3, because 4 belongs at index 2. The `- 1`
      makes sure "not found, insert at 0" (-1) can't be confused with "found at 0". The list
      must already be sorted, or the result is meaningless.
  - q: Why does `array1.equals(array2)` return `false` for two arrays with the same contents?
    a: >-
      Arrays don't override `equals`, so it's the identity check from `Object`, the same as `==`.
      Use `Arrays.equals(a, b)` to compare contents, `Arrays.deepEquals` for nested arrays,
      and `Arrays.hashCode` / `Arrays.toString` for the matching hash and readable output.
  - q: Why does `Arrays.asList(new int[] {1, 2, 3})` have size 1?
    a: >-
      `asList` takes a varargs of objects (`T...`). An `int[]` isn't an array of objects, so the
      whole array becomes the single element, giving a `List<int[]>`. With an `Integer[]` you get
      three elements. For primitives use `Arrays.stream(ints).boxed().toList()`.
  - q: What do `Arrays.copyOf` and `Arrays.copyOfRange` do?
    a: >-
      `copyOf(array, newLength)` returns a new array of the given length, copying the elements
      and padding with zeros, `false` or `null` if it's longer, or truncating if it's shorter.
      `copyOfRange(array, from, to)` copies the range from `from` (inclusive) to `to`
      (exclusive). Both create new arrays; the original is unchanged.
  - q: Which `Collections` helpers are worth knowing?
    a: >-
      `sort`, `reverse`, `shuffle` (pass a seeded `Random` for repeatable results), `rotate`,
      `swap`, `max`/`min` (with an optional comparator), `frequency`, `disjoint`, `nCopies`,
      `binarySearch`, plus `emptyList()`/`singletonList()` and the `unmodifiable...` and
      `synchronized...` wrappers. Many have newer alternatives: `list.sort(...)`, `List.of()`,
      streams.
  - q: Name some collection pitfalls that come up again and again.
    a: >-
      Comparing wrappers with `==`; `list.remove(1)` on a `List<Integer>` removing by index;
      `HashMap` keys that change after being stored; `equals` without `hashCode`; removing
      inside a for-each loop; relying on `HashMap`, `HashSet`, `Set.of` or `Map.of` order;
      `Arrays.asList` and `subList` being views; `List.of` rejecting `null`; using `LinkedList`
      for speed; and sharing non-thread-safe collections between threads.
  - q: "`Collections.binarySearch` on `[1, 3, 5, 7, 9]` for 4 returns what?"
    options:
      - "-3"
      - "-1"
      - "2"
      - "It throws an exception"
    correct: 1
    a: >-
      4 would be inserted at index 2, so the result is -(2) - 1 = -3. A negative result always
      means "not found".
  - q: "`int[] a = {1, 2, 3}, b = {1, 2, 3};` Which expression is `true`?"
    options:
      - "`Arrays.equals(a, b)`"
      - "`a == b`"
      - "`a.equals(b)`"
      - "None of them"
    correct: 1
    a: >-
      `==` and `equals` both compare references for arrays; only `Arrays.equals` compares the
      elements.
  - q: "What is `Arrays.asList(new int[] {1, 2, 3}).size()`?"
    options:
      - "1"
      - "3"
      - "0"
      - "It doesn't compile"
    correct: 1
    a: >-
      The `int[]` is treated as one object, so the list holds one element: the array. Use an
      `Integer[]` or `Arrays.stream(...).boxed()`.
  - q: How do you make `Collections.shuffle` give the same order on every run, for a test?
    options:
      - "Pass a `Random` created with a fixed seed"
      - "Sort the list first"
      - "Call it twice"
      - "You can't; shuffle is always random"
    correct: 1
    a: >-
      `Collections.shuffle(list, new Random(42))` uses a seeded generator, so the sequence of
      random numbers, and therefore the order, is the same every time.
---

## The idea

Before writing a loop to sort, search, fill, copy or compare, check `java.util.Collections` (for
collections) and `java.util.Arrays` (for arrays). Both are full of well-tested static methods.
This last chapter of the series is a tour of the useful ones, plus a checklist of the pitfalls
from every chapter so far.

## How it works

### `Collections`

| Method | Does | Note |
| --- | --- | --- |
| `sort(list)` / `sort(list, cmp)` | Sorts in place | Stable; same as `list.sort(...)` |
| `binarySearch(list, key)` | Index, or `-(insertion point) - 1` | List must be sorted |
| `reverse`, `rotate`, `swap` | Reorders in place | |
| `shuffle(list, random)` | Random order | Seed the `Random` for repeatable tests |
| `max`, `min` | Largest / smallest | Optional comparator |
| `frequency(c, x)` | How many equal `x` | |
| `disjoint(a, b)` | `true` if no element in common | |
| `nCopies(n, x)` | An immutable list of n copies | |
| `emptyList()`, `singletonList(x)` | Tiny immutable lists | `List.of()` is the modern spelling |
| `unmodifiableList(...)` | A read-only view | See the previous chapter |
| `synchronizedList(...)` | Every call locked | Iteration still needs `synchronized`; prefer concurrent collections |

### `Arrays`

| Method | Does |
| --- | --- |
| `sort(array)` | Sorts in place (primitives with a fast dual-pivot quicksort, objects with a stable merge sort) |
| `binarySearch(array, key)` | Same contract as `Collections.binarySearch` |
| `fill(array, value)` | Sets every element |
| `copyOf(array, length)` / `copyOfRange(array, from, to)` | New arrays, padded or truncated |
| `equals(a, b)` / `deepEquals(a, b)` | Compare contents (nested arrays: `deepEquals`) |
| `toString(a)` / `deepToString(a)` | Readable output |
| `hashCode(a)` | A hash that matches `Arrays.equals` |
| `stream(a)` | A stream (`IntStream` for `int[]`) |
| `asList(a)` | A fixed-size list view (objects only) |

### Reading `binarySearch`

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 200" role="img" aria-labelledby="bs-title bs-desc"><title id="bs-title">What binarySearch returns</title><desc id="bs-desc">The sorted list 1, 3, 5, 7, 9 at indexes 0 to 4. Searching for 7 finds it at index 3 and returns 3. Searching for 4 doesn't find it; 4 would be inserted at index 2, between 3 and 5, so the method returns minus 2 minus 1, which is minus 3.</desc><defs><marker id="bs-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="bs-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="160" y="60" width="70" height="44" rx="5"/><text class="d-text" x="195" y="87" text-anchor="middle">1</text><rect class="d-box" x="230" y="60" width="70" height="44" rx="5"/><text class="d-text" x="265" y="87" text-anchor="middle">3</text><rect class="d-box" x="300" y="60" width="70" height="44" rx="5"/><text class="d-text" x="335" y="87" text-anchor="middle">5</text><rect class="d-box hi" x="370" y="60" width="70" height="44" rx="5"/><text class="d-text" x="405" y="87" text-anchor="middle">7</text><rect class="d-box" x="440" y="60" width="70" height="44" rx="5"/><text class="d-text" x="475" y="87" text-anchor="middle">9</text><text class="d-label" x="195" y="124" text-anchor="middle">0</text><text class="d-label" x="265" y="124" text-anchor="middle">1</text><text class="d-label" x="335" y="124" text-anchor="middle">2</text><text class="d-label" x="405" y="124" text-anchor="middle">3</text><text class="d-label" x="475" y="124" text-anchor="middle">4</text><line class="d-line hi" x1="405" y1="30" x2="405" y2="58" marker-end="url(#bs-ah-hi)"/><text class="d-label hi" x="415" y="26">search 7: found at 3, returns 3</text><line class="d-line warn" x1="300" y1="160" x2="300" y2="108" marker-end="url(#bs-ah)" style="stroke-dasharray:4 3"/><text class="d-label warn" x="310" y="166">search 4: would go at index 2</text><text class="d-label warn" x="310" y="186">returns -(2) - 1 = -3</text></svg>
<figcaption>A negative result means "not found" and still tells you where the key belongs: insertion point = -(result) - 1.</figcaption>
</figure>

## In code: the utilities in one program

```java
import java.util.*;

public class Utilities {
    public static void main(String[] args) {
        // Collections: algorithms on lists
        List<Integer> nums = new ArrayList<>(List.of(5, 3, 9, 1, 7));
        Collections.sort(nums);
        System.out.println("sort:                " + nums);
        System.out.println("binarySearch(7):     " + Collections.binarySearch(nums, 7));
        System.out.println("binarySearch(4):     " + Collections.binarySearch(nums, 4) + "  (-(insertion point) - 1)");
        Collections.reverse(nums);
        System.out.println("reverse:             " + nums);
        Collections.rotate(nums, 2);
        System.out.println("rotate by 2:         " + nums);
        Collections.shuffle(nums, new Random(42));            // seeded: same order every run
        System.out.println("shuffle(seed 42):    " + nums);
        System.out.println("max / min:           " + Collections.max(nums) + " / " + Collections.min(nums));
        System.out.println("frequency of 'a':    " + Collections.frequency(List.of("a", "b", "a"), "a"));
        System.out.println("nCopies:             " + Collections.nCopies(3, "-"));
        System.out.println("disjoint:            " + Collections.disjoint(List.of(1, 2), List.of(3, 4)));

        // Arrays: the same for arrays, plus a few traps
        int[] scores = {40, 10, 30, 20};
        Arrays.sort(scores);
        System.out.println("Arrays.sort:         " + Arrays.toString(scores));
        int[] copy = Arrays.copyOf(scores, 6);                 // pads with zeros
        System.out.println("copyOf(..., 6):      " + Arrays.toString(copy));
        System.out.println("copyOfRange(1, 3):   " + Arrays.toString(Arrays.copyOfRange(scores, 1, 3)));
        int[] filled = new int[4];
        Arrays.fill(filled, 7);
        System.out.println("fill:                " + Arrays.toString(filled));

        int[] a = {1, 2, 3}, b = {1, 2, 3};
        System.out.println("a == b:              " + (a == b));
        System.out.println("a.equals(b):         " + a.equals(b) + "  (arrays don't override equals)");
        System.out.println("Arrays.equals:       " + Arrays.equals(a, b));
        int[][] grid = { {1, 2}, {3, 4} };
        System.out.println("toString(grid):      " + Arrays.toString(grid).replaceAll("@[0-9a-f]+", "@..."));
        System.out.println("deepToString(grid):  " + Arrays.deepToString(grid));

        // Arrays.asList on an int[] gives a list with ONE element: the array itself
        List<int[]> oops = Arrays.asList(a);
        System.out.println("asList(int[]) size:  " + oops.size());
        List<Integer> boxed = Arrays.stream(a).boxed().toList();
        System.out.println("stream().boxed():    " + boxed);
        System.out.println("asList(Integer[]):   " + Arrays.asList(new Integer[] {1, 2, 3}).size());
    }
}
```
{: .runnable}

```text
sort:                [1, 3, 5, 7, 9]
binarySearch(7):     3
binarySearch(4):     -3  (-(insertion point) - 1)
reverse:             [9, 7, 5, 3, 1]
rotate by 2:         [3, 1, 9, 7, 5]
shuffle(seed 42):    [1, 9, 7, 5, 3]
max / min:           9 / 1
frequency of 'a':    2
nCopies:             [-, -, -]
disjoint:            true
Arrays.sort:         [10, 20, 30, 40]
copyOf(..., 6):      [10, 20, 30, 40, 0, 0]
copyOfRange(1, 3):   [20, 30]
fill:                [7, 7, 7, 7]
a == b:              false
a.equals(b):         false  (arrays don't override equals)
Arrays.equals:       true
toString(grid):      [[I@..., [I@...]
deepToString(grid):  [[1, 2], [3, 4]]
asList(int[]) size:  1
stream().boxed():    [1, 2, 3]
asList(Integer[]):   3
```
{: .run-output}

- The shuffle used `new Random(42)`, so this output is the same on every run.
- `a.equals(b)` was `false`: arrays compare by identity unless you use `Arrays.equals`.
- `Arrays.toString` on a 2-D array prints the inner arrays' identities; `deepToString` prints
  their contents.
- `Arrays.asList(int[])` produced a list of one element.

## The series checklist: collection pitfalls

| Pitfall | Chapter | Instead |
| --- | --- | --- |
| Iterating a `HashMap` or `HashSet` and relying on the order | 1, 3 | `LinkedHashMap` / `TreeMap` |
| `LinkedList` "for fast inserts" | 2 | `ArrayList`, or `ArrayDeque` for both ends |
| Removing by index in a forward loop | 2 | `removeIf` |
| `Arrays.asList` / `subList` treated as independent lists | 2, 9 | `new ArrayList<>(...)` |
| `new HashMap<>(n)` to hold n entries | 3 | `HashMap.newHashMap(n)` |
| Keys or set elements that change after being added | 3, 5 | Immutable keys |
| An "LRU" `LinkedHashMap` without access order | 4 | `new LinkedHashMap<>(16, 0.75f, true)` |
| A `TreeSet` comparator that disagrees with `equals` | 4, 5 | A consistent comparator |
| Printing a `PriorityQueue` and expecting sorted order | 6 | `poll()` in a loop |
| Removing inside a for-each loop | 7 | `removeIf` or `Iterator.remove` |
| An unmodifiable view treated as a snapshot | 8 | `List.copyOf` |
| `List.of` with `null`, or `Set.of` order | 8 | `ArrayList`, or an ordered collection |
| `array.equals(other)` | 9 | `Arrays.equals` |
| Sharing a standard collection between threads | all | A concurrent collection (concurrency series) |

## When to use what

| Need | Use |
| --- | --- |
| Sort a list | `list.sort(comparator)` or `Collections.sort` |
| Find in a sorted list or array | `binarySearch` |
| Compare, print or hash arrays | `Arrays.equals`, `Arrays.toString`, `Arrays.hashCode` |
| Resize or slice an array | `Arrays.copyOf` / `copyOfRange` |
| A list from primitive values | `Arrays.stream(ints).boxed().toList()` |
| Repeatable random order in tests | `Collections.shuffle(list, new Random(seed))` |
| Count matches or check overlap | `Collections.frequency`, `Collections.disjoint` |

## Further reading

- [`Collections` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collections.html)
- [`Arrays` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html)
