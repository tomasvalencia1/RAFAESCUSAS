// Este service worker ya no se usa: la web no ofrece notificaciones del navegador
// (los avisos llegan por la APK). Algunos navegadores lo registraron en julio de
// 2026, cuando la web pedia permiso de notificaciones, y seguirian recibiendo
// avisos. Al actualizarse (el navegador lo hace solo al recibir un aviso) se
// desinstala: su suscripcion caduca y el despachador borra el token por si solo.
// No se borra el archivo porque un service worker instalado no se desinstala
// cuando su script deja de existir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
