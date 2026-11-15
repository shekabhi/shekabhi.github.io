---
title: "Primitives, wrappers and autoboxing"
short_title: "Java primitives, wrappers, autoboxing"
topic: Core Java
date: 2026-11-15
tags: [java, primitives, autoboxing, numbers]
summary: The eight primitive types, their wrapper classes, what autoboxing really compiles to, and the traps it hides.
catalog: types-wrappers
series: core-java
priority: high
questions:
  - q: What are the eight primitive types, and why does Java have them?
    a: >-
      `byte` (8 bits), `short` (16), `int` (32), `long` (64), `float` (32), `double` (64),
      `char` (16-bit unsigned UTF-16 code unit) and `boolean`. Primitives hold the value
      directly, with no object header and no garbage collection, so they are compact and fast.
      Wrapper classes (`Integer`, `Long`, ...) exist because generics and collections can only
      hold objects.
  - q: What is autoboxing, and what does the compiler turn it into?
    a: >-
      Autoboxing converts a primitive to its wrapper automatically, and unboxing goes back. The
      compiler inserts the calls for you: `Integer x = 5` becomes `Integer.valueOf(5)`, and
      `int y = x` becomes `x.intValue()`. Nothing happens at run time that you couldn't write
      by hand; the calls are just hidden.
  - q: Why does `Integer a = 127, b = 127; a == b` give `true`, but `128` gives `false`?
    a: >-
      `Integer.valueOf` returns cached objects for values from -128 to 127, so both variables
      point at the same object and `==` (which compares references) is true. For 128 each call
      creates a new object, so `==` is false. `Byte`, `Short`, `Long` and `Character` cache a
      similar range; `Float` and `Double` cache nothing. Always compare wrapper values with
      `equals()`, or unbox first.
  - q: When can autoboxing throw a `NullPointerException`?
    a: >-
      Whenever a `null` wrapper is unboxed: assigning it to a primitive, doing arithmetic with
      it, or comparing it with a primitive. A common hidden case is a ternary with one primitive
      branch, such as `Integer r = flag ? map.get(key) : 0;`. The whole expression has type
      `int`, so a `null` from the map is unboxed and throws.
  - q: Why should money not be stored in a `double`?
    a: >-
      `double` is binary floating point and can't represent most decimal fractions exactly:
      `0.1 + 0.2` prints `0.30000000000000004`. Rounding errors add up across calculations. Use
      `BigDecimal`, built from a `String` (`new BigDecimal("0.10")`), or store whole minor units
      such as cents in a `long`.
  - q: What happens when an `int` overflows?
    a: >-
      It wraps around silently: `Integer.MAX_VALUE + 1` is `Integer.MIN_VALUE`. No exception is
      thrown. Use `long` for values that can grow large, or `Math.addExact`,
      `Math.multiplyExact` and friends, which throw `ArithmeticException` on overflow.
  - q: "`Long.valueOf(1).equals(1)` returns what?"
    options:
      - "`false`, because `1` is boxed to an `Integer`, not a `Long`"
      - "`true`, because both values are 1"
      - "It doesn't compile"
      - "It throws `ClassCastException`"
    correct: 1
    a: >-
      The literal `1` is an `int`, so it is boxed to `Integer`. `Long.equals` returns `true` only
      for another `Long`. Write `1L`, or compare with `longValue()`.
  - q: "`List<Integer> list = new ArrayList<>(List.of(10, 20, 30)); list.remove(1);` leaves what?"
    options:
      - "`[10, 30]`: it removes the element at index 1"
      - "`[20, 30]`: it removes the first element"
      - "`[10, 20, 30]`: there is no element equal to 1"
      - "It throws `IndexOutOfBoundsException`"
    correct: 1
    a: >-
      `remove(int index)` is an exact match for an `int` argument, so the compiler picks it over
      `remove(Object)`, which would need boxing. To remove the value, pass an object:
      `list.remove(Integer.valueOf(10))`.
  - q: "What does `(byte) 200` evaluate to?"
    options:
      - "-56"
      - "200"
      - "127"
      - "It throws an exception"
    correct: 1
    a: >-
      A narrowing cast keeps only the low 8 bits. 200 is `11001000` in binary, which as a signed
      byte is -56. Narrowing casts never throw; they quietly drop bits.
  - q: Which of these compares two `Integer` objects by value safely?
    options:
      - "`a.equals(b)`"
      - "`a == b`"
      - "`a.hashCode() == b.hashCode()` only"
      - "`a.toString() == b.toString()`"
    correct: 1
    a: >-
      `equals` compares the values. `==` compares references and only seems to work for small
      cached values. `Objects.equals(a, b)` also handles `null`.
