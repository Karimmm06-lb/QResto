# QResto

**Commande par QR code pour les restaurants algériens.** Le client scanne le code posé
sur sa table, commande depuis son téléphone, et paie en caisse. Le caissier reçoit la
commande en direct et imprime le ticket pour le cuisinier.

Aucune application à installer, aucun compte à créer, aucun paiement en ligne.

---

## Le problème

Dans de nombreux restaurants algériens, la prise de commande reste entièrement orale.
Aux heures de pointe, un serveur enchaîne quatre à cinq tables et doit mémoriser qui a
commandé quoi. D'où des erreurs d'attribution, une attente avant même de pouvoir
commander, et aucune trace écrite des ventes en fin de service.

Ces établissements sont peu équipés : leur présence numérique se limite souvent à une
page Facebook, parfois à rien. Les caisses tactiles et bornes de commande existantes sont
conçues pour des chaînes et supposent un budget qu'ils n'ont pas.

## Le fonctionnement

| | Acteur | Action |
|---|---|---|
| 1 | Client | Scanne le QR de sa table, la carte s'ouvre sur son téléphone |
| 2 | Client | Compose sa commande, indique son prénom, valide |
| 3 | Caissier | La commande apparaît en direct sur son écran, avec un bip |
| 4 | Caissier | Imprime le ticket et le remet au cuisinier |
| 5 | Cuisinier | Prépare — il ne change rien à ses habitudes |
| 6 | Serveur | Livre le plat, le prénom indique le destinataire |
| 7 | Client | Paie la totalité de sa table en caisse |

Le cuisinier et le serveur n'utilisent pas le logiciel. C'est délibéré : moins il y a de
personnes à former, plus l'adoption est rapide.

## Ce qui est volontairement exclu

- **Le paiement en ligne** — peu répandu en Algérie, et les restaurateurs tiennent à encaisser eux-mêmes
- **Le compte client** — aucune inscription, c'est un argument commercial
- **L'écran en cuisine** — le ticket papier suffit
- **La notification au serveur** — l'objectif est de le décharger, pas de lui ajouter du bruit
- **Le site vitrine** — produit distinct : *le site peut pointer vers la carte, la carte ne dépend jamais du site*

---

## Architecture

**Jamstack multi-tenant, trois niveaux, sans serveur applicatif, pilotée par les événements.**

```
Téléphone (anonyme)  ─┐
Poste caisse (auth.)  ├─►  Pages statiques  ─►  PostgreSQL managé
Poste gérant (auth.)  ─┘                        · API + règles de sécurité
                                                · procédures stockées
                                                · diffusion temps réel
```

Le front est du HTML, CSS et JavaScript natifs — aucune dépendance, aucune compilation.
La logique métier et la sécurité vivent dans la base.

### Le principe qui structure tout

> **Le navigateur du client n'est jamais une source de confiance.**

Aucun prix ne transite depuis le téléphone : la procédure de création reçoit des
identifiants de déclinaisons et des quantités, puis recalcule le total en base. Modifier
le JavaScript de la page n'a aucun effet.

Aucune écriture directe n'est autorisée : les tables de commandes n'ont pas de politique
d'insertion, tout passe par des procédures stockées.

### Asymétrie de diffusion

La caisse est **notifiée** par abonnement (moins de 3 s). Le téléphone du client
**interroge** toutes les 10 secondes. Les deux besoins n'ont pas la même exigence de
latence, et ouvrir la lecture des commandes au client permettrait à un concurrent de
compter les ventes du restaurant.

---

## Écrans

| Fichier | Écran | Accès |
|---|---|---|
| `client.html` | Carte, panier, suivi de commande | Par QR, anonyme |
| `caisse.html` | Réception temps réel, ticket, encaissement | Authentifié |
| `admin.html` | Carte, disponibilité, ventes, QR codes | Authentifié |
| `qr.html` | Planche de QR codes à imprimer et découper | Authentifié |

---

## Documentation

| Document | Contenu |
|---|---|
| [Cahier des charges](docs/cahier-des-charges.md) | Périmètre, acteurs, 24 exigences fonctionnelles, exclusions |
| [Diagrammes](docs/diagrammes.md) | Contexte, cas d'utilisation, séquence, états, déploiement |
| [Registre des décisions](docs/decisions.md) | 30 décisions avec justifications et alternatives écartées |
| [Modèle de données](docs/06-modele-donnees.md) | MCD, MLD, dictionnaire des 11 tables |
| [Planification](docs/01-planning.md) · [Analyse](docs/02-analyse.md) · [Conception](docs/03-conception.md) | Phases 1 à 3 |
| [Tests](docs/05-tests.md) | Tests passés et fiche d'observation terrain |
| [Dossier complet](docs/QResto-Dossier-de-projet.docx) | Version Word |

Le registre des décisions est le document le plus utile pour comprendre le projet :
chaque choix y figure avec **ce qui a été écarté et pourquoi**. Deux décisions ont été
rouvertes après confrontation au réel — les cartes des restaurants ciblés ont invalidé
une hypothèse sur les suppléments.

---

## Installation

Le front est statique : n'importe quel hébergeur suffit.

La base se reconstruit à partir des migrations :

```
supabase/migrations/
├── 0001_init.sql              tables, sécurité, procédures
├── 0002_import_restaurant.sql intégration d'un restaurant en un appel
├── 0004_index.sql             index relevés par l'audit de performance
└── 0005_idempotence.sql       protection contre le double envoi
```

Renseignez ensuite l'adresse du projet et la clé publiable dans `js/config.js`. Cette clé
est **publique par conception** : toute la sécurité repose sur les politiques de la base.

---

## État

Application complète et vérifiée de bout en bout. Base en production, auditée — l'audit a
révélé deux failles réelles, corrigées et documentées.

**Ce qui reste dépend du terrain** : le comportement en cas de coupure internet, la panne
d'imprimante et la maintenance de la carte ne peuvent pas être tranchés depuis un bureau.
La [fiche d'observation](docs/05-tests.md) est faite pour ça.

---

*Projet réalisé par Abdelkarim Laabani.*
