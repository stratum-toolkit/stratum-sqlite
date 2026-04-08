# stratum-sqlite

Load and query a **read-only SQLite database on any static website** — plain HTML,
Quarto, Jekyll, Hugo, and more. No server. No backend.

The database file is fetched once from any public URL (GitHub Releases, Zenodo,
your own GitHub Pages, Cloudflare R2, …) and stored in the browser's **Cache API**,
so every page on your site after the first one loads it instantly from local cache.

---

## How it works

```
Your browser                          Your static site server
    │                                         │
    │  first visit                            │
    ├─────── GET /libs/sqljs/sql-wasm.js ────►│
    ├─────── GET /libs/sqljs/sql-wasm.wasm ──►│
    ├─────── GET /data/mydb.sqlite ──────────►│
    │                                         │
    │  second visit (and all other pages)     │
    │  ◄── served from browser Cache API ─────┤  (no network request!)
    │                                         │
```

sql.js compiles SQLite to WebAssembly and runs it entirely in the browser.
`stratum-sqlite` wraps sql.js with a simple `open()` / `query()` API and adds
transparent caching.

---

## Quick start

### Option A — Self-hosted (recommended, works in restricted environments)

1. **Download sql.js** (once, add to your project):

   ```bash
   mkdir -p libs/sqljs
   curl -sSfL https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js \
        -o libs/sqljs/sql-wasm.js
   curl -sSfL https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm \
        -o libs/sqljs/sql-wasm.wasm
   ```

2. **Download stratum-sqlite.umd.js** from the [Releases page](https://github.com/bx-dojo/stratum-sqlite/releases)
   and put it alongside sql.js:

   ```
   libs/
   └── sqljs/
       ├── sql-wasm.js
       ├── sql-wasm.wasm
       └── stratum-sqlite.umd.js
   ```

3. **Use it in your HTML**:

   ```html
   <script src="libs/sqljs/sql-wasm.js"></script>
   <script src="libs/sqljs/stratum-sqlite.umd.js"></script>

   <script type="module">
     const db = await StratumSQLite.open("data/mydb.sqlite", {
       sqlJsPath: "libs/sqljs/",
       cacheKey:  "mydb@v1",       // bump version when you publish a new DB
     });

     const rows = db.query("SELECT * FROM countries WHERE region = ?", ["Europe"]);
     console.log(rows);
   </script>
   ```

### Option B — npm + bundler

```bash
npm install stratum-sqlite
```

```js
import StratumSQLite from 'stratum-sqlite';

const db = await StratumSQLite.open("/data/mydb.sqlite", {
  sqlJsPath: "/libs/sqljs/",
  cacheKey:  "mydb@v1",
});

const rows = db.query("SELECT * FROM countries");
```

---

## API

### `StratumSQLite.open(url, options)` → `Promise<Database>`

Fetches the SQLite file at `url` and returns a `Database` instance.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sqlJsPath` | `string` | cdnjs URL | Path (relative or absolute) to the folder containing `sql-wasm.js` and `sql-wasm.wasm`. |
| `cacheKey` | `string` | `"stratum-sqlite:<url>@1"` | Browser Cache API bucket name. Bump the suffix (e.g. `@v2`) to force a re-download on your next publish. |
| `onProgress` | `function(loaded, total)` | — | Called during the first download to update a loading bar. |

### `db.query(sql, params?)` → `Array<Object>`

Runs a SQL statement and returns rows as plain objects.

```js
db.query("SELECT name, capital FROM countries WHERE region = ?", ["Europe"])
// → [{ name: "Norway", capital: "Oslo" }, …]
```

### `db.tables()` → `string[]`

Returns the names of all user tables.

### `db.columns(tableName)` → `Array<Object>`

Returns column definitions from `PRAGMA table_info`.

### `db.count(tableName)` → `number`

Returns the total row count of a table.

---

## Quarto / ObservableJS integration

Add `_sqljs-init.html` to your project root:

```html
<!-- _sqljs-init.html -->
<script>
(function () {
  // Detect page depth by reading the relative path of any Quarto site_libs script.
  var siteLibScript = document.querySelector('script[src*="site_libs/"]');
  var root = siteLibScript
    ? siteLibScript.getAttribute('src').replace(/site_libs\/.*$/, '')
    : '';

  window._dbPath    = root + 'data/mydb.sqlite';
  window._sqljsBase = root + 'libs/sqljs/';

  window._sqlJsReady = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = window._sqljsBase + 'sql-wasm.js';
    s.onload = function () {
      initSqlJs({ locateFile: function () { return window._sqljsBase + 'sql-wasm.wasm'; } })
        .then(resolve).catch(reject);
    };
    s.onerror = function () { reject(new Error('sql.js load failed: ' + s.src)); };
    document.head.appendChild(s);
  });
}());
</script>
```

In `_quarto.yml`:

```yaml
format:
  html:
    include-in-header: _sqljs-init.html
```

In any `.qmd` file:

```{ojs}
db = {
  const SqlJs = await window._sqlJsReady;
  const r     = await fetch(window._dbPath);
  const raw   = new SqlJs.Database(new Uint8Array(await r.arrayBuffer()));
  return {
    query: sql => {
      const res = raw.exec(sql);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map(row =>
        Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    }
  };
}

rows = (await db).query("SELECT * FROM countries")
Inputs.table(rows)
```

---

## Hosting your database

Your SQLite file can be hosted anywhere with public HTTPS and
`Access-Control-Allow-Origin: *`:

| Host | Free | Max size | CORS |
|------|------|----------|------|
| **GitHub Pages** (same origin) | ✓ | 1 GB repo limit | same-origin |
| **GitHub Releases** | ✓ | 2 GB per file | ✓ automatic |
| **Zenodo** | ✓ | 50 GB | ✓ |
| **Figshare** | ✓ | 20 GB | ✓ |
| **Cloudflare R2** | free tier | unlimited | configure bucket policy |
| **AWS S3** | free tier | unlimited | configure bucket policy |

---

## Updating the database

1. Publish the new `.sqlite` file to your chosen host.
2. Bump the `cacheKey` option: `"mydb@v1"` → `"mydb@v2"`.
   `stratum-sqlite` automatically evicts the old cached file on next page load.

---

## Developing this library

```bash
git clone https://github.com/bx-dojo/stratum-sqlite
cd stratum-sqlite

# Build dist bundles
node build.mjs

# Watch mode
node build.mjs --watch

# Create sample database (Python)
python3 scripts/create_demo_db.py

# Create sample database (R)
Rscript scripts/create_demo_db.R

# Serve demo site locally (Python)
python3 -m http.server 8000 --directory docs
# then open http://localhost:8000
```

> **Note:** When serving locally, first run the download step from the GitHub
> Actions workflow manually to populate `docs/libs/sqljs/`:
>
> ```bash
> mkdir -p docs/libs/sqljs
> curl -sSfL https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js \
>      -o docs/libs/sqljs/sql-wasm.js
> curl -sSfL https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm \
>      -o docs/libs/sqljs/sql-wasm.wasm
> cp dist/stratum-sqlite.umd.js docs/libs/sqljs/
> ```

---

## License

MIT
