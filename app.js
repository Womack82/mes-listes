// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Noms sous lesquels on range les données dans la mémoire du téléphone
const CLE_STOCKAGE = "mes-listes";
const CLE_SUPPRIMES = "mes-listes-supprimes";

// Emoji affiché devant chaque type
const EMOJIS = { film: "🎬", serie: "📺", jeu: "🎮", recette: "🍳", autre: "📌" };

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

// L'élément en cours de modification (null = aucun)
let idEnEdition = null;

// L'élément dont le bouton affiche "Supprimer ?" (null = aucun)
let idAConfirmer = null;
let minuteurConfirmation = null;

// On récupère les morceaux de la page dont on a besoin
const formulaire = document.getElementById("formulaire-ajout");
const champTitre = document.getElementById("champ-titre");
const champType = document.getElementById("champ-type");
const liste = document.getElementById("liste");
const messageVide = document.getElementById("message-vide");
const boutonsFiltre = document.querySelectorAll("#filtres button");
const sectionFaits = document.getElementById("section-faits");
const listeFaits = document.getElementById("liste-faits");
const compteurFaits = document.getElementById("compteur-faits");
const sectionSupprimes = document.getElementById("section-supprimes");
const listeSupprimes = document.getElementById("liste-supprimes");
const compteurSupprimes = document.getElementById("compteur-supprimes");

// Garde l'élément s'il correspond au filtre choisi
function correspondAuFiltre(el) {
  return filtreActif === "tous" || el.type === filtreActif;
}

// --- 3. Afficher les listes ----------------------------------
// On vide les trois listes puis on les remplit à nouveau.
function afficher() {
  liste.innerHTML = "";
  listeFaits.innerHTML = "";
  listeSupprimes.innerHTML = "";

  const visibles = elements.filter(correspondAuFiltre);
  const aFaire = visibles.filter((el) => !el.fait);
  const faits = visibles.filter((el) => el.fait);
  // Les supprimés, du plus récent au plus ancien
  const supprimesVisibles = supprimes.filter(correspondAuFiltre).reverse();

  for (const el of aFaire) liste.append(creerLigne(el));
  for (const el of faits) listeFaits.append(creerLigne(el));
  for (const el of supprimesVisibles) listeSupprimes.append(creerLigneSupprimee(el));

  // Chaque section n'apparaît que si elle contient au moins un élément
  compteurFaits.textContent = faits.length;
  sectionFaits.hidden = faits.length === 0;
  compteurSupprimes.textContent = supprimesVisibles.length;
  sectionSupprimes.hidden = supprimesVisibles.length === 0;

  // Message quand il ne reste rien à faire
  if (visibles.length === 0) {
    messageVide.textContent = "Rien ici pour l'instant.";
  } else {
    messageVide.textContent = "Tout est fait ! 🎉";
  }
  messageVide.hidden = aFaire.length > 0;
}

// Fabrique la ligne <li> d'un élément :
// case à cocher + titre + bouton ✏️ + bouton ✕
function creerLigne(el) {
  // Si cet élément est en cours de modification, on montre le formulaire
  if (el.id === idEnEdition) return creerLigneEdition(el);

  const li = document.createElement("li");
  if (el.fait) li.classList.add("fait");

  // Case à cocher fait / à faire
  const caseACocher = document.createElement("input");
  caseACocher.type = "checkbox";
  caseACocher.checked = el.fait;
  caseACocher.addEventListener("change", () => basculer(el.id));

  // Titre (textContent empêche d'injecter du code HTML par erreur)
  const titre = document.createElement("span");
  titre.className = "titre";
  titre.textContent = `${EMOJIS[el.type]} ${el.titre}`;

  // Bouton modifier
  const boutonModif = document.createElement("button");
  boutonModif.className = "icone";
  boutonModif.textContent = "✏️";
  boutonModif.setAttribute("aria-label", "Modifier");
  boutonModif.addEventListener("click", () => commencerEdition(el.id));

  // Bouton supprimer : il faut appuyer deux fois (✕ puis "Supprimer ?")
  const boutonSuppr = document.createElement("button");
  boutonSuppr.className = "icone supprimer";
  if (el.id === idAConfirmer) {
    boutonSuppr.textContent = "Supprimer ?";
    boutonSuppr.classList.add("confirmer");
    boutonSuppr.addEventListener("click", () => supprimer(el.id));
  } else {
    boutonSuppr.textContent = "✕";
    boutonSuppr.setAttribute("aria-label", "Supprimer");
    boutonSuppr.addEventListener("click", () => demanderConfirmation(el.id));
  }

  li.append(caseACocher, titre, boutonModif, boutonSuppr);
  return li;
}

