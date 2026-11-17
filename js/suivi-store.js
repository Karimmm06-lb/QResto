/* =============================================================================
   Suivi — moteur de données

   Une petite application de suivi nutrition + sport, dans l'esprit de
   macrosave.me : l'utilisateur répond à quelques questions (onboarding), on en
   déduit son objectif calorique et ses macros, puis il journalise ses repas et
   ses séances au quotidien.

   Aucun serveur : tout est stocké dans le localStorage du navigateur. Ce
   module expose un objet global `Suivi` partagé par l'onboarding et le tableau
   de bord.
   ============================================================================= */
(function (global) {
  'use strict';

  var CLE_PROFIL  = 'suivi.profil.v1';
  var CLE_JOURNAL = 'suivi.journal.v1';

  /* --- Persistance ---------------------------------------------------------
     Tous les accès au localStorage passent par ici et sont protégés : en
     navigation privée ou si le stockage est bloqué, l'app continue de tourner
     (données en mémoire pour la session en cours). */
  var memoire = {};
  function lire(cle) {
    try {
      var brut = global.localStorage.getItem(cle);
      return brut ? JSON.parse(brut) : null;
    } catch (e) {
      return memoire[cle] || null;
    }
  }
  function ecrire(cle, valeur) {
    memoire[cle] = valeur;
    try {
      global.localStorage.setItem(cle, JSON.stringify(valeur));
    } catch (e) { /* stockage indisponible : on garde en mémoire */ }
  }

  /* --- Calculs nutritionnels ----------------------------------------------- */

  // Métabolisme de base — formule de Mifflin-St Jeor (la plus utilisée).
  function metabolismeBase(p) {
    var base = 10 * p.poids + 6.25 * p.taille - 5 * p.age;
    return Math.round(base + (p.sexe === 'homme' ? 5 : -161));
  }

  // Facteurs d'activité classiques appliqués au métabolisme de base.
  var FACTEURS = {
    sedentaire: 1.2,   // bureau, peu de marche
    leger:      1.375, // sport 1-2×/semaine
    modere:     1.55,  // sport 3-4×/semaine
    intense:    1.725, // sport 5-6×/semaine
    athlete:    1.9    // sport quotidien intense / métier physique
  };

  // Dépense énergétique journalière totale (TDEE).
  function depenseTotale(p) {
    return Math.round(metabolismeBase(p) * (FACTEURS[p.activite] || 1.2));
  }

  // Ajustement calorique selon l'objectif et le rythme choisi (kg / semaine).
  // 1 kg de masse grasse ≈ 7700 kcal → déficit/surplus quotidien = rythme × 7700 / 7.
  function objectifCalorique(p) {
    var tdee = depenseTotale(p);
    var ecart = Math.round((p.rythme || 0) * 7700 / 7);
    var cible;
    if (p.objectif === 'perte')      cible = tdee - ecart;
    else if (p.objectif === 'prise') cible = tdee + ecart;
    else                             cible = tdee;
    // Garde-fou : jamais sous le métabolisme de base × 1.05, ni sous 1200 kcal.
    var plancher = Math.max(1200, Math.round(metabolismeBase(p) * 1.05));
    return Math.max(plancher, cible);
  }

  // Répartition des macros. Protéines prioritaires (2 g/kg), lipides à 25 % des
  // calories, glucides sur le reste. 1 g protéine/glucide = 4 kcal, lipide = 9.
  function macros(p) {
    var kcal = objectifCalorique(p);
    var prot = Math.round(p.poids * 2);
    var lip  = Math.round((kcal * 0.25) / 9);
    var kcalRestantes = kcal - (prot * 4) - (lip * 9);
    var gluc = Math.max(0, Math.round(kcalRestantes / 4));
    return { kcal: kcal, proteines: prot, lipides: lip, glucides: gluc };
  }

  // IMC, pour information.
  function imc(p) {
    var m = p.taille / 100;
    return Math.round((p.poids / (m * m)) * 10) / 10;
  }

  /* --- Profil --------------------------------------------------------------- */
  function getProfil()        { return lire(CLE_PROFIL); }
  function sauverProfil(p) {
    p.maj = Date.now();
    var complet = Object.assign({}, p, {
      cibles: macros(p),
      tdee: depenseTotale(p),
      metabolismeBase: metabolismeBase(p),
      imc: imc(p)
    });
    ecrire(CLE_PROFIL, complet);
    return complet;
  }
  function profilComplet() {
    var p = getProfil();
    return !!(p && p.sexe && p.age && p.taille && p.poids && p.objectif && p.activite);
  }

  /* --- Journal (repas + séances) -------------------------------------------
     Structure : { "2026-10-27": { repas: [...], exercices: [...] }, ... } */
  function clefJour(date) {
    var d = date ? new Date(date) : new Date();
    // Clé locale YYYY-MM-DD (pas de décalage UTC).
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var j = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + j;
  }
  function getJournal() { return lire(CLE_JOURNAL) || {}; }
  function getJour(cle) {
    var j = getJournal();
    return j[cle] || { repas: [], exercices: [] };
  }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function ajouterRepas(cle, repas) {
    var j = getJournal();
    var jour = j[cle] || { repas: [], exercices: [] };
    repas.id = id();
    repas.heure = Date.now();
    jour.repas.push(repas);
    j[cle] = jour;
    ecrire(CLE_JOURNAL, j);
    return repas;
  }
  function ajouterExercice(cle, ex) {
    var j = getJournal();
    var jour = j[cle] || { repas: [], exercices: [] };
    ex.id = id();
    ex.heure = Date.now();
    jour.exercices.push(ex);
    j[cle] = jour;
    ecrire(CLE_JOURNAL, j);
    return ex;
  }
  function supprimer(cle, type, elementId) {
    var j = getJournal();
    var jour = j[cle];
    if (!jour) return;
    jour[type] = (jour[type] || []).filter(function (x) { return x.id !== elementId; });
    j[cle] = jour;
    ecrire(CLE_JOURNAL, j);
  }

  // Totaux d'une journée : consommé, brûlé, net, macros.
  function totaux(cle) {
    var jour = getJour(cle);
    var t = { kcal: 0, proteines: 0, lipides: 0, glucides: 0, brulees: 0 };
    jour.repas.forEach(function (r) {
      t.kcal += r.kcal || 0;
      t.proteines += r.proteines || 0;
      t.lipides += r.lipides || 0;
      t.glucides += r.glucides || 0;
    });
    jour.exercices.forEach(function (e) { t.brulees += e.kcal || 0; });
    t.net = t.kcal - t.brulees;
    return t;
  }

  function reset() {
    try {
      global.localStorage.removeItem(CLE_PROFIL);
      global.localStorage.removeItem(CLE_JOURNAL);
    } catch (e) {}
    memoire = {};
  }

  global.Suivi = {
    FACTEURS: FACTEURS,
    metabolismeBase: metabolismeBase,
    depenseTotale: depenseTotale,
    objectifCalorique: objectifCalorique,
    macros: macros,
    imc: imc,
    getProfil: getProfil,
    sauverProfil: sauverProfil,
    profilComplet: profilComplet,
    clefJour: clefJour,
    getJournal: getJournal,
    getJour: getJour,
    ajouterRepas: ajouterRepas,
    ajouterExercice: ajouterExercice,
    supprimer: supprimer,
    totaux: totaux,
    reset: reset
  };
})(window);
