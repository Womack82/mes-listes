// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Numéro de version affiché à côté du logo.
// ⚠️ Doit toujours être le même que NOM_CACHE dans service-worker.js
// On reste en v1 : chaque changement, quel qu'il soit, ajoute 1 au second
// numéro (v1.1 → v1.2 → v1.3…). (Avant le 10/11/2026 : v10 à v15.1.)
const VERSION = "v1.1";

// Noms sous lesquels on range les données dans la mémoire du téléphone
const CLE_STOCKAGE = "mes-listes";
const CLE_SUPPRIMES = "mes-listes-supprimes";

// Emoji affiché devant chaque type
const EMOJIS = { film: "🎬", serie: "📺", jeu: "🎮", recette: "🍳", autre: "📌" };

// Début de l'adresse des affiches TMDB (w185 = largeur 185 pixels)
const ADRESSE_AFFICHES = "https://image.tmdb.org/t/p/w185";

// --- 1. Charger les données sauvegardées --------------------
// localStorage ne stocke que du texte : on transforme le texte en
// tableau avec JSON.parse. Si rien n'est enregistré, on part d'un tableau vide.
function charger(cle) {
  try {
    return JSON.parse(localStorage.getItem(cle)) || [];
  } catch (erreur) {
    console.error("Impossible de lire les données :", erreur);
    return [];
  }
}

// --- 2. Sauvegarder les données ------------------------------
function sauvegarder() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(elements));
  localStorage.setItem(CLE_SUPPRIMES, JSON.stringify(supprimes));
}

// Les éléments de la liste. Chacun ressemble à :
// { id: "1731...", titre: "Inception", type: "film", fait: false }
let elements = charger(CLE_STOCKAGE);

// Les éléments supprimés (on ne garde que l'essentiel) :
// { titre: "Inception", type: "film", dateSuppression: "2026-11-09T14:30:00.000Z" }
let supprimes = charger(CLE_SUPPRIMES);

// Le filtre actuellement choisi ("tous", "film", "serie", ...)
let filtreActif = "tous";

// On récupère les morceaux de la page dont on a besoin
// Le calque « Ajouter » : formulaire, champ titre, tuiles de catégorie
const formulaire = document.getElementById("formulaire-ajout");
const champTitre = document.getElementById("champ-titre");
const choixCategorie = document.getElementById("choix-categorie");
const liste = document.getElementById("liste");
const messageVide = document.getElementById("message-vide");
const boutonsFiltre = document.querySelectorAll("#filtres button");
// Dans le panneau Réglages
const listeFaits = document.getElementById("liste-faits");
const badgeFaits = document.getElementById("badge-faits");
const faitsVide = document.getElementById("faits-vide");
const listeSupprimes = document.getElementById("liste-supprimes");
const badgeSupprimes = document.getElementById("badge-supprimes");
const supprimesVide = document.getElementById("supprimes-vide");

// Nom du type affiché sous le titre des cartes
const NOMS_SIMPLES = { film: "Film", serie: "Série", jeu: "Jeu", recette: "Recette", autre: "Autre" };

// Icônes des types, dessinées en SVG (24 × 24) pour pouvoir les colorer :
// clap de cinéma, télé, manette, toque, punaise
const ICONES_TYPES = {
  film: "M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 11 3.4 8.1a1 1 0 0 1 .8-1.2l13.7-2.8a1 1 0 0 1 1.2.8l.5 2.6z M8.4 6.2l2.2 3.2 M13.2 5.2l2.2 3.2",
  serie: "M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 3l4 4 4-4",
  jeu: "M7 8h10a5 5 0 0 1 5 5v1a3.5 3.5 0 0 1-6.3 2.1L14.5 15h-5l-1.2 1.1A3.5 3.5 0 0 1 2 14v-1a5 5 0 0 1 5-5z M7.5 10.5v4 M5.5 12.5h4 M16 11.5h.01 M18 13.5h.01",
  recette: "M6 14a4 4 0 1 1 1.4-7.8 5 5 0 0 1 9.2 0A4 4 0 1 1 18 14v6H6z M6 17h12",
  autre: "M9 3h6 M10 3v6l-3 4h10l-3-4V3 M12 13v8",
};

// Fabrique une icône SVG à partir d'un tracé (trait de la couleur du texte)
function creerIcone(trace, classe = "icone-svg") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  const chemin = document.createElementNS(ns, "path");
  chemin.setAttribute("d", trace);
  svg.append(chemin);
  return svg;
}

// Garde l'élément s'il correspond au filtre choisi
function correspondAuFiltre(el) {
  return filtreActif === "tous" || el.type === filtreActif;
}

// --- 3. Afficher les listes ----------------------------------
// Écran principal : seulement les éléments à faire (selon le filtre).
// Panneau Réglages : tous les terminés et tous les supprimés (sans filtre).
function afficher() {
  liste.innerHTML = "";
  listeFaits.innerHTML = "";
  listeSupprimes.innerHTML = "";

  const visibles = elements.filter(correspondAuFiltre);
  const aFaire = visibles.filter((el) => !el.fait);
  const faits = elements.filter((el) => el.fait);
  // Les supprimés, du plus récent au plus ancien
  const supprimesRecents = [...supprimes].reverse();

  for (const el of aFaire) liste.append(creerCarte(el));
  for (const el of faits) listeFaits.append(creerCarte(el));
  for (const el of supprimesRecents) listeSupprimes.append(creerLigneSupprimee(el));

  // Badges des lignes « Terminés » et « Supprimés » du panneau Réglages
  badgeFaits.textContent = faits.length;
  badgeSupprimes.textContent = supprimes.length;
  faitsVide.hidden = faits.length > 0;
  supprimesVide.hidden = supprimes.length > 0;

  // Message quand il ne reste rien à faire
  if (visibles.length === 0) {
    messageVide.textContent = "Rien ici pour l'instant.";
  } else {
    messageVide.textContent = "Tout est fait ! 🎉";
  }
  messageVide.hidden = aFaire.length > 0;
}

