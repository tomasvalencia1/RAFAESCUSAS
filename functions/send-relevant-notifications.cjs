/*
 * Despachador gratuito de notificaciones para GitHub Actions.
 *
 * Lee la Realtime Database con Firebase Admin, envia notificaciones FCM y
 * registra los eventos ya enviados. El JSON de la cuenta de servicio existe
 * solo en el secreto FIREBASE_SERVICE_ACCOUNT de GitHub Actions, nunca en este
 * repositorio.
 *
 * Se ejecuta cada pocos minutos, asi que esta pensado para descargar lo minimo:
 * solo lo creado desde la ultima ejecucion (consultas por fecha, que requieren
 * los .indexOn de database.rules.json) y los nodos auxiliares solo si hacen falta.
 * El plan gratuito de Firebase tiene un limite de descarga mensual; descargar la
 * base entera en cada ejecucion lo agotaria y dejaria la app sin servicio.
 *
 * Modo de prueba: si se define PRUEBA_UID, envia UNA notificacion de prueba solo
 * a los dispositivos de esa cuenta y termina, sin tocar el estado del despachador.
 */
const { cert, initializeApp, deleteApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

const DATABASE_URL = 'https://rafaescusas-default-rtdb.firebaseio.com';
const STATE_PATH = 'notificacionesSistema/despachador';
const MAX_SENT_AGE_MS = 35 * 24 * 60 * 60 * 1000;
// Los timestamps los pone el reloj del telefono que escribe. Si va algo atrasado,
// el evento quedaria por debajo de la ultima ejecucion y nunca se enviaria. Se
// revisa este margen hacia atras; los duplicados los evita el registro `sent`.
const MARGEN_RELOJ_MS = 10 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    // Anotacion visible en el resumen de la ejecucion, sin marcarla como fallida.
    console.log('::error::Falta el secreto FIREBASE_SERVICE_ACCOUNT. Configúralo en GitHub > Settings > Secrets and variables > Actions.');
    return null;
  }
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido.'); }
}

function safeKey(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 700);
}

function asEntries(value) {
  return Object.entries(value || {});
}

// Clave de dia 'AAAA-MM-DD' (en UTC) con la que se agrupan los avisos del profesorado.
function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function readNode(db, path) {
  return (await db.ref(path).once('value')).val() || {};
}

// Elementos de `path` cuyo hijo `field` es >= `since`. Con el .indexOn
// correspondiente el filtrado ocurre en el servidor y solo viaja lo nuevo.
async function readSince(db, path, field, since) {
  return (await db.ref(path).orderByChild(field).startAt(since).once('value')).val() || {};
}

function flattenTeacherMessages(root) {
  const items = [];
  for (const [day, byTeacher] of asEntries(root)) {
    for (const [teacherId, slots] of asEntries(byTeacher)) {
      for (const [slot, message] of asEntries(slots)) {
        items.push({ id: `${day}_${teacherId}_${slot}`, value: message || {} });
      }
    }
  }
  return items;
}

function flattenChatMessages(chats) {
  const items = [];
  for (const [chatId, chat] of asEntries(chats)) {
    for (const [messageId, message] of asEntries(chat?.messages)) {
      items.push({ id: `${chatId}_${messageId}`, chat: chat || {}, value: message || {} });
    }
  }
  return items;
}

function tokenEntriesForUsers(tokensByUser, userIds) {
  const entries = [];
  for (const uid of new Set(userIds.filter(Boolean))) {
    for (const [tokenKey, token] of asEntries(tokensByUser?.[uid])) {
      if (typeof token === 'string' && token) entries.push({ uid, tokenKey, token });
    }
  }
  return entries;
}

async function sendToUsers({ tokensByUser, userIds, title, body, type, entityId }) {
  const entries = tokenEntriesForUsers(tokensByUser, userIds);
  if (!entries.length) return { delivered: 0, invalid: [], failed: 0 };

  const invalid = [];
  let delivered = 0;
  let failed = 0;
  for (let start = 0; start < entries.length; start += 500) {
    const batch = entries.slice(start, start + 500);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch.map(item => item.token),
      notification: { title, body },
      data: { type, entityId: String(entityId || '') },
      android: {
        priority: 'high',
        notification: { channelId: 'rafa_importante', sound: 'default' }
      },
      webpush: {
        notification: { icon: '/logo.png', badge: '/logo.png' },
        fcmOptions: { link: 'https://rafaexcusas.vercel.app/' }
      }
    });

    response.responses.forEach((result, index) => {
      if (result.success) { delivered += 1; return; }
      const code = result.error?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalid.push(batch[index]);
      } else {
        failed += 1;
        console.warn(`FCM no entregó una notificación (${code || 'error desconocido'}): ${result.error?.message || ''}`);
      }
    });
  }
  return { delivered, invalid, failed };
}

