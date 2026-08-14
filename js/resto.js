/* Page publique du restaurant : vitrine ET point d'atterrissage du QR de table.

   Un seul fichier gère les deux entrées :
     • lien direct (?r=slug)      → mode à distance uniquement (emporter/livraison)
     • scan du QR (?t=jeton)      → mode sur place + à distance si activés
   Le contexte est déterminé au démarrage : si un jeton est présent, on charge
   la carte via `vitrine_par_jeton` (qui renvoie aussi le numéro de table) ;
   sinon on tombe sur `vitrine(slug)` comme avant.

   Trois vues successives dans la même page :
     vitrine       → la carte en consultation + boutons de commande
     commande      → la même carte, mais avec des boutons d'ajout
     coordonnees   → le formulaire (allégé pour sur place : ni tel, ni adresse)
     confirmation  → le récapitulatif                                            */

const params = new URLSearchParams(location.search);
const slug    = params.get('r');
const qrToken = params.get('t');

let resto = null;
let tableNumero = null;
let vue = 'vitrine';
let mode = null;
let panier = {};
let cleEnvoi = null;

// Langue courante : préférence stockée > paramètre URL > navigateur > FR.
// L'arabe passe le document en RTL.
const LANGUES = ['fr', 'ar', 'en'];
function langueInitiale() {
  const stockee = localStorage.getItem('qresto.lang');
  if (stockee && LANGUES.includes(stockee)) return stockee;
  const p = params.get('lang');
  if (p && LANGUES.includes(p)) return p;
  const navL = (navigator.language || 'fr').slice(0, 2);
  return LANGUES.includes(navL) ? navL : 'fr';
}
let lang = langueInitiale();

