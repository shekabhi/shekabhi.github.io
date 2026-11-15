---
title: "Strings, the string pool and StringBuilder"
short_title: "Java strings, the pool, StringBuilder"
topic: Core Java
date: 2026-11-15
tags: [java, strings, string-pool, stringbuilder]
summary: Why strings are immutable, how the string pool works, when == lies, and how to build and split strings without surprises.
catalog: strings
series: core-java
priority: high
questions:
  - q: Why are Java strings immutable?
    a: >-
      Once created, a `String` never changes; methods like `toUpperCase()` return a new string.
      This makes strings safe to share between threads without locking, safe as `HashMap` keys
      (the hash can't change, so it's computed once and cached), and safe to pass around: a
      file path or URL that was checked can't be changed afterwards. It also makes the string
      pool possible, because shared instances can't be modified.
  - q: What is the string pool?
    a: >-
      A table of unique `String` instances kept by the JVM. Every string literal and
      compile-time constant is put there, so equal literals across the program share one
      object. `intern()` returns the pooled copy of any string. Since Java 7 the pool lives in
      the ordinary heap, so unused pooled strings can be garbage-collected.
  - q: What is the difference between `==` and `equals()` for strings?
    a: >-
      `==` checks whether two references point to the same object. `equals()` compares the
      characters. Two equal literals are often the same pooled object, so `==` can seem to
      work, but strings built at run time (from input, concatenation or `new String`) are
      separate objects. Always use `equals()` (or `equalsIgnoreCase()`).
  - q: When should you use `StringBuilder`?
    a: >-
      When building a string in pieces, especially in a loop. Each `+` in a loop creates a new
      `String`, copying everything so far. A `StringBuilder` appends into one growable buffer
      and makes a `String` once at the end with `toString()`. For a single expression like
      `"Hello " + name`, plain `+` is fine; the compiler optimises it.
  - q: What's the difference between `StringBuilder` and `StringBuffer`?
    a: >-
      They have the same API. `StringBuffer` is older and every method is `synchronized`;
      `StringBuilder` (Java 5) isn't, so it's faster. A builder is almost always used by one
      thread inside one method, so `StringBuilder` is the right default.
  - q: Why does `"a.b.c".split(".")` return an empty array?
    a: >-
      `split` takes a regular expression, and `.` means "any character". Every character is a
      separator, which leaves only empty strings, and `split` drops trailing empty strings,
      so nothing remains. Escape it: `split("\\.")`, or use `Pattern.quote(".")`.
  - q: "`String s1 = \"hello\"; String s3 = new String(\"hello\");` What is `s1 == s3`?"
    options:
      - "`false`: `new String` always creates a separate object"
      - "`true`: both have the same characters"
      - "`true`: `new String` returns the pooled instance"
      - "It doesn't compile"
    correct: 1
    a: >-
      `new` always creates a new object, so the references differ even though `s1.equals(s3)`
      is `true`. `s3.intern()` would return the pooled object, and then `==` would be `true`.
  - q: "`final String a = \"a\"; String b = \"a\";` Which is `true`?"
    options:
      - "`(a + \"b\") == \"ab\"`"
      - "`(b + \"b\") == \"ab\"`"
      - "Both"
      - "Neither"
    correct: 1
    a: >-
      `a` is a constant variable, so `a + "b"` is a compile-time constant: the compiler folds it
      to `"ab"`, which is the pooled literal. `b` is not final, so `b + "b"` is built at run
      time as a new object.
  - q: "`\"a,b,,\".split(\",\")` has how many elements?"
    options:
      - "2"
      - "4"
      - "3"
      - "It throws an exception"
    correct: 1
    a: >-
      `split` removes trailing empty strings, leaving `[a, b]`. Pass a negative limit to keep
      them: `"a,b,,".split(",", -1)` gives 4 elements.
  - q: "What does `\"😀\".length()` return?"
    options:
      - "2"
      - "1"
      - "4"
      - "It depends on the default charset"
    correct: 1
    a: >-
      `length()` counts UTF-16 code units. Characters outside the Basic Multilingual Plane, like
      most emoji, take two (a surrogate pair). Use `codePointCount(0, s.length())` to count
      characters as people see them.
---

## The idea

A `String` is an immutable sequence of characters. "Immutable" is the key word: no method ever
changes a string; they all return a new one. That one rule explains most of what's special
about strings in Java, from the **string pool** to why **`==` sometimes works and then
doesn't**, and why building strings in a loop calls for a **`StringBuilder`**.

## How it works

### Immutability

```java
String s = "hello";
s.toUpperCase();            // returns "HELLO", which is thrown away
System.out.println(s);      // hello
s = s.toUpperCase();        // now s points to the new string
```

