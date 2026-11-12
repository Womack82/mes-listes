// ============================================================
// relais/worker.js : petit relais de l'app Wodo
// (à copier-coller dans un « Worker » Cloudflare, offre gratuite)
//
// Deux services :
// 1. Import de recettes : GET /?url=… renvoie le HTML d'une page.
//    Le navigateur interdit à l'app de lire directement une page d'un
//    autre site (règle « CORS ») : le relais la lit à sa place.
// 2. Jeux vidéo (IGDB, base de jeux de Twitch) :
//    GET /igdb/recherche?q=titre → liste de jeux
//    GET /igdb/jeu?id=123        → détail d'un jeu
//    Les identifiants IGDB restent secrets dans Cloudflare (variables
//    IGDB_CLIENT_ID et IGDB_CLIENT_SECRET) : l'app ne les voit jamais.
//
// Ce que fait le relais :
// - il ne répond qu'à l'app (en-tête Origin) et seulement en GET ;
// - import : il refuse tout ce qui n'est pas http(s), et les adresses
//   locales ou privées (localhost, 127.x, 10.x, 192.168.x, 169.254.x…),
//   suit lui-même les redirections et revérifie chaque adresse ;
// - il abandonne au bout de 8 secondes ; import : 2 premiers Mo au plus ;
// - IGDB : il demande un jeton à Twitch, le garde en mémoire jusqu'à son
//   expiration et en redemande un tout seul ;
// - il ne stocke rien et n'écrit aucun journal (pas de console.log).
// ============================================================

// Origines autorisées : l'app publiée, et l'app lancée sur le PC pour les tests
const ORIGINES_AUTORISEES = [
  "https://womack82.github.io",
  "http://localhost:8000",
];

const DELAI_MAX_MS = 8000;               // 8 secondes
const TAILLE_MAX = 2 * 1024 * 1024;      // 2 Mo
const REDIRECTIONS_MAX = 5;
const LONGUEUR_URL_MAX = 2048;

export default {
  // env : les variables et secrets du Worker (IGDB_CLIENT_ID, IGDB_CLIENT_SECRET)
  async fetch(requete, env) {
    // 1. Seule l'app a le droit d'utiliser le relais
    const origine = requete.headers.get("Origin");
    if (!ORIGINES_AUTORISEES.includes(origine)) {
      return new Response("Origine refusée.", { status: 403 });
    }
    const enTetesCors = {
      "Access-Control-Allow-Origin": origine,
      "Vary": "Origin",
    };

    // Question préalable du navigateur (« preflight ») : on répond oui pour GET
    if (requete.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...enTetesCors,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (requete.method !== "GET") {
      return reponseErreur(405, "Seul GET est accepté.", enTetesCors);
    }

    // Jeux vidéo (IGDB)
    const chemin = new URL(requete.url).pathname.replace(/\/+$/, "");
    if (chemin.startsWith("/igdb")) {
      return routeIgdb(chemin, new URL(requete.url).searchParams, env || {}, enTetesCors);
    }

    // 2. Import de recettes : l'adresse demandée doit être sûre
    const texteUrl = new URL(requete.url).searchParams.get("url") || "";
    if (texteUrl.length > LONGUEUR_URL_MAX) {
      return reponseErreur(400, "Adresse trop longue.", enTetesCors);
    }
    let adresse = adresseSure(texteUrl);
    if (!adresse) {
      return reponseErreur(400, "Adresse refusée.", enTetesCors);
    }

    // 3. On va chercher la page (8 secondes au plus, lecture comprise)
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), DELAI_MAX_MS);
    try {
      let reponse;
      for (let essai = 0; ; essai++) {
        reponse = await fetch(adresse.href, {
          redirect: "manual", // on suit les redirections nous-mêmes, pour les vérifier
          signal: controle.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; RecipeImporter/1.0)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
          },
        });
        if (![301, 302, 303, 307, 308].includes(reponse.status)) break;
        if (essai >= REDIRECTIONS_MAX) {
          return reponseErreur(508, "Trop de redirections.", enTetesCors);
        }
        const suivante = reponse.headers.get("Location");
        adresse = suivante ? adresseSure(new URL(suivante, adresse).href) : null;
        if (!adresse) {
          return reponseErreur(400, "Redirection refusée.", enTetesCors);
        }
      }

      if (!reponse.ok) {
        return reponseErreur(502, "La page n'a pas pu être récupérée.", enTetesCors);
      }
      const typeContenu = reponse.headers.get("Content-Type") || "";
      if (typeContenu && !/text\/html|application\/xhtml\+xml/i.test(typeContenu)) {
        return reponseErreur(415, "Ce n'est pas une page web.", enTetesCors);
      }

      const octets = await lireAuPlus(reponse.body, TAILLE_MAX);
      const html = decoder(octets, typeContenu);
      return new Response(html, {
        status: 200,
        headers: {
          ...enTetesCors,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Délai dépassé, site injoignable… (aucun détail, aucun journal)
      return reponseErreur(504, "La page n'a pas répondu à temps.", enTetesCors);
    } finally {
      clearTimeout(minuteur);
    }
  },
};

