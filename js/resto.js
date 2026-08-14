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
let tableNumero = null;   // renseigné uniquement si arrivée par QR
let vue = 'vitrine';       // vitrine | commande | coordonnees | confirmation
let mode = null;           // sur_place | a_emporter | livraison
let panier = {};
let cleEnvoi = null;

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
  sur_place:  `Table ${tableNumero}`,
  a_emporter: 'À emporter',
  livraison:  'Livraison',
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
  const out = ['<option value="">Dès que possible</option>'];
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
    qrToken && `<button class="btn" data-mode="sur_place">Sur place — Table ${tableNumero}</button>`,
    resto.emporter_actif && `<button class="btn" data-mode="a_emporter">À emporter</button>`,
    resto.livraison_active && `<button class="btn" data-mode="livraison">Livraison</button>`,
  ].filter(Boolean).join('');

  const bandeauCommander = qrToken ? `
    <div class="vqr reveal">
      <strong>Bienvenue à votre table N° ${tableNumero}</strong>
      <p>Composez votre commande depuis votre téléphone.<br>
         Vous paierez au comptoir à la fin du service.</p>
      <div class="vliens">${boutons}</div>
    </div>` : (boutons ? `
    <div class="vqr reveal">
      <strong>Commander en ligne</strong>
      <p>Vous réglez au retrait ou à la livraison.<br>Nous vous appelons pour confirmer.</p>
      <div class="vliens">${boutons}</div>
    </div>` : `
    <div class="vqr reveal">
      <strong>Commandez à table</strong>
      <p>Scannez le QR code posé sur votre table :<br>la carte s'ouvre sur votre téléphone.</p>
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
            <span class="vnom">${p.nom}${p.disponible ? '' : ' <span class="chip payee">Épuisé</span>'}</span>
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
      <p class="vpied">Carte tenue à jour par le restaurant.</p>
    </div>`;

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
    ? `<p class="sub" style="margin-top:14px">
         Les viandes, glaces et boissons chaudes ne sont pas proposées en livraison.</p>`
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
        <button class="btn" id="suite">${mode === 'sur_place' ? 'Envoyer à la cuisine' : 'Continuer'}</button>
      </div>
    </div>`;
  majBarre();
}

function majBarre() {
  const n = nbArticles();
  const bar = $('#cartbar');
  if (!bar) return;
  bar.style.display = n ? 'block' : 'none';
  $('#cnt').textContent = `${n} article${n > 1 ? 's' : ''}`;
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
      <h1>Votre commande</h1>
      <div class="card">
        ${L.map(l => `<div class="bar"><span class="lbl" style="flex:1">${l.qty} × ${l.nom}</span>
          <span class="n" style="flex:0 0 auto">${fmt.prix(l.prix * l.qty)}</span></div>`).join('')}
        <div class="bar" id="ligneFrais" style="display:none">
          <span class="lbl" style="flex:1">Frais de livraison</span>
          <span class="n" style="flex:0 0 auto" id="montantFrais"></span>
        </div>
        <div class="bar" style="border-top:1px solid var(--bord);padding-top:8px;margin-top:8px">
          <span class="lbl" style="flex:1;font-weight:800">Total</span>
          <span class="n" style="flex:0 0 auto;font-weight:800;font-size:16px" id="totalFinal"></span>
        </div>
      </div>

      <h2>Vos coordonnées</h2>
      <div class="card">
        <input id="nom" placeholder="Votre nom" maxlength="40" style="margin-bottom:9px">
        <input id="tel" type="tel" placeholder="Votre téléphone" maxlength="20" style="margin-bottom:9px">
        ${mode === 'livraison' ? `
          <select id="zone" style="margin-bottom:9px">${zonesOpt}</select>
          <textarea id="adresse" rows="2" placeholder="Votre adresse — rue, immeuble, étage"
            style="margin-bottom:9px"></textarea>` : ''}
        <select id="creneau" style="margin-bottom:9px">${creneaux()}</select>
        <textarea id="note" rows="2" placeholder="Une remarque ?"></textarea>
      </div>

      <p class="sub" style="margin-top:14px">
        Le restaurant vous appellera pour confirmer avant de préparer.
        Vous réglez ${mode === 'livraison' ? 'à la livraison' : 'au retrait'}.
      </p>
      <button class="btn wide" id="envoyer">Envoyer la commande</button>
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
  const titre = mode === 'sur_place'
    ? `Commande envoyée en cuisine`
    : `Commande envoyée`;
  const message = mode === 'sur_place'
    ? `Le personnel apporte votre commande à la table N° ${tableNumero}.<br>
       Vous réglez au comptoir en fin de service.`
    : `${resto.nom} va vous appeler pour confirmer avant de préparer.<br>
       Vous réglez ${mode === 'livraison' ? 'au livreur' : 'au comptoir, au retrait'}.`;

  const totalAffiche = cmd.total ?? cmd.sous_total ?? sousTotal();
  const sousTotalCmd = cmd.sous_total ?? totalAffiche;
  const fraisCmd = Number(cmd.frais_livraison || 0);

  page().innerHTML = `
    <main class="wrap narrow">
      <div class="card" style="text-align:center;margin-top:40px">
        <div class="vsceau">✦</div>
        <h1 style="margin-top:8px">${titre}</h1>
        <p class="sub">Commande N° ${cmd.numero}</p>
        <div class="badge" style="font-size:15px;padding:10px 16px">${nomMode()}</div>
        <div style="border-top:1px dashed var(--bord);margin-top:18px;padding-top:12px">
          ${mode !== 'sur_place' ? `
            <div class="bar"><span class="lbl" style="flex:1">Sous-total</span>
              <span class="n" style="flex:0 0 auto">${fmt.prix(sousTotalCmd)}</span></div>
            ${fraisCmd ? `<div class="bar">
              <span class="lbl" style="flex:1">Livraison</span>
              <span class="n" style="flex:0 0 auto">${fmt.prix(fraisCmd)}</span></div>` : ''}` : ''}
          <div class="bar"><span class="lbl" style="flex:1;font-weight:800">Total</span>
            <span class="n" style="flex:0 0 auto;font-weight:800">${fmt.prix(totalAffiche)}</span></div>
        </div>
        <p class="sub" style="margin-top:18px">${message}</p>
        <button class="btn ghost wide" id="retourAccueil">Retour à la carte</button>
      </div>
    </main>`;
}

// -------------------------------------------------------------- interactions
document.addEventListener('click', async e => {
  const m = e.target.closest('[data-mode]');
  const plus = e.target.closest('[data-plus]');
  const moins = e.target.closest('[data-moins]');

  if (m) { mode = m.dataset.mode; panier = {}; vue = 'commande'; rendreCommande(); window.scrollTo(0,0); }

  if (plus) {
    const id = plus.dataset.plus;
    panier[id] = panier[id] || { qty: 0, nom: plus.dataset.nom, prix: Number(plus.dataset.prix) };
    panier[id].qty++;
    toast(`${plus.dataset.nom} ajouté au panier`);
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
  if (bouton) bouton.disabled = true;
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
    if (bouton) bouton.disabled = false;
  }
}

// -------------------------------------------------------------- démarrage
(async () => {
  if (!qrToken && !slug) {
    page().innerHTML = '<div class="empty">Aucun restaurant demandé.</div>';
    return;
  }
  try {
    if (qrToken) {
      resto = await Store.vitrineParJeton(qrToken);
      if (!resto) throw new Error('QR code invalide. Demandez au personnel.');
      tableNumero = resto.table_numero;
    } else {
      resto = await Store.vitrine(slug);
      if (!resto) throw new Error('Restaurant introuvable');
    }
    document.title = `${resto.nom} — ${resto.ville}`;
    rendreVitrine();
  } catch (e) {
    page().innerHTML = `<div class="empty">${Store.messageErreur(e)}</div>`;
  }
})();
