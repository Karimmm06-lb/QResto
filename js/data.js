/* QResto — libellés de l'interface.

   Le menu (plats, prix, déclinaisons) ne vit plus ici : il est en base et
   géré par le restaurant. Ce fichier ne contient plus que les textes de
   l'interface, dans les trois langues (BNF5). */

const I18N = {
  fr: {
    dir: 'ltr',
    table: 'Table', cart: 'Ma commande', empty: 'Votre panier est vide',
    total: 'Total', send: 'Envoyer la commande',
    note: 'Une remarque ? (sans oignons, bien cuit…)',
    votreNom: 'Votre prénom',
    sent: 'Commande envoyée !', eta: 'Prête dans', min: 'min',
    payInfo: 'Vous payez en caisse avant de partir.', orderNo: 'Commande N°',
    newOrder: 'Passer une autre commande', status: 'Statut', epuise: 'Épuisé',
    st_nouvelle: 'Reçue', st_cuisine: 'En préparation', st_prete: 'Prête',
    st_servie: 'Servie', st_annulee: 'Annulée',
    items: 'articles', da: 'DA',
  },
  ar: {
    dir: 'rtl',
    table: 'طاولة', cart: 'طلبي', empty: 'سلتك فارغة',
    total: 'المجموع', send: 'إرسال الطلب',
    note: 'ملاحظة؟ (بدون بصل، مطهو جيدا…)',
    votreNom: 'اسمك',
    sent: 'تم إرسال الطلب!', eta: 'جاهز خلال', min: 'دقيقة',
    payInfo: 'الدفع في الصندوق قبل المغادرة.', orderNo: 'طلب رقم',
    newOrder: 'طلب جديد', status: 'الحالة', epuise: 'نفد',
    st_nouvelle: 'مستلم', st_cuisine: 'قيد التحضير', st_prete: 'جاهز',
    st_servie: 'تم التقديم', st_annulee: 'ملغى',
    items: 'عناصر', da: 'دج',
  },
  en: {
    dir: 'ltr',
    table: 'Table', cart: 'My order', empty: 'Your cart is empty',
    total: 'Total', send: 'Send order',
    note: 'Any note? (no onions, well done…)',
    votreNom: 'Your first name',
    sent: 'Order sent!', eta: 'Ready in', min: 'min',
    payInfo: 'Please pay at the counter before leaving.', orderNo: 'Order #',
    newOrder: 'Place another order', status: 'Status', epuise: 'Sold out',
    st_nouvelle: 'Received', st_cuisine: 'Preparing', st_prete: 'Ready',
    st_servie: 'Served', st_annulee: 'Cancelled',
    items: 'items', da: 'DA',
  },
};
