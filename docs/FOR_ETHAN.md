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

### Crossword as floating matte (Round 2)

The crossword grid is a **square title card** — not a fixed rectangle of black tiles. Think post-production: the puzzle sits on a transparent matte over the page background.

- **Three cell kinds** — `letter` (white inputs), `block` (black squares inside the puzzle), `empty` (transparent padding that lets the page show through).
- **Square frame** — the tight generator bounding box is centered inside `max(rows, cols)`, so non-square puzzles get see-through gutters instead of a heavy black box.
- **Fluid sizing** — `aspect-square w-full max-w-[min(72vw,55dvh,28rem)]` scales the grid to the largest square that fits; cells use `1fr` tracks and `aspect-square` instead of fixed `size-9`.
- **Layout** — grid floats in a `relative z-10` layer with a subtle letter-cell shadow; clues stay in normal flow beside (desktop) or below (mobile) the square.

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

## Bloopers (Bugs & Fixes)

- **Hint on stills** — Gradient + white/gray text on photos failed on unpredictable frames (like bad lower-thirds on a documentary). Moved hints to `figcaption` under the image.
- **Footer flush to edge** — A global `* { padding: 0 }` sat *outside* Tailwind’s `@layer`, so it beat `.a24-gutter` in the cascade. Reset moved into `@layer base`; footer uses symmetric `a24-footer-inset` (~20–40px).
- **Gray Mapbox map (pins only)** — [PR #3](https://github.com/mite404/a24-puzzle/pull/3) already proved the map on `main`: simple `location-map.tsx` + `NEXT_PUBLIC_MAPBOX_TOKEN`. The regression on `styling-details` came from layering *more* Mapbox wiring on top — `mapLib`, CSP worker `postinstall`, debug probes, `transpilePackages: ["mapbox-gl"]`. You got logo, zoom, and pins on gray; `NaN LngLat` was usually fallout from a map that never reached `load`, not bad data in `locations.ts`. **Fix:** revert to the PR pattern (plain `<Map mapboxAccessToken mapStyle=…>`), drop worker/debug extras, `bun run dev:clean`. **Not the culprit:** missing files, zero-size container, or quota — style/tile API calls could still return **200** while the canvas stayed blank; a **304** on `_next/.../mapbox-gl.css` is just local bundle cache. Healthy Network tab: `api.mapbox.com` style + lots of `/v4/...vector.pbf` after the quiz reveals the map.
- **Scribe mic: `1008 invalid_request` + “WebSocket is not connected”** — Token mint succeeded (`/api/scribe-token` → 200), but the browser WebSocket died on connect. Root cause: two catalog keyterms exceeded ElevenLabs' client limit (**20 characters each** — see `@elevenlabs/client` `scribe.d.ts`): `"Everything Everywhere All at Once"` and `"Lotte New York Palace"`. Those strings ride on the WebSocket **query string** at connect time (model, token, keyterms, etc.); invalid params fail the handshake before any audio flows. The second error is a **symptom**: server closes the socket → mic capture still tries `send()` → “WebSocket is not connected.” **Fix:** `buildScribeKeyterms()` enforces 50×20, drops oversize terms, and maps long titles to spoken shorthand (`"All at Once"`, `"Lotte Palace"`). Separate gotcha: API key needs **Speech-to-Text** permission, not just TTS — missing scope surfaces as 401 on token mint, not on the WebSocket.

## Director's Commentary

When borrowing a brand’s layout, steal **tokens** (gutter, meta size, footer rhythm) before stealing **components**. One CSS variable (`--a24-meta`) buys consistent “small gray caps” everywhere without re-measuring Figma.

### Location map hover cards (Figma → code)

After the quiz, **Beat 2** is explore mode: hover a nearby pin and a **collapsed card** (346×364, rounded top, still + gradient + neighborhood / film / venue / “more info…”) appears. Click **more info…** and the popup grows to the **expanded card** (518px) with the A24 logo, carousel ticks, and black footer — like a push-in from a wide shot to a close-up on the same set.

- **Component:** `LocationPinCard` in `src/components/games/location-pin-card.tsx`; `LocationMap` only holds hover/expanded state.
- **Assets:** stills from each `FilmLocation.photoUrl`; logo from `/a24-assets/A24-Films-Logo-Vector.png` (no duplicate Figma exports).
- **Data:** optional `venueLabel` on locations (e.g. St. Barts Cathedral); film row uses `getFilmShortTitle()` (drops leading “The”).
- **Carousel:** expanded cards auto-advance film stills every 4s (RTL slide via `translateX`); segment dots track `activeIndex`; autoplay pauses on hover and respects `prefers-reduced-motion`. Collapsed cards keep the single `photoUrl` hero. Gallery comes from optional `photoUrls` on a location, or falls back to `getLocationPhotoUrls()` (primary still + `filmStillsForFilm()` pool in `locations.ts`).
