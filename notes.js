// ============================================================
// notes.js : la page « Notes » (Réglages → Notes)
// Une liste simple de notes à cocher, dans l'esprit de l'app Rappels :
// - la dernière ligne (cercle en pointillés) sert à ajouter ; Entrée
//   valide et ouvre une nouvelle ligne juste dessous ;
// - toucher le texte d'une note permet de le modifier sur place ;
//   une note vidée est supprimée ;
// - glisser une ligne vers la gauche fait apparaître « Supprimer »
//   (sur ordinateur : petit bouton au survol) ; suppression définitive ;
// - les notes cochées descendent dans « Terminées (N) », repliée.
// Les notes sont rangées à part (clé « mes-listes-notes ») : elles
// n'apparaissent ni dans les compteurs, ni dans « Derniers ajoutés ».
// Chargé après app.js (voir index.html).
// ============================================================

const CLE_NOTES = "mes-listes-notes";
const LIMITES_NOTES = { nombre: 500, longueur: 1000 };

// Chaque note : { id, texte, fait, dateCreation } (date au format ISO).
// Les plus anciennes en premier : les nouvelles arrivent en bas.
let notes = chargerNotes();

function chargerNotes() {
  try {
    const brutes = JSON.parse(localStorage.getItem(CLE_NOTES));
    return Array.isArray(brutes) ? brutes.filter(noteValide) : [];
  } catch {
    return [];
  }
}

function sauvegarderNotes() {
  localStorage.setItem(CLE_NOTES, JSON.stringify(notes));
  majBadgeNotes();
}

function noteValide(n) {
  return typeof n === "object" && n !== null &&
    typeof n.id === "string" && n.id !== "" && n.id.length <= 50 &&
    typeof n.texte === "string" && n.texte.trim() !== "" && n.texte.length <= LIMITES_NOTES.longueur &&
    typeof n.fait === "boolean" &&
    typeof n.dateCreation === "string" && !isNaN(Date.parse(n.dateCreation));
}

// Identifiant unique : l'heure + quelques caractères au hasard
const nouvelIdNote = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Texte d'une note : sur une seule ligne (Entrée sert à valider)
const nettoyerTexteNote = (texte) => String(texte).replace(/\s*\n+\s*/g, " ").trim().slice(0, LIMITES_NOTES.longueur);

// --- Sauvegarde (export / import, utilisés par app.js) ---
function notesPourExport() {
  return notes.map(({ id, texte, fait, dateCreation }) => ({ id, texte, fait, dateCreation }));
}

// Vérifie les notes d'un fichier de sauvegarde. Lance une erreur claire si
// elles sont invalides ; renvoie null si le fichier n'en contient pas
// (ancienne sauvegarde : les notes actuelles seront gardées).
function verifierNotesFichier(valeur) {
  if (valeur === undefined) return null;
  if (!Array.isArray(valeur) || valeur.length > LIMITES_NOTES.nombre) {
    throw new Error("La liste des notes est invalide.");
  }
  const ids = new Set();
  return valeur.map((n, i) => {
    if (!noteValide(n) || ids.has(n.id)) throw new Error(`La note n°${i + 1} est invalide.`);
    ids.add(n.id);
    return { id: n.id, texte: nettoyerTexteNote(n.texte), fait: n.fait, dateCreation: n.dateCreation };
  });
}

// Remplace toutes les notes (import confirmé). Lance une erreur si la
// mémoire est pleine : app.js remet alors tout comme avant.
function remplacerNotes(nouvelles) {
  const anciennes = notes;
  notes = nouvelles;
  try {
    sauvegarderNotes();
  } catch (erreur) {
    notes = anciennes;
    throw erreur;
  }
  if (pageNotes.open) afficherNotes();
}

// --- Réglages : ligne « Notes » avec le nombre de notes à faire ---
const badgeNotes = document.getElementById("badge-notes");
function majBadgeNotes() {
  badgeNotes.textContent = notes.filter((n) => !n.fait).length;
}
majBadgeNotes();

