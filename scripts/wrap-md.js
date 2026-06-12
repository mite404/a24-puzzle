#!/usr/bin/env bun
/**
 * wrap-md.js — Wrap long lines in markdown files to stay under 100 bytes per line.
 *
 * Usage:
 *   bun scripts/wrap-md.js docs/FOR_ETHAN.md
 *   bun scripts/wrap-md.js docs/*.md
 *
 * Rules:
 *   - Lines inside code blocks (``` fences) are never wrapped
 *   - Table rows (starting with |) are never wrapped (would break markdown)
 *   - Headings (starting with #) are never wrapped
 *   - Blockquote lines (starting with >) wrap with the prefix preserved on each line
 *   - Lines containing inline code spans (`...`) never wrap mid-span
 *   - All other lines over 100 bytes are wrapped at the nearest word boundary
 *
 * Why bytes, not characters?
 *   awk and most linters count bytes, not JS string characters.
 *   Multi-byte chars like em-dashes (—) are 3 bytes but 1 JS char.
 *   Using Buffer.byteLength() keeps our count in sync with the linter.
 */

import { readFileSync, writeFileSync } from "fs";

const MAX_BYTES = 100;

// Count bytes (not JS characters) to match what linters see
function byteLen(str) {
  return Buffer.byteLength(str, "utf8");
}

// True if this line contains unclosed backtick spans
function hasUnclosedBackticks(str) {
  // Count backticks that aren't in ``` fences
  const nonFenceBackticks = str.replace(/```/g, "").split("`").length - 1;
  return nonFenceBackticks % 2 !== 0;
}

// Find the rightmost safe split point in a string, before maxByteLen,
// that doesn't break an inline code span.
function findSafeSplit(str, maxByteLen) {
  let best = null;
  let inBackticks = false;
  let byteCount = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charBytes = Buffer.byteLength(char, "utf8");
    byteCount += charBytes;

    if (char === "`") {
      // Skip ``` fences completely — we never split in code blocks anyway,
      // but this keeps the state machine correct for inline spans.
      if (str.slice(i, i + 3) === "```") {
        i += 2;
        continue;
      }
      inBackticks = !inBackticks;
      continue;
    }

    if (!inBackticks && char === " " && byteCount <= maxByteLen) {
      best = i;
    }
  }

  return best;
}

// Wrap a single long line, never breaking inside backtick spans.
function wrapLine(line, maxBytes) {
  const blockquoteMatch = line.match(/^(>\s?)(.*)$/);
  if (blockquoteMatch) {
    const prefix = blockquoteMatch[1];
    const maxContentBytes = maxBytes - byteLen(prefix);
    return wrapLineSmart(blockquoteMatch[2], maxContentBytes).map(
      (wrapped) => prefix + wrapped,
    );
  }

  return wrapLineSmart(line, maxBytes);
}

function wrapLineSmart(content, maxBytes) {
  if (byteLen(content) <= maxBytes) return [content];

  const lines = [];
  let remaining = content;

  while (byteLen(remaining) > maxBytes) {
    const splitAt = findSafeSplit(remaining, maxBytes);
    if (splitAt === null) {
      // Cannot find safe split — bail out, keep the rest as one line
      lines.push(remaining);
      return lines;
    }
    lines.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt + 1); // skip the space
  }

  if (remaining) lines.push(remaining);
  return lines;
}

// Process a single file
function processFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const output = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Toggle code block tracking when we hit a fence
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      output.push(line);
      continue;
    }

    // Never touch lines inside code blocks, table rows, or headings
    const isProtected =
      inCodeBlock ||
      line.startsWith("|") ||
      line.startsWith("#");

    // Also protect lines that have unclosed backticks (spans that cross the line)
    // This shouldn't happen in well-formed markdown, but protects us.
    const isInlineCodeSpan = !inCodeBlock && hasUnclosedBackticks(line);

    if (isProtected || isInlineCodeSpan || byteLen(line) <= MAX_BYTES) {
      output.push(line);
    } else {
      // Wrap and push potentially multiple lines
      for (const wrapped of wrapLine(line, MAX_BYTES)) {
        output.push(wrapped);
      }
    }
  }

  writeFileSync(filePath, output.join("\n"));

  // Report how many lines are still over limit (should only be tables/code)
  const remaining = output.filter(
    (l) =>
      !l.startsWith("|") &&
      !l.startsWith("    ") && // indented code
      !l.trim().startsWith("```") &&
      byteLen(l) > MAX_BYTES,
  ).length;

  console.log(`✓ ${filePath} — ${remaining} long non-table lines remaining`);
}

// Read file paths from CLI args
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: bun scripts/wrap-md.js <file.md> [file.md ...]");
  process.exit(1);
}

for (const file of files) {
  processFile(file);
}
