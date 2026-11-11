// ============================================================
// relais/worker.js : petit relais pour l'import de recettes
// (à copier-coller dans un « Worker » Cloudflare, offre gratuite)
//
// Pourquoi un relais ? Le navigateur interdit à l'app de lire
// directement une page d'un autre site (règle « CORS »). Le relais
// va chercher la page à sa place et lui renvoie le HTML en texte.
//
// Ce que fait le relais :
// - il n'accepte que GET ?url=… venant de l'app (en-tête Origin) ;
// - il refuse tout ce qui n'est pas http(s), et les adresses locales
//   ou privées (localhost, 127.x, 10.x, 192.168.x, 169.254.x…) ;
// - il suit lui-même les redirections et revérifie chaque adresse ;
// - il abandonne au bout de 8 secondes et ne lit que les 2 premiers Mo ;
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
  async fetch(requete) {
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

    // 2. L'adresse demandée doit être sûre
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
