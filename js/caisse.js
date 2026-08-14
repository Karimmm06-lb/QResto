/* QResto — poste caisse.

   Deux flux distincts à l'écran, et ce n'est pas un choix esthétique :

   · les TABLES sont groupées par emplacement. Le groupement est aussi le
     dispositif de détection de D3a — une table affichée sans clients à cet
     endroit signale une commande frauduleuse.

   · les commandes À DISTANCE arrivent en « à confirmer ». Rien ne part en
     cuisine avant que le caissier ait appelé le client (R2 + R3). L'appel
     confirme la commande, prouve que le numéro est réel et annonce le délai. */

const $ = s => document.querySelector(s);

const LIB = { a_confirmer: 'À confirmer', nouvelle: 'À imprimer', cuisine: 'En cuisine',
              prete: 'Prête', en_livraison: 'En livraison', servie: 'Servie', annulee: 'Annulée' };

const MODE = { sur_place: '🍽️ Table', a_emporter: '🥡 À emporter', livraison: '🛵 Livraison' };

let sonActif = true;
let vues = new Set();
let premierRendu = true;
let restaurantId = null;
let desabonner = null;

function bip() {
  if (!sonActif) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start(); osc.stop(ctx.currentTime + 0.35);
}

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}

// ------------------------------------------------------------- une commande
function carteCommande(c, session) {
  const distance = session.mode !== 'sur_place';

  const actions = {
    // L'appel EST la validation. Le bouton porte le numéro pour qu'il n'y ait
    // aucune ambiguïté sur ce qu'il faut faire avant de confirmer.
    a_confirmer: `
      <a class="btn sm blue" href="tel:${(session.client_telephone||'').replace(/\s/g,'')}">
        📞 Appeler ${session.client_telephone}</a>
      <button class="btn sm green" data-confirmer="${c.id}">✅ Confirmer</button>
      <button class="btn sm ghost" data-annuler="${c.id}">Refuser</button>`,
    nouvelle: `<button class="btn sm blue" data-print="${c.id}">🖨️ Imprimer</button>
               <button class="btn sm ghost" data-annuler="${c.id}">Annuler</button>`,
    cuisine:  `<button class="btn sm green" data-statut="prete" data-id="${c.id}">✅ Prête</button>
               <button class="btn sm ghost" data-print="${c.id}">Réimprimer</button>
               <button class="btn sm ghost" data-annuler="${c.id}">Annuler</button>`,
    prete: session.mode === 'livraison'
      ? `<button class="btn sm" data-livraison="${c.id}">🛵 Partie en livraison</button>`
      : `<button class="btn sm" data-statut="servie" data-id="${c.id}">🍽️ Remise</button>`,
    en_livraison: `<button class="btn sm" data-statut="servie" data-id="${c.id}">✅ Livrée</button>`,
    servie: '', annulee: '',
  }[c.statut];

  const lignes = c.lignes_commande.filter(l => !l.parent_ligne_id);
  const supps  = l => c.lignes_commande.filter(x => x.parent_ligne_id === l.id);

  return `<div class="cmd">
    <div class="chead">
      <span class="conv">${c.nom_convive || 'Sans nom'}</span>
      <span class="num">N°${c.numero} · ${fmt.heure(c.cree_le)} · ${fmt.depuis(c.cree_le)}</span>
      <span class="spacer"></span>
      <span class="chip ${c.statut}">${LIB[c.statut]}</span>
    </div>
    <ul>${lignes.map(l => `
      <li><span>${l.quantite} × ${l.libelle}</span><span>${fmt.prix(l.quantite * l.prix_unitaire)}</span></li>
      ${supps(l).map(s => `<li class="supp"><span>+ ${s.quantite} × ${s.libelle}</span>
        <span>${fmt.prix(s.quantite * s.prix_unitaire)}</span></li>`).join('')}
    `).join('')}</ul>
    ${c.note ? `<div class="note">📝 ${c.note}</div>` : ''}
    ${c.motif_annulation ? `<div class="note">🚫 ${c.motif_annulation}</div>` : ''}
    ${distance && c.statut === 'a_confirmer'
      ? `<div class="note">⚠️ Appelez le client avant de confirmer — rien ne part en cuisine sans ça.</div>` : ''}
    <div class="actions">${actions}</div>
  </div>`;
}

