# Vercel Composition Patterns — Lessons Learned

> [!NOTE]
> Applied to the A24 intake stack after running the `vercel-composition-patterns` skill audit.

---

## The Central Question: What Are We Actually Solving?

When a component has too many props, the instinct is to reach for a big pattern (a Provider, a
compound component). But the first question should be: **what is causing the noise?**

In this codebase, the noise in `FloatingComposer` had two separate causes:

1. **Too many related booleans** — `micListening`, `micConnecting`, `micDisabled`, `onMicToggle`
are four props that all describe one thing: the microphone.
2. **Three separate error channels** — `error/onDismissError`, `voiceError/onDismissVoiceError`,
`scribeError/onDismissScribeError` are six props that all describe one thing: dismissable errors.

Fix those two causes and the prop count drops from 17 to ~9 without touching any architecture.

---

## Item 1 — Prop Grouping (The Right First Move)

### The Flat vs. Structured Interface Problem

Think of `FloatingComposerProps` like a **call sheet** for a film shoot. A flat call sheet that
lists 17 crew members with no department labels is technically complete — but nobody can read it
at a glance. A structured call sheet with departments (Camera, Sound, Lighting) is the same
information, organized so it's scannable.

**Before — flat, noisy:**

```tsx
interface FloatingComposerProps {
    micListening?: boolean;
    micConnecting?: boolean;
    micDisabled?: boolean;
    onMicToggle?: () => void;
    error: Error | undefined;
    onDismissError: () => void;
    voiceError?: string | null;
    onDismissVoiceError?: () => void;
    scribeError?: string | null;
    onDismissScribeError?: () => void;
    // ...7 more
}
```

**After — grouped, readable:**

```tsx
interface MicState {
    listening: boolean;
    connecting: boolean;
    disabled: boolean;
    onToggle?: () => void;
}

interface DismissableError {
    message: string | Error;
    onDismiss: () => void;
}

interface FloatingComposerProps {
    mic?: MicState;
    errors: {
        chat?: DismissableError;
        voice?: DismissableError;
        scribe?: DismissableError;
    };
    // ...remaining 7 props
}
```

### Interface vs. Variable — They Serve Different Jobs

This is a two-part solution and both parts are needed:

| Location                | What to write               | Purpose                                                        |
| ----------------------- | --------------------------- | -------------------------------------------------------------- |
| `floating-composer.tsx` | TypeScript `interface`      | Defines the _contract_ — what shape the component accepts      |
| `oracle-tv-scene.tsx`   | `const` variable before JSX | Assembles the grouped object from hooks before passing it down |

**At the call site in `oracle-tv-scene.tsx`:**

```tsx
const micState: MicState = {
  listening: scribe.isListening,
  connecting: scribe.isConnecting,
  disabled: chat.busy,
  onToggle: voiceApisEnabled ? scribe.toggleMic : undefined,
};

<FloatingComposer mic={micState} ... />
```

The interface defines the shape. The variable organizes the data. You need both.

### When is a Provider the right answer instead?

A Provider (React Context) is the right tool when data needs to cross **3+ component layers** where
the middle layers don't use the data at all — they're just passing it through. That's called "prop
drilling."

Here, `OracleTvScene` directly renders `FloatingComposer`. There's no middle layer. One level of
prop passing is not drilling — it's just passing. Save the provider for when a second route or
second intake path needs the same chat/voice/scribe state.

---

## Item 2 — Compound Components (The Right Eventually Move)

### What Is a Compound Component?

A compound component is when one feature is split into multiple named sub-components that share
implicit state through context. Think of it like a film editing suite: the timeline, the viewer, the
audio mixer are separate panels, but they all refer to the same project.

```tsx
// Instead of one component with 17 props:
<FloatingComposer micListening={...} micConnecting={...} ... />

// A compound component looks like:
<OracleComposer.Frame channelLabel={persona.label}>
  <OracleComposer.Errors />
  <OracleComposer.Form>
    <OracleComposer.Textarea />
    <OracleComposer.Mic />
    <OracleComposer.Send />
  </OracleComposer.Form>
</OracleComposer.Frame>
```

### Why Not Now?

At 186 lines, `FloatingComposer` is a single-context component — it's one form, used in one place.
Splitting it into 5-7 sub-components would:

- Create 5-7 new named exports
- Add an internal context just for the sub-components to share state
- Require call sites to import and arrange those pieces

That's more ceremony than the component's current size justifies.

### When to Pull This Trigger

Revisit when any of these are true:

- `FloatingComposer` is reused in a second context with different sub-component arrangements
- The component grows past ~350 lines
- The conditional rendering logic (e.g. showing/hiding mic) becomes hard to follow in a flat
structure

The compound pattern shines when **call sites need to customize layout**, not just data.

---

## Item 3 — Named Component Exports Over Variant Strings (Do This Now)

### The Problem With `variant="crt"`

```tsx
// What does this mean without reading PaletteCard's source?
<PaletteCard variant="crt" filmId={...} />
```

A reader has to go find what variants exist and what `"crt"` does. It's like a prop that hides its
own meaning.

### Named Exports Make Intent Explicit

```tsx
// Self-documenting at the call site:
<CrtPaletteCard filmId={...} />
<PaletteCard filmId={...} />
```

### How to Implement

No new files needed. In `palette-card.tsx`, keep the shared logic in the base component and export
two named wrappers:

```tsx
// The base component stays internal or becomes the default variant
function PaletteCard({ variant = "default", ...props }: PaletteCardProps) {
    // existing logic
}

// Named exports wrap it with the variant pre-applied
export function CrtPaletteCard(props: Omit<PaletteCardProps, "variant">) {
    return <PaletteCard variant="crt" {...props} />;
}

export { PaletteCard };
```

Call sites update from `<PaletteCard variant="crt" />` to `<CrtPaletteCard />` — a 10-minute,
low-risk change.

---

## Summary: Recommended Order

| Order | Change                                      | Effort  | Files Touched                                  |
| ----- | ------------------------------------------- | ------- | ---------------------------------------------- |
| 1     | Group mic + error props into sub-interfaces | ~30 min | `floating-composer.tsx`, `oracle-tv-scene.tsx` |
| 2     | Split `PaletteCard` into named exports      | ~10 min | `palette-card.tsx` + call sites                |
| 3     | Provider + compound composer                | Later   | New context file + rewire                      |

The first two changes remove the friction without adding infrastructure. The third is the right
long-term architecture if the intake grows a second path.
