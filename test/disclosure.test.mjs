import test from 'node:test';
import assert from 'node:assert/strict';
import { scanForDisclosure } from '../src/disclosure.js';

/* A zero has two explanations, and only one of them is good. Every rule gets a
 * positive control, so a clean scan means the scanner looked rather than that
 * it was never pointed at anything. */
const LEAKS = [
  ['posix-home', '<text>/Users/rom/workspace/out.svg</text>'],
  ['posix-home', '<text>/home/runner/work</text>'],
  ['windows-path', '<text>C:\\Users\\rom\\build</text>'],
  ['hostname', '<text>built on runner.example.com</text>'],
  ['ipv4', '<text>192.168.0.10</text>'],
  ['long-hex', '<text>9f8e7d6c5b4a39281706f5e4d3c2b1a0</text>'],
  ['iso-8601', '<text>2026-09-15T07:15:11</text>'],
  ['compact-timestamp', '<text>20260915T071511Z</text>'],
];

for (const [rule, svg] of LEAKS) {
  test(`the ${rule} rule catches ${svg.slice(6, 40)}`, () => {
    const found = scanForDisclosure(svg);
    assert.ok(found.some((f) => f.rule === rule),
      `expected ${rule}, got ${found.map((f) => f.rule).join(', ') || 'nothing'}`);
  });
}

test('a clean chart scans clean', () => {
  assert.deepEqual(scanForDisclosure('<svg><text>Wall time \u00b7 lower is better</text></svg>'), []);
});

test('a six-digit colour is not a long hex run, because a gate that cries wolf gets switched off', () => {
  assert.deepEqual(scanForDisclosure('<rect fill="#34a853"/><rect fill="#2196f3"/>'), []);
});

test('the font stack is not a hostname', () => {
  assert.deepEqual(scanForDisclosure('<svg font-family="system-ui, -apple-system, sans-serif"></svg>'), []);
});

test('every match carries its rule, text and offset, so a consumer can print it', () => {
  const found = scanForDisclosure('<text>/Users/rom</text>');
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'posix-home');
  assert.equal(found[0].match, '/Users/rom');
  assert.ok(Number.isInteger(found[0].index));
});
