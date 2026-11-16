---
title: "Generics, type erasure and wildcards"
short_title: "Java generics, erasure, wildcards"
topic: Core Java
date: 2026-11-16
tags: [java, generics, type-erasure, wildcards]
summary: What generics check at compile time, what type erasure removes, why a list of Integer is not a list of Number, and how to use the extends and super wildcards.
catalog: generics
series: core-java
priority: high
questions:
  - q: What problem do generics solve?
    a: >-
      They let a class or method work with any type while the compiler still checks the type.
      Before Java 5 a `List` held `Object`s, so you cast on every `get` and a wrong element only
      failed at run time. With `List<String>` the compiler rejects a wrong `add` and inserts the
      cast on `get` for you, so type errors are caught when you compile.
  - q: What is type erasure?
    a: >-
      Generic type information is checked by the compiler and then removed: at run time a
      `List<String>` and a `List<Integer>` are both just `ArrayList`. Type parameters become
      their bound (`Object` if unbounded), and the compiler adds casts where needed. This kept
      new generic code compatible with old non-generic code and class files.
  - q: What can't you do with generics because of erasure?
    a: >-
      You can't create `new T()` or `new T[n]`, check `instanceof List<String>`, use primitives
      as type arguments (`List<int>`), declare a static field of type `T`, or overload two
      methods that differ only in their type arguments (`m(List<String>)` and
      `m(List<Integer>)`). Pass a `Class<T>` or a factory (`Supplier<T>`) when you need the
      type at run time.
  - q: Why is a `List<Integer>` not a `List<Number>`?
    a: >-
      If it were, you could pass it to a method taking `List<Number>` that adds a `Double`, and
      the list of integers would then contain a double. Generics are *invariant* to prevent this.
      Arrays are covariant (`Integer[]` is an `Object[]`), which is why arrays need a run-time
      check and throw `ArrayStoreException`.
  - q: What does PECS mean?
    a: >-
      "Producer extends, consumer super." If a parameter only *gives* you values (you read from
      it), use `? extends T`: a `List<? extends Number>` accepts a `List<Integer>` or
      `List<Double>`. If it only *takes* values (you write into it), use `? super T`: a
      `List<? super Integer>` accepts `List<Integer>`, `List<Number>` or `List<Object>`. If you
      do both, use plain `T`. `Collections.copy(List<? super T> dest, List<? extends T> src)`
      follows this.
  - q: Why avoid raw types like `List` without a type argument?
    a: >-
      A raw type turns off generic type checking. The compiler only warns, and you can put an
      `Integer` into what is really a `List<String>` (heap pollution). The error appears later,
      as a `ClassCastException` where the value is read, often far from the line that caused
      it. Raw types exist only for compatibility with pre-Java-5 code.
  - q: "`List<String> a` and `List<Integer> b` are both `ArrayList`s. What is `a.getClass() == b.getClass()`?"
    options:
      - "`true`, because type arguments are erased at run time"
      - "`false`, because they hold different types"
      - "It doesn't compile"
      - "It depends on the elements"
    correct: 1
    a: >-
      Erasure leaves only `java.util.ArrayList` at run time. The type arguments existed only for
      the compiler.
  - q: "Which declaration lets a method read numbers from a `List<Integer>` and from a `List<Double>`?"
    options:
      - "`double sum(List<? extends Number> values)`"
      - "`double sum(List<Number> values)`"
      - "`double sum(List<? super Number> values)`"
      - "`double sum(List<Object> values)`"
    correct: 1
    a: >-
      `? extends Number` accepts a list of any subtype of `Number` and lets you read elements as
      `Number`. `List<Number>` accepts only a `List<Number>`, because generics are invariant.
  - q: "You put an `Integer` into a `List<String>` through a raw `List` reference. When does it fail?"
    options:
      - "Later, with `ClassCastException`, when the element is read as a `String`"
      - "Immediately, with `ArrayStoreException`"
      - "At compile time"
      - "Never; the list converts it"
    correct: 1
    a: >-
      The `add` succeeds because erasure means the list can't check element types. The cast the
      compiler inserted for `get` fails when the value is used.
  - q: Which of these compiles?
    options:
      - "`<T> List<T> listOf(T item)`"
      - "`<T> T[] make() { return new T[10]; }`"
      - "`o instanceof List<String>` with `Object o`"
      - "`List<int> numbers`"
    correct: 1
    a: >-
      A generic method is fine. Generic array creation, `instanceof` with a parameterised type
      and primitive type arguments are all rejected because of erasure.
