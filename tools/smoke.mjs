#!/usr/bin/env node
/**
 * Pre-deploy smoke check.  (E8.5)
 *
 * Run before every push:   node tools/smoke.mjs
 * Exits 1 on any failure.  Takes a few seconds, not the ten minutes budgeted.
 *
 * WHY EACH CHECK EXISTS. Every one of these is an incident this project has
 * actually had, not a generic lint. In order of how much they cost:
 *
 *   A file referenced but not IN THE REPO.  tokens.css was linked by all nine
 *   pages and never added. The site lost its base chrome and every tokenised
 *   colour resolved to nothing -- muted labels rendered black on dark, i.e.
 *   invisible. It was then pushed a second time as `token.css`, one letter off,
 *   and the site stayed broken. `_placements.js` nearly did the same thing
 *   earlier, imported by four server files. Existing on the author's disk is
 *   not the same as existing in the deployment, and `git status` showing a `??`
 *   is the only difference between them.
 *
 *   A route file with no .js extension.  functions/api/shipments/combine and
 *   split shipped without one. Cloudflare only compiles *.js under functions/,
 *   so both endpoints answered 405 with an empty body -- byte-identical to a
 *   route that was never written. Shipping's split and combine were dead on the
 *   live site and nothing said so.
 *
 *   An import that does not resolve.  functions/api/_to_delete/vendors/index.js
 *   imports "../_sf.js", which is not there. That single line makes
 *   `npx wrangler pages dev .` fail to build Functions at all -- the one local
 *   verification tool this project has, dead, for a file nobody uses.
 *
 *   A page whose logic does not parse.  A `const` declared in the wrong scope
 *   took the counting screen down with "listState is not defined" and a red
 *   overlay. The HTML was still valid; only the embedded script was broken, so
 *   nothing else would have caught it.
 *
 *   Custom elements inside <table>, and text contrast.  Delegated to the two
 *   focused tools next to this one, which are also useful on their own.
 *
 * VERIFIED AGAINST THE REAL INCIDENTS, not just written to look right. Each of
 * the eight was reconstructed in a throwaway worktree and this script was run
 * against it; all eight failed the run, and the untouched tree passes clean.
 * If you change a check, re-do that -- a smoke script that only ever passes is
 * worse than none, because it is trusted.
 *
 * RUN IT BEFORE EVERY PUSH. To make that automatic:
 *
 *     printf '#!/bin/sh\nexec node tools/smoke.mjs\n' > .git/hooks/pre-push
 *     chmod +x .git/hooks/pre-push
 *
 * Hooks are not tracked by git, so each clone opts in separately.
 *
 * WHAT THIS DOES NOT DO. It never talks to Salesforce and never starts a
 * server, so it cannot tell you a query is wrong or a board renders demo data.
 * A green run means "this could deploy", not "this works" -- CLAUDE.md's rule
 * still stands: check the network tab, not the screen.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve, relative, extname } from "node:path";

const ROOT = process.cwd();
let failures = 0;
let checks = 0;
let warnings = 0;

const say = (s = "") => console.log(s);
const pass = (label, detail = "") => { checks++; say(`  \x1b[32m✓\x1b[0m ${label}${detail ? "  " + detail : ""}`); };
const warn = (label, lines) => {
  warnings++;
  say(`  \x1b[33m!\x1b[0m ${label}`);
  for (const l of lines) say(`      ${l}`);
};
const fail = (label, lines) => {
  checks++; failures++;
  say(`  \x1b[31m✗\x1b[0m ${label}`);
  for (const l of lines) say(`      ${l}`);
};

/** Files git actually knows about -- the deployment sees these and nothing else. */
let tracked = new Set();
let gitAvailable = true;
try {
  tracked = new Set(
    execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean),
  );
} catch {
  gitAvailable = false;
}

function walk(dir, out = [], includeDead = false) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === ".git" || name === "node_modules") continue;
      if (name === "_to_delete" && !includeDead) continue;
      walk(p, out, includeDead);
    } else out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const htmlFiles = () => readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

say("\n\x1b[1mPre-deploy smoke check\x1b[0m  ·  E8.5\n");