// -------------------------------------------------------------- une session
function carteSession(s) {
  const cmds = (s.commandes || []).sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
  const actives = cmds.filter(c => c.statut !== 'annulee');
  const distance = s.mode !== 'sur_place';

  const entete = distance
    ? `<span class="tnum">${s.client_nom || 'Client'}</span>
       <span class="badge">${MODE[s.mode]}</span>
       <span class="tmeta">${s.client_telephone || ''}${
         s.zones_livraison ? ` · ${s.zones_livraison.nom}` : ''}</span>`
    : `<span class="tnum">Table ${s.tables_resto?.numero ?? '—'}</span>
       <span class="tmeta">${actives.length} commande${actives.length > 1 ? 's' : ''} · ouverte ${fmt.depuis(s.ouverte_le)}</span>`;

  const details = distance ? `
    ${s.client_adresse ? `<div class="note">📍 ${s.client_adresse}</div>` : ''}
    <div class="tmeta" style="margin-bottom:8px">
      ⏰ ${s.heure_souhaitee ? `Pour ${fmt.heure(s.heure_souhaitee)}` : 'Dès que possible'}
      ${Number(s.frais_livraison) ? ` · Livraison ${fmt.prix(s.frais_livraison)}` : ''}
    </div>` : '';

  return `<div class="card tablecard">
    <div class="thead">${entete}<span class="spacer"></span>
      <span class="ttot">${fmt.prix(s.total)}</span></div>
    ${details}
    ${cmds.map(c => carteCommande(c, s)).join('')}
    <div class="actions" style="margin-top:14px;border-top:1px solid var(--bord);padding-top:12px">
      <button class="btn sm" data-encaisser="${s.id}">
        💵 ${distance && s.mode === 'livraison' ? 'Livrée et payée' : 'Encaisser'} ${fmt.prix(s.total)}</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------------- rendu
async function rafraichir() {
  try {
    const { tables, distance } = await Store.sessionsOuvertes();
    // Session encore valide : on continue le rendu normalement.
    const toutes = [...tables, ...distance];
    const cmds = toutes.flatMap(s => s.commandes || []);

    $('#kConfirmer').textContent = cmds.filter(c => c.statut === 'a_confirmer').length;
    $('#kNew').textContent       = cmds.filter(c => c.statut === 'nouvelle').length;
    $('#kKitchen').textContent   = cmds.filter(c => c.statut === 'cuisine').length;
    $('#kCash').textContent      = fmt.prix(toutes.reduce((t, s) => t + Number(s.total), 0));

    // Empty state accueillant quand rien n'est arrivé — plus utile qu'un
     // simple « aucune commande » froid : rassure le caissier que le poste
     // fonctionne et rappelle ce qu'il faut attendre.
    const attente = premierRendu && !tables.length && !distance.length;

    $('#tables').innerHTML = tables.length
      ? tables.map(carteSession).join('')
      : `<div class="empty attente-caisse">
           <div class="ac-icone" aria-hidden="true">🍽️</div>
           <p class="ac-titre">En attente de la première table</p>
           <p class="ac-desc">Un client scanne le QR de sa table et sa commande apparaît ici en moins de 3 secondes.</p>
         </div>`;

    $('#distance').innerHTML = distance.length
      ? distance.map(carteSession).join('')
      : `<div class="empty attente-caisse">
           <div class="ac-icone" aria-hidden="true">📞</div>
           <p class="ac-titre">Aucune commande à distance</p>
           <p class="ac-desc">Les commandes à emporter et livraison passées depuis la vitrine du restaurant apparaîtront ici.</p>
         </div>`;
    void attente;   // réservé si l'on veut afficher un bandeau global plus tard

    // On ne bipe que sur les commandes réellement nouvelles, jamais au premier
    // affichage — sinon la caisse sonne à chaque rechargement de page.
    const nouvelles = cmds.filter(c => ['nouvelle','a_confirmer'].includes(c.statut) && !vues.has(c.id));
    cmds.forEach(c => vues.add(c.id));
    if (nouvelles.length && !premierRendu) bip();
    premierRendu = false;
  } catch (e) {
    if (Store.estSessionExpiree(e)) { Store.signalerSessionExpiree(); return; }
    erreur(Store.messageErreur(e));
  }
}

// Session expirée : arrêter les abonnements, montrer un message dans la
// carte de login, et laisser le caissier retaper son mot de passe sans
// perdre la page.
function retourAuLogin(motif) {
  if (desabonner) { try { desabonner(); } catch {} desabonner = null; }
  premierRendu = true; vues = new Set(); restaurantId = null;
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

// ---------------------------------------------------------------- impression
async function imprimer(id) {
  const { tables, distance } = await Store.sessionsOuvertes();
  let cmd = null, session = null;
  for (const s of [...tables, ...distance]) {
    const c = (s.commandes || []).find(x => x.id === id);
    if (c) { cmd = c; session = s; break; }
  }
  if (!cmd) return;

  const lignes = cmd.lignes_commande.filter(l => !l.parent_ligne_id);
  const supps  = l => cmd.lignes_commande.filter(x => x.parent_ligne_id === l.id);

  const destination = session.mode === 'sur_place'
    ? `TABLE ${session.tables_resto?.numero}`
    : session.mode === 'livraison' ? 'LIVRAISON' : 'A EMPORTER';

  $('#ticket').innerHTML = `
    <div class="c b big">${destination}</div>
    <div class="c">Commande N°${cmd.numero} — ${fmt.heure(cmd.cree_le)}</div>
    ${cmd.nom_convive ? `<div class="c b">${cmd.nom_convive}</div>` : ''}
    ${session.mode !== 'sur_place' ? `<div class="c">${session.client_telephone || ''}</div>` : ''}
    ${session.heure_souhaitee ? `<div class="c b">POUR ${fmt.heure(session.heure_souhaitee)}</div>` : ''}
    <hr>
    <table>${lignes.map(l => `
      <tr><td class="b">${l.quantite} x</td><td>${l.libelle}</td>
          <td class="r">${l.quantite * l.prix_unitaire}</td></tr>
      ${supps(l).map(s => `<tr><td></td><td>+ ${s.libelle}</td>
          <td class="r">${s.quantite * s.prix_unitaire}</td></tr>`).join('')}
    `).join('')}</table>
    <hr>
    <table><tr><td class="b">TOTAL</td><td class="r b">${cmd.total} DA</td></tr></table>
    ${cmd.note ? `<hr><div><b>NOTE:</b> ${cmd.note}</div>` : ''}
    ${session.client_adresse ? `<hr><div><b>ADRESSE:</b> ${session.client_adresse}</div>` : ''}
    <hr>
    <div class="c">*** ${session.mode === 'livraison' ? 'PAIEMENT A LA LIVRAISON' : 'PAIEMENT EN CAISSE'} ***</div>`;

  if (cmd.statut === 'nouvelle') await Store.imprimer(id);
  window.print();
}

// ------------------------------------------------------------- interactions
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-print]');
  const s = e.target.closest('[data-statut]');
  const a = e.target.closest('[data-annuler]');
  const k = e.target.closest('[data-encaisser]');
  const cf = e.target.closest('[data-confirmer]');
  const lv = e.target.closest('[data-livraison]');

  try {
    if (p)  await imprimer(p.dataset.print);
    if (s)  await Store.changerStatut(s.dataset.id, s.dataset.statut);
    if (cf) await Store.confirmerCommande(cf.dataset.confirmer);
    if (lv) await Store.marquerEnLivraison(lv.dataset.livraison);
    if (a) {
      const motif = prompt("Motif de l'annulation (obligatoire si déjà imprimée) :") ?? '';
      await Store.annuler(a.dataset.annuler, motif);
    }
    if (k) {
      const total = await Store.encaisser(k.dataset.encaisser);
      alert(`Encaissé : ${fmt.prix(total)}`);
    }
    if (p || s || a || k || cf || lv) await rafraichir();
  } catch (err) {
    erreur(Store.messageErreur(err));
  }
});

// ------------------------------------------------------------------ session
async function ouvrirSession(user) {
  restaurantId = user.app_metadata?.restaurant_id;
  if (!restaurantId) { erreur("Ce compte n'est rattaché à aucun restaurant."); return; }

  $('#loginView').style.display = 'none';
  $('#barre').style.display = '';
  $('#appView').style.display = '';

  const r = await Store.restaurant(restaurantId);
  $('#swEmporter').checked = r.emporter_actif;
  $('#swLivraison').checked = r.livraison_active;

  await rafraichir();
  desabonner = await Store.abonnerCommandes(rafraichir);
}

$('#loginBtn').onclick = async () => {
  try {
    await ouvrirSession(await Store.connexion($('#email').value.trim(), $('#mdp').value));
  } catch (e) { erreur(Store.messageErreur(e)); }
};

$('#mdp').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#soundBtn').onclick = e => {
  sonActif = !sonActif;
  e.target.textContent = sonActif ? '🔔 Son' : '🔕 Muet';
};

$('#logoutBtn').onclick = async () => {
  if (desabonner) desabonner();
  await Store.deconnexion();
  location.reload();
};

$('#clotureBtn').onclick = async () => {
  if (!confirm('Clôturer la journée ? Les tables encore ouvertes seront fermées.')) return;
  try {
    const r = await Store.cloturerJournee(restaurantId);
    alert(`Journée ${r.journee} clôturée.\nChiffre d'affaires : ${fmt.prix(r.ca)}` +
          (r.sessions_orphelines ? `\n⚠️ ${r.sessions_orphelines} table(s) fermée(s) sans encaissement.` : ''));
    await rafraichir();
  } catch (e) { erreur(Store.messageErreur(e)); }
};

// Interrupteurs : plus fiables que des horaires programmés, parce qu'un
// restaurant ferme plus tôt, sature, ou tombe en rupture sans prévenir.
['swEmporter', 'swLivraison'].forEach(id => {
  $('#' + id).onchange = async e => {
    const champ = id === 'swEmporter' ? 'emporter_actif' : 'livraison_active';
    try { await Store.basculerMode(restaurantId, champ, e.target.checked); }
    catch (err) { erreur(Store.messageErreur(err)); e.target.checked = !e.target.checked; }
  };
});

(async () => {
  const user = await Store.utilisateur();
  if (user) await ouvrirSession(user);
})();
