// build.mjs  –  builds two bundles from src/index.js
//   dist/stratum-sqlite.umd.js   IIFE global StratumSQLite  (for <script> tags)
//   dist/stratum-sqlite.esm.js   ES module with export default (for import() / bundlers)
//
// Run:  node build.mjs

import { readFileSync, writeFileSync } from 'fs';

const pkg    = JSON.parse(readFileSync('./package.json', 'utf8'));
const src    = readFileSync('./src/index.js', 'utf8');
const banner = `/* stratum-sqlite v${pkg.version} | MIT license | https://github.com/bx-dojo/stratum-sqlite */`;

// Strip export keyword from declarations (shared step)
const coreNoExportKeywords = src
  .replace(/^export\s+(async\s+function|function|class|const|let|var)\s+/mg, '$1 ');

// ESM build — add explicit named + default exports at the end
const esmCore = coreNoExportKeywords
  .replace(/^export\s*\{[^}]*\};\s*$/m, '')
  .replace(/^export\s+default\s+\w+;\s*$/m, '');

const esm = `${banner}
${esmCore}
export { open, Database };
export default StratumSQLite;
`;

// UMD/IIFE build — no export statements, sets global
const umdCore = coreNoExportKeywords
  .replace(/^export\s*\{[^}]*\};\s*$/m, '')
  .replace(/^export\s+default\s+\w+;\s*$/m, '');

const umd = `${banner}
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory()
    : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
       global.StratumSQLite = factory());
})(this, function () {
  'use strict';
${umdCore}
  return StratumSQLite;
});
`;

writeFileSync('dist/stratum-sqlite.esm.js', esm);
writeFileSync('dist/stratum-sqlite.umd.js', umd);

console.log(`✓  dist/stratum-sqlite.esm.js  ${Buffer.byteLength(esm).toLocaleString()} bytes`);
console.log(`✓  dist/stratum-sqlite.umd.js  ${Buffer.byteLength(umd).toLocaleString()} bytes`);

if (!esm.includes('export default StratumSQLite')) { console.error('ERROR: export default missing!'); process.exit(1); }
if (umd.includes('\nexport '))                      { console.error('ERROR: export in UMD!');          process.exit(1); }
console.log('✓  export checks passed');
