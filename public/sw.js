/*
 * Service worker de BLEND.
 *
 * Hace una sola cosa: recibir notificaciones push y enseñarlas, y abrir la
 * página correcta al tocarlas. No guarda nada en caché a propósito: el menú y
 * los precios cambian desde /equipo y una copia vieja en el teléfono
 * enseñaría precios que ya no son.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "BLEND";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Si la tienda ya está abierta en una pestaña, se reutiliza.
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
