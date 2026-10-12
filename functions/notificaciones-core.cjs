/*
 * Nucleo del despachador de notificaciones de RafaConecta.
 *
 * Lo usan dos entradas con la misma logica:
 *   - api/notificar.js (Vercel): la app lo llama justo despues de publicar algo.
 *   - functions/send-relevant-notifications.cjs (GitHub Actions): respaldo periodico.
 *
 * No depende de ningun SDK. Recibe dos adaptadores:
 *   db        -> ref(path) con once('value'), orderByChild(campo)/orderByKey()
 *                + startAt(valor).once('value'), update(obj), set(v), remove(),
 *                transaction(fn). Lo cumplen firebase-admin y adaptadores-rest.cjs.
 *   messaging -> sendEachForMulticast(mensaje), con la forma de firebase-admin.
 *
 * Descarga lo minimo: solo lo creado desde la ultima ejecucion (requiere los
 * .indexOn de las reglas) y los nodos auxiliares solo si hacen falta.
 */
const STATE_PATH = 'notificacionesSistema/despachador';
const MAX_SENT_AGE_MS = 35 * 24 * 60 * 60 * 1000;
// Los timestamps los pone el reloj del telefono que escribe. Si va atrasado, el
// evento caeria por debajo de la ultima ejecucion; se revisa este margen hacia
// atras y los duplicados los evita el registro `sent`.
const MARGEN_RELOJ_MS = 10 * 60 * 1000;
// Primera ejecucion: se toma como historial solo este tramo, para no inundar los
// telefonos con todo lo anterior pero sin perder el evento que la disparo.
const LINEA_BASE_MS = 2 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
// Un despacho que se interrumpa deja el candado; caduca pasado este tiempo.
const BLOQUEO_MS = 60 * 1000;

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

// Elementos de `path` cuyo hijo `field` es >= `since`, filtrados en el servidor.
async function readSince(db, path, field, since) {
  return (await db.ref(path).orderByChild(field).startAt(since).once('value')).val() || {};
}

// Como readSince, pero si la consulta falla (por ejemplo, porque el indice aun no
// esta publicado justo despues de un despliegue) se omite solo esta parte y el
// resto del despacho sigue adelante.
async function readSinceOpcional(db, path, field, since) {
  try {
    return await readSince(db, path, field, since);
  } catch (error) {
    console.warn(`No se pudo consultar ${path} por ${field}; se omite en esta ejecución: ${error.message}`);
    return {};
  }
}

// --- Moderacion en el servidor ---
// La app marca como "pendiente de revision" lo que contiene palabras prohibidas,
// pero un cliente manipulado podria saltarse esa marca. El despachador repite la
// comprobacion con la misma normalizacion que la app (sin tildes, minusculas).
const PALABRAS_PROHIBIDAS_POR_DEFECTO = ['groseria', 'idiota', 'mierda', 'puta', 'malparido', 'gonorrea'];

function normalizarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function listaDePalabras(valor) {
  const candidatas = Array.isArray(valor) ? valor : Object.values(valor || {});
  const palabras = candidatas.map(p => normalizarTexto(p).trim()).filter(Boolean);
  return palabras.length ? [...new Set(palabras)] : PALABRAS_PROHIBIDAS_POR_DEFECTO;
}

