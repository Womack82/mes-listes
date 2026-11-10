# TODO — Mes listes

Liste des améliorations de l'app. Quand une amélioration est faite,
on coche la case `[x]`, on la déplace dans « Fait » et on fait un commit Git.

## À faire

- [ ] Ligne « Clés API » dans le panneau Réglages (les clés TMDB et RAWG sont cachées depuis la v14)
- [ ] Trier la liste (à faire d'abord, ordre alphabétique…)
- [ ] Ajouter une note à chaque élément (« recommandé par… », note sur 5)
- [ ] Synchroniser la liste entre le PC et l'iPhone (stockage en ligne)

## Fait

- [x] Version initiale : ajouter, cocher, supprimer, filtrer par type (PWA, données sur le téléphone)
- [x] Publication sur GitHub Pages : https://womack82.github.io/mes-listes/
- [x] Section « Terminés » repliable sous la liste, qui se souvient de son état ouvert/fermé
- [x] Fichier TODO.md pour suivre les améliorations
- [x] Modifier le titre et le type d'un élément existant (bouton ✏️)
- [x] Suppression avec confirmation (✕ puis « Supprimer ? ») ; l'élément part dans une section « Supprimés » en lecture seule (titre, type, date)
- [x] Sections « Terminés » et « Supprimés » repliées à chaque ouverture, avec compteur, masquées si vides, et filtrées par type
- [x] Boutons plus visibles : fond et bordure sur ✏️ / ✕ et les titres de section, effet d'appui, survol à la souris, contour au clavier
- [x] Sauvegarde : boutons « Exporter » (fichier JSON avec numéro de version du format ; menu de partage sur iPhone) et « Importer » (vérification complète du fichier, confirmation avec le nombre d'éléments perdus, proposition de sauvegarder la liste actuelle avant de la remplacer)
- [x] TMDB étape 1 : section « Réglages » pour coller la clé TMDB (vérifiée auprès de TMDB, gardée seulement sur l'appareil, jamais dans GitHub ni dans les exports)
- [x] TMDB étape 2 : recherche films et séries en français pendant la saisie (titre, année, affiche), type mis automatiquement, saisie manuelle toujours possible ; on stocke seulement titre, année, adresse de l'affiche et identifiant TMDB ; changer le type d'un élément retire ses infos TMDB ; fichier de sauvegarde en version 2 (lit toujours la version 1)
- [x] TMDB étape 3 : petite affiche et année affichées dans la liste (emoji si pas d'affiche ou hors ligne) ; un élément supprimé ne garde que titre, type et date
- [x] TMDB étape 4 : logo TMDB et mention « This product uses the TMDB API but is not endorsed or certified by TMDB » en bas de l'app
- [x] Numéro de version (ex : v10) affiché à côté du titre, pour vérifier que la mise à jour est bien arrivée
- [x] Règle de numérotation : nouvelle demande → numéro principal (v11, v12…) ; modification d'une demande existante → sous-numéro (v10.1, v10.2…)
- [x] v11 — Recherche de jeux vidéo via RAWG (type « 🎮 Jeu ») : même présentation que TMDB, saisie manuelle toujours possible ; on stocke seulement titre, année et identifiant RAWG (**pas de jaquette**, emoji 🎮 à la place) ; clé RAWG dans « Réglages » (gardée seulement sur l'appareil) ; lien vers rawg.io en bas de l'app (exigé par RAWG) ; fichier de sauvegarde en version 3 (lit toujours les versions 1 et 2). Titres en anglais : RAWG ne propose pas le français
- [x] v12 — Lien « IMDb ↗ » sous le titre des films et séries venus de TMDB (ouvre la fiche exacte) : l'identifiant IMDb est demandé à TMDB à l'ajout et stocké avec l'élément ; les éléments déjà dans la liste sont complétés automatiquement quand l'app est en ligne ; pas de lien pour les éléments ajoutés à la main ; fichier de sauvegarde en version 4 (lit toujours les versions 1 à 3)
- [x] v13 — Nouvelle apparence : palette fond #e9eef5, texte marine #0a2342, accent orange #ff6a00 (texte marine dessus), bleu #2c6e9a (texte blanc dessus) ; cartes blanches arrondies (16 px) ; zones à toucher d'au moins 44 px ; animations de 180 ms coupées si « réduire les animations » est activé ; mode sombre retiré ; logo W en SVG à la place du titre ; nouvelle icône (W clair sur carré marine)
- [x] v14 — Nouvel écran principal : en-tête avec bouton Réglages (roue dans un cercle blanc) et logo W centré ; filtres sur deux lignes de trois (36 px, zone d'appui 44 px) ; liste des seuls éléments à faire en cartes (vignette 48 × 68 avec icône orange du type si pas d'affiche, titre en gras, type et année, case ronde) ; un appui sur une carte ouvre un panneau du bas (Voir sur IMDb, Modifier dans le panneau, Supprimer avec confirmation, Annuler) ; panneau Réglages qui descend du haut : Terminés (badge), Supprimés (badge, historique en lecture seule), Sauvegarde ; formulaire d'ajout et clés API cachés en attendant la suite
- [x] v15 — Nouveau formulaire d'ajout : bouton + orange flottant (60 px, en bas à droite) qui ouvre un calque montant du bas (poignée, titre « Ajouter », fermeture) ; 5 tuiles de catégorie avec icône (Film par défaut) ; champ titre de 56 px avec focus à l'ouverture et texte indicatif selon la catégorie ; bouton « Ajouter à ma liste » toujours visible, même clavier ouvert (mesure de la partie visible de l'écran) ; recherche TMDB / RAWG avec affiches branchée sous le champ ; le calque se ferme après l'ajout
- [x] v15.1 — Numéro de version placé en bas à droite du logo, aligné avec le bas du W (le logo reste centré)
- [x] v1.1 — Nouvelle règle de numérotation : on reste en v1 et chaque changement ajoute 1 au second numéro (v1.1, v1.2…). Les numéros v10 à v15.1 ci-dessus datent de l'ancienne règle
