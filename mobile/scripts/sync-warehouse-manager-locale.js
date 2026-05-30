const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'ar', 'fr'];

const shouldSyncKey = (key) =>
  key.startsWith('ui.pages.warehouse.') ||
  key.startsWith('ui.sidebar.menu.warehouse') ||
  key === 'ui.sidebar.panel.warehouse' ||
  key === 'ui.pages.orders.status.packed';

for (const lang of LANGS) {
  const webPath = path.join(__dirname, `../../front_end/src/locales/${lang}/common.json`);
  const mobilePath = path.join(__dirname, `../src/i18n/locales/${lang}.js`);
  const web = JSON.parse(fs.readFileSync(webPath, 'utf8'));
  const mobile = require(mobilePath).default || require(mobilePath);

  const warehouseKeys = Object.keys(web).filter(shouldSyncKey);
  const merged = { ...mobile };
  warehouseKeys.forEach((k) => {
    merged[k] = web[k];
  });

  const lines = Object.entries(merged)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

  fs.writeFileSync(mobilePath, `export default {\n${lines.join(',\n')}\n};\n`);
  console.log(`${lang}: added/updated ${warehouseKeys.length} warehouse keys`);
}
