// ============================================================
// recettes.js : tout ce qui concerne le contenu des fiches
// (recettes et cocktails), sans toucher à l'affichage :
// 1. lire une recette dans le HTML d'une page (bloc JSON-LD schema.org)
// 2. adapter les quantités des ingrédients au nombre de personnes
// 3. vérifier les champs d'une fiche venant d'un fichier de sauvegarde
// 4. ingrédients détaillés et photo gardée (fiches créées avec l'IA)
// Chargé avant ia.js et app.js (voir index.html).
// ============================================================

// Limites, pour qu'une page bizarre ne remplisse pas la mémoire du téléphone
const LIMITES_FICHE = {
  images: 10,
  longueurImage: 2000,
  ingredients: 150,
  longueurIngredient: 500,
  etapes: 100,
  longueurEtape: 3000,
  longueurTitre: 200,
  champCourt: 100, // verre, méthode, alcool de base
  portionsMax: 100,
  minutesMax: 10000,
  longueurUnite: 30,      // « c. à soupe », « g »… (ingrédients détaillés)
  quantiteMax: 100000,
  longueurPhoto: 400000,  // photo gardée dans la fiche (texte base64, ~300 Ko)
};

// Renvoie l'adresse si c'est un lien http(s), sinon null
// (refuse « javascript: », « data: »…). base : pour les adresses relatives.
function adresseHttp(texte, base) {
  if (typeof texte !== "string" || texte.length > LIMITES_FICHE.longueurImage) return null;
  try {
    const adresse = base ? new URL(texte.trim(), base) : new URL(texte.trim());
    if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
    return adresse.href;
  } catch {
    return null;
  }
}

// --- 1. Lire une recette dans une page --------------------------

