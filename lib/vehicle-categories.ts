// Жёсткий список рубрик — используется в мобильном приложении, CRM, заявках.
// НЕ МЕНЯТЬ названия без согласования с мобильным приложением!
export const VEHICLE_CATEGORIES = [
  'Автокран',
  'Автовышка',
  'Автобетононасос',
  'Бортовой грузовик',
  'Бульдозер',
  'Гидромолот',
  'Длинномер',
  'Каток дорожный',
  'Контейнеровоз',
  'Манипулятор (самогруз)',
  'Минипогрузчик',
  'Миниэскаватор',
  'Самосвал',
  'Трал',
  'Фронтальный погрузчик',
  'Экскаватор',
  'Экскаватор-погрузчик',
  'Ямобур',
  'Другое',
];

/**
 * Синонимы: любое ключевое слово в строке → каноническая рубрика.
 * Порядок ВАЖЕН: более специфичные ключи проверяются раньше.
 */
const CATEGORY_SYNONYMS: { keywords: string[]; category: string }[] = [
  { keywords: ['экскаватор-погрузчик', 'экскаватор погрузчик', 'экс-погрузчик', 'экскаваторпогрузчик'], category: 'Экскаватор-погрузчик' },
  { keywords: ['автобетононасос', 'бетононасос', 'бетон насос'], category: 'Автобетононасос' },
  { keywords: ['миниэскаватор', 'миниэкс', 'мини-эскаватор', 'мини эскаватор', 'мини-экскаватор', 'мини экскаватор', 'миниэкскаватор'], category: 'Миниэскаватор' },
  { keywords: ['минипогрузчик', 'мини-погрузчик', 'мини погрузчик', 'мини-погруз'], category: 'Минипогрузчик' },
  { keywords: ['фронтальн'], category: 'Фронтальный погрузчик' },
  { keywords: ['манипулятор', 'самогруз', 'кму', 'кран-манипулятор'], category: 'Манипулятор (самогруз)' },
  { keywords: ['автокран', 'автомобильный кран', 'кран'], category: 'Автокран' },
  { keywords: ['автовышка', 'вышка', 'автовышки', 'автовышк'], category: 'Автовышка' },
  { keywords: ['бортовой', 'борт'], category: 'Бортовой грузовик' },
  { keywords: ['бульдозер', 'бульдоз'], category: 'Бульдозер' },
  { keywords: ['гидромолот', 'молот'], category: 'Гидромолот' },
  { keywords: ['длинномер', 'длиннамер', 'длинномерн'], category: 'Длинномер' },
  { keywords: ['каток', 'катки'], category: 'Каток дорожный' },
  { keywords: ['контейнеровоз', 'контейнер'], category: 'Контейнеровоз' },
  { keywords: ['самосвал', 'самосвалы', 'самосвал'], category: 'Самосвал' },
  { keywords: ['трал', 'тралы', 'низкорам'], category: 'Трал' },
  { keywords: ['экскаватор', 'эскаватор', 'экскават'], category: 'Экскаватор' },
  { keywords: ['ямобур', 'ямобуры', 'ямобур'], category: 'Ямобур' },
];

/**
 * Приводит любое название рубрики к каноническому из VEHICLE_CATEGORIES.
 * Если совпадений нет — возвращает 'Другое'.
 */
export function normalizeCategory(input: string | null | undefined): string {
  if (!input) return 'Другое';
  const raw = String(input).trim();
  if (!raw) return 'Другое';

  // 1. Точное совпадение (без учёта регистра)
  const lower = raw.toLowerCase();
  const exact = VEHICLE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Поиск по ключевым словам (более длинные ключи приоритетнее)
  const entries: { keyword: string; category: string }[] = [];
  for (const { keywords, category } of CATEGORY_SYNONYMS) {
    for (const kw of keywords) entries.push({ keyword: kw, category });
  }
  entries.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { keyword, category } of entries) {
    if (lower.includes(keyword)) return category;
  }

  return 'Другое';
}

/** Возвращает true, если строка уже является канонической рубрикой. */
export function isCanonicalCategory(input: string): boolean {
  return VEHICLE_CATEGORIES.includes(input);
}
