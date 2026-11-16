---
title: "Lambdas, functional interfaces and streams"
short_title: "Java lambdas and streams"
topic: Core Java
date: 2026-11-16
tags: [java, lambdas, streams, functional-interfaces, collectors]
summary: What a lambda really is, the functional interfaces you meet every day, how a stream pipeline runs lazily one element at a time, and the collectors and traps worth knowing.
catalog: streams
series: core-java
priority: high
questions:
  - q: What is a lambda in Java?
    a: >-
      A short way to write an implementation of a *functional interface*: an interface with
      exactly one abstract method. `s -> s.length() > 4` can be a `Predicate<String>` because
      its shape (takes a `String`, returns a `boolean`) matches `test`. The compiler infers the
      types from the target interface. A method reference such as `String::length` is a shorter
      lambda that just calls one existing method.
  - q: Name the main functional interfaces in `java.util.function`.
    a: >-
      `Function<T, R>` (T → R, `apply`), `Predicate<T>` (T → boolean, `test`), `Supplier<T>`
      (() → T, `get`), `Consumer<T>` (T → nothing, `accept`), `BiFunction<T, U, R>` (two
      inputs), and `UnaryOperator<T>` / `BinaryOperator<T>` (same type in and out). Primitive
      versions such as `IntPredicate` and `ToIntFunction` avoid boxing.
  - q: Why must variables used in a lambda be effectively final?
    a: >-
      A lambda captures the *value* of a local variable, not the variable itself, and may run
      later or on another thread. If the variable could still change, the lambda's copy and
      the variable would disagree. So the compiler only allows locals that are never reassigned
      (final, or effectively final). Fields aren't restricted, which is a reason to be careful.
  - q: What does it mean that streams are lazy?
    a: >-
      Intermediate operations (`filter`, `map`, `sorted`, ...) only build a pipeline. Nothing
      runs until a terminal operation (`collect`, `forEach`, `count`, `findFirst`, ...). Then
      elements flow through the whole pipeline one at a time, and short-circuiting terminals
      like `findFirst` or `anyMatch` stop as soon as they have an answer, so later elements may
      never be processed.
  - q: What is the difference between `map` and `flatMap`?
    a: >-
      `map` turns each element into exactly one new element. `flatMap` turns each element into
      a stream of zero or more elements and flattens them all into one stream. For example,
      turning a stream of sentences into a stream of words needs `flatMap`.
  - q: When should you not use a parallel stream?
    a: >-
      Usually. Parallel streams split work across the common fork-join pool, which only pays off
      for large amounts of CPU-heavy work on data that splits easily (arrays, `ArrayList`,
      ranges). They hurt with small inputs, blocking I/O, `LinkedList` or iterator sources,
      ordered operations like `limit`, and any shared mutable state. Measure before using them.
  - q: "A stream pipeline ends in `findFirst()` and has a `peek` that prints each element. Source: `\"a\"`, `\"bb\"`, `\"ccc\"`; filter: length > 1. Which elements are printed?"
    options:
      - "`a` and `bb`"
      - "`a`, `bb` and `ccc`"
      - "Only `bb`"
      - "Nothing"
    correct: 1
    a: >-
      Elements flow one at a time. `a` is seen and filtered out, `bb` passes and `findFirst`
      stops the pipeline, so `ccc` is never pulled from the source.
  - q: What happens if you call a terminal operation twice on the same stream?
    options:
      - "`IllegalStateException`: a stream can be consumed only once"
      - "It runs the pipeline again"
      - "It returns the cached result"
      - "It returns an empty result"
    correct: 1
    a: >-
      A stream is a one-shot pipeline, not a collection. Create a new stream from the source
      each time, or collect the results into a list first.
  - q: "`Collectors.toMap(Order::customer, Order::amount)` meets two orders from the same customer. What happens?"
    options:
      - "It throws `IllegalStateException` for the duplicate key"
      - "The later value replaces the earlier one"
      - "The values are summed"
      - "The duplicate is skipped"
    correct: 1
    a: >-
      `toMap` refuses duplicate keys unless you pass a merge function as the third argument,
      such as `Integer::sum` or `(a, b) -> b`.
  - q: "What does `Stream.toList()` (Java 16+) return?"
    options:
      - "An unmodifiable list"
      - "A new `ArrayList` you can add to"
      - "A `LinkedList`"
      - "A live view of the source"
    correct: 1
    a: >-
      `Stream.toList()` returns an unmodifiable list, so `add` throws
      `UnsupportedOperationException`. `collect(Collectors.toList())` makes no such promise
      (today it returns an `ArrayList`), and `Collectors.toCollection(ArrayList::new)` guarantees
      a mutable one.
