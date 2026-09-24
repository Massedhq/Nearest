// Phase 1: installable app shell only. Offline caching comes in a later phase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
