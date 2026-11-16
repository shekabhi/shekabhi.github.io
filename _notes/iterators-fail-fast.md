---
title: "Iterators, fail-fast and ConcurrentModificationException"
short_title: "Iterators and ConcurrentModificationException"
topic: Java collections
date: 2026-11-16
tags: [java, collections, iterator, concurrentmodificationexception]
summary: How a for-each loop really works, why changing a collection while looping over it throws ConcurrentModificationException (and sometimes doesn't), and the safe ways to remove, replace and insert.
catalog: iterators-fail-fast
series: java-collections
priority: high
questions:
  - q: What does a for-each loop compile to?
    a: >-
      For an `Iterable`, `for (T x : items)` becomes `Iterator<T> it = items.iterator(); while
      (it.hasNext()) { T x = it.next(); ... }`. (For arrays it becomes an index loop.) So any
      class that implements `Iterable` works in a for-each loop, and every rule about iterators
      applies to for-each loops too.
  - q: Why does removing from a list inside a for-each loop throw `ConcurrentModificationException`?
    a: >-
      `ArrayList`, `HashMap` and most other collections keep a modification count, `modCount`.
      An iterator records it when created and checks it on every `next()`. `list.remove(...)`
      changes `modCount` behind the iterator's back, so the next `next()` sees the mismatch and
      throws. This is called *fail-fast*: it stops early instead of returning wrong results.
  - q: Does `ConcurrentModificationException` mean there are several threads?
    a: >-
      No. Most of the time it happens in a single thread: modifying a collection while iterating
      over it. With several threads the check is best-effort and not guaranteed to fire, so a
      `ConcurrentModificationException` is a bug signal, not a thread-safety mechanism.
  - q: How do you safely remove elements while iterating?
    a: >-
      `collection.removeIf(condition)` is the simplest. Otherwise use an explicit `Iterator` and
      its `remove()` method, which updates the expected count. For maps, use
      `map.entrySet().removeIf(...)`, `map.values().removeIf(...)` or the iterator of a view.
      Collecting the items to remove and calling `removeAll` afterwards also works.
  - q: What is the difference between fail-fast and fail-safe (weakly consistent) iterators?
    a: >-
      Fail-fast iterators (`ArrayList`, `HashMap`, ...) throw when the collection changes under
      them. Concurrent collections never throw: `CopyOnWriteArrayList` iterates a snapshot taken
      when the iterator was created, and `ConcurrentHashMap` iterates a live, *weakly
      consistent* view that may or may not reflect changes made during the loop.
  - q: Why does removing the second-to-last element inside a for-each loop not throw?
    a: >-
      After the removal the list is one shorter, so `hasNext()` (which compares the cursor with
      the new size) returns `false` and the loop ends before `next()` can check `modCount`. No
      exception, but the last element is silently never checked. Fail-fast is a best-effort
      safety net, not a guarantee.
  - q: Which removes elements safely while iterating an `ArrayList`?
    options:
      - "`iterator.remove()` after `iterator.next()`"
      - "`list.remove(x)` inside a for-each loop"
      - "`list.remove(i)` in a forward index loop"
      - "`list.clear()` inside the loop"
    correct: 1
    a: >-
      The iterator's own `remove` keeps its cursor and expected modification count in sync. The
      others throw `ConcurrentModificationException` or skip elements.
  - q: In a for-each over `[Arjun, Bo, Diya]` you remove `"Bo"`. What happens?
    options:
      - "No exception, and `Diya` is never visited"
      - "`ConcurrentModificationException`"
      - "`Diya` is visited twice"
      - "The loop restarts"
    correct: 1
    a: >-
      Removing the second-to-last element makes `hasNext()` return false, so the loop ends early
      without the `modCount` check. It's a quiet bug, which is why `removeIf` is better.
  - q: You add elements to a `CopyOnWriteArrayList` while iterating it with for-each. What happens?
    options:
      - "No exception; the loop sees only the elements present when it started"
      - "`ConcurrentModificationException`"
      - "An infinite loop, visiting the new elements too"
      - "It doesn't compile"
    correct: 1
    a: >-
      Its iterator works on a snapshot of the underlying array. The added elements are in the
      list afterwards, but the running loop doesn't see them.
  - q: How do you change every value in a `Map` while iterating?
    options:
      - "`entry.setValue(...)` on each entry from `entrySet()`"
      - "`map.put(key, ...)` for a new key inside the loop"
      - "`map.remove(key)` then `map.put(key, ...)`"
      - "You can't; maps are read-only during iteration"
    correct: 1
    a: >-
      Setting the value of an existing entry isn't a structural change, so it's allowed. Adding
      or removing keys through the map is structural and throws. `map.replaceAll((k, v) -> ...)`
      does the same in one call.
---

## The idea

A for-each loop looks like it walks a collection directly, but it's really an **iterator**
walking it for you. If the collection changes underneath that iterator, its position no longer
makes sense: it might skip an element, visit one twice, or run off the end. Java's collections
detect this and stop with `ConcurrentModificationException` instead of returning a wrong
answer.

## How it works

### The modification count

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 240" role="img" aria-labelledby="mc-title mc-desc"><title id="mc-title">How fail-fast iteration detects a change</title><desc id="mc-desc">The list keeps a modification count, starting at 4. The iterator copies it as its expected count, 4. Calling list.remove inside the loop raises the list's count to 5 but not the iterator's. On the next call to next, the iterator compares 5 with 4, sees they differ, and throws ConcurrentModificationException. Calling iterator.remove instead updates both counts, so iteration continues.</desc><defs><marker id="mc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="30" width="200" height="56" rx="10"/><text class="d-text" x="120" y="54" text-anchor="middle">ArrayList</text><text class="d-sub" x="120" y="74" text-anchor="middle">modCount = 4</text><rect class="d-box" x="20" y="150" width="200" height="56" rx="10"/><text class="d-text" x="120" y="174" text-anchor="middle">Iterator</text><text class="d-sub" x="120" y="194" text-anchor="middle">expectedModCount = 4</text><line class="d-line" x1="120" y1="86" x2="120" y2="148" marker-end="url(#mc-ah)"/><text class="d-label" x="130" y="122">copied when the loop starts</text><rect class="d-box warn" x="300" y="30" width="200" height="56" rx="10"/><text class="d-text" x="400" y="54" text-anchor="middle">list.remove(x)</text><text class="d-sub" x="400" y="74" text-anchor="middle">modCount → 5</text><rect class="d-box warn" x="300" y="150" width="200" height="56" rx="10"/><text class="d-text" x="400" y="174" text-anchor="middle">it.next()</text><text class="d-sub" x="400" y="194" text-anchor="middle">5 ≠ 4: throw CME</text><line class="d-line" x1="220" y1="58" x2="298" y2="58" marker-end="url(#mc-ah)"/><line class="d-line" x1="220" y1="178" x2="298" y2="178" marker-end="url(#mc-ah)"/><rect class="d-box hi" x="560" y="90" width="180" height="56" rx="10"/><text class="d-text" x="650" y="114" text-anchor="middle">it.remove()</text><text class="d-sub" x="650" y="134" text-anchor="middle">updates both: no throw</text><text class="d-label" x="20" y="230">Only structural changes count: add and remove. Setting a value (list.set, entry.setValue) doesn't.</text></svg>
<figcaption>The exception is a deliberate early stop: the iterator noticed it can no longer trust its position.</figcaption>
</figure>

| You do this while iterating | What happens |
| --- | --- |
| `list.remove(x)` / `list.add(x)` in a for-each | `ConcurrentModificationException` (usually) |
| `list.set(i, x)` or `entry.setValue(v)` | Fine: not a structural change |
| `iterator.remove()` | Fine: the iterator stays in sync |
| `listIterator.set(x)` / `listIterator.add(x)` | Fine |
| `collection.removeIf(...)` instead of a loop | Fine, and the clearest |
| Remove the second-to-last element in a for-each | No exception, but the last element is skipped |

### Fail-fast vs fail-safe

| Collection | Iterator | During changes |
| --- | --- | --- |
| `ArrayList`, `HashMap`, `HashSet`, `TreeMap`, ... | Fail-fast | Throws `ConcurrentModificationException` (best effort) |
| `CopyOnWriteArrayList`, `CopyOnWriteArraySet` | Snapshot | Never throws; sees the collection as it was when the loop began |
| `ConcurrentHashMap`, `ConcurrentLinkedQueue`, ... | Weakly consistent | Never throws; may or may not see later changes |

## In code: breaking and fixing loops

```java
import java.util.*;
import java.util.concurrent.*;

public class Iterators {
    // Any Iterable works in a for-each loop
    record Countdown(int from) implements Iterable<Integer> {
        public Iterator<Integer> iterator() {
            return new Iterator<>() {
                int next = from;
                public boolean hasNext() { return next > 0; }
                public Integer next() {
                    if (!hasNext()) throw new NoSuchElementException();
                    return next--;
                }
            };
        }
    }

    public static void main(String[] args) {
        // 1. Removing inside for-each: the iterator notices the list changed
        List<String> names = new ArrayList<>(List.of("Arjun", "Bo", "Diya", "Kabir"));
        try {
            for (String n : names) if (n.length() < 3) names.remove(n);
        } catch (ConcurrentModificationException e) {
            System.out.println("for-each remove:     ConcurrentModificationException");
        }

        // 2. ...except when the removed element is second to last: the loop just stops early
        List<String> quiet = new ArrayList<>(List.of("Arjun", "Bo", "Diya"));
        for (String n : quiet) if (n.equals("Bo")) quiet.remove(n);
        System.out.println("second-to-last:      " + quiet + "  (no exception, Diya never checked)");

        // 3. The right ways
        List<String> viaIterator = new ArrayList<>(List.of("Arjun", "Bo", "Diya", "Kabir"));
        for (Iterator<String> it = viaIterator.iterator(); it.hasNext(); ) {
            if (it.next().length() < 3) it.remove();
        }
        System.out.println("iterator.remove:     " + viaIterator);
        List<String> viaRemoveIf = new ArrayList<>(List.of("Arjun", "Bo", "Diya", "Kabir"));
        viaRemoveIf.removeIf(n -> n.length() < 3);
        System.out.println("removeIf:            " + viaRemoveIf);

        // 4. ListIterator can replace and insert while walking
        List<String> tags = new ArrayList<>(List.of("java", "redis", "spring"));
        for (ListIterator<String> it = tags.listIterator(); it.hasNext(); ) {
            String t = it.next();
            it.set(t.toUpperCase());
            if (t.equals("redis")) it.add("LUA");
        }
        System.out.println("listIterator:        " + tags);

        // 5. Maps: change values through entrySet, remove through keySet or entrySet
        Map<String, Integer> stock = new TreeMap<>(Map.of("pens", 0, "ink", 4, "paper", 0));
        for (Map.Entry<String, Integer> e : stock.entrySet()) e.setValue(e.getValue() + 1);
        stock.values().removeIf(v -> v == 1);
        System.out.println("map after edits:     " + stock);

        // 6. Concurrent collections don't throw: they iterate a snapshot or a live, weakly consistent view
        List<String> cow = new CopyOnWriteArrayList<>(List.of("a", "b"));
        for (String s : cow) cow.add(s + "!");             // iterates the old snapshot
        System.out.println("CopyOnWriteArrayList: " + cow);
        Map<String, Integer> chm = new ConcurrentHashMap<>(Map.of("x", 1));
        for (String k : chm.keySet()) chm.put(k + "2", 2);
        System.out.println("ConcurrentHashMap:   no exception (weakly consistent iterator)");

        // 7. A custom Iterable in a for-each loop
        StringBuilder out = new StringBuilder();
        for (int n : new Countdown(3)) out.append(n).append(' ');
        System.out.println("custom Iterable:     " + out + "liftoff");
    }
}
```
{: .runnable}

```text
for-each remove:     ConcurrentModificationException
second-to-last:      [Arjun, Diya]  (no exception, Diya never checked)
iterator.remove:     [Arjun, Diya, Kabir]
removeIf:            [Arjun, Diya, Kabir]
listIterator:        [JAVA, REDIS, LUA, SPRING]
map after edits:     {ink=5}
CopyOnWriteArrayList: [a, b, a!, b!]
ConcurrentHashMap:   no exception (weakly consistent iterator)
custom Iterable:     3 2 1 liftoff
```
{: .run-output}

- The first loop threw; the second "worked", but only because it ended before `Diya` was
  checked. Both are bugs.
- `iterator.remove()` and `removeIf` give the right answer.
- `ListIterator` replaced each tag and inserted `LUA` after `REDIS` while walking.
- The concurrent collections didn't throw; `CopyOnWriteArrayList` iterated the old snapshot, so
  the loop didn't run forever.

## Pitfalls

- **Calling `remove` on the collection inside a for-each loop.** Use `removeIf` or the iterator.
- **Trusting the absence of an exception.** Fail-fast is best effort; the second-to-last case
  skips silently.
- **Calling `next()` twice per loop.** Each call moves the cursor; store the result.
- **Reading `ConcurrentModificationException` as "a threading problem".** It's usually one
  thread modifying what it's iterating.
- **Using a concurrent collection just to avoid the exception.** It hides the real bug and costs
  performance; fix the loop.
- **Iterating an access-ordered `LinkedHashMap` and calling `get`.** In access order, `get`
  is a structural change.

## When to use what

| Need | Use |
| --- | --- |
| Remove elements matching a condition | `removeIf` |
| Remove with complex logic, one at a time | An explicit `Iterator` and `it.remove()` |
| Replace or insert while walking a list | `ListIterator` (`set`, `add`) |
| Change all values of a map | `map.replaceAll(...)` or `entry.setValue(...)` |
| Remove map entries by key or value | `map.keySet().removeIf(...)` / `map.values().removeIf(...)` |
| Iterate while other threads modify | A concurrent collection |
| Make your own class work in for-each | Implement `Iterable<T>` |

## Further reading

- [`ConcurrentModificationException` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ConcurrentModificationException.html)
- [`Iterator` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Iterator.html)
- [`ListIterator` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ListIterator.html)
