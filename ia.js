// ============================================================
// ia.js : créer une fiche (recette, cocktail) avec l'IA Gemini (Google)
// à partir de photos et / ou d'un texte collé.
// Ce fichier ne s'occupe pas de l'affichage (voir app.js) :
// 1. la clé et le modèle Gemini (gardés sur l'appareil) ;
// 2. réduire les photos dans le navigateur avant l'envoi ;
// 3. appeler Gemini (une seule requête avec tout) ;
// 4. vérifier et nettoyer la réponse.
// Chargé après recettes.js et avant app.js (voir index.html).
//
// Sécurité :
// - la clé est envoyée dans l'en-tête « x-goog-api-key », jamais dans
//   l'adresse ; elle n'apparaît dans aucun message ni aucun journal ;
// - rien n'est envoyé sans un appui sur « Analyser » ou « Revérifier » ;
// - tout le texte renvoyé par Gemini est nettoyé (aucun HTML) et
//   affiché avec textContent par app.js.
// ============================================================

// --- 1. Clé et modèle -------------------------------------------
const CLE_GEMINI = "mes-listes-cle-gemini";
const CLE_MODELE_GEMINI = "mes-listes-modele-gemini";
// Rapide et peu coûteux ; modifiable dans Réglages → IA (Gemini)
const MODELE_GEMINI_DEFAUT = "gemini-3.5-flash";
const ADRESSE_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";
const DELAI_GEMINI = 45000; // 45 secondes

const LIMITES_IA = {
  photos: 6,
  cote: 1600,                       // côté le plus long des photos envoyées
  qualite: 0.8,                     // JPEG
  tailleTotale: 8 * 1024 * 1024,    // ~8 Mo pour toutes les photos
  texte: 20000,                     // caractères du texte collé
  coteGardee: 800,                  // photo gardée dans la fiche
  qualiteGardee: 0.7,
  avertissements: 12,
  longueurAvertissement: 400,
  longueurNotes: 1000,
};

function lireCleGemini() {
  try {
    return localStorage.getItem(CLE_GEMINI) || "";
  } catch {
    return "";
  }
}

function lireModeleGemini() {
  try {
    return localStorage.getItem(CLE_MODELE_GEMINI) || MODELE_GEMINI_DEFAUT;
  } catch {
    return MODELE_GEMINI_DEFAUT;
  }
}

