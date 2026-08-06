/* QResto — page client (accès par scan du QR de la table) */

const qrToken = new URLSearchParams(location.search).get('t');

let lang = localStorage.getItem('qresto.lang') || 'fr';
let ctx = null;          // restaurant, numéro de table
let menu = null;         // catégories + plats + suppléments
let cat = null;          // fixée à la première catégorie au chargement
let vue = 'menu';        // menu | panier | confirmation
let suivi = null;        // arrêt de l'interrogation (D22)
let cleEnvoi = null;     // clé d'idempotence de la tentative en cours (D10)

// D5-bis : une ligne de panier porte ses propres suppléments.
// { [varianteId]: { qty, supps: { [varianteId]: qty } } }
let panier = {};

const $ = s => document.querySelector(s);
const t = k => I18N[lang][k];
const prix = n => fmt.prix(n, lang);

const nomPlat = p => p[`nom_${lang}`] || p.nom_fr;
const descPlat = p => p[`desc_${lang}`] || p.desc_fr || '';
const nomVar = v => v[`libelle_${lang}`] || v.libelle_fr;
const estStandard = v => v.libelle_fr === 'Standard';

/* Faute de photos réelles, chaque plat reçoit un visuel dérivé de sa
   catégorie. C'est un pis-aller assumé : il casse l'effet « mur de texte »
   sans faire croire au client qu'il voit le plat qu'il commande.
   Le champ image_url reste prioritaire dès qu'une vraie photo existe. */
const VISUELS = [
  [/pizza|calzone/i,        '🍕'],
  [/burger/i,               '🍔'],
  [/sandwich|panini/i,      '🥪'],
  [/tacos|wrap/i,           '🌯'],
  [/gratin/i,               '🧀'],
  [/tender|wing|poulet/i,   '🍗'],
  [/crêpe|crepe/i,          '🥞'],
  [/dessert|glace/i,        '🍰'],
  [/boisson|jus|café/i,     '🥤'],
  [/salade/i,               '🥗'],
  [/plat|assiette|steak/i,  '🍽️'],
];

function visuel(plat) {
  const cat = menu.categories.find(c => c.id === plat.categorie_id);
  const texte = `${cat?.nom_fr || ''} ${plat.nom_fr}`;
  const trouve = VISUELS.find(([re]) => re.test(texte));
  return trouve ? trouve[1] : '🍴';
}

function trouverVariante(vid) {
  for (const p of [...menu.plats, ...menu.supplements]) {
    const v = p.variantes_plat.find(x => x.id === vid);
    if (v) return { plat: p, variante: v };
  }
  return null;
}

function setLang(next) {
  lang = next;
  localStorage.setItem('qresto.lang', next);
  document.documentElement.lang = next;
  document.documentElement.dir = I18N[next].dir;
  document.querySelectorAll('.langs button')
    .forEach(b => b.classList.toggle('on', b.dataset.lang === next));
  rendre();
}

// ---------------------------------------------------------------- calculs
function lignes() {
  return Object.entries(panier)
    .filter(([, l]) => l.qty > 0)
    .map(([vid, l]) => {
      const base = trouverVariante(vid);
      const supps = Object.entries(l.supps || {})
        .filter(([, q]) => q > 0)
        .map(([sid, q]) => ({ ...trouverVariante(sid), qty: q }));
      return { vid, ...base, qty: l.qty, supps };
    });
}

const totalLigne = l =>
  l.variante.prix * l.qty + l.supps.reduce((s, x) => s + x.variante.prix * x.qty, 0);
const total = () => lignes().reduce((s, l) => s + totalLigne(l), 0);
const nbArticles = () => lignes().reduce((s, l) => s + l.qty, 0);

