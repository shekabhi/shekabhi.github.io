---
title: "Exceptions and try-with-resources"
short_title: "Java exceptions, try-with-resources"
topic: Core Java
date: 2026-11-16
tags: [java, exceptions, try-with-resources, error-handling]
summary: Checked vs unchecked exceptions, what really runs in try, catch and finally, how try-with-resources closes things, and how to throw and wrap exceptions well.
catalog: exceptions
series: core-java
priority: high
questions:
  - q: What is the difference between checked and unchecked exceptions?
    a: >-
      **Checked** exceptions (subclasses of `Exception` but not `RuntimeException`, such as
      `IOException`) must be caught or declared with `throws`; the compiler enforces it. They
      model failures the caller can reasonably handle. **Unchecked** exceptions
      (`RuntimeException` and its subclasses, such as `NullPointerException`) usually signal a
      programming error, and the compiler doesn't force handling. `Error`s (like
      `OutOfMemoryError`) are also unchecked and generally shouldn't be caught.
  - q: Does `finally` always run?
    a: >-
      It runs whether the `try` block finishes normally, returns, or throws, and whether or not a
      `catch` matched. It doesn't run if the JVM stops first (`System.exit`, a crash, the process
      is killed), or if the thread never leaves the `try` (an infinite loop or a deadlock).
  - q: What does try-with-resources do?
    a: >-
      It declares resources in parentheses after `try`; each must implement `AutoCloseable`.
      When the block ends, normally or with an exception, they are closed automatically, in the
      reverse order they were opened. If the body throws and `close()` also throws, the body's
      exception is the one you catch and the close failure is attached to it as a *suppressed*
      exception (`getSuppressed()`).
  - q: Why should you never `return` from a `finally` block?
    a: >-
      A `return` (or `throw`) in `finally` replaces whatever the `try` or `catch` was doing:
      it overrides the returned value, and worse, it silently discards an exception that was on
      its way to the caller. The bug disappears without a trace.
  - q: What is exception chaining, and why use it?
    a: >-
      Wrapping a low-level exception in a higher-level one while keeping it as the *cause*:
      `throw new OrderNotFoundException(id, e)`, passing `e` to `super(message, cause)`. The
      caller gets an exception that makes sense at its level, and the stack trace still shows
      the original problem under "Caused by". Without the cause, the root of the problem is lost.
  - q: When should you create a custom exception?
    a: >-
      When callers need to react to a specific situation differently, or when it adds meaning a
      standard exception doesn't, such as `InsufficientFundsException`. Otherwise reuse the
      standard ones: `IllegalArgumentException` for bad arguments, `IllegalStateException` for
      calls at the wrong time, `UnsupportedOperationException`, and so on. Always include a clear
      message and the cause, if there is one.
  - q: Which of these is a checked exception?
    options:
      - "`IOException`"
      - "`NullPointerException`"
      - "`IllegalArgumentException`"
      - "`ArithmeticException`"
    correct: 1
    a: >-
      `IOException` extends `Exception` directly, so it's checked. The others extend
      `RuntimeException`, so they're unchecked.
  - q: "`try { return 1; } finally { return 2; }` returns what?"
    options:
      - "2"
      - "1"
      - "It doesn't compile"
      - "It throws an exception"
    correct: 1
    a: >-
      The `finally` block's `return` replaces the pending one. It compiles (with a warning), which
      is why it's a trap.
  - q: Two resources are declared in one try-with-resources, `db` then `file`. In what order are they closed?
    options:
      - "`file`, then `db`"
      - "`db`, then `file`"
      - "Both at the same time"
      - "Only the one that was used"
    correct: 1
    a: >-
      Resources close in reverse order of opening, like unwinding a stack, so a resource that
      depends on an earlier one is closed first.
  - q: The body of a try-with-resources throws, and then `close()` throws too. Which exception reaches the `catch`?
    options:
      - "The body's exception, with the close failure attached as suppressed"
      - "The close failure; the body's exception is lost"
      - "Both, as two separate catches"
      - "Neither: try-with-resources swallows exceptions"
    correct: 1
    a: >-
      The original exception wins, and `getSuppressed()` returns the ones from `close()`. With a
      hand-written `finally`, the close failure would replace the original exception instead.
---

## The idea

An exception is Java's way of saying "this can't continue normally". It unwinds the call stack
until some `catch` block handles it. Handling exceptions well comes down to three questions:
**which exceptions must be handled** (checked vs unchecked), **what runs on the way out**
(`catch`, `finally`, closing resources), and **what the caller learns** (a clear message and
the original cause).

## How it works

