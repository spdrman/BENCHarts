import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('the declarations are committed, so an install gets types without a build', () => {
  assert.ok(existsSync(join(root, 'types', 'index.d.ts')));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.types, './types/index.d.ts');
  assert.ok(pkg.files.includes('types'));
});

test('ADR-002: the declarations are generated, never hand written', () => {
  const tsconfig = JSON.parse(read('tsconfig.json').replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(tsconfig.compilerOptions.checkJs, true, 'the types are checked against the code');
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.emitDeclarationOnly, true, 'no build output, only declarations');
  assert.equal(tsconfig.compilerOptions.outDir, 'types');
});

test('the declared surface matches the runtime surface exactly', async () => {
  const declared = [...read('types/index.d.ts').matchAll(/export \{([^}]+)\}/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()))
    .filter(Boolean).sort();
  const runtime = Object.keys(await import('../src/index.js')).sort();
  assert.deepEqual(declared, runtime,
    'a declaration that claims a signature the module does not have is the drift this replaces');
});

test('the record shapes are declared, since they are the contract', () => {
  const validate = read('types/validate.d.ts');
  for (const shape of ['BarRow', 'TrendPoint', 'SweepPoint']) {
    assert.ok(validate.includes(shape), `${shape} must be declared`);
  }
  assert.ok(validate.includes('group: string'));
  assert.ok(validate.includes('step: number'));
  assert.ok(validate.includes('x: number'));
});

test('the error code union is declared as a union, not as a widened string', () => {
  const error = read('types/error.d.ts');
  assert.ok(error.includes('UNKNOWN_SERIES'));
  assert.ok(error.includes('BenchartsErrorCode'));
});

test('D8 holds in the declarations too: no scale helper is re-exported', () => {
  const index = read('types/index.d.ts');
  for (const internal of ['log10Scale', 'enclosingDecades', 'decadeTicks', 'escapeXml']) {
    assert.ok(!index.includes(internal), `${internal} would be frozen by exporting it`);
  }
});
