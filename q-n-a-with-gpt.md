# Q&A with GPT

I've also asked GPT to answer some questions about the paper, and here are the questions and answers:

## Questions

### Q1

#### Q: I didn't get this part in the paper:

```haskell
instance Applicative Fetch where
  pure = return Done
  Done g <*> Done y = Done (g y)
  Done g <*> Blocked c = Blocked (g <$> c)
  Blocked c <*> Done y = Blocked (c <*> Done y)
  Blocked c <*> Blocked d = Blocked (c <*> d)
```

> This is the key piece of our design: when computations in Fetch are composed using the <*> operator, both arguments of <*> can be explored to search for Blocked computations, which creates the possibility that a computation may be blocked on multiple things simultaneously.

#### A: 

Let’s unpack this **very slowly, painfully clearly**, using plain language, diagrams, and the Feynman style.
This piece *is* the absolute core of the Haxl engine, and it’s 100% normal to struggle the first time you see it.

##### First: What is `Fetch`?

In the paper, a `Fetch a` represents:

* either a value of type `a` that is already available (`Done a`),
* or a computation that is *blocked* because it needs some outstanding data-source requests to finish (`Blocked ...`).

You can picture:

```
data Fetch a
  = Done a                     -- we already know the result
  | Blocked (Requests, Cont)   -- we are waiting for outstanding requests
```

Not the exact type, but that’s the spirit.

So:
✔ `Done a` = “the answer is ready.”
✔ `Blocked ...` = “I can't finish because I’m waiting for data.”

##### Second: Applicative means we need to define `<*>`

Applicative requires:

```haskell
(<*>) :: Fetch (a -> b) -> Fetch a -> Fetch b
```

Read this as:

> “Given a *fetch* that will eventually produce a function
> AND a *fetch* that will eventually produce an argument,
> produce a *fetch* that will eventually produce the result.”

In *normal* Applicatives (like for `Maybe`), this is trivial.

But for **Haxl**, something special is happening:

###### ⛔ Either side MAY be waiting on one or more outstanding requests.

So `<*>` must allow **looking inside each side**, discovering all outstanding pending I/O, and combining them.

This is where the magic happens.

##### 🔧 The Instance

Here is the applicative instance again, now explained line-by-line:

```haskell
instance Applicative Fetch where
  pure = return
```

`pure` just wraps a value in `Done`

###### Case 1: Both sides are Done

```haskell
  Done g <*> Done y = Done (g y)
```

Straightforward:

* No pending requests.
* Apply the function directly.

###### Case 2: Left is Done, Right is Blocked

```haskell
  Done g <*> Blocked c = Blocked (g <$> c)
```

Interpretation:

* Right side is waiting on some request (`Blocked c`)
* Left side already has the function `g`
* `g <$> c` means “once `c` becomes available, apply `g` to it”.

Most importantly:

The WHOLE computation is now blocked, because part of it is blocked.

###### Case 3: Left is Blocked, Right is Done

```haskell
  Blocked c <*> Done y = Blocked (c <*> Done y)
```

Symmetric case:

* Left is blocked.
* Right is ready.
* The entire computation remains blocked, and we recursively compose deeper.

###### Case 4: Both sides are Blocked

```haskell
  Blocked c <*> Blocked d = Blocked (c <*> d)
```

This is the deep magic.

Both computations are waiting on requests.
But Haxl does **not** decide “wait left first, then right”.

Instead it **combines the blockages**:

The resulting computation is blocked on *all requests from both sides*.

In other words:

```
Blocked(c) <*> Blocked(d)
= a new Blocked whose waiting set is the UNION of both waiting sets
```

##### 🎯 And this is the real meaning of the sentence in the paper:

> “when computations in Fetch are composed using the <*> operator,
> both arguments of <*> can be explored to search for Blocked computations,
> which creates the possibility that a computation may be blocked on multiple things simultaneously.”

Let’s rewrite this in human words:

✔ Applicative composition allows Haxl to **look inside both arguments**

✔ detect *all* pending requests in both arguments

