---
title: "ArrayList vs LinkedList, and ArrayDeque"
short_title: "ArrayList vs LinkedList vs ArrayDeque"
topic: Java collections
date: 2026-11-16
tags: [java, collections, arraylist, linkedlist, arraydeque]
summary: How ArrayList and LinkedList store elements, why ArrayList wins almost every time, why ArrayDeque is the right stack and queue, and the list traps that bite.
catalog: lists-deques
series: java-collections
priority: high
questions:
  - q: How does `ArrayList` store its elements?
    a: >-
      In a plain array (`Object[]`) plus a size. `get(i)` is a direct array access, O(1). Adding
      at the end is O(1) until the array is full; then it allocates a bigger array (about 1.5
      times the size) and copies everything across, so adding is O(1) *amortised*. Inserting
      or removing in the middle shifts all later elements, O(n).
  - q: How does `LinkedList` store its elements, and what does that cost?
    a: >-
      As a doubly linked list: each element sits in a node with `prev` and `next` pointers.
      Adding or removing at either end is O(1), but `get(i)` must walk the nodes, O(n). Every
      node is a separate object, so it uses several times more memory than an array, and the
      scattered nodes are slow for the CPU cache.
  - q: When is `LinkedList` actually better than `ArrayList`?
    a: >-
      Rarely. Its one real strength is removing or inserting through a `ListIterator` that is
      already at the right position. Even inserting at the front is usually better served by
      `ArrayDeque`. In practice `ArrayList` is faster for most workloads because arrays are
      compact and cache-friendly; measure before choosing `LinkedList`.
  - q: Why use `ArrayDeque` instead of `Stack` or `LinkedList` for a stack or queue?
    a: >-
      `ArrayDeque` is a resizable circular array with O(1) operations at both ends and no
      per-element node objects, so it's faster and smaller than `LinkedList`. `Stack` extends
      the legacy `Vector`, so every call is synchronized, and it exposes list methods that break
      the stack idea. Use `push`/`pop` for a stack and `offer`/`poll` for a queue. It doesn't
      accept `null`.
  - q: How do you remove elements from a list while looping over it?
    a: >-
      Use `list.removeIf(condition)`, or an explicit `Iterator` and its `remove()` method.
      Removing by index in a forward `for` loop skips the element that shifts into the removed
      slot, and calling `list.remove` inside a for-each loop throws
      `ConcurrentModificationException`.
  - q: What is special about `Arrays.asList` and `subList`?
    a: >-
      Both return *views*, not copies. `Arrays.asList(array)` is backed by the array: `set`
      writes through to it, and `add` or `remove` throw `UnsupportedOperationException` because
      the size is fixed. `list.subList(from, to)` is a window onto the original list: clearing
      it removes those elements from the original. Wrap in `new ArrayList<>(...)` when you need
      an independent list.
  - q: What is the cost of `get(i)` on a `LinkedList` of n elements?
    options:
      - "O(n): it walks the nodes from the nearer end"
      - "O(1)"
      - "O(log n)"
      - "O(n²)"
    correct: 1
    a: >-
      There is no index to jump to, so `LinkedList` follows links from the start or the end,
      whichever is closer. Looping with `get(i)` over a `LinkedList` is therefore O(n²).
  - q: "`List<Integer> list = new ArrayList<>(List.of(2, 4, 5, 6, 8));` A forward index loop removes every even number. What's left?"
    options:
      - "`[4, 5, 8]`"
      - "`[5]`"
      - "`[2, 4, 6, 8]`"
      - "It throws `ConcurrentModificationException`"
    correct: 1
    a: >-
      After removing index 0, the next element moves into index 0, but the loop moves on to
      index 1, so it's never checked. `removeIf(n -> n % 2 == 0)` gives the intended `[5]`.
  - q: What happens with `Arrays.asList("a", "b").add("c")`?
    options:
      - "It throws `UnsupportedOperationException`"
      - "It returns `true` and the list has three elements"
      - "It doesn't compile"
      - "It throws `ArrayIndexOutOfBoundsException`"
    correct: 1
    a: >-
      The list is a fixed-size view of an array, so changing its size isn't supported. `set`
      works, and writes through to the array.
  - q: Which class is the recommended general-purpose stack in modern Java?
    options:
      - "`ArrayDeque`"
      - "`Stack`"
      - "`LinkedList`"
      - "`Vector`"
    correct: 1
    a: >-
      The `Deque` interface provides `push`, `pop` and `peek`, and `ArrayDeque` implements them
      in O(1) without synchronisation. `Stack`'s own documentation recommends a `Deque` instead.
---

## The idea

`ArrayList` and `LinkedList` both implement `List`, so they look interchangeable. Underneath they
are opposites: one is a **single array**, the other a **chain of separate node objects**. That
difference decides their speed, their memory use, and which operations are cheap.