function reponseErreur(statut, texte, enTetesCors) {
  return new Response(texte, {
    status: statut,
    headers: { ...enTetesCors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Renvoie l'adresse (objet URL) si elle est sûre, sinon null.
// Refusé : autre chose que http(s), identifiants dans l'adresse, port
// inhabituel, noms locaux (localhost, .local…), adresses IP privées ou
// réservées, et toutes les adresses IPv6 écrites en chiffres.
// (Un nom de domaine qui pointerait vers une adresse privée ne peut pas
// être vérifié ici, mais Cloudflare n'a de toute façon pas accès aux
// réseaux privés.)
function adresseSure(texte) {
  let adresse;
  try {
    adresse = new URL(texte);
  } catch {
    return null;
  }
  if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
  if (adresse.username || adresse.password) return null;
  if (adresse.port !== "") return null; // seulement les ports normaux (80, 443)

  const hote = adresse.hostname.toLowerCase().replace(/\.$/, "");
  if (hote === "" || !hote.includes(".")) return null; // « localhost », « intranet »…
  if (hote.startsWith("[")) return null;                // IPv6 en chiffres
  if (/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(hote)) return null;

  // IPv4 en chiffres (l'objet URL a déjà converti 0x7f.1 ou 2130706433 en 127.0.0.1)
  const ipv4 = hote.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 0 ||                            // 0.x
      a === 10 ||                           // 10.x (privé)
      a === 127 ||                          // 127.x (cet ordinateur)
      (a === 100 && b >= 64 && b <= 127) || // 100.64.x (opérateurs)
      (a === 169 && b === 254) ||           // 169.254.x (lien local)
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16.x à 172.31.x (privé)
      (a === 192 && b === 0) ||             // 192.0.x (réservé)
      (a === 192 && b === 168) ||           // 192.168.x (box internet)
      (a === 198 && (b === 18 || b === 19)) || // 198.18.x (tests)
      a >= 224                              // multidiffusion et réservé
    ) return null;
  }
  return adresse;
}

// Lit le contenu de la page, en s'arrêtant à « max » octets
async function lireAuPlus(flux, max) {
  if (!flux) return new Uint8Array(0);
  const lecteur = flux.getReader();
  const morceaux = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await lecteur.read();
    if (done) break;
    const morceau = value.byteLength > max - total ? value.subarray(0, max - total) : value;
    morceaux.push(morceau);
    total += morceau.byteLength;
  }
  if (total >= max) await lecteur.cancel().catch(() => {});
  const octets = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, position);
    position += morceau.byteLength;
  }
  return octets;
}