// Texte sans HTML : « <b>200 g</b> de farine &amp; sucre » → « 200 g de farine & sucre ».
// DOMParser fabrique un document « inerte » : aucun script n'y est exécuté,
// aucune image n'y est chargée. On n'en garde que le texte brut.
function texteSimple(valeur) {
  if (typeof valeur === "number") return String(valeur);
  if (typeof valeur !== "string") return "";
  let texte = valeur;
  // Deux passages : certains sites encodent deux fois (&amp;eacute;)
  for (let passage = 0; passage < 2 && /<[a-z/!]|&[#a-z0-9]+;/i.test(texte); passage++) {
    texte = new DOMParser().parseFromString(texte, "text/html").body.textContent || "";
  }
  return texte.replace(/\s+/g, " ").trim();
}

// Premier texte trouvé dans une valeur JSON-LD (texte, nombre ou liste)
function premierTexte(valeur) {
  if (typeof valeur === "string" || typeof valeur === "number") return String(valeur);
  if (Array.isArray(valeur)) {
    for (const v of valeur) {
      const t = premierTexte(v);
      if (t) return t;
    }
  }
  return "";
}

// JSON.parse qui ne plante pas. Certains sites laissent des retours à la
// ligne dans leurs textes, ce qui est interdit en JSON : on les remplace.
function lireJson(texte) {
  try {
    return JSON.parse(texte);
  } catch {
    try {
      return JSON.parse(texte.replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      return null;
    }
  }
}

// Le bloc décrit-il une recette ? (@type "Recipe", ou une liste qui le contient)
function estRecette(objet) {
  const types = [].concat(objet["@type"] || []);
  return types.some((t) => typeof t === "string" && /(^|[/:])Recipe$/i.test(t));
}

// Cherche la recette dans les données JSON-LD : directement, dans une
// liste, dans @graph ou dans mainEntity (selon les sites)
function chercherRecette(valeur, profondeur = 0) {
  if (profondeur > 6 || valeur === null || typeof valeur !== "object") return null;
  if (Array.isArray(valeur)) {
    for (const v of valeur) {
      const trouvee = chercherRecette(v, profondeur + 1);
      if (trouvee) return trouvee;
    }
    return null;
  }
  if (estRecette(valeur)) return valeur;
  for (const cle of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const trouvee = chercherRecette(valeur[cle], profondeur + 1);
    if (trouvee) return trouvee;
  }
  return null;
}

// Images : une adresse, une liste d'adresses, un objet ImageObject { url }
// ou une liste de ces objets. On ne garde que les adresses http(s).
function lireImages(valeur, base, resultat = []) {
  if (!valeur || resultat.length >= LIMITES_FICHE.images) return resultat;
  if (typeof valeur === "string") {
    const adresse = adresseHttp(valeur, base);
    if (adresse && !resultat.includes(adresse)) resultat.push(adresse);
  } else if (Array.isArray(valeur)) {
    for (const v of valeur) lireImages(v, base, resultat);
  } else if (typeof valeur === "object") {
    lireImages(valeur.url || valeur.contentUrl, base, resultat);
  }
  return resultat;
}

// Ingrédients : une liste de textes (parfois un seul texte, ligne par ligne)
function lireIngredients(valeur) {
  let lignes = [];
  if (Array.isArray(valeur)) lignes = valeur;
  else if (typeof valeur === "string") lignes = valeur.split(/\n+/);
  return lignes
    .map((l) => texteSimple(typeof l === "string" ? l : premierTexte(l?.name ?? l?.text)))
    .filter((l) => l !== "")
    .slice(0, LIMITES_FICHE.ingredients)
    .map((l) => l.slice(0, LIMITES_FICHE.longueurIngredient));
}

// Une étape propre : sans « 1. » ou « Étape 2 : » au début (la liste est
// déjà numérotée), et sans « # » (réservé aux titres de section)
function nettoyerEtape(texte) {
  return texteSimple(texte)
    .replace(/^#+\s*/, "")
    .replace(/^(?:étape|etape|step)?\s*\d{1,2}\s*[.):–-]\s+/i, "")
    .slice(0, LIMITES_FICHE.longueurEtape);
}

// Un texte d'instructions d'un seul bloc : on le découpe en étapes
// (éléments de liste <li>, paragraphes, retours à la ligne)
function decouperInstructions(texte) {
  if (/<(li|p|br|div)\b/i.test(texte)) {
    const doc = new DOMParser().parseFromString(texte, "text/html");
    const puces = [...doc.querySelectorAll("li")].map((li) => li.textContent);
    if (puces.length > 0) return puces;
    for (const br of doc.querySelectorAll("br")) br.replaceWith("\n");
    for (const bloc of doc.querySelectorAll("p, div")) bloc.append("\n");
    texte = doc.body.textContent || "";
  }
  return texte.split(/\n+/);
}

// Étapes : texte simple, liste de textes, HowToStep { text }, ou
// HowToSection { name, itemListElement: [étapes] }.
// Un titre de section est rangé comme une ligne qui commence par « # ».
function lireEtapes(valeur, resultat = [], profondeur = 0) {
  if (profondeur > 5 || resultat.length >= LIMITES_FICHE.etapes || !valeur) return resultat;
  const ajouterEtape = (texte) => {
    const propre = nettoyerEtape(texte);
    if (propre && resultat.length < LIMITES_FICHE.etapes) resultat.push(propre);
  };
  if (typeof valeur === "string") {
    decouperInstructions(valeur).forEach(ajouterEtape);
  } else if (Array.isArray(valeur)) {
    for (const v of valeur) lireEtapes(v, resultat, profondeur + 1);
  } else if (typeof valeur === "object") {
    const types = [].concat(valeur["@type"] || []);
    const sousEtapes = valeur.itemListElement || valeur.steps;
    if (types.includes("HowToSection") || (sousEtapes && !valeur.text)) {
      const nom = nettoyerEtape(premierTexte(valeur.name));
      if (nom && resultat.length < LIMITES_FICHE.etapes) resultat.push(`# ${nom}`);
      lireEtapes(sousEtapes, resultat, profondeur + 1);
    } else {
      // HowToStep, HowToDirection… : son texte (ou à défaut son nom)
      ajouterEtape(premierTexte(valeur.text) || premierTexte(valeur.description) || premierTexte(valeur.name));
    }
  }
  return resultat;
}

// Portions : 4, "4", "4 personnes", "Pour 6 parts", ["4", "4 servings"]…
function lirePortions(valeur) {
  const valeurs = [].concat(valeur ?? []);
  for (const v of valeurs) {
    const trouve = String(v).match(/\d+/);
    const nombre = trouve ? Number(trouve[0]) : NaN;
    if (Number.isInteger(nombre) && nombre >= 1 && nombre <= LIMITES_FICHE.portionsMax) return nombre;
  }
  return undefined;
}

// Durée ISO 8601 → minutes : "PT1H30M" → 90, "P0DT0H20M" → 20
function dureeEnMinutes(valeur) {
  const texte = premierTexte(valeur).trim();
  const m = texte.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return undefined;
  const [, j = 0, h = 0, min = 0, s = 0] = m.map((x) => (x === undefined ? 0 : x));
  const total = Math.round(Number(j) * 1440 + Number(h) * 60 + Number(min) + Number(s) / 60);
  return total > 0 && total <= LIMITES_FICHE.minutesMax ? total : undefined;
}

// Point d'entrée : le HTML d'une page → la recette trouvée, ou null.
// Résultat : { titre, images, ingredients, etapes, portions,
//              tempsPreparation, tempsCuisson } (champs absents si inconnus)
function extraireRecette(html, adressePage) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
  for (const script of doc.querySelectorAll("script")) {
    const type = (script.getAttribute("type") || "").toLowerCase();
    if (!type.includes("ld+json")) continue;
    const brute = chercherRecette(lireJson(script.textContent));
    if (!brute) continue;
    try {
      const recette = {
        titre: texteSimple(premierTexte(brute.name)).slice(0, LIMITES_FICHE.longueurTitre),
        images: lireImages(brute.image, adressePage),
        ingredients: lireIngredients(brute.recipeIngredient ?? brute.ingredients),
        etapes: lireEtapes(brute.recipeInstructions),
        portions: lirePortions(brute.recipeYield ?? brute.yield),
        tempsPreparation: dureeEnMinutes(brute.prepTime),
        tempsCuisson: dureeEnMinutes(brute.cookTime),
      };
      // Une « recette » sans titre, ni ingrédient, ni étape ne sert à rien
      if (recette.titre || recette.ingredients.length || recette.etapes.length) return recette;
    } catch {
      // bloc mal formé : on essaie le suivant
    }
  }
  return null;
}

// --- 2. Adapter les quantités -----------------------------------

// Fractions écrites en un seul caractère
const FRACTIONS_UNICODE = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
  "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5, "⅙": 1 / 6,
  "⅚": 5 / 6, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};
