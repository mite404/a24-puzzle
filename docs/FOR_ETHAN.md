# FOR_ETHAN — The A24 Oracle

## The Story So Far

A conversational “oracle” intake leads into location-guess rounds and a crossword. The UI now tracks **shop.a24films.com** more closely: generous gutters, centered content columns, vector A24 mark in the header, PREORDER-style meta type, still captions **below** photos, and a decorative black footer.

## Cast & Crew (Architecture)

Think of the page like a **single-camera master shot**: `SiteHeader` is the slate at the top, `AppShell` is the dolly track that keeps the action in a centered column, phase components (`OracleTvScene`, `LocationQuiz`, etc.) are the performers, and `SiteFooter` is the end credits roll — same framing whether the scene is chat or games.

### Basement TV intake (oracle landing)

The intake is no longer a text column — it’s a **VFX comp**:

1. **Plate** — `TV-scene-dial-01.png` (full basement set)
2. **Insert** — oracle stream + palette bars mapped into the CRT cutout (`tv-screen-map.ts`)
3. **Glass pass** — `TV-screen.png` reflection overlay on top
4. **Off-camera** — `FloatingComposer` at the bottom of the viewport (you talk from the couch; your lines never appear on the TV)

Phosphor-green broadcast type, scanlines, and a warm glass composer bar sell the 70s basement without building a 3D TV in CSS.

### Three-channel oracle (voice + persona)

The right-hand **UHF dial** cycles three broadcast personas — same tool pipeline underneath, different **performance** on top (like swapping announcers on the same teleprompter):

| Dial | Persona | Character | Film anchor |
| ---- | ------- | --------- | ----------- |
| 0 | `ladybird_mom` | Marion ("Mom") | *Lady Bird* |
| 1 | `witch` | William | *The Witch* |
| 2 | `materialist` | Lucy | *Materialists* |

- **Prompt layer** — `src/lib/oracle-personas.ts` wraps the shared catalog + tool rules in character voice. Dialogue cadence comes from the **shooting scripts** in `docs/scripts/` (Lady Bird, The Witch, Materialists) — not generic film knowledge.
- **Speech layer** — `POST /api/voice` calls ElevenLabs TTS server-side; `useOracleVoice` plays each assistant turn after streaming completes. CRT flicker (`is-speaking`) fires while audio plays.
- **Dial wiring** — `TvVolumeDial` → `personaId` in `/api/chat` body via `DefaultChatTransport`. Mid-chat channel changes keep history; only the next reply shifts character.

#### Input track — Scribe realtime voice (composer mic)

You can **talk to the oracle** from the couch, not just type. Think of it as a second input bus into the same chat splice — like feeding ADR into the same timeline as the typed lines.

| Piece | Role (film analogy) |
| ----- | ------------------- |
| `FloatingComposer` mic button | Tap-to-toggle record — tap once to open the mic, tap again to commit + auto-send |
| `useOracleScribe` | Field recorder — streams partials into the composer textarea, commits on second tap |
| `GET /api/scribe-token` | Day pass desk — mints a single-use ElevenLabs realtime token (same `ELEVENLABS_API_KEY` as TTS) |
| `buildScribeKeyterms()` | Script supervisor's name list — A24 proper nouns (films, directors, NYC locations, persona names) bias Scribe; capped at **50 terms × 20 chars** per SDK |
| `useOracleVoice` guards | Floor manager — `cancelSpeech()` kills in-flight TTS; `consumePendingReplies()` drops any reply you talked over |

**Tap lifecycle:** tap 1 → silence the TV character + fetch token + listen; partial words appear in the textarea; tap 2 → `commit()` → auto-send if non-empty → oracle streams back → TTS plays. Mic is **disabled while the model is replying** (`chat.busy`) so you can't barge in mid-stream.

**Turn-taking:** TTS is reactive (fires when streaming finishes), so grabbing the mic also bumps `speakGenerationRef` and marks pending assistant ids as "already spoken" — anything the character was about to say when you start talking is permanently dropped.

**Token route:** unauthenticated for the demo; `requireScribeAccess()` is a no-op seam — harden before any public deploy (rate-limit / origin / shared secret).

### Valence emotion bus (mic tone → oracle)

Scribe gives the oracle the **script** (what you said). Valence reads the **performance** (how you sounded). Think of it as a second input bus on the sound stage — a **tone meter** running parallel to the transcript, never replacing the words.

