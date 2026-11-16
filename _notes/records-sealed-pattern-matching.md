---
title: "Records, sealed types and pattern matching"
short_title: "Java records, sealed types, patterns"
topic: Core Java
date: 2026-11-16
tags: [java, records, sealed, pattern-matching, java-21]
summary: Modern Java's data-oriented toolkit, from records as value carriers and sealed hierarchies that list their subtypes, to switch with patterns that the compiler checks for completeness.
catalog: modern-java
series: core-java
priority: high
questions:
  - q: What is a record, and what does it give you?
    a: >-
      A class declared by its components, `record Money(long cents, String currency)`. The
      compiler generates private final fields, a canonical constructor, an accessor per
      component (`cents()`, not `getCents()`), and `equals`, `hashCode` and `toString` based on
      all components. Records are implicitly `final` and can't extend other classes, but can
      implement interfaces and add methods and static members.
  - q: How do you validate a record's data?
    a: >-
      With a compact constructor: `Money { if (cents < 0) throw ...; }`. It has no parameter
      list; it runs before the fields are assigned, and you can reassign the parameters to
      normalise them, for example `members = List.copyOf(members);` to make a defensive copy.
  - q: Are records immutable?
    a: >-
      Shallowly. The fields are final, so a record always refers to the same objects, but if a
      component is a mutable object, such as an `ArrayList`, its contents can still change. Copy
      mutable components in the compact constructor (`List.copyOf`) to make the record truly
      immutable.
  - q: What are sealed classes and interfaces for?
    a: >-
      `sealed interface Shape permits Circle, Rect, Square` declares the complete list of direct
      subtypes. Any other class trying to implement it doesn't compile. That lets the compiler
      check that a `switch` over a `Shape` handles every case, so adding a new subtype turns
      every incomplete `switch` into a compile error instead of a runtime surprise. Each
      permitted subtype must be `final`, `sealed` or `non-sealed`; records are already final.
  - q: What does pattern matching for `switch` (Java 21) add?
    a: >-
      A `case` can test a type and bind a variable at once (`case Circle c ->`), deconstruct a
      record (`case Rect(double w, double h) ->`), add a condition (`case Integer i when i < 0`),
      and handle `null` explicitly (`case null`). Over a sealed type, the compiler checks the
      cases are exhaustive, so no `default` is needed.
  - q: What is the difference between a switch statement and a switch expression?
    a: >-
      A switch expression produces a value (`String kind = switch (day) { ... };`), uses `->`
      cases that don't fall through, must be exhaustive, and uses `yield` to return a value from
      a block. The classic statement form with `case X:` falls through to the next case unless
      you `break`, which is a common source of bugs.
  - q: What is the accessor method for a record component named `currency`?
    options:
      - "`currency()`"
      - "`getCurrency()`"
      - "`currency` (a public field)"
      - "There is none; records only have `toString`"
    correct: 1
    a: >-
      Records use the component name as the accessor name. The field itself is private and final.
  - q: "A `switch` over a sealed interface with three permitted records handles only two of them, and has no `default`. What happens?"
    options:
      - "It doesn't compile: the switch doesn't cover all possible values"
      - "It throws `MatchException` for the third"
      - "It returns `null` for the third"
      - "It compiles with a warning"
    correct: 1
    a: >-
      Exhaustiveness is checked at compile time for switch expressions and pattern switches. That's
      the point of sealing: adding a subtype shows you every switch that needs updating.
  - q: "`record Team(String name, List<String> members)` gets an `ArrayList` that the caller later changes. What protects the record?"
    options:
      - "`members = List.copyOf(members);` in a compact constructor"
      - "Nothing is needed; records are deeply immutable"
      - "Declaring the record `final`"
      - "Making `members` a `var`"
    correct: 1
    a: >-
      The record's field is final but would still point at the caller's list. Copying into an
      unmodifiable list in the compact constructor breaks that link.
  - q: "In `case Integer i when i < 0 -> ...`, what is `when i < 0`?"
    options:
      - "A guard: the case matches only if the condition is true"
      - "A type check"
      - "A loop condition"
      - "A comment"
    correct: 1
    a: >-
      A guarded pattern adds a boolean condition after the pattern. Order matters: put more
      specific guarded cases before the general `case Integer i`.
---

## The idea

For years Java modelled data with classes full of boilerplate: fields, constructor, getters,
`equals`, `hashCode`, `toString`. Java 14 to 21 added a toolkit for **data-oriented
programming**:

