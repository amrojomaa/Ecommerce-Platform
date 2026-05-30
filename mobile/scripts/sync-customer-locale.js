const fs = require('fs');
const path = require('path');

const LANGS = ['en', 'ar', 'fr'];

const PREFIXES = [
  'ui.pages.home.',
  'ui.pages.products.',
  'ui.pages.cart.',
  'ui.pages.checkout.',
  'ui.pages.payment.',
  'ui.pages.orders.',
  'ui.pages.wishlist.',
  'ui.pages.tickets.',
  'ui.pages.installments.',
  'ui.pages.productDetails.',
  'ui.pages.profile.',
  'ui.pages.recommendations.',
  'ui.pages.about.',
  'navbar.',
  'ui.components.starRating.',
];

const shouldSyncKey = (key) => PREFIXES.some((prefix) => key.startsWith(prefix));

for (const lang of LANGS) {
  const webPath = path.join(__dirname, `../../front_end/src/locales/${lang}/common.json`);
  const mobilePath = path.join(__dirname, `../src/i18n/locales/${lang}.js`);
  const web = JSON.parse(fs.readFileSync(webPath, 'utf8'));
  const mobile = require(mobilePath).default || require(mobilePath);

  const customerKeys = Object.keys(web).filter(shouldSyncKey);
  const merged = { ...mobile };
  customerKeys.forEach((k) => {
    merged[k] = web[k];
  });

  const mobileOnly = {
    en: {
      'ui.mobile.customer.tabs.home': 'Home',
      'ui.mobile.customer.tabs.shop': 'Shop',
      'ui.mobile.customer.tabs.cart': 'Cart',
      'ui.mobile.customer.tabs.account': 'Account',
      'ui.mobile.customer.account.title': 'My Account',
      'ui.mobile.customer.account.subtitle': 'Orders, support, profile, and settings.',
      'ui.mobile.customer.account.orders': 'My Orders',
      'ui.mobile.customer.account.wishlist': 'Wishlist',
      'ui.mobile.customer.account.tickets': 'Support Tickets',
      'ui.mobile.customer.account.installments': 'Installments',
      'ui.mobile.customer.account.recommendations': 'For You',
      'ui.mobile.customer.account.profile': 'Profile',
      'ui.mobile.customer.account.about': 'About Us',
      'ui.mobile.customer.storeKicker': 'Store',
    },
    ar: {
      'ui.mobile.customer.tabs.home': 'الرئيسية',
      'ui.mobile.customer.tabs.shop': 'المتجر',
      'ui.mobile.customer.tabs.cart': 'السلة',
      'ui.mobile.customer.tabs.account': 'حسابي',
      'ui.mobile.customer.account.title': 'حسابي',
      'ui.mobile.customer.account.subtitle': 'الطلبات والدعم والملف الشخصي والإعدادات.',
      'ui.mobile.customer.account.orders': 'طلباتي',
      'ui.mobile.customer.account.wishlist': 'المفضلة',
      'ui.mobile.customer.account.tickets': 'تذاكر الدعم',
      'ui.mobile.customer.account.installments': 'الأقساط',
      'ui.mobile.customer.account.recommendations': 'لك',
      'ui.mobile.customer.account.profile': 'الملف الشخصي',
      'ui.mobile.customer.account.about': 'من نحن',
      'ui.mobile.customer.storeKicker': 'المتجر',
    },
    fr: {
      'ui.mobile.customer.tabs.home': 'Accueil',
      'ui.mobile.customer.tabs.shop': 'Boutique',
      'ui.mobile.customer.tabs.cart': 'Panier',
      'ui.mobile.customer.tabs.account': 'Compte',
      'ui.mobile.customer.account.title': 'Mon compte',
      'ui.mobile.customer.account.subtitle': 'Commandes, support, profil et paramètres.',
      'ui.mobile.customer.account.orders': 'Mes commandes',
      'ui.mobile.customer.account.wishlist': 'Liste de souhaits',
      'ui.mobile.customer.account.tickets': 'Tickets support',
      'ui.mobile.customer.account.installments': 'Paiements échelonnés',
      'ui.mobile.customer.account.recommendations': 'Pour vous',
      'ui.mobile.customer.account.profile': 'Profil',
      'ui.mobile.customer.account.about': 'À propos',
      'ui.mobile.customer.storeKicker': 'Boutique',
    },
  };

  Object.assign(merged, mobileOnly[lang] || mobileOnly.en);

  const lines = Object.entries(merged)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);

  fs.writeFileSync(mobilePath, `export default {\n${lines.join(',\n')}\n};\n`);
  console.log(`${lang}: synced ${customerKeys.length} web keys + mobile customer keys`);
}
