#!/usr/bin/env node
/**
 * WCAG 2.1 contrast ratios for the tokens in tokens.css.
 *
 * E9.4. The shop reads these boards at arm's length on a tablet under shop
 * lighting, which is the opposite of the conditions anyone picks colours in.
 * This makes the numbers checkable instead of a matter of opinion -- but it is
 * NOT the sign-off. AA is a floor, and the real test is a tablet on the floor
 * with the lights on.
 *
 * Thresholds: 4.5:1 normal text, 3:1 large text (>=18.66px bold or >=24px).
 * Most of this app's muted text is 9-11px, so 4.5:1 is the bar that applies.
 *
 * Usage: node tools/contrast.mjs
 * Exits 1 if a token marked as text fails its target.
 */
import { readFileSync } from "node:fs";

const css = readFileSync("tokens.css", "utf8");
const tok = {};
for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) tok[m[1]] = m[2];

const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) =>
  srgb(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* Text tokens and the surface each is actually read against. */
const PAIRS = [
  ["--text-primary",   "--surface-page",   4.5],
  ["--text-secondary", "--surface-page",   4.5],
  ["--text-tertiary",  "--surface-page",   4.5],
  ["--text-muted",     "--surface-page",   4.5],
  ["--text-muted",     "--surface-card",   4.5],
  ["--text-faint",     "--surface-page",   4.5],
  ["--text-faint",     "--surface-card",   4.5],
  ["--text-ghost",     "--surface-sunken", 4.5],
  ["--ok",             "--surface-page",   4.5],
  ["--warn",           "--surface-page",   4.5],
  ["--danger-text",    "--surface-page",   4.5],
  ["--accent-hot",     "--surface-page",   4.5],
  ["--teal",           "--surface-page",   4.5],
  ["--purple",         "--surface-page",   4.5],
];

let failed = 0;
console.log("token               on surface           value    ratio   need   ");
console.log("-".repeat(72));
for (const [t, s, need] of PAIRS) {
  if (!tok[t] || !tok[s]) { console.log(`  MISSING ${t} or ${s}`); failed++; continue; }
  const r = ratio(tok[t], tok[s]);
  const ok = r >= need;
  if (!ok) failed++;
  console.log(
    `${t.padEnd(19)} ${s.padEnd(19)} ${tok[t]}  ${r.toFixed(2).padStart(5)}:1  ${need}    ${ok ? "pass" : "FAIL"}`
  );
}
console.log("-".repeat(72));
console.log(failed ? `${failed} failing pair(s)` : "all text tokens meet their target");
console.log("\nAA is the floor. Sign-off is a tablet under real shop lights (E9.4).");
process.exit(failed ? 1 : 0);
