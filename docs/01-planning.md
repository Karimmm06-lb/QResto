# Phase 1 — Planification

## 1.1 Contexte

Dans de nombreux restaurants algériens, la prise de commande reste entièrement orale.
Aux heures de pointe, un serveur enchaîne quatre à cinq tables de suite et doit mémoriser
qui a commandé quoi. Trois conséquences observées :

- des **erreurs d'attribution** — un plat servi à la mauvaise table ;
- une **attente client** avant même de pouvoir commander ;
- **aucune trace écrite** des ventes en fin de service.

Ces établissements sont peu équipés en informatique. Leur présence numérique se limite
généralement à une page Facebook. Les solutions existantes (caisses tactiles, bornes de
commande) sont conçues pour des chaînes et supposent un budget et une compétence technique
qu'ils n'ont pas.

## 1.2 Objectif

Permettre au client de commander depuis son propre téléphone, en scannant un QR code posé
sur sa table, sans que le personnel ait à prendre la commande — tout en conservant
**l'encaissement en caisse** et le **ticket papier en cuisine**, deux habitudes auxquelles
ces restaurants tiennent.

## 1.3 Périmètre

### Inclus

- Consultation du menu et prise de commande par le client, sans installation d'application
- Réception des commandes en temps réel sur un poste caisse
- Impression d'un ticket destiné à la cuisine
- Suivi de l'état de la commande côté client
- Statistiques de vente pour le gérant
- Gestion du menu et de la disponibilité des plats

### Explicitement exclu

| Exclusion | Justification |
|---|---|
| Paiement en ligne | Le paiement électronique est peu répandu en Algérie et les restaurateurs tiennent à encaisser eux-mêmes |
| Compte client / inscription | Argument commercial majeur : aucune friction à l'entrée |
| Écran en cuisine | Le cuistot conserve son ticket papier, aucune formation nécessaire |
| Notification au serveur | Contraire à l'objectif : le produit doit **décharger** le serveur |
| Livraison à domicile | Hors du problème traité |
| Gestion de stock | Aucun établissement cible ne tient d'inventaire à jour |

## 1.4 Acteurs

| Acteur | Rôle | Authentifié |
|---|---|---|
| **Client** | Consulte le menu, commande, suit sa commande | Non |
| **Caissier** | Reçoit, imprime, suit les statuts, encaisse | Oui |
| **Gérant** | Gère le menu et les tarifs, consulte les statistiques | Oui |
| **Cuisinier** | Lit le ticket papier | Hors système |
| **Serveur** | Livre les plats | Hors système |

Le cuisinier et le serveur sont des acteurs du **processus** mais n'interagissent pas
avec le logiciel. C'est un choix de conception, pas un oubli.

## 1.5 Contraintes

### Contraintes métier

- Le paiement s'effectue **après** la production du plat — le restaurant engage des coûts
  avant tout encaissement
- Un couvert commande en **plusieurs vagues** mais règle **une seule addition**
- Plusieurs convives d'une même table peuvent commander depuis des téléphones différents

### Contraintes techniques

- Connectivité variable : certains clients utilisent la 4G, d'autres le wifi du restaurant
- Matériel du restaurant limité : un poste caisse, souvent ancien
- Le client peut utiliser n'importe quel téléphone, sans installer quoi que ce soit
- Interface trilingue : français, arabe (sens de lecture inversé), anglais

### Contraintes économiques

- Budget d'équipement du restaurant : imprimante thermique ≈ 3 000–5 000 DA
- Coût d'infrastructure visé : nul au démarrage (plans gratuits)
- Aucun administrateur système côté restaurant

## 1.6 Étude de faisabilité

**Technique — favorable.** Le besoin ne comporte aucune difficulté algorithmique. Le point
sensible est la diffusion temps réel vers le poste caisse, résolu par un service managé
(Supabase Realtime). L'impression passe par le moteur d'impression du navigateur : une
imprimante thermique est vue comme une imprimante ordinaire, aucun pilote spécifique.

**Économique — favorable.** Hébergement statique et base de données gratuits à l'échelle
d'un restaurant. Le seul investissement est l'imprimante, que la plupart possèdent déjà.

**Opérationnelle — point de vigilance.** Le risque n'est pas technique mais humain :
la saisie initiale du menu (plats, prix, photos) représente plusieurs heures de travail
pour un restaurateur qui n'est pas à l'aise avec l'informatique. C'est le principal
obstacle à l'adoption, traité en R4.

## 1.7 Risques

| ID | Risque | Impact | Probabilité | Traitement |
|---|---|---|---|---|
| R1 | Commandes passées depuis l'extérieur via une photo du QR code | Élevé | Moyenne | Vue caisse groupée par table permettant la détection humaine ; code du jour activable en réserve (D3a) |
| R2 | Client qui repart sans payer alors que le plat est produit | Élevé | Faible | L'encaissement reste un acte physique en caisse ; la session de table matérialise la dette (D1) |
| R3 | Coupure internet pendant le service | Élevé | Moyenne | À traiter en phase 3 (décision D12) |
| R4 | Menu non saisi, adoption bloquée | Élevé | **Élevée** | Saisie initiale assurée par l'éditeur lors de l'installation (décision D14) |
| R5 | Panne d'imprimante en plein service | Moyen | Moyenne | Repli sur affichage écran (décision D13) |
| R6 | Plat commandé alors qu'il est épuisé | Moyen | Élevée | Bascule « épuisé » propagée en temps réel (D6) |

R4 est le risque le plus probable et le plus sous-estimé : il est **organisationnel**, pas
technique, et aucune ligne de code ne le résout.

## 1.8 Critères de succès

Le projet est considéré comme réussi si, sur un restaurant pilote :

1. Une commande passée au téléphone apparaît en caisse en **moins de 3 secondes**
2. Le personnel n'a reçu **aucune formation** au-delà d'une démonstration de 10 minutes
3. Le restaurant réalise **une journée complète de service** sans intervention de l'éditeur
4. Le gérant consulte spontanément ses statistiques après le service

Le critère 4 est le plus révélateur : il mesure l'usage réel, pas la conformité technique.

## 1.9 Découpage

| Phase | Contenu | Livrable |
|---|---|---|
| 1. Planification | Périmètre, faisabilité, risques | Ce document |
| 2. Analyse | Besoins, cas d'utilisation, règles de gestion | `02-analyse.md` |
| 3. Conception | Architecture, modèle de données, contrats | `03-conception.md`, `0001_init.sql` |
| 4. Implémentation | Interfaces client / caisse / gérant, backend | Code |
| 5. Tests et intégration | Plan de test, recette sur site pilote | `05-tests.md` |
| 6. Maintenance | Exploitation, supervision, évolutions | `06-maintenance.md` |

**Note méthodologique honnête :** un prototype fonctionnel a été réalisé **avant** la
formalisation des phases 1 à 3. Ce choix visait à valider l'expérience utilisateur et la
faisabilité du temps réel avant d'investir dans l'infrastructure. Les décisions de cadrage
(D1 à D22) ont été prises ensuite et ont conduit à revoir le modèle de données — notamment
l'introduction de la session de table, absente du prototype. C'est le coût assumé de cette
inversion.