// --- La page ---
const pageNotes = document.getElementById("page-notes");
const listeNotes = document.getElementById("notes-liste");
const listeNotesFaites = document.getElementById("notes-faites");
const blocNotesFaites = document.getElementById("notes-bloc-faites");
const basculeNotesFaites = document.getElementById("notes-bascule-faites");
const texteBasculeNotes = document.getElementById("notes-bascule-texte");
const notesVide = document.getElementById("notes-vide");
const champNouvelleNote = document.getElementById("notes-nouvelle");
const notesAnnonce = document.getElementById("notes-annonce");
const boutonMenuNotes = document.getElementById("notes-menu-bouton");
const menuNotes = document.getElementById("notes-menu");
const actionCopierNotes = document.getElementById("notes-copier");
const actionSupprimerFaites = document.getElementById("notes-supprimer-faites");

// Tracé du crochet blanc dans un cercle coché
const TRACE_CROCHET = "M7 12.5l3.2 3.2L17 9";

document.getElementById("ligne-notes").addEventListener("click", () => {
  panneauReglages.close();
  ouvrirNotes();
});

function ouvrirNotes() {
  // « Terminées » repliée à chaque ouverture
  basculeNotesFaites.setAttribute("aria-expanded", "false");
  listeNotesFaites.hidden = true;
  fermerMenuNotes();
  notesAnnonce.hidden = true;
  champNouvelleNote.value = "";
  afficherNotes();
  verrouillerPage();
  pageNotes.showModal();
  pageNotes.scrollTop = 0;
}

// Retour : on revient au menu Réglages
function retourNotes() {
  pageNotes.close();
  afficherVue("menu");
  panneauReglages.showModal();
}
document.getElementById("notes-retour").addEventListener("click", retourNotes);
pageNotes.addEventListener("cancel", (evenement) => {
  evenement.preventDefault(); // touche Échap : comme le bouton retour
  retourNotes();
});
pageNotes.addEventListener("close", () => {
  // Un texte en cours de saisie est gardé (comme dans Rappels)
  validerNouvelleNote();
  deverrouillerPage();
});

// Dessine les deux listes (à faire, terminées) à partir des données.
// Seulement à l'ouverture de la page et après un import : ensuite, chaque
// action ne touche que sa ligne (sinon un champ en cours de saisie serait
// redessiné et le clavier se fermerait). La ligne d'ajout n'est jamais
// redessinée.
function afficherNotes() {
  fermerLigneOuverte();
  listeNotes.replaceChildren(...notes.filter((n) => !n.fait).map(creerLigneNote));
  listeNotesFaites.replaceChildren(...notes.filter((n) => n.fait).map(creerLigneNote));
  majEtatsNotes();
}

// Compteur « Terminées (N) », message vide, actions du menu « … »
function majEtatsNotes() {
  const faites = notes.filter((n) => n.fait).length;
  blocNotesFaites.hidden = faites === 0;
  texteBasculeNotes.textContent = `Terminées (${faites})`;
  notesVide.hidden = notes.length > 0;
  actionCopierNotes.disabled = notes.length === faites;
  actionSupprimerFaites.disabled = faites === 0;
}

// La ligne d'une note, si elle est affichée
const ligneDeNote = (id) => pageNotes.querySelector(`.note[data-id="${CSS.escape(id)}"]`);

// Range une ligne dans la bonne liste (à faire ou terminées), à sa place
// dans l'ordre de création (les plus récentes en bas)
function placerLigne(li, note) {
  const liste = note.fait ? listeNotesFaites : listeNotes;
  const memes = notes.filter((n) => n.fait === note.fait);
  const suivantes = memes.slice(memes.indexOf(note) + 1);
  const avant = suivantes.map((n) => ligneDeNote(n.id)).find((l) => l && l.parentElement === liste);
  liste.insertBefore(li, avant || null);
  if (!liste.hidden) requestAnimationFrame(() => ajusterHauteur(li.querySelector(".note-texte")));
}