✔ combine them

✔ and wait for them **in parallel**.

##### 🧠 Why is this crucial?

Because this property allows Haxl to do **parallel fetch scheduling**.

Example:

```haskell
user   <- fetchUser uid
groups <- fetchGroups uid
```

Translated to Applicative form:

```
UserAndGroups <$> fetchUser <*> fetchGroups
```

Suppose:

* `fetchUser` requests → `[GetUser uid]`
* `fetchGroups` requests → `[GetGroups uid]`

When the two Fetch computations are combined with `<*>`, the applicative instance:

→ digs into both

→ finds both sets of pending requests

→ merges them

→ produces a *Blocked* computation waiting on *both* requests

Thus:

```
Blocked Request{GetUser uid, GetGroups uid}
```

Then the Haxl engine sends BOTH requests together and waits.

This is how Haxl discovers:

“Oh! These requests don’t depend on each other — run them in parallel.”

##### 🔬 Visual Timeline

###### Without Haxl

```
fetchUser(uid)
  ↓
fetchGroups(uid)
  ↓
combine
```

Sequential, slow.

###### With Haxl Applicative `<*>`

```
fetchUser(uid) ---->
                    [send together] ---> wait ---> resume
fetchGroups(uid) ->
```

Parallel, fast.

##### Summary in One Breath

This Applicative instance enables Haxl to:

* inspect **both sides** of a computation
* discover **all pending I/O requests**
* merge them
* execute them **in parallel**
* while letting the programmer write nice sequential-looking code.

This is the heart of the system.

### Q2 

#### Q:

Explain:

```haskell
runFetch :: Fetch a -> IO a
runFetch (Fetch h) = do
  r <- h
  case r of
  Done a -> return a
  Blocked br cont -> do
  fetch (toList br)
  runFetch cont
```

#### A:

Let’s break down **`runFetch`** as if you're learning Haxl’s runtime from scratch.
This function is the *engine* that executes a `Fetch a` computation, performing batched I/O as needed.

We will go through it line by line, conceptually and operationally.

---

##### 🔍 First: What is a `Fetch a`?

Recall:

```
data Fetch a = Fetch (IO (FetchResult a))

data FetchResult a
  = Done a
  | Blocked BlockedRequests (Fetch a)
```

So:

* A `Fetch a` is a suspended computation: `IO` that tells you either:

  * `Done a` → result is available
  * `Blocked br cont` → needs to perform requests `br`, and after they complete, continue with `cont`

You can picture it as a **state machine**:

```
Fetch a
   │    run the IO
   ▼
( Done a )              -- final result
( Blocked br cont )     -- needs data, then continue
```

---

##### 📦 Now the code

```haskell
runFetch :: Fetch a -> IO a
runFetch (Fetch h) = do
  r <- h
  case r of
    Done a -> return a
    Blocked br cont -> do
      fetch (toList br)
      runFetch cont
```

Let’s walk through it gently.

---

##### 🥇 Step 1 — Pattern match:

```haskell
runFetch (Fetch h) = do
```

`Fetch h` means:
`h :: IO (FetchResult a)`
So `h` is an I/O action that will tell us what to do next.

---

##### 🥈 Step 2 — Execute one step of the state machine

```haskell
r <- h
```

Now `r` is either:

1. `Done a`
2. `Blocked br cont`

This is *one unit of progress* inside the Fetch computation.

---

##### 🥉 Step 3 — If it's Done, we're finished

```haskell
case r of
  Done a -> return a
```

Easy: no pending requests, final answer is here.

---

##### 🏆 Step 4 — If it's Blocked…

```haskell
Blocked br cont -> do
```

You get:

* `br` = **blocked request set**
  (a bag of multiple pending fetches, existentially wrapped)

* `cont` = **continuation**
  (another `Fetch a` representing “what to do after results arrive”)

The key thing is:
**THIS is where batching happens.**

`br` contains *all pending requests discovered so far*, from all branches of applicative composition.

---

##### 🧨 Step 5 — Perform the batched fetch

