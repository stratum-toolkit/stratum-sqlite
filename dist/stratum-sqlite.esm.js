/* stratum-sqlite v0.1.4 | MIT license | https://github.com/stratum-toolkit/stratum-sqlite */
/**
 * stratum-sqlite
 * Load and query a read-only SQLite database on any static website.
 *
 * Works with plain HTML, Quarto / ObservableJS, Jekyll, Hugo, and any other
 * static site generator. The database is fetched once and cached in the
 * browser's Cache API so repeat visits (and other pages on the same site)
 * skip the network entirely.
 *
 * @license MIT
 */

// ─── Default sql.js location ────────────────────────────────────────────────
// Users can override this with the sqlJsPath option when calling open().
// The default points to cdnjs, but for offline / restricted environments you
// should download sql-wasm.js and sql-wasm.wasm and serve them yourself.
const DEFAULT_SQLJS_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Inject a <script> tag and return a promise that resolves when it loads.
 * Skips injection if a tag with the same src already exists.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error(`stratum-sqlite: failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Fetch a URL as a Uint8Array, using the browser Cache API when available.
 *
 * @param {string} url         - URL of the resource to fetch
 * @param {string} cacheKey    - Cache storage name (bump to force re-download)
 * @param {function} onProgress - Optional callback(loaded, total) for progress
 */
async function fetchWithCache(url, cacheKey, onProgress) {
  // Cache API requires a secure context (HTTPS or localhost).
  // Fall back to a plain fetch when unavailable (e.g. file://).
  if (!('caches' in window)) {
    return plainFetch(url, onProgress);
  }

  const cache = await caches.open(cacheKey);

  // Evict caches from older versions of the same key prefix.
  // Convention: keys are "stratum-sqlite:<name>@<version>"
  const prefix = cacheKey.replace(/@[^@]*$/, '@');
  const allKeys = await caches.keys();
  for (const key of allKeys) {
    if (key.startsWith(prefix) && key !== cacheKey) {
      await caches.delete(key);
    }
  }

  let cached = await cache.match(url);
  if (!cached) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`stratum-sqlite: fetch failed (${response.status}) ${url}`);
    }
    await cache.put(url, response.clone());
    cached = await cache.match(url);
  }

  return streamToUint8Array(cached, onProgress);
}

async function plainFetch(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`stratum-sqlite: fetch failed (${response.status}) ${url}`);
  }
  return streamToUint8Array(response, onProgress);
}

/**
 * Read a Response body as Uint8Array, reporting progress if the callback and
 * Content-Length header are both available.
 */
async function streamToUint8Array(response, onProgress) {
  const total = Number(response.headers.get('content-length')) || 0;

  if (!onProgress || !total || !response.body) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ─── Database wrapper ────────────────────────────────────────────────────────

class Database {
  /** @param {object} sqlJsDb - raw sql.js Database instance */
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }

  /**
   * Run a SQL query and return results as an array of plain objects.
   *
   * @param {string} sql    - SQL statement (SELECT …)
   * @param {Array}  params - Optional positional parameters (? placeholders)
   * @returns {Array<Object>}
   *
   * @example
   * db.query("SELECT name, capital FROM countries WHERE region = ?", ["Europe"])
   */
  query(sql, params) {
    const results = this._db.exec(sql, params);
    if (!results.length) return [];
    const { columns, values } = results[0];
    return values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
  }

  /**
   * Return the names of all user tables in the database.
   * @returns {string[]}
   */
  tables() {
    return this.query(
      "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map(r => r.name);
  }

  /**
   * Return column definitions for a table.
   * @param {string} tableName
   * @returns {Array<{cid, name, type, notnull, dflt_value, pk}>}
   */
  columns(tableName) {
    return this.query(`PRAGMA table_info("${tableName}")`);
  }

  /**
   * Count rows in a table.
   * @param {string} tableName
   * @returns {number}
   */
  count(tableName) {
    return this.query(`SELECT COUNT(*) as n FROM "${tableName}"`)[0]?.n ?? 0;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} OpenOptions
 * @property {string}   [sqlJsPath]   - Base path/URL for sql-wasm.js and sql-wasm.wasm.
 *                                      Defaults to cdnjs. Set to a local path like
 *                                      "/libs/sqljs/" when serving sql.js yourself.
 * @property {string}   [cacheKey]    - Browser Cache API key.
 *                                      Defaults to "stratum-sqlite:<url>@1".
 *                                      Bump the version suffix to force a re-download
 *                                      when you publish a new database release.
 * @property {function} [onProgress]  - Called with (bytesLoaded, bytesTotal) during
 *                                      the first download. Not called on cache hits.
 */

/**
 * Fetch a SQLite database from `url` and return a Database instance ready to
 * query. On first call the file is downloaded and stored in the browser's
 * Cache API. Subsequent calls (including from other pages on the same origin)
 * are served instantly from cache.
 *
 * @param {string}      url     - URL of the .sqlite file (absolute or relative)
 * @param {OpenOptions} options
 * @returns {Promise<Database>}
 *
 * @example <caption>Plain HTML</caption>
 * const db = await StratumSQLite.open("data/mydb.sqlite", {
 *   sqlJsPath: "libs/sqljs/",
 *   cacheKey:  "mydb@v1.2",
 * });
 * const rows = db.query("SELECT * FROM countries");
 *
 * @example <caption>Quarto / ObservableJS cell</caption>
 * db = StratumSQLite.open(window._dbPath, { sqlJsPath: window._sqljsBase })
 * rows = (await db).query("SELECT * FROM countries")
 */
async function open(url, options = {}) {
  const sqlJsBase = options.sqlJsPath || DEFAULT_SQLJS_CDN;
  const cacheKey  = options.cacheKey  || `stratum-sqlite:${url}@1`;
  const onProgress = options.onProgress || null;

  // Ensure trailing slash on sqlJsBase
  const base = sqlJsBase.endsWith('/') ? sqlJsBase : sqlJsBase + '/';

  // Load the sql.js bootstrap script (sets global `initSqlJs`)
  await loadScript(base + 'sql-wasm.js');

  // Initialise the WASM module
  const SQL = await initSqlJs({   // eslint-disable-line no-undef
    locateFile: () => base + 'sql-wasm.wasm',
  });

  // Fetch the database (cache hit after first load)
  const bytes = await fetchWithCache(url, cacheKey, onProgress);

  return new Database(new SQL.Database(bytes));
}

const StratumSQLite = { open, Database };



export { open, Database };
export default StratumSQLite;
