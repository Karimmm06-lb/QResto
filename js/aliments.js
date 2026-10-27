/* =============================================================================
   Base d'aliments — produits réels couramment trouvés chez Lidl, Leclerc et
   Grand Frais, avec valeurs nutritionnelles pour 100 g et un PRIX INDICATIF.

   ⚠️ Les prix sont donnés à titre indicatif (France, ~2025-2026) et varient
   selon l'enseigne, la région et les promotions. Ils servent surtout à
   comparer le rapport « protéines par euro » pour un petit budget.

   Champs :
     nom       — libellé
     cat       — catégorie (protéine, féculent, légume, fruit, matière grasse,
                 laitier, épicerie)
     enseignes — où le trouver facilement
     kcal,p,g,l— pour 100 g (p=protéines, g=glucides, l=lipides)
     euroKg    — prix indicatif par kg (de produit comestible / tel que pesé)
     portion   — portion usuelle en grammes (pré-remplie au logging)
   ============================================================================= */
(function (global) {
  'use strict';

  var A = [
    // --- Protéines animales -------------------------------------------------
    { nom: 'Œufs', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 143, p: 13, g: 1, l: 10, euroKg: 4.0, portion: 100 },
    { nom: 'Blanc de poulet', cat: 'protéine', enseignes: ['Leclerc', 'Grand Frais'], kcal: 110, p: 23, g: 0, l: 2, euroKg: 8.5, portion: 150 },
    { nom: 'Cuisses de poulet', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 160, p: 19, g: 0, l: 9, euroKg: 4.5, portion: 150 },
    { nom: 'Steak haché 5% MG', cat: 'protéine', enseignes: ['Lidl', 'Leclerc'], kcal: 130, p: 21, g: 0, l: 5, euroKg: 9.0, portion: 125 },
    { nom: 'Thon en boîte (au naturel)', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 116, p: 26, g: 0, l: 1, euroKg: 9.0, portion: 100 },
    { nom: 'Sardines en boîte', cat: 'protéine', enseignes: ['Lidl', 'Leclerc'], kcal: 185, p: 25, g: 0, l: 10, euroKg: 8.0, portion: 100 },
    { nom: 'Maquereau en boîte', cat: 'protéine', enseignes: ['Lidl', 'Leclerc'], kcal: 200, p: 20, g: 1, l: 13, euroKg: 7.0, portion: 100 },
    { nom: 'Jambon blanc', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 110, p: 18, g: 1, l: 4, euroKg: 9.0, portion: 50 },
    { nom: 'Filet de colin surgelé', cat: 'protéine', enseignes: ['Lidl', 'Leclerc'], kcal: 80, p: 18, g: 0, l: 1, euroKg: 7.5, portion: 150 },

    // --- Protéines végétales ------------------------------------------------
    { nom: 'Lentilles (cuites)', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 116, p: 9, g: 20, l: 0.4, euroKg: 2.5, portion: 200 },
    { nom: 'Pois chiches (conserve)', cat: 'protéine', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 139, p: 8, g: 20, l: 2, euroKg: 2.2, portion: 150 },
    { nom: 'Haricots rouges (conserve)', cat: 'protéine', enseignes: ['Lidl', 'Leclerc'], kcal: 110, p: 8, g: 17, l: 0.5, euroKg: 2.0, portion: 150 },
    { nom: 'Tofu nature', cat: 'protéine', enseignes: ['Grand Frais', 'Leclerc'], kcal: 120, p: 12, g: 2, l: 7, euroKg: 8.0, portion: 100 },

    // --- Laitiers -----------------------------------------------------------
    { nom: 'Skyr nature', cat: 'laitier', enseignes: ['Lidl', 'Leclerc'], kcal: 63, p: 11, g: 4, l: 0.2, euroKg: 3.5, portion: 150 },
    { nom: 'Fromage blanc 0%', cat: 'laitier', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 47, p: 8, g: 4, l: 0.2, euroKg: 2.5, portion: 150 },
    { nom: 'Yaourt nature', cat: 'laitier', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 61, p: 4, g: 5, l: 3, euroKg: 1.8, portion: 125 },
    { nom: 'Lait demi-écrémé', cat: 'laitier', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 46, p: 3, g: 5, l: 1.5, euroKg: 1.0, portion: 200 },
    { nom: 'Emmental râpé', cat: 'laitier', enseignes: ['Lidl', 'Leclerc'], kcal: 370, p: 27, g: 1, l: 29, euroKg: 9.0, portion: 30 },

    // --- Féculents / céréales ----------------------------------------------
    { nom: 'Flocons d’avoine', cat: 'féculent', enseignes: ['Lidl', 'Leclerc'], kcal: 370, p: 13, g: 60, l: 7, euroKg: 2.0, portion: 60 },
    { nom: 'Riz (cuit)', cat: 'féculent', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 130, p: 2.7, g: 28, l: 0.3, euroKg: 1.2, portion: 200 },
    { nom: 'Pâtes (cuites)', cat: 'féculent', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 150, p: 5, g: 30, l: 1, euroKg: 1.0, portion: 200 },
    { nom: 'Pommes de terre', cat: 'féculent', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 77, p: 2, g: 17, l: 0.1, euroKg: 1.2, portion: 250 },
    { nom: 'Pain complet', cat: 'féculent', enseignes: ['Lidl', 'Leclerc'], kcal: 250, p: 9, g: 45, l: 3, euroKg: 2.5, portion: 50 },
    { nom: 'Semoule / couscous (cuit)', cat: 'féculent', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 130, p: 4, g: 27, l: 0.3, euroKg: 1.5, portion: 200 },

    // --- Légumes ------------------------------------------------------------
    { nom: 'Carottes', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 41, p: 1, g: 8, l: 0.2, euroKg: 1.2, portion: 150 },
    { nom: 'Oignons', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 40, p: 1, g: 9, l: 0.1, euroKg: 1.3, portion: 80 },
    { nom: 'Tomates', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 18, p: 1, g: 3.5, l: 0.2, euroKg: 2.5, portion: 150 },
    { nom: 'Courgettes', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 17, p: 1.2, g: 3, l: 0.3, euroKg: 2.0, portion: 200 },
    { nom: 'Brocoli (surgelé)', cat: 'légume', enseignes: ['Lidl', 'Leclerc'], kcal: 34, p: 2.8, g: 4, l: 0.4, euroKg: 2.5, portion: 200 },
    { nom: 'Épinards (surgelés)', cat: 'légume', enseignes: ['Lidl', 'Leclerc'], kcal: 23, p: 2.9, g: 1, l: 0.4, euroKg: 2.0, portion: 200 },
    { nom: 'Poêlée de légumes (surgelée)', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 50, p: 2, g: 7, l: 1, euroKg: 2.5, portion: 200 },
    { nom: 'Salade verte', cat: 'légume', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 15, p: 1.4, g: 1.5, l: 0.2, euroKg: 4.0, portion: 60 },

    // --- Fruits -------------------------------------------------------------
    { nom: 'Banane', cat: 'fruit', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 89, p: 1.1, g: 23, l: 0.3, euroKg: 1.5, portion: 120 },
    { nom: 'Pomme', cat: 'fruit', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 52, p: 0.3, g: 14, l: 0.2, euroKg: 2.0, portion: 150 },
    { nom: 'Orange', cat: 'fruit', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 47, p: 1, g: 9, l: 0.1, euroKg: 1.8, portion: 150 },
    { nom: 'Clémentines', cat: 'fruit', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 47, p: 0.8, g: 10, l: 0.2, euroKg: 2.5, portion: 100 },

    // --- Matières grasses / épicerie ---------------------------------------
    { nom: 'Huile d’olive', cat: 'matière grasse', enseignes: ['Lidl', 'Leclerc'], kcal: 900, p: 0, g: 0, l: 100, euroKg: 8.0, portion: 10 },
    { nom: 'Beurre de cacahuète', cat: 'matière grasse', enseignes: ['Lidl', 'Leclerc'], kcal: 600, p: 25, g: 20, l: 50, euroKg: 6.0, portion: 20 },
    { nom: 'Amandes', cat: 'matière grasse', enseignes: ['Lidl', 'Leclerc', 'Grand Frais'], kcal: 580, p: 21, g: 20, l: 50, euroKg: 14.0, portion: 25 },
    { nom: 'Chocolat noir 70%', cat: 'épicerie', enseignes: ['Lidl', 'Leclerc'], kcal: 550, p: 8, g: 45, l: 36, euroKg: 8.0, portion: 20 }
  ];

  // Protéines (g) par euro, pour classer les meilleurs choix « budget ».
  A.forEach(function (a) {
    a.protParEuro = a.euroKg > 0 ? Math.round((a.p * 10) / a.euroKg) : 0;
    // Coût d'une portion usuelle.
    a.prixPortion = Math.round((a.euroKg * a.portion / 1000) * 100) / 100;
  });

  global.ALIMENTS = A;
})(window);