// Fabrique la ligne en mode "modification" : champ titre + choix du type
function creerLigneEdition(el) {
  const li = document.createElement("li");

  const form = document.createElement("form");
  form.className = "edition";

  const champ = document.createElement("input");
  champ.type = "text";
  champ.value = el.titre;
  champ.required = true;

  // On copie le menu déroulant du formulaire d'ajout pour avoir les mêmes types
  const choixType = champType.cloneNode(true);
  choixType.removeAttribute("id");
  choixType.value = el.type;

  const boutonOk = document.createElement("button");
  boutonOk.type = "submit";
  boutonOk.textContent = "Enregistrer";

  const boutonAnnuler = document.createElement("button");
  boutonAnnuler.type = "button";
  boutonAnnuler.className = "secondaire";
  boutonAnnuler.textContent = "Annuler";
  boutonAnnuler.addEventListener("click", annulerEdition);

  form.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    const nouveauTitre = champ.value.trim();
    if (nouveauTitre === "") return;
    modifier(el.id, nouveauTitre, choixType.value);
  });

  form.append(champ, choixType, boutonOk, boutonAnnuler);
  li.append(form);

  // Place le curseur dans le champ dès que la ligne est affichée
  setTimeout(() => champ.focus(), 0);
  return li;
}

// Fabrique une ligne de la section "Supprimés" (lecture seule, aucun bouton)
function creerLigneSupprimee(el) {
  const li = document.createElement("li");
  li.className = "supprime";

  const titre = document.createElement("span");
  titre.className = "titre";
  titre.textContent = `${EMOJIS[el.type]} ${el.titre}`;

  const date = document.createElement("span");
  date.className = "date";
  date.textContent = new Date(el.dateSuppression).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  li.append(titre, date);
  return li;
}

// --- 4. Les actions ------------------------------------------
function ajouter(titre, type) {
  elements.push({
    id: Date.now().toString(), // identifiant unique basé sur l'heure
    titre: titre,
    type: type,
    fait: false,
  });
  sauvegarder();
  afficher();
}

function basculer(id) {
  const el = elements.find((e) => e.id === id);
  el.fait = !el.fait; // true devient false et inversement
  sauvegarder();
  afficher();
}

function commencerEdition(id) {
  idEnEdition = id;
  idAConfirmer = null;
  afficher();
}

function annulerEdition() {
  idEnEdition = null;
  afficher();
}

function modifier(id, titre, type) {
  const el = elements.find((e) => e.id === id);
  el.titre = titre;
  el.type = type;
  idEnEdition = null;
  sauvegarder();
  afficher();
}

// Premier appui sur ✕ : le bouton devient "Supprimer ?" pendant 3 secondes
function demanderConfirmation(id) {
  idAConfirmer = id;
  clearTimeout(minuteurConfirmation);
  minuteurConfirmation = setTimeout(() => {
    idAConfirmer = null;
    afficher();
  }, 3000);
  afficher();
}

// Deuxième appui : l'élément part dans "Supprimés"
function supprimer(id) {
  const el = elements.find((e) => e.id === id);
  supprimes.push({
    titre: el.titre,
    type: el.type,
    dateSuppression: new Date().toISOString(),
  });
  elements = elements.filter((e) => e.id !== id);
  idAConfirmer = null;
  clearTimeout(minuteurConfirmation);
  sauvegarder();
  afficher();
}

// --- 5. Réagir aux actions de l'utilisateur ------------------
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger
  const titre = champTitre.value.trim();
  if (titre === "") return;
  ajouter(titre, champType.value);
  champTitre.value = "";
});

for (const bouton of boutonsFiltre) {
  bouton.addEventListener("click", () => {
    filtreActif = bouton.dataset.type;
    boutonsFiltre.forEach((b) => b.classList.remove("actif"));
    bouton.classList.add("actif");
    afficher();
  });
}

// --- 6. Démarrage --------------------------------------------
// Les sections "Terminés" et "Supprimés" sont fermées à chaque ouverture
// de l'app (c'est le comportement par défaut de <details>).
localStorage.removeItem("mes-listes-section-ouverte"); // ancien réglage, devenu inutile
afficher();

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