// Traductions des libellés d'interface. La carte elle-même vient de la base
// (nom_fr / nom_ar / nom_en, pareil pour les descriptions et les variantes).
const T = {
  fr: {
    bienvenueTable: n => `Bienvenue à votre table N° ${n}`,
    invitSurPlace: 'Composez votre commande depuis votre téléphone.<br>Vous paierez au comptoir à la fin du service.',
    commanderEnLigne: 'Commander en ligne',
    invitDistance: 'Vous réglez au retrait ou à la livraison.<br>Nous vous appelons pour confirmer.',
    commanderTable: 'Commandez à table',
    invitScan: 'Scannez le QR code posé sur votre table :<br>la carte s\'ouvre sur votre téléphone.',
    surPlaceBtn: n => `Sur place — Table ${n}`,
    aEmporterBtn: 'À emporter',
    livraisonBtn: 'Livraison',
    epuise: 'Épuisé',
    piedCarte: 'Carte tenue à jour par le restaurant.',
    votreCommande: 'Votre commande',
    vosCoordonnees: 'Vos coordonnées',
    nomPh: 'Votre nom',
    telPh: 'Votre téléphone',
    adressePh: 'Votre adresse — rue, immeuble, étage',
    notePh: 'Une remarque ?',
    desQuePossible: 'Dès que possible',
    envoyerCuisine: 'Envoyer à la cuisine',
    continuer: 'Continuer',
    envoyerCommande: 'Envoyer la commande',
    articles: n => `${n} article${n > 1 ? 's' : ''}`,
    envoi: 'Envoi…',
    confirmSurPlace: 'Commande envoyée en cuisine',
    confirmDistance: 'Commande envoyée',
    commandeN: 'Commande N°',
    total: 'Total',
    sousTotal: 'Sous-total',
    livraisonLigne: 'Livraison',
    retourCarte: 'Retour à la carte',
    reglezRetrait: 'Vous réglez au comptoir en fin de service.',
    reglezLivraison: 'Vous réglez au livreur.',
    reglezEmporter: 'Vous réglez au comptoir, au retrait.',
    frais: 'Frais de livraison',
    avisLivraison: 'Les viandes, glaces et boissons chaudes ne sont pas proposées en livraison.',
    ajouteAuPanier: nom => `${nom} ajouté au panier`,
    mentionsLegales: 'Mentions légales',
    contact: 'Contact',
    propulse: 'Propulsé par',
  },
  ar: {
    bienvenueTable: n => `مرحباً بكم على طاولتكم رقم ${n}`,
    invitSurPlace: 'اطلبوا من هاتفكم.<br>الدفع عند المحاسبة في نهاية الخدمة.',
    commanderEnLigne: 'اطلب عبر الإنترنت',
    invitDistance: 'الدفع عند الاستلام أو التوصيل.<br>سنتصل بكم للتأكيد.',
    commanderTable: 'اطلب من الطاولة',
    invitScan: 'امسحوا رمز QR الموجود على طاولتكم:<br>ستفتح القائمة على هاتفكم.',
    surPlaceBtn: n => `في المطعم — طاولة ${n}`,
    aEmporterBtn: 'للأخذ',
    livraisonBtn: 'توصيل',
    epuise: 'نفدت الكمية',
    piedCarte: 'قائمة يحدّثها المطعم.',
    votreCommande: 'طلبكم',
    vosCoordonnees: 'بياناتكم',
    nomPh: 'الاسم',
    telPh: 'رقم الهاتف',
    adressePh: 'العنوان — الشارع، العمارة، الطابق',
    notePh: 'ملاحظة؟',
    desQuePossible: 'في أقرب وقت ممكن',
    envoyerCuisine: 'إرسال إلى المطبخ',
    continuer: 'متابعة',
    envoyerCommande: 'إرسال الطلب',
    articles: n => `${n} صنف${n > 1 ? '' : ''}`,
    envoi: '...جارٍ الإرسال',
    confirmSurPlace: 'أُرسل الطلب إلى المطبخ',
    confirmDistance: 'أُرسل الطلب',
    commandeN: 'الطلب رقم',
    total: 'المجموع',
    sousTotal: 'المجموع الفرعي',
    livraisonLigne: 'التوصيل',
    retourCarte: 'العودة إلى القائمة',
    reglezRetrait: 'الدفع عند المحاسبة في نهاية الخدمة.',
    reglezLivraison: 'الدفع لعامل التوصيل.',
    reglezEmporter: 'الدفع عند الاستلام في المحاسبة.',
    frais: 'رسوم التوصيل',
    avisLivraison: 'اللحوم والمثلجات والمشروبات الساخنة غير متوفرة للتوصيل.',
    ajouteAuPanier: nom => `تمت إضافة ${nom} إلى السلة`,
    mentionsLegales: 'الإشعارات القانونية',
    contact: 'اتصال',
    propulse: 'مدعوم من',
  },
  en: {
    bienvenueTable: n => `Welcome to table N° ${n}`,
    invitSurPlace: 'Place your order from your phone.<br>Pay at the counter at the end of your meal.',
    commanderEnLigne: 'Order online',
    invitDistance: 'Pay on pickup or delivery.<br>We\'ll call you to confirm.',
    commanderTable: 'Order at your table',
    invitScan: 'Scan the QR code on your table:<br>the menu opens on your phone.',
    surPlaceBtn: n => `Dine in — Table ${n}`,
    aEmporterBtn: 'Takeaway',
    livraisonBtn: 'Delivery',
    epuise: 'Sold out',
    piedCarte: 'Menu maintained by the restaurant.',
    votreCommande: 'Your order',
    vosCoordonnees: 'Your details',
    nomPh: 'Your name',
    telPh: 'Your phone',
    adressePh: 'Your address — street, building, floor',
    notePh: 'Any note?',
    desQuePossible: 'As soon as possible',
    envoyerCuisine: 'Send to the kitchen',
    continuer: 'Continue',
    envoyerCommande: 'Send the order',
    articles: n => `${n} item${n > 1 ? 's' : ''}`,
    envoi: 'Sending…',
    confirmSurPlace: 'Order sent to the kitchen',
    confirmDistance: 'Order sent',
    commandeN: 'Order N°',
    total: 'Total',
    sousTotal: 'Subtotal',
    livraisonLigne: 'Delivery',
    retourCarte: 'Back to menu',
    reglezRetrait: 'Pay at the counter at the end of your meal.',
    reglezLivraison: 'Pay the delivery driver.',
    reglezEmporter: 'Pay at the counter on pickup.',
    frais: 'Delivery fee',
    avisLivraison: 'Meat dishes, ice cream and hot drinks are not offered for delivery.',
    ajouteAuPanier: nom => `${nom} added to cart`,
    mentionsLegales: 'Legal notice',
    contact: 'Contact',
    propulse: 'Powered by',
  },
};
const tr = () => T[lang];