// Une ligne : cercle à cocher, texte modifiable sur place, « Supprimer »
function creerLigneNote(note) {
  const li = document.createElement("li");
  li.className = "note" + (note.fait ? " fait" : "");
  li.dataset.id = note.id;

  // Bouton rouge caché derrière la ligne (révélé en glissant vers la gauche)
  const supprimerGlisse = document.createElement("button");
  supprimerGlisse.type = "button";
  supprimerGlisse.className = "note-supprimer";
  supprimerGlisse.textContent = "Supprimer";
  supprimerGlisse.tabIndex = -1;
  supprimerGlisse.setAttribute("aria-hidden", "true");
  supprimerGlisse.addEventListener("click", () => supprimerNote(note.id));

  const glisse = document.createElement("div");
  glisse.className = "note-glisse";

  const cercle = document.createElement("button");
  cercle.type = "button";
  cercle.className = "note-cercle";
  cercle.setAttribute("role", "checkbox");
  cercle.setAttribute("aria-checked", String(note.fait));
  cercle.setAttribute("aria-label", note.fait ? "Remettre à faire" : "Marquer comme terminée");
  cercle.append(creerIcone(TRACE_CROCHET, "note-crochet"));
  cercle.addEventListener("click", () => basculerNote(note.id, li, cercle));

  const champ = document.createElement("textarea");
  champ.className = "note-texte";
  champ.rows = 1;
  champ.value = note.texte;
  champ.maxLength = LIMITES_NOTES.longueur;
  champ.enterKeyHint = "done";
  champ.autocomplete = "off";
  champ.setAttribute("autocapitalize", "sentences");
  champ.setAttribute("aria-label", "Texte de la note");
  champ.addEventListener("input", () => ajusterHauteur(champ));
  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key !== "Enter" || evenement.isComposing) return;
    evenement.preventDefault();
    champ.blur(); // valide (voir « blur » ci-dessous) et ferme le clavier
  });
  champ.addEventListener("focus", () => garderVisible(champ));
  // En quittant le champ : texte enregistré ; vidé → note supprimée
  champ.addEventListener("blur", () => modifierNote(note.id, champ.value));

  // Ordinateur : petit bouton « Supprimer » qui apparaît au survol
  const supprimerSurvol = document.createElement("button");
  supprimerSurvol.type = "button";
  supprimerSurvol.className = "note-supprimer-survol";
  supprimerSurvol.setAttribute("aria-label", `Supprimer la note : ${note.texte}`);
  supprimerSurvol.append(creerIcone("M6 6l12 12M18 6L6 18"));
  supprimerSurvol.addEventListener("click", () => supprimerNote(note.id));

  glisse.append(cercle, champ, supprimerSurvol);
  li.append(supprimerGlisse, glisse);
  brancherGlissement(li, glisse, supprimerGlisse);
  // Hauteur du texte (plusieurs lignes) une fois la ligne dans la page
  requestAnimationFrame(() => ajusterHauteur(champ));
  return li;
}

// Le champ prend la hauteur de son texte (plusieurs lignes si besoin)
function ajusterHauteur(champ) {
  champ.style.height = "auto";
  champ.style.height = `${champ.scrollHeight}px`;
}

