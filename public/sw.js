// Installable app shell + phone alerts (web push). Offline caching comes in a later phase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A Nearest alert arrived (new booking request, reminder, message…): show it like a text.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Nearest", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Nearest";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || "/" },
  }));
});

// Tapping the alert opens the page it's about (or focuses Nearest if it's already open).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { if (w.url.startsWith(self.location.origin) && "focus" in w) { await w.focus(); if ("navigate" in w) await w.navigate(url); return; } }
    await self.clients.openWindow(url);
  })());
});

// The browser replaced the alert subscription: tell Nearest the new one so alerts keep coming.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const key = await (await fetch("/api/push/key")).json();
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key.publicKey });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
    } catch (e) { /* they can turn alerts on again from Notifications */ }
  })());
});
