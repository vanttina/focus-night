self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("focus-night-v1").then((cache) =>
      cache.addAll([
        "./",
        "./today.html",
        "./focus.html",
        "./styles.css",
        "./app.js"
      ])
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
