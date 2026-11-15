---
title: "How Java runs: JDK, JVM, bytecode and the JIT"
short_title: "How Java runs: JVM, bytecode, JIT"
topic: Core Java
date: 2026-11-15
tags: [java, jvm, bytecode, jit]
summary: What happens between writing a .java file and the CPU running it, and why Java gets faster the longer it runs.
catalog: jvm-basics
series: core-java
priority: high
questions:
  - q: What is the difference between the JDK, the JRE and the JVM?
    a: >-
      The **JVM** runs bytecode: it loads classes, interprets them, compiles hot code and manages
      memory. The **JRE** is the JVM plus the standard class library: everything needed to *run*
      a program. The **JDK** is the JRE plus the tools to *build* one: `javac`, `jar`, `javap`,
      `jlink`, `jshell` and more. Oracle stopped offering a separate JRE with Java 11; some
      vendors still publish JRE builds, but the usual choice today is a JDK, or a small runtime
      made with `jlink` that contains only the modules your app needs.
  - q: What is bytecode, and why does Java use it?
    a: >-
      Bytecode is the instruction set of the JVM, stored in `.class` files. `javac` compiles source
      to bytecode once, and any JVM on any OS and CPU can run it. That's "write once, run
      anywhere": the JVM, not your program, is built per platform. Bytecode is also compact and
      easy to verify before it runs.
  - q: Is Java compiled or interpreted?
    a: >-
      Both. `javac` compiles source to bytecode ahead of time. At run time the JVM starts by
      interpreting bytecode, then the JIT compiler turns frequently used methods into native
      machine code. So most of a long-running program's hot code runs as compiled machine code.
  - q: What does the JIT compiler do, and why does it help?
    a: >-
      It watches which methods and loops run often, then compiles them to machine code while the
      program runs. HotSpot uses tiered compilation: C1 compiles quickly with light
      optimisation and collects a profile, then C2 recompiles the hottest code with heavy
      optimisation (inlining, escape analysis and more) based on how the code really behaves. This is
      why Java services are slower for the first moments after start-up (the "warm-up").
  - q: When is a class loaded, and when is it initialised?
    a: >-
      Classes are loaded lazily, the first time they're needed. **Loading** reads the bytecode,
      **linking** verifies it and prepares static fields with default values, and
      **initialisation** runs static initialisers and static field assignments. Initialisation
      happens on first active use: creating an instance, calling a static method, or reading a
      static field that isn't a compile-time constant. It runs once per class loader.
  - q: What are the three built-in class loaders?
    a: >-
      The **bootstrap** loader (built into the JVM; `getClassLoader()` returns `null`) loads core
      classes such as `java.lang.String`. The **platform** loader loads many other Java SE and
      JDK modules, such as `java.sql`. The **application** (system) loader loads your classes from
      the class path or module path. Each asks its parent first (parent delegation), so your
      code can't replace `java.lang.String`.
  - q: Which tool turns `.java` source files into `.class` files?
    options:
      - "`javac`"
      - "`java`"
      - "`javap`"
      - "`jlink`"
    correct: 1
    a: >-
      `javac` is the compiler. `java` launches the JVM, `javap` disassembles `.class` files, and
      `jlink` builds a custom runtime image from modules.
  - q: "What does `String.class.getClassLoader()` return?"
    options:
      - "`null`, because the bootstrap loader loaded it"
      - "The application class loader"
      - "The platform class loader"
      - "It throws `SecurityException`"
    correct: 1
    a: >-
      Core classes are loaded by the bootstrap loader, which is part of the JVM itself and has no
      Java object to represent it, so the method returns `null`.
  - q: "A class has `static final int LIMIT = 5;` and a static block that prints a message. Another class reads `LIMIT`. Does the message print?"
    options:
      - "No: the constant is copied into the reading class at compile time"
      - "Yes: reading any static field initialises the class"
      - "Yes, but only the first time"
      - "It depends on the JIT"
    correct: 1
    a: >-
      A `static final` field of a primitive or `String` type, set to a constant expression, is a
      compile-time constant. `javac` copies the value into the code that reads it, so the class
      isn't touched and its static block doesn't run. A non-constant static field, such as one
      set from `System.nanoTime()`, would initialise the class.
  - q: Why is a Java service often slower in its first minute than later?
    options:
      - "Code starts out interpreted, and the JIT compiles hot methods as they warm up"
      - "The garbage collector is turned off at start-up"
      - "`javac` keeps compiling the source while the program runs"
      - "Bytecode must be downloaded again for every request"
    correct: 1
    a: >-
      At start-up classes are being loaded and methods run in the interpreter. As methods get
      hot, C1 and then C2 compile them to optimised machine code, and throughput rises. Class
      data sharing, AOT caches and running some warm-up traffic before taking real load all help.
