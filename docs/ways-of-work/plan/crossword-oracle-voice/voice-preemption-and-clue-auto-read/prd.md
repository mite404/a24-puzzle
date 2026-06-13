# Voice Preemption & Click-to-Hear Clue Read

**Epic:** Crossword Oracle — [`crossword-oracle-plan.md`](../../../crossword-oracle-plan.md)

---

## Problem

Two small UX bugs in the crossword oracle voice system:

1. **Audio queue.** Rapid clue clicks fire multiple concurrent `/api/voice` (ElevenLabs) fetches. The generation guard ensures only the last one plays, but earlier fetches are never aborted — wasting API quota and adding latency.

2. **Clue-read affordance.** The 🔊 icon was easy to miss. Clicking the whole clue row is more intuitive.

---

## Changes

**Click-to-hear — ✅ done (`crossword.tsx`)**
- Removed `Volume2` icon and its button from `ClueList`.
- Every clue row is now a full-width `<button>` that fires `onReadClue(word)`.
- Hint text *"Click on a clue to **hear** more."* added below both clue lists (hidden when oracle isn't wired).

**Voice preemption — ⏳ pending**
- Add `AbortController` ref to `useOracleSpeaker.speak()`. Abort the previous in-flight `/api/voice` fetch before starting a new one.
- `cancelSpeech()` should also abort the current controller.
- Thread an external `AbortSignal` into `fetchOracleQuipLine` so the idle45 LLM call (`/api/oracle-quip`) can also be cancelled mid-flight.

---

## Files

| File | Status |
|------|--------|
| `src/components/games/crossword.tsx` | ✅ |
| `src/hooks/use-oracle-speaker.ts` | ⏳ |
| `src/hooks/use-crossword-oracle.ts` | ⏳ |
| `src/lib/crossword-oracle-quip-fetch.ts` | ⏳ |

---

## Checklist

- [x] No 🔊 icon in clue list
- [x] Clue row click triggers `onReadClue`
- [x] Hint text appears, hidden without oracle
- [ ] `/api/voice` fetch aborted on new speech event (visible as `cancelled` in DevTools)
- [ ] `/api/oracle-quip` fetch aborted on new speech event
- [ ] No error state surfaced for aborted fetches
- [ ] Idle quips and completion reactions unaffected