| Phase | Beat | What shipped |
| ----- | ---- | ------------ |
| **1** | **Location scout** | Server-only spike (`scripts/valence-spike.ts`) — prove the API key, Discrete baseline, clip limits, Streaming WebSocket. Verified **2026-06-06**; spike deleted after pass. |
| **2** | **Backlot route** | `POST /api/valence` + `src/lib/valence.ts` — server-side Discrete analysis, confidence gate (0.38), clip floor/ceiling (4.5–15 s). |
| **3** | **Single boom mic** | Browser tap: one `getUserMedia` → manual PCM + `sendAudio` to Scribe, same chunks accumulated into WAV for Valence on commit (`scribe-audio-tap.ts`). WebM transcode deferred — WAV path works today. |
| **4** | **Script supervisor note** | Hidden `VOCAL_TONE` block injected into `/api/chat` when tone and words might disagree (`oracle-vocal-context.ts`). |
| **5** | **CRT grade** | Diegetic static/dim/warm modifiers on the TV feed from last vocal emotion — felt, not labeled (`tv-oracle-feed.tsx`, `globals.css`). |
| **6** | **ADR pass** | TTS `voice_settings` nudged from user's vocal tone + persona baseline (`oracle-voice-settings.ts`). |

**Signal chain on a mic turn:**

```
tap 1 → one mic stream → Scribe partials (live) + PCM buffer (silent)
tap 2 → commit transcript → POST /api/valence (WAV) → vocalEmotion JSON
      → chat.submit(text + vocalEmotion) → LLM → TTS → CRT reacts
```

Typed turns skip the emotion bus entirely — no regression.

#### Debug voice mute (dev only)

The **Debug — skip intake** HUD has a **Voice off** toggle. Think of it as pulling the XLRs from the booth — chat still runs on typed input, but no paid API calls fire:

| Bus | What stops |
| --- | ---------- |
| TTS | `/api/voice` — oracle stays silent (intake, crossword quips, end-screen tier line) |
| Scribe | `/api/scribe-token` + realtime mic — composer mic button hides |
| Valence | `/api/valence` — mic commits skip tone analysis |

State persists in `localStorage` (`a24-debug-voice-off`) so a refresh keeps credits safe. Production builds ignore the flag.

#### Phase 1 spike script (reference — deleted after pass)

Before wiring the app, we ran a **throwaway location scout**: a Bun script that never touched the Next.js app. It loaded `VALENCE_API_KEY` from `.env.local`, synthesized mono WAV probes (sine tones at 44.1 kHz), and logged pass/fail for three questions:

1. **Discrete baseline (6 s)** — does the key work at all?
2. **Limit probes (3 s / 20 s)** — where does the API reject clips (`AUDIO_TOO_SHORT` / `AUDIO_TOO_LONG`)?
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
    return { label, ok: false, latencyMs: Math.round(performance.now() - start), error: summarizeError(err) };
  }
}

async function probeStreaming(client) {
  const stream = client.streaming.connect("4emotions");
  stream.onPrediction((data) => { /* cache first prediction latency */ });
  await stream.connect();
  // Send ~5 s of PCM16 in 500 ms chunks via stream.sendAudio(chunk)
  stream.disconnect();
}

