/* QResto — espace gérant.

   Panel complet en 7 onglets :
     Statistiques  — CA du jour, pertes, top plats, disponibilité
     Carte         — édition prix, plats, catégories, livrable
     Tables        — ajout, activation, régénération de QR
     Livraison     — zones, frais, minimums
     Restaurant    — nom, adresse, contact, présence en ligne
     Historique    — commandes des 7 derniers jours, export CSV
     Journal       — audit des actions sensibles

   Chaque écriture passe par un RPC qui vérifie mon_restaurant() : impossible
   d'éditer les données d'un autre restaurant, même avec un session token
   valide (D4). */

const $ = s => document.querySelector(s);
let restaurantId = null;
let carteCache = null;   // menu courant chargé une fois par onglet
let restoCache = null;

// ==========================================================================
// Utilitaires
// ==========================================================================

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}
function succes(message) {
  const b = $('#succes');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 3500);
}

async function proteger(fn) {
  try { return await fn(); }
  catch (e) {
    if (Store.estSessionExpiree(e)) { Store.signalerSessionExpiree(); return; }
    erreur(Store.messageErreur(e));
    throw e;
  }
}

function echapper(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function barres(lignes) {
  if (!lignes.length) return '<div class="empty">Pas encore de données.</div>';
  const max = Math.max(...lignes.map(l => l.valeur));
  return lignes.map(l => `
    <div class="bar">
      <span class="lbl">${echapper(l.libelle)}</span>
      <span class="track"><span class="fill" style="width:${Math.round(l.valeur / max * 100)}%"></span></span>
      <span class="n">${l.suffixe ? l.valeur.toLocaleString('fr-DZ') + l.suffixe : l.valeur}</span>
    </div>`).join('');
}

// ==========================================================================
// Onglet Statistiques (comportement existant)
// ==========================================================================

async function rendreStats() {
  const sessions = await Store.sessionsDuJour();
  const payees = sessions.filter(s => s.statut === 'payee');
  const ca = payees.reduce((t, s) => t + Number(s.total), 0);
  const perte = sessions
    .flatMap(s => s.commandes || [])
    .filter(c => c.statut === 'annulee' && c.annulee_apres_impression)
    .reduce((t, c) => t + Number(c.total), 0);

  $('#ca').textContent = fmt.prix(ca);
  $('#nb').textContent = payees.length;
  $('#moy').textContent = fmt.prix(payees.length ? Math.round(ca / payees.length) : 0);
  $('#perte').textContent = fmt.prix(perte);

  const parPlat = {};
  sessions.flatMap(s => s.commandes || [])
    .filter(c => c.statut !== 'annulee')
    .flatMap(c => c.lignes_commande || [])
    .forEach(l => { parPlat[l.libelle] = (parPlat[l.libelle] || 0) + l.quantite; });

  $('#top').innerHTML = barres(
    Object.entries(parPlat).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([libelle, q]) => ({ libelle, valeur: q })));

  const parHeure = {};
  sessions.forEach(s => {
    const h = new Date(s.ouverte_le).getHours();
    parHeure[h] = (parHeure[h] || 0) + 1;
  });
  $('#hours').innerHTML = barres(
    Object.entries(parHeure).sort((a, b) => a[0] - b[0])
      .map(([h, n]) => ({ libelle: `${String(h).padStart(2, '0')} h`, valeur: n })));

  await rendreDisponibilite();
  await rendreQr();
}

async function rendreDisponibilite() {
  const { plats } = await Store.menu(restaurantId);
  $('#dispo').innerHTML = plats.map(p => `
    <div class="bar">
      <span class="lbl" style="flex:1">${echapper(p.nom_fr)}</span>
      <button class="btn sm ${p.disponible ? 'ghost' : ''}"
              data-dispo="${p.id}" data-etat="${p.disponible}">
        ${p.disponible ? 'Disponible' : '🚫 Épuisé'}
      </button>
    </div>`).join('');
}

