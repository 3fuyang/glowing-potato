---
theme: ./theme
background: https://cover.sli.dev
title: There is no Fork - Haxl
class: text-center
drawings:
  persist: true
transition: view-transition
mdc: true
duration: 15min
hideInToc: true
---

# There is no Fork: an Abstraction for Efficient, Concurrent, and Concise Data Access

Simon Marlow, Louis Brandy, Jonathan Coens, Jon Purdy

<div class="abs-br m-6 text-sm">
  <a href="https://dl.acm.org/doi/10.1145/2628136.2628144" target="_blank">
    Paper
  </a>
</div>

<style>
h1 {
  font-size: 2.5rem !important;
  text-wrap: pretty;
}
</style>

<!--
Facebook's approach to efficient data fetching at scale.
This paper introduces Haxl, a framework that makes concurrency implicit in data-fetching operations.
-->

---
hideInToc: true
---

# Table of Contents

<Toc />

<style>
.slidev-toc {
  font-size: 1.5rem !important;
}
</style>

---

# What's wrong with Data Access?

What makes it inefficient, sequential and flaky?

<v-clicks>

I/O

- It's slow.

<img src="./assets/latency-numbers.png" alt="Latency numbers" class="h-92 absolute right-[3.5rem] bottom-[2.5rem] shadow-lg">

</v-clicks>

<!--
So what happened? What's wrong with data access? We've seen the title but what exactly makes it inefficient, or sequential, or flaky/brittle?
-->

---
hideInToc: true
---

# What's wrong with Data Access?

What makes it inefficient, sequential and flaky?

I/O

- It's slow.

<v-clicks>

- It's hard to test.

<img src="./assets/works-on-my-machine-meme.png" alt="Works on my machine" class="h-100 absolute right-[3.5rem] bottom-[2.5rem] shadow-lg">

- It's hard to debug.

<div class="w-96 mt-4">
  <blockquote class="flex flex-col gap-1">
    <p class="text-lg">
      “It breaks on my machine.”
    </p>
    <p class="text-right text-lg">—<cite>Your No. 1. Customer</cite></p>
  </blockquote>
</div>

<div class="flex gap-4 items-center">
  <img src="./assets/haxl-logo.png" alt="Haxl" class="shadow-lg h-32 mt-6">
  <p class="text-lg w-80">
    Haxl - The framework that solves
    these problems (almost).
  </p>
</div>

</v-clicks>

---

# Concurrency

You know good about concurrency:

<div v-click class="flex flex-col gap-4">
  <div class="flex gap-4 justify-between">
    <p class="text-2xl">Java</p>

```java
CompletableFuture f1 = ...;
CompletableFuture f2 = ...;
allOf(f1, f2).join();
```

  </div>

  <div class="flex gap-4 justify-between">
    <p class="text-2xl">JavaScript</p>

```javascript
const [r1, r2] = await Promise.all([thing1, thing2])
```

  </div>

  <div class="flex gap-4 justify-between">
    <p class="text-2xl">Python 3</p>

```python
r1,r2 = await asyncio.wait([thing1(),thing2()])
```

  </div>

  <div class="flex gap-4 justify-between">
    <p class="text-2xl">Haskell</p>

```haskell
(r1,r2) <- concurrently thing1 thing2
```

  </div>
</div>

<style>
pre {
  width: 36rem !important;
  font-size: 1rem !important;
}
</style>

---

# What's wrong with this then?

<v-clicks>

1. Mental overhead
    - You have to remember to do so
2. Performance
    - You might wait too early
    - ```java
      CompletableFuture f = ...;
      var result = f.join(); // blocks the execution to wait
      heavyComputation();    // could have been done during waiting!
      ```
3. <span class="text-blue-500">Colored</span> <span class="text-red-500">functions</span>
    - <span class="text-blue-500">Synchronous</span> functions and <span class="text-red-500">asynchronous</span> functions cannot be called isomorphically
    - Crafting concurrency imports **extra structure** to the code

</v-clicks>

<style>
li {
  font-size: 1.25rem !important;
}

pre {
  font-size: 1rem !important;
}
</style>

---

# Why not concurrency by default?

Why sequential by default?

<v-clicks>

- Side effects
- But how often?
- What about when it comes to data access?

<p class="text-center !mt-8 text-lg">

```mermaid
graph LR
    A[Gather data] --> B[Computation]
    B --> C[Output]
```

</p>

The first two steps are side-effects free.

- Real-world examples
  - Web page rendering
  - Build system, etc.

</v-clicks>

<style>
li {
  font-size: 1.25rem !important;
}
</style>

