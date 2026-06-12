# Function Readability Patterns — A Field Guide

## File outline for docs/readability-patterns-tutorial.md

- `use-oracle-voice.ts` — Why `findLastAssistant` beats inline `.filter().at(-1)`
- `floating-composer.tsx` — Three ways to flatten a ternary, and when to use each
- `use-oracle-chat.ts` — Naming the search loop inside `useEffect`
- `tv-oracle-feed.tsx` — Giving guard clauses names instead of nesting
- `floating-composer.tsx` (again) — Why two error banners should share one component
- `crossword.tsx` — What 400-line components teach us about extraction boundaries

## Table of Contents

1. [Mental Model: The Reader Is the Next Developer](#mental-model-the-reader-is-the-next-developer)
2. [Pattern 1: Name the Search Operation](#pattern-1-name-the-search-operation)
3. [Pattern 2: Flatten Nested Ternaries](#pattern-2-flatten-nested-ternaries)
4. [Pattern 3: Extract Effect Logic into Pure
Helpers](#pattern-3-extract-effect-logic-into-pure-helpers)
5. [Pattern 4: Name Your Guard Conditions](#pattern-4-name-your-guard-conditions)
6. [Pattern 5: DRY Up Repeated JSX Structure](#pattern-5-dry-up-repeated-jsx-structure)
7. [Pattern 6: Know When to Stop Extracting](#pattern-6-know-when-to-stop-extracting)
8. [Testing Checklist](#testing-checklist)
9. [Key Takeaways](#key-takeaways)

---

## Mental Model: The Reader Is the Next Developer

Think of every function as a **scene** in a film. When a director watches dailies, they don't want
to decode what the camera is doing — they want to know *what story beat* is happening. Code works
the same way: the reader should understand the *intent* before they understand the *mechanics*.

**The question to ask before every refactor:** "If I come back to this in six months, will I
understand what this block is *for* without reading every line?"

There are two ways to make code readable:

| Approach | What it does | Cost |
|----------|-------------|------|
| **Name the operation** | Extract a pure function with a descriptive name | One new function, one call site |
| **Name the condition** | Assign a boolean to a `const` before using it | One new line |

Both are cheap. Both compound. Both prevent the "nesting depth panic" that makes you scroll
horizontally at 2am.

---

## Pattern 1: Name the Search Operation

### The Problem

In `use-oracle-voice.ts`, the same search pattern appears twice — finding the last assistant
message in an array:

```tsx
// Line 76-80 — inside consumePendingReplies
const lastAssistantMessage = messages
  .filter((message) => message.role === "assistant")
  .at(-1);

// Line 95-98 — inside the useEffect
const lastAssistant = [...messages]
  .reverse()
  .find((message) => message.role === "assistant");
```

**What's wrong here:**
- Two different implementations of the *same idea* (one uses `filter().at(-1)`, the other
`[...].reverse().find()`)
- The reader must parse array operations before understanding the *intent*: "find the last thing the
assistant said"
- If you ever need to change how you find the last assistant (e.g., exclude empty messages), you
have two spots to fix

### The Fix

Extract a pure helper at module scope. Since it doesn't depend on React at all, it lives outside the
hook:

```tsx
function findLastAssistant(
  messages: OracleUIMessage[],
): OracleUIMessage | undefined {
  return messages.filter((m) => m.role === "assistant").at(-1);
}
```

Both call sites become one-liners:

```tsx
const lastAssistant = findLastAssistant(messages);
```

### Why This Is Better

1. **One implementation** — no drift between call sites
2. **Self-documenting** — the function name tells you what it *does*, not how it *works*
3. **Easy to unit test** — pure function, no React dependency
4. **Refactorable** — change the search logic in one place

### Common Pushback

> [!NOTE]
> "It's only two lines. Is a function call really worth it?"
>
> Yes, because those two lines are *noise*. The reader's brain has to:
> 1. Recognize `.filter(...)` → "we're narrowing"
> 2. Recognize `.at(-1)` → "we want the last one"
> 3. Combine them → "we want the last assistant"
>
> A function call skips steps 1 and 2. The brain reads the name and moves on.

---

## Pattern 2: Flatten Nested Ternaries

### The Problem

In `floating-composer.tsx`, the mic button label uses a 3-level ternary:

```tsx
const micLabel = mic?.listening
  ? "Stop and send"
  : mic?.connecting
    ? "Connecting mic…"
    : "Speak to the oracle";
```

**What's wrong here:**
- The second condition is indented *twice* — your eyes have to track a staircase
- Each `?` and `:` is a branch point; mental stack depth increases with each level
- Adding a fourth state makes it four levels deep

### Option A: The IIFE (Immediately Invoked Function Expression)

**What it is:** An IIFE is a tiny anonymous function you define and call in the same breath —
`(() => { ... })()`. Think of it like **scratch dialogue on set**: the director needs one line
right now, not a new script page in the binder. You write a mini-scene with early returns, run it
once, and assign the result to a `const`.

**Shipped in this codebase** — `floating-composer.tsx` after flattening the mic label staircase:

```tsx
// src/components/intake/floating-composer.tsx
const micLabel = (() => {
  if (mic?.listening) return "Stop and send";
  if (mic?.connecting) return "Connecting mic…";
  return "Speak to the oracle";
})();
```

The `()()` at the end is the invoke — without it you'd assign a *function*, not a string.

**Pros:**
- Flat structure — each condition is at the same indentation
- Early returns — no mental stack tracking
- Easy to add logging or breakpoints between branches
- Stays local — no new export when the logic is one-off to this component

**Cons:**
- Slightly unusual pattern for beginners
- The `()()` syntax is noise
- Wrong tool if the logic is reused or needs unit tests (use a named function instead)

**When to reach for an IIFE vs something else:**

| Situation | Tool |
|-----------|------|
| 3–5 branches, one component, assign to a `const` | IIFE |
| Same branch logic in 2+ files | Named function at module scope |
| 4+ discrete states with fixed labels | Lookup map + small function |
| Branches return JSX trees | Early `return` in the component, or a sub-component — not an IIFE in JSX |

> [!CAUTION]
> Don't put IIFEs inline in JSX: `{(() => { ... })()}`. That hides render logic inside markup.
> Compute the value above the `return`, then reference it: `{micLabel}`.

### Option B: A Lookup Map (for Many States)

If you have 4+ states, prefer a map:

```tsx
const MIC_LABELS = {
  listening: "Stop and send",
  connecting: "Connecting mic…",
  idle: "Speak to the oracle",
} as const;

function micLabel(mic: MicState | undefined): string {
  if (mic?.listening) return MIC_LABELS.listening;
  if (mic?.connecting) return MIC_LABELS.connecting;
  return MIC_LABELS.idle;
}
```

**When to use:**
- IIFE → 3-5 branches, especially when the logic is one-off
- Lookup map → 4+ branches, or when the same lookup is needed in multiple components
- Named function → when the label logic needs to be unit tested or reused

### Which Nested Ternaries Are Bad (and Which Aren't)

Not every `?` is a smell. The problem is **stack depth** and **mixed intent** — when each `:`
branch asks a *different question* than the one above it.

#### Bad: the priority staircase (3+ levels, same variable)

Each `?` waits for the previous branch to fail. Your eyes track indentation like steps on a
staircase:

```tsx
// Before — floating-composer.tsx (mic label)
const micLabel = mic?.listening
  ? "Stop and send"
  : mic?.connecting
    ? "Connecting mic…"
    : "Speak to the oracle";
```

Same pattern, worse placement — nested **inside a JSX attribute** so you can't scan the component
body first:

```tsx
// tv-volume-dial.tsx — aria-label (still a staircase; IIFE or helper would flatten it)
aria-label={
  channelLabel
    ? `${channelLabel} — click to change oracle channel`
    : state === 0
      ? "Tune the oracle channel"
      : `Oracle channel ${state + 1} — click to change`
}
```

**Why it's bad:** three unrelated predicates (`channelLabel`, then `state === 0`, then fallback)
stacked in one expression. Adding a fourth channel state means a fourth step.

#### Bad: nested ternaries that pick different *kinds* of thing

When the false branch isn't "the same decision, other answer" but a whole new question:

```tsx
// Hypothetical — don't write this
{busy
  ? <Spinner />
  : mic?.listening
    ? "Stop and send"
    : <MicIcon />}
```

Strings and components in the same chain — the reader can't predict what type `{...}` evaluates to.

#### Fine: one level, one decision

Binary choices with the same shape on both sides:

```tsx
// floating-composer.tsx — icon swap inside the mic button
{mic.connecting ? (
  <Spinner className="size-4 text-[#9dff9d]/80" aria-hidden />
) : (
  <MicIcon className="size-4" aria-hidden />
)}

// floating-composer.tsx — optional channel line
{channelLabel ? (
  <p className="oracle-tv-composer__channel ...">{channelLabel}</p>
) : null}

// floating-composer.tsx — two error sources, same output type (string)
{errors.voice ? `Voice: ${errors.voice.message}` : `Mic: ${errors.scribe?.message}`}
```

**Rule:** one `?` / one `:` answering one yes/no question → keep the ternary.

#### Fine: two levels when both inputs serve one label

```tsx
// floating-composer.tsx — ComposeStatus
const label =
  status === "submitted"
    ? "Signal sent — waiting for the set."
    : modelResponding
      ? "On air."
      : "Tuning in…";
```

All three branches return the same type (string) from the same two inputs (`status`,
`modelResponding`). It's one thought: "what should the status line say?" Extract only if it grows
past three levels or gets reused.

#### Quick reference

| Pattern | Verdict | Example in repo |
|---------|---------|-----------------|
| 1 level, same type both sides | Keep | `mic.connecting ? <Spinner /> : <MicIcon />` |
| `x ? a : null` optional render | Keep | `{channelLabel ? <p>…</p> : null}` |
| 2 levels, one cohesive string | Borderline OK | `ComposeStatus` label |
| 3+ levels, priority chain | Flatten (IIFE / helper / map) | Mic label (before → IIFE after) |
| 3+ levels inside JSX `{...}` | Flatten + hoist above `return` | `tv-volume-dial` `aria-label` |
| Branches return JSX *and* strings | Never | — (hypothetical anti-pattern) |

### A Note on `ComposeStatus`

The `ComposeStatus` component has a 3-level ternary too:

```tsx
const label =
  status === "submitted"
    ? "Signal sent — waiting for the set."
    : modelResponding
      ? "On air."
      : "Tuning in…";
```

This one is *cohesive* — all branches compute the same variable from the same two inputs. Consider
extracting a helper if it grows past 3 levels, but here the staging is acceptable because it's one
thought.

---

## Pattern 3: Extract Effect Logic into Pure Helpers

### The Problem

In `use-oracle-chat.ts`, a `useEffect` contains a deeply nested loop:

```tsx
useEffect(() => {
  if (finalized.current) return;
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === "tool-finalizeExperience" &&
        (part.state === "input-available" ||
          part.state === "output-available") &&
        part.input
      ) {
        finalized.current = true;
        onFinalize(part.input as ExperienceProfile);
        return;
      }
    }
  }
}, [messages, onFinalize]);
```

**What's wrong here:**
- The effect is 14 lines; 10 of them are search logic
- The effect's *purpose* is "when we see a finalized profile, call onFinalize" — but you can't see
that until you read the whole loop
- The `as ExperienceProfile` cast is hidden inside nested braces
- Can't unit test the search without rendering React

### The Fix

Extract a pure function:

```tsx
function extractFinalizedProfile(
  messages: OracleUIMessage[],
): ExperienceProfile | undefined {
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === "tool-finalizeExperience" &&
        (part.state === "input-available" ||
          part.state === "output-available") &&
        part.input
      ) {
        return part.input as ExperienceProfile;
      }
    }
  }
  return undefined;
}
```

The effect becomes 5 lines:

```tsx
useEffect(() => {
  if (finalized.current) return;
  const profile = extractFinalizedProfile(messages);
  if (profile) {
    finalized.current = true;
    onFinalize(profile);
  }
}, [messages, onFinalize]);
```

### Why This Is Better

| Before | After |
|--------|-------|
| Effect = search + side effect | Effect = side effect only |
| `as` cast hidden in braces | `as` cast in pure function (testable) |
| Can't unit test without React | Can test `extractFinalizedProfile` in isolation |
| 14 lines of mixed concerns | 5 lines of intent, 9 lines of implementation |

### Rule of Thumb

> [!TIP]
> If a `useEffect` body is longer than 10 lines and more than half are not React-specific (no refs,
> no state, no cleanup), extract a pure helper.

---

## Pattern 4: Name Your Guard Conditions

### The Problem

In `tv-oracle-feed.tsx`, the `AssistantBroadcast` component handles `tool-showPalette` parts with
deeply nested conditionals:

```tsx
if (part.type === "tool-showPalette") {
  if (
    part.state === "output-error" ||
    (part.state === "output-available" &&
      part.output &&
      typeof part.output === "object" &&
      "ok" in part.output &&
      part.output.ok === false)
  ) {
    return null;
  }
  if (
    (part.state === "input-available" ||
      part.state === "output-available") &&
    part.input
  ) {
    return (
      <CrtPaletteCard
        filmId={part.input.filmId}
        promptText={part.input.promptText}
      />
    );
  }
}
```

**What's wrong here:**
- Two anonymous boolean expressions — the reader must parse each one to understand the guard
- The second condition duplicates part of the first (checking `output-available`)
- No separation between "what I'm checking" and "what I do about it"

### The Fix

Name each guard:

```tsx
if (part.type === "tool-showPalette") {
  const isFailed =
    part.state === "output-error" ||
    (part.state === "output-available" &&
      part.output &&
      typeof part.output === "object" &&
      "ok" in part.output &&
      part.output.ok === false);
  if (isFailed) return null;

  const hasInput =
    (part.state === "input-available" ||
      part.state === "output-available") &&
    part.input;
  if (!hasInput) return null;

  return (
    <CrtPaletteCard
      filmId={part.input.filmId}
      promptText={part.input.promptText}
    />
  );
}
```

### Why This Is Better

1. **Read the guard name, skip the mechanics** — `if (isFailed) return null` reads like prose
2. **Each guard is a paragraph** — blank line between `isFailed` and `hasInput` signals a new
thought
3. **Debugging is easier** — you can `console.log(isFailed)` without restructuring

### When NOT to Name

> [!CAUTION]
> Don't extract a guard if it's a single comparison:
>
> ```tsx
> // Don't do this — more lines, no benefit
> const isTextPart = part.type === "text";
> if (isTextPart) { ... }
>
> // Just write it inline
> if (part.type === "text") { ... }
> ```
>
> Name guards when the condition spans multiple lines or combines multiple concepts.

---

## Pattern 5: DRY Up Repeated JSX Structure

### The Problem

`floating-composer.tsx` has two error banners with nearly identical markup:

```tsx
{errors.chat ? (
  <div role="alert" className="oracle-tv-composer__error mb-3 flex ...">
    <p className="text-xs leading-snug text-[#ffb4a8]">
      {formatChatError(errors.chat.message)}
    </p>
    <button type="button" onClick={errors.chat.onDismiss} className="...">
      Dismiss
    </button>
  </div>
) : null}

{audioError ? (
  <div role="status" className="oracle-tv-composer__error mb-3 flex ...">
    <p className="text-xs leading-snug text-[#ffb4a8]/80">
      {errors.voice ? `Voice: ${errors.voice.message}` : `Mic: ${errors.scribe?.message}`}
    </p>
    {dismissAudioError ? (
      <button type="button" onClick={dismissAudioError} className="...">
        Dismiss
      </button>
    ) : null}
  </div>
) : null}
```

**What's wrong here:**
- Same CSS classes, same flex layout, same dismiss button pattern — twice
- If you change the error banner styling (margin, padding, font size), you change two places
- The second banner has slightly different `role` and slightly different text color — easy to lose
track of which is which

### The Fix

Extract a `DismissableAlert` sub-component:

```tsx
function DismissableAlert({
  message,
  onDismiss,
  role = "alert",
}: {
  message: React.ReactNode;
  onDismiss?: () => void;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className="oracle-tv-composer__error mb-3 flex items-start justify-between gap-4 px-1"
    >
      <p className="text-xs leading-snug text-[#ffb4a8]">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[0.625rem] uppercase tracking-widest text-[#ffb4a8]/80 hover:text-[#ffb4a8]"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
```

Then the parent JSX becomes:

```tsx
{errors.chat ? (
  <DismissableAlert
    message={formatChatError(errors.chat.message)}
    onDismiss={errors.chat.onDismiss}
  />
) : null}

{audioError ? (
  <DismissableAlert
    role="status"
    message={
      errors.voice
        ? `Voice: ${errors.voice.message}`
        : `Mic: ${errors.scribe?.message}`
    }
    onDismiss={dismissAudioError}
  />
) : null}
```

### Why This Is Better

| Before | After |
|--------|-------|
| 2× the same ~12-line block | 1× the block + 2× the call site |
| CSS changes in 2 files conceptually (both inside the same component) | CSS change in 1 place |
| `role` and color differences are visual noise | Differences are explicit props |

### A Note on Cohesion

The two banners are *not* identical. One uses `role="alert"`, the other `role="status"`. One always
has a dismiss button; the other only sometimes does. If they were truly identical, extraction is a
no-brainer. When they differ, the question is: *do the differences matter enough to keep them
separate?*

Here the differences are props, not structure — so a component with optional props is the right
tool.

---

## Pattern 6: Know When to Stop Extracting

### The Crossword Problem

`crossword.tsx` is 548 lines. It contains:
- Grid building logic (`buildGrid`)
- Cell navigation (`nextCell`, `prevCell`)
- Word tracking (`activeWordCells`, `activeWord`)
- Input handling (`handleKeyDown`, `handleChange`, `commitLetter`)
- Clue lists (`ClueList`)
- A legend (`CrosswordLegend`)

**The question:** Should every one of these be its own file?

**The answer:** No.

### Extraction Boundaries

Think of extraction like scene breaks in a film. You don't cut every time a character speaks — you
cut when the *location* or *time* changes. Same with code:

| Extract When... | Keep Inline When... |
|-----------------|---------------------|
| The logic is reused in 2+ places | It's one-off to this component |
| The logic is complex enough to need its own unit tests | It's 5 lines of clear arithmetic |
| The component is over 400 lines and you lose track | The file is under 250 lines and scannable |
| The sub-component needs different props from different callers | The sub-component is always called with the same props |

`crossword.tsx` is large, but the pieces are **tightly coupled**:
- `buildGrid` only makes sense with `CrosswordLayout`
- `handleKeyDown` only makes sense with `grid`, `values`, and `directionRef`
- `ClueList` only makes sense with `PlacedWord[]`

Extracting these into separate files would create tiny modules with single imports — more
file-system noise than clarity.

### What Would Help Instead

1. **Named sections with comments** — mark the "Grid Logic" section vs the "Event Handlers"
section
2. **Move pure utilities out** — `buildGrid`, `wordCells`, `nextCell`, `prevCell`, `key` could
live in `lib/crossword-grid.ts`
3. **Leave the component as a long read** — if every piece is used once and the file has a clear
top-to-bottom flow, length is acceptable

### The Shot vs. The Sequence

A 548-line component is like a **long take** — one continuous shot. It works when:
- The action flows logically (grid → interaction → rendering)
- You can follow it without jumping between files
- The state is mostly local (not prop-drilled 4 levels)

It fails when:
- You have to scroll up and down to understand one interaction
- State is split between 3 hooks in 3 files *because* of extraction
- Adding one feature requires touching 5 files

`crossword.tsx` is borderline. The grid utilities should probably move to `lib/`, but the component
itself is a single context.

---

## Testing Checklist

Before any readability refactor, verify:

- [ ] **Type check passes** — `bunx tsc --noEmit`
- [ ] **No runtime behavior change** — the refactor is purely structural
- [ ] **Happy path tested** — feature works when everything is normal
- [ ] **Edge path tested** — feature works when data is empty / null / error
- [ ] **Bundle size** — did you add a new module that gets imported everywhere?

After extraction:
- [ ] **Pure functions get unit tests** — `findLastAssistant`, `extractFinalizedProfile`,
`micLabel`
- [ ] **Sub-components get story/tests** — `DismissableAlert` with and without `onDismiss`
- [ ] **Integration test still passes** — the parent component's behavior is unchanged

---

## Key Takeaways

1. **Name the operation, not just the variable.** `findLastAssistant(messages)` is better than
`messages.filter(...).at(-1)` because the name tells you the *intent*.

2. **Ternaries are fine at one level; nested staircases are not.** Priority chains (3+ `?` levels)
and ternaries inside JSX attributes are code smells — flatten with IIFEs, lookup maps, or named
helpers. Single binary choices and cohesive 2-level string picks can stay.

3. **`useEffect` should orchestrate, not compute.** If an effect has a search loop, a data
transform, or a complex conditional, extract a pure helper. Effects are hard to test; pure functions
are easy.

4. **Guard conditions deserve names.** `if (isFailed) return null` is self-documenting.
`if (part.state === "output-error" || (part.state === ...` is not.

5. **DRY is about structure, not just text.** Two JSX blocks with the same DOM shape and the same
CSS classes should share a component, even if their text differs.

6. **Extraction has a cost.** Every new file is a new thing to name, import, and maintain. Don't
extract until the benefit (readability, testability, reuse) outweighs the cost (imports,
indirection, context switching).

7. **The reader is the next developer.** That includes you in three months. Write code you'd want to
read on a Monday morning before coffee.

---

## Reference: Before and After Summary

| File | Pattern | Lines Before | Lines After | Impact |
|------|---------|-------------|-------------|--------|
| `use-oracle-voice.ts` | Name the search | 2× inline | 1× helper + 2× call | Intent visible |
| `floating-composer.tsx` | Flatten ternary | 4-line ternary | 5-line IIFE | No staircase |
| `use-oracle-chat.ts` | Extract pure helper | 14-line effect | 5-line effect + 9-line helper | Testable |
| `tv-oracle-feed.tsx` | Name guards | 2× anonymous | 2× named | Self-documenting |
| `floating-composer.tsx` | DRY JSX | 2× ~12 lines | 1× component + 2× call | Single source of truth |

---

*Document generated from a readability audit of the A24 Oracle puzzle codebase. Patterns align with
the Vercel Composition Patterns lessons learned in
`docs/lessons-learned/vercel-composition-patterns.md`.*
