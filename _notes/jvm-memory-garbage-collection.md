---
title: "JVM memory and garbage collection"
short_title: "JVM memory and garbage collection"
topic: Core Java
date: 2026-11-16
tags: [java, jvm, garbage-collection, memory, g1, zgc]
summary: What the garbage collector decides is garbage, why the heap is split into generations, how G1 and ZGC differ, how Java programs still leak memory, and the flags and logs to look at first.
catalog: jvm-gc
series: core-java
priority: high
questions:
  - q: How does the garbage collector decide what to collect?
    a: >-
      By reachability, not by counting references. Starting from the GC roots (local variables
      on thread stacks, static fields, JNI references and a few others) it follows every
      reference. Anything it can reach is alive; everything else is garbage, even groups of
      objects that refer to each other in a cycle.
  - q: Why is the heap divided into a young and an old generation?
    a: >-
      Because most objects die young (the weak generational hypothesis). New objects go into
      the young generation (Eden), which is collected often and cheaply: only the few survivors
      are copied, to a survivor space. Objects that survive several collections are promoted to
      the old generation, which is collected less often. Collecting a small young area
      frequently is much cheaper than scanning the whole heap.
  - q: What's the difference between G1 and ZGC?
    a: >-
      G1, the default on most machines, divides the heap into regions and collects the ones with
      the most garbage first, aiming for a pause-time target (200 ms by default); young
      collections still pause the application briefly. ZGC does almost all its work
      concurrently with the application, keeping pauses well under a millisecond even for
      very large heaps, at the cost of some CPU and memory. Java 21 adds generational ZGC
      (`-XX:+UseZGC -XX:+ZGenerational`).
  - q: Can a Java program leak memory?
    a: >-
      Yes. The GC frees unreachable objects, so a leak in Java is an object that is still
      reachable but no longer needed: entries added to a static map or cache and never
      removed, listeners that are registered and never unregistered, `ThreadLocal` values left
      on pooled threads, or long-lived collections holding request data. The heap grows until
      `OutOfMemoryError`.
  - q: What do `-Xms` and `-Xmx` set?
    a: >-
      The initial and maximum heap size. Without them the JVM picks defaults from the machine:
      typically a quarter of physical memory as the maximum. In containers, set the heap
      explicitly or use `-XX:MaxRAMPercentage`, and remember the JVM also needs memory outside
      the heap: metaspace, thread stacks, the code cache and direct buffers.
  - q: What is the first thing to look at when a service has GC problems?
    a: >-
      The GC log: run with `-Xlog:gc` (or `-Xlog:gc*` for detail) and look at how often
      collections happen, how long the pauses are, and whether the heap after each old
      collection keeps rising (a leak) or stays flat (just too small). For a leak, take a heap
      dump (`jcmd <pid> GC.heap_dump file.hprof`) and look for what keeps the biggest objects
      reachable.
  - q: Two objects refer only to each other, and nothing else refers to either. Will the GC collect them?
    options:
      - "Yes: they're unreachable from any GC root"
      - "No: each still has a reference"
      - "Only with the Serial collector"
      - "Only if you call System.gc()"
    correct: 1
    a: >-
      Java's collectors trace from roots, so a cycle with no path from a root is garbage.
      Reference counting would leak it; tracing doesn't.
  - q: Where are new objects normally allocated?
    options:
      - "In the young generation (Eden)"
      - "In the old generation"
      - "In metaspace"
      - "On the thread stack, always"
    correct: 1
    a: >-
      New objects start in Eden. Survivors move to a survivor space and, after enough
      collections, to the old generation. The JIT can sometimes avoid a heap allocation entirely
      (escape analysis), but you can't rely on it.
  - q: A static `HashMap` cache gains an entry per request and is never cleared. What happens over time?
    options:
      - "The heap fills up and the service eventually throws OutOfMemoryError"
      - "The GC frees old entries automatically"
      - "The map stops accepting entries at its capacity"
      - "Nothing, because static fields aren't on the heap"
    correct: 1
    a: >-
      Static fields are GC roots, so everything in the map stays reachable forever. Bound the
      cache (an LRU map, or a cache library with size and time limits).
  - q: Which collector aims for sub-millisecond pauses on large heaps?
    options:
      - "ZGC"
      - "Serial"
      - "Parallel"
      - "G1 with default settings"
    correct: 1
    a: >-
      ZGC (and Shenandoah) do marking and compaction concurrently. G1 targets pauses of up to
      200 ms by default, Parallel favours throughput, and Serial is for small heaps and single
      CPUs.
---

## The idea

