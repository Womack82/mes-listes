// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Numéro de version affiché à côté du logo.
// ⚠️ Doit toujours être le même que NOM_CACHE dans service-worker.js
// On reste en v1 : chaque changement, quel qu'il soit, ajoute 1 au second
// numéro (v1.1 → v1.2 → v1.3…). (Avant le 10/11/2026 : v10 à v15.1.)
const VERSION = "v1.15";

// Noms sous lesquels on range les données dans la mémoire du téléphone
const CLE_STOCKAGE = "mes-listes";
const CLE_SUPPRIMES = "mes-listes-supprimes";

// Emoji affiché devant chaque type
const EMOJIS = { film: "🎬", serie: "📺", jeu: "🎮", recette: "🍳", cocktail: "🍸", autre: "📌" };

// Recettes et cocktails sont des FICHES à conserver : pas de case à cocher,
// jamais « terminées ». Films, séries et jeux sont des listes « à faire ».
const FICHES = new Set(["recette", "cocktail"]);
const estFiche = (type) => FICHES.has(type);

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

// Migration (v1.9) : une recette cochée « faite » avant que les recettes
// deviennent des fiches redevient une fiche normale (rien n'est perdu)
function migrerFiches() {
  let change = false;
  for (const el of elements) {
    if (estFiche(el.type) && el.fait) {
      el.fait = false;
      change = true;
    }
  }
  if (change) sauvegarder();
}
migrerFiches();

// La page affichée : "accueil" ou une catégorie ("film", "serie", "jeu", "recette", "cocktail")
let pageActive = "accueil";

// On récupère les morceaux de la page dont on a besoin
// Le calque « Ajouter » : formulaire et champ titre
const formulaire = document.getElementById("formulaire-ajout");
const champTitre = document.getElementById("champ-titre");
// En-tête, pages et barre du bas
const entetePetit = document.getElementById("entete-petit");
const enteteGrand = document.getElementById("entete-grand");
const boutonAccueil = document.getElementById("bouton-accueil");
const pageAccueil = document.getElementById("page-accueil");
const pageCategorie = document.getElementById("page-categorie");
const carres = document.querySelectorAll(".carre");
const listeRecents = document.getElementById("liste-recents");
const recentsVide = document.getElementById("recents-vide");
const liste = document.getElementById("liste");
const messageVide = document.getElementById("message-vide");
const mentionTmdb = document.getElementById("mention-tmdb");
const mentionRawg = document.getElementById("mention-rawg");
const onglets = document.querySelectorAll(".onglet");
// Dans le panneau Réglages
const listeFaits = document.getElementById("liste-faits");
const badgeFaits = document.getElementById("badge-faits");
const faitsVide = document.getElementById("faits-vide");
const listeSupprimes = document.getElementById("liste-supprimes");
const badgeSupprimes = document.getElementById("badge-supprimes");
const supprimesVide = document.getElementById("supprimes-vide");
const listeAutres = document.getElementById("liste-autres");
const badgeAutres = document.getElementById("badge-autres");
const ligneAutres = document.getElementById("ligne-autres");

// Nom du type affiché sous le titre des cartes
const NOMS_SIMPLES = { film: "Film", serie: "Série", jeu: "Jeu", recette: "Recette", cocktail: "Cocktail", autre: "Autre" };

// Icônes des types, dessinées en SVG (24 × 24) pour pouvoir les colorer :
// pellicule, écran, manette, bol avec vapeur, verre à cocktail, punaise
const ICONES_TYPES = {
  film: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v18 M17 3v18 M3 7.5h4 M3 12h18 M3 16.5h4 M17 7.5h4 M17 16.5h4",
  serie: "M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 3l4 4 4-4",
  jeu: "M7 8h10a5 5 0 0 1 5 5v1a3.5 3.5 0 0 1-6.3 2.1L14.5 15h-5l-1.2 1.1A3.5 3.5 0 0 1 2 14v-1a5 5 0 0 1 5-5z M7.5 10.5v4 M5.5 12.5h4 M16 11.5h.01 M18 13.5h.01",
  recette: "M3 12h18a9 7.5 0 0 1-18 0z M8.5 21h7 M8 8.5c-1-1.2 1-2.3 0-3.5 M12 8.5c-1-1.2 1-2.3 0-3.5 M16 8.5c-1-1.2 1-2.3 0-3.5",
  cocktail: "M4 4h16l-8 9z M7 7.5h10 M12 13v7 M8 20h8 M16 2.5l-2 4",
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

// Les 5 catégories de la navigation (« Autre » n'en fait plus partie :
// ses anciens éléments sont gardés et visibles dans Réglages → Autres)
const NOMS_PLURIELS = { film: "Films", serie: "Séries", jeu: "Jeux", recette: "Recettes", cocktail: "Cocktails" };
// Petit texte d'une page catégorie : « 12 à voir », « 3 à jouer » ;
// pour les fiches (recettes, cocktails) : « 8 fiches »
const VERBES = { film: "à voir", serie: "à voir", jeu: "à jouer" };

// Date d'ajout d'un élément : son identifiant est l'heure de création
// (Date.now()). Renvoie null si l'identifiant n'est pas une date.
function dateAjout(el) {
  const temps = Number(el.id);
  return Number.isFinite(temps) && temps > 1e12 ? new Date(temps) : null;
}

// « Ajouté aujourd'hui », « Ajouté hier », « Ajouté il y a 5 jours »
function texteAjout(el) {
  const date = dateAjout(el);
  if (!date) return "";
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jours = Math.round((minuit(new Date()) - minuit(date)) / 86400000);
  if (jours <= 0) return "Ajouté aujourd'hui";
  if (jours === 1) return "Ajouté hier";
  return `Ajouté il y a ${jours} jours`;
}

// --- 3. Afficher les pages et les listes ----------------------
// Accueil : 5 carrés (nombre à faire ; nombre de fiches pour Recettes et
// Cocktails) + 4 derniers ajoutés.
// Page catégorie : les éléments à faire (ou toutes les fiches) de cette catégorie.
// Panneau Réglages : terminés, supprimés, anciens « Autre ».
// animer = true : les cartes apparaissent en fondu, l'une après l'autre
// (seulement en arrivant sur une page, pas après chaque coche).
function afficher(animer = false) {
  const aFaire = elements.filter((el) => !el.fait);
  const faits = elements.filter((el) => el.fait);
  const autres = aFaire.filter((el) => el.type === "autre");
  const supprimesRecents = [...supprimes].reverse(); // le plus récent en haut

  // Carrés de l'accueil
  // (une fiche n'est jamais « faite » : aFaire contient toutes les fiches)
  for (const carre of carres) {
    carre.querySelector(".carre-nombre").textContent =
      aFaire.filter((el) => el.type === carre.dataset.type).length;
  }

  // Derniers ajoutés (les 5 catégories), du plus récent au plus ancien.
  // Les anciens « Autre » n'y sont pas : ils restent dans Réglages.
  const recents = aFaire.filter((el) => el.type !== "autre")
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, 4);
  listeRecents.replaceChildren(...recents.map((el) => creerCarte(el, true)));
  recentsVide.hidden = recents.length > 0;

  // Page catégorie
  liste.innerHTML = "";
  if (pageActive !== "accueil") {
    const toutes = elements.filter((el) => el.type === pageActive);
    const visibles = aFaire.filter((el) => el.type === pageActive);
    for (const el of visibles) liste.append(creerCarte(el));
    messageVide.textContent = toutes.length === 0
      ? "Rien ici pour l'instant. Appuie sur + pour ajouter."
      : "Tout est fait ! 🎉";
    messageVide.hidden = visibles.length > 0;
    entetePetit.textContent = estFiche(pageActive)
      ? pluriel(visibles.length, "fiche")
      : `${visibles.length} ${VERBES[pageActive]}`;
  }

  // Panneau Réglages
  listeFaits.replaceChildren(...faits.map((el) => creerCarte(el)));
  listeSupprimes.replaceChildren(...supprimesRecents.map(creerLigneSupprimee));
  listeAutres.replaceChildren(...autres.map((el) => creerCarte(el)));
  badgeFaits.textContent = faits.length;
  badgeSupprimes.textContent = supprimes.length;
  badgeAutres.textContent = autres.length;
  ligneAutres.hidden = autres.length === 0;
  faitsVide.hidden = faits.length > 0;
  supprimesVide.hidden = supprimes.length > 0;

  if (animer && !sansAnimation.matches) {
    const blocs = pageActive === "accueil"
      ? [...carres, ...listeRecents.children]
      : [...liste.children];
    blocs.forEach((bloc, rang) => {
      bloc.style.setProperty("--rang", Math.min(rang, 8));
      bloc.classList.remove("apparition");
      void bloc.offsetWidth; // relance l'animation si le bloc l'avait déjà
      bloc.classList.add("apparition");
    });
  }
}

// Change de page : "accueil" ou une catégorie ("film", "serie"…)
function allerA(page) {
  pageActive = page;
  const accueil = page === "accueil";
  pageAccueil.hidden = !accueil;
  pageCategorie.hidden = accueil;
  enteteSalut();
  // Catégorie surlignée dans la barre (le bouton Accueil garde toujours
  // le même style ; aria-current indique la page aux lecteurs d'écran)
  boutonAccueil.toggleAttribute("aria-current", accueil);
  for (const onglet of onglets) {
    const actif = onglet.dataset.type === page;
    onglet.classList.toggle("actif", actif);
    onglet.toggleAttribute("aria-current", actif);
  }
  // Mentions TMDB (films, séries) ou RAWG (jeux) en bas de la page
  mentionTmdb.hidden = page !== "film" && page !== "serie";
  mentionRawg.hidden = page !== "jeu";
  window.scrollTo(0, 0);
  afficher(true);
}

// En-tête de l'accueil : « Bonjour » (petit) et « Womack » (grand).
// Page catégorie : le nom de la catégorie en grand ; le petit texte
// (« 12 à voir », « 8 fiches ») est écrit par afficher().
function enteteSalut() {
  if (pageActive === "accueil") {
    entetePetit.textContent = "Bonjour";
    enteteGrand.textContent = "Womack";
  } else {
    enteteGrand.textContent = NOMS_PLURIELS[pageActive];
  }
}