const CAR_FRACTIONS = Object.keys(FRACTIONS_UNICODE).join("");
// Fractions « naturelles » à afficher quand le résultat tombe dessus
const FRACTIONS_SIMPLES = [["½", 1 / 2], ["¼", 1 / 4], ["¾", 3 / 4], ["⅓", 1 / 3], ["⅔", 2 / 3]];

// Un nombre au sens large, du plus long au plus court :
// « 1 1/2 », « 1½ », « 1/2 », « 1 000 », « 1,5 » / « 1.5 » / « 2 », « ½ »
const NOMBRE = `(?:\\d+[ \\u00a0]+\\d+[/⁄]\\d+|\\d+[ \\u00a0]?[${CAR_FRACTIONS}]|\\d+[/⁄]\\d+|\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?![\\d/⁄.,])|\\d+(?:[.,]\\d+)?|[${CAR_FRACTIONS}])`;
// Puce éventuelle en début de ligne (texte collé) : « - », « • », « * »…
const PUCE = `(?:[-–—•*·▪●◦]\\s*)?`;
// Au début de la ligne (après une puce) : un nombre, ou une plage « 2-3 »,
// « 2 à 3 », « 2 ou 3 ».
// Pas de pourcentage ni de degrés (« 70 % de cacao » ne change pas).
const MOTIF_QUANTITE = new RegExp(
  `^(\\s*${PUCE})(${NOMBRE})(?:(\\s*[-–—]\\s*|\\s+(?:à|ou|to)\\s+)(${NOMBRE}))?(?![\\d/⁄])(?!\\s*[%°])`
);
// Nombres écrits en lettres au début de la ligne : « une pincée », « deux œufs ».
// « un peu », « une demi… » et « un demi… » ne sont pas des quantités à multiplier.
const NOMBRES_EN_LETTRES = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
};
const MOTIF_MOT_QUANTITE = new RegExp(
  `^(\\s*${PUCE})(${Object.keys(NOMBRES_EN_LETTRES).join("|")})(?=\\s)(?!\\s+(?:peu|demie?|petit\\s+peu)(?![\\p{L}]))`,
  "iu"
);
// « Farine : 200 g », « Farine T55 : 200 g » : le nom avant les deux-points
// (assez court, ne commence pas par un chiffre)
const MOTIF_NOM_DEUX_POINTS = /^(\s*[^\s:\d][^:]{0,59}?\s?:\s*)(?=\S)/;

