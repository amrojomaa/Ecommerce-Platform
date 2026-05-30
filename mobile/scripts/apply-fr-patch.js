const fs = require('fs');
const path = require('path');

const frPath = path.join(__dirname, '../src/i18n/locales/fr.js');
const patchPath = path.join(__dirname, 'fr-translations-patch.json');

const fr = require(frPath).default || require(frPath);
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

const patchKeys = Object.keys(patch);
const missingInPatch = Object.keys(fr).filter((k) => patch[k] !== undefined && fr[k] === undefined);
if (missingInPatch.length) {
  console.warn(`Note: ${missingInPatch.length} patch keys not in current fr.js (will be added)`);
}

const merged = { ...fr, ...patch };

const lines = Object.entries(merged)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

const content = `export default {\n${lines.join(',\n')}\n};\n`;
fs.writeFileSync(frPath, content);

console.log(`Applied ${patchKeys.length} patch entries to fr.js`);
console.log(`fr.js now has ${Object.keys(merged).length} keys`);