// Fabrique la carte <li> d'un élément :
// vignette + titre + type/année (+ date d'ajout sur l'accueil) ; un appui
// ouvre le panneau d'actions. À droite, une case ronde pour cocher
// (sauf pour les fiches : recettes et cocktails).
function creerCarte(el, avecDate = false) {
  const fiche = estFiche(el.type);
  const li = document.createElement("li");
  li.className = fiche ? "carte fiche" : "carte";
  li.dataset.id = el.id; // pour retrouver la carte et la faire glisser (animations)
  if (el.fait) li.classList.add("fait");

  // Toute la partie gauche est un bouton : il ouvre le panneau d'actions
  // (ou, pour une recette ou un cocktail, la page de la fiche)
  const corps = document.createElement("button");
  corps.type = "button";
  corps.className = "carte-corps";
  corps.addEventListener("click", () => (fiche ? ouvrirFiche(el.id) : ouvrirActions(el.id)));

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

  // « Ajouté hier » (en bleu), sur l'accueil seulement
  const quand = avecDate ? texteAjout(el) : "";
  if (quand) {
    const date = document.createElement("span");
    date.className = "carte-date";
    date.textContent = quand;
    textes.append(date);
  }
  // Vignette : l'affiche (films, séries), ou la première photo d'une fiche
  // (la photo gardée avec l'IA en priorité)
  const photoFiche = fiche ? el.photoPerso || (el.images ? el.images[0] : null) : null;
  corps.append(creerVignette(el.affiche || photoFiche, el.type), textes);

  // Case ronde : une vraie case à cocher, cachée, et un rond dessiné à côté.
  // Le <label> autour fait 44 px pour que le doigt ne la rate pas.
  const zone = document.createElement("label");
  zone.className = "case-ronde";
  const caseACocher = document.createElement("input");
  caseACocher.type = "checkbox";
  caseACocher.checked = el.fait;
  caseACocher.setAttribute("aria-label", el.fait ? `Remettre à faire : ${el.titre}` : `Marquer comme terminé : ${el.titre}`);
  caseACocher.addEventListener("change", () => basculer(el.id, li));
  const rond = document.createElement("span");
  rond.className = "rond";
  rond.append(creerIcone("M6 12.5l4 4 8-9", "coche"));
  zone.append(caseACocher, rond);

  li.append(corps);
  // Fiche avec un lien : petite icône qui ouvre l'adresse dans un nouvel
  // onglet (noopener : la page ouverte ne peut pas agir sur l'app)
  if (fiche && el.lien) {
    const lien = document.createElement("a");
    lien.className = "carte-lien";
    lien.href = el.lien;
    lien.target = "_blank";
    lien.rel = "noopener";
    lien.setAttribute("aria-label", `Ouvrir le lien : ${el.titre}`);
    lien.append(creerIcone("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"));
    li.append(lien);
  }
  // Pas de case à cocher pour une fiche
  if (!fiche) li.append(zone);
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

// --- Liens et notes des recettes ---
// Note : 1 000 caractères au plus
const LONGUEUR_MAX_NOTE = 1000;

// Renvoie l'adresse propre si le texte est un lien http ou https, sinon null.
// (On refuse tout le reste, par exemple « javascript: », qui pourrait lancer du code.)
function lienValide(texte) {
  if (typeof texte !== "string") return null;
  try {
    const adresse = new URL(texte.trim());
    if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
    return adresse.href;
  } catch {
    return null; // ce n'est pas une adresse
  }
}

// Le nom de domaine d'un lien, sans « www. » : « instagram.com »
function domaine(lien) {
  return new URL(lien).hostname.replace(/^www\./, "");
}

// --- 4. Les actions ------------------------------------------
// infos (facultatif) :
// - TMDB (films, séries) : { annee, affiche, idTmdb } (+ idImdb, cherché juste après)
// - RAWG (jeux)          : { annee, idRawg } (pas de jaquette, volontairement)
// - recette, cocktail    : { lien, note } (tous les deux facultatifs)
//                          + les champs trouvés par « Importer » (CHAMPS_FICHE :
//                          photos, ingrédients, étapes, portions, temps…)
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
    if (infos.lien) el.lien = infos.lien;
    if (infos.note) el.note = infos.note;
    if (estFiche(type)) {
      for (const cle of CHAMPS_FICHE) {
        const valeur = infos[cle];
        if (valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0)) continue;
        el[cle] = valeur;
      }
    }
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

// « Réduire les animations » activé sur le téléphone ?
const sansAnimation = window.matchMedia("(prefers-reduced-motion: reduce)");

// Cocher / décocher. La coche est enregistrée tout de suite ; seul
// l'affichage attend la fin de l'animation :
// 1. la case se remplit (150 ms, en CSS)
// 2. la carte disparaît en fondu (220 ms, classe "sortie")
// 3. la liste est redessinée et les autres cartes remontent en glissant
function basculer(id, carte = null) {
  const el = elements.find((e) => e.id === id);
  el.fait = !el.fait; // true devient false et inversement
  sauvegarder();

  if (!carte || sansAnimation.matches) {
    afficher();
    return;
  }
  setTimeout(() => {
    carte.classList.add("sortie");
    setTimeout(afficherEnDouceur, 220);
  }, 150);
}

// Redessine les listes, puis fait glisser chaque carte restante de son
// ancienne place vers la nouvelle (au lieu de sauter d'un coup).
// On mesure les positions avant et après, et on anime seulement "transform".
function afficherEnDouceur() {
  const cle = (carte) => `${carte.parentElement.id}/${carte.dataset.id}`;
  const avant = new Map();
  for (const carte of document.querySelectorAll(".carte[data-id]")) {
    avant.set(cle(carte), carte.getBoundingClientRect().top);
  }
  afficher();
  for (const carte of document.querySelectorAll(".carte[data-id]")) {
    const ancienHaut = avant.get(cle(carte));
    if (ancienHaut === undefined) continue; // carte nouvelle dans cette liste
    const ecart = ancienHaut - carte.getBoundingClientRect().top;
    if (Math.abs(ecart) < 1) continue; // n'a pas bougé
    carte.animate(
      [{ transform: `translateY(${ecart}px)` }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  }
}

// recette (facultatif) : { lien, note, + contenu de la fiche } quand on
// modifie une recette ou un cocktail ; une valeur vide efface le champ.
// Un champ absent de « recette » (ex. : la cuisson pour un cocktail) reste
// tel quel. Sans « recette », tout reste tel quel (gardé même si le type change).
function modifier(id, titre, type, recette = null) {
  const el = elements.find((e) => e.id === id);
  // Si le type change, les infos TMDB / RAWG ne correspondent plus
  // (un identifiant TMDB de film ne désigne pas la même chose côté séries)
  if (type !== el.type) retirerInfosExternes(el);
  el.titre = titre;
  el.type = type;
  // Devenu recette ou cocktail : une fiche n'est jamais « terminée »
  if (estFiche(type)) el.fait = false;
  if (recette) {
    if (recette.lien) el.lien = recette.lien; else delete el.lien;
    if (recette.note) el.note = recette.note; else delete el.note;
    for (const cle of CHAMPS_FICHE) {
      if (!Object.hasOwn(recette, cle)) continue; // champ non modifié
      const valeur = recette[cle];
      const vide = valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0);
      if (vide) delete el[cle]; else el[cle] = valeur;
    }
  }
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
// Recettes : note et lien dans le panneau, champs lien et note dans Modifier
const actionsNote = document.getElementById("actions-note");
const actionsLien = document.getElementById("actions-lien");
const editionRecette = document.getElementById("edition-recette");
const editionLien = document.getElementById("edition-lien");
const editionNote = document.getElementById("edition-note");
const editionErreur = document.getElementById("edition-erreur");
// Contenu des fiches : portions, temps, champs cocktail, ingrédients, étapes
const editionPortions = document.getElementById("edition-portions");
const editionPreparation = document.getElementById("edition-preparation");
const editionCuisson = document.getElementById("edition-cuisson");
const editionChampCuisson = document.getElementById("edition-champ-cuisson");
const editionChampsCocktail = document.getElementById("edition-champs-cocktail");
const editionVerre = document.getElementById("edition-verre");
const editionMethode = document.getElementById("edition-methode");
const editionAlcool = document.getElementById("edition-alcool");
const editionIngredients = document.getElementById("edition-ingredients");
const editionEtapes = document.getElementById("edition-etapes");
// true quand « Modifier » a été ouvert depuis la page d'une fiche :
// « Annuler » referme alors le panneau au lieu de montrer ses boutons
let editionDepuisFiche = false;

// L'élément concerné par le panneau (null = panneau fermé)
let idActions = null;
let minuteurConfirmation = null;

// Le menu des types du panneau : « 🎬 Film », « 📺 Série »…
// « Autre » n'est proposé que pour un élément qui est déjà « Autre »
// (catégorie retirée : on ne peut plus en créer, mais on peut la garder).
function remplirTypes(typeActuel) {
  editionType.replaceChildren();
  for (const type of Object.keys(NOMS_SIMPLES)) {
    if (type === "autre" && typeActuel !== "autre") continue;
    editionType.append(new Option(`${EMOJIS[type]} ${NOMS_SIMPLES[type]}`, type));
  }
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
  // Recette ou cocktail : sa note sous le titre et « Ouvrir le lien ↗ » s'ils existent
  const recette = estFiche(el.type);
  actionsNote.textContent = recette && el.note ? el.note : "";
  actionsNote.hidden = !(recette && el.note);
  actionsLien.hidden = !(recette && el.lien);
  if (recette && el.lien) actionsLien.href = el.lien;
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

// Champs des fiches : visibles seulement quand le type choisi est Recette
// ou Cocktail ; la cuisson pour une recette, verre / méthode / alcool de
// base pour un cocktail
function majEditionRecette() {
  const type = editionType.value;
  editionRecette.hidden = !estFiche(type);
  editionChampCuisson.hidden = type !== "recette";
  editionChampsCocktail.hidden = type !== "cocktail";
}
editionType.addEventListener("change", majEditionRecette);

// Ouvre la modification d'un élément dans le panneau du bas : titre, type
// (et, pour une recette ou un cocktail, le lien, la note et le contenu)
function ouvrirEdition(id) {
  const el = elements.find((e) => e.id === id);
  if (!el) return;
  idActions = id;
  annulerConfirmation();
  editionTitre.value = el.titre;
  remplirTypes(el.type);
  editionType.value = el.type;
  // Lien, note et contenu gardés même pour un autre type : on les retrouve
  // en repassant en Recette
  editionLien.value = el.lien || "";
  editionNote.value = el.note || "";
  editionPortions.value = el.portions || "";
  editionPreparation.value = el.tempsPreparation || "";
  editionCuisson.value = el.tempsCuisson || "";
  editionVerre.value = el.verre || "";
  editionMethode.value = el.methode || "";
  editionAlcool.value = el.alcoolBase || "";
  editionIngredients.value = (el.ingredients || []).join("\n");
  editionEtapes.value = (el.etapes || []).join("\n");
  editionErreur.hidden = true;
  majEditionRecette();
  actionsTitre.textContent = el.titre;
  actionsNote.hidden = true;
  actionsBoutons.hidden = true;
  actionsEdition.hidden = false;
  if (!panneauActions.open) panneauActions.showModal();
  panneauActions.scrollTop = 0;
  editionTitre.focus();
}

actionsModifier.addEventListener("click", () => {
  editionDepuisFiche = false;
  ouvrirEdition(idActions);
});

// Un champ nombre : vide → undefined ; entier entre min et max → le nombre ;
// sinon NaN (erreur à afficher)
function lireEntier(champ, max) {
  const texte = champ.value.trim();
  if (texte === "") return undefined;
  const nombre = Number(texte);
  return Number.isInteger(nombre) && nombre >= 1 && nombre <= max ? nombre : NaN;
}

// Une zone de texte → une liste de lignes non vides (avec limites)
function lireLignes(champ, max, longueur) {
  return champ.value.split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== "")
    .slice(0, max)
    .map((ligne) => ligne.slice(0, longueur));
}

// Une zone de texte d'étapes → la liste des étapes. Une étape tapée
// « 1. Mélanger » devient « Mélanger » (la liste est déjà numérotée) ;
// « #Titre » devient « # Titre » (titre de partie)
function lireChampEtapes(champ) {
  return lireLignes(champ, LIMITES_FICHE.etapes, LIMITES_FICHE.longueurEtape)
    .map((e) => (e.startsWith("#") ? `# ${e.replace(/^#+\s*/, "")}` : e.replace(/^\d{1,2}\s*[.)]\s+/, "")))
    .filter((e) => e !== "# " && e !== "");
}

actionsEdition.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const nouveauTitre = editionTitre.value.trim();
  if (nouveauTitre === "" || idActions === null) return;
  const type = editionType.value;
  let recette = null;
  if (estFiche(type)) {
    const texteLien = editionLien.value.trim();
    const lien = lienValide(texteLien);
    if (texteLien !== "" && !lien) {
      afficherMessage("Ce lien n'est pas valide : il doit commencer par http:// ou https://.", false, editionErreur);
      return;
    }
    const portions = lireEntier(editionPortions, LIMITES_FICHE.portionsMax);
    const preparation = lireEntier(editionPreparation, LIMITES_FICHE.minutesMax);
    const cuisson = lireEntier(editionCuisson, LIMITES_FICHE.minutesMax);
    if (Number.isNaN(portions)) {
      afficherMessage(`Portions : un nombre entier entre 1 et ${LIMITES_FICHE.portionsMax}.`, false, editionErreur);
      return;
    }
    if (Number.isNaN(preparation) || (type === "recette" && Number.isNaN(cuisson))) {
      afficherMessage("Temps : un nombre entier de minutes (ou rien).", false, editionErreur);
      return;
    }
    const ingredients = lireLignes(editionIngredients, LIMITES_FICHE.ingredients, LIMITES_FICHE.longueurIngredient);
    const ancien = elements.find((e) => e.id === idActions) || {};
    recette = {
      lien,
      note: editionNote.value.trim().slice(0, LONGUEUR_MAX_NOTE),
      portions,
      tempsPreparation: preparation,
      ingredients,
      // Fiche créée avec l'IA : les lignes inchangées gardent leur détail
      ingredientsDetail: detailPourLignes(ingredients, ancien.ingredients, ancien.ingredientsDetail),
      etapes: lireChampEtapes(editionEtapes),
    };
    // Seuls les champs visibles sont modifiés : la cuisson d'une recette
    // passée en cocktail (ou l'inverse) est gardée
    if (type === "recette") recette.tempsCuisson = cuisson;
    if (type === "cocktail") {
      recette.verre = editionVerre.value.trim().slice(0, LIMITES_FICHE.champCourt);
      recette.methode = editionMethode.value.trim().slice(0, LIMITES_FICHE.champCourt);
      recette.alcoolBase = editionAlcool.value.trim().slice(0, LIMITES_FICHE.champCourt);
    }
  }
  modifier(idActions, nouveauTitre, type, recette);
  fermerActions();
  // Page de la fiche ouverte derrière : on la redessine (ou on la ferme si
  // l'élément n'est plus une recette ni un cocktail)
  if (pageFiche.open) {
    personnesFiche = null; // repart des portions (peut-être modifiées)
    afficherFiche();
  }
});

