---
title: "equals, hashCode and comparing objects"
short_title: "Java equals, hashCode, Comparator"
topic: Core Java
date: 2026-11-16
tags: [java, equals, hashcode, comparable, comparator]
summary: The equals and hashCode contract, why breaking it makes objects vanish from HashMaps, and how to sort with Comparable and Comparator without subtle bugs.
catalog: equals-hashcode
series: core-java
priority: high
questions:
  - q: What is the contract between `equals` and `hashCode`?
    a: >-
      If two objects are equal according to `equals`, they must return the same `hashCode`.
      The reverse isn't required: unequal objects may share a hash code (a collision), it just
      makes hash tables slower. `equals` must also be reflexive, symmetric, transitive,
      consistent, and return `false` for `null`. Override both together or neither.
  - q: What goes wrong if you override `equals` but not `hashCode`?
    a: >-
      Two "equal" objects get different identity hash codes, so a `HashMap` or `HashSet` puts
      them in different buckets. A set can then hold duplicates, and `contains` or `get` with an
      equal object returns `false` or `null`, because the lookup checks the wrong bucket and
      never calls your `equals`.
  - q: How does `HashMap.get` find a value?
    a: >-
      It calls the key's `hashCode()`, mixes the bits and uses them to pick a bucket. Within that
      bucket it compares hash codes, then calls `equals` to find the matching key. A good
      `hashCode` spreads keys across buckets; `equals` settles ties. Since Java 8 a bucket with
      many colliding keys is turned into a small balanced tree.
  - q: Why shouldn't you use mutable objects as `HashMap` keys?
    a: >-
      The map files the entry under the key's hash code at the time it's stored. If a field
      used in `hashCode` changes afterwards, lookups go to a different bucket and the entry
      can't be found, by the new value or the old one. It still takes up space. Keys should be
      immutable: `String`, `Integer`, records with immutable fields.
  - q: What is the difference between `Comparable` and `Comparator`?
    a: >-
      `Comparable` is implemented by the class itself and defines its single *natural order*
      (`compareTo`), as `String` and `Integer` do. A `Comparator` is a separate object that
      defines an order from outside the class, so you can have as many as you like (by salary,
      by name, reversed). `Comparator.comparing(...).thenComparing(...)` builds them readably.
  - q: What does "`compareTo` consistent with `equals`" mean, and why does it matter?
    a: >-
      It means `a.compareTo(b) == 0` exactly when `a.equals(b)`. Sorted collections such as
      `TreeSet` and `TreeMap` use `compareTo` to decide equality, while hash collections use
      `equals`. If the two disagree, the same values behave differently: `BigDecimal` `1.0` and
      `1.00` are two elements in a `HashSet` but one in a `TreeSet`.
  - q: Two objects are equal by `equals`. What must be true of their hash codes?
    options:
      - "They must be equal"
      - "They must be different"
      - "Nothing; hash codes are unrelated to equals"
      - "They must both be zero"
    correct: 1
    a: >-
      Equal objects must have equal hash codes, or hash-based collections break. Unequal objects
      may still collide.
  - q: "Why is `(a, b) -> a - b` a bad comparator for `int` values?"
    options:
      - "The subtraction can overflow and give the wrong sign"
      - "It sorts in descending order"
      - "Lambdas can't be comparators"
      - "It's slower than Integer.compare"
    correct: 1
    a: >-
      For large values of opposite signs, `a - b` overflows: `Integer.MIN_VALUE - 1` is a large
      positive number, so the minimum sorts as the biggest. Use `Integer.compare(a, b)` or
      `Comparator.comparingInt(...)`.
  - q: "`new BigDecimal(\"1.0\")` and `new BigDecimal(\"1.00\")` go into a `TreeSet`. Its size is?"
    options:
      - "1, because `compareTo` says they're equal"
      - "2, because `equals` says they differ"
      - "0"
      - "It throws ClassCastException"
    correct: 1
    a: >-
      `TreeSet` uses `compareTo`, which ignores scale, so it keeps one. A `HashSet` uses
      `equals`, which compares scale too, so it keeps both.
  - q: What do you get for free when you declare a `record`?
    options:
      - "`equals`, `hashCode` and `toString` based on all its components"
      - "Only `toString`"
      - "A natural order (`Comparable`)"
      - "Nothing; you must write them"
    correct: 1
    a: >-
      Records generate `equals`, `hashCode` and `toString` from their components, plus accessors
      and a constructor. They don't implement `Comparable` unless you add it.