// Transforme les octets en texte avec le bon encodage (pour les accents) :
// celui annoncé par le site, sinon celui écrit dans la page (<meta charset>),
// sinon UTF-8.
function decoder(octets, typeContenu) {
  let encodage = (/charset=["']?([\w-]+)/i.exec(typeContenu) || [])[1];
  if (!encodage) {
    const debut = latin1(octets.subarray(0, 4096));
    encodage = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(debut) || [])[1];
  }
  encodage = (encodage || "utf-8").toLowerCase();
  try {
    return new TextDecoder(encodage).decode(octets);
  } catch {
    // Encodage inconnu de Cloudflare : les anciens encodages « occidentaux »
    // se lisent octet par octet ; tout le reste en UTF-8
    if (/^(iso-8859-1|iso-8859-15|latin1|windows-1252|cp1252)$/.test(encodage)) return latin1(octets);
    return new TextDecoder("utf-8").decode(octets);
  }
}

function latin1(octets) {
  let texte = "";
  for (let i = 0; i < octets.length; i += 8192) {
    texte += String.fromCharCode.apply(null, octets.subarray(i, i + 8192));
  }
  return texte;
}

// ============================================================
// Jeux vidéo : IGDB (api.igdb.com/v4), avec un jeton Twitch
// ============================================================

const ADRESSE_JETON_TWITCH = "https://id.twitch.tv/oauth2/token";
const ADRESSE_IGDB = "https://api.igdb.com/v4/games";
const ADRESSE_JAQUETTES = "https://images.igdb.com/igdb/image/upload/t_cover_big/";
const LONGUEUR_RECHERCHE_MAX = 100;
const RESULTATS_MAX = 10;

// Jeton Twitch gardé en mémoire tant que ce Worker tourne :
// { valeur, expire (millisecondes) }. Cloudflare redémarre parfois le
// Worker : on redemande alors simplement un jeton.
let jetonEnCache = null;
let jetonEnCours = null; // demande en cours (évite d'en lancer plusieurs)

async function jetonTwitch(env) {
  // Encore valable au moins 5 minutes : on le réutilise
  if (jetonEnCache && jetonEnCache.expire - Date.now() > 5 * 60 * 1000) return jetonEnCache.valeur;
  if (!jetonEnCours) {
    jetonEnCours = (async () => {
      const adresse = new URL(ADRESSE_JETON_TWITCH);
      adresse.searchParams.set("client_id", env.IGDB_CLIENT_ID);
      adresse.searchParams.set("client_secret", env.IGDB_CLIENT_SECRET);
      adresse.searchParams.set("grant_type", "client_credentials");
      const reponse = await avecDelai((signal) => fetch(adresse.href, { method: "POST", signal }));
      if (!reponse.ok) throw new Error("jeton refusé");
      const donnees = await reponse.json();
      if (typeof donnees.access_token !== "string" || !donnees.access_token) throw new Error("jeton absent");
      const duree = Number(donnees.expires_in) > 0 ? Number(donnees.expires_in) : 3600; // en secondes
      jetonEnCache = { valeur: donnees.access_token, expire: Date.now() + duree * 1000 };
      return jetonEnCache.valeur;
    })().finally(() => { jetonEnCours = null; });
  }
  return jetonEnCours;
}

// Une requête IGDB (langage « Apicalypse »). Si le jeton n'est plus
// accepté (401), on en redemande un et on réessaie une fois.
async function demanderIgdb(env, requeteIgdb) {
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonTwitch(env);
    const reponse = await avecDelai((signal) => fetch(ADRESSE_IGDB, {
      method: "POST",
      signal,
      headers: {
        "Client-ID": env.IGDB_CLIENT_ID,
        "Authorization": `Bearer ${jeton}`,
        "Accept": "application/json",
        "Content-Type": "text/plain",
      },
      body: requeteIgdb,
    }));
    if (reponse.status === 401 && essai === 0) {
      jetonEnCache = null; // jeton expiré ou révoqué
      continue;
    }
    if (!reponse.ok) throw new Error(`IGDB a répondu ${reponse.status}`);
    const donnees = await reponse.json();
    return Array.isArray(donnees) ? donnees : [];
  }
  throw new Error("jeton refusé");
}

