/* Vitrine publique d'un restaurant.

   Sous-produit du système de commande, pas un second projet : la carte
   affichée ici est celle de la base. Le restaurateur change un prix dans son
   espace gérant, sa page publique suit dans la seconde.

   E0 est respectée : cette page LIT la carte, la commande n'en dépend pas.
   Retirer cette vitrine ne casse aucun QR code. */

const slug = new URLSearchParams(location.search).get('r');

const prix = variantes => {
  if (!variantes || !variantes.length) return '';
  // Une seule déclinaison « Standard » : le plat paraît n'avoir qu'un prix.
  if (variantes.length === 1 && variantes[0].libelle === 'Standard') {
    return `<span class="p">${fmt.prix(variantes[0].montant)}</span>`;
  }
  return variantes.map(v =>
    `<span class="p"><i>${v.libelle}</i> ${fmt.prix(v.montant)}</span>`).join('');
};

function rendre(r) {
  document.title = `${r.nom} — ${r.ville}`;

  const liens = [
    r.telephone && `<a class="btn" href="tel:${r.telephone.replace(/\s/g, '')}">📞 ${r.telephone}</a>`,
    r.facebook && `<a class="btn ghost" href="${r.facebook}" target="_blank" rel="noopener">Facebook</a>`,
    r.instagram && `<a class="btn ghost" href="${r.instagram}" target="_blank" rel="noopener">Instagram</a>`,
  ].filter(Boolean).join('');

  const carte = r.carte.map(c => `
    <section class="vcat">
      <h2>${c.nom}</h2>
      ${c.plats.map(p => `
        <div class="vplat ${p.disponible ? '' : 'epuise'}">
          <div class="vnom">${p.nom}${p.disponible ? '' : ' <span class="chip payee">Épuisé</span>'}</div>
          ${p.description ? `<div class="vdesc">${p.description}</div>` : ''}
          <div class="vprix">${prix(p.prix)}</div>
        </div>`).join('')}
    </section>`).join('');

  document.querySelector('#page').innerHTML = `
    <header class="vhero">
      <h1>${r.nom}</h1>
      ${r.slogan ? `<p class="vslogan">${r.slogan}</p>` : ''}
      <p class="vinfo">
        ${r.adresse ? `📍 ${r.adresse}` : ''}
        ${r.horaires ? `<br>🕐 ${r.horaires}` : ''}
      </p>
      <div class="vliens">${liens}</div>
    </header>

    <div class="vqr">
      <strong>Commandez depuis votre table</strong>
      <p>Scannez le QR code posé sur votre table : la carte s'ouvre sur votre téléphone,
         vous commandez sans attendre, et vous réglez en caisse.</p>
    </div>

    <div class="wrap narrow">
      ${carte}
      <p class="vpied">Carte mise à jour directement par le restaurant.</p>
    </div>`;
}

(async () => {
  if (!slug) {
    document.querySelector('#page').innerHTML =
      '<div class="empty">Aucun restaurant demandé.</div>';
    return;
  }
  try {
    const r = await Store.vitrine(slug);
    if (!r) throw new Error('Restaurant introuvable');
    rendre(r);
  } catch (e) {
    document.querySelector('#page').innerHTML =
      `<div class="empty">${Store.messageErreur(e)}</div>`;
  }
})();
