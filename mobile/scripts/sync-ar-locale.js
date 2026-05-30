const fs = require('fs');
const path = require('path');

const en = require('../src/i18n/locales/en.js').default || require('../src/i18n/locales/en.js');
const ar = require('../src/i18n/locales/ar.js').default || require('../src/i18n/locales/ar.js');
const webArPath = path.join(__dirname, '../../front_end/src/locales/ar/common.json');
const webAr = JSON.parse(fs.readFileSync(webArPath, 'utf8'));

const missing = Object.keys(en).filter((k) => !ar[k]);
if (!missing.length) {
  console.log('ar.js is complete');
  process.exit(0);
}

const added = {};
missing.forEach((k) => {
  added[k] = webAr[k] || en[k];
});

console.log(`Adding ${missing.length} keys to ar.js`);
missing.forEach((k) => console.log(' -', k, '=>', added[k]));

const merged = { ...ar, ...added };
const lines = Object.entries(merged)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

const content = `export default {\n${lines.join(',\n')}\n};\n`;
fs.writeFileSync(path.join(__dirname, '../src/i18n/locales/ar.js'), content);
console.log(`ar.js now has ${Object.keys(merged).length} keys`);
