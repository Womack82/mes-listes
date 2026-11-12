# Règles du projet « Wodo » (anciennement « Mes listes »)

## Le projet

- Petite web app installable (PWA) pour tenir des listes : films, séries,
  jeux, recettes et autres. Son nom affiché est **Wodo** (depuis la v1.21).
- Les noms techniques gardent « mes-listes » et ne doivent pas changer :
  clés de la mémoire (localStorage), base des photos (IndexedDB), format
  des sauvegardes (`format: "mes-listes"`), adresse du site et du dépôt.
  Les changer ferait perdre les données déjà enregistrées.
- Publiée sur GitHub Pages : https://womack82.github.io/mes-listes/
- Utilisée surtout sur iPhone.
- Les améliorations à faire et déjà faites sont suivies dans `TODO.md`.

## Façon de travailler

- L'utilisateur débute en programmation : explique brièvement ce que tu fais
  et pourquoi, avec des mots simples.
- Avant de coder, signale tout point qui pose problème (limite technique,
  risque, effet secondaire) et attends sa réponse.
- Fais un commit Git par étape, avec un message clair qui dit ce qui change.
- Ne fais **jamais** de `git push` : l'utilisateur le fait lui-même après
  avoir testé.
- Ne mets jamais une clé API dans un fichier suivi par Git sans le dire
  clairement à l'utilisateur. Aujourd'hui, les clés TMDB et RAWG sont gardées
  uniquement dans la mémoire de l'appareil (localStorage).

## Version et cache

- À chaque modification, change la version du cache (`NOM_CACHE`) dans
  `service-worker.js`. Sinon, le téléphone continue d'utiliser l'ancienne copie.
- Change en même temps `VERSION` en haut de `app.js` : c'est le numéro affiché
  à côté du titre, et il doit rester identique à celui du cache.
- Numérotation : on reste en **v1**. Chaque changement, quel qu'il soit
  (nouvelle demande ou retouche), ajoute 1 au second numéro :
  v1.1 → v1.2 → v1.3… (les anciens numéros v10 à v15.1 datent d'avant
  cette règle).

## Apparence

- Mobile d'abord : boutons et zones à toucher d'au moins 44 px, texte lisible
  sans zoomer.
- Palette de couleurs :

  | Rôle                        | Couleur   | Texte posé dessus          |
  |-----------------------------|-----------|----------------------------|
  | Fond                        | `#e9eef5` | —                          |
  | Texte principal             | `#0a2342` | —                          |
  | Texte secondaire            | `#4a5d78` | —                          |
  | Accent                      | `#ff6a00` | `#0a2342` (jamais blanc)   |
  | Survol (de l'accent)        | `#ff9b54` | `#0a2342`                  |
  | Actif et secondaire         | `#2c6e9a` | blanc                      |

- Animations légères, de 150 à 280 ms, et désactivées quand l'option
  « réduire les animations » est activée sur l'appareil
  (`@media (prefers-reduced-motion: reduce)`).
- Quand l'utilisateur demande un changement d'apparence, ne modifie que
  l'apparence (CSS, présentation) : ne touche à aucune fonction.