---

## The idea

Java has two kinds of values. **Primitives** (`int`, `double`, `boolean`, ...) hold the value
itself. **Objects** are reached through a reference. Each primitive has a **wrapper class**
(`Integer`, `Double`, `Boolean`, ...) so that numbers can be used where an object is needed,
for example in a `List<Integer>`.

**Autoboxing** converts between the two automatically. It saves typing, but it hides object
creation, `null` checks and reference comparisons, which is where the surprises come from.

## How it works

### The eight primitives

| Type | Size | Range or values | Default (fields, arrays) | Wrapper |
| --- | --- | --- | --- | --- |
| `byte` | 8 bits | -128 to 127 | `0` | `Byte` |
| `short` | 16 bits | -32,768 to 32,767 | `0` | `Short` |
| `int` | 32 bits | about ±2.1 billion | `0` | `Integer` |
| `long` | 64 bits | about ±9.2 × 10<sup>18</sup> | `0L` | `Long` |
| `float` | 32 bits | about 7 significant digits | `0.0f` | `Float` |
| `double` | 64 bits | about 15–16 significant digits | `0.0` | `Double` |
| `char` | 16 bits | one UTF-16 code unit, `'\u0000'` to `'￿'` | `'\u0000'` | `Character` |
| `boolean` | not specified | `true` or `false` | `false` | `Boolean` |

Local variables have no default; the compiler makes you assign them before use.

### What autoboxing compiles to

```java
Integer boxed = 5;          // compiled as Integer.valueOf(5)
int plain = boxed;          // compiled as boxed.intValue()
List<Integer> ids = new ArrayList<>();
ids.add(42);                // compiled as ids.add(Integer.valueOf(42))
```

`javap -c` shows the calls the compiler added:

```text
invokestatic  java/lang/Integer.valueOf:(I)Ljava/lang/Integer;
invokevirtual java/lang/Integer.intValue:()I
```

The wrapper constructors such as `new Integer(5)` are deprecated for removal; always use
`valueOf`, or let autoboxing call it.

### The wrapper cache

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 260" role="img" aria-labelledby="ic-title ic-desc"><title id="ic-title">The Integer cache</title><desc id="ic-desc">Two calls to Integer.valueOf(127) both return the same cached object, so == is true. Two calls to Integer.valueOf(128) each create a new object on the heap, so == is false even though equals is true.</desc><defs><marker id="ic-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ic-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="30" width="190" height="44" rx="9"/><text class="d-text" x="115" y="57" text-anchor="middle">a = valueOf(127)</text><rect class="d-box" x="20" y="90" width="190" height="44" rx="9"/><text class="d-text" x="115" y="117" text-anchor="middle">b = valueOf(127)</text><rect class="d-box" x="20" y="160" width="190" height="44" rx="9"/><text class="d-text" x="115" y="187" text-anchor="middle">c = valueOf(128)</text><rect class="d-box" x="20" y="210" width="190" height="44" rx="9"/><text class="d-text" x="115" y="237" text-anchor="middle">d = valueOf(128)</text><rect class="d-box hi" x="330" y="40" width="190" height="84" rx="10"/><text class="d-text" x="425" y="74" text-anchor="middle">Integer 127</text><text class="d-sub" x="425" y="96" text-anchor="middle">from the cache (-128…127)</text><line class="d-line hi" x1="210" y1="52" x2="328" y2="70" marker-end="url(#ic-ah-hi)"/><line class="d-line hi" x1="210" y1="112" x2="328" y2="96" marker-end="url(#ic-ah-hi)"/><rect class="d-box" x="330" y="160" width="190" height="44" rx="9"/><text class="d-text" x="425" y="187" text-anchor="middle">new Integer 128</text><rect class="d-box" x="330" y="210" width="190" height="44" rx="9"/><text class="d-text" x="425" y="237" text-anchor="middle">new Integer 128</text><line class="d-line" x1="210" y1="182" x2="328" y2="182" marker-end="url(#ic-ah)"/><line class="d-line" x1="210" y1="232" x2="328" y2="232" marker-end="url(#ic-ah)"/><text class="d-label hi" x="560" y="78">a == b → true</text><text class="d-label hi" x="560" y="96">same object</text><text class="d-label" x="560" y="200">c == d → false</text><text class="d-label" x="560" y="218">two objects</text><text class="d-label" x="560" y="236">c.equals(d) → true</text></svg>
<figcaption><code>==</code> on wrappers compares references. It only looks right for small values because those come from a cache.</figcaption>
</figure>