---

## The idea

Java has two kinds of "same". `==` asks **is this the same object?** `equals` asks **do these
two objects mean the same value?** For your own classes, `equals` inherited from `Object` is
just `==`, so you override it when two objects with the same data should count as equal.

The catch: `equals` never works alone. `HashMap`, `HashSet` and friends look at `hashCode`
**first**, so `equals` and `hashCode` must agree. Sorting adds a third method, `compareTo`,
which should agree with them too.

## How it works

### How a HashMap finds a key

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 270" role="img" aria-labelledby="hm-title hm-desc" data-routes='[{"pts": [[140, 60], [250, 60], [370, 60], [445, 60], [445, 140], [445, 200]], "cls": "hi", "w": 2}]'><title id="hm-title">How HashMap.get finds a key</title><desc id="hm-desc">The key's hashCode picks one bucket out of many. Only the keys in that bucket are compared with equals. If hashCode gives a different number for an equal key, the lookup searches the wrong bucket and equals is never called.</desc><defs><marker id="hm-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="hm-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="36" width="120" height="48" rx="9"/><text class="d-text" x="80" y="65" text-anchor="middle">get(key)</text><rect class="d-box hi" x="250" y="36" width="120" height="48" rx="9"/><text class="d-text" x="310" y="58" text-anchor="middle">hashCode()</text><text class="d-sub" x="310" y="75" text-anchor="middle">picks a bucket</text><line class="d-line hi" x1="140" y1="60" x2="248" y2="60" marker-end="url(#hm-ah-hi)"/><line class="d-line hi" x1="370" y1="60" x2="398" y2="60" marker-end="url(#hm-ah-hi)"/><text class="d-label" x="400" y="24">BUCKETS</text><rect class="d-box" x="400" y="36" width="44" height="48" rx="6"/><text class="d-sub" x="422" y="65" text-anchor="middle">0</text><rect class="d-box hi" x="450" y="36" width="44" height="48" rx="6"/><text class="d-sub" x="472" y="65" text-anchor="middle">1</text><rect class="d-box" x="500" y="36" width="44" height="48" rx="6"/><text class="d-sub" x="522" y="65" text-anchor="middle">2</text><rect class="d-box" x="550" y="36" width="44" height="48" rx="6"/><text class="d-sub" x="572" y="65" text-anchor="middle">3</text><rect class="d-box" x="600" y="36" width="44" height="48" rx="6"/><text class="d-sub" x="622" y="65" text-anchor="middle">…</text><line class="d-line hi" x1="472" y1="84" x2="472" y2="128" marker-end="url(#hm-ah-hi)"/><rect class="d-box" x="380" y="130" width="184" height="44" rx="9"/><text class="d-text" x="472" y="157" text-anchor="middle">entry A: equals? no</text><line class="d-line" x1="472" y1="174" x2="472" y2="194" marker-end="url(#hm-ah)"/><rect class="d-box hi" x="380" y="196" width="184" height="44" rx="9"/><text class="d-text" x="472" y="223" text-anchor="middle">entry B: equals? yes</text><text class="d-label" x="20" y="150">1. hashCode() narrows the search</text><text class="d-label" x="20" y="170">   to one bucket</text><text class="d-label" x="20" y="200">2. equals() checks only the keys</text><text class="d-label" x="20" y="220">   in that bucket</text><text class="d-label" x="590" y="226">found</text></svg>
<figcaption>A wrong <code>hashCode</code> sends the lookup to the wrong bucket, so your correct <code>equals</code> never even runs.</figcaption>
</figure>

### The rules for `equals`

| Rule | Meaning |
| --- | --- |
| Reflexive | `a.equals(a)` is `true` |
| Symmetric | `a.equals(b)` gives the same answer as `b.equals(a)` |
| Transitive | If `a` equals `b` and `b` equals `c`, then `a` equals `c` |
| Consistent | The same answer every time, while the fields don't change |
| Null | `a.equals(null)` is `false`, never an exception |
| With `hashCode` | Equal objects have equal hash codes |

A standard implementation, and what records generate for you:

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;                    // same object: quick yes
    if (!(o instanceof Point p)) return false;     // also handles null
    return x == p.x && y == p.y;                   // compare the fields that define the value
}

