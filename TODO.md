# TODO — Mes listes

Liste des améliorations de l'app. Quand une amélioration est faite,
on coche la case `[x]`, on la déplace dans « Fait » et on fait un commit Git.

## À faire

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
