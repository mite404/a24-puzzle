# FOR_ETHAN — The A24 Oracle

## The Story So Far

A conversational “oracle” intake leads into location-guess rounds and a crossword. The UI now
tracks **shop.a24films.com** more closely: generous gutters, centered content columns, vector A24
mark in the header, PREORDER-style meta type, still captions **below** photos, and a decorative
black footer.

---

## Cast & Crew (Architecture)

Think of the page like a **single-camera master shot**: `SiteHeader` is the slate at the top,
`AppShell` is the dolly track that keeps the action in a centered column, phase components
(`OracleTvScene`, `LocationQuiz`, etc.) are the performers, and `SiteFooter` is the end credits roll
— same framing whether the scene is chat or games.

### Basement TV intake (oracle landing)

The intake is no longer a text column — it’s a **VFX comp**:

1. **Plate** — `TV-scene-dial-01.png` (full basement set)
2. **Insert** — oracle stream + palette bars mapped into the CRT cutout (`tv-screen-map.ts`)
3. **Glass pass** — `TV-screen.png` reflection overlay on top
4. **Off-camera** — `FloatingComposer` at the bottom of the viewport (you talk from the couch;
   your lines never appear on the TV)

Phosphor-green broadcast type, scanlines, and a warm glass composer bar sell the 70s basement
without building a 3D TV in CSS.

#### Palette insert — two deliverables, one grade

When the oracle calls `showPalette`, the film's color signature appears inline in the broadcast.
Same **footage** (swatches + prompt from `getPalette`), two **deliverables**:

| Export           | Screen                             | Look                                     |
| ---------------- | ---------------------------------- | ---------------------------------------- |
| `CrtPaletteCard` | CRT insert (`tv-oracle-feed.tsx`)  | Compact phosphor bars, oracle-TV CSS     |
| `PaletteCard`    | Normal chat UI (reserved / future) | Taller bars, hover labels, muted caption |

Call sites pick the export that matches their screen — they never pass `variant="crt"`. Think of
it like choosing **Broadcast** vs **Theater** on export: same color grade, different framing.

**File layout (`palette-card.tsx`) — all in one module:**

```
PaletteCardBase   ← private engine (variant branching lives here)
CrtPaletteCard    ← exported preset: variant="crt"
PaletteCard       ← exported preset: variant="default"
```

The **wrapper** is a one-line preset button on the shared engine:

```tsx
export function CrtPaletteCard(props: PaletteCardProps) {
    return <PaletteCardBase variant="crt" {...props} />;
}
```

`{...props}` passes the call sheet down unchanged — `filmId` and `promptText` flow through without
the caller knowing about `variant`.

**Two layers to keep straight:**

| Layer                                  | Rule                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Public API** (other files)           | Named exports only — `CrtPaletteCard`, `PaletteCard`. No `variant` prop.                               |
| **Private implementation** (same file) | `PaletteCardBase` holds `if (variant === "crt")` — variant is an internal dial, not a public contract. |

This is _not_ compound-component composability (Item 3 in
`docs/lessons-learned/vercel-composition-patterns.md` — that's for when layout wiring needs to
flex). It's **explicit variant names** so readers know what renders without opening the file.

---

### Three-channel oracle (voice + persona)

The right-hand **UHF dial** cycles three broadcast personas — same tool pipeline underneath,
different **performance** on top (like swapping announcers on the same teleprompter):

| Dial | Persona        | Character      | Film anchor    |
| ---- | -------------- | -------------- | -------------- |
| 0    | `ladybird_mom` | Marion ("Mom") | _Lady Bird_    |
| 1    | `witch`        | William        | _The Witch_    |
| 2    | `materialist`  | Lucy           | _Materialists_ |

- **Prompt layer** — `src/lib/oracle-personas.ts` wraps the shared catalog + tool rules in
  character voice. Dialogue cadence comes from the **shooting scripts** in `docs/scripts/` (Lady Bird,
  The Witch, Materialists) — not generic film knowledge.
- **Speech layer** — `POST /api/voice` calls ElevenLabs TTS server-side; `useOracleVoice` plays
  each assistant turn after streaming completes. CRT flicker (`is-speaking`) fires while audio plays.
- **Dial wiring** — `TvVolumeDial` → `personaId` in `/api/chat` body via `DefaultChatTransport`.
  Mid-chat channel changes keep history; only the next reply shifts character.

#### Input track — Scribe realtime voice (composer mic)

You can **talk to the oracle** from the couch, not just type. Think of it as a second input bus into
the same chat splice — like feeding ADR into the same timeline as the typed lines.

| Piece                         | Role (film analogy)                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FloatingComposer` mic button | Tap-to-toggle record — tap once to open the mic, tap again to commit + auto-send                                                                         |
| `useOracleScribe`             | Field recorder — streams partials into the composer textarea, commits on second tap                                                                      |
| `GET /api/scribe-token`       | Day pass desk — mints a single-use ElevenLabs realtime token (same `ELEVENLABS_API_KEY` as TTS)                                                          |
| `buildScribeKeyterms()`       | Script supervisor's name list — A24 proper nouns (films, directors, NYC locations, persona names) bias Scribe; capped at **50 terms × 20 chars** per SDK |
| `useOracleVoice` guards       | Floor manager — `cancelSpeech()` kills in-flight TTS; `consumePendingReplies()` drops any reply you talked over                                          |

**Tap lifecycle:** tap 1 → silence the TV character + fetch token + listen; partial words appear
in the textarea; tap 2 → `commit()` → auto-send if non-empty → oracle streams back → TTS
plays. Mic is **disabled while the model is replying** (`chat.busy`) so you can't barge in
mid-stream.

**Turn-taking:** TTS is reactive (fires when streaming finishes), so grabbing the mic also bumps
`speakGenerationRef` and marks pending assistant ids as "already spoken" — anything the character
was about to say when you start talking is permanently dropped.

**Token route:** unauthenticated for the demo; `requireScribeAccess()` is a no-op seam — harden
before any public deploy (rate-limit / origin / shared secret).

#### Error bus — three channels, one dismiss loop

`FloatingComposer` doesn't own errors — it **displays** what the parent assembles. Think of three
monitoring feeds on the sound cart: **Chat** (text/API), **Voice** (TTS playback), **Scribe**
(mic/STT). Each feed has its own source; the composer only reads the labeled inputs it's handed.

| Slot            | Hook source                                      | What broke                         |
| --------------- | ------------------------------------------------ | ---------------------------------- |
| `errors.chat`   | `chat.error` / `chat.clearError`                 | Oracle text chat / API             |
| `errors.voice`  | `voice.voiceError` / `voice.clearVoiceError`     | TTS / speaker playback             |
| `errors.scribe` | `scribe.scribeError` / `scribe.clearScribeError` | Mic permission / Scribe connection |

**Hook layer — `null` means "all clear."** Voice and scribe hooks use `useState<string |
null>(null)`. No error → `null`. Dismiss → back to `null`. Chat uses `Error | undefined` from
`useChat`, same idea.

**Props assembly — `undefined` means "don't build an envelope."** In `OracleTvScene`, a ternary
runs per channel:

```tsx
voice: voice.voiceError
  ? { message: voice.voiceError, onDismiss: voice.clearVoiceError }
  : undefined,