// Abandon au bout de 8 secondes
async function avecDelai(appel) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MAX_MS);
  try {
    return await appel(controle.signal);
  } finally {
    clearTimeout(minuteur);
  }
}

// Un jeu IGDB → le format renvoyé à l'app (seulement des textes et nombres)
function convertirJeu(jeu, detail = false) {
  const texte = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
  const noms = (liste) => (Array.isArray(liste) ? liste.map((x) => texte(x && x.name, 80)).filter(Boolean).slice(0, 12) : []);
  const date = Number(jeu.first_release_date);
  const imageId = jeu.cover && typeof jeu.cover.image_id === "string" && /^[a-z0-9]+$/i.test(jeu.cover.image_id)
    ? jeu.cover.image_id : null;
  const resultat = {
    id: Number.isInteger(jeu.id) ? jeu.id : null,
    nom: texte(jeu.name),
    annee: Number.isFinite(date) && date > 0 ? new Date(date * 1000).getUTCFullYear() : null,
    plateformes: noms(jeu.platforms),
    genres: noms(jeu.genres),
    jaquette: imageId ? `${ADRESSE_JAQUETTES}${imageId}.jpg` : null,
  };
  if (detail) {
    resultat.resume = texte(jeu.summary, 3000);
    resultat.developpeurs = Array.isArray(jeu.involved_companies)
      ? jeu.involved_companies.filter((c) => c && c.developer).map((c) => texte(c.company && c.company.name, 80)).filter(Boolean).slice(0, 5)
      : [];
    resultat.lien = typeof jeu.url === "string" && jeu.url.startsWith("https://www.igdb.com/") ? jeu.url : null;
  }
  return resultat;
}

const CHAMPS_JEU = "name,first_release_date,platforms.name,genres.name,cover.image_id";

async function routeIgdb(chemin, parametres, env, enTetesCors) {
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) {
    return reponseErreur(503, "Relais non configuré pour les jeux (secrets IGDB manquants).", enTetesCors);
  }
  let requeteIgdb;
  let detail = false;
  if (chemin === "/igdb/recherche") {
    // Titre nettoyé : sans guillemets ni barres obliques inverses (qui
    // casseraient la requête IGDB), sans caractères de contrôle
    const titre = (parametres.get("q") || "").replace(/["\\\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim()
      .slice(0, LONGUEUR_RECHERCHE_MAX);
    if (titre === "") return reponseErreur(400, "Titre manquant.", enTetesCors);
    requeteIgdb = `search "${titre}"; fields ${CHAMPS_JEU}; where version_parent = null; limit ${RESULTATS_MAX};`;
  } else if (chemin === "/igdb/jeu") {
    const id = Number(parametres.get("id"));
    if (!Number.isInteger(id) || id <= 0 || id > 1e10) return reponseErreur(400, "Identifiant invalide.", enTetesCors);
    requeteIgdb = `fields ${CHAMPS_JEU},summary,url,involved_companies.developer,involved_companies.company.name; where id = ${id}; limit 1;`;
    detail = true;
  } else {
    return reponseErreur(404, "Route inconnue.", enTetesCors);
  }

  let jeux;
  try {
    jeux = await demanderIgdb(env, requeteIgdb);
  } catch {
    // Délai dépassé, IGDB ou Twitch injoignable, jeton refusé… (aucun détail)
    return reponseErreur(502, "IGDB ne répond pas pour le moment.", enTetesCors);
  }
  const corps = detail
    ? (jeux[0] ? convertirJeu(jeux[0], true) : null)
    : jeux.map((j) => convertirJeu(j)).filter((j) => j.id !== null && j.nom);
  if (detail && !corps) return reponseErreur(404, "Jeu introuvable.", enTetesCors);
  return new Response(JSON.stringify(corps), {
    status: 200,
    headers: {
      ...enTetesCors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
