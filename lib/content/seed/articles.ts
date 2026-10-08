/**
 * Seed guides. AI-drafted, seeded as translation_status = 'needs_review' in every locale.
 * Claims are limited to well-established public-health guidance, with sources. URLs are only
 * included where the address is a stable, well-known one; otherwise title + publisher only.
 * The dietitian must review each guide before relying on it (README checklist).
 * Body format: paragraphs separated by a blank line, "## " subheadings, "- " bullet lists.
 */
export type SeedLocale = 'tr' | 'en' | 'fr' | 'ar';

export interface SeedArticle {
  key: string;
  category: 'basics' | 'habits' | 'labels' | 'kitchen';
  illustration: string;
  readingMin: number;
  sources: { title: string; publisher: string; url?: string }[];
  text: Record<SeedLocale, { slug: string; title: string; excerpt: string; body: string }>;
}

const WHO_HEALTHY_DIET = {
  title: 'Healthy diet (fact sheet)',
  publisher: 'World Health Organization',
  url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
};
const TUBER = {
  title: 'Türkiye Beslenme Rehberi (TÜBER) 2022',
  publisher: 'T.C. Sağlık Bakanlığı',
};

export const seedArticles: SeedArticle[] = [
  {
    key: 'plate_method',
    category: 'basics',
    illustration: 'cucumber',
    readingMin: 3,
    sources: [
      WHO_HEALTHY_DIET,
      TUBER,
      { title: 'Healthy Eating Plate', publisher: 'Harvard T.H. Chan School of Public Health' },
    ],
    text: {
      tr: {
        slug: 'tabak-modeli',
        title: 'Tabak modeli: yarısı sebze, gerisi denge',
        excerpt: 'Kalori saymadan dengeli bir öğün kurmanın en kolay yolu: tabağına bakmak.',
        body: `Her öğünü tartmak ya da hesaplamak zorunda değilsin. Birçok beslenme rehberinin önerdiği tabak modeli, dengeyi göz kararıyla kurmana yardım eder.

## Tabağı dörde böl

- Yarısı sebze ve meyve: çiğ ya da pişmiş, mümkün olduğunca renkli.
- Dörtte biri protein: baklagil, yumurta, balık, tavuk, yoğurt ya da peynir.
- Dörtte biri tahıl: tercihen bulgur, tam buğday ekmeği, yulaf gibi tam tahıllar.

Yanına az miktarda sağlıklı yağ (zeytinyağı, bir avuç kuruyemiş) ve içecek olarak su eklemek yeterli.

## Neden işe yarar?

Sebze ağırlıklı bir tabak, lif ve su içeriği sayesinde hacim sağlar; protein ve tam tahıl ise tokluğu uzatır. Dünya Sağlık Örgütü de sağlıklı beslenmede sebze, meyve, baklagil ve tam tahılların payını artırmayı önerir.

## Kendi mutfağına uyarla

Model bir kalıp değil, bir başlangıç noktası. Kuru fasulye-pilav sofrasında pilavı biraz küçültüp yanına bol salata eklemek de tabak modelidir. Kişisel ihtiyaçların (hareket düzeyin, sağlık durumun, hedefin) oranları değiştirebilir; bu yüzden kişisel bir plan için bir diyetisyenle konuşmak en doğrusu.`,
      },
      en: {
        slug: 'the-plate-method',
        title: 'The plate method: half vegetables, the rest in balance',
        excerpt:
          'The easiest way to build a balanced meal without counting calories: look at your plate.',
        body: `You don't have to weigh or calculate every meal. The plate method, used by many dietary guidelines, helps you build balance by eye.

## Split the plate into quarters

- Half vegetables and fruit: raw or cooked, as colourful as possible.
- A quarter protein: legumes, eggs, fish, chicken, yoghurt or cheese.
- A quarter grains: ideally whole grains such as bulgur, wholemeal bread or oats.

Add a little healthy fat (olive oil, a handful of nuts) and water to drink.

## Why it works

A vegetable-heavy plate gives volume thanks to its fibre and water; protein and whole grains help you stay full for longer. The World Health Organization also recommends increasing the share of vegetables, fruit, legumes and whole grains in a healthy diet.

## Make it fit your kitchen

The model is a starting point, not a mould. Serving a slightly smaller portion of pilaf with your beans and adding a big salad is the plate method too. Your personal needs (activity, health, goals) can change the proportions — which is why a personal plan is best made with a dietitian.`,
      },
      fr: {
        slug: 'la-methode-de-lassiette',
        title: "La méthode de l'assiette : moitié légumes, le reste en équilibre",
        excerpt:
          'Le moyen le plus simple de composer un repas équilibré sans compter les calories : regarder son assiette.',
        body: `Pas besoin de peser ni de calculer chaque repas. La méthode de l'assiette, reprise par de nombreuses recommandations nutritionnelles, aide à trouver l'équilibre à l'œil.

## Partage l'assiette en quatre

- Une moitié de légumes et de fruits : crus ou cuits, le plus colorés possible.
- Un quart de protéines : légumineuses, œufs, poisson, poulet, yaourt ou fromage.
- Un quart de céréales : de préférence complètes, comme le boulgour, le pain complet ou l'avoine.

Ajoute un peu de bonne matière grasse (huile d'olive, une poignée d'oléagineux) et de l'eau comme boisson.

## Pourquoi ça marche

Une assiette riche en légumes apporte du volume grâce aux fibres et à l'eau ; les protéines et les céréales complètes prolongent la satiété. L'Organisation mondiale de la santé recommande elle aussi d'augmenter la part des légumes, fruits, légumineuses et céréales complètes.

## Adapte-la à ta cuisine

C'est un point de départ, pas un moule. Réduire un peu le pilaf à côté des haricots et ajouter une grande salade, c'est aussi la méthode de l'assiette. Tes besoins personnels (activité, santé, objectifs) peuvent modifier les proportions : pour un plan personnalisé, parle à un diététicien.`,
      },
      ar: {
        slug: 'namudhaj-al-tabaq',
        title: 'نموذج الطبق: نصفه خضار، والباقي توازن',
        excerpt: 'أسهل طريقة لبناء وجبة متوازنة من دون عدّ السعرات: أن تنظر إلى طبقك.',
        body: `لست مضطرًا إلى وزن كل وجبة أو حسابها. نموذج الطبق الذي تعتمده إرشادات غذائية كثيرة يساعدك على بناء التوازن بالنظر.

## قسّم الطبق إلى أربعة

- النصف خضار وفواكه: نيئة أو مطبوخة، وبألوان متعددة قدر الإمكان.
- الربع بروتين: بقوليات أو بيض أو سمك أو دجاج أو لبن أو جبن.
- الربع حبوب: ويفضَّل الحبوب الكاملة مثل البرغل وخبز القمح الكامل والشوفان.

أضف قليلًا من الدهون الصحية (زيت الزيتون، حفنة مكسرات)، واشرب الماء.

## لماذا ينجح؟

الطبق الغني بالخضار يمنح حجمًا بفضل الألياف والماء، بينما يطيل البروتين والحبوب الكاملة الشعور بالشبع. وتوصي منظمة الصحة العالمية أيضًا بزيادة حصة الخضار والفواكه والبقوليات والحبوب الكاملة في النظام الغذائي الصحي.

## كيّفه مع مطبخك

النموذج نقطة انطلاق لا قالب جامد. تصغير حصة الأرز قليلًا بجانب الفاصوليا وإضافة سلطة كبيرة هو أيضًا نموذج الطبق. قد تغيّر احتياجاتك الشخصية (النشاط، الصحة، الهدف) النسب؛ لذلك من الأفضل إعداد خطة شخصية مع أخصائي تغذية.`,
      },
    },
  },
  {
    key: 'hydration',
    category: 'habits',
    illustration: 'lemon',
    readingMin: 3,
    sources: [
      {
        title:
          'Scientific Opinion on Dietary Reference Values for water. EFSA Journal 2010;8(3):1459',
        publisher: 'European Food Safety Authority (EFSA)',
        url: 'https://doi.org/10.2903/j.efsa.2010.1459',
      },
      TUBER,
    ],
    text: {
      tr: {
        slug: 'su-icmek',
        title: 'Su: bardak saymadan yeterince içmek',
        excerpt: 'Ne kadar su gerekir, hangi içecekler sayılır ve unutmamak için ne yapılabilir?',
        body: `"Günde sekiz bardak" kuralını herkes duymuştur; gerçek ihtiyaç ise kişiden kişiye değişir. Hava sıcaklığı, hareket düzeyi ve beslenme biçimi bu ihtiyacı etkiler.

## Referans değerler

Avrupa Gıda Güvenliği Otoritesi (EFSA), yetişkinler için günlük toplam su alımında kadınlarda yaklaşık 2,0 litre, erkeklerde yaklaşık 2,5 litre yeterli alım düzeyi belirlemiştir. Bu miktar yalnızca içtiğimiz suyu değil, yiyeceklerden gelen suyu da kapsar; yiyecekler genellikle toplamın yaklaşık beşte birini karşılar.

## Neler sayılır?

Su en iyi seçenektir. Maden suyu, ayran, süt, şekersiz çay ve kahve de sıvı alımına katkı sağlar. Şekerli içecekler ise sıvının yanında fazladan şeker getirir.

## Unutmamak için

- Suyu görünür yerde tut: masada, çantada, arabada.
- Bir alışkanlığa bağla: her öğünden önce bir bardak.
- Tat isteyen günlerde suya limon, nane ya da salatalık ekle.
- İdrar renginin açık saman sarısı olması, çoğu kişi için yeterli içtiğinin pratik bir işaretidir.

Böbrek ya da kalp hastalığı gibi durumlarda sıvı ihtiyacı farklı olabilir; bu durumda hekiminin önerisine uy.`,
      },
      en: {
        slug: 'drinking-enough-water',
        title: 'Water: drinking enough without counting glasses',
        excerpt: 'How much water you need, which drinks count, and how to remember.',
        body: `Everyone has heard "eight glasses a day"; real needs vary from person to person. Temperature, activity level and diet all play a part.

## Reference values

The European Food Safety Authority (EFSA) set adequate intakes of total water for adults at about 2.0 litres a day for women and about 2.5 litres for men. This includes water from food, which usually provides around a fifth of the total — not just what you drink.

## What counts?

Water is the best choice. Sparkling water, ayran, milk, and unsweetened tea and coffee also contribute. Sugary drinks bring extra sugar along with the fluid.

## Ways to remember

- Keep water visible: on your desk, in your bag, in the car.
- Tie it to a habit: a glass before every meal.
- On days you want flavour, add lemon, mint or cucumber.
- For most people, pale straw-coloured urine is a practical sign of drinking enough.

With conditions such as kidney or heart disease, fluid needs can differ; follow your doctor's advice.`,
      },
      fr: {
        slug: 'boire-assez-deau',
        title: "L'eau : boire assez sans compter les verres",
        excerpt: "Combien d'eau faut-il, quelles boissons comptent, et comment ne pas oublier ?",
        body: `Tout le monde connaît la règle des « huit verres par jour » ; les besoins réels varient pourtant d'une personne à l'autre. La température, l'activité et l'alimentation jouent toutes un rôle.

## Valeurs de référence

L'Autorité européenne de sécurité des aliments (EFSA) fixe un apport adéquat en eau totale d'environ 2,0 litres par jour pour les femmes adultes et d'environ 2,5 litres pour les hommes. Ce total inclut l'eau apportée par les aliments, qui représente généralement environ un cinquième — pas seulement ce que l'on boit.

## Qu'est-ce qui compte ?

L'eau est le meilleur choix. L'eau gazeuse, l'ayran, le lait, le thé et le café non sucrés contribuent aussi. Les boissons sucrées apportent du sucre en plus du liquide.

## Pour ne pas oublier

- Garde l'eau en vue : sur le bureau, dans le sac, dans la voiture.
- Associe-la à une habitude : un verre avant chaque repas.
- Les jours où tu veux du goût, ajoute du citron, de la menthe ou du concombre.
- Pour la plupart des gens, une urine jaune paille clair est un bon indice d'hydratation suffisante.

En cas de maladie rénale ou cardiaque, les besoins en liquides peuvent être différents ; suis l'avis de ton médecin.`,
      },
      ar: {
        slug: 'shurb-al-ma',
        title: 'الماء: أن تشرب ما يكفي من دون عدّ الأكواب',
        excerpt: 'كم تحتاج من الماء، وأيّ المشروبات تُحتسب، وكيف لا تنسى؟',
        body: `الجميع سمع بقاعدة «ثمانية أكواب يوميًا»، لكن الاحتياج الحقيقي يختلف من شخص لآخر. فالحرارة ومستوى النشاط ونمط الأكل كلها تؤثر فيه.

## القيم المرجعية

حدّدت الهيئة الأوروبية لسلامة الأغذية (EFSA) المدخول الكافي من الماء الكلي للبالغين بنحو 2.0 لتر يوميًا للنساء ونحو 2.5 لتر للرجال. ويشمل ذلك الماء الآتي من الطعام، الذي يغطي عادةً نحو خُمس المجموع، لا ما نشربه فقط.

## ماذا يُحتسب؟

الماء هو الخيار الأفضل. ويسهم أيضًا الماء الفوّار والعيران والحليب والشاي والقهوة غير المحلّاة. أما المشروبات السكرية فتضيف سكرًا زائدًا مع السوائل.

## كي لا تنسى

- اجعل الماء في مكان ظاهر: على المكتب وفي الحقيبة وفي السيارة.
- اربطه بعادة: كوب قبل كل وجبة.
- في الأيام التي تريد فيها نكهة، أضف الليمون أو النعناع أو الخيار.
- لون البول الأصفر الفاتح علامة عملية لدى معظم الناس على شرب ما يكفي.

في حالات مثل أمراض الكلى أو القلب قد يختلف احتياج السوائل؛ اتبع نصيحة طبيبك.`,
      },
    },
  },
  {
    key: 'protein',
    category: 'basics',
    illustration: 'egg',
    readingMin: 3,
    sources: [
      {
        title:
          'Scientific Opinion on Dietary Reference Values for protein. EFSA Journal 2012;10(2):2557',
        publisher: 'European Food Safety Authority (EFSA)',
        url: 'https://doi.org/10.2903/j.efsa.2012.2557',
      },
      TUBER,
    ],
    text: {
      tr: {
        slug: 'her-ogune-biraz-protein',
        title: 'Protein: her öğüne biraz',
        excerpt:
          'Proteini tek öğünde toplamak yerine güne yaymak, planlamayı kolaylaştıran pratik bir yaklaşım.',
        body: `Protein; kasların, bağışıklık sisteminin ve birçok dokunun yapı taşıdır. İyi haber: Türk mutfağı iyi protein kaynaklarıyla dolu.

## Ne kadar?

EFSA, sağlıklı yetişkinler için günlük protein referans değerini vücut ağırlığının kilogramı başına 0,83 gram olarak belirlemiştir. 70 kilogramlık bir yetişkin için bu, günde yaklaşık 58 gram demektir. Yaş, hareket düzeyi, hamilelik ve bazı sağlık durumları bu ihtiyacı değiştirebilir.

## Güne yaymak

Birçok kişi proteinin büyük kısmını akşam yemeğinde alır. Kahvaltıya ve öğle yemeğine de bir protein kaynağı eklemek hem tokluğu destekler hem de planlamayı kolaylaştırır.

- Kahvaltı: yumurta, peynir, süzme yoğurt.
- Öğle: baklagil salatası, ton balığı, tavuk.
- Ara öğün: yoğurt, bir avuç kuruyemiş, leblebi.
- Akşam: balık, et ya da baklagil yemeği.

## Bitkisel kaynaklar

Mercimek, nohut, kuru fasulye ve bulgur gibi besinler hem protein hem lif sağlar. Baklagilleri tahıllarla aynı gün içinde tüketmek, bitkisel beslenmede protein kalitesini destekler.

Böbrek hastalığı gibi durumlarda protein miktarı hekim ve diyetisyen tarafından ayrıca belirlenmelidir.`,
      },
      en: {
        slug: 'a-little-protein-at-every-meal',
        title: 'Protein: a little at every meal',
        excerpt:
          'Spreading protein across the day, rather than loading one meal, is a practical way to plan.',
        body: `Protein is a building block of muscle, the immune system and many other tissues. The good news: Turkish cuisine is full of good protein sources.

## How much?

EFSA set the population reference intake for protein for healthy adults at 0.83 grams per kilogram of body weight per day. For a 70 kg adult that is about 58 grams a day. Age, activity, pregnancy and some health conditions can change this.

## Spread it out

Many people eat most of their protein at dinner. Adding a protein source to breakfast and lunch supports fullness and makes planning easier.

- Breakfast: eggs, cheese, strained yoghurt.
- Lunch: a legume salad, tuna, chicken.
- Snack: yoghurt, a handful of nuts, roasted chickpeas.
- Dinner: fish, meat or a legume dish.

## Plant sources

Lentils, chickpeas, beans and bulgur provide both protein and fibre. Eating legumes and grains on the same day supports protein quality in plant-based eating.

With conditions such as kidney disease, protein amounts should be set by your doctor and dietitian.`,
      },
      fr: {
        slug: 'un-peu-de-proteines-a-chaque-repas',
        title: 'Protéines : un peu à chaque repas',
        excerpt:
          'Répartir les protéines sur la journée plutôt que de tout concentrer sur un repas : une façon pratique de s’organiser.',
        body: `Les protéines sont un élément de base des muscles, du système immunitaire et de nombreux tissus. Bonne nouvelle : la cuisine turque regorge de bonnes sources de protéines.

## Combien ?

L'EFSA fixe la référence nutritionnelle en protéines pour les adultes en bonne santé à 0,83 gramme par kilo de poids corporel et par jour. Pour un adulte de 70 kg, cela représente environ 58 grammes par jour. L'âge, l'activité, la grossesse et certains problèmes de santé peuvent modifier ce besoin.

## Répartir sur la journée

Beaucoup de gens consomment l'essentiel de leurs protéines au dîner. En ajouter au petit-déjeuner et au déjeuner soutient la satiété et simplifie l'organisation.

- Petit-déjeuner : œufs, fromage, yaourt égoutté.
- Déjeuner : salade de légumineuses, thon, poulet.
- Collation : yaourt, une poignée d'oléagineux, pois chiches grillés.
- Dîner : poisson, viande ou plat de légumineuses.

## Sources végétales

Lentilles, pois chiches, haricots et boulgour apportent à la fois protéines et fibres. Associer légumineuses et céréales dans la même journée soutient la qualité protéique d'une alimentation végétale.

En cas de maladie rénale, la quantité de protéines doit être fixée par le médecin et le diététicien.`,
      },
      ar: {
        slug: 'qalil-min-al-brutin-fi-kull-wajba',
        title: 'البروتين: قليل منه في كل وجبة',
        excerpt: 'توزيع البروتين على اليوم بدل جمعه في وجبة واحدة طريقة عملية لتسهيل التخطيط.',
        body: `البروتين لبنة أساسية في العضلات وجهاز المناعة وأنسجة كثيرة. والخبر الجيد أن المطبخ التركي غني بمصادر البروتين الجيدة.

## كم نحتاج؟

حدّدت EFSA المدخول المرجعي من البروتين للبالغين الأصحاء بـ 0.83 غرام لكل كيلوغرام من وزن الجسم يوميًا. أي نحو 58 غرامًا يوميًا لبالغ وزنه 70 كيلوغرامًا. وقد يتغير الاحتياج بحسب العمر والنشاط والحمل وبعض الحالات الصحية.

## وزّعه على اليوم

يتناول كثيرون معظم بروتينهم في العشاء. إضافة مصدر بروتين إلى الفطور والغداء تدعم الشعور بالشبع وتسهّل التخطيط.

- الفطور: بيض، جبن، لبنة.
- الغداء: سلطة بقوليات، تونة، دجاج.
- وجبة خفيفة: لبن، حفنة مكسرات، حمّص محمّص.
- العشاء: سمك أو لحم أو طبق بقوليات.

## مصادر نباتية

العدس والحمّص والفاصوليا والبرغل تمنح البروتين والألياف معًا. وتناول البقوليات والحبوب في اليوم نفسه يدعم جودة البروتين في النظام النباتي.

في حالات مثل أمراض الكلى، يجب أن يحدد الطبيب وأخصائي التغذية كمية البروتين.`,
      },
    },
  },
  {
    key: 'labels',
    category: 'labels',
    illustration: 'bread',
    readingMin: 4,
    sources: [
      {
        title: 'Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği (2017)',
        publisher: 'T.C. Tarım ve Orman Bakanlığı',
      },
      {
        title: 'Guideline: Sugars intake for adults and children (2015)',
        publisher: 'World Health Organization',
      },
      WHO_HEALTHY_DIET,
    ],
    text: {
      tr: {
        slug: 'etiket-okumanin-bes-satiri',
        title: 'Etiket okumanın beş satırı',
        excerpt: 'Market rafında bir dakikada karar vermek için paketin arkasında nereye bakmalı?',
        body: `Paketli bir ürünün ön yüzü pazarlamadır; arka yüzü bilgidir. Bir dakikanı ayırıp beş satıra bakman yeterli.

## 1. Porsiyon ve 100 gram

Değerler çoğu zaman hem 100 gram hem porsiyon için verilir. Ürünleri karşılaştırırken 100 gram sütununa bak; gerçekte ne kadar yediğini düşünürken porsiyona.

## 2. İçindekiler listesi

Bileşenler çoktan aza doğru sıralanır. Listenin başında şeker ya da şekerin farklı adları (glikoz şurubu, fruktoz, dekstroz) varsa, ürün tatlı bir üründür.

## 3. Şeker

Dünya Sağlık Örgütü, serbest şekerlerin günlük enerjinin %10'undan azını oluşturmasını öneriyor. Etiketteki "şekerler" satırı, meyve ve sütteki doğal şekerleri de içerebilir; içindekiler listesiyle birlikte değerlendir.

## 4. Tuz

DSÖ, yetişkinler için günde 5 gramdan az tuz öneriyor. Ekmek, peynir, zeytin, salça ve hazır çorbalar, günlük tuzun gizli kaynakları olabilir.

## 5. Lif ve yağ türü

Tahıllı ürünlerde lif miktarı yüksek olanı seç. Yağ satırında doymuş yağa bak; aynı türden iki ürün arasında daha düşük olanı tercih etmek iyi bir kuraldır.

Etiket bir yargı aracı değil, seçim aracıdır. Hiçbir ürün tek başına "iyi" ya da "kötü" değildir; önemli olan bütün içindeki yeri.`,
      },
      en: {
        slug: 'five-lines-of-a-food-label',
        title: 'Five lines of a food label',
        excerpt: 'Where to look on the back of the pack to decide in a minute at the shelf.',
        body: `The front of a pack is marketing; the back is information. One minute and five lines are enough.

## 1. Per serving and per 100 g

Values are usually given per 100 g and per serving. Use the 100 g column to compare products, and the serving column to think about what you'll actually eat.

## 2. The ingredients list

Ingredients are listed from most to least. If sugar, or one of its other names (glucose syrup, fructose, dextrose), is near the top, it's a sweet product.

## 3. Sugars

The World Health Organization recommends keeping free sugars below 10% of daily energy. The "sugars" line on a label can include natural sugars from fruit and milk, so read it together with the ingredients list.

## 4. Salt

WHO recommends less than 5 g of salt a day for adults. Bread, cheese, olives, tomato paste and instant soups can be hidden sources of daily salt.

## 5. Fibre and type of fat

For grain products, choose the one with more fibre. On the fat line, look at saturated fat; between two similar products, choosing the lower one is a good rule.

A label is a tool for choosing, not for judging. No single product is "good" or "bad"; what matters is its place in the whole.`,
      },
      fr: {
        slug: 'cinq-lignes-dune-etiquette',
        title: "Les cinq lignes d'une étiquette",
        excerpt: "Où regarder au dos de l'emballage pour décider en une minute devant le rayon ?",
        body: `Le devant d'un emballage, c'est du marketing ; le dos, c'est de l'information. Une minute et cinq lignes suffisent.

## 1. Par portion et pour 100 g

Les valeurs sont souvent données pour 100 g et par portion. Compare les produits avec la colonne 100 g, et pense à ce que tu mangeras réellement avec la colonne portion.

## 2. La liste des ingrédients

Les ingrédients sont classés du plus au moins présent. Si le sucre, ou l'un de ses autres noms (sirop de glucose, fructose, dextrose), arrive en tête, c'est un produit sucré.

## 3. Les sucres

L'Organisation mondiale de la santé recommande que les sucres libres représentent moins de 10 % de l'énergie quotidienne. La ligne « sucres » peut inclure les sucres naturels des fruits et du lait : lis-la avec la liste des ingrédients.

## 4. Le sel

L'OMS recommande moins de 5 g de sel par jour pour les adultes. Pain, fromage, olives, concentré de tomate et soupes instantanées peuvent être des sources cachées de sel.

## 5. Les fibres et le type de graisses

Pour les produits céréaliers, choisis le plus riche en fibres. Sur la ligne des lipides, regarde les acides gras saturés ; entre deux produits similaires, prendre le plus bas est une bonne règle.

Une étiquette sert à choisir, pas à juger. Aucun produit n'est « bon » ou « mauvais » à lui seul ; ce qui compte, c'est sa place dans l'ensemble.`,
      },
      ar: {
        slug: 'khamsat-sutur-fi-mulsaq-al-ghidha',
        title: 'خمسة سطور في ملصق الغذاء',
        excerpt: 'أين تنظر على ظهر العبوة لتقرر خلال دقيقة أمام الرف؟',
        body: `واجهة العبوة تسويق، وظهرها معلومات. تكفي دقيقة واحدة وخمسة سطور.

## 1. الحصة ولكل 100 غ

تُذكر القيم غالبًا لكل 100 غ ولكل حصة. قارن المنتجات بعمود 100 غ، وفكّر فيما ستأكله فعلًا بعمود الحصة.

## 2. قائمة المكوّنات

تُرتَّب المكوّنات من الأكثر إلى الأقل. إن جاء السكر أو أحد أسمائه الأخرى (شراب الغلوكوز، الفركتوز، الدكستروز) في أعلى القائمة، فالمنتج حلو.

## 3. السكريات

توصي منظمة الصحة العالمية بأن تبقى السكريات الحرة أقل من 10٪ من الطاقة اليومية. وقد يشمل سطر «السكريات» السكريات الطبيعية في الفاكهة والحليب، فاقرأه مع قائمة المكوّنات.

## 4. الملح

توصي منظمة الصحة العالمية البالغين بأقل من 5 غ من الملح يوميًا. قد يكون الخبز والجبن والزيتون ومعجون الطماطم والشوربات الجاهزة مصادر خفية للملح.

## 5. الألياف ونوع الدهون

في منتجات الحبوب، اختر الأغنى بالألياف. وفي سطر الدهون انظر إلى الدهون المشبعة؛ فبين منتجين متشابهين، اختيار الأقل قاعدة جيدة.

الملصق أداة للاختيار لا للحكم. لا يوجد منتج «جيد» أو «سيّئ» وحده؛ المهم مكانه ضمن الكل.`,
      },
    },
  },
  {
    key: 'fiber',
    category: 'basics',
    illustration: 'fig',
    readingMin: 3,
    sources: [
      {
        title:
          'Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre. EFSA Journal 2010;8(3):1462',
        publisher: 'European Food Safety Authority (EFSA)',
        url: 'https://doi.org/10.2903/j.efsa.2010.1462',
      },
      WHO_HEALTHY_DIET,
    ],
    text: {
      tr: {
        slug: 'lif-toklugun-sessiz-ortagi',
        title: 'Lif: tokluğun sessiz ortağı',
        excerpt: 'Günlük lif hedefi nedir, hangi besinlerde bulunur ve nasıl yavaşça artırılır?',
        body: `Lif, sindirilemeyen karbonhidratların genel adıdır. Bağırsak düzenini destekler ve öğünlerin daha doyurucu olmasına katkı sağlar.

## Ne kadar?

EFSA, yetişkinler için günde 25 gram lifi normal bağırsak işlevi için yeterli alım olarak belirtir. Birçok kişinin günlük alımı bunun altındadır.

## Nerede bulunur?

- Baklagiller: mercimek, nohut, kuru fasulye.
- Tam tahıllar: bulgur, yulaf, tam buğday ekmeği.
- Sebze ve meyveler: özellikle kabuklu tüketilenler.
- Kuruyemiş ve tohumlar: ceviz, badem, keten tohumu.

## Yavaş artır, su iç

Lifi bir anda artırmak şişkinlik yapabilir. Birkaç hafta içinde, adım adım artırmak ve bu sırada yeterince su içmek sindirim sistemine alışma zamanı tanır.

## Kolay değişiklikler

- Beyaz ekmek yerine tam buğday ekmeği.
- Haftada iki kez baklagil yemeği.
- Kahvaltıya yulaf ya da bir kaşık keten tohumu.
- Ara öğünde meyveyi kabuğuyla ye.

Bazı sindirim sistemi hastalıklarında lif önerileri farklıdır; böyle bir durumda hekimine ve diyetisyenine danış.`,
      },
      en: {
        slug: 'fibre-the-quiet-partner-of-fullness',
        title: 'Fibre: the quiet partner of fullness',
        excerpt:
          'What is the daily fibre target, where is it found, and how do you increase it gently?',
        body: `Fibre is the name for carbohydrates we can't digest. It supports regular bowel function and helps meals feel more filling.

## How much?

EFSA considers 25 grams of fibre a day adequate for normal bowel function in adults. Many people eat less than that.

## Where is it found?

- Legumes: lentils, chickpeas, beans.
- Whole grains: bulgur, oats, wholemeal bread.
- Vegetables and fruit: especially eaten with the skin.
- Nuts and seeds: walnuts, almonds, flaxseed.

## Increase slowly, drink water

Increasing fibre all at once can cause bloating. Stepping it up over a few weeks, while drinking enough water, gives your digestion time to adjust.

## Easy swaps

- Wholemeal bread instead of white.
- A legume dish twice a week.
- Oats or a spoonful of flaxseed at breakfast.
- Eat fruit with the skin at snack time.

With some digestive conditions fibre advice is different; in that case, talk to your doctor and dietitian.`,
      },
      fr: {
        slug: 'les-fibres-alliees-discretes-de-la-satiete',
        title: 'Les fibres, alliées discrètes de la satiété',
        excerpt: "Quel est l'objectif quotidien, où les trouver et comment augmenter en douceur ?",
        body: `Les fibres désignent les glucides que l'on ne digère pas. Elles soutiennent un transit régulier et rendent les repas plus rassasiants.

## Combien ?

L'EFSA considère que 25 grammes de fibres par jour constituent un apport adéquat pour un transit normal chez l'adulte. Beaucoup de gens en consomment moins.

## Où les trouver ?

- Légumineuses : lentilles, pois chiches, haricots.
- Céréales complètes : boulgour, avoine, pain complet.
- Légumes et fruits : surtout avec la peau.
- Oléagineux et graines : noix, amandes, lin.

## Augmente doucement, bois de l'eau

Augmenter les fibres d'un coup peut provoquer des ballonnements. Les augmenter sur quelques semaines, en buvant suffisamment, laisse à la digestion le temps de s'adapter.

## Changements faciles

- Du pain complet plutôt que du pain blanc.
- Un plat de légumineuses deux fois par semaine.
- De l'avoine ou une cuillère de graines de lin au petit-déjeuner.
- Le fruit avec sa peau à la collation.

Pour certaines maladies digestives, les conseils sur les fibres sont différents ; parle-en à ton médecin et à ton diététicien.`,
      },
      ar: {
        slug: 'al-alyaf-sharik-al-shaba',
        title: 'الألياف: الشريك الهادئ للشبع',
        excerpt: 'ما الهدف اليومي من الألياف، وأين توجد، وكيف نزيدها بهدوء؟',
        body: `الألياف اسم عام للكربوهيدرات التي لا نهضمها. وهي تدعم انتظام الأمعاء وتجعل الوجبات أكثر إشباعًا.

## كم نحتاج؟

تعدّ EFSA أن 25 غرامًا من الألياف يوميًا مدخول كافٍ لوظيفة الأمعاء الطبيعية لدى البالغين. ويتناول كثيرون أقل من ذلك.

## أين توجد؟

- البقوليات: العدس والحمّص والفاصوليا.
- الحبوب الكاملة: البرغل والشوفان وخبز القمح الكامل.
- الخضار والفواكه: خاصة حين تؤكل بقشرها.
- المكسرات والبذور: الجوز واللوز وبذور الكتان.

## زِد ببطء واشرب الماء

قد تسبب زيادة الألياف دفعة واحدة انتفاخًا. زيادتها تدريجيًا على مدى أسابيع مع شرب ما يكفي من الماء تمنح الجهاز الهضمي وقتًا للتكيّف.

## تغييرات سهلة

- خبز القمح الكامل بدل الخبز الأبيض.
- طبق بقوليات مرتين في الأسبوع.
- شوفان أو ملعقة بذور كتان في الفطور.
- تناول الفاكهة بقشرها في الوجبة الخفيفة.

في بعض أمراض الجهاز الهضمي تختلف توصيات الألياف؛ استشر طبيبك وأخصائي التغذية في هذه الحالة.`,
      },
    },
  },
  {
    key: 'legume_kitchen',
    category: 'kitchen',
    illustration: 'chickpea',
    readingMin: 3,
    sources: [TUBER, WHO_HEALTHY_DIET],
    text: {
      tr: {
        slug: 'baklagil-mutfagi',
        title: 'Baklagil mutfağı: ıslatma, haşlama, saklama',
        excerpt: 'Kuru baklagilleri haftalık rutine sokmanın pratik yolları.',
        body: `Baklagiller ucuz, doyurucu ve çok yönlüdür; hem bitkisel protein hem lif sağlarlar. Tek zorlukları hazırlık süresi, o da biraz planla çözülür.

## Islatma

Nohut ve kuru fasulyeyi bir gece önceden bol suda ıslat. Pişirmeden önce suyunu dök ve yeniden yıka. Kırmızı mercimek ve bulgur ıslatma gerektirmez.

## Haşlama

- Nohut ve kuru fasulye: tencerede 60–90 dakika, düdüklüde 20–30 dakika.
- Yeşil mercimek: 20–25 dakika.
- Kırmızı mercimek: 15–20 dakika, kolayca dağılır.

Tuzu pişmenin sonuna doğru ekle.

## Toplu pişir, porsiyonla

Hafta sonu bir tencere nohut ya da fasulye haşla. Soğuyunca suyuyla birlikte kaplara paylaştır: buzdolabında 3–4 gün, dondurucuda aylarca saklanır. Hafta içinde salataya, çorbaya ya da pilava bir avuç eklemek bir dakika sürer.

## Hazır konserveler

Kavanoz ya da kutu baklagiller de iyi bir seçenektir. Tuz içeriğini azaltmak için süzüp yıkaman yeterli.

Sindirimin hassassa küçük porsiyonlarla başla, yavaşça artır ve suyunu eksik etme.`,
      },
      en: {
        slug: 'the-legume-kitchen',
        title: 'The legume kitchen: soaking, cooking, storing',
        excerpt: 'Practical ways to fit dried legumes into your weekly routine.',
        body: `Legumes are cheap, filling and versatile, providing both plant protein and fibre. Their only hurdle is prep time, and a little planning solves that.

## Soaking

Soak chickpeas and dried beans overnight in plenty of water. Drain and rinse again before cooking. Red lentils and bulgur don't need soaking.

## Cooking

- Chickpeas and beans: 60–90 minutes in a pot, 20–30 minutes in a pressure cooker.
- Green lentils: 20–25 minutes.
- Red lentils: 15–20 minutes; they break down easily.

Add salt towards the end of cooking.

## Batch-cook and portion

Cook a pot of chickpeas or beans at the weekend. Once cool, divide them into containers with their cooking liquid: they keep 3–4 days in the fridge and for months in the freezer. During the week, adding a handful to a salad, soup or pilaf takes a minute.

## Jars and tins

Jarred or tinned legumes are a good option too. Draining and rinsing them reduces the salt.

If your digestion is sensitive, start with small portions, increase slowly and keep drinking water.`,
      },
      fr: {
        slug: 'la-cuisine-des-legumineuses',
        title: 'La cuisine des légumineuses : trempage, cuisson, conservation',
        excerpt: 'Des astuces pratiques pour intégrer les légumineuses sèches à la semaine.',
        body: `Les légumineuses sont économiques, rassasiantes et polyvalentes ; elles apportent protéines végétales et fibres. Leur seule difficulté, c'est le temps de préparation — un peu d'organisation suffit.

## Trempage

Fais tremper pois chiches et haricots secs la veille dans beaucoup d'eau. Égoutte et rince de nouveau avant la cuisson. Les lentilles corail et le boulgour n'ont pas besoin de trempage.

## Cuisson

- Pois chiches et haricots : 60 à 90 minutes en casserole, 20 à 30 minutes en autocuiseur.
- Lentilles vertes : 20 à 25 minutes.
- Lentilles corail : 15 à 20 minutes ; elles se défont facilement.

Sale en fin de cuisson.

## Cuire en grande quantité, portionner

Le week-end, fais cuire une casserole de pois chiches ou de haricots. Une fois refroidis, répartis-les dans des boîtes avec leur eau : 3 à 4 jours au réfrigérateur, plusieurs mois au congélateur. En semaine, en ajouter une poignée à une salade, une soupe ou un pilaf prend une minute.

## Bocaux et conserves

Les légumineuses en bocal ou en conserve sont aussi une bonne option. Les égoutter et les rincer réduit leur teneur en sel.

Si ta digestion est sensible, commence par de petites portions, augmente doucement et bois suffisamment.`,
      },
      ar: {
        slug: 'matbakh-al-buquliyat',
        title: 'مطبخ البقوليات: النقع والسلق والحفظ',
        excerpt: 'طرق عملية لإدخال البقوليات الجافة في روتينك الأسبوعي.',
        body: `البقوليات رخيصة ومُشبعة ومتعددة الاستخدامات، وتمنح البروتين النباتي والألياف معًا. صعوبتها الوحيدة وقت التحضير، ويحلّها قليل من التخطيط.

## النقع

انقع الحمّص والفاصوليا الجافة من الليلة السابقة في ماء وفير. تخلّص من ماء النقع واغسلها مجددًا قبل الطهي. العدس الأحمر والبرغل لا يحتاجان إلى نقع.

## السلق

- الحمّص والفاصوليا: 60–90 دقيقة في القدر، و20–30 دقيقة في قدر الضغط.
- العدس الأخضر: 20–25 دقيقة.
- العدس الأحمر: 15–20 دقيقة، ويتفتت بسهولة.

أضف الملح قرب نهاية الطهي.

## اطبخ كمية واحفظها حصصًا

في عطلة الأسبوع، اسلق قدرًا من الحمّص أو الفاصوليا. وحين يبرد، وزّعه في علب مع ماء سلقه: يُحفظ 3–4 أيام في الثلاجة وأشهرًا في المجمّد. وخلال الأسبوع، إضافة حفنة إلى سلطة أو شوربة أو أرز تستغرق دقيقة.

## المعلّبات

البقوليات المعلّبة أو في المرطبانات خيار جيد أيضًا. يكفي تصفيتها وغسلها لتقليل الملح.

إن كان هضمك حساسًا، فابدأ بحصص صغيرة، وزِد تدريجيًا، ولا تنسَ شرب الماء.`,
      },
    },
  },
];
