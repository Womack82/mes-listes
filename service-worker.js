// ============================================================
// service-worker.js : garde une copie des fichiers de l'app
// pour qu'elle s'ouvre même sans connexion internet.
// ============================================================

// Change ce numéro à chaque modification des fichiers, sinon le
// téléphone continuera d'utiliser l'ancienne copie :
// chaque changement ajoute 1 au second numéro : v1.1 → v1.2 → v1.3…
// ⚠️ Change aussi VERSION en haut de app.js (affichée à côté du logo).
const NOM_CACHE = "mes-listes-v1.11";

// ⚠️ Si un seul de ces fichiers est introuvable, rien n'est mis en cache
// (l'app ne marchera pas hors ligne) : vérifier chaque chemin.
const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "recettes.js",
  "app.js",
  "manifest.json",
  // Logo et icônes (dossier icons)
  "icons/logo-w.svg",
  "icons/logo-w-clair.svg",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-32.png",
  "icons/tmdb.svg",
];

// À l'installation : on met tous les fichiers en cache
self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_CACHE).then((cache) => cache.addAll(FICHIERS))
  );
  self.skipWaiting();
});

// À l'activation : on supprime les anciens caches (v1 quand v2 arrive, etc.)
self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== NOM_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// À chaque demande de fichier : on sert la copie en cache si elle existe,
// sinon on va la chercher sur internet.
self.addEventListener("fetch", (evenement) => {
  // Les demandes vers d'autres sites (TMDB, RAWG, relais des recettes, photos) ne passent
  // pas par le cache : le navigateur s'en occupe normalement.
  if (new URL(evenement.request.url).origin !== self.location.origin) return;
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request))
  );
});