// Fabrique la carte <li> d'un élément :
// vignette + titre + type/année (un appui ouvre le panneau d'actions)
// et à droite une case ronde pour cocher.
function creerCarte(el) {
  const li = document.createElement("li");
  li.className = "carte";
  if (el.fait) li.classList.add("fait");

  // Toute la partie gauche est un bouton : il ouvre le panneau d'actions
  const corps = document.createElement("button");
  corps.type = "button";
  corps.className = "carte-corps";
  corps.addEventListener("click", () => ouvrirActions(el.id));

  // Titre en gras (textContent empêche d'injecter du code HTML par erreur)
  const titre = document.createElement("span");
  titre.className = "carte-titre";
  titre.textContent = el.titre;

  // Ligne grise : type, et année si elle existe
  const details = document.createElement("span");
  details.className = "carte-details";
  details.textContent = el.annee ? `${NOMS_SIMPLES[el.type]} · ${el.annee}` : NOMS_SIMPLES[el.type];

  const textes = document.createElement("span");
  textes.className = "carte-textes";
  textes.append(titre, details);
  corps.append(creerVignette(el.affiche, el.type), textes);

  // Case ronde : une vraie case à cocher, cachée, et un rond dessiné à côté.
  // Le <label> autour fait 44 px pour que le doigt ne la rate pas.
  const zone = document.createElement("label");
  zone.className = "case-ronde";
  const caseACocher = document.createElement("input");
  caseACocher.type = "checkbox";
  caseACocher.checked = el.fait;
  caseACocher.setAttribute("aria-label", el.fait ? `Remettre à faire : ${el.titre}` : `Marquer comme terminé : ${el.titre}`);
  caseACocher.addEventListener("change", () => basculer(el.id));
  const rond = document.createElement("span");
  rond.className = "rond";
  rond.append(creerIcone("M6 12.5l4 4 8-9", "coche"));
  zone.append(caseACocher, rond);

  li.append(corps, zone);
  return li;
}

// Fabrique une ligne de l'historique « Supprimés » (lecture seule, aucun bouton)
function creerLigneSupprimee(el) {
  const li = document.createElement("li");
  li.className = "carte supprime";

  const icone = document.createElement("span");
  icone.className = "mini-vignette";
  icone.append(creerIcone(ICONES_TYPES[el.type]));

  const titre = document.createElement("span");
  titre.className = "carte-titre";
  titre.textContent = el.titre;

  const date = document.createElement("span");
  date.className = "date";
  date.textContent = new Date(el.dateSuppression).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  li.append(icone, titre, date);
  return li;
}

// --- 4. Les actions ------------------------------------------
// infos (facultatif) : quand le titre a été choisi dans une recherche
// - TMDB (films, séries) : { annee, affiche, idTmdb } (+ idImdb, cherché juste après)
// - RAWG (jeux)          : { annee, idRawg } (pas de jaquette, volontairement)
function ajouter(titre, type, infos = null) {
  const el = {
    id: Date.now().toString(), // identifiant unique basé sur l'heure
    titre: titre,
    type: type,
    fait: false,
  };
  if (infos) {
    if (infos.annee) el.annee = infos.annee;
    if (infos.affiche) el.affiche = infos.affiche;
    if (infos.idTmdb) el.idTmdb = infos.idTmdb;
    if (infos.idRawg) el.idRawg = infos.idRawg;
  }
  elements.push(el);
  sauvegarder();
  afficher();
  // Film ou série venu de TMDB : on va chercher son identifiant IMDb
  if (el.idTmdb) completerImdb(el);
}

// Retire les informations venues de TMDB ou RAWG (affiche, année, identifiants)
function retirerInfosExternes(el) {
  delete el.annee;
  delete el.affiche;
  delete el.idTmdb;
  delete el.idImdb;
  delete el.idRawg;
}

function basculer(id) {
  const el = elements.find((e) => e.id === id);
  el.fait = !el.fait; // true devient false et inversement
  sauvegarder();
  afficher();
}

function modifier(id, titre, type) {
  const el = elements.find((e) => e.id === id);
  // Si le type change, les infos TMDB / RAWG ne correspondent plus
  // (un identifiant TMDB de film ne désigne pas la même chose côté séries)
  if (type !== el.type) retirerInfosExternes(el);
  el.titre = titre;
  el.type = type;
  sauvegarder();
  afficher();
}

// L'élément part dans "Supprimés".
// On n'y garde que titre, type et date : l'affiche, l'année et
// les identifiants TMDB / IMDb / RAWG sont perdus.
function supprimer(id) {
  const el = elements.find((e) => e.id === id);
  supprimes.push({
    titre: el.titre,
    type: el.type,
    dateSuppression: new Date().toISOString(),
  });
  elements = elements.filter((e) => e.id !== id);
  sauvegarder();
  afficher();
}

// --- 4 bis. Le panneau d'actions (monte du bas de l'écran) ---
// S'ouvre quand on touche une carte : Voir sur IMDb, Modifier, Supprimer.
const panneauActions = document.getElementById("panneau-actions");
const actionsTitre = document.getElementById("actions-titre");
const actionsBoutons = document.getElementById("actions-boutons");
const actionsImdb = document.getElementById("actions-imdb");
const actionsModifier = document.getElementById("actions-modifier");
const actionsSupprimer = document.getElementById("actions-supprimer");
const actionsEdition = document.getElementById("actions-edition");
const editionTitre = document.getElementById("edition-titre");
const editionType = document.getElementById("edition-type");

