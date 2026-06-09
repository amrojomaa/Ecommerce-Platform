import {
  FaBed,
  FaBath,
  FaBox,
  FaCouch,
  FaDesktop,
  FaLightbulb,
  FaArchive,
  FaTree,
  FaUtensils,
  FaWarehouse,
} from 'react-icons/fa';

const CATEGORY_ICON_RULES = [
  {
    keywords: [
      'bed', 'sleep', 'mattress', 'bedroom',
      'سرير', 'نوم', 'غرفة نوم',
    ],
    icon: FaBed,
  },
  {
    keywords: [
      'sofa', 'couch', 'living', 'lounge',
      'أريكة', 'كنبة', 'صالون',
    ],
    icon: FaCouch,
  },
  {
    keywords: [
      'bath', 'toilet', 'shower',
      'حمام', 'دش',
    ],
    icon: FaBath,
  },
  {
    keywords: [
      'kitchen', 'dining', 'table', 'chair', 'seat',
      'مطبخ', 'طعام', 'كرسي', 'طاولة',
    ],
    icon: FaUtensils,
  },
  {
    keywords: [
      'lamp', 'light', 'lighting',
      'إضاءة', 'مصباح', 'لمبة',
    ],
    icon: FaLightbulb,
  },
  {
    keywords: [
      'outdoor', 'garden', 'patio', 'terrace',
      'خارجي', 'حديقة', 'تراس',
    ],
    icon: FaTree,
  },
  {
    keywords: [
      'office', 'desk', 'work',
      'مكتب', 'عمل',
    ],
    icon: FaDesktop,
  },
  {
    keywords: [
      'storage', 'shelf', 'cabinet', 'wardrobe', 'closet',
      'تخزين', 'خزانة', 'رف',
    ],
    icon: FaArchive,
  },
  {
    keywords: ['warehouse', 'stock', 'مستودع'],
    icon: FaWarehouse,
  },
];

const FALLBACK_ICONS = [FaBox, FaArchive, FaLightbulb, FaCouch, FaBed, FaUtensils, FaTree, FaDesktop];

const buildCategoryLabel = (category, extraLabel = '') => [
  category?.name,
  category?.name_ar,
  category?.name_fr,
  category?.description,
  category?.description_ar,
  category?.description_fr,
  extraLabel,
]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

/**
 * Pick a category icon by name/description keywords; falls back to a rotating set.
 */
export const getCategoryIconComponent = (category, index = 0, extraLabel = '') => {
  const label = buildCategoryLabel(category, extraLabel);

  for (const rule of CATEGORY_ICON_RULES) {
    if (rule.keywords.some((keyword) => label.includes(keyword.toLowerCase()))) {
      return rule.icon;
    }
  }

  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
};