---

## The idea

A **lambda** is a small piece of behaviour you can pass around: "keep the long ones", "turn an
order into its amount". A **stream** is a pipeline that applies such behaviours to a sequence
of elements: filter them, transform them, then collect a result.

Two ideas make streams work, and explain their surprises: lambdas are implementations of
**functional interfaces**, and stream pipelines are **lazy**, pulling one element at a time
through every step.

## How it works

### Lambdas and functional interfaces

A functional interface has exactly one abstract method. A lambda supplies its body:

```java
Predicate<String> isLong = s -> s.length() > 4;        // test(String) -> boolean
Comparator<String> byLength = (a, b) -> Integer.compare(a.length(), b.length());
Runnable task = () -> System.out.println("running");   // run() -> void
```

| Interface | Method | Shape | Example |
| --- | --- | --- | --- |
| `Function<T, R>` | `apply` | T → R | `String::length` |
| `Predicate<T>` | `test` | T → boolean | `s -> s.isBlank()` |
| `Supplier<T>` | `get` | () → T | `ArrayList::new` |
| `Consumer<T>` | `accept` | T → nothing | `System.out::println` |
| `BiFunction<T, U, R>` | `apply` | T, U → R | `(a, b) -> a + b` |
| `UnaryOperator<T>` | `apply` | T → T | `String::trim` |
| `BinaryOperator<T>` | `apply` | T, T → T | `Integer::sum` |

**Method references** come in four kinds: static (`Integer::parseInt`), an instance method of a
particular object (`System.out::println`), an instance method of the parameter
(`String::toUpperCase`), and a constructor (`ArrayList::new`).

A lambda can read local variables only if they're **effectively final**: never reassigned after
being set. The compiler rejects `x++` on a variable a lambda uses.

