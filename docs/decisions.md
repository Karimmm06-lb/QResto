# Registre des décisions

Chaque décision structurante est consignée ici avec sa justification. Une décision
tranchée n'est pas rouverte sans motif explicite.

**Types :** `métier` (règle du domaine) · `produit` (arbitrage d'usage) ·
`technique` (choix d'outil) · `architecture` (structure du système)

---

## Décisions arrêtées

### D1 — Unité de facturation : la session de table
**Type :** métier · **Statut :** arrêtée

Une entité `sessions` s'intercale entre la table physique et les commandes. Une session
représente un couvert : elle s'ouvre à la première commande et se ferme à l'encaissement.

*Pourquoi :* un groupe commande en plusieurs vagues mais règle une seule addition. Sans
session, le caissier doit deviner quelles commandes vont ensemble. Résout également le cas
de plusieurs convives commandant depuis des téléphones différents.

*Alternative écartée :* commande = addition, modèle du comptoir de fast-food. Inadapté au
service à table.

---

### D2 — Exécution directe, sans validation humaine
**Type :** produit · **Statut :** arrêtée

La commande est immédiatement exécutable. L'**impression du ticket** constitue l'acte
d'engagement. Le caissier peut annuler tant que le ticket n'est pas imprimé.

*Pourquoi :* imposer une validation déplacerait le goulot d'étranglement du serveur vers
le caissier — le problème d'origine ne serait pas résolu.

*Réserve prévue :* `restaurants.validation_requise`, désactivé par défaut.

---

### D3a — Contrôle d'accès par jeton statique
**Type :** architecture · **Statut :** arrêtée

Chaque table porte un `qr_token` (UUID) encodé dans son QR code. La détection des
commandes frauduleuses est **humaine** : la vue caisse est groupée par table, le caissier
voit la salle et annule ce qui ne correspond à personne.

*Pourquoi :* dans un restaurant de quartier, le caissier voit physiquement la salle. Les
mécanismes techniques (code du jour, ouverture de table par le personnel) ajoutent une
friction permanente pour un risque qui ne s'est pas encore manifesté.

*Conséquence :* la vue groupée par table n'est pas une préférence d'affichage, c'est un
**dispositif de sécurité**.

*Alternatives écartées :* géolocalisation (imprécise en intérieur, falsifiable, demande de
permission dissuasive) ; contrôle par l'IP du wifi du restaurant (bloquerait les clients
en 4G, IP dynamiques et partagées).

*Réserve prévue :* `restaurants.code_table_requis`, désactivé par défaut.

---

### D3b — Prénom du convive
**Type :** produit · **Statut :** arrêtée

Le client saisit son prénom au premier envoi. Il est mémorisé dans son navigateur et
pré-rempli ensuite. Il figure sur le ticket unique.

*Pourquoi :* dans une session multi-convives, il permet au serveur de remettre la bonne
assiette à la bonne personne.

*Limite explicite :* donnée **déclarative**, jamais un moyen de contrôle (RG13). Un
attaquant saisit n'importe quel prénom.

---

### D4 — Multi-tenant dès le départ
**Type :** architecture · **Statut :** arrêtée

`restaurant_id` sur toutes les tables, RLS filtrée par tenant dès la première migration.
L'interface d'administration reste mono-restaurant.

*Pourquoi :* le surcoût immédiat est de quelques dizaines de lignes de SQL. Le rattrapage
ultérieur imposerait de réécrire toute la couche de sécurité sur une base en production.

*Piège identifié :* le `restaurant_id` doit résider dans `app_metadata` du jeton, jamais
dans `user_metadata` — cette dernière est modifiable par l'utilisateur lui-même.

---

### D5 — Déclinaisons obligatoires
**Type :** métier · **Statut :** arrêtée

Toute ligne de commande référence une déclinaison. Un plat sans taille reçoit une
déclinaison « Standard » que l'interface masque.

*Pourquoi :* certains restaurants ont des tailles, d'autres non. Le schéma doit couvrir le
sur-ensemble. Conserver à la fois `plats.prix` et des déclinaisons optionnelles créerait
deux chemins de lecture et des incohérences de prix.

*Alternative écartée :* suppléments cumulables — combinatoire de prix et règles de
compatibilité, pour un besoin non exprimé. La note libre couvre les demandes particulières.

---

### D6 — Disponibilité manuelle
**Type :** métier · **Statut :** arrêtée

Le caissier bascule un plat en « épuisé ». Le changement est propagé en temps réel.

*Alternative écartée :* décrément automatique d'un stock — suppose un inventaire tenu à
jour au produit près, qu'aucun établissement cible ne tient. Un stock faux est pire
qu'aucun stock.

---

### D7 — Annulation par la caisse, motif après impression
**Type :** métier · **Statut :** arrêtée

Avant impression : annulation simple. Après impression : motif obligatoire, annulation
tracée, montant comptabilisé en perte. Le client ne peut pas annuler lui-même.

*Pourquoi :* l'annulation est le seul mécanisme de rattrapage depuis que D2 a supprimé la
validation humaine. Une annulation client créerait une course avec l'impression et
ouvrirait la porte à l'annulation après cuisson.

---

### D8 — Temps d'attente indicatif
**Type :** produit · **Statut :** arrêtée

Affiché sous forme de fourchette, calculé sur la charge réelle en cuisine, désactivable
par restaurant.

*Pourquoi :* un chiffre précis et faux crée du conflit ; une fourchette honnête crée de la
confiance.

---

### D9 — Un compte authentifié par restaurant
**Type :** technique · **Statut :** arrêtée

Compte unique partagé par les caissiers d'un même établissement.

*Pourquoi :* D4 impose que le poste caisse soit authentifié. Les comptes nominatifs
supposent une gestion d'utilisateurs que personne ne demande.

*Limite acceptée :* le journal d'audit identifie « la caisse », pas la personne.

---

### D21 — Expiration et clôture de journée
**Type :** métier · **Statut :** arrêtée

Session fermée à l'encaissement ; expiration automatique après 4 h d'inactivité ; clôture
de journée fermant les sessions restantes et figeant le chiffre d'affaires.

*Pourquoi :* sans mécanisme, les sessions orphelines s'accumulent et faussent les
statistiques. La journée d'exploitation se termine à 4 h et non à minuit — un restaurant
ouvert jusqu'à 1 h verrait sinon son service coupé en deux.

*Conséquence :* les sessions expirées sont conservées mais exclues du chiffre d'affaires —
ce sont des anomalies, pas des ventes.

---

## Décisions en attente

### D22 — Suivi de commande côté client en temps réel
**Type :** architecture · **Statut :** ⏳ à trancher

Le client anonyme n'a aucun droit de lecture sur les commandes ; il ne peut donc pas
s'abonner au flux temps réel pour suivre son statut.

| Option | Description | Conséquence |
|---|---|---|
| A | Interrogation périodique de `suivre_commande` toutes les 10 s | Simple et étanche ; latence de 10 s |
| B | Lecture partielle ouverte au rôle anonyme | Vrai temps réel ; un concurrent peut compter les commandes |
| C | Canal de diffusion dédié par commande | Temps réel et étanche ; plomberie supplémentaire |

*Recommandation :* A. Le client regarde son téléphone en attendant ; 10 secondes de
latence sont invisibles. B expose des données commerciales du restaurateur sans contrepartie.

---

## Décisions non ouvertes (phases ultérieures)

| ID | Sujet | Phase |
|---|---|---|
| D10 | Idempotence des envois sur réseau instable | 3 |
| D11 | Numérotation sous concurrence — *traitée dans le schéma* | 3 |
| D12 | Coupure internet pendant le service | 3 |
| D13 | Panne d'imprimante : plan de repli | 3 |
| D14 | Saisie initiale du menu et intégration d'un restaurant | 6 |
| D15 | Contrat d'API et versionnement du menu | 3 |
| D16 | Rétention des données, purge du prénom | 3 |
| D17 | Journal d'audit — *traité dans le schéma* | 3 |
| D18 | Sur place, à emporter | 6 |
| D19 | Modèle économique | 6 |
| D20 | Limitation de débit et protection anti-spam | 5 |
