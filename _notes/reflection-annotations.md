---
title: "Reflection and annotations"
short_title: "Java reflection and annotations"
topic: Core Java
date: 2026-11-16
tags: [java, reflection, annotations, proxies, frameworks]
summary: How code can inspect and call other code at run time, how annotations carry metadata that frameworks read, and how dynamic proxies give Spring its @Transactional and @Async.
catalog: reflection
series: core-java
priority: high
questions:
  - q: What is reflection?
    a: >-
      The ability of running code to inspect and use classes it didn't know at compile time:
      list a class's fields, methods and annotations through its `Class` object, read and write
      fields, call methods by name, and create instances. Frameworks such as Spring, Hibernate,
      Jackson and JUnit are built on it: that's how they find your `@Autowired` fields, map JSON
      to your classes, and run your `@Test` methods.
  - q: What is an annotation, and what does `@Retention` control?
    a: >-
      Structured metadata attached to code (`@Override`, `@Deprecated`, `@NotBlank`). An
      annotation does nothing by itself; some tool has to read it. `@Retention` says where it
      survives: `SOURCE` (only for the compiler, like `@Override`), `CLASS` (in the class file,
      the default), or `RUNTIME` (readable through reflection, which is what frameworks need).
      `@Target` limits where it can be placed: fields, methods, types, parameters.
  - q: What is a dynamic proxy?
    a: >-
      An object created at run time that implements one or more interfaces and sends every method
      call to an `InvocationHandler`. The handler can run code before and after delegating to
      the real object. Spring uses proxies (JDK proxies for interfaces, CGLIB subclasses for
      classes) to add transactions, security, caching and `@Async` around your beans.
  - q: Why does calling an `@Transactional` method from another method in the same class not start a transaction?
    a: >-
      Because the transaction is added by a proxy that wraps the bean. A call from outside goes
      through the proxy; a call from inside the class (`this.save()`) goes straight to the real
      object and skips the proxy, so the annotation is never acted on. The same applies to
      `@Async` and `@Cacheable`. Move the method to another bean, or call it through the proxy.
  - q: What are the downsides of reflection?
    a: >-
      It skips compile-time checks: a misspelt method name fails only at run time. It is slower
      than direct calls (though the JIT narrows the gap), it breaks encapsulation with
      `setAccessible(true)`, and since Java 9 the module system blocks access to JDK internals,
      throwing `InaccessibleObjectException`. Prefer interfaces, lambdas or code generation when
      you control the code.
  - q: How do `getFields()` and `getDeclaredFields()` differ?
    a: >-
      `getFields()` returns public fields, including inherited ones. `getDeclaredFields()`
      returns every field declared in that class, whatever its access, but not inherited ones.
      The same pattern applies to `getMethods()` / `getDeclaredMethods()`. The order of the
      results isn't guaranteed by the specification.
  - q: A custom annotation should be read by your code at run time. Which retention does it need?
    options:
      - "`RetentionPolicy.RUNTIME`"
      - "`RetentionPolicy.SOURCE`"
      - "`RetentionPolicy.CLASS`, the default"
      - "No retention annotation is needed"
    correct: 1
    a: >-
      Only `RUNTIME` annotations are visible to reflection. With the default `CLASS` retention,
      `isAnnotationPresent` returns `false`.
  - q: "A service method calls `this.saveOrder()`, which is annotated `@Transactional`. Why doesn't a transaction start?"
    options:
      - "The self-call bypasses the Spring proxy that applies the annotation"
      - "`@Transactional` only works on private methods"
      - "Transactions need `@Async` too"
      - "Annotations are removed at compile time"
    correct: 1
    a: >-
      The annotation is acted on by the proxy, and `this` is the real object, not the proxy.
  - q: "What happens with `String.class.getDeclaredField(\"value\").setAccessible(true)` on Java 17+?"
    options:
      - "It throws `InaccessibleObjectException`"
      - "It succeeds and you can change the string"
      - "It doesn't compile"
      - "It returns `false`"
    correct: 1
    a: >-
      The `java.base` module doesn't open `java.lang` to your code, so deep reflection into
      `String` is refused. Only `--add-opens` on the command line would allow it.
  - q: Which of these is NOT typically done with reflection?
    options:
      - "Choosing which overload of a method to call at compile time"
      - "Injecting dependencies into annotated fields"
      - "Mapping JSON properties onto an object's fields"
      - "Finding and running methods annotated with `@Test`"
    correct: 1
    a: >-
      Overload resolution happens in the compiler. The other three are classic uses of reflection
      by Spring, Jackson and JUnit.
---

## The idea