// --- Ajouter ---
// Entrée : la note est créée, la ligne d'ajout se vide et reste prête
// juste dessous (le clavier ne se ferme pas) pour enchaîner.
function validerNouvelleNote() {
  const texte = nettoyerTexteNote(champNouvelleNote.value);
  champNouvelleNote.value = "";
  ajusterHauteur(champNouvelleNote);
  if (texte === "") return false; // ligne laissée vide : rien n'est créé
  if (notes.length >= LIMITES_NOTES.nombre) {
    annoncerNotes(`${LIMITES_NOTES.nombre} notes au maximum : supprimez des notes terminées.`);
    return false;
  }
  const note = { id: nouvelIdNote(), texte, fait: false, dateCreation: new Date().toISOString() };
  notes.push(note);
  try {
    sauvegarderNotes();
  } catch {
    notes.pop();
    champNouvelleNote.value = texte; // rien n'est perdu
    annoncerNotes("Impossible d'enregistrer : la mémoire de l'app est pleine.");
    return false;
  }
  listeNotes.append(creerLigneNote(note)); // en bas, juste au-dessus de la ligne d'ajout
  majEtatsNotes();
  return true;
}
champNouvelleNote.addEventListener("keydown", (evenement) => {
  if (evenement.key !== "Enter" || evenement.isComposing) return;
  evenement.preventDefault();
  validerNouvelleNote();
  garderVisible(champNouvelleNote);
});
champNouvelleNote.addEventListener("input", () => ajusterHauteur(champNouvelleNote));
champNouvelleNote.addEventListener("blur", validerNouvelleNote);
champNouvelleNote.addEventListener("focus", () => garderVisible(champNouvelleNote));
// Toucher n'importe où sur la ligne d'ajout (cercle compris) place le curseur
document.getElementById("notes-ligne-ajout").addEventListener("click", (evenement) => {
  if (evenement.target !== champNouvelleNote) champNouvelleNote.focus();
});

// --- Modifier ---
function modifierNote(id, valeur) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  const texte = nettoyerTexteNote(valeur);
  if (texte === note.texte) return;
  if (texte === "") {
    supprimerNote(id); // note vidée : supprimée (comme dans Rappels)
    return;
  }
  const ancien = note.texte;
  note.texte = texte;
  try {
    sauvegarderNotes();
  } catch {
    note.texte = ancien;
    annoncerNotes("Impossible d'enregistrer : la mémoire de l'app est pleine.");
  }
}

// --- Cocher / décocher ---
// Le cercle se remplit et le texte se barre tout de suite ; la note
// rejoint « Terminées » (ou revient en haut) un court instant après.
function basculerNote(id, li, cercle) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  note.fait = !note.fait;
  try {
    sauvegarderNotes();
  } catch {
    note.fait = !note.fait;
    annoncerNotes("Impossible d'enregistrer : la mémoire de l'app est pleine.");
    return;
  }
  li.classList.toggle("fait", note.fait);
  cercle.setAttribute("aria-checked", String(note.fait));
  cercle.setAttribute("aria-label", note.fait ? "Remettre à faire" : "Marquer comme terminée");
  // Après un court instant, la ligne change de liste (si elle n'a pas été
  // décochée entre-temps). Chaque ligne a son propre minuteur.
  clearTimeout(Number(li.dataset.minuteur));
  const deplacer = () => {
    const actuelle = notes.find((n) => n.id === id);
    if (!actuelle || !li.isConnected) return;
    if ((li.parentElement === listeNotesFaites) !== actuelle.fait) placerLigne(li, actuelle);
    majEtatsNotes();
  };
  if (sansAnimation.matches) deplacer();
  else li.dataset.minuteur = String(setTimeout(deplacer, 450));
}

// --- Supprimer (définitif) ---
function supprimerNote(id) {
  const avant = notes;
  notes = notes.filter((n) => n.id !== id);
  try {
    sauvegarderNotes();
  } catch {
    notes = avant;
    return;
  }
  const li = ligneDeNote(id);
  if (li) {
    if (li === ligneOuverte) ligneOuverte = null;
    li.remove();
  }
  majEtatsNotes();
}

// --- Glisser vers la gauche pour révéler « Supprimer » ---
// Le défilement vertical reste au navigateur (touch-action: pan-y en CSS) ;
// on ne suit le doigt que si le geste est surtout horizontal.
const LARGEUR_SUPPRIMER = 96;
let ligneOuverte = null;