document.getElementById("edition-annuler").addEventListener("click", () => {
  if (editionDepuisFiche) {
    fermerActions();
    return;
  }
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
  autres: { titre: "Anciens « Autre »", bloc: document.getElementById("vue-autres") },
  sauvegarde: { titre: "Sauvegarde", bloc: document.getElementById("vue-sauvegarde") },
  cles: { titre: "Clés API", bloc: document.getElementById("vue-cles") },
  relais: { titre: "Import de recettes", bloc: document.getElementById("vue-relais") },
  gemini: { titre: "IA (Gemini)", bloc: document.getElementById("vue-gemini") },
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

// --- 4 quater bis. Navigation : accueil, catégories ----------
boutonAccueil.addEventListener("click", () => allerA("accueil"));
for (const carre of carres) {
  carre.querySelector(".carre-pastille").append(creerIcone(ICONES_TYPES[carre.dataset.type]));
  carre.addEventListener("click", () => allerA(carre.dataset.type));
}
for (const onglet of onglets) {
  onglet.querySelector(".onglet-icone").append(creerIcone(ICONES_TYPES[onglet.dataset.type]));
  onglet.addEventListener("click", () => allerA(onglet.dataset.type));
}

// --- 4 quater. Ajouter un élément : menu des catégories, puis calque de saisie ---
const feuilleAjout = document.getElementById("feuille-ajout");
const ajoutIcone = document.getElementById("ajout-icone");
const ajoutTitre = document.getElementById("ajout-titre");
const ajoutDirect = document.getElementById("ajout-direct");
const zoneResultats = document.getElementById("zone-resultats");
const ajoutTelQuel = document.getElementById("ajout-tel-quel");
const mentionSource = document.getElementById("mention-source");
// Recette : lien, bouton « Coller le lien », note
const zoneRecette = document.getElementById("zone-recette");
const champLien = document.getElementById("champ-lien");
const champNote = document.getElementById("champ-note");
const messageColler = document.getElementById("message-coller");
// Recette, cocktail : « Importer depuis le lien »
const boutonImporterLien = document.getElementById("bouton-importer-lien");
const messageImport = document.getElementById("message-import");
// Recette, cocktail : « Photos et texte (IA) »
const boutonOuvrirIa = document.getElementById("bouton-ouvrir-ia");

// Catégorie choisie dans le menu (film, serie, jeu, recette)
let categorieAjout = "film";
// true quand la recherche de jeux (RAWG) a échoué ou que la clé manque :
// le calque passe en saisie manuelle jusqu'à sa fermeture
let rechercheJeuxIndisponible = false;
function categorieChoisie() {
  return categorieAjout;
}

// Titre du calque et texte indicatif du champ, selon la catégorie
const TITRES_AJOUT = {
  film: "Ajouter un film",
  serie: "Ajouter une série",
  jeu: "Ajouter un jeu",
  recette: "Ajouter une recette",
  cocktail: "Ajouter un cocktail",
};
const INDICATIONS = {
  film: "Nom du film",
  serie: "Nom de la série",
  jeu: "Nom du jeu",
  recette: "Nom de la recette",
  cocktail: "Nom du cocktail",
};

// Mention de la source des données, en bas de la liste de résultats
const MENTIONS = {
  film: "Données films et séries fournies par TMDB",
  serie: "Données films et séries fournies par TMDB",
  jeu: "Données jeux vidéo fournies par RAWG",
};

// Dernière ligne de la liste : « Ajouter « titre » tel quel », qui suit ce
// qui est tapé (cachée tant que le champ est vide)
function majTelQuel() {
  const titre = champTitre.value.trim();
  ajoutTelQuel.textContent = `Ajouter « ${titre} » tel quel`;
  // Saisie manuelle des jeux : le bouton orange « Ajouter » la remplace
  ajoutTelQuel.hidden = titre === "" || rechercheJeuxIndisponible;
}

// Quand le clavier de l'iPhone s'ouvre, la page ne rétrécit pas : il
// recouvre le bas de l'écran. On mesure la partie vraiment visible
// (visualViewport) pour caler le calque juste au-dessus du clavier et
// limiter sa hauteur à cette partie visible (voir .feuille dans style.css).
function ajusterAuClavier() {
  const vue = window.visualViewport;
  if (!vue) return; // vieux navigateur : on laisse faire
  const clavier = Math.max(0, window.innerHeight - vue.height - vue.offsetTop);
  feuilleAjout.style.setProperty("--clavier", `${clavier}px`);
  feuilleAjout.style.setProperty("--visible", `${vue.height}px`);
  // Même mesure pour les panneaux (Modifier une fiche, Réglages) : ils
  // restent au-dessus du clavier et jamais plus hauts que la partie visible
  const racine = document.documentElement.style;
  racine.setProperty("--clavier-ecran", `${clavier}px`);
  racine.setProperty("--visible-ecran", `${vue.height}px`);
  // Un site ne peut pas demander si le clavier est ouvert : on le devine
  // quand plus de 100 px du bas de l'écran sont cachés
  feuilleAjout.classList.toggle("clavier-ouvert", clavier > 100);
}

// Empêche la page derrière le menu et le calque de défiler :
// classe « verrou » sur <html> tant que l'un des deux est ouvert
function verrouillerPage() {
  document.documentElement.classList.add("verrou");
}
function deverrouillerPage() {
  if (!menuCategories.open && !feuilleAjout.open && !pageFiche.open && !pageIa.open) {
    document.documentElement.classList.remove("verrou");
  }
}
// Sur iPhone, glisser le doigt sur une partie fixe (voile, en-tête, champ)
// fait quand même bouger l'écran : on l'interdit partout, sauf dans la
// liste de résultats (qui doit défiler) et les champs (pour placer le curseur)
function bloquerGlissement(panneau) {
  panneau.addEventListener("touchmove", (evenement) => {
    const cible = evenement.target;
    if (!zoneResultats.contains(cible) && !cible.matches("input, textarea")) evenement.preventDefault();
  }, { passive: false });
}

// Ouvre le calque de saisie pour une catégorie
function ouvrirAjout(type) {
  categorieAjout = type;
  const avecRecherche = sourcePourType(type) !== null; // film, série, jeu
  ajoutIcone.replaceChildren(creerIcone(ICONES_TYPES[type]));
  ajoutTitre.textContent = TITRES_AJOUT[type];
  champTitre.placeholder = INDICATIONS[type];
  champTitre.value = "";
  // Film, Série, Jeu : liste de résultats ; Recette : bouton « Ajouter »
  zoneResultats.hidden = !avecRecherche;
  ajoutDirect.hidden = avecRecherche;
  // Avec recherche, le calque prend toute la hauteur visible (la liste
  // remplit la place) ; sans, il est juste assez haut pour le champ
  feuilleAjout.classList.toggle("avec-recherche", avecRecherche);
  // Touche du clavier : « Rechercher » ou « OK » (lue par l'iPhone au focus)
  champTitre.enterKeyHint = avecRecherche ? "search" : "done";
  mentionSource.textContent = MENTIONS[type] || "";
  rechercheJeuxIndisponible = false; // chaque ouverture retente RAWG
  // Recette, cocktail : lien et note vides. Rien n'est lu dans le presse-papiers
  // à l'ouverture : seulement quand on touche « Coller le lien ».
  zoneRecette.hidden = !estFiche(type);
  champLien.value = "";
  champNote.value = "";
  messageColler.hidden = true;
  texteCopie = "";
  mettreEnAvant(null);
  reinitialiserImport();
  masquerRecherche();
  // Jeu sans clé RAWG : saisie manuelle tout de suite
  if (type === "jeu" && lireCleRawg() === "") passerJeuxEnManuel(true);
  ajusterAuClavier();
  verrouillerPage();
  feuilleAjout.showModal();
  // Focus dans le champ tout de suite (pendant l'appui) : c'est la condition
  // pour que l'iPhone accepte d'ouvrir le clavier
  champTitre.focus();
}

function fermerAjout() {
  masquerRecherche();
  reinitialiserImport();
  feuilleAjout.close();
}

// --- Menu des catégories (bouton +) ---
// Le bouton + ouvre le menu ; un appui sur une catégorie ferme le menu et
// ouvre le calque de saisie tout de suite (pendant l'appui : sinon l'iPhone
// refuse d'ouvrir le clavier).
const menuCategories = document.getElementById("menu-categories");
function ouvrirMenu() {
  verrouillerPage();
  menuCategories.showModal();
}
const fermerMenu = () => menuCategories.close();
menuCategories.addEventListener("close", deverrouillerPage);
bloquerGlissement(menuCategories);
for (const choix of menuCategories.querySelectorAll(".choix-menu")) {
  choix.querySelector(".rond-menu").append(creerIcone(ICONES_TYPES[choix.dataset.type]));
  choix.addEventListener("click", () => {
    fermerMenu();
    ouvrirAjout(choix.dataset.type);
  });
}
document.getElementById("menu-fermer").addEventListener("click", fermerMenu);
// Appui sur le voile : la colonne laisse passer les appuis entre les
// boutons (pointer-events), ils arrivent donc sur le <dialog> lui-même
fermerSurVoile(menuCategories, fermerMenu);

// Bouton + : sur l'accueil, menu des catégories ; sur une page catégorie,
// saisie directe dans cette catégorie (pendant l'appui : le clavier s'ouvre)
document.getElementById("bouton-ajouter").addEventListener("click", () => {
  if (pageActive === "accueil") ouvrirMenu();
  else ouvrirAjout(pageActive);
});
// Flèche de retour : on referme le calque et on revient au menu
document.getElementById("ajout-retour").addEventListener("click", () => {
  fermerAjout();
  ouvrirMenu();
});
document.getElementById("ajout-fermer").addEventListener("click", fermerAjout);
fermerSurVoile(feuilleAjout, fermerAjout);
feuilleAjout.addEventListener("close", () => {
  masquerRecherche(); // aussi après Échap au clavier
  deverrouillerPage();
});
bloquerGlissement(feuilleAjout);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", ajusterAuClavier);
  window.visualViewport.addEventListener("scroll", ajusterAuClavier);
}
ajusterAuClavier(); // premières mesures (panneaux)

// Saisie manuelle (« Ajouter » ou « Ajouter « titre » tel quel ») :
// le titre tel qu'il est écrit, sans infos TMDB / RAWG
function ajouterTelQuel() {
  const type = categorieChoisie();
  const titre = champTitre.value.trim();
  let infos = null;
  // Recette, cocktail : lien (vérifié) et note, tous les deux facultatifs
  if (estFiche(type)) {
    const texteLien = champLien.value.trim();
    const lien = lienValide(texteLien);
    if (texteLien !== "" && !lien) {
      montrerMessageColler("Ce lien n'est pas valide : il doit commencer par http:// ou https://.");
      champLien.focus();
      return;
    }
    // Titre vide mais lien présent : on propose le nom du site comme titre
    if (titre === "" && lien) {
      proposerTitre(lien);
      return;
    }
    infos = { lien, note: champNote.value.trim().slice(0, LONGUEUR_MAX_NOTE) };
    // Recette importée depuis ce même lien : on garde tout ce qui a été trouvé
    // (photos, ingrédients, étapes, portions, temps)
    if (recetteImportee && recetteImportee.lien === lien) {
      for (const cle of CHAMPS_FICHE) infos[cle] = recetteImportee[cle];
    }
  }
  if (titre === "") {
    champTitre.focus(); // rien d'écrit : on remet simplement le curseur
    return;
  }
  ajouter(titre, type, infos);
  fermerAjout();
}

// --- Recette : coller un lien ---
function montrerMessageColler(texte) {
  messageColler.textContent = texte;
  messageColler.hidden = false;
}

// Titre vide : on y met le nom du site (« instagram.com »), déjà
// sélectionné pour qu'il suffise de taper par-dessus
function proposerTitre(lien) {
  if (champTitre.value.trim() !== "") return;
  champTitre.value = domaine(lien);
  champTitre.focus();
  champTitre.select();
}

// Texte long trouvé par « Coller le lien copié » (légende, texte copié) :
// transmis au champ texte de « Photos et texte (IA) » si on touche ce bouton
let texteCopie = "";
// Au-delà de 40 caractères (hors simple lien), c'est un texte à analyser
const LONGUEUR_TEXTE_LONG = 40;

// Met un bouton en avant (orange) pour montrer l'étape suivante conseillée
function mettreEnAvant(bouton) {
  for (const b of [boutonImporterLien, boutonOuvrirIa]) b.classList.toggle("mise-en-avant", b === bouton);
}

// « Coller le lien copié » : lit le presse-papiers (seulement sur ce geste ;
// l'iPhone affiche alors sa bulle « Coller » à toucher pour autoriser).
// Pensé pour le Raccourci iPhone qui copie le lien partagé.
// - un lien : il remplit le champ Lien, « Importer » est mis en avant
//   (l'import ne part que quand on le touche) ;
// - un texte long : proposé pour « Photos et texte (IA) » ;
// - le premier lien http(s) d'un texte remplit aussi le champ Lien.
document.getElementById("bouton-coller").addEventListener("click", async () => {
  messageColler.hidden = true;
  texteCopie = "";
  mettreEnAvant(null);
  let texte;
  try {
    texte = await navigator.clipboard.readText();
  } catch {
    // Refusé, ou navigateur qui ne permet pas de lire le presse-papiers
    montrerMessageColler("Impossible de lire le presse-papiers, collez le lien à la main.");
    return;
  }
  texte = (texte || "").trim();
  const trouve = texte.match(/https?:\/\/\S+/i);
  const lien = trouve ? lienValide(trouve[0]) : null;
  const texteLong = texte.length > LONGUEUR_TEXTE_LONG && !(lien && texte === trouve[0]);
  if (lien) {
    champLien.value = lien;
    // Le lien a changé : ce qui avait été importé ne correspond plus
    if (recetteImportee && recetteImportee.lien !== lien) {
      recetteImportee = null;
      messageImport.hidden = true;
    }
  }
  if (texteLong) {
    texteCopie = texte.slice(0, LIMITES_IA.texte);
    mettreEnAvant(boutonOuvrirIa);
    montrerMessageColler(`${lien ? "Lien collé. " : ""}Le presse-papiers contient un texte (${texte.length} caractères) : ` +
      "touchez « Photos et texte (IA) » pour que l'IA s'en serve.");
  } else if (lien) {
    mettreEnAvant(boutonImporterLien);
    montrerMessageColler("Lien collé. Touchez « Importer depuis le lien » pour remplir la fiche.");
  } else {
    montrerMessageColler("Le presse-papiers ne contient pas de lien (http ou https). Collez le lien à la main.");
    return;
  }
  if (lien) proposerTitre(lien);
});

// Lien collé ou tapé à la main : même proposition de titre.
// (Collé : tout de suite ; tapé : quand on quitte le champ, pour ne pas
// proposer un titre à partir d'une adresse à moitié écrite.)
champLien.addEventListener("input", (evenement) => {
  messageColler.hidden = true;
  // Le lien a changé : ce qui avait été importé ne correspond plus
  if (recetteImportee && lienValide(champLien.value) !== recetteImportee.lien) {
    recetteImportee = null;
    messageImport.hidden = true;
  }
  if (evenement.inputType === "insertFromPaste") {
    const lien = lienValide(champLien.value);
    if (lien) proposerTitre(lien);
  }
});
champLien.addEventListener("change", () => {
  const lien = lienValide(champLien.value);
  if (lien) proposerTitre(lien);
});

// --- Recette, cocktail : « Importer depuis le lien » ---
// 1. l'app demande la page au relais (Réglages → Import de recettes) ;
// 2. recettes.js cherche le bloc JSON-LD « Recipe » dans le HTML ;
// 3. le titre est rempli et un résumé s'affiche ; rien n'est enregistré
//    tant qu'on n'a pas touché « Ajouter ».
// En cas d'échec (pas de relais, hors ligne, site qui refuse, pas de
// recette), un message simple : on peut toujours ajouter à la main.
const CLE_RELAIS = "mes-listes-relais";
const DELAI_IMPORT = 12000; // 12 s : le relais abandonne lui-même au bout de 8 s
const TEXTE_BOUTON_IMPORT = "Importer depuis le lien";
const MESSAGE_PAS_DE_RECETTE = "Je n'ai pas trouvé de recette sur cette page. Vous pouvez l'ajouter à la main.";

// Ce qu'« Importer » a trouvé, en attendant « Ajouter » : { lien, titre, images, … }
let recetteImportee = null;
// Numéro du dernier import : une réponse qui arrive après la fermeture du
// calque (ou après un nouvel import) est ignorée
let numeroImport = 0;

function reinitialiserImport() {
  numeroImport++;
  recetteImportee = null;
  messageImport.hidden = true;
  boutonImporterLien.disabled = false;
  boutonImporterLien.textContent = TEXTE_BOUTON_IMPORT;
}

// Import impossible : on montre le message, et « Photos et texte (IA) »
// passe en orange (l'IA peut lire des captures ou la légende copiée)
const SUITE_ECHEC_IMPORT = " Essayez aussi « Photos et texte (IA) » avec des captures ou le texte de la recette.";
function echecImport(texte) {
  afficherMessage(texte + SUITE_ECHEC_IMPORT, false, messageImport);
  mettreEnAvant(boutonOuvrirIa);
}

async function importerDepuisLien() {
  messageImport.hidden = true;
  messageColler.hidden = true;
  mettreEnAvant(null);
  const lien = lienValide(champLien.value);
  if (!lien) {
    afficherMessage("Collez d'abord le lien de la page (il doit commencer par http:// ou https://).", false, messageImport);
    champLien.focus();
    return;
  }
  const relais = lireCle(CLE_RELAIS);
  if (relais === "") {
    echecImport("Import impossible : ajoutez l'adresse du relais dans Réglages → Import de recettes. Vous pouvez ajouter la recette à la main.");
    return;
  }

  const numero = ++numeroImport;
  recetteImportee = null;
  boutonImporterLien.disabled = true;
  boutonImporterLien.textContent = "Import en cours…";

  let recette = null;
  try {
    const adresse = new URL(relais);
    adresse.searchParams.set("url", lien);
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), DELAI_IMPORT);
    try {
      const reponse = await fetch(adresse, { signal: controle.signal, credentials: "omit", cache: "no-store" });
      if (reponse.ok) recette = extraireRecette(await reponse.text(), lien);
    } finally {
      clearTimeout(minuteur);
    }
  } catch {
    recette = null; // relais injoignable, délai dépassé, hors ligne…
  }
  if (numero !== numeroImport) return; // calque fermé ou autre import lancé entre-temps

  boutonImporterLien.disabled = false;
  boutonImporterLien.textContent = TEXTE_BOUTON_IMPORT;
  if (!recette) {
    echecImport(MESSAGE_PAS_DE_RECETTE);
    return;
  }

  recetteImportee = { lien, ...recette };
  // Titre : on remplace un champ vide ou le nom du site proposé automatiquement,
  // jamais un titre tapé à la main
  const titreActuel = champTitre.value.trim();
  if (recette.titre && (titreActuel === "" || titreActuel === domaine(lien))) {
    champTitre.value = recette.titre;
  }
  const nbEtapes = recette.etapes.filter((e) => !e.startsWith("# ")).length;
  const trouve = [
    recette.ingredients.length ? pluriel(recette.ingredients.length, "ingrédient") : "",
    nbEtapes ? pluriel(nbEtapes, "étape") : "",
    recette.images.length ? pluriel(recette.images.length, "photo") : "",
  ].filter(Boolean).join(", ");
  afficherMessage(`✓ Recette trouvée${trouve ? ` : ${trouve}` : ""}. Touchez « Ajouter » pour l'enregistrer.`, true, messageImport);
}
boutonImporterLien.addEventListener("click", importerDepuisLien);