async function rendreQr() {
  const tables = await Store.tables(restaurantId);
  const base = location.origin + '/resto.html?t=';
  $('#qrs').innerHTML = tables.map(t => {
    const url = base + t.qr_token;
    const src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data='
              + encodeURIComponent(url);
    return `<div class="card" style="text-align:center">
      <div style="font-weight:800;font-size:18px;margin-bottom:8px">Table ${t.numero}</div>
      <img src="${src}" alt="QR table ${t.numero}" width="180" height="180"
           style="background:#fff;border-radius:10px;padding:6px">
      <div style="margin-top:10px"><a href="${url}">Ouvrir la table ${t.numero}</a></div>
    </div>`;
  }).join('');
}

// ==========================================================================
// Onglet Carte — édition catégories, plats, variantes
// ==========================================================================

async function rendreCarte() {
  const { categories, plats } = await Store.menu(restaurantId);
  carteCache = { categories, plats };
  const nonSupp = plats.filter(p => !p.est_supplement);

  const html = categories.map(c => {
    const catPlats = nonSupp.filter(p => p.categorie_id === c.id);
    return `
    <div class="ec-cat">
      <div class="ec-cat-tete">
        <input class="ec-cat-nom" data-cat-nom="${c.id}" value="${echapper(c.nom_fr)}">
        <input class="ec-cat-tr" data-cat-ar="${c.id}" placeholder="AR" value="${echapper(c.nom_ar || '')}">
        <input class="ec-cat-tr" data-cat-en="${c.id}" placeholder="EN" value="${echapper(c.nom_en || '')}">
        <button class="btn sm ghost" data-cat-sauver="${c.id}">Sauver</button>
        <button class="btn sm ghost" data-cat-supprimer="${c.id}"
                title="Uniquement si vide">🗑️</button>
      </div>

      ${catPlats.map(p => plateCard(p)).join('')}

      <button class="btn sm ghost ec-ajouter-plat" data-cat-ajouter="${c.id}">＋ Ajouter un plat</button>
    </div>`;
  }).join('');

  $('#editeurCarte').innerHTML = `
    <div class="ec-toolbar">
      <input id="ecNouvelleCat" placeholder="Nom d'une nouvelle catégorie">
      <button class="btn" id="ecCreerCat">＋ Ajouter une catégorie</button>
    </div>
    ${html}
    <details class="ec-archives"><summary>Plats archivés (${plats.filter(p => p.archive && !p.est_supplement).length})</summary>
      <div class="ec-liste-archives">
        ${plats.filter(p => p.archive && !p.est_supplement).map(p => `
          <div class="bar">
            <span class="lbl">${echapper(p.nom_fr)}</span>
            <button class="btn sm ghost" data-plat-restaurer="${p.id}">Restaurer</button>
          </div>`).join('') || '<div class="empty">Aucun plat archivé.</div>'}
      </div>
    </details>`;
}

function plateCard(p) {
  return `
  <div class="ec-plat">
    <div class="ec-plat-tete">
      <input class="ec-plat-nom" data-plat-nom="${p.id}" value="${echapper(p.nom_fr)}">
      <label class="ec-livrable" title="Livrable en emporter et livraison">
        <input type="checkbox" data-plat-livrable="${p.id}" ${p.livrable ? 'checked' : ''}> livrable
      </label>
      <button class="btn sm ghost" data-plat-sauver="${p.id}">Sauver</button>
      <button class="btn sm ghost" data-plat-archiver="${p.id}" title="Archiver">🗄️</button>
    </div>
    <textarea class="ec-plat-desc" data-plat-desc="${p.id}"
              placeholder="Description">${echapper(p.desc_fr || '')}</textarea>
    <div class="ec-variantes">
      ${(p.variantes_plat || []).map(v => `
        <div class="ec-var">
          <input class="ec-var-lbl" data-var-lbl="${v.id}" value="${echapper(v.libelle_fr)}">
          <input class="ec-var-prix" type="number" step="10" min="0"
                 data-var-prix="${v.id}" value="${Number(v.prix)}">
          <span class="ec-devise">DA</span>
          <button class="btn sm ghost" data-var-sauver="${v.id}">Sauver</button>
          <button class="btn sm ghost" data-var-supprimer="${v.id}">🗑️</button>
        </div>`).join('')}
      <button class="btn sm ghost ec-ajouter-var" data-var-ajouter="${p.id}">＋ Ajouter une taille</button>
    </div>
  </div>`;
}

