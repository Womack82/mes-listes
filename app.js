// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Nom sous lequel on range les données dans la mémoire du téléphone
const CLE_STOCKAGE = "mes-listes";

// Emoji affiché devant chaque type
const EMOJIS = { film: "🎬", serie: "📺", jeu: "🎮", recette: "🍳", autre: "📌" };

// --- 1. Charger les données sauvegardées --------------------
// localStorage ne stocke que du texte : on transforme le texte en
// tableau avec JSON.parse. Si rien n'est enregistré, on part d'un tableau vide.
function charger() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || [];
  } catch (erreur) {
    console.error("Impossible de lire les données :", erreur);
    return [];
  }
}

// --- 2. Sauvegarder les données ------------------------------
function sauvegarder() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(elements));
}

// La liste de tous les éléments. Chaque élément ressemble à :
// { id: "1731...", titre: "Inception", type: "film", fait: false }
let elements = charger();

// Le filtre actuellement choisi ("tous", "film", "serie", ...)
let filtreActif = "tous";

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

// La section "Terminés" se souvient si tu l'as laissée ouverte ou fermée
const CLE_SECTION = "mes-listes-section-ouverte";
sectionFaits.open = localStorage.getItem(CLE_SECTION) === "oui";
sectionFaits.addEventListener("toggle", () => {
  localStorage.setItem(CLE_SECTION, sectionFaits.open ? "oui" : "non");
});

// --- 3. Afficher les listes ----------------------------------
// On vide les deux listes, puis on range chaque élément visible
// dans "à faire" ou dans "terminés" selon qu'il est coché ou non.
function afficher() {
  liste.innerHTML = "";
  listeFaits.innerHTML = "";

  const visibles = elements.filter(
    (el) => filtreActif === "tous" || el.type === filtreActif
  );
  const aFaire = visibles.filter((el) => !el.fait);
  const faits = visibles.filter((el) => el.fait);

  for (const el of aFaire) liste.append(creerLigne(el));
  for (const el of faits) listeFaits.append(creerLigne(el));

  // La section "Terminés" n'apparaît que s'il y a au moins un élément fini
  compteurFaits.textContent = faits.length;
  sectionFaits.hidden = faits.length === 0;

  // Message quand il ne reste rien à faire
  if (visibles.length === 0) {
    messageVide.textContent = "Rien ici pour l'instant.";
  } else {
    messageVide.textContent = "Tout est fait ! 🎉";
  }
  messageVide.hidden = aFaire.length > 0;
}

// Fabrique la ligne <li> d'un élément (case à cocher + titre + bouton ✕)
function creerLigne(el) {
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

  // Bouton supprimer
  const boutonSuppr = document.createElement("button");
  boutonSuppr.className = "supprimer";
  boutonSuppr.textContent = "✕";
  boutonSuppr.setAttribute("aria-label", "Supprimer");
  boutonSuppr.addEventListener("click", () => supprimer(el.id));

  li.append(caseACocher, titre, boutonSuppr);
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

function supprimer(id) {
  elements = elements.filter((e) => e.id !== id);
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
afficher();

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
