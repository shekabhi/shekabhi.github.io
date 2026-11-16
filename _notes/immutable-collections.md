---
title: "Immutable collections: List.of, copyOf and views"
short_title: "Immutable collections in Java"
topic: Java collections
date: 2026-11-16
tags: [java, collections, immutability, list-of, unmodifiable]
summary: The difference between an unmodifiable view, an immutable copy and a fixed-size list, the null and ordering rules of List.of, Set.of and Map.of, and why unmodifiable is still shallow.
catalog: immutable-collections
series: java-collections
priority: high
questions:
  - q: What is the difference between `Collections.unmodifiableList(list)` and `List.copyOf(list)`?
    a: >-
      `unmodifiableList` returns a read-only *view*: you can't change it through the view, but it
      reflects later changes to the original list. `List.copyOf` returns an independent,
      immutable copy that never changes. Use the view to expose internal state without letting
      callers modify it; use the copy when the contents must stay fixed.
  - q: What do `List.of`, `Set.of` and `Map.of` give you?
    a: >-
      Compact, truly immutable collections (Java 9+). Every modifying method throws
      `UnsupportedOperationException`. They reject `null` elements, keys and values with
      `NullPointerException`, and `Set.of` and `Map.of` reject duplicates with
      `IllegalArgumentException`. `Map.of` takes up to 10 key-value pairs; use
      `Map.ofEntries(Map.entry(k, v), ...)` for more.
  - q: Why does `List.of("a").contains(null)` throw?
    a: >-
      The immutable collections from `List.of` and friends are null-hostile: they not only reject
      `null` elements but also throw `NullPointerException` when you ask whether they contain
      `null`. An `ArrayList` would simply return `false`. Watch for this when replacing an
      `ArrayList` with `List.of` in existing code.
  - q: Is the iteration order of `Set.of` and `Map.of` stable?
    a: >-
      No. It's deliberately randomised: it's the same within one run of the JVM, but changes from
      run to run, so code can't come to depend on it. If you need an order, use `List.of`, a
      `LinkedHashSet`/`LinkedHashMap`, or sort the elements.
  - q: Does an immutable collection make its elements immutable?
    a: >-
      No, it's shallow. You can't add, remove or replace elements, but if an element is itself
      mutable (a `StringBuilder`, an `ArrayList`, an entity with setters), it can still change.
      For true immutability, use immutable element types too: `String`, records with immutable
      components, `List.copyOf` inside a record's constructor.
  - q: What does `Arrays.asList` return, compared with `List.of`?
    a: >-
      A fixed-size list backed by the array: `set` works and writes through to the array, but
      `add` and `remove` throw `UnsupportedOperationException`. It allows `null`. `List.of` is
      fully immutable and allows no `null`. Neither is a normal `ArrayList`; wrap in
      `new ArrayList<>(...)` when you need one.
  - q: You wrap a list with `Collections.unmodifiableList`, then add to the original list. What does the wrapper show?
    options:
      - "The new element: it's a view of the original"
      - "The old contents: it's a copy"
      - "It throws `ConcurrentModificationException`"
      - "It becomes empty"
    correct: 1
    a: >-
      An unmodifiable view blocks changes through itself, not changes to the list underneath. Use
      `List.copyOf` for a snapshot.
  - q: "What does `Map.of(\"a\", 1, \"a\", 2)` do?"
    options:
      - "It throws `IllegalArgumentException` for the duplicate key"
      - "It keeps `a=2`"
      - "It keeps `a=1`"
      - "It doesn't compile"
    correct: 1
    a: >-
      The `of` factories reject duplicate keys immediately, because in a literal list of
      constants a duplicate is almost certainly a mistake.
  - q: Which of these allows `set(0, x)` but not `add(x)`?
    options:
      - "`Arrays.asList(...)`"
      - "`List.of(...)`"
      - "`Stream.toList()`"
      - "`Collections.unmodifiableList(...)`"
    correct: 1
    a: >-
      `Arrays.asList` is fixed-size but writable, because it's a view over an array. The other
      three reject every modification.
  - q: "`List<String> immutable = List.of(\"x\")`. What is `List.copyOf(immutable) == immutable`?"
    options:
      - "`true`: copying an already-immutable list returns it as is"
      - "`false`: a new list is always created"
      - "It throws an exception"
      - "It depends on the size"
    correct: 1
    a: >-
      `List.copyOf` only copies when it has to. For a list that's already one of the immutable
      implementations, it returns the same instance, so defensive copies are cheap.
