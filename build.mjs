// build.mjs  –  builds two bundles from src/index.js
//   dist/frozenql.umd.js   IIFE  global FrozenQL  (for <script> tags)
//   dist/frozenql.esm.js   ES module                  (for import / bundlers)
//
// Run:  node build.mjs
//       node build.mjs --watch

import esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg     = JSON.parse(readFileSync('./package.json', 'utf8'));
const watch   = process.argv.includes('--watch');
const banner  = `/* frozenql v${pkg.version} | MIT license | https://github.com/bx-dojo/frozenql */`;

const shared = {
  entryPoints: ['src/index.js'],
  bundle:      true,
  sourcemap:   true,
  banner:      { js: banner },
  // sql.js is loaded at runtime via a <script> tag, NOT bundled in.
  // We mark initSqlJs as external so esbuild leaves the global reference alone.
  external:    [],
};

async function build() {
  // ── IIFE (UMD-style) for plain <script> tags ─────────────────────────────
  await esbuild.build({
    ...shared,
    format:     'iife',
    globalName: 'FrozenQL',
    outfile:    'dist/frozenql.umd.js',
  });

  // ── ES module for import / bundlers ──────────────────────────────────────
  await esbuild.build({
    ...shared,
    format:  'esm',
    outfile: 'dist/frozenql.esm.js',
  });

  console.log(`✓  built  dist/frozenql.umd.js  +  dist/frozenql.esm.js`);
}

if (watch) {
  const ctx = await esbuild.context({ ...shared, format: 'iife', globalName: 'FrozenQL', outfile: 'dist/frozenql.umd.js' });
  await ctx.watch();
  console.log('Watching…');
} else {
  await build();
}