// Touche Entrée dans le titre ou le lien. Le formulaire a maintenant
// plusieurs champs : le navigateur ne l'envoie plus tout seul, on le fait ici.
// (Dans la note, Entrée passe simplement à la ligne.)
for (const champ of [champTitre, champLien]) {
  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key !== "Enter" || evenement.isComposing) return;
    evenement.preventDefault();
    formulaire.requestSubmit();
  });
}
// Touche Entrée du clavier :
// - Film, Série, Jeu : lance la recherche tout de suite et ferme le clavier
//   (pour voir tous les résultats) ;
// - Recette, ou jeu quand la recherche RAWG est indisponible : ajoute l'élément.
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger
  if (sourcePourType(categorieChoisie()) && !rechercheJeuxIndisponible) {
    clearTimeout(minuteurRecherche);
    rechercher();
    champTitre.blur(); // fait descendre le clavier
  } else {
    ajouterTelQuel();
  }
});
ajoutDirect.addEventListener("click", ajouterTelQuel);
ajoutTelQuel.addEventListener("click", ajouterTelQuel);

// --- 5. La page d'une fiche (recette, cocktail) ---------------
// S'ouvre quand on touche la carte : photos, titre, temps, portions,
// source, ingrédients adaptables au nombre de personnes, étapes.
// Aucune case à cocher. Tout le texte passe par textContent : un texte
// importé ne peut jamais injecter de HTML.
const pageFiche = document.getElementById("fiche");
const fichePhotos = document.getElementById("fiche-photos");
const fichePoints = document.getElementById("fiche-points");
const ficheType = document.getElementById("fiche-type");
const ficheTitre = document.getElementById("fiche-titre");
const ficheInfos = document.getElementById("fiche-infos");
const ficheNote = document.getElementById("fiche-note");
const ficheSource = document.getElementById("fiche-source");
const ficheBlocIngredients = document.getElementById("fiche-bloc-ingredients");
const ficheIngredients = document.getElementById("fiche-ingredients");
const ficheBlocEtapes = document.getElementById("fiche-bloc-etapes");
const ficheEtapes = document.getElementById("fiche-etapes");
const ficheVide = document.getElementById("fiche-vide");
const ficheSupprimer = document.getElementById("fiche-supprimer");
const portionsTexte = document.getElementById("portions-texte");
const portionsMoins = document.getElementById("portions-moins");
const portionsPlus = document.getElementById("portions-plus");
const portionsRetablir = document.getElementById("portions-retablir");
const portionsInconnues = document.getElementById("portions-inconnues");

