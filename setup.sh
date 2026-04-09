#!/usr/bin/env bash
# setup.sh — download sql.js files and prepare the demo site for local preview
#
# Run once from the project root:
#   bash setup.sh

set -euo pipefail

LIBDIR="docs/libs/sqljs"
BASE="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3"

echo "=== stratum-sqlite local setup ==="
echo ""

mkdir -p "$LIBDIR"

for FILE in sql-wasm.js sql-wasm.wasm; do
  DEST="$LIBDIR/$FILE"
  if [ -f "$DEST" ]; then
    echo "✓  $FILE already exists ($(wc -c < "$DEST" | tr -d ' ') bytes) — skipping"
  else
    echo "↓  Downloading $FILE …"
    curl -sSfL --retry 3 "$BASE/$FILE" -o "$DEST"
    echo "✓  $FILE ($(wc -c < "$DEST" | tr -d ' ') bytes)"
  fi
done

echo ""
echo "↓  Copying stratum-sqlite.umd.js …"
cp dist/stratum-sqlite.umd.js "$LIBDIR/stratum-sqlite.umd.js"
echo "✓  stratum-sqlite.umd.js"

echo ""
echo "=== Files in $LIBDIR/ ==="
ls -lh "$LIBDIR/"

echo ""
echo "=== Ready! Start the local server with: ==="
echo "    python3 -m http.server 8000 --directory docs"
echo "    open http://localhost:8000"