// Texte → nombre (NaN si illisible)
function lireNombre(texte) {
  const t = texte.replace(/[  ]/g, " ").trim();
  let m;
  if ((m = t.match(/^(\d+) +(\d+)[/⁄](\d+)$/))) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if ((m = t.match(new RegExp(`^(\\d+) ?([${CAR_FRACTIONS}])$`)))) return Number(m[1]) + FRACTIONS_UNICODE[m[2]];
  if ((m = t.match(/^(\d+)[/⁄](\d+)$/))) return Number(m[1]) / Number(m[2]);
  if (/^\d{1,3}( \d{3})+$/.test(t)) return Number(t.replace(/ /g, ""));
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (FRACTIONS_UNICODE[t] !== undefined) return FRACTIONS_UNICODE[t];
  return NaN;
}

// Nombre → texte, arrondi à 2 décimales.
// - fractions = true : « 1 ½ » plutôt que « 1,5 » quand c'est une fraction simple
// - separateur : « , » (français) ou « . » (si la recette l'utilisait)
function formaterNombre(x, fractions, separateur) {
  if (!Number.isFinite(x) || x <= 0) return null;
  let arrondi = Math.round(x * 100) / 100;
  if (arrondi === 0) arrondi = Number(x.toPrecision(1)); // très petite quantité
  const entier = Math.floor(arrondi + 1e-9);
  const reste = arrondi - entier;
  if (reste < 0.005) return String(entier);
  if (fractions) {
    for (const [car, valeur] of FRACTIONS_SIMPLES) {
      if (Math.abs(reste - valeur) < 0.02) return entier > 0 ? `${entier} ${car}` : car;
    }
  }
  return String(arrondi).replace(".", separateur);
}

// Adapte une ligne d'ingrédient. facteur = personnes voulues / portions d'origine.
// Renvoie { avant, quantite, apres } : la quantité adaptée est mise à part
// pour pouvoir l'afficher en gras. Sans quantité reconnue (« Sel, poivre »),
// quantite est vide et apres contient la ligne telle quelle.
// Ne lance jamais d'erreur : au moindre doute, la ligne reste intacte.
function adapterIngredient(ligne, facteur) {
  const intacte = { avant: "", quantite: "", apres: String(ligne ?? "") };
  try {
    if (typeof ligne !== "string" || !Number.isFinite(facteur) || facteur <= 0) return intacte;
    // 1. Quantité au début de la ligne (après une puce éventuelle)
    const debut = adapterDebut(ligne, facteur);
    if (debut) return debut;
    // 2. « Farine : 200 g » : quantité juste après les deux-points
    const nom = MOTIF_NOM_DEUX_POINTS.exec(ligne);
    if (nom) {
      const suite = adapterDebut(ligne.slice(nom[0].length), facteur);
      if (suite) return { ...suite, avant: nom[0] + suite.avant };
    }
    return intacte;
  } catch {
    return intacte;
  }
}

// Adapte la quantité écrite au début d'un texte (en chiffres ou en lettres).
// Renvoie { avant, quantite, apres }, ou null si aucune quantité n'est reconnue.
function adapterDebut(ligne, facteur) {
  const m = MOTIF_QUANTITE.exec(ligne);
  if (!m) return adapterMot(ligne, facteur);
  const [tout, espace, texte1, separateurPlage, texte2] = m;
  const n1 = lireNombre(texte1);
  const n2 = texte2 ? lireNombre(texte2) : null;
  if (!(n1 > 0 && Number.isFinite(n1))) return null;
  if (texte2 && !(n2 > 0 && Number.isFinite(n2))) return null;

  // Fractions dans l'original, ou petits nombres entiers (3 œufs → 1 ½) :
  // on écrit le résultat en fraction quand c'est naturel
  const enFraction = new RegExp(`[/⁄${CAR_FRACTIONS}]`).test(tout);
  const entiers = Number.isInteger(n1) && (n2 === null || Number.isInteger(n2));
  const separateur = /\d\.\d/.test(tout) ? "." : ",";
  const formater = (n) => {
    const x = n * facteur;
    return formaterNombre(x, enFraction || (entiers && x < 10), separateur);
  };
  const t1 = formater(n1);
  const t2 = texte2 ? formater(n2) : "";
  if (!t1 || (texte2 && !t2)) return null;
  return {
    avant: espace,
    quantite: texte2 ? `${t1}${separateurPlage}${t2}` : t1,
    apres: ligne.slice(tout.length),
  };
}