// Fiche affichée (null = fermée) et nombre de personnes choisi
// (null = celui de la recette). Ce choix n'est pas enregistré : la fiche
// repart toujours des portions d'origine.
let idFiche = null;
let personnesFiche = null;
let minuteurSuppressionFiche = null;

// Portions d'origine ; 4 si la recette ne les donne pas
const portionsDeBase = (el) => el.portions || 4;

function ouvrirFiche(id) {
  if (!elements.some((e) => e.id === id)) return;
  idFiche = id;
  personnesFiche = null;
  annulerSuppressionFiche();
  afficherFiche();
  verrouillerPage();
  pageFiche.showModal();
  pageFiche.scrollTop = 0;
  fichePhotos.scrollLeft = 0;
}

function fermerFiche() {
  if (pageFiche.open) pageFiche.close();
}
pageFiche.addEventListener("close", () => {
  idFiche = null;
  annulerSuppressionFiche();
  deverrouillerPage();
});
document.getElementById("fiche-retour").addEventListener("click", fermerFiche);

// Dessine toute la fiche à partir de l'élément enregistré
function afficherFiche() {
  const el = elements.find((e) => e.id === idFiche);
  // Supprimée, ou devenue film / série / jeu : la page n'a plus lieu d'être
  if (!el || !estFiche(el.type)) {
    fermerFiche();
    return;
  }
  ficheType.textContent = NOMS_SIMPLES[el.type];
  ficheTitre.textContent = el.titre;
  afficherPhotos(el);

  // Petites pastilles : temps, portions ; pour un cocktail, le verre, la
  // méthode et l'alcool de base à la place de la cuisson
  const infos = [];
  if (el.tempsPreparation) infos.push(["Préparation", formaterDuree(el.tempsPreparation)]);
  if (el.type === "recette" && el.tempsCuisson) infos.push(["Cuisson", formaterDuree(el.tempsCuisson)]);
  if (el.type === "cocktail") {
    if (el.verre) infos.push(["Verre", el.verre]);
    if (el.methode) infos.push(["Méthode", el.methode]);
    if (el.alcoolBase) infos.push(["Alcool de base", el.alcoolBase]);
  }
  if (el.portions) infos.push(["Portions", pluriel(el.portions, "personne")]);
  ficheInfos.replaceChildren(...infos.map(([nom, valeur]) => {
    const li = document.createElement("li");
    const etiquette = document.createElement("span");
    etiquette.textContent = nom;
    const texte = document.createElement("strong");
    texte.textContent = valeur;
    li.append(etiquette, texte);
    return li;
  }));
  ficheInfos.hidden = infos.length === 0;

  ficheNote.textContent = el.note || "";
  ficheNote.hidden = !el.note;
  ficheSource.hidden = !el.lien;
  if (el.lien) ficheSource.href = el.lien;

  afficherIngredients(el);

  // Étapes : une carte par étape, numérotées ; « # Titre » = titre de partie
  const etapes = el.etapes || [];
  let numero = 0;
  ficheEtapes.replaceChildren(...etapes.map((etape) => {
    const li = document.createElement("li");
    if (etape.startsWith("#")) {
      li.className = "fiche-section";
      li.textContent = etape.replace(/^#+\s*/, "");
      return li;
    }
    numero++;
    li.className = "fiche-etape verre";
    const pastille = document.createElement("span");
    pastille.className = "fiche-numero";
    pastille.textContent = numero;
    pastille.setAttribute("aria-label", `Étape ${numero}`);
    const texte = document.createElement("p");
    texte.textContent = etape;
    li.append(pastille, texte);
    return li;
  }));
  ficheBlocEtapes.hidden = etapes.length === 0;
  ficheVide.hidden = etapes.length > 0 || (el.ingredients || []).length > 0;
}

// Photos : la première en grand ; s'il y en a plusieurs, on fait défiler
// du doigt et les points indiquent laquelle est affichée. Une photo qui ne
// se charge pas (hors ligne, site qui refuse) laisse voir le fond de repli.
function afficherPhotos(el) {
  // La photo gardée avec l'IA (s'il y en a une) passe en premier
  const images = [el.photoPerso, ...(el.images || [])].filter(Boolean);
  fichePhotos.replaceChildren();
  fichePoints.replaceChildren();
  fichePhotos.hidden = images.length === 0;
  fichePoints.hidden = images.length < 2;
  images.forEach((adresse, rang) => {
    const cadre = document.createElement("div");
    cadre.className = "fiche-photo";
    cadre.append(creerIcone(ICONES_TYPES[el.type])); // fond de repli
    const image = document.createElement("img");
    image.src = adresse;
    image.alt = images.length > 1 ? `Photo ${rang + 1} sur ${images.length}` : "";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    if (rang > 0) image.loading = "lazy";
    image.addEventListener("error", () => image.remove());
    cadre.append(image);
    fichePhotos.append(cadre);
    if (images.length > 1) {
      const point = document.createElement("span");
      point.className = "fiche-point";
      fichePoints.append(point);
    }
  });
  majPoints();
}

// Le point de la photo visible devient orange
function majPoints() {
  const rang = Math.round(fichePhotos.scrollLeft / Math.max(1, fichePhotos.clientWidth));
  [...fichePoints.children].forEach((point, i) => point.classList.toggle("actif", i === rang));
}
fichePhotos.addEventListener("scroll", majPoints, { passive: true });

// Ingrédients pour le nombre de personnes choisi. Le texte d'origine n'est
// jamais modifié : on calcule seulement ce qui est affiché. La quantité
// adaptée est en gras ; une ligne sans quantité reste telle quelle.
function afficherIngredients(el) {
  const ingredients = el.ingredients || [];
  ficheBlocIngredients.hidden = ingredients.length === 0;
  const base = portionsDeBase(el);
  const personnes = personnesFiche ?? base;
  const facteur = personnes / base;

  portionsTexte.textContent = `Pour ${pluriel(personnes, "personne")}`;
  portionsMoins.disabled = personnes <= 1;
  portionsPlus.disabled = personnes >= LIMITES_FICHE.portionsMax;
  portionsInconnues.hidden = Boolean(el.portions);
  portionsRetablir.hidden = personnes === base;
  portionsRetablir.textContent = `Rétablir les quantités d'origine (${pluriel(base, "personne")})`;

  // Fiche créée avec l'IA : la quantité détaillée de la ligne (plus fiable),
  // sinon la quantité lue au début de la ligne
  const detail = el.ingredientsDetail || [];
  ficheIngredients.replaceChildren(...ingredients.map((ligne, i) => {
    const li = document.createElement("li");
    const adapte = facteur === 1 ? null
      : (detail[i] && adapterDetail(detail[i], facteur)) || adapterIngredient(ligne, facteur);
    if (adapte && adapte.quantite) {
      const quantite = document.createElement("strong");
      quantite.textContent = adapte.quantite;
      li.append(adapte.avant, quantite, adapte.apres);
    } else {
      li.textContent = ligne;
    }
    return li;
  }));
}

// Boutons − et + (minimum 1 personne), et « Rétablir »
function changerPersonnes(ecart) {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  const actuel = personnesFiche ?? portionsDeBase(el);
  personnesFiche = Math.min(LIMITES_FICHE.portionsMax, Math.max(1, actuel + ecart));
  afficherIngredients(el);
}
portionsMoins.addEventListener("click", () => changerPersonnes(-1));
portionsPlus.addEventListener("click", () => changerPersonnes(1));
portionsRetablir.addEventListener("click", () => {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  personnesFiche = null;
  afficherIngredients(el);
});

// « Modifier » : le panneau de modification monte par-dessus la fiche
document.getElementById("fiche-modifier").addEventListener("click", () => {
  if (idFiche === null) return;
  editionDepuisFiche = true;
  ouvrirEdition(idFiche);
});

// « Supprimer » : comme dans le panneau d'actions, premier appui →
// « Confirmer la suppression ? » pendant 3 secondes ; deuxième appui →
// la fiche part dans « Supprimés » (on n'y garde que le titre)
function annulerSuppressionFiche() {
  clearTimeout(minuteurSuppressionFiche);
  ficheSupprimer.textContent = "Supprimer";
  ficheSupprimer.classList.remove("confirmer");
}
ficheSupprimer.addEventListener("click", () => {
  if (idFiche === null) return;
  if (ficheSupprimer.classList.contains("confirmer")) {
    supprimer(idFiche);
    fermerFiche();
    return;
  }
  ficheSupprimer.textContent = "Confirmer la suppression ?";
  ficheSupprimer.classList.add("confirmer");
  minuteurSuppressionFiche = setTimeout(annulerSuppressionFiche, 3000);
});

// --- 5 bis. Ajouter avec l'IA : photos et texte → Gemini → brouillon ---
// 1. On ajoute des photos (jusqu'à 6, réduites tout de suite) et / ou du texte.
// 2. « Analyser avec l'IA » envoie tout à Gemini en une seule fois (ia.js).
// 3. La fiche revient en brouillon modifiable, avec les avertissements.
// 4. « Enregistrer » crée la fiche. Les photos envoyées ne sont pas gardées,
//    sauf celle choisie avec la case « Garder une photo ».
// Le contenu de la page est oublié à sa fermeture.
const pageIa = document.getElementById("page-ia");
const iaTitre = document.getElementById("ia-titre");
const iaSaisie = document.getElementById("ia-saisie");
const iaCompte = document.getElementById("ia-compte");
const iaMiniatures = document.getElementById("ia-miniatures");
const iaAjouterPhoto = document.getElementById("ia-ajouter-photo");
const iaFichiers = document.getElementById("ia-fichiers");
const iaMessagePhotos = document.getElementById("ia-message-photos");
const iaTexte = document.getElementById("ia-texte");
const iaLien = document.getElementById("ia-lien");
const iaAnalyser = document.getElementById("ia-analyser");
const iaMessage = document.getElementById("ia-message");
const iaChargement = document.getElementById("ia-chargement");
const iaChargementTexte = document.getElementById("ia-chargement-texte");
const iaBrouillon = document.getElementById("ia-brouillon");
const iaAvertissements = document.getElementById("ia-avertissements");
const iaListeAvertissements = document.getElementById("ia-liste-avertissements");
const iaMessageBrouillon = document.getElementById("ia-message-brouillon");
const iaBlocPhoto = document.getElementById("ia-bloc-photo");
const iaGarderPhoto = document.getElementById("ia-garder-photo");
const iaChoixPhoto = document.getElementById("ia-choix-photo");
// Champs du brouillon
const iaB = {
  titre: document.getElementById("ia-b-titre"),
  type: document.getElementById("ia-b-type"),
  portions: document.getElementById("ia-b-portions"),
  preparation: document.getElementById("ia-b-preparation"),
  cuisson: document.getElementById("ia-b-cuisson"),
  champCuisson: document.getElementById("ia-b-champ-cuisson"),
  cocktail: document.getElementById("ia-b-cocktail"),
  verre: document.getElementById("ia-b-verre"),
  methode: document.getElementById("ia-b-methode"),
  alcool: document.getElementById("ia-b-alcool"),
  ingredients: document.getElementById("ia-b-ingredients"),
  etapes: document.getElementById("ia-b-etapes"),
  note: document.getElementById("ia-b-note"),
  lien: document.getElementById("ia-b-lien"),
};

const TITRES_IA = { recette: "Recette : photos et texte", cocktail: "Cocktail : photos et texte" };

let iaType = "recette";         // catégorie choisie (recette, cocktail)
let iaPhotos = [];              // [{ fichier: JPEG réduit, adresse: pour la miniature }]
let iaPreparation = false;      // photos en cours de réduction
let iaControle = null;          // appel à Gemini en cours (pour « Annuler »)
let iaOuverture = 0;            // change à chaque ouverture / fermeture de la page
let iaEnregistrement = false;   // « Enregistrer » en cours (pas de double appui)
let iaPhotoChoisie = 0;         // photo à garder (si la case est cochée)
// Ce qui avait été tapé dans le calque d'ajout avant d'ouvrir cette page
let iaDepart = { titre: "", note: "" };
// Ingrédients tels que renvoyés par Gemini : chaque ligne restée identique
// dans le brouillon garde sa quantité détaillée
let iaReference = { lignes: [], detail: [] };

// Une seule partie visible à la fois : saisie, chargement ou brouillon
function montrerVueIa(nom) {
  iaSaisie.hidden = nom !== "saisie";
  iaChargement.hidden = nom !== "chargement";
  iaBrouillon.hidden = nom !== "brouillon";
  pageIa.scrollTop = 0;
}

// Tout oublier : photos (libère la mémoire), texte, brouillon, appel en cours
function viderIa() {
  iaOuverture++;
  if (iaControle) iaControle.abort();
  iaControle = null;
  for (const photo of iaPhotos) URL.revokeObjectURL(photo.adresse);
  iaPhotos = [];
  iaPreparation = false;
  iaEnregistrement = false;
  iaTexte.value = "";
  iaLien.value = "";
  iaBrouillon.reset();
  iaReference = { lignes: [], detail: [] };
  iaPhotoChoisie = 0;
  for (const zone of [iaMessage, iaMessagePhotos, iaMessageBrouillon]) zone.hidden = true;
  afficherAvertissementsIa([]);
  afficherMiniaturesIa();
  majAnalyserIa();
}

// depart : { titre, lien, note } tapés dans le calque d'ajout, et texte
// copié (presse-papiers) à mettre dans le champ texte
function ouvrirIa(type, depart = {}) {
  viderIa();
  iaType = type;
  iaTitre.textContent = TITRES_IA[type];
  iaLien.value = depart.lien || "";
  iaTexte.value = (depart.texte || "").slice(0, LIMITES_IA.texte);
  majAnalyserIa();
  iaDepart = { titre: depart.titre || "", note: depart.note || "" };
  montrerVueIa("saisie");
  verrouillerPage();
  pageIa.showModal();
  pageIa.scrollTop = 0;
}

// Fermer : on demande confirmation si quelque chose a été commencé
function quitterIa() {
  const commence = iaPhotos.length > 0 || iaTexte.value.trim() !== "" || !iaBrouillon.hidden || iaControle !== null;
  if (commence && !window.confirm("Quitter sans enregistrer ? Les photos, le texte et le brouillon seront perdus.")) return;
  pageIa.close();
}
document.getElementById("ia-fermer").addEventListener("click", quitterIa);
// Touche Échap : même chose (avec confirmation)
pageIa.addEventListener("cancel", (evenement) => {
  evenement.preventDefault();
  quitterIa();
});
pageIa.addEventListener("close", () => {
  viderIa();
  deverrouillerPage();
});

// Depuis le calque d'ajout d'une recette ou d'un cocktail : le titre, le
// lien, la note et le texte copié (« Coller le lien copié ») suivent.
// Un titre qui n'est que le nom du site (« instagram.com ») ne suit pas.
boutonOuvrirIa.addEventListener("click", () => {
  const type = categorieChoisie();
  const lien = lienValide(champLien.value) || "";
  const titre = champTitre.value.trim();
  const depart = {
    titre: lien && titre === domaine(lien) ? "" : titre,
    lien,
    note: champNote.value.trim().slice(0, LONGUEUR_MAX_NOTE),
    texte: texteCopie,
  };
  fermerAjout();
  ouvrirIa(type, depart);
});

// --- Photos ---
const tailleTotaleIa = () => iaPhotos.reduce((total, photo) => total + photo.fichier.size, 0);

function afficherMiniaturesIa() {
  iaMiniatures.replaceChildren(...iaPhotos.map((photo, rang) => {
    const li = document.createElement("li");
    li.className = "ia-miniature";
    const image = document.createElement("img");
    image.src = photo.adresse;
    image.alt = `Photo ${rang + 1}`;
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "ia-retirer";
    retirer.textContent = "✕";
    retirer.setAttribute("aria-label", `Retirer la photo ${rang + 1}`);
    retirer.addEventListener("click", () => {
      URL.revokeObjectURL(photo.adresse);
      iaPhotos = iaPhotos.filter((p) => p !== photo);
      iaMessagePhotos.hidden = true;
      afficherMiniaturesIa();
      majAnalyserIa();
    });
    li.append(image, retirer);
    return li;
  }));
  iaMiniatures.hidden = iaPhotos.length === 0;
  iaCompte.textContent = `${iaPhotos.length} / ${LIMITES_IA.photos}`;
  iaAjouterPhoto.hidden = iaPhotos.length >= LIMITES_IA.photos;
  iaAjouterPhoto.disabled = iaPreparation;
  iaAjouterPhoto.textContent = iaPreparation ? "Préparation des photos…" : "+ Ajouter une photo";
}

// « Analyser » : actif dès qu'il y a une photo ou du texte
function majAnalyserIa() {
  iaAnalyser.disabled = iaPreparation || (iaPhotos.length === 0 && iaTexte.value.trim() === "");
}
iaTexte.addEventListener("input", majAnalyserIa);

iaAjouterPhoto.addEventListener("click", () => iaFichiers.click());

// Photos choisies (photothèque ou appareil photo) : réduites une par une,
// dans l'ordre, avant d'apparaître en miniature
iaFichiers.addEventListener("change", async () => {
  const choisies = [...iaFichiers.files];
  iaFichiers.value = ""; // permet de rechoisir la même photo
  if (choisies.length === 0) return;
  iaMessagePhotos.hidden = true;
  const ouverture = iaOuverture;
  const problemes = [];
  const place = LIMITES_IA.photos - iaPhotos.length;
  if (choisies.length > place) {
    problemes.push(`${LIMITES_IA.photos} photos au maximum : les photos en trop n'ont pas été ajoutées.`);
  }
  iaPreparation = true;
  afficherMiniaturesIa();
  majAnalyserIa();
  for (const fichier of choisies.slice(0, Math.max(0, place))) {
    let reduite;
    try {
      reduite = await reduireImage(fichier, LIMITES_IA.cote, LIMITES_IA.qualite);
    } catch {
      if (ouverture !== iaOuverture) return;
      problemes.push(`« ${fichier.name} » : ${MESSAGES_IA.image}`);
      continue;
    }
    if (ouverture !== iaOuverture) return; // page fermée entre-temps
    if (tailleTotaleIa() + reduite.size > LIMITES_IA.tailleTotale) {
      problemes.push("Taille totale des photos dépassée (environ 8 Mo) : retirez une photo pour en ajouter une autre.");
      break;
    }
    iaPhotos.push({ fichier: reduite, adresse: URL.createObjectURL(reduite) });
    afficherMiniaturesIa();
  }
  iaPreparation = false;
  afficherMiniaturesIa();
  majAnalyserIa();
  if (problemes.length) afficherMessage(problemes.join(" "), false, iaMessagePhotos);
});

// --- Appel à Gemini (analyse ou revérification) ---
// Montre la roue et « Annuler » ; en cas d'échec, revient à l'écran
// d'avant avec un message simple. Rien de ce qui a été saisi n'est perdu.
async function lancerAppelIa(texteChargement, vueRetour, zoneMessage, travail) {
  const controle = new AbortController();
  iaControle = controle;
  iaChargementTexte.textContent = texteChargement;
  montrerVueIa("chargement");
  try {
    await travail(controle.signal);
    if (iaControle !== controle) return; // page fermée entre-temps
    montrerVueIa("brouillon");
  } catch (erreur) {
    if (iaControle !== controle) return;
    montrerVueIa(vueRetour);
    afficherMessage(messageIa(erreur), false, zoneMessage);
  } finally {
    if (iaControle === controle) iaControle = null;
  }
}
document.getElementById("ia-annuler").addEventListener("click", () => {
  if (iaControle) iaControle.abort();
});

iaAnalyser.addEventListener("click", () => {
  iaMessage.hidden = true;
  const texte = iaTexte.value.trim().slice(0, LIMITES_IA.texte);
  if (iaPreparation || (iaPhotos.length === 0 && texte === "")) return;
  if (lireCleGemini() === "") {
    afficherMessage(MESSAGES_IA["pas-de-cle"], false, iaMessage);
    return;
  }
  const photos = iaPhotos.map((photo) => photo.fichier);
  lancerAppelIa("Analyse en cours… (45 secondes au plus)", "saisie", iaMessage, async (signal) => {
    const fiche = await analyserAvecGemini({ type: iaType, photos, texte }, signal);
    if (signal.aborted) throw new ErreurIa("annule");
    remplirBrouillonIa(fiche, true);
  });
});

// --- Brouillon ---
function afficherAvertissementsIa(liste) {
  iaListeAvertissements.replaceChildren(...liste.map((texte) => {
    const li = document.createElement("li");
    li.textContent = texte;
    return li;
  }));
  iaAvertissements.hidden = liste.length === 0;
}

// Cuisson pour une recette ; verre, méthode, alcool de base pour un cocktail
function majTypeBrouillonIa() {
  iaB.champCuisson.hidden = iaB.type.value !== "recette";
  iaB.cocktail.hidden = iaB.type.value !== "cocktail";
}
iaB.type.addEventListener("change", majTypeBrouillonIa);

// Case « Garder une photo » : s'il y a plusieurs photos, on choisit laquelle
function afficherChoixPhotoIa() {
  iaBlocPhoto.hidden = iaPhotos.length === 0;
  iaPhotoChoisie = Math.min(iaPhotoChoisie, Math.max(0, iaPhotos.length - 1));
  iaChoixPhoto.hidden = !iaGarderPhoto.checked || iaPhotos.length < 2;
  iaChoixPhoto.replaceChildren(...iaPhotos.map((photo, rang) => {
    const choix = document.createElement("label");
    choix.className = "ia-photo-choix";
    const bouton = document.createElement("input");
    bouton.type = "radio";
    bouton.name = "ia-photo-gardee";
    bouton.checked = rang === iaPhotoChoisie;
    bouton.setAttribute("aria-label", `Photo ${rang + 1}`);
    bouton.addEventListener("change", () => { iaPhotoChoisie = rang; });
    const image = document.createElement("img");
    image.src = photo.adresse;
    image.alt = "";
    choix.append(bouton, image);
    return choix;
  }));
}
iaGarderPhoto.addEventListener("change", afficherChoixPhotoIa);

// Met la fiche de Gemini dans le brouillon.
// premiere = true : première analyse (tout est rempli) ;
// false : revérification (un champ laissé vide par Gemini garde sa valeur).
function remplirBrouillonIa(fiche, premiere) {
  const remplir = (champ, valeur) => {
    if (premiere || (valeur !== undefined && valeur !== "")) champ.value = valeur ?? "";
  };
  const avertissements = [...fiche.avertissements];
  if (premiere) {
    iaB.type.value = iaType;
    if (fiche.type !== iaType) {
      avertissements.unshift(fiche.type === "cocktail"
        ? "L'IA pense qu'il s'agit plutôt d'un cocktail : vérifiez le type."
        : "L'IA pense qu'il s'agit plutôt d'une recette : vérifiez le type.");
    }
    iaB.titre.value = fiche.titre || iaDepart.titre;
    iaB.lien.value = lienValide(iaLien.value) || "";
    iaB.note.value = [iaDepart.note, fiche.notes].filter(Boolean).join("\n\n").slice(0, LONGUEUR_MAX_NOTE);
    iaGarderPhoto.checked = false;
    iaPhotoChoisie = 0;
  } else {
    remplir(iaB.titre, fiche.titre);
    remplir(iaB.note, fiche.notes.slice(0, LONGUEUR_MAX_NOTE));
  }
  remplir(iaB.portions, fiche.portions);
  remplir(iaB.preparation, fiche.tempsPreparation);
  remplir(iaB.cuisson, fiche.tempsCuisson);
  remplir(iaB.verre, fiche.verre);
  remplir(iaB.methode, fiche.methode);
  remplir(iaB.alcool, fiche.alcoolBase);
  if (premiere || fiche.ingredients.length) {
    iaReference = {
      lignes: fiche.ingredients.map((i) => i.ligne),
      detail: fiche.ingredients.map((i) => i.detail),
    };
    iaB.ingredients.value = iaReference.lignes.join("\n");
  }
  if (premiere || fiche.etapes.length) iaB.etapes.value = fiche.etapes.join("\n");
  afficherAvertissementsIa(avertissements);
  majTypeBrouillonIa();
  afficherChoixPhotoIa();
  iaMessageBrouillon.hidden = true;
}

// Lit le brouillon. Renvoie { erreur } si un champ est invalide.
function lireBrouillonIa() {
  const type = iaB.type.value === "cocktail" ? "cocktail" : "recette";
  const portions = lireEntier(iaB.portions, LIMITES_FICHE.portionsMax);
  const preparation = lireEntier(iaB.preparation, LIMITES_FICHE.minutesMax);
  const cuisson = type === "recette" ? lireEntier(iaB.cuisson, LIMITES_FICHE.minutesMax) : undefined;
  if (Number.isNaN(portions)) return { erreur: `Portions : un nombre entier entre 1 et ${LIMITES_FICHE.portionsMax}.` };
  if (Number.isNaN(preparation) || Number.isNaN(cuisson)) return { erreur: "Temps : un nombre entier de minutes (ou rien)." };
  const texteLien = iaB.lien.value.trim();
  const lien = lienValide(texteLien);
  if (texteLien !== "" && !lien) return { erreur: "Ce lien n'est pas valide : il doit commencer par http:// ou https://." };
  const ingredients = lireLignes(iaB.ingredients, LIMITES_FICHE.ingredients, LIMITES_FICHE.longueurIngredient);
  const court = (champ) => (type === "cocktail" ? champ.value.trim().slice(0, LIMITES_FICHE.champCourt) : "");
  return {
    type,
    titre: iaB.titre.value.trim().slice(0, LIMITES_FICHE.longueurTitre),
    portions,
    tempsPreparation: preparation,
    tempsCuisson: cuisson,
    verre: court(iaB.verre),
    methode: court(iaB.methode),
    alcoolBase: court(iaB.alcool),
    ingredients,
    ingredientsDetail: detailPourLignes(ingredients, iaReference.lignes, iaReference.detail),
    etapes: lireChampEtapes(iaB.etapes),
    note: iaB.note.value.trim().slice(0, LONGUEUR_MAX_NOTE),
    lien,
  };
}

// « Revérifier avec l'IA » : renvoie la fiche actuelle (texte seulement)
document.getElementById("ia-reverifier").addEventListener("click", () => {
  iaMessageBrouillon.hidden = true;
  const b = lireBrouillonIa();
  if (b.erreur) {
    afficherMessage(b.erreur, false, iaMessageBrouillon);
    return;
  }
  if (lireCleGemini() === "") {
    afficherMessage(MESSAGES_IA["pas-de-cle"], false, iaMessageBrouillon);
    return;
  }
  const fiche = {
    type: b.type,
    titre: b.titre,
    portions: b.portions ?? null,
    tempsPreparation: b.tempsPreparation ?? null,
    tempsCuisson: b.tempsCuisson ?? null,
    verre: b.verre,
    methode: b.methode,
    alcoolBase: b.alcoolBase,
    ingredients: b.ingredients.map((ligne, i) => {
      const d = b.ingredientsDetail && b.ingredientsDetail[i];
      return d ? { quantite: d.q, unite: d.u, nom: d.n } : { quantite: null, unite: "", nom: ligne };
    }),
    etapes: b.etapes,
    notes: b.note,
  };
  lancerAppelIa("Revérification en cours… (45 secondes au plus)", "brouillon", iaMessageBrouillon, async (signal) => {
    const corrigee = await reverifierAvecGemini(fiche, signal);
    if (signal.aborted) throw new ErreurIa("annule");
    remplirBrouillonIa(corrigee, false);
  });
});

document.getElementById("ia-retour-saisie").addEventListener("click", () => {
  iaMessage.hidden = true;
  montrerVueIa("saisie");
});

// « Enregistrer » : crée la fiche, puis l'ouvre
iaBrouillon.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  if (iaEnregistrement) return;
  iaMessageBrouillon.hidden = true;
  const b = lireBrouillonIa();
  if (b.erreur) {
    afficherMessage(b.erreur, false, iaMessageBrouillon);
    return;
  }
  if (b.titre === "") {
    afficherMessage("Donnez un titre à la fiche.", false, iaMessageBrouillon);
    iaB.titre.focus();
    return;
  }
  const infos = {
    lien: b.lien,
    note: b.note,
    portions: b.portions,
    tempsPreparation: b.tempsPreparation,
    ingredients: b.ingredients,
    ingredientsDetail: b.ingredientsDetail,
    etapes: b.etapes,
  };
  if (b.type === "recette") infos.tempsCuisson = b.tempsCuisson;
  else Object.assign(infos, { verre: b.verre, methode: b.methode, alcoolBase: b.alcoolBase });

  iaEnregistrement = true;
  const ouverture = iaOuverture;
  let photoPerdue = false;
  // Photo gardée : réduite à 800 px (environ 100 Ko)
  if (iaGarderPhoto.checked && iaPhotos[iaPhotoChoisie]) {
    try {
      infos.photoPerso = await photoPourFiche(iaPhotos[iaPhotoChoisie].fichier);
    } catch {
      infos.photoPerso = null;
    }
    if (ouverture !== iaOuverture) return; // page fermée entre-temps
    if (!infos.photoPerso) {
      delete infos.photoPerso;
      photoPerdue = true;
    }
  }

  // Mémoire de l'app pleine : on réessaie sans la photo, sinon on prévient
  // (la fiche à moitié ajoutée est retirée, rien n'est perdu du brouillon)
  const avant = elements.length;
  const essayer = () => {
    try {
      ajouter(b.titre, b.type, infos);
      return true;
    } catch {
      elements.length = avant;
      return false;
    }
  };
  let reussi = essayer();
  if (!reussi && infos.photoPerso) {
    delete infos.photoPerso;
    photoPerdue = true;
    reussi = essayer();
  }
  iaEnregistrement = false;
  if (!reussi) {
    afficherMessage("Impossible d'enregistrer : la mémoire de l'app est pleine.", false, iaMessageBrouillon);
    return;
  }
  const id = elements[elements.length - 1].id;
  pageIa.close();
  ouvrirFiche(id);
  if (photoPerdue) {
    window.alert("La fiche est enregistrée, mais sans la photo (mémoire de l'app presque pleine ou photo illisible).");
  }
});