`String` is a `final` class, so nobody can subclass it to add mutable behaviour. Since Java 9
strings store their characters in a `byte[]`: one byte per character when every character fits
in Latin-1 (*compact strings*), two bytes otherwise.

### The string pool

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 280" role="img" aria-labelledby="sp-title sp-desc"><title id="sp-title">The string pool</title><desc id="sp-desc">The variables s1 and s2, both assigned the literal "hello", point to the same String object in the string pool. The variable s3, assigned new String("hello"), points to a separate String object elsewhere on the heap. s1 == s2 is true; s1 == s3 is false; s1.equals(s3) is true.</desc><defs><marker id="sp-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="sp-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="24">VARIABLES</text><rect class="d-box" x="20" y="40" width="210" height="44" rx="9"/><text class="d-text" x="125" y="67" text-anchor="middle">s1 = "hello"</text><rect class="d-box" x="20" y="100" width="210" height="44" rx="9"/><text class="d-text" x="125" y="127" text-anchor="middle">s2 = "hello"</text><rect class="d-box" x="20" y="190" width="210" height="44" rx="9"/><text class="d-text" x="125" y="217" text-anchor="middle">s3 = new String("hello")</text><rect class="d-box" x="320" y="14" width="420" height="256" rx="12" style="fill:none;stroke-dasharray:6 5"/><text class="d-label" x="726" y="34" text-anchor="end">HEAP</text><rect class="d-box" x="340" y="44" width="250" height="104" rx="10" style="fill:none"/><text class="d-label hi" x="356" y="64">STRING POOL</text><rect class="d-box hi" x="380" y="76" width="170" height="54" rx="9"/><text class="d-text" x="465" y="108" text-anchor="middle">"hello"</text><rect class="d-box" x="380" y="196" width="170" height="54" rx="9"/><text class="d-text" x="465" y="222" text-anchor="middle">"hello"</text><text class="d-sub" x="465" y="240" text-anchor="middle">a separate object</text><line class="d-line hi" x1="230" y1="62" x2="378" y2="96" marker-end="url(#sp-ah-hi)"/><line class="d-line hi" x1="230" y1="122" x2="378" y2="110" marker-end="url(#sp-ah-hi)"/><line class="d-line" x1="230" y1="212" x2="378" y2="222" marker-end="url(#sp-ah)"/><text class="d-label hi" x="610" y="96">s1 == s2</text><text class="d-label hi" x="610" y="112">→ true</text><text class="d-label" x="610" y="214">s1 == s3 → false</text><text class="d-label" x="610" y="232">equals → true</text></svg>
<figcaption>Equal literals share one pooled object. <code>new String</code> always makes another one.</figcaption>
</figure>

```java
String s1 = "hello";
String s2 = "hello";
String s3 = new String("hello");

s1 == s2            // true: the same pooled object
s1 == s3            // false: new always creates an object
s1.equals(s3)       // true: same characters
s1 == s3.intern()   // true: intern() returns the pooled copy
```

The compiler also pools **compile-time constants**, including concatenations of literals and
`final` variables:

```java
String ab = "ab";
("a" + "b") == ab           // true: folded to "ab" by the compiler
final String fa = "a";
(fa + "b") == ab            // true: fa is a constant variable
String va = "a";
(va + "b") == ab            // false: built at run time, a new object
```

None of this matters if you always use `equals()`, which is the point: `==` gives answers that
depend on how the string was made.

### How `+` really works

Since Java 9, `javac` compiles a string concatenation into a single `invokedynamic` call
(`StringConcatFactory.makeConcatWithConstants`), and the JVM builds an efficient strategy for
it at run time. So one expression like `"Order " + id + " for " + name` is fine.

A loop is different: each iteration makes a new `String` and copies the old contents, so the
work grows with the square of the length.

```java
// Slow for many items: a new string, and a full copy, on every pass
String csv = "";
for (String item : items) csv += item + ",";

// One buffer, one final String
StringBuilder sb = new StringBuilder();
for (String item : items) sb.append(item).append(',');
if (!sb.isEmpty()) sb.setLength(sb.length() - 1);   // drop the last comma
String csv2 = sb.toString();

// Often simplest of all
String csv3 = String.join(",", items);
```

### Useful modern methods

| Method | Since | What it does |
| --- | --- | --- |
| `isBlank()` | Java 11 | `true` for empty or whitespace-only; `isEmpty()` is only for length 0 |
| `strip()` | Java 11 | Like `trim()`, but also removes Unicode spaces such as ` ` |
| `repeat(n)` | Java 11 | `"ab".repeat(3)` is `"ababab"` |
| `lines()` | Java 11 | A stream of the lines in a string |
| Text blocks `"""` | Java 15 | Multi-line strings without `\n` and escaped quotes |
| `formatted(...)` | Java 15 | `"%s has %d items".formatted("cart", 3)` |
| `String.join` | Java 8 | Joins with a separator |

```java
String json = """
    {
      "id": 42,
      "name": "Abhishek"
    }
    """;   // indentation up to the closing quotes is removed
```

### Characters, code points and bytes

A Java `char` is a 16-bit UTF-16 code unit, not always a whole character. Most emoji need two:

```java
"é".length()                                   // 1
"é".getBytes(StandardCharsets.UTF_8).length    // 2
"😀".length()                                  // 2: a surrogate pair
"😀".codePointCount(0, "😀".length())           // 1
```

Since Java 18 the default charset is UTF-8 everywhere. Still, name the charset when converting
between bytes and text (`StandardCharsets.UTF_8`) so the code doesn't depend on the platform.

## In code: string surprises

```java
import java.util.Arrays;

public class StringSurprises {
    public static void main(String[] args) {
        // The pool: equal literals share one object; new String doesn't
        String s1 = "hello", s2 = "hello", s3 = new String("hello");
        System.out.println("s1 == s2:          " + (s1 == s2));
        System.out.println("s1 == s3:          " + (s1 == s3));
        System.out.println("s1.equals(s3):     " + s1.equals(s3));
        System.out.println("s1 == s3.intern(): " + (s1 == s3.intern()));

        // Compile-time constants are folded and pooled; run-time concatenation isn't
        final String fa = "a";
        String va = "a";
        System.out.println("fa + \"b\" == \"ab\":  " + ((fa + "b") == "ab"));
        System.out.println("va + \"b\" == \"ab\":  " + ((va + "b") == "ab"));

        // split takes a regex, and drops trailing empty strings
        System.out.println("\"a.b.c\".split(\".\"):     " + Arrays.toString("a.b.c".split(".")));
        System.out.println("\"a.b.c\".split(\"\\\\.\"):   " + Arrays.toString("a.b.c".split("\\.")));
        System.out.println("\"a,b,,\".split(\",\"):     " + Arrays.toString("a,b,,".split(",")));
        System.out.println("\"a,b,,\".split(\",\", -1): " + Arrays.toString("a,b,,".split(",", -1)));

        // length() counts UTF-16 code units, not characters
        String emoji = "\uD83D\uDE00";   // 😀
        System.out.println("emoji length:      " + emoji.length());
        System.out.println("emoji code points: " + emoji.codePointCount(0, emoji.length()));
    }
}
```
{: .runnable}

```text
s1 == s2:          true
s1 == s3:          false
s1.equals(s3):     true
s1 == s3.intern(): true
fa + "b" == "ab":  true
va + "b" == "ab":  false
"a.b.c".split("."):     []
"a.b.c".split("\\."):   [a, b, c]
"a,b,,".split(","):     [a, b]
"a,b,,".split(",", -1): [a, b, , ]
emoji length:      2
emoji code points: 1
```
{: .run-output}

## Pitfalls

- **Comparing with `==`.** It may pass in a test with literals and fail with input from a
  request or a file. Use `equals`; to avoid a `NullPointerException`, put the known string
  first (`"admin".equals(role)`) or use `Objects.equals`.
- **Concatenating in a loop.** Use `StringBuilder`, `String.join` or `Collectors.joining`.
- **Forgetting that methods return new strings.** `s.trim();` on its own does nothing useful.
- **`split` with a regex character** (`.`, `|`, `$`, `*`, `+`, ...). Escape it or use
  `Pattern.quote`.
- **Counting characters with `length()`** in text that may contain emoji or other symbols
  outside the Basic Multilingual Plane.
- **Passwords in a `String`.** It can't be wiped and may stay in memory (and in heap dumps) for
  a while. APIs that handle secrets often take a `char[]` you can clear after use.

## When to use what

| Need | Use |
| --- | --- |
| Compare text | `equals`, `equalsIgnoreCase`, or `Objects.equals` when either side may be `null` |
| Order text | `compareTo`, or a `Collator` for language-aware sorting |
| Join a few values in one expression | `+` |
| Build a string in a loop | `StringBuilder` |
| Join a list with a separator | `String.join` or `Collectors.joining` |
| Format with placeholders | `formatted(...)` or `String.format` |
| Multi-line text, such as JSON or SQL | A text block |
| Shared mutable text across threads | Rarely needed; `StringBuffer` if you must |

## Further reading

- [`String` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html)
- [JEP 378: Text blocks](https://openjdk.org/jeps/378)
- [JEP 280: Indify string concatenation](https://openjdk.org/jeps/280)
- [JEP 400: UTF-8 by default](https://openjdk.org/jeps/400)