### The hierarchy

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 312" role="img" aria-labelledby="eh-title eh-desc"><title id="eh-title">The exception hierarchy</title><desc id="eh-desc">Throwable has two branches. Error, for serious JVM problems such as OutOfMemoryError and StackOverflowError, is unchecked. Exception splits into checked exceptions such as IOException and SQLException, which must be caught or declared, and RuntimeException, whose subclasses such as NullPointerException and IllegalArgumentException are unchecked.</desc><defs><marker id="eh-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="300" y="14" width="160" height="44" rx="9"/><text class="d-text" x="380" y="41" text-anchor="middle">Throwable</text><rect class="d-box warn" x="40" y="100" width="220" height="56" rx="9"/><text class="d-text" x="150" y="124" text-anchor="middle">Error</text><text class="d-sub" x="150" y="143" text-anchor="middle">JVM trouble: don't catch</text><rect class="d-box" x="440" y="100" width="220" height="56" rx="9"/><text class="d-text" x="550" y="124" text-anchor="middle">Exception</text><text class="d-sub" x="550" y="143" text-anchor="middle">checked: catch or declare</text><rect class="d-box hi" x="520" y="200" width="230" height="56" rx="9"/><text class="d-text" x="635" y="224" text-anchor="middle">RuntimeException</text><text class="d-sub" x="635" y="243" text-anchor="middle">unchecked: usually a bug</text><line class="d-line" x1="350" y1="58" x2="190" y2="98" marker-end="url(#eh-ah)"/><line class="d-line" x1="410" y1="58" x2="530" y2="98" marker-end="url(#eh-ah)"/><line class="d-line" x1="600" y1="156" x2="625" y2="198" marker-end="url(#eh-ah)"/><line class="d-line" x1="150" y1="156" x2="150" y2="178" marker-end="url(#eh-ah)"/><text class="d-label" x="40" y="200">OutOfMemoryError</text><text class="d-label" x="40" y="220">StackOverflowError</text><line class="d-line" x1="480" y1="156" x2="420" y2="186" marker-end="url(#eh-ah)"/><text class="d-label" x="300" y="206">IOException</text><text class="d-label" x="300" y="226">SQLException</text><text class="d-label" x="300" y="246">InterruptedException</text><text class="d-label" x="530" y="280">NullPointerException</text><text class="d-label" x="530" y="300">IllegalArgumentException, ...</text></svg>
<figcaption>Checked exceptions are every <code>Exception</code> that isn't a <code>RuntimeException</code>. The compiler makes you handle or declare those.</figcaption>
</figure>

| Kind | Examples | Compiler forces handling? | Usually means |
| --- | --- | --- | --- |
| Checked | `IOException`, `SQLException`, `InterruptedException` | Yes: catch or declare `throws` | Something outside your code failed; the caller may recover |
| Unchecked | `NullPointerException`, `IllegalArgumentException`, `IllegalStateException` | No | A bug, or a broken precondition |
| Error | `OutOfMemoryError`, `StackOverflowError` | No | The JVM is in trouble; let it propagate |

### What runs in try, catch and finally

```java
public class TryFinally {
    static String flow(boolean fail) {
        StringBuilder log = new StringBuilder();
        try {
            log.append("try ");
            if (fail) throw new IllegalStateException("boom");
            log.append("end-of-try ");
        } catch (IllegalStateException e) {
            log.append("catch(").append(e.getMessage()).append(") ");
        } finally {
            log.append("finally");                 // runs on every path
        }
        return log.toString();
    }

    @SuppressWarnings("finally")
    static int returnInFinally() {
        try {
            return 1;
        } finally {
            return 2;                              // overrides the try's return: never do this
        }
    }

    @SuppressWarnings("finally")
    static String swallowedByFinally() {
        try {
            throw new RuntimeException("the real error");
        } finally {
            return "no exception reached the caller";   // the exception is silently lost
        }
    }

    static int finallyCannotChangeReturnedValue() {
        int x = 1;
        try {
            return x;                              // the value 1 is saved here
        } finally {
            x = 99;                                // too late to change what's returned
        }
    }

    public static void main(String[] args) {
        System.out.println("normal:          " + flow(false));
        System.out.println("exception:       " + flow(true));
        System.out.println("return in finally:      " + returnInFinally());
        System.out.println("finally swallows error: " + swallowedByFinally());
        System.out.println("finally changes x:      " + finallyCannotChangeReturnedValue());
    }
}
```
{: .runnable}

```text
normal:          try end-of-try finally
exception:       try catch(boom) finally
return in finally:      2
finally swallows error: no exception reached the caller
finally changes x:      1
```
{: .run-output}

- `finally` runs on every path: normal end, `return`, or exception.
- A `return` in `finally` overrides the result and **swallows the exception**: the caller never
  hears about "the real error".
- `return x` saves the value first, so changing `x` in `finally` doesn't change what's returned.

### try-with-resources

Anything that implements `AutoCloseable` (files, streams, JDBC connections, executor services
since Java 19) can be declared in the `try` header and is closed automatically.