// ==========================================================================
// Onglet Tables
// ==========================================================================

async function rendreTables() {
  const tables = await Store.tables(restaurantId);
  const base = location.origin + '/resto.html?t=';
  $('#editeurTables').innerHTML = tables.map(t => `
    <div class="et-table">
      <div class="et-num">Table ${t.numero}</div>
      <div class="et-etat">${t.active ? '✅ Active' : '⛔ Désactivée'}</div>
      <a class="et-lien" href="${base + t.qr_token}" target="_blank" rel="noopener">Ouvrir</a>
      <button class="btn sm ghost" data-table-bascule="${t.id}" data-active="${t.active}">
        ${t.active ? 'Désactiver' : 'Réactiver'}
      </button>
      <button class="btn sm ghost" data-table-regen="${t.id}"
              title="Ancien QR invalidé, nouveau généré">🔄 Régénérer QR</button>
    </div>`).join('') || '<div class="empty">Aucune table. Cliquez « Ajouter » ci-dessus.</div>';
}

// ==========================================================================
// Onglet Livraison
// ==========================================================================

async function rendreZones() {
  const zones = await Store.zonesGerant(restaurantId);
  $('#editeurZones').innerHTML = zones.map(z => `
    <div class="ez-zone">
      <input class="ez-nom" data-zone-nom="${z.id}" value="${echapper(z.nom)}">
      <label>Frais <input type="number" step="10" min="0" class="ez-frais"
             data-zone-frais="${z.id}" value="${Number(z.frais)}"> DA</label>
      <label>Min. panier <input type="number" step="50" min="0" class="ez-min"
             data-zone-min="${z.id}" value="${Number(z.minimum)}"> DA</label>
      <label><input type="checkbox" data-zone-active="${z.id}" ${z.active ? 'checked' : ''}> active</label>
      <button class="btn sm ghost" data-zone-sauver="${z.id}">Sauver</button>
      <button class="btn sm ghost" data-zone-supprimer="${z.id}">🗑️</button>
    </div>`).join('') || '<div class="empty">Aucune zone. Cliquez « Ajouter » ci-dessus.</div>';
}

// ==========================================================================
// Onglet Restaurant
// ==========================================================================

async function rendreResto() {
  const r = await Store.restaurant(restaurantId);
  restoCache = r;
  $('#editeurResto').innerHTML = `
    <div class="er-form">
      <label>Nom <input id="er-nom" value="${echapper(r.nom || '')}"></label>
      <label>Slogan <input id="er-slogan" value="${echapper(r.slogan || '')}"></label>
      <label>Adresse <input id="er-adresse" value="${echapper(r.adresse || '')}"></label>
      <label>Téléphone <input id="er-tel" value="${echapper(r.telephone || '')}"></label>
      <label>Horaires <input id="er-horaires" value="${echapper(r.horaires || '')}"></label>
      <label>Facebook <input id="er-fb" value="${echapper(r.facebook || '')}"></label>
      <label>Instagram <input id="er-ig" value="${echapper(r.instagram || '')}"></label>
      <label>Délai minimum (minutes)
        <input id="er-delai" type="number" min="0" step="5" value="${Number(r.delai_min_minutes || 30)}"></label>
      <label class="er-check">
        <input id="er-vitrine" type="checkbox" ${r.vitrine_active ? 'checked' : ''}>
        Vitrine publique active
      </label>
      <button class="btn wide" id="er-sauver">Sauvegarder</button>
    </div>`;
}

