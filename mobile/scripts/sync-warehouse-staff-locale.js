const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'ar', 'fr'];

const shouldSyncKey = (key) =>
  key.startsWith('ui.pages.warehouseStaff.') ||
  key === 'ui.sidebar.panel.warehouseStaff' ||
  key === 'ui.pages.orders.status.preparing' ||
  key === 'ui.pages.orders.status.packed' ||
  key === 'ui.pages.orders.status.readyForPickup';

for (const lang of LANGS) {
  const webPath = path.join(__dirname, `../../front_end/src/locales/${lang}/common.json`);
  const mobilePath = path.join(__dirname, `../src/i18n/locales/${lang}.js`);
  const web = JSON.parse(fs.readFileSync(webPath, 'utf8'));
  const mobile = require(mobilePath).default || require(mobilePath);

  const staffKeys = Object.keys(web).filter(shouldSyncKey);
  const merged = { ...mobile };
  staffKeys.forEach((k) => {
    merged[k] = web[k];
  });

  const lines = Object.entries(merged)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

  fs.writeFileSync(mobilePath, `export default {\n${lines.join(',\n')}\n};\n`);
  console.log(`${lang}: added/updated ${staffKeys.length} warehouse_staff keys`);
}
