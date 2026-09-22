/**
 * Hors-ligne minimal : réseau d'abord, cache en secours.
 *
 * Volontairement pas de « cache d'abord » : un calendrier de collecte périmé
 * est pire que pas de calendrier du tout. Le cache ne sert que si le réseau
 * manque — dans ce cas l'utilisateur voit des données récentes plutôt qu'une
 * page blanche.
 */

const CACHE = "sortirlebac-v1";
const SOCLE = ["/", "/secteurs.json", "/manifest.webmanifest", "/icone.svg"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SOCLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  // L'API de calendrier et le géocodage ne doivent jamais être servis du cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(requete, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(requete).then((trouve) => trouve ?? caches.match("/"))),
  );
});
