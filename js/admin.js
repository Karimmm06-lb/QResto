/* QResto — espace gérant : statistiques, disponibilité des plats, QR codes. */

const $ = s => document.querySelector(s);
let restaurantId = null;

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}

function barres(lignes) {
  if (!lignes.length) return '<div class="empty">Pas encore de données.</div>';
  const max = Math.max(...lignes.map(l => l.valeur));
  return lignes.map(l => `
    <div class="bar">
      <span class="lbl">${l.libelle}</span>
      <span class="track"><span class="fill" style="width:${Math.round(l.valeur / max * 100)}%"></span></span>
      <span class="n">${l.suffixe ? l.valeur.toLocaleString('fr-DZ') + l.suffixe : l.valeur}</span>
    </div>`).join('');
}

async function rendreStats() {
  const sessions = await Store.sessionsDuJour();
  const payees = sessions.filter(s => s.statut === 'payee');
  const ca = payees.reduce((t, s) => t + Number(s.total), 0);

  // D7 : une annulation après impression est une perte réelle, elle doit être visible.
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
}

async function rendreDisponibilite() {
  const { plats } = await Store.menu(restaurantId);
  $('#dispo').innerHTML = plats.map(p => `
    <div class="bar">
      <span class="lbl" style="flex:1">${p.nom_fr}</span>
      <button class="btn sm ${p.disponible ? 'ghost' : ''}"
              data-dispo="${p.id}" data-etat="${p.disponible}">
        ${p.disponible ? 'Disponible' : '🚫 Épuisé'}
      </button>
    </div>`).join('');
}

async function rendreQr() {
  const tables = await Store.tables(restaurantId);
  const base = location.href.replace(/admin\.html.*$/, '') + 'resto.html?t=';
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

document.addEventListener('click', async e => {
  const d = e.target.closest('[data-dispo]');
  if (!d) return;
  try {
    await Store.basculerDisponibilite(d.dataset.dispo, d.dataset.etat !== 'true');
    await rendreDisponibilite();
  } catch (err) { erreur(Store.messageErreur(err)); }
});

async function ouvrirSession(user) {
  restaurantId = user.app_metadata?.restaurant_id;
  if (!restaurantId) { erreur("Ce compte n'est rattaché à aucun restaurant."); return; }
  $('#loginView').style.display = 'none';
  $('#barre').style.display = '';
  $('#appView').style.display = '';
  await Promise.all([rendreStats(), rendreDisponibilite(), rendreQr()]);
}

$('#loginBtn').onclick = async () => {
  try {
    await ouvrirSession(await Store.connexion($('#email').value.trim(), $('#mdp').value));
  } catch (e) { erreur(Store.messageErreur(e)); }
};

$('#mdp').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#logoutBtn').onclick = async () => { await Store.deconnexion(); location.reload(); };

(async () => {
  const user = await Store.utilisateur();
  if (user) await ouvrirSession(user);
})();