```java
public class Resources {
    static class Resource implements AutoCloseable {
        private final String name;
        private final boolean failOnClose;

        Resource(String name, boolean failOnClose) {
            this.name = name;
            this.failOnClose = failOnClose;
            System.out.println("open  " + name);
        }

        @Override
        public void close() {
            System.out.println("close " + name);
            if (failOnClose) throw new IllegalStateException("close failed: " + name);
        }
    }

    static class OrderNotFoundException extends Exception {     // checked: callers must handle it
        OrderNotFoundException(String id, Throwable cause) {
            super("order " + id + " not found", cause);           // keep the cause
        }
    }

    static void load(String id) throws OrderNotFoundException {
        try {
            Integer.parseInt(id);
        } catch (NumberFormatException e) {
            throw new OrderNotFoundException(id, e);              // wrap, don't lose it
        }
    }

    public static void main(String[] args) {
        // Resources close in reverse order, even when the body throws
        try (Resource db = new Resource("db", false);
             Resource file = new Resource("file", true)) {
            System.out.println("body runs");
            throw new RuntimeException("body failed");
        } catch (RuntimeException e) {
            System.out.println("caught:     " + e.getMessage());
            for (Throwable s : e.getSuppressed()) System.out.println("suppressed: " + s.getMessage());
        }

        // Exception chaining keeps the original cause
        try {
            load("A-17");
        } catch (OrderNotFoundException e) {
            System.out.println("caught:     " + e.getMessage());
            System.out.println("cause:      " + e.getCause().getClass().getSimpleName() + ": " + e.getCause().getMessage());
        }

        // Multi-catch
        for (String input : new String[] {"abc", null}) {
            try {
                System.out.println(input.length() + Integer.parseInt(input));
            } catch (NumberFormatException | NullPointerException e) {
                System.out.println("multi-catch: " + e.getClass().getSimpleName());
            }
        }
    }
}
```
{: .runnable}

```text
open  db
open  file
body runs
close file
close db
caught:     body failed
suppressed: close failed: file
caught:     order A-17 not found
cause:      NumberFormatException: For input string: "A-17"
multi-catch: NumberFormatException
multi-catch: NullPointerException
```
{: .run-output}

- Resources open in order and **close in reverse** (`file`, then `db`), even though the body
  threw.
- The body's exception is the one caught; the `close()` failure is kept as **suppressed**
  instead of hiding it.
- `OrderNotFoundException` wraps the `NumberFormatException` as its **cause**, so the full story
  survives.
- **Multi-catch** (`A | B`) handles several unrelated exception types the same way.

### Helpful NullPointerException messages

Since Java 14, the JVM says exactly which expression was `null`:

```java
public class HelpfulNpe {
    record Address(String city) { }
    record Customer(String name, Address address) { }
    public static void main(String[] args) {
        Customer c = new Customer("Diya", null);
        try {
            System.out.println(c.address().city().length());
        } catch (NullPointerException e) {
            System.out.println(e.getMessage());
        }
    }
}
```
{: .runnable}

```text
Cannot invoke "HelpfulNpe$Address.city()" because the return value of "HelpfulNpe$Customer.address()" is null
```
{: .run-output}

## Pitfalls

- **Empty `catch` blocks.** The failure disappears. At least log it, or rethrow.
- **Catching `Exception` or `Throwable` everywhere.** It hides bugs and catches things you can't
  handle. Catch the specific types you can do something about.
- **Losing the cause.** `throw new MyException(e.getMessage())` drops the stack trace; pass `e`.
- **`return` or `throw` in `finally`.** It silently replaces the real outcome.
- **Closing resources by hand.** A `finally` that calls `close()` is easy to get wrong when both
  the body and `close()` throw; use try-with-resources.
- **Exceptions for normal control flow.** Throwing is slow and hides the logic; use a return
  value, `Optional`, or a check first.
- **Logging and rethrowing at every level.** The same error appears many times. Handle it, or
  pass it on, but not both.
- **Swallowing `InterruptedException`.** Restore the flag with
  `Thread.currentThread().interrupt()` (see the concurrency series).

## When to use what

| Situation | Do this |
| --- | --- |
| A bad argument | `throw new IllegalArgumentException("clear message")` |
| An object in the wrong state for this call | `throw new IllegalStateException(...)` |
| A failure the caller can sensibly recover from | A checked exception, or a result type |
| A low-level exception crossing a layer boundary | Wrap it with a meaningful exception and keep the cause |
| Anything that must be closed | try-with-resources |
| Several exception types handled the same way | Multi-catch <code>catch (A &#124; B e)</code> |
| Cleanup that isn't a resource | `finally`, without `return` or `throw` in it |

## Further reading

- [The Java Tutorials: Exceptions](https://docs.oracle.com/javase/tutorial/essential/exceptions/)
- [Java Language Specification, Java SE 21: The try statement](https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.20)
- [JEP 358: Helpful NullPointerExceptions](https://openjdk.org/jeps/358)