```

No error → no `{ message, onDismiss }` object → slot is `undefined`. The child never sees hook
`null` directly — the parent translates hook dialect into prop dialect.

**Child layer — read and wire back.** `FloatingComposer` checks each slot:

- `errors.chat` → its own alert (formatted via `formatChatError`)
- `errors.voice` + `errors.scribe` → one shared **audio** banner (both are "sound department")

Voice and scribe merge with a fallback chain:

```tsx
errors.voice?.message ?? errors.scribe?.message;
```

Try Voice first; if that's `undefined`, try Scribe. `?.` guards the slot (might be `undefined`).
`??` picks the backup. Voice wins if both exist.

**Dismiss closes the loop.** `onDismiss` in each `DismissableError` is a live wire to the hook's
clear function — not local state in the composer. User clicks Dismiss → hook clears to `null`
→ next render assembly yields `undefined` → banner vanishes.

```
Error appears  →  hook holds message  →  parent builds { message, onDismiss }
User dismisses →  hook → null         →  parent → undefined  →  UI clears
```

**Gotcha:**

> [!WARNING]
> `errors.voice?.message` only protects `voice` — not `errors` itself. If the whole
> `errors` prop is `undefined` (broken call site), you get `Cannot read properties of undefined
(reading 'voice')`. Safe read: `errors?.voice?.message`. Real fix: always pass a proper assembled
> object from the parent.

### Valence emotion bus (mic tone → oracle)

Scribe gives the oracle the **script** (what you said). Valence reads the **performance** (how you
sounded). Think of it as a second input bus on the sound stage — a **tone meter** running parallel
to the transcript, never replacing the words.

| Phase | Beat                       | What shipped                                                                                                                                                                                          |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Location scout**         | Server-only spike (`scripts/valence-spike.ts`) — prove the API key, Discrete baseline, clip limits, Streaming WebSocket. Verified **2026-06-06**; spike deleted after pass.                           |
| **2** | **Backlot route**          | `POST /api/valence` + `src/lib/valence.ts` — server-side Discrete analysis, confidence gate (0.38), clip floor/ceiling (4.5–15 s).                                                                    |
| **3** | **Single boom mic**        | Browser tap: one `getUserMedia` → manual PCM + `sendAudio` to Scribe, same chunks accumulated into WAV for Valence on commit (`scribe-audio-tap.ts`). WebM transcode deferred — WAV path works today. |
| **4** | **Script supervisor note** | Hidden `VOCAL_TONE` block injected into `/api/chat` when tone and words might disagree (`oracle-vocal-context.ts`).                                                                                   |
| **5** | **CRT grade**              | Diegetic static/dim/warm modifiers on the TV feed from last vocal emotion — felt, not labeled (`tv-oracle-feed.tsx`, `globals.css`).                                                                  |
| **6** | **ADR pass**               | TTS `voice_settings` nudged from user's vocal tone + persona baseline (`oracle-voice-settings.ts`).                                                                                                   |

**Signal chain on a mic turn:**

```
tap 1 → one mic stream → Scribe partials (live) + PCM buffer (silent)
tap 2 → commit transcript → POST /api/valence (WAV) → vocalEmotion JSON
      → chat.submit(text + vocalEmotion) → LLM → TTS → CRT reacts
```

Typed turns skip the emotion bus entirely — no regression.

#### Debug voice mute (dev only)

The **Debug — skip intake** HUD has a **Voice off** toggle. Think of it as pulling the XLRs from
the booth — chat still runs on typed input, but no paid API calls fire:

| Bus     | What stops                                                                         |
| ------- | ---------------------------------------------------------------------------------- |
| TTS     | `/api/voice` — oracle stays silent (intake, crossword quips, end-screen tier line) |
| Scribe  | `/api/scribe-token` + realtime mic — composer mic button hides                     |
| Valence | `/api/valence` — mic commits skip tone analysis                                    |

State persists in `localStorage` (`a24-debug-voice-off`) so a refresh keeps credits safe. Production
builds ignore the flag.

---

#### Phase 1 spike script (reference — deleted after pass)

Before wiring the app, we ran a **throwaway location scout**: a Bun script that never touched the
Next.js app. It loaded `VALENCE_API_KEY` from `.env.local`, synthesized mono WAV probes (sine tones
at 44.1 kHz), and logged pass/fail for three questions:

1. **Discrete baseline (6 s)** — does the key work at all?
2. **Limit probes (3 s / 20 s)** — where does the API reject clips (`AUDIO_TOO_SHORT` /
   `AUDIO_TOO_LONG`)?
3. **Streaming WebSocket** — is live PCM analysis enabled on our account, or docs-only?

Representative excerpt (full script was ~300 lines; deleted **2026-06-06** after Phase 1 passed):

```typescript
/**
 * Phase 1 throwaway probe — server-side only.
 * Run: bun scripts/valence-spike.ts
 */
import { ValenceClient, AudioTooShortError, AudioTooLongError } from "valenceai";

// Load .env.local, require VALENCE_API_KEY, synthesize mono WAV @ 44.1 kHz …

async function probeDiscrete(client, filePath, label) {
    const start = performance.now();
    try {
        const response = await client.discrete.emotions(filePath, null, "4emotions");
        return { label, ok: true, latencyMs: Math.round(performance.now() - start), response };
    } catch (err) {
        return {
            label,
            ok: false,
            latencyMs: Math.round(performance.now() - start),
            error: summarizeError(err),
        };
    }
}

async function probeStreaming(client) {
    const stream = client.streaming.connect("4emotions");
    stream.onPrediction((data) => {
        /* cache first prediction latency */
    });
    await stream.connect();
    // Send ~5 s of PCM16 in 500 ms chunks via stream.sendAudio(chunk)
    stream.disconnect();
}