// --- 6. Sauvegarde : exporter et importer --------------------
// Numéro de version du format du fichier. Si un jour on change la forme
// du fichier, on passera à 2 et on saura lire les anciens fichiers.
const FORMAT_NOM = "mes-listes";
// Version 1 : titre, type, fait. Version 2 : + année, affiche, identifiant TMDB
// (facultatifs). Version 3 : + identifiant RAWG pour les jeux (facultatif).
// Version 4 : + identifiant IMDb pour les films et séries (facultatif).
// Version 5 : + lien et note des recettes (facultatifs).
// Version 6 : + type « cocktail » ; recettes et cocktails ne sont jamais
// « terminés » (une ancienne recette cochée est remise en fiche à l'import).
// Version 7 : + contenu des fiches (facultatif) : photos (adresses),
// ingrédients, étapes, portions, temps de préparation et de cuisson,
// verre, méthode et alcool de base (cocktails).
// Version 8 : + fiches créées avec l'IA (facultatif) : ingrédients détaillés
// (quantité, unité, nom) et une photo gardée dans la fiche (image JPEG).
// L'app sait lire les huit. Les clés (TMDB, RAWG, Gemini) n'y sont jamais.
const FORMAT_VERSION = 8;

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
    // Une fiche (recette, cocktail) n'est jamais « terminée »
    const propre = { id: el.id, titre: el.titre.trim(), type: el.type, fait: estFiche(el.type) ? false : el.fait };

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
    // Lien et note des recettes (version 5, facultatifs). Gardés aussi pour
    // les autres types : une recette changée de catégorie les conserve.
    if (el.lien !== undefined) {
      const lien = lienValide(el.lien);
      if (!lien) throw new Error(`${numero} a un lien invalide (il doit commencer par http:// ou https://).`);
      propre.lien = lien;
    }
    if (el.note !== undefined) {
      if (typeof el.note !== "string" || el.note.length > LONGUEUR_MAX_NOTE) {
        throw new Error(`${numero} a une note invalide (texte de ${LONGUEUR_MAX_NOTE} caractères au plus).`);
      }
      if (el.note.trim() !== "") propre.note = el.note.trim();
    }
    // Contenu des fiches (version 7, facultatif) : vérifié dans recettes.js.
    // Gardé aussi pour les autres types, comme le lien et la note.
    Object.assign(propre, verifierChampsFiche(el, numero));
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
// RAWG tombe parfois en panne (erreur 522 qui met très longtemps à arriver) :
// on abandonne au bout de 8 secondes, et toute réponse autre que 200 est un échec.
const DELAI_RAWG = 8000;
async function appelerRawg(chemin, parametres = {}, cle = lireCleRawg()) {
  const adresse = new URL("https://api.rawg.io/api" + chemin);
  for (const [nom, valeur] of Object.entries(parametres)) {
    adresse.searchParams.set(nom, valeur);
  }
  adresse.searchParams.set("key", cle);
  // AbortController : permet d'annuler l'appel quand le délai est dépassé
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_RAWG);
  try {
    const reponse = await fetch(adresse, { signal: controle.signal });
    if (reponse.status !== 200) {
      const erreur = new Error(`RAWG a répondu ${reponse.status}`);
      erreur.statut = reponse.status;
      throw erreur;
    }
    return await reponse.json();
  } finally {
    clearTimeout(minuteur);
  }
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

