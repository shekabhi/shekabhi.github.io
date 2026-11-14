---
title: "Immutability and thread-safe design"
topic: Java concurrency
date: 2026-11-14
tags: [java, concurrency, immutability, design]
summary: Designing classes that are thread-safe by construction — confinement, immutable objects, safe publication and singletons.
catalog: thread-safe-design
series: java-concurrency
priority: high
questions:
  - q: What are the three ways to make state thread-safe?
    a: >-
      Don't share it (confinement: keep it in local variables or owned by one thread), don't let it
      change (immutability: share objects that can't be modified), or, only if neither works,
      synchronize every access with locks, atomics or concurrent collections. The first two need no
      locking at all.
  - q: How do you write an immutable class?
    a: >-
      Make the class `final` (or the constructor private), make all fields `private final`, don't
      provide setters, make defensive copies of mutable inputs in the constructor and of mutable
      outputs in getters (or use unmodifiable collections like `List.copyOf`), and don't let `this`
      escape the constructor. Records give you the first parts for free.
  - q: Are Java records immutable?
    a: >-
      Only shallowly. Record fields are `private final` and there are no setters, but a component
      that is a mutable object, like an `ArrayList`, can still be changed through its reference.
      Copy mutable components in a compact constructor, e.g. `items = List.copyOf(items)`.
  - q: Why are immutable objects automatically thread-safe?
    a: >-
      Nothing can change their state after construction, so there's nothing to race on. The JMM's
      `final` field guarantee also means any thread that sees a reference to a properly constructed
      immutable object sees its fields correctly, even without synchronization.
  - q: How do you write a thread-safe lazy singleton?
    a: >-
      The holder-class idiom: put the instance in a `static final` field of a private nested class.
      The JVM initialises that class on first use, and class initialization is thread-safe, so it's
      lazy with no locking. An `enum` with one constant is also thread-safe (and serialization-safe).
      Double-checked locking works too, but only with a `volatile` field.
  - q: How do you update shared configuration without locks?
    a: >-
      Keep it as an immutable snapshot object and hold the current one in a `volatile` field or an
      `AtomicReference`. Readers just read the reference. Writers build a new snapshot and swap it in
      (with `compareAndSet` or `updateAndGet` if concurrent writers are possible). Readers always see
      a complete, consistent version.
  - q: "A record is declared as `record Cart(List<Item> items)`. Is it thread-safe to share?"
    options:
      - "Not necessarily: the list itself can still be modified unless it's copied into an unmodifiable list"
      - "Yes: records are always deeply immutable"
      - "Yes, if the record is declared `final`"
      - "No: records can't be shared between threads"
    correct: 1
    a: >-
      Records are shallowly immutable. Use a compact constructor with `items = List.copyOf(items);`
      so the list can't change.
  - q: Why is the holder-class singleton thread-safe without locks?
    options:
      - "The JVM initialises a class once, thread-safely, on first use"
      - "Static fields are always `volatile`"
      - "Nested classes are loaded at startup"
      - "It isn't thread-safe"
    correct: 1
    a: >-
      Class initialization is guarded by the JVM, and the nested class isn't initialised until
      `getInstance()` first touches it, so it's both lazy and safe.
  - q: Which of these is thread confinement?
    options:
      - "A `StringBuilder` created and used only inside one method call"
      - "A `static` `ArrayList` read by many threads"
      - "A field in a Spring singleton bean"
      - "A `ConcurrentHashMap` shared by all requests"
    correct: 1
    a: >-
      A local variable that never escapes the method is only reachable by the current thread, so it
      needs no synchronization. The others are shared.
  - q: A Spring `@Service` stores the current request's user in an instance field. What's the problem?
    options:
      - "The bean is a singleton shared by all request threads, so requests overwrite each other's user"
      - "Nothing; Spring creates a new instance per request"
      - "Instance fields aren't allowed in Spring beans"
      - "Only a memory leak"
    correct: 1
    a: >-
      Spring beans are singletons by default, so instance fields are shared state. Keep services
      stateless and pass request data as parameters (or use a request-scoped bean).
---

## The idea

The easiest concurrency bug to fix is the one that can't happen. Instead of adding locks
after the fact, design classes so that most state is either **not shared** or **not
changeable**, and keep the truly shared, mutable state small and well guarded.

## How it works

<figure class="figure" tabindex="0">
<svg viewBox="0 30 760 230" role="img" aria-labelledby="tsd-title tsd-desc"><title id="tsd-title">Three ways to make state thread-safe</title><desc id="tsd-desc">First ask whether the state is shared between threads. If not, confine it to one thread and no synchronization is needed. If it is shared, ask whether it can be immutable; if so, share it freely. Only shared, mutable state needs synchronization with locks, atomics or concurrent collections.</desc><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker><marker id="ah-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-warn" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="40" width="200" height="64" rx="10"/><text class="d-text" x="120" y="69" text-anchor="middle">Shared between</text><text class="d-sub" x="120" y="87" text-anchor="middle">threads?</text><rect class="d-box" x="290" y="40" width="200" height="64" rx="10"/><text class="d-text" x="390" y="69" text-anchor="middle">Can it be</text><text class="d-sub" x="390" y="87" text-anchor="middle">immutable?</text><rect class="d-box" x="560" y="40" width="180" height="64" rx="10"/><text class="d-text" x="650" y="69" text-anchor="middle">Synchronize</text><text class="d-sub" x="650" y="87" text-anchor="middle">locks, atomics, collections</text><rect class="d-box hi" x="20" y="180" width="200" height="64" rx="10"/><text class="d-text" x="120" y="209" text-anchor="middle">Confine it</text><text class="d-sub" x="120" y="227" text-anchor="middle">one thread owns it</text><rect class="d-box hi" x="290" y="180" width="200" height="64" rx="10"/><text class="d-text" x="390" y="209" text-anchor="middle">Make it immutable</text><text class="d-sub" x="390" y="227" text-anchor="middle">share freely</text><line class="d-line" x1="220" y1="72" x2="288" y2="72" marker-end="url(#ah)"/><text class="d-label" x="254" y="62" text-anchor="middle">yes</text><line class="d-line" x1="490" y1="72" x2="558" y2="72" marker-end="url(#ah)"/><text class="d-label" x="524" y="62" text-anchor="middle">no</text><line class="d-line hi" x1="120" y1="104" x2="120" y2="178" marker-end="url(#ah-hi)"/><text class="d-label hi" x="130" y="146" text-anchor="start">no</text><line class="d-line hi" x1="390" y1="104" x2="390" y2="178" marker-end="url(#ah-hi)"/><text class="d-label hi" x="400" y="146" text-anchor="start">yes</text></svg>
<figcaption>Work from left to right. The two highlighted answers need no locks at all, so most thread-safe designs try hard to land there.</figcaption>
</figure>

### Confinement

State that only one thread can reach needs no synchronization:

- **Stack confinement**: local variables and objects that never escape the method.
- **Thread confinement**: an object owned by one thread, e.g. a single consumer thread that owns
  its buffer, or a `ThreadLocal`.
- **Stateless components**: a service with no mutable fields is safe to share; all its state is
  in parameters and local variables.

### Immutability

An object is immutable if its state can't change after construction:

1. All fields `private final`.
2. No setters, and no methods that change fields.
3. The class can't be subclassed (`final`, or a private constructor).
4. Mutable inputs are copied in; mutable internals are never handed out (copy them, or return
   unmodifiable views).
5. `this` doesn't escape during construction.

To "change" one, create a new instance (like `String` and `BigDecimal` do).

### Safe publication

Even a thread-safe object must be published safely, so other threads see it fully built:
static initializers, `volatile` / `AtomicReference` fields, `final` fields, fields guarded by a
lock, or concurrent collections and queues. Immutable objects with `final` fields are the
exception: they're safe however they're published.

## In code

### An immutable value

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount);
        Objects.requireNonNull(currency);
    }
    public Money plus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(amount.add(other.amount), currency);   // a new object, not a change
    }
}

