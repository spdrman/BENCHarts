/** Regenerate the goldens. Run deliberately, and review the diff. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bencharts from '../src/index.js';
import { defineSeries } from '../src/series.js';
import { CHARTS, SERIES_DEFS } from '../test/fixtures/data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'golden', 'svg'), { recursive: true });
const series = defineSeries(SERIES_DEFS);
const lines = [];
for (const [name, fn, rows, opts] of CHARTS) {
  const svg = bencharts[fn](rows, { ...opts, series });
  writeFileSync(join(root, 'golden', 'svg', `${name}.svg`), svg);
  lines.push(`${createHash('sha256').update(svg).digest('hex')}  svg/${name}.svg`);
}
writeFileSync(join(root, 'golden', 'RENDERS.sha256'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