// --- 7 ter. L'adresse du relais (import de recettes) ----------
// Gardée uniquement sur l'appareil (localStorage), comme les clés.
// Ce n'est pas un secret : on la réaffiche dans le champ pour la vérifier.
{
  const formulaireRelais = document.getElementById("formulaire-relais");
  const champRelais = document.getElementById("champ-relais");
  const etatRelais = document.getElementById("etat-relais");
  const messageRelais = document.getElementById("message-relais");
  const boutonEffacerRelais = document.getElementById("bouton-effacer-relais");

  const afficherEtatRelais = () => {
    const adresse = lireCle(CLE_RELAIS);
    etatRelais.textContent = adresse
      ? "✅ Un relais est enregistré sur cet appareil : l'import de recettes est activé."
      : "Aucun relais enregistré sur cet appareil : l'import est désactivé (l'ajout à la main reste possible).";
    champRelais.value = adresse;
    boutonEffacerRelais.hidden = !adresse;
  };

  formulaireRelais.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    let adresse = null;
    try {
      adresse = new URL(champRelais.value.trim());
    } catch {
      // pas une adresse
    }
    if (!adresse || adresse.protocol !== "https:") {
      afficherMessage("L'adresse doit commencer par https:// (exemple : https://mes-listes-relais.ton-pseudo.workers.dev).", false, messageRelais);
      return;
    }
    // On ne garde que le site et le chemin (pas de « ?… » ni de « #… »)
    localStorage.setItem(CLE_RELAIS, adresse.origin + adresse.pathname);
    afficherEtatRelais();
    afficherMessage("Adresse enregistrée. L'import de recettes est activé.", true, messageRelais);
  });

  boutonEffacerRelais.addEventListener("click", () => {
    localStorage.removeItem(CLE_RELAIS);
    afficherEtatRelais();
    afficherMessage("Adresse effacée de cet appareil.", true, messageRelais);
  });

  afficherEtatRelais();
}