// « models/gemini-3.5-flash » ou « gemini-3.5-flash » → « gemini-3.5-flash » ;
// null si le nom contient des caractères inattendus
function nettoyerNomModele(texte) {
  const nom = String(texte || "").trim().replace(/^models\//, "");
  return /^[a-z0-9][a-z0-9.\-]{0,79}$/i.test(nom) ? nom : null;
}

// Une erreur avec un code simple (« cle », « quota »…) : app.js en tire
// un message clair. Jamais de détail technique, jamais la clé.
class ErreurIa extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const MESSAGE_ILLISIBLE = "Je n'ai pas réussi à lire cette recette, réessayez avec des photos plus nettes.";
const MESSAGES_IA = {
  "pas-de-cle": "Ajoutez d'abord votre clé Gemini dans Réglages → IA (Gemini).",
  cle: "Gemini refuse la clé enregistrée. Vérifiez-la dans Réglages → IA (Gemini).",
  quota: "Limite d'utilisation de Gemini atteinte (quota). Réessayez dans un moment ou demain.",
  modele: "Le modèle Gemini choisi n'existe pas (ou plus). Changez-le dans Réglages → IA (Gemini).",
  region: "Gemini refuse la demande avec cette clé (offre non disponible pour ce compte ou ce pays).",
  surcharge: "Gemini est surchargé pour le moment. Réessayez dans quelques instants.",
  reseau: "Impossible de joindre Gemini. Vérifiez la connexion internet.",
  delai: "Gemini n'a pas répondu dans les 45 secondes. Réessayez, peut-être avec moins de photos.",
  annule: "Analyse annulée. Rien n'a été perdu.",
  requete: "Gemini n'a pas accepté la demande. Essayez avec d'autres photos ou un texte plus court.",
  image: "Impossible de lire cette image sur cet appareil (format non pris en charge).",
  illisible: MESSAGE_ILLISIBLE,
};
const messageIa = (erreur) => MESSAGES_IA[erreur && erreur.code] || MESSAGE_ILLISIBLE;

// --- 2. Réduire une photo -----------------------------------------
// Redessine l'image dans un « canvas » (une zone de dessin invisible) au
// plus « cote » pixels de côté, puis l'enregistre en JPEG. Résultat : un
// fichier bien plus léger (souvent 200 à 500 Ko au lieu de 3 à 5 Mo).
async function reduireImage(source, cote, qualite) {
  let image = null;
  let adresse = null;
  try {
    try {
      // « from-image » : respecte le sens de la photo (portrait / paysage)
      image = await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      // Vieux navigateur : on passe par une balise <img>
      adresse = URL.createObjectURL(source);
      image = new Image();
      image.src = adresse;
      await image.decode();
    }
    const largeur = image.naturalWidth || image.width;
    const hauteur = image.naturalHeight || image.height;
    if (!largeur || !hauteur) throw new ErreurIa("image");
    const echelle = Math.min(1, cote / Math.max(largeur, hauteur));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(largeur * echelle));
    canvas.height = Math.max(1, Math.round(hauteur * echelle));
    const dessin = canvas.getContext("2d");
    dessin.fillStyle = "#ffffff"; // fond blanc sous une image transparente (PNG)
    dessin.fillRect(0, 0, canvas.width, canvas.height);
    dessin.drawImage(image, 0, 0, canvas.width, canvas.height);
    const fichier = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
    if (!fichier) throw new ErreurIa("image");
    return fichier;
  } catch (erreur) {
    throw erreur instanceof ErreurIa ? erreur : new ErreurIa("image");
  } finally {
    if (image && typeof image.close === "function") image.close();
    if (adresse) URL.revokeObjectURL(adresse);
  }
}

// Fichier → texte « data:image/jpeg;base64,… »
function fichierEnDataUrl(fichier) {
  return new Promise((ok, echec) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result));
    lecteur.onerror = () => echec(new ErreurIa("image"));
    lecteur.readAsDataURL(fichier);
  });
}

// Photo gardée dans la fiche : réduite (JPEG), rangée ensuite dans
// IndexedDB par app.js (photos.js). Lance ErreurIa("image") si illisible.
async function photoPourFiche(fichier) {
  return reduireImage(fichier, LIMITES_IA.coteGardee, LIMITES_IA.qualiteGardee);
}

// --- 3. Appeler Gemini --------------------------------------------
// Forme exacte de la réponse demandée à Gemini (JSON strict)
const SCHEMA_FICHE_IA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["recette", "cocktail"] },
    titre: { type: "STRING" },
    portions: { type: "INTEGER", nullable: true },
    tempsPreparation: { type: "INTEGER", nullable: true, description: "en minutes" },
    tempsCuisson: { type: "INTEGER", nullable: true, description: "en minutes (recette seulement)" },
    verre: { type: "STRING" },
    methode: { type: "STRING" },
    alcoolBase: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          quantite: { type: "NUMBER", nullable: true },
          unite: { type: "STRING" },
          nom: { type: "STRING" },
        },
        required: ["quantite", "unite", "nom"],
        propertyOrdering: ["quantite", "unite", "nom"],
      },
    },
    etapes: { type: "ARRAY", items: { type: "STRING" } },
    notes: { type: "STRING" },
    avertissements: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["type", "titre", "portions", "tempsPreparation", "tempsCuisson", "verre", "methode",
    "alcoolBase", "ingredients", "etapes", "notes", "avertissements"],
  propertyOrdering: ["type", "titre", "portions", "tempsPreparation", "tempsCuisson", "verre", "methode",
    "alcoolBase", "ingredients", "etapes", "notes", "avertissements"],
};