// Résout la valeur multilingue d'un champ (nom, description, libellé).
// Retombe sur le français si la traduction manque.
const ml = (obj, champ) => obj?.[`${champ}_${lang}`] || obj?.[`${champ}_fr`] || '';

function appliquerLangue() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const $ = s => document.querySelector(s);
const page = () => $('#page');

const PHOTO_CAT = [
  [/viande/i,                'img/viandes.jpg'],
  [/pâte|pate|pasta/i,       'img/pates.jpg'],
  [/burger/i,                'img/burgers.jpg'],
  [/jus|mocktail/i,          'img/boissons.jpg'],
  [/glace|gelato/i,          'img/glaces.jpg'],
];
const PHOTOS_UTILISEES = new Set();
const photoCategorie = nom => {
  const src = (PHOTO_CAT.find(([re]) => re.test(nom)) || [])[1];
  if (!src || PHOTOS_UTILISEES.has(src)) return null;
  PHOTOS_UTILISEES.add(src);
  return src;
};

// Aplatit la carte reçue (multilingue) sur la langue courante : chaque
// catégorie/plat/variante gagne .nom, .description, .libelle. Rappelée quand
// l'utilisateur change de langue — la carte se rerend sans nouveau fetch.
function normaliserCarte() {
  if (!resto?.carte) return;
  resto.carte.forEach(c => {
    c.nom = ml(c, 'nom');
    c.plats.forEach(p => {
      p.nom = ml(p, 'nom');
      p.description = ml(p, 'desc');
      (p.prix || []).forEach(v => { v.libelle = ml(v, 'libelle') || 'Standard'; });
    });
  });
}

// ------------------------------------------------------------------ outils
function plats() {
  return resto.carte.flatMap(c => c.plats.map(p => ({ ...p, categorie: c.nom })));
}

// En sur place, tous les plats sont commandables. En livraison, la base
// refuse les non-livrables ; on les masque pour éviter l'erreur inutile.
function commandables() {
  return resto.carte
    .map(c => ({
      ...c,
      plats: c.plats.filter(p =>
        p.disponible && (mode === 'livraison' ? p.livrable : true)),
    }))
    .filter(c => c.plats.length);
}

const lignes = () => Object.entries(panier)
  .filter(([, l]) => l.qty > 0)
  .map(([id, l]) => ({ id, ...l }));

const sousTotal = () => lignes().reduce((s, l) => s + l.prix * l.qty, 0);
const nbArticles = () => lignes().reduce((s, l) => s + l.qty, 0);

const zone = () => resto.zones.find(z => z.id === $('#zone')?.value);
const frais = () => (mode === 'livraison' && zone()) ? Number(zone().frais) : 0;
const total = () => sousTotal() + frais();

const nomMode = () => ({
  sur_place:  `${lang === 'ar' ? 'طاولة' : 'Table'} ${tableNumero}`,
  a_emporter: tr().aEmporterBtn,
  livraison:  tr().livraisonBtn,
})[mode] || '';

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { b.style.display = 'none'; }, 7000);
}

