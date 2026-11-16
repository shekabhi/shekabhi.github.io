---
title: "Queues and PriorityQueue"
short_title: "Java queues and PriorityQueue"
topic: Java collections
date: 2026-11-16
tags: [java, collections, queue, priorityqueue, heap]
summary: The Queue methods that throw and the ones that don't, how PriorityQueue keeps a binary heap in an array, and how to use it for priorities, max-heaps and top-K problems.
catalog: queues-heaps
series: java-collections
priority: high
questions:
  - q: What is the difference between `offer`/`poll`/`peek` and `add`/`remove`/`element`?
    a: >-
      They do the same jobs, but report problems differently. `add`, `remove` and `element`
      throw an exception (`IllegalStateException` when a bounded queue is full,
      `NoSuchElementException` when it's empty). `offer`, `poll` and `peek` return a special
      value instead: `false` or `null`. Use the second set when an empty or full queue is a
      normal situation.
  - q: How does `PriorityQueue` work inside?
    a: >-
      It's a binary min-heap stored in an array. The smallest element is always at index 0, and
      each element at index `i` is no larger than its children at `2i + 1` and `2i + 2`. `offer`
      adds at the end and "sifts up"; `poll` moves the last element to the top and "sifts
      down". Both are O(log n); `peek` is O(1).
  - q: Why doesn't printing a `PriorityQueue` show its elements in sorted order?
    a: >-
      `toString` and iteration walk the underlying array, which is in heap order: the smallest
      element is first, but the rest are only partly ordered. Only repeated `poll()` returns
      elements in priority order. To see them sorted without emptying the queue, copy them to a
      list and sort it.
  - q: How do you make a max-heap?
    a: >-
      Pass a reversed comparator: `new PriorityQueue<>(Comparator.reverseOrder())`, or
      `Comparator.comparingInt(Task::priority).reversed()` for objects. `PriorityQueue` is
      always a min-heap with respect to its comparator, so reversing the comparator puts the
      largest element at the top.
  - q: How do you find the k largest numbers in a large stream?
    a: >-
      Keep a min-heap of size k. For each number, `offer` it, and if the heap now has more than k
      elements, `poll` the smallest. At the end the heap holds the k largest. That's O(n log k)
      time and O(k) memory, much better than sorting everything when k is small.
  - q: Is `PriorityQueue` thread-safe, and is it stable?
    a: >-
      Neither. Use `PriorityBlockingQueue` when several threads share it. It's not stable either:
      elements with equal priority come out in no guaranteed order, so add a tie-breaker to the
      comparator (such as `thenComparing(Task::name)` or a sequence number) when the order of
      equals matters.
  - q: "`new PriorityQueue<>(List.of(42, 7, 19, 3, 25))` — what does `peek()` return?"
    options:
      - "3"
      - "42"
      - "7"
      - "25"
    correct: 1
    a: >-
      A `PriorityQueue` with natural ordering is a min-heap, so the smallest element is at the
      head, whatever the insertion order.
  - q: An `ArrayDeque` is empty. What does `poll()` return, and what does `remove()` do?
    options:
      - "`poll()` returns `null`; `remove()` throws `NoSuchElementException`"
      - "Both return `null`"
      - "Both throw `NoSuchElementException`"
      - "`poll()` throws; `remove()` returns `null`"
    correct: 1
    a: >-
      `poll`, `peek` and `offer` signal with a return value; `remove`, `element` and `add` throw.
  - q: To keep the 3 largest of many numbers, which heap do you keep, and what do you remove when it grows to 4?
    options:
      - "A min-heap of size 3; remove the smallest"
      - "A max-heap of size 3; remove the largest"
      - "A min-heap of all numbers; remove nothing"
      - "A max-heap of size 3; remove the smallest"
    correct: 1
    a: >-
      The smallest of the current top candidates is the one to drop, and a min-heap keeps exactly
      that at the head, so each step is one `offer` and at most one `poll`.
  - q: What is the cost of `poll()` on a `PriorityQueue` of n elements?
    options:
      - "O(log n)"
      - "O(1)"
      - "O(n)"
      - "O(n log n)"
    correct: 1
    a: >-
      Removing the head leaves a hole at the top; the last element moves there and sifts down at
      most the height of the heap, about log₂ n levels. `peek` is O(1); `remove(Object)` and
      `contains` are O(n).
---

## The idea

A **queue** hands elements out in a defined order. For most queues that's arrival order
(first in, first out). A **priority queue** hands out the *most important* element first, where
"most important" is defined by a comparator. Java's `PriorityQueue` does this with a **binary
heap**, one of the most useful structures to know: it keeps the smallest element ready in O(1)
and pays only O(log n) to add or remove.

## How it works

### The Queue methods

| Operation | Throws an exception | Returns a special value |
| --- | --- | --- |
| Add at the tail | `add(e)` | `offer(e)`: `false` if a bounded queue is full |
| Remove the head | `remove()` | `poll()`: `null` if empty |
| Look at the head | `element()` | `peek()`: `null` if empty |

Because `poll` and `peek` use `null` to mean "empty", `ArrayDeque` and `PriorityQueue` don't
accept `null` elements.

### A binary heap in an array

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 270" role="img" aria-labelledby="hp-title hp-desc"><title id="hp-title">A binary min-heap stored in an array</title><desc id="hp-desc">The heap holds 3, 7, 19, 42 and 25. As a tree, 3 is the root, 7 and 19 are its children, and 42 and 25 are the children of 7. Each parent is smaller than its children. The same heap is stored in an array in level order: 3, 7, 19, 42, 25, where the children of the element at index i are at 2i plus 1 and 2i plus 2.</desc><defs><marker id="hp-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="22">AS A TREE · every parent ≤ its children</text><circle class="d-box hi" cx="200" cy="58" r="24"/><text class="d-text" x="200" y="63" text-anchor="middle">3</text><circle class="d-box" cx="120" cy="130" r="24"/><text class="d-text" x="120" y="135" text-anchor="middle">7</text><circle class="d-box" cx="280" cy="130" r="24"/><text class="d-text" x="280" y="135" text-anchor="middle">19</text><circle class="d-box" cx="70" cy="204" r="24"/><text class="d-text" x="70" y="209" text-anchor="middle">42</text><circle class="d-box" cx="170" cy="204" r="24"/><text class="d-text" x="170" y="209" text-anchor="middle">25</text><line class="d-line" x1="184" y1="76" x2="136" y2="112"/><line class="d-line" x1="216" y1="76" x2="264" y2="112"/><line class="d-line" x1="108" y1="151" x2="82" y2="183"/><line class="d-line" x1="132" y1="151" x2="158" y2="183"/><text class="d-label hi" x="234" y="50">peek() = 3, O(1)</text><text class="d-label" x="420" y="22">AS AN ARRAY · what toString() prints</text><rect class="d-box hi" x="420" y="40" width="60" height="44" rx="5"/><text class="d-text" x="450" y="67" text-anchor="middle">3</text><rect class="d-box" x="480" y="40" width="60" height="44" rx="5"/><text class="d-text" x="510" y="67" text-anchor="middle">7</text><rect class="d-box" x="540" y="40" width="60" height="44" rx="5"/><text class="d-text" x="570" y="67" text-anchor="middle">19</text><rect class="d-box" x="600" y="40" width="60" height="44" rx="5"/><text class="d-text" x="630" y="67" text-anchor="middle">42</text><rect class="d-box" x="660" y="40" width="60" height="44" rx="5"/><text class="d-text" x="690" y="67" text-anchor="middle">25</text><text class="d-label" x="450" y="102" text-anchor="middle">0</text><text class="d-label" x="510" y="102" text-anchor="middle">1</text><text class="d-label" x="570" y="102" text-anchor="middle">2</text><text class="d-label" x="630" y="102" text-anchor="middle">3</text><text class="d-label" x="690" y="102" text-anchor="middle">4</text><text class="d-label" x="420" y="140">children of i are at 2i + 1 and 2i + 2</text><text class="d-label" x="420" y="160">so 7 (index 1) has children 42 and 25</text><text class="d-label" x="420" y="196">offer: add at the end, sift up</text><text class="d-label" x="420" y="216">poll: move the last to the top, sift down</text><text class="d-label" x="420" y="236">both O(log n): the tree is log₂ n levels tall</text></svg>
<figcaption>The array is in heap order, not sorted order: only the first element is guaranteed to be the smallest.</figcaption>
</figure>

| Operation | Cost |
| --- | --- |
| `peek()` | O(1) |
| `offer(e)` / `poll()` | O(log n) |
| `new PriorityQueue<>(collection)` | O(n): builds the heap in one pass |
| `remove(Object)` / `contains(Object)` | O(n) |
| Iterating or `toString` | Heap order, **not** sorted |

## In code: heaps, priorities and top-K

```java
import java.util.*;

public class Queues {
    record Task(String name, int priority) { }

    public static void main(String[] args) {
        // A min-heap: poll always returns the smallest
        PriorityQueue<Integer> heap = new PriorityQueue<>(List.of(42, 7, 19, 3, 25));
        System.out.println("toString (heap order): " + heap);     // not sorted!
        System.out.println("peek:                  " + heap.peek());
        StringBuilder sorted = new StringBuilder();
        while (!heap.isEmpty()) sorted.append(heap.poll()).append(' ');
        System.out.println("poll until empty:      " + sorted.toString().trim());

        // A max-heap with a reversed comparator
        PriorityQueue<Integer> max = new PriorityQueue<>(Comparator.reverseOrder());
        max.addAll(List.of(42, 7, 19, 3, 25));
        System.out.println("max-heap poll:         " + max.poll());

        // Tasks by priority, then by name
        PriorityQueue<Task> tasks = new PriorityQueue<>(
                Comparator.comparingInt(Task::priority).thenComparing(Task::name));
        tasks.add(new Task("send email", 3));
        tasks.add(new Task("fix outage", 1));
        tasks.add(new Task("deploy", 2));
        tasks.add(new Task("call back", 1));
        List<String> order = new ArrayList<>();
        while (!tasks.isEmpty()) order.add(tasks.poll().name());
        System.out.println("tasks:                 " + order);

        // Top 3 largest of a stream of numbers: keep a min-heap of size 3
        int[] scores = {55, 91, 12, 78, 99, 64, 85, 40};
        PriorityQueue<Integer> top = new PriorityQueue<>();
        for (int s : scores) {
            top.offer(s);
            if (top.size() > 3) top.poll();            // drop the smallest of the four
        }
        List<Integer> best = new ArrayList<>(top);
        best.sort(Comparator.reverseOrder());
        System.out.println("top 3:                 " + best);

        // Two styles of Queue methods: throw, or return a special value
        Queue<String> empty = new ArrayDeque<>();
        System.out.println("poll on empty:         " + empty.poll());
        System.out.println("peek on empty:         " + empty.peek());
        try {
            empty.remove();
        } catch (NoSuchElementException e) {
            System.out.println("remove on empty:       NoSuchElementException");
        }
        try {
            new PriorityQueue<Integer>().add(null);
        } catch (NullPointerException e) {
            System.out.println("add(null):             NullPointerException");
        }
    }
}
```
{: .runnable}

```text
toString (heap order): [3, 7, 19, 42, 25]
peek:                  3
poll until empty:      3 7 19 25 42
max-heap poll:         42
tasks:                 [call back, fix outage, deploy, send email]
top 3:                 [99, 91, 85]
poll on empty:         null
peek on empty:         null
remove on empty:       NoSuchElementException
add(null):             NullPointerException
```
{: .run-output}

- The printed queue is `[3, 7, 19, 42, 25]`: heap order, with only the head guaranteed. `poll`
  returns them sorted.
- Tasks with the same priority come out by name only because the comparator says so;
  `PriorityQueue` itself isn't stable.
- The top-3 loop never holds more than four numbers, however long the input.

## Pitfalls

- **Iterating a `PriorityQueue` and expecting sorted order.** Only `poll` gives priority order.
- **Changing an element's priority while it's in the queue.** The heap isn't re-sorted; remove
  it, change it, and add it again.
- **Equal priorities in a meaningful order.** Add a tie-breaker to the comparator.
- **`remove(Object)` in a loop.** Each call is O(n).
- **`null` elements.** Rejected, because `poll` and `peek` use `null` for "empty".
- **Sharing between threads.** Use `PriorityBlockingQueue` (or another `BlockingQueue`).

## When to use what

| Need | Use |
| --- | --- |
| A FIFO queue, single thread | `ArrayDeque` |
| Always take the smallest (or most urgent) next | `PriorityQueue` with a comparator |
| Always take the largest next | `PriorityQueue` with `Comparator.reverseOrder()` |
| The k largest or smallest of many items | A heap of size k |
| A queue shared by producer and consumer threads | `ArrayBlockingQueue` / `LinkedBlockingQueue` |
| Priorities shared between threads | `PriorityBlockingQueue` |
| Tasks that run at a time in the future | `ScheduledExecutorService` (built on a `DelayQueue`-like heap) |

## Further reading

- [`Queue` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Queue.html)
- [`PriorityQueue` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html)
