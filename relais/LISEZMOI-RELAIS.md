# Déployer le relais de Wodo (Cloudflare, gratuit)

Le relais est un petit programme qui tourne chez Cloudflare. Il rend deux
services à l'app :

- **Import de recettes** : quand tu appuies sur « Importer depuis le lien »,
  il va chercher la page de la recette (le navigateur interdit à l'app de
  le faire seule).
- **Recherche de jeux vidéo** : il interroge **IGDB**, la base de jeux de
  Twitch. Les identifiants IGDB restent **secrets chez Cloudflare** : l'app
  ne les voit jamais.

- **Coût** : gratuit (offre « Free » de Cloudflare : 100 000 appels par jour ;
  IGDB est gratuit pour un usage personnel).
- **Durée** : 20 minutes environ, sans rien installer, sans ligne de commande.
- **Ce que le relais garde** : rien. Il ne stocke aucune page ni aucune
  recherche et n'écrit aucun journal.

> **Déjà un relais en place ?** Va directement à
> [« Mettre à jour un relais déjà installé »](#mettre-à-jour-un-relais-déjà-installé).

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

## Étape 5 — Créer l'accès IGDB chez Twitch (pour les jeux)

IGDB appartient à Twitch : il faut une « application » Twitch (gratuite).
Elle donne deux codes : un **Client ID** et un **Client Secret**.

1. Si tu n'as pas de compte Twitch, crée-en un sur <https://www.twitch.tv/>
   (bouton **S'inscrire**).
2. **Active la double authentification**, obligatoire pour créer une
   application : sur twitch.tv, clique sur ton avatar (en haut à droite) →
   **Paramètres** → onglet **Sécurité et confidentialité** →
   **Activer l'authentification à deux facteurs**, et suis les étapes
   (code par SMS ou appli d'authentification).
3. Va sur <https://dev.twitch.tv/console> et connecte-toi avec ton compte
   Twitch. Accepte les conditions si on te le demande.
4. Clique sur **Applications** → **Enregistrer votre application**
   (« Register Your Application »).
5. Remplis :
   - **Nom** : `Wodo jeux` (le nom doit être unique sur Twitch : ajoute
     ton pseudo si celui-ci est déjà pris) ;
   - **URL de redirection OAuth** : `https://localhost` (obligatoire mais
     inutilisée ici ; Twitch exige une adresse en **https**), puis clique
     sur **Ajouter**. Si Twitch la refuse, mets l'adresse de l'app :
     `https://womack82.github.io/mes-listes/` ;
   - **Catégorie** : **Application Integration** ;
   - **Type de client** : **Confidentiel**.
6. Coche la case anti-robot, puis **Créer**.
7. Dans la liste, clique sur **Gérer** à côté de ton application.
   - Copie le **Client ID** (identifiant client) dans une note temporaire.
   - Clique sur **Nouveau secret**, confirme, et copie le **Client Secret**
     tout de suite (Twitch ne le réaffichera plus).

> Ces deux codes donnent accès à IGDB en ton nom : ne les envoie à personne,
> ne les mets jamais dans un fichier du projet. Une fois collés dans
> Cloudflare (étape 6), efface ta note.

## Étape 6 — Donner les codes Twitch au relais (secrets Cloudflare)

1. Sur la page du Worker, ouvre l'onglet **Settings** (« Paramètres »).
2. Cherche la rubrique **Variables and Secrets** (« Variables et secrets »)
   et clique sur **Add** (« Ajouter »).
3. Premier secret :
   - **Type** : **Secret** (important : pas « Text ») ;
   - **Variable name** (nom) : `IGDB_CLIENT_ID` (exactement ainsi, en
     majuscules) ;
   - **Value** (valeur) : colle le **Client ID**.
4. Clique encore sur **Add** pour le second secret :
   - **Type** : **Secret** ;
   - **Variable name** : `IGDB_CLIENT_SECRET` ;
   - **Value** : colle le **Client Secret**.
5. Clique sur **Deploy** (ou « Save and deploy » / « Enregistrer et
   déployer ») pour que le relais prenne les secrets en compte.

Le relais demande lui-même un « jeton » à Twitch avec ces codes, le garde
en mémoire jusqu'à son expiration (environ 60 jours) et en redemande un
tout seul. Tu n'as rien d'autre à faire.

## Étape 7 — Copier l'adresse du relais

1. Sur la page du Worker, repère l'adresse qui finit par `.workers.dev`
   (rubrique **Domains & Routes** ou en haut de la page). Elle ressemble à :
   `https://mes-listes-relais.ton-pseudo.workers.dev`
2. Copie-la.

> Si tu ouvres cette adresse dans ton navigateur, tu verras
> « Origine refusée. » : c'est **normal**, le relais ne répond qu'à l'app.

## Étape 8 — La coller dans l'app

1. Dans l'app, ouvre **Réglages** (roue en haut à droite).
2. Touche **Relais (recettes et jeux)**.
3. Colle l'adresse dans le champ **Adresse du relais**, puis touche
   **Enregistrer**.
4. À faire une fois par appareil (PC, Safari, app de l'écran d'accueil) :
   l'adresse est gardée seulement dans la mémoire de l'appareil, jamais
   dans GitHub ni dans les exports.

---

## Mettre à jour un relais déjà installé

Quand `relais/worker.js` change (par exemple pour ajouter les jeux) :

1. Refais l'**étape 3** : tout sélectionner dans l'éditeur Cloudflare,
   coller le nouveau code, **Deploy**. L'adresse ne change pas.
2. Pour les jeux, si ce n'est pas déjà fait : **étapes 5 et 6** (codes
   Twitch et secrets).

## Si ça ne marche pas

| Ce que tu vois dans l'app | Cause probable |
|---|---|
| « Ajoutez l'adresse du relais dans Réglages… » | L'adresse n'est pas enregistrée sur cet appareil (étape 8). |
| « Je n'ai pas trouvé de recette sur cette page » pour **toutes** les recettes | Adresse mal copiée, ou code pas déployé (refais les étapes 3 et 7). |
| Ce message pour **un seul** site | Normal : le site ne décrit pas sa recette dans un format standard, ou il bloque les robots. Ajoute la recette à la main. |
| « Recherche de jeux indisponible » pour **tous** les jeux | Secrets absents ou mal nommés (étape 6 : `IGDB_CLIENT_ID` et `IGDB_CLIENT_SECRET`, type Secret), Client Secret régénéré chez Twitch sans être recollé, ou ancien code du relais (étape 3). |
| « Recherche de jeux indisponible » de temps en temps | IGDB ou Twitch momentanément lent : réessaie plus tard, ou ajoute le jeu à la main. |

## Tester sur le PC avant de publier

Le relais accepte aussi l'app lancée sur le PC à l'adresse
`http://localhost:8000` (avec un petit serveur local sur le port 8000).
Toute autre adresse (y compris le simple double-clic sur `index.html`)
est refusée : dans ce cas, teste directement sur l'iPhone.
