---
title: "ThreadLocal"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, threadlocal]
summary: Per-thread variables — how they work, where frameworks use them, and why they leak in thread pools unless you clean up.
catalog: threadlocal
series: java-concurrency
priority: high
questions:
  - q: What is a `ThreadLocal`, and how does it store values?
    a: >-
      A variable where each thread sees its own independent value. The values aren't stored in the
      `ThreadLocal` object: each `Thread` has a map (`ThreadLocalMap`) from `ThreadLocal` to value,
      and `get()` looks the current thread's map up using the `ThreadLocal` as the key.
  - q: Where is `ThreadLocal` used in practice?
    a: >-
      To carry context through a call without passing it as a parameter: the current user
      (Spring Security's `SecurityContextHolder`), the current transaction (Spring's transaction
      synchronization), request attributes, logging context such as a trace ID (SLF4J's `MDC`), and
      per-thread instances of objects that aren't thread-safe, like the old `SimpleDateFormat`.
  - q: Why do `ThreadLocal`s cause problems in thread pools?
    a: >-
      Pool threads live for a long time and run many tasks. A value set during one task stays in the
      thread's map, so the next task on that thread sees the previous user's data (a security bug),
      and large values stay reachable (a memory leak). Always set and `remove()` in a `try`/`finally`.
  - q: How does the `ThreadLocalMap` leak memory?
    a: >-
      The map's keys are weak references to the `ThreadLocal`, but its values are strong references.
      If the `ThreadLocal` becomes unreachable while the thread lives on, the key is cleared but the
      value stays until the map happens to clean up stale entries. In application servers, a value
      whose class came from a web app can keep the whole application's classes in memory after a
      redeploy.
  - q: What is `InheritableThreadLocal`, and why is it unreliable with pools?
    a: >-
      It copies the parent thread's value into a child thread at the moment the child is created.
      Pool threads are created once and reused, so they inherit whatever value existed when the pool
      started, not the value of the thread submitting each task. To pass context to pooled tasks,
      capture it and set it explicitly inside the task (or use a wrapping executor).
  - q: What are scoped values?
    a: >-
      A newer alternative to `ThreadLocal` (`ScopedValue`, previewed in Java 21–24 and final in Java
      25). A value is bound for the duration of a call (`ScopedValue.where(KEY, value).run(...)`), is
      immutable while bound, and disappears automatically when the call returns. They're cheap to
      share with child threads in structured concurrency and can't leak between tasks.
  - q: Where does a `ThreadLocal` value actually live?
    options:
      - "In a map inside each `Thread` object"
      - "Inside the `ThreadLocal` object, in a map keyed by thread"
      - "In a static global map"
      - "On the thread's stack frame"
    correct: 1
    a: >-
      Each `Thread` has a `ThreadLocalMap`; the `ThreadLocal` is only the key. That's why values die
      with the thread, and why a long-lived pool thread keeps them.
  - q: A request filter sets the user in a `ThreadLocal` but never removes it. What can happen in a Tomcat thread pool?
    options:
      - "A later request on the same thread sees the previous request's user"
      - "Nothing; the value is cleared when the response is sent"
      - "Tomcat throws an exception at the end of the request"
      - "The value is copied to every other thread"
    correct: 1
    a: >-
      Request threads are reused. If the next request doesn't overwrite the value (e.g. an
      unauthenticated one), it sees stale data. Clear it in `finally`.
  - q: What's the safe pattern for a `ThreadLocal` inside a task?
    options:
      - "`set()` before the work, `remove()` in a `finally` block"
      - "`set(null)` at the start of the next task"
      - "Rely on garbage collection to clear it"
      - "Make the `ThreadLocal` field `volatile`"
    correct: 1
    a: >-
      `remove()` deletes the entry from the thread's map entirely; `finally` makes sure it happens
      even when the work throws.
  - q: What does `InheritableThreadLocal` copy, and when?
    options:
      - "The parent's value, once, when the child thread is created"
      - "The submitter's value, every time a task is submitted to a pool"
      - "Every change the parent makes, as it happens"
      - "Nothing unless the value is serializable"
    correct: 1
    a: >-
      The copy happens in the `Thread` constructor. Changes afterwards, and tasks submitted to
      existing pool threads, aren't affected.
---

## The idea

Sometimes data belongs to "whatever this thread is currently doing": the logged-in user, the
open transaction, a trace ID for logs. Passing it through every method is noisy.
`ThreadLocal<T>` gives each thread its own copy of a variable: one thread's `set()` never
affects another thread's `get()`.

## How it works