// L'élément concerné par le panneau (null = panneau fermé)
let idActions = null;
let minuteurConfirmation = null;

// Le menu des types du panneau : « 🎬 Film », « 📺 Série »…
for (const type of Object.keys(NOMS_SIMPLES)) {
  editionType.append(new Option(`${EMOJIS[type]} ${NOMS_SIMPLES[type]}`, type));
}

// Remet le bouton « Supprimer » dans son état normal
function annulerConfirmation() {
  clearTimeout(minuteurConfirmation);
  actionsSupprimer.textContent = "Supprimer";
  actionsSupprimer.classList.remove("confirmer");
}

function ouvrirActions(id) {
  const el = elements.find((e) => e.id === id);
  if (!el) return;
  idActions = id;
  actionsTitre.textContent = el.titre;
  // Lien IMDb seulement pour les films et séries qui en ont un
  actionsImdb.hidden = !el.idImdb;
  if (el.idImdb) actionsImdb.href = `https://www.imdb.com/title/${el.idImdb}/`;
  annulerConfirmation();
  actionsBoutons.hidden = false;
  actionsEdition.hidden = true;
  panneauActions.showModal();
}

function fermerActions() {
  annulerConfirmation();
  idActions = null;
  panneauActions.close();
}

// « Modifier » : le titre et le type se changent dans le panneau
actionsModifier.addEventListener("click", () => {
  const el = elements.find((e) => e.id === idActions);
  if (!el) return;
  annulerConfirmation();
  editionTitre.value = el.titre;
  editionType.value = el.type;
  actionsBoutons.hidden = true;
  actionsEdition.hidden = false;
  editionTitre.focus();
});

actionsEdition.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const nouveauTitre = editionTitre.value.trim();
  if (nouveauTitre === "" || idActions === null) return;
  modifier(idActions, nouveauTitre, editionType.value);
  fermerActions();
});

document.getElementById("edition-annuler").addEventListener("click", () => {
  actionsEdition.hidden = true;
  actionsBoutons.hidden = false;
});

// « Supprimer » : premier appui → « Confirmer la suppression ? » pendant
// 3 secondes ; deuxième appui → l'élément part dans « Supprimés »
actionsSupprimer.addEventListener("click", () => {
  if (idActions === null) return;
  if (actionsSupprimer.classList.contains("confirmer")) {
    supprimer(idActions);
    fermerActions();
    return;
  }
  actionsSupprimer.textContent = "Confirmer la suppression ?";
  actionsSupprimer.classList.add("confirmer");
  minuteurConfirmation = setTimeout(annulerConfirmation, 3000);
});

document.getElementById("actions-annuler").addEventListener("click", fermerActions);
// Échap (clavier) ferme aussi le panneau : on remet tout à zéro
panneauActions.addEventListener("close", () => {
  annulerConfirmation();
  idActions = null;
});

// Un appui sur le voile sombre (autour du panneau) ferme le panneau.
// Le contenu est dans un <div> intérieur : un clic qui vise le <dialog>
// lui-même est donc forcément un clic sur le voile.
function fermerSurVoile(panneau, fermer) {
  panneau.addEventListener("click", (evenement) => {
    if (evenement.target === panneau) fermer();
  });
}
fermerSurVoile(panneauActions, fermerActions);

// --- 4 ter. Le panneau Réglages (descend du haut de l'écran) ---
const panneauReglages = document.getElementById("panneau-reglages");
const reglagesTitre = document.getElementById("reglages-titre");
const reglagesRetour = document.getElementById("reglages-retour");
const VUES = {
  menu: { titre: "Réglages", bloc: document.getElementById("vue-menu") },
  faits: { titre: "Terminés", bloc: document.getElementById("vue-faits") },
  supprimes: { titre: "Supprimés", bloc: document.getElementById("vue-supprimes") },
  sauvegarde: { titre: "Sauvegarde", bloc: document.getElementById("vue-sauvegarde") },
};

// Montre une seule vue du panneau ; la flèche de retour hors du menu
function afficherVue(nom) {
  for (const [cle, vue] of Object.entries(VUES)) vue.bloc.hidden = cle !== nom;
  reglagesTitre.textContent = VUES[nom].titre;
  reglagesRetour.hidden = nom === "menu";
}

document.getElementById("bouton-reglages").addEventListener("click", () => {
  afficherVue("menu");
  panneauReglages.showModal();
});
for (const ligne of document.querySelectorAll(".ligne-reglage")) {
  ligne.addEventListener("click", () => afficherVue(ligne.dataset.vue));
}
reglagesRetour.addEventListener("click", () => afficherVue("menu"));
const fermerReglages = () => panneauReglages.close();
document.getElementById("reglages-fermer").addEventListener("click", fermerReglages);
fermerSurVoile(panneauReglages, fermerReglages);

// --- 5. Réagir aux actions de l'utilisateur ------------------
// --- 4 quater. Le calque « Ajouter » (monte du bas) ----------
const feuilleAjout = document.getElementById("feuille-ajout");

// Texte indicatif du champ, selon la catégorie choisie
const INDICATIONS = {
  film: "Nom du film",
  serie: "Nom de la série",
  jeu: "Nom du jeu",
  recette: "Nom de la recette",
  autre: "Ce qu'il ne faut pas oublier",
};

// La catégorie cochée parmi les 5 tuiles
function categorieChoisie() {
  return choixCategorie.querySelector("input:checked").value;
}

