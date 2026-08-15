# Registre des décisions

Chaque décision structurante est consignée ici avec sa justification. Une décision
tranchée n'est pas rouverte sans motif explicite.

**Types :** `métier` (règle du domaine) · `produit` (arbitrage d'usage) ·
`technique` (choix d'outil) · `architecture` (structure du système)

---

## Recadrage — version 2 du cahier des charges

### E0 — Système de commande et site vitrine séparés
**Type :** produit · **Statut :** arrêtée

Deux produits distincts. Le système de commande est autonome et ne suppose l'existence
d'aucun site. Règle de dépendance : **le site peut pointer vers la carte, la carte ne
dépend jamais du site.**

*Pourquoi :* la plupart des restaurants ciblés n'ont aucun site — leur présence en ligne
se limite à une page Facebook, parfois à rien. Un système de commande qui en supposerait
un ne serait vendable à personne. Ce sont par ailleurs deux métiers et deux prix, et un
site en panne ne doit jamais empêcher de commander.

*Conséquence :* le QR mène **directement** à la commande, jamais à une page d'accueil
intermédiaire. Un client qui scanne veut commander, pas naviguer.

---

### E-pilote — Team Restaurant comme établissement unique
**Type :** produit · **Statut :** arrêtée (révisée)

Un seul restaurant jusqu'à ce qu'un service complet ait tourné sans incident.

*Pilote retenu :* **Team Restaurant** (Aïn Benian). Restaurant à table avec service,
ticket moyen élevé (entrecôte 2 400 DA, côte de bœuf 3 800 DA), 144 plats sur 16
catégories, deux établissements, 28 000 abonnés Instagram et **aucun site web** — Google
Maps propose lui-même « Ajouter un site Web ». Sa seule carte en ligne est une story
Instagram datée de juillet 2025, aux prix déjà périmés : l'argument de vente s'écrit seul.

*Pourquoi ce choix plutôt que Black & Silver :* Team Restaurant a une gamme et un ticket
moyen bien supérieurs, ce qui décuple le gain d'une erreur d'attribution évitée. Ses
tables sont déjà numérotées (chevalets visibles sur les photos), donc poser un carton QR
ne bouscule aucune habitude. Black & Silver et Spicy Max restent chargés en second choix.

*Pourquoi un seul :* un deuxième client avant que le premier ne tourne, c'est deux fois
les mêmes défauts à corriger et deux restaurateurs déçus, au lieu d'un client satisfait
qui en parle autour de lui.

*Ce qui ne change pas :* le modèle de données reste cloisonné par restaurant. Le
cloisonnement est déjà écrit et vérifié ; le retirer coûterait plus cher que le garder.
Cibler un établissement est un choix d'exploitation, pas d'architecture. Team Restaurant
ayant **deux adresses**, ce cloisonnement sert d'ailleurs directement : deux jeux de QR,
deux cartes, une seule plateforme.

---

### E1 — Les formules restent des plats simples
**Type :** métier · **Statut :** arrêtée

Une formule (le « Happy Meal » à 500 DA : cheese + petite frite + jus) est un article à
prix fixe, sa composition figurant dans la description.

*Pourquoi :* la formule composable — choisir son plat, sa boisson, son accompagnement
dans des groupes imposés — est le plus gros chantier restant, et une seule formule
existe sur la carte du pilote. Le construire maintenant serait devancer un besoin que
personne n'a exprimé.

*Limite acceptée :* le ticket cuisine n'énumère pas les composants, et le client ne
choisit pas sa boisson.

*À rouvrir si :* le restaurant pilote ajoute des formules, ou si le personnel doit
demander oralement le choix de boisson à chaque commande.

---

### E2 — Sur place uniquement
**Type :** produit · **Statut :** ⟲ ROUVERTE par R1 (voir plus bas)

*Décision initiale (conservée pour mémoire) :* le système ne gérait que la consommation
sur place, au motif que le QR est posé sur une table et que l'à emporter casserait la
session de table.

*Pourquoi rouverte :* l'orientation commerciale a évolué vers un modèle « comme
McDonald's » incluant la commande à distance. Le raisonnement d'origine tenait pour un
QR sur table ; il ne s'oppose pas à un second canal distinct. Voir **R1**.

---

### E3 — Pas d'écran d'appel
**Type :** produit · **Statut :** arrêtée (toujours valide)

Le serveur apporte le plat à la table ; le prénom sur le ticket identifie le destinataire.

*Pourquoi :* un écran d'appel suppose que le client se déplace pour récupérer sa
commande. Même avec la commande à distance (R1), la remise se fait au comptoir avec appel
du client (R3), sans file d'attente devant un écran. La décision tient.

---

## Extension — commande à distance (rouvre E2)

### R1 — Trois modes : sur place, à emporter, livraison
**Type :** produit · **Statut :** arrêtée

Le système gère désormais trois modes. Le QR sur table reste le canal principal
(`sur_place`) ; deux canaux à distance s'ajoutent : `a_emporter` et `livraison`.

*Pourquoi :* alignement sur le modèle McDonald's demandé — le client compose lui-même,
qu'il soit à table ou chez lui. Le retrait préserve l'invariant du produit (paiement en
caisse au retrait) ; la livraison a été retenue malgré son coût logistique sur décision
explicite.

*Ce que la commande à distance a fait tomber, et par quoi c'est remplacé :*
- la session de table → session **sans table**, même unité de facturation ;
- « le caissier voit la salle », seule défense anti-fraude de D3a → **l'appel
  téléphonique** avant toute production (R2) ;
- « aucune inscription » → exception assumée : **téléphone obligatoire** (R3).

*Alternative écartée :* livraison seule, sans retrait — on aurait pris tous les risques
logistiques sans avoir validé le parcours à distance sur le mode le plus simple.

---

### R2 — La commande à distance est validée par un appel
**Type :** métier · **Statut :** arrêtée

Une commande à distance naît au statut `a_confirmer`. Rien ne part en cuisine avant que
le caissier ait appelé le client et confirmé. Réutilise la logique de
`validation_requise` prévue en réserve dès D2.

*Pourquoi :* à distance, il n'y a plus de salle à regarder. L'appel remplace le contrôle
visuel : il confirme la commande, prouve que le numéro est réel et annonce le délai —
trois fonctions en un seul geste, sans coût d'envoi de SMS.

*Le parcours sur place reste instantané* : aucune validation ne s'y ajoute.

---

### R3 — Téléphone obligatoire, confirmation par appel
**Type :** produit · **Statut :** arrêtée

Une commande à distance exige nom et téléphone. Le caissier appelle systématiquement pour
confirmer.

*Pourquoi :* c'est le seul lien avec un client absent. Non vérifié par SMS — l'envoi coûte
de l'argent, casse la promesse « aucune inscription » et fait abandonner en cours de
commande, pour un risque que l'appel du caissier couvre déjà.

*Conséquence sur les données personnelles :* on passe d'un simple prénom à nom +
téléphone + adresse. Voir **D16**.

---

### R4 — Créneau de retrait au choix, dans la journée
**Type :** produit · **Statut :** arrêtée

Un seul menu déroulant dont la première entrée est « Dès que possible », suivie des quarts
d'heure de la journée en cours, au plus tôt après le délai minimum du restaurant.

*Pourquoi :* couvre le vrai besoin — « je passe en sortant du travail » — sans gérer de
calendrier, de jours de fermeture ni de réservations pour le lendemain. Un seul contrôle,
les deux usages.

---

### R5 — Frais de livraison par zone
**Type :** métier · **Statut :** arrêtée

Les frais ne sont pas fixes : chaque restaurant définit ses zones, chacune portant son
tarif et son montant minimum de commande (table `zones_livraison`).

*Pourquoi :* livrer à Cheraga ne coûte pas le même prix qu'à Aïn Benian. Un tarif unique
serait soit déficitaire sur les zones lointaines, soit dissuasif sur les proches. Le
minimum par zone évite qu'un livreur traverse la ville pour un soda.

---

### R6 — Plats non livrables
**Type :** métier · **Statut :** arrêtée

La colonne `plats.livrable` (vraie par défaut) retire du parcours à distance les plats
qui ne supportent pas le transport.

*Pourquoi :* imposé par la carte réelle de Team Restaurant. Personne ne fait livrer une
entrecôte à cuisson précise, un affogato ou un milkshake. Sans ce filtre, le site
promettrait au client des plats que la cuisine ne peut pas tenir, et c'est le restaurant
qui prendrait la réclamation. Filtre appliqué aux modes `a_emporter` et `livraison`,
jamais au sur place. La règle vit en base : l'interface masque, elle ne garantit pas.

---

### R7 — Encaissement de la livraison par le caissier
**Type :** métier · **Statut :** arrêtée

Le livreur rapporte l'espèce ; le caissier marque « livrée et payée » à son retour. Statut
`en_livraison` intercalé entre `prete` et `servie`.

*Pourquoi :* aucun outil à installer pour le livreur, aucune formation, aucun quatrième
utilisateur. Le décalage entre le départ en livraison et l'encaissement reste visible à
l'écran — le restaurateur garde la traçabilité de son argent.

---

### E1 — Formules : point rouvert par la carte de Team Restaurant ?
**Type :** métier · **Statut :** arrêtée (inchangée)

La carte de Team Restaurant ne comporte pas de formule composable. E1 reste donc valide :
les rares menus enfants ou formules sont des plats à prix fixe. À rouvrir seulement si le
pilote en ajoute.

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

*Alternative écartée à tort :* suppléments cumulables — voir D5-bis.

---

### D5-bis — Suppléments rattachés à la ligne de commande
**Type :** métier · **Statut :** arrêtée · **Corrige D5**

Un supplément est un plat portant `est_supplement`. Sa ligne de commande pointe vers la
ligne du plat qu'elle complète. Sa portée est limitée aux familles de plats auxquelles il
s'applique.

*Pourquoi cette décision rouvre D5 :* les suppléments avaient été écartés au motif
qu'« aucun restaurant cible ne les a exprimés ». **L'hypothèse était fausse.** Les cartes
réelles de Black & Silver et de Spicy Max en comportent partout — fromages sur les
burgers et sandwichs, garnitures sur les crêpes — et sur les pizzas leur prix dépend même
de la taille commandée (250 en Normale, 500 en Mega).

*Ce que le contournement produisait :* traités comme des articles indépendants, les
suppléments donnaient un ticket cuisine ambigu. Le cuistot voyait « 1 × Burger DZ » puis
« 1 × Camembert » sans savoir qu'ils allaient ensemble, surtout avec trois sandwichs
commandés à la même table.

*Coût de la correction :* deux colonnes, une table de portée et un déclencheur. Modéliser
un supplément comme un plat lui fait hériter gratuitement des déclinaisons, de la
disponibilité et du prix figé.

*Bénéfice imprévu :* les statistiques gagnent une information que le restaurateur n'avait
jamais eue — quels suppléments se vendent, et sur quels plats.

*Alternative écartée :* une déclinaison par combinaison (« Burger DZ + camembert »,
« Burger DZ + gouda », « Burger DZ + les deux »…) ferait exploser la carte.

*Leçon de méthode :* une décision fondée sur « le besoin n'est pas exprimé » doit être
revue dès qu'on obtient une donnée réelle. Ici, la carte d'un seul restaurant cible a
suffi à l'invalider.

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

### D22 — Suivi de commande côté client par interrogation périodique
**Type :** architecture · **Statut :** arrêtée

Le téléphone du client appelle `suivre_commande(secret)` toutes les 10 secondes.
L'interrogation cesse dès que la commande atteint un état terminal (`servie` ou `annulee`).

*Pourquoi :* le client anonyme n'a aucun droit de lecture sur `commandes` et ne peut donc
pas s'abonner au flux temps réel. Le client regarde son téléphone en attendant son plat :
10 secondes de latence sont imperceptibles.

*Asymétrie assumée :* le poste caisse est en temps réel poussé, le client en interrogation.
Les deux besoins n'ont pas la même exigence de latence — 3 secondes en caisse (BNF1),
aucune exigence côté client.

*Alternatives écartées :* ouvrir `commandes` en lecture partielle au rôle anonyme
permettrait à un concurrent de compter les commandes du restaurant ; un canal de diffusion
dédié par commande serait étanche mais ajouterait de la plomberie des deux côtés pour un
gain imperceptible.

*À revoir si :* le nombre de restaurants rend le volume d'interrogations coûteux.

---

## Décisions non ouvertes (phases ultérieures)

### D10 — Idempotence par clé d'envoi
**Type :** technique · **Statut :** arrêtée

Le téléphone tire une clé au hasard par panier et la rejoue à l'identique en cas de
nouvelle tentative. Une clé déjà connue fait renvoyer la commande existante.

*Pourquoi :* sur une connexion lente, le client appuie sur « Envoyer », ne voit rien se
passer, et appuie de nouveau. Le restaurant produit deux fois et perd la différence. Ce
n'est pas un cas théorique : c'est le comportement normal d'un client pressé.

*Pourquoi le bouton désactivé ne suffit pas :* il ne protège ni d'un rechargement de page,
ni d'un renvoi automatique par le réseau, ni d'un retour arrière. La garantie doit être en
base.

*Détail d'implémentation :* le contrôle est placé après la résolution de la table mais
avant toute écriture — une clé rejouée ne doit ni consommer un numéro de commande, ni
prolonger la session.

*Vérifié :* trois envois consécutifs avec la même clé produisent une seule commande.

---

### D16 — Rétention : purger l'identité, conserver les montants
**Type :** technique · **Statut :** arrêtée

Une tâche quotidienne (`purger_donnees_personnelles`) efface nom, téléphone et adresse des
sessions closes depuis plus de 7 jours, ainsi que le prénom des convives sur place. Les
totaux, les libellés de plats et le journal d'audit restent intacts.

*Pourquoi maintenant :* R3 a fait passer la donnée personnelle d'un simple prénom à
nom + téléphone + adresse du domicile. Conserver indéfiniment l'adresse de tous les
clients d'un restaurant est un risque inutile — ces données ne servent que le temps du
service.

*Pourquoi 7 jours :* laisse le temps de traiter une réclamation client (« ma commande
n'est jamais arrivée ») avant l'effacement.

*Conflit résolu au passage :* la contrainte `sessions_coherence_mode`, qui imposait une
adresse à toute livraison, entrait en conflit avec la purge. Elle a été restreinte aux
sessions **actives** — une session close peut voir son adresse effacée.

*Vérifié :* après purge, zéro identité restante sur les sessions closes, chiffre
d'affaires conservé.

---

| ID | Sujet | Phase | Statut |
|---|---|---|---|
| D11 | Numérotation sous concurrence | 3 | ✅ schéma |
| D12 | Coupure internet pendant le service | terrain | ⏳ ouvert |
| D13 | Panne d'imprimante : plan de repli | terrain | ⏳ ouvert |
| D14 | Saisie initiale du menu et intégration | 6 | ✅ `importer_restaurant` |
| D15 | Contrat d'API et versionnement du menu | 3 | ⏳ ouvert |
| D16 | Rétention des données personnelles | 3 | ✅ arrêtée |
| D17 | Journal d'audit | 3 | ✅ schéma |
| D18 | À emporter et livraison | — | ✅ voir R1 |
| D19 | Modèle économique | 6 | ⏳ ouvert |
| D20 | Limitation de débit et anti-spam | 5 | ⏳ ouvert |
| D21 | Expiration des sessions | 3 | ✅ arrêtée |
| D22 | Suivi client par interrogation | 3 | ✅ arrêtée |
| R1–R7 | Commande à distance | — | ✅ arrêtées |

---

## Refonte du 2026-08-14 — pivot mono-tenant et fusion vitrine + QR

Après le premier déploiement complet, l'ergonomie s'est révélée coûteuse : deux
pages publiques (`resto.html` marketing + `client.html` scan QR) avec deux
identités visuelles différentes, un code multi-tenant lourd pour un seul client
en production, et plusieurs frictions cachées repérées en audit.

### D23 — Mono-tenant en production, code multi-tenant conservé
**Type :** produit · **Statut :** arrêtée

Purge complète des trois restaurants qui n'étaient pas Team Restaurant
(Black & Silver, Spicy Max, QResto Démo) et de leurs comptes auth associés.
Le schéma, les procédures et les politiques RLS restent multi-tenant : ajouter
un nouveau restaurant reste un simple appel à `importer_restaurant` + création
d'un compte avec `app_metadata.restaurant_id`.

*Pourquoi :* le produit est bien un SaaS destiné à plusieurs restaurants, mais
tant qu'un seul est signé, garder trois jeux de données de démo bruite les
statistiques, les tests et la démo commerciale. Team Restaurant devient la
vitrine de démonstration ; les autres seront recréés à la demande.

*Vérifié :* après purge, une seule ligne dans `restaurants`, un seul compte
dans `auth.users`, tous les liens croisés (sessions, commandes, plats,
catégories, tables, zones) suivent.

---

### D24 — Fusion vitrine + parcours QR sur une seule page
**Type :** produit · **Statut :** arrêtée · **Révise E0**

`resto.html` absorbe le rôle de `client.html` :

- Sans QR (`?r=slug` ou racine) → vitrine marketing + boutons À emporter /
  Livraison si activés.
- Avec QR (`?t=<jeton>`) → même vitrine avec un troisième bouton *Sur place —
  Table N*, envoyé via `creer_commande` (mode `sur_place`, statut `nouvelle`,
  passe direct en cuisine sans confirmation).

`client.html` devient un redirecteur JavaScript vers `resto.html` — les QR
déjà imprimés continuent de fonctionner. Netlify double la redirection côté
serveur (302) pour couvrir le cas sans JavaScript.

*Pourquoi :* deux pages publiques distinctes obligeaient à maintenir deux
identités visuelles, deux polices, deux comportements de panier. Un client qui
scanne à sa table et un client qui commande à emporter méritent la même
expérience haut de gamme.

*Révision de E0 :* le principe « le site peut pointer vers la carte, la carte
ne dépend jamais du site » tient toujours — c'est simplement la même page
statique qui joue les deux rôles, sans dépendance croisée.

*Nouveau RPC :* `vitrine_par_jeton(qr_token)` renvoie en un seul appel le
contexte de la table + la carte complète du restaurant, évitant deux
allers-retours réseau au scan.

---

### D25 — Le bouton « Sur place » n'apparaît qu'après scan d'un QR
**Type :** métier · **Statut :** arrêtée

Le mode `sur_place` requiert un jeton de table. Un visiteur qui arrive sur la
vitrine par un lien direct ne peut donc **pas** commander en sur place —
c'est le comportement voulu : un client qui n'est pas physiquement au
restaurant ne doit pas pouvoir déclencher une préparation en cuisine sans
paiement ni contact préalable.

*Pourquoi :* l'inverse serait une porte ouverte à la fraude — un plaisantin
qui envoie 10 commandes bidons à la table 7. Le QR physique reste la garantie
de présence.

---

### D26 — URLs propres sans `.html`
**Type :** technique · **Statut :** arrêtée

Rewrites Netlify (`status = 200`, pas 302) sur `/caisse`, `/admin`, `/qr`,
`/resto`, `/mentions-legales`. Le navigateur ne voit jamais le `.html`.

*Pourquoi :* plus court à taper au clavier, plus mémorable à donner à l'oral,
plus court à imprimer sur une carte de visite. Standard des sites
professionnels.

*Piège attrapé :* la première génération des QR utilisait
`location.href.replace(/qr\.html.*$/, '')` pour construire l'URL cible ;
depuis `/qr` (sans extension) la regex ne matchait plus rien et l'on
obtenait `qresto-team.netlify.app/qrresto.html?t=…`, un 404. Corrigé en
utilisant `location.origin + '/resto.html?t='`, insensible au chemin depuis
lequel `qr.html` est chargée.

---

### D27 — Correctifs de sécurité relevés à l'audit du 2026-08-13
**Type :** technique · **Statut :** arrêtée

Deux failles réelles trouvées lors d'un audit RPC + RLS, corrigées le jour
même (migration `0011_correctifs_audit.sql`).

- **A1 — Plats non livrables acceptés en livraison :**
  `creer_commande_distance` appelait `valider_lignes` (générique) mais avait
  perdu l'appel à `valider_lignes_distance`, qui existe pourtant en base. Les
  plats marqués `livrable = false` (viandes à cuisson précise, glaces,
  boissons chaudes) passaient donc en livraison, contredisant le libellé de
  la colonne. Correction : ajout de `perform valider_lignes_distance(...)` dans
  le RPC.

- **A2 — RLS désactivée sur `zones_livraison` :**
  la table n'avait ni politique de lecture ni de politique d'écriture. Avec la
  seule clé publique, un tiers pouvait modifier les frais et minimums de
  livraison de tous les restaurants. RLS activée, `select public` conservée
  (la vitrine anonyme lit ces zones), écriture réservée au gérant du
  restaurant (`restaurant_id = mon_restaurant()`).

*Vérifié :* trois entrecôtes en livraison → rejet ; lecture des zones depuis
la vitrine → OK.

---

### D28 — PWA installable, favicon SVG, Open Graph, Schema.org
**Type :** produit · **Statut :** arrêtée

Le site n'était pas partageable proprement : pas de preview sur WhatsApp, pas
d'icône d'onglet, pas d'installation. Ajouts :

- `manifest.webmanifest` (nom, couleurs, orientation, icônes) — le site
  s'installe sur l'écran d'accueil.
- Favicon SVG (étoile signature + « QRESTO » or/marbre) partagé par toutes
  les pages.
- `og:title`, `og:description`, `og:image` (image dédiée 1200×630 SVG
  or/marbre), `twitter:card` — preview riche sur WhatsApp, Messenger,
  Facebook, LinkedIn.
- Données structurées `Schema.org/Restaurant` : Google peut afficher un
  panneau riche (adresse, téléphone, cuisine, gamme de prix) dans ses
  résultats.
- `robots.txt` + `sitemap.xml`, `noindex` sur les espaces authentifiés.

*Pourquoi :* le vrai canal de démarchage sera WhatsApp — envoyer un lien nu
sans preview décrédibilise instantanément. L'installation PWA donne aussi une
alternative à l'app native pour les habitués (patron du resto qui consulte la
caisse depuis chez lui).

---

### D29 — Trilingue FR / AR / EN avec RTL arabe
**Type :** produit · **Statut :** arrêtée

Les RPC `vitrine` et `vitrine_par_jeton` renvoient désormais les trois langues
(catégories, plats, variantes). Le front expose un sélecteur FR / AR / EN en
haut à droite, préférence stockée en localStorage, bascule dynamique sans
rechargement, `dir="rtl"` sur `<html>` en arabe.

Fallback FR quand la traduction manque en base — l'arabe et l'anglais du menu
sont facultatifs, ce qui permet d'activer la fonctionnalité même quand seul le
français est saisi.

*Pourquoi :* Aïn Benian est en zone touristique ; l'arabe est essentiel pour
la clientèle locale non-francophone, l'anglais pour les touristes. Sans
alourdir le back-office : l'i18n vit dans la base, pas dans le code.

---

### D30 — Dark mode réservé à la caisse
**Type :** produit · **Statut :** arrêtée

Le mode sombre est activé exclusivement sur `caisse.html`. Préférence système
détectée au chargement, choix manuel persistant, bouton 🌙/☀️ dans la topbar.

*Pourquoi :* le client scanne à midi, il n'a pas besoin de dark. Le caissier
qui finit son service à minuit devant son écran, si. Faire du dark partout
aurait coûté un refactoring complet de la palette vitrine sans bénéfice réel.

---

### D31 — Cache-busting automatique via `COMMIT_REF`
**Type :** technique · **Statut :** arrêtée

Script de build Netlify (`scripts/cache-bust.sh`) qui remplace toutes les
occurrences de `?v=…` dans les HTML par le hash court du commit. Chaque push
provoque une nouvelle version, les navigateurs re-téléchargent
systématiquement les JS et CSS mis à jour.

*Pourquoi :* bumper `?v=19` à `?v=20` à la main dans six fichiers à chaque
correctif était une source d'oublis. Un caissier qui ne voit pas un fix parce
qu'il a l'ancien JS en cache est un caissier qui appelle pour un « bug ».

---

### D32 — Session Supabase expirée : bascule propre vers le login
**Type :** technique · **Statut :** arrêtée

`Store` expose `estSessionExpiree(e)` (détection JWT expired / PGRST301 / 401)
et `signalerSessionExpiree()` qui dispatche l'évènement
`qresto:session-expiree`. Chaque écran staff (caisse, admin, qr) écoute
l'évènement et rebascule sur son formulaire de connexion avec un bandeau
ambre « Votre session a expiré. Reconnectez-vous. »

*Pourquoi :* le comportement précédent était un tableau muet qui ne se mettait
plus à jour, sans message. Le caissier appelait pour signaler un « bug » alors
qu'il suffisait de reconnexion.

---

### D33 — Empty state accueillant sur la caisse
**Type :** produit · **Statut :** arrêtée

Quand aucune commande n'est en cours, la caisse affiche deux blocs illustrés
(icône + titre Cormorant + description) au lieu du sec « Aucune commande. » :
rassure le caissier que le poste fonctionne et rappelle ce qu'il faut attendre.

*Pourquoi :* les cinq premières minutes du service, l'écran vide inquiète un
caissier peu familier avec le logiciel.

---

### D34 — Footer vitrine + page mentions légales
**Type :** produit · **Statut :** arrêtée

Pied de page sombre en bas de la vitrine (adresse, contact, réseaux sociaux,
mention de la solution). Page `mentions-legales.html` conforme à la loi 18-07
algérienne : éditeur, hébergement (Netlify + Supabase EU), rétention 30 jours,
cookies (aucun tracker), pas de compte requis.

*Pourquoi :* un site professionnel sans pied de page ni mentions légales
trahit le prototype. Pour convaincre un patron de restaurant qui va confier
sa carte, la crédibilité passe par ces petits détails visibles.

---

| ID | Sujet | Phase | Statut |
|---|---|---|---|
| D23 | Mono-tenant en production | refonte | ✅ arrêtée |
| D24 | Fusion vitrine + QR | refonte | ✅ arrêtée |
| D25 | Sur place réservé aux QR scannés | refonte | ✅ arrêtée |
| D26 | URLs propres sans `.html` | refonte | ✅ arrêtée |
| D27 | Correctifs sécurité audit 2026-08-13 | refonte | ✅ arrêtée |
| D28 | PWA + Open Graph + Schema.org | refonte | ✅ arrêtée |
| D29 | Trilingue FR/AR/EN + RTL | refonte | ✅ arrêtée |
| D30 | Dark mode caisse uniquement | refonte | ✅ arrêtée |
| D31 | Cache-busting `COMMIT_REF` | refonte | ✅ arrêtée |
| D32 | Session expirée gérée | refonte | ✅ arrêtée |
| D33 | Empty state caisse | refonte | ✅ arrêtée |
| D34 | Footer + mentions légales | refonte | ✅ arrêtée |
