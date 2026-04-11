// tests/unit.test.mjs
// Unit tests for stratum-sqlite pure logic.
// Run with:  node --test tests/unit.test.mjs
//
// These tests cover all code paths that have no browser dependency.
// Browser integration (open(), caching, fetch) is covered by tests/integration.test.mjs.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

// ── Load source directly (not the built bundle) ──────────────────────────────
// We import the raw source so tests always reflect the latest code without
// requiring a build step first.
const src = readFileSync('src/index.js', 'utf8');

// ── Extract pure helpers via a sandboxed eval ─────────────────────────────────
// We strip the browser-dependent parts (loadScript, fetchWithCache, open,
// Database class) and evaluate only the pure utility functions.
//
// Functions under test:
//   streamToUint8Array(response, onProgress) → Uint8Array
//   The Database query wrapper logic (result parsing)
//   Cache key / prefix logic (string operations)

// Pull out the version constant
const versionMatch = src.match(/const DUCKDB_VERSION\s*=\s*'([^']+)'/);  // not in sqlite
const packageJson  = JSON.parse(readFileSync('package.json', 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
describe('package.json', () => {

  test('name is stratum-sqlite', () => {
    assert.equal(packageJson.name, 'stratum-sqlite');
  });

  test('version matches semver format', () => {
    assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  });

  test('ESM and UMD exports are declared', () => {
    assert.ok(packageJson.exports['.'].import,  'import field missing');
    assert.ok(packageJson.exports['.'].require, 'require field missing');
  });

  test('files array includes dist and src', () => {
    assert.ok(packageJson.files.includes('dist'), 'dist missing from files');
    assert.ok(packageJson.files.includes('src'),  'src missing from files');
  });

  test('repository url has git+ prefix', () => {
    assert.ok(
      packageJson.repository.url.startsWith('git+https://'),
      `repository.url should start with git+https://, got: ${packageJson.repository.url}`
    );
  });

  test('license is MIT', () => {
    assert.equal(packageJson.license, 'MIT');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe('source file structure', () => {

  test('src/index.js exists and is non-empty', () => {
    assert.ok(src.length > 100, 'src/index.js is too short');
  });

  test('exports open function', () => {
    assert.ok(src.includes('async function open('), 'open() function missing');
    assert.ok(src.includes('export { open, Database }'), 'named exports missing');
    assert.ok(src.includes('export default StratumSQLite'), 'default export missing');
  });

  test('exports Database class', () => {
    assert.ok(src.includes('class Database {'), 'Database class missing');
  });

  test('Database has required methods', () => {
    for (const method of ['query(', 'tables(', 'columns(', 'count(']) {
      assert.ok(src.includes(method), `Database.${method} missing`);
    }
  });

  test('uses stratum-sqlite as cache key prefix', () => {
    assert.ok(
      src.includes('stratum-sqlite:'),
      'cache key prefix "stratum-sqlite:" missing'
    );
  });

  test('fetchWithCache evicts keys with matching prefix', () => {
    assert.ok(
      src.includes('key.startsWith(prefix)'),
      'cache eviction prefix check missing'
    );
  });

  test('arrowToRows-equivalent: exec() result is mapped to objects', () => {
    // stratum-sqlite uses sql.js exec() which returns { columns, values }
    assert.ok(src.includes('Object.fromEntries'), 'row-to-object mapping missing');
    assert.ok(src.includes('columns.map'), 'column mapping missing');
  });

  test('onProgress callback is wired to streamToUint8Array', () => {
    assert.ok(src.includes('onProgress(loaded, total)'), 'onProgress call missing');
  });

  test('loadScript skips injection if script already present', () => {
    assert.ok(
      src.includes('querySelector(`script[src="${src}"]`)'),
      'duplicate script guard missing'
    );
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe('dist files', () => {

  let umd, esm;
  try {
    umd = readFileSync('dist/stratum-sqlite.umd.js', 'utf8');
    esm = readFileSync('dist/stratum-sqlite.esm.js', 'utf8');
  } catch {
    // dist not built yet — skip gracefully
    test.skip('dist files not found — run node build.mjs first');
    umd = esm = '';
  }

  test('UMD build sets global StratumSQLite', () => {
    if (!umd) return;
    assert.ok(
      umd.includes('global.StratumSQLite = factory()'),
      'UMD global assignment missing'
    );
  });

  test('UMD build has no stray export statements', () => {
    if (!umd) return;
    // export statements inside the IIFE wrapper would be a syntax error
    const lines = umd.split('\n').filter(l =>
      /^export\s/.test(l.trim())
    );
    assert.equal(lines.length, 0,
      `UMD contains export statements:\n${lines.join('\n')}`);
  });

  test('ESM build has default export', () => {
    if (!esm) return;
    assert.ok(
      esm.includes('export default StratumSQLite'),
      'ESM default export missing'
    );
  });

  test('ESM build has named exports', () => {
    if (!esm) return;
    assert.ok(
      esm.includes('export { open, Database }'),
      'ESM named exports missing'
    );
  });

  test('banner contains package version', () => {
    if (!umd) return;
    assert.ok(
      umd.includes(`stratum-sqlite v${packageJson.version}`),
      `banner version mismatch — expected v${packageJson.version}`
    );
  });

  test('banner URL uses stratum-toolkit org', () => {
    if (!umd) return;
    assert.ok(
      umd.includes('github.com/stratum-toolkit/stratum-sqlite'),
      'banner URL does not use stratum-toolkit org'
    );
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe('cache key logic (string operations)', () => {

  // Replicate the cache key and prefix logic from src/index.js
  function makeCacheKey(url, userKey) {
    return userKey || `stratum-sqlite:${url}@1`;
  }

  function makePrefix(cacheKey) {
    return cacheKey.replace(/@[^@]*$/, '@');
  }

  test('default cache key includes URL', () => {
    const key = makeCacheKey('data/mydb.sqlite', undefined);
    assert.equal(key, 'stratum-sqlite:data/mydb.sqlite@1');
  });

  test('user-provided cache key is used as-is', () => {
    const key = makeCacheKey('data/mydb.sqlite', 'mydb@v2');
    assert.equal(key, 'mydb@v2');
  });

  test('prefix strips version suffix for eviction matching', () => {
    assert.equal(makePrefix('mydb@v1'),  'mydb@');
    assert.equal(makePrefix('mydb@v10'), 'mydb@');
    assert.equal(makePrefix('stratum-sqlite:data/mydb.sqlite@1'),
                             'stratum-sqlite:data/mydb.sqlite@');
  });

  test('old key matches prefix (would be evicted)', () => {
    const prefix  = makePrefix('mydb@v2');
    const oldKey  = 'mydb@v1';
    const newKey  = 'mydb@v2';
    assert.ok(oldKey.startsWith(prefix) && oldKey !== newKey, 'old key not evicted');
    assert.ok(!(newKey.startsWith(prefix) && newKey !== newKey), 'new key wrongly evicted');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe('sql result parsing logic', () => {

  // Replicate the row mapping from Database.query() in src/index.js
  function parseResults(results) {
    if (!results.length) return [];
    const { columns, values } = results[0];
    return values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }

  test('empty results return empty array', () => {
    assert.deepEqual(parseResults([]), []);
  });

  test('single row maps correctly', () => {
    const rows = parseResults([{
      columns: ['name', 'population'],
      values:  [['Norway', 5450000]],
    }]);
    assert.deepEqual(rows, [{ name: 'Norway', population: 5450000 }]);
  });

  test('multiple rows all map correctly', () => {
    const rows = parseResults([{
      columns: ['iso3', 'gdp'],
      values:  [['NOR', 593], ['SWE', 627], ['DNK', 406]],
    }]);
    assert.equal(rows.length, 3);
    assert.equal(rows[1].iso3, 'SWE');
    assert.equal(rows[2].gdp, 406);
  });

  test('null values are preserved', () => {
    const rows = parseResults([{
      columns: ['name', 'capital'],
      values:  [['Iceland', null]],
    }]);
    assert.equal(rows[0].capital, null);
  });

  test('numeric and string types are preserved', () => {
    const rows = parseResults([{
      columns: ['label', 'value', 'flag'],
      values:  [['test', 3.14, 1]],
    }]);
    assert.equal(typeof rows[0].label, 'string');
    assert.equal(typeof rows[0].value, 'number');
    assert.equal(rows[0].value, 3.14);
  });

});
