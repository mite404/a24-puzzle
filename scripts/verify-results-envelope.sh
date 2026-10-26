#!/usr/bin/env bash
set -euo pipefail

export AGENT_BROWSER_SESSION="results-check-$$"
trap 'agent-browser close >/dev/null 2>&1 || true' EXIT

agent-browser open "${1:-http://localhost:3000}/?debug=end"
agent-browser set viewport 1440 1000 2
agent-browser wait '[aria-label="Open results envelope"]'
agent-browser find role button click --name 'VOICE OFF' --exact
agent-browser eval '(() => {
  const paper = document.querySelector("#results-paper");
  if (!paper.inert || paper.getAttribute("aria-hidden") !== "true") {
    throw new Error("Closed results must be hidden from assistive technology");
  }
})()'
agent-browser focus '[aria-label="Open results envelope"]'
agent-browser press Enter
agent-browser wait '[aria-label="Close results envelope"]'
agent-browser eval '(() => {
  const paper = document.querySelector("#results-paper");
  for (const expected of ["Arthouse Regular", "3/5", "4/7", "7/12"]) {
    if (!paper.textContent.includes(expected)) throw new Error(`Missing ${expected}`);
  }
  if (paper.inert || paper.getAttribute("aria-hidden") !== "false") {
    throw new Error("Opened results must be accessible");
  }
})()'
agent-browser press Space
agent-browser wait '[aria-label="Open results envelope"]'
agent-browser set viewport 390 844 2
agent-browser set media light reduced-motion
agent-browser press Enter
agent-browser wait '[aria-label="Close results envelope"]'
agent-browser eval '(() => {
  const paper = document.querySelector("#results-paper");
  const box = paper.getBoundingClientRect();
  if (box.left < 0 || box.right > innerWidth) throw new Error("Paper clips on narrow screens");
  const sleeve = document.querySelector("[aria-label=\"Close results envelope\"]");
  const sleeveBox = sleeve.getBoundingClientRect();
  const overlapY = (Math.max(box.top, sleeveBox.top) + Math.min(box.bottom, sleeveBox.bottom)) / 2;
  const overlapX = (Math.max(box.left, sleeveBox.left) + Math.min(box.right, sleeveBox.right)) / 2;
  if (box.bottom <= sleeveBox.top || !paper.contains(document.elementFromPoint(overlapX, overlapY))) {
    throw new Error("Results paper must overlap in front of the sleeve");
  }
  if (!sleeve.contains(document.elementFromPoint(sleeveBox.x + sleeveBox.width / 2, sleeveBox.bottom - 8))) {
    throw new Error("Sleeve must remain visible and clickable below the paper");
  }
  if (getComputedStyle(paper).transitionDuration !== "0s") {
    throw new Error("Reduced motion must disable the slide");
  }
})()'
agent-browser find role button click --name 'CONSULT THE ORACLE AGAIN' --exact
agent-browser wait --fn '!document.querySelector("[aria-label=\"Game results\"]")'
echo 'PASS: keyboard open/close, actual scores, narrow layout, reduced motion, and restart'
