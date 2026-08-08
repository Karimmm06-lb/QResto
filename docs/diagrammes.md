# Diagrammes — QResto

Diagrammes du système tel qu'il est spécifié dans [`cahier-des-charges.md`](cahier-des-charges.md).
Rendus directement par GitHub, aucun outil externe.

---

## 1. Diagramme de contexte

Ce que le système contient, et ce qu'il ne contient pas.

```mermaid
graph TB
  subgraph EXT[" "]
    CL([Client<br/>anonyme])
    CA([Caissier])
    GE([Gérant])
    CU([Cuisinier])
    SE([Serveur])
  end

  subgraph SYS["QResto — système de commande par QR"]
    S[Carte, commande,<br/>caisse, ventes]
  end

  VIT["Site vitrine du restaurant<br/><i>produit distinct, hors périmètre</i>"]
  IMP[Imprimante thermique]

  CL -->|scanne, commande| S
  CA -->|imprime, encaisse| S
  GE -->|carte, tarifs, ventes| S
  S -->|ticket papier| IMP
  IMP -->|remis en main propre| CU
  CU -.->|plat prêt| SE
  SE -.->|sert la table| CL
  CL -.->|paie en espèces| CA
  VIT -.->|lien à sens unique| S

  style SYS fill:#fdefe8,stroke:#d94f18,stroke-width:2px
  style VIT fill:#f4efe9,stroke:#b8ac9e,stroke-dasharray: 5 5
  style EXT fill:none,stroke:none
```

Les flèches en pointillés se déroulent **hors du logiciel**. Le cuisinier et le serveur
sont des acteurs du processus, pas des utilisateurs : c'est délibéré, moins il y a de
personnes à former, plus l'adoption est rapide.

Le site vitrine peut pointer vers la carte. **La carte ne dépend jamais du site.**

---

## 2. Cas d'utilisation

```mermaid
graph LR
  CL([Client])
  CA([Caissier])
  GE([Gérant])

  CL --> U1[Consulter la carte]
  CL --> U2[Passer une commande]
  CL --> U3[Suivre sa commande]

  CA --> U4[Recevoir les commandes]
  CA --> U5[Imprimer le ticket]
  CA --> U6[Changer un statut]
  CA --> U7[Annuler une commande]
  CA --> U8[Encaisser une table]
  CA --> U9[Basculer un plat en épuisé]

  GE --> U10[Gérer la carte]
  GE --> U11[Gérer tables et QR codes]
  GE --> U12[Consulter les ventes]
  GE --> U13[Clôturer la journée]

  U2 -. inclut .-> U1
  U5 -. déclenche .-> U6
```

`U5 déclenche U6` traduit une règle métier : **l'impression du ticket fait passer la
commande en cuisine**. C'est l'acte qui engage la production.

---

## 3. Parcours client

```mermaid
flowchart TD
  A([Le client s'installe]) --> B[Scanne le QR de sa table]
  B --> C{Jeton valide ?}
  C -->|non| X[/QR invalide<br/>voir le personnel/]
  C -->|oui| D[La carte s'ouvre<br/>sur la première catégorie]
  D --> E[Choisit une catégorie]
  E --> F[Ajoute un plat<br/>et sa déclinaison]
  F --> G{Autre plat ?}
  G -->|oui| E
  G -->|non| H[Ouvre son panier]
  H --> I[Ajoute des suppléments<br/>sur une ligne précise]
  I --> J[Saisit son prénom<br/>et une remarque]
  J --> K[Envoie]
  K --> L{Tout est<br/>disponible ?}
  L -->|non| M[/Commande refusée<br/>la carte est rafraîchie/] --> H
  L -->|oui| N[Numéro de commande<br/>et fourchette d'attente]
  N --> O[Suit le statut<br/>toutes les 10 s]
  O --> P([Paie en caisse])

  style X fill:#fdeaea,stroke:#b91c1c
  style M fill:#fdeaea,stroke:#b91c1c
  style N fill:#e8f5ec,stroke:#15803d
```

Le refus est **total** : si un seul plat du panier vient de passer en « épuisé », la
commande entière est rejetée. Servir un panier amputé serait pire que de le refuser.

---

## 4. Séquence — passage d'une commande

```mermaid
sequenceDiagram
  autonumber
  actor C as Client
  participant W as Page client
  participant B as Base de données
  participant K as Écran caisse
  participant I as Imprimante
  actor U as Cuisinier

  C->>W: Scanne le QR (jeton de table)
  W->>B: contexte_table(jeton)
  B-->>W: restaurant, numéro de table
  W->>B: lecture de la carte disponible
  B-->>W: catégories, plats, déclinaisons

  C->>W: Compose son panier, prénom, remarque
  W->>B: creer_commande(jeton, lignes, clé d'envoi)

  Note over B: Vérifie la table<br/>Ouvre ou retrouve la session<br/>Lit les prix EN BASE<br/>Calcule le total

  B-->>W: numéro, secret, fourchette d'attente
  B-)K: Diffusion temps réel
  K->>K: Alerte sonore, affichage par table

  K->>B: marquer_imprimee(commande)
  B-->>K: statut = cuisine
  K->>I: Impression du ticket
  I-->>U: Ticket remis en main propre

  loop toutes les 10 s
    W->>B: suivre_commande(secret)
    B-->>W: statut
  end
```

