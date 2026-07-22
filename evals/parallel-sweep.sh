#!/usr/bin/env bash
# Parallel sweep driver: one background bun process per persona, each doing
# --runs=3. Every process writes its own resumable evals/runs/<cell>.json, so
# concurrency is safe (distinct filenames, cellIsDone skips completed cells).
# Collapses ~5h of sequential cells into ~max-single-persona wall-clock.
set -u
cd "$(dirname "$0")/.."

PERSONAS=(
  actor-collette actor-pattinson adversarial-off-topic
  director-ari-aster director-safdie effusive-overlong
  mood-led-no-film single-film-the-witch single-film-uncut-gems
  terse-one-word undecided-contradicts
)

echo "Parallel sweep start: ${#PERSONAS[@]} personas x 3 runs"
pids=()
for p in "${PERSONAS[@]}"; do
  bun evals/run.ts --runs=3 --only="$p" > "evals/psweep-${p}.log" 2>&1 &
  pids+=($!)
  echo "  launched $p (pid $!)"
done

echo "Waiting for ${#pids[@]} processes ..."
fail=0
for pid in "${pids[@]}"; do
  wait "$pid" || fail=$((fail+1))
done

echo "Parallel sweep done. failures=$fail cells=$(ls evals/runs/*.json 2>/dev/null | wc -l)"
