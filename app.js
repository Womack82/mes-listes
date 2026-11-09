// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Numéro de version affiché à côté du titre.
// ⚠️ Doit toujours être le même que NOM_CACHE dans service-worker.js
// Nouvelle demande → numéro principal suivant (v11, v12…).
// Correction ou modification d'une demande existante → sous-numéro (v10.1, v10.2…).
const VERSION = "v10.1";

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
  // Élément venu de TMDB : petite affiche à gauche, année sous le titre.
  // Sinon : emoji du type devant le titre, comme avant.
  let vignette = null;
  if (el.idTmdb) {
    vignette = creerVignette(el.affiche, el.type);
    titre.textContent = el.titre;
    if (el.annee) {
      const annee = document.createElement("span");
      annee.className = "details";
      annee.textContent = el.annee;
      titre.append(annee);
    }
  } else {
    titre.textContent = `${EMOJIS[el.type]} ${el.titre}`;
  }

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

  li.append(caseACocher);
  if (vignette) li.append(vignette);
  li.append(titre, boutonModif, boutonSuppr);
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
// infosTmdb (facultatif) : { annee, affiche, idTmdb } quand le titre
// a été choisi dans la recherche TMDB
function ajouter(titre, type, infosTmdb = null) {
  const el = {
    id: Date.now().toString(), // identifiant unique basé sur l'heure
    titre: titre,
    type: type,
    fait: false,
  };
  if (infosTmdb) {
    if (infosTmdb.annee) el.annee = infosTmdb.annee;
    if (infosTmdb.affiche) el.affiche = infosTmdb.affiche;
    el.idTmdb = infosTmdb.idTmdb;
  }
  elements.push(el);
  sauvegarder();
  afficher();
}

// Retire les informations TMDB d'un élément (affiche, année, identifiant)
function retirerInfosTmdb(el) {
  delete el.annee;
  delete el.affiche;
  delete el.idTmdb;
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
  // Si le type change, les infos TMDB ne correspondent plus
  // (un identifiant TMDB de film ne désigne pas la même chose côté séries)
  if (type !== el.type) retirerInfosTmdb(el);
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

// Deuxième appui : l'élément part dans "Supprimés".
// On n'y garde que titre, type et date : l'affiche, l'année et
// l'identifiant TMDB sont perdus.
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
  ajouter(titre, champType.value); // saisie manuelle : pas d'infos TMDB
  champTitre.value = "";
  masquerRecherche();
});

for (const bouton of boutonsFiltre) {
  bouton.addEventListener("click", () => {
    filtreActif = bouton.dataset.type;
    boutonsFiltre.forEach((b) => b.classList.remove("actif"));
    bouton.classList.add("actif");
    afficher();
  });
}

// --- 6. Sauvegarde : exporter et importer --------------------
// Numéro de version du format du fichier. Si un jour on change la forme
// du fichier, on passera à 2 et on saura lire les anciens fichiers.
const FORMAT_NOM = "mes-listes";
// Version 1 : titre, type, fait. Version 2 : + année, affiche, identifiant TMDB
// (facultatifs). L'app sait lire les deux.
const FORMAT_VERSION = 2;

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
  idEnEdition = null;
  idAConfirmer = null;
  fenetreImport.close();
  afficher();
  afficherMessage(`Import réussi : ${resumer(elements, supprimes)}.`, true);
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

// --- 7. TMDB : la clé et les appels ---------------------------
// La clé est rangée dans la mémoire de l'appareil (localStorage),
// jamais dans un fichier du projet ni dans les exports.
const CLE_TMDB = "mes-listes-cle-tmdb";

const formulaireCle = document.getElementById("formulaire-cle");
const champCle = document.getElementById("champ-cle");
const etatCle = document.getElementById("etat-cle");
const messageCle = document.getElementById("message-cle");
const boutonEffacerCle = document.getElementById("bouton-effacer-cle");

function lireCleTmdb() {
  try {
    return localStorage.getItem(CLE_TMDB) || "";
  } catch {
    return "";
  }
}

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

function afficherEtatCle() {
  const presente = lireCleTmdb() !== "";
  etatCle.textContent = presente
    ? "✅ Une clé est enregistrée sur cet appareil."
    : "Aucune clé enregistrée sur cet appareil : la recherche est désactivée.";
  boutonEffacerCle.hidden = !presente;
}

