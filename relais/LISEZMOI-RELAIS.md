# Déployer le relais d'import de recettes (Cloudflare, gratuit)

Le relais est un petit programme qui tourne chez Cloudflare. Quand tu
appuies sur « Importer » dans l'app, il va chercher la page de la recette
et la renvoie à l'app. Le navigateur interdit à l'app de le faire seule.

- **Coût** : gratuit (offre « Free » : 100 000 appels par jour, largement assez).
- **Durée** : 10 minutes environ, sans rien installer, sans ligne de commande.
- **Ce que le relais garde** : rien. Il ne stocke aucune page et n'écrit
  aucun journal des adresses demandées.

---

## Étape 1 — Créer un compte Cloudflare

1. Va sur <https://dash.cloudflare.com/sign-up>.
2. Saisis ton e-mail et un mot de passe, puis valide.
3. Ouvre l'e-mail de Cloudflare et clique sur le lien de confirmation.
4. Si Cloudflare te propose d'« ajouter un domaine » ou un abonnement,
   ignore-le : on n'en a pas besoin.

## Étape 2 — Créer le Worker

1. Dans le menu de gauche, clique sur **Compute (Workers)** puis
   **Workers & Pages**. (Selon les versions, le menu s'appelle seulement
   « Workers & Pages ».)
2. Clique sur le bouton **Create** (ou « Créer »).
3. Choisis **Start with Hello World!** (ou « Create Worker »).
4. Dans le champ du nom, écris : `mes-listes-relais`.
5. Clique sur **Deploy** (« Déployer »). Cloudflare crée un Worker d'exemple.
   - La toute première fois, Cloudflare peut te demander de choisir un
     **sous-domaine** `workers.dev` (par exemple ton pseudo). Choisis-en
     un et valide.

## Étape 3 — Coller le code du relais

1. Sur la page du Worker, clique sur **Edit code** (« Modifier le code »).
   Un éditeur s'ouvre, avec un fichier `worker.js` (ou `index.js`) à gauche.
2. Clique dans le code, sélectionne tout (**Ctrl + A**) et supprime-le.
3. Ouvre le fichier `relais/worker.js` de ce projet dans le Bloc-notes
   (clic droit → Ouvrir avec → Bloc-notes), sélectionne tout (**Ctrl + A**),
   copie (**Ctrl + C**).
4. Reviens dans l'éditeur Cloudflare et colle (**Ctrl + V**).
5. Clique sur **Deploy** en haut à droite, puis confirme.

## Étape 4 — Vérifier qu'aucun journal n'est gardé

1. Reviens sur la page du Worker (flèche de retour ou son nom en haut).
2. Ouvre l'onglet **Settings** (« Paramètres »).
3. Cherche la rubrique **Observability** (« Observabilité ») ou
   **Workers Logs** : si elle est activée (« Enabled »), clique sur le
   crayon et **désactive-la**, puis enregistre.
   (Le code du relais n'écrit rien, mais cette option de Cloudflare
   enregistrerait les adresses des requêtes.)

## Étape 5 — Copier l'adresse du relais

1. Sur la page du Worker, repère l'adresse qui finit par `.workers.dev`
   (rubrique **Domains & Routes** ou en haut de la page). Elle ressemble à :
   `https://mes-listes-relais.ton-pseudo.workers.dev`
2. Copie-la.

> Si tu ouvres cette adresse dans ton navigateur, tu verras
> « Origine refusée. » : c'est **normal**, le relais ne répond qu'à l'app.

## Étape 6 — La coller dans l'app

1. Dans l'app, ouvre **Réglages** (roue en haut à droite).
2. Touche **Import de recettes**.
3. Colle l'adresse dans le champ **Adresse du relais**, puis touche
   **Enregistrer**.
4. À faire une fois par appareil (PC, Safari, app de l'écran d'accueil) :
   l'adresse est gardée seulement dans la mémoire de l'appareil, jamais
   dans GitHub ni dans les exports.

---

## Mettre à jour le relais plus tard

Si `relais/worker.js` change : refais l'**étape 3** (tout sélectionner,
coller le nouveau code, **Deploy**). L'adresse ne change pas.

## Si ça ne marche pas

| Ce que tu vois dans l'app | Cause probable |
|---|---|
| « Ajoutez l'adresse du relais dans Réglages… » | L'adresse n'est pas enregistrée sur cet appareil (étape 6). |
| « Je n'ai pas trouvé de recette sur cette page » pour **toutes** les recettes | Adresse mal copiée, ou code pas déployé (refais les étapes 3 et 5). |
| Ce message pour **un seul** site | Normal : le site ne décrit pas sa recette dans un format standard, ou il bloque les robots. Ajoute la recette à la main. |

## Tester sur le PC avant de publier

Le relais accepte aussi l'app lancée sur le PC à l'adresse
`http://localhost:8000` (avec un petit serveur local sur le port 8000).
Toute autre adresse (y compris le simple double-clic sur `index.html`)
est refusée : dans ce cas, teste directement sur l'iPhone.