const client = new ValenceClient({ apiKey: API_KEY });
const baseline = await probeDiscrete(client, clips.baseline6s, "Discrete 6s");
const tooShort = await probeDiscrete(client, clips.short3s, "Discrete 3s");
const tooLong  = await probeDiscrete(client, clips.long20s, "Discrete 20s");
const streaming = await probeStreaming(client);
// JSON summary → pasted into docs/valence-oracle-plan.md spike log
```

**What it proved (2026-06-06):** Discrete 6 s clip → PASS (~1.3 s wall-clock). 3 s → `AUDIO_TOO_SHORT` (floor **4.5 s**). 20 s → `AUDIO_TOO_LONG` (ceiling **15 s**). Streaming WebSocket → PASS (first prediction ~2.9 s after connect). Confidence gate 0.38 is app-side only — API returns all scores. Details live in `docs/valence-oracle-plan.md` spike log; `scripts/valence-route-test.ts` remains for Phase 2 route checks.

### Crossword as floating matte (Round 2)

The crossword grid is a **square title card** — not a fixed rectangle of black tiles. Think post-production: the puzzle sits on a transparent matte over the page background.

- **Three cell kinds** — `letter` (white inputs), `block` (black squares inside the puzzle), `empty` (transparent padding that lets the page show through).
- **Square frame** — the tight generator bounding box is centered inside `max(rows, cols)`, so non-square puzzles get see-through gutters instead of a heavy black box.
- **Fluid sizing** — `aspect-square w-full max-w-[min(72vw,55dvh,28rem)]` scales the grid to the largest square that fits; cells use `1fr` tracks and `aspect-square` instead of fixed `size-9`.
- **Layout** — grid floats in a `relative z-10` layer with a subtle letter-cell shadow; clues stay in normal flow beside (desktop) or below (mobile) the square.

### Crossword host — persona voice in Round 2

Round 2 keeps the **scorekeeper blind**: no green cells, no per-word lock. The oracle you picked at intake becomes a **host** — reacting to moves, never confirming answers until **Reveal my tier**.

Think of it like ADR over the puzzle: the grid is the picture lock; the voice is a separate track that never burns in correctness.

| Piece | Role (film analogy) |
| ----- | ------------------- |
| `useOracleSpeaker` | Shared boom mic — one `/api/voice` path for intake *and* crossword; `generation` guard prevents stacked clips |
| `useCrosswordOracle` | Timing brain — dwell timers, cooldowns, quip picks; no grid logic |
| `crossword-oracle-quips.ts` | Script pages — Marion / William / Lucy banks; `completed` lines are **ambiguous on purpose** |
| `crossword.tsx` events | Slate marks — emits `onActiveClueChange` + `onWordFilled`; 🔊 on the focused clue |
| `POST /api/oracle-quip` | Improv coach — 45 s stall → one LLM zinger; fail-open → `idle45` bank |

**Four speech triggers:** auto-read clue #1 on mount; 🔊 on demand; 20 s / 45 s dwell teases on the *focused* clue; one cryptic line when the active word becomes **filled** (right or wrong — same pool).

**Timer resets** when the focused clue changes **or** the active word becomes fully filled — so teasing never leaks “you’re wrong.”

**Guards:** no overlapping audio; ~12 s global cooldown between idle quips; one dwell escalation cycle per clue; everything yields while the oracle is already speaking.

**Non-telegraphing rule:** correctness is computed only in `check()`. The voice must never behave differently for right vs. wrong words.

## Behind the Scenes (Decisions)

- **Centered column, left-aligned copy** — Shop product pages feel editorial because the *block* is centered, not because every line is centered. `mx-auto` on `AppShell` does that while keeping prose left-aligned.
- **`a24-meta` vs `a24-caption`** — Grid “PREORDER” / price lines use tiny all-caps gray (`a24-meta`). Location hints use sentence-case italic under the still (`a24-caption`) so we never fight the image with white/black overlays.
- **Footer mockup** — Inert links for visual parity only; keeps the puzzle demo honest without implying a real shop checkout.
- **Crossword padding vs blocks** — One `null` type made every non-letter cell black, including square padding outside the puzzle. Option A from the plan: pad to a square, center the puzzle, mark outer cells `empty` (transparent) and inner nulls `block` (black). Arrow keys skip `empty` via `isCell()` on letter cells only.
- **Voice is presentation-only** — `showPalette` / `finalizeExperience` unchanged. ElevenLabs is post-production VO on the same script OpenRouter writes; API key stays on the server.
- **Autoplay unlock** — first click/keypress unlocks TTS (browser policy). Opening line speaks after unlock when you change channels.
- **Scribe tap-to-toggle** — realtime STT is manual commit (not always-on VAD) to avoid TV speaker bleed; echo cancellation on the mic stream; typed Send remains the fallback if permission is denied.
- **Scribe keyterms vs catalog copy** — film titles in `films.ts` can exceed Scribe's 20-char keyterm cap; the bias list uses shorthand, not a verbatim dump of catalog strings.
- **Script-sourced personas** — Marion, William, and Lucy prompts were tuned from primary-source PDFs: `docs/scripts/LADY_BIRD_shooting_script.pdf`, `docs/scripts/the-witch-shooting-script.pdf`, and `docs/scripts/MATERIALISTS-shooting-script.pdf`. Each persona carries signature lines, speech patterns, and tonal beats from those scripts (Marion's practical guilt-as-love; William's Early Modern conscience; Lucy's matchmaker market pragmatism).
- **Crossword oracle fail-open** — `/api/oracle-quip` uses OpenRouter with `reasoning.effort: none` so Kimi K2.6 returns spoken text, not thinking tokens only. Any route error → authored `idle45` bank; puzzle stays fully playable mute.

## Bloopers (Bugs & Fixes)

- **Hint on stills** — Gradient + white/gray text on photos failed on unpredictable frames (like bad lower-thirds on a documentary). Moved hints to `figcaption` under the image.
- **Footer flush to edge** — A global `* { padding: 0 }` sat *outside* Tailwind’s `@layer`, so it beat `.a24-gutter` in the cascade. Reset moved into `@layer base`; footer uses symmetric `a24-footer-inset` (~20–40px).
- **Gray Mapbox map (pins only)** — [PR #3](https://github.com/mite404/a24-puzzle/pull/3) already proved the map on `main`: simple `location-map.tsx` + `NEXT_PUBLIC_MAPBOX_TOKEN`. The regression on `styling-details` came from layering *more* Mapbox wiring on top — `mapLib`, CSP worker `postinstall`, debug probes, `transpilePackages: ["mapbox-gl"]`. You got logo, zoom, and pins on gray; `NaN LngLat` was usually fallout from a map that never reached `load`, not bad data in `locations.ts`. **Fix:** revert to the PR pattern (plain `<Map mapboxAccessToken mapStyle=…>`), drop worker/debug extras, `bun run dev:clean`. **Not the culprit:** missing files, zero-size container, or quota — style/tile API calls could still return **200** while the canvas stayed blank; a **304** on `_next/.../mapbox-gl.css` is just local bundle cache. Healthy Network tab: `api.mapbox.com` style + lots of `/v4/...vector.pbf` after the quiz reveals the map.
- **Scribe mic: `1008 invalid_request` + “WebSocket is not connected”** — Token mint succeeded (`/api/scribe-token` → 200), but the browser WebSocket died on connect. Root cause: two catalog keyterms exceeded ElevenLabs' client limit (**20 characters each** — see `@elevenlabs/client` `scribe.d.ts`): `"Everything Everywhere All at Once"` and `"Lotte New York Palace"`. Those strings ride on the WebSocket **query string** at connect time (model, token, keyterms, etc.); invalid params fail the handshake before any audio flows. The second error is a **symptom**: server closes the socket → mic capture still tries `send()` → “WebSocket is not connected.” **Fix:** `buildScribeKeyterms()` enforces 50×20, drops oversize terms, and maps long titles to spoken shorthand (`"All at Once"`, `"Lotte Palace"`). Separate gotcha: API key needs **Speech-to-Text** permission, not just TTS — missing scope surfaces as 401 on token mint, not on the WebSocket.
- **Valence mic tap: SDK vs manual PCM (path b)** — Early plan assumed `@elevenlabs/react` might expose the underlying `MediaStream` for a shared fork to Valence, or a second `getUserMedia` as fallback. Investigation showed the SDK's built-in mic mode owns capture internally — no stream handle, no clean dual-consumer hook. **Fix:** switched to **manual PCM mode** (`audioFormat: PCM_16000` + `sendAudio`): `startScribeAudioTap()` grabs one `getUserMedia`, runs an AudioWorklet that resamples to 16 kHz, forwards base64 chunks to Scribe *and* accumulates PCM locally. On commit, chunks become a WAV blob → `POST /api/valence`. A second mic request was never needed — one boom, two mix buses.

## Director's Commentary

When borrowing a brand’s layout, steal **tokens** (gutter, meta size, footer rhythm) before stealing **components**. One CSS variable (`--a24-meta`) buys consistent “small gray caps” everywhere without re-measuring Figma.

### Location map hover cards (Figma → code)

After the quiz, **Beat 2** is explore mode: hover a nearby pin and a **collapsed card** (346×364, rounded top, still + gradient + neighborhood / film / venue / “more info…”) appears. Click **more info…** and the popup grows to the **expanded card** (518px) with the A24 logo, carousel ticks, and black footer — like a push-in from a wide shot to a close-up on the same set.

- **Component:** `LocationPinCard` in `src/components/games/location-pin-card.tsx`; `LocationMap` only holds hover/expanded state.
- **Assets:** stills from each `FilmLocation.photoUrl`; logo from `/a24-assets/A24-Films-Logo-Vector.png` (no duplicate Figma exports).
- **Data:** optional `venueLabel` on locations (e.g. St. Barts Cathedral); film row uses `getFilmShortTitle()` (drops leading “The”).
- **Carousel:** expanded cards auto-advance film stills every 4s (RTL slide via `translateX`); segment dots track `activeIndex`; autoplay pauses on hover and respects `prefers-reduced-motion`. Collapsed cards keep the single `photoUrl` hero. Gallery comes from optional `photoUrls` on a location, or falls back to `getLocationPhotoUrls()` (primary still + `filmStillsForFilm()` pool in `locations.ts`).