public record Order(String id, List<String> items) {
    public Order {
        items = List.copyOf(items);   // records are shallowly immutable: copy mutable parts
    }
}
```

### Lazy singletons

```java
public final class Registry {
    private Registry() {}

    private static final class Holder {               // initialised on first use, by the JVM
        static final Registry INSTANCE = new Registry();
    }

    public static Registry getInstance() { return Holder.INSTANCE; }
}

public enum Clock {                                   // the simplest thread-safe singleton
    INSTANCE;
    public long now() { return System.currentTimeMillis(); }
}
```

### Swapping an immutable snapshot

```java
record Settings(int maxConnections, Duration timeout, Set<String> features) {
    Settings { features = Set.copyOf(features); }
}

class SettingsHolder {
    private final AtomicReference<Settings> current =
            new AtomicReference<>(new Settings(10, Duration.ofSeconds(2), Set.of()));

    Settings get() { return current.get(); }          // readers never block

    void enable(String feature) {                     // writers build a new snapshot
        current.updateAndGet(s -> {
            Set<String> f = new HashSet<>(s.features());
            f.add(feature);
            return new Settings(s.maxConnections(), s.timeout(), f);
        });
    }
}
```

## Pitfalls

- **Shallow immutability**: `final` fields pointing to mutable lists, maps or arrays.
- **Getters returning internal collections**, which callers can then modify.
- **Leaking `this` from a constructor**: registering listeners or starting threads there.
- **Stateful singletons**: instance fields in Spring singleton beans, servlets or static helpers.
- **Mutating an object after publishing it**, e.g. building a "config" object and then changing
  it while other threads read it.
- **Unsafe lazy initialisation**: `if (instance == null) instance = new X();` without a lock or
  `volatile`.

## When to use what

| Situation | Approach |
| --- | --- |
| Values, DTOs, events, configuration | Immutable records or classes |
| Per-request data | Local variables and parameters (stateless services) |
| Lazy singleton | Holder class or `enum` |
| Read-mostly shared settings | Immutable snapshot in an `AtomicReference` or `volatile` field |
| Shared mutable state that must change in place | Locks, atomics or concurrent collections, behind a small API |

## Further reading

- [JLS §17.5: `final` field semantics](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html#jls-17.5)
- [Records (Java 21 language guide)](https://docs.oracle.com/en/java/javase/21/language/records.html)