// Dessine l'icône de chaque tuile (les mêmes que sur les cartes)
for (const zone of choixCategorie.querySelectorAll(".tuile-icone")) {
  zone.append(creerIcone(ICONES_TYPES[zone.dataset.type]));
}

// Changer de catégorie : nouveau texte indicatif, et nouvelle recherche
// (TMDB pour films et séries, RAWG pour les jeux, rien sinon)
choixCategorie.addEventListener("change", () => {
  champTitre.placeholder = INDICATIONS[categorieChoisie()];
  programmerRecherche();
});

// Quand le clavier de l'iPhone s'ouvre, la page ne rétrécit pas : il
// recouvre le bas de l'écran. On mesure la partie vraiment visible
// (visualViewport) pour remonter le calque au-dessus du clavier.
function ajusterAuClavier() {
  const vue = window.visualViewport;
  if (!vue) return; // vieux navigateur : on laisse faire
  const clavier = Math.max(0, window.innerHeight - vue.height - vue.offsetTop);
  feuilleAjout.style.setProperty("--clavier", `${clavier}px`);
  feuilleAjout.style.setProperty("--visible", `${vue.height}px`);
}

function ouvrirAjout() {
  // Chaque ouverture repart de zéro : Film, champ vide, pas de résultats
  choixCategorie.querySelector('input[value="film"]').checked = true;
  champTitre.placeholder = INDICATIONS.film;
  champTitre.value = "";
  masquerRecherche();
  ajusterAuClavier();
  feuilleAjout.showModal();
  // Focus dans le champ tout de suite (pendant l'appui) : c'est la condition
  // pour que l'iPhone accepte d'ouvrir le clavier
  champTitre.focus();
}

function fermerAjout() {
  masquerRecherche();
  feuilleAjout.close();
}

document.getElementById("bouton-ajouter").addEventListener("click", ouvrirAjout);
document.getElementById("ajout-fermer").addEventListener("click", fermerAjout);
fermerSurVoile(feuilleAjout, fermerAjout);
feuilleAjout.addEventListener("close", masquerRecherche); // Échap au clavier
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", ajusterAuClavier);
  window.visualViewport.addEventListener("scroll", ajusterAuClavier);
}

// « Ajouter à ma liste » : saisie manuelle, sans infos TMDB / RAWG
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger
  const titre = champTitre.value.trim();
  if (titre === "") {
    champTitre.focus(); // rien d'écrit : on remet simplement le curseur
    return;
  }
  ajouter(titre, categorieChoisie());
  fermerAjout();
});

for (const bouton of boutonsFiltre) {
  bouton.addEventListener("click", () => {
    filtreActif = bouton.dataset.type;
    boutonsFiltre.forEach((b) => {
      b.classList.toggle("actif", b === bouton);
      b.setAttribute("aria-pressed", b === bouton); // annoncé aux lecteurs d'écran
    });
    afficher();
  });
}

// --- 6. Sauvegarde : exporter et importer --------------------
// Numéro de version du format du fichier. Si un jour on change la forme
// du fichier, on passera à 2 et on saura lire les anciens fichiers.
const FORMAT_NOM = "mes-listes";
// Version 1 : titre, type, fait. Version 2 : + année, affiche, identifiant TMDB
// (facultatifs). Version 3 : + identifiant RAWG pour les jeux (facultatif).
// Version 4 : + identifiant IMDb pour les films et séries (facultatif).
// L'app sait lire les quatre.
const FORMAT_VERSION = 4;

const boutonExporter = document.getElementById("bouton-exporter");
const boutonImporter = document.getElementById("bouton-importer");
const champFichier = document.getElementById("champ-fichier");
const messageSauvegarde = document.getElementById("message-sauvegarde");
const fenetreImport = document.getElementById("fenetre-import");
const texteImport = document.getElementById("texte-import");
const conseilSauvegarde = document.getElementById("conseil-sauvegarde");
const infoSauvegardeFaite = document.getElementById("info-sauvegarde-faite");
const boutonSauverAvant = document.getElementById("bouton-sauver-avant");
const boutonRemplacer = document.getElementById("bouton-remplacer");
const boutonAnnulerImport = document.getElementById("bouton-annuler-import");

// Les données du fichier choisi, en attente de confirmation
let importEnAttente = null;

// Affiche un message dans une zone (succes = vert, sinon rouge).
// Par défaut, la zone de la section Sauvegarde.
function afficherMessage(texte, succes, zone = messageSauvegarde) {
  zone.textContent = texte;
  zone.className = succes ? "message succes" : "message erreur";
  zone.hidden = false;
}

// "1 élément" / "3 éléments"
function pluriel(nombre, mot) {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

// Résumé lisible d'une liste : "12 à faire, 5 terminés, 3 supprimés"
function resumer(lesElements, lesSupprimes) {
  const faits = lesElements.filter((e) => e.fait).length;
  return `${lesElements.length - faits} à faire, ${pluriel(faits, "terminé")}, ${pluriel(lesSupprimes.length, "supprimé")}`;
}

// Proposer le fichier à l'utilisateur.
// - Sur iPhone / téléphone : le menu de partage ("Enregistrer dans Fichiers", AirDrop…)
// - Sur ordinateur : un téléchargement classique
async function exporter() {
  const donnees = {
    format: FORMAT_NOM,
    version: FORMAT_VERSION,
    dateExport: new Date().toISOString(),
    elements: elements,
    supprimes: supprimes,
  };
  const texte = JSON.stringify(donnees, null, 2); // indenté : lisible à l'œil
  const date = new Date().toLocaleDateString("sv-SE"); // donne "2026-11-09"
  const nomFichier = `mes-listes-${date}.json`;
  const fichier = new File([texte], nomFichier, { type: "application/json" });

  // Écran tactile + partage de fichiers possible → menu de partage
  const ecranTactile = window.matchMedia("(pointer: coarse)").matches;
  if (ecranTactile && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nomFichier });
      return true;
    } catch (erreur) {
      // L'utilisateur a fermé le menu sans rien choisir : ce n'est pas une erreur
      if (erreur.name === "AbortError") return false;
      // Autre problème : on essaie le téléchargement classique
    }
  }

  // Téléchargement classique : on crée un lien invisible et on "clique" dessus
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000); // libère la mémoire
  return true;
}

