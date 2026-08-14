/* QResto — planche de QR codes à imprimer et à poser sur les tables.

   Chaque QR encode le jeton de sa table (D3a), jamais son numéro : un numéro
   serait devinable. Le libellé est trilingue pour que le client comprenne
   sans qu'on ait à lui expliquer. */

const $ = s => document.querySelector(s);
let restaurantId = null;

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}

function carte(resto, table, url) {
  const src = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data='
            + encodeURIComponent(url);
  return `<div class="chevalet">
    <div class="chev-resto">${resto}</div>
    <div class="chev-table">Table ${table.numero}</div>
    <img class="chev-qr" src="${src}" alt="QR table ${table.numero}" width="200" height="200">
    <div class="chev-consigne">Scannez pour commander</div>
    <div class="chev-consigne ar">امسح لتطلب</div>
    <div class="chev-consigne">Scan to order</div>
    <div class="chev-pied">Paiement en caisse · الدفع في الصندوق</div>
  </div>`;
}

async function ouvrirSession(user) {
  restaurantId = user.app_metadata?.restaurant_id;
  if (!restaurantId) { erreur("Ce compte n'est rattaché à aucun restaurant."); return; }

  $('#loginView').style.display = 'none';
  $('#barre').style.display = '';
  $('#appView').style.display = '';

  const [tables, ctxResto] = await Promise.all([
    Store.tables(restaurantId),
    Store.restaurant(restaurantId),
  ]);

  // Les QR pointent désormais vers la vitrine (qui prend le relais avec le
  // mode « sur place »). On construit l'URL depuis location.origin + un
  // chemin absolu — la version qui bricolait location.href avec une regex
  // sur « qr.html » cassait quand on ouvrait la page via l'URL courte /qr :
  // la regex ne matchait rien et l'on obtenait /qrresto.html (bug 2026-08-14).
  const base = location.origin + '/resto.html?t=';

  // Garde-fou : générer les QR depuis localhost produit des URLs qui ne
  // fonctionnent que sur le PC du développeur. Un caissier qui imprimerait
  // 12 QR bidons et les poserait sur les tables perdrait un service entier.
  const enLocal = /^(localhost|127\.|10\.|192\.168\.)/i.test(location.hostname);
  if (enLocal) {
    const avert = document.createElement('div');
    avert.className = 'alerte-local';
    avert.innerHTML = `
      <strong>⚠️ Vous êtes en local (${location.origin}).</strong>
      Ces QR pointent vers votre PC — ils ne fonctionneront pas
      depuis un téléphone au restaurant. Ouvrez le site en ligne
      (par exemple <code>https://qresto-team.netlify.app/qr.html</code>)
      pour imprimer les QR à distribuer.`;
    $('#consigne').parentNode.insertBefore(avert, $('#consigne'));
  }

  $('#consigne').textContent =
    `${tables.length} tables · imprimez cette page, découpez, et posez un carton par table. `
    + `Les QR pointent vers ${location.origin}.`;
  $('#feuille').innerHTML = tables.map(t => carte(ctxResto.nom, t, base + t.qr_token)).join('');
}

$('#loginBtn').onclick = async () => {
  try {
    await ouvrirSession(await Store.connexion($('#email').value.trim(), $('#mdp').value));
  } catch (e) { erreur(Store.messageErreur(e)); }
};

$('#mdp').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });
$('#printBtn').onclick = () => window.print();
$('#logoutBtn').onclick = async () => { await Store.deconnexion(); location.reload(); };

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