---

## The idea

Generics let you write `List<String>` instead of a `List` of anything. The compiler then
checks every `add` and inserts every cast, so a wrong type is a **compile error** instead of a
`ClassCastException` in production.

The surprise is that this checking happens **only at compile time**. After compiling, the type
arguments are erased: the JVM sees a plain `ArrayList`. Most of the odd rules about generics
come from that one fact.

## How it works

### Generic classes and methods

```java
// A generic class: T is filled in by whoever uses it
public class Box<T> {
    private final T value;
    public Box(T value) { this.value = value; }
    public T get() { return value; }
}

Box<String> name = new Box<>("Abhishek");   // diamond <> infers String
String s = name.get();                      // no cast needed

// A generic method: its own type parameter, inferred from the arguments
static <T> List<T> twice(T item) {
    return List.of(item, item);
}
List<Integer> pair = twice(7);              // T inferred as Integer
```

A **bounded** type parameter limits what `T` can be, and lets you call its methods:
`<T extends Comparable<? super T>> T max(...)` can call `compareTo` on its elements.

### Type erasure

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 230" role="img" aria-labelledby="te-title te-desc" data-routes='[{"pts": [[260, 90], [480, 90]], "cls": "hi", "w": 2}]'><title id="te-title">Type erasure</title><desc id="te-desc">In the source, List of String and List of Integer are different types and the compiler checks them. After compilation both are the raw class ArrayList holding Object references, and the compiler has inserted casts where values are read.</desc><defs><marker id="te-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="24">SOURCE · CHECKED BY javac</text><rect class="d-box" x="20" y="40" width="240" height="44" rx="9"/><text class="d-text" x="140" y="67" text-anchor="middle">List&lt;String&gt; words</text><rect class="d-box" x="20" y="100" width="240" height="44" rx="9"/><text class="d-text" x="140" y="127" text-anchor="middle">List&lt;Integer&gt; numbers</text><text class="d-sub" x="140" y="172" text-anchor="middle">different types: words.add(42)</text><text class="d-sub" x="140" y="190" text-anchor="middle">is a compile error</text><line class="d-line hi" x1="270" y1="92" x2="478" y2="92" marker-end="url(#te-ah-hi)"/><text class="d-label hi" x="374" y="82" text-anchor="middle">compile + erase</text><text class="d-label" x="490" y="24">RUN TIME · WHAT THE JVM SEES</text><rect class="d-box hi" x="490" y="40" width="250" height="104" rx="10"/><text class="d-text" x="615" y="76" text-anchor="middle">ArrayList</text><text class="d-sub" x="615" y="98" text-anchor="middle">elements are just Object</text><text class="d-sub" x="615" y="118" text-anchor="middle">(String) casts inserted on get</text><text class="d-sub" x="615" y="172" text-anchor="middle">one class for both lists:</text><text class="d-sub" x="615" y="190" text-anchor="middle">no way to ask "a List of what?"</text></svg>
<figcaption>The type arguments live only in the source and in the compiler's checks. The running program can't see them.</figcaption>
</figure>

What erasure rules out, and the usual workaround:

| You can't | Because | Instead |
| --- | --- | --- |
| `new T()` or `new T[n]` | `T` is unknown at run time | Pass a `Supplier<T>`, a `Class<T>`, or use a `List<T>` |
| `o instanceof List<String>` | Only `List` exists at run time | `o instanceof List<?>`, then check the elements |
| `List<int>` | Type arguments must be objects | `List<Integer>`, or `IntStream` / `int[]` |
| `static T field` | A static belongs to the class, shared by every `T` | A static generic method, or an instance field |
| Overload `m(List<String>)` and `m(List<Integer>)` | Both erase to `m(List)` | Give them different names |

### Variance: why `List<Integer>` isn't a `List<Number>`

Arrays are **covariant**: an `Integer[]` *is* an `Object[]`, so the JVM must check every store
at run time. Generics are **invariant**: `List<Integer>` is not a `List<Number>`, so the
compiler can stop a bad write before it happens. **Wildcards** loosen this safely:

| Declaration | Accepts | You can |
| --- | --- | --- |
| `List<Number>` | Only `List<Number>` | Read `Number`, add any `Number` |
| `List<? extends Number>` | `List<Number>`, `List<Integer>`, `List<Double>`, ... | Read `Number`; can't add (except `null`) |
| `List<? super Integer>` | `List<Integer>`, `List<Number>`, `List<Object>` | Add `Integer`; read only as `Object` |
| `List<?>` | Any list | Read `Object`; can't add |