Normally code calls code it knows about at compile time. **Reflection** lets code ask, while
running: *what fields does this object have, what methods, what annotations?* and then use them.
**Annotations** are the labels that make this useful: metadata such as `@NotBlank` or
`@Transactional` that a framework reads at run time to decide what to do.

You rarely write reflection yourself, but almost every framework you use is built on it, and
knowing how it works explains their rules, like why a `@Transactional` self-call does nothing.

## How it works

### The reflection API

| You want to | Use |
| --- | --- |
| The class of an object | `obj.getClass()` or `MyType.class` |
| Its fields / methods / constructors | `getDeclaredFields()`, `getDeclaredMethods()`, `getDeclaredConstructors()` |
| Read or write a field | `field.setAccessible(true); field.get(obj); field.set(obj, value)` |
| Call a method by name | `type.getMethod("name", paramTypes).invoke(obj, args)` |
| Create an instance | `type.getDeclaredConstructor().newInstance()` |
| Read an annotation | `element.getAnnotation(Max.class)`, `isAnnotationPresent(...)` |
| A record's components | `type.getRecordComponents()` |

### Annotations: declare, place, read

| Part | Example | Purpose |
| --- | --- | --- |
| Declaration | `@interface Max { int value(); }` | Defines the annotation and its elements |
| `@Retention(RUNTIME)` | On the declaration | Keeps it in the class file and visible to reflection |
| `@Target(FIELD)` | On the declaration | Where it may be used |
| Use | `@Max(120) private int age;` | Attaches the metadata |
| Processing | `field.getAnnotation(Max.class).value()` | A framework, or your code, acts on it |