---

## The idea

Java code takes two trips before it runs. First, **`javac` compiles** your `.java` source into
**bytecode**: compact instructions for a virtual machine, saved in `.class` files. Then the
**JVM** loads that bytecode, runs it in an interpreter, and **compiles the hot parts to native
machine code** while the program is running.

That split is why the same `.class` file runs on Linux, macOS and Windows, and why a Java
service gets faster after it has been running for a while.

## How it works

### JDK, JRE and JVM

| Piece | What it is | Contains |
| --- | --- | --- |
| JVM | The engine that runs bytecode | Class loading, interpreter, JIT compilers, garbage collectors |
| JRE | What you need to *run* Java | The JVM plus the standard library (`java.base`, `java.sql`, ...) |
| JDK | What you need to *build* Java | The JRE plus `javac`, `jar`, `javap`, `jlink`, `jshell`, `jcmd`, ... |

Oracle stopped offering a separate JRE with Java 11. Some vendors, such as Eclipse Temurin,
still publish JRE builds, but the usual choice today is to install a JDK, and for deployment to
use `jlink` to build a trimmed runtime that contains only the modules your application uses.

### From source to machine code

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 310" role="img" aria-labelledby="jr-title jr-desc" data-routes='[{"pts": [[150, 60], [400, 60], [465, 90], [465, 118], [110, 118], [110, 178], [250, 205], [440, 205], [600, 205], [650, 205]], "cls": "hi", "w": 2}, {"pts": [[150, 60], [400, 60], [465, 90], [465, 118], [110, 118], [110, 178], [250, 205], [400, 205], [400, 262], [250, 262]], "cls": "ok", "w": 1}]'><title id="jr-title">How Java code runs</title><desc id="jr-desc">Greeter.java is compiled by javac into Greeter.class, which holds bytecode. At run time, inside the JVM, class loaders load the bytecode, the interpreter starts running it, and the JIT compiler turns hot methods into native machine code that runs directly on the CPU. The garbage collector manages the heap the whole time.</desc><defs><marker id="jr-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="jr-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="20">BUILD TIME</text><rect class="d-box" x="20" y="32" width="130" height="56" rx="10"/><text class="d-text" x="85" y="57" text-anchor="middle">Greeter.java</text><text class="d-sub" x="85" y="75" text-anchor="middle">source code</text><rect class="d-box hi" x="400" y="32" width="130" height="56" rx="10"/><text class="d-text" x="465" y="57" text-anchor="middle">Greeter.class</text><text class="d-sub" x="465" y="75" text-anchor="middle">bytecode</text><line class="d-line hi" x1="150" y1="60" x2="398" y2="60" marker-end="url(#jr-ah-hi)"/><text class="d-label hi" x="275" y="50" text-anchor="middle">javac Greeter.java</text><text class="d-label" x="560" y="57">same file runs on</text><text class="d-label" x="560" y="73">any OS and CPU</text><path class="d-line" d="M465 88 V118 H110 V176" marker-end="url(#jr-ah)"/><text class="d-label" x="300" y="112" text-anchor="middle">java Greeter</text><rect class="d-box" x="10" y="140" width="740" height="160" rx="12" style="fill:none;stroke-dasharray:6 5"/><text class="d-label" x="736" y="160" text-anchor="end">RUN TIME · THE JVM</text><rect class="d-box" x="30" y="178" width="160" height="56" rx="10"/><text class="d-text" x="110" y="203" text-anchor="middle">Class loaders</text><text class="d-sub" x="110" y="221" text-anchor="middle">load, verify, initialise</text><rect class="d-box" x="250" y="178" width="150" height="56" rx="10"/><text class="d-text" x="325" y="203" text-anchor="middle">Interpreter</text><text class="d-sub" x="325" y="221" text-anchor="middle">runs bytecode at once</text><rect class="d-box hi" x="440" y="178" width="160" height="56" rx="10"/><text class="d-text" x="520" y="203" text-anchor="middle">JIT: C1 → C2</text><text class="d-sub" x="520" y="221" text-anchor="middle">compiles hot methods</text><rect class="d-box" x="650" y="178" width="90" height="56" rx="10"/><text class="d-text" x="695" y="203" text-anchor="middle">CPU</text><text class="d-sub" x="695" y="221" text-anchor="middle">native code</text><line class="d-line" x1="190" y1="205" x2="248" y2="205" marker-end="url(#jr-ah)"/><line class="d-line hi" x1="400" y1="205" x2="438" y2="205" marker-end="url(#jr-ah-hi)"/><text class="d-label hi" x="420" y="196" text-anchor="middle">hot</text><line class="d-line hi" x1="600" y1="205" x2="648" y2="205" marker-end="url(#jr-ah-hi)"/><rect class="d-box" x="250" y="248" width="350" height="36" rx="8"/><text class="d-sub" x="425" y="271" text-anchor="middle">Heap and garbage collector: objects live here</text></svg>
<figcaption>Build once with <code>javac</code>; the JVM loads the bytecode, interprets it, and compiles the methods that run often to machine code.</figcaption>
</figure>

### Step 1: `javac` writes bytecode

```java
public class Greeter {
    static int add(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        System.out.println("2 + 3 = " + add(2, 3));
    }
}
```

```text
$ javac Greeter.java        # writes Greeter.class
$ java Greeter              # starts a JVM and runs main
2 + 3 = 5
$ javap -c Greeter          # shows the bytecode
  static int add(int, int);
    Code:
       0: iload_0           // push the first int argument
       1: iload_1           // push the second
       2: iadd              // add the top two values
       3: ireturn           // return the result
```

The JVM is a **stack machine**: instructions push values onto an operand stack and pop them
off. A `.class` file also records the class-file version: Java 21 writes major version 65, and
an older JVM refuses to run it with `UnsupportedClassVersionError`.

For a single file you can skip the separate step: `java Greeter.java` compiles it in memory and
runs it (Java 11+).

### Step 2: class loading

Classes are loaded **lazily**, the first time the program needs them. Even a small program
loads a few hundred JDK classes at start-up. Each class goes through three phases:

1. **Loading**: find the bytes and create a `Class` object.
2. **Linking**: *verify* the bytecode is safe, *prepare* static fields with default values
   (`0`, `false`, `null`), and *resolve* references to other classes, often lazily.
3. **Initialisation**: run static field assignments and `static { }` blocks, once, on first
   active use.

Three class loaders are built in, and each asks its parent first:

```java
System.out.println(String.class.getClassLoader());        // null (bootstrap)
System.out.println(java.sql.Date.class.getClassLoader()); // ...PlatformClassLoader
System.out.println(Greeter.class.getClassLoader());       // ...AppClassLoader
```

| Loader | Loads | Example |
| --- | --- | --- |
| Bootstrap | Core modules, built into the JVM | `java.lang.String` |
| Platform | Many other Java SE and JDK modules | `java.sql.Date` |
| Application | Your code, from the class path or module path | `Greeter` |

Because each loader asks its parent first, a class of yours called `java.lang.String` can never
replace the real one.

### Step 3: interpret first, compile what's hot

The JVM starts running bytecode in an **interpreter** straight away. Meanwhile it counts how
often each method and loop runs. HotSpot then uses **tiered compilation**:

- **C1** compiles a warm method quickly, with light optimisation, and adds code to collect a
  profile (which branches are taken, which types appear).
- **C2** recompiles the hottest methods using that profile, with heavy optimisation such as
  inlining small methods, removing unneeded checks, and skipping heap allocation for objects
  that never leave a method (escape analysis).

You can watch it happen with `-XX:+PrintCompilation`:

```text
$ java -XX:+PrintCompilation Hot
  29    8       3       Hot::square (4 bytes)       # tier 3: C1, with profiling
  31   10 %     3       Hot::main @ 4 (32 bytes)    # % = a running loop is swapped to compiled code
  31    9       4       Hot::square (4 bytes)       # tier 4: C2, fully optimised
  31    8       3       Hot::square (4 bytes)   made not entrant   # the C1 version is retired
```

If an assumption behind C2's code stops being true (say a new subclass is loaded), the JVM
**deoptimises**: it falls back to the interpreter and compiles again later.

### Where things live in memory

| Area | Holds | Shared? |
| --- | --- | --- |
| Heap | Every object and array | All threads; managed by the garbage collector |
| Metaspace | Class metadata (since Java 8, replacing PermGen) | All threads; native memory, no limit by default |
| Thread stack | One frame per method call: local variables, operand stack | One per thread (1 MB by default on 64-bit Linux) |
| Code cache | Machine code from the JIT | All threads |

Garbage collection gets its own chapter later in this series; on Java 21 the default collector
on most machines is **G1**.

## In code: when does a class initialise?

```java
public class Init {
    static class Config {
        static final int LIMIT = 5;                      // compile-time constant
        static final long STARTED = System.nanoTime();   // computed at run time
        static { System.out.println("  Config initialised"); }
    }

    public static void main(String[] args) {
        System.out.println("1. Config.class");
        Class<?> c = Config.class;                // loads the class, doesn't initialise it
        System.out.println("2. Config.LIMIT = " + Config.LIMIT);
        System.out.println("3. Config.STARTED");
        long s = Config.STARTED;                  // first active use: initialises
        System.out.println("4. again");
        s = Config.STARTED;                       // static blocks run only once
    }
}
```

```text
1. Config.class
2. Config.LIMIT = 5
3. Config.STARTED
  Config initialised
4. again
```

`LIMIT` is a compile-time constant, so `javac` copied the value `5` into `main` and the class
wasn't touched. `STARTED` needs the class, so reading it runs the static block, exactly once.

## Pitfalls

- **Mixing Java versions.** Code compiled for Java 21 won't start on a Java 17 runtime
  (`UnsupportedClassVersionError`). Use `javac --release 17` when you must support an older
  runtime.
- **Changing a constant in a library without recompiling its users.** Callers keep the old,
  inlined value of a `static final` constant until they are recompiled.
- **Judging performance in the first seconds.** Benchmarks without warm-up measure the
  interpreter. Use a harness such as JMH.
- **Heavy work in static initialisers.** It runs on first use, on whichever thread gets there
  first. If it throws, that first use gets `ExceptionInInitializerError`, the class is marked
  unusable, and every later use fails with `NoClassDefFoundError`.
- **Thinking `java Greeter.java` is how production runs.** It recompiles on every start; it's
  meant for scripts and trying things out.

## When to use what

| Need | Use |
| --- | --- |
| Compile a project | A build tool (Maven or Gradle), which calls `javac` |
| Try a few lines of Java | `jshell` |
| Run a one-file program | `java Program.java` |
| See what the compiler produced | `javap -c` |
| Ship a small runtime with an app | `jlink` |
| See what the JIT is doing | `-XX:+PrintCompilation` |
| Inspect a running JVM | `jcmd <pid> VM.flags`, `jcmd <pid> Thread.print` |

## Further reading

- [The Java Virtual Machine Specification, Java SE 21: Loading, linking and initialising](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-5.html)
- [`javap` tool reference (Java 21)](https://docs.oracle.com/en/java/javase/21/docs/specs/man/javap.html)
- [`jlink` tool reference (Java 21)](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jlink.html)
