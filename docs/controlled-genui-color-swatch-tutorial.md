# Controlled GenUI — Color Swatch Game via Vercel AI SDK

**Audience:** Bootcamp grad building an AI-powered Next.js app, comfortable with React hooks  
**Goal:** Build a color palette guessing game that the LLM renders as an interactive React component inside a chat UI using `streamUI`  
**Estimated Time:** 2–3 hours (hands-on)

---

## Table of Contents

1. [Mental Model: Casting Director vs. Set Designer](#mental-model-casting-director-vs-set-designer)
2. [Setup: Install Dependencies](#setup-install-dependencies)
3. [Challenge 1: ColorSwatchGame Component](#challenge-1-colorswatchgame-component)
4. [Challenge 2: Zod Tool Schema](#challenge-2-zod-tool-schema)
5. [Challenge 3: AI Context Provider](#challenge-3-ai-context-provider)
6. [Challenge 4: streamUI Server Action](#challenge-4-streamui-server-action)
7. [Challenge 5: Chat Page](#challenge-5-chat-page)
8. [Full Solutions](#full-solutions)
9. [Testing Checklist](#testing-checklist)
10. [Debugging Tips](#debugging-tips)
11. [Key Takeaways](#key-takeaways)

---

## Mental Model: Casting Director vs. Set Designer

Think of a traditional chat interface like a **film messenger service**:

- The LLM writes a **letter** (text) and sends it to the user
- Every response is the same format: words on a page
- The user reads it, writes back, and the cycle repeats
- No matter what the LLM is describing — a color palette, a game, a map — it's always just prose

What you're building is more like a **full film production**:

- The LLM is the **casting director** — it decides *which scene to shoot* and *who is in it*, based on the conversation
- Your React component is the **set designer** — it decides *what that scene actually looks like* with full interactivity
- The tool call is the **call sheet** — a structured spec passed from the casting director to the crew: `film: "Midsommar", palette: ["#D4B896", "#8B9B6E"], options: [...]`
- `streamUI` is the **video village monitor** — the director sees a live preview stream (the loading state) before the final cut arrives

The LLM never draws pixels or writes CSS. It only decides *when* to invoke the game and *what data* to populate it with. Your component handles everything the user sees and touches.

### Two State Types, Two Different Jobs

`ai/rsc` introduces a concept that confuses most people: there are **two parallel state arrays** running at the same time.

| State | Type | What It Holds | Why |
|-------|------|---------------|-----|
| `AIState` | `{ role, content }[]` | Serializable text — the conversation history | Sent to the LLM on every request so it remembers context |
| `UIState` | `{ id, role, display: ReactNode }[]` | React nodes — what the user actually sees | Never sent to the LLM (React nodes aren't serializable) |

Think of `AIState` as the **script** — what the LLM needs to read to understand where the story is. Think of `UIState` as the **screen** — what the audience actually watches, which can include interactive elements no script could describe.

When the LLM triggers a color game, `AIState` records `"[Presented color game for Midsommar]"` (text). `UIState` records the actual `<ColorSwatchGame />` component. The LLM sees the text summary; the user sees the interactive card.

### What `streamUI` Does

`streamUI` is a server function that:

1. Calls the LLM with your messages and tool definitions
2. If the LLM returns plain text → streams it to a React node via the `text` handler
3. If the LLM calls a tool → runs your `generate` function, which **yields** a loading state immediately, then **returns** the final component when ready

The `generate` function is a JavaScript **async generator** — the `yield` keyword sends the loading state to the client right away, and `return` sends the final component. Two round trips to the client, zero extra API calls.

---

## Setup: Install Dependencies

```bash
npm install ai @ai-sdk/openai zod nanoid
npm install @openrouter/ai-sdk-provider
```

> **Why `@openrouter/ai-sdk-provider` and not just `@ai-sdk/anthropic`?**  
> You're routing through OpenRouter. Vercel's AI SDK is model-agnostic — the provider package is just a thin adapter. The `streamUI` API is identical regardless of which adapter you use.

Verify `ai/rsc` is available (requires `ai` >= 3.x):

```bash
node -e "require('ai/rsc')" && echo "✓ ai/rsc available"
```

Your file structure for this tutorial:

```
app/
  layout.tsx              ← wrap app in AI provider
  page.tsx                ← chat UI
  actions.ts              ← streamUI server action
components/
  ColorSwatchGame.tsx     ← the interactive game component
lib/
  ai-provider.tsx         ← createAI context
```

---

## Challenge 1: ColorSwatchGame Component

**File:** `components/ColorSwatchGame.tsx`

**Concept:** Build the game component in complete isolation from any AI logic. This component has no idea it will live inside a chat — it could be rendered anywhere. That's the whole point of controlled GenUI: the LLM supplies the data, but the component is just a normal React component.

The component needs to:

- Display a row of color swatches from the `palette` array (hex strings)
- Show four film title buttons the user can click
- Reveal the correct answer after a guess
- Call `onGuess` with the film name and whether it was correct — this is how the result gets back to the chat

### Hint

```tsx
// 'use client' is required — this component has interactivity
// It cannot be a Server Component
'use client'

// Three possible button visual states:
// 'default'  → before any guess
// 'correct'  → this is the right answer (show green)
// 'wrong'    → user picked this but it's wrong (show red)
// You only need these states after revealed === true

// Pattern for deriving button state:
const state = revealed
  ? film === correctFilm ? 'correct'
  : film === selected   ? 'wrong'
  : 'idle'
  : 'default'
```

### Starting Code

```tsx
// components/ColorSwatchGame.tsx
'use client'

import { useState } from 'react'

interface ColorSwatchGameProps {
  palette: string[]       // hex colors e.g. ['#D4B896', '#8B9B6E', '#C4A882']
  options: string[]       // exactly 4 film title choices
  correctFilm: string     // the right answer — one of the options
  onGuess?: (film: string, correct: boolean) => void
}

export function ColorSwatchGame({
  palette,
  options,
  correctFilm,
  onGuess,
}: ColorSwatchGameProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(____________)  // TODO: initial state

  function handleGuess(film: string) {
    if (____________) return  // TODO: prevent guessing after revealed
    setSelected(____________) // TODO: record which film was clicked
    setRevealed(____________) // TODO: lock in the answer
    onGuess?.(____________)   // TODO: call the callback with film + whether correct
  }

  return (
    <div className="color-swatch-game">
      {/* TODO: render one div per color in palette */}
      {/* Each div: backgroundColor = color, fixed width and height */}

      <p>Which A24 film does this palette belong to?</p>

      {/* TODO: render one button per option */}
      {/* Each button: onClick calls handleGuess, disabled after revealed */}
      {/* Add a data-state attribute for CSS styling */}

      {/* TODO: show result message only after revealed */}
      {/* Message: "✓ Correct! The palette is from X." or "✗ Not quite. It was X." */}
    </div>
  )
}
```

**Questions to answer before looking at the solution:**

- Why does this file need `'use client'` at the top?
- What would happen if you removed the `if (revealed) return` guard in `handleGuess`?
- The `onGuess` callback uses optional chaining (`onGuess?.()`). Why might the parent not always pass this prop?

---

## Challenge 2: Zod Tool Schema

**File:** `app/actions.ts` (partial — just the schema for now)

**Concept:** The Zod schema is the **contract** between the LLM and your component. It defines exactly what data the AI must provide to invoke the game. If the LLM calls the tool with the wrong shape, Zod rejects it before your component ever renders.

Think of the schema as the call sheet for your set designer. The casting director (LLM) fills it out — film name, palette colors, four options, correct answer. If any field is missing or wrong type, the call sheet gets bounced back.

The schema fields must match your component's props exactly.

### Hint

```typescript
import { z } from 'zod'

// Zod string array with length constraints:
z.array(z.string()).min(3).max(6)  // between 3 and 6 items
z.array(z.string()).length(4)      // exactly 4 items

// .describe() tells the LLM what to put in each field
// Without descriptions, the LLM guesses — and guesses wrong
z.string().describe('The A24 film this palette represents')
```

### Starting Code

```typescript
// In app/actions.ts — define this schema above your server action

const colorGameSchema = z.object({
  correctFilm: z.string().describe('___________'),  // TODO: tell the LLM what this is
  palette: z.array(z.string())
    .___________(3)           // TODO: minimum 3 colors
    .___________(6)           // TODO: maximum 6 colors
    .describe('Hex color codes extracted from the film palette, e.g. #D4B896'),
  options: z.array(z.string())
    .___________(4)           // TODO: exactly 4 choices
    .describe('___________'), // TODO: describe what these are
})
```

**Questions to answer before looking at the solution:**

- Why does `.describe()` matter for LLM tool calls but not for regular form validation?
- The `options` array must include `correctFilm` as one of its four items. Should you enforce that in Zod, or trust the LLM? What are the tradeoffs?
- What happens at runtime if the LLM sends five options instead of four?

---

## Challenge 3: AI Context Provider

**File:** `lib/ai-provider.tsx` and `app/layout.tsx`

**Concept:** `createAI` sets up the two-state architecture from the mental model section. It wires your server actions to the `useUIState` and `useActions` hooks you'll use in the chat page. Think of it as registering the studio's entire crew list — every action your AI can take, and the initial state of both scoreboards (AI and UI).

You wrap the app in this provider the same way you'd wrap it in a React Query provider or a Zustand store — once, at the root.

### Hint

```typescript
import { createAI } from 'ai/rsc'

// createAI takes:
// - actions: the server actions the client can call
// - initialUIState: what the chat looks like before any messages
// - initialAIState: what context the LLM starts with

export const AI = createAI({
  actions: { sendMessage },       // your server action (Challenge 4)
  initialUIState: [] as UIState,
  initialAIState: [] as AIState,
})

// Export the type — you'll need it for useUIState<typeof AI>
// in the chat page
```

### Starting Code

```tsx
// lib/ai-provider.tsx
import { createAI } from 'ai/rsc'
import { sendMessage } from '@/app/actions'  // you'll write this in Challenge 4

// AIState: what the LLM sees — must be serializable
export type AIState = {
  role: 'user' | 'assistant'
  content: string
}[]

// UIState: what the user sees — can be React nodes
export type UIState = {
  id: string
  role: 'user' | 'assistant'
  display: React.ReactNode
}[]

export const AI = createAI({
  actions: { ___________ },          // TODO: register your server action
  initialUIState: ___________ as UIState, // TODO: empty starting state
  initialAIState: ___________ as AIState, // TODO: empty starting state
})
```

```tsx
// app/layout.tsx
import { AI } from '@/lib/ai-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <___________>{children}</___________> {/* TODO: wrap with AI provider */}
      </body>
    </html>
  )
}
```

**Questions to answer before looking at the solution:**

- Why does `AIState` only contain `{ role, content }` strings while `UIState` can hold React nodes?
- What would break if you forgot to wrap the app in the `AI` provider?
- You export `const AI` from `ai-provider.tsx`. Where is this value actually used — in the component or in the hook?

---

## Challenge 4: streamUI Server Action

**File:** `app/actions.ts`

**Concept:** This is the core of the pattern. `streamUI` runs on the server, calls the LLM, and handles two outcomes: plain text (the `text` handler returns JSX) or a tool call (the `generate` generator yields a loading state and returns the final component).

The `generate` function is the key primitive: it's an async generator that lets you send UI to the client in two phases — immediately (loading), and when ready (component). The client sees the loading state the moment the tool is called, before any computation happens.

`getMutableAIState` is how you write back to the conversation history. You update it with the user's message at the start, and call `.done()` with the assistant's response at the end.

### Two Phases of `generate`

```typescript
generate: async function* ({ correctFilm, palette, options }) {
  // Phase 1: sent to client IMMEDIATELY when tool is invoked
  // The LLM has decided to show a game — user sees this right away
  yield <div>Pulling palette from the archive...</div>

  // --- async work could happen here (DB lookup, image fetch, etc.) ---

  // Phase 2: sent to client when generator RETURNS
  // This replaces the loading state in the UI
  return (
    <ColorSwatchGame
      palette={palette}
      options={options}
      correctFilm={correctFilm}
    />
  )
}
```

### Hint

```typescript
// getMutableAIState() gives you a mutable reference to AIState
// .get()    → read current state
// .update() → replace state mid-stream
// .done()   → finalize state (call this before the action returns)

const aiState = getMutableAIState()

// Append user message to history:
aiState.update([
  ...aiState.get(),
  { role: 'user', content: userMessage }
])

// After LLM responds with text:
aiState.done([
  ...aiState.get(),
  { role: 'assistant', content }
])
```

### Starting Code

```typescript
// app/actions.ts
'use server'

import { streamUI, getMutableAIState } from 'ai/rsc'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ColorSwatchGame } from '@/components/ColorSwatchGame'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

export async function sendMessage(userMessage: string) {
  const aiState = getMutableAIState()

  // Append user message before calling the LLM
  aiState.update([
    ...aiState.get(),
    { role: 'user', content: userMessage },
  ])

  const result = await streamUI({
    model: openrouter('___________'),    // TODO: pick a model e.g. 'anthropic/claude-sonnet-4-5'
    system: `You are an A24 film superfan oracle. When the conversation 
    involves discussing A24 films or palettes, use the show_color_game tool 
    to present a palette guessing game. Pick palettes that match the films 
    being discussed. Always include the correct film as one of the four options.`,
    messages: aiState.get(),

    // Plain text response handler
    text: ({ content, done }) => {
      if (done) {
        aiState.done([
          ...aiState.get(),
          { role: 'assistant', content },
        ])
      }
      return <p className="chat-text">{content}</p>
    },

    tools: {
      show_color_game: {
        description: '___________',   // TODO: describe when the LLM should call this
        parameters: ___________ ,     // TODO: use your colorGameSchema from Challenge 2

        generate: async function* ({ correctFilm, palette, options }) {
          // Phase 1: loading state — sent immediately
          yield (
            <div className="game-loading">
              <p>Pulling palette from the archive...</p>
            </div>
          )

          // Update AIState to record that a game was shown
          aiState.done([
            ...aiState.get(),
            {
              role: 'assistant',
              content: `[Presented color palette game for ${___________}]`, // TODO: film name
            },
          ])

          // Phase 2: final component — replaces loading state
          return (
            <ColorSwatchGame
              palette={___________}     // TODO: pass palette prop
              options={___________}     // TODO: pass options prop
              correctFilm={___________} // TODO: pass correctFilm prop
            />
          )
        },
      },
    },
  })

  return {
    id: nanoid(),
    role: 'assistant' as const,
    display: result.value,
  }
}
```

**Questions to answer before looking at the solution:**

- Why does `text` check `if (done)` before calling `aiState.done()`?
- What is `result.value` — why isn't it just `result`?
- If the LLM calls the tool but your `generate` function throws, what does the user see?
- Why is `'use server'` at the top of this file and not on just the function?

---

## Challenge 5: Chat Page

**File:** `app/page.tsx`

**Concept:** The chat page uses two hooks from `ai/rsc`:

- `useUIState<typeof AI>` — a stateful array of `{ id, role, display }` objects. This is what you render in the message list. It holds React nodes, not strings.
- `useActions<typeof AI>` — gives you the server actions registered in `createAI`. You call `sendMessage` from here rather than importing it directly, because the hook handles the RSC streaming protocol.

When the user submits a message, you optimistically add it to `UIState` (so the input appears immediately in the list), then call `sendMessage` and append the response. The response's `display` field is the React node returned by your server action — either a plain `<p>` for text or a `<ColorSwatchGame />` for a tool call.

### Hint

```typescript
// useUIState returns a [state, setter] tuple like useState
const [messages, setMessages] = useUIState<typeof AI>()

// Optimistic update — add user message immediately before the server responds
setMessages(prev => [
  ...prev,
  {
    id: Date.now().toString(),
    role: 'user',
    display: <p>{input}</p>,    // render immediately
  },
])

// Then call the server action and append the response
const response = await sendMessage(input)
setMessages(prev => [...prev, response])
```

### Starting Code

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import { useUIState, useActions } from 'ai/rsc'
import type { AI } from '@/lib/ai-provider'

export default function ChatPage() {
  const [messages, setMessages] = useUIState<typeof ___________>() // TODO: pass AI type
  const { sendMessage } = useActions<typeof ___________>()          // TODO: pass AI type
  const [input, setInput] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const currentInput = input
    setInput('')  // clear input field before awaiting

    // Optimistically add user message to UI
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user' as const,
        display: ___________, // TODO: render the user's message as JSX
      },
    ])

    // Call server action and append response
    const response = await ___________(currentInput) // TODO: call sendMessage
    setMessages(prev => [...prev, ___________])       // TODO: append response
  }

  return (
    <main className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} data-role={msg.role} className="message">
            {___________} {/* TODO: render msg.display */}
          </div>
        ))}
      </div>

      {/* IMPORTANT: do not use <form> — use a div with onSubmit pattern */}
      {/* In Next.js App Router, <form> without action triggers server actions */}
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
          placeholder="Ask about A24 films..."
        />
        <button onClick={handleSubmit}>Send</button>
      </div>
    </main>
  )
}
```

**Questions to answer before looking at the solution:**

- Why do you clear the input field (`setInput('')`) before awaiting `sendMessage` rather than after?
- `msg.display` is a `ReactNode` — why don't you need to do anything special to render it in JSX?
- What's the difference between calling `sendMessage` via `useActions` vs. importing it directly from `actions.ts`?

---

## Full Solutions

### ✓ Challenge 1: ColorSwatchGame Component

```tsx
// components/ColorSwatchGame.tsx
'use client'

import { useState } from 'react'

interface ColorSwatchGameProps {
  palette: string[]
  options: string[]
  correctFilm: string
  onGuess?: (film: string, correct: boolean) => void
}

export function ColorSwatchGame({
  palette,
  options,
  correctFilm,
  onGuess,
}: ColorSwatchGameProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  function handleGuess(film: string) {
    if (revealed) return
    setSelected(film)
    setRevealed(true)
    onGuess?.(film, film === correctFilm)
  }

  return (
    <div className="color-swatch-game">
      <div className="swatches" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {palette.map((color, i) => (
          <div
            key={i}
            style={{
              backgroundColor: color,
              width: 72,
              height: 72,
              borderRadius: 4,
            }}
          />
        ))}
      </div>

      <p>Which A24 film does this palette belong to?</p>

      <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((film) => {
          const state = revealed
            ? film === correctFilm
              ? 'correct'
              : film === selected
              ? 'wrong'
              : 'idle'
            : 'default'

          return (
            <button
              key={film}
              onClick={() => handleGuess(film)}
              data-state={state}
              disabled={revealed}
            >
              {film}
            </button>
          )
        })}
      </div>

      {revealed && (
        <p className="result" style={{ marginTop: 12 }}>
          {selected === correctFilm
            ? `✓ Correct! The palette is from ${correctFilm}.`
            : `✗ Not quite. It was ${correctFilm}.`}
        </p>
      )}
    </div>
  )
}
```

**Key points:**

- `'use client'` is required because this component uses `useState` and `onClick`. Server Components cannot have state or event handlers.
- The `data-state` attribute lets you style button states in CSS without conditional `className` strings — `button[data-state="correct"] { background: green }`.
- `onGuess?.()` uses optional chaining because the component is useful standalone (in tests, Storybook, other pages) where no callback is needed.
- Clearing `revealed` before `selected` isn't possible — always set `selected` first so the button state derivation works correctly on the same render.

---

### ✓ Challenge 2: Zod Tool Schema

```typescript
// In app/actions.ts (above the server action)
const colorGameSchema = z.object({
  correctFilm: z.string().describe(
    'The exact A24 film title that this color palette represents'
  ),
  palette: z.array(z.string())
    .min(3)
    .max(6)
    .describe(
      'Hex color codes from the film\'s dominant palette, e.g. ["#D4B896", "#8B9B6E", "#2C3E50"]'
    ),
  options: z.array(z.string())
    .length(4)
    .describe(
      'Exactly four A24 film title choices. One must be correctFilm. The other three should be plausible distractors from the same era or genre.'
    ),
})
```

**Key points:**

- `.describe()` is injected directly into the tool's JSON Schema that gets sent to the LLM. Without it, Claude will hallucinate what each field means. This is the difference between consistent tool calls and garbage output.
- Enforcing `correctFilm` is one of the four `options` in Zod would require a `.refine()` that compares two fields — valid Zod, but puts a constraint the LLM can't see. Better to put it in the `.describe()` of `options` so the model knows to include it.
- Zod validation runs automatically before `generate` is called — if the LLM sends five options, the tool call fails with a validation error, not a runtime crash inside your component.

---

### ✓ Challenge 3: AI Context Provider

```tsx
// lib/ai-provider.tsx
import { createAI } from 'ai/rsc'
import { sendMessage } from '@/app/actions'

export type AIState = {
  role: 'user' | 'assistant'
  content: string
}[]

export type UIState = {
  id: string
  role: 'user' | 'assistant'
  display: React.ReactNode
}[]

export const AI = createAI({
  actions: { sendMessage },
  initialUIState: [] as UIState,
  initialAIState: [] as AIState,
})
```

```tsx
// app/layout.tsx
import { AI } from '@/lib/ai-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AI>{children}</AI>
      </body>
    </html>
  )
}
```

**Key points:**

- `createAI` returns a React context component (`AI`) — that's why you can use it as `<AI>` in layout.tsx.
- The exported `typeof AI` is used by the hooks: `useUIState<typeof AI>()` gives you type-safe access to your `UIState` shape.
- `initialAIState: []` means the LLM starts each session with no context. For a persistent experience, you'd hydrate this from a database on the server before rendering the layout.

---

### ✓ Challenge 4: streamUI Server Action

```typescript
// app/actions.ts
'use server'

import { streamUI, getMutableAIState } from 'ai/rsc'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ColorSwatchGame } from '@/components/ColorSwatchGame'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const colorGameSchema = z.object({
  correctFilm: z.string().describe(
    'The exact A24 film title that this color palette represents'
  ),
  palette: z.array(z.string())
    .min(3).max(6)
    .describe('Hex color codes from the film\'s dominant palette'),
  options: z.array(z.string())
    .length(4)
    .describe(
      'Exactly four A24 film title choices. One must be correctFilm. Three should be plausible distractors.'
    ),
})