// Vérifie le contenu d'un fichier. Renvoie { elements, supprimes } si tout
// est correct, sinon lance une erreur avec un message clair.
// On recopie seulement les champs connus, pour ne rien garder d'inattendu.
function verifierFichier(donnees) {
  if (typeof donnees !== "object" || donnees === null || donnees.format !== FORMAT_NOM) {
    throw new Error("Ce fichier n'est pas une sauvegarde de Mes listes.");
  }
  if (!Number.isInteger(donnees.version) || donnees.version < 1) {
    throw new Error("Le numéro de version du fichier est invalide.");
  }
  if (donnees.version > FORMAT_VERSION) {
    throw new Error("Ce fichier vient d'une version plus récente de l'app. Mets l'app à jour puis réessaie.");
  }
  if (!Array.isArray(donnees.elements) || !Array.isArray(donnees.supprimes)) {
    throw new Error("Le fichier est incomplet : il manque la liste des éléments.");
  }

  const typeValide = (t) => Object.hasOwn(EMOJIS, t);
  const titreValide = (t) => typeof t === "string" && t.trim() !== "";
  const idsVus = new Set();

  const nouveauxElements = donnees.elements.map((el, i) => {
    const numero = `L'élément n°${i + 1}`;
    if (typeof el !== "object" || el === null) throw new Error(`${numero} est illisible.`);
    if (typeof el.id !== "string" || el.id === "") throw new Error(`${numero} n'a pas d'identifiant.`);
    if (idsVus.has(el.id)) throw new Error(`${numero} a le même identifiant qu'un autre élément.`);
    idsVus.add(el.id);
    if (!titreValide(el.titre)) throw new Error(`${numero} n'a pas de titre.`);
    if (!typeValide(el.type)) throw new Error(`${numero} a un type inconnu (« ${el.type} »).`);
    if (typeof el.fait !== "boolean") throw new Error(`${numero} n'indique pas s'il est terminé.`);
    const propre = { id: el.id, titre: el.titre.trim(), type: el.type, fait: el.fait };

    // Infos TMDB (version 2, facultatives) : vérifiées si elles sont là
    if (el.idTmdb !== undefined) {
      if (!Number.isInteger(el.idTmdb) || el.idTmdb <= 0) throw new Error(`${numero} a un identifiant TMDB invalide.`);
      if (el.type !== "film" && el.type !== "serie") throw new Error(`${numero} a un identifiant TMDB mais n'est ni un film ni une série.`);
      propre.idTmdb = el.idTmdb;
    }
    // Identifiant IMDb (version 4, facultatif) : "tt" suivi de chiffres,
    // seulement pour un film ou une série venu de TMDB
    if (el.idImdb !== undefined) {
      if (typeof el.idImdb !== "string" || !/^tt\d{1,12}$/.test(el.idImdb)) throw new Error(`${numero} a un identifiant IMDb invalide.`);
      if (el.idTmdb === undefined) throw new Error(`${numero} a un identifiant IMDb mais pas d'identifiant TMDB.`);
      propre.idImdb = el.idImdb;
    }
    // Infos RAWG (version 3, facultatives) : seulement pour les jeux, sans jaquette
    if (el.idRawg !== undefined) {
      if (!Number.isInteger(el.idRawg) || el.idRawg <= 0) throw new Error(`${numero} a un identifiant RAWG invalide.`);
      if (el.type !== "jeu") throw new Error(`${numero} a un identifiant RAWG mais n'est pas un jeu.`);
      propre.idRawg = el.idRawg;
    }
    if (el.annee !== undefined) {
      if (!Number.isInteger(el.annee) || el.annee < 1800 || el.annee > 2200) throw new Error(`${numero} a une année invalide.`);
      propre.annee = el.annee;
    }
    if (el.affiche !== undefined) {
      if (typeof el.affiche !== "string" || !el.affiche.startsWith(ADRESSE_AFFICHES)) {
        throw new Error(`${numero} a une adresse d'affiche invalide.`);
      }
      propre.affiche = el.affiche;
    }
    return propre;
  });

  const nouveauxSupprimes = donnees.supprimes.map((el, i) => {
    const numero = `L'élément supprimé n°${i + 1}`;
    if (typeof el !== "object" || el === null) throw new Error(`${numero} est illisible.`);
    if (!titreValide(el.titre)) throw new Error(`${numero} n'a pas de titre.`);
    if (!typeValide(el.type)) throw new Error(`${numero} a un type inconnu (« ${el.type} »).`);
    if (typeof el.dateSuppression !== "string" || isNaN(Date.parse(el.dateSuppression))) {
      throw new Error(`${numero} a une date de suppression invalide.`);
    }
    return { titre: el.titre.trim(), type: el.type, dateSuppression: el.dateSuppression };
  });

  return { elements: nouveauxElements, supprimes: nouveauxSupprimes };
}