async function sendTestNotification(db, uid) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    console.log('::error::PRUEBA_UID no es un ID de cuenta válido.');
    process.exitCode = 1;
    return;
  }
  const tokens = await readNode(db, `fcmTokens/${uid}`);
  const count = Object.keys(tokens).length;
  console.log(`Prueba: ${count} dispositivo(s) registrado(s) para la cuenta ${uid}.`);
  if (!count) {
    console.log('::warning::Esa cuenta no tiene ningún teléfono registrado. Abre la APK, inicia sesión y acepta el permiso de notificaciones; después repite la prueba.');
    return;
  }
  const result = await sendToUsers({
    tokensByUser: { [uid]: tokens }, userIds: [uid],
    title: 'Prueba de RafaConecta',
    body: 'Si ves este aviso, las notificaciones funcionan.',
    type: 'test', entityId: 'prueba'
  });
  console.log(`Prueba: ${result.delivered} entregada(s), ${result.failed} con error, ${result.invalid.length} token(s) caducado(s).`);
  if (result.invalid.length) {
    const updates = {};
    for (const entry of result.invalid) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
    await db.ref().update(updates);
    console.log('::warning::Había tokens caducados (por ejemplo, de una reinstalación). Se borraron; abre la APK para que registre uno nuevo.');
  }
  if (!result.delivered) process.exitCode = 1;
}