You never free memory in Java; the **garbage collector** does it for you. It doesn't look for
objects nobody refers to. It starts from a small set of **roots** and finds everything that is
still **reachable**; the rest is garbage. Most of how collectors are designed, and most of how
Java programs still "leak", follows from that one rule.

## How it works

### Reachability and the generations

<figure class="figure" tabindex="0">
<svg viewBox="0 0 760 290" role="img" aria-labelledby="gc-title gc-desc" data-routes='[{"pts": [[110, 220], [250, 220], [390, 220], [540, 220]], "cls": "hi", "w": 2}]'><title id="gc-title">GC roots, reachability and the heap generations</title><desc id="gc-desc">GC roots, such as thread stacks and static fields, point to objects in the heap. Objects reachable from a root are live; an unreachable group, even one whose objects refer to each other, is garbage. New objects are allocated in Eden in the young generation. Survivors of a young collection move to a survivor space, and objects that survive several collections are promoted to the old generation.</desc><defs><marker id="gc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-line" d="M0 0 10 5 0 10z"/></marker><marker id="gc-ah-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="m-hi" d="M0 0 10 5 0 10z"/></marker></defs><text class="d-label" x="20" y="22">GC ROOTS</text><rect class="d-box" x="20" y="34" width="150" height="36" rx="8"/><text class="d-sub" x="95" y="57" text-anchor="middle">thread stacks</text><rect class="d-box" x="20" y="80" width="150" height="36" rx="8"/><text class="d-sub" x="95" y="103" text-anchor="middle">static fields</text><circle class="d-box hi" cx="290" cy="52" r="18"/><circle class="d-box hi" cx="370" cy="52" r="18"/><circle class="d-box hi" cx="290" cy="110" r="18"/><line class="d-line hi" x1="170" y1="52" x2="270" y2="52" marker-end="url(#gc-ah-hi)"/><line class="d-line hi" x1="308" y1="52" x2="350" y2="52" marker-end="url(#gc-ah-hi)"/><line class="d-line hi" x1="170" y1="98" x2="270" y2="108" marker-end="url(#gc-ah-hi)"/><text class="d-label hi" x="400" y="57">reachable: live</text><circle class="d-box warn" cx="560" cy="80" r="18" style="stroke-dasharray:4 3"/><circle class="d-box warn" cx="640" cy="80" r="18" style="stroke-dasharray:4 3"/><line class="d-line" x1="578" y1="74" x2="620" y2="74" marker-end="url(#gc-ah)"/><line class="d-line" x1="622" y1="88" x2="580" y2="88" marker-end="url(#gc-ah)"/><text class="d-label warn" x="530" y="124">a cycle with no path from a root:</text><text class="d-label warn" x="530" y="142">garbage, collected anyway</text><text class="d-label" x="20" y="182">THE HEAP · most objects die young</text><rect class="d-box hi" x="20" y="196" width="180" height="48" rx="8"/><text class="d-text" x="110" y="217" text-anchor="middle">Eden</text><text class="d-sub" x="110" y="235" text-anchor="middle">new objects here</text><rect class="d-box" x="220" y="196" width="140" height="48" rx="8"/><text class="d-text" x="290" y="217" text-anchor="middle">Survivor</text><text class="d-sub" x="290" y="235" text-anchor="middle">copied on minor GC</text><rect class="d-box" x="400" y="196" width="340" height="48" rx="8"/><text class="d-text" x="570" y="217" text-anchor="middle">Old generation</text><text class="d-sub" x="570" y="235" text-anchor="middle">long-lived objects, collected less often</text><line class="d-line" x1="200" y1="220" x2="218" y2="220" marker-end="url(#gc-ah)"/><line class="d-line" x1="360" y1="220" x2="398" y2="220" marker-end="url(#gc-ah)"/><text class="d-label" x="20" y="270">young collections: frequent and cheap, only survivors are copied · old collections: rarer</text></svg>
<figcaption>Liveness is decided by reachability from roots. Generations exist because most objects become unreachable soon after they're created.</figcaption>
</figure>

| Area | Holds | Notes |
| --- | --- | --- |
| Young generation: Eden + survivor spaces | New objects | Collected often; survivors are copied |
| Old generation | Objects that survived several young collections | Collected less often |
| Metaspace | Class metadata | Native memory, outside the heap |
| Thread stacks | Frames and local variables | One per thread; `StackOverflowError` when full |

### The collectors

| Collector | Flag | Pauses | Good for |
| --- | --- | --- | --- |
| G1 | `-XX:+UseG1GC` (the default on most machines) | Short young pauses, target 200 ms | Most services |
| ZGC | `-XX:+UseZGC -XX:+ZGenerational` (Java 21) | Well under 1 ms, mostly concurrent | Large heaps, latency-sensitive services |
| Parallel | `-XX:+UseParallelGC` | Longer, but high throughput | Batch jobs |
| Serial | `-XX:+UseSerialGC` | Stop-the-world, single thread | Tiny heaps, single-CPU containers |

A real G1 log from a small allocation-heavy program on Java 21 (`-Xmx256m -Xlog:gc`):

```text
[0.004s][info][gc] Using G1
[0.038s][info][gc] GC(0) Pause Young (Normal) (G1 Evacuation Pause) 14M->1M(216M) 2.286ms
[0.068s][info][gc] GC(1) Pause Young (Normal) (G1 Evacuation Pause) 60M->1M(216M) 1.071ms
[0.115s][info][gc] GC(2) Pause Young (Normal) (G1 Evacuation Pause) 128M->3M(216M) 1.949ms
```

Each line reads: heap used before → after (heap size), then the pause time. Going from 128 MB to
3 MB in 2 ms is the generational hypothesis in action: almost everything in Eden was already dead.

## In code: how Java runs out of memory

```java
import java.util.*;

public class MemoryErrors {
    // A classic leak: a static cache that only ever grows
    static final Map<String, byte[]> CACHE = new HashMap<>();

    static byte[] render(String page) {
        return CACHE.computeIfAbsent(page, p -> new byte[1024]);   // never evicted
    }

    static int depth = 0;
    static void recurse() { depth++; recurse(); }

    public static void main(String[] args) {
        // Every distinct key stays reachable from a static field, so it can never be collected
        for (int i = 0; i < 10_000; i++) render("/orders?page=" + i);
        System.out.println("cache entries kept alive: " + CACHE.size() + " (about " + CACHE.size() / 1024 + " MB)");

        // Each thread's stack has a fixed size; unbounded recursion runs out of it
        try {
            recurse();
        } catch (StackOverflowError e) {
            System.out.println("StackOverflowError after thousands of frames: " + (depth > 1000));
        }

        // An array larger than the JVM allows at all
        try {
            int[] huge = new int[Integer.MAX_VALUE];
        } catch (OutOfMemoryError e) {
            System.out.println("OutOfMemoryError: " + e.getMessage());
        }

        // Heap settings for this JVM
        Runtime rt = Runtime.getRuntime();
        System.out.println("max heap is set: " + (rt.maxMemory() > 0));
    }
}
```
{: .runnable}

```text
cache entries kept alive: 10000 (about 9 MB)
StackOverflowError after thousands of frames: true
OutOfMemoryError: Requested array size exceeds VM limit
max heap is set: true
```
{: .run-output}

- The static `CACHE` is a GC root, so all 10,000 entries stay alive, however long ago they were
  last used. In a real service this grows until `OutOfMemoryError: Java heap space`.
- `StackOverflowError` is about the thread's stack, not the heap: each call adds a frame.
- `Integer.MAX_VALUE` ints can't be allocated at all, whatever the heap size, so the JVM says so
  directly.

## Pitfalls

- **Unbounded caches and static collections.** Give every cache a size limit or expiry.
- **Listeners and callbacks never removed.** The publisher keeps the subscriber reachable.
- **`ThreadLocal` on pooled threads.** Call `remove()`; see the concurrency series.
- **Calling `System.gc()`.** It's only a hint, often causes a full pause, and hides the real
  problem.
- **Container memory limits.** A heap of 75% of the container leaves too little for metaspace,
  stacks and direct buffers; the container is killed instead of throwing `OutOfMemoryError`.
- **Tuning flags before reading the log.** Measure first: most problems are a leak or a heap that
  is simply too small.

## When to use what

| Situation | Do this |
| --- | --- |
| A typical service | Default G1, with `-Xms` and `-Xmx` set to the same value |
| Pause times hurt (large heap, latency targets) | Try generational ZGC |
| Batch processing, throughput matters most | Parallel GC |
| See what the GC is doing | `-Xlog:gc` or `-Xlog:gc*:file=gc.log` |
| Heap keeps growing | Heap dump with `jcmd <pid> GC.heap_dump`, then find what holds it |
| Crash on out of memory, keep evidence | `-XX:+HeapDumpOnOutOfMemoryError` |

## Further reading

- [HotSpot virtual machine garbage collection tuning guide (Java 21)](https://docs.oracle.com/en/java/javase/21/gctuning/index.html)
- [JEP 439: Generational ZGC](https://openjdk.org/jeps/439)