export async function sendMessage(userMessage: string) {
  const aiState = getMutableAIState()

  aiState.update([
    ...aiState.get(),
    { role: 'user', content: userMessage },
  ])

  const result = await streamUI({
    model: openrouter('anthropic/claude-sonnet-4-5'),
    system: `You are an A24 film superfan oracle. When the conversation 
    involves discussing A24 films, directors, or moods, use the show_color_game 
    tool to present a palette guessing game. Pick real palettes from films 
    discussed. Always include the correct film as one of the four options.`,
    messages: aiState.get(),

    text: ({ content, done }) => {
      if (done) {
        aiState.done([
          ...aiState.get(),
          { role: 'assistant', content },
        ])
      }
      return <p className="chat-text">{content}</p>
    },

    tools: {
      show_color_game: {
        description:
          'Show an A24 film color palette for the user to identify. Use when discussing film palettes, moods, or cinematography.',
        parameters: colorGameSchema,

        generate: async function* ({ correctFilm, palette, options }) {
          yield (
            <div className="game-loading">
              <p>Pulling palette from the archive...</p>
            </div>
          )

          aiState.done([
            ...aiState.get(),
            {
              role: 'assistant',
              content: `[Presented color palette game for ${correctFilm}]`,
            },
          ])

          return (
            <ColorSwatchGame
              palette={palette}
              options={options}
              correctFilm={correctFilm}
            />
          )
        },
      },
    },
  })

  return {
    id: nanoid(),
    role: 'assistant' as const,
    display: result.value,
  }
}
```

**Key points:**

- `text: ({ content, done })` — the `done` flag fires once on the final chunk. Calling `aiState.done()` on every chunk would corrupt the state; only call it when the stream is complete.
- `result.value` is the streamed React node. `result` itself is a `StreamableUIWrapper` — you return `.value` because that's the `ReactNode` the client needs to render.
- `getMutableAIState()` must be called at the top of the server action, not inside `generate`. The generator runs in a different execution context.
- The loading state (`yield`) is not stored in `AIState` — only the final `done()` call is. The LLM never sees `"Loading..."` in its context.

---

### ✓ Challenge 5: Chat Page

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import { useUIState, useActions } from 'ai/rsc'
import type { AI } from '@/lib/ai-provider'

export default function ChatPage() {
  const [messages, setMessages] = useUIState<typeof AI>()
  const { sendMessage } = useActions<typeof AI>()
  const [input, setInput] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const currentInput = input
    setInput('')

    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user' as const,
        display: <p>{currentInput}</p>,
      },
    ])

    const response = await sendMessage(currentInput)
    setMessages(prev => [...prev, response])
  }

  return (
    <main className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} data-role={msg.role} className="message">
            {msg.display}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
          placeholder="Ask about A24 films..."
        />
        <button onClick={handleSubmit}>Send</button>
      </div>
    </main>
  )
}
```