// Bandeau flottant discret pour les confirmations positives.
// Programmé pour ne jamais empiler : un nouveau message remplace l'ancien.
let toastTimer = null;
function toast(message) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 1800);
}

function creneaux() {
  const out = [`<option value="">${tr().desQuePossible}</option>`];
  const d = new Date(Date.now() + resto.delai_min_minutes * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const fin = new Date(); fin.setHours(23, 45, 0, 0);
  while (d <= fin) {
    const h = d.toTimeString().slice(0, 5);
    out.push(`<option value="${d.toISOString()}">${h}</option>`);
    d.setMinutes(d.getMinutes() + 15);
  }
  return out.join('');
}

// ---------------------------------------------------------------- vitrine
function rendreVitrine() {
  const liens = [
    resto.telephone && `<a class="btn" href="tel:${resto.telephone.replace(/\s/g,'')}">${resto.telephone}</a>`,
    resto.facebook && `<a class="btn ghost" href="${resto.facebook}" target="_blank" rel="noopener">Facebook</a>`,
    resto.instagram && `<a class="btn ghost" href="${resto.instagram}" target="_blank" rel="noopener">Instagram</a>`,
  ].filter(Boolean).join('');

  // Les 3 modes de commande. Sur place n'apparaît que si un QR a été scanné.
  const boutons = [
    qrToken && `<button class="btn" data-mode="sur_place">${tr().surPlaceBtn(tableNumero)}</button>`,
    resto.emporter_actif && `<button class="btn" data-mode="a_emporter">${tr().aEmporterBtn}</button>`,
    resto.livraison_active && `<button class="btn" data-mode="livraison">${tr().livraisonBtn}</button>`,
  ].filter(Boolean).join('');

  // Sélecteur de langue en haut à droite. Cliqué : bascule + re-normalise + rerend.
  const selecteurLang = LANGUES.map(L => `
    <button class="lang-btn ${L === lang ? 'actif' : ''}" data-lang="${L}"
      aria-pressed="${L === lang}">${L.toUpperCase()}</button>`).join('');

  const bandeauCommander = qrToken ? `
    <div class="vqr reveal">
      <strong>${tr().bienvenueTable(tableNumero)}</strong>
      <p>${tr().invitSurPlace}</p>
      <div class="vliens">${boutons}</div>
    </div>` : (boutons ? `
    <div class="vqr reveal">
      <strong>${tr().commanderEnLigne}</strong>
      <p>${tr().invitDistance}</p>
      <div class="vliens">${boutons}</div>
    </div>` : `
    <div class="vqr reveal">
      <strong>${tr().commanderTable}</strong>
      <p>${tr().invitScan}</p>
    </div>`);

  const numero = nom => {
    const m = /^\s*(\d+)\s*[·.\-–—]/.exec(nom || '');
    return m ? parseInt(m[1], 10) : null;
  };
  resto.carte.forEach(c => {
    if (c.plats.some(p => numero(p.nom) !== null)) {
      c.plats = [
        ...c.plats.filter(p => numero(p.nom) !== null)
                  .sort((a, b) => numero(a.nom) - numero(b.nom)),
        ...c.plats.filter(p => numero(p.nom) === null),
      ];
    }
  });

  const carte = resto.carte.map(c => {
    const photo = photoCategorie(c.nom);
    return `
    <section class="vcat reveal">
      ${photo ? `<img class="vcat-photo" src="${photo}" alt="${c.nom}" loading="lazy">` : ''}
      <h2>${c.nom}</h2>
      ${c.plats.map(p => `
        <div class="vplat ${p.disponible ? '' : 'epuise'}">
          <div class="vplat-tete">
            <span class="vnom">${p.nom}${p.disponible ? '' : ` <span class="chip payee">${tr().epuise}</span>`}</span>
            <span class="lead"></span>
            <span class="vprix">${(p.prix||[]).map(v =>
              `<span class="p">${v.libelle !== 'Standard' ? `<i>${v.libelle}</i> ` : ''}${fmt.prix(v.montant)}</span>`
            ).join('')}</span>
          </div>
          ${p.description ? `<div class="vdesc">${p.description}</div>` : ''}
        </div>`).join('')}
    </section>`;
  }).join('');

  page().innerHTML = `
    <div id="erreur" class="alerte"></div>
    <div class="selecteur-lang" role="group" aria-label="Langue">${selecteurLang}</div>
    <header class="vhero">
      <div class="kicker">${resto.ville || ''}</div>
      <h1>${resto.nom}</h1>
      <div class="vfiletor"><span>✦</span></div>
      ${resto.slogan ? `<p class="vslogan">${resto.slogan}</p>` : ''}
      <p class="vinfo">
        ${resto.adresse ? `${resto.adresse}` : ''}
        ${resto.horaires ? `<br>${resto.horaires}` : ''}
      </p>
      <div class="vliens">${liens}</div>
      <div class="vscroll">⌄</div>
    </header>

    ${bandeauCommander}

    <div class="wrap narrow">${carte}
      <p class="vpied">${tr().piedCarte}</p>
    </div>

    <footer class="vfooter">
      <div class="vfooter-inner">
        <div class="vfooter-marque">
          <div class="vfooter-nom">${resto.nom}</div>
          <div class="vfooter-adresse">
            ${resto.adresse || ''}${resto.telephone ? `<br>${resto.telephone}` : ''}
          </div>
        </div>
        <nav class="vfooter-liens" aria-label="Pied de page">
          <a href="mentions-legales.html">${tr().mentionsLegales}</a>
          <a href="tel:${(resto.telephone||'').replace(/\s/g,'')}">${tr().contact}</a>
          ${resto.facebook ? `<a href="${resto.facebook}" target="_blank" rel="noopener">Facebook</a>` : ''}
          ${resto.instagram ? `<a href="${resto.instagram}" target="_blank" rel="noopener">Instagram</a>` : ''}
        </nav>
        <div class="vfooter-tech">
          ${tr().propulse} <strong>QResto</strong>
        </div>
      </div>
    </footer>`;

  const hero = document.querySelector('.vhero');
  if (hero) hero.style.backgroundImage = "url('img/hero.jpg')";

  animerAuScroll();
}

function animerAuScroll() {
  const cibles = document.querySelectorAll('.vitrine .reveal');
  if (!('IntersectionObserver' in window)) {
    cibles.forEach(el => el.classList.add('vu'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('vu'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  cibles.forEach(el => io.observe(el));
}

// --------------------------------------------------------------- commande
function rendreCommande() {
  const cats = commandables();
  const avis = mode === 'livraison'
    ? `<p class="sub" style="margin-top:14px">${tr().avisLivraison}</p>`
    : '';

  page().innerHTML = `
    <div id="erreur" class="alerte"></div>
    <header class="topbar">
      <button class="btn sm ghost" id="retour">←</button>
      <div class="brand">${resto.nom}</div>
      <div class="spacer"></div>
      <span class="badge">${nomMode()}</span>
    </header>
    <main class="wrap narrow">
      ${avis}
      ${cats.map(c => `
        <section class="vcat">
          <h2>${c.nom}</h2>
          ${c.plats.map(p => `
            <div class="card dish" style="margin-bottom:8px">
              <div class="entete"><div class="info">
                <div class="name">${p.nom}</div>
                ${p.description ? `<div class="desc">${p.description}</div>` : ''}
              </div></div>
              <div class="variantes">${(p.prix||[]).map(v => {
                const q = panier[v.id]?.qty || 0;
                return `<div class="vrow" style="padding-left:0">
                  ${v.libelle !== 'Standard' ? `<span class="vlbl">${v.libelle}</span>` : ''}
                  <span class="vprix">${fmt.prix(v.montant)}</span>
                  <span class="qty">
                    ${q > 0 ? `<button data-moins="${v.id}">−</button><span class="n">${q}</span>` : ''}
                    <button class="plus" data-plus="${v.id}"
                      data-nom="${p.nom}${v.libelle !== 'Standard' ? ` (${v.libelle})` : ''}"
                      data-prix="${v.montant}">+</button>
                  </span></div>`;
              }).join('')}</div>
            </div>`).join('')}
        </section>`).join('')}
    </main>
    <div class="cartbar" id="cartbar" style="display:none">
      <div class="inner">
        <div><div class="cnt" id="cnt"></div><div class="tot" id="tot"></div></div>
        <div class="spacer"></div>
        <button class="btn" id="suite">${mode === 'sur_place' ? tr().envoyerCuisine : tr().continuer}</button>
      </div>
    </div>`;
  majBarre();
}

function majBarre() {
  const n = nbArticles();
  const bar = $('#cartbar');
  if (!bar) return;
  bar.style.display = n ? 'block' : 'none';
  $('#cnt').textContent = tr().articles(n);
  $('#tot').textContent = fmt.prix(sousTotal());
}

// ------------------------------------------------------------ coordonnées
// En sur place, ce formulaire n'est pas affiché : la commande part directement.
// On saute donc la vue coordonnees et on appelle envoyer() depuis la barre.
function rendreCoordonnees() {
  const L = lignes();
  const zonesOpt = resto.zones.map(z =>
    `<option value="${z.id}">${z.nom} — ${fmt.prix(z.frais)}${
      Number(z.minimum) > 0 ? ` · min. ${fmt.prix(z.minimum)}` : ''}</option>`).join('');

  page().innerHTML = `
    <div id="erreur" class="alerte"></div>
    <header class="topbar">
      <button class="btn sm ghost" id="retour">←</button>
      <div class="brand">${resto.nom}</div>
      <div class="spacer"></div>
      <span class="badge">${nomMode()}</span>
    </header>
    <main class="wrap narrow">
      <h1>${tr().votreCommande}</h1>
      <div class="card">
        ${L.map(l => `<div class="bar"><span class="lbl" style="flex:1">${l.qty} × ${l.nom}</span>
          <span class="n" style="flex:0 0 auto">${fmt.prix(l.prix * l.qty)}</span></div>`).join('')}
        <div class="bar" id="ligneFrais" style="display:none">
          <span class="lbl" style="flex:1">${tr().frais}</span>
          <span class="n" style="flex:0 0 auto" id="montantFrais"></span>
        </div>
        <div class="bar" style="border-top:1px solid var(--bord);padding-top:8px;margin-top:8px">
          <span class="lbl" style="flex:1;font-weight:800">${tr().total}</span>
          <span class="n" style="flex:0 0 auto;font-weight:800;font-size:16px" id="totalFinal"></span>
        </div>
      </div>

      <h2>${tr().vosCoordonnees}</h2>
      <div class="card">
        <input id="nom" placeholder="${tr().nomPh}" maxlength="40" style="margin-bottom:9px">
        <input id="tel" type="tel" placeholder="${tr().telPh}" maxlength="20" style="margin-bottom:9px">
        ${mode === 'livraison' ? `
          <select id="zone" style="margin-bottom:9px">${zonesOpt}</select>
          <textarea id="adresse" rows="2" placeholder="${tr().adressePh}"
            style="margin-bottom:9px"></textarea>` : ''}
        <select id="creneau" style="margin-bottom:9px">${creneaux()}</select>
        <textarea id="note" rows="2" placeholder="${tr().notePh}"></textarea>
      </div>

      <p class="sub" style="margin-top:14px">
        ${mode === 'livraison' ? tr().reglezLivraison : tr().reglezEmporter}
      </p>
      <button class="btn wide" id="envoyer">${tr().envoyerCommande}</button>
    </main>`;

  $('#nom').value = localStorage.getItem('qresto.nom') || '';
  $('#tel').value = localStorage.getItem('qresto.tel') || '';
  majTotaux();
}

function majTotaux() {
  if (!$('#totalFinal')) return;
  const f = frais();
  $('#ligneFrais').style.display = f ? '' : 'none';
  if (f) $('#montantFrais').textContent = fmt.prix(f);
  $('#totalFinal').textContent = fmt.prix(sousTotal() + f);
}

// ----------------------------------------------------------- confirmation
function rendreConfirmation(cmd) {
  const titre = mode === 'sur_place' ? tr().confirmSurPlace : tr().confirmDistance;
  const message = mode === 'sur_place'
    ? tr().reglezRetrait
    : (mode === 'livraison' ? tr().reglezLivraison : tr().reglezEmporter);

  const totalAffiche = cmd.total ?? cmd.sous_total ?? sousTotal();
  const sousTotalCmd = cmd.sous_total ?? totalAffiche;
  const fraisCmd = Number(cmd.frais_livraison || 0);

  page().innerHTML = `
    <main class="wrap narrow">
      <div class="card" style="text-align:center;margin-top:40px">
        <div class="vsceau">✦</div>
        <h1 style="margin-top:8px">${titre}</h1>
        <p class="sub">${tr().commandeN} ${cmd.numero}</p>
        <div class="badge" style="font-size:15px;padding:10px 16px">${nomMode()}</div>
        <div style="border-top:1px dashed var(--bord);margin-top:18px;padding-top:12px">
          ${mode !== 'sur_place' ? `
            <div class="bar"><span class="lbl" style="flex:1">${tr().sousTotal}</span>
              <span class="n" style="flex:0 0 auto">${fmt.prix(sousTotalCmd)}</span></div>
            ${fraisCmd ? `<div class="bar">
              <span class="lbl" style="flex:1">${tr().livraisonLigne}</span>
              <span class="n" style="flex:0 0 auto">${fmt.prix(fraisCmd)}</span></div>` : ''}` : ''}
          <div class="bar"><span class="lbl" style="flex:1;font-weight:800">${tr().total}</span>
            <span class="n" style="flex:0 0 auto;font-weight:800">${fmt.prix(totalAffiche)}</span></div>
        </div>
        <p class="sub" style="margin-top:18px">${message}</p>
        <button class="btn ghost wide" id="retourAccueil">${tr().retourCarte}</button>
      </div>
    </main>`;
}

// -------------------------------------------------------------- interactions
document.addEventListener('click', async e => {
  const btnLang = e.target.closest('[data-lang]');
  if (btnLang) {
    const nv = btnLang.dataset.lang;
    if (LANGUES.includes(nv) && nv !== lang) {
      lang = nv;
      localStorage.setItem('qresto.lang', lang);
      appliquerLangue();
      normaliserCarte();
      // Re-rendre la vue courante en gardant l'état (panier, mode, vue).
      const vues = { vitrine: rendreVitrine, commande: rendreCommande,
                     coordonnees: rendreCoordonnees };
      (vues[vue] || rendreVitrine)();
    }
    return;
  }

  const m = e.target.closest('[data-mode]');
  const plus = e.target.closest('[data-plus]');
  const moins = e.target.closest('[data-moins]');

  if (m) { mode = m.dataset.mode; panier = {}; vue = 'commande'; rendreCommande(); window.scrollTo(0,0); }

  if (plus) {
    const id = plus.dataset.plus;
    panier[id] = panier[id] || { qty: 0, nom: plus.dataset.nom, prix: Number(plus.dataset.prix) };
    panier[id].qty++;
    toast(tr().ajouteAuPanier(plus.dataset.nom));
    rendreCommande();
  }
  if (moins) {
    const id = moins.dataset.moins;
    panier[id].qty--;
    if (panier[id].qty <= 0) delete panier[id];
    rendreCommande();
  }

  if (e.target.closest('#retour')) {
    if (vue === 'coordonnees') { vue = 'commande'; rendreCommande(); }
    else { vue = 'vitrine'; panier = {}; rendreVitrine(); }
    window.scrollTo(0, 0);
  }
  if (e.target.closest('#suite')) {
    // En sur place, aucune coordonnée à demander : on envoie directement.
    if (mode === 'sur_place') { await envoyer(e.target.closest('#suite')); }
    else { vue = 'coordonnees'; rendreCoordonnees(); window.scrollTo(0,0); }
  }
  if (e.target.closest('#retourAccueil')) { vue = 'vitrine'; panier = {}; cleEnvoi = null; rendreVitrine(); }
  if (e.target.closest('#envoyer')) await envoyer(e.target.closest('#envoyer'));
});

document.addEventListener('change', e => { if (e.target.id === 'zone') majTotaux(); });

async function envoyer(bouton) {
  bouton = bouton || $('#envoyer') || $('#suite');
  // Feedback pendant l'appel réseau : bouton verrouillé, libellé remplacé
  // par un indicateur en train de charger. Sur un réseau lent (edge Algérie
  // à midi), le silence entre le clic et la confirmation inquiète.
  let libelleOrig = null;
  if (bouton) {
    libelleOrig = bouton.textContent;
    bouton.disabled = true;
    bouton.classList.add('en-cours');
    bouton.innerHTML = '<span class="spinner" aria-hidden="true"></span> Envoi…';
  }
  if (!cleEnvoi) cleEnvoi = crypto.randomUUID();

  try {
    let cmd;
    const lignesPanier = lignes().map(l => ({ variante_id: l.id, quantite: l.qty }));

    if (mode === 'sur_place') {
      // Parcours QR : nom du convive optionnel, aucune coordonnée.
      const nomStocke = localStorage.getItem('qresto.nom') || null;
      cmd = await Store.creerCommande({
        qrToken,
        lignes: lignesPanier,
        nom: nomStocke,
        note: null,
        cleEnvoi,
      });
    } else {
      // Parcours à distance : nom + tél obligatoires, adresse+zone si livraison.
      const nom = $('#nom').value.trim();
      const tel = $('#tel').value.trim();
      if (!nom || !tel) throw new Error('Nom et téléphone obligatoires');
      localStorage.setItem('qresto.nom', nom);
      localStorage.setItem('qresto.tel', tel);
      cmd = await Store.creerCommandeDistance({
        slug: slug || resto.slug, mode,
        lignes: lignesPanier,
        nom, telephone: tel,
        adresse: mode === 'livraison' ? $('#adresse').value.trim() : null,
        zoneId:  mode === 'livraison' ? $('#zone').value : null,
        heure:   $('#creneau').value || null,
        note:    $('#note').value.trim(),
        cleEnvoi,
      });
    }
    cleEnvoi = null;
    vue = 'confirmation';
    rendreConfirmation(cmd);
    window.scrollTo(0, 0);
  } catch (err) {
    erreur(Store.messageErreur(err));
  } finally {
    if (bouton) {
      bouton.disabled = false;
      bouton.classList.remove('en-cours');
      if (libelleOrig != null) bouton.textContent = libelleOrig;
    }
  }
}

// -------------------------------------------------------------- démarrage
(async () => {
  if (!qrToken && !slug) {
    page().innerHTML = '<div class="empty">Aucun restaurant demandé.</div>';
    return;
  }
  try {
    appliquerLangue();
    if (qrToken) {
      resto = await Store.vitrineParJeton(qrToken);
      if (!resto) throw new Error('QR code invalide. Demandez au personnel.');
      tableNumero = resto.table_numero;
    } else {
      resto = await Store.vitrine(slug);
      if (!resto) throw new Error('Restaurant introuvable');
    }
    normaliserCarte();
    document.title = `${resto.nom} — ${resto.ville}`;
    rendreVitrine();
  } catch (e) {
    page().innerHTML = `<div class="empty">${Store.messageErreur(e)}</div>`;
  }
})();
