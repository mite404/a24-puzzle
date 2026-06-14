# Plan: Tests for Voice Preemption Feature

## Context

Three files were changed to add `AbortController`-based voice preemption. Without automated tests, any future refactor could silently break the cancellation behavior and you'd only catch it by watching DevTools Network. The goal is a regression suite that runs automatically with `bun test`.

---

## What Can and Can't Be Unit Tested

**Can test right now (pure async function, already injectable):**
- `fetchOracleQuipLine` in `src/lib/crossword-oracle-quip-fetch.ts` — accepts a `fetchImpl` param for mocking, and now accepts `externalSignal`. Follows the exact pattern of the existing test file.

**Can't test without adding new infrastructure:**
- `useOracleSpeaker` and `useCrosswordOracle` are React hooks. Bun's test runner has no DOM or React renderer. Testing them would require `@testing-library/react` + `happy-dom` — a bigger lift than the feature itself. The hook-level abort behavior remains manually verified via DevTools for now.

---

## Tests to Add

**File:** `src/lib/crossword-oracle-quip-fetch.test.ts` (add a new `describe` block)

The existing tests pass a mock fetch function as the 3rd argument. The new tests do the same but also pass an `externalSignal` as the 4th. The key addition is a **signal-aware mock fetch** — the existing mocks ignore the `signal` option, so a new helper that checks `opts?.signal?.aborted` and throws `DOMException("Aborted", "AbortError")` when true is needed.

**Three new tests:**

1. **Already-aborted signal → `null`**
   Create an `AbortController`, call `.abort()` before passing its signal. The combined `AbortSignal.any(...)` is immediately aborted. The signal-aware mock throws, catch returns `null`.

2. **Signal fires mid-fetch → `null`**
   The mock fetch calls `controller.abort()` on entry (simulating cancellation mid-flight), then checks `opts?.signal?.aborted` and throws. Result should be `null`.

3. **External signal present but not aborted, fetch succeeds → line returned**
   Pass a live (non-aborted) signal alongside a successful mock response. Proves the normal happy path still works when a signal is wired in and doesn't fire.

---

## Shared Helper to Add

```ts
// signal-aware mock fetch — mirrors how the real fetch behaves when aborted
const signalAwareMock = (response: Response) =>
  async (_url: string, opts?: RequestInit): Promise<Response> => {
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return response;
  };
```

This helper goes at the top of the new `describe` block. All three tests use it.

---

## Verification

Run `bun test src/lib/crossword-oracle-quip-fetch.test.ts` after adding the tests. All existing tests must still pass (regression check). The three new tests prove:
- An aborted signal results in `null` (no throw, no error surfaced — matching the fail-open contract)
- The happy path with a signal wired in still returns the LLM line