// ==========================================================================
// Onglet Historique
// ==========================================================================

let histCache = [];

async function rendreHistorique() {
  const du = $('#histDu').value || nJoursAvant(7);
  const au = $('#histAu').value || aujourdHui();
  histCache = await Store.historiqueCommandes(du, au);
  filtrerEtAfficherHistorique();
}
function filtrerEtAfficherHistorique() {
  const q = $('#histRecherche').value.toLowerCase().trim();
  const filtre = q
    ? histCache.filter(c =>
        String(c.numero).includes(q) ||
        (c.nom_convive || '').toLowerCase().includes(q) ||
        (c.client_telephone || '').includes(q) ||
        String(c.table_numero || '').includes(q))
    : histCache;
  if (!filtre.length) {
    $('#editeurHistorique').innerHTML = '<div class="empty">Aucune commande sur la période.</div>';
    return;
  }
  $('#editeurHistorique').innerHTML = `
    <table class="eh-table">
      <thead><tr>
        <th>N°</th><th>Date</th><th>Mode</th><th>Client</th>
        <th>Statut</th><th class="r">Total</th>
      </tr></thead>
      <tbody>
        ${filtre.map(c => `
          <tr class="${c.statut === 'annulee' ? 'annulee' : ''}">
            <td>${c.numero}</td>
            <td>${new Date(c.cree_le).toLocaleString('fr-DZ',
              {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
            <td>${modeLibelle(c.mode, c.table_numero)}</td>
            <td>${echapper(c.nom_convive || c.client_telephone || '-')}</td>
            <td><span class="chip ${c.statut}">${c.statut}</span></td>
            <td class="r">${fmt.prix(c.total)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
function modeLibelle(m, table) {
  if (m === 'sur_place') return `🍽️ Table ${table ?? '?'}`;
  if (m === 'a_emporter') return '🥡 À emporter';
  if (m === 'livraison') return '🛵 Livraison';
  return m;
}
function aujourdHui() { return new Date().toISOString().slice(0, 10); }
function nJoursAvant(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function exportCsvHistorique() {
  if (!histCache.length) return;
  const entetes = ['numero','cree_le','mode','table','client','telephone','adresse','statut','total','motif_annulation'];
  const lignes = [entetes.join(',')].concat(histCache.map(c => [
    c.numero, c.cree_le, c.mode, c.table_numero || '',
    (c.nom_convive || '').replace(/[,"\n]/g, ' '),
    c.client_telephone || '',
    (c.client_adresse || '').replace(/[,"\n]/g, ' '),
    c.statut, c.total, (c.motif_annulation || '').replace(/[,"\n]/g, ' '),
  ].join(',')));
  const blob = new Blob([lignes.join('\n')], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `qresto-commandes-${aujourdHui()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ==========================================================================
// Onglet Journal d'audit
// ==========================================================================

async function rendreAudit() {
  const lignes = await Store.journalAudit(200);
  if (!lignes.length) {
    $('#editeurAudit').innerHTML = '<div class="empty">Journal vide.</div>';
    return;
  }
  $('#editeurAudit').innerHTML = `
    <table class="eh-table">
      <thead><tr><th>Date</th><th>Action</th><th>Détails</th></tr></thead>
      <tbody>
        ${lignes.map(a => `
          <tr>
            <td>${new Date(a.cree_le).toLocaleString('fr-DZ',
              {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
            <td><span class="chip">${echapper(a.action)}</span></td>
            <td><code style="font-size:11px">${echapper(JSON.stringify(a.detail || {}))}</code></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ==========================================================================
// Routing des onglets — chargement paresseux pour économiser les requêtes
// ==========================================================================

const chargeurs = {
  stats:      rendreStats,
  carte:      rendreCarte,
  tables:     rendreTables,
  livraison:  rendreZones,
  resto:      rendreResto,
  historique: rendreHistorique,
  audit:      rendreAudit,
};

async function activerOnglet(nom) {
  document.querySelectorAll('.og-tab').forEach(b => {
    const actif = b.dataset.tab === nom;
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-selected', actif);
  });
  document.querySelectorAll('.og-section').forEach(s => {
    const actif = s.id === `tab-${nom}`;
    s.hidden = !actif;
    s.classList.toggle('active', actif);
  });
  await proteger(() => chargeurs[nom]?.());
}

// ==========================================================================
// Handlers — un seul listener délégué, dispatch par attribut data-*
// ==========================================================================

document.addEventListener('click', async e => {
  const t = e.target;

  // Onglets
  const tab = t.closest('.og-tab');
  if (tab) { await activerOnglet(tab.dataset.tab); return; }

  // Statistiques : disponibilité
  const d = t.closest('[data-dispo]');
  if (d) {
    await proteger(async () => {
      await Store.basculerDisponibilite(d.dataset.dispo, d.dataset.etat !== 'true');
      await rendreDisponibilite();
      succes('Disponibilité mise à jour.');
    });
    return;
  }

  // ------- Carte -------

  if (t.id === 'ecCreerCat') {
    const nom = $('#ecNouvelleCat').value.trim();
    if (!nom) return erreur('Nom obligatoire.');
    await proteger(async () => {
      await Store.creerCategorie({ nom });
      $('#ecNouvelleCat').value = '';
      await rendreCarte();
      succes('Catégorie ajoutée.');
    });
    return;
  }

  const catSauver = t.closest('[data-cat-sauver]');
  if (catSauver) {
    const id = catSauver.dataset.catSauver;
    await proteger(async () => {
      await Store.editerCategorie(id, {
        nom_fr: document.querySelector(`[data-cat-nom="${id}"]`).value,
        nom_ar: document.querySelector(`[data-cat-ar="${id}"]`).value,
        nom_en: document.querySelector(`[data-cat-en="${id}"]`).value,
      });
      succes('Catégorie sauvegardée.');
    });
    return;
  }

  const catSupp = t.closest('[data-cat-supprimer]');
  if (catSupp) {
    if (!confirm('Supprimer cette catégorie ? (Elle doit être vide.)')) return;
    await proteger(async () => {
      await Store.supprimerCategorie(catSupp.dataset.catSupprimer);
      await rendreCarte();
      succes('Catégorie supprimée.');
    });
    return;
  }

  const catAjouter = t.closest('[data-cat-ajouter]');
  if (catAjouter) {
    const nom = prompt('Nom du nouveau plat ?');
    if (!nom) return;
    const prix = Number(prompt('Prix en DA ?', '0'));
    if (!(prix >= 0)) return erreur('Prix invalide.');
    await proteger(async () => {
      await Store.creerPlat({ categorieId: catAjouter.dataset.catAjouter, nom, prix });
      await rendreCarte();
      succes('Plat ajouté.');
    });
    return;
  }

  const platSauver = t.closest('[data-plat-sauver]');
  if (platSauver) {
    const id = platSauver.dataset.platSauver;
    await proteger(async () => {
      await Store.editerPlat(id, {
        nom_fr: document.querySelector(`[data-plat-nom="${id}"]`).value,
        desc_fr: document.querySelector(`[data-plat-desc="${id}"]`).value,
        livrable: document.querySelector(`[data-plat-livrable="${id}"]`).checked,
      });
      succes('Plat sauvegardé.');
    });
    return;
  }

  const platArch = t.closest('[data-plat-archiver]');
  if (platArch) {
    if (!confirm('Archiver ce plat ? (Il disparaîtra de la carte, mais les commandes passées le référencent.)')) return;
    await proteger(async () => {
      await Store.archiverPlat(platArch.dataset.platArchiver);
      await rendreCarte();
      succes('Plat archivé.');
    });
    return;
  }

  const platRest = t.closest('[data-plat-restaurer]');
  if (platRest) {
    await proteger(async () => {
      await Store.restaurerPlat(platRest.dataset.platRestaurer);
      await rendreCarte();
      succes('Plat restauré.');
    });
    return;
  }

  const varSauver = t.closest('[data-var-sauver]');
  if (varSauver) {
    const id = varSauver.dataset.varSauver;
    await proteger(async () => {
      await Store.editerVariante(id, {
        libelle_fr: document.querySelector(`[data-var-lbl="${id}"]`).value,
        prix: Number(document.querySelector(`[data-var-prix="${id}"]`).value),
      });
      succes('Taille sauvegardée.');
    });
    return;
  }

  const varSupp = t.closest('[data-var-supprimer]');
  if (varSupp) {
    if (!confirm('Supprimer cette taille ?')) return;
    await proteger(async () => {
      await Store.supprimerVariante(varSupp.dataset.varSupprimer);
      await rendreCarte();
      succes('Taille supprimée.');
    });
    return;
  }

  const varAjouter = t.closest('[data-var-ajouter]');
  if (varAjouter) {
    const libelle = prompt('Libellé de la nouvelle taille (ex. Petite, Moyenne, XL) :', 'Grande');
    if (!libelle) return;
    const prix = Number(prompt('Prix en DA ?', '0'));
    if (!(prix >= 0)) return erreur('Prix invalide.');
    await proteger(async () => {
      await Store.creerVariante({ platId: varAjouter.dataset.varAjouter, libelle, prix });
      await rendreCarte();
      succes('Taille ajoutée.');
    });
    return;
  }

  // ------- Tables -------

  if (t.id === 'btnAjouterTable') {
    await proteger(async () => {
      const r = await Store.creerTable();
      await rendreTables();
      succes(`Table ${r.numero} ajoutée.`);
    });
    return;
  }
  const tableBasc = t.closest('[data-table-bascule]');
  if (tableBasc) {
    await proteger(async () => {
      await Store.basculerTable(tableBasc.dataset.tableBascule,
                                tableBasc.dataset.active !== 'true');
      await rendreTables();
    });
    return;
  }
  const tableRegen = t.closest('[data-table-regen]');
  if (tableRegen) {
    if (!confirm('Régénérer le QR de cette table ? L\'ancien QR sera immédiatement invalidé.')) return;
    await proteger(async () => {
      await Store.regenererQrTable(tableRegen.dataset.tableRegen);
      await rendreTables();
      succes('QR régénéré. Réimprimez le carton de la table.');
    });
    return;
  }

  // ------- Zones -------

  if (t.id === 'btnAjouterZone') {
    const nom = prompt('Nom de la zone (ex. Aïn Benian, Cheraga) :');
    if (!nom) return;
    const frais = Number(prompt('Frais de livraison en DA ?', '200'));
    if (!(frais >= 0)) return erreur('Frais invalides.');
    const min = Number(prompt('Minimum de commande en DA ? (0 pour aucun)', '800'));
    if (!(min >= 0)) return erreur('Minimum invalide.');
    await proteger(async () => {
      await Store.creerZone({ nom, frais, minimum: min });
      await rendreZones();
      succes('Zone ajoutée.');
    });
    return;
  }
  const zoneSauver = t.closest('[data-zone-sauver]');
  if (zoneSauver) {
    const id = zoneSauver.dataset.zoneSauver;
    await proteger(async () => {
      await Store.editerZone(id, {
        nom: document.querySelector(`[data-zone-nom="${id}"]`).value,
        frais: Number(document.querySelector(`[data-zone-frais="${id}"]`).value),
        minimum: Number(document.querySelector(`[data-zone-min="${id}"]`).value),
        active: document.querySelector(`[data-zone-active="${id}"]`).checked,
      });
      succes('Zone sauvegardée.');
    });
    return;
  }
  const zoneSupp = t.closest('[data-zone-supprimer]');
  if (zoneSupp) {
    if (!confirm('Supprimer cette zone ? (Impossible si des commandes la référencent.)')) return;
    await proteger(async () => {
      await Store.supprimerZone(zoneSupp.dataset.zoneSupprimer);
      await rendreZones();
      succes('Zone supprimée.');
    });
    return;
  }

  // ------- Restaurant -------

  if (t.id === 'er-sauver') {
    await proteger(async () => {
      await Store.editerRestaurant({
        nom: $('#er-nom').value,
        slogan: $('#er-slogan').value,
        adresse: $('#er-adresse').value,
        telephone: $('#er-tel').value,
        horaires: $('#er-horaires').value,
        facebook: $('#er-fb').value,
        instagram: $('#er-ig').value,
        delai_min_minutes: Number($('#er-delai').value) || null,
        vitrine_active: $('#er-vitrine').checked,
      });
      succes('Informations du restaurant sauvegardées.');
    });
    return;
  }

  // ------- Historique -------

  if (t.id === 'histCharger') { await proteger(rendreHistorique); return; }
  if (t.id === 'histExport')  { exportCsvHistorique(); return; }
});

// Recherche live sur l'historique (sans re-fetch)
document.addEventListener('input', e => {
  if (e.target?.id === 'histRecherche') filtrerEtAfficherHistorique();
});

// ==========================================================================
// Session
// ==========================================================================

async function ouvrirSession(user) {
  restaurantId = user.app_metadata?.restaurant_id;
  if (!restaurantId) { erreur("Ce compte n'est rattaché à aucun restaurant."); return; }
  $('#loginView').style.display = 'none';
  $('#barre').style.display = '';
  $('#appView').style.display = '';
  // Pré-remplir les dates de l'onglet historique.
  $('#histDu').value = nJoursAvant(7);
  $('#histAu').value = aujourdHui();
  await activerOnglet('stats');
}

$('#loginBtn').onclick = async () => {
  try {
    await ouvrirSession(await Store.connexion($('#email').value.trim(), $('#mdp').value));
  } catch (e) { erreur(Store.messageErreur(e)); }
};

$('#mdp').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#logoutBtn').onclick = async () => { await Store.deconnexion(); location.reload(); };

// Thème sombre/clair — même mécanique que la caisse : préférence système
// détectée, choix manuel du gérant conservé en localStorage. Utile quand
// le patron consulte son admin depuis chez lui tard le soir.
function appliquerTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $('#themeBtn');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
}
const themeSauve = localStorage.getItem('qresto.theme');
const themeSysteme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
appliquerTheme(themeSauve || themeSysteme);
$('#themeBtn').onclick = () => {
  const nv = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('qresto.theme', nv);
  appliquerTheme(nv);
};

function retourAuLogin(motif) {
  restaurantId = null;
  $('#barre').style.display = 'none';
  $('#appView').style.display = 'none';
  $('#loginView').style.display = '';
  if (motif) {
    const c = $('#loginView .card');
    if (c && !c.querySelector('.alerte-session')) {
      const b = document.createElement('div');
      b.className = 'alerte-session';
      b.textContent = motif;
      c.insertBefore(b, c.firstChild);
    }
  }
  Store.deconnexion().catch(() => {});
}

window.addEventListener('qresto:session-expiree',
  () => retourAuLogin('Votre session a expiré. Reconnectez-vous.'));

(async () => {
  try {
    const user = await Store.utilisateur();
    if (user) await ouvrirSession(user);
  } catch (e) {
    if (Store.estSessionExpiree(e)) { Store.signalerSessionExpiree(); return; }
    erreur(Store.messageErreur(e));
  }
})();
