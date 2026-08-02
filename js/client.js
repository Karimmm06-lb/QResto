/* QResto — page client (accès par scan du QR de la table) */

const qrToken = new URLSearchParams(location.search).get('t');

let lang = localStorage.getItem('qresto.lang') || 'fr';
let ctx = null;          // restaurant, numéro de table
let menu = null;         // catégories + plats + déclinaisons
let cat = 'all';
let panier = {};         // variante_id -> quantité
let suivi = null;        // fonction d'arrêt de l'interrogation (D22)

const $ = s => document.querySelector(s);
const t = k => I18N[lang][k];
const prix = n => fmt.prix(n, lang);

// D3b : le prénom est mémorisé après la première saisie.
const nomMemorise = () => localStorage.getItem('qresto.nom') || '';

function setLang(next) {
  lang = next;
  localStorage.setItem('qresto.lang', next);
  document.documentElement.lang = next;
  document.documentElement.dir = I18N[next].dir;
  document.querySelectorAll('.langs button').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === next));
  rendre();
}

const nomPlat = p => p[`nom_${lang}`] || p.nom_fr;
const descPlat = p => p[`desc_${lang}`] || p.desc_fr || '';
const nomVariante = v => v[`libelle_${lang}`] || v.libelle_fr;
const estStandard = v => v.libelle_fr === 'Standard';

function articles() {
  const out = [];
  for (const [vid, q] of Object.entries(panier)) {
    if (!q) continue;
    for (const p of menu.plats) {
      const v = p.variantes_plat.find(x => x.id === vid);
      if (v) out.push({ variante: v, plat: p, quantite: q });
    }
  }
  return out;
}

const total = () => articles().reduce((s, a) => s + a.variante.prix * a.quantite, 0);
const nbArticles = () => articles().reduce((s, a) => s + a.quantite, 0);

function rendreCategories() {
  const toutes = [{ id: 'all', nom_fr: 'Tout', nom_ar: 'الكل', nom_en: 'All' }, ...menu.categories];
  $('#cats').innerHTML = toutes.map(c =>
    `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${c[`nom_${lang}`] || c.nom_fr}</button>`
  ).join('');
}

function rendrePlats() {
  const liste = cat === 'all' ? menu.plats : menu.plats.filter(p => p.categorie_id === cat);

  $('#dishes').innerHTML = liste.map(p => {
    // D5 : une seule déclinaison « Standard » est masquée, l'interface
    // ressemble alors à un plat à prix unique.
    const simple = p.variantes_plat.length === 1 && estStandard(p.variantes_plat[0]);

    const lignes = p.variantes_plat.map(v => {
      const q = panier[v.id] || 0;
      const etiquette = simple ? '' : `<span class="vlbl">${nomVariante(v)}</span>`;
      return `<div class="vrow">
          ${etiquette}
          <span class="vprix">${prix(v.prix)}</span>
          <span class="qty">
            ${q > 0 ? `<button data-moins="${v.id}">−</button><span class="n">${q}</span>` : ''}
            <button class="plus" data-plus="${v.id}" ${p.disponible ? '' : 'disabled'}>+</button>
          </span>
        </div>`;
    }).join('');

    return `<div class="card dish ${p.disponible ? '' : 'epuise'}">
        <div class="info">
          <div class="name">${nomPlat(p)} ${p.disponible ? '' : `<span class="chip payee">${t('epuise')}</span>`}</div>
          <div class="desc">${descPlat(p)}</div>
        </div>
        <div class="variantes">${lignes}</div>
      </div>`;
  }).join('');
}

function rendreBarre() {
  const n = nbArticles();
  $('#cartbar').style.display = n ? 'block' : 'none';
  $('#noteBox').style.display = n ? 'block' : 'none';
  $('#cartCount').textContent = `${n} ${t('items')}`;
  $('#cartTotal').textContent = prix(total());
  $('#sendBtn').textContent = t('send');
  $('#note').placeholder = t('note');
  $('#nom').placeholder = t('votreNom');
}

function rendre() {
  if (!ctx || !menu) return;
  $('#tableBadge').textContent = `${t('table')} ${ctx.table_numero}`;
  rendreCategories();
  rendrePlats();
  rendreBarre();
}

function afficherConfirmation(cmd) {
  $('#menuView').style.display = 'none';
  $('#cartbar').style.display = 'none';
  const vue = $('#confirmView');
  vue.style.display = '';

  const eta = cmd.eta_min
    ? `<div class="badge" style="font-size:15px;padding:10px 16px">
         ⏱️ ${t('eta')} ${cmd.eta_min}–${cmd.eta_max} ${t('min')}</div>` : '';

  vue.innerHTML = `
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

  // D22 : interrogation toutes les 10 s, arrêt sur état terminal.
  if (suivi) suivi();
  suivi = Store.suivreCommande(cmd.secret, etat => {
    const chip = $('#statutChip');
    if (!chip) return;
    chip.className = `chip ${etat.statut}`;
    chip.textContent = t('st_' + etat.statut);
  });

  $('#againBtn').onclick = () => {
    if (suivi) { suivi(); suivi = null; }
    panier = {}; $('#note').value = '';
    vue.style.display = 'none';
    $('#menuView').style.display = '';
    rendre();
  };
}

function erreur(message) {
  const b = $('#erreur');
  b.textContent = message;
  b.style.display = 'block';
  setTimeout(() => { b.style.display = 'none'; }, 6000);
}

document.addEventListener('click', e => {
  const plus = e.target.closest('[data-plus]');
  const moins = e.target.closest('[data-moins]');
  const c = e.target.closest('[data-cat]');
  const l = e.target.closest('[data-lang]');

  if (plus)  { panier[plus.dataset.plus] = (panier[plus.dataset.plus] || 0) + 1; rendrePlats(); rendreBarre(); }
  if (moins) { panier[moins.dataset.moins] -= 1; rendrePlats(); rendreBarre(); }
  if (c)     { cat = c.dataset.cat; rendreCategories(); rendrePlats(); }
  if (l)     setLang(l.dataset.lang);
});

async function envoyer() {
  const bouton = $('#sendBtn');
  bouton.disabled = true;                       // évite le double envoi (D10 partiel)
  try {
    const nom = $('#nom').value.trim();
    if (nom) localStorage.setItem('qresto.nom', nom);

    const cmd = await Store.creerCommande({
      qrToken,
      lignes: articles().map(a => ({ variante_id: a.variante.id, quantite: a.quantite })),
      nom,
      note: $('#note').value.trim(),
    });
    afficherConfirmation(cmd);
  } catch (e) {
    erreur(Store.messageErreur(e));
    // Un plat a pu passer en « épuisé » : on recharge le menu.
    menu = await Store.menu(ctx.restaurant_id);
    rendre();
  } finally {
    bouton.disabled = false;
  }
}

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
    $('#restoNom').textContent = ctx.restaurant;
    $('#nom').value = nomMemorise();
    $('#sendBtn').onclick = envoyer;
    setLang(lang);
  } catch (e) {
    document.body.innerHTML =
      `<div class="empty">${Store.messageErreur(e)}</div>`;
  }
})();
