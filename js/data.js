/* QResto — données de démo (menu + traductions) */

const MENU = [
  { id: 'p1',  cat: 'pizza',    price: 900,  emoji: '🍕', name: { fr: 'Pizza Margherita',   ar: 'بيتزا مارغريتا',      en: 'Margherita Pizza' },   desc: { fr: 'Sauce tomate, mozzarella, basilic', ar: 'صلصة طماطم، موزاريلا، ريحان', en: 'Tomato sauce, mozzarella, basil' } },
  { id: 'p2',  cat: 'pizza',    price: 1200, emoji: '🍕', name: { fr: 'Pizza 4 Fromages',   ar: 'بيتزا أربع أجبان',     en: 'Four Cheese Pizza' },  desc: { fr: 'Mozzarella, gouda, edam, chèvre',   ar: 'موزاريلا، غودا، إيدام، جبن الماعز', en: 'Mozzarella, gouda, edam, goat cheese' } },
  { id: 'p3',  cat: 'pizza',    price: 1400, emoji: '🍕', name: { fr: 'Pizza Fruits de Mer', ar: 'بيتزا ثمار البحر',    en: 'Seafood Pizza' },      desc: { fr: 'Crevettes, calamars, thon',         ar: 'قريدس، حبار، تونة',              en: 'Shrimp, squid, tuna' } },

  { id: 'b1',  cat: 'burger',   price: 700,  emoji: '🍔', name: { fr: 'Burger Classique',   ar: 'برغر كلاسيك',          en: 'Classic Burger' },     desc: { fr: 'Steak, cheddar, salade, tomate',    ar: 'ستيك، شيدر، خس، طماطم',          en: 'Beef, cheddar, lettuce, tomato' } },
  { id: 'b2',  cat: 'burger',   price: 950,  emoji: '🍔', name: { fr: 'Double Cheese',      ar: 'دبل تشيز',             en: 'Double Cheese' },      desc: { fr: 'Double steak, double cheddar',      ar: 'ستيك مزدوج، شيدر مزدوج',         en: 'Double beef, double cheddar' } },
  { id: 'b3',  cat: 'burger',   price: 850,  emoji: '🍗', name: { fr: 'Chicken Burger',     ar: 'برغر دجاج',            en: 'Chicken Burger' },     desc: { fr: 'Poulet pané, sauce blanche',        ar: 'دجاج مقرمش، صلصة بيضاء',         en: 'Crispy chicken, white sauce' } },

  { id: 's1',  cat: 'sandwich', price: 600,  emoji: '🌯', name: { fr: 'Chawarma Poulet',    ar: 'شاورما دجاج',          en: 'Chicken Shawarma' },   desc: { fr: 'Poulet mariné, frites, sauce',      ar: 'دجاج متبل، بطاطا، صلصة',         en: 'Marinated chicken, fries, sauce' } },
  { id: 's2',  cat: 'sandwich', price: 750,  emoji: '🌮', name: { fr: 'Tacos Mixte',        ar: 'تاكوس مشكل',           en: 'Mixed Tacos' },        desc: { fr: 'Viande hachée, poulet, cheddar',    ar: 'لحم مفروم، دجاج، شيدر',          en: 'Ground beef, chicken, cheddar' } },
  { id: 's3',  cat: 'sandwich', price: 800,  emoji: '🍢', name: { fr: 'Brochettes Agneau',  ar: 'مشوي لحم الغنم',       en: 'Lamb Skewers' },       desc: { fr: 'Servi avec frites et salade',       ar: 'يقدم مع البطاطا والسلطة',        en: 'Served with fries and salad' } },

  { id: 'a1',  cat: 'salade',   price: 450,  emoji: '🥗', name: { fr: 'Salade César',       ar: 'سلطة سيزر',            en: 'Caesar Salad' },       desc: { fr: 'Poulet, parmesan, croûtons',        ar: 'دجاج، بارميزان، خبز محمص',       en: 'Chicken, parmesan, croutons' } },
  { id: 'a2',  cat: 'salade',   price: 350,  emoji: '🍟', name: { fr: 'Frites Maison',      ar: 'بطاطا مقلية',          en: 'House Fries' },        desc: { fr: 'Frites fraîches, sauce au choix',   ar: 'بطاطا طازجة، صلصة حسب الاختيار', en: 'Fresh fries, sauce of choice' } },

  { id: 'd1',  cat: 'boisson',  price: 150,  emoji: '🥤', name: { fr: 'Soda 33cl',          ar: 'مشروب غازي ٣٣ سل',     en: 'Soda 33cl' },          desc: { fr: 'Coca, Fanta, Sprite',               ar: 'كوكا، فانتا، سبرايت',            en: 'Coke, Fanta, Sprite' } },
  { id: 'd2',  cat: 'boisson',  price: 100,  emoji: '💧', name: { fr: 'Eau minérale',       ar: 'ماء معدني',            en: 'Mineral Water' },      desc: { fr: 'Bouteille 50cl',                    ar: 'قارورة ٥٠ سل',                   en: '50cl bottle' } },
  { id: 'd3',  cat: 'boisson',  price: 250,  emoji: '🧃', name: { fr: 'Jus d\'orange frais', ar: 'عصير برتقال طازج',    en: 'Fresh Orange Juice' }, desc: { fr: 'Pressé à la minute',                ar: 'معصور في الحين',                 en: 'Freshly squeezed' } },

  { id: 'x1',  cat: 'dessert',  price: 400,  emoji: '🍰', name: { fr: 'Tiramisu',           ar: 'تيراميسو',             en: 'Tiramisu' },           desc: { fr: 'Mascarpone, café, cacao',           ar: 'ماسكاربوني، قهوة، كاكاو',        en: 'Mascarpone, coffee, cocoa' } },
  { id: 'x2',  cat: 'dessert',  price: 300,  emoji: '🍮', name: { fr: 'Crème caramel',      ar: 'كريم كراميل',          en: 'Crème Caramel' },      desc: { fr: 'Fait maison',                       ar: 'صنع منزلي',                      en: 'Homemade' } },
];

