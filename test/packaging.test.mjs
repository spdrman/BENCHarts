import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

test('there is no dependencies key at all, not merely an empty one', () => {
  assert.ok(!('dependencies' in pkg), 'a runtime dependency is the thing this library promises not to have');
});

test('the package is licensed, so it can actually be installed and used', () => {
  assert.equal(pkg.license, 'MIT');
  assert.ok(existsSync(join(root, 'LICENSE')), 'an SPDX id with no LICENSE file is a claim, not a licence');
  const text = readFileSync(join(root, 'LICENSE'), 'utf8');
  assert.match(text, /^MIT License/);
  assert.match(text, /Copyright \(c\) \d{4} Roman Goldmann/);
  assert.ok(pkg.files.includes('LICENSE'), 'npm packs it regardless, so say so rather than rely on that');
});

test('the manifest ships an allowlist, never a denylist', () => {
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0);
  assert.ok(!existsSync(join(root, '.npmignore')),
    '.npmignore is a denylist, so it ships every new file type by default');
});

test('the allowlist excludes tests, fixtures and goldens', () => {
  for (const excluded of ['test', 'golden', 'docs', '.github']) {
    assert.ok(!pkg.files.includes(excluded), `${excluded} must not be packed`);
  }
});

test('it is ESM, side-effect free, and resolves through exports', () => {
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.exports['.'].default, './src/index.js');
  assert.equal(pkg.exports['.'].types, './types/index.d.ts');
});

test('the scale helpers are not reachable through a subpath, because D8 kept them internal', () => {
  assert.ok(!Object.keys(pkg.exports).some((k) => k.includes('primitives')));
});

/** Walk the tree the way the packer would, skipping what git never tracks. */
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

test('no tracked file carries anything shaped like a credential', () => {
  const shapes = [
    /\bghp_[A-Za-z0-9]{20,}/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bnpm_[A-Za-z0-9]{30,}/,
  ];
  for (const file of walk(root)) {
    if (/\.(png|jpg|gif|woff2?)$/.test(file)) continue;
    const body = readFileSync(file, 'utf8');
    for (const shape of shapes) {
      assert.ok(!shape.test(body), `${file} matches ${shape}`);
    }
  }
});

test('no tracked file names the internal git host', () => {
  // Assembled from parts so this file does not match its own search. A literal
  // here would make the guard fail on itself and read as a real finding.
  const pattern = new RegExp(['ops', 'ite'].join(''), 'i');
  for (const file of walk(root)) {
    const body = readFileSync(file, 'utf8');
    assert.ok(!pattern.test(body), `${file} names the internal host, which is kept out of public repos`);
  }
});
