---
title: "Inheritance, polymorphism and interfaces"
short_title: "Java inheritance and interfaces"
topic: Core Java
date: 2026-11-16
tags: [java, oop, inheritance, polymorphism, interfaces]
summary: How Java picks which method runs, what overriding and overloading really decide, and when to use an interface, an abstract class or plain composition.
catalog: oop
series: core-java
priority: high
questions:
  - q: What is the difference between overloading and overriding?
    a: >-
      **Overloading** is several methods with the same name and different parameter lists in one
      class; the compiler picks one from the *declared* types of the arguments. **Overriding**
      is a subclass redefining an inherited method with the same signature; the JVM picks it at
      run time from the object's *actual* class. Overloading is compile-time, overriding is
      run-time (dynamic dispatch).
  - q: What is polymorphism in Java?
    a: >-
      Code written against a supertype works with any subtype, and each object answers in its
      own way. `Animal pet = new Dog(); pet.sound()` runs `Dog.sound()` because instance methods
      are dispatched on the object's runtime class. Fields and static methods are not
      polymorphic: they are chosen from the declared type.
  - q: What are the rules for overriding a method?
    a: >-
      Same name and parameter types. The return type can be the same or a subtype (covariant
      return). Access can stay the same or get wider, never narrower. It can't throw new or
      broader checked exceptions. `private`, `static` and `final` methods can't be overridden.
      Always add `@Override` so the compiler checks you really are overriding.
  - q: Abstract class or interface?
    a: >-
      Use an **interface** to describe what something can do: a class can implement many, and
      since Java 8 they can carry `default` and `static` methods. Use an **abstract class** when
      related classes share state (fields), constructors or protected helpers; a class can extend
      only one. Many designs use both: an interface for the contract and an abstract class as a
      partial implementation.
  - q: What happens when a class inherits two default methods with the same signature?
    a: >-
      It doesn't compile until the class overrides the method and chooses, for example with
      `Walker.super.move()`. Two rules settle most other cases: a method from a superclass wins
      over an interface default, and a more specific interface wins over the one it extends.
  - q: Why prefer composition over inheritance?
    a: >-
      Inheritance couples the subclass to the parent's implementation details: a change in the
      parent can break subclasses, and the subclass inherits every public method, even ones that
      don't make sense for it. Composition (holding the other object in a field and delegating to
      it) exposes only what you choose and lets you swap implementations. Use inheritance for a
      true "is-a" relationship that the parent was designed for.
  - q: "`Animal pet = new Dog();` and `describe` is overloaded for `Animal` and `Dog`. Which does `describe(pet)` call?"
    options:
      - "`describe(Animal)`, chosen at compile time from the declared type"
      - "`describe(Dog)`, chosen at run time from the real object"
      - "It doesn't compile: the call is ambiguous"
      - "Both, in order"
    correct: 1
    a: >-
      Overload resolution uses the static (declared) type of the argument. Only overriding is
      decided at run time. Cast with `(Dog) pet` or use pattern matching to pick the other one.
  - q: "`Animal` and `Dog` both declare a field `name`. With `Animal pet = new Dog();`, what is `pet.name`?"
    options:
      - "`Animal`'s field, because fields are not polymorphic"
      - "`Dog`'s field"
      - "A compile error"
      - "`null`"
    correct: 1
    a: >-
      A field in a subclass with the same name *hides* the parent's; it doesn't override it. The
      declared type of the variable decides which field you read.
  - q: A parent method is `public void save()`. Which override compiles?
    options:
      - "`@Override public void save()`"
      - "`@Override void save()`"
      - "`@Override protected void save()`"
      - "`@Override private void save()`"
    correct: 1
    a: >-
      An override can't reduce visibility: code that holds a parent reference must still be able
      to call the method. Widening is fine, so a `protected` parent method can be overridden as
      `public`.
  - q: "`class Robot extends Machine implements Walker`. Both `Machine` and `Walker` provide `move()` (`Walker`'s as a default). Which runs?"
    options:
      - "`Machine.move()`: a superclass method beats an interface default"
      - "`Walker.move()`: interfaces win"
      - "It doesn't compile until `Robot` overrides `move()`"
      - "Whichever was declared first"
    correct: 1
    a: >-
      Class methods take priority over interface defaults ("class wins"). The compile error only
      happens when two *interfaces* supply the same default.
---

## The idea

Inheritance lets a class reuse and specialise another; **polymorphism** lets code written
against a general type work with any of its subtypes. The useful question isn't "what is
polymorphism", it's **who decides which method runs, and when**:

- **The compiler** decides which *overload* to call and which *field* or *static method* you
  mean, from the variable's declared type.