const CATEGORIES = [
  { id: 'all',      emoji: '🍽️', label: { fr: 'Tout',      ar: 'الكل',       en: 'All' } },
  { id: 'pizza',    emoji: '🍕', label: { fr: 'Pizzas',    ar: 'بيتزا',      en: 'Pizzas' } },
  { id: 'burger',   emoji: '🍔', label: { fr: 'Burgers',   ar: 'برغر',       en: 'Burgers' } },
  { id: 'sandwich', emoji: '🌯', label: { fr: 'Sandwichs', ar: 'ساندويتش',   en: 'Sandwiches' } },
  { id: 'salade',   emoji: '🥗', label: { fr: 'À côté',    ar: 'مقبلات',     en: 'Sides' } },
  { id: 'boisson',  emoji: '🥤', label: { fr: 'Boissons',  ar: 'مشروبات',    en: 'Drinks' } },
  { id: 'dessert',  emoji: '🍰', label: { fr: 'Desserts',  ar: 'حلويات',     en: 'Desserts' } },
];

const I18N = {
  fr: {
    dir: 'ltr',
    table: 'Table', menu: 'Menu', cart: 'Ma commande', empty: 'Votre panier est vide',
    add: 'Ajouter', total: 'Total', send: 'Envoyer la commande', note: 'Une remarque ? (sans oignons, bien cuit…)',
    sent: 'Commande envoyée !', eta: 'Prête dans environ', min: 'min',
    payInfo: 'Vous payez en caisse avant de partir.', orderNo: 'Commande N°',
    newOrder: 'Passer une autre commande', status: 'Statut',
    st_nouvelle: 'Reçue', st_cuisine: 'En préparation', st_prete: 'Prête', st_payee: 'Payée',
    items: 'articles', da: 'DA',
  },
  ar: {
    dir: 'rtl',
    table: 'طاولة', menu: 'القائمة', cart: 'طلبي', empty: 'سلتك فارغة',
    add: 'أضف', total: 'المجموع', send: 'إرسال الطلب', note: 'ملاحظة؟ (بدون بصل، مطهو جيدا…)',
    sent: 'تم إرسال الطلب!', eta: 'جاهز خلال حوالي', min: 'دقيقة',
    payInfo: 'الدفع في الصندوق قبل المغادرة.', orderNo: 'طلب رقم',
    newOrder: 'طلب جديد', status: 'الحالة',
    st_nouvelle: 'مستلم', st_cuisine: 'قيد التحضير', st_prete: 'جاهز', st_payee: 'مدفوع',
    items: 'عناصر', da: 'دج',
  },
  en: {
    dir: 'ltr',
    table: 'Table', menu: 'Menu', cart: 'My order', empty: 'Your cart is empty',
    add: 'Add', total: 'Total', send: 'Send order', note: 'Any note? (no onions, well done…)',
    sent: 'Order sent!', eta: 'Ready in about', min: 'min',
    payInfo: 'Please pay at the counter before leaving.', orderNo: 'Order #',
    newOrder: 'Place another order', status: 'Status',
    st_nouvelle: 'Received', st_cuisine: 'Preparing', st_prete: 'Ready', st_payee: 'Paid',
    items: 'items', da: 'DA',
  },
};

const RESTO = { name: 'QResto Démo', city: 'Aïn Benian, Alger', tables: 12 };
