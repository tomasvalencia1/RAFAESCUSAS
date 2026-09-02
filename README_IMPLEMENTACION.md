# Implementación de comunidad — RafaConecta

La aplicación existente usa **Firebase Realtime Database (RTDB)**, no Firestore. Por eso las colecciones solicitadas se implementaron como nodos RTDB y las reglas consolidadas están en `database.rules.json`.

## Archivos y responsabilidades

- `index.html`: enlace al Vanilla CSS Design System, modales de confirmación/soporte/moderación, botón flotante de soporte, compositor y lista de anuncios docentes.
- `styles.css`: tokens claros y reglas de reemplazo flat para las tarjetas, navegación, modales y los nuevos componentes. No elimina el CSS anterior para no romper vistas que aún dependen de él.
- `app.js`: feed por seguimiento, vencimiento inmediato a las 24 horas, publicaciones marcadas, follow, comentarios en `posts/{postId}/comentarios`, soporte, anuncios de profesores y panel de moderación.
- `database.rules.json`: único bloque de reglas RTDB para los nodos nuevos y los ya utilizados por la app.
- `.github/workflows/cleanup-expired-posts.yml` y `functions/cleanup-expired-posts.cjs`: limpieza programada gratis por GitHub Actions, sin Cloud Functions.
- `.github/workflows/send-relevant-notifications.yml` y `functions/send-relevant-notifications.cjs`: notificaciones FCM gratuitas por GitHub Actions para chats, noticias, eventos, anuncios, publicaciones de personas seguidas y solicitudes de soporte.
- `APK_NOTIFICACIONES_ANDROID.md`: única integración nativa necesaria para que la APK obtenga su token FCM y reciba notificaciones en segundo plano.
- `functions/index.js`: alternativa opcional para quien habilite Cloud Functions/Blaze; no es necesaria para la solución gratuita.
- `design-preview.html`: pantalla estática antes/después para validar el diseño.

## Modelo RTDB añadido

- `posts/{postId}` agrega `createdAt`, `authorRole`, `flagged` y `reason`. Los posts nuevos de estudiantes se ocultan al cumplir 24 horas.
- `posts/{postId}/comentarios/{commentId}` guarda `autorId`, `autorNombre`, `texto` y `timestamp`. Se sigue leyendo `comments` como ruta heredada para no perder comentarios anteriores.
- `siguiendo/{seguidorId}/{seguidoId}` guarda la relación de seguimiento. Por ser RTDB, el feed combina el stream de posts y este nodo en el cliente; RTDB no ofrece el OR/indexado de Firestore pedido originalmente.
- `mensajes_profesor/{YYYY-MM-DD}/{profesorId}/{1..3}` reserva tres slots inmutables diarios. Esto permite imponer el máximo de tres también en reglas RTDB.
- `configuracion/moderacion/palabrasProhibidas` admite un array u objeto de palabras y solo una cuenta registrada en `admins/{uid}` puede editarlo. Si no existe usa una lista mínima local.
- `logs_moderacion/{logId}` recibe una entrada atómica cuando un administrador borra un post desde el panel o feed.
- `soporte/{ticketId}` crea tickets con estado inicial `pendiente`.

## Firebase: pasos manuales necesarios

1. Las reglas de **Realtime Database** ya fueron publicadas en el proyecto `rafaescusas` el 30 de agosto de 2026. `database.rules.json` es la fuente de verdad para cambios posteriores. No pegar reglas de Firestore: este proyecto no las usa.
2. La limpieza horaria no requiere Blaze: el workflow `Limpiar publicaciones estudiantiles vencidas` de GitHub Actions está incluido. En Firebase Console → Configuración del proyecto → Cuentas de servicio, genera una **nueva clave privada JSON**. En GitHub → repositorio → Settings → Secrets and variables → Actions, crea el secreto `FIREBASE_SERVICE_ACCOUNT` y pega allí el contenido completo del JSON. Nunca subas ese archivo ni lo pegues en código.
3. Después abre GitHub → Actions → `Limpiar publicaciones estudiantiles vencidas` → **Run workflow**. Si finaliza correctamente, cada hora eliminará físicamente los posts de estudiantes con más de 24 horas. El horario se ejecuta en UTC (minuto 17 de cada hora).
4. El workflow usa runners estándar de GitHub. En repositorios públicos son gratuitos; en privados consume la cuota mensual incluida de GitHub Free. No usa plan de pago de Firebase.
5. Mientras el secreto no esté configurado, el cliente sigue ocultando posts vencidos inmediatamente. Cada usuario puede eliminar físicamente **solo sus propias publicaciones**; un **administrador** registrado en `admins/{uid}` puede eliminar cualquier publicación y es el único que puede eliminar comentarios.
6. RTDB Rules puede imponer roles, campos, tamaño del texto y exactamente tres slots diarios, pero no puede separar una cadena en palabras. El contador de 15 palabras se valida en vivo en el cliente. La alternativa de Cloud Functions queda disponible, pero ya no es necesaria.
7. No se requieren índices compuestos: RTDB usa este modelo de rutas y no índices compuestos de Firestore. Si se agregan consultas con `orderByChild`, crear el índice RTDB correspondiente en las reglas.
8. Las notificaciones relevantes usan el mismo secreto `FIREBASE_SERVICE_ACCOUNT` ya configurado para la limpieza. Después de subir el repositorio, abre GitHub → Actions → `Enviar notificaciones relevantes` → **Run workflow** una vez. La primera ejecución crea una referencia y no envía contenido histórico; desde la siguiente, GitHub lo ejecuta aproximadamente cada cinco minutos. Las notificaciones no incluyen el texto de chat para proteger la privacidad en la pantalla bloqueada.
