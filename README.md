# QResto

**Commande par QR code pour les restaurants algériens.** Le client scanne le code posé
sur sa table, commande depuis son téléphone, et paie en caisse. Le caissier reçoit la
commande en direct et imprime le ticket pour le cuisinier.

Aucune application à installer, aucun compte à créer, aucun paiement en ligne.

> **En production :** https://qresto-team.netlify.app — pilote Team Restaurant, Aïn Benian, Alger.

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

Trois modes de commande, la même page publique :

| Mode | Comment le client y arrive | Où va la commande |
|---|---|---|
| **Sur place** | Scanne le QR posé sur sa table | Directement en cuisine (statut `nouvelle`) |
| **À emporter** | Ouvre la vitrine (lien / réseaux sociaux) | Caisse en `à confirmer` — le caissier appelle, puis lance en cuisine |
| **Livraison** | Ouvre la vitrine, choisit sa zone | Idem, avec adresse et frais de zone |

Une fois la commande envoyée :

| | Acteur | Action |
|---|---|---|
| 1 | Caissier | La commande apparaît en direct sur son écran, avec un bip |
| 2 | Caissier | Imprime le ticket et le remet au cuisinier |
| 3 | Cuisinier | Prépare — il ne change rien à ses habitudes |
| 4 | Serveur | Livre le plat, le prénom indique le destinataire |
| 5 | Client | Paie la totalité de sa table en caisse |

Le cuisinier et le serveur n'utilisent pas le logiciel. C'est délibéré : moins il y a de
personnes à former, plus l'adoption est rapide.

## Ce qui est volontairement exclu

- **Le paiement en ligne** — peu répandu en Algérie, et les restaurateurs tiennent à encaisser eux-mêmes
- **Le compte client** — aucune inscription, c'est un argument commercial
- **L'écran en cuisine** — le ticket papier suffit
- **La notification au serveur** — l'objectif est de le décharger, pas de lui ajouter du bruit
- **Le bouton « Sur place » sans QR** — un lien direct ne peut pas déclencher une préparation en cuisine (garantie physique de présence, [décision D25](docs/decisions.md#d25))

---

## Architecture

**Jamstack multi-tenant, trois niveaux, sans serveur applicatif, pilotée par les événements.**

```
Téléphone (anonyme)  ─┐
Poste caisse (auth.)  ├─►  Pages statiques (Netlify)  ─►  PostgreSQL managé (Supabase)
Poste gérant (auth.)  ─┘                                  · API + politiques RLS
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

Une seule page côté client, trois côtés staff.

| Fichier | URL propre | Rôle | Accès |
|---|---|---|---|
| `resto.html` | `/resto` ou `/` | Vitrine + carte + panier (sur place / emporter / livraison) | Par QR ou lien, anonyme |
| `caisse.html` | `/caisse` | Réception temps réel, ticket, encaissement, dark mode | Authentifié |
| `admin.html` | `/admin` | Carte, disponibilité, ventes, QR codes | Authentifié |
| `qr.html` | `/qr` | Planche de QR à imprimer et découper | Authentifié |
| `mentions-legales.html` | `/mentions-legales` | Éditeur, hébergement, RGPD / loi 18-07 | Public |
| `client.html` | — | Redirecteur vers `resto.html` (préserve les QR déjà imprimés) | Public |

Toutes les pages staff proposent une navigation croisée dès le formulaire de connexion,
et retombent proprement sur celui-ci quand la session Supabase expire ([D32](docs/decisions.md#d32)).

## Fonctionnalités qualité produit

- **Trilingue FR / AR / EN** avec RTL arabe complet, préférence conservée localement
- **PWA installable** — « Ajouter à l'écran d'accueil » sur mobile
- **Partage social riche** — Open Graph, Twitter Card, données structurées Schema.org Restaurant
- **404 personnalisée** aux couleurs du restaurant
- **Cache-busting automatique** via le hash de commit à chaque build Netlify
- **CSP stricte**, HSTS un an, Permissions-Policy verrouillée
- **Aucun tracker**, aucun cookie tiers

---

## Documentation

| Document | Contenu |
|---|---|
| [Cahier des charges](docs/cahier-des-charges.md) | Périmètre, acteurs, exigences fonctionnelles, exclusions |
| [Diagrammes](docs/diagrammes.md) | Contexte, cas d'utilisation, séquence, états, déploiement |
| [Registre des décisions](docs/decisions.md) | 34 décisions avec justifications et alternatives écartées |
| [Modèle de données](docs/06-modele-donnees.md) | MCD, MLD, dictionnaire des 11 tables |
| [Planification](docs/01-planning.md) · [Analyse](docs/02-analyse.md) · [Conception](docs/03-conception.md) | Phases 1 à 3 |
| [Tests et audit](docs/05-tests.md) | Tests d'intégration passés, audit sécurité 2026-08-13 |
| [Dossier complet](docs/QResto-Dossier-de-projet.docx) | Version Word (regénérée depuis les `.md` via `docs/generer-dossier.py`) |

Le registre des décisions est le document le plus utile pour comprendre le projet :
chaque choix y figure avec **ce qui a été écarté et pourquoi**. Le pivot du 2026-08-14
(mono-tenant + fusion vitrine + parcours QR, décisions D23 à D34) documente également le
raisonnement produit derrière les changements récents.

---

## Installation

### Base de données

Le front est statique : n'importe quel hébergeur suffit. La base se reconstruit à partir
des migrations dans `supabase/migrations/` :

```
0001 → 0009  schéma initial, procédures, index, idempotence, commande à distance, rétention
0010         RPC vitrine_par_jeton (fusion vitrine + parcours QR)
0011         correctifs audit (non-livrables en livraison + RLS zones_livraison)
```

Renseignez ensuite l'adresse du projet Supabase et la clé publiable dans `js/config.js`.
Cette clé est **publique par conception** : toute la sécurité repose sur les politiques
de la base.

### Front

Aucune build step. Netlify sert la racine du dépôt en statique. Le seul script de build
est `scripts/cache-bust.sh` qui réécrit les `?v=…` des HTML avec le hash du commit
courant, pour un cache-busting automatique.

Configuration Netlify (`netlify.toml`) :
- Rewrites `/caisse`, `/admin`, `/qr`, `/resto`, `/mentions-legales` → `.html` correspondant
- Redirection `/client.html` → `/resto.html` (couvre les QR déjà imprimés)
- En-têtes de sécurité : CSP stricte, HSTS, Permissions-Policy, X-Frame-Options

### Comptes staff

Un compte auth par restaurant (`app_metadata.restaurant_id` définit le cloisonnement).
Pour le pilote actuel :

- `team@qresto.dz` — Team Restaurant (accès caisse + admin + qr)

---

## État

Application complète et vérifiée de bout en bout, en production sur
`qresto-team.netlify.app`. Base auditée, deux failles réelles corrigées et documentées
dans [`docs/05-tests.md`](docs/05-tests.md#audit-de-sécurité--2026-08-13).

**Ce qui reste dépend du terrain** : le comportement en cas de coupure internet
(D12), la panne d'imprimante (D13) et la maintenance de la carte par le gérant
(D14) ne peuvent pas être tranchés depuis un bureau. La
[fiche d'observation](docs/05-tests.md) est faite pour ça.

---

*Projet réalisé par Abdelkarim Laabani avec son binôme. Pilote : Team Restaurant, Aïn Benian, Alger.*