**Key points:**

- Capture `input` in `currentInput` before `setInput('')` — React batches state updates and you need the value for the async call.
- `msg.display` is a `ReactNode` — renders directly in JSX with no `.toString()` or special handling.
- `useActions` vs. direct import: calling the server action via `useActions` routes through the RSC streaming protocol. Importing `sendMessage` directly and calling it would work for the return value but breaks the streaming connection — the loading state (`yield`) won't reach the client.
- No `<form>` tag — in Next.js App Router, a `<form>` without an explicit `action` prop can trigger unintended server action behavior. Use a `<div>` wrapper with `onClick` / `onKeyDown` handlers.

---

## Testing Checklist

Run these in order before calling the implementation complete:

- [ ] `npm install` completed with no peer dependency errors
- [ ] `OPENROUTER_API_KEY` set in `.env.local`
- [ ] `node -e "require('ai/rsc')"` — no error
- [ ] `ColorSwatchGame` renders standalone with hardcoded props (no AI involved)
- [ ] Clicking a correct option shows green state, wrong shows red
- [ ] Clicking again after reveal is blocked (guard works)
- [ ] `npm run dev` starts without TypeScript errors
- [ ] Chat page renders with empty message list
- [ ] Sending a plain text message returns a streamed `<p>` response
- [ ] Sending "show me a palette game" (or similar) triggers the tool call
- [ ] Loading state (`yield`) appears briefly before component renders
- [ ] `ColorSwatchGame` renders inside the chat message with correct swatches
- [ ] All four option buttons appear; one is correct
- [ ] Guessing correctly shows "✓ Correct!" message
- [ ] Guessing wrong shows "✗ Not quite." and highlights the correct answer
- [ ] LLM retains context across multiple messages (AIState is accumulating)

