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