@Override
public int hashCode() {
    return Objects.hash(x, y);                     // the same fields as equals
}
```

`instanceof` lets subclasses count as equal, which can break symmetry if a subclass adds
fields. If that matters, compare `getClass() != o.getClass()` instead, or make the class
`final`. A `record Point(int x, int y)` gets a correct `equals`, `hashCode` and `toString`
automatically.

## In code: when the contract breaks

```java
import java.math.BigDecimal;
import java.util.*;

public class EqualsHashCode {
    // equals without hashCode: breaks every hash-based collection
    static class BadPoint {
        final int x, y;
        BadPoint(int x, int y) { this.x = x; this.y = y; }
        @Override public boolean equals(Object o) {
            return o instanceof BadPoint p && p.x == x && p.y == y;
        }
    }

    // Both, consistent: equal objects have equal hash codes
    static class Point {
        final int x, y;
        Point(int x, int y) { this.x = x; this.y = y; }
        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Point p)) return false;
            return x == p.x && y == p.y;
        }
        @Override public int hashCode() { return Objects.hash(x, y); }
    }

    // A record gets equals, hashCode and toString from its components
    record Coord(int x, int y) { }

    // A mutable key whose hash changes after it was stored
    static class Key {
        String name;
        Key(String name) { this.name = name; }
        @Override public boolean equals(Object o) { return o instanceof Key k && k.name.equals(name); }
        @Override public int hashCode() { return name.hashCode(); }
    }

    public static void main(String[] args) {
        BadPoint b1 = new BadPoint(1, 2), b2 = new BadPoint(1, 2);
        System.out.println("BadPoint equals:          " + b1.equals(b2));
        System.out.println("BadPoint set size:        " + new HashSet<>(List.of(b1, b2)).size());
        System.out.println("BadPoint found in set:    " + new HashSet<>(List.of(b1)).contains(b2));

        Point p1 = new Point(1, 2), p2 = new Point(1, 2);
        System.out.println("Point set size:           " + new HashSet<>(List.of(p1, p2)).size());
        System.out.println("Point found in set:       " + new HashSet<>(List.of(p1)).contains(p2));

        System.out.println("record equals:            " + new Coord(1, 2).equals(new Coord(1, 2)));
        System.out.println("record toString:          " + new Coord(1, 2));

        Map<Key, String> owners = new HashMap<>();
        Key key = new Key("alpha");
        owners.put(key, "Abhishek");
        key.name = "beta";                                   // mutate after storing
        System.out.println("mutated key get:          " + owners.get(key));
        System.out.println("original name get:        " + owners.get(new Key("alpha")));
        System.out.println("map still has 1 entry:    " + owners.size());

        // compareTo that disagrees with equals
        BigDecimal one = new BigDecimal("1.0"), oneAgain = new BigDecimal("1.00");
        System.out.println("1.0 equals 1.00:          " + one.equals(oneAgain));
        System.out.println("1.0 compareTo 1.00:       " + one.compareTo(oneAgain));
        System.out.println("HashSet size:             " + new HashSet<>(List.of(one, oneAgain)).size());
        System.out.println("TreeSet size:             " + new TreeSet<>(List.of(one, oneAgain)).size());
    }
}
```
{: .runnable}

```text
BadPoint equals:          true
BadPoint set size:        2
BadPoint found in set:    false
Point set size:           1
Point found in set:       true
record equals:            true
record toString:          Coord[x=1, y=2]
mutated key get:          null
original name get:        null
map still has 1 entry:    1
1.0 equals 1.00:          false
1.0 compareTo 1.00:       0
HashSet size:             2
TreeSet size:             1
```
{: .run-output}

- `BadPoint` overrides only `equals`, so two equal points land in different buckets: the set
  holds both and can't find one with the other.
- The mutated `Key` is lost: it's filed under the hash of `"alpha"`, but its `equals` now says
  `"beta"`. Neither name finds it, yet the map still counts it.
- `BigDecimal` compares scale in `equals` but not in `compareTo`, so hash and tree collections
  disagree.

### Sorting: `Comparable` and `Comparator`

```java
import java.util.*;

