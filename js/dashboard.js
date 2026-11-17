/* =============================================================================
   Tableau de bord — affiche la journée sélectionnée, gère l'ajout et la
   suppression de repas / exercices, et met à jour l'anneau calorique.
   ============================================================================= */
(function () {
  'use strict';

  // Sans profil, on renvoie vers l'onboarding.
  if (!Suivi.profilComplet()) { location.replace('onboarding.html'); return; }

  var profil = Suivi.getProfil();
  var cibles = profil.cibles;
  var dateCourante = new Date();

  var $ = function (id) { return document.getElementById(id); };

  /* --- En-tête date --------------------------------------------------------- */
  function memeJour(a, b) { return Suivi.clefJour(a) === Suivi.clefJour(b); }
  function libelleDate() {
    var auj = new Date();
    var hier = new Date(); hier.setDate(hier.getDate() - 1);
    if (memeJour(dateCourante, auj)) return "Aujourd'hui";
    if (memeJour(dateCourante, hier)) return 'Hier';
    return dateCourante.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  $('jourPrec').addEventListener('click', function () {
    dateCourante.setDate(dateCourante.getDate() - 1); rendre();
  });
  $('jourSuiv').addEventListener('click', function () {
    var auj = new Date();
    if (memeJour(dateCourante, auj)) return; // pas de futur
    dateCourante.setDate(dateCourante.getDate() + 1); rendre();
  });

  /* --- Anneau calorique ----------------------------------------------------- */
  var R = 60, CIRC = 2 * Math.PI * R;
  var ring = $('ringFg');
  ring.style.strokeDasharray = CIRC;

  function majAnneau(conso, brule) {
    var budget = cibles.kcal + brule;          // le sport augmente le budget
    var reste = budget - conso;
    var ratio = Math.min(1, Math.max(0, conso / budget));
    ring.style.strokeDashoffset = CIRC * (1 - ratio);
    // Rouge si dépassement, émeraude sinon.
    ring.style.stroke = reste < 0 ? 'var(--danger)' : 'var(--accent)';
    $('ringReste').textContent = Math.round(Math.abs(reste)).toLocaleString('fr-FR');
    $('ringReste').parentNode.querySelector('.u').textContent = reste < 0 ? 'kcal dépassées' : 'kcal restantes';
    $('sObjectif').textContent = cibles.kcal.toLocaleString('fr-FR');
    $('sConso').textContent = Math.round(conso).toLocaleString('fr-FR');
    $('sBrule').textContent = Math.round(brule).toLocaleString('fr-FR');
  }

  function majMacro(prefixe, valeur, cible) {
    $(prefixe + 'Val').textContent = Math.round(valeur) + ' g';
    $(prefixe + 'Cible').textContent = '/ ' + cible + ' g';
    $(prefixe + 'Fill').style.width = Math.min(100, (valeur / cible) * 100) + '%';
  }

  /* --- Listes --------------------------------------------------------------- */
  var ICONES_REPAS = { 'Petit-déj': '🌅', 'Déjeuner': '☀️', 'Dîner': '🌙', 'Collation': '🍎' };

  function rendreListeRepas(jour, cle) {
    var box = $('listeRepas');
    box.innerHTML = '';
    if (!jour.repas.length) { box.innerHTML = '<div class="empty">Aucun repas enregistré.</div>'; return; }
    jour.repas.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'entry';
      var meta = [r.type, (r.proteines || 0) + 'P', (r.glucides || 0) + 'G', (r.lipides || 0) + 'L'].filter(Boolean).join(' · ');
      el.innerHTML =
        '<span class="ic">' + (ICONES_REPAS[r.type] || '🍴') + '</span>' +
        '<div class="main"><div class="n"></div><div class="m">' + meta + '</div></div>' +
        '<span class="kcal">' + Math.round(r.kcal || 0) + ' kcal</span>' +
        '<button class="del" aria-label="Supprimer">✕</button>';
      el.querySelector('.n').textContent = r.nom || 'Repas';
      el.querySelector('.del').addEventListener('click', function () {
        Suivi.supprimer(cle, 'repas', r.id); rendre();
      });
      box.appendChild(el);
    });
  }

  function rendreListeExo(jour, cle) {
    var box = $('listeExo');
    box.innerHTML = '';
    if (!jour.exercices.length) { box.innerHTML = '<div class="empty">Aucune séance enregistrée.</div>'; return; }
    jour.exercices.forEach(function (e) {
      var el = document.createElement('div');
      el.className = 'entry';
      el.innerHTML =
        '<span class="ic">🔥</span>' +
        '<div class="main"><div class="n"></div><div class="m">' + (e.duree ? e.duree + ' min' : 'Séance') + '</div></div>' +
        '<span class="kcal burn">−' + Math.round(e.kcal || 0) + ' kcal</span>' +
        '<button class="del" aria-label="Supprimer">✕</button>';
      el.querySelector('.n').textContent = e.nom || 'Exercice';
      el.querySelector('.del').addEventListener('click', function () {
        Suivi.supprimer(cle, 'exercices', e.id); rendre();
      });
      box.appendChild(el);
    });
  }

  /* --- Rendu global --------------------------------------------------------- */
  function rendre() {
    var cle = Suivi.clefJour(dateCourante);
    var jour = Suivi.getJour(cle);
    var t = Suivi.totaux(cle);

    $('dateLbl').textContent = libelleDate();
    $('jourSuiv').style.opacity = memeJour(dateCourante, new Date()) ? '.35' : '1';

    majAnneau(t.kcal, t.brulees);
    majMacro('mp', t.proteines, cibles.proteines);
    majMacro('mg', t.glucides, cibles.glucides);
    majMacro('ml', t.lipides, cibles.lipides);

    $('repasSum').textContent = Math.round(t.kcal) + ' kcal';
    $('exoSum').textContent = '−' + Math.round(t.brulees) + ' kcal';

    rendreListeRepas(jour, cle);
    rendreListeExo(jour, cle);
  }

  /* --- Modale (feuille du bas) ---------------------------------------------- */
  var overlay = $('overlay');
  var sheet = $('sheet');
  var formRepas = $('formRepas');
  var formExo = $('formExo');
  var typeRepas = 'Déjeuner';

  function heureDuJour() {
    var h = new Date().getHours();
    if (h < 11) return 'Petit-déj';
    if (h < 15) return 'Déjeuner';
    if (h < 18) return 'Collation';
    return 'Dîner';
  }

  function ouvrir(type) {
    formRepas.hidden = type !== 'repas';
    formExo.hidden = type !== 'exercice';
    if (type === 'repas') {
      typeRepas = heureDuJour();
      selectionnerType();
    }
    overlay.classList.add('on');
    sheet.classList.add('on');
  }
  function fermer() {
    overlay.classList.remove('on');
    sheet.classList.remove('on');
    formRepas.reset(); formExo.reset();
    alimentChoisi = null;
    var fr = $('foodResults'); if (fr) fr.innerHTML = '';
  }
  overlay.addEventListener('click', fermer);

  document.querySelectorAll('[data-ouvrir]').forEach(function (b) {
    b.addEventListener('click', function () { ouvrir(b.dataset.ouvrir); });
  });

  // Sélecteur de type de repas (matin/midi/soir/snack).
  function selectionnerType() {
    document.querySelectorAll('[data-single=type] button').forEach(function (b) {
      b.classList.toggle('sel', b.dataset.val === typeRepas);
    });
  }
  document.querySelectorAll('[data-single=type] button').forEach(function (b) {
    b.addEventListener('click', function () { typeRepas = b.dataset.val; selectionnerType(); });
  });

  /* --- Recherche d'aliments (base Lidl / Leclerc / Grand Frais) -------------
     L'aliment sélectionné garde ses valeurs pour 100 g ; la quantité (en g)
     recalcule automatiquement calories et macros. */
  var ALIMENTS = window.ALIMENTS || [];
  var alimentChoisi = null; // valeurs pour 100 g de l'aliment sélectionné

  function normaliser(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function rechercher(q) {
    var n = normaliser(q);
    if (!n) return ALIMENTS.slice(0, 8);
    return ALIMENTS.filter(function (a) { return normaliser(a.nom).indexOf(n) !== -1 || normaliser(a.cat).indexOf(n) !== -1; }).slice(0, 10);
  }
  function rendreResultats(q) {
    var box = $('foodResults');
    box.innerHTML = '';
    rechercher(q).forEach(function (a) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'food-res';
      el.innerHTML =
        '<div class="fr-main"><div class="fr-n"></div><div class="fr-m">' +
        a.kcal + ' kcal · ' + a.p + 'P ' + a.g + 'G ' + a.l + 'L / 100 g · ' +
        a.enseignes.join(', ') + '</div></div>' +
        '<div class="fr-price">~' + a.prixPortion.toFixed(2).replace('.', ',') + ' €<small>' + a.portion + ' g</small></div>';
      el.querySelector('.fr-n').textContent = a.nom;
      el.addEventListener('click', function () { choisirAliment(a); });
      box.appendChild(el);
    });
  }
  function choisirAliment(a) {
    alimentChoisi = a;
    $('rNom').value = a.nom;
    $('rQte').value = a.portion;
    recalcDepuisQte();
    $('foodResults').innerHTML = '';
    $('rSearch').value = '';
    $('rQte').focus();
  }
  function recalcDepuisQte() {
    if (!alimentChoisi) return;
    var q = parseFloat($('rQte').value); if (isNaN(q)) return;
    var f = q / 100;
    $('rKcal').value = Math.round(alimentChoisi.kcal * f);
    $('rProt').value = Math.round(alimentChoisi.p * f);
    $('rGluc').value = Math.round(alimentChoisi.g * f);
    $('rLip').value  = Math.round(alimentChoisi.l * f);
  }
  $('rSearch').addEventListener('input', function () { rendreResultats($('rSearch').value); });
  $('rSearch').addEventListener('focus', function () { rendreResultats($('rSearch').value); });
  $('rQte').addEventListener('input', recalcDepuisQte);
  // Si l'utilisateur modifie un champ à la main, on cesse de recalculer.
  ['rKcal', 'rProt', 'rGluc', 'rLip'].forEach(function (id) {
    $(id).addEventListener('input', function () { alimentChoisi = null; });
  });

  /* --- Suggestions rapides d'exercices -------------------------------------- */
  var SUGG_EXO = [
    { nom: 'Course à pied', duree: 30, kcal: 300 },
    { nom: 'Musculation', duree: 45, kcal: 250 },
    { nom: 'Vélo', duree: 40, kcal: 320 },
    { nom: 'Marche rapide', duree: 30, kcal: 150 },
    { nom: 'Natation', duree: 30, kcal: 280 }
  ];
  function remplirQuick() {
    var qe = $('quickExo');
    SUGG_EXO.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s.nom;
      b.addEventListener('click', function () {
        $('eNom').value = s.nom; $('eDuree').value = s.duree; $('eKcal').value = s.kcal;
      });
      qe.appendChild(b);
    });
  }

  function nb(id) { var v = parseFloat($(id).value); return isNaN(v) ? 0 : v; }

  formRepas.addEventListener('submit', function (e) {
    e.preventDefault();
    var nom = $('rNom').value.trim();
    var kcal = nb('rKcal');
    if (!nom && !kcal) { $('rNom').focus(); return; }
    Suivi.ajouterRepas(Suivi.clefJour(dateCourante), {
      nom: nom || 'Repas', type: typeRepas, kcal: kcal,
      proteines: nb('rProt'), glucides: nb('rGluc'), lipides: nb('rLip')
    });
    fermer(); rendre(); toast('Repas ajouté 🍽️');
  });

  formExo.addEventListener('submit', function (e) {
    e.preventDefault();
    var nom = $('eNom').value.trim();
    var kcal = nb('eKcal');
    if (!nom && !kcal) { $('eNom').focus(); return; }
    Suivi.ajouterExercice(Suivi.clefJour(dateCourante), {
      nom: nom || 'Exercice', duree: nb('eDuree'), kcal: kcal
    });
    fermer(); rendre(); toast('Séance ajoutée 🔥');
  });

  /* --- Toast ---------------------------------------------------------------- */
  var toastT;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  remplirQuick();
  rendre();

  if (/[?&]bienvenue/.test(location.search)) {
    setTimeout(function () { toast('Plan configuré, bienvenue ! 🎉'); }, 400);
    history.replaceState(null, '', 'tableau-de-bord.html');
  }
})();
