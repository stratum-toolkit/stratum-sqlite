// scripts/bump-version.js
// Usage:
//   node scripts/bump-version.js patch   → 0.1.0 → 0.1.1
//   node scripts/bump-version.js minor   → 0.1.0 → 0.2.0
//   node scripts/bump-version.js major   → 0.1.0 → 1.0.0
//   node scripts/bump-version.js 1.2.3   → sets exact version

import { readFileSync, writeFileSync } from 'fs';

const arg = process.argv[2];
if (!arg) {
    console.error('Usage: node scripts/bump-version.js <patch|minor|major|x.y.z>');
    process.exit(1);
}

// ── Read current version from package.json ────────────────────────────────
const pkgPath = 'package.json';
const pkg     = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);

// ── Calculate new version ─────────────────────────────────────────────────
let newVersion;
if (arg === 'patch') newVersion = `${maj}.${min}.${pat + 1}`;
else if (arg === 'minor') newVersion = `${maj}.${min + 1}.0`;
else if (arg === 'major') newVersion = `${maj + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(arg)) newVersion = arg;
else {
    console.error(`Unknown argument: "${arg}". Use patch, minor, major, or x.y.z`);
    process.exit(1);
}

// ── Update package.json ───────────────────────────────────────────────────
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓  package.json  ${pkg.version.padStart(6)} → ${newVersion}`);

// ── Update README.md and STRATUM.md ──────────────────────────────────────
for (const file of ['README.md', 'STRATUM.md']) {
    try {
        const content = readFileSync(file, 'utf8');
        const updated = content
            .replace(/stratum-(?:sqlite|duckdb) v\d+\.\d+\.\d+/g,
                m => m.replace(/v\d+\.\d+\.\d+/, `v${newVersion}`))
            .replace(/\*\*version:\*\* `\d+\.\d+\.\d+`/g,
                `**version:** \`${newVersion}\``);
        if (updated !== content) {
            writeFileSync(file, updated);
            console.log(`✓  ${file}`);
        }
    } catch { /* file absent — skip */ }
}

// ── Rebuild dist so banner matches ───────────────────────────────────────
import { execSync } from 'child_process';
execSync('node build.mjs', { stdio: 'inherit' });

console.log(`\nVersion bumped to ${newVersion}.`);
console.log(`Review the diff, then commit and tag however you like:`);
console.log(`  git add package.json dist/ README.md`);
console.log(`  git commit -m "release v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push && git push --tags`);