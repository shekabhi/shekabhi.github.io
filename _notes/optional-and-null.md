---
title: "Optional and handling null"
short_title: "Java Optional and null"
topic: Core Java
date: 2026-11-16
tags: [java, optional, null, api-design]
summary: What Optional is for and what it isn't, chaining with map and flatMap, the orElse versus orElseGet trap, and simple null checks that need no Optional at all.
catalog: optional
series: core-java
priority: high
questions:
  - q: What is `Optional` for?
    a: >-
      A return type that says "this method may have no result". Instead of returning `null` and
      hoping the caller checks, `Optional<User> findUser(id)` forces the caller to decide what
      happens when the user is missing. It was designed for return values; it isn't a general
      replacement for every nullable variable.
  - q: What's the difference between `orElse` and `orElseGet`?
    a: >-
      `orElse(value)` takes an already-computed value, so its argument is evaluated every time,
      even when the `Optional` has a value. `orElseGet(supplier)` takes a lambda and calls it
      only when the `Optional` is empty. Use `orElseGet` when the default is expensive or has
      side effects (a database call, creating an object, logging).
  - q: What's the difference between `map` and `flatMap` on `Optional`?
    a: >-
      `map(f)` applies `f` to the value and wraps the result: if `f` returns `null`, you get an
      empty `Optional`. `flatMap(f)` is for functions that already return an `Optional`; it
      avoids ending up with `Optional<Optional<T>>`. Both do nothing on an empty `Optional`, so a
      chain of them stops quietly at the first missing value.
  - q: Where should you *not* use `Optional`?
    a: >-
      As a field (it isn't `Serializable`, and adds an object per field), as a method parameter
      (callers can still pass `null`, and overloads are clearer), inside collections (return an
      empty list instead), and for primitives (use `OptionalInt`, `OptionalLong`,
      `OptionalDouble`). And never return `null` from a method declared to return `Optional`.
  - q: Why is `Optional.get()` discouraged?
    a: >-
      It throws `NoSuchElementException` when the value is missing, which is just a
      `NullPointerException` with a different name. Use `orElse`, `orElseGet`, `orElseThrow`
      with a meaningful exception, `map`, or `ifPresentOrElse`. Since Java 10, `orElseThrow()`
      with no argument does what `get()` does but says so in its name.
  - q: How do you handle `null` without `Optional`?
    a: >-
      Validate inputs at the boundary with `Objects.requireNonNull(arg, "arg must not be null")`
      so the failure is immediate and named. Use `Objects.requireNonNullElse(value, fallback)` for
      defaults, `Objects.equals(a, b)` for null-safe comparison, and return empty collections
      instead of `null`. Since Java 14, NullPointerException messages name the null expression,
      which makes the rest easier to debug.
  - q: "A user exists. Which default is computed in `find().map(User::name).orElse(expensive())`?"
    options:
      - "`expensive()` runs anyway, because `orElse` takes a value"
      - "Nothing; `expensive()` is skipped"
      - "It depends on the JIT"
      - "It doesn't compile"
    correct: 1
    a: >-
      Java evaluates method arguments before calling the method, so `expensive()` runs before
      `orElse` even looks at the `Optional`. `orElseGet(this::expensive)` would skip it.
  - q: "What does `Optional.of(null)` do?"
    options:
      - "Throws `NullPointerException`"
      - "Returns an empty `Optional`"
      - "Returns an `Optional` containing `null`"
      - "It doesn't compile"
    correct: 1
    a: >-
      `Optional.of` requires a non-null value. Use `Optional.ofNullable(value)` when the value
      may be `null`; it returns `Optional.empty()` in that case.
  - q: "`Optional.of(user).map(User::email)` — the user's email is `null`. What is the result?"
    options:
      - "`Optional.empty()`"
      - "`Optional[null]`"
      - "It throws `NullPointerException`"
      - "The user, unchanged"
    correct: 1
    a: >-
      `map` wraps the function's result with `ofNullable`, so a `null` result becomes an empty
      `Optional`, and the rest of the chain is skipped.
  - q: Which is the best use of `Optional`?
    options:
      - "As the return type of a lookup that may find nothing"
      - "As the type of a field in an entity class"
      - "As a method parameter for optional arguments"
      - "As the element type of a list"
    correct: 1
    a: >-
      `Optional` was designed for return values. For fields use a nullable field with clear
      documentation; for parameters use overloads; for lists, return an empty list.
---

## The idea

Tony Hoare called `null` his "billion-dollar mistake": any reference can be missing, and nothing
in the type tells you which ones might be. `Optional<T>` is Java's way of putting
"might be missing" **into the type**, for one specific place: **a method's return value**.

`Optional` is a box that holds either one value or nothing. It's not magic and not meant for
everywhere; the rest of the time, plain checks with `Objects` do the job.

## How it works

### Creating and reading an Optional

| Method | Does |
| --- | --- |
| `Optional.of(value)` | Wraps a value; throws `NullPointerException` if it's `null` |
| `Optional.ofNullable(value)` | Wraps a value, or gives `empty()` for `null` |
| `Optional.empty()` | No value |
| `map(f)` | Transforms the value; empty stays empty (and a `null` result becomes empty) |
| `flatMap(f)` | Like `map`, for an `f` that returns an `Optional` |
| `filter(test)` | Keeps the value only if it passes |
| `orElse(x)` | The value, or `x` (always evaluated) |
| `orElseGet(() -> x)` | The value, or computes `x` only if empty |
| `orElseThrow(() -> ex)` | The value, or throws your exception |
| `ifPresent` / `ifPresentOrElse` | Runs code with the value, or without it |
| `isPresent()` / `isEmpty()` | Tests (`isEmpty` since Java 11) |
| `stream()` | A stream of zero or one element (Java 9+) |

### A chain that stops at the first gap

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 220" role="img" aria-labelledby="op-title op-desc" data-routes='[{"pts": [[150, 60], [300, 60], [470, 60], [640, 60]], "cls": "hi", "w": 2}, {"pts": [[150, 150], [300, 150], [640, 150]], "cls": "bad", "w": 1}]'><title id="op-title">An Optional chain with and without a value</title><desc id="op-desc">Top path: findUser for diya returns an Optional with a user; map to email gives an Optional with diya@example.com; map to the domain gives example.com; orElse returns example.com. Bottom path: findUser for an unknown id returns an empty Optional; each map is skipped; orElse returns the default, none.</desc><defs><marker id="op-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box hi" x="20" y="36" width="130" height="48" rx="9"/><text class="d-text" x="85" y="58" text-anchor="middle">findUser("diya")</text><text class="d-sub" x="85" y="75" text-anchor="middle">Optional[User]</text><rect class="d-box" x="300" y="36" width="170" height="48" rx="9"/><text class="d-text" x="385" y="58" text-anchor="middle">map(User::email)</text><text class="d-sub" x="385" y="75" text-anchor="middle">Optional[email]</text><rect class="d-box hi" x="580" y="36" width="160" height="48" rx="9"/><text class="d-text" x="660" y="58" text-anchor="middle">orElse("none")</text><text class="d-sub" x="660" y="75" text-anchor="middle">"example.com"</text><line class="d-line" x1="150" y1="60" x2="298" y2="60" marker-end="url(#op-ah)"/><line class="d-line" x1="470" y1="60" x2="578" y2="60" marker-end="url(#op-ah)"/><text class="d-label" x="525" y="50" text-anchor="middle">map(domain)</text><rect class="d-box warn" x="20" y="126" width="130" height="48" rx="9"/><text class="d-text" x="85" y="148" text-anchor="middle">findUser("zoya")</text><text class="d-sub" x="85" y="165" text-anchor="middle">Optional.empty</text><rect class="d-box" x="300" y="126" width="170" height="48" rx="9" style="stroke-dasharray:5 4"/><text class="d-sub" x="385" y="155" text-anchor="middle">map skipped</text><rect class="d-box warn" x="580" y="126" width="160" height="48" rx="9"/><text class="d-text" x="660" y="148" text-anchor="middle">orElse("none")</text><text class="d-sub" x="660" y="165" text-anchor="middle">"none"</text><line class="d-line" x1="150" y1="150" x2="298" y2="150" marker-end="url(#op-ah)"/><line class="d-line" x1="470" y1="150" x2="578" y2="150" marker-end="url(#op-ah)"/><text class="d-label" x="20" y="206">No if-null checks in between: an empty Optional passes through every map untouched.</text></svg>
<figcaption>With a value, each step transforms it. Without one, every step is skipped and the default is used at the end.</figcaption>
</figure>

## In code: Optional done right, and wrong

```java
import java.util.*;

public class Optionals {
    record User(String name, String email) { }

    static final Map<String, User> USERS = Map.of(
            "diya", new User("Diya", "diya@example.com"),
            "kabir", new User("Kabir", null));

    static Optional<User> findUser(String id) {
        return Optional.ofNullable(USERS.get(id));      // may be empty: say so in the type
    }

    static String expensiveDefault() {
        System.out.println("  (computing default)");
        return "guest";
    }

    public static void main(String[] args) {
        // map and flatMap chain through values that may be missing
        System.out.println("diya's domain:    " + findUser("diya")
                .map(User::email)
                .map(e -> e.substring(e.indexOf('@') + 1))
                .orElse("none"));
        System.out.println("kabir's email:    " + findUser("kabir").map(User::email).orElse("not set"));
        System.out.println("missing user:     " + findUser("zoya").map(User::name).orElse("no such user"));

        // orElse always evaluates its argument; orElseGet only when empty
        System.out.println("orElse, present:");
        String a = findUser("diya").map(User::name).orElse(expensiveDefault());
        System.out.println("orElseGet, present:");
        String b = findUser("diya").map(User::name).orElseGet(Optionals::expensiveDefault);
        System.out.println("results:          " + a + ", " + b);

        // filter, ifPresentOrElse, isEmpty
        findUser("diya").filter(u -> u.email() != null)
                .ifPresentOrElse(u -> System.out.println("mail to:          " + u.email()),
                                 () -> System.out.println("no email"));
        System.out.println("isEmpty:          " + findUser("zoya").isEmpty());

        // The ways to get it wrong
        try {
            Optional.of(null);
        } catch (NullPointerException e) {
            System.out.println("Optional.of(null): NullPointerException (use ofNullable)");
        }
        try {
            findUser("zoya").get();
        } catch (NoSuchElementException e) {
            System.out.println("get() on empty:   NoSuchElementException");
        }
        try {
            findUser("zoya").orElseThrow(() -> new IllegalArgumentException("unknown user zoya"));
        } catch (IllegalArgumentException e) {
            System.out.println("orElseThrow:      " + e.getMessage());
        }

        // Plain null handling without Optional
        String nickname = null;
        System.out.println("requireNonNullElse: " + Objects.requireNonNullElse(nickname, "friend"));
        try {
            Objects.requireNonNull(nickname, "nickname must not be null");
        } catch (NullPointerException e) {
            System.out.println("requireNonNull:   " + e.getMessage());
        }
    }
}
```
{: .runnable}

```text
diya's domain:    example.com
kabir's email:    not set
missing user:     no such user
orElse, present:
  (computing default)
orElseGet, present:
results:          Diya, Diya
mail to:          diya@example.com
isEmpty:          true
Optional.of(null): NullPointerException (use ofNullable)
get() on empty:   NoSuchElementException
orElseThrow:      unknown user zoya
requireNonNullElse: friend
requireNonNull:   nickname must not be null
```
{: .run-output}

- The chain of `map` calls needs no `null` checks; the missing user and the missing email both
  fall through to the default.
- `(computing default)` printed for `orElse` even though Diya exists: its argument was evaluated
  first. `orElseGet` skipped it.
- `Objects.requireNonNull` with a message fails fast and says what was wrong, which is often all
  you need.

## Pitfalls

- **Returning `null` from a method that returns `Optional`.** The worst of both worlds.
- **`isPresent()` then `get()`.** It's a `null` check with extra steps; use `map`, `orElse` or
  `ifPresentOrElse`.
- **`orElse(expensiveCall())`.** The call runs every time; use `orElseGet`.
- **`Optional` fields and parameters.** Use them for return values only.
- **`Optional<List<T>>`.** Return an empty list instead.
- **`Optional<Integer>`.** Use `OptionalInt` to avoid boxing.
- **Wrapping and unwrapping in a hot loop.** Each `Optional` is an object; a plain check can be
  clearer and cheaper inside a method.

## When to use what

| Situation | Use |
| --- | --- |
| A lookup that may find nothing | Return `Optional<T>` |
| A list or set that may have no elements | Return an empty collection |
| Reject `null` arguments | `Objects.requireNonNull(arg, "message")` at the start |
| A default for a possibly-null value | `Objects.requireNonNullElse(value, fallback)` |
| A default that is expensive to compute | `optional.orElseGet(() -> ...)` |
| A missing value is an error | `optional.orElseThrow(() -> new NotFoundException(...))` |
| Compare two possibly-null references | `Objects.equals(a, b)` |

## Further reading

- [`Optional` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Optional.html)
- [`Objects` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Objects.html)