---

## Debugging Tips

**`streamUI` is not exported from `ai/rsc`:**

- Confirm `ai` package version is `>= 3.0` — `streamUI` was added in v3
- Check: `npm list ai` — if it shows `2.x`, run `npm install ai@latest`

**Tool is never called — LLM just responds with text:**

- Check your `system` prompt — it must instruct the LLM to use the tool
- Try a very explicit user message: `"Use the show_color_game tool to show me a palette"`
- Add `toolChoice: 'required'` to `streamUI` temporarily to force tool use during development

**`getMutableAIState` throws "Context not found":**

- You called it inside the `generate` generator — move it to the top of `sendMessage`, before `streamUI`
- Confirm `app/layout.tsx` wraps `children` in `<AI>` — the context must be present

**Loading state (`yield`) never appears — jumps straight to component:**

- The loading state only shows if there's a real async gap between `yield` and `return`
- Add a `await new Promise(r => setTimeout(r, 500))` temporarily to verify the yield works, then remove it

**TypeScript error: `display: ReactNode` is not assignable:**

- Make sure `UIState` in `ai-provider.tsx` types `display` as `React.ReactNode` not `JSX.Element`
- `JSX.Element` is more narrow — it excludes strings and null

**`onGuess` callback never fires:**

- The callback is only useful if you're feeding the result back to the conversation — if you haven't wired that up yet, this is expected
- Verify with `onGuess={(film, correct) => console.log(film, correct)}` in the chat page

