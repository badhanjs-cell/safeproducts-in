// SafeProducts service worker — caches last 10 search result responses.
const CACHE = "safeproducts-search-v1";
const MAX_ENTRIES = 10;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

async function trimCache() {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) {
    for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
      await cache.delete(keys[i]);
    }
  }
}

function isSearchRequest(url) {
  // Cache Supabase REST queries hitting product/search-related tables, plus app /search navigations.
  if (url.pathname.includes("/rest/v1/")) return true;
  if (url.pathname === "/search" || url.pathname.startsWith("/search?")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (!isSearchRequest(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone()).then(trimCache).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await cache.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