```haskell
fetch (toList br)
```

This calls *the user-defined data source layer*:

* `fetch :: [BlockedFetch] -> IO ()`

What happens here?

* The data source implementation looks at all pending requests.
* Groups them by backend (e.g., SQL, Redis, user service)
* Sends as few RPCs as possible.
* Writes results into the corresponding `IVar`s (internal promise cells).

At this moment the placeholders `IVar a` inside the BlockedFetches get filled.

**No `Fetch a` is resumed yet** — this is just the I/O.

---

##### 🔁 Step 6 — Resume the computation

```haskell
runFetch cont
```

Now that all requests are satisfied, we recursively:

* evaluate the continuation `cont`
* which will:

  * read the filled IVars
  * make progress
  * possibly produce another:

    * `Done a`
    * or another `Blocked br2 cont2` (if it encountered new requests)

Thus **another batch** may be discovered.

This loop continues until no more blocking.

---

##### 🌀 Putting It All Together: Execution Loop

The pattern is:

```
1. Run up to the next batch     (pure Haskell)
2. Collect all pending requests
3. Batch them, perform I/O
4. Resume the computation
5. Repeat until Done
```

Operationally:

```
runFetch
   │
   ▼
   Fetch h   ---- run ---->  Done a  →  return a
                 │
                 └──> Blocked br cont
                          │
                          fetch br     (perform I/O)
                          │
                          ▼
                     runFetch cont
```

The recursion is the entire event loop of Haxl.

---

##### 🧠 Deep Insight: Why this is brilliant

This simple recursion is the whole runtime:

* *Applicative* discovering parallel fetch groups → yields larger `br`
* *fetch* batching them → minimal network round-trips
* *IVar* stores results out-of-order → allows continuation to resume at any pace
* *Continuation* represents post-I/O logic → pure and clean

### You write:

```haskell
x <- user
y <- friends x
z <- posts x
return (combine x y z)
```

It executes as:

```
Batch #1: user, friends, posts
↓
Batch #2: maybe more inside friends/posts logic
↓
Done
```

Automatically parallel. Automatically batched. Zero boilerplate.

---

##### 🧁 Summary in One Sentence

**`runFetch` repeatedly runs the Fetch computation until it either finishes or produces a batch of pending requests, executes that batch, and resumes — giving Haxl its automatic batching + parallel fetch behavior.**

---

If you want, I can also:

* draw this as a full timeline/diagram for your slides
* expand on how the continuation `cont` is constructed
* explain how it interacts with the Applicative instance
* show how the existentially-wrapped `BlockedFetch` values are filled

Just ask!

### Q3

#### Q:

I didn't get how different kinds of user-defined fetch function calls are handled

#### A:

Great question — the “continuation” mechanism in **Haxl’s `Fetch` monad** can *feel* like callbacks, but it isn’t exactly the same. Let me explain it step-by-step in a way that makes the mechanics crystal clear.

---

##### 🧠 First: What Is a Continuation in This Context?

A **continuation** is simply:

> “The rest of the computation that still needs to happen after the outstanding data requests finish.”

Unlike callbacks in JS/Node, continuations in Haxl are:

* **pure**, not side-effectful
* **stored inside data structures**, not registered as event handlers
* **driven by the runtime**, not by user code

So the continuation is:
→ *“Once these requests return, here’s what you need to do next.”*

---

##### 🧩 How This Plays Out Internally in Haxl

Let’s review the types:

```haskell
data Result a
  = Done a
  | Blocked (BlockedRequests) (Fetch a)

newtype Fetch a = Fetch (IO (Result a))
```

So a `Fetch a` is an IO action that returns either:

* `Done a`
  → The computation is complete, or

* `Blocked br cont`
  → The computation can’t finish until the **blocked requests (`br`)** are fetched
  → **and then it should resume with `cont`**, the continuation.

---

##### 🍱 How Continuations Are Constructed (Applicative)

This part is subtle but essential.

When you write:

```haskell
x <- dataFetch req1
y <- dataFetch req2
return (x + y)
```

