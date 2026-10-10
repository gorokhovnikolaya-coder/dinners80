import type { Aisle, IngredientUnit } from '@tma80/shared';

/** An ingredient of a mock recipe as the content stores it (`dish_ingredients`, base servings). */
export interface RecipeIngredient {
  key: string;
  product: string;
  name: string;
  /** For the dish's `baseServings`; `null` — «по вкусу». */
  amount: number | null;
  unit: IngredientUnit | null;
  aisle: Aisle;
}

/** A step of a mock recipe (`dish_steps`): text with `{key}` placeholders, optional timer. */
export interface RecipeStep {
  text: string;
  timerSeconds: number | null;
}

export interface Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

const ing = (
  key: string,
  name: string,
  amount: number,
  unit: IngredientUnit,
  aisle: Aisle,
  product: string = key,
): RecipeIngredient => ({ key, product, name, amount, unit, aisle });

/** An ingredient «по вкусу» (to taste): no amount, no unit. */
const toTaste = (
  key: string,
  name: string,
  aisle: Aisle,
  product: string = key,
): RecipeIngredient => ({ key, product, name, amount: null, unit: null, aisle });

const step = (text: string, timerMinutes?: number): RecipeStep => ({
  text,
  timerSeconds: timerMinutes === undefined ? null : timerMinutes * 60,
});

const salt = toTaste('salt', 'Соль', 'grocery');
const pepper = toTaste('pepper', 'Чёрный перец', 'grocery', 'black_pepper');

/**
 * Recipes of the 36 mock dishes, for 2 servings (`baseServings` of every mock dish). The first
 * ingredients are the main ones named on the main screen; pork is always named explicitly
 * («свиной фарш», «бекон из свинины»), so the own word «свин» excludes every pork dish. A
 * product has the same aisle in every dish (the seed checks it, task 14).
 */
