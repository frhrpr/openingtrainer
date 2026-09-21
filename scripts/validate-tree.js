#!/usr/bin/env node
// Validates the repertoire tree embedded in index.html.
//
//   node scripts/validate-tree.js
//
// Checks that every node path is a legal game, every listed move is legal
// from its position, every child is reachable from its parent, every alias
// really is a transposition, and that tags match the side to move.
// Run this after any edit to CARO_TREE — a typo'd SAN is otherwise silent.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cache = path.join(root, 'scripts', '.chess.min.js');

if (!fs.existsSync(cache)) {
  console.error('Missing ' + path.relative(root, cache) + '. Fetch it once with:\n' +
    '  curl -sL -o scripts/.chess.min.js https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
  process.exit(2);
}
eval(fs.readFileSync(cache, 'utf8'));
const C = typeof Chess !== 'undefined' ? Chess : global.Chess;

const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const slice = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error('could not locate ' + from + ' in index.html');
  return src.slice(a, b);
};
eval(slice('const CARO_NAMES', 'const CARO_TREE').replace('const CARO_NAMES', 'global.CARO_NAMES'));
eval(slice('const CARO_TREE', 'let repertoire').replace('const CARO_TREE', 'global.CARO_TREE'));

const errs = [], warns = [];
const key = f => f.split(' ').slice(0, 3).join(' ');   // ignore en-passant + clocks

function replay(p) {
  const g = new C();
  if (p === '') return g;
  for (const san of p.split(' ')) if (!g.move(san, { sloppy: true })) return null;
  return g;
}

for (const [p, node] of Object.entries(CARO_TREE)) {
  const g = replay(p);
  if (!g) { errs.push(`illegal path: "${p}"`); continue; }

  if (node.a !== undefined) {
    const t = replay(node.a);
    if (!(node.a in CARO_TREE)) errs.push(`alias target missing: "${p}" -> "${node.a}"`);
    else if (!t) errs.push(`alias target illegal: "${node.a}"`);
    else if (key(t.fen()) !== key(g.fen())) errs.push(`alias is not a transposition: "${p}" -> "${node.a}"`);
    continue;
  }

  const seen = new Set();
  const whiteToMove = p === '' || p.split(' ').length % 2 === 0;
  for (const [san, tag] of node) {
    if (!new C(g.fen()).move(san, { sloppy: true })) errs.push(`illegal move "${san}" at "${p}"`);
    if (seen.has(san)) errs.push(`duplicate "${san}" at "${p}"`);
    seen.add(san);
    const allowed = whiteToMove ? ['main', 'side', 'rare'] : ['main', 'alt'];
    if (!allowed.includes(tag)) errs.push(`bad tag "${tag}" for ${whiteToMove ? 'White' : 'Black'} move "${san}" at "${p}"`);
  }
  if (!node.some(m => m[1] === 'main')) warns.push(`no 'main' move at "${p}"`);
}

for (const p of Object.keys(CARO_TREE)) {
  if (p === '' || p === 'e4') continue;
  const parts = p.split(' ');
  const parent = parts.slice(0, -1).join(' ');
  const last = parts[parts.length - 1];
  if (!(parent in CARO_TREE)) { warns.push(`orphan: "${p}" has no parent node "${parent}"`); continue; }
  const pn = CARO_TREE[parent];
  if (pn.a === undefined && !pn.some(m => m[0] === last)) errs.push(`unreachable: "${p}" — parent omits "${last}"`);
}

for (const k of Object.keys(CARO_NAMES)) if (!replay(k)) errs.push(`illegal name path: "${k}"`);

console.log(`tree nodes: ${Object.keys(CARO_TREE).length} | name entries: ${Object.keys(CARO_NAMES).length}`);
warns.forEach(w => console.log('  ! ' + w));
errs.forEach(e => console.log('  x ' + e));
console.log(errs.length ? `\nFAILED — ${errs.length} error(s)` : '\nOK');
process.exit(errs.length ? 1 : 0);