/* ── 1. Everything a page references exists AND is committed ─────────── */
{
  const bad = [];
  for (const f of htmlFiles()) {
    const src = readFileSync(join(ROOT, f), "utf8");
    for (const m of src.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
      const url = m[1];
      if (/^(https?:)?\/\//.test(url) || url.startsWith("data:") || url.startsWith("#") || url.startsWith("mailto:")) continue;
      // A {{binding}} is resolved at render time, not a path on disk.
      if (url.includes("{{")) continue;
      const clean = url.split("?")[0].split("#")[0];
      if (!clean || clean.endsWith(".html")) continue; // page-to-page links are the SPA's business
      // Only FILE assets. This check exists for the stylesheet/script/font that
      // is referenced and not there; an extensionless href is a Salesforce
      // record link or an SPA route, and neither is ours to resolve.
      if (!/\.(css|js|mjs|json|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|map|pdf)$/i.test(clean)) continue;
      const target = resolve(ROOT, clean.replace(/^\.\//, ""));
      const r = rel(target);
      if (!existsSync(target)) bad.push(`${f} -> ${url}   NOT ON DISK`);
      else if (gitAvailable && !tracked.has(r)) bad.push(`${f} -> ${url}   on disk but NOT COMMITTED (git status shows ?? ${r})`);
    }
  }
  if (bad.length) fail("every referenced asset exists and is committed", [...new Set(bad)]);
  else pass("every referenced asset exists and is committed");
}

/* ── 2. No route file without a .js extension ────────────────────────── */
{
  const bad = [];
  if (existsSync(join(ROOT, "functions"))) {
    for (const p of walk(join(ROOT, "functions"))) {
      const base = p.split("/").pop();
      if (base === ".DS_Store") continue;
      if (extname(p) !== ".js") bad.push(`${rel(p)}   Cloudflare will not compile this into a route`);
    }
  }
  if (bad.length) fail("no extensionless files under functions/", bad);
  else pass("no extensionless files under functions/");
}

/* ── 3. Every relative import resolves, and is committed ─────────────── */
{
  const bad = [];
  const local = [];
  // _to_delete is included here ON PURPOSE. wrangler compiles every .js under
  // functions/, dead or not, so one unresolvable import in there fails the
  // whole Functions build -- which is how the only local verification tool this
  // project has ended up broken by a folder nobody uses.
  const jsFiles = [
    ...(existsSync(join(ROOT, "functions")) ? walk(join(ROOT, "functions"), [], true) : []),
    ...(existsSync(join(ROOT, "tools")) ? walk(join(ROOT, "tools"), [], true) : []),
  ].filter((p) => p.endsWith(".js") || p.endsWith(".mjs"));

  for (const p of jsFiles) {
    const src = readFileSync(p, "utf8");
    const importerTracked = !gitAvailable || tracked.has(rel(p));
    for (const m of src.matchAll(/\bfrom\s+"(\.[^"]+)"/g)) {
      const target = resolve(dirname(p), m[1]);
      const r = rel(target);
      let msg = null;
      if (!existsSync(target)) msg = `${rel(p)} imports "${m[1]}"   TARGET MISSING`;
      else if (gitAvailable && !tracked.has(r)) msg = `${rel(p)} imports "${m[1]}"   exists but NOT COMMITTED (${r})`;
      if (!msg) continue;
      (importerTracked ? bad : local).push(msg);
    }
  }
  if (bad.length) fail("every relative import resolves and is committed", bad);
  else pass("every relative import resolves and is committed");
  if (local.length) {
    warn("untracked local files with broken imports", [
      ...local,
      "These cannot break the deploy -- they are not in the repo. They DO break",
      "`npx wrangler pages dev .`, which fails to build Functions at all. Delete them.",
    ]);
  }
}

/* ── 4. Server modules parse ─────────────────────────────────────────── */
{
  const bad = [];
  const files = existsSync(join(ROOT, "functions")) ? walk(join(ROOT, "functions")).filter((p) => p.endsWith(".js")) : [];
  for (const p of files) {
    try {
      execFileSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(p), stdio: ["pipe", "ignore", "pipe"] });
    } catch (e) {
      bad.push(`${rel(p)}   ${String(e.stderr || "").split("\n").find((l) => /Error/.test(l)) || "syntax error"}`);
    }
  }
  if (bad.length) fail(`server modules parse (${files.length} files)`, bad);
  else pass(`server modules parse`, `${files.length} files`);
}

/* ── 5. Each page's embedded logic parses ────────────────────────────── */
{
  const bad = [];
  let n = 0;
  for (const f of htmlFiles()) {
    const src = readFileSync(join(ROOT, f), "utf8");
    const m = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) continue;
    n++;
    try {
      execFileSync(process.execPath, ["--check"], { input: m[1], stdio: ["pipe", "ignore", "pipe"] });
    } catch (e) {
      const line = String(e.stderr || "").split("\n").find((l) => /Error/.test(l)) || "syntax error";
      bad.push(`${f}   ${line.trim()}`);
    }
  }
  if (bad.length) fail(`board logic parses (${n} pages)`, bad);
  else pass("board logic parses", `${n} pages`);
}

/* ── 6 & 7. Delegate to the focused tools ────────────────────────────── */
for (const [script, label] of [
  ["tools/check-dc-templates.mjs", "no dc-runtime elements inside <table>"],
  ["tools/contrast.mjs", "text tokens meet their contrast target"],
]) {
  if (!existsSync(join(ROOT, script))) { fail(label, [`${script} is missing`]); continue; }
  try {
    execFileSync(process.execPath, [script], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    pass(label);
  } catch (e) {
    const out = String(e.stdout || "") + String(e.stderr || "");
    fail(label, out.split("\n").filter((l) => l.trim()).slice(0, 12));
  }
}

/* ── verdict ─────────────────────────────────────────────────────────── */
say();
if (failures) {
  say(`\x1b[31m${failures} of ${checks} checks failed. Do not push.\x1b[0m${warnings ? `  (${warnings} warning${warnings > 1 ? "s" : ""} above)` : ""}`);
  say("Nothing here talks to Salesforce -- a clean run means this CAN deploy, not that it works.");
  process.exit(1);
}
say(`\x1b[32mAll ${checks} checks passed.\x1b[0m${warnings ? `  (${warnings} warning${warnings > 1 ? "s" : ""} above -- not blocking)` : ""}`);
say("This says the deployment is well-formed. It says nothing about whether a query is right --");
say("every board still falls back to demo data on failure, so check the network tab, not the screen.");
