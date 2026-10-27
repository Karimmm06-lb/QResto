/* =============================================================================
   Onboarding — questionnaire pas à pas façon app de macros (goal, stats, poids
   cible, activité, séances, régime, expérience, obstacles, rythme), écran de
   construction animé, puis plan final avec date d'objectif estimée.
   ============================================================================= */
(function () {
  'use strict';

  if (Suivi.profilComplet() && !/[?&]refaire/.test(location.search)) {
    location.replace('tableau-de-bord.html');
    return;
  }

  // Ordre des étapes. « poidsCible » et « rythme » sont sautés si « maintien ».
  var ETAPES = ['accueil', 'objectif', 'sexe', 'age', 'taille', 'poids', 'poidsCible',
    'activite', 'seances', 'regime', 'experience', 'obstacles', 'rythme', 'construction', 'plan'];

  var profil = {
    objectif: null, sexe: null, age: null, taille: null, poids: null, poidsCible: null,
    activite: null, seances: null, regime: null, experience: null, obstacles: [], rythme: 0.5
  };
  var i = 0, sensDernier = 1;

  var sections = {};
  document.querySelectorAll('.step').forEach(function (s) { sections[s.dataset.step] = s; });

  var top     = document.getElementById('top');
  var barre   = document.getElementById('barre');
  var pct     = document.getElementById('pct');
  var foot    = document.getElementById('foot');
  var btnSuiv = document.getElementById('btnSuivant');
  var btnRet  = document.getElementById('btnRetour');

  function etapeActive() { return ETAPES[i]; }
  function sauter(nom) {
    return (nom === 'poidsCible' || nom === 'rythme') && profil.objectif === 'maintien';
  }

  function afficher() {
    var nom = etapeActive();
    if (sauter(nom)) { i += (sensDernier >= 0 ? 1 : -1); return afficher(); }

    Object.keys(sections).forEach(function (k) { sections[k].classList.toggle('on', k === nom); });

    var surAccueil = nom === 'accueil';
    top.hidden = surAccueil;
    // L'écran de construction occupe tout l'espace, sans barre d'action.
    foot.style.display = nom === 'construction' ? 'none' : '';

    var prog = Math.round((i / (ETAPES.length - 1)) * 100);
    barre.style.width = prog + '%';
    pct.textContent = prog + '%';
    btnRet.hidden = i === 0;

    if (surAccueil) btnSuiv.textContent = 'Commencer';
    else if (nom === 'plan') btnSuiv.textContent = 'Accéder à mon tableau de bord';
    else if (nom === 'obstacles') btnSuiv.textContent = 'Continuer';
    else btnSuiv.textContent = 'Continuer';

    if (nom === 'poidsCible') preparerCible();
    if (nom === 'rythme') preparerRythme();
    if (nom === 'construction') lancerConstruction();
    if (nom === 'plan') remplirPlan();

    majBouton();
    var champ = sections[nom].querySelector('input[type=number]');
    if (champ) setTimeout(function () { champ.focus(); }, 300);
    window.scrollTo(0, 0);
  }

  function suivant() {
    if (!etapeValide()) return;
    if (etapeActive() === 'plan') { finaliser(); return; }
    sensDernier = 1;
    i = Math.min(ETAPES.length - 1, i + 1);
    afficher();
  }
  function precedent() { sensDernier = -1; i = Math.max(0, i - 1); afficher(); }

  function etapeValide() {
    switch (etapeActive()) {
      case 'objectif':   return !!profil.objectif;
      case 'sexe':       return !!profil.sexe;
      case 'age':        return profil.age >= 14 && profil.age <= 100;
      case 'taille':     return profil.taille >= 120 && profil.taille <= 230;
      case 'poids':      return profil.poids >= 35 && profil.poids <= 250;
      case 'poidsCible': return profil.poidsCible >= 35 && profil.poidsCible <= 250;
      case 'activite':   return !!profil.activite;
      case 'seances':    return profil.seances !== null;
      case 'regime':     return !!profil.regime;
      case 'experience': return !!profil.experience;
      case 'obstacles':  return true; // facultatif
      default:           return true;
    }
  }
  function majBouton() { btnSuiv.disabled = !etapeValide(); }

  /* --- Choix unique --------------------------------------------------------- */
  document.querySelectorAll('[data-single]').forEach(function (groupe) {
    var champ = groupe.dataset.single;
    groupe.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        groupe.querySelectorAll('button').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        profil[champ] = (champ === 'seances') ? parseInt(b.dataset.val, 10) : b.dataset.val;
        majBouton();
        setTimeout(suivant, 220);
      });
    });
  });

  /* --- Choix multiple (obstacles) ------------------------------------------- */
  document.querySelectorAll('[data-multi]').forEach(function (groupe) {
    var champ = groupe.dataset.multi;
    groupe.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.toggle('sel');
        var v = b.dataset.val;
        var arr = profil[champ];
        var idx = arr.indexOf(v);
        if (idx === -1) arr.push(v); else arr.splice(idx, 1);
      });
    });
  });

  /* --- Champs numériques ---------------------------------------------------- */
  [['age', 'age'], ['taille', 'taille'], ['poids', 'poids'], ['poidsCible', 'poidsCible']].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      profil[pair[1]] = isNaN(v) ? null : v;
      if (pair[1] === 'poidsCible') majEcartCible();
      majBouton();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') suivant(); });
  });

  /* --- Poids cible ---------------------------------------------------------- */
  function preparerCible() {
    document.getElementById('cibleTitre').textContent =
      profil.objectif === 'perte' ? 'Quel poids veux-tu atteindre ?' : 'Quel poids veux-tu viser ?';
    if (profil.poidsCible == null) {
      // Pré-remplissage doux : -4 kg (perte) ou +3 kg (prise).
      var suggestion = profil.objectif === 'perte' ? profil.poids - 4 : profil.poids + 3;
      document.getElementById('poidsCible').value = Math.round(suggestion);
      profil.poidsCible = Math.round(suggestion);
    }
    majEcartCible();
  }
  function majEcartCible() {
    var el = document.getElementById('cibleEcart');
    if (profil.poidsCible == null || profil.poids == null) { el.textContent = ''; return; }
    var d = Math.round((profil.poidsCible - profil.poids) * 10) / 10;
    if (d === 0) el.textContent = 'Identique à ton poids actuel.';
    else el.textContent = (d < 0 ? '↓ ' + Math.abs(d) : '↑ ' + d) + ' kg par rapport à aujourd’hui.';
  }

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

  /* --- Écran de construction ------------------------------------------------ */
  var CIRC = 2 * Math.PI * 52;
  var buildFg = document.getElementById('buildFg');
  buildFg.style.strokeDasharray = CIRC;
  var MESSAGES = [
    'Calcul de ton métabolisme…',
    'Estimation de ta dépense énergétique…',
    'Répartition de tes macros…',
    'Projection de ta date d’objectif…',
    'Dernières optimisations…'
  ];
  function lancerConstruction() {
    var p = 0, mi = 0;
    document.getElementById('buildMsg').textContent = MESSAGES[0];
    buildFg.style.strokeDashoffset = CIRC;
    var t = setInterval(function () {
      p = Math.min(100, p + 2);
      buildFg.style.strokeDashoffset = CIRC * (1 - p / 100);
      document.getElementById('buildPct').textContent = p + '%';
      var nextMi = Math.min(MESSAGES.length - 1, Math.floor(p / 20));
      if (nextMi !== mi) { mi = nextMi; document.getElementById('buildMsg').textContent = MESSAGES[mi]; }
      if (p >= 100) {
        clearInterval(t);
        setTimeout(function () { sensDernier = 1; i = ETAPES.indexOf('plan'); afficher(); }, 350);
      }
    }, 45);
  }

  /* --- Plan final ----------------------------------------------------------- */
  function remplirPlan() {
    var m = Suivi.macros(profil);
    document.getElementById('planKcal').textContent = m.kcal.toLocaleString('fr-FR');
    document.getElementById('planProt').textContent = m.proteines + ' g';
    document.getElementById('planGluc').textContent = m.glucides + ' g';
    document.getElementById('planLip').textContent  = m.lipides + ' g';
    document.getElementById('planBmr').textContent  = Suivi.metabolismeBase(profil).toLocaleString('fr-FR') + ' kcal';
    document.getElementById('planTdee').textContent = Suivi.depenseTotale(profil).toLocaleString('fr-FR') + ' kcal';
    document.getElementById('planImc').textContent  = Suivi.imc(profil).toString().replace('.', ',');

    // Date d'objectif estimée (si perte/prise avec poids cible).
    var banner = document.getElementById('goalBanner');
    if (profil.objectif !== 'maintien' && profil.poidsCible && profil.rythme > 0) {
      var ecart = Math.abs(profil.poids - profil.poidsCible);
      var semaines = Math.ceil(ecart / profil.rythme);
      var d = new Date(); d.setDate(d.getDate() + semaines * 7);
      var dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      document.getElementById('goalDate').textContent = profil.poidsCible.toString().replace('.', ',') + ' kg visés vers le ' + dateStr;
      document.getElementById('goalSub').textContent = '≈ ' + semaines + ' semaines à ' + profil.rythme.toString().replace('.', ',') + ' kg / sem.';
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function finaliser() {
    Suivi.sauverProfil(profil);
    location.href = 'tableau-de-bord.html?bienvenue=1';
  }

  btnSuiv.addEventListener('click', suivant);
  btnRet.addEventListener('click', precedent);

  afficher();
})();