// Le fichier a été choisi : on le lit, on le vérifie, puis on demande confirmation
async function lireFichierChoisi() {
  const fichier = champFichier.files[0];
  champFichier.value = ""; // permet de rechoisir le même fichier plus tard
  if (!fichier) return;
  messageSauvegarde.hidden = true;

  let donnees;
  try {
    donnees = JSON.parse(await fichier.text());
  } catch {
    afficherMessage(`« ${fichier.name} » n'est pas un fichier de sauvegarde lisible. Rien n'a été modifié.`, false);
    return;
  }

  try {
    importEnAttente = verifierFichier(donnees);
  } catch (erreur) {
    afficherMessage(`Fichier refusé : ${erreur.message} Rien n'a été modifié.`, false);
    return;
  }

  // Préparer la fenêtre de confirmation
  const nbActuels = elements.length + supprimes.length;
  const nbImportes = importEnAttente.elements.length + importEnAttente.supprimes.length;
  const listeVide = nbActuels === 0;
  texteImport.textContent = listeVide
    ? `Ta liste actuelle est vide. Elle sera remplacée par celle du fichier (${resumer(importEnAttente.elements, importEnAttente.supprimes)}).`
    : `Tu vas perdre ${pluriel(nbActuels, "élément")} de ta liste actuelle (${resumer(elements, supprimes)}). ` +
      `Ils seront remplacés par les ${pluriel(nbImportes, "élément")} du fichier (${resumer(importEnAttente.elements, importEnAttente.supprimes)}).`;
  // Pas de sauvegarde à proposer si la liste actuelle est vide
  conseilSauvegarde.hidden = listeVide;
  boutonSauverAvant.hidden = listeVide;
  infoSauvegardeFaite.hidden = true;
  fenetreImport.showModal();
}

// Remplace toute la liste par le fichier importé
function remplacerListe() {
  if (!importEnAttente) return;
  const anciensElements = elements;
  const anciensSupprimes = supprimes;
  elements = importEnAttente.elements;
  supprimes = importEnAttente.supprimes;
  try {
    sauvegarder();
  } catch (erreur) {
    // Mémoire du téléphone pleine, etc. : on remet tout comme avant
    elements = anciensElements;
    supprimes = anciensSupprimes;
    sauvegarder();
    fenetreImport.close();
    afficherMessage("Impossible d'enregistrer la nouvelle liste (mémoire pleine ?). Rien n'a été modifié.", false);
    return;
  }
  fenetreImport.close();
  afficher();
  afficherMessage(`Import réussi : ${resumer(elements, supprimes)}.`, true);
  completerImdbManquants(); // un ancien fichier n'a pas encore les liens IMDb
}

boutonExporter.addEventListener("click", async () => {
  messageSauvegarde.hidden = true;
  await exporter();
});
boutonImporter.addEventListener("click", () => champFichier.click());
champFichier.addEventListener("change", lireFichierChoisi);
boutonSauverAvant.addEventListener("click", async () => {
  if (await exporter()) infoSauvegardeFaite.hidden = false;
});
boutonRemplacer.addEventListener("click", remplacerListe);
boutonAnnulerImport.addEventListener("click", () => fenetreImport.close());
// Quand la fenêtre se ferme (Annuler, touche Échap…), on oublie le fichier
fenetreImport.addEventListener("close", () => {
  importEnAttente = null;
});

// --- 7. Les clés TMDB et RAWG et les appels -------------------
// Les clés sont rangées dans la mémoire de l'appareil (localStorage),
// jamais dans un fichier du projet ni dans les exports.
const CLE_TMDB = "mes-listes-cle-tmdb";
const CLE_RAWG = "mes-listes-cle-rawg";

function lireCle(nomStockage) {
  try {
    return localStorage.getItem(nomStockage) || "";
  } catch {
    return "";
  }
}
const lireCleTmdb = () => lireCle(CLE_TMDB);
const lireCleRawg = () => lireCle(CLE_RAWG);

// Interroge TMDB. TMDB donne deux sortes de clés, on accepte les deux :
// - la "clé d'API" courte (32 caractères) → ajoutée à l'adresse
// - le "jeton d'accès en lecture" très long (commence par "eyJ") → envoyé à part
async function appelerTmdb(chemin, parametres = {}, cle = lireCleTmdb()) {
  const adresse = new URL("https://api.themoviedb.org/3" + chemin);
  for (const [nom, valeur] of Object.entries(parametres)) {
    adresse.searchParams.set(nom, valeur);
  }
  const options = {};
  if (cle.startsWith("eyJ")) {
    options.headers = { Authorization: `Bearer ${cle}` };
  } else {
    adresse.searchParams.set("api_key", cle);
  }
  const reponse = await fetch(adresse, options);
  if (!reponse.ok) {
    const erreur = new Error(`TMDB a répondu ${reponse.status}`);
    erreur.statut = reponse.status;
    throw erreur;
  }
  return reponse.json();
}

// Interroge RAWG (jeux vidéo). RAWG n'a qu'une sorte de clé : ajoutée à l'adresse.
async function appelerRawg(chemin, parametres = {}, cle = lireCleRawg()) {
  const adresse = new URL("https://api.rawg.io/api" + chemin);
  for (const [nom, valeur] of Object.entries(parametres)) {
    adresse.searchParams.set(nom, valeur);
  }
  adresse.searchParams.set("key", cle);
  const reponse = await fetch(adresse);
  if (!reponse.ok) {
    const erreur = new Error(`RAWG a répondu ${reponse.status}`);
    erreur.statut = reponse.status;
    throw erreur;
  }
  return reponse.json();
}

// Une clé refusée : TMDB répond 401, RAWG répond 401 ou 403 selon les cas
const cleRefusee = (erreur) => erreur.statut === 401 || erreur.statut === 403;