### How a stream pipeline runs

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 190" role="img" aria-labelledby="sp2-title sp2-desc" data-routes='[{"pts": [[110, 70], [250, 70], [420, 70], [590, 70], [700, 70]], "cls": "hi", "w": 2}, {"pts": [[110, 70], [250, 70], [330, 70], [330, 120]], "cls": "bad", "w": 1}]'><title id="sp2-title">A lazy stream pipeline</title><desc id="sp2-desc">A source feeds elements one at a time into filter, then map, then the terminal operation findFirst. Element a is dropped by the filter. Element bb passes the filter and the map, reaches findFirst, and the pipeline stops, so element ccc is never read from the source.</desc><defs><marker id="sp2-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="sp2-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="44" width="90" height="52" rx="9"/><text class="d-text" x="65" y="68" text-anchor="middle">source</text><text class="d-sub" x="65" y="86" text-anchor="middle">a, bb, ccc</text><rect class="d-box" x="250" y="44" width="160" height="52" rx="9"/><text class="d-text" x="330" y="68" text-anchor="middle">filter</text><text class="d-sub" x="330" y="86" text-anchor="middle">length &gt; 1</text><rect class="d-box" x="420" y="44" width="160" height="52" rx="9"/><text class="d-text" x="500" y="68" text-anchor="middle">map</text><text class="d-sub" x="500" y="86" text-anchor="middle">toUpperCase</text><rect class="d-box hi" x="590" y="44" width="150" height="52" rx="9"/><text class="d-text" x="665" y="68" text-anchor="middle">findFirst()</text><text class="d-sub" x="665" y="86" text-anchor="middle">terminal: pulls</text><line class="d-line" x1="110" y1="70" x2="248" y2="70" marker-end="url(#sp2-ah)"/><line class="d-line" x1="410" y1="70" x2="418" y2="70"/><line class="d-line" x1="580" y1="70" x2="588" y2="70"/><text class="d-label" x="180" y="60" text-anchor="middle">one at a time</text><text class="d-label warn" x="250" y="136">a: dropped by filter</text><text class="d-label hi" x="420" y="136">bb: passes, becomes BB, findFirst stops</text><text class="d-label" x="20" y="176">ccc is never read. Without a terminal operation, nothing runs at all.</text></svg>
<figcaption>The terminal operation pulls elements through the whole pipeline one by one, and short-circuiting terminals stop early.</figcaption>
</figure>

| Kind | Examples | Runs when |
| --- | --- | --- |
| Source | `list.stream()`, `Stream.of(...)`, `IntStream.range(a, b)`, `Arrays.stream(array)` | Pulled by the terminal |
| Intermediate (lazy) | `filter`, `map`, `flatMap`, `distinct`, `sorted`, `limit`, `skip`, `peek` | Only as part of a terminal |
| Terminal | `collect`, `toList`, `forEach`, `count`, `reduce`, `min`, `max`, `findFirst`, `anyMatch` | Immediately, and consumes the stream |

`sorted` and `distinct` are *stateful*: `sorted` must see every element before passing any on.

### Collectors you'll use

| Collector | Result |
| --- | --- |
| `toList()` (on the stream, Java 16+) | An unmodifiable list |
| `Collectors.toSet()` | A set |
| `Collectors.toMap(k, v)` | A map; throws on duplicate keys unless you add a merge function |
| `Collectors.groupingBy(key)` | `Map<K, List<T>>`; add a downstream collector to count or sum |
| `Collectors.partitioningBy(test)` | `Map<Boolean, List<T>>` |
| `Collectors.joining(", ")` | One string |
| `Collectors.counting()`, `summingInt`, `averagingDouble` | Numbers, usually as a downstream collector |

## In code: functional interfaces, laziness and collectors

```java
import java.util.*;
import java.util.function.*;
import java.util.stream.*;

public class Streams {
    record Order(String customer, String city, int amount) { }

    public static void main(String[] args) {
        // The core functional interfaces
        Predicate<String> isLong = s -> s.length() > 4;
        Function<String, Integer> length = String::length;          // method reference
        Supplier<List<String>> newList = ArrayList::new;             // constructor reference
        Consumer<String> shout = s -> System.out.println("consumer:     " + s.toUpperCase());
        BinaryOperator<Integer> add = Integer::sum;
        System.out.println("predicate:    " + isLong.test("stream") + ", function: " + length.apply("lambda")
                + ", supplier: " + newList.get() + ", operator: " + add.apply(2, 3));
        shout.accept("hi");

        // Streams are lazy: nothing runs until a terminal operation, and elements flow one at a time
        Stream<String> pipeline = Stream.of("a", "bb", "ccc")
                .peek(s -> System.out.println("  saw " + s))
                .filter(s -> s.length() > 1)
                .map(String::toUpperCase);
        System.out.println("pipeline built, nothing printed yet");
        System.out.println("findFirst:    " + pipeline.findFirst().orElse("none"));   // stops at "bb"

        // A stream can be used once
        Stream<String> once = Stream.of("x");
        once.count();
        try {
            once.count();
        } catch (IllegalStateException e) {
            System.out.println("reuse:        IllegalStateException");
        }

        List<Order> orders = List.of(
                new Order("Diya", "Pune", 300), new Order("Arjun", "Delhi", 120),
                new Order("Diya", "Pune", 80), new Order("Kabir", "Delhi", 500));

        // Collectors
        Map<String, Integer> totalByCity = orders.stream()
                .collect(Collectors.groupingBy(Order::city, TreeMap::new, Collectors.summingInt(Order::amount)));
        System.out.println("groupingBy:   " + totalByCity);
        Map<Boolean, Long> bigOrSmall = orders.stream()
                .collect(Collectors.partitioningBy(o -> o.amount() >= 200, Collectors.counting()));
        System.out.println("partitioning: " + bigOrSmall);
        String names = orders.stream().map(Order::customer).distinct().sorted()
                .collect(Collectors.joining(", ", "[", "]"));
        System.out.println("joining:      " + names);
        try {
            orders.stream().collect(Collectors.toMap(Order::customer, Order::amount));
        } catch (IllegalStateException e) {
            System.out.println("toMap:        IllegalStateException (duplicate key Diya)");
        }
        Map<String, Integer> merged = orders.stream()
                .collect(Collectors.toMap(Order::customer, Order::amount, Integer::sum, TreeMap::new));
        System.out.println("toMap merge:  " + merged);

        // flatMap, reduce, and an unmodifiable toList (Java 16+)
        List<String> words = Stream.of("to be", "or not").flatMap(s -> Arrays.stream(s.split(" "))).toList();
        System.out.println("flatMap:      " + words);
        System.out.println("reduce:       " + IntStream.rangeClosed(1, 5).reduce(1, (a, b) -> a * b));
        try {
            words.add("!");
        } catch (UnsupportedOperationException e) {
            System.out.println("toList():     unmodifiable");
        }

        // Captured local variables must be effectively final
        int bonus = 10;
        System.out.println("captured:     " + orders.stream().mapToInt(o -> o.amount() + bonus).sum());
    }
}
```
{: .runnable}

```text
predicate:    true, function: 6, supplier: [], operator: 5
consumer:     HI
pipeline built, nothing printed yet
  saw a
  saw bb
findFirst:    BB
reuse:        IllegalStateException
groupingBy:   {Delhi=620, Pune=380}
partitioning: {false=2, true=2}
joining:      [Arjun, Diya, Kabir]
toMap:        IllegalStateException (duplicate key Diya)
toMap merge:  {Arjun=120, Diya=380, Kabir=500}
flatMap:      [to, be, or, not]
reduce:       120
toList():     unmodifiable
captured:     1040
```
{: .run-output}

- "pipeline built, nothing printed yet" appears **before** any `saw` line: building the pipeline
  ran nothing.
- `findFirst` stopped after `bb`; `ccc` was never seen.
- `groupingBy(..., TreeMap::new, summingInt(...))` groups, sorts the keys and adds up the
  amounts in one pass.
- `toMap` refused the duplicate customer until it was given a merge function.

## Pitfalls

- **Side effects in lambdas.** Adding to an outside list from `forEach` or `map` breaks with
  parallel streams and hides intent; use a collector.
- **Reusing a stream.** It can be consumed once; create a new one, or collect first.
- **`peek` for logic.** It's for debugging; it may not run for elements a short-circuit skips.
- **`toMap` without a merge function** when keys can repeat.
- **Assuming `toList()` is mutable.** It isn't; collect to `ArrayList::new` if you need to add.
- **Long, clever pipelines.** A plain loop is sometimes clearer, especially with checked
  exceptions or early `return`s.
- **Boxing in hot paths.** Use `IntStream`, `mapToInt` and `sum` instead of `Stream<Integer>`
  and `reduce(0, Integer::sum)`.
- **Reaching for `parallel()`.** Measure first; it often makes things slower.

## When to use what

| Need | Use |
| --- | --- |
| Pass a small piece of behaviour | A lambda or method reference |
| Filter, transform and collect a collection | A stream |
| Group or count by a key | `Collectors.groupingBy` with a downstream collector |
| Build a map from a stream with possible duplicate keys | `toMap` with a merge function |
| Numbers: sums, averages, ranges | `IntStream` / `LongStream` / `DoubleStream` |
| Complex control flow, checked exceptions, early exit | A plain `for` loop |
| A list you'll keep modifying | `collect(Collectors.toCollection(ArrayList::new))` |

## Further reading

- [`java.util.stream` package summary (Java 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/package-summary.html)
- [`java.util.function` package summary (Java 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/function/package-summary.html)
- [`Collectors` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/Collectors.html)