async function dispatchNotifications(db) {
  const runStartedAt = Date.now();
  const state = await readNode(db, STATE_PATH);
  const lastProcessedAt = Number(state.lastProcessedAt || 0);

  // En la primera ejecucion se fija una linea base en lugar de inundar todos los
  // dispositivos con chats y publicaciones historicos.
  if (!lastProcessedAt) {
    await db.ref().update({
      [`${STATE_PATH}/lastProcessedAt`]: runStartedAt,
      [`${STATE_PATH}/initializedAt`]: runStartedAt
    });
    console.log('Notificaciones inicializadas. Los eventos anteriores no se enviaron.');
    return;
  }

  const since = lastProcessedAt - MARGEN_RELOJ_MS;
  const sent = state.sent || {};

  // Solo lo nuevo. Las publicaciones se crean con `createdAt` o con `timestamp`
  // segun la version de la app, asi que se consultan los dos campos.
  const [tokensByUser, news, events, support, chats, postsA, postsB, teacherRoot] = await Promise.all([
    readNode(db, 'fcmTokens'),
    readSince(db, 'news', 'timestamp', since),
    readSince(db, 'events', 'timestamp', since),
    readSince(db, 'soporte', 'timestamp', since),
    readSince(db, 'chats', 'lastTimestamp', since),
    readSince(db, 'posts', 'createdAt', since),
    readSince(db, 'posts', 'timestamp', since),
    // Avisos agrupados por dia: basta con los dias recientes, sin indice.
    db.ref('mensajes_profesor').orderByKey().startAt(dayKey(since - DIA_MS)).once('value').then(s => s.val() || {})
  ]);
  const posts = { ...postsA, ...postsB };

  // Destinatarios de los avisos generales: quien tiene al menos un telefono registrado.
  const usersWithDevices = Object.keys(tokensByUser);

  // Nodos auxiliares: solo se descargan si hay algo que los necesite.
  const following = Object.keys(posts).length ? await readNode(db, 'siguiendo') : {};
  const users = Object.keys(support).length ? await readNode(db, 'users') : {};

  const updates = {};
  const invalidTokens = [];
  let delivered = 0;
  let sentEvents = 0;

  const processEvent = async ({ eventId, timestamp, targets, title, body, type, entityId }) => {
    if (!timestamp || timestamp <= since || sent[eventId]) return;
    const response = await sendToUsers({ tokensByUser, userIds: targets, title, body, type, entityId });
    delivered += response.delivered;
    invalidTokens.push(...response.invalid);
    updates[`${STATE_PATH}/sent/${eventId}`] = timestamp;
    sentEvents += 1;
  };

  for (const item of flattenChatMessages(chats)) {
    const message = item.value;
    const senderId = message.senderId || message.sender || message.uid || '';
    const targets = asEntries(item.chat.participants).filter(([, active]) => active === true).map(([uid]) => uid).filter(uid => uid !== senderId);
    await processEvent({
      eventId: safeKey(`chat_${item.id}`), timestamp: Number(message.timestamp || 0), targets,
      title: `Mensaje de ${message.senderName || 'RafaConecta'}`,
      body: 'Tienes un nuevo mensaje en el chat institucional.', type: 'chat', entityId: item.id
    });
  }

  for (const [id, item] of asEntries(news)) {
    await processEvent({ eventId: safeKey(`news_${id}`), timestamp: Number(item?.timestamp || 0), targets: usersWithDevices,
      title: 'Nueva noticia institucional', body: String(item?.title || 'Hay una nueva noticia para ti.').slice(0, 120), type: 'news', entityId: id });
  }
  for (const [id, item] of asEntries(events)) {
    await processEvent({ eventId: safeKey(`event_${id}`), timestamp: Number(item?.timestamp || 0), targets: usersWithDevices,
      title: 'Nuevo evento institucional', body: String(item?.title || 'Hay un evento nuevo.').slice(0, 120), type: 'event', entityId: id });
  }
  for (const item of flattenTeacherMessages(teacherRoot)) {
    const message = item.value;
    await processEvent({ eventId: safeKey(`teacher_${item.id}`), timestamp: Number(message.timestamp || 0), targets: usersWithDevices.filter(uid => uid !== message.autorId),
      title: `Anuncio de ${message.autorNombre || 'profesorado'}`, body: String(message.texto || 'Hay un nuevo anuncio.').slice(0, 120), type: 'teacher_message', entityId: item.id });
  }
  for (const [id, post] of asEntries(posts)) {
    const authorId = post?.author?.uid || post?.autorId || '';
    const followers = asEntries(following).filter(([, list]) => Boolean(list?.[authorId])).map(([uid]) => uid);
    await processEvent({ eventId: safeKey(`post_${id}`), timestamp: Number(post?.createdAt || post?.timestamp || 0), targets: followers,
      title: `Nueva publicación de ${post?.author?.name || post?.autorNombre || 'una persona que sigues'}`,
      body: 'Hay una publicación nueva en RafaConecta.', type: 'post', entityId: id });
  }
  const directivos = asEntries(users).filter(([, user]) => user?.role === 'directivo').map(([uid]) => uid);
  for (const [id, ticket] of asEntries(support)) {
    await processEvent({ eventId: safeKey(`support_${id}`), timestamp: Number(ticket?.timestamp || 0), targets: directivos.filter(uid => uid !== ticket.userId),
      title: 'Nueva solicitud de soporte', body: 'Una persona necesita ayuda en RafaConecta.', type: 'support', entityId: id });
  }

  updates[`${STATE_PATH}/lastProcessedAt`] = runStartedAt;
  for (const [eventId, sentAt] of asEntries(sent)) {
    if (Number(sentAt) < runStartedAt - MAX_SENT_AGE_MS) updates[`${STATE_PATH}/sent/${eventId}`] = null;
  }
  for (const entry of invalidTokens) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
  await db.ref().update(updates);
  console.log(`Notificaciones terminadas: ${sentEvents} evento(s) nuevo(s), ${delivered} entrega(s), ${invalidTokens.length} token(s) caducado(s) eliminado(s), ${usersWithDevices.length} cuenta(s) con teléfono registrado.`);
}

async function main() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return;
  const app = initializeApp({ credential: cert(serviceAccount), databaseURL: DATABASE_URL });
  try {
    const db = getDatabase(app);
    const testUid = (process.env.PRUEBA_UID || '').trim();
    if (testUid) await sendTestNotification(db, testUid);
    else await dispatchNotifications(db);
  } finally {
    // Cierra la conexion persistente de Realtime Database. Sin esto el proceso de
    // Node nunca termina y GitHub cancela el job al agotar el tiempo.
    await Promise.race([deleteApp(app), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
}

main()
  .catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  // Salida explicita como red de seguridad ante cualquier conexion que quede abierta.
  .finally(() => process.exit(process.exitCode ?? 0));