// Règles communes aux deux consignes (format de la réponse)
const REGLES_FORMAT_IA = `Règles de format :
- Réponds uniquement avec le JSON demandé, en français (garde le nom d'origine de la recette).
- Information absente ou illisible : "" pour un texte, null pour un nombre, [] pour une liste. Ne devine jamais.
- ingredients : un objet par ingrédient. "quantite" est un nombre (1/2 → 0.5 ; 1 1/2 → 1.5) ou null s'il n'y a pas de quantité. Pour une fourchette (« 2 à 3 »), mets "quantite" à null et écris tout dans "nom" (« 2 à 3 gousses d'ail »). "unite" : l'unité (g, kg, ml, cl, l, c. à café, c. à soupe, pincée…) ou "". "nom" : la suite, comme on l'écrirait après l'unité (« de farine », « œufs »).
- etapes : une étape par élément, dans l'ordre, sans numéro au début. Un titre de partie s'écrit "# Titre".
- Temps en minutes. portions : nombre de personnes (ou de verres pour un cocktail).
- Recette : "verre", "methode" et "alcoolBase" vides. Cocktail : "tempsCuisson" à null ; "verre" (tumbler, coupe…), "methode" (shaker, direct dans le verre, verre à mélange…), "alcoolBase" (rhum, gin…).
- notes : conseils, variantes ou remarques présents dans les sources, sinon "".
- avertissements : phrases courtes en français (texte illisible, information douteuse, conflit…), sinon [].`;

const CONSIGNE_ANALYSE_IA = `Tu lis une recette de cuisine ou de cocktail à partir de photos et / ou d'un texte collé.
Ces éléments décrivent une seule recette (ou un seul cocktail). Fusionne-les, ne duplique pas les informations, et n'invente rien.
En cas de contradiction entre une photo et le texte collé, garde la valeur du texte collé et signale le conflit dans "avertissements".
${REGLES_FORMAT_IA}`;

const CONSIGNE_REVERIFICATION_IA = `Voici une fiche de recette (ou de cocktail) au format JSON, déjà relue par une personne.
Corrige les fautes d'orthographe, harmonise les unités (g, kg, ml, cl, l, c. à café, c. à soupe…), mets les étapes dans un ordre logique et signale dans "avertissements" toute incohérence (ingrédient utilisé dans les étapes mais absent de la liste, quantité étrange, temps manquant…).
N'invente rien : n'ajoute aucun ingrédient ni aucune étape, ne change pas les quantités (sauf pour convertir une unité), garde le titre, le type et les notes.
${REGLES_FORMAT_IA}`;

// Code d'erreur à partir de la réponse HTTP de Gemini
function codeErreurGemini(statut, corps) {
  const etat = corps && corps.error ? String(corps.error.status || "") : "";
  const texte = corps && corps.error ? String(corps.error.message || "") : "";
  if (statut === 401 || statut === 403 || etat === "PERMISSION_DENIED" || etat === "UNAUTHENTICATED") return "cle";
  if (statut === 400 && /api[ _-]?key/i.test(texte)) return "cle";
  if (statut === 400 && etat === "FAILED_PRECONDITION") return "region";
  if (statut === 404) return "modele";
  if (statut === 429 || etat === "RESOURCE_EXHAUSTED") return "quota";
  if (statut >= 500) return "surcharge";
  return "requete";
}

