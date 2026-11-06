/* =============================================================================
   Conseils « Courses » — recommandations d'achat et de repas pour un petit
   budget, à partir de la base d'aliments, et adaptées à l'objectif du profil.
   ============================================================================= */
(function () {
  'use strict';

  var ALIMENTS = window.ALIMENTS || [];
  var profil = Suivi.getProfil ? Suivi.getProfil() : null;
  var objectif = profil ? profil.objectif : 'maintien';
  var enseigne = 'Toutes';
  var $ = function (id) { return document.getElementById(id); };

  var LABEL_OBJ = { perte: 'Objectif : perdre du poids', prise: 'Objectif : prendre du muscle', maintien: 'Objectif : maintien' };
  $('goalLbl').textContent = profil ? (LABEL_OBJ[objectif] || 'Petit budget') : 'Petit budget';

  /* --- Paniers hebdomadaires (quantités à acheter), selon l'objectif --------
     Chaque ligne : aliment (nom dans la base), quantité en kg (ou unités de
     ~l'euroKg), libellé de quantité affiché. Le coût est calculé via euroKg. */
  function trouver(nom) { return ALIMENTS.filter(function (a) { return a.nom === nom; })[0]; }

  var PANIERS = {
    perte: {
      note: 'Beaucoup de protéines et de légumes pour tenir sans avoir faim, féculents modérés.',
      lignes: [
        ['Œufs', 1.2, '20 œufs'],
        ['Cuisses de poulet', 1, '1 kg'],
        ['Thon en boîte (au naturel)', 0.4, '4 boîtes'],
        ['Skyr nature', 1, '1 kg'],
        ['Fromage blanc 0%', 1, '1 kg'],
        ['Lentilles (cuites)', 0.8, '1 boîte + 250 g sec'],
        ['Flocons d’avoine', 0.5, '500 g'],
        ['Riz (cuit)', 0.5, '~170 g cru'],
        ['Brocoli (surgelé)', 1, '1 kg'],
        ['Poêlée de légumes (surgelée)', 1, '1 kg'],
        ['Carottes', 1, '1 kg'],
        ['Tomates', 0.5, '500 g'],
        ['Pomme', 1, '1 kg'],
        ['Banane', 1, '1 kg']
      ]
    },
    prise: {
      note: 'Surplus calorique propre : féculents généreux + protéines + bons lipides.',
      lignes: [
        ['Œufs', 1.8, '30 œufs'],
        ['Cuisses de poulet', 1, '1 kg'],
        ['Steak haché 5% MG', 0.5, '500 g'],
        ['Skyr nature', 1, '1 kg'],
        ['Flocons d’avoine', 1, '1 kg'],
        ['Riz (cuit)', 1, '~350 g cru'],
        ['Pâtes (cuites)', 1, '500 g'],
        ['Pommes de terre', 2.5, '2,5 kg'],
        ['Beurre de cacahuète', 0.4, '1 pot'],
        ['Lait demi-écrémé', 2, '2 L'],
        ['Poêlée de légumes (surgelée)', 1, '1 kg'],
        ['Banane', 1.5, '1,5 kg']
      ]
    },
    maintien: {
      note: 'Assiette équilibrée : une protéine, un féculent, des légumes à chaque repas.',
      lignes: [
        ['Œufs', 1.2, '20 œufs'],
        ['Cuisses de poulet', 1, '1 kg'],
        ['Thon en boîte (au naturel)', 0.3, '3 boîtes'],
        ['Skyr nature', 1, '1 kg'],
        ['Flocons d’avoine', 0.5, '500 g'],
        ['Riz (cuit)', 0.7, '~250 g cru'],
        ['Pâtes (cuites)', 0.5, '500 g'],
        ['Pommes de terre', 1.5, '1,5 kg'],
        ['Pois chiches (conserve)', 0.4, '1 boîte'],
        ['Poêlée de légumes (surgelée)', 1, '1 kg'],
        ['Carottes', 1, '1 kg'],
        ['Banane', 1, '1 kg'],
        ['Pomme', 1, '1 kg']
      ]
    }
  };

  /* --- Idées de repas, selon l'objectif ------------------------------------- */
  var REPAS = {
    perte: {
      note: 'Rassasiant et riche en protéines, autour de 350-500 kcal par repas.',
      items: [
        ['🌅 Petit-déj', 'Skyr + flocons d’avoine + banane', '~330 kcal · 25 g prot · ~0,70 €'],
        ['☀️ Déjeuner', 'Cuisses de poulet + brocoli + riz (petite part)', '~480 kcal · 40 g prot · ~1,80 €'],
        ['🌙 Dîner', 'Omelette 3 œufs + poêlée de légumes', '~380 kcal · 24 g prot · ~1,10 €'],
        ['🍎 Collation', 'Fromage blanc 0% + pomme', '~130 kcal · 13 g prot · ~0,70 €']
      ]
    },
    prise: {
      note: 'Calorique et pratique, autour de 600-800 kcal par repas.',
      items: [
        ['🌅 Petit-déj', 'Flocons d’avoine + lait + beurre de cacahuète + banane', '~650 kcal · 25 g prot · ~0,90 €'],
        ['☀️ Déjeuner', 'Poulet + riz généreux + légumes + huile d’olive', '~750 kcal · 45 g prot · ~2,20 €'],
        ['🌙 Dîner', 'Steak haché + pommes de terre + poêlée', '~700 kcal · 38 g prot · ~2,40 €'],
        ['🍎 Collation', 'Skyr + flocons + 2 c. beurre de cacahuète', '~400 kcal · 26 g prot · ~0,90 €']
      ]
    },
    maintien: {
      note: 'Équilibré, autour de 450-650 kcal par repas.',
      items: [
        ['🌅 Petit-déj', 'Œufs brouillés + pain complet + fruit', '~420 kcal · 22 g prot · ~0,90 €'],
        ['☀️ Déjeuner', 'Poulet + riz + légumes', '~600 kcal · 40 g prot · ~2,00 €'],
        ['🌙 Dîner', 'Thon + pâtes + tomates', '~520 kcal · 32 g prot · ~1,60 €'],
        ['🍎 Collation', 'Skyr + banane', '~210 kcal · 18 g prot · ~0,80 €']
      ]
    }
  };

  /* --- Rendu : meilleures protéines par euro -------------------------------- */
  function rendreTopProt() {
    var liste = ALIMENTS.filter(function (a) {
      return a.p >= 8 && (enseigne === 'Toutes' || a.enseignes.indexOf(enseigne) !== -1);
    }).sort(function (x, y) { return y.protParEuro - x.protParEuro; }).slice(0, 8);

    var box = $('topProt');
    box.innerHTML = '';
    liste.forEach(function (a) {
      var el = document.createElement('div');
      el.className = 'entry';
      el.innerHTML =
        '<span class="ic">💪</span>' +
        '<div class="main"><div class="n"></div><div class="m">' + a.p + ' g prot / 100 g · ~' + a.euroKg.toFixed(1).replace('.', ',') + ' €/kg · ' + a.enseignes.join(', ') + '</div></div>' +
        '<span class="kcal" style="color:var(--accent)">' + a.protParEuro + ' g/€</span>';
      el.querySelector('.n').textContent = a.nom;
      box.appendChild(el);
    });
  }

  /* --- Rendu : panier de la semaine ----------------------------------------- */
  function rendrePanier() {
    var p = PANIERS[objectif] || PANIERS.maintien;
    $('panierNote').textContent = p.note;
    var box = $('panier');
    box.innerHTML = '';
    var total = 0;
    p.lignes.forEach(function (ligne) {
      var a = trouver(ligne[0]);
      if (!a) return;
      var kg = ligne[1];
      var cout = a.euroKg * kg;
      // On n'affiche pas les articles d'une autre enseigne quand un filtre est actif.
      if (enseigne !== 'Toutes' && a.enseignes.indexOf(enseigne) === -1) return;
      total += cout;
      var el = document.createElement('div');
      el.className = 'entry';
      el.innerHTML =
        '<span class="ic">🛒</span>' +
        '<div class="main"><div class="n"></div><div class="m">' + ligne[2] + ' · ' + a.enseignes.join(', ') + '</div></div>' +
        '<span class="kcal">~' + cout.toFixed(2).replace('.', ',') + ' €</span>';
      el.querySelector('.n').textContent = a.nom;
      box.appendChild(el);
    });
    $('panierTotal').textContent = '~' + total.toFixed(0) + ' € / sem.';
    if (!box.children.length) box.innerHTML = '<div class="empty">Aucun article pour cette enseigne.</div>';
  }

  /* --- Rendu : idées de repas ----------------------------------------------- */
  function rendreIdees() {
    var r = REPAS[objectif] || REPAS.maintien;
    $('repasNote').textContent = r.note;
    var box = $('idees');
    box.innerHTML = '';
    r.items.forEach(function (it) {
      var el = document.createElement('div');
      el.className = 'entry';
      el.innerHTML =
        '<div class="main"><div class="n"></div><div class="m">' + it[2] + '</div></div>';
      var n = el.querySelector('.n');
      n.textContent = it[0] + ' — ' + it[1];
      box.appendChild(el);
    });
  }

  /* --- Filtre enseigne ------------------------------------------------------ */
  document.querySelectorAll('[data-single=enseigne] button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-single=enseigne] button').forEach(function (x) { x.classList.remove('sel'); });
      b.classList.add('sel');
      enseigne = b.dataset.val;
      rendreTopProt(); rendrePanier();
    });
  });

  if (!profil) {
    $('intro').textContent = 'Configure ton profil pour des conseils adaptés à ton objectif.';
  }
  rendreTopProt();
  rendrePanier();
  rendreIdees();
})();