function fermerLigneOuverte() {
  if (!ligneOuverte) return;
  ligneOuverte.classList.remove("ouverte");
  ligneOuverte.querySelector(".note-glisse").style.transform = "";
  const bouton = ligneOuverte.querySelector(".note-supprimer");
  bouton.style.width = "";
  bouton.tabIndex = -1;
  bouton.setAttribute("aria-hidden", "true");
  ligneOuverte = null;
}

function brancherGlissement(li, glisse, bouton) {
  let depart = null;   // { x, y, decalage } au moment où le doigt se pose
  let horizontal = false;
  let aGlisse = false;
  glisse.addEventListener("pointerdown", (evenement) => {
    aGlisse = false; // nouveau geste : un appui normal redevient possible
    if (evenement.pointerType === "mouse") return; // ordinateur : bouton au survol
    if (ligneOuverte && ligneOuverte !== li) fermerLigneOuverte();
    depart = { x: evenement.clientX, y: evenement.clientY, decalage: li.classList.contains("ouverte") ? -LARGEUR_SUPPRIMER : 0 };
    horizontal = false;
  });
  glisse.addEventListener("pointermove", (evenement) => {
    if (!depart) return;
    const dx = evenement.clientX - depart.x;
    const dy = evenement.clientY - depart.y;
    if (!horizontal) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      horizontal = true;
      aGlisse = true;
      try {
        glisse.setPointerCapture(evenement.pointerId); // le doigt peut sortir de la ligne
      } catch {
        // pas grave : on suit quand même le geste
      }
      glisse.classList.add("en-glissement");
      li.classList.add("en-glissement");
      if (document.activeElement && li.contains(document.activeElement)) document.activeElement.blur();
    }
    // La ligne suit le doigt ; le bouton rouge occupe exactement la place libérée
    const x = Math.min(0, Math.max(-LARGEUR_SUPPRIMER - 24, depart.decalage + dx));
    glisse.style.transform = `translateX(${x}px)`;
    bouton.style.width = `${-x}px`;
  });
  const finir = (evenement) => {
    if (!depart) return;
    glisse.classList.remove("en-glissement");
    li.classList.remove("en-glissement");
    if (horizontal) {
      const dx = evenement.clientX - depart.x;
      const ouvrir = depart.decalage + dx < -LARGEUR_SUPPRIMER / 2;
      if (ouvrir) {
        glisse.style.transform = `translateX(-${LARGEUR_SUPPRIMER}px)`;
        bouton.style.width = `${LARGEUR_SUPPRIMER}px`;
        li.classList.add("ouverte");
        bouton.tabIndex = 0;
        bouton.removeAttribute("aria-hidden");
        ligneOuverte = li;
      } else if (ligneOuverte === li) {
        fermerLigneOuverte();
      } else {
        glisse.style.transform = "";
        bouton.style.width = "";
      }
      // Le « clic » qui suit éventuellement le glissement est ignoré (voir
      // plus bas) ; passé ce court délai, les appuis refonctionnent
      setTimeout(() => { aGlisse = false; }, 300);
    }
    depart = null;
  };
  glisse.addEventListener("pointerup", finir);
  glisse.addEventListener("pointercancel", (evenement) => {
    // Le navigateur a pris la main (défilement vertical) : on remet en place
    if (!horizontal) {
      depart = null;
      return;
    }
    finir(evenement);
  });
  // Après un glissement, l'appui ne doit ni cocher ni ouvrir le clavier
  glisse.addEventListener("click", (evenement) => {
    if (aGlisse) {
      evenement.preventDefault();
      evenement.stopPropagation();
      aGlisse = false;
    }
  }, true);
}
// Toucher ailleurs referme la ligne ouverte
pageNotes.addEventListener("pointerdown", (evenement) => {
  if (ligneOuverte && !ligneOuverte.contains(evenement.target)) fermerLigneOuverte();
});