function contienePalabraProhibida(texto, palabras) {
  const normal = normalizarTexto(texto);
  const fichas = normal.split(/[^a-z0-9]+/).filter(Boolean);
  return palabras.some(p => (p.includes(' ') ? normal.includes(p) : fichas.includes(p)));
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

async function sendToUsers(messaging, { tokensByUser, userIds, title, body, type, entityId }) {
  const entries = tokenEntriesForUsers(tokensByUser, userIds);
  if (!entries.length) return { delivered: 0, invalid: [], failed: 0 };

  const invalid = [];
  let delivered = 0;
  let failed = 0;
  for (let start = 0; start < entries.length; start += 500) {
    const batch = entries.slice(start, start + 500);
    const response = await messaging.sendEachForMulticast({
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

async function removeInvalidTokens(db, invalid) {
  if (!invalid.length) return;
  const updates = {};
  for (const entry of invalid) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
  await db.ref().update(updates);
}

// Notificacion de prueba solo a los dispositivos de una cuenta. No toca el estado.
async function enviarPrueba(db, messaging, uid) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid || ''))) {
    return { ok: false, motivo: 'id-invalido', registrados: 0, entregadas: 0 };
  }
  const tokens = await readNode(db, `fcmTokens/${uid}`);
  const registrados = Object.keys(tokens).length;
  if (!registrados) return { ok: false, motivo: 'sin-dispositivos', registrados: 0, entregadas: 0 };

  const r = await sendToUsers(messaging, {
    tokensByUser: { [uid]: tokens }, userIds: [uid],
    title: 'Prueba de RafaConecta',
    body: 'Si ves este aviso, las notificaciones funcionan.',
    type: 'test', entityId: 'prueba'
  });
  await removeInvalidTokens(db, r.invalid);
  return { ok: r.delivered > 0, motivo: r.delivered ? 'entregada' : 'no-entregada',
           registrados, entregadas: r.delivered, fallidas: r.failed, caducados: r.invalid.length };
}

async function dispatchNotifications(db, messaging) {
  const runStartedAt = Date.now();
  const state = await readNode(db, STATE_PATH);
  const primeraVez = !Number(state.lastProcessedAt || 0);
  const lastProcessedAt = primeraVez ? runStartedAt - LINEA_BASE_MS : Number(state.lastProcessedAt);
  const since = primeraVez ? lastProcessedAt : lastProcessedAt - MARGEN_RELOJ_MS;
  const sent = state.sent || {};

  // Solo lo nuevo. Las publicaciones se crean con `createdAt` o con `timestamp`
  // segun la version de la app, asi que se consultan los dos campos.
  const [tokensByUser, news, events, support, supportResolved, chats, postsA, postsB, teacherRoot] = await Promise.all([
    readNode(db, 'fcmTokens'),
    readSince(db, 'news', 'timestamp', since),
    readSince(db, 'events', 'timestamp', since),
    readSince(db, 'soporte', 'timestamp', since),
    readSinceOpcional(db, 'soporte', 'resueltoEn', since),
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
  const hayPosts = Object.keys(posts).length > 0;
  const following = hayPosts ? await readNode(db, 'siguiendo') : {};
  const admins = Object.keys(support).length ? await readNode(db, 'admins') : {};
  const palabrasProhibidas = hayPosts
    ? listaDePalabras((await db.ref('configuracion/moderacion/palabrasProhibidas').once('value')).val())
    : PALABRAS_PROHIBIDAS_POR_DEFECTO;

  // Nombre real de cada persona, leido de su perfil (users/{uid}/name), nunca del
  // que escribe el cliente en el mensaje: asi nadie firma con el nombre de otro.
  // Se piden solo los perfiles necesarios, no el nodo users entero.
  const nombres = new Map();
  const nombreDe = async (uid, respaldo) => {
    if (!uid) return respaldo;
    if (!nombres.has(uid)) {
      const valor = (await db.ref(`users/${uid}/name`).once('value')).val();
      nombres.set(uid, typeof valor === 'string' ? valor.trim() : '');
    }
    return nombres.get(uid) || respaldo;
  };

  const updates = {};
  const invalidTokens = [];
  let delivered = 0;
  let sentEvents = 0;

  const processEvent = async ({ eventId, timestamp, targets, title, body, type, entityId }) => {
    if (!timestamp || timestamp <= since || sent[eventId]) return;
    const response = await sendToUsers(messaging, { tokensByUser, userIds: targets, title, body, type, entityId });
    delivered += response.delivered;
    invalidTokens.push(...response.invalid);
    updates[`${STATE_PATH}/sent/${eventId}`] = timestamp;
    sentEvents += 1;
  };

  for (const item of flattenChatMessages(chats)) {
    const message = item.value;
    const senderId = message.senderId || message.sender || message.uid || '';
    const targets = asEntries(item.chat.participants).filter(([, active]) => active === true).map(([uid]) => uid).filter(uid => uid !== senderId);
    const timestamp = Number(message.timestamp || 0);
    if (!timestamp || timestamp <= since || sent[safeKey(`chat_${item.id}`)]) continue;
    await processEvent({
      eventId: safeKey(`chat_${item.id}`), timestamp, targets,
      title: `Mensaje de ${await nombreDe(senderId, 'RafaConecta')}`,
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
    const timestamp = Number(message.timestamp || 0);
    // Un administrador puede borrar un aviso y su hueco volver a usarse el mismo
    // dia: si lo enviado en ese hueco era otro aviso, este cuenta como nuevo.
    const base = safeKey(`teacher_${item.id}`);
    const eventId = sent[base] && Number(sent[base]) !== timestamp ? safeKey(`teacher_${item.id}_${timestamp}`) : base;
    if (!timestamp || timestamp <= since || sent[eventId]) continue;
    await processEvent({ eventId, timestamp, targets: usersWithDevices.filter(uid => uid !== message.autorId),
      title: `Anuncio de ${await nombreDe(message.autorId, message.autorNombre || 'profesorado')}`, body: String(message.texto || 'Hay un nuevo anuncio.').slice(0, 120), type: 'teacher_message', entityId: item.id });
  }
  for (const [id, post] of asEntries(posts)) {
    const timestamp = Number(post?.createdAt || post?.timestamp || 0);
    if (!timestamp || timestamp <= since || sent[safeKey(`post_${id}`)]) continue;
    // Una publicacion pendiente de revision no se anuncia. Si el cliente no la
    // marco pero contiene palabras prohibidas, se marca aqui.
    if (!post?.flagged && contienePalabraProhibida(post?.content, palabrasProhibidas)) {
      updates[`posts/${id}/flagged`] = true;
      updates[`posts/${id}/reason`] = 'lenguaje inapropiado';
      continue;
    }
    if (post?.flagged) continue;
    const authorId = post?.author?.uid || post?.autorId || '';
    const followers = asEntries(following).filter(([, list]) => Boolean(list?.[authorId])).map(([uid]) => uid);
    await processEvent({ eventId: safeKey(`post_${id}`), timestamp, targets: followers,
      title: `Nueva publicación de ${await nombreDe(authorId, 'una persona que sigues')}`,
      body: 'Hay una publicación nueva en RafaConecta.', type: 'post', entityId: id });
  }
  // Soporte: solo a los administradores, que son quienes tienen el buzon. La
  // notificacion incluye quien escribe y un extracto.
  const equipoDeSoporte = asEntries(admins).filter(([, activo]) => activo === true).map(([uid]) => uid);
  for (const [id, ticket] of asEntries(support)) {
    const timestamp = Number(ticket?.timestamp || 0);
    if (!timestamp || timestamp <= since || sent[safeKey(`support_${id}`)]) continue;
    const autor = String(await nombreDe(ticket?.userId, '')).trim();
    const texto = String(ticket?.texto || '').replace(/\s+/g, ' ').trim();
    await processEvent({ eventId: safeKey(`support_${id}`), timestamp: Number(ticket?.timestamp || 0), targets: equipoDeSoporte.filter(uid => uid !== ticket.userId),
      title: autor ? `Solicitud de soporte de ${autor}`.slice(0, 80) : 'Nueva solicitud de soporte',
      body: texto ? (texto.length > 100 ? `${texto.slice(0, 99)}…` : texto) : 'Una persona necesita ayuda en RafaConecta.',
      type: 'support', entityId: id });
  }

  // Solicitud marcada como resuelta: se avisa a quien la escribio. El id del
  // evento incluye la hora de resolucion, asi que reabrir y volver a resolver
  // avisa otra vez. Quien resuelve su propia solicitud no recibe aviso.
  for (const [id, ticket] of asEntries(supportResolved)) {
    if (ticket?.estado !== 'resuelto' || !ticket?.userId || ticket.userId === ticket.resueltoPor) continue;
    const resueltoEn = Number(ticket.resueltoEn || 0);
    const texto = String(ticket.texto || '').replace(/\s+/g, ' ').trim();
    await processEvent({ eventId: safeKey(`support_resolved_${id}_${resueltoEn}`), timestamp: resueltoEn, targets: [ticket.userId],
      title: 'Tu solicitud de soporte fue resuelta',
      body: texto ? `«${texto.length > 90 ? `${texto.slice(0, 89)}…` : texto}»` : 'Un administrador marcó tu solicitud como resuelta.',
      type: 'support_resolved', entityId: id });
  }

  updates[`${STATE_PATH}/lastProcessedAt`] = runStartedAt;
  if (primeraVez) updates[`${STATE_PATH}/initializedAt`] = runStartedAt;
  for (const [eventId, sentAt] of asEntries(sent)) {
    if (Number(sentAt) < runStartedAt - MAX_SENT_AGE_MS) updates[`${STATE_PATH}/sent/${eventId}`] = null;
  }
  for (const entry of invalidTokens) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
  await db.ref().update(updates);
  return { eventos: sentEvents, entregas: delivered, caducados: invalidTokens.length,
           cuentasConTelefono: usersWithDevices.length, primeraVez };
}

// Un solo despacho a la vez (Vercel y GitHub pueden coincidir). Quien llega con
// el candado ocupado deja una marca `pendiente` y el que lo tiene repite al acabar.
async function despacharConBloqueo(db, messaging) {
  const lockRef = db.ref(`${STATE_PATH}/bloqueo`);
  const pendingRef = db.ref(`${STATE_PATH}/pendiente`);
  const ahora = Date.now();
  const toma = await lockRef.transaction(actual =>
    (!actual || ahora - Number(actual) > BLOQUEO_MS) ? ahora : undefined);
  if (!toma.committed) {
    await pendingRef.set(true);
    return { estado: 'en-curso' };
  }
  try {
    let resultado;
    let vueltas = 0;
    do {
      await pendingRef.remove();
      resultado = await dispatchNotifications(db, messaging);
      vueltas += 1;
    } while (vueltas < 3 && (await pendingRef.once('value')).val());
    return { estado: 'completado', vueltas, ...resultado };
  } finally {
    await lockRef.remove();
  }
}

module.exports = { despacharConBloqueo, dispatchNotifications, enviarPrueba, STATE_PATH };
