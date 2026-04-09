# The Stratum Toolkit

**Stratum** is a pair of JavaScript libraries for publishing read-only
databases on static websites — no server, no backend, no build pipeline
required. It is designed for researchers, data journalists, and scientists
who want to share queryable datasets alongside papers, reports, or dashboards
hosted on GitHub Pages, Zenodo, or any static file host.

```
stratum/
├── stratum-sqlite   SQLite databases  → small–medium relational data
└── stratum-duckdb   Parquet/CSV/JSON  → large analytical datasets
```

Both libraries produce the same `Array<Object>` row format and are
compatible with Observable JS, plain HTML, Quarto, Jekyll, and Hugo.

---

## When to use which library

| Question | Answer |
|----------|--------|
| My data is already a `.sqlite` file | → **stratum-sqlite** |
| My data is Parquet, CSV, or JSON | → **stratum-duckdb** |
| I need window functions, PIVOT, UNNEST | → **stratum-duckdb** |
| My file is under ~100 MB | → either works |
| My file is over 100 MB | → **stratum-duckdb** (HTTP range requests) |
| I need to join two remote files | → **stratum-duckdb** |
| I need offline-first / zero CDN | → **stratum-sqlite** (sql.js is self-contained) |
| I'm writing a Quarto / OJS page | → either works |

---

## Architecture overview

### stratum-sqlite

```
Browser
  │
  ├─ sql-wasm.js      ← self-hosted (downloaded via curl, ~1 MB)
  ├─ sql-wasm.wasm    ← self-hosted (~1 MB)
  └─ mydb.sqlite      ← self-hosted or any CORS-enabled URL
       │
       └─ loaded fully into memory once, then queried synchronously
          cached in browser Cache API after first download
```

### stratum-duckdb

```
Browser
  │
  ├─ jsDelivr CDN     ← DuckDB main JS module (loaded via dynamic import())
  │                      ~100 KB compressed, cannot be served as a script tag
  ├─ duckdb-browser-mvp.worker.js  ← self-hosted (~800 KB)
  ├─ duckdb-mvp.wasm               ← self-hosted (~5.5 MB)
  │
  └─ data files
       ├─ local:   fetch → registerFileBuffer → query  (any format)
       └─ remote:  HTTP range requests → partial fetch → query  (Parquet)
```

---

## Self-hosting files

### stratum-sqlite

```bash
# Download sql.js (once per project)
mkdir -p libs/sqljs
BASE="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3"
curl -sSfL "$BASE/sql-wasm.js"   -o libs/sqljs/sql-wasm.js
curl -sSfL "$BASE/sql-wasm.wasm" -o libs/sqljs/sql-wasm.wasm

# Add stratum-sqlite.umd.js from the Releases page
```

### stratum-duckdb

```bash
# Download DuckDB binary files (once per project)
mkdir -p libs/duckdb
BASE="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist"
curl -sSfL "$BASE/duckdb-browser-mvp.worker.js" -o libs/duckdb/duckdb-browser-mvp.worker.js
curl -sSfL "$BASE/duckdb-mvp.wasm"              -o libs/duckdb/duckdb-mvp.wasm

# Add stratum-duckdb.esm.js from the Releases page
# Note: the DuckDB main JS module is always loaded from jsDelivr at runtime
```

---

## Quick usage comparison

### stratum-sqlite (plain HTML)

```html
<script src="libs/sqljs/sql-wasm.js"></script>
<script src="libs/sqljs/stratum-sqlite.umd.js"></script>

<script type="module">
  const db = await StratumSQLite.open("data/mydb.sqlite", {
    sqlJsPath: "libs/sqljs/",
    cacheKey:  "mydb@v1",
  });
  const rows = db.query("SELECT * FROM countries WHERE region = 'Europe'");
</script>
```

### stratum-duckdb (plain HTML)

```html
<!-- No script tags needed for DuckDB — it loads via dynamic import() -->
<script type="module">
  const StratumDuckDB = (await import("libs/duckdb/stratum-duckdb.esm.js")).default;

  const db = await StratumDuckDB.open({ duckdbPath: "libs/duckdb/" });
  await db.registerFile("countries", "data/countries.parquet");

  const rows = await db.query(`
    SELECT name, region,
           RANK() OVER (ORDER BY gdp_usd_bn DESC) AS gdp_rank
    FROM countries
  `);
</script>
```

### Quarto / ObservableJS (stratum-sqlite)

Add `_sqljs-init.html` (from stratum-sqlite) to `_quarto.yml`:
```yaml
format:
  html:
    include-in-header: _sqljs-init.html
```

```{ojs}
db = {
  const SqlJs = await window._sqlJsReady;
  const r     = await fetch(window._dbPath);
  const raw   = new SqlJs.Database(new Uint8Array(await r.arrayBuffer()));
  return { query: sql => {
    const res = raw.exec(sql);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map(row => Object.fromEntries(columns.map((c,i) => [c, row[i]])));
  }};
}
rows = db.query("SELECT * FROM countries")
Inputs.table(rows)
```

### Quarto / ObservableJS (stratum-duckdb)

Add `_duckdb-init.html` (from stratum-duckdb) to `_quarto.yml`:
```yaml
format:
  html:
    include-in-header: _duckdb-init.html
```

```{ojs}
db = {
  const database = await window._stratumDuckDB;
  await database.registerFile("indicators", "indicators.csv");
  return database;
}
rows = db.query("SELECT * FROM indicators WHERE year = 2022")
Inputs.table(await rows)
```

---

## Hosting your data

Both libraries work with any public HTTPS server. GitHub Releases is the
recommended option for research data: it is free, supports files up to 2 GB,
and serves `Access-Control-Allow-Origin: *` automatically.

```
GitHub Release URL pattern:
https://github.com/ORG/REPO/releases/download/TAG/FILENAME
```

For **stratum-duckdb**, Parquet files on GitHub Releases support HTTP range
requests, so DuckDB can query them without downloading the whole file.

### Updating the database

| Library | How to signal a new version |
|---------|----------------------------|
| stratum-sqlite | Bump the `cacheKey` option: `"mydb@v1"` → `"mydb@v2"` |
| stratum-duckdb | Re-register the file; for remote files use `registerRemote()` again |

---

## Repository links

- **stratum-sqlite** — https://github.com/stratum-toolkit/stratum-sqlite
- **stratum-duckdb** — https://github.com/stratum-toolkit/stratum-duckdb
- **npm (sqlite)**   — https://www.npmjs.com/package/stratum-sqlite
- **npm (duckdb)**   — https://www.npmjs.com/package/stratum-duckdb

---

## Paper citation (placeholder)

> YOUR_NAME (2026). *Stratum: Read-Only Database Access for Static Research
> Websites*. Journal of Open Source Software. doi:10.XXXXX/joss.XXXXX

---

## License

Both libraries are released under the MIT license.
