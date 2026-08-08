# Cahier des charges — QResto

**Version 2** — recentrée sur un établissement pilote et sur la séparation entre le
système de commande et le site vitrine.

Cette version remplace le périmètre défini en phase 1. Les décisions techniques déjà
prises et vérifiées (modèle de données, sécurité, temps réel) restent valides ; ce
document redéfinit **ce qu'on livre, à qui, et dans quel ordre**.

---

## 1. Contexte

Dans de nombreux restaurants algériens, la prise de commande reste entièrement orale.
Aux heures de pointe, un serveur enchaîne quatre à cinq tables et doit mémoriser qui a
commandé quoi. Trois conséquences observées :

- des erreurs d'attribution : un plat servi à la mauvaise table ;
- une attente du client avant même de pouvoir commander ;
- aucune trace écrite des ventes en fin de service.

Ces établissements sont peu équipés. Leur présence numérique se limite le plus souvent à
une page Facebook — **et très souvent à rien du tout**. Les solutions existantes (caisses
tactiles, bornes de commande) sont conçues pour des chaînes et supposent un budget et une
compétence technique qu'ils n'ont pas.

### Le modèle de référence

Le fonctionnement visé est celui d'un McDonald's : le client compose sa commande
lui-même, la commande arrive automatiquement sur un écran côté personnel, et un numéro
identifie la commande jusqu'à sa remise.

Deux différences assumées avec le modèle McDonald's :

| McDonald's | QResto |
|---|---|
| Borne tactile achetée et installée | Le téléphone du client, aucun matériel |
| Paiement à la borne | **Paiement en caisse** — le e-paiement est peu répandu en Algérie |

---

## 2. Séparation des deux produits

C'est la décision structurante de cette version.

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  PRODUIT A                   │     │  PRODUIT B                   │
│  Système de commande QR      │     │  Site vitrine du restaurant  │
│                              │     │                              │
│  • carte consultable          │     │  • présentation, photos      │
│  • prise de commande          │     │  • horaires, adresse, plan   │
│  • écran caisse temps réel    │     │  • contact, réseaux sociaux  │
│  • ticket cuisine             │     │                              │
│  • statistiques               │     │  OPTIONNEL — vendu à part    │
│                              │     │                              │
│  AUTONOME                    │     │                              │
└──────────────┬───────────────┘     └──────────────┬───────────────┘
               │                                     │
               │        lien à sens unique           │
               └◄────────────────────────────────────┘
                  le site peut pointer vers la carte
                  la carte ne dépend jamais du site