The short version: use **`ArrayList`** for lists, **`ArrayDeque`** for stacks and queues, and
reach for `LinkedList` almost never.

## How it works

### Inside each one

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 270" role="img" aria-labelledby="al-title al-desc"><title id="al-title">ArrayList compared with LinkedList</title><desc id="al-desc">An ArrayList keeps its elements side by side in one array with spare capacity at the end, so get by index jumps straight to a slot. A LinkedList keeps each element in a separate node object with previous and next pointers, so get by index must walk the chain from one end.</desc><defs><marker id="al-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="al-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="22">ArrayList · ONE ARRAY, SPARE CAPACITY AT THE END</text><rect class="d-box hi" x="20" y="34" width="70" height="44" rx="4"/><text class="d-text" x="55" y="61" text-anchor="middle">A</text><rect class="d-box hi" x="90" y="34" width="70" height="44" rx="4"/><text class="d-text" x="125" y="61" text-anchor="middle">B</text><rect class="d-box hi" x="160" y="34" width="70" height="44" rx="4"/><text class="d-text" x="195" y="61" text-anchor="middle">C</text><rect class="d-box hi" x="230" y="34" width="70" height="44" rx="4"/><text class="d-text" x="265" y="61" text-anchor="middle">D</text><rect class="d-box" x="300" y="34" width="70" height="44" rx="4" style="stroke-dasharray:4 4"/><rect class="d-box" x="370" y="34" width="70" height="44" rx="4" style="stroke-dasharray:4 4"/><text class="d-label" x="20" y="96">0</text><text class="d-label" x="90" y="96">1</text><text class="d-label" x="160" y="96">2</text><text class="d-label" x="230" y="96">3</text><text class="d-label hi" x="470" y="52">get(2): one step, straight to slot 2</text><text class="d-label" x="470" y="70">full? copy into an array ~1.5× bigger</text><text class="d-label" x="20" y="146">LinkedList · ONE NODE OBJECT PER ELEMENT</text><rect class="d-box" x="20" y="160" width="120" height="50" rx="8"/><text class="d-text" x="80" y="183" text-anchor="middle">A</text><text class="d-sub" x="80" y="200" text-anchor="middle">prev · next</text><rect class="d-box" x="190" y="160" width="120" height="50" rx="8"/><text class="d-text" x="250" y="183" text-anchor="middle">B</text><text class="d-sub" x="250" y="200" text-anchor="middle">prev · next</text><rect class="d-box" x="360" y="160" width="120" height="50" rx="8"/><text class="d-text" x="420" y="183" text-anchor="middle">C</text><text class="d-sub" x="420" y="200" text-anchor="middle">prev · next</text><rect class="d-box" x="530" y="160" width="120" height="50" rx="8"/><text class="d-text" x="590" y="183" text-anchor="middle">D</text><text class="d-sub" x="590" y="200" text-anchor="middle">prev · next</text><line class="d-line" x1="140" y1="185" x2="188" y2="185" marker-end="url(#al-ah)" marker-start="url(#al-ah)"/><line class="d-line" x1="310" y1="185" x2="358" y2="185" marker-end="url(#al-ah)" marker-start="url(#al-ah)"/><line class="d-line" x1="480" y1="185" x2="528" y2="185" marker-end="url(#al-ah)" marker-start="url(#al-ah)"/><text class="d-label" x="20" y="240">get(2): walk A → B → C, one hop per element</text><text class="d-label" x="20" y="258">add or remove at either end: just relink, O(1)</text></svg>
<figcaption>Contiguous memory makes <code>ArrayList</code> fast to read and scan. <code>LinkedList</code> pays for every element with a separate object and pointer-chasing.</figcaption>
</figure>

| Operation | `ArrayList` | `LinkedList` | `ArrayDeque` |
| --- | --- | --- | --- |
| `get(i)` / `set(i)` | O(1) | O(n) | Not supported |
| Add / remove at the end | O(1) amortised | O(1) | O(1) |
| Add / remove at the front | O(n): shifts everything | O(1) | O(1) |
| Insert / remove in the middle | O(n): shifts the rest | O(n) to find the spot, O(1) to relink | Not supported |
| `contains` | O(n) | O(n) | O(n) |
| Memory per element | One array slot | A node object with 3 references | One array slot |
| `null` allowed | Yes | Yes | No |

Big-O hides the constant factor: `ArrayList` scans memory in a straight line, which modern CPUs
are very good at. So even operations that are O(n) for both are usually faster on `ArrayList`.

### Growth and capacity

`ArrayList` starts with an empty array and allocates room for 10 elements on the first `add`.
When the array is full it grows by about 50% and copies the elements across. If you know the
size in advance, `new ArrayList<>(expectedSize)` skips the intermediate copies.

### `ArrayDeque`: the stack and the queue

`ArrayDeque` is a circular array that can add and remove at both ends in O(1):

| Use it as | Add | Remove | Look |
| --- | --- | --- | --- |
| Stack (LIFO) | `push(e)` | `pop()` | `peek()` |
| Queue (FIFO) | `offer(e)` | `poll()` | `peek()` |
| Deque | `offerFirst` / `offerLast` | `pollFirst` / `pollLast` | `peekFirst` / `peekLast` |

Prefer it to `Stack` (synchronized, built on `Vector`) and to `LinkedList` (a node per element).

## In code: list traps

```java
import java.util.*;

public class ListsDeques {
    public static void main(String[] args) {
        // 1. Removing by index while looping forward skips elements
        List<Integer> numbers = new ArrayList<>(List.of(2, 4, 5, 6, 8));
        for (int i = 0; i < numbers.size(); i++) {
            if (numbers.get(i) % 2 == 0) numbers.remove(i);      // the next element shifts into i
        }
        System.out.println("index loop remove evens: " + numbers + "  (wrong)");

        List<Integer> fixed = new ArrayList<>(List.of(2, 4, 5, 6, 8));
        fixed.removeIf(n -> n % 2 == 0);
        System.out.println("removeIf evens:          " + fixed);

        // 2. Arrays.asList is a fixed-size view over the array
        String[] array = {"a", "b", "c"};
        List<String> view = Arrays.asList(array);
        view.set(0, "z");                                         // writes through to the array
        System.out.println("asList set writes array: " + array[0]);
        try {
            view.add("d");
        } catch (UnsupportedOperationException e) {
            System.out.println("asList add:              UnsupportedOperationException");
        }

        // 3. subList is a view too: clearing it removes from the original
        List<Integer> range = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));
        range.subList(1, 4).clear();
        System.out.println("after subList(1,4).clear: " + range);

        // 4. ArrayDeque: one class for a stack and a queue
        Deque<String> deque = new ArrayDeque<>();
        deque.push("first");                 // stack: add to the front
        deque.push("second");
        deque.offerLast("last");             // queue: add to the back
        System.out.println("deque:                   " + deque);
        System.out.println("pop / pollLast:          " + deque.pop() + " / " + deque.pollLast());
        try {
            deque.add(null);
        } catch (NullPointerException e) {
            System.out.println("ArrayDeque add(null):    NullPointerException");
        }

        // 5. LinkedList allows null and is also a Deque, but get(i) walks the nodes
        LinkedList<String> linked = new LinkedList<>(List.of("x", "y"));
        linked.addFirst(null);
        System.out.println("LinkedList with null:    " + linked);
    }
}
```
{: .runnable}

```text
index loop remove evens: [4, 5, 8]  (wrong)
removeIf evens:          [5]
asList set writes array: z
asList add:              UnsupportedOperationException
after subList(1,4).clear: [0, 4, 5]
deque:                   [second, first, last]
pop / pollLast:          second / last
ArrayDeque add(null):    NullPointerException
LinkedList with null:    [null, x, y]
```
{: .run-output}

- The index loop never checks the element that slides into the slot it just emptied, so `4`
  and `8` survive. `removeIf` does it correctly.
- `Arrays.asList` and `subList` are **views**: changes go through to the array or list
  underneath, and size changes may not be allowed.
- `ArrayDeque` refuses `null`, so `poll()` returning `null` can always mean "empty".

## Pitfalls

- **Choosing `LinkedList` for "fast inserts".** Finding the position is O(n), and the node
  overhead usually makes it slower than `ArrayList` anyway.
- **Calling `get(i)` in a loop on a `LinkedList`.** That's O(n²); use a for-each loop.
- **Removing inside a for-each loop.** It throws `ConcurrentModificationException`; use
  `removeIf` or an `Iterator`.
- **Treating `Arrays.asList` or `subList` as independent lists.** Copy them with
  `new ArrayList<>(...)` first.
- **Using `Stack` or `Vector`.** Legacy, synchronized on every call. Use `ArrayDeque` and
  `ArrayList`.
- **`list.remove(1)` on a `List<Integer>`.** It removes the element at index 1, not the value 1
  (see the Core Java chapter on wrappers).

## When to use what

| Need | Use |
| --- | --- |
| A general-purpose list | `ArrayList` |
| A list whose size you know up front | `new ArrayList<>(size)` |
| A stack | `ArrayDeque` with `push` / `pop` |
| A FIFO queue, single thread | `ArrayDeque` with `offer` / `poll` |
| Add and remove at both ends | `ArrayDeque` |
| Many inserts and removals through an iterator, mid-list | `LinkedList` (measure first) |
| A queue shared between threads | A `BlockingQueue` (see the concurrency series) |

## Further reading

- [`ArrayList` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html)
- [`ArrayDeque` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html)
- [`LinkedList` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html)
