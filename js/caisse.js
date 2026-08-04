/* QResto — poste caisse.

   Réception en temps réel poussé (BNF1, moins de 3 s), impression du ticket
   cuisine, suivi des statuts et encaissement par table.

   La vue est groupée PAR TABLE et non par commande : c'est une exigence de
   D1 (une addition par couvert) et le dispositif de détection de D3a. */

const $ = s => document.querySelector(s);

const LIB = { nouvelle: 'À imprimer', cuisine: 'En cuisine', prete: 'Prête',
              servie: 'Servie', annulee: 'Annulée' };

let sonActif = true;
let vues = new Set();      // commandes déjà affichées, pour ne biper qu'une fois
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

// D5-bis : chaque supplément suit immédiatement le plat qu'il complète.
// Sans cet ordre, le cuistot ne sait pas sur quel plat poser le camembert.
function lignesHierarchisees(c) {
  const lignes = c.lignes_commande || [];
  const parents = lignes.filter(l => !l.parent_ligne_id);
  return parents.flatMap(p => [p, ...lignes.filter(s => s.parent_ligne_id === p.id)]);
}

function carteCommande(c) {
  const actions = {
    nouvelle: `<button class="btn sm blue" data-print="${c.id}">🖨️ Imprimer</button>
               <button class="btn sm ghost" data-annuler="${c.id}">Annuler</button>`,
    cuisine:  `<button class="btn sm green" data-statut="prete" data-id="${c.id}">✅ Prête</button>
               <button class="btn sm ghost" data-print="${c.id}">Réimprimer</button>
               <button class="btn sm ghost" data-annuler="${c.id}">Annuler</button>`,
    prete:    `<button class="btn sm" data-statut="servie" data-id="${c.id}">🍽️ Servie</button>`,
    servie:   '',
    annulee:  '',
  }[c.statut];

  return `<div class="cmd">
    <div class="chead">
      <span class="conv">${c.nom_convive || 'Sans nom'}</span>
      <span class="num" style="color:var(--muted);font-size:13px">
        N°${c.numero} · ${fmt.heure(c.cree_le)} · ${fmt.depuis(c.cree_le)}</span>
      <span class="spacer" style="flex:1"></span>
      <span class="chip ${c.statut}">${LIB[c.statut]}</span>
    </div>
    <ul>${lignesHierarchisees(c).map(l =>
      `<li class="${l.parent_ligne_id ? 'supp' : ''}">
         <span>${l.parent_ligne_id ? '+ ' : ''}${l.quantite} × ${l.libelle}</span>
         <span>${fmt.prix(l.quantite * l.prix_unitaire)}</span></li>`
    ).join('')}</ul>
    ${c.note ? `<div class="note">📝 ${c.note}</div>` : ''}
    ${c.motif_annulation ? `<div class="note">🚫 ${c.motif_annulation}</div>` : ''}
    <div class="actions">${actions}</div>
  </div>`;
}

function carteTable(s) {
  const cmds = (s.commandes || []).sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
  const actives = cmds.filter(c => c.statut !== 'annulee');
  const toutesServies = actives.length > 0 && actives.every(c => c.statut === 'servie');

  return `<div class="card tablecard">
    <div class="thead">
      <span class="tnum">Table ${s.tables_resto.numero}</span>
      <span style="color:var(--muted);font-size:13px">
        ${actives.length} commande${actives.length > 1 ? 's' : ''} · ouverte ${fmt.depuis(s.ouverte_le)}</span>
      <span class="spacer" style="flex:1"></span>
      <span style="font-weight:800;font-size:18px">${fmt.prix(s.total)}</span>
    </div>
    ${cmds.map(carteCommande).join('')}
    <div class="actions" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
      <button class="btn sm ${toutesServies ? '' : 'ghost'}" data-encaisser="${s.id}">
        💵 Encaisser ${fmt.prix(s.total)}</button>
    </div>
  </div>`;
}

