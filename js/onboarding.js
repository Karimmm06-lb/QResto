/* =============================================================================
   Onboarding — pilote le questionnaire pas à pas, calcule le plan et sauve le
   profil avant de rediriger vers le tableau de bord.
   ============================================================================= */
(function () {
  'use strict';

  // Si un profil complet existe déjà, on file directement au tableau de bord.
  if (Suivi.profilComplet() && !/[?&]refaire/.test(location.search)) {
    location.replace('tableau-de-bord.html');
    return;
  }

  // Ordre des étapes. « rythme » est sauté quand l'objectif est « maintien ».
  var ETAPES = ['accueil', 'objectif', 'sexe', 'age', 'taille', 'poids', 'activite', 'rythme', 'plan'];
  var profil = { objectif: null, sexe: null, age: null, taille: null, poids: null, activite: null, rythme: 0.5 };
  var i = 0;

  var sections = {};
  document.querySelectorAll('.step').forEach(function (s) { sections[s.dataset.step] = s; });

  var top      = document.getElementById('top');
  var barre    = document.getElementById('barre');
  var pct      = document.getElementById('pct');
  var btnSuiv  = document.getElementById('btnSuivant');
  var btnRet   = document.getElementById('btnRetour');

  /* --- Navigation ----------------------------------------------------------- */
  function etapeActive() { return ETAPES[i]; }

  function sauter(nom) {
    // On masque l'étape rythme si l'objectif est « maintien ».
    return nom === 'rythme' && profil.objectif === 'maintien';
  }

  function afficher() {
    var nom = etapeActive();
    if (sauter(nom)) { i += (sensDernier >= 0 ? 1 : -1); return afficher(); }

    Object.keys(sections).forEach(function (k) { sections[k].classList.toggle('on', k === nom); });

    // Barre de progression (cachée sur l'accueil).
    var surAccueil = nom === 'accueil';
    top.hidden = surAccueil;
    var prog = Math.round((i / (ETAPES.length - 1)) * 100);
    barre.style.width = prog + '%';
    pct.textContent = prog + '%';
    btnRet.hidden = i === 0;

    // Libellé du bouton principal.
    if (surAccueil) btnSuiv.textContent = 'Commencer';
    else if (nom === 'plan') btnSuiv.textContent = 'Accéder à mon tableau de bord';
    else btnSuiv.textContent = 'Continuer';

    if (nom === 'rythme') preparerRythme();
    if (nom === 'plan') remplirPlan();

    majBouton();
    // Focus auto sur les champs numériques.
    var champ = sections[nom].querySelector('input[type=number]');
    if (champ) setTimeout(function () { champ.focus(); }, 300);
    window.scrollTo(0, 0);
  }

  var sensDernier = 1;
  function suivant() {
    if (!etapeValide()) return;
    if (etapeActive() === 'plan') { finaliser(); return; }
    sensDernier = 1;
    i = Math.min(ETAPES.length - 1, i + 1);
    afficher();
  }
  function precedent() {
    sensDernier = -1;
    i = Math.max(0, i - 1);
    afficher();
  }

  /* --- Validation par étape ------------------------------------------------- */
  function etapeValide() {
    switch (etapeActive()) {
      case 'accueil':  return true;
      case 'objectif': return !!profil.objectif;
      case 'sexe':     return !!profil.sexe;
      case 'age':      return profil.age >= 14 && profil.age <= 100;
      case 'taille':   return profil.taille >= 120 && profil.taille <= 230;
      case 'poids':    return profil.poids >= 35 && profil.poids <= 250;
      case 'activite': return !!profil.activite;
      case 'rythme':   return true;
      case 'plan':     return true;
    }
    return true;
  }
  function majBouton() { btnSuiv.disabled = !etapeValide(); }

  /* --- Choix (cartes + segmented) ------------------------------------------- */
  document.querySelectorAll('[data-single]').forEach(function (groupe) {
    var champ = groupe.dataset.single;
    groupe.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        groupe.querySelectorAll('button').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        profil[champ] = b.dataset.val;
        majBouton();
        // Avance automatique après un choix unique (plus fluide).
        setTimeout(suivant, 220);
      });
    });
  });

  /* --- Champs numériques ---------------------------------------------------- */
  [['age', 'age'], ['taille', 'taille'], ['poids', 'poids']].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      profil[pair[1]] = isNaN(v) ? null : v;
      majBouton();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') suivant(); });
  });

  /* --- Slider rythme -------------------------------------------------------- */
  var rythme = document.getElementById('rythme');
  function preparerRythme() {
    var perte = profil.objectif === 'perte';
    document.getElementById('rythmeTitre').textContent = perte ? 'À quelle vitesse perdre ?' : 'À quelle vitesse prendre ?';
    document.getElementById('rythmeSub').textContent = perte
      ? 'Un déficit modéré préserve la masse musculaire.'
      : 'Une prise lente limite le gras superflu.';
    majRythme();
  }
  function majRythme() {
    var v = parseFloat(rythme.value);
    profil.rythme = v;
    document.getElementById('rythmeVal').textContent = v.toString().replace('.', ',');
    var tag = document.getElementById('rythmeTag');
    if (v <= 0.3) tag.textContent = 'Doux · très durable';
    else if (v <= 0.6) tag.textContent = 'Recommandé';
    else if (v <= 0.8) tag.textContent = 'Rapide';
    else tag.textContent = 'Agressif · difficile à tenir';
  }
  rythme.addEventListener('input', majRythme);

  /* --- Écran plan ----------------------------------------------------------- */
  function remplirPlan() {
    var m = Suivi.macros(profil);
    document.getElementById('planKcal').textContent = m.kcal.toLocaleString('fr-FR');
    document.getElementById('planProt').textContent = m.proteines + ' g';
    document.getElementById('planGluc').textContent = m.glucides + ' g';
    document.getElementById('planLip').textContent  = m.lipides + ' g';
    document.getElementById('planBmr').textContent  = Suivi.metabolismeBase(profil).toLocaleString('fr-FR') + ' kcal';
    document.getElementById('planTdee').textContent = Suivi.depenseTotale(profil).toLocaleString('fr-FR') + ' kcal';
    document.getElementById('planImc').textContent  = Suivi.imc(profil).toString().replace('.', ',');
  }

  function finaliser() {
    Suivi.sauverProfil(profil);
    location.href = 'tableau-de-bord.html?bienvenue=1';
  }

  btnSuiv.addEventListener('click', suivant);
  btnRet.addEventListener('click', precedent);

  afficher();
})();
