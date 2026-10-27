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

  /* --- Suggestions rapides -------------------------------------------------- */
  var SUGG_REPAS = [
    { nom: 'Œufs brouillés (2)', kcal: 180, proteines: 13, glucides: 1, lipides: 14 },
    { nom: 'Banane', kcal: 105, proteines: 1, glucides: 27, lipides: 0 },
    { nom: 'Blanc de poulet 150 g', kcal: 248, proteines: 46, glucides: 0, lipides: 5 },
    { nom: 'Riz cuit 200 g', kcal: 260, proteines: 5, glucides: 56, lipides: 1 },
    { nom: 'Yaourt grec', kcal: 100, proteines: 10, glucides: 6, lipides: 4 },
    { nom: 'Café au lait', kcal: 60, proteines: 3, glucides: 6, lipides: 3 }
  ];
  var SUGG_EXO = [
    { nom: 'Course à pied', duree: 30, kcal: 300 },
    { nom: 'Musculation', duree: 45, kcal: 250 },
    { nom: 'Vélo', duree: 40, kcal: 320 },
    { nom: 'Marche rapide', duree: 30, kcal: 150 },
    { nom: 'Natation', duree: 30, kcal: 280 }
  ];
  function remplirQuick() {
    var qr = $('quickRepas');
    SUGG_REPAS.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s.nom;
      b.addEventListener('click', function () {
        $('rNom').value = s.nom; $('rKcal').value = s.kcal;
        $('rProt').value = s.proteines; $('rGluc').value = s.glucides; $('rLip').value = s.lipides;
      });
      qr.appendChild(b);
    });
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
