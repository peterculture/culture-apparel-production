#!/usr/bin/env node
/**
 * Fails if any page puts a dc-runtime custom element inside a <table>.
 *
 * WHY THIS EXISTS (E4.6, 2026-09-01)
 *
 * The HTML parser only allows table-related elements inside <table>. Anything
 * else -- <sc-for>, <sc-if>, <x-import> -- is FOSTER-PARENTED out of the table
 * before a single line of script runs. dc-runtime then adopts its template from
 * the live DOM (parseDcDocument -> dc.innerHTML, support.js), so the template it
 * compiles is the mangled one, with the loop gone from the table.
 *
 * This shipped. order-sheet.html's garment size breakdown printed with no size
 * columns and no per-size quantities -- just "Qty" and a grand total -- on the
 * sheet that goes to the press to say how many of each size to print.
 *
 * support.js HAS a repair: it refetches the page as raw text and re-parses the
 * unmangled template. It is gated on `if (!window.__resources)`, and E4.4
 * (2026-08-31) set window.__resources on all nine pages to self-host React. So
 * the repair has been dead since then, and nothing should be written that needs
 * it. That is why this check exists rather than a note asking people to be
 * careful.
 *
 * THE FIX, when this fires: don't use <table>. display:table / table-row /
 * table-cell on divs lays out identically, and the parser leaves custom
 * elements alone because none of it is a table. sc-for renders as a React
 * Fragment (walkFor), so its children land directly in the row -- no anonymous
 * cell box. See the size grid in order-sheet.html for the worked example, and
 * spell out text-align/vertical-align, which <th>/<td> used to get free from
 * the UA stylesheet.
 *
 * <select> is NOT affected -- measured, not assumed: all 39 <sc-for> inside
 * <select> across index/pre-production/calendar survive the parse intact.
 *
 * Usage: node tools/check-dc-templates.mjs
 * Exits 1 on a finding. Belongs in the E8.5 pre-deploy script.
 */
import { readdirSync, readFileSync } from "node:fs";

const DC_TAGS = /<(sc-for|sc-if|x-import|dc-import|sc-helmet)\b/gi;
const findings = [];

for (const file of readdirSync(".").filter((f) => f.endsWith(".html")).sort()) {
  const src = readFileSync(file, "utf8");
  let i = 0;
  for (;;) {
    const open = src.toLowerCase().indexOf("<table", i);
    if (open < 0) break;
    const close = src.toLowerCase().indexOf("</table>", open);
    if (close < 0) break;
    const segment = src.slice(open, close);
    for (const m of segment.matchAll(DC_TAGS)) {
      const line = src.slice(0, open + m.index).split("\n").length;
      findings.push({ file, line, tag: m[1] });
    }
    i = close + 8;
  }
}

if (findings.length) {
  console.error("FAIL: dc-runtime elements inside <table> -- the HTML parser will");
  console.error("      move these OUT of the table and the loop will not render.\n");
  for (const f of findings) console.error(`  ${f.file}:${f.line}  <${f.tag}>`);
  console.error("\nUse display:table / table-row / table-cell on divs instead.");
  console.error("See the size grid in order-sheet.html, and this file's header.");
  process.exit(1);
}
console.log(`OK: no dc-runtime elements inside <table> (${readdirSync(".").filter((f) => f.endsWith(".html")).length} pages checked)`);