export const recipes: Readonly<Record<string, Recipe>> = {
  'it-carbonara': {
    ingredients: [
      ing('spaghetti', 'Спагетти', 200, 'g', 'grocery'),
      ing('guanciale', 'Гуанчале (свиные щёчки)', 100, 'g', 'meat'),
      ing('yolks', 'Яичные желтки', 3, 'pcs', 'dairy', 'egg'),
      ing('parmesan', 'Пармезан', 50, 'g', 'dairy'),
      salt,
      pepper,
    ],
    steps: [
      step('Отварите {spaghetti} спагетти в подсоленной воде до состояния аль денте.', 9),
      step('Нарежьте {guanciale} гуанчале брусочками и обжарьте до хруста.', 5),
      step('Взбейте {yolks} желтков с {parmesan} тёртого пармезана и перцем.'),
      step('Смешайте пасту с гуанчале, снимите с огня и быстро вмешайте яичную смесь.'),
    ],
  },
  'it-lasagna': {
    ingredients: [
      ing('sheets', 'Листы лазаньи', 250, 'g', 'grocery', 'lasagna_sheets'),
      ing('beef_mince', 'Говяжий фарш', 400, 'g', 'meat'),
      ing('tomatoes', 'Томаты', 400, 'g', 'veg', 'tomato'),
      ing('bechamel', 'Соус бешамель', 400, 'ml', 'dairy'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      salt,
    ],
    steps: [
      step('Обжарьте {onion} лука и {beef_mince} говяжьего фарша до румяности.', 10),
      step('Добавьте {tomatoes} томатов и томите рагу под крышкой.', 40),
      step('Соберите слоями {sheets} листов лазаньи, рагу и {bechamel} соуса бешамель.'),
      step('Запекайте при 180 °C до золотистой корочки.', 40),
    ],
  },
  'it-ossobuco': {
    ingredients: [
      ing('veal_shank', 'Телячья голяшка', 800, 'g', 'meat'),
      ing('carrot', 'Морковь', 1, 'pcs', 'veg'),
      ing('celery', 'Сельдерей', 2, 'pcs', 'veg'),
      ing('lemon_zest', 'Лимонная цедра', 1, 'tsp', 'veg'),
      ing('flour', 'Мука', 2, 'tbsp', 'grocery'),
      salt,
    ],
    steps: [
      step('Обваляйте {veal_shank} телячьей голяшки в {flour} муки и обжарьте со всех сторон.', 10),
      step('Добавьте нарезанные {carrot} моркови и {celery} сельдерея, влейте стакан воды.'),
      step('Тушите под крышкой на слабом огне.', 120),
      step('Перед подачей посыпьте {lemon_zest} лимонной цедры.'),
    ],
  },

  'fr-omelette': {
    ingredients: [
      ing('eggs', 'Яйца', 4, 'pcs', 'dairy', 'egg'),
      ing('butter', 'Сливочное масло', 20, 'g', 'dairy'),
      ing('gruyere', 'Сыр грюйер', 40, 'g', 'dairy'),
      ing('chives', 'Шнитт-лук', 10, 'g', 'veg'),
      salt,
    ],
    steps: [
      step('Взбейте {eggs} яиц с солью до однородности.'),
      step(
        'Растопите {butter} сливочного масла на сковороде и вылейте яйца, постоянно помешивая.',
        3,
      ),
      step('Посыпьте {gruyere} грюйера и {chives} шнитт-лука, сверните омлет рулетом.'),
    ],
  },
  'fr-ratatouille': {
    ingredients: [
      ing('zucchini', 'Кабачки', 2, 'pcs', 'veg'),
      ing('eggplant', 'Баклажаны', 1, 'pcs', 'veg'),
      ing('tomatoes', 'Томаты', 4, 'pcs', 'veg', 'tomato'),
      ing('herbs', 'Прованские травы', 1, 'tsp', 'grocery', 'provence_herbs'),
      ing('olive_oil', 'Оливковое масло', 3, 'tbsp', 'grocery'),
      ing('garlic', 'Чеснок', 2, 'clove', 'veg'),
      salt,
    ],
    steps: [
      step(
        'Нарежьте {zucchini} кабачков, {eggplant} баклажанов и {tomatoes} томатов тонкими кружками.',
      ),
      step('Выложите овощи в форму внахлёст, добавьте {garlic} чеснока.'),
      step('Сбрызните {olive_oil} оливкового масла, посыпьте {herbs} прованских трав и солью.'),
      step('Запекайте при 180 °C под фольгой.', 60),
    ],
  },
  'fr-bourguignon': {
    ingredients: [
      ing('beef', 'Говядина', 800, 'g', 'meat'),
      ing('bacon', 'Бекон из свинины', 100, 'g', 'meat'),
      ing('red_wine', 'Красное вино', 500, 'ml', 'grocery'),
      ing('mushrooms', 'Шампиньоны', 200, 'g', 'veg'),
      ing('carrot', 'Морковь', 2, 'pcs', 'veg'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      salt,
    ],
    steps: [
      step('Обжарьте {bacon} бекона, затем {beef} крупно нарезанной говядины.', 10),
      step('Добавьте {onion} лука и {carrot} моркови, влейте {red_wine} красного вина.'),
      step('Тушите под крышкой на слабом огне.', 150),
      step('Обжарьте {mushrooms} шампиньонов и добавьте в рагу за 10 минут до конца.'),
    ],
  },

  'es-gazpacho': {
    ingredients: [
      ing('tomatoes', 'Томаты', 600, 'g', 'veg', 'tomato'),
      ing('cucumber', 'Огурец', 1, 'pcs', 'veg'),
      ing('bell_pepper', 'Сладкий перец', 1, 'pcs', 'veg'),
      ing('bread', 'Белый хлеб', 50, 'g', 'grocery', 'white_bread'),
      ing('olive_oil', 'Оливковое масло', 3, 'tbsp', 'grocery'),
      ing('garlic', 'Чеснок', 1, 'clove', 'veg'),
      salt,
    ],
    steps: [
      step('Замочите {bread} белого хлеба в воде на пару минут.'),
      step(
        'Нарежьте {tomatoes} томатов, {cucumber} огурца, {bell_pepper} сладкого перца и {garlic} чеснока.',
      ),
      step('Взбейте всё блендером с {olive_oil} оливкового масла и солью.'),
      step('Охладите суп в холодильнике.', 15),
    ],
  },
  'es-tortilla': {
    ingredients: [
      ing('eggs', 'Яйца', 4, 'pcs', 'dairy', 'egg'),
      ing('potatoes', 'Картофель', 3, 'pcs', 'veg', 'potato'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      ing('olive_oil', 'Оливковое масло', 4, 'tbsp', 'grocery'),
      salt,
    ],
    steps: [
      step('Нарежьте {potatoes} картофеля и {onion} лука тонкими ломтиками.'),
      step('Томите их в {olive_oil} оливкового масла до мягкости.', 15),
      step('Смешайте с {eggs} взбитых яиц и посолите.'),
      step('Жарьте на сковороде, переверните с помощью тарелки.', 8),
    ],
  },
  'es-paella': {
    ingredients: [
      ing('rice', 'Рис', 200, 'g', 'grocery'),
      ing('chicken', 'Курица', 400, 'g', 'meat'),
      ing('green_beans', 'Стручковая фасоль', 150, 'g', 'veg'),
      ing('saffron', 'Шафран', 1, 'pinch', 'grocery'),
      ing('olive_oil', 'Оливковое масло', 3, 'tbsp', 'grocery'),
      salt,
    ],
    steps: [
      step('Обжарьте {chicken} курицы в {olive_oil} оливкового масла в широкой сковороде.', 10),
      step(
        'Добавьте {green_beans} стручковой фасоли, затем {rice} риса и залейте водой с {saffron} шафрана.',
      ),
      step('Готовьте не помешивая, пока рис не впитает воду.', 20),
      step('Накройте полотенцем и дайте постоять.', 5),
    ],
  },

  'gr-horiatiki': {
    ingredients: [
      ing('tomatoes', 'Томаты', 3, 'pcs', 'veg', 'tomato'),
      ing('cucumbers', 'Огурцы', 1, 'pcs', 'veg', 'cucumber'),
      ing('olives', 'Маслины', 50, 'g', 'grocery'),
      ing('feta', 'Фета', 150, 'g', 'dairy'),
      ing('pita', 'Пита', 2, 'pcs', 'grocery'),
      ing('olive_oil', 'Оливковое масло', 2, 'tbsp', 'grocery'),
    ],
    steps: [
      step('Крупно нарежьте {tomatoes} томатов и {cucumbers} огурцов.'),
      step('Добавьте {olives} маслин и положите сверху {feta} феты одним куском.'),
      step('Полейте {olive_oil} оливкового масла и подайте с {pita} питы.'),
    ],
  },
  'gr-moussaka': {
    ingredients: [
      ing('eggplant', 'Баклажаны', 2, 'pcs', 'veg'),
      ing('beef_mince', 'Говяжий фарш', 400, 'g', 'meat'),
      ing('tomatoes', 'Томаты', 300, 'g', 'veg', 'tomato'),
      ing('bechamel', 'Соус бешамель', 300, 'ml', 'dairy'),
      ing('cinnamon', 'Корица', 1, 'pinch', 'grocery'),
      salt,
    ],
    steps: [
      step('Нарежьте {eggplant} баклажанов пластинами и обжарьте.', 10),
      step('Потушите {beef_mince} говяжьего фарша с {tomatoes} томатов и {cinnamon} корицы.', 20),
      step('Выложите слоями баклажаны и фарш, залейте {bechamel} соуса бешамель.'),
      step('Запекайте при 180 °C.', 45),
    ],
  },
  'gr-spanakopita': {
    ingredients: [
      ing('filo', 'Тесто фило', 250, 'g', 'grocery'),
      ing('spinach', 'Шпинат', 400, 'g', 'veg'),
      ing('feta', 'Фета', 200, 'g', 'dairy'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('butter', 'Сливочное масло', 50, 'g', 'dairy'),
    ],
    steps: [
      step('Припустите {spinach} шпината и отожмите лишнюю воду.', 5),
      step('Смешайте шпинат с {feta} раскрошенной феты и {eggs} яиц.'),
      step(
        'Выложите в форму {filo} теста фило слоями, смазывая каждый {butter} растопленного сливочного масла.',
      ),
      step('Положите начинку, накройте листами и запекайте при 180 °C.', 45),
    ],
  },

  'jp-oyakodon': {
    ingredients: [
      ing('rice', 'Рис', 150, 'g', 'grocery'),
      ing('chicken_thigh', 'Куриное бедро', 300, 'g', 'meat'),
      ing('eggs', 'Яйца', 3, 'pcs', 'dairy', 'egg'),
      ing('soy_sauce', 'Соевый соус', 3, 'tbsp', 'grocery'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
    ],
    steps: [
      step('Отварите {rice} риса.', 15),
      step(
        'Потушите {chicken_thigh} куриного бедра с {onion} лука в {soy_sauce} соевого соуса с водой.',
        7,
      ),
      step('Влейте {eggs} слегка взбитых яиц и держите под крышкой минуту.', 1),
      step('Выложите курицу с яйцом на рис.'),
    ],
  },
  'jp-ramen': {
    ingredients: [
      ing('noodles', 'Пшеничная лапша', 200, 'g', 'grocery', 'wheat_noodles'),
      ing('chicken', 'Курица', 500, 'g', 'meat'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('soy_sauce', 'Соевый соус', 4, 'tbsp', 'grocery'),
      ing('ginger', 'Имбирь', 20, 'g', 'veg'),
      ing('green_onion', 'Зелёный лук', 20, 'g', 'veg'),
    ],
    steps: [
      step('Сварите бульон из {chicken} курицы с {ginger} имбиря.', 90),
      step('Сварите {eggs} яиц всмятку и замаринуйте в {soy_sauce} соевого соуса.', 7),
      step('Отварите {noodles} пшеничной лапши.', 4),
      step(
        'Разложите лапшу по мискам, залейте бульоном, добавьте яйцо и {green_onion} зелёного лука.',
      ),
    ],
  },
  'jp-gyoza': {
    ingredients: [
      ing('pork_mince', 'Свиной фарш', 300, 'g', 'meat'),
      ing('napa_cabbage', 'Пекинская капуста', 200, 'g', 'veg'),
      ing('wrappers', 'Тесто для гёдза', 24, 'pcs', 'grocery', 'gyoza_wrappers'),
      ing('soy_sauce', 'Соевый соус', 3, 'tbsp', 'grocery'),
      ing('garlic', 'Чеснок', 2, 'clove', 'veg'),
      ing('ginger', 'Имбирь', 10, 'g', 'veg'),
    ],
    steps: [
      step(
        'Мелко нарубите {napa_cabbage} пекинской капусты, отожмите и смешайте с {pork_mince} свиного фарша.',
      ),
      step('Добавьте {garlic} натёртого чеснока, {ginger} имбиря и {soy_sauce} соевого соуса.'),
      step('Разложите начинку по {wrappers} теста для гёдза и защипните края.'),
      step('Обжарьте, влейте немного воды и готовьте под крышкой.', 8),
    ],
  },

  'cn-kung-pao': {
    ingredients: [
      ing('chicken_fillet', 'Куриное филе', 400, 'g', 'meat'),
      ing('peanuts', 'Арахис', 50, 'g', 'grocery'),
      ing('sichuan_pepper', 'Сычуаньский перец', 1, 'tsp', 'grocery'),
      ing('soy_sauce', 'Соевый соус', 3, 'tbsp', 'grocery'),
      ing('chili', 'Чили', 2, 'pcs', 'veg'),
      ing('garlic', 'Чеснок', 2, 'clove', 'veg'),
    ],
    steps: [
      step(
        'Нарежьте {chicken_fillet} куриного филе кубиками и замаринуйте в {soy_sauce} соевого соуса.',
      ),
      step(
        'Обжарьте {chili} чили, {sichuan_pepper} сычуаньского перца и {garlic} чеснока на сильном огне.',
        1,
      ),
      step('Добавьте курицу и жарьте, помешивая.', 5),
      step('Всыпьте {peanuts} арахиса и сразу снимите с огня.'),
    ],
  },
  'cn-sweet-sour-pork': {
    ingredients: [
      ing('pork_loin', 'Свиная вырезка', 400, 'g', 'meat'),
      ing('pineapple', 'Ананас', 200, 'g', 'veg'),
      ing('bell_pepper', 'Сладкий перец', 1, 'pcs', 'veg'),
      ing('flour', 'Мука', 3, 'tbsp', 'grocery'),
      ing('ketchup', 'Кетчуп', 3, 'tbsp', 'grocery'),
      ing('vinegar', 'Рисовый уксус', 2, 'tbsp', 'grocery', 'rice_vinegar'),
    ],
    steps: [
      step(
        'Нарежьте {pork_loin} свиной вырезки, обваляйте в {flour} муки и обжарьте до корочки.',
        8,
      ),
      step('Обжарьте {bell_pepper} сладкого перца и {pineapple} ананаса.', 3),
      step(
        'Смешайте {ketchup} кетчупа с {vinegar} рисового уксуса и ложкой сахара, влейте в сковороду.',
      ),
      step('Верните мясо и прогрейте в соусе.', 2),
    ],
  },
  'cn-jiaozi': {
    ingredients: [
      ing('pork_mince', 'Свиной фарш', 400, 'g', 'meat'),
      ing('chinese_cabbage', 'Китайская капуста', 200, 'g', 'veg', 'napa_cabbage'),
      ing('flour', 'Мука', 300, 'g', 'grocery', 'flour'),
      ing('ginger', 'Имбирь', 15, 'g', 'veg'),
      ing('soy_sauce', 'Соевый соус', 2, 'tbsp', 'grocery'),
    ],
    steps: [
      step('Замесите тесто из {flour} муки и холодной воды, дайте отдохнуть.', 30),
      step(
        'Смешайте {pork_mince} свиного фарша с {chinese_cabbage} рубленой китайской капусты, {ginger} имбиря и {soy_sauce} соевого соуса.',
      ),
      step('Раскатайте кружки, разложите начинку и слепите пельмени.'),
      step('Варите в кипящей воде после всплытия.', 4),
    ],
  },

  'in-dal': {
    ingredients: [
      ing('lentils', 'Красная чечевица', 200, 'g', 'grocery', 'red_lentils'),
      ing('tomatoes', 'Томаты', 2, 'pcs', 'veg', 'tomato'),
      ing('turmeric', 'Куркума', 1, 'tsp', 'grocery'),
      ing('chili', 'Чили', 1, 'pcs', 'veg'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      ing('garlic', 'Чеснок', 2, 'clove', 'veg'),
      salt,
    ],
    steps: [
      step('Промойте {lentils} красной чечевицы и варите с {turmeric} куркумы.', 15),
      step('Обжарьте {onion} лука, {garlic} чеснока и {chili} чили.', 5),
      step('Добавьте {tomatoes} нарезанных томатов и прогрейте.', 3),
      step('Смешайте зажарку с чечевицей и посолите.'),
    ],
  },
  'in-tikka-masala': {
    ingredients: [
      ing('chicken_fillet', 'Куриное филе', 500, 'g', 'meat'),
      ing('yogurt', 'Йогурт', 150, 'g', 'dairy'),
      ing('tomatoes', 'Томаты', 400, 'g', 'veg', 'tomato'),
      ing('cream', 'Сливки', 100, 'ml', 'dairy'),
      ing('garam_masala', 'Гарам масала', 2, 'tsp', 'grocery'),
      ing('garlic', 'Чеснок', 3, 'clove', 'veg'),
    ],
    steps: [
      step(
        'Замаринуйте {chicken_fillet} куриного филе в {yogurt} йогурта с половиной {garam_masala} гарам масалы.',
        30,
      ),
      step('Обжарьте курицу до корочки.', 8),
      step('Потушите {tomatoes} томатов с {garlic} чеснока и остальными специями.', 10),
      step('Влейте {cream} сливок, верните курицу и прогрейте.', 5),
    ],
  },
  'in-biryani': {
    ingredients: [
      ing('basmati', 'Рис басмати', 250, 'g', 'grocery'),
      ing('chicken', 'Курица', 600, 'g', 'meat'),
      ing('saffron', 'Шафран', 1, 'pinch', 'grocery'),
      ing('onion', 'Репчатый лук', 2, 'pcs', 'veg'),
      ing('yogurt', 'Йогурт', 150, 'g', 'dairy'),
      ing('garam_masala', 'Гарам масала', 2, 'tsp', 'grocery'),
    ],
    steps: [
      step('Замаринуйте {chicken} курицы в {yogurt} йогурта с {garam_masala} гарам масалы.', 60),
      step('Обжарьте {onion} лука до тёмно-золотистого цвета.', 15),
      step('Отварите {basmati} риса басмати до полуготовности.', 6),
      step('Выложите слоями курицу, лук и рис, полейте водой с {saffron} шафрана и томите.', 40),
    ],
  },

  'th-pad-kra-pao': {
    ingredients: [
      ing('chicken_mince', 'Куриный фарш', 300, 'g', 'meat'),
      ing('thai_basil', 'Тайский базилик', 20, 'g', 'veg'),
      ing('chili', 'Чили', 2, 'pcs', 'veg'),
      ing('soy_sauce', 'Соевый соус', 2, 'tbsp', 'grocery'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('garlic', 'Чеснок', 3, 'clove', 'veg'),
    ],
    steps: [
      step('Обжарьте {garlic} чеснока и {chili} чили на сильном огне.', 1),
      step(
        'Добавьте {chicken_mince} куриного фарша и {soy_sauce} соевого соуса, жарьте, помешивая.',
        5,
      ),
      step('Снимите с огня и вмешайте {thai_basil} тайского базилика.'),
      step('Пожарьте глазунью из {eggs} яиц и подайте сверху.', 3),
    ],
  },
  'th-green-curry': {
    ingredients: [
      ing('chicken_fillet', 'Куриное филе', 400, 'g', 'meat'),
      ing('coconut_milk', 'Кокосовое молоко', 400, 'ml', 'grocery'),
      ing('curry_paste', 'Зелёная паста карри', 2, 'tbsp', 'grocery', 'green_curry_paste'),
      ing('eggplant', 'Баклажаны', 1, 'pcs', 'veg'),
      ing('thai_basil', 'Тайский базилик', 15, 'g', 'veg'),
    ],
    steps: [
      step(
        'Обжарьте {curry_paste} зелёной пасты карри в части из {coconut_milk} кокосового молока.',
        2,
      ),
      step('Добавьте {chicken_fillet} нарезанного куриного филе и {eggplant} баклажанов.'),
      step('Влейте остальное молоко и тушите.', 15),
      step('Перед подачей добавьте {thai_basil} тайского базилика.'),
    ],
  },
  'th-massaman': {
    ingredients: [
      ing('beef', 'Говядина', 600, 'g', 'meat'),
      ing('potatoes', 'Картофель', 3, 'pcs', 'veg', 'potato'),
      ing('peanuts', 'Арахис', 50, 'g', 'grocery'),
      ing('massaman_paste', 'Паста массаман', 3, 'tbsp', 'grocery'),
      ing('coconut_milk', 'Кокосовое молоко', 400, 'ml', 'grocery'),
    ],
    steps: [
      step(
        'Обжарьте {massaman_paste} пасты массаман в части из {coconut_milk} кокосового молока.',
        2,
      ),
      step('Добавьте {beef} нарезанной говядины и остальное молоко, тушите.', 90),
      step('Положите {potatoes} картофеля и готовьте до мягкости.', 25),
      step('Посыпьте {peanuts} арахиса перед подачей.'),
    ],
  },

  'pe-lomo-saltado': {
    ingredients: [
      ing('beef_tenderloin', 'Говяжья вырезка', 400, 'g', 'meat'),
      ing('red_onion', 'Красный лук', 1, 'pcs', 'veg'),
      ing('tomatoes', 'Томаты', 2, 'pcs', 'veg', 'tomato'),
      ing('potatoes', 'Картофель', 3, 'pcs', 'veg', 'potato'),
      ing('soy_sauce', 'Соевый соус', 3, 'tbsp', 'grocery'),
      ing('rice', 'Рис', 150, 'g', 'grocery'),
      salt,
    ],
    steps: [
      step('Нарежьте {potatoes} картофеля брусками и обжарьте до золотистого цвета.', 12),
      step('Отварите {rice} риса.', 15),
      step('Обжарьте {beef_tenderloin} говяжьей вырезки полосками на очень сильном огне.', 3),
      step(
        'Добавьте {red_onion} красного лука, {tomatoes} томатов и {soy_sauce} соевого соуса, через минуту — картофель.',
        1,
      ),
    ],
  },
  'pe-aji-de-gallina': {
    ingredients: [
      ing('chicken', 'Курица', 500, 'g', 'meat'),
      ing('aji_amarillo', 'Перец ахи амарильо', 2, 'tbsp', 'grocery', 'aji_amarillo_paste'),
      ing('cream', 'Сливки', 150, 'ml', 'dairy'),
      ing('bread', 'Белый хлеб', 80, 'g', 'grocery', 'white_bread'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      ing('parmesan', 'Пармезан', 30, 'g', 'dairy'),
    ],
    steps: [
      step('Отварите {chicken} курицы и разберите на волокна.', 30),
      step('Обжарьте {onion} лука с {aji_amarillo} пасты ахи амарильо.', 5),
      step('Добавьте {bread} белого хлеба, размоченного в {cream} сливок, и взбейте соус.'),
      step('Смешайте курицу с соусом и посыпьте {parmesan} пармезана.', 5),
    ],
  },
  'pe-ceviche': {
    ingredients: [
      ing('white_fish', 'Филе белой рыбы', 400, 'g', 'meat'),
      ing('lime', 'Лайм', 4, 'pcs', 'veg'),
      ing('red_onion', 'Красный лук', 1, 'pcs', 'veg'),
      ing('chili', 'Чили', 1, 'pcs', 'veg'),
      ing('cilantro', 'Кинза', 15, 'g', 'veg'),
      salt,
    ],
    steps: [
      step('Нарежьте {white_fish} филе белой рыбы кубиками по 2 см и посолите.'),
      step('Выжмите сок из {lime} лайма и залейте рыбу.'),
      step(
        'Добавьте {red_onion} тонко нарезанного красного лука и {chili} чили, оставьте мариноваться.',
        10,
      ),
      step('Посыпьте {cilantro} кинзы и сразу подавайте.'),
    ],
  },

  'ar-choripan': {
    ingredients: [
      ing('chorizo', 'Чоризо (свиная колбаска)', 4, 'pcs', 'meat'),
      ing('baguette', 'Багет', 1, 'pcs', 'grocery'),
      ing('parsley', 'Петрушка', 20, 'g', 'veg'),
      ing('garlic', 'Чеснок', 2, 'clove', 'veg'),
      ing('olive_oil', 'Оливковое масло', 3, 'tbsp', 'grocery'),
    ],
    steps: [
      step('Обжарьте {chorizo} чоризо на гриле или сковороде.', 10),
      step(
        'Смешайте {parsley} рубленой петрушки, {garlic} чеснока и {olive_oil} оливкового масла — это чимичурри.',
      ),
      step('Разрежьте {baguette} багета, положите колбаски и полейте соусом.'),
    ],
  },
  'ar-empanadas': {
    ingredients: [
      ing('dough', 'Тесто для эмпанадас', 10, 'pcs', 'grocery', 'empanada_dough'),
      ing('beef_mince', 'Говяжий фарш', 400, 'g', 'meat'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('olives', 'Оливки', 50, 'g', 'grocery'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
    ],
    steps: [
      step('Обжарьте {onion} лука с {beef_mince} говяжьего фарша.', 10),
      step('Сварите вкрутую {eggs} яиц, нарежьте их и {olives} оливок.', 10),
      step('Разложите начинку по {dough} кругов теста и защипните края.'),
      step('Запекайте при 200 °C до золотистого цвета.', 20),
    ],
  },
  'ar-asado': {
    ingredients: [
      ing('beef_ribs', 'Говяжьи рёбра', 1200, 'g', 'meat'),
      ing('parsley', 'Петрушка', 30, 'g', 'veg'),
      ing('garlic', 'Чеснок', 3, 'clove', 'veg'),
      ing('vinegar', 'Винный уксус', 2, 'tbsp', 'grocery', 'wine_vinegar'),
      salt,
    ],
    steps: [
      step('Посолите {beef_ribs} говяжьих рёбер крупной солью.'),
      step('Жарьте на углях на слабом жаре, переворачивая один раз.', 150),
      step(
        'Смешайте {parsley} петрушки, {garlic} чеснока и {vinegar} винного уксуса для чимичурри.',
      ),
      step('Дайте мясу отдохнуть и подайте с соусом.', 10),
    ],
  },

  'br-moqueca': {
    ingredients: [
      ing('white_fish', 'Филе белой рыбы', 500, 'g', 'meat'),
      ing('coconut_milk', 'Кокосовое молоко', 400, 'ml', 'grocery'),
      ing('bell_pepper', 'Сладкий перец', 1, 'pcs', 'veg'),
      ing('tomatoes', 'Томаты', 2, 'pcs', 'veg', 'tomato'),
      ing('lime', 'Лайм', 1, 'pcs', 'veg'),
      ing('cilantro', 'Кинза', 15, 'g', 'veg'),
    ],
    steps: [
      step('Замаринуйте {white_fish} филе белой рыбы в соке из {lime} лайма.', 15),
      step('Выложите слоями {bell_pepper} сладкого перца, {tomatoes} томатов и рыбу.'),
      step('Залейте {coconut_milk} кокосового молока и тушите на слабом огне.', 20),
      step('Посыпьте {cilantro} кинзы.'),
    ],
  },
  'br-pao-de-queijo': {
    ingredients: [
      ing('tapioca', 'Тапиоковая мука', 250, 'g', 'grocery', 'tapioca_flour'),
      ing('cheese', 'Сыр', 150, 'g', 'dairy'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('milk', 'Молоко', 150, 'ml', 'dairy'),
      ing('butter', 'Сливочное масло', 50, 'g', 'dairy'),
    ],
    steps: [
      step(
        'Доведите {milk} молока с {butter} сливочного масла до кипения и заварите {tapioca} тапиоковой муки.',
      ),
      step('Остудите тесто, вмешайте {eggs} яиц и {cheese} тёртого сыра.', 10),
      step('Скатайте шарики и выпекайте при 200 °C.', 20),
    ],
  },
  'br-feijoada': {
    ingredients: [
      ing('black_beans', 'Чёрная фасоль', 300, 'g', 'grocery'),
      ing('pork_ribs', 'Свиные рёбрышки', 400, 'g', 'meat'),
      ing('smoked_sausage', 'Копчёная свиная колбаса', 200, 'g', 'meat'),
      ing('rice', 'Рис', 150, 'g', 'grocery'),
      ing('onion', 'Репчатый лук', 1, 'pcs', 'veg'),
      ing('garlic', 'Чеснок', 3, 'clove', 'veg'),
    ],
    steps: [
      step('Замочите {black_beans} чёрной фасоли на ночь и отварите.', 60),
      step(
        'Обжарьте {pork_ribs} свиных рёбрышек и {smoked_sausage} копчёной колбасы с {onion} лука и {garlic} чеснока.',
        10,
      ),
      step('Соедините мясо с фасолью и тушите.', 90),
      step('Подайте с {rice} отварного риса.'),
    ],
  },

  'co-arepas': {
    ingredients: [
      ing('corn_flour', 'Кукурузная мука', 250, 'g', 'grocery'),
      ing('cheese', 'Сыр', 100, 'g', 'dairy'),
      ing('butter', 'Сливочное масло', 20, 'g', 'dairy'),
      salt,
    ],
    steps: [
      step('Замесите {corn_flour} кукурузной муки с тёплой водой и солью.', 5),
      step('Слепите лепёшки и обжарьте на сухой сковороде.', 10),
      step('Разрежьте, смажьте {butter} сливочного масла и положите {cheese} сыра.'),
    ],
  },
  'co-sancocho': {
    ingredients: [
      ing('chicken', 'Курица', 800, 'g', 'meat'),
      ing('corn', 'Кукуруза', 2, 'pcs', 'veg', 'corn_cob'),
      ing('cassava', 'Маниока', 300, 'g', 'veg'),
      ing('cilantro', 'Кинза', 20, 'g', 'veg'),
      ing('potatoes', 'Картофель', 2, 'pcs', 'veg', 'potato'),
      salt,
    ],
    steps: [
      step('Залейте {chicken} курицы водой и варите.', 40),
      step('Добавьте {cassava} маниоки, {potatoes} картофеля и {corn} кукурузы кусками.'),
      step('Варите до мягкости овощей.', 30),
      step('Посыпьте {cilantro} кинзы перед подачей.'),
    ],
  },
  'co-bandeja-paisa': {
    ingredients: [
      ing('red_beans', 'Красная фасоль', 250, 'g', 'grocery'),
      ing('rice', 'Рис', 150, 'g', 'grocery'),
      ing('beef_mince', 'Говяжий фарш', 300, 'g', 'meat'),
      ing('chicharron', 'Чичаррон (свиная грудинка)', 300, 'g', 'meat', 'pork_belly'),
      ing('eggs', 'Яйца', 2, 'pcs', 'dairy', 'egg'),
      ing('avocado', 'Авокадо', 1, 'pcs', 'veg'),
    ],
    steps: [
      step('Отварите {red_beans} красной фасоли до мягкости.', 60),
      step('Обжарьте {chicharron} чичаррона до хруста.', 25),
      step('Обжарьте {beef_mince} говяжьего фарша и отварите {rice} риса.', 15),
      step('Пожарьте {eggs} яиц и разложите всё на большой тарелке с {avocado} авокадо.', 3),
    ],
  },
};
