/**
 * Seed recipes. Nutrition is NOT typed here — it is derived in the database from ingredients
 * (see recompute_recipe). All text is AI-drafted and seeded as translation_status = 'needs_review';
 * the dietitian should review/replace every recipe (README → "Content needed from the dietitian").
 * No runtime imports (scripts run this file directly with Node).
 */
export type SeedLocale = 'tr' | 'en' | 'fr' | 'ar';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface SeedRecipeText {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string;
}

export interface SeedRecipe {
  key: string;
  illustration: string;
  prepMin: number;
  cookMin: number;
  servings: number;
  mealTypes: MealType[];
  ingredients: { food: string; grams: number; unit?: string; qty?: number; optional?: boolean }[];
  text: Record<SeedLocale, SeedRecipeText>;
}

export const seedRecipes: SeedRecipe[] = [
  {
    key: 'menemen',
    illustration: 'tomato',
    prepMin: 5,
    cookMin: 12,
    servings: 2,
    mealTypes: ['breakfast'],
    ingredients: [
      { food: 'tomato', grams: 360, unit: 'piece', qty: 3 },
      { food: 'green_pepper', grams: 60, unit: 'piece', qty: 3 },
      { food: 'egg', grams: 150, unit: 'piece', qty: 3 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'chili_flakes', grams: 1 },
      { food: 'bread_whole', grams: 60, unit: 'slice', qty: 2, optional: true },
    ],
    text: {
      tr: {
        slug: 'menemen',
        title: 'Menemen',
        summary: 'Domates, biber ve yumurta. On beş dakikada, tek tavada, klasik bir kahvaltı.',
        steps: [
          'Biberleri ince halkalar hâlinde doğra; domateslerin kabuğunu soyup küp küp kes.',
          'Zeytinyağını geniş bir tavada ısıt, biberleri 3–4 dakika yumuşayana kadar çevir.',
          'Domatesleri ekle ve orta ateşte, suyunu biraz çekene kadar 5–6 dakika pişir.',
          'Yumurtaları kır; ister bütün bırak ister hafifçe karıştır. Kıvamını bulunca ocaktan al.',
          'Pul biber serp ve sıcak servis et.',
        ],
        tips: 'Soğanlı mı, soğansız mı? Tartışma hiç bitmez. Soğan eklersen biberlerle birlikte kavur.',
      },
      en: {
        slug: 'menemen-turkish-scrambled-eggs',
        title: 'Menemen',
        summary:
          'Tomatoes, peppers and eggs. A classic Turkish breakfast in one pan and fifteen minutes.',
        steps: [
          'Slice the peppers into thin rings; peel the tomatoes and dice them.',
          'Warm the olive oil in a wide pan and cook the peppers for 3–4 minutes until soft.',
          'Add the tomatoes and cook over medium heat for 5–6 minutes until slightly reduced.',
          'Crack in the eggs; leave them whole or stir gently. Take off the heat once just set.',
          'Sprinkle with chilli flakes and serve hot.',
        ],
        tips: 'Onion or no onion? The debate never ends. If you add it, cook it with the peppers.',
      },
      fr: {
        slug: 'menemen-oeufs-brouilles-turcs',
        title: 'Menemen',
        summary:
          'Tomates, piments doux et œufs. Un petit-déjeuner turc classique, une poêle, quinze minutes.',
        steps: [
          'Émince les piments en fines rondelles ; pèle les tomates et coupe-les en dés.',
          "Chauffe l'huile d'olive dans une grande poêle et fais revenir les piments 3 à 4 minutes.",
          'Ajoute les tomates et laisse cuire à feu moyen 5 à 6 minutes, jusqu’à légère réduction.',
          'Casse les œufs ; laisse-les entiers ou mélange doucement. Retire du feu dès qu’ils sont pris.',
          'Parsème de piment en flocons et sers chaud.',
        ],
        tips: 'Avec ou sans oignon ? Le débat est éternel. Si tu en mets, fais-le revenir avec les piments.',
      },
      ar: {
        slug: 'mnemen',
        title: 'منمن',
        summary: 'طماطم وفلفل وبيض. فطور تركي كلاسيكي في مقلاة واحدة وخلال ربع ساعة.',
        steps: [
          'قطّع الفلفل حلقات رفيعة، وقشّر الطماطم وقطّعها مكعبات.',
          'سخّن زيت الزيتون في مقلاة واسعة، وقلّب الفلفل 3–4 دقائق حتى يلين.',
          'أضف الطماطم واطهها على نار متوسطة 5–6 دقائق حتى تتكاثف قليلًا.',
          'اكسر البيض، واتركه كاملًا أو قلّبه برفق. ارفعه عن النار حين يتماسك.',
          'رشّ الفلفل الأحمر المجروش وقدّمه ساخنًا.',
        ],
        tips: 'بالبصل أم بدونه؟ نقاش لا ينتهي. إن أضفته، فقلّبه مع الفلفل.',
      },
    },
  },
  {
    key: 'lentil_soup',
    illustration: 'lentil',
    prepMin: 10,
    cookMin: 30,
    servings: 4,
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { food: 'lentils_red', grams: 190, unit: 'cup', qty: 1 },
      { food: 'onion', grams: 110, unit: 'piece', qty: 1 },
      { food: 'carrot', grams: 70, unit: 'piece', qty: 1 },
      { food: 'olive_oil', grams: 26, unit: 'tbsp', qty: 2 },
      { food: 'tomato_paste', grams: 16, unit: 'tbsp', qty: 1 },
      { food: 'cumin', grams: 2, unit: 'tsp', qty: 1 },
      { food: 'lemon', grams: 30, unit: 'tbsp', qty: 2 },
    ],
    text: {
      tr: {
        slug: 'kirmizi-mercimek-corbasi',
        title: 'Kırmızı mercimek çorbası',
        summary:
          'Her mutfağın güvencesi. Lif ve bitkisel protein kaynağı, limonla parlayan kadifemsi bir çorba.',
        steps: [
          'Mercimeği birkaç kez yıka ve süz.',
          'Soğanı ve havucu küçük doğra; zeytinyağında 5 dakika, yumuşayana kadar kavur.',
          'Salçayı ve kimyonu ekle, bir dakika çevir.',
          'Mercimeği ve 1,5 litre sıcak suyu ekle. Kapağı aralık, mercimek dağılana kadar yaklaşık 25 dakika pişir.',
          'Blenderdan geçir; kıvamını suyla ayarla ve tuzunu kontrol et.',
          'Limonla servis et.',
        ],
        tips: 'Fazlasını porsiyonlayıp dondurabilirsin; üç aya kadar saklanır.',
      },
      en: {
        slug: 'red-lentil-soup',
        title: 'Red lentil soup',
        summary:
          'Every Turkish kitchen’s safe bet. A velvety soup with fibre and plant protein, brightened with lemon.',
        steps: [
          'Rinse the lentils a few times and drain.',
          'Finely chop the onion and carrot; soften them in the olive oil for 5 minutes.',
          'Add the tomato paste and cumin and stir for a minute.',
          'Add the lentils and 1.5 litres of hot water. With the lid ajar, simmer for about 25 minutes until the lentils fall apart.',
          'Blend; adjust the thickness with water and check the salt.',
          'Serve with lemon.',
        ],
        tips: 'Portion and freeze the leftovers; they keep for up to three months.',
      },
      fr: {
        slug: 'soupe-de-lentilles-corail',
        title: 'Soupe de lentilles corail',
        summary:
          'La valeur sûre des cuisines turques. Une soupe veloutée, source de fibres et de protéines végétales, relevée de citron.',
        steps: [
          'Rince les lentilles plusieurs fois et égoutte-les.',
          "Hache finement l'oignon et la carotte ; fais-les revenir 5 minutes dans l'huile d'olive.",
          'Ajoute le concentré de tomate et le cumin, mélange une minute.',
          "Ajoute les lentilles et 1,5 litre d'eau chaude. Couvercle entrouvert, laisse mijoter environ 25 minutes, jusqu'à ce que les lentilles se défassent.",
          "Mixe ; ajuste la consistance avec de l'eau et rectifie le sel.",
          'Sers avec du citron.',
        ],
        tips: "Congèle les restes en portions ; ils se conservent jusqu'à trois mois.",
      },
      ar: {
        slug: 'shorbat-adas-ahmar',
        title: 'شوربة العدس الأحمر',
        summary:
          'الخيار المضمون في كل مطبخ. شوربة مخملية غنية بالألياف والبروتين النباتي، يزيّنها الليمون.',
        steps: [
          'اغسل العدس عدة مرات وصفّه.',
          'افرم البصل والجزر ناعمًا، وقلّبهما في زيت الزيتون 5 دقائق حتى يلينا.',
          'أضف معجون الطماطم والكمون وقلّب دقيقة.',
          'أضف العدس و1.5 لتر من الماء الساخن. اتركه يغلي بهدوء والغطاء مفتوح قليلًا نحو 25 دقيقة حتى يتفتت العدس.',
          'اهرسه بالخلاط، واضبط القوام بالماء وتذوّق الملح.',
          'قدّمه مع الليمون.',
        ],
        tips: 'قسّم الباقي إلى حصص وجمّده؛ يُحفظ حتى ثلاثة أشهر.',
      },
    },
  },
  {
    key: 'quinoa_salad',
    illustration: 'pomegranate',
    prepMin: 15,
    cookMin: 15,
    servings: 2,
    mealTypes: ['lunch'],
    ingredients: [
      { food: 'quinoa', grams: 80 },
      { food: 'chickpeas_cooked', grams: 160, unit: 'cup', qty: 1 },
      { food: 'cucumber', grams: 150, unit: 'piece', qty: 1 },
      { food: 'tomato', grams: 120, unit: 'piece', qty: 1 },
      { food: 'parsley', grams: 25 },
      { food: 'spring_onion', grams: 30, unit: 'piece', qty: 2 },
      { food: 'lemon', grams: 30, unit: 'tbsp', qty: 2 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'pomegranate', grams: 24, unit: 'tbsp', qty: 2 },
      { food: 'sumac', grams: 2, unit: 'tsp', qty: 1 },
    ],
    text: {
      tr: {
        slug: 'nohutlu-kinoa-salatasi',
        title: 'Nohutlu kinoa salatası',
        summary:
          'Kısır ile çoban salatasının buluştuğu nokta: nar, sumak, bol yeşillik ve doyurucu nohut.',
        steps: [
          'Kinoayı ince süzgeçte yıka. İki katı suyla 12–15 dakika, suyunu çekene kadar pişir ve soğut.',
          'Salatalığı ve domatesi küçük küp doğra; maydanozu ve taze soğanı ince kıy.',
          'Limon suyu, zeytinyağı, sumak ve bir tutam tuzla sosu çırp.',
          'Kinoa, nohut ve sebzeleri sosla karıştır; narı en son serp.',
        ],
        tips: 'Ertesi günün öğle yemeği için sosunu ayrı taşı; salata dağılmaz.',
      },
      en: {
        slug: 'chickpea-quinoa-salad',
        title: 'Chickpea & quinoa salad',
        summary:
          'Where kısır meets shepherd’s salad: pomegranate, sumac, plenty of herbs and filling chickpeas.',
        steps: [
          'Rinse the quinoa in a fine sieve. Cook in twice its volume of water for 12–15 minutes until absorbed, then cool.',
          'Dice the cucumber and tomato; finely chop the parsley and spring onions.',
          'Whisk the lemon juice, olive oil, sumac and a pinch of salt into a dressing.',
          'Toss the quinoa, chickpeas and vegetables with the dressing; scatter the pomegranate last.',
        ],
        tips: 'Packing it for tomorrow’s lunch? Carry the dressing separately so the salad stays crisp.',
      },
      fr: {
        slug: 'salade-quinoa-pois-chiches',
        title: 'Salade de quinoa aux pois chiches',
        summary:
          'À la rencontre du kısır et de la salade du berger : grenade, sumac, beaucoup d’herbes et des pois chiches rassasiants.',
        steps: [
          "Rince le quinoa dans une passoire fine. Fais-le cuire 12 à 15 minutes dans deux fois son volume d'eau, puis laisse refroidir.",
          "Coupe le concombre et la tomate en petits dés ; cisèle le persil et l'oignon nouveau.",
          "Fouette le jus de citron, l'huile d'olive, le sumac et une pincée de sel.",
          'Mélange quinoa, pois chiches et légumes avec la sauce ; ajoute la grenade à la fin.',
        ],
        tips: 'Pour le déjeuner du lendemain, transporte la sauce à part : la salade reste croquante.',
      },
      ar: {
        slug: 'salatat-kinwa-bil-hummus',
        title: 'سلطة الكينوا بالحمّص',
        summary: 'حيث تلتقي الكِسِر بسلطة الراعي: رمّان وسمّاق وأعشاب وفيرة وحمّص مُشبع.',
        steps: [
          'اغسل الكينوا في مصفاة ناعمة، واطهها بضعف حجمها من الماء 12–15 دقيقة حتى تتشرب الماء، ثم بردها.',
          'قطّع الخيار والطماطم مكعبات صغيرة، وافرم البقدونس والبصل الأخضر ناعمًا.',
          'اخفق عصير الليمون وزيت الزيتون والسماق مع رشة ملح.',
          'اخلط الكينوا والحمّص والخضار مع الصلصة، ورشّ الرمّان في النهاية.',
        ],
        tips: 'إن أخذتها لغداء الغد، فاحمل الصلصة منفصلة كي تبقى السلطة مقرمشة.',
      },
    },
  },
  {
    key: 'salmon_zucchini',
    illustration: 'fish',
    prepMin: 10,
    cookMin: 20,
    servings: 2,
    mealTypes: ['dinner'],
    ingredients: [
      { food: 'salmon', grams: 300, unit: 'portion', qty: 2 },
      { food: 'zucchini', grams: 400, unit: 'piece', qty: 2 },
      { food: 'lemon', grams: 60, unit: 'piece', qty: 1 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'garlic', grams: 8, unit: 'clove', qty: 2 },
      { food: 'dill', grams: 20 },
    ],
    text: {
      tr: {
        slug: 'firinda-limonlu-somon-ve-kabak',
        title: 'Fırında limonlu somon ve kabak',
        summary: 'Tek tepsi, yirmi dakika. Dereotu ve limonla, bulaşığı az bir akşam yemeği.',
        steps: [
          'Fırını 200 °C’ye ısıt. Kabakları uzunlamasına dörde bölüp iri parçalar hâlinde kes.',
          'Kabakları zeytinyağı, ezilmiş sarımsak ve bir tutam tuzla tepside harmanla; 8 dakika pişir.',
          'Somonları tepsiye yerleştir, üzerine limon dilimleri koy.',
          'Balık kolayca lif lif ayrılana kadar 10–12 dakika daha pişir.',
          'Kıyılmış dereotu ve kalan limonun suyuyla servis et.',
        ],
        tips: 'Somon yerine levrek de olur; pişirme süresini 2–3 dakika kısalt.',
      },
      en: {
        slug: 'baked-lemon-salmon-courgette',
        title: 'Baked lemon salmon with courgette',
        summary: 'One tray, twenty minutes. A dinner with dill, lemon and very little washing-up.',
        steps: [
          'Heat the oven to 200 °C. Quarter the courgettes lengthways and cut into chunks.',
          'Toss the courgettes on the tray with olive oil, crushed garlic and a pinch of salt; roast for 8 minutes.',
          'Nestle the salmon on the tray and top with lemon slices.',
          'Roast for another 10–12 minutes until the fish flakes easily.',
          'Serve with chopped dill and the juice of the remaining lemon.',
        ],
        tips: 'Sea bass works too; cut the cooking time by 2–3 minutes.',
      },
      fr: {
        slug: 'saumon-au-citron-et-courgettes-au-four',
        title: 'Saumon au citron et courgettes au four',
        summary:
          'Une plaque, vingt minutes. Un dîner à l’aneth et au citron, avec très peu de vaisselle.',
        steps: [
          'Préchauffe le four à 200 °C. Coupe les courgettes en quatre dans la longueur, puis en tronçons.',
          "Mélange les courgettes sur la plaque avec l'huile d'olive, l'ail écrasé et une pincée de sel ; enfourne 8 minutes.",
          'Dispose le saumon sur la plaque et couvre de rondelles de citron.',
          "Poursuis la cuisson 10 à 12 minutes, jusqu'à ce que le poisson s'effeuille facilement.",
          'Sers avec l’aneth ciselé et le jus du citron restant.',
        ],
        tips: 'Le bar convient aussi ; réduis la cuisson de 2 à 3 minutes.',
      },
      ar: {
        slug: 'salmon-bil-laymun-wa-kusa-fil-furn',
        title: 'سلمون بالليمون مع الكوسا في الفرن',
        summary: 'صينية واحدة وعشرون دقيقة. عشاء بالشبت والليمون وقليل من الجلي.',
        steps: [
          'سخّن الفرن إلى 200 °م. اقسم الكوسا طوليًا إلى أربعة ثم قطّعها قطعًا كبيرة.',
          'اخلط الكوسا في الصينية مع زيت الزيتون والثوم المهروس ورشة ملح، واخبزها 8 دقائق.',
          'ضع قطع السلمون في الصينية وفوقها شرائح الليمون.',
          'اخبز 10–12 دقيقة أخرى حتى تتفكك السمكة بسهولة.',
          'قدّمها مع الشبت المفروم وعصير الليمونة المتبقية.',
        ],
        tips: 'يصلح القاروص أيضًا؛ قلّل وقت الطهي 2–3 دقائق.',
      },
    },
  },
  {
    key: 'overnight_oats',
    illustration: 'oats',
    prepMin: 5,
    cookMin: 0,
    servings: 1,
    mealTypes: ['breakfast'],
    ingredients: [
      { food: 'oats', grams: 40, unit: 'tbsp', qty: 5 },
      { food: 'yogurt_strained', grams: 150 },
      { food: 'walnut', grams: 12, unit: 'piece', qty: 3 },
      { food: 'pomegranate', grams: 24, unit: 'tbsp', qty: 2 },
      { food: 'cinnamon', grams: 1 },
      { food: 'honey', grams: 7, unit: 'tsp', qty: 1, optional: true },
    ],
    text: {
      tr: {
        slug: 'gece-bekletilen-yulaf',
        title: 'Süzme yoğurtlu gece yulafı',
        summary:
          'Akşamdan beş dakika, sabah sıfır dakika. Cevizli, narlı ve tarçınlı bir kavanoz kahvaltı.',
        steps: [
          'Yulafı, süzme yoğurdu, tarçını ve 3–4 yemek kaşığı suyu bir kavanozda karıştır.',
          'Kapağını kapatıp buzdolabında en az 6 saat, tercihen bir gece beklet.',
          'Sabah kıvamını bir kaşık suyla aç; üzerine ceviz ve nar ekle.',
        ],
        tips: 'Tatlı istersen balı ekle; tarçın ve nar çoğu zaman yeterince tat verir.',
      },
      en: {
        slug: 'overnight-oats-strained-yoghurt',
        title: 'Overnight oats with strained yoghurt',
        summary:
          'Five minutes the night before, zero in the morning. A jar breakfast with walnuts, pomegranate and cinnamon.',
        steps: [
          'Stir the oats, strained yoghurt, cinnamon and 3–4 tablespoons of water together in a jar.',
          'Close the lid and refrigerate for at least 6 hours, ideally overnight.',
          'In the morning loosen with a spoonful of water; top with walnuts and pomegranate.',
        ],
        tips: 'Add the honey if you like it sweeter; cinnamon and pomegranate usually do the job.',
      },
      fr: {
        slug: 'flocons-davoine-de-la-veille-au-yaourt',
        title: 'Flocons d’avoine de la veille au yaourt égoutté',
        summary:
          'Cinq minutes la veille, zéro le matin. Un petit-déjeuner en bocal aux noix, à la grenade et à la cannelle.',
        steps: [
          "Mélange les flocons, le yaourt égoutté, la cannelle et 3 à 4 cuillères à soupe d'eau dans un bocal.",
          'Ferme et laisse au réfrigérateur au moins 6 heures, idéalement toute la nuit.',
          "Le matin, détends avec une cuillère d'eau ; ajoute les noix et la grenade.",
        ],
        tips: 'Ajoute le miel si tu veux plus sucré ; la cannelle et la grenade suffisent souvent.',
      },
      ar: {
        slug: 'shufan-al-layl-bil-labna',
        title: 'شوفان منقوع مع اللبنة',
        summary: 'خمس دقائق في المساء ولا شيء في الصباح. فطور في مرطبان مع الجوز والرمّان والقرفة.',
        steps: [
          'اخلط الشوفان واللبنة والقرفة و3–4 ملاعق كبيرة من الماء في مرطبان.',
          'أغلقه واتركه في الثلاجة 6 ساعات على الأقل، ويفضَّل طوال الليل.',
          'في الصباح خفّف القوام بملعقة ماء، وأضف الجوز والرمّان.',
        ],
        tips: 'أضف العسل إن أردته أحلى؛ القرفة والرمّان يكفيان غالبًا.',
      },
    },
  },
  {
    key: 'green_beans',
    illustration: 'olive',
    prepMin: 15,
    cookMin: 40,
    servings: 4,
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { food: 'green_beans', grams: 500 },
      { food: 'onion', grams: 110, unit: 'piece', qty: 1 },
      { food: 'tomato', grams: 240, unit: 'piece', qty: 2 },
      { food: 'olive_oil', grams: 39, unit: 'tbsp', qty: 3 },
    ],
    text: {
      tr: {
        slug: 'zeytinyagli-taze-fasulye',
        title: 'Zeytinyağlı taze fasulye',
        summary: 'Oda sıcaklığında daha da güzel. Ege mutfağının sabırla pişen, sade klasiği.',
        steps: [
          'Fasulyelerin uçlarını ayıkla, ikiye ya da üçe böl.',
          'Soğanı yarım ay doğra; zeytinyağında şeffaflaşana kadar kavur.',
          'Fasulyeleri ekle, 5 dakika çevir. Rendelenmiş domatesi ve yarım su bardağı sıcak suyu ekle.',
          'Kapağını kapat, kısık ateşte fasulyeler yumuşayana kadar 30–35 dakika pişir.',
          'Tencerede ılımaya bırak; oda sıcaklığında servis et.',
        ],
        tips: 'Yanına yoğurt ve bir dilim tam buğday ekmeği koyarsan dengeli bir öğün olur.',
      },
      en: {
        slug: 'green-beans-in-olive-oil',
        title: 'Green beans in olive oil',
        summary:
          'Even better at room temperature. A slow-cooked, simple classic of the Aegean kitchen.',
        steps: [
          'Top and tail the beans and cut into two or three pieces.',
          'Slice the onion into half-moons; soften in the olive oil until translucent.',
          'Add the beans and stir for 5 minutes. Add the grated tomatoes and half a glass of hot water.',
          'Cover and cook over low heat for 30–35 minutes until the beans are tender.',
          'Let it cool in the pot; serve at room temperature.',
        ],
        tips: 'Add yoghurt and a slice of wholemeal bread on the side for a balanced meal.',
      },
      fr: {
        slug: 'haricots-verts-a-lhuile-dolive',
        title: 'Haricots verts à l’huile d’olive',
        summary:
          'Encore meilleurs à température ambiante. Un classique simple et mijoté de la cuisine égéenne.',
        steps: [
          'Équeute les haricots et coupe-les en deux ou trois.',
          "Émince l'oignon en demi-lunes ; fais-le fondre dans l'huile d'olive.",
          "Ajoute les haricots, remue 5 minutes. Ajoute les tomates râpées et un demi-verre d'eau chaude.",
          "Couvre et laisse cuire à feu doux 30 à 35 minutes, jusqu'à ce que les haricots soient tendres.",
          'Laisse tiédir dans la casserole ; sers à température ambiante.',
        ],
        tips: 'Avec un yaourt et une tranche de pain complet, cela fait un repas équilibré.',
      },
      ar: {
        slug: 'fasulya-khadra-bi-zayt-al-zaytun',
        title: 'فاصوليا خضراء بزيت الزيتون',
        summary: 'ألذّ في حرارة الغرفة. طبق بسيط يُطهى على مهل من مطبخ بحر إيجة.',
        steps: [
          'نظّف أطراف الفاصوليا واقطعها إلى قطعتين أو ثلاث.',
          'قطّع البصل أنصاف حلقات وقلّبه في زيت الزيتون حتى يصبح شفافًا.',
          'أضف الفاصوليا وقلّب 5 دقائق، ثم أضف الطماطم المبشورة ونصف كوب ماء ساخن.',
          'غطِّ القدر واطهُ على نار هادئة 30–35 دقيقة حتى تطرى الفاصوليا.',
          'اتركها تفتر في القدر، وقدّمها في حرارة الغرفة.',
        ],
        tips: 'مع اللبن وشريحة خبز من القمح الكامل تصبح وجبة متوازنة.',
      },
    },
  },
  {
    key: 'bulgur_pilaf',
    illustration: 'pepper',
    prepMin: 10,
    cookMin: 25,
    servings: 4,
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { food: 'bulgur', grams: 170, unit: 'cup', qty: 1 },
      { food: 'onion', grams: 110, unit: 'piece', qty: 1 },
      { food: 'red_pepper', grams: 150, unit: 'piece', qty: 1 },
      { food: 'tomato', grams: 120, unit: 'piece', qty: 1 },
      { food: 'pepper_paste', grams: 16, unit: 'tbsp', qty: 1 },
      { food: 'olive_oil', grams: 26, unit: 'tbsp', qty: 2 },
      { food: 'chickpeas_cooked', grams: 80 },
    ],
    text: {
      tr: {
        slug: 'sebzeli-nohutlu-bulgur-pilavi',
        title: 'Sebzeli, nohutlu bulgur pilavı',
        summary: 'Tane tane, salçalı ve lifli. Kendi başına öğün, yanına yoğurtla tam bir sofra.',
        steps: [
          'Soğanı ve biberi küçük doğra; zeytinyağında 5 dakika kavur.',
          'Biber salçasını ve rendelenmiş domatesi ekle, 2 dakika çevir.',
          'Bulguru ve nohudu ekle, yağla kaplanması için bir dakika karıştır.',
          'İki su bardağı sıcak su ve tuz ekle. Kaynayınca kısık ateşte suyunu çekene kadar 15 dakika pişir.',
          'Ocaktan al, kapağın altına kâğıt havlu koyup 10 dakika demlendir.',
        ],
        tips: 'Ayranla ya da cacıkla servis et.',
      },
      en: {
        slug: 'bulgur-pilaf-with-vegetables-and-chickpeas',
        title: 'Bulgur pilaf with vegetables & chickpeas',
        summary:
          'Fluffy, peppery and full of fibre. A meal on its own, or a full table with yoghurt.',
        steps: [
          'Finely chop the onion and pepper; cook in the olive oil for 5 minutes.',
          'Add the pepper paste and grated tomato; stir for 2 minutes.',
          'Add the bulgur and chickpeas and stir for a minute to coat.',
          'Add two glasses of hot water and salt. Bring to the boil, then simmer on low for 15 minutes until absorbed.',
          'Off the heat, put a paper towel under the lid and let it rest for 10 minutes.',
        ],
        tips: 'Serve with ayran or cacık.',
      },
      fr: {
        slug: 'pilaf-de-boulgour-aux-legumes-et-pois-chiches',
        title: 'Pilaf de boulgour aux légumes et pois chiches',
        summary:
          'Grains détachés, parfumé au piment et riche en fibres. Un repas à lui seul, ou une table complète avec du yaourt.',
        steps: [
          "Hache l'oignon et le poivron ; fais-les revenir 5 minutes dans l'huile d'olive.",
          'Ajoute la purée de piment et la tomate râpée ; remue 2 minutes.',
          'Ajoute le boulgour et les pois chiches, mélange une minute pour bien les enrober.',
          "Ajoute deux verres d'eau chaude et le sel. À ébullition, baisse le feu et laisse cuire 15 minutes jusqu'à absorption.",
          'Hors du feu, glisse un essuie-tout sous le couvercle et laisse reposer 10 minutes.',
        ],
        tips: 'Sers avec de l’ayran ou du cacık.',
      },
      ar: {
        slug: 'burghul-bil-khudar-wal-hummus',
        title: 'برغل بالخضار والحمّص',
        summary: 'حبات منفصلة ونكهة الفلفل وغنى بالألياف. وجبة بحد ذاتها، ومع اللبن مائدة كاملة.',
        steps: [
          'افرم البصل والفلفل ناعمًا، وقلّبهما في زيت الزيتون 5 دقائق.',
          'أضف دبس الفلفل والطماطم المبشورة، وقلّب دقيقتين.',
          'أضف البرغل والحمّص، وقلّب دقيقة حتى يتغلفا بالزيت.',
          'أضف كوبين من الماء الساخن والملح. عند الغليان اخفض النار واطهُ 15 دقيقة حتى يتشرب الماء.',
          'ارفعه عن النار، وضع منديلًا ورقيًا تحت الغطاء، واتركه يرتاح 10 دقائق.',
        ],
        tips: 'قدّمه مع العيران أو الجاجيك.',
      },
    },
  },
  {
    key: 'chicken_saute',
    illustration: 'mushroom',
    prepMin: 15,
    cookMin: 15,
    servings: 2,
    mealTypes: ['dinner'],
    ingredients: [
      { food: 'chicken_breast', grams: 250 },
      { food: 'red_pepper', grams: 150, unit: 'piece', qty: 1 },
      { food: 'zucchini', grams: 200, unit: 'piece', qty: 1 },
      { food: 'mushroom', grams: 140, unit: 'cup', qty: 2 },
      { food: 'onion', grams: 110, unit: 'piece', qty: 1 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'garlic', grams: 8, unit: 'clove', qty: 2 },
      { food: 'chili_flakes', grams: 1 },
    ],
    text: {
      tr: {
        slug: 'tavuklu-sebze-sote',
        title: 'Tavuklu sebze sote',
        summary: 'Yüksek ateş, kısa süre. Proteini bol, renkli ve on beş dakikada tabakta.',
        steps: [
          'Tavuğu kuşbaşı doğra; sebzeleri benzer büyüklükte kes.',
          'Geniş tavayı iyice ısıt, zeytinyağını ekle ve tavuğu tek kat hâlinde 5–6 dakika, her yanı renk alana kadar pişir.',
          'Soğanı, biberi ve mantarı ekle; 4 dakika yüksek ateşte çevir.',
          'Kabağı ve sarımsağı ekle, 3 dakika daha pişir. Tuz ve pul biberle tatlandır.',
        ],
        tips: 'Tavayı kalabalık etme; sebzeler buharda pişmek yerine kavrulsun.',
      },
      en: {
        slug: 'chicken-vegetable-saute',
        title: 'Chicken & vegetable sauté',
        summary:
          'High heat, short time. Protein-rich, colourful and on the plate in fifteen minutes.',
        steps: [
          'Dice the chicken; cut the vegetables to a similar size.',
          'Heat a wide pan well, add the olive oil and cook the chicken in a single layer for 5–6 minutes until coloured all over.',
          'Add the onion, pepper and mushrooms; stir-fry over high heat for 4 minutes.',
          'Add the courgette and garlic and cook 3 more minutes. Season with salt and chilli flakes.',
        ],
        tips: 'Don’t crowd the pan; you want the vegetables to sear, not steam.',
      },
      fr: {
        slug: 'poulet-saute-aux-legumes',
        title: 'Poulet sauté aux légumes',
        summary:
          'Feu vif, cuisson courte. Riche en protéines, coloré et dans l’assiette en quinze minutes.',
        steps: [
          'Coupe le poulet en cubes et les légumes en morceaux de taille similaire.',
          "Chauffe bien une grande poêle, ajoute l'huile d'olive et saisis le poulet en une seule couche 5 à 6 minutes, jusqu'à coloration.",
          "Ajoute l'oignon, le poivron et les champignons ; fais sauter 4 minutes à feu vif.",
          "Ajoute la courgette et l'ail, poursuis 3 minutes. Assaisonne de sel et de piment en flocons.",
        ],
        tips: 'Ne surcharge pas la poêle : les légumes doivent saisir, pas cuire à la vapeur.',
      },
      ar: {
        slug: 'dajaj-mushawwah-bil-khudar',
        title: 'دجاج مشوّح بالخضار',
        summary: 'نار عالية ووقت قصير. غني بالبروتين وملوّن وجاهز خلال ربع ساعة.',
        steps: [
          'قطّع الدجاج مكعبات، والخضار بحجم مماثل.',
          'سخّن مقلاة واسعة جيدًا، وأضف زيت الزيتون، واطهُ الدجاج في طبقة واحدة 5–6 دقائق حتى يتحمّر من كل الجهات.',
          'أضف البصل والفلفل والفطر، وقلّب على نار عالية 4 دقائق.',
          'أضف الكوسا والثوم واطهُ 3 دقائق أخرى. تبّل بالملح والفلفل المجروش.',
        ],
        tips: 'لا تملأ المقلاة أكثر من اللازم؛ نريد أن تتحمّر الخضار لا أن تُطهى بالبخار.',
      },
    },
  },
  {
    key: 'cilbir',
    illustration: 'egg',
    prepMin: 5,
    cookMin: 10,
    servings: 2,
    mealTypes: ['breakfast', 'lunch'],
    ingredients: [
      { food: 'egg', grams: 200, unit: 'piece', qty: 4 },
      { food: 'yogurt', grams: 200, unit: 'bowl', qty: 1 },
      { food: 'garlic', grams: 4, unit: 'clove', qty: 1 },
      { food: 'butter', grams: 10, unit: 'tsp', qty: 2 },
      { food: 'chili_flakes', grams: 2, unit: 'tsp', qty: 1 },
      { food: 'bread_whole', grams: 60, unit: 'slice', qty: 2, optional: true },
    ],
    text: {
      tr: {
        slug: 'cilbir',
        title: 'Çılbır',
        summary:
          'Sarımsaklı yoğurdun üstünde poşe yumurta ve pul biberli tereyağı. Osmanlı mutfağından bir hafta sonu kahvaltısı.',
        steps: [
          'Yoğurdu ezilmiş sarımsak ve bir tutam tuzla çırp; oda sıcaklığına gelsin diye tabaklara paylaştır.',
          'Geniş bir tencerede suyu hafif kaynama noktasına getir, bir kaşık sirke ekle.',
          'Yumurtaları tek tek bir kaseye kırıp suya kaydır; 3 dakika poşe et ve delikli kepçeyle al.',
          'Yumurtaları yoğurdun üzerine yerleştir.',
          'Tereyağını eritip pul biberi ekle, köpürünce yumurtaların üzerine gezdir.',
        ],
        tips: 'Suyu fokurdatma; hafif titreyen su yumurtanın beyazını toplu tutar.',
      },
      en: {
        slug: 'cilbir-turkish-eggs',
        title: 'Çılbır (Turkish eggs)',
        summary:
          'Poached eggs on garlicky yoghurt with chilli butter. A weekend breakfast from the Ottoman kitchen.',
        steps: [
          'Whisk the yoghurt with crushed garlic and a pinch of salt; divide between plates so it comes to room temperature.',
          'Bring a wide pan of water to a gentle simmer and add a spoonful of vinegar.',
          'Crack each egg into a cup and slide it into the water; poach for 3 minutes and lift out with a slotted spoon.',
          'Place the eggs on the yoghurt.',
          'Melt the butter with the chilli flakes and, once foaming, drizzle it over the eggs.',
        ],
        tips: 'Don’t let the water bubble hard; a gentle shiver keeps the whites together.',
      },
      fr: {
        slug: 'cilbir-oeufs-a-la-turque',
        title: 'Çılbır (œufs à la turque)',
        summary:
          'Œufs pochés sur yaourt à l’ail et beurre pimenté. Un petit-déjeuner du week-end hérité de la cuisine ottomane.',
        steps: [
          "Fouette le yaourt avec l'ail écrasé et une pincée de sel ; répartis-le dans les assiettes pour qu'il soit à température ambiante.",
          "Porte une grande casserole d'eau à frémissement et ajoute une cuillère de vinaigre.",
          "Casse chaque œuf dans une tasse et fais-le glisser dans l'eau ; poche 3 minutes puis retire à l'écumoire.",
          'Dépose les œufs sur le yaourt.',
          'Fais fondre le beurre avec le piment et, dès qu’il mousse, verse-le sur les œufs.',
        ],
        tips: 'Pas de gros bouillons : un léger frémissement garde les blancs bien regroupés.',
      },
      ar: {
        slug: 'chilbir',
        title: 'تشلبر',
        summary: 'بيض مسلوق بلا قشر فوق لبن بالثوم مع زبدة بالفلفل. فطور عطلة من المطبخ العثماني.',
        steps: [
          'اخفق اللبن مع الثوم المهروس ورشة ملح، ووزّعه على الأطباق ليصل إلى حرارة الغرفة.',
          'سخّن الماء في قدر واسع حتى يقارب الغليان، وأضف ملعقة خل.',
          'اكسر كل بيضة في كوب وأنزلها في الماء، واسلقها 3 دقائق ثم ارفعها بمغرفة مثقوبة.',
          'ضع البيض فوق اللبن.',
          'ذوّب الزبدة مع الفلفل المجروش، وحين تزبد صبّها فوق البيض.',
        ],
        tips: 'لا تدع الماء يغلي بشدة؛ الغليان الهادئ يحافظ على تماسك بياض البيض.',
      },
    },
  },
  {
    key: 'roasted_chickpeas',
    illustration: 'chickpea',
    prepMin: 5,
    cookMin: 30,
    servings: 4,
    mealTypes: ['snack'],
    ingredients: [
      { food: 'chickpeas_cooked', grams: 480, unit: 'cup', qty: 3 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'cumin', grams: 2, unit: 'tsp', qty: 1 },
      { food: 'chili_flakes', grams: 2, unit: 'tsp', qty: 1 },
      { food: 'sumac', grams: 2, unit: 'tsp', qty: 1 },
    ],
    text: {
      tr: {
        slug: 'firinda-baharatli-nohut',
        title: 'Fırında baharatlı nohut',
        summary: 'Çıtır, baharatlı, lifli. Cips isteyen akşamlar için hazır bir kavanoz.',
        steps: [
          'Fırını 200 °C’ye ısıt. Nohutları süz ve temiz bir bezle iyice kurula.',
          'Zeytinyağı, kimyon, pul biber ve tuzla harmanla; tepsiye tek kat yay.',
          'Arada bir sallayarak 25–30 dakika, çıtırlaşana kadar kızart.',
          'Sumak serp, tepside soğumaya bırak.',
        ],
        tips: 'Tamamen soğuyunca ağzı kapalı kavanozda 3 gün çıtırlığını korur.',
      },
      en: {
        slug: 'spiced-roasted-chickpeas',
        title: 'Spiced roasted chickpeas',
        summary:
          'Crunchy, spiced and full of fibre. A jar ready for the evenings that want crisps.',
        steps: [
          'Heat the oven to 200 °C. Drain the chickpeas and dry them well with a clean towel.',
          'Toss with olive oil, cumin, chilli flakes and salt; spread in a single layer on a tray.',
          'Roast for 25–30 minutes, shaking now and then, until crisp.',
          'Sprinkle with sumac and let them cool on the tray.',
        ],
        tips: 'Once fully cool, they stay crunchy in a sealed jar for 3 days.',
      },
      fr: {
        slug: 'pois-chiches-rotis-aux-epices',
        title: 'Pois chiches rôtis aux épices',
        summary:
          'Croustillants, épicés et riches en fibres. Un bocal prêt pour les soirs d’envie de chips.',
        steps: [
          'Préchauffe le four à 200 °C. Égoutte les pois chiches et sèche-les bien avec un torchon propre.',
          "Mélange-les avec l'huile d'olive, le cumin, le piment et le sel ; étale-les en une couche sur une plaque.",
          "Rôtis 25 à 30 minutes en secouant de temps en temps, jusqu'à ce qu'ils soient croustillants.",
          'Saupoudre de sumac et laisse refroidir sur la plaque.',
        ],
        tips: 'Une fois bien refroidis, ils restent croustillants 3 jours dans un bocal fermé.',
      },
      ar: {
        slug: 'hummus-muhammas-bil-baharat',
        title: 'حمّص محمّص بالبهارات',
        summary: 'مقرمش ومتبّل وغني بالألياف. مرطبان جاهز للأمسيات التي تشتهي رقائق البطاطا.',
        steps: [
          'سخّن الفرن إلى 200 °م. صفِّ الحمّص وجففه جيدًا بمنشفة نظيفة.',
          'اخلطه بزيت الزيتون والكمون والفلفل المجروش والملح، وافرده طبقة واحدة في صينية.',
          'حمّصه 25–30 دقيقة مع هز الصينية من حين لآخر حتى يصبح مقرمشًا.',
          'رشّ السماق واتركه يبرد في الصينية.',
        ],
        tips: 'بعد أن يبرد تمامًا، يبقى مقرمشًا 3 أيام في مرطبان محكم.',
      },
    },
  },
  {
    key: 'lentil_kofte',
    illustration: 'lemon',
    prepMin: 20,
    cookMin: 20,
    servings: 6,
    mealTypes: ['lunch', 'snack'],
    ingredients: [
      { food: 'lentils_red', grams: 190, unit: 'cup', qty: 1 },
      { food: 'bulgur', grams: 170, unit: 'cup', qty: 1 },
      { food: 'onion', grams: 110, unit: 'piece', qty: 1 },
      { food: 'olive_oil', grams: 39, unit: 'tbsp', qty: 3 },
      { food: 'tomato_paste', grams: 16, unit: 'tbsp', qty: 1 },
      { food: 'pepper_paste', grams: 16, unit: 'tbsp', qty: 1 },
      { food: 'spring_onion', grams: 60, unit: 'piece', qty: 4 },
      { food: 'parsley', grams: 50, unit: 'bunch', qty: 1 },
      { food: 'cumin', grams: 2, unit: 'tsp', qty: 1 },
      { food: 'lettuce', grams: 90, unit: 'handful', qty: 3 },
      { food: 'lemon', grams: 30, unit: 'tbsp', qty: 2 },
    ],
    text: {
      tr: {
        slug: 'mercimek-koftesi',
        title: 'Mercimek köftesi',
        summary:
          'Pişmeyen köfte: mercimeğin sıcaklığıyla demlenen bulgur, bol yeşillik, marul yaprağı ve limon.',
        steps: [
          'Mercimeği 2,5 su bardağı suyla, dağılıp suyunu çekene kadar yaklaşık 20 dakika pişir.',
          'Ocaktan alır almaz bulguru ekle, karıştır ve kapağı kapalı 20 dakika demlendir.',
          'Soğanı ince doğrayıp zeytinyağında kavur; salçaları ekleyip bir dakika çevir.',
          'Soğanlı karışımı, kimyonu ve tuzu mercimeğe ekleyip ılıyınca iyice yoğur.',
          'Kıyılmış taze soğan ve maydanozu ekle; ıslak elle uzun köfteler şekillendir.',
          'Marul yaprakları ve limonla servis et.',
        ],
        tips: 'Karışım kuru gelirse bir iki kaşık ılık su ekleyerek yoğur.',
      },
      en: {
        slug: 'red-lentil-kofte',
        title: 'Red lentil köfte',
        summary:
          'Köfte that never meets a pan: bulgur steamed by hot lentils, plenty of herbs, lettuce leaves and lemon.',
        steps: [
          'Cook the lentils in 2.5 glasses of water for about 20 minutes until they break down and absorb it.',
          'As soon as you take it off the heat, stir in the bulgur, cover and let it steam for 20 minutes.',
          'Finely chop the onion and soften it in the olive oil; add both pastes and stir for a minute.',
          'Add the onion mixture, cumin and salt to the lentils and knead well once warm.',
          'Mix in the chopped spring onions and parsley; shape long köfte with wet hands.',
          'Serve with lettuce leaves and lemon.',
        ],
        tips: 'If the mixture feels dry, knead in a spoonful or two of warm water.',
      },
      fr: {
        slug: 'kofte-de-lentilles-corail',
        title: 'Köfte de lentilles corail',
        summary:
          'Des köfte sans cuisson : boulgour gonflé à la chaleur des lentilles, beaucoup d’herbes, feuilles de laitue et citron.',
        steps: [
          "Fais cuire les lentilles dans 2,5 verres d'eau environ 20 minutes, jusqu'à ce qu'elles se défassent et absorbent l'eau.",
          'Dès la sortie du feu, ajoute le boulgour, mélange, couvre et laisse gonfler 20 minutes.',
          "Hache finement l'oignon et fais-le revenir dans l'huile d'olive ; ajoute les deux concentrés et remue une minute.",
          'Ajoute ce mélange, le cumin et le sel aux lentilles et pétris bien une fois tiède.',
          "Incorpore l'oignon nouveau et le persil hachés ; façonne des köfte allongées avec les mains mouillées.",
          'Sers avec des feuilles de laitue et du citron.',
        ],
        tips: "Si la pâte est sèche, ajoute une ou deux cuillères d'eau tiède en pétrissant.",
      },
      ar: {
        slug: 'kufta-al-adas',
        title: 'كفتة العدس',
        summary: 'كفتة لا تُطهى: برغل ينضج بحرارة العدس، وأعشاب وفيرة، وأوراق خس، وليمون.',
        steps: [
          'اطهُ العدس في 2.5 كوب ماء نحو 20 دقيقة حتى يتفتت ويتشرب الماء.',
          'فور رفعه عن النار أضف البرغل وقلّب، وغطِّه واتركه 20 دقيقة لينضج.',
          'افرم البصل ناعمًا وقلّبه في زيت الزيتون، ثم أضف المعجونين وقلّب دقيقة.',
          'أضف خليط البصل والكمون والملح إلى العدس، واعجنه جيدًا حين يفتر.',
          'أضف البصل الأخضر والبقدونس المفرومين، وشكّل أقراصًا مستطيلة بيدين مبللتين.',
          'قدّمها مع أوراق الخس والليمون.',
        ],
        tips: 'إن بدا الخليط جافًا، أضف ملعقة أو اثنتين من الماء الفاتر أثناء العجن.',
      },
    },
  },
  {
    key: 'apple_yogurt',
    illustration: 'apple',
    prepMin: 5,
    cookMin: 0,
    servings: 1,
    mealTypes: ['snack'],
    ingredients: [
      { food: 'yogurt_strained', grams: 150 },
      { food: 'apple', grams: 90 },
      { food: 'walnut', grams: 8, unit: 'piece', qty: 2 },
      { food: 'cinnamon', grams: 1 },
      { food: 'chia', grams: 6 },
    ],
    text: {
      tr: {
        slug: 'elmali-tarcinli-suzme-yogurt',
        title: 'Elmalı, tarçınlı süzme yoğurt',
        summary:
          'İkindi açlığına beş dakikalık cevap: proteinli yoğurt, rendelenmiş elma, ceviz ve tarçın.',
        steps: [
          'Elmayı kabuğuyla iri rendele.',
          'Süzme yoğurdu kaseye al; elmayı, chia tohumunu ve tarçını ekle.',
          'Üzerine kırılmış ceviz serp.',
        ],
        tips: 'Elmayı rendeledikten hemen sonra kullan ya da birkaç damla limon sık; kararmaz.',
      },
      en: {
        slug: 'strained-yoghurt-with-apple-and-cinnamon',
        title: 'Strained yoghurt with apple & cinnamon',
        summary:
          'A five-minute answer to afternoon hunger: protein-rich yoghurt, grated apple, walnuts and cinnamon.',
        steps: [
          'Coarsely grate the apple, skin on.',
          'Spoon the strained yoghurt into a bowl; add the apple, chia seeds and cinnamon.',
          'Scatter the broken walnuts on top.',
        ],
        tips: 'Use the apple right after grating, or add a few drops of lemon so it doesn’t brown.',
      },
      fr: {
        slug: 'yaourt-egoutte-pomme-cannelle',
        title: 'Yaourt égoutté, pomme et cannelle',
        summary:
          'Une réponse en cinq minutes au creux de l’après-midi : yaourt riche en protéines, pomme râpée, noix et cannelle.',
        steps: [
          'Râpe grossièrement la pomme avec la peau.',
          'Verse le yaourt égoutté dans un bol ; ajoute la pomme, les graines de chia et la cannelle.',
          'Parsème de noix concassées.',
        ],
        tips: 'Utilise la pomme aussitôt râpée, ou ajoute quelques gouttes de citron pour qu’elle ne noircisse pas.',
      },
      ar: {
        slug: 'labna-bil-tuffah-wal-qirfa',
        title: 'لبنة بالتفاح والقرفة',
        summary: 'جواب في خمس دقائق لجوع العصر: لبنة غنية بالبروتين، وتفاح مبشور، وجوز، وقرفة.',
        steps: [
          'ابشر التفاحة بقشرها بشرًا خشنًا.',
          'ضع اللبنة في وعاء، وأضف التفاح وبذور الشيا والقرفة.',
          'رشّ الجوز المكسّر على الوجه.',
        ],
        tips: 'استخدم التفاح فور بشره، أو أضف قطرات ليمون كي لا يسودّ.',
      },
    },
  },
  {
    key: 'tuna_piyaz',
    illustration: 'onion',
    prepMin: 10,
    cookMin: 0,
    servings: 2,
    mealTypes: ['lunch', 'dinner'],
    ingredients: [
      { food: 'white_beans_cooked', grams: 360, unit: 'cup', qty: 2 },
      { food: 'tuna_water', grams: 160, unit: 'portion', qty: 2 },
      { food: 'onion', grams: 55 },
      { food: 'parsley', grams: 25 },
      { food: 'tomato', grams: 120, unit: 'piece', qty: 1 },
      { food: 'lemon', grams: 30, unit: 'tbsp', qty: 2 },
      { food: 'olive_oil', grams: 13, unit: 'tbsp', qty: 1 },
      { food: 'sumac', grams: 2, unit: 'tsp', qty: 1 },
    ],
    text: {
      tr: {
        slug: 'ton-balikli-piyaz',
        title: 'Ton balıklı piyaz',
        summary:
          'Pişirmesiz, on dakikalık, doyurucu bir öğle yemeği. Proteini ve lifi bol, sumaklı bir klasik.',
        steps: [
          'Soğanı piyazlık doğra, sumak ve bir tutam tuzla ovup 5 dakika beklet.',
          'Fasulyeyi süzüp yıka; ton balığının suyunu süz.',
          'Domatesi küp doğra, maydanozu kıy.',
          'Hepsini limon suyu ve zeytinyağıyla nazikçe karıştır; ton balığını en son, iri parçalar hâlinde ekle.',
        ],
        tips: 'Antalya usulü istersen bir yemek kaşığı tahini limonla açıp sosa ekle.',
      },
      en: {
        slug: 'tuna-and-white-bean-piyaz',
        title: 'Tuna & white bean piyaz',
        summary:
          'No cooking, ten minutes, genuinely filling. A sumac-bright classic rich in protein and fibre.',
        steps: [
          'Slice the onion thinly, rub with sumac and a pinch of salt and leave for 5 minutes.',
          'Drain and rinse the beans; drain the tuna.',
          'Dice the tomato and chop the parsley.',
          'Fold everything gently with the lemon juice and olive oil; add the tuna last, in large flakes.',
        ],
        tips: 'For the Antalya style, loosen a tablespoon of tahini with lemon and stir it into the dressing.',
      },
      fr: {
        slug: 'piyaz-au-thon-et-haricots-blancs',
        title: 'Piyaz au thon et haricots blancs',
        summary:
          'Sans cuisson, dix minutes, vraiment rassasiant. Un classique au sumac, riche en protéines et en fibres.',
        steps: [
          "Émince finement l'oignon, frotte-le avec le sumac et une pincée de sel et laisse reposer 5 minutes.",
          'Égoutte et rince les haricots ; égoutte le thon.',
          'Coupe la tomate en dés et hache le persil.',
          "Mélange délicatement le tout avec le jus de citron et l'huile d'olive ; ajoute le thon en dernier, en gros morceaux.",
        ],
        tips: 'Façon Antalya : détends une cuillère à soupe de tahini avec du citron et ajoute-la à la sauce.',
      },
      ar: {
        slug: 'piyaz-bil-tuna',
        title: 'بياز بالتونة',
        summary: 'بلا طهي وفي عشر دقائق ومُشبع حقًا. طبق كلاسيكي بالسماق غني بالبروتين والألياف.',
        steps: [
          'قطّع البصل شرائح رفيعة، وافركه بالسماق ورشة ملح، واتركه 5 دقائق.',
          'صفِّ الفاصوليا واغسلها، وصفِّ التونة.',
          'قطّع الطماطم مكعبات وافرم البقدونس.',
          'اخلط الجميع برفق مع عصير الليمون وزيت الزيتون، وأضف التونة في النهاية قطعًا كبيرة.',
        ],
        tips: 'على طريقة أنطاليا: خفّف ملعقة كبيرة من الطحينة بالليمون وأضفها إلى الصلصة.',
      },
    },
  },
];