const client = new ValenceClient({ apiKey: API_KEY });
const baseline = await probeDiscrete(client, clips.baseline6s, "Discrete 6s");
const tooShort = await probeDiscrete(client, clips.short3s, "Discrete 3s");
const tooLong = await probeDiscrete(client, clips.long20s, "Discrete 20s");
const streaming = await probeStreaming(client);
// JSON summary → pasted into docs/valence-oracle-plan.md spike log
```

**What it proved (2026-06-06):** Discrete 6 s clip → PASS (~1.3 s wall-clock). 3 s →
`AUDIO_TOO_SHORT` (floor **4.5 s**). 20 s → `AUDIO_TOO_LONG` (ceiling **15 s**). Streaming
WebSocket → PASS (first prediction ~2.9 s after connect). Confidence gate 0.38 is app-side only
— API returns all scores. Details live in `docs/valence-oracle-plan.md` spike log;
`scripts/valence-route-test.ts` remains for Phase 2 route checks.

### Crossword as floating matte (Round 2)

The crossword grid is a **square title card** — not a fixed rectangle of black tiles. Think
post-production: the puzzle sits on a transparent matte over the page background.

- **Three cell kinds** — `letter` (white inputs), `block` (black squares inside the puzzle),
  `empty` (transparent padding that lets the page show through).
- **Square frame** — the tight generator bounding box is centered inside `max(rows, cols)`, so
  non-square puzzles get see-through gutters instead of a heavy black box.
- **Fluid sizing** — `aspect-square w-full max-w-[min(72vw,55dvh,28rem)]` scales the grid to the
  largest square that fits; cells use `1fr` tracks and `aspect-square` instead of fixed `size-9`.
- **Layout** — grid floats in a `relative z-10` layer with a subtle letter-cell shadow; clues stay
  in normal flow beside (desktop) or below (mobile) the square.

### Crossword host — persona voice in Round 2

Round 2 keeps the **scorekeeper blind**: no green cells, no per-word lock. The oracle you picked at
intake becomes a **host** — reacting to moves, never confirming answers until **Reveal my tier**.

Think of it like ADR over the puzzle: the grid is the picture lock; the voice is a separate track
that never burns in correctness.

| Piece                       | Role (film analogy)                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `useOracleSpeaker`          | Shared boom mic — one `/api/voice` path for intake _and_ crossword; `generation` guard prevents stacked clips |
| `useCrosswordOracle`        | Timing brain — dwell timers, cooldowns, quip picks; no grid logic                                             |
| `crossword-oracle-quips.ts` | Script pages — Marion / William / Lucy banks; `completed` lines are **ambiguous on purpose**                  |
| `crossword.tsx` events      | Slate marks — emits `onActiveClueChange` + `onWordFilled`; 🔊 on the focused clue                             |
| `POST /api/oracle-quip`     | Improv coach — 45 s stall → one LLM zinger; fail-open → `idle45` bank                                         |

**Four speech triggers:** auto-read clue #1 on mount; 🔊 on demand; 20 s / 45 s dwell teases on
the _focused_ clue; one cryptic line when the active word becomes **filled** (right or wrong —
same pool).

**Timer resets** when the focused clue changes **or** the active word becomes fully filled — so
teasing never leaks “you’re wrong.”

**Guards:** no overlapping audio; ~12 s global cooldown between idle quips; one dwell escalation
cycle per clue; everything yields while the oracle is already speaking.

**Non-telegraphing rule:** correctness is computed only in `check()`. The voice must never behave
differently for right vs. wrong words.

---

## Behind the Scenes (Decisions)

- **Centered column, left-aligned copy** — Shop product pages feel editorial because the _block_
  is centered, not because every line is centered. `mx-auto` on `AppShell` does that while keeping
  prose left-aligned.
- **`a24-meta` vs `a24-caption`** — Grid “PREORDER” / price lines use tiny all-caps gray
  (`a24-meta`). Location hints use sentence-case italic under the still (`a24-caption`) so we never
  fight the image with white/black overlays.
- **Footer mockup** — Inert links for visual parity only; keeps the puzzle demo honest without
  implying a real shop checkout.
- **Crossword padding vs blocks** — One `null` type made every non-letter cell black, including
  square padding outside the puzzle. Option A from the plan: pad to a square, center the puzzle, mark
  outer cells `empty` (transparent) and inner nulls `block` (black). Arrow keys skip `empty` via
  `isCell()` on letter cells only.
- **Voice is presentation-only** — `showPalette` / `finalizeExperience` unchanged. ElevenLabs is
  post-production VO on the same script OpenRouter writes; API key stays on the server.
- **Autoplay unlock** — first click/keypress unlocks TTS (browser policy). Opening line speaks
  after unlock when you change channels.
- **Scribe tap-to-toggle** — realtime STT is manual commit (not always-on VAD) to avoid TV speaker
  bleed; echo cancellation on the mic stream; typed Send remains the fallback if permission is denied.
- **Scribe keyterms vs catalog copy** — film titles in `films.ts` can exceed Scribe's 20-char
  keyterm cap; the bias list uses shorthand, not a verbatim dump of catalog strings.
- **Script-sourced personas** — Marion, William, and Lucy prompts were tuned from primary-source
  PDFs: `docs/scripts/LADY_BIRD_shooting_script.pdf`, `docs/scripts/the-witch-shooting-script.pdf`,
  and `docs/scripts/MATERIALISTS-shooting-script.pdf`. Each persona carries signature lines, speech
  patterns, and tonal beats from those scripts (Marion's practical guilt-as-love; William's Early
  Modern conscience; Lucy's matchmaker market pragmatism).
- **Crossword oracle fail-open** — `/api/oracle-quip` uses OpenRouter with `reasoning.effort:
none` so Kimi K2.6 returns spoken text, not thinking tokens only. Any route error → authored
  `idle45` bank; puzzle stays fully playable mute.
- **Grouped composer props** — Mic and errors are structured objects at the `FloatingComposer`
  boundary (`mic?: MicState`, `errors: { chat?, voice?, scribe? }`), not 17 loose booleans/strings.
  Parent assembles; child displays. Keeps the component digestible without a Provider (only one level
  of prop passing).
- **Named palette exports over `variant="crt"`** — Vercel composition pattern
  `patterns-explicit-variants`: callers get self-documenting names (`CrtPaletteCard`), not mode
  strings. Shared logic stays in a private `PaletteCardBase`; thin exported wrappers preset `variant`
  internally. Public `PaletteCardProps` has no `variant` field — that key exists only on the
  internal type. Same file, same module — wrappers aren't a separate package unless the base
  outgrows the file.

---

## Bloopers (Bugs & Fixes)

- **Crossword cell highlight invisible** — Active square and word band used `bg-amber-300` /
  `bg-amber-100` _after_ `bg-white` in the same `className` string. In Tailwind, conflicting
  utilities don't follow HTML class order — whichever rule appears **last in the compiled CSS**
  wins, and `bg-white` was winning. Every cell stayed white; clue list amber still worked because
  it never stacked two backgrounds. **Fix:** pick exactly one background per state in `cellClass()`
  (`isActive` → amber-300, `inWord` → amber-100, else white) and add `focus-visible:ring` only on
  the active cell for keyboard users.
- **Footer flush to edge** — A global `* { padding: 0 }` sat _outside_ Tailwind’s `@layer`, so
  it beat `.a24-gutter` in the cascade. Reset moved into `@layer base`; footer uses symmetric
  `a24-footer-inset` (~20–40px).
- **Gray Mapbox map (pins only)** — [PR #3](https://github.com/mite404/a24-puzzle/pull/3) already
  proved the map on `main`: simple `location-map.tsx` + `NEXT_PUBLIC_MAPBOX_TOKEN`. The regression on
  `styling-details` came from layering _more_ Mapbox wiring on top — `mapLib`, CSP worker
  `postinstall`, debug probes, `transpilePackages: ["mapbox-gl"]`. You got logo, zoom, and pins on
  gray; `NaN LngLat` was usually fallout from a map that never reached `load`, not bad data in
  `locations.ts`. **Fix:** revert to the PR pattern (plain `<Map mapboxAccessToken mapStyle=…>`),
  drop worker/debug extras, `bun run dev:clean`. **Not the culprit:** missing files, zero-size
  container, or quota — style/tile API calls could still return **200** while the canvas stayed
  blank; a **304** on `_next/.../mapbox-gl.css` is just local bundle cache. Healthy Network tab:
  `api.mapbox.com` style + lots of `/v4/...vector.pbf` after the quiz reveals the map.
- **Scribe mic: `1008 invalid_request` + “WebSocket is not connected”** — Token mint succeeded
  (`/api/scribe-token` → 200), but the browser WebSocket died on connect. Root cause: two catalog
  keyterms exceeded ElevenLabs' client limit (**20 characters each** — see `@elevenlabs/client`
  `scribe.d.ts`): `"Everything Everywhere All at Once"` and `"Lotte New York Palace"`. Those strings
  ride on the WebSocket **query string** at connect time (model, token, keyterms, etc.); invalid
  params fail the handshake before any audio flows. The second error is a **symptom**: server closes
  the socket → mic capture still tries `send()` → “WebSocket is not connected.” **Fix:**
  `buildScribeKeyterms()` enforces 50×20, drops oversize terms, and maps long titles to spoken
  shorthand (`"All at Once"`, `"Lotte Palace"`). Separate gotcha: API key needs **Speech-to-Text**
  permission, not just TTS — missing scope surfaces as 401 on token mint, not on the WebSocket.
- **Valence mic tap: SDK vs manual PCM (path b)** — Early plan assumed `@elevenlabs/react` might
  expose the underlying `MediaStream` for a shared fork to Valence, or a second `getUserMedia` as
  fallback. Investigation showed the SDK's built-in mic mode owns capture internally — no stream
  handle, no clean dual-consumer hook. **Fix:** switched to **manual PCM mode** (`audioFormat:
