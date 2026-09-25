#!/usr/bin/env node
/**
 * schema-check.js — catch Supabase calls that name columns which do not exist.
 *
 * Why this exists: the Supabase JS client RESOLVES on a failed query instead
 * of throwing, and PostgREST rejects an ENTIRE select if one column is wrong.
 * So a single typo silently returns nothing, forever, and looks like "no data"
 * rather than an error. Every one of these was found by a client noticing
 * something missing:
 *
 *   messages.receiver_id      (it is recipient_id)  - Rachel's dashboard showed
 *                                                     zero unread for months
 *   messages.content          (it is body)
 *   messages.read             (it is read_at)
 *   booking_requests.cancelled_at (canceled_at, one L)
 *   booking_requests.owner_id (does not exist at all)
 *   booking_requests.staff_id (it is assigned_to)
 *
 * Run:  node tools/schema-check.js
 *       node tools/schema-check.js --json
 * Exits 1 when something is wrong, so it can gate a deploy.
 *
 * The schema lives in tools/schema.json. Regenerate it after any migration -
 * see tools/README-schema-check.md.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const TABLES = SCHEMA.tables;
const VALUES = SCHEMA.allowedValues || {};
const JSON_OUT = process.argv.includes('--json');
const STALE = [];   // root-level duplicates of files in js/ or api/

// Files worth scanning. Skip archives and vendor copies - they are not deployed.
const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', 'migrations', 'housley-happy-paws']);
const SKIP_FILES = [
  /^index-latest\.html$/, /^housley-happy-paws-v\d+\.html$/,
  /-updated\.html$/, /^business-card\.html$/, /Landing page/i,
];
const EXT = new Set(['.js', '.html']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (EXT.has(path.extname(entry.name))) {
      if (SKIP_FILES.some(re => re.test(entry.name))) continue;
      // A root-level .js that also exists in js/ or api/ is a stale copy the
      // site does not load - index.html only ever references /js/... and
      // /api/... . Reporting bugs in dead files trains people to ignore this
      // tool. Delete the duplicates and this rule stops mattering.
      if (dir === ROOT && path.extname(entry.name) === '.js') {
        const shadowed = ['js', 'api'].some(sub =>
          fs.existsSync(path.join(ROOT, sub, entry.name)));
        if (shadowed) { STALE.push(entry.name); continue; }
      }
      out.push(full);
    }
  }
  return out;
}

// PostgREST select strings carry more than plain column names:
//   'id, full_name'                 plain
//   'count:id'                      alias
//   'id, profiles(full_name)'       embedded resource - belongs to that table
//   'id, profiles!inner(name)'      embed with a hint
//   '*'                             everything
// Returns { cols: [...], embeds: [{table, cols}] }
function parseSelect(sel) {
  const cols = [], embeds = [];
  let depth = 0, buf = '';
  const parts = [];
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  for (let raw of parts) {
    raw = raw.trim();
    if (!raw || raw === '*') continue;
    const embed = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:!\w+)?\s*\(([\s\S]*)\)$/);
    if (embed) {
      const inner = parseSelect(embed[2]);
      embeds.push({ table: embed[1], cols: inner.cols });
      embeds.push(...inner.embeds);
      continue;
    }
    let name = raw.includes(':') ? raw.split(':').pop().trim() : raw;   // alias:col
    name = name.split('::')[0].trim();                                  // cast
    name = name.replace(/->>?.*$/, '').trim();                          // jsonb path
    if (!name || name === '*' || /^\d/.test(name)) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) cols.push(name);
  }
  return { cols, embeds };
}

// Column-taking chain methods.
const FILTERS = ['eq','neq','gt','gte','lt','lte','like','ilike','is','in','contains',
                 'containedBy','rangeGt','rangeLt','overlaps','textSearch','match','not','filter','order'];

const findings = [];
function report(file, line, kind, msg, detail) {
  findings.push({ file: path.relative(ROOT, file), line, kind, msg, detail });
}
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function checkCols(file, src, idx, table, cols, where) {
  const known = TABLES[table];
  if (!known) return;
  for (const c of cols) {
    if (!known.includes(c)) {
      const near = known.filter(k =>
        k.replace(/l+/g, 'l') === c.replace(/l+/g, 'l') ||      // cancelled/canceled
        k.includes(c) || c.includes(k) ||
        k.replace(/_/g, '') === c.replace(/_/g, ''));
      report(file, lineOf(src, idx), 'column',
        `${table}.${c} does not exist`,
        (where ? where + '. ' : '') + (near.length ? 'Did you mean: ' + near.slice(0, 3).join(', ') + '?' : ''));
    }
  }
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const fromRe = /\.from\(\s*(['"`])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)/g;
  let m;
  while ((m = fromRe.exec(src)) !== null) {
    const table = m[2];
    if (!TABLES[table]) continue;              // not one of ours (Array.from etc.)
    const start = m.index + m[0].length;
    // Stop at the next .from(...) - that is where this query's chain ends and
    // the next one begins. Without this the window bleeds into the following
    // query and every column gets checked against the wrong table, which is
    // how the first version of this script "found" 40 bugs in correct code.
    const nextFrom = src.slice(start).search(/\.from\s*\(/);
    let cap = nextFrom === -1 ? 2000 : Math.min(nextFrom, 2000);
    // Also stop at the end of the STATEMENT. A Supabase chain is one
    // expression; without this, anything later in the function gets scanned
    // too and DOM calls like classList.contains('show') look like filters.
    let depth = 0;
    for (let k = 0; k < cap; k++) {
      const ch = src[start + k];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) { depth--; if (depth < 0) { cap = k; break; } }
      else if (ch === ';' && depth <= 0) { cap = k; break; }
    }
    const win = src.slice(start, start + cap);

    // .select('...')
    const selRe = /\.select\(\s*(['"`])([\s\S]*?)\1/g;
    let s;
    while ((s = selRe.exec(win)) !== null) {
      if (s.index > 900) break;
      const { cols, embeds } = parseSelect(s[2]);
      checkCols(file, src, start + s.index, table, cols, 'in .select()');
      for (const e of embeds) {
        if (TABLES[e.table]) checkCols(file, src, start + s.index, e.table, e.cols, `in .select() embed ${e.table}(...)`);
      }
    }

    // .eq('col', ...) and friends
    for (const fn of FILTERS) {
      const re = new RegExp('\\.' + fn + '\\(\\s*([\'"`])([A-Za-z_][A-Za-z0-9_.]*)\\1', 'g');
      let f;
      while ((f = re.exec(win)) !== null) {
        if (f.index > 1200) break;
        const col = f[2].split('.')[0].split('->')[0];
        checkCols(file, src, start + f.index, table, [col], `in .${fn}()`);
        // value constraint, e.g. .eq('status','cancelled')
        if (fn === 'eq') {
          const tail = win.slice(f.index + f[0].length, f.index + f[0].length + 120);
          const v = tail.match(/^\s*,\s*(['"`])([^'"`]+)\1/);
          const key = table + '.' + col;
          if (v && VALUES[key] && !VALUES[key].includes(v[2])) {
            report(file, lineOf(src, start + f.index), 'value',
              `${key} = '${v[2]}' is not an allowed value`,
              'Allowed: ' + VALUES[key].join(', '));
          }
        }
      }
    }

    // .insert({...}) / .update({...}) / .upsert({...})
    const wRe = /\.(insert|update|upsert)\(\s*(\[\s*)?\{/g;
    let w;
    while ((w = wRe.exec(win)) !== null) {
      if (w.index > 900) break;
      let i = win.indexOf('{', w.index), depth = 0, end = i;
      for (; end < win.length; end++) {
        if (win[end] === '{') depth++;
        else if (win[end] === '}') { depth--; if (depth === 0) break; }
      }
      const obj = win.slice(i + 1, end);
      // top-level keys only
      let d = 0, key = '', keys = [], expectKey = true;
      for (let k = 0; k < obj.length; k++) {
        const ch = obj[k];
        if ('{[('.includes(ch)) d++;
        else if ('}])'.includes(ch)) d--;
        else if (d === 0 && ch === ',') { expectKey = true; key = ''; continue; }
        else if (d === 0 && ch === ':' && expectKey) {
          const kk = key.trim().replace(/^['"`]|['"`]$/g, '');
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(kk)) keys.push(kk);
          expectKey = false; key = '';
          continue;
        }
        if (d === 0 && expectKey) key += ch;
      }
      checkCols(file, src, start + w.index, table, keys, `in .${w[1]}()`);
      // value constraints on writes
      for (const [key2, allowed] of Object.entries(VALUES)) {
        const [t, col] = key2.split('.');
        if (t !== table || !keys.includes(col)) continue;
        const vm = obj.match(new RegExp(col + "\\s*:\\s*(['\"`])([^'\"`]+)\\1"));
        if (vm && !allowed.includes(vm[2])) {
          report(file, lineOf(src, start + w.index), 'value',
            `${key2} = '${vm[2]}' is not an allowed value`, 'Allowed: ' + allowed.join(', '));
        }
      }
    }
  }
}

const files = walk(ROOT, []);
files.forEach(scanFile);

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

console.log(`schema-check: scanned ${files.length} files against ${Object.keys(TABLES).length} tables\n`);
if (STALE.length) {
  console.log(`Skipped ${STALE.length} stale root-level cop${STALE.length === 1 ? 'y' : 'ies'} of deployed files: ` +
              STALE.join(', ') + '\n  (the site loads /js/ and /api/ - these are dead and safe to delete)\n');
}
if (!findings.length) {
  console.log('No problems found.');
  process.exit(0);
}
const byFile = {};
findings.forEach(f => { (byFile[f.file] = byFile[f.file] || []).push(f); });
for (const [file, list] of Object.entries(byFile)) {
  console.log(file);
  list.sort((a, b) => a.line - b.line).forEach(f => {
    console.log(`  ${String(f.line).padStart(6)}  ${f.kind === 'value' ? 'VALUE ' : 'COLUMN'}  ${f.msg}`);
    if (f.detail && f.detail.trim()) console.log(`          ${f.detail.trim()}`);
  });
  console.log('');
}
console.log(`${findings.length} problem${findings.length === 1 ? '' : 's'} found.`);
process.exit(1);
