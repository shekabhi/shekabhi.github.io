---
title: "Classes, objects and initialisation order"
short_title: "Java classes, objects, init order"
topic: Core Java
date: 2026-11-15
tags: [java, classes, constructors, static, final]
summary: What happens, step by step, when a class loads and an object is created, plus static vs instance, final, and why Java is always pass-by-value.
catalog: classes-objects
series: core-java
priority: high
questions:
  - q: In what order do things run when you create an object of a subclass for the first time?
    a: >-
      First, once per class: the parent's static fields and static blocks in the order they
      appear, then the child's. Then, for each object: the parent's instance fields and instance
      blocks, the parent's constructor body, the child's instance fields and instance blocks, and
      finally the child's constructor body. Static parts run only the first time the class is
      used; instance parts run for every `new`.
  - q: Is Java pass-by-value or pass-by-reference?
    a: >-
      Always pass-by-value. For a primitive, the value is copied. For an object, the *reference*
      is copied, so the method can change the object the caller sees, but assigning a new
      object to the parameter changes only the method's own copy. That's why a `swap(a, b)`
      method can't swap the caller's variables.
  - q: What's the difference between a static member and an instance member?
    a: >-
      A static field or method belongs to the class: there's one copy, shared by all instances,
      and you use it through the class name. An instance member belongs to each object. A static
      method has no `this`, so it can't use instance fields or methods directly.
  - q: What does `final` mean on a variable, a method and a class?
    a: >-
      A `final` variable can be assigned only once; for a reference, that fixes which object it
      points to, not the object's contents. A `final` method can't be overridden. A `final` class
      can't be extended (`String` is one). Final fields must be assigned by the end of every
      constructor.
  - q: Why is it risky to call an overridable method from a constructor?
    a: >-
      The parent's constructor runs before the child's fields are initialised. If it calls a
      method the child overrides, the override runs on a half-built object and sees default
      values (`null`, `0`, `false`). Keep constructors simple, and only call `private`, `static`
      or `final` methods from them.
  - q: When does the compiler add a default constructor?
    a: >-
      Only when a class declares no constructor at all. It takes no arguments and calls
      `super()`. As soon as you write any constructor, the default one is gone. Every constructor
      starts with a call to `this(...)` or `super(...)`; if you write neither, the compiler
      inserts `super()`, which fails to compile if the parent has no no-argument constructor.
  - q: A class has a static block, an instance block and a constructor. You create two objects. How many times does each run?
    options:
      - "Static block once; instance block and constructor twice each"
      - "All three run twice"
      - "Static block twice; the others once"
      - "Static block once; instance block once; constructor twice"
    correct: 1
    a: >-
      The static block runs once, when the class is initialised. The instance block and the
      constructor run for every object, the block first.
  - q: "A method does `c = new Counter();` on its `Counter c` parameter. What does the caller see?"
    options:
      - "Its original object, unchanged by the assignment"
      - "The new object"
      - "`null`"
      - "A compile error, because parameters are final"
    correct: 1
    a: >-
      The parameter is a copy of the caller's reference. Reassigning it points the copy at a new
      object; the caller's variable still refers to the original.
  - q: "`final List<String> names = new ArrayList<>();` Which statement compiles?"
    options:
      - "`names.add(\"x\");`"
      - "`names = new ArrayList<>();`"
      - "`names = null;`"
      - "None of them"
    correct: 1
    a: >-
      `final` stops the variable being reassigned, not the object being changed. For a list that
      can't change, use `List.of(...)` or `Collections.unmodifiableList(...)`.
  - q: A parent constructor calls a method that the child overrides, and the override reads a child field initialised with `= "x"`. What does it read?
    options:
      - "`null`, because the child's fields aren't initialised yet"
      - "`\"x\"`"
      - "It throws `IllegalStateException`"
      - "It doesn't compile"
    correct: 1
    a: >-
      The parent's constructor runs before the child's field initialisers, so the field still
      holds its default value. No exception is thrown, which is what makes the bug easy to miss.
---

## The idea

A **class** is a blueprint; an **object** is one thing built from it. Creating an object looks
like a single step, `new Order()`, but the JVM does several things in a fixed order: it
initialises the class if it hasn't yet, sets fields, and runs constructors from the top of the
inheritance chain down.

Knowing that order explains a family of bugs: fields that are unexpectedly `null`, static
state that is shared by accident, and methods that "can't change" their arguments.

## How it works

### Static vs instance