**OpenRouter returns 401:**

- Confirm `OPENROUTER_API_KEY` is in `.env.local` (not `.env`)
- Next.js only loads `.env.local` in development; confirm the key is also set in your deployment environment

---

## Key Takeaways

1. **The LLM is the casting director, not the set designer.** It decides what to show and what data to populate it with. Your component decides how it looks and works. Keep these concerns completely separated.

2. **Two state streams, two different audiences.** `AIState` is text — it goes back to the LLM so it remembers the conversation. `UIState` is React nodes — it goes to the browser so the user sees rich UI. Never conflate them.

3. **`generate` is a generator, not a function.** `yield` sends the loading state immediately. `return` sends the final component. This is what makes the two-phase streaming feel instant.

4. **`.describe()` is not documentation — it's an instruction.** The LLM reads Zod field descriptions as part of its tool calling context. Write them like you're telling a junior crew member exactly what to put in each field.

5. **`useActions` over direct import.** Server actions called via `useActions` route through the RSC streaming protocol. Direct imports bypass it and break `yield`.

6. **Build the component first, in isolation.** The hardest part of controlled GenUI is not the AI wiring — it's the component itself. Getting the interaction states right (default, revealed, correct, wrong) before touching `streamUI` saves you hours of debugging with live API calls.

🎬 You just built your first AI-native UI component — one that the model decides when to show, but you decide how it looks and works.