---
hideInToc: true
---

# Why not concurrency by default?

Example: the Events API

<img v-click.hide src="./assets/events.svg" alt="Events API" class="h-96 absolute left-1/2 top-30 -translate-x-1/2">

<img v-after src="./assets/events-2.svg" alt="Events API" class="h-108 absolute left-1/2 top-18 -translate-x-1/2">

---

# Haxl

Haxl is a Haskell library that simplifies access to remote data, such as databases or web-based services.

- Haxl provides an abstraction over concurrent I/O

| Layer          | Primitive                             | What It Does            |
|----------------|---------------------------------------|-------------------------|
| Declaration    | `Request`                           | Define WHAT data exists |
| Implementation | `DataSource`                        | Define HOW to get it    |
| Composition    | `Fetch`, `<*>`, `>>=`               | Describe WHAT you need  |
| Execution      | `runFetch`                          | When to actually fetch  |

- Enables writing sequential code that gets maximum concurrency automatically
- Provides batching and built-in caching

<style>
table {
  font-size: 0.8rem !important;
  margin-top: .75rem !important;
  margin-bottom: 1rem !important;
}
</style>

---

# Example: Events API

<div class="flex gap-4 justify-between items-center">

```haskell
data Request a where
  GetEventUris :: Request [EventUri]
  GetSids      :: Request [Sid]
  GetEvents    :: [EventUri] -> [Sid] -> Request [Event]
  GetEventMeta :: EventUri -> Request EventMeta
  GetIdcName   :: Event -> Request IdcName

do
  eventUris <- getEventUris
  sids <- getSids
  events <- getEvents eventUris sids
  eventMetas <- mapM getEventMeta events
  idcNames <- mapM getIdcName events
  ...
```

<img src="./assets/events-2.svg" alt="Events API" class="h-90">

</div>

<style>
pre {
  width: 30rem !important;
  font-size: 0.8rem !important;
}
</style>

---

# How it works (really briefly)

Crux: How to discover and express the independence of computations?

Expression: Applicative `<*>` instead of Monad `>>=`

- `>>=` combines things sequentially
- `<*>` combines things in parallel

```haskell
(>>=) :: Monad       m => m a        -> (a -> m b) -> m b

(<*>) :: Applicative f => f (a -> b) -> f a        -> f b
```

As `<*>` implemented by Haxl,
it can discover the independence of computations
and combine them in parallel.

<style>
pre {
  margin-top: 1.5rem !important;
  margin-bottom: 2rem !important;
  font-size: 1rem !important;
}
</style>

---
hideInToc: true
---

# How it works (really briefly)

Crux: How to discover and express the independence of computations?

Data-dependencies aren't first-class
- thus compiler support is needed

<v-click>

The ApplicativeDo compiler extension (Added to GHC 8.0, 2016)

```haskell
do
  eventUris <- getEventUris
  sids <- getSids
```

Turns into (with ApplicativeDo):

```haskell
do
  (eventUris, sids) <- (,) <$> getEventUris <*> getSids
```

</v-click>

<style>
pre {
  font-size: 1rem !important;
}
</style>

---
hideInToc: true
---

# How it works (really briefly)

The overall process

```haskell
do
  eventUris <- getEventUris
  sids <- getSids
```

compiles to

```haskell
do
  (eventUris, sids) <- (,) <$> getEventUris <*> getSids
```

reduces to (runtime)

```haskell
fetch [GetEventUris, GetSids]
```

Haxl will call the `fetch` function with the list of requests
and wait for the results.

<style>
pre {
  font-size: 1rem !important;
}
</style>

---

# Batching & Caching

When your I/O becomes data

Batching

- Dependant on the `DataSource` implementation
- Reduces network round trips

Caching

- A local per-run cache that stores
- Performance
- Correctness (consistent view of data within one run)
- Modularity (no need to coordinate caching between components)
- Debuggability - The cache records all the I/O that happened
    - Can be dumped for repro/diagnose

---

# Haxl in Facebook

- Sigma, the rule engine for spam detection
- Generates Haskell code (over 200k loc) from rules
- Haxl enables:
  - Rule authors don't worry about concurrency
  - Caching and memoization happen automatically

<style>
li {
  font-size: 1.25rem !important;
}
</style>

---
layout: center
class: text-center
hideInToc: true
---

# Thank you

<div class="mt-12">

Paper: [There is no Fork](https://dl.acm.org/doi/10.1145/2628136.2628144)

GitHub: [github.com/facebook/Haxl](https://github.com/facebook/Haxl)

</div>

<!--
Final slide
-->