<figure class="figure" tabindex="0">
<svg viewBox="0 10 760 270" role="img" aria-labelledby="tl-title tl-desc" data-routes='[{"pts": [[380, 48], [140, 148], [140, 246]], "cls": "hi", "w": 1}, {"pts": [[380, 48], [620, 148], [620, 246]], "cls": "ev", "w": 1}]'><title id="tl-title">How ThreadLocal stores one value per thread</title><desc id="tl-desc">A single ThreadLocal object is shared by all threads, but each thread keeps its own map from ThreadLocal to value. When thread 1 calls get(), it reads alice from its own map; when thread 2 calls get(), it reads bob from its own map.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box hi" x="290" y="20" width="180" height="56" rx="10"/><text class="d-text" x="380" y="45" text-anchor="middle">ThreadLocal&lt;User&gt;</text><text class="d-sub" x="380" y="63" text-anchor="middle">one shared key</text><rect class="d-box" x="40" y="120" width="200" height="56" rx="10"/><text class="d-text" x="140" y="145" text-anchor="middle">Thread 1</text><text class="d-sub" x="140" y="163" text-anchor="middle">its own map</text><rect class="d-box" x="520" y="120" width="200" height="56" rx="10"/><text class="d-text" x="620" y="145" text-anchor="middle">Thread 2</text><text class="d-sub" x="620" y="163" text-anchor="middle">its own map</text><rect class="d-box" x="40" y="220" width="200" height="52" rx="10"/><text class="d-text" x="140" y="251" text-anchor="middle">user = alice</text><rect class="d-box" x="520" y="220" width="200" height="52" rx="10"/><text class="d-text" x="620" y="251" text-anchor="middle">user = bob</text><line class="d-line hi" x1="310" y1="76" x2="200" y2="118" marker-end="url(#ah-hi)"/><text class="d-label hi" x="240" y="92" text-anchor="end">get()</text><line class="d-line hi" x1="450" y1="76" x2="560" y2="118" marker-end="url(#ah-hi)"/><text class="d-label hi" x="520" y="92" text-anchor="start">get()</text><line class="d-line" x1="140" y1="176" x2="140" y2="218" marker-end="url(#ah)"/><line class="d-line" x1="620" y1="176" x2="620" y2="218" marker-end="url(#ah)"/><text class="d-label" x="380" y="180" text-anchor="middle">same key, different value</text><text class="d-label" x="380" y="196" text-anchor="middle">in each thread</text></svg>
<figcaption>The value lives in the <strong>thread</strong>, not in the <code>ThreadLocal</code>. That’s why a pooled thread carries old values into its next task unless you call <code>remove()</code>.</figcaption>
</figure>

```java
private static final ThreadLocal<User> CURRENT = new ThreadLocal<>();

CURRENT.set(user);      // into this thread's map
User u = CURRENT.get(); // from this thread's map; null if not set
CURRENT.remove();       // delete this thread's entry
```

- `ThreadLocal.withInitial(supplier)` creates a value the first time a thread calls `get()`.
- Values die with their thread, but **pool threads rarely die**.
- The map's keys are weak references; its values aren't. A forgotten value can stay reachable
  for as long as the thread lives.

## In code

### Request context, cleaned up properly

```java
final class RequestContext {
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    static String traceId() { return TRACE_ID.get(); }

    static void runWith(String traceId, Runnable work) {
        TRACE_ID.set(traceId);
        try {
            work.run();
        } finally {
            TRACE_ID.remove();   // the thread may serve someone else next
        }
    }
}
```

### Passing context to a pooled task

```java
String traceId = RequestContext.traceId();              // capture on the submitting thread
pool.submit(() -> RequestContext.runWith(traceId, () -> sendEmail(order)));
```

### One non-thread-safe object per thread

```java
private static final ThreadLocal<MessageDigest> SHA256 = ThreadLocal.withInitial(() -> {
    try {
        return MessageDigest.getInstance("SHA-256");    // MessageDigest isn't thread-safe
    } catch (NoSuchAlgorithmException e) {
        throw new IllegalStateException(e);
    }
});

static byte[] hash(byte[] data) {
    MessageDigest md = SHA256.get();
    md.reset();
    return md.digest(data);
}
```

## Pitfalls

- **No `remove()` in thread pools**: the next task sees stale data, and values leak.
- **Expecting values in another thread**: `@Async` methods, `CompletableFuture` callbacks and
  parallel streams run elsewhere, without your `ThreadLocal`s.
- **`InheritableThreadLocal` with pools**: values are copied when threads are created, not per
  task.
- **Large values per thread**: with thousands of virtual threads, each copy costs memory.
- **Hidden coupling**: code that reads a `ThreadLocal` silently depends on someone having set it.
  Keep the set/read/remove in one small helper.
- **Mutating a shared object stored in a `ThreadLocal`**: the variable is per thread, but the
  object isn't, if several threads store the same instance.

## When to use what

| Need | Use |
| --- | --- |
| Context for one request on one thread | `ThreadLocal` with `remove()` in `finally` |
| Context bound for exactly one call (Java 25+) | `ScopedValue` |
| Logging context | SLF4J `MDC` (backed by a `ThreadLocal`) |
| A non-thread-safe helper per thread | `ThreadLocal.withInitial(...)`, or a thread-safe alternative (`DateTimeFormatter`) |
| Context in async tasks | Capture explicitly and pass it, or use a context-propagating executor |

## Further reading

- [`ThreadLocal` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/ThreadLocal.html)
- [JEP 506: Scoped Values](https://openjdk.org/jeps/506)