// Branche un formulaire de clé de la section « Réglages ».
// Le même fonctionnement sert pour TMDB et RAWG :
// - nom : "TMDB" ou "RAWG" (pour les messages)
// - prefixe : fin des id HTML ("cle-rawg" → formulaire-cle-rawg, champ-cle-rawg…)
// - verifier(cle) : petit appel qui échoue si la clé est refusée
function brancherCle(nom, nomStockage, prefixe, verifier) {
  const formulaire = document.getElementById(`formulaire-${prefixe}`);
  const champ = document.getElementById(`champ-${prefixe}`);
  const etat = document.getElementById(`etat-${prefixe}`);
  const message = document.getElementById(`message-${prefixe}`);
  const boutonEffacer = document.getElementById(`bouton-effacer-${prefixe}`);

  function afficherEtat() {
    const presente = lireCle(nomStockage) !== "";
    etat.textContent = presente
      ? `✅ Une clé ${nom} est enregistrée sur cet appareil.`
      : `Aucune clé ${nom} enregistrée sur cet appareil : la recherche est désactivée.`;
    boutonEffacer.hidden = !presente;
  }

  function enregistrer(cle) {
    localStorage.setItem(nomStockage, cle);
    champ.value = "";
    afficherEtat();
  }

  // Enregistrer : on teste d'abord la clé auprès du service
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const cle = champ.value.trim();
    if (cle === "") {
      afficherMessage("Colle d'abord ta clé dans le champ.", false, message);
      return;
    }
    try {
      await verifier(cle);
    } catch (erreur) {
      if (cleRefusee(erreur)) {
        afficherMessage(`${nom} refuse cette clé. Vérifie que tu l'as copiée en entier. Rien n'a été enregistré.`, false, message);
        return;
      }
      // Pas de connexion : on enregistre quand même, on testera plus tard
      enregistrer(cle);
      afficherMessage("Clé enregistrée, mais impossible de la vérifier (pas de connexion ?).", false, message);
      return;
    }
    enregistrer(cle);
    afficherMessage("Clé vérifiée et enregistrée. La recherche est activée.", true, message);
  });

  boutonEffacer.addEventListener("click", () => {
    localStorage.removeItem(nomStockage);
    afficherEtat();
    afficherMessage("Clé effacée de cet appareil.", true, message);
  });

  afficherEtat();
}

brancherCle("TMDB", CLE_TMDB, "cle", (cle) => appelerTmdb("/authentication", {}, cle));
// RAWG n'a pas d'adresse pour tester une clé : on fait une mini-recherche
brancherCle("RAWG", CLE_RAWG, "cle-rawg", (cle) => appelerRawg("/games", { page_size: 1 }, cle));

// --- 7 bis. Les liens IMDb des films et séries ----------------
// La recherche TMDB ne donne pas l'identifiant IMDb (ex : "tt1375666").
// On le demande à TMDB à part, une fois, puis on le garde avec l'élément.

// Éléments pour lesquels TMDB a déjà répondu pendant cette ouverture de l'app
// (même sans identifiant IMDb) : on ne redemande pas à chaque fois.
const imdbDejaDemandes = new Set();
let completionEnCours = false;

async function completerImdb(el) {
  const { id, idTmdb, type } = el;
  if (lireCleTmdb() === "" || !navigator.onLine) return;
  const chemin = `/${type === "film" ? "movie" : "tv"}/${idTmdb}/external_ids`;
  let donnees;
  try {
    donnees = await appelerTmdb(chemin);
  } catch {
    return; // pas de connexion ou clé refusée : on réessaiera plus tard
  }
  imdbDejaDemandes.add(id);
  const idImdb = donnees.imdb_id;
  if (typeof idImdb !== "string" || !/^tt\d{1,12}$/.test(idImdb)) return; // pas sur IMDb

  // Pendant l'attente, l'élément a pu être supprimé, changé de type ou
  // remplacé par un import : on vérifie qu'il est toujours là, identique
  const actuel = elements.find((e) => e.id === id && e.idTmdb === idTmdb);
  if (!actuel) return;
  actuel.idImdb = idImdb;
  sauvegarder();
  // (la modification se fait dans le panneau d'actions : réafficher la liste
  // n'efface rien de ce qui est en train d'être tapé)
  afficher();
}

// Complète, un par un, les films et séries TMDB qui n'ont pas encore de lien IMDb
// (ceux ajoutés avant la v12, ou ajoutés hors ligne)
async function completerImdbManquants() {
  if (completionEnCours) return;
  completionEnCours = true;
  try {
    const manquants = elements.filter((e) => e.idTmdb && !e.idImdb && !imdbDejaDemandes.has(e.id));
    for (const el of manquants) await completerImdb(el);
  } finally {
    completionEnCours = false;
  }
}

// --- 8. La recherche : films et séries (TMDB), jeux (RAWG) ----
const etatRecherche = document.getElementById("etat-recherche");
const resultatsRecherche = document.getElementById("resultats-recherche");

let minuteurRecherche = null;
// Numéro de la dernière recherche lancée : si une ancienne réponse arrive
// après une plus récente, on l'ignore
let numeroRecherche = 0;

function masquerRecherche() {
  clearTimeout(minuteurRecherche);
  numeroRecherche++; // les réponses encore en route seront ignorées
  resultatsRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  etatRecherche.hidden = true;
}

function afficherEtatRecherche(texte) {
  resultatsRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  etatRecherche.textContent = texte;
  etatRecherche.hidden = false;
}

// Transforme un résultat TMDB en { titre, type, annee, affiche, idTmdb }
// (on ne garde que ça : pas de synopsis, de note, de saisons…)
function convertirResultatTmdb(r) {
  const date = r.release_date || r.first_air_date || "";
  const annee = parseInt(date.slice(0, 4), 10);
  return {
    titre: r.title || r.name,
    type: r.media_type === "movie" ? "film" : "serie",
    annee: Number.isInteger(annee) ? annee : null,
    affiche: r.poster_path ? ADRESSE_AFFICHES + r.poster_path : null,
    idTmdb: r.id,
  };
}