async function rafraichir() {
  try {
    const sessions = await Store.sessionsOuvertes();
    const cmds = sessions.flatMap(s => s.commandes || []);

    $('#kNew').textContent     = cmds.filter(c => c.statut === 'nouvelle').length;
    $('#kKitchen').textContent = cmds.filter(c => c.statut === 'cuisine').length;
    $('#kReady').textContent   = cmds.filter(c => c.statut === 'prete').length;
    $('#kCash').textContent    = fmt.prix(sessions.reduce((t, s) => t + Number(s.total), 0));

    $('#tables').innerHTML = sessions.length
      ? sessions.map(carteTable).join('')
      : `<div class="empty">Aucune table en cours.</div>`;

    const nouvelles = cmds.filter(c => c.statut === 'nouvelle' && !vues.has(c.id));
    cmds.forEach(c => vues.add(c.id));
    if (nouvelles.length && !premierRendu) bip();
    premierRendu = false;
  } catch (e) {
    erreur(Store.messageErreur(e));
  }
}

async function imprimer(id) {
  const sessions = await Store.sessionsOuvertes();
  let cmd = null, table = null;
  for (const s of sessions) {
    const c = (s.commandes || []).find(x => x.id === id);
    if (c) { cmd = c; table = s.tables_resto.numero; break; }
  }
  if (!cmd) return;

  $('#ticket').innerHTML = `
    <div class="c b big">QResto</div>
    <hr>
    <div class="c big">TABLE ${table}</div>
    <div class="c">Commande N°${cmd.numero} — ${fmt.heure(cmd.cree_le)}</div>
    ${cmd.nom_convive ? `<div class="c b">${cmd.nom_convive}</div>` : ''}
    <hr>
    <table>${lignesHierarchisees(cmd).map(l =>
      `<tr><td class="b">${l.parent_ligne_id ? '' : l.quantite + ' x'}</td>
           <td>${l.parent_ligne_id ? '&nbsp;&nbsp;+ ' + l.quantite + ' ' : ''}${l.libelle}</td>
           <td class="r">${l.quantite * l.prix_unitaire}</td></tr>`).join('')}</table>
    <hr>
    <table><tr><td class="b">TOTAL</td><td class="r b">${cmd.total} DA</td></tr></table>
    ${cmd.note ? `<hr><div><b>NOTE:</b> ${cmd.note}</div>` : ''}
    <hr>
    <div class="c">*** PAIEMENT EN CAISSE ***</div>`;

  // D2 : l'impression EST l'acte d'engagement.
  if (cmd.statut === 'nouvelle') await Store.imprimer(id);
  window.print();
}

document.addEventListener('click', async e => {
  const p = e.target.closest('[data-print]');
  const s = e.target.closest('[data-statut]');
  const a = e.target.closest('[data-annuler]');
  const k = e.target.closest('[data-encaisser]');

  try {
    if (p) await imprimer(p.dataset.print);
    if (s) await Store.changerStatut(s.dataset.id, s.dataset.statut);
    if (a) {
      // D7 : le motif n'est obligatoire qu'après impression, mais la base
      // tranche — on transmet ce que le caissier saisit, elle refuse si vide.
      const motif = prompt('Motif de l\'annulation (obligatoire si déjà imprimée) :') ?? '';
      await Store.annuler(a.dataset.annuler, motif);
    }
    if (k) {
      const total = await Store.encaisser(k.dataset.encaisser);
      alert(`Encaissé : ${fmt.prix(total)}`);
    }
    if (p || s || a || k) await rafraichir();
  } catch (err) {
    erreur(Store.messageErreur(err));
  }
});

async function ouvrirSession(user) {
  restaurantId = user.app_metadata?.restaurant_id;
  if (!restaurantId) {
    erreur("Ce compte n'est rattaché à aucun restaurant.");
    return;
  }
  $('#loginView').style.display = 'none';
  $('#barre').style.display = '';
  $('#appView').style.display = '';

  await rafraichir();
  desabonner = await Store.abonnerCommandes(rafraichir);   // BNF1
}

$('#loginBtn').onclick = async () => {
  try {
    const user = await Store.connexion($('#email').value.trim(), $('#mdp').value);
    await ouvrirSession(user);
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

(async () => {
  const user = await Store.utilisateur();
  if (user) await ouvrirSession(user);
})();