// --- Terminées (N) : repliée par défaut ---
basculeNotesFaites.addEventListener("click", () => {
  const ouverte = basculeNotesFaites.getAttribute("aria-expanded") === "true";
  basculeNotesFaites.setAttribute("aria-expanded", String(!ouverte));
  listeNotesFaites.hidden = ouverte;
  if (!ouverte) requestAnimationFrame(() => listeNotesFaites.querySelectorAll(".note-texte").forEach(ajusterHauteur));
});

// --- Menu « … » ---
function fermerMenuNotes() {
  menuNotes.hidden = true;
  boutonMenuNotes.setAttribute("aria-expanded", "false");
}
boutonMenuNotes.addEventListener("click", (evenement) => {
  evenement.stopPropagation();
  const ouvrir = menuNotes.hidden;
  menuNotes.hidden = !ouvrir;
  boutonMenuNotes.setAttribute("aria-expanded", String(ouvrir));
});
pageNotes.addEventListener("click", (evenement) => {
  if (!menuNotes.hidden && !menuNotes.contains(evenement.target)) fermerMenuNotes();
});

// Petit message en haut de la liste (« Copié »…), qui s'efface tout seul
let minuteurAnnonce = null;
function annoncerNotes(texte) {
  notesAnnonce.textContent = texte;
  notesAnnonce.hidden = false;
  clearTimeout(minuteurAnnonce);
  minuteurAnnonce = setTimeout(() => { notesAnnonce.hidden = true; }, 2500);
}

// « Copier les notes à faire » : un tiret par ligne
actionCopierNotes.addEventListener("click", async () => {
  fermerMenuNotes();
  const aFaire = notes.filter((n) => !n.fait);
  if (aFaire.length === 0) {
    annoncerNotes("Aucune note à faire à copier.");
    return;
  }
  const texte = aFaire.map((n) => `- ${n.texte}`).join("\n");
  let copie = false;
  try {
    await navigator.clipboard.writeText(texte);
    copie = true;
  } catch {
    // Ancien navigateur : copie via une zone de texte temporaire
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    pageNotes.append(zone);
    zone.select();
    try {
      copie = document.execCommand("copy");
    } catch {
      copie = false;
    }
    zone.remove();
  }
  annoncerNotes(copie ? `Copié (${aFaire.length} note${aFaire.length > 1 ? "s" : ""})` : "Impossible de copier sur cet appareil.");
});

// « Supprimer les notes terminées » (avec confirmation)
actionSupprimerFaites.addEventListener("click", () => {
  fermerMenuNotes();
  const faites = notes.filter((n) => n.fait).length;
  if (faites === 0) {
    annoncerNotes("Aucune note terminée.");
    return;
  }
  const texte = faites > 1 ? `Supprimer définitivement les ${faites} notes terminées ?` : "Supprimer définitivement la note terminée ?";
  if (!window.confirm(texte)) return;
  const avant = notes;
  notes = notes.filter((n) => !n.fait);
  try {
    sauvegarderNotes();
  } catch {
    notes = avant;
    return;
  }
  afficherNotes();
  annoncerNotes(faites > 1 ? `${faites} notes supprimées` : "Note supprimée");
});

// --- Clavier de l'iPhone : la ligne en cours reste visible ---
// Le clavier recouvre le bas de l'écran sans que la page rétrécisse :
// on fait défiler la page pour que le champ soit au-dessus du clavier.
function garderVisible(champ) {
  const vue = window.visualViewport;
  const verifier = () => {
    if (!pageNotes.open || document.activeElement !== champ) return;
    const bas = vue ? vue.height + vue.offsetTop : window.innerHeight;
    const boite = champ.getBoundingClientRect();
    if (boite.bottom > bas - 24) pageNotes.scrollBy({ top: boite.bottom - bas + 48 });
    else if (boite.top < 90) pageNotes.scrollBy({ top: boite.top - 110 });
  };
  verifier();
  setTimeout(verifier, 350); // après l'arrivée du clavier
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    const champ = document.activeElement;
    if (pageNotes.open && champ && pageNotes.contains(champ) && champ.matches("textarea")) garderVisible(champ);
  });
}