// ------------------------------------------------------------------ menu
function rendreCategories() {
  // « Tout » est placé en dernier et non en premier : sur une carte de treize
  // catégories, l'ouvrir par défaut affiche cinquante-cinq plats d'affilée,
  // soit douze écrans à faire défiler. Le client doit arriver sur une
  // catégorie, pas sur un mur.
  const toutes = [...menu.categories, { id: 'all', nom_fr: 'Tout', nom_ar: 'الكل', nom_en: 'All' }];

  $('#cats').innerHTML = toutes.map(c => {
    const n = c.id === 'all'
      ? menu.plats.length
      : menu.plats.filter(p => p.categorie_id === c.id).length;
    return `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${
      c[`nom_${lang}`] || c.nom_fr}<span class="cpt">${n}</span></button>`;
  }).join('');

  // Ramène l'onglet actif dans le champ de vision : sans cela, changer de
  // langue ou revenir du panier laisse la barre positionnée n'importe où.
  const actif = $('#cats button.on');
  if (actif) actif.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function rendrePlats() {
  const liste = cat === 'all' ? menu.plats : menu.plats.filter(p => p.categorie_id === cat);

  $('#dishes').innerHTML = liste.map(p => {
    // D5 : une déclinaison « Standard » unique est masquée — le plat paraît
    // simplement avoir un prix.
    const simple = p.variantes_plat.length === 1 && estStandard(p.variantes_plat[0]);

    const rows = p.variantes_plat.map(v => {
      const q = panier[v.id]?.qty || 0;
      return `<div class="vrow">
        ${simple ? '' : `<span class="vlbl">${nomVar(v)}</span>`}
        <span class="vprix">${prix(v.prix)}</span>
        <span class="qty">
          ${q > 0 ? `<button data-moins="${v.id}">−</button><span class="n">${q}</span>` : ''}
          <button class="plus" data-plus="${v.id}" ${p.disponible ? '' : 'disabled'}>+</button>
        </span></div>`;
    }).join('');

    const vignette = p.image_url
      ? `<img class="pic" src="${p.image_url}" alt="${nomPlat(p)}" loading="lazy">`
      : `<div class="pic">${visuel(p)}</div>`;

    return `<div class="card dish ${p.disponible ? '' : 'epuise'}">
      <div class="entete">
        ${vignette}
        <div class="info">
          <div class="name">${nomPlat(p)}
            ${p.disponible ? '' : `<span class="chip payee">${t('epuise')}</span>`}</div>
          ${descPlat(p) ? `<div class="desc">${descPlat(p)}</div>` : ''}
        </div>
      </div>
      <div class="variantes">${rows}</div>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------- panier
function rendrePanier() {
  const L = lignes();
  if (!L.length) { vue = 'menu'; rendre(); return; }

  // Un supplément n'est proposé que sur les familles de plats auxquelles il
  // s'applique : sans ce filtre, l'écran proposerait « Kit Kat » sur un burger.
  const suppsPour = plat => menu.supplements.filter(s =>
    s.disponible && (s.portee.length === 0 || s.portee.includes(plat.categorie_id)));

  // Sur une pizza Normale, seul le supplément Normale a du sens : quand les
  // déclinaisons portent le même nom des deux côtés, on ne garde que celle
  // qui correspond à la taille commandée.
  const variantesUtiles = (supp, ligne) => {
    const correspondante = supp.variantes_plat.filter(v => v.libelle_fr === ligne.variante.libelle_fr);
    return correspondante.length ? correspondante : supp.variantes_plat;
  };

  $('#panierView').innerHTML = `
    <h1 style="margin-top:16px">${t('cart')}</h1>
    ${L.map(l => {
      const simple = l.plat.variantes_plat.length === 1 && estStandard(l.plat.variantes_plat[0]);
      const dispo = suppsPour(l.plat);
      return `<div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <div class="name">${l.qty} × ${nomPlat(l.plat)}${simple ? '' : ` (${nomVar(l.variante)})`}</div>
            ${l.supps.map(s => `<div class="desc">+ ${s.qty} × ${nomPlat(s.plat)}
              ${s.plat.variantes_plat.length > 1 ? `(${nomVar(s.variante)})` : ''}
              — ${prix(s.variante.prix * s.qty)}
              <button class="lienSupp" data-retirer="${l.vid}|${s.variante.id}">✕</button></div>`).join('')}
          </div>
          <div style="font-weight:800;white-space:nowrap">${prix(totalLigne(l))}</div>
        </div>
        ${dispo.length ? `<div class="suppzone">
          <div class="desc" style="margin-bottom:6px">${t('ajouterSupp')}</div>
          <div class="suppchips">${dispo.map(s => variantesUtiles(s, l).map(v =>
            `<button class="chipbtn" data-supp="${l.vid}|${v.id}">
               ${nomPlat(s)}${variantesUtiles(s, l).length > 1 ? ` ${nomVar(v)}` : ''}
               <b>+${prix(v.prix)}</b></button>`).join('')).join('')}</div>
        </div>` : ''}
      </div>`;
    }).join('')}

    <div class="card">
      <input id="nom" maxlength="30" placeholder="${t('votreNom')}" style="margin-bottom:8px">
      <textarea id="note" rows="2" placeholder="${t('note')}"></textarea>
    </div>
    <button class="btn ghost wide" id="retourBtn" style="margin-top:10px">${t('retourMenu')}</button>`;

  $('#nom').value = localStorage.getItem('qresto.nom') || '';
  $('#retourBtn').onclick = () => { vue = 'menu'; rendre(); };
}

// ---------------------------------------------------------- confirmation
function afficherConfirmation(cmd) {
  vue = 'confirmation';
  rendre();

  const eta = cmd.eta_min
    ? `<div class="badge" style="font-size:15px;padding:10px 16px">
         ⏱️ ${t('eta')} ${cmd.eta_min}–${cmd.eta_max} ${t('min')}</div>` : '';

  $('#confirmView').innerHTML = `
    <div class="card" style="text-align:center;margin-top:24px">
      <div style="font-size:52px">✅</div>
      <h1 style="margin-top:8px">${t('sent')}</h1>
      <p class="sub">${t('orderNo')} ${cmd.numero} — ${t('table')} ${ctx.table_numero}</p>
      ${eta}
      <div style="margin:18px 0">
        <div style="color:var(--muted);font-size:13px">${t('status')}</div>
        <span class="chip nouvelle" id="statutChip">${t('st_nouvelle')}</span>
      </div>
      <div style="border-top:1px dashed var(--border);padding-top:10px;
                  display:flex;justify-content:space-between;font-weight:800">
        <span>${t('total')}</span><span>${prix(cmd.total)}</span>
      </div>
      <p class="sub" style="margin-top:18px">💵 ${t('payInfo')}</p>
      <button class="btn ghost wide" id="againBtn">${t('newOrder')}</button>
    </div>`;

  if (suivi) suivi();
  suivi = Store.suivreCommande(cmd.secret, etat => {
    const chip = $('#statutChip');
    if (!chip) return;
    chip.className = `chip ${etat.statut}`;
    chip.textContent = t('st_' + etat.statut);
  });

  $('#againBtn').onclick = () => {
    if (suivi) { suivi(); suivi = null; }
    panier = {}; vue = 'menu'; rendre();
  };
}

// ----------------------------------------------------------------- rendu
function rendre() {
  if (!ctx || !menu) return;
  $('#tableBadge').textContent = `${t('table')} ${ctx.table_numero}`;

  $('#menuView').style.display    = vue === 'menu' ? '' : 'none';
  $('#panierView').style.display  = vue === 'panier' ? '' : 'none';
  $('#confirmView').style.display = vue === 'confirmation' ? '' : 'none';

  if (vue === 'menu') { rendreCategories(); rendrePlats(); }
  if (vue === 'panier') rendrePanier();

  const n = nbArticles();
  $('#cartbar').style.display = (n && vue !== 'confirmation') ? 'block' : 'none';
  $('#cartCount').textContent = `${n} ${t('items')}`;
  $('#cartTotal').textContent = prix(total());
  $('#sendBtn').textContent = vue === 'panier' ? t('send') : t('voirCommande');
}

// --------------------------------------------------------------- actions
document.addEventListener('click', e => {
  const plus = e.target.closest('[data-plus]');
  const moins = e.target.closest('[data-moins]');
  const c = e.target.closest('[data-cat]');
  const l = e.target.closest('[data-lang]');
  const supp = e.target.closest('[data-supp]');
  const ret = e.target.closest('[data-retirer]');

  if (plus) {
    const id = plus.dataset.plus;
    panier[id] = panier[id] || { qty: 0, supps: {} };
    panier[id].qty++;
    rendrePlats(); rendre();
  }
  if (moins) {
    const id = moins.dataset.moins;
    panier[id].qty--;
    if (panier[id].qty <= 0) delete panier[id];
    rendrePlats(); rendre();
  }
  if (c) { cat = c.dataset.cat; rendreCategories(); rendrePlats(); }
  if (l) setLang(l.dataset.lang);

  if (supp) {
    const [vid, sid] = supp.dataset.supp.split('|');
    panier[vid].supps[sid] = (panier[vid].supps[sid] || 0) + 1;
    rendre();
  }
  if (ret) {
    const [vid, sid] = ret.dataset.retirer.split('|');
    delete panier[vid].supps[sid];
    rendre();
  }
});

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}

async function actionPrincipale() {
  if (vue === 'menu') { vue = 'panier'; rendre(); window.scrollTo(0, 0); return; }

  const bouton = $('#sendBtn');
  bouton.disabled = true;

  // D10 : une seule clé pour tout ce panier. Elle survit à un échec réseau et
  // à un nouvel appui, jusqu'à ce que la commande soit réellement passée.
  if (!cleEnvoi) cleEnvoi = crypto.randomUUID();

  try {
    const nom = $('#nom').value.trim();
    if (nom) localStorage.setItem('qresto.nom', nom);

    const cmd = await Store.creerCommande({
      qrToken,
      lignes: lignes().map(l => ({
        variante_id: l.variante.id,
        quantite: l.qty,
        supplements: l.supps.map(s => ({ variante_id: s.variante.id, quantite: s.qty })),
      })),
      nom,
      note: $('#note').value.trim(),
      cleEnvoi,
    });
    cleEnvoi = null;                            // panier suivant, nouvelle clé
    afficherConfirmation(cmd);
  } catch (e) {
    erreur(Store.messageErreur(e));
    menu = await Store.menu(ctx.restaurant_id);   // un plat a pu passer en épuisé
    rendre();
  } finally {
    bouton.disabled = false;
  }
}

// -------------------------------------------------------------- démarrage
(async function demarrer() {
  if (!qrToken) {
    document.body.innerHTML =
      '<div class="empty">QR code invalide.<br><small>Scannez le code posé sur votre table.</small></div>';
    return;
  }
  try {
    ctx = await Store.contexteTable(qrToken);
    if (!ctx) throw new Error('Table inconnue');
    menu = await Store.menu(ctx.restaurant_id);
    cat = menu.categories[0]?.id || 'all';
    $('#restoNom').textContent = ctx.restaurant;
    $('#sendBtn').onclick = actionPrincipale;
    setLang(lang);
  } catch (e) {
    document.body.innerHTML = `<div class="empty">${Store.messageErreur(e)}</div>`;
  }
})();