public class Sorting {
    record Employee(String name, String team, int salary) implements Comparable<Employee> {
        @Override public int compareTo(Employee other) {         // natural order: by name
            return name.compareTo(other.name);
        }
    }

    public static void main(String[] args) {
        List<Employee> staff = new ArrayList<>(List.of(
            new Employee("Meera", "payments", 120),
            new Employee("Arjun", "search", 140),
            new Employee("Kabir", "payments", 140),
            new Employee("Diya", "search", 110)));

        Collections.sort(staff);
        System.out.println("natural (name):      " + names(staff));

        staff.sort(Comparator.comparingInt(Employee::salary).reversed()
                .thenComparing(Employee::name));
        System.out.println("salary desc, name:   " + names(staff));

        staff.sort(Comparator.comparing(Employee::team).thenComparing(Employee::salary));
        System.out.println("team, then salary:   " + names(staff));

        // Subtraction as a comparator overflows for large values
        Comparator<Integer> bySubtraction = (a, b) -> a - b;
        int bad = bySubtraction.compare(Integer.MIN_VALUE, 1);
        System.out.println("MIN_VALUE - 1 says:  " + (bad < 0 ? "smaller" : "bigger") + " (wrong)");
        System.out.println("Integer.compare:     " + (Integer.compare(Integer.MIN_VALUE, 1) < 0 ? "smaller" : "bigger"));

        List<String> words = new ArrayList<>(Arrays.asList("banana", null, "Apple", "cherry"));
        words.sort(Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        System.out.println("nulls last, no case: " + words);
    }

    static List<String> names(List<Employee> list) {
        return list.stream().map(Employee::name).toList();
    }
}
```
{: .runnable}

```text
natural (name):      [Arjun, Diya, Kabir, Meera]
salary desc, name:   [Arjun, Kabir, Meera, Diya]
team, then salary:   [Meera, Kabir, Diya, Arjun]
MIN_VALUE - 1 says:  bigger (wrong)
Integer.compare:     smaller
nulls last, no case: [Apple, banana, cherry, null]
```
{: .run-output}

`compareTo` and `compare` return a negative number, zero, or a positive number. Only the sign
matters, so never compute it by subtracting: build comparators with `Integer.compare`,
`Comparator.comparingInt` and `thenComparing`.

## Pitfalls

- **Overriding `equals` without `hashCode`.** Hash collections quietly stop working.
- **Using different fields in `equals` and `hashCode`.** Use exactly the same ones.
- **Mutable keys.** Never change a field used in `hashCode` while the object is in a hash
  collection; better, make keys immutable.
- **`equals(Point other)` instead of `equals(Object o)`.** That's an overload, not an override,
  so collections never call it. `@Override` catches this.
- **Subtraction comparators.** They overflow; use `Integer.compare`.
- **`compareTo` inconsistent with `equals`** without saying so. Tree and hash collections then
  disagree about duplicates.
- **Comparing strings or wrappers with `==`.** See the earlier chapters: use `equals`.

## When to use what

| Need | Use |
| --- | --- |
| A value class with equality by its fields | A `record`, or `equals` + `hashCode` with `Objects.hash` |
| Null-safe comparison of two references | `Objects.equals(a, b)` |
| One obvious order for a type | `implements Comparable<T>` |
| Several orders, or an order for a class you don't own | `Comparator.comparing(...).thenComparing(...)` |
| Sorting with `null` values | `Comparator.nullsFirst(...)` or `nullsLast(...)` |
| A sorted set or map | `TreeSet` / `TreeMap`, with `compareTo` consistent with `equals` |

## Further reading

- [`Object.equals` and `Object.hashCode` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html#equals(java.lang.Object))
- [`Comparator` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html)
- [`Comparable` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Comparable.html)
