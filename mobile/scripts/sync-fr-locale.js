const fs = require('fs');
const path = require('path');

const en = require('../src/i18n/locales/en.js').default || require('../src/i18n/locales/en.js');
const fr = require('../src/i18n/locales/fr.js').default || require('../src/i18n/locales/fr.js');
const webFrPath = path.join(__dirname, '../../front_end/src/locales/fr/common.json');
const webFr = JSON.parse(fs.readFileSync(webFrPath, 'utf8'));

const missing = Object.keys(en).filter((k) => !fr[k]);
const added = {};
missing.forEach((k) => {
  added[k] = webFr[k] || en[k];
});

const fromWeb = missing.filter((k) => webFr[k]).length;
console.log(`Adding ${missing.length} keys (${fromWeb} from web, ${missing.length - fromWeb} English fallback)`);

const merged = { ...fr, ...added };
const lines = Object.entries(merged)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

const content = `export default {\n${lines.join(',\n')}\n};\n`;
fs.writeFileSync(path.join(__dirname, '../src/i18n/locales/fr.js'), content);
console.log(`fr.js now has ${Object.keys(merged).length} keys`);