// Enregistrer : on teste d'abord la clé auprès de TMDB
formulaireCle.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const cle = champCle.value.trim();
  if (cle === "") {
    afficherMessage("Colle d'abord ta clé dans le champ.", false, messageCle);
    return;
  }
  try {
    await appelerTmdb("/authentication", {}, cle);
  } catch (erreur) {
    if (erreur.statut === 401) {
      afficherMessage("TMDB refuse cette clé. Vérifie que tu l'as copiée en entier. Rien n'a été enregistré.", false, messageCle);
      return;
    }
    // Pas de connexion : on enregistre quand même, on testera plus tard
    localStorage.setItem(CLE_TMDB, cle);
    champCle.value = "";
    afficherEtatCle();
    afficherMessage("Clé enregistrée, mais impossible de la vérifier (pas de connexion ?).", false, messageCle);
    return;
  }
  localStorage.setItem(CLE_TMDB, cle);
  champCle.value = "";
  afficherEtatCle();
  afficherMessage("Clé vérifiée et enregistrée. La recherche est activée.", true, messageCle);
});

boutonEffacerCle.addEventListener("click", () => {
  localStorage.removeItem(CLE_TMDB);
  afficherEtatCle();
  afficherMessage("Clé effacée de cet appareil.", true, messageCle);
});

afficherEtatCle();

// --- 8. TMDB : la recherche de films et séries ---------------
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
function convertirResultat(r) {
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

// Fabrique la petite image d'un élément : l'affiche, ou l'emoji du type
// s'il n'y a pas d'affiche ou si elle ne se charge pas (hors ligne)
function creerVignette(affiche, type) {
  const emoji = document.createElement("span");
  emoji.className = "vignette vignette-vide";
  emoji.textContent = EMOJIS[type];
  if (!affiche) return emoji;

  const image = document.createElement("img");
  image.className = "vignette";
  image.src = affiche;
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => image.replaceWith(emoji));
  return image;
}

async function rechercher() {
  const texte = champTitre.value.trim();
  const type = champType.value;

  // La recherche ne concerne que les films et séries, à partir de 2 lettres
  if ((type !== "film" && type !== "serie") || texte.length < 2) {
    masquerRecherche();
    return;
  }
  if (lireCleTmdb() === "") {
    afficherEtatRecherche("Pour chercher sur TMDB, colle ta clé dans « Réglages » en bas. Tu peux aussi ajouter le titre à la main.");
    return;
  }
  if (!navigator.onLine) {
    afficherEtatRecherche("Hors ligne : recherche impossible. Tu peux ajouter le titre à la main.");
    return;
  }

  const numero = ++numeroRecherche;
  etatRecherche.textContent = "Recherche…";
  etatRecherche.hidden = false;

  let donnees;
  try {
    // search/multi renvoie films, séries et personnes ensemble
    donnees = await appelerTmdb("/search/multi", {
      query: texte,
      language: "fr-FR",
      include_adult: "false",
    });
  } catch (erreur) {
    if (numero !== numeroRecherche) return;
    afficherEtatRecherche(
      erreur.statut === 401
        ? "TMDB refuse ta clé. Vérifie-la dans « Réglages ». Tu peux ajouter le titre à la main."
        : "Recherche impossible (connexion ?). Tu peux ajouter le titre à la main."
    );
    return;
  }
  if (numero !== numeroRecherche) return; // une recherche plus récente a été lancée

  const resultats = donnees.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv") // sans les personnes
    .slice(0, 8)
    .map(convertirResultat);

  if (resultats.length === 0) {
    afficherEtatRecherche("Aucun résultat sur TMDB. Appuie sur « Ajouter » pour l'ajouter à la main.");
    return;
  }

  etatRecherche.textContent = "Touche un résultat pour l'ajouter, ou « Ajouter » pour garder ton texte :";
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
    const nomType = res.type === "film" ? "🎬 Film" : "📺 Série";
    details.textContent = res.annee ? `${nomType} · ${res.annee}` : nomType;

    const textes = document.createElement("span");
    textes.className = "textes";
    textes.append(titre, details);

    bouton.append(creerVignette(res.affiche, res.type), textes);
    bouton.addEventListener("click", () => {
      ajouter(res.titre, res.type, res);
      champTitre.value = "";
      masquerRecherche();
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
champType.addEventListener("change", programmerRecherche);

// --- 9. Démarrage --------------------------------------------
// Les sections "Terminés" et "Supprimés" sont fermées à chaque ouverture
// de l'app (c'est le comportement par défaut de <details>).
localStorage.removeItem("mes-listes-section-ouverte"); // ancien réglage, devenu inutile
document.getElementById("version").textContent = VERSION;
afficher();

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