// « une pincée de sel » ×2 → « 2 pincée de sel » (le mot devient un nombre)
function adapterMot(ligne, facteur) {
  const m = MOTIF_MOT_QUANTITE.exec(ligne);
  if (!m) return null;
  const x = NOMBRES_EN_LETTRES[m[2].toLowerCase()] * facteur;
  const quantite = formaterNombre(x, x < 10, ",");
  if (!quantite) return null;
  return { avant: m[1], quantite, apres: ligne.slice(m[0].length) };
}

// Minutes → « 20 min », « 1 h », « 1 h 30 »
function formaterDuree(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

// --- 3. Vérifier les champs d'une fiche (fichier de sauvegarde) ---
// Renvoie un objet avec seulement les champs connus et valides ; lance
// une erreur avec un message clair si un champ est présent mais invalide.
// numero : « L'élément n°3 », pour le message.
function verifierChampsFiche(el, numero) {
  const propre = {};
  const listeDeTextes = (valeur, max, longueur, nom) => {
    if (!Array.isArray(valeur) || valeur.length > max ||
        valeur.some((x) => typeof x !== "string" || x.length > longueur)) {
      throw new Error(`${numero} a une liste ${nom} invalide.`);
    }
    return valeur.map((x) => x.trim()).filter((x) => x !== "");
  };
  const entier = (valeur, min, max, nom) => {
    if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
      throw new Error(`${numero} a ${nom} invalide.`);
    }
    return valeur;
  };
  const texteCourt = (valeur, nom) => {
    if (typeof valeur !== "string" || valeur.length > LIMITES_FICHE.champCourt) {
      throw new Error(`${numero} a ${nom} invalide.`);
    }
    return valeur.trim();
  };

  if (el.images !== undefined) {
    const images = listeDeTextes(el.images, LIMITES_FICHE.images, LIMITES_FICHE.longueurImage, "de photos");
    if (images.some((a) => !adresseHttp(a))) throw new Error(`${numero} a une adresse de photo invalide.`);
    if (images.length) propre.images = images.map((a) => adresseHttp(a));
  }
  if (el.ingredients !== undefined) {
    const liste = listeDeTextes(el.ingredients, LIMITES_FICHE.ingredients, LIMITES_FICHE.longueurIngredient, "d'ingrédients");
    if (liste.length) propre.ingredients = liste;
  }
  // Ingrédients détaillés (version 8) : une case par ligne d'ingrédient,
  // { q, u, n } ou null. Gardés seulement s'ils correspondent bien aux lignes.
  if (el.ingredientsDetail !== undefined) {
    const detail = el.ingredientsDetail;
    if (!Array.isArray(detail) || detail.length > LIMITES_FICHE.ingredients ||
        detail.some((d) => d !== null && !detailValide(d))) {
      throw new Error(`${numero} a une liste d'ingrédients détaillés invalide.`);
    }
    if (propre.ingredients && detail.length === propre.ingredients.length && detail.some(Boolean)) {
      propre.ingredientsDetail = detail.map((d) => (d ? { q: d.q, u: d.u.trim(), n: d.n.trim() } : null));
    }
  }
  // Photo gardée dans la fiche (version 11) : identifiant de la photo rangée
  // dans IndexedDB (photos.js) ; l'image elle-même est à part dans le fichier
  if (el.photoId !== undefined) {
    if (typeof el.photoId !== "string" || !/^p-[a-z0-9]{6,40}$/.test(el.photoId)) {
      throw new Error(`${numero} a un identifiant de photo invalide.`);
    }
    propre.photoId = el.photoId;
  }
  // Ancienne forme (versions 8 à 10) : l'image JPEG écrite en texte dans la
  // fiche ; l'app la range dans IndexedDB après l'import
  if (el.photoPerso !== undefined) {
    if (!photoPersoValide(el.photoPerso)) throw new Error(`${numero} a une photo invalide.`);
    propre.photoPerso = el.photoPerso;
  }
  if (el.etapes !== undefined) {
    const liste = listeDeTextes(el.etapes, LIMITES_FICHE.etapes, LIMITES_FICHE.longueurEtape, "d'étapes");
    if (liste.length) propre.etapes = liste;
  }
  if (el.portions !== undefined) propre.portions = entier(el.portions, 1, LIMITES_FICHE.portionsMax, "un nombre de portions");
  if (el.tempsPreparation !== undefined) propre.tempsPreparation = entier(el.tempsPreparation, 1, LIMITES_FICHE.minutesMax, "un temps de préparation");
  if (el.tempsCuisson !== undefined) propre.tempsCuisson = entier(el.tempsCuisson, 1, LIMITES_FICHE.minutesMax, "un temps de cuisson");
  for (const [cle, nom] of [["verre", "un verre"], ["methode", "une méthode"], ["alcoolBase", "un alcool de base"]]) {
    if (el[cle] !== undefined) {
      const texte = texteCourt(el[cle], nom);
      if (texte) propre[cle] = texte;
    }
  }
  return propre;
}