### Dynamic proxies: how frameworks wrap your code

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 230" role="img" aria-labelledby="px-title px-desc" data-routes='[{"pts": [[140, 70], [270, 70], [450, 70], [600, 70]], "cls": "hi", "w": 2}]'><title id="px-title">A call through a dynamic proxy</title><desc id="px-desc">The caller holds a reference that looks like a PaymentService but is a proxy. Every call goes to the proxy's invocation handler, which runs code before, for example starting a transaction or logging, then calls the real service, then runs code after, such as committing. A call from inside the real service to its own method goes directly and skips the handler.</desc><defs><marker id="px-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="px-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="20" y="46" width="120" height="48" rx="9"/><text class="d-text" x="80" y="75" text-anchor="middle">caller</text><rect class="d-box hi" x="270" y="34" width="180" height="72" rx="10"/><text class="d-text" x="360" y="60" text-anchor="middle">proxy · handler</text><text class="d-sub" x="360" y="80" text-anchor="middle">before: begin tx, log</text><text class="d-sub" x="360" y="96" text-anchor="middle">after: commit, log</text><rect class="d-box" x="600" y="46" width="140" height="48" rx="9"/><text class="d-text" x="670" y="68" text-anchor="middle">real service</text><text class="d-sub" x="670" y="85" text-anchor="middle">your code</text><line class="d-line hi" x1="140" y1="70" x2="268" y2="70" marker-end="url(#px-ah-hi)"/><text class="d-label hi" x="204" y="60" text-anchor="middle">pay(...)</text><line class="d-line hi" x1="450" y1="70" x2="598" y2="70" marker-end="url(#px-ah-hi)"/><text class="d-label hi" x="524" y="60" text-anchor="middle">method.invoke</text><path class="d-line" d="M640 94 V150 H700 V96" marker-end="url(#px-ah)"/><text class="d-label warn" x="560" y="176">this.save() inside the service:</text><text class="d-label warn" x="560" y="194">never reaches the proxy, so</text><text class="d-label warn" x="560" y="212">@Transactional does nothing</text><text class="d-label" x="20" y="150">The caller can't tell the difference:</text><text class="d-label" x="20" y="168">the proxy implements the same interface.</text><text class="d-label" x="20" y="198">Spring builds these for @Transactional,</text><text class="d-label" x="20" y="216">@Async, @Cacheable and method security.</text></svg>
<figcaption>Only calls that go through the proxy get the extra behaviour. A method calling another method on <code>this</code> skips it.</figcaption>
</figure>

## In code: a validator and a proxy

```java
import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;

public class ReflectionDemo {
    // Two custom annotations, kept at run time so reflection can read them
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.FIELD)
    @interface NotBlank { }

    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.FIELD)
    @interface Max { int value(); }

    static class SignupForm {
        @NotBlank private String name;
        @Max(120) private int age;
        private String referral;                       // no rules

        SignupForm(String name, int age, String referral) { this.name = name; this.age = age; this.referral = referral; }
    }

    // A tiny validator: what Bean Validation (@NotBlank, @Max) does, in a few lines
    static List<String> validate(Object target) throws IllegalAccessException {
        List<String> errors = new ArrayList<>();
        for (Field field : target.getClass().getDeclaredFields()) {
            field.setAccessible(true);                   // allowed: our own class
            Object value = field.get(target);
            if (field.isAnnotationPresent(NotBlank.class) && (value == null || value.toString().isBlank()))
                errors.add(field.getName() + " must not be blank");
            Max max = field.getAnnotation(Max.class);
            if (max != null && ((Integer) value) > max.value())
                errors.add(field.getName() + " must be at most " + max.value());
        }
        return errors;
    }

    interface PaymentService { String pay(String orderId, int amount); }

    public static void main(String[] args) throws Exception {
        // Inspect a class at run time
        Class<?> type = SignupForm.class;
        System.out.println("class:      " + type.getSimpleName());
        for (Field f : type.getDeclaredFields())
            System.out.println("field:      " + f.getType().getSimpleName() + " " + f.getName()
                    + " " + Arrays.toString(f.getDeclaredAnnotations()).replace("ReflectionDemo.", ""));

        System.out.println("valid form: " + validate(new SignupForm("Diya", 30, null)));
        System.out.println("bad form:   " + validate(new SignupForm("  ", 150, "friend")));

        // Call a method by name
        Method upper = String.class.getMethod("toUpperCase");
        System.out.println("invoke:     " + upper.invoke("reflection"));

        // A dynamic proxy: an object created at run time that intercepts every call
        PaymentService real = (orderId, amount) -> "paid " + amount + " for " + orderId;
        PaymentService logged = (PaymentService) Proxy.newProxyInstance(
                PaymentService.class.getClassLoader(),
                new Class<?>[] {PaymentService.class},
                (proxy, method, callArgs) -> {
                    System.out.println("proxy:      before " + method.getName() + Arrays.toString(callArgs));
                    Object result = method.invoke(real, callArgs);
                    System.out.println("proxy:      after, returned \"" + result + "\"");
                    return result;
                });
        logged.pay("A-17", 499);

        // The module system protects JDK internals
        try {
            Field value = String.class.getDeclaredField("value");
            value.setAccessible(true);
        } catch (InaccessibleObjectException e) {
            System.out.println("modules:    InaccessibleObjectException for String.value");
        }
    }
}
```
{: .runnable}

```text
class:      SignupForm
field:      String name [@NotBlank()]
field:      int age [@Max(120)]
field:      String referral []
valid form: []
bad form:   [name must not be blank, age must be at most 120]
invoke:     REFLECTION
proxy:      before pay[A-17, 499]
proxy:      after, returned "paid 499 for A-17"
modules:    InaccessibleObjectException for String.value
```
{: .run-output}

- `validate` knows nothing about `SignupForm`; it finds the rules by reading the annotations,
  which is exactly how Bean Validation works.
- The proxy printed before and after `pay` without the real service changing at all.
- `setAccessible(true)` works on your own classes but is refused for JDK internals.
- The field order printed here is what HotSpot returns today; the specification doesn't promise
  any order.

## Pitfalls

- **Forgetting `@Retention(RUNTIME)`** on your own annotations. Reflection silently can't see
  them.
- **Self-invocation with proxies.** `this.method()` skips `@Transactional`, `@Async` and
  `@Cacheable`.
- **Method names as strings.** A rename breaks the code at run time, not compile time.
- **`setAccessible(true)` everywhere.** It breaks encapsulation and fails on JDK internals since
  Java 9 (17 made it strict).
- **Reflection in hot paths.** Look things up once and cache the `Method` or `Field`, or use
  `MethodHandle`s.
- **Relying on the order of `getDeclaredFields()`.** It isn't specified.

## When to use what

| Need | Use |
| --- | --- |
| Behaviour chosen at run time, and you control the code | An interface, a lambda or a strategy object |
| Rules attached to fields or methods (validation, mapping) | Annotations, read once with reflection |
| Add behaviour around calls (logging, timing, transactions) | A dynamic proxy, or Spring AOP |
| Generate code at compile time instead | An annotation processor (as Lombok and MapStruct do) |
| Fast repeated dynamic calls | `MethodHandle` |
| Look inside a record | `getRecordComponents()` |

## Further reading

- [The Java Tutorials: The Reflection API](https://docs.oracle.com/javase/tutorial/reflect/index.html)
- [The Java Tutorials: Annotations](https://docs.oracle.com/javase/tutorial/java/annotations/index.html)
- [`java.lang.reflect.Proxy` (Java 21 API)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/reflect/Proxy.html)