Under the hood the runtime builds something like:

```
Blocked {req1, req2}  (continuation to add x+y)
```

This happens because of the Applicative instance:

```haskell
Blocked c <*> Done y = Blocked (c <*> Done y)
Blocked c <*> Blocked d = Blocked (c <*> d)
```

This means:

* When evaluating `f <*> x`
* If *either* side is blocked,
* We **collect all blocked requests** from both sides
* And build a **new continuation** by combining the rest of the computation.

That is:
**Applicative is the mechanism that extracts all requests and builds the continuation tree.**

---

##### 🔁 Ok, but how does continuation *work* during execution?

Look at `runFetch`:

```haskell
runFetch :: Fetch a -> IO a
runFetch (Fetch h) = do
  r <- h
  case r of
    Done a -> return a

    Blocked br cont -> do
       fetch (toList br)   -- (1) execute all pending requests concurrently
       runFetch cont       -- (2) continue by running the continuation
```

###### Step 1 — Encounter Blocked Computation

When you start running the computation:

* It executes until it hits one or more unread data sources.
* It returns:

```
Blocked br cont
```

where:

* `br` is a *bag of batched requests*
* `cont :: Fetch a` is the data structure representing “what to do next”

###### Step 2 — Haxl Fetches the Requests in Parallel

The engine calls:

```haskell
fetch (toList br)
```

Each data source driver receives its list of requests and issues them in parallel.

###### Step 3 — Resume by Running the Continuation

After all requests complete:

```haskell
runFetch cont
```

Now `cont` will:

* Re-read all the request results from the cache
  (because all fetches are memoized)
* Reconstruct the remaining computation without blocking again on those requests
* Possibly generate new requests (and block again)
* Eventually return `Done a`

---

##### 🔄 This Is Basically: Coroutines + Memoization + Parallel Dispatch

The continuation is effectively:

> A *paused coroutine* representing the remaining computation,
> stored as a pure AST (the `Fetch` structure),
> which can be resumed after the pending requests complete.

In JavaScript terms:

Haxl behaves like:

* slicing async work into chunks
* collecting all outstanding async calls in one phase
* sending them all at once
* then resuming the remaining steps

But unlike JS callbacks:

* the user never writes callbacks
* continuations are generated automatically by `Applicative`
* the runtime controls all scheduling

---

##### 🔍 Visualization

Suppose you write:

```haskell
foo = do
  a <- dataFetch ReqA
  b <- dataFetch ReqB
  return (a + b)
```

Execution flow becomes:

```
foo
 ↓
Blocked { ReqA, ReqB }  (continuation: add results)
 ↓
fetch { ReqA, ReqB }
 ↓   (requests return)
runFetch continuation
 ↓
Done (a + b)
```

---

##### 🆚 Is a Continuation "a Callback"?

Conceptually there is overlap, but in *spirit* it is different:

| Feature          | Callbacks      | Haxl Continuations                      |
| ---------------- | -------------- | --------------------------------------- |
| Who writes them? | user           | runtime                                 |
| Where stored?    | event loop     | `Fetch` data structure                  |
| Side effect?     | usually impure | pure                                    |
| Scheduling       | event-driven   | demand-driven by `runFetch`             |
| Structure        | ad hoc         | algebraically defined via `Applicative` |

So:
➡️ **Continuation ≠ callback**
➡️ But **continuation = abstract representation of “what to do after data arrives”**

---

##### 📌 TL;DR

A continuation in Haxl is:

* The *remaining computation* when you hit unfulfilled data requests.
* Built automatically via the `Applicative` instance of `Fetch`.
* Stored structurally inside `Blocked … cont`.
* Re-executed after batched parallel fetching completes.
* NOT a callback function, but a pure suspended computation.

It gives Haxl:

* Batching
* Parallelism
* Determinism
* Declarative “looks synchronous” style

---

If you want, I can also:

📌 Draw diagrams for your slides
📌 Produce a simplified example without Haskell syntax
📌 Generate a fully polished 15-minute slide deck outline

Just tell me!
