// Node.js script — cập nhật version vào manifest.json và updates.xml
// Chạy: node scripts/set-version.js 1.26.0514.1.0956

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version || !/^\d+(\.\d+){2,}$/.test(version)) {
  console.error('Usage: node scripts/set-version.js X.Y.Z[.A.B...]');
  process.exit(1);
}

// Cập nhật manifest.json
const manifestPath = resolve(__dir, '../extension/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json → ${version}`);

// Cập nhật updates.xml
const xmlPath = resolve(__dir, '../update-server/updates.xml');
let xml = readFileSync(xmlPath, 'utf8');
xml = xml.replace(/version='[^']*'/, `version='${version}'`);
writeFileSync(xmlPath, xml);
console.log(`updates.xml → ${version}`);
