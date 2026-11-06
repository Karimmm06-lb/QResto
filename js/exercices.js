/* =============================================================================
   Exercices — propose un programme adapté à l'objectif du profil (perte /
   prise / maintien), en version maison (sans matériel) ou salle, et permet de
   journaliser une séance d'un clic.
   ============================================================================= */
(function () {
  'use strict';

  var profil = Suivi.getProfil ? Suivi.getProfil() : null;
  var objectif = profil ? profil.objectif : 'maintien';
  var lieu = 'maison';
  var $ = function (id) { return document.getElementById(id); };

  var LABEL = { perte: 'Perdre du poids', prise: 'Prendre du muscle', maintien: 'Maintien / forme' };
  $('goalLbl').textContent = profil ? LABEL[objectif] : 'Programme';
  $('intro').textContent = profil
    ? 'Programme pensé pour : ' + (LABEL[objectif].toLowerCase()) + '. 3 à 4 séances par semaine.'
    : 'Configure ton profil pour un programme adapté. Voici le programme général.';

  /* --- Catalogue de séances -------------------------------------------------
     Pour chaque objectif et chaque lieu, une liste de séances. Chaque séance :
     { titre, duree (min), kcal (≈ dépense), tag, exos:[ 'description', ... ] }.
     perte  → circuits + cardio (dépense élevée)
     prise  → force, séries plus lourdes, repos plus longs
     maintien → full-body équilibré */
  var PROG = {
    perte: {
      maison: [
        { titre: 'Circuit full-body brûle-graisses', duree: 30, kcal: 300, tag: '3× / semaine', exos: [
          'Échauffement : 3 min montées de genoux',
          '4 tours en continu (40 s effort / 20 s repos) :',
          '• Squats au poids du corps',
          '• Pompes (sur genoux si besoin)',
          '• Fentes alternées',
          '• Mountain climbers',
          '• Gainage planche' ] },
        { titre: 'Cardio HIIT express', duree: 20, kcal: 250, tag: '2× / semaine', exos: [
          '8 rounds : 20 s sprint sur place / 40 s marche',
          'Puis 10 burpees × 3 (repos 1 min)',
          'Retour au calme : 3 min marche' ] },
        { titre: 'Marche rapide / footing', duree: 40, kcal: 280, tag: 'les jours off', exos: [
          '40 min de marche rapide ou footing léger',
          'Idéal le matin à jeun ou après le dîner' ] }
      ],
      salle: [
        { titre: 'Full-body machines + cardio', duree: 50, kcal: 400, tag: '3× / semaine', exos: [
          'Tapis / vélo : 10 min échauffement',
          'Presse à cuisses 4×12',
          'Tirage poitrine 4×12',
          'Développé poitrine machine 4×12',
          'Rowing assis 4×12',
          'Abdos crunch machine 3×15',
          'Finish : 15 min cardio modéré' ] },
        { titre: 'Cardio + abdos', duree: 35, kcal: 330, tag: '2× / semaine', exos: [
          'Rameur ou elliptique 20 min (intervalles)',
          'Gainage 3×45 s',
          'Relevés de jambes 3×15',
          'Russian twists 3×20' ] }
      ]
    },
    prise: {
      maison: [
        { titre: 'Haut du corps (poussée/tirage)', duree: 40, kcal: 220, tag: '2× / semaine', exos: [
          'Pompes lestées (sac à dos) 4×8-12',
          'Pompes diamant 3×10',
          'Dips entre 2 chaises 4×10',
          'Tractions (barre de porte) ou rows sac à dos 4×8',
          'Gainage 3×45 s' ] },
        { titre: 'Bas du corps', duree: 35, kcal: 230, tag: '2× / semaine', exos: [
          'Squats bulgares (1 jambe) 4×10 / jambe',
          'Fentes lestées 4×12',
          'Soulevé de terre jambes tendues (sac) 4×12',
          'Mollets debout 4×20',
          'Chaise au mur 3×45 s' ] }
      ],
      salle: [
        { titre: 'Push (pectoraux / épaules / triceps)', duree: 55, kcal: 260, tag: '1-2× / semaine', exos: [
          'Développé couché 4×6-8',
          'Développé incliné haltères 4×10',
          'Développé militaire 4×8',
          'Élévations latérales 3×15',
          'Extensions triceps poulie 4×12' ] },
        { titre: 'Pull (dos / biceps)', duree: 55, kcal: 260, tag: '1-2× / semaine', exos: [
          'Tractions ou tirage vertical 4×8',
          'Rowing barre 4×8-10',
          'Tirage horizontal 4×10',
          'Curl barre 4×10',
          'Curl marteau 3×12' ] },
        { titre: 'Legs (jambes)', duree: 55, kcal: 300, tag: '1-2× / semaine', exos: [
          'Squat barre 4×6-8',
          'Presse à cuisses 4×10',
          'Fentes haltères 3×12',
          'Leg curl 4×12',
          'Mollets 4×20' ] }
      ]
    },
    maintien: {
      maison: [
        { titre: 'Full-body équilibré', duree: 35, kcal: 260, tag: '3× / semaine', exos: [
          'Squats 4×15',
          'Pompes 4×12',
          'Fentes 3×12 / jambe',
          'Superman (dos) 3×15',
          'Gainage 3×40 s' ] },
        { titre: 'Mobilité + cardio doux', duree: 30, kcal: 200, tag: '1-2× / semaine', exos: [
          '20 min marche rapide ou vélo',
          '10 min étirements / mobilité' ] }
      ],
      salle: [
        { titre: 'Full-body salle', duree: 50, kcal: 320, tag: '3× / semaine', exos: [
          'Échauffement 8 min',
          'Squat ou presse 4×10',
          'Développé couché 4×10',
          'Tirage vertical 4×10',
          'Développé épaules 3×12',
          'Gainage 3×45 s',
          'Cardio 10 min' ] }
      ]
    }
  };

  function rendre() {
    var liste = (PROG[objectif] || PROG.maintien)[lieu] || [];
    var box = $('seances');
    box.innerHTML = '';
    liste.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'ring-card seance';
      var exosHtml = s.exos.map(function (e) { return '<li>' + e + '</li>'; }).join('');
      card.innerHTML =
        '<div class="seance-head">' +
          '<div><div class="seance-t"></div><div class="seance-tag">' + s.tag + '</div></div>' +
          '<div class="seance-kcal">~' + s.kcal + ' kcal<small>' + s.duree + ' min</small></div>' +
        '</div>' +
        '<ul class="seance-exos">' + exosHtml + '</ul>' +
        '<button class="btn-primaire log-btn">✓ J’ai fait cette séance</button>';
      card.querySelector('.seance-t').textContent = s.titre;
      card.querySelector('.log-btn').addEventListener('click', function () {
        Suivi.ajouterExercice(Suivi.clefJour(new Date()), { nom: s.titre, duree: s.duree, kcal: s.kcal });
        toast('Séance ajoutée au journal 🔥');
      });
      box.appendChild(card);
    });
  }

  document.querySelectorAll('[data-single=lieu] button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-single=lieu] button').forEach(function (x) { x.classList.remove('sel'); });
      b.classList.add('sel');
      lieu = b.dataset.val;
      rendre();
    });
  });

  var toastT;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  rendre();
})();