- **Records** say "this is just data" in one line.
- **Sealed** types say "and these are all the kinds there are".
- **Pattern matching** lets `switch` and `instanceof` take data apart safely, with the compiler
  checking you handled every kind.

| Feature | Final in |
| --- | --- |
| Switch expressions | Java 14 |
| Text blocks | Java 15 |
| Records, pattern matching for `instanceof` | Java 16 |
| Sealed classes | Java 17 |
| Pattern matching for `switch`, record patterns | Java 21 |

## How it works

### Records

```java
record Money(long cents, String currency) {
    Money {                                     // compact constructor: validate and normalise
        if (cents < 0) throw new IllegalArgumentException("negative amount: " + cents);
        Objects.requireNonNull(currency, "currency");
    }
    Money plus(Money other) { return new Money(cents + other.cents, currency); }
}
```

That one declaration gives you private final fields, a constructor, the accessors `cents()` and
`currency()`, and value-based `equals`, `hashCode` and `toString`. A record can implement
interfaces and add methods, but can't extend a class or declare extra instance fields.

### Sealed hierarchies and exhaustive switches

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 240" role="img" aria-labelledby="sl-title sl-desc"><title id="sl-title">A sealed interface and an exhaustive switch</title><desc id="sl-desc">The sealed interface Shape permits exactly three records: Circle, Rect and Square. A switch over Shape with a case for each of the three compiles without a default. If a fourth shape is added to the permits list, every switch that doesn't handle it stops compiling until it does.</desc><defs><marker id="sl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box hi" x="230" y="14" width="300" height="48" rx="10"/><text class="d-text" x="380" y="36" text-anchor="middle">sealed interface Shape</text><text class="d-sub" x="380" y="53" text-anchor="middle">permits Circle, Rect, Square</text><rect class="d-box" x="40" y="104" width="180" height="44" rx="9"/><text class="d-text" x="130" y="131" text-anchor="middle">record Circle(radius)</text><rect class="d-box" x="290" y="104" width="180" height="44" rx="9"/><text class="d-text" x="380" y="131" text-anchor="middle">record Rect(w, h)</text><rect class="d-box" x="540" y="104" width="180" height="44" rx="9"/><text class="d-text" x="630" y="131" text-anchor="middle">record Square(side)</text><line class="d-line" x1="130" y1="104" x2="300" y2="64" marker-end="url(#sl-ah)"/><line class="d-line" x1="380" y1="104" x2="380" y2="64" marker-end="url(#sl-ah)"/><line class="d-line" x1="630" y1="104" x2="460" y2="64" marker-end="url(#sl-ah)"/><text class="d-label" x="40" y="180">switch (shape) { case Circle c -&gt; … case Rect(double w, double h) -&gt; … case Square s -&gt; … }</text><text class="d-label hi" x="40" y="202">all three handled: compiles, no default needed</text><text class="d-label warn" x="40" y="224">add a Triangle to permits: every switch missing it stops compiling</text></svg>
<figcaption>Sealing turns "did I handle every kind?" from a code-review question into a compiler check.</figcaption>
</figure>

### Patterns

| Pattern | Example | Matches when |
| --- | --- | --- |
| Type pattern | `case Circle c ->` | The value is a `Circle`; binds it to `c` |
| Record pattern | `case Rect(double w, double h) ->` | It's a `Rect`; binds its components |
| Guarded pattern | `case Integer i when i < 0 ->` | It's an `Integer` and the condition holds |
| `null` | `case null ->` | The value is `null` (otherwise `switch` throws) |
| `instanceof` pattern | `if (o instanceof String s && !s.isBlank())` | Same idea outside a `switch` |

## In code: modern Java in one program

```java
import java.util.*;

public class ModernJava {
    // A record: a transparent carrier for data, with validation in a compact constructor
    record Money(long cents, String currency) {
        Money {
            if (cents < 0) throw new IllegalArgumentException("negative amount: " + cents);
            Objects.requireNonNull(currency, "currency");
        }
        Money plus(Money other) { return new Money(cents + other.cents, currency); }
    }

    // Records are shallowly immutable: copy mutable components
    record Team(String name, List<String> members) {
        Team { members = List.copyOf(members); }
    }

    // A sealed hierarchy: the compiler knows every possible subtype
    sealed interface Shape permits Circle, Rect, Square { }
    record Circle(double radius) implements Shape { }
    record Rect(double width, double height) implements Shape { }
    record Square(double side) implements Shape { }

    // Pattern matching for switch (Java 21): exhaustive, no default needed
    static double area(Shape shape) {
        return switch (shape) {
            case Circle c -> Math.PI * c.radius() * c.radius();
            case Rect(double w, double h) -> w * h;          // record pattern: deconstruct
            case Square s -> s.side() * s.side();
        };
    }

    static String describe(Object o) {
        return switch (o) {
            case null -> "null";
            case Integer i when i < 0 -> "negative int " + i;  // guarded pattern
            case Integer i -> "int " + i;
            case String s when s.isBlank() -> "blank string";
            case String s -> "string of length " + s.length();
            case Shape s -> "a shape with area %.1f".formatted(area(s));
            default -> "something else: " + o.getClass().getSimpleName();
        };
    }

    public static void main(String[] args) {
        Money a = new Money(1050, "INR"), b = new Money(1050, "INR");
        System.out.println("record toString: " + a);
        System.out.println("equals by value: " + a.equals(b) + ", accessor: " + a.cents());
        System.out.println("plus:            " + a.plus(new Money(250, "INR")));
        try {
            new Money(-5, "INR");
        } catch (IllegalArgumentException e) {
            System.out.println("validation:      " + e.getMessage());
        }

        List<String> people = new ArrayList<>(List.of("Diya", "Kabir"));
        Team team = new Team("payments", people);
        people.add("Intruder");                               // doesn't leak into the record
        System.out.println("defensive copy:  " + team.members());

        for (Object o : new Object[] {-3, 42, "  ", "hello", new Rect(2, 3), new Circle(1), 3.5, null}) {
            System.out.println("describe:        " + describe(o));
        }

        // instanceof with a pattern and a record pattern
        Object shape = new Rect(4, 5);
        if (shape instanceof Rect(double w, double h) && w != h) {
            System.out.println("instanceof:      a " + w + " x " + h + " rectangle");
        }

        // A switch expression with yield
        int day = 6;
        String kind = switch (day) {
            case 6, 7 -> "weekend";
            default -> {
                String d = "weekday";
                yield d;
            }
        };
        System.out.println("switch yield:    " + kind);

        // var: the type is inferred, still static
        var totals = new HashMap<String, Integer>();
        totals.merge("INR", 1050, Integer::sum);
        System.out.println("var:             " + totals.getClass().getSimpleName() + " " + totals);
    }
}
```
{: .runnable}

```text
record toString: Money[cents=1050, currency=INR]
equals by value: true, accessor: 1050
plus:            Money[cents=1300, currency=INR]
validation:      negative amount: -5
defensive copy:  [Diya, Kabir]
describe:        negative int -3
describe:        int 42
describe:        blank string
describe:        string of length 5
describe:        a shape with area 6.0
describe:        a shape with area 3.1
describe:        something else: Double
describe:        null
instanceof:      a 4.0 x 5.0 rectangle
switch yield:    weekend
var:             HashMap {INR=1050}
```
{: .run-output}

- The compact constructor rejected the negative amount, and `List.copyOf` kept "Intruder" out of
  the team.
- `describe` checks guarded cases before the general ones: `-3` matched `when i < 0`.
- `area` has no `default`: the compiler knows `Shape` has exactly three kinds.

## Pitfalls

- **Assuming records are deeply immutable.** Copy mutable components in the compact constructor.
- **Records for entities with identity and lifecycle** (such as a JPA entity that changes over
  time). Records suit values: money, coordinates, DTOs, results.
- **A `default` branch on a sealed switch.** It silences the compiler check you sealed the type
  for; list the cases instead.
- **Putting a general case before a guarded one.** `case Integer i` first makes
  `case Integer i when i < 0` unreachable, which is a compile error.
- **Forgetting `case null`.** A pattern switch without it throws `NullPointerException` for `null`.
- **`var` where the type matters to the reader.** `var` is fine for `var orders = new ArrayList<Order>()`,
  less so for `var x = service.process()`.

## When to use what

| Need | Use |
| --- | --- |
| A value object: DTO, money, point, result | A record |
| A fixed set of variants, each with its own data | A sealed interface with records |
| A fixed set of variants with no data | An `enum` |
| Logic that depends on which variant you have | A pattern `switch` over the sealed type |
| Check a type and use it | `instanceof` with a pattern |
| A switch that produces a value | A switch expression with `->` |

## Further reading

- [JEP 395: Records](https://openjdk.org/jeps/395)
- [JEP 409: Sealed classes](https://openjdk.org/jeps/409)
- [JEP 441: Pattern matching for switch](https://openjdk.org/jeps/441)
- [JEP 440: Record patterns](https://openjdk.org/jeps/440)
