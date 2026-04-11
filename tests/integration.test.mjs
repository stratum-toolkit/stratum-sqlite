// tests/integration.test.mjs
// Integration tests for stratum-sqlite — runs in a real browser via Playwright.
// Requires: npm install --save-dev @playwright/test  &&  npx playwright install chromium
// Run with:  node --test tests/integration.test.mjs
//        or: npx playwright test tests/integration.test.mjs
//
// The test spins up the demo site (docs/) on a local HTTP server and exercises
// the full open() → query() flow in Chromium, including Cache API caching.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

// ── MIME types for the local server ──────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.wasm': 'application/wasm',
  '.css':  'text/css',
  '.json': 'application/json',
  '.sqlite': 'application/octet-stream',
};

// ── Skip gracefully if Playwright is not installed ───────────────────────────
let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  console.warn('⚠  @playwright/test not installed — skipping integration tests.');
  console.warn('   Install with: npm install --save-dev @playwright/test');
  console.warn('   Then:         npx playwright install chromium');
  process.exit(0);
}

// ── Skip if sql.js binaries are not present (setup.sh not yet run) ───────────
if (!existsSync('docs/libs/sqljs/sql-wasm.wasm')) {
  console.warn('⚠  docs/libs/sqljs/sql-wasm.wasm not found — skipping integration tests.');
  console.warn('   Run: bash setup.sh');
  process.exit(0);
}

// ── Local HTTP server ─────────────────────────────────────────────────────────
let server, port, browser, page;

before(async () => {
  // Serve the docs/ directory
  server = createServer((req, res) => {
    const filePath = join('docs', req.url === '/' ? '/index.html' : req.url);
    if (!existsSync(filePath)) { res.writeHead(404); res.end(); return; }
    const ext  = extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(readFileSync(filePath));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;

  browser = await chromium.launch();
  page    = await browser.newPage();

  // Capture console errors from the page
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('  [browser]', msg.text());
  });
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('stratum-sqlite integration', () => {

  test('home page loads without errors', async () => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.status.ok', { timeout: 30000 });

    assert.equal(errors.length, 0, `Page errors: ${errors.join(', ')}`);
  });

  test('status shows database loaded', async () => {
    const text = await page.textContent('#status');
    assert.ok(text.includes('✓'), `Expected success status, got: ${text}`);
    assert.ok(text.includes('countries'), `Expected country count in status, got: ${text}`);
  });

  test('GDP table renders with 5 rows', async () => {
    const rows = await page.$$('#gdp-table tbody tr');
    assert.equal(rows.length, 5, `Expected 5 GDP rows, got: ${rows.length}`);
  });

  test('Nordic table renders correct countries', async () => {
    const cells = await page.$$eval(
      '#nordic-table tbody td:first-child',
      tds => tds.map(td => td.textContent)
    );
    assert.ok(cells.includes('Norway'),  'Norway missing from Nordic table');
    assert.ok(cells.includes('Sweden'),  'Sweden missing from Nordic table');
    assert.ok(cells.includes('Denmark'), 'Denmark missing from Nordic table');
  });

  test('StratumSQLite.open() returns a Database with query()', async () => {
    const result = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return {
        hasTables: typeof db.tables  === 'function',
        hasQuery:  typeof db.query   === 'function',
        hasCount:  typeof db.count   === 'function',
        hasColumns:typeof db.columns === 'function',
      };
    });
    assert.ok(result.hasTables,  'db.tables() missing');
    assert.ok(result.hasQuery,   'db.query() missing');
    assert.ok(result.hasCount,   'db.count() missing');
    assert.ok(result.hasColumns, 'db.columns() missing');
  });

  test('db.tables() returns expected tables', async () => {
    const tables = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return db.tables();
    });
    assert.ok(tables.includes('countries'),  'countries table missing');
    assert.ok(tables.includes('languages'),  'languages table missing');
    assert.ok(tables.includes('indicators'), 'indicators table missing');
  });

  test('db.query() returns correct row count', async () => {
    const count = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return db.count('countries');
    });
    assert.equal(count, 20, `Expected 20 countries, got: ${count}`);
  });

  test('db.query() with WHERE clause filters correctly', async () => {
    const rows = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return db.query("SELECT name FROM countries WHERE subregion = 'Northern Europe' ORDER BY name");
    });
    assert.ok(rows.length > 0, 'No Northern Europe countries returned');
    assert.ok(rows.some(r => r.name === 'Norway'), 'Norway not in results');
    assert.ok(rows.every(r => typeof r.name === 'string'), 'Non-string name in results');
  });

  test('db.query() with parameterised query works', async () => {
    const rows = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return db.query('SELECT name FROM countries WHERE iso3 = ?', ['NOR']);
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Norway');
  });

  test('db.columns() returns column metadata', async () => {
    const cols = await page.evaluate(async () => {
      const db = await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-countries@unit',
      });
      return db.columns('countries');
    });
    const names = cols.map(c => c.name);
    assert.ok(names.includes('name'),       'name column missing');
    assert.ok(names.includes('iso3'),       'iso3 column missing');
    assert.ok(names.includes('population'), 'population column missing');
  });

  test('Cache API serves database on second open()', async () => {
    const timing = await page.evaluate(async () => {
      // First open — fetches from server
      const t0 = performance.now();
      await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-cache-check@unit',
      });
      const firstMs = performance.now() - t0;

      // Second open with same cacheKey — served from Cache API
      const t1 = performance.now();
      await StratumSQLite.open('data/countries.sqlite', {
        sqlJsPath: 'libs/sqljs/',
        cacheKey:  'test-cache-check@unit',
      });
      const secondMs = performance.now() - t1;

      return { firstMs, secondMs };
    });
    // Cache hit should be meaningfully faster than first fetch
    assert.ok(
      timing.secondMs < timing.firstMs * 0.5,
      `Cache hit (${timing.secondMs.toFixed(0)} ms) not faster than fetch (${timing.firstMs.toFixed(0)} ms)`
    );
  });

});