// Un appel à Gemini, avec délai maximum et possibilité d'annuler.
// - chemin : « :generateContent » ou "" (simple vérification du modèle)
// - signalAnnuler : le bouton « Annuler » d'app.js
async function requeteGemini({ cle, modele, chemin = "", corps = null, signalAnnuler = null }) {
  const controle = new AbortController();
  let delaiDepasse = false;
  const minuteur = setTimeout(() => {
    delaiDepasse = true;
    controle.abort();
  }, DELAI_GEMINI);
  const annuler = () => controle.abort();
  if (signalAnnuler) {
    if (signalAnnuler.aborted) controle.abort();
    signalAnnuler.addEventListener("abort", annuler);
  }
  const raisonArret = () => (delaiDepasse ? "delai" : signalAnnuler && signalAnnuler.aborted ? "annule" : null);
  try {
    let reponse;
    try {
      reponse = await fetch(ADRESSE_GEMINI + encodeURIComponent(modele) + chemin, {
        method: corps ? "POST" : "GET",
        headers: corps
          ? { "Content-Type": "application/json", "x-goog-api-key": cle }
          : { "x-goog-api-key": cle },
        body: corps ? JSON.stringify(corps) : undefined,
        signal: controle.signal,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    } catch {
      throw new ErreurIa(raisonArret() || "reseau");
    }
    let donnees = null;
    try {
      donnees = await reponse.json();
    } catch {
      if (raisonArret()) throw new ErreurIa(raisonArret());
      donnees = null;
    }
    if (!reponse.ok) throw new ErreurIa(codeErreurGemini(reponse.status, donnees));
    if (donnees === null) throw new ErreurIa("illisible");
    return donnees;
  } finally {
    clearTimeout(minuteur);
    if (signalAnnuler) signalAnnuler.removeEventListener("abort", annuler);
  }
}

// Vérifie une clé et un modèle (Réglages) : ne renvoie rien si tout va bien,
// sinon lance ErreurIa (« cle », « modele », « reseau »…)
async function verifierGemini(cle, modele) {
  await requeteGemini({ cle, modele });
}

// Envoie les morceaux (textes, photos) avec une consigne ; renvoie l'objet JSON
async function demanderFicheGemini(morceaux, consigne, signalAnnuler) {
  const cle = lireCleGemini();
  if (!cle) throw new ErreurIa("pas-de-cle");
  const donnees = await requeteGemini({
    cle,
    modele: lireModeleGemini(),
    chemin: ":generateContent",
    signalAnnuler,
    corps: {
      systemInstruction: { parts: [{ text: consigne }] },
      contents: [{ role: "user", parts: morceaux }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: SCHEMA_FICHE_IA,
      },
    },
  });
  const candidat = Array.isArray(donnees.candidates) ? donnees.candidates[0] : null;
  if (!candidat || !candidat.content || !Array.isArray(candidat.content.parts)) throw new ErreurIa("illisible");
  const texte = candidat.content.parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, ""); // au cas où le JSON serait entouré de ```
  const objet = lireJson(texte);
  if (!objet || typeof objet !== "object" || Array.isArray(objet)) throw new ErreurIa("illisible");
  return objet;
}

// Analyse : photos (fichiers JPEG déjà réduits) et texte collé, dans l'ordre d'ajout
async function analyserAvecGemini({ type, photos, texte }, signalAnnuler) {
  const morceaux = [{ text: `Catégorie choisie dans l'app : ${type}.` }];
  for (let i = 0; i < photos.length; i++) {
    const dataUrl = await fichierEnDataUrl(photos[i]);
    morceaux.push({ text: `Photo ${i + 1} :` });
    morceaux.push({ inlineData: { mimeType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) } });
  }
  if (texte) morceaux.push({ text: `Texte collé :\n${texte}` });
  const brut = await demanderFicheGemini(morceaux, CONSIGNE_ANALYSE_IA, signalAnnuler);
  const fiche = nettoyerFicheIa(brut, type);
  if (!fiche) throw new ErreurIa("illisible");
  return fiche;
}

// Revérification : la fiche telle qu'elle est dans le brouillon (texte seulement)
async function reverifierAvecGemini(fiche, signalAnnuler) {
  const morceaux = [{ text: `Fiche à revérifier :\n${JSON.stringify(fiche)}` }];
  const brut = await demanderFicheGemini(morceaux, CONSIGNE_REVERIFICATION_IA, signalAnnuler);
  const propre = nettoyerFicheIa(brut, fiche.type);
  if (!propre) throw new ErreurIa("illisible");
  return propre;
}

