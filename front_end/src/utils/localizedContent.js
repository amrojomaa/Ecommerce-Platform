import { normalizeLanguageCode } from '../i18n/constants';

const pickLocalized = (baseValue, arValue, frValue, languageCode) => {
  const normalized = normalizeLanguageCode(languageCode);
  if (normalized === 'ar' && (arValue || '').trim()) return arValue;
  if (normalized === 'fr' && (frValue || '').trim()) return frValue;
  return baseValue;
};

export const localizeCategoryName = (category, languageCode) => {
  if (!category) return '';
  if (typeof category === 'string') return category;
  return pickLocalized(category.name, category.name_ar, category.name_fr, languageCode);
};

export const localizeCategoryDescription = (category, languageCode) => {
  if (!category) return '';
  if (typeof category === 'string') return category;
  return pickLocalized(
    category.description,
    category.description_ar,
    category.description_fr,
    languageCode
  );
};

export const localizeProduct = (product, languageCode) => {
  if (!product) return product;
  return {
    ...product,
    localized_name: pickLocalized(product.name, product.name_ar, product.name_fr, languageCode),
    localized_description: pickLocalized(
      product.description,
      product.description_ar,
      product.description_fr,
      languageCode
    ),
    localized_category_name: pickLocalized(
      product.category_name,
      product.category_name_ar,
      product.category_name_fr,
      languageCode
    ),
  };
};

/** Display label for a product row when filter values store canonical `name`. */
export const resolveProductDisplayName = (products, canonicalName, languageCode) => {
  if (!canonicalName) return '';
  const product = products.find((item) => item.name === canonicalName);
  if (!product) return canonicalName;
  return localizeProduct(product, languageCode).localized_name;
};

/** Display label for a category when filter values store canonical `name`. */
export const resolveCategoryDisplayName = (categories, canonicalName, languageCode) => {
  if (!canonicalName) return '';
  const category = categories.find((item) => item?.name === canonicalName);
  if (!category) return canonicalName;
  return localizeCategoryName(category, languageCode);
};

export const productMatchesLocalizedSearch = (product, query, languageCode) => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return true;
  const localized = localizeProduct(product, languageCode);
  const fields = [
    product.name,
    product.name_ar,
    product.name_fr,
    product.category_name,
    product.category_name_ar,
    product.category_name_fr,
    localized.localized_name,
    localized.localized_category_name,
  ];
  return fields.some((value) => String(value || '').toLowerCase().includes(term));
};