// --- 7 quater. La clé et le modèle Gemini (ajout avec l'IA) --------
// Gardés uniquement sur l'appareil (localStorage), jamais dans les exports.
// La clé n'est jamais réaffichée : le champ se vide après l'enregistrement.
{
  const formulaireGemini = document.getElementById("formulaire-gemini");
  const champCleGemini = document.getElementById("champ-cle-gemini");
  const champModeleGemini = document.getElementById("champ-modele-gemini");
  const etatGemini = document.getElementById("etat-gemini");
  const messageGemini = document.getElementById("message-gemini");
  const boutonEnregistrerGemini = document.getElementById("bouton-enregistrer-gemini");
  const boutonEffacerGemini = document.getElementById("bouton-effacer-gemini");
  document.getElementById("aide-modele-gemini").textContent =
    `Par défaut : ${MODELE_GEMINI_DEFAUT} (rapide et peu coûteux). Les noms possibles sont sur ai.google.dev/gemini-api/docs/models.`;
  champModeleGemini.placeholder = MODELE_GEMINI_DEFAUT;

  const afficherEtatGemini = () => {
    const presente = lireCleGemini() !== "";
    etatGemini.textContent = presente
      ? `✅ Une clé Gemini est enregistrée sur cet appareil (modèle : ${lireModeleGemini()}).`
      : "Aucune clé Gemini enregistrée sur cet appareil : l'ajout par photos et texte est désactivé.";
    champModeleGemini.value = lireModeleGemini();
    boutonEffacerGemini.hidden = !presente;
  };

  // Enregistrer : on vérifie d'abord la clé et le modèle auprès de Google.
  // Champ « Clé » vide : on garde la clé déjà enregistrée (changement de modèle).
  formulaireGemini.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const modele = nettoyerNomModele(champModeleGemini.value || MODELE_GEMINI_DEFAUT);
    if (!modele) {
      afficherMessage(`Nom de modèle invalide (exemple : ${MODELE_GEMINI_DEFAUT}).`, false, messageGemini);
      return;
    }
    const cle = champCleGemini.value.trim() || lireCleGemini();
    if (cle === "") {
      afficherMessage("Colle d'abord ta clé Gemini dans le champ.", false, messageGemini);
      return;
    }
    boutonEnregistrerGemini.disabled = true;
    afficherMessage("Vérification auprès de Google…", true, messageGemini);
    let verifiee = true;
    try {
      await verifierGemini(cle, modele);
    } catch (erreur) {
      if (erreur.code === "cle") {
        afficherMessage("Google refuse cette clé. Vérifie que tu l'as copiée en entier. Rien n'a été enregistré.", false, messageGemini);
        return;
      }
      if (erreur.code === "modele") {
        afficherMessage(`Le modèle « ${modele} » est introuvable pour cette clé. Rien n'a été enregistré.`, false, messageGemini);
        return;
      }
      verifiee = false; // pas de connexion, quota… : on enregistre quand même
    } finally {
      boutonEnregistrerGemini.disabled = false;
    }
    try {
      localStorage.setItem(CLE_GEMINI, cle);
      localStorage.setItem(CLE_MODELE_GEMINI, modele);
    } catch {
      afficherMessage("Impossible d'enregistrer sur cet appareil (mémoire pleine ?).", false, messageGemini);
      return;
    }
    champCleGemini.value = "";
    afficherEtatGemini();
    afficherMessage(verifiee
      ? "Clé et modèle vérifiés et enregistrés. L'ajout par photos et texte est activé."
      : "Enregistré, mais impossible de vérifier auprès de Google pour le moment (pas de connexion ?).",
    verifiee, messageGemini);
  });

  boutonEffacerGemini.addEventListener("click", () => {
    localStorage.removeItem(CLE_GEMINI);
    champCleGemini.value = "";
    afficherEtatGemini();
    afficherMessage("Clé effacée de cet appareil.", true, messageGemini);
  });

  afficherEtatGemini();
}

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
  majTelQuel();
}

function afficherEtatRecherche(texte) {
  resultatsRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  etatRecherche.textContent = texte;
  etatRecherche.hidden = false;
  majTelQuel();
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

// Quel service interroger selon le type choisi (aucun pour recette, cocktail, autre)
function sourcePourType(type) {
  if (type === "film" || type === "serie") return SOURCES.tmdb;
  if (type === "jeu") return SOURCES.rawg;
  return null;
}


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
  // Le site de la photo ne sait pas qu'elle est affichée dans l'app
  // (certains sites refusent aussi leurs photos quand on l'indique)
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.replaceWith(vide));
  return image;
}

// Recherche de jeux impossible (RAWG en panne, trop lent, hors ligne, clé
// absente ou refusée) : message simple, sans détail technique, et le calque
// passe en saisie manuelle (bouton orange « Ajouter », la touche Entrée
// ajoute). Le jeu sera créé avec le titre tapé, sans infos RAWG.
// On ne réessaie plus RAWG avant la prochaine ouverture du calque.
const MESSAGE_JEUX_INDISPONIBLE = "Recherche de jeux indisponible pour le moment. Vous pouvez ajouter le jeu manuellement.";
function passerJeuxEnManuel(cleAbsente) {
  rechercheJeuxIndisponible = true;
  clearTimeout(minuteurRecherche);
  numeroRecherche++; // une réponse encore en route sera ignorée
  afficherEtatRecherche(MESSAGE_JEUX_INDISPONIBLE);
  if (cleAbsente) {
    const indication = document.createElement("span");
    indication.className = "indication";
    indication.textContent = "Clé RAWG à renseigner dans Réglages → Clés API.";
    etatRecherche.append(indication);
  }
  ajoutDirect.hidden = false;
  champTitre.enterKeyHint = "done"; // la touche du clavier devient « OK »
}

async function rechercher() {
  const texte = champTitre.value.trim();
  const type = categorieChoisie();

  // Jeux en saisie manuelle : on garde le message, plus d'appel à RAWG
  if (type === "jeu" && rechercheJeuxIndisponible) return;

  // La recherche concerne les films, séries et jeux, à partir de 2 lettres
  const source = sourcePourType(type);
  if (!source || texte.length < 2) {
    masquerRecherche();
    return;
  }
  // Jeux : clé absente ou hors ligne → saisie manuelle
  if (source === SOURCES.rawg && source.lireCle() === "") {
    passerJeuxEnManuel(true);
    return;
  }
  if (source === SOURCES.rawg && !navigator.onLine) {
    passerJeuxEnManuel(false);
    return;
  }
  if (source.lireCle() === "") {
    afficherEtatRecherche(`Recherche ${source.nom} désactivée : ajoute ta clé dans Réglages → Clés API. Tu peux aussi ajouter le titre à la main.`);
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
    // Jeux : panne, délai de 8 s dépassé, réponse illisible, clé refusée…
    if (source === SOURCES.rawg) {
      passerJeuxEnManuel(false);
      return;
    }
    afficherEtatRecherche(
      cleRefusee(erreur)
        ? `${source.nom} refuse ta clé. Vérifie-la dans Réglages → Clés API. Tu peux ajouter le titre à la main.`
        : "Recherche impossible (connexion ?). Tu peux ajouter le titre à la main."
    );
    return;
  }
  if (numero !== numeroRecherche) return; // une recherche plus récente a été lancée

  if (resultats.length === 0) {
    afficherEtatRecherche(`Aucun résultat sur ${source.nom}. Tu peux l'ajouter tel quel.`);
    return;
  }

  etatRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  for (const res of resultats) {
    // Chaque ligne : affiche 52 × 76, titre, type et année, « Ajouter » orange.
    // Toute la ligne est appuyable (plus facile au doigt) ; le mot « Ajouter »
    // a l'air d'un bouton pour qu'on comprenne ce qui va se passer.
    const li = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "resultat";
    bouton.setAttribute("aria-label", `Ajouter ${res.titre}${res.annee ? ` (${res.annee})` : ""}`);

    const titre = document.createElement("span");
    titre.className = "titre";
    titre.textContent = res.titre;

    const details = document.createElement("span");
    details.className = "details";
    const nomType = NOMS_SIMPLES[res.type];
    details.textContent = res.annee ? `${nomType} · ${res.annee}` : nomType;

    const textes = document.createElement("span");
    textes.className = "textes";
    textes.append(titre, details);

    const pastille = document.createElement("span");
    pastille.className = "pastille-ajouter";
    pastille.textContent = "Ajouter";

    bouton.append(creerVignette(res.affiche, res.type), textes, pastille);
    bouton.addEventListener("click", () => {
      ajouter(res.titre, res.type, res);
      fermerAjout();
    });
    li.append(bouton);
    resultatsRecherche.append(li);
  }
  resultatsRecherche.hidden = false;
  majTelQuel();
}

// On attend une petite pause dans la frappe avant de chercher
// (sinon une recherche partirait à chaque lettre)
function programmerRecherche() {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(rechercher, 400);
}
champTitre.addEventListener("input", () => {
  majTelQuel(); // la ligne « Ajouter … tel quel » suit ce qui est tapé
  programmerRecherche();
});

// --- 9. Démarrage --------------------------------------------
// Les sections "Terminés" et "Supprimés" sont fermées à chaque ouverture
// de l'app (c'est le comportement par défaut de <details>).
localStorage.removeItem("mes-listes-section-ouverte"); // ancien réglage, devenu inutile
document.getElementById("version").textContent = VERSION;
allerA("accueil");
completerImdbManquants();
// Revenu en ligne (métro, avion…) : on complète ce qui manque encore
window.addEventListener("online", completerImdbManquants);

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