Deux mécanismes différents, et c'est délibéré : **la caisse est notifiée** (moins de 3 s,
exigence N1), **le client interroge** (aucune exigence de latence). Le client anonyme n'a
aucun droit de lecture sur les commandes ; lui en ouvrir permettrait à un concurrent de
compter les ventes du restaurant.

---

## 5. États d'une commande

```mermaid
stateDiagram-v2
  direction LR
  [*] --> nouvelle : envoi du client
  nouvelle --> cuisine : impression du ticket
  nouvelle --> annulee : annulation simple
  cuisine --> prete : plat terminé
  cuisine --> annulee : annulation + motif (perte)
  prete --> servie : remis au client
  prete --> annulee : annulation + motif (perte)
  servie --> [*]
  annulee --> [*]
```

L'état `payee` **n'existe pas** sur la commande : c'est la session de table qui est payée.

---

## 6. États d'une session de table

```mermaid
stateDiagram-v2
  direction LR
  [*] --> ouverte : première commande
  ouverte --> a_payer : le client demande l'addition
  ouverte --> expiree : 4 h sans activité
  a_payer --> payee : encaissement
  a_payer --> expiree : clôture de journée
  payee --> [*]
  expiree --> [*]
```

Les sessions expirées sont **conservées mais exclues du chiffre d'affaires** : ce sont des
anomalies (client parti sans payer, oubli de clôture), pas des ventes.

---

## 7. Architecture de déploiement

```mermaid
graph TB
  subgraph APP["Appareils"]
    T[Téléphone du client<br/>navigateur, anonyme]
    P[Poste caisse<br/>PC ou tablette, authentifié]
  end

  subgraph CDN["Hébergement statique"]
    F[Pages HTML/CSS/JS<br/>aucune compilation]
  end

  subgraph SUP["Base de données managée"]
    API[API REST + règles de sécurité]
    RPC[Procédures stockées]
    DB[(PostgreSQL)]
    RT[Diffusion temps réel]
    AU[Authentification]
  end

  IMP[Imprimante thermique]

  T --> F
  P --> F
  T -->|lecture de la carte| API
  T -->|création de commande| RPC
  P -->|abonnement| RT
  P -->|impression, statut, encaissement| RPC
  P --> AU
  API --> DB
  RPC --> DB
  DB --> RT
  P --> IMP

  style SUP fill:#e8eefc,stroke:#1d4ed8
  style CDN fill:#e8f5ec,stroke:#15803d
```

Aucun serveur applicatif à écrire ni à administrer. C'est ce qui rend le coût
d'exploitation nul (exigence N9) — un restaurant ne peut ni payer d'hébergement ni
administrer une machine.

---

## 8. Modèle de données

```mermaid
erDiagram
  RESTAURANTS ||--o{ TABLES : possede
  RESTAURANTS ||--o{ CATEGORIES : propose
  RESTAURANTS ||--o{ PLATS : propose
  CATEGORIES  ||--o{ PLATS : regroupe
  PLATS       ||--o{ VARIANTES : "se décline en"
  PLATS       }o--o{ CATEGORIES : "s'applique à"
  TABLES      ||--o{ SESSIONS : accueille
  SESSIONS    ||--o{ COMMANDES : regroupe
  COMMANDES   ||--o{ LIGNES : contient
  VARIANTES   ||--o{ LIGNES : "est commandée dans"
  LIGNES      ||--o{ LIGNES : complete
```

Trois relations méritent d'être défendues :

**`SESSIONS` entre `TABLES` et `COMMANDES`** — sans elle, trois commandes d'une même table
seraient trois objets sans lien, et le caissier devrait deviner quoi encaisser.

**`LIGNES` réflexive** — un supplément pointe vers la ligne qu'il complète, pour que le
ticket cuisine indique sur quel plat poser le camembert.

**`PLATS` ↔ `CATEGORIES` en plusieurs-à-plusieurs** — la portée d'un supplément : les
fromages sur les burgers, les garnitures sucrées sur les crêpes.

Le dictionnaire complet figure dans [`06-modele-donnees.md`](06-modele-donnees.md).

---

## 9. Sécurité — chemins d'écriture

```mermaid
graph LR
  A[Client anonyme] -->|lecture seule| M[(Carte)]
  A -->|procédure| P1[creer_commande]
  A -->|procédure| P2[suivre_commande]
  A -.->|INTERDIT| C[(Commandes)]

  K[Caisse authentifiée] -->|lecture| C
  K -->|procédures| P3[imprimer, statut,<br/>annuler, encaisser]
  K -.->|INTERDIT| W[Écriture directe]

  P1 --> C
  P3 --> C

  style A fill:#fdeaea,stroke:#b91c1c
  style K fill:#e8eefc,stroke:#1d4ed8
```

Principe directeur : **le navigateur du client n'est jamais une source de confiance.**

Aucune table de commandes n'accepte d'insertion directe. Les prix ne transitent jamais
depuis le téléphone : la procédure reçoit des identifiants de déclinaisons et des
quantités, et recalcule le total en base. Modifier le JavaScript de la page n'a aucun
effet.
