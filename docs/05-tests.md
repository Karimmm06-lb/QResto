# Phase 5 — Tests et intégration

## 5.1 Ce qui est déjà vérifié

### Tests d'intégration sur la base

Rejoués à chaque modification du schéma.

| Règle | Scénario | Attendu | État |
|---|---|---|---|
| RG1, RG2 | Deux convives d'une même table commandent séparément | Une seule session, une seule addition | ✅ |
| BNF6 | Panier de trois lignes | Total recalculé en base, aucun prix reçu du client | ✅ |
| UC2-2a | Jeton de table inventé | Rejet « Table inconnue » | ✅ |
| UC2-5a | Panier vide | Rejet « Commande vide » | ✅ |
| — | Quantité négative, puis 999 | Rejet « Quantité invalide » | ✅ |
| UC2-6a | Panier mixte, un plat épuisé | Commande **entièrement** refusée | ✅ |
| D5-bis | Supplément commandé seul | Rejet | ✅ |
| D5-bis | Plat rattaché comme supplément | Rejet | ✅ |
| BNF7 | Clôture de journée appelée en rôle anonyme | Rejet « Interdit » | ✅ |

### Test de bout en bout

Scan du QR → menu → déclinaisons → suppléments → prénom et remarque → envoi →
réception en caisse **sans rafraîchissement** → impression (passage en cuisine) →
suivi reflété sur le téléphone → prête → servie → encaissement de la table.

Vérifié en local **et** sur la démo publique, contre la base de production.

## 5.2 Ce qui ne peut pas être testé depuis un bureau

Trois décisions restent ouvertes parce qu'elles dépendent de conditions réelles.
Les trancher sans avoir vu un restaurant produirait des hypothèses, pas des décisions.

| ID | Question | Ce qu'il faut observer |
|---|---|---|
| **D12** | Que se passe-t-il si internet coupe pendant le service ? | La qualité et la stabilité de leur connexion, et ce qu'ils font aujourd'hui quand elle tombe |
| **D13** | Que se passe-t-il si l'imprimante tombe en panne ? | Le modèle d'imprimante, sa fiabilité, et si un écran peut servir de repli |
| **D14** | Qui saisit et maintient le menu ? | Qui met la carte à jour aujourd'hui, à quelle fréquence, et sur quel support |

## 5.3 Fiche d'observation sur site

À remplir lors de la première visite. Chaque ligne alimente une décision.

### Le lieu

- [ ] Nombre de tables : ______  *(détermine le nombre de QR à imprimer)*
- [ ] Tables numérotées ? Sinon, comment le personnel les désigne-t-il : ______
- [ ] Affluence en heure de pointe : ______ couverts, entre ____ h et ____ h
- [ ] Combien de serveurs prennent les commandes : ______

### La connexion — alimente D12

- [ ] Wifi disponible pour les clients ? oui / non
- [ ] Opérateur et type d'accès : ______
- [ ] Couverture 4G correcte à l'intérieur ? oui / non
- [ ] **Fréquence des coupures** : ______ *(la réponse décide s'il faut un mode dégradé)*
- [ ] Que font-ils quand ça coupe aujourd'hui : ______

### La caisse — alimente D9 et D13

- [ ] Poste de caisse : PC / tablette / téléphone / aucun
- [ ] Imprimante thermique ? oui / non — modèle : ______
- [ ] Connectée en USB, réseau, ou Bluetooth : ______
- [ ] Une seule personne à la caisse, ou plusieurs par service : ______
- [ ] Que se passe-t-il aujourd'hui si l'imprimante lâche : ______

### Le menu — alimente D14

- [ ] Support actuel : mur / flyer / réseaux sociaux / ardoise
- [ ] Fréquence des changements de prix : ______
- [ ] Qui les décide et qui les applique : ______
- [ ] Photos des plats disponibles ? oui / non
- [ ] Suppléments proposés à l'oral en plus de la carte : ______

### L'encaissement — vérifie D1 et D2

- [ ] Le client paie-t-il à table ou en caisse : ______
- [ ] Une addition par table, ou par personne : ______
- [ ] Arrive-t-il que des clients partent sans payer : ______
- [ ] Comment savent-ils ce que doit une table aujourd'hui : ______

### Réaction à la démonstration

- [ ] Première réaction du gérant : ______
- [ ] Première objection formulée : ______
- [ ] A-t-il essayé lui-même de scanner ? oui / non
- [ ] Ce qu'il a demandé en premier : ______
- [ ] Prêt à un essai sur un service : oui / non

## 5.4 Protocole de démonstration

Une démonstration qui dure plus de dix minutes a échoué. L'objectif est qu'il
**scanne lui-même**.

1. Poser un carton QR sur une table libre du restaurant
2. Ouvrir la page caisse sur l'ordinateur portable, écran tourné vers lui
3. Lui tendre son propre téléphone : « scannez »
4. Le laisser composer une commande sans rien expliquer — **s'il hésite, c'est un défaut d'interface, pas un défaut de compréhension**
5. Sa commande apparaît sur l'écran, avec le bip
6. Imprimer, ou montrer l'aperçu du ticket si aucune imprimante n'est disponible
7. Se taire et écouter

Le point 4 est le vrai test. Toute hésitation observée est à noter telle quelle
dans la fiche : c'est le seul retour d'usage impossible à obtenir autrement.

## 5.5 Critères de réussite du pilote

Repris de la phase 1, à évaluer après un service complet :

1. Une commande apparaît en caisse en **moins de 3 secondes**
2. Le personnel n'a reçu **aucune formation** au-delà d'une démonstration de dix minutes
3. Le restaurant réalise **une journée complète** sans intervention extérieure
4. Le gérant consulte **spontanément** ses statistiques après le service

Le critère 4 reste le plus révélateur : il mesure l'usage réel, pas la conformité
technique.

## 5.6 Points à vérifier sur les cartes importées

Relevés lors de l'import, à confirmer auprès des établissements.

**Black & Silver**
- Deux lignes « Steak haché » à 900 et 950 DA — vérifié deux fois, c'est bien sur leur carte
- « Happy Meal 500 DZ » — unité probablement erronée
- « Eau minérale 30ML » — unité probablement erronée
- « Pizza Black and Silver » importée en format unique, elle n'est marquée que Mega

**Spicy Max**
- Les tailles de pizza ne sont pas nommées sur la carte, importées en « Moyenne » et « Familiale »
- Salades, desserts et le haut de la page boissons non récupérés : les images publiques étaient rognées