PCM_16000` + `sendAudio`): `startScribeAudioTap()` grabs one `getUserMedia`, runs an AudioWorklet
  that resamples to 16 kHz, forwards base64 chunks to Scribe _and_ accumulates PCM locally. On commit,
  chunks become a WAV blob → `POST /api/valence`. A second mic request was never needed — one
  boom, two mix buses.
- **Composition refactor half-shipped — `errors.voice` runtime crash** — `FloatingComposer` was
  refactored from 17 flat props to a grouped interface (`mic?: MicState`, `errors: { chat?, voice?,
scribe? }`), but `OracleTvScene` still passed the old API: `errors={chat.error}`, plus orphaned
  `voiceError` / `scribeError` props. On the happy path `chat.error` is `undefined`, so the entire
  `errors` prop was `undefined` → `errors.voice?.message` threw because `?.` only protects `.voice`,
  not `errors`. TypeScript caught it at `tsc` (`Type 'Error | undefined' is not assignable…`); the
  IDE linter on the child file didn't. **Fix:** assemble `composerErrors:
FloatingComposerProps["errors"]` in the parent (same beat as `micState`), use `message` not `error`,
  pass `errors={composerErrors}`, remove flat props. Lesson: **grouped interface requires grouped
  assembly at every call site in the same commit.**
- **Palette named-export refactor half-shipped** — Commit renamed `PaletteCard` →
  `CrtPaletteCard` and changed the signature to `(props: Omit<PaletteCardProps>)` but left the old
  function body: `filmId`, `variant`, and `promptText` were never destructured from `props`, and
  `Omit` was missing its second type argument. `tsc` failed with `Cannot find name 'filmId'`. **Fix:**
  restore a private `PaletteCardBase`, export thin wrappers (`CrtPaletteCard`, `PaletteCard`), remove
  `variant="crt"` from `tv-oracle-feed.tsx`. Same lesson as the composer: **rename the export is not
  the refactor — the wrapper + private base + call-site cleanup ship together.**

---

## The Cutting Room Floor (Janitorial Sweep)

**Tool:** Fallow v2.94.0 (static analysis)
**Date:** 2026-06-12
**Scope:** Safe dead-code removal — no test files, no scripts, no UI primitives deleted.

### Why Fallow?

Think of it as a **negative cutter** for code: it reads every frame in the can and tells you which
footage was printed but never made it into the assembly. Unlike a manual search, Fallow builds the
full module graph before deciding something is "unused" — so it can trace through barrel files,
re-exports, and dynamic imports with zero ambiguity.

### What got the chop

| Symbol                               | File                                     | Before             | After            | Reason                                                                                         |
| ------------------------------------ | ---------------------------------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| `OracleChat`                         | `src/components/intake/oracle-chat.tsx`  | exported component | **file deleted** | deprecated shim — `oracle-tv-scene.tsx` consumes `useOracleChat` directly now                  |
| `PaletteCard`                        | `src/components/intake/palette-card.tsx` | exported           | internal         | only `CrtPaletteCard` is wired into the TV feed; default variant reserved for a future channel |
| `ORACLE_OPENING_LINE`                | `src/hooks/use-oracle-chat.ts`           | exported constant  | internal         | deprecated — opening line is fetched via `getOraclePersona` at call sites                      |
| `clueId`                             | `src/lib/crossword-oracle-timing.ts`     | exported           | internal         | timing module helper; consumed only inside this file                                           |
| `canFireIdleQuip`                    | `src/lib/crossword-oracle-timing.ts`     | exported           | internal         | same — idle-quip cooldown guard                                                                |
| `sortWordsByClueNumber`              | `src/lib/crossword-oracle-timing.ts`     | exported           | internal         | consumed inside `firstClueWord`                                                                |
| `DEBUG_PROFILE`                      | `src/lib/debug-experience.ts`            | exported           | internal         | debug fixture; only `buildDebugPayload` and `scoresForDebugJump` need it                       |
| `emptyScoresForPayload`              | `src/lib/debug-experience.ts`            | exported           | internal         | helper for `scoresForDebugJump`                                                                |
| `DEBUG_VOICE_OFF_STORAGE_KEY`        | `src/lib/debug-voice.ts`                 | exported           | internal         | storage key used only by `read/writeDebugVoiceOff` in same file                                |
| `ORACLE_PERSONAS`                    | `src/lib/oracle-personas.ts`             | exported           | internal         | only `getOraclePersona` and `ORACLE_PERSONA_LIST` are external API                             |
| `ORACLE_SCORE_QUIPS`                 | `src/lib/oracle-score-quips.ts`          | exported           | internal         | consumed directly by `pickScoreQuip` in same file                                              |
| `formatVocalEmotionContext`          | `src/lib/oracle-vocal-context.ts`        | exported           | internal         | used inside `injectVocalEmotionForModel` only                                                  |
| `encodePcm16ToWav`                   | `src/lib/scribe-audio-tap.ts`            | exported           | internal         | WAV encoder; called only by `startScribeAudioTap.stop()`                                       |
| `VALENCE_SUBMIT_TIMEOUT_MS`          | `src/lib/scribe-audio-tap.ts`            | exported           | internal         | default for `resolveVocalEmotion` inside same module                                           |
| `personaIdForDialState`              | `src/lib/tv-dial-states.ts`              | exported helper    | **deleted**      | exact duplicate of inline call `personaForDialState(state).id`                                 |
| `dialStateForPersonaId`              | `src/lib/tv-dial-states.ts`              | exported helper    | **deleted**      | exact duplicate of inline call `dialStateForPersona(id)`                                       |
| `TV_SCENE_WIDTH` / `TV_SCENE_HEIGHT` | `src/lib/tv-scene-assets.ts`             | exported           | internal         | consumed only to compute `TV_SCENE_ASPECT`                                                     |
| `TV_SCREEN_MAP` / `TV_CONTENT_INSET` | `src/lib/tv-screen-map.ts`               | exported           | internal         | consumed only by internal layout helpers in same file                                          |
| `VALENCE_*` constants (×6)           | `src/lib/valence.ts`                     | exported           | internal         | API guard rails — consumed only by `analyzeDiscreteWav`                                        |
| `trimWavKeepLastSeconds`             | `src/lib/valence.ts`                     | exported           | internal         | called inside `analyzeDiscreteWav` only                                                        |
| `filmStillsForFilm`                  | `src/data/locations.ts`                  | exported           | internal         | only `getLocationPhotoUrls` consumes it                                                        |
| `haversine`                          | `src/lib/geo.ts`                         | exported           | internal         | only `getNearbyLocations` consumes it                                                          |
| `CrosswordOracleDebugActions`        | `crossword-oracle-debug-panel.tsx`       | exported type      | internal         | props interface used only inside the component                                                 |
| `TierQuipDebugActions`               | `tier-quip-debug-panel.tsx`              | exported type      | internal         | props interface used only inside the component                                                 |

### What we protected

| What Fallow flagged                                                                                                                                             | Why we kept it                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `scripts/valence-route-test.ts` / `scripts/wrap-md.js`                                                                                                          | One-off scripts; not wired to the app but have archival / rerun value                              |
| 4 `.test.ts` files (`scoring`, `crossword-oracle-timing`, `crossword-oracle-quips`, `crossword-oracle-quip-fetch`)                                              | Only test coverage in the repo — Fallow can't see `bun test` auto-discovery                        |
| 15 orphaned `ui/*` primitives (avatar, badge, card, dialog, input, progress, scroll-area, separator, skeleton, sonner, textarea, toggle, toggle-group, tooltip) | Future features like `sonner` toasts are planned; premature deletion breaks `npx shadcn add` later |
| `buttonVariants` in `components/ui/button.tsx`                                                                                                                  | Standard shadcn boilerplate — other components often depend on it implicitly                       |

### The pattern: demote, don't delete

When a symbol is **used inside its own module** but has **zero external consumers**, the safe move
is a **rank demotion**: strip `export` so it becomes a private implementation detail. This shrinks
the public API surface area without deleting working code. Fallow makes this easy by flagging
exactly which exports are orphans.

**Verify first.** Before any demotion, grep for dynamic imports or string-based references that
static analysis might miss:

```bash
rg 'personaIdForDialState|dialStateForPersonaId' src/
```

If nothing outside the definition file touches it, the symbol is safe to demote or delete.

### Result

- **32 exports** demoted or deleted across 15 files
- **1 file** removed (`oracle-chat.tsx`)
- **0 test files** harmed
- **0 scripts** removed
- **Build passes** (`next build`) in 4.3s — zero regressions

---

## Director's Commentary

When borrowing a brand’s layout, steal **tokens** (gutter, meta size, footer rhythm) before
stealing **components**. One CSS variable (`--a24-meta`) buys consistent “small gray caps”
everywhere without re-measuring Figma.

### How to write an insight (with optional diagram)

Insights in this section follow a **commented snippet → diagram** rhythm when a concept needs
visual backup. The code grounds the reader in _our_ repo; the diagram shows the _flow_ without
re-reading JSX.

**Template:**

1. **One-line rule** — the takeaway in plain language
2. **Optional table** — when comparing two approaches (props vs callbacks, `()` vs `{}`, etc.)
3. **Commented code snippet** — minimal, from this codebase, arrows or labels in comments
4. **Mermaid diagram immediately after** — sequence for round-trips (click → callback →
   re-render);
   flowchart for static structure (parent/child boxes)
5. **One sentence** — how to read the diagram + film analogy if it clicks

**Example (the pattern to copy):** see **Props down, callbacks up** below — table, snippet with
`// data ↓` / `// event ↑` comments, then `sequenceDiagram`, then "Read the diagram…"

> [!NOTE]
> **Insight + diagram checklist:** snippet first (concrete) → mermaid second (flow). Don't lead
> with the diagram alone — the reader needs anchors in real code before the abstract picture.

---

### IIFEs and nested ternaries — flatten the staircase, not every branch

After the readability audit (`docs/readability-patterns-tutorial.md`), two patterns worth keeping
in muscle memory:

**IIFE = scratch dialogue.** When you need 3–5 branches to compute _one_ value (a label, a class
string) and the logic won't be reused, wrap an anonymous function and invoke it immediately:

```tsx
// floating-composer.tsx — mic button copy
const micLabel = (() => {
    if (mic?.listening) return "Stop and send";
    if (mic?.connecting) return "Connecting mic…";
    return "Speak to the oracle";
})();
```

The trailing `()()` is what _runs_ the function and assigns the string. Without it you're storing
the function itself — like leaving a line on the teleprompter instead of reading it aloud.

**Two pairs of `()` — decode the syntax:**

```tsx
const micLabel = (() => { ... })();
//               ^^^^^^^^^^^^^^  ^^
//               group 1: DEFINE  group 2: CALL
```

- **Group 1** `( () => { ... } )` — creates an anonymous function. Outer parens _group_ it as one
  value (same idea as `(2 + 3) * 4`).
- **Group 2** `()` — a normal function call. "Run what group 1 created, right now."

Same grammar as `getOraclePersona(id)()` — only the function is written inline instead of
referenced
by name. **I**mmediately **I**nvoked **F**unction **E**xpression.

```tsx
// ❌ micLabel is a function — TypeScript error at aria-label={micLabel}
const micLabel = () => {
    return "Speak to the oracle";
};

// ✅ micLabel is a string
const micLabel = (() => {
    return "Speak to the oracle";
})();
```

**IIFE vs callback — same arrow shape, different job:**

A **callback** is a function you **hand off** for something else to call later. An **IIFE** is a
function you **run yourself immediately** and throw away — you keep the return value, not the fn.

|                   | Callback                                                   | IIFE (`micLabel`)                                         |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| **Who calls it?** | Someone else (React, `.filter`, a hook…)                   | You, on the same line                                     |
| **When?**         | Later — on click, after render, per item                   | Synchronously, right now                                  |
| **What you keep** | Often the function reference                               | The **return value** (string)                             |
| **Film analogy**  | "Call me when talent's in place" (1st AD holds the walkie) | Scratch dialogue — ad lib once, write final line on slate |

From this codebase:

```tsx
// CALLBACK — passed to React; React calls it when user clicks
onClick={mic?.onToggle}

// CALLBACK — React calls on every keystroke
onChange={(e) => onTextChange(e.target.value)}

// IIFE — not passed anywhere; invoked immediately for micLabel string
const micLabel = (() => {
  if (mic?.listening) return "Stop and send";
  if (mic?.connecting) return "Connecting mic…";
  return "Speak to the oracle";
})();
```

`micLabel`'s anonymous function is **not** a callback — nothing receives it to run later. It's a
one-shot worker: define → call → assign string → discard the function.

**Not every ternary is evil.** One level is fine when both sides are the same _kind_ of thing:

```tsx
{
    mic.connecting ? <Spinner /> : <MicIcon />;
} // UI swap
{
    errors.voice ? `Voice: …` : `Mic: ${errors.scribe?.message}`;
} // two strings, one slot
```

**Nested ternaries go bad when they stack unrelated questions** — three `?` levels picking among
listening / connecting / idle, or an `aria-label` buried inside JSX with a `channelLabel` branch
then a `state === 0` branch then a fallback (`tv-volume-dial.tsx`). That's a staircase: each `:`
waits for the previous answer to fail. Flatten with an IIFE (one-off) or a named helper (reused /
testable).

**Cohesive 2-level ternaries can stay.** `ComposeStatus` picks one status string from `status` +
`modelResponding` — same output type, one thought. Don't refactor for sport; refactor when depth
or placement (inside JSX attributes) makes you lose the plot.

Full field guide with before/after tables: `docs/readability-patterns-tutorial.md` (Pattern 2).

---

### Arrow functions in JSX — `() => (...)` vs `() => { }`

You _did_ know this — it's the same grammar as the IIFE section above, just easy to forget when
you're inside `.map()` and reach for `{` out of habit.

**Two shapes:**

```tsx
(i) => expression     // implicit return — the expression IS the return value
(i) => { statements } // function body — returns nothing unless you write return
```

**In JSX lists, parentheses mean "return this element":**

```tsx
// ✅ PinCardPhotoGallery already does this
photos.map((src, i) => (
  <div key={src}>...</div>
))

// ❌ PinCardSlideDots bug — curly body, no return → void[]
Array.from({ length: count }, (_, i) => {
  <button ... />
})
```

JavaScript treats `{ <button /> }` as a block where JSX is evaluated and **discarded**. React
expects `[<button>, <button>, …]`; TypeScript reported `Type void[] is not assignable to
ReactNode`.

**Fix — pick one:**

```tsx
(_, i) => ( <button key={i} /> )           // implicit return
(_, i) => { return <button key={i} />; }   // explicit return
```

| Syntax after `=>`        | Returns                | Use when                                  |
| ------------------------ | ---------------------- | ----------------------------------------- |
| `( … )`                  | The wrapped expression | Single JSX node or value                  |
| `{ return … }`           | Whatever you return    | Multiple statements, guards, locals first |
| `{ … }` without `return` | **`undefined`**        | Almost never in `.map()`                  |

**Film analogy:** parentheses are a **single printed line** on the teleprompter — read it aloud.
Curly braces are **stage directions** — you must explicitly say "and the line is…" (`return`) or
the crew hears silence.

---

### React parent/child — who renders whom (names lie)

Parent vs child is **not** decided by function names like `Inner` or `Carousel`. It's decided by
**who writes the JSX tag**:

```tsx
function LocationPinCardRoot(...) {
  return (
    <article>
      <PinCardSlideDots onSelect={goToSlide} />  // Root WRITES this → Root is parent
    </article>
  );
}
```

| Component             | Role                                     | Why the name misleads                       |
| --------------------- | ---------------------------------------- | ------------------------------------------- |
| `LocationPinCard`     | Export shell + `key` remount             | Looks like "the card" but is a thin wrapper |
| `LocationPinCardRoot` | **Parent** — state, effects, composition | "Root" = owns the tree                      |
| `PinCardPhotoGallery` | **Child** — photo strip                  | Leaf UI                                     |
| `PinCardSlideDots`    | **Child** — dot row                      | Leaf UI; receives `onSelect`                |

### Props down, callbacks up — React's one-way street

React parent/child wiring follows one rule everywhere in the app — intake composer, pin card,
location
quiz:

| Direction | Vehicle        | Carries                                        | Example                                             |
| --------- | -------------- | ---------------------------------------------- | --------------------------------------------------- |
| **Down**  | Props          | Data, config, **functions the child may call** | `activeIndex={2}`, `onSelect={goToSlide}`           |
| **Up**    | Callback props | User intent, events                            | Child calls `onSelect(2)` → parent runs `goToSlide` |

The parent **owns state**. The child **reports events**. The child never calls `setActiveIndex`
directly — it calls the callback the parent handed down.

**Concrete example (`location-pin-card.tsx`):**

```tsx
// Parent — owns state + handler
const [activeIndex, setActiveIndex] = useState(0);
const goToSlide = (i: number) => setActiveIndex(i);

<PinCardSlideDots
    count={4}
    activeIndex={activeIndex} // data ↓
    onSelect={goToSlide} // callback fn ↓ (still a prop!)
/>;

// Child — displays + fires callback
<button onClick={() => onSelect(i)} />; // event ↑
```

```mermaid
sequenceDiagram
  participant Root as LocationPinCardRoot
  participant Dots as PinCardSlideDots

  Note over Root: activeIndex = 0
  Root->>Dots: props ↓ count, activeIndex, onSelect
  Note over Dots: dot 2 highlighted from activeIndex
  Dots->>Root: onSelect(2) ↑
  Note over Root: goToSlide(2) → setActiveIndex(2)
  Root->>Dots: re-render — activeIndex = 2 ↓
```

**Read the diagram:** solid arrows on the way down are **props** (parent renders child with new
values). The arrow back up is the child **invoking** `onSelect` — same function reference the
parent passed, now running in the parent's scope where `setActiveIndex` lives.

**Film analogy:** props are **call sheet + walkie channel** handed to a department. Callbacks are
the department **keying the mic** — "slide 2" — back to the director, who updates the master
timeline (`activeIndex`).

The child never imports `goToSlide` by name. It only calls the **`onSelect` prop** — whatever
function the parent plugged in. Same pattern as `onMoreInfo`, `onComplete`, `onDismiss`.

### Props are a two-socket contract (send _and_ receive)

Passing a prop from the parent is **half** the wiring. TypeScript errors that look unrelated often
share one root cause:

| Error                                        | Meaning                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `Property onSelect does not exist on type …` | Parent sends; child type doesn't list it           |
| `Cannot find name 'onSelect'`                | Child uses it in JSX but didn't destructure it     |
| `Type void[] is not assignable to ReactNode` | `.map` returned `undefined` (see arrow-fn section) |

**Checklist when adding a callback prop:**

1. Parent JSX: `onSelect={goToSlide}`
2. Child destructuring: `onSelect,`
3. Child type: `onSelect: (index: number) => void`
4. Child usage: `onClick={() => onSelect(i)}`

Same pattern as `photos` → `PinCardPhotoGallery` and `onMoreInfo` → the "more info" button. If
you've wired one prop successfully in a file, every other prop uses the same three steps.

**Scope rule:** each function is its own box. `PinCardSlideDots` cannot see `photos`, `goToSlide`,
or `setActiveIndex` from the parent — only what arrives as props. Use `count` to loop dots, not
`photos.map`.

---

### Module file order — tell the composition story

Two valid orders; pick one and stay consistent:

| Order         | Story              | This file                                                 |
| ------------- | ------------------ | --------------------------------------------------------- |
| **Bottom-up** | Bricks → house     | Config → types → leaf UI → `LocationPinCardRoot` → export |
| **Top-down**  | Headline → details | Export first, helpers below                               |

For learning wiring, **bottom-up** matches dependency: read `PinCardSlideDots` before the root
that uses it. **File order ≠ React tree** — the parent can appear later in the file as long as
it
renders the children above it.

Rename by **UI job**, not hierarchy: `PinCardPhotoGallery`, `PinCardSlideDots`,
`LocationPinCardRoot`
— not `Inner`, `Media`, `Carousel`.

### Carousel dots — product + accessibility together

**Product:** dots jump to slide _i_; auto-advance (4 s interval) already lives in
`LocationPinCardRoot` — it only needed `goToSlide` wired to the same `activeIndex` state.

**ARIA:** use a **`role="group"` of `<button>`s**, not `role="tablist"`, unless you also ship
arrow-key tab semantics. `tablist` promises keyboard tabs; decorative spans broke that contract
(Rams audit). Each dot: `aria-label="Photo 2 of 4"`, `aria-current="true"` on the active one.

**Target size:** WCAG cares about the **button** hit area (44×44 px), not the icon or the 4 px
visible bar. Bumping `MicIcon` from `size-4` → `size-5` inside a `size-10` button doesn't fix
touch targets — change the **button** to `size-11`.

Full audit write-up: `docs/codebase-audits/rams-accessibility-ux-review.md`.

### Git stash — quick ref (branch hygiene)

| Flag           | Job                                                                       |
| -------------- | ------------------------------------------------------------------------- |
| _(none)_       | Stash tracked changes (staged + unstaged)                                 |
| `-u`           | Also stash **untracked** files (new folders like `docs/codebase-audits/`) |
| `-m "message"` | Label the stash so `git stash list` is readable                           |

You do **not** need to `git add` before stashing. To land commits on `main` and move WIP to a new
branch: `git stash push -u -m "…"` → checkout/merge `main` → `git checkout -b new-branch` →
`git stash pop`.

---

### React hooks — what they are, and `useOracleChat` as a case study

A React component is a function that runs **every time** the UI needs to update (every "take").
Plain functions can't remember yesterday's take or talk to the outside world between takes.
**Hooks** are React's API for giving components **memory** and **side effects** — continuity notes
taped to the monitor so the performer doesn't forget their line or miss a cue.

**Custom hooks** (names start with `use`) bundle one feature's wiring. `useOracleChat` is a
**department head** for intake chat: it owns messages, textarea state, busy flags, and the
"intake is done" handoff — the TV scene component just calls the hook and renders.

#### Hook cheat sheet (what each one does here)

| Hook                     | Film analogy                    | What it remembers / does                                             | In `useOracleChat`                                             |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `useState`               | Slate on the monitor            | Value that **triggers re-render** when it changes                    | `text` / `setText` — composer textarea                         |
| `useRef`                 | Flag pin on the script          | Mutable box that **persists** but **doesn't** re-render when flipped | `finalized` — "already called `onFinalize`" latch              |
| `useEffect`              | "When X changes, run this beat" | Runs **after** paint; syncs with outside world                       | Scan messages for finalize tool; reset latch on persona change |
| `useMemo`                | Pre-computed logline            | Recompute derived value only when deps change                        | `assistantStreamingText` — is the oracle visibly typing?       |
| `useChat` (library hook) | Satellite feed                  | AI SDK owns `messages`, `sendMessage`, `status`, `error`             | The actual chat stream                                         |
| Custom `useOracleChat`   | Department head                 | Composes the above + submit helpers + opening line                   | What `OracleTvScene` imports                                   |

**Rules of the road:** only call hooks at the **top level** of a component or custom hook — never
inside `if`, loops, or nested functions. That's how React keeps continuity consistent take to take.

#### Pure helper vs effect — who does what

| Piece                     | Role                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `extractFinalizedProfile` | **What** to find — search nested messages (pure, no React)        |
| `useEffect`               | **When** to act — after render, when `messages` changes           |
| `finalized` ref           | **How many times** — exactly once per intake until persona resets |

The verb **extract** describes the runtime job (pull a profile out of nested message parts), not
the refactor move of "extracting into a helper." Same family as `findLastAssistant`,
`formatChatError`.

#### Annotated snippets — helper + effects

Script supervisor searching dailies (`extractFinalizedProfile`), then the floor manager effects that
call it. Comments trace **data flow** — what enters, what gets checked, what exits.

**Pure helper** — no React; `messages` in, profile or `undefined` out:

```tsx
// src/hooks/use-oracle-chat.ts
function extractFinalizedProfile(messages: Array<OracleUIMessage>): ExperienceProfile | undefined {
    // DATA IN: full chat transcript from useChat — grows on every streamed chunk

    for (const message of messages) {
        // Walk transcript in order (oldest → newest)

        for (const part of message.parts) {
            // Each message is sliced into parts: text, tool calls, etc.

            if (
                part.type === "tool-finalizeExperience" &&
                // Gate 1: oracle invoked the "lock the experience" tool — not plain text

                (part.state === "input-available" || part.state === "output-available") &&
                // Gate 2: tool is far enough along (args in, or finished) — skip pending/error

                part.input
                // Gate 3: payload actually exists
            ) {
                return part.input as ExperienceProfile;
                // DATA OUT: first matching part wins — stop scanning immediately
                // Cast: SDK types input loosely; we know this tool's shape is ExperienceProfile
            }
        }
    }
    // DATA OUT: implicit undefined — finalize tool hasn't appeared yet;
    // the useEffect below will run again when messages updates
}
```

**Latch reset** — when the UHF dial swaps persona, clear the "already finalized" flag:

```tsx
const finalized = useRef(false);
// Persists across renders WITHOUT triggering re-render when flipped
// Think: flag pin on the script — "we already called onFinalize"

useEffect(() => {
    finalized.current = false;
    // DATA FLOW: personaId changes (dial detent) → allow finalize again for new channel
}, [personaId]);
```

**Main finalize effect** — orchestrates; delegates search to the helper:

```tsx
useEffect(() => {
    if (finalized.current) return;
    // GUARD: if we already handed off, bail — prevents onFinalize firing on every later message tick

    const profile = extractFinalizedProfile(messages);
    // DATA FLOW: messages (from useChat) → helper → ExperienceProfile | undefined
    // Runs after each render where messages or onFinalize changed

    if (profile) {
        finalized.current = true;
        // Set latch BEFORE calling parent — if onFinalize triggers re-render mid-flight,
        // next effect run hits the guard above and won't double-fire

        onFinalize(profile);
        // SIDE EFFECT OUT: parent (OracleTvScene) advances phase → quiz, crossword, etc.
        // Hook doesn't navigate itself — it only notifies upstream
    }
}, [messages, onFinalize]);
// Re-run when: new streamed chunk (messages) or parent passes new callback (onFinalize)
```

Why set the latch **before** `onFinalize`? If the parent re-renders mid-call, the next effect run
hits the guard immediately and won't double-fire.

#### Signal flow

```mermaid
flowchart TD
  A[messages update from useChat] --> B{finalized.current?}
  B -->|yes| C[return — already handled]
  B -->|no| D[extractFinalizedProfile messages]
  D --> E{profile found?}
  E -->|no| F[done — wait for next messages]
  E -->|yes| G[finalized.current = true]
  G --> H[onFinalize profile]
  H --> I[parent changes phase / UI]

  P[personaId changes] --> Q[finalized.current = false]
```

Full walkthrough with readability patterns: `docs/readability-patterns-tutorial.md` (Pattern 3).

---

### Refactor rule: interface + call site ship together

Prop grouping is a **two-location change** — like updating both the call sheet template _and_ the
production office that fills it in.

| Location                                  | Job                                                     |
| ----------------------------------------- | ------------------------------------------------------- |
| Child interface (`floating-composer.tsx`) | Defines the contract — what shape the component accepts |
| Parent assembly (`oracle-tv-scene.tsx`)   | Builds grouped objects from hooks before JSX            |

`micState` was assembled; `composerErrors` wasn't. Child was ready; parent still spoke the old
language. Result: cleaner types on paper, runtime crash in production.

**Checklist for grouped-prop refactors:**

1. Update the child `interface`
2. Update **every** call site to build matching `const` objects
3. Run `bunx tsc --noEmit` on the whole project — not just the file you edited
4. Smoke-test the happy path (no errors) — that's when `undefined` props expose missing `?.` on
   the parent object

A half-refactor is worse than none: you lose the old working props _and_ don't satisfy the new
contract. Ship both sides or neither.

> [!IMPORTANT]
> Prop grouping is a **two-location change** — child interface + parent assembly ship in the same
> commit. Run `bunx tsc --noEmit` on the whole project, not just the file you edited.

### Wrapper components — preset buttons on a shared engine

Beginner→intermediate confusion often sounds like: "Do I delete `variant`? Do wrappers live in
another file? Is this for using the component outside the TV?"

> [!IMPORTANT]
> Callers get **names**, not **modes**. `variant="crt"` is a hidden contract; `CrtPaletteCard` is a
> readable slate.

**Why a wrapper exists:** when two presentations share most logic (same `getPalette`, same null
check, same swatch loop) but differ in JSX framing. The wrapper presets one choice so call sites
can't typo the mode or grep the codebase to learn valid strings.

**Where it lives:** same file as the base, usually. The base is **private** (`function
PaletteCardBase`, not exported) so nobody imports it and passes `variant="crt"` again — that would
undo the refactor. Split to a second file only when the base grows large enough to extract shared
swatch markup.

**What `{...props}` does:** spreads the caller's props onto the base — like handing a call sheet
down unchanged while the wrapper adds one line the caller never sees (`variant="crt"`).

**When _not_ to use wrappers:** variants that need different state, providers, or sub-parts
(Slack-style `ThreadComposer` vs `EditMessageComposer`). Then build fully separate explicit
components that compose shared _parts_, not one `if (variant)` tree. That's the compound-composer
path — saved for when `FloatingComposer` gets a second intake layout.

**Mental model:**

```
PUBLIC (what composition patterns teach)
  CrtPaletteCard  →  "TV palette insert"
  PaletteCard     →  "chat palette card"
  ❌ variant="crt"

PRIVATE (implementation detail — fine to branch here)
  PaletteCardBase(variant)  →  shared engine
```

---

### Location map hover cards (Figma → code)

After the quiz, **Beat 2** is explore mode: hover a nearby pin and a **collapsed card** (346×364,
rounded top, still + gradient + neighborhood / film / venue / “more info…”) appears. Click
**more info…** and the popup grows to the **expanded card** (518px) with the A24 logo, carousel
ticks, and black footer — like a push-in from a wide shot to a close-up on the same set.

- **Component:** `LocationPinCard` in `src/components/games/location-pin-card.tsx`; `LocationMap`
  only holds hover/expanded state.
- **Assets:** stills from each `FilmLocation.photoUrl`; logo from
  `/a24-assets/A24-Films-Logo-Vector.png` (no duplicate Figma exports).
- **Data:** optional `venueLabel` on locations (e.g. St. Barts Cathedral); film row uses
  `getFilmShortTitle()` (drops leading “The”).
- **Carousel:** expanded cards auto-advance film stills every 4s (RTL slide via `translateX`);
  segment dots are **clickable buttons** (`onSelect` → `goToSlide`) that jump to a slide; autoplay
  pauses on hover and respects `prefers-reduced-motion`. Collapsed cards keep the single `photoUrl`
  hero. Gallery comes from optional `photoUrls` on a location, or falls back to
  `getLocationPhotoUrls()` (primary still + `filmStillsForFilm()` pool in `locations.ts`).

---

### Mocks, dependency injection, and closing over variables

#### What is a mock?

A **mock** is a stand-in. In a film production, the real location might be on another continent —
so you build a set that hits the same marks, responds to the same light, and gives the actor the
same cues. Your test is the director: it controls every variable on that set.

In code, a mock replaces a dependency — usually something with side effects or network access — with
a controlled fake that behaves predictably. The goal isn't to test the mock; it's to isolate the
function you _do_ care about (`fetchOracleQuipLine`) so its logic can be verified without a live
server, without a real ElevenLabs account, without a network.

#### The mechanism: dependency injection

The reason mocking is possible at all in `fetchOracleQuipLine` is **dependency injection** (DI). DI
is a pattern where a function accepts its dependencies as arguments instead of hard-coding them.

Compare the two shapes:

```ts
// ❌ Hard-coded — untestable without a real network
async function fetchOracleQuipLine(...) {
  const res = await fetch(“/api/oracle-quip”, { ... });
  //          ^^^^^ global fetch — cannot be replaced in a test
}

// ✅ Injected — testable because you control what runs
async function fetchOracleQuipLine(
  ...,
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const res = await fetchImpl(“/api/oracle-quip”, { ... });
  //          ^^^^^^^^^ caller decides what this does
}
```

The type annotation on `fetchImpl` is just a **function type** — same idea as a TypeScript interface,
but written inline. It says: “pass me something callable, that takes a URL and options, and gives
back a `Promise<Response>`.” Any function matching that signature works — including your mock.

#### Factory mock vs. inline mock: picking the right tool

Once you have DI, you have two ways to write the mock:

|                  | Factory (`signalAwareMock`)          | Inline (`fetchImplMock`)                              |
| ---------------- | ------------------------------------ | ----------------------------------------------------- |
| **Shape**        | A function that _returns_ a function | A function that _is_ the mock                         |
| **Scope**        | Shared across multiple tests         | Scoped to one test                                    |
| **Customisable** | Via parameters (`response`)          | Via closure over local variables                      |
| **Use when**     | Same mock behavior, different inputs | You need to interact with the _test's_ state mid-call |

The factory in your test suite:

```ts
// Shared at the describe level — reused across tests 1 and 3
const signalAwareMock =
  (response: Response) =>
  async (_url: RequestInfo | URL, opts?: RequestInit): Promise<Response> => {
    if (opts?.signal?.aborted) throw new DOMException(“Aborted”, “AbortError”);
    return response;
  };

// Called like this in a test:
signalAwareMock(new Response(...))  // returns the inner async function ← that's what fetchImpl receives
```

The outer call (`signalAwareMock(response)`) is the _configuration_ step. It returns the actual mock
function, ready to be passed as `fetchImpl`. Think of it like loading a film reel into the
projector before the screening — the reel is the data (`response`), the projector is the mock
function itself.

#### What “closes over” means

The inline mock in test 2 needed something the factory could not provide: the ability to call
`controller.abort()` in the _middle of the fetch_. That controller lived in the _test_, not in the
mock. Yet the mock function still referenced it — how?

```ts
test(“signal cancelled during API call”, async () => {
  const controller = new AbortController();  // ← lives in the test
  const response = new Response();

  async function fetchImplMock(_url: RequestInfo | URL, opts?: RequestInit): Promise<Response> {
    controller.abort();  // ← how does this reach controller from up there?
    if (opts?.signal?.aborted) throw new DOMException(“Aborted”, “AbortError”);
    return response;
  }
  ...
```

`fetchImplMock` is defined _inside_ the test function. In JavaScript, inner functions can always
read (and write) variables from their enclosing scope. `controller` is in the outer scope; the inner
`fetchImplMock` **closes over** it — it carries a live reference to that variable in its pocket
wherever it goes, even when it's later called from deep inside `fetchOracleQuipLine`.

This is the **closure** mechanism: an inner function “closes around” the variables in the scope
where it was defined. The mock is like an actor who memorised the director's notes backstage
(`controller.abort()`) and executes them on cue, no matter how deep into the scene they've walked.

```mermaid
flowchart TD
    A[“test() scope\n─────────────\nconst controller\nconst response\nfunction fetchImplMock”] -->|closes over| B[“fetchImplMock can see\ncontroller & response\nat call time”]
    B --> C[“fetchOracleQuipLine calls fetchImplMock()”]
    C --> D[“fetchImplMock calls controller.abort()\n← same object the test created”]
    D --> E[“signal is now aborted\nDOMException thrown\nresult → null”]
```

Read the diagram top to bottom: the test creates `controller`, the inline mock **closes over** it,
`fetchOracleQuipLine` calls the mock, and the mock reaches back into the test's scope to fire
`abort()` — simulating cancellation mid-flight.