// Noms des champs de fiche (pour les copier d'un objet à l'autre)
const CHAMPS_FICHE = [
  "images", "ingredients", "etapes", "portions", "tempsPreparation", "tempsCuisson",
  "verre", "methode", "alcoolBase",
  "ingredientsDetail", "photoPerso", // fiches créées avec l'IA (v1.12)
  "photoId", // photo rangée dans IndexedDB (v1.19), remplace photoPerso
];

// --- 4. Ingrédients détaillés et photo gardée (fiches créées avec l'IA) ---
// L'IA donne chaque ingrédient en trois morceaux : quantité, unité, nom.
// On les range dans « ingredientsDetail », à côté de la ligne de texte
// habituelle (« ingredients ») : { q: 200, u: "g", n: "de farine" }.
// La case vaut null pour une ligne sans quantité (« Sel, poivre »).
// La ligne de texte reste la référence : si elle est modifiée à la main,
// son détail est oublié et l'app relit la quantité au début de la ligne.

// Unités « métriques » : on écrit 1,5 kg plutôt que 1 ½ kg
const UNITES_METRIQUES = /^(mg|g|kg|ml|cl|dl|l|cm)\.?$/i;

function detailValide(d) {
  return typeof d === "object" && d !== null &&
    typeof d.q === "number" && Number.isFinite(d.q) && d.q > 0 && d.q <= LIMITES_FICHE.quantiteMax &&
    typeof d.u === "string" && d.u.length <= LIMITES_FICHE.longueurUnite &&
    typeof d.n === "string" && d.n.length <= LIMITES_FICHE.longueurIngredient;
}

function photoPersoValide(texte) {
  const debut = "data:image/jpeg;base64,";
  return typeof texte === "string" && texte.length <= LIMITES_FICHE.longueurPhoto &&
    texte.startsWith(debut) && /^[A-Za-z0-9+/]+=*$/.test(texte.slice(debut.length));
}

// Quantité d'un ingrédient détaillé, écrite proprement (« 1 ½ », « 0,75 »)
function formaterQuantite(q, unite) {
  return formaterNombre(q, !UNITES_METRIQUES.test(unite.trim()), ",");
}

// { q: 0.5, u: "c. à soupe", n: "de sucre" } → « ½ c. à soupe de sucre »
function ligneDepuisDetail(d) {
  return [formaterQuantite(d.q, d.u), d.u.trim(), d.n.trim()].filter(Boolean).join(" ");
}

// Même résultat qu'adapterIngredient, à partir du détail : la quantité
// multipliée par le facteur, mise à part pour l'afficher en gras.
function adapterDetail(d, facteur) {
  try {
    if (!detailValide(d) || !Number.isFinite(facteur) || facteur <= 0) return null;
    const quantite = formaterQuantite(d.q * facteur, d.u);
    if (!quantite) return null;
    const reste = [d.u.trim(), d.n.trim()].filter(Boolean).join(" ");
    return { avant: "", quantite, apres: reste ? ` ${reste}` : "" };
  } catch {
    return null;
  }
}

// Après une modification des lignes d'ingrédients : chaque ligne restée
// identique garde son détail, une ligne modifiée ou nouvelle n'en a plus.
// Renvoie undefined s'il ne reste aucun détail.
function detailPourLignes(lignes, anciennesLignes, ancienDetail) {
  if (!Array.isArray(ancienDetail) || !Array.isArray(anciennesLignes)) return undefined;
  const correspondances = new Map();
  anciennesLignes.forEach((ligne, i) => {
    if (ancienDetail[i] && !correspondances.has(ligne)) correspondances.set(ligne, ancienDetail[i]);
  });
  const detail = lignes.map((ligne) => correspondances.get(ligne) || null);
  return detail.some(Boolean) ? detail : undefined;
}