---

## The idea

"Read-only" means three different things in Java, and mixing them up causes real bugs:

- An **unmodifiable view** stops *you* from changing the collection, but it still changes when
  the original does.
- An **immutable collection** never changes at all.
- A **fixed-size list** (`Arrays.asList`) can't grow or shrink, but its elements can be replaced.

## How it works

### View vs copy

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 220" role="img" aria-labelledby="vc-title vc-desc"><title id="vc-title">An unmodifiable view compared with an immutable copy</title><desc id="vc-desc">An ArrayList called source holds a and b. Collections.unmodifiableList creates a read-only view that points at source, so when c is added to source, the view shows a, b and c. List.copyOf creates a separate immutable list holding a and b, which does not change when source does.</desc><defs><marker id="vc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="vc-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="270" y="20" width="220" height="56" rx="10"/><text class="d-text" x="380" y="44" text-anchor="middle">source (ArrayList)</text><text class="d-sub" x="380" y="64" text-anchor="middle">a, b, then add c</text><rect class="d-box warn" x="20" y="130" width="280" height="56" rx="10"/><text class="d-text" x="160" y="154" text-anchor="middle">unmodifiableList(source)</text><text class="d-sub" x="160" y="174" text-anchor="middle">a view: shows a, b, c</text><rect class="d-box hi" x="460" y="130" width="280" height="56" rx="10"/><text class="d-text" x="600" y="154" text-anchor="middle">List.copyOf(source)</text><text class="d-sub" x="600" y="174" text-anchor="middle">a copy: stays a, b</text><line class="d-line" x1="160" y1="128" x2="300" y2="78" marker-end="url(#vc-ah)"/><text class="d-label warn" x="40" y="110">reads through to source</text><line class="d-line hi" x1="460" y1="78" x2="560" y2="128" marker-end="url(#vc-ah-hi)"/><text class="d-label hi" x="520" y="96">copied once</text><text class="d-label" x="20" y="212">Both reject add and set. Only the copy is protected from changes to the source.</text></svg>
<figcaption>A view is a read-only window onto a list that can still change; a copy is a snapshot.</figcaption>
</figure>

### The read-only collections compared

| Created with | Change through it? | Reflects changes to a source? | `null`? |
| --- | --- | --- | --- |
| `List.of(...)`, `Set.of`, `Map.of` | No | No source | No: even `contains(null)` throws |
| `List.copyOf(c)`, `Set.copyOf`, `Map.copyOf` | No | No: a copy (or the same instance if already immutable) | No |
| `Stream.toList()` | No | No | Yes |
| `Collectors.toUnmodifiableList()` | No | No | No |
| `Collections.unmodifiableList(list)` | No | **Yes**: it's a view | As the source |
| `Arrays.asList(array)` | `set` yes; `add`/`remove` no | **Yes**: backed by the array | Yes |

### Rules of the `of` factories

- `null` elements, keys or values: `NullPointerException`.
- Duplicate elements in `Set.of`, or duplicate keys in `Map.of`: `IllegalArgumentException`.
- `Map.of` takes up to 10 pairs; `Map.ofEntries(Map.entry(k, v), ...)` takes any number.
- **`Set.of` and `Map.of` iterate in an order that changes between runs of the JVM.** Four runs
  of `System.out.println(Set.of("alpha", "beta", "gamma", "delta", "epsilon"))` on Java 21 printed
  four different orders. That's deliberate, so nobody depends on it.

## In code: what each kind allows

```java
import java.util.*;
import java.util.stream.*;

public class Immutables {
    public static void main(String[] args) {
        List<String> source = new ArrayList<>(List.of("a", "b"));

        List<String> view = Collections.unmodifiableList(source);   // read-only VIEW
        List<String> copy = List.copyOf(source);                      // independent copy
        List<String> fixed = Arrays.asList("a", "b");                 // fixed-size, writable
        source.add("c");
        System.out.println("source:              " + source);
        System.out.println("unmodifiable view:   " + view + "  (sees the change)");
        System.out.println("List.copyOf:         " + copy + "  (doesn't)");

        String[] attempts = {"view.add", "copy.add", "List.of set", "toList add", "asList add", "asList set"};
        Runnable[] actions = {
            () -> view.add("x"),
            () -> copy.add("x"),
            () -> List.of("a").set(0, "x"),
            () -> Stream.of("a").toList().add("x"),
            () -> fixed.add("x"),
            () -> fixed.set(0, "z"),
        };
        for (int i = 0; i < actions.length; i++) {
            try {
                actions[i].run();
                System.out.printf("%-20s ok%n", attempts[i] + ":");
            } catch (UnsupportedOperationException e) {
                System.out.printf("%-20s UnsupportedOperationException%n", attempts[i] + ":");
            }
        }
        System.out.println("asList after set:    " + fixed);

        // List.of is strict about null, even when asking
        try {
            List.of("a", null);
        } catch (NullPointerException e) {
            System.out.println("List.of(a, null):    NullPointerException");
        }
        try {
            List.of("a").contains(null);
        } catch (NullPointerException e) {
            System.out.println("contains(null):      NullPointerException");
        }
        System.out.println("ArrayList contains(null): " + source.contains(null));

        // copyOf skips the copy when the list is already immutable
        List<String> immutable = List.of("x", "y");
        System.out.println("copyOf same instance: " + (List.copyOf(immutable) == immutable));

        // Unmodifiable is shallow: the elements can still change
        List<StringBuilder> builders = List.of(new StringBuilder("draft"));
        builders.get(0).append(" (edited)");
        System.out.println("shallow:             " + builders);

        // Maps: up to 10 pairs with Map.of, any number with Map.ofEntries
        Map<String, Integer> ports = Map.ofEntries(Map.entry("http", 80), Map.entry("https", 443));
        System.out.println("Map.ofEntries get:   " + ports.get("https"));
        try {
            Map.of("a", 1, "a", 2);
        } catch (IllegalArgumentException e) {
            System.out.println("Map.of duplicate:    IllegalArgumentException");
        }
    }
}
```
{: .runnable}

```text
source:              [a, b, c]
unmodifiable view:   [a, b, c]  (sees the change)
List.copyOf:         [a, b]  (doesn't)
view.add:            UnsupportedOperationException
copy.add:            UnsupportedOperationException
List.of set:         UnsupportedOperationException
toList add:          UnsupportedOperationException
asList add:          UnsupportedOperationException
asList set:          ok
asList after set:    [z, b]
List.of(a, null):    NullPointerException
contains(null):      NullPointerException
ArrayList contains(null): false
copyOf same instance: true
shallow:             [draft (edited)]
Map.ofEntries get:   443
Map.of duplicate:    IllegalArgumentException
```
{: .run-output}

- The view showed `c` after it was added to the source; the copy didn't.
- Every collection rejected `add`, but `Arrays.asList` allowed `set`, and wrote through to its
  array.
- `List.of` threw on `contains(null)`, where an `ArrayList` returns `false`.
- The `StringBuilder` inside an immutable list was still edited: immutability is shallow.

## Pitfalls

- **Returning `Collections.unmodifiableList(internalList)` and assuming it's a snapshot.** Callers
  will see later changes; return `List.copyOf(...)` if they shouldn't.
- **Switching an `ArrayList` to `List.of` in code that passes `null`.** Both creation and
  `contains(null)` throw.
- **Expecting `Set.of` or `Map.of` order to be stable.** It changes between runs.
- **Mutable elements in an "immutable" collection.** Make the elements immutable too.
- **Modifying a list you received.** If a method might get `List.of(...)`, `add` throws; copy it
  first when you need to change it.
- **`Collectors.toList()` vs `Stream.toList()`.** The first gives a modifiable list today, the
  second an unmodifiable one; don't depend on the first being modifiable either.

## When to use what

| Need | Use |
| --- | --- |
| A constant list, set or map in code | `List.of`, `Set.of`, `Map.of` / `Map.ofEntries` |
| Freeze a collection you were given (defensive copy) | `List.copyOf`, `Set.copyOf`, `Map.copyOf` |
| Expose internal state read-only, live | `Collections.unmodifiableList(...)` |
| The result of a stream, not to be changed | `stream.toList()` |
| A list you will keep modifying | `new ArrayList<>(...)` |
| Immutable fields in a value class | A record with `List.copyOf` in its compact constructor |

## Further reading

- [`List.of` and unmodifiable lists (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/List.html#unmodifiable)
- [`Map.of` and unmodifiable maps (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Map.html#unmodifiable)
- [JEP 269: Convenience factory methods for collections](https://openjdk.org/jeps/269)
