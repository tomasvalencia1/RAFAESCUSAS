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
const MIGRACION_APROBACION = 'notificacionesSistema/migraciones/aprobacionInicial';
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
        fcmOptions: { link: 'https://rafaconecta.vercel.app/' }
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
  // Del estado solo se leen sus valores sueltos: el registro `sent` (35 dias de
  // avisos) se consulta evento a evento y se limpia una vez al dia.
  const [ultimaEjecucion, ultimaLimpieza] = await Promise.all([
    db.ref(`${STATE_PATH}/lastProcessedAt`).once('value').then(s => Number(s.val() || 0)),
    db.ref(`${STATE_PATH}/ultimaLimpieza`).once('value').then(s => Number(s.val() || 0)),
  ]);
  const primeraVez = !ultimaEjecucion;
  const lastProcessedAt = primeraVez ? runStartedAt - LINEA_BASE_MS : ultimaEjecucion;
  const since = primeraVez ? lastProcessedAt : lastProcessedAt - MARGEN_RELOJ_MS;
  const enviados = new Map();
  const enviado = async (eventId) => {
    if (!enviados.has(eventId)) enviados.set(eventId, (await db.ref(`${STATE_PATH}/sent/${eventId}`).once('value')).val());
    return enviados.get(eventId);
  };

  // Solo lo nuevo. Las publicaciones se crean con `createdAt` o con `timestamp`
  // segun la version de la app, asi que se consultan los dos campos.
  const [news, events, support, supportResolved, chats, postsA, postsB, teacherRoot] = await Promise.all([
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

  // Telefonos: solo se descargan cuando hay algo que enviar, y el nodo entero solo
  // para un aviso general; para el resto bastan los de cada destinatario.
  // Solo reciben avisos las cuentas aprobadas y los administradores: una cuenta en
  // espera podria registrar su telefono y ver, por ejemplo, el titulo de una noticia.
  // Mientras no se haya hecho la migracion inicial de aprobaciones no se filtra.
  let filtrarAprobadas;
  const hayQueFiltrar = async () => {
    if (filtrarAprobadas === undefined) filtrarAprobadas = Boolean((await db.ref(MIGRACION_APROBACION).once('value')).val());
    return filtrarAprobadas;
  };
  let tokensTodos = null;
  const cargarTodos = async () => {
    if (!tokensTodos) {
      const [tokens, aprobados, adminsTodos, filtrar] = await Promise.all([
        readNode(db, 'fcmTokens'), readNode(db, 'aprobados'), readNode(db, 'admins'), hayQueFiltrar()]);
      tokensTodos = Object.fromEntries(Object.entries(tokens).filter(([uid]) => !filtrar || aprobados[uid] === true || adminsTodos[uid] === true));
    }
    return tokensTodos;
  };
  const tokensPorUsuario = new Map();
  const tokensDe = async (uids) => {
    if (tokensTodos) return tokensTodos;
    for (const uid of new Set(uids.filter(Boolean))) {
      if (tokensPorUsuario.has(uid)) continue;
      const [tokens, aprobado, admin, filtrar] = await Promise.all([
        readNode(db, `fcmTokens/${uid}`),
        db.ref(`aprobados/${uid}`).once('value').then(s => s.val() === true),
        db.ref(`admins/${uid}`).once('value').then(s => s.val() === true),
        hayQueFiltrar()]);
      tokensPorUsuario.set(uid, !filtrar || aprobado || admin ? tokens : {});
    }
    return Object.fromEntries(tokensPorUsuario);
  };
  // Destinatarios de los avisos generales: quien tiene al menos un telefono registrado.
  const usersWithDevices = async () => Object.keys(await cargarTodos());

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
    if (!timestamp || timestamp <= since || await enviado(eventId)) return;
    const tokensByUser = await tokensDe(targets);
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
    if (!timestamp || timestamp <= since || await enviado(safeKey(`chat_${item.id}`))) continue;
    await processEvent({
      eventId: safeKey(`chat_${item.id}`), timestamp, targets,
      title: `Mensaje de ${await nombreDe(senderId, 'RafaConecta')}`,
      body: 'Tienes un nuevo mensaje en el chat institucional.', type: 'chat', entityId: item.id
    });
  }

  for (const [id, item] of asEntries(news)) {
    const timestamp = Number(item?.timestamp || 0);
    if (!timestamp || timestamp <= since || await enviado(safeKey(`news_${id}`))) continue;
    await processEvent({ eventId: safeKey(`news_${id}`), timestamp, targets: await usersWithDevices(),
      title: 'Nueva noticia institucional', body: String(item?.title || 'Hay una nueva noticia para ti.').slice(0, 120), type: 'news', entityId: id });
  }
  for (const [id, item] of asEntries(events)) {
    const timestamp = Number(item?.timestamp || 0);
    if (!timestamp || timestamp <= since || await enviado(safeKey(`event_${id}`))) continue;
    await processEvent({ eventId: safeKey(`event_${id}`), timestamp, targets: await usersWithDevices(),
      title: 'Nuevo evento institucional', body: String(item?.title || 'Hay un evento nuevo.').slice(0, 120), type: 'event', entityId: id });
  }
  for (const item of flattenTeacherMessages(teacherRoot)) {
    const message = item.value;
    const timestamp = Number(message.timestamp || 0);
    // Un administrador puede borrar un aviso y su hueco volver a usarse el mismo
    // dia: si lo enviado en ese hueco era otro aviso, este cuenta como nuevo.
    if (!timestamp || timestamp <= since) continue;
    const base = safeKey(`teacher_${item.id}`);
    const enviadoEnHueco = await enviado(base);
    const eventId = enviadoEnHueco && Number(enviadoEnHueco) !== timestamp ? safeKey(`teacher_${item.id}_${timestamp}`) : base;
    if (await enviado(eventId)) continue;
    await processEvent({ eventId, timestamp, targets: (await usersWithDevices()).filter(uid => uid !== message.autorId),
      title: `Anuncio de ${await nombreDe(message.autorId, message.autorNombre || 'profesorado')}`, body: String(message.texto || 'Hay un nuevo anuncio.').slice(0, 120), type: 'teacher_message', entityId: item.id });
  }
  for (const [id, post] of asEntries(posts)) {
    const timestamp = Number(post?.createdAt || post?.timestamp || 0);
    if (!timestamp || timestamp <= since || await enviado(safeKey(`post_${id}`))) continue;
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
    if (!timestamp || timestamp <= since || await enviado(safeKey(`support_${id}`))) continue;
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
  if (runStartedAt - ultimaLimpieza > DIA_MS) {
    for (const [eventId, sentAt] of asEntries(await readNode(db, `${STATE_PATH}/sent`))) {
      if (Number(sentAt) < runStartedAt - MAX_SENT_AGE_MS) updates[`${STATE_PATH}/sent/${eventId}`] = null;
    }
    updates[`${STATE_PATH}/ultimaLimpieza`] = runStartedAt;
  }
  for (const entry of invalidTokens) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
  await db.ref().update(updates);
  return { eventos: sentEvents, entregas: delivered, caducados: invalidTokens.length,
           cuentasConTelefono: tokensTodos ? Object.keys(tokensTodos).length : 'sin consultar', primeraVez };
}

// Solo una cuenta aprobada o administradora puede lanzar el despacho desde la app:
// una cuenta en espera no tiene nada que anunciar y podria llamarlo en bucle.
async function cuentaConAcceso(db, uid) {
  const [aprobado, admin, migrado] = await Promise.all([
    db.ref(`aprobados/${uid}`).once('value'), db.ref(`admins/${uid}`).once('value'), db.ref(MIGRACION_APROBACION).once('value')]);
  return aprobado.val() === true || admin.val() === true || !migrado.val();
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

module.exports = { cuentaConAcceso, despacharConBloqueo, dispatchNotifications, enviarPrueba, STATE_PATH, MIGRACION_APROBACION };