**PECS: producer `extends`, consumer `super`.** A parameter you read from produces values, so
use `? extends`; one you write into consumes them, so use `? super`.

## In code: erasure and wildcards in action

```java
import java.util.*;

public class Erasure {
    public static void main(String[] args) {
        List<String> words = new ArrayList<>();
        List<Integer> numbers = new ArrayList<>();
        // After compilation both are just ArrayList: the type arguments are erased
        System.out.println("same class at run time: " + (words.getClass() == numbers.getClass()));
        System.out.println("class name:             " + words.getClass().getName());

        // Arrays know their element type at run time; generics don't
        Object[] array = new String[1];
        try {
            array[0] = 42;                       // compiles: arrays are covariant
        } catch (ArrayStoreException e) {
            System.out.println("array store:            ArrayStoreException");
        }

        // A raw type turns off the checks, and the failure shows up later, somewhere else
        List raw = words;                        // warning: unchecked
        raw.add(42);                             // heap pollution: an Integer in a List<String>
        try {
            String first = words.get(0);         // the cast the compiler inserted fails here
        } catch (ClassCastException e) {
            System.out.println("raw type:               ClassCastException on get, not on add");
        }

        // List<Integer> is not a List<Number>, but it is a List<? extends Number>
        List<? extends Number> readOnly = List.of(1, 2, 3);
        System.out.println("sum via ? extends:      " + sum(readOnly));
        List<Number> sink = new ArrayList<>();
        addIntegers(sink);
        System.out.println("filled via ? super:     " + sink);

        System.out.println("max (bounded T):        " + max(List.of("pear", "apple", "zebra")));
    }

    // Producer extends: we only read Numbers out
    static double sum(List<? extends Number> values) {
        double total = 0;
        for (Number n : values) total += n.doubleValue();
        return total;
    }

    // Consumer super: we only put Integers in
    static void addIntegers(List<? super Integer> target) {
        for (int i = 1; i <= 3; i++) target.add(i);
    }

    // A bounded type parameter: T must be comparable to itself (or a supertype)
    static <T extends Comparable<? super T>> T max(List<? extends T> list) {
        T best = list.get(0);
        for (T item : list) if (item.compareTo(best) > 0) best = item;
        return best;
    }
}
```
{: .runnable}

```text
same class at run time: true
class name:             java.util.ArrayList
array store:            ArrayStoreException
raw type:               ClassCastException on get, not on add
sum via ? extends:      6.0
filled via ? super:     [1, 2, 3]
max (bounded T):        zebra
```
{: .run-output}

- Both lists report the same class: the type arguments are gone at run time.
- The array catches the bad store immediately. The raw-type list accepts `42` silently, and the
  failure shows up later, on `get`, far from the real mistake.
- `sum` reads through `? extends Number`; `addIntegers` writes through `? super Integer`.

## Pitfalls

- **Raw types.** `List list = ...` disables checking; always give a type argument, or use
  `List<?>` when you truly don't care.
- **Ignoring "unchecked" warnings.** Each one is a place where a `ClassCastException` can
  appear later. Fix it, or suppress it on the smallest scope with a comment saying why it's safe.
- **Mixing arrays and generics.** `T[]` and arrays of generic types fight with erasure; prefer
  `List<T>`.
- **`List<Object>` as "a list of anything".** It doesn't accept a `List<String>`; use `List<?>`
  or a type parameter.
- **Wildcards in return types.** They push the awkwardness onto every caller; use them on
  parameters.

## When to use what

| Need | Use |
| --- | --- |
| A container or helper that works for any type | A type parameter `<T>` |
| Call methods of `T` (for example `compareTo`) | A bounded parameter `<T extends Comparable<? super T>>` |
| A parameter you only read from | `? extends T` |
| A parameter you only write into | `? super T` |
| A parameter you both read and write | Plain `T` |
| Any list, when the element type doesn't matter | `List<?>` |
| The element type at run time | Pass `Class<T>` or a `Supplier<T>` |

## Further reading

- [The Java Tutorials: Generics](https://docs.oracle.com/javase/tutorial/java/generics/index.html)
- [The Java Tutorials: Type erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html)
- [The Java Tutorials: Wildcards guidelines](https://docs.oracle.com/javase/tutorial/java/generics/wildcardGuidelines.html)