// Transforme un résultat RAWG en { titre, type, annee, idRawg }.
// Pas de jaquette : on ignore volontairement les images de RAWG.
function convertirResultatRawg(r) {
  const annee = parseInt((r.released || "").slice(0, 4), 10);
  return {
    titre: r.name,
    type: "jeu",
    annee: Number.isInteger(annee) ? annee : null,
    idRawg: r.id,
  };
}

// Ce qui change d'un service à l'autre pour la recherche
const SOURCES = {
  tmdb: {
    nom: "TMDB",
    lireCle: lireCleTmdb,
    // search/multi renvoie films, séries et personnes ensemble
    chercher: async (texte) => {
      const donnees = await appelerTmdb("/search/multi", {
        query: texte,
        language: "fr-FR",
        include_adult: "false",
      });
      return donnees.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv") // sans les personnes
        .slice(0, 8)
        .map(convertirResultatTmdb);
    },
  },
  rawg: {
    nom: "RAWG",
    lireCle: lireCleRawg,
    // RAWG ne propose pas de langue : les titres sont ceux de RAWG (souvent en anglais)
    chercher: async (texte) => {
      const donnees = await appelerRawg("/games", { search: texte, page_size: 8 });
      return donnees.results.slice(0, 8).map(convertirResultatRawg);
    },
  },
};

// Quel service interroger selon le type choisi (aucun pour recette / autre)
function sourcePourType(type) {
  if (type === "film" || type === "serie") return SOURCES.tmdb;
  if (type === "jeu") return SOURCES.rawg;
  return null;
}

const NOMS_TYPES = { film: "🎬 Film", serie: "📺 Série", jeu: "🎮 Jeu" };

// Fabrique la vignette d'un élément : l'affiche, ou un carré bleu marine
// avec l'icône orange du type s'il n'y a pas d'affiche ou si elle ne se
// charge pas (hors ligne)
function creerVignette(affiche, type) {
  const vide = document.createElement("span");
  vide.className = "vignette vignette-vide";
  vide.append(creerIcone(ICONES_TYPES[type]));
  if (!affiche) return vide;

  const image = document.createElement("img");
  image.className = "vignette";
  image.src = affiche;
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => image.replaceWith(vide));
  return image;
}

async function rechercher() {
  const texte = champTitre.value.trim();
  const type = categorieChoisie();

  // La recherche concerne les films, séries et jeux, à partir de 2 lettres
  const source = sourcePourType(type);
  if (!source || texte.length < 2) {
    masquerRecherche();
    return;
  }
  if (source.lireCle() === "") {
    afficherEtatRecherche(`Recherche ${source.nom} désactivée : aucune clé sur cet appareil. Tu peux ajouter le titre à la main.`);
    return;
  }
  if (!navigator.onLine) {
    afficherEtatRecherche("Hors ligne : recherche impossible. Tu peux ajouter le titre à la main.");
    return;
  }

  const numero = ++numeroRecherche;
  etatRecherche.textContent = "Recherche…";
  etatRecherche.hidden = false;

  let resultats;
  try {
    resultats = await source.chercher(texte);
  } catch (erreur) {
    if (numero !== numeroRecherche) return;
    afficherEtatRecherche(
      cleRefusee(erreur)
        ? `${source.nom} refuse ta clé. Vérifie-la dans « Réglages ». Tu peux ajouter le titre à la main.`
        : "Recherche impossible (connexion ?). Tu peux ajouter le titre à la main."
    );
    return;
  }
  if (numero !== numeroRecherche) return; // une recherche plus récente a été lancée

  if (resultats.length === 0) {
    afficherEtatRecherche(`Aucun résultat sur ${source.nom}. Appuie sur « Ajouter à ma liste » pour l'ajouter à la main.`);
    return;
  }

  etatRecherche.textContent = "Touche un résultat pour l'ajouter, ou « Ajouter à ma liste » pour garder ton texte :";
  resultatsRecherche.innerHTML = "";
  for (const res of resultats) {
    const li = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "resultat";

    const titre = document.createElement("span");
    titre.className = "titre";
    titre.textContent = res.titre;

    const details = document.createElement("span");
    details.className = "details";
    const nomType = NOMS_TYPES[res.type];
    details.textContent = res.annee ? `${nomType} · ${res.annee}` : nomType;

    const textes = document.createElement("span");
    textes.className = "textes";
    textes.append(titre, details);

    bouton.append(creerVignette(res.affiche, res.type), textes);
    bouton.addEventListener("click", () => {
      ajouter(res.titre, res.type, res);
      fermerAjout();
    });
    li.append(bouton);
    resultatsRecherche.append(li);
  }
  resultatsRecherche.hidden = false;
}

// On attend une petite pause dans la frappe avant de chercher
// (sinon une recherche partirait à chaque lettre)
function programmerRecherche() {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(rechercher, 400);
}
champTitre.addEventListener("input", programmerRecherche);

// --- 9. Démarrage --------------------------------------------
// Les sections "Terminés" et "Supprimés" sont fermées à chaque ouverture
// de l'app (c'est le comportement par défaut de <details>).
localStorage.removeItem("mes-listes-section-ouverte"); // ancien réglage, devenu inutile
document.getElementById("version").textContent = VERSION;
afficher();
completerImdbManquants();
// Revenu en ligne (métro, avion…) : on complète ce qui manque encore
window.addEventListener("online", completerImdbManquants);

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