- **The JVM** decides which *overridden instance method* runs, from the object's real class at
  run time.

Almost every inheritance surprise comes from mixing those two up.

## How it works

### Static type vs runtime type

In `Animal pet = new Dog();` the variable's **static type** is `Animal` (that's all the compiler
knows) and the object's **runtime type** is `Dog`.

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 250" role="img" aria-labelledby="dd-title dd-desc"><title id="dd-title">Who decides which member is used</title><desc id="dd-desc">For Animal pet = new Dog(): the compiler uses the static type Animal to pick overloads, fields and static methods. The JVM uses the runtime type Dog to pick overridden instance methods, so pet.sound() runs Dog.sound().</desc><defs><marker id="dd-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="dd-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><rect class="d-box" x="250" y="14" width="260" height="50" rx="10"/><text class="d-text" x="380" y="44" text-anchor="middle">Animal pet = new Dog();</text><rect class="d-box" x="20" y="110" width="320" height="120" rx="10"/><text class="d-label" x="40" y="134">COMPILE TIME · STATIC TYPE Animal</text><text class="d-text" x="40" y="162">which overload: describe(Animal)</text><text class="d-text" x="40" y="186">fields: pet.name → Animal's</text><text class="d-text" x="40" y="210">static methods: Animal.kind()</text><rect class="d-box hi" x="420" y="110" width="320" height="120" rx="10"/><text class="d-label hi" x="440" y="134">RUN TIME · RUNTIME TYPE Dog</text><text class="d-text" x="440" y="162">overridden methods:</text><text class="d-text" x="440" y="186">pet.sound() → Dog.sound()</text><text class="d-sub" x="440" y="210">dynamic dispatch</text><path class="d-line" d="M320 64 L200 108" marker-end="url(#dd-ah)"/><path class="d-line hi" d="M440 64 L560 108" marker-end="url(#dd-ah-hi)"/></svg>
<figcaption>Only overridden instance methods follow the real object. Everything else is fixed by the declared type when the code compiles.</figcaption>
</figure>

```java
public class Dispatch {
    static class Animal {
        String name = "animal";
        static String kind() { return "Animal.kind()"; }
        String sound() { return "..."; }
    }

    static class Dog extends Animal {
        String name = "dog";                           // hides Animal.name
        static String kind() { return "Dog.kind()"; }  // hides Animal.kind()
        @Override String sound() { return "Woof"; }    // overrides
    }

    static String describe(Object o) { return "describe(Object)"; }
    static String describe(Animal a) { return "describe(Animal)"; }
    static String describe(Dog d)    { return "describe(Dog)"; }

    public static void main(String[] args) {
        Animal pet = new Dog();        // static type Animal, runtime type Dog

        // Overriding: chosen at run time from the object's real class
        System.out.println("pet.sound():        " + pet.sound());

        // Overloading: chosen at compile time from the variable's declared type
        System.out.println("describe(pet):      " + describe(pet));
        System.out.println("describe((Dog)pet): " + describe((Dog) pet));
        Object obj = pet;
        System.out.println("describe(obj):      " + describe(obj));

        // Fields and static methods are not polymorphic
        System.out.println("pet.name:           " + pet.name);
        System.out.println("((Dog) pet).name:   " + ((Dog) pet).name);
        System.out.println("Animal.kind():      " + Animal.kind());
        System.out.println("Dog.kind():         " + Dog.kind());

        // instanceof with a pattern (Java 16+)
        if (pet instanceof Dog d) System.out.println("pattern match:      " + d.sound());

        // A wrong cast compiles but fails at run time
        try {
            Animal other = new Animal();
            Dog bad = (Dog) other;
        } catch (ClassCastException e) {
            System.out.println("bad cast:           ClassCastException");
        }
    }
}
```
{: .runnable}

```text
pet.sound():        Woof
describe(pet):      describe(Animal)
describe((Dog)pet): describe(Dog)
describe(obj):      describe(Object)
pet.name:           animal
((Dog) pet).name:   dog
Animal.kind():      Animal.kind()
Dog.kind():         Dog.kind()
pattern match:      Woof
bad cast:           ClassCastException
```
{: .run-output}

### Rules for overriding

| Rule | Allowed | Not allowed |
| --- | --- | --- |
| Signature | Same name and parameter types | Different parameters: that's an overload |
| Return type | Same, or a subtype (covariant return) | A different, unrelated type |
| Access | Same or wider (`protected` → `public`) | Narrower (`public` → package-private) |
| Checked exceptions | Same, narrower, or none | New or broader checked exceptions |
| Which methods | Non-`private`, non-`static`, non-`final` instance methods | `private` (not inherited), `static` (hidden instead), `final` |

Put `@Override` on every override. If the signature doesn't match a parent method, the
compiler stops you, instead of silently creating an overload.

`super.method()` calls the parent's version from inside an override, and `super(...)` calls a
parent constructor (see the previous chapter for the order).

### Interfaces and abstract classes

| Aspect | Interface | Abstract class |
| --- | --- | --- |
| A class can have | Many | One |
| Fields | Only constants (`public static final`) | Any fields, with state |
| Constructors | No | Yes |
| Methods | `abstract`, `default` (Java 8), `static` (Java 8), `private` (Java 9) | Any |
| Best for | A capability: `Comparable`, `Runnable`, `PaymentGateway` | Shared state and code for closely related classes |

An interface with exactly one abstract method is a **functional interface**, which is what lets
you write a lambda for it (`Runnable r = () -> ...`). An interface whose methods are all
`default` has no abstract method, so a lambda can't implement it.

### When two defaults collide

```java
public class Defaults {
    interface Walker {
        default String move() { return "walk"; }
    }

    interface Swimmer {
        default String move() { return "swim"; }
        static String medium() { return "water"; }       // called as Swimmer.medium()
    }

    // Two defaults with the same signature: the class must choose
    static class Duck implements Walker, Swimmer {
        @Override
        public String move() { return Walker.super.move() + " and " + Swimmer.super.move(); }
    }

    static class Machine {
        public String move() { return "roll"; }
    }

    // A method from the superclass beats an interface default
    static class Robot extends Machine implements Walker { }

    static abstract class Shape {
        private final String label;                      // abstract classes can hold state
        Shape(String label) { this.label = label; }
        abstract double area();
        public String toString() { return label + " with area " + area(); }
    }

    static class Square extends Shape {
        private final double side;
        Square(double side) { super("square"); this.side = side; }
        @Override double area() { return side * side; }
    }

    public static void main(String[] args) {
        System.out.println("Duck:   " + new Duck().move());
        System.out.println("Robot:  " + new Robot().move());
        System.out.println("Static: " + Swimmer.medium());
        Shape s = new Square(3);
        System.out.println("Shape:  " + s);
    }
}
```
{: .runnable}

```text
Duck:   walk and swim
Robot:  roll
Static: water
Shape:  square with area 9.0
```
{: .run-output}

- `Duck` gets `move()` from two interfaces, so it must override it and choose; `X.super.move()`
  calls a specific interface's default.
- `Robot` gets `move()` from its superclass and from an interface: **the class wins**, so no
  override is needed.

### Composition over inheritance

```java
// Inheritance: OrderList IS-A ArrayList, so callers can use every ArrayList method,
// including ones that skip your rules (add(int, E), addAll, removeIf, ...)
class OrderList extends ArrayList<Order> { }

// Composition: OrderBook HAS-A list and exposes only what it means to
class OrderBook {
    private final List<Order> orders = new ArrayList<>();

    void place(Order order) {
        if (order.quantity() <= 0) throw new IllegalArgumentException("quantity must be positive");
        orders.add(order);
    }

    List<Order> all() { return List.copyOf(orders); }
}
```

## Pitfalls

- **Expecting overloads to follow the runtime type.** They follow the declared type; only
  overrides are dynamic.
- **Forgetting `@Override`.** A typo in the name or parameter types creates a new method, and
  the parent's version still runs.
- **Hiding fields.** Declaring a field with the same name as a parent's field creates a second
  field. Keep fields `private` and use methods.
- **Downcasting without checking.** `(Dog) animal` compiles but throws `ClassCastException`
  for any other animal. Use `if (animal instanceof Dog d)` (Java 16+).
- **Deep inheritance trees.** Each level couples to the one above. Two levels is usually plenty.
- **Extending classes not designed for it.** Overriding one method of a library class can break
  others that call it internally. Wrap it instead.

## When to use what

| Need | Use |
| --- | --- |
| Several unrelated classes share a capability | An interface |
| Closely related classes share fields and code | An abstract class, often behind an interface |
| Reuse another class's behaviour | Composition: keep it in a field and delegate |
| A fixed, known set of subtypes | A sealed interface or class (later in this series) |
| One method to implement as a lambda | A functional interface |
| Different behaviour per argument type at compile time | Overloading |
| Different behaviour per object at run time | Overriding |

## Further reading

- [Java Language Specification, Java SE 21: Overriding and hiding](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.4.8)
- [Java Language Specification, Java SE 21: Interfaces](https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html)
- [The Java Tutorials: Default methods](https://docs.oracle.com/javase/tutorial/java/IandI/defaultmethods.html)