| Wrapper | Cached values |
| --- | --- |
| `Integer` | -128 to 127 (the upper bound can be raised with `-XX:AutoBoxCacheMax`) |
| `Byte`, `Short`, `Long` | -128 to 127 |
| `Character` | 0 to 127 |
| `Boolean` | `TRUE` and `FALSE` |
| `Float`, `Double` | none |

Because the upper bound is configurable, code that relies on `==` can even behave differently
between environments. Compare wrappers with `equals()`.

### Mixing primitives and wrappers

When one side of `==` or an arithmetic operator is a primitive, the wrapper is **unboxed**:
`Integer c = 128; c == 128` is `true`, because it compares two `int`s. If the wrapper is
`null`, unboxing throws `NullPointerException`.

### Number traps

```java
Integer.MAX_VALUE + 1          // -2147483648: int overflow wraps silently
Math.addExact(Integer.MAX_VALUE, 1)   // throws ArithmeticException: integer overflow
0.1 + 0.2                      // 0.30000000000000004
new BigDecimal(0.1)            // 0.1000000000000000055511151231257827...
new BigDecimal("0.1").add(new BigDecimal("0.2"))   // 0.3
(byte) 200                     // -56: narrowing keeps the low 8 bits
'a' + 1                        // 98: char arithmetic gives an int
-7 / 2                         // -3: integer division rounds toward zero
-7 % 2                         // -1: the remainder takes the sign of the dividend
Math.floorMod(-7, 2)           // 1
1 / 0                          // throws ArithmeticException: / by zero
1 / 0.0                        // Infinity
Double.NaN == Double.NaN       // false
```

Widening isn't always safe either: `long` to `float` or `double`, and `int` to `float`, can lose
precision. `(int) (float) 16_777_217` gives `16777216`.

Compound assignment casts for you: `byte b = 10; b += 300;` compiles and gives `54`, while
`b = b + 300` doesn't compile.

## In code: the hidden unboxing

```java
Map<String, Integer> stock = new HashMap<>();

// 1. A ternary with a primitive branch has type int, so null is unboxed
boolean known = true;
Integer count = known ? stock.get("pens") : 0;   // NullPointerException

// Fix: keep both branches as Integer, or use getOrDefault
Integer safe = stock.getOrDefault("pens", 0);

// 2. Overload choice: remove(int index) wins over remove(Object)
List<Integer> ids = new ArrayList<>(List.of(10, 20, 30));
ids.remove(1);                     // removes index 1 → [10, 30]
ids.remove(Integer.valueOf(10));   // removes the value 10 → [30]

// 3. Different wrapper types are never equal
Long.valueOf(1).equals(1);         // false: 1 is boxed to Integer
Long.valueOf(1).equals(1L);        // true
```

## Pitfalls

- **Comparing wrappers with `==`.** It works in tests with small numbers and fails in
  production with large ones.
- **Unboxing `null`.** Values from maps, JSON or the database are often `null`; unboxing them
  throws. Use primitives only when a value can't be missing.
- **Boxing in hot loops.** `Long total = 0L; for (...) total += x;` creates a new `Long` on
  almost every iteration. Use a primitive `long`.
- **Money in `double`.** Use `BigDecimal` from a `String`, or a `long` count of cents.
- **Silent overflow.** IDs, counters and timestamps in milliseconds outgrow `int`. Use `long`,
  or the `Math.*Exact` methods.
- **`new BigDecimal(0.1)`.** It captures the binary error of the `double`. Use
  `new BigDecimal("0.1")` or `BigDecimal.valueOf(0.1)`.

## When to use what

| Need | Use |
| --- | --- |
| A number that is always present, used in calculations | A primitive (`int`, `long`, `double`) |
| A number that may be missing (`null` means unknown) | A wrapper (`Integer`, `Long`), handled with care |
| Numbers in a collection or as a generic type | A wrapper, or a primitive stream (`IntStream`, `LongStream`) |
| Money and exact decimals | `BigDecimal` from a `String`, or `long` cents |
| Very large integers | `long`, then `BigInteger` |
| Comparing two wrappers | `equals()` or `Objects.equals(a, b)` |

## Further reading

- [Java Language Specification, Java SE 21: Boxing and unboxing conversion](https://docs.oracle.com/javase/specs/jls/se21/html/jls-5.html#jls-5.1.7)
- [`Integer` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html)
- [`BigDecimal` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/math/BigDecimal.html)