```

### Pourquoi les séparer

**Parce que la plupart des restaurants ciblés n'ont pas de site.** Si le système de
commande suppose l'existence d'un site, il n'est vendable à personne. QResto doit
fonctionner pour un restaurant dont la seule présence en ligne est une page Facebook —
ou qui n'en a aucune.

**Parce que ce sont deux métiers et deux prix.** Un site vitrine se vend une fois. Un
système de commande s'installe, se paramètre et s'accompagne. Les mélanger empêche de
chiffrer l'un ou l'autre.

**Parce que le couplage crée une dépendance inutile.** Un site vitrine en panne ne doit
jamais empêcher un client de commander.

### Règle de dépendance

> Le site vitrine peut pointer vers la carte. **La carte ne dépend jamais du site.**

Le QR code posé sur la table mène **directement** au système de commande, jamais à une
page d'accueil intermédiaire. Un client qui scanne veut commander, pas naviguer.

### Périmètre de cette version

- **Produit A — inclus.** C'est le sujet du projet.
- **Produit B — exclu**, mais prévu : le système expose une adresse publique stable que
  n'importe quel site pourra appeler plus tard.

---

## 3. Établissement pilote

Le projet cible **un seul restaurant** jusqu'à ce qu'un service complet ait été réalisé
sans incident.

### Pourquoi un seul

Un deuxième client avant que le premier ne tourne, c'est deux fois les mêmes défauts à
corriger, et deux restaurateurs déçus au lieu d'un client satisfait qui en parle autour
de lui.

### Ce que « pilote » implique

| Élément | Conséquence |
|---|---|
| Modèle de données | **Inchangé.** Le cloisonnement par restaurant est déjà écrit et vérifié ; le retirer coûterait plus cher que le garder |
| Interfaces | Un seul établissement à administrer, aucun écran de sélection |
| Exploitation | Un seul compte, un seul jeu de QR codes, un seul menu à maintenir |
| Commercial | Toute l'attention sur un établissement jusqu'à la preuve d'usage |

**Candidats retenus** (Aïn Benian, Alger) : Black & Silver et Spicy Max. Leurs cartes sont
déjà chargées dans le système, 110 plats au total.

---

## 4. Acteurs

| Acteur | Rôle | Authentifié | Matériel |
|---|---|---|---|
| **Client** | Consulte la carte, commande, suit sa commande | Non | Son propre téléphone |
| **Caissier** | Reçoit, imprime, suit, encaisse | Oui | Un écran, une imprimante |
| **Gérant** | Gère la carte et les tarifs, consulte les ventes | Oui | Un écran |
| **Cuisinier** | Lit le ticket papier | — | Hors système |
| **Serveur** | Livre les plats | — | Hors système |

Le cuisinier et le serveur sont des acteurs du **processus** mais n'interagissent pas
avec le logiciel. C'est un choix de conception : moins il y a de personnes à former,
plus l'adoption est rapide.

---

## 5. Exigences fonctionnelles

### Parcours client

| Réf. | Exigence | Priorité |
|---|---|---|
| F1 | Accéder à la carte en scannant le QR de sa table, sans installation ni compte | Vitale |
| F2 | Naviguer par catégories, sans faire défiler la carte entière | Vitale |
| F3 | Voir pour chaque plat sa composition, ses déclinaisons et son prix | Vitale |
| F4 | Composer une commande et en connaître le montant avant envoi | Vitale |
| F5 | Ajouter des suppléments à un plat précis | Importante |
| F6 | Indiquer son prénom pour la remise du plat | Importante |
| F7 | Joindre une remarque libre | Importante |
| F8 | Choisir la langue : français, arabe, anglais | Importante |
| F9 | Recevoir un **numéro de commande** et une estimation d'attente | Vitale |
| F10 | Suivre l'état de sa commande jusqu'à ce qu'elle soit prête | Importante |
| F11 | Commander de nouveau pendant le repas, sur la même addition | Vitale |

### Parcours caisse

| Réf. | Exigence | Priorité |
|---|---|---|
| F12 | Recevoir les commandes en temps réel, avec alerte sonore | Vitale |
| F13 | Voir les commandes **regroupées par table** | Vitale |
| F14 | Imprimer un ticket pour la cuisine | Vitale |
| F15 | Réimprimer un ticket perdu | Importante |
| F16 | Faire évoluer l'état d'une commande | Importante |
| F17 | Annuler une commande, avec motif si elle est lancée | Vitale |
| F18 | Encaisser une table et connaître le montant dû | Vitale |
| F19 | Basculer un plat en « épuisé », visible immédiatement | Importante |

### Parcours gérant

| Réf. | Exigence | Priorité |
|---|---|---|
| F20 | Gérer la carte : plats, déclinaisons, prix, disponibilité | Vitale |
| F21 | Gérer les tables et éditer les QR codes à imprimer | Vitale |
| F22 | Consulter le chiffre d'affaires du jour | Importante |
| F23 | Identifier les plats les plus vendus et les heures de pointe | Secondaire |
| F24 | Clôturer la journée et figer le chiffre d'affaires | Importante |

---

## 6. Exigences non fonctionnelles

| Réf. | Exigence | Mesure |
|---|---|---|
| N1 | Réactivité du temps réel | Commande visible en caisse en **moins de 3 s** |
| N2 | Aucune friction d'accès | Ni installation, ni compte, ni permission navigateur |
| N3 | Performance en réseau dégradé | Carte affichée en **moins de 3 s** en 3G |
| N4 | Lisibilité mobile | Utilisable d'une main, en salle éclairée |
| N5 | Multilingue | Français, anglais, arabe avec lecture inversée |
| N6 | Intégrité tarifaire | **Aucun prix ne provient du navigateur** |
| N7 | Cloisonnement | Aucun accès croisé entre établissements |
| N8 | Traçabilité | Annulations et encaissements journalisés |
| N9 | Coût d'exploitation | **Nul** pour un restaurant |
| N10 | Prise en main | Poste caisse utilisable après 10 minutes de démonstration |
| N11 | Robustesse réseau | Un double envoi ne crée jamais deux commandes |

---

## 7. Exclusions

| Exclusion | Motif |
|---|---|
| Paiement en ligne | Peu répandu en Algérie ; les restaurateurs tiennent à encaisser |
| Compte client | Argument commercial : aucune inscription |
| Écran en cuisine | Le cuisinier garde son ticket papier |
| Notification au serveur | L'objectif est de le décharger, pas de lui ajouter du bruit |
| Livraison à domicile | Hors du problème traité |
| Gestion de stock | Aucun établissement cible ne tient d'inventaire |
| **Site vitrine** | **Produit distinct, vendu séparément** |

---

## 8. Contraintes

**Métier.** Le paiement intervient après la production. Un couvert commande en plusieurs
vagues mais règle une seule addition. Plusieurs convives d'une même table peuvent
commander depuis des téléphones différents.

**Technique.** Connectivité variable ; matériel limité côté restaurant ; le client
utilise n'importe quel téléphone sans rien installer ; interface trilingue dont une
langue en lecture inversée.

**Économique.** Imprimante thermique ≈ 3 000–5 000 DA, souvent déjà présente.
Infrastructure gratuite. Aucun administrateur système côté restaurant.

---

## 9. Livrables

| Livrable | État |
|---|---|
| Interface client (carte, commande, suivi) | Réalisé |
| Écran caisse temps réel | Réalisé |
| Espace gérant (carte, ventes, QR) | Réalisé |
| Planche de QR codes à imprimer | Réalisé |
| Base de données, sécurité, temps réel | Réalisé et audité |
| Cahier des charges, analyse, conception | Ce document et `docs/` |
| Diagrammes | `docs/diagrammes.md` |
| Recette sur site pilote | **À faire** |
| Site vitrine | **Hors périmètre** |

---

## 10. Critères de réception

Le pilote est réussi si, sur un service complet :

1. Une commande apparaît en caisse en **moins de 3 secondes**
2. Le personnel n'a reçu **aucune formation** au-delà d'une démonstration de 10 minutes
3. Le restaurant réalise **une journée entière** sans intervention extérieure
4. Le gérant consulte **spontanément** ses ventes après le service

Le critère 4 est le plus révélateur : il mesure l'usage réel, pas la conformité technique.
