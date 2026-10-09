import type { Country } from '@tma80/shared';

/** 12 countries on 3 continents: enough for the "10 countries" states to still have locked ones. */
export const countries: Country[] = [
  { id: 'it', nameRu: 'Италия', continent: 'europe', sort: 1 },
  { id: 'fr', nameRu: 'Франция', continent: 'europe', sort: 2 },
  { id: 'es', nameRu: 'Испания', continent: 'europe', sort: 3 },
  { id: 'gr', nameRu: 'Греция', continent: 'europe', sort: 4 },
  { id: 'jp', nameRu: 'Япония', continent: 'asia', sort: 5 },
  { id: 'cn', nameRu: 'Китай', continent: 'asia', sort: 6 },
  { id: 'in', nameRu: 'Индия', continent: 'asia', sort: 7 },
  { id: 'th', nameRu: 'Таиланд', continent: 'asia', sort: 8 },
  { id: 'pe', nameRu: 'Перу', continent: 'south_america', sort: 9 },
  { id: 'ar', nameRu: 'Аргентина', continent: 'south_america', sort: 10 },
  { id: 'br', nameRu: 'Бразилия', continent: 'south_america', sort: 11 },
  { id: 'co', nameRu: 'Колумбия', continent: 'south_america', sort: 12 },
];