| Aspect | Static member | Instance member |
| --- | --- | --- |
| Belongs to | The class | Each object |
| Copies | One, shared | One per object |
| Used as | `Counter.created` | `counter.value` |
| Has `this`? | No | Yes |
| Set up when | The class is initialised (once) | Each `new` |

### The order of initialisation

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 300" role="img" aria-labelledby="io-title io-desc" data-routes='[{"pts": [[190, 78], [190, 104], [190, 122], [190, 146], [570, 78], [570, 104], [570, 148], [570, 174], [570, 218], [570, 244]], "cls": "hi", "w": 1}]'><title id="io-title">Initialisation order for new Child()</title><desc id="io-desc">Once per class: step 1, the parent's static fields and static blocks; step 2, the child's static fields and static blocks. For every object: step 3, the parent's instance fields and instance blocks; step 4, the parent's constructor; step 5, the child's instance fields and instance blocks; step 6, the child's constructor.</desc><defs><marker id="io-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="io-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="24">ONCE PER CLASS</text><rect class="d-box" x="20" y="36" width="340" height="42" rx="9"/><text class="d-text" x="190" y="62" text-anchor="middle">1 · Parent static fields and blocks</text><rect class="d-box" x="20" y="104" width="340" height="42" rx="9"/><text class="d-text" x="190" y="130" text-anchor="middle">2 · Child static fields and blocks</text><line class="d-line" x1="190" y1="78" x2="190" y2="102" marker-end="url(#io-ah)"/><text class="d-label hi" x="400" y="24">FOR EVERY new Child()</text><rect class="d-box hi" x="400" y="36" width="340" height="42" rx="9"/><text class="d-text" x="570" y="62" text-anchor="middle">3 · Parent instance fields and blocks</text><rect class="d-box hi" x="400" y="106" width="340" height="42" rx="9"/><text class="d-text" x="570" y="132" text-anchor="middle">4 · Parent constructor body</text><rect class="d-box hi" x="400" y="176" width="340" height="42" rx="9"/><text class="d-text" x="570" y="202" text-anchor="middle">5 · Child instance fields and blocks</text><rect class="d-box hi" x="400" y="246" width="340" height="42" rx="9"/><text class="d-text" x="570" y="272" text-anchor="middle">6 · Child constructor body</text><line class="d-line hi" x1="570" y1="78" x2="570" y2="104" marker-end="url(#io-ah-hi)"/><line class="d-line hi" x1="570" y1="148" x2="570" y2="174" marker-end="url(#io-ah-hi)"/><line class="d-line hi" x1="570" y1="218" x2="570" y2="244" marker-end="url(#io-ah-hi)"/><path class="d-line" d="M360 125 H380 V57 H398" marker-end="url(#io-ah)"/><text class="d-label" x="20" y="186">Between steps 4 and 5 the child's</text><text class="d-label" x="20" y="204">fields still hold default values:</text><text class="d-label" x="20" y="222">null, 0 or false.</text></svg>
<figcaption>Static parts run once, parent first. Then every <code>new</code> builds the object from the parent down.</figcaption>
</figure>

Press **Run** and follow the numbered lines (the program numbers each piece separately, so it counts to 9). Look at what `Child.describe()` prints while the *Base* constructor is still running.

```java
public class InitOrder {
    static class Base {
        static String baseStatic = log("1. Base static field");
        static { log("2. Base static block"); }

        String baseField = log("5. Base instance field");
        { log("6. Base instance block"); }

        Base() {
            log("7. Base constructor");
            describe();                      // calls the overridden method: risky
        }

        void describe() { log("   Base.describe()"); }
    }

    static class Child extends Base {
        static String childStatic = log("3. Child static field");
        static { log("4. Child static block"); }

        String name = log("8. Child instance field");

        Child() {
            log("9. Child constructor, name is set: " + (name != null));
        }

        @Override
        void describe() { log("   Child.describe() sees name = " + name); }
    }

    static String log(String message) {
        System.out.println(message);
        return message;
    }

    public static void main(String[] args) {
        System.out.println("--- first new Child() ---");
        new Child();
        System.out.println("--- second new Child() ---");
        new Child();
    }
}
```
{: .runnable}

```text
--- first new Child() ---
1. Base static field
2. Base static block
3. Child static field
4. Child static block
5. Base instance field
6. Base instance block
7. Base constructor
   Child.describe() sees name = null
8. Child instance field
9. Child constructor, name is set: true
--- second new Child() ---
5. Base instance field
6. Base instance block
7. Base constructor
   Child.describe() sees name = null
8. Child instance field
9. Child constructor, name is set: true
```
{: .run-output}

The second `new Child()` starts at line 5: both classes are already initialised, so their static parts don't run again.

### Constructors

- If a class declares **no** constructor, the compiler adds a no-argument one that calls
  `super()`. Declare any constructor and that default disappears.
- The first statement of a constructor is `this(...)` (another constructor of the same class) or
  `super(...)` (a parent constructor). Write neither and the compiler inserts `super()`.
- Constructors are not inherited, and they have no return type.

```java
class Order {
    private final String id;
    private final int quantity;

    Order(String id) { this(id, 1); }          // chains to the other constructor

    Order(String id, int quantity) {
        this.id = id;                          // final fields must be set by the end
        this.quantity = quantity;
    }
}
```

### `final`

| On a | Meaning |
| --- | --- |
| Variable | Assigned once. For a reference: always the same object, whose contents can still change |
| Field | Must be assigned by the end of every constructor (or in its declaration) |
| Method | Can't be overridden |
| Class | Can't be extended, for example `String` and `Integer` |

### Access modifiers

| Modifier | Same class | Same package | Subclass (other package) | Everywhere |
| --- | --- | --- | --- | --- |
| `private` | Yes | No | No | No |
| none (package-private) | Yes | Yes | No | No |
| `protected` | Yes | Yes | Yes | No |
| `public` | Yes | Yes | Yes | Yes |

Start with `private` and widen only when something outside needs it.

## In code: Java is pass-by-value

A method receives **copies** of its arguments. For objects, the copy is a copy of the
reference, so both point at the same object.

```java
import java.util.ArrayList;
import java.util.List;

public class PassByValue {
    static int created = 0;                    // one copy, shared by every instance

    static class Counter {
        int value;                             // one copy per object
        Counter() { created++; }
    }

    static void addOne(int n) { n = n + 1; }                    // changes the copy
    static void increment(Counter c) { c.value++; }             // follows the reference: visible
    static void replace(Counter c) { c = new Counter(); c.value = 99; }   // reassigns the copy
    static void swap(Counter a, Counter b) { Counter t = a; a = b; b = t; }

    public static void main(String[] args) {
        int n = 1;
        addOne(n);
        System.out.println("int after addOne:        " + n);

        Counter c = new Counter();
        increment(c);
        System.out.println("value after increment:   " + c.value);
        replace(c);
        System.out.println("value after replace:     " + c.value);

        Counter x = new Counter(), y = new Counter();
        x.value = 1; y.value = 2;
        swap(x, y);
        System.out.println("after swap: x=" + x.value + ", y=" + y.value);

        final List<String> names = new ArrayList<>();
        names.add("final stops reassignment, not mutation");
        System.out.println(names);

        System.out.println("Counters created (static): " + created);
    }
}
```
{: .runnable}

```text
int after addOne:        1
value after increment:   1
value after replace:     1
after swap: x=1, y=2
[final stops reassignment, not mutation]
Counters created (static): 4
```
{: .run-output}

- `increment(c)` followed the copied reference and changed the shared object.
- `replace(c)` and `swap(x, y)` only reassigned the method's own copies, so the caller saw no
  change.
- `created` is static, so all four `Counter` objects (including the one made inside `replace`)
  increased the same field.

## Pitfalls

- **Calling overridable methods in a constructor.** The override runs before the child's
  fields are set and sees `null` or `0`.
- **Mutable static state.** One copy is shared by every instance and every thread; it's a
  common source of test pollution and race conditions.
- **Thinking `final` makes an object immutable.** It only fixes the reference. Make the fields
  `final` and the contents unmodifiable too.
- **Expecting a method to replace the caller's object.** Return the new object instead.
- **Field shadowing.** `name = name;` in a constructor assigns the parameter to itself; write
  `this.name = name;`.
- **Heavy work in constructors or static blocks.** Failures there are hard to handle; a static
  block that throws makes the class unusable.

## When to use what

| Need | Use |
| --- | --- |
| Data that belongs to each object | Instance fields, `private` and often `final` |
| A constant | `static final` |
| A helper that needs no object state | A `static` method |
| Several ways to build an object | Overloaded constructors chained with `this(...)`, or a static factory method |
| Many optional parameters | A builder |
| A value that must never change | `final` fields plus unmodifiable contents, or a record (later in this series) |

## Further reading

- [Java Language Specification, Java SE 21: Creation of new class instances](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.5)
- [Java Language Specification, Java SE 21: Initialization of classes and interfaces](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.4)
- [The Java Tutorials: Controlling access to members of a class](https://docs.oracle.com/javase/tutorial/java/javaOO/accesscontrol.html)
