// ============================================================
// service-worker.js : garde une copie des fichiers de l'app
// pour qu'elle s'ouvre même sans connexion internet.
// ============================================================

// Change ce numéro (v2, v3...) à chaque modification des fichiers,
// sinon le téléphone continuera d'utiliser l'ancienne copie.
const NOM_CACHE = "mes-listes-v8";

const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.json",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
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
  // Les demandes vers d'autres sites (TMDB : recherche, affiches) ne passent
  // pas par le cache : le navigateur s'en occupe normalement.
  if (new URL(evenement.request.url).origin !== self.location.origin) return;
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request))
  );
});
