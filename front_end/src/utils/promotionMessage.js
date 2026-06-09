import { localizeProduct } from './localizedContent';

const MAX_ITEMS = 3;

const summarizeLocalizedItems = (labels, tUi) => {
  const cleaned = labels.filter((label) => String(label || '').trim());
  if (!cleaned.length) {
    return '';
  }

  const shown = cleaned.slice(0, MAX_ITEMS);
  if (cleaned.length > MAX_ITEMS) {
    shown.push(
      tUi('ui.pages.products.promotionItemsMore_m3n4o5p6q7', {
        value0: cleaned.length - MAX_ITEMS,
      })
    );
  }
  return shown.join(', ');
};

const formatDiscount = (promotion, formatCurrency) => {
  if (promotion.discount_type === 'percentage') {
    return `${promotion.discount_value}%`;
  }
  return formatCurrency(promotion.discount_value);
};

const formatSpendTarget = (promotion, formatCurrency) => formatCurrency(promotion.target_value);

const localizeProductNames = (names, catalogProducts, languageCode) =>
  names.map((name) => {
    const product = catalogProducts.find((item) => item.name === name);
    return product ? localizeProduct(product, languageCode).localized_name : name;
  });

const localizeCategoryNames = (names, catalogProducts, languageCode) =>
  names.map((name) => {
    const product = catalogProducts.find((item) => item.category_name === name);
    return product ? localizeProduct(product, languageCode).localized_category_name : name;
  });

const splitPromotionMessage = (message) => {
  const colonIndex = message.indexOf(':');
  if (colonIndex > 0 && colonIndex < 48) {
    return {
      kicker: message.slice(0, colonIndex).trim(),
      body: message.slice(colonIndex + 1).trim(),
    };
  }
  return { kicker: '', body: message };
};

/**
 * Build promotion kicker + body with localized product/category names in the items list.
 */
export const buildLocalizedPromotionDisplay = (
  promotion,
  { languageCode, formatCurrency, catalogProducts, tUi }
) => {
  if (!promotion) {
    return null;
  }

  const filterType = promotion.filter_type || '';
  const filterValues = Array.isArray(promotion.filter_values) ? promotion.filter_values : [];
  const isProductFilter = filterType.includes('products');
  const isExclude = filterType.startsWith('exclude_');
  const isQuantity = promotion.target_type === 'quantity';

  const localizedLabels = isProductFilter
    ? localizeProductNames(filterValues, catalogProducts, languageCode)
    : localizeCategoryNames(filterValues, catalogProducts, languageCode);

  const items = summarizeLocalizedItems(localizedLabels, tUi);
  const discount = formatDiscount(promotion, formatCurrency);

  let messageKey;
  let params;

  if (isProductFilter && !isExclude && !isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableSelectedProducts';
    params = { target: formatSpendTarget(promotion, formatCurrency), items, discount };
  } else if (!isProductFilter && !isExclude && !isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableSelectedCategories';
    params = { target: formatSpendTarget(promotion, formatCurrency), items, discount };
  } else if (isProductFilter && !isExclude && isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableBuyProducts_r8s9t0u1v2';
    params = {
      quantity: promotion.target_value,
      items,
      discount,
    };
  } else if (!isProductFilter && !isExclude && isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableBuyCategories_w3x4y5z6a7';
    params = {
      quantity: promotion.target_value,
      items,
      discount,
    };
  } else if (isProductFilter && isExclude && !isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableExcludeProducts_b8c9d0e1f2';
    params = { target: formatSpendTarget(promotion, formatCurrency), items, discount };
  } else if (!isProductFilter && isExclude && !isQuantity) {
    messageKey = 'ui.pages.products.promotionAvailableExcludeCategories_g3h4i5j6k7';
    params = { target: formatSpendTarget(promotion, formatCurrency), items, discount };
  } else {
    return splitPromotionMessage(
      promotion.customer_message || tUi('ui.pages.products.promotionAvailableFallback')
    );
  }

  return splitPromotionMessage(tUi(messageKey, params));
};
