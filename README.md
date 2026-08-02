# QResto 🍕

**Commande par QR code pour les restaurants algériens — paiement en caisse.**

Le client scanne le QR posé sur sa table, commande depuis son téléphone, et paie en caisse
avant de partir. Le caissier reçoit la commande **en direct** sur son écran et imprime un
ticket qu'il donne au cuistot. Le serveur ne prend plus les commandes : il livre les plats.

---

## Le problème

Dans beaucoup de restaurants en Algérie, aux heures de pointe :

- le serveur prend 4-5 commandes de suite et **oublie quelle table a commandé quoi** ;
- les clients attendent pour qu'on vienne les voir ;
- il n'y a **aucune trace** de ce qui a été vendu à la fin de la journée.

## La solution

| Étape | Qui | Quoi |
|---|---|---|
| 1 | Client | Scanne le QR de sa table → menu avec photos et prix |
| 2 | Client | Compose sa commande, ajoute une note, envoie |
| 3 | Caissier | La commande apparaît instantanément avec un bip sonore |
| 4 | Caissier | Imprime le ticket (imprimante thermique) et le donne au cuistot |
| 5 | Cuistot | Prépare — **il ne change rien à ses habitudes** |
| 6 | Client | Paie en caisse avant de partir |

**Pas de paiement en ligne.** C'est volontaire : le e-paiement est encore peu répandu en
Algérie, et les restaurants tiennent à encaisser eux-mêmes.

---

## Lancer le prototype

Aucune installation, aucun build. Il faut juste servir le dossier en HTTP
(le `file://` ne permet pas le partage entre onglets).

```bash
python -m http.server 8809
```

Puis ouvrir <http://localhost:8809> et suivre les 3 liens :

| Page | Rôle |
|---|---|
| `index.html` | Accueil + génération des QR codes des tables |
| `client.html?table=5` | Ce que voit le client après avoir scanné |
| `caisse.html` | Écran du caissier, temps réel + impression ticket |
| `admin.html` | Statistiques du patron |

**Pour bien voir la démo :** ouvrir `caisse.html` dans un onglet et `client.html?table=5`
dans un autre, puis passer une commande. Elle apparaît côté caisse sans rafraîchir.

---

## Fonctionnalités

- ⚡ **Temps réel** — la commande arrive sur l'écran caisse instantanément, avec bip sonore
- 🖨️ **Ticket imprimable** — format 72 mm, compatible imprimante thermique
- ⏱️ **Estimation d'attente** — calculée selon le nombre de plats et la charge en cuisine
- 🌍 **Trilingue** — français, arabe (RTL), anglais
- 📸 **Menu illustré** — chaque plat avec visuel, description et prix en DA
- 📊 **Statistiques** — chiffre d'affaires, plats les plus vendus, heures de pointe, CA par table
- 📱 **Mobile-first** — aucune application à installer côté client

---

## Comment c'est fait

Prototype volontairement **sans dépendance ni build** : HTML, CSS et JavaScript natif.
La synchronisation entre l'écran client et l'écran caisse passe par
[`BroadcastChannel`](https://developer.mozilla.org/fr/docs/Web/API/BroadcastChannel)
avec `localStorage` pour la persistance — ça simule le temps réel sans serveur.

```
qresto/
├── index.html      accueil + QR codes des tables
├── client.html     menu et commande côté client
├── caisse.html     écran caisse temps réel
├── admin.html      statistiques
├── css/style.css
└── js/
    ├── data.js     menu de démo + traductions
    ├── store.js    état partagé + synchro temps réel
    ├── client.js
    ├── caisse.js
    └── admin.js
```

### Vers la production

Le prototype garde les données dans le navigateur. Pour un vrai déploiement :

- **Supabase** (Postgres + Realtime) remplace `store.js` — même logique, un seul fichier à changer
- **Next.js** ou le HTML statique tel quel, hébergé sur **Vercel** / **Netlify**
- Une **imprimante thermique** USB ou réseau côté caisse (~3 000–5 000 DA)
- Authentification pour les écrans caisse et admin
- Un QR par table pointant vers `qresto.dz/<resto>/table/<n>`

### Et sans internet ?

Un mini-serveur local (Raspberry Pi, vieux PC) peut héberger le site sur le wifi du
restaurant, sans connexion extérieure. C'est possible mais plus lourd à maintenir
(serveur à faire tourner en permanence, DNS local, mises à jour manuelles).
**L'approche recommandée reste : site hébergé en ligne + wifi offert par le restaurant.**

---

## Restaurants ciblés — Aïn Benian, Alger

Établissements repérés dans la commune qui prennent encore les commandes à l'ancienne
(présence en ligne limitée à une page Facebook, pas de commande à table).
À vérifier sur place avant démarchage.

| Restaurant | Type | Présence en ligne |
|---|---|---|
| [Black & Silver](https://www.facebook.com/BlackandSilverAinBenian/) | Pizza, burgers, sandwichs, poulet frit | Page Facebook |
| [Spicymax](https://www.facebook.com/spicymax/) | Pizza au feu de bois, burgers, salades | Page Facebook |
| [Pizza Home](https://www.facebook.com/PizzaHome.Bainem/) | Pizza, tacos, sandwichs, burgers | Page Facebook |
| [Pizzeria L'Abri-Côtier](https://www.facebook.com/p/Pizzeria-LAbri-C%C3%B4tier-100067608938994/) | Pizza, pâtes | Page Facebook |
| [Team Pizza](https://www.tripadvisor.com/Restaurant_Review-g4115133-d28251428-Reviews-Team_Pizza-Ain_Benian_Tipasa_Province.html) | Pizzeria | Fiche Tripadvisor |
| [Khayma](https://www.facebook.com/p/Restaurant-traditionnelle-khayma-ain-benian-100041818826678/) | Cuisine traditionnelle | Page Facebook |
| El-Djamila (ex-La Madrague) | Poissons et fruits de mer | Fiches annuaires |

**Bons candidats en priorité :** les fast-foods à forte rotation (Black & Silver, Spicymax,
Pizza Home) — c'est là que le serveur sature et que le gain est le plus visible.

---

## Licence

MIT
