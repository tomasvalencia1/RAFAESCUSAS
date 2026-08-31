# Implementación de comunidad — RafaConecta

La aplicación existente usa **Firebase Realtime Database (RTDB)**, no Firestore. Por eso las colecciones solicitadas se implementaron como nodos RTDB y las reglas consolidadas están en `database.rules.json`.

## Archivos y responsabilidades

- `index.html`: enlace al Vanilla CSS Design System, modales de confirmación/soporte/moderación, botón flotante de soporte, compositor y lista de anuncios docentes.
- `styles.css`: tokens claros y reglas de reemplazo flat para las tarjetas, navegación, modales y los nuevos componentes. No elimina el CSS anterior para no romper vistas que aún dependen de él.
- `app.js`: feed por seguimiento, vencimiento inmediato a las 24 horas, publicaciones marcadas, follow, comentarios en `posts/{postId}/comentarios`, soporte, anuncios de profesores y panel de moderación.
- `database.rules.json`: único bloque de reglas RTDB para los nodos nuevos y los ya utilizados por la app.
- `functions/index.js`: limpieza programada horaria y defensa posterior para anuncios docentes inválidos.
- `design-preview.html`: pantalla estática antes/después para validar el diseño.

## Modelo RTDB añadido

- `posts/{postId}` agrega `createdAt`, `authorRole`, `flagged` y `reason`. Los posts nuevos de estudiantes se ocultan al cumplir 24 horas.
- `posts/{postId}/comentarios/{commentId}` guarda `autorId`, `autorNombre`, `texto` y `timestamp`. Se sigue leyendo `comments` como ruta heredada para no perder comentarios anteriores.
- `siguiendo/{seguidorId}/{seguidoId}` guarda la relación de seguimiento. Por ser RTDB, el feed combina el stream de posts y este nodo en el cliente; RTDB no ofrece el OR/indexado de Firestore pedido originalmente.
- `mensajes_profesor/{YYYY-MM-DD}/{profesorId}/{1..3}` reserva tres slots inmutables diarios. Esto permite imponer el máximo de tres también en reglas RTDB.
- `configuracion/moderacion/palabrasProhibidas` admite un array u objeto de palabras y solo un directivo puede editarlo. Si no existe usa una lista mínima local.
- `logs_moderacion/{logId}` recibe una entrada atómica al borrar un post desde el panel o feed.
- `soporte/{ticketId}` crea tickets con estado inicial `pendiente`.

## Firebase: pasos manuales necesarios

1. Las reglas de **Realtime Database** ya fueron publicadas en el proyecto `rafaescusas` el 30 de agosto de 2026. `database.rules.json` es la fuente de verdad para cambios posteriores. No pegar reglas de Firestore: este proyecto no las usa.
2. Para la limpieza física horaria y la verificación defensiva de 15 palabras, las dependencias de `functions/` ya están instaladas y bloqueadas en `package-lock.json`. Falta activar el plan **Blaze** en `rafaescusas`: Firebase rechazó el despliegue porque Cloud Scheduler/Artifact Registry no están disponibles en Spark. Luego ejecuta `firebase deploy --only functions` desde la raíz; `.firebaserc` ya selecciona ese proyecto.
3. Mientras Functions no esté desplegado, el cliente oculta los posts vencidos inmediatamente. Si un **directivo** abre el feed, también intenta limpiarlos físicamente; no se concede ese borrado a estudiantes por seguridad.
4. RTDB Rules puede imponer roles, campos, tamaño del texto y exactamente tres slots diarios, pero no puede separar una cadena en palabras. El contador de 15 palabras se valida en vivo en el cliente y `enforceTeacherMessagePolicy` lo verifica del lado servidor tras desplegar Functions.
5. No se requieren índices compuestos: RTDB usa este modelo de rutas y no índices compuestos de Firestore. Si se agregan consultas con `orderByChild`, crear el índice RTDB correspondiente en las reglas.