// --- 4. Vérifier et nettoyer la réponse -----------------------------
// Ne garde que des champs connus, de la bonne forme, dans les limites de
// l'app. Renvoie null si rien d'utile n'a été trouvé.
// Résultat : { type, titre, portions, tempsPreparation, tempsCuisson,
//   verre, methode, alcoolBase, ingredients: [{ ligne, detail }],
//   etapes: [textes], notes, avertissements: [textes] }
function nettoyerFicheIa(brut, typeDemande) {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const texte = (valeur, max) => (typeof valeur === "string" || typeof valeur === "number" ? texteSimple(String(valeur)).slice(0, max) : "");
  const entier = (valeur, max) => {
    const nombre = Math.round(typeof valeur === "string" ? Number(valeur) : valeur);
    return Number.isFinite(nombre) && nombre >= 1 && nombre <= max ? nombre : undefined;
  };
  const liste = (valeur) => (Array.isArray(valeur) ? valeur : []);

  const ingredients = liste(brut.ingredients).slice(0, LIMITES_FICHE.ingredients).map((ing) => {
    if (typeof ing === "string") {
      const ligne = texte(ing, LIMITES_FICHE.longueurIngredient);
      return ligne ? { ligne, detail: null } : null;
    }
    if (typeof ing !== "object" || ing === null) return null;
    const q = typeof ing.quantite === "string" ? Number(ing.quantite.replace(",", ".")) : ing.quantite;
    const u = texte(ing.unite, LIMITES_FICHE.longueurUnite);
    const n = texte(ing.nom, LIMITES_FICHE.longueurIngredient);
    const detail = typeof q === "number" && Number.isFinite(q) && q > 0 && q <= LIMITES_FICHE.quantiteMax
      ? { q: Math.round(q * 1000) / 1000, u, n }
      : null;
    const ligne = (detail ? ligneDepuisDetail(detail) : [u, n].filter(Boolean).join(" "))
      .slice(0, LIMITES_FICHE.longueurIngredient);
    if (!ligne) return null;
    // Une ligne coupée ne correspond plus à son détail : on oublie le détail
    return { ligne, detail: detail && ligne === ligneDepuisDetail(detail) ? detail : null };
  }).filter(Boolean);

  // Étapes : « # Titre » reste un titre de partie ; les autres perdent leur
  // numéro éventuel (la liste est déjà numérotée)
  const etapes = liste(brut.etapes).map((etape) => {
    const brute = texte(etape, LIMITES_FICHE.longueurEtape);
    if (brute.startsWith("#")) {
      const titre = brute.replace(/^#+\s*/, "");
      return titre ? `# ${titre}` : "";
    }
    return nettoyerEtape(brute);
  }).filter(Boolean).slice(0, LIMITES_FICHE.etapes);

  const fiche = {
    type: brut.type === "recette" || brut.type === "cocktail" ? brut.type : typeDemande,
    titre: texte(brut.titre, LIMITES_FICHE.longueurTitre),
    portions: entier(brut.portions, LIMITES_FICHE.portionsMax),
    tempsPreparation: entier(brut.tempsPreparation, LIMITES_FICHE.minutesMax),
    tempsCuisson: entier(brut.tempsCuisson, LIMITES_FICHE.minutesMax),
    verre: texte(brut.verre, LIMITES_FICHE.champCourt),
    methode: texte(brut.methode, LIMITES_FICHE.champCourt),
    alcoolBase: texte(brut.alcoolBase, LIMITES_FICHE.champCourt),
    ingredients,
    etapes,
    notes: texte(brut.notes, LIMITES_IA.longueurNotes),
    avertissements: liste(brut.avertissements)
      .map((a) => texte(a, LIMITES_IA.longueurAvertissement))
      .filter(Boolean)
      .slice(0, LIMITES_IA.avertissements),
  };
  if (!fiche.titre && fiche.ingredients.length === 0 && fiche.etapes.length === 0) return null;
  return fiche;
}
